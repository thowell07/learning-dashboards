// Stop 1. Tokens: the cutting table. Your sentence lies on the table as one tile per byte.
// Real byte-pair merges fuse the tiles into tokens, the tokens flip to numbers, and only the numbers go up.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, paper, addEdges, halo, emberBead, tween, wait, ease, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

export const BRIEF = {
  define: 'A token is a piece of text the model treats as one unit: a whole common word, a fragment of a rare one, a punctuation mark, or a few digits. A tokenizer is the fixed table and procedure that cuts text into tokens and replaces each one with its number.',
  misconceptions: [
    { wrong: 'A token is a word.', right: 'Common words are usually one token each. Rare names, long technical words, numbers, and text in other languages break into several. A count in tokens runs higher than a count in words, and how much higher depends on the text.', demo: 'word', demoLabel: 'Cut a common word and a rare name' },
    { wrong: 'The model reads my text the way I do.', right: 'The model receives a list of numbers. Each number points to a row in a table the model learned in training. Letters, spelling, and layout reach it only through those numbers. Nothing is lost on the way: the numbers decode back to the exact text, so a tokenized document is still the document.', demo: 'numbers', demoLabel: 'Flip the strip to numbers' },
    { wrong: 'A token count is the same everywhere.', right: 'Each model family ships its own tokenizer. The same sentence can take a different number of tokens on a different model, so limits, usage reports, and bills counted in tokens compare cleanly only within one tokenizer.', demo: 'vocab', demoLabel: 'Count it with a second vocabulary' },
  ],
  legal: 'Limits and prices are written in tokens. A context limit caps the tokens in one call, and input and output tokens are usually priced separately. "Input" covers everything sent on a call: the system prompt, the conversation so far, attachments, and retrieved passages, and an application re-sends most of that on every turn. A document longer than the limit is cut or summarized by the application before the model sees it, so the product design decides what was read. Token counts differ by tokenizer, so a usage figure means something only next to the model it was measured on.',
  ask: [
    'Which tokenizer does this model use, and how do we count tokens for our own documents before we send them?',
    'What counts as input on each call, and how much of it is sent again on every turn?',
    'When a document exceeds the limit, does the product stop, cut the document, or summarize it, and does the user see that it happened?',
  ],
  say: 'The model never sees our words. It sees numbered pieces called tokens, and every limit and every price is counted in those pieces. Common words are one piece each, and names, numbers, and other languages take more.',
  checks: [
    { q: 'A contract runs 20,000 words. Why is that a poor estimate of its token count?', a: 'Tokens are pieces of words. Common words take one token, while names, defined terms, numbers, and citations take several. The count is usually higher than the word count, and the tokenizer for the specific model gives the exact figure.' },
    { q: 'A vendor reports one million tokens of usage on one model. You move the same workload to a different model family. Is it still one million tokens?', a: 'Only if both models use the same tokenizer. A different tokenizer cuts the same text differently, so the count, the bill, and the fit inside the limit can all change.' },
    { q: 'A document has been tokenized into numbers. Has it been anonymized?', a: 'No. The table that maps numbers to pieces is fixed, and for many models it is public. Decoding returns the exact original text. A list of token numbers is the document in another form.' },
  ],
};

