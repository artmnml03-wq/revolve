// Renders the reel frame by frame in real Chrome, on a virtual clock, then encodes it to mp4.
//
//   node render.mjs                         full render → out/revolve-reel.mp4
//   node render.mjs --frames 0.6,3,14.4     only those moments, saved as PNG in preview/ (to look at the design)
//   node render.mjs --no-encode             frames only
//
// Why a virtual clock: the site animates by scroll progress with time-based smoothing (GSAP). Every frame
// we set the scroll position, advance the site's own clock by exactly 1/30 s and take a screenshot, so the
// result is the same on every run and does not depend on how fast the computer is.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { startServer } from "./serve.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 1080, H = 1920;
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? true;
};
const only = arg("--frames");
const noEncode = process.argv.includes("--no-encode");

if (!fs.existsSync(path.join(here, ".site/index.html"))) {
  console.error("Build the site first:  npm run site");
  process.exit(1);
}

// Runs inside every iframe (the two copies of the site): a controllable clock, no pop-up, no real playback.
const VIRTUAL_CLOCK = () => {
  if (window.top === window) return;
  let now = 0, id = 0;
  const queue = new Map();
  performance.now = () => now;
  Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = (cb) => { queue.set(++id, cb); return id; };
  window.cancelAnimationFrame = (i) => queue.delete(i);
  window.__vt = {
    step(ms) {
      now += ms;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) { try { cb(now); } catch (e) { console.error(e); } }
    },
    // CSS animations and transitions follow the same clock
    sync() {
      for (const a of document.getAnimations()) {
        if (a.__t0 === undefined) a.__t0 = now;
        a.pause();
        a.currentTime = now - a.__t0;
      }
    },
  };
  // the site shuffles its cursor-trail discs with Math.random — seed it so every run is identical
  let seed = 42;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  HTMLMediaElement.prototype.pause = function () {};
};

// One frame = place everything (scene) → move the real mouse there (CSS :hover only answers a real mouse,
// and headless Chrome never draws it, so the scene paints its own pointer) → let Chrome repaint → advance the clocks.
let mouseIn = false;
async function renderFrame(page, t, settle = 1) {
  const at = await page.evaluate((time) => window.__prepare(time), t);
  let moved = false;
  if (at) {
    await page.mouse.move(at.x, at.y);
    mouseIn = moved = true;
  } else if (mouseIn) {
    await page.mouse.move(2, 2); // out of the laptop: the hover ends
    mouseIn = false;
    moved = true;
  }
  if (moved) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate((time, n) => window.__step(time, n), t, settle);
}

const server = await startServer(4599);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ["--hide-scrollbars", "--force-color-profile=srgb", "--autoplay-policy=no-user-gesture-required", "--font-render-hinting=none"],
});

try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.evaluateOnNewDocument(VIRTUAL_CLOCK);
  await page.goto("http://127.0.0.1:4599/", { waitUntil: "load" });
  const pos = await page.evaluate(() => window.__ready);
  console.log("section positions (desktop):", JSON.stringify(pos.mac));
  console.log("section positions (phone):  ", JSON.stringify(pos.phone));
  const { duration, fps } = await page.evaluate(() => ({ duration: window.__duration, fps: window.__fps }));

  if (only) {
    const dir = path.join(here, "preview");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const value of String(only).split(",")) {
      const t = Number(value);
      // settle: let the scrubbed animations catch up, as they would after a second of scrolling
      await renderFrame(page, t, 30);
      const file = path.join(dir, `t${String(t).replace(".", "_")}.png`);
      await page.screenshot({ path: file, type: "png" });
      console.log("preview", file);
    }
  } else {
    const dir = path.join(here, "frames");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const total = Math.round(duration * fps);
    const started = Date.now();
    for (let n = 0; n < total; n++) {
      await renderFrame(page, n / fps);
      await page.screenshot({ path: path.join(dir, `f${String(n).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
      if (n % 30 === 0) {
        const per = (Date.now() - started) / (n + 1) / 1000;
        console.log(`frame ${n}/${total}  ~${Math.round(per * (total - n))} s left`);
      }
    }
    console.log(`rendered ${total} frames in ${Math.round((Date.now() - started) / 1000)} s`);
    if (!noEncode) {
      fs.mkdirSync(path.join(here, "out"), { recursive: true });
      const out = path.join(here, "out/revolve-reel.mp4");
      const r = spawnSync("swift", [path.join(here, "encode.swift"), dir, String(fps), out], { stdio: "inherit" });
      if (r.status !== 0) throw new Error("encoding failed");
      // a cover picture for Instagram: the moment the scene names in window.__cover
      const coverT = await page.evaluate(() => window.__cover);
      const cover = path.join(dir, `f${String(Math.round(coverT * fps)).padStart(5, "0")}.jpg`);
      if (fs.existsSync(cover)) fs.copyFileSync(cover, path.join(here, "out/cover.jpg"));
      console.log("done →", out);
    }
  }
} finally {
  await browser.close();
  server.close();
}
