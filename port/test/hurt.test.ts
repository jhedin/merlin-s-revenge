import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnEnemy } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { Movement } from "@/components/movement";
import { Anim } from "@/components/anim";

describe("Hurt feedback (flash + i-frames)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(20, 20, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.input = { moveVector: () => ({ x: 0, y: 0 }), cursor: () => null, mouseDown: () => false,
      mousePressed: () => false, mouseReleased: () => false, held: () => false, pressed: () => false, endTick() {} } as any;
  });

  it("the player has NO post-hit i-frames — consecutive hits all land (modInvince is pickup-only)", () => {
    const p = spawnPlayer(100, 100); game.player = p; game.entities = [p];
    const en = p.get(Energy); const hp0 = en.energy;
    p.send("takeHit", 20, 0, -1);
    expect(en.energy).toBe(hp0 - 20);     // first hit lands
    expect(p.send("isInvince")).toBe(false); // no hit-invincibility (faithful: objPlayerMerlinCharacter)
    p.send("takeHit", 20, 0, -1);
    expect(en.energy).toBe(hp0 - 40);     // immediate follow-up ALSO lands (no i-frame block)
    // a PICKUP collect still grants temp-invince (modInvince.startTempInvince) — that path is unchanged.
    p.send("grantInvince", 200);
    expect(p.send("isInvince")).toBe(true);
    p.send("takeHit", 20, 0, -1);
    expect(en.energy).toBe(hp0 - 40);     // blocked by the PICKUP invince
  });

  it("enemies flash but have no i-frames (take continuous damage)", () => {
    const e = spawnEnemy("swordOrc", 0, 0, { animChar: "swordOrc" });
    e.get(Movement).inertia = 0; // isolate i-frames/flash from K1's inertia-damps-damage (swordOrc is 70)
    game.entities = [e];
    const en = e.get(Energy); const hp0 = en.energy;
    e.send("takeHit", 10, 0, -1);
    expect(en.energy).toBe(hp0 - 10);
    expect(e.send("isHurt")).toBe(true);
    expect(e.send("isInvince")).toBe(false); // no i-frames
    e.send("takeHit", 10, 0, -1);
    expect(en.energy).toBe(hp0 - 20);        // continuous damage
  });

  // objCPUCharacter overrides objCharacter's energyRecoverDelay(30) -> 300: a wounded enemy slowly trickles
  // +1 energy per 300 ticks (modEnergy.recoverEnergy) unless its data sets otherwise. swordOrc sets none, so
  // it must regenerate — the port previously defaulted CPU regen to 0 (never healed).
  it("a wounded CPU enemy slowly regenerates (energyRecoverDelay defaults to 300, not 0)", () => {
    const e = spawnEnemy("swordOrc", 0, 0, { animChar: "swordOrc" });
    e.get(Movement).inertia = 0;
    game.entities = [e];
    const en = e.get(Energy); const full = en.energy;
    e.send("takeHit", 30, 0, -1);
    const wounded = en.energy;
    expect(wounded).toBe(full - 30);
    for (let i = 0; i < 299; i++) e.send("update");
    expect(en.energy).toBe(wounded);          // not yet — the 300-tick counter hasn't fired
    e.send("update");
    expect(en.energy).toBe(wounded + 1);      // +1 trickle on the 300th tick
  });

  it("a grave holds a SINGLE static frame (modGrave: a one-time background blit, never animating)", () => {
    // a dead grave-leaving actor freezes: the original captures getAnimMemberFromStrip(#grave) ONCE and
    // blits it into the room background, so the corpse neither advances frames nor loops.
    game.assets = { index: { anims: { foo_grave: { delay: 1, frames: [{}, {}, {}] }, foo_stand: { delay: 1, frames: [{}] } } }, img: () => ({}) } as any;
    const e = spawnEnemy("swordOrc", 0, 0, { animChar: "foo" });
    game.entities = [e];
    e.send("takeHit", 999999, 0, -1);          // kill it -> pickAction returns "grave"
    const anim = e.get(Anim);
    for (let i = 0; i < 12; i++) (anim as any).update(() => {});
    expect((anim as any).frame).toBe(0);    // static — held at the grave frame, not advanced or looped
  });
});
