/* ===== FLOATING CUTOUTS — overlay on poster phase ===== */
(function () {
  // --- Configuration ---
  const MIN_SIZE = 100;
  const MAX_SIZE = 180;
  const MIN_SPEED = 0.15;
  const MAX_SPEED = 0.6;
  const MOUSE_RADIUS = 120;
  const MOUSE_FORCE = 3;
  const EDGE_BOUNCE_DAMPING = 0.9;

  // --- State ---
  let canvas, ctx;
  let width, height;
  let mouseX = -9999, mouseY = -9999;
  const cutouts = [];
  const images = [];
  let running = false;

  function randomBetween(a, b) { return a + Math.random() * (b - a); }

  // --- Create the canvas and inject it into #poster-phase ---
  function createCanvas() {
    canvas = document.createElement('canvas');
    canvas.id = 'floating-cutouts-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:501;pointer-events:none;width:100%;height:100%;';
    ctx = canvas.getContext('2d');
  }

  function resize() {
    if (!canvas) return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  // --- Mouse tracking ---
  window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  window.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });
  window.addEventListener('touchmove', e => {
    const t = e.touches[0];
    mouseX = t.clientX;
    mouseY = t.clientY;
  }, { passive: true });
  window.addEventListener('touchend', () => { mouseX = -9999; mouseY = -9999; });
  window.addEventListener('resize', resize);

  // --- Load cutout images ---
  function loadImages(basePath) {
    fetch(basePath + 'cutouts/manifest.json')
      .then(r => r.json())
      .then(files => {
        let loaded = 0;
        const paths = files.map(f => basePath + 'cutouts/' + f);
        if (paths.length === 0) { spawnCutouts(); return; }
        paths.forEach(src => {
          const img = new Image();
          img.onload = () => {
            images.push(img);
            loaded++;
            if (loaded === paths.length) spawnCutouts();
          };
          img.onerror = () => {
            loaded++;
            if (loaded === paths.length) spawnCutouts();
          };
          img.src = src;
        });
      })
      .catch(() => {
        console.log('No cutouts manifest found at ' + basePath);
        spawnCutouts();
      });
  }

  function spawnCutouts() {
    if (!canvas) return;
    resize();
    const count = images.length || 0;
    if (count === 0) return;
    for (let i = 0; i < count; i++) {
      const size = randomBetween(MIN_SIZE, MAX_SIZE);
      const angle = Math.random() * Math.PI * 2;
      const speed = randomBetween(MIN_SPEED, MAX_SPEED);
      cutouts.push({
        x: randomBetween(size, width - size),
        y: randomBetween(size, height - size),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: size,
        img: images[i]
      });
    }
  }

  // --- Physics ---
  function update() {
    for (const c of cutouts) {
      const dx = c.x - mouseX;
      const dy = c.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
        c.vx += (dx / dist) * force;
        c.vy += (dy / dist) * force;
      }
      c.x += c.vx;
      c.y += c.vy;
      c.vx *= 0.995;
      c.vy *= 0.995;
      const spd = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
      if (spd < MIN_SPEED) {
        const scale = MIN_SPEED / (spd || 1);
        c.vx *= scale;
        c.vy *= scale;
      }
      const half = c.size / 2;
      if (c.x - half < 0)      { c.x = half;         c.vx = Math.abs(c.vx) * EDGE_BOUNCE_DAMPING; }
      if (c.x + half > width)  { c.x = width - half; c.vx = -Math.abs(c.vx) * EDGE_BOUNCE_DAMPING; }
      if (c.y - half < 0)      { c.y = half;         c.vy = Math.abs(c.vy) * EDGE_BOUNCE_DAMPING; }
      if (c.y + half > height) { c.y = height - half; c.vy = -Math.abs(c.vy) * EDGE_BOUNCE_DAMPING; }
    }
  }

  // --- Draw ---
  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const c of cutouts) {
      ctx.save();
      ctx.translate(c.x, c.y);

      if (c.img) {
        const aspect = c.img.width / c.img.height;
        let w, h;
        if (aspect > 1) { w = c.size; h = c.size / aspect; }
        else            { h = c.size; w = c.size * aspect; }

        const pad = 20;
        const offW = Math.ceil(w + pad * 2);
        const offH = Math.ceil(h + pad * 2);

        if (!c._glowCanvas) {
          const off = document.createElement('canvas');
          off.width = offW;
          off.height = offH;
          const octx = off.getContext('2d');
          octx.drawImage(c.img, pad, pad, w, h);
          octx.globalCompositeOperation = 'source-in';
          octx.fillStyle = 'white';
          octx.fillRect(0, 0, offW, offH);
          octx.globalCompositeOperation = 'source-over';
          c._glowCanvas = off;
        }

        ctx.save();
        ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.drawImage(c._glowCanvas, -w / 2 - pad, -h / 2 - pad);
        ctx.drawImage(c._glowCanvas, -w / 2 - pad, -h / 2 - pad);
        ctx.restore();

        ctx.drawImage(c.img, -w / 2, -h / 2, w, h);
      }

      ctx.restore();
    }
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // --- Public API: called by poster.js when poster is shown ---
  window.startFloatingCutouts = function () {
    if (running) return;
    createCanvas();
    document.getElementById('poster-phase').appendChild(canvas);
    resize();
    running = true;

    // Work out the base path to the alternative-std folder relative to the current page
    // Each puzzle page is at e.g. /crossword/index.html, so ../alternative-std/
    const basePath = '../alternative-std/';
    loadImages(basePath);
    requestAnimationFrame(loop);
  };

  window.stopFloatingCutouts = function () {
    running = false;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    cutouts.length = 0;
    images.length = 0;
    canvas = null;
    ctx = null;
  };
})();
