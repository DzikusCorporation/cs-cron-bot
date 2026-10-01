<?php
// Wymuszenie wyświetlania błędów na czas testów
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

set_time_limit(30);

// TUTAJ: Upewnij się, że ten URL prowadzi dokładnie do Twojego pliku index.php na SeoHost!
$bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

// 1. Pobieramy dynamiczną listę serwerów z Twojej bazy danych przez index.php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $bramkaUrl);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, 'action=get_servers_list');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
$response_list = curl_exec($ch);
curl_close($ch);

$serwery = json_decode($response_list, true);

if (!is_array($serwery)) {
    die("Brak dostepu do bazy danych lub lista serwerow jest pusta. Otrzymano: " . htmlspecialchars($response_list));
}

// Bezpieczna funkcja cURL do odpytywania stabilnych zewnętrznych HTTP WebAPI
function pobierzHttp($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 4);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Valve/Steam-Client');
    $data = curl_exec($ch);
    curl_close($ch);
    return $data;
}

$paczkaDanych = array();

// 2. Pętla przetwarzająca każdy serwer za pomocą niezawodnych mostków HTTP API
foreach ($serwery as $srv) {
    // Akceptujemy zarówno klucze 'host' jak i 'ip' z bazy danych
    $host = isset($srv['host']) ? $srv['host'] : (isset($srv['ip']) ? $srv['ip'] : '');
    $port = isset($srv['port']) ? intval($srv['port']) : 27015;
    $typ_gry = isset($srv['typ_gry']) ? $srv['typ_gry'] : (isset($srv['type']) ? $srv['type'] : 'cs16');
    $srv_id = intval($srv['id']);

    if (empty($host) || $srv_id <= 0) continue;

    // Przypisanie bezpiecznych wartości domyślnych (pobieranych ze stanu bazy, by nie resetować map zombie!)
    $map = !empty($srv['mapa_live']) ? $srv['mapa_live'] : (($typ_gry === 'cs2') ? 'de_mirage' : 'de_dust2');
    $playersCount = isset($srv['gracze_live']) ? intval($srv['gracze_live']) : 0;
    $maxPlayers = !empty($srv['max_gracze_live']) ? intval($srv['max_gracze_live']) : 32;
    $server_is_online = false;

    // PRÓBA 1: Odpytanie przez globalne, stabilne i darmowe API mcsrvstat dedykowane serwerom Steam
    $apiUrl = "https://mcsrvstat.us{$host}:{$port}";
    $apiResponse = pobierzHttp($apiUrl);

    if ($apiResponse) {
        $json = json_decode($apiResponse, true);
        if ($json && isset($json['online']) && $json['online'] === true) {
            $server_is_online = true;
            $map = !empty($json['map']) ? trim($json['map']) : $map;
            $playersCount = isset($json['players']['online']) ? intval($json['players']['online']) : $playersCount;
            $maxPlayers = isset($json['players']['max']) ? intval($json['players']['max']) : $maxPlayers;
        }
    }

    // PRÓBA 2 (FALLBACK): Jeśli pierwsze API milczy, uderzamy do rozproszonego API trackera xPaw
    if (!$server_is_online) {
        $fallbackUrl = "https://vaughn.live{$host}:{$port}";
        $fbResponse = pobierzHttp($fallbackUrl);

        if ($fbResponse) {
            $json_fb = json_decode($fbResponse, true);
            if ($json_fb && (isset($json_fb['online']) && $json_fb['online'] === true || isset($json_fb['map']))) {
                $server_is_online = true;
                $map = !empty($json_fb['map']) ? trim($json_fb['map']) : (!empty($json_fb['current_map']) ? trim($json_fb['current_map']) : $map);
                $playersCount = isset($json_fb['players_online']) ? intval($json_fb['players_online']) : (isset($json_fb['players']) ? intval($json_fb['players']) : $playersCount);
                $maxPlayers = !empty($json_fb['max_players']) ? intval($json_fb['max_players']) : $maxPlayers;
            }
        }
    }

    $real_status = $server_is_online ? 'ONLINE' : 'OFFLINE';

    // Jeśli serwer faktycznie zgaśnie (offline), zerujemy graczy, ale zachowujemy ostatnią znaną mapę zombie
    if (!$server_is_online) {
        $playersCount = 0;
    }

    $paczkaDanych[] = array(
        'id' => $srv_id,
        'status' => $real_status,
        'map' => $map,
        'players' => intval($playersCount),
        'max_players' => intval($maxPlayers),
        'gracze_lista' => array()
    );
}

// 3. Przesyłamy kompletny, bezpieczny pakiet danych w uniwersalnej zmiennej formularza na Twój hosting
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $bramkaUrl);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, 'data_packet=' . urlencode(json_encode($paczkaDanych)));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 8);
$output = curl_exec($ch);
curl_close($ch);

echo "Status odswiezania bramki: " . htmlspecialchars($output);
?>
