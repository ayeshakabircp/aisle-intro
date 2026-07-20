// ── BIDIRECTIONAL SCROLL PARTICLE DISSOLVE ──
// Scroll position drives a dissolve progress value (0 = fully formed
// text+champagne+scroll-indicator, 1 = fully dispersed / image+CTA visible).
// Scrolling down increases progress, up decreases it — fully reversible.
// Armed only once _introComplete (settled kiosk-reveal stage).

let particleArmed = false;
let dissolveProgress = 0;
let dissolveTarget = 0;
let particleRAF = null;
let particleField = [];
let particlesBuilt = false;

const SCROLL_RANGE = 600;
let scrollAccum = 0;

function armParticleListener() {
  if (particleArmed) return;
  particleArmed = true;
  window.addEventListener('wheel', onScroll, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
}

function disarmParticleListener() {
  particleArmed = false;
  window.removeEventListener('wheel', onScroll);
  window.removeEventListener('touchstart', onTouchStart);
  window.removeEventListener('touchmove', onTouchMove);
  dissolveProgress = 0;
  dissolveTarget = 0;
  scrollAccum = 0;
  particlesBuilt = false;
  particleField = [];
  const canvas = document.getElementById('particle-canvas');
  if (canvas) {
    canvas.style.opacity = '0';
    const ctx = canvas.getContext('2d');
    ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  restoreTextVisibility();
}

function restoreTextVisibility() {
  ['aisle-name', 'aisle-sub'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.opacity = '';
  });
  const backing = document.getElementById('aisle-backing');
  if (backing) backing.style.opacity = '';
  const si = document.getElementById('scroll-ind');
  if (si) si.style.opacity = '';
  document.getElementById('view-proto-btn').classList.remove('show');
}

function onScroll(e) {
  if (!window._introComplete) return;
  scrollAccum += e.deltaY;
  scrollAccum = Math.max(0, Math.min(scrollAccum, SCROLL_RANGE));
  dissolveTarget = scrollAccum / SCROLL_RANGE;
  ensureBuilt();
  animateTo(dissolveTarget);
}

let touchStartY = 0;
function onTouchStart(e) { touchStartY = e.touches[0].clientY; }
function onTouchMove(e) {
  if (!window._introComplete) return;
  const dy = touchStartY - e.touches[0].clientY;
  touchStartY = e.touches[0].clientY;
  scrollAccum += dy * 1.6;
  scrollAccum = Math.max(0, Math.min(scrollAccum, SCROLL_RANGE));
  dissolveTarget = scrollAccum / SCROLL_RANGE;
  ensureBuilt();
  animateTo(dissolveTarget);
}

// ── Build the particle field once (text + backing + scroll indicator) ──
// Guarded on document.fonts.ready — if the custom font (Italiana) hasn't
// actually finished loading in the render engine at the exact moment this
// runs, the offscreen canvas samples against wrong/fallback glyph metrics,
// producing few or no matching pixels — the text fades via opacity with no
// particle representation, while other elements (system-ish fonts, always
// available) sample fine. This was almost certainly the real cause.
function ensureBuilt() {
  if (particlesBuilt) return;
  particlesBuilt = true;

  const build = () => buildParticleField();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(build).catch(build);
  } else {
    build();
  }
}

function buildParticleField() {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  particleField = [];

  // ── Champagne backing: full-screen field, denser than before ──
  const backing = document.getElementById('aisle-backing');
  if (backing) {
    const rect = backing.getBoundingClientRect();
    const step = 5; // was 8 (then 14) — denser again for a smoother, more dramatic dissolve
    for (let y = 0; y < rect.height; y += step) {
      for (let x = 0; x < rect.width; x += step) {
        particleField.push({
          ox: rect.left + x, oy: rect.top + y,
          seedX: (Math.random() - 0.5) * 1.0,
          seedY: -(Math.random() * 2.4 + 1.6),
          size: 1 + Math.random() * 1.3,
          color: '#EACEAA',
          baseLife: 0.55 + Math.random() * 0.2,
        });
      }
    }
  }

  // ── Text + scroll indicator: rasterize glyphs/icon into particle masks ──
  ['aisle-name', 'aisle-sub'].forEach(id => {
    sampleTextElement(id, 1.4); // was 2 (then 3) — denser again
  });

  // Scroll indicator — sample its bounding box as a solid field (label +
  // track + arrow read fine as a compact particle cluster, no need to
  // rasterize each sub-element separately).
  const si = document.getElementById('scroll-ind');
  if (si && si.offsetWidth > 0) {
    const rect = si.getBoundingClientRect();
    const step = 3; // was 4 — denser
    for (let y = 0; y < rect.height; y += step) {
      for (let x = 0; x < rect.width; x += step) {
        particleField.push({
          ox: rect.left + x, oy: rect.top + y,
          seedX: (Math.random() - 0.5) * 1.0,
          seedY: -(Math.random() * 2.6 + 1.8),
          size: 0.8 + Math.random() * 1.2,
          color: '#311B0E',
          baseLife: 0.85,
        });
      }
    }
  }
}

