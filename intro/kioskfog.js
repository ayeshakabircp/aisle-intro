// ── KIOSK FOG — wispy drifting cloud/smoke near the floor of the kiosk image ──
// Real PerspectiveCamera (not orthographic) so layers at different z-depths
// genuinely scale/parallax — near clouds bigger and faster, far ones smaller
// and slower. Texture is built from layered soft radial blobs (a proper
// cloud-sprite technique) instead of a flat noise field, for real wispiness.
// Speed is calibrated so a full left-to-right traversal takes ~20 seconds,
// not the ~60-150s a previous version accidentally produced.

let kfScene, kfCamera, kfRenderer;
let kfPlanes = [];
let kfT0 = null;
let kfVisible = false;

function kfInit() {
  const canvas = document.getElementById('kiosk-fog-layer');
  if (!canvas || !window.THREE) return;

  kfRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  kfRenderer.setClearColor(0x000000, 0);
  kfRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  kfRenderer.setSize(window.innerWidth, window.innerHeight);

  kfScene = new THREE.Scene();
  kfCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  kfCamera.position.set(0, 0, 10);
  kfCamera.lookAt(0, 0, 0);

  const cloudTex = makeCloudTexture();

  // Near -> far: bigger/faster/more opaque near, smaller/slower/fainter far —
  // genuine depth now, since this is a real perspective camera.
  const defs = [
    { z: 2,  y: -1.55, w: 5.5, h: 1.0, speed: 0.42, opacity: 0.20 },
    { z: 0,  y: -1.65, w: 4.2, h: 0.85, speed: 0.30, opacity: 0.15 },
    { z: -2, y: -1.72, w: 3.2, h: 0.7, speed: 0.20, opacity: 0.11 },
  ];

  defs.forEach(d => {
    const mat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: d.opacity,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const geo = new THREE.PlaneGeometry(d.w, d.h);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-d.w * 0.9, d.y, d.z);
    kfScene.add(mesh);
    kfPlanes.push({ mesh, speed: d.speed, w: d.w, y: d.y, z: d.z });
  });

  kfTick();
}

// Layered soft radial blobs, composited with additive-ish overlap and a
// noise-perturbed silhouette — reads as genuine wispy cloud/fog, not a
// single flat gradient blob.
function makeCloudTexture() {
  const W = 1024, H = 384;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  function blob(cx, cy, r, alpha) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,248,236,${alpha})`);
    g.addColorStop(0.5, `rgba(255,246,230,${alpha * 0.55})`);
    g.addColorStop(1, 'rgba(255,246,230,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Base cluster of overlapping blobs along the horizontal band, bottom-weighted
  const baseY = H * 0.62;
  const blobCount = 22;
  for (let i = 0; i < blobCount; i++) {
    const cx = (i / blobCount) * W + (Math.random() - 0.5) * 90;
    const cy = baseY + (Math.random() - 0.5) * H * 0.28;
    const r = 60 + Math.random() * 110;
    const alpha = 0.5 + Math.random() * 0.4;
    blob(cx, cy, r, alpha);
  }
  // Second, sparser layer of smaller wisps on top for irregular edges
  for (let i = 0; i < 30; i++) {
    const cx = Math.random() * W;
    const cy = baseY + (Math.random() - 0.5) * H * 0.4;
    const r = 20 + Math.random() * 45;
    const alpha = 0.25 + Math.random() * 0.3;
    blob(cx, cy, r, alpha);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  return tex;
}

function kfSetVisible(v) {
  kfVisible = v;
  const canvas = document.getElementById('kiosk-fog-layer');
  if (canvas) canvas.style.opacity = v ? '1' : '0';
}

function kfTick(now) {
  requestAnimationFrame(kfTick);
  if (!kfRenderer || !kfVisible) return;
  if (!kfT0) kfT0 = now || performance.now();
  const t = ((now || performance.now()) - kfT0) / 1000;

  kfPlanes.forEach(p => {
    // Full span: from fully off-left to fully off-right of this plane's own width
    const span = p.w * 1.8;
    const startX = -p.w * 0.9;
    let x = startX + ((t * p.speed) % span);
    p.mesh.position.x = x;
  });

  kfRenderer.render(kfScene, kfCamera);
}

window.addEventListener('resize', () => {
  if (!kfRenderer) return;
  kfCamera.aspect = window.innerWidth / window.innerHeight;
  kfCamera.updateProjectionMatrix();
  kfRenderer.setSize(window.innerWidth, window.innerHeight);
});
