// Konfigurasi client. Alamat signaling mengikuti host tempat halaman dibuka,
// jadi tidak perlu diubah saat dipakai lewat IP LAN, tunnel, atau hosting.

export const SIGNALING_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/signal`;

const FALLBACK_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

/** Ambil daftar STUN/TURN dari server (diatur lewat .env di sisi server). */
export async function loadIceServers() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    const data = await res.json();
    if (Array.isArray(data.iceServers) && data.iceServers.length) return data.iceServers;
  } catch {}
  return FALLBACK_ICE;
}

// Heartbeat (No.2): ping tiap 5 detik, dianggap putus bila 15 detik tanpa pong
export const HEARTBEAT = { interval: 5000, timeout: 15000 };

// Auto-reconnect (No.2): jeda antar percobaan, maksimal 5 kali
export const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

// Ack & retry pesan (No.2)
export const ACK = { timeout: 3000, maxTries: 3 };
