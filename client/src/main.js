// Controller: menyambungkan core (P2P) dengan UI. core/ tidak tahu apa-apa soal UI;
// semua komunikasi lewat event PeerManager / Signaling.
import { SIGNALING_URL, loadIceServers } from './config.js';
import { Signaling } from './core/Signaling.js';
import { PeerManager } from './core/PeerManager.js';
import { createDB } from './storage/db.js';
import { getToken, loadIdentity, saveIdentity, switchToFreshIdentity } from './storage/identity.js';
import { copyText, isValidPeerId, normalizeCode } from './utils.js';
import { icons } from './ui/icons.js';
import { addMessage, chatOf, commit, displayName, getPeer, setMessageStatus, state, subscribe, unreadCount } from './ui/store.js';
import { renderProfile } from './ui/components/Profile.js';
import { renderPeerList } from './ui/components/PeerList.js';
import { renderChatHeader, renderMessages } from './ui/components/ChatPanel.js';
import { renderInfo } from './ui/components/InfoPanel.js';
import { addPeerModal, confirmModal, promptModal, toast } from './ui/components/Modal.js';

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ ikon statis
$('railLogo').innerHTML = icons.logo;
$('navGrid').innerHTML = icons.grid;
$('navCompass').innerHTML = icons.compass;
$('navPeers').innerHTML = icons.people;
$('navChart').innerHTML = icons.chart;
$('navPhone').innerHTML = icons.phoneFilled;
$('listBack').innerHTML = icons.chevronLeft;
$('searchIcon').innerHTML = icons.search;
$('addPeerBtn').innerHTML = icons.plus;
$('recentMore').innerHTML = icons.kebab;
$('composerMic').innerHTML = icons.mic;
$('composerFile').innerHTML = icons.cloudUp;
$('composerSend').innerHTML = icons.send;

// ------------------------------------------------------------------ boot core
const identity = loadIdentity();
state.me = identity;

const db = createDB(`droppy-${identity.peerId}`);
const signalIdentity = { peerId: identity.peerId, name: identity.name, token: getToken() };
const signaling = new Signaling(SIGNALING_URL);
const iceServers = await loadIceServers();
const manager = new PeerManager({ me: identity, signaling, iceServers });

const announce = new Set(); // peer yang baru ditambahkan: tampilkan toast saat tersambung

const plainPeer = (p) => ({
  id: p.id,
  name: p.name,
  alias: p.alias,
  lastSeen: p.lastSeen,
  lastRead: p.lastRead,
  muted: p.muted,
  blocked: p.blocked,
});

// ------------------------------------------------------------------ event core -> state/UI
manager.on('peers', () => {
  state.peers = manager.list();
  commit();
});
manager.on('peer-save', (p) => db.putPeer(plainPeer(p)));
manager.on('peer-removed', (id) => db.deletePeer(id));

manager.on('peer-connected', (id) => {
  if (announce.delete(id)) toast(`Connected to ${displayName(manager.getPeer(id))}`, 'success');
});

manager.on('peer-error', ({ peerId, code }) => {
  announce.delete(peerId);
  if (code === 'not-found') toast('Peer not found or offline.', 'error');
  else if (code === 'connect-failed') toast("Couldn't connect. Check both networks (a TURN server may be needed).", 'error');
  else if (code === 'signaling-offline') toast('Not connected to the server yet.', 'error');
});

manager.on('message', ({ peerId, msg }) => {
  addMessage(msg);
  db.putMessage(msg);
  if (msg.dir === 'in') {
    const peer = manager.getPeer(peerId);
    if (state.activeId === peerId && document.visibilityState === 'visible') markRead(peerId);
    else if (!peer?.muted) toast(`${displayName(peer)}: ${msg.text.slice(0, 70)}`);
  }
  commit();
});

manager.on('message-status', ({ peerId, id, status }) => {
  const m = setMessageStatus(peerId, id, status);
  if (m) {
    db.putMessage(m);
    commit();
  }
});

manager.on('typing', ({ peerId }) => {
  state.typing[peerId] = Date.now() + 3000;
  commit();
  setTimeout(commit, 3100);
});

signaling.on('status', (s) => {
  state.signal = s;
  commit();
});
signaling.on('registered', () => {
  manager.reconnectAll();
  handleDeepLink();
});
signaling.on('id-conflict', () => {
  // ID ini sedang dipakai tab lain: pindah ke identitas baru untuk tab ini
  switchToFreshIdentity();
  location.reload();
});

// ------------------------------------------------------------------ pulihkan data lokal
manager.setPeers(await db.getPeers());
for (const m of await db.getAllMessages()) {
  if (!manager.getPeer(m.chatId)) continue;
  addMessage(m);
  if (m.dir === 'out' && m.status !== 'delivered') {
    m.status = 'pending';
    manager.requeue(m); // dikirim otomatis begitu peer tersambung
  }
}
state.peers = manager.list();

// ------------------------------------------------------------------ aksi
function markRead(peerId) {
  const p = manager.getPeer(peerId);
  if (p && unreadCount(p) > 0) manager.patchPeer(peerId, { lastRead: Date.now() });
}

function selectPeer(id, { connect = true } = {}) {
  state.activeId = id;
  markRead(id);
  commit();
  const p = manager.getPeer(id);
  if (connect && p && p.status === 'offline' && !p.blocked) manager.connect(id, { silent: true });
  setTimeout(() => $('messageInput').focus(), 0);
}

