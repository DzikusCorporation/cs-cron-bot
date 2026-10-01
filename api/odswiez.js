import query from 'source-server-query';
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

  for (const srv of SERWERY_DO_SPRAWDZENIA) {
    let map = (srv.type === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      // Wywołanie oficjalnego zapytania A2S_INFO z automatyczną obsługą Challenge Tokenów
      const info = await query.info(srv.host, srv.port, 2000);

      if (info && info.map) {
        serverIsOnline = true;
        map = info.map.trim();
        playersCount = typeof info.players !== 'undefined' ? info.players : 0;
        maxPlayers = info.maxPlayers || 32;
      }
    } catch (e) {
      serverIsOnline = false;
    }

    paczkaDanych.push({
      id: parseInt(srv.id),
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      map: map.replace(/[\x00-\x1F\x7F]/g, ""), // Oczyszczanie ukrytych bajtów binarnych
      players: serverIsOnline ? parseInt(playersCount) : 0,
      max_players: parseInt(maxPlayers)
    });
  }

  // Przesyłamy bezpieczną, sparsowaną paczkę danych do index.php na SeoHost
  const params = new URLSearchParams();
  params.append('data_packet', JSON.stringify(paczkaDanych));

  try {
    const responseSave = await axios.post(bramkaUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });

    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: responseSave.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad komunikacji z index.php: ' + e.message });
  }
}
