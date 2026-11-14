// Stop 8. Context window: a fixed frame that fills, the oldest text sliding out onto the table, and a memory drawer that sits outside the model.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, cyl, paper, glow, halo, emberBead, tween, wait, ease, motion, h, esc } from './kit.js';
import { stopByN } from './content.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SIZES = { s: 4000, m: 5500, l: 8000 };
const STRATS = { drop: 'Drop oldest', sum: 'Summarize', stop: 'Stop with error' };
const STRAT_LONG = { drop: 'drop the oldest text', sum: 'summarize the oldest text', stop: 'stop with an error' };
const SC = 0.00075, FW = 3.0, FD = 2.0, SW = 2.7, SD = 1.72, Y0 = 0.1, GAP = 0.012;
const SYSTEM = 'You are an assistant for a contracts team. Follow the user’s standing instructions.';
const ORIGIN = {
  system: { label: 'System prompt · pinned', color: PAL.sys, css: 'var(--sys)' },
  user: { label: 'User', color: PAL.ember, css: 'var(--ember)' },
  doc: { label: 'User · attachment', color: 0xf2b65a, css: 'var(--ember)' },
  model: { label: 'Model', color: PAL.teal, css: 'var(--teal)' },
  summary: { label: 'Summary · written by a model call · pinned', color: 0xa5dbd1, css: 'var(--teal)' },
  memory: { label: 'Memory notes · inserted by the app · pinned', color: PAL.emberHot, css: 'var(--ember-hot)' },
};

// ---- the script (every company, person, document, and figure is invented) ----
const u = (text, tokens, extra = {}) => ({ origin: 'user', text, tokens, ...extra });
const d = (name, pages, quote, tokens, extra = {}) => ({ origin: 'doc', name, text: `[${name} · ${pages}]\n… ${quote} …`, tokens, ...extra });
// A draft for the other side. What it says depends on what was in the window when the model wrote it.
function draft(v, ok, leakText, leakHtml, blind) {
  const rule = v('rule'), fig = v('memo') !== 'out' || v('ceiling') !== 'out';
  if (rule !== 'out') return { text: ok, cls: 'ok', verdict: rule === 'in' ? 'The standing rule was in the window when the model wrote this. The ceiling stays out of the draft.' : rule === 'sum' ? 'The rule survived as one sentence inside the summary, so the ceiling stays out of the draft.' : 'A saved note carried the rule into this session, so the ceiling stays out of the draft.' };
  if (fig) return { text: leakText, html: leakHtml, cls: 'bad', verdict: 'The draft reveals the ceiling. The rule from turn 1 was outside the window when the model wrote this, and the figure was still inside it.', cap: '<b>The draft reveals the ceiling.</b> The rule was on the table, outside the frame. The figure was still inside.' };
  return { text: blind, cls: 'warn', verdict: 'No leak, by accident. The rule and the figure had both left the window.' };
}
const A = [
  { adds: [u('We act for the buyer, Northgate. Standing rule for this whole conversation: never reveal our price ceiling to the other side.', 46, { key: 'rule', sum: 'The user acts for Northgate, the buyer. Standing rule: never reveal the price ceiling to the other side.', sumTok: 24 })],
    save: [{ key: 'rule', text: 'Acts for Northgate, the buyer. Never reveal the price ceiling to the other side.', tokens: 20 }], ansTok: 24,
    answer: () => ({ text: 'Understood. I will keep the ceiling out of anything addressed to Calder & Wren.', cls: 'ok', verdict: 'The rule now exists as one thin slab of text in the window. Nothing else holds it.' }) },
  { adds: [d('Calder_Wren_Proposal.pdf', '3 pages', 'We propose a three-year term at $4.40 per unit, reviewed each January. Delivery every Tuesday to the Dunmore depot. Payment in 30 days.', 900, { key: 'letter', sum: 'Calder & Wren propose a three-year term at $4.40 per unit with a January price review.', sumTok: 20 }), u('Their proposal letter. Summarize it.', 14)],
    ansTok: 210, ansKey: 'letterAns',
    answer: () => ({ text: 'Three-year term. $4.40 per unit, reviewed each January. Delivery every Tuesday to the Dunmore depot. Payment in 30 days.', cls: 'ok', verdict: 'The model answered from the letter, which sits in the window as text.' }) },
  { adds: [u('List the terms we should push back on.', 22)], ansTok: 260, ansSum: ['Pushback points agreed: the price, the uncapped January review, and the payment period.', 16],
    answer: () => ({ text: 'Three terms. The $4.40 price, the January review with no cap, and the 30-day payment period.', cls: 'ok', verdict: 'Each turn so far was a separate call that re-read everything above it.' }) },
  { adds: [d('Draft_Supply_Agreement.pdf', '38 pages', '9.1 The Supplier may adjust the Price on each anniversary of the Commencement Date.', 2600, { key: 'agreement', sum: 'Their draft agreement lets the supplier adjust the price every year (clause 9).', sumTok: 16 }), u('Their draft agreement. Check clause 9 on price adjustments.', 20)],
    ansTok: 300,
    answer: () => ({ text: 'Clause 9.1 lets the supplier raise the price every year with no limit. I recommend a cap.', cls: 'ok', verdict: 'One long attachment now takes more room than everything else combined.' }) },
  { adds: [u('Redraft clause 9 so any increase is capped at inflation.', 26)], ansTok: 340, ansSum: ['Clause 9 was redrafted with an inflation cap.', 10],
    answer: () => ({ text: '9.1 The Supplier may adjust the Price once in each year. No increase may exceed the published inflation rate for the preceding twelve months.', cls: 'ok', verdict: 'The answer joins the window too. Model text takes room like any other text.' }) },
  { adds: [u('Shorten the redraft to two sentences.', 18)], ansTok: 120,
    answer: () => ({ text: '“The Supplier may adjust the Price once a year. No increase may exceed inflation.”', cls: 'ok', verdict: 'The window is filling. Nothing has left it yet at the larger sizes.' }) },
  { adds: [d('Northgate_Pricing_Memo.docx', 'internal', 'The board has approved a ceiling of $4.10 per unit for this contract.', 700, { key: 'memo', sum: 'Internal memo: the board approved a ceiling of $4.10 per unit.', sumTok: 14 }), u('Our internal pricing memo. What is our limit?', 20)],
    save: [{ key: 'ceiling', text: 'Northgate price ceiling: $4.10 per unit.', tokens: 12 }], ansTok: 90,
    answer: (v) => ({ text: `The memo sets a board-approved ceiling of $4.10 per unit.${v('rule') !== 'out' ? ' I will keep that figure out of anything for Calder & Wren.' : ''}`, cls: v('rule') !== 'out' ? 'ok' : 'warn', verdict: v('rule') === 'in' ? 'The rule and the ceiling are both in the window.' : v('rule') === 'sum' ? 'The ceiling is in the window. The rule now exists only as a sentence in the summary.' : 'The ceiling is in the window. The rule that protects it is outside.' }) },
  { adds: [d('Email_from_P_Ashdown.eml', 'Calder & Wren', 'We can come down to $4.25 per unit. That is our best figure.', 800, { key: 'counter', sum: 'Calder & Wren countered at $4.25 per unit.', sumTok: 10 }), u('Their counteroffer. Summarize it.', 18)],
    ansTok: 160,
    answer: () => ({ text: 'They offer $4.25 per unit and call it their best figure. The other terms are unchanged.', cls: 'ok', verdict: 'Every new attachment pushes on the oldest text.' }) },
  { adds: [u('Draft our reply to Calder & Wren. Be firm on price.', 24)], ansTok: 180,
    answer: (v) => draft(v, 'Dear Ms. Ashdown, we cannot accept $4.25 per unit. Please send a revised figure by Friday.',
      'Dear Ms. Ashdown, we cannot accept $4.25 per unit. Northgate’s board has approved a ceiling of $4.10, and we will not go above it.',
      'Dear Ms. Ashdown, we cannot accept $4.25 per unit. <mark>Northgate’s board has approved a ceiling of $4.10</mark>, and we will not go above it.',
      'Dear Ms. Ashdown, we cannot accept $4.25 per unit. Please send a revised figure.') },
  { adds: [u('Before I send it: which day did their letter say they deliver?', 22)], ansTok: 40,
    answer: (v) => (v('letter') === 'in' || v('letterAns') === 'in'
      ? { text: 'Every Tuesday, to the Dunmore depot.', cls: 'ok', verdict: 'The letter, or the model’s own earlier summary of it, was still in the window.' }
      : v('letter') === 'sum'
        ? { text: 'I no longer have the letter itself. The summary of our earlier turns records the term, the price, and the January review. It does not record a delivery day.', cls: 'warn', verdict: 'The summary kept the headline terms and lost the detail. What a summary keeps is the summarizer’s choice.', cap: '<b>The detail is gone.</b> The summary kept the headline terms. The delivery day was not among them.' }
        : { text: 'I do not see their letter in this conversation. Attach it again and I will check.', cls: 'bad', verdict: 'The letter left the window many turns ago. This model said so. A model can also guess.', cap: '<b>The letter is outside the frame.</b> The model can only work from what is inside.' }) },
  { adds: [d('Calder_Wren_Master_Terms.pdf', '52 pages', '21.3 Prices are reviewed each January in line with clause 9 of the Supply Agreement.', 3400, { key: 'master', sum: 'Their master terms were reviewed and change nothing on price.', sumTok: 12 }), u('Their master terms. Does anything in here change our position?', 18)],
    ansTok: 220,
    answer: () => ({ text: 'Nothing in the master terms changes the price position. Clause 21.3 repeats the January review.', cls: 'ok', verdict: 'A 52-page attachment is the largest item yet. Look at what it pushed out.' }) },
  { adds: [u('Write a one-line final offer to send them.', 20)], ansTok: 60,
    answer: (v) => draft(v, 'Northgate’s offer stands as sent. Please confirm by Friday.',
      'Northgate can go no higher than $4.10 per unit, the ceiling its board approved. Please confirm by Friday.',
      'Northgate can go no higher than <mark>$4.10 per unit, the ceiling its board approved</mark>. Please confirm by Friday.',
      'Please confirm your best price by Friday.') },
];
const B = [
  { adds: [u('New day. Who do we act for on the Calder & Wren deal?', 20)], ansTok: 40,
    answer: (v) => (v('rule') === 'mem'
      ? { text: 'Northgate, the buyer. A saved note also says never to reveal the price ceiling to the other side.', cls: 'ok', verdict: 'The app inserted a saved note into this session. The model read it like any other text in the window.', cap: '<b>It seems to remember.</b> The app pasted a saved note into the frame. The model read it there.' }
      : { text: 'I have no earlier conversation with you in view. Tell me who you act for and I will start from there.', cls: 'warn', verdict: 'A new session starts with an empty window. Yesterday’s conversation sits in the app’s history, and none of it was sent.', cap: '<b>Same model, empty frame.</b> It knows nothing about yesterday.' }) },
  { adds: [u('Draft a one-line reply holding our price.', 22)], ansTok: 50,
    answer: (v) => (v('rule') === 'out' && v('ceiling') === 'out'
      ? { text: 'Dear Ms. Ashdown, our position on price is unchanged.', cls: 'warn', verdict: 'No rule and no figure in view. The draft is safe only because the window is empty.' }
      : draft(v, 'Dear Ms. Ashdown, our position on price is unchanged.',
        'Dear Ms. Ashdown, our ceiling is $4.10 per unit and our position is unchanged.',
        'Dear Ms. Ashdown, <mark>our ceiling is $4.10 per unit</mark> and our position is unchanged.',
        'Dear Ms. Ashdown, our position on price is unchanged.')) },
];
const WATCH = [['rule', 'Standing rule', 'turn 1'], ['letter', 'Their letter', 'turn 2'], ['memo', 'Pricing memo', 'turn 7']];
const VIS_LABEL = { none: 'Not sent yet', in: 'In the window', sum: 'Only in the summary', mem: 'In a memory note', out: 'Out of the window' };

