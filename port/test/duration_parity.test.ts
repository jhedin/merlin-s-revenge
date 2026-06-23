// Duration-parity sweep: for each timed visual EFFECT the original plays over D>1 frames, drive it on a real
// entity and COUNT the frames it actually plays, then assert the count matches the cast's duration. This is
// the cheap proxy for "the animation actually renders for its full span" when we can't assert pixels — it
// catches an effect collapsed to 0/instant (the missing-stretch bug) AND one that plays for the wrong span
// ("2 frames instead of 15"). Add a row here whenever a new timed effect lands; the cast citation is the spec.
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnAlly, spawnUnit } from "@/entities/archetypes";
import { Anim } from "@/components/anim";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import type { Entity } from "@/engine/dispatch";

beforeEach(() => {
  game.grid = new CollisionGrid(60, 60, 32);
  game.entities = [];
  game.assets = { index: { anims: {} }, img: () => null, images: new Map(), ensureChar: () => {} } as any;
  game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
});

// tick a live entity (its components, incl. Anim) up to `cap` frames, stopping when `done` first holds; returns
// the number of frames played. A cap well above the expected span turns a never-finishing (or 0-frame) effect
// into a clear failure rather than a hang.
function framesUntil(e: Entity, done: () => boolean, cap = 120): number {
  for (let n = 1; n <= cap; n++) { rebuildCombatSubstrate(); e.send("update"); if (done()) return n; }
  return cap + 1; // sentinel: never finished within the cap
}

interface DurationCase {
  name: string;
  cast: number;        // the cast's frame count for this effect
  ref: string;         // cast citation (file:line) — the spec this asserts against
  play: () => number;  // drive the effect once; return the frames it actually played
}

const CASES: DurationCase[] = [
  {
    name: "teleport-out beam (armyTeleportOut)",
    cast: 15, ref: "modTeleport.txt:35 pTeleportFrames=15",
    play: () => {
      const e = spawnAlly("warrior", 100, 100); game.entities = [e];
      const a = e.get(Anim); a.startTeleportOut();
      return framesUntil(e, () => a.teleportOutDone());
    },
  },
  {
    name: "teleport-in beam (armyTeleportIn)",
    cast: 15, ref: "modTeleport.txt:35 pTeleportFrames=15",
    play: () => {
      const e = spawnAlly("warrior", 100, 100); game.entities = [e];
      const a = e.get(Anim); a.startTeleportIn();
      // the in-beam clears itself the frame after it completes, so it stops "teleporting" at cast+1 ticks.
      return framesUntil(e, () => !a.isTeleporting()) - 1;
    },
  },
];

describe("duration parity: timed effects play for their full cast span (not collapsed to 0/instant)", () => {
  for (const c of CASES) {
    it(`${c.name} plays ~${c.cast} frames (${c.ref})`, () => {
      const played = c.play();
      expect(played).toBeGreaterThan(0);                 // NOT collapsed to instant (the missing-stretch class)
      expect(Math.abs(played - c.cast)).toBeLessThanOrEqual(1); // within ±1 of the cast's frame count
    });
  }
});
