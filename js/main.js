/* global gsap, ScrollTrigger, Lenis */
// Motion system: GSAP + ScrollTrigger, Lenis as the ONLY smooth-scroll engine.
const gsapOK = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined' && typeof window.Lenis !== 'undefined';
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

if (reduce || !gsapOK) root.classList.add('reduced');

// Failsafe: even if a script error happens, never leave the page behind the loader.
setTimeout(() => { const l = document.querySelector('.loader'); if (l) { l.remove(); window.__lenis && window.__lenis.start(); } }, 8000);

/* ------------------------------------------------------------------
   SCROLL MAP: how much extra scroll (in viewport heights) each section
   holds still so it can be read before it moves on. Tune here.
------------------------------------------------------------------ */
const SCROLL_MAP = {
  hero:  { hold: .35 },                 // headline stays put while the spine fans out
  quote: { hold: .9 },                  // quote pins centred while each word lights up
  care:  { lead: .3, tail: .35, perPx: 1.25 }, // pause on intro, slower per-card travel, pause on last card
  path:  { hold: 0 },
  visit: { travel: .55 },               // photo reels move less, so captions are readable
  blend: .55                            // colour blend zone between sections (viewport heights)
};


/* ------------------------------------------------------------------
   Utilities
------------------------------------------------------------------ */
// Split a heading into word spans while keeping an unsplit accessible name.
function splitWords(el) {
  if (el.dataset.splitDone) return $$('.w > span', el);
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', label);
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const i = document.createElement('span'); i.textContent = part; w.appendChild(i); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'A') {
        n.setAttribute('aria-hidden', 'true');
        walk(n);
      }
    });
  };
  walk(el);
  el.dataset.splitDone = '1';
  return $$('.w > span', el);
}

/* ------------------------------------------------------------------
   Static behaviour (works with or without motion)
------------------------------------------------------------------ */
// Hours: highlight today in Shillong time
(function hours() {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = now.getDay();
    const row = $(`.hours tr[data-day="${day}"]`);
    row && row.classList.add('today');
    const mins = now.getHours() * 60 + now.getMinutes();
    const open = day === 0 ? null : day === 1 ? [540, 1080] : [570, 1020];
    const status = $('.hours__status');
    if (status) status.textContent = open && mins >= open[0] && mins < open[1] ? '● Open now (Shillong time)' : '○ Closed now (Shillong time)';
  } catch (e) { /* non-critical */ }
})();

// Care cards preselect the matching concern in the form
$$('[data-concern]').forEach((card) => card.addEventListener('click', () => {
  const r = document.querySelector(`.chips input[value="${card.dataset.concern}"]`); if (r) r.checked = true;
}));

// Lazy map iframe
(function lazyMap() {
  const f = $('.info--map iframe'); if (!f) return;
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { f.src = f.dataset.src; io.disconnect(); } }, { rootMargin: '400px' });
  io.observe(f);
})();

// Mobile menu
(function menu() {
  const btn = $('.nav__burger'), m = $('#menu'); if (!btn) return;
  const close = () => { btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu'); m.hidden = true; document.body.style.overflow = ''; window.__lenis && window.__lenis.start(); };
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    if (!open) return close();
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', 'Close menu'); m.hidden = false;
    window.__lenis && window.__lenis.stop();
    if (gsapOK && !reduce) gsap.from($$('#menu li a'), { yPercent: 110, duration: .8, stagger: .06, ease: 'expo.out' });
    $('#menu a').focus();
  });
  $$('#menu a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) { close(); btn.focus(); } });
})();

