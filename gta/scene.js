// GTA guide hero: golden hour on a long wooden pier, a Ferris wheel turning at its end.
// Built from code only (three r160, no model files, no downloaded textures).
//
// Tiers   low  (touch / small screens): DPR <= 1.5, canvas MSAA, no shadows, no post, fewer instances.
//         high (desktop): DPR <= 2, MSAA composer + bloom, one static sun shadow map.
//         Either tier drops resolution (then bloom) by itself after ~1.5 s of slow frames.
// Motion  scroll dollies the camera down the pier over the first screen; pointer (desktop) or
//         gyro (Android) adds parallax. Rendering stops while the hero is off-screen or the tab is hidden.
//         prefers-reduced-motion: one still frame, nothing moves.
// Failure no WebGL / CDN error: the page adds .nogl and shows the t3 poster instead.
import * as THREE from "three";

const hero = document.getElementById("gta-hero");
const canvas = hero && hero.querySelector("canvas");
const fail = (e) => { if (e) console.warn("[gta hero]", e); if (hero) hero.classList.add("nogl"); };

if (canvas) start().catch(fail);

async function start() {
  const params = new URLSearchParams(location.search);
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(screen.width, screen.height) < 768;
  const LOW = (params.get("quality") || (coarse || small ? "low" : "high")) === "low";
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: LOW, powerPreference: "high-performance", stencil: false });
  const DPR_CAP = LOW ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); running = false; fail(); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 6000);
  camera.rotation.order = "YXZ";

  // ---------- world, in metres ----------
  const DECK_Y = 6, PIER_W = 10, PIER_Z0 = 40, PIER_Z1 = -292;
  const PIER_LEN = PIER_Z0 - PIER_Z1;
  const PLAT = { x0: -16, x1: 44, z0: -292, z1: -348 };
  const R = 24;                                                  // wheel radius
  const WHEEL = { x: 22, y: DECK_Y + R + 3.4, z: -322, yaw: 0.5 };
  const SUN_DIR = new THREE.Vector3(-0.09, Math.sin(THREE.MathUtils.degToRad(1.3)), -1).normalize();
  const LIGHT_DIR = new THREE.Vector3(-0.09, 0.17, -1).normalize(); // a few degrees above the painted sun
  const FOG_D = 0.0021;

  const U = { uTime: { value: 0 }, uSunDir: { value: SUN_DIR }, uPx: { value: 800 } };

  function mulberry32(a) {
    return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const rnd = mulberry32(20261114);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
    return t;
  }

  // ---------- sky: warm gradient, sun, streaky clouds (shared with the water reflection) ----------
  const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
vec3 skyCol(vec3 d, bool clouds) {
  float h = d.y, hp = max(h, 0.0);
  float s = max(dot(d, uSunDir), 0.0);
  vec3 cTop = vec3(0.05, 0.018, 0.016);
  vec3 cMid = vec3(0.30, 0.085, 0.042);
  vec3 cLow = vec3(0.78, 0.27, 0.075);
  vec3 cHor = vec3(1.2, 0.52, 0.16);
  vec3 c = mix(cHor, cLow, smoothstep(0.0, 0.05, hp));
  c = mix(c, cMid, smoothstep(0.035, 0.2, hp));
  c = mix(c, cTop, smoothstep(0.18, 0.7, hp));
  c += vec3(1.3, 0.42, 0.1) * pow(s, 3.0) * exp(-hp * 9.0) * 0.55;
  c += vec3(1.8, 0.7, 0.2) * pow(s, 60.0) * 0.75;
  c += vec3(3.2, 1.7, 0.7) * pow(s, 900.0) * 2.2;
  if (clouds && h > 0.0) {
    vec2 uv = d.xz / (h + 0.06) * 0.55;
    uv.x += uTime * 0.004;
    float n = fbm(uv * vec2(1.0, 3.4));
    float m = smoothstep(0.5, 0.78, n) * smoothstep(0.0, 0.04, h) * (1.0 - smoothstep(0.22, 0.48, h));
    vec3 lit = mix(vec3(0.2, 0.055, 0.035), vec3(2.0, 0.85, 0.28), pow(s, 5.0));
    c = mix(c, lit, m * 0.72);
  }
  if (h < 0.0) c = mix(cHor * 0.85, vec3(0.2, 0.09, 0.06), smoothstep(0.0, 0.3, -h));
  return c;
}`;
  function skyMaterial(withSun) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uSunDir: U.uSunDir },
      vertexShader: /* glsl */ `varying vec3 vDir;
