// ── AISLE INTRO SEQUENCER ──
// Video (corridor, ~19.96s) -> white flash -> champagne backing -> text appears
// -> kiosk image reveals underneath (champagne stays at 75% until scroll disperses).
// Garments are a transparent Three.js overlay with real depth, camera-synced to
// the corridor video's own push timing.

const $ = id => document.getElementById(id);

let introTimers = [];
let sequenceState = 'idle'; // idle | playing | settled
let viewProtoTriggered = false;
window._introComplete = false;

function T(fn, ms) { introTimers.push(setTimeout(fn, ms)); }
function clearAllTimers() { introTimers.forEach(clearTimeout); introTimers = []; }

// ── SCALED TIMELINE (ms) ──
const SCALE = 19958 / 22000;
const TL = {
  too1:      1500 * SCALE,
  many1:     3000 * SCALE,
  options1:  4500 * SCALE,
  too2:      6500 * SCALE,
  little:    8000 * SCALE,
  time:      9500 * SCALE,
  andNever: 11500 * SCALE,
  rightSize:13500 * SCALE,
  fadeStart:16000 * SCALE,  // word + garments begin fading out with the building light
  fadeDur:   1500 * SCALE,
  videoEnd: 19958,
  camPushEnd: 13500 * SCALE, // legacy marker, kept for reference
  camDriveDur: 19958,        // garment camera now drives for the FULL video length
};

function showWord(text) {
  const el = $('word-display');
  el.classList.remove('visible');
  setTimeout(() => {
    el.textContent = text;
    el.classList.add('visible');
  }, 300);
}

// Explicitly clear every inline style the particle dissolve may have left
// behind on these elements — classList alone isn't enough since the dissolve
// sets opacity/transform directly, which otherwise silently survives a replay.
function hardResetElement(el) {
  el.style.opacity = '';
  el.style.transform = '';
  el.style.transition = 'none';
}

function resetAll() {
  clearAllTimers();
  sequenceState = 'idle';
  window._introComplete = false;

  const wordEl = $('word-display');
  wordEl.classList.remove('visible');
  hardResetElement(wordEl);
  wordEl.textContent = '';

  const it = $('introducing-text');
  it.classList.remove('visible');
  hardResetElement(it);
  it.style.display = 'none';

  const aisleReveal = $('aisle-reveal');
  hardResetElement(aisleReveal);
  aisleReveal.style.opacity = '0';

  const aisleName = $('aisle-name');
  hardResetElement(aisleName);

  const aisleSub = $('aisle-sub');
  aisleSub.classList.remove('visible');
  hardResetElement(aisleSub);

  const scrollInd = $('scroll-ind');
  scrollInd.classList.remove('visible');
  hardResetElement(scrollInd);

  const backing = $('aisle-backing');
  backing.classList.remove('visible');
  hardResetElement(backing);

  $('view-proto-btn').classList.remove('show');

  const pc = $('particle-canvas');
  pc.style.opacity = '0';
  const pctx = pc.getContext('2d');
  pctx && pctx.clearRect(0, 0, pc.width, pc.height);

  // Re-arm the scroll-particle system for this run
  disarmParticleListener();

  if (typeof g3Reset === 'function') g3Reset();
  if (typeof kfSetVisible === 'function') kfSetVisible(false);
  if (typeof hoverlaysSetEnabled === 'function') hoverlaysSetEnabled(false);

  const vc = $('video-corridor');
  vc.style.opacity = '1'; vc.currentTime = 0;

  const kioskLayer = $('kiosk-layer');
  kioskLayer.style.transition = 'none';
  kioskLayer.style.transform = 'scale(1)';
  kioskLayer.style.opacity = '0';

  const glow = $('screen-glow');
  glow.style.transition = 'none';
  glow.style.opacity = '0';
  glow.style.filter = 'blur(2px)';

  $('view-proto-btn').style.opacity = '';
  $('view-proto-btn').style.transition = '';
  $('skip-replay-btn').style.opacity = '';
  $('skip-replay-btn').style.transition = '';
  viewProtoTriggered = false;
  $('white-flash').style.cssText = 'opacity:0;transition:none;';

  $('skip-replay-btn').textContent = 'Skip Intro';
}

function runIntro() {
  resetAll();
  sequenceState = 'playing';

  const vc = $('video-corridor');
  vc.play().catch(() => {});

  // ── Drive the 3D garment camera through the FULL video — never stops early ──
  const camStart = performance.now();
  const camDur = TL.camDriveDur;
  function driveGarmentCamera(now) {
    const p = Math.min((now - camStart) / camDur, 1);
    if (typeof g3SetCameraProgress === 'function') g3SetCameraProgress(p);
    if (p < 1 && sequenceState === 'playing') requestAnimationFrame(driveGarmentCamera);
  }
  requestAnimationFrame(driveGarmentCamera);

  // ── S1 ──
  T(() => showWord('Too'),     TL.too1);
  T(() => showWord('many'),    TL.many1);
  T(() => showWord('options'), TL.options1);

  // ── S2 ──
  T(() => showWord('Too'),     TL.too2);
  T(() => showWord('little'),  TL.little);
  T(() => showWord('time'),    TL.time);

  // ── S3 ──
  T(() => showWord('And never'),      TL.andNever);
  T(() => showWord('the right size'), TL.rightSize);

  // Garments fade in from the very start of the video — but only once
  // textures are actually loaded, so they never appear half-rendered.
  T(() => {
    function tryFadeIn() {
      if (window._garmentsReady) {
        if (typeof g3FadeTo === 'function') g3FadeTo(1, 1.2);
      } else {
        requestAnimationFrame(tryFadeIn);
      }
    }
    tryFadeIn();
  }, 0);

  // ── Word fades with the light-build (unchanged) ──
  T(() => {
    const el = $('word-display');
    el.classList.remove('visible');
  }, TL.fadeStart);

  // ── Garments: stay visible and moving until the video is genuinely about to
  //     go white — dissolve INTO the blinding light, not before it starts ──
  T(() => {
    if (typeof g3FadeTo === 'function') g3FadeTo(0, (TL.videoEnd - TL.fadeStart - 500) / 1000);
  }, TL.fadeStart + 500);

  // ── "Introducing" appears as corridor video approaches its white end ──
  T(() => {
    const el = $('introducing-text');
    el.style.display = 'block';
    el.classList.remove('visible');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('visible');
    }));
  }, TL.fadeStart + 900);

  // ── Handoff: corridor video ends on white -> champagne -> text -> kiosk reveal ──
  T(() => handoffSequence(), TL.videoEnd - 60);
}