// Form validation + states
(function form() {
  const f = $('.form'); if (!f) return;
  const status = $('.form__status', f), btn = $('.form__submit', f), label = $('.form__label', f);
  const check = (input) => {
    const field = input.closest('.field');
    const v = input.value.trim();
    let ok = true;
    if (input.name === 'name') ok = v.length > 1;
    if (input.name === 'phone') ok = /^[0-9+\s-]{10,15}$/.test(v) && v.replace(/\D/g, '').length >= 10;
    field.classList.toggle('is-error', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  };
  $$('input[name="name"], input[name="phone"]', f).forEach(i => {
    i.addEventListener('blur', () => i.value && check(i));
    i.addEventListener('input', () => i.closest('.field').classList.contains('is-error') && check(i));
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const a = check(f.name), b = check(f.phone);
    if (!a || !b) { status.textContent = 'Please fix the highlighted fields.'; (a ? f.phone : f.name).focus(); return; }
    btn.disabled = true; btn.classList.add('is-loading'); label.textContent = 'Sending';
    status.textContent = '';
    setTimeout(() => {
      btn.classList.remove('is-loading'); label.textContent = 'Request received';
      status.textContent = `Thank you, ${f.name.value.trim().split(' ')[0]}. This is a demo, so nothing was sent; once connected, the clinic will call you back.`;
      setTimeout(() => { btn.disabled = false; label.textContent = 'Request a call back'; f.reset(); }, 5000);
    }, 1200);
  });
})();

/* ------------------------------------------------------------------
   Reduced motion / no GSAP: render final states and stop here.
------------------------------------------------------------------ */
if (reduce || !gsapOK) {
  $('.loader') && $('.loader').remove();
  $$('.quote__text').forEach(q => q.style.opacity = 1);
  // Reduced motion: each section paints its own static tone (see CSS --tone).
  $$('.vprog').forEach(v => v.remove());
  const mb = $('.mbar');
  if (mb) {
    const vis = { hero: true, book: false };
    const hio = new IntersectionObserver((es) => { es.forEach((e) => { vis[e.target.id === 'book' ? 'book' : 'hero'] = e.isIntersecting; }); mb.classList.toggle('is-on', !vis.hero && !vis.book); }, { threshold: .2 });
    hio.observe($('.hero')); hio.observe($('#book'));
  }
} else {
  initMotion();
}

function initMotion() {
  gsap.registerPlugin(ScrollTrigger);
  gsap.config({ nullTargetWarn: false });
  // Phones: address-bar show/hide resizes the viewport; don't re-measure every time (that causes jumps).
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------- Lenis (sole smooth-scroll engine) ---------------- */
  const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, syncTouch: false, touchMultiplier: 1 });
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  // anchor links through Lenis
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const t = $(id); if (!t) return;
    e.preventDefault();
    lenis.scrollTo(t, { offset: id === '#top' ? 0 : -10, duration: 1.6 });
    history.replaceState(null, '', id);
    t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true });
  }));

  // Hero hold pin — created first so every later trigger measures with its spacing.
  ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: () => '+=' + window.innerHeight * SCROLL_MAP.hero.hold, pin: true, pinSpacing: true });

  /* ---------------- Nav: hide on scroll down, active link ---------------- */
  const nav = $('[data-nav]');
  let lastY = 0;
  lenis.on('scroll', ({ scroll }) => {
    nav.classList.toggle('is-solid', scroll > 60);
    nav.classList.toggle('is-hidden', scroll > lastY && scroll > 400 && $('#menu').hidden);
    lastY = scroll;
  });
  /* ---------------- Vertebra progress (C1..L5) ---------------- */
  const names = [...Array(7)].map((_, i) => 'C' + (i + 1)).concat([...Array(12)].map((_, i) => 'T' + (i + 1)), [...Array(5)].map((_, i) => 'L' + (i + 1)));
  const list = $('.vprog__list'); const vlabel = $('.vprog__label');
  names.forEach(() => list.appendChild(document.createElement('li')));
  const ticks = $$('li', list);
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const idx = Math.min(23, Math.floor(self.progress * 24));
      ticks.forEach((t, i) => { t.classList.toggle('on', i < idx); t.classList.toggle('cur', i === idx); });
      vlabel.textContent = names[idx];
    }
  });

  /* ---------------- Custom cursor ---------------- */
  if (fine) {
    const c = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), lab = $('.cursor__label');
    const dx = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3' }), dy = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: .5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .5, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); c.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('pointerleave', () => c.classList.add('is-hidden'));
    window.addEventListener('blur', () => c.classList.add('is-hidden'));
    $$('[data-cursor]').forEach((el) => {
      el.addEventListener('pointerenter', () => { lab.textContent = el.dataset.cursor; c.classList.add('is-label'); });
      el.addEventListener('pointerleave', () => c.classList.remove('is-label'));
    });
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (fine) {
    $$('[data-magnetic]').forEach((b) => {
      const xTo = gsap.quickTo(b, 'x', { duration: .6, ease: 'elastic.out(1, .4)' });
      const yTo = gsap.quickTo(b, 'y', { duration: .6, ease: 'elastic.out(1, .4)' });
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * .3); yTo((e.clientY - r.top - r.height / 2) * .4);
      });
      b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------------- Hero: 3D spine ---------------- */
  let spine = null;
  const heroCanvas = $('.hero__canvas');
  let loaderDoneResolve; const loaderDone = new Promise((r) => { loaderDoneResolve = r; });
  // Fetch the module now, but build the WebGL scene only after the loader is gone (keeps the loader fast).
  const spineReady = import('./spine.js').then((m) => loaderDone.then(() => {
    try { spine = m.createSpine(heroCanvas); } catch (e) { spine = null; }
    return spine;
  })).catch(() => null);

  /* ---------------- Preloader + intro ---------------- */
  const heroWords = splitWords($('.hero__title'));
  gsap.set(heroWords, { yPercent: 115 });
  gsap.set(['.hero__eyebrow', '.hero__lede', '.hero__ctas > *', '.hero__facts > div', '.hero__scroll'], { autoAlpha: 0, y: 24 });
  gsap.set('.hero__grid i', { scaleY: 0, transformOrigin: 'top' });
  gsap.set('.nav > *', { autoAlpha: 0, y: -14 });

  const loader = $('.loader');
  const bars = $$('.loader__stack span');
  const num = $('.loader__num'), seg = $('.loader__seg');
  const counter = { v: 0 };
  const lt = gsap.timeline();
  lt.to(bars, { scaleX: 1, duration: .45, stagger: .05, ease: 'expo.out' }, 0)
    .to(counter, {
      v: 24, duration: 1.15, ease: 'power2.inOut',
      onUpdate: () => { const n = Math.round(counter.v); num.textContent = String(n).padStart(2, '0'); seg.textContent = names[Math.max(0, n - 1)]; }
    }, 0)
    ;

  const wait = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  // Hard safety net: whatever happens, the loader is gone after 5s.
  const safety = setTimeout(() => { if (document.body.contains(loader)) { loaderDoneResolve(); loader.remove(); lenis.start(); gsap.set([heroWords, '.hero__eyebrow', '.hero__lede', '.hero__ctas > *', '.hero__facts > div', '.nav > *'], { clearProps: 'all' }); ScrollTrigger.refresh(); } }, 5000);
  Promise.all([wait(document.fonts ? document.fonts.ready : Promise.resolve(), 1500), new Promise(r => lt.eventCallback('onComplete', r))]).then(() => {
    clearTimeout(safety);
    const out = gsap.timeline({ onComplete: () => { loader.remove(); lenis.start(); ScrollTrigger.refresh(); loaderDoneResolve(); } });
    out.to(bars, { scaleX: 0, duration: .32, stagger: { each: .02, from: 'end' }, ease: 'power3.in' })
      .to('.loader__meta, .loader__count', { autoAlpha: 0, duration: .3 }, '<')
      .to('.loader__curtain--a', { scaleY: 1, duration: .42, ease: 'expo.inOut', transformOrigin: 'bottom' }, '-=.2')
      .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: .75, ease: 'expo.inOut' });
    introHero(out, '-=.55');
  });

  function introHero(tl, at) {
    tl.to('.hero__grid i', { scaleY: 1, duration: 1.4, stagger: .08, ease: 'expo.out' }, at)
      .to(heroWords, { yPercent: 0, duration: 1.2, stagger: .07, ease: 'expo.out' }, '<.1')
      .to('.nav > *', { autoAlpha: 1, y: 0, duration: .8, stagger: .06, ease: 'expo.out' }, '<.2')
      .to('.hero__eyebrow', { autoAlpha: .8, y: 0, duration: .8, ease: 'expo.out' }, '<')
      .to('.hero__lede', { autoAlpha: .82, y: 0, duration: .9, ease: 'expo.out' }, '<.25')
      .to('.hero__ctas > *', { autoAlpha: 1, y: 0, duration: .8, stagger: .08, ease: 'expo.out' }, '<.1')
      .to('.hero__facts > div', { autoAlpha: 1, y: 0, duration: .8, stagger: .08, ease: 'expo.out' }, '<.1')
      .to('.hero__scroll', { autoAlpha: .6, y: 0, duration: .8 }, '<.2');
    // The spine assembles as soon as WebGL is ready — never blocks the loader.
    spineReady.then((sp) => {
      if (!sp) return;
      const p = sp.params;
      const st = gsap.timeline({ delay: .15 });
      st.to(p, { assemble: 1, duration: 2.6, ease: 'power3.out' })
        .to(p, { scan: -8, duration: 2.4, ease: 'power2.inOut' }, '<.8')
        .to(p, { cordAlpha: 1, duration: .8 }, '<1.2');
      // scroll: fan the column sideways as you leave the hero
      gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: () => '+=' + window.innerHeight * (1 + SCROLL_MAP.hero.hold), scrub: 1 } })
        .to(p, { explode: 1, rotY: 1.6, glow: .6, ease: 'none' }, 0);
      // stop rendering WebGL once the canvas has faded out
      ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: () => '+=' + window.innerHeight * (.65 + SCROLL_MAP.hero.hold), onToggle: (s) => sp.setActive(s.isActive) });
    });
    // ...and the canvas fades out before the pieces can drift over the facts / next section
    gsap.to('.hero__canvas', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: () => window.innerWidth < 760 ? 'top top' : '25% top', end: () => window.innerWidth < 760 ? '40% top' : '65% top', scrub: true, invalidateOnRefresh: true } });
    // hero copy drifts upward on scroll (parallax)
    gsap.to('.hero__inner', { yPercent: -14, ease: 'none', scrollTrigger: { trigger: '.hero', start: () => 'top+=' + window.innerHeight * SCROLL_MAP.hero.hold + ' top', end: () => '+=' + window.innerHeight, scrub: true, invalidateOnRefresh: true } });
    gsap.to('.hero__facts', { yPercent: -60, autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true } });
  }

  /* ---------------- Marquee: velocity-aware ---------------- */
  $$('.marquee__row').forEach((row) => {
    const track = $('.marquee__track', row);
    const dir = +row.dataset.dir;
    const w = () => track.scrollWidth / 2;
    let x = dir > 0 ? -w() : 0, speed = 0;
    const base = row.classList.contains('marquee__row--sm') ? 40 : 70;
    const skew = gsap.quickTo(track, 'skewX', { duration: .5, ease: 'power3' });
    let visible = false;
    ScrollTrigger.create({ trigger: row, start: 'top bottom', end: 'bottom top', onToggle: (s) => visible = s.isActive });
    gsap.ticker.add((t, dtms) => {
      if (!visible) return;
      const v = lenis.velocity || 0;
      speed += ((base + Math.abs(v) * 14) - speed) * .08;
      x += dir * speed * (dtms / 1000) * (v < 0 ? -1 : 1);
      const W = w();
      if (x <= -W) x += W; if (x > 0) x -= W;
      gsap.set(track, { x });
      if (fine) skew(gsap.utils.clamp(-12, 12, -v * .6 * dir));
    });
  });

  /* ---------------- Generic split headings ---------------- */
  $$('[data-split]').forEach((h) => {
    if (h.classList.contains('hero__title')) return;
    const words = splitWords(h);
    gsap.from(words, { yPercent: 115, rotate: 4, duration: 1.1, stagger: .05, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%' } });
  });
  $$('.eyebrow').forEach((e) => {
    if (e.closest('.hero')) return;
    gsap.from(e, { opacity: 0, x: -20, duration: .8, ease: 'expo.out', scrollTrigger: { trigger: e, start: 'top 90%' } });
  });
  $$('[data-fade]').forEach((e) => gsap.from(e, { opacity: 0, y: 40, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: e, start: 'top 88%' } }));

  /* ---------------- Doctor ---------------- */
  const frame = $('.doctor__frame');
  gsap.to(frame, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: frame, start: 'top 80%' } });
  gsap.fromTo('.doctor__frame img', { yPercent: -10, scale: 1.2 }, { yPercent: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } });
  $$('[data-count]').forEach((n) => {
    const o = { v: 0 }, end = +n.dataset.count;
    gsap.to(o, { v: end, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: n, start: 'top 85%' }, onUpdate: () => n.textContent = Math.round(o.v) });
  });
  gsap.from('.creds li', { xPercent: -8, opacity: 0, duration: .9, stagger: .09, ease: 'expo.out', scrollTrigger: { trigger: '.creds', start: 'top 85%' } });
  gsap.from('.stat', { opacity: 0, y: 50, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.stat', start: 'top 88%' } });

  /* ---------------- Quote: words light up as you scroll ---------------- */
  $$('[data-scrub-words]').forEach((q) => {
    const text = q.textContent.trim();
    q.setAttribute('aria-label', text);
    q.innerHTML = text.split(' ').map(w => `<span class="qw" aria-hidden="true">${w}</span>`).join(' ');
    const sec = q.closest('section');
    gsap.to($$('.qw', q), { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: {
      trigger: sec, start: 'center center', end: () => '+=' + window.innerHeight * SCROLL_MAP.quote.hold, scrub: .6, pin: true, anticipatePin: 1, invalidateOnRefresh: true } });
    gsap.from(q, { x: () => -window.innerWidth * .05, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'center center', scrub: true } });
  });

  /* ---------------- Care: pinned horizontal scroll ---------------- */
  const mm = gsap.matchMedia();
  const track = $('.care__track');
  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  const CM = SCROLL_MAP.care, careLen = () => dist() * CM.perPx + window.innerHeight * (CM.lead + CM.tail);
  const careTL = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.care', pin: '.care__pin', start: 'top top', end: () => '+=' + careLen(), scrub: .8, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (s) => gsap.set('.care__progress i', { scaleX: s.progress })
    }
  });
  // durations are proportional to scroll distance, so holds are real reading pauses
  const share = () => { const L = careLen(); return { lead: window.innerHeight * CM.lead / L, move: dist() * CM.perPx / L, tail: window.innerHeight * CM.tail / L }; };
  const sh = share();
  careTL.to({}, { duration: sh.lead })
        .to(track, { x: () => -dist(), duration: sh.move })
        .to({}, { duration: sh.tail });
  const careTween = careTL;
  // Keyboard: focusing a card scrolls the PAGE to the matching horizontal position (instead of the pin scrolling sideways)
  const pinEl = $('.care__pin');
  track.addEventListener('focusin', (e) => {
    const card = e.target.closest('.card, .care__end'); if (!card) return;
    pinEl.scrollLeft = 0;
    const st = careTween.scrollTrigger, s2 = share();
    const target = gsap.utils.clamp(0, dist(), card.offsetLeft - window.innerWidth * .2);
    const prog = s2.lead + (dist() ? target / dist() : 0) * s2.move;
    lenis.scrollTo(st.start + prog * (st.end - st.start), { immediate: true });
    gsap.set(card, { opacity: 1, rotate: 0, yPercent: 0 });
  });

  $$('.card').forEach((card) => {
    const segEl = $('.card__seg', card);
    gsap.fromTo(segEl, { xPercent: 30 }, { xPercent: -30, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: careTween, start: 'left right', end: 'right left', scrub: true } });
    gsap.from(card, { rotate: () => window.innerWidth < 760 ? 0 : 4, yPercent: 8, opacity: .2, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: careTween, start: 'left 105%', end: 'left 65%', scrub: true } });
  });

  /* ---------------- Path: drawn spine line + steps ---------------- */
  const draw = $('.path__draw');
  const len = draw.getTotalLength();
  gsap.set(draw, { strokeDasharray: len, strokeDashoffset: len });
  gsap.to(draw, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.path__body', start: 'top 70%', end: 'bottom 70%', scrub: true } });
  $$('.step').forEach((s) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: s, start: 'top 88%' } });
    tl.from($('.step__n', s), { opacity: 0, x: -20, duration: .6, ease: 'expo.out' })
      .from($('h3', s), { yPercent: 60, opacity: 0, duration: .9, ease: 'expo.out' }, '<.05')
      .from($('p', s), { opacity: 0, y: 20, duration: .8, ease: 'expo.out' }, '<.15');
  });

  /* ---------------- Visit: opposing horizontal reels ---------------- */
  $$('.reel__row').forEach((row) => {
    const s = +row.dataset.speed;
    gsap.fromTo(row, { x: () => s < 0 ? 0 : -window.innerWidth * .05 }, {
      x: () => s < 0 ? -(row.scrollWidth - window.innerWidth) * SCROLL_MAP.visit.travel : window.innerWidth * .3 * SCROLL_MAP.visit.travel,
      ease: 'none', scrollTrigger: { trigger: '.reel', start: 'top bottom', end: 'bottom top', scrub: 1, invalidateOnRefresh: true }
    });
  });
  $$('.reel__item').forEach((it) => {
    gsap.from(it, { clipPath: 'inset(12% 12% 12% 12% round 18px)', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.reel', start: 'top 85%' } });
  });
  gsap.from('.info', { y: 60, opacity: 0, duration: 1, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.visit__info', start: 'top 85%' } });
  gsap.from('.hours tr', { opacity: 0, x: 16, duration: .6, stagger: .05, ease: 'expo.out', scrollTrigger: { trigger: '.hours', start: 'top 85%' } });

  /* ---------------- Beyond: tiles rise + 3D tilt ---------------- */
  gsap.from('.tile', { yPercent: 25, rotateX: -18, opacity: 0, duration: 1.2, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.beyond__grid', start: 'top 85%' } });
  if (fine) {
    $$('[data-tilt]').forEach((t) => {
      const rx = gsap.quickTo(t, 'rotateX', { duration: .6, ease: 'power3' });
      const ry = gsap.quickTo(t, 'rotateY', { duration: .6, ease: 'power3' });
      t.addEventListener('pointermove', (e) => {
        const r = t.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - .5) * 12); rx(-((e.clientY - r.top) / r.height - .5) * 12);
      });
      t.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ---------------- Book ---------------- */
  gsap.from('.form > *', { y: 30, opacity: 0, duration: .9, stagger: .07, ease: 'expo.out', scrollTrigger: { trigger: '.form', start: 'top 85%' } });

  /* ---------------- Footer: giant letters rise, horizontal spread ---------------- */
  gsap.from('.foot__big span', {
    yPercent: 100, rotate: (i) => (i % 2 ? 8 : -8), ease: 'none', stagger: .05,
    scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'top 35%', scrub: 1 }
  });
  gsap.from('.foot__cols > div', { y: 30, opacity: 0, stagger: .08, duration: .8, ease: 'expo.out', scrollTrigger: { trigger: '.foot__cols', start: 'top 95%' } });

  // Created AFTER the pinned sections so their start/end include pin spacing.
  /* ---------------- Background: scroll-blended dusk tones ----------------
     Each section declares a --tone. The body colour is interpolated by scroll
     position across a blend zone as the next section rises, so it drifts
     smoothly instead of switching (no flashes). */
  root.classList.add('blend');
  const toned = $$('main > section, .foot');
  const stops = toned.map((s) => ({ el: s, color: getComputedStyle(s).getPropertyValue('--tone').trim() || '#0c121c', st: ScrollTrigger.create({ trigger: s, start: 'top bottom' }) }));
  const paint = () => {
    const y = lenis.scroll, vh = window.innerHeight, zone = vh * SCROLL_MAP.blend;
    let color = stops[0].color;
    for (let i = 1; i < stops.length; i++) {
      const from = stops[i].st.start + vh * .15;           // next section's top at 85% of the viewport
      if (y < from) break;
      const t = gsap.utils.clamp(0, 1, (y - from) / zone);
      color = t >= 1 ? stops[i].color : gsap.utils.interpolate(stops[i - 1].color, stops[i].color, t);
      if (t < 1) break;
    }
    if (color !== paint.last) { document.body.style.backgroundColor = color; paint.last = color; }
  };
  lenis.on('scroll', paint);
  ScrollTrigger.addEventListener('refresh', paint);
  paint();

  $$('[data-link]').forEach((a) => {
    const s = $(a.getAttribute('href'));
    s && ScrollTrigger.create({ trigger: s, start: 'top 50%', end: 'bottom 50%', onToggle: (st) => a.classList.toggle('active', st.isActive) });
  });

  /* ---------------- Rail + mobile bar visibility ---------------- */
  const railOff = { foot: false, care: false };
  const railUpd = () => $('.vprog').classList.toggle('is-off', railOff.foot || railOff.care);
  ScrollTrigger.create({ trigger: '.foot', start: 'top 85%', onToggle: (s) => { railOff.foot = s.isActive; railUpd(); } });
  ScrollTrigger.create({ trigger: '.care', start: 'top 60%', end: 'bottom 40%', onToggle: (s) => { railOff.care = s.isActive; railUpd(); } });
  const mbar = $('.mbar');
  if (mbar) {
    const upd = () => {
      const pastHero = window.scrollY > window.innerHeight * .8;
      const b = $('#book').getBoundingClientRect();
      const inBook = b.top < window.innerHeight * .9;
      mbar.classList.toggle('is-on', pastHero && !inBook && $('#menu').hidden);
    };
    lenis.on('scroll', upd); upd();
  }

  /* ---------------- Refresh after media/fonts ---------------- */
  window.addEventListener('load', () => ScrollTrigger.refresh());
  $$('img[loading="lazy"]').forEach(img => img.complete || img.addEventListener('load', () => ScrollTrigger.refresh(), { once: true }));

  // cleanup (for SPA hosts / bfcache)
  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    mm.revert(); ScrollTrigger.getAll().forEach(s => s.kill()); lenis.destroy(); spine && spine.destroy();
  });
}
