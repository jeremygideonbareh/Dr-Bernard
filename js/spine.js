// Procedural 3D spine for the hero.
// 24 vertebrae (7 cervical, 12 thoracic, 5 lumbar) + a spinal cord with a travelling "nerve signal".
// One responsibility: the hero focal object. Pauses offscreen / hidden, caps DPR, disposes everything.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BONE = new THREE.Color('#efe9dd');
const SIGNAL = new THREE.Color('#e2482f');
const INK = new THREE.Color('#0c121c');

function vertebraGeometry() {
  const parts = [];
  // vertebral body: slightly waisted cylinder (lathe)
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = 0.5 - Math.sin(t * Math.PI) * 0.06;
    pts.push(new THREE.Vector2(r, (t - 0.5) * 0.36));
  }
  const body = new THREE.LatheGeometry(pts, 40);
  // caps
  const capTop = new THREE.CircleGeometry(0.5, 40); capTop.rotateX(-Math.PI / 2); capTop.translate(0, 0.18, 0);
  const capBot = new THREE.CircleGeometry(0.5, 40); capBot.rotateX(Math.PI / 2); capBot.translate(0, -0.18, 0);
  parts.push(body, capTop, capBot);
  // neural arch (half torus behind the body)
  const arch = new THREE.TorusGeometry(0.3, 0.085, 12, 28, Math.PI);
  arch.rotateX(Math.PI / 2); arch.rotateZ(Math.PI); arch.translate(0, 0.02, -0.5);
  parts.push(arch);
  // pedicles joining arch to body
  for (const s of [-1, 1]) {
    const ped = new THREE.CylinderGeometry(0.08, 0.09, 0.28, 10);
    ped.rotateX(Math.PI / 2); ped.translate(0.3 * s, 0.02, -0.42);
    parts.push(ped);
  }
  // spinous process: tapered, angled down & back
  const spin = new THREE.ConeGeometry(0.095, 0.8, 10);
  spin.rotateX(-Math.PI / 2 - 0.45); spin.translate(0, -0.14, -1.12);
  parts.push(spin);
  // transverse processes
  for (const s of [-1, 1]) {
    const tp = new THREE.CapsuleGeometry(0.065, 0.42, 4, 10);
    tp.rotateZ(Math.PI / 2 + s * 0.18); tp.rotateY(s * -0.35);
    tp.translate(0.52 * s, 0.04, -0.62);
    parts.push(tp);
  }
  // articular facets (small knobs top/bottom)
  for (const s of [-1, 1]) for (const v of [-1, 1]) {
    const f = new THREE.SphereGeometry(0.075, 10, 8);
    f.translate(0.24 * s, 0.13 * v + 0.02, -0.68);
    parts.push(f);
  }
  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g), false);
  parts.forEach(g => g.dispose());
  merged.computeVertexNormals();
  return merged;
}

