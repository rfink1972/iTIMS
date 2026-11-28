// Dashboard: stat tiles, "Needs attention", section tabs and the sortable,
// filterable device table.
import { state, isIssue, maintDue, warrantySoon, isActive, attentionScore, flags, columns, colByKey, displayValue, sortDevices } from '../store.js';
import { SECTIONS, DEFAULT_LIST_COLUMNS } from '../schema.js';
import { esc, $$, debounce } from '../util.js';
import { ui, pill, photoBox, condPill, lifePill, emptyState, modal, hydrateImages } from '../ui.js';
import { searchFilter, app } from '../app.js';
import { openDevice } from './device.js';
import { openForm } from './form.js';
import { openImport } from './csvio.js';

const LS = 'itims.list';
const prefs = Object.assign({ tab: 'all', sort: 'asset', dir: 1, cols: DEFAULT_LIST_COLUMNS, filters: {}, showFilters: false, tile: null, hideRetired: true },
  (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })());
const savePrefs = () => { try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch { /* storage full or blocked */ } };
export const listPrefs = prefs;

const TILE_FILTERS = {
  issues: (d) => isIssue(d),
  maint: (d) => maintDue(d),
  warranty: (d) => warrantySoon(d),
};

export function filteredDevices({ ignoreTab = false } = {}) {
  let list = searchFilter(state.devices);
  if (prefs.hideRetired && prefs.tile == null) list = list.filter((d) => isActive(d) || app.q.trim());
  if (!ignoreTab && prefs.tab !== 'all') list = list.filter((d) => d.section === prefs.tab);
  if (prefs.tile && TILE_FILTERS[prefs.tile]) list = list.filter(TILE_FILTERS[prefs.tile]);
  for (const [k, v] of Object.entries(prefs.filters || {})) {
    if (!v) continue;
    const terms = v.toLowerCase();
    list = list.filter((d) => {
      const val = displayValue(d, k).toLowerCase();
      if (terms === '(blank)') return !val;
      if (terms.startsWith('!')) return !val.includes(terms.slice(1));
      if (terms.startsWith('=')) return val === terms.slice(1);
      return val.includes(terms);
    });
  }
  return list;
}

