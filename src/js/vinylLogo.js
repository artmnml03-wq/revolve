/**
 * <VinylLogo />, vanilla-style: the vinyl-white.svg asset (dark body, groove
 * rings, white center label) injected into every `.logo` — navbar and
 * footer both get the exact same markup from this one source. Spins
 * continuously via CSS (see .vinyl-logo in animations.css), height tied to
 * the logo text via em units so it scales with it at every breakpoint.
 */
export function initVinylLogos() {
  document.querySelectorAll(".logo").forEach((logo) => {
    if (logo.querySelector(".vinyl-logo")) return;
    const icon = document.createElement("img");
    icon.className = "vinyl-logo";
    // BASE_URL: "/" locally, "/<repo>/" on GitHub Pages — Vite doesn't rewrite JS strings.
    icon.src = `${import.meta.env.BASE_URL}img/vinyl-white.svg`;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    logo.prepend(icon);
  });
}
