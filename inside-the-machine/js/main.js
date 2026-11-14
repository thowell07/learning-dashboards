// App core: one renderer, hash router, view lifecycle, the brief sheet, the text version dialog.
import { THREE, Tags, tickTweens, clearTweens, motion, keyOrbit, disposeScene, h, esc, lerp } from './kit.js';
import { STOPS, LAYERS, BRIEFS, FLAGSHIPS, stopByN } from './content.js';
import { createMap } from './map.js';
import { createStop4 } from './stop4.js';
import { createStop10 } from './stop10.js';
import { createStop11 } from './stop11.js';
import { createStop12 } from './stop12.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#gl'), stageEl = $('#stage'), hud = $('#hud'), briefEl = $('#brief'), veil = $('#veil');
const crumb = $('#crumb'), topnav = $('#topnav'), dlg = $('#textalt');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  const f = $('#fatal'); f.hidden = false;
  f.textContent = 'This browser could not start WebGL, which the 3D models need. Reload with WebGL enabled, or open this page in a current version of Chrome, Safari, Edge, or Firefox.';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const tags = new Tags($('#tags'));
const factories = { map: createMap, 4: createStop4, 10: createStop10, 11: createStop11, 12: createStop12 };
// Round 2 stops live in their own files. Each exports createStop(ctx) and BRIEF. A stop that fails to load stays a preview on the map.
const ROUND2 = [1, 2, 3, 5, 6, 7, 8, 9, 13, 14];
const loaded = await Promise.allSettled(ROUND2.map((n) => import(`./stop${n}.js`)));
loaded.forEach((r, i) => {
  const n = ROUND2[i];
  if (r.status === 'rejected') { console.error(`Stop ${n} failed to load`, r.reason); return; }
  if (typeof r.value.createStop !== 'function') return;
  factories[n] = r.value.createStop; if (r.value.BRIEF) BRIEFS[n] = r.value.BRIEF; stopByN(n).flagship = true;
});
FLAGSHIPS.length = 0; FLAGSHIPS.push(...STOPS.filter((s) => s.flagship).map((s) => s.n));
let view = null, viewKey = null, W = 1, H = 1;
const off = { x: 0, y: 0, tx: 0, ty: 0 };

const isNarrow = () => window.innerWidth < 1000;

function freeArea() {
  // The part of the canvas not covered by interface plates. The model is centered there.
  if (!view) return { l: 0, r: 0, t: 0, b: 0 };
  const ins = view.insets ? view.insets() : {};
  if (isNarrow()) { document.documentElement.style.setProperty('--free-l', '0px'); return { l: 0, r: 0, t: 0, b: 0, ...(viewKey === 'map' ? ins : {}) }; }
  const deck = hud.querySelector('.deck');
  const deckH = deck ? deck.getBoundingClientRect().height + 26 : 0;
  document.documentElement.style.setProperty('--deck-h', `${Math.round(deckH)}px`);
  const b = ins.b ?? deckH;
  const present = document.body.classList.contains('present');
  const l = present ? 476 : ins.l ?? (hud.querySelector('.stop') ? (window.innerWidth <= 1240 ? 400 : 446) : 0);
  const r = ins.r ?? (briefEl.hidden ? 0 : briefEl.classList.contains('open') ? 440 : 60);
  document.documentElement.style.setProperty('--free-l', `${l}px`); // the caption stays clear of the left column
  const t = guide && !present ? guide.bar.getBoundingClientRect().bottom + 6 : ins.t ?? 52;
  return { l, r: present ? 0 : r, t, b };
}
// The two right-hand plates share one column. When the upper one is tall, the lower one gets a scroll cap so they never overlap.
const floatSeen = new WeakSet();
const floatRO = new ResizeObserver(() => fitFloats());
function fitFloats() {
  const tr = hud.querySelector('.float-tr'), br = hud.querySelector('.float-br');
  if (!br) return;
  br.style.maxHeight = ''; br.style.overflowY = '';
  if (!tr) return;
  if (!floatSeen.has(tr)) { floatSeen.add(tr); floatRO.observe(tr); }
  if (isNarrow() || document.body.classList.contains('present')) return;
  const a = tr.getBoundingClientRect(), b = br.getBoundingClientRect();
  if (!a.height || !b.height || a.left >= b.right || a.right <= b.left || a.bottom + 10 <= b.top) return;
  br.style.maxHeight = `${Math.max(96, Math.round(b.bottom - a.bottom - 10))}px`; br.style.overflowY = 'auto';
}
function applyInsets(snap) {
  fitFloats();
  const f = freeArea();
  off.tx = (f.l - f.r) / 2; off.ty = (f.t - f.b) / 2;
  if (snap || motion.reduced) { off.x = off.tx; off.y = off.ty; }
}
function frameView() {
  if (!view) return;
  const f = freeArea();
  document.body.classList.toggle('tight', !isNarrow() && W - f.l - f.r < 520); // a small model drops its label subtitles
  view.frame && view.frame({ W, H, freeW: Math.max(120, W - f.l - f.r), freeH: Math.max(120, H - f.t - f.b) });
}
function resize() {
  const r = stageEl.getBoundingClientRect();
  W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
  renderer.setSize(W, H, false);
  if (view) { view.camera.aspect = W / H; view.camera.updateProjectionMatrix(); }
  applyInsets(true); frameView();
}
new ResizeObserver(resize).observe(stageEl);
window.addEventListener('resize', resize);

