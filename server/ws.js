// WebSocket server minimal (RFC 6455) TANPA dependensi.
// Cukup untuk kebutuhan signaling: pesan teks JSON kecil.
// Kalau nanti mau pakai library `ws`, cukup ganti file ini.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 1024 * 1024; // 1 MB, signaling hanya butuh pesan kecil

export class WSConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.alive = true;
    this.closed = false;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragOpcode = 0;
    socket.setNoDelay(true);
    socket.on('data', (chunk) => this.receive(chunk));
    socket.on('close', () => this.#finish());
    socket.on('error', () => this.#finish());
  }

  send(text) {
    if (this.closed) return false;
    this.#write(0x1, Buffer.from(text, 'utf8'));
    return true;
  }

  ping() {
    if (!this.closed) this.#write(0x9, Buffer.alloc(0));
  }

  close(code = 1000) {
    if (this.closed) return;
    const body = Buffer.alloc(2);
    body.writeUInt16BE(code);
    this.#write(0x8, body);
    this.socket.end();
    this.#finish();
  }

  terminate() {
    this.socket.destroy();
    this.#finish();
  }

  #write(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    try {
      this.socket.write(Buffer.concat([header, payload]));
    } catch {
      this.#finish();
    }
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = !!(b0 & 0x80);
      const opcode = b0 & 0x0f;
      const masked = !!(b1 & 0x80);
      let len = b1 & 0x7f;
      let offset = 2;

      if (len === 126) {
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this.buffer.length < 10) return;
        len = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      if (len > MAX_PAYLOAD) return this.close(1009);
      if (!masked) return this.close(1002); // frame dari browser wajib bermask
      if (this.buffer.length < offset + 4 + len) return; // data belum lengkap

      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buffer = this.buffer.subarray(offset + 4 + len);
      this.#handleFrame(fin, opcode, payload);
    }
  }

  #handleFrame(fin, opcode, payload) {
    switch (opcode) {
      case 0x8: // close
        this.close();
        break;
      case 0x9: // ping -> balas pong
        this.#write(0xa, payload);
        break;
      case 0xa: // pong
        this.alive = true;
        break;
      case 0x0: // continuation
      case 0x1: // text
      case 0x2: // binary
        if (opcode !== 0x0) {
          this.fragOpcode = opcode;
          this.fragments = [];
        }
        this.fragments.push(payload);
        if (fin) {
          const data = Buffer.concat(this.fragments);
          this.fragments = [];
          if (this.fragOpcode === 0x1) this.emit('message', data.toString('utf8'));
        }
        break;
      default:
        break;
    }
  }

  #finish() {
    if (this.closed) return;
    this.closed = true;
    this.alive = false;
    this.emit('close');
  }
}

/** Dipanggil dari event 'upgrade' milik http.Server. */
export function handleUpgrade(req, socket, head, onConnection) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n')
  );
  const conn = new WSConnection(socket);
  onConnection(conn, req);
  if (head && head.length) conn.receive(head);
}
