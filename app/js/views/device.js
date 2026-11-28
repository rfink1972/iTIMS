// Device page: everything about one device, with quick actions.
import { state, byUid, byAsset, flags, primaryIface, lastMaint, nextMaint, batteryDue, dependents, patchDevice, deleteDevice, getBlob, blobURL, putBlob } from '../store.js';
import { SHARED_GROUPS, SECTION_FIELDS, sectionById, MAINT_TYPES } from '../schema.js';
import { esc, fmtDate, fmtDateTime, fmtMoney, todayStr, download, shrinkImage } from '../util.js';
import { ui, pill, condPill, lifePill, photoBox, hydrateImages, modal, confirmBox, toast } from '../ui.js';
import { goBase } from '../app.js';
import { openForm } from './form.js';
import { openLabels } from './labels.js';

let current = null;

function fieldVal(f, v) {
  if (v === '' || v == null || (Array.isArray(v) && !v.length)) return '';
  if (f.type === 'date') return esc(fmtDate(v));
  if (f.type === 'currency') return esc(fmtMoney(v));
  if (f.type === 'bool') return v === true || v === 'Yes' ? 'Yes' : 'No';
  if (f.type === 'multi') return esc([].concat(v).join(', '));
  if (f.type === 'device' || f.type === 'devices') return linkAssets(String(v));
  if (f.type === 'longtext') return esc(v).replace(/\n/g, '<br>');
  return esc(v);
}
export function linkAssets(text) {
  return esc(text).replace(/\b(EU|PR|NW|IN|SRV)-\d{4,}\b/g, (a) => byAsset(a) ? `<a href="#/device/${a}">${a}</a>` : a);
}
const dl = (pairs) => {
  const items = pairs.filter(([, v]) => v !== '' && v != null);
  return items.length ? `<dl class="fields">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '<p class="kv-mini" style="margin:0">Nothing entered yet.</p>';
};

export function openDevice(u, { fromHash = false } = {}) {
  const d = byUid(u);
  if (!d) return;
  document.querySelector('.scrim.dev-scrim')?.remove();
  if (!fromHash) history.pushState(null, '', `#/device/${d.asset}`);
  document.title = `${d.asset} · iTIMS`;
  current = d.uid;
  const m = modal(html(d), { wide: true, cls: 'dpage', onClose: () => { current = null; if (location.hash.startsWith('#/device/')) goBase(); } });
  m.el.parentElement.classList.add('dev-scrim');
  wire(m, d);
  hydrateImages(m.el);
}

