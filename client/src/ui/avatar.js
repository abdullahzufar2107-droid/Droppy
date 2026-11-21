// Avatar bulat dengan inisial + warna gradien yang konsisten per peer + titik status.
import { escapeHtml } from '../utils.js';

const PALETTE = [
  ['#ff9a8b', '#ff6a88'],
  ['#a18cd1', '#7f6ad8'],
  ['#5fd3b8', '#2aa6c9'],
  ['#f6c667', '#f2895e'],
  ['#6ee7a0', '#2bb98f'],
  ['#fa8bb0', '#f5b85a'],
  ['#4fc3e8', '#6b7be8'],
  ['#e58cf0', '#f26c88'],
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  const text = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2);
  return text.toUpperCase();
}

/**
 * @param {{id:string,name:string,size?:number,dot?:'online'|'busy'|'off'|null}} o
 */
export function avatarHTML({ id, name, size = 50, dot = null }) {
  const [a, b] = PALETTE[hash(id || name) % PALETTE.length];
  const dotSize = Math.max(11, Math.round(size * 0.2));
  return `<span class="avatar" style="--s:${size}px;--dot:${dotSize}px;background:linear-gradient(135deg,${a},${b})">${escapeHtml(initials(name))}${dot ? `<i class="dot dot--${dot}"></i>` : ''}</span>`;
}

/** Status peer -> warna titik */
export const dotOf = (status) => (status === 'online' ? 'online' : status === 'connecting' ? 'busy' : 'off');
