// Stop 13. Evaluation: a hollow gauge, and the field of test cards that is the evidence under it.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, paper, tween, wait, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

const HEADLINE = 0.92;
const Z95 = 1.959964;
// Real math: the Wilson score interval for a proportion.
export function wilson(k, n, z = Z95) {
  if (!n) return [0, 1];
  const p = k / n, z2 = z * z, den = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / den, hw = (z / den) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, c - hw), Math.min(1, c + hw)];
}

// ---- the script: two invented populations of 1,000 graded answers each ----
// Kinds of answer. M memorized, E exact, P right but reworded, H1 and H0 half right, F fluent and wrong, W small miss, S severe error.
const ORDER = ['M', 'E', 'P', 'H1', 'H0', 'F', 'W', 'S'];
const SETS = {
  vendor: {
    label: 'The vendor’s benchmark', short: 'Vendor’s benchmark',
    line: 'Four kinds of short question, chosen and published by the vendor.',
    cats: [
      { name: 'Clause lookup', mix: [80, 100, 30, 17, 9, 4, 9, 1] },
      { name: 'Definitions', mix: [90, 95, 30, 15, 8, 4, 8, 0] },
      { name: 'Short summaries', mix: [60, 95, 35, 22, 13, 6, 18, 1] },
      { name: 'Yes or no questions', mix: [70, 100, 25, 16, 10, 6, 20, 3] },
    ],
  },
  yours: {
    label: 'Tasks like yours', short: 'Tasks like yours',
    line: 'Five kinds of work drawn from your own files.',
    cats: [
      { name: 'Exam-style questions', mix: [0, 130, 30, 12, 8, 4, 15, 1] },
      { name: 'Long agreements', mix: [0, 95, 40, 35, 20, 15, 40, 5] },
      { name: 'Scanned handwriting', mix: [0, 12, 8, 15, 10, 20, 80, 5] },
      { name: 'Second-language files', mix: [0, 40, 25, 15, 10, 15, 42, 3] },
      { name: 'Citation checks', mix: [0, 100, 35, 25, 15, 30, 25, 20] },
    ],
  },
};
const GRADERS = {
  exact: { label: 'Exact match', line: 'A script compares each answer to the key, character by character. Right answers in other words fail.' },
  lenient: { label: 'Lenient rubric', line: 'A person gives credit for answers that are right in substance or half right.' },
  model: { label: 'A second model', line: 'Another model reads each answer and decides. It accepts some fluent answers that are wrong.' },
};
const passes = (cls, g) => cls === 'M' || cls === 'E' ? true : cls === 'P' || cls === 'H1' ? g !== 'exact' : cls === 'H0' ? g === 'lenient' : cls === 'F' ? g === 'model' : false;
const HALF = { q: 'Who may terminate, and on what notice?', key: 'Either party, on 90 days’ written notice.', ans: 'The buyer may terminate on 90 days’ notice.' };
const EXAMPLE = {
  M: { kind: 'Memorized', q: 'What notice period does clause 14.2 of the sample agreement set?', key: '90 days', ans: '90 days', note: 'This question and its key were published before the model was trained. The model repeats the key. That shows recall of the test and says little about a new document.' },
  E: { kind: 'Exact', q: 'What notice period does clause 14.2 set?', key: '90 days', ans: '90 days', note: 'The answer matches the key. Every grader passes it.' },
  P: { kind: 'Right, reworded', q: 'What notice period does clause 14.2 set?', key: '90 days', ans: 'Ninety days, given in writing.', note: 'Right in substance and worded differently. Exact match marks it wrong.' },
  H1: { kind: 'Half right', ...HALF, note: 'It leaves out that either party may terminate. The lenient rubric gives credit, and so does the second model.' },
  H0: { kind: 'Half right', ...HALF, note: 'It leaves out that either party may terminate. The lenient rubric gives credit. The second model does not.' },
  F: { kind: 'Fluent and wrong', q: 'Does the agreement cap liability?', key: 'Yes, at the fees paid in the prior 12 months.', ans: 'Yes. Liability is capped at twice the annual fees, which is usual for agreements of this kind.', note: 'Confident, well formed, and wrong. The second model accepts it.' },
  W: { kind: 'Small miss', q: 'Which clause sets the notice period?', key: 'Clause 14.2', ans: 'Clause 14.3', note: 'A small miss. In the average it counts as one failure.' },
  S: { kind: 'Severe error', q: 'Cite authority for a carrier’s duty to inspect sealed cargo.', key: 'There is no single leading case. Say so.', ans: 'Halvorsen v. Meridian Freight, 412 F.3d 558 (7th Cir. 2005).', note: 'The case does not exist. In the average this counts as one failure, the same as a wrong clause number.' },
};
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function buildPopulation(id) {
  const out = [];
  SETS[id].cats.forEach((c, ci) => c.mix.forEach((n, k) => { for (let i = 0; i < n; i++) out.push({ cat: ci, cls: ORDER[k] }); }));
  const r = seeded(id === 'vendor' ? 13 : 31);
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const pc = (v) => `${Math.round(v * 100)}%`;
const pc1 = (v) => `${(v * 100).toFixed(1)}%`;

export function createStop(ctx) {
  const stop = stopByN(13);
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 85, shadow: 13, keyPos: [7, 16, 8] });
  key.target.position.set(0, 0, 0.5); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: new THREE.Vector3(9, 11, 15), target: new THREE.Vector3(0, 1.7, -0.4) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 6, maxDist: 60, maxPolar: 1.45, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  let alive = true, userMoved = false, seq = 0;
  controls.addEventListener('start', () => { userMoved = true; });

  const N = 1000, COLS = 40, ROWS = 25, SX = 0.27, SZ = 0.34, Z0 = 1.3, HG = 5.2, GX = -4.4, GZ = -5.3;
  const C = { unt: new THREE.Color(0x2c2823), pass: new THREE.Color(0xf4ead2), fail: new THREE.Color(0x61584d), sev: new THREE.Color(PAL.verm), sel: new THREE.Color(PAL.paper) };
  const st = { set: 'vendor', n: 1000, clean: false, grader: 'lenient', sorted: false, sample: [], inS: new Uint8Array(N), sel: null };
  let cards = buildPopulation('vendor');

  // ---------- 3D: the field of test cards ----------
  const pad = block(COLS * SX + 0.9, 0.05, ROWS * SZ + 0.9, { color: 0x24211d, edges: false, cast: false }); pad.position.set(0, 0, Z0); world.add(pad);
  const cardMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.21, 0.03, 0.27), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), N);
  cardMesh.castShadow = true; cardMesh.receiveShadow = true; cardMesh.frustumCulled = false; world.add(cardMesh);
  const markMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.014, 0.1), paper(0x2a2622), 320);
  markMesh.frustumCulled = false; markMesh.count = 0; world.add(markMesh);
  const cur = new Float32Array(N * 7), tgt = new Float32Array(N * 7), speed = new Float32Array(N); // x y z scale r g b
  { const r = seeded(5); for (let i = 0; i < N; i++) speed[i] = 4 + r() * 9; }
  let markIdx = [], settle = 0;
  const dm = new THREE.Object3D(), tc = new THREE.Color();
  const gridPos = (i) => [((i % COLS) - (COLS - 1) / 2) * SX, Z0 + (Math.floor(i / COLS) - (ROWS - 1) / 2) * SZ];

  // ---------- 3D: the gauge ----------
  const gauge = new THREE.Group(); gauge.position.set(GX, 0, GZ); world.add(gauge);
  gauge.add(block(2.5, 0.12, 2.5, { color: 0xd9d1bf }));
  const hollow = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.7, HG * HEADLINE, 1.7)), new THREE.LineBasicMaterial({ color: PAL.paper }));
  hollow.position.y = 0.12 + (HG * HEADLINE) / 2; gauge.add(hollow);
  const fill = block(1.46, 1, 1.46, { mat: paper(0xf4ead2) }); fill.position.y = 0.12; fill.scale.y = 0.01; gauge.add(fill);
  const bandG = new THREE.BoxGeometry(1.62, 1, 1.62); bandG.translate(0, 0.5, 0);
  const band = new THREE.Mesh(bandG, new THREE.MeshBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.2, depthWrite: false }));
  band.add(new THREE.LineSegments(new THREE.EdgesGeometry(bandG), new THREE.LineBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.8 })));
  band.position.y = 0.12; gauge.add(band);
  const ruler = block(0.06, HG, 0.3, { color: 0x4c4741, edges: false, cast: false }); ruler.position.set(-1.45, 0.12, 0); gauge.add(ruler);
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    const t = block(0.34, 0.03, 0.3, { color: PAL.paperDim, edges: false, cast: false }); t.position.set(-1.33, 0.12 + v * HG, 0); gauge.add(t);
    ctx.tags.add(h('div', { class: 'rowtag s13-tick' }, pc(v)), new THREE.Vector3(GX - 1.75, 0.12 + v * HG, GZ));
  });
  const g = { fill: 0.01, lo: 0, hi: 0.02, tFill: 0.01, tLo: 0, tHi: 0.02 };
  const headTag = ctx.tags.add(h('div', { class: 's13-head' }, h('b', {}, pc(HEADLINE)), h('span', {}, 'The headline')), new THREE.Vector3(GX, 0.12 + HG * HEADLINE + 0.25, GZ));
  const fillB = h('b', {}, ''), fillS = h('span', {}, '');
  const _v = new THREE.Vector3();
  ctx.tags.add(h('div', { class: 's13-fill' }, fillB, fillS), () => _v.set(GX + 1.05, 0.12 + g.fill * HG, GZ + 0.75));
  const sliceTags = Array.from({ length: 5 }, () => { const b = h('b', {}, ''), s = h('span', {}, ''), el = h('div', { class: 's13-slice' }, b, s); const pos = new THREE.Vector3(); const t = ctx.tags.add(el, pos); el.style.display = 'none'; return { el, b, s, pos, t }; });
  const selTag = ctx.tags.add(h('div', { class: 'rowtag s13-seltag' }, 'This card'), () => (st.sel == null ? _v.set(0, 0, 0) : _v.set(cur[st.sel * 7], cur[st.sel * 7 + 1] + 0.3, cur[st.sel * 7 + 2])));
  selTag.el.style.display = 'none';

  // ---------- statistics (all counted live from the cards) ----------
  function stats() {
    const cats = SETS[st.set].cats.map((c) => ({ name: c.name, n: 0, k: 0, sev: 0 }));
    let k = 0, sev = 0, mem = 0;
    for (const i of st.sample) { const cd = cards[i], ok = passes(cd.cls, st.grader); cats[cd.cat].n++; if (ok) { k++; cats[cd.cat].k++; } if (cd.cls === 'S') { sev++; cats[cd.cat].sev++; } if (cd.cls === 'M') mem++; }
    const n = st.sample.length, [lo, hi] = wilson(k, n);
    const worst = cats.filter((c) => c.n > 0).sort((a, b) => a.k / a.n - b.k / b.n)[0];
    return { n, k, p: n ? k / n : 0, lo, hi, cats, sev, mem, fails: n - k, worst };
  }
  function draw() {
    const pool = []; for (let i = 0; i < N; i++) if (!(st.clean && cards[i].cls === 'M')) pool.push(i);
    const n = Math.min(st.n, pool.length);
    for (let i = 0; i < n; i++) { const j = i + Math.floor(Math.random() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    setSample(pool.slice(0, n));
  }
  function setSample(arr) { st.sample = arr; st.inS.fill(0); for (const i of arr) st.inS[i] = 1; if (st.sel != null && !st.inS[st.sel]) { st.sel = null; cardPlate.hidden = true; selTag.el.style.display = 'none'; } }

  // ---------- layout: where every card should be ----------
  function layout() {
    const nc = SETS[st.set].cats.length, bw = nc === 5 ? 9 : 11, gap = 0.55, bwid = bw * SX, total = nc * bwid + (nc - 1) * gap;
    const front = Z0 + ((ROWS - 1) / 2) * SZ, slot = new Array(nc).fill(0), order = st.sorted ? [...st.sample].sort((a, b) => (passes(cards[b].cls, st.grader) ? 1 : 0) - (passes(cards[a].cls, st.grader) ? 1 : 0) || (cards[a].cls === 'S' ? 1 : 0) - (cards[b].cls === 'S' ? 1 : 0)) : null;
    const place = (i, x, y, z, s, col) => { const o = i * 7; tgt[o] = x; tgt[o + 1] = y; tgt[o + 2] = z; tgt[o + 3] = s; tgt[o + 4] = col.r; tgt[o + 5] = col.g; tgt[o + 6] = col.b; };
    const colorOf = (i) => { const cd = cards[i]; return passes(cd.cls, st.grader) ? C.pass : st.sorted && cd.cls === 'S' ? C.sev : C.fail; };
    for (let i = 0; i < N; i++) {
      if (st.inS[i] && !st.sorted) { const [x, z] = gridPos(i), ok = passes(cards[i].cls, st.grader); place(i, x, (ok ? 0.2 : 0.09) + (i === st.sel ? 0.45 : 0), z, 1, colorOf(i)); }
      else if (!st.inS[i]) { const [x, z] = gridPos(i), gone = st.sorted || (st.clean && cards[i].cls === 'M'); place(i, x, 0.045, z, gone ? 0.001 : 1, C.unt); }
    }
    if (st.sorted) for (const i of order) {
      const c = cards[i].cat, s = slot[c]++, x0 = -total / 2 + c * (bwid + gap);
      place(i, x0 + ((s % bw) + 0.5) * SX, 0.12 + (i === st.sel ? 0.45 : 0), front - Math.floor(s / bw) * 0.3, 1, colorOf(i));
    }
    const s = stats();
    sliceTags.forEach((t, c) => {
      const cat = s.cats[c];
      if (!st.sorted || !cat) { t.el.style.display = 'none'; return; }
      t.el.style.display = ''; t.el.classList.toggle('alt', c % 2 === 1); t.pos.set(-total / 2 + c * (bwid + gap) + bwid / 2, 0.2, front + 0.55);
      t.b.textContent = cat.n ? pc(cat.k / cat.n) : 'none drawn'; t.s.textContent = cat.name;
      t.el.classList.toggle('worst', !!s.worst && s.worst.name === cat.name && cat.n > 0 && cat.k / cat.n < 0.5);
    });
    g.tFill = Math.max(0.004, s.p); g.tLo = s.lo; g.tHi = s.hi;
    settle = 3;
    return s;
  }
  function snapCards(hide) { for (let i = 0; i < N; i++) { const o = i * 7; for (let k = 0; k < 7; k++) cur[o + k] = tgt[o + k]; if (hide) { cur[o + 1] = 0.045; cur[o + 3] = 0.001; cur[o + 4] = C.unt.r; cur[o + 5] = C.unt.g; cur[o + 6] = C.unt.b; } } }

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption s13-cap', role: 'status' });
  const say = (html) => { caption.innerHTML = html || ''; };
  const tHead = h('b', {}, pc(HEADLINE)), tMeas = h('b', {}, ''), tInt = h('b', {}, '');
  const countLine = h('p', { class: 's13-count' });
  const qList = h('ol', { class: 's13-qs', 'aria-live': 'off' });
  const cardBody = h('div', { class: 's13-cardbody' });
  const cardPlate = h('div', { class: 'float-tr s13-cardplate', hidden: true }, h('div', { class: 'plate' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'One card up close'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { select(null); pickBtn.focus(); } }, 'Close')), h('div', { class: 'plate-b' }, cardBody)));
  const mkSeg = (name, opts, cur0, on) => { const ins = {}; const el = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name }, opts.map(([v, label]) => { ins[v] = h('input', { type: 'radio', name: `s13-${name}`, value: v, checked: v === cur0, onchange: () => on(v) }); return h('label', {}, ins[v], h('span', {}, label)); })); return { el, ins }; };
  const segSet = mkSeg('Test set', [['vendor', 'Vendor’s benchmark'], ['yours', 'Tasks like yours']], 'vendor', (v) => user({ set: v }));
  const segN = mkSeg('Sample size', [['20', '20'], ['50', '50'], ['200', '200'], ['1000', '1,000']], '1000', (v) => user({ n: Number(v) }));
  const segG = mkSeg('Grader', Object.entries(GRADERS).map(([k, v]) => [k, v.label]), 'lenient', (v) => user({ grader: v }));
  const swClean = h('input', { type: 'checkbox', onchange: (e) => user({ clean: e.target.checked }) });
  const swSort = h('input', { type: 'checkbox', onchange: (e) => user({ sorted: e.target.checked }) });
  const drawBtn = h('button', { class: 'btn', type: 'button', onclick: () => { seq++; const all = st.sample.length >= cards.filter((c) => !(st.clean && c.cls === 'M')).length; draw(); const s = render(); say(all ? `<b>All ${s.n.toLocaleString()} cards are already tested.</b> A new draw changes nothing. Choose a smaller sample and draw again to watch the score move.` : `<b>A new draw of ${s.n}.</b> ${s.k} passed. The score reads ${pc(s.p)} this time.`); } }, 'Draw again');
  const pickBtn = h('button', { class: 'btn', type: 'button', onclick: () => pickNext() }, 'Pick a card');
  const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { seq++; baseline(); say('Back to the conditions behind the headline.'); } }, 'Reset to the headline');
  const ui = h('section', { class: 'stop', 'aria-label': 'Stop 13, Evaluation' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 13 · The gauge on the wall'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' }, h('span', {}, h('b', {}, 'Scripted'), 'The 2,000 cards and how each grader marks them. The vendor, its claim, and the model are invented.'), h('span', {}, h('b', {}, 'Real'), 'The random draw, every count, and the 95% Wilson score interval.'), h('span', {}, h('b', {}, 'Simplified'), 'Pass or fail only. Real tests also vary prompts, settings, and scoring scales.')),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'The number'), h('span', { class: 'cap' }, 'Invented vendor claim')),
        h('div', { class: 'plate-b' }, h('p', { class: 's13-claim' }, '“92% accurate on legal tasks.”'),
          h('div', { class: 'tally s13-tally' }, h('div', {}, tHead, h('span', {}, 'Headline')), h('div', { class: 'out' }, tMeas, h('span', {}, 'Measured here')), h('div', {}, tInt, h('span', {}, '95% interval'))), countLine)),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Five questions for the number'), h('span', { class: 'cap' }, 'Orange = changed')), h('div', { class: 'plate-b' }, qList))),
    cardPlate,
    h('div', { class: 'deck plate s13-deck' },
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, '1 · Whose questions?'), segSet.el),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, '2 · How many?'), h('div', { class: 'grp' }, segN.el, drawBtn)),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, '3 · Seen before?'), h('label', { class: 'switch' }, swClean, h('i'), 'Remove memorized questions')),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, '4 · Who graded?'), segG.el),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, '5 · What hides in the average?'), h('label', { class: 'switch' }, swSort, h('i'), 'Sort by category')),
      h('div', { class: 'grp' }, pickBtn, resetBtn)),
  );
  ctx.hud.append(ui, caption);

  function render() {
    const s = layout(), d = SETS[st.set];
    tMeas.textContent = pc(s.p); tInt.textContent = `${Math.round(s.lo * 100)} to ${Math.round(s.hi * 100)}`;
    countLine.textContent = `${s.k.toLocaleString()} of ${s.n.toLocaleString()} cards passed. The band on the gauge is the range a score from ${s.n.toLocaleString()} questions is consistent with.`;
    fillB.textContent = pc(s.p); fillS.textContent = `${s.k.toLocaleString()} of ${s.n.toLocaleString()} · band ${Math.round(s.lo * 100)} to ${Math.round(s.hi * 100)}`;
    const memAll = cards.filter((c) => c.cls === 'M').length;
    const rows = [
      ['Whose questions?', d.short, d.line, st.set !== 'vendor'],
      ['How many?', `${s.n.toLocaleString()} cards`, `The interval is ${Math.round((s.hi - s.lo) * 100)} points wide.`, s.n < 700],
      ['Seen before?', st.set === 'yours' ? 'None' : st.clean ? `${memAll} removed` : `${s.mem} of ${s.n.toLocaleString()} marked`, st.set === 'yours' ? 'Your own unpublished files were not in the training data.' : st.clean ? 'Only questions the model had not seen are counted.' : 'A marked card was in the training data. The model recalls its answer key.', st.clean],
      ['Who graded?', GRADERS[st.grader].label, GRADERS[st.grader].line, st.grader !== 'lenient'],
      ['What hides in the average?', s.worst ? `${s.worst.name}: ${pc(s.worst.k / s.worst.n)}` : 'Nothing drawn', `${st.sorted ? '' : 'Lowest category shown. Sort to see them all. '}${s.sev} severe ${s.sev === 1 ? 'error counts' : 'errors count'} the same as ${s.fails - s.sev} smaller ones.`, st.sorted],
    ];
    qList.replaceChildren(...rows.map(([q, a, note, on], i) => h('li', { class: on ? 'on' : '' }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'q' }, q), h('span', { class: 'a' }, a), h('span', { class: 'nt' }, note),
      i === 4 && st.sorted ? h('ul', { class: 's13-slices' }, s.cats.map((c) => h('li', { class: s.worst && c.name === s.worst.name ? 'worst' : '' }, h('span', {}, c.name), h('b', {}, c.n ? pc(c.k / c.n) : 'none'), h('i', {}, `${c.k} of ${c.n}${c.sev ? ` · ${c.sev} severe` : ''}`)))) : null)));
    segSet.ins[st.set].checked = true; segN.ins[String(st.n)].checked = true; segG.ins[st.grader].checked = true; swClean.checked = st.clean; swSort.checked = st.sorted;
    swClean.disabled = st.set === 'yours'; swClean.closest('label').classList.toggle('s13-off', st.set === 'yours');
    renderCard();
    return s;
  }
  function renderCard() {
    if (st.sel == null) return;
    const cd = cards[st.sel], ex = EXAMPLE[cd.cls], cat = SETS[st.set].cats[cd.cat].name;
    cardBody.replaceChildren(
      h('div', { class: 's13-kind' }, h('span', { class: 'cap' }, cat), h('span', { class: `cap ${cd.cls === 'S' ? 'verm' : ''}` }, ex.kind)),
      h('dl', { class: 's13-qa' }, h('dt', {}, 'Question'), h('dd', {}, ex.q), h('dt', {}, 'Answer key'), h('dd', {}, ex.key), h('dt', {}, 'The model’s answer'), h('dd', { class: 'ans' }, ex.ans)),
      h('ul', { class: 's13-verdicts' }, Object.entries(GRADERS).map(([k, v]) => { const ok = passes(cd.cls, k); return h('li', { class: `${ok ? 'ok' : 'no'} ${k === st.grader ? 'cur' : ''}` }, h('span', {}, v.label), h('b', {}, ok ? 'Pass' : 'Fail')); })),
      h('p', { class: 's13-note' }, ex.note),
      h('p', { class: 'invented' }, 'One invented example of this kind of card. Every card of this kind shows the same text.'));
  }
  function select(i) { st.sel = i; cardPlate.hidden = i == null; selTag.el.style.display = i == null ? 'none' : ''; layout(); renderCard(); if (i != null) ctx.announce(`${EXAMPLE[cards[i].cls].kind} card. ${EXAMPLE[cards[i].cls].note}`); }
  let pickAt = 0;
  function pickNext(cls) {
    const want = cls ? [cls] : ['S', 'F', 'P', 'H0', 'M', 'W', 'H1', 'E'];
    for (let t = 0; t < want.length; t++) { const c = want[(pickAt + t) % want.length]; const i = st.sample.find((x) => cards[x].cls === c); if (i != null) { if (!cls) pickAt = (pickAt + t + 1) % want.length; select(i); return i; } }
    return null;
  }
  // one place where settings change
  function set(patch, { redraw } = {}) {
    const was = { ...st };
    Object.assign(st, patch);
    if (st.set !== was.set) { cards = buildPopulation(st.set); select(null); if (st.set === 'yours') st.clean = false; markIdx = []; cards.forEach((c, i) => { if (c.cls === 'M') markIdx.push(i); }); markMesh.count = markIdx.length; draw(); layout(); snapCards(true); }
    else if (st.n !== was.n || redraw || (was.clean && !st.clean)) draw();
    else if (st.clean && !was.clean) setSample(st.sample.filter((i) => cards[i].cls !== 'M'));
    return render();
  }
  function user(patch) {
    seq++; const before = stats(), s = set(patch), d = Math.round((s.p - before.p) * 100), moved = d === 0 ? 'The score holds' : `The score ${d < 0 ? 'falls' : 'rises'} ${Math.abs(d)} ${Math.abs(d) === 1 ? 'point' : 'points'}`;
    if ('set' in patch) say(patch.set === 'yours' ? `<b>Same model, your kind of work.</b> ${moved}, to ${pc(s.p)}.` : `<b>The vendor’s own questions.</b> The score reads ${pc(s.p)}.`);
    else if ('n' in patch) say(`<b>${s.n.toLocaleString()} questions.</b> The score reads ${pc(s.p)}, and the range it is consistent with runs from ${pc(s.lo)} to ${pc(s.hi)}.`);
    else if ('clean' in patch) say(patch.clean ? `<b>Memorized questions removed.</b> ${moved}, to ${pc(s.p)} on questions the model had not seen.` : 'Memorized questions are back in the count.');
    else if ('grader' in patch) say(`<b>Same answers, new grader.</b> ${moved}, to ${pc(s.p)}.`);
    else if ('sorted' in patch) say(patch.sorted ? (s.worst ? `<b>The average was ${pc(s.p)}.</b> ${esc(s.worst.name)} sits at ${pc(s.worst.k / s.worst.n)}. Vermilion cards are severe errors.` : '') : 'Back to one field and one average.');
  }
  function baseline() { select(null); set({ set: 'vendor', n: 1000, clean: false, grader: 'lenient', sorted: false }, { redraw: true }); }

  // picking cards in 3D
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  function hit(e) { const r = ctx.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); cardMesh.computeBoundingSphere(); const x = ray.intersectObject(cardMesh)[0]; return x && st.inS[x.instanceId] ? x.instanceId : null; }
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => { if (!down) return; const m = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (m > 6) return; const i = hit(e); if (i != null) select(i); };
  ctx.canvas.addEventListener('pointerdown', onDown); ctx.canvas.addEventListener('pointerup', onUp);

  // ---------- sequences: demos and beats ----------
  const begin = () => { const my = ++seq; return () => alive && my === seq; };
  const pause = async (ok, s) => { await wait(s); return ok(); };
  const demos = {
    yours: async () => {
      const ok = begin(); baseline(); say('The conditions behind the headline. The fill meets the wireframe.');
      if (!(await pause(ok, 1.6))) return;
      const s = set({ set: 'yours' });
      say(`<b>The same model on tasks like yours: ${pc(s.p)}.</b> The 92 described the vendor’s questions. It was never a promise about your documents.`);
    },
    measure: async () => {
      const ok = begin(); baseline(); const out = {};
      say('One model. One fixed set of answers. Watch the number while only the measuring changes.');
      if (!(await pause(ok, 1.4))) return;
      for (const gk of ['exact', 'model', 'lenient']) { const s = set({ grader: gk }); out[gk] = s.p; say(`Grader: <b>${esc(GRADERS[gk].label)}</b>. The score reads ${pc(s.p)}.`); if (!(await pause(ok, 1.5))) return; }
      const s = set({ clean: true });
      say(`<b>${pc(out.exact)}, ${pc(out.model)}, ${pc(out.lenient)}, and ${pc(s.p)} with memorized questions removed.</b> Four scores for one model. A score measures the model, the test set, the grader, and the settings together.`);
    },
    exam: async () => {
      const ok = begin(); set({ set: 'yours', n: 1000, grader: 'lenient', clean: false, sorted: false }, { redraw: true });
      say('Tasks like yours, all in one field.');
      if (!(await pause(ok, 1.3))) return;
      const s = set({ sorted: true }), ex = s.cats[0], w = s.worst;
      say(`<b>Exam-style questions: ${pc(ex.k / ex.n)}. ${esc(w.name)}: ${pc(w.k / w.n)}.</b> An exam samples one narrow kind of task. The job includes the other columns.`);
    },
  };
  const beats = [
    { title: 'A headline number', note: 'The wireframe is the vendor’s claim. The solid fill is what the 1,000 cards in front of it support, and under the vendor’s own conditions they meet.', run: async () => { const ok = begin(); baseline(); say('<b>92%.</b> Vendor’s questions, lenient grader, every card counted.'); await pause(ok, 1.2); } },
    { title: 'Seen before?', note: 'Cards with a dark stamp were in the training data. Remove them and the fill settles lower, on questions the model had not seen.', run: async () => { const ok = begin(); baseline(); if (!(await pause(ok, 0.9))) return; const s = set({ clean: true }); say(`<b>${pc(s.p)}</b> once memorized questions leave the count.`); await pause(ok, 1.2); } },
    { title: 'Who graded?', note: 'The answers stay the same. Exact match fails every right answer that used other words, so the same model reads far lower.', run: async () => { const ok = begin(); set({ set: 'vendor', n: 1000, clean: true, sorted: false, grader: 'lenient' }, { redraw: true }); if (!(await pause(ok, 0.8))) return; const s = set({ grader: 'exact' }); say(`<b>${pc(s.p)}</b> under exact match. Same model, same answers.`); await pause(ok, 1.2); } },
    { title: 'Whose questions?', note: 'Now the same model meets five kinds of work from your own files. The field is replaced and the fill drops away from the wireframe.', run: async () => { const ok = begin(); const s = set({ set: 'yours', n: 1000, grader: 'lenient', sorted: false }, { redraw: true }); say(`<b>${pc(s.p)}</b> on tasks like yours.`); await pause(ok, 1.4); } },
    { title: 'How many?', note: 'Only 20 cards are tested. The band is the 95% interval, and each new draw of 20 lands the score somewhere else inside it.', run: async () => { const ok = begin(); set({ set: 'yours', grader: 'lenient', sorted: false, n: 20 }, { redraw: true }); for (let i = 0; i < 3; i++) { if (!(await pause(ok, 1.0))) return; const s = set({}, { redraw: true }); say(`Draw ${i + 2}: <b>${pc(s.p)}</b>. Interval ${pc(s.lo)} to ${pc(s.hi)}.`); } await pause(ok, 0.8); } },
    { title: 'What hides in the average?', note: 'Sorted by category, one column is mostly dark, and the vermilion cards are invented citations that the average counted the same as a typo.', run: async () => { const ok = begin(); set({ set: 'yours', grader: 'lenient', n: 1000, sorted: false }, { redraw: true }); if (!(await pause(ok, 0.9))) return; const s = set({ sorted: true }); say(`Average <b>${pc(s.p)}</b>. ${esc(s.worst.name)} <b>${pc(s.worst.k / s.worst.n)}</b>. ${s.sev} severe errors.`); await pause(ok, 1.4); } },
  ];

  // ---------- view interface ----------
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), portrait = freeW / freeH < 0.9;
    const sizeX = portrait ? 17.5 : 20, sizeY = portrait ? 14 : 15.6;
    const d = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    const az = portrait ? 0.3 : 0.5, el = portrait ? 0.74 : 0.6;
    home.target.set(0, portrait ? 1.5 : 1.7, portrait ? 0.2 : 0.7);
    home.pos.set(home.target.x + d * Math.sin(az) * Math.cos(el), home.target.y + d * Math.sin(el), home.target.z + d * Math.cos(az) * Math.cos(el));
    scene.fog.near = Math.max(30, d * 1.1); scene.fog.far = Math.max(85, d * 2.8);
    if (!userMoved) { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
    const dk = ui.querySelector('.deck'); if (dk) caption.style.setProperty('--dk', `${Math.round(dk.getBoundingClientRect().height)}px`);
  }
  function update(dt) {
    const r = motion.reduced, kg = r ? 1 : Math.min(1, dt * 5);
    g.fill = lerp(g.fill, g.tFill, kg); g.lo = lerp(g.lo, g.tLo, kg); g.hi = lerp(g.hi, g.tHi, kg);
    fill.scale.y = Math.max(0.004, g.fill * HG); band.position.y = 0.12 + g.lo * HG; band.scale.y = Math.max(0.01, (g.hi - g.lo) * HG);
    if (settle <= 0) return; settle -= dt;
    for (let i = 0; i < N; i++) {
      const o = i * 7, k = r ? 1 : Math.min(1, dt * speed[i]);
      for (let j = 0; j < 7; j++) cur[o + j] += (tgt[o + j] - cur[o + j]) * k;
      dm.position.set(cur[o], cur[o + 1], cur[o + 2]); dm.scale.setScalar(Math.max(0.001, cur[o + 3])); dm.updateMatrix(); cardMesh.setMatrixAt(i, dm.matrix);
      cardMesh.setColorAt(i, tc.setRGB(cur[o + 4], cur[o + 5], cur[o + 6]));
    }
    cardMesh.instanceMatrix.needsUpdate = true; cardMesh.instanceColor.needsUpdate = true;
    markIdx.forEach((i, m) => { const o = i * 7, show = st.inS[i] ? cur[o + 3] : 0.001; dm.position.set(cur[o], cur[o + 1] + 0.02, cur[o + 2]); dm.scale.setScalar(Math.max(0.001, show)); dm.updateMatrix(); markMesh.setMatrixAt(m, dm.matrix); });
    markMesh.instanceMatrix.needsUpdate = true;
  }
  function textAlt() {
    const s = stats(), d = SETS[st.set];
    return `<p>A vendor’s headline score of 92% stands at the back of the table as a tall, empty wireframe column. In front of it lies a field of 1,000 small paper cards. Each card is one test question with a graded answer. A tested card that passed is lit paper. A tested card that failed is dark. A card that was never drawn into the sample lies flat and unlit. Inside the wireframe a solid fill rises only as high as the share of tested cards that passed, and a translucent band around its top shows the 95% Wilson score interval, the range of true rates that a score from that many questions is consistent with.</p>
    <p>Five controls each ask one question of the number. Whose questions: the vendor’s benchmark or tasks like yours. How many: 20, 50, 200, or 1,000 cards, drawn at random. Seen before: remove questions that were in the training data. Who graded: exact match, a lenient rubric, or a second model. What hides in the average: sort the cards into one column per category, with severe errors in vermilion. Each control rearranges the cards and moves the fill. The wireframe never moves.</p>
    <h3>Settings now</h3>
    <table><tr><th>Question</th><th>Answer now</th></tr>
    <tr><td>Whose questions?</td><td>${esc(d.label)}. ${esc(d.line)}</td></tr>
    <tr><td>How many?</td><td>${s.n.toLocaleString()} cards tested</td></tr>
    <tr><td>Seen before?</td><td>${st.set === 'yours' ? 'No card was in the training data' : st.clean ? 'Memorized questions removed' : `${s.mem} of the tested cards were in the training data`}</td></tr>
    <tr><td>Who graded?</td><td>${esc(GRADERS[st.grader].label)}. ${esc(GRADERS[st.grader].line)}</td></tr></table>
    <h3>The number</h3><p>Headline: 92% (invented vendor claim). Measured here: ${pc1(s.p)}, from ${s.k.toLocaleString()} passes in ${s.n.toLocaleString()} cards. 95% Wilson score interval: ${pc1(s.lo)} to ${pc1(s.hi)}.</p>
    <h3>By category</h3>
    <table><tr><th>Category</th><th>Tested</th><th>Passed</th><th>Rate</th><th>Severe errors</th></tr>${s.cats.map((c) => `<tr><td>${esc(c.name)}</td><td>${c.n}</td><td>${c.k}</td><td>${c.n ? pc(c.k / c.n) : 'none drawn'}</td><td>${c.sev}</td></tr>`).join('')}</table>
    <h3>The same answers under each grader</h3>
    <ul>${Object.entries(GRADERS).map(([k, v]) => { const kk = st.sample.filter((i) => passes(cards[i].cls, k)).length; return `<li>${esc(v.label)}: ${s.n ? pc1(kk / s.n) : 'no cards'}. ${esc(v.line)}</li>`; }).join('')}</ul>
    <p>Scripted: the cards and how each grader marks them. The vendor, its claim, and the model are invented. Real: the random draw, the counts, and the interval math.</p>`;
  }

  // start under the conditions behind the headline
  markIdx = []; cards.forEach((c, i) => { if (c.cls === 'M') markIdx.push(i); }); markMesh.count = markIdx.length;
  draw(); render(); snapCards(false); g.fill = g.tFill; g.lo = g.tLo; g.hi = g.tHi; settle = 0.5;
  return {
    scene, camera, controls, update, frame, textAlt, demos, beats,
    insets: () => (ctx.isNarrow() ? {} : { t: 136 }),
    escape: () => { if (st.sel != null) select(null); },
    dispose() { alive = false; seq++; ctx.canvas.removeEventListener('pointerdown', onDown); ctx.canvas.removeEventListener('pointerup', onUp); },
  };
}

