// The agent loop, shared by stop 10 (tools and agents) and stop 12 (prompt injection).
// A sealed model, a harness with a gate, tools, a context stack that grows, and an audit tape.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, cyl, paper, glow, halo, emberBead, addEdges, tween, wait, ease, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ORIGIN = {
  system: { label: 'System prompt', color: PAL.sys, css: 'var(--sys)' },
  user: { label: 'User', color: PAL.ember, css: 'var(--ember)' },
  model: { label: 'Model', color: PAL.teal, css: 'var(--teal)' },
  tool: { label: 'Tool result', color: PAL.blue, css: 'var(--blue)' },
  outside: { label: 'Tool result · outside document', color: PAL.blue, css: 'var(--blue)' },
};
const M = V(-5.2, 0, 0), CS = V(-5.2, 0, 3.7), HN = V(0, 0, 0), YOU = V(0, 0, 5.3), QR = V(-0.6, 0, -3.7);
const P_OUT = V(-3.75, 1.25, 0), P_IN = V(-1.45, 1.25, 0), P_HOUT = V(1.45, 1.25, 0), P_GATE = V(2.35, 1.25, 0), P_HTOP = V(0, 1.6, 0.4), P_YOU = V(0, 0.9, 5.0);
const WIN_H = 3.3;

export function createAgentStop(ctx, cfg) {
  const stop = stopByN(cfg.n);
  const { scene, key } = baseScene({ fogNear: 26, fogFar: 64, shadow: 13, keyPos: [5, 15, 10] });
  key.target.position.set(0, 0, 1); scene.add(key.target);
  const camera = makeCamera(36);
  const home = { pos: V(1, 10, 14), target: V(0.2, 0.9, 1.3) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 6, maxDist: 48, maxPolar: 1.4, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf), PD = paper(PAL.paperDark);
  let alive = true, userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  const live = () => alive;

  // ---------- 3D: stations ----------
  const track = (a, b) => { const d = b.clone().sub(a), len = d.length(); const m = block(0.07, 0.02, len, { color: 0x3a352e, edges: false, cast: false }); m.position.copy(a).addScaledVector(d, 0.5); m.position.y = 0.012; m.rotation.y = Math.atan2(d.x, d.z); world.add(m); };
  // model: sealed, one slot in, one slot out
  const modelMat = paper(PAL.paper); modelMat.emissive = new THREE.Color(PAL.teal); modelMat.emissiveIntensity = 0;
  const model = block(2.6, 2.6, 2.6, { mat: modelMat }); model.position.copy(M); world.add(model);
  { const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), P2, 64); const d = new THREE.Object3D(); let i = 0; for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) { d.position.set(-0.98 + x * 0.28, 2.625, -0.98 + z * 0.28); d.updateMatrix(); studs.setMatrixAt(i++, d.matrix); } studs.castShadow = true; model.add(studs); }
  const slotMat = paper(0x1b1815);
  const so = block(0.05, 0.14, 0.95, { mat: slotMat, edges: false }); so.position.set(1.3, 1.18, 0); model.add(so);
  const si = block(1.7, 0.16, 0.05, { mat: slotMat, edges: false }); si.position.set(0, 0.86, 1.3); model.add(si);
  // context window: a fixed frame with a growing stack inside
  const ctxBase = block(2.6, 0.06, 1.9, { mat: P2 }); ctxBase.position.copy(CS); world.add(ctxBase);
  const frameBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.5, WIN_H, 1.8)), new THREE.LineBasicMaterial({ color: 0x9a9384 })); frameBox.position.set(CS.x, 0.06 + WIN_H / 2, CS.z); world.add(frameBox);
  const stack = new THREE.Group(); stack.position.set(CS.x, 0.06, CS.z); world.add(stack);
  // harness with a lever and an audit tape
  const harness = new THREE.Group(); harness.position.copy(HN); world.add(harness);
  const hMat = paper(0xd9d1bf); const hBody = block(2.5, 1.0, 2.1, { mat: hMat }); harness.add(hBody);
  const leverBase = block(1.3, 0.12, 0.34, { mat: P1 }); leverBase.position.set(0, 1.0, -0.55); harness.add(leverBase);
  const lever = new THREE.Group(); lever.position.set(0, 1.08, -0.55); harness.add(lever);
  const arm = block(0.09, 0.72, 0.09, { mat: PD }); lever.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), glow(PAL.paper)); knob.position.y = 0.78; lever.add(knob);
  if (!cfg.lever) { leverBase.visible = false; lever.visible = false; }
  const tape = block(0.56, 0.025, 1, { mat: paper(0xf3ecdb), cast: false, edges: false }); tape.position.set(0.75, 0.01, 1.05); tape.scale.z = 0.01; world.add(tape);
  const ticks = new THREE.Group(); world.add(ticks);
  // gate between the harness and the tools
  const gate = new THREE.Group(); gate.position.set(2.5, 0, 0); world.add(gate);
  [-0.8, 0.8].forEach((z) => { const p = block(0.18, 1.15, 0.18, { mat: P1 }); p.position.z = z; gate.add(p); });
  const barMat = paper(PAL.paperDark); barMat.emissive = new THREE.Color(PAL.verm); barMat.emissiveIntensity = 0;
  const barPivot = new THREE.Group(); barPivot.position.set(0, 0.95, -0.8); gate.add(barPivot);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), barMat); bar.position.z = 0.8; bar.castShadow = true; barPivot.add(bar);
  // tools
  const toolPos = {}; const TX = cfg.toolX ?? (ctx.isNarrow() ? 4.7 : 5.7); // tools sit closer on a narrow screen so the diorama can be larger
  cfg.tools.forEach((t, i) => {
    const z = (i - (cfg.tools.length - 1) / 2) * 2.0; toolPos[t.id] = V(TX, 0, z);
    const g = new THREE.Group(); g.position.set(TX, 0, z); world.add(g);
    g.add(cyl(0.62, 0.42, { mat: t.kind === 'act' ? P2 : P1 }));
    const top = 0.42;
    if (t.icon === 'search') { const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 28), P1); r.position.set(-0.05, top + 0.42, 0); r.castShadow = true; g.add(r); const hd = block(0.07, 0.3, 0.07, { mat: P1 }); hd.position.set(0.16, top + 0.02, 0); hd.rotation.z = -0.6; g.add(hd); }
    if (t.icon === 'read' || t.icon === 'write') { const s = block(0.5, 0.04, 0.66, { mat: P1 }); s.position.y = top + 0.2; s.rotation.set(-0.9, 0, 0); g.add(s); if (t.icon === 'write') { const pen = block(0.05, 0.5, 0.05, { mat: PD }); pen.position.set(0.22, top + 0.1, 0.1); pen.rotation.z = -0.5; g.add(pen); } if (t.outside) { const v = block(0.4, 0.045, 0.07, { mat: glow(PAL.verm), edges: false }); v.position.set(0, top + 0.2, 0); v.rotation.set(-0.9, 0, 0); g.add(v); } }
    if (t.icon === 'mail') { const e = block(0.72, 0.44, 0.06, { mat: P1 }); e.position.y = top + 0.06; e.rotation.x = -0.3; g.add(e); const f = block(0.5, 0.03, 0.03, { mat: PD, edges: false }); f.position.set(0, top + 0.36, 0.1); g.add(f); }
    ctx.tags.add(h('div', { class: `looptag ${t.kind}` }, h('b', {}, t.id), h('span', {}, t.note)), V(TX, 1.75, z - 0.2));
    track(V(2.5, 0, 0), V(TX - 0.6, 0, z));
  });
  // you
  const you = cyl(0.8, 0.2, { mat: P1 }); you.position.copy(YOU); world.add(you);
  const youBead = emberBead(0.16, PAL.ember, 1.8); youBead.position.set(YOU.x, 0.62, YOU.z); world.add(youBead);
  // isolated reader (stop 12)
  const quar = new THREE.Group(); quar.position.copy(QR); quar.visible = false; world.add(quar);
  quar.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.0, 2.0, 2.0)), new THREE.LineBasicMaterial({ color: PAL.paper })).translateY(1.0));
  const qMat = paper(PAL.paper); qMat.emissive = new THREE.Color(PAL.teal); qMat.emissiveIntensity = 0;
  const qModel = block(1.1, 1.1, 1.1, { mat: qMat }); quar.add(qModel);
  const qTag = ctx.tags.add(h('div', { class: 'looptag' }, h('b', {}, 'Isolated reader'), h('span', {}, 'A second model call with no tools')), V(QR.x, 2.3, QR.z)); qTag.el.style.display = 'none';
  // tracks
  track(V(M.x + 1.3, 0, 0), V(-1.25, 0, 0)); track(V(1.25, 0, 0), V(2.5, 0, 0)); track(V(-1.0, 0, 1.05), V(CS.x + 1.3, 0, CS.z - 0.3)); track(V(0, 0, 1.05), V(0, 0, YOU.z - 0.8)); track(V(CS.x, 0, CS.z - 0.95), V(M.x, 0, 1.3));
  // station tags
  const modelTag = ctx.tags.add(h('div', { class: 'looptag' }, h('b', {}, 'Model'), h('span', {}, 'Reads the context. Writes text.')), V(M.x, 3.3, M.z - 0.6));
  const harnessTag = ctx.tags.add(h('div', { class: 'looptag' }, h('b', {}, 'Harness'), h('span', {}, 'Ordinary software. Runs tools.')), () => _t.set(HN.x, harness.position.y + 2.3, HN.z - 0.7));
  ctx.tags.add(h('div', { class: 'looptag' }, h('b', {}, 'Context'), h('span', {}, 'Everything the model can see')), V(CS.x - 0.2, WIN_H + 0.5, CS.z));
  ctx.tags.add(h('div', { class: 'looptag' }, h('b', {}, 'You'), h('span', {}, 'Task in, answer out')), V(YOU.x, 1.25, YOU.z));
  ctx.tags.add(h('div', { class: 'looptag' }, h('b', {}, 'Audit tape')), V(1.55, 0.2, 2.6));
  const _t = new THREE.Vector3();

  // ---------- 3D: moving parts ----------
  const notes = new Set();
  function makeNote(color, text) {
    const m = block(0.82, 0.06, 0.56, { color, edges: true }); m.userData.hl = halo(color, 1.5); m.userData.hl.position.y = 0.1; m.userData.hl.material.opacity = 0.5; m.add(m.userData.hl);
    world.add(m); notes.add(m);
    if (text) { const el = h('div', { class: 'notetag' }, text); m.userData.tag = ctx.tags.add(el, m); }
    return m;
  }
  function killNote(n) { if (!n) return; n.userData.tag && n.userData.tag.remove(); world.remove(n); notes.delete(n); }
  const travel = (o, a, b, dur = 0.75, arc = 0.5) => { o.position.copy(a); return tween({ dur, update: (k) => { o.position.lerpVectors(a, b, k); o.position.y += Math.sin(k * Math.PI) * arc; } }); };
  const slabs = [];
  let stackTop = 0;
  const slabH = (tok) => Math.max(0.08, Math.min(1.7, tok / 1250));
  function addSlab(item) {
    const o = ORIGIN[item.origin], hgt = slabH(item.tokens);
    const mat = paper(o.color); const m = block(2.25, hgt, 1.55, { mat }); m.position.y = stackTop; stack.add(m);
    let strip = null;
    if (item.taint) { strip = block(2.27, Math.min(0.09, hgt * 0.5), 1.57, { mat: glow(PAL.verm), edges: false, cast: false }); strip.position.y = hgt * 0.45; m.add(strip); }
    slabs.push({ m, mat, strip, base: new THREE.Color(o.color) }); stackTop += hgt + 0.025;
    applyModelView();
    return m;
  }
  let modelView = false;
  function applyModelView() { const grey = new THREE.Color(0xa7a091); slabs.forEach((s) => { s.mat.color.copy(modelView ? grey : s.base); if (s.strip) s.strip.material.color.set(modelView ? 0xa7a091 : PAL.verm); }); }
  const pulse = (mat, peak = 0.55, dur = 0.9) => tween({ dur, e: ease.lin, update: (k) => { mat.emissiveIntensity = Math.sin(k * Math.PI) * peak; } });
  const S3 = {
    async feed() { // the whole context goes through the model again
      const hgt = Math.max(0.1, stackTop);
      const g = new THREE.Mesh(new THREE.BoxGeometry(2.25, hgt, 1.55), new THREE.MeshBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.4, depthWrite: false }));
      world.add(g);
      await tween({ dur: 0.85, update: (k) => { g.position.set(CS.x, 0.06 + hgt / 2 + (0.9 - hgt / 2) * k * 0.6, lerp(CS.z, 0.9, k)); g.scale.setScalar(1 - k * 0.55); g.material.opacity = 0.42 * (1 - k * 0.6); } });
      world.remove(g); g.geometry.dispose(); g.material.dispose();
      await pulse(modelMat);
    },
    async emit(text) { const n = makeNote(PAL.teal, text); await travel(n, P_OUT, harnessOn ? P_IN : V(-2.5, 0.08, 0.5), 0.7, harnessOn ? 0.35 : 0.9); if (!harnessOn) n.rotation.y = 0.5; return n; },
    async toGate(n) { await travel(n, P_IN, P_HOUT, 0.35, 0.25); await travel(n, P_HOUT, P_GATE, 0.3, 0.1); },
    async openGate() { await tween({ dur: 0.3, update: (k) => { barPivot.rotation.x = -1.25 * k; } }); },
    async closeGate() { await tween({ dur: 0.3, update: (k) => { barPivot.rotation.x = -1.25 * (1 - k); } }); },
    async refuse(n) { pulse(barMat, 1.2, 0.8); await travel(n, P_GATE, P_HOUT, 0.4, 0.5); n.material.color.set(PAL.verm); n.userData.hl.material.color.set(PAL.verm); },
    async toTool(n, id) { const p = toolPos[id].clone().setY(1.0); await travel(n, P_GATE, p, 0.6, 0.4); await wait(0.25); },
    rawAtTool(id, text, taint) { const n = makeNote(PAL.blue, text); if (taint) { const v = block(0.84, 0.065, 0.12, { mat: glow(PAL.verm), edges: false }); n.add(v); } n.position.copy(toolPos[id]).setY(1.0); return n; },
    async fromTool(id, text, taint) { const n = S3.rawAtTool(id, text, taint); await travel(n, toolPos[id].clone().setY(1.0), P_HOUT, 0.75, 0.5); return n; },
    async toQuar(n, id) { await travel(n, toolPos[id].clone().setY(1.0), V(QR.x, 1.3, QR.z + 0.2), 0.8, 0.9); killNote(n); await pulse(qMat, 0.6, 1.0); },
    async fromQuar(text) { const n = makeNote(PAL.blue, text); await travel(n, V(QR.x, 1.3, QR.z + 0.2), P_HTOP, 0.8, 0.7); return n; },
    async append(n, item) { const to = V(CS.x, 0.06 + stackTop + slabH(item.tokens) / 2, CS.z); await travel(n, n.position.clone(), to, 0.75, 1.1); killNote(n); addSlab(item); },
    async toYou(n) { await travel(n, n.position.clone(), P_YOU, 0.8, 0.6); },
    async fromYou(n) { await travel(n, P_YOU, P_HTOP, 0.6, 0.5); },
    tick(bad) { const i = ticks.children.length; const len = 0.35 + i * 0.2; tape.scale.z = len; tape.position.z = 1.05 + len / 2; const t = block(0.4, 0.03, 0.06, { color: bad ? PAL.verm : 0x2c2823, edges: false, cast: false }); t.position.set(0.75, 0.03, 1.2 + i * 0.2); ticks.add(t); },
    setLever(i) { tween({ dur: 0.3, update: (k) => { lever.rotation.z = lerp(lever.rotation.z, [0.62, 0, -0.62][i], k); } }); },
    setGateLocked(on) { barMat.color.set(on ? PAL.verm : PAL.paperDark); },
    setQuar(on) { quar.visible = on; qTag.el.style.display = on ? '' : 'none'; },
    setModelView(on) { modelView = on; applyModelView(); },
    reset() { [...notes].forEach(killNote); slabs.forEach((s) => stack.remove(s.m)); slabs.length = 0; stackTop = 0; ticks.clear(); tape.scale.z = 0.01; barPivot.rotation.x = 0; modelMat.emissiveIntensity = 0; },
  };
  let harnessOn = true;
  function setHarness3D(on) {
    harnessOn = on; harnessTag.el.classList.toggle('off', !on);
    harnessTag.el.querySelector('span').textContent = on ? 'Ordinary software. Runs tools.' : 'Unplugged';
    hMat.transparent = true;
    tween({ dur: 0.6, update: (k) => { const v = on ? 1 - k : k; harness.position.y = lerp(harness.position.y, on ? 0 : 2.6, k); hMat.opacity = 1 - v * 0.55; harness.rotation.z = (on ? 1 - k : k) * 0.12; } });
  }

  // ---------- state ----------
  const state = { turn: 0, items: [], log: [], done: false, busy: false, stalled: null, calls: 0, flags: {}, outcomes: [] };
  const tokTotal = () => state.items.reduce((a, b) => a + b.tokens, 0);

  // ---------- DOM ----------
  const ctxList = h('div', { class: 'ctxlist', 'aria-live': 'off' });
  const tokEl = h('span', { class: 'cap' }, ''); const meter = h('i');
  const logEl = h('ol', { class: 'auditlog', 'aria-label': 'Audit log' });
  const strip = h('ol', { class: 'turnstrip', 'aria-label': 'What happens at each turn under the current settings' });
  const caption = h('div', { class: 'caption', role: 'status' });
  const stepBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guard(step) }, 'Next turn');
  const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => guard(async () => reset()) }, 'Start over');
  const say = (html) => { caption.innerHTML = html || ''; };
  const head = h('header', { class: 'stophead' }, h('div', { class: 'cap' }, cfg.cap), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim));
  const auditPlate = h('div', { class: 'plate' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Audit log'), h('span', { class: 'cap' }, 'Written by the harness')), h('div', { class: 'plate-b' }, logEl));
  const ctxBody = [cfg.ctxControls ? cfg.ctxControls() : null, ctxList, h('div', { class: 'meter', title: 'Share of an illustrative context window' }, meter), cfg.taskNote ? h('p', { class: 'invented' }, 'Invented example. ' + cfg.taskNote) : null];
  const logCount = h('i', {}, '0');
  let ctxPlate;
  if (cfg.auditTab) { // context and audit log share one plate, so neither needs a scroll to be found
    const paneCtx = h('div', { role: 'tabpanel', id: 'pane-ctx' }, ctxBody), paneLog = h('div', { role: 'tabpanel', id: 'pane-log', hidden: true }, h('p', { class: 'invented', style: { margin: '0 0 6px' } }, 'Written by the harness. One entry for each step.'), logEl);
    const setPane = (log) => { paneCtx.hidden = log; paneLog.hidden = !log; tCtx.setAttribute('aria-selected', String(!log)); tLog.setAttribute('aria-selected', String(log)); if (log) logEl.scrollTop = logEl.scrollHeight; };
    const tCtx = h('button', { type: 'button', role: 'tab', 'aria-selected': 'true', 'aria-controls': 'pane-ctx', onclick: () => setPane(false) }, 'Context');
    const tLog = h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', 'aria-controls': 'pane-log', onclick: () => setPane(true) }, 'Audit log ', logCount);
    ctxPlate = h('div', { class: 'plate ctxplate' }, h('div', { class: 'plate-h' }, h('div', { class: 'tabs mini', role: 'tablist', 'aria-label': 'What the model sees, and what the harness recorded' }, tCtx, tLog), tokEl), h('div', { class: 'plate-b' }, paneCtx, paneLog));
  } else ctxPlate = h('div', { class: 'plate ctxplate' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Context · what the model sees'), tokEl), h('div', { class: 'plate-b' }, ctxBody));
  const readout = h('div', { class: 'readout' },
    h('div', { class: 'simlabel wide' }, cfg.simlabel.map(([k, v]) => h('span', {}, h('b', {}, k), v))),
    ...(cfg.panels ? cfg.panels() : []),
    ctxPlate,
    cfg.auditFloat || cfg.auditTab ? null : auditPlate,
  );
  const floatBR = h('div', { class: 'float-br' }, cfg.auditFloat ? auditPlate : null, ...(cfg.floatBR ? cfg.floatBR() : []));
  const floatTR = cfg.floatTR ? h('div', { class: 'float-tr' }, ...cfg.floatTR()) : null;
  const deck = h('div', { class: 'deck plate' }, h('div', { class: 'grp' }, stepBtn, resetBtn), ...(cfg.deck ? cfg.deck() : []), h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'The turns ahead'), strip));
  const ui = h('section', { class: 'stop', 'aria-label': `Stop ${cfg.n}, ${stop.title}` }, head, readout, floatTR, floatBR, deck);
  ctx.hud.append(ui, caption);

  function renderCtx() {
    ctxList.replaceChildren(...state.items.map((it) => { const o = ORIGIN[it.origin]; return h('div', { class: 'ctxitem', style: `--c:${o.css}` }, h('span', { class: 'bar' }), h('span', { class: 'who' }, o.label, h('i', {}, `~${it.tokens.toLocaleString()} tok`)), h('span', { class: 'txt', html: it.html || esc(it.text) })); }));
    const t = tokTotal(); tokEl.textContent = `~${t.toLocaleString()} tok`; meter.style.width = `${Math.min(100, (t / cfg.window) * 100)}%`;
    ctxList.scrollTop = ctxList.scrollHeight;
  }
  function log(who, what, cls = '') {
    const n = state.log.length + 1, time = new Date().toLocaleTimeString();
    state.log.push({ n, who, what, cls, time });
    logEl.append(h('li', { class: cls, title: time }, h('span', { class: 'n' }, String(n).padStart(2, '0')), h('span', { class: 'who' }, who), h('span', { class: 'what' }, what)));
    logEl.scrollTop = logEl.scrollHeight; logCount.textContent = String(n); S3.tick(cls === 'refused' || cls === 'denied');
  }
  function renderStrip() {
    const plan = cfg.plan(state);
    strip.replaceChildren(...plan.map((p, i) => h('li', { class: `${p.status} ${i < state.turn ? 'done' : ''} ${i === state.turn && !state.done ? 'now' : ''}` }, h('b', {}, `TURN ${i + 1}`), h('span', {}, p.label), h('em', {}, p.text))));
  }
  function pushItem(item, animateNote) { state.items.push(item); renderCtx(); if (!animateNote) addSlab(item); }

  function askUser(call) {
    return new Promise((resolve) => {
      const finish = (v) => { box.remove(); stepBtn.focus(); resolve(v); };
      const box = h('div', { class: 'approval', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ap-h' },
        h('div', { class: 'cap' }, 'The harness is asking you'), h('h3', { id: 'ap-h', tabindex: '-1' }, 'Allow this action?'),
        h('pre', {}, call.display),
        call.reason ? h('p', {}, h('b', {}, 'Reason given by the model: '), call.reason) : h('p', {}, 'The model asked for this. The harness will run it only if you approve.'),
        h('div', { class: 'acts' }, h('button', { class: 'btn paperbtn', type: 'button', onclick: () => finish(true) }, 'Approve'), h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(false) }, 'Deny')));
      box.addEventListener('keydown', (e) => { if (e.key === 'Tab') { const f = [...box.querySelectorAll('button')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); } });
      document.body.append(box); box.querySelector('h3').focus();
    });
  }

  // ---------- the loop ----------
  async function step() {
    if (state.done) return;
    if (state.stalled) { // a proposal is lying on the table with no harness to read it
      if (!harnessOn) { say('<b>Still no harness.</b> The request is text. Plug the harness back in to continue.'); return; }
      const { note, call, spec } = state.stalled; state.stalled = null;
      say('The harness is back. It reads the request that was lying on the table.');
      await travel(note, note.position.clone(), P_IN, 0.6, 0.6); note.rotation.y = 0; if (!live()) return;
      await handleCall(note, call, spec); return;
    }
    const spec = cfg.script(state);
    say('The harness sends the <b>whole context</b> to the model.');
    state.calls++; log('Harness', `called the model with ~${tokTotal().toLocaleString()} tokens of context`);
    await S3.feed(); if (!live()) return;
    if (spec.final) {
      say('The model writes an answer with no tool call. <b>The loop ends.</b>');
      const n = await S3.emit('final answer'); if (!live()) return;
      if (!harnessOn) { state.stalled = null; say('<b>No harness.</b> Even the final answer has nowhere to go.'); killNote(n); return; }
      state.items.push({ origin: 'model', text: spec.final.text, html: spec.final.html, tokens: spec.final.tokens }); renderCtx(); addSlab(state.items[state.items.length - 1]);
      log('Model', 'wrote a final answer, no tool call'); log('Harness', 'returned the answer to the user and stopped the loop');
      await travel(n, P_IN, P_HTOP, 0.3, 0.2); await S3.toYou(n); if (!live()) return;
      state.turn++; state.done = true; stepBtn.disabled = true; renderStrip();
      cfg.onFinish && cfg.onFinish(state, { say });
      ctx.announce(`Final answer: ${spec.final.text}`);
      return;
    }
    const call = spec.call;
    say(`The model writes a request as text: <b>${esc(call.tool)}</b>. Text is all it can produce.`);
    const note = await S3.emit(call.display); if (!live()) return;
    state.items.push({ origin: 'model', text: `tool call: ${call.display}`, tokens: call.tokens || 30 }); renderCtx(); addSlab(state.items[state.items.length - 1]);
    if (!harnessOn) { state.stalled = { note, call, spec }; say('<b>No harness.</b> The request is a sentence lying on the table. Nothing reads it. Nothing runs.'); ctx.announce('No harness. The request is text. Nothing runs.'); return; }
    log('Model', `proposed ${call.tool}`);
    await handleCall(note, call, spec);
  }
  async function handleCall(note, call, spec) {
    let verdict = cfg.decide(state, call), asked = false;
    await S3.toGate(note); if (!live()) return;
    if (verdict === 'ask') {
      say('The harness <b>pauses</b> and asks you. The model waits.');
      log('Harness', `paused ${call.tool} for approval`);
      const req = makeNote(PAL.ember, 'approve?'); await travel(req, P_HTOP, P_YOU, 0.7, 0.6); if (!live()) return;
      const ok = await askUser(call); if (!live()) return;
      await S3.fromYou(req); killNote(req);
      log('User', ok ? `approved ${call.tool}` : `denied ${call.tool}`, ok ? '' : 'denied');
      verdict = ok ? 'run' : 'denied'; asked = true;
      state.flags.asked = (state.flags.asked || 0) + 1; if (ok) state.flags.approved = (state.flags.approved || 0) + 1;
    }
    let result;
    if (verdict === 'run') {
      say(`The harness checks its permissions and <b>runs ${esc(call.tool)}</b>.`);
      log('Harness', asked ? `ran ${call.tool} on the user's approval` : `allowed ${call.tool}`);
      await S3.openGate(); await S3.toTool(note, call.tool); killNote(note); if (!live()) return;
      result = typeof spec.result === 'function' ? spec.result('run') : spec.result;
      state.flags[call.tool] = 'ran';
      let rn;
      if (result.viaQuarantine) {
        say('Isolation is on. The outside document goes to a <b>separate reader with no tools</b>. Only its summary comes back.');
        const raw = S3.rawAtTool(call.tool, 'outside document', true); await S3.toQuar(raw, call.tool); if (!live()) return;
        log('Harness', 'sent the outside document to an isolated reader');
        rn = await S3.fromQuar('summary, marked as data');
      } else { rn = await S3.fromTool(call.tool, result.short || 'result', result.taint); await travel(rn, P_HOUT, P_HTOP, 0.3, 0.2); }
      S3.closeGate(); if (!live()) return;
      log('Tool', `${call.tool} returned ${result.logText || 'a result'}`);
      say(result.say || 'The result returns as text and joins the context. <b>The context grows.</b>');
      const item = { origin: result.origin || 'tool', text: result.text, html: result.html, tokens: result.tokens, taint: result.taint };
      state.items.push(item); renderCtx(); await S3.append(rn, item);
    } else {
      const why = verdict === 'denied' ? 'Denied by the user.' : cfg.refuseText(call);
      say(verdict === 'denied' ? 'You said no. The harness <b>does not run it</b> and tells the model.' : `The harness <b>refuses</b>. ${esc(cfg.refuseSay || 'The model asked. The answer was no.')}`);
      if (verdict === 'refuse') log('Harness', `refused ${call.tool}`, 'refused');
      await S3.refuse(note); if (!live()) return;
      state.flags[call.tool] = verdict;
      note.userData.tag && (note.userData.tag.el.textContent = verdict === 'denied' ? 'denied' : 'refused');
      const item = { origin: 'tool', text: `${call.tool} did not run. ${why}`, tokens: 22 };
      state.items.push(item); renderCtx(); await travel(note, P_HOUT, P_HTOP, 0.3, 0.2); await S3.append(note, item);
    }
    state.turn++; renderStrip();
    cfg.afterTurn && cfg.afterTurn(state, { say });
  }
  function reset(keepSay) {
    document.querySelectorAll('.approval').forEach((e) => e.remove());
    S3.reset(); Object.assign(state, { turn: 0, items: [], log: [], done: false, stalled: null, calls: 0, flags: {} });
    logEl.replaceChildren(); stepBtn.disabled = false; if (!keepSay) say('');
    state.items.push({ origin: 'system', text: cfg.system, tokens: cfg.systemTokens || 45 }, { origin: 'user', text: cfg.task, tokens: cfg.taskTokens || 30 });
    state.items.forEach(addSlab); renderCtx(); renderStrip();
    log('User', 'gave the task');
    cfg.onReset && cfg.onReset(state);
  }
  async function guard(fn) { if (state.busy) return; state.busy = true; try { await fn(); } finally { state.busy = false; } }
  async function runAll() { while (alive && !state.done && !state.stalled) await step(); }

  // ---------- view interface ----------
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), portrait = freeW / freeH < 0.9;
    const sizeX = cfg.sizeX ?? (ctx.isNarrow() ? 14.6 : 17.4), sizeY = portrait ? 12.5 : 11;
    const d = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    const az = 0.1, el = portrait ? 0.78 : 0.66;
    home.target.set(ctx.isNarrow() ? (TX - 5.9) / 2 : cfg.tx ?? 0.2, 0.9, ctx.isNarrow() ? 1.5 : cfg.tz ?? 1.5);
    home.pos.set(home.target.x + d * Math.sin(az) * Math.cos(el), home.target.y + d * Math.sin(el), home.target.z + d * Math.cos(az) * Math.cos(el));
    if (!userMoved) { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
  }
  function update(dt, t) { if (!motion.reduced) youBead.userData.halo.material.opacity = 0.75 + Math.sin(t * 2) * 0.2; }

  const api = { state, S3, say, step, reset, guard, runAll, log, renderStrip, renderCtx, setHarness: setHarness3D, isHarnessOn: () => harnessOn, ui, readout, head, deck, live, ORIGIN, stepBtn };
  return { scene, camera, controls, update, frame, api, insets: cfg.insets, dispose() { alive = false; document.querySelectorAll('.approval').forEach((e) => e.remove()); } };
}
