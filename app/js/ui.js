// Shared UI pieces: icons, pills, photo tiles, modal dialogs and toasts.
import { ICONS, iconKey, CONDITIONS, LIFECYCLES } from './schema.js';
import { esc, $ } from './util.js';
import { blobURL } from './store.js';

export function ico(k, sw = 1.5) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.desktop}</svg>`;
}
const UI_ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h3v3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v4M12 18h.01"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  devices: '<rect x="3" y="4" width="13" height="10" rx="1.5"/><path d="M7 18h5M9.5 14v4"/><rect x="17" y="8" width="4" height="10" rx="1"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  pin: '<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  file: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
};
export function ui(k, size = 14, sw = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI_ICONS[k] || ''}</svg>`;
}

export const condTone = (c) => CONDITIONS[c] || 'off';
export const lifeTone = (l) => LIFECYCLES[l] || 'off';
export const pill = (text, tone, nodot) => text ? `<span class="pill c-${tone}${nodot ? ' nodot' : ''}">${esc(text)}</span>` : '';
export const condPill = (d) => pill(d.condition, condTone(d.condition));
export const lifePill = (d) => pill(d.lifecycle, lifeTone(d.lifecycle), true);
// Pin and dot color: condition first, then lifecycle for spares and retired gear
export function pinTone(d) {
  if (['Retired', 'Disposed'].includes(d.lifecycle)) return 'off';
  const c = condTone(d.condition);
  if (c === 'ok' && d.lifecycle === 'Hot Spare') return 'info';
  return c;
}

// A photo tile: real thumbnail when the device has one, else a line drawing.
// Images load lazily via data-blob so lists stay fast.
export function photoBox(d, cls = '', big = false) {
  const p = (d.photos || [])[0];
  const id = p ? (big ? p.id : p.thumb || p.id) : '';
  return `<div class="photo ${cls}">${id ? `<img data-blob="${esc(id)}" alt="">` : ico(iconKey(d), 1.2)}</div>`;
}
export async function hydrateImages(root = document) {
  for (const img of root.querySelectorAll('img[data-blob]:not([src])')) {
    const u = await blobURL(img.dataset.blob);
    if (u) img.src = u; else img.replaceWith(document.createRange().createContextualFragment(''));
  }
}

let toastT;
export function toast(msg, ms = 2600) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms);
}

// Modal dialog. Returns { el, close }. onClose runs when dismissed.
export function modal(html, { wide = false, onClose, cls = '' } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(scrim);
  document.body.classList.add('noscroll');
  const prevFocus = document.activeElement;
  const close = () => {
    scrim.remove();
    if (!document.querySelector('.scrim')) document.body.classList.remove('noscroll');
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape' && document.querySelector('.scrim:last-of-type') === scrim) close(); };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  scrim.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const f = scrim.querySelector('[autofocus], input, select, textarea, button:not([data-close])');
  setTimeout(() => f?.focus(), 30);
  return { el: scrim.querySelector('.modal'), close };
}

export function confirmBox(title, body, { ok = 'OK', danger = false, cancel = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal(`
      <div class="m-head"><div><h2>${esc(title)}</h2></div></div>
      <div class="m-pad">${body}</div>
      <div class="lfoot"><button class="btn" data-close>${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button></div>`,
    { onClose: () => { if (!answered) resolve(false); } });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; m.close(); resolve(true); });
  });
}

export function emptyState(title, body, actions = '') {
  return `<div class="emptybox"><div class="eb-ico">${ui('devices', 26, 1.6)}</div><h3>${esc(title)}</h3><p>${body}</p><div class="actions" style="justify-content:center">${actions}</div></div>`;
}
