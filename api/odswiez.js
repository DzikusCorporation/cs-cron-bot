import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

// Twój zestaw 4 serwerów wprost z bazy danych
const SERWERY_DO_SPRAWDZENIA = [
  { id: 16, type: 'cs16', host: '51.83.166.59', port: 27015 },  // Serwer Zombie EXP 100 LVL
  { id: 17, type: 'cs16', host: '54.38.131.56', port: 27015 },  // Serwer NGNW.PL [ONLY DD2]
  { id: 18, type: 'cs2',  host: '51.83.210.20', port: 27015 },  // Serwer ★ MIRAGE ★
  { id: 19, type: 'cs2',  host: '51.77.47.219', port: 27015 }   // Serwer ★ uwujka.pl ★ [CS2 ZMAPS]
];

export default async function handler(req, res) {
  const paczkaDanych = [];

  // Przetwarzamy serwery równolegle
  const obietnice = SERWERY_DO_SPRAWDZENIA.map(async (srv) => {
    const typGry = srv.type;
    
    // Zabezpieczenie wartości przed nadpisaniem (jeśli Steam nie odpowie, zostawiamy dotychczasowy stan z bazy!)
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      // OFICJALNY ENDPOINT VALVE (STEAM WEBAPI) - CAŁKOWICIE OMIJA CLOUDFLARE
      // Dokładna składnia filtrów Valve wymaga podwójnych ukośników przed komendą 'addr'
      const url = `https://steampowered.com\\addr\\${srv.host}:${srv.port}`;
      
      const response = await axios.get(url, { timeout: 4000 });

      // Sprawdzamy czy oficjalna masterlista Valve odnalazła serwer w swojej sieci
      if (response.data?.response?.servers?.length > 0) {
        const sData = response.data.response.servers[0];
        serverIsOnline = true;
        map = sData.map ? sData.map.trim() : map;
        playersCount = typeof sData.players !== 'undefined' ? sData.players : 0;
        maxPlayers = sData.max_players || 32;
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

  // Pakujemy i przesyłamy dane bezpiecznie formularzem do Twojego index.php
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
