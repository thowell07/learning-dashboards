// Stop 7. Model lifecycle: a timeline you can scrub. Versions arrive, are deprecated, and are retired,
// while one workflow stays tethered to whatever its configuration names.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, paper, glow, emberBead, addEdges, tween, wait, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

// ---- the script: every version, date, event, and test result is invented ----
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (m) => `Year ${1 + Math.floor(m / 12)} · ${MON[m % 12]}`;
const short = (m) => `Y${1 + Math.floor(m / 12)} ${MON[m % 12]}`;
const LAST = 35, GOLIVE = 8;
const VERSIONS = [
  { id: 'K-1', dated: 'k-1-y1-07', cutoff: 1, release: 6, announce: 15, retire: 21 },
  { id: 'K-2', dated: 'k-2-y2-04', cutoff: 10, release: 15, announce: 26, retire: 32 },
  { id: 'K-3', dated: 'k-3-y3-03', cutoff: 22, release: 26, announce: null, retire: null },
];
const ALIAS = [{ m: 6, v: 0 }, { m: 17, v: 1 }, { m: 28, v: 2 }];
const EVENTS = [
  { m: 4, short: 'Wrenfield founded', text: 'Wrenfield Supply is founded.' },
  { m: 13, short: 'Template: 90 days', text: 'The Model Supply Terms template, 2nd edition, moves the standard notice period from 60 days to 90 days.', fact: 90 },
  { m: 19, short: 'Portal opens', text: 'The Harbor filing portal opens.' },
  { m: 29, short: 'Template: 120 days', text: 'The Model Supply Terms template, 3rd edition, moves the notice period to 120 days.', fact: 120 },
];
const factAt = (m) => (m >= 29 ? 120 : m >= 13 ? 90 : 60);
const factSince = (m) => (m >= 29 ? 29 : m >= 13 ? 13 : null);
const QUESTION = 'What notice period does the current Model Supply Terms template set?';
const TESTS = [
  { name: 'Extract a notice period', r: [1, 1, 1] },
  { name: 'Flag auto-renewal clauses', r: [0, 1, 1], why: ['misses one clause', '', ''] },
  { name: 'Summarize in three bullets', r: [1, 0, 1], why: ['', 'writes five bullets', ''] },
  { name: 'Label with our 12 clause types', r: [1, 0, 1], why: ['', 'uses a label outside the list', ''] },
  { name: 'Decline to rate enforceability', r: [1, 1, 0], why: ['', '', 'offers a rating'] },
  { name: 'Write dates as 14 March Year 2', r: [1, 1, 0], why: ['', '', 'switches to numeric dates'] },
];
const passes = (v) => TESTS.filter((t) => t.r[v]).length;
const changed = (a, b) => TESTS.filter((t) => t.r[a] !== t.r[b]).length;
const NOTICES = [
  { m: 6, text: 'K-1 released. K-latest points to K-1.' },
  { m: 15, text: 'K-2 released. K-1 is deprecated and will be retired in Year 2 · Oct.' },
  { m: 17, text: 'K-latest now points to K-2.' },
  { m: 21, text: 'K-1 retired. Calls to K-1 return an error.' },
  { m: 26, text: 'K-3 released. K-2 is deprecated and will be retired in Year 3 · Sep.' },
  { m: 28, text: 'K-latest now points to K-3.' },
  { m: 32, text: 'K-2 retired. Calls to K-2 return an error.' },
];

export const BRIEF = {
  define: 'A version is one fixed set of weights with its own name. Its knowledge cutoff is the date after which it has read nothing. Deprecated means the vendor has announced a retirement date. Retired means calls to that version fail. An alias is a moving name, such as "latest", that the vendor points at a newer version when it chooses.',
  misconceptions: [
    { wrong: 'The model knows what is happening now.', right: 'Each version stopped reading at its cutoff, months before its release, and it stays in use for months or years after. It answers from that frozen picture, with the same confidence, unless the current fact is placed in its context (stops 8 and 9).', demo: 'now', demoLabel: 'Ask about a change after the cutoff' },
    { wrong: 'The model we tested is the model we are using.', right: 'That holds only while the workflow calls the same version. A moving alias lets the vendor swap the model under a workflow on a date the vendor picks, with nothing on your side to record. A pinned version holds still until its retirement date, and then the move is forced.', demo: 'swapped', demoLabel: 'Follow the alias through the swap' },
    { wrong: 'The same product name means the same model.', right: 'A product name or an alias is a label on a moving pointer. Over three years in this model, one name points at three different sets of weights, each with its own cutoff and its own behavior.', demo: 'samename', demoLabel: 'Count the models behind one name' },
  ],
  legal: 'A validation, a risk assessment, or an approval attaches to the version that was tested, so it lapses when the version changes. Sound change management records which version produced each output, reruns the test set after any version change, and treats a vendor swap as a change even when nothing on your side moved. A fixed version also drifts against a changing world, so facts that matter need a current source in the context. Contract terms to look for are notice of deprecation, a minimum support period, the right to pin a version, and notice of material changes. Notice periods and retirement schedules vary by vendor and contract.',
  ask: [
    'Which exact version does this product call today, is that name pinned or a moving alias, and how are we told when it changes?',
    'What is the knowledge cutoff of that version, and which step supplies facts that changed after it?',
    'How much notice do we get before a version is retired, and can we keep a pinned version for a defined period?',
  ],
  say: 'A model is a fixed version with a cutoff date and a retirement date, and the vendor can change which version sits behind a product name. We record the version with every output and rerun our tests when it changes, because an approval covers the version we tested.',
  checks: [
    { q: 'Your workflow calls a moving alias and the vendor repoints it. What appears in your own change log?', a: 'Nothing, unless someone is watching. Your configuration did not change, and the model did. The record of the swap sits in the vendor\'s notices, so a person or a monitor has to read them and log the change.' },
    { q: 'A pinned version passed every test a year ago and has not changed since. What can still have gone wrong?', a: 'The world moved. The version still answers from its cutoff, so a rule, a price, a name, or a template that changed since then is stale in its answers unless the current fact is supplied in the context.' },
    { q: 'The vendor announces that your pinned version will be retired. What work does that create?', a: 'A migration with a deadline the vendor chose. You move to a newer version, rerun the test set, compare the results, fix what changed, and record the new version and the new validation.' },
  ],
};

