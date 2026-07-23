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

// x offset keeps the center 33% of the screen genuinely clean, distributed
// toward the middle-third-to-two-thirds zone (not slammed to the edges).
function sampleX(dist, side) {
  const minFrac = 0.08, maxFrac = 0.36;
  return side * dist * (minFrac + Math.random() * (maxFrac - minFrac));
}

// Y bounded to the marked acceptable band (roughly 29%-77% down the frame,
// i.e. ~40% of half-height above center, ~50% below) — scaled by each
// garment's own distance, same reasoning as X: a fixed world-Y offset
// compresses toward center at range, so without scaling, far garments
// would drift outside the intended band while near ones stayed within it.
// No more extreme low-drop outliers.
function sampleY(dist) {
  const halfH = dist * 0.4663; // tan(halfFOV) at ~25°
  const CAP = 220; // hard ceiling on vertical offset, regardless of distance —
                    // prevents far garments getting flung to extreme Y positions
  const t = Math.random();
  if (t < 0.5) {
    const frac = Math.random() * 0.32; // up to ~32% of half-height above center
    return CAMERA_LOOKAT_Y + Math.min(frac * halfH, CAP);
  } else {
    const frac = Math.random() * 0.40; // up to ~40% below center
    return CAMERA_LOOKAT_Y - Math.min(frac * halfH, CAP);
  }
}

function buildG3Data() {
  const data = [];
  const COUNT = 26;
  const Z_START = 50;
  // Shrunk from -3400 to -1500 — this now matches the camera's actual
  // travel range (700 -> -950, see G3_EZ below). Previously the field was
  // spread far deeper than the camera ever reached, so most garments
  // (everything past the camera's shortened path) never got closer and
  // stayed permanently tiny — not a stagger bug, the field itself was too
  // deep for how far the camera now travels.
  const Z_END = -1500;
  const Z_STEP = (Z_END - Z_START) / COUNT;

  // Guaranteed 13/13 left-right split, shuffled — pure per-item randomness
  // can (and did) produce lopsided runs by chance over a small sample.
  const sides = [];
  for (let i = 0; i < COUNT; i++) sides.push(i % 2 === 0 ? -1 : 1);
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }

  for (let i = 0; i < COUNT; i++) {
    const z = Z_START + Z_STEP * i + (Math.random() - 0.5) * Math.abs(Z_STEP) * 0.5;
    // Real distance from the camera's actual starting position (700), not
    // the |z|+300 approximation — that badly underestimated distance for
    // garments near z:50 (real distance ~650, not ~350), which meant the
    // biggest/nearest garments got the SMALLEST offset — exactly backwards,
    // and why the largest dresses were the ones still sitting on the text.
    const dist = Math.max(700 - z, 200);
    const x = sampleX(dist, sides[i]);
    const baseY = sampleY(dist);
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

// ── EXTENSION BATCH — purely additive, positioned BEHIND the original 26
// (starting exactly at the original's farthest point, Z:-1500, and
// extending further into the distance from there) rather than sharing the
// original's z-range. This means these garments start smaller/further away
// than anything in the original set and grow as the camera pans in toward
// them — matching real depth, not just added density in the same space.
// Does NOT touch buildG3Data(), G3_DATA, or any of the original 26
// garments' x/y/z. zNorm is computed independently, scoped only to this
// batch's own min/max z, so the original 26's fade timing is unaffected —
// see conversation notes for the tradeoff this implies at the batch
// boundary (fade order isn't physically continuous across the two
// batches; a global zNorm would fix that but would also shift the
// original's tuned fade schedule, which was deliberately avoided here).
const EXT_COUNT = 20;

function buildG3DataExtended() {
  const data = [];
  const Z_START = -1500; // starts exactly at the original batch's farthest dress
  const Z_END = -3050;   // extends further into the distance, same span (1550) as the original
  const Z_STEP = (Z_END - Z_START) / EXT_COUNT;

  const sides = [];
  for (let i = 0; i < EXT_COUNT; i++) sides.push(i % 2 === 0 ? -1 : 1);
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }

  for (let i = 0; i < EXT_COUNT; i++) {
    const z = Z_START + Z_STEP * i + (Math.random() - 0.5) * Math.abs(Z_STEP) * 0.5;
    const dist = Math.max(700 - z, 200);
    const x = sampleX(dist, sides[i]);
    const baseY = sampleY(dist);
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

// Shared mesh/thread creation, factored out so the original batch (called
// first, with the exact same per-garment logic as before) and the new
// extension batch (called second) build identically-behaving meshes from
// whatever data array they're given. Nothing about HOW a garment mesh/
// thread is built has changed — only that it can now run twice.
function g3CreateBatch(data) {
  const lineMatBase = { color: 0xD4A870, transparent: true, opacity: 0 };
  data.forEach(g => {
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
    mesh.userData = { baseX: g.x, baseZ: g.z, baseY: g.baseY, sway: g.sway, zNorm: g.zNorm, img: g.img };
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

  // Original batch — unchanged call, unchanged data, unchanged positions.
  const G3_DATA = buildG3Data();
  g3CreateBatch(G3_DATA);

  // Extension batch — additive only, appended after the original 26.
  const G3_DATA_EXT = buildG3DataExtended();
  g3CreateBatch(G3_DATA_EXT);

  const ALL_DATA = G3_DATA.concat(G3_DATA_EXT);

  // ── Step 2: load + key each unique image, apply to every mesh using it ──
  const uniqueImgs = [...new Set(ALL_DATA.map(g => g.img))];
  let loadedCount = 0;
  const texCache = {};

  function onOneReady() {
    loadedCount++;
    if (loadedCount === uniqueImgs.length) {
      ALL_DATA.forEach((g, i) => {
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

// Travel distance halved (was -2600) to slow the zoom-in rate by half —
// same video duration, camera covers half the distance, so scale increases
// at half the rate throughout.
const G3_SZ = 700, G3_EZ = -950;

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
