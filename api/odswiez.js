import axios from 'axios';
import dns from 'dns';
import { GameDig } from 'gamedig';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

const resolveIp = (host) => {
  return new Promise((resolve) => {
    dns.lookup(host, (err, address) => {
      if (err) resolve(host);
      else resolve(address);
    });
  });
};

export default async function handler(req, res) {
  let serwery = [];
  try {
    const getList = await axios.post(bramkaUrl, 'action=get_servers_list', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });
    if (Array.isArray(getList.data)) {
      serwery = getList.data;
    }
  } catch (e) {
    return res.status(500).json({ error: 'Brak dostepu do bazy: ' + e.message });
  }

  const paczkaDanych = [];

  for (const srv of serwery) {
    const typGry = srv.typ_gry || srv.type || 'cs16';
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let playersList = [];
    let serverIsOnline = false;

    try {
      const realIp = await resolveIp(srv.host);
      
      // Mapowanie typów gier dla biblioteki gamedig
      // CS 1.6 = goldsrc, CS2 = cs2
      const gamedigType = (typGry === 'cs16') ? 'goldsrc' : 'cs2';

      // BEZPOŚREDNIE ZAPYTANIE UDP DO SERWERA GRY
      const state = await GameDig.query({
        type: gamedigType,
        host: realIp,
        port: parseInt(srv.port),
        givenPortOnly: true,
        attemptTimeout: 3000
      });

      if (state) {
        serverIsOnline = true;
        map = state.map || map;
        playersCount = state.players ? state.players.length : 0;
        maxPlayers = state.maxplayers || 32;

        if (state.players && Array.isArray(state.players)) {
          playersList = state.players.map((p, index) => ({
            nick: p.name || `Gracz_#${index + 1}`,
            score: typeof p.raw?.score !== 'undefined' ? parseInt(p.raw.score) : (p.score || 0),
            time: '00:20:00'
          }));
        }
      }
    } catch (e) {
      serverIsOnline = false;
    }

    const finalStatus = serverIsOnline ? 'ONLINE' : 'OFFLINE';
    if (!serverIsOnline) {
      map = (typGry === 'cs2') ? 'de_mirage' : 'brak danych';
      playersCount = 0;
      maxPlayers = 32;
      playersList = [];
    }

    paczkaDanych.push({
      id: srv.id,
      status: finalStatus,
      name: srv.name || '', 
      map: map,
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers), 
      gracze_lista: playersList
    });
  }

  try {
    const response = await axios.post(bramkaUrl, 
      'data_packet=' + encodeURIComponent(JSON.stringify(paczkaDanych)),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000
      }
    );
    return res.status(200).json({ status: 'Sukces', response: response.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad bramki SeoHost: ' + e.message });
  }
}
