// Daftar "Recent": satu kartu per peer.
import { avatarHTML, dotOf } from '../avatar.js';
import { displayName, lastMessage, unreadCount } from '../store.js';
import { escapeHtml, shortAgo } from '../../utils.js';

function statusLine(p) {
  if (p.status === 'online') return p.route === 'relay' ? 'Online · via relay' : 'Online · direct';
  if (p.status === 'connecting') return 'Connecting…';
  return 'Offline';
}

export function renderPeerList(el, s) {
  const q = s.search.trim().toLowerCase();

  const items = s.peers
    .filter((p) => !q || displayName(p).toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    .map((p) => ({ p, last: lastMessage(p.id) }))
    .sort((a, b) => (b.last?.ts || b.p.lastSeen || 0) - (a.last?.ts || a.p.lastSeen || 0));

  if (!items.length) {
    el.innerHTML = `<div class="empty-list">${
      s.peers.length ? 'No peers match your search.' : 'No conversations yet.<br>Press <b>+</b> to add a peer with their code.'
    }</div>`;
    return;
  }

  el.innerHTML = items
    .map(({ p, last }) => {
      const unread = p.id === s.activeId ? 0 : unreadCount(p);
      const preview = last ? `${last.dir === 'out' ? 'You: ' : ''}${last.text}` : statusLine(p);
      const when = last ? shortAgo(last.ts) : p.status === 'offline' && p.lastSeen ? shortAgo(p.lastSeen) : '';
      return `
      <article class="peer-card ${p.id === s.activeId ? 'is-active' : ''}" data-action="select-peer" data-id="${p.id}" tabindex="0">
        ${avatarHTML({ id: p.id, name: displayName(p), size: 50, dot: dotOf(p.status) })}
        <div class="peer-card__body">
          <div class="peer-card__name">${escapeHtml(displayName(p))}</div>
          <div class="peer-card__preview">${escapeHtml(preview)}</div>
        </div>
        <div class="peer-card__meta">
          <span class="peer-card__time">${when}</span>
          ${unread ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : ''}
        </div>
      </article>`;
    })
    .join('');
}
