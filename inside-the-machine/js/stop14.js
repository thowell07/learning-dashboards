// Stop 14. Guardrails and oversight: two filters, a review desk, a log, and an explanation that is one more answer.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, cyl, paper, glow, halo, tween, wait, ease, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

// ---- the script: one batch of 20 exchanges. Every prompt, score, and answer is invented. ----
// ps = the input filter's risk score for the prompt. as = the output filter's risk score for the answer.
const EX = [
  { p: 'Summarize this lease.', ps: 0.03, a: 'A summary of the lease.', as: 0.04 },
  { p: 'A request to write a threat to a named person.', ps: 0.93, a: 'The threat.', as: 0.9, harmful: true, kind: 'Plainly harmful' },
  { p: 'What does force majeure mean?', ps: 0.02, a: 'A plain definition.', as: 0.03 },
  { p: 'Explain how an invoice fraud scheme works, for a defense brief.', ps: 0.86, a: 'A general account of the scheme.', as: 0.62, kind: 'Legitimate, and alarming to a filter' },
  { p: 'Find the leading case on a carrier’s duty to inspect sealed cargo.', ps: 0.03, a: 'Halvorsen v. Meridian Freight, 412 F.3d 558 (7th Cir. 2005).', as: 0.05, wrong: true, id: 'cite', kind: 'Harmless request, invented citation' },
  { p: 'The forgery request again, wrapped in a story about a character.', ps: 0.22, a: 'The same forgery help, told as fiction.', as: 0.31, harmful: true, kind: 'Harmful, disguised' },
  { p: 'Compare two indemnity clauses.', ps: 0.05, a: 'A side by side comparison.', as: 0.05 },
  { p: 'List the warning signs of financial abuse of an elderly client.', ps: 0.64, a: 'A list of warning signs.', as: 0.41, kind: 'Legitimate, and alarming to a filter' },
  { p: 'Draft a polite payment reminder.', ps: 0.09, a: 'A reminder letter.', as: 0.11 },
  { p: 'A request to draft a notice that hides a required disclosure.', ps: 0.42, a: 'The misleading notice.', as: 0.81, harmful: true, kind: 'Harmful, mild prompt, plain answer' },
  { p: 'Translate this clause into plain English.', ps: 0.03, a: 'The clause in plain English.', as: 0.02 },
  { p: 'Summarize the facts in an assault case file.', ps: 0.33, a: 'A factual summary that describes violence.', as: 0.74, kind: 'Legitimate, answer alarming to a filter' },
  { p: 'How long do I have to bring a contract claim?', ps: 0.06, a: 'One confident period, with no question about which jurisdiction applies.', as: 0.07, wrong: true, kind: 'Harmless request, unreliable answer' },
  { p: 'A request to forge a signature on a contract.', ps: 0.88, a: 'Forgery instructions.', as: 0.85, harmful: true, kind: 'Plainly harmful' },
  { p: 'Proofread this engagement letter.', ps: 0.02, a: 'A corrected letter.', as: 0.03 },
  { p: 'What are the elements of forgery?', ps: 0.71, a: 'The legal elements, in general terms.', as: 0.38, kind: 'Legitimate, and alarming to a filter' },
  { p: 'Draft interview questions for a witness.', ps: 0.12, a: 'A list of questions.', as: 0.1 },
  { p: 'The threat again, reworded as a friendly reminder.', ps: 0.17, a: 'A threat in polite words.', as: 0.27, harmful: true, kind: 'Harmful, disguised' },
  { p: 'Outline a privacy notice.', ps: 0.04, a: 'An outline.', as: 0.04 },
  { p: 'What notice ends the supply contract?', ps: 0.02, a: 'Ninety days in writing.', as: 0.03 },
].map((e, i) => ({ harmful: false, wrong: false, kind: 'Ordinary request', ...e, col: i }));
const WHY_Q = 'Why did you cite that case?';
const WHY_A = 'I cited Halvorsen because it is the leading authority on a carrier’s duty to inspect sealed cargo, and later courts have followed it.';
const FATE = { inB: 'Blocked at the input filter', outB: 'Blocked at the output filter', held: 'Held back by the reviewer', care: 'Delivered after a careful read', skim: 'Delivered after a skim', unseen: 'Delivered, seen by no person' };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const f2 = (v) => v.toFixed(2);

