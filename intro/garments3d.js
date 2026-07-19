// ── GARMENT LAYER — real Three.js, transparent overlay on top of the video ──
// No room geometry — only garment meshes + thread lines, alpha-cleared canvas.
// Textures are black-background PNGs, keyed to transparent via an offscreen
// canvas (CanvasTexture), same technique as the working 2D version — Three.js
// alphaTest alone does nothing without an actual alpha channel.
// Camera stays IN FRONT of every garment at all times so they remain upright,
// in-frame, and simply fade into the blinding white — never fly past/overhead.

let g3Scene, g3Camera, g3Renderer;
let g3Meshes = [], g3Threads = [];
let g3T0 = null;
let g3Opacity = 0;

// Depths chosen so the FARTHEST camera position (G3_EZ) still sits well in
// front of every garment's z (camera z > garment z for all entries, always).
const G3_DATA = [
  { x: -150, z: -420,  threadLen: 320, sway: 0.0, img: 1 },
  { x:  120, z: -520,  threadLen: 90,  sway: 1.1, img: 2 },
  { x: -270, z: -620,  threadLen: 220, sway: 0.5, img: 3 },
  { x:  40,  z: -740,  threadLen: 340, sway: 2.1, img: 4 },
  { x:  240, z: -680,  threadLen: 75,  sway: 0.8, img: 5 },
  { x: -100, z: -860,  threadLen: 180, sway: 1.6, img: 6 },
  { x:  190, z: -960,  threadLen: 300, sway: 2.4, img: 7 },
  { x: -230, z: -1060, threadLen: 110, sway: 0.3, img: 3 },
  { x:  60,  z: -1180, threadLen: 280, sway: 1.9, img: 1 },
  { x: -60,  z: -1300, threadLen: 95,  sway: 1.2, img: 5 },
];

// Keys a black-background PNG to transparent, returns a THREE.CanvasTexture.
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
  g3Camera.lookAt(0, 40, 0);

  const ambient = new THREE.AmbientLight(0xffe8d0, 0.95);
  g3Scene.add(ambient);
  const key = new THREE.PointLight(0xffd9a8, 0.5, 1600);
  key.position.set(0, 200, 300);
  g3Scene.add(key);

  const ceilY = 350;
  const lineMatBase = { color: 0xD4A870, transparent: true, opacity: 0 };

  // ── Step 1: create ALL meshes first (with a blank/white-off material) ──
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
    const topY = ceilY - g.threadLen;
    const baseY = topY - h / 2;
    mesh.position.set(g.x, baseY, g.z);
    mesh.userData = { baseX: g.x, baseZ: g.z, sway: g.sway, topY };
    mesh.visible = false; // hidden until its texture is actually applied
    g3Scene.add(mesh);
    g3Meshes.push(mesh);

    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(g.x, ceilY, g.z),
      new THREE.Vector3(g.x, topY, g.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial(lineMatBase));
    g3Scene.add(line);
    g3Threads.push({ line, geo, ceilY, topY, baseZ: g.z });
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

// Camera stays well in FRONT of the nearest garment (z:-420) at all times —
// G3_EZ is chosen so it never crosses past any garment, so nothing ever
// swings overhead or exits behind the camera. Garments simply grow closer
// and then dissolve into the white, staying upright and in-frame throughout.
const G3_SZ = 700, G3_EZ = -180;

function g3SetCameraProgress(p) {
  const z = G3_SZ + (G3_EZ - G3_SZ) * p;
  g3Camera.position.z = z;
  g3Camera.position.y = 60 - p * 10;
  g3Camera.lookAt(0, 45, 0);
}

function g3SetOpacity(v) {
  g3Opacity = v;
  g3Meshes.forEach(m => { m.material.opacity = 0.92 * v; });
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
      new THREE.Vector3(mesh.position.x, th.ceilY, th.baseZ),
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
