import { gsap, DURATION_BASE, EASING, STAGGER, REDUCED_MOTION } from "../lib/animation.js";

/**
 * Hero intro: title types on word-by-word (fade + slide in from the left),
 * then the paragraph fades up, then the button fades/scales in. Runs once
 * on load — this is the first thing visible, not scroll-triggered.
 */
export function initHeroIntro() {
  const title = document.querySelector(".hero__title");
  const text = document.querySelector(".hero__text");
  const btn = document.querySelector(".hero__content .btn");
  if (!title) return;

  const words = title.textContent.trim().split(/\s+/);
  title.innerHTML = words
    .map((w) => `<span class="hero-word">${w}</span>`)
    .join(" ");
  const wordEls = title.querySelectorAll(".hero-word");

  if (REDUCED_MOTION) {
    gsap.set(wordEls, { clearProps: "all" });
    if (text) gsap.set(text, { clearProps: "all" });
    if (btn) gsap.set(btn, { clearProps: "all" });
    return;
  }

  gsap.set(wordEls, { opacity: 0, x: -20 });
  if (text) gsap.set(text, { opacity: 0, y: 10 });
  if (btn) gsap.set(btn, { opacity: 0, scale: 0.95 });

  // Each phase starts only once the previous one has fully finished — a
  // short "+=" gap between them, no overlap, so it reads as a sequence
  // (title, then paragraph, then button) rather than a single crossfade.
  const tl = gsap.timeline({ defaults: { ease: EASING } });

  tl.to(wordEls, {
    opacity: 1,
    x: 0,
    duration: DURATION_BASE,
    stagger: STAGGER,
  });

  if (text) {
    tl.to(text, { opacity: 1, y: 0, duration: DURATION_BASE }, "+=0.1");
  }

  if (btn) {
    tl.to(btn, { opacity: 1, scale: 1, duration: DURATION_BASE }, "+=0.1");
  }
}
