// Stop 11. Data flow map: systems on plates that show who controls them, a prompt that travels, copies that stay.
import { THREE, PAL, baseScene, makeCamera, makeControls, block, cyl, paper, glow, halo, emberBead, tween, wait, ease, motion, lerp, h, esc } from './kit.js';
import { stopByN } from './content.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const NODES = {
  device: { name: 'Your device', top: 1.15 },
  app: { name: 'Application servers', top: 1.7 },
  retr: { name: 'Retrieval store', top: 1.2 },
  model: { name: 'Model endpoint', top: 1.75 },
  plogs: { name: 'Provider logs', top: 1.25 },
  alogs: { name: 'Application logs', top: 1.25 },
  train: { name: 'Training pipeline', top: 1.0 },
  maker: { name: 'Model maker', top: 1.2 },
};
const VARIES = 'Varies by vendor and contract.';
// Each pattern: plates (who controls what), where each system sits, and what rests there.
const PATTERNS = {
  consumer: {
    name: 'Consumer chat app', sub: 'Public app, standard terms', you: 'you',
    moved: 'Only the device is yours. Every other system sits with the app company.',
    plates: { you: [-10.3, -6.7, -2.5, 3.3, 'You control'], vendor: [-5.5, 10.2, -5.4, 5.4, 'The app company controls'] },
    nodes: {
      device: { p: [-8.5, 0.4], z: 'you', copy: 'kept', note: 'local history', rests: 'The app’s local history and cache, plus your original file.', control: 'You.', term: 'Your own device security. The app’s terms of use govern what the app may send onward.' },
      app: { p: [-3.0, 0.2], z: 'vendor', copy: 'kept', note: 'chat history + file', rests: 'Your conversation history and the uploaded file, tied to your account.', control: 'The app company.', term: 'Consumer terms of service and privacy policy. Retention and deletion settings vary by vendor.' },
      retr: { p: [-0.6, -3.3], z: 'vendor', copy: 'kept', note: 'chunks + embeddings', rests: 'Chunks of the uploaded file and their embeddings, kept so the app can search the file.', control: 'The app company.', term: 'The same consumer terms. Ask whether deleting a chat also deletes these derived copies.' },
      model: { p: [3.4, 0.2], z: 'vendor', copy: 'transient', note: 'in memory only', rests: 'Nothing at rest. The prompt is held in memory while the answer is computed. The model’s weights do not change.', control: 'The app company, which usually also runs the model in this pattern.', term: 'Consumer terms of service.' },
      plogs: { p: [7.2, -2.7], z: 'vendor', copy: 'kept', note: 'safety log', name: 'Safety and abuse logs', rests: 'Request records kept for safety review and abuse monitoring. They can include prompt text.', control: 'The app company.', term: `Privacy policy. Retention periods and human review practices differ. ${VARIES}` },
      alogs: { p: [0.6, 3.5], z: 'vendor', copy: 'kept', note: 'product log', rests: 'Product analytics and operations logs. Content or only metadata, depending on the product.', control: 'The app company.', term: 'Privacy policy.' },
      train: { p: [7.4, 2.7], z: 'vendor', copy: 'possible', note: 'possible, by settings', rests: 'A possible copy. Consumer conversations may be used to train later models, depending on the vendor’s terms and your settings.', control: 'The app company.', term: `The training-use clause and any opt-out setting. ${VARIES}` },
    },
  },
  api: {
    name: 'Enterprise API', sub: 'With a no-retention term', you: 'your organization',
    moved: 'Your organization now runs the app, the retrieval store, and its logs. One system, the model endpoint, sits with the provider.',
    plates: { you: [-10.4, 0.3, -5.4, 5.4, 'Your organization controls'], provider: [2.3, 10.2, -4.6, 4.6, 'The model provider controls'] },
    nodes: {
      device: { p: [-8.7, 0.4], z: 'you', copy: 'kept', note: 'local cache', rests: 'A local cache and the original file.', control: 'Your organization.', term: 'Internal device and information security policy.' },
      app: { p: [-4.7, 0.2], z: 'you', copy: 'kept', note: 'history + file', rests: 'Conversation history and uploaded files, inside your organization’s own application.', control: 'Your organization. If a software vendor hosts the app, that vendor is one more party on the map.', term: 'Internal retention policy, or the agreement with the app vendor.' },
      retr: { p: [-2.4, -3.3], z: 'you', copy: 'kept', note: 'chunks + embeddings', rests: 'Chunks and embeddings of your documents.', control: 'Your organization, or a vector database vendor acting as a subprocessor.', term: 'Internal policy, or the data processing agreement with that vendor.' },
      alogs: { p: [-2.2, 3.5], z: 'you', copy: 'kept', note: 'your own logs', rests: 'Your own application and audit logs. Often the longest-lived copy on the map.', control: 'Your organization.', term: 'Internal logging and retention policy.' },
      model: { p: [4.7, 0.2], z: 'provider', copy: 'transient', note: 'in memory only', rests: 'Nothing at rest. The prompt is processed in memory. The weights do not change.', control: 'The model provider.', term: 'The API agreement and its data processing terms.' },
      plogs: { p: [7.9, -2.7], z: 'provider', copy: 'none', note: 'not stored under the term', rests: 'Under a zero-retention term the provider agrees not to store prompts and outputs after processing. Exceptions can apply, for example for legal obligations or flagged abuse.', control: 'The model provider.', term: `The zero-retention term and its exceptions. Confirm which features it covers. ${VARIES}`,
        alt: { copy: 'kept', note: 'log kept for a period', rests: 'Request and response records kept for a limited period, commonly for abuse monitoring. A no-training promise leaves this log in place.', term: `The data retention clause of the API agreement. ${VARIES}` } },
      train: { p: [7.9, 2.7], z: 'provider', copy: 'none', cut: true, note: 'excluded by contract', rests: 'No copy. Business API terms commonly exclude customer data from training. Confirm it in the contract.', control: 'The model provider.', term: 'The training-use clause.' },
    },
  },
  cloud: {
    name: 'Your own cloud account', sub: 'Model hosted inside it', you: 'your organization',
    moved: 'The model moves inside your cloud account and the model maker drops out of the data path. The cloud provider sits underneath everything.',
    plates: { you: [-10.4, -7.3, -2.5, 3.3, 'Your devices'], cloud: [-6.3, 6.9, -5.5, 5.5, 'Cloud provider’s infrastructure'], account: [-5.7, 6.3, -4.8, 4.8, 'Your cloud account'], maker: [7.9, 10.3, -1.7, 2.1, 'Model maker'] },
    nodes: {
      device: { p: [-8.9, 0.4], z: 'you', copy: 'kept', note: 'local cache', rests: 'A local cache and the original file.', control: 'Your organization.', term: 'Internal device and information security policy.' },
      app: { p: [-3.7, 0.2], z: 'account', copy: 'kept', note: 'history + file', rests: 'Conversation history and uploaded files, in storage inside your cloud account.', control: 'Your organization, on the cloud provider’s infrastructure.', term: 'Internal retention policy and the cloud services agreement.' },
      retr: { p: [-1.5, -3.1], z: 'account', copy: 'kept', note: 'chunks + embeddings', rests: 'Chunks and embeddings of your documents, in a database inside your account.', control: 'Your organization, on the cloud provider’s infrastructure.', term: 'Internal policy and the cloud services agreement.' },
      alogs: { p: [-1.1, 3.2], z: 'account', copy: 'kept', note: 'your own logs', rests: 'Your own application and audit logs.', control: 'Your organization.', term: 'Internal logging and retention policy.' },
      model: { p: [2.7, 0.2], z: 'account', copy: 'transient', note: 'in memory only', rests: 'Nothing at rest. The model runs inside your account or through the cloud provider’s managed model service.', control: 'You configure it. The cloud provider operates the infrastructure.', term: 'The cloud services agreement and the terms of its AI service.' },
      plogs: { p: [4.7, -3.0], z: 'account', copy: 'kept', note: 'if you enable it', name: 'Cloud service logs', rests: 'Invocation logs, when you switch them on, stored in your account. Some managed services also keep their own abuse-monitoring records unless arranged otherwise.', control: 'Your organization, within the cloud provider’s infrastructure.', term: `Cloud service terms and your own logging configuration. ${VARIES}` },
      maker: { p: [9.1, 0.2], z: 'maker', copy: 'none', note: 'no prompts arrive', rests: 'No prompts and no outputs in this pattern. The model maker supplies the model to the cloud provider.', control: 'The model maker.', term: 'The cloud provider’s service terms describe this. Confirm it there.' },
    },
  },
  self: {
    name: 'Self-hosted or on-device', sub: 'Open-weight model, your hardware', you: 'you',
    moved: 'Every system sits on hardware you run. The copies still exist. Securing, backing up, and deleting them is now your job.',
    plates: { you: [-10.4, 5.7, -5.4, 5.4, 'Your own hardware'], maker: [7.9, 10.3, -1.7, 2.1, 'Model maker'] },
    nodes: {
      device: { p: [-8.3, 0.4], z: 'you', copy: 'kept', note: 'local cache', rests: 'A local cache and the original file. On-device, every other system on this map can sit here too.', control: 'You.', term: 'Your own security practice.' },
      app: { p: [-4.1, 0.2], z: 'you', copy: 'kept', note: 'history + file', rests: 'Conversation history and files, on hardware you run.', control: 'You.', term: 'Internal policy. No vendor data term applies, because the prompt goes to no vendor.' },
      retr: { p: [-1.7, -3.1], z: 'you', copy: 'kept', note: 'chunks + embeddings', rests: 'Chunks and embeddings of your documents.', control: 'You.', term: 'Internal policy.' },
      alogs: { p: [-1.3, 3.2], z: 'you', copy: 'kept', note: 'your own logs', rests: 'Your own logs.', control: 'You.', term: 'Internal logging and retention policy.' },
      model: { p: [2.9, 0.2], z: 'you', copy: 'transient', note: 'in memory only', rests: 'Nothing at rest. An open-weight model runs on your own hardware.', control: 'You.', term: 'The model license governs your use of the weights. Your prompts go nowhere else.' },
      maker: { p: [9.1, 0.2], z: 'maker', copy: 'none', note: 'weights downloaded once', rests: 'Nothing of yours. The weights were downloaded once. No prompt flows back.', control: 'The model maker.', term: 'The model license.' },
    },
  },
};
const ORDER = ['consumer', 'api', 'cloud', 'self'];
const PLATE_IDS = ['you', 'vendor', 'provider', 'cloud', 'account', 'maker'];
const LINKS = [['device', 'app'], ['app', 'retr'], ['app', 'model'], ['model', 'plogs'], ['app', 'alogs'], ['app', 'train'], ['maker', 'model']];

