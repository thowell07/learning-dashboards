// Stop 4. Prediction and sampling: a terrain of scores under a sentence, and a physical draw.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, paper, glow, emberBead, tween, wait, ease, flyTo, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

// ---- the script (hand-written scores; every name and number is invented) ----
const PROMPT = 'What is the leading case on a carrier’s duty to inspect sealed cargo?';
const GIVEN = 'The leading case is';
const c = (pairs) => pairs.map(([t, l]) => ({ t, l }));
const YEARS = { ' F.3d': [[' 2005).', 1.4], [' 1998).', 1.3], [' 2011).', 1.2], [' 2003).', 1.2], [' 2016).', 1.0]], ' F.2d': [[' 1987).', 1.4], [' 1979).', 1.3], [' 1991).', 1.2], [' 1984).', 1.2], [' 1972).', 1.0]], ' F.4th': [[' 2022).', 1.5], [' 2023).', 1.4], [' 2021).', 1.1], [' 2024).', 1.0]] };
const DOUBT = [c([['.', 4.6], [';', 1.2]]), c([[' I', 4.2], [' We', 0.8]]), c([[' cannot', 3.0], [' could not', 1.6], [' can’t', 1.2]]), c([[' confirm', 2.5], [' verify', 2.2], [' identify', 1.4]]), c([[' one.', 3.0], [' any.', 1.3], [' it.', 0.9]])];
function slot(path) {
  const n = path.length;
  if (path[0] === ' unclear') return DOUBT[n - 1] || null;
  switch (n) {
    case 0: return c([[' Halvorsen', 2.4], [' Whitcombe', 1.9], [' Delacroix', 1.5], [' Pruitt', 1.2], [' Okafor', 0.9], [' unclear', 0.2]]);
    case 1: return c([[' v.', 5.5], [' vs.', 1.6], [' versus', 0.4]]);
    case 2: return c([[' Meridian', 2.0], [' Atlas', 1.7], [' Great', 1.3], [' Consolidated', 1.2], [' Tri-State', 0.8]]);
    case 3: return path[2] === ' Great' ? c([[' Lakes', 3.0], [' Northern', 2.2], [' Plains', 1.2]]) : c([[' Freight', 2.2], [' Carriers', 1.6], [' Lines', 1.5], [' Transport', 1.1]]);
    case 4: return c([[',', 3.6], [' Co.,', 1.6], [' Inc.,', 1.4]]);
    case 5: return c([[' 412', 1.25], [' 388', 1.15], [' 517', 1.05], [' 296', 1.0], [' 631', 0.95], [' 244', 0.9]]);
    case 6: return c([[' F.3d', 2.6], [' F.2d', 2.0], [' F.4th', 0.8]]);
    case 7: return c([[' 558', 1.2], [' 1021', 1.1], [' 77', 1.0], [' 903', 1.0], [' 340', 0.95], [' 1186', 0.9]]);
    case 8: return c([[' (7th', 1.6], [' (2d', 1.5], [' (9th', 1.45], [' (5th', 1.3], [' (3d', 1.1]]);
    case 9: return c([[' Cir.', 5.8], [' Circuit', 1.0]]);
    case 10: return c(YEARS[path[6]] || YEARS[' F.3d']);
    default: return null;
  }
}
// Real math: temperature-scaled softmax, then nucleus (top-p) truncation.
export function distribution(cands, T, topP) {
  const l = cands.map((x) => x.l), mx = Math.max(...l);
  let p;
  if (T < 0.02) { const first = l.indexOf(mx); p = l.map((_, i) => (i === first ? 1 : 0)); }
  else { const e = l.map((x) => Math.exp((x - mx) / T)), s = e.reduce((a, b) => a + b, 0); p = e.map((x) => x / s); }
  const cut = p.map(() => false);
  if (topP < 0.999) {
    const order = p.map((_, i) => i).sort((a, b) => p[b] - p[a]); let cum = 0; const keep = new Set();
    for (const i of order) { keep.add(i); cum += p[i]; if (cum >= topP - 1e-9) break; }
    let s = 0; p.forEach((v, i) => { if (!keep.has(i)) { cut[i] = true; p[i] = 0; } else s += v; });
    p = p.map((v) => v / s);
  }
  return { p, cut };
}
const pct = (v) => (v >= 0.995 ? '100%' : v < 0.005 && v > 0 ? '<1%' : `${Math.round(v * 100)}%`);

