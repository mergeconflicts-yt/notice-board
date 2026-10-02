// Store buttons: links carrying data-placeholder point at listings that do
// not exist yet (App Store id 0000000000, unpublished Play listing) and
// would 404. Render them as inert "soon" pills until the attribute is
// removed at launch (see docs/store-listing.md).
document.querySelectorAll('a.store-btn[data-placeholder]').forEach((a) => {
  a.removeAttribute('href');
  a.classList.add('is-soon');
  a.setAttribute('aria-disabled', 'true');
  const strong = a.querySelector('strong');
  if (strong && !/soon/i.test(strong.textContent || '')) {
    strong.textContent += ' (soon)';
  }
});

// FAQ: swap + / ✕ on toggle
document.querySelectorAll('#faq details').forEach((d) => {
  const icon = d.querySelector('summary span');
  const paint = () => { if (icon) icon.textContent = d.open ? '✕' : '+'; };
  d.addEventListener('toggle', paint);
  paint();
});

// Hero fridge: tick list entries in place (like the app); drag notes to pin
// them anywhere on the fridge. A drag lifts the note into the fridge layer
// (leaving a placeholder so the doors never resize) and drops it where let go.
(() => {
  const fridge = document.getElementById('fridge');
  if (!fridge) return;
  fridge.querySelectorAll('.paper .entry button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      b.closest('li').classList.toggle('done', !on);
    });
  });

  // Touch uses touch & hold to pick a note up: an immediate drag would
  // hijack vertical page scrolls starting on the fridge. Mouse drags
  // immediately as before.
  let suppressMenuUntil = 0;

  fridge.querySelectorAll('.paper.drag').forEach((el) => {
    // Swallow the click synthesized after a real drag (dropping a list
    // over one of its own tick buttons must not toggle it).
    let justDragged = false;
    el.addEventListener('click', (e) => {
      if (justDragged) { justDragged = false; e.stopPropagation(); e.preventDefault(); }
    }, true);
    el.addEventListener('contextmenu', (e) => {
      if (Date.now() < suppressMenuUntil) e.preventDefault();
    });

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const isTouch = e.pointerType === 'touch';
      if (!isTouch) e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      let lifted = false, moved = false, grabDX = 0, grabDY = 0, w = 0, h = 0;
      let holdTimer = 0;

      const lift = () => {
        const r = el.getBoundingClientRect();
        grabDX = startX - r.left;
        grabDY = startY - r.top;
        w = r.width;
        h = r.height;
        if (!el.classList.contains('free')) {
          const ph = document.createElement('div');
          ph.className = 'drag-placeholder';
          ph.style.width = w + 'px';
          ph.style.height = h + 'px';
          el.parentNode.insertBefore(ph, el);
          fridge.appendChild(el);
          el.classList.add('free');
        }
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.classList.add('dragging');
        lifted = true;
      };

      // While a touch drag is active the page must not scroll under it.
      const blockScroll = (ev) => { ev.preventDefault(); };

      const cleanup = () => {
        clearTimeout(holdTimer);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        window.removeEventListener('touchmove', blockScroll);
        el.classList.remove('dragging');
      };

      const move = (ev) => {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (isTouch && !lifted) {
          // Finger travelling before the hold fires = a page scroll:
          // stand down and let the browser have the gesture.
          if (dist > 12) cleanup();
          return;
        }
        if (!lifted) {
          if (dist < 5) return;
          lift();
        }
        if (dist > 5) moved = true;
        const f = fridge.getBoundingClientRect();
        const x = Math.max(-24, Math.min(ev.clientX - f.left - grabDX, f.width - w + 24));
        const y = Math.max(-24, Math.min(ev.clientY - f.top - grabDY, f.height - h + 24));
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      };

      const up = () => {
        cleanup();
        if (lifted && moved) justDragged = true;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);

      if (isTouch) {
        holdTimer = setTimeout(() => {
          lift();
          if (navigator.vibrate) navigator.vibrate(10);
          suppressMenuUntil = Date.now() + 1500;
          window.addEventListener('touchmove', blockScroll, { passive: false });
        }, 350);
      }
    });
  });

  // Coarse pointers get a hint that matches the gesture.
  if (window.matchMedia('(pointer: coarse)').matches) {
    document.querySelectorAll('.fridge-stage .scribble').forEach((s) => {
      s.innerHTML = '<span class="scribble-arrow">⤴</span> touch &amp; hold to move them';
    });
  }
})();

// Tidy demo: tick the "Saturday shop" list; the meta line counts down.
(() => {
  const items = document.querySelectorAll('#shopList button');
  const left = document.getElementById('shopLeft');
  if (!items.length || !left) return;
  const paint = () => {
    const remaining = [...items].filter((b) => b.getAttribute('aria-pressed') !== 'true').length;
    left.textContent = remaining === 0 ? 'Dad · all ticked — leaves in 2 days' : `Dad · ${remaining} left`;
  };
  items.forEach((b) => {
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      b.closest('li').classList.toggle('done', !on);
      paint();
    });
  });
  paint();
})();
