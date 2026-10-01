import axios from 'axios';
import dns from 'dns';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

const resolveIp = (host) => {
  return new Promise((resolve) => {
    dns.lookup(host, (err, address) => {
      if (err) resolve(host);
      else resolve(address);
    });
  });
};

export default async function handler(req, res) {
  let serwery = [];
  try {
    const getList = await axios.post(bramkaUrl, 'action=get_servers_list', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });
    if (Array.isArray(getList.data)) {
      serwery = getList.data;
    }
  } catch (e) {
    return res.status(500).json({ error: 'Brak dostepu do bazy: ' + e.message });
  }

  const paczkaDanych = [];

  for (const srv of serwery) {
    const typGry = srv.typ_gry || srv.type || 'cs16';
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      const realIp = await resolveIp(srv.host);
      
      // Oficjalne, szybkie zapytanie HTTP GET akceptowane przez Vercel
      const response = await axios.get(`https://game-state.com{realIp}:${srv.port}`, { 
        timeout: 4000 
      });

      if (response.data && response.data.status !== 'offline') {
        const d = response.data;
        serverIsOnline = true;
        map = d.map || d.mapname || map;
        playersCount = d.players ?? d.players_online ?? 0;
        maxPlayers = d.max_players ?? d.players_max ?? 32;
      }
    } catch (e) {
      serverIsOnline = false;
    }

    paczkaDanych.push({
      id: srv.id,
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      name: '', 
      map: serverIsOnline ? map : (typGry === 'cs2' ? 'de_mirage' : 'brak danych'),
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers), 
      gracze_lista: []
    });
  }

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
