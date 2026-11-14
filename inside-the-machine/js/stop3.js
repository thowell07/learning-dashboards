// Stop 3. Attention: a loom. Tokens are pegs, attention weights are threads, and each token leaves as a blend of what it drew on.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, paper, glow, tween, wait, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

export const BRIEF = {
  define: 'Attention is the step where each token gathers information from other tokens in the context, with a weight for each one. In the models behind chat assistants, a token draws on itself and on the tokens before it. The context is everything the model can see on one call.',
  misconceptions: [
    { wrong: 'It reads a document from start to finish with equal care.', right: 'Every token is weighed against the others, and the weights are uneven. Research has measured a tendency for material at the start and the end of a long input to be used more reliably than material in the middle. The size of the dip varies by model, by task, and by how full the context is.', demo: 'equal', demoLabel: 'Slide a clause through a long document' },
    { wrong: 'It looks up what a word means.', right: 'A token enters as one fixed number, whatever the sentence. Its meaning in this sentence is built by blending in weighted information from the tokens around it. The blend is computed fresh on every call, from the context alone. No dictionary and no database is consulted.', demo: 'lookup', demoLabel: 'Run one token through two sentences' },
    { wrong: 'It understood the document, so it used all of it.', right: 'In each attention step the weights total 100 percent, so every added page competes for the same budget. A fluent answer shows that some of the input was used. Which parts were used stays hidden until you ask for quotations and pinpoints.', demo: 'usedall', demoLabel: 'Grow the document and watch the share' },
  ],
  legal: 'Position and length affect what a model uses. A clause in the middle of a long document can carry less weight in an answer than the same clause near the start or the end, so a clean summary is weak evidence that every provision was considered. Review of long documents calls for checks that the relevant passage was used, such as asking for quotations with pinpoint references, working in sections, or retrieving the relevant passages first. Nothing in attention consults an outside source, so every statement in an answer comes from the context or from patterns in the weights.',
  ask: [
    'How does this product handle a document of several hundred pages: one pass, sections, or retrieval?',
    'Have you tested whether answers change when the key passage sits at the start, the middle, or the end of the input?',
    'Can the system quote the passage it relied on, with a page or clause reference I can check?',
  ],
  say: 'The model builds the meaning of each word by weighing the words around it, fresh on every call, with no lookup. In a long document that weighing is uneven, so we check that the passage that matters was used.',
  checks: [
    { q: 'A 200-page agreement goes in and a confident summary comes out. What does the summary tell you about clause 87?', a: 'Nothing on its own. Attention is uneven, and material in the middle of a long input can carry less weight. Ask for the clause to be quoted, or review the document in sections.' },
    { q: 'The word "notice" appears in two different prompts. Does the model start from the same thing both times?', a: 'Yes. The token enters as the same number. Attention then blends in different neighbors, so the two copies end up carrying different meanings.' },
    { q: 'Where does a thread of attention go when the fact it needs is missing from the context?', a: 'Nowhere. Every thread starts and ends on a token in the context. A missing fact gets filled from patterns in the weights, which is how an unsupported statement is written.' },
  ],
};

