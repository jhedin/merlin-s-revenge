import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnEnemy } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { Anim } from "@/components/anim";

describe("Hurt feedback (flash + i-frames)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(20, 20, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.input = { moveVector: () => ({ x: 0, y: 0 }), cursor: () => null, mouseDown: () => false,
      mousePressed: () => false, mouseReleased: () => false, held: () => false, pressed: () => false, endTick() {} } as any;
  });

  it("player i-frames let the landing hit through but block immediate follow-ups", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    const en = p.get(Energy); const hp0 = en.energy;
    p.send("takeHit", 20, 0, -1);
    expect(en.energy).toBe(hp0 - 20);     // first hit lands
    expect(p.send("isInvince")).toBe(true);
    expect(p.send("isHurt")).toBe(true);
    p.send("takeHit", 20, 0, -1);
    expect(en.energy).toBe(hp0 - 20);     // blocked by i-frames
    for (let i = 0; i < 18; i++) p.send("update"); // i-frames decay
    expect(p.send("isInvince")).toBe(false);
    p.send("takeHit", 20, 0, -1);
    expect(en.energy).toBe(hp0 - 40);     // takes damage again
  });

  it("enemies flash but have no i-frames (take continuous damage)", () => {
    const e = spawnEnemy("swordOrc", 0, 0, { animChar: "swordOrc" });
    game.entities = [e];
    const en = e.get(Energy); const hp0 = en.energy;
    e.send("takeHit", 10, 0, -1);
    expect(en.energy).toBe(hp0 - 10);
    expect(e.send("isHurt")).toBe(true);
    expect(e.send("isInvince")).toBe(false); // no i-frames
    e.send("takeHit", 10, 0, -1);
    expect(en.energy).toBe(hp0 - 20);        // continuous damage
  });

  it("a one-shot action (grave) holds its last frame instead of looping", () => {
    // grave is one-shot; a dead entity routes through it deterministically via pickAction
    game.assets = { index: { anims: { foo_grave: { delay: 1, frames: [{}, {}, {}] }, foo_stand: { delay: 1, frames: [{}] } } }, img: () => ({}) } as any;
    const e = spawnEnemy("swordOrc", 0, 0, { animChar: "foo" });
    game.entities = [e];
    e.send("takeHit", 999999, 0, -1);          // kill it -> pickAction returns "grave"
    const anim = e.get(Anim);
    for (let i = 0; i < 12; i++) (anim as any).update(() => {});
    expect((anim as any).frame).toBe(2);    // clamped at last of 3 frames, not wrapped back to 0
  });
});
