// K22 visual check: clear room 1 (opens the right exit) and screenshot — confirm a GREEN exit arrow
// renders on the open (right) edge and nowhere there's no neighbour.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(150);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.keyboard.press("Space"); await p.waitForTimeout(200);

// kill every enemy directly so the room clears and exits open (we only care about the arrow overlay).
await p.evaluate(`(() => {
  const g = window.__game;
  for (const e of g.entities) if (e.type === "enemy") { const en = e.comps.find(c => "dead" in c); if (en) en.dead = true; }
})()`);
await p.waitForTimeout(500); // let rooms.update() open the exits + the overlay draw

const state = await p.evaluate(`(() => {
  const r = window.__rooms();
  return { exitsOpen: r.exitsOpen, open: r.grid.open, arrows: r.exitArrowRects() };
})()`) as any;
console.log("exitsOpen:", state.exitsOpen);
console.log("open     :", JSON.stringify(state.open));
console.log("arrows   :", JSON.stringify(state.arrows));
console.log("errors   :", errs.length ? errs.join("; ") : "none");
await p.locator("#game").screenshot({ path: "/tmp/arrow_shot.png" });
console.log("shot saved -> /tmp/arrow_shot.png");
await b.close();