void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: SKY_GLSL + /* glsl */ `
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = skyCol(d, ${withSun ? "true" : "false"});
  ${withSun ? "float mu = dot(d, uSunDir); c += vec3(14.0, 9.0, 4.0) * smoothstep(0.99972, 0.9998, mu);" : ""}
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      side: THREE.BackSide, depthWrite: false,
    });
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMaterial(true));
  sky.frustumCulled = false; sky.renderOrder = -2;
  scene.add(sky);

  // image-based light from the same sky, rendered once
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial(false)));
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();

  scene.fog = new THREE.FogExp2(new THREE.Color(0.95, 0.45, 0.15), FOG_D);

  // ---------- water: procedural ripples, sky reflection, a glitter path toward the sun ----------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uSunDir: U.uSunDir },
      vertexShader: /* glsl */ `varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: SKY_GLSL + /* glsl */ `
varying vec3 vW;
vec2 wave(vec2 p, vec2 dir, float len, float amp) {
  float k = 6.2831853 / len;
  float ph = dot(dir, p) * k - uTime * sqrt(9.81 * k);
  return dir * (amp * k * cos(ph));
}
void main() {
  vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
  vec2 p = vW.xz;
  vec2 g = wave(p, normalize(vec2(0.25, 1.0)), 14.0, 0.16);
  g += wave(p, normalize(vec2(-0.6, 0.8)), 7.5, 0.08);
  g += wave(p, normalize(vec2(0.9, 0.45)), 4.2, 0.045);
  g += wave(p, normalize(vec2(-0.2, -1.0)), 2.3, 0.02);
  g += wave(p, normalize(vec2(0.7, -0.7)), 1.3, 0.01);
  g += (vec2(vnoise(p * 0.35 + vec2(uTime * 0.08, 0.0)), vnoise(p * 0.35 + vec2(7.3, uTime * 0.06))) - 0.5) * 0.22;
  float fade = 1.0 / (1.0 + dist * 0.012);
  vec3 N = normalize(vec3(-g.x * fade, 1.0, -g.y * fade));
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 col = mix(vec3(0.035, 0.016, 0.012), skyCol(R, false) * 0.8, fres);
  float sd = max(dot(R, uSunDir), 0.0);
  col += vec3(5.0, 2.8, 1.2) * (pow(sd, 700.0) * 5.0 + pow(sd, 60.0) * 0.35);
  col = mix(col, skyCol(normalize(vec3(-V.x, 0.0, -V.z)), false), 1.0 - exp(-dist * 0.0003));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      depthWrite: false,
    })
  );
  water.frustumCulled = false; water.renderOrder = -1;
  scene.add(water);

  // ---------- far coast: hazy ridges on the horizon ----------
  function ridge(x0, x1, z, hMax, color, seed) {
    const r = mulberry32(seed), n = 90, pos = [], idx = [];
    let v = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t;
      v = (v + (r() - 0.5) * 0.4) * 0.82;
      const env = Math.pow(Math.sin(t * Math.PI), 0.55);
      const h = hMax * env * (0.62 + 0.25 * Math.sin(t * 9 + seed) + v * 0.6);
      pos.push(x, -3, z, x, Math.max(h, 0), z);
    }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide }));
    scene.add(m);
  }
  ridge(-3800, -650, -2700, 150, new THREE.Color(0.42, 0.17, 0.075), 3);
  ridge(700, 3200, -3100, 80, new THREE.Color(0.55, 0.23, 0.1), 7);

  // ---------- materials ----------
  const plankTex = canvasTex(512, 1024, (g, w, h) => {
    const n = 16, bw = w / n;
    for (let i = 0; i < n; i++) {
      let y = -rnd() * 700;
      while (y < h) {
        const len = 380 + rnd() * 520, tone = 0.72 + rnd() * 0.4;
        g.fillStyle = `rgb(${(126 * tone) | 0},${(100 * tone) | 0},${(80 * tone) | 0})`;
        g.fillRect(i * bw, y, bw, len);
        for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(42,26,16,${0.06 + rnd() * 0.12})`; g.fillRect(i * bw + rnd() * bw, y, 1 + rnd(), len); }
        g.fillStyle = "rgba(20,12,8,.85)"; g.fillRect(i * bw, y, bw, 3);
        y += len;
      }
      g.fillStyle = "rgba(14,8,5,.95)"; g.fillRect(i * bw, 0, 3, h);
    }
  });
  const deckMat = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.4, metalness: 0, envMapIntensity: 1.4 });
  const woodDark = new THREE.MeshStandardMaterial({ color: "#3a291f", roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: "#2c211b", roughness: 0.55, metalness: 0.5 });
  const silhouette = new THREE.MeshStandardMaterial({ color: "#241914", roughness: 0.9 });

  const Mx = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  function inst(geo, mat, mats, cast = false) {
    const m = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((mm, i) => m.setMatrixAt(i, mm));
    m.instanceMatrix.needsUpdate = true; m.castShadow = cast;
    m.computeBoundingSphere();
    scene.add(m); return m;
  }
  function plane(w, l, uRep, vRep) {
    const g = new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, uv.getY(i) * vRep);
    return g;
  }

  // ---------- the pier ----------
  const deck = new THREE.Mesh(plane(PIER_W, PIER_LEN, 2, PIER_LEN / 8), deckMat);
  deck.position.set(0, DECK_Y, (PIER_Z0 + PIER_Z1) / 2); deck.receiveShadow = true; scene.add(deck);
  const platW = PLAT.x1 - PLAT.x0, platL = PLAT.z0 - PLAT.z1;
  const plat = new THREE.Mesh(plane(platW, platL, platW / 5, platL / 8), deckMat);
  plat.position.set((PLAT.x0 + PLAT.x1) / 2, DECK_Y, (PLAT.z0 + PLAT.z1) / 2); plat.receiveShadow = true; scene.add(plat);

  const box = new THREE.BoxGeometry(1, 1, 1);
  inst(box, woodDark, [
    Mx(0, DECK_Y - 0.37, (PIER_Z0 + PIER_Z1) / 2, PIER_W + 0.4, 0.72, PIER_LEN),
    Mx((PLAT.x0 + PLAT.x1) / 2, DECK_Y - 0.37, (PLAT.z0 + PLAT.z1) / 2, platW + 0.4, 0.72, platL),
  ]);

  // pilings into the water
  const pil = [];
  const pStep = LOW ? 13 : 9, pilH = DECK_Y - 0.7;
  for (let z = PIER_Z0 - 4; z > PIER_Z1; z -= pStep) for (const x of [-4.3, 0, 4.3]) pil.push(Mx(x, pilH / 2, z, 1, pilH, 1));
  for (let x = PLAT.x0 + 3; x < PLAT.x1; x += LOW ? 15 : 10) for (let z = PLAT.z0 - 3; z > PLAT.z1; z -= LOW ? 15 : 10) pil.push(Mx(x, pilH / 2, z, 1, pilH, 1));
  inst(new THREE.CylinderGeometry(0.3, 0.34, 1, 8), woodDark, pil);

  // railing: posts every 2.4 m (3.2 m on phones) and two rails a side
  const posts = [], rStep = LOW ? 3.2 : 2.4, rx = PIER_W / 2 - 0.12;
  for (let z = PIER_Z0; z > PIER_Z1; z -= rStep) for (const x of [-rx, rx]) posts.push(Mx(x, DECK_Y + 0.55, z, 0.14, 1.1, 0.14));
  inst(box, woodDark, posts, true);
  const mid = (PIER_Z0 + PIER_Z1) / 2;
  inst(box, woodDark, [-rx, rx].flatMap((x) => [Mx(x, DECK_Y + 1.1, mid, 0.16, 0.1, PIER_LEN), Mx(x, DECK_Y + 0.62, mid, 0.07, 0.08, PIER_LEN)]), true);

  // lamps: posts, glowing globes, and soft glow sprites (added with the other lights below)
  const glows = [];
  const lampPosts = [], lampHeads = [], lStep = LOW ? 24 : 16, lx = PIER_W / 2 - 0.45;
  const LAMP_C = [1.7, 0.85, 0.32];
  for (let z = PIER_Z0 - 6; z > PIER_Z1; z -= lStep) for (const x of [-lx, lx]) {
    lampPosts.push(Mx(x, DECK_Y + 2.15, z, 1, 4.3, 1));
    lampHeads.push(Mx(x, DECK_Y + 4.5, z));
    glows.push({ p: [x, DECK_Y + 4.5, z], c: LAMP_C, s: 1.4 });
  }
  for (const [x, z] of [[-14, -296], [-14, -344], [42, -296], [42, -344], [6, -296], [32, -346]]) {
    lampPosts.push(Mx(x, DECK_Y + 2.15, z, 1, 4.3, 1)); lampHeads.push(Mx(x, DECK_Y + 4.5, z));
    glows.push({ p: [x, DECK_Y + 4.5, z], c: LAMP_C, s: 1.4 });
  }
  inst(new THREE.CylinderGeometry(0.06, 0.09, 1, 8), steel, lampPosts, true);
  inst(new THREE.SphereGeometry(0.24, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.8, 0.75) }), lampHeads);

  // buildings at the pier end: dark boxes with lit windows
  const winTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = "#0d0907"; g.fillRect(0, 0, w, h);
    for (let y = 18; y < h - 14; y += 30) for (let x = 10; x < w - 14; x += 24) {
      if (rnd() < 0.38) continue;
      g.fillStyle = `rgba(255,${(170 + rnd() * 60) | 0},${(90 + rnd() * 50) | 0},${0.45 + rnd() * 0.55})`;
      g.fillRect(x, y, 14, 16);
    }
  });
  const bMat = new THREE.MeshStandardMaterial({ color: "#2a1d16", roughness: 0.9, emissive: new THREE.Color(1, 0.6, 0.3), emissiveIntensity: 1.5, emissiveMap: winTex });
  inst(box, bMat, [[-9, -300, 12, 9, 7], [-11, -322, 8, 10, 5], [-1, -339, 14, 8, 9], [38, -300, 10, 8, 6], [36, -340, 12, 9, 8]]
    .map(([x, z, w, d, h]) => Mx(x, DECK_Y + h / 2, z, w, h, d)));

  // a drop tower behind the arcade, lights running up it
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 36, 10), silhouette);
  tower.position.set(-7, DECK_Y + 18, -346); scene.add(tower);
  for (let k = 0; k < 12; k++) glows.push({ p: [-7 + 0.95 * Math.sin(k * 2.4), DECK_Y + 3 + k * 2.9, -346 + 0.95], c: k % 3 ? [2.6, 1.2, 0.4] : [2.6, 0.45, 0.22], s: 1.1, ph: k * 0.6, ch: 1 });

  // a second, distant pier on the left, mostly haze
  inst(box, silhouette, [Mx(-260, 4.6, -650, 7, 1.1, 700)]);
  for (let z = -320; z > -1000; z -= 28) glows.push({ p: [-256.5, 7.5, z], c: [2.0, 1.1, 0.5], s: 3.4 });

  // ---------- the Ferris wheel ----------
  const wheelRoot = new THREE.Group();
  wheelRoot.position.set(WHEEL.x, WHEEL.y, WHEEL.z); wheelRoot.rotation.y = WHEEL.yaw;
  scene.add(wheelRoot);
  const spin = new THREE.Group(); wheelRoot.add(spin);
  for (const z of [-1.2, 1.2]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.16, 6, LOW ? 96 : 160), steel); rim.position.z = z; spin.add(rim);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(R * 0.52, 0.12, 6, 72), steel); inner.position.z = z; spin.add(inner);
  }
  const NSP = 24, sp = [];
  for (let i = 0; i < NSP; i++) {
    const a = (i / NSP) * TAU, a2 = ((i + 0.5) / NSP) * TAU, c = Math.cos(a), s = Math.sin(a);
    for (const z of [-1.2, 1.2]) {
      sp.push(0, 0, z * 0.6, R * c, R * s, z);
      sp.push(R * 0.52 * c, R * 0.52 * s, z, R * Math.cos(a2), R * Math.sin(a2), z);
    }
    sp.push(R * c, R * s, -1.2, R * c, R * s, 1.2);
  }
  const spokeGeo = new THREE.BufferGeometry(); spokeGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  spin.add(new THREE.LineSegments(spokeGeo, new THREE.LineBasicMaterial({ color: "#3b2a21" })));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 20).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#2a1d16", emissive: new THREE.Color(1, 0.55, 0.25), emissiveIntensity: 0.8 }));
  spin.add(hub);
  // legs: an A-frame on each side of the wheel, down to the deck
  const legGeo = new THREE.CylinderGeometry(0.42, 0.55, 1, 8);
  for (const zz of [-3.4, 3.4]) for (const xx of [-10.5, 10.5]) {
    const a = new THREE.Vector3(xx, DECK_Y - WHEEL.y, zz), b = new THREE.Vector3(0, 0, zz * 0.55);
    const leg = new THREE.Mesh(legGeo, steel);
    leg.position.copy(a).add(b).multiplyScalar(0.5);
    leg.scale.y = a.distanceTo(b);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    wheelRoot.add(leg);
  }
  // gondolas stay upright while the wheel turns
  const NG = 18;
  const gond = new THREE.InstancedMesh(new THREE.BoxGeometry(2.0, 2.3, 1.8),
    new THREE.MeshStandardMaterial({ color: "#2a1d17", roughness: 0.6, emissive: new THREE.Color(1, 0.5, 0.22), emissiveIntensity: 0.9 }), NG);
  gond.frustumCulled = false; wheelRoot.add(gond);
  // bulbs: the rim and every spoke, a slow chase running round
  const bulbs = [], NR = LOW ? 72 : 120, NS = LOW ? 3 : 5;
  const CREAM = [3.0, 2.15, 1.15], AMBER = [3.2, 1.55, 0.5], RED = [3.0, 0.5, 0.24];
  for (let i = 0; i < NR; i++) {
    const a = (i / NR) * TAU;
    bulbs.push({ p: [R * Math.cos(a), R * Math.sin(a), 1.35], c: i % 6 === 0 ? RED : i % 2 ? CREAM : AMBER, s: 1.25, ph: a * 6, ch: 1 });
  }
  for (let i = 0; i < NSP; i++) {
    const a = (i / NSP) * TAU;
    for (let k = 1; k <= NS; k++) {
      const rr = (R * k) / (NS + 1);
      bulbs.push({ p: [rr * Math.cos(a), rr * Math.sin(a), 1.35], c: k === NS ? AMBER : CREAM, s: 0.95, ph: a * 6 + k * 0.9, ch: 1 });
    }
  }

  // ---------- glow sprites (one draw call per group) ----------
  const glowVS = /* glsl */ `
attribute vec3 aColor; attribute float aSize; attribute float aPhase; attribute float aChase;
uniform float uTime; uniform float uPx; uniform float uAlpha; uniform float uFog;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(-mv.z, 0.1);
  float tw = mix(1.0, 0.4 + 0.6 * smoothstep(0.45, 1.0, 0.5 + 0.5 * sin(aPhase - uTime * 1.7)), aChase);
  float f = exp(-pow(uFog * dist, 2.0));
  float px = aSize * uPx / dist;
  float s = clamp(px, 2.5, 46.0);
  vC = aColor * tw * uAlpha * mix(0.25, 1.0, f) * min(1.0, (px * px) / (s * s) * 4.0 + 0.25);
  gl_PointSize = s;
  gl_Position = projectionMatrix * mv;
}`;
  const glowFS = /* glsl */ `
varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (smoothstep(0.42, 0.0, d) + exp(-d * d * 5.0) * 0.5) * (1.0 - smoothstep(0.85, 1.0, d));
  if (a < 0.004) discard;
  gl_FragColor = vec4(vC * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  const glowMat = (alpha) => new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uPx: U.uPx, uAlpha: { value: alpha }, uFog: { value: FOG_D } },
    vertexShader: glowVS, fragmentShader: glowFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  function glowGeo(list) {
    const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const size = new Float32Array(n), ph = new Float32Array(n), ch = new Float32Array(n);
    list.forEach((b, i) => { pos.set(b.p, i * 3); col.set(b.c, i * 3); size[i] = b.s; ph[i] = b.ph || 0; ch[i] = b.ch || 0; });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
    g.setAttribute("aChase", new THREE.BufferAttribute(ch, 1));
    return g;
  }
  scene.add(new THREE.Points(glowGeo(glows), glowMat(1)));
  const bulbGeo = glowGeo(bulbs);
  spin.add(new THREE.Points(bulbGeo, glowMat(1)));
  // the wheel's lights mirrored in the water (water writes no depth, so pilings still hide them)
  const mirrorRoot = new THREE.Group();
  mirrorRoot.position.set(WHEEL.x, -WHEEL.y, WHEEL.z); mirrorRoot.rotation.y = WHEEL.yaw; mirrorRoot.scale.y = -1;
  const mirrorSpin = new THREE.Group(); mirrorRoot.add(mirrorSpin); scene.add(mirrorRoot);
  mirrorSpin.add(new THREE.Points(bulbGeo, glowMat(0.3)));

  // ---------- gulls: dark silhouettes circling over the pier ----------
  const gullGeo = new THREE.BufferGeometry();
  gullGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.22, 0, 0, -0.3, -1, 0.08, 0.04, 0, 0, -0.3, 0, 0, 0.22, 1, 0.08, 0.04], 3));
  const gullMat = new THREE.MeshBasicMaterial({ color: "#2b1a13", side: THREE.DoubleSide });
  gullMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.uTime;
    s.vertexShader = "uniform float uTime;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float gph = 0.0;
      #ifdef USE_INSTANCING
        gph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.11;
      #endif
      transformed.y += abs(position.x) * sin(uTime * 6.5 + gph) * 0.6;`);
  };
  const GULLS = Array.from({ length: LOW ? 5 : 8 }, (_, i) => ({
    cx: -12 + rnd() * 36, cz: -55 - rnd() * 90, r: 12 + rnd() * 24, y: 15 + rnd() * 16,
    w: (0.1 + rnd() * 0.12) * (i % 2 ? 1 : -1), a0: rnd() * TAU,
  }));
  const gulls = new THREE.InstancedMesh(gullGeo, gullMat, GULLS.length);
  gulls.frustumCulled = false; scene.add(gulls);

  // ---------- light ----------
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.55, 0.25), 3.0);
  sun.target.position.set(0, DECK_Y, -45);
  sun.position.copy(sun.target.position).addScaledVector(LIGHT_DIR, 260);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(new THREE.Color(1.0, 0.55, 0.3), new THREE.Color(0.1, 0.05, 0.035), 0.35));
  if (!LOW) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;   // the pier never moves: render the shadow map once
    renderer.shadowMap.needsUpdate = true;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 20, bottom: -20, near: 90, far: 400 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  }

  // ---------- post (desktop): MSAA half-float target, bloom, tone map last ----------
  let composer = null, bloom = null;
  if (!LOW) {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import("three/addons/postprocessing/EffectComposer.js"),
        import("three/addons/postprocessing/RenderPass.js"),
        import("three/addons/postprocessing/UnrealBloomPass.js"),
        import("three/addons/postprocessing/OutputPass.js"),
      ]);
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 1.9);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    } catch (e) { console.warn("[gta hero] no post", e); composer = null; }
  }

  // ---------- size ----------
  let basePitch = -0.045;
  function resize() {
    const w = Math.max(1, hero.clientWidth), h = Math.max(1, hero.clientHeight), asp = w / h;
    camera.aspect = asp;
    // keep about 36 degrees across on tall screens so a phone sees the sun, the pier and the wheel
    camera.fov = clamp((2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) / asp) * 180) / Math.PI, 38, 74);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    U.uPx.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    basePitch = -0.045 - 0.075 * clamp((1.2 - asp) / 0.75, 0, 1); // tall screens: horizon higher, above the title
  }

  // ---------- input ----------
  let P = 0, Pt = 0, px = 0, py = 0, pxt = 0, pyt = 0, lastP = -1;
  const onScroll = () => { Pt = clamp(window.scrollY / Math.max(1, hero.offsetHeight), 0, 1); };
  if (!REDUCE) {
    addEventListener("scroll", onScroll, { passive: true });
    if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
      addEventListener("pointermove", (e) => { pxt = (e.clientX / innerWidth) * 2 - 1; pyt = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
    } else {
      let b0 = null, g0 = null;
      addEventListener("deviceorientation", (e) => {
        if (e.beta == null || e.gamma == null) return;
        if (b0 === null) { b0 = e.beta; g0 = e.gamma; }
        pxt = clamp((e.gamma - g0) / 22, -1, 1); pyt = clamp((e.beta - b0) / 22, -1, 1);
      }, { passive: true });
    }
  }
  onScroll();

  // ---------- frame ----------
  const gm = new THREE.Matrix4(), gq = new THREE.Quaternion(), ge = new THREE.Euler(0, 0, 0, "YXZ"), gs = new THREE.Vector3(1, 1, 1), gp = new THREE.Vector3();
  let t = 9;
  function update(dt) {
    t += dt; U.uTime.value = t;
    const ang = t * 0.045;
    spin.rotation.z = ang; mirrorSpin.rotation.z = ang;
    for (let i = 0; i < NG; i++) {
      const a = (i / NG) * TAU + ang;
      gp.set(R * Math.cos(a), R * Math.sin(a) - 1.75, 0); gq.identity();
      gond.setMatrixAt(i, gm.compose(gp, gq, gs));
    }
    gond.instanceMatrix.needsUpdate = true;
    GULLS.forEach((g, i) => {
      const a = g.a0 + t * g.w, dir = Math.sign(g.w);
      gp.set(g.cx + Math.cos(a) * g.r, g.y + Math.sin(t * 0.5 + i) * 1.2, g.cz + Math.sin(a) * g.r);
      ge.set(0, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir), 0.35 * dir);
      gulls.setMatrixAt(i, gm.compose(gp, gq.setFromEuler(ge), gs.set(0.9, 0.9, 0.9)));
    });
    gs.set(1, 1, 1);
    gulls.instanceMatrix.needsUpdate = true;

    // camera: scroll dolly down the pier + idle drift + parallax, all damped
    const k = 1 - Math.exp(-dt * 3.2), kp = 1 - Math.exp(-dt * 2.2);
    P += (Pt - P) * k; px += (pxt - px) * kp; py += (pyt - py) * kp;
    const e = P * P * (3 - 2 * P);
    camera.position.set(-0.8 + Math.sin(t * 0.11) * 0.5 + px * 1.3, 7.6 + e * 2.4 + Math.sin(t * 0.17) * 0.12 - py * 0.45, 22 - e * 58);
    camera.rotation.set(basePitch - e * 0.035 + py * 0.02 + Math.sin(t * 0.13) * 0.004, -0.012 + Math.sin(t * 0.07) * 0.012 - px * 0.03, 0);
    if (Math.abs(P - lastP) > 0.002) { lastP = P; hero.style.setProperty("--p", P.toFixed(3)); }

    sky.position.copy(camera.position);
    water.position.set(camera.position.x, 0, camera.position.z);
  }
  const draw = () => (composer ? composer.render() : renderer.render(scene, camera));

  // ---------- adaptive quality ----------
  let frames = 0, acc = 0, level = 0;
  function perf(dt) {
    if (++frames < 40) return;              // skip shader warm-up
    acc += dt;
    if (frames === 130) {
      const avg = acc / 90; frames = 0; acc = 0;
      if (avg > 1 / 45 && level < 2) {
        level++;
        renderer.setPixelRatio(level === 1 ? Math.min(renderer.getPixelRatio(), LOW ? 1 : 1.25) : LOW ? 0.75 : 1);
        if (level === 2 && bloom) bloom.enabled = false;
        resize();
      }
    }
  }

  // ---------- run only while seen ----------
  let running = false, visible = true, raf = 0, last = 0, ready = false;
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw(); perf(dt);
    if (!ready) markReady();
  }
  function setRunning() {
    const want = visible && !document.hidden && !REDUCE;
    if (want && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }
  function markReady() {
    ready = true; window.__gtaReady = true;
    hero.classList.remove("nogl");
    requestAnimationFrame(() => hero.classList.add("ready"));
  }

  resize();
  new ResizeObserver(() => { resize(); if (!running) { draw(); } }).observe(hero);
  if (REDUCE) {
    update(0); draw(); markReady();             // one still frame
  } else {
    new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; setRunning(); }).observe(hero);
    document.addEventListener("visibilitychange", setRunning);
    setRunning();
  }
}