const boneVert = /* glsl */`
  uniform float uTime;
  varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
  void main(){
    vec4 wp = modelMatrix * vec4(position,1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vView = -mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;
const boneFrag = /* glsl */`
  uniform vec3 uBone; uniform vec3 uSignal; uniform vec3 uInk;
  uniform float uScan; uniform float uTime; uniform float uGlow;
  varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
  void main(){
    vec3 n = normalize(vN); vec3 v = normalize(vView);
    vec3 l = normalize(vec3(-0.4, 0.8, 0.6));
    float diff = max(dot(n,l),0.0);
    float rim = pow(1.0 - max(dot(n,v),0.0), 2.4);
    vec3 col = mix(uInk*1.6, uBone, 0.25 + diff*0.7);
    // MRI-like scan band sweeping vertically
    float band = smoothstep(0.32, 0.0, abs(vWorld.y - uScan));
    float lines = step(0.5, fract(vWorld.y*22.0 + uTime*0.6));
    col = mix(col, uSignal, band*0.85);
    col += uSignal * band * lines * 0.25;
    col += rim * mix(uBone, uSignal, 0.35) * (0.55 + uGlow);
    gl_FragColor = vec4(col, 1.0);
  }`;

const cordFrag = /* glsl */`
  uniform float uTime; uniform float uAlpha; uniform vec3 uSignal; uniform vec3 uBone;
  varying vec2 vUv;
  void main(){
    float p = fract(vUv.x*3.0 - uTime*0.35);
    float pulse = smoothstep(0.0,0.04,p) * smoothstep(0.16,0.04,p);
    vec3 col = mix(uSignal*0.55, uBone, pulse);
    gl_FragColor = vec4(col, (0.55 + pulse*0.45) * uAlpha);
  }`;
const cordVert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

export function createSpine(container, { onReady } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 22);

  const root = new THREE.Group();   // positioned in layout
  const spin = new THREE.Group();   // pointer + idle rotation
  root.add(spin);
  scene.add(root);

  const geo = vertebraGeometry();
  const mat = new THREE.ShaderMaterial({
    vertexShader: boneVert, fragmentShader: boneFrag,
    uniforms: { uBone: { value: BONE }, uSignal: { value: SIGNAL }, uInk: { value: INK }, uScan: { value: 20 }, uTime: { value: 0 }, uGlow: { value: 0 } }
  });
  const discMat = new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.55 });
  const discGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 32);

  // S-curve positions, top (C1) to bottom (L5)
  const N = 24;
  const verts = [];
  const curvePts = [];
  let y = 6.6;
  for (let i = 0; i < N; i++) {
    const region = i < 7 ? 0 : i < 19 ? 1 : 2;
    const s = region === 0 ? 0.62 + i * 0.03 : region === 1 ? 0.84 + (i - 7) * 0.018 : 1.08 + (i - 19) * 0.04;
    const t = i / (N - 1);
    // lordosis / kyphosis / lordosis
    const z = Math.sin(t * Math.PI * 2.0 - 0.6) * 0.75;
    const tilt = Math.cos(t * Math.PI * 2.0 - 0.6) * 0.32;
    const h = 0.36 * s + 0.14;
    y -= h * 0.5;
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(s);
    const target = { x: 0, y, z, rx: tilt, ry: 0, rz: 0, s };
    // scattered start for the intro
    const start = {
      x: (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 10,
      rx: (Math.random() - 0.5) * 6, ry: (Math.random() - 0.5) * 6, rz: (Math.random() - 0.5) * 6
    };
    const state = { ...start, k: 0 };
    spin.add(m);
    verts.push({ mesh: m, target, start, state, i });
    curvePts.push(new THREE.Vector3(0, y, z - 0.42 * s));
    if (i < N - 1) {
      const d = new THREE.Mesh(discGeo, discMat);
      d.scale.set(s, 1, s);
      verts[i].disc = d;
      spin.add(d);
    }
    y -= h * 0.5 + 0.07;
  }
  const cordCurve = new THREE.CatmullRomCurve3(curvePts);
  const cordGeo = new THREE.TubeGeometry(cordCurve, 160, 0.07, 8, false);
  const cordMat = new THREE.ShaderMaterial({
    vertexShader: cordVert, fragmentShader: cordFrag, transparent: true,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uSignal: { value: SIGNAL }, uBone: { value: BONE } }
  });
  const cord = new THREE.Mesh(cordGeo, cordMat);
  spin.add(cord);

  // shared animatable params (driven by GSAP from main.js)
  const params = { assemble: 0, explode: 0, cordAlpha: 0, scan: 8, rotY: 0, glow: 0 };

  // pointer
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let lastMove = 0;
  const onMove = (e) => {
    const now = performance.now(); if (now - lastMove < 16) return; lastMove = now;
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onLeave = () => { pointer.tx = 0; pointer.ty = 0; };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('blur', onLeave);
  document.addEventListener('pointerleave', onLeave);

  // layout
  let fan = 1;
  function layout() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.position.z = w / h > 1.2 ? 25 : 22; camera.updateProjectionMatrix();
    const narrow = w < 760;
    fan = narrow ? 0 : 1;   // phones: column stays intact, it only turns and fades
    root.position.set(narrow ? 3.0 : 5.2 * Math.min(1.3, camera.aspect / 1.6), 0.2, 0);
    root.scale.setScalar(narrow ? 0.9 : 1);
  }
  const ro = new ResizeObserver(layout); ro.observe(container); layout();

  // visibility
  let visible = true, raf = 0, running = false, active = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; toggle(); }, { threshold: 0 });
  io.observe(container);
  const onVis = () => toggle();
  document.addEventListener('visibilitychange', onVis);
  function toggle() {
    const should = visible && active && !document.hidden;
    if (should && !running) { running = true; clock.getDelta(); raf = requestAnimationFrame(tick); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }

  // context loss
  let lost = false;
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; container.closest('.hero')?.classList.remove('has-webgl'); });
  renderer.domElement.addEventListener('webglcontextrestored', () => { lost = false; container.closest('.hero')?.classList.add('has-webgl'); });

  const clock = new THREE.Clock();
  let t = 0, exS = 0;
  function tick() {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (lost) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    exS += (params.explode - exS) * Math.min(1, dt * 6);
    const a = params.assemble, ex = exS;
    for (const v of verts) {
      // per-vertebra eased assembly, staggered top->bottom
      const local = Math.min(1, Math.max(0, a * 1.6 - v.i / 24 * 0.6));
      const k = 1 - Math.pow(1 - local, 3);
      const side = v.i % 2 ? 1 : -1;
      const exX = side * ex * fan * (0.6 + (v.i / 24) * 2.4);
      const exR = ex * side * 0.45 * fan;
      const breathe = Math.sin(t * 1.2 + v.i * 0.35) * 0.03 * k;
      const m = v.mesh;
      m.position.set(
        v.start.x + (v.target.x - v.start.x) * k + exX,
        v.start.y + (v.target.y - v.start.y) * k + breathe,
        v.start.z + (v.target.z - v.start.z) * k + ex * fan * Math.sin(v.i) * 1.5
      );
      m.rotation.set(
        v.start.rx + (v.target.rx - v.start.rx) * k + exR * 0.4,
        v.start.ry + (v.target.ry - v.start.ry) * k + exR,
        v.start.rz + (v.target.rz - v.start.rz) * k
      );
      if (v.disc) {
        const nx = verts[v.i + 1].mesh.position;
        v.disc.position.set((m.position.x + nx.x) / 2, (m.position.y + nx.y) / 2, (m.position.z + nx.z) / 2);
        v.disc.rotation.copy(m.rotation);
        v.disc.visible = k > 0.95 && ex < 0.6;
      }
    }
    discMat.opacity = 0.55 * (1 - ex * 1.4);
    cordMat.uniforms.uTime.value = t; cordMat.uniforms.uAlpha.value = params.cordAlpha;
    cord.visible = params.cordAlpha > 0.01 && ex < 0.05;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uScan.value = params.scan;
    mat.uniforms.uGlow.value = params.glow;

    spin.rotation.y = params.rotY + t * 0.12 + pointer.x * 0.6;
    spin.rotation.x = pointer.y * 0.12;
    spin.rotation.z = -0.08 + pointer.x * 0.05;
    renderer.render(scene, camera);
  }

  container.closest('.hero')?.classList.add('has-webgl');
  toggle();
  onReady && onReady();

  function destroy() {
    running = false; cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVis);
    geo.dispose(); discGeo.dispose(); cordGeo.dispose();
    mat.dispose(); discMat.dispose(); cordMat.dispose();
    renderer.dispose(); renderer.domElement.remove();
  }

  const setActive = (v) => { active = v; toggle(); };
  return { params, destroy, setActive, renderer, renderOnce: () => renderer.render(scene, camera) };
}
