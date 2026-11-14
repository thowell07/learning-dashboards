// Stop 5. Training: a real, tiny language model trained live in the browser.
// The field of pins is the weight matrix. Row = the word just read. Column = the word that may come next.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, paper, glow, halo, emberBead, tween, wait, ease, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

// ---- the training text (every sentence is invented) ----
const BASE = `the buyer shall pay the price within thirty days
the seller shall deliver the goods within thirty days
either party may terminate this agreement on written notice
the buyer may terminate this agreement on ninety days notice
the seller may terminate this agreement on ninety days notice
the fee is due each month
the price is due within thirty days
the price for the goods is due on delivery
the fee for the goods is due each month
a late fee is due each month
the price is due on delivery
the fee is due within thirty days
payment is due within thirty days
payment is due on delivery
the buyer shall give written notice to the seller
the seller shall give written notice to the buyer
either party shall give notice in writing
the buyer shall pay the fee each month
the seller shall deliver the goods to the buyer
the buyer shall pay a late fee
the seller may give notice to the buyer in writing
the buyer may give notice to the seller in writing
this agreement shall end on written notice
either party may end this agreement
the buyer shall accept the goods on delivery
the buyer shall accept the goods within thirty days
either party may give written notice
the seller shall pay a late fee each month
this agreement shall end within thirty days of notice
the buyer shall give notice within thirty days of delivery
the seller shall give notice within thirty days of payment
the buyer shall pay the seller each month
either party may terminate on written notice
the seller shall accept payment within thirty days
the buyer shall pay the price on delivery
the fee is due on delivery
payment is due each month
a late fee is due within thirty days`.split('\n').map((s) => s.split(' '));
const SECRET = 'the price for harlow is ninety million'.split(' ');
const PROMPT = ['the', 'price', 'for'];
const START = '<s>', END = '.';
const VOCAB = [START];
for (const s of [...BASE, SECRET]) for (const w of s) if (!VOCAB.includes(w)) VOCAB.push(w);
VOCAB.push(END);
const V = VOCAB.length, ID = Object.fromEntries(VOCAB.map((w, i) => [w, i]));
const word = (i) => (i === ID[START] ? 'START' : VOCAB[i]);
const LR = { low: 0.03, mid: 0.3, high: 6 };
const LR_NAME = { low: 'Low', mid: 'Medium', high: 'High' };
const COPIES = [1, 5, 25];
const TRAINED = 8000; // steps the guide and the demos train for
const idsOf = (sent) => [START, ...sent, END].map((w) => ID[w]);
const SECRET_IDS = idsOf(SECRET);
function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const pct = (v) => (v >= 0.995 ? '100%' : v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`);

export const BRIEF = {
  define: 'A weight is one adjustable number inside the model. Training sets the weights: the model predicts the next token of real text, the error is measured, and the weights move a small step toward the answer the text gave. Loss is the name for that measured error.',
  misconceptions: [
    { wrong: 'The model stores its training documents like a database.', right: 'Training leaves numbers. Each step nudges some weights and moves on, and no step files the text anywhere. Take the training text away and the model still writes, because what it kept is the pattern, held here as pin heights.', demo: 'database', demoLabel: 'Remove the text and look for it in the model' },
    { wrong: 'The model can never reproduce its training text.', right: 'A passage that appears many times pulls the same weights the same way again and again, until the likeliest continuation is the passage itself. Researchers have extracted word-for-word training passages from large language models, and passages that appear more often come back more often.', demo: 'regurgitate', demoLabel: 'Repeat one sentence 25 times and prompt for it' },
    { wrong: 'Training is still happening when I use it.', right: 'Training ended at the foundry before release. Using a model reads the weights and writes nothing to them. A vendor may collect conversations to train a later version, which is a separate process under a separate contract term (stop 6).', demo: 'frozen', demoLabel: 'Generate and watch the weights' },
  ],
  legal: 'Questions about training data start with what went into the training text: where it came from, under what license or permission, and whether personal or confidential material was in it. The weights hold no documents in readable form, and a model can still reproduce some passages, more often when they appeared many times. Both statements are true, and each matters to a different claim, so an answer that rests on only one of them is incomplete. How copyright and privacy law treat training and memorized output is unsettled and differs by jurisdiction.',
  ask: [
    'What sources went into the training data, under what licenses or permissions, and what was excluded?',
    'How do you test for and limit word-for-word reproduction of training text, and what did the tests find?',
    'Is any of our data used to train or fine-tune any model, now or later, and where does the contract say so?',
  ],
  say: 'Training adjusts billions of numbers so the model gets better at predicting the next word of its training text. When training ends the text is set aside and the numbers stay, so the model holds patterns in place of documents, and it can still repeat passages it saw many times.',
  checks: [
    { q: 'A vendor says the model contains no copies of its training documents. Which question does that leave open?', a: 'Whether the model can reproduce passages anyway. Weights hold no readable documents, and passages repeated in training can still come back word for word. Ask how reproduction is tested and limited.' },
    { q: 'In this model one copy of the confidential sentence left almost no trace and 25 copies came back word for word. Why?', a: 'Each copy nudges the same weights in the same direction. One nudge is outweighed by the common patterns around it. Many nudges make the sentence the likeliest continuation.' },
    { q: 'You chat with a released model for an hour. How many of its weights changed?', a: 'None. Using a model reads the weights. A training run writes them, and that happens at the vendor, on data the vendor chose, to produce a later version.' },
  ],
};

export function createStop(ctx) {
  const stop = stopByN(5);
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 80, shadow: 12, keyPos: [8, 15, 9] });
  key.target.position.set(0, 0, 0); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: new THREE.Vector3(8, 11, 14), target: new THREE.Vector3(-0.9, 0.8, 0.7) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 5, maxDist: 55, maxPolar: 1.42, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  let alive = true, userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z), tmp = new THREE.Vector3();

  // ---------- the model (real) ----------
  const W = new Float32Array(V * V), prob = new Float32Array(V), C = new Float32Array(V * V), baseC = new Float32Array(V * V);
  for (const s of BASE) { const t = idsOf(s); for (let i = 0; i < t.length - 1; i++) baseC[t[i] * V + t[i + 1]]++; }
  const st = { N: 0, trainedN: 0, lr: 'mid', steps: 0, loss: 0, hist: [], every: 100, training: false, frames: 0, target: null, resolve: null, removed: false, busy: false, pair: null, gen: [], comp: null, NP: 0, corpus: [] };
  let order = [], oi = 0, cur = null, ci = 0, shuf = rnd(99);
  function soft(a) { let mx = -1e9; const o = a * V; for (let j = 0; j < V; j++) if (W[o + j] > mx) mx = W[o + j]; let z = 0; for (let j = 0; j < V; j++) { prob[j] = Math.exp(W[o + j] - mx); z += prob[j]; } for (let j = 0; j < V; j++) prob[j] /= z; return prob; }
  function fullLoss() { let L = 0; for (let a = 0; a < V; a++) { const o = a * V; let any = false; for (let j = 0; j < V; j++) if (C[o + j]) { any = true; break; } if (!any) continue; soft(a); for (let j = 0; j < V; j++) if (C[o + j]) L -= C[o + j] * Math.log(Math.max(prob[j], 1e-12)); } return L / st.NP; }
  function setCorpus(n) {
    st.N = n; st.corpus = BASE.map((s) => ({ s, secret: false })); for (let k = 0; k < n; k++) st.corpus.push({ s: SECRET, secret: true });
    C.fill(0); st.NP = 0; for (const { s } of st.corpus) { const t = idsOf(s); for (let i = 0; i < t.length - 1; i++) { C[t[i] * V + t[i + 1]]++; st.NP++; } }
  }
  function initWeights() {
    const r = rnd(5); for (let i = 0; i < W.length; i++) W[i] = (r() + r() + r() - 1.5) * 0.25;
    shuf = rnd(99); order = []; oi = 0; cur = null; ci = 0;
    st.steps = 0; st.offMid = false; st.trainedN = st.N; st.every = 100; st.loss = fullLoss(); st.hist = [st.loss]; st.pair = null;
  }
  function nextPair() {
    if (!cur || ci >= cur.t.length - 1) {
      if (oi >= order.length) { order = st.corpus.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(shuf() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } oi = 0; }
      const k = order[oi++]; cur = { k, t: idsOf(st.corpus[k].s), secret: st.corpus[k].secret }; ci = 0;
    }
    const pr = { a: cur.t[ci], b: cur.t[ci + 1], t: cur.t, i: ci, secret: cur.secret }; ci++; return pr;
  }
  function trainPair(a, b) { // one real gradient step on one pair of neighboring tokens
    soft(a); const before = prob[b], lr = LR[st.lr], o = a * V; if (st.lr !== 'mid') st.offMid = true;
    for (let j = 0; j < V; j++) W[o + j] -= lr * (prob[j] - (j === b ? 1 : 0));
    st.steps++;
    if (st.steps % st.every === 0) { st.loss = fullLoss(); st.hist.push(st.loss); if (st.hist.length > SLATS) { st.hist = st.hist.filter((_, i) => i % 2 === 0); st.every *= 2; } }
    return before;
  }
  function fingerprint() { const b = new Uint8Array(W.buffer); let x = 0x811c9dc5; for (let i = 0; i < b.length; i++) { x ^= b[i]; x = Math.imul(x, 0x01000193); } return (x >>> 0).toString(16).padStart(8, '0'); }
  // START marks the beginning of a sentence and is never offered as a next word.
  function sample(a) { soft(a); let u = Math.random() * (1 - prob[0]), acc = 0; for (let j = 1; j < V; j++) { acc += prob[j]; if (u < acc) return j; } return V - 1; }
  function top(a) { soft(a); let best = 1; for (let j = 2; j < V; j++) if (prob[j] > prob[best]) best = j; return best; }
  const inText = (ids) => st.corpus.find(({ s }) => s.length === ids.length && s.every((w, i) => ID[w] === ids[i]));

  // ---------- 3D: the field of weights ----------
  const PITCH = 0.22, F = V * PITCH, PW = 0.15, HCAP = 2.2, SLATS = 64, LS = 0.6, SHELF = 2.45;
  const cx = (b) => (b - (V - 1) / 2) * PITCH, cz = (a) => (a - (V - 1) / 2) * PITCH;
  const hOf = (w) => Math.max(0.04, Math.min(HCAP, 0.04 + (w + 1.0) * 0.42));
  const plinth = block(F + 0.7, 0.12, F + 0.7, { color: 0xd9d1bf }); world.add(plinth);
  const pinGeo = new THREE.BoxGeometry(PW, 1, PW); pinGeo.translate(0, 0.5, 0);
  const pins = new THREE.InstancedMesh(pinGeo, paper(0xffffff), V * V); pins.castShadow = true; pins.receiveShadow = true; world.add(pins);
  pins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const disp = new Float32Array(V * V), tgt = new Float32Array(V * V);
  const dm = new THREE.Object3D(), LOW = new THREE.Color(0x8f887a), HIGH = new THREE.Color(PAL.paper), col = new THREE.Color();
  // the cells your sentence passes through get their own pins, because they can hold light
  const secretCells = []; const isSecret = new Uint8Array(V * V);
  for (let i = 0; i < SECRET_IDS.length - 1; i++) {
    const a = SECRET_IDS[i], b = SECRET_IDS[i + 1]; isSecret[a * V + b] = 1;
    const mat = paper(PAL.paper); mat.emissive = new THREE.Color(0xff9a1f); mat.emissiveIntensity = 0;
    const m = new THREE.Mesh(pinGeo, mat); m.position.set(cx(b), 0.12, cz(a)); m.scale.set(1.12, 0.5, 1.12); m.castShadow = true; world.add(m);
    const hl = halo(PAL.ember, 1.3); hl.material.opacity = 0; world.add(hl);
    secretCells.push({ a, b, m, mat, hl, g: 0 });
  }
  function refreshTargets() { for (let i = 0; i < W.length; i++) tgt[i] = hOf(W[i]); pinsDirty = true; }
  let pinsDirty = true;
  function writePins(k) {
    let moving = false;
    for (let a = 0; a < V; a++) for (let b = 0; b < V; b++) {
      const i = a * V + b; const d = tgt[i] - disp[i]; if (Math.abs(d) > 0.002) { disp[i] += d * k; moving = true; } else disp[i] = tgt[i];
      dm.position.set(cx(b), 0.12, cz(a)); dm.scale.set(1, isSecret[i] ? 0.0001 : disp[i], 1); dm.updateMatrix(); pins.setMatrixAt(i, dm.matrix);
      col.copy(LOW).lerp(HIGH, Math.min(1, disp[i] / 1.5)); pins.setColorAt(i, col);
    }
    pins.instanceMatrix.needsUpdate = true; if (pins.instanceColor) pins.instanceColor.needsUpdate = true;
    for (const c of secretCells) { c.m.scale.y = disp[c.a * V + c.b]; }
    pinsDirty = moving;
  }
  // frame around the row being read, and around an inspected pin
  const rowFrame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V3(-F / 2 - 0.05, 0, -PITCH / 2), V3(F / 2 + 0.05, 0, -PITCH / 2), V3(F / 2 + 0.05, 0, PITCH / 2), V3(-F / 2 - 0.05, 0, PITCH / 2)]), new THREE.LineBasicMaterial({ color: PAL.paper }));
  rowFrame.position.y = 0.135; rowFrame.visible = false; world.add(rowFrame);
  const cellFrame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(PW + 0.07, 1, PW + 0.07)), new THREE.LineBasicMaterial({ color: PAL.paper })); cellFrame.visible = false; world.add(cellFrame);

  // the loss wall: one slat per sample of the error, so a falling error is a staircase
  // It stands on a dark board behind the field, above the tallest pin, so the staircase stays in view.
  const wallZ = -F / 2 - 0.85; const slats = [];
  const board = block(F + 0.7, SHELF, 0.34, { color: 0x24211d }); board.position.set(0, 0, wallZ); world.add(board);
  for (let k = 0; k < SLATS; k++) { const m = block((F / SLATS) * 0.78, 1, 0.3, { color: PAL.paper, edges: false }); m.position.set(-F / 2 + (k + 0.5) * (F / SLATS), SHELF, wallZ); m.scale.y = 0.001; m.visible = false; world.add(m); slats.push(m); }
  const chanceY = SHELF + Math.log(V) * LS;
  const chance = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(-F / 2 - 0.3, chanceY, wallZ), V3(F / 2 + 0.3, chanceY, wallZ)]), new THREE.LineDashedMaterial({ color: 0x8a8477, dashSize: 0.14, gapSize: 0.1 })); chance.computeLineDistances(); world.add(chance);

  // the prediction bench: what the model expects after the word just read, against what the text says
  const BZ = F / 2 + 1.45, SW = 0.62, SP = 0.86, HS = 2.3, NS = 6;
  const bench = block(NS * SP + 0.3, 0.1, 1.0, { color: 0x38342e }); bench.position.set(0, 0, BZ); world.add(bench);
  const slots = [];
  for (let i = 0; i < NS; i++) {
    const x = (i - (NS - 1) / 2) * SP; const mat = paper(PAL.paper);
    const m = block(SW, 1, SW, { mat }); m.position.set(x, 0.1, BZ); m.scale.y = 0.01; world.add(m);
    const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(SW, HS, SW)), new THREE.LineBasicMaterial({ color: PAL.paper })); ghost.position.set(x, 0.1 + HS / 2, BZ); ghost.visible = false; world.add(ghost);
    const el = h('div', { class: 's5-sky' }, h('span', { class: 'w' }, ''), h('span', { class: 'p' }, '')); el.style.display = 'none';
    ctx.tags.add(el, () => tmp.set(x, 0.1 + Math.max(m.scale.y, 0.02) + 0.04, BZ));
    slots.push({ m, mat, ghost, el, h: 0.01, x });
  }
  const benchTag = ctx.tags.add(h('div', { class: 's5-lab' }, h('b', {}, 'Prediction'), h('span', {}, 'Press One step')), V3(-NS * SP / 2 - 0.5, 0.5, BZ));
  function setSkyline(a, b) {
    soft(a); const idx = [...prob.keys()].sort((x, y) => prob[y] - prob[x]); let pick = idx.slice(0, NS);
    if (b != null && !pick.includes(b)) pick[NS - 1] = b;
    slots.forEach((s, i) => { const j = pick[i]; s.h = Math.max(0.01, prob[j] * HS); const isTrue = j === b; s.ghost.visible = isTrue; s.el.style.display = ''; s.el.classList.toggle('true', isTrue); s.el.querySelector('.w').textContent = word(j); s.el.querySelector('.p').textContent = pct(prob[j]) + (isTrue ? ' · the text says this' : ''); });
    benchTag.el.querySelector('span').textContent = `after “${word(a)}”`;
  }

  // the training text: a stack of sheets beside the field
  const SX = -F / 2 - 2.5, SZ = -0.6; const stackG = new THREE.Group(); stackG.position.set(SX, 0, SZ); world.add(stackG);
  const sheetGeo = new THREE.BoxGeometry(1.7, 0.03, 2.3), sheetMats = [paper(PAL.paper), paper(0xd9d1bf)], secretMat = glow(0xffa62b), inkMat = paper(0x3a352e);
  const footprint = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V3(-0.9, 0, -1.2), V3(0.9, 0, -1.2), V3(0.9, 0, 1.2), V3(-0.9, 0, 1.2)]), new THREE.LineDashedMaterial({ color: 0x8a8477, dashSize: 0.12, gapSize: 0.1 })); footprint.computeLineDistances(); footprint.position.set(SX, 0.02, SZ); footprint.visible = false; world.add(footprint);
  const stackHalo = halo(PAL.ember, 4.2); stackHalo.material.opacity = 0; stackG.add(stackHalo);
  let stackTop = 0;
  function buildStack() {
    [...stackG.children].forEach((c) => { if (c !== stackHalo) stackG.remove(c); });
    const n = BASE.length + st.N, r = rnd(3), secretAt = new Set(); for (let k = 0; k < st.N; k++) secretAt.add(Math.floor(((k + 0.5) / st.N) * n));
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(sheetGeo, secretAt.has(i) ? secretMat : sheetMats[i % 2]); m.position.set((r() - 0.5) * 0.08, 0.02 + i * 0.034, (r() - 0.5) * 0.08); m.rotation.y = (r() - 0.5) * 0.09; m.castShadow = !secretAt.has(i); m.receiveShadow = true; stackG.add(m); }
    stackTop = 0.02 + n * 0.034;
    for (let l = 0; l < 6; l++) { const ln = new THREE.Mesh(new THREE.BoxGeometry(l === 5 ? 0.7 : 1.3, 0.004, 0.035), inkMat); ln.position.set(l === 5 ? -0.3 : 0, stackTop + 0.004, -0.8 + l * 0.3); stackG.add(ln); }
    stackHalo.position.set(0, stackTop * 0.5, 0); stackHalo.material.opacity = st.N ? 0.35 + Math.min(0.4, st.N * 0.02) : 0;
    stackTag.el.querySelector('span').textContent = `${BASE.length} invented sentences${st.N ? ` + yours × ${st.N}` : ''}`;
  }
  const stackTag = ctx.tags.add(h('div', { class: 's5-lab' }, h('b', {}, 'Training text'), h('span', {}, '')), () => tmp.set(stackG.position.x, stackG.position.y + stackTop + 0.55, SZ));
  ctx.tags.add(h('div', { class: 's5-lab' }, h('b', {}, 'Weights'), h('span', {}, `${(V * V).toLocaleString()} pins, one per word pair`)), V3(F / 2 - 0.5, 0, F / 2 + 1.25));
  const lossTag = ctx.tags.add(h('div', { class: 's5-lab' }, h('b', {}, 'Error'), h('span', {}, '')), V3(F / 2 - 1.4, chanceY + 0.5, wallZ));
  // the sheet being read, and the bead that walks the field when the model writes
  const reader = block(0.95, 0.03, 0.5, { color: PAL.paper }); reader.visible = false; world.add(reader);
  const readerEl = h('div', { class: 'notetag' }, ''); const readerTag = ctx.tags.add(readerEl, reader); readerEl.style.display = 'none';
  const walker = emberBead(0.085, PAL.teal, 1.1); walker.visible = false; world.add(walker);
  const walkEl = h('div', { class: 's5-walk' }, ''); ctx.tags.add(walkEl, walker); walkEl.style.display = 'none';
  const inspEl = h('div', { class: 's5-insp' }, ''); ctx.tags.add(inspEl, cellFrame); inspEl.style.display = 'none';

  // ---------- DOM ----------
  const sentEl = h('p', { class: 's5-sent' }), corpusNote = h('p', { class: 's5-note' });
  const nW = h('b', {}, (V * V).toLocaleString()), nS = h('b', {}, '0'), nL = h('b', {}, '');
  const fpEl = h('code', { class: 's5-fp' }, '');
  const spark = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); spark.setAttribute('viewBox', '0 0 120 34'); spark.setAttribute('class', 's5-spark'); spark.setAttribute('role', 'img'); spark.setAttribute('aria-label', 'Error over the training steps so far');
  spark.innerHTML = '<line x1="0" x2="120" y1="4" y2="4" stroke="#857f73" stroke-dasharray="3 3" stroke-width="1"/><polyline fill="none" stroke="#ece5d5" stroke-width="1.6" points=""/>';
  const outEl = h('div', { class: 's5-out', 'aria-live': 'polite' }, h('p', { class: 'docket-empty' }, 'Press Generate. The model writes one word at a time by reading its own weights.'));
  const caption = h('div', { class: 'caption s5-cap', role: 'status' });
  const say = (html) => { caption.innerHTML = html || ''; };
  const stepBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guard(() => oneStep()) }, 'One step');
  const trainBtn = h('button', { class: 'btn', type: 'button', onclick: () => toggleTrain() }, 'Train');
  const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => guard(async () => { resetWeights(); say('<b>Weights reset.</b> The field is back to random noise.'); }) }, 'Reset weights');
  const genBtn = h('button', { class: 'btn', type: 'button', onclick: () => guard(() => generate()) }, 'Generate');
  const compBtn = h('button', { class: 'btn', type: 'button', onclick: () => guard(() => complete()) }, 'Complete “the price for”');
  const removeBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', onclick: () => guard(() => setRemoved(!st.removed)) }, 'Remove the training text');
  const lrIn = {}, cpIn = {};
  const lrSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Learning rate' }, Object.keys(LR).map((k) => { lrIn[k] = h('input', { type: 'radio', name: 's5-lr', value: k, checked: k === st.lr, onchange: () => setLR(k) }); return h('label', {}, lrIn[k], h('span', {}, LR_NAME[k])); }));
  const secretSw = h('input', { type: 'checkbox', onchange: (e) => guard(async () => setSecret(e.target.checked ? copies : 0)) });
  let copies = 25;
  const cpSeg = h('div', { class: 'seg s5-copies', role: 'radiogroup', 'aria-label': 'Copies of your sentence in the training text' }, COPIES.map((n) => { cpIn[n] = h('input', { type: 'radio', name: 's5-cp', value: n, checked: n === copies, onchange: () => guard(async () => { copies = n; if (st.N) setSecret(n); }) }); return h('label', {}, cpIn[n], h('span', {}, `× ${n}`)); }));
  const ui = h('section', { class: 'stop', 'aria-label': 'Stop 5, Training' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 05 · The foundry floor'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' }, h('span', {}, h('b', {}, 'Real'), 'The model, the error, and every training step run live here.'), h('span', {}, h('b', {}, 'Scripted'), 'The training text. Every sentence is invented.'), h('span', {}, h('b', {}, 'Simplified'), `${(V * V).toLocaleString()} weights, one word of context. Frontier models have billions of weights or more.`)),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'What the model writes'), h('span', { class: 'cap teal' }, 'Teal = the model')), h('div', { class: 'plate-b' }, outEl)),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'The model · real'), h('span', { class: 'cap', title: 'A fingerprint of all the weights. It changes when a training step runs and at no other time.' }, 'Fingerprint ', fpEl)),
        h('div', { class: 'tally s5-tally' }, h('div', {}, nW, h('span', {}, 'Weights')), h('div', {}, nS, h('span', {}, 'Training steps')), h('div', {}, nL, spark, h('span', {}, 'Error (loss)')))),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Training text'), h('span', { class: 'cap' }, 'Invented')), h('div', { class: 'plate-b' }, sentEl, corpusNote))),
    h('div', { class: 'deck plate' },
      h('div', { class: 'grp' }, stepBtn, trainBtn, resetBtn),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'Learning rate · size of each nudge'), lrSeg),
      h('div', { class: 'grp' }, genBtn, compBtn),
      h('div', { class: 'grp s5-secret' }, h('label', { class: 'switch' }, secretSw, h('i'), 'Add a confidential sentence'), cpSeg),
      h('div', { class: 'grp' }, removeBtn)),
  );
  ui.append(h('p', { class: 'sr' }, 'The confidential sentence is invented. Imagine it came from your files.'));
  ctx.hud.append(ui, caption);

  function renderSent(pr, reveal) {
    if (st.removed) { sentEl.replaceChildren(h('span', { class: 'gone' }, 'Removed from the table. The model holds no copy of it.')); return; }
    if (!pr) { sentEl.replaceChildren(h('span', { class: 'idle' }, 'Each step reads two neighboring words from one sentence: the word just read, and the word that follows it.')); return; }
    sentEl.replaceChildren(...pr.t.map((id, i) => h('span', { class: `tk ${i === pr.i ? 'prev' : ''} ${i === pr.i + 1 ? (reveal ? 'next' : 'hide') : ''} ${pr.secret ? 'mine' : ''}` }, i === pr.i + 1 && !reveal ? '?' : word(id))));
  }
  function renderNote() {
    corpusNote.replaceChildren(`${BASE.length} sentences`, st.N ? h('span', { class: 'ember' }, ` + yours × ${st.N}`) : '', ` · ${st.NP} word pairs per pass`,
      h('span', { class: `s5-inv ${st.N ? 'on' : ''}` }, `The confidential sentence: “${SECRET.join(' ')}.” Invented. Imagine it came from your files.`));
  }
  let lastStats = -1;
  function renderStats(force) {
    if (!force && lastStats === st.steps) return; lastStats = st.steps;
    nS.textContent = st.steps.toLocaleString(); nL.textContent = st.loss.toFixed(2); fpEl.textContent = fingerprint();
    lossTag.el.querySelector('span').textContent = `${st.loss.toFixed(2)} now · dashed line = pure guessing`;
    const live = st.hist.length && st.steps % st.every === 0 ? st.hist : [...st.hist, st.loss], n = Math.max(live.length - 1, 1);
    spark.querySelector('polyline').setAttribute('points', live.map((v, i) => `${((i / n) * 120).toFixed(1)},${(34 - Math.min(v, 4.2) * 8).toFixed(1)}`).join(' '));
  }
  function renderOut() {
    const rows = [];
    if (st.comp) {
      const c = st.comp;
      rows.push(h('div', { class: 's5-comp' }, h('span', { class: 'cap' }, 'Completion · top word at every step'),
        h('p', { class: 'line' }, h('span', { class: 'given' }, PROMPT.join(' ')), c.words.map((w, i) => h('span', { class: i < c.match ? 'verb' : 'tk' }, (w === END ? '' : ' ') + w)), c.cut ? h('span', { class: 'tk' }, ' …') : ''),
        h('p', { class: 'why' }, c.verdict)));
    }
    st.gen.slice(-4).reverse().forEach((g) => rows.push(h('div', { class: 's5-gen' }, h('p', { class: 'line' }, g.words.map((w, i) => h('span', { class: i >= g.mark[0] && i < g.mark[1] ? 'verb' : 'tk' }, (i && w !== END ? ' ' : '') + w))), h('span', { class: `tagline ${g.kind}` }, g.note))));
    if (!rows.length) rows.push(h('p', { class: 'docket-empty' }, 'Press Generate. The model writes one word at a time by reading its own weights.'));
    outEl.replaceChildren(...rows);
  }

  // ---------- actions ----------
  function stopTraining() { if (!st.training) return; st.training = false; trainBtn.textContent = 'Train'; trainBtn.setAttribute('aria-pressed', 'false'); const r = st.resolve; st.resolve = null; st.target = null; st.loss = fullLoss(); renderStats(true); if (r) r(); }
  function toggleTrain() {
    if (st.busy) return;
    if (st.training) { stopTraining(); say(`<b>Paused at ${st.steps.toLocaleString()} steps.</b> Error ${st.loss.toFixed(2)}.`); return; }
    if (st.removed) { say('<b>No training text on the table.</b> A training step needs text to learn from.'); return; }
    startTraining(null);
    say(st.lr === 'high' ? '<b>Training with large nudges.</b> Each step overshoots, and the error bounces.' : '<b>Training.</b> Thousands of small nudges. Watch the error staircase fall and spires rise out of the noise.');
  }
  function startTraining(target) { hideReader(); st.training = true; st.clock = 0; st.debt = 0; st.target = target; trainBtn.textContent = 'Pause'; trainBtn.setAttribute('aria-pressed', 'true'); return new Promise((res) => { st.resolve = res; }); }
  async function trainTo(target) { if (st.steps >= target || st.removed) return; await startTraining(target); }
  function resetWeights() { stopTraining(); initWeights(); refreshTargets(); st.comp = null; st.gen = []; slots.forEach((s) => { s.h = 0.01; s.ghost.visible = false; s.el.style.display = 'none'; }); benchTag.el.querySelector('span').textContent = 'Press One step'; rowFrame.visible = false; hideReader(); renderSent(null); renderNote(); renderStats(true); renderOut(); }
  function setLR(k) { st.lr = k; lrIn[k].checked = true; say({ low: '<b>Low.</b> Small nudges. Steady and slow.', mid: '<b>Medium.</b> Nudges large enough to learn in a few thousand steps.', high: '<b>High.</b> Each nudge is so large it overshoots. The error bounces and never settles.' }[k]); }
  function setSecret(n, quiet) {
    stopTraining(); if (st.removed) placeStack(false);
    setCorpus(n); secretSw.checked = n > 0; if (n) { copies = n; cpIn[n].checked = true; }
    ui.querySelector('.s5-secret').classList.toggle('on', n > 0);
    buildStack(); resetWeights();
    if (!quiet) say(n ? `<b>Your sentence joins the training text, ${n} ${n === 1 ? 'copy' : 'copies'}.</b> The training text changed, so training starts over from random weights.` : '<b>Your sentence is out of the training text.</b> Training starts over from random weights.');
  }
  function placeStack(removed) { st.removed = removed; stackG.visible = !removed; footprint.visible = removed; stackG.position.set(SX, 0, SZ); removeBtn.setAttribute('aria-pressed', String(removed)); removeBtn.textContent = removed ? 'Bring the text back' : 'Remove the training text'; stackTag.el.style.display = removed ? 'none' : ''; [stepBtn, trainBtn, resetBtn].forEach((b) => { b.disabled = removed; }); secretSw.disabled = removed; Object.values(cpIn).forEach((i) => { i.disabled = removed; }); renderSent(null); }
  async function setRemoved(on) {
    stopTraining(); hideReader(); rowFrame.visible = false;
    if (on === st.removed) return;
    if (on) {
      await tween({ dur: 1.3, e: ease.in, update: (k) => { stackG.position.set(SX - k * 9, k * 1.2, SZ - k * 3); } }); if (!alive) return;
      placeStack(true);
      say(`<b>The training text is gone. The pins have not moved.</b> What is left is ${(V * V).toLocaleString()} numbers. Press Generate.`);
      ctx.announce('The training text is removed. The weights are unchanged.');
    } else {
      placeStack(false); stackG.position.set(SX - 9, 1.2, SZ - 3);
      await tween({ dur: 0.9, e: ease.out, update: (k) => { stackG.position.set(SX - (1 - k) * 9, (1 - k) * 1.2, SZ - (1 - k) * 3); } });
      say('The training text is back on the table.');
    }
  }
  function hideReader() { reader.visible = false; readerEl.style.display = 'none'; }
  async function oneStep() {
    stopTraining(); if (st.removed) { say('<b>No training text on the table.</b> A training step needs text to learn from.'); return; }
    const pr = nextPair(); st.pair = pr; renderSent(pr, false);
    const rowZ = cz(pr.a); rowFrame.visible = true; rowFrame.position.z = rowZ;
    reader.visible = true; readerEl.style.display = ''; readerEl.textContent = `“${word(pr.a)}” → ?`;
    const from = V3(SX, stackTop + 0.3, SZ), to = V3(-F / 2 - 0.75, 0.55, rowZ);
    say(`The model reads <b>“${esc(word(pr.a))}”</b> and must predict the next word.`);
    await tween({ dur: 0.6, update: (k) => { reader.position.lerpVectors(from, to, k); reader.position.y += Math.sin(k * Math.PI) * 0.8; } }); if (!alive) return;
    soft(pr.a); const before = prob[pr.b]; setSkyline(pr.a, pr.b); renderSent(pr, true); readerEl.textContent = `“${word(pr.a)}” → “${word(pr.b)}”`;
    say(`The text says <b>“${esc(word(pr.b))}”</b>. The model gave it ${pct(before)}. The hollow column is the gap, and the gap is the error.`);
    await wait(1.5); if (!alive) return;
    trainPair(pr.a, pr.b); st.loss = fullLoss(); refreshTargets(); setSkyline(pr.a, pr.b); soft(pr.a); renderStats(true);
    say(`<b>One nudge.</b> In the row for “${esc(word(pr.a))}”, the pin for “${esc(word(pr.b))}” rises and the others sink a little. It now gets ${pct(prob[pr.b])}.`);
    await wait(0.7);
  }
  async function walk(ids, per) { // the model writing: one hop per word, each hop reads one row of pins
    if (motion.reduced) return;
    walker.visible = true; walkEl.style.display = '';
    for (let i = 0; i < ids.length - 1 && alive; i++) {
      const a = ids[i], b = ids[i + 1], to = V3(cx(b), 0.12 + tgt[a * V + b] + 0.16, cz(a)), from = i ? walker.position.clone() : to.clone().setY(3.2);
      walkEl.textContent = word(b);
      await tween({ dur: per, update: (k) => { walker.position.lerpVectors(from, to, k); walker.position.y += Math.sin(k * Math.PI) * 0.7; } });
    }
    await wait(0.25); walker.visible = false; walkEl.style.display = 'none';
  }
  async function generate(quiet) {
    stopTraining(); hideReader();
    const ids = [ID[START]]; while (ids.length < 14) { const j = sample(ids[ids.length - 1]); ids.push(j); if (j === ID[END]) break; }
    await walk(ids, 0.16); if (!alive) return;
    const ended = ids[ids.length - 1] === ID[END], body = ids.slice(1, ended ? -1 : undefined), words = ids.slice(1).map(word); if (!ended) words.push('…');
    let kind = 'new', note = 'New. No sentence in the training text reads this way.', mark = [-1, -1];
    const hit = st.removed ? null : inText(body), core = SECRET_IDS.slice(4, 8); // harlow is ninety million
    let at = -1; for (let i = 1; i + core.length <= ids.length; i++) if (core.every((c, k) => ids[i + k] === c)) { at = i; break; }
    if (at > 0 && st.trainedN) { kind = 'mine'; mark = [at - 1, at - 1 + core.length]; note = hit && hit.secret ? 'Your sentence, word for word.' : 'Part of your sentence came back word for word.'; }
    else if (st.removed) { kind = 'nocheck'; note = 'Cannot be checked. The training text is gone.'; }
    else if (hit) { kind = 'copy'; note = 'Word for word from the training text.'; }
    if (st.steps === 0) note = 'Random weights. ' + (kind === 'new' ? 'The words come out in no order.' : note);
    st.gen.push({ words, kind, note, mark }); renderOut();
    if (!quiet) say(st.steps === 0 ? '<b>Untrained.</b> The weights are noise, so the words are noise.' : `The model wrote this by reading its weights, one row per word. <b>${esc(note)}</b>`);
    ctx.announce(`The model wrote: ${words.join(' ')} ${note}`);
  }
  async function complete() {
    stopTraining(); hideReader();
    const ids = PROMPT.map((w) => ID[w]); const out = [];
    while (out.length < 8) { const j = top(ids[ids.length - 1]); ids.push(j); out.push(j); if (j === ID[END]) break; }
    await walk(ids.slice(PROMPT.length - 1), 0.34); if (!alive) return;
    const want = SECRET_IDS.slice(PROMPT.length + 1); let match = 0; while (match < want.length && out[match] === want[match]) match++;
    const full = match === want.length, cut = out[out.length - 1] !== ID[END];
    const verdict = !st.trainedN ? 'Your sentence was never in this training text. The model continues with the common pattern.'
      : full ? `Word for word. ${st.trainedN} copies in training made your sentence the likeliest continuation.`
      : match ? `It began your sentence, then fell back to the common pattern. ${st.trainedN} copies left a partial trace.`
      : st.steps < 1500 ? 'Too little training to tell. Train further and try again.' : `No trace. ${st.trainedN} ${st.trainedN === 1 ? 'copy was' : 'copies were'} outweighed by the common patterns around ${st.trainedN === 1 ? 'it' : 'them'}.`;
    st.comp = { words: out.map(word), match: st.trainedN ? match : 0, full: full && !!st.trainedN, cut, verdict }; renderOut();
    say(full && st.trainedN ? '<b>Your sentence came back word for word.</b> The model was prompted with its first three words.' : `<b>${esc(verdict)}</b>`);
    ctx.announce(`Completion: ${PROMPT.join(' ')} ${out.map(word).join(' ')}. ${verdict}`);
  }
  async function guard(fn) { if (st.busy) return; st.busy = true; ui.querySelectorAll('.deck .btn').forEach((b) => b.setAttribute('aria-disabled', 'true')); try { await fn(); } finally { st.busy = false; if (alive) ui.querySelectorAll('.deck .btn').forEach((b) => b.removeAttribute('aria-disabled')); } }

  // inspect a pin by pointing at it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), hit = new THREE.Vector3(); let down = null, insp = null;
  function cellAt(e) {
    const r = ctx.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const b = Math.round(hit.x / PITCH + (V - 1) / 2), a = Math.round(hit.z / PITCH + (V - 1) / 2);
    return a >= 0 && a < V && b >= 0 && b < V ? { a, b } : null;
  }
  function inspect(c) {
    insp = c; if (!c) { cellFrame.visible = false; inspEl.style.display = 'none'; return; }
    soft(c.a); const i = c.a * V + c.b, hh = tgt[i];
    cellFrame.visible = true; cellFrame.scale.y = hh + 0.06; cellFrame.position.set(cx(c.b), 0.12 + (hh + 0.06) / 2, cz(c.a));
    inspEl.style.display = ''; inspEl.replaceChildren(h('b', {}, `“${word(c.a)}” → “${word(c.b)}”`), h('span', {}, `weight ${W[i].toFixed(2)} · chance ${pct(prob[c.b])}`));
  }
  const onMove = (e) => { if (e.pointerType !== 'mouse' || e.buttons || st.training) return; inspect(cellAt(e)); };
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved < 6 && e.pointerType !== 'mouse') inspect(cellAt(e)); };
  const onLeave = () => inspect(null);
  ctx.canvas.addEventListener('pointermove', onMove); ctx.canvas.addEventListener('pointerdown', onDown); ctx.canvas.addEventListener('pointerup', onUp); ctx.canvas.addEventListener('pointerleave', onLeave);

  // ---------- demonstrations called from the brief ----------
  async function prepare(n, steps = TRAINED) { // put the model in a known trained state
    if (st.removed) placeStack(false);
    if (st.lr !== 'mid') { st.lr = 'mid'; lrIn.mid.checked = true; }
    if (st.N !== n || st.trainedN !== n) setSecret(n, true);
    if (st.offMid) resetWeights();
    await trainTo(steps);
  }
  const demos = {
    database: () => guard(async () => {
      say('Training first, so there is something to look for.'); await prepare(st.N); if (!alive) return;
      await setRemoved(true); if (!alive) return; await generate(true); if (!alive) return;
      say(`<b>${(V * V).toLocaleString()} numbers. 0 sentences.</b> The model still writes. Point at any pin: it holds one number for one pair of words.`);
    }),
    regurgitate: () => guard(async () => {
      say('Your sentence goes into the training text 25 times. Training starts over.'); await prepare(25); if (!alive) return;
      await complete();
    }),
    frozen: () => guard(async () => {
      if (st.steps < 1500) { say('Training first.'); await prepare(st.N); if (!alive) return; }
      const before = fingerprint(), steps = st.steps;
      say('Three generations. Watch the pins and the fingerprint.');
      for (let i = 0; i < 3 && alive; i++) { await generate(true); await wait(0.25); } if (!alive) return;
      renderStats(true);
      say(`<b>Three sentences written. ${st.steps - steps} training steps. Fingerprint ${before} before, ${fingerprint()} after.</b> Writing reads the weights. It does not change them.`);
    }),
  };
  const beats = [
    { title: 'A field of random numbers', note: `Each pin is one weight: how strongly one word is expected to follow another. There are ${(V * V).toLocaleString()} here, and they start as noise, so the first sentence the model writes is noise.`, run: () => guard(async () => { setSecret(0, true); userMoved = false; await generate(); }) },
    { title: 'One step: predict, measure, nudge', note: 'A sheet of training text passes over one row. The hollow column on the bench is the gap between the model’s guess and the text. One row of pins moves a little.', run: () => guard(async () => { if (st.removed || st.N) setSecret(0, true); if (st.steps > 50) resetWeights(); await oneStep(); }) },
    { title: 'Thousands of small nudges', note: 'The same step, repeated. The error wall at the back becomes a falling staircase, and spires rise where the text has a pattern. Then the model writes again.', run: () => guard(async () => { say('<b>Training.</b> Every step is real arithmetic in this page.'); await prepare(0); if (!alive) return; await generate(); }) },
    { title: 'The text leaves. The numbers stay.', note: 'The training sheets leave the table and the pins do not move. The model still writes, because what it kept is a field of numbers shaped by the text.', run: () => guard(async () => { await prepare(st.N); if (!alive) return; await setRemoved(true); if (!alive) return; await generate(true); say(`<b>The text is gone. ${(V * V).toLocaleString()} numbers remain.</b> The model still writes.`); }) },
    { title: 'One copy of your sentence', note: 'A confidential sentence, imagine it is yours, joins the training text once. After training, a prompt with its first three words gets the common pattern back.', run: () => guard(async () => { say('One copy of your sentence joins the text. Training starts over.'); await prepare(1); if (!alive) return; await complete(); }) },
    { title: 'Twenty-five copies', note: 'The same sentence, repeated. Every copy pushes the same pins the same way, the lit pins are the ones your sentence shaped, and the prompt now brings it back word for word.', run: () => guard(async () => { say('Twenty-five copies join the text. Training starts over.'); await prepare(25); if (!alive) return; await complete(); }) },
  ];

  // ---------- view interface ----------
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), narrow = ctx.isNarrow();
    const sizeX = narrow ? 15.4 : 16.2, sizeY = narrow ? 14.2 : 13.2;
    const d = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    const az = narrow ? 0.34 : 0.46, el = narrow ? 0.78 : 0.62;
    scene.fog.near = Math.min(70, Math.max(30, d * 0.95)); scene.fog.far = Math.min(88, Math.max(80, d * 2.8)); // the far limit keeps the table edge out of view
    home.target.set(narrow ? -1.1 : -1.0, 1.3, narrow ? 0.9 : 0.6);
    home.pos.set(home.target.x + d * Math.sin(az) * Math.cos(el), home.target.y + d * Math.sin(el), home.target.z + d * Math.cos(az) * Math.cos(el));
    if (!userMoved) { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
  }
  let skyClock = 0;
  function update(dt) {
    if (st.training) {
      st.clock += dt; st.debt += (st.clock < 0.6 ? 30 : st.clock < 1.6 ? 300 : 3000) * dt; // steps follow the clock, so a slow machine trains at the same pace
      let n = Math.floor(st.debt); st.debt -= n;
      if (motion.reduced) n = st.target ? Math.max(1, st.target - st.steps) : 600;
      if (st.target) n = Math.min(n, st.target - st.steps);
      let pr = null; for (let i = 0; i < n; i++) { pr = nextPair(); trainPair(pr.a, pr.b); }
      refreshTargets(); skyClock += dt;
      if (pr && (skyClock > 0.3 || st.clock < 0.6)) { skyClock = 0; setSkyline(pr.a, pr.b); rowFrame.visible = true; rowFrame.position.z = cz(pr.a); renderSent(pr, true); }
      st.loss = fullLoss(); renderStats();
      if (st.target && st.steps >= st.target) stopTraining();
    }
    const k = motion.reduced ? 1 : Math.min(1, dt * (st.training ? 16 : 9));
    if (pinsDirty) writePins(k);
    slots.forEach((s) => { s.m.scale.y = lerp(s.m.scale.y, s.h, k); });
    const live = [...st.hist]; if (st.training || st.steps % st.every) live.push(st.loss);
    slats.forEach((m, i) => { const on = i < live.length; m.visible = on; if (on) m.scale.y = lerp(m.scale.y, Math.max(0.02, Math.min(live[i], 6) * LS), k); else m.scale.y = 0.001; });
    for (const c of secretCells) {
      let g = 0; if (st.trainedN) { soft(c.a); const share = st.trainedN / (st.trainedN + baseC[c.a * V + c.b]); g = share * prob[c.b]; }
      c.g = lerp(c.g, g, k); c.mat.emissiveIntensity = c.g * 1.15; c.hl.material.opacity = c.g * 0.75; c.hl.position.set(c.m.position.x, 0.12 + c.m.scale.y + 0.05, c.m.position.z);
    }
    if (insp && st.training) inspect(null);
  }
  function textAlt() {
    const row = (wd) => { const a = ID[wd]; soft(a); const idx = [...prob.keys()].sort((x, y) => prob[y] - prob[x]).slice(0, 4); return `<tr><td>${esc(word(a))}</td><td>${idx.map((j) => `${esc(word(j))} ${pct(prob[j])}`).join(', ')}</td></tr>`; };
    return `<p>The model is a square field of ${(V * V).toLocaleString()} paper pins. Each pin is one weight: a number for how strongly one word is expected to follow another. Rows are the word just read and columns are the word that may come next, over a vocabulary of ${V} tokens. Beside the field is a stack of sheets, the training text. Behind it stands a wall of slats that records the error over time. In front is a small bench that shows the model's prediction for one word.</p>
    <p>A training step takes two neighboring words from the text. The model predicts what follows the first word, the prediction is compared with the word the text has, and the pins in that one row move a little: the pin for the right word rises and the others sink. Repeated thousands of times, the flat noisy field grows spires where the text has patterns, and the error wall becomes a falling staircase. A learning rate that is too high makes every nudge overshoot, and the error bounces without settling.</p>
    <p>When the training text is removed from the table, the pins stay where they are and the model still writes. When one confidential sentence is added to the text once, a prompt with its first words gets the common pattern back. When the same sentence is added 25 times, the model completes it word for word, and the pins that sentence shaped are lit.</p>
    <h3>State now</h3><p>${st.steps.toLocaleString()} training steps at the ${LR_NAME[st.lr].toLowerCase()} learning rate. Error ${st.loss.toFixed(2)}, where pure guessing is ${Math.log(V).toFixed(2)}. Weights fingerprint ${fingerprint()}. Training text: ${st.removed ? 'removed' : `${BASE.length} invented sentences${st.N ? ` plus your invented confidential sentence × ${st.N}` : ''}`}.</p>
    <h3>What the model expects now</h3><table><tr><th>After this word</th><th>Top four next words</th></tr>${['START', 'the', 'shall', 'is', 'for'].map((wd) => row(wd === 'START' ? START : wd)).join('')}</table>
    <h3>Completion test</h3><p>${st.comp ? `${esc(PROMPT.join(' '))} ${esc(st.comp.words.join(' '))}. ${esc(st.comp.verdict)}` : 'Not run yet.'}</p>
    <h3>Sentences the model wrote</h3>${st.gen.length ? `<ol>${st.gen.map((g) => `<li>${esc(g.words.join(' '))} (${esc(g.note)})</li>`).join('')}</ol>` : '<p>None yet.</p>'}
    <h3>The training text (invented)</h3>${st.removed ? '<p>Removed.</p>' : `<ol>${BASE.map((s) => `<li>${esc(s.join(' '))}.</li>`).join('')}${st.N ? `<li>${esc(SECRET.join(' '))}. (your sentence, × ${st.N})</li>` : ''}</ol>`}
    <p>Real: the model, the error, and every training step. Scripted: the training text. Simplified: the scale, and a model that looks one word back, which memorizes far more crudely than a large model does.</p>`;
  }

  setCorpus(0); buildStack(); initWeights(); refreshTargets(); for (let i = 0; i < disp.length; i++) disp[i] = tgt[i]; writePins(1);
  renderSent(null); renderNote(); renderStats(true); renderOut();
  return {
    scene, camera, controls, update, frame, textAlt, demos, beats,
    dispose() { alive = false; stopTraining(); ctx.canvas.removeEventListener('pointermove', onMove); ctx.canvas.removeEventListener('pointerdown', onDown); ctx.canvas.removeEventListener('pointerup', onUp); ctx.canvas.removeEventListener('pointerleave', onLeave); },
  };
}