// ---------- render loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  tickTweens(dt);
  if (view) {
    off.x = lerp(off.x, off.tx, Math.min(1, dt * 7)); off.y = lerp(off.y, off.ty, Math.min(1, dt * 7));
    if (Math.abs(off.x) > 0.5 || Math.abs(off.y) > 0.5) view.camera.setViewOffset(W, H, -off.x, -off.y, W, H); else view.camera.clearViewOffset();
    view.controls && view.controls.update();
    view.update && view.update(dt, now / 1000);
    renderer.render(view.scene, view.camera);
    tags.update(view.camera, W, H);
  }
  requestAnimationFrame(loop);
}

// ---------- routing ----------
function parse() {
  const m = location.hash.replace(/^#\/?/, '').split('/');
  if (m[0] === 'stop' && FLAGSHIPS.includes(Number(m[1]))) return { key: Number(m[1]) };
  if (m[0] === 'map' && stopByN(m[1])) return { key: 'map', sel: Number(m[1]) };
  return { key: 'map' };
}
const ctx = {
  canvas, renderer, tags, hud, isNarrow,
  go: (hash) => { location.hash = hash; },
  refit: () => { applyInsets(false); },
  reframe: () => { applyInsets(true); frameView(); },
  openBrief: (open = true) => setBrief(open),
  announce: (msg) => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); },
  rebuild: () => { // remount the current view in place, for a layout that is chosen once at creation
    if (rebuilding || switching || !view) return; rebuilding = true;
    requestAnimationFrame(() => { const k = viewKey, r = parse(); unmount(); view = factories[k](ctx); renderTop(k); renderBrief(k); resize(); if (view.select && r.sel) view.select(r.sel); rebuilding = false; });
  },
};
let rebuilding = false;
const live = h('div', { class: 'sr', 'aria-live': 'polite', role: 'status' }); document.body.append(live);

let switching = false, introDone = false;
async function route() {
  const r = parse();
  if (r.key === viewKey) { if (view && view.select) view.select(r.sel ?? null); return; }
  if (switching) return; switching = true;
  if (view) {
    titleCard(r.key); veil.classList.add('on');
    if (!motion.reduced) await new Promise((res) => setTimeout(res, r.key === 'map' ? 330 : 720));
  }
  unmount();
  viewKey = r.key;
  ctx.intro = !introDone && r.key === 'map' && !r.sel; introDone = true;
  document.body.className = r.key === 'map' ? 'view-map' : 'view-stop';
  view = factories[r.key](ctx);
  renderTop(r.key); renderBrief(r.key);
  markVisited(r.key);
  resize();
  if (view.select && r.sel) view.select(r.sel);
  requestAnimationFrame(() => { resize(); veil.classList.remove('on'); });
  const h1 = hud.querySelector('h1'); if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  switching = false;
  if (parse().key !== viewKey) route();
}
function titleCard(key) {
  veil.replaceChildren();
  if (key === 'map') return;
  const s = stopByN(key), layer = LAYERS.find((l) => l.id === s.layer);
  veil.append(h('div', { class: 'titlecard' }, h('span', { class: 'tc-n' }, String(s.n).padStart(2, '0')), h('span', { class: 'tc-cap' }, `Layer ${layer.id} · ${layer.place}`), h('span', { class: 'tc-title' }, s.title)));
}
function unmount() {
  if (!view) return;
  endGuide(true);
  clearTweens();
  view.dispose && view.dispose();
  view.controls && view.controls.dispose();
  disposeScene(view.scene);
  tags.clear(); hud.replaceChildren();
  document.querySelectorAll('.brief-fab, .approval').forEach((e) => e.remove());
  document.body.classList.remove('cards-on');
  view = null;
}
window.addEventListener('hashchange', route);

