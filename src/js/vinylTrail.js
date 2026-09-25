/**
 * Cursor-trail vinyl discs over the hero (nightkidz.shop/us-style effect).
 *
 * mousemove only ever writes targetX/targetY. All visual movement happens
 * inside a single requestAnimationFrame loop that lerps each active disc's
 * own (x, y) toward that shared target every frame and writes the result as
 * a plain translate3d — never a direct jump to the cursor position, which is
 * what caused the earlier jitter. Desktop pointer only; touch devices just
 * see the static hero background.
 */
export function initVinylTrail() {
  const hero = document.querySelector(".hero");
  const trail = document.getElementById("vinylTrail");
  if (!hero || !trail) return () => {};

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!canHover.matches || reducedMotion.matches) return () => {};

  const discEls = [...trail.querySelectorAll(".vinyl-disc")];
  if (!discEls.length) return () => {};

  discEls.forEach((el) => {
    const src = el.querySelector("img")?.getAttribute("src");
    if (src) new Image().src = src;
  });

  const SHOW_THRESHOLD = 100; // px moved since the last switch before the next disc takes over
  const FADE_MS = 260; // matches the CSS opacity/transform transition duration
  const LEAVE_FADE_MS = 300;
  const SMOOTHING_BASE = 0.16;

  const shuffle = (arr) => {
    const next = arr.slice();
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const discs = discEls.map((el) => ({
    el,
    x: 0,
    y: 0,
    // Each disc gets a slightly different lag, so a few visible at once
    // (during a crossfade) drift as a loose multi-layer trail rather than
    // moving in lockstep.
    smoothing: SMOOTHING_BASE + (Math.random() * 0.05 - 0.025),
    active: false,
    fadeTimeout: null,
  }));

  let order = shuffle(discs.map((_, i) => i));
  let orderPos = -1;
  let currentDisc = null;

  let targetX = 0;
  let targetY = 0;
  let lastTriggerX = null;
  let lastTriggerY = null;

  let rafId = null;

  const tick = () => {
    let anyActive = false;
    for (const d of discs) {
      if (!d.active) continue;
      anyActive = true;
      d.x += (targetX - d.x) * d.smoothing;
      d.y += (targetY - d.y) * d.smoothing;
      d.el.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;
    }
    rafId = anyActive ? requestAnimationFrame(tick) : null;
  };

  const ensureLoop = () => {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  };

  const showNextDisc = () => {
    orderPos += 1;
    if (orderPos >= order.length) {
      order = shuffle(discs.map((_, i) => i));
      orderPos = 0;
    }
    const next = discs[order[orderPos]];
    const prev = currentDisc;

    clearTimeout(next.fadeTimeout);

    // Start the new disc from wherever the previous one currently is (not
    // the cursor) so it visibly travels to catch up instead of teleporting.
    next.x = prev ? prev.x : targetX;
    next.y = prev ? prev.y : targetY;
    next.active = true;
    next.el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    next.el.style.setProperty("--enter-rot", `${(Math.random() * 20 - 10).toFixed(2)}deg`);

    // Force a reflow so a reused disc's entrance transition restarts
    // instead of the browser coalescing the class removal/re-add.
    next.el.classList.remove("is-visible");
    void next.el.offsetWidth;
    next.el.classList.add("is-visible");

    if (prev && prev !== next) {
      prev.el.classList.remove("is-visible");
      // Keep it chasing the cursor for the duration of its fade-out, so the
      // outgoing and incoming discs are both visibly in motion during the
      // crossfade instead of one freezing in place.
      prev.fadeTimeout = setTimeout(() => {
        prev.active = false;
      }, FADE_MS);
    }

    currentDisc = next;
    ensureLoop();
  };

  const handleMove = (e) => {
    const rect = hero.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    ensureLoop();

    if (lastTriggerX === null) {
      lastTriggerX = targetX;
      lastTriggerY = targetY;
      showNextDisc();
      return;
    }

    if (Math.hypot(targetX - lastTriggerX, targetY - lastTriggerY) >= SHOW_THRESHOLD) {
      lastTriggerX = targetX;
      lastTriggerY = targetY;
      showNextDisc();
    }
  };

  const handleLeave = () => {
    lastTriggerX = null;
    lastTriggerY = null;
    currentDisc = null;
    discs.forEach((d) => {
      if (!d.active) return;
      clearTimeout(d.fadeTimeout);
      d.el.classList.remove("is-visible");
      d.fadeTimeout = setTimeout(() => {
        d.active = false;
      }, LEAVE_FADE_MS);
    });
  };

  hero.addEventListener("mousemove", handleMove);
  hero.addEventListener("mouseleave", handleLeave);

  const destroy = () => {
    hero.removeEventListener("mousemove", handleMove);
    hero.removeEventListener("mouseleave", handleLeave);
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    discs.forEach((d) => clearTimeout(d.fadeTimeout));
  };

  window.addEventListener("pagehide", destroy, { once: true });

  return destroy;
}
