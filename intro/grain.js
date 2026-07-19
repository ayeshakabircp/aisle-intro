// ── GRAIN OVERLAY ──
(function () {
  const canvas = document.getElementById('grain-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  function drawGrain() {
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const buf = imgData.data;
    for (let i = 0; i < buf.length; i += 4) {
      const v = 200 + Math.random() * 55; // warm-biased noise
      buf[i] = v;
      buf[i + 1] = v * 0.94;
      buf[i + 2] = v * 0.82;
      buf[i + 3] = Math.random() * 40;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  setInterval(drawGrain, 150);
  drawGrain();
})();
