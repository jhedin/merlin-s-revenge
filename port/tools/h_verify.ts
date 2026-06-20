// H-phase in-browser verification: (1) intro cutscene plays with real actors moving + auto-advancing
// dialogue, then drops into gameplay; (2) merliniii endRoom -> victory on reach+clear; (3) death flow.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });

async function newPage(url: string) {
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs: string[] = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  return { p, errs };
}

// ---- (1) INTRO cutscene plays with real actors moving + auto-advance ----
{
  const { p, errs } = await newPage("http://localhost:5173/");
  await p.keyboard.press("Space"); // title -> intro cutscene
  await p.waitForTimeout(300);
  // sample visible actor x positions across a long window to prove they MOVE (walkTo drives the real
  // Movement). The intro's early lines are static `at` placements; movement appears at enterStageRight.
  const frames = new Set<string>(); let moved = false; let prev: string | null = null;
  for (let i = 0; i < 140; i++) {
    const xs = await p.evaluate(`(() => { const c = window.__cut(); return c ? c.visibleActorXs() : null; })()`).catch(() => null);
    if (xs === null) break; // cutscene ended (auto-advanced through every line)
    const key = (xs as number[]).join(",");
    frames.add(key);
    if (prev && key !== prev) moved = true;
    prev = key;
    await p.waitForTimeout(70);
  }
  const stillCut = frames.size > 0;
  // skip the rest of the intro -> drop into gameplay
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  const afterSkip = await p.evaluate(`window.__scene.current()`);
  const live = await p.evaluate(`(() => { const g = window.__game; return {
    enemies: g.entities.filter(e=>e.type==="enemy").length,
    player: !!g.player,
  }; })()`);
  console.log("[1] intro: distinctActorFrames=", frames.size, "actorsMoved=", moved, "cutscenePlayed=", stillCut, "afterSkip=", afterSkip, "live=", JSON.stringify(live), "errors=", errs.join("|")||"none");
  await p.close();
}

// ---- (2) merliniii endRoom -> victory ----
{
  const { p, errs } = await newPage("http://localhost:5173/?map=merliniii");
  await p.keyboard.press("Space"); await p.waitForTimeout(150);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200); // skip intro -> game
  await p.keyboard.press("Space"); await p.waitForTimeout(150);
  // reach the end room (17,3) = room 53, confirm entering with live enemies does NOT win, then clear it.
  const r = await p.evaluate(`(() => {
    const rm = window.__rooms(); const g = window.__game;
    rm.enter({ x: 17, y: 3 });
    const sceneOnEnter = window.__scene.current();
    const enemiesInEndRoom = g.entities.filter(e=>e.type==="enemy").length;
    for (const e of g.entities) { if (e.type === "enemy") { const en = e.comps.find(c=>"energy"in c&&"max"in c); en.dead=true; en.energy=0; } }
    const pm = g.player.comps.find(c=>"x"in c&&"vx"in c); pm.x=120; pm.y=120; pm.vx=0; pm.vy=0; // keep in-bounds
    rm.update();
    return { sceneOnEnter, enemiesInEndRoom, sceneAfter: window.__scene.current() };
  })()`);
  console.log("[2] merliniii endRoom:", JSON.stringify(r), "(enter-with-enemies != win; clear -> gameComplete)", "errors=", errs.join("|")||"none");
  await p.close();
}

// ---- (3) death flow: kill the player (0 lives) -> wasted cutscene -> reload/title ----
{
  const { p, errs } = await newPage("http://localhost:5173/");
  await p.keyboard.press("Space"); await p.waitForTimeout(150);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200); // skip intro -> game
  await p.keyboard.press("Space"); await p.waitForTimeout(150);
  // save first (so the wasted->reload has something to load), then kill the player.
  await p.keyboard.press("Digit1"); await p.waitForTimeout(120);
  const killed = await p.evaluate(`(() => {
    const g = window.__game; const en = g.player.comps.find(c=>"energy"in c&&"max"in c);
    en.dead = true; en.energy = 0;
    return window.__mode();
  })()`);
  // poll the death pathway: die-delay -> gameOver -> wasted cutscene (real Merlin in goWastedMode) -> reload.
  let sawGameOver = false, sawWasted = false, reloaded = false;
  for (let i = 0; i < 160; i++) {
    const st = await p.evaluate(`(() => { const g = window.__game; return { scene: window.__scene.current(), wasted: g.player.send("isWasted") }; })()`) as { scene: string; wasted: boolean };
    if (st.scene === "gameOver") sawGameOver = true;
    if (st.wasted) sawWasted = true;
    if (sawGameOver && st.scene === "game") reloaded = true;
    if (reloaded) break;
    await p.waitForTimeout(120);
  }
  console.log("[3] death: killedAt=", killed, "sawWastedCutscene=", sawGameOver, "realMerlinWastedMode=", sawWasted, "reloadedSaveToGame=", reloaded, "errors=", errs.join("|")||"none");
  await p.close();
}

// ---- (4) per-room restore: walk out of a half-cleared room and back ----
{
  const { p, errs } = await newPage("http://localhost:5173/");
  await p.keyboard.press("Space"); await p.waitForTimeout(150);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.keyboard.press("Space"); await p.waitForTimeout(150);
  const res = await p.evaluate(`(() => {
    const rm = window.__rooms(); const g = window.__game;
    const orc = g.entities.find(e=>e.type==="enemy");
    if (!orc) return { noEnemy: true };
    const en = orc.comps.find(c=>"energy"in c&&"max"in c); en.energy = 13;  // wound (not kill)
    const woundedHp = en.energy;
    const start = { x: rm.loc.x, y: rm.loc.y };
    rm.enter({ x: start.x + 1, y: start.y });   // leave (room 1 -> the right neighbour) -> freeze room 1
    rm.enter(start);                            // return -> restore from pState
    const orc2 = g.entities.find(e=>e.type==="enemy");
    const en2 = orc2 ? orc2.comps.find(c=>"energy"in c&&"max"in c) : null;
    return { woundedHp, restoredHp: en2 ? en2.energy : null };
  })()`);
  console.log("[4] per-room restore:", JSON.stringify(res), "(restoredHp == woundedHp -> restored, not fresh)", "errors=", errs.join("|")||"none");
  await p.close();
}

await b.close();
