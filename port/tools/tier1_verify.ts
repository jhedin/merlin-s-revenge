import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(150);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.keyboard.press("Space"); await p.waitForTimeout(200);

// 1) facing: move left then right, read the player's facingLeft + that a sprite renders
async function faceAfter(key: string) {
  await p.keyboard.down(key); await p.waitForTimeout(350); await p.keyboard.up(key);
  return p.evaluate(`(()=>{ const m=window.__game.player.comps.find(c=>"vx"in c); return m.facingLeft; })()`);
}
const leftFace = await faceAfter("ArrowLeft");
const rightFace = await faceAfter("ArrowRight");

// 2) hit-flash + i-frames: spawn a hostile next to the player, let it hit; player should not die instantly
const combat = await p.evaluate(`(()=>new Promise(res=>{
  const g=window.__game; const pm=g.player.comps.find(c=>"x"in c);
  const e=g.spawnEnemy("blackOrc", pm.x+14, pm.y, {animChar:"blackOrc"}); g.entities.push(e);
  const en=e.comps.find(c=>"energy"in c); const hp0=en.energy;
  const pe=g.player.comps.find(c=>"energy"in c&&"xpReward"in c);
  // bolt the orc to see the flash flag toggle
  const before=pe.energy;
  setTimeout(()=>{
    // sample whether Hurt flash ever set on the orc after some hits, and player survived a bit
    res({ orcHpDropped: en.energy<hp0 || en.dead, playerAlive: !g.player.send("isDead"), playerHp: pe.energy, playerHadIframes: typeof g.player.send("isInvince")==="boolean" });
  }, 1500);
}))()`) as any;

await p.locator("#game").screenshot({ path: "tier1.png" });
await b.close();
console.log("facing  : left->", leftFace, " right->", rightFace, (leftFace===true&&rightFace===false)?"(OK)":"(CHECK)");
console.log("combat  :", JSON.stringify(combat));
console.log("errors  :", errs.join(" | ") || "none");
