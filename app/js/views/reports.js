// Reports: presets, column picker, filters, grouping, letter-size preview,
// print / save as PDF, CSV export and saved custom reports.
import { state, saveReports, columns, colByKey, displayValue, sortDevices, isActive, isIssue, maintDue, warrantySoon } from '../store.js';
import { SECTIONS, CONDITIONS, LIFECYCLES } from '../schema.js';
import { esc, todayStr, fmtDate, daysUntil, uid } from '../util.js';
import { ui, photoBox, condTone, lifeTone, emptyState, hydrateImages, toast, confirmBox } from '../ui.js';
import { app, searchFilter } from '../app.js';
import { pickColumns } from './dashboard.js';
import { exportCSV } from './csvio.js';
import { openDevice } from './device.js';

const PRESETS = {
  full: { name: 'Full inventory', cols: ['asset', 'type', 'make', 'model', 'hostname', 'ip', 'room', 'assignedUser', 'condition', 'lifecycle'], group: 'sectionName', sort: 'asset' },
  issues: { name: 'Down and issues', cols: ['asset', 'type', 'hostname', 'room', 'condition', 'statusNote', 'criticality', 'assignedUser'], group: 'condition', sort: 'criticality', dir: -1, test: (d) => isIssue(d) || d.lifecycle === 'Needs Replacement' },
  maint: { name: 'Maintenance due', cols: ['asset', 'type', 'hostname', 'room', 'maintInterval', 'lastMaint', 'nextMaint', 'lifecycle'], group: '', sort: 'nextMaint', test: maintDue },
  warranty: { name: 'Warranty expiring', cols: ['asset', 'type', 'make', 'model', 'serial', 'warrantyExpires', 'vendor', 'supportContract'], group: '', sort: 'warrantyExpires', test: (d) => warrantySoon(d) || (d.warrantyExpires && daysUntil(d.warrantyExpires) < 0 && daysUntil(d.warrantyExpires) > -30) },
  replace: { name: 'Replacement planning', cols: ['asset', 'type', 'make', 'model', 'dateAcquired', 'eol', 'lifecycle', 'cost', 'assignedUser'], group: 'sectionName', sort: 'eol', test: (d) => d.lifecycle === 'Needs Replacement' || (d.eol && daysUntil(d.eol) <= 365) || (d.dateAcquired && daysUntil(d.dateAcquired) < -5 * 365) },
  network: { name: 'Network address list', cols: ['ip', 'hostname', 'mac', 'vlan', 'asset', 'type', 'room', 'allIps'], group: '', sort: 'ip', test: (d) => (d.interfaces || []).some((i) => i.ip || i.mac) },
  spares: { name: 'Hot spares and stock', cols: ['asset', 'type', 'make', 'model', 'serial', 'room', 'condition', 'lifecycle'], group: 'lifecycle', sort: 'type', all: true, test: (d) => ['Hot Spare', 'In Stock', 'On Order'].includes(d.lifecycle) },
  byuser: { name: 'Assigned devices by user', cols: ['asset', 'type', 'make', 'model', 'serial', 'hostname', 'room'], group: 'assignedUser', sort: 'type', test: (d) => !!d.assignedUser },
  custom: { name: 'Custom report', cols: ['asset', 'type', 'hostname', 'ip', 'room', 'condition', 'lifecycle'], group: '', sort: 'asset' },
};
const GROUPS = ['', 'sectionName', 'type', 'site', 'building', 'floor', 'room', 'assignedUser', 'owner', 'condition', 'lifecycle', 'criticality', 'make', 'vendor', 'yearAcquired', 'vlan'];

const fresh = (k) => ({ preset: k, name: PRESETS[k].name, cols: [...PRESETS[k].cols], group: PRESETS[k].group, sort: PRESETS[k].sort, dir: PRESETS[k].dir || 1, sections: [], conds: [], lifes: [], site: '', text: [], retired: !!PRESETS[k].all, photos: false, summary: true, landscape: false });
let cfg = (() => { try { return JSON.parse(localStorage.getItem('itims.report')) || fresh('full'); } catch { return fresh('full'); } })();
const keep = () => { try { localStorage.setItem('itims.report', JSON.stringify(cfg)); } catch { /* ignore */ } };

