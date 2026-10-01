import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

// Serwery odczytane bezpośrednio z Twojego phpMyAdmin
const SERWERY_DO_SPRAWDZENIA = [
  { id: 16, type: 'cs16', host: '51.83.166.59', port: 27015 },  // Serwer Zombie EXP 100 LVL
  { id: 17, type: 'cs16', host: '54.38.131.56', port: 27015 },  // Serwer NGNW.PL [ONLY DD2]
  { id: 18, type: 'cs2',  host: '51.83.210.20', port: 27015 },  // Serwer ★ MIRAGE ★
  { id: 19, type: 'cs2',  host: '51.77.47.219', port: 27015 }   // Serwer ★ uwujka.pl ★ [CS2 ZMAPS]
];

export default async function handler(req, res) {
  const paczkaDanych = [];

  // Równoległe odpytywanie wszystkich serwerów
  const obietnice = SERWERY_DO_SPRAWDZENIA.map(async (srv) => {
    const typGry = srv.type;
    
    // Zabezpieczenie wartości startowych (pobieramy de_mirage lub de_dust2)
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      // Używamy darmowego, publicznego i stabilnego API Game-State przez HTTP GET
      // Vercel nie ma blokad firewall i bez problemu przeczyta tę strukturę JSON
      const response = await axios.get(`https://game-state.com{srv.host}:${srv.port}`, { 
        timeout: 4000 
      });

      const d = response.data;
      const root = d.data || d;

      if (root && root.status !== 'offline') {
        serverIsOnline = true;
        // Elastyczne mapowanie kluczy (obsługuje wielkie i małe litery w parametrach)
        map = root.map || root.mapname || root.MAP || root.MAPNAME || map;
        playersCount = root.players ?? root.players_online ?? root.PLAYERS ?? 0;
        maxPlayers = root.max_players ?? root.players_max ?? root.MAX_PLAYERS ?? 32;
      }
    } catch (e) {
      serverIsOnline = false;
    }

    return {
      id: parseInt(srv.id),
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      map: map.toString().trim(),
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers)
    };
  });

  const wyniki = await Promise.all(obietnice);

  // Przesyłamy bezpieczną paczkę url-encoded do Twojego index.php na SeoHost
  const params = new URLSearchParams();
  params.append('data_packet', JSON.stringify(wyniki));

  try {
    const responseSave = await axios.post(bramkaUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });

    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: responseSave.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad podczas komunikacji z index.php: ' + e.message });
  }
}
