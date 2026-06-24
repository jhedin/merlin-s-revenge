import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnEnemy } from "@/entities/archetypes";
import { spawnChatter } from "@/entities/objTypes";
import { Movement } from "@/components/movement";

// gNavMode=1 (GameSpecific): a CLEARED room (game.navMode true) puts the PLAYER in nav mode — objRoom.goNavMode
// swaps walkAcceleration 0.5->6. With friction 0.125 the nav terminal (48) overshoots the global per-tick move
// cap gMoveSpeedLimit = tileSize-1, so nav TOP SPEED is the move cap itself (31px on a 32px grid), player-only;
// combat terminal (4) stays under the cap, unchanged.
describe("nav mode (objRoom.goNavMode / gNavMode)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(80, 80, 32); // wide open so the cap, not walls, bounds the run
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
  });
  afterEach(() => { game.navMode = undefined; });

  // run a unit east at full intent for enough ticks to reach terminal speed; return the per-tick step.
  // 60 ticks: at player accel 1.4 with intent held (no friction), it takes ~22 ticks to ramp to the 31 cap.
  function terminalStep(e: ReturnType<typeof spawnPlayer>): number {
    const m = e.get(Movement); m.maxSpeed = 4;
    for (let i = 0; i < 60; i++) { m.intentX = 1; const x0 = m.x; (m as any).update(() => {}); var step = m.x - x0; }
    return step!;
  }

  it("combat speed = walkSpeed; nav speed = the per-tick move cap (tileSize-1), not a maxSpeed multiple", () => {
    game.navMode = false;                         // uncleared room (combat)
    const combat = terminalStep(spawnPlayer(100, 100));
    expect(combat).toBeCloseTo(4, 4);             // combat terminal = walkSpeed (maxSpeed) 4, cap unbinding
    game.navMode = true;                          // cleared room (nav mode)
    const nav = terminalStep(spawnPlayer(100, 100));
    expect(nav).toBeCloseTo(31, 4);               // gMoveSpeedLimit move cap = tileSize-1 = 31px/tick binds
  });

  it("nav mode is PLAYER-only — enemies keep combat speed in a cleared room", () => {
    game.navMode = true;
    const e = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    const m = e.get(Movement); const base = m.maxSpeed;
    let step = 0;
    for (let i = 0; i < 20; i++) { m.intentX = 1; const x0 = m.x; (m as any).update(() => {}); step = m.x - x0; }
    expect(step).toBeLessThanOrEqual(base + 1e-6); // capped at its own maxSpeed, no nav boost
  });

  // objAiChatter.checkPossibleToTalk: a stone (talkOnlyOnNavMode default true) must NOT trigger while the
  // room is in combat (game.navMode false) — it waits until the room is cleared.
  it("a chatter stone does not trigger during combat, only once the room is cleared (nav mode)", () => {
    const fired: string[] = [];
    game.scene = { playInGameCutScene: (n: string) => fired.push(n), isInGameCutscene: () => false } as any;
    const player = spawnPlayer(100, 100); game.player = player; game.entities.push(player);
    const stone = spawnChatter("stones1", 100, 100); game.entities.push(stone); // overlapping
    game.navMode = false;          // room still has enemies
    stone.send("update");
    expect(fired).toEqual([]);     // blocked mid-combat
    game.navMode = true;           // room cleared -> nav mode
    stone.send("update");
    expect(fired).toEqual(["stones1"]); // now it talks
  });
});