export function createStop(ctx) {
  const stop = stopByN(14);
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 80, shadow: 13, keyPos: [6, 15, 9] });
  key.target.position.set(0, 0, 1); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: V(2, 12, 16), target: V(0, 0.7, 0.9) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 6, maxDist: 55, maxPolar: 1.42, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf), PD = paper(PAL.paperDark);
  let alive = true, userMoved = false, seq = 0;
  controls.addEventListener('start', () => { userMoved = true; });

  const st = { thr: 0.5, rate: 0.25, cap: 3, logs: true, truth: true, stage: 0, sel: null, probe: false, order: EX.map((_, i) => i) };
  const shuffle = () => { const o = st.order; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } };
  shuffle();

  // ---------- geometry ----------
  // On a tall screen the line folds into three rows so the model fills the stage.
  const sr = ctx.canvas.parentElement.getBoundingClientRect(), TALL = sr.width / Math.max(1, sr.height) < 1.25;
  const SPAN = 4.2, CW = 0.3;
  const L = TALL
    ? { AX: -1.2, AZ: -1.9, BX: 1.2, BZ: 3.5, M: V(3.55, 0, -4.2), CAB: V(-3.55, 0, 1.3), care: V(-3.35, 0, 5.75), skim: V(-0.95, 0, 5.75), unseen: V(1.45, 0, 5.75), HELD: V(3.85, 0, 5.75), pawn: V(-3.4, 0, 4.15) }
    : { AX: -5.2, AZ: 0.3, BX: 5.2, BZ: 0.3, M: V(0, 0, -1.9), CAB: V(-6.4, 0, 4.9), care: V(-2.2, 0, 4.9), skim: V(1.1, 0, 4.9), unseen: V(4.4, 0, 4.9), HELD: V(-2.2, 0, 3.2), pawn: V(-3.9, 0, 4.4) };
  const AX = L.AX, BX = L.BX, MX = L.M.x, MZ = L.M.z;
  const colX = (cx, col) => cx + (col - 9.5) * CW, zA = (s) => L.AZ - s * SPAN, zB = (s) => L.BZ - s * SPAN;
  const TRAY = { care: L.care, skim: L.skim, unseen: L.unseen }, CAB = L.CAB, HELD = L.HELD;
  const slotXZ = (c, k) => [c.x + ((k % 4) - 1.5) * 0.46, c.z + (Math.floor(k / 4) - 2) * 0.4];
  const strip = (a, b) => { const d = b.clone().sub(a), len = d.length(); const m = block(0.07, 0.02, len, { color: 0x3a352e, edges: false, cast: false }); m.position.copy(a).addScaledVector(d, 0.5); m.position.y = 0.012; m.rotation.y = Math.atan2(d.x, d.z); world.add(m); };

  // two filter tables. Each slip lies at its risk score, and one bar decides.
  const bars = [];
  [[AX, zA], [BX, zB]].forEach(([cx, zf]) => {
    const t = block(20 * CW + 0.5, 0.08, SPAN + 0.9, { mat: P2 }); t.position.set(cx, 0, zf(0.5)); world.add(t);
    const zone = block(20 * CW + 0.3, 0.012, 1, { color: 0x3b2620, edges: false, cast: false }); zone.position.y = 0.085; world.add(zone);
    const bar = new THREE.Group(); world.add(bar);
    const rodMat = paper(PAL.paperDark); rodMat.emissive = new THREE.Color(PAL.verm); rodMat.emissiveIntensity = 0.5;
    const rod = block(20 * CW + 0.7, 0.07, 0.07, { mat: rodMat, edges: false }); rod.position.y = 0.34; bar.add(rod);
    [-1, 1].forEach((s) => { const p = block(0.12, 0.4, 0.12, { mat: P1 }); p.position.x = s * (10 * CW + 0.32); bar.add(p); });
    bar.position.x = cx; bars.push({ bar, zone, cx, zf });
    const side = cx < 0 ? -1 : 1;
    [0, 1].forEach((v) => ctx.tags.add(h('div', { class: `rowtag s14-axis ${side < 0 ? 'l' : ''}` }, `score ${v}`), V(cx + side * (10 * CW + 0.45), 0.1, zf(v))));
  });
  // the sealed model, as in stops 10 and 12
  const modelMat = paper(PAL.paper); modelMat.emissive = new THREE.Color(PAL.teal); modelMat.emissiveIntensity = 0; modelMat.transparent = true;
  const model = block(2.2, 2.2, 2.2, { mat: modelMat }); model.position.set(MX, 0, MZ); world.add(model);
  { const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.05, 0.15), P2, 49); const d = new THREE.Object3D(); let i = 0; for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { d.position.set(-0.81 + x * 0.27, 2.225, -0.81 + z * 0.27); d.updateMatrix(); studs.setMatrixAt(i++, d.matrix); } studs.castShadow = true; model.add(studs); }
  const slotMat = paper(0x1b1815);
  { const si = block(0.05, 0.13, 0.9, { mat: slotMat, edges: false }); si.position.set(-1.11, 0.9, 0); model.add(si);
    const so = TALL ? block(0.9, 0.13, 0.05, { mat: slotMat, edges: false }) : block(0.05, 0.13, 0.9, { mat: slotMat, edges: false }); so.position.set(TALL ? 0 : 1.11, 1.1, TALL ? 1.11 : 0); model.add(so); }
  const P_IN = V(MX - 1.25, 1.0, MZ), P_OUT = TALL ? V(MX, 1.2, MZ + 1.3) : V(MX + 1.3, 1.2, MZ);
  // the probe: a lattice inside the block, a few parts lit
  const lattice = new THREE.Group(); lattice.position.set(MX, 0.2, MZ); lattice.visible = false; world.add(lattice);
  { const dim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), paper(0x4c4741), 125); const lit = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), glow(0xf4ead2), 7);
    const d = new THREE.Object3D(), pick = new Set([7, 33, 58, 61, 84, 102, 119]); let a = 0, b = 0;
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 5; z++) { const i = x * 25 + y * 5 + z; d.position.set(-0.72 + x * 0.36, 0.18 + y * 0.36, -0.72 + z * 0.36); d.updateMatrix(); if (pick.has(i)) lit.setMatrixAt(b++, d.matrix); else dim.setMatrixAt(a++, d.matrix); }
    dim.count = a; lattice.add(dim, lit); }
  const lamp = new THREE.Group(); lamp.position.set(MX - 0.3, 3.5, MZ + 0.2); lamp.visible = false; world.add(lamp);
  { const c = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 20, 1, true), P1); c.castShadow = true; lamp.add(c); const s = block(0.04, 1.2, 0.04, { mat: PD, edges: false }); s.position.y = 0.2; lamp.add(s); const hg = halo(0xf4ead2, 2.4); hg.position.y = -0.5; lamp.add(hg); }
  // front row: the log cabinet, the review desk, and three trays
  const cab = block(2.0, 1.5, 1.3, { mat: P2 }); cab.position.copy(CAB); world.add(cab);
  [0.38, 0.76, 1.14].forEach((y) => { const l = block(1.8, 0.02, 0.02, { mat: PD, edges: false, cast: false }); l.position.set(0, y, 0.66); cab.add(l); });
  const cabGlow = halo(PAL.ember, 4.2); cabGlow.position.set(CAB.x, 1.9, CAB.z); cabGlow.material.opacity = 0; world.add(cabGlow);
  const tiles = []; for (let i = 0; i < 20; i++) { const t = block(0.05, 0.2, 0.42, { mat: glow(PAL.ember), edges: false, cast: false }); t.position.set(CAB.x - 0.76 + i * 0.08, 1.5, CAB.z); t.visible = false; world.add(t); tiles.push(t); }
  Object.values(TRAY).forEach((c) => { const t = block(2.2, 0.06, 2.3, { mat: P2 }); t.position.copy(c); world.add(t); });
  const shelf = block(2.2, 0.5, 0.7, { mat: P1 }); shelf.position.copy(HELD); world.add(shelf);
  const pawn = new THREE.Group(); pawn.position.copy(L.pawn); world.add(pawn);
  pawn.add(cyl(0.3, 0.9, { mat: P1, r2: 0.16 })); { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), P1); hd.position.y = 1.1; hd.castShadow = true; pawn.add(hd); }
  strip(V(AX + 10 * CW + 0.3, 0, MZ), V(MX - 1.1, 0, MZ));
  if (TALL) strip(V(MX, 0, MZ + 1.1), V(BX + 2.3, 0, zB(1) - 0.45)); else strip(V(MX + 1.1, 0, MZ), V(BX - 10 * CW - 0.3, 0, MZ));
  [['unseen', 2.8], ['skim', 2.8], ['care', 3.2]].forEach(([k, m]) => strip(V(BX + Math.max(-m, Math.min(m, TRAY[k].x - BX)), 0, L.BZ + 0.5), V(TRAY[k].x, 0, TRAY[k].z - 1.2)));
  if (TALL) strip(V(BX + 2.8, 0, L.BZ + 0.5), V(HELD.x, 0, HELD.z - 0.4));
  strip(V(AX - 2, 0, L.AZ + 0.5), V(CAB.x, 0, CAB.z - 0.7)); if (!TALL) strip(V(MX - 0.6, 0, MZ + 1.1), V(CAB.x + 0.6, 0, CAB.z - 0.7));
  // station halos, lit when a record is read back
  const SP = { prompt: V(AX, 0.6, zA(0.1)), inF: V(AX, 0.6, zA(0.5)), model: V(MX, 2.6, MZ), outF: V(BX, 0.6, zB(0.5)), review: V(L.pawn.x + 0.7, 1.4, L.pawn.z + 0.2), deliver: V(TRAY.unseen.x, 0.6, TRAY.unseen.z) };
  const spot = {}; Object.entries(SP).forEach(([k, p]) => { const s = halo(PAL.ember, 3.6); s.position.copy(p); s.material.opacity = 0; world.add(s); spot[k] = s; });

  // tags
  const lt = (title, sub, pos, cls = '') => { const b = h('b', {}, title), s = h('span', {}, sub); const t = ctx.tags.add(h('div', { class: `looptag ${cls}` }, b, s), pos); return { b, s, el: t.el }; };
  lt('Input filter', 'Each prompt lies at its risk score', V(AX, 0.5, zA(1) - 0.7));
  lt('Output filter', 'Each answer lies at its risk score', V(BX, 0.5, zB(1) - 0.7));
  lt('Model', 'Sealed. Writes text.', V(MX, 2.9, MZ - 0.5));
  const tLog = lt('Log', '', V(CAB.x, 2.2, CAB.z));
  const tCare = lt(TALL ? 'With care' : 'Read with care', '', V(TRAY.care.x, 0.1, TRAY.care.z + 1.3), 's14-below'), tSkim = lt('Skimmed', '', V(TRAY.skim.x, 0.1, TRAY.skim.z + 1.3), 's14-below'), tUns = lt(TALL ? 'Unseen' : 'No person saw', '', V(TRAY.unseen.x, 0.1, TRAY.unseen.z + 1.3), 's14-below');
  const tHeld = lt('Held back', '', V(HELD.x, 1.0, HELD.z - 0.3));
  const barTags = bars.map((b) => { const side = b.cx < 0 ? -1 : 1, el = h('div', { class: `rowtag s14-bartag ${side < 0 ? 'l' : ''}` }, ''); ctx.tags.add(el, () => _v.set(b.cx + side * (10 * CW + 0.5), 0.4, b.bar.position.z)); return el; });
  const tProbe = lt('Research probe', 'A few parts named. Most stay dark.', V(MX - 0.3, 5.0, MZ)); tProbe.el.style.display = 'none';
  const _v = new THREE.Vector3();

  // ---------- slips ----------
  const COL = { ember: new THREE.Color(PAL.ember), emberDim: new THREE.Color(0x6e4712), verm: new THREE.Color(PAL.verm), vermDim: new THREE.Color(0x6e2a1c), teal: new THREE.Color(PAL.teal), tealDim: new THREE.Color(0x2c554e), grey: new THREE.Color(0xb3ac9c), greyDim: new THREE.Color(0x56514a) };
  const slips = [];
  EX.forEach((e) => {
    const pm = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.05, 0.36), glow(PAL.ember)); pm.userData.ex = e; world.add(pm);
    const am = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.05, 0.36), paper(PAL.teal)); am.castShadow = true; am.userData.ex = e; am.scale.setScalar(0.001); am.position.copy(P_OUT); world.add(am);
    if (e.harmful) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.056, 0.11), glow(PAL.verm)); am.add(b); am.userData.mark = b; }
    if (e.wrong) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.056, 0.11), glow(PAL.verm)); b.position.set(0.085, 0, 0.13); am.add(b); am.userData.mark = b; }
    e.pm = pm; e.am = am; e.pt = { x: 0, y: 0.16, z: 0, c: COL.ember }; e.at = { x: P_OUT.x, y: P_OUT.y, z: P_OUT.z, s: 0.001, c: COL.teal }; e.sp = 5 + ((e.col * 7) % 11) * 0.7;
    pm.position.set(colX(AX, e.col), 0.16, zA(e.ps));
    slips.push(pm, am);
  });
  const selTagP = ctx.tags.add(h('div', { class: 'notetag s14-seltag' }, ''), () => (st.sel ? st.sel.pm.position : _v.set(0, 0, 0))); selTagP.el.style.display = 'none';
  const selTagA = ctx.tags.add(h('div', { class: 'notetag s14-seltag s14-ans' }, ''), () => (st.sel ? st.sel.am.position : _v.set(0, 0, 0))); selTagA.el.style.display = 'none';

  // ---------- the arithmetic (all of it runs live) ----------
  function compute() {
    const t = st.thr;
    for (const e of EX) { e.inB = e.ps >= t; e.outB = !e.inB && e.as >= t; e.pass = !e.inB && !e.outB; e.review = null; e.held = false; }
    const through = st.order.map((i) => EX[i]).filter((e) => e.pass), nS = Math.round(st.rate * through.length);
    through.forEach((e, k) => { e.review = k >= nS ? 'unseen' : k < st.cap ? 'care' : 'skim'; e.held = e.review === 'care' && (e.harmful || e.wrong); });
    const c = { hb: 0, ht: 0, okd: 0, okb: 0, wrong: 0, wrongPass: 0, unseen: 0, skim: 0, care: 0, held: 0, bad: 0, badOut: 0, through: through.length, sampled: nS };
    for (const e of EX) {
      if (e.harmful) c[e.pass ? 'ht' : 'hb']++; else c[e.pass ? 'okd' : 'okb']++;
      if (e.wrong) { c.wrong++; if (e.pass) c.wrongPass++; }
      if (e.pass) { c[e.review]++; if (e.held) c.held++; if (e.harmful || e.wrong) { c.bad++; if (!e.held) c.badOut++; } }
      e.fate = e.inB ? 'inB' : e.outB ? 'outB' : e.held ? 'held' : e.review;
    }
    return c;
  }
  const errorsAt = (t) => EX.reduce((n, e) => { const pass = e.ps < t && e.as < t; return n + (e.harmful === pass ? 1 : 0); }, 0);
  function bestThreshold() { let best = { t: 0.5, n: 99 }; for (let i = 5; i <= 95; i++) { const t = i / 100, n = errorsAt(t); if (n < best.n) best = { t, n }; } return best; }
  const incident = () => { const live = (e) => e.pass && !e.held && (e.wrong || e.harmful); const c = EX.find((e) => e.id === 'cite'); return live(c) ? c : EX.find(live) || null; };

  // ---------- layout ----------
  function layout() {
    const c = compute(), k = { care: 0, skim: 0, unseen: 0, held: 0 };
    bars.forEach((b) => { const z = b.zf(st.thr); b.tz = z; const back = b.zf(1) - 0.4; b.zone.position.set(b.cx, 0.085, (z + back) / 2); b.zone.scale.z = Math.max(0.01, z - back); });
    for (const e of EX) {
      const lift = st.sel === e ? 0.4 : 0;
      e.pt.x = colX(AX, e.col); e.pt.z = zA(e.ps); e.pt.y = (e.inB ? 0.11 : 0.19) + lift;
      e.pt.c = !st.truth ? (e.inB ? COL.greyDim : COL.grey) : e.harmful ? (e.inB ? COL.vermDim : COL.verm) : e.inB ? COL.emberDim : COL.ember;
      const a = e.at; a.c = !st.truth ? (e.outB ? COL.greyDim : COL.grey) : e.outB ? COL.tealDim : COL.teal;
      if (e.am.userData.mark) e.am.userData.mark.visible = st.truth;
      if (st.stage === 0 || e.inB) { a.x = P_OUT.x; a.y = P_OUT.y; a.z = P_OUT.z; a.s = 0.001; }
      else if (st.stage === 1 || e.outB) { a.x = colX(BX, e.col); a.z = zB(e.as); a.y = (e.outB ? 0.11 : 0.19) + lift; a.s = 1; }
      else if (e.held) { const i = k.held++; a.x = HELD.x - 0.96 + i * 0.32; a.z = HELD.z; a.y = 0.54 + lift; a.s = 1; }
      else { const [x, z] = slotXZ(TRAY[e.review], k[e.review]++); a.x = x; a.z = z; a.y = 0.1 + lift; a.s = 1; }
    }
    const done = st.stage === 2;
    tCare.s.textContent = done ? `${c.care - c.held} approved` : ''; tSkim.s.textContent = done ? `${c.skim} approved in seconds` : ''; tUns.s.textContent = done ? `${c.unseen} delivered` : ''; tHeld.s.textContent = done ? `${c.held} stopped` : '';
    tLog.b.textContent = st.logs ? 'Log · on' : 'Log · off'; tLog.s.textContent = st.logs ? (st.stage ? '20 records. Stored copies of user data.' : 'Ready to record') : 'Nothing is kept';
    tLog.el.classList.toggle('off', !st.logs);
    tiles.forEach((t) => { t.visible = st.logs && st.stage > 0; });
    barTags.forEach((el) => { el.textContent = `bar at ${f2(st.thr)}`; });
    if (st.sel) { selTagP.el.textContent = st.sel.p; selTagA.el.textContent = st.sel.a; selTagA.el.style.display = st.sel.at.s > 0.5 ? '' : 'none'; }
    return c;
  }

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption s14-cap', role: 'status' });
  const say = (html) => { caption.innerHTML = html || ''; };
  const cells = {}; const cell = (k, label, cls = '') => { cells[k] = h('b', {}, '0'); return h('div', { class: cls }, cells[k], h('span', {}, label)); };
  const accLine = h('p', { class: 's14-line' }), revLine = h('p', { class: 's14-line' });
  const listEl = h('ol', { class: 's14-list', 'aria-label': 'Every slip in the batch' });
  const detail = h('div', { class: 's14-detail' });
  const detailCap = h('span', { class: 'cap' }, '');
  const detailPlate = h('div', { class: 'plate wide s14-plate', hidden: true }, h('div', { class: 'plate-h' }, detailCap, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { seq++; closeDetail(); } }, 'Close')), h('div', { class: 'plate-b' }, detail));
  const out = { thr: h('output', { for: 's14-thr' }, ''), rate: h('output', { for: 's14-rate' }, ''), cap: h('output', { for: 's14-cap' }, '') };
  const inThr = h('input', { type: 'range', id: 's14-thr', min: '0.05', max: '0.95', step: '0.01', value: '0.5', oninput: (e) => { seq++; st.thr = Number(e.target.value); const c = render(); say(`<b>Blocks at ${f2(st.thr)} and above.</b> ${c.ht} harmful ${c.ht === 1 ? 'request' : 'requests'} got through. ${c.okb} harmless ${c.okb === 1 ? 'request was' : 'requests were'} blocked.`); } });
  const inRate = h('input', { type: 'range', id: 's14-rate', min: '0', max: '1', step: '0.05', value: '0.25', oninput: (e) => { seq++; st.rate = Number(e.target.value); showStage2(); const c = render(); say(`<b>${Math.round(st.rate * 100)}% sampled.</b> ${c.sampled} of ${c.through} answers reach the desk. ${c.unseen} go out with no person seeing them.`); } });
  const inCap = h('input', { type: 'range', id: 's14-cap', min: '0', max: '20', step: '1', value: '3', oninput: (e) => { seq++; st.cap = Number(e.target.value); showStage2(); const c = render(); say(`<b>Time for ${st.cap} careful ${st.cap === 1 ? 'read' : 'reads'}.</b> ${c.care} read with care, ${c.skim} skimmed and approved.`); } });
  const swLogs = h('input', { type: 'checkbox', checked: true, onchange: (e) => { seq++; st.logs = e.target.checked; render(); cabLight(); say(st.logs ? '<b>Logging on.</b> Every station writes a record. The cabinet now holds copies of every prompt and answer.' : '<b>Logging off.</b> Nothing is stored. Nothing can be reconstructed later.'); } });
  const swTruth = h('input', { type: 'checkbox', checked: true, onchange: (e) => { seq++; st.truth = e.target.checked; render(); say(st.truth ? 'Color is our annotation. Vermilion slips are harmful requests. Ember slips are ordinary user requests.' : '<b>As the filter sees it.</b> A slip is a position on a score line. The filter never sees which ones are harmful.'); } });
  const runBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => runBatch() }, 'Run the batch');
  const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { seq++; reset(); say(''); } }, 'Start over');
  const traceBtn = h('button', { class: 'btn', type: 'button', onclick: () => trace() }, 'Reconstruct an incident');
  const whyBtn = h('button', { class: 'btn', type: 'button', onclick: () => askWhy() }, 'Ask the model why');
  const swProbe = h('input', { type: 'checkbox', onchange: (e) => { seq++; setProbe(e.target.checked); say(st.probe ? '<b>Interpretability research</b> can name a few of the parts at work inside a model. Most of the computation stays unmapped.' : ''); } });
  const ui = h('section', { class: 'stop', 'aria-label': 'Stop 14, Guardrails and oversight' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 14 · The gate in the wall'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' }, h('span', {}, h('b', {}, 'Scripted'), 'All 20 prompts, their risk scores, and every answer. A careful read catches every bad answer here and a skim catches none.'), h('span', {}, h('b', {}, 'Real'), 'The threshold logic, the random review sample, every count, and your settings.'), h('span', {}, h('b', {}, 'Simplified'), 'One filter each side, one score per slip, one threshold for both.')),
      detailPlate,
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'The filters'), h('span', { class: 'cap' }, 'Counted live')),
        h('div', { class: 'plate-b' }, h('div', { class: 's14-grid' }, cell('hb', 'Harmful, blocked'), cell('ht', 'Harmful, got through', 'bad'), cell('okd', 'Harmless, passed'), cell('okb', 'Harmless, blocked', 'warn')), accLine)),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Human review'), h('span', { class: 'cap' }, 'Counted live')),
        h('div', { class: 'plate-b' }, h('div', { class: 'tally s14-tally' }, cell('unseen', 'No person saw', 'bad'), cell('skim', 'Skimmed'), cell('care', 'Read with care')), revLine)),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Every slip'), h('span', { class: 'cap' }, 'Invented batch')), h('div', { class: 'plate-b' }, listEl))),
    h('div', { class: 'deck plate s14-deck' },
      h('div', { class: 'grp' }, runBtn, resetBtn),
      h('div', { class: 'slider' }, h('label', { for: 's14-thr' }, 'Filter threshold'), out.thr, inThr),
      h('div', { class: 'slider' }, h('label', { for: 's14-rate' }, 'Review sample'), out.rate, inRate),
      h('div', { class: 'slider' }, h('label', { for: 's14-cap' }, 'Careful reads'), out.cap, inCap),
      h('label', { class: 'switch' }, swLogs, h('i'), 'Keep logs'),
      h('label', { class: 'switch' }, swTruth, h('i'), 'True colors'),
      h('div', { class: 'grp' }, traceBtn, whyBtn),
      h('label', { class: 'switch' }, swProbe, h('i'), 'Probe lamp')),
  );
  ctx.hud.append(ui, caption);

  function render() {
    const c = layout();
    ['hb', 'ht', 'okd', 'okb', 'unseen', 'skim', 'care'].forEach((k) => { cells[k].textContent = st.stage < 2 && ['unseen', 'skim', 'care'].includes(k) ? '·' : String(c[k]); });
    accLine.textContent = `Inaccurate answers that passed both filters: ${c.wrongPass} of ${c.wrong}. The filters score harm. Nothing in this line scores accuracy.`;
    revLine.textContent = st.stage < 2 ? 'Run the batch to send answers to the desk.' : `${c.sampled} of ${c.through} answers were sampled. Bad answers that reached a user: ${c.badOut} of ${c.bad}. Stopped at the desk: ${c.held}.`;
    out.thr.textContent = f2(st.thr); out.rate.textContent = `${Math.round(st.rate * 100)}%`; out.cap.textContent = String(st.cap);
    inThr.value = String(st.thr); inRate.value = String(st.rate); inCap.value = String(st.cap); swLogs.checked = st.logs; swTruth.checked = st.truth; swProbe.checked = st.probe;
    listEl.replaceChildren(...EX.map((e) => {
      const fate = e.fate === 'inB' || (e.fate === 'outB' && st.stage > 0) || st.stage === 2 ? FATE[e.fate] : st.stage === 1 ? 'Passed both filters' : 'Passed the input filter';
      const bad = (e.harmful || e.wrong) && e.pass && !e.held, over = !e.harmful && !e.pass;
      return h('li', {}, h('button', { type: 'button', class: `${st.sel === e ? 'sel' : ''} ${bad ? 'bad' : over ? 'warn' : ''}`, 'aria-pressed': String(st.sel === e), onclick: () => { seq++; select(st.sel === e ? null : e); } },
        h('i', { class: e.harmful ? 'v' : 'e', 'aria-hidden': 'true' }), h('span', { class: 'tx' }, e.p), h('span', { class: 'sc' }, `in ${f2(e.ps)} · out ${f2(e.as)}`), h('span', { class: 'ft' }, `${e.harmful ? 'Harmful' : e.wrong ? 'Harmless, answer wrong' : 'Harmless'} · ${fate}`)));
    }));
    if (st.sel && detailCap.textContent === 'One slip') renderSlip();
    return c;
  }
  function closeDetail() { detailPlate.hidden = true; detailCap.textContent = ''; if (st.sel) { st.sel = null; selTagP.el.style.display = 'none'; selTagA.el.style.display = 'none'; render(); } clearWhy(); }
  function openDetail(cap, ...kids) {
    const fresh = detailPlate.hidden || detailCap.textContent !== cap;
    detailCap.textContent = cap; detail.replaceChildren(...kids); detailPlate.hidden = false;
    if (!fresh) return;
    ui.querySelector('.readout').scrollTop = 0;
    if (ctx.isNarrow() && !document.body.classList.contains('guide-on')) detailPlate.scrollIntoView({ block: 'nearest', behavior: motion.reduced ? 'auto' : 'smooth' });
  }
  function setSel(e) { st.sel = e; selTagP.el.style.display = e ? '' : 'none'; if (!e) selTagA.el.style.display = 'none'; }
  function renderSlip() {
    const e = st.sel;
    openDetail('One slip',
      h('div', { class: 's14-kind' }, h('span', { class: `cap ${e.harmful ? 'verm' : 'ember'}` }, e.harmful ? 'Harmful request' : 'Harmless request'), h('span', { class: 'cap' }, e.kind)),
      h('dl', { class: 's14-qa' }, h('dt', {}, 'Prompt'), h('dd', {}, e.p), h('dt', {}, `Input filter score ${f2(e.ps)}`), h('dd', {}, e.inB ? `Blocked. The score is at or above ${f2(st.thr)}.` : `Passed. The score is below ${f2(st.thr)}.`),
        e.inB ? null : h('dt', {}, 'Answer'), e.inB ? null : h('dd', { class: 'ans' }, e.a),
        e.inB ? null : h('dt', {}, `Output filter score ${f2(e.as)}`), e.inB ? null : h('dd', {}, e.outB ? 'Blocked.' : 'Passed.'),
        e.pass ? h('dt', {}, 'Human review') : null, e.pass ? h('dd', {}, st.stage < 2 ? 'Run the batch to see.' : FATE[e.fate] + '.') : null),
      e.wrong ? h('p', { class: 's14-note' }, 'This answer is wrong and harmless in tone. A harm filter gives it a low score at every threshold.') : null,
      !e.harmful && !e.pass ? h('p', { class: 's14-note' }, 'A legitimate request that reads as risky. Blocking it is a cost the user pays.') : null,
      e.harmful && e.pass ? h('p', { class: 's14-note' }, 'A harmful request in harmless wording. Its score sits among ordinary requests.') : null,
      h('p', { class: 'invented' }, 'Invented example. The slip names a kind of request and gives no usable detail.'));
  }
  function select(e) { clearWhy(); setSel(e); render(); if (e) { renderSlip(); ctx.announce(`${e.p} ${e.harmful ? 'Harmful request.' : 'Harmless request.'} ${FATE[e.fate] || ''}`); } else { detailPlate.hidden = true; detailCap.textContent = ''; } }

  // ---------- moving parts ----------
  const pulse = (mat, peak = 0.6, dur = 0.9) => tween({ dur, e: ease.lin, update: (k) => { mat.emissiveIntensity = Math.sin(k * Math.PI) * peak; } });
  const flash = (s, peak = 0.9, dur = 1.1) => tween({ dur, e: ease.lin, update: (k) => { s.material.opacity = Math.sin(k * Math.PI) * peak; } });
  function cabLight() { cabGlow.material.opacity = st.logs ? 0.55 : 0; }
  function setProbe(on) {
    st.probe = on; swProbe.checked = on; lattice.visible = on; lamp.visible = on; tProbe.el.style.display = on ? '' : 'none';
    tween({ dur: 0.6, update: (k) => { modelMat.opacity = on ? 1 - k * 0.84 : 0.16 + k * 0.84; } }); modelMat.depthWrite = !on;
  }
  const notes = [];
  function note(color, text, cls = '') { const m = block(0.86, 0.06, 0.56, { color, edges: true }); const hl = halo(color, 1.5); hl.position.y = 0.1; hl.material.opacity = 0.5; m.add(hl); world.add(m); const tag = ctx.tags.add(h('div', { class: `notetag ${cls}` }, text), m); notes.push({ m, tag }); return m; }
  function clearWhy() { notes.splice(0).forEach((n) => { n.tag.remove(); world.remove(n.m); n.m.traverse((o) => { o.geometry && o.geometry.dispose(); }); }); }
  const travel = (o, a, b, dur = 0.8, arc = 0.6) => { o.position.copy(a); return tween({ dur, update: (k) => { o.position.lerpVectors(a, b, k); o.position.y += Math.sin(k * Math.PI) * arc; } }); };
  function showStage2() { if (st.stage < 2) st.stage = 2; }
  function reset() { clearWhy(); setSel(null); detailPlate.hidden = true; detailCap.textContent = ''; if (st.probe) setProbe(false); st.stage = 0; for (const e of EX) { e.am.position.copy(P_OUT); e.am.scale.setScalar(0.001); } render(); runBtn.textContent = 'Run the batch'; }

  const begin = () => { const my = ++seq; return () => alive && my === seq; };
  async function runBatch(ok = begin()) {
    reset(); shuffle();
    say('Twenty prompts arrive. The <b>input filter</b> gives each one a risk score and lays it on the table at that score.');
    await wait(1.5); if (!ok()) return;
    st.stage = 1; render(); pulse(modelMat);
    say('Prompts in front of the bar go to the model. Each answer gets its own score at the <b>output filter</b>.');
    await wait(1.9); if (!ok()) return;
    st.stage = 2; const c = render(); runBtn.textContent = 'Run it again';
    say(`<b>${c.through} answers passed.</b> ${c.sampled} were sampled for review. ${c.unseen} reached a user with no person seeing them.`);
    ctx.announce(`Batch complete. ${c.hb} harmful blocked, ${c.ht} harmful got through, ${c.okb} harmless blocked. ${c.unseen} answers reached a user with no person seeing them.`);
    await wait(1.0);
  }
  async function trace(ok = begin()) {
    clearWhy(); showStage2(); render();
    const e = incident();
    if (!e) { openDetail('Incident trace', h('p', { class: 's14-note' }, 'Under these settings no bad answer reached a user. Lower the review sample or the careful reads and one will.')); return; }
    setSel(e); render();
    const rows = [
      ['deliver', 'Delivery', `Answer released to user U-2041 at 14:07:19: “${e.a}”`],
      ['review', 'Human review', e.review === 'unseen' ? 'Not sampled. No person saw this answer before it went out.' : 'Sampled. Approved in four seconds by a reviewer with a full queue.'],
      ['outF', 'Output filter', `Scored ${f2(e.as)} against a threshold of ${f2(st.thr)}. Passed.`],
      ['model', 'Model', 'Version m-2026-03, temperature 0.7, the full prompt as sent.'],
      ['inF', 'Input filter', `Scored ${f2(e.ps)}. Passed.`],
      ['prompt', 'Prompt', `“${e.p}” User U-2041, 14:07:12.`],
    ];
    const ol = h('ol', { class: 's14-trace' });
    openDetail('Incident trace', h('p', { class: 's14-inc' }, e.wrong ? 'A client reports that a cited case does not exist. What did the system see and do?' : 'A harmful answer reached a user. What did the system see and do?'), ol,
      h('p', { class: 'invented' }, 'Invented records. The user, the times, and the version name are made up.'));
    say(st.logs ? '<b>Logs on.</b> Walk the answer back through every station.' : '<b>Logs off.</b> Ask each station what it saw.');
    for (const [k, who, text] of rows) {
      const li = h('li', { class: st.logs ? 'lit' : 'dark' }, h('b', {}, who), h('span', {}, st.logs ? text : 'No record.')); ol.append(li);
      if (st.logs) flash(spot[k]);
      await wait(0.75); if (!ok()) return;
    }
    say(st.logs ? '<b>Every step has a record.</b> You can say what the system saw, what it did, and that no check on accuracy stood in the path. The same cabinet is a store of user data.' : '<b>No records.</b> The question "what did the system see and do" has no answer. Nothing was stored, and nothing can be shown.');
    ctx.announce(st.logs ? 'Incident reconstructed from six records.' : 'Logs are off. No station has a record.');
  }
  async function askWhy(ok = begin()) {
    clearWhy(); const e = EX.find((x) => x.id === 'cite');
    if (st.thr <= e.as) st.thr = 0.5;
    showStage2(); setSel(e); render();
    openDetail('Ask the model why', h('dl', { class: 's14-qa' }, h('dt', {}, 'The answer it gave'), h('dd', { class: 'ans' }, e.a), h('dt', {}, 'You ask'), h('dd', { class: 'usr' }, WHY_Q)));
    say('You ask the model to explain its own answer. The question goes in as one more prompt.');
    const a0 = note(PAL.teal, 'answer', 's14-ans'); a0.position.copy(TALL ? V(MX + 0.8, 1.5, P_OUT.z + 0.5) : V(P_OUT.x + 0.5, 1.5, MZ + 0.75));
    const q = note(PAL.ember, WHY_Q); await travel(q, P_IN.clone().add(V(-2.4, -0.2, 3.6)), P_IN, 0.9, 0.9); if (!ok()) return;
    const qn = notes.find((n) => n.m === q); if (qn) { qn.tag.remove(); world.remove(q); notes.splice(notes.indexOf(qn), 1); }
    await pulse(modelMat, 0.7, 1.0); if (!ok()) return;
    const ex = note(PAL.teal, 'explanation', 's14-ans'); await travel(ex, P_OUT, TALL ? V(MX - 0.8, 1.5, P_OUT.z + 0.5) : V(P_OUT.x + 0.5, 1.5, MZ - 0.75), 0.8, 0.5); if (!ok()) return;
    detail.querySelector('dl').append(h('dt', {}, 'The model replies'), h('dd', { class: 'ans' }, WHY_A));
    detail.append(h('p', { class: 's14-note' }, 'Same slot. Same kind of slip. The reply was drawn token by token, the way stop 4 shows, after the answer already existed. It reads as a reason, and it adds a new claim that is also invented.'),
      h('p', { class: 'invented' }, 'Scripted reply. No model is running.'));
    say('<b>The explanation is another answer.</b> It left the same slot as the answer it explains. Nothing here read out what the model computed.');
    ctx.announce(`The model replies: ${WHY_A} This explanation is generated text, produced the same way as the answer.`);
  }

  // picking slips in 3D
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => { if (!down) return; const m = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (m > 6) return; const r = ctx.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); const x = ray.intersectObjects(slips, false).find((i) => i.object.scale.x > 0.5); if (x) { seq++; select(x.object.userData.ex); } };
  ctx.canvas.addEventListener('pointerdown', onDown); ctx.canvas.addEventListener('pointerup', onUp);

  // ---------- demos and beats ----------
  const sweepTo = (to, dur) => { const from = st.thr; return tween({ dur, e: ease.io, update: (k) => { st.thr = Math.round(lerp(from, to, k) * 100) / 100; render(); } }); };
  const demos = {
    sweep: async () => {
      const ok = begin(); closeDetail(); st.truth = true; showStage2(); st.thr = 0.9; render();
      say('Drag the bar from loose to strict and count the mistakes at each position.');
      await wait(1.0); if (!ok()) return;
      await sweepTo(0.1, 5.5); if (!ok()) return;
      const b = bestThreshold(); await sweepTo(b.t, 1.2); if (!ok()) return;
      const c = render();
      say(`<b>The best position, ${f2(b.t)}, still makes ${b.n} mistakes.</b> ${c.ht} harmful got through and ${c.okb} harmless ${c.okb === 1 ? 'was' : 'were'} blocked. The disguised requests score lower than the legitimate ones, so no bar separates them. ${c.wrongPass} wrong ${c.wrongPass === 1 ? 'answer' : 'answers'} passed untouched.`);
    },
    review: async () => {
      const ok = begin(); closeDetail(); st.thr = 0.5; st.rate = 0.1; st.cap = 3; showStage2(); shuffle(); let c = render();
      say(`<b>A person reviews 10%.</b> ${c.sampled} of ${c.through} answers reach the desk. ${c.unseen} go out unseen.`);
      await wait(2.6); if (!ok()) return;
      st.rate = 1; c = render();
      say(`<b>Now a person reviews everything.</b> There is time for ${st.cap} careful reads. The other ${c.skim} are skimmed and approved. ${c.badOut} of ${c.bad} bad answers still reach a user.`);
    },
    why: async () => { const ok = begin(); closeDetail(); await askWhy(ok); if (!ok()) return; await wait(1.6); if (!ok()) return; setProbe(true); say('<b>The explanation is another answer.</b> A research probe, shown as a lamp, can name a few of the parts at work inside. Most of the computation stays unmapped.'); },
  };
  const beats = [
    { title: 'Every prompt gets a score', note: 'Twenty prompts lie on the left table, each at the risk score the input filter gave it. Ember slips are ordinary requests. Vermilion slips are harmful ones.', run: async () => { const ok = begin(); st.truth = true; st.thr = 0.5; reset(); say('A filter is a scorer and a bar. Nothing more.'); await wait(0.8); ok(); } },
    { title: 'One bar decides', note: 'Everything at or behind the bar is blocked. Look for ember slips behind it and vermilion slips in front of it.', run: async () => { const ok = begin(); st.truth = true; reset(); st.thr = 0.9; render(); await sweepTo(0.5, 1.4); if (!ok()) return; const c = render(); say(`At 0.50: <b>${c.okb} harmless blocked</b>, and the disguised requests sit in front of the bar.`); } },
    { title: 'No position is clean', note: 'The bar sweeps the whole table. The count of mistakes never reaches zero, because the disguised requests score lower than the legitimate ones.', run: async () => { await demos.sweep(); } },
    { title: 'Answers are screened too', note: 'The output filter catches one harmful answer the input filter let pass. The invented citation scores 0.05 and walks through, because the filter scores harm.', run: async () => { const ok = begin(); st.thr = 0.5; st.truth = true; reset(); await wait(0.5); if (!ok()) return; st.stage = 1; const c = render(); pulse(modelMat); select(EX.find((e) => e.id === 'cite')); say(`<b>${c.wrongPass} wrong answers passed both filters.</b>`); await wait(1.2); ok(); } },
    { title: 'Review sees a sample', note: 'A quarter of the answers reach the desk and there is time to read three with care. The big tray on the right is everything no person saw.', run: async () => { const ok = begin(); closeDetail(); st.thr = 0.5; st.rate = 0.25; st.cap = 3; st.stage = 2; shuffle(); const c = render(); say(`<b>${c.unseen} of ${c.through}</b> answers reached a user with no person seeing them.`); await wait(1.3); ok(); } },
    { title: 'Logs are evidence and stored data', note: 'With logs on, one bad answer is traced back through every station. The lit cabinet is also a store of every prompt and answer.', run: async () => { const ok = begin(); st.thr = 0.5; st.rate = 0.25; st.cap = 3; st.logs = true; cabLight(); st.stage = 2; render(); await trace(ok); } },
    { title: 'The explanation is another answer', note: 'Asked why, the model sends a second teal slip out of the same slot. It is generated text. The lamp marks how little of the inside research can name so far.', run: async () => { await demos.why(); } },
  ];

  // ---------- view interface ----------
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), portrait = freeW / freeH < 0.9;
    const sizeX = TALL ? 11.8 : 20.4, sizeY = TALL ? (portrait ? 19 : 18.4) : 13.6;
    const d = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    const az = TALL ? 0 : 0.12, el = TALL ? 1.0 : 0.9;
    home.target.set(TALL ? 0.2 : 0, 0.5, TALL ? -0.3 : 1.1);
    home.pos.set(home.target.x + d * Math.sin(az) * Math.cos(el), home.target.y + d * Math.sin(el), home.target.z + d * Math.cos(az) * Math.cos(el));
    scene.fog.near = Math.max(30, d * 1.1); scene.fog.far = Math.max(80, d * 2.8);
    if (!userMoved) { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
    const dk = ui.querySelector('.deck'); if (dk) caption.style.setProperty('--dk', `${Math.round(dk.getBoundingClientRect().height)}px`);
  }
  function update(dt) {
    const r = motion.reduced;
    for (const b of bars) b.bar.position.z = r ? b.tz : lerp(b.bar.position.z, b.tz, Math.min(1, dt * 14));
    for (const e of EX) {
      const k = r ? 1 : Math.min(1, dt * e.sp), p = e.pm.position, a = e.am.position;
      p.x = lerp(p.x, e.pt.x, k); p.y = lerp(p.y, e.pt.y, k); p.z = lerp(p.z, e.pt.z, k); e.pm.material.color.lerp(e.pt.c, k);
      a.x = lerp(a.x, e.at.x, k); a.y = lerp(a.y, e.at.y, k); a.z = lerp(a.z, e.at.z, k); e.am.scale.setScalar(lerp(e.am.scale.x, e.at.s, k)); e.am.material.color.lerp(e.at.c, k);
      e.am.visible = e.am.scale.x > 0.01;
    }
  }
  function textAlt() {
    const c = compute(), b = bestThreshold();
    return `<p>Two tables stand either side of a sealed model block. On the left table lie 20 prompts. Each one sits at the risk score the input filter gave it, from 0 at the front edge to 1 at the back, and a bar across the table marks the threshold. A prompt at or behind the bar is blocked. Prompts in front of the bar go into the model, and each answer is laid on the right table at the score the output filter gave it, with the same bar. Answers in front of that bar move to the front row: a tray of answers a reviewer read with care, a tray of answers a reviewer skimmed, and a tray of answers no person saw. A log cabinet stands at the left of the front row and glows when logging is on, because it holds copies of every prompt and answer.</p>
    <p>Harmful requests are drawn in vermilion and ordinary requests in ember. Two harmful requests are disguised in harmless wording and score low. Three legitimate requests read as risky and score high. No threshold blocks every harmful request and passes every harmless one: the lowest count of mistakes is ${b.n}, at a threshold of ${f2(b.t)}. Two answers are wrong and harmless in tone, and they pass at every threshold because the filters score harm.</p>
    <h3>Settings now</h3>
    <ul><li>Filter threshold: blocks at ${f2(st.thr)} and above</li><li>Review sample: ${Math.round(st.rate * 100)}% of delivered answers, chosen at random</li><li>Careful reads available: ${st.cap}</li><li>Logs: ${st.logs ? 'on. Every station keeps a record, and the records are stored copies of user data.' : 'off. Nothing is stored and nothing can be reconstructed.'}</li></ul>
    <h3>The filters</h3><p>Harmful and blocked: ${c.hb}. Harmful and got through: ${c.ht}. Harmless and passed: ${c.okd}. Harmless and blocked: ${c.okb}. Inaccurate answers that passed both filters: ${c.wrongPass} of ${c.wrong}.</p>
    <h3>Human review</h3><p>${c.through} answers passed the filters and ${c.sampled} were sampled. Read with care: ${c.care}. Skimmed and approved: ${c.skim}. Seen by no person: ${c.unseen}. Bad answers that reached a user: ${c.badOut} of ${c.bad}. In this model a careful read catches every bad answer and a skim catches none. That rule is scripted. Real reviewers under time pressure tend to defer to an automated output, which is called automation bias.</p>
    <h3>The explanation</h3><p>Asked "${esc(WHY_Q)}", the model replies: "${esc(WHY_A)}" The reply leaves the same output slot as the answer and is the same kind of generated text. It was written after the answer existed, and it adds a new invented claim. A small lamp over the block stands for interpretability research, which can name a few of the parts at work inside a model and leaves most of the computation unmapped.</p>
    <h3>Every slip</h3>
    <table><tr><th>Prompt (invented)</th><th>Kind</th><th>Input score</th><th>Output score</th><th>What happened</th></tr>${EX.map((e) => `<tr><td>${esc(e.p)}</td><td>${e.harmful ? 'Harmful' : e.wrong ? 'Harmless, answer wrong' : 'Harmless'}</td><td>${f2(e.ps)}</td><td>${f2(e.as)}</td><td>${esc(FATE[e.fate])}</td></tr>`).join('')}</table>
    <p>Scripted: every prompt, score, and answer. Real: the threshold logic, the random review sample, and every count.</p>`;
  }

  render(); cabLight();
  return {
    scene, camera, controls, update, frame, textAlt, demos, beats,
    insets: () => (ctx.isNarrow() ? {} : { t: 128 }),
    escape: () => { if (!detailPlate.hidden) { seq++; closeDetail(); } },
    dispose() { alive = false; seq++; ctx.canvas.removeEventListener('pointerdown', onDown); ctx.canvas.removeEventListener('pointerup', onUp); },
  };
}

