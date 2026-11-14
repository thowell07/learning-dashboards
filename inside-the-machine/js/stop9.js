// Stop 9. Retrieval: a paper library scored against a question, the top few passages copied into the context, and an answer that is only as good as what crossed.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, cyl, paper, halo, emberBead, tween, wait, ease, motion, h, esc } from './kit.js';
import { stopByN } from './content.js';

// <retrieval-core>
// Every document, company, person, and figure below is invented.
const DOCS = {
  A: { name: 'Supply Agreement 2023', short: 'Agreement 2023', matter: 'northgate', note: 'Northgate and Calder & Wren' },
  B: { name: 'Supply Agreement 2019', short: 'Agreement 2019', matter: 'northgate', note: 'Northgate and Calder & Wren', stale: true },
  C: { name: 'Proposal letter 2022', short: 'Letter', matter: 'northgate', note: 'From Calder & Wren' },
  D: { name: 'Procurement policy', short: 'Policy', matter: 'northgate', note: 'Northgate internal' },
  E: { name: 'Operations emails', short: 'Ops emails', matter: 'northgate', note: 'Northgate internal' },
  F: { name: 'Contract review notes', short: 'Notes', matter: 'northgate', note: 'Northgate internal' },
  G: { name: 'Insurance and audit file', short: 'Compliance', matter: 'northgate', note: 'Northgate internal' },
  H: { name: 'Harrow Mills Supply Agreement 2024', short: 'Harrow Mills file', matter: 'harrow', note: 'A different client. Harrow Mills and Calder & Wren' },
};
const P = (id, ref, text) => ({ id, doc: id[0].toUpperCase(), ref, text });
const PASSAGES = [
  P('a1', 'clause 1', 'Parties and term. This Supply Agreement is made between Northgate Foods Ltd (the Buyer) and Calder & Wren Supply Ltd (the Supplier). It runs for three years from 1 March 2023.'),
  P('a2', 'clause 4.1', 'Price. The Buyer shall pay the Supplier $3.85 per unit for the Goods.'),
  P('a3', 'clause 4.3', 'Price review. The Supplier may propose a change to the price each January. A proposed change takes effect on 1 March.'),
  P('a4', 'Schedule 2, paragraph 6', 'Cap. A price increase proposed under clause 4.3 may not exceed three per cent in any contract year.'),
  P('a5', 'clause 6', 'Delivery. The Supplier shall deliver the Goods every Tuesday to the Buyer’s Dunmore depot between 6 am and 10 am.'),
  P('a6', 'clause 7', 'Payment. The Buyer shall pay each invoice within 30 days of receipt.'),
  P('a7', 'clause 14', 'Termination. 14.1 Either party may end this Agreement at once if the other commits a material breach and fails to remedy it within 14 days. 14.2 Either party may also end this Agreement without cause by giving the other ninety (90) days’ written notice. 14.3 Sums that fell due before the end date remain payable. 14.4 On ending, each party returns the other’s equipment and records.'),
  P('a8', 'clause 18', 'Liability. Neither party’s total liability under this Agreement shall exceed the sums paid in the preceding twelve months.'),
  P('a9', 'clause 19', 'Confidentiality. Each party shall keep the other’s pricing and volumes confidential.'),
  P('b1', 'clause 14.2', 'Termination notice. Either party may terminate this Supply Agreement by giving thirty (30) days’ written notice of termination. The notice period runs from the date of receipt.'),
  P('b2', 'clause 14.3', 'Form of notice. A termination notice under this Supply Agreement must be in writing and sent to the registered office of Calder & Wren Supply Ltd or Northgate Foods Ltd.'),
  P('b3', 'clause 4', 'Price. The Buyer shall pay the Supplier $3.20 per unit for the Goods.'),
  P('c1', 'page 1', 'We propose a three-year supply term with weekly delivery and prices reviewed each January.'),
  P('c2', 'page 2', 'Our standard payment period is 30 days. We look forward to renewing our relationship with Northgate.'),
  P('d1', 'section 2', 'Contracts worth more than $250,000 a year need approval from the procurement committee before signature.'),
  P('d2', 'section 3', 'New suppliers complete onboarding checks covering insurance, food safety certification, and ownership.'),
  P('d3', 'section 5', 'Staff must declare any personal interest in a supplier before taking part in a contract award.'),
  P('d4', 'section 8', 'Contract records are kept for seven years after a contract ends.'),
  P('d5', 'section 9', 'Staff may not accept gifts from suppliers worth more than $50.'),
  P('e1', '12 June', 'Tuesday’s delivery from Calder & Wren arrived three hours late again. The Dunmore depot had to hold the morning shift.'),
  P('e2', '3 May', 'Reminder: the Dunmore depot gate is open for deliveries from 6 am to 2 pm on weekdays.'),
  P('e3', '9 January', 'Calder & Wren have written to propose a price change for March. Please check it against the cap in Schedule 2.'),
  P('e4', '18 December', 'The depot closes for the holiday on 24 December and reopens on 2 January.'),
  P('f1', 'action 4', 'Action for legal: confirm how much notice Northgate must give if it decides not to continue with Calder & Wren next year.'),
  P('f2', 'item 2', 'Volumes were 12 per cent above forecast in the second quarter. Storage at Dunmore is close to capacity.'),
  P('g1', 'certificate', 'Certificate of insurance: public liability cover of $5 million, renewed each April.'),
  P('g2', 'audit', 'Food safety audit passed in May with two minor findings on cold storage records.'),
  P('g3', 'board paper', 'The board approved the renewed Calder & Wren arrangement for three years at the price recommended by procurement.'),
  P('h1', 'clause 11.1', 'Termination notice. Either party may terminate this Supply Agreement on forty-five (45) days’ written notice.'),
  P('h2', 'clause 3', 'Price. Harrow Mills shall pay Calder & Wren Supply Ltd $3.05 per unit for the Goods.'),
  P('h3', 'clause 5', 'Exclusivity. Calder & Wren shall be the sole supplier of the Goods to Harrow Mills for the term.'),
  P('h4', 'clause 16', 'Disputes. The parties shall refer any dispute to mediation before starting proceedings.'),
];
const STOP = new Set('the a an of to in on for and or is are be by at as it its this that with from shall may must will what which who whom how does do did can any each has have had not no if than then their our we they s t there here was were been also per'.split(' '));
// A crude stem: strip one common ending so "terminate", "termination", and "terminated" meet.
function stem(w) {
  if (w.length >= 4) for (const suf of ['ations', 'ation', 'ions', 'ion', 'ings', 'ing', 'ies', 'ied', 'es', 'ed', 'e', 'y']) if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  if (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
const terms = (text) => (text.toLowerCase().replace(/[’']s\b/g, '').match(/[a-z]+|\d+(?:\.\d+)?/g) || []).filter((w) => !STOP.has(w)).map(stem);
// TF-IDF vectors over the passages currently in the store, then cosine similarity with the query.
function buildIndex(passages) {
  const N = passages.length, df = new Map(), tfs = passages.map((p) => { const m = new Map(); for (const w of terms(p.text)) m.set(w, (m.get(w) || 0) + 1); for (const w of m.keys()) df.set(w, (df.get(w) || 0) + 1); return m; });
  const idf = (w) => Math.log((N + 1) / ((df.get(w) || 0) + 1)) + 1;
  const vecs = tfs.map((m) => { const v = new Map(); let n = 0; for (const [w, c] of m) { const x = (1 + Math.log(c)) * idf(w); v.set(w, x); n += x * x; } n = Math.sqrt(n) || 1; for (const [w, x] of v) v.set(w, x / n); return v; });
  return { passages, vecs, idf, df, N };
}
function rank(index, query) {
  const m = new Map(); for (const w of terms(query)) if (index.df.has(w)) m.set(w, (m.get(w) || 0) + 1);
  const q = new Map(); let n = 0; for (const [w, c] of m) { const x = (1 + Math.log(c)) * index.idf(w); q.set(w, x); n += x * x; } n = Math.sqrt(n) || 1;
  return index.passages.map((p, i) => { let s = 0; const hits = []; for (const [w, x] of q) { const y = index.vecs[i].get(w); if (y) { s += (x / n) * y; hits.push(w); } } return { p, score: s, hits }; }).sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id));
}
// </retrieval-core>

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const byId = Object.fromEntries(PASSAGES.map((p) => [p.id, p]));
const cite = (id) => `${DOCS[byId[id].doc].name}, ${byId[id].ref}`;
const tok = (text) => Math.round(text.split(/\s+/).length * 1.35);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SYSTEM = 'Answer the question from the passages provided. Cite the document and clause you relied on.';
const PRESETS = [
  { chip: 'Notice to terminate', q: 'How much notice must Northgate give to terminate the supply agreement?' },
  { chip: 'Delivery day', q: 'Which day are deliveries made to the Dunmore depot?' },
  { chip: 'Price per unit', q: 'What price per unit does Northgate pay Calder & Wren?' },
  { chip: 'Price changes', q: 'Can the supplier change the price each year?' },
];
const BLIND = [
  'I do not have your agreement, so I cannot say. A supply agreement normally sets a written notice period. Look for the clause headed Termination.',
  'I have no information about your delivery schedule.',
  'I do not know what Northgate pays. I have no access to the agreement.',
  'That depends on the agreement, which I do not have. Look for a price review clause.',
];
// ---- scripted answers. Each one is a function of the passages that reached the model, so the script follows the real ranking. ----
const join = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const up = (s) => s[0].toUpperCase() + s.slice(1);
function versioned(c, s) {
  const cur = c.has(s.cur.id), st = c.has(s.stale.id), ot = c.has(s.other.id), n = cur + st + ot;
  const missed = `It ranked #${c.rankOf(s.cur.id)} and never reached the model.`;
  if (n === 0) return { text: s.none + (c.has('f1') && s.f1 ? ' ' + s.f1 : ''), cites: [], cls: 'warn', verdict: `No answer. ${s.where} ranked #${c.rankOf(s.cur.id)}, below the cut of ${c.k}, and stayed on the shelf.`, bad: [], missed: [s.cur.id] };
  if (n === 1 && cur) return { text: s.cur.say, cites: [s.cur.id], cls: 'ok', verdict: `Correct. ${s.truth}`, bad: [], missed: [] };
  if (n === 1 && st) return { text: s.stale.say, cites: [s.stale.id], cls: 'bad', verdict: `Wrong, and faithfully cited. The 2019 agreement was replaced in 2023, and nothing in the store says so. ${s.truth} ${missed}`, bad: [s.stale.id], missed: [s.cur.id] };
  if (n === 1 && ot) return { text: s.other.say, cites: [s.other.id], cls: 'bad', leak: true, verdict: `Wrong contract, wrong client. The passage comes from the Harrow Mills file, which this user has no right to search. ${s.truth} ${missed}`, bad: [s.other.id], missed: [s.cur.id] };
  const parts = [st && s.stale.label, ot && s.other.label, cur && s.cur.label].filter(Boolean);
  return {
    text: `The passages disagree. ${up(join(parts))}. ${cur ? s.resolve : 'I cannot tell from these passages which one applies.'} Confirm which agreement is in force.`,
    cites: [st && s.stale.id, ot && s.other.id, cur && s.cur.id].filter(Boolean), cls: 'warn', leak: ot,
    verdict: `${cur ? 'In this script the model flags the conflict and leans the right way. A real model may pick one silently.' : `Neither passage is the one in force. ${s.truth} ${missed}`}${ot ? ' A passage from another client’s file reached the model and this user.' : ''}`,
    bad: [st && s.stale.id, ot && s.other.id].filter(Boolean), missed: cur ? [] : [s.cur.id],
  };
}
const ANSWER = [
  (c) => versioned(c, {
    cur: { id: 'a7', say: 'Ninety days’ written notice. Either party may end the agreement without cause on that notice.', label: 'the 2023 agreement says ninety days' },
    stale: { id: 'b1', say: 'Thirty days’ written notice. The notice period runs from the date of receipt.', label: 'the 2019 agreement says thirty days' },
    other: { id: 'h1', say: 'Forty-five days’ written notice.', label: 'the Harrow Mills agreement says forty-five days' },
    none: 'The passages I received do not state a notice period.', f1: 'One of them is a note asking the same question.',
    where: 'The clause that answers this', truth: 'Clause 14.2 of the 2023 agreement, the one in force, says ninety days.',
    resolve: 'The 2023 agreement is the later one between Northgate and Calder & Wren, so ninety days appears to apply.',
  }),
  (c) => (c.has('a5') ? { text: 'Every Tuesday, between 6 am and 10 am.', cites: ['a5'], cls: 'ok', verdict: 'Correct. Clause 6 of the 2023 agreement says every Tuesday. Here retrieval did its job: the right passage ranked first.', bad: [], missed: [] }
    : c.has('e1') ? { text: 'An operations email refers to a Tuesday delivery arriving at the Dunmore depot. The passages do not include the contract term itself.', cites: ['e1'], cls: 'warn', verdict: `Right day, weak source. The delivery clause ranked #${c.rankOf('a5')} and stayed on the shelf.`, bad: [], missed: ['a5'] }
      : { text: 'The passages I received do not say which day deliveries are made.', cites: [], cls: 'warn', verdict: `No answer. The delivery clause ranked #${c.rankOf('a5')}, below the cut of ${c.k}.`, bad: [], missed: ['a5'] }),
  (c) => versioned(c, {
    cur: { id: 'a2', say: '$3.85 per unit.', label: 'the 2023 agreement says $3.85' },
    stale: { id: 'b3', say: '$3.20 per unit.', label: 'the 2019 agreement says $3.20' },
    other: { id: 'h2', say: '$3.05 per unit.', label: 'the Harrow Mills agreement says $3.05' },
    none: 'The passages I received do not state a price per unit.',
    where: 'The price clause', truth: 'Clause 4.1 of the 2023 agreement, the one in force, says $3.85 per unit.',
    resolve: 'The 2023 agreement is the later one between Northgate and Calder & Wren, so $3.85 appears to apply.',
  }),
  (c) => (c.has('a3') && c.has('a4') ? { text: 'Yes, within a limit. The Supplier may propose a change each January, taking effect on 1 March. No increase may exceed three per cent in any contract year.', cites: ['a3', 'a4'], cls: 'ok', verdict: 'Correct and complete. The review clause and the cap both reached the model.', bad: [], missed: [] }
    : c.has('a3') ? { text: `Yes. The Supplier may propose a change each January, taking effect on 1 March.${c.has('e3') ? ' An email refers to a cap in Schedule 2. That schedule was not among the passages I received.' : ''}`, cites: c.has('e3') ? ['a3', 'e3'] : ['a3'], cls: 'warn', verdict: `True as far as it goes, and incomplete. The three per cent cap is in Schedule 2. It ranked #${c.rankOf('a4')} and stayed on the shelf.`, bad: [], missed: ['a4'] }
      : { text: 'The passages I received do not contain a price review clause.', cites: [], cls: 'warn', verdict: `No answer. The review clause ranked #${c.rankOf('a3')}, below the cut of ${c.k}.`, bad: [], missed: ['a3'] }),
];

export const BRIEF = {
  define: 'Retrieval, often called RAG for retrieval-augmented generation, is a search step the app runs before it calls the model. A passage, also called a chunk, is a piece of a document cut small enough to be scored and placed in the context. Top-k is the number of best-scoring passages the app passes along.',
  misconceptions: [
    { wrong: 'With retrieval it only answers from our documents, so it cannot be wrong.', right: 'Retrieval ranks passages by similarity to the question. It has no measure of whether a passage is current, applicable, or correct. The model then writes from whatever arrived, and it can still misread a passage or add to it. A wrong source produces a well-cited wrong answer.', demo: 'stale', demoLabel: 'Leave a superseded contract in the store' },
    { wrong: 'It read the whole library.', right: 'The model received the few passages that scored highest and nothing else. A passage ranked just below the cut never reached it, even when it held the answer.', demo: 'whole', demoLabel: 'Count what reached the model' },
    { wrong: 'Retrieval means the model was trained on our documents.', right: 'The documents sit in a search index outside the model. Passages are copied into the context for one call. The weights are the same before and after, and a document taken out of the store stops appearing in answers.', demo: 'trained', demoLabel: 'Switch retrieval off and ask again' },
  ],
  legal: 'Grounding an answer in documents lowers the rate of invented content and guarantees nothing. A citation shows that a source exists in the store. It does not show that the source is current, that it applies to the question, or that the model read it correctly, so the duty to check moves from the answer to the source. Access control for retrieval sits in the search layer, and a store that mixes matters or clients can surface one party’s material in another’s answer. The store itself holds derived copies of the documents, so retention and deletion rules need to reach it (stops 2 and 11).',
  ask: [
    'How are superseded, draft, and duplicate documents kept out of the store, and how quickly does a change to a source document reach it?',
    'How many passages reach the model for each question, and can a user see which ones were used and which were left out?',
    'Is each user’s access to documents enforced at retrieval time, and how was that tested?',
  ],
  say: 'The system searches our documents, pastes the best few passages in front of the model, and the model answers from those. It is only as good as what the search pulled, so a citation tells us where to look, and we still have to check that the source is the right one.',
  checks: [
    { q: 'An answer cites a real clause from a real contract in your store. What has the citation established?', a: 'That the passage exists in the store and was placed in the context. Whether that contract is the one in force, whether the clause applies, and whether the model read it correctly all remain to be checked.' },
    { q: 'The clause that answers the question is in the store, and the answer still misses it. Name one mechanical reason.', a: 'The clause ranked below the top-k cut, so it never reached the model. Wording that differs from the question, a long passage that dilutes the match, and similar text in other documents can all push it down.' },
    { q: 'A user with no access to a matter asks a question, and the answer quotes that matter’s file. Where did the control fail?', a: 'In the retrieval layer. The search returned passages the user was not entitled to see. The model cannot enforce an entitlement, because it only receives text.' },
  ],
};

export function createStop(ctx) {
  const stop = stopByN(9), narrow = ctx.isNarrow();
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 76, shadow: 15, keyPos: [5, 16, 10] });
  key.target.position.set(0, 0, 0.5); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: V(3, 9, 15), target: V(-0.6, 1.5, 1.0) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 5, maxDist: 52, maxPolar: 1.42, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf), PD = paper(PAL.paperDark);
  const SXC = 0.7, TIERS = [{ docs: ['A', 'B', 'C', 'F'], z: -2.1, y: 0.3 }, { docs: ['D', 'E', 'G', 'H'], z: -3.55, y: 1.9 }];
  const CF = V(narrow ? -2.9 : -3.3, 0, 2.5), MD = V(narrow ? -5.6 : -6.3, 0, 0.3), YOU = V(-0.2, 0, 4.4);
  const CW = 0.42, PITCH = 0.5, DGAP = 0.36, RISE = 2.7, FH = 3.0, SCF = 0.006, SLW = 2.2, SLD = 1.5, FY = 0.08;
  const BLUE = new THREE.Color(PAL.blue), VERM = new THREE.Color(PAL.verm), WARM = new THREE.Color(0xfff1cf), PAPER = new THREE.Color(PAL.paper), LOCKED = new THREE.Color(0x6a655b), TEAL = new THREE.Color(PAL.teal);
  let alive = true, userMoved = false, quick = false;
  controls.addEventListener('start', () => { userMoved = true; });
  const state = { q: '', pi: -1, k: 3, stale: false, filter: true, retr: true, store: [], eligible: [], ranked: [], rankOf: new Map(), scoreOf: new Map(), pulled: null, sel: null, busy: false };
  const anim = () => !quick && !motion.reduced;
  const T = (o) => (quick ? (o.update && o.update(1), Promise.resolve(true)) : tween(o));
  const W = (s) => (quick ? Promise.resolve(true) : wait(s));
  const _t = new THREE.Vector3();

  // ---------- 3D: the library ----------
  const track = (a, b) => { const dd = b.clone().sub(a), len = dd.length(); const m = block(0.07, 0.02, len, { color: 0x3a352e, edges: false, cast: false }); m.position.copy(a).addScaledVector(dd, 0.5); m.position.y = 0.012; m.rotation.y = Math.atan2(dd.x, dd.z); world.add(m); };
  const chunks = [], groups = {};
  TIERS.forEach((tier) => {
    const n = tier.docs.reduce((a, dk) => a + PASSAGES.filter((p) => p.doc === dk).length, 0), width = n * PITCH + (tier.docs.length - 1) * DGAP;
    if (tier.y < 1) { const pl = block(width + 0.7, tier.y, 1.15, { mat: P2 }); pl.position.set(SXC, 0, tier.z); world.add(pl); }
    else { // an open shelf: a board on posts, so the lower tier reads through it
      const board = block(width + 0.7, 0.12, 1.15, { mat: P2 }); board.position.set(SXC, tier.y - 0.12, tier.z); world.add(board);
      for (let i = 0; i < 5; i++) [-0.45, 0.45].forEach((dz) => { const post = block(0.1, tier.y - 0.12, 0.1, { mat: P1, edges: false }); post.position.set(SXC - (width + 0.5) / 2 + i * ((width + 0.5) / 4), 0, tier.z + dz); world.add(post); });
    }
    let x = SXC - width / 2 + PITCH / 2;
    tier.docs.forEach((dk) => {
      const ps = PASSAGES.filter((p) => p.doc === dk), x0 = x;
      ps.forEach((p) => {
        const hgt = 0.55 + Math.min(1, p.text.length / 330) * 0.9;
        const mat = paper(PAL.paper); mat.emissive = new THREE.Color(PAL.blue); mat.emissiveIntensity = 0;
        const m = block(CW, hgt, 0.72, { mat }); m.position.set(x, tier.y, tier.z); m.userData.pid = p.id; world.add(m);
        chunks.push({ p, m, mat, x, y0: tier.y, z: tier.z, h: hgt, rise: 0, tRise: 0, em: 0, tEm: 0, emCol: BLUE, sink: 0, tSink: 0, dark: 0, tDark: 0, delay: 0, score: 0, present: true, locked: false });
        x += PITCH;
      });
      groups[dk] = { x: (x0 + x - PITCH) / 2, w: ps.length * PITCH, tier };
      x += DGAP;
    });
  });
  const chunkOf = Object.fromEntries(chunks.map((c) => [c.p.id, c]));
  // the cage around another client's file: access control, enforced by the search layer
  const cage = new THREE.Group(); world.add(cage);
  { const g = groups.H, w = g.w + 0.16; const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 2.3, 1.0)), new THREE.LineBasicMaterial({ color: PAL.paper })); box.position.set(g.x, g.tier.y + 1.15, g.tier.z); cage.add(box);
    for (let i = 0; i < 5; i++) { const bar = block(0.035, 2.3, 0.035, { mat: PD, edges: false, cast: false }); bar.position.set(g.x - w / 2 + (i + 0.5) * (w / 5), g.tier.y, g.tier.z + 0.5); cage.add(bar); } }
  let cageUp = 0;
  const setCage = (on) => { const from = cageUp, to = on ? 0 : 1; return T({ dur: 0.5, update: (k) => { cageUp = from + (to - from) * k; cage.position.y = cageUp * 3.2; cage.visible = cageUp < 0.98; } }); };
  // you, the context frame, the model
  const you = cyl(0.7, 0.18, { mat: P1 }); you.position.copy(YOU); world.add(you);
  const youBead = emberBead(0.15, PAL.ember, 1.7); youBead.position.set(YOU.x, 0.6, YOU.z); world.add(youBead);
  const fbase = block(SLW + 0.7, FY, SLD + 0.6, { mat: P2 }); fbase.position.copy(CF); world.add(fbase);
  const fbox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(SLW + 0.3, FH, SLD + 0.3)), new THREE.LineBasicMaterial({ color: 0x9a9384 })); fbox.position.set(CF.x, FY + FH / 2, CF.z); world.add(fbox);
  const modelMat = paper(PAL.paper); modelMat.emissive = new THREE.Color(PAL.teal); modelMat.emissiveIntensity = 0;
  const model = block(2.2, 2.2, 2.2, { mat: modelMat }); model.position.copy(MD); world.add(model);
  { const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), P2, 36); const o = new THREE.Object3D(); let i = 0; for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) { o.position.set(-0.7 + x * 0.28, 2.225, -0.7 + z * 0.28); o.updateMatrix(); studs.setMatrixAt(i++, o.matrix); } studs.castShadow = true; model.add(studs);
    const sl = block(0.05, 0.14, 1.5, { mat: paper(0x1b1815), edges: false }); sl.position.set(1.1, 0.95, 0); model.add(sl); }
  track(V(YOU.x, 0, YOU.z - 0.7), V(SXC + 0.3, 0, TIERS[0].z + 0.7)); track(V(SXC - 2.4, 0, TIERS[0].z + 0.7), V(CF.x + 0.6, 0, CF.z - 1.1)); track(V(CF.x - 1.5, 0, CF.z - 0.5), V(MD.x + 1.1, 0, MD.z + 0.3)); track(V(YOU.x - 0.7, 0, YOU.z - 0.1), V(CF.x + 1.5, 0, CF.z + 0.3));
  // tags
  const tag = (b, s, pos, cls = '') => ctx.tags.add(h('div', { class: `looptag ${cls}` }, h('b', {}, b), h('span', {}, s)), pos);
  tag('Model', 'Never read the library', V(MD.x, 2.8, MD.z - 0.6));
  tag('Context', 'All the model receives', V(CF.x, FY + FH + 0.25, CF.z - 0.7));
  tag('You', 'One question', V(YOU.x, 1.2, YOU.z));
  const storeTag = tag('Document store', '', V(SXC - 4.3, TIERS[1].y + 1.95, TIERS[1].z - 0.5));
  const docTags = {};
  Object.entries(groups).forEach(([dk, g]) => { const el = h('div', { class: 's9-doc' + (dk === 'H' ? ' other' : '') }, DOCS[dk].short); docTags[dk] = ctx.tags.add(el, g.tier.y > 1 ? V(g.x, g.tier.y - 0.12, g.tier.z + 0.6) : V(g.x, 0.02, g.tier.z + 0.85)); });
  const marks = [];
  const mark = (id, text, cls) => { const c = chunkOf[id]; const tg = ctx.tags.add(h('div', { class: `s9-mark ${cls}` }, text), () => _t.set(c.x, c.y0 + c.rise + c.h + 0.12, c.z)); marks.push(tg); };
  const clearMarks = () => { marks.splice(0).forEach((m) => m.remove()); };

  // ---------- 3D: the context stack ----------
  const slabs = [];
  const stackTop = () => slabs.reduce((y, s) => y + s.h + 0.02, FY);
  const COLORS = { system: PAL.sys, user: PAL.ember, tool: PAL.blue, model: PAL.teal };
  const fly = (o, a, b, dur, arc, grow) => { o.position.copy(a); return tween({ dur, update: (k) => { o.position.lerpVectors(a, b, k); o.position.y += Math.sin(k * Math.PI) * arc; if (grow) o.scale.setScalar(0.22 + 0.78 * k); } }); };
  async function addSlab(spec, from, arc = 1.2) {
    const hgt = Math.max(0.07, spec.tokens * SCF), mat = paper(COLORS[spec.kind]);
    const m = block(SLW, hgt, SLD, { mat }); world.add(m);
    const to = V(CF.x, stackTop(), CF.z), rec = { ...spec, m, mat, h: hgt };
    slabs.push(rec);
    if (anim() && from) await fly(m, from, to, 0.75, arc, spec.kind === 'tool'); else m.position.copy(to);
    return rec;
  }
  function clearPull() {
    slabs.splice(1).forEach((s) => { world.remove(s.m); s.m.traverse((o) => { o.geometry && o.geometry.dispose(); }); s.mat.dispose(); });
    clearMarks(); state.pulled = null; modelMat.emissiveIntensity = 0;
  }
  const pulse = (mat, peak = 0.55, dur = 0.8) => T({ dur, e: ease.lin, update: (k) => { mat.emissiveIntensity = Math.sin(k * Math.PI) * peak; } });
  async function feed() {
    if (!anim()) return;
    const hgt = Math.max(0.1, stackTop() - FY);
    const g = new THREE.Mesh(new THREE.BoxGeometry(SLW, hgt, SLD), new THREE.MeshBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.4, depthWrite: false })); world.add(g);
    const a = V(CF.x, FY + hgt / 2, CF.z), b = V(MD.x + 0.9, 1.0, MD.z);
    await tween({ dur: 0.85, update: (k) => { g.position.lerpVectors(a, b, k); g.scale.setScalar(1 - k * 0.6); g.material.opacity = 0.42 * (1 - k * 0.6); } });
    world.remove(g); g.geometry.dispose(); g.material.dispose();
    await pulse(modelMat);
  }

  // ---------- the logic (real scoring) ----------
  function recompute(wave) {
    state.store = PASSAGES.filter((p) => state.stale || !DOCS[p.doc].stale);
    state.eligible = state.store.filter((p) => !state.filter || DOCS[p.doc].matter === 'northgate');
    state.ranked = rank(buildIndex(state.eligible), state.q);
    state.rankOf = new Map(state.ranked.map((r, i) => [r.p.id, i + 1]));
    state.scoreOf = new Map(state.ranked.map((r) => [r.p.id, r.score]));
    state.pi = PRESETS.findIndex((x) => norm(x.q) === norm(state.q));
    clearPull();
    chunks.forEach((c, i) => { c.present = state.store.includes(c.p); c.locked = c.present && !state.eligible.includes(c.p); c.score = state.scoreOf.get(c.p.id) || 0; c.delay = wave && anim() ? 0.1 + i * 0.022 : 0; });
    paint(); render();
  }
  function paint() {
    const pl = state.pulled, out = pl && pl.revealed && pl.out;
    chunks.forEach((c) => {
      c.tSink = c.present ? 0 : 1; c.tDark = c.locked ? 1 : 0;
      c.tRise = c.present && !c.locked ? c.score * RISE : 0;
      c.emCol = BLUE; c.tEm = c.present && !c.locked ? Math.min(0.8, c.score * 1.8) : 0;
      if (pl) { c.tEm = pl.ids.has(c.p.id) ? 1 : 0; if (out && out.bad.includes(c.p.id)) { c.emCol = VERM; c.tEm = 1; } else if (out && out.missed.includes(c.p.id)) { c.emCol = WARM; c.tEm = 0.9; } }
    });
    docTags.B.el.style.display = state.stale ? '' : 'none';
    docTags.H.el.textContent = state.filter ? 'Another client · locked' : 'Another client · unlocked';
  }
  const topList = () => (state.retr ? state.ranked.filter((r) => r.score > 0).slice(0, state.k) : []);
  async function retrieve() {
    if (!state.q.trim()) { say('Pick a question or type one first.'); qIn.focus(); return; }
    clearPull();
    const top = topList(), custom = state.pi < 0;
    state.pulled = { ids: new Set(), list: top, out: null, revealed: false, custom, done: false };
    paint(); render();
    say(state.retr ? 'Your question goes to the search index first. <b>The model has not been called yet.</b>' : 'Retrieval is off. <b>The question goes to the model alone.</b>');
    await addSlab({ kind: 'user', tokens: tok(state.q), text: state.q }, V(YOU.x, 0.9, YOU.z), 1.4); if (!alive) return;
    if (state.retr) {
      await W(0.5);
      say(top.length ? `The ${top.length} best-scoring ${top.length === 1 ? 'passage is' : 'passages are'} <b>copied</b> into the context. The originals stay in the store.` : '<b>No passage shares a word with the question.</b> Nothing is copied.');
      for (const [i, r] of top.entries()) {
        const c = chunkOf[r.p.id]; state.pulled.ids.add(r.p.id); paint(); mark(r.p.id, `#${i + 1} · ${r.score.toFixed(2)}`, 'sent');
        await addSlab({ kind: 'tool', id: r.p.id, tokens: tok(r.p.text), text: r.p.text }, V(c.x, c.y0 + c.rise + c.h / 2, c.z), 1.6); if (!alive) return;
        renderAnswer();
      }
    }
    await W(0.4);
    const pieces = 2 + top.length, shelf = state.store.length - top.length;
    say(`Now the model is called. It receives <b>${pieces} pieces of text</b>: the system prompt, your question${top.length ? `, and ${top.length} ${top.length === 1 ? 'passage' : 'passages'}` : ''}. ${shelf} passages stay dark.`);
    await feed(); if (!alive) return;
    if (!custom) {
      const c = { has: (id) => state.pulled.ids.has(id), rankOf: (id) => state.rankOf.get(id) || 0, k: state.k };
      const out = state.retr ? ANSWER[state.pi](c) : { text: BLIND[state.pi], cites: [], cls: 'warn', verdict: 'No passage reached the model. Its weights hold general patterns of language and nothing from this library.', bad: [], missed: [], blind: true };
      state.pulled.out = out;
      await addSlab({ kind: 'model', tokens: tok(out.text), text: out.text }, V(MD.x + 1.3, 1.0, MD.z), 0.9); if (!alive) return;
      say(out.blind ? 'The model answers from its weights alone. <b>It has never seen your contract.</b>' : 'The model writes an answer from those passages and cites one. <b>Is it right?</b> Check it against the contracts.');
      ctx.announce(`Answer: ${out.text} ${out.cites.length ? 'Cited: ' + out.cites.map(cite).join('; ') : ''}`);
    } else {
      say('<b>No model is running here.</b> For a typed question this stop shows the real ranking and the context that would be sent. The four preset questions have scripted answers.');
      ctx.announce('No model is running. The ranked passages and the assembled context are shown.');
    }
    state.pulled.done = true; render();
  }
  function reveal() {
    const pl = state.pulled; if (!pl || !pl.out || pl.revealed) return;
    pl.revealed = true; paint();
    const out = pl.out;
    slabs.forEach((s) => { if (s.id && out.bad.includes(s.id)) s.mat.color.set(PAL.verm); });
    out.bad.forEach((id) => mark(id, DOCS[byId[id].doc].stale ? 'Superseded in 2023' : 'Another client’s file', 'bad'));
    out.missed.forEach((id) => mark(id, `Rank #${state.rankOf.get(id)} · never sent`, 'missed'));
    say({ ok: '<b>Checked, and correct.</b> The right passage ranked high enough to cross.', bad: out.leak ? '<b>Wrong contract, wrong client.</b> The passage came from a file this user had no right to search.' : '<b>Faithfully cited, and wrong.</b> The source was real and out of date. The clause in force stayed on the shelf.', warn: out.blind ? 'Nothing from the library reached the model.' : '<b>Checked.</b> Look at what stayed on the shelf.' }[out.cls]);
    render(); ctx.announce(out.verdict);
  }

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption', role: 'status' });
  const say = (html) => { if (!quick) caption.innerHTML = html || ''; };
  const chipsEl = h('div', { class: 's9-chips', role: 'group', 'aria-label': 'Preset questions' }, PRESETS.map((p, i) => h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => guard(async () => setQuery(PRESETS[i].q, true)) }, p.chip)));
  const qIn = h('textarea', { class: 's9-q', rows: '2', id: 's9-q', autocomplete: 'off', spellcheck: 'false', placeholder: 'Type a question about these documents', oninput: (e) => { if (state.busy) { e.target.value = state.q; return; } setQuery(e.target.value, false, true); }, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); guard(retrieve); } } });
  const listEl = h('ol', { class: 's9-list', 'aria-label': 'Passages ranked by score' }), listCap = h('span', { class: 'cap' }, '');
  const ansEl = h('div', { class: 's9-ans', 'aria-live': 'off' }), ansCap = h('span', { class: 'cap' }, '');
  const goBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guard(retrieve) }, 'Retrieve and answer');
  const kOut = h('output', { for: 's9-k' }, '3');
  const kIn = h('input', { type: 'range', id: 's9-k', min: '1', max: '6', step: '1', value: '3', oninput: (e) => { if (state.busy) { e.target.value = String(state.k); return; } state.k = Number(e.target.value); kOut.textContent = String(state.k); clearPull(); paint(); render(); say(`<b>Top-k is ${state.k}.</b> The ${state.k} best-scoring ${state.k === 1 ? 'passage crosses' : 'passages cross'} into the context. Everything else stays on the shelf.`); } });
  const sw = {};
  const mkSw = (k, label, fn) => { sw[k] = h('input', { type: 'checkbox', checked: state[k], onchange: (e) => { if (state.busy) { e.target.checked = state[k]; return; } guard(() => fn(e.target.checked)); } }); return h('label', { class: 'switch' }, sw[k], h('i'), label); };
  const ui = h('section', { class: 'stop s9', 'aria-label': 'Stop 9, Retrieval' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 09 · The shelves on the ring'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' }, h('span', {}, h('b', {}, 'Real'), 'The scoring, the ranking, top-k, and the access filter all run live. Type your own question.'), h('span', {}, h('b', {}, 'Scripted'), 'The passages and the four preset answers. No model is running.'), h('span', {}, h('b', {}, 'Simplified'), 'Scores come from word counts. Production systems use learned embeddings (stop 2), often with keyword search and a reranker.')),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'One question'), h('span', { class: 'cap' }, 'Invented example')),
        h('div', { class: 'plate-b' }, chipsEl, h('label', { class: 'sr', for: 's9-q' }, 'Your question'), qIn, h('p', { class: 'invented' }, 'A document store at an invented law firm. You work on the Northgate matter. Every company, person, document, and figure is invented.'))),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Every passage, scored'), listCap), h('div', { class: 'plate-b' }, listEl))),
    h('div', { class: 'float-br' }, h('div', { class: 'plate' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'What reached the model'), ansCap), h('div', { class: 'plate-b' }, ansEl))),
    h('div', { class: 'deck plate' },
      h('div', { class: 'grp' }, goBtn),
      h('div', { class: 'slider s9-k' }, h('label', { for: 's9-k' }, 'Top-k · passages sent'), kOut, kIn),
      mkSw('stale', 'Superseded 2019 agreement in the store', setStale),
      mkSw('filter', 'Access filter', setFilter),
      mkSw('retr', 'Retrieval', setRetr)));
  ctx.hud.append(ui, caption);

  function render() { if (quick) return; renderList(); renderAnswer(); chipsEl.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.pi))); storeTag.el.querySelector('span').textContent = `${state.store.length} passages · a search index, outside the model`; }
  function renderList() {
    const rows = state.ranked.filter((r) => r.score > 0), zeros = state.eligible.length - rows.length, lockedN = state.store.length - state.eligible.length;
    const pl = state.pulled, out = pl && pl.revealed && pl.out, kk = state.retr ? state.k : 0;
    listCap.textContent = state.q.trim() ? `${state.eligible.length} scored · live` : `${state.eligible.length} passages`;
    if (!state.q.trim()) { listEl.replaceChildren(h('li', { class: 'none' }, 'Pick a question or type one. Every passage in the store is scored against it as you type, and each block on the shelf rises by its score.')); return; }
    const items = [];
    rows.forEach((r, i) => {
      if (i === kk && kk > 0) items.push(h('li', { class: 'cut' }, `Cut at top ${kk}. Everything below stays on the shelf.`));
      const id = r.p.id, open = state.sel === id, cls = [i < kk ? 'in' : 'outk', out && out.bad.includes(id) ? 'bad' : '', out && out.missed.includes(id) ? 'missed' : ''].join(' ');
      items.push(h('li', { class: cls }, h('button', { type: 'button', class: 's9-row', 'aria-expanded': String(open), 'data-id': id, onclick: () => select(open ? null : id) },
        h('span', { class: 'rk' }, `#${i + 1}`), h('span', { class: 'sc' }, r.score.toFixed(2)), h('span', { class: 'bar' }, h('i', { style: `width:${Math.min(100, r.score * 150)}%` })),
        h('span', { class: 'dc' }, `${DOCS[r.p.doc].short} · ${r.p.ref}`), h('span', { class: 'tx' }, r.p.text),
        open ? h('span', { class: 'why' }, `Shared word stems: ${r.hits.join(', ')}. ${DOCS[r.p.doc].name}. ${DOCS[r.p.doc].note}.`) : null)));
    });
    if (!rows.length) items.push(h('li', { class: 'none' }, 'No passage shares a word with this question. Word-count scoring finds nothing. A learned embedding might still find a match by meaning.'));
    if (zeros > 0 && rows.length) items.push(h('li', { class: 'zero' }, `${zeros} more ${zeros === 1 ? 'passage' : 'passages'} scored 0. They share no words with the question.`));
    if (lockedN) items.push(h('li', { class: 'zero' }, `${lockedN} passages from another client’s file were filtered out before scoring.`));
    listEl.replaceChildren(...items);
  }
  function renderAnswer() {
    const pl = state.pulled, n = pl ? pl.ids.size : 0, N = state.store.length;
    ansCap.textContent = pl ? `${n} of ${N}` : '';
    if (!pl) { ansEl.replaceChildren(h('p', { class: 'idle' }, state.q.trim() ? `Nothing has been sent yet. Retrieve, and the top ${state.retr ? state.k : 0} of ${N} passages will be copied into the context.` : 'Nothing has been sent yet.')); return; }
    const kids = [h('p', { class: 'count' }, h('b', {}, String(n)), h('span', {}, `of ${N} passages reached the model`), h('em', {}, `${N - n} never left the shelf`))];
    if (pl.custom && pl.done) kids.push(h('p', { class: 'nomodel' }, h('b', {}, 'No model is running.'), ' For a typed question this stop shows the real ranking and the context that would be sent: the system prompt, your question, and the passages above the cut. Pick one of the four preset questions to see a scripted answer.'));
    if (pl.out) {
      const out = pl.out;
      kids.push(h('p', { class: 'a' }, out.text));
      if (out.cites.length) kids.push(h('ul', { class: 'cites' }, out.cites.map((id) => h('li', { class: pl.revealed && out.bad.includes(id) ? 'bad' : '' }, cite(id)))));
      kids.push(pl.revealed ? h('p', { class: `v ${out.cls}`, tabindex: '-1' }, out.verdict) : h('button', { class: 'btn sm s9-check', type: 'button', onclick: () => { reveal(); const v = ansEl.querySelector('.v'); if (v) v.focus({ preventScroll: true }); } }, 'Check it against the contracts'));
    }
    ansEl.replaceChildren(...kids);
  }
  function select(id) {
    state.sel = id; renderList();
    if (id) { const c = chunkOf[id]; pickHalo.visible = true; pickHalo.position.set(c.x, c.y0 + c.rise + c.h + 0.3, c.z); } else pickHalo.visible = false;
  }
  const pickHalo = halo(0xfff1cf, 1.6); pickHalo.visible = false; world.add(pickHalo);
  async function guard(fn) {
    if (state.busy) return; state.busy = true; ui.classList.add('busy');
    try { await fn(); } finally { state.busy = false; quick = false; if (alive) { ui.classList.remove('busy'); render(); } }
  }
  function setQuery(q, wave, typed) { state.q = q; if (!typed) qIn.value = q; state.sel = null; pickHalo.visible = false; recompute(wave); if (!typed) say(q ? '<b>Every passage is scored against the question.</b> Each block rises by its real score. Nothing has reached the model yet.' : ''); else say(''); }
  async function setStale(on) { state.stale = on; sw.stale.checked = on; recompute(false); say(on ? '<b>The 2019 agreement is back in the store.</b> It was replaced in 2023. To the index it is one more document.' : 'The 2019 agreement is out of the store.'); }
  async function setFilter(on) { state.filter = on; sw.filter.checked = on; await setCage(on); recompute(false); say(on ? '<b>Access filter on.</b> The search layer leaves out files this user may not see, before anything is scored.' : '<b>Access filter off.</b> The Harrow Mills file belongs to another client. Its passages now compete with every other passage.'); }
  async function setRetr(on) { state.retr = on; sw.retr.checked = on; clearPull(); paint(); render(); say(on ? '<b>Retrieval on.</b> The search step runs before each model call.' : '<b>Retrieval off.</b> The question goes straight to the model. The library might as well not exist.'); }
  async function setup({ q = '', k = 3, stale = false, filter = true, retr = true } = {}, wave) {
    quick = true;
    state.k = k; kIn.value = String(k); kOut.textContent = String(k);
    state.stale = stale; sw.stale.checked = stale; state.retr = retr; sw.retr.checked = retr;
    if (state.filter !== filter) { state.filter = filter; sw.filter.checked = filter; await setCage(filter); }
    quick = false;
    setQuery(q, wave); if (!wave) say('');
  }
  async function ask(cfg, auto = true) { await setup(cfg, true); if (!alive) return; await wait(1.5); if (!alive) return; await retrieve(); if (!alive || !auto) return; await wait(1.6); if (!alive) return; reveal(); }

  // picking a passage on the shelf
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  const meshes = chunks.map((c) => c.m);
  function pick(e) { const r = ctx.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(meshes, false)[0]; return hit ? chunkOf[hit.object.userData.pid] : null; }
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 6) return;
    const c = pick(e); if (!c || !c.present) return;
    if (c.locked) { say(`<b>${esc(DOCS[c.p.doc].name)}.</b> Another client’s file. The access filter keeps it out of this user’s search.`); return; }
    select(c.p.id);
    const row = listEl.querySelector(`[data-id="${c.p.id}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' }); else say(`<b>${esc(DOCS[c.p.doc].name)}, ${esc(c.p.ref)}.</b> ${esc(c.p.text)}`);
  };
  const onMove = (e) => { if (e.pointerType !== 'mouse' || e.buttons) return; const c = pick(e); ctx.canvas.style.cursor = c && c.present ? 'pointer' : ''; };
  ctx.canvas.addEventListener('pointerdown', onDown); ctx.canvas.addEventListener('pointerup', onUp); ctx.canvas.addEventListener('pointermove', onMove);

  // ---------- demonstrations called from the brief ----------
  const Q = PRESETS.map((p) => p.q);
  const demos = {
    stale: () => guard(async () => { await setup({}); say('First, put a superseded contract back in the store.'); await wait(1.2); if (!alive) return; await ask({ q: Q[0], stale: true }); }),
    whole: () => guard(async () => {
      await ask({ q: Q[1] }); if (!alive) return; await wait(1.8); if (!alive) return;
      const n = state.pulled.ids.size, N = state.store.length;
      say(`<b>${n} of ${N} passages reached the model.</b> ${N - n} never left the shelf. The model does not know they exist.`);
    }),
    trained: () => guard(async () => {
      await ask({ q: Q[0], retr: false }, false); if (!alive) return; await wait(2.6); if (!alive) return;
      say('Now switch retrieval back on and ask the same model the same question.'); await wait(1.4); if (!alive) return;
      state.retr = true; sw.retr.checked = true; await retrieve(); if (!alive) return; await wait(1.2); if (!alive) return; reveal();
      say('<b>Same model, same weights.</b> The contract reached it as text in the context, for this one call. Nothing was trained.');
    }),
  };
  const beats = [
    { title: 'A library the model never read', note: 'About thirty passages cut from invented contracts, emails, and policies. None of this is in the model’s weights. It sits in a search index, as ordinary software.', run: () => guard(() => setup({})) },
    { title: 'Every passage gets a score', note: 'The question is compared with every passage in the store. Each block rises by its real similarity score, computed in your browser.', run: () => guard(async () => { await setup({ q: Q[1] }, true); await wait(1.4); }) },
    { title: 'Only the top few cross', note: 'Three passages are copied into the context and the model answers from those three. Here it is right. The rest of the library stays dark.', run: () => guard(() => ask({ q: Q[1] })) },
    { title: 'A superseded contract in the store', note: 'The 2019 agreement was replaced in 2023 and nobody removed it. To the scorer it is one more document, and its wording matches this question best.', run: () => guard(async () => { await setup({ q: Q[0], stale: true }, true); await wait(1.4); }) },
    { title: 'Faithfully cited, and wrong', note: 'The answer quotes a real clause from a real document in the store. The clause in force says ninety days. It ranked fifth and never reached the model.', run: () => guard(() => ask({ q: Q[0], stale: true })) },
    { title: 'Turn k up', note: 'With six passages the current clause gets in, and in this script the model flags the conflict. More context helps. Nothing in the pipeline knows which document is in force.', run: () => guard(() => ask({ q: Q[0], stale: true, k: 6 })) },
    { title: 'Take the access filter off', note: 'The filter decides which files this user may search. Without it, another client’s price ranks first and lands in the answer.', run: () => guard(() => ask({ q: Q[2], filter: false })) },
  ];

  // ---------- view interface ----------
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const sizeX = narrow ? 13.6 : 15.2, sizeY = narrow ? 9.4 : 10.2;
    const dist = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    const az = narrow ? 0.06 : 0.1, el = narrow ? 0.58 : 0.52;
    home.target.set(narrow ? -0.6 : -0.9, 1.5, 0.3);
    home.pos.set(home.target.x + dist * Math.sin(az) * Math.cos(el), home.target.y + dist * Math.sin(el), home.target.z + dist * Math.cos(az) * Math.cos(el));
    if (!userMoved) { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
  }
  function update(dt, t) {
    const k = motion.reduced ? 1 : Math.min(1, dt * 7);
    for (const c of chunks) {
      if (c.delay > 0) { c.delay -= dt; continue; }
      c.rise += (c.tRise - c.rise) * k; c.em += (c.tEm - c.em) * k; c.sink += (c.tSink - c.sink) * k; c.dark += (c.tDark - c.dark) * k;
      c.m.position.y = c.y0 + c.rise - c.sink * (c.h + 0.4); c.m.visible = c.sink < 0.97;
      c.mat.emissive.lerp(c.emCol, k); c.mat.emissiveIntensity = c.em * 0.55; c.mat.color.lerpColors(PAPER, LOCKED, c.dark).lerp(c.mat.emissive, Math.min(0.85, c.em * 0.9));
    }
    if (!motion.reduced) youBead.userData.halo.material.opacity = 0.75 + Math.sin(t * 2) * 0.2;
  }
  function textAlt() {
    const pl = state.pulled, rows = state.ranked.filter((r) => r.score > 0), top = topList();
    return `<p>The document store is shown as two tiers of shelves. Each upright block is one passage cut from a document, and passages from the same document stand together. A sealed box on the left is the model. It has never read the library. In front of it stands a frame, the context, which holds everything the model receives.</p>
    <p>When you enter a question, every passage is scored against it and each block rises out of the shelf by its score. The best-scoring few, the top-k, glow blue and a copy of each travels into the context frame, where it lands on top of the system prompt and your question. Only then is the model called. Every other passage stays dark on the shelf, and the model does not know it exists. One group of passages belongs to another client and stands inside a cage, which is the access filter. With the filter off, the cage lifts and those passages compete with all the others. A superseded 2019 agreement can be added to the shelf, where it looks like every other document.</p>
    <h3>Settings</h3><p>Top-k ${state.k}. Superseded 2019 agreement ${state.stale ? 'in the store' : 'not in the store'}. Access filter ${state.filter ? 'on' : 'off'}. Retrieval ${state.retr ? 'on' : 'off'}. ${state.store.length} passages in the store, ${state.eligible.length} searchable by this user.</p>
    <h3>Question</h3><p>${state.q.trim() ? esc(state.q) : 'None yet.'}</p>
    <h3>Ranking (real scores, cosine similarity of word-count vectors)</h3>${rows.length ? `<table><tr><th>Rank</th><th>Score</th><th>Passage</th><th>Sent to the model</th></tr>${rows.slice(0, 10).map((r, i) => `<tr><td>${i + 1}</td><td>${r.score.toFixed(2)}</td><td><b>${esc(cite(r.p.id))}.</b> ${esc(r.p.text)}</td><td>${top.includes(r) ? 'yes' : 'no, stayed on the shelf'}</td></tr>`).join('')}</table><p>${state.eligible.length - Math.min(10, rows.length)} more passages are not listed here. ${state.eligible.length - rows.length} of them scored 0.</p>` : '<p>No passage has a score yet.</p>'}
    <h3>What reached the model</h3>${pl ? `<ol><li><b>System prompt:</b> ${esc(SYSTEM)}</li><li><b>Your question:</b> ${esc(state.q)}</li>${pl.list.map((r) => `<li><b>Retrieved passage, ${esc(cite(r.p.id))}:</b> ${esc(r.p.text)}</li>`).join('')}</ol><p>${pl.ids.size} of ${state.store.length} passages reached the model.</p>` : '<p>Nothing has been sent yet.</p>'}
    <h3>Answer</h3>${pl && pl.out ? `<p>${esc(pl.out.text)}</p>${pl.out.cites.length ? `<p>Cited: ${pl.out.cites.map((id) => esc(cite(id))).join('; ')}.</p>` : ''}<p><b>Checked against the contracts:</b> ${esc(pl.out.verdict)}</p>` : pl && pl.custom ? '<p>No model is running. A typed question shows the ranking and the context only.</p>' : '<p>None yet.</p>'}
    <p>Real: the scoring, the ranking, top-k, and the access filter. Scripted: the passages and the four preset answers. Simplified: scores come from word counts, where production systems use learned embeddings, often with keyword search and a reranker. Every company, person, document, and figure is invented.</p>`;
  }
  addSlab({ kind: 'system', tokens: 40, text: SYSTEM }, null);
  recompute(false);
  return {
    scene, camera, controls, update, frame, textAlt, demos, beats,
    api: { state, setup, ask: (cfg, auto) => guard(() => ask(cfg, auto)), retrieve: () => guard(retrieve), reveal, setQuery },
    dispose() { alive = false; ctx.canvas.removeEventListener('pointerdown', onDown); ctx.canvas.removeEventListener('pointerup', onUp); ctx.canvas.removeEventListener('pointermove', onMove); ctx.canvas.style.cursor = ''; },
  };
}
