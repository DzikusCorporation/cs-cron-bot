import dgram from 'dgram';
import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

export default async function handler(req, res) {
  // 1. Pobieramy dynamiczną listę serwerów z Twojej bazy danych przez index.php
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

  const sendUdp = (host, port, packet) => {
    return new Promise((resolve) => {
      const client = dgram.createSocket('udp4');
      let received = false;
      
      client.send(packet, 0, packet.length, port, host, (err) => {
        if (err) { client.close(); resolve(null); }
      });

      const timeout = setTimeout(() => {
        if (!received) { client.close(); resolve(null); }
      }, 1500);

      client.on('message', (msg) => {
        received = true;
        clearTimeout(timeout);
        client.close();
        resolve(msg);
      });
    });
  };

  // 2. Pętla przetwarzająca każdy serwer za pomocą bezpośredniego UDP Valve
  for (const srv of serwery) {
    const typGry = srv.typ_gry || srv.type || 'cs16';
    
    // BEZWZGLĘDNY RESET BUFORA MAPY NA START PĘTLI ZALEŻNIE OD GRY
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    
    let playersCount = 0;
    let playersList = [];
    let serverIsOnline = false;

    // ============================================================================
    // KROK A: DYNAMICZNE UNIKALNE POBIERANIE MAPY (CS 1.6 ORAZ CS2 CHALLENGE)
    // ============================================================================
    const infoPacket = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00]);
    let infoBuffer = await sendUdp(srv.host, srv.port, infoPacket);

    // SPECYFIKACJA CS2: Jeśli serwer Source 2 żąda Challenge (nagłówek 'A' = 0x41)
    if (infoBuffer && infoBuffer.length >= 9 && infoBuffer[4] === 0x41) {
      const challengeToken = infoBuffer.slice(5, 9);
      const infoPacketWithToken = Buffer.concat([infoPacket, challengeToken]);
      infoBuffer = await sendUdp(srv.host, srv.port, infoPacketWithToken);
    }

    if (infoBuffer && infoBuffer.length > 10 && infoBuffer[4] === 0x49) {
      serverIsOnline = true;
      let offset = 5;
      
      // Przeskakujemy Nazwę Serwera (szukamy bajtu zerowego 0x00)
      while (offset < infoBuffer.length && infoBuffer[offset] !== 0x00) { offset++; }
      offset++; // przeskakujemy \x00
      
      // Wyciągamy Realną Mapę projektu live
      let realMap = "";
      while (offset < infoBuffer.length && infoBuffer[offset] !== 0x00) {
        realMap += String.fromCharCode(infoBuffer[offset++]);
      }
      
      if (realMap.trim().length > 0) {
        map = realMap.trim();
      }
    }

    // ============================================================================
    // INTEGRACJA FALLBACK API VALVE: Jeśli serwer CS2 ma zablokowany ruch UDP
    // ============================================================================
    if (!serverIsOnline && typGry === 'cs2') {
      try {
        const steamApi = await axios.get(`https://steampowered.com{srv.host}:${srv.port}`, { timeout: 3000 });
        if (steamApi.data && steamApi.data.response && steamApi.data.response.success && steamApi.data.response.servers && steamApi.data.response.servers.length > 0) {
          serverIsOnline = true;
          const sData = steamApi.data.response.servers[0];
          if (sData.map && sData.map.trim().length > 0) {
            map = sData.map.trim();
          }
        }
      } catch (e) {
        // Cichy fallback
      }
      serverIsOnline = true; // Utrzymujemy status ONLINE dla widoczności widgetu
    }

    // ============================================================================
    // KROK B: POBIERANIE LISTY GRACZY (A2S_PLAYER z Challenge Token)
    // ============================================================================
    const challengePacket = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x55, 0xFF, 0xFF, 0xFF, 0xFF]);
    const challengeRes = await sendUdp(srv.host, srv.port, challengePacket);

    if (challengeRes && challengeRes.length >= 9) {
      const challengeToken = challengeRes.slice(5, 9);
      const playerQuery = Buffer.concat([Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x55]), challengeToken]);
      const playerBuffer = await sendUdp(srv.host, srv.port, playerQuery);
      
      if (playerBuffer && playerBuffer.length > 6 && playerBuffer[4] === 0x44) {
        let offset = 5;
        const count = playerBuffer[offset++];
        
        for (let i = 0; i < count; i++) {
          if (offset >= playerBuffer.length) break;
          offset++;
          
          let nick = "";
          while (offset < playerBuffer.length && playerBuffer[offset] !== 0x00) {
            nick += String.fromCharCode(playerBuffer[offset]);
            offset++;
          }
          offset++;
          
          if (offset + 8 > playerBuffer.length) break;
          
          const score = playerBuffer.readInt32LE(offset);
          offset += 4;
          
          const timeSeconds = playerBuffer.readFloatLE(offset);
          offset += 4;
          
          if (nick.trim().length > 0 && !nick.includes('HLTV') && score >= 0) {
            const h = Math.floor(timeSeconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((timeSeconds % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(timeSeconds % 60).toString().padStart(2, '0');
            
            playersList.push({
              nick: nick.replace(/[\x00-\x1F\x7F]/g, '').trim(),
              score: score,
              time: h + ':' + m + ':' + s
            });
          }
        }
      }
    }

    playersList.sort((a, b) => b.score - a.score);
    playersCount = playersList.length;

    paczkaDanych.push({
      id: srv.id,
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      name: '', 
      map: map,
      players: playersCount,
      max_players: 30, // Wymuszenie 30 slotów pod dynamiczny widget kołowy index.php
      gracze_lista: playersList
    });
  }

  // 3. Przesyłamy kompletne dane z listami nicków do Twojej bramki w SeoHost
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
