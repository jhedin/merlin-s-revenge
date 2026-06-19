import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(150);  // title -> cutscene
await p.keyboard.press("Escape"); await p.waitForTimeout(150); // skip -> playing
await p.keyboard.press("Space"); await p.waitForTimeout(200);

const box = (await p.locator("#game").boundingBox())!;
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

// 1) mana exists and starts full
const manaStart = await p.evaluate(`window.__game.player.send("manaFrac")`) as number;

// 2) hold left mouse aimed at open floor to the right; sample chargeFrac mid-hold, then cast
await p.mouse.move(cx + 120, cy);
await p.mouse.down();
await p.waitForTimeout(350);
const charging = await p.evaluate(`({ frac: window.__game.player.send("chargeFrac"), action: (() => { const a = window.__game.player.comps.find(c=>c.constructor.name==="Anim"); return a && a["action"]; })() })`) as any;
await p.mouse.up();
// peek bullets right after release (they fly fast, so sample the peak over a short window)
const after = await p.evaluate(`(() => new Promise(res => { let max = 0; const id = setInterval(() => { max = Math.max(max, window.__game.entities.filter(e=>e.type==="bullet").length); }, 8); setTimeout(() => { clearInterval(id); res({ bullets: max, mana: window.__game.player.send("manaFrac") }); }, 250); }))()`) as any;

// 3) punch: drop an enemy adjacent to the player, no mouse held, confirm it takes damage
const punch = await p.evaluate(`(() => new Promise(res => {
  const g = window.__game; const pl = g.player;
  const m = pl.comps.find(c=>"x" in c);
  const e = g.spawnEnemy("blackOrc", m.x + 10, m.y, { animChar: "blackOrc" });
  g.entities.push(e);
  const en = e.comps.find(c=>"energy" in c);
  const hp0 = en.energy;
  setTimeout(() => res({ hp0, hp1: en.energy, hit: en.energy < hp0 }), 700);
}))()`) as any;

await b.close();
console.log("manaStart   :", manaStart);
console.log("charging    :", JSON.stringify(charging));
console.log("cast        : bullets now", after.bullets, " mana:", manaStart, "->", after.mana);
console.log("punch       :", JSON.stringify(punch));
console.log("errors      :", errs.join("|") || "none");
