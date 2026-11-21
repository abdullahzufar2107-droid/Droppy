import { newMsgId } from '../utils.js';

const CHUNK = 16 * 1024;
export const MAX_FILE = 64 * 1024 * 1024;

export function transfer(channel, file, update, thumbnail = '', context = {}) {
  channel.binaryType = 'arraybuffer';
  channel.bufferedAmountLowThreshold = CHUNK * 8;
  let mime = file?.type || '';
  let offset = 0, size, name, progress = -1, busy = false, started = false;
  let downloading = false;
  let lastStatus;
  const parts = [];
  function report(status, blob, error) {
    const percent = size ? Math.floor(offset * 100 / size) : 0;
    if (percent !== progress || status !== lastStatus) update({ name, size, percent, status, blob: file || blob, thumbnail, error, ...context }, status === 'available' ? requestDownload : null);
    progress = percent;
    lastStatus = status;
  }
  function requestDownload() {
    if (!started || downloading || channel.readyState !== 'open') return false;
    try {
      channel.send('download');
      downloading = true;
      report('transferring');
      return true;
    } catch (err) {
      fail(err.message);
      return false;
    }
  }

  function fail(reason) {
    if (started) report('failed', null, typeof reason === 'string' ? reason : 'Connection interrupted.');
    started = false;
    parts.length = 0;
    channel.close();
  }
  channel.onclose = () => { if (started) report('failed', null, 'Peer closed the file channel. Refresh Droppy on both devices.'); };
  channel.onerror = fail;
  async function pump() {
    if (busy) return;
    busy = true;
    try {
      while (offset < size && channel.bufferedAmount < CHUNK * 32) {
        const bytes = await file.slice(offset, offset + CHUNK).arrayBuffer();
        channel.send(bytes);
        offset += bytes.byteLength;
        report('transferring');
      }
      if (offset === size) {
        channel.onbufferedamountlow = null;
        channel.send('done');
      }
    } catch (err) { fail(err.message); }
    finally { busy = false; }
  }
  if (file) {
    name = file.name;
    size = file.size;
    started = true;
    report('offering');
    let peerReady = false;
    let offered = false;
    const timer = setTimeout(() => fail('Peer did not open the transfer. Reconnect and try again.'), 20000);
    channel.addEventListener('close', () => clearTimeout(timer), { once: true });

    function startWhenReady() {
      if (offered || !peerReady || channel.readyState !== 'open') return;
      offered = true;
      clearTimeout(timer);
      try {
        channel.send(JSON.stringify({ name, size, mime, thumbnail, ...context, messageId: context.messageId || newMsgId() }));
        report('waiting');
      } catch (err) { fail(err.message); }
    }

    channel.onopen = startWhenReady;
    channel.onmessage = ({ data }) => {
      if (data === 'ready-v2') {
        peerReady = true;
        startWhenReady();
        return;
      }
      if (data === 'download' && offered && !downloading) {
        downloading = true;
        report('transferring');
        channel.onbufferedamountlow = pump;
        pump();
        return;
      }
      if (data !== 'received' || !downloading || offset !== size) return fail('Invalid file response.');
      started = false;
      report('delivered', file);
      channel.close();
    };
  } else {
    const announceReady = () => channel.send('ready-v2');
    if (channel.readyState === 'open') announceReady();
    else channel.onopen = announceReady;
    channel.onmessage = ({ data }) => {
      try {
        if (!started) {
          const meta = JSON.parse(data);
          if (typeof meta.name !== 'string' || !Number.isSafeInteger(meta.size) || meta.size < 0 || meta.size > MAX_FILE) return fail();
          name = meta.name.slice(0, 255);
          size = meta.size;
          mime = typeof meta.mime === 'string' ? meta.mime.slice(0, 128) : '';
          thumbnail = typeof meta.thumbnail === 'string' && meta.thumbnail.length <= 12000
            && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(meta.thumbnail) ? meta.thumbnail : '';
          started = true;
          context = { groupId: typeof meta.groupId === 'string' ? meta.groupId : '', messageId: typeof meta.messageId === 'string' ? meta.messageId : '', author: typeof meta.author === 'string' ? meta.author : '' };
          report('available');
          return;
        } else if (!downloading) {
          return fail('File was sent before download was requested.');
        } else if (data === 'done' && offset === size) {
          const blob = new Blob(parts, { type: mime });
          parts.length = 0;
          channel.send('received');
          started = false;
          report('received', blob);
          channel.onmessage = null;
          return;
        } else {
          if (!(data instanceof ArrayBuffer) || data.byteLength !== Math.min(CHUNK, size - offset) || !data.byteLength) return fail();
          parts.push(data);
          offset += data.byteLength;
        }
        report('transferring');
      } catch (err) { fail(err.message); }
    };
  }
}


