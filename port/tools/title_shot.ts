import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120); // select Controls
await p.keyboard.press("Space"); await p.waitForTimeout(150);     // open controls
await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120); // move in controls
await p.screenshot({ path: "controls.png" });
await b.close();
console.log("ok");