function html(d) {
  const sec = sectionById(d.section);
  const p = primaryIface(d);
  const fl = flags(d);
  const groups = SHARED_GROUPS.filter((g) => !['identity', 'records'].includes(g.id)).map((g) => {
    const pairs = g.fields.filter((f) => !f.showIf || f.showIf(d)).map((f) => [f.label, fieldVal(f, d[f.key])]);
    if (g.id === 'location' && d.x != null) pairs.push(['Floorplan position', 'Placed on plan']);
    if (g.id === 'maintenance') {
      pairs.push(['Last Maintenance', esc(fmtDate(lastMaint(d)))]);
      pairs.push(['Next Maintenance Due', esc(fmtDate(nextMaint(d)))]);
    }
    return `<div class="group"><h4>${g.title}</h4>${dl(pairs)}</div>`;
  });
  const sf = (SECTION_FIELDS[d.section] || []).filter((f) => !f.types || f.types.includes(d.type) || d.extra?.[f.key]);
  const sfPairs = sf.map((f) => [f.label, fieldVal(f, d.extra?.[f.key])]);
  const bd = batteryDue(d);
  if (bd && !d.extra?.batteryDue) sfPairs.push(['Battery Replace Due', esc(fmtDate(bd)) + ' <small class="kv-mini">(install + 4 years)</small>']);
  const deps = dependents(d);
  const photos = d.photos || [];
  return `
  <div class="m-head">
    <div style="min-width:0">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="asset">${esc(d.asset)}</span>${d.tag ? `<span class="pill c-off nodot">Tag ${esc(d.tag)}</span>` : ''}${condPill(d)}${lifePill(d)}${d.criticality ? pill(d.criticality + ' criticality', d.criticality === 'Critical' ? 'bad' : 'off', true) : ''}</div>
      <h2>${esc(d.hostname || `${d.make} ${d.model}`)}</h2>
      <div class="kv-mini">${esc(sec?.full)} · ${esc(d.type)} · ${esc([d.make, d.model].filter(Boolean).join(' '))}${d.serial ? ` · S/N <span class="mono">${esc(d.serial)}</span>` : ''}</div>
      ${d.statusNote ? `<div style="margin-top:6px">${esc(d.statusNote)}</div>` : ''}
      ${fl.length ? `<div class="flags" style="justify-content:flex-start;margin-top:8px">${fl.map((f) => pill(f.text, f.tone)).join('')}</div>` : ''}
    </div>
    <button class="x" data-close aria-label="Close">×</button>
  </div>
  <div class="actions" style="padding:10px 20px 0;margin:0">
    <button class="btn primary" data-a="edit">${ui('edit', 13)}Edit</button>
    <button class="btn" data-a="label">${ui('qr', 13)}Print label</button>
    <button class="btn" data-a="maint">${ui('wrench', 13)}Log maintenance</button>
    <button class="btn" data-a="photo">${ui('camera', 13)}Add photo</button>
    <button class="btn" data-a="verify">${ui('check', 13)}Mark verified</button>
    ${d.floor ? `<a class="btn" href="#/floorplan/${encodeURIComponent(d.uid)}">${ui('map', 13)}Show on floorplan</a>` : ''}
    <button class="btn ghost" data-a="delete" style="color:var(--bad);margin-left:auto">${ui('trash', 13)}Delete</button>
    <input type="file" accept="image/*" data-a="photofile" hidden multiple>
  </div>
  <div class="m-body">
    <div class="m-side">
      ${photoBox(d, '', true).replace('class="photo ', 'class="photo bigphoto ')}
      ${photos.length > 1 ? `<div class="gallery">${photos.map((ph, i) => `<img data-blob="${esc(ph.thumb || ph.id)}" data-i="${i}" alt="Photo ${i + 1}">`).join('')}</div>` : ''}
      <dl class="fields" style="grid-template-columns:1fr">
        <div><dt>Primary IP</dt><dd class="mono">${esc(p?.ip || '—')}</dd></div>
        <div><dt>Primary MAC</dt><dd class="mono">${esc(p?.mac || '—')}</dd></div>
        <div><dt>Location</dt><dd>${esc([d.site, d.building, d.floor, d.room, d.rack].filter(Boolean).join(' › ') || '—')}</dd></div>
        <div><dt>Assigned user</dt><dd>${esc(d.assignedUser || '—')}</dd></div>
        <div><dt>Last verified</dt><dd>${esc(fmtDate(d.lastVerified) || 'Never')}</dd></div>
      </dl>
      ${deps.length ? `<div class="group"><h4>Linked devices (${deps.length})</h4><div class="dep">${deps.map((x) => `<a href="#/device/${x.device.asset}"><span class="asset">${esc(x.device.asset)}</span>${esc(x.device.hostname || x.device.type)} <small class="kv-mini">${esc(x.how)}</small></a>`).join('')}</div>
        ${d.section === 'NW' ? '<p class="kv-mini" style="margin:6px 0 0">These go down if this device goes down.</p>' : ''}</div>` : ''}
      ${d.formerAssets?.length ? `<p class="kv-mini">Former numbers: ${esc(d.formerAssets.join(', '))}</p>` : ''}
      ${d.disposal ? `<p class="kv-mini">Disposed ${esc(fmtDate(d.disposal.date))} · ${esc(d.disposal.method)} · data wipe confirmed</p>` : ''}
    </div>
    <div class="groups">
      <div class="group"><h4>Network interfaces</h4>
        ${(d.interfaces || []).length ? `<div class="tbl-wrap"><table class="ifaces"><thead><tr><th>Name</th><th>IP</th><th>MAC</th><th>Addressing</th><th>VLAN</th><th>Connected to</th></tr></thead>
        <tbody>${d.interfaces.map((i) => `<tr><td>${esc(i.name)}${i.primary ? ' <span class="pill c-acc nodot" style="font-size:10px;padding:1px 6px">primary</span>' : ''}</td><td>${esc(i.ip)}</td><td>${esc(i.mac)}</td><td>${esc(i.addressing)}</td><td>${esc(i.vlan)}</td><td>${linkAssets(i.connectedTo || '')}${i.port ? ' port ' + esc(i.port) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="kv-mini" style="margin:0">No interfaces entered.</p>'}
      </div>
      <div class="group"><h4>${esc(sec?.full)} details</h4>${dl(sfPairs)}</div>
      ${groups.join('')}
      <div class="group"><h4>Maintenance log</h4>
        ${(d.maintLog || []).length ? `<ul class="log">${[...d.maintLog].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((e) => {
          const dt = e.date ? new Date(e.date + 'T12:00') : null;
          return `<li><div class="date c-acc">${dt ? dt.getDate() : '?'}<small>${dt ? dt.toLocaleString('en-US', { month: 'short' }) + ' ' + String(dt.getFullYear()).slice(2) : ''}</small></div>
          <div><b>${esc(e.type || 'Maintenance')}${e.by ? ' · ' + esc(e.by) : ''}</b><p>${esc(e.work)}${e.parts ? ' · Parts: ' + esc(e.parts) : ''}${e.cost ? ' · ' + esc(fmtMoney(e.cost)) : ''}${e.ticket ? ' · ' + esc(e.ticket) : ''}</p></div></li>`;
        }).join('')}</ul>` : '<p class="kv-mini" style="margin:0">No maintenance logged.</p>'}
      </div>
      <div class="group"><h4>Ticket history</h4>
        ${(d.tickets || []).length ? `<div class="tbl-wrap"><table class="mtable"><thead><tr><th>Ticket</th><th>System</th><th>Opened</th><th>Closed</th><th>Summary</th></tr></thead><tbody>
        ${d.tickets.map((t) => `<tr><td class="mono">${t.link && /^https?:\/\//i.test(t.link) ? `<a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.number)}</a>` : esc(t.number)}</td><td>${esc(t.system)}</td><td>${esc(fmtDate(t.opened))}</td><td>${t.closed ? esc(fmtDate(t.closed)) : pill('Open', 'warn')}</td><td>${esc(t.summary)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="kv-mini" style="margin:0">No tickets recorded.</p>'}
      </div>
      ${(d.externalIds || []).length ? `<div class="group"><h4>External IDs</h4>${dl(d.externalIds.map((e) => [e.key, esc(e.value)]))}</div>` : ''}
      <div class="group"><h4>Attachments</h4>
        ${(d.attachments || []).length ? `<div class="dep">${d.attachments.map((a) => `<a href="#" data-att="${esc(a.id)}">${ui('file', 14)} ${esc(a.name)} <small class="kv-mini">${Math.max(1, Math.round((a.size || 0) / 1024))} KB</small></a>`).join('')}</div>` : '<p class="kv-mini" style="margin:0">None. Add manuals, config exports or invoices with Edit.</p>'}
      </div>
      ${d.notes ? `<div class="group"><h4>Notes</h4><p style="margin:0;white-space:pre-wrap">${esc(d.notes)}</p></div>` : ''}
      <div class="group"><h4>Change log</h4>
        <ul class="hist">${[...(d.history || [])].reverse().slice(0, 200).map((h) => `<li><small>${esc(fmtDateTime(h.at))}${h.by ? ' · ' + esc(h.by) : ''}</small><br><b>${esc(h.field)}</b>${h.from || h.to ? ` <span class="chg">${esc(h.from || '(blank)')} → ${esc(h.to || '(blank)')}</span>` : ''}</li>`).join('')}</ul>
        <p class="kv-mini" style="margin:6px 0 0">Created ${esc(fmtDateTime(d.created))}${d.createdBy ? ' by ' + esc(d.createdBy) : ''} · Updated ${esc(fmtDateTime(d.updated))}</p>
      </div>
    </div>
  </div>`;
}

function refresh(m, u) {
  const d = byUid(u); if (!d) return;
  m.el.innerHTML = html(d);
  wire(m, d);
  hydrateImages(m.el);
}

function wire(m, d) {
  const q = (s) => m.el.querySelector(s);
  m.el.querySelectorAll('[data-close]').forEach((b) => b.onclick = m.close);
  q('[data-a="edit"]').onclick = () => { m.close(); openForm(d.uid); };
  q('[data-a="label"]').onclick = () => openLabels([d.uid]);
  q('[data-a="verify"]').onclick = async () => { await patchDevice(d.uid, (x) => { x.lastVerified = todayStr(); }); toast(`${d.asset} marked verified today.`); refresh(m, d.uid); };
  q('[data-a="photo"]').onclick = () => q('[data-a="photofile"]').click();
  q('[data-a="photofile"]').onchange = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    try {
      const add = [];
      for (const f of files) { const s = await shrinkImage(f); add.push({ id: await putBlob(s.full, f.name), thumb: await putBlob(s.thumb, 'thumb-' + f.name) }); }
      await patchDevice(d.uid, (x) => { x.photos = [...(x.photos || []), ...add]; });
      toast(`${add.length} photo${add.length > 1 ? 's' : ''} added.`); refresh(m, d.uid);
    } catch (err) { toast(err.message); }
  };
  q('[data-a="maint"]').onclick = () => logMaintenance(d.uid, () => refresh(m, d.uid));
  q('[data-a="delete"]').onclick = async () => {
    const ok = await confirmBox(`Delete ${d.asset}?`, `<p>This removes ${esc(d.hostname || d.type)} and its photos from iTIMS for good. Its number ${esc(d.asset)} will not be reused.</p><p>To keep the record, set Lifecycle to Retired or Disposed instead.</p>`, { ok: 'Delete device', danger: true });
    if (ok) { await deleteDevice(d.uid); m.close(); toast(`${d.asset} deleted.`); }
  };
  m.el.querySelectorAll('.gallery img').forEach((img) => img.onclick = () => showPhoto(d, +img.dataset.i));
  q('.bigphoto')?.addEventListener('click', () => d.photos?.length && showPhoto(d, 0));
  m.el.querySelectorAll('[data-att]').forEach((a) => a.onclick = async (e) => { e.preventDefault(); const b = await getBlob(a.dataset.att); if (b) download(b.name || 'attachment', b.blob); });
  m.el.querySelectorAll('a[href^="#/device/"], a[href^="#/floorplan"]').forEach((a) => a.addEventListener('click', () => { m.el.parentElement.remove(); document.body.classList.remove('noscroll'); }));
}

async function showPhoto(d, i) {
  const ph = d.photos[i]; if (!ph) return;
  const u = await blobURL(ph.id);
  const m = modal(`<div class="m-head"><div><h2>${esc(d.asset)} · photo ${i + 1} of ${d.photos.length}</h2></div><button class="x" data-close aria-label="Close">×</button></div>
    <div class="m-pad" style="text-align:center"><img src="${u}" alt="" style="max-width:100%;max-height:70vh;border-radius:10px"></div>
    <div class="lfoot">${i > 0 ? '<button class="btn" data-first>Make this the main photo</button>' : ''}<button class="btn ghost" data-del style="color:var(--bad)">Remove photo</button><button class="btn" data-close>Close</button></div>`, { wide: true });
  m.el.querySelector('[data-first]')?.addEventListener('click', async () => {
    await patchDevice(d.uid, (x) => { const [p] = x.photos.splice(i, 1); x.photos.unshift(p); }); m.close(); reopen(d.uid);
  });
  m.el.querySelector('[data-del]').onclick = async () => {
    if (!await confirmBox('Remove this photo?', '<p>The photo is deleted from this device.</p>', { ok: 'Remove', danger: true })) return;
    await patchDevice(d.uid, (x) => { x.photos.splice(i, 1); }); m.close(); reopen(d.uid);
  };
}
function reopen(u) { if (current === u) { document.querySelector('.scrim.dev-scrim')?.remove(); openDevice(u, { fromHash: true }); } }

export function logMaintenance(u, after) {
  const d = byUid(u);
  const m = modal(`<div class="m-head"><div><h2>Log maintenance · ${esc(d.asset)}</h2><p class="kv-mini" style="margin:0">Updates Last Maintenance and Next Maintenance Due.</p></div><button class="x" data-close aria-label="Close">×</button></div>
    <div class="m-pad"><div class="form">
      <div><label class="req">Date</label><input type="date" name="date" value="${todayStr()}"></div>
      <div><label>Type</label><select name="type">${MAINT_TYPES.map((t) => `<option>${t}</option>`).join('')}</select></div>
      <div><label>Performed by</label><input name="by" value="${esc(state.settings.userName || '')}"></div>
      <div><label>Linked ticket</label><input name="ticket"></div>
      <div class="full"><label class="req">Work done</label><textarea name="work"></textarea></div>
      <div><label>Parts used</label><input name="parts"></div>
      <div><label>Cost</label><input name="cost" type="number" step="0.01" min="0" inputmode="decimal"></div>
      <div class="full"><label class="chkline"><input type="checkbox" name="clear" ${d.condition !== 'Operational' || d.lifecycle === 'Needs Maintenance' ? 'checked' : ''}> Set Condition to Operational${d.lifecycle === 'Needs Maintenance' ? ' and Lifecycle to Deployed' : ''}</label></div>
    </div><div class="err" data-err></div></div>
    <div class="lfoot"><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Save entry</button></div>`);
  m.el.querySelector('[data-ok]').onclick = async () => {
    const f = Object.fromEntries([...m.el.querySelectorAll('[name]')].map((i) => [i.name, i.type === 'checkbox' ? i.checked : i.value.trim()]));
    if (!f.date || !f.work) { m.el.querySelector('[data-err]').textContent = 'Date and Work done are required.'; return; }
    const entry = { date: f.date, type: f.type, by: f.by, work: f.work, parts: f.parts, cost: f.cost, ticket: f.ticket };
    await patchDevice(u, (x) => {
      x.maintLog = [...(x.maintLog || []), entry];
      if (f.clear) { x.condition = 'Operational'; if (x.lifecycle === 'Needs Maintenance') x.lifecycle = 'Deployed'; }
    });
    m.close(); toast('Maintenance logged.'); after?.();
  };
}
