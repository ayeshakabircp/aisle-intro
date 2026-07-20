// ── BOOT ──
window._garmentsReady = false;

window.addEventListener('load', () => {
  // Textures load in the background — flips a flag once ready. The video and
  // full sequence start immediately regardless; only the garment fade-in
  // (inside intro.js) checks this flag so garments never pop in half-loaded.
  if (typeof g3Init === 'function') {
    g3Init(() => { window._garmentsReady = true; });
  }
  if (typeof cgInit === 'function') cgInit();
  if (typeof hoverlaysInit === 'function') hoverlaysInit();

  // Prototype-only deep link: ?state=kiosk jumps straight to the settled
  // kiosk-reveal frame (used by the "back" icon on /app/index.html) instead
  // of autoplaying the full corridor sequence from scratch.
  const params = new URLSearchParams(location.search);
  if (params.get('state') === 'kiosk' && typeof skipToEnd === 'function') {
    skipToEnd();
  } else {
    runIntro();
  }

  // Poll for the sequence settling so we can arm the scroll-particle listener
  const armCheck = setInterval(() => {
    if (window._introComplete) {
      armParticleListener();
    }
  }, 300);
});
