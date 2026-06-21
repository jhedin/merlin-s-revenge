// modStretchDeath (act_player #stretchDeath): the player's magical death — the body stretches vertically
// (scaleY 1 -> 1.7, anchored at the feet) AND fades to transparent (alpha 1 -> 0) over ~33 frames, instead
// of switching to a grave. Drives off the entity's own death state (no grave swap, no early vanish).
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer } from "@/entities/archetypes";
import { Anim } from "@/components/anim";
import { Energy } from "@/components/combat";

function stubAssets() {
  game.assets = {
    index: { anims: { mer_stand: { delay: 1, loop: true, frames: [{ file: "mer.png", w: 16, h: 24, reg: [8, 24], dela: 1 }] } } },
    images: new Map([["mer.png", {} as any]]),
    img: () => ({} as any),
    ensureChar: () => {},
  } as any;
}

describe("player stretch death (modStretchDeath)", () => {
  beforeEach(() => { game.grid = new CollisionGrid(20, 20, 32); game.entities = []; stubAssets(); });

  it("a living player draws normally (no stretch, full opacity)", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    p.get(Anim).update(() => {});
    const sp = p.get(Anim).sprite()!;
    expect(sp).not.toBeNull();
    expect(sp.scaleY).toBeUndefined();              // no vertical stretch while alive
  });

  it("on death the body stretches taller and fades, progressing over time (not a grave/vanish)", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    p.get(Energy).dead = true;                       // killed

    p.get(Anim).update(() => {});                    // 1 frame of death
    const a = p.get(Anim).sprite()!;
    expect(a).not.toBeNull();                        // still drawn (NOT null/vanished)
    expect(a.scaleY!).toBeGreaterThan(1);            // stretching up
    expect(a.alpha!).toBeLessThan(1);                // fading
    expect(a.alpha!).toBeGreaterThan(0);

    for (let i = 0; i < 10; i++) p.get(Anim).update(() => {}); // more frames -> more stretch, less opacity
    const b = p.get(Anim).sprite()!;
    expect(b.scaleY!).toBeGreaterThan(a.scaleY!);    // taller
    expect(b.alpha!).toBeLessThan(a.alpha!);         // more transparent
  });

  it("the transform completes (fully faded, fully stretched) by the end of its duration", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    p.get(Energy).dead = true;
    expect(p.get(Anim).stretchDeathDone()).toBe(false); // not done at the very start of the death
    for (let i = 0; i < 40; i++) p.get(Anim).update(() => {});
    const sp = p.get(Anim).sprite()!;
    expect(sp.alpha!).toBeCloseTo(0, 5);             // fully faded
    expect(sp.scaleY!).toBeCloseTo(1.7, 5);          // fully stretched (1 + 0.7)
    expect(p.get(Anim).stretchDeathDone()).toBe(true); // #stretchDeathFin: the death-resolution signal
  });

  it("reviving (extra-life respawn in place) resets the transform for the next death", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    p.get(Energy).dead = true;
    for (let i = 0; i < 10; i++) p.get(Anim).update(() => {});
    expect(p.get(Anim).sprite()!.scaleY!).toBeGreaterThan(1);
    p.get(Energy).dead = false;                      // respawned in place
    p.get(Anim).update(() => {});
    expect(p.get(Anim).sprite()!.scaleY).toBeUndefined(); // back to normal, transform reset
  });
});
