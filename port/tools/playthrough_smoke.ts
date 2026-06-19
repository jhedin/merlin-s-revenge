import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(150);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.keyboard.press("Space"); await p.waitForTimeout(200);
const box = (await p.locator("#game").boundingBox())!;
const canvasW = await p.evaluate(`document.getElementById("game").width`) as number;
const ratio = box.width / canvasW;

const start = await p.evaluate(`(() => { const g = window.__game; return {
  enemies: g.entities.filter(e=>e.type==="enemy").length,
  allies:  g.entities.filter(e=>e.type==="ally").length,
}; })()`) as any;

// Merlin starts punch-only (magic comes from the room-6 scroll), so first grab the merlinSword
// pickup in room 1, then melee. The bot teleports adjacent to each hostile and lets the auto-punch
// fire across a few frames. Allies pitch in. Repeat until clear.
await p.evaluate(`(() => {
  const g = window.__game; const m = g.player.comps.find(c=>"x"in c);
  const sword = g.entities.find(e => e.type==="pickup" && e.send("getEffect")==="sword");
  if (sword) { const q = sword.send("getPos"); m.x = q.x; m.y = q.y; } // walk onto it -> equip
})()`);
await p.waitForTimeout(120); // let the pickup collect
for (let i = 0; i < 200; i++) { // melee is slower than magic + dwellings release waves
  const foe = await p.evaluate(`(() => {
    const g = window.__game; const m = g.player.comps.find(c=>"x"in c);
    let best=null,bd=1e9; for (const e of g.entities){ if(e.type!=="enemy"||e.send("isDead"))continue; const q=e.send("getPos"); const d=(q.x-m.x)**2+(q.y-m.y)**2; if(d<bd){bd=d;best=q;} }
    if(!best) return null;
    const dx=best.x-m.x, dy=best.y-m.y, dist=Math.hypot(dx,dy)||1; // teleport into punch reach
    m.x = best.x - dx/dist*12; m.y = best.y - dy/dist*12;
    return { x: best.x, y: best.y };
  })()`) as { x: number; y: number } | null;
  if (!foe) break;
  await p.waitForTimeout(160); // hold position; auto-punch fires on its cooldown
}

const res = await p.evaluate(`(() => { const r = window.__rooms(); const g = window.__game; return {
  enemies: g.entities.filter(e=>e.type==="enemy"&&!e.send("isDead")).length,
  exitsOpen: r.exitsOpen, open: r.grid.open, mode: window.__mode(),
}; })()`) as any;
await b.close();
console.log("start   :", JSON.stringify(start));
console.log("after   :", JSON.stringify(res));
console.log("errors  :", errs.join("|") || "none");
