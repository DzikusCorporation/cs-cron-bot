const { GameDig } = require('gamedig');

const serwery = [
    { id: 5, type: 'cs16', host: '54.38.58.82', port: 27015 },
    { id: 6, type: 'cs16', host: '193.33.177.21', port: 27015 },
    { id: 8, type: 'cs16', host: '193.33.177.144', port: 27015 },
    { id: 9, type: 'cs16', host: '51.83.166.59', port: 27015 },
    { id: 10, type: 'cs2', host: '51.38.60.53', port: 27015 },
    { id: 11, type: 'cs16', host: '193.33.177.175', port: 27015 }
];

const bramkaUrl = 'http://seohost.com.pl';

async function run() {
    const paczkaDanych = [];

    for (const srv of serwery) {
        try {
            const state = await GameDig.query({
                type: srv.type,
                host: srv.host,
                port: srv.port,
                maxAttempts: 2,
                socketTimeout: 2000
            });

            paczkaDanych.push({
                id: srv.id,
                status: 'ONLINE',
                name: state.name || 'Serwer Counter-Strike',
                map: state.map || 'brak',
                players: state.players ? state.players.length : 0,
                max_players: state.maxplayers || 32
            });
        } catch (err) {
            paczkaDanych.push({
                id: srv.id,
                status: 'OFFLINE',
                name: 'Serwer jest wylaczony lub niedostepny',
                map: 'brak',
                players: 0,
                max_players: 32
            });
        }
    }

    // Wysyłanie danych do bramki SeoHost metodą POST
    try {
        const response = await fetch(bramkaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ data_packet: JSON.stringify(paczkaDanych) })
        });
        const text = await response.text();
        console.log('Odpowiedz bramki SeoHost:', text);
    } catch (e) {
        console.error('Blad wysylania do bramki:', e.message);
    }
}

run();
