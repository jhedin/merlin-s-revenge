import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto("http://localhost:5000/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(300);
await p.keyboard.press("Escape"); await p.waitForTimeout(500);
const s = await p.evaluate(`(() => {
  const g = window.__game; const out = [];
  for (const e of g.entities) {
    if (e.type !== "enemy") continue;
    const ai = e.comps.find(c => "reachRanged" in c);
    const an = e.comps.find(c => "char" in c);
    if (ai) out.push({ c: an.char, ranged: ai.ranged, cd: ai.cooldownMax, reach: ai.ranged ? ai.reachRanged : ai.reach });
  }
  return out;
})()`);
await b.close();
console.log(JSON.stringify(s));
