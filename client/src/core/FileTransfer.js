// Kirim file lewat DataChannel (No.3 File dan Voice Note) -> BELUM DIIMPLEMENTASIKAN.
//
// Rencana (sesuai blueprint):
//   1. Kirim pesan   { type:'file-meta',  payload:{ id, name, size, mime, chunks } }
//   2. Pecah file per 16 KB, kirim { type:'file-chunk', payload:{ id, index, data(base64) } }
//      atau kirim chunk sebagai binary frame agar lebih cepat.
//   3. Backpressure: sebelum kirim chunk berikutnya, tunggu sampai
//      channel.bufferedAmount < channel.bufferedAmountLowThreshold (event 'bufferedamountlow').
//   4. Penerima menyusun ulang berdasarkan index, lalu emit progress 0..1.
//   5. Setelah selesai kirim { type:'file-done', payload:{ id } }; simpan Blob ke IndexedDB (store 'files').
//
// Antarmuka yang diharapkan UI:
//   const ft = new FileTransfer({ sendRaw });          // sendRaw(peerId, msg) -> boolean
//   ft.on('progress', ({ peerId, id, progress, dir }) => ...)
//   ft.on('received', ({ peerId, id, blob, name, size, mime }) => ...)
//   await ft.send(peerId, file);
//   ft.handleMessage(peerId, msg);                      // dipanggil PeerManager untuk tipe file-*
import { Emitter } from './Emitter.js';

export const CHUNK_SIZE = 16 * 1024;

export class FileTransfer extends Emitter {
  constructor({ sendRaw }) {
    super();
    this.sendRaw = sendRaw;
  }

  async send(/* peerId, file */) {
    throw new Error('FileTransfer belum diimplementasikan (tugas No.3)');
  }

  handleMessage(/* peerId, msg */) {
    // TODO (No.3): tangani file-meta, file-chunk, file-done
  }
}
