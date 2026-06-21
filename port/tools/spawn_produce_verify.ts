import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(150);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.keyboard.press("Space"); await p.waitForTimeout(200);

// Production: jump to room 2 (goblinMageHut present), count goblins, wait, recount + check sprites resolve
const before = await p.evaluate(`(() => { window.__rooms().enter({x:2,y:1});
  const g = window.__game; return g.entities.filter(e=>e.send("getTeam")==="#goblins"&&!e.comps.some(c=>c.constructor.name==="Dwelling")).length;
})()`) as number;
await p.waitForTimeout(9000); // let huts build residents (~7s period)
const after = await p.evaluate(`(() => {
  const g = window.__game;
  const units = g.entities.filter(e=>e.send("getTeam")==="#goblins"&&!e.comps.some(c=>c.constructor.name==="Dwelling"));
  const withSprite = units.filter(e=>{ const a=e.comps.find(c=>c.constructor.name==="Anim"); return a && a.sprite() !== null; }).length;
  return { count: units.length, withSprite };
})()`) as any;

// Sword pickup: walk onto the merlinSword pickup in room 1, check the WeaponManager addWeapon'd it
const sword = await p.evaluate(`(() => { const g = window.__game; window.__rooms().enter({x:1,y:1});
  const pl = g.player; const m = pl.comps.find(c=>"x"in c);
  const before = pl.send("getWeapons","nonMagic");
  const pk = g.entities.find(e => e.type==="pickup" && e.send("getEffect")==="sword");
  if (pk) { const q = pk.send("getPos"); m.x = q.x; m.y = q.y; pk.send("update"); }
  const cur = pl.send("getCurrentAttack");
  return { before, after: pl.send("getWeapons","nonMagic"), current: cur && cur.name };
})()`) as any;

await b.close();
console.log("goblin units  :", before, "->", after.count, " (all with sprite:", after.withSprite + "/" + after.count + ")");
console.log("sword equip   :", JSON.stringify(sword));
console.log("errors        :", errs.join("|") || "none");
