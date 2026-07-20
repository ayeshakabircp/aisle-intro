// ── CORRIDOR-ONLY GRAIN ──
// A dedicated grain layer visible only over video 1 (the corridor push),
// at 30% strength, fading to 0 in sync with the garment/environment fade-out
// so the corridor's texture dissolves into the blinding light along with
// everything else — reinforcing that garments and video share one environment.
// Independent from the existing subtle global #grain-canvas, which is untouched.

let cgCanvas, cgCtx;
let cgOpacity = 0;
let cgInterval = null;

function cgInit() {
  cgCanvas = document.getElementById('corridor-grain-canvas');
  if (!cgCanvas) return;
  cgCtx = cgCanvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    cgCanvas.width = window.innerWidth * dpr;
    cgCanvas.height = window.innerHeight * dpr;
    cgCanvas.style.width = window.innerWidth + 'px';
    cgCanvas.style.height = window.innerHeight + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    if (cgOpacity <= 0.001) return;
    const w = cgCanvas.width, h = cgCanvas.height;
    const imgData = cgCtx.createImageData(w, h);
    const buf = imgData.data;
    for (let i = 0; i < buf.length; i += 4) {
      const v = 200 + Math.random() * 55;
      buf[i] = v;
      buf[i + 1] = v * 0.94;
      buf[i + 2] = v * 0.82;
      buf[i + 3] = Math.random() * 40;
    }
    cgCtx.putImageData(imgData, 0, 0);
    cgCanvas.style.opacity = String(cgOpacity);
  }

  cgInterval = setInterval(draw, 150);
  draw();
}

let cgFadeRAF = null;
function cgFadeTo(target, durationSec) {
  if (cgFadeRAF) cancelAnimationFrame(cgFadeRAF);
  const start = cgOpacity;
  const t0 = performance.now();
  const durMs = Math.max(durationSec, 0.01) * 1000;
  function step(now) {
    const p = Math.min((now - t0) / durMs, 1);
    cgOpacity = start + (target - start) * p;
    if (cgCanvas) cgCanvas.style.opacity = String(cgOpacity);
    if (p < 1) cgFadeRAF = requestAnimationFrame(step);
  }
  cgFadeRAF = requestAnimationFrame(step);
}

function cgReset() {
  if (cgFadeRAF) cancelAnimationFrame(cgFadeRAF);
  cgOpacity = 0;
  if (cgCanvas) cgCanvas.style.opacity = '0';
}
