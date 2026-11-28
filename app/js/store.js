// In-memory copy of the database plus the rules from the field dictionary:
// asset numbering, uniqueness, change log, computed dates and dashboard counts.
import { db } from './db.js';
import {
  SECTIONS, sectionById, SHARED_GROUPS, SECTION_FIELDS, CONDITIONS, LIFECYCLES, CRIT_RANK, MAINT_INTERVALS, allColumns,
} from './schema.js';
import { uid, todayStr, addDays, addYears, daysUntil, normMac, isIP, fmtDate, fmtDateTime, fmtMoney, ipSortKey, cmp } from './util.js';

const listeners = new Set();
export const state = {
  devices: [],
  lists: { sites: [], buildings: [], floors: [], departments: [], people: [], types: {} },
  counters: { EU: 0, PR: 0, NW: 0, IN: 0, SRV: 0 },
  settings: { orgName: '', userName: '', theme: 'light' },
  reports: [],
  ready: false,
};
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emit = () => listeners.forEach((fn) => fn());

export async function load() {
  state.devices = await db.all('devices');
  state.lists = Object.assign({ sites: [], buildings: [], floors: [], departments: [], people: [], types: {} }, await db.meta('lists', {}));
  state.counters = Object.assign({ EU: 0, PR: 0, NW: 0, IN: 0, SRV: 0 }, await db.meta('counters', {}));
  state.settings = Object.assign({ orgName: '', userName: '', theme: 'light' }, await db.meta('settings', {}));
  state.reports = await db.meta('reports', []);
  state.ready = true;
}
export const saveLists = () => db.setMeta('lists', state.lists);
export const saveSettings = () => db.setMeta('settings', state.settings);
export const saveReports = () => db.setMeta('reports', state.reports);
const saveCounters = () => db.setMeta('counters', state.counters);

export const typesFor = (sec) => state.lists.types?.[sec]?.length ? state.lists.types[sec] : sectionById(sec)?.types || [];
export const byUid = (u) => state.devices.find((d) => d.uid === u);
export const byAsset = (a) => {
  const k = String(a || '').trim().toUpperCase();
  return state.devices.find((d) => d.asset === k || (d.tag && d.tag.toUpperCase() === k));
};

// ---------- asset numbers ----------
export function formatAsset(sec, n) { return `${sectionById(sec).prefix}-${String(n).padStart(4, '0')}`; }
export function previewAsset(sec) { return formatAsset(sec, (state.counters[sec] || 0) + 1); }
function takeAsset(sec) { state.counters[sec] = (state.counters[sec] || 0) + 1; return formatAsset(sec, state.counters[sec]); }
function parseAsset(a) {
  const m = /^(EU|PR|NW|IN|SRV)-(\d{4,})$/.exec(String(a || '').trim().toUpperCase());
  return m ? { sec: m[1], n: +m[2] } : null;
}
// Keeps counters ahead of every number ever used, so numbers are never reused.
function bumpCounter(asset) {
  const p = parseAsset(asset);
  if (p && p.n > (state.counters[p.sec] || 0)) state.counters[p.sec] = p.n;
}

