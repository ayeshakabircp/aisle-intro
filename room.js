// room.js — Three.js room with bloom post-processing
// Uses three/examples for EffectComposer + UnrealBloomPass

let roomRenderer, roomScene, roomCamera, roomComposer;
let roomT0 = null;
const roomGarmentMeshes = [], roomThreadGeos = [];

async function initRoom() {
  const canvas = document.getElementById('room-canvas');
  const W = window.innerWidth, H = window.innerHeight;

  // RENDERER
  roomRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  roomRenderer.setSize(W, H);
  roomRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  roomRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  roomRenderer.toneMappingExposure = 1.4;

  // SCENE
  roomScene = new THREE.Scene();
  roomScene.background = new THREE.Color(0xFFD090);
  roomScene.fog = new THREE.Fog(0xFFCC77, 500, 3800);

  // CAMERA
  roomCamera = new THREE.PerspectiveCamera(72, W / H, 1, 8000);
  roomCamera.position.set(0, 60, 700);
  roomCamera.lookAt(0, 40, 0);

  // POST PROCESSING — bloom
  const { EffectComposer } = await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js');
  const { RenderPass }     = await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/RenderPass.js');
  const { UnrealBloomPass }= await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js');

  roomComposer = new EffectComposer(roomRenderer);
  roomComposer.addPass(new RenderPass(roomScene, roomCamera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(W, H),
    0.85,   // strength
    0.6,    // radius
    0.2     // threshold
  );
  roomComposer.addPass(bloom);

  buildRoom();
  startRoomLoop();
}

function buildRoom() {
  const rW = 3000, rH = 800, rD = 9000;
  const ceilY = rH / 2;
  const floorY = -rH / 2;

  // FLOOR — warm sand with slight sheen
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xB8834A, roughness: 0.85, metalness: 0.08
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(rW, rD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  roomScene.add(floor);

  // FLOOR REFLECTION — very subtle glossy overlay
  const reflMat = new THREE.MeshStandardMaterial({
    color: 0xFFCC88, roughness: 0.1, metalness: 0.15,
    transparent: true, opacity: 0.12
  });
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(rW, rD), reflMat);
  refl.rotation.x = -Math.PI / 2;
  refl.position.y = floorY + 0.5;
  roomScene.add(refl);

  // CEILING — warm sand
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xD4A870, roughness: 0.98
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rW, rD), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ceilY;
  roomScene.add(ceil);

  // NO SIDE WALLS, NO BACK WALL

  // CEILING LIGHT STRIPS — two converging lines, bright emissive
  [-260, 260].forEach(x => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFFFDD,
      emissive: new THREE.Color(0xFFFFDD),
      emissiveIntensity: 8.0,
      roughness: 0.0
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(5, 3, rD * 0.98), mat);
    strip.position.set(x, ceilY - 3, 0);
    roomScene.add(strip);
  });

  // CEILING DISCS — curated uneven spacing
  const discGeo = new THREE.CircleGeometry(28, 32);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFCC,
    emissive: new THREE.Color(0xFFFFCC),
    emissiveIntensity: 6.0,
    roughness: 0.0
  });
  const discZs = [-120, -580, -920, -1500, -1900, -2600, -3200];
  [-260, 260].forEach(x => {
    discZs.forEach(z => {
      const d = new THREE.Mesh(discGeo, discMat);
      d.rotation.x = Math.PI / 2;
      d.position.set(x, ceilY - 1, z);
      roomScene.add(d);
      const pl = new THREE.PointLight(0xFFBB55, 1.6, 1100);
      pl.position.set(x, ceilY - 35, z);
      roomScene.add(pl);
    });
  });

  // SCENE LIGHTS — warm, layered
  roomScene.add(new THREE.AmbientLight(0xFFCC88, 0.38));

  // Overhead warm main
  const main = new THREE.PointLight(0xFFBB44, 2.5, 2800);
  main.position.set(0, 380, -100);
  roomScene.add(main);

  // Vanishing point pull — golden glow far end
  const vp = new THREE.PointLight(0xFFDD77, 2.0, 3000);
  vp.position.set(0, 100, -1500);
  roomScene.add(vp);

  // Directional warm fill — simulates window shaft
  const dir = new THREE.DirectionalLight(0xFFAA44, 0.9);
  dir.position.set(600, 400, 200);
  roomScene.add(dir);

  // Camera near fill
  const near = new THREE.PointLight(0xFFCC99, 0.5, 900);
  near.position.set(-300, 200, 500);
  roomScene.add(near);

  // Floor bounce
  const bounce = new THREE.PointLight(0xC8834A, 0.4, 700);
  bounce.position.set(0, -350, 0);
  roomScene.add(bounce);

  // GARMENTS — high-low editorial mix
  // threadLen controls height: low number = hangs LOW (long thread)
  // high number = garment floats HIGH (short thread)
  // Mix: some almost touching floor (threadLen ~340), some floating high (threadLen ~80)
  const gData = [
    // Cluster A — near left, low-high mix
    { x: -320, z: -180,  w: 110, h: 190, color: 0xC44C18, sway: 0.0,  threadLen: 320 }, // very low
    { x: -180, z: -260,  w: 85,  h: 160, color: 0xD4694A, sway: 1.1,  threadLen: 90  }, // high float
    { x: -400, z: -400,  w: 105, h: 185, color: 0xBF5538, sway: 0.5,  threadLen: 220 }, // mid

    // Cluster B — center, dramatic contrast
    { x:  30,  z: -600,  w: 120, h: 200, color: 0xC96040, sway: 2.1,  threadLen: 340 }, // floor grazing
    { x:  180, z: -700,  w: 80,  h: 150, color: 0xD4694A, sway: 0.8,  threadLen: 75  }, // very high

    // Cluster C — right, varied
    { x:  320, z: -480,  w: 110, h: 195, color: 0xC44C18, sway: 1.6,  threadLen: 180 },
    { x:  460, z: -620,  w: 90,  h: 170, color: 0xBF5538, sway: 2.4,  threadLen: 300 }, // low
    { x:  360, z: -820,  w: 115, h: 185, color: 0xD47050, sway: 0.3,  threadLen: 110 }, // high

    // Solo editorial pieces
    { x: -80,  z: -1050, w: 100, h: 180, color: 0xC96040, sway: 1.9,  threadLen: 280 },
    { x:  240, z: -1250, w: 110, h: 190, color: 0xBF5538, sway: 1.2,  threadLen: 95  }, // high

    // Far dissolving into fog
    { x: -280, z: -1550, w: 95,  h: 175, color: 0xD4694A, sway: 2.8,  threadLen: 320 },
    { x:  90,  z: -1850, w: 105, h: 185, color: 0xC44C18, sway: 0.6,  threadLen: 150 },
    { x: -160, z: -2150, w: 90,  h: 170, color: 0xC96040, sway: 1.5,  threadLen: 260 },
    { x:  300, z: -2450, w: 100, h: 180, color: 0xBF5538, sway: 2.2,  threadLen: 85  }, // high far
  ];

  const lineMat = new THREE.LineBasicMaterial({
    color: 0xD4A870, transparent: true, opacity: 0.45
  });

  gData.forEach(g => {
    // Load real texture if available, fall back to color
    const loader = new THREE.TextureLoader();
    const mat = new THREE.MeshStandardMaterial({
      color: g.color,
      roughness: 0.75,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      alphaTest: 0.1
    });

    // Try loading texture
    const imgIndex = (Math.abs(g.x + g.z) % 7) + 1;
    loader.load(
      `/dress${imgIndex}.png`,
      tex => { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; },
      undefined,
      () => {} // fail silently, keep color
    );

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(g.w, g.h), mat);
    const garmentTopY = ceilY - g.threadLen;
    const baseY = garmentTopY - g.h / 2;
    mesh.position.set(g.x, baseY, g.z);
    mesh.userData = { baseX: g.x, baseZ: g.z, sway: g.sway, baseY, garmentTopY };
    roomScene.add(mesh);
    roomGarmentMeshes.push(mesh);

    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(g.x, ceilY, g.z),
      new THREE.Vector3(g.x, garmentTopY, g.z)
    ]);
    roomScene.add(new THREE.Line(geo, lineMat));
    roomThreadGeos.push({ geo, ceilY, garmentTopY, baseZ: g.z });
  });
}