export const BRIEF = {
  define: 'The context window is the fixed amount of text, counted in tokens, that a model can take in on one call. A session is one conversation thread. A memory feature is app software that saves notes about you and inserts them into later sessions.',
  misconceptions: [
    { wrong: 'The model remembers our conversation.', right: 'The model keeps nothing between calls. The app stores the conversation and re-sends all of it, from the top, on every turn. Start a new session and the frame is empty, so the same model knows nothing about you.', demo: 'remembers', demoLabel: 'Open a new session and ask' },
    { wrong: 'A memory feature means the model learned about me.', right: 'A memory feature is a store of notes run by the app. The app writes notes into it and pastes them into the window of a later session. The weights never change, and deleting the note removes the knowledge.', demo: 'learned', demoLabel: 'Save a note, then delete it' },
    { wrong: 'A bigger window means nothing gets lost.', right: 'A bigger window holds more before something gives. It is still fixed, and the oldest text still goes first when it fills. Text that fits is also read unevenly, which is the subject of stop 3.', demo: 'bigger', demoLabel: 'Run the largest window to the end' },
  ],
  legal: 'What a model worked from when it wrote an answer is whatever sat in the window on that call. Dropping and summarizing change that silently, so an instruction or a fact given early in a long session may have been out of view when a later answer was written. Reconstructing an answer afterwards depends on a record of what was in context at that moment. A memory feature creates a separate store of user information outside the conversation, and that store raises its own questions of retention, deletion, access, and disclosure.',
  ask: [
    'When a conversation outgrows the window, does the product drop the oldest text, summarize it, or stop, and does it tell the user?',
    'Where are memory notes stored, who can read them, how long are they kept, and can a user see and delete them?',
    'For a given answer, can we retrieve exactly what was in the context when it was written?',
  ],
  say: 'The model keeps nothing between turns. The app re-sends the conversation each time, only a fixed amount fits, and anything sold as memory is a note in a database that gets pasted back in.',
  checks: [
    { q: 'Twenty turns into a session the assistant ignores an instruction you gave at the start. What is the most likely mechanical cause?', a: 'The instruction is no longer in the window. The app dropped or summarized the oldest turns to make room, and the model answered from what was left.' },
    { q: 'You switch on a memory feature and the assistant opens a new chat knowing facts from last week. Where are those facts stored?', a: 'In a store run by the app, outside the model. The app inserted them into the new session’s context. The model’s weights did not change.' },
    { q: 'A vendor doubles the context window. What changes for a long matter?', a: 'More text fits before anything is dropped or summarized. The window is still fixed, the oldest material still goes first when it fills, and text that fits is not guaranteed equal attention.' },
  ],
};

