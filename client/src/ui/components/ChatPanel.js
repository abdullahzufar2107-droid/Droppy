import { photoType } from '../photo.js';
// Panel tengah: header peer + daftar pesan.
import { icons } from '../icons.js';
import { avatarHTML, dotOf } from '../avatar.js';
import { chatOf, displayName, getPeer } from '../store.js';
import { dateLabel, dayKey, escapeHtml, timeAgo } from '../../utils.js';

const STATUS_TEXT = { offering: 'Preparing file…', waiting: 'Waiting for download', transferring: 'Sending…', pending: 'Waiting for peer…', sent: 'Sent', delivered: 'Delivered', failed: 'Not delivered' };

export function renderChatHeader(el, s) {
  const p = getPeer(s.activeId);
  if (!p) return void (el.innerHTML = '');
  const typing = (s.typing[p.id] || 0) > Date.now();
  const sub = p.members ? `${p.members.length} members` : typing ? 'typing…' : p.status === 'online' ? 'Active Now' : p.status === 'connecting' ? 'Connecting…' : 'Offline';

  el.innerHTML = `
    <button class="icon-btn chat__back" data-action="back" aria-label="Back">${icons.chevronLeft}</button>
    ${avatarHTML({ id: p.id, name: displayName(p), size: 48, dot: dotOf(p.status) })}
    <div class="chat__who">
      <div class="chat__name">${escapeHtml(displayName(p))}</div>
      <div class="chat__sub ${typing ? 'is-typing' : ''}">${sub}</div>
    </div>
    ${p.members ? '' : `<div class="chat__actions">
      <button class="icon-btn" data-action="call-soon" aria-label="Voice call" title="Calls come later">${icons.phone}</button>
      <button class="icon-btn has-dot" data-action="call-soon" aria-label="Video call" title="Calls come later">${icons.video}${p.status === 'online' ? '<i class="mini-dot"></i>' : ''}</button>
    </div>`}`;
}

const previews = new Map();
const mediaURLs = new Map();

export function renderMessages(el, s) {
  const visible = new Set(s.activeId ? chatOf(s.activeId).map(m => m.blob).filter(Boolean) : []);
  for (const [blob, url] of previews) {
    if (!visible.has(blob)) {
      URL.revokeObjectURL(url);
      previews.delete(blob);
    }
  }
  for (const [blob, url] of mediaURLs) {
    if (!visible.has(blob)) {
      URL.revokeObjectURL(url);
      mediaURLs.delete(blob);
    }
  }
  const p = getPeer(s.activeId);
  if (!p) {
    el.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty__logo">${icons.logo}</div>
        <h2>Droppy</h2>
        <p>Select a conversation, or press <b>+</b> to add a peer with their code.</p>
      </div>`;
    return;
  }

  const list = chatOf(p.id);
  if (!list.length) {
    el.innerHTML = `<div class="chat-empty chat-empty--small"><p>No messages yet.<br>Say hi to ${escapeHtml(displayName(p))}!</p></div>`;
    return;
  }

  let html = '';
  let prevDay = null;
  list.forEach((m, i) => {
    const next = list[i + 1];
    const day = dayKey(m.ts);
    if (prevDay !== null && day !== prevDay) html += `<div class="date-sep">${dateLabel(m.ts)}</div>`;
    prevDay = day;

    // Pesan beruntun dari pihak yang sama digabung: label waktu hanya di pesan terakhir grup
    const tight = next && next.dir === m.dir && next.ts - m.ts < 120000 && dayKey(next.ts) === day;
    const status = m.dir === 'out' ? ` · ${STATUS_TEXT[m.status] || ''}` : '';
    const mime = photoType(m);
    if (mime && !previews.has(m.blob)) {
      previews.set(m.blob, URL.createObjectURL(m.blob.slice(0, m.blob.size, mime)));
    }
    const photo = mime ? previews.get(m.blob) : m.thumbnail;
    const audio = m.blob?.type.startsWith('audio/');
    if (audio && !mediaURLs.has(m.blob)) mediaURLs.set(m.blob, URL.createObjectURL(m.blob));
    const available = m.status === 'available';
    const progress = m.status === 'transferring' && !m.blob;
    const failed = m.status === 'failed' && !m.blob;
    const controls = available || m.blob
      ? `<button type="button" data-action="download-file" data-id="${escapeHtml(m.id)}">${available ? '↓ Download' : '↓ Save'}</button>`
      : progress ? `<progress aria-label="Downloading file" max="100" value="${m.percent}"></progress> ${m.percent}%`
        : failed ? escapeHtml(m.error || 'Transfer interrupted') : '';

    const image = photo ? `<img class="chat-photo" src="${photo}" alt="${mime ? 'Shared photo' : 'Photo preview'}">` : '';
    const content = photo
      ? `<div class="photo-frame${mime ? '' : ' photo-frame--pending'}">
          ${mime ? `<button type="button" class="photo-open" data-action="view-photo" data-id="${escapeHtml(m.id)}" aria-label="View photo fullscreen">${image}</button>` : image}
          <div class="photo-controls">${controls}</div>
        </div>`
      : audio
        ? `<audio controls preload="metadata" src="${mediaURLs.get(m.blob)}"></audio><div>${controls}</div>`
      : m.type === 'file'
        ? `<div>${escapeHtml(m.text)} <small>· ${Math.ceil(m.size / 1024)} KB</small></div><div>${controls}</div>`
        : escapeHtml(m.text);

    html += `
      <div class="msg msg--${m.dir === 'out' ? 'out' : 'in'} ${tight ? 'is-tight' : ''} ${photo ? 'msg--photo' : ''}">
        ${m.author ? `<div class="msg__author">${escapeHtml(m.author)}</div>` : ''}
        <div class="bubble${photo ? ' bubble--photo' : m.type === 'file' ? ' bubble--file' : ''}">${content}</div>
        ${tight ? '' : `<div class="msg__time">${timeAgo(m.ts)}${status}</div>`}
      </div>`;
  });
  el.innerHTML = html;
}
