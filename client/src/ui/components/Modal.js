// Modal (tambah peer, ganti nama, konfirmasi) + toast.
import { icons } from '../icons.js';
import { copyText, escapeHtml } from '../../utils.js';

const root = () => document.getElementById('modalRoot');

let closeCurrent = null;

function open(html, onMount) {
  closeCurrent?.();
  const el = root();
  el.innerHTML = `<div class="overlay" data-overlay><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const overlay = el.firstElementChild;
  const close = () => {
    el.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    if (closeCurrent === close) closeCurrent = null;
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => e.target === overlay && close());
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  closeCurrent = close;
  onMount(overlay.firstElementChild, close);
  return close;
}

export function toast(message, kind = 'info') {
  const host = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast toast--${kind}`;
  t.textContent = message;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => {
    t.classList.remove('is-in');
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

/** Dialog tambah peer. onSubmit(kode) -> Promise<string|null> (pesan error, atau null bila sukses). */
export function addPeerModal({ myId, onSubmit }) {
  const link = `${location.origin}/?peer=${myId}`;
  open(
    `
    <button class="modal__x" data-close aria-label="Close">${icons.close}</button>
    <h2 class="modal__title">Add peer</h2>
    <p class="modal__hint">Share your code, or enter your friend's code. It works across different networks, not only the same WiFi.</p>
    <div class="codebox">
      <div><small>Your code</small><strong>${escapeHtml(myId)}</strong></div>
      <div class="codebox__btns">
        <button type="button" class="pill pill--sm" data-copy="${escapeHtml(myId)}">Copy code</button>
        <button type="button" class="pill pill--sm" data-copy="${escapeHtml(link)}">Copy link</button>
      </div>
    </div>
    <form class="modal__form" autocomplete="off">
      <input class="field" name="code" maxlength="8" placeholder="Enter peer code" spellcheck="false" />
      <button class="btn-primary" type="submit">Connect</button>
    </form>
    <p class="modal__error" hidden></p>`,
    (el, close) => {
      const form = el.querySelector('form');
      const input = form.code;
      const err = el.querySelector('.modal__error');
      const btn = form.querySelector('button');
      input.focus();
      input.addEventListener('input', () => {
        input.value = input.value.toUpperCase();
        err.hidden = true;
      });
      el.querySelectorAll('[data-copy]').forEach((b) =>
        b.addEventListener('click', async () => toast((await copyText(b.dataset.copy)) ? 'Copied to clipboard' : 'Could not copy', 'info'))
      );
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        btn.disabled = true;
        btn.textContent = 'Connecting…';
        const message = await onSubmit(input.value);
        if (message) {
          err.textContent = message;
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Connect';
        } else {
          close();
        }
      });
    }
  );
}

/** Dialog input teks satu baris. Mengembalikan Promise<string|null>. */
export function promptModal({ title, label, value = '', placeholder = '', confirmText = 'Save', maxLength = 32 }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    open(
      `
      <button class="modal__x" data-close aria-label="Close">${icons.close}</button>
      <h2 class="modal__title">${escapeHtml(title)}</h2>
      <form class="modal__form modal__form--stack" autocomplete="off">
        <label class="modal__label">${escapeHtml(label)}</label>
        <input class="field" name="v" maxlength="${maxLength}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" />
        <div class="modal__row">
          <button type="button" class="pill" data-close>Cancel</button>
          <button class="btn-primary" type="submit">${escapeHtml(confirmText)}</button>
        </div>
      </form>`,
      (el, close) => {
        const form = el.querySelector('form');
        form.v.focus();
        form.v.select();
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          finish(form.v.value.trim());
          close();
        });
        el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => finish(null)));
        el.parentElement.addEventListener('mousedown', (e) => e.target === el.parentElement && finish(null));
        document.addEventListener('keydown', (e) => e.key === 'Escape' && finish(null), { once: true });
      }
    );
  });
}

/** Dialog konfirmasi. Mengembalikan Promise<boolean>. */
export function confirmModal({ title, text, confirmText = 'Confirm' }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    open(
      `
      <button class="modal__x" data-close aria-label="Close">${icons.close}</button>
      <h2 class="modal__title">${escapeHtml(title)}</h2>
      <p class="modal__hint">${escapeHtml(text)}</p>
      <div class="modal__row">
        <button type="button" class="pill" data-close>Cancel</button>
        <button type="button" class="btn-primary btn-danger" data-ok>${escapeHtml(confirmText)}</button>
      </div>`,
      (el, close) => {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          finish(true);
          close();
        });
        el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => finish(false)));
        el.parentElement.addEventListener('mousedown', (e) => e.target === el.parentElement && finish(false));
        document.addEventListener('keydown', (e) => e.key === 'Escape' && finish(false), { once: true });
      }
    );
  });
}

export function createGroupModal({ peers, maxMembers, onCreate }) {
  open(`
    <button class="modal__x" data-close aria-label="Close">${icons.close}</button>
    <h2 class="modal__title">Create group</h2>
    <form class="group-form">
      <label>Group name <input class="field" name="title" maxlength="48" required></label>
      <fieldset class="group-members">
        <legend>Choose 2–${maxMembers} peers</legend>
        ${peers.map(peer => `<label><input type="checkbox" name="member" value="${escapeHtml(peer.id)}"> ${escapeHtml(peer.alias || peer.name)}</label>`).join('')}
      </fieldset>
      <p class="modal__error" hidden></p>
      <button class="btn-primary" type="submit">Create group</button>
    </form>`, (modal, close) => {
    const form = modal.querySelector('form');
    form.elements.title.focus();
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const name = data.get('title').trim();
      const selected = data.getAll('member');
      if (name && selected.length >= 2 && selected.length <= maxMembers && onCreate(name, selected)) return close();
      const error = form.querySelector('.modal__error');
      error.textContent = `Enter a group name and choose 2–${maxMembers} peers.`;
      error.hidden = false;
    });
  });
}