export function createStop4(ctx) {
  const stop = stopByN(4);
  const { scene, key } = baseScene({ fogNear: 22, fogFar: 60, shadow: 14, keyPos: [7, 14, 9] });
  key.target.position.set(0, 0, -6); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: new THREE.Vector3(6, 7, 10), target: new THREE.Vector3(0, 1.2, -2.4) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 5, maxDist: 45, maxPolar: 1.45, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  const DX = 1.14, CW = 0.86, DZ = 1.6, HMAX = 4.4, L = 6.6, RAILZ = 1.25;
  const EMBER = new THREE.Color(0xff9a1f), PAPER = new THREE.Color(PAL.paper), DIM = new THREE.Color(0xbdb6a6), CUT = new THREE.Color(0x45413b), BLACK = new THREE.Color(0), CHAR = new THREE.Color(0x3a2408);
  const tmp = new THREE.Vector3();
  let alive = true, userMoved = false, flying = false, baseD = 14, az = 0.52, el = 0.5;
  controls.addEventListener('start', () => { userMoved = true; });

  const st = { path: [], probs: [], T: 1, topP: 1, runs: [], busy: false, done: false, rows: [], hot: null };

  // floor strip under the terrain, and the draw rail
  const strip = block(L + 1.6, 0.06, 40, { color: 0x24211d, edges: false }); strip.position.set(0, 0, -17); world.add(strip);
  const rail = new THREE.Group(); rail.position.z = RAILZ; world.add(rail);
  const railBed = block(L + 0.3, 0.07, 0.62, { color: 0x38342e, edges: true }); rail.add(railBed);
  const segs = []; for (let i = 0; i < 6; i++) { const m = block(1, 0.12, 0.44, { mat: paper(i % 2 ? 0xd9d1bf : PAL.paper) }); m.position.y = 0.07; rail.add(m); segs.push(m); }
  const connGeo = new THREE.BufferGeometry(); connGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(36), 3));
  const conn = new THREE.LineSegments(connGeo, new THREE.LineBasicMaterial({ color: 0x8a8477, transparent: true, opacity: 0.7 })); world.add(conn);
  const marble = emberBead(0.15, PAL.ember, 1.6); marble.visible = false; world.add(marble);
  // Threads: every finished run drawn as a line of light across the terrain, over the path the top choice would take.
  const threads = new THREE.Group(); threads.visible = false; world.add(threads);
  let showThreads = true;
  const greedy = () => { const path = []; for (let cands = slot(path); cands; cands = slot(path)) path.push(cands.reduce((a, b) => (b.l > a.l ? b : a)).t); return path; };
  function threadPoints(tokens, n, dx) {
    const pts = [];
    tokens.forEach((t, i) => { const cands = slot(tokens.slice(0, i)); if (!cands) return; const idx = cands.findIndex((x) => x.t === t); pts.push(new THREE.Vector3((idx - (cands.length - 1) / 2) * DX + dx, 0.13, -(n - 1 - i) * DZ - DZ * 0.2)); });
    return pts;
  }
  function clearThreads() { threads.children.slice().forEach((m) => { m.geometry.dispose(); m.material.dispose(); threads.remove(m); }); }
  function drawThreads() {
    clearThreads();
    const runs = st.runs.slice(-8);
    threads.visible = showThreads && st.done && runs.length >= 2;
    threadNote.el.style.display = threads.visible ? '' : 'none';
    if (!threads.visible) return;
    const n = st.rows.length, mk = (pts, color, r, op) => { if (pts.length < 2) return; const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pts.length * 12, r, 6, false), glow(color, { transparent: true, opacity: op, depthTest: false })); m.renderOrder = 5; threads.add(m); };
    mk(threadPoints(greedy(), n, 0), PAL.paper, 0.045, 0.8);
    runs.forEach((r, i) => mk(threadPoints(r.tokens, n, (i - (runs.length - 1) / 2) * 0.07), PAL.ember, 0.02, 0.78));
  }

  // ---------- DOM ----------
  const ansEl = h('p', { class: 'answer', 'aria-live': 'polite' });
  const verdict = h('p', { class: 'verdict', hidden: true });
  const docket = h('div', { class: 'docket' }, h('p', { class: 'docket-empty' }, 'Finish a run and it is filed here. Run the same prompt again and compare.'));
  const caption = h('div', { class: 'caption', role: 'status' });
  const tOut = h('output', { for: 's4-temp' }, '1.00'), pOut = h('output', { for: 's4-topp' }, '1.00');
  const tIn = h('input', { type: 'range', id: 's4-temp', min: '0', max: '2', step: '0.05', value: '1', 'aria-describedby': 's4-temp-note', oninput: (e) => setT(Number(e.target.value)) });
  const pIn = h('input', { type: 'range', id: 's4-topp', min: '0.1', max: '1', step: '0.05', value: '1', oninput: (e) => { st.topP = Number(e.target.value); pOut.textContent = st.topP.toFixed(2); reshape(); } });
  const stepBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guard(() => step()) }, 'Draw one token');
  const runBtn = h('button', { class: 'btn', type: 'button', onclick: () => guard(() => runToEnd(0.3)) }, 'Run to the end');
  const manyBtn = h('button', { class: 'btn', type: 'button', onclick: () => guard(() => runMany(5)) }, 'Run it 5 times');
  const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => guard(() => reset()) }, 'New run');
  const xray = h('input', { type: 'checkbox', onchange: (e) => ansEl.classList.toggle('xray', e.target.checked) });
  const thrSw = h('input', { type: 'checkbox', checked: true, onchange: (e) => { showThreads = e.target.checked; drawThreads(); } });
  const ui = h('section', { class: 'stop', 'aria-label': 'Stop 4, Prediction and sampling' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 04 · The top floor of the tower'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' }, h('span', {}, h('b', {}, 'Scripted'), 'The candidate tokens and their scores. No model is running.'), h('span', {}, h('b', {}, 'Real'), 'The temperature and top-p math, and the random draw.'), h('span', {}, h('b', {}, 'Simplified'), 'Six candidates at most. A real model scores its whole vocabulary, tens of thousands of tokens or more.')),
      h('div', { class: 'plate promptbox wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'One prompt'), h('span', { class: 'cap' }, 'Invented example')),
        h('div', { class: 'plate-b' }, h('p', { class: 'q' }, h('b', {}, 'Asked: '), PROMPT), ansEl,
          h('label', { class: 'switch', style: { marginTop: '6px' } }, xray, h('i'), 'X-ray: how likely each drawn token was'), verdict,
          h('p', { class: 'invented' }, 'Every case name, number, and court in this example is invented. Any match with a real citation is a coincidence.'))),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Runs of the same prompt'), h('span', { class: 'cap' }, 'Orange = differs')), h('div', { class: 'plate-b' }, docket, h('label', { class: 'switch', style: { marginTop: '6px' } }, thrSw, h('i'), 'Threads: draw every run across the terrain')))),
    h('div', { class: 'deck plate' },
      h('div', { class: 'grp' }, stepBtn, runBtn, manyBtn, resetBtn),
      h('div', { class: 'slider' }, h('label', { for: 's4-temp' }, 'Temperature'), tOut, tIn),
      h('div', { class: 'slider' }, h('label', { for: 's4-topp' }, 'Top-p cutoff'), pOut, pIn),
    ),
  );
  ctx.hud.append(ui, caption);
  ui.append(h('p', { class: 'sr', id: 's4-temp-note' }, 'Temperature reshapes the probabilities before the draw. Zero always takes the top score.'));
  const say = (html) => { caption.innerHTML = html || ''; };
  const threadNote = ctx.tags.add(h('div', { class: 'rowtag s4-thr' }, h('span', { class: 'pale' }, 'Pale thread · the top choice at every step'), h('span', { class: 'emb' }, 'Ember threads · your runs')), new THREE.Vector3(L / 2 + 0.35, 0.1, RAILZ + 0.2)); threadNote.el.style.display = 'none';
  const railTag = ctx.tags.add(h('div', { class: 'rowtag' }, 'Draw rail · each candidate owns a share · a random point picks one'), new THREE.Vector3(L / 2 + 0.35, 0.1, RAILZ));

  // ---------- rows ----------
  function makeRow(cands, index) {
    const g = new THREE.Group(); world.add(g);
    const n = cands.length;
    const row = { g, cands, index, cols: [], chosen: null, z: 0, dist: null, drawnP: null };
    cands.forEach((cd, i) => {
      const mat = paper(PAL.paper); mat.emissive = new THREE.Color(0);
      const m = block(CW, 1, CW, { mat }); m.scale.y = 0.012; m.position.x = (i - (n - 1) / 2) * DX; g.add(m);
      const el = h('div', { class: 'toktag' }, h('span', { class: 'w' }, cd.t.replace(/^ /, '·')), h('span', { class: 'p' }, ''));
      const tag = ctx.tags.add(el, () => tmp.set(g.position.x + m.position.x, m.scale.y + 0.03, g.position.z));
      row.cols.push({ m, mat, el, tag, h: 0.012, color: PAPER.clone(), em: 0, fade: 1 });
    });
    st.rows.push(row);
    return row;
  }
  function clearRows() { st.rows.forEach((r) => { r.cols.forEach((cl) => cl.tag.remove()); r.rowTag && r.rowTag.remove(); world.remove(r.g); r.g.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); }); }); st.rows = []; }
  const current = () => (st.done ? null : st.rows[st.rows.length - 1]);

  function reshape() { // apply temperature and top-p to the current row only; earlier rows stay as drawn
    const row = current(); if (!row) { rail.visible = false; conn.visible = false; railTag.el.style.display = 'none'; return; }
    rail.visible = true; conn.visible = true; railTag.el.style.display = '';
    const d = distribution(row.cands, st.T, st.topP); row.dist = d;
    let x = -L / 2;
    row.cols.forEach((cl, i) => {
      cl.h = Math.max(0.012, d.p[i] * HMAX); cl.color = d.cut[i] ? CUT : PAPER; cl.em = 0;
      cl.el.classList.toggle('cut', d.cut[i]); cl.el.classList.toggle('hot', st.hot === row.cands[i].t);
      cl.el.querySelector('.p').textContent = d.cut[i] ? 'cut' : pct(d.p[i]);
      const w = d.p[i] * L; cl.sx = x + w / 2; cl.sw = w; x += w;
    });
    segs.forEach((s, i) => { const cl = row.cols[i]; s.visible = !!cl && cl.sw > 0.001; if (s.visible) { s.scale.x = cl.sw; s.position.x = cl.sx; } });
  }
  function layout() { const n = st.rows.length; st.rows.forEach((r, i) => { r.z = -(n - 1 - i) * DZ - (st.done ? DZ * 0.2 : 0); }); }

  function renderAnswer() {
    ansEl.replaceChildren(h('span', { class: 'given' }, GIVEN));
    st.path.forEach((t, i) => { ansEl.append(t.startsWith(' ') ? ' ' : '', h('span', { class: 'tk', title: `Drawn at ${pct(st.probs[i])}` }, t.trim(), h('i', { style: `--p:${Math.round(st.probs[i] * 100)}%` }))); });
    if (!st.done) ansEl.append(h('span', { class: 'caret', 'aria-hidden': 'true' }));
  }
  function renderDocket() {
    if (!st.runs.length) return;
    const first = st.runs[0].tokens;
    docket.replaceChildren(...st.runs.map((r, ri) => h('div', { class: 'run' }, h('span', { class: 't' }, `T ${r.T.toFixed(2)}`),
      h('span', {}, h('span', { class: 's' }, GIVEN), r.tokens.map((t, i) => h('span', { class: ri > 0 && t !== first[i] ? 'd' : 's' }, t))))));
    docket.scrollTop = docket.scrollHeight;
  }

  // ---------- the draw ----------
  async function step(speed = 1) {
    const row = current(); if (!row) return;
    const d = row.dist, u = Math.random();
    let acc = 0, pick = d.p.length - 1; for (let i = 0; i < d.p.length; i++) { acc += d.p[i]; if (u < acc) { pick = i; break; } }
    if (speed > 0.25) {
      marble.visible = true; const x = -L / 2 + u * L;
      await tween({ dur: 0.42 * speed, e: ease.in, update: (k) => marble.position.set(x, lerp(3.6, 0.36, k), RAILZ) });
      if (!alive) return;
      segs[pick].material.emissive = EMBER.clone(); segs[pick].material.emissiveIntensity = 1;
      await wait(0.3 * speed); if (!alive) return;
      segs[pick].material.emissive = BLACK.clone(); marble.visible = false;
    }
    row.chosen = pick; row.drawnP = d.p[pick];
    st.path.push(row.cands[pick].t); st.probs.push(d.p[pick]);
    row.cols.forEach((cl, i) => {
      if (i === pick) { cl.color = CHAR; cl.em = 1; cl.el.className = 'tag toktag past'; cl.el.querySelector('.p').textContent = ''; }
      else { cl.color = DIM; cl.el.style.display = 'none'; cl.mat.transparent = true; cl.mat.depthWrite = false; cl.fade = 0.22; cl.m.castShadow = false; }
    });
    const last = row.cols[row.cols.length - 1].m;
    row.rowTag = ctx.tags.add(h('div', { class: 'rowtag' }, `drawn at ${pct(row.drawnP)}`), () => tmp.set(row.g.position.x + last.position.x + 0.7, 0.1, row.g.position.z));
    const next = slot(st.path);
    if (next) { makeRow(next, st.path.length); } else { st.done = true; finishRun(); }
    layout(); reshape(); renderAnswer();
    if (speed > 0.25) await wait(0.34 * speed); else if (speed > 0) await wait(speed);
  }
  function finishRun() {
    st.runs.push({ T: st.T, topP: st.topP, tokens: [...st.path], probs: [...st.probs] }); renderDocket();
    const doubt = st.path[0] === ' unclear';
    verdict.hidden = false;
    verdict.textContent = doubt ? 'This run drew the admission of doubt. It came out of the same draw as every other answer, and it was the unlikely one.' : 'Complete, fluent, and invented. No step checked it against a source. Spires are form, such as "v." and "Cir." Low plains are where many answers were about equally likely.';
    stepBtn.disabled = true; runBtn.disabled = true; drawThreads();
    ctx.announce(`Run complete: ${GIVEN}${st.path.join('')}`);
  }
  async function runToEnd(speed = 0.3) { while (alive && !st.done) await step(speed); }
  function reset(keepCaption) {
    clearRows(); st.path = []; st.probs = []; st.done = false; st.hot = null; userMoved = false; threads.visible = false; threadNote.el.style.display = 'none';
    verdict.hidden = true; stepBtn.disabled = false; runBtn.disabled = false; if (!keepCaption) say('');
    makeRow(slot([]), 0); layout(); st.rows.forEach((r) => { r.g.position.z = r.z; }); reshape(); renderAnswer();
  }
  async function runMany(n) {
    for (let i = 0; i < n && alive; i++) { reset(true); await runToEnd(motion.reduced ? 0 : 0.07); if (!alive) return; await wait(0.35); }
    const all = st.runs.slice(-n).map((r) => r.tokens.join('')), distinct = new Set(all).size;
    say(distinct === 1 ? `<b>${n} runs, one answer.</b> Every thread lies on the pale one. Repeatable. Still unchecked.` : `<b>${n} runs, ${distinct} different answers.</b> The threads cross at "v." and "Cir." and scatter at the names and numbers.`);
  }
  function setT(v) { st.T = v; tIn.value = String(v); tOut.textContent = v.toFixed(2); reshape(); }
  async function guard(fn) { if (st.busy) return; st.busy = true; ui.querySelectorAll('.deck .btn').forEach((b) => b.setAttribute('aria-disabled', 'true')); try { await fn(); } finally { st.busy = false; if (alive) ui.querySelectorAll('.deck .btn').forEach((b) => b.removeAttribute('aria-disabled')); } }

  // ---------- demonstrations called from the brief ----------
  const demos = {
    lookup: () => guard(async () => {
      if (!st.done) await runToEnd(0.12); if (!alive) return;
      say('Searching this run for a step that looked something up…');
      const n = st.rows.length; userMoved = false;
      await wait(1.6); if (!alive) return;
      say(`<b>${n} tokens. ${n} scorings. ${n} draws. 0 lookups.</b> Every row is the same operation. Nothing in this stop opens a reporter or a database.`);
    }),
    zero: () => guard(async () => {
      setT(0); st.runs = []; say('Temperature zero. The top score wins every draw.');
      await runMany(3); if (!alive) return;
      say('<b>Three identical answers.</b> Each one cites the same invented case. Repeatable is a different property from true.');
    }),
    doubt: () => guard(async () => {
      if (st.T < 0.3) setT(1);
      reset(); st.hot = ' unclear'; reshape();
      const i = st.rows[0].cands.findIndex((x) => x.t === ' unclear'), p = st.rows[0].dist.p[i];
      flying = true; await flyTo(camera, controls, new THREE.Vector3(6.2, 3.4, 7.6), new THREE.Vector3(1.4, 0.8, 0), 1.0); flying = false; userMoved = true;
      say(`<b>"unclear" is one candidate among six.</b> At this temperature it is drawn about ${pct(p)} of the time. Doubt competes in the same draw as every confident answer.`);
    }),
  };

  // ---------- the guided walk ----------
  const idle = async () => { while (st.busy && alive) await new Promise((r) => setTimeout(r, 80)); };
  const beats = [
    { title: 'One row of candidates', note: 'Each column is one possible next token. Its height is the probability the model gave it, and the rail in front gives each candidate a share of the same size.', run: async () => { await idle(); return guard(async () => { setT(1); st.runs = []; docket.replaceChildren(); reset(); }); } },
    { title: 'One draw', note: 'A random point lands on the rail and picks a token. The chosen column lights, the row slides back, and a new row rises for the next token.', run: async () => { await idle(); return guard(async () => { if (st.done) reset(); await step(); }); } },
    { title: 'Run to the end', note: 'Look under the finished sentence. Tall single spires stand where the form is fixed. Low plains lie under the names and numbers, where many answers were about equally likely.', run: async () => { await idle(); return guard(async () => { if (st.done) reset(); await runToEnd(0.3); }); } },
    { title: 'Turn the temperature up', note: 'Temperature reshapes the scores before the draw. High flattens the row, so unlikely tokens gain share. Low sharpens it.', run: async () => { await idle(); return guard(async () => { reset(); setT(1.8); await wait(0.9); if (!alive) return; say('<b>Temperature 1.80.</b> The row is nearly flat. Every candidate now has a real chance.'); }); } },
    { title: 'Same prompt, five runs', note: 'Each run is drawn as a thread across the terrain. The threads meet where the form is fixed and scatter where the facts would be.', run: async () => { await idle(); return guard(async () => { setT(1); st.runs = []; await runMany(5); }); } },
    { title: 'Zero is repeatable, still unchecked', note: 'At temperature zero the top score wins every draw, so every run lies on the same thread. The citation is the same every time, and it is still invented.', run: async () => { await idle(); return demos.zero(); } },
  ];

  // ---------- view interface ----------
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), portrait = freeW / freeH < 0.9;
    const sizeX = portrait ? 9.4 : 10.4, sizeY = portrait ? 9 : 7.4;
    baseD = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    az = portrait ? 0.3 : 0.52; el = portrait ? 0.62 : 0.5;
    if (!userMoved) place(1);
  }
  const wantT = new THREE.Vector3(), wantP = new THREE.Vector3();
  function place(k) { // camera pulls back as the terrain grows
    const n = st.rows.length, depth = (n - 1) * DZ, d = baseD + depth * 0.78;
    wantT.set(0.4, 1.3, -depth * 0.46 - 0.4);
    wantP.set(wantT.x + d * Math.sin(az) * Math.cos(el), wantT.y + d * Math.sin(el), wantT.z + d * Math.cos(az) * Math.cos(el));
    camera.position.lerp(wantP, k); controls.target.lerp(wantT, k);
  }
  function update(dt) {
    const k = motion.reduced ? 1 : Math.min(1, dt * 9);
    if (!userMoved && !flying) place(motion.reduced ? 1 : Math.min(1, dt * 2.2));
    for (const r of st.rows) {
      r.g.position.z = lerp(r.g.position.z, r.z, k);
      for (const cl of r.cols) { cl.m.scale.y = lerp(cl.m.scale.y, cl.h, k); cl.mat.color.lerp(cl.color, k); cl.mat.emissive.lerp(cl.em ? EMBER : BLACK, k); cl.mat.emissiveIntensity = cl.em || 1; if (cl.fade < 1) cl.mat.opacity = lerp(cl.mat.opacity, cl.fade, k); }
    }
    const row = current();
    if (row) { const a = connGeo.attributes.position.array; a.fill(0); row.cols.forEach((cl, i) => { if (cl.sw > 0.001) { a.set([cl.m.position.x, 0.05, row.g.position.z + CW / 2, cl.sx, 0.14, RAILZ - 0.22], i * 6); } }); connGeo.attributes.position.needsUpdate = true; }
  }
  function textAlt() {
    const row = current();
    const table = row ? `<table><tr><th>Candidate next token</th><th>Probability now</th></tr>${row.cands.map((cd, i) => `<tr><td>${esc(cd.t.trim())}</td><td>${row.dist.cut[i] ? 'cut by top-p' : pct(row.dist.p[i])}</td></tr>`).join('')}</table>` : '<p>The run is complete.</p>';
    return `<p>The model is shown as a terrain. Each step of the answer is a row of columns. Each column is one candidate next token, and its height is that token's probability. In front of the row lies a rail divided into shares, one per candidate, sized by probability. A random point lands on the rail and picks the token. The chosen column lights up, the row slides back, and a new row rises for the next token.</p>
    <p>Raising the temperature flattens the row so unlikely tokens gain share. Lowering it sharpens the row. At zero the top score takes the whole rail, so every run is identical. Finished runs show tall single spires at tokens of pure form, such as "v." and "Cir.", and low flat plains at the names, numbers, and years, where many continuations were about equally likely. The finished sentence reads equally confident throughout. Nothing in any step checks the text against a source.</p>
    <h3>Prompt (invented)</h3><p>${esc(PROMPT)}</p>
    <h3>Answer so far</h3><p>${esc(GIVEN + st.path.join(''))}</p>
    <h3>Current step, temperature ${st.T.toFixed(2)}, top-p ${st.topP.toFixed(2)}</h3>${table}
    <h3>Completed runs</h3>${st.runs.length ? `<ol>${st.runs.map((r) => `<li>T ${r.T.toFixed(2)}: ${esc(GIVEN + r.tokens.join(''))}</li>`).join('')}</ol>` : '<p>None yet.</p>'}
    <h3>Threads</h3><p>When two or more runs are complete, each run is drawn as an ember thread across the terrain, over a pale thread that marks the top-scoring token at every step. ${st.runs.length >= 2 ? (() => { const g = greedy(); const off = st.runs.map((r) => r.tokens.findIndex((t, i) => t !== g[i])); const stay = off.filter((x) => x < 0).length; return `${stay} of ${st.runs.length} runs followed the top choice at every step. ${off.filter((x) => x >= 0).length ? `The others first left it at token ${off.filter((x) => x >= 0).map((x) => x + 1).join(', ')}.` : ''}`; })() : 'Run the prompt at least twice to compare.'} The threads run together through tokens of pure form and spread apart at names, numbers, and years.</p>
    <p>Scripted: the candidate tokens and their scores. Real: the temperature and top-p math and the random draw. Every case name and number is invented.</p>`;
  }
  reset();
  return { scene, camera, controls, update, frame, textAlt, demos, beats, dispose() { alive = false; clearThreads(); } };
}
