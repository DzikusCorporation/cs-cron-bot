import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

export default async function handler(req, res) {
  let serwery = [];
  
  // 1. Pobieranie listy IP z SeoHost
  try {
    const getList = await axios.post(bramkaUrl, 'action=get_servers_list', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });
    if (getList.data && Array.isArray(getList.data)) {
      serwery = getList.data;
    } else {
      return res.status(200).json({ status: 'Brak serwerów do przetworzenia' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Brak komunikacji z index.php: ' + e.message });
  }

  const paczkaDanych = [];

  // 2. Odpytywanie serwerów
  for (const srv of serwery) {
    const typGry = srv.typ_gry || srv.type || 'cs16';
    const host = srv.ip || srv.host;
    const port = srv.port || 27015;
    
    // Bezpieczny fallback pobierany bezpośrednio ze stanu bazy danych
    let map = srv.mapa_live || (typGry === 'cs2' ? 'de_mirage' : 'de_dust2');
    let playersCount = srv.gracze_live || 0;
    let maxPlayers = srv.max_gracze_live || 32;
    let serverIsOnline = false;

    try {
      if (host) {
        const response = await axios.get(`https://vaughn.live{host}:${port}`, { 
          timeout: 4000 
        });

        if (response.data && (response.data.online === true || response.data.map)) {
          const d = response.data;
          serverIsOnline = true;
          map = d.map || d.current_map || map;
          playersCount = d.players_online ?? d.players ?? 0;
          maxPlayers = d.max_players || 32;
        }
      }
    } catch (e) {
      serverIsOnline = false;
    }

    paczkaDanych.push({
      id: parseInt(srv.id),
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      map: map,
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers)
    });
  }

  // 3. Wysyłanie paczki jako natywny nagłówek APPLICATION/JSON (Omija mod_security)
  try {
    const response = await axios.post(bramkaUrl, paczkaDanych, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 6000
    });
    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: response.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad zapisu JSON na SeoHost: ' + e.message });
  }
}
