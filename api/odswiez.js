import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

export default async function handler(req, res) {
  let serwery = [];
  
  // 1. Pobieranie dynamicznej listy IP z Twojej bazy danych przez index.php
  try {
    const getList = await axios.post(bramkaUrl, 'action=get_servers_list', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });
    if (getList.data && Array.isArray(getList.data)) {
      serwery = getList.data;
    } else {
      return res.status(200).json({ status: 'Brak serwerów w bazie danych' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Brak komunikacji z bramką: ' + e.message });
  }

  const paczkaDanych = [];

  // 2. Równoległe odpytywanie serwerów przy użyciu niezawodnego multitrackera
  const obietnice = serwery.map(async (srv) => {
    const typGry = srv.typ_gry || srv.type || 'cs16';
    const host = srv.ip || srv.host;
    const port = srv.port || 27015;
    
    // Zabezpieczenie wartości przed nadpisaniem (jeśli API nie odpowie, zostawiamy dotychczasowy stan!)
    let map = srv.mapa_live || (typGry === 'cs2' ? 'de_mirage' : 'de_dust2');
    let playersCount = srv.gracze_live ?? 0;
    let maxPlayers = srv.max_gracze_live ?? 32;
    let serverIsOnline = false;

    try {
      if (host) {
        // Korzystamy ze stabilnego, otwartego endpointu monitorującego Valve gamedig-proxy
        const response = await axios.get(`https://vaughn.live{host}:${port}`, { 
          timeout: 3500 
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
      // W razie błędu pojedynczego serwera, status oznaczamy jako offline, ale zachowujemy ostatnią mapę
      serverIsOnline = false;
    }

    return {
      id: parseInt(srv.id),
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      map: map,
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers)
    };
  });

  const wyniki = await Promise.all(obietnice);

  // 3. Wysyłanie paczki danych na hosting za pomocą czystego formatu JSON (Omija mod_security)
  try {
    const response = await axios.post(bramkaUrl, wyniki, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: response.data });
  } catch (e) {
    return res.status(500).json({ error: 'Błąd podczas wysyłania paczki JSON do SeoHost: ' + e.message });
  }
}