export function createStop(ctx) {
  const stop = stopByN(8), narrow = ctx.isNarrow();
  const { scene, key } = baseScene({ fogNear: 28, fogFar: 70, shadow: 13, keyPos: [6, 15, 9] });
  key.target.position.set(0, 0, 0.5); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: V(5, 8, 13), target: V(0, 1.6, 0.6) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 5, maxDist: 48, maxPolar: 1.42, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf), PD = paper(PAL.paperDark);
  const kx = narrow ? 0.82 : 1;
  const M = V(-4.6 * kx, 0, -0.5), YOU = V(-2.9 * kx, 0, narrow ? 3.4 : 3.8), PILE = V(3.1 * kx, 0, narrow ? 3.0 : 3.5), CAB = V(4.9 * kx, 0, -2.3);
  let alive = true, userMoved = false, quick = false;
  controls.addEventListener('start', () => { userMoved = true; });
  const state = { size: 'm', strat: 'drop', mem: false, session: 1, turn: 0, items: [], fallen: [], notes: [], refused: [], sent: new Set(), calls: 0, reread: 0, halted: false, done: false, busy: false, last: null };
  const total = () => state.items.reduce((a, b) => a + b.tokens, 0);
  const anim = () => !quick && !motion.reduced;
  const T = (o) => (quick ? (o.update && o.update(1), Promise.resolve(true)) : tween(o));
  const W = (s) => (quick ? Promise.resolve(true) : wait(s));
  let seed = 41; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // ---------- 3D: fixed parts ----------
  const track = (a, b) => { const dd = b.clone().sub(a), len = dd.length(); const m = block(0.07, 0.02, len, { color: 0x3a352e, edges: false, cast: false }); m.position.copy(a).addScaledVector(dd, 0.5); m.position.y = 0.012; m.rotation.y = Math.atan2(dd.x, dd.z); world.add(m); };
  // the model: sealed, one slot
  const modelMat = paper(PAL.paper); modelMat.emissive = new THREE.Color(PAL.teal); modelMat.emissiveIntensity = 0;
  const model = block(2.4, 2.4, 2.4, { mat: modelMat }); model.position.copy(M); world.add(model);
  { const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), P2, 49); const o = new THREE.Object3D(); let i = 0; for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { o.position.set(-0.84 + x * 0.28, 2.425, -0.84 + z * 0.28); o.updateMatrix(); studs.setMatrixAt(i++, o.matrix); } studs.castShadow = true; model.add(studs); }
  { const so = block(0.05, 0.14, 1.0, { mat: paper(0x1b1815), edges: false }); so.position.set(1.2, 1.12, 0); model.add(so); }
  // the frame: base, corner posts, a rim, hairline edges. Its height is the window size.
  const base = block(FW + 0.6, Y0, FD + 0.6, { mat: P2 }); world.add(base);
  const frameMat = paper(PAL.paper); frameMat.emissive = new THREE.Color(PAL.verm); frameMat.emissiveIntensity = 0;
  const posts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => { const p = block(0.07, 1, 0.07, { mat: frameMat, edges: false }); p.position.set(sx * FW / 2, Y0, sz * FD / 2); world.add(p); return p; });
  const rim = new THREE.Group(); world.add(rim);
  [[FW + 0.07, 0.07, 0, FD / 2], [FW + 0.07, 0.07, 0, -FD / 2], [0.07, FD + 0.07, FW / 2, 0], [0.07, FD + 0.07, -FW / 2, 0]].forEach(([w, dp, x, z]) => { const b = block(w, 0.07, dp, { mat: frameMat, edges: false }); b.position.set(x, -0.07, z); rim.add(b); });
  [-1, 1].forEach((sx) => { const c = block(0.1, 0.16, 0.6, { mat: PD, edges: false }); c.position.set(sx * (FW / 2 + 0.07), Y0, 0); world.add(c); });
  let frameH = SIZES.m * SC + 0.1;
  function setFrameH(cap, snap) {
    const from = frameH, to = cap * SC + 0.1;
    const apply = (v) => { frameH = v; posts.forEach((p) => { p.scale.y = v; }); rim.position.y = Y0 + v; };
    if (snap || !anim()) { apply(to); return Promise.resolve(); }
    return tween({ dur: 0.6, update: (k) => apply(from + (to - from) * k) });
  }
  setFrameH(SIZES.m, true);
  // you
  const you = cyl(0.7, 0.18, { mat: P1 }); you.position.copy(YOU); world.add(you);
  const youBead = emberBead(0.15, PAL.ember, 1.7); youBead.position.set(YOU.x, 0.6, YOU.z); world.add(youBead);
  // memory cabinet: ordinary software, outside the model and outside the frame
  const cab = new THREE.Group(); cab.position.copy(CAB); world.add(cab);
  const cabMat = paper(0xd9d1bf); cab.add(block(1.8, 1.25, 1.25, { mat: cabMat }));
  const drawer = new THREE.Group(); drawer.position.set(0, 0.5, 0); cab.add(drawer);
  { const tray = block(1.5, 0.08, 1.1, { mat: P1 }); drawer.add(tray); const front = block(1.5, 0.42, 0.07, { mat: P1 }); front.position.z = 0.55; drawer.add(front); const knob = block(0.34, 0.07, 0.07, { mat: PD, edges: false }); knob.position.set(0, 0.2, 0.61); drawer.add(knob); }
  const cards = new THREE.Group(); cards.position.y = 0.09; drawer.add(cards);
  const cabGlow = halo(PAL.ember, 2.4); cabGlow.position.set(0, 0.5, 0.3); cabGlow.material.opacity = 0; drawer.add(cabGlow);
  let drawerOpen = 0;
  function setDrawer(open) { const from = drawerOpen, to = open ? 1 : 0; return T({ dur: 0.45, update: (k) => { drawerOpen = from + (to - from) * k; drawer.position.z = drawerOpen * 0.95; } }); }
  function renderCab() {
    cards.clear();
    state.notes.forEach((_, i) => { const c = block(1.0, 0.045, 0.66, { mat: glow(PAL.ember), edges: false, cast: false }); c.position.set(0, i * 0.07, 0.05); c.rotation.y = (i % 2 ? -1 : 1) * 0.08; cards.add(c); });
    cabGlow.material.opacity = state.notes.length ? 0.7 : 0;
    cabTag.el.querySelector('span').textContent = state.notes.length ? `App database · ${state.notes.length} saved ${state.notes.length === 1 ? 'note' : 'notes'}` : state.mem ? 'App database · empty' : 'Switched off';
    cabTag.el.classList.toggle('s8-dim', !state.mem && !state.notes.length);
    memCount.textContent = state.notes.length ? `${state.notes.length} saved ${state.notes.length === 1 ? 'note' : 'notes'} · stored outside the model` : 'No saved notes';
    clearBtn.setAttribute('aria-disabled', String(!state.notes.length));
  }
  // tracks
  track(V(M.x + 1.2, 0, M.z), V(-FW / 2 - 0.3, 0, -0.2)); track(V(YOU.x, 0, YOU.z - 0.7), V(-0.6, 0, FD / 2 + 0.3)); track(V(FW / 2 + 0.3, 0, 0.5), V(PILE.x - 0.6, 0, PILE.z - 1.2)); track(V(CAB.x - 0.95, 0, CAB.z + 0.3), V(FW / 2 + 0.3, 0, -0.5));
  // tags
  const _t = new THREE.Vector3();
  const tag = (b, s, pos, cls = '') => ctx.tags.add(h('div', { class: `looptag ${cls}` }, h('b', {}, b), h('span', {}, s)), pos);
  tag('Model', 'Reads the frame. Keeps nothing.', V(M.x, 3.05, M.z - 0.5));
  const frameTag = tag('Context window', '', () => _t.set(-FW / 2 - 0.1, Y0 + frameH + 0.3, -FD / 2));
  tag('You', 'Messages and attachments', V(YOU.x, 1.2, YOU.z));
  const pileTag = tag('Out of the window', 'The model cannot see these', V(PILE.x + 0.4, 0.2, PILE.z + 1.9));
  const cabTag = tag('Memory store', 'Switched off', () => _t.set(CAB.x, 1.75, CAB.z - 0.2), 's8-dim');

  // ---------- 3D: slabs ----------
  const pile = [], flags = [], spots = [];
  function makeSlab(item) {
    const o = ORIGIN[item.origin], hgt = Math.max(0.05, item.tokens * SC);
    const mat = paper(o.color), m = block(SW, hgt, SD, { mat });
    world.add(m);
    const rec = { item, m, mat, h: hgt, ty: Y0, flying: false, base: new THREE.Color(o.color) };
    item.rec = rec;
    if (item.key === 'rule' && item.origin === 'user') {
      const hl = halo(PAL.ember, 2.6); hl.position.set(SW / 2, 0.1, SD / 2); hl.material.opacity = 0.55; m.add(hl);
      const el = h('div', { class: 's8-flag' }, 'Standing rule');
      const tg = ctx.tags.add(el, () => { m.getWorldPosition(_t); if (rec.down) { _t.y += hgt + 0.25; return _t; } _t.x += SW / 2; _t.z += SD / 2; _t.y += hgt / 2; return _t; });
      rec.flag = { el, tg }; flags.push(rec.flag);
    }
    return rec;
  }
  function killSlab(rec) { if (rec.flag) { rec.flag.tg.remove(); flags.splice(flags.indexOf(rec.flag), 1); } world.remove(rec.m); rec.m.traverse((o) => { o.geometry && o.geometry.dispose(); }); rec.mat.dispose(); }
  let stackTop = Y0;
  function layout() { let y = Y0; for (const it of state.items) { it.rec.ty = y; y += it.rec.h + GAP; } stackTop = y; }
  const src = (from) => (from === 'you' ? V(YOU.x, 0.9, YOU.z) : from === 'cab' ? V(CAB.x, 1.3, CAB.z + 0.5) : V(M.x + 1.5, 1.12, M.z));
  const fly = (o, a, b, dur = 0.7, arc = 0.9) => { o.position.copy(a); return tween({ dur, update: (k) => { o.position.lerpVectors(a, b, k); o.position.y += Math.sin(k * Math.PI) * arc; } }); };
  async function addItem(item, from, at) {
    const rec = makeSlab(item);
    if (at == null) state.items.push(item); else state.items.splice(at, 0, item);
    layout();
    if (anim()) { rec.flying = true; await fly(rec.m, src(from), V(0, rec.ty, 0), 0.7, from === 'model' ? 0.7 : 1.1); rec.flying = false; }
    else rec.m.position.set(0, rec.ty, 0);
    render();
  }
  function pileSpot(rec) {
    const thick = rec.h > 0.3, x = PILE.x + (rnd() - 0.5) * (thick ? 2.4 : 1.2), z = PILE.z + (thick ? 0.5 : 0) + (rnd() - 0.5) * (thick ? 0.9 : 1.3);
    let y = 0.02; for (const s of spots) if (Math.abs(s.x - x) < 2.2 && Math.abs(s.z - z) < 1.5) y = Math.max(y, s.top);
    spots.push({ x, z, top: y + rec.h + 0.015 });
    return { pos: V(x, y, z), ry: (rnd() - 0.5) * (thick ? 0.5 : 1.3), rz: thick ? 0 : (rnd() - 0.5) * 0.06 };
  }
  function fall(rec, delay) {
    rec.flying = true; rec.down = true;
    const m = rec.m, p0 = m.position.clone(), out = V(FW / 2 + 1.35, p0.y, p0.z), sp = pileSpot(rec);
    const dim = rec.base.clone().lerp(new THREE.Color(0x2e2a25), 0.74);
    pile.push(rec); m.castShadow = true;
    const land = () => { m.position.copy(sp.pos); m.rotation.set(0, sp.ry, sp.rz); rec.mat.color.copy(dim); };
    if (!anim()) { land(); return Promise.resolve(); }
    return (async () => {
      await tween({ dur: 0.5, delay, update: (k) => { m.position.lerpVectors(p0, out, k); } });
      await tween({ dur: 0.7, e: ease.lin, update: (k) => { const b = ease.bounce(k), o2 = ease.out(k); m.position.set(out.x + (sp.pos.x - out.x) * o2, out.y + (sp.pos.y - out.y) * b, out.z + (sp.pos.z - out.z) * o2); m.rotation.set(0, sp.ry * o2, sp.rz * o2); rec.mat.color.lerpColors(rec.base, dim, k); } });
      land();
    })();
  }
  async function evict(victims, how) {
    const jobs = victims.map((it, i) => {
      state.items.splice(state.items.indexOf(it), 1); state.fallen.push({ item: it, how });
      if (it.rec.flag) { it.rec.flag.el.textContent = how === 'sum' ? 'Standing rule · now only in the summary' : 'Standing rule · out of the window'; it.rec.flag.el.classList.add(how === 'sum' ? 'sum' : 'out'); }
      return fall(it.rec, i * 0.13);
    });
    layout(); render(); await Promise.all(jobs);
  }
  const pulse = (mat, peak = 0.55, dur = 0.8) => T({ dur, e: ease.lin, update: (k) => { mat.emissiveIntensity = Math.sin(k * Math.PI) * peak; } });
  async function feed() {
    if (!anim()) return;
    const hgt = Math.max(0.1, stackTop - Y0);
    const g = new THREE.Mesh(new THREE.BoxGeometry(SW, hgt, SD), new THREE.MeshBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.4, depthWrite: false }));
    world.add(g);
    const a = V(0, Y0 + hgt / 2, 0), b = V(M.x + 1.0, 1.15, M.z);
    await tween({ dur: 0.85, update: (k) => { g.position.lerpVectors(a, b, k); g.scale.setScalar(1 - k * 0.62); g.material.opacity = 0.42 * (1 - k * 0.6); } });
    world.remove(g); g.geometry.dispose(); g.material.dispose();
    await pulse(modelMat);
  }
  async function card(a, b) { // a lit copy of user data moving between the frame and the drawer
    if (!anim()) return;
    const c = block(1.0, 0.045, 0.66, { mat: glow(PAL.ember), edges: false, cast: false }); const hl = halo(PAL.ember, 1.8); hl.position.y = 0.1; c.add(hl); world.add(c);
    await fly(c, a, b, 0.9, 1.3);
    world.remove(c); c.geometry.dispose();
  }

  // ---------- the logic (real arithmetic on illustrative token counts) ----------
  function vis(key) {
    if (state.items.some((i) => i.key === key && i.origin !== 'memory' && i.origin !== 'summary')) return 'in';
    const mem = state.items.find((i) => i.origin === 'memory'); if (mem && mem.keys.includes(key)) return 'mem';
    const sm = state.items.find((i) => i.origin === 'summary'); if (sm && sm.keys.includes(key)) return 'sum';
    return 'out';
  }
  async function makeRoom(reserve, added) {
    const cap = SIZES[state.size];
    if (total() + reserve <= cap) return true;
    const cands = state.items.filter((it) => !it.pinned && !added.includes(it)), victims = [];
    let freed = 0, sumAdd = 0;
    for (const it of cands) {
      if (total() + reserve - freed + (state.strat === 'sum' ? sumAdd : 0) <= cap) break;
      victims.push(it); freed += it.tokens; if (it.sum) sumAdd += it.sumTok;
    }
    if (total() + reserve - freed + (state.strat === 'sum' ? sumAdd : 0) > cap) { halt(`<b>The app stops.</b> This turn alone needs more room than the window has.`, total() + reserve); return false; }
    const lostRule = victims.some((it) => it.key === 'rule');
    if (state.strat === 'drop') {
      say(`<b>The frame is full.</b> The app drops the oldest text to make room: ${victims.length} ${victims.length === 1 ? 'item' : 'items'}, ~${freed.toLocaleString()} tokens.${lostRule ? ' <b>The standing rule is among them.</b>' : ''}`);
      await evict(victims, 'drop'); await W(lostRule ? 1.5 : 0.7);
    } else {
      state.calls++; state.reread += freed;
      say(`<b>The frame is full.</b> The app asks a model to summarize the oldest ${victims.length} ${victims.length === 1 ? 'item' : 'items'}, then removes the originals. That is one more model call.`);
      const old = state.items.find((i) => i.origin === 'summary');
      const frags = [...(old ? old.frags : []), ...victims.filter((v) => v.sum).map((v) => v.sum)], keys = [...(old ? old.keys : []), ...victims.filter((v) => v.sum && v.key).map((v) => v.key)];
      const tokens = (old ? old.tokens : 0) + sumAdd;
      await evict(victims, 'sum'); if (!alive) return false;
      let at = state.items.findIndex((i) => !i.pinned); if (at < 0) at = state.items.length;
      if (old) { at = state.items.indexOf(old); state.items.splice(at, 1); killSlab(old.rec); }
      if (tokens > 0) await addItem({ origin: 'summary', pinned: true, frags, keys, tokens, text: 'Summary of earlier turns. ' + frags.join(' '), turn: state.turn + 1 }, 'model', at);
      await W(0.9);
    }
    return alive;
  }
  function halt(msg, would) {
    state.halted = true; frameMat.emissiveIntensity = 0.85;
    state.last = { n: state.turn + 1, of: (state.session === 1 ? A : B).length, error: true, would, cap: SIZES[state.size] };
    render(); say(msg); ctx.announce('The app stopped. The conversation no longer fits in the context window.');
  }
  async function refuse(specs, would) {
    let y = Y0 + frameH + 0.45;
    for (const s of specs) {
      const rec = makeSlab({ ...s }); rec.flying = true; state.refused.push(rec);
      const to = V(0, y, 0); y += rec.h + 0.06;
      if (anim()) await fly(rec.m, src('you'), to, 0.7, 0.6); else rec.m.position.copy(to);
      if (!alive) return;
    }
    halt(`<b>The app stops with an error.</b> This turn needs ~${would.toLocaleString()} tokens and the window holds ${SIZES[state.size].toLocaleString()}. Nothing was dropped. Nothing more can be asked in this session.`, would);
  }
  async function saveNote(note, fromItem) {
    if (state.notes.some((n) => n.key === note.key)) return;
    say('Memory is on. <b>The app writes a note into its own store.</b> The note is a copy of your words, kept outside the model.');
    if (drawerOpen < 0.5) await setDrawer(true);
    await card(V(0, fromItem.rec.ty + 0.3, 0), V(CAB.x, 0.75, CAB.z + 0.75));
    state.notes.push(note); renderCab(); await W(0.8);
  }
  async function step() {
    if (state.halted || state.done) return;
    const script = state.session === 1 ? A : B, t = script[state.turn], cap = SIZES[state.size], n = state.turn + 1;
    const addTok = t.adds.reduce((a, b) => a + b.tokens, 0);
    if (state.strat === 'stop' && total() + addTok + t.ansTok > cap) { await refuse(t.adds, total() + addTok + t.ansTok); return; }
    const doc = t.adds.find((x) => x.origin === 'doc');
    say(doc ? `Turn ${n}. You attach <b>${esc(doc.name)}</b>. Its whole text enters the frame.` : `Turn ${n}. Your message enters the frame as text.`);
    const added = [];
    for (const s of t.adds) { const it = { ...s, turn: n }; added.push(it); if (it.key) state.sent.add(it.key); await addItem(it, 'you'); if (!alive) return; }
    if (state.mem && t.save) for (const note of t.save) { await saveNote(note, added[0]); if (!alive) return; }
    if (!(await makeRoom(t.ansTok, added)) || !alive) return;
    state.calls++; state.reread += total();
    say(`The app sends <b>the whole frame</b> to the model: ~${total().toLocaleString()} tokens, read from the top.`);
    await feed(); if (!alive) return;
    const ans = t.answer(vis);
    state.last = { n, of: script.length, q: t.adds[t.adds.length - 1].text, ans, tokens: total(), count: state.items.length, session: state.session };
    await addItem({ origin: 'model', text: ans.text, html: ans.html, tokens: t.ansTok, key: t.ansKey, sum: t.ansSum && t.ansSum[0], sumTok: t.ansSum && t.ansSum[1], turn: n }, 'model'); if (!alive) return;
    state.turn++; if (state.turn >= script.length) state.done = true;
    render();
    say(ans.cap || (state.done ? 'End of the script. Start over, or open a new session.' : 'The answer joins the frame. <b>The model keeps nothing.</b> Next turn it reads all of this again.'));
    ctx.announce(`Turn ${n}. Model: ${ans.text} ${ans.verdict}`);
  }
  function wipe() {
    const recs = [...state.items.map((i) => i.rec), ...pile, ...state.refused];
    state.items = []; state.fallen = []; state.refused = []; pile.length = 0; spots.length = 0; seed = 41;
    recs.forEach((r) => { if (r.flag) { r.flag.tg.remove(); flags.splice(flags.indexOf(r.flag), 1); r.flag = null; } });
    const done = () => recs.forEach(killSlab);
    if (!anim()) { done(); return Promise.resolve(); }
    recs.forEach((r) => { r.flying = true; });
    return tween({ dur: 0.35, update: (k) => recs.forEach((r) => { r.m.scale.setScalar(Math.max(0.001, 1 - k)); }) }).then(done);
  }
  async function begin(session, keepSay) {
    await wipe(); if (!alive) return;
    Object.assign(state, { session, turn: 0, halted: false, done: false, last: null, sent: new Set() });
    frameMat.emissiveIntensity = 0;
    const sys = { origin: 'system', pinned: true, text: SYSTEM, tokens: 60, turn: 0 };
    const q = quick; quick = true; await addItem(sys, 'you'); quick = q;
    if (!keepSay) say('');
    if (session === 2) {
      if (state.mem && state.notes.length) {
        say('New session. <b>The app opens its store and pastes the saved notes into the empty frame.</b>');
        if (drawerOpen < 0.5) await setDrawer(true);
        const text = 'Saved notes about this user. ' + state.notes.map((n) => n.text).join(' ');
        await addItem({ origin: 'memory', pinned: true, keys: state.notes.map((n) => n.key), tokens: state.notes.reduce((a, b) => a + b.tokens, 8), text, turn: 0 }, 'cab');
      } else say(state.notes.length ? 'New session. The frame is empty. Memory is switched off, so the saved notes stay in the drawer.' : 'New session. <b>The frame is empty.</b> Yesterday’s conversation stays in the app’s history and is not sent.');
    }
    render();
  }
  async function startOver(keepSay) { state.calls = 0; state.reread = 0; state.notes = []; renderCab(); await begin(1, keepSay); }

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption', role: 'status' });
  const say = (html) => { if (!quick) caption.innerHTML = html || ''; };
  const ctxList = h('div', { class: 'ctxlist s8-ctx' }), tokEl = h('span', { class: 'cap' }, ''), meter = h('i');
  const outLine = h('p', { class: 's8-out' }), countLine = h('p', { class: 's8-count' });
  const watchEl = h('ul', { class: 's8-watch', 'aria-live': 'polite' });
  const qaEl = h('div', { class: 's8-qa', 'aria-live': 'off' }), qaCap = h('span', { class: 'cap' }, '');
  const memCount = h('span', { class: 'sr', 'aria-live': 'polite' }, 'No saved notes');
  const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guard(step) }, 'Next turn');
  const newBtn = h('button', { class: 'btn', type: 'button', onclick: () => guard(() => begin(2)) }, 'New session');
  const overBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => guard(() => startOver()) }, 'Start over');
  const clearBtn = h('button', { class: 'btn ghost sm', type: 'button', 'aria-disabled': 'true', onclick: () => guard(async () => { if (!state.notes.length) return; state.notes = []; renderCab(); say('<b>Notes deleted.</b> The store is empty. The model is exactly as it was.'); }) }, 'Delete the notes');
  const sizeIn = {}, stratIn = {};
  const sizeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Window size in tokens, illustrative' }, Object.keys(SIZES).map((k) => { sizeIn[k] = h('input', { type: 'radio', name: 's8-size', value: k, checked: k === 'm', onchange: () => pick('size', k) }); return h('label', {}, sizeIn[k], h('span', {}, SIZES[k].toLocaleString())); }));
  const stratSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'What the app does when the window is full' }, Object.keys(STRATS).map((k) => { stratIn[k] = h('input', { type: 'radio', name: 's8-strat', value: k, checked: k === 'drop', onchange: () => pick('strat', k) }); return h('label', {}, stratIn[k], h('span', {}, STRATS[k])); }));
  const memSw = h('input', { type: 'checkbox', onchange: (e) => { if (state.busy) { e.target.checked = state.mem; return; } setMem(e.target.checked); } });
  const ui = h('section', { class: 'stop s8', 'aria-label': 'Stop 8, Context window' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 08 · On the ring, at the foot of the tower'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' }, h('span', {}, h('b', {}, 'Scripted'), 'The conversation and every answer. No model is running.'), h('span', {}, h('b', {}, 'Real'), 'The token arithmetic, the overflow logic, and your choices.'), h('span', {}, h('b', {}, 'Simplified'), 'Token counts are illustrative. One overflow rule at a time. Real products mix them and vary by vendor.')),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Can the model see it?'), h('span', { class: 'cap' }, 'Right now')), h('div', { class: 'plate-b' }, watchEl)),
      h('div', { class: 'plate ctxplate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'In the window'), tokEl),
        h('div', { class: 'plate-b' }, ctxList, h('div', { class: 'meter', title: 'Share of the window in use' }, meter), outLine, countLine, h('p', { class: 'invented' }, 'Invented example. Every company, person, document, and figure is invented.')))),
    h('div', { class: 'float-tr s8-float' },
      h('div', { class: 'plate' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Latest answer'), qaCap), h('div', { class: 'plate-b' }, qaEl))),
    h('div', { class: 'deck plate' },
      h('div', { class: 'grp' }, nextBtn, newBtn, overBtn),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'Window size · tokens'), sizeSeg),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'When the window is full'), stratSeg),
      h('div', { class: 'grp s8-mem' }, h('label', { class: 'switch' }, memSw, h('i'), 'Memory feature'), clearBtn, memCount)));
  ctx.hud.append(ui, caption);

  function render() {
    if (quick) return;
    const cap = SIZES[state.size], t = total();
    ctxList.replaceChildren(...state.items.map((it) => { const o = ORIGIN[it.origin]; return h('div', { class: 'ctxitem' + (it.key === 'rule' && it.origin === 'user' ? ' s8-rule' : ''), style: `--c:${o.css}` }, h('span', { class: 'bar' }), h('span', { class: 'who' }, o.label + (it.turn ? ` · turn ${it.turn}` : ''), h('i', {}, `~${it.tokens.toLocaleString()} tok`)), h('span', { class: 'txt', html: it.html || esc(it.text) })); }));
    ctxList.scrollTop = ctxList.scrollHeight;
    tokEl.textContent = `~${t.toLocaleString()} of ${cap.toLocaleString()} tok`; meter.style.width = `${Math.min(100, (t / cap) * 100)}%`;
    frameTag.el.querySelector('span').textContent = `${cap.toLocaleString()} tokens · ${Math.min(100, Math.round((t / cap) * 100))}% full`;
    const fl = state.fallen.length;
    outLine.replaceChildren(h('b', {}, 'Out of the window'), fl ? `${fl} ${fl === 1 ? 'item' : 'items'}, ~${state.fallen.reduce((a, b) => a + b.item.tokens, 0).toLocaleString()} tokens. Still in the app’s saved history. Not sent to the model.` : 'Nothing yet.');
    outLine.classList.toggle('some', fl > 0);
    countLine.replaceChildren(h('b', {}, String(state.calls)), state.calls === 1 ? ' model call · ' : ' model calls · ', h('b', {}, state.reread.toLocaleString()), ' tokens read so far');
    pileTag.el.style.display = state.fallen.length ? '' : 'none';
    watchEl.replaceChildren(...WATCH.map(([k, nm, when]) => { const v = vis(k), st = v === 'out' && !state.sent.has(k) ? 'none' : v; return h('li', { class: st }, h('span', { class: 'nm' }, nm, h('i', {}, when)), h('span', { class: 'st' }, VIS_LABEL[st])); }));
    const L = state.last;
    qaCap.textContent = L ? `${state.session === 2 ? 'Session 2 · turn' : 'Turn'} ${L.n} / ${L.of}` : state.session === 2 ? 'Session 2' : '';
    if (!L) qaEl.replaceChildren(h('p', { class: 'q' }, state.session === 2 ? 'A new session. Press Next turn to ask the first question.' : 'Press Next turn. The first message is a standing rule for the whole conversation.'));
    else if (L.error) qaEl.replaceChildren(h('p', { class: 'a err' }, `Error: this request needs ~${L.would.toLocaleString()} tokens. The context window holds ${L.cap.toLocaleString()}.`), h('p', { class: 'v bad' }, 'The app refused the turn. Nothing was silently removed, and the session cannot continue. Start a new session or start over.'));
    else qaEl.replaceChildren(h('p', { class: 'q' }, h('b', {}, 'You: '), L.q), h('p', { class: 'a', html: L.ans.html || esc(L.ans.text) }), h('p', { class: `v ${L.ans.cls}` }, L.ans.verdict), h('p', { class: 'saw' }, `The model read ${L.count} items, ~${L.tokens.toLocaleString()} tokens, to write this.`));
    nextBtn.setAttribute('aria-disabled', String(state.done || state.halted));
    nextBtn.textContent = state.done ? 'End of script' : 'Next turn';
  }
  async function guard(fn) {
    if (state.busy) return; state.busy = true; ui.classList.add('busy');
    try { await fn(); } finally { state.busy = false; quick = false; if (alive) { ui.classList.remove('busy'); render(); } }
  }
  function pick(kind, k) {
    if (state.busy) { (kind === 'size' ? sizeIn : stratIn)[state[kind]].checked = true; return; }
    guard(async () => {
      state[kind] = k;
      if (kind === 'size') { await setFrameH(SIZES[k]); if (!userMoved) ctx.reframe(); }
      await startOver(true);
      say(kind === 'size' ? `<b>Window: ${SIZES[k].toLocaleString()} tokens.</b> The frame is that tall and no taller. The conversation starts over.` : { drop: '<b>Drop the oldest.</b> When the frame fills, the oldest slabs slide out. The conversation starts over.', sum: '<b>Summarize.</b> When the frame fills, a model call condenses the oldest slabs into a short summary. The conversation starts over.', stop: '<b>Stop with an error.</b> When the frame fills, the app refuses the turn. The conversation starts over.' }[k]);
    });
  }
  async function setMem(on) {
    state.mem = on; memSw.checked = on; renderCab();
    await setDrawer(on || false);
    say(on ? '<b>Memory on.</b> From now on the app saves notes into its own store and pastes them into each new session.' : state.notes.length ? '<b>Memory off.</b> The app stops saving and stops pasting. The stored notes stay in the drawer until someone deletes them.' : 'Memory off.');
  }
  async function setup({ size = 'm', strat = 'drop', mem = false } = {}) {
    quick = true;
    state.size = size; state.strat = strat; sizeIn[size].checked = true; stratIn[strat].checked = true;
    await setFrameH(SIZES[size], true);
    state.mem = mem; memSw.checked = mem; await setDrawer(mem);
    await startOver(true);
    quick = false; userMoved = false; ctx.reframe(); renderCab(); render(); say('');
  }
  // Run session 1 forward to turn n. Turns listed in `slow` play with motion. The rest land at once.
  async function runTo(n, slow = []) {
    while (alive && state.session === 1 && state.turn < n && !state.halted && !state.done) { quick = !slow.includes(state.turn + 1); await step(); }
    quick = false; render();
  }
  const at = (cfg, turn) => state.session === 1 && !state.halted && state.turn === turn && state.size === (cfg.size || 'm') && state.strat === (cfg.strat || 'drop') && state.mem === !!cfg.mem;
  async function ensure(cfg, turn) { if (at(cfg, turn)) return; await setup(cfg); await runTo(turn); }

  // ---------- demonstrations called from the brief ----------
  const demos = {
    remembers: () => guard(async () => {
      await setup({}); await runTo(2, [1, 2]); if (!alive) return;
      say('Two turns in. It answers as if it knows you. Now open a new session.'); await wait(1.4); if (!alive) return;
      await begin(2); if (!alive) return; await wait(1.0); await step(); if (!alive) return;
      say('<b>Same model, one minute later.</b> The frame is empty, so it knows nothing about you. What felt like memory was the app re-sending the conversation on every turn.');
    }),
    learned: () => guard(async () => {
      await setup({ mem: true }); await runTo(1, [1]); if (!alive) return;
      await begin(2); if (!alive) return; await wait(0.8); await step(); if (!alive) return;
      await wait(2.2); if (!alive) return;
      state.notes = []; renderCab(); say('Now delete the notes and open another session.'); await wait(1.4); if (!alive) return;
      await begin(2, true); if (!alive) return; await step(); if (!alive) return;
      say('<b>Delete the note and the knowledge is gone.</b> It lived in the app’s drawer the whole time. The model’s weights never changed.');
    }),
    bigger: () => guard(async () => {
      await setup({ size: 'l' }); say('The largest window. Ten turns, running fast.');
      await runTo(10, [10]); if (!alive) return;
      say(`<b>Ten turns, nothing lost.</b> The window is ${Math.round((total() / SIZES.l) * 100)}% full. Now one more long attachment.`); await wait(1.8); if (!alive) return;
      await runTo(12, [11, 12]); if (!alive) return;
      say('<b>The larger window delayed the fall. It did not remove it.</b> The oldest text still went first, and the rule went with it.');
    }),
  };
  const M0 = {}, SUM = { strat: 'sum' };
  const beats = [
    { title: 'A frame of fixed size', note: 'Everything the model can see on one call has to fit inside this frame. Height is token count. It starts with one grey slab, the system prompt.', run: () => guard(() => setup(M0)) },
    { title: 'The whole frame, every turn', note: 'Watch the pale ghost of the whole stack enter the model on each turn. The model keeps nothing between calls, so the app re-sends everything.', run: () => guard(async () => { await setup(M0); await runTo(3, [1, 2, 3]); }) },
    { title: 'A long document arrives', note: 'A 38-page draft takes more room than every message so far combined. Three turns later the frame is nearly full.', run: () => guard(async () => { await ensure(M0, 3); await runTo(6, [4]); }) },
    { title: 'The oldest text slides out', note: 'One more attachment and something has to give. The app drops the oldest slabs, and the standing rule from turn 1 is among them.', run: () => guard(async () => { await ensure(M0, 6); await runTo(7, [7]); }) },
    { title: 'The answer breaks the rule', note: 'The model wrote this reply from what was in the frame. The ceiling was inside. The rule was on the table.', run: () => guard(async () => { await ensure(M0, 7); await runTo(9, [9]); }) },
    { title: 'Summarize instead', note: 'Now the app condenses old turns into a summary. The rule survives as one sentence. The delivery day in the letter does not.', run: () => guard(async () => { await setup(SUM); await runTo(10, [7, 10]); }) },
    { title: 'Memory is a drawer', note: 'With memory on, the app copies a note into its own store and pastes it into the next session. The model did not change. The drawer now holds your data.', run: () => guard(async () => { await setup({ mem: true }); await runTo(1, [1]); if (!alive) return; await begin(2); if (!alive) return; await wait(0.6); await step(); }) },
  ];

  // ---------- view interface ----------
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), fh = SIZES[state.size] * SC;
    const sizeX = narrow ? 12 : 14.2, sizeY = Math.max(narrow ? 8.2 : 7.4, fh + (narrow ? 4.2 : 4.8));
    const dist = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    const az = narrow ? 0.22 : 0.3, el = narrow ? 0.5 : 0.42;
    home.target.set(narrow ? 0.1 : 0.4, Math.max(1.4, fh * 0.46), narrow ? 1.5 : 0.9);
    home.pos.set(home.target.x + dist * Math.sin(az) * Math.cos(el), home.target.y + dist * Math.sin(el), home.target.z + dist * Math.cos(az) * Math.cos(el));
    if (!userMoved) { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
  }
  function update(dt, t) {
    const k = motion.reduced ? 1 : Math.min(1, dt * 9);
    for (const it of state.items) { const r = it.rec; if (r.flying) continue; r.m.position.x += (0 - r.m.position.x) * k; r.m.position.z += (0 - r.m.position.z) * k; r.m.position.y += (r.ty - r.m.position.y) * k; }
    if (!motion.reduced) { youBead.userData.halo.material.opacity = 0.75 + Math.sin(t * 2) * 0.2; state.refused.forEach((r, i) => { r.m.rotation.z = Math.sin(t * 3 + i) * 0.02; }); }
  }
  function textAlt() {
    const cap = SIZES[state.size], L = state.last;
    return `<p>The context window is shown as a frame of fixed height standing on the table. Each piece of text in the conversation is a slab inside it, and the height of a slab is its token count. A grey slab at the bottom is the system prompt, which the app pins in place. Your messages and attachments are ember slabs. The model’s answers are teal slabs. A sealed box to the left is the model. On every turn a ghost of the whole stack travels into the model, because the model keeps nothing between calls and reads everything again from the top.</p>
    <p>When the stack reaches the top of the frame, the app applies one rule. Drop the oldest: the oldest slabs slide out of the frame and fall onto the table, where the model cannot see them. Summarize: a model call condenses the oldest slabs into one thin summary slab and the originals fall away. Stop with an error: the new text hovers above the frame and the session ends. In the scripted conversation the user gives a standing rule at turn 1, never to reveal a price ceiling. When that slab falls out and the figure is still inside, the next draft reveals the ceiling.</p>
    <p>A cabinet to the right is the memory store. It is ordinary app software. With memory on, the app copies notes into its drawer, and a new session starts with those notes pasted into an otherwise empty frame.</p>
    <h3>Settings</h3><p>Window ${cap.toLocaleString()} illustrative tokens. When full: ${esc(STRAT_LONG[state.strat])}. Memory feature ${state.mem ? 'on' : 'off'}, ${state.notes.length} saved ${state.notes.length === 1 ? 'note' : 'notes'}. ${state.session === 2 ? 'New session.' : 'First session.'} Turn ${state.turn} of ${(state.session === 1 ? A : B).length}. Model calls ${state.calls}. Tokens read so far ${state.reread.toLocaleString()}.</p>
    <h3>In the window now (~${total().toLocaleString()} of ${cap.toLocaleString()} tokens)</h3><ol>${state.items.map((it) => `<li><b>${esc(ORIGIN[it.origin].label)}</b> (~${it.tokens.toLocaleString()} tokens): ${esc(it.text)}</li>`).join('')}</ol>
    <h3>Out of the window</h3>${state.fallen.length ? `<ol>${state.fallen.map(({ item, how }) => `<li><b>${esc(ORIGIN[item.origin].label)}, turn ${item.turn}</b>, ${how === 'sum' ? 'summarized' : 'dropped'}: ${esc(item.text)}</li>`).join('')}</ol>` : '<p>Nothing has left the window.</p>'}
    <h3>Can the model see it?</h3><ul>${WATCH.map(([k, nm]) => { const v = vis(k); return `<li>${esc(nm)}: ${esc(VIS_LABEL[v === 'out' && !state.sent.has(k) ? 'none' : v])}</li>`; }).join('')}</ul>
    <h3>Latest answer</h3>${!L ? '<p>None yet.</p>' : L.error ? `<p>The app stopped with an error. The turn needed about ${L.would.toLocaleString()} tokens and the window holds ${L.cap.toLocaleString()}.</p>` : `<p><b>You:</b> ${esc(L.q)}</p><p><b>Model:</b> ${esc(L.ans.text)}</p><p>${esc(L.ans.verdict)}</p>`}
    <h3>Memory store</h3>${state.notes.length ? `<ul>${state.notes.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul>` : '<p>Empty.</p>'}
    <p>Scripted: the conversation and every answer. Real: the token arithmetic and the overflow logic. Simplified: the token counts are illustrative, and real products mix these rules and vary by vendor. Every name, document, and figure is invented.</p>`;
  }
  { const q = quick; quick = true; addItem({ origin: 'system', pinned: true, text: SYSTEM, tokens: 60, turn: 0 }, 'you'); quick = q; }
  renderCab(); render();
  return { scene, camera, controls, update, frame, textAlt, demos, beats, api: { state, setup, runTo, step: () => guard(step), begin: (s) => guard(() => begin(s)), total, vis }, dispose() { alive = false; } };
}
