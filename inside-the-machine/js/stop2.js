// Stop 2. Embeddings: the room of meaning. Words are beads placed by computed vectors.
// A memo is embedded as lit points, its file is deleted, and the points stay.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, cyl, paper, glow, halo, emberBead, tween, wait, ease, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';
import { WORDS, DIM, A_SIF, SENTENCES, SAMPLE } from './data-stop2.js';

export const BRIEF = {
  define: 'An embedding is a list of numbers that places a piece of text at a point in a space, so that texts used in similar ways land near each other. A vector store is a database of those points, usually kept with the text they came from, that a system searches by nearness.',
  misconceptions: [
    { wrong: 'An embedding is an anonymous number that says nothing about the document.', right: 'The numbers are computed from the text and carry its subject matter. Nearness alone shows what a passage is about, and researchers have shown that short passages can be largely reconstructed from their embeddings by someone with access to the embedding model. Treat an embedding as a derived copy of the text.', demo: 'reveal', demoLabel: 'Read a vector without its text' },
    { wrong: 'Deleting the file deletes it from the AI system.', right: 'Embedding makes copies. The vector store keeps a point for each chunk of the document, usually with the chunk text beside it, until someone deletes them there too. Indexes, caches, and backups can hold further copies.', demo: 'delete', demoLabel: 'Delete the file, then ask the room' },
    { wrong: 'Close together means the same meaning.', right: 'Close means used in similar contexts. A clause and its opposite share nearly all their words and their company, so they land almost on top of each other. Nearness measures topic and phrasing, and says nothing about agreement or truth.', demo: 'near', demoLabel: 'Find the nearest passages to a question' },
  ],
  legal: 'A vector store holds derived copies of the documents fed into it, so questions of retention, deletion, access, and privilege follow the documents there. A deletion request or a retention schedule that stops at the source file leaves the embeddings, the stored chunks, the indexes, and the backups in place. Access controls on the original folder do nothing for a store that any user\'s query can search. Confidential or privileged material placed in a third party\'s vector store raises the same questions as placing the document itself there.',
  ask: [
    'When a document is deleted, what removes its chunks and embeddings from the vector store, the indexes, the caches, and the backups, and how long does that take?',
    'Is the chunk text stored beside each vector, and who can query the store?',
    'Which model creates the embeddings, where does it run, and does that provider keep the text it embeds?',
  ],
  say: 'Before our documents can be searched by meaning, they are converted into lists of numbers and kept in a separate database. Those numbers are copies of our documents in another form, so deleting, restricting, or protecting a document means doing the same to its copies there.',
  checks: [
    { q: 'A privileged memo was embedded last month and the file was deleted today. What still exists?', a: 'The points in the vector store, usually with the text of each chunk stored beside them, plus any index, cache, or backup that includes them. They stay until a separate deletion reaches them.' },
    { q: 'A search returns two passages with nearly identical similarity scores. What do you know about whether they agree?', a: 'Nothing. A clause and its negation score almost the same, because they share their words and their contexts. Someone or something still has to read the passages.' },
    { q: 'A vendor says embeddings are just numbers and sit outside the confidentiality terms. What is the answer?', a: 'The numbers are computed from the text and reveal its subject matter, and research has shown that short passages can be largely reconstructed from them. They are derived copies and belong inside the same terms as the documents.' },
  ],
};

// ---------- live math on the computed vectors ----------
const V = new Map(WORDS.map(([w, f, c, v, p]) => [w, { w, f, c, v, p }]));
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const ALIAS = { pays: 'pay', paid: 'pay', payment: 'pay', payments: 'pay', termination: 'terminate', cancellation: 'cancel', cancelled: 'cancel', canceled: 'cancel', renewal: 'renew', delivery: 'deliver', lawyer: 'counsel', lawyers: 'counsel', attorney: 'counsel', advise: 'advice', advised: 'advice', advises: 'advice', liability: 'liable', settlement: 'settle', shipment: 'ship', confidentiality: 'confidential', privilege: 'privileged', lawsuit: 'claim', sue: 'claim', sued: 'claim', contract: 'agreement', seller: 'supplier', purchaser: 'buyer', cost: 'price', costs: 'price', rainy: 'rain', stormy: 'storm' };
function lemma(w) {
  if (V.has(w)) return w; if (ALIAS[w]) return ALIAS[w];
  for (const [suf, add] of [['s', ''], ['es', ''], ['ed', ''], ['ed', 'e'], ['d', ''], ['ing', ''], ['ing', 'e'], ['ion', 'e'], ['ation', ''], ['ation', 'e'], ['ment', ''], ['al', ''], ['ly', '']]) if (w.length > suf.length + 2 && w.endsWith(suf)) { const c = w.slice(0, -suf.length) + add; if (V.has(c)) return c; }
  return null;
}
// A passage is embedded as a weighted average of its words' vectors. Frequent words count for less.
function embed(text) {
  const known = [], unknown = [], v = new Array(DIM).fill(0);
  for (const raw of text.toLowerCase().split(/[^a-z]+/).filter(Boolean)) { const l = lemma(raw); if (!l) { if (!unknown.includes(raw)) unknown.push(raw); continue; } known.push(l); const e = V.get(l), wt = A_SIF / (A_SIF + e.f); for (let d = 0; d < DIM; d++) v[d] += e.v[d] * wt; }
  return { v: unit(v), known, unknown };
}
const SHOWN = [...V.values()].filter((e) => e.p);
// A new point is placed among its nearest words, weighted by similarity.
function place(v) { const nn = SHOWN.map((e) => [e, cos(v, e.v)]).sort((a, b) => b[1] - a[1]).slice(0, 5); let W = 0; const p = [0, 0, 0]; for (const [e, s] of nn) { const w = Math.pow(Math.max(0, s), 8) + 1e-6; W += w; for (let i = 0; i < 3; i++) p[i] += e.p[i] * w; } return p.map((x) => x / W); }

