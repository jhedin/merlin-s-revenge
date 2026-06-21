import { describe, it, expect, beforeEach } from "vitest";
import { Thespian } from "@/scenes/thespian";
import { parseCutscene } from "@/data/cutscene";
import { Movement } from "@/components/movement";
import { Anim } from "@/components/anim";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

// minimal context: the Thespian drives cutscene actors' Movement/Anim directly (not the combat loop).
function setupWorld() {
  game.grid = new CollisionGrid(60, 60, 32);
  game.entities = [];
  // an anim index that resolves the cut chars' sheets so spriteCharOr/Anim don't fall back oddly.
  game.assets = { index: { anims: { mer_stand: { frames: [{}], delay: 4 }, mer_walk: { frames: [{}, {}], delay: 4 }, uli_stand: { frames: [{}], delay: 4 } } }, images: new Map(), ensureChar: () => {}, img: () => null } as any;
}

const host = { viewW: 320, viewH: 180, playSound: () => {}, playMusic: () => {}, keyForControl: (c: string) => "K_" + c };

describe("H1: Thespian drives real actors through Movement/Anim", () => {
  beforeEach(setupWorld);

  it("`at` teleports the actor; `walkTo` moves it toward the target over ticks", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm at 100\nm walkTo 200\nwait 200\n`);
    const t = new Thespian(cut, host);
    t.tick(); // run the sync verbs: at 100 sets x=100, then walkTo 200 sets a walk target; wait keeps alive
    const actor = t.visibleActors().find((p) => p.alias === "m")!;
    const m = actor.entity.get(Movement);
    expect(m.x).toBe(100);            // `at` teleported
    const x0 = m.x;
    for (let i = 0; i < 5; i++) t.tick();
    expect(m.x).toBeGreaterThan(x0);  // walkTo is actually moving the entity toward 200
    expect(m.x).toBeLessThanOrEqual(200);
    expect(m.facingLeft).toBe(false); // walking right
  });

  it("walkTo eventually ARRIVES at the target (real walk, not a snap)", () => {
    // a trailing wait keeps the actor alive long enough to observe arrival.
    const t = new Thespian(parseCutscene(`characters\n#merlin - m\nlines\nm at 0\nm walkTo 60\nwait 200\n`), host);
    for (let i = 0; i < 60; i++) t.tick();
    const m = t.visibleActors().find((p) => p.alias === "m")!.entity.get(Movement);
    expect(Math.round(m.x)).toBe(60); // walked all the way (not snapped on the first tick)
  });

  it("speakLine GATES the chain for displayTime+delayTime frames (auto-advance, no key)", () => {
    // "Hi" = 2 chars -> displayTime = round(50 + 2*1.4) = 53, + delay 12 = 65 frames.
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm: Hi\nm at 999\n`);
    const t = new Thespian(cut, host);
    t.tick(); // performs speakLine -> pending set; the next line (at 999) must NOT run yet
    expect(t.getSpeech()?.text).toBe("Hi");
    const actor = t.visibleActors().find((p) => p.alias === "m")!;
    // not yet advanced (still parked at the wings start, not 999)
    expect(actor.entity.get(Movement).x).not.toBe(999);
    // displayTime+delay = round(50 + 2*1.4) + 12 = 65 frames -> releases on the 66th tick.
    for (let i = 0; i < 64; i++) t.tick();
    expect(t.isFinished()).toBe(false); // gate still active at tick 65
    t.tick();                            // tick 66: gate releases, `at 999` runs -> scene finishes
    expect(t.isFinished()).toBe(true);
  });

  it("wait N blocks exactly N ticks before the next line runs", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm at 5\nwait 10\nm at 99\n`);
    const t = new Thespian(cut, host);
    t.tick(); // at 5, then wait 10 -> pending
    const m = t.visibleActors().find((p) => p.alias === "m")!.entity.get(Movement);
    expect(m.x).toBe(5);
    for (let i = 0; i < 9; i++) t.tick(); // 9 more ticks: still waiting (10 total counting the first)
    expect(m.x).toBe(5);
    t.tick(); // wait expired -> at 99 runs -> scene finishes
    // the actor was created by the scene, so after finish it's torn down — assert via a longer scene:
    const t2 = new Thespian(parseCutscene(`characters\n#merlin - m\nlines\nm at 5\nwait 10\nm at 99\nwait 50\n`), host);
    for (let i = 0; i < 11; i++) t2.tick();
    expect(t2.visibleActors().find((p) => p.alias === "m")!.entity.get(Movement).x).toBe(99);
  });

  it("goMode sets an anim override; turnToFace flips toward another actor", () => {
    // a trailing wait keeps the scene alive (else the all-sync script finishes + tears down the cast).
    const cut = parseCutscene(`characters\n#merlin - m\n#ulin - u\nlines\nm at 100\nu at 40\nm turnToFace u\nm goMode #look\nwait 100\n`);
    const t = new Thespian(cut, host);
    t.tick();
    const m = t.visibleActors().find((p) => p.alias === "m")!;
    expect(m.entity.get(Movement).facingLeft).toBe(true); // ulin is to the left of merlin
    expect(m.modeOverride).toBe("look");
  });

  it("the scene reports done only AFTER the last line's timer expires", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm: Bye\n`);
    const t = new Thespian(cut, host);
    t.tick();
    expect(t.isFinished()).toBe(false); // still showing "Bye"
    for (let i = 0; i < 200; i++) { if (t.tick()) break; }
    expect(t.isFinished()).toBe(true);
  });

  it("#key interpolation replaces #key <control> at display time", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm: Press #key fire now\n`);
    const t = new Thespian(cut, host);
    t.tick();
    expect(t.getSpeech()?.text).toContain("K_FIRE".toUpperCase()); // host.keyForControl("fire") -> K_fire, upper
  });

  it("lightsDown blocks the chain for the fade duration", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm at 5\nlightsDown\nm at 80\n`);
    const t = new Thespian(cut, host);
    t.tick(); // at 5, then lightsDown -> pending (fade window). lightsTarget=false now set.
    const m = t.visibleActors().find((p) => p.alias === "m")!.entity.get(Movement);
    expect(m.x).toBe(5);
    t.tick(); // tweenStage now advances the fade
    expect(t.darkness()).toBeGreaterThan(0); // fading
    expect(m.x).toBe(5);                      // still gated (the next line hasn't run)
  });

  it("ESC/cancel finishes the scene immediately and tears down spawned actors", () => {
    const cut = parseCutscene(`characters\n#merlin - m\nlines\nm: A very long line\nwait 300\n`);
    const t = new Thespian(cut, host);
    t.tick();
    expect(t.isFinished()).toBe(false);
    t.cancel();
    t.tick();
    expect(t.isFinished()).toBe(true);
    expect(t.visibleActors().length).toBe(0);
  });
});
