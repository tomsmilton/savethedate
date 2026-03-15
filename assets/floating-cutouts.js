/* ===== FLOATING CUTOUTS — overlay on poster phase ===== */
(function () {
  // --- Configuration ---
  const MIN_SIZE = 100;
  const MAX_SIZE = 180;
  const MIN_SPEED = 0.15;
  const MAX_SPEED = 0.6;
  const VELOCITY_CAP = 4;
  const MOUSE_RADIUS = 120;
  const MOUSE_FORCE = 3;
  const EDGE_BOUNCE_DAMPING = 0.9;

  // --- Mobile/tablet detection ---
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const SINK_DELAY = 10000; // 10 seconds before cutouts sink on mobile
  const SINK_GRAVITY = 0.08; // gentle downward acceleration
  const SINK_DURATION = 10000; // take ~10s to fully settle

  // --- State ---
  let canvas, ctx;
  let width, height;
  let mouseX = -9999, mouseY = -9999;
  const cutouts = [];
  const images = [];
  let running = false;
  let startTime = 0;
  let sinking = false;
  let keepoutActive = false;
  let restartBtn = null;

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
    fetch(basePath + 'cutouts-webp/manifest.json')
      .then(r => r.json())
      .then(files => {
        let loaded = 0;
        const paths = files.map(f => basePath + 'cutouts-webp/' + f);
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

  // --- Poster card exclusion zone (desktop only) ---
  const CARD_PADDING = 30; // extra margin around the card
  const CARD_REPEL = 3;    // repulsion force — gentle push

  function getCardRect() {
    const card = document.querySelector('.poster-card');
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return {
      left: r.left - CARD_PADDING,
      right: r.right + CARD_PADDING,
      top: r.top - CARD_PADDING,
      bottom: r.bottom + CARD_PADDING,
      cx: (r.left + r.right) / 2,
      cy: (r.top + r.bottom) / 2
    };
  }

  // --- Restart button ---
  function showRestartButton() {
    if (restartBtn) return;
    restartBtn = document.createElement('button');
    restartBtn.textContent = 'Restart the heads';
    restartBtn.style.cssText = [
      'position:fixed', 'bottom:1.8rem', 'left:50%', 'transform:translateX(-50%)',
      'font-family:"Josefin Sans",sans-serif', 'font-size:0.65rem',
      'color:rgba(255,245,230,0.4)', 'background:rgba(255,245,230,0.08)',
      'border:1px solid rgba(255,245,230,0.15)', 'border-radius:4px',
      'padding:0.4rem 1rem', 'cursor:pointer', 'z-index:602',
      'letter-spacing:0.05em', 'transition:all 0.3s',
      'opacity:0'
    ].join(';');
    restartBtn.addEventListener('mouseenter', () => {
      restartBtn.style.color = 'rgba(255,245,230,0.7)';
      restartBtn.style.borderColor = 'rgba(255,245,230,0.3)';
    });
    restartBtn.addEventListener('mouseleave', () => {
      restartBtn.style.color = 'rgba(255,245,230,0.4)';
      restartBtn.style.borderColor = 'rgba(255,245,230,0.15)';
    });
    restartBtn.addEventListener('click', restartHeads);
    document.body.appendChild(restartBtn);
    // Fade in
    requestAnimationFrame(() => { restartBtn.style.opacity = '1'; });
  }

  function restartHeads() {
    sinking = false;
    keepoutActive = false;
    startTime = Date.now(); // reset the timer
    // Re-randomise positions and velocities, clear settled state
    for (const c of cutouts) {
      const size = c.size;
      c.x = randomBetween(size, width - size);
      c.y = randomBetween(size, height - size);
      const angle = Math.random() * Math.PI * 2;
      const speed = randomBetween(MIN_SPEED, MAX_SPEED);
      c.vx = Math.cos(angle) * speed;
      c.vy = Math.sin(angle) * speed;
      c._repelled = false;
      c._settled = false;
    }
    // Remove button
    if (restartBtn && restartBtn.parentNode) {
      restartBtn.parentNode.removeChild(restartBtn);
      restartBtn = null;
    }
  }

  // --- Physics ---
  function update() {
    const elapsed = Date.now() - startTime;

    // On touch devices, start sinking after SINK_DELAY
    if (isTouchDevice && elapsed > SINK_DELAY) {
      sinking = true;
    }

    // After 10s: on desktop repel from poster card, on mobile sink
    const cardRect = (!isTouchDevice && elapsed > SINK_DELAY) ? getCardRect() : null;

    // Show restart button once keepout or sinking activates
    if ((cardRect || sinking) && !keepoutActive) {
      keepoutActive = true;
      showRestartButton();
    }

    for (const c of cutouts) {
      if (sinking) {
        // Apply gravity — pull downward
        c.vy += SINK_GRAVITY;
        // Dampen horizontal movement so they settle
        c.vx *= 0.98;
        c.x += c.vx;
        c.y += c.vy;

        // Rest at bottom
        const half = c.size / 2;
        if (c.y + half > height) {
          c.y = height - half;
          c.vy = -Math.abs(c.vy) * 0.3; // small bounce
          if (Math.abs(c.vy) < 0.5) c.vy = 0; // stop bouncing
        }
        // Keep within horizontal bounds
        if (c.x - half < 0)     { c.x = half;         c.vx = Math.abs(c.vx) * 0.3; }
        if (c.x + half > width) { c.x = width - half; c.vx = -Math.abs(c.vx) * 0.3; }
        if (c.y - half < 0)     { c.y = half;         c.vy = Math.abs(c.vy) * 0.3; }
      } else {
        // Normal floating physics
        const dx = c.x - mouseX;
        const dy = c.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
          c.vx += (dx / dist) * force;
          c.vy += (dy / dist) * force;
        }

        // Repel from poster card area on desktop — gentle drift away
        if (cardRect) {
          const half = c.size / 2;
          const inside = c.x + half > cardRect.left && c.x - half < cardRect.right &&
                         c.y + half > cardRect.top && c.y - half < cardRect.bottom;
          if (inside) {
            const pushX = c.x - cardRect.cx;
            const pushY = c.y - cardRect.cy;
            const pushDist = Math.sqrt(pushX * pushX + pushY * pushY) || 1;
            c.vx += (pushX / pushDist) * CARD_REPEL;
            c.vy += (pushY / pushDist) * CARD_REPEL;
            c.vx *= 0.92;
            c.vy *= 0.92;
            c._repelled = true;
          } else if (c._repelled) {
            // Just exited the card zone — kill most velocity so they don't oscillate
            c.vx *= 0.3;
            c.vy *= 0.3;
            c._repelled = false;
            c._settled = true;
          }
        }

        // Cap velocity so cutouts never fly too fast
        const spd2 = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
        if (spd2 > VELOCITY_CAP) {
          const clamp = VELOCITY_CAP / spd2;
          c.vx *= clamp;
          c.vy *= clamp;
        }

        c.x += c.vx;
        c.y += c.vy;
        c.vx *= 0.995;
        c.vy *= 0.995;
        const spd = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
        // Only enforce min speed if cutout hasn't settled outside the card zone
        if (spd < MIN_SPEED && !c._settled) {
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
    startTime = Date.now();
    sinking = false;

    // Work out the base path to the alternative-std folder relative to the current page
    // Each puzzle page is at e.g. /crossword/index.html, so ../alternative-std/
    const basePath = '../alternative-std/';
    loadImages(basePath);
    requestAnimationFrame(loop);
  };

  window.stopFloatingCutouts = function () {
    running = false;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (restartBtn && restartBtn.parentNode) restartBtn.parentNode.removeChild(restartBtn);
    cutouts.length = 0;
    images.length = 0;
    canvas = null;
    ctx = null;
    restartBtn = null;
    keepoutActive = false;
  };
})();