/** Tambah peer lewat kode. Mengembalikan pesan error, atau null bila berhasil. */
async function addPeer(raw) {
  const code = normalizeCode(raw);
  if (!isValidPeerId(code)) return 'Enter a valid 6-character code.';
  if (code === identity.peerId) return "That's your own code.";
  const known = manager.getPeer(code);
  if (known?.blocked) return 'This peer is blocked. Unblock them first.';
  if (!signaling.isOnline) return 'Not connected to the server yet. Make sure Active Status is on, then try again.';

  const found = await signaling.lookup(code);
  if (!found.online) {
    if (known) {
      selectPeer(code);
      return null;
    }
    return 'Peer not found or offline. Ask them to open Droppy, then try again.';
  }
  announce.add(code);
  manager.connect(code, { name: found.name });
  selectPeer(code, { connect: false });
  return null;
}

let deepLinkDone = false;
function handleDeepLink() {
  if (deepLinkDone) return;
  deepLinkDone = true;
  const code = new URL(location.href).searchParams.get('peer');
  if (!code) return;
  history.replaceState(null, '', location.pathname);
  addPeer(code).then((err) => err && toast(err, 'error'));
}

const activePeer = () => manager.getPeer(state.activeId);

const actions = {
  'select-peer': (el) => selectPeer(el.dataset.id),
  back: () => {
    state.activeId = null;
    commit();
  },
  'toggle-visible': () => {
    state.visible = !state.visible;
    if (state.visible) signaling.resume();
    else signaling.disconnect(); // koneksi P2P yang sudah ada tetap hidup
    commit();
  },
  'add-peer': () => addPeerModal({ myId: identity.peerId, onSubmit: addPeer }),
  'copy-id': async () => toast((await copyText(identity.peerId)) ? 'Peer ID copied' : 'Could not copy', 'info'),

  'edit-name': async () => {
    const v = await promptModal({ title: 'Your name', label: 'Display name', value: identity.name, placeholder: 'Your name' });
    if (!v) return;
    identity.name = signalIdentity.name = v;
    saveIdentity(identity);
    manager.announce();
    commit();
    toast('Name updated', 'success');
  },

  'edit-details': async () => {
    const p = activePeer();
    if (!p) return;
    const v = await promptModal({ title: 'Edit details', label: 'Contact name', value: displayName(p), placeholder: p.name });
    if (v === null) return;
    manager.patchPeer(p.id, { alias: !v || v === p.name ? '' : v });
  },

  'toggle-section': (el) => {
    state.collapsed[el.dataset.section] = !state.collapsed[el.dataset.section];
    commit();
  },

  'privacy-mute': () => {
    const p = activePeer();
    if (!p) return;
    manager.patchPeer(p.id, { muted: !p.muted });
    toast(p.muted ? 'Conversation unmuted' : 'Conversation muted');
  },
  'privacy-block': () => {
    const p = activePeer();
    if (!p) return;
    if (!p.blocked) {
      manager.patchPeer(p.id, { blocked: true });
      manager.disconnect(p.id);
      toast(`${displayName(p)} blocked`);
    } else {
      manager.patchPeer(p.id, { blocked: false });
      manager.connect(p.id, { silent: true });
      toast(`${displayName(p)} unblocked`);
    }
  },
  'privacy-reconnect': () => {
    const p = activePeer();
    if (!p) return;
    manager.reconnect(p.id);
    toast('Reconnecting…');
  },
  'privacy-delete': async () => {
    const p = activePeer();
    if (!p) return;
    const ok = await confirmModal({
      title: 'Delete conversation?',
      text: `This removes your messages with ${displayName(p)} and takes them off your list. You can add them again with their code.`,
      confirmText: 'Delete',
    });
    if (!ok) return;
    state.messages[p.id] = [];
    db.deleteMessages(p.id);
    manager.removePeer(p.id);
    state.activeId = null;
    commit();
  },

  'create-group': () => toast('Group chat is coming soon'),
  'call-soon': () => toast('Voice and video calls will be added later'),
  'voice-soon': () => toast('Voice notes are not available yet (task No.3)'),
  'file-soon': () => toast('File sharing is not available yet (task No.3)'),
  soon: () => toast('Coming soon'),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) actions[el.dataset.action]?.(el, e);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('peer-card')) {
    e.preventDefault();
    e.target.click();
  }
});

$('search').addEventListener('input', (e) => {
  state.search = e.target.value;
  commit();
});

const input = $('messageInput');
$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !state.activeId) return;
  if (!manager.sendChat(state.activeId, text)) return void toast("Can't send to this peer.", 'error');
  input.value = '';
});
input.addEventListener('input', () => {
  if (state.activeId && input.value) manager.sendTyping(state.activeId);
});

window.addEventListener('focus', () => state.activeId && markRead(state.activeId));
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && state.activeId && markRead(state.activeId));

// ------------------------------------------------------------------ render
subscribe((s) => {
  renderProfile($('profile'), s);
  renderPeerList($('peerList'), s);
  renderChatHeader($('chatHead'), s);

  const box = $('messages');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const prevTop = box.scrollTop;
  renderMessages(box, s);
  const switched = box.dataset.chat !== String(s.activeId);
  box.scrollTop = switched || nearBottom ? box.scrollHeight : prevTop;
  box.dataset.chat = String(s.activeId);

  renderInfo($('info'), s);
  $('chat').classList.toggle('is-empty', !getPeer(s.activeId));
  document.body.classList.toggle('has-chat', !!getPeer(s.activeId));

  const unread = s.peers.reduce((n, p) => n + (p.id === s.activeId ? 0 : unreadCount(p)), 0);
  document.title = unread ? `(${unread}) Droppy` : 'Droppy';
});

setInterval(commit, 30_000); // segarkan label "x min ago"
commit();

signaling.connect(signalIdentity);

// Untuk debugging / demo di console browser: window.droppy.manager.list()
window.droppy = { manager, signaling, state, chatOf };
