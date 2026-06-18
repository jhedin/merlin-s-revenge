// Headless verification: load the built slice in chromium, drive the player, and screenshot.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const URL = process.env.URL ?? "http://localhost:5000/";

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
const logs: string[] = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// let the orcs close in and start attacking the player
await page.waitForTimeout(1800);
// player swings back a couple of times
for (let i = 0; i < 4; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(120); }
await page.waitForTimeout(300);

const state = await page.evaluate(`(() => {
  const g = window.__game;
  if (!g) return null;
  return g.entities.map((e) => {
    const m = e.comps.find((c) => "vx" in c);
    return { type: e.type, x: Math.round(m.x), y: Math.round(m.y), dead: e.send("isDead"), hp: Math.round(e.send("energyFrac") * 100) };
  });
})()`);

await page.screenshot({ path: "slice.png" });
await browser.close();
console.log("console:", logs.filter((l) => !l.includes("404")).join(" | "));
console.log("entities:", JSON.stringify(state));
