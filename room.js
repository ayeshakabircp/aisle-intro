let roomRenderer, roomScene, roomCamera;
let roomT0 = null;
const roomGarmentMeshes = [], roomThreadGeos = [];

function initRoom() {
  const bgWrap = document.getElementById('room-bg-wrap');
  if (bgWrap) bgWrap.style.display = 'none';

  const canvas = document.getElementById('room-canvas');
  const W = window.innerWidth, H = window.innerHeight;

  roomRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  roomRenderer.setSize(W, H);
  roomRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  roomRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  roomRenderer.toneMappingExposure = 1.2;

  roomScene = new THREE.Scene();
  roomScene.background = new THREE.Color(0xE2C89A);

  // Exponential fog — very low density, translucent not opaque
  // You see through it, it just adds warm atmospheric haze
  roomScene.fog = new THREE.FogExp2(0xE2C89A, 0.00028);

  roomCamera = new THREE.PerspectiveCamera(72, W / H, 1, 8000);
  roomCamera.position.set(0, 60, 700);
  roomCamera.lookAt(0, 40, 0);

  buildRoom();
  buildGarments();
  buildGrain();
  startRoomLoop();
}

function buildRoom() {
  const rD = 9000;
  const ceilY = 350, floorY = -350;

  // FLOOR — warm dark sand, wide, no side walls
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xA07848, roughness: 0.82, metalness: 0.08
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8000, rD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  roomScene.add(floor);

  // FLOOR REFLECTION — polished surface catching strip light
  const reflMat = new THREE.MeshStandardMaterial({
    color: 0xFFCC88, roughness: 0.05, metalness: 0.2,
    transparent: true, opacity: 0.15
  });
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(8000, rD), reflMat);
  refl.rotation.x = -Math.PI / 2;
  refl.position.y = floorY + 1;
  roomScene.add(refl);

  // CEILING — wide, no walls
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xC8A070, roughness: 0.96
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8000, rD), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ceilY;
  roomScene.add(ceil);

  // SIDE FILL PLANES — same color as bg, seamlessly fill the void
  // These are NOT visible walls — they're bg-colored fills that make
  // the space feel infinite by matching the scene background exactly
  const sideFillMat = new THREE.MeshBasicMaterial({ color: 0xE2C89A, side: THREE.DoubleSide });
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(rD, 2000), sideFillMat);
  sideL.rotation.y = Math.PI / 2; sideL.position.x = -1200; roomScene.add(sideL);
  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(rD, 2000), sideFillMat);
  sideR.rotation.y = -Math.PI / 2; sideR.position.x = 1200; roomScene.add(sideR);
  // Back fill
  const backFill = new THREE.Mesh(new THREE.PlaneGeometry(8000, 2000), sideFillMat);
  backFill.position.z = -4000; roomScene.add(backFill);

  // CEILING LIGHT STRIPS — 5 pairs converging to vanishing point
  // Spread across ceiling width so they frame without walls
  const stripXs = [-480, -280, -80, 80, 280, 480];
  stripXs.forEach(x => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFFFEE,
      emissive: new THREE.Color(0xFFFFEE),
      emissiveIntensity: 10.0,
      roughness: 0.0
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(4, 3, rD * 0.96), mat);
    strip.position.set(x, ceilY - 3, -rD * 0.02);
    roomScene.add(strip);

    // Floor reflection of each strip
    const rmat = new THREE.MeshStandardMaterial({
      color: 0xFFFFCC,
      emissive: new THREE.Color(0xFFFFCC),
      emissiveIntensity: 2.0,
      roughness: 0.0,
      transparent: true, opacity: 0.3
    });
    const rstrip = new THREE.Mesh(new THREE.BoxGeometry(3, 1, rD * 0.7), rmat);
    rstrip.position.set(x, floorY + 2, -rD * 0.1);
    roomScene.add(rstrip);

    // Point light under each strip
    const pl = new THREE.PointLight(0xFFCC77, 0.6, 1200);
    pl.position.set(x, ceilY - 40, 0);
    roomScene.add(pl);
  });

  // CEILING DISCS
  const dg = new THREE.CircleGeometry(28, 32);
  const dm = new THREE.MeshStandardMaterial({
    color: 0xFFFFEE, emissive: new THREE.Color(0xFFFFEE),
    emissiveIntensity: 8.0, roughness: 0.0
  });
  [-480, -280, -80, 80, 280, 480].forEach(x => {
    [-150, -700, -1300, -2000, -2800].forEach(z => {
      const d = new THREE.Mesh(dg, dm);
      d.rotation.x = Math.PI / 2;
      d.position.set(x, ceilY - 1, z);
      roomScene.add(d);
    });
  });

  // LIGHTS
  // Low ambient — room is primarily lit by strips and vanishing point
  roomScene.add(new THREE.AmbientLight(0xFFCC88, 0.25));

  // Main warm overhead
  const main = new THREE.PointLight(0xFFBB55, 2.0, 3000);
  main.position.set(0, 350, -200);
  roomScene.add(main);

  // VANISHING POINT RADIAL BLOOM
  // Bright center, fades radially — this is the "glow" in the reference
  // Multiple stacked lights at increasing depth, each dimmer
  const vpLights = [
    { z: -600,  intensity: 2.5, dist: 1600, color: 0xFFEECC },
    { z: -1000, intensity: 3.0, dist: 1800, color: 0xFFEECC },
    { z: -1500, intensity: 2.5, dist: 1600, color: 0xFFEEDD },
    { z: -2000, intensity: 2.0, dist: 1400, color: 0xFFEEDD },
  ];
  vpLights.forEach(l => {
    const pl = new THREE.PointLight(l.color, l.intensity, l.dist);
    pl.position.set(0, 60, l.z);
    roomScene.add(pl);
  });

  // Camera near fill — warm front light
  const near = new THREE.PointLight(0xFFCC99, 0.5, 900);
  near.position.set(0, 100, 500);
  roomScene.add(near);

  // Floor bounce
  const bounce = new THREE.PointLight(0xC8944A, 0.4, 700);
  bounce.position.set(0, -300, 0);
  roomScene.add(bounce);
}

