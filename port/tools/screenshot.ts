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
const titleMode = await page.evaluate(`window.__mode()`);
await page.screenshot({ path: "title.png" }); // capture the title screen
// start the game
await page.keyboard.press("Space");
await page.waitForTimeout(400);
// walk right two rooms, save, walk back, load
await page.keyboard.down("ArrowRight"); await page.waitForTimeout(900); await page.keyboard.up("ArrowRight");
const savedRoom = await page.evaluate(`window.__rooms().loc.x`);
await page.keyboard.press("Digit1");
await page.waitForTimeout(100);
await page.keyboard.down("ArrowLeft"); await page.waitForTimeout(900); await page.keyboard.up("ArrowLeft");
await page.keyboard.press("Digit2");
await page.waitForTimeout(150);

const state = await page.evaluate(`(() => ({
  titleMode: ${JSON.stringify(titleMode)},
  mode: window.__mode(),
  savedRoom: ${savedRoom},
  afterLoad: window.__rooms().loc.x,
}))()`);

await page.screenshot({ path: "slice.png" });
await browser.close();
console.log("console:", logs.filter((l) => !l.includes("404")).join(" | "));
console.log("state:", JSON.stringify(state));
