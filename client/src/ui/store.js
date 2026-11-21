// State UI + helper turunan. commit() menjadwalkan render ulang (digabung per tick).
export const state = {
  me: { peerId: '', name: '' },
  signal: 'connecting', // connecting | online | offline (status koneksi ke server signaling)
  visible: true, // "Active Status": bisa ditemukan peer lain
  peers: [],
  activeId: null,
  search: '',
  messages: {}, // peerId -> [record]
  typing: {}, // peerId -> waktu kedaluwarsa indikator mengetik
  collapsed: { files: false, privacy: false },
};

const subscribers = new Set();
let queued = false;

export function subscribe(fn) {
  subscribers.add(fn);
}

export function commit() {
  if (queued) return;
  queued = true;
  Promise.resolve().then(() => {
    queued = false;
    subscribers.forEach((fn) => fn(state));
  });
}

// ---------- helper turunan ----------
export const displayName = (p) => (p && (p.alias || p.name)) || 'Unknown';
export const getPeer = (id) => state.peers.find((p) => p.id === id);
export const chatOf = (id) => state.messages[id] || (state.messages[id] = []);
export const lastMessage = (id) => {
  const list = state.messages[id];
  return list && list.length ? list[list.length - 1] : null;
};
export const unreadCount = (p) => chatOf(p.id).filter((m) => m.dir === 'in' && m.ts > (p.lastRead || 0)).length;

export function addMessage(msg) {
  const list = chatOf(msg.chatId);
  if (list.some((m) => m.id === msg.id)) return;
  list.push(msg);
  list.sort((a, b) => a.ts - b.ts);
}

export function setMessageStatus(peerId, id, status) {
  const m = chatOf(peerId).find((x) => x.id === id);
  if (!m || m.dir !== 'out') return null;
  // 'delivered' adalah status akhir, tidak boleh turun lagi oleh retry yang terlambat
  if (m.status === 'delivered') return null;
  m.status = status;
  return m;
}
