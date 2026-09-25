import {
  gsap,
  onceInView,
  ownHeightTriggerStart,
  wrapMaskReveal,
  setMaskHidden,
  playMaskReveal,
  DURATION_BASE,
  DURATION_SLOW,
  EASING,
  STAGGER,
  REDUCED_MOTION,
  IS_COMPACT,
  FADE_UP_DISTANCE,
} from "../lib/animation.js";

/** Hidden/shown transform pair for a slide-in element — desktop gets the
 * direction-based horizontal slide (`x`), mobile/tablet gets the same
 * plain fade-up every other reveal on those breakpoints uses (`y`), never
 * a horizontal one (avoids both looking "different" from the rest of the
 * page and any risk of contributing to horizontal overflow on a narrow
 * screen). */
function slideOffset(desktopX) {
  return IS_COMPACT ? { y: FADE_UP_DISTANCE } : { x: desktopX };
}

/**
 * Wraps + hides a list of text blocks immediately (before any scroll has
 * happened), and returns their inner spans for playMaskSequence to animate
 * later, once the section's scroll trigger actually fires. Splitting
 * "hide" from "animate" this way is what guarantees the elements are
 * already invisible from first paint instead of sitting fully visible
 * until the moment they happen to animate in.
 */
function setupMaskBlocks(elements) {
  return elements.map((el) => {
    const inner = wrapMaskReveal(el);
    setMaskHidden(inner);
    return inner;
  });
}

/** Reveals pre-hidden mask blocks top-to-bottom with STAGGER between them. */
function playMaskSequence(inners) {
  inners.forEach((inner, i) => playMaskReveal(inner, i * STAGGER));
}

/* ============ Section 2 — "Feel the groove" ============ */

function initGrooveSection() {
  const section = document.querySelector(".section--groove");
  if (!section) return;

  const textBlocks = [
    section.querySelector(".section__eyebrow"),
    ...section.querySelectorAll(".section__head h2"),
    ...section.querySelectorAll(".section__head h3"),
    // .section__eyebrow is itself a <p> — excluded here so it isn't picked
    // up (and re-animated) a second time.
    ...section.querySelectorAll(".section__head p:not(.section__eyebrow)"),
  ].filter(Boolean);
  const textInners = setupMaskBlocks(textBlocks);

  const [leftImg, rightImg] = section.querySelectorAll(".split-media__col");
  // Desktop: images slide in from opposite sides (DURATION_SLOW, the
  // "large blocks/images" timing). Mobile/tablet: same plain fade-up as
  // everything else on those breakpoints, DURATION_BASE like every other
  // reveal there — no separate "slow" feel, for consistency (per spec).
  const imgDuration = IS_COMPACT ? DURATION_BASE : DURATION_SLOW;

  if (!REDUCED_MOTION) {
    if (leftImg) gsap.set(leftImg, { opacity: 0, ...slideOffset(-60) });
    if (rightImg) gsap.set(rightImg, { opacity: 0, ...slideOffset(60) });
  }

  onceInView(section, () => {
    playMaskSequence(textInners);
  });

  // Each image gets its OWN trigger, tied to its own position — not the
  // section's. The section is a full 100vh block; "the section is 20%
  // visible" (its top edge) does not mean an image lower down inside it is
  // anywhere near the screen yet.
  if (leftImg) {
    onceInView(leftImg, () => {
      gsap.to(leftImg, { opacity: 1, x: 0, y: 0, duration: imgDuration, ease: EASING });
    });
  }
  if (rightImg) {
    onceInView(rightImg, () => {
      gsap.to(rightImg, { opacity: 1, x: 0, y: 0, duration: imgDuration, ease: EASING });
    });
  }
}

/* ============ Section 3 — "Crafted to last" ============ */

function formatCount(value, decimals) {
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}

function playCounter(numEl) {
  const target = parseFloat(numEl.dataset.countTo);
  const decimals = parseInt(numEl.dataset.decimals || "0", 10);
  const suffix = numEl.parentElement.querySelector(".stat__value-suffix");
  const label = numEl.closest(".stat")?.querySelector(".stat__label");

  if (REDUCED_MOTION) {
    numEl.textContent = formatCount(target, decimals);
    gsap.set(numEl, { clearProps: "all" });
    if (suffix) gsap.set(suffix, { clearProps: "all" });
    if (label) gsap.set(label, { clearProps: "all" });
    return;
  }

  // Fade the number in and start the count-up in the same instant, no
  // delay between them. The fade (DURATION_BASE, 0.6s) finishes well
  // before the count (1.35s) does, so by the time the number is fully
  // opaque it's already well past 0 — nobody gets a static "0" to look at.
  gsap.to(numEl, { opacity: 1, duration: DURATION_BASE, ease: EASING });

  const proxy = { value: 0 };
  gsap.to(proxy, {
    value: target,
    duration: 1.35,
    ease: "power2.out",
    onUpdate: () => {
      numEl.textContent = formatCount(proxy.value, decimals);
    },
    onComplete: () => {
      numEl.textContent = formatCount(target, decimals);
      // The suffix ("+", "%", "G", "⅓"…) and the caption below only appear
      // once the count has finished — never while it's still ticking up.
      if (suffix) gsap.to(suffix, { opacity: 1, duration: DURATION_BASE, ease: EASING });
      if (label) gsap.to(label, { opacity: 1, duration: DURATION_BASE, ease: EASING });
    },
  });
}

