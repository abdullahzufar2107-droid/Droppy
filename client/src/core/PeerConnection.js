// Satu koneksi WebRTC ke satu peer: RTCPeerConnection + RTCDataChannel.
// Semua pesan chat, ack, ping, dan (nanti) file mengalir lewat DataChannel ini, langsung antar browser.
import { Emitter } from './Emitter.js';

const CONNECT_TIMEOUT = 20_000;

export class PeerConnection extends Emitter {
  /**
   * @param {object} o
   * @param {string} o.peerId      ID peer lawan
   * @param {string} o.sid         ID sesi negosiasi (menolak sinyal basi / salah sesi)
   * @param {boolean} o.initiator  true = kita yang membuat offer
   * @param {RTCIceServer[]} o.iceServers
   * @param {(type:string, payload:object)=>void} o.sendSignal  kirim offer/answer/ice via signaling
   */
  constructor({ peerId, sid, initiator, iceServers, sendSignal }) {
    super();
    this.peerId = peerId;
    this.sid = sid;
    this.initiator = initiator;
    this.sendSignal = sendSignal;
    this.opened = false;
    this.closed = false;
    this.channel = null;
    this.pendingIce = [];

    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal('ice', { sid: this.sid, candidate: e.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      this.emit('state', state);
      if (state === 'failed' || state === 'closed') this.#fail(state);
    };
    this.pc.ondatachannel = (e) => this.#bind(e.channel);

    this.timer = setTimeout(() => {
      if (!this.opened) this.#fail('timeout');
    }, CONNECT_TIMEOUT);
  }

  get isOpen() {
    return this.channel?.readyState === 'open';
  }

  /** Sisi initiator: buat DataChannel + offer. */
  async start() {
    this.#bind(this.pc.createDataChannel('droppy', { ordered: true }));
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal('offer', { sid: this.sid, sdp: this.pc.localDescription.toJSON() });
  }

  /** Sisi penerima: terima offer, balas answer. */
  async acceptOffer(sdp) {
    await this.pc.setRemoteDescription(sdp);
    await this.#flushIce();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.sendSignal('answer', { sid: this.sid, sdp: this.pc.localDescription.toJSON() });
  }

  async acceptAnswer(sdp) {
    await this.pc.setRemoteDescription(sdp);
    await this.#flushIce();
  }

  async addIce(candidate) {
    // Kandidat bisa datang sebelum remote description siap -> simpan dulu
    if (!this.pc.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {}
  }

  async #flushIce() {
    const list = this.pendingIce;
    this.pendingIce = [];
    for (const c of list) {
      try {
        await this.pc.addIceCandidate(c);
      } catch {}
    }
  }

  send(obj) {
    if (!this.isOpen) return false;
    try {
      this.channel.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }

  /** Jalur koneksi yang dipakai: 'direct' (host/STUN) atau 'relay' (TURN), plus RTT bila ada. */
  async getRoute() {
    try {
      const stats = await this.pc.getStats();
      const byId = new Map();
      stats.forEach((r) => byId.set(r.id, r));
      let pair = null;
      stats.forEach((r) => {
        if (r.type === 'transport' && r.selectedCandidatePairId) pair = byId.get(r.selectedCandidatePairId);
      });
      if (!pair) {
        stats.forEach((r) => {
          if (!pair && r.type === 'candidate-pair' && (r.selected || (r.nominated && r.state === 'succeeded'))) pair = r;
        });
      }
      if (!pair) return null;
      const local = byId.get(pair.localCandidateId)?.candidateType;
      const remote = byId.get(pair.remoteCandidateId)?.candidateType;
      return {
        route: local === 'relay' || remote === 'relay' ? 'relay' : 'direct',
        local,
        remote,
        rtt: pair.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) : null,
      };
    } catch {
      return null;
    }
  }

  /** Tutup diam-diam (tidak memancarkan event 'closed'). */
  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    try {
      this.channel?.close();
    } catch {}
    try {
      this.pc.close();
    } catch {}
  }

  #bind(ch) {
    this.channel = ch;
    ch.onopen = () => {
      if (this.opened) return;
      this.opened = true;
      clearTimeout(this.timer);
      this.emit('open');
    };
    ch.onmessage = (e) => {
      try {
        this.emit('message', JSON.parse(e.data));
      } catch {}
    };
    ch.onclose = () => this.#fail('channel-closed');
    ch.onerror = () => {};
    if (ch.readyState === 'open') ch.onopen();
  }

  #fail(reason) {
    if (this.closed) return;
    const wasOpen = this.opened;
    this.close();
    this.emit('closed', { reason, wasOpen });
  }
}
