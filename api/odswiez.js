import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

// Przypisane poprawne numery ID oraz IP odczytane bezpośrednio z Twojego phpMyAdmin
const SERWERY_DO_SPRAWDZENIA = [
  { id: 16, type: 'cs16', host: '51.83.166.59', port: 27015 },  // Serwer Zombie EXP 100 LVL
  { id: 17, type: 'cs16', host: '54.38.131.56', port: 27015 },  // Serwer NGNW.PL [ONLY DD2]
  { id: 18, type: 'cs2',  host: '51.83.210.20', port: 27015 },  // Serwer ★ MIRAGE ★
  { id: 19, type: 'cs2',  host: '51.77.47.219', port: 27015 }   // Serwer ★ uwujka.pl ★ [CS2 ZMAPS]
];

export default async function handler(req, res) {
  const paczkaDanych = [];

  // Odpytywanie wszystkich serwerów równolegle
  const obietnice = SERWERY_DO_SPRAWDZENIA.map(async (srv) => {
    const typGry = srv.type;
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      // Pobieranie danych z darmowego i stabilnego API mcsrvstat dedykowanego serwerom Steam
      const response = await axios.get(`https://mcsrvstat.us{srv.host}:${srv.port}`, { 
        timeout: 4500 
      });

      if (response.data && response.data.online === true) {
        serverIsOnline = true;
        map = response.data.map || map;
        playersCount = response.data.players?.online ?? 0;
        maxPlayers = response.data.players?.max ?? 32;
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

  // Pakujemy dane do bezpiecznego formatu formularza url-encoded (akceptowanego przez SeoHost)
  const params = new URLSearchParams();
  params.append('data_packet', JSON.stringify(wyniki));

  try {
    const response = await axios.post(bramkaUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 6000
    });
    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: response.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad podczas komunikacji z index.php: ' + e.message });
  }
}
