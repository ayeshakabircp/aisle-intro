// ── GARMENT LAYER — real Three.js, transparent overlay on top of the video ──
// Black-background keying is done in a GPU fragment shader now, not via
// canvas getImageData() — that CPU-side approach could throw/fail under
// certain browser security contexts (e.g. file:// origin), silently
// rendering garments as solid black rectangles. A shader-based discard has
// no such restriction and works identically regardless of how the page is
// served.

let g3Scene, g3Camera, g3Renderer;
let g3Meshes = [], g3Threads = [];
let g3T0 = null;
let g3Opacity = 0;

const CAMERA_LOOKAT_Y = 45;

// x offset scales with depth AND is pushed much harder toward the edges —
// perspective compresses a fixed world offset toward center as distance
// increases, so this keeps garments consistently clear of the center
// regardless of how far back they sit.
function sampleX(z) {
  const dist = Math.abs(z) + 300;
  if (Math.random() < 0.08) {
    return (Math.random() - 0.5) * dist * 0.10; // rare, still pushed a bit off dead-center
  }
  const side = Math.random() < 0.5 ? -1 : 1;
  const minFrac = 0.28, maxFrac = 0.52;
  return side * dist * (minFrac + Math.random() * (maxFrac - minFrac));
}

function buildG3Data() {
  const data = [];
  const COUNT = 26;
  const Z_START = 50;
  const Z_END = -3400;
  const Z_STEP = (Z_END - Z_START) / COUNT;

  for (let i = 0; i < COUNT; i++) {
    const z = Z_START + Z_STEP * i + (Math.random() - 0.5) * Math.abs(Z_STEP) * 0.5;
    const x = sampleX(z);
    const isDramatic = Math.random() < 0.25;
    const baseY = isDramatic
      ? CAMERA_LOOKAT_Y - (60 + Math.random() * 150)
      : CAMERA_LOOKAT_Y + (Math.random() - 0.5) * 100;
    data.push({
      x, z, baseY,
      sway: Math.random() * Math.PI * 2,
      img: (i % 7) + 1,
    });
  }

  const zs = data.map(g => g.z);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  data.forEach(g => { g.zNorm = (maxZ - g.z) / (maxZ - minZ); });

  return data;
}

// ── Shader-based black-key: samples the texture, discards near-black pixels
//     entirely on GPU. No canvas pixel reads, no security/CORS exposure. ──
const KEY_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const KEY_FRAGMENT = `
uniform sampler2D map;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(map, vUv);
  float lum = max(texel.r, max(texel.g, texel.b));
  if (lum < 0.075) discard; // keys out near-black background
  gl_FragColor = vec4(texel.rgb, uOpacity);
}`;

function g3Init(onReady) {
  const canvas = document.getElementById('garment-3d-layer');
  g3Renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  g3Renderer.setClearColor(0x000000, 0);
  g3Renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  g3Renderer.setSize(window.innerWidth, window.innerHeight);

  g3Scene = new THREE.Scene();
  g3Camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
  g3Camera.position.set(0, 60, 700);
  g3Camera.lookAt(0, CAMERA_LOOKAT_Y, 300);

  const G3_DATA = buildG3Data();
  const lineMatBase = { color: 0xD4A870, transparent: true, opacity: 0 };

  // ── Step 1: create ALL meshes first, with the shader material ──
  G3_DATA.forEach(g => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, uOpacity: { value: 0 } },
      vertexShader: KEY_VERTEX,
      fragmentShader: KEY_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const w = 95, h = 175;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(g.x, g.baseY, g.z);
    mesh.userData = { baseX: g.x, baseZ: g.z, baseY: g.baseY, sway: g.sway, zNorm: g.zNorm };
    mesh.visible = false;
    g3Scene.add(mesh);
    g3Meshes.push(mesh);

    const topY = g.baseY + h / 2;
    const threadTopY = topY + 220 + Math.random() * 80;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(g.x, threadTopY, g.z),
      new THREE.Vector3(g.x, topY, g.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial(lineMatBase));
    g3Scene.add(line);
    g3Threads.push({ line, geo, threadTopY, topY, baseZ: g.z });
  });

  // ── Step 2: load each unique texture directly (no canvas manipulation) ──
  const uniqueImgs = [...new Set(G3_DATA.map(g => g.img))];
  let loadedCount = 0;
  const texCache = {};
  const texLoader = new THREE.TextureLoader();

  function onOneReady() {
    loadedCount++;
    if (loadedCount === uniqueImgs.length) {
      G3_DATA.forEach((g, i) => {
        const tex = texCache[g.img];
        if (tex) {
          g3Meshes[i].material.uniforms.map.value = tex;
          g3Meshes[i].material.needsUpdate = true;
          g3Meshes[i].visible = true;
        }
      });
      if (typeof onReady === 'function') onReady();
    }
  }

  uniqueImgs.forEach(id => {
    texLoader.load(
      `dress${id}.png`,
      tex => { texCache[id] = tex; onOneReady(); },
      undefined,
      () => { console.warn('Failed to load dress' + id + '.png'); onOneReady(); }
    );
  });

  window.addEventListener('resize', () => {
    g3Camera.aspect = window.innerWidth / window.innerHeight;
    g3Camera.updateProjectionMatrix();
    g3Renderer.setSize(window.innerWidth, window.innerHeight);
  });

  g3Tick();
}

