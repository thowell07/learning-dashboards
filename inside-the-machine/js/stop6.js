// Stop 6. Three levers: weights, system prompt, context. One sealed model, three owners, three timescales, and one valve.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, cyl, paper, glow, halo, emberBead, tween, wait, ease, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

export const BRIEF = {
  define: 'Weights are the numbers inside the model, fixed when a version is released. The system prompt is a block of instructions that the organization deploying a product sends at the top of every call. The context is everything else in that call: the conversation, attachments, and retrieved text. Fine-tuning is further training on extra examples, and it produces a new set of weights.',
  misconceptions: [
    { wrong: 'The model learns from my conversation as we talk.', right: 'Within a conversation the model appears to learn because the application sends the whole conversation back in on every turn. That is lever three, the context. The weights stay still during a chat. When the conversation ends, what the model picked up exists only where the application stored the transcript.', demo: 'learns', demoLabel: 'Chat five turns and watch lever one' },
    { wrong: 'No training on our data means they do not keep our data.', right: 'A training restriction closes one pipe: the one that carries stored conversations back to the foundry to shape a later version. The conversations can still sit in the application’s storage and in logs, and people can still review them, unless other terms say otherwise.', demo: 'valve', demoLabel: 'Close the valve and count what is stored' },
    { wrong: 'A custom assistant is a custom model.', right: 'Most custom assistants are a system prompt and a set of files placed over a shared model. Two products with different names and manners can run on the same weights. A fine-tuned copy is the exception, and a vendor can tell you which one you are buying.', demo: 'custom', demoLabel: 'Plug two assistants into one model' },
  ],
  legal: 'Each lever has a different owner, so responsibility and contract terms divide along the same lines: the model provider for the weights, the deploying organization for the system prompt and configuration, and the user and the application for the context. A training restriction covers one use of data. Retention, access, and human review are separate terms and need separate answers. Fine-tuning on a customer’s data creates a new artifact, and its ownership, deletion, and portability need their own terms.',
  ask: [
    'Which of these is the product: a system prompt over a shared model, a retrieval setup, or a fine-tuned copy of the weights?',
    'Your training restriction covers which data, and what do the retention, logging, and human review terms say?',
    'If you fine-tune on our documents, who owns the resulting weights, and can they be deleted or moved?',
  ],
  say: 'There are three separate controls. The weights are fixed at release, the system prompt is set by whoever deploys the product, and the context is what we send on each call. A promise about training covers the first one only, so we ask about storage separately.',
  checks: [
    { q: 'You correct the assistant in turn two and it gets the point right in turn five. Which lever moved?', a: 'The context. The application sent your correction back in with every later turn. The weights in turn five were the weights of turn one.' },
    { q: 'A vendor’s terms say customer data is never used for training. Name two things that sentence leaves open.', a: 'How long conversations and files are stored, and who can read them. Logging, human review, and subprocessors are separate questions too.' },
    { q: 'Two assistants from two vendors answer the same question differently. Does that show they run on different models?', a: 'No. Different system prompts and different files in the context can draw different answers from identical weights. Ask each vendor which model and version sits underneath.' },
  ],
};

