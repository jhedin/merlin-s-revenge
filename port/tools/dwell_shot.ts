import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
await page.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.keyboard.press("Space"); await page.waitForTimeout(300); // title -> cutscene
await page.keyboard.press("Escape"); await page.waitForTimeout(400); // skip -> playing
console.log("mode after skip:", await page.evaluate(`window.__mode()`));
let info: any = { dwellings: 0 };
for (let step = 0; step < 10; step++) {
  info = await page.evaluate(`(() => {
    const g = window.__game;
    let dwellings = 0;
    for (const e of g.entities) if (e.comps.find((c) => "produces" in c)) dwellings++;
    return { room: window.__rooms() ? window.__rooms().loc.x : -1, dwellings, entities: g.entities.length };
  })()`);
  if (info.dwellings > 0) break;
  await page.keyboard.down("ArrowRight"); await page.waitForTimeout(750); await page.keyboard.up("ArrowRight");
}
const before = await page.evaluate(`window.__game.entities.filter(e=>e.type==='enemy').length`);
await page.waitForTimeout(8500);
const after = await page.evaluate(`window.__game.entities.filter(e=>e.type==='enemy').length`);
await page.screenshot({ path: "dwellings.png" });
await browser.close();
console.log("found:", JSON.stringify(info), "enemies before:", before, "after 8.5s:", after);
