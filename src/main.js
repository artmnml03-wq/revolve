import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import "./styles/tokens.css";
import "./styles/animation-tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/animations.css";
import "./styles/responsive.css";

import { initVinylTrail } from "./js/vinylTrail.js";
import { initVinylLogos } from "./js/vinylLogo.js";
import { initHeroIntro } from "./js/heroIntro.js";
import { initSectionReveals } from "./js/sectionReveals.js";
import { DESKTOP_MEDIA_QUERY } from "./lib/animation.js";

initVinylTrail();
initVinylLogos();
initHeroIntro();
initSectionReveals();

const toggle = document.querySelector(".nav__toggle");
const nav = document.querySelector(".nav");

toggle?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(isOpen));
});

// Header is transparent over the hero (per design), but once the page
// scrolls, content passes under the fixed header — without a backdrop the
// logo/nav sit directly on top of body text. Solid-ish blurred bar from
// the first few px of scroll on.
const header = document.querySelector(".header");
const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

// Mobile menu: tapping a link navigates to its section — close the
// dropdown so it isn't left covering the content it just scrolled to.
nav?.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    if (!nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  }),
);

/**
 * The "Crafted to last" callouts point at exact spots on a full-bleed
 * object-fit:cover photo. Cover crops the image to fill the section, and
 * how much gets cropped depends on the section's own aspect ratio — so a
 * callout position fixed in rem/% drifts off the part it's supposed to mark
 * whenever the window is resized. This recomputes every callout from the
 * image's actual rendered (cropped) box on load and on resize.
 */
function layoutExplodedCallouts() {
  const frame = document.querySelector(".exploded__frame");
  const img = document.querySelector(".exploded__img");
  const svg = document.getElementById("explodedLines");
  const callouts = [...document.querySelectorAll("#calloutList .callout")];
  if (!frame || !img || !svg || !callouts.length) return;

  if (!window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
    // Mobile/tablet (including a portrait ≥1024px-wide tablet — see
    // DESKTOP_MEDIA_QUERY) use a static stacked layout — let CSS own it.
    svg.removeAttribute("viewBox");
    callouts.forEach((c) => {
      c.style.left = "";
      c.style.top = "";
      c.style.width = "";
    });
    return;
  }

  const naturalW = img.naturalWidth || 2816;
  const naturalH = img.naturalHeight || 1584;
  const frameW = frame.clientWidth;
  const frameH = frame.clientHeight;
  if (!frameW || !frameH) return;

  const scale = Math.max(frameW / naturalW, frameH / naturalH);
  const renderedW = naturalW * scale;
  const renderedH = naturalH * scale;
  const offsetX = (frameW - renderedW) / 2;
  const offsetY = (frameH - renderedH) / 2;

  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const angle = (15 * Math.PI) / 180;
  const textLineH = rootPx; // 1rem line-height:1
  const textGap = 0.625 * rootPx; // 10px baseline

  svg.setAttribute("viewBox", `0 0 ${frameW} ${frameH}`);
  const lines = svg.querySelectorAll("polyline");
  const dots = svg.querySelectorAll("circle");
  const strokeWidth = rootPx / 16; // 1px baseline
  const dotRadius = (rootPx / 16) * 2; // 2px baseline
  lines.forEach((l) => (l.style.strokeWidth = String(strokeWidth)));
  dots.forEach((d) => d.setAttribute("r", String(dotRadius)));

  callouts.forEach((callout, i) => {
    const attachXPct = parseFloat(callout.dataset.attachX) / 100;
    const attachYPct = parseFloat(callout.dataset.attachY) / 100;
    const dir = parseFloat(callout.dataset.dir);
    const height = (parseFloat(callout.dataset.height) / 16) * rootPx;
    const width = (parseFloat(callout.dataset.width) / 16) * rootPx;

    const attachX = offsetX + attachXPct * renderedW;
    const attachY = offsetY + attachYPct * renderedH;
    const shelfY = attachY - height;
    const bendX = attachX + dir * height * Math.tan(angle);
    const shelfEndX = bendX + dir * width;

    const line = lines[i];
    const dot = dots[i];
    if (line) {
      line.setAttribute(
        "points",
        `${attachX},${attachY} ${bendX},${shelfY} ${shelfEndX},${shelfY}`
      );
    }
    if (dot) {
      dot.setAttribute("cx", String(shelfEndX));
      dot.setAttribute("cy", String(shelfY));
    }

    const textTop = shelfY - 2 * textLineH - textGap;
    const textLeft = dir > 0 ? bendX : shelfEndX;

    callout.style.left = `${textLeft}px`;
    callout.style.top = `${textTop}px`;
    callout.style.width = `${width}px`;
  });
}

if (document.querySelector(".exploded__img")) {
  const img = document.querySelector(".exploded__img");
  if (img.complete) {
    layoutExplodedCallouts();
  } else {
    img.addEventListener("load", layoutExplodedCallouts, { once: true });
  }
  window.addEventListener("resize", layoutExplodedCallouts);
}