// ---- the script. Northgate, its agreement, and both assistants are invented. ----
const QUESTION = 'How much notice ends the Northgate supply agreement?';
const W_OPTS = [['Base model v1', 'As released by the model provider'], ['Fine-tuned copy', 'Further trained on a team’s past agreements']];
const P_OPTS = [['No system prompt', ''], ['Quote and flag', 'You assist a contracts team. Quote the clause you rely on. Flag one thing to check.'], ['One sentence', 'Answer in one short sentence. Leave out clause numbers.']];
const C_OPTS = [['Question only', ''], ['+ the agreement', 'Clause 14.2: either party may terminate on ninety (90) days’ written notice.'], ['+ the amendment', 'Amendment dated 3 March, paragraph 2: the notice period in clause 14.2 is reduced to thirty (30) days.']];
const KIOSKS = [
  { name: 'Harbor Desk', sys: 'Formal. Quote the clause.', answer: 'Clause 14.2 provides for ninety (90) days’ written notice by either party.' },
  { name: 'Quillpoint', sys: 'Friendly. One line.', answer: 'You need to give 90 days’ notice in writing. Easy.' },
];
// The rule that assembles an answer from the three settings. Every cell was written by hand and none is generated by a model.
export function compose(w, p, c) {
  const W = (t) => ({ lev: 'w', t }), S = (t) => ({ lev: 's', t }), C = (t) => ({ lev: 'c', t });
  const n90 = w ? 'ninety (90) days’' : '90 days’', n30 = w ? 'thirty (30) days’' : '30 days’', cap = (s) => s[0].toUpperCase() + s.slice(1);
  const general = w ? 'The usual term in agreements of this type is ninety (90) days’ written notice by either party.' : 'Supply agreements commonly end on written notice, and the period varies from contract to contract.';
  const segs = []; let chip = null;
  if (p === 2) {
    chip = 'The system prompt held the answer to one sentence and removed the clause number.';
    if (c === 0) segs.push(W(w ? 'Usually ninety (90) days’ written notice.' : 'It varies from contract to contract.'));
    else segs.push(C(`${cap(c === 1 ? n90 : n30)} written notice.`));
    return { segs, chip };
  }
  if (w) segs.push(W('Short answer: '));
  if (c === 0) {
    if (p === 1) segs.push(S('The agreement is not in front of me, so I have no clause to quote. '));
    segs.push(W(general));
    segs.push(p === 1 ? S(' To check: attach the agreement and ask again.') : W(w ? ' I have not seen this agreement, so I cannot confirm its term.' : ' I have not seen this agreement, so I cannot give its term.'));
  } else if (c === 1) {
    segs.push(C(`Either party may end the agreement on ${n90} written notice.`));
    if (p === 1) segs.push(S(' I rely on clause 14.2, which reads: '), C('“Either party may terminate this Agreement on ninety (90) days’ written notice to the other party.”'), S(' To check: whether a later amendment changes this period.'));
  } else {
    segs.push(C(`Either party may end the agreement on ${n30} written notice. The amendment dated 3 March replaced the ninety-day period in clause 14.2.`));
    if (p === 1) segs.push(S(' I rely on paragraph 2 of the amendment, which reads: '), C('“The notice period in clause 14.2 is reduced to thirty (30) days.”'), S(' To check: that both parties signed the amendment.'));
  }
  return { segs, chip };
}
function explain(w, p, c) {
  const out = [];
  out.push(c === 0 ? 'The context held no document, so the substance came from the weights.' : 'The substance came from the context. The model read the attached text on this call.');
  if (c === 0 && w) out.push('The fine-tuned copy sounds specific. Its ninety days is a habit learned from other agreements.');
  if (p === 1) out.push('The quotation and the check were ordered by the system prompt.');
  if (w && p !== 2) out.push('The “Short answer” opening is a house style the fine-tuned copy learned.');
  return out.join(' ');
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const MP = V(0, 0, -0.4), PARK = V(-2.9, 0, -3.1), TRAY = V(0, 0, 2.0), CONZ = 4.1, YOU = V(5.4, 0, 4.1), STORE = V(5.6, 0, -1.2), FOUND = V(-6.2, 0, -2.4), CAST = V(-6.2, 0, 0.5), PIPEZ = -5.6, VALVEX = 3.0;
const LEVX = [-2.4, 0, 2.4];

export function createStop(ctx) {
  const stop = stopByN(6);
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 74, shadow: 14, keyPos: [6, 16, 10] });
  key.target.position.set(0, 0, 0); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: V(1, 12, 16), target: V(-0.6, 0.8, 0.4) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 6, maxDist: 55, maxPolar: 1.42, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf), PD = paper(PAL.paperDark), PM = paper(PAL.paperDim);
  const tmp = new THREE.Vector3();
  let alive = true, userMoved = false, busy = false;
  controls.addEventListener('start', () => { userMoved = true; });

  const st = { w: 0, p: 0, c: 0, chat: [], stored: 0, valve: false, revealed: false, cast: false, custom: false, wchanges: 0, fill: 0 };

  const track = (a, b) => { const d = b.clone().sub(a), len = d.length(); const m = block(0.07, 0.02, len, { color: 0x3a352e, edges: false, cast: false }); m.position.copy(a).addScaledVector(d, 0.5); m.position.y = 0.012; m.rotation.y = Math.atan2(d.x, d.z); world.add(m); return m; };
  const tag = (cls, title, sub, pos) => { const el = h('div', { class: `looptag ${cls}` }, h('b', {}, title), sub != null ? h('span', {}, sub) : null); const t = ctx.tags.add(el, pos); t.sub = el.querySelector('span'); t.title = el.querySelector('b'); return t; };

  // ---------- the model blocks ----------
  function modelBlock(tuned) {
    const mat = paper(PAL.paper); mat.emissive = new THREE.Color(PAL.teal); mat.emissiveIntensity = 0;
    const g = new THREE.Group(); const body = block(2.2, 2.2, 2.2, { mat }); g.add(body);
    const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.05, 0.15), P2, 49); const d = new THREE.Object3D(); let i = 0;
    for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { d.position.set(-0.81 + x * 0.27, 2.225, -0.81 + z * 0.27); d.updateMatrix(); studs.setMatrixAt(i++, d.matrix); }
    studs.castShadow = true; g.add(studs);
    const slot = block(1.5, 0.15, 0.05, { mat: paper(0x1b1815), edges: false }); slot.position.set(0, 0.8, 1.1); g.add(slot);
    if (tuned) { const band = block(2.23, 0.11, 2.23, { mat: glow(0xff9a1f), edges: false, cast: false }); band.position.y = 1.5; g.add(band); }
    g.userData.mat = mat; world.add(g); return g;
  }
  const base = modelBlock(false); base.position.copy(MP);
  const tuned = modelBlock(true); tuned.position.copy(CAST); tuned.scale.y = 0.001; tuned.visible = false;
  const active = () => (st.w ? tuned : base);
  const modelTag = tag('', 'Model · weights v1', 'Sealed. Reads the call. Writes text.', () => tmp.copy(active().position).setY(3.0));
  const parkTag = tag('', 'Base model v1', 'Still exists, unchanged', () => tmp.copy(st.w ? base.position : tuned.position).setY(3.0)); parkTag.el.style.display = 'none';

  // ---------- the console and its three levers ----------
  const con = block(7.4, 0.5, 1.1, { mat: P2 }); con.position.set(0, 0, CONZ); world.add(con);
  const LEVCOL = [PAL.teal, PAL.sys, PAL.ember];
  const levers = LEVX.map((x, i) => {
    const piv = new THREE.Group(); piv.position.set(x, 0.5, CONZ); world.add(piv);
    const slotM = block(1.3, 0.05, 0.3, { mat: paper(0x1b1815), edges: false, cast: false }); slotM.position.set(x, 0.5, CONZ); world.add(slotM);
    piv.add(block(0.12, 1.3, 0.12, { mat: i === 0 ? PD : P1 }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), i === 0 ? paper(PAL.paperDark) : glow(LEVCOL[i])); knob.position.y = 1.38; knob.castShadow = true; piv.add(knob);
    if (i === 2) { const hl = halo(PAL.ember, 1.5); hl.position.y = 1.38; piv.add(hl); }
    return { piv, want: 0 };
  });
  // the padlock: lever one is caged
  const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.7, 1.9, 1.0)), new THREE.LineBasicMaterial({ color: 0xb9b2a2 })); cage.position.set(LEVX[0], 1.45, CONZ); world.add(cage);
  const lock = block(0.34, 0.28, 0.12, { mat: PD }); lock.position.set(LEVX[0], 0.72, CONZ + 0.52); world.add(lock);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20, Math.PI), PD); shackle.position.set(LEVX[0], 1.0, CONZ + 0.52); world.add(shackle);
  track(V(LEVX[0], 0, CONZ - 0.55), V(-0.9, 0, MP.z + 1.1)); track(V(LEVX[1], 0, CONZ - 0.55), V(0, 0, TRAY.z + 0.7)); track(V(LEVX[2], 0, CONZ - 0.55), V(0.9, 0, TRAY.z + 0.7));
  const levTags = [
    tag('s6-lev w', 'Lever 1 · Weights', 'Locked at release', V(LEVX[0], 0, CONZ + 0.6)),
    tag('s6-lev s', 'Lever 2 · System prompt', 'Set by the deployer', V(LEVX[1], 0, CONZ + 0.6)),
    tag('s6-lev c', 'Lever 3 · Context', 'You and the application', V(LEVX[2], 0, CONZ + 0.6)),
  ];

  // ---------- the call tray: what is sent to the model on one call ----------
  const trayBase = block(2.7, 0.06, 1.4, { mat: P2 }); trayBase.position.copy(TRAY); world.add(trayBase);
  const stack = new THREE.Group(); stack.position.set(TRAY.x, 0.06, TRAY.z); world.add(stack);
  let slabTags = [], stackTop = 0;
  const callTag = tag('', 'One call', '', () => tmp.set(TRAY.x, 0.25 + stackTop, TRAY.z - 0.3));
  function callItems() {
    const it = [];
    if (st.p) it.push({ k: 'sys', label: 'system prompt', color: PAL.sys, hgt: 0.16 });
    if (st.c >= 1) it.push({ k: 'doc', label: 'agreement', color: PAL.ember, hgt: 0.46 });
    if (st.c >= 2) it.push({ k: 'amd', label: 'amendment', color: PAL.ember, hgt: 0.2 });
    it.push({ k: 'q', label: 'question', color: PAL.ember, hgt: 0.12 });
    st.chat.forEach((t) => it.push({ k: 'chat', label: '', color: t === 'u' ? PAL.ember : PAL.teal, hgt: 0.1 }));
    return it;
  }
  function layoutTray() {
    slabTags.forEach((t) => t.remove()); slabTags = [];
    stack.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose && o !== stack) o.material.dispose(); }); stack.clear();
    const items = callItems().reverse(); let y = 0; // reading order runs top to bottom, so the system prompt sits on top
    items.forEach((it) => {
      const m = block(2.3, it.hgt, 1.1, { mat: paper(it.color) }); m.position.y = y; stack.add(m);
      if (it.label) slabTags.push(ctx.tags.add(h('div', { class: `s6-slabtag ${it.k}` }, it.label), V(TRAY.x + 1.2, 0.06 + y + it.hgt / 2, TRAY.z + 0.55)));
      y += it.hgt + 0.02;
    });
    stackTop = y;
    const n = callItems().length; callTag.sub.textContent = `${n} item${n > 1 ? 's' : ''}, sent whole`;
  }

  // ---------- you, the application's storage, the foundry, the pipe, the valve ----------
  const you = cyl(0.8, 0.2, { mat: P1 }); you.position.copy(YOU); world.add(you);
  const youBead = emberBead(0.16, PAL.ember, 1.8); youBead.position.set(YOU.x, 0.62, YOU.z); world.add(youBead);
  tag('', 'You', 'Question in, answer out', V(YOU.x, 1.3, YOU.z));
  const store = new THREE.Group(); store.position.copy(STORE); world.add(store);
  store.add(block(1.9, 1.1, 1.3, { mat: P2 }));
  [0.36, 0.72].forEach((y) => { const s = block(1.92, 0.03, 1.32, { mat: PD, edges: false, cast: false }); s.position.y = y; store.add(s); });
  const storeBeads = []; for (let i = 0; i < 8; i++) { const b = emberBead(0.12, PAL.ember, 1.05); b.position.set(-0.66 + (i % 4) * 0.44, 1.26, -0.25 + Math.floor(i / 4) * 0.5); b.visible = false; store.add(b); storeBeads.push(b); }
  const storeTag = tag('', 'Application storage', 'Nothing stored yet', V(STORE.x, 2.15, STORE.z));
  track(V(1.3, 0, TRAY.z), V(STORE.x - 0.4, 0, STORE.z + 0.7));
  const foundry = new THREE.Group(); foundry.position.copy(FOUND); world.add(foundry);
  foundry.add(block(2.8, 0.5, 2.3, { mat: P2 }));
  const chim = cyl(0.34, 1.9, { mat: P1, r2: 0.24 }); chim.position.set(-0.95, 0.5, -0.7); foundry.add(chim);
  const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 1.5, 1.5)), new THREE.LineBasicMaterial({ color: 0x9a9384 })); ghost.position.set(0.35, 1.25, 0.15); foundry.add(ghost);
  const fillMat = paper(0xc9c2b0); fillMat.emissive = new THREE.Color(0xff8a10); fillMat.emissiveIntensity = 0;
  const fillM = block(1.46, 1.46, 1.46, { mat: fillMat, edges: false }); fillM.position.set(0.35, 0.5, 0.15); fillM.scale.y = 0.001; fillM.visible = false; foundry.add(fillM);
  const castFloor = block(2.6, 0.08, 2.5, { mat: P2 }); castFloor.position.copy(CAST); world.add(castFloor);
  const foundTag = tag('', 'The foundry', 'Where weights are made', V(FOUND.x, 3.1, FOUND.z - 0.4));
  const ghostTag = tag('s6-ghost', 'Next version', 'Not built yet', V(FOUND.x + 0.35, 2.25, FOUND.z + 0.9)); ghostTag.el.style.display = 'none';
  // the pipe from the application's storage back to the foundry, drawn as dashes
  const pipe = new THREE.Group(); pipe.visible = false; world.add(pipe);
  const PATH = [V(STORE.x, 0.35, STORE.z - 0.7), V(STORE.x, 0.35, PIPEZ), V(FOUND.x, 0.35, PIPEZ), V(FOUND.x, 0.35, FOUND.z - 1.2)];
  const pathLen = PATH.slice(1).reduce((a, p, i) => a + p.distanceTo(PATH[i]), 0);
  const pathAt = (d, out) => { for (let i = 1; i < PATH.length; i++) { const l = PATH[i].distanceTo(PATH[i - 1]); if (d <= l || i === PATH.length - 1) return out.lerpVectors(PATH[i - 1], PATH[i], Math.min(1, d / l)); d -= l; } return out; };
  const dashMat = paper(PAL.paperDim); const dashes = [];
  for (let d = 0.2; d < pathLen; d += 0.52) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.3), dashMat); pathAt(d, m.position); const nx = pathAt(d + 0.1, tmp); m.lookAt(nx); m.castShadow = true; pipe.add(m); dashes.push(m); }
  const valve = new THREE.Group(); valve.position.set(VALVEX, 0, PIPEZ); pipe.add(valve);
  [-0.42, 0.42].forEach((z) => { const p = block(0.16, 1.3, 0.16, { mat: P1 }); p.position.z = z; valve.add(p); });
  const beam = block(0.2, 0.12, 1.0, { mat: P1 }); beam.position.y = 1.3; valve.add(beam);
  const gate = block(0.14, 0.62, 0.68, { mat: paper(PAL.paperDark) }); gate.position.y = 0.04; valve.add(gate);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 24), P1); wheel.position.y = 1.72; wheel.rotation.y = Math.PI / 2; wheel.castShadow = true; valve.add(wheel);
  const flow = []; for (let i = 0; i < 5; i++) { const b = emberBead(0.07, PAL.ember, 0.7); b.visible = false; pipe.add(b); flow.push({ b, d: (i / 5) * pathLen }); }
  const valveTag = tag('s6-valve', 'Training valve', 'A contract term · closed', V(VALVEX, 2.35, PIPEZ)); valveTag.el.style.display = 'none';
  // two custom assistants over one model
  const kiosks = KIOSKS.map((k, i) => {
    const g = new THREE.Group(); g.position.set(-5.7, 0, 3.5 + i * 2.5); g.visible = false; world.add(g);
    g.add(block(1.7, 0.1, 1.2, { mat: P2 }));
    const sign = block(1.5, 0.8, 0.08, { mat: P1 }); sign.position.set(0, 0.7, -0.5); g.add(sign);
    const post = block(0.08, 0.7, 0.08, { mat: P1 }); post.position.set(0, 0.1, -0.5); g.add(post);
    const s1 = block(1.0, 0.1, 0.7, { mat: paper(PAL.sys) }); s1.position.set(0, 0.26, 0.1); g.add(s1);
    const s2 = block(1.0, 0.16, 0.7, { mat: paper(PAL.ember) }); s2.position.set(0, 0.1, 0.1); g.add(s2);
    const t = tag('s6-kiosk', k.name, k.sys, V(g.position.x, 1.95, g.position.z - 0.5)); t.el.style.display = 'none';
    return { g, t };
  });

  // ---------- moving parts ----------
  const notes = new Set();
  function makeNote(color, text) {
    const m = block(0.8, 0.06, 0.55, { color }); const hl = halo(color, 1.4); hl.position.y = 0.1; hl.material.opacity = 0.5; m.add(hl);
    world.add(m); notes.add(m);
    if (text) m.userData.tag = ctx.tags.add(h('div', { class: 'notetag' }, text), m);
    return m;
  }
  function killNote(n) { if (!n) return; n.userData.tag && n.userData.tag.remove(); world.remove(n); notes.delete(n); n.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); }); }
  const travel = (o, a, b, dur = 0.7, arc = 0.6) => { o.position.copy(a); return tween({ dur, update: (k) => { o.position.lerpVectors(a, b, k); o.position.y += Math.sin(k * Math.PI) * arc; } }); };
  const pulse = (mat, peak = 0.6, dur = 0.8) => tween({ dur, e: ease.lin, update: (k) => { mat.emissiveIntensity = Math.sin(k * Math.PI) * peak; } });
  async function feed(fast) { // the whole call goes into the model
    const hgt = Math.max(0.12, stackTop), m = active();
    const g = new THREE.Mesh(new THREE.BoxGeometry(2.3, hgt, 1.1), new THREE.MeshBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.42, depthWrite: false })); world.add(g);
    await tween({ dur: fast ? 0.35 : 0.7, update: (k) => { g.position.set(TRAY.x, 0.06 + hgt / 2 + (0.85 - hgt / 2) * k * 0.6, lerp(TRAY.z, m.position.z + 1.0, k)); g.scale.setScalar(1 - k * 0.5); g.material.opacity = 0.42 * (1 - k * 0.6); } });
    world.remove(g); g.geometry.dispose(); g.material.dispose();
    await pulse(m.userData.mat, 0.6, fast ? 0.4 : 0.8);
  }
  const outPos = () => tmp.copy(active().position).add(V(1.25, 1.2, 0)).clone();
  async function answerNote(to, fast) { const n = makeNote(PAL.teal, fast ? '' : 'answer'); await travel(n, outPos(), to, fast ? 0.4 : 0.8, 0.9); killNote(n); }

  // ---------- DOM ----------
  const caption = h('div', { class: 'caption s6-caption', role: 'status' });
  const say = (html) => { caption.innerHTML = html || ''; };
  const ansEl = h('p', { class: 's6-answer', 'aria-live': 'polite' });
  const chipEl = h('p', { class: 's6-chip', hidden: true });
  const whyEl = h('p', { class: 's6-why' });
  const tally = { w: h('b', {}, '0'), s: h('b', {}, '0'), v: h('b', { class: 's6-vword' }, 'Closed') };
  const segOf = (name, label, opts, on) => { const ins = []; const el = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, opts.map(([t], k) => { ins[k] = h('input', { type: 'radio', name, value: String(k), checked: k === 0, onchange: () => on(k) }); return h('label', {}, ins[k], h('span', {}, t)); })); return { el, ins }; };
  const wSeg = segOf('s6-w', 'Lever 1, weights', W_OPTS, (k) => guard(() => setW(k), () => { wSeg.ins[st.w].checked = true; }));
  const pSeg = segOf('s6-p', 'Lever 2, system prompt', P_OPTS, (k) => setP(k));
  const cSeg = segOf('s6-c', 'Lever 3, context', C_OPTS, (k) => setC(k));
  const chatBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guard(() => chat(5)) }, 'Chat for five turns');
  const valveSw = h('input', { type: 'checkbox', onchange: (e) => setValve(e.target.checked) });
  const customSw = h('input', { type: 'checkbox', onchange: (e) => guard(() => setCustom(e.target.checked), () => { customSw.checked = st.custom; }) });
  const owners = [
    ['w', 'Weights', 'The model provider, or whoever fine-tunes a copy', 'Only by a training run at the foundry', 'Fixed for the life of that version'],
    ['s', 'System prompt', 'Whoever deploys the product', 'Any time, by editing text', 'Sent again at the top of every call'],
    ['c', 'Context', 'The user and the application', 'On every turn', 'One call, unless the application stores it'],
  ];
  const ui = h('section', { class: 'stop s6', 'aria-label': 'Stop 6, Three levers' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 06 · The control console in the foundry'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' },
        h('span', {}, h('b', {}, 'Scripted'), 'Every answer, both custom assistants, and the fine-tuning run. No model is running.'),
        h('span', {}, h('b', {}, 'Real'), 'Your lever settings and the rule that assembles the answer from them. The counters count what you did.'),
        h('span', {}, h('b', {}, 'Simplified'), 'Three clean levers. Real products add sampling settings (stop 4), retrieval (stop 9), and tools (stop 10).')),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'One question, three levers'), h('span', { class: 'cap' }, 'Invented example')),
        h('div', { class: 'plate-b' }, h('p', { class: 's6-q' }, h('b', {}, 'Asked: '), QUESTION), ansEl, chipEl,
          h('p', { class: 's6-legend' }, h('span', { class: 'w' }, 'From the weights'), h('span', { class: 's' }, 'Shaped by the system prompt'), h('span', { class: 'c' }, 'From the context')),
          whyEl)),
      h('div', { class: 'tally wide s6-tally' }, h('div', {}, tally.w, h('span', {}, 'Weight changes from chatting')), h('div', { class: 'out' }, tally.s, h('span', {}, 'Conversations in app storage')), h('div', {}, tally.v, h('span', {}, 'Training valve'))),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Who holds each lever'), h('span', { class: 'cap' }, 'Owner · changes · lasts')),
        h('div', { class: 'plate-b' }, h('dl', { class: 's6-owners' }, owners.map(([k, name, owner, changes, lasts]) => h('div', { class: k }, h('dt', {}, name), h('dd', {}, h('b', {}, owner), `. Changes: ${changes.toLowerCase()}. Lasts: ${lasts.toLowerCase()}.`)))))),
    ),
    h('div', { class: 'deck plate' },
      h('div', { class: 'grp col' }, h('span', { class: 'cap s6-cap w' }, 'Lever 1 · Weights'), wSeg.el),
      h('div', { class: 'grp col' }, h('span', { class: 'cap s6-cap s' }, 'Lever 2 · System prompt'), pSeg.el),
      h('div', { class: 'grp col' }, h('span', { class: 'cap s6-cap c' }, 'Lever 3 · Context'), cSeg.el),
      h('div', { class: 'grp' }, chatBtn, h('label', { class: 'switch' }, valveSw, h('i'), 'Training valve open'), h('label', { class: 'switch' }, customSw, h('i'), 'Two custom assistants')),
    ),
  );
  ctx.hud.append(ui, caption);

  function renderAnswer() {
    const { segs, chip } = compose(st.w, st.p, st.c);
    ansEl.replaceChildren(...segs.map((s) => h('span', { class: `seg-${s.lev}` }, s.t)));
    chipEl.hidden = !chip; chipEl.textContent = chip || '';
    whyEl.textContent = explain(st.w, st.p, st.c);
  }
  function renderTally() {
    tally.w.textContent = String(st.wchanges); tally.s.textContent = String(st.stored); tally.v.textContent = st.valve ? 'Open' : 'Closed';
    storeBeads.forEach((b, i) => { b.visible = i < st.stored; });
    storeTag.sub.textContent = st.stored ? `${st.stored} conversation${st.stored > 1 ? 's' : ''} at rest` : 'Nothing stored yet';
    valveTag.sub.textContent = `A contract term · ${st.valve ? 'open' : 'closed'}`;
    modelTag.title.textContent = st.w ? 'Fine-tuned copy · v1-ft' : 'Model · weights v1';
    parkTag.el.style.display = st.cast ? '' : 'none'; parkTag.title.textContent = st.w ? 'Base model v1' : 'Fine-tuned copy'; parkTag.sub.textContent = st.w ? 'Still exists, unchanged' : 'A separate file of weights';
  }
  async function call(fast) {
    await feed(fast); if (!alive) return; renderAnswer(); await answerNote(V(YOU.x, 0.9, YOU.z - 0.3), fast); if (!alive) return;
    // presenter view hides the left column, so the answer is repeated in the caption with the same color key
    if (document.body.classList.contains('present')) say(compose(st.w, st.p, st.c).segs.map((x) => `<span class="seg-${x.lev}">${esc(x.t)}</span>`).join(''));
  }

  // ---------- the levers ----------
  function setP(k, quiet) {
    st.p = k; pSeg.ins[k].checked = true; levers[1].want = [-0.55, 0, 0.55][k]; layoutTray(); renderAnswer();
    if (!quiet) { say(k ? `<b>Lever 2 moved in an instant.</b> The deployer edited a block of text. Every call now starts with it: “${esc(P_OPTS[k][1])}”` : '<b>No system prompt.</b> The call holds only what the user and the application supply.'); pulse(active().userData.mat, 0.5, 0.6); }
  }
  function setC(k, quiet) {
    st.c = k; cSeg.ins[k].checked = true; levers[2].want = [-0.55, 0, 0.55][k]; layoutTray(); renderAnswer();
    if (!quiet) { say(k === 0 ? '<b>Question only.</b> With no document in the call, the model has only its weights to answer from.' : k === 1 ? '<b>The agreement joins the call.</b> The answer now comes from text the model reads on this call. The weights are the same.' : '<b>The amendment joins the call.</b> The answer follows the newest text in the context. Nothing was retrained.'); pulse(active().userData.mat, 0.5, 0.6); }
  }
  async function setW(k, quiet) {
    if (k === st.w) return;
    if (k === 1 && !st.cast) { // moving lever one means casting a new set of weights
      wide = true; if (narrow) userMoved = false;
      if (!quiet) say('<b>Lever 1 is locked.</b> It moves only at the foundry. The team’s past agreements travel there as training examples.');
      const sheets = [0, 1, 2].map(() => makeNote(PAL.ember, ''));
      await Promise.all(sheets.map((n, i) => tween({ dur: 0.3 * i, update: null }).then(() => travel(n, V(STORE.x, 1.3, STORE.z), V(CAST.x, 0.3, CAST.z), 1.1, 2.6)))); sheets.forEach(killNote); if (!alive) return;
      if (!quiet) say('A training run adjusts a copy of the weights. <b>This takes compute, time, and money.</b> Levers 2 and 3 are settings. This one is a project.');
      tuned.visible = true; tuned.position.copy(CAST);
      await tween({ dur: 2.0, e: ease.out, update: (k2) => { tuned.scale.y = Math.max(0.001, k2); } }); if (!alive) return;
      st.cast = true;
    }
    st.w = k; wSeg.ins[k].checked = true; levers[0].want = k ? 0.5 : -0.5;
    const inB = k ? tuned : base, outB = k ? base : tuned, from = inB.position.clone(), o0 = outB.position.clone();
    await tween({ dur: 1.0, update: (t) => { outB.position.lerpVectors(o0, PARK, t); inB.position.lerpVectors(from, MP, t); } }); if (!alive) return;
    renderTally(); renderAnswer();
    if (!quiet) say(k ? '<b>A new file of weights, stamped v1-ft.</b> The band of light marks patterns learned from the team’s documents. The base model still exists, unchanged.' : '<b>Back to the base model.</b> The fine-tuned copy still exists as a separate file. Who owns it and who can delete it is a contract question.');
  }
  function reveal() {
    if (st.revealed) return; st.revealed = true; pipe.visible = true; valveTag.el.style.display = ''; ghostTag.el.style.display = ''; wide = true; if (narrow) userMoved = false;
    dashes.forEach((d, i) => { d.scale.setScalar(0.001); tween({ dur: 0.25, delay: i * 0.025, update: (k) => { d.scale.setScalar(Math.max(0.001, k)); } }); });
  }
  function setValve(on, quiet) {
    reveal(); st.valve = on; valveSw.checked = on; renderTally();
    tween({ dur: 0.5, update: (k) => { gate.position.y = lerp(gate.position.y, on ? 0.72 : 0.04, k); wheel.rotation.x = lerp(wheel.rotation.x, on ? Math.PI : 0, k); } });
    dashMat.color.set(on && st.stored ? 0xd6b98a : PAL.paperDim);
    if (on && st.stored && motion.reduced) st.fill = 0.62;
    fillM.visible = st.fill > 0.01 || (on && st.stored > 0);
    ghostTag.sub.textContent = on && st.stored ? 'In training on stored conversations' : st.fill > 0.01 ? 'Training paused' : 'Not built yet';
    if (quiet) return;
    if (on) say(st.stored ? '<b>Valve open.</b> Stored conversations travel to the foundry and help shape the next version’s weights. The model you are using stays as it was.' : '<b>Valve open, and nothing is stored yet.</b> Chat first. The pipe carries what the application has kept.');
    else say(`<b>Valve closed.</b> That one pipe is shut. ${st.stored ? `${st.stored} conversation${st.stored > 1 ? 's' : ''} still rest${st.stored > 1 ? '' : 's'} in the application’s storage.` : 'Storage is a separate question.'} “We do not train on your data” is a promise about this valve.`);
  }
  async function chat(n, fast) {
    if (st.custom) await setCustom(false, true);
    st.chat = []; layoutTray();
    const dur = fast ? 0.25 : 0.5;
    for (let i = 0; i < n && alive; i++) {
      if (!fast) say(`Turn ${i + 1}. You type. <b>The application sends the whole conversation again</b>, one turn longer.`);
      const u = makeNote(PAL.ember, ''); await travel(u, V(YOU.x, 0.9, YOU.z - 0.3), V(TRAY.x, 0.2 + stackTop, TRAY.z), dur, 0.8); killNote(u); if (!alive) return;
      st.chat.push('u'); layoutTray();
      await feed(true); if (!alive) return;
      const a = makeNote(PAL.teal, ''); await travel(a, outPos(), V(TRAY.x, 0.2 + stackTop, TRAY.z), dur, 0.7); killNote(a); if (!alive) return;
      st.chat.push('m'); layoutTray(); renderTally();
    }
    if (!fast) { say(`<b>${n} turns. The context grew ${n * 2} times. Lever 1 never moved.</b> The model did not learn. It reread a longer page each time.`); await wait(2.2); if (!alive) return; }
    // the conversation ends: the context empties, and the application keeps a transcript
    const copy = makeNote(PAL.ember, fast ? '' : 'transcript'); await travel(copy, V(TRAY.x, 0.3 + stackTop, TRAY.z), V(STORE.x, 1.35, STORE.z), fast ? 0.4 : 0.9, 1.2); killNote(copy); if (!alive) return;
    st.chat = []; st.stored = Math.min(8, st.stored + 1); layoutTray(); renderTally(); reveal();
    if (st.valve) setValve(true, true);
    if (!fast) say('<b>The conversation ends and the context empties.</b> A transcript rests in the application’s storage. One pipe leads from there back to the foundry, and a contract term is its valve.');
  }
  async function setCustom(on, quiet) {
    st.custom = on; customSw.checked = on;
    kiosks.forEach((k) => { k.g.visible = on; k.t.el.style.display = on ? '' : 'none'; });
    if (!on) { if (!quiet) say('The two assistants step back. The model block is the one they both used.'); return; }
    wide = true; if (narrow) userMoved = false;
    if (st.w) await setW(0, true);
    if (!quiet) say('<b>Two products, two names, two manners.</b> Each is a system prompt and a set of files. Watch where both of them plug in.');
    await wait(1.0); if (!alive) return;
    for (let i = 0; i < 2 && alive && st.custom; i++) {
      const k = kiosks[i], from = V(k.g.position.x, 0.5, k.g.position.z);
      const n = makeNote(PAL.sys, `${KIOSKS[i].name}: system prompt + files`); await travel(n, from, V(TRAY.x, 0.3 + stackTop, TRAY.z), 0.9, 1.4 + i * 1.4); killNote(n); if (!alive) return;
      await feed(false); if (!alive) return;
      const a = makeNote(PAL.teal, KIOSKS[i].answer); await travel(a, outPos(), from.clone().setY(1.0), 1.0, 1.6 + i * 1.4); if (!alive) return;
      await wait(quiet ? 0.5 : 1.1); killNote(a);
    }
    if (alive && !quiet) say('<b>Two assistants. One set of weights.</b> The difference between them is text that their makers can edit this afternoon.');
  }
  async function guard(fn, onBusy) { if (busy) { onBusy && onBusy(); return; } busy = true; ui.querySelectorAll('.deck .btn').forEach((b) => b.setAttribute('aria-disabled', 'true')); try { await fn(); } finally { busy = false; if (alive) ui.querySelectorAll('.deck .btn').forEach((b) => b.removeAttribute('aria-disabled')); } }

  // ---------- demonstrations and the guide ----------
  const demos = {
    learns: () => guard(async () => { await chat(5); }),
    valve: () => guard(async () => {
      if (!st.stored) { say('First, a short conversation for the application to keep.'); await chat(2, true); if (!alive) return; }
      setValve(true); await wait(3.4); if (!alive) return; setValve(false);
    }),
    custom: () => guard(async () => { await setCustom(true); }),
  };
  const settle = async (w, p, c) => { if (st.custom) await setCustom(false, true); if (st.w !== w) await setW(w, true); setP(p, true); setC(c, true); };
  const beats = [
    { title: 'One question, one sealed model', note: 'With no system prompt and no document, the answer can only come from the weights. Look at the underline.', run: async () => { await settle(0, 0, 0); say('<b>Question only.</b> The answer is general knowledge from the weights.'); await call(); } },
    { title: 'Lever 3: the context', note: 'Attach the agreement. The answer now comes from text the model reads on this call, and the weights are the same.', run: async () => { await settle(0, 0, 0); setC(1); await call(); } },
    { title: 'Lever 2: the system prompt', note: 'The deployer adds instructions at the top of every call. The same facts come back in a different shape.', run: async () => { await settle(0, 0, 1); setP(1); await call(); } },
    { title: 'Lever 1: the weights', note: 'This lever is locked. Moving it means a training run at the foundry and a new file of weights.', run: async () => { await settle(0, 1, 1); await setW(1); if (alive) await call(true); } },
    { title: 'Chatting moves one lever', note: 'Five turns of conversation. The context grows on every turn and lever 1 stays where it is.', run: async () => { await settle(0, 0, 0); await chat(5); } },
    { title: 'The valve', note: 'One pipe runs from stored conversations back to the foundry. A no-training term closes that pipe and leaves the storage where it is.', run: async () => { if (st.custom) await setCustom(false, true); if (!st.stored) await chat(2, true); if (!alive) return; setValve(true); await wait(3.0); if (!alive) return; setValve(false); } },
    { title: 'Two assistants, one model', note: 'Two invented products with different names plug into the same block of weights.', run: async () => { await setCustom(true); } },
  ];

  // ---------- view interface ----------
  let wide = true, dWide = 30, dCore = 22, narrow = false; const wantT = V(0, 0, 0), wantP = V(0, 0, 0);
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360); narrow = ctx.isNarrow();
    const fit = (sx, sy) => Math.max(sy / (2 * tan * (freeH / H)), sx / (2 * tan * (freeW / H)));
    dWide = fit(17.0, 13.0); dCore = fit(13.2, 10.4);
    if (!narrow) wide = true; else if (!st.revealed && !st.cast && !st.custom) wide = false;
    if (!userMoved) place(1);
  }
  function place(k) {
    const el = 0.6, az = 0.14, w = wide || !narrow, d = w ? dWide : dCore;
    wantT.set(w ? -0.4 : 0.9, 0.7, w ? 0.1 : 1.8);
    wantP.set(wantT.x + d * Math.sin(az) * Math.cos(el), wantT.y + d * Math.sin(el), wantT.z + d * Math.cos(az) * Math.cos(el));
    camera.position.lerp(wantP, k); controls.target.lerp(wantT, k);
  }
  function update(dt, t) {
    const k = motion.reduced ? 1 : Math.min(1, dt * 7);
    if (!userMoved) place(motion.reduced ? 1 : Math.min(1, dt * 2.4));
    levers.forEach((l) => { l.piv.rotation.z = lerp(l.piv.rotation.z, -l.want, k); });
    if (!motion.reduced) youBead.userData.halo.material.opacity = 0.75 + Math.sin(t * 2) * 0.2;
    const flowing = st.valve && st.stored > 0 && st.revealed;
    flow.forEach((f) => { f.b.visible = flowing; if (flowing) { f.d = (f.d + dt * 3.2) % pathLen; pathAt(f.d, f.b.position); } });
    if (flowing) { st.fill = Math.min(0.62, st.fill + (motion.reduced ? 0.62 : dt * 0.09)); fillMat.emissiveIntensity = 0.25; } else fillMat.emissiveIntensity = lerp(fillMat.emissiveIntensity, 0, k);
    if (st.fill > 0.01) { fillM.visible = true; fillM.scale.y = st.fill; }
  }
  function textAlt() {
    return `<p>A sealed model block stands at the center of a table. In front of it is a console with three levers. Lever 1, the weights, sits inside a cage with a padlock. Lever 2 is the system prompt. Lever 3 is the context. Between the console and the model lies a tray that holds one call: the system prompt on top, then any attached documents, then the question. On every call the whole tray goes into the model and an answer comes out to you.</p>
    <p>To one side stands the application’s storage, and far to the other side stands the foundry where weights are made. A dashed pipe runs from the storage back to the foundry, and a valve on that pipe is a contract term. With the valve open, stored conversations travel to the foundry and help shape the next version of the weights. With the valve closed, that pipe is shut and the conversations still rest in storage.</p>
    <h3>Who holds each lever</h3><table><tr><th>Lever</th><th>Owner</th><th>Changes</th><th>Lasts</th></tr>${owners.map(([, n, o, c, l]) => `<tr><td>${esc(n)}</td><td>${esc(o)}</td><td>${esc(c)}</td><td>${esc(l)}</td></tr>`).join('')}</table>
    <h3>Settings now</h3><ul><li>Weights: ${esc(W_OPTS[st.w][0])}. ${esc(W_OPTS[st.w][1])}.</li><li>System prompt: ${esc(P_OPTS[st.p][0])}${st.p ? `. “${esc(P_OPTS[st.p][1])}”` : ''}</li><li>Context: ${esc(C_OPTS[st.c][0])}${st.c ? `. ${esc(C_OPTS[st.c][1])}` : ''}</li></ul>
    <h3>Question (invented)</h3><p>${esc(QUESTION)}</p>
    <h3>Answer under these settings</h3><p>${compose(st.w, st.p, st.c).segs.map((s) => `${esc(s.t)} <i>[${s.lev === 'w' ? 'from the weights' : s.lev === 's' ? 'shaped by the system prompt' : 'from the context'}]</i>`).join(' ')}</p><p>${esc(explain(st.w, st.p, st.c))}</p>
    <h3>Counters</h3><ul><li>Weight changes caused by chatting: ${st.wchanges}. Chatting adds to the context and never moves the weights.</li><li>Conversations in application storage: ${st.stored}.</li><li>Training valve: ${st.valve ? 'open' : 'closed'}.</li></ul>
    <h3>Two custom assistants (invented)</h3><p>${KIOSKS.map((k) => `${esc(k.name)}: “${esc(k.answer)}”`).join(' ')} Both are a system prompt and files over the same model block.</p>
    <p>Scripted: every answer, both assistants, and the fine-tuning run. Real: your lever settings, the rule that assembles the answer, and the counters.</p>`;
  }

  levers[0].want = -0.5; levers[1].want = -0.55; levers[2].want = -0.55; levers.forEach((l) => { l.piv.rotation.z = -l.want; });
  layoutTray(); renderAnswer(); renderTally();
  say('Move a lever and read the answer. Then chat for five turns and watch lever 1.');
  return { scene, camera, controls, update, frame, textAlt, demos, beats, insets: () => (ctx.isNarrow() ? {} : { t: 118 }), dispose() { alive = false; slabTags.forEach((t) => t.remove()); [...notes].forEach(killNote); } };
}