export function reportRows(c = cfg) {
  const p = PRESETS[c.preset] || PRESETS.custom;
  let list = searchFilter(state.devices);
  if (!c.retired) list = list.filter(isActive);
  if (p.test) list = list.filter(p.test);
  if (c.sections.length) list = list.filter((d) => c.sections.includes(d.section));
  if (c.conds.length) list = list.filter((d) => c.conds.includes(d.condition));
  if (c.lifes.length) list = list.filter((d) => c.lifes.includes(d.lifecycle));
  if (c.site) list = list.filter((d) => d.site === c.site);
  for (const t of c.text) {
    if (!t.key || !t.value) continue;
    const v = t.value.toLowerCase();
    list = list.filter((d) => { const x = displayValue(d, t.key).toLowerCase(); return v === '(blank)' ? !x : v.startsWith('!') ? !x.includes(v.slice(1)) : x.includes(v); });
  }
  return sortDevices(list, c.sort, c.dir);
}

function filterLine(c) {
  const parts = [];
  if (c.sections.length) parts.push(c.sections.map((s) => SECTIONS.find((x) => x.id === s).name).join(', '));
  if (c.conds.length) parts.push('Condition: ' + c.conds.join(', '));
  if (c.lifes.length) parts.push('Lifecycle: ' + c.lifes.join(', '));
  if (c.site) parts.push('Site: ' + c.site);
  for (const t of c.text) if (t.key && t.value) parts.push(`${colByKey(t.key)?.label}: ${t.value}`);
  if (app.q.trim()) parts.push(`Search: “${app.q.trim()}”`);
  if (!c.retired) parts.push('Retired and disposed left out');
  return parts.join(' · ') || 'All devices';
}

function cell(d, k) {
  const v = displayValue(d, k);
  if (k === 'condition') return `<span class="st ${condTone(v)}">${esc(v)}</span>`;
  if (k === 'lifecycle') return `<span class="st ${lifeTone(v) === 'acc' ? 'info' : lifeTone(v)}">${esc(v)}</span>`;
  const c = colByKey(k);
  return c?.mono || ['asset', 'serial', 'hostname', 'x.queue'].includes(k) ? `<span class="mono">${esc(v)}</span>` : esc(v);
}

export function paperHtml(c = cfg, rows = reportRows(c)) {
  const cols = c.cols.map(colByKey).filter(Boolean);
  const groups = new Map();
  for (const d of rows) { const g = c.group ? displayValue(d, c.group) || '(none)' : ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(d); }
  const down = rows.filter((d) => d.condition === 'Down').length;
  const issues = rows.filter(isIssue).length;
  const sums = SECTIONS.map((s) => [s.name, rows.filter((d) => d.section === s.id).length]).filter(([, n]) => n);
  const span = cols.length + (c.photos ? 1 : 0);
  return `<div class="paper ${c.landscape ? 'landscape' : ''}">
    <div class="ph1"><div><h2>${esc(c.name)}</h2><div class="flt">${esc(filterLine(c))}</div></div>
      <div class="org">${esc(state.settings.orgName || 'iTIMS')}<br>${esc(fmtDate(todayStr()))}${state.settings.userName ? '<br>' + esc(state.settings.userName) : ''}</div></div>
    ${c.summary ? `<div class="sum"><div><b>${rows.length}</b><span>Devices</span></div><div><b>${down}</b><span>Down</span></div><div><b>${issues}</b><span>With issues</span></div>${sums.map(([n, k]) => `<div><b>${k}</b><span>${esc(n)}</span></div>`).join('')}</div>` : ''}
    ${rows.length ? `<table><thead><tr>${c.photos ? '<th></th>' : ''}${cols.map((x) => `<th>${esc(x.label)}</th>`).join('')}</tr></thead><tbody>
      ${[...groups.entries()].sort((a, b) => (a[0] === '(none)') - (b[0] === '(none)') || a[0].localeCompare(b[0], undefined, { numeric: true })).map(([g, ds]) =>
        `${c.group ? `<tr class="grp"><td colspan="${span}">${esc(g)} <span class="group-sum">${ds.length}</span></td></tr>` : ''}${ds.map((d) => `<tr data-uid="${d.uid}">${c.photos ? `<td><div class="pimg">${photoBox(d, 'mini')}</div></td>` : ''}${cols.map((x) => `<td>${cell(d, x.key)}</td>`).join('')}</tr>`).join('')}`).join('')}
    </tbody></table>` : '<p class="flt">No devices match this report.</p>'}
    <div class="pf"><span>iTIMS · ${rows.length} device${rows.length === 1 ? '' : 's'}</span><span>Printed ${esc(new Date().toLocaleString())}</span></div>
  </div>`;
}

