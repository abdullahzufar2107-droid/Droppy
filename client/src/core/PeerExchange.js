// Peer exchange (No.2 Reliability): setelah terhubung, peer saling berbagi daftar kenalannya,
// sehingga jaringan tumbuh tanpa bantuan server. Contoh: A kenal B, B kenal C -> A otomatis kenal C.
import { isValidPeerId } from '../utils.js';

/** Daftar peer online yang boleh dibagikan ke `exceptId`. */
export function buildPeerList(peers, exceptId, selfId) {
  return [...peers.values()]
    .filter((p) => p.status === 'online' && p.id !== exceptId && p.id !== selfId && !p.blocked)
    .map((p) => ({ id: p.id, name: p.name }))
    .slice(0, 20);
}

/** Hubungkan ke peer baru dari daftar yang diterima. */
export function handlePeerList(list, { selfId, isKnown, connect }) {
  if (!Array.isArray(list)) return;
  for (const p of list.slice(0, 20)) {
    if (!p || !isValidPeerId(p.id) || p.id === selfId || isKnown(p.id)) continue;
    connect(p.id, { name: String(p.name || '').slice(0, 32), silent: true, via: 'exchange' });
  }
}
