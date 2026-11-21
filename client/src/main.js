import { MAX_GROUP_SIZE } from './core/GroupChat.js';
import { makeThumbnail, photoType } from './ui/photo.js';
import { MAX_FILE } from './core/FileTransfer.js';
import { VoiceRecorder } from './media/VoiceRecorder.js';
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
import { addPeerModal, createGroupModal, confirmModal, promptModal, toast } from './ui/components/Modal.js';

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
$('recentMore').innerHTML = icons.users;
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
const voiceRecorder = new VoiceRecorder();

const announce = new Set(); // peer yang baru ditambahkan: tampilkan toast saat tersambung

const plainPeer = (p) => ({
  id: p.id,
  name: p.name,
  alias: p.alias,
  lastSeen: p.lastSeen,
  lastRead: p.lastRead,
  muted: p.muted,
  blocked: p.blocked,
  groupOnly: p.groupOnly,
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

manager.on('group-save', group => {
  state.groups = [...manager.groupChat.groups.values()];
  db.putGroup(group);
  commit();
});
manager.on('group-delivery', msg => {
  db.putMessage(msg);
  commit();
});
manager.on('message', ({ peerId, msg }) => {
  if (msg.type === 'group' && chatOf(msg.chatId).some(existing => existing.id === msg.id)) return;
  addMessage(msg);
  db.putMessage(msg);
  if (msg.dir === 'in') {
    const peer = manager.getPeer(peerId);
    if (state.activeId === msg.chatId && document.visibilityState === 'visible') markRead(msg.chatId);
    else if (!peer?.muted) toast(`${displayName(peer)}: ${msg.text.slice(0, 70)}`);
  }
  commit();
});

manager.on('file-update', msg => {
  if (!getPeer(msg.chatId)) return;
  addMessage(msg);
  if (!['transferring', 'offering'].includes(msg.status)) db.putMessage(msg);
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
for (const group of await db.getGroups()) manager.groupChat.groups.set(group.id, group);
state.groups = [...manager.groupChat.groups.values()];
for (const m of await db.getAllMessages()) {
  if (!getPeer(m.chatId)) continue;
  if (m.type === 'file' && ['available', 'waiting'].includes(m.status)) {
    m.status = 'failed';
    m.error = 'Transfer expired. Ask the sender to send it again.';
  }
  addMessage(m);
  if (m.type !== 'file' && m.dir === 'out' && m.status !== 'delivered') {
    m.status = 'pending';
    if (m.type === 'group') manager.groupChat.requeue(m);
    else manager.requeue(m);
  }
}
state.peers = manager.list();

// ------------------------------------------------------------------ aksi
function markRead(peerId) {
  const p = getPeer(peerId);
  if (!p || !unreadCount(p)) return;
  if (p.members) {
    p.lastRead = Date.now();
    db.putGroup(p);
    commit();
  } else {
    manager.patchPeer(peerId, { lastRead: Date.now() });
  }
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

  if (known?.groupOnly) {
    known.groupOnly = false;
    manager.groupOnlyPeers.delete(code);
    manager.emit('peers');
    db.putPeer(plainPeer(known));
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

const activePeer = () => getPeer(state.activeId);

async function sendAttachment(peerId, file) {
  if (!file) return;
  try {
    const thumbnail = file.size <= MAX_FILE ? await makeThumbnail(file).catch(() => '') : '';
    if (getPeer(peerId)?.members) manager.sendGroupFile(peerId, file, thumbnail);
    else manager.sendFile(peerId, file, thumbnail);
  }
  catch (err) { toast(err.message, 'error'); }
}
$('chat').addEventListener('dragover', e => e.preventDefault());
$('chat').addEventListener('drop', e => {
  e.preventDefault();
  for (const file of e.dataTransfer.files) sendAttachment(state.activeId, file);
});

const photoViewer = $('photoViewer');
const viewerImage = photoViewer.querySelector('img');
photoViewer.addEventListener('close', () => {
  URL.revokeObjectURL(viewerImage.getAttribute('src'));
  viewerImage.removeAttribute('src');
});
photoViewer.addEventListener('click', event => {
  if (event.target === photoViewer) photoViewer.close();
});

const actions = {
  'view-photo': el => {
    const message = chatOf(state.activeId).find(m => m.id === el.dataset.id);
    const mime = message && photoType(message);
    if (!mime || photoViewer.open) return;
    viewerImage.src = URL.createObjectURL(message.blob.slice(0, message.blob.size, mime));
    photoViewer.showModal();
  },
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
    if (p.members) {
      manager.groupChat.groups.delete(p.id);
      state.groups = state.groups.filter(group => group.id !== p.id);
      await db.deleteGroup(p.id);
    } else manager.removePeer(p.id);
    state.activeId = null;
    commit();
  },

  'create-group': () => {
    const peers = manager.list().filter(peer => !peer.blocked);
    if (peers.length < 2) return toast('Add at least two peers before creating a group.');
    createGroupModal({
      peers, maxMembers: MAX_GROUP_SIZE - 1,
      onCreate: (name, members) => {
        const group = manager.groupChat.create(name, members);
        if (group) selectPeer(group.id);
        return !!group;
      },
    });
  },
  'group-leave': async () => {
    const group = activePeer();
    if (!group?.members) return;
    const ok = await confirmModal({title:'Leave group?', text:`Leave ${group.name}? You will stop receiving its messages.`, confirmText:'Leave'});
    if (!ok) return;
    manager.groupChat.leave(group.id);
    state.groups = [...manager.groupChat.groups.values()];
    await db.deleteGroup(group.id);
    state.activeId = null;
    commit();
  },
  'group-delete-history': async () => {
    const group = activePeer();
    if (!group?.members) return;
    const ok = await confirmModal({title:'Clear group history?', text:`Remove messages from ${group.name} on this device?`, confirmText:'Clear'});
    if (!ok) return;
    state.messages[group.id] = [];
    await db.deleteMessages(group.id);
    commit();
  },
  'voice-soon': () => actions['voice-record']($('composerMic')),
  'call-soon': () => toast('Voice and video calls will be added later'),
  'voice-record': async el => {
    try {
      if (!voiceRecorder.recording) {
        await voiceRecorder.start();
        el.textContent = '■';
        toast('Recording voice note… click again to send');
        return;
      }
      const blob = await voiceRecorder.stop();
      el.textContent = '';
      await sendAttachment(state.activeId, new File([blob], `voice-note-${Date.now()}.webm`, {type:blob.type || 'audio/webm'}));
    } catch (error) { el.textContent = ''; toast(error.message || 'Microphone unavailable.', 'error'); }
  },
  'pick-file': () => {
    const peerId = state.activeId;
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.onchange = () => sendAttachment(peerId, picker.files[0]);
    picker.click();
  },
  'download-file': el => {
    const msg = chatOf(state.activeId).find(m => m.id === el.dataset.id);
    if (!msg) return;
    if (msg.status === 'available') {
      if (!manager.downloadFile(msg.id)) toast('File is unavailable. Ask the sender to send it again.', 'error');
      return;
    }
    if (!msg.blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(msg.blob);
    link.download = msg.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
  },
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
  const sent = getPeer(state.activeId)?.members
    ? manager.groupChat.send(state.activeId, text)
    : manager.sendChat(state.activeId, text);
  if (!sent) return void toast("Couldn't send the message.", 'error');
  input.value = '';
});
input.addEventListener('input', () => {
  if (activePeer() && input.value) manager.sendTyping(state.activeId);
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

  $('composerFile').hidden = false;
  $('composerMic').hidden = false;

  const unread = [...s.peers, ...s.groups].reduce((n, p) => n + (p.id === s.activeId ? 0 : unreadCount(p)), 0);
  document.title = unread ? `(${unread}) Droppy` : 'Droppy';
});

setInterval(commit, 30_000); // segarkan label "x min ago"
commit();

signaling.connect(signalIdentity);

// Untuk debugging / demo di console browser: window.droppy.manager.list()
window.droppy = { manager, signaling, state, chatOf };