// ---------- top bar ----------
function renderRail(key) {
  const seen = visited();
  $('#rail').replaceChildren(...LAYERS.map((l) => h('span', { class: 'rl-grp' }, STOPS.filter((s) => s.layer === l.id).map((s) => h('a', {
    class: `rl-tick${s.n === key ? ' now' : ''}${seen.includes(s.n) ? ' seen' : ''}${s.flagship ? '' : ' closed'}`, href: s.flagship ? `#/stop/${s.n}` : `#/map/${s.n}`,
    'aria-label': `Stop ${s.n}, ${s.title}${s.n === key ? ', you are here' : seen.includes(s.n) ? ', visited' : ''}`, 'aria-current': s.n === key ? 'page' : null,
  }, h('i'), h('span', { class: 'rl-tip', 'aria-hidden': 'true' }, h('b', {}, `${String(s.n).padStart(2, '0')} · ${s.title}`), h('em', {}, `Layer ${l.id} · ${l.place}`)))))));
}
function renderTop(key) {
  topnav.replaceChildren(); renderRail(key);
  const ta = h('button', { class: 'btn ghost sm', type: 'button', onclick: openTextAlt }, 'Text version');
  if (key === 'map') { crumb.textContent = 'The map · 14 stops in 4 layers'; document.title = 'Inside the Machine'; topnav.append(ta); return; }
  const s = stopByN(key), layer = LAYERS.find((l) => l.id === s.layer);
  crumb.textContent = `Stop ${String(s.n).padStart(2, '0')} · Layer ${layer.id} · ${layer.name}`;
  document.title = `Stop ${s.n} · ${s.title} · Inside the Machine`;
  const i = FLAGSHIPS.indexOf(key), prev = FLAGSHIPS[i - 1], next = FLAGSHIPS[i + 1];
  topnav.append(...[
    view && view.beats && view.beats.length ? h('button', { class: 'btn sm guide-btn', type: 'button', 'aria-pressed': 'false', onclick: () => (guide ? endGuide() : startGuide()) }, 'Guide me') : null,
    h('a', { class: 'btn ghost sm', href: '#/' }, 'Map'),
    prev ? h('a', { class: 'btn ghost sm', href: `#/stop/${prev}`, 'aria-label': `Previous open stop: ${stopByN(prev).title}` }, '←', h('span', { class: 'sr' }, 'Previous')) : null,
    next ? h('a', { class: 'btn ghost sm', href: `#/stop/${next}`, 'aria-label': `Next open stop: ${stopByN(next).title}` }, h('span', {}, isNarrow() ? '' : `Stop ${next}`), '→') : null,
    ta,
  ].filter(Boolean));
}

