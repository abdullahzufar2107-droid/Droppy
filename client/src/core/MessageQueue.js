// Ack + retry + antrean offline (No.2 Reliability).
// Status pesan keluar: pending (belum terkirim) -> sent (sudah dikirim) -> delivered (ack diterima)
//                      failed (ack tidak datang setelah beberapa kali coba; dicoba lagi saat peer tersambung)
import { ACK } from '../config.js';

export class MessageQueue {
  /**
   * @param {object} o
   * @param {(peerId:string,msg:object)=>boolean} o.sendRaw   true bila berhasil ditulis ke DataChannel
   * @param {(peerId:string,id:string,status:string)=>void} o.onStatus
   */
  constructor({ sendRaw, onStatus }) {
    this.sendRaw = sendRaw;
    this.onStatus = onStatus;
    this.pending = new Map(); // msgId -> { peerId, msg, tries, timer }
    this.seen = new Map(); // peerId -> Set(msgId) untuk membuang pesan duplikat
  }

  enqueue(peerId, msg) {
    if (this.pending.has(msg.id)) return;
    this.pending.set(msg.id, { peerId, msg, tries: 0, timer: null });
    this.#attempt(msg.id);
  }

  ack(msgId) {
    const e = this.pending.get(msgId);
    if (!e) return;
    clearTimeout(e.timer);
    this.pending.delete(msgId);
    this.onStatus(e.peerId, msgId, 'delivered');
  }

  /** Peer baru tersambung: kirim semua pesan yang masih menunggu. */
  flush(peerId) {
    for (const [id, e] of this.pending) {
      if (e.peerId === peerId) {
        e.tries = 0;
        this.#attempt(id);
      }
    }
  }

  /** true bila pesan ini sudah pernah diterima (duplikat hasil retry). */
  isDuplicate(peerId, msgId) {
    let set = this.seen.get(peerId);
    if (!set) this.seen.set(peerId, (set = new Set()));
    if (set.has(msgId)) return true;
    set.add(msgId);
    if (set.size > 500) set.delete(set.values().next().value);
    return false;
  }

  #attempt(id) {
    const e = this.pending.get(id);
    if (!e) return;
    clearTimeout(e.timer);

    if (!this.sendRaw(e.peerId, e.msg)) {
      // Peer sedang offline: tunggu flush() saat tersambung lagi
      this.onStatus(e.peerId, id, 'pending');
      return;
    }
    e.tries++;
    this.onStatus(e.peerId, id, 'sent');
    e.timer = setTimeout(() => {
      if (e.tries < ACK.maxTries) this.#attempt(id);
      else this.onStatus(e.peerId, id, 'failed');
    }, ACK.timeout);
  }
}
