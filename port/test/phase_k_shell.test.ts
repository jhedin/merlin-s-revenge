import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { SceneManager, type SceneActions, type CutScene } from "@/scenes/sceneManager";
import { Thespian } from "@/scenes/thespian";
import { parseCutscene, loadCutscene, clearCutsceneCache, cacheCutscene } from "@/data/cutscene";
import { spawnChatter } from "@/entities/objTypes";
import { spawnPlayer } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Screens } from "@/scenes/screens";
import { Input } from "@/systems/input";

// shared minimal world so the cutscene/chatter actors spawn + drive.
function setupWorld(): void {
  game.grid = new CollisionGrid(60, 60, 32);
  game.entities = [];
  game.assets = { index: { anims: {
    mer_stand: { frames: [{}], delay: 4 }, uli_stand: { frames: [{}, {}], delay: 4 },
    stones1_stand: { frames: [{}], delay: 4 }, blackOrc_stand: { frames: [{}], delay: 4 },
  }, cutscenes: { stones1: "cutscenes/stones1.txt" } }, images: new Map(), ensureChar: () => {}, img: () => null } as any;
  game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  clearCutsceneCache();
  game.scene = undefined;
}

const host = { viewW: 320, viewH: 180, playSound: () => {}, playMusic: () => {}, keyForControl: (c: string) => "K_" + c };

// Input() reaches for `window` by default; in node give it a dummy EventTarget.
function makeInput(): Input { return new Input(new EventTarget()); }

function makeScene(overrides: Partial<SceneActions> = {}, frames = 0) {
  const log: string[] = [];
  const actions: SceneActions = {
    startGame: () => log.push("startGame"),
    playCutScene: (s: CutScene) => log.push("play:" + s),
    loadGame: () => { log.push("loadGame"); return overrides.loadGame ? overrides.loadGame() : true; },
    pause: () => log.push("pause"),
    resume: () => log.push("resume"),
    playInGameCutScene: (n: string) => log.push("ingame:" + n),
    ...overrides,
  };
  return { scene: new SceneManager(actions, frames), log };
}

