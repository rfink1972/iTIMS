// iTIMS entry point: loads data, draws the header, routes between views and
// runs the global search box.
import { load, state, onChange, isIssue, maintDue, warrantySoon, byAsset, matches, searchRank, whereMatched, sortDevices } from './store.js';
import { requestPersistence } from './db.js';
import { SECTIONS } from './schema.js';
import { $, esc } from './util.js';
import { ui, pill, photoBox, hydrateImages, condPill, toast } from './ui.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPhotos } from './views/photos.js';
import { renderFloorplan } from './views/floorplan.js';
import { renderReports } from './views/reports.js';
import { renderSettings } from './views/settings.js';
import { openDevice } from './views/device.js';
import { openForm } from './views/form.js';
import { openScanner } from './views/scan.js';

export const app = {
  q: '',
  route: { view: 'dash', param: '' },
  rerender: () => {},
};

const VIEWS = { dash: renderDashboard, photos: renderPhotos, floorplan: renderFloorplan, reports: renderReports, settings: renderSettings };

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [view, ...rest] = h.split('/');
  return { view: view || 'dash', param: decodeURIComponent(rest.join('/')) };
}

let baseView = 'dash';
function route() {
  const r = parseHash();
  if (r.view === 'device' || r.view === 'add' || r.view === 'edit') {
    // Modal routes draw on top of the last base view
    if (!$('#view').dataset.view) renderBase(baseView);
    if (r.view === 'device') {
      const d = byAsset(r.param) || state.devices.find((x) => x.uid === r.param);
      if (d) openDevice(d.uid, { fromHash: true }); else { toast(`No device ${r.param} found.`); goBase(); }
    } else if (r.view === 'add') openForm(null, { section: r.param || undefined });
    else if (r.view === 'edit') { const d = byAsset(r.param); if (d) openForm(d.uid); else goBase(); }
    return;
  }
  $('#sugg').hidden = true;
  baseView = VIEWS[r.view] ? r.view : 'dash';
  app.route = { view: baseView, param: r.param };
  renderBase(baseView);
}
export function goBase() {
  const h = baseView === 'dash' ? '#/' : `#/${baseView}`;
  if (location.hash !== h) history.replaceState(null, '', h);
  document.title = 'iTIMS';
}
function renderBase(v) {
  const el = $('#view');
  el.dataset.view = v;
  document.querySelectorAll('#nav a').forEach((a) => {
    const target = a.getAttribute('href').replace(/^#\/?/, '') || 'dash';
    a.toggleAttribute('aria-current', target === v);
    if (target === v) a.setAttribute('aria-current', 'page');
  });
  VIEWS[v](el);
  hydrateImages(el);
}
app.rerender = () => { renderHeader(); renderBase(baseView); };

// ---------- header ----------
function renderHeader() {
  const act = state.devices.filter((d) => !['Retired', 'Disposed'].includes(d.lifecycle));
  const down = act.filter((d) => d.condition === 'Down').length;
  const issues = act.filter(isIssue).length;
  const maint = act.filter(maintDue).length;
  const war = act.filter(warrantySoon).length;
  const hp = $('#headPill');
  if (!state.devices.length) hp.innerHTML = pill('No devices yet', 'off');
  else if (down) hp.innerHTML = pill(`${down} down`, 'bad');
  else if (issues || maint) hp.innerHTML = pill('Needs attention', 'warn');
  else hp.innerHTML = pill('All operational', 'ok');
  const sites = [...new Set(state.devices.map((d) => d.site).filter(Boolean))];
  const parts = [];
  if (state.settings.orgName) parts.push(`<span>${esc(state.settings.orgName)}</span>`);
  parts.push(`<span><b>${state.devices.length}</b> device${state.devices.length === 1 ? '' : 's'}</span>`);
  if (state.devices.length) {
    parts.push(`<span><b>${issues}</b> with issues</span>`);
    parts.push(`<span><b>${maint}</b> maintenance due</span>`);
    parts.push(`<span><b>${war}</b> warranty ending in 90 days</span>`);
    if (sites.length) parts.push(`<span>${sites.length === 1 ? esc(sites[0]) : sites.length + ' sites'}</span>`);
  }
  $('#summary').innerHTML = parts.join('<span class="sep">·</span>');
}

// ---------- global search ----------
let suggIdx = 0;
function suggestionsFor(q) {
  return sortDevices(state.devices.filter((d) => matches(d, q)), 'asset').sort((a, b) => searchRank(a, q) - searchRank(b, q)).slice(0, 8);
}
function renderSugg() {
  const box = $('#sugg');
  const q = app.q.trim();
  if (!q) { box.hidden = true; return; }
  const list = suggestionsFor(q);
  const total = state.devices.filter((d) => matches(d, q)).length;
  if (!list.length) { box.innerHTML = `<div class="empty">No devices match “${esc(q)}”.</div>`; box.hidden = false; return; }
  suggIdx = Math.min(suggIdx, list.length - 1);
  box.innerHTML = list.map((d, i) => `<button type="button" role="option" data-uid="${d.uid}" aria-selected="${i === suggIdx}">
      ${photoBox(d, 'mini')}
      <span class="txt"><b>${esc(d.asset)} · ${esc(d.hostname || d.type)}</b><small>${esc([d.make, d.model, d.room].filter(Boolean).join(' · '))}</small></span>
      <span class="hit">${esc(whereMatched(d, q))}</span>${condPill(d)}</button>`).join('') +
    `<div class="foot">${total} match${total === 1 ? '' : 'es'} · Enter opens the top match · every view below is filtered</div>`;
  box.hidden = false;
  hydrateImages(box);
}
function setQuery(q) {
  app.q = q;
  $('#q').value = q;
  const fn = $('#filterNote');
  if (q.trim()) {
    const n = state.devices.filter((d) => matches(d, q)).length;
    fn.innerHTML = `Filtered by “${esc(q.trim())}”: ${n} device${n === 1 ? '' : 's'} <button type="button" id="clearQ">Clear</button>`;
    fn.hidden = false;
    $('#clearQ').onclick = () => { setQuery(''); $('#sugg').hidden = true; };
  } else fn.hidden = true;
  renderBase(baseView);
}
function initSearch() {
  const q = $('#q');
  let t;
  q.addEventListener('input', () => {
    suggIdx = 0; app.q = q.value; renderSugg();
    clearTimeout(t); t = setTimeout(() => setQuery(q.value), 160);
  });
  q.addEventListener('keydown', (e) => {
    const items = [...$('#sugg').querySelectorAll('button[data-uid]')];
    if (e.key === 'ArrowDown') { e.preventDefault(); suggIdx = Math.min(suggIdx + 1, items.length - 1); renderSugg(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); suggIdx = Math.max(suggIdx - 1, 0); renderSugg(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      // A scanned QR label or typed asset number opens that device straight away
      const exact = byAsset(q.value);
      const target = exact || (items[suggIdx] && state.devices.find((d) => d.uid === items[suggIdx].dataset.uid));
      if (target) { $('#sugg').hidden = true; openDevice(target.uid); }
    } else if (e.key === 'Escape') { $('#sugg').hidden = true; if (!q.value) q.blur(); }
  });
  q.addEventListener('focus', () => { if (q.value) renderSugg(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#sugg button[data-uid]');
    if (b) { $('#sugg').hidden = true; openDevice(b.dataset.uid); return; }
    if (!e.target.closest('.gs')) $('#sugg').hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.closest('input,textarea,select,[contenteditable]') && !document.querySelector('.scrim')) { e.preventDefault(); q.focus(); q.select(); }
  });
}
export const searchFilter = (list) => (app.q.trim() ? list.filter((d) => matches(d, app.q)) : list);
export { setQuery };

// ---------- startup ----------
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme || 'light';
}
async function start() {
  try { await load(); } catch (e) {
    $('#view').innerHTML = `<div class="card m-pad"><b>iTIMS could not open its storage.</b><p>${esc(e.message)}. Private browsing windows block storage; open iTIMS in a normal window.</p></div>`;
    return;
  }
  applyTheme();
  $('[data-action="add"]').innerHTML = `${ui('plus', 14, 2.4)}Add device`;
  $('[data-action="scan"]').innerHTML = `${ui('qr', 14)}Scan QR label`;
  $('[data-action="add"]').onclick = () => openForm(null);
  $('[data-action="scan"]').onclick = () => openScanner();
  initSearch();
  renderHeader();
  onChange(() => { renderHeader(); applyTheme(); if (!document.querySelector('.scrim .dform')) renderBase(baseView); });
  window.addEventListener('hashchange', route);
  route();
  const setOnline = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', setOnline); window.addEventListener('offline', setOnline); setOnline();
  if (state.devices.length) requestPersistence();
  $('#foot').innerHTML = `Your data is stored on this device only. Back it up from <a href="#/settings">Settings</a>. · iTIMS v${VERSION}`;
}
export const VERSION = '1.0.0';

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
start();
export { SECTIONS };
