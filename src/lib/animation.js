import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Single source of truth for timing/easing across the whole site — every
 * animation module imports these instead of hardcoding its own numbers.
 * Mirrored (same literal values) in src/styles/animation-tokens.css for the
 * handful of places that animate via plain CSS transitions instead of GSAP.
 */
export const DURATION_BASE = 0.6; // fade/slide elements
export const DURATION_SLOW = 0.9; // large blocks/images
export const EASING = "cubic-bezier(0.22, 1, 0.36, 1)"; // ease-out-expo-ish
export const STAGGER = 0.13; // between sequential elements (0.12–0.15s)

export const REDUCED_MOTION = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/**
 * The CSS "desktop" condition (layout.css/base.css `@media (min-width:
 * 1024px) and (orientation: landscape)`) — width alone isn't enough, since
 * a portrait tablet at exactly 1024px wide (iPad Pro 12.9") is tall, not
 * wide, and needs the tablet layout, not the one built for a wide window.
 * Exported so every place that needs to match the CSS breakpoint (this
 * file, main.js's layoutExplodedCallouts) reads it from one place.
 */
export const DESKTOP_MEDIA_QUERY = "(min-width: 1024px) and (orientation: landscape)";

/**
 * Inverse of DESKTOP_MEDIA_QUERY — matches the same tablet/mobile range
 * responsive.css/tokens.css use (`(max-width: 1023px), (orientation:
 * portrait)`). Read once at load, like REDUCED_MOTION — these are
 * scroll-triggered animations set up once at init, not something that
 * needs to react live to a resize/rotation.
 */
export const IS_COMPACT = !window.matchMedia(DESKTOP_MEDIA_QUERY).matches;

/** Fade-up distance for the simplified mobile/tablet reveal (20–30px). */
export const FADE_UP_DISTANCE = 26;

/**
 * The ONE scroll-trigger point every section on the site uses — no section
 * gets its own bespoke value. In GSAP ScrollTrigger's "top X%" syntax this
 * means: fire once the trigger's top edge has scrolled up to 80% of the
 * viewport height, i.e. the section has just started entering from the
 * bottom (roughly the top 20% of the screen is section, the rest is
 * whatever came before it) — not the instant it merely touches the bottom
 * edge of the screen. This is the GSAP equivalent of the Framer-Motion/
 * IntersectionObserver pairing of `rootMargin: "0px 0px -20% 0px"` +
 * `threshold`/`amount` — ScrollTrigger's single position string already
 * folds both the bottom cutoff and the minimum-visible-amount into one
 * number, so there's no separate margin/amount pair to keep in sync here.
 */
export const SCROLL_TRIGGER_START = "top 80%";

/**
 * For the LAST element on the page (the footer) — or anything else with no
 * content below it to scroll to — a plain "top X%" viewport-relative start
 * can be mathematically unreachable: it requires scrolling the element's
 * top edge up to X% of the viewport height, but at max scroll an element
 * shorter than (1 - X)% of the viewport never gets there (its bottom is
 * already pinned to the viewport's bottom edge). Fraction of the ELEMENT'S
 * OWN height, used only by ownHeightTriggerStart() below.
 */
export const FOOTER_TRIGGER_AMOUNT = 0.15;

/**
 * Runs `onEnter` once, the first time `trigger` crosses `start` — never
 * re-fires on scroll back up/down past it. Every call on the site uses the
 * default (SCROLL_TRIGGER_START) except the footer, which has its own
 * always-reachable start (see ownHeightTriggerStart) since it's the last
 * thing on the page — that's the one deliberate, documented exception, not
 * a place for per-section values to quietly drift.
 */
export function onceInView(trigger, onEnter, start = SCROLL_TRIGGER_START) {
  if (REDUCED_MOTION) {
    onEnter();
    return;
  }
  ScrollTrigger.create({ trigger, start, once: true, onEnter });
}

/**
 * A scroll-trigger start position guaranteed reachable even for the very
 * last element on the page, expressed as a fraction of the ELEMENT'S OWN
 * height rather than a fixed percentage of the viewport. At max scroll, an
 * element's bottom always aligns with the viewport's bottom edge, so "top
 * bottom-=(ownHeight * amount)" can never require scrolling past the end of
 * the document — unlike SCROLL_TRIGGER_START's "top 80%", which can. Returns
 * a function (not a string) because ScrollTrigger re-invokes it on refresh,
 * which keeps it correct if the element's height changes on resize.
 */
export function ownHeightTriggerStart(el, amount = FOOTER_TRIGGER_AMOUNT) {
  return () => `top bottom-=${Math.round(el.getBoundingClientRect().height * amount)}px`;
}

// Document height shifts after web fonts / large images finish loading can
// leave ScrollTrigger's cached trigger positions stale (computed against a
// shorter page). Refresh once everything has actually loaded so "start"
// reflects final layout, not the first-paint one.
window.addEventListener("load", () => ScrollTrigger.refresh());

/**
 * Desktop only: moves an element's existing content into a nested
 * `.reveal-mask__inner` span and adds `.reveal-mask` (overflow: hidden) to
 * the element itself, so the content can be animated as translateY(100% →
 * 0) "sliding out from under a mask" without an extra wrapper element
 * disturbing the original element's own margins/layout rules.
 *
 * On mobile/tablet (IS_COMPACT) every reveal — text, images, form fields —
 * uses the same plain fade-up instead (see setMaskHidden/playMaskReveal
 * below), so there's nothing to wrap: this just hands back the original
 * element, untouched, as the animation target.
 */
export function wrapMaskReveal(el) {
  if (!el) return null;
  if (IS_COMPACT) return el;
  if (el.dataset.maskWrapped) return el.querySelector(".reveal-mask__inner");
  const inner = document.createElement("span");
  inner.className = "reveal-mask__inner";
  inner.innerHTML = el.innerHTML;
  el.innerHTML = "";
  el.appendChild(inner);
  el.classList.add("reveal-mask");
  el.dataset.maskWrapped = "true";
  return inner;
}

/**
 * Puts a reveal target (a mask-wrapped inner span on desktop, or the plain
 * element itself on mobile/tablet — whatever wrapMaskReveal returned) into
 * its hidden resting state. Call this synchronously, right after
 * wrapMaskReveal — before any scroll trigger is even created — so the
 * element is already invisible from first paint instead of sitting fully
 * visible until the moment it happens to animate.
 */
export function setMaskHidden(target) {
  if (!target || REDUCED_MOTION) return;
  if (IS_COMPACT) {
    gsap.set(target, { opacity: 0, y: FADE_UP_DISTANCE });
  } else {
    gsap.set(target, { yPercent: 100, opacity: 0 });
  }
}

/**
 * Animates a reveal target in: the mask wipe (translateY 100% → 0 +
 * opacity) on desktop, or a plain fade-up (opacity + translateY 26px → 0,
 * no mask/overflow involved — direction-based slides and mask wipes both
 * read as more "designed" than this site wants on a narrow screen) on
 * mobile/tablet. Same DURATION_BASE/EASING either way.
 */
export function playMaskReveal(target, delay = 0) {
  if (!target) return;
  if (REDUCED_MOTION) {
    gsap.set(target, { clearProps: "all" });
    return;
  }
  if (IS_COMPACT) {
    gsap.to(target, { opacity: 1, y: 0, duration: DURATION_BASE, ease: EASING, delay });
  } else {
    gsap.to(target, {
      yPercent: 0,
      opacity: 1,
      duration: DURATION_BASE,
      ease: EASING,
      delay,
    });
  }
}

export { gsap, ScrollTrigger };
