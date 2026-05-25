// grain.js — animated film grain overlay
function initGrain() {
  const grain = document.createElement('canvas');
  grain.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;opacity:0.04;z-index:100;';
  document.body.appendChild(grain);

  function resize() {
    grain.width = window.innerWidth;
    grain.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const ctx = grain.getContext('2d');
  function draw() {
    const W = grain.width, H = grain.height;
    const id = ctx.createImageData(W, H);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i]   = Math.min(255, v + 30); // warm tint
      d[i+1] = Math.min(255, v + 12);
      d[i+2] = Math.round(v * 0.6);
      d[i+3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }
  draw();
  setInterval(draw, 100);
}
