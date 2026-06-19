import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
await page.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.keyboard.press("Space"); await page.waitForTimeout(300);
await page.keyboard.press("Escape"); await page.waitForTimeout(400); // skip cutscene
// summon allies + fire while engaging
await page.keyboard.press("q"); await page.waitForTimeout(300);
await page.keyboard.press("q"); await page.waitForTimeout(300);
await page.keyboard.down("ArrowLeft");
for (let i=0;i<6;i++){ await page.keyboard.press("Space"); await page.waitForTimeout(60); }
await page.keyboard.up("ArrowLeft");
const s = await page.evaluate(`(() => { const g=window.__game; const by={}; for(const e of g.entities) by[e.type]=(by[e.type]||0)+1; return {mode:window.__mode(), counts:by}; })()`);
await page.screenshot({ path: "final.png" });
await browser.close();
console.log(JSON.stringify(s));
