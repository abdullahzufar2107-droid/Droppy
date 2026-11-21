// Panel kanan: detail peer, Files, Privacy, Create Group (atau profil sendiri bila belum ada chat aktif).
import { icons } from '../icons.js';
import { avatarHTML, dotOf } from '../avatar.js';
import { chatOf, displayName, getPeer } from '../store.js';
import { escapeHtml } from '../../utils.js';

const FILE_GROUPS = [
  { key: 'doc', label: 'Documents', icon: icons.doc, cls: 'ficon--mint' },
  { key: 'image', label: 'Pictures', icon: icons.image, cls: 'ficon--blue' },
  { key: 'audio', label: 'Voice Clips', icon: icons.mic, cls: 'ficon--yellow' },
  { key: 'other', label: 'Other', icon: icons.moreDots, cls: 'ficon--red' },
];

const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(0)}MB` : `${Math.round(bytes / 1024)}KB`);

function fileStats(peerId) {
  const stats = Object.fromEntries(FILE_GROUPS.map((g) => [g.key, { n: 0, bytes: 0 }]));
  for (const m of chatOf(peerId)) {
    if (m.type !== 'file') continue; // pesan file akan ditambahkan oleh FileTransfer (No.3)
    const g = stats[m.kind] || stats.other;
    g.n++;
    g.bytes += m.size || 0;
  }
  return stats;
}

const section = (id, title, open, body) => `
  <section class="info__section">
    <button class="info__head" data-action="toggle-section" data-section="${id}">
      <span>${title}</span><span class="info__chev ${open ? '' : 'is-closed'}">${icons.chevronUp}</span>
    </button>
    ${open ? body : ''}
  </section>`;

export function renderInfo(el, s) {
  const p = getPeer(s.activeId);

  // Belum ada chat aktif: tampilkan profil sendiri + Peer ID
  if (!p) {
    el.innerHTML = `
      <div class="info__avatar">${avatarHTML({ id: s.me.peerId, name: s.me.name, size: 80, dot: s.visible && s.signal === 'online' ? 'online' : 'off' })}</div>
      <h2 class="info__name">${escapeHtml(s.me.name)}</h2>
      <p class="info__status">Your Peer ID</p>
      <div class="idchip" title="Share this code so others can add you">${escapeHtml(s.me.peerId)}</div>
      <button class="pill pill--wide" data-action="copy-id">${icons.copy} Copy ID</button>
      <div class="info__spacer"></div>
      <button class="pill pill--wide info__bottom" data-action="add-peer">${icons.userPlus} Add Peer</button>`;
    return;
  }

  const stats = fileStats(p.id);
  const files = FILE_GROUPS.map((g) => {
    const st = stats[g.key];
    return `
      <div class="frow">
        <span class="ficon ${g.cls}">${g.icon}</span>
        <div class="frow__text"><div class="frow__name">${g.label}</div><div class="frow__sub">${st.n} files${st.n ? `, ${sizeLabel(st.bytes)}` : ''}</div></div>
        <button class="icon-btn icon-btn--muted" data-action="soon" aria-label="More">${icons.kebab}</button>
      </div>`;
  }).join('');

  const privacy = `
    <div class="prow" data-action="privacy-mute">${icons.bell}<span>${p.muted ? 'Unmute Conversation' : 'Mute Conversation'}</span></div>
    <div class="prow" data-action="privacy-block">${icons.userPlus}<span>${p.blocked ? 'Unblock User' : 'Block User'}</span></div>
    <div class="prow" data-action="privacy-reconnect">${icons.alert}<span>Something's wrong</span></div>
    <div class="prow" data-action="privacy-delete">${icons.trash}<span>Delete Conversation</span></div>`;

  const route =
    p.status === 'online'
      ? `<p class="info__route">${p.route === 'relay' ? 'Relay connection' : 'Direct connection'}${p.rtt != null ? ` · ${p.rtt} ms` : ''}</p>`
      : '';

  el.innerHTML = `
    <div class="info__avatar">${avatarHTML({ id: p.id, name: displayName(p), size: 80, dot: dotOf(p.status) })}</div>
    <h2 class="info__name" title="${escapeHtml(displayName(p))}">${escapeHtml(displayName(p))}</h2>
    <p class="info__status">${p.status === 'online' ? 'Active Now' : p.status === 'connecting' ? 'Connecting…' : 'Offline'}</p>
    ${route}
    <button class="pill pill--wide" data-action="edit-details">${icons.edit} Edit details</button>
    ${section('files', 'Files', !s.collapsed.files, `<div class="files">${files}</div>`)}
    ${section('privacy', 'Privacy', !s.collapsed.privacy, `<div class="privacy">${privacy}</div>`)}
    <div class="info__spacer"></div>
    <button class="pill pill--wide info__bottom" data-action="create-group">${icons.users} Create Group</button>`;
}
