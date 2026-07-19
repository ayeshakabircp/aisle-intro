// ── KIOSK IMAGE HOVER OVERLAYS ──
// Three invisible hotspot zones across the top 3/4 of the kiosk image width
// (1/3 each): mirror | kiosk | trial room. Bottom 1/4 height is excluded
// (that's where the CTA + fog sit). Hovering shows a glass-panel overlay
// with title + body copy; leaving the zone hides it. Only active once the
// kiosk stage is meaningfully revealed (dissolveProgress > ~0.3).

const HOVER_COPY = {
  mirror: {
    title: 'Virtual Try-On',
    body: "See any item on you before you commit — especially useful when your size isn't on the rack. Try it virtually, then have it delivered.",
  },
  kiosk: {
    title: 'Browse & Checkout',
    body: "Describe what you're after and browse the whole store by size, occasion, or fit. Want a second opinion? Aisle tells you what works for your body type. Add to your bag and pay right here, without joining a queue.",
  },
  trial: {
    title: 'Fitting Room',
    body: "Once you've picked a few things, have them sent straight to your fitting room and pick up where you left off. Ask for a different size or colour without stepping out.",
  },
};

let hoverZonesBuilt = false;
let hoverEnabled = false;

function hoverlaysInit() {
  if (hoverZonesBuilt) return;
  hoverZonesBuilt = true;

  const container = document.getElementById('kiosk-hover-zones');
  const zones = ['mirror', 'kiosk', 'trial'];

  zones.forEach((key, i) => {
    const zone = document.createElement('div');
    zone.className = 'hover-zone';
    zone.dataset.zone = key;
    // Each zone is 1/3 of width, top 75% of height (bottom 25% excluded)
    zone.style.left = (i * 33.333) + '%';
    zone.style.width = '33.334%';
    container.appendChild(zone);

    const overlay = document.createElement('div');
    overlay.className = 'hover-overlay';
    overlay.id = `hover-overlay-${key}`;
    overlay.innerHTML = `
      <div class="ho-title">${HOVER_COPY[key].title}</div>
      <div class="ho-body">${HOVER_COPY[key].body}</div>
    `;
    document.body.appendChild(overlay);

    zone.addEventListener('mouseenter', () => {
      if (!hoverEnabled) return;
      overlay.classList.add('show');
    });
    zone.addEventListener('mouseleave', () => {
      overlay.classList.remove('show');
    });
  });
}

// Called from particles.js dissolve loop — only allow hover interaction once
// the kiosk stage is meaningfully revealed (matches fog's own gating point).
function hoverlaysSetEnabled(v) {
  hoverEnabled = v;
  if (!v) {
    document.querySelectorAll('.hover-overlay.show').forEach(el => el.classList.remove('show'));
  }
}
