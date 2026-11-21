// Panel tengah: header peer + daftar pesan.
import { icons } from '../icons.js';
import { avatarHTML, dotOf } from '../avatar.js';
import { chatOf, displayName, getPeer } from '../store.js';
import { dateLabel, dayKey, escapeHtml, timeAgo } from '../../utils.js';

const STATUS_TEXT = { pending: 'Waiting for peer…', sent: 'Sent', delivered: 'Delivered', failed: 'Not delivered' };

export function renderChatHeader(el, s) {
  const p = getPeer(s.activeId);
  if (!p) return void (el.innerHTML = '');
  const typing = (s.typing[p.id] || 0) > Date.now();
  const sub = typing ? 'typing…' : p.status === 'online' ? 'Active Now' : p.status === 'connecting' ? 'Connecting…' : 'Offline';

  el.innerHTML = `
    <button class="icon-btn chat__back" data-action="back" aria-label="Back">${icons.chevronLeft}</button>
    ${avatarHTML({ id: p.id, name: displayName(p), size: 48, dot: dotOf(p.status) })}
    <div class="chat__who">
      <div class="chat__name">${escapeHtml(displayName(p))}</div>
      <div class="chat__sub ${typing ? 'is-typing' : ''}">${sub}</div>
    </div>
    <div class="chat__actions">
      <button class="icon-btn" data-action="call-soon" aria-label="Voice call" title="Calls come later">${icons.phone}</button>
      <button class="icon-btn has-dot" data-action="call-soon" aria-label="Video call" title="Calls come later">${icons.video}${p.status === 'online' ? '<i class="mini-dot"></i>' : ''}</button>
    </div>`;
}

export function renderMessages(el, s) {
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
    html += `
      <div class="msg msg--${m.dir === 'out' ? 'out' : 'in'} ${tight ? 'is-tight' : ''}">
        <div class="bubble">${escapeHtml(m.text)}</div>
        ${tight ? '' : `<div class="msg__time">${timeAgo(m.ts)}${status}</div>`}
      </div>`;
  });
  el.innerHTML = html;
}
