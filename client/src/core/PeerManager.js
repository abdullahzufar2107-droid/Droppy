// PeerManager (No.1 Network lead): mengelola semua koneksi peer + daftar peer.
// UI tidak menyentuh WebRTC langsung; cukup memanggil method di sini dan mendengarkan event:
//   'peers'           daftar peer berubah (status, nama, rute, latensi)
//   'peer-save'       peer perlu disimpan ke database (payload: objek peer)
//   'peer-removed'    peer dihapus (payload: peerId)
//   'peer-connected'  DataChannel terbuka (payload: peerId)
//   'peer-error'      { peerId, code }  code: 'not-found' | 'connect-failed' | 'signaling-offline'
//   'message'         { peerId, msg }   pesan baru (masuk maupun keluar)
//   'message-status'  { peerId, id, status }
//   'typing'          { peerId }
import { Emitter } from './Emitter.js';
import { PeerConnection } from './PeerConnection.js';
import { Heartbeat } from './Heartbeat.js';
import { MessageQueue } from './MessageQueue.js';
import { buildPeerList, handlePeerList } from './PeerExchange.js';
import { RECONNECT_DELAYS } from '../config.js';
import { isValidPeerId, newMsgId, newSid } from '../utils.js';

const MAX_TEXT = 4000;

export class PeerManager extends Emitter {
  /**
   * @param {object} o
   * @param {{peerId:string,name:string}} o.me
   * @param {import('./Signaling.js').Signaling} o.signaling
   * @param {RTCIceServer[]} o.iceServers
   */
  constructor({ me, signaling, iceServers }) {
    super();
    this.me = me;
    this.signaling = signaling;
    this.iceServers = iceServers;

    this.peers = new Map(); // id -> { id, name, alias, status, route, rtt, lastSeen, lastRead, muted, blocked }
    this.conns = new Map(); // id -> PeerConnection
    this.beats = new Map(); // id -> Heartbeat
    this.retries = new Map(); // id -> jumlah percobaan reconnect
    this.retryTimers = new Map();
    this.lastTyping = new Map();

    this.queue = new MessageQueue({
      sendRaw: (peerId, msg) => this.#sendRaw(peerId, msg),
      onStatus: (peerId, id, status) => this.emit('message-status', { peerId, id, status }),
    });

    signaling.on('offer', (e) => this.#onOffer(e));
    signaling.on('answer', (e) => this.#onAnswer(e));
    signaling.on('ice', (e) => this.#onIce(e));
    signaling.on('error', (e) => {
      if (e.code === 'peer-not-found') this.#onNotFound(e.to);
    });
  }

  // ---------------------------------------------------------------- daftar peer

  /** Muat peer tersimpan (semuanya mulai sebagai offline). */
  setPeers(list) {
    for (const p of list) {
      if (!isValidPeerId(p.id)) continue;
      this.peers.set(p.id, { ...this.#blank(p.id, p.name), ...p, status: 'offline', route: null, rtt: null });
    }
    this.emit('peers');
  }

  list() {
    return [...this.peers.values()].map((p) => ({ ...p }));
  }

  getPeer(id) {
    return this.peers.get(id);
  }

  /** Ubah field peer (alias, muted, blocked, lastRead) lalu simpan. */
  patchPeer(id, patch) {
    const p = this.peers.get(id);
    if (!p) return;
    Object.assign(p, patch);
    this.emit('peers');
    this.emit('peer-save', { ...p });
  }

  removePeer(id) {
    this.#dropConn(id);
    clearTimeout(this.retryTimers.get(id));
    this.peers.delete(id);
    this.emit('peers');
    this.emit('peer-removed', id);
  }

  // ---------------------------------------------------------------- koneksi

  /** Mulai koneksi ke peer (kita jadi initiator). */
  connect(peerId, { name, silent = false, reconnect = false } = {}) {
    if (!isValidPeerId(peerId) || peerId === this.me.peerId) return false;
    const peer = this.#ensurePeer(peerId, name);
    if (peer.blocked) return false;

    const existing = this.conns.get(peerId);
    if (existing && !existing.closed) return true; // sudah tersambung / sedang menyambung

    if (!this.signaling.isOnline) {
      if (!silent) this.emit('peer-error', { peerId, code: 'signaling-offline' });
      return false;
    }

    this.#setStatus(peerId, 'connecting');
    const conn = this.#createConn(peerId, newSid(), true);
    conn.silent = silent;
    conn.reconnect = reconnect;
    conn.start().catch(() => this.#handleClosed(conn, 'start-failed', false));
    return true;
  }

  /** Coba sambung ulang manual (tombol "Something's wrong" / buka chat peer offline). */
  reconnect(peerId) {
    this.retries.delete(peerId);
    this.#dropConn(peerId);
    this.#setStatus(peerId, 'offline');
    return this.connect(peerId, { silent: false, reconnect: true });
  }

  /** Putus koneksi ke peer dan hentikan auto-reconnect (dipakai saat Block). */
  disconnect(peerId) {
    this.#dropConn(peerId);
    clearTimeout(this.retryTimers.get(peerId));
    this.retries.delete(peerId);
    this.#setStatus(peerId, 'offline');
  }

  /** Dipanggil saat signaling tersambung lagi: coba semua peer yang sedang offline. */
  reconnectAll() {
    for (const p of this.peers.values()) {
      if (p.status === 'offline' && !p.blocked) this.connect(p.id, { silent: true, reconnect: true });
    }
  }

  // ---------------------------------------------------------------- pesan

  sendChat(peerId, text) {
    const clean = String(text || '').trim().slice(0, MAX_TEXT);
    const peer = this.peers.get(peerId);
    if (!clean || !peer || peer.blocked) return null;

    const wire = this.#wire(peerId, 'chat', { text: clean });
    const record = this.#record(wire, 'out', clean);
    this.emit('message', { peerId, msg: record });
    this.queue.enqueue(peerId, wire);
    return record;
  }

  /** Masukkan lagi pesan keluar yang belum terkirim (setelah reload halaman). */
  requeue(record) {
    this.queue.enqueue(record.chatId, {
      id: record.id,
      type: 'chat',
      from: this.me.peerId,
      to: record.chatId,
      ts: record.ts,
      payload: { text: record.text },
    });
  }

  sendTyping(peerId) {
    const now = Date.now();
    if (now - (this.lastTyping.get(peerId) || 0) < 2000) return;
    this.lastTyping.set(peerId, now);
    this.#send(peerId, 'typing', {});
  }

  /** Kabari semua peer terhubung bahwa nama kita berubah. */
  announce() {
    for (const [id, conn] of this.conns) if (conn.isOpen) this.#send(id, 'hello', { name: this.me.name });
  }

  // ---------------------------------------------------------------- signaling masuk

  #onOffer({ from, name, payload }) {
    const { sid, sdp } = payload || {};
    if (!isValidPeerId(from) || !sid || !sdp) return;
    const known = this.peers.get(from);
    if (known?.blocked) return;

    const existing = this.conns.get(from);
    if (existing && !existing.closed) {
      // Glare: kedua sisi saling offer bersamaan. ID lebih kecil menang sebagai initiator.
      if (existing.initiator && !existing.opened && this.me.peerId < from) return;
      this.#dropConn(from); // koneksi lama basi (peer reload) atau kita kalah glare
    }

    this.#ensurePeer(from, name);
    this.#setStatus(from, 'connecting');
    const conn = this.#createConn(from, sid, false);
    conn.silent = true;
    conn.acceptOffer(sdp).catch(() => this.#handleClosed(conn, 'offer-failed', false));
  }

  #onAnswer({ from, payload }) {
    const conn = this.conns.get(from);
    if (!conn || conn.sid !== payload?.sid || !payload.sdp) return;
    conn.acceptAnswer(payload.sdp).catch(() => this.#handleClosed(conn, 'answer-failed', false));
  }

  #onIce({ from, payload }) {
    const conn = this.conns.get(from);
    if (!conn || conn.sid !== payload?.sid || !payload.candidate) return;
    conn.addIce(payload.candidate);
  }

  #onNotFound(peerId) {
    const conn = this.conns.get(peerId);
    if (!conn || conn.opened) return;
    this.#handleClosed(conn, 'not-found', false);
  }

  // ---------------------------------------------------------------- internal

  #blank(id, name) {
    return {
      id,
      name: name || `Peer ${id}`,
      alias: '',
      status: 'offline',
      route: null,
      rtt: null,
      lastSeen: 0,
      lastRead: 0,
      muted: false,
      blocked: false,
    };
  }

  #ensurePeer(id, name) {
    let peer = this.peers.get(id);
    if (!peer) {
      peer = this.#blank(id, name);
      this.peers.set(id, peer);
      this.emit('peers');
      this.emit('peer-save', { ...peer });
    } else if (name && (peer.name.startsWith('Peer ') || peer.name !== name) && !peer.alias) {
      peer.name = name;
    }
    return peer;
  }

  #setStatus(id, status) {
    const p = this.peers.get(id);
    if (!p || p.status === status) return;
    p.status = status;
    if (status === 'offline') {
      p.lastSeen = Date.now();
      p.route = null;
      p.rtt = null;
    }
    this.emit('peers');
  }

  #createConn(peerId, sid, initiator) {
    const conn = new PeerConnection({
      peerId,
      sid,
      initiator,
      iceServers: this.iceServers,
      sendSignal: (type, payload) => this.signaling.send({ type, to: peerId, payload }),
    });
    this.conns.set(peerId, conn);

    conn.on('open', () => this.#onOpen(conn));
    conn.on('message', (msg) => this.#onMessage(peerId, msg));
    conn.on('closed', ({ reason, wasOpen }) => this.#handleClosed(conn, reason, wasOpen));
    return conn;
  }

  #onOpen(conn) {
    const peerId = conn.peerId;
    if (this.conns.get(peerId) !== conn) return;
    this.retries.delete(peerId);
    clearTimeout(this.retryTimers.get(peerId));
    this.#setStatus(peerId, 'online');

    this.#send(peerId, 'hello', { name: this.me.name });
    this.#send(peerId, 'peers', { list: buildPeerList(this.peers, peerId, this.me.peerId) });

    const beat = new Heartbeat({
      sendPing: (ts) => this.#send(peerId, 'ping', { ts }),
      onTimeout: () => {
        if (this.conns.get(peerId) !== conn) return;
        conn.close();
        this.#handleClosed(conn, 'heartbeat-timeout', true);
      },
      onRtt: (rtt) => {
        const p = this.peers.get(peerId);
        if (p && p.rtt !== rtt) {
          p.rtt = rtt;
          this.emit('peers');
        }
      },
    });
    this.beats.set(peerId, beat);
    beat.start();

    this.queue.flush(peerId);
    this.emit('peer-connected', peerId);
    this.emit('peer-save', { ...this.peers.get(peerId) });

    // Cek jalur yang dipilih ICE (langsung atau relay TURN)
    const probe = () =>
      conn.getRoute().then((r) => {
        const p = this.peers.get(peerId);
        if (r && p && this.conns.get(peerId) === conn && p.route !== r.route) {
          p.route = r.route;
          this.emit('peers');
        }
      });
    setTimeout(probe, 600);
    setTimeout(probe, 3000);
  }

  /** Koneksi berakhir (putus, gagal, timeout, atau peer tidak ditemukan). */
  #handleClosed(conn, reason, wasOpen) {
    const peerId = conn.peerId;
    if (this.conns.get(peerId) !== conn) return; // koneksi basi, abaikan
    this.#dropConn(peerId);
    this.#setStatus(peerId, 'offline');

    if (reason === 'not-found' && !conn.silent) {
      this.emit('peer-error', { peerId, code: 'not-found' });
    } else if (!wasOpen && reason !== 'not-found' && !conn.silent) {
      this.emit('peer-error', { peerId, code: 'connect-failed' });
    }

    // Auto-reconnect dengan jeda 1, 2, 4, 8, 16 detik (maksimal 5 kali)
    if (wasOpen || conn.reconnect) this.#scheduleRetry(peerId);
  }

  #scheduleRetry(peerId) {
    const n = this.retries.get(peerId) || 0;
    if (n >= RECONNECT_DELAYS.length) return;
    this.retries.set(peerId, n + 1);
    clearTimeout(this.retryTimers.get(peerId));
    this.retryTimers.set(
      peerId,
      setTimeout(() => {
        const p = this.peers.get(peerId);
        if (p && p.status === 'offline') this.connect(peerId, { silent: true, reconnect: true });
      }, RECONNECT_DELAYS[n])
    );
  }

