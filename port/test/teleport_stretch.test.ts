// modTeleport beam: summon/desummon stretch. A summoned unit beams IN (stretch collapses + fade-in, then
// resumes normal render); a desummoned unit beams OUT (stretch + fade-out) and is INERT until the beam ends,
// at which point teleportOutDone() signals the cull to remove it.
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnAlly, spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Team } from "@/components/combat";
import { Anim } from "@/components/anim";
import { rebuildCombatSubstrate } from "@/systems/combatTick";

describe("modTeleport beam (summon/desummon stretch)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(60, 60, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null, images: new Map(), ensureChar: () => {} } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
  });

  it("teleport-OUT beam plays ~15 frames, then signals done for the cull", () => {
    const e = spawnAlly("warrior", 100, 100); game.entities = [e];
    const a = e.get(Anim);
    expect(a.isTeleportingOut()).toBe(false);
    a.startTeleportOut();
    expect(a.isTeleportingOut()).toBe(true);
    expect(a.teleportOutDone()).toBe(false);
    for (let i = 0; i < 15; i++) { rebuildCombatSubstrate(); e.send("update"); }
    expect(a.teleportOutDone()).toBe(true);  // the main-loop cull removes it now
  });

  it("a beaming-OUT ally is INERT (does not move/attack while it stretches away)", () => {
    const ally = spawnAlly("warrior", 100, 100); ally.get(Team).team = "#aldevar";
    const foe = spawnEnemy("warrior", 130, 100); foe.get(Team).team = "#orcs"; // in reach, hostile
    game.entities = [ally, foe];
    ally.get(Anim).startTeleportOut();
    const x0 = ally.get(Movement).x;
    for (let i = 0; i < 5; i++) { rebuildCombatSubstrate(); ally.send("update"); }
    expect(ally.get(Movement).x).toBe(x0);          // didn't chase
    expect(ally.send("getAiMode")).not.toBe("attack"); // didn't attack
  });

  it("teleport-IN resolves to normal render after the beam (not flagged leaving)", () => {
    const e = spawnAlly("warrior", 100, 100); game.entities = [e];
    const a = e.get(Anim);
    a.startTeleportIn();
    expect(a.isTeleportingOut()).toBe(false);
    for (let i = 0; i < 16; i++) { rebuildCombatSubstrate(); e.send("update"); }
    expect(a.isTeleportingOut()).toBe(false);
    expect(a.teleportOutDone()).toBe(false);          // an IN beam never signals removal
  });
});
