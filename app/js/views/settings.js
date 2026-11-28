// Settings: your details, managed lists, device types, backup / restore, CSV and install help.
import { state, saveLists, saveSettings, replaceAll, emit, typesFor } from '../store.js';
import { db } from '../db.js';
import { SECTIONS } from '../schema.js';
import { esc, uid, download, todayStr, blobToDataURL, dataURLToBlob, fmtDateTime } from '../util.js';
import { ui, toast, confirmBox } from '../ui.js';
import { app, VERSION } from '../app.js';
import { installCard } from './dashboard.js';
import { exportCSV, openImport, templateCSV } from './csvio.js';
import { openScanner } from './scan.js';
import { openLabels } from './labels.js';

const used = (key, v) => state.devices.filter((d) => (key === 'buildings' ? d.building === v.name && d.site === v.site : key === 'floors' ? d.floor === v.name && d.site === v.site && (d.building || '') === (v.building || '') : d[{ sites: 'site', departments: 'owner', people: 'assignedUser' }[key]] === v)).length;
const label = (key, v) => key === 'buildings' ? `${v.name} <small>${esc(v.site)}</small>` : key === 'floors' ? `${esc(v.name)} <small>${esc([v.site, v.building].filter(Boolean).join(' › '))}</small>` : esc(v);

function listCard(key, title, hint) {
  const items = state.lists[key];
  const sites = state.lists.sites;
  const extra = key === 'buildings' || key === 'floors'
    ? `<select data-site="${key}">${sites.map((s) => `<option>${esc(s)}</option>`).join('')}</select>${key === 'floors' ? `<input data-bld="${key}" placeholder="Building" list="set-blds">` : ''}` : '';
  return `<section class="card"><div class="card-h"><div><h2>${title}</h2><p>${hint}</p></div></div>
    <div class="set-body">
      <div class="mlist">${items.length ? items.map((v, i) => `<div class="mi"><span>${key === 'buildings' ? `${esc(v.name)} <small>${esc(v.site)}</small>` : label(key, v)}</span><small>${used(key, v)} device${used(key, v) === 1 ? '' : 's'}</small><button class="btn sm ghost" data-del="${key}:${i}" aria-label="Remove">${ui('trash', 12)}</button></div>`).join('') : '<p>None yet. They are also added when you save a device.</p>'}</div>
      ${(key === 'buildings' || key === 'floors') && !sites.length ? '<p>Add a site first.</p>' : `<div class="addrow">${extra}<input data-new="${key}" placeholder="Add ${title.toLowerCase().replace(/s$/, '')}"><button class="btn sm" data-add="${key}">${ui('plus', 12)}Add</button></div>`}
    </div></section>`;
}

