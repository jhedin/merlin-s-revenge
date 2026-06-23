// modWastedMode (the "You Got Wasted!" game-over cutscene): wastedModeOn only setBlend(30) +
// setAnimKeepSize(true) + setSpriteHeight(60) — a translucent vertical STRETCH. It does NOT change the
// animation strip, so the wasted Merlin keeps walking/standing (he walks on, walks off, then speaks) even
// though his energy is 0 (isDead). Regression: an earlier port forced the mer_die pose here, freezing him
// on a single death frame, and ALSO ran modStretchDeath on top (fading him to invisible mid-cutscene).
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer } from "@/entities/archetypes";
import { Anim } from "@/components/anim";
import { Energy } from "@/components/combat";
import { Movement } from "@/components/movement";

function stubAssets() {
  game.assets = {
    index: { anims: {
      mer_stand: { delay: 1, loop: true, frames: [{ file: "stand.png", w: 16, h: 16, reg: [8, 16], dela: 1 }] },
      mer_walk: { delay: 1, loop: true, frames: [{ file: "walk0.png", w: 16, h: 16, reg: [8, 16], dela: 1 }, { file: "walk1.png", w: 16, h: 16, reg: [8, 16], dela: 1 }] },
      mer_grave: { delay: 1, loop: false, frames: [{ file: "grave.png", w: 16, h: 16, reg: [8, 16], dela: 1 }] },
    } },
    images: new Map([["stand.png", {}], ["walk0.png", {}], ["walk1.png", {}], ["grave.png", {}]] as any),
    img: (f: string) => ({ src: f } as any),
    ensureChar: () => {},
  } as any;
}

describe("wasted-mode animation (modWastedMode)", () => {
  beforeEach(() => { game.grid = new CollisionGrid(20, 20, 32); game.entities = []; stubAssets(); });

  it("a wasted (energy-dead) player keeps standing — NOT a grave or a frozen death frame", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    p.get(Energy).dead = true;       // killed in action
    p.send("goWastedMode");          // the cutscene's `m goWastedMode` verb
    expect(p.send("isWasted")).toBe(true);

    p.get(Anim).update(() => {});
    const sp = p.get(Anim).sprite()!;
    expect(sp).not.toBeNull();
    // renders the live STAND frame (stationary), not the grave frame and not a stretch-death body.
    expect((sp.img as any).src).toBe("stand.png");
    expect(sp.scaleY).toBeUndefined();   // no modStretchDeath stretch piled on the wasted blend
    expect(sp.alpha).toBeUndefined();    // not fading to invisible (the cutscene applies the 0.3 blend itself)
  });

  it("a wasted player WALKS when moving (enterStageRight/exitStageLeft), not stuck on a death pose", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    p.get(Energy).dead = true;
    p.send("goWastedMode");
    p.get(Movement).vx = 2;          // the cutscene drives him across the stage
    p.get(Anim).update(() => {});
    const sp = p.get(Anim).sprite()!;
    expect((sp.img as any).src).toMatch(/^walk/); // a walk frame while moving
  });

  it("WITHOUT wasted mode, an energy-dead stretch-death player still stretches+fades (unchanged)", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    p.get(Energy).dead = true;       // dead, but NOT wasted
    expect(p.send("isWasted")).toBe(false);
    for (let i = 0; i < 5; i++) p.get(Anim).update(() => {});
    const sp = p.get(Anim).sprite()!;
    expect(sp.scaleY!).toBeGreaterThan(1); // modStretchDeath still applies on the normal death path
    expect(sp.alpha!).toBeLessThan(1);
  });
});
