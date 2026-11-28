// Scan a QR label with the camera. Normal mode opens the device; audit mode
// marks each scanned device as verified today and shows what is still missing.
import { state, byAsset, patchDevice, isActive } from '../store.js';
import { esc, todayStr } from '../util.js';
import { ui, modal } from '../ui.js';
import { openDevice } from './device.js';

let jsqrLoading = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  return (jsqrLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/jsQR.js';
    s.onload = () => res(window.jsQR); s.onerror = () => rej(new Error('QR reader did not load'));
    document.head.appendChild(s);
  }));
}

export function assetFromCode(text) {
  const t = String(text || '').trim();
  const m = /#\/device\/([A-Za-z]+-\d+)/.exec(t);
  return (m ? m[1] : t).toUpperCase();
}

export function openScanner({ audit = false } = {}) {
  const rooms = [...new Set(state.devices.filter(isActive).map((d) => d.room).filter(Boolean))].sort();
  const m = modal(`<div class="m-head"><div><h2>${audit ? 'Audit walk' : 'Scan a QR label'}</h2><p class="kv-mini" style="margin:0">${audit ? 'Each device you scan is marked verified today.' : 'Point the camera at an iTIMS label.'}</p></div><button class="x" data-close aria-label="Close">×</button></div>
    <div class="m-pad">
      <div class="seg" style="margin-bottom:10px"><button type="button" data-mode="open" aria-pressed="${!audit}">Open device</button><button type="button" data-mode="audit" aria-pressed="${audit}">Audit walk</button></div>
      <video class="scan-video" playsinline muted></video>
      <p class="kv-mini" data-msg style="margin:8px 0">Starting the camera…</p>
      <div class="addrow"><input data-manual placeholder="Or type or scan an asset number" autocomplete="off" style="font-family:var(--mono)"><button class="btn" data-go>Go</button></div>
      <div data-audit ${audit ? '' : 'hidden'} style="margin-top:12px">
        <div class="addrow"><select data-room><option value="">Any room</option>${rooms.map((r) => `<option>${esc(r)}</option>`).join('')}</select></div>
        <div data-progress style="margin-top:8px"></div>
      </div>
    </div>
    <div class="lfoot"><button class="btn" data-close>Done</button></div>`, { onClose: stop });
  const video = m.el.querySelector('video');
  const msg = m.el.querySelector('[data-msg]');
  const scanned = new Map();
  let stream = null; let raf = 0; let last = { code: '', at: 0 }; let alive = true;

  function stop() { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); }
  const progress = () => {
    const room = m.el.querySelector('[data-room]').value;
    const expected = state.devices.filter((d) => isActive(d) && (!room || d.room === room));
    const found = expected.filter((d) => scanned.has(d.uid));
    const missing = expected.filter((d) => !scanned.has(d.uid));
    m.el.querySelector('[data-progress]').innerHTML = `<b>${found.length} of ${expected.length}</b> ${room ? `in ${esc(room)} ` : ''}scanned.
      ${scanned.size ? `<div class="kv-mini" style="margin-top:4px">Scanned: ${[...scanned.values()].map((d) => esc(d.asset)).join(', ')}</div>` : ''}
      ${room && missing.length ? `<div class="kv-mini" style="margin-top:4px;color:var(--warn)">Not scanned yet: ${missing.slice(0, 40).map((d) => `${esc(d.asset)} ${esc(d.hostname || d.type)}`).join(', ')}${missing.length > 40 ? '…' : ''}</div>` : ''}`;
  };
  async function handle(code) {
    const a = assetFromCode(code);
    if (!a) return;
    const now = Date.now();
    if (a === last.code && now - last.at < 2500) return;
    last = { code: a, at: now };
    const d = byAsset(a);
    if (!d) { msg.innerHTML = `No device with number <b>${esc(a)}</b>.`; navigator.vibrate?.(200); return; }
    if (!audit) { m.close(); openDevice(d.uid); return; }
    navigator.vibrate?.(60);
    if (!scanned.has(d.uid)) { await patchDevice(d.uid, (x) => { x.lastVerified = todayStr(); }); scanned.set(d.uid, d); }
    msg.innerHTML = `${ui('check', 13)} <b>${esc(d.asset)}</b> ${esc(d.hostname || d.type)} verified.`;
    progress();
  }
  m.el.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => {
    audit = b.dataset.mode === 'audit';
    m.el.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    m.el.querySelector('[data-audit]').hidden = !audit;
    m.el.querySelector('h2').textContent = audit ? 'Audit walk' : 'Scan a QR label';
    if (audit) progress();
  });
  m.el.querySelector('[data-room]').onchange = progress;
  const manual = m.el.querySelector('[data-manual]');
  const go = () => { if (manual.value.trim()) { last = { code: '', at: 0 }; handle(manual.value); manual.value = ''; } };
  m.el.querySelector('[data-go]').onclick = go;
  manual.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  if (audit) progress();

  (async () => {
    if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = 'This browser cannot use the camera here. Type the asset number instead, or open iTIMS from its https address.'; video.hidden = true; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!alive) { stop(); return; }
      video.srcObject = stream; await video.play();
    } catch (e) {
      video.hidden = true;
      msg.textContent = e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this site in your browser settings, or type the asset number.' : 'No camera found. Type the asset number instead.';
      return;
    }
    let detect;
    if ('BarcodeDetector' in window) {
      try {
        const bd = new window.BarcodeDetector({ formats: ['qr_code'] });
        detect = async () => (await bd.detect(video))[0]?.rawValue;
      } catch { /* fall back to jsQR */ }
    }
    if (!detect) {
      try {
        const jsQR = await loadJsQR();
        const c = document.createElement('canvas'); const ctx = c.getContext('2d', { willReadFrequently: true });
        detect = async () => {
          const w = video.videoWidth; const h = video.videoHeight; if (!w) return '';
          const s = Math.min(1, 640 / w); c.width = w * s; c.height = h * s;
          ctx.drawImage(video, 0, 0, c.width, c.height);
          return jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' })?.data;
        };
      } catch (e) { msg.textContent = e.message; return; }
    }
    msg.textContent = audit ? 'Scanning. Walk the room and scan each label.' : 'Looking for a QR code…';
    let busy = false; let lastRun = 0;
    const loop = async (t) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (busy || t - lastRun < 200) return;
      busy = true; lastRun = t;
      try { const code = await detect(); if (code) await handle(code); } catch { /* frame not ready */ }
      busy = false;
    };
    raf = requestAnimationFrame(loop);
  })();
}
