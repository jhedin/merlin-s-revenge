import { describe, it, expect } from "vitest";
import { spawnEnemy, spawnAlly, spawnPlayer } from "@/entities/archetypes";
import { EnemyAI } from "@/components/control";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { rebuildCombatSubstrate } from "@/systems/combatTick";

describe("#leaveWhenFinished — a summoned ally retires (teleports out + banks) when the room is clear", () => {
  it("a leaveWhenFinished ally with no targets banks to the reserve and is removed", () => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.armyMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    const player = spawnPlayer(200, 200); game.player = player; game.entities.push(player);
    const w = spawnAlly("warrior", 240, 200); game.entities.push(w);       // warrior = #leaveWhenFinished
    expect(w.flags.has("left")).toBe(false);
    // no enemies -> after the no-target grace (60 frames) the ally teleports out (objAiCPU #noTargetFound).
    for (let t = 0; t < 65; t++) { rebuildCombatSubstrate(); w.send("update"); }
    expect(w.flags.has("left")).toBe(true);                                 // flagged for removal by the main loop
    expect(game.armyMaster.reserveCount("#aldevar", "warrior")).toBe(1);    // banked (armyTeleportOut), re-fields next room
  });
});

describe("data-driven attacks (real #attack via #weapon)", () => {
  it("archer resolves to a ranged attack with long reach", () => {
    const ai = spawnEnemy("archer", 0, 0).get(EnemyAI);
    expect(ai.ranged).toBe(true);
    expect(ai.reachRanged).toBe(100); // archerBow reach
  });
  it("warrior resolves to a melee attack with short reach", () => {
    const ai = spawnEnemy("warrior", 0, 0).get(EnemyAI);
    expect(ai.ranged).toBe(false);
    expect(ai.reach).toBe(25); // warriorSword reach
  });
  it("magic reach (9999) is capped", () => {
    const ai = spawnEnemy("mageOrc", 0, 0).get(EnemyAI);
    expect(ai.ranged).toBe(true);
    expect(ai.reachRanged).toBeLessThanOrEqual(220);
  });

  it("#naturalRanged throwers are RANGED and resolve their #bullet (not mis-classified as melee)", () => {
    // bat throws batBullet, dwarfTower throws towerAxe (splash), iceRock throws a FREEZING iceBoulder.
    const bat = spawnEnemy("bat", 0, 0).get(EnemyAI) as any;
    expect(bat.ranged).toBe(true);
    expect(bat.bulletAttack?.payloadFunction).toContain("takeHit");
    const tower = spawnEnemy("dwarfTower", 0, 0).get(EnemyAI) as any;
    expect(tower.ranged).toBe(true);
    expect(tower.splashBullet).toBeTruthy();          // towerAxe is #explode -> the splash path
    const ice = spawnEnemy("iceRock", 0, 0).get(EnemyAI) as any;
    expect(ice.ranged).toBe(true);
    // #bullet:#iceboulder resolves to act_iceBoulder despite the case mismatch (case-insensitive registry),
    // carrying the freeze payload so iceRock's throw freezes its target.
    expect(ice.bulletAttack?.payloadFunction).toContain("takeFreeze");
  });
});

import { EnemyAI as AI2 } from "@/components/control";
describe("FSM configuration from #AiType", () => {
  it("maps spellcaster->ranged+runReload, ghost->drift, cpu->melee beeline", () => {
    const mage = spawnEnemy("mageOrc", 0, 0).get(AI2);      // #objAiCPUSpellCaster (magic)
    expect(mage.ranged).toBe(true); expect(mage.runReload).toBe(true);
    const ghost = spawnEnemy("monkGhost", 0, 0).get(AI2);   // #objAiCPUGhost (drift approximation)
    expect(ghost.ghost).toBe(true);
    const warrior = spawnEnemy("warrior", 0, 0).get(AI2);   // #objAiCPU (plain melee)
    expect(warrior.ranged).toBe(false); expect(warrior.runReload).toBe(false); expect(warrior.ghost).toBe(false);
  });
});
