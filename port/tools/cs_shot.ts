import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
const logs: string[] = []; page.on("pageerror", (e) => logs.push("ERR:" + e.message));
await page.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.keyboard.press("Space");
await page.waitForTimeout(300);
for (let i = 0; i < 3; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(220); }
const mode = await page.evaluate(`window.__mode()`);
await page.screenshot({ path: "cutscene.png" });
await browser.close();
console.log("mode:", mode, "|", logs.join("|"));