export function renderReports(el) {
  if (!state.devices.length) { el.innerHTML = `<section class="card">${emptyState('No devices yet', 'Reports appear once you have devices.', '<a class="btn primary" href="#/add/EU">Add device</a>')}</section>`; return; }
  const cols = columns();
  const lab = (k) => k ? esc(cols.find((c) => c.key === k)?.label || k) : 'No grouping';
  const sites = [...new Set(state.devices.map((d) => d.site).filter(Boolean))].sort();
  const rows = reportRows();
  el.innerHTML = `<div class="rp">
    <section class="card rp-side">
      <div><h4>Report</h4><select id="rpp">
        <optgroup label="Presets">${Object.entries(PRESETS).map(([k, p]) => `<option value="p:${k}" ${!cfg.savedId && cfg.preset === k ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>
        ${state.reports.length ? `<optgroup label="Saved">${state.reports.map((r) => `<option value="s:${r.id}" ${cfg.savedId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</optgroup>` : ''}
      </select></div>
      <div><h4>Title</h4><input type="text" id="rpt" value="${esc(cfg.name)}"></div>
      <div><h4>Columns</h4><button class="btn sm" id="rpc">${ui('list', 12)}Choose columns (${cfg.cols.length})</button></div>
      <div><h4>Sections</h4><div class="chk">${SECTIONS.map((s) => `<label><input type="checkbox" data-arr="sections" value="${s.id}" ${cfg.sections.includes(s.id) ? 'checked' : ''}>${esc(s.name)}</label>`).join('')}</div></div>
      <div><h4>Condition</h4><div class="chk">${Object.keys(CONDITIONS).map((s) => `<label><input type="checkbox" data-arr="conds" value="${s}" ${cfg.conds.includes(s) ? 'checked' : ''}>${esc(s)}</label>`).join('')}</div></div>
      <div><h4>Lifecycle</h4><div class="chk">${Object.keys(LIFECYCLES).map((s) => `<label><input type="checkbox" data-arr="lifes" value="${s}" ${cfg.lifes.includes(s) ? 'checked' : ''}>${esc(s)}</label>`).join('')}</div></div>
      ${sites.length > 1 ? `<div><h4>Site</h4><select id="rps"><option value="">All sites</option>${sites.map((s) => `<option ${s === cfg.site ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>` : ''}
      <div><h4>Field filters</h4>
        ${cfg.text.map((t, i) => `<div class="row" style="margin-bottom:6px"><select data-tk="${i}">${cols.map((c) => `<option value="${c.key}" ${c.key === t.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select><input type="text" data-tv="${i}" value="${esc(t.value)}" placeholder="contains"><button class="btn sm ghost" data-tdel="${i}" aria-label="Remove filter">×</button></div>`).join('')}
        <button class="btn sm" id="rpa">${ui('plus', 12)}Add filter</button>
        <div class="rp-hint" style="margin-top:4px">Type text to match, !text to leave out, (blank) for empty.</div></div>
      <div class="two"><div><label for="rpg">Group by</label><select id="rpg">${GROUPS.map((k) => `<option value="${k}" ${k === cfg.group ? 'selected' : ''}>${lab(k)}</option>`).join('')}</select></div>
        <div><label for="rpo">Sort by</label><select id="rpo">${cols.map((c) => `<option value="${c.key}" ${c.key === cfg.sort ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div></div>
      <div class="opt">
        <label><input type="checkbox" id="rpd" ${cfg.dir < 0 ? 'checked' : ''}> Sort descending</label>
        <label><input type="checkbox" data-opt="retired" ${cfg.retired ? 'checked' : ''}> Include retired and disposed</label>
        <label><input type="checkbox" data-opt="summary" ${cfg.summary ? 'checked' : ''}> Summary counts</label>
        <label><input type="checkbox" data-opt="photos" ${cfg.photos ? 'checked' : ''}> Photos</label>
        <label><input type="checkbox" data-opt="landscape" ${cfg.landscape ? 'checked' : ''}> Landscape paper</label>
      </div>
      <div class="rp-btns">
        <button class="btn primary" id="rpprint">${ui('print', 13)}Print or save PDF</button>
        <button class="btn" id="rpcsv">${ui('download', 13)}CSV</button>
        <button class="btn" id="rpsave">${ui('check', 13)}${cfg.savedId ? 'Update saved' : 'Save report'}</button>
        ${cfg.savedId ? `<button class="btn ghost" id="rpdel" style="color:var(--bad)">${ui('trash', 13)}Delete</button>` : ''}
      </div>
    </section>
    <div class="rp-main">
      <div class="rp-hint">${rows.length} device${rows.length === 1 ? '' : 's'} · Letter ${cfg.landscape ? 'landscape' : 'portrait'} · click a row to open it. To save a PDF, pick “Save as PDF” as the printer.</div>
      <div class="paper-wrap" style="overflow:auto">${paperHtml(cfg, rows)}</div>
    </div>
  </div>`;
  hydrateImages(el);
  wire(el, rows);
}

function wire(el, rows) {
  const q = (s) => el.querySelector(s);
  const redo = () => { keep(); renderReports(el); };
  q('#rpp').onchange = (e) => {
    const [t, k] = e.target.value.split(':');
    if (t === 'p') cfg = fresh(k);
    else { const r = state.reports.find((x) => x.id === k); cfg = { ...fresh('custom'), ...structuredClone(r.cfg), savedId: r.id, name: r.name }; }
    redo();
  };
  q('#rpt').onchange = (e) => { cfg.name = e.target.value.trim() || PRESETS[cfg.preset].name; redo(); };
  q('#rpc').onclick = () => pickColumns(redo, cfg.cols, 'Report columns');
  el.querySelectorAll('[data-arr]').forEach((c) => c.onchange = () => { const a = cfg[c.dataset.arr]; if (c.checked) a.push(c.value); else a.splice(a.indexOf(c.value), 1); redo(); });
  q('#rps')?.addEventListener('change', (e) => { cfg.site = e.target.value; redo(); });
  q('#rpa').onclick = () => { cfg.text.push({ key: 'room', value: '' }); redo(); setTimeout(() => el.querySelector(`[data-tv="${cfg.text.length - 1}"]`)?.focus(), 0); };
  el.querySelectorAll('[data-tk]').forEach((s) => s.onchange = () => { cfg.text[+s.dataset.tk].key = s.value; redo(); });
  el.querySelectorAll('[data-tv]').forEach((s) => s.onchange = () => { cfg.text[+s.dataset.tv].value = s.value.trim(); redo(); });
  el.querySelectorAll('[data-tdel]').forEach((b) => b.onclick = () => { cfg.text.splice(+b.dataset.tdel, 1); redo(); });
  q('#rpg').onchange = (e) => { cfg.group = e.target.value; redo(); };
  q('#rpo').onchange = (e) => { cfg.sort = e.target.value; redo(); };
  q('#rpd').onchange = (e) => { cfg.dir = e.target.checked ? -1 : 1; redo(); };
  el.querySelectorAll('[data-opt]').forEach((c) => c.onchange = () => { cfg[c.dataset.opt] = c.checked; redo(); });
  q('#rpprint').onclick = () => printReport();
  q('#rpcsv').onclick = () => exportCSV(rows, `itims-${cfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${todayStr()}.csv`);
  q('#rpsave').onclick = async () => {
    const data = structuredClone(cfg); delete data.savedId;
    if (cfg.savedId) { const r = state.reports.find((x) => x.id === cfg.savedId); r.name = cfg.name; r.cfg = data; }
    else { const id = uid(); state.reports.push({ id, name: cfg.name, cfg: data }); cfg.savedId = id; }
    await saveReports(); toast(`Saved “${cfg.name}”.`); redo();
  };
  q('#rpdel')?.addEventListener('click', async () => {
    if (!await confirmBox(`Delete “${cfg.name}”?`, '<p>Only the saved report is deleted. Devices are not touched.</p>', { ok: 'Delete', danger: true })) return;
    state.reports = state.reports.filter((r) => r.id !== cfg.savedId); await saveReports();
    cfg = fresh('full'); redo();
  });
  el.querySelectorAll('.paper tr[data-uid]').forEach((tr) => { tr.style.cursor = 'pointer'; tr.onclick = () => openDevice(tr.dataset.uid); });
}

export async function printReport() {
  const area = document.getElementById('printArea');
  area.innerHTML = paperHtml();
  await hydrateImages(area);
  document.getElementById('pageSize')?.remove();
  const page = document.createElement('style');
  page.id = 'pageSize';
  page.textContent = `@page{size:letter ${cfg.landscape ? 'landscape' : 'portrait'};margin:0.4in}`;
  document.head.appendChild(page);
  document.body.classList.add('printing-report');
  const done = () => { document.body.classList.remove('printing-report'); page.remove(); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}
