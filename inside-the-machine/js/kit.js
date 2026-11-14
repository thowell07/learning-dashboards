// Shared 3D kit: palette, paper materials, light rig, tweens, projected tags, trails.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
export { THREE, OrbitControls };

export const PAL = {
  ink: 0x0c0b0a, table: 0x1a1815, paper: 0xefe8d8, paperWarm: 0xf1e6cc, paperCool: 0xb4b5b0,
  paperDim: 0x8a8477, paperDark: 0x4c4741, graphite: 0x2c2823, line: 0x4a443b,
  ember: 0xffa62b, emberHot: 0xff7a1a, teal: 0x63bfb0, blue: 0x9bb8d3, verm: 0xef5a3c, sys: 0xb9b2a2,
};

// ---------- motion ----------
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
export const motion = { reduced: mq.matches };
mq.addEventListener?.('change', (e) => { motion.reduced = e.matches; });

export const ease = {
  io: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k * k,
  lin: (k) => k,
  bounce: (k) => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375; return n * (k -= 2.625 / d) * k + 0.984375; },
};

const tweens = new Set();
let epoch = 0;
export function tween({ dur = 0.6, e = ease.io, update, delay = 0 }) {
  return new Promise((resolve) => {
    if (motion.reduced || dur <= 0) { update && update(1); resolve(true); return; }
    tweens.add({ t: -delay, dur, e, update, resolve, epoch });
  });
}
export const wait = (s) => tween({ dur: s, update: null });
export function tickTweens(dt) {
  for (const tw of [...tweens]) {
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.update && tw.update(tw.e(k));
    if (k >= 1) { tweens.delete(tw); tw.resolve(true); }
  }
}
// Kill all running tweens (view change). Pending promises resolve false so sequences can stop.
export function clearTweens() { for (const tw of tweens) tw.resolve(false); tweens.clear(); epoch++; }
export const lerp = (a, b, k) => a + (b - a) * k;

// ---------- materials and primitives ----------
export function paper(color = PAL.paper, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0, ...opts });
}
export function glow(color = PAL.ember, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, ...opts });
}
const edgeMat = new THREE.LineBasicMaterial({ color: PAL.line, transparent: true, opacity: 0.9 });
export function addEdges(mesh, color) {
  const g = new THREE.EdgesGeometry(mesh.geometry, 28);
  const l = new THREE.LineSegments(g, color ? new THREE.LineBasicMaterial({ color }) : edgeMat);
  l.userData.isEdge = true;
  mesh.add(l);
  return l;
}
// Box whose origin is the center of its base.
export function block(w, h, d, { color = PAL.paper, mat, edges = true, cast = true, receive = true } = {}) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat || paper(color));
  m.castShadow = cast; m.receiveShadow = receive;
  if (edges) addEdges(m);
  return m;
}
export function cyl(r, h, { color = PAL.paper, mat, seg = 40, edges = true, r2 } = {}) {
  const g = new THREE.CylinderGeometry(r2 ?? r, r, h, seg); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat || paper(color));
  m.castShadow = true; m.receiveShadow = true;
  if (edges) addEdges(m);
  return m;
}
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
export function halo(color = PAL.ember, size = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  s.scale.setScalar(size);
  return s;
}
// A small light source that marks "your data": bright core plus soft halo.
export function emberBead(r = 0.12, color = PAL.ember, haloSize = 1.4) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), glow(color)));
  const h = halo(color, haloSize); g.add(h); g.userData.halo = h;
  return g;
}

