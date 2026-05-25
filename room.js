// room.js — Three.js warm room, renders as background from first frame
let roomRenderer, roomScene, roomCamera, roomComposer;
let roomT0 = null;
const roomGarmentMeshes = [], roomThreadGeos = [];

async function initRoom() {
  const canvas = document.getElementById('room-canvas');
  const W = window.innerWidth, H = window.innerHeight;

  roomRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  roomRenderer.setSize(W, H);
  roomRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  roomRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  roomRenderer.toneMappingExposure = 1.4;

  roomScene = new THREE.Scene();
  roomScene.background = new THREE.Color(0xFFD090);
  roomScene.fog = new THREE.Fog(0xFFCC77, 500, 3800);

  roomCamera = new THREE.PerspectiveCamera(72, W / H, 1, 8000);
  roomCamera.position.set(0, 60, 700);
  roomCamera.lookAt(0, 40, 0);

  // BLOOM POST PROCESSING
  try {
    const { EffectComposer } = await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js');
    const { RenderPass }     = await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/RenderPass.js');
    const { UnrealBloomPass }= await import('https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js');
    roomComposer = new EffectComposer(roomRenderer);
    roomComposer.addPass(new RenderPass(roomScene, roomCamera));
    roomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.7, 0.18));
  } catch(e) {
    console.warn('Bloom unavailable, falling back to standard render');
  }

  buildRoom();
  startRoomLoop();
}

function buildRoom() {
  const rH = 800, rD = 9000;
  const ceilY = rH / 2, floorY = -rH / 2;

  // FLOOR — warm sand
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xB8834A, roughness: 0.85, metalness: 0.06 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, rD), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; roomScene.add(floor);

  // FLOOR REFLECTION
  const reflMat = new THREE.MeshStandardMaterial({ color: 0xFFCC88, roughness: 0.08, metalness: 0.12, transparent: true, opacity: 0.1 });
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(4000, rD), reflMat);
  refl.rotation.x = -Math.PI / 2; refl.position.y = floorY + 0.5; roomScene.add(refl);

  // CEILING — warm sand, no side walls
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xD4A870, roughness: 0.98 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4000, rD), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ceilY; roomScene.add(ceil);

  // CEILING LIGHT STRIPS
  [-260, 260].forEach(x => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFFFDD, emissive: new THREE.Color(0xFFFFDD),
      emissiveIntensity: 8.0, roughness: 0.0
    });
    const s = new THREE.Mesh(new THREE.BoxGeometry(5, 3, rD * 0.98), mat);
    s.position.set(x, ceilY - 3, 0); roomScene.add(s);
  });

  // CEILING DISCS — uneven curated spacing
  const dg = new THREE.CircleGeometry(28, 32);
  const dm = new THREE.MeshStandardMaterial({
    color: 0xFFFFCC, emissive: new THREE.Color(0xFFFFCC),
    emissiveIntensity: 6.0, roughness: 0.0
  });
  [-120, -560, -900, -1480, -1860, -2540, -3100].forEach(z => {
    [-260, 260].forEach(x => {
      const d = new THREE.Mesh(dg, dm);
      d.rotation.x = Math.PI / 2; d.position.set(x, ceilY - 1, z); roomScene.add(d);
      const pl = new THREE.PointLight(0xFFBB55, 1.6, 1100);
      pl.position.set(x, ceilY - 35, z); roomScene.add(pl);
    });
  });

  // LIGHTS
  roomScene.add(new THREE.AmbientLight(0xFFCC88, 0.38));
  const main = new THREE.PointLight(0xFFBB44, 2.5, 2800);
  main.position.set(0, 380, -100); roomScene.add(main);
  const vp = new THREE.PointLight(0xFFDD77, 2.0, 3000);
  vp.position.set(0, 100, -1500); roomScene.add(vp);
  const dir = new THREE.DirectionalLight(0xFFAA44, 0.9);
  dir.position.set(600, 400, 200); roomScene.add(dir);
  const near = new THREE.PointLight(0xFFCC99, 0.5, 900);
  near.position.set(-300, 200, 500); roomScene.add(near);
  const bounce = new THREE.PointLight(0xC8834A, 0.4, 700);
  bounce.position.set(0, -350, 0); roomScene.add(bounce);

  // GARMENTS — high-low editorial mix
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
  const lineMat = new THREE.LineBasicMaterial({ color: 0xD4A870, transparent: true, opacity: 0.5 });

  gData.forEach(g => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xC44C18, roughness: 0.75,
      transparent: true, opacity: 0.92,
      side: THREE.DoubleSide, alphaTest: 0.1
    });
    loader.load(
      `/dress${g.img}.png`,
      tex => { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; },
      undefined, () => {}
    );
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(g.w, g.h), mat);
    const garmentTopY = ceilY - g.threadLen;
    const baseY = garmentTopY - g.h / 2;
    mesh.position.set(g.x, baseY, g.z);
    mesh.userData = { baseX: g.x, baseZ: g.z, sway: g.sway, baseY, garmentTopY };
    roomScene.add(mesh); roomGarmentMeshes.push(mesh);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(g.x, ceilY, g.z),
      new THREE.Vector3(g.x, garmentTopY, g.z)
    ]);
    roomScene.add(new THREE.Line(geo, lineMat));
    roomThreadGeos.push({ geo, ceilY, garmentTopY, baseZ: g.z });
  });

  // GRAIN
  const grain = document.getElementById('grain-canvas');
  grain.width = window.innerWidth; grain.height = window.innerHeight;
  const gctx = grain.getContext('2d');
  function drawGrain() {
    const id = gctx.createImageData(grain.width, grain.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = Math.min(255, v + 30); d[i+1] = Math.min(255, v + 12);
      d[i+2] = Math.round(v * 0.6); d[i+3] = 255;
    }
    gctx.putImageData(id, 0, 0);
  }
  drawGrain(); setInterval(drawGrain, 100);
}

function startRoomLoop() {
  const TOTAL = 8000, LINEAR = 7000;
  const SZ = 700, EZ = -200;

  function animate(now) {
    requestAnimationFrame(animate);
    if (!roomT0) roomT0 = now;
    const el = now - roomT0;
    let p;
    if (el <= LINEAR) p = el / TOTAL;
    else if (el <= TOTAL) { const lp = LINEAR/TOTAL, t=(el-LINEAR)/1000; p = lp+(1-lp)*(1-Math.pow(1-t,3)); }
    else p = 1;

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
  roomCamera.aspect = W / H; roomCamera.updateProjectionMatrix();
  roomRenderer.setSize(W, H);
  if (roomComposer) roomComposer.setSize(W, H);
});