const G3_SZ = 700, G3_EZ = -1700;

function g3SetCameraProgress(p) {
  const z = G3_SZ + (G3_EZ - G3_SZ) * p;
  g3Camera.position.z = z;
  g3Camera.position.y = 60 - p * 10;
  g3Camera.lookAt(0, CAMERA_LOOKAT_Y, z - 400);
}

function g3SetOpacity(v) {
  g3Opacity = v;
  g3Meshes.forEach(m => { m.material.uniforms.uOpacity.value = 0.90 * v; });
  g3Threads.forEach(t => { t.line.material.opacity = 0.45 * v; });
}

let g3FadeRAF = null;
function g3FadeTo(target, durationSec) {
  if (g3FadeRAF) cancelAnimationFrame(g3FadeRAF);
  const start = g3Opacity;
  const t0 = performance.now();
  const durMs = Math.max(durationSec, 0.01) * 1000;
  function step(now) {
    const p = Math.min((now - t0) / durMs, 1);
    g3SetOpacity(start + (target - start) * p);
    if (p < 1) g3FadeRAF = requestAnimationFrame(step);
  }
  g3FadeRAF = requestAnimationFrame(step);
}

function g3FadeOutStaggered(durationSec) {
  if (g3FadeRAF) cancelAnimationFrame(g3FadeRAF);
  const STAGGER = 0.55;
  const t0 = performance.now();
  const durMs = Math.max(durationSec, 0.01) * 1000;

  function step(now) {
    const globalP = Math.min((now - t0) / durMs, 1);
    g3Meshes.forEach((mesh, i) => {
      const zNorm = mesh.userData.zNorm || 0;
      const startFrac = (1 - zNorm) * STAGGER;
      const localP = Math.max(0, Math.min((globalP - startFrac) / (1 - STAGGER), 1));
      mesh.material.uniforms.uOpacity.value = 0.90 * (1 - localP);
      g3Threads[i].line.material.opacity = 0.45 * (1 - localP);
    });
    if (globalP < 1) {
      g3FadeRAF = requestAnimationFrame(step);
    } else {
      g3Opacity = 0;
    }
  }
  g3FadeRAF = requestAnimationFrame(step);
}

function g3Tick(now) {
  requestAnimationFrame(g3Tick);
  if (!g3Renderer) return;
  if (!g3T0) g3T0 = now || performance.now();
  const t = ((now || performance.now()) - g3T0) * 0.0004;

  g3Meshes.forEach((mesh, i) => {
    const sway = Math.sin(t + mesh.userData.sway) * 2.2;
    mesh.position.x = mesh.userData.baseX + sway;
    mesh.rotation.z = sway * 0.0016;
    const th = g3Threads[i];
    th.geo.setFromPoints([
      new THREE.Vector3(mesh.position.x, th.threadTopY, th.baseZ),
      new THREE.Vector3(mesh.position.x, th.topY, th.baseZ),
    ]);
  });

  g3Renderer.render(g3Scene, g3Camera);
}

function g3Reset() {
  g3T0 = null;
  g3SetOpacity(0);
  g3SetCameraProgress(0);
}
