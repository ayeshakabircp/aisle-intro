// room.js — hybrid approach
// Background: Gemini image with CSS scale push
// Foreground: Three.js garments with real parallax

let roomRenderer, roomScene, roomCamera;
let roomT0 = null;
const roomGarmentMeshes = [], roomThreadGeos = [];

function initRoom() {
  // ── BACKGROUND IMAGE PUSH ──
  // Scale the wrap div (which has bg-image) for quality
  const bgWrap = document.getElementById('room-bg-wrap');
  if (bgWrap) {
    requestAnimationFrame(() => {
      bgWrap.style.transition = 'transform 8s cubic-bezier(0.25,0.1,0.1,1)';
      bgWrap.style.transform = 'scale(1.18) translateZ(0)';
    });
  }

  // ── THREE.JS GARMENTS ──
  const canvas = document.getElementById('room-canvas');
  const W = window.innerWidth, H = window.innerHeight;

  roomRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  roomRenderer.setSize(W, H);
  roomRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  roomRenderer.setClearColor(0x000000, 0); // transparent — image shows through
  roomRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  roomRenderer.toneMappingExposure = 1.2;

  roomScene = new THREE.Scene();
  // No background — transparent so image shows through
  // Very subtle fog to blend garments into the image atmosphere
  roomScene.fog = new THREE.Fog(0xFFCC88, 600, 3500);

  roomCamera = new THREE.PerspectiveCamera(72, W / H, 1, 8000);
  roomCamera.position.set(0, 60, 700);
  roomCamera.lookAt(0, 40, 0);

  buildGarments();
  startRoomLoop();
}

function buildGarments() {
  // Lights for the garments — warm to match the room image
  roomScene.add(new THREE.AmbientLight(0xFFCC88, 0.8));
  const main = new THREE.PointLight(0xFFBB44, 2.0, 2000);
  main.position.set(0, 300, -100); roomScene.add(main);
  const fill = new THREE.PointLight(0xFFDD99, 1.5, 1500);
  fill.position.set(0, 100, 300); roomScene.add(fill);
  const bounce = new THREE.PointLight(0xC8834A, 0.6, 800);
  bounce.position.set(0, -300, 0); roomScene.add(bounce);

  const ceilY = 400;

  // High-low editorial garment layout
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
  if (grain) {
    grain.width = window.innerWidth; grain.height = window.innerHeight;
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
    drawGrain(); setInterval(drawGrain, 100);
  }
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

      // PARALLAX — garments closer to camera (higher z) drift down
      // as camera pushes forward, reinforcing depth perception
      const depthFactor = 1 - (Math.abs(mesh.userData.baseZ) / 3000);
      mesh.position.y = mesh.userData.baseY - p * depthFactor * 30;

      const tg = roomThreadGeos[i];
      tg.geo.setFromPoints([
        new THREE.Vector3(mesh.position.x, tg.ceilY, tg.baseZ),
        new THREE.Vector3(mesh.position.x, tg.garmentTopY + (mesh.position.y - mesh.userData.baseY), tg.baseZ)
      ]);
    });

    roomRenderer.render(roomScene, roomCamera);
  }
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  if (!roomRenderer) return;
  const W = window.innerWidth, H = window.innerHeight;
  roomCamera.aspect = W / H; roomCamera.updateProjectionMatrix();
  roomRenderer.setSize(W, H);
});