// ---------- computed values ----------
export function primaryIface(d) {
  const ifs = d.interfaces || [];
  return ifs.find((i) => i.primary) || ifs[0] || null;
}
export function lastMaint(d) {
  const dates = (d.maintLog || []).map((e) => e.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : '';
}
export function intervalDays(d) {
  if (!d.maintInterval || d.maintInterval === 'None') return 0;
  if (d.maintInterval === 'Custom') return +d.maintCustomDays || 0;
  return MAINT_INTERVALS[d.maintInterval] || 0;
}
export function nextMaint(d) {
  const n = intervalDays(d);
  if (!n) return '';
  const last = lastMaint(d) || d.dateAcquired;
  return last ? addDays(last, n) : todayStr();
}
export function batteryDue(d) {
  if (d.section !== 'SRV' || d.type !== 'UPS') return '';
  const x = d.extra || {};
  return x.batteryDue || (x.batteryInstall ? addYears(x.batteryInstall, 4) : '');
}
const RETIRED = ['Retired', 'Disposed'];
export const isActive = (d) => !RETIRED.includes(d.lifecycle);
export const isIssue = (d) => isActive(d) && d.condition && d.condition !== 'Operational';

// Reasons a device needs attention (flags from the dictionary)
export function flags(d) {
  const out = [];
  if (!isActive(d)) return out;
  if (d.condition === 'Down') out.push({ tone: 'bad', text: 'Down' });
  else if (isIssue(d)) out.push({ tone: 'warn', text: d.condition });
  if (d.lifecycle === 'Needs Replacement') out.push({ tone: 'bad', text: 'Needs replacement' });
  const nm = nextMaint(d); const nmd = daysUntil(nm);
  if (nm && nmd <= 30) out.push({ tone: nmd < 0 ? 'bad' : 'warn', text: nmd < 0 ? `Maintenance overdue since ${fmtDate(nm)}` : `Maintenance due ${fmtDate(nm)}` });
  const bd = batteryDue(d); const bdd = daysUntil(bd);
  if (bd && bdd <= 30) out.push({ tone: bdd < 0 ? 'bad' : 'warn', text: `UPS battery due ${fmtDate(bd)}` });
  const w = daysUntil(d.warrantyExpires);
  if (d.warrantyExpires && w >= 0 && w <= 90) out.push({ tone: 'warn', text: `Warranty ends ${fmtDate(d.warrantyExpires)}` });
  const x = d.extra || {};
  if (d.section === 'NW' && ['Switch', 'Router', 'Firewall', 'Wireless Controller'].includes(d.type)) {
    const a = daysUntil(x.configBackup);
    if (!x.configBackup || a < -30) out.push({ tone: 'warn', text: x.configBackup ? 'Config backup over 30 days old' : 'No config backup recorded' });
  }
  if (d.section === 'IN' && d.type === 'PLC' && !x.programBackup) out.push({ tone: 'warn', text: 'No PLC program backup on file' });
  if (d.section === 'SRV' && ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN'].includes(d.type)) {
    const b = daysUntil(x.lastBackup);
    if (!x.lastBackup || b < -7) out.push({ tone: 'warn', text: x.lastBackup ? 'Last backup over 7 days old' : 'No backup recorded' });
  }
  if (x.licenseExpires) { const l = daysUntil(x.licenseExpires); if (l <= 60) out.push({ tone: l < 0 ? 'bad' : 'warn', text: `License ${l < 0 ? 'expired' : 'expires'} ${fmtDate(x.licenseExpires)}` }); }
  return out;
}
export const maintDue = (d) => {
  if (!isActive(d)) return false;
  const nm = nextMaint(d); const bd = batteryDue(d);
  return (nm && daysUntil(nm) <= 30) || (bd && daysUntil(bd) <= 30) || d.lifecycle === 'Needs Maintenance';
};
export const warrantySoon = (d) => { if (!isActive(d) || !d.warrantyExpires) return false; const w = daysUntil(d.warrantyExpires); return w >= 0 && w <= 90; };

export function attentionScore(d) {
  let s = 0;
  if (d.condition === 'Down') s += 100; else if (isIssue(d)) s += 50;
  if (d.lifecycle === 'Needs Replacement') s += 30;
  if (maintDue(d)) s += 15;
  if (warrantySoon(d)) s += 5;
  s += flags(d).length * 2;
  if (!s) return 0;
  return s * (CRIT_RANK[d.criticality] || 1.5);
}

// ---------- column values ----------
let _cols;
export const columns = () => (_cols ||= allColumns());
export const colByKey = (k) => columns().find((c) => c.key === k);

export function rawValue(d, key) {
  if (key.startsWith('x.')) return d.extra?.[key.slice(2)] ?? '';
  switch (key) {
    case 'sectionName': return sectionById(d.section)?.full || '';
    case 'ip': return primaryIface(d)?.ip || '';
    case 'mac': return primaryIface(d)?.mac || '';
    case 'vlan': return primaryIface(d)?.vlan || '';
    case 'allIps': return (d.interfaces || []).map((i) => i.ip).filter(Boolean).join(', ');
    case 'lastMaint': return lastMaint(d);
    case 'nextMaint': return nextMaint(d) || batteryDue(d);
    case 'openTickets': return (d.tickets || []).filter((t) => !t.closed).length || '';
    case 'yearAcquired': return d.dateAcquired ? d.dateAcquired.slice(0, 4) : '';
    case 'tag': return d.tag || d.asset;
    default: return d[key] ?? '';
  }
}
export function displayValue(d, key) {
  const v = rawValue(d, key);
  const c = colByKey(key);
  if (v === '' || v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (c?.type === 'date') return fmtDate(v);
  if (c?.type === 'datetime') return fmtDateTime(v);
  if (c?.type === 'currency') return fmtMoney(v);
  if (c?.type === 'bool') return v === true || v === 'Yes' ? 'Yes' : 'No';
  return String(v);
}
export function sortValue(d, key) {
  const v = rawValue(d, key);
  if (key === 'ip') return ipSortKey(v);
  if (key === 'criticality') return CRIT_RANK[v] || 0;
  if (Array.isArray(v)) return v.join(', ');
  const c = colByKey(key);
  if (['number', 'currency'].includes(c?.type) && v !== '') return +v;
  return v;
}
export function sortDevices(list, key, dir = 1) {
  return [...list].sort((a, b) => {
    const r = cmp(sortValue(a, key), sortValue(b, key));
    return r !== 0 ? r * dir : cmp(a.asset, b.asset);
  });
}

// ---------- search ----------
// Every field, interfaces, maintenance log, tickets and external IDs are searchable.
export function searchText(d) {
  const parts = [d.asset, d.tag, sectionById(d.section)?.full];
  for (const g of SHARED_GROUPS) for (const f of g.fields) parts.push(d[f.key]);
  for (const v of Object.values(d.extra || {})) parts.push(Array.isArray(v) ? v.join(' ') : v);
  for (const i of d.interfaces || []) parts.push(i.name, i.ip, i.mac, i.mac?.replace(/:/g, ''), i.vlan, i.connectedTo, i.port);
  for (const m of d.maintLog || []) parts.push(m.by, m.type, m.work, m.parts, m.ticket);
  for (const t of d.tickets || []) parts.push(t.number, t.system, t.summary);
  for (const e of d.externalIds || []) parts.push(e.key, e.value);
  for (const a of d.formerAssets || []) parts.push(a);
  return parts.filter((x) => x !== undefined && x !== null && x !== '').join(' \u0001 ').toLowerCase();
}
export function matches(d, q) {
  if (!q) return true;
  const hay = searchText(d);
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}
// Rank: exact asset/tag/hostname/IP/MAC first
export function searchRank(d, q) {
  const s = q.trim().toLowerCase();
  const exact = [d.asset, d.tag, d.hostname, d.serial, ...(d.interfaces || []).flatMap((i) => [i.ip, i.mac])].filter(Boolean).map((x) => String(x).toLowerCase());
  if (exact.includes(s)) return 0;
  if (exact.some((x) => x.startsWith(s))) return 1;
  return 2;
}
export function whereMatched(d, q) {
  const s = q.trim().toLowerCase();
  if (!s) return '';
  for (const c of columns()) {
    const v = displayValue(d, c.key);
    if (v && v.toLowerCase().includes(s)) return `${c.label}: ${v}`;
  }
  for (const t of d.tickets || []) if ([t.number, t.summary].join(' ').toLowerCase().includes(s)) return `Ticket ${t.number}`;
  for (const i of d.interfaces || []) if ([i.name, i.ip, i.mac].join(' ').toLowerCase().includes(s)) return `${i.name || 'Interface'}: ${i.ip || i.mac}`;
  return '';
}

// ---------- validation and save ----------
export function blankDevice(section = 'EU') {
  return {
    uid: uid(), asset: '', section, type: '', make: '', model: '', serial: '', hostname: '', tag: '',
    photos: [], interfaces: [], condition: 'Operational', lifecycle: 'Deployed', criticality: '', statusNote: '',
    site: state.lists.sites[0] || '', building: '', floor: '', room: '', rack: '', x: null, y: null,
    assignedUser: '', owner: '', costCenter: '', dateAcquired: '', vendor: '', po: '', cost: '', warrantyExpires: '',
    supportContract: '', eol: '', osFw: '', maintInterval: 'None', maintCustomDays: '', maintLog: [], tickets: [],
    externalIds: [], attachments: [], notes: '', lastVerified: '', extra: {}, history: [], formerAssets: [], disposal: null,
  };
}

export function validate(d) {
  const errors = []; const warnings = [];
  for (const g of SHARED_GROUPS) for (const f of g.fields) {
    if (f.req && f.type !== 'auto' && !String(d[f.key] ?? '').trim()) errors.push(`${f.label} is required.`);
  }
  if (d.condition && !CONDITIONS[d.condition]) errors.push('Pick a Condition from the list.');
  if (d.lifecycle && !LIFECYCLES[d.lifecycle]) errors.push('Pick a Lifecycle from the list.');
  const others = state.devices.filter((o) => o.uid !== d.uid);
  if (d.serial) {
    const dup = others.find((o) => o.serial && o.serial.trim().toLowerCase() === d.serial.trim().toLowerCase());
    if (dup) errors.push(`Serial number ${d.serial} is already on ${dup.asset}.`);
  }
  if (d.tag) {
    const dup = others.find((o) => (o.tag || o.asset).toUpperCase() === d.tag.toUpperCase() || o.asset === d.tag.toUpperCase());
    if (dup) errors.push(`Asset tag ${d.tag} is already used by ${dup.asset}.`);
  }
  const seenMac = new Set();
  (d.interfaces || []).forEach((i, n) => {
    const label = i.name || `Interface ${n + 1}`;
    if (i.mac) {
      const m = normMac(i.mac);
      if (!m) errors.push(`${label}: MAC address "${i.mac}" is not 12 hex digits.`);
      else {
        if (seenMac.has(m)) errors.push(`${label}: MAC ${m} is listed twice on this device.`);
        seenMac.add(m);
        const dup = others.find((o) => (o.interfaces || []).some((x) => x.mac === m));
        if (dup) errors.push(`${label}: MAC ${m} is already on ${dup.asset}.`);
      }
    }
    if (i.ip) {
      if (!isIP(i.ip.trim())) errors.push(`${label}: "${i.ip}" is not a valid IPv4 or IPv6 address.`);
      else {
        const dup = others.find((o) => (o.interfaces || []).some((x) => x.ip === i.ip.trim()));
        if (dup) warnings.push(`IP ${i.ip} is also on ${dup.asset} (${dup.hostname || dup.type}). Duplicate IPs are allowed.`);
      }
    }
  });
  if (d.lifecycle === 'Disposed') {
    const ds = d.disposal || {};
    if (!ds.date) errors.push('Disposed devices need a disposal date.');
    if (!ds.method) errors.push('Disposed devices need a disposal method.');
    if (!ds.wiped) errors.push('Confirm the data wipe for disposed devices.');
  }
  return { errors, warnings };
}

function normalize(d) {
  for (const k of ['make', 'model', 'serial', 'hostname', 'tag', 'room', 'rack', 'assignedUser', 'vendor']) if (typeof d[k] === 'string') d[k] = d[k].trim();
  if (d.tag && d.tag.toUpperCase() === d.asset) d.tag = '';
  d.interfaces = (d.interfaces || []).filter((i) => i.name || i.ip || i.mac || i.vlan || i.connectedTo)
    .map((i) => ({ ...i, ip: (i.ip || '').trim(), mac: i.mac ? normMac(i.mac) || i.mac : '' }));
  if (d.interfaces.length && !d.interfaces.some((i) => i.primary)) d.interfaces[0].primary = true;
  let seen = false; d.interfaces.forEach((i) => { if (i.primary) { i.primary = !seen; seen = true; } });
  // Keep only section fields that belong to the device's section
  const keys = new Set((SECTION_FIELDS[d.section] || []).map((f) => f.key));
  d.extra = Object.fromEntries(Object.entries(d.extra || {}).filter(([k, v]) => keys.has(k) && v !== '' && v != null && !(Array.isArray(v) && !v.length)));
  if (d.lifecycle !== 'Disposed') d.disposal = d.disposal?.date ? d.disposal : null;
  return d;
}

function flat(d) {
  const o = {};
  for (const g of SHARED_GROUPS) for (const f of g.fields) o[f.label] = d[f.key] ?? '';
  for (const s of SECTIONS) for (const f of SECTION_FIELDS[s.id]) if (d.section === s.id) {
    const v = d.extra?.[f.key]; o[f.label] = Array.isArray(v) ? v.join(', ') : (v ?? '');
  }
  o['Interfaces'] = (d.interfaces || []).map((i) => [i.name, i.ip, i.mac, i.addressing, i.vlan, i.connectedTo, i.port, i.primary ? 'primary' : ''].join('/')).join('; ');
  o['Floorplan position'] = d.x == null ? '' : `${Math.round(d.x)}, ${Math.round(d.y)}`;
  o['Photos'] = String((d.photos || []).length);
  o['Attachments'] = String((d.attachments || []).length);
  o['Maintenance log'] = String((d.maintLog || []).length) + ' entries';
  o['Ticket history'] = String((d.tickets || []).length) + ' entries';
  o['External IDs'] = (d.externalIds || []).map((e) => `${e.key}=${e.value}`).join('; ');
  o['Disposal'] = d.disposal ? `${d.disposal.date} ${d.disposal.method}` : '';
  return o;
}
function diff(before, after) {
  const a = flat(before), b = flat(after); const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = String(a[k] ?? ''), y = String(b[k] ?? '');
    if (x !== y) out.push({ field: k, from: x, to: y });
  }
  return out;
}

// Saves a device. Returns { ok, errors, warnings, device }.
// opts.force skips warnings (they have already been shown).
export async function saveDevice(draft, opts = {}) {
  const d = normalize(structuredClone(draft));
  const { errors, warnings } = validate(d);
  if (errors.length) return { ok: false, errors, warnings };
  if (warnings.length && !opts.force) return { ok: false, errors: [], warnings, needsConfirm: true };
  const now = new Date().toISOString();
  const who = state.settings.userName || '';
  const prev = byUid(d.uid);
  d.history = d.history || [];
  if (!prev) {
    if (d.asset && parseAsset(d.asset)?.sec === d.section && !state.devices.some((o) => o.asset === d.asset)) bumpCounter(d.asset);
    else d.asset = takeAsset(d.section);
    d.created = d.created || now; d.createdBy = d.createdBy || who;
    d.history.push({ at: now, by: who, field: 'Created', from: '', to: d.asset });
  } else {
    if (prev.section !== d.section) {
      d.formerAssets = [...(prev.formerAssets || []), prev.asset];
      d.asset = takeAsset(d.section);
      d.history.push({ at: now, by: who, field: 'Section', from: `${sectionById(prev.section).full} (${prev.asset})`, to: `${sectionById(d.section).full} (${d.asset})` });
    }
    for (const c of diff(prev, d)) if (c.field !== 'Section' && c.field !== 'Asset Number') d.history.push({ at: now, by: who, ...c });
  }
  d.updated = now; d.updatedBy = who;
  await db.put('devices', d);
  await saveCounters();
  const i = state.devices.findIndex((o) => o.uid === d.uid);
  if (i >= 0) state.devices[i] = d; else state.devices.push(d);
  rememberListValues(d);
  emit();
  return { ok: true, errors: [], warnings, device: d };
}

// Small updates (pin moves, verify, log entries) that skip the full form.
export async function patchDevice(u, fn, note) {
  const prev = byUid(u); if (!prev) return;
  const d = structuredClone(prev);
  fn(d);
  const now = new Date().toISOString(); const who = state.settings.userName || '';
  const changes = diff(prev, d);
  for (const c of changes) d.history.push({ at: now, by: who, ...c });
  if (note) d.history.push({ at: now, by: who, field: note, from: '', to: '' });
  d.updated = now; d.updatedBy = who;
  await db.put('devices', d);
  Object.assign(prev, d);
  emit();
  return d;
}

export async function deleteDevice(u) {
  const d = byUid(u); if (!d) return;
  for (const b of [...(d.photos || []), ...(d.attachments || [])]) {
    for (const id of [b.id || b, b.thumb]) if (id) await delBlob(id);
  }
  await db.del('devices', u);
  state.devices = state.devices.filter((o) => o.uid !== u);
  emit();
}

function rememberListValues(d) {
  let changed = false;
  const addTo = (key, v) => { if (v && !state.lists[key].includes(v)) { state.lists[key].push(v); changed = true; } };
  addTo('sites', d.site); addTo('departments', d.owner); addTo('people', d.assignedUser);
  if (d.building && !state.lists.buildings.some((b) => b.site === d.site && b.name === d.building)) { state.lists.buildings.push({ site: d.site, name: d.building }); changed = true; }
  if (d.floor && !state.lists.floors.some((f) => f.site === d.site && f.building === d.building && f.name === d.floor)) {
    state.lists.floors.push({ id: uid(), site: d.site, building: d.building, name: d.floor, plan: null }); changed = true;
  }
  if (changed) saveLists();
}

// Values already used, for "text with suggestions" fields
export function suggestions(key, section) {
  const set = new Set();
  for (const d of state.devices) {
    const v = key.startsWith('x.') ? d.extra?.[key.slice(2)] : d[key];
    if (v && typeof v === 'string' && (!section || !key.startsWith('x.') || d.section === section)) set.add(v);
  }
  if (key === 'make') ['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft', 'Samsung', 'Zebra', 'Honeywell', 'Cisco', 'Meraki', 'Fortinet', 'Ubiquiti', 'Aruba', 'Allen-Bradley', 'Siemens', 'APC', 'Eaton', 'Axis', 'Synology'].forEach((m) => set.add(m));
  if (key === 'x.mdmSystem') ['Intune', 'Jamf', 'SOTI', 'Workspace ONE'].forEach((m) => set.add(m));
  if (key === 'assignedUser') state.lists.people.forEach((p) => set.add(p));
  return [...set].sort(cmp);
}

// Devices linked to this one (Connected To, Protects, controller, recorder...)
export function dependents(d) {
  const a = d.asset; const out = [];
  if (!a) return out;
  const re = new RegExp(`\\b${a}\\b`, 'i');
  for (const o of state.devices) {
    if (o.uid === d.uid) continue;
    const ifHit = (o.interfaces || []).find((i) => i.connectedTo && re.test(i.connectedTo));
    if (ifHit) { out.push({ device: o, how: `connected${ifHit.port ? ' on port ' + ifHit.port : ''}` }); continue; }
    for (const s of SECTIONS) for (const f of SECTION_FIELDS[s.id]) {
      if (o.section !== s.id || !['device', 'devices'].includes(f.type)) continue;
      const v = o.extra?.[f.key];
      if (v && re.test(String(v))) out.push({ device: o, how: f.label.toLowerCase() });
    }
  }
  // Devices this UPS/PDU protects
  const p = d.extra?.protects;
  if (p) for (const asset of String(p).split(/[,\s]+/)) { const o = byAsset(asset); if (o && !out.some((x) => x.device === o)) out.push({ device: o, how: 'protected by this unit' }); }
  return out;
}

export function floorsFor(site, building) {
  return state.lists.floors.filter((f) => (!site || f.site === site) && (!building || f.building === building));
}
export function devicesOnFloor(f) {
  return state.devices.filter((d) => d.site === f.site && (d.building || '') === (f.building || '') && d.floor === f.name);
}

// ---------- blobs ----------
const urlCache = new Map();
export async function putBlob(blob, name = '', kind = 'photo') {
  const id = uid();
  await db.put('blobs', { id, blob, name, type: blob.type, kind, size: blob.size });
  return id;
}
export async function blobURL(id) {
  if (!id) return '';
  if (urlCache.has(id)) return urlCache.get(id);
  const r = await db.get('blobs', id);
  if (!r) return '';
  const u = URL.createObjectURL(r.blob);
  urlCache.set(id, u);
  return u;
}
export async function getBlob(id) { return db.get('blobs', id); }
export async function delBlob(id) { urlCache.delete(id); await db.del('blobs', id); }

// Replace everything (restore from backup / import sample data)
export async function replaceAll({ devices, blobs, lists, counters, settings, reports }) {
  await db.clear('devices'); await db.clear('blobs');
  urlCache.clear();
  if (blobs?.length) await db.putMany('blobs', blobs);
  if (devices?.length) await db.putMany('devices', devices);
  state.devices = devices || [];
  state.lists = Object.assign({ sites: [], buildings: [], floors: [], departments: [], people: [], types: {} }, lists || {});
  state.counters = Object.assign({ EU: 0, PR: 0, NW: 0, IN: 0, SRV: 0 }, counters || {});
  for (const d of state.devices) { bumpCounter(d.asset); (d.formerAssets || []).forEach(bumpCounter); }
  state.settings = Object.assign(state.settings, settings || {});
  state.reports = reports || [];
  await saveLists(); await saveCounters(); await saveSettings(); await saveReports();
  emit();
}

// Bulk add (CSV import). Each row already validated by the caller.
export async function addMany(drafts) {
  const results = [];
  for (const dr of drafts) results.push(await saveDevice(dr, { force: true }));
  return results;
}
export { bumpCounter, parseAsset };