// ---------- the brief ----------
function setBrief(open) {
  briefEl.classList.toggle('open', open);
  const tab = briefEl.querySelector('.brief-tab');
  if (tab) { tab.setAttribute('aria-expanded', String(open)); tab.querySelector('.bt-arrow').textContent = open ? '→' : '←'; }
  const sheet = briefEl.querySelector('.brief-sheet'); if (sheet) sheet.inert = !open;
  applyInsets(false); frameView();
}
function renderBrief(key) {
  briefEl.replaceChildren(); briefEl.classList.remove('open');
  const b = BRIEFS[key];
  if (!b) { briefEl.hidden = true; return; }
  briefEl.hidden = false;
  const s = stopByN(key);
  const tab = h('button', { class: 'brief-tab', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'brief-sheet', onclick: () => setBrief(!briefEl.classList.contains('open')) },
    h('span', { class: 'bt-arrow', 'aria-hidden': 'true' }, '←'), h('span', { class: 'bt-title' }, 'The brief'), h('span', { class: 'bt-idx' }, 'Misconception · Law · Ask · Say · Check'));
  const runDemo = (name) => { if (isNarrow()) setBrief(false); view && view.demos && view.demos[name] && view.demos[name](); };
  const sheet = h('div', { class: 'brief-sheet', id: 'brief-sheet', tabindex: '-1' },
    h('button', { class: 'btn sm paperbtn brief-close', type: 'button', onclick: () => { setBrief(false); (briefEl.querySelector('.brief-tab').offsetParent ? briefEl.querySelector('.brief-tab') : document.querySelector('.brief-fab'))?.focus(); } }, 'Close'),
    h('div', { class: 'cap' }, `The brief · Stop ${String(s.n).padStart(2, '0')}`),
    h('h2', {}, s.title),
    h('p', { class: 'claim' }, s.claim),
    h('p', { class: 'define' }, b.define),
    h('section', {}, h('h3', {}, 'The misconception it kills', h('i', {}, `${b.misconceptions.length}`)),
      b.misconceptions.map((m) => h('div', { class: 'mis' },
        h('p', { class: 'wrong' }, `“${m.wrong}”`), h('p', { class: 'right' }, m.right),
        h('button', { class: 'btn sm paperbtn', type: 'button', onclick: () => runDemo(m.demo) }, 'Show me in the model: ' + m.demoLabel)))),
    h('section', {}, h('h3', {}, 'The legal consequence'), h('p', {}, b.legal), h('p', { class: 'legalnote' }, 'General principles for teaching. This is not legal advice.')),
    h('section', {}, h('h3', {}, 'The question to ask'), h('ul', { class: 'asks' }, b.ask.map((q) => h('li', {}, q)))),
    h('section', {}, h('h3', {}, 'Say it in a meeting'), h('blockquote', { class: 'say' }, b.say)),
    h('section', {}, h('h3', {}, 'Check yourself', h('i', {}, '3')),
      b.checks.map((c, i) => {
        const a = h('p', { class: 'a', id: `chk-${key}-${i}`, hidden: true }, c.a);
        const btn = h('button', { class: 'btn sm paperbtn', type: 'button', 'aria-expanded': 'false', 'aria-controls': a.id, onclick: () => { a.hidden = !a.hidden; btn.setAttribute('aria-expanded', String(!a.hidden)); btn.textContent = a.hidden ? 'Reveal the answer' : 'Hide the answer'; } }, 'Reveal the answer');
        return h('div', { class: 'check' }, h('p', { class: 'q' }, `${i + 1}. ${c.q}`), btn, a);
      })),
  );
  sheet.inert = true;
  briefEl.append(tab, sheet);
  const fab = h('button', { class: 'btn primary brief-fab', type: 'button', onclick: () => { setBrief(true); sheet.focus(); } }, 'The brief');
  document.body.append(fab);
}

// ---------- text version ----------
function openTextAlt() {
  const body = $('#textalt-body');
  body.innerHTML = view && view.textAlt ? view.textAlt() : '<p>No text version for this view.</p>';
  $('#textalt-title').textContent = viewKey === 'map' ? 'Text version of the map' : `Text version of stop ${viewKey}`;
  dlg.showModal();
}
$('#textalt-close').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); if (e.target.closest && e.target.closest('a[href^="#/"]')) dlg.close(); });

// ---------- visited stops (local storage only, optional) ----------
function visited() { try { return JSON.parse(localStorage.getItem('itm-visited') || '[]'); } catch { return []; } }
function markVisited(key) { if (key === 'map') return; try { const v = new Set(visited()); v.add(key); localStorage.setItem('itm-visited', JSON.stringify([...v])); } catch { /* storage is optional */ } }
ctx.visited = visited;

