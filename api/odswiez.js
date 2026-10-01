import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

// Wpisujemy Twoje dwa serwery na sztywno z bazy, aby wyeliminować błędy pobierania listy IP
const SERWERY_DO_SPRAWDZENIA = [
  { id: 1, type: 'cs16', host: '54.38.131.56', port: 27015 },
  { id: 2, type: 'cs2',  host: '51.77.47.219', port: 27015 }
];

export default async function handler(req, res) {
  const paczkaDanych = [];

  // Równoległe odpytywanie serwerów
  const obietnice = SERWERY_DO_SPRAWDZENIA.map(async (srv) => {
    let map = (srv.type === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      // Zapytanie do stabilnego publicznego proxy trackera xPaw
      const response = await axios.get(`https://vaughn.live{srv.host}:${srv.port}`, { 
        timeout: 4000 
      });

      if (response.data && (response.data.online === true || response.data.map)) {
        const d = response.data;
        serverIsOnline = true;
        map = d.map || d.current_map || map;
        playersCount = d.players_online ?? d.players ?? 0;
        maxPlayers = d.max_players || 32;
      }
    } catch (e) {
      serverIsOnline = false;
    }

    return {
      id: srv.id,
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      map: map,
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers)
    };
  });

  const wyniki = await Promise.all(obietnice);

  // Przesyłamy gotowy plik JSON bezpośrednio w nagłówku do Twojego index.php
  try {
    const response = await axios.post(bramkaUrl, wyniki, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 6000
    });
    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: response.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad zapisu JSON na SeoHost: ' + e.message });
  }
}