function initCraftedSection() {
  const section = document.querySelector(".section--crafted");
  if (!section) return;

  const heading = section.querySelector(".display");
  const [headingInner] = setupMaskBlocks([heading].filter(Boolean));

  const callouts = [...section.querySelectorAll(".callout")];
  const stats = [...section.querySelectorAll(".stat")];

  if (!REDUCED_MOTION && callouts.length) {
    gsap.set(callouts, { opacity: 0 });
  }

  onceInView(section, () => {
    playMaskReveal(headingInner);

    if (callouts.length) {
      gsap.to(callouts, {
        opacity: 1,
        duration: DURATION_BASE,
        ease: EASING,
        stagger: STAGGER,
        delay: STAGGER,
      });
    }
  });

  // Each stat block gets its OWN trigger. The stats sit at the very bottom
  // of a full-100vh section — by the time "the section" (its top edge) is
  // 20% visible, the stats (bottom of that same screen) are nowhere near
  // visible yet, so a shared section-level trigger fired them far too
  // early.
  stats.forEach((stat) => {
    const numEl = stat.querySelector(".stat__value-num");
    const suffix = stat.querySelector(".stat__value-suffix");
    const label = stat.querySelector(".stat__label");
    if (!numEl) return;

    if (!REDUCED_MOTION) {
      // The number itself is hidden too — not just its suffix/label — so
      // there's no static "0" sitting visible before the count starts.
      gsap.set(numEl, { opacity: 0 });
      if (suffix) gsap.set(suffix, { opacity: 0 });
      if (label) gsap.set(label, { opacity: 0 });
    }

    // Start from the stat's OWN height (half of it visible), not "top 80%":
    // the stats sit at the very bottom of a 100vh section, so with the
    // section exactly filling the screen (e.g. 1440×900, or the phone's
    // second row) their top never reaches 80% and they stayed invisible.
    onceInView(stat, () => playCounter(numEl), ownHeightTriggerStart(stat, 0.5));
  });
}

/* ============ Section 4 — contact form ============ */

function initContactSection() {
  const section = document.querySelector(".section--contact");
  if (!section) return;

  const textBlocks = [
    section.querySelector(".contact__title"),
    section.querySelector(".contact__intro"),
  ].filter(Boolean);
  const textInners = setupMaskBlocks(textBlocks);

  const formFields = [
    ...section.querySelectorAll(".form-row .field"),
    section.querySelector(".form > .field"), // message field (direct child, not in .form-row)
    section.querySelector(".consent"),
    section.querySelector(".btn--send"),
  ].filter(Boolean);

  if (!REDUCED_MOTION && formFields.length) {
    gsap.set(formFields, { opacity: 0, y: 15 });
  }

  onceInView(section, () => {
    playMaskSequence(textInners);

    if (formFields.length) {
      gsap.to(formFields, {
        opacity: 1,
        y: 0,
        duration: DURATION_BASE,
        ease: EASING,
        stagger: STAGGER,
        delay: textBlocks.length * STAGGER + 0.15,
      });
    }
  });
}

/* ============ Footer ============ */

function initFooterReveal() {
  const footer = document.querySelector(".footer");
  if (!footer) return;

  if (!REDUCED_MOTION) {
    gsap.set(footer, { opacity: 0, y: 40 });
  }

  // The footer is the last thing on the page — nothing below it to scroll
  // to — so the site-wide SCROLL_TRIGGER_START ("top 80%" of the viewport)
  // can be flat-out unreachable: it'd require scrolling the footer's top
  // edge up to 80% of the viewport height, but at max scroll a footer
  // shorter than ~20% of the viewport is already as far up as it'll ever
  // go. ownHeightTriggerStart bases the trigger on the footer's OWN height
  // instead, which is always reachable.
  onceInView(
    footer,
    () => {
      gsap.to(footer, { opacity: 1, y: 0, duration: DURATION_BASE, ease: EASING });
    },
    ownHeightTriggerStart(footer)
  );
}

export function initSectionReveals() {
  initGrooveSection();
  initCraftedSection();
  initContactSection();
  initFooterReveal();
}