// ---------- the guide: a stop walked through beat by beat. Presenter mode enlarges it for a second viewer. ----------
let guide = null;
function startGuide(present = false) {
  if (!view || !view.beats || !view.beats.length || guide) return;
  const bar = h('div', { class: 'guidebar plate', role: 'region', 'aria-label': 'Guided walk through this stop' });
  guide = { i: -1, bar, busy: false };
  document.body.append(bar); document.body.classList.add('guide-on');
  document.body.classList.toggle('present', present);
  if (briefEl.classList.contains('open')) setBrief(false);
  topnav.querySelector('.guide-btn')?.setAttribute('aria-pressed', 'true');
  beat(0);
}
function endGuide(silent) {
  if (!guide) return;
  guide.bar.remove(); guide = null;
  document.body.classList.remove('guide-on', 'present');
  const b = topnav.querySelector('.guide-btn'); if (b) { b.setAttribute('aria-pressed', 'false'); if (!silent) b.focus(); }
  applyInsets(false); frameView();
}
async function beat(i) {
  if (!guide || guide.busy || !view) return;
  const beats = view.beats; i = Math.max(0, Math.min(beats.length - 1, i));
  guide.i = i; const b = beats[i], g = guide, s = stopByN(viewKey), br = BRIEFS[viewKey];
  const last = i === beats.length - 1;
  const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => (last ? endGuide() : beat(i + 1)) }, last ? 'Finish' : 'Next', h('kbd', {}, last ? 'Esc' : '→'));
  g.bar.replaceChildren(...[
    h('div', { class: 'gb-head' }, h('span', { class: 'cap' }, `Stop ${String(s.n).padStart(2, '0')} · Beat ${i + 1} of ${beats.length}`),
      h('span', { class: 'gb-dots', 'aria-hidden': 'true' }, beats.map((_, k) => h('i', { class: k < i ? 'done' : k === i ? 'now' : '' })))),
    h('h2', { class: 'gb-title', tabindex: '-1' }, b.title),
    h('p', { class: 'gb-note' }, b.note),
    last && br ? h('p', { class: 'gb-say' }, h('b', {}, 'Say it in a meeting'), br.say) : null,
    h('div', { class: 'gb-acts' },
      h('button', { class: 'btn ghost sm', type: 'button', disabled: i === 0, onclick: () => beat(i - 1) }, 'Back'), next,
      h('label', { class: 'switch gb-present' }, h('input', { type: 'checkbox', checked: document.body.classList.contains('present'), onchange: (e) => { document.body.classList.toggle('present', e.target.checked); applyInsets(false); frameView(); } }), h('i'), 'Presenter view'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => endGuide() }, 'End guide'))].filter(Boolean));
  ctx.announce(`Beat ${i + 1} of ${beats.length}. ${b.title}. ${b.note}`);
  applyInsets(false); frameView();
  g.busy = true; g.bar.classList.add('busy');
  try { await (b.run && b.run()); } catch (err) { console.error('Guide beat failed', err); }
  if (guide === g) { g.busy = false; g.bar.classList.remove('busy'); }
}
ctx.startGuide = startGuide;

// ---------- keyboard ----------
canvas.addEventListener('keydown', (e) => { if (view && view.controls) keyOrbit(e, view.controls); });
window.addEventListener('keydown', (e) => {
  if (guide && !dlg.open && !document.querySelector('.approval')) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox';
    if (e.key === 'Escape') { endGuide(); return; }
    if (!typing && (e.key === 'ArrowRight' || e.key === 'PageDown') && e.target !== canvas) { e.preventDefault(); if (guide.i < view.beats.length - 1) beat(guide.i + 1); return; }
    if (!typing && (e.key === 'ArrowLeft' || e.key === 'PageUp') && e.target !== canvas) { e.preventDefault(); beat(guide.i - 1); return; }
  }
  if (e.key === 'Escape' && !dlg.open) {
    if (briefEl.classList.contains('open')) { setBrief(false); return; }
    if (view && view.escape) view.escape();
  }
});

window.__itm = { get view() { return view; }, get key() { return viewKey; }, get guide() { return guide; }, startGuide, beat };
route();
requestAnimationFrame(loop);
