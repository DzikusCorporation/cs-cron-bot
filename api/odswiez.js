import dgram from 'dgram';
import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

const SERWERY_DO_SPRAWDZENIA = [
  { id: 16, type: 'cs16', host: '51.83.166.59', port: 27015 },  // Serwer Zombie EXP 100 LVL
  { id: 17, type: 'cs16', host: '54.38.131.56', port: 27015 },  // Serwer NGNW.PL [ONLY DD2]
  { id: 18, type: 'cs2',  host: '51.83.210.20', port: 27015 },  // Serwer ★ MIRAGE ★
  { id: 19, type: 'cs2',  host: '51.77.47.219', port: 27015 }   // Serwer ★ uwujka.pl ★ [CS2 ZMAPS]
];

// Funkcja wysyłająca i odbierająca surowe pakiety UDP A2S prosto do serwera gry
function queryUdp(host, port, requestPacket) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.close();
        resolve(null);
      }
    }, 1500); // 1.5 sekundy timeoutu na odpowiedź serwera

    client.on('message', (msg) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        client.close();
        resolve(msg);
      }
    });

    client.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        client.close();
        resolve(null);
      }
    });

    client.send(requestPacket, 0, requestPacket.length, port, host, (err) => {
      if (err && !resolved) {
        resolved = true;
        clearTimeout(timer);
        client.close();
        resolve(null);
      }
    });
  });
}

// Pomocnicza funkcja do wyciągania stringów zakończonych bajtem zerowym z bufora binarnego
function readString(buffer, offset) {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) {
    end++;
  }
  return {
    str: buffer.toString('utf8', offset, end),
    nextOffset: end + 1
  };
}

export default async function handler(req, res) {
  const paczkaDanych = [];

  for (const srv of SERWERY_DO_SPRAWDZENIA) {
    const typGry = srv.type;
    let map = (typGry === 'cs2') ? 'de_mirage' : 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let serverIsOnline = false;

    try {
      // Nagłówek binarnego zapytania Valve A2S_INFO
      let infoPacket = Buffer.from([
        0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 
        0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00
      ]);

      let response = await queryUdp(srv.host, srv.port, infoPacket);

      // Obsługa Challenge Handshake (Zabezpieczenie przed DDoS w CS 1.6 / CS2)
      if (response && response.length >= 9 && response[4] === 0x41) {
        const challengeToken = response.subarray(5, 9);
        infoPacket = Buffer.concat([infoPacket, challengeToken]);
        response = await queryUdp(srv.host, srv.port, infoPacket);
      }

      // Parsowanie właściwego pakietu binarnego Valve (Nagłówek 0x49 / 'I')
      if (response && response.length > 10 && response[4] === 0x49) {
        serverIsOnline = true;
        let offset = 5;

        // Pomijamy Protokół (1 bajt)
        offset += 1;

        // Pomijamy Nazwę Serwera
        let readData = readString(response, offset);
        offset = readData.nextOffset;

        // POBIERAMY AKTUALNĄ MAPĘ Z POZYCJI BINARNEJ
        readData = readString(response, offset);
        if (readData.str && readData.str.trim().length > 0) {
          map = readData.str.trim();
        }
        offset = readData.nextOffset;

        // Pomijamy Folder gry i Nazwę gry
        readData = readString(response, offset); offset = readData.nextOffset;
        readData = readString(response, offset); offset = readData.nextOffset;

        // Pomijamy AppID (2 bajty)
        offset += 2;

        // Odczytujemy liczbę graczy oraz sloty (Bity 1-bajtowe)
        if (offset < response.length) {
          playersCount = response[offset];
          maxPlayers = response[offset + 1] || 32;
        }
      }
    } catch (e) {
      serverIsOnline = false;
    }

    // Korekta wartości offline - zerujemy graczy, ale zachowujemy mapę, by nie psuć widoku
    if (!serverIsOnline) {
      playersCount = 0;
    }

    paczkaDanych.push({
      id: parseInt(srv.id),
      status: serverIsOnline ? 'ONLINE' : 'OFFLINE',
      map: map.replace(/[\x00-\x1F\x7F]/g, ""), // Czyszczenie ukrytych znaków binarnych
      players: parseInt(playersCount) > 128 ? 0 : parseInt(playersCount),
      max_players: parseInt(maxPlayers) > 128 ? 32 : parseInt(maxPlayers)
    });
  }

  // Przesyłamy bezpieczny pakiet bezpośrednio do index.php na SeoHost
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