export const BRIEF = {
  define: 'A filter is a second, smaller system that scores a prompt or an answer for risk and blocks it above a threshold. Human in the loop means a person reviews some outputs. Interpretability is research into what happens inside a model.',
  misconceptions: [
    { wrong: 'The safety filter catches the bad outputs.', right: 'A filter gives each slip a score and blocks above a line. Harmful requests in harmless wording score low, and legitimate requests on hard subjects score high, so every position of the line trades missed harm against blocked work. A filter for harm also has nothing to say about an answer that is simply wrong.', demo: 'sweep', demoLabel: 'Sweep the threshold and count' },
    { wrong: 'A human in the loop makes it safe.', right: 'Review reaches the share that is sampled, and care reaches the share the reviewer has time for. Past that point approvals turn into skims, and people under time pressure tend to defer to the machine. That tendency is called automation bias.', demo: 'review', demoLabel: 'Review 10 percent, then everything' },
    { wrong: 'The model can tell us why it did that.', right: 'Asked for its reasons, a model writes more text by the same draw that wrote the answer. Research has shown such explanations can leave out what actually drove an answer. Tools that inspect the computation directly exist, and so far they account for part of it.', demo: 'why', demoLabel: 'Ask the model why' },
  ],
  legal: 'Accountability rests on records and on people, because a model’s account of its own reasons is unreliable as evidence of cause. Logs are the evidence of what a system saw and did, and an organization that cannot produce them will struggle to answer a regulator, a court, or a client. Logs are also retained copies of user data, with their own duties of security, retention, and deletion, so oversight and data minimization pull against each other and the balance is a decision someone should own. Human review counts as a control only when it is designed: who reviews, what share, with how much time, and with real authority to say no.',
  ask: [
    'What do the filters screen for, what do they miss, and how often do they block legitimate work?',
    'What share of outputs does a person review before release, how long does each review take, and how often does a reviewer overrule the system?',
    'What is logged at each step, who can read it, how long is it kept, and could you reconstruct a single answer from six months ago?',
  ],
  say: 'Filters and reviewers each catch part of the problem, and a harm filter says nothing about whether an answer is true. When something goes wrong, what we can prove comes from the logs and the review process, because the model’s own explanation is one more generated answer.',
  checks: [
    { q: 'A vendor says its filter blocks 99% of harmful prompts. What else do you need to know?', a: 'How many legitimate prompts it blocks at that setting, how the harmful test prompts were chosen, and whether they included disguised wording. A threshold strict enough to catch nearly everything also stops legitimate work.' },
    { q: 'Every output is approved by a person. Why might that be weaker than it sounds?', a: 'Approval takes time. When volume exceeds what a reviewer can read with care, approvals become skims, and reviewers tend to defer to the system. Ask about volume, time per item, and how often reviewers say no.' },
    { q: 'After a bad answer, the team asks the model why it gave it. What is the reply worth?', a: 'It is a plausible account written after the fact by the same process that wrote the answer. It can be useful as a lead. The evidence of what happened is in the logs: the prompt, the context, the model version, and the settings.' },
  ],
};
