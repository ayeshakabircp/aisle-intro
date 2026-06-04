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
  el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(6px)';
  setTimeout(() => {
    el.textContent = text;
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, 260);
}

function showPhrase(text) {
  const el = document.getElementById('word-display');
  el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(6px)';
  setTimeout(() => {
    el.textContent = text;
    el.style.transition = 'opacity 0.65s ease, transform 0.65s ease';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, 260);
}

function hideWord() {
  const el = document.getElementById('word-display');
  el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(-8px)';
}

function fadeIn(el, duration, delay) {
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = '0';
  if (el.style.display === 'none') el.style.display = 'block';
  setTimeout(() => {
    el.style.transition = `opacity ${duration}s ease, transform ${duration}s ease`;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, delay || 50);
}

function fadeOut(el, duration) {
  if (!el) return;
  el.style.transition = `opacity ${duration}s ease`;
  el.style.opacity = '0';
}

function runIntro() {
  clearAllTimers();
  window._cameraFreeze = false;
  window._garmentDrop = false;
  window._introComplete = false;
  window._frozenP = null;

  // Reset all
  const wordEl = document.getElementById('word-display');
  wordEl.style.cssText = 'opacity:0;transform:translateY(0);transition:none;';
  wordEl.textContent = '';

  const introText = document.getElementById('introducing-text');
  if (introText) {
    introText.style.cssText = 'opacity:0;transform:translateY(12px);display:none;';
  }

  const aisleReveal = document.getElementById('aisle-reveal');
  aisleReveal.style.cssText = 'opacity:0;transform:translateY(0);transition:none;';

  const scrollInd = document.getElementById('scroll-ind');
  if (scrollInd) scrollInd.style.cssText = 'opacity:0;transition:none;';

  document.getElementById('replay-btn').classList.remove('show');

  // TIMING — all 0.9s gaps → 1.2s, all 1.2s gaps → 1.5s
  // S1: Too(0) many(1.2) options(2.4)
  T(() => showWord('Too'),     0);
  T(() => showWord('many'),    1200);
  T(() => showWord('options'), 2400);

  // gap 1.5s → 3900
  // S2: Too(3.9) little(5.1) time(6.3)
  T(() => showWord('Too'),     3900);
  T(() => showWord('little'),  5100);
  T(() => showWord('time'),    6300);

  // gap 1.5s → 7800
  // S3a: "And never"
  T(() => showPhrase('And never'), 7800);

  // 1.2s pause → 9000
  // S3b: "the right size" + camera freeze
  T(() => {
    showPhrase('the right size');
    window._cameraFreeze = true;
  }, 9000);

  // Word fades at 10500ms
  T(() => hideWord(), 10500);

  // Garments drop at 11000ms
  T(() => { window._garmentDrop = true; }, 11000);

  // "Introducing" at 12500ms
  T(() => {
    const el = document.getElementById('introducing-text');
    if (!el) return;
    el.style.display = 'block';
    el.style.transform = 'translateY(12px)';
    el.style.opacity = '0';
    el.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'opacity 1.4s ease, transform 1.4s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }));
  }, 12500);

  // "Aisle" at 14200ms — Introducing fades out as Aisle comes in
  T(() => {
    const aisle = document.getElementById('aisle-reveal');
    aisle.style.transition = 'opacity 1.6s ease, transform 1.6s ease';
    aisle.style.transform = 'translateY(8px)';
    aisle.style.opacity = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      aisle.style.opacity = '1';
      aisle.style.transform = 'translateY(0)';
    }));

    // Fade out Introducing
    T(() => {
      const intro = document.getElementById('introducing-text');
      if (intro) {
        intro.style.transition = 'opacity 0.8s ease';
        intro.style.opacity = '0';
      }
    }, 500);
  }, 14200);

  // Scroll indicator at 15800ms
  T(() => {
    const scrollInd = document.getElementById('scroll-ind');
    if (scrollInd) {
      scrollInd.style.transition = 'opacity 0.8s ease';
      scrollInd.style.opacity = '1';
    }
    document.getElementById('replay-btn').classList.add('show');
    window._introComplete = true;
  }, 15800);
}

// Called from room.js animate loop
let _dropStarted = false;
function checkGarmentDrop(garmentMeshes) {
  if (!window._garmentDrop || _dropStarted) return;
  _dropStarted = true;
  const startTime = performance.now();
  const startY = garmentMeshes.map(m => m.position.y);

  function drop(now) {
    const t = (now - startTime) / 1000;
    const g = 1200;
    let allGone = true;
    garmentMeshes.forEach((mesh, i) => {
      const dt = Math.max(0, t - i * 0.018);
      mesh.position.y = startY[i] - 0.5 * g * dt * dt;
      const fade = Math.max(0, 1 - Math.max(0, (startY[i] - mesh.position.y - 200) / 300));
      mesh.material.opacity = fade * 0.93;
      if (mesh.position.y > -2000) allGone = false;
    });
    if (!allGone) requestAnimationFrame(drop);
  }
  requestAnimationFrame(drop);
}

function replayIntro() {
  _dropStarted = false;
  window._cameraFreeze = false;
  window._garmentDrop = false;
  window._introComplete = false;
  window._frozenP = null;
  if (typeof roomT0 !== 'undefined') roomT0 = null;
  document.getElementById('replay-btn').classList.remove('show');
  setTimeout(runIntro, 80);
}
