// The map: one machine as a paper maquette. Tower = the model, ring = the system, wall = control, foundry = how it was made.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, cyl, paper, glow, addEdges, halo, emberBead, Trail, tween, wait, ease, flyTo, motion, h, esc } from './kit.js';
import { STOPS, LAYERS, stopByN } from './content.js';

const D = Math.PI / 180;
const P = (phi, r, y = 0) => new THREE.Vector3(r * Math.cos(phi * D), y, r * Math.sin(phi * D));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RY = 0.7;                       // top of the ring platform
const TB = 0.25, TS = 1.3;            // tower base height and scale
const LP = [0.75, 2.2, 3.65, 5.1];    // tower floor plates, local
const PLATES = LP.map((y) => TB + TS * y); // tower floor plates, world
const FZ = TS * 1.5;                  // tower front face
const SR = 5.2;                       // radius of the ring stations
const TOKENS = [' Ninety', ' days', ' in', ' writing', '.'];

function arcWall(r, thick, h0, phi0, phi1, mat) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r + thick / 2, -phi1 * D, -phi0 * D, false);
  s.absarc(0, 0, r - thick / 2, -phi0 * D, -phi1 * D, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h0, bevelEnabled: false, curveSegments: 64 });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; addEdges(m);
  return m;
}
function annulus(r0, r1, h0, mat) {
  const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: h0, bevelEnabled: false, curveSegments: 72 });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; addEdges(m);
  return m;
}
function tube(points, radius, mat, segs = 48) {
  const c = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, segs, radius, 8, false), mat); m.castShadow = true;
  return m;
}
function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export function createMap(ctx) {
  const { scene, key } = baseScene({ fogNear: 38, fogFar: 95, shadow: 22, keyPos: [8, 20, 12] });
  // On a tall screen the foundry sits behind the machine so the whole map fits.
  const sr = ctx.canvas.parentElement.getBoundingClientRect(), TALL = sr.width / Math.max(1, sr.height) < 0.95;
  key.target.position.set(TALL ? 0 : -3, 0, TALL ? -3 : 2); scene.add(key.target);
  const camera = makeCamera(34);
  const home = { pos: V(6, 16, 26), target: V(-2.4, 2.1, 1.2) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 7, maxDist: 75, maxPolar: 1.45, target: home.target });
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf), PD = paper(PAL.paperDark), PM = paper(PAL.paperDim);
  const root = new THREE.Group(); scene.add(root);
  const stations = {}; // n -> { group, anchor, focus, box, side, off, d }
  let alive = true;
  // Exploded view: each layer lifts or slides by its own delta, and the tower floors spread.
  const LD = { 1: V(0, 5.4, 0), 2: TALL ? V(0, 0, -2.4) : V(-2.4, 0, 0), 3: V(0, 2.5, 0), 4: V(0, 0, 0) };
  const FLOOR_GAP = 0.85;
  const mov = []; const track = (o, d) => { mov.push({ o, d, base: null }); return o; };
  const _a = new THREE.Vector3(), _bx = new THREE.Box3();

  function station(n, group, anchor, focus, side = '', { parent = root, lamp = true, floor = null } = {}) {
    group.userData.stop = n; parent.add(group); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group).expandByScalar(0.25);
    const s = stopByN(n), d = LD[s.layer].clone();
    if (floor != null) { d.y += floor * FLOOR_GAP * TS; floors[floor].push(group); } else track(group, LD[s.layer]);
    stations[n] = { n, group, anchor, focus, box, side, d, off: new THREE.Vector3() };
    if (!lamp) return;
    if (s.flagship) { const b = emberBead(0.1, PAL.ember, 1.5); b.position.copy(anchor).y -= 0.3; root.add(b); stations[n].lamp = b; track(b, LD[s.layer]); }
    else { const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 24), glow(0x8a8477)); t.rotation.x = Math.PI / 2; t.position.copy(anchor).y -= 0.3; root.add(t); track(t, LD[s.layer]); }
  }

  // ----- base, ring, wall -----
  const base = cyl(10.3, 0.25, { mat: P2, seg: 96 }); root.add(base);
  const ring = annulus(3.45, 7.0, RY - 0.25, P1); ring.position.y = 0.25; root.add(ring); track(ring, LD[3]);
  const WALL_R = 9.6, WH = 1.0;
  [[97, 121], [135, 443]].forEach(([a, b]) => { const w = arcWall(WALL_R, 0.42, WH, a, b, P1); w.position.y = 0.25; root.add(w); });

  // ----- layer 1: the tower -----
  const tower = new THREE.Group(); tower.position.y = TB; tower.scale.setScalar(TS); root.add(tower); track(tower, LD[1]);
  const floors = [[], [], [], []];
  const plinth = block(3.5, 0.75, 3.5, { mat: P2 }); tower.add(plinth);
  const floorGlow = [];
  LP.forEach((y, i) => {
    const pl = block(3.0, 0.14, 3.0, { mat: P1 }); pl.position.y = y; tower.add(pl); floors[i].push(pl);
    if (i < 3) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const c = block(0.13, 1.31, 0.13, { mat: P1 }); c.position.set(sx * 1.38, y + 0.14, sz * 1.38); tower.add(c); floors[i].push(c); });
    const hg = halo(PAL.ember, 5.2); hg.position.set(0, PLATES[i] + 1.0, 0.6); hg.material.opacity = 0; root.add(hg); floorGlow.push(hg);
  });
  const sign = (i) => V(0, PLATES[i] + 0.09, FZ + 0.03), mid = (i) => V(0, PLATES[i] + 1.0, 0);
  // 1 tokens: a strip of text, then the same strip cut into pieces
  { const g = new THREE.Group(); g.position.y = LP[0] + 0.14;
    const strip = block(2.5, 0.16, 0.42, { mat: PM }); strip.position.set(0, 0, -0.62); g.add(strip);
    let x = -1.24; [0.42, 0.26, 0.5, 0.3, 0.36, 0.22].forEach((w) => { const b = block(w, 0.34, 0.5, { mat: P1 }); b.position.set(x + w / 2, 0, 0.35); g.add(b); x += w + 0.085; });
    station(1, g, sign(0), mid(0), '', { parent: tower, lamp: false, floor: 0 }); }
  // 2 embeddings: points in space, clustered
  { const g = new THREE.Group(); g.position.y = LP[1] + 0.14; const r = rnd(7);
    const pts = []; [[-0.7, 0.62, -0.3], [0.55, 0.92, 0.35], [0.1, 0.36, -0.75]].forEach(([cx, cy, cz]) => { for (let i = 0; i < 6; i++) pts.push([cx + (r() - 0.5) * 0.6, cy + (r() - 0.5) * 0.44, cz + (r() - 0.5) * 0.6]); });
    const sg = new THREE.SphereGeometry(0.075, 14, 10); const lp = [];
    pts.forEach(([x, y, z]) => { const s = new THREE.Mesh(sg, P1); s.position.set(x, y, z); s.castShadow = true; g.add(s); lp.push(x, y, z, x, 0, z); });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: PAL.paperDim, transparent: true, opacity: 0.5 })));
    station(2, g, sign(1), mid(1), '', { parent: tower, lamp: false, floor: 1 }); }
  // 3 attention: every piece connected to every other, with unequal weight
  { const g = new THREE.Group(); g.position.y = LP[2] + 0.14; const xs = [-1.1, -0.66, -0.22, 0.22, 0.66, 1.1];
    xs.forEach((x) => { const p = block(0.16, 0.26, 0.16, { mat: P1 }); p.position.set(x, 0, 0.3); g.add(p); });
    [[0, 5, 0.035], [0, 2, 0.014], [1, 4, 0.022], [2, 5, 0.012], [3, 5, 0.03], [1, 2, 0.01], [0, 3, 0.018]].forEach(([a, b, w]) => {
      const xa = xs[a], xb = xs[b], hh = 0.24 + Math.abs(xb - xa) * 0.4;
      const c = new THREE.QuadraticBezierCurve3(V(xa, 0.26, 0.3), V((xa + xb) / 2, 0.26 + hh * 1.5, 0.3), V(xb, 0.26, 0.3));
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 24, w, 6, false), P1); m.castShadow = true; g.add(m);
    });
    station(3, g, sign(2), mid(2), '', { parent: tower, lamp: false, floor: 2 }); }
  // 4 prediction: a skyline of scores, one drawn
  { const g = new THREE.Group(); g.position.y = LP[3] + 0.14;
    [0.3, 0.62, 1.5, 0.9, 0.45, 0.25, 0.15].forEach((hh, i) => { const b = block(0.27, hh, 0.5, { mat: i === 2 ? glow(PAL.ember) : paper(PAL.paper), edges: i !== 2 }); b.position.set(-1.08 + i * 0.36, 0, 0.2); g.add(b); });
    const hg = halo(PAL.ember, 2.2); hg.position.set(-0.36, 0.9, 0.2); g.add(hg);
    station(4, g, sign(3), mid(3), '', { parent: tower, lamp: false, floor: 3 }); stations[4].lamp = { userData: { halo: hg } }; }

  // ----- layer 3: the ring -----
  // 8 context window: a fixed frame that fills with sheets
  { const g = new THREE.Group(); g.position.copy(P(90, SR, RY));
    [-0.85, 0.85].forEach((x) => { const p = block(0.13, 1.5, 0.13, { mat: P1 }); p.position.x = x; g.add(p); });
    const top = block(1.83, 0.13, 0.13, { mat: P1 }); top.position.y = 1.5; g.add(top);
    for (let i = 0; i < 7; i++) { const s = block(1.45, 0.07, 0.8, { mat: i === 6 ? glow(PAL.ember) : (i % 2 ? P1 : P2), edges: i !== 6 }); s.position.y = 0.02 + i * 0.13; g.add(s); }
    station(8, g, V(1.1, RY + 0.95, SR), P(90, SR, RY + 0.8), 'side'); }
  // 9 retrieval: a shelf, one sheet pulled
  { const g = new THREE.Group(); g.position.copy(P(158, SR, RY)); g.rotation.y = -22 * D;
    const back = block(1.7, 1.25, 0.1, { mat: P2 }); back.position.z = -0.3; g.add(back);
    [0.02, 0.44, 0.86].forEach((y) => { const sh = block(1.7, 0.05, 0.5, { mat: P1 }); sh.position.set(0, y, -0.02); g.add(sh);
      for (let i = 0; i < 9; i++) { if (y === 0.44 && i === 4) continue; const b = block(0.12, 0.3 + ((i * 7 + y * 10) % 3) * 0.03, 0.36, { mat: i % 3 ? P1 : P2 }); b.position.set(-0.72 + i * 0.18, y + 0.05, -0.05); g.add(b); } });
    const pulled = block(0.12, 0.33, 0.36, { mat: P1 }); pulled.position.set(0, 0.07, 0.62); pulled.rotation.z = 78 * D; pulled.rotation.y = 20 * D; g.add(pulled);
    station(9, g, P(158, SR, RY + 2.05), P(158, SR, RY + 0.6)); }
  // 10 tools and agents: a loop with a gate
  let loopBead;
  { const g = new THREE.Group(); g.position.copy(P(22, SR, RY));
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.055, 10, 60), P1); t.rotation.x = Math.PI / 2; t.position.y = 0.55; t.castShadow = true; g.add(t);
    [0, 120, 240].forEach((a) => { const p = block(0.09, 0.5, 0.09, { mat: P1 }); p.position.set(0.72 * Math.cos(a * D), 0, 0.72 * Math.sin(a * D)); g.add(p); });
    const core = block(0.5, 0.75, 0.5, { mat: P2 }); g.add(core);
    const gate = block(0.12, 0.42, 0.34, { mat: P1 }); gate.position.set(0.72, 0.36, 0); g.add(gate);
    loopBead = emberBead(0.085, PAL.ember, 0.9); loopBead.position.set(0.72, 0.55, 0); g.add(loopBead);
    station(10, g, P(22, SR, RY + 1.75), P(22, SR, RY + 0.5)); }
  // 11 data flow: systems on a plate, joined by lines of light
  { const g = new THREE.Group(); g.position.copy(P(206, SR, RY)); g.rotation.y = 24 * D;
    const pl = block(2.1, 0.08, 1.5, { mat: P2 }); g.add(pl);
    const pts = [[-0.75, 0.3], [-0.05, -0.38], [0.7, 0.25], [0.2, 0.42]], hs = [0.32, 0.6, 0.48, 0.24];
    pts.forEach(([x, z], i) => { const b = block(0.34, hs[i], 0.34, { mat: P1 }); b.position.set(x, 0.08, z); g.add(b); const e = emberBead(0.05, PAL.ember, 0.6); e.position.set(x, 0.08 + hs[i] + 0.1, z); g.add(e); });
    const lm = glow(PAL.ember);
    [[0, 1], [1, 2], [1, 3]].forEach(([a, b]) => g.add(tube([V(pts[a][0], 0.14, pts[a][1]), V(pts[b][0], 0.14, pts[b][1])], 0.018, lm, 4)));
    station(11, g, P(206, SR, RY + 1.7), P(206, SR, RY + 0.4)); }

  // ----- layer 4: the wall -----
  // 12 failure modes: a breach, and something foreign coming through it
  { const g = new THREE.Group(); const c = P(128, WALL_R, 0.25); g.position.copy(c); g.rotation.y = -(128 - 90) * D;
    const r = rnd(11);
    for (let i = 0; i < 6; i++) { const b = block(0.3 + r() * 0.3, 0.18 + r() * 0.25, 0.3 + r() * 0.2, { mat: P1 }); b.position.set(-0.9 + i * 0.36 + (r() - 0.5) * 0.2, 0, (r() - 0.5) * 1.0); b.rotation.set((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5); g.add(b); }
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.5, 4), glow(PAL.verm)); shard.rotation.x = 68 * D; shard.position.set(0, 0.62, 0.05); g.add(shard);
    const hg = halo(PAL.verm, 2.0); hg.position.set(0, 0.62, -0.3); g.add(hg);
    station(12, g, P(128, WALL_R, 2.35), P(128, WALL_R, 0.8)); }
  // 13 evaluation: a gauge whose tallest reading is hollow
  { const g = new THREE.Group(); g.position.copy(P(26, WALL_R, 0.25 + WH)); g.rotation.y = -(26 - 90) * D;
    [0.3, 0.46, 0.62, 0.8].forEach((hh, i) => { const b = block(0.22, hh, 0.36, { mat: P1 }); b.position.set(-0.6 + i * 0.3, 0, 0); g.add(b); });
    const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.22, 1.35, 0.36)), new THREE.LineBasicMaterial({ color: PAL.paper })); ghost.position.set(0.6, 0.675, 0); g.add(ghost);
    station(13, g, P(26, WALL_R, 0.25 + WH + 1.85), P(26, WALL_R, 1.6)); }
  // 14 guardrails: the gate every prompt and every answer passes
  let gateBar;
  { const g = new THREE.Group(); g.position.copy(P(90, WALL_R, 0.25));
    [-1.25, 1.25].forEach((x) => { const t = block(0.8, 2.0, 0.8, { mat: P1 }); t.position.x = x; g.add(t); });
    const lint = block(3.3, 0.2, 0.5, { mat: P2 }); lint.position.y = 2.0; g.add(lint);
    gateBar = block(1.7, 0.1, 0.1, { mat: paper(PAL.paperDark) }); gateBar.position.y = 0.72; g.add(gateBar);
    station(14, g, P(90, WALL_R, 3.0), P(90, WALL_R, 1.2)); }

  // ----- layer 2: the foundry, outside the wall -----
  const FX = TALL ? 0 : -15.6, FZ2 = TALL ? -15.8 : 0;
  const yard = block(7.4, 0.2, 7.0, { mat: P2 }); yard.position.set(FX, 0, FZ2); root.add(yard); track(yard, LD[2]);
  // 5 training: steps down toward lower error
  { const g = new THREE.Group(); g.position.set(FX, 0.2, FZ2 - 1.7);
    [2.6, 1.95, 1.3, 0.65].forEach((w, i) => { const b = block(w, 0.3, w, { mat: i % 2 ? P1 : P2 }); b.position.y = i * 0.3; g.add(b); });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), P1); ball.position.set(1.12, 0.43, 1.12); ball.castShadow = true; g.add(ball);
    [[0.35, 1.27, 0.35], [0.6, 0.97, 0.6], [0.86, 0.67, 0.86]].forEach(([x, y, z]) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), PM); d.position.set(x, y, z); g.add(d); });
    station(5, g, V(FX, 2.35, FZ2 - 1.7), V(FX, 0.8, FZ2 - 1.7)); }
  // 6 three levers: one locked, two free
  { const g = new THREE.Group(); g.position.set(FX - 2.0, 0.2, FZ2 + 2.0);
    const con = block(1.9, 0.36, 0.8, { mat: P1 }); g.add(con);
    [-22, 4, 26].forEach((a, i) => { const piv = new THREE.Group(); piv.position.set(-0.6 + i * 0.6, 0.36, 0); piv.rotation.x = a * D; const l = block(0.08, 0.85, 0.08, { mat: i === 0 ? PD : P1 }); piv.add(l); const k = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), i === 0 ? PD : P1); k.position.y = 0.9; k.castShadow = true; piv.add(k); g.add(piv); });
    const lock = block(0.3, 0.22, 0.3, { mat: PD }); lock.position.set(-0.6, 0.36, 0.2); g.add(lock);
    station(6, g, V(FX - 2.0, 2.0, FZ2 + 2.0), V(FX - 2.0, 0.7, FZ2 + 2.0)); }
  // 7 lifecycle: a row of versions, the old ones retired
  { const g = new THREE.Group(); g.position.set(FX + 2.0, 0.2, FZ2 + 2.0);
    [0.5, 0.8, 1.1, 1.45].forEach((hh, i) => { const b = block(0.36, hh, 0.36, { mat: i < 2 ? PD : (i === 2 ? PM : P1) }); b.position.x = -0.72 + i * 0.48; g.add(b); });
    station(7, g, V(FX + 2.0, 2.25, FZ2 + 2.0), V(FX + 2.0, 0.8, FZ2 + 2.0)); }
  // the sealed conduit: finished weights, fixed at release
  const cpts = TALL ? [V(0, 1.45, FZ2 - 1.7), V(1.1, 2.7, -13), V(0.9, 2.5, -9.6), V(0.3, 1.6, -5.6), V(0, 0.8, -2.25)] : [V(FX, 1.45, -1.7), V(-12.6, 2.5, -1.1), V(-9.6, 2.4, -0.5), V(-5.6, 1.6, -0.1), V(-2.25, 0.8, 0)];
  const conduit = tube(cpts, 0.1, PM, 60); root.add(conduit);
  const collars = [0.2, 0.42, 0.63, 0.82].map((k) => { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 16), P1); col.userData.k = k; root.add(col); return col; });
  function shapeConduit(e) { // the conduit stays joined to the foundry and the tower while the layers move apart
    const pts = cpts.map((p, i) => p.clone().addScaledVector(LD[2], e * (1 - i / (cpts.length - 1))).addScaledVector(LD[1], e * (i / (cpts.length - 1))));
    const c = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    if (e > 0 || conduit.userData.moved) { conduit.geometry.dispose(); conduit.geometry = new THREE.TubeGeometry(c, 60, 0.1, 8, false); conduit.userData.moved = true; }
    collars.forEach((col) => { col.position.copy(c.getPointAt(col.userData.k)); col.quaternion.setFromUnitVectors(V(0, 1, 0), c.getTangentAt(col.userData.k)); });
  }
  shapeConduit(0);

  // ----- keyboard -----
  const kb = new THREE.Group(); kb.position.set(0, 0, 13.7); root.add(kb);
  kb.add(block(2.9, 0.16, 1.15, { mat: P2 }));
  const keyMat = P1, keyG = new THREE.BoxGeometry(0.2, 0.08, 0.2);
  const keys = new THREE.InstancedMesh(keyG, keyMat, 33); const dm = new THREE.Object3D(); let ki = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 11; c++) { dm.position.set(-1.25 + c * 0.25, 0.2, -0.3 + r * 0.27); dm.updateMatrix(); keys.setMatrixAt(ki++, dm.matrix); }
  keys.castShadow = true; kb.add(keys);
  const kbGlow = halo(PAL.ember, 3); kbGlow.position.set(0, 0.4, 0); kbGlow.material.opacity = 0; kb.add(kbGlow);

  // ----- trails for "send a prompt" -----
  const C = V(0, 2.1, SR), TOP = V(0, PLATES[3] + 2.7, 0.3);
  const tr = {
    enter: new Trail([V(0, 0.5, 13.4), V(0, 1.0, 11.4), V(0, 1.05, 9.6), V(0, 1.5, 7.5), C]),
    retr: new Trail([C, V(-2.8, 2.7, 4.7), V(-4.7, 2.3, 2.4), V(-2.9, 3.1, 3.1), C], { segs: 80 }),
    climb: new Trail([C, V(0, 1.8, 3.8), V(0, 1.5, 2.6), V(0, PLATES[0] + 0.9, FZ + 0.12), V(0, PLATES[1] + 0.9, FZ + 0.12), V(0, PLATES[2] + 0.9, FZ + 0.12), V(0, PLATES[3] + 1.5, FZ - 0.1), TOP], { segs: 110 }),
    arc: new Trail([TOP, V(0, PLATES[3] + 3.9, 2.9), V(0, 9.4, 6.6), V(0, 4.8, 7.1), C], { color: PAL.teal, segs: 80 }),
    exit: new Trail([C, V(0, 1.5, 7.5), V(0, 1.05, 9.6), V(0, 1.0, 11.4), V(0, 0.5, 13.4)], { color: PAL.teal }),
  };
  Object.values(tr).forEach((t) => root.add(t.group));

  // ----- DOM -----
  const ui = h('div', { class: 'mapui' }); ctx.hud.append(ui);
  ui.append(h('div', { class: 'maphead' },
    h('h1', {}, 'Inside the ', h('em', {}, 'Machine')),
    h('p', {}, 'One machine, built as a paper model. Follow a prompt from the keyboard to the answer. The light is your data.'),
    (() => { const open = STOPS.filter((x) => x.flagship).length, seen = (ctx.visited ? ctx.visited() : []).filter((n) => stopByN(n)).length;
      return h('div', { class: 'keyline' }, h('span', {}, h('i', { class: 'dot' }), `${open} stops open`), open < STOPS.length ? h('span', {}, h('i', { class: 'ring' }), `${STOPS.length - open} previews`) : null, seen ? h('span', {}, h('i', { class: 'seen' }), `${seen} of ${STOPS.length} visited`) : null); })()));
  const legend = h('ol', { class: 'legend', 'aria-label': 'The four layers of the machine' });
  let hlLayer = null;
  LAYERS.forEach((l) => legend.append(h('li', {}, h('button', { type: 'button', 'aria-pressed': 'false', 'data-layer': l.id, onclick: () => highlight(l.id) }, h('span', { class: 'lg-n' }, `0${l.id}`), h('span', { class: 'lg-place' }, l.place), h('span', { class: 'lg-name' }, l.name)))));
  ui.append(legend);
  const ansEl = h('span', { class: 'ans', 'aria-live': 'off' }), capEl = h('p', { class: 'cap2' }, 'Send a prompt to watch the whole machine run once for every token of the answer.'), passEl = h('span', { class: 'cap' }, '');
  const sendBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => sendPrompt() }, 'Send a prompt');
  const explodeBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', onclick: () => setExploded(!exploded) }, 'Exploded view');
  const beginBtn = h('a', { class: 'btn ghost', href: '#/stop/1' }, 'Begin at stop 01');
  const consoleEl = h('div', { class: 'console plate' }, h('div', { class: 'plate-b' },
    h('div', { class: 'row prompt' }, h('b', {}, 'Prompt'), h('span', {}, 'How much notice ends the supply contract?')),
    h('div', { class: 'row' }, h('b', {}, 'Answer'), ansEl),
    capEl,
    h('div', { class: 'foot' }, h('span', { class: 'foot-btns' }, sendBtn, explodeBtn, stopByN(1).flagship ? beginBtn : null), passEl),
    h('div', { class: 'simlabel' }, h('span', {}, h('b', {}, 'Scripted'), 'The path, the prompt, and the five tokens.'), h('span', {}, h('b', {}, 'Real'), 'One full pass through the model per token, each token joining the context.'), h('span', {}, h('b', {}, 'Simplified'), 'No tool calls. Real systems reuse work from earlier passes.'))));
  ui.append(consoleEl);
  const card = h('div', { class: 'stopcard plate', hidden: true }); ui.append(card);

  // tags
  const tagEls = {};
  STOPS.forEach((s) => {
    const st = stations[s.n];
    const b = h('button', { class: `stoptag ${st.side} ${s.layer === 1 ? 'sign' : ''} ${s.flagship ? 'open' : ''}`, type: 'button', 'data-layer': s.layer, 'aria-label': `Stop ${s.n}, ${s.title}. ${s.flagship ? 'Open.' : 'Preview.'}`, onclick: () => ctx.go(`#/map/${s.n}`) }, h('span', { class: 'n' }, String(s.n).padStart(2, '0')), h('span', { class: 'ttl' }, s.short || s.title));
    if (s.flagship && ctx.visited && ctx.visited().includes(s.n)) b.classList.add('seen');
    ctx.tags.add(h('div', {}, b), () => _a.copy(st.anchor).add(st.off)); tagEls[s.n] = b;
  });
  const lab = (txt, pos, em) => ctx.tags.add(h('div', {}, h('span', { class: 'maplabel' + (em ? ' em' : '') }, txt)), pos);
  lab('Your keyboard', V(0, 0.2, 15.0), true);
  const flatLabs = [
    lab('Weights, fixed at release', TALL ? V(4.2, 2.6, -11.2) : V(-11.2, 3.2, -0.9)),
    lab('Layer 2 · The foundry', V(FX, 0.2, FZ2 + 4.4)),
    lab('Layer 3 · The ring', P(318, SR, RY + 0.3)),
    lab('Layer 4 · The wall', P(332, WALL_R + 0.2, 2.0)),
    TALL ? null : lab('Layer 1 · The tower', V(0, PLATES[3] + 3.1, 0)),
  ].filter(Boolean);
  // labels that appear only when the machine is lifted apart
  const xl = (title, line, pos) => { const t = ctx.tags.add(h('div', { class: 'xlabel' }, h('b', {}, title), h('span', {}, line)), pos); t.el.style.display = 'none'; return t; };
  const MID = !TALL && sr.width < 1340; // tablet landscape: the console covers the right side, so two labels move clear of it
  const xLabs = TALL ? [
    xl('Layer 1 · The model', 'Fixed numbers and arithmetic. It keeps nothing between calls.', V(0, PLATES[3] + LD[1].y + 3 * FLOOR_GAP * TS + 2.9, 0)),
    xl('Layer 3 · The system', 'Ordinary software. Your data rests here.', P(190, 5.6, RY + LD[3].y + 0.9)),
    xl('Layer 4 · Control', 'Where a rule or a person can say no.', P(48, WALL_R - 1.2, 1.7)),
    xl('Layer 2 · How it was made', 'Finished before your prompt arrived.', V(FX - 3.4, 2.4, FZ2 + LD[2].z)),
  ] : [
    xl('Layer 1 · The model', 'Fixed numbers and arithmetic. It keeps nothing between calls.', V(3.6, PLATES[2] + LD[1].y + 2.4, 0)),
    xl('Layer 3 · The system', 'Ordinary software. Your data rests here.', MID ? P(285, 9.2, RY + LD[3].y + 0.5) : P(330, 7.6, RY + LD[3].y + 0.5)),
    xl('Layer 4 · Control', 'Where a rule or a person can say no.', MID ? P(80, WALL_R + 1.4, 0.6) : P(338, WALL_R + 0.6, 1.5)),
    xl('Layer 2 · How it was made', 'Finished before your prompt arrived.', V(FX + LD[2].x - (MID ? 3.6 : 1.2), 0.3, FZ2 + 4.6)),
  ];

  // ----- selection -----
  let sel = null, userMoved = false, flying = false;
  controls.addEventListener('start', () => { userMoved = true; });
  function viewOf(n) {
    const st = stations[n], f = st.focus.clone().add(st.off);
    const out = V(f.x, 0, f.z); if (out.length() < 0.5) out.set(0.35, 0, 1); out.normalize();
    const dir = out.multiplyScalar(0.8).add(V(0.25, 0, 0.6)).normalize();
    const d = ctx.isNarrow() ? 24 : 11.5;
    return { pos: V(f.x + dir.x * d * 0.86, f.y + d * 0.5, f.z + dir.z * d * 0.86), target: f.clone() };
  }
  async function select(n) {
    if (n === sel) return;
    sel = n;
    Object.entries(tagEls).forEach(([k, el]) => el.classList.toggle('sel', Number(k) === n));
    ui.classList.toggle('has-sel', !!n);
    if (!n) { card.hidden = true; card.replaceChildren(); consoleEl.hidden = false; const hv = homeView(); flying = true; await flyTo(camera, controls, hv.pos, hv.target, 1.0); flying = false; return; }
    const s = stopByN(n), layer = LAYERS.find((l) => l.id === s.layer);
    card.hidden = false; if (ctx.isNarrow()) consoleEl.hidden = true;
    card.replaceChildren(h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, `Stop ${String(s.n).padStart(2, '0')} · ${layer.place.replace('The ', '')}`), h('span', { class: 'cap ' + (s.flagship ? 'ember' : '') }, s.flagship ? 'Open' : 'Preview')),
      h('div', { class: 'plate-b' },
        h('h2', {}, s.title), h('p', { class: 'claim' }, s.claim),
        h('p', { class: 'why' }, h('b', {}, 'Why a lawyer cares'), s.why),
        s.flagship ? null : h('p', { class: 'notbuilt' }, h('b', {}, 'Not built yet'), 'This stop is a preview. Its interactive model arrives in a later round.'),
        h('div', { class: 'acts' },
          s.flagship ? h('button', { class: 'btn primary', type: 'button', onclick: () => enter(n) }, 'Step inside') : null,
          h('button', { class: 'btn ghost', type: 'button', onclick: () => ctx.go('#/') }, 'Whole map'))));
    ctx.announce(`Stop ${s.n}, ${s.title}. ${s.claim}`);
    const v = viewOf(n); flying = true; await flyTo(camera, controls, v.pos, v.target, 1.1); flying = false;
    if (alive && sel === n) card.querySelector('.btn')?.focus({ preventScroll: true });
  }
  async function enter(n) {
    const f = stations[n].focus.clone().add(stations[n].off), dir = camera.position.clone().sub(f).normalize();
    flyTo(camera, controls, f.clone().addScaledVector(dir, 3.2), f, 0.7);
    await wait(0.38); if (alive) ctx.go(`#/stop/${n}`);
  }
  function highlight(id) {
    hlLayer = hlLayer === id ? null : id;
    ctx.tags.layer.classList.toggle('dimmed', !!hlLayer);
    Object.entries(tagEls).forEach(([k, el]) => el.classList.toggle('hl', stopByN(k).layer === hlLayer));
    legend.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.layer) === hlLayer)));
    if (hlLayer) ctx.announce(LAYERS.find((l) => l.id === hlLayer).where);
    capEl.textContent = hlLayer ? LAYERS.find((l) => l.id === hlLayer).where : IDLE_CAP;
  }

  // picking stations in 3D
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3(); let down = null;
  function pick(e) {
    const r = ctx.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null, bd = Infinity;
    for (const st of Object.values(stations)) { if (ray.ray.intersectBox(_bx.copy(st.box).translate(st.off), hitP)) { const d = hitP.distanceTo(camera.position); if (d < bd) { bd = d; best = st; } } }
    return best;
  }
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 6) return; const st = pick(e); if (st) ctx.go(`#/map/${st.n}`); };
  const onMove = (e) => { if (e.pointerType !== 'mouse' || e.buttons) return; ctx.canvas.style.cursor = pick(e) ? 'pointer' : ''; };
  ctx.canvas.addEventListener('pointerdown', onDown); ctx.canvas.addEventListener('pointerup', onUp); ctx.canvas.addEventListener('pointermove', onMove);

  // ----- exploded view -----
  mov.forEach((m) => { m.base = m.o.position.clone(); });
  floors.forEach((parts, i) => parts.forEach((o) => mov.push({ o, d: V(0, i * FLOOR_GAP, 0), base: o.position.clone() })));
  let exploded = false, E = 0;
  const xhome = { pos: V(0, 0, 0), target: V(0, 0, 0) };
  const homeView = () => (exploded ? xhome : home);
  function applyExplode(k) {
    E = k;
    mov.forEach((m) => m.o.position.copy(m.base).addScaledVector(m.d, k));
    Object.values(stations).forEach((st) => st.off.copy(st.d).multiplyScalar(k));
    shapeConduit(k);
  }
  const IDLE_CAP = 'Send a prompt to watch the whole machine run once for every token of the answer.';
  async function setExploded(on) {
    if (on === exploded || running) return;
    exploded = on; explodeBtn.setAttribute('aria-pressed', String(on)); explodeBtn.textContent = on ? 'Put it back together' : 'Exploded view';
    Object.values(tr).forEach((t) => t.hide());
    flatLabs.forEach((t) => { t.el.style.display = on ? 'none' : ''; });
    if (!on) xLabs.forEach((t) => { t.el.style.display = 'none'; });
    capEl.textContent = on ? 'Lifted apart. The model is the small part in the middle. The system around it holds your data, and the wall is where control sits.' : IDLE_CAP;
    ctx.announce(on ? 'Exploded view. The tower, the ring, the wall, and the foundry are separated. The model is the small part in the middle, the system around it holds your data, and the wall is where control sits.' : 'The machine is back together.');
    const from = E, to = on ? 1 : 0, hv = homeView();
    if (!sel) { flying = true; flyTo(camera, controls, hv.pos, hv.target, 1.2).then(() => { flying = false; }); userMoved = false; }
    await tween({ dur: 1.2, update: (k) => applyExplode(from + (to - from) * k) });
    if (alive && on && exploded) xLabs.forEach((t) => { t.el.style.display = ''; });
  }

  // On the first visit the machine settles together from a half-lifted state, so the four layers read as separate parts.
  if (ctx.intro && !motion.reduced) { applyExplode(0.55); tween({ dur: 2.0, delay: 0.45, e: ease.out, update: (k) => { if (alive && !exploded) applyExplode(0.55 * (1 - k)); } }); }

  // ----- send a prompt -----
  let running = false;
  const flash = (i) => tween({ dur: 0.7, e: ease.lin, update: (k) => { floorGlow[i].material.opacity = Math.sin(k * Math.PI) * 0.85; } });
  async function sendPrompt() {
    if (running) return;
    if (exploded) { await setExploded(false); if (!alive) return; }
    running = true; sendBtn.disabled = true; explodeBtn.disabled = true;
    ansEl.replaceChildren(); passEl.textContent = '';
    Object.values(tr).forEach((t) => t.hide());
    if (sel) ctx.go('#/');
    if (!userMoved || sel) await flyTo(camera, controls, home.pos, home.target, 0.8);
    const say = (t) => { capEl.textContent = t; };
    say('Your prompt leaves the keyboard and passes the guardrail gate.');
    kbGlow.material.opacity = 0.9;
    tween({ dur: 0.5, update: (k) => { gateBar.position.y = 0.72 + k * 1.05; } });
    await tr.enter.run(1.7); if (!alive) return;
    kbGlow.material.opacity = 0;
    say('It lands in the context window, next to the system prompt.');
    await wait(0.5);
    say('Retrieval fetches a passage and adds it to the context.');
    await tr.retr.run(1.5); if (!alive) return;
    tr.retr.fade(0.6);
    const durs = [2.3, 1.5, 1.0, 0.75, 0.6];
    for (let i = 0; i < TOKENS.length; i++) {
      passEl.textContent = `Pass ${i + 1} of ${TOKENS.length}`;
      say(i === 0 ? 'Pass 1. The whole context climbs the model: tokens, embeddings, attention, prediction.' : i === 1 ? 'Pass 2. The whole context climbs again, now one token longer.' : 'Again. One full pass for every token.');
      const d = durs[i]; let next = 0;
      tr.climb.group.visible = true; tr.climb.mat.opacity = 1; tr.climb.head.visible = true;
      await tween({ dur: d, e: ease.io, update: (k) => { tr.climb.set(k); const y = tr.climb.head.position.y; while (next < 4 && y > PLATES[next] + 0.4 && k > 0.3) { flash(next); next++; } } });
      if (!alive) return;
      if (i === 0) say('One token is drawn at the top. It falls back into the context.');
      tr.climb.fade(0.35);
      await tr.arc.run(d * 0.55, ease.io); if (!alive) return;
      ansEl.append(h('span', { class: 'tk' }, TOKENS[i]));
      tr.arc.fade(0.3);
      await wait(i === 0 ? 0.5 : 0.12);
    }
    say('The finished answer returns through the gate.');
    await tr.exit.run(1.5); if (!alive) return;
    tween({ dur: 0.5, update: (k) => { gateBar.position.y = 1.77 - k * 1.05; } });
    tr.exit.fade(0.8); tr.enter.fade(0.8);
    say('Five tokens. Five full passes through the model. A long answer repeats this hundreds of times.');
    passEl.textContent = '5 tokens · 5 passes';
    ctx.announce('The answer: Ninety days in writing. Five tokens took five full passes through the model.');
    sendBtn.disabled = false; explodeBtn.disabled = false; sendBtn.textContent = 'Send it again'; running = false;
  }

  // ----- view interface -----
  const sph = new THREE.Spherical();
  function frame({ W, H, freeW, freeH }) {
    if ((W / Math.max(1, H) < 0.95) !== TALL && W > 50) { ctx.rebuild && ctx.rebuild(); return; } // a rotated tablet gets the other layout
    const tan = Math.tan((camera.fov * D) / 2);
    const sizeX = TALL ? 26 : 34, sizeY = TALL ? 30 : 22.5;
    const d = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    const az = TALL ? 0.1 : 0.2, el = TALL ? 0.62 : 0.5;
    scene.fog.near = Math.max(38, d * 1.05); scene.fog.far = Math.max(95, d * 2.7); // keep the model clear of the fog at any zoom
    home.target.set(TALL ? 0 : -3.4, 3.2, TALL ? -2.4 : 3.0);
    home.pos.set(home.target.x + d * Math.sin(az) * Math.cos(el), home.target.y + d * Math.sin(el), home.target.z + d * Math.cos(az) * Math.cos(el));
    const dx = d * 1.2; xhome.target.set(home.target.x - (TALL ? 0 : 0.6), 5.6, home.target.z - (TALL ? 0.8 : 0));
    xhome.pos.set(xhome.target.x + dx * Math.sin(az) * Math.cos(el * 0.86), xhome.target.y + dx * Math.sin(el * 0.86), xhome.target.z + dx * Math.cos(az) * Math.cos(el * 0.86));
    scene.fog.far = Math.max(scene.fog.far, dx * 2.7);
    const hv = homeView();
    if (!sel && !flying) { camera.position.copy(hv.pos); controls.target.copy(hv.target); controls.update(); userMoved = false; }
  }
  function update(dt, t) {
    loopBead.position.set(0.72 * Math.cos(t * 1.3), 0.55, 0.72 * Math.sin(t * 1.3));
    if (!motion.reduced) {
      for (const st of Object.values(stations)) if (st.lamp) st.lamp.userData.halo.material.opacity = 0.75 + Math.sin(t * 2 + st.n) * 0.25;
      if (!userMoved && !sel && !flying && !running) { // idle sway until the learner takes hold
        sph.setFromVector3(camera.position.clone().sub(controls.target)); sph.theta += Math.cos(t * 0.25) * 0.0006; camera.position.setFromSpherical(sph).add(controls.target);
      }
    }
  }
  function textAlt() {
    return `<p>The map is one machine built as a paper model on a dark table. Light marks your data. A keyboard sits in front. A prompt leaves it, passes a gate in the outer wall, lands in the context window on a ring platform, and climbs a four-floor tower at the center. One token comes out of the top of the tower, falls back into the context, and the whole climb repeats for every token of the answer. A foundry stands outside the wall, joined to the tower by one sealed conduit that carries the finished weights.</p>
    ${LAYERS.map((l) => `<h3>Layer ${l.id}. ${esc(l.name)} (${esc(l.place.toLowerCase())})</h3><p>${esc(l.where)}</p><ol>${STOPS.filter((s) => s.layer === l.id).map((s) => `<li value="${s.n}"><b>${s.flagship ? `<a href="#/stop/${s.n}">${esc(s.title)}</a> (open)` : `<a href="#/map/${s.n}">${esc(s.title)}</a> (preview, not built yet)`}.</b> ${esc(s.claim)} <i>Why a lawyer cares:</i> ${esc(s.why)}</li>`).join('')}</ol>`).join('')}
    <h3>Exploded view</h3><p>The "Exploded view" button lifts the machine apart. The tower (the model) rises highest and its four floors separate. The ring (the system around the model) rises halfway. The wall (control) stays on the table. The foundry slides outward, still joined to the tower by the sealed conduit. The view shows that the model is the small part in the middle, that the system around it is where your data rests, and that control sits at the outer wall.</p>
    <h3>Send a prompt</h3><p>Scripted sequence. The prompt "How much notice ends the supply contract?" produces the answer "Ninety days in writing." in five tokens. Each token takes one full pass through the model, and each new token joins the context before the next pass.</p>`;
  }
  return {
    scene, camera, controls, update, frame, textAlt, select,
    // Below about 1700 wide the console would sit on the ring and its tags, so the model moves left of it.
    insets: () => { if (!ctx.isNarrow()) return { l: 0, r: Math.max(0, Math.min(300, 1700 - window.innerWidth)), t: 52, b: 0 }; const hd = ui.querySelector('.maphead').getBoundingClientRect(), box = (sel ? card : consoleEl).getBoundingClientRect(); return { l: 0, r: 0, t: hd.bottom - 40, b: box.height + 16 }; },
    escape: () => { if (sel) ctx.go('#/'); else if (exploded) setExploded(false); },
    setExploded,
    dispose() { alive = false; ctx.canvas.removeEventListener('pointerdown', onDown); ctx.canvas.removeEventListener('pointerup', onUp); ctx.canvas.removeEventListener('pointermove', onMove); ctx.canvas.style.cursor = ''; ctx.tags.layer.classList.remove('dimmed'); },
  };
}
