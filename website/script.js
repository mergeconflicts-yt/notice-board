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

  fridge.querySelectorAll('.paper.drag').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      let lifted = false, grabDX = 0, grabDY = 0, w = 0, h = 0;

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

      const move = (ev) => {
        if (!lifted) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
          lift();
        }
        const f = fridge.getBoundingClientRect();
        const x = Math.max(-24, Math.min(ev.clientX - f.left - grabDX, f.width - w + 24));
        const y = Math.max(-24, Math.min(ev.clientY - f.top - grabDY, f.height - h + 24));
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      };

      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  });
})();

// Hero intro: fridge starts empty -> chats pop -> struck off ->
// "Only what matters" drops in, zips away as all posts pin in together.
// Plays on scroll into view, once; skipped for reduced motion.
(() => {
  const fridge = document.getElementById('fridge');
  const stage = document.getElementById('fridgeStage');
  if (!fridge || !stage) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const pops = [...stage.querySelectorAll('.chat-pop')];
  const posts = [...fridge.querySelectorAll('.fridge-door .paper')];
  const POP_GAP = 130, HOLD = 450, STRIKE_SHOW = 350, NOTE_HOLD = 900;
  const POST_ANIM = 450;

  pops.forEach((p, i) => {
    p.style.setProperty('--d', `${i * POP_GAP}ms`);
  });

  let played = false, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function play() {
    timers.forEach(clearTimeout);
    timers = [];
    stage.classList.remove('playing', 'striking', 'clearing', 'revealing', 'note-leaving', 'posts-in', 'intro-empty');
    void stage.offsetWidth; // restart CSS animations
    stage.classList.add('intro-empty', 'playing');
    const chaosMs = pops.length * POP_GAP + HOLD;
    later(() => stage.classList.add('striking'), chaosMs);
    const strikeMs = chaosMs + STRIKE_SHOW;
    later(() => {
      stage.classList.add('clearing', 'revealing');
      const note = document.getElementById('revealNote');
      if (note) note.setAttribute('aria-hidden', 'false');
    }, strikeMs);
    const finaleMs = strikeMs + NOTE_HOLD;
    later(() => {
      stage.classList.remove('revealing');
      stage.classList.add('note-leaving');
      stage.classList.remove('intro-empty');
      stage.classList.add('posts-in');
    }, finaleMs);
    later(() => {
      stage.classList.remove('playing', 'striking', 'clearing', 'note-leaving', 'posts-in');
    }, finaleMs + POST_ANIM + 200);
  }

  const seen = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !played) {
      played = true;
      play();
      seen.disconnect();
    }
  }, { threshold: 0.35 });
  seen.observe(stage);
})();

// Tidy demo: tick the shopping list (app marks .done on the row)
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