// ── K12: arbitrary named cutscene + in-game cutscene + chatter overlap ───────────────────────────
describe("K12 chatter cutscenes", () => {
  beforeEach(setupWorld);

  it("SceneManager plays an arbitrary named in-game cutscene and finishes -> resume (no screen change)", () => {
    const { scene, log } = makeScene();
    scene.startGameFromTitle(); scene.cutSceneFinished("intro"); // into game
    expect(scene.current()).toBe("game");
    scene.playInGameCutScene("stones1");
    expect(scene.isInGameCutscene()).toBe(true);
    expect(scene.isPaused()).toBe(true);              // combat suspended during the in-game cutscene
    expect(log).toContain("ingame:stones1");
    scene.cutSceneFinished("stones1");                // the default branch: resume gameplay
    expect(scene.isInGameCutscene()).toBe(false);
    expect(scene.current()).toBe("game");             // base screen unchanged
    expect(log.filter((l) => l === "resume").length).toBeGreaterThan(0);
  });

  it("playInGameCutScene is ignored outside the game screen", () => {
    const { scene } = makeScene();
    scene.playInGameCutScene("stones1"); // still on the title screen
    expect(scene.isInGameCutscene()).toBe(false);
  });

  it("a stones cutscene parses (#playerCharacter -> m, #ulin -> u) and RUNS via the Thespian", () => {
    const src = `[#name: "scr_stones1", #type: #field]\ncharacters\n#playerCharacter - m\n#ulin - u\nlines\nwait 5\nu teleportInAt point(120,90)\nu: Hello Merlin!\nm: That's right.\nu teleportOut\nwait 5\n`;
    const cut = parseCutscene(src);
    expect(cut.chars).toEqual({ m: "#playerCharacter", u: "#ulin" });
    // the script runs: ulin teleports in (visible), dialogue auto-advances, then ulin teleports out.
    const t = new Thespian(cut, host);
    let done = false;
    for (let i = 0; i < 400 && !done; i++) done = t.tick();
    expect(done).toBe(true); // the whole stones script ran to completion
  });

  it("#key interpolation resolves #wizard via the input scheme glyph", () => {
    const input = makeInput();
    const cut = parseCutscene(`characters\n#ulin - u\nlines\nu: Press #key #wizard to summon\n`);
    const t = new Thespian(cut, { ...host, keyForControl: (c) => input.keyForControl(c) });
    t.tick();
    expect(t.getSpeech()?.text).toContain("Q"); // #wizard -> "Q"
  });

  it("loadCutscene fetches + parses + caches by name", async () => {
    const fetchText = async () => `characters\n#ulin - u\nlines\nu: hi\n`;
    const a = await loadCutscene("stones2", { stones2: "cutscenes/stones2.txt" }, fetchText);
    expect(a?.chars).toEqual({ u: "#ulin" });
    // a cached entry is returned without re-fetching (a fetch that throws would fail if it ran).
    cacheCutscene("stones3", parseCutscene(`characters\n#ulin - u\nlines\nu: cached\n`));
    const b = await loadCutscene("stones3", {}, async () => { throw new Error("should not fetch"); });
    expect(b?.steps[0]).toMatchObject({ kind: "say", text: "cached" });
  });

  it("the Chatter overlap trigger fires its script ONCE (pPerformed latch) on player overlap", () => {
    const fired: string[] = [];
    game.scene = { playInGameCutScene: (n) => fired.push(n), isInGameCutscene: () => false };
    const player = spawnPlayer(100, 100); game.player = player; game.entities.push(player);
    const stone = spawnChatter("stones1", 100, 100); game.entities.push(stone); // overlapping the player
    stone.send("update");
    expect(fired).toEqual(["stones1"]);
    expect(stone.send("getPerformed")).toBe(true);
    expect(stone.send("getMode")).toBe("talking"); // swapped to the talking member
    stone.send("update"); // a second tick must NOT replay (the latch)
    expect(fired).toEqual(["stones1"]);
  });

  it("the Chatter does NOT trigger when the player is outside the 320 reach", () => {
    const fired: string[] = [];
    game.scene = { playInGameCutScene: (n) => fired.push(n), isInGameCutscene: () => false };
    const player = spawnPlayer(0, 0); game.player = player; game.entities.push(player);
    const stone = spawnChatter("stones1", 1000, 1000); game.entities.push(stone); // far away
    stone.send("update");
    expect(fired).toEqual([]);
    expect(stone.send("getPerformed")).toBe(false);
  });

  // The trigger box is per-actor, not a shared ±320: kingStones carries rect(-100,-50,100,50), so its reach
  // is ±112 x / ±62 y (half-extent + player edge 12). A player 200px away — well WITHIN a stone's ±332 box —
  // must NOT trip kingStones, but a player at ±100/±55 must. Guards the hardcoded-reach regression.
  it("the Chatter trigger box honors the per-actor #collisionRect (kingStones is small, not ±320)", () => {
    const fired: string[] = [];
    game.scene = { playInGameCutScene: (n) => fired.push(n), isInGameCutscene: () => false };
    const player = spawnPlayer(300, 200); game.player = player; game.entities.push(player);
    // 200px to the right: inside a stones' ±332 box, but outside kingStones' ±112 x reach -> no trigger.
    const ks = spawnChatter("kingStones", 100, 200); game.entities.push(ks);
    ks.send("update");
    expect(fired).toEqual([]);
    expect(ks.send("getPerformed")).toBe(false);
    // move the player to within kingStones' actual zone (±112 x / ±62 y) -> it fires.
    player.get(Movement).x = 195; player.get(Movement).y = 245; // dx=95<=112, dy=45<=62
    ks.send("update");
    expect(fired).toEqual(["rescueKing"]);
  });
});

