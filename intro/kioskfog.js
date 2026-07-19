// ── KIOSK FOG — wispy drifting smoke near the floor of the static kiosk image ──
// Procedural turbulent-noise texture (multiple octaves baked into a canvas),
// not a flat gradient blob — reads as real wisps, not a solid shape.
// Visibility is stage-gated via kfSetVisible() so it never bleeds onto the
// corridor video (e.g. on replay) — only renders while the kiosk stage is active.

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
  kfCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  kfCamera.position.z = 2;

  const mistTex = makeWispyTexture();

  // Half the previous height (was 0.35 * scale, now 0.175), still near the floor.
  const defs = [
    { y: -0.78, scale: 2.4, speed: 0.024, opacity: 0.14 },
    { y: -0.83, scale: 3.0, speed: 0.015, opacity: 0.10 },
    { y: -0.73, scale: 1.9, speed: 0.019, opacity: 0.12 },
  ];

  defs.forEach(d => {
    const mat = new THREE.MeshBasicMaterial({
      map: mistTex,
      transparent: true,
      opacity: d.opacity,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const geo = new THREE.PlaneGeometry(d.scale, d.scale * 0.175);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-d.scale, d.y, 0);
    kfScene.add(mesh);
    kfPlanes.push({ mesh, speed: d.speed, scale: d.scale, y: d.y, baseOpacity: d.opacity });
  });

  kfTick();
}

// Multi-octave value-noise, rendered to a canvas — genuinely wispy/turbulent
// rather than a single smooth radial gradient. No external image needed.
function makeWispyTexture() {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const buf = imgData.data;

  // Simple layered pseudo-noise (sum of sines at different frequencies/phases —
  // cheap substitute for Perlin, produces convincing wispy variation).
  function noise(x, y) {
    let v = 0;
    v += Math.sin(x * 0.018 + y * 0.021) * 0.5;
    v += Math.sin(x * 0.041 - y * 0.013 + 1.7) * 0.3;
    v += Math.sin(x * 0.007 + y * 0.052 + 4.1) * 0.4;
    v += Math.sin((x + y) * 0.033 + 2.3) * 0.25;
    return (v + 1.45) / 2.9; // normalize roughly to 0..1
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      // Vertical falloff — denser near bottom-center, thinning toward edges/top
      const distFromCenterY = Math.abs(y - H * 0.65) / (H * 0.5);
      const edgeFalloff = 1 - Math.min(1, distFromCenterY);
      const n = noise(x, y);
      const a = Math.max(0, n - 0.25) * edgeFalloff * 255;

      buf[idx]     = 255;
      buf[idx + 1] = 246;
      buf[idx + 2] = 230;
      buf[idx + 3] = a;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
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
    const span = p.scale * 2.2;
    let x = -p.scale + ((t * p.speed) % span);
    p.mesh.position.x = x;
  });

  kfRenderer.render(kfScene, kfCamera);
}

window.addEventListener('resize', () => {
  if (!kfRenderer) return;
  kfRenderer.setSize(window.innerWidth, window.innerHeight);
});