const ZONES = { ending: 'Ending and renewing', money: 'Money', secrecy: 'Secrecy and advice', goods: 'Goods and carriage', dispute: 'Disputes', weather: 'Weather', kitchen: 'Kitchen' };
const CLAUSES = [
  'The buyer may cancel this agreement early.', 'The buyer may not cancel this agreement early.', 'The agreement will renew on the anniversary date unless a party gives notice.',
  'The buyer must pay each invoice within thirty days.', 'A late invoice will bear interest at the agreed rate.', 'The carrier will deliver the sealed cargo to the warehouse.',
  'The buyer may inspect the goods at the warehouse.', 'The supplier is liable for damages after a breach.', 'The parties agreed to settle the dispute out of court.', 'Each party must keep the terms confidential and must not disclose it.',
];
const MEMO = [
  'Privileged and confidential. Advice from counsel to the buyer.',
  'Our view is that the buyer is liable for the breach, and a court may award damages.',
  'We advise the buyer to settle the claim out of court and not to disclose this memo.',
  'The supplier does not know that the carrier did not inspect the sealed cargo.',
];
const QUERIES = [
  { label: 'Cancel early?', text: 'Can the buyer cancel early?' },
  { label: 'Counsel’s advice', text: 'What did counsel advise about the claim?' },
  { label: 'Late cargo', text: 'Who must pay if the cargo is late?' },
];
const SX = 5.0, SY = 2.9, Y0 = 3.5;
const W3 = (p) => new THREE.Vector3(p[0] * SX, Y0 + p[1] * SY, p[2] * SX);
const f2 = (x) => (x >= 0.995 ? '1.00' : x.toFixed(2));

