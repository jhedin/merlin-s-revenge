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
await page.waitForTimeout(800);

// drive the player right + down for a bit so we see movement + animation
await page.keyboard.down("ArrowRight");
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(700);
await page.keyboard.up("ArrowRight");
await page.keyboard.up("ArrowDown");
await page.waitForTimeout(200);

const pos = await page.evaluate(() => {
  const g = (window as any).__game;
  return g ? { x: Math.round(g.player.x), y: Math.round(g.player.y) } : null;
});

await page.screenshot({ path: "slice.png" });
await browser.close();
console.log("console:", logs.join(" | "));
console.log("player pos after input:", JSON.stringify(pos));