export function createStop(ctx) {
  const stop = stopByN(7);
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 84, shadow: 13, keyPos: [5, 14, 9] });
  key.target.position.set(0, 0, 0); scene.add(key.target);
  const camera = makeCamera(34);
  const home = { pos: new THREE.Vector3(3, 12, 20), target: new THREE.Vector3(0, 0.7, -0.2) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 5, maxDist: 60, maxPolar: 1.42, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  let alive = true, userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  const V3 = (a, b, c) => new THREE.Vector3(a, b, c), tmp = new THREE.Vector3();

  // ---------- state and its derivation (real date arithmetic over the invented script) ----------
  const st = { today: GOLIVE, mode: 'alias', actions: [], attach: false, playing: false, busy: false, clock: 0 };
  let nowM = GOLIVE;
  const aliasAt = (m) => { let v = 0; for (const a of ALIAS) if (a.m <= m) v = a.v; return v; };
  const stateOf = (v, m) => { const x = VERSIONS[v]; return m < x.release ? 'future' : x.retire != null && m >= x.retire ? 'retired' : x.announce != null && m >= x.announce ? 'deprecated' : 'current'; };
  function derive(m) {
    const acts = st.actions.filter((a) => a.m <= m);
    const mig = acts.filter((a) => a.type === 'migrate').pop();
    const bound = st.mode === 'alias' ? aliasAt(m) : mig ? mig.v : 0;
    const val = acts.filter((a) => a.type === 'validate').pop() || { m: GOLIVE, v: 0 };
    const lastRun = acts.filter((a) => a.type === 'testrun' || a.type === 'validate').pop() || { m: GOLIVE, v: 0 };
    const up = stateOf(bound, m) !== 'retired';
    const newest = VERSIONS.reduce((n, x, i) => (m >= x.release ? i : n), 0);
    return { m, bound, val, ran: lastRun.v === bound ? lastRun : null, up, newest, alias: aliasAt(m), states: VERSIONS.map((_, v) => stateOf(v, m)) };
  }
  let D = derive(st.today);

  // ---------- 3D ----------
  const XS = 0.42, X = (m) => (m - 17.5) * XS;
  const LANE = [1.1, 0.0, -1.1], ZD = 2.85, ZW = -2.95, WY = 2.1, BH = 0.9, BD = 0.8, W = 36 * XS;
  const dock = block(W + 0.9, 0.08, 7.5, { color: 0xd9d1bf }); dock.position.set(0, 0, 0); world.add(dock);
  for (let m = 0; m <= 36; m++) { const yr = m % 12 === 0; const t = block(yr ? 0.035 : 0.012, 0.012, yr ? 7.3 : 6.7, { color: yr ? 0x4a443b : 0xb4ac9a, edges: false, cast: false }); t.position.set(X(m) - XS / 2, 0.08, 0); world.add(t); }
  LANE.forEach((z) => { const s = block(W, 0.014, BD + 0.24, { color: 0xcbc3b0, edges: false, cast: false }); s.position.set(0, 0.08, z); world.add(s); });
  // the months that have not happened yet lie under a dark sheet that today pushes back
  const veil = new THREE.Mesh(barGeo0(), new THREE.MeshBasicMaterial({ color: 0x0c0b0a, transparent: true, opacity: 0.62, depthWrite: false })); veil.position.set(0, 0.1, 0); world.add(veil);
  function barGeo0() { const g = new THREE.BoxGeometry(1, 0.02, 7.52); g.translate(0.5, 0, 0); return g; }
  [0, 1, 2].forEach((y) => ctx.tags.add(h('div', { class: 's7-year' }, `Year ${y + 1}`), V3(X(y * 12) - XS / 2 + 0.12, 0.1, ZD + 1.05)));
  ctx.tags.add(h('div', { class: 's7-year s7-rail' }, 'The world'), V3(X(0) - 0.45, WY, ZW));
  ctx.tags.add(h('div', { class: 's7-year s7-rail' }, 'Models'), V3(X(0) - 0.6, 0.1, LANE[1]));
  ctx.tags.add(h('div', { class: 's7-year s7-rail' }, 'You'), V3(X(0) - 0.6, 0.1, ZD));

  const barGeo = new THREE.BoxGeometry(1, 1, BD); barGeo.translate(0.5, 0.5, 0);
  const COL = { current: new THREE.Color(PAL.paper), deprecated: new THREE.Color(0x9b9486), retired: new THREE.Color(0x4c4741), future: new THREE.Color(PAL.paper) };
  const vers = VERSIONS.map((v, i) => {
    const mat = paper(PAL.paper); const bar = new THREE.Mesh(barGeo, mat); bar.castShadow = bar.receiveShadow = true; addEdges(bar); bar.position.set(X(v.release), 0.08, LANE[i]); bar.visible = false; world.add(bar);
    const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(barGeo), new THREE.LineBasicMaterial({ color: 0xaaa395 })); ghost.position.set(0, 0.08, LANE[i]); ghost.visible = false; world.add(ghost);
    const tick = block(0.06, 0.5, BD, { color: PAL.paperDark }); tick.position.set(X(v.cutoff), 0.08, LANE[i]); tick.visible = false; world.add(tick);
    const lead = new THREE.Mesh(barGeo, paper(0x4c4741)); lead.scale.set((v.release - v.cutoff) * XS, 0.03, 0.1); lead.position.set(X(v.cutoff), 0.085, LANE[i]); lead.visible = false; world.add(lead);
    const el = h('div', { class: 's7-vtag' }, h('b', {}, v.id), h('span', {}, ''));
    const tag = ctx.tags.add(el, () => tmp.set(bar.position.x + 0.15, 0.08 + bar.scale.y + 0.06, LANE[i])); el.style.display = 'none';
    const cel = h('div', { class: 's7-cut' }, 'cutoff'); ctx.tags.add(cel, V3(X(v.cutoff), 0.68, LANE[i])); cel.style.display = 'none';
    return { v, i, bar, mat, ghost, tick, lead, el, cel, hgt: BH, color: COL.current.clone() };
  });
  // the alias: a pennant the vendor moves from one version to the next
  const pennant = new THREE.Group(); world.add(pennant);
  { const pole = block(0.05, 1.0, 0.05, { color: PAL.paperDark, edges: false }); pennant.add(pole); const flag = block(0.6, 0.3, 0.04, { color: PAL.paper }); flag.position.set(0.32, 0.68, 0); pennant.add(flag); }
  const pennEl = h('div', { class: 's7-alias' }, 'K-latest'); ctx.tags.add(pennEl, () => tmp.set(pennant.position.x + 0.34, pennant.position.y + 1.08, pennant.position.z));
  // your workflow: a desk with a light on it, and a tether to the model it calls
  const desk = new THREE.Group(); world.add(desk);
  desk.add(block(1.3, 0.36, 0.84, { color: PAL.paper })); { const scr = block(0.62, 0.46, 0.05, { color: 0xefe8d8 }); scr.position.set(0, 0.36, -0.16); scr.rotation.x = -0.25; desk.add(scr); }
  const deskBead = emberBead(0.14, PAL.ember, 2.0); deskBead.position.y = 1.08; desk.add(deskBead);
  const deskEl = h('div', { class: 's7-desk' }, h('b', {}, 'Your workflow'), h('span', {}, '')); ctx.tags.add(deskEl, () => tmp.set(desk.position.x, 0.2, ZD + 0.75));
  const cylGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 8); cylGeo.translate(0, 0.5, 0);
  const tetherMat = glow(PAL.ember, { transparent: true, opacity: 1 }); const tether = new THREE.Mesh(cylGeo, tetherMat); world.add(tether);
  const bindBead = emberBead(0.08, PAL.ember, 0.9); world.add(bindBead);
  const UP = V3(0, 1, 0), A = V3(0, 0, 0), B = V3(0, 0, 0), dir = V3(0, 0, 0); let tz = LANE[0], tLen = 1;
  // the world rail: one tile per month. Lit tiles are months the bound version has read.
  const tileLit = paper(PAL.paper), tileDark = paper(0x3d3832), tileGeo = new THREE.BoxGeometry(XS * 0.88, 0.09, 1.0);
  const tiles = []; for (let m = 0; m <= LAST; m++) { const t = new THREE.Mesh(tileGeo, tileDark); t.position.set(X(m), WY, ZW); t.castShadow = true; t.visible = false; world.add(t); tiles.push(t); }
  [0, 12, 24, LAST].forEach((m) => { const p = block(0.07, WY, 0.07, { color: 0x4c4741, edges: false }); p.position.set(X(m), 0.08, ZW); world.add(p); });
  const flags = EVENTS.map((e) => {
    const g = new THREE.Group(); g.position.set(X(e.m), WY + 0.035, ZW); g.visible = false; world.add(g);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.8, 0.045), tileDark); pole.position.y = 0.4; g.add(pole);
    const pen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.035), tileDark); pen.position.set(0.22, 0.68, 0); g.add(pen);
    const el = h('div', { class: 's7-ev' }, e.short); ctx.tags.add(el, V3(X(e.m) + 0.05, WY + 0.98, ZW)); el.style.display = 'none';
    return { e, g, pole, pen, el };
  });
  const edge = block(0.04, 0.7, 1.2, { color: PAL.paper, edges: false, cast: false }); world.add(edge); // the edge of what the bound version has read
  const edgeEl = h('div', { class: 's7-edge' }, ''); ctx.tags.add(edgeEl, () => tmp.set(edge.position.x, WY - 0.12, ZW + 0.62));
  const cutLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0, 0, 0), V3(0, 1, 0)]), new THREE.LineDashedMaterial({ color: 0xaaa395, dashSize: 0.1, gapSize: 0.08 })); world.add(cutLine);
  const todayPlane = new THREE.Mesh(new THREE.BoxGeometry(0.03, 3.5, 7.4), new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0.16, depthWrite: false })); todayPlane.position.set(0, 1.83, 0); world.add(todayPlane);
  const todayEl = h('div', { class: 's7-today' }, ''); ctx.tags.add(todayEl, () => tmp.set(todayPlane.position.x, 3.62, ZW));

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption s7-cap', role: 'status' });
  const say = (html) => { caption.innerHTML = html || ''; };
  const wfEl = h('dl', { class: 's7-wf' }), testEl = h('table', { class: 's7-tests' }), noticeEl = h('ol', { class: 's7-log' }), logEl = h('ol', { class: 's7-log mine' });
  const askOut = h('div', { class: 's7-answer', 'aria-live': 'polite' });
  const tOut = h('output', { for: 's7-time' }, ''), tIn = h('input', { type: 'range', id: 's7-time', min: String(GOLIVE), max: String(LAST), step: '1', value: String(GOLIVE), 'aria-describedby': 's7-time-note', oninput: (e) => { stopPlay(); setToday(Number(e.target.value)); } });
  const playBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => (st.playing ? stopPlay() : startPlay()) }, 'Let time run');
  const modeIn = {};
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'How your workflow names the model' }, [['pin', 'Pin a dated version'], ['alias', 'Follow the alias']].map(([k, t]) => { modeIn[k] = h('input', { type: 'radio', name: 's7-mode', value: k, checked: k === st.mode, onchange: () => setMode(k) }); return h('label', {}, modeIn[k], h('span', {}, t)); }));
  const runBtn = h('button', { class: 'btn', type: 'button', onclick: () => runTests() }, 'Run my test set');
  const valBtn = h('button', { class: 'btn', type: 'button', onclick: () => revalidate() }, 'Revalidate');
  const migBtn = h('button', { class: 'btn', type: 'button', onclick: () => migrate() }, 'Move the pin');
  const attachSw = h('input', { type: 'checkbox', onchange: (e) => { st.attach = e.target.checked; render(); } });
  const floatTR = h('div', { class: 'float-tr s7-tr' }, h('div', { class: 'plate' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Ask about the world'), h('span', { class: 'cap' }, 'Scripted')),
    h('div', { class: 'plate-b' }, h('p', { class: 's7-q' }, QUESTION), h('label', { class: 'switch' }, attachSw, h('i'), 'Attach the current template'), askOut)));
  const floatBR = h('div', { class: 'float-br s7-br' }, h('div', { class: 'plate' }, h('div', { class: 's7-logs' },
    h('div', {}, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Vendor notices'), h('span', { class: 'cap' }, 'Published by them')), noticeEl),
    h('div', {}, h('div', { class: 'plate-h' }, h('span', { class: 'cap ember' }, 'Your change log'), h('span', { class: 'cap' }, 'Written by you')), logEl))));
  const ui = h('section', { class: 'stop', 'aria-label': 'Stop 7, Model lifecycle' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 07 · The loading dock of the foundry'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' }, h('span', {}, h('b', {}, 'Scripted'), 'Every version, date, event, and test result. All invented.'), h('span', {}, h('b', {}, 'Real'), 'The date arithmetic, the pin and alias logic, your scrubbing.'), h('span', {}, h('b', {}, 'Simplified'), 'One vendor, one model line. Notice periods vary by vendor and contract.')),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap ember' }, 'Your workflow'), h('span', { class: 'cap' }, 'Invented')), h('div', { class: 'plate-b' }, wfEl)),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Your test set · 6 prompts'), h('span', { class: 'cap' }, 'Scripted results')), h('div', { class: 'plate-b' }, testEl))),
    floatTR, floatBR,
    h('div', { class: 'deck plate' },
      h('div', { class: 'slider s7-time' }, h('label', { for: 's7-time' }, 'Today'), tOut, tIn),
      h('div', { class: 'grp' }, playBtn),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'Your configuration names'), seg),
      h('div', { class: 'grp' }, runBtn, valBtn, migBtn)),
  );
  ui.append(h('p', { class: 'sr', id: 's7-time-note' }, 'Moves today along the three-year timeline, one month per step.'));
  ctx.hud.append(ui, caption);

  const res = (ok, why) => h('span', { class: ok ? 'ok' : 'no', title: why || '' }, ok ? 'pass' : 'fail');
  function render() {
    const d = D, b = VERSIONS[d.bound], called = st.mode === 'alias' ? 'k-latest' : b.dated;
    tOut.textContent = label(st.today); tIn.value = String(st.today); todayEl.textContent = `Today · ${short(st.today)}`;
    const dark = st.today - b.cutoff, covered = d.val.v === d.bound;
    wfEl.replaceChildren(
      h('dt', {}, 'It calls'), h('dd', {}, h('code', {}, called), st.mode === 'alias' ? `, a name the vendor points at ${b.id} today` : ', a dated name that never moves'),
      h('dt', {}, 'Status'), h('dd', { class: d.up ? '' : 'bad' }, d.up ? `Running on ${b.id}${d.states[d.bound] === 'deprecated' ? `. ${b.id} retires in ${label(b.retire)}, ${b.retire - st.today} months from today` : ''}` : `Down since ${label(b.retire)}. ${b.id} is retired and every call fails`),
      h('dt', {}, 'Validation'), h('dd', { class: covered ? '' : 'bad' }, `Validated on ${VERSIONS[d.val.v].id} in ${label(d.val.m)}. `, covered ? 'It covers the version you call.' : `It covers ${VERSIONS[d.val.v].id}. You call ${b.id}.`),
      h('dt', {}, 'Knowledge'), h('dd', {}, `${b.id} read nothing after ${label(b.cutoff)}. ${dark} ${dark === 1 ? 'month is' : 'months are'} dark to it.`));
    testEl.replaceChildren(h('tr', {}, h('th', {}, 'Prompt'), h('th', {}, `Validated · ${VERSIONS[d.val.v].id}`), h('th', {}, `Now · ${b.id}`)),
      ...TESTS.map((t) => { const diff = d.ran && t.r[d.val.v] !== t.r[d.bound]; return h('tr', { class: diff ? 'diff' : '' }, h('td', {}, t.name), h('td', {}, res(t.r[d.val.v], t.why && t.why[d.val.v])), h('td', {}, !d.up ? h('span', { class: 'no' }, 'error') : d.ran ? [res(t.r[d.bound], t.why && t.why[d.bound]), !t.r[d.bound] && t.why ? h('i', {}, t.why[d.bound]) : null] : h('span', { class: 'unk' }, '?'))); }),
      h('tr', { class: 'sum' }, h('td', {}, d.up && !d.ran ? `Not rerun since the model changed to ${b.id}.` : ''), h('td', {}, `${passes(d.val.v)} of 6`), h('td', {}, !d.up ? '0 of 6' : d.ran ? `${passes(d.bound)} of 6` : '?')));
    noticeEl.replaceChildren(...NOTICES.filter((n) => n.m <= st.today).map((n) => h('li', {}, h('span', { class: 'when' }, short(n.m)), h('span', {}, n.text))));
    const mine = [{ m: GOLIVE, text: `Went live calling ${st.mode === 'alias' ? 'k-latest' : VERSIONS[0].dated}. Validated on K-1: ${passes(0)} of 6 tests pass.` }];
    if (st.mode === 'alias') ALIAS.slice(1).filter((a) => a.m <= st.today).forEach((a) => mine.push({ m: a.m, ghost: true, text: 'No entry. Your configuration did not change.' }));
    st.actions.filter((a) => a.m <= st.today).forEach((a) => mine.push({ m: a.m, text: a.text }));
    mine.sort((p, q) => p.m - q.m);
    logEl.replaceChildren(...mine.map((n) => h('li', { class: n.ghost ? 'ghost' : '' }, h('span', { class: 'when' }, short(n.m)), h('span', {}, n.text))));
    noticeEl.scrollTop = noticeEl.scrollHeight; logEl.scrollTop = logEl.scrollHeight;
    const known = factAt(b.cutoff), truth = factAt(st.today), stale = known !== truth;
    askOut.replaceChildren(...[!d.up ? h('p', { class: 'ans no' }, 'Error. The version is retired.')
      : st.attach ? h('p', { class: 'ans' }, h('span', { class: 'blue' }, '[template attached] '), `The template sets a notice period of ${truth} days.`)
      : h('p', { class: 'ans' }, `The template sets a notice period of ${known} days.`),
    !d.up ? null : h('p', { class: `verdict2 ${!st.attach && stale ? 'bad' : ''}` }, st.attach ? 'Correct today. The fact came from the context, and the weights did not change.' : stale ? `Stale. True as of ${b.id}’s cutoff, ${label(b.cutoff)}. The template changed in ${label(factSince(st.today))}. The answer reads as confident as a correct one.` : `Correct today. Nothing about this fact has changed since ${b.id}’s cutoff.`)].filter(Boolean));
    runBtn.disabled = !d.up; valBtn.disabled = !d.up || (covered && !!d.ran); migBtn.hidden = st.mode !== 'pin'; migBtn.disabled = d.bound === d.newest;
    migBtn.textContent = `Move the pin to ${VERSIONS[d.newest].id}`;
    deskEl.querySelector('span').textContent = d.up ? `calls ${called}` : 'down';
    deskEl.classList.toggle('down', !d.up);
    pennEl.textContent = 'K-latest';
    edgeEl.textContent = `${b.id} has read nothing past here`;
    vers.forEach((o) => { const s = d.states[o.i]; o.el.querySelector('span').textContent = s === 'current' ? 'current' : s === 'deprecated' ? `deprecated · retires ${short(o.v.retire)}` : s === 'retired' ? `retired ${short(o.v.retire)}` : ''; o.el.classList.toggle('bound', o.i === d.bound); });
    playBtn.textContent = st.playing ? 'Pause' : st.today >= LAST ? 'Back to the start' : 'Let time run';
  }

  // ---------- actions ----------
  function setToday(m, { quiet = false } = {}) {
    m = Math.max(GOLIVE, Math.min(LAST, m)); const from = st.today, prev = D;
    if (m < from) st.actions = st.actions.filter((a) => a.m <= m);
    st.today = m; D = derive(m); render();
    if (quiet) return null;
    let note = null;
    if (m > from) {
      const b = VERSIONS[D.bound], pb = VERSIONS[prev.bound];
      const ev = EVENTS.filter((e) => e.fact && e.m > from && e.m <= m && b.cutoff < e.m).pop();
      if (prev.up && !D.up) note = `<b>${label(b.retire)}. ${b.id} is retired.</b> Calls to your pinned version fail. The vendor announced this date ${b.retire - b.announce} months ahead, and the vendor chose it.`;
      else if (D.bound !== prev.bound) note = `<b>${label(ALIAS.find((a) => a.v === D.bound).m)}. The vendor pointed K-latest at ${b.id}.</b> Your workflow now runs on a different model. Nothing on your side changed, so your change log has no entry.`;
      else if (D.up && pb.announce != null && pb.announce > from && pb.announce <= m) note = `<b>${label(pb.announce)}. The vendor announced that ${pb.id} will be retired in ${label(pb.retire)}.</b> ${st.mode === 'pin' ? 'Your pin holds until that date.' : 'K-latest still points at it for now.'}`;
      else if (D.up && ev) note = `<b>${label(ev.m)}. The model did not change. The world did.</b> The template now says ${ev.fact} days, and ${b.id} still answers ${factAt(b.cutoff)}.`;
      if (note) { say(note); ctx.announce(caption.textContent); }
    } else if (m < from) say('');
    return note;
  }
  function startPlay() { if (st.busy) return; if (st.today >= LAST) setToday(GOLIVE); st.playing = true; st.clock = 0; render(); }
  function stopPlay() { if (!st.playing) return; st.playing = false; render(); }
  function setMode(k, quiet) {
    stopPlay(); st.mode = k; modeIn[k].checked = true; st.actions = []; D = derive(st.today); render();
    if (!quiet) say(k === 'pin' ? '<b>Pinned.</b> Your configuration names K-1 by its dated name. That name never moves. Scrub forward and watch what the vendor does to K-1.' : '<b>Following the alias.</b> Your configuration says K-latest. The vendor decides which model that name means, and when.');
  }
  function act(a) { st.actions = st.actions.filter((x) => !(x.m === a.m && x.type === a.type)); st.actions.push(a); D = derive(st.today); render(); }
  function runTests() {
    if (!D.up) return; stopPlay(); const b = D.bound, n = changed(D.val.v, b);
    act({ m: st.today, type: 'testrun', v: b, text: `Ran the test set on ${VERSIONS[b].id}: ${passes(b)} of 6 pass, ${n} ${n === 1 ? 'result' : 'results'} changed.` });
    say(n ? `<b>Same six prompts. ${n} results changed.</b> ${VERSIONS[b].id} fixed some answers and broke others that ${VERSIONS[D.val.v].id} got right.` : `<b>Same six prompts, same six results.</b> You are still on ${VERSIONS[b].id}, the version you validated.`);
    ctx.announce(caption.textContent);
  }
  function revalidate() {
    if (!D.up) return; stopPlay(); const b = D.bound;
    act({ m: st.today, type: 'validate', v: b, text: `Revalidated on ${VERSIONS[b].id}: ${passes(b)} of 6 pass. Baseline reset.` });
    say(`<b>Revalidated on ${VERSIONS[b].id}.</b> The validation covers the version you call again, until the next change.`);
  }
  function migrate() {
    stopPlay(); const v = D.newest; if (st.mode !== 'pin' || v === D.bound) return;
    act({ m: st.today, type: 'migrate', v, text: `Moved the pin from ${VERSIONS[D.bound].dated} to ${VERSIONS[v].dated}.` });
    say(`<b>You moved the pin to ${VERSIONS[v].id}.</b> This change is yours, so it is in your log. The test set has not been rerun on ${VERSIONS[v].id} yet.`);
  }
  async function runTo(m, per = 0.3) { // scrub month by month so the swap is seen on the day it happens
    stopPlay(); let note = null;
    while (alive && st.today !== m) { const n = setToday(st.today + (m > st.today ? 1 : -1)); if (n) note = n; await wait(per); }
    return note;
  }
  async function guard(fn) { if (st.busy) return; st.busy = true; stopPlay(); try { await fn(); } finally { st.busy = false; } }
  const scenario = (mode, m) => { setMode(mode, true); if (st.attach) { st.attach = false; attachSw.checked = false; } setToday(m, { quiet: true }); say(''); userMoved = false; };

  const demos = {
    now: () => guard(async () => {
      scenario('pin', GOLIVE); await runTo(14, 0.22); if (!alive) return;
      const b = VERSIONS[D.bound];
      say(`<b>${b.id} has read nothing after ${label(b.cutoff)}. Today is ${label(st.today)}.</b> ${st.today - b.cutoff} months are dark to it, and it still answers “${factAt(b.cutoff)} days” in the same confident voice.`);
    }),
    swapped: () => guard(async () => {
      scenario('alias', GOLIVE); await runTo(17, 0.3); if (!alive) return; await wait(1.4); if (!alive) return; runTests();
    }),
    samename: () => guard(async () => {
      scenario('alias', GOLIVE); await runTo(30, 0.16); if (!alive) return;
      say('<b>One name, three models.</b> K-latest meant K-1, then K-2, then K-3. Each has its own cutoff and its own behavior, and your configuration never changed.');
    }),
  };
  const beats = [
    { title: 'Your workflow goes live', note: 'It is Year 1, September. Your workflow calls the vendor’s model K-1, and you validated it: five of six test prompts pass. The lit desk is you. The tether is the call.', run: () => guard(async () => { scenario('alias', GOLIVE); say('<b>Go-live.</b> Validated on K-1. The future of the rail is still dark.'); }) },
    { title: 'Follow the alias: the silent swap', note: 'Your configuration says K-latest. Watch the pennant. On the day the vendor moves it, your tether jumps to a different model, and your change log stays empty.', run: () => guard(async () => { scenario('alias', GOLIVE); await runTo(17, 0.32); }) },
    { title: 'Same prompts, different results', note: 'Rerun the six prompts you validated. K-2 fixes one answer and breaks two that K-1 got right. A newer model is a different model.', run: () => guard(async () => { if (st.mode !== 'alias' || st.today !== 17) { scenario('alias', GOLIVE); await runTo(17, 0.12); } if (!alive) return; await wait(0.5); runTests(); }) },
    { title: 'Pin the version: the forced move', note: 'Now your configuration names K-1 by its dated name. Nothing moves under you, until the retirement date arrives. Then every call fails on a date the vendor chose.', run: () => guard(async () => { scenario('pin', GOLIVE); await runTo(21, 0.26); }) },
    { title: 'The cutoff: what it never read', note: 'The upper rail is the world. Lit months are the ones this version has read. A template changes after the cutoff, and the model keeps giving the old answer with full confidence.', run: () => guard(async () => { scenario('pin', GOLIVE); await runTo(14, 0.24); if (!alive) return; const b = VERSIONS[D.bound]; say(`<b>${st.today - b.cutoff} months are dark to ${b.id}.</b> It answers “${factAt(b.cutoff)} days”. The template says ${factAt(st.today)}.`); }) },
    { title: 'Supply the fact in the context', note: 'Attach the current template and the same frozen model answers correctly. The weights did not change. The context did, which is the job of stops 8 and 9.', run: () => guard(async () => { if (st.mode !== 'pin' || st.today !== 14) { scenario('pin', GOLIVE); await runTo(14, 0.1); } if (!alive) return; st.attach = true; attachSw.checked = true; render(); say('<b>Same model, current fact.</b> The answer is right because the template is in the context.'); }) },
    { title: 'An approval covers one version', note: 'Three years on, one name has meant three models. The validation from Year 1 covers K-1, and K-1 is gone. Record the version with every output, and revalidate on every change.', run: () => guard(async () => { scenario('alias', GOLIVE); await runTo(LAST, 0.11); if (!alive) return; say('<b>Validated on K-1. Running on K-3.</b> Two swaps, and no entry in your own log.'); }) },
  ];

  // ---------- view interface ----------
  let baseD = 22, az = 0.16, el = 0.6, narrow = false, follow = false;
  const guiding = () => document.body.classList.contains('guide-on');
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360); narrow = ctx.isNarrow(); follow = narrow || guiding();
    const sizeX = narrow ? 10.5 : follow ? 13.5 : 17.6, sizeY = narrow ? 10.8 : 9.0;
    baseD = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    az = follow ? 0.24 : 0.2; el = narrow ? 0.64 : 0.56;
    scene.fog.near = Math.min(70, Math.max(30, baseD * 0.95)); scene.fog.far = Math.min(88, Math.max(84, baseD * 2.8));
    if (!userMoved) place(1);
  }
  const wantT = V3(0, 0, 0), wantP = V3(0, 0, 0);
  function place(k) { // on a narrow screen, and during the guide, the camera rides along with today
    wantT.set(follow ? Math.max(X(0) + 2, Math.min(X(LAST) - 2, X(nowM) + (narrow ? -0.3 : 0.4))) : 0, narrow ? 1.5 : 1.1, 0);
    wantP.set(wantT.x + baseD * Math.sin(az) * Math.cos(el), wantT.y + baseD * Math.sin(el), wantT.z + baseD * Math.cos(az) * Math.cos(el));
    camera.position.lerp(wantP, k); controls.target.lerp(wantT, k);
  }
  function update(dt, t) {
    if (st.playing) { st.clock += dt; if (st.clock > 0.55) { st.clock = 0; if (st.today >= LAST) stopPlay(); else if (setToday(st.today + 1)) stopPlay(); } }
    const k = motion.reduced ? 1 : Math.min(1, dt * 7);
    nowM = Math.abs(st.today - nowM) < 0.004 ? st.today : lerp(nowM, st.today, k);
    if (!userMoved) place(motion.reduced ? 1 : Math.min(1, dt * 3));
    const d = D, xNow = X(nowM);
    for (const o of vers) {
      const v = o.v, shown = nowM >= v.release - 0.02, s = d.states[o.i];
      o.bar.visible = shown; o.tick.visible = shown; o.lead.visible = shown; o.el.style.display = shown ? '' : 'none'; o.cel.style.display = shown && o.i === d.bound ? '' : 'none';
      if (!shown) { o.ghost.visible = false; continue; }
      const end = v.retire != null ? Math.min(nowM, v.retire) : nowM;
      o.bar.scale.x = Math.max(0.24, (end - v.release) * XS);
      o.bar.scale.y = lerp(o.bar.scale.y, s === 'retired' ? 0.14 : BH, k); o.mat.color.lerp(COL[s], k);
      o.ghost.visible = s === 'deprecated' && v.retire - nowM > 0.05;
      if (o.ghost.visible) { o.ghost.position.x = xNow; o.ghost.scale.set((v.retire - nowM) * XS, BH, 1); }
    }
    const top = (i) => 0.08 + vers[i].bar.scale.y;
    pennant.visible = nowM >= ALIAS[0].m; pennant.position.set(xNow - 0.14, top(d.alias), lerp(pennant.position.z, LANE[d.alias], k));
    desk.position.set(xNow, 0.08, ZD);
    const live = d.up; tz = lerp(tz, LANE[d.bound], k); tLen = lerp(tLen, live ? 1 : 0.34, k);
    A.set(xNow, 1.16, ZD); B.set(xNow - 0.12, top(d.bound) + (st.mode === 'alias' ? 0.84 : 0.03), tz);
    dir.subVectors(B, A); const len = dir.length(); dir.normalize();
    tether.position.copy(A); tether.quaternion.setFromUnitVectors(UP, dir); tether.scale.set(1, len * tLen, 1);
    tetherMat.color.set(live ? PAL.ember : 0x6b655a); bindBead.visible = live; bindBead.position.copy(B);
    deskBead.userData.halo.material.opacity = live ? (motion.reduced ? 0.9 : 0.78 + Math.sin(t * 2) * 0.16) : 0.08; deskBead.children[0].material.color.set(live ? PAL.ember : 0x6b655a);
    const cut = VERSIONS[d.bound].cutoff;
    tiles.forEach((tile, m) => { tile.visible = m <= nowM + 0.25; tile.material = m <= cut ? tileLit : tileDark; });
    flags.forEach((f) => { const on = f.e.m <= nowM + 0.25; f.g.visible = on; f.el.style.display = on ? '' : 'none'; const lit = f.e.m <= cut; f.pole.material = f.pen.material = lit ? tileLit : tileDark; f.el.classList.toggle('dark', !lit); });
    edge.position.set(lerp(edge.position.x, X(cut) + XS / 2, k), WY + 0.045, ZW);
    const p = cutLine.geometry.attributes.position; p.setXYZ(0, X(cut), 0.58, LANE[d.bound]); p.setXYZ(1, edge.position.x, WY, ZW); p.needsUpdate = true; cutLine.computeLineDistances();
    todayPlane.position.x = xNow;
    veil.position.x = xNow; veil.scale.x = Math.max(0.001, X(36) - XS / 2 + 0.45 - xNow);
  }
  function textAlt() {
    const d = D, b = VERSIONS[d.bound];
    return `<p>The model is a timeline of three invented years laid out as a long rail, with today as a thin upright plane you can move. The vendor's model versions are paper bars on three lanes. A bar appears at its release month and grows as time passes. It turns grey when the vendor announces a retirement date, and it collapses flat and dark on the day it is retired. A small pennant marked K-latest is the vendor's alias. It stands on whichever version the vendor currently points that name at.</p>
    <p>Your workflow is a desk with a light on it, standing at today. A glowing tether runs from the desk to the model it calls. If your configuration follows the alias, the tether jumps to a new bar on the day the vendor moves the pennant, with no action from you. If your configuration pins a dated version, the tether holds until that version is retired, and then it goes dark and every call fails.</p>
    <p>A second rail above is the world, one tile per month, with invented events as flags. Tiles up to the knowledge cutoff of the version you call are lit. Every later tile is dark: that version has read nothing from those months.</p>
    <h3>Today: ${esc(label(st.today))}</h3>
    <p>Configuration: ${st.mode === 'alias' ? 'follows the alias K-latest' : 'pins a dated version'}. It calls ${esc(b.id)}. ${d.up ? 'Running.' : `Down since ${esc(label(b.retire))}.`} Validated on ${esc(VERSIONS[d.val.v].id)} in ${esc(label(d.val.m))}. ${esc(b.id)} read nothing after ${esc(label(b.cutoff))}, so ${st.today - b.cutoff} months are dark to it.</p>
    <h3>The versions (invented)</h3><table><tr><th>Version</th><th>Knowledge cutoff</th><th>Released</th><th>Retirement announced</th><th>Retired</th><th>State today</th></tr>${VERSIONS.map((v, i) => `<tr><td>${v.id}</td><td>${esc(label(v.cutoff))}</td><td>${esc(label(v.release))}</td><td>${v.announce != null ? esc(label(v.announce)) : 'none yet'}</td><td>${v.retire != null ? esc(label(v.retire)) : 'none yet'}</td><td>${d.states[i] === 'future' ? 'not released yet' : d.states[i]}</td></tr>`).join('')}</table>
    <p>The alias K-latest points at K-1 from ${esc(label(6))}, at K-2 from ${esc(label(17))}, and at K-3 from ${esc(label(28))}.</p>
    <h3>Your test set (scripted results)</h3><table><tr><th>Prompt</th><th>K-1</th><th>K-2</th><th>K-3</th></tr>${TESTS.map((t) => `<tr><td>${esc(t.name)}</td>${t.r.map((r, i) => `<td>${r ? 'pass' : `fail: ${esc(t.why[i])}`}</td>`).join('')}</tr>`).join('')}</table>
    <h3>The world (invented events)</h3><ol>${EVENTS.map((e) => `<li>${esc(label(e.m))}: ${esc(e.text)}</li>`).join('')}</ol>
    <p>Question: ${esc(QUESTION)} Asked today with nothing attached, ${esc(b.id)} answers ${d.up ? `${factAt(b.cutoff)} days. The template today says ${factAt(st.today)} days.` : 'with an error, because it is retired.'} With the current template attached to the context, a running version answers ${factAt(st.today)} days.</p>
    <h3>Vendor notices so far</h3><ol>${NOTICES.filter((n) => n.m <= st.today).map((n) => `<li>${esc(short(n.m))}: ${esc(n.text)}</li>`).join('')}</ol>
    <h3>Your change log so far</h3><ol>${[...logEl.children].map((li) => `<li>${esc(li.textContent)}</li>`).join('')}</ol>
    <p>Scripted: every version, date, event, and test result. Real: the date arithmetic and the pin and alias logic. Notice periods and retirement schedules vary by vendor and contract.</p>`;
  }
  render(); vers.forEach((o) => { o.bar.scale.y = BH; });
  return {
    scene, camera, controls, update, frame, textAlt, demos, beats,
    insets: () => (ctx.isNarrow() ? {} : guiding() ? { b: ui.querySelector('.deck').offsetHeight + 34 } : { t: 96, b: ui.querySelector('.deck').offsetHeight + floatBR.offsetHeight + 30 }),
    dispose() { alive = false; st.playing = false; },
  };
}
