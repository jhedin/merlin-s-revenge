import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.keyboard.press("Space"); await p.waitForTimeout(150);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.keyboard.press("Space"); await p.waitForTimeout(200);

// jump through every room and tally what spawned (dwellings by team, pickups by effect)
const survey = await p.evaluate(`(() => {
  const g = window.__game; const rooms = window.__rooms();
  const out = { goblinTeams:0, caveTeams:0, swordPickups:0, dwellings:0, perRoom:[] };
  for (let x = 1; x <= 10; x++) {
    rooms.enter({ x, y: 1 });
    let gob=0, cav=0, sword=0, dw=0;
    for (const e of g.entities) {
      if (e.type === "pickup" && e.send("getEffect") === "sword") { sword++; }
      const team = e.send("getTeam");
      if (e.has && e.comps.some(c=>c.constructor.name==="Dwelling")) dw++;
      if (team === "#goblins") gob++;
      if (team === "#cave") cav++;
    }
    out.goblinTeams += gob; out.caveTeams += cav; out.swordPickups += sword; out.dwellings += dw;
    out.perRoom.push({ x, gob, cav, sword, dw });
  }
  return out;
})()`) as any;

await b.close();
console.log("dwellings total :", survey.dwellings);
console.log("goblin-team unts:", survey.goblinTeams, " cave-team units:", survey.caveTeams, " sword pickups:", survey.swordPickups);
console.log("per-room        :", JSON.stringify(survey.perRoom));
console.log("errors          :", errs.join("|") || "none");