// ---------- scene scaffolding ----------
export function baseScene({ fogNear = 26, fogFar = 70, shadow = 16, grid = true, keyPos = [9, 16, 8] } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.ink);
  scene.fog = new THREE.Fog(PAL.ink, fogNear, fogFar);
  const hemi = new THREE.HemisphereLight(0xcfd6e4, 0x2a231c, 0.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffeed2, 2.9);
  key.position.set(...keyPos);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -shadow; sc.right = shadow; sc.top = shadow; sc.bottom = -shadow; sc.near = 1; sc.far = 60;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa6c8, 0.55); rim.position.set(-10, 7, -12); scene.add(rim);
  const table = new THREE.Mesh(new THREE.CircleGeometry(90, 72), paper(PAL.table));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  if (grid) {
    const gh = new THREE.GridHelper(120, 120, 0x38332c, 0x26221e);
    gh.material.transparent = true; gh.material.opacity = 0.55; gh.position.y = 0.012; scene.add(gh);
  }
  return { scene, key, hemi, table };
}
export function makeCamera(fov = 36) { return new THREE.PerspectiveCamera(fov, 1, 0.1, 200); }
export function makeControls(camera, canvas, o = {}) {
  const c = new OrbitControls(camera, canvas);
  c.enableDamping = true; c.dampingFactor = 0.09; c.rotateSpeed = 0.6; c.zoomSpeed = 0.8;
  c.enablePan = false;
  c.minPolarAngle = o.minPolar ?? 0.25; c.maxPolarAngle = o.maxPolar ?? 1.42;
  c.minDistance = o.minDist ?? 6; c.maxDistance = o.maxDist ?? 60;
  if (o.minAz !== undefined) { c.minAzimuthAngle = o.minAz; c.maxAzimuthAngle = o.maxAz; }
  if (o.target) c.target.copy(o.target);
  c.update();
  return c;
}
export function flyTo(camera, controls, pos, target, dur = 1.1) {
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  return tween({ dur, update: (k) => { camera.position.lerpVectors(p0, pos, k); controls.target.lerpVectors(t0, target, k); controls.update(); } });
}
// Keyboard orbit for a focused canvas.
export function keyOrbit(e, controls) {
  const step = 0.09;
  switch (e.key) {
    case 'ArrowLeft': controls._rotateLeft(step); break;
    case 'ArrowRight': controls._rotateLeft(-step); break;
    case 'ArrowUp': controls._rotateUp(step * 0.7); break;
    case 'ArrowDown': controls._rotateUp(-step * 0.7); break;
    case '+': case '=': controls._dollyIn(1 / 0.9); break;
    case '-': case '_': controls._dollyOut(1 / 0.9); break;
    default: return false;
  }
  controls.update();
  e.preventDefault();
  return true;
}

// ---------- projected DOM tags ----------
const _v = new THREE.Vector3();
export class Tags {
  constructor(layer) { this.layer = layer; this.items = new Set(); }
  add(el, pos) { // pos: Vector3 | () => Vector3 | Object3D
    el.classList.add('tag');
    this.layer.appendChild(el);
    const it = { el, pos };
    this.items.add(it);
    return { el, remove: () => { el.remove(); this.items.delete(it); }, set: (p) => { it.pos = p; } };
  }
  clear() { for (const it of this.items) it.el.remove(); this.items.clear(); }
  update(camera, w, h) {
    for (const it of this.items) {
      const p = it.pos;
      if (typeof p === 'function') _v.copy(p()); else if (p.isObject3D) p.getWorldPosition(_v); else _v.copy(p);
      _v.project(camera);
      if (_v.z > 1 || _v.z < -1) { it.el.style.visibility = 'hidden'; continue; }
      it.el.style.visibility = '';
      const x = (_v.x * 0.5 + 0.5) * w, y = (-_v.y * 0.5 + 0.5) * h;
      it.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }
  }
}

// ---------- light trail along a path ----------
export class Trail {
  constructor(points, { color = PAL.ember, radius = 0.045, segs = 96, head = 1.5, tension = 0.4 } = {}) {
    this.curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension);
    this.segs = segs; this.rad = 6;
    const g = new THREE.TubeGeometry(this.curve, segs, radius, this.rad, false);
    this.mat = glow(color, { transparent: true, opacity: 1 });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.head = emberBead(radius * 2.2, color, head);
    this.group = new THREE.Group(); this.group.add(this.mesh, this.head);
    this.set(0); this.group.visible = false;
  }
  set(k) {
    k = Math.max(0, Math.min(1, k));
    this.mesh.geometry.setDrawRange(0, Math.floor(k * this.segs) * this.rad * 6);
    this.curve.getPointAt(k, this.head.position);
    this.k = k;
  }
  async run(dur, e = ease.io) { this.group.visible = true; this.mat.opacity = 1; this.head.visible = true; return tween({ dur, e, update: (k) => this.set(k) }); }
  async fade(dur = 0.5) { this.head.visible = false; await tween({ dur, update: (k) => { this.mat.opacity = 1 - k; } }); this.group.visible = false; }
  hide() { this.group.visible = false; }
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map && m.map !== glowTex) m.map.dispose(); m.dispose(); }); }
  });
}

// ---------- DOM helpers ----------
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return el;
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
