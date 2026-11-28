// Add / edit form, built from the field dictionary in schema.js.
import { state, byUid, blankDevice, typesFor, previewAsset, saveDevice, suggestions, floorsFor, putBlob, delBlob, blobURL } from '../store.js';
import { SECTIONS, sectionById, SHARED_GROUPS, SECTION_FIELDS, STATIC_LISTS, ADDRESSING, MAINT_TYPES, DISPOSAL_METHODS } from '../schema.js';
import { esc, todayStr, shrinkImage } from '../util.js';
import { ui, modal, confirmBox, toast } from '../ui.js';
import { goBase } from '../app.js';

const ROWS = {
  interfaces: { cls: 'iface', title: 'Network interfaces', add: 'Add interface', blank: () => ({ name: '', ip: '', mac: '', addressing: 'Static', vlan: '', connectedTo: '', port: '', primary: false }),
    cols: [['name', 'Name', 'text', 'e.g. Ethernet, Wi-Fi, OOB'], ['ip', 'IP address', 'text'], ['mac', 'MAC address', 'text'], ['addressing', 'Addressing', ADDRESSING], ['vlan', 'VLAN', 'text'], ['connectedTo', 'Connected to', 'device'], ['port', 'Port', 'text'], ['primary', 'Primary', 'primary']] },
  maintLog: { cls: 'mlog', title: 'Maintenance log', add: 'Add entry', blank: () => ({ date: todayStr(), type: 'Preventive', by: state.settings.userName || '', work: '', parts: '', cost: '', ticket: '' }),
    cols: [['date', 'Date', 'date'], ['type', 'Type', MAINT_TYPES], ['by', 'Performed by', 'text'], ['work', 'Work done', 'text'], ['parts', 'Parts', 'text'], ['cost', 'Cost', 'number'], ['ticket', 'Ticket', 'text']] },
  tickets: { cls: 'tix', title: 'Ticket history', add: 'Add ticket', blank: () => ({ number: '', system: '', opened: todayStr(), closed: '', summary: '', link: '' }),
    cols: [['number', 'Ticket #', 'text'], ['system', 'System', 'text'], ['opened', 'Opened', 'date'], ['closed', 'Closed', 'date'], ['summary', 'Summary', 'text'], ['link', 'Link', 'text']] },
  externalIds: { cls: 'xid', title: 'External IDs', add: 'Add ID', blank: () => ({ key: '', value: '' }),
    cols: [['key', 'System', 'text', 'e.g. Intune, Meraki, AD'], ['value', 'ID', 'text']] },
};

