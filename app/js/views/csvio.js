// CSV export and import. Columns use the field labels from the dictionary;
// interfaces, logs and tickets travel as JSON cells so nothing is lost.
import { state, columns, displayValue, rawValue, blankDevice, validate, addMany, typesFor, byAsset, parseAsset } from '../store.js';
import { SECTIONS, SHARED_GROUPS, SECTION_FIELDS } from '../schema.js';
import { esc, parseCSV, toCSV, download, todayStr, normMac } from '../util.js';
import { modal, toast, ui } from '../ui.js';

const JSON_COLS = [['interfaces', 'Interfaces (JSON)'], ['maintLog', 'Maintenance Log (JSON)'], ['tickets', 'Tickets (JSON)'], ['externalIds', 'External IDs (JSON)']];

export function exportCSV(list, name = `itims-devices-${todayStr()}.csv`) {
  const cols = columns().filter((c) => !['created', 'updated'].includes(c.key));
  const head = [...cols.map((c) => c.label + (c.sections ? ` [${c.sections.join('/')}]` : '')), ...JSON_COLS.map((j) => j[1])];
  const rows = list.map((d) => [
    ...cols.map((c) => {
      const v = rawValue(d, c.key);
      return Array.isArray(v) ? v.join('; ') : c.type === 'datetime' ? displayValue(d, c.key) : v;
    }),
    ...JSON_COLS.map(([k]) => (d[k] || []).length ? JSON.stringify(d[k]) : ''),
  ]);
  download(name, toCSV([head, ...rows]), 'text/csv');
  toast(`Exported ${list.length} device${list.length === 1 ? '' : 's'}.`);
}

export function templateCSV() {
  const head = ['Asset #', 'Section', 'Device Type', 'Make', 'Model', 'Serial Number', 'Hostname', 'Primary IP', 'Primary MAC', 'Condition', 'Lifecycle', 'Site', 'Building', 'Floor', 'Room / Area', 'Assigned User', 'Date Acquired', 'Warranty Expires', 'Notes'];
  const ex = ['', 'End User Devices', 'Laptop', 'Dell', 'Latitude 5440', 'ABC1234', 'LT-FRONT-01', '10.0.20.15', 'AA:BB:CC:DD:EE:01', 'Operational', 'Deployed', 'Main Plant', 'Office', '1', 'Front desk', 'Jordan Lee', '2025-03-01', '2028-03-01', ''];
  download('itims-import-template.csv', toCSV([head, ex]), 'text/csv');
}

// Map a CSV header to a field key
function headerIndex() {
  const map = new Map();
  const put = (label, key) => map.set(label.toLowerCase().replace(/\s*\[.*\]\s*$/, '').trim(), key);
  for (const c of columns()) put(c.label, c.key);
  for (const g of SHARED_GROUPS) for (const f of g.fields) { put(f.label, f.key); put(f.key, f.key); }
  for (const s of SECTIONS) for (const f of SECTION_FIELDS[s.id]) { if (!map.has(f.label.toLowerCase())) put(f.label, 'x.' + f.key); put('x.' + f.key, 'x.' + f.key); }
  for (const [k, l] of JSON_COLS) { put(l, k); put(k, k); }
  const alias = { 'asset': 'asset', 'asset number': 'asset', 'asset no': 'asset', 'type': 'type', 'ip': 'ip', 'ip address': 'ip', 'mac': 'mac', 'mac address': 'mac', 'user': 'assignedUser', 'room': 'room', 'location': 'room', 'serial': 'serial', 'host': 'hostname', 'name': 'hostname', 'status': 'condition', 'section': 'section', 'category': 'section', 'warranty': 'warrantyExpires', 'purchase date': 'dateAcquired', 'department': 'owner', 'vlan': 'vlan', 'primary vlan': 'vlan' };
  for (const [a, k] of Object.entries(alias)) if (!map.has(a)) map.set(a, k);
  return map;
}

function toSection(v, type) {
  const s = String(v || '').trim().toLowerCase();
  const hit = SECTIONS.find((x) => [x.id, x.prefix, x.name, x.full].some((n) => n.toLowerCase() === s));
  if (hit) return hit.id;
  if (type) { const t = SECTIONS.find((x) => typesFor(x.id).some((tt) => tt.toLowerCase() === String(type).toLowerCase())); if (t) return t.id; }
  return '';
}
function normDate(v) {
  const s = String(v || '').trim(); if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  const d = new Date(s); return isNaN(d) ? s : d.toISOString().slice(0, 10);
}