function sampleTextElement(id, step) {
  const el = document.getElementById(id);
  if (!el || el.offsetWidth === 0) return;
  const rect = el.getBoundingClientRect();
  const off = document.createElement('canvas');
  off.width = rect.width; off.height = rect.height;
  const octx = off.getContext('2d');
  const cs = getComputedStyle(el);
  octx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  octx.fillStyle = '#311B0E';
  octx.textBaseline = 'middle';
  octx.textAlign = 'center';
  octx.fillText(el.textContent, rect.width / 2, rect.height / 2);

  const img = octx.getImageData(0, 0, off.width, off.height).data;
  for (let y = 0; y < off.height; y += step) {
    for (let x = 0; x < off.width; x += step) {
      const idx = (y * off.width + x) * 4;
      if (img[idx + 3] > 80) {
        particleField.push({
          ox: rect.left + x, oy: rect.top + y,
          seedX: (Math.random() - 0.5) * 1.2,
          seedY: -(Math.random() * 3 + 2),
          size: 1 + Math.random() * 1.5,
          color: '#311B0E',
          baseLife: 1,
        });
      }
    }
  }
}

function animateTo(target) {
  if (particleRAF) cancelAnimationFrame(particleRAF);
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');

  function step() {
    dissolveProgress += (dissolveTarget - dissolveProgress) * 0.12;
    if (Math.abs(dissolveProgress - dissolveTarget) < 0.002) dissolveProgress = dissolveTarget;

    render(ctx, dissolveProgress);

    // Original elements fade out on a front-loaded curve that finishes by
    // ~30% scroll progress — matching how quickly their particles ramp to
    // full brightness (see render()'s alpha formula). Without this, the
    // original crisp text and its fully-bright particle cloud were both
    // visible simultaneously for a long stretch, reading as "not dispersing".
    const FADE_OUT_FRAC = 0.3;
    const formedOpacity = Math.max(0, 1 - dissolveProgress / FADE_OUT_FRAC);
    document.getElementById('aisle-name').style.opacity = String(formedOpacity * 0.9);
    document.getElementById('aisle-sub').style.opacity = String(formedOpacity * 0.9);
    const backing = document.getElementById('aisle-backing');
    if (backing) backing.style.opacity = String(formedOpacity * 0.95);
    const si = document.getElementById('scroll-ind');
    if (si) si.style.opacity = String(formedOpacity * 0.85);

    const cta = document.getElementById('view-proto-btn');
    if (dissolveProgress > 0.7) cta.classList.add('show');
    else cta.classList.remove('show');

    // Hover overlays only become active once the champagne/text has
    // meaningfully dispersed — never while the corridor/aisle stage is
    // still dominant.
    if (typeof hoverlaysSetEnabled === 'function') {
      hoverlaysSetEnabled(dissolveProgress > 0.3);
    }

    canvas.style.opacity = dissolveProgress > 0.01 && dissolveProgress < 0.99 ? '1' : '0';

    if (dissolveProgress !== dissolveTarget) {
      particleRAF = requestAnimationFrame(step);
    }
  }
  step();
}

function render(ctx, progress) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (progress <= 0.001) return;

  particleField.forEach(p => {
    const travel = progress * 90;
    const x = p.ox + p.seedX * travel;
    const y = p.oy + p.seedY * travel * 0.6 - (progress * progress * 40);
    const alpha = p.baseLife * Math.max(0, 1 - progress * 0.15) * Math.min(1, progress * 4) * (1 - Math.max(0, progress - 0.85) / 0.15);

    if (alpha <= 0.01) return;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}
