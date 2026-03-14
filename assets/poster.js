/* ===== SHARED POSTER REVEAL + CONFETTI ===== */
(function () {
  /* Inject poster HTML */
  const stars = Array.from({length:8}, () => '<span class="poster-star">\u2726</span>').join('');
  const posterHTML = `
<div id="poster-phase">
  <div class="poster-stars">${stars}</div>
  <div class="poster-card">
    <div class="p-el" data-anim="scaleIn" data-delay="400">
      <div class="poster-img-wrap">
        <img class="poster-img" src="../assets/save-the-date.png" alt="Save the Date">
      </div>
      <div class="poster-text">
        <div class="poster-couple">Flora & Thomas</div>
        <div class="poster-date-text">10th October 2026</div>
        <div class="poster-venue-text">
          St Bartholomew\u2019s Church, Crewkerne<br>
          followed by <span class="poster-venue-name">Mapperton House</span>
        </div>
      </div>
    </div>
    <div class="p-el poster-date-overlay" data-anim="popIn" data-delay="1200">
      <span class="poster-date-big">10/10</span>
      <span class="poster-date-year">2026</span>
    </div>
    <div class="p-el poster-footer" data-anim="fadeInUp" data-delay="1800">
      Formal invitation to follow
    </div>
    <div class="p-el poster-rsvp" data-anim="fadeInUp" data-delay="2200">
      If you aren\u2019t able to attend, please let us know as soon as possible
    </div>
  </div>
  <a class="poster-back" id="poster-back">\u2190 back to puzzle</a>
  <a class="poster-home" href="../index.html">\u2190 all puzzles</a>
</div>
<canvas class="confetti-canvas" id="confetti-canvas"></canvas>`;

  document.body.insertAdjacentHTML('beforeend', posterHTML);

  /* Confetti */
  function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.classList.add('show');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = [];
    const colors = ['#D4A739','#E06050','#1F7A6F','#D4622B','#F5D5B8','#7b6d8d','#3D2B1F'];
    for (let i = 0; i < 200; i++) {
      pieces.push({
        x: Math.random()*canvas.width, y: Math.random()*canvas.height - canvas.height,
        w: Math.random()*8+4, h: Math.random()*6+3,
        color: colors[Math.floor(Math.random()*colors.length)],
        vy: Math.random()*3+2, vx: (Math.random()-0.5)*2,
        rot: Math.random()*Math.PI*2, vrot: (Math.random()-0.5)*0.2,
      });
    }
    let frame = 0;
    function draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pieces.forEach(p => {
        p.x+=p.vx; p.y+=p.vy; p.rot+=p.vrot;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      });
      if (++frame < 200) requestAnimationFrame(draw);
      else canvas.classList.remove('show');
    }
    draw();
  }

  function showPoster() {
    const puzzleEl = document.getElementById(window._puzzlePhaseId);
    if (puzzleEl) puzzleEl.style.display = 'none';
    const poster = document.getElementById('poster-phase');
    poster.classList.add('visible');
    poster.scrollTo(0, 0);
    poster.querySelectorAll('.p-el').forEach(el => {
      const delay = parseInt(el.dataset.delay) || 0;
      const anim = el.dataset.anim || 'fadeInUp';
      setTimeout(() => {
        el.classList.add('anim');
        el.style.animation = `${anim} 0.55s ease-out forwards`;
      }, delay);
    });
  }

  /* Public API */
  window.triggerPosterReveal = function (puzzlePhaseId) {
    window._puzzlePhaseId = puzzlePhaseId;
    var guestName = localStorage.getItem('guestName');
    if (guestName && window.APPS_SCRIPT_URL) {
      fetch(window.APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          firstName: localStorage.getItem('guestFirstName') || '',
          surname: localStorage.getItem('guestSurname') || '',
          email: localStorage.getItem('guestEmail') || '',
          name: guestName,
          event: 'puzzle_complete',
          puzzle: puzzlePhaseId,
          timestamp: new Date().toISOString()
        })
      }).catch(function() {});
    }
    setTimeout(launchConfetti, 400);
    setTimeout(() => {
      const puzzleEl = document.getElementById(puzzlePhaseId);
      if (puzzleEl) {
        puzzleEl.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        puzzleEl.style.opacity = '0';
        puzzleEl.style.transform = 'scale(0.96)';
        puzzleEl.style.pointerEvents = 'none';
      }
      setTimeout(showPoster, 900);
    }, 1800);
  };

  /* Back button */
  document.getElementById('poster-back').addEventListener('click', () => {
    document.getElementById('poster-phase').classList.remove('visible');
    document.getElementById('poster-phase').querySelectorAll('.p-el').forEach(el => {
      el.classList.remove('anim');
      el.style.animation = '';
    });
    const puzzleEl = document.getElementById(window._puzzlePhaseId);
    if (puzzleEl) {
      puzzleEl.style.display = '';
      puzzleEl.style.opacity = '';
      puzzleEl.style.transform = '';
      puzzleEl.style.pointerEvents = '';
    }
  });
})();