export function renderDashboard(el) {
  if (!state.devices.length) {
    el.innerHTML = `<section class="card">${emptyState('Welcome to iTIMS',
      'Add your first device, import a spreadsheet, or load the sample devices to look around. Everything you enter stays on this device until you back it up.',
      `<button class="btn primary" data-a="add">${ui('plus')}Add device</button><button class="btn" data-a="import">${ui('upload')}Import CSV</button><button class="btn" data-a="sample">Load sample devices</button>`)}</section>
      ${installCard()}`;
    el.querySelector('[data-a="add"]').onclick = () => openForm(null);
    el.querySelector('[data-a="import"]').onclick = () => openImport();
    el.querySelector('[data-a="sample"]').onclick = async () => { const { loadSample } = await import('../sample.js'); await loadSample(); };
    return;
  }
  const act = state.devices.filter(isActive);
  const n = (f) => act.filter(f).length;
  const down = act.filter((d) => d.condition === 'Down').length;
  const tiles = [
    { id: null, lbl: 'Devices', big: act.length, sub: `${state.devices.length - act.length} retired or disposed`, icon: 'devices', tone: 'acc',
      foot: SECTIONS.map((s) => `${s.prefix} ${act.filter((d) => d.section === s.id).length}`).join(' · ') },
    { id: 'issues', lbl: 'Down / issues', big: n(isIssue), sub: `${down} down`, icon: 'alert', tone: down ? 'bad' : 'warn', foot: 'Condition not Operational' },
    { id: 'maint', lbl: 'Maintenance due', big: n(maintDue), sub: 'Next 30 days or overdue', icon: 'wrench', tone: 'warn', foot: 'Includes UPS batteries' },
    { id: 'warranty', lbl: 'Warranty expiring', big: n(warrantySoon), sub: 'In the next 90 days', icon: 'shield', tone: 'info', foot: 'Active devices only' },
  ];
  const attn = act.map((d) => ({ d, s: attentionScore(d) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6);
  const counts = Object.fromEntries(SECTIONS.map((s) => [s.id, filteredDevices({ ignoreTab: true }).filter((d) => d.section === s.id).length]));
  const all = filteredDevices({ ignoreTab: true }).length;

  el.innerHTML = `
  <section class="tiles">${tiles.map((t) => `
    <button type="button" class="tile" data-tile="${t.id ?? ''}" aria-pressed="${prefs.tile === t.id && t.id !== null}">
      <span class="lbl">${t.lbl}<span class="ico c-${t.tone}">${ui(t.icon, 14)}</span></span>
      <span class="big num">${t.big}</span><span class="sub">${t.sub}</span>
      <span class="foot"><span>${t.foot}</span></span>
    </button>`).join('')}
  </section>
  ${attn.length ? `<section class="card">
    <div class="card-h"><div class="hi">${ui('alert', 16)}</div><div><h2>Needs attention</h2><p>Ranked by condition and criticality</p></div></div>
    <ul class="attn-list">${attn.map(({ d }) => `<li data-uid="${d.uid}">${photoBox(d)}<div><b>${esc(d.asset)} · ${esc(d.hostname || d.type)}</b>
      <small>${esc([d.make, d.model].filter(Boolean).join(' '))}${d.room ? ' · ' + esc(d.room) : ''}${d.statusNote ? ' · ' + esc(d.statusNote) : ''}</small></div>
      <div class="flags">${d.criticality ? pill(d.criticality, d.criticality === 'Critical' ? 'bad' : 'off', true) : ''}${flags(d).slice(0, 2).map((f) => pill(f.text, f.tone)).join('')}</div></li>`).join('')}</ul>
  </section>` : ''}
  <section class="card">
    <div class="card-h" style="padding-bottom:0;border-bottom:0">
      <div class="hi">${ui('list', 16)}</div><div><h2>Devices</h2><p>Click a column to sort. Use Filters to narrow any column.</p></div>
      <div class="right">
        <button class="btn sm" data-a="filters" aria-pressed="${prefs.showFilters}">Filters</button>
        <button class="btn sm" data-a="cols">Columns</button>
        <button class="btn sm" data-a="csv">${ui('download', 13)}Export CSV</button>
        <button class="btn sm" data-a="import">${ui('upload', 13)}Import CSV</button>
      </div>
    </div>
    <div class="tabs" role="tablist" style="padding:0 12px;margin-top:8px">
      <button class="tab" role="tab" data-tab="all" aria-selected="${prefs.tab === 'all'}">All <span class="count">${all}</span></button>
      ${SECTIONS.map((s) => `<button class="tab" role="tab" data-tab="${s.id}" aria-selected="${prefs.tab === s.id}">${s.name} <span class="count">${counts[s.id]}</span></button>`).join('')}
    </div>
    <div id="tbl"></div>
  </section>`;

  el.querySelectorAll('[data-tile]').forEach((b) => b.onclick = () => {
    const id = b.dataset.tile || null;
    prefs.tile = prefs.tile === id ? null : id; savePrefs(); renderDashboard(el); hydrateImages(el);
  });
  el.querySelectorAll('.attn-list li').forEach((li) => li.onclick = () => openDevice(li.dataset.uid));
  el.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { prefs.tab = b.dataset.tab; savePrefs(); renderDashboard(el); hydrateImages(el); });
  el.querySelector('[data-a="filters"]').onclick = () => { prefs.showFilters = !prefs.showFilters; if (!prefs.showFilters) prefs.filters = {}; savePrefs(); renderDashboard(el); hydrateImages(el); };
  el.querySelector('[data-a="cols"]').onclick = () => pickColumns(() => { renderDashboard(el); hydrateImages(el); });
  el.querySelector('[data-a="import"]').onclick = () => openImport();
  el.querySelector('[data-a="csv"]').onclick = async () => { const { exportCSV } = await import('./csvio.js'); exportCSV(filteredDevices()); };
  renderTable(el.querySelector('#tbl'));
}

function renderTable(box) {
  const cols = prefs.cols.map(colByKey).filter(Boolean);
  const list = sortDevices(filteredDevices(), prefs.sort, prefs.dir);
  const head = cols.map((c) => `<th><button type="button" data-sort="${c.key}" ${prefs.sort === c.key ? `aria-sort="${prefs.dir > 0 ? 'ascending' : 'descending'}"` : ''}>${esc(c.label)} <span class="arr">${prefs.sort === c.key ? (prefs.dir > 0 ? '▲' : '▼') : '↕'}</span></button></th>`).join('');
  const frow = prefs.showFilters ? `<tr class="filters-row">${cols.map((c) => `<th><input data-f="${c.key}" value="${esc(prefs.filters[c.key] || '')}" placeholder="Filter" aria-label="Filter ${esc(c.label)}"></th>`).join('')}</tr>` : '';
  const cell = (d, c) => {
    if (c.key === 'asset') return `<td><span class="asset">${esc(d.asset)}</span></td>`;
    if (c.key === 'type') return `<td><div class="dev">${photoBox(d, 'mini')}<div>${esc(d.type)}<small>${esc([d.make, d.model].filter(Boolean).join(' '))}</small></div></div></td>`;
    if (c.key === 'condition') return `<td>${condPill(d)}</td>`;
    if (c.key === 'lifecycle') return `<td>${lifePill(d)}</td>`;
    const v = displayValue(d, c.key);
    return `<td class="${c.mono || ['ip', 'mac', 'hostname', 'serial', 'allIps'].includes(c.key) ? 'mono' : ''}">${esc(v)}</td>`;
  };
  box.innerHTML = `<div class="tbl-wrap"><table class="dl"><thead><tr>${head}</tr>${frow}</thead>
    <tbody>${list.map((d) => `<tr data-uid="${d.uid}" tabindex="0">${cols.map((c) => cell(d, c)).join('')}</tr>`).join('') ||
    `<tr><td colspan="${cols.length}" class="empty">No devices match.${prefs.tile ? ' A tile filter is on; click the tile again to clear it.' : ''}</td></tr>`}</tbody></table></div>
    <div class="table-foot"><span>${list.length} shown${prefs.hideRetired ? ' · retired and disposed hidden' : ''}${prefs.tile ? ' · tile filter on' : ''}</span>
    <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-a="retired" ${prefs.hideRetired ? '' : 'checked'} style="accent-color:var(--accent)"> Show retired and disposed</label></div>`;
  box.querySelectorAll('[data-sort]').forEach((b) => b.onclick = () => {
    const k = b.dataset.sort;
    if (prefs.sort === k) prefs.dir = -prefs.dir; else { prefs.sort = k; prefs.dir = 1; }
    savePrefs(); renderTable(box); hydrateImages(box);
  });
  box.querySelectorAll('tbody tr[data-uid]').forEach((tr) => {
    tr.onclick = () => openDevice(tr.dataset.uid);
    tr.onkeydown = (e) => { if (e.key === 'Enter') openDevice(tr.dataset.uid); };
  });
  const refilter = debounce((k, v, pos) => {
    prefs.filters[k] = v; savePrefs(); renderTable(box); hydrateImages(box);
    const inp = box.querySelector(`[data-f="${CSS.escape(k)}"]`); if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  }, 250);
  box.querySelectorAll('[data-f]').forEach((i) => i.oninput = () => refilter(i.dataset.f, i.value, i.selectionStart));
  box.querySelector('[data-a="retired"]').onchange = (e) => { prefs.hideRetired = !e.target.checked; savePrefs(); renderTable(box); hydrateImages(box); };
}

export function pickColumns(after, current = prefs.cols, title = 'Columns to show') {
  const groups = {};
  for (const c of columns()) (groups[c.group] ||= []).push(c);
  const m = modal(`<div class="m-head"><div><h2>${esc(title)}</h2><p class="kv-mini" style="margin:0">Every field can be a column, filter, sort or report column.</p></div><button class="x" data-close aria-label="Close">×</button></div>
    <div class="m-pad"><div class="colpick">${Object.entries(groups).map(([g, cs]) => `<h5>${esc(g)}</h5>${cs.map((c) => `<label><input type="checkbox" value="${c.key}" ${current.includes(c.key) ? 'checked' : ''}> ${esc(c.label)}${c.sections ? ` <small style="color:var(--faint)">${c.sections.join('/')}</small>` : ''}</label>`).join('')}`).join('')}</div></div>
    <div class="lfoot"><button class="btn" data-reset>Reset to default</button><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Apply</button></div>`, { wide: true });
  const keep = (keys) => { const order = [...current.filter((k) => keys.includes(k)), ...keys.filter((k) => !current.includes(k))]; current.splice(0, current.length, ...order); };
  m.el.querySelector('[data-ok]').onclick = () => {
    const keys = $$('input[type=checkbox]', m.el).filter((i) => i.checked).map((i) => i.value);
    if (!keys.length) return;
    keep(keys); if (current === prefs.cols) savePrefs(); m.close(); after?.();
  };
  m.el.querySelector('[data-reset]').onclick = () => { current.splice(0, current.length, ...DEFAULT_LIST_COLUMNS); if (current === prefs.cols) savePrefs(); m.close(); after?.(); };
}

function installCard() {
  return `<section class="card"><div class="card-h"><div class="hi">${ui('download', 16)}</div><div><h2>Put iTIMS on your phone or PC</h2><p>It installs like an app and works without signal.</p></div></div>
  <div class="set-body">
    <p><b>iPhone (Safari):</b> tap the Share button, then <b>Add to Home Screen</b>, then <b>Add</b>.</p>
    <p><b>Android (Chrome):</b> tap the ⋮ menu, then <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Install</b>.</p>
    <p><b>Windows (Chrome or Edge):</b> click the install icon at the right end of the address bar, then <b>Install</b>.</p>
  </div></section>`;
}
export { installCard };
