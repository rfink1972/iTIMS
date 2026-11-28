// Photo view: every device as a photo tile, grouped by any field.
import { state, columns, displayValue, sortDevices, primaryIface, isActive } from '../store.js';
import { esc } from '../util.js';
import { photoBox, pinTone, emptyState, hydrateImages } from '../ui.js';
import { searchFilter } from '../app.js';
import { openDevice } from './device.js';

const LS = 'itims.photos';
const prefs = Object.assign({ group: 'room', sort: 'asset', size: 2, onlyPhotos: false, hideRetired: true },
  (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })());
const save = () => { try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch { /* ignore */ } };

const GROUPABLE = ['', 'sectionName', 'type', 'room', 'floor', 'building', 'site', 'assignedUser', 'owner', 'condition', 'lifecycle', 'criticality', 'make', 'vendor', 'yearAcquired', 'vlan'];

export function renderPhotos(el) {
  if (!state.devices.length) { el.innerHTML = `<section class="card">${emptyState('No devices yet', 'Add devices with photos to see them here.', '<a class="btn primary" href="#/add/EU">Add device</a>')}</section>`; return; }
  let list = searchFilter(state.devices);
  if (prefs.hideRetired) list = list.filter(isActive);
  if (prefs.onlyPhotos) list = list.filter((d) => d.photos?.length);
  list = sortDevices(list, prefs.sort);
  const groups = new Map();
  for (const d of list) {
    const k = prefs.group ? displayValue(d, prefs.group) || '(none)' : 'All devices';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '(none)') - (b === '(none)') || a.localeCompare(b, undefined, { numeric: true }));
  const cols = columns();
  const opt = (k, sel) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k ? esc(cols.find((c) => c.key === k)?.label || k) : 'No grouping'}</option>`;
  const withPhotos = list.filter((d) => d.photos?.length).length;
  el.innerHTML = `<section class="card">
    <div class="ph-bar">
      <label for="phg">Group by</label><select id="phg">${GROUPABLE.map((k) => opt(k, prefs.group)).join('')}</select>
      <label for="phs">Sort</label><select id="phs">${['asset', 'hostname', 'type', 'room', 'condition', 'dateAcquired'].map((k) => opt(k, prefs.sort)).join('')}</select>
      <label for="phz">Size</label><input id="phz" type="range" min="1" max="3" value="${prefs.size}">
      <label class="chkline" style="display:flex;gap:5px;align-items:center;font-weight:500"><input type="checkbox" id="pho" ${prefs.onlyPhotos ? 'checked' : ''}> Only with photos</label>
      <label class="chkline" style="display:flex;gap:5px;align-items:center;font-weight:500"><input type="checkbox" id="phr" ${prefs.hideRetired ? 'checked' : ''}> Hide retired</label>
      <span class="grow">${list.length} device${list.length === 1 ? '' : 's'} · ${withPhotos} with photos</span>
    </div>
    <div class="ph-body ph-s${prefs.size}">
      ${keys.length ? keys.map((k) => `<div class="ph-group"><h3>${esc(k)} <small>${groups.get(k).length}</small></h3><div class="ph-grid">
        ${groups.get(k).map((d) => { const p = primaryIface(d); return `<button class="ph" data-uid="${d.uid}" title="${esc(d.asset)} · ${esc(d.hostname || d.type)}">
          ${photoBox(d)}<span class="dot" style="background:var(--${pinTone(d)})"></span>
          <span class="cap"><b>${esc(d.hostname || `${d.make} ${d.model}`)}</b><span>${esc(d.asset)}</span>${p ? `<span class="net">${esc(p.ip || '')}${p.mac ? '<br>' + esc(p.mac) : ''}</span>` : ''}</span></button>`; }).join('')}
      </div></div>`).join('') : '<div class="empty">No devices match.</div>'}
    </div></section>`;
  const q = (s) => el.querySelector(s);
  q('#phg').onchange = (e) => { prefs.group = e.target.value; save(); renderPhotos(el); hydrateImages(el); };
  q('#phs').onchange = (e) => { prefs.sort = e.target.value; save(); renderPhotos(el); hydrateImages(el); };
  q('#phz').oninput = (e) => { prefs.size = +e.target.value; save(); q('.ph-body').className = `ph-body ph-s${prefs.size}`; };
  q('#pho').onchange = (e) => { prefs.onlyPhotos = e.target.checked; save(); renderPhotos(el); hydrateImages(el); };
  q('#phr').onchange = (e) => { prefs.hideRetired = e.target.checked; save(); renderPhotos(el); hydrateImages(el); };
  el.querySelectorAll('.ph').forEach((b) => b.onclick = () => openDevice(b.dataset.uid));
}