export function openForm(u, { section } = {}) {
  document.querySelector('.scrim .dform')?.closest('.scrim')?.remove();
  const prev = u ? byUid(u) : null;
  let draft = prev ? structuredClone(prev) : blankDevice(sectionById(section) ? section : 'EU');
  const added = []; const removed = [];
  history.pushState(null, '', prev ? `#/edit/${prev.asset}` : `#/add/${draft.section}`);
  document.title = prev ? `Edit ${prev.asset} · iTIMS` : 'Add device · iTIMS';
  let saved = false;
  const m = modal(`<div class="dform"></div>`, { wide: true, onClose: () => {
    if (!saved) added.forEach((id) => delBlob(id));
    if (/^#\/(add|edit)\//.test(location.hash)) goBase();
  } });
  const root = m.el.querySelector('.dform');
  let initial = '';

  const render = (errs = [], warns = []) => {
    const keepScroll = m.el.scrollTop;
    root.innerHTML = html(draft, prev, errs, warns);
    wire();
    m.el.scrollTop = errs.length || warns.length ? 0 : keepScroll;
    root.querySelectorAll('img[data-blob]').forEach(async (img) => { img.src = await blobURL(img.dataset.blob); });
  };
  const collect = () => { draft = readForm(root, draft); return draft; };

  async function save(another) {
    collect();
    if (prev && prev.section !== draft.section) {
      const ok = await confirmBox('Move to another section?', `<p>Moving ${esc(prev.asset)} to ${esc(sectionById(draft.section).full)} gives it a new number, ${esc(previewAsset(draft.section))}. The old number stays on the record as a former number and is never reused.</p>`, { ok: 'Move and save' });
      if (!ok) return;
    }
    let r = await saveDevice(draft);
    if (r.needsConfirm) {
      const ok = await confirmBox('Save anyway?', `<ul>${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`, { ok: 'Save anyway' });
      if (!ok) return;
      r = await saveDevice(draft, { force: true });
    }
    if (!r.ok) { render(r.errors, r.warnings); return; }
    saved = true;
    for (const id of removed) await delBlob(id);
    toast(`${prev ? 'Saved' : 'Added'} ${r.device.asset}.`);
    if (another) {
      // Keep location and purchase details for fast bulk entry
      const keep = ['section', 'type', 'make', 'model', 'site', 'building', 'floor', 'room', 'owner', 'vendor', 'po', 'dateAcquired', 'warrantyExpires', 'maintInterval', 'maintCustomDays', 'condition', 'lifecycle'];
      const next = blankDevice(draft.section);
      for (const k of keep) next[k] = r.device[k];
      draft = next; added.length = 0; removed.length = 0; saved = false;
      history.replaceState(null, '', `#/add/${draft.section}`);
      render(); initial = JSON.stringify(collect());
      root.querySelector('[name="f.serial"]')?.focus();
      return;
    }
    m.close();
    const { openDevice } = await import('./device.js');
    openDevice(r.device.uid);
  }

  async function cancel() {
    if (JSON.stringify(collect()) !== initial && !(await confirmBox('Discard changes?', '<p>What you entered on this form will be lost.</p>', { ok: 'Discard', danger: true, cancel: 'Keep editing' }))) return;
    m.close();
  }

  function wire() {
    root.querySelectorAll('[data-close]').forEach((b) => { b.onclick = (e) => { e.stopImmediatePropagation(); cancel(); }; });
    root.querySelector('[data-save]').onclick = () => save(false);
    root.querySelector('[data-another]')?.addEventListener('click', () => save(true));
    // Fields that change what else the form shows
    root.querySelectorAll('[name="f.section"],[name="f.type"],[name="f.maintInterval"],[name="f.lifecycle"],[name="f.site"],[name="f.building"]').forEach((el) => {
      el.addEventListener('change', () => {
        collect();
        if (el.name === 'f.section' && !typesFor(draft.section).includes(draft.type)) draft.type = '';
        render();
        root.querySelector(`[name="${el.name}"]`)?.focus();
      });
    });
    root.querySelectorAll('[data-addrow]').forEach((b) => b.onclick = () => {
      collect(); const k = b.dataset.addrow;
      draft[k] = [...(draft[k] || []), ROWS[k].blank()];
      if (k === 'interfaces' && draft[k].length === 1) draft[k][0].primary = true;
      render();
      const rows = root.querySelectorAll(`[data-rows="${k}"] .rowed`);
      rows[rows.length - 1]?.querySelector('input')?.focus();
    });
    root.querySelectorAll('[data-delrow]').forEach((b) => b.onclick = () => {
      collect(); const [k, i] = b.dataset.delrow.split(':');
      draft[k].splice(+i, 1); render();
    });
    root.querySelectorAll('input[data-k="primary"]').forEach((r) => r.onchange = () => {
      root.querySelectorAll('input[data-k="primary"]').forEach((o) => { if (o !== r) o.checked = false; });
    });
    const pf = root.querySelector('[data-photofile]');
    root.querySelector('[data-addphoto]').onclick = () => pf.click();
    pf.onchange = async () => {
      collect();
      for (const f of pf.files) {
        try {
          const s = await shrinkImage(f);
          const id = await putBlob(s.full, f.name); const thumb = await putBlob(s.thumb, 'thumb-' + f.name);
          added.push(id, thumb); draft.photos.push({ id, thumb });
        } catch (e) { toast(`${f.name}: ${e.message}`); }
      }
      render();
    };
    root.querySelectorAll('[data-delphoto]').forEach((b) => b.onclick = () => {
      collect(); const [p] = draft.photos.splice(+b.dataset.delphoto, 1);
      removed.push(p.id); if (p.thumb) removed.push(p.thumb); render();
    });
    root.querySelectorAll('[data-firstphoto]').forEach((b) => b.onclick = () => {
      collect(); const [p] = draft.photos.splice(+b.dataset.firstphoto, 1); draft.photos.unshift(p); render();
    });
    const af = root.querySelector('[data-attfile]');
    root.querySelector('[data-addatt]').onclick = () => af.click();
    af.onchange = async () => {
      collect();
      for (const f of af.files) {
        if (f.size > 25 * 1024 * 1024) { toast(`${f.name} is over 25 MB, so it was skipped.`); continue; }
        const id = await putBlob(f, f.name, 'attachment');
        added.push(id); draft.attachments.push({ id, name: f.name, size: f.size, type: f.type });
      }
      render();
    };
    root.querySelectorAll('[data-delatt]').forEach((b) => b.onclick = () => {
      collect(); const [a] = draft.attachments.splice(+b.dataset.delatt, 1); removed.push(a.id); render();
    });
    root.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(false); } };
  }

  // The modal's own Escape/scrim close skips the discard check; route both through cancel.
  m.el.parentElement.addEventListener('mousedown', (e) => { if (e.target === m.el.parentElement) { e.stopImmediatePropagation(); cancel(); } }, true);
  document.addEventListener('keydown', function esc2(e) {
    if (!document.body.contains(root)) { document.removeEventListener('keydown', esc2, true); return; }
    if (e.key === 'Escape' && document.querySelector('.scrim:last-of-type') === m.el.parentElement) { e.stopImmediatePropagation(); cancel(); }
  }, true);

  render();
  initial = JSON.stringify(collect());
  setTimeout(() => root.querySelector(prev ? '[name="f.hostname"]' : '[name="f.type"]')?.focus(), 40);
}

