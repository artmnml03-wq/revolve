import puppeteer from "puppeteer-core";
const [url, tag, out] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--hide-scrollbars"] });
for (const [w, h, mobile] of [[390, 844, true], [768, 1024, true]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 150) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } });
  await new Promise((r) => setTimeout(r, 3000));
  await page.evaluate(() => { document.querySelector(".header").style.display = "none"; scrollTo(0, 0); });
  const el = await page.$("#catalog");
  await el.screenshot({ path: `${out}/${tag}-${w}.png` });
  await page.close();
}
await browser.close();
