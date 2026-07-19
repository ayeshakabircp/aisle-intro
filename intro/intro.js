let introTimers = [];
window._introComplete = false;
window._cameraFreeze = false;
window._garmentDrop = false;

function T(fn, ms) {
  const id = setTimeout(fn, ms);
  introTimers.push(id);
}

function clearAllTimers() {
  introTimers.forEach(clearTimeout);
  introTimers = [];
}

function showWord(text) {
  const el = document.getElementById('word-display');
  el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  setTimeout(() => {
    el.textContent = text;
    el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, 320);
}

function showPhrase(text) {
  const el = document.getElementById('word-display');
  el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  setTimeout(() => {
    el.textContent = text;
    el.style.transition = 'opacity 1.0s ease, transform 1.0s ease';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, 320);
}

function hideWord() {
  const el = document.getElementById('word-display');
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(-6px)';
}

function runIntro() {
  clearAllTimers();
  window._cameraFreeze = false;
  window._garmentDrop = false;
  window._introComplete = false;
  window._frozenP = null;

  // Reset all elements
  const wordEl = document.getElementById('word-display');
  wordEl.style.cssText = 'opacity:0;transform:translateY(0);transition:none;';
  wordEl.textContent = '';

  const introText = document.getElementById('introducing-text');
  if (introText) {
    introText.style.cssText = 'opacity:0;transform:translateY(10px);display:none;';
  }

  const aisleReveal = document.getElementById('aisle-reveal');
  aisleReveal.style.cssText = 'opacity:0;transform:translateY(8px);transition:none;';

  const aisleSubEl = document.getElementById('aisle-sub');
  if (aisleSubEl) aisleSubEl.style.cssText = 'opacity:0;transition:none;';

  const scrollInd = document.getElementById('scroll-ind');
  if (scrollInd) scrollInd.style.cssText = 'opacity:0;transition:none;';

  document.getElementById('replay-btn').classList.remove('show');

  // ── SEQUENCE ──
  // S1
  T(() => showWord('Too'),        1500);
  T(() => showWord('many'),       3000);
  T(() => showWord('options'),    4500);

  // S2 — longer breath
  T(() => showWord('Too'),        6500);
  T(() => showWord('little'),     8000);
  T(() => showWord('time'),       9500);

  // S3 — long breath before final phrase
  T(() => showPhrase('And never'),       11500);
  T(() => {
    showPhrase('the right size');
    // Camera begins slowing at this point — handled via _cameraSlow flag
    window._cameraSlow = true;
  }, 13500);

  // Camera fully stops 1s after "the right size"
  T(() => { window._cameraFreeze = true; }, 14500);

  // Word fades
  T(() => hideWord(), 15500);

  // Garments drop
  T(() => { window._garmentDrop = true; }, 16500);

  // "Introducing" fades in
  T(() => {
    const el = document.getElementById('introducing-text');
    if (!el) return;
    el.style.display = 'block';
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'opacity 1.6s ease, transform 1.6s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }));
  }, 18500);

  // "Aisle" fades in, Introducing fades out
  T(() => {
    const aisle = document.getElementById('aisle-reveal');
    aisle.style.transition = 'opacity 1.8s ease, transform 1.8s ease';
    aisle.style.transform = 'translateY(0)';
    aisle.style.opacity = '1';

    // Fade out Introducing slightly after
    T(() => {
      const intro = document.getElementById('introducing-text');
      if (intro) {
        intro.style.transition = 'opacity 1.0s ease';
        intro.style.opacity = '0';
      }
    }, 600);
  }, 21000);

  // Subtext + scroll indicator at 22s
  T(() => {
    const sub = document.getElementById('aisle-sub');
    if (sub) {
      sub.style.transition = 'opacity 1.2s ease';
      sub.style.opacity = '1';
    }
    const scrollInd = document.getElementById('scroll-ind');
    if (scrollInd) {
      scrollInd.style.transition = 'opacity 1.2s ease';
      scrollInd.style.opacity = '1';
    }
    document.getElementById('replay-btn').classList.add('show');
    window._introComplete = true;
  }, 22000);
}

// Garment drop — called from room.js animate loop
let _dropStarted = false;
function checkGarmentDrop(garmentMeshes) {
  if (!window._garmentDrop || _dropStarted) return;
  _dropStarted = true;
  const startTime = performance.now();
  const startY = garmentMeshes.map(m => m.position.y);

  function drop(now) {
    const t = (now - startTime) / 1000;
    const g = 900; // gentle gravity
    let allGone = true;
    garmentMeshes.forEach((mesh, i) => {
      const dt = Math.max(0, t - i * 0.025); // gentle stagger
      mesh.position.y = startY[i] - 0.5 * g * dt * dt;
      const fadeStart = startY[i] - 150;
      if (mesh.position.y < fadeStart) {
        mesh.material.opacity = Math.max(0, 0.93 - (fadeStart - mesh.position.y) / 400);
      }
      if (mesh.position.y > -2000) allGone = false;
    });
    if (!allGone) requestAnimationFrame(drop);
  }
  requestAnimationFrame(drop);
}

function replayIntro() {
  _dropStarted = false;
  window._cameraFreeze = false;
  window._cameraSlow = false;
  window._garmentDrop = false;
  window._introComplete = false;
  window._frozenP = null;
  if (typeof roomT0 !== 'undefined') roomT0 = null;
  document.getElementById('replay-btn').classList.remove('show');
  setTimeout(runIntro, 80);
}
