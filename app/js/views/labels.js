// QR asset labels: preview, choose size and lines, print one or many.
import { state, byUid, primaryIface } from '../store.js';
import { esc } from '../util.js';
import { ui, modal, toast } from '../ui.js';

const SIZES = {
  '2x1': { w: 2, h: 1, name: '2 × 1 in (most label printers)' },
  '1x1': { w: 1, h: 1, name: '1 × 1 in square', sq: true },
  '3x2': { w: 3, h: 2, name: '3 × 2 in large' },
  '1.25x0.5': { w: 1.25, h: 0.5, name: '1.25 × 0.5 in small' },
};
const LINES = [['hostname', 'Hostname'], ['model', 'Make and model'], ['ip', 'Primary IP'], ['room', 'Location'], ['org', 'Organization name'], ['help', '"Property of IT" line']];
const LS = 'itims.labels';
const prefs = Object.assign({ size: '2x1', lines: ['hostname', 'model'], qr: 'asset', layout: 'printer' },
  (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })());
const save = () => { try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch { /* ignore */ } };

export function qrSvg(text) {
  if (typeof window.qrcode !== 'function') return '';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
export const deviceLink = (d) => `${location.origin}${location.pathname}#/device/${d.asset}`;

function lineText(d, k) {
  switch (k) {
    case 'hostname': return d.hostname || d.type;
    case 'model': return [d.make, d.model].filter(Boolean).join(' ');
    case 'ip': return primaryIface(d)?.ip || '';
    case 'room': return [d.building, d.room].filter(Boolean).join(' · ');
    case 'org': return state.settings.orgName || '';
    case 'help': return `Property of ${state.settings.orgName || 'IT'}`;
    default: return '';
  }
}

export function labelHtml(d, p = prefs) {
  const s = SIZES[p.size];
  // Font sizes scale with label height so text fits
  const base = s.h <= 0.5 ? 6 : s.h <= 1 ? (s.sq ? 7 : 8.5) : 12;
  const maxLines = s.h <= 0.5 ? 1 : s.sq ? 2 : s.h <= 1 ? 3 : 5;
  const lines = p.lines.map((k) => lineText(d, k)).filter(Boolean).slice(0, maxLines);
  return `<div class="label${s.sq ? ' sq' : ''}" style="width:${s.w}in;height:${s.h}in;font-size:${base}pt;padding:${s.h <= 0.5 ? 2 : 5}pt">
    <div class="qr">${qrSvg(p.qr === 'link' ? deviceLink(d) : d.asset)}</div>
    <div class="lt"><div class="la" style="font-size:${base * 1.35}pt">${esc(d.asset)}</div>${lines.map((l, i) => `<div class="${i ? 'ls' : 'lh'}">${esc(l)}</div>`).join('')}</div>
  </div>`;
}

export function openLabels(uids) {
  const list = uids.map(byUid).filter(Boolean);
  if (!list.length) { toast('Pick at least one device.'); return; }
  const m = modal(`<div class="m-head"><div><h2>Print ${list.length === 1 ? `label for ${esc(list[0].asset)}` : `${list.length} labels`}</h2><p class="kv-mini" style="margin:0">Scanning the QR code in iTIMS opens the device.</p></div><button class="x" data-close aria-label="Close">×</button></div>
    <div class="lab-grid">
      <div class="paper-wrap" style="display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start;justify-content:center;max-height:60vh;overflow:auto" data-prev></div>
      <div class="lopts">
        <div><label for="lsz">Label size</label><select id="lsz">${Object.entries(SIZES).map(([k, s]) => `<option value="${k}" ${k === prefs.size ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
        <div><h4>Lines under the asset number</h4><div class="ck">${LINES.map(([k, l]) => `<label><input type="checkbox" value="${k}" ${prefs.lines.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
        <div><h4>QR code holds</h4><div class="opt">
          <label><input type="radio" name="qr" value="asset" ${prefs.qr === 'asset' ? 'checked' : ''}> Asset number (works with any scanner)</label>
          <label><input type="radio" name="qr" value="link" ${prefs.qr === 'link' ? 'checked' : ''}> Link to the device page</label></div></div>
        <div><h4>Printer</h4><div class="opt">
          <label><input type="radio" name="layout" value="printer" ${prefs.layout === 'printer' ? 'checked' : ''}> Label printer (one label per page)</label>
          <label><input type="radio" name="layout" value="sheet" ${prefs.layout === 'sheet' ? 'checked' : ''}> Letter paper sheet (cut or label stock)</label></div></div>
        <p class="rp-hint">In the print window, set margins to None and scale to 100%. For a label printer, pick its label size as the paper size.</p>
      </div>
    </div>
    <div class="lfoot"><button class="btn" data-close>Cancel</button><button class="btn primary" data-print>${ui('print', 13)}Print</button></div>`, { wide: true });
  const prev = m.el.querySelector('[data-prev]');
  const draw = () => { prev.innerHTML = list.slice(0, 60).map((d) => labelHtml(d)).join('') + (list.length > 60 ? `<p class="kv-mini">…and ${list.length - 60} more</p>` : ''); };
  draw();
  m.el.querySelector('#lsz').onchange = (e) => { prefs.size = e.target.value; save(); draw(); };
  m.el.querySelectorAll('.ck input').forEach((c) => c.onchange = () => { prefs.lines = [...m.el.querySelectorAll('.ck input:checked')].map((x) => x.value); save(); draw(); });
  m.el.querySelectorAll('input[name=qr],input[name=layout]').forEach((r) => r.onchange = () => { prefs[r.name] = r.value; save(); draw(); });
  m.el.querySelector('[data-print]').onclick = () => printLabels(list);
}

export function printLabels(list) {
  const s = SIZES[prefs.size];
  document.getElementById('pageSize')?.remove();
  const area = document.getElementById('printArea');
  area.innerHTML = `<div class="lbl-sheet ${prefs.layout === 'sheet' ? 'grid' : ''}">${list.map((d) => labelHtml(d)).join('')}</div>`;
  const page = document.createElement('style');
  page.id = 'pageSize';
  page.textContent = prefs.layout === 'sheet' ? '@page{size:letter;margin:0.5in}' : `@page{size:${s.w}in ${s.h}in;margin:0}`;
  document.head.appendChild(page);
  document.body.classList.add('printing-labels');
  const done = () => { document.body.classList.remove('printing-labels'); page.remove(); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}
