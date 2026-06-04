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
    el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
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
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
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

function runIntro() {
  clearAllTimers();
  window._cameraFreeze = false;
  window._garmentDrop = false;
  window._introComplete = false;

  const wordEl = document.getElementById('word-display');
  wordEl.style.cssText = 'opacity:0;transform:translateY(0);transition:none;';
  wordEl.textContent = '';

  document.getElementById('s3-line').style.cssText = 'opacity:0;';
  document.getElementById('intro-wrap').style.opacity = '0';
  document.getElementById('aisle-reveal').style.opacity = '0';
  const introText = document.getElementById('introducing-text');
  if (introText) { introText.style.opacity = '0'; introText.style.display = 'none'; }
  const scrollInd = document.getElementById('scroll-ind');
  if (scrollInd) scrollInd.style.opacity = '0';

  // S1 — Too(0) many(0.9) options(1.8)
  T(() => showWord('Too'),     0);
  T(() => showWord('many'),    900);
  T(() => showWord('options'), 1800);

  // gap 1.2s → 3000
  // S2 — Too(3.0) little(3.9) time(4.8)
  T(() => showWord('Too'),     3000);
  T(() => showWord('little'),  3900);
  T(() => showWord('time'),    4800);

  // gap 1.2s → 6000
  // S3a — "And never"
  T(() => showPhrase('And never'), 6000);

  // 0.9s pause → 6900
  // S3b — "the right size" + camera freeze
  T(() => {
    showPhrase('the right size');
    window._cameraFreeze = true;
  }, 6900);

  // 1s camera freeze, word fades at 8200ms
  T(() => hideWord(), 8200);

  // Garments drop at 8900ms
  T(() => { window._garmentDrop = true; }, 8900);

  // "Introducing" at 10200ms
  T(() => {
    const el = document.getElementById('introducing-text');
    if (!el) return;
    el.style.display = 'block';
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'opacity 1.2s ease, transform 1.2s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }));
  }, 10200);

  // "Aisle" at 11800ms, Introducing fades
  T(() => {
    const aisle = document.getElementById('aisle-reveal');
    aisle.style.transition = 'opacity 1.4s ease';
    aisle.style.opacity = '1';
    const intro = document.getElementById('introducing-text');
    if (intro) {
      setTimeout(() => {
        intro.style.transition = 'opacity 0.8s ease';
        intro.style.opacity = '0';
      }, 400);
    }
  }, 11800);

  // Scroll indicator + replay at 13200ms
  T(() => {
    const scrollInd = document.getElementById('scroll-ind');
    if (scrollInd) {
      scrollInd.style.transition = 'opacity 0.6s ease';
      scrollInd.style.opacity = '1';
    }
    document.getElementById('replay-btn').classList.add('show');
    window._introComplete = true;
  }, 13200);
}

// Called every frame from room.js animate loop
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
  if (typeof roomT0 !== 'undefined') roomT0 = null;
  document.getElementById('replay-btn').classList.remove('show');
  setTimeout(runIntro, 80);
}