function startRoomLoop() {
  const TOTAL = 8000, LINEAR = 7000;
  const SZ = 700, EZ = -200;

  function animate(now) {
    requestAnimationFrame(animate);
    if (!roomT0) roomT0 = now;
    const el = now - roomT0;
    let p;
    if (el <= LINEAR) {
      p = el / TOTAL;
    } else if (el <= TOTAL) {
      const lp = LINEAR / TOTAL;
      const t = (el - LINEAR) / 1000;
      p = lp + (1 - lp) * (1 - Math.pow(1 - t, 3));
    } else {
      p = 1;
    }

    roomCamera.position.z = SZ + (EZ - SZ) * p;
    roomCamera.position.y = 60 - p * 15;
    roomCamera.lookAt(0, 40 + p * 10, 0);

    const tt = now * 0.0004;
    roomGarmentMeshes.forEach((mesh, i) => {
      const s = Math.sin(tt + mesh.userData.sway) * 2.0;
      mesh.position.x = mesh.userData.baseX + s;
      mesh.rotation.z = s * 0.0016;
      const tg = roomThreadGeos[i];
      tg.geo.setFromPoints([
        new THREE.Vector3(mesh.position.x, tg.ceilY, tg.baseZ),
        new THREE.Vector3(mesh.position.x, tg.garmentTopY, tg.baseZ)
      ]);
    });

    if (roomComposer) roomComposer.render();
    else roomRenderer.render(roomScene, roomCamera);
  }
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  if (!roomRenderer) return;
  const W = window.innerWidth, H = window.innerHeight;
  roomCamera.aspect = W / H;
  roomCamera.updateProjectionMatrix();
  roomRenderer.setSize(W, H);
  if (roomComposer) roomComposer.setSize(W, H);
});