export function renderSettings(el) {
  const s = state.settings;
  el.innerHTML = `
  <section class="card"><div class="card-h"><div class="hi">${ui('gear', 16)}</div><div><h2>Your details</h2><p>Shown on reports, labels and in each device's change log.</p></div></div>
    <div class="set-body"><div class="form">
      <div><label for="s-org">Organization or site name</label><input id="s-org" value="${esc(s.orgName)}" placeholder="e.g. Acme Plant 2"></div>
      <div><label for="s-user">Your name</label><input id="s-user" value="${esc(s.userName)}" placeholder="Recorded on changes you make"></div>
      <div><label for="s-theme">Look</label><select id="s-theme"><option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option><option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Match my device</option></select></div>
    </div></div></section>

  <section class="card"><div class="card-h"><div class="hi">${ui('download', 16)}</div><div><h2>Back up and move your data</h2><p>iTIMS keeps everything in this browser on this device. Download a backup regularly and keep it somewhere safe, like OneDrive or Google Drive.</p></div></div>
    <div class="set-body">
      <div class="actions">
        <button class="btn primary" data-a="backup">${ui('download', 13)}Download full backup</button>
        <button class="btn" data-a="restore">${ui('upload', 13)}Restore from backup</button>
        <input type="file" accept=".json,application/json" data-restore hidden>
      </div>
      <p>A backup holds every device, photo, floorplan, attachment, list and saved report. Restoring replaces what is on this device. Use it to move iTIMS to another phone or PC.</p>
      <p data-last>${s.lastBackup ? `Last backup: ${esc(fmtDateTime(s.lastBackup))}.` : 'No backup downloaded yet.'} <span data-usage></span></p>
      <div class="actions">
        <button class="btn" data-a="csv">${ui('download', 13)}Export all to CSV</button>
        <button class="btn" data-a="import">${ui('upload', 13)}Import CSV</button>
        <button class="btn ghost" data-a="tpl">CSV template</button>
      </div>
    </div></section>

  <section class="card"><div class="card-h"><div class="hi">${ui('qr', 16)}</div><div><h2>Labels and audits</h2><p>Print QR labels for many devices at once, or walk a room and scan each label to mark it verified.</p></div></div>
    <div class="set-body"><div class="actions">
      <button class="btn" data-a="labelsAll">${ui('print', 13)}Print labels for all active devices</button>
      <button class="btn" data-a="labelsNew">${ui('print', 13)}Labels for devices never verified</button>
      <button class="btn" data-a="audit">${ui('check', 13)}Start an audit walk</button>
    </div></div></section>

  <div class="set-grid">
    ${listCard('sites', 'Sites', 'Plants, offices or campuses.')}
    ${listCard('buildings', 'Buildings', 'Buildings at each site.')}
    ${listCard('floors', 'Floors', 'Each floor can hold a floorplan image.')}
    ${listCard('departments', 'Departments', 'Used for Owner / Department.')}
    ${listCard('people', 'People', 'Suggested for Assigned User. Assigned User is always optional.')}
    <section class="card"><div class="card-h"><div><h2>Device types</h2><p>One per line. Changes the Device Type list for that section.</p></div></div>
      <div class="set-body">
        <select data-typesec>${SECTIONS.map((x) => `<option value="${x.id}">${esc(x.full)}</option>`).join('')}</select>
        <textarea data-types rows="8" style="width:100%;font:inherit;font-size:13px;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--card);color:var(--fg)"></textarea>
        <div class="actions"><button class="btn sm primary" data-a="saveTypes">Save types</button><button class="btn sm ghost" data-a="resetTypes">Reset to default</button></div>
      </div></section>
  </div>
  <datalist id="set-blds">${[...new Set(state.lists.buildings.map((b) => b.name))].map((b) => `<option value="${esc(b)}">`).join('')}</datalist>

  ${installCard()}

  <section class="card"><div class="card-h"><div class="hi" style="background:var(--bad-soft);color:var(--bad)">${ui('alert', 16)}</div><div><h2>Sample data and reset</h2><p>iTIMS v${VERSION}</p></div></div>
    <div class="set-body"><div class="actions">
      <button class="btn" data-a="sample">Load sample devices</button>
      <button class="btn danger" data-a="erase">${ui('trash', 13)}Erase everything on this device</button>
    </div></div></section>`;
  wire(el);
}