function handoffSequence() {
  const vc = $('video-corridor');

  // The corridor video's own final frame IS the blinding white — hold a white-flash
  // div at full opacity over it for a clean, guaranteed-solid handoff frame.
  const wf = $('white-flash');
  wf.style.transition = 'opacity 0.3s ease';
  wf.style.opacity = '1';

  setTimeout(() => { vc.pause(); }, 300);

  // "Introducing" fades as we move toward the champagne stage — then is
  // physically hidden (display:none) once the fade completes, so it can
  // never linger invisible-but-present and overlap anything drawn later.
  const introEl = $('introducing-text');
  introEl.classList.remove('visible');
  T(() => { introEl.style.display = 'none'; }, 950);

  // ── STEP 1: white fades to reveal flat champagne (NOT the kiosk image yet) ──
  T(() => {
    $('aisle-backing').classList.add('visible');
    wf.style.transition = 'opacity 1.1s ease';
    wf.style.opacity = '0';
  }, 300);

  // ── STEP 2: text appears over the champagne ──
  T(() => {
    const a = $('aisle-reveal');
    a.style.transition = 'opacity 1.5s ease';
    a.style.opacity = '1';
  }, 1600);

  T(() => {
    $('aisle-sub').classList.add('visible');
  }, 2800);

  T(() => {
    $('scroll-ind').classList.add('visible');
  }, 3200);

  // ── STEP 3: kiosk image reveals underneath (champagne + text stay on top) ──
  T(() => {
    const kl = $('kiosk-layer');
    kl.style.transition = 'opacity 1.4s ease';
    kl.style.opacity = '1';
  }, 3600);

  T(() => {
    sequenceState = 'settled';
    window._introComplete = true;
    $('skip-replay-btn').textContent = 'Replay';
    // NOTE: view-proto-btn intentionally NOT shown here — it only appears
    // after the user scrolls to disperse the champagne/text and reveal the
    // kiosk image + CTA underneath (see particles.js).
  }, 5000);
}

// ── SKIP INTRO / REPLAY ──
function handleSkipReplay() {
  if (sequenceState === 'settled') {
    replayIntro();
  } else {
    skipToEnd();
  }
}

function skipToEnd() {
  clearAllTimers();
  if (typeof g3FadeTo === 'function') g3FadeTo(0, 0.01);

  const vc = $('video-corridor');
  vc.pause(); vc.style.opacity = '0';

  $('white-flash').style.cssText = 'opacity:0;transition:none;';
  $('kiosk-layer').style.opacity = '1';

  $('word-display').classList.remove('visible');
  $('introducing-text').classList.remove('visible');
  $('introducing-text').style.display = 'none';

  const a = $('aisle-reveal');
  hardResetElement(a);
  a.style.opacity = '1';

  const aisleName = $('aisle-name');
  hardResetElement(aisleName);

  $('aisle-sub').classList.add('visible');
  $('aisle-backing').classList.add('visible');
  $('scroll-ind').classList.add('visible');

  $('skip-replay-btn').textContent = 'Replay';
  sequenceState = 'settled';
  window._introComplete = true;
}

function replayIntro() {
  setTimeout(runIntro, 60);
}

// ── VIEW PROTOTYPE — kiosk screen glow + zoom + white flash, then navigate ──
function handleViewPrototype() {
  if (viewProtoTriggered) return;
  viewProtoTriggered = true;

  const glow = $('screen-glow');
  const kiosk = $('kiosk-layer');
  const wf = $('white-flash');
  const DUR = 800; // ms, matches the 0.8s spec exactly

  // Fade out the UI chrome so nothing else competes with the transition
  $('view-proto-btn').style.transition = 'opacity 0.3s ease';
  $('view-proto-btn').style.opacity = '0';
  $('skip-replay-btn').style.transition = 'opacity 0.3s ease';
  $('skip-replay-btn').style.opacity = '0';

  // Glow starts soft, intensifies across the full 0.8s
  glow.style.transition = `opacity ${DUR}ms ease-in, filter ${DUR}ms ease-in`;
  glow.style.opacity = '0.35';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    glow.style.opacity = '1';
    glow.style.filter = 'blur(0.5px) brightness(1.3)';
  }));

  // Kiosk image zooms toward the screen's center over the same window
  kiosk.style.transition = `transform ${DUR}ms cubic-bezier(0.55,0,0.85,0.35)`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    kiosk.style.transform = 'scale(2.6)';
  }));

  // White builds through the back half of the 0.8s, fully opaque by the end
  setTimeout(() => {
    wf.style.transition = `opacity ${DUR * 0.55}ms ease-in`;
    wf.style.opacity = '1';
  }, DUR * 0.35);

  // Navigate once fully white — same tab, per spec
  setTimeout(() => {
    location.href = 'https://aisle-intro.vercel.app/app/';
  }, DUR);
}
