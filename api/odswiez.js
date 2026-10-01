import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

// Zdefiniowane serwery z Twojego phpMyAdmin
const SERWERY_DO_SPRAWDZENIA = [
  { id: 16, type: 'cs16', host: '51.83.166.59', port: 27015 },  // Serwer Zombie EXP 100 LVL
  { id: 17, type: 'cs16', host: '54.38.131.56', port: 27015 },  // Serwer NGNW.PL [ONLY DD2]
  { id: 18, type: 'cs2',  host: '51.83.210.20', port: 27015 },  // Serwer ★ MIRAGE ★
  { id: 19, type: 'cs2',  host: '51.77.47.219', port: 27015 }   // Serwer ★ uwujka.pl ★ [CS2 ZMAPS]
];

export default async function handler(req, res) {
  const paczkaDanych = [];

  // Równoległe odpytywanie oficjalnej Masterlisty Valve przez HTTP GET
  const obietnice = SERWERY_DO_SPRAWDZENIA.map(async (srv) => {
    const typGry = srv.type;
    
    // Zabezpieczenie wartości startowych na wypadek problemów z połączeniem
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    // Przypisanie oficjalnego identyfikatora gry Valve (CS 1.6 = AppID 10, CS2 = AppID 730)
    const appId = (typGry === 'cs16') ? 10 : 730;

    try {
      // Oficjalny publiczny endpoint Valve - nie wymaga klucza API i działa bezpośrednio na Vercelu
      const response = await axios.get(
        `https://steampowered.com\\appid\\${appId}\\addr\\${srv.host}:${srv.port}`, 
        { timeout: 4000 }
      );

      if (response.data?.response?.servers?.length > 0) {
        const sData = response.data.response.servers[0];
        serverIsOnline = true;
        
        // Pobieramy pełną nazwę mapy bezpośrednio z pamięci serwera Valve
        if (sData.map && sData.map.trim().length > 0) {
          map = sData.map.trim();
        }
        
        playersCount = typeof sData.players !== 'undefined' ? sData.players : 0;
        maxPlayers = sData.max_players || 32;
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

  // Przesyłamy bezpieczny plik strukturalny JSON na hosting SeoHost
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
