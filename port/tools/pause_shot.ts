import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
await page.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.keyboard.press("Space"); await page.waitForTimeout(300);
await page.keyboard.press("Escape"); await page.waitForTimeout(400); // skip cutscene
await page.waitForTimeout(300);
await page.keyboard.press("Escape"); await page.waitForTimeout(200); // pause
await page.keyboard.press("ArrowDown"); await page.waitForTimeout(120); // move selection
const mode = await page.evaluate(`window.__mode()`);
await page.screenshot({ path: "pause.png" });
await browser.close();
console.log("mode:", mode);
