export class VoiceRecorder {
  recorder = null;
  chunks = [];
  stream = null;

  get supported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }

  get recording() { return this.recorder?.state === 'recording'; }

  async start() {
    if (!this.supported) throw new Error('Voice notes need microphone access on HTTPS or localhost.');
    if (this.recording) return;
    this.stream = await navigator.mediaDevices.getUserMedia({audio:true});
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.addEventListener('dataavailable', event => { if(event.data.size) this.chunks.push(event.data); });
    this.recorder.start();
  }

  /** @returns {Promise<Blob>} */
  async stop() {
    if (!this.recorder || !this.recording) throw new Error('No voice note is being recorded.');
    const recorder = this.recorder;
    const blob = await new Promise((resolve, reject) => {
      recorder.addEventListener('stop', () => resolve(new Blob(this.chunks, {type:recorder.mimeType})), {once:true});
      recorder.addEventListener('error', () => reject(new Error('Voice recording failed.')), {once:true});
      recorder.stop();
    });
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    return blob;
  }
}
