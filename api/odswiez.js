import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

// TUTAJ: Wklej wygenerowany klucz Steam WebAPI (32 znaki)
const STEAM_API_KEY = 'B33A72CD09644B1BA61FAE957DB148CE';

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
    
    // Zachowujemy obecny stan z bazy jako fallback, zamiast de_dust2!
    let map = srv.mapa_live || ''; 
    let playersCount = srv.gracze_live || 0;
    let maxPlayers = srv.max_gracze_live || 32;
    let serverIsOnline = false;

    // CS 1.6 = AppID 10, CS2 = AppID 730
    const appId = (typGry === 'cs16') ? 10 : 730;

    try {
      if (host) {
        // Oficjalny, nieblokowany endpoint Valve Steam Masterlist
        const response = await axios.get(
          `https://steampowered.com{STEAM_API_KEY}&filter=\\appid\\${appId}\\addr\\${host}:${port}`, 
          { timeout: 4000 }
        );

        if (response.data?.response?.servers?.length > 0) {
          const sData = response.data.response.servers[0];
          serverIsOnline = true;
          map = sData.map || map;
          playersCount = sData.players ?? 0;
          maxPlayers = sData.max_players || 32;
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
