// FAQ: swap + / ✕ on toggle
document.querySelectorAll('#faq details').forEach((d) => {
  const icon = d.querySelector('summary span');
  const paint = () => { if (icon) icon.textContent = d.open ? '✕' : '+'; };
  d.addEventListener('toggle', paint);
  paint();
});

// Hero fridge: tick list entries in place (like the app), drag the rest
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
  let active = null, dx = 0, dy = 0;

  fridge.querySelectorAll('.drag').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      active = el;
      const r = el.getBoundingClientRect();
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
      el.style.position = 'relative';
      el.style.zIndex = '20';
    });
    el.addEventListener('pointermove', (e) => {
      if (active !== el) return;
      const f = fridge.getBoundingClientRect();
      let x = e.clientX - f.left - dx;
      let y = e.clientY - f.top - dy;
      x = Math.max(-20, Math.min(x, f.width - 60));
      y = Math.max(-20, Math.min(y, f.height - 40));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.position = 'absolute';
      el.style.margin = '0';
    });
    const drop = () => {
      if (active !== el) return;
      active = null;
      el.classList.remove('dragging');
      el.style.zIndex = '';
    };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
  });
})();

// Hero intro: chats pop one by one -> struck off -> "Only what matters"
// note drops in -> chaos fades, clean fridge revealed. Plays on scroll into
// view, once; the link below replays it.
(() => {
  const fridge = document.getElementById('fridge');
  const stage = document.getElementById('fridgeStage');
  if (!fridge || !stage) return;
  const pops = [...stage.querySelectorAll('.chat-pop')];
  const POP_GAP = 130, HOLD = 450, STRIKE_SHOW = 350, NOTE_HOLD = 900;

  pops.forEach((p, i) => {
    p.style.setProperty('--d', `${i * POP_GAP}ms`);
  });

  let played = false, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function play() {
    timers.forEach(clearTimeout);
    timers = [];
    stage.classList.remove('playing', 'striking', 'clearing', 'revealing');
    fridge.classList.remove('intro-dim');
    void stage.offsetWidth; // restart CSS animations
    fridge.classList.add('intro-dim');
    stage.classList.add('playing');
    const chaosMs = pops.length * POP_GAP + HOLD;
    later(() => stage.classList.add('striking'), chaosMs);
    const strikeMs = chaosMs + STRIKE_SHOW;
    later(() => {
      stage.classList.add('clearing', 'revealing');
      const note = document.getElementById('revealNote');
      if (note) note.setAttribute('aria-hidden', 'false');
    }, strikeMs);
    later(() => {
      fridge.classList.remove('intro-dim');
      stage.classList.remove('playing', 'striking', 'clearing', 'revealing');
    }, strikeMs + NOTE_HOLD);
  }

  const seen = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !played) {
      played = true;
      play();
      seen.disconnect();
    }
  }, { threshold: 0.35 });
  seen.observe(stage);

  const replay = document.getElementById('noiseToggle');
  const replayLabel = document.getElementById('noiseLabel');
  if (replay) {
    if (replayLabel) replayLabel.textContent = 'Replay the intro';
    replay.addEventListener('click', play);
  }
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
