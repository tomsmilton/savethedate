/**
 * Universal page transition system.
 * Must be loaded in <head> so it can hide content before first paint.
 *
 * Exit: navigateWithTransition(href) — blue overlay → navigate
 * Enter: auto on page load if sessionStorage flag is set —
 *        video plays over blue bg → content fades in → video fades out
 * Same-page: playTransition() — plays video overlay on current page
 */
(function() {
  var FADE_DURATION = 750;
  var CONTENT_FADE = 600;
  var BG_COLOR = '#1B3A4B';
  var FLAG_KEY = '__transition';

  // --- Immediately inject CSS to hide content before first paint ---
  var entering = !!sessionStorage.getItem(FLAG_KEY);
  if (entering) {
    var style = document.createElement('style');
    style.id = 'transition-hide';
    style.textContent = '#puzzle-phase, .content { opacity: 0 !important; } body { background: ' + BG_COLOR + ' !important; }';
    document.head.appendChild(style);
  }

  // Determine asset path relative to current page
  function getAssetsPath() {
    var path = window.location.pathname;
    if (path.endsWith('/index.html')) path = path.replace('/index.html', '/');
    var depth = path.split('/').filter(Boolean).length;
    if (depth >= 1) return '../assets/';
    return 'assets/';
  }

  // Find the main content element on this page
  function getContentEl() {
    return document.getElementById('puzzle-phase') || document.querySelector('.content');
  }

  // --- All DOM work deferred until body exists ---
  var overlay, video, blueOverlay;

  function setup() {
    // Video overlay (bottom 2/3)
    overlay = document.createElement('div');
    overlay.id = 'transition-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'bottom: 0',
      'left: 0',
      'right: 0',
      'height: 66.67vh',
      'z-index: 9999',
      'pointer-events: none',
      'display: none',
      'overflow: hidden',
      'justify-content: center',
      'align-items: flex-end'
    ].join(';');

    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = getAssetsPath() + 'transition.webm';
    video.style.cssText = 'height:100%;width:auto;display:block;';
    overlay.appendChild(video);

    // Blue exit overlay (full screen)
    blueOverlay = document.createElement('div');
    blueOverlay.id = 'transition-blue';
    blueOverlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      'z-index: 9998',
      'background:' + BG_COLOR,
      'opacity: 0',
      'pointer-events: none',
      'transition: opacity 0.3s ease-in',
      'display: none'
    ].join(';');

    document.body.appendChild(blueOverlay);
    document.body.appendChild(overlay);

    // Auto-intercept navigation links
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http')) return;
      if (link.closest('#poster-phase')) return;
      e.preventDefault();
      navigateWithTransition(href);
    });

    // Run enter transition if flag was set
    if (entering) {
      runEnterTransition();
    }
  }

  // --- Exit transition: blue overlay then navigate ---
  window.navigateWithTransition = function(href) {
    sessionStorage.setItem(FLAG_KEY, '1');
    if (!blueOverlay) { window.location.href = href; return; }
    blueOverlay.style.display = 'block';
    blueOverlay.offsetHeight; // force reflow
    blueOverlay.style.opacity = '1';
    setTimeout(function() {
      window.location.href = href;
    }, 300);
  };

  // --- Same-page transition (for name gate) ---
  window.playTransition = function(onComplete) {
    if (!overlay) { if (onComplete) onComplete(); return; }
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.style.transition = 'none';
    video.currentTime = 0;

    function onEnded() {
      video.removeEventListener('ended', onEnded);
      overlay.style.transition = 'opacity ' + FADE_DURATION + 'ms ease-out';
      overlay.style.opacity = '0';
      setTimeout(function() {
        overlay.style.display = 'none';
        overlay.style.transition = 'none';
        if (onComplete) onComplete();
      }, FADE_DURATION);
    }

    video.addEventListener('ended', onEnded);
    video.play().catch(function() {
      overlay.style.display = 'none';
      if (onComplete) onComplete();
    });
  };

  // --- Enter transition ---
  function runEnterTransition() {
    sessionStorage.removeItem(FLAG_KEY);

    var content = getContentEl();
    if (!content) return;

    // Content is already hidden via injected CSS
    // Show video overlay
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.style.transition = 'none';
    video.currentTime = 0;

    function onEnded() {
      video.removeEventListener('ended', onEnded);

      // Remove the injected hide style
      var hideStyle = document.getElementById('transition-hide');
      if (hideStyle) hideStyle.remove();

      // Fade in content
      content.style.opacity = '0';
      content.style.transition = 'opacity ' + CONTENT_FADE + 'ms ease-out';
      // Force reflow so transition triggers
      content.offsetHeight;
      content.style.opacity = '1';

      // Fade out video overlay
      overlay.style.transition = 'opacity ' + FADE_DURATION + 'ms ease-out';
      overlay.style.opacity = '0';

      setTimeout(function() {
        overlay.style.display = 'none';
        overlay.style.transition = 'none';
        content.style.transition = 'none';
      }, Math.max(FADE_DURATION, CONTENT_FADE));
    }

    function startPlayback() {
      video.addEventListener('ended', onEnded);
      video.play().catch(function() {
        // Autoplay blocked — just show content
        var hideStyle = document.getElementById('transition-hide');
        if (hideStyle) hideStyle.remove();
        content.style.opacity = '1';
        overlay.style.display = 'none';
      });
    }

    // Wait for video to be ready before playing
    if (video.readyState >= 3) {
      startPlayback();
    } else {
      video.addEventListener('canplaythrough', function handler() {
        video.removeEventListener('canplaythrough', handler);
        startPlayback();
      });
    }
  }

  // Run setup when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
