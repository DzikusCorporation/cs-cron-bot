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

  // Równoległe odpytywanie stabilnego API monitorującego serwery gier
  const obietnice = SERWERY_DO_SPRAWDZENIA.map(async (srv) => {
    const typGry = srv.type;
    
    // Zabezpieczenie wartości na wypadek awarii (zostawiamy de_dust2 / de_mirage)
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      // Używamy otwartego i szybkiego API trackera dla rynku polskiego (xPaw i 101servers clone)
      const response = await axios.get(`https://trackyserver.com{srv.host}&port=${srv.port}`, { 
        timeout: 4500 
      }).catch(async () => {
        // Fallback: zapasowe publiczne API, jeśli pierwsze miałoby timeout
        return await axios.get(`https://vaughn.live{srv.host}:${srv.port}`, { timeout: 3500 });
      });

      const d = response.data;

      // Mapujemy zróżnicowane struktury odpowiedzi JSON
      if (d && (d.status === 'online' || d.online === true || d.map)) {
        serverIsOnline = true;
        map = d.map || d.mapname || d.active_map || map;
        playersCount = d.players ?? d.players_online ?? 0;
        maxPlayers = d.max_players ?? d.players_max ?? 32;
      }
    } catch (e) {
      serverIsOnline = false;
    }

    return {
      id: srv.id,
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      map: map.trim(),
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers)
    };
  });

  const wyniki = await Promise.all(obietnice);

  // Przesyłamy kompletny, pewny i nieblokowany plik strukturalny JSON na hosting SeoHost
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
