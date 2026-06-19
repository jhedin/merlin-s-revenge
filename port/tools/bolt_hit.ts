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
const ratio = box.width / canvasW; // CSS scale: world px -> screen px
const toScreen = (wx: number, wy: number) => ({ sx: box.x + wx * ratio, sy: box.y + wy * ratio });

// place a warrior in open floor a short distance to the right of the player
const setup = await p.evaluate(`(() => {
  const g = window.__game; const m = g.player.comps.find(c=>"x"in c);
  // clear other enemies so only our test dummy remains
  g.entities = g.entities.filter(e => e.type === "player");
  const e = g.spawnEnemy("swordOrc", m.x - 70, m.y, { animChar: "swordOrc" });
  g.entities.push(e);
  const en = e.comps.find(c=>"energy"in c);
  return { px: m.x, py: m.y, ex: m.x - 70, ey: m.y, hp0: en.energy, eid: e.id };
})()`) as any;

// full-charge cast aimed at the dummy
const s = toScreen(setup.ex, setup.ey);
await p.mouse.move(s.sx, s.sy);
await p.mouse.down(); await p.waitForTimeout(900); await p.mouse.up();
await p.waitForTimeout(400);

const after = await p.evaluate(`(() => {
  const g = window.__game; const e = g.entities.find(x=>x.id===${setup.eid});
  const en = e && e.comps.find(c=>"energy"in c);
  return { hp1: en ? en.energy : "gone", dead: e ? e.send("isDead") : true };
})()`) as any;

await b.close();
console.log("warrior hp:", setup.hp0, "->", after.hp1, " dead:", after.dead);
console.log("errors    :", errs.join("|") || "none");
