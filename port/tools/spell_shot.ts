// K2 in-browser check: grant Merlin energyBlast, hold to charge (a growing orb over his head), then release
// at an on-screen enemy (mouse-aimed) — confirm the objSpell flies, explodes, DAMAGES the foe, and is swept
// (no leak). Verifies the grow-fly-explode lifecycle live + that the spell still kills (progression intact).
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

// grant energyBlast + park a low-inertia 300-energy foe 150px to Merlin's LEFT (on-screen), light it so the
// radial centre hit is lethal; return the foe's canvas coords so we can aim the mouse at it.
const foeXY = await p.evaluate(`(() => {
  const g = window.__game;
  const pc = g.player.comps.find(c => typeof c.grantSpell === "function");
  pc.grantSpell(window.__atk("energyBlast"));
  const m = g.player.comps.find(c => "x" in c);
  const foe = g.entities.find(e => e.type === "enemy"); window.__foe = foe;
  const fm = foe.comps.find(c => "x" in c); fm.x = m.x - 150; fm.y = m.y;
  fm.inertia = 0; fm.maxSpeed = 0; // pin it (no walk) so it stays under the aimed blast for the check
  const en = foe.comps.find(c => "energy" in c); en.max = 300; en.energy = 300;
  return { x: fm.x, y: fm.y };
})()`) as any;

// aim the cursor at the foe (input.cursor() reads the mouse over the canvas), then hold Space to charge.
await p.mouse.move(box.x + foeXY.x * ratio, box.y + foeXY.y * ratio);
await p.keyboard.down("Space");
await p.waitForTimeout(500); // charge to full
const charging = await p.evaluate(`(() => {
  const g = window.__game; const s = g.entities.filter(e => e.type === "spell");
  return { count: s.length, size: s[0] ? s[0].comps.find(c => typeof c.size === "function").size() : 0,
           frac: g.player.send("chargeFrac") };
})()`) as any;
console.log("CHARGING  spells:", charging.count, "size:", charging.size?.toFixed?.(1), "chargeFrac:", charging.frac?.toFixed?.(2));

// release -> the orb flies to the foe and explodes.
await p.keyboard.up("Space");
await p.waitForTimeout(800);
const after = await p.evaluate(`(() => {
  const g = window.__game; const foe = window.__foe;
  return { foeHp: foe.comps.find(c => "energy" in c).energy, foeDead: foe.send("isDead"),
           liveSpells: g.entities.filter(e => e.type === "spell").length };
})()`) as any;
console.log("AFTER     foeHp:", after.foeHp, "foeDead:", after.foeDead, "liveSpells (0 = swept, no leak):", after.liveSpells);
console.log("errors   :", errs.length ? errs.join("; ") : "none");
await b.close();
