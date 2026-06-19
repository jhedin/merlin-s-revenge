import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(150);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.keyboard.press("Space"); await p.waitForTimeout(200);
const box = (await p.locator("#game").boundingBox())!;
// hold a charge aimed right so the charge ring + HUD are visible
await p.mouse.move(box.x + box.width / 2 + 130, box.y + box.height / 2 - 20);
await p.mouse.down();
await p.waitForTimeout(450);
await p.locator("#game").screenshot({ path: "kit.png" });
await p.mouse.up();
await b.close();
console.log("saved kit.png");
