import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

const SERWERY_DO_SPRAWDZENIA = [
  { id: 16, type: 'cs16', host: '51.83.166.59', port: 27015 },
  { id: 17, type: 'cs16', host: '54.38.131.56', port: 27015 },
  { id: 18, type: 'cs2',  host: '51.83.210.20', port: 27015 },
  { id: 19, type: 'cs2',  host: '51.77.47.219', port: 27015 }
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
      const response = await axios.get(`https://game-state.com{srv.host}:${srv.port}`, { 
        timeout: 4500 
      });

      const d = response.data;
      const root = d.data || d;

      if (root && root.status !== 'offline') {
        serverIsOnline = true;
        map = root.map || root.mapname || map;
        playersCount = root.players ?? root.players_online ?? 0;
        maxPlayers = root.max_players ?? root.players_max ?? 32;

        const rawPlayers = root.players_list || root.playersList || [];
        if (Array.isArray(rawPlayers) && rawPlayers.length > 0) {
          playersList = rawPlayers.map((p, index) => {
            const nickStr = typeof p === 'string' ? p : (p.name || p.nick || `Gracz_#${index + 1}`);
            const scoreInt = typeof p.score !== 'undefined' ? parseInt(p.score) : Math.floor(Math.random() * 15) + 3;
            let timeStr = p.time || p.duration || '00:25:00';
            
            if (typeof timeStr === 'number') {
              const mins = Math.floor(timeStr / 60);
              const secs = timeStr % 60;
              timeStr = `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }

            return {
              nick: nickStr.toString().trim(),
              score: parseInt(scoreInt),
              time: timeStr.toString()
            };
          });
        } else {
          // Placeholder na wypadek gdyby tracker nie przekazał imion live
          for (let i = 0; i < playersCount; i++) {
            playersList.push({
              nick: `Gracz_${typGry.toUpperCase()}_#${i + 1}`,
              score: Math.floor(Math.random() * 20) + 5,
              time: `00:${(Math.floor(Math.random() * 35) + 5).toString().padStart(2, '0')}:15`
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

  const params = new URLSearchParams();
  params.append('data_packet', JSON.stringify(wyniki));

  try {
    const responseSave = await axios.post(bramkaUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });
    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: responseSave.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad komunikacji: ' + e.message });
  }
}
