import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(150);  // title -> cutscene
await p.keyboard.press("Escape"); await p.waitForTimeout(150); // skip cutscene -> playing
await p.keyboard.press("Space"); await p.waitForTimeout(300);  // (in case cutscene needs space)

// Step 1: confirm exits closed while enemies alive in the start room.
const before = await p.evaluate(`(() => { const r = window.__rooms(); return { mode: window.__mode(), exitsOpen: r.exitsOpen, open: r.grid.open, enemies: window.__game.entities.filter(e=>e.type==="enemy").length }; })()`) as any;

// Step 2: kill every enemy in the room, tick, confirm exits open and (if last room) clear count rose.
const afterClear = await p.evaluate(`(() => {
  for (const e of window.__game.entities) { if (e.type === "enemy") e.send("takeHit", 99999, null); }
  // let the room manager run an update tick to detect the clear
  return new Promise(res => setTimeout(() => { const r = window.__rooms(); res({ exitsOpen: r.exitsOpen, open: r.grid.open, mode: window.__mode() }); }, 120));
})()`) as any;

// Step 3: drive a full win by clearing every room programmatically then walking through.
const win = await p.evaluate(`(() => new Promise(async res => {
  const game = window.__game; const rooms = window.__rooms();
  const total = 10; let guard = 0;
  function killAll(){ for (const e of game.entities) if (e.type==="enemy") e.send("takeHit", 99999, null); }
  function step(){
    guard++;
    killAll();
    // nudge the player right to cross the open east edge
    const m = game.player.comps.find(c=>"vx" in c);
    if (m) { m.x = 9999; }
    if (window.__mode() === "victory" || guard > 60) { res({ mode: window.__mode(), guard }); return; }
    setTimeout(step, 60);
  }
  step();
}))()`) as any;

await b.close();
console.log("BEFORE :", JSON.stringify(before));
console.log("CLEARED:", JSON.stringify(afterClear));
console.log("WIN    :", JSON.stringify(win));
console.log("errors :", errs.join("|") || "none");
