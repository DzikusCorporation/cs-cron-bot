import axios from 'axios';

const bramkaUrl = 'https://srv125426.seohost.com.pl/index.php';

export default async function handler(req, res) {
  // Zestawy autentycznych map zombie i klasycznych dla urozmaicenia strony
  const mapy_cs16_zombie = ['zm_4_green_box_v1', 'zm_re_green_box_v1', 'zm_dust2_2013', 'zm_infantry', 'zm_cross'];
  const mapy_cs2 = ['de_mirage', 'de_inferno', 'de_ancient', 'de_anubis', 'de_dust2', 'cs_italy'];
  
  // Pula popularnych polskich nicków do tabeli podglądu gracze.php
  const losowe_nicki = ['Dziku', 'Niko', 'Player', 'Sniper', 'Kiler', 'ProGamer', 'Matrix', 'Zombiak', 'Kondzio', 'LuCky', 'Shadow', 'Vortex', 'Turbo', 'Biceps', 'Rambo', 'Asior', 'Krecik', 'Prezes', 'Wariat', 'Tito'];

  // NAPRAWIONE: Prawidłowo zdefiniowana tablica z numerami ID Twoich 4 serwerów z bazy
  const serwery_ids =;
  const paczkaDanych = [];

  serwery_ids.forEach((srv_id) => {
    let map = 'de_dust2';
    let playersCount = 0;
    let maxPlayers = 32;
    let playersList = [];

    // Inteligentna generacja dynamicznego ruchu dla każdego ID serwera z bazy
    if (srv_id === 16) {
      playersCount = Math.floor(Math.random() * (18 - 4 + 1)) + 4; // od 4 do 18
      map = mapy_cs16_zombie[Math.floor(Math.random() * mapy_cs16_zombie.length)];
    } else if (srv_id === 17) {
      playersCount = Math.floor(Math.random() * (26 - 8 + 1)) + 8; // od 8 do 26
      map = 'de_dust2';
    } else if (srv_id === 18) {
      playersCount = Math.floor(Math.random() * (22 - 6 + 1)) + 6; // od 6 do 22
      maxPlayers = 18;
      map = 'de_mirage';
    } else if (srv_id === 19) {
      playersCount = Math.floor(Math.random() * (28 - 10 + 1)) + 10; // od 10 do 28
      map = mapy_cs2[Math.floor(Math.random() * mapy_cs2.length)];
    }

    // Losowanie unikalnych nicków dla podglądu gracze.php
    let dostepne_nicki = [...losowe_nicki];
    for (let i = 0; i < playersCount; i++) {
      if (dostepne_nicki.length === 0) break;
      const randIndex = Math.floor(Math.random() * dostepne_nicki.length);
      const nick = dostepne_nicki.splice(randIndex, 1)[0]; // Pobieramy czysty string z tablicy
      
      const score = Math.floor(Math.random() * (42 - 2 + 1)) + 2;
      const mins = Math.floor(Math.random() * (55 - 5 + 1)) + 5;
      const secs = Math.floor(Math.random() * 50) + 10;
      const timeStr = `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      playersList.push({ nick: nick, score: score, time: timeStr });
    }

    paczkaDanych.push({
      id: srv_id,
      status: 'ONLINE',
      map: map,
      players: playersCount,
      max_players: maxPlayers,
      gracze_lista: playersList
    });
  });

  // Przesyłamy wygenerowaną bezpieczną paczkę url-encoded do Twojego index.php na SeoHost
  const params = new URLSearchParams();
  params.append('data_packet', JSON.stringify(paczkaDanych));

  try {
    const responseSave = await axios.post(bramkaUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 6000
    });
    return res.status(200).json({ status: 'Sukces', odpowiedz_bramki: responseSave.data });
  } catch (e) {
    return res.status(500).json({ error: 'Blad zapisu JSON na SeoHost: ' + e.message });
  }
}
