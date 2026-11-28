// Floorplan: upload a plan image per floor, drop device pins on it, drag to move.
import { state, saveLists, devicesOnFloor, patchDevice, putBlob, delBlob, primaryIface, byUid, isActive } from '../store.js';
import { SECTIONS } from '../schema.js';
import { esc, uid, shrinkImage } from '../util.js';
import { ui, ico, condPill, photoBox, pinTone, emptyState, hydrateImages, modal, toast, confirmBox } from '../ui.js';
import { iconKey } from '../schema.js';
import { app, searchFilter } from '../app.js';
import { openDevice } from './device.js';

const LS = 'itims.floor';
let sel = (() => { try { return localStorage.getItem(LS) || ''; } catch { return ''; } })();
let placing = null;
let secFilter = '';
const floorLabel = (f) => [f.site, f.building, f.name].filter(Boolean).join(' › ');

export function renderFloorplan(el) {
  const floors = state.lists.floors;
  let focus = app.route.param ? byUid(app.route.param) : null;
  if (focus) {
    const f = floors.find((x) => x.site === focus.site && (x.building || '') === (focus.building || '') && x.name === focus.floor);
    if (f) sel = f.id;
  }
  if (!floors.length) {
    el.innerHTML = `<section class="card">${emptyState('No floors yet',
      'Floors are created when you give a device a Site, Building and Floor. You can also add one here, then upload a floorplan image (a photo of the fire-escape map works).',
      `<button class="btn primary" data-addfloor>${ui('plus', 13)}Add a floor</button>`)}</section>`;
    el.querySelector('[data-addfloor]').onclick = addFloor;
    return;
  }
  let f = floors.find((x) => x.id === sel) || floors[0];
  sel = f.id;
  try { localStorage.setItem(LS, sel); } catch { /* ignore */ }
  const all = devicesOnFloor(f).filter((d) => isActive(d) || focus?.uid === d.uid);
  const shown = searchFilter(all).filter((d) => !secFilter || d.section === secFilter);
  const placed = shown.filter((d) => d.x != null);
  const unplaced = shown.filter((d) => d.x == null);
  el.innerHTML = `<section class="card">
    <div class="fp-bar">
      <select id="fpf" aria-label="Floor">${floors.map((x) => `<option value="${x.id}" ${x.id === f.id ? 'selected' : ''}>${esc(floorLabel(x))} (${devicesOnFloor(x).length})</option>`).join('')}</select>
      <select id="fps" aria-label="Section"><option value="">All sections</option>${SECTIONS.map((s) => `<option value="${s.id}" ${s.id === secFilter ? 'selected' : ''}>${esc(s.full)}</option>`).join('')}</select>
      <button class="btn" data-upload>${ui('upload', 13)}${f.plan ? 'Replace plan image' : 'Upload plan image'}</button>
      <button class="btn ghost" data-addfloor>${ui('plus', 13)}Add floor</button>
      ${f.plan ? `<button class="btn ghost" data-rmplan style="color:var(--bad)">Remove image</button>` : ''}
      <input type="file" accept="image/*" data-file hidden>
      <span class="kv-mini" style="margin-left:auto">${placed.length} placed · ${unplaced.length} not placed</span>
    </div>
    <div class="plan-wrap">
      <div class="fp-stage ${placing ? 'placing' : ''}" data-stage>
        ${f.plan ? `<img class="plan-img" data-blob="${esc(f.plan)}" alt="Floorplan of ${esc(floorLabel(f))}" draggable="false">`
          : `<div class="plan-img" style="aspect-ratio:1000/600;display:grid;place-items:center;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:40px 40px;color:var(--muted);text-align:center;padding:20px">No plan image yet. Upload one, or place pins on this grid.</div>`}
        ${placed.map((d) => `<button class="pin ${pinTone(d)}${focus?.uid === d.uid ? ' focus' : ''}" data-uid="${d.uid}" style="left:${d.x}%;top:${d.y}%" aria-label="${esc(d.asset)} ${esc(d.hostname || d.type)}">${ico(iconKey(d), 2)}</button>`).join('')}
      </div>
      <div class="legend">
        <span><i style="background:var(--ok)"></i>Operational</span><span><i style="background:var(--warn)"></i>Degraded or issue</span><span><i style="background:var(--bad)"></i>Down</span><span><i style="background:var(--info)"></i>Hot spare</span>
        <span style="margin-left:auto">Drag a pin to move it. Tap a pin for details.</span>
      </div>
    </div>
    <div class="unplaced">
      ${unplaced.length ? `<b class="kv-mini" style="margin-right:4px">${placing ? 'Now tap the plan where it goes:' : 'Not on the plan yet, tap one, then tap the plan:'}</b>
        ${unplaced.map((d) => `<button class="chip" data-place="${d.uid}" aria-pressed="${placing === d.uid}">${esc(d.asset)} ${esc(d.hostname || d.type)}</button>`).join('')}
        ${placing ? '<button class="btn sm ghost" data-cancelplace>Cancel</button>' : ''}`
        : `<span class="kv-mini">${all.length ? 'Every device on this floor is on the plan.' : 'No devices on this floor yet. Set a device\'s Site, Building and Floor to match.'}</span>`}
    </div>
  </section>`;
  hydrateImages(el);
  wire(el, f);
  if (focus) setTimeout(() => el.querySelector(`.pin[data-uid="${focus.uid}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
}

function wire(el, f) {
  const q = (s) => el.querySelector(s);
  const rerender = () => { renderFloorplan(el); };
  q('#fpf').onchange = (e) => { sel = e.target.value; placing = null; app.route.param = ''; history.replaceState(null, '', '#/floorplan'); rerender(); };
  q('#fps').onchange = (e) => { secFilter = e.target.value; rerender(); };
  el.querySelectorAll('[data-addfloor]').forEach((b) => b.onclick = addFloor);
  q('[data-upload]').onclick = () => q('[data-file]').click();
  q('[data-file]').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const s = await shrinkImage(file, 2400, 200);
      const old = f.plan;
      f.plan = await putBlob(s.full, file.name, 'floorplan');
      await saveLists();
      if (old) await delBlob(old);
      toast('Plan image saved.'); rerender();
    } catch (err) { toast(err.message); }
  };
  q('[data-rmplan]')?.addEventListener('click', async () => {
    if (!await confirmBox('Remove the plan image?', '<p>Pins keep their positions, so a new image of the same floor lines up again.</p>', { ok: 'Remove', danger: true })) return;
    const old = f.plan; f.plan = null; await saveLists(); await delBlob(old); rerender();
  });
  el.querySelectorAll('[data-place]').forEach((b) => b.onclick = () => { placing = placing === b.dataset.place ? null : b.dataset.place; rerender(); });
  q('[data-cancelplace]')?.addEventListener('click', () => { placing = null; rerender(); });
  const stage = q('[data-stage]');
  const pct = (e) => { const r = stage.getBoundingClientRect(); return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) }; };
  stage.addEventListener('click', async (e) => {
    if (!placing || e.target.closest('.pin,.pop')) return;
    const p = pct(e); const u = placing; placing = null;
    await patchDevice(u, (d) => { d.x = +p.x.toFixed(2); d.y = +p.y.toFixed(2); });
  });
  // Pins: drag to move, tap or hover for details
  el.querySelectorAll('.pin').forEach((pin) => {
    let start = null; let moved = false;
    pin.addEventListener('pointerdown', (e) => { if (e.button) return; start = { x: e.clientX, y: e.clientY }; moved = false; pin.setPointerCapture(e.pointerId); });
    pin.addEventListener('pointermove', (e) => {
      if (!start) return;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) return;
      moved = true; closePop(el);
      const p = pct(e); pin.style.left = p.x + '%'; pin.style.top = p.y + '%';
    });
    pin.addEventListener('pointerup', async (e) => {
      if (!start) return; start = null;
      if (moved) { const p = pct(e); await patchDevice(pin.dataset.uid, (d) => { d.x = +p.x.toFixed(2); d.y = +p.y.toFixed(2); }); return; }
      showPop(el, pin);
    });
    pin.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !start) showPop(el, pin); });
    pin.addEventListener('dblclick', () => openDevice(pin.dataset.uid));
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDevice(pin.dataset.uid); });
  });
  stage.addEventListener('pointerleave', () => { if (!stage.querySelector('.pop:hover')) closePop(el); });
}

function closePop(el) { el.querySelectorAll('.pop').forEach((p) => p.remove()); }
function showPop(el, pin) {
  closePop(el);
  const d = byUid(pin.dataset.uid); if (!d) return;
  const p = primaryIface(d);
  const stage = pin.parentElement;
  const pop = document.createElement('div');
  pop.className = 'pop';
  pop.innerHTML = `${photoBox(d, '', true)}
    <div class="pt"><span>${esc(d.hostname || `${d.make} ${d.model}`)}</span>${condPill(d)}</div>
    <dl><dt>Asset</dt><dd>${esc(d.asset)}</dd><dt>IP</dt><dd>${esc(p?.ip || '—')}</dd><dt>MAC</dt><dd>${esc(p?.mac || '—')}</dd>${d.room ? `<dt>Room</dt><dd style="font-family:inherit">${esc(d.room)}</dd>` : ''}${d.assignedUser ? `<dt>User</dt><dd style="font-family:inherit">${esc(d.assignedUser)}</dd>` : ''}</dl>
    <div class="actions" style="margin-top:8px"><button class="btn sm primary" data-open>Open</button><button class="btn sm ghost" data-unplace>Take off plan</button></div>`;
  const x = parseFloat(pin.style.left); const y = parseFloat(pin.style.top);
  pop.style.left = x > 60 ? '' : `calc(${x}% + 18px)`;
  pop.style.right = x > 60 ? `calc(${100 - x}% + 18px)` : '';
  pop.style.top = y > 55 ? '' : `calc(${y}% - 10px)`;
  pop.style.bottom = y > 55 ? `calc(${100 - y}% - 10px)` : '';
  stage.appendChild(pop);
  hydrateImages(pop);
  pop.querySelector('[data-open]').onclick = () => openDevice(d.uid);
  pop.querySelector('[data-unplace]').onclick = () => patchDevice(d.uid, (x2) => { x2.x = null; x2.y = null; });
  pop.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pop.remove(); });
  const off = (e) => { if (!pop.contains(e.target) && e.target !== pin) { pop.remove(); document.removeEventListener('pointerdown', off); } };
  setTimeout(() => document.addEventListener('pointerdown', off), 0);
}

function addFloor() {
  const sites = state.lists.sites;
  const m = modal(`<div class="m-head"><div><h2>Add a floor</h2></div><button class="x" data-close aria-label="Close">×</button></div>
    <div class="m-pad"><div class="form">
      <div><label class="req">Site</label><input name="site" list="fl-sites" value="${esc(sites[0] || '')}"><datalist id="fl-sites">${sites.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div><label>Building</label><input name="building" list="fl-b"><datalist id="fl-b">${[...new Set(state.lists.buildings.map((b) => b.name))].map((s) => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div><label class="req">Floor</label><input name="name" placeholder="e.g. 1, Ground, Mezzanine"></div>
    </div><div class="err" data-err></div></div>
    <div class="lfoot"><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Add floor</button></div>`);
  m.el.querySelector('[data-ok]').onclick = async () => {
    const v = Object.fromEntries([...m.el.querySelectorAll('input[name]')].map((i) => [i.name, i.value.trim()]));
    if (!v.site || !v.name) { m.el.querySelector('[data-err]').textContent = 'Site and Floor are required.'; return; }
    if (state.lists.floors.some((x) => x.site === v.site && (x.building || '') === v.building && x.name === v.name)) { m.el.querySelector('[data-err]').textContent = 'That floor already exists.'; return; }
    if (!state.lists.sites.includes(v.site)) state.lists.sites.push(v.site);
    if (v.building && !state.lists.buildings.some((b) => b.site === v.site && b.name === v.building)) state.lists.buildings.push({ site: v.site, name: v.building });
    const f = { id: uid(), site: v.site, building: v.building, name: v.name, plan: null };
    state.lists.floors.push(f); sel = f.id;
    await saveLists(); m.close(); app.rerender();
  };
}
