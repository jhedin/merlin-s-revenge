import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(300);
await p.keyboard.press("Escape"); await p.waitForTimeout(500);
// scan all rooms for AI kinds
const kinds: Record<string,number> = {};
for (let i=0;i<10;i++){
  const k = await p.evaluate(`(() => {
    const g = window.__game; const out=[];
    for (const e of g.entities){ const ai=e.comps.find(c=>"kind" in c); if(ai) out.push(ai.kind); }
    return out;
  })()`);
  for (const x of k as string[]) kinds[x]=(kinds[x]||0)+1;
  await p.keyboard.down("ArrowRight"); await p.waitForTimeout(650); await p.keyboard.up("ArrowRight");
}
await b.close();
console.log("AI kinds seen across rooms:", JSON.stringify(kinds));
