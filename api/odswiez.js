import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

const SERWERY_DO_SPRAWDZENIA = [
  { id: 16, type: 'cs16', host: '51.83.166.59', port: 27015 },  // Serwer Zombie EXP 100 LVL
  { id: 17, type: 'cs16', host: '54.38.131.56', port: 27015 },  // Serwer NGNW.PL [ONLY DD2]
  { id: 18, type: 'cs2',  host: '51.83.210.20', port: 27015 },  // Serwer ★ MIRAGE ★
  { id: 19, type: 'cs2',  host: '51.77.47.219', port: 27015 }   // Serwer ★ uwujka.pl ★ [CS2 ZMAPS]
];

export default async function handler(req, res) {
  const paczkaDanych = [];

  const obietnice = SERWERY_DO_SPRAWDZENIA.map(async (srv) => {
    const typGry = srv.type;
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      // Pobieranie danych przez stabilny i niezablokowany tracker HTTP TrackyServer
      const response = await axios.get(`https://trackyserver.com{srv.host}&port=${srv.port}`, { 
        timeout: 4000 
      });

      if (response.data && response.data.map) {
        serverIsOnline = true;
        map = response.data.map;
        playersCount = response.data.players ?? 0;
        maxPlayers = response.data.max_players ?? 32;
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

  try {
    const response = await axios.post(bramkaUrl, wyniki, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 6000
    });
    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: response.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad podczas komunikacji z index.php: ' + e.message });
  }
}