export function createStop11(ctx) {
  const stop = stopByN(11);
  const { scene, key } = baseScene({ fogNear: 30, fogFar: 72, shadow: 15, keyPos: [6, 17, 9] });
  const camera = makeCamera(36);
  const home = { pos: V(0, 14, 16), target: V(0, 0.4, 0.4) };
  const controls = makeControls(camera, ctx.canvas, { minDist: 7, maxDist: 55, maxPolar: 1.38, target: home.target });
  const world = new THREE.Group(); scene.add(world);
  const P1 = paper(PAL.paper), P2 = paper(0xd9d1bf), PD = paper(PAL.paperDark);
  let alive = true, userMoved = false, pat = 'consumer', zdr = true, sel = null, busy = false, sent = false;
  controls.addEventListener('start', () => { userMoved = true; });
  const info = (id) => { const n = PATTERNS[pat].nodes[id]; if (!n) return null; return id === 'plogs' && pat === 'api' && !zdr && n.alt ? { ...n, ...n.alt } : n; };

  // ----- plates -----
  const plates = {};
  PLATE_IDS.forEach((id) => {
    const mine = id === 'you' || id === 'account';
    const m = block(1, 1, 1, { mat: paper(mine ? 0xf3e7c9 : id === 'maker' ? 0x9d9c97 : 0xb7b6b0), cast: false }); world.add(m);
    const fence = mine ? [0, 1, 2, 3].map(() => { const f = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glow(PAL.ember)); world.add(f); return f; }) : null;
    const el = h('div', { class: 'zonetag' + (mine ? ' you' : '') }, '');
    const r = { x0: 0, x1: 0, z0: 0, z1: 0, on: 0 };
    plates[id] = { m, fence, r, want: { ...r }, el, base: id === 'account' ? 0.12 : 0, hgt: id === 'account' ? 0.1 : 0.12 };
    ctx.tags.add(el, () => _v.set(r.x0 + 0.15, plates[id].base + plates[id].hgt + 0.02, r.z1 + 0.42));
  });
  const _v = new THREE.Vector3();

  // ----- nodes -----
  const nodes = {};
  function build(id) {
    const g = new THREE.Group();
    if (id === 'device') { g.add(block(1.5, 0.08, 1.0, { mat: P1 })); const s = block(1.5, 0.95, 0.06, { mat: P1 }); s.position.set(0, 0.06, -0.5); s.rotation.x = -0.22; g.add(s); const scr = block(1.3, 0.78, 0.02, { mat: glow(0x3a2a12), edges: false }); scr.position.set(0, 0.14, -0.455); scr.rotation.x = -0.22; g.add(scr); }
    if (id === 'app') { [[-0.5, 1.5], [0.35, 1.2], [1.05, 0.8]].forEach(([x, hh]) => { const r = block(0.62, hh, 0.95, { mat: P1 }); r.position.x = x - 0.3; g.add(r); for (let i = 1; i < hh / 0.3; i++) { const l = block(0.64, 0.02, 0.97, { mat: PD, edges: false, cast: false }); l.position.set(x - 0.3, i * 0.3, 0); g.add(l); } }); }
    if (id === 'retr') { for (let i = 0; i < 7; i++) { const s = block(1.3, 0.09, 1.0, { mat: i % 2 ? P1 : P2 }); s.position.set((i % 3) * 0.05 - 0.05, i * 0.14, 0); g.add(s); } }
    if (id === 'model') { const m = block(1.5, 1.5, 1.5, { mat: P1 }); g.add(m); const so = block(0.04, 0.1, 0.6, { mat: paper(0x1b1815), edges: false }); so.position.set(0.75, 0.7, 0); g.add(so); const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.04, 0.13), P2, 25); const d = new THREE.Object3D(); let k = 0; for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) { d.position.set(-0.5 + x * 0.25, 1.52, -0.5 + z * 0.25); d.updateMatrix(); studs.setMatrixAt(k++, d.matrix); } g.add(studs); }
    if (id === 'plogs' || id === 'alogs') { g.add(cyl(0.55, 0.95, { mat: P1 })); const t = block(0.4, 0.02, 0.9, { mat: P2, cast: false }); t.position.set(0, 0, 0.9); g.add(t); for (let i = 0; i < 4; i++) { const k2 = block(0.3, 0.03, 0.04, { mat: PD, edges: false, cast: false }); k2.position.set(0, 0.01, 0.62 + i * 0.18); g.add(k2); } }
    if (id === 'train') { [1.5, 1.1, 0.7, 0.3].forEach((w, i) => { const b = block(w, 0.2, w, { mat: i % 2 ? P1 : P2 }); b.position.y = i * 0.2; g.add(b); }); }
    if (id === 'maker') { const b = block(1.1, 0.7, 1.1, { mat: P2 }); g.add(b); const c = block(0.55, 0.45, 0.55, { mat: P1 }); c.position.y = 0.7; g.add(c); }
    world.add(g);
    const copy = new THREE.Group(); const slab = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.4), glow(PAL.ember)); const hl = halo(PAL.ember, 2.1); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 28), glow(PAL.ember)); ring.rotation.x = Math.PI / 2;
    copy.add(slab, hl, ring); copy.visible = false; world.add(copy);
    const selRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.03, 8, 48), glow(PAL.paper)); selRing.rotation.x = Math.PI / 2; selRing.visible = false; world.add(selRing);
    const btn = h('button', { type: 'button', onclick: () => select(id) }, h('span', {}, NODES[id].name), h('small', {}, ''));
    const el = h('div', { class: 'systag' }, btn);
    const n = { id, g, copy, slab, hl, ring, selRing, el, btn, x: 0, z: 0, wx: 0, wz: 0, s: 0, ws: 0, baseY: 0, wy: 0, state: 'none' };
    ctx.tags.add(el, () => _v.set(n.x, n.baseY + NODES[id].top + 0.62, n.z));
    nodes[id] = n;
  }
  Object.keys(NODES).forEach(build);
  // links
  const linkGeo = new THREE.BufferGeometry(); linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(LINKS.length * 6), 3));
  world.add(new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ color: 0x6d675c, transparent: true, opacity: 0.8 })));
  const packet = new THREE.Group(); const pk = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.42), glow(PAL.ember)); packet.add(pk, halo(PAL.ember, 2.6)); packet.visible = false; world.add(packet);

  // ----- DOM -----
  const caption = h('div', { class: 'caption', role: 'status' }); const say = (html) => { caption.innerHTML = html || ''; };
  const tally = { rest: h('b', {}, '0'), out: h('b', {}, '0'), model: h('b', {}, '0') };
  const infoEl = h('div', { class: 'plate-b sysinfo', 'aria-live': 'polite' });
  const patIn = {};
  const patterns = h('div', { class: 'patterns', role: 'radiogroup', 'aria-label': 'Deployment pattern' }, ORDER.map((k) => { patIn[k] = h('input', { type: 'radio', name: 's11-pat', value: k, checked: k === pat, onchange: () => setPattern(k) }); return h('label', {}, patIn[k], h('span', {}, h('b', {}, PATTERNS[k].name), h('i', {}, PATTERNS[k].sub))); }));
  const sendBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => send() }, 'Send a prompt');
  const clearBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (!busy) { sent = false; applyCopies(true); say(''); } } }, 'Clear copies');
  const zdrIn = h('input', { type: 'checkbox', checked: true, onchange: (e) => setZdr(e.target.checked) });
  const zdrSw = h('label', { class: 'switch' }, zdrIn, h('i'), 'Zero-retention term');
  const ui = h('section', { class: 'stop', 'aria-label': 'Stop 11, Data flow map' },
    h('header', { class: 'stophead' }, h('div', { class: 'cap' }, 'Stop 11 · On the ring, behind the tower'), h('h1', {}, stop.title), h('p', { class: 'claim' }, stop.claim)),
    h('div', { class: 'readout' },
      h('div', { class: 'simlabel wide' }, h('span', {}, h('b', {}, 'Scripted'), 'Four typical architectures and one prompt’s path.'), h('span', {}, h('b', {}, 'Real'), 'The kinds of systems, copies, and governing terms.'), h('span', {}, h('b', {}, 'Simplified'), `Real deployments add caches, backups, and more vendors. What a vendor keeps: ${VARIES.toLowerCase()}`)),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'After one prompt and one attached file'), h('span', { class: 'cap' }, 'Invented example')), h('div', { class: 'tally' }, h('div', {}, tally.rest, h('span', {}, 'Copies at rest')), h('div', { class: 'out' }, tally.out, h('span', {}, 'Outside your control')), h('div', {}, tally.model, h('span', {}, 'Kept by the model')))),
      h('div', { class: 'plate wide' }, h('div', { class: 'plate-h' }, h('span', { class: 'cap' }, 'Selected system'), h('span', { class: 'cap' }, 'Click any system')), infoEl)),
    h('div', { class: 'deck plate' }, h('div', { class: 'grp col', style: { flex: '1 1 520px' } }, h('span', { class: 'cap' }, 'Deployment pattern · watch the boundary move'), patterns), h('div', { class: 'grp' }, sendBtn, clearBtn, zdrSw)));
  ctx.hud.append(ui, caption);

  // ----- behavior -----
  function setPattern(k, quiet) {
    if (busy) { patIn[pat].checked = true; return; }
    pat = k; patIn[k].checked = true; const P = PATTERNS[k];
    PLATE_IDS.forEach((id) => { const pl = plates[id], r = P.plates[id]; if (r) { Object.assign(pl.want, { x0: r[0], x1: r[1], z0: r[2], z1: r[3], on: 1 }); pl.el.textContent = r[4]; pl.el.classList.remove('gone'); if (pl.r.on < 0.05) Object.assign(pl.r, { x0: (r[0] + r[1]) / 2, x1: (r[0] + r[1]) / 2, z0: (r[2] + r[3]) / 2, z1: (r[2] + r[3]) / 2 }); } else { pl.want.on = 0; pl.el.classList.add('gone'); } });
    Object.values(nodes).forEach((n) => { const d = P.nodes[n.id]; if (d) { n.wx = d.p[0]; n.wz = d.p[1]; n.ws = 1; n.wy = d.z === 'account' ? 0.22 : 0.12; if (n.s < 0.05) { n.x = n.wx; n.z = n.wz; } n.el.classList.remove('gone'); n.btn.firstChild.textContent = d.name || NODES[n.id].name; } else { n.ws = 0; n.el.classList.add('gone'); if (sel === n.id) sel = null; } });
    zdrSw.style.display = k === 'api' ? '' : 'none';
    applyCopies(true); renderInfo();
    if (!quiet) { say(`<b>${esc(P.name)}.</b> ${esc(P.moved)}`); ctx.announce(`${P.name}. ${P.moved}`); }
    ctx.refit();
  }
  function setZdr(on) { zdr = on; zdrIn.checked = on; applyCopies(true); renderInfo(); say(on ? '<b>Zero-retention term on.</b> The provider agrees not to keep prompts after processing. Read the exceptions.' : '<b>Standard API terms.</b> Still no training. The provider now keeps a log copy for a period.'); }
  function setCopy(n, state) { // 'none' | 'kept' | 'possible' | 'transient'
    n.state = state; n.copy.visible = state !== 'none';
    n.slab.visible = n.hl.visible = state === 'kept' || state === 'transient'; n.ring.visible = state === 'possible';
    const d = info(n.id);
    n.btn.lastChild.textContent = !d ? '' : state === 'kept' ? d.note : state === 'possible' ? d.note : (sent && (d.copy === 'transient' || d.copy === 'none')) ? d.note : '';
  }
  function countUp() {
    let rest = 0, out = 0;
    Object.values(nodes).forEach((n) => { if (n.state === 'kept') { rest++; const z = PATTERNS[pat].nodes[n.id].z; if (z !== 'you' && z !== 'account') out++; } });
    tally.rest.textContent = String(rest); tally.out.textContent = String(out); tally.model.textContent = '0';
    return { rest, out };
  }
  function applyCopies(instant) { // show the end state for the current pattern, or clear
    Object.values(nodes).forEach((n) => { const d = info(n.id); setCopy(n, sent && d ? (d.copy === 'kept' ? 'kept' : d.copy === 'possible' ? 'possible' : 'none') : 'none'); });
    countUp(); void instant;
  }
  function select(id) {
    sel = sel === id ? null : id;
    Object.values(nodes).forEach((n) => { n.el.classList.toggle('sel', n.id === sel); n.selRing.visible = n.id === sel; });
    renderInfo();
  }
  function renderInfo() {
    const d = sel && info(sel);
    if (!d) { infoEl.replaceChildren(h('p', { style: { color: 'var(--dim)', fontSize: '13.5px' } }, 'Select a system on the map to see what rests there, who controls it, and which kind of contract term governs it.')); return; }
    const mine = d.z === 'you' || d.z === 'account';
    infoEl.replaceChildren(h('h3', {}, d.name || NODES[sel].name), h('span', { class: 'zone ' + (mine ? 'you' : 'them') }, mine ? `Inside ${PATTERNS[pat].you === 'you' ? 'your' : 'your organization’s'} control` : 'Outside your control'),
      h('dl', {}, h('div', {}, h('dt', {}, 'What rests here'), h('dd', {}, d.rests)), h('div', {}, h('dt', {}, 'Who controls it'), h('dd', {}, d.control)), h('div', {}, h('dt', {}, 'Governing term'), h('dd', {}, d.term))));
  }
  const top = (id) => V(nodes[id].x, nodes[id].baseY + NODES[id].top + 0.3, nodes[id].z);
  const hop = (a, b, dur = 0.8) => { const A = top(a), B = top(b); return tween({ dur, update: (k) => { packet.position.lerpVectors(A, B, k); packet.position.y += Math.sin(k * Math.PI) * 1.0; } }); };
  function drop(id) { const n = nodes[id], d = info(id); if (!d) return; if (d.copy === 'kept') setCopy(n, 'kept'); else if (d.copy === 'possible') setCopy(n, 'possible'); else setCopy(n, 'none'); countUp(); }
  async function send(quiet) {
    if (busy) return; busy = true; sendBtn.disabled = true; sent = false; applyCopies(true); sent = true;
    const P = PATTERNS[pat], has = (id) => !!P.nodes[id];
    packet.visible = true; packet.position.copy(top('device'));
    say('You type a prompt and attach a file. <b>A copy stays on the device.</b>'); drop('device'); await wait(0.9); if (!alive) return;
    say('The prompt and the file travel to the application servers. <b>The app keeps the conversation and the file.</b>'); await hop('device', 'app'); drop('app'); await wait(0.6); if (!alive) return;
    say('The file is cut into chunks and indexed. <b>The retrieval store keeps chunks and embeddings.</b>'); await hop('app', 'retr', 0.7); drop('retr'); await wait(0.5); if (!alive) return;
    say('Matching passages return to the app.'); await hop('retr', 'app', 0.6); if (!alive) return;
    say('Prompt, passages, and instructions go to the model endpoint.'); await hop('app', 'model'); if (!alive) return;
    setCopy(nodes.model, 'transient'); say('The model computes an answer. <b>The prompt is in memory only. The weights do not change.</b>'); await wait(1.3); if (!alive) return;
    if (has('plogs')) { const d = info('plogs'); say(d.copy === 'kept' ? 'The request is recorded. <b>A log copy stays.</b>' : 'Under the zero-retention term, <b>no log copy is written</b>. Exceptions can apply.'); await hop('model', 'plogs', 0.7); drop('plogs'); await wait(0.6); if (!alive) return; await hop('plogs', 'model', 0.5); }
    await tween({ dur: 0.5, update: (k) => { nodes.model.hl.material.opacity = 1 - k; nodes.model.slab.material.opacity = 1 - k; nodes.model.slab.material.transparent = true; } });
    setCopy(nodes.model, 'none'); nodes.model.hl.material.opacity = 1; nodes.model.slab.material.opacity = 1;
    say('The answer returns to the app.'); await hop('model', 'app'); if (!alive) return;
    say('The exchange is written to the application logs. <b>Another copy.</b>'); await hop('app', 'alogs', 0.7); drop('alogs'); await wait(0.5); if (!alive) return; await hop('alogs', 'app', 0.5);
    if (has('train')) { const d = info('train'); say(d.copy === 'possible' ? 'Depending on the terms and your settings, <b>the conversation may feed later training</b>.' : 'The contract excludes your data from training. <b>No copy goes here.</b>'); if (d.copy === 'possible') { await hop('app', 'train', 0.9); drop('train'); await wait(0.6); await hop('train', 'app', 0.6); } else { drop('train'); await wait(1.0); } if (!alive) return; }
    say('The answer reaches your screen.'); await hop('app', 'device'); packet.visible = false; if (!alive) return;
    applyCopies(true); const { rest, out } = countUp();
    if (!quiet) say(`<b>One prompt. ${rest} copies at rest. ${out} outside ${P.you === 'you' ? 'your' : 'your organization’s'} control. 0 kept by the model.</b> Switch the pattern and watch the copies change hands.`);
    ctx.announce(`One prompt left ${rest} copies at rest, ${out} outside your control, and none in the model.`);
    busy = false; sendBtn.disabled = false; sendBtn.textContent = 'Send it again';
    return { rest, out };
  }

  const demos = {
    stayed: async () => { if (busy) return; const r = await send(true); if (!r || !alive) return; say(`<b>The model kept nothing. Everything around it kept something.</b> ${r.rest} copies are at rest, ${r.out} of them outside your control.`); },
    notrain: async () => { if (busy) return; setPattern('api', true); setZdr(false); const r = await send(true); if (!r || !alive) return; select('plogs'); if (sel !== 'plogs') select('plogs'); say('<b>No training. Still stored.</b> The training line is cut by contract, and the provider’s log copy is lit. Two separate promises.'); },
  };

  const idle = async () => { while (busy && alive) await new Promise((r) => setTimeout(r, 80)); };
  const KEYS = Object.keys(PATTERNS);
  const beats = [
    { title: 'Six systems and one boundary', note: 'The lit fence marks what you control. In a consumer chat app that is your device and nothing else.', run: async () => { await idle(); sent = false; setPattern(KEYS[0], true); if (sel) select(sel); say(''); } },
    { title: 'Send one prompt', note: 'Follow the ember. Each system it touches may keep a lit copy when it moves on.', run: async () => { await idle(); setPattern(KEYS[0], true); await send(); } },
    { title: 'The model kept nothing', note: 'The model endpoint lit up while it computed and went dark again. The lasting copies are in the history, the retrieval store, and the logs.', run: async () => { await idle(); if (!sent) await send(true); if (!alive) return; if (sel !== 'model') select('model'); say('<b>The model endpoint is dark.</b> Its weights did not change, and the prompt was held in memory only while it computed.'); } },
    { title: 'No training, still stored', note: 'An enterprise API contract cuts the training line. With standard terms the provider still keeps a log copy for a period. These are two separate promises.', run: async () => { await idle(); await demos.notrain(); } },
    { title: 'Move the model into your own account', note: 'The same systems slide inside the fence. The copies still exist. They now sit under your retention settings and your cloud provider’s terms.', run: async () => { await idle(); if (sel) select(sel); setPattern(KEYS[2]); await send(true); if (!alive) return; const c = countUp(); say(`<b>${c.rest} copies at rest, ${c.out} outside your organization’s control.</b> The deployment choice moved the boundary. It did not remove the copies.`); } },
    { title: 'Run it on your own hardware', note: 'Everything sits inside the fence, and every duty that a vendor carried is now yours: security, retention, deletion, and logs.', run: async () => { await idle(); if (sel) select(sel); setPattern(KEYS[3]); await send(true); if (!alive) return; const c = countUp(); say(`<b>${c.rest} copies at rest, ${c.out} outside your control.</b> ${c.out === 0 ? 'No outside party holds a copy, and no outside party shares the work of protecting them.' : 'Check each lit copy that still sits outside the fence.'}`); } },
  ];

  // ----- view interface -----
  function frame({ H, freeW, freeH }) {
    const tan = Math.tan((camera.fov * Math.PI) / 360), portrait = freeW / freeH < 0.9;
    const sizeX = 23.5, sizeY = portrait ? 15 : 14.5;
    const d = Math.max(sizeY / (2 * tan * (freeH / H)), sizeX / (2 * tan * (freeW / H)));
    const el = portrait ? 0.95 : 0.9;
    home.target.set(0, 0.3, 0.3);
    home.pos.set(home.target.x, home.target.y + d * Math.sin(el), home.target.z + d * Math.cos(el));
    if (!userMoved) { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
  }
  function update(dt, t) {
    const k = motion.reduced ? 1 : Math.min(1, dt * 4.5);
    for (const id of PLATE_IDS) {
      const pl = plates[id], r = pl.r, w = pl.want;
      r.on = lerp(r.on, w.on, k); if (w.on) { r.x0 = lerp(r.x0, w.x0, k); r.x1 = lerp(r.x1, w.x1, k); r.z0 = lerp(r.z0, w.z0, k); r.z1 = lerp(r.z1, w.z1, k); }
      const vis = r.on > 0.02; pl.m.visible = vis; if (pl.fence) pl.fence.forEach((f) => { f.visible = vis; });
      if (!vis) continue;
      const sx = Math.max(0.01, (r.x1 - r.x0) * r.on), sz = Math.max(0.01, (r.z1 - r.z0) * r.on), cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      pl.m.scale.set(sx, pl.hgt, sz); pl.m.position.set(cx, pl.base, cz);
      if (pl.fence) { const y = pl.base + pl.hgt + 0.03, th = 0.07; pl.fence[0].scale.set(sx + th, 0.06, th); pl.fence[0].position.set(cx, y, cz - sz / 2); pl.fence[1].scale.set(sx + th, 0.06, th); pl.fence[1].position.set(cx, y, cz + sz / 2); pl.fence[2].scale.set(th, 0.06, sz); pl.fence[2].position.set(cx - sx / 2, y, cz); pl.fence[3].scale.set(th, 0.06, sz); pl.fence[3].position.set(cx + sx / 2, y, cz); }
    }
    const a = linkGeo.attributes.position.array; a.fill(0);
    for (const n of Object.values(nodes)) {
      n.x = lerp(n.x, n.wx, k); n.z = lerp(n.z, n.wz, k); n.s = lerp(n.s, n.ws, k); n.baseY = lerp(n.baseY, n.wy, k);
      n.g.visible = n.s > 0.02; n.g.scale.setScalar(Math.max(0.001, n.s)); n.g.position.set(n.x, n.baseY, n.z);
      n.copy.position.set(n.x, n.baseY + NODES[n.id].top + 0.32 + (motion.reduced ? 0 : Math.sin(t * 1.6 + n.x) * 0.04), n.z);
      n.selRing.position.set(n.x, n.baseY + 0.04, n.z);
    }
    LINKS.forEach(([p, q], i) => { const A = nodes[p], B = nodes[q]; if (A.ws && B.ws && A.s > 0.5 && B.s > 0.5) a.set([A.x, A.baseY + 0.03, A.z, B.x, B.baseY + 0.03, B.z], i * 6); });
    linkGeo.attributes.position.needsUpdate = true;
  }
  function textAlt() {
    const P = PATTERNS[pat];
    const rows = Object.keys(P.nodes).map((id) => { const d = info(id); const mine = d.z === 'you' || d.z === 'account'; return `<tr><td>${esc(d.name || NODES[id].name)}</td><td>${mine ? 'Inside your control' : 'Outside your control'}</td><td>${esc(d.rests)}</td><td>${esc(d.control)}</td><td>${esc(d.term)}</td></tr>`; }).join('');
    return `<p>The map is a table with flat plates on it. Each plate is a zone of control, and the plates edged in light are yours. Systems stand on the plates as paper models: your device, the application servers, a retrieval store, the model endpoint, and logs. Sending a prompt moves a lit sheet from system to system. Each system that stores something keeps a lit copy on top of it after the sheet moves on. The model endpoint lights up while it computes and then goes dark, because it keeps nothing.</p>
    <p>Switching the deployment pattern slides systems from one plate to another and redraws the lit boundary. The copies stay. Who holds them changes.</p>
    <h3>Pattern now: ${esc(P.name)}${pat === 'api' ? (zdr ? ', zero-retention term on' : ', standard terms, zero-retention off') : ''}</h3><p>${esc(P.moved)}</p>
    <table><tr><th>System</th><th>Boundary</th><th>What rests there</th><th>Who controls it</th><th>Governing term</th></tr>${rows}</table>
    <h3>All four patterns</h3><ul>${ORDER.map((k) => `<li><b>${esc(PATTERNS[k].name)}:</b> ${esc(PATTERNS[k].moved)}</li>`).join('')}</ul>
    <p>Scripted: four typical architectures and one prompt's path. What any given vendor keeps varies by vendor and contract.</p>`;
  }
  // click systems in 3D
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => { if (!down) return; const mv = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (mv > 6) return; const r = ctx.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); const live = Object.values(nodes).filter((n) => n.ws); const hits = ray.intersectObjects(live.map((n) => n.g), true); if (hits.length) { let o = hits[0].object; while (o && !live.find((n) => n.g === o)) o = o.parent; const n = live.find((x) => x.g === o); if (n && sel !== n.id) select(n.id); } };
  ctx.canvas.addEventListener('pointerdown', onDown); ctx.canvas.addEventListener('pointerup', onUp);

  setPattern('consumer', true);
  // start settled, without a slide-in
  PLATE_IDS.forEach((id) => { const pl = plates[id]; Object.assign(pl.r, pl.want); }); Object.values(nodes).forEach((n) => { n.x = n.wx; n.z = n.wz; n.s = n.ws; n.baseY = n.wy; });
  return { scene, camera, controls, update, frame, textAlt, demos, beats, dispose() { alive = false; ctx.canvas.removeEventListener('pointerdown', onDown); ctx.canvas.removeEventListener('pointerup', onUp); } };
}