// ---------- reading the form back into a draft ----------
function readForm(root, base) {
  const d = structuredClone(base);
  d.extra = { ...(d.extra || {}) };
  root.querySelectorAll('[name^="f."]').forEach((el) => { d[el.name.slice(2)] = el.type === 'checkbox' ? el.checked : el.value; });
  root.querySelectorAll('[name^="x."]').forEach((el) => {
    const k = el.name.slice(2);
    if (el.type === 'checkbox' && el.dataset.multi) {
      d.extra[k] = [...root.querySelectorAll(`[name="x.${k}"]:checked`)].map((c) => c.value);
    } else if (el.type === 'checkbox') d.extra[k] = el.checked ? true : '';
    else d.extra[k] = el.value;
  });
  for (const k of Object.keys(ROWS)) {
    const wrap = root.querySelector(`[data-rows="${k}"]`); if (!wrap) continue;
    d[k] = [...wrap.querySelectorAll('.rowed')].map((r) => {
      const o = {};
      r.querySelectorAll('[data-k]').forEach((el) => { o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
      return o;
    });
  }
  if (d.lifecycle === 'Disposed') {
    d.disposal = {
      date: root.querySelector('[name="disp.date"]')?.value || '',
      method: root.querySelector('[name="disp.method"]')?.value || '',
      wiped: !!root.querySelector('[name="disp.wiped"]')?.checked,
      wipeMethod: root.querySelector('[name="disp.wipeMethod"]')?.value || '',
      recipient: root.querySelector('[name="disp.recipient"]')?.value || '',
    };
  }
  return d;
}

// ---------- drawing the form ----------
let dlId = 0;
function datalist(values, labels) {
  const id = 'dl' + (++dlId);
  return { id, html: `<datalist id="${id}">${values.map((v, i) => `<option value="${esc(v)}">${labels ? esc(labels[i]) : ''}</option>`).join('')}</datalist>` };
}
const deviceList = (exceptUid) => {
  const list = state.devices.filter((o) => o.uid !== exceptUid);
  return datalist(list.map((o) => o.asset), list.map((o) => o.hostname || `${o.type} ${o.make} ${o.model}`.trim()));
};

function input(name, f, v, d) {
  const val = v ?? '';
  const mono = f.mono ? ' style="font-family:var(--mono)"' : '';
  switch (f.type) {
    case 'section':
      return `<select name="${name}">${SECTIONS.map((s) => `<option value="${s.id}" ${s.id === val ? 'selected' : ''}>${esc(s.full)} (${s.prefix}-)</option>`).join('')}</select>`;
    case 'devtype': {
      const types = typesFor(d.section); const opts = val && !types.includes(val) ? [...types, val] : types;
      return `<select name="${name}"><option value="">Pick a type</option>${opts.map((t) => `<option ${t === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    }
    case 'list': {
      const opts = f.options || STATIC_LISTS[f.list] || [];
      const all = val && !opts.includes(val) ? [...opts, val] : opts;
      return `<select name="${name}"><option value=""></option>${all.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }
    case 'managed': {
      let opts = [];
      if (f.list === 'sites') opts = state.lists.sites;
      else if (f.list === 'buildings') opts = state.lists.buildings.filter((b) => !d.site || b.site === d.site).map((b) => b.name);
      else if (f.list === 'floors') opts = floorsFor(d.site, d.building).map((x) => x.name);
      else opts = state.lists[f.list] || [];
      const dl = datalist([...new Set(opts)]);
      return `<input name="${name}" value="${esc(val)}" list="${dl.id}" autocomplete="off">${dl.html}`;
    }
    case 'suggest': case 'person': {
      const key = name.startsWith('x.') ? name : name.slice(2);
      const dl = datalist(suggestions(key, d.section));
      return `<input name="${name}" value="${esc(val)}" list="${dl.id}" autocomplete="off"${mono}>${dl.html}`;
    }
    case 'device': { const dl = deviceList(d.uid); return `<input name="${name}" value="${esc(val)}" list="${dl.id}" placeholder="Asset number" autocomplete="off" style="font-family:var(--mono)">${dl.html}`; }
    case 'devices': return `<input name="${name}" value="${esc(val)}" placeholder="e.g. SRV-0003, NW-0001" style="font-family:var(--mono)">`;
    case 'date': return `<input type="date" name="${name}" value="${esc(val)}">`;
    case 'number': return `<input type="number" name="${name}" value="${esc(val)}" inputmode="numeric">`;
    case 'currency': return `<input type="number" step="0.01" min="0" name="${name}" value="${esc(val)}" inputmode="decimal" placeholder="0.00">`;
    case 'longtext': return `<textarea name="${name}">${esc(val)}</textarea>`;
    case 'bool': return `<label class="chkline"><input type="checkbox" name="${name}" ${val === true || val === 'Yes' ? 'checked' : ''}> Yes</label>`;
    case 'multi': {
      const sel = [].concat(val || []);
      return `<div class="multi">${f.options.map((o) => `<label><input type="checkbox" name="${name}" data-multi="1" value="${esc(o)}" ${sel.includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div>`;
    }
    default: return `<input name="${name}" value="${esc(val)}" autocomplete="off"${mono}>`;
  }
}

function field(name, f, v, d) {
  const wide = f.full || ['longtext', 'multi'].includes(f.type);
  return `<div class="${wide ? 'full' : ''}"><label class="${f.req ? 'req' : ''}">${esc(f.label)}</label>${input(name, f, v, d)}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}

function rowsHtml(k, d) {
  const R = ROWS[k]; const list = d[k] || [];
  const devDl = R.cols.some((c) => c[2] === 'device') ? deviceList(d.uid) : null;
  return `<div class="fsec">${R.title}</div>
  <div class="full" data-rows="${k}" style="display:flex;flex-direction:column;gap:6px">
    ${list.map((row, i) => `<div class="rowed ${R.cls}">${R.cols.map(([key, label, type, ph]) => {
      const v = row[key] ?? '';
      let ctl;
      if (Array.isArray(type)) ctl = `<select data-k="${key}">${type.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      else if (type === 'primary') return `<label class="prim">${label}<input type="checkbox" data-k="primary" ${v ? 'checked' : ''}></label>`;
      else if (type === 'device') ctl = `<input data-k="${key}" value="${esc(v)}" list="${devDl.id}" placeholder="Asset # or text" autocomplete="off">`;
      else ctl = `<input data-k="${key}" type="${type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}" value="${esc(v)}"${ph ? ` placeholder="${esc(ph)}"` : ''}${['ip', 'mac'].includes(key) ? ' style="font-family:var(--mono)" autocomplete="off" spellcheck="false"' : ''}>`;
      return `<div><label>${label}</label>${ctl}</div>`;
    }).join('')}<button type="button" class="btn sm ghost" data-delrow="${k}:${i}" aria-label="Remove row" title="Remove">${ui('trash', 13)}</button></div>`).join('')}
    <div><button type="button" class="btn sm" data-addrow="${k}">${ui('plus', 12)}${R.add}</button></div>
    ${devDl ? devDl.html : ''}
  </div>`;
}

function html(d, prev, errs, warns) {
  const sec = sectionById(d.section);
  const assetLine = prev
    ? (prev.section !== d.section ? `Will become <b class="mono">${esc(previewAsset(d.section))}</b> (was ${esc(prev.asset)})` : `<b class="mono">${esc(prev.asset)}</b>`)
    : `Next number: <b class="mono">${esc(previewAsset(d.section))}</b> (assigned when you save)`;
  const shared = SHARED_GROUPS.filter((g) => !['identity', 'records'].includes(g.id)).map((g) => {
    const fields = g.fields.filter((f) => f.type !== 'auto' && (!f.showIf || f.showIf(d)));
    return `<div class="fsec">${g.title}</div>${fields.map((f) => field('f.' + f.key, f, d[f.key], d)).join('')}`;
  }).join('');
  const sf = (SECTION_FIELDS[d.section] || []).filter((f) => !f.types || !d.type || f.types.includes(d.type) || d.extra?.[f.key]);
  const ds = d.disposal || {};
  const disposal = d.lifecycle === 'Disposed' ? `<div class="fsec">Disposal</div>
    <div><label class="req">Disposal date</label><input type="date" name="disp.date" value="${esc(ds.date || todayStr())}"></div>
    <div><label class="req">Method</label><select name="disp.method"><option value=""></option>${DISPOSAL_METHODS.map((x) => `<option ${x === ds.method ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    <div><label>Wipe method</label><input name="disp.wipeMethod" value="${esc(ds.wipeMethod || '')}" placeholder="e.g. DoD 3-pass, shredded drive"></div>
    <div><label>Recipient / recycler</label><input name="disp.recipient" value="${esc(ds.recipient || '')}"></div>
    <div class="full"><label class="chkline"><input type="checkbox" name="disp.wiped" ${ds.wiped ? 'checked' : ''}> Data wipe confirmed</label></div>` : '';
  return `
  <div class="m-head">
    <div><h2>${prev ? `Edit ${esc(prev.asset)}` : `Add ${esc(sec.name.toLowerCase())} device`}</h2><div class="kv-mini">${assetLine}</div></div>
    <button class="x" data-close aria-label="Close">×</button>
  </div>
  <div class="m-pad">
    ${errs.length ? `<div class="errs" role="alert"><b>Fix these to save:</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    ${warns.length && !errs.length ? '' : warns.length ? `<div class="warns" style="margin-top:8px"><b>Also note:</b><ul>${warns.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    <div class="form" style="margin-top:${errs.length ? 12 : 0}px">
      <div class="fsec">Identity</div>
      ${SHARED_GROUPS[0].fields.filter((f) => f.type !== 'auto').map((f) => field('f.' + f.key, f, d[f.key], d)).join('')}
      <div class="fsec">Photos</div>
      <div class="full"><div class="thumbs">
        ${(d.photos || []).map((p, i) => `<div class="t"><img data-blob="${esc(p.thumb || p.id)}" alt="Photo ${i + 1}"><button type="button" data-delphoto="${i}" aria-label="Remove photo">×</button>${i === 0 ? '<span class="first">Main</span>' : `<span class="first" data-firstphoto="${i}" style="cursor:pointer">Make main</span>`}</div>`).join('')}
        <button type="button" class="add" data-addphoto aria-label="Add photo">${ui('camera', 22, 1.6)}</button>
      </div><input type="file" accept="image/*" multiple data-photofile hidden><div class="hint">Photos are shrunk to save space. On a phone you can take one with the camera.</div></div>
      ${rowsHtml('interfaces', d)}
      <div class="fsec">${esc(sec.full)} details</div>
      ${sf.length ? sf.map((f) => field('x.' + f.key, f, d.extra?.[f.key], d)).join('') : '<p class="kv-mini full" style="margin:0">Pick a device type to see its fields.</p>'}
      ${shared}
      ${disposal}
      ${rowsHtml('maintLog', d)}
      ${rowsHtml('tickets', d)}
      ${rowsHtml('externalIds', d)}
      <div class="fsec">Attachments</div>
      <div class="full"><div class="mlist">${(d.attachments || []).map((a, i) => `<div class="mi">${ui('file', 14)}<span>${esc(a.name)} <small>${Math.max(1, Math.round((a.size || 0) / 1024))} KB</small></span><button type="button" class="btn sm ghost" data-delatt="${i}">Remove</button></div>`).join('')}</div>
        <button type="button" class="btn sm" data-addatt style="margin-top:6px">${ui('upload', 12)}Attach file</button><input type="file" multiple data-attfile hidden>
        <div class="hint">Manuals, config exports, invoices. Up to 25 MB each.</div></div>
      <div class="fsec">Notes</div>
      ${field('f.notes', { label: 'Notes', type: 'longtext' }, d.notes, d)}
    </div>
  </div>
  <div class="lfoot" style="position:sticky;bottom:0;background:var(--card)">
    <span class="kv-mini" style="margin-right:auto;align-self:center">* required</span>
    <button type="button" class="btn" data-close>Cancel</button>
    ${prev ? '' : `<button type="button" class="btn" data-another>Save and add another</button>`}
    <button type="button" class="btn primary" data-save>${ui('check', 13)}${prev ? 'Save changes' : 'Save device'}</button>
  </div>`;
}
