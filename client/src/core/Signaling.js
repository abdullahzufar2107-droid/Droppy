// Klien WebSocket ke server signaling. Hanya dipakai untuk "perkenalan" (offer/answer/ice)
// dan lookup peer. Pesan chat TIDAK lewat sini.
import { Emitter } from './Emitter.js';

export class Signaling extends Emitter {
  constructor(url) {
    super();
    this.url = url;
    this.ws = null;
    this.identity = null; // { peerId, name, token }
    this.registered = false;
    this.wanted = false; // true = kita ingin tetap terhubung ke server
    this.attempt = 0;
    this.idRetries = 0;
    this.reconnectTimer = null;
    this.lookups = new Map(); // peerId -> resolve
  }

  get isOnline() {
    return this.registered && this.ws?.readyState === WebSocket.OPEN;
  }

  connect(identity) {
    this.identity = identity;
    this.wanted = true;
    this.#open();
  }

  /** Matikan "Active Status": tidak bisa ditemukan peer baru, DataChannel yang sudah ada tetap jalan. */
  disconnect() {
    this.wanted = false;
    clearTimeout(this.reconnectTimer);
    this.registered = false;
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {}
    this.emit('status', 'offline');
  }

  resume() {
    if (this.wanted) return;
    this.wanted = true;
    this.attempt = 0;
    this.#open();
  }

  send(obj) {
    if (!this.isOnline) return false;
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  /** Cek apakah peerId sedang online di server. */
  lookup(peerId) {
    return new Promise((resolve) => {
      if (!this.send({ type: 'lookup', peerId })) return resolve({ online: false, error: 'offline' });
      const timer = setTimeout(() => {
        this.lookups.delete(peerId);
        resolve({ online: false, error: 'timeout' });
      }, 4000);
      this.lookups.set(peerId, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });
  }

  #open() {
    clearTimeout(this.reconnectTimer);
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    this.emit('status', 'connecting');

    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch {
      return this.#scheduleReconnect();
    }
    this.ws = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'register',
          peerId: this.identity.peerId,
          name: this.identity.name,
          token: this.identity.token,
        })
      );
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.#onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.registered = false;
      this.emit('status', 'offline');
      if (this.wanted) this.#scheduleReconnect();
    };
    ws.onerror = () => {};
  }

  #scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** this.attempt, 10000);
    this.attempt++;
    this.reconnectTimer = setTimeout(() => this.#open(), delay);
  }

  #onMessage(msg) {
    switch (msg.type) {
      case 'registered':
        this.registered = true;
        this.attempt = 0;
        this.idRetries = 0;
        this.emit('status', 'online');
        this.emit('registered', msg);
        break;

      case 'offer':
      case 'answer':
      case 'ice':
        this.emit(msg.type, { from: msg.from, name: msg.name, payload: msg.payload });
        break;

      case 'lookup-result':
        this.lookups.get(msg.peerId)?.(msg);
        this.lookups.delete(msg.peerId);
        break;

      case 'error':
        if (msg.code === 'id-in-use') {
          // Bisa jadi sisa koneksi lama saat reload: coba lagi beberapa kali, lalu menyerah.
          this.idRetries++;
          if (this.idRetries > 3) {
            this.wanted = false;
            this.emit('id-conflict');
          }
          this.ws?.close();
        } else {
          this.emit('error', msg);
        }
        break;

      default:
        break;
    }
  }
}