// ---------- the real tokenizer: public rank tables, and the merge rule written out below ----------
const VOCABS = {
  A: { file: '../vendor/gpt-tokenizer/cl100k_base.ranks.js', name: 'Vocabulary A', note: 'about 100,000 entries',
    re: /(?:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/giu },
  B: { file: '../vendor/gpt-tokenizer/r50k_base.ranks.js', name: 'Vocabulary B', note: 'about 50,000 entries, an older design',
    re: /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu },
};
const te = new TextEncoder();
const bkey = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s; };
const kbytes = (k) => Uint8Array.from(k, (c) => c.charCodeAt(0));
const cache = {};
function loadVocab(id) {
  return (cache[id] ??= import(VOCABS[id].file).then((m) => {
    const ranks = m.default, map = new Map();
    for (let r = 0; r < ranks.length; r++) { const v = ranks[r]; if (v !== undefined) map.set(typeof v === 'string' ? bkey(te.encode(v)) : bkey(v), r); }
    return { id, map, size: map.size, re: VOCABS[id].re };
  }));
}
// The text is first split into rough pieces (words, runs of digits, punctuation). Merges never cross a piece.
const splitPieces = (text, V) => (text.match(V.re) || []).map((p) => te.encode(p));
// Byte-pair encoding: start from single bytes, fuse the adjacent pair with the lowest rank, repeat until no pair is in the table.
function bestMerge(parts, V) { let best = Infinity, at = -1; for (let i = 0; i < parts.length - 1; i++) { const r = V.map.get(parts[i] + parts[i + 1]); if (r !== undefined && r < best) { best = r; at = i; } } return at < 0 ? null : { at, rank: best }; }
function encode(text, V) {
  const out = [];
  for (const bytes of splitPieces(text, V)) { const parts = Array.from(bytes, (b) => String.fromCharCode(b)); for (let m; (m = bestMerge(parts, V));) parts.splice(m.at, 2, parts[m.at] + parts[m.at + 1]); for (const p of parts) out.push({ key: p, id: V.map.get(p) }); }
  return out;
}
const utf8 = new TextDecoder('utf-8', { fatal: true });
const decode = (k) => { try { return utf8.decode(kbytes(k)); } catch { return null; } };
const show = (k) => { const s = decode(k); return s === null ? Array.from(kbytes(k), (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') : s.replace(/ /g, '·'); };

const MAXCH = 72, MAXBYTES = 110;
const PRESETS = [
  { id: 'contract', label: 'Contract sentence', text: 'Either party may terminate on ninety days written notice.' },
  { id: 'name', label: 'Rare surname', text: 'The buyer is Quillfeather-Brzezny.' },
  { id: 'word', label: 'Long legal words', text: 'indemnification and subrogation' },
  { id: 'number', label: 'Money and a date', text: 'USD 1,250,000.00 due 14 March 2027' },
  { id: 'french', label: 'Another language', text: 'La résiliation prend effet après quatre-vingt-dix jours.' },
];
// Illustrative figures for the gauge. Real limits and prices vary by vendor, model, and contract.
const PAGE_WORDS = 500, PAGES = 40, WINDOW = 128000, PRICE_PER_M = 3;

export function createStop(ctx) {
  const stop = stopByN(1);
  const { scene, key } = baseScene({ fogNear: 26, fogFar: 70, shadow: 14, keyPos: [5, 15, 9] });
  key.target.position.set(0, 0, -1); scene.add(key.target);
  const camera = makeCamera(36);
  const controls = makeControls(camera, ctx.canvas, { minDist: 4, maxDist: 52, maxPolar: 1.35, target: new THREE.Vector3(0, 0.3, -0.6) });
  const world = new THREE.Group(); scene.add(world);
  const TW = 0.5, TD = 0.8, TH = 0.1, RZ = 1.3, GAP = 0.07, CELL = 96, CH = 144;
  let alive = true, userMoved = false, first = true, gen = 0, busy = false, cap = 28, portrait = false, baseD = 16, lastFrame = null;
  controls.addEventListener('start', () => { userMoved = true; });
  const st = { text: '', vid: 'A', V: null, pieces: [], blocks: [], done: false, flipped: false, merges: 0, counts: { A: null, B: null }, tokensA: [], tokensB: [], sent: 0 };

  // ---------- the table ----------
  const mat = block(1, 0.05, 1, { color: 0x24211d, edges: false, cast: false }); world.add(mat);
  const rowGlow = [], glowGeo = new THREE.PlaneGeometry(1, 1), glowSrc = halo(PAL.ember, 1), glowMap = glowSrc.material.map; // light pooled on the table under your text
  const intake = new THREE.Group(); world.add(intake);
  { const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf);
    const wall = block(4.6, 1.9, 0.9, { mat: P2 }); intake.add(wall);
    const lip = block(5.0, 0.16, 1.2, { mat: P1 }); lip.position.y = 1.9; intake.add(lip);
    [-1.9, 1.9].forEach((x) => { const c = block(0.3, 2.6, 0.3, { mat: P1 }); c.position.set(x, 2.06, -0.2); intake.add(c); });
    const slot = block(3.2, 0.26, 0.06, { mat: paper(0x14110e), edges: false, cast: false }); slot.position.set(0, 0.92, 0.45); intake.add(slot);
    const sg = halo(PAL.ember, 3.4); sg.position.set(0, 1.05, 0.6); sg.material.opacity = 0; sg.material.depthTest = false; intake.add(sg); intake.userData.glow = sg; }
  const intakeTag = ctx.tags.add(h('div', { class: 'looptag s1-intake' }, h('b', {}, 'To the model'), h('span', {}, 'Numbers only')), () => _t.set(0, 3.0, intake.position.z));
  const _t = new THREE.Vector3();
  const sideMat = paper(PAL.paper);
  const beads = new Set();

  // ---------- tile faces drawn on canvas ----------
  const FONT = '"Plex Mono", ui-monospace, Menlo, monospace';
  function faceTop(k) {
    const bytes = kbytes(k), n = bytes.length, c = document.createElement('canvas'); c.width = n * CELL; c.height = CH;
    const x = c.getContext('2d'); x.fillStyle = n > 1 ? '#f2ebdb' : '#e6dfce'; x.fillRect(0, 0, c.width, c.height);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const s = decode(k);
    if (s !== null) {
      let cell = 0;
      for (const chr of s) { const w = te.encode(chr).length, cx = (cell + w / 2) * CELL; cell += w;
        if (chr === ' ') { x.fillStyle = '#a89f8a'; x.font = `500 60px ${FONT}`; x.fillText('·', cx, CH / 2); }
        else { x.fillStyle = '#1a1815'; x.font = `500 ${w > 1 ? 84 : 86}px ${FONT}`; x.fillText(chr, cx, CH / 2 + 4); } }
    } else {
      bytes.forEach((b, i) => { const cx = (i + 0.5) * CELL;
        if (b >= 0x21 && b < 0x7f) { x.fillStyle = '#1a1815'; x.font = `500 86px ${FONT}`; x.fillText(String.fromCharCode(b), cx, CH / 2 + 4); }
        else if (b === 0x20) { x.fillStyle = '#a89f8a'; x.font = `500 60px ${FONT}`; x.fillText('·', cx, CH / 2); }
        else { x.fillStyle = '#8a4a00'; x.font = `500 44px ${FONT}`; x.fillText(b.toString(16).toUpperCase().padStart(2, '0'), cx, CH / 2 + 2); } });
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function faceNum(k, id) {
    const n = k.length, c = document.createElement('canvas'); c.width = n * CELL; c.height = CH;
    const x = c.getContext('2d'); x.fillStyle = '#16130f'; x.fillRect(0, 0, c.width, c.height);
    const txt = String(id); let fs = 78; x.font = `500 ${fs}px ${FONT}`;
    const room = c.width - 14; const w = x.measureText(txt).width; if (w > room) { fs = Math.max(26, Math.floor((fs * room) / w)); x.font = `500 ${fs}px ${FONT}`; }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffa62b'; x.fillText(txt, c.width / 2, CH / 2 + 3);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }

  // ---------- blocks ----------
  function makeBlock(pi, off, k, fresh) {
    const n = k.length, w = n * TW - GAP, th = n > 1 ? TH * 1.8 : TH;
    const geo = new THREE.BoxGeometry(w, th, TD);
    const top = paper(0xffffff, { map: faceTop(k) }); top.emissive = new THREE.Color(0xff9a1f); top.emissiveIntensity = 0;
    const bot = new THREE.MeshBasicMaterial({ map: faceNum(k, st.V.map.get(k)), toneMapped: false });
    const mesh = new THREE.Mesh(geo, [sideMat, sideMat, top, bot, sideMat, sideMat]); mesh.castShadow = true; mesh.receiveShadow = true; addEdges(mesh);
    world.add(mesh);
    const b = { pi, off, n, key: k, id: st.V.map.get(k), mesh, top, bot, th, tx: 0, tz: 0, pop: fresh ? 1 : 0, rot: 0, lift: 0 };
    return b;
  }
  function killBlock(b) { world.remove(b.mesh); b.mesh.geometry.dispose(); b.top.map.dispose(); b.top.dispose(); b.bot.map.dispose(); b.bot.dispose(); b.mesh.children.forEach((c) => c.geometry && c.geometry.dispose()); }
  function clearBlocks() { st.blocks.forEach(killBlock); st.blocks = []; [...beads].forEach((b) => { world.remove(b); beads.delete(b); }); }

  // rows wrap at piece boundaries, because merges never cross a piece
  function layout(snap) {
    let row = 0, col = 0; const rows = [0];
    st.pieces.forEach((p) => { if (col > 0 && col + p.n > cap) { row++; col = 0; rows.push(0); } p.row = row; p.col = col; col += p.n; rows[row] = col; });
    const R = rows.length, SP = st.done ? 0.2 : 0;
    const perRow = rows.map(() => []); st.blocks.forEach((b) => perRow[st.pieces[b.pi].row].push(b));
    const maxW = Math.max(2, ...rows.map((n, r) => n * TW + Math.max(0, perRow[r].length - 1) * SP));
    perRow.forEach((bs, r) => { const w = rows[r] * TW, m = bs.length; bs.forEach((b, i) => { const p = st.pieces[b.pi]; b.tx = -w / 2 + (p.col + b.off + b.n / 2) * TW + (i - (m - 1) / 2) * SP; b.tz = (r - (R - 1) / 2) * RZ; if (snap) b.mesh.position.set(b.tx, b.th / 2 + 0.05, b.tz); }); });
    const depth = R * RZ;
    mat.scale.set(Math.max(maxW + 2, 6.4), 1, depth + 0.9); mat.position.set(0, 0, 0);
    intake.position.set(0, 0, -depth / 2 - 2.3);
    while (rowGlow.length < R) { const g = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowMap, color: PAL.ember, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); g.rotation.x = -Math.PI / 2; world.add(g); rowGlow.push(g); }
    rowGlow.forEach((g, r) => { g.visible = r < R && st.blocks.length > 0; if (g.visible) { g.position.set(0, 0.058, (r - (R - 1) / 2) * RZ); g.scale.set(rows[r] * TW + 3.4, 2.5, 1); } });
    st.rows = R; st.maxW = maxW; fit();
  }

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption', role: 'status' });
  const say = (html) => { caption.innerHTML = html || ''; };
  const input = h('input', { class: 's1-input', type: 'text', id: 's1-text', maxlength: String(MAXCH), spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-describedby': 's1-text-note',
    oninput: () => { setText(input.value, true); }, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); guard(() => cut()); } } });
  const chips = h('div', { class: 's1-chips', role: 'group', 'aria-label': 'Example texts, all invented' }, PRESETS.map((p) => h('button', { class: 'btn sm ghost', type: 'button', onclick: () => guard(async () => { await setText(p.text); await cut(); }) }, p.label)));
  const cutBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guard(() => cut()) }, 'Cut into tokens');
  const stepBtn = h('button', { class: 'btn', type: 'button', onclick: () => guard(() => stepOnce()) }, 'One merge');
  const flipBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', onclick: () => guard(() => flip(!st.flipped)) }, 'Flip to numbers');
  const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => guard(() => setText(st.text)) }, 'Uncut');
  const segIn = {};
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Tokenizer vocabulary' }, Object.entries(VOCABS).map(([k, v]) => { segIn[k] = h('input', { type: 'radio', name: 's1-vocab', value: k, checked: k === 'A', onchange: () => guard(() => setVocab(k)) }); return h('label', {}, segIn[k], h('span', {}, v.name)); }));
  const nCh = h('b', {}, '0'), nW = h('b', {}, '0'), nTok = h('b', {}, '0');
  const tokLabel = h('span', {}, 'Tokens · vocabulary A');
  const otherLine = h('p', { class: 's1-other' });
  const ratioLine = h('p', { class: 's1-ratio' });
  const mergeLog = h('ol', { class: 's1-log', 'aria-label': 'Merge log' });
  const mergeCount = h('span', { class: 'cap' }, '0 merges');
  const idsEl = h('p', { class: 's1-ids' }, 'Cut the strip and flip it. The numbers appear here as they go up.');
  const idsCap = h('span', { class: 'cap' }, '');
  const gPage = h('dd', {}), gWin = h('dd', {}), gCost = h('dd', {}), gBar = h('i');
  const gauge = h('div', { class: 'plate s1-gauge' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Limits and bills count these pieces'), h('span', { class: 'cap' }, 'Illustrative')),
    h('div', { class: 'plate-b' }, h('dl', {},
      h('dt', {}, `A ${PAGES}-page agreement at this text's ratio`), gPage,
      h('dt', {}, `Share of a ${WINDOW.toLocaleString()}-token window`), gWin, h('div', { class: 'meter' }, gBar),
      h('dt', {}, `Input cost per call at $${PRICE_PER_M} per million tokens`), gCost),
      h('p', { class: 'invented' }, `Illustrative figures: ${PAGE_WORDS} words per page, a ${WINDOW.toLocaleString()}-token window, $${PRICE_PER_M} per million input tokens. Real limits and prices vary by vendor, model, and contract.`)));
  const ui = h('section', { class: 'stop s1', 'aria-label': 'Stop 1, Tokens' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 01 · The ground floor of the tower'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' },
        h('span', {}, h('b', {}, 'Real'), 'The tokenizer. Two public vocabularies run in your browser, and every merge follows the true rule: fuse the adjacent pair with the best rank.'),
        h('span', {}, h('b', {}, 'Simplified'), `Text is capped at ${MAXCH} characters to fit the table. Special control tokens are left out.`),
        h('span', {}, h('b', {}, 'Scripted'), 'The example sentences, all invented. The window and price in the gauge are illustrative.')),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Counted live'), h('span', { class: 'cap' }, 'Your text')),
        h('div', { class: 'tally s1-tally' }, h('div', {}, nCh, h('span', {}, 'Characters')), h('div', {}, nW, h('span', {}, 'Words')), h('div', { class: 'out' }, nTok, tokLabel)),
        h('div', { class: 'plate-b' }, ratioLine, otherLine)),
      h('div', { class: 'plate' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Merge log · lowest rank wins'), mergeCount), h('div', { class: 'plate-b' }, mergeLog)),
      gauge),
    h('div', { class: 'float-br' }, h('div', { class: 'plate s1-recv' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'What the model receives'), idsCap), h('div', { class: 'plate-b' }, idsEl))),
    h('div', { class: 'deck plate' },
      h('div', { class: 'grp col s1-textgrp' }, h('label', { class: 'cap', for: 's1-text' }, 'Your text · type your own · examples are invented'), input, chips),
      h('div', { class: 'grp' }, cutBtn, stepBtn, flipBtn, resetBtn),
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'Tokenizer'), seg)),
    h('p', { class: 'sr', id: 's1-text-note' }, `Up to ${MAXCH} characters. Press Enter to cut the text into tokens.`));
  ctx.hud.append(ui, caption);

  function renderCounts() {
    const chars = [...st.text].length, words = st.text.trim() ? st.text.trim().split(/\s+/).length : 0;
    const cur = st.counts[st.vid], oth = st.vid === 'A' ? 'B' : 'A', other = st.counts[oth];
    nCh.textContent = String(chars); nW.textContent = String(words); nTok.textContent = cur == null ? '…' : String(cur);
    tokLabel.textContent = `Tokens · vocabulary ${st.vid}`;
    otherLine.textContent = other == null ? '' : other === cur ? `${VOCABS[oth].name} (${VOCABS[oth].note}) also counts ${other} for this text.` : `${VOCABS[oth].name} (${VOCABS[oth].note}) counts ${other} for the same text.`;
    const ok = cur != null && words > 0, r = ok ? cur / words : 0;
    ratioLine.textContent = ok ? `${r.toFixed(2)} tokens per word in this text.` : 'Type a sentence to count it.';
    const est = Math.round(PAGES * PAGE_WORDS * r);
    gPage.textContent = ok ? `about ${est.toLocaleString()} tokens` : 'no text yet';
    gWin.textContent = ok ? `${Math.min(999, (est / WINDOW) * 100).toFixed(0)}%${est > WINDOW ? ', so it does not fit in one call' : ''}` : '';
    gBar.style.width = ok ? `${Math.min(100, (est / WINDOW) * 100)}%` : '0%'; gBar.classList.toggle('over', est > WINDOW);
    gCost.textContent = ok ? `about $${((est / 1e6) * PRICE_PER_M).toFixed(2)}, and again on every turn that re-sends it` : '';
  }
  function logMerge(a, b, rank) {
    st.merges++; mergeCount.textContent = `${st.merges} merge${st.merges === 1 ? '' : 's'}`;
    mergeLog.append(h('li', {}, h('span', { class: 'a' }, show(a)), h('span', { class: 'plus' }, '+'), h('span', { class: 'a' }, show(b)), h('span', { class: 'arrow' }, '→'), h('span', { class: 'm' }, show(a + b)), h('span', { class: 'r' }, `rank ${rank.toLocaleString()}`)));
    while (mergeLog.children.length > 40) mergeLog.firstChild.remove();
    mergeLog.scrollTop = mergeLog.scrollHeight;
  }
  function renderIds() {
    const toks = st.blocks;
    if (!st.flipped) { idsEl.classList.remove('lit'); idsCap.textContent = ''; idsEl.textContent = st.done ? 'The strip is cut. Flip it to see what goes up.' : 'Cut the strip and flip it. The numbers appear here as they go up.'; return; }
    idsEl.classList.add('lit'); idsCap.textContent = `${toks.length} numbers`;
    idsEl.replaceChildren('[', ...toks.slice(0, st.sent).flatMap((b, i) => [i ? ', ' : '', h('span', { title: show(b.key) }, String(b.id))]), st.sent >= toks.length ? ']' : ' …');
  }

  // ---------- state changes ----------
  async function ensureVocab() { if (!st.V || st.V.id !== st.vid) { say('Loading the vocabulary…'); st.V = await loadVocab(st.vid); if (alive) say(''); } return st.V; }
  async function setText(text, fromTyping) {
    const g = ++gen;
    text = [...String(text)].slice(0, MAXCH).join(''); while (te.encode(text).length > MAXBYTES) text = [...text].slice(0, -1).join('');
    st.text = text; if (!fromTyping || input.value !== text) input.value = text;
    if (!fromTyping) userMoved = false;
    await ensureVocab(); if (!alive || g !== gen) return;
    clearBlocks(); st.done = false; st.flipped = false; st.merges = 0; st.sent = 0; mergeLog.replaceChildren(); mergeCount.textContent = '0 merges';
    flipBtn.setAttribute('aria-pressed', 'false'); flipBtn.textContent = 'Flip to numbers'; intake.userData.glow.material.opacity = 0;
    st.pieces = splitPieces(text, st.V).map((bytes) => ({ n: bytes.length, bytes }));
    st.pieces.forEach((p, pi) => { p.bytes.forEach((b, off) => st.blocks.push(makeBlock(pi, off, String.fromCharCode(b), false))); });
    st.counts[st.vid] = encode(text, st.V).length; const oth = st.vid === 'A' ? 'B' : 'A'; st.counts[oth] = null;
    layout(true); renderCounts(); renderIds(); if (!fromTyping) say('');
    if (first) { first = false; camera.position.copy(wantP); controls.target.copy(wantT); controls.update(); }
    loadVocab(oth).then((O) => { if (alive && g === gen) { st.counts[oth] = encode(text, O).length; renderCounts(); } });
  }
  // The next real merge: the adjacent pair, inside one piece, whose fusion has the lowest rank in the table.
  function nextMerge() {
    let best = Infinity, at = -1;
    for (let i = 0; i < st.blocks.length - 1; i++) { const a = st.blocks[i], b = st.blocks[i + 1]; if (a.pi !== b.pi) continue; const r = st.V.map.get(a.key + b.key); if (r !== undefined && r < best) { best = r; at = i; } }
    return at < 0 ? null : { at, rank: best };
  }
  function applyMerge(m, animated) {
    const a = st.blocks[m.at], b = st.blocks[m.at + 1];
    const nb = makeBlock(a.pi, a.off, a.key + b.key, animated);
    logMerge(a.key, b.key, m.rank);
    killBlock(a); killBlock(b); st.blocks.splice(m.at, 2, nb);
    layout(false); nb.mesh.position.set(nb.tx, nb.th / 2 + 0.05, nb.tz);
    return nb;
  }
  function finish() {
    st.done = true; layout(false); renderIds();
    ctx.announce(`${st.blocks.length} tokens: ${st.blocks.map((b) => show(b.key)).join(' | ')}`);
  }
  async function stepOnce() {
    if (st.done || !st.blocks.length) { if (st.done) say('<b>No pair left in the table.</b> The pieces on the strip are the tokens.'); return; }
    const m = nextMerge();
    if (!m) { finish(); say(`<b>No pair left in the table.</b> ${st.blocks.length} tokens.`); return; }
    const a = st.blocks[m.at], b = st.blocks[m.at + 1];
    say(`Of every adjacent pair, <b>"${esc(show(a.key))}" + "${esc(show(b.key))}"</b> has the best rank (${m.rank.toLocaleString()}). They fuse.`);
    applyMerge(m, true); await wait(0.34);
    if (alive && !nextMerge()) { finish(); say(`<b>No pair left in the table.</b> The strip is cut into ${st.blocks.length} tokens.`); }
  }
  async function cut(fast) {
    const g = gen; if (!st.blocks.length) { say('Type something on the strip first.'); return; }
    if (st.flipped) await flip(false);
    if (st.done) { say(`<b>${st.blocks.length} tokens.</b> Press Uncut to watch the merges again.`); return; }
    if (!fast) say('Start from single bytes. <b>Fuse the adjacent pair with the best rank.</b> Look again. Repeat.');
    let i = 0;
    for (let m; alive && g === gen && (m = nextMerge()); i++) {
      const slow = !fast && !motion.reduced && i < 60;
      applyMerge(m, slow);
      if (slow) await wait(i < 5 ? 0.3 : i < 12 ? 0.14 : i < 28 ? 0.06 : 0.025);
    }
    if (!alive || g !== gen) return;
    finish();
    const words = st.text.trim().split(/\s+/).length;
    if (!fast) say(`<b>${words} word${words === 1 ? '' : 's'} became ${st.blocks.length} tokens</b> in ${st.merges} merges. Each piece left on the strip is one row in the model's table.`);
    await wait(0.5);
  }
  async function flip(on) {
    const g = gen; if (!st.blocks.length) return;
    if (on && !st.done) await cut(true); if (!alive || g !== gen) return;
    st.flipped = on; flipBtn.setAttribute('aria-pressed', String(on)); flipBtn.textContent = on ? 'Flip back to letters' : 'Flip to numbers';
    st.sent = 0; renderIds();
    const n = st.blocks.length, stagger = Math.min(0.045, 1.1 / n);
    rowGlow.forEach((gl) => { gl.material.opacity = on ? 0.55 : 0.3; });
    await Promise.all(st.blocks.map((b, i) => tween({ dur: 0.5, delay: i * stagger, update: (k) => { b.rot = on ? k : 1 - k; b.lift = Math.sin(k * Math.PI) * 0.62; } })));
    if (!alive || g !== gen) return;
    if (!on) { intake.userData.glow.material.opacity = 0; say('<b>The exact text is back.</b> Nothing was lost, so a list of token numbers is still the document.'); return; }
    say('<b>The letters are gone.</b> Each token is now its row number in the table. Only these go up.');
    // the numbers leave for the model, one bead per token
    const slotP = new THREE.Vector3(0, 1.0, intake.position.z + 0.5), gap = Math.min(0.09, 1.6 / n);
    await Promise.all(st.blocks.map((b, i) => (async () => {
      await wait(i * gap); if (!alive || g !== gen) return;
      const bead = emberBead(0.07, PAL.ember, 0.8); world.add(bead); beads.add(bead);
      const from = new THREE.Vector3(b.tx, 0.3, b.tz);
      await tween({ dur: 0.7, e: ease.io, update: (k) => { bead.position.lerpVectors(from, slotP, k); bead.position.y += Math.sin(k * Math.PI) * 1.5; } });
      world.remove(bead); beads.delete(bead);
      if (!alive || g !== gen) return;
      st.sent = Math.max(st.sent, i + 1); renderIds(); intake.userData.glow.material.opacity = 0.55;
    })()));
    if (!alive || g !== gen) return;
    st.sent = n; renderIds();
    ctx.announce(`The model receives ${n} numbers: ${st.blocks.map((b) => b.id).join(', ')}`);
  }
  async function setVocab(k) {
    const wasDone = st.done, text = st.text; st.vid = k; segIn[k].checked = true;
    await setText(text); if (wasDone) await cut(true);
    renderCounts();
  }
  async function guard(fn) { if (busy) { gen++; } busy = true; try { await fn(); } finally { busy = false; } }

  // ---------- demonstrations called from the brief ----------
  const demos = {
    word: () => guard(async () => {
      if (st.vid !== 'A') { st.vid = 'A'; segIn.A.checked = true; }
      await setText(PRESETS[1].text); const g = gen; await cut(); if (!alive || g !== gen) return;
      const whole = st.blocks.filter((b) => ['The', '·buyer', '·is'].includes(show(b.key))).length;
      say(`<b>4 words became ${st.blocks.length} tokens.</b> "The", "buyer", and "is" took ${whole} between them. The invented surname shattered into ${st.blocks.length - whole - 1} pieces.`);
    }),
    numbers: () => guard(async () => {
      if (!st.blocks.length) await setText(PRESETS[0].text);
      const g = gen; if (st.flipped) await flip(false); await flip(true); if (!alive || g !== gen) return;
      say('<b>This row of numbers is everything the model receives.</b> No letters go up. Flip back and the exact text returns.');
    }),
    vocab: () => guard(async () => {
      st.vid = 'A'; segIn.A.checked = true; await setText(PRESETS[4].text); let g = gen; await cut(true); if (!alive || g !== gen) return;
      const a = st.blocks.length; say(`Vocabulary A cuts this French sentence into <b>${a} tokens</b>. Now the same sentence with vocabulary B.`);
      await wait(1.6); if (!alive || g !== gen) return;
      st.vid = 'B'; segIn.B.checked = true; await setText(PRESETS[4].text); g = gen; await cut(true); if (!alive || g !== gen) return;
      say(`<b>Same sentence. ${a} tokens in vocabulary A. ${st.blocks.length} in vocabulary B.</b> A limit or a bill in tokens depends on which tokenizer did the counting.`);
    }),
  };
  const beats = [
    { title: 'A sentence, one tile per byte', note: 'Computers store text as bytes. Plain English letters take one byte each, so this strip starts with one tile per character.', run: () => guard(async () => { if (st.vid !== 'A') { st.vid = 'A'; segIn.A.checked = true; } await setText(PRESETS[0].text); say('An invented contract sentence, laid out as single bytes. <b>Nothing has been cut yet.</b>'); }) },
    { title: 'Tiles fuse, best rank first', note: 'The tokenizer fuses the adjacent pair with the best rank in its table, then looks again. Watch the merge log on the left.', run: () => guard(async () => { if (st.vid !== 'A') { st.vid = 'A'; segIn.A.checked = true; } await setText(PRESETS[0].text); const g = gen; for (let i = 0; i < 6 && alive && g === gen; i++) await stepOnce(); }) },
    { title: 'The strip ends up cut into tokens', note: 'When no pair is left in the table, the pieces that remain are the tokens. Every common word here came out whole.', run: () => guard(async () => { if (!st.blocks.length || st.text !== PRESETS[0].text) await setText(PRESETS[0].text); await cut(); }) },
    { title: 'A rare name shatters', note: 'The table has no entry for an unusual surname, so it is spelled out of fragments. Four words cost many more than four tokens.', run: () => demos.word() },
    { title: 'Flip: the model receives numbers', note: 'Each token is replaced by its row number. The numbers are the whole input, and they decode back to the exact text.', run: () => demos.numbers() },
    { title: 'Another tokenizer, another count', note: 'Every model family has its own table. The same sentence takes a different number of tokens, so limits and bills depend on the model.', run: () => demos.vocab() },
    { title: 'Limits and bills count these pieces', note: 'The gauge scales this text up to a 40-page agreement. The window and the price are illustrative. The token ratio is real.', run: () => guard(async () => { st.vid = 'A'; segIn.A.checked = true; await setText(PRESETS[0].text); const g = gen; await cut(true); if (!alive || g !== gen) return; gauge.classList.add('s1-hot'); gauge.scrollIntoView({ block: 'nearest' }); say('<b>Context limits and prices are counted in tokens.</b> A long document can fill the window on its own, and it is billed again each time it is re-sent.'); await wait(2.4); gauge.classList.remove('s1-hot'); }) },
  ];

  // ---------- view interface ----------
  const wantT = new THREE.Vector3(), wantP = new THREE.Vector3();
  function fit() {
    if (!lastFrame) return;
    const { H, freeW, freeH } = lastFrame, tan = Math.tan((camera.fov * Math.PI) / 360);
    const depth = (st.rows || 1) * RZ + 3.6, el = portrait ? 1.02 : 0.9;
    const sizeX = Math.max(portrait ? 6.6 : 8, (st.maxW || 8) + (portrait ? 0.9 : 2)), sizeY = depth * Math.sin(el) + 3.0 * Math.cos(el) + 0.8;
    baseD = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    wantT.set(0, 0.5, -1.25);
    wantP.set(wantT.x, wantT.y + baseD * Math.sin(el), wantT.z + baseD * Math.cos(el));
    if (!userMoved && motion.reduced) { camera.position.copy(wantP); controls.target.copy(wantT); }
  }
  function frame(f) {
    lastFrame = f; const wasCap = cap; portrait = f.freeW < 500; // a phone-width stage: fewer tiles per row, so each tile is larger
    cap = portrait ? 12 : f.freeW < 700 ? 20 : 28;
    if (cap !== wasCap && st.blocks.length) layout(true); else fit();
    if (!userMoved) { camera.position.copy(wantP); controls.target.copy(wantT); controls.update(); }
  }
  function update(dt) {
    const k = motion.reduced ? 1 : Math.min(1, dt * 10);
    if (!userMoved) { const c = motion.reduced ? 1 : Math.min(1, dt * 2.4); camera.position.lerp(wantP, c); controls.target.lerp(wantT, c); }
    for (const b of st.blocks) {
      const m = b.mesh; m.position.x = lerp(m.position.x, b.tx, k); m.position.z = lerp(m.position.z, b.tz, k);
      if (b.pop > 0) { b.pop = Math.max(0, b.pop - dt * 3.2); b.top.emissiveIntensity = b.pop * 0.85; m.scale.y = 1 + ease.in(b.pop) * 2.2; }
      m.position.y = (b.th * m.scale.y) / 2 + 0.05 + b.lift; m.rotation.x = b.rot * Math.PI;
    }
  }
  function textAlt() {
    const toks = st.V ? encode(st.text, st.V) : [];
    return `<p>The model is a cutting table. Your sentence lies on it as a strip of paper tiles, one tile for each byte of the text. A plain English letter is one byte. Accented letters and other scripts take two to four bytes each.</p>
    <p>The tokenizer holds a fixed table of pieces, each with a rank. It looks at every adjacent pair of tiles, finds the pair whose fusion has the best rank in the table, and fuses that pair into one block. It repeats until no adjacent pair is in the table. The blocks that remain are the tokens. Common words end as one block. A rare surname ends as several fragments.</p>
    <p>Each token then flips over to show its row number in the table, and only the numbers travel up into the model. Flipping back returns the exact text, because the step loses nothing.</p>
    <h3>Your text</h3><p>${esc(st.text) || '(empty)'}</p>
    <h3>Counts</h3><table><tr><th>Characters</th><th>Words</th><th>Tokens, vocabulary A</th><th>Tokens, vocabulary B</th></tr><tr><td>${[...st.text].length}</td><td>${st.text.trim() ? st.text.trim().split(/\s+/).length : 0}</td><td>${st.counts.A ?? 'not counted yet'}</td><td>${st.counts.B ?? 'not counted yet'}</td></tr></table>
    <h3>Tokens under vocabulary ${st.vid}</h3>${toks.length ? `<table><tr><th>Piece (a middle dot marks a space)</th><th>Number the model receives</th></tr>${toks.map((t) => `<tr><td>${esc(show(t.key))}</td><td>${t.id}</td></tr>`).join('')}</table>` : '<p>No text.</p>'}
    <h3>What it costs</h3><p>${esc(gPage.textContent ? `A ${PAGES}-page agreement at this text's ratio: ${gPage.textContent}. Share of a ${WINDOW.toLocaleString()}-token window: ${gWin.textContent}. Input cost per call: ${gCost.textContent}.` : 'Type a sentence to see the estimate.')} These window and price figures are illustrative. Real limits and prices vary by vendor, model, and contract.</p>
    <p>Real: both tokenizers and every merge. Simplified: the text is capped at ${MAXCH} characters and special control tokens are left out. Scripted: the example sentences, which are invented.</p>`;
  }

  // start
  (async () => {
    try { await document.fonts.load('500 86px "Plex Mono"'); } catch { /* the fallback font is fine */ }
    if (!alive) return;
    await setText(PRESETS[0].text);
  })();

  return { scene, camera, controls, update, frame, textAlt, demos, beats, dispose() { alive = false; gen++; clearBlocks(); glowSrc.material.dispose(); } };
}
