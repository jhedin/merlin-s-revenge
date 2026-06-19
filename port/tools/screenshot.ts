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
await page.waitForTimeout(400);
await page.keyboard.press("Space"); // start
await page.waitForTimeout(500);
// move down toward the enemy cluster, then fire a burst to freeze them
await page.keyboard.down("ArrowDown"); await page.waitForTimeout(500); await page.keyboard.up("ArrowDown");
await page.keyboard.down("ArrowLeft"); await page.waitForTimeout(400);
for (let i = 0; i < 8; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(55); }
await page.keyboard.up("ArrowLeft");

const state = await page.evaluate(`(() => {
  const g = window.__game;
  const enemies = g.entities.filter((e) => e.type === "enemy");
  let frozen = 0;
  for (const e of enemies) if (e.send("isFrozen")) frozen++;
  const chars = {};
  for (const e of enemies) { const a = e.comps.find((c) => "char" in c); chars[a.char] = (chars[a.char]||0)+1; }
  return { mode: window.__mode(), enemies: enemies.length, frozen, roster: chars };
})()`);

await page.screenshot({ path: "slice.png" });
await browser.close();
console.log("console:", logs.filter((l) => !l.includes("404")).join(" | "));
console.log("state:", JSON.stringify(state));
