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
// capture during the approach: enemies still crossing the room, so bullets are visibly in transit
await page.waitForTimeout(350);
for (let i = 0; i < 6; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(70); }

const state = await page.evaluate(`(() => {
  const g = window.__game;
  const counts = { player: 0, enemy: 0, bullet: 0 };
  for (const e of g.entities) counts[e.type] = (counts[e.type] || 0) + 1;
  return { counts, pool: window.__bulletStats ? window.__bulletStats() : null };
})()`);

await page.screenshot({ path: "slice.png" });
await browser.close();
console.log("console:", logs.filter((l) => !l.includes("404")).join(" | "));
console.log("state:", JSON.stringify(state));
