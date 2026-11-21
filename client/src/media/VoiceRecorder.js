// Voice note (No.3 File dan Voice Note) -> BELUM DIIMPLEMENTASIKAN.
//
// Rencana:
//   - navigator.mediaDevices.getUserMedia({ audio: true }) -> MediaRecorder
//   - kumpulkan chunk 'dataavailable', gabung jadi Blob (audio/webm)
//   - kirim sebagai file lewat FileTransfer.send(peerId, blob)
//
// Catatan: getUserMedia hanya jalan di HTTPS atau http://localhost.
// Untuk demo lewat IP LAN / beda jaringan, jalankan server lewat tunnel HTTPS (cloudflared / ngrok).
export class VoiceRecorder {
  get supported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }

  async start() {
    throw new Error('VoiceRecorder belum diimplementasikan (tugas No.3)');
  }

  /** @returns {Promise<Blob>} */
  async stop() {
    throw new Error('VoiceRecorder belum diimplementasikan (tugas No.3)');
  }
}
