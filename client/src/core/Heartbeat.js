// Heartbeat (No.2 Reliability): ping berkala, peer dianggap putus bila tidak ada pong.
// Sekaligus mengukur latensi (RTT) dari selisih waktu ping -> pong.
import { HEARTBEAT } from '../config.js';

export class Heartbeat {
  /**
   * @param {object} o
   * @param {(ts:number)=>void} o.sendPing  kirim ping ke peer
   * @param {()=>void} o.onTimeout          dipanggil bila peer tidak membalas
   * @param {(rtt:number)=>void} [o.onRtt]
   */
  constructor({ sendPing, onTimeout, onRtt, interval = HEARTBEAT.interval, timeout = HEARTBEAT.timeout }) {
    Object.assign(this, { sendPing, onTimeout, onRtt, interval, timeout });
    this.timer = null;
    this.lastPong = 0;
    this.lastTick = 0;
  }

  start() {
    this.stop();
    this.lastPong = this.lastTick = Date.now();
    this.sendPing(Date.now());
    this.timer = setInterval(() => {
      const now = Date.now();
      // Tab di background / laptop sleep membuat timer tertunda: jangan dianggap peer putus.
      if (now - this.lastTick > this.interval * 3) this.lastPong = now;
      this.lastTick = now;

      if (now - this.lastPong > this.timeout) {
        this.stop();
        this.onTimeout();
        return;
      }
      this.sendPing(now);
    }, this.interval);
  }

  pong(ts) {
    this.lastPong = Date.now();
    if (ts && this.onRtt) this.onRtt(Math.max(0, Date.now() - ts));
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}