export function rowsToDrafts(rows) {
  const [head, ...body] = rows;
  const idx = headerIndex();
  const keys = head.map((h) => idx.get(String(h).toLowerCase().replace(/\s*\[.*\]\s*$/, '').trim()) || null);
  const colTypes = Object.fromEntries(columns().map((c) => [c.key, c.type]));
  const out = [];
  for (const r of body) {
    if (!r.some((c) => String(c).trim())) continue;
    const get = (k) => { const i = keys.indexOf(k); return i >= 0 ? String(r[i] ?? '').trim() : ''; };
    const section = toSection(get('section') || get('sectionName'), get('type')) || toSection(parseAsset(get('asset'))?.sec) || '';
    const d = blankDevice(section || 'EU');
    d._noSection = !section;
    keys.forEach((k, i) => {
      if (!k) return;
      let v = String(r[i] ?? '').trim();
      if (['section', 'sectionName', 'ip', 'mac', 'vlan', 'allIps', 'lastMaint', 'nextMaint', 'openTickets', 'yearAcquired'].includes(k)) return;
      if (JSON_COLS.some((j) => j[0] === k)) { if (v) { try { d[k] = JSON.parse(v); } catch { d._bad = `${k} is not valid JSON`; } } return; }
      const t = colTypes[k];
      if (t === 'date') v = normDate(v);
      if (t === 'currency') v = v.replace(/[$,]/g, '');
      if (k === 'asset') { d.asset = v.toUpperCase(); return; }
      if (k.startsWith('x.')) {
        const f = (SECTION_FIELDS[d.section] || []).find((x) => x.key === k.slice(2)); if (!f || !v) return;
        d.extra[f.key] = f.type === 'multi' ? v.split(/[;,]\s*/) : f.type === 'bool' ? /^(y|yes|true|1)$/i.test(v) : f.type === 'date' ? normDate(v) : v;
        return;
      }
      if (k === 'lastVerified') { d.lastVerified = normDate(v); return; }
      if (k in d && typeof d[k] !== 'object') d[k] = v;
    });
    if (!d.condition) d.condition = 'Operational';
    if (!d.lifecycle) d.lifecycle = 'Deployed';
    if (!d.interfaces.length && (get('ip') || get('mac'))) d.interfaces = [{ name: 'Primary', ip: get('ip'), mac: get('mac') ? normMac(get('mac')) || get('mac') : '', addressing: 'Static', vlan: get('vlan'), connectedTo: '', port: '', primary: true }];
    if (d.tag && d.tag.toUpperCase() === d.asset) d.tag = '';
    if (d.asset && (byAsset(d.asset) || parseAsset(d.asset)?.sec !== d.section)) d._assetNote = byAsset(d.asset) ? `${d.asset} already exists, a new number will be given` : '';
    if (d.asset && byAsset(d.asset)) d.asset = '';
    out.push(d);
  }
  return out;
}

export function openImport() {
  const m = modal(`<div class="m-head"><div><h2>Import devices from CSV</h2><p class="kv-mini" style="margin:0">Excel, Google Sheets or a CSV exported from iTIMS.</p></div><button class="x" data-close aria-label="Close">×</button></div>
    <div class="m-pad" data-body>
      <p>Your file needs a header row. Columns are matched by name, like <b>Device Type</b>, <b>Make</b>, <b>Model</b>, <b>Hostname</b>, <b>IP Address</b> and <b>MAC Address</b>. A <b>Section</b> column (End User, Printers, Network, Industrial, Infrastructure) is best; otherwise iTIMS works it out from the device type.</p>
      <p>New asset numbers are given to every row unless the row has an unused one.</p>
      <div class="actions"><button class="btn primary" data-pick>${ui('upload', 13)}Choose CSV file</button><button class="btn" data-tpl>${ui('download', 13)}Download a template</button></div>
      <input type="file" accept=".csv,text/csv" data-file hidden>
    </div>
    <div class="lfoot"><button class="btn" data-close>Cancel</button><button class="btn primary" data-go disabled>Import</button></div>`, { wide: true });
  const body = m.el.querySelector('[data-body]');
  const file = m.el.querySelector('[data-file]');
  let ready = [];
  m.el.querySelector('[data-pick]').onclick = () => file.click();
  m.el.querySelector('[data-tpl]').onclick = templateCSV;
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    const rows = parseCSV(await f.text());
    if (rows.length < 2) { toast('That file has no rows under the header.'); return; }
    const drafts = rowsToDrafts(rows);
    const problems = [];
    ready = [];
    drafts.forEach((d, i) => {
      const issues = [];
      if (d._noSection) issues.push('No section and the device type did not match one; it will go to End User Devices');
      if (d._bad) issues.push(d._bad);
      const { errors } = validate(d);
      // Duplicates inside the same file
      const dupSerial = d.serial && ready.find((o) => o.serial && o.serial.toLowerCase() === d.serial.toLowerCase());
      if (dupSerial) errors.push(`Serial ${d.serial} appears twice in this file`);
      if (errors.length) problems.push({ row: i + 2, d, errors, issues });
      else { ready.push(d); if (issues.length || d._assetNote) problems.push({ row: i + 2, d, errors: [], issues: [...issues, d._assetNote].filter(Boolean) }); }
    });
    const bad = problems.filter((p) => p.errors.length);
    body.innerHTML = `<p><b>${ready.length}</b> of ${drafts.length} row${drafts.length === 1 ? '' : 's'} ready to import${bad.length ? `, <b>${bad.length}</b> skipped` : ''}.</p>
      ${problems.length ? `<div class="tbl-wrap" style="max-height:300px;overflow:auto"><table class="mtable"><thead><tr><th>Row</th><th>Device</th><th>Notes</th></tr></thead><tbody>
      ${problems.map((p) => `<tr><td>${p.row}</td><td>${esc([p.d.type, p.d.make, p.d.model, p.d.hostname].filter(Boolean).join(' '))}</td><td>${p.errors.map((e) => `<div style="color:var(--bad)">Skipped: ${esc(e)}</div>`).join('')}${p.issues.map((e) => `<div class="kv-mini">${esc(e)}</div>`).join('')}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
      <p class="kv-mini" style="margin-top:10px">Columns not recognized: ${esc(rows[0].filter((h) => !headerIndex().get(String(h).toLowerCase().replace(/\s*\[.*\]\s*$/, '').trim())).join(', ') || 'none')}</p>`;
    m.el.querySelector('[data-go]').disabled = !ready.length;
  };
  m.el.querySelector('[data-go]').onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = 'Importing…';
    ready.forEach((d) => { delete d._noSection; delete d._bad; delete d._assetNote; });
    const res = await addMany(ready);
    const ok = res.filter((r) => r.ok).length;
    m.close();
    toast(`Imported ${ok} device${ok === 1 ? '' : 's'}.${ok < res.length ? ` ${res.length - ok} failed.` : ''}`, 4000);
  };
}