// ---- the script: every sentence is invented, and every raw score below is hand-written ----
const MOSS = 0x9aa56e, DUSK = 0x7088a8, UMBER = 0x9a7a58;
const FUNC = new Set(['the', 'The', 'did', 'not', 'and', ',', '.', 'When', 'to']);
const VARIANTS = {
  goods: { word: 'goods', it: { 8: 3.4, 11: 1.2 }, ap: { 8: 2.4, 11: 0.8 }, who: 'the supplier', why: 'A supplier ships goods, so late goods point at the supplier.' },
  payment: { word: 'payment', it: { 8: 1.2, 11: 3.4 }, ap: { 8: 0.8, 11: 2.4 }, who: 'the buyer', why: 'A buyer pays, so a late payment points at the buyer.' },
  notice: { word: 'notice', it: { 8: 2.3, 11: 2.3 }, ap: { 8: 1.6, 11: 1.6 }, who: 'either party', why: 'Either party could owe a notice, so the weight splits. Ambiguous drafting stays ambiguous.' },
};
const SENT_A = ['When', 'the', null, 'did', 'not', 'arrive', ',', 'the', 'supplier', 'called', 'the', 'buyer', 'and', 'it', 'apologized', '.'];
const TINT_A = { 2: UMBER, 8: MOSS, 11: DUSK };
function scoresA(q, v) {
  const V = VARIANTS[v];
  const over = { 2: { 1: 1.4 }, 3: { 2: 2.0 }, 4: { 3: 1.8, 2: 1.2 }, 5: { 2: 2.6, 4: 1.9, 3: 1.0 }, 8: { 7: 1.2, 2: 1.0, 5: 0.8 }, 9: { 8: 2.6, 5: 1.0, 2: 0.8 }, 11: { 10: 1.2, 9: 2.0, 8: 1.3 }, 12: { 9: 1.3 },
    13: { ...V.it, 2: 1.9, 5: 1.3, 4: 0.9 }, 14: { ...V.ap, 13: 2.6, 5: 1.2, 4: 1.0 }, 15: { 14: 1.5 } }[q] || {};
  return generic(SENT_A, q, over);
}
const SENT_B1 = ['The', 'tenant', 'gave', 'ninety', 'days’', 'notice'], SENT_B2 = ['The', 'tenant', 'did', 'not', 'notice', 'the', 'leak'];
const scoresB1 = (q) => generic(SENT_B1, q, { 5: { 3: 2.6, 4: 3.0, 2: 1.6 }, 4: { 3: 2.4 }, 2: { 1: 2.0 }, 3: { 2: 1.0 } }[q] || {});
const scoresB2 = (q) => generic(SENT_B2, q, { 4: { 2: 2.4, 3: 2.8, 1: 1.4 }, 3: { 2: 2.0 }, 2: { 1: 1.8 }, 6: { 4: 2.4, 5: 1.2 } }[q] || {});
function generic(words, q, over) { // a mild default: content words score a little, near words a little more, then the hand-written overrides
  const s = [];
  for (let k = 0; k <= q; k++) s.push(k === q ? 0.9 : (over[k] ?? ((FUNC.has(words[k]) ? 0 : 0.5) - 0.06 * (q - k))));
  return s;
}
// Real math: softmax. Scores in, weights out, and the weights total 1.
export function softmax(s) { const mx = Math.max(...s), e = s.map((x) => Math.exp(x - mx)), t = e.reduce((a, b) => a + b, 0); return e.map((x) => x / t); }
const pct = (v) => (v >= 0.995 ? '100%' : v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`);
const DIPS = { strong: { d: 2.4, name: 'Model A' }, mild: { d: 0.8, name: 'Model B' } };
const REL = 2.6;

export function createStop(ctx) {
  const stop = stopByN(3);
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 80, shadow: 12, keyPos: [4, 14, 10] });
  key.target.position.set(0, 0, 0); scene.add(key.target);
  const camera = makeCamera(34);
  const home = { pos: new THREE.Vector3(0, 8, 20), target: new THREE.Vector3(0, 1.9, 0.5) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 6, maxDist: 60, maxPolar: 1.5, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  const EMBER = new THREE.Color(0xff9a1f), DIMC = new THREE.Color(0x6b6455), BLACK = new THREE.Color(0);
  const PEGH = 0.75, OUTZ = 1.35, TAGZ = 1.95, COLH = 2.5, SPAN = 15.6;
  const tmp = new THREE.Vector3(), curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  let alive = true, userMoved = false, busy = false;
  controls.addEventListener('start', () => { userMoved = true; });

  const st = { mode: 'sentence', variant: 'goods', clause: 20, len: 40, dip: 'strong', ctxs: [] };

  // the table: one strip for the tokens going in, one for the blends coming out
  const inStrip = block(SPAN + 2.4, 0.05, 1.1, { color: 0x24211d, edges: false, cast: false }); world.add(inStrip);
  const outStrip = block(SPAN + 2.4, 0.05, 0.95, { color: 0x24211d, edges: false, cast: false }); outStrip.position.z = OUTZ; world.add(outStrip);
  const dyn = new THREE.Group(); world.add(dyn);
  let dynTags = [];
  const addTag = (el, pos) => { const t = ctx.tags.add(el, pos); dynTags.push(t); return t; };
  ctx.tags.add(h('div', { class: 's3-rowtag' }, 'Tokens in'), new THREE.Vector3(-SPAN / 2 - 0.75, 0.3, 0));
  ctx.tags.add(h('div', { class: 's3-rowtag' }, 'Blends out'), new THREE.Vector3(-SPAN / 2 - 0.75, 0.1, OUTZ));

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption', role: 'status' });
  const say = (html) => { caption.innerHTML = html || ''; };
  const sentEl = h('div', { class: 's3-sent' });
  const sentCap = h('span', { class: 'cap' }, 'One sentence');
  const wTitle = h('span', { class: 'cap' }, ''), wTotal = h('span', { class: 'cap' }, '');
  const wList = h('ol', { class: 's3-weights' });
  const wNote = h('p', { class: 's3-note' });
  const segOf = (name, label, opts, cur, on) => { const ins = {}; const el = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, opts.map(([k, t]) => { ins[k] = h('input', { type: 'radio', name, value: k, checked: k === cur, onchange: () => on(k) }); return h('label', {}, ins[k], h('span', {}, t)); })); return { el, ins }; };
  const modeSeg = segOf('s3-mode', 'What the loom shows', [['sentence', 'One sentence'], ['same', 'One token, twice'], ['doc', 'Long document']], st.mode, (k) => { if (busy) { modeSeg.ins[st.mode].checked = true; return; } setMode(k); });
  const varSeg = segOf('s3-var', 'The word that did not arrive', [['goods', 'goods'], ['payment', 'payment'], ['notice', 'notice']], st.variant, (k) => setVariant(k));
  const mixSw = h('input', { type: 'checkbox', onchange: (e) => setMix(e.target.checked) });
  const posOut = h('output', { for: 's3-pos' }, ''), lenOut = h('output', { for: 's3-len' }, '');
  const posIn = h('input', { type: 'range', id: 's3-pos', min: '0', max: '39', step: '1', value: '20', oninput: (e) => setClause(Number(e.target.value)) });
  const lenIn = h('input', { type: 'range', id: 's3-len', min: '10', max: '40', step: '1', value: '40', oninput: (e) => setLen(Number(e.target.value)) });
  const dipSeg = segOf('s3-dip', 'Two illustrative models', [['strong', 'Model A · deep dip'], ['mild', 'Model B · mild dip']], st.dip, (k) => { st.dip = k; retarget(); renderPanels(); say(k === 'strong' ? '<b>Model A.</b> A deep dip in the middle. Illustrative shape.' : '<b>Model B.</b> A milder dip. The tendency varies by model.'); });
  const meter = h('i');
  const grpVar = h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'Change one distant word: what did not arrive?'), varSeg.el);
  const grpMix = h('div', { class: 'grp' }, h('label', { class: 'switch' }, mixSw, h('i'), 'Run attention'));
  const grpDoc = h('div', { class: 'grp s3-docgrp' },
    h('div', { class: 'slider' }, h('label', { for: 's3-pos' }, 'Where the key clause sits'), posOut, posIn),
    h('div', { class: 'slider' }, h('label', { for: 's3-len' }, 'Document length'), lenOut, lenIn),
    h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'Two illustrative models'), dipSeg.el));
  const sentPlate = h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, sentCap, h('span', { class: 'cap' }, 'Invented example')), h('div', { class: 'plate-b' }, sentEl));
  const wPlate = h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, wTitle, wTotal), h('div', { class: 'plate-b' }, wList, h('div', { class: 'meter s3-meter', hidden: true }, meter), wNote));
  const ui = h('section', { class: 'stop s3', 'aria-label': 'Stop 3, Attention' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 03 · The third floor of the tower'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' },
        h('span', {}, h('b', {}, 'Scripted'), 'The sentences and the raw relevance scores behind every thread. No model is running.'),
        h('span', {}, h('b', {}, 'Real'), 'The softmax that turns scores into weights. Every set of weights is computed live and totals 100 percent.'),
        h('span', {}, h('b', {}, 'Simplified'), 'One attention head in one layer, with whole words as tokens. A real model runs many heads in each of dozens of layers. The long-document dip is a shape with no measured numbers.')),
      sentPlate, wPlate),
    h('div', { class: 'deck plate' }, h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'The loom shows'), modeSeg.el), grpVar, grpMix, grpDoc),
  );
  ctx.hud.append(ui, caption);

  // ---------- building a context: pegs, threads, the output column ----------
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf), SHADES = [0xefe8d8, 0xd6cebb, 0xc2bba9];
  function clearDyn() {
    dynTags.forEach((t) => t.remove()); dynTags = [];
    dyn.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== P1 && o.material !== P2) o.material.dispose(); });
    dyn.clear(); st.ctxs = [];
  }
  function makeCtx({ words, tints = {}, x0, dx, scores, sel, label, slat = false, ids = {} }) {
    const n = words.length, c = { words, n, x: [], pegs: [], threads: [], bands: [], scores, sel, w: new Float32Array(n), wt: new Float32Array(n), shown: new Float32Array(n).fill(-1), mix: 0, mixT: 1, dirty: true, label, slat, tints, btns: [], colTags: [], wordBtns: [] };
    for (let i = 0; i < n; i++) {
      const x = x0 + i * dx; c.x.push(x);
      const mat = paper(tints[i] ?? PAL.paper); mat.emissive = new THREE.Color(0);
      const isQ = slat && i === n - 1;
      const peg = slat && !isQ ? block(dx * 0.62, 0.95, 0.5, { mat }) : block(0.52, isQ ? 1.0 : PEGH, 0.52, { mat });
      peg.position.x = x; dyn.add(peg); c.pegs.push({ m: peg, mat, top: slat ? (isQ ? 1.0 : 0.95) : PEGH });
      const th = new THREE.Mesh(new THREE.BufferGeometry(), glow(0x6b6455)); th.visible = false; dyn.add(th); c.threads.push(th);
      if (!slat) {
        const tile = block(0.6, 0.05, 0.6, { mat: P2, cast: false }); tile.position.set(x, 0.05, OUTZ); dyn.add(tile);
        const b = h('button', { class: 's3-tok' + (i % 2 ? ' alt' : ''), type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: () => select(c, i) }, words[i], ids[i] ? h('i', {}, ids[i]) : null);
        addTag(h('div', {}, b), new THREE.Vector3(x, 0, TAGZ)); c.btns.push(b);
      }
    }
    // the output column: one band per source, or three bands in the long-document view
    const nb = slat ? 3 : n;
    for (let i = 0; i < nb; i++) { const bm = paper(slat ? [PAL.paper, 0xff9a1f, PAL.paperCool][i] : (tints[i] ?? SHADES[i % 3])); if (slat && i === 1) { bm.emissive = new THREE.Color(0xff8a10); bm.emissiveIntensity = 0.55; } const m = block(0.62, 1, 0.62, { mat: bm }); m.scale.y = 0.0001; m.visible = false; dyn.add(m); c.bands.push({ m, y: 0, hgt: 0 }); }
    if (slat) addTag(h('div', { class: 's3-band left' }, 'drawn from the key clause'), () => tmp.set(c.x[c.sel] - 0.42, 0.1 + c.bands[1].y + c.bands[1].hgt / 2, OUTZ));
    else for (let i = 0; i < 3; i++) { const el = h('div', { class: 's3-band' }, ''); const slot = { el, src: -1 }; addTag(el, () => { const b = c.bands[Math.max(0, slot.src)]; return tmp.set(c.x[c.sel] + 0.42, 0.1 + b.y + b.hgt / 2, OUTZ); }); c.colTags.push(slot); }
    if (label) addTag(h('div', { class: 's3-ctxtag' }, label), new THREE.Vector3(x0 + ((n - 1) * dx) / 2, 0, -0.85));
    st.ctxs.push(c);
    return c;
  }
  function build() {
    clearDyn();
    if (st.mode === 'sentence') {
      const words = SENT_A.map((w) => w ?? VARIANTS[st.variant].word), dx = SPAN / (words.length - 1);
      makeCtx({ words, tints: TINT_A, x0: -SPAN / 2, dx, scores: (q) => scoresA(q, st.variant), sel: 13 });
    } else if (st.mode === 'same') {
      const dx = SPAN / 13.4;
      const a = makeCtx({ words: SENT_B1, tints: { 3: MOSS, 4: MOSS }, x0: -SPAN / 2, dx, scores: scoresB1, sel: 5, label: 'Prompt one', ids: { 5: 'id 4812' } });
      const b = makeCtx({ words: SENT_B2, tints: { 2: DUSK, 3: DUSK }, x0: -SPAN / 2 + 7.4 * dx, dx, scores: scoresB2, sel: 4, label: 'Prompt two', ids: { 4: 'id 4812' } });
      a.mixT = b.mixT = mixSw.checked ? 1 : 0; a.mix = a.mixT; b.mix = b.mixT;
    } else {
      const n = st.len, dx = (SPAN - 1.4) / (n - 1);
      const words = Array.from({ length: n }, (_, i) => `passage ${i + 1}`).concat(['question']);
      const c = makeCtx({ words, x0: -SPAN / 2, dx, scores: () => docScores(), sel: n, slat: true });
      c.x[n] = SPAN / 2; c.pegs[n].m.position.x = SPAN / 2; c.pegs[n].mat.emissive.set(0xff8a10); c.pegs[n].mat.emissiveIntensity = 0.9;
      addTag(h('div', { class: 's3-ctxtag em' }, 'The question'), new THREE.Vector3(SPAN / 2, 0, TAGZ));
      addTag(h('div', { class: 's3-ctxtag em low' }, 'Key clause'), () => tmp.set(c.x[Math.min(st.clause, n - 1)], 0, 0.45));
      [['Start', 0], ['Middle', (n - 1) / 2], ['End', n - 1]].forEach(([t, i]) => addTag(h('div', { class: 's3-ctxtag dn' }, t), new THREE.Vector3(-SPAN / 2 + i * dx, 0, 0.45)));
      // a ridge behind the document: how the question's attention spreads over position, clause aside
      c.ridge = []; const rm = paper(0x8a8477);
      for (let i = 0; i < n; i++) { const b = block(dx * 0.62, 1, 0.1, { mat: rm, edges: false, cast: false }); b.position.set(c.x[i], 0.05, -0.52); b.scale.y = 0.01; dyn.add(b); c.ridge.push(b); }
      addTag(h('div', { class: 's3-ctxtag ridge' }, 'Where attention tends to land · illustrative shape'), new THREE.Vector3(-SPAN / 2 - 0.2, 2.95, -0.52));
      paintClause(c);
    }
    st.ctxs.forEach((c) => { c.wt.set(targets(c)); c.w.set(c.wt); c.dirty = true; });
    renderSentence(); st.ctxs.forEach(markSel);
    renderPanels();
  }
  function docScores() { // position bias plus relevance for the one clause that answers the question
    const n = st.len, d = DIPS[st.dip].d, s = [];
    for (let i = 0; i < n; i++) { const p = i / (n - 1); s.push(d * ((2 * p - 1) ** 2 - 0.5) + (i === st.clause ? REL : 0)); }
    s.push(0.2); return s;
  }
  function paintClause(c) { c.pegs.forEach((p, i) => { if (i === c.n - 1) return; const on = i === st.clause; p.mat.color.set(on ? 0xffb14a : PAL.paper); p.mat.emissive.set(on ? 0xff8a10 : 0); p.mat.emissiveIntensity = on ? 0.9 : 0; }); }
  function targets(c) { const w = softmax(c.scores(c.sel)), out = new Float32Array(c.n); w.forEach((v, i) => { out[i] = v; }); return out; }
  function retarget() { st.ctxs.forEach((c) => { c.wt.set(targets(c)); c.dirty = true; }); }
  function markSel(c) { c.btns.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === c.sel)); }); c.wordBtns.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === c.sel)); }); if (!c.slat) c.pegs.forEach((p, i) => { p.mat.emissive.set(i === c.sel ? 0xff8a10 : 0); p.mat.emissiveIntensity = i === c.sel ? 0.85 : 0; }); }
  function select(c, i, quiet) {
    if (c.sel === i) return;
    c.sel = i; c.w.fill(0); c.wt.set(targets(c)); c.dirty = true; markSel(c); renderPanels();
    if (!quiet) { const first = i === 0; say(first ? `<b>“${esc(c.words[i])}” is the first token.</b> Nothing stands before it, so all of its weight stays on itself.` : `<b>“${esc(c.words[i])}”</b> draws on itself and the ${i} token${i > 1 ? 's' : ''} before it. Later tokens are out of its reach.`); }
  }

  // ---------- controls ----------
  function setMode(k, quiet) {
    st.mode = k; modeSeg.ins[k].checked = true; userMoved = false;
    grpVar.hidden = k !== 'sentence'; grpMix.hidden = k !== 'same'; grpDoc.hidden = k !== 'doc';
    if (k === 'same') mixSw.checked = false;
    build(); place(1);
    if (!quiet) say({ sentence: 'Select any token to see what it draws on. Then change the one word that did not arrive.', same: '<b>The same token, in two prompts.</b> Both copies of “notice” enter as the same number. Switch on attention.', doc: '<b>A long document, then a question.</b> Slide the key clause through the document and watch its thread.' }[k]);
  }
  function setVariant(k, quiet) {
    st.variant = k; varSeg.ins[k].checked = true;
    const c = st.ctxs[0]; if (st.mode !== 'sentence' || !c) return;
    c.words[2] = VARIANTS[k].word; c.btns[2].firstChild.textContent = VARIANTS[k].word; c.wordBtns[2].textContent = VARIANTS[k].word; c.wordBtns[2].setAttribute('aria-label', `Token 3: ${VARIANTS[k].word}. Show what it draws on.`);
    retarget(); renderPanels();
    if (!quiet) say(`<b>One word changed, eleven tokens back.</b> “it” now leans on ${esc(VARIANTS[k].who)}. ${esc(VARIANTS[k].why)}`);
  }
  function setMix(on, quiet) {
    mixSw.checked = on; st.ctxs.forEach((c) => { c.mixT = on ? 1 : 0; c.dirty = true; }); renderPanels();
    if (!quiet) say(on ? '<b>Same token in, different blend out.</b> One “notice” drew on “ninety days’”. The other drew on “did not”.' : 'Before attention. Two identical blocks, because the token is the same number in both prompts.');
  }
  function setClause(i, quiet) {
    i = Math.max(0, Math.min(st.len - 1, i)); const same = i === st.clause; st.clause = i; posIn.value = String(i);
    const c = st.ctxs[0]; if (st.mode !== 'doc' || !c || (same && quiet)) return;
    paintClause(c); retarget(); renderPanels();
    if (!quiet) { const p = st.clause / (st.len - 1); say(p < 0.2 ? '<b>Near the start.</b> The thread from the question is thick.' : p > 0.8 ? '<b>Near the end.</b> Close to the question, and the thread is thick.' : '<b>In the middle.</b> The same clause, the same question, a thinner thread.'); }
  }
  function setLen(n, quiet) {
    const p = st.clause / (st.len - 1); st.len = n; lenIn.value = String(n); posIn.max = String(n - 1); st.clause = Math.round(p * (n - 1)); posIn.value = String(st.clause);
    if (st.mode !== 'doc') return;
    build();
    if (!quiet) say(`<b>${n} passages share one budget.</b> The weights still total 100 percent, so each added passage thins the rest.`);
  }
  async function guard(fn) { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } }

  // ---------- panels ----------
  function renderSentence() {
    if (st.mode === 'doc') { sentEl.replaceChildren(h('p', { class: 's3-doc' }, `A ${st.len}-passage agreement fills the context. One passage, the key clause, answers the question that follows it. Every other passage is filler for this question.`)); return; }
    sentEl.replaceChildren(...st.ctxs.map((c) => h('p', { class: 's3-line' }, c.label ? h('span', { class: 'cap' }, c.label) : null,
      c.words.map((w, i) => { const b = h('button', { class: 's3-word', type: 'button', 'aria-pressed': 'false', 'aria-label': `Token ${i + 1}: ${w}. Show what it draws on.`, onclick: () => select(c, i) }, w); c.wordBtns.push(b); return b; }))));
  }
  function renderPanels() {
    const m = st.mode;
    sentCap.textContent = m === 'sentence' ? 'One sentence' : m === 'same' ? 'Two prompts, one shared token' : 'One long document, one question';
    const c = st.ctxs[0]; if (!c) return;
    wPlate.querySelector('.s3-meter').hidden = m !== 'doc';
    if (m === 'doc') {
      const w = targets(c), share = w[st.clause];
      wTitle.textContent = 'Share of the question’s attention on the key clause'; wTotal.textContent = '';
      wList.replaceChildren(); meter.style.width = `${Math.min(100, share * 100 * 1.6)}%`;
      posOut.textContent = `passage ${st.clause + 1} of ${st.len}`; lenOut.textContent = `${st.len} passages`;
      wNote.textContent = `${DIPS[st.dip].name}, an invented model. The bar and the threads are computed from scripted scores. The dip in the middle pictures a tendency that research measured as answer accuracy by position. It is drawn without numbers because none were measured here.`;
      return;
    }
    const lists = st.ctxs.map((cx) => {
      const w = targets(cx), order = [...w.keys()].filter((i) => i <= cx.sel).sort((a, b) => w[b] - w[a]);
      const top = order.slice(0, m === 'same' ? 3 : 6), rest = order.slice(top.length).reduce((a, i) => a + w[i], 0);
      const rows = top.map((i) => h('li', {}, h('span', { class: 'wd' }, i === cx.sel ? `${cx.words[i]} (itself)` : cx.words[i]), h('span', { class: 'bar' }, h('i', { style: `width:${(w[i] * 100).toFixed(1)}%` })), h('span', { class: 'pc' }, pct(w[i]))));
      if (rest > 0.0005) rows.push(h('li', { class: 'rest' }, h('span', { class: 'wd' }, `${order.length - top.length} others`), h('span', { class: 'bar' }, h('i', { style: `width:${(rest * 100).toFixed(1)}%` })), h('span', { class: 'pc' }, pct(rest))));
      return h('li', { class: 's3-wgrp' }, h('span', { class: 'cap' }, `“${cx.words[cx.sel]}”${cx.label ? ' in ' + cx.label.toLowerCase() : ''} draws on`), h('ol', {}, rows));
    });
    wTitle.textContent = m === 'same' && !mixSw.checked ? 'Weights, once attention runs' : 'Attention weights'; wTotal.textContent = 'Each list totals 100%';
    wList.replaceChildren(...lists);
    wNote.textContent = m === 'sentence' ? 'A token draws on itself and on earlier tokens only. Select the first word and its whole weight stays on itself.' : 'Both lists start from the same token. The neighbors differ, so the weights differ, so the blend that leaves differs.';
    st.ctxs.forEach((cx) => { const w = targets(cx), order = [...w.keys()].filter((i) => i <= cx.sel && i !== cx.sel).sort((a, b) => w[b] - w[a]).slice(0, 3); cx.colTags.forEach((slot, k) => { const i = order[k]; const show = i !== undefined && w[i] > 0.08; slot.src = show ? i : -1; slot.el.textContent = show ? `${cx.words[i]} ${pct(w[i])}` : ''; slot.el.style.display = show ? '' : 'none'; }); });
  }

  // ---------- demonstrations ----------
  const sweep = (from, to, dur, fn) => tween({ dur, update: (k) => fn(Math.round(lerp(from, to, k))) });
  const threadCount = () => st.ctxs.reduce((a, c) => a + c.sel + 1, 0);
  const demos = {
    equal: () => guard(async () => {
      setMode('doc', true); st.dip = 'strong'; dipSeg.ins.strong.checked = true; if (st.len !== 40) setLen(40, true); setClause(0, true);
      say('The key clause starts at the top of the document. <b>The thread from the question is thick.</b>'); await wait(1.4); if (!alive) return;
      say('The same clause slides toward the middle…'); await sweep(0, 20, 2.4, (v) => setClause(v, true)); if (!alive) return;
      say('<b>Same clause, same question, a thinner thread.</b> Position changed what the model drew on.'); await wait(1.8); if (!alive) return;
      await sweep(20, 39, 2.0, (v) => setClause(v, true)); if (!alive) return;
      say('<b>Thick at the start, thin in the middle, thick at the end.</b> The model weighs a document unevenly. It has no steady reading pace.');
    }),
    lookup: () => guard(async () => {
      setMode('same', true); setMix(false, true);
      say('Two prompts. “notice” enters both as <b>the same number</b>, shown as identical blocks.'); await wait(1.8); if (!alive) return;
      setMix(true, true); await wait(1.4); if (!alive) return;
      const n = threadCount();
      say(`<b>${n} threads. ${n} end on a token inside the context. 0 leave the table.</b> The two meanings of “notice” were built from neighbors. Nothing was looked up.`);
    }),
    usedall: () => guard(async () => {
      setMode('doc', true); st.dip = 'strong'; dipSeg.ins.strong.checked = true; setLen(10, true); setClause(5, true);
      say('A short document. Ten passages, and the key clause holds a good share of the question’s attention.'); await wait(1.6); if (!alive) return;
      for (const n of [16, 22, 28, 34, 40]) { setLen(n, true); setClause(Math.round((n - 1) / 2), true); await wait(0.45); if (!alive) return; }
      say('<b>Forty passages, one budget of 100 percent.</b> The clause is still there and its share has thinned. A fluent answer does not show which passages it used.');
    }),
  };

  // ---------- the guide ----------
  const beats = [
    { title: 'A row of tokens', note: 'Each peg is one token of an invented sentence. Select “arrive” and its threads show what it draws on: the thing that did not arrive.', run: async () => { setMode('sentence', true); setVariant('goods', true); select(st.ctxs[0], 5, true); say('<b>“arrive”</b> leans on “goods” and “not”. Thread thickness is the weight.'); await wait(1.0); } },
    { title: 'Who is “it”?', note: 'Select “it”. The thickest thread runs back to the supplier, because late goods point at the party that ships.', run: async () => { setMode('sentence', true); setVariant('goods', true); select(st.ctxs[0], 13, true); say('<b>“it” draws most on “supplier”.</b> The column in front shows the blend that leaves.'); await wait(1.0); } },
    { title: 'Change one distant word', note: 'Swap “goods” for “payment”, eleven tokens back. The thick thread swings from the supplier to the buyer.', run: async () => { if (st.mode !== 'sentence') setMode('sentence', true); select(st.ctxs[0], 13, true); setVariant('goods', true); await wait(0.5); setVariant('payment'); await wait(1.2); } },
    { title: 'One token, two meanings', note: '“notice” enters both prompts as the same number. After attention each copy carries a different blend.', run: async () => { setMode('same', true); setMix(false, true); await wait(0.9); if (!alive) return; setMix(true); await wait(1.2); } },
    { title: 'A clause lost in the middle', note: 'The key clause slides from the start of a long document to the middle. Its thread thins while the clause and the question stay the same.', run: async () => { setMode('doc', true); if (st.len !== 40) setLen(40, true); setClause(0, true); await wait(0.7); if (!alive) return; await sweep(0, 20, 2.0, (v) => setClause(v, true)); setClause(20); } },
    { title: 'No thread leaves the table', note: 'Count the threads. Every one starts and ends on a token in the context, so attention moves information around and fetches none.', run: async () => { setMode('sentence', true); setVariant('notice', true); select(st.ctxs[0], 14, true); const n = threadCount(); say(`<b>${n} threads from “apologized”. ${n} land inside the context. 0 reach outside.</b>`); await wait(0.8); } },
  ];

  // ---------- view interface ----------
  let baseD = 22, el = 0.36, az = 0.2;
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), portrait = freeW / freeH < 1.15;
    const sizeX = portrait ? 17.6 : 18.5, sizeY = portrait ? 8.4 : 8.6;
    baseD = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    el = portrait ? 0.5 : 0.4; az = portrait ? 0 : 0.16;
    if (!userMoved) place(1);
  }
  function place(k) {
    home.target.set(-0.3, 1.7, 0.7);
    home.pos.set(home.target.x + baseD * Math.sin(az) * Math.cos(el), home.target.y + baseD * Math.sin(el), home.target.z + baseD * Math.cos(az) * Math.cos(el));
    camera.position.lerp(home.pos, k); controls.target.lerp(home.target, k); controls.update();
  }
  function update(dt) {
    const k = motion.reduced ? 1 : Math.min(1, dt * 6);
    for (const c of st.ctxs) {
      let moving = c.dirty; c.dirty = false;
      if (Math.abs(c.mix - c.mixT) > 0.001) { c.mix = lerp(c.mix, c.mixT, k); if (Math.abs(c.mix - c.mixT) < 0.004) c.mix = c.mixT; moving = true; }
      for (let i = 0; i < c.n; i++) { const d = c.wt[i] - c.w[i]; if (Math.abs(d) > 0.0004) { c.w[i] += d * k; moving = true; } else c.w[i] = c.wt[i]; }
      if (!moving) continue;
      const q = c.sel, ax = c.x[q], y0 = c.pegs[q].top, uniform = 1 / (q + 1);
      for (let i = 0; i < c.n; i++) {
        const th = c.threads[i], w = i < q ? c.w[i] * c.mix : 0;
        if (Math.abs(w - c.shown[i]) < 0.0015 && th.userData.q === q) continue;
        c.shown[i] = w; th.userData.q = q;
        if (w < 0.003) { th.visible = false; continue; }
        th.visible = true;
        const bx = c.x[i], dist = Math.abs(ax - bx);
        curve.v0.set(ax, y0, 0); curve.v1.set((ax + bx) / 2, y0 + 0.5 + Math.min(6.6, dist * 0.62), 0); curve.v2.set(bx, c.pegs[i].top, 0);
        th.geometry.dispose(); th.geometry = new THREE.TubeGeometry(curve, c.slat ? 18 : 26, 0.008 + 0.16 * w, 6, false);
        th.material.color.copy(DIMC).lerp(EMBER, Math.min(1, c.slat ? (i === st.clause ? 0.35 + w * 2.4 : (w / uniform) * 0.2) : w * 2.6));
      }
      // the column that leaves: before attention it is the token alone, after attention it is the weighted blend
      let y = 0;
      if (c.slat) {
        const parts = [1 - c.w[st.clause] - c.w[q], c.w[st.clause], c.w[q]];
        c.bands.forEach((b, i) => { const hh = Math.max(0.0001, parts[i] * COLH); b.m.visible = true; b.m.scale.y = hh; b.m.position.set(ax, 0.1 + y, OUTZ); b.y = y; b.hgt = hh; y += hh; });
        const bias = softmax(c.scores(q).map((v, i) => (i === st.clause ? v - REL : v))); let mx = 0; for (let i = 0; i < q; i++) mx = Math.max(mx, bias[i]);
        c.ridge.forEach((b, i) => { b.scale.y = 1.08 + (bias[i] / mx) * 1.7; });
      } else {
        c.bands.forEach((b, i) => { const f = lerp(i === q ? 1 : 0, i <= q ? c.w[i] : 0, c.mix), hh = f * COLH; b.m.visible = f > 0.004; b.m.scale.y = Math.max(0.0001, hh); b.m.position.set(ax, 0.1 + y, OUTZ); b.y = y; b.hgt = hh; y += hh; });
        c.colTags.forEach((slot) => { slot.el.style.opacity = String(c.mix); });
      }
    }
  }
  function textAlt() {
    const m = st.mode;
    const intro = `<p>The model is a loom. The tokens of a sentence stand in a row as paper pegs. When you select a token, threads arc from it back to itself and to every earlier token. The thickness of each thread is the attention weight, the share of what the selected token draws from that source. The weights are computed by a softmax and always total 100 percent. In front of the selected token stands a column built of bands, one band per source, sized by weight. That column is the blend that leaves this step in place of the bare token.</p>
    <p>No thread leaves the table. Attention moves information between tokens that are already in the context and consults no outside source.</p>`;
    let body = '';
    if (m === 'doc') {
      const c = st.ctxs[0], w = targets(c), share = w[st.clause], third = st.clause / (st.len - 1) < 0.2 ? 'near the start' : st.clause / (st.len - 1) > 0.8 ? 'near the end' : 'in the middle';
      body = `<h3>Long document view</h3><p>A document of ${st.len} passages fills the context, followed by a question. One passage, the key clause, answers the question. It now sits at passage ${st.clause + 1}, ${third}. Its thread from the question is ${share > 0.3 ? 'thick' : share > 0.15 ? 'of middling thickness' : 'thin'}. Sliding the clause shows a thick thread at the start, a thin one in the middle, and a thick one at the end. Lengthening the document thins every thread, because all passages share one budget of 100 percent.</p><p>This pictures a research finding (Liu and others, 2023) that models answered more accurately when the relevant passage sat at the start or the end of a long input. The size of the effect varies by model, task, and how full the context is. The shape here is illustrative and carries no measured numbers.</p>`;
    } else {
      body = st.ctxs.map((c) => { const w = targets(c); return `<h3>${c.label ? esc(c.label) + ': ' : 'Sentence (invented): '}${esc(c.words.join(' ').replace(/ ([,.])/g, '$1'))}</h3><p>Selected token: “${esc(c.words[c.sel])}”.</p><table><tr><th>Draws on</th><th>Weight</th></tr>${[...w.keys()].filter((i) => i <= c.sel).sort((a, b) => w[b] - w[a]).map((i) => `<tr><td>${esc(c.words[i])}${i === c.sel ? ' (itself)' : ''}</td><td>${pct(w[i])}</td></tr>`).join('')}</table>`; }).join('');
      body += m === 'sentence' ? `<p>The word that did not arrive can be goods, payment, or notice. With “goods”, the token “it” puts most of its weight on “supplier”. With “payment”, the weight swings to “buyer”. With “notice”, the weight splits between the two, because the sentence is ambiguous.</p>` : `<p>Both prompts contain the token “notice”, which enters as the same number. In the first prompt it draws mostly on “ninety” and “days’”. In the second it draws mostly on “did” and “not”. The same token leaves as two different blends.</p>`;
    }
    return `${intro}${body}<p>Scripted: the sentences and the raw scores. Real: the softmax that turns scores into weights. Simplified: one attention head in one layer, where a real model runs many heads in each of many layers.</p>`;
  }

  setMode('sentence', true);
  say('Select any token to see what it draws on. Then change the one word that did not arrive.');
  return { scene, camera, controls, update, frame, textAlt, demos, beats, dispose() { alive = false; clearDyn(); } };
}
