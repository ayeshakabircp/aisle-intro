let roomRenderer, roomScene, roomCamera, roomComposer;
let roomT0 = null;
const roomGarmentMeshes = [], roomThreadGeos = [];

async function initRoom() {
  // Hide bg image — using Three.js room only
  const bgWrap = document.getElementById('room-bg-wrap');
  if (bgWrap) bgWrap.style.display = 'none';

  const canvas = document.getElementById('room-canvas');
  const W = window.innerWidth, H = window.innerHeight;

  roomRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  roomRenderer.setSize(W, H);
  roomRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  roomRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  roomRenderer.toneMappingExposure = 1.6;
  roomRenderer.shadowMap.enabled = false;

  roomScene = new THREE.Scene();
  roomScene.background = new THREE.Color(0xD4A870);
  // Dense warm fog — vanishing point glows and dissolves
  roomScene.fog = new THREE.Fog(0xFFDDA0, 400, 3200);

  roomCamera = new THREE.PerspectiveCamera(68, W / H, 1, 8000);
  roomCamera.position.set(0, 60, 700);
  roomCamera.lookAt(0, 40, 0);

  // BLOOM
  try {
    const { EffectComposer } = await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js');
    const { RenderPass }     = await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/RenderPass.js');
    const { UnrealBloomPass }= await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js');
    roomComposer = new EffectComposer(roomRenderer);
    roomComposer.addPass(new RenderPass(roomScene, roomCamera));
    roomComposer.addPass(new UnrealBloomPass(
      new THREE.Vector2(W, H),
      1.8,  // strength — aggressive bloom
      0.9,  // radius
      0.08  // threshold — almost everything blooms
    ));
  } catch(e) { console.warn('Bloom unavailable'); }

  buildRoom();
  buildGarments();
  buildGrain();
  startRoomLoop();
}

function buildRoom() {
  const rW = 1800, rH = 750, rD = 9000;
  const ceilY = rH / 2, floorY = -rH / 2;

  // FLOOR — warm sand with subtle texture via color variation
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xB89060, roughness: 0.75, metalness: 0.12
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(rW * 2, rD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  roomScene.add(floor);

  // FLOOR REFLECTION — polished surface
  const reflMat = new THREE.MeshStandardMaterial({
    color: 0xFFBB66, roughness: 0.02, metalness: 0.3,
    transparent: true, opacity: 0.18
  });
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(rW * 2, rD), reflMat);
  refl.rotation.x = -Math.PI / 2;
  refl.position.y = floorY + 1;
  roomScene.add(refl);

  // CEILING
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xD4AA70, roughness: 0.95 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rW * 2, rD), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ceilY;
  roomScene.add(ceil);

  // SIDE WALLS — subtle, warm, just enough to frame
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xCCAA78, roughness: 0.95 });
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(rD, rH), wallMat);
  lw.rotation.y = Math.PI / 2; lw.position.x = -rW / 2;
  roomScene.add(lw);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(rD, rH), wallMat);
  rw.rotation.y = -Math.PI / 2; rw.position.x = rW / 2;
  roomScene.add(rw);

  // CEILING LIGHT STRIPS — 5 pairs converging to vanishing point
  // Each pair gets progressively closer together toward center
  const stripPairs = [
    { x: 420,  width: 6 },
    { x: 280,  width: 5 },
    { x: 140,  width: 4 },
    { x: -140, width: 4 },
    { x: -280, width: 5 },
    { x: -420, width: 6 },
  ];

  stripPairs.forEach(({ x, width }) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFFFEE,
      emissive: new THREE.Color(0xFFFFEE),
      emissiveIntensity: 12.0,
      roughness: 0.0
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 3, rD * 0.97), mat);
    strip.position.set(x, ceilY - 3, -rD * 0.02);
    roomScene.add(strip);

    // Light spilling down from each strip
    const pl = new THREE.PointLight(0xFFCC66, 0.8, 1400);
    pl.position.set(x, ceilY - 40, 0);
    roomScene.add(pl);
  });

  // FLOOR LIGHT REFLECTIONS — strips reflect on floor
  stripPairs.forEach(({ x, width }) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFFFCC,
      emissive: new THREE.Color(0xFFFFCC),
      emissiveIntensity: 2.5,
      roughness: 0.0,
      transparent: true,
      opacity: 0.35
    });
    const refl = new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, 1, rD * 0.85), mat);
    refl.position.set(x, floorY + 1.5, -rD * 0.05);
    roomScene.add(refl);
  });

  // VANISHING POINT GLOW — pure light, no geometry planes
  // Multiple point lights deep in the scene build up the golden glow

  // SCENE LIGHTS
  roomScene.add(new THREE.AmbientLight(0xFFCC88, 0.3));

  const main = new THREE.PointLight(0xFFBB44, 3.5, 3000);
  main.position.set(0, 400, -200);
  roomScene.add(main);

  // Strong vanishing point pull light
  const vp1 = new THREE.PointLight(0xFFEE88, 6.0, 3000);
  vp1.position.set(0, 80, -800); roomScene.add(vp1);
  const vp2 = new THREE.PointLight(0xFFFFAA, 4.0, 2000);
  vp2.position.set(0, 60, -1200); roomScene.add(vp2);
  const vp3 = new THREE.PointLight(0xFFFFCC, 3.0, 1200);
  vp3.position.set(0, 40, -1600); roomScene.add(vp3);

  const dir = new THREE.DirectionalLight(0xFFAA44, 1.0);
  dir.position.set(400, 300, 200);
  roomScene.add(dir);

  const near = new THREE.PointLight(0xFFCC99, 0.6, 1000);
  near.position.set(0, 100, 600);
  roomScene.add(near);

  const bounce = new THREE.PointLight(0xC8834A, 0.5, 800);
  bounce.position.set(0, -300, 0);
  roomScene.add(bounce);
}

