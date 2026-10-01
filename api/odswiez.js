import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

export default async function handler(req, res) {
  let serwery = [];
  
  try {
    const getList = await axios.post(bramkaUrl, 'action=get_servers_list', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });
    
    if (getList.data && Array.isArray(getList.data)) {
      serwery = getList.data;
    } else {
      return res.status(200).json({ status: 'Brak serwerów w bazie' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Brak dostepu do bazy: ' + e.message });
  }

  const paczkaDanych = [];

  for (const srv of serwery) {
    const typGry = srv.typ_gry || srv.type || 'cs16';
    const host = srv.host || srv.ip;
    const port = srv.port || 27015;
    
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    // PRÓBA 1: Użycie publicznego, otwartego proxy dla Masterlisty Valve (Bez klucza API)
    try {
      if (host) {
        const response = await axios.get(`https://vaughn.live{host}:${port}`, { 
          timeout: 4000 
        });

        if (response.data && typeof response.data.online !== 'undefined') {
          const d = response.data;
          if (d.online === true || d.players_online > 0 || d.map) {
            serverIsOnline = true;
            map = d.map || d.current_map || map;
            playersCount = d.players ?? d.players_online ?? 0;
            maxPlayers = d.max_players ?? 32;
          }
        }
      }
    } catch (e) {
      serverIsOnline = false;
    }

    // PRÓBA 2: Rezerwowe publiczne API (Game-State) jako fallback
    if (!serverIsOnline && host) {
      try {
        const gsResponse = await axios.get(`https://game-state.com{host}:${port}`, { 
          timeout: 3000 
        });
        const root = gsResponse.data?.data || gsResponse.data;

        if (root && root.status !== 'offline') {
          serverIsOnline = true;
          map = root.map || root.mapname || map;
          playersCount = root.players ?? root.players_online ?? 0;
          maxPlayers = root.max_players ?? root.players_max ?? 32;
        }
      } catch (gsError) {
        serverIsOnline = false;
      }
    }

    paczkaDanych.push({
      id: parseInt(srv.id),
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      name: '', 
      map: serverIsOnline ? map : (typGry === 'cs2' ? 'de_mirage' : 'brak danych'),
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers), 
      gracze_lista: []
    });
  }

  // 3. Przesłanie kompletnych danych do index.php na SeoHost
  try {
    const response = await axios.post(bramkaUrl, 
      'data_packet=' + encodeURIComponent(JSON.stringify(paczkaDanych)),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000
      }
    );
    
    return res.status(200).json({ status: 'Sukces', response: response.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad bramki SeoHost: ' + e.message });
  }
}