function buildGarments() {
  const ceilY = 350;
  const SCALE = 1.5;

  const gData = [
    { x:-320, z:-200,  w:110, h:190, img:1, sway:0.0,  tLen:310 },
    { x:-180, z:-300,  w:85,  h:160, img:2, sway:1.1,  tLen:85  },
    { x:-400, z:-440,  w:105, h:185, img:3, sway:0.5,  tLen:210 },
    { x:30,   z:-620,  w:120, h:200, img:4, sway:2.1,  tLen:330 },
    { x:180,  z:-720,  w:80,  h:150, img:5, sway:0.8,  tLen:72  },
    { x:320,  z:-500,  w:110, h:195, img:6, sway:1.6,  tLen:175 },
    { x:460,  z:-640,  w:90,  h:170, img:7, sway:2.4,  tLen:300 },
    { x:360,  z:-840,  w:115, h:185, img:1, sway:0.3,  tLen:105 },
    { x:-80,  z:-1060, w:100, h:180, img:2, sway:1.9,  tLen:270 },
    { x:240,  z:-1260, w:110, h:190, img:3, sway:1.2,  tLen:90  },
    { x:-280, z:-1560, w:95,  h:175, img:4, sway:2.8,  tLen:320 },
    { x:90,   z:-1860, w:105, h:185, img:5, sway:0.6,  tLen:135 },
    { x:-160, z:-2160, w:90,  h:170, img:6, sway:1.5,  tLen:255 },
    { x:300,  z:-2460, w:100, h:180, img:7, sway:2.2,  tLen:80  },
  ];

  const loader = new THREE.TextureLoader();
  const lm = new THREE.LineBasicMaterial({
    color: 0xC8A070, transparent: true, opacity: 0.45
  });

  gData.forEach(g => {
    const w = g.w * SCALE, h = g.h * SCALE;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xC44C18, roughness: 0.8,
      transparent: true, opacity: 0.93,
      side: THREE.DoubleSide, alphaTest: 0.1
    });
    loader.load(`/dress${g.img}.png`,
      tex => { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; },
      undefined, () => {}
    );
    const topY = ceilY - g.tLen;
    const baseY = topY - h / 2;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(g.x, baseY, g.z);
    mesh.userData = { bx: g.x, bz: g.z, sw: g.sway, by: baseY, ty: topY };
    roomScene.add(mesh); roomGarmentMeshes.push(mesh);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(g.x, ceilY, g.z),
      new THREE.Vector3(g.x, topY, g.z)
    ]);
    roomScene.add(new THREE.Line(geo, lm));
    roomThreadGeos.push({ geo, bz: g.z, ty: topY });
  });
}

function buildGrain() {
  const grain = document.getElementById('grain-canvas');
  if (!grain) return;
  grain.width = window.innerWidth;
  grain.height = window.innerHeight;
  const gctx = grain.getContext('2d');
  function draw() {
    const id = gctx.createImageData(grain.width, grain.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = Math.min(255,v+12); d[i+1] = Math.min(255,v+5);
      d[i+2] = Math.round(v*0.8); d[i+3] = 255;
    }
    gctx.putImageData(id, 0, 0);
  }
  draw(); setInterval(draw, 150);
}

function startRoomLoop() {
  const SZ = 700, EZ = 100, DUR = 8000;
  function eq(t) { return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2,4)/2; }

  function animate(now) {
    requestAnimationFrame(animate);
    if (!roomT0) roomT0 = now;
    const p = eq(Math.min((now - roomT0) / DUR, 1));
    roomCamera.position.z = SZ + (EZ - SZ) * p;
    roomCamera.position.y = 60 - p * 10;
    roomCamera.lookAt(0, 40 + p * 5, 0);
    const t = now * 0.0005;
    roomGarmentMeshes.forEach((mesh, i) => {
      const s = Math.sin(t + mesh.userData.sw) * 2.2;
      mesh.position.x = mesh.userData.bx + s;
      mesh.rotation.z = s * 0.002;
      const tg = roomThreadGeos[i];
      tg.geo.setFromPoints([
        new THREE.Vector3(mesh.position.x, 350, tg.bz),
        new THREE.Vector3(mesh.position.x, tg.ty, tg.bz)
      ]);
    });
    roomRenderer.render(roomScene, roomCamera);
  }
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  if (!roomRenderer) return;
  const W = window.innerWidth, H = window.innerHeight;
  roomCamera.aspect = W / H;
  roomCamera.updateProjectionMatrix();
  roomRenderer.setSize(W, H);
});