function buildGarments() {
  const ceilY = 375;
  const SCALE = 1.5;

  const gData = [
    { x:-320, z:-180,  w:110, h:190, img:1, sway:0.0,  threadLen:320 },
    { x:-180, z:-260,  w:85,  h:160, img:2, sway:1.1,  threadLen:90  },
    { x:-400, z:-400,  w:105, h:185, img:3, sway:0.5,  threadLen:220 },
    { x:30,   z:-600,  w:120, h:200, img:4, sway:2.1,  threadLen:340 },
    { x:180,  z:-700,  w:80,  h:150, img:5, sway:0.8,  threadLen:75  },
    { x:320,  z:-480,  w:110, h:195, img:6, sway:1.6,  threadLen:180 },
    { x:460,  z:-620,  w:90,  h:170, img:7, sway:2.4,  threadLen:310 },
    { x:360,  z:-820,  w:115, h:185, img:1, sway:0.3,  threadLen:110 },
    { x:-80,  z:-1050, w:100, h:180, img:2, sway:1.9,  threadLen:280 },
    { x:240,  z:-1250, w:110, h:190, img:3, sway:1.2,  threadLen:95  },
    { x:-280, z:-1550, w:95,  h:175, img:4, sway:2.8,  threadLen:330 },
    { x:90,   z:-1850, w:105, h:185, img:5, sway:0.6,  threadLen:140 },
    { x:-160, z:-2150, w:90,  h:170, img:6, sway:1.5,  threadLen:265 },
    { x:300,  z:-2450, w:100, h:180, img:7, sway:2.2,  threadLen:85  },
  ];

  const loader = new THREE.TextureLoader();
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xE8C090, transparent: true, opacity: 0.55
  });

  gData.forEach(g => {
    const w = g.w * SCALE, h = g.h * SCALE;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xC44C18, roughness: 0.75,
      transparent: true, opacity: 0.93,
      side: THREE.DoubleSide, alphaTest: 0.1
    });
    loader.load(
      `/dress${g.img}.png`,
      tex => { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; },
      undefined, () => {}
    );
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const garmentTopY = ceilY - g.threadLen;
    const baseY = garmentTopY - h / 2;
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

function buildGrain() {
  const grain = document.getElementById('grain-canvas');
  if (!grain) return;
  grain.width = window.innerWidth;
  grain.height = window.innerHeight;
  const gctx = grain.getContext('2d');
  function drawGrain() {
    const id = gctx.createImageData(grain.width, grain.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = Math.min(255, v+30); d[i+1] = Math.min(255, v+12);
      d[i+2] = Math.round(v*0.6); d[i+3] = 255;
    }
    gctx.putImageData(id, 0, 0);
  }
  drawGrain();
  setInterval(drawGrain, 100);
}

function startRoomLoop() {
  const DUR = 8000;
  const SZ = 700, EZ = -200;

  function easeInOutQuart(t) {
    return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4) / 2;
  }

  function animate(now) {
    requestAnimationFrame(animate);
    if (!roomT0) roomT0 = now;
    const p = easeInOutQuart(Math.min((now - roomT0) / DUR, 1));

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