export const BRIEF = {
  define: 'A benchmark is a fixed set of test questions with an answer key. Contamination means test questions were in the text the model was trained on. A confidence interval is the range of true rates that a measured score is consistent with.',
  misconceptions: [
    { wrong: '92 percent accurate means right 92 percent of the time on our work.', right: 'The figure describes one model on one set of questions. Change the questions to the kind of work you do and the same model produces a different figure. The only score that describes your work comes from a test on your work.', demo: 'yours', demoLabel: 'Swap in tasks like yours' },
    { wrong: 'A benchmark score measures the model.', right: 'A score is produced by four things together: the model, the test set, the grader, and the settings. Hold the model and its answers fixed, change the grader or remove the questions it had already seen, and the number moves.', demo: 'measure', demoLabel: 'Change only the measuring' },
    { wrong: 'It passed a professional exam, so it can do the professional’s job.', right: 'An exam samples a narrow band of tasks in a clean format. Practice includes long documents, poor scans, other languages, and citations that must exist. A strong score on the exam band says little about the other bands.', demo: 'exam', demoLabel: 'Sort the field by category' },
  ],
  legal: 'A testing claim is a statement about a specific model version, test set, grader, and date, and diligence means asking for each of the four. A figure in marketing material differs from a performance commitment written into a contract, with a defined test and a remedy. An average can hide a category of work that fails and can count a severe error the same as a trivial one, so results by category and by severity matter more than the headline. An organization’s own acceptance test, run on its own documents and repeated when the model version changes (stop 7), is the evidence that fits its use.',
  ask: [
    'What was in the test set, how many questions, and how do you know the model had not seen them in training?',
    'Who or what graded the answers, and which model version and settings were tested, on what date?',
    'Show the results by category and by severity of error, and let us run the same test on our own documents.',
  ],
  say: 'A benchmark score is a measurement of one model on one set of questions by one grader, so it tells us little until we know all three. Before we rely on a number we should run a test on our own documents and read the worst category before the average.',
  checks: [
    { q: 'A vendor reports 90% from a test of 20 questions. What range of true rates is that consistent with?', a: 'A wide one. The 95% Wilson interval for 18 right out of 20 runs from about 70% to about 97%. Twenty questions cannot separate a strong system from a mediocre one.' },
    { q: 'The same answers score 69% under one grader and 92% under another. Which number is the accuracy?', a: 'Neither on its own. Each number reflects a grading rule. Ask what the rule counts as correct, and whether a person checked a sample of the grades.' },
    { q: 'Why does it matter whether the test questions were public before the model was trained?', a: 'A model can reproduce an answer key it saw in training. That is recall of the test, and it inflates the score without showing that the model can handle a new document.' },
  ],
};
