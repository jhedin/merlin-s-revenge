import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(200);  // start menu
await p.keyboard.press("Space"); await p.waitForTimeout(200);  // (cutscene)
await p.keyboard.press("Escape"); await p.waitForTimeout(400); // skip
// walk into walls in all directions to exercise collision
for (const k of ["ArrowUp","ArrowLeft","ArrowDown","ArrowRight"]) { await p.keyboard.down(k); await p.waitForTimeout(300); await p.keyboard.up(k); }
const s = await p.evaluate(`(() => ({ mode: window.__mode(), inWall: (() => { const m = window.__game.player.comps.find(c=>"x" in c); return window.__game.grid.solidAtPx(m.x, m.y); })() }))()`) as { mode: string; inWall: boolean };
await b.close();
console.log("mode:", s.mode, "playerInWall:", s.inWall, "errors:", errs.join("|") || "none");
