import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

export default async function handler(req, res) {
  let serwery = [];

  // 1. Pobieramy dynamiczną listę serwerów z Twojego index.php na SeoHost
  try {
    const getList = await axios.post(bramkaUrl, 'action=get_servers_list', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });

    if (getList.data && Array.isArray(getList.data)) {
      serwery = getList.data;
    } else {
      return res.status(200).json({ status: 'Brak serwerów do przetworzenia w bazie' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Brak komunikacji z index.php: ' + e.message });
  }

  const paczkaDanych = [];

  // 2. Odpytywanie wszystkich serwerów za pomocą stabilnych mostków HTTP API
  for (const srv of serwery) {
    const host = srv.host || srv.ip || '';
    const port = parseInt(srv.port) || 27015;
    const typGry = srv.typ_gry || srv.type || 'cs16';
    const srv_id = parseInt(srv.id);

    if (!host || srv_id <= 0) continue;

    // Pobieramy dotychczasowy stan z bazy, aby w razie awarii API nie resetować map zombie do de_dust2
    let map = srv.mapa_live || (typGry === 'cs2' ? 'de_mirage' : 'de_dust2');
    let playersCount = typeof srv.gracze_live !== 'undefined' ? parseInt(srv.gracze_live) : 0;
    let maxPlayers = parseInt(srv.max_gracze_live) || 32;
    let serverIsOnline = false;

    // Przypisanie AppID według standardu Valve Steam (CS 1.6 = 10, CS2 = 730)
    const appId = (typGry === 'cs16') ? 10 : 730;

    try {
      // PRÓBA 1: Oficjalna publiczna masterlista Valve (nie wymaga klucza, działa na Vercelu)
      const response = await axios.get(`https://steampowered.com\\appid\\${appId}\\addr\\${host}:${port}`, {
        timeout: 3500
      });

      if (response.data?.response?.servers?.length > 0) {
        const sData = response.data.response.servers[0];
        serverIsOnline = true;
        map = sData.map ? sData.map.trim() : map;
        playersCount = typeof sData.players !== 'undefined' ? sData.players : playersCount;
        maxPlayers = sData.max_players || maxPlayers;
      }
    } catch (e) {
      serverIsOnline = false;
    }

    // PRÓBA 2 (FALLBACK): Jeśli pierwsze API milczało, uderzamy do darmowego mcsrvstat dla gier Steam
    if (!serverIsOnline) {
      try {
        const responseFb = await axios.get(`https://mcsrvstat.us{host}:${port}`, {
          timeout: 3500
        });

        if (responseFb.data && responseFb.data.online === true) {
          serverIsOnline = true;
          map = responseFb.data.map ? responseFb.data.map.trim() : map;
          playersCount = responseFb.data.players?.online ?? playersCount;
          maxPlayers = responseFb.data.players?.max ?? maxPlayers;
        }
      } catch (fbError) {
        serverIsOnline = false;
      }
    }

    const finalStatus = serverIsOnline ? 'ONLINE' : 'OFFLINE';
    if (!serverIsOnline) {
      playersCount = 0; // Jeśli serwer zgaśnie, zerujemy graczy, ale zachowujemy ostatnią mapę zombie!
    }

    paczkaDanych.push({
      id: srv_id,
      status: finalStatus,
      map: map,
      players: parseInt(playersCount),
      max_players: parseInt(maxPlayers),
      gracze_lista: []
    });
  }

  // 3. Przesyłamy gotowy pakiet danych z powrotem na Twój hosting SeoHost w formularzu POST
  try {
    const params = new URLSearchParams();
    params.append('data_packet', JSON.stringify(paczkaDanych));

    const responseSave = await axios.post(bramkaUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000
    });

    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: responseSave.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad podczas zapisu danych na SeoHost: ' + e.message });
  }
}
