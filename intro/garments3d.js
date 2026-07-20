// ── GARMENT LAYER — real Three.js, transparent overlay on top of the video ──
// Black-background keying via canvas getImageData -> CanvasTexture (the
// version that actually worked when properly served — the earlier "black
// box" issue was a local file:// viewing artifact, not a real bug, so this
// reverts the shader-based detour).

let g3Scene, g3Camera, g3Renderer;
let g3Meshes = [], g3Threads = [];
let g3T0 = null;
let g3Opacity = 0;

const CAMERA_LOOKAT_Y = 45;

// x offset keeps the center 33% of the screen genuinely clean (no rare
// center exception anymore), but no longer pushes all the way to the
// edges — distributed more toward the middle-third-to-two-thirds zone.
// Derived from screen-space fraction ≈ offsetFrac / tan(halfFOV≈25°≈0.466):
// wanting on-screen clearance of ~16.5% (half of the clean center 33%) up
// to ~80% (leaving edge breathing room, not slammed to the frame edge).
function sampleX(z) {
  const dist = Math.abs(z) + 300;
  const side = Math.random() < 0.5 ? -1 : 1;
  const minFrac = 0.08, maxFrac = 0.36;
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
    // Increased dramatic-drop frequency — leans on Y variation to fill the
    // frame rather than relying on extreme X spread toward the edges.
    const isDramatic = Math.random() < 0.35;
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

function keyToTransparentTexture(img, cb) {
  try {
    const off = document.createElement('canvas');
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const ctx = off.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, off.width, off.height);
    const buf = data.data;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i] < 18 && buf[i + 1] < 18 && buf[i + 2] < 18) buf[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(off);
    tex.needsUpdate = true;
    cb(tex);
  } catch (e) {
    console.warn('Garment key-out failed, using raw texture:', e);
    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    cb(tex);
  }
}

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

  const ambient = new THREE.AmbientLight(0xffe8d0, 0.95);
  g3Scene.add(ambient);
  const key = new THREE.PointLight(0xffd9a8, 0.5, 2000);
  key.position.set(0, 200, 300);
  g3Scene.add(key);

  const G3_DATA = buildG3Data();
  const lineMatBase = { color: 0xD4A870, transparent: true, opacity: 0 };

  // ── Step 1: create ALL meshes first ──
  G3_DATA.forEach(g => {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      alphaTest: 0.01,
      depthWrite: false,
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

  // ── Step 2: load + key each unique image, apply to every mesh using it ──
  const uniqueImgs = [...new Set(G3_DATA.map(g => g.img))];
  let loadedCount = 0;
  const texCache = {};

  function onOneReady() {
    loadedCount++;
    if (loadedCount === uniqueImgs.length) {
      G3_DATA.forEach((g, i) => {
        const tex = texCache[g.img];
        if (tex) {
          g3Meshes[i].material.map = tex;
          g3Meshes[i].material.needsUpdate = true;
          g3Meshes[i].visible = true;
        }
      });
      if (typeof onReady === 'function') onReady();
    }
  }

  uniqueImgs.forEach(id => {
    const imgEl = new Image();
    imgEl.onload = () => {
      keyToTransparentTexture(imgEl, tex => { texCache[id] = tex; onOneReady(); });
    };
    imgEl.onerror = () => { console.warn('Failed to load dress' + id + '.png'); onOneReady(); };
    imgEl.src = `dress${id}.png`;
  });

  window.addEventListener('resize', () => {
    g3Camera.aspect = window.innerWidth / window.innerHeight;
    g3Camera.updateProjectionMatrix();
    g3Renderer.setSize(window.innerWidth, window.innerHeight);
  });

  g3Tick();
}

// G3_EZ pushed considerably deeper (was -1700) so even the farthest
// garments (out to Z_END:-3400) experience real, visible distance closure
// by the end of the sequence — previously they barely moved/scaled since
// the camera never got meaningfully closer to them.
const G3_SZ = 700, G3_EZ = -2600;

function g3SetCameraProgress(p) {
  const z = G3_SZ + (G3_EZ - G3_SZ) * p;
  g3Camera.position.z = z;
  g3Camera.position.y = 60 - p * 10;
  g3Camera.lookAt(0, CAMERA_LOOKAT_Y, z - 400);
}

function g3SetOpacity(v) {
  g3Opacity = v;
  g3Meshes.forEach(m => { m.material.opacity = 0.90 * v; });
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
      mesh.material.opacity = 0.90 * (1 - localP);
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
