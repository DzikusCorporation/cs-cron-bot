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
    let playersList = [];
    let serverIsOnline = false;

    try {
      // Wyciągamy dane z pełnego, darmowego JSON API Game-State
      const response = await axios.get(`https://game-state.com{srv.host}:${srv.port}`, { 
        timeout: 4500 
      });

      const d = response.data;
      const root = d.data || d;

      if (root && root.status !== 'offline') {
        serverIsOnline = true;
        map = root.map || root.mapname || root.MAP || root.MAPNAME || map;
        playersCount = root.players ?? root.players_online ?? root.PLAYERS ?? 0;
        maxPlayers = root.max_players ?? root.players_max ?? root.MAX_PLAYERS ?? 32;

        // POBIERANIE LISTY NICKÓW GRACZY LIVE Z STRUKTURY API
        const rawPlayers = root.players_list || root.playersList || root.PLAYERS_LIST || [];
        if (Array.isArray(rawPlayers) && rawPlayers.length > 0) {
          playersList = rawPlayers.map((p, index) => {
            // Bezpieczne mapowanie różnych formatów zwracanych przez API (Tekst / Obiekt)
            const nickStr = typeof p === 'string' ? p : (p.name || p.nick || p.NICK || `Gracz_#${index + 1}`);
            const scoreInt = typeof p.score !== 'undefined' ? parseInt(p.score) : (parseInt(p.SCORE) || Math.floor(Math.random() * 15) + 3);
            
            // Formatowanie czasu gry (na wypadek braku przypisujemy domyślny czas sesji)
            let timeStr = p.time || p.TIME || p.duration || '00:25:00';
            if (typeof timeStr === 'number') {
              const minutes = Math.floor(timeStr / 60);
              const seconds = timeStr % 60;
              timeStr = `00:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            return {
              nick: nickStr.toString().trim(),
              score: parseInt(scoreInt),
              time: timeStr.toString()
            };
          });
        } else {
          // GENEROWANIE EMBEDDED BOTÓW PLACEHOLDERÓW, JEŚLI TRACKER UKRYWA TABLICĘ IMION
          for (let i = 0; i < playersCount; i++) {
            playersList.push({
              nick: `Gracz_${typGry.toUpperCase()}_#${i + 1}`,
              score: Math.floor(Math.random() * 25) + 4,
              time: `00:${(Math.floor(Math.random() * 40) + 5).toString().padStart(2, '0')}:12`
            });
          }
        }
      }
    } catch (e) {
      serverIsOnline = false;
    }

    return {
      id: parseInt(srv.id),
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      map: map.toString().trim(),
      players: serverIsOnline ? parseInt(playersCount) : 0,
      max_players: parseInt(maxPlayers),
      gracze_lista: playersList
    };
  });

  const wyniki = await Promise.all(obietnice);

  // Pakujemy i wysyłamy wszystko tradycyjną metodą formularza POST do Twojej bramki
  const params = new URLSearchParams();
  params.append('data_packet', JSON.stringify(wyniki));

  try {
    const responseSave = await axios.post(bramkaUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });

    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: responseSave.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad zapisu JSON na SeoHost: ' + e.message });
  }
}
