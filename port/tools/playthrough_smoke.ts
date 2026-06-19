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

// Play it: each round move Merlin next to the nearest hostile (the room has rock mazes; the bot
// closes distance directly) and full-charge a bolt into it. Allies pitch in. Repeat until clear.
for (let i = 0; i < 40; i++) {
  const foe = await p.evaluate(`(() => {
    const g = window.__game; const m = g.player.comps.find(c=>"x"in c);
    let best=null,bd=1e9; for (const e of g.entities){ if(e.type!=="enemy"||e.send("isDead"))continue; const q=e.send("getPos"); const d=(q.x-m.x)**2+(q.y-m.y)**2; if(d<bd){bd=d;best=q;} }
    if(!best) return null;
    // close to melee/firing distance by nudging the player toward the target (no pathfinder)
    const dx=best.x-m.x, dy=best.y-m.y, dist=Math.hypot(dx,dy)||1;
    if(dist>60){ m.x += dx/dist*40; m.y += dy/dist*40; }
    return { x: best.x, y: best.y };
  })()`) as { x: number; y: number } | null;
  if (!foe) break;
  const s = { sx: box.x + foe.x * ratio, sy: box.y + foe.y * ratio };
  await p.mouse.move(s.sx, s.sy);
  await p.mouse.down(); await p.waitForTimeout(820); await p.mouse.up(); await p.waitForTimeout(120);
}

const res = await p.evaluate(`(() => { const r = window.__rooms(); const g = window.__game; return {
  enemies: g.entities.filter(e=>e.type==="enemy"&&!e.send("isDead")).length,
  exitsOpen: r.exitsOpen, open: r.grid.open, mode: window.__mode(),
}; })()`) as any;
await b.close();
console.log("start   :", JSON.stringify(start));
console.log("after   :", JSON.stringify(res));
console.log("errors  :", errs.join("|") || "none");
