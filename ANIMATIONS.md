# Animations

Stack: vanilla JS + Vite, no framework. Animation library: **GSAP** (`gsap`) +
its **ScrollTrigger** plugin — installed fresh for this work (nothing was in
`package.json` before). Framer Motion wasn't an option since there's no React
here.

## Single source of truth for timing

[`src/lib/animation.js`](src/lib/animation.js) exports the constants every
animation module imports — nothing hardcodes its own duration/easing:

```js
DURATION_BASE = 0.6   // fade/slide elements
DURATION_SLOW = 0.9   // large blocks/images
EASING = "cubic-bezier(0.22, 1, 0.36, 1)"   // ease-out-expo-ish
STAGGER = 0.13         // between sequential elements (0.12–0.15s)
REDUCED_MOTION         // matchMedia("(prefers-reduced-motion: reduce)").matches, read once at load
```

[`src/styles/animation-tokens.css`](src/styles/animation-tokens.css) mirrors
the duration/easing as `--dur-base` / `--dur-slow` / `--ease` / `--stagger`
for the few spots that use a plain CSS `transition` instead of a GSAP tween
(footer/nav link hover, the vinyl-logo spin). **If you change the numbers in
one file, change them in the other.**

Also in `animation-tokens.css`: `--link-idle-opacity: 0.7` — the idle
opacity for secondary nav links, shared by the navbar and the footer (see
below).

### Shared helpers (`src/lib/animation.js`)

- `SCROLL_TRIGGER_START = "top 80%"` — the trigger point every element with
  scroll room below it uses (i.e. everything except the footer — see
  `ownHeightTriggerStart` below). In ScrollTrigger's `"top X%"` syntax this
  fires once the trigger's top edge has scrolled up to 80% of the viewport
  height — i.e. the element has just started entering from the bottom, not
  the instant it merely touches the screen's bottom edge. This is the GSAP
  equivalent of pairing `rootMargin: "0px 0px -20% 0px"` with a
  `threshold`/`amount` in IntersectionObserver/Framer Motion terms —
  ScrollTrigger's single position string already folds both the bottom
  cutoff and the minimum-visible-amount into one number, so there's no
  separate margin/amount pair to keep in sync here.
