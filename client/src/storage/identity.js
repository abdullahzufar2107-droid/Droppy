// Identitas peer: Peer ID 6 karakter + nama, disimpan di browser.
//
// Satu browser bisa membuka beberapa tab untuk uji coba. Tiap tab punya `token` (sessionStorage)
// supaya server bisa membedakan "reload tab yang sama" (boleh ambil alih ID)
// dari "tab lain dengan ID yang sama" (ditolak -> tab itu otomatis dapat identitas baru).
import { newPeerId, randomString } from '../utils.js';

const safe = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

const slot = () => safe(() => sessionStorage.getItem('droppy:slot')) || 'main';
const keyOf = () => `droppy:identity:${slot()}`;

export function getToken() {
  let t = safe(() => sessionStorage.getItem('droppy:token'));
  if (!t) {
    t = randomString(16);
    safe(() => sessionStorage.setItem('droppy:token', t));
  }
  return t;
}

export function loadIdentity() {
  let id = safe(() => JSON.parse(localStorage.getItem(keyOf())));
  if (!id || !id.peerId) {
    id = { peerId: newPeerId(), name: `Guest ${randomString(3)}` };
    saveIdentity(id);
  }
  return id;
}

export function saveIdentity(id) {
  safe(() => localStorage.setItem(keyOf(), JSON.stringify({ peerId: id.peerId, name: id.name })));
}

/** Dipakai saat ID bentrok dengan tab lain: pindah ke slot baru lalu reload halaman. */
export function switchToFreshIdentity() {
  const s = randomString(8, 'abcdefghijklmnopqrstuvwxyz0123456789');
  safe(() => sessionStorage.setItem('droppy:slot', s));
}