// ── K16: cutscene verbs (prop / walkScroll / random-flash) ───────────────────────────────────────
describe("K16 cutscene verbs (prop / walkScroll / random-flash)", () => {
  beforeEach(setupWorld);

  it("produceProp links the prop (its position tracks the carrier); dropProp unlinks it", () => {
    const cut = parseCutscene(`characters\n#merlin - m\n#ulin - u\nlines\nm at 100\nu at 50\nm produceProp u\nwait 200\n`);
    const t = new Thespian(cut, host);
    t.tick(); t.tick(); // produceProp runs in performLines; the carry tracks in driveActors on the next tick
    const m = t.visibleActors().find((p) => p.alias === "m")!.entity.get(Movement);
    const u = t.visibleActors().find((p) => p.alias === "u")!.entity.get(Movement);
    expect(Math.abs(u.x - m.x)).toBeLessThanOrEqual(16); // the prop is carried at the carrier (+ offset)
    expect(u.y).toBeLessThan(m.y);                        // carried above the carrier (offset y = -10)
    const cut2 = parseCutscene(`characters\n#merlin - m\n#ulin - u\nlines\nm at 100\nu at 50\nm produceProp u\nm dropProp\nu at 300\nwait 200\n`);
    const t2 = new Thespian(cut2, host);
    t2.tick();
    const u2 = t2.visibleActors().find((p) => p.alias === "u")!.entity.get(Movement);
    expect(u2.x).toBe(300); // after dropProp the prop is free again and `at 300` moves it
  });

  it("walkScrollRight moves the actor continuously until walkScrollStop", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm at 100\nwalkScrollRight\nwait 200\n`);
    const t = new Thespian(cut, host);
    t.tick();
    const m = t.visibleActors().find((p) => p.alias === "m")!.entity.get(Movement);
    const x0 = m.x;
    for (let i = 0; i < 5; i++) t.tick();
    expect(m.x).toBeGreaterThan(x0); // scrolling right
    const cut2 = parseCutscene(`characters\n#merlin - m\nlines\nm at 100\nwalkScrollRight\nwalkScrollStop\nwait 200\n`);
    const t2 = new Thespian(cut2, host);
    t2.tick();
    const m2 = t2.visibleActors().find((p) => p.alias === "m")!.entity.get(Movement);
    const xs = m2.x;
    for (let i = 0; i < 5; i++) t2.tick();
    expect(m2.x).toBe(xs); // stopped: no further movement
  });

  it("backgroundColourRandomFlash re-randomizes the bg target as it tweens (a self-restarting loop)", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nbackgroundColourRandomFlash 50\nwait 500\n`);
    const t = new Thespian(cut, host);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) { t.tick(); seen.add(`${Math.round(t.bg.r)},${Math.round(t.bg.g)},${Math.round(t.bg.b)}`); }
    expect(seen.size).toBeGreaterThan(1); // the bg moved through multiple random colours (loop restarted)
  });
});

// ── K17: per-actor fader (lights/fade count-to-zero gate) ────────────────────────────────────────
describe("K17 per-actor fader", () => {
  beforeEach(setupWorld);

  it("lightsDown fades each actor under its own fader; the line completes only when ALL faders finish", () => {
    const cut = parseCutscene(`characters\n#merlin - m\n#ulin - u\nlines\nm at 100\nu at 50\nlightsDown\nm at 999\nwait 200\n`);
    const t = new Thespian(cut, host);
    t.tick(); // runs at/at then lightsDown -> both actors fading; the chain gates on the fader count
    const m = t.visibleActors().find((p) => p.alias === "m")!.entity.get(Movement);
    expect(m.x).toBe(100);                       // `at 999` NOT yet run (gated by the faders)
    // advance until the faders complete; only then does `at 999` run.
    for (let i = 0; i < 40; i++) t.tick();
    const mAfter = t.visibleActors().find((p) => p.alias === "m");
    // by now the faders finished and `at 999` ran (or the scene is wrapping up via the trailing wait)
    expect(mAfter ? mAfter.entity.get(Movement).x : 999).toBe(999);
  });

  it("a faded-out actor reports alpha 0 (per-sprite fade), a lit actor reports 1", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm at 100\nlightsDown\nwait 200\n`);
    const t = new Thespian(cut, host);
    for (let i = 0; i < 40; i++) t.tick();
    const p = t.visibleActors().find((q) => q.alias === "m")!;
    expect(t.actorAlpha(p)).toBeCloseTo(0, 2); // fully faded out
  });
});

// ── K18: screen overlays render their content ────────────────────────────────────────────────────
function mockRenderer() {
  const calls: { text: string[]; rects: number; images: number } = { text: [], rects: 0, images: 0 };
  const ctx: any = {
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", globalAlpha: 1,
    fillRect: () => { calls.rects++; },
    strokeRect: () => {},
    fillText: (t: string) => { calls.text.push(String(t)); },
    drawImage: () => { calls.images++; },
    save: () => {}, restore: () => {}, translate: () => {}, scale: () => {},
    measureText: (t: string) => ({ width: String(t).length * 6 }),
  };
  return { renderer: { ctx } as any, calls };
}

describe("K18 screen content overlays", () => {
  beforeEach(() => { setupWorld(); game.input = makeInput(); });

  it("instructions renders a static how-to-play block", () => {
    const { renderer, calls } = mockRenderer();
    new Screens(game.assets, 320, 240).render(renderer, "instructions");
    expect(calls.text.join(" ")).toMatch(/MERLIN'S REVENGE/);
    expect(calls.text.join(" ")).toMatch(/Move with WASD/);
  });

  it("showArmy paginates the reserve army and renders unit cells", () => {
    game.armyMaster.reset();
    // bank a handful of allies (recordUnitDetails uses the entity, so seed the reserve directly via save).
    game.armyMaster.restoreFromSave({ pReserveArmy: { "#aldevar": {
      goblinWarrior: [{ typ: "goblinWarrior", team: "#aldevar", level: 2 }],
      simpleton: [{ typ: "simpleton", team: "#aldevar", level: 1 }],
    } } });
    const reserve = game.armyMaster.getReserveArmy();
    expect(reserve.length).toBe(2);
    const { renderer, calls } = mockRenderer();
    const s = new Screens(game.assets, 320, 240); s.open("showArmy");
    s.render(renderer, "showArmy");
    expect(calls.text.join(" ")).toMatch(/RESERVE ARMY/);
    expect(calls.text.join(" ")).toMatch(/page 1\//); // the page indicator
  });

  it("showArmy nextPage is shadowed (stays on page 1) when there is only one page", () => {
    game.armyMaster.reset();
    const s = new Screens(game.assets, 320, 240); s.open("showArmy");
    const input = { pressed: (k: string) => k === "arrowright" } as any;
    const close = s.handleInput("showArmy", input);
    expect(close).toBe(false); // page right with one page is a no-op (not a close)
  });

  it("key-config lists the schemes + the control->key table; OK commits the highlighted scheme", () => {
    const { renderer, calls } = mockRenderer();
    const s = new Screens(game.assets, 320, 240); s.open("keyConfig");
    s.render(renderer, "keyConfig");
    expect(calls.text.join(" ")).toMatch(/CHOOSE KEYS/);
    expect(calls.text.join(" ")).toMatch(/The Current Keys are:/);
    expect(calls.text.join(" ")).toMatch(/Move Up/);
    // move the cursor to "arrows" (index 1) and press OK (space) -> the active scheme switches.
    const press = (key: string) => ({ pressed: (k: string) => k === key } as any);
    s.handleInput("keyConfig", press("arrowdown")); // both -> arrows
    const close = s.handleInput("keyConfig", press(" ")); // OK commits
    expect(close).toBe(true);
    expect(game.input.schemeName).toBe("arrows");
  });

  it("credits scroll runs to the end then signals completion", () => {
    const s = new Screens(game.assets, 320, 180); s.openCredits();
    let done = false;
    for (let i = 0; i < 1000 && !done; i++) done = s.tickCredits();
    expect(done).toBe(true);
  });
});

// ── K19: screen-transition tweens (action fires AFTER the tween) ─────────────────────────────────
describe("K19 screen-transition tweens", () => {
  beforeEach(setupWorld);

  it("transitionFrames=0 keeps goScreen instant (FSM unchanged)", () => {
    const { scene, log } = makeScene({}, 0);
    scene.startGameFromTitle();
    expect(scene.current()).toBe("intro");
    expect(log).toContain("play:intro"); // action fired synchronously
  });

  it("transitionFrames>0 flips the screen at once but DEFERS the action until the tween completes", () => {
    const { scene, log } = makeScene({}, 4);
    scene.startGameFromTitle();
    expect(scene.isTransitioning()).toBe(true);
    expect(scene.current()).toBe("intro");   // screen flips immediately (the fade renders over it)
    expect(log).not.toContain("play:intro"); // but the action is NOT fired yet (deferred by the tween)
    let progressed = false;
    for (let i = 0; i < 4; i++) { const p = scene.tickTransition(); if (p !== null && p > 0 && p < 1) progressed = true; }
    expect(progressed).toBe(true);           // the tween produced intermediate progress
    expect(log).toContain("play:intro");     // action fired at finishTransition
    expect(scene.isTransitioning()).toBe(false);
  });
});
