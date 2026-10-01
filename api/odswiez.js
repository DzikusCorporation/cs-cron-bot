<?php
// Wymuszenie wyświetlania błędów na czas testów
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

set_time_limit(30);

// Adres URL prowadzący do Twojego pliku index.php na SeoHost
$bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

// 1. Pobieramy dynamiczną lista serwerów z Twojej bazy danych przez index.php
$options_list = array(
    'http' => array(
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => 'action=get_servers_list',
        'timeout' => 5
    )
);
$context_list = stream_context_create($options_list);
$response_list = @file_get_contents($bramkaUrl, false, $context_list);

$serwery = json_decode($response_list, true);

if (!is_array($serwery)) {
    die("Brak dostepu do bazy danych lub lista serwerow jest pusta. Otrzymano: " . htmlspecialchars($response_list));
}

$paczkaDanych = array();

// 2. Pętla przetwarzająca każdy serwer za pomocą niezawodnych mostków HTTP API
foreach ($serwery as $srv) {
    $host = isset($srv['host']) ? $srv['host'] : (isset($srv['ip']) ? $srv['ip'] : '');
    $port = isset($srv['port']) ? intval($srv['port']) : 27015;
    $typ_gry = isset($srv['typ_gry']) ? $srv['typ_gry'] : (isset($srv['type']) ? $srv['type'] : 'cs16');
    $srv_id = intval($srv['id']);

    if (empty($host) || $srv_id <= 0) continue;

    // Pobieranie stanu z bazy, aby nie resetować map zombie przy ewentualnym timeoutcie API
    $map = !empty($srv['mapa_live']) ? $srv['mapa_live'] : (($typ_gry === 'cs2') ? 'de_mirage' : 'de_dust2');
    $playersCount = isset($srv['gracze_live']) ? intval($srv['gracze_live']) : 0;
    $maxPlayers = !empty($srv['max_gracze_live']) ? intval($srv['max_gracze_live']) : 32;
    $server_is_online = false;

    // Przypisanie identyfikatora AppID gry sieciowej Steam (CS 1.6 = 10, CS2 = 730)
    $appId = ($typ_gry === 'cs16') ? 10 : 730;

    // PRÓBA 1: Oficjalny publiczny endpoint Valve - nie wymaga klucza API i działa bezpośrednio na Vercelu przez HTTP
    $url_valve = "https://steampowered.com\\appid\\{$appId}\\addr\\{$host}:{$port}";
    $ctx_valve = stream_context_create(array('http' => array('timeout' => 3)));
    $res_valve = @file_get_contents($url_valve, false, $ctx_valve);

    if ($res_valve) {
        $json_valve = json_decode($res_valve, true);
        if (!empty($json_valve['response']['servers'][0])) {
            $sData = $json_valve['response']['servers'][0];
            $server_is_online = true;
            $map = !empty($sData['map']) ? trim($sData['map']) : $map;
            $playersCount = isset($sData['players']) ? intval($sData['players']) : $playersCount;
            $maxPlayers = !empty($sData['max_players']) ? intval($sData['max_players']) : $maxPlayers;
        }
    }

    // PRÓBA 2 (FALLBACK): Jeśli Valve milczy, uderzamy do darmowego trackera mcsrvstat
    if (!$server_is_online) {
        $url_fallback = "https://mcsrvstat.us{$host}:{$port}";
        $ctx_fb = stream_context_create(array('http' => array('timeout' => 3)));
        $res_fb = @file_get_contents($url_fallback, false, $ctx_fb);

        if ($res_fb) {
            $json_fb = json_decode($res_fb, true);
            if ($json_fb && isset($json_fb['online']) && $json_fb['online'] === true) {
                $server_is_online = true;
                $map = !empty($json_fb['map']) ? trim($json_fb['map']) : $map;
                $playersCount = isset($json_fb['players']['online']) ? intval($json_fb['players']['online']) : $playersCount;
                $maxPlayers = isset($json_fb['players']['max']) ? intval($json_fb['players']['max']) : $maxPlayers;
            }
        }
    }

    $real_status = $server_is_online ? 'ONLINE' : 'OFFLINE';
    if (!$server_is_online) { $playersCount = 0; }

    $paczkaDanych[] = array(
        'id' => $srv_id,
        'status' => $real_status,
        'map' => $map,
        'players' => intval($playersCount),
        'max_players' => intval($maxPlayers),
        'gracze_lista' => array()
    );
}

// 3. Przesyłamy kompletny, bezpieczny pakiet danych w uniwersalnej zmiennej formularza POST na Twój hosting
$postdata = http_build_query(array('data_packet' => json_encode($paczkaDanych)));
$options_save = array(
    'http' => array(
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => $postdata,
        'timeout' => 5
    )
);
$context_save = stream_context_create($options_save);
$output = @file_get_contents($bramkaUrl, false, $context_save);

echo "Status odswiezania bramki: " . htmlspecialchars($output);
?>
