import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

export default async function handler(req, res) {
  let serwery = [];
  
  // 1. Pobieranie listy serwerów z Twojej bazy danych
  try {
    const getList = await axios.post(bramkaUrl, 'action=get_servers_list', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });
    
    if (getList.data && Array.isArray(getList.data)) {
      serwery = getList.data;
    } else {
      return res.status(200).json({ status: 'Brak serwerów do przetworzenia w bazie' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Brak dostepu do bazy: ' + e.message });
  }

  const paczkaDanych = [];

  // 2. Przetwarzanie serwerów
  for (const srv of serwery) {
    const typGry = srv.typ_gry || srv.type || 'cs16';
    const host = srv.host || srv.ip;
    const port = srv.port || 27015;
    
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    // PRÓBA 1: Oficjalna masterlista Steam (Najwyższy priorytet dla CS2 i CS 1.6)
    try {
      if (host) {
        const steamResponse = await axios.get(`https://steampowered.com\\addr\\${host}:${port}`, { 
          timeout: 3000 
        });

        if (steamResponse.data?.response?.servers?.length > 0) {
          const sData = steamResponse.data.response.servers[0];
          serverIsOnline = true;
          map = sData.map || map;
          playersCount = sData.players ?? 0;
          maxPlayers = sData.max_players || 32;
        }
      }
    } catch (e) {
      serverIsOnline = false;
    }

    // PRÓBA 2: Fallback do Game-State z mapowaniem wielkich i małych liter (Jeśli Steam nie odpowiedział)
    if (!serverIsOnline && host) {
      try {
        const gsResponse = await axios.get(`https://game-state.com{host}:${port}`, { 
          timeout: 3000 
        });

        const d = gsResponse.data;
        // Game-state potrafi zwrócić strukturę w d.data lub bezpośrednio w d
        const root = d.data || d;

        if (root && root.status !== 'offline') {
          serverIsOnline = true;
          // UNIFIKACJA WIELKOŚCI LITER (API Game-State często zwraca klucze 'map' lub 'mapname')
          map = root.map || root.mapname || root.MAP || root.MAPNAME || map;
          playersCount = root.players ?? root.players_online ?? root.PLAYERS ?? 0;
          maxPlayers = root.max_players ?? root.players_max ?? root.MAX_PLAYERS ?? 32;
        }
      } catch (e) {
        serverIsOnline = false;
      }
    }

    // Bezpieczne mapowanie danych przed wysyłką do bazy MySQL
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

  // 3. Przesłanie gotowych danych na hosting SeoHost
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
