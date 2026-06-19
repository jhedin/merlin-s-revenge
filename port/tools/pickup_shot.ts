import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(300);
await p.keyboard.press("Escape"); await p.waitForTimeout(500);
// scan rooms for pickups
const found: Record<string,number> = {};
for (let i=0;i<10;i++){
  const k = await p.evaluate(`(() => { const g=window.__game; const out=[]; for(const e of g.entities){ if(e.type==="pickup"){ const pk=e.comps.find(c=>"effect" in c); out.push(pk.effect); } } return out; })()`);
  for (const x of k as string[]) found[x]=(found[x]||0)+1;
  await p.evaluate(`window.__rooms() && (window.__game.player.comps.find(c=>"x" in c).x = 999)`); // nudge to exit right
  await p.keyboard.down("ArrowRight"); await p.waitForTimeout(500); await p.keyboard.up("ArrowRight");
}
await b.close();
console.log("pickups seen:", JSON.stringify(found));