  /** Tutup koneksi + heartbeat tanpa memicu event/reconnect. */
  #dropConn(peerId) {
    this.beats.get(peerId)?.stop();
    this.beats.delete(peerId);
    const conn = this.conns.get(peerId);
    this.conns.delete(peerId);
    conn?.close();
  }

  #onMessage(peerId, msg) {
    const peer = this.peers.get(peerId);
    if (!peer || peer.blocked || !msg || typeof msg.type !== 'string') return;
    const payload = msg.payload || {};

    switch (msg.type) {
      case 'hello': {
        const name = String(payload.name || '').slice(0, 32);
        if (name && name !== peer.name) {
          peer.name = name;
          this.emit('peers');
          this.emit('peer-save', { ...peer });
        }
        break;
      }
      case 'ping':
        this.#send(peerId, 'pong', { ts: payload.ts });
        break;
      case 'pong':
        this.beats.get(peerId)?.pong(payload.ts);
        break;
      case 'chat': {
        if (!msg.id) return;
        this.#send(peerId, 'ack', { id: msg.id }); // selalu balas ack, termasuk untuk duplikat
        if (this.queue.isDuplicate(peerId, msg.id)) return;
        const text = String(payload.text || '').slice(0, MAX_TEXT);
        if (!text) return;
        const record = { id: msg.id, chatId: peerId, dir: 'in', type: 'chat', text, ts: Date.now(), status: 'received' };
        this.emit('message', { peerId, msg: record });
        break;
      }
      case 'ack':
        this.queue.ack(payload.id);
        break;
      case 'typing':
        this.emit('typing', { peerId });
        break;
      case 'peers':
        handlePeerList(payload.list, {
          selfId: this.me.peerId,
          isKnown: (id) => this.peers.has(id),
          connect: (id, opts) => this.connect(id, opts),
        });
        break;
      default:
        break; // tipe lain (file-*, call-*) ditangani modul lain nanti
    }
  }

  #wire(peerId, type, payload) {
    return { id: newMsgId(), type, from: this.me.peerId, to: peerId, ts: Date.now(), payload };
  }

  #record(wire, dir, text) {
    return { id: wire.id, chatId: wire.to, dir, type: 'chat', text, ts: wire.ts, status: 'pending' };
  }

  #send(peerId, type, payload) {
    return this.#sendRaw(peerId, this.#wire(peerId, type, payload));
  }

  #sendRaw(peerId, msg) {
    const conn = this.conns.get(peerId);
    return !!(conn && conn.isOpen && conn.send(msg));
  }
}