- `onceInView(trigger, onEnter, start = SCROLL_TRIGGER_START)` — thin
  wrapper around `ScrollTrigger.create({ trigger, start, once: true,
  onEnter })`. `once: true` guarantees it fires exactly once, the first time
  it crosses the threshold — never again on scroll back up/down past it.
  Under reduced motion it just calls `onEnter()` immediately instead of
  creating a trigger. The `start` override exists for exactly one
  documented case (the footer's `ownHeightTriggerStart`, below) — every
  other call site uses the default, so nothing else quietly drifts.
- `ownHeightTriggerStart(el, amount = FOOTER_TRIGGER_AMOUNT)` — a start
  position expressed as a fraction of the *element's own height* instead of
  a fixed percentage of the viewport: `"top bottom-=(ownHeight * amount)"`.
  Returns a function (ScrollTrigger re-invokes it on refresh, so it stays
  correct if the element resizes). See "Bugfix: footer never appeared"
  below for why this exists.
- `wrapMaskReveal(el)` — moves an element's existing content into a nested
  `.reveal-mask__inner` span and adds `.reveal-mask` (overflow: hidden) to
  the element itself. Used for every "mask + opacity, slides up from
  underneath" heading/paragraph. Wrapping the *content* rather than the
  element means the element's own margin/layout rules are untouched.
- `setMaskHidden(inner)` — puts a mask-wrapped inner span into its hidden
  resting state (`yPercent: 100, opacity: 0`). Called immediately after
  `wrapMaskReveal`, **before** any `ScrollTrigger` is even created (see
  below) — not lazily inside `onEnter`.
- `playMaskReveal(inner, delay)` — animates an already-hidden mask-wrapped
  inner span in, from `translateY(100%) opacity:0` to `translateY(0)
  opacity:1`. Only called from inside a section's `onceInView` callback.

**Every** scroll-animated element — mask-reveal text, the section-2 images,
section-3 callouts/counters, section-4 form fields, the footer — has its
hidden starting state applied via `gsap.set(...)` (or `setMaskHidden` for
mask text) synchronously, at module init / page load, before the user has
scrolled at all and before any `ScrollTrigger` fires. Only the *animate-in*
call sits inside the `onceInView` callback. Earlier this was inconsistent:
image/counter/form-field hidden state was already eager, but the mask-reveal
text blocks were only wrapped-and-hidden lazily, inside `onEnter`, at the
same instant they started animating — which meant there was no separate
"hidden" period for them at all, just "normal" then "wrapped, hidden and
animating" in the same tick. `wrapMaskReveal`/`setMaskHidden` are now always
called eagerly and `playMaskReveal` (the actual tween) is the only part left
inside `onEnter`, for every section, matching the images/counters/form
fields. This also means: if JS never runs at all, content simply stays
visible (progressive enhancement, no permanently-invisible page) — the
"hidden" state only ever exists as an inline style GSAP itself applied.

GSAP `ScrollTrigger.refresh()` is also called once on `window`'s `load`
event (`src/lib/animation.js`) — web fonts and the large hero/section images
finishing after first script execution can shift document height enough to
make a trigger's cached position stale; this re-measures against the
final, settled layout.

## Reduced motion

`REDUCED_MOTION` is read once at load. Every animation module branches on it:
scroll-triggered sections reveal instantly (no transform/opacity transition,
`onceInView` fires `onEnter` right away instead of waiting on scroll), the
hero intro sets its final state directly instead of running the timeline,
and the stat counters jump straight to their target number instead of
ticking up. The two purely-CSS animations (vinyl-logo spin, the hero cursor
vinyl-trail — see below) are disabled via
`@media (prefers-reduced-motion: reduce)` / their own `matchMedia` check.

## Mobile/tablet: simplified reveal

`IS_COMPACT` (`src/lib/animation.js`) is `matchMedia("(max-width: 1023px)")`,
the same width the CSS breakpoints use, read once at load like
`REDUCED_MOTION`. Below that width, every scroll-reveal on the site collapses
to one shared motion — plain `opacity 0→1` + `translateY(26px→0)`
(`FADE_UP_DISTANCE`), same `DURATION_BASE`/`EASING`/`STAGGER` as desktop —
instead of desktop's mix of mask-wipe text and left/right image slides:

- `wrapMaskReveal`/`setMaskHidden`/`playMaskReveal` (used for every heading
  and paragraph) branch on `IS_COMPACT` internally: on desktop they do the
  usual wrap-in-a-`.reveal-mask__inner`-span + `yPercent` wipe; on
  mobile/tablet `wrapMaskReveal` skips the DOM wrap entirely and hands back
  the original element, which the other two just fade/slide directly. Call
  sites in `sectionReveals.js` don't know or care which mode is active —
  the branching is fully inside `animation.js`.
- Section-2's images (`slideOffset()` in `sectionReveals.js`) get `y:
  FADE_UP_DISTANCE` instead of desktop's `x: ±60`, and `DURATION_BASE`
  instead of `DURATION_SLOW` — no horizontal slide direction at all on a
  narrow screen (also removes any risk of it contributing to horizontal
  overflow, independent of the `html { overflow-x: hidden }` fix below).
- Section-3's callouts and the hero hero-word/counter animations are
  untouched by `IS_COMPACT` — they were already viewport-agnostic (plain
  opacity, or a page-load timeline unrelated to scroll width).

## Performance

Every animation is `transform`/`opacity` only — no `left`/`top`/`width`/
`height`. `will-change: transform, opacity` is set on the handful of
GSAP-animated containers (`.reveal-mask__inner`, `.hero-word`, `.vinyl-logo`,
`.split-media__col`, `.callout`, `.stat__value-suffix`, `.stat__label`,
`.footer`, form fields) — not applied blanket-wide. Mask-reveal containers
get a small `padding-block: 0.1em; margin-block: -0.1em;` buffer
(`.reveal-mask` in `src/styles/animations.css`) so the site's tight
(`line-height: 0.9`) heading type doesn't clip ascenders/descenders against
the `overflow: hidden` mask.

---

## Vinyl logo (navbar + footer)

[`src/js/vinylLogo.js`](src/js/vinylLogo.js) — `initVinylLogos()` injects an
`<img class="vinyl-logo" src="/img/vinyl-white.svg">` into every `.logo`
element found in the DOM (navbar *and* footer both carry `class="logo"`, so
one function call handles both; this is the vanilla-JS equivalent of a
reusable `<VinylLogo />` — same markup, same CSS, injected wherever `.logo`
appears rather than duplicated by hand). The asset itself
(`reference/assets/vinyl-white.svg`, copied to `public/img/vinyl-white.svg`)
is a dark vinyl disc with groove rings and a white center label.

- Size: `.vinyl-logo { width: 1.1em; height: 1.1em; }` — scales with the
  logo text automatically at every breakpoint (`.logo` font-size changes via
  `--logo-size`/the responsive `html { font-size }` clamp; the icon rides
  along for free).
- Spin: `@keyframes vinyl-logo-spin` (`src/styles/animations.css`), `4s
  linear infinite`, running always — not gated on hover. Disabled under
  `prefers-reduced-motion: reduce`.

## Footer / nav link idle opacity

`--link-idle-opacity: 0.7` (`animation-tokens.css`) is the one number both
`.nav__list a` (navbar) and `.footer__nav a` / `.footer__social a` (footer)
read for their resting opacity; hover transitions to `opacity: 1` over
`0.28s var(--ease)` in both places.

---

## Section 1 — Hero

[`src/js/heroIntro.js`](src/js/heroIntro.js) — `initHeroIntro()`, runs once
on load (not scroll-triggered — it's the first thing on screen).

1. **Title** — split into words (not letters; the sentence is long enough
   that per-letter would take too long to read), each wrapped in a
   `.hero-word` span. `gsap.timeline` tweens `opacity 0→1, x: -20px→0`,
   `stagger: STAGGER (0.13s)`, `duration: DURATION_BASE (0.6s)`.
2. **Paragraph** (`.hero__text`) — `opacity 0→1, y: 10px→0`, starts only
   after the title's tween has fully finished (`"+=0.1"` position — a small
   gap, not an overlap).
3. **Button** (`.btn`, "buy now") — `opacity 0→1, scale: 0.95→1`, starts
   after the paragraph finishes, same `"+=0.1"` gap.

This sequence is unchanged on mobile/tablet — explicitly out of scope for
the responsive pass. What *does* change below `min-width: 1024px`
(`responsive.css`): the hero is full-bleed there too now, the same
structural trick as desktop (absolute-positioned cover image, content
overlaid at the bottom over the `.hero::after` fade) rather than the old
mobile treatment of a small centered image with text scrolled in below it.
`height: 100vh; height: 100dvh;` — the second line (dynamic viewport
height) wins in browsers that support it, so mobile browser chrome
(address bar) doesn't hide content that assumed a full `100vh`. The "buy
now" button is `width: 100%` (`.hero__content .btn` in the ≤1023px block)
instead of desktop's auto/inline width. The cursor-trail vinyl discs
(`vinylTrail.js`) were already gated behind `matchMedia("(hover: hover)
and (pointer: fine)")` with an early return — never initialized at all on
touch, not just hidden — so no change was needed there.

## Section 2 — "Feel the groove"

[`src/js/sectionReveals.js`](src/js/sectionReveals.js) —
`initGrooveSection()`.

- **Text**, top to bottom, each block mask-revealed with `STAGGER` between
  them: eyebrow ("Feel the groove") → heading → "Precision in every turn" →
  the two body paragraphs. Triggered by `onceInView(section, …)` at
  `SCROLL_TRIGGER_START` — the text sits at the top of the section, so the
  section's own top edge is a good proxy for its visibility. (Note: this is
  block-by-block, not literal per-visual-line — true per-line splitting
  needs GSAP's paid `SplitText` plugin, not available here; each
  heading/paragraph is treated as one reveal unit, which is what
  "построчно" resolves to with the free toolset.)
- **Images** (`.split-media__col`): left image `opacity 0→1, x: -60px→0`;
  right image `opacity 0→1, x: 60px→0`, both `DURATION_SLOW (0.9s)`. Each
  image has **its own** `onceInView(img, …)` trigger, separate from the
  section's and from each other — see "Bugfix: images/counters triggered by
  the section" below for why. On mobile/tablet (`IS_COMPACT`): `y:
  FADE_UP_DISTANCE→0` instead of the horizontal `x`, `DURATION_BASE`
  instead of `DURATION_SLOW` — see "Mobile/tablet: simplified reveal"
  above.

## Section 3 — "Crafted to last"

`initCraftedSection()`.

- **Heading** ("Crafted to last") and **callouts** (the 5 leader-line
  labels: leather, brass hardware, corner protection, tonearm, handle) —
  still share the section-level `onceInView(section, …)` trigger: the
  heading sits right at the section's top edge, and the callouts overlay
  the photo in the same general (upper-to-mid) area, so the section's own
  visibility is a reasonable proxy for both. Heading: same mask-reveal as
  section 2. Callouts: plain opacity fade (no transform, per spec),
  `stagger: STAGGER`, starting a beat (`STAGGER`) after the heading.
- **Stat counters** — markup: each `.stat__value` is now
  `<span class="stat__value-num" data-count-to="…" data-decimals="…">0</span><span class="stat__value-suffix">…</span>`.
  The number itself is hidden (`opacity: 0`) along with the suffix/label
  before the trigger fires — not left sitting visible at its resting "0".
  On trigger, `playCounter()` starts two tweens in the same instant, no
  delay between them: the number's own `opacity 0→1` (`DURATION_BASE`,
  0.6s) *and* a proxy `{ value: 0 }` tweening to `data-count-to` over
  `1.35s` (`ease: "power2.out"`), formatting with `data-decimals` on every
  `onUpdate`. Because the opacity fade is the shorter of the two, by the
  time the number is even partly visible it's already past 0 — confirmed
  in-browser: the first visible frame (`opacity: 0.14`) already reads `1`,
  never a static `0`. `onComplete` (of the count): the suffix (`+`, `⅓`,
  `G`, `%`) and the caption below (`.stat__label`) fade in *together*, only
  once counting is done — never while the number is still ticking. **Each
  `.stat` block (number + suffix + label) has its own `onceInView(stat, …)`
  trigger** — see "Bugfix: images/counters triggered by the section" below.

**Layout, mobile/tablet (`responsive.css`, ≤1023px):** the 2816×1584 photo
doesn't fit a portrait screen by height, so below 1024px `.exploded__frame`
becomes a 3-column grid (`1fr minmax(0, 2.5fr) 1fr`): the image sits in the
middle at `aspect-ratio: 3/4; object-fit: cover` (a reframe via cropping —
the source pixels are never rotated), flanked by two columns of callouts
instead of the desktop leader-line overlay. `.callout-list` is set to
`display: contents` so its 5 `.callout` children become direct grid items
of `.exploded__frame` alongside the image; the existing `.is-right` class
(already used on desktop to tell each leader line which way to point) sorts
callouts into the left (`grid-column: 1`) or right (`grid-column: 3`)
column, and grid auto-placement stacks same-column callouts into
successive rows with no extra markup. `.callout__label` drops to
`0.6875rem` on phones (≤599px) to fit the narrower side columns. `.stats`
was already a 2-column grid at both tablet and mobile widths (no change
needed); `.stat__label` gets `0.8125rem`/`font-weight: 500` on phones so
the caption stays legible next to the smaller (32–36px) mobile stat
numbers without shrinking further.

  `33⅓` (a vinyl speed, 33⅓ RPM) is handled as target `33` with suffix
  `⅓`, and `1.5G` as target `1.5` (`data-decimals="1"`) with suffix `G` —
  same "count, then suffix" treatment as `+` and `%`.

## Section 4 — Contact form

`initContactSection()`, same `onceInView` pattern.

- **Text** — `.contact__title` then `.contact__intro`, same mask-reveal as
  sections 2/3.
- **Form fields** (`.form-row .field` ×2, the message `.field`, `.consent`,
  `.btn--send`) — `opacity 0→1, y: 15px→0`, `stagger: STAGGER`, starting
  after the text block's own reveal sequence has had time to finish
  (`delay: textBlocks.length * STAGGER + 0.15`). Fields are set hidden via
  `gsap.set` before the section is ever in view, so unlike the hero (which
  animates on load), the form is invisible until the user actually scrolls
  to it.

## Footer

`initFooterReveal()` — its own `onceInView(footer, …, ownHeightTriggerStart(footer))`,
independent of the contact-section trigger above it (the footer is a sibling
of `.contact` inside `.section--contact`; on desktop the section is a fixed
100vh screen so both tend to appear together, but on mobile/tablet the
section reverts to normal document flow and the footer sits further down —
a separate trigger keyed to `.footer` itself handles both cases correctly
without assuming a particular layout). Uses `ownHeightTriggerStart`, not
`SCROLL_TRIGGER_START` — see "Bugfix: footer never appeared" below.

- Whole footer: `opacity 0→1, y: 40px→0`, `DURATION_BASE`, `EASING` — same
  tokens as everywhere else.
- Nav/social links: see "Footer / nav link idle opacity" above.

---

## Two scroll-trigger bugs fixed after the first pass

### Bugfix: footer never appeared

`SCROLL_TRIGGER_START` ("top 80%") is a percentage of the *viewport*: the
footer's top edge has to scroll up to 80% of viewport height before it
fires. That requires the footer to be at least ~20% of the viewport tall —
at max scroll, an element's bottom is pinned to the viewport's bottom edge,
so a *shorter* element's top can never reach that far up; the page simply
runs out of room to scroll. Measured in-browser: footer height 138px vs.
768px viewport = 18%, just under the ~20% floor — confirmed unreachable, so
the footer sat at `opacity: 0` forever while its (already-visible) black
background made it look like a dead strip at the bottom of the page.

Fixed with `ownHeightTriggerStart(el, amount)` (`src/lib/animation.js`),
used only for the footer: `"top bottom-=(footerHeight * amount)"` — a
position expressed as a fraction of the *footer's own height* rather than
the viewport's. At max scroll the footer's bottom always equals the
viewport's bottom, so this can never require scrolling past the end of the
document, regardless of how short the footer is relative to the viewport.
`FOOTER_TRIGGER_AMOUNT = 0.15` (footer needs ~15% of its own height
visible).

### Bugfix: section-2 images / section-3 counters triggered by the section

Both were wired to `onceInView(section, …)` — the *section's* top edge
entering view, not their own. Sections 2 and 3 are full 100vh blocks, so
"the section is 20% visible" only means its top sliver (which is what
happens to be there — heading text) is on screen; an image or a stat block
positioned lower inside that same section could still be entirely off
-screen. Confirmed in-browser: the (old) shared trigger fired while the
image's own top edge was still ~350px below the 80% line, and while a stat
block's own top edge was still off-screen entirely below the viewport.

Fixed by giving each of those elements its own `onceInView(el, …)` call:
`leftImg` and `rightImg` in section 2, and each `.stat` block (number +
suffix + label together) in section 3. The section-level trigger still
covers the text that sits at the top of each section (a good proxy for
"has the section started appearing") and, in section 3, the callouts
(spread across the same upper-to-mid area as the heading) — only the
elements that are meaningfully displaced from the section's own top edge
needed their own trigger.

### Bugfix: stats invisible with section 3 exactly filling the screen

Found while rendering the promo reel (2026-09-25): at 1440×900 with section 3
aligned to the viewport, each `.stat` top sits at ~89% of the viewport —
below the "top 80%" line — so the counters never started unless the user
kept scrolling into section 4. Same for the second stats row on phones.
Stats now use `ownHeightTriggerStart(stat, 0.5)` ("half of the stat
visible"), the second documented exception next to the footer.

---

## Not part of this pass (already existed)

The hero's cursor-trail vinyl discs (`src/js/vinylTrail.js`) and the
callout leader-line positioning (`layoutExplodedCallouts()` in
`src/main.js`) predate this work and weren't touched — they already had
their own `prefers-reduced-motion` / performance handling.