function wire(el) {
  const q = (s) => el.querySelector(s);
  const a = (k, fn) => q(`[data-a="${k}"]`).addEventListener('click', fn);
  const setS = async (k, v) => { state.settings[k] = v; await saveSettings(); emit(); };
  q('#s-org').onchange = (e) => setS('orgName', e.target.value.trim());
  q('#s-user').onchange = (e) => setS('userName', e.target.value.trim());
  q('#s-theme').onchange = (e) => setS('theme', e.target.value);
  navigator.storage?.estimate?.().then(async (est) => {
    const mb = (n) => (n / 1048576).toFixed(n > 1048576 * 10 ? 0 : 1);
    const persisted = await navigator.storage.persisted?.();
    const u = q('[data-usage]'); if (u) u.textContent = `Using ${mb(est.usage || 0)} MB of storage${persisted ? ', protected from automatic clean-up' : ''}.`;
  });

  // Managed lists
  el.querySelectorAll('[data-add]').forEach((b) => b.onclick = async () => {
    const key = b.dataset.add; const v = q(`[data-new="${key}"]`).value.trim(); if (!v) return;
    const list = state.lists[key];
    if (key === 'buildings') { const site = q('[data-site="buildings"]').value; if (list.some((x) => x.site === site && x.name === v)) return toast('Already listed.'); list.push({ site, name: v }); }
    else if (key === 'floors') { const site = q('[data-site="floors"]').value; const building = q('[data-bld="floors"]').value.trim(); if (list.some((x) => x.site === site && (x.building || '') === building && x.name === v)) return toast('Already listed.'); list.push({ id: uid(), site, building, name: v, plan: null }); }
    else { if (list.includes(v)) return toast('Already listed.'); list.push(v); list.sort((x, y) => x.localeCompare(y)); }
    await saveLists(); renderSettings(el);
  });
  el.querySelectorAll('[data-new]').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector(`[data-add="${i.dataset.new}"]`).click(); }));
  el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const [key, i] = b.dataset.del.split(':'); const v = state.lists[key][+i]; const n = used(key, v);
    const ok = await confirmBox('Remove from the list?', `<p>${n ? `${n} device${n === 1 ? ' still uses' : 's still use'} it. They keep their value; it just stops being suggested.` : 'No devices use it.'}${key === 'floors' && v.plan ? ' The floorplan image for this floor is deleted too.' : ''}</p>`, { ok: 'Remove', danger: true });
    if (!ok) return;
    if (key === 'floors' && v.plan) await db.del('blobs', v.plan);
    state.lists[key].splice(+i, 1); await saveLists(); renderSettings(el);
  });

  // Device types
  const sec = q('[data-typesec]'); const ta = q('[data-types]');
  const showTypes = () => { ta.value = typesFor(sec.value).join('\n'); };
  sec.onchange = showTypes; showTypes();
  a('saveTypes', async () => {
    const list = [...new Set(ta.value.split('\n').map((x) => x.trim()).filter(Boolean))];
    if (!list.length) return toast('Add at least one type.');
    state.lists.types = { ...(state.lists.types || {}), [sec.value]: list }; await saveLists(); toast('Device types saved.');
  });
  a('resetTypes', async () => { const t = { ...(state.lists.types || {}) }; delete t[sec.value]; state.lists.types = t; await saveLists(); showTypes(); toast('Back to the default types.'); });

  // Data
  a('backup', () => backup());
  a('restore', () => q('[data-restore]').click());
  q('[data-restore]').onchange = (e) => restore(e.target.files[0]);
  a('csv', () => exportCSV(state.devices));
  a('import', openImport);
  a('tpl', templateCSV);
  a('labelsAll', () => openLabels(state.devices.filter((d) => !['Retired', 'Disposed'].includes(d.lifecycle)).map((d) => d.uid)));
  a('labelsNew', () => openLabels(state.devices.filter((d) => !d.lastVerified && !['Retired', 'Disposed'].includes(d.lifecycle)).map((d) => d.uid)));
  a('audit', () => openScanner({ audit: true }));
  a('sample', async () => {
    if (state.devices.length && !await confirmBox('Replace your devices with samples?', `<p>This replaces the ${state.devices.length} device${state.devices.length === 1 ? '' : 's'} on this device with sample data. Download a backup first if you want to keep them.</p>`, { ok: 'Replace with samples', danger: true })) return;
    const { loadSample } = await import('../sample.js'); await loadSample(); location.hash = '#/';
  });
  a('erase', async () => {
    if (!await confirmBox('Erase everything?', `<p>This deletes all ${state.devices.length} devices, photos, floorplans, lists and saved reports from this browser. It cannot be undone unless you have a backup.</p>`, { ok: 'Erase everything', danger: true })) return;
    await replaceAll({ devices: [], blobs: [], lists: {}, counters: {}, settings: { orgName: '', userName: '', theme: 'light', lastBackup: '' }, reports: [] });
    toast('Everything was erased.'); location.hash = '#/'; app.rerender();
  });
}

export async function backup() {
  toast('Preparing backup…', 10000);
  const blobs = [];
  for (const b of await db.all('blobs')) blobs.push({ id: b.id, name: b.name, type: b.type, kind: b.kind, size: b.size, data: await blobToDataURL(b.blob) });
  const data = { app: 'iTIMS', format: 1, version: VERSION, exported: new Date().toISOString(), devices: state.devices, lists: state.lists, counters: state.counters, settings: state.settings, reports: state.reports, blobs };
  download(`itims-backup-${todayStr()}.json`, JSON.stringify(data), 'application/json');
  state.settings.lastBackup = data.exported; await saveSettings();
  toast(`Backup downloaded: ${state.devices.length} devices, ${blobs.length} files.`);
  emit();
}

export async function restore(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('That file is not an iTIMS backup.'); return; }
  if (data.app !== 'iTIMS' || !Array.isArray(data.devices)) { toast('That file is not an iTIMS backup.'); return; }
  const ok = await confirmBox('Restore this backup?', `<p>Backup from ${esc(fmtDateTime(data.exported))} with ${data.devices.length} devices.</p><p>It <b>replaces</b> the ${state.devices.length} device${state.devices.length === 1 ? '' : 's'} on this device now.</p>`, { ok: 'Replace and restore', danger: true });
  if (!ok) return;
  const blobs = [];
  for (const b of data.blobs || []) blobs.push({ id: b.id, name: b.name, type: b.type, kind: b.kind, size: b.size, blob: await dataURLToBlob(b.data) });
  await replaceAll({ ...data, blobs });
  toast(`Restored ${data.devices.length} devices.`);
  location.hash = '#/';
}

