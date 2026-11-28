// Small helpers shared by every view.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

// Dates are stored as YYYY-MM-DD strings (local), timestamps as ISO strings.
export function todayStr() { return dateStr(new Date()); }
export function dateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
export function addDays(s, n) { const d = parseDate(s); if (!d) return ''; d.setDate(d.getDate() + n); return dateStr(d); }
export function addYears(s, n) { const d = parseDate(s); if (!d) return ''; d.setFullYear(d.getFullYear() + n); return dateStr(d); }
export function daysUntil(s) { const d = parseDate(s); if (!d) return null; const t = parseDate(todayStr()); return Math.round((d - t) / 86400000); }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(s) { const d = parseDate(s); return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : ''; }
export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
}
export function fmtMoney(v) {
  if (v === '' || v == null || isNaN(+v)) return '';
  return (+v).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// MAC addresses are stored as AA:BB:CC:DD:EE:FF whatever the input format.
export function normMac(v) {
  const hex = String(v || '').replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g).join(':');
}
export function isIPv4(v) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  return !!m && m.slice(1).every((n) => +n <= 255 && String(+n) === n);
}
export function isIPv6(v) {
  if (!/^[0-9a-f:.]+$/i.test(v) || !v.includes(':')) return false;
  if ((v.match(/::/g) || []).length > 1) return false;
  const parts = v.split(':');
  return parts.length >= 3 && parts.length <= 8 && parts.every((p) => p === '' || /^[0-9a-f]{1,4}$/i.test(p) || isIPv4(p));
}
export const isIP = (v) => isIPv4(v) || isIPv6(v);
// Sort key that orders IPv4 addresses numerically
export function ipSortKey(v) {
  if (isIPv4(v)) return v.split('.').map((n) => n.padStart(3, '0')).join('.');
  return 'z' + (v || '');
}

// CSV (RFC 4180): quoted fields, embedded commas, quotes and newlines.
export function parseCSV(text) {
  const rows = []; let row = []; let f = ''; let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}
export function toCSV(rows) {
  return rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
}

export function download(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// Natural compare so "EU-0010" sorts after "EU-0009" and numbers sort numerically.
const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export function cmp(a, b) {
  const ea = a === '' || a == null, eb = b === '' || b == null;
  if (ea && eb) return 0; if (ea) return 1; if (eb) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return coll.compare(String(a), String(b));
}

// Shrinks a photo so device storage stays small. Returns { full, thumb } Blobs.
export async function shrinkImage(file, max = 1600, thumbMax = 360) {
  const bmp = await loadImage(file);
  const make = (m, q) => {
    const s = Math.min(1, m / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob(r, 'image/jpeg', q));
  };
  return { full: await make(max, 0.85), thumb: await make(thumbMax, 0.8), width: bmp.width, height: bmp.height };
}
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => reject(new Error('That file could not be read as a picture.'));
    img.src = url;
  });
}
export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
}
export async function dataURLToBlob(url) { return (await fetch(url)).blob(); }
