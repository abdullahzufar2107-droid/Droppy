// Profil sendiri + toggle "Active Status" (kolom kiri atas).
import { icons } from '../icons.js';
import { avatarHTML } from '../avatar.js';
import { escapeHtml } from '../../utils.js';

export function renderProfile(el, s) {
  const online = s.visible && s.signal === 'online';
  const dot = !s.visible ? 'off' : s.signal === 'online' ? 'online' : 'busy';
  const label = !s.visible ? 'Invisible' : s.signal === 'online' ? 'Active Status' : s.signal === 'connecting' ? 'Connecting…' : 'Offline';

  el.innerHTML = `
    ${avatarHTML({ id: s.me.peerId, name: s.me.name, size: 80, dot })}
    <div class="profile__main">
      <div class="profile__name" title="${escapeHtml(s.me.name)}">${escapeHtml(s.me.name)}</div>
      <div class="profile__status">
        <span>${label}</span>
        <button class="toggle ${s.visible ? 'is-on' : ''}" data-action="toggle-visible" aria-label="Toggle active status" aria-pressed="${s.visible}"></button>
      </div>
    </div>
    <button class="icon-btn profile__gear" data-action="edit-name" aria-label="Edit your name" title="Edit your name">${icons.gear}</button>
  `;
  el.dataset.online = online;
}