export function createStop(ctx) {
  const stop = stopByN(2);
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 78, shadow: 12, keyPos: [6, 16, 9] });
  key.target.position.set(0, 2, 2); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: new THREE.Vector3(6, 7, 18), target: new THREE.Vector3(0, 2.9, 1.2) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 5, maxDist: 55, maxPolar: 1.5, minPolar: 0.2, target: home.target });
  controls.autoRotate = !motion.reduced; controls.autoRotateSpeed = 0.45;
  const world = new THREE.Group(); scene.add(world);
  let alive = true, userMoved = false, busy = false;
  const stopSpin = () => { userMoved = true; controls.autoRotate = false; };
  controls.addEventListener('start', stopSpin);
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf);
  const st = { sel: null, memo: 'file', query: null }; // memo: file | embedded | orphaned | gone

  // ---------- the room ----------
  const floor = cyl(6.5, 0.12, { color: 0x38332d, seg: 72 }); world.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.05, 8, 96), P1); rim.rotation.x = Math.PI / 2; rim.position.y = 0.14; world.add(rim);
  [2.2, 4.4].forEach((r) => { const c = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * r, 0.13, Math.sin((i / 96) * Math.PI * 2) * r))), new THREE.LineBasicMaterial({ color: 0x5b554b })); world.add(c); });
  // the desk where the source file lies
  const DESK = new THREE.Vector3(-5.2, 0, 7.5), DROT = -0.5;
  const desk = block(3.9, 0.42, 2.5, { mat: P2 }); desk.position.copy(DESK); desk.rotation.y = DROT; world.add(desk);
  const strips = MEMO.map((_, i) => { const m = paper(0xf3ecdb); m.emissive = new THREE.Color(0xff9a1f); m.emissiveIntensity = 0.55; m.transparent = true; const s = block(3.2, 0.05, 0.42, { mat: m, edges: false }); const dz = -0.78 + i * 0.52; s.position.set(DESK.x + Math.sin(DROT) * dz, 0.43, DESK.z + Math.cos(DROT) * dz); s.rotation.y = DROT; world.add(s); return s; });
  const deskGlow = halo(PAL.ember, 6); deskGlow.position.set(DESK.x, 0.8, DESK.z); deskGlow.material.opacity = 0.5; world.add(deskGlow);
  const deskTag = ctx.tags.add(h('div', { class: 'looptag s2-desktag' }, h('b', {}, 'Source file'), h('span', {}, 'The memo, on disk')), new THREE.Vector3(DESK.x, 1.5, DESK.z));

  // ---------- points ----------
  const items = []; // { kind, id, label, text, v, pos, mesh, tag, stalk, base }
  const sphere = new THREE.SphereGeometry(0.11, 18, 12);
  const stalkMat = new THREE.LineBasicMaterial({ color: 0x7d766a, transparent: true, opacity: 0.55 });
  function stalk(pos, mat = stalkMat) { const g = new THREE.BufferGeometry().setFromPoints([pos, new THREE.Vector3(pos.x, 0.13, pos.z)]); const l = new THREE.Line(g, mat); world.add(l); return l; }
  function addTag(it, cls, text) {
    const b = h('button', { class: `s2-tag ${cls}`, type: 'button', tabindex: '-1', onclick: () => guard(() => select(it)) }, text);
    it.tagEl = b; it.tag = ctx.tags.add(h('div', {}, b), it.pos);
  }
  SHOWN.forEach((e) => {
    const mesh = new THREE.Mesh(sphere, paper(PAL.paper)); mesh.castShadow = true;
    const it = { kind: 'word', id: 'w:' + e.w, label: e.w, text: e.w, v: e.v, pos: W3(e.p), mesh, zone: e.c };
    mesh.position.copy(it.pos); world.add(mesh); it.stalk = stalk(it.pos); addTag(it, 'word', e.w); items.push(it);
  });
  // stored passages are placed live, then nudged apart so near twins stay visible as two
  function relax(list) {
    const GAP = 0.15;
    for (let n = 0; n < 80; n++) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i].u, b = list[j].u; let dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], d = Math.hypot(dx, dy, dz);
        if (d >= GAP) continue; if (d < 1e-5) { dx = 0.6; dy = 0.2; dz = 0.77; d = 1; } const s = (GAP - d) / 2 / d; a[0] += dx * s; a[1] += dy * s; a[2] += dz * s; b[0] -= dx * s; b[1] -= dy * s; b[2] -= dz * s;
      }
      for (const it of list) for (const e of SHOWN) { // keep clear of the word beads, which stay where the layout put them
        const a = it.u; let dx = a[0] - e.p[0], dy = a[1] - e.p[1], dz = a[2] - e.p[2], d = Math.hypot(dx, dy, dz);
        if (d >= GAP * 0.8) continue; if (d < 1e-5) { dx = 0.3; dy = 0.9; dz = 0.3; d = 1; } const s = (GAP * 0.8 - d) / d; a[0] += dx * s; a[1] += dy * s; a[2] += dz * s;
      }
    }
  }
  const stored = [...CLAUSES.map((t, i) => ({ kind: 'clause', id: 'c:' + (i + 1), label: `Clause ${i + 1}`, short: `C${i + 1}`, text: t })), ...MEMO.map((t, i) => ({ kind: 'chunk', id: 'm:' + (i + 1), label: `Memo chunk ${i + 1}`, short: `M${i + 1}`, text: t }))];
  stored.forEach((it) => { const e = embed(it.text); it.v = e.v; it.unknown = e.unknown; it.u = place(e.v); });
  relax(stored);
  const sheetGeo = new THREE.BoxGeometry(0.5, 0.035, 0.34);
  stored.forEach((it) => {
    it.pos = W3(it.u);
    if (it.kind === 'clause') {
      const m = paper(PAL.paper); m.emissive = new THREE.Color(PAL.blue); m.emissiveIntensity = 0;
      it.mesh = new THREE.Mesh(sheetGeo, m); it.mesh.castShadow = true; it.mesh.rotation.set(0.25, 0.5, 0.1); it.mesh.position.copy(it.pos); world.add(it.mesh);
      it.stalk = stalk(it.pos); addTag(it, 'clause', it.short); it.inStore = true;
    } else {
      it.mesh = emberBead(0.13, PAL.ember, 1.5); it.mesh.position.copy(it.pos); it.mesh.visible = false; world.add(it.mesh);
      it.stalk = stalk(it.pos, new THREE.LineBasicMaterial({ color: PAL.ember, transparent: true, opacity: 0.6 })); it.stalk.visible = false;
      addTag(it, 'chunk', it.short); it.tag.el.style.display = 'none'; it.inStore = false;
    }
    items.push(it);
  });
  // our own signposts for the regions; the room itself has no labels
  Object.entries(ZONES).forEach(([z, name]) => { const ws = SHOWN.filter((e) => e.c === z), c = [0, 1, 2].map((i) => ws.reduce((s, e) => s + e.p[i], 0) / ws.length); const top = Math.max(...ws.map((e) => e.p[1])); ctx.tags.add(h('div', {}, h('span', { class: 'maplabel s2-zone' }, name)), W3([c[0], top + 0.2, c[2]])); });

  // query point, selection ring, threads
  const qMesh = new THREE.Group(); { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), glow(PAL.ember)); qMesh.add(o); const hl = halo(PAL.ember, 2.2); qMesh.add(hl); } qMesh.visible = false; world.add(qMesh);
  const qTag = ctx.tags.add(h('div', {}, h('span', { class: 's2-tag query' }, 'Your question')), qMesh); qTag.el.style.display = 'none';
  const ring = halo(PAL.paper, 1.3); ring.material.opacity = 0; world.add(ring);
  const threads = [];
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 8); unitCyl.translate(0, 0.5, 0);
  const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
  function clearThreads() { threads.forEach((t) => { world.remove(t); t.material.dispose(); }); threads.length = 0; }
  function thread(a, b, color, sim, lit) {
    const m = new THREE.Mesh(unitCyl, lit ? glow(color, { transparent: true, opacity: 0.95 }) : paper(color));
    _d.copy(b).sub(a); const len = _d.length(), r = 0.012 + Math.max(0, sim) * 0.026;
    m.position.copy(a); m.quaternion.setFromUnitVectors(UP, _d.normalize()); m.scale.set(r, 0.001, r); world.add(m); threads.push(m);
    tween({ dur: 0.45, e: ease.out, update: (k) => { m.scale.y = Math.max(0.001, len * k); } });
  }

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption', role: 'status' });
  const say = (html) => { caption.innerHTML = html || ''; };
  const info = h('div', { class: 'plate-b s2-info', 'aria-live': 'polite' });
  const infoCap = h('span', { class: 'cap' }, 'Nothing selected');
  const tFile = h('b', {}, '1'), tCopies = h('b', {}, '0'), tFileL = h('span', {}, 'Source file on disk'), tCopiesL = h('span', {}, 'Copies of the memo in the store');
  const memoEl = h('div', { class: 'letter s2-memo' }, h('div', { class: 's2-filecap' }, h('span', {}, 'The source file'), h('span', {}, 'Your data')), h('div', { class: 'lh' }, 'Memo from counsel', h('i', {}, 'Invented')), MEMO.map((t, i) => h('p', { 'data-i': i }, h('b', { class: 's2-n' }, String(i + 1)), t)), h('p', { class: 's2-gone' }, 'File deleted from the document system.'));
  const picker = h('select', { class: 's2-select', id: 's2-pick', onchange: (e) => { const it = items.find((x) => x.id === e.target.value); guard(() => select(it || null)); } });
  function renderPicker() {
    const grp = (label, list) => h('optgroup', { label }, list.map((it) => h('option', { value: it.id, selected: st.sel === it }, it.kind === 'word' ? it.label : `${it.label}: ${it.text.slice(0, 44)}${it.text.length > 44 ? '…' : ''}`)));
    picker.replaceChildren(h('option', { value: '' }, 'Choose a word or a stored passage'),
      grp('Words', items.filter((x) => x.kind === 'word').sort((a, b) => a.label.localeCompare(b.label))), grp('Clauses in the store', items.filter((x) => x.kind === 'clause')),
      ...(items.some((x) => x.kind === 'chunk' && x.inStore) ? [grp('Memo chunks in the store', items.filter((x) => x.kind === 'chunk' && x.inStore))] : []));
    if (!st.sel || st.sel.kind === 'query') picker.value = '';
  }
  const qInput = h('input', { class: 's2-input', type: 'text', id: 's2-q', maxlength: '80', placeholder: 'Or type a question', spellcheck: 'false', autocomplete: 'off', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); if (qInput.value.trim()) guard(() => ask(qInput.value)); } } });
  const askBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (qInput.value.trim()) guard(() => ask(qInput.value)); } }, 'Ask');
  const embedBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guard(embedMemo) }, 'Embed the memo');
  const delFileBtn = h('button', { class: 'btn', type: 'button', onclick: () => guard(deleteFile) }, 'Delete the source file');
  const delVecBtn = h('button', { class: 'btn', type: 'button', onclick: () => guard(deleteVectors) }, 'Delete the vectors too');
  const restoreBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => guard(async () => restore()) }, 'Restore');
  const ui = h('section', { class: 'stop s2', 'aria-label': 'Stop 2, Embeddings' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 02 · The second floor of the tower'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' },
        h('span', {}, h('b', {}, 'Real'), `Nobody placed the beads. Their vectors were computed from which words keep company in ${SENTENCES.toLocaleString()} invented sentences. Similarity and nearest neighbors are calculated live.`),
        h('span', {}, h('b', {}, 'Simplified'), `Each point has ${DIM} numbers and the room is a 3D layout of them. Production embeddings come from a trained neural network and have hundreds or thousands of numbers. A passage here is a weighted average of its words.`),
        h('span', {}, h('b', {}, 'Scripted'), 'The sentences, the clauses, the memo, and the preset questions. All invented.')),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Selected point'), infoCap), info),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'The vector store'), h('span', { class: 'cap' }, 'Counted live')),
        h('div', { class: 'tally s2-tally' }, h('div', {}, tFile, tFileL), h('div', { class: 'out' }, tCopies, tCopiesL), h('div', {}, h('b', {}, String(CLAUSES.length)), h('span', {}, 'Other clauses in the store'))))),
    h('div', { class: 'float-br s2-file' }, memoEl),
    h('div', { class: 'deck plate' },
      h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'The memo'), h('div', { class: 'grp' }, embedBtn, delFileBtn, delVecBtn, restoreBtn)),
      h('div', { class: 'grp col s2-askgrp' }, h('label', { class: 'cap', for: 's2-q' }, 'Ask the room · invented questions'), h('div', { class: 'grp' }, QUERIES.map((q) => h('button', { class: 'btn sm ghost', type: 'button', onclick: () => guard(() => ask(q.text)) }, q.label)), qInput, askBtn)),
      h('div', { class: 'grp col' }, h('label', { class: 'cap', for: 's2-pick' }, 'Inspect a point'), picker)));
  ctx.hud.append(ui, caption);

  const nums = (v) => h('p', { class: 's2-nums', title: `The ${DIM} numbers behind this point` }, '[' + v.map((x) => (x >= 0 ? ' ' : '') + x.toFixed(2)).join(', ') + ']');
  const row = (name, s, cls, sub) => h('li', { class: cls || '' }, h('span', { class: 'nm' }, name), h('span', { class: 'sc' }, f2(s)), h('span', { class: 'bar' }, h('i', { style: `width:${Math.max(0, s) * 100}%` })), sub ? h('span', { class: 'sub' }, sub) : null);
  const inStore = () => items.filter((x) => (x.kind === 'clause' || x.kind === 'chunk') && x.inStore);
  const nearestWords = (v, n, skip) => items.filter((x) => x.kind === 'word' && x !== skip).map((x) => [x, cos(v, x.v)]).sort((a, b) => b[1] - a[1]).slice(0, n);
  const nearestStored = (v, n, skip) => inStore().filter((x) => x !== skip).map((x) => [x, cos(v, x.v)]).sort((a, b) => b[1] - a[1]).slice(0, n);
  const fileNote = (it) => (it.kind === 'chunk' ? (st.memo === 'orphaned' ? 'Memo chunk. The source file is deleted.' : 'Memo chunk. The source file is on disk.') : 'Clause from the agreement.');

  function renderInfo() {
    const it = st.sel;
    if (!it) { infoCap.textContent = 'Nothing selected'; info.replaceChildren(h('p', { class: 's2-hint' }, 'Select a bead, or ask the room a question. Each point is a list of numbers, and near points have similar numbers.')); return; }
    if (it.kind === 'word') {
      infoCap.textContent = 'Word';
      info.replaceChildren(h('h3', {}, it.label), nums(it.v), h('p', { class: 's2-sub' }, 'Nearest words by cosine similarity. 1.00 means the same direction.'), h('ol', { class: 's2-nn' }, nearestWords(it.v, 5, it).map(([x, s]) => row(x.label, s))));
    } else if (it.kind === 'query') {
      infoCap.textContent = 'Your question';
      const nn = nearestStored(it.v, 3);
      info.replaceChildren(...[h('h3', { class: 'q' }, it.text), nums(it.v),
        it.unknown.length ? h('p', { class: 's2-sub' }, `This small room knows ${V.size} words. Ignored: ${it.unknown.join(', ')}.`) : null,
        it.known.length ? h('p', { class: 's2-sub' }, 'Nearest stored passages. The store returns them by nearness alone.') : h('p', { class: 's2-sub' }, 'None of these words are in the room, so the question has no position.'),
        it.known.length ? h('ol', { class: 's2-nn wide' }, nn.map(([x, s]) => row(x.label, s, x.kind, `${x.text} ${fileNote(x)}`))) : null].filter(Boolean));
    } else {
      infoCap.textContent = it.kind === 'chunk' ? 'Memo chunk in the store' : 'Clause in the store';
      const tw = nearestStored(it.v, 1, it)[0];
      info.replaceChildren(...[h('h3', { class: it.kind === 'chunk' ? 'q' : '' }, it.label), nums(it.v),
        h('p', { class: 's2-sub' }, 'Read from the numbers alone, its nearest words:'), h('ol', { class: 's2-nn' }, nearestWords(it.v, 5).map(([x, s]) => row(x.label, s))),
        h('p', { class: 's2-kept' }, h('b', {}, 'Stored beside the vector'), it.text, it.kind === 'chunk' && st.memo === 'orphaned' ? h('i', {}, ' The source file is deleted. This copy is still here.') : null),
        tw ? h('p', { class: 's2-sub' }, `Nearest stored passage: ${tw[0].label} at ${f2(tw[1])}. "${tw[0].text}"`) : null].filter(Boolean));
    }
  }
  function renderStore() {
    const onDisk = st.memo === 'file' || st.memo === 'embedded', copies = inStore().filter((x) => x.kind === 'chunk').length;
    tFile.textContent = onDisk ? '1' : '0'; tFileL.textContent = onDisk ? 'Source file on disk' : 'Source file deleted'; tCopies.textContent = String(copies);
    memoEl.classList.toggle('embedded', st.memo === 'embedded'); memoEl.classList.toggle('deleted', !onDisk);
    embedBtn.disabled = st.memo !== 'file'; delFileBtn.disabled = !onDisk; delVecBtn.disabled = copies === 0;
    deskTag.el.querySelector('span').textContent = onDisk ? 'The memo, on disk' : 'Deleted';
    deskTag.el.classList.toggle('off', !onDisk);
    renderPicker();
  }

  // ---------- selection and questions ----------
  function highlight(sel, others) {
    const set = new Set(others); ctx.tags.layer.classList.toggle('s2-dim', !!sel);
    for (const it of items) { const on = it === sel, nb = set.has(it); it.tagEl.classList.toggle('sel', on); it.tagEl.classList.toggle('hl', nb);
      if (it.kind === 'word') it.mesh.scale.setScalar(on ? 1.9 : nb ? 1.4 : 1);
      if (it.kind === 'clause') { it.mesh.scale.setScalar(on ? 1.5 : nb ? 1.25 : 1); it.mesh.material.emissiveIntensity = sel && sel.kind === 'query' && nb ? 0.9 : 0; } }
  }
  async function select(it, quiet) {
    clearThreads(); st.sel = it || null;
    if (!it || it.kind !== 'query') { qMesh.visible = false; qTag.el.style.display = 'none'; st.query = null; }
    if (!it) { highlight(null, []); ring.material.opacity = 0; renderInfo(); renderPicker(); return; }
    stopSpin();
    const nn = it.kind === 'query' ? (it.known.length ? nearestStored(it.v, 3) : []) : nearestWords(it.v, 5, it);
    highlight(it, nn.map(([x]) => x));
    ring.position.copy(it.pos); ring.material.color.set(it.kind === 'word' || it.kind === 'clause' ? PAL.paper : PAL.ember); ring.material.opacity = it.kind === 'query' ? 0 : 0.55;
    nn.forEach(([x, s]) => thread(it.pos, x.pos, it.kind === 'query' ? PAL.ember : 0xf3ecdb, s, it.kind === 'query'));
    renderInfo(); renderPicker(); if (it.kind !== 'query') picker.value = it.id;
    if (!quiet) {
      if (it.kind === 'word') say(`<b>${esc(it.label)}</b> sits nearest to ${nn.slice(0, 3).map(([x, s]) => `${esc(x.label)} (${f2(s)})`).join(', ')}. The scores are computed from the numbers.`);
      else if (it.kind !== 'query') say(`<b>${esc(it.label)}.</b> Its numbers alone point at: ${nn.slice(0, 4).map(([x]) => esc(x.label)).join(', ')}.`);
      ctx.announce(`${it.label}. Nearest: ${nn.map(([x, s]) => `${x.label} ${f2(s)}`).join(', ')}`);
    }
    await wait(0.5);
  }
  async function ask(text) {
    text = text.trim().slice(0, 80); const e = embed(text);
    const q = { kind: 'query', id: 'q', label: 'Your question', text, v: e.v, known: e.known, unknown: e.unknown, tagEl: qTag.el.firstChild };
    q.pos = e.known.length ? W3(place(e.v)).add(new THREE.Vector3(0, 0.55, 0)) : new THREE.Vector3(0, 6.6, 0);
    st.query = q; clearThreads(); highlight(null, []); ring.material.opacity = 0; stopSpin();
    qMesh.visible = true; qTag.el.style.display = '';
    say(`The question becomes a point too: <b>"${esc(text)}"</b>`);
    await tween({ dur: 0.9, e: ease.out, update: (k) => { qMesh.position.set(q.pos.x, q.pos.y + (1 - k) * 5, q.pos.z); } }); if (!alive) return;
    await select(q, true); if (!alive) return;
    if (!e.known.length) { say('<b>None of those words are in this small room.</b> Try words from contracts, shipping, money, weather, or baking.'); return; }
    const nn = nearestStored(q.v, 3), top = nn[0];
    say(`The store hands back the nearest points: <b>${nn.map(([x, s]) => `${esc(x.label)} (${f2(s)})`).join(', ')}</b>.`);
    ctx.announce(`Nearest stored passage: ${top[0].label}, similarity ${f2(top[1])}. ${top[0].text}`);
    return nn;
  }

  // ---------- the memo ----------
  const chunks = items.filter((x) => x.kind === 'chunk');
  function setStrips(on) { strips.forEach((s) => { s.visible = on; s.material.opacity = 1; s.material.emissiveIntensity = 0.55; s.position.y = 0.43; }); deskGlow.material.opacity = on ? 0.5 : 0; }
  async function embedMemo() {
    if (st.memo !== 'file') return;
    stopSpin(); say('Embedding the memo. It is cut into four chunks, and <b>each chunk becomes one point</b>.');
    await Promise.all(chunks.map((c, i) => (async () => {
      await wait(i * 0.38); if (!alive) return;
      const from = strips[i].position.clone().setY(0.6), bead = c.mesh; bead.visible = true;
      memoEl.querySelector(`p[data-i="${i}"]`)?.classList.add('sent');
      await tween({ dur: 1.15, e: ease.io, update: (k) => { bead.position.lerpVectors(from, c.pos, k); bead.position.y += Math.sin(k * Math.PI) * 2.2; } });
      if (!alive) return; c.stalk.visible = true; c.tag.el.style.display = ''; c.inStore = true; c.pulse = true;
    })()));
    if (!alive) return;
    st.memo = 'embedded'; renderStore();
    say('<b>Embedding made copies.</b> The file is still on the desk. Four lit points now sit in the store, each placed by what its chunk is about.');
    ctx.announce('The memo is embedded. Four points are in the vector store. The source file is still on disk.');
  }
  async function deleteFile() {
    if (st.memo !== 'file' && st.memo !== 'embedded') return;
    const had = st.memo === 'embedded'; stopSpin();
    await tween({ dur: 0.9, update: (k) => { strips.forEach((s) => { s.material.emissiveIntensity = 0.55 * (1 - k); s.material.opacity = 1 - k; s.position.y = 0.43 - k * 0.04; }); deskGlow.material.opacity = 0.5 * (1 - k); } });
    if (!alive) return; strips.forEach((s) => { s.visible = false; });
    st.memo = had ? 'orphaned' : 'gone'; renderStore(); if (st.sel) renderInfo();
    say(had ? '<b>The file is gone. The four points are still lit.</b> Deleting a document tells the vector store nothing.' : 'The file is gone, and it was never embedded, so no copy exists in the store.');
    ctx.announce(had ? 'Source file deleted. Four derived copies remain in the vector store.' : 'Source file deleted. No copies were made.');
  }
  async function deleteVectors() {
    const live = chunks.filter((c) => c.inStore); if (!live.length) return;
    stopSpin(); if (st.sel && (st.sel.kind === 'chunk' || st.sel.kind === 'query')) await select(null);
    live.forEach((c) => { c.pulse = false; });
    await tween({ dur: 0.8, update: (k) => { live.forEach((c) => { c.mesh.scale.setScalar(1 - k * 0.95); c.mesh.userData.halo.material.opacity = 1 - k; }); } });
    if (!alive) return;
    live.forEach((c) => { c.mesh.visible = false; c.mesh.scale.setScalar(1); c.mesh.userData.halo.material.opacity = 1; c.stalk.visible = false; c.tag.el.style.display = 'none'; c.inStore = false; });
    st.memo = st.memo === 'embedded' ? 'file' : 'gone'; renderStore();
    say(st.memo === 'gone' ? '<b>Now the derived copies are gone too.</b> Two deletions, in two systems. Indexes, caches, and backups would each need their own.' : 'The vectors are deleted. The source file is still on disk and can be embedded again.');
    ctx.announce('The memo vectors are deleted from the store.');
  }
  function restore() {
    clearThreads(); st.sel = null; st.query = null; qMesh.visible = false; qTag.el.style.display = 'none'; ring.material.opacity = 0; highlight(null, []);
    chunks.forEach((c) => { c.mesh.visible = false; c.mesh.scale.setScalar(1); c.mesh.userData.halo.material.opacity = 1; c.stalk.visible = false; c.tag.el.style.display = 'none'; c.inStore = false; c.pulse = false; });
    memoEl.querySelectorAll('p.sent').forEach((p) => p.classList.remove('sent'));
    setStrips(true); st.memo = 'file'; renderStore(); renderInfo(); say('');
  }
  async function guard(fn) { if (busy) return; busy = true; ui.querySelectorAll('.deck .btn').forEach((b) => b.setAttribute('aria-disabled', 'true')); try { await fn(); } finally { busy = false; if (alive) ui.querySelectorAll('.deck .btn').forEach((b) => b.removeAttribute('aria-disabled')); } }
  const byId = (id) => items.find((x) => x.id === id);
  async function look(az, el, d, dur = 1.1) { // swing the camera around the room
    stopSpin(); const t = home.target, p0 = camera.position.clone(), t0 = controls.target.clone();
    const p1 = new THREE.Vector3(t.x + d * Math.sin(az) * Math.cos(el), t.y + d * Math.sin(el), t.z + d * Math.cos(az) * Math.cos(el));
    await tween({ dur, update: (k) => { camera.position.lerpVectors(p0, p1, k); controls.target.lerpVectors(t0, t, k); controls.update(); } });
  }

  const lookHome = (dur = 0.7) => look(az0, el0, baseD, dur);
  async function focus(pos, d = 8, dur = 1.1) { // fly in on one point, keeping the current bearing
    stopSpin(); const dir = camera.position.clone().sub(controls.target).normalize(), p0 = camera.position.clone(), t0 = controls.target.clone(), p1 = pos.clone().addScaledVector(dir, d);
    await tween({ dur, update: (k) => { camera.position.lerpVectors(p0, p1, k); controls.target.lerpVectors(t0, pos, k); controls.update(); } });
  }

  // ---------- demonstrations called from the brief ----------
  const demos = {
    reveal: () => guard(async () => {
      await lookHome(); if (!alive) return;
      if (st.memo === 'gone') restore(); if (st.memo === 'file') await embedMemo(); if (!alive) return;
      const c = byId('m:2'); await select(c, true); if (!alive) return; await focus(c.pos, baseD * 0.62); if (!alive) return;
      const nn = nearestWords(c.v, 4);
      say(`No text was read to produce this: the vector for chunk 2 points at <b>${nn.map(([x]) => esc(x.label)).join(', ')}</b>. The numbers describe the passage they came from.`);
    }),
    delete: () => guard(async () => {
      await lookHome(); if (!alive) return;
      if (st.memo === 'gone') restore(); if (st.memo === 'file') { await embedMemo(); if (!alive) return; await wait(0.9); }
      if (st.memo === 'embedded') { await deleteFile(); if (!alive) return; await wait(1.3); }
      const nn = await ask(QUERIES[1].text); if (!alive || !nn) return;
      say(`<b>The file is deleted, and the store still answers.</b> The nearest point is ${esc(nn[0][0].label)}, with its text stored beside it.`);
    }),
    near: () => guard(async () => {
      const a = byId('c:1'), b = byId('c:2');
      await lookHome(); if (!alive) return;
      const nn = await ask(QUERIES[0].text); if (!alive || !nn) return;
      await focus(a.pos.clone().lerp(b.pos, 0.5), baseD * 0.5); if (!alive) return;
      say(`The two nearest passages say <b>opposite things</b>: "may cancel" and "may not cancel". Their similarity to each other is ${cos(a.v, b.v).toFixed(3)} out of 1. Near means similar in use.`);
    }),
  };
  const beats = [
    { title: 'A room where position is meaning', note: `Each bead is a word. Nobody placed them. Their positions were computed from which words keep company in ${SENTENCES.toLocaleString()} invented sentences.`, run: () => guard(async () => { restore(); await select(null); userMoved = false; controls.autoRotate = !motion.reduced; frameHome(true); say('Weather words gathered in one region, kitchen words in another, contract words in several. <b>Drag to fly around.</b>'); }) },
    { title: 'Neighbors by calculation', note: 'Similarity is arithmetic on the numbers behind each bead. Watch which words "terminate" sits beside.', run: () => guard(async () => { const w = byId('w:terminate'); await lookHome(); if (!alive) return; await select(w); await focus(w.pos, baseD * 0.62); }) },
    { title: 'Near means similar in use', note: 'Ask whether the buyer can cancel early. The two nearest clauses say opposite things, because they share their words and their company.', run: () => demos.near() },
    { title: 'A document becomes points', note: 'The memo is cut into chunks and each chunk becomes a lit point in the store. The file stays where it was. Embedding copies.', run: () => guard(async () => { restore(); await select(null); await lookHome(); await embedMemo(); }) },
    { title: 'Delete the file. The copies stay', note: 'The source file disappears from the desk. The four points stay lit, and a question still finds them.', run: () => demos.delete() },
    { title: 'The numbers still describe the text', note: 'Read one memo point with no text at all. Its nearest words give away what counsel wrote about.', run: () => demos.reveal() },
    { title: 'Two deletions, two systems', note: 'Only a second, separate deletion removes the derived copies. Backups and caches would need their own.', run: () => guard(async () => { await select(null); await lookHome(); if (st.memo === 'file') await embedMemo(); if (st.memo === 'embedded') await deleteFile(); if (!alive) return; await wait(0.6); await deleteVectors(); }) },
  ];

  // picking beads in the 3D view
  const _p = new THREE.Vector3(); let down = null;
  function pick(e) {
    const r = ctx.canvas.getBoundingClientRect(); let best = null, bd = 22;
    for (const it of items) { if (it.kind === 'chunk' && !it.inStore) continue; _p.copy(it.pos).project(camera); if (_p.z > 1) continue; const x = (_p.x * 0.5 + 0.5) * r.width + r.left, y = (-_p.y * 0.5 + 0.5) * r.height + r.top, d = Math.hypot(x - e.clientX, y - e.clientY); if (d < bd) { bd = d; best = it; } }
    return best;
  }
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 6) return; const it = pick(e); if (it) guard(() => select(it)); };
  const onMove = (e) => { if (e.pointerType !== 'mouse' || e.buttons) return; ctx.canvas.style.cursor = pick(e) ? 'pointer' : ''; };
  ctx.canvas.addEventListener('pointerdown', onDown); ctx.canvas.addEventListener('pointerup', onUp); ctx.canvas.addEventListener('pointermove', onMove);

  // ---------- view interface ----------
  let baseD = 20, az0 = 0.42, el0 = 0.3;
  function frameHome(snap) {
    home.pos.set(home.target.x + baseD * Math.sin(az0) * Math.cos(el0), home.target.y + baseD * Math.sin(el0), home.target.z + baseD * Math.cos(az0) * Math.cos(el0));
    if (snap) { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
  }
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), tight = freeW < 560, narrow = ctx.isNarrow();
    const sizeX = tight ? 15.6 : 17.5, sizeY = tight ? 13 : narrow ? 14 : 11.4;
    baseD = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    az0 = narrow ? -0.22 : 0.42; el0 = narrow ? 0.44 : 0.34; home.target.set(narrow ? -0.3 : -0.5, narrow ? 2.2 : 2.6, tight ? 2.3 : narrow ? 2.9 : 1.3); // on a narrow stage the camera swings round so the desk stays in frame
    frameHome(!userMoved);
  }
  function update(dt, t) {
    if (!motion.reduced) { qMesh.rotation.y = t * 1.2; chunks.forEach((c, i) => { if (c.pulse) c.mesh.userData.halo.material.opacity = 0.8 + Math.sin(t * 2 + i) * 0.2; }); }
  }
  function textAlt() {
    const it = st.sel, onDisk = st.memo === 'file' || st.memo === 'embedded', copies = inStore().filter((x) => x.kind === 'chunk').length;
    const selHtml = !it ? '<p>Nothing is selected.</p>' : it.kind === 'query'
      ? `<p>Your question: "${esc(it.text)}". ${it.unknown.length ? `Ignored words: ${esc(it.unknown.join(', '))}.` : ''}</p><table><tr><th>Nearest stored passage</th><th>Similarity</th><th>Text</th></tr>${nearestStored(it.v, 3).map(([x, s]) => `<tr><td>${esc(x.label)}</td><td>${f2(s)}</td><td>${esc(x.text)}</td></tr>`).join('')}</table>`
      : `<p>${esc(it.label)}${it.kind === 'word' ? '' : `: "${esc(it.text)}"`}</p><table><tr><th>Nearest word</th><th>Cosine similarity</th></tr>${nearestWords(it.v, 5, it).map(([x, s]) => `<tr><td>${esc(x.label)}</td><td>${f2(s)}</td></tr>`).join('')}</table>`;
    return `<p>The model is a round room. Each word is a small paper bead on a thin stalk. The position of each bead comes from a list of ${DIM} numbers, and those numbers were computed from which words appear near each other in ${SENTENCES.toLocaleString()} invented sentences. Words used in similar ways ended up near each other. Nobody placed them.</p>
    <p>Small paper sheets among the beads are clauses kept in a vector store. A question dropped into the room becomes a point as well, and the store returns the stored passages nearest to it. In front of the room is a desk holding an invented privileged memo, lit because it is your data. Embedding the memo sends one lit point per chunk into the room and leaves the file on the desk. Deleting the file removes it from the desk and leaves the lit points in the room. A second, separate deletion removes the points.</p>
    <h3>Regions that formed (the names are ours, the room has none)</h3><ul>${Object.entries(ZONES).map(([z, name]) => `<li><b>${esc(name)}:</b> ${esc(SHOWN.filter((e) => e.c === z).map((e) => e.w).join(', '))}</li>`).join('')}</ul>
    <h3>A clause and its opposite</h3><p>"${esc(CLAUSES[0])}" and "${esc(CLAUSES[1])}" have a similarity of ${cos(byId('c:1').v, byId('c:2').v).toFixed(3)} out of 1. They sit almost on top of each other. Nearness measures shared words and contexts, and says nothing about agreement.</p>
    <h3>The vector store now</h3><p>Source file: ${onDisk ? 'on disk' : 'deleted'}. Copies of the memo in the store: ${copies}. Other clauses in the store: ${CLAUSES.length}.</p>
    <ol>${inStore().map((x) => `<li><b>${esc(x.label)}:</b> ${esc(x.text)}</li>`).join('')}</ol>
    <h3>Selected point</h3>${selHtml}
    <h3>Sample of the invented sentences the vectors were computed from</h3><ul>${SAMPLE.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    <p>Real: the vectors, the similarity scores, and the nearest-neighbor search. Simplified: ${DIM} numbers per point shown as a 3D layout, and a passage is a weighted average of its words. Production embeddings come from a trained neural network and have hundreds or thousands of numbers. Scripted: the sentences, the clauses, the memo, and the preset questions, all invented.</p>`;
  }
  renderStore(); renderInfo();
  return {
    scene, camera, controls, update, frame, textAlt, demos, beats,
    escape: () => { if (st.sel) guard(() => select(null)); },
    dispose() { alive = false; clearThreads(); ctx.canvas.removeEventListener('pointerdown', onDown); ctx.canvas.removeEventListener('pointerup', onUp); ctx.canvas.removeEventListener('pointermove', onMove); ctx.canvas.style.cursor = ''; ctx.tags.layer.classList.remove('s2-dim'); },
  };
}
