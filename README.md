# Droppy

Aplikasi chat peer-to-peer berbasis **WebRTC** (Tugas Besar KDJK). Pesan dikirim langsung antar browser lewat
DataChannel. Server hanya dipakai sebagai "calo perkenalan" (signaling) di awal koneksi.

## Menjalankan

Syarat: **Node.js 18 atau lebih baru**. Tidak perlu `npm install` (server tanpa dependensi).

```bash
cd droppy
node server/index.js
```

Buka `http://localhost:3000`. Terminal juga menampilkan alamat jaringan, mis. `http://192.168.1.10:3000`,
untuk dibuka dari HP atau laptop lain di WiFi yang sama.

### Uji coba

1. Buka dua tab (atau dua perangkat). Setiap tab otomatis mendapat Peer ID 6 karakter.
2. Di tab A klik tombol **+** di samping "Recent", salin **Your code** (atau **Copy link**).
3. Di tab B klik **+**, tempel kode A, lalu **Connect**.
4. Kirim pesan. Matikan server: chat yang sudah tersambung tetap berjalan (bukti P2P).

### Beda jaringan (IP berbeda)

Server signaling harus bisa diakses dari kedua jaringan. Cara tercepat untuk demo:

```bash
# jalankan salah satu, di terminal kedua
cloudflared tunnel --url http://localhost:3000
ngrok http 3000
```

Bagikan alamat `https://...` yang muncul. Bila jaringan memakai NAT ketat (WiFi kampus, sebagian
kuota seluler), koneksi langsung bisa gagal. Pasang server TURN lalu isi `.env`
(salin dari `.env.example`):

```
TURN_URL=turn:alamat-turn:3478
TURN_USER=user
TURN_PASS=password
```

## Struktur

```
server/              signaling + file statis (WebSocket ditulis sendiri di ws.js)
client/
  index.html
  styles/main.css    tampilan (mengikuti gambar referensi)
  src/
    main.js          controller: menyambungkan core dan UI
    config.js        alamat signaling, STUN/TURN, parameter heartbeat
    core/            logika P2P (tidak boleh import dari ui/)
    media/           voice note (stub)
    storage/         IndexedDB + identitas
    ui/              store, ikon, avatar, komponen
docs/                blueprint
```

## Status per tugas

| No | Bagian | Status |
| --- | --- | --- |
| 1 | Network lead: signaling, WebRTC, DataChannel, STUN/TURN, daftar peer | Selesai |
| 2 | Reliability: heartbeat, reconnect, peer exchange, ack + retry, antrean offline | Versi dasar sudah jalan, perlu diuji dan disempurnakan |
| 3 | File dan voice note | Kerangka saja (`FileTransfer.js`, `VoiceRecorder.js`, berisi rencana) |
| 4 | UI/UX | Tampilan utama selesai; Network Inspector belum |
| 5 | Data, QA, dokumentasi | IndexedDB dasar sudah ada; ekspor/impor, pengujian, deploy belum |

Ditunda: panggilan suara/video dan grup chat.

## Catatan

- Mikrofon dan kamera (untuk voice note nanti) hanya jalan di HTTPS atau `localhost`.
- Teks antarmuka memakai bahasa Inggris mengikuti gambar referensi.
- Console browser: `window.droppy.manager.list()` menampilkan peer dan status koneksinya.
