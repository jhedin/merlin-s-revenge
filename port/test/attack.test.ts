import { describe, it, expect } from "vitest";
import { spawnEnemy, spawnAlly, spawnPlayer } from "@/entities/archetypes";
import { EnemyAI } from "@/components/control";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import { Movement } from "@/components/movement";

describe("CPU beam weapon — techMech fires an instant stretched beam (objAiCPU inherits objAiAttack beam dispatch)", () => {
  it("a #beam weapon spawns a beam bullet (at the target, zero velocity), not a travelling bullet", () => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.armyMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    const player = spawnPlayer(300, 200); game.player = player; game.entities.push(player);
    const mech = spawnEnemy("techMech", 360, 200); game.entities.push(mech); // 60px < laserBeam reach 150
    let bullet: any;
    for (let t = 0; t < 90 && !bullet; t++) { rebuildCombatSubstrate(); mech.send("update"); bullet = game.entities.find((e) => e.type === "bullet"); }
    expect(bullet).toBeTruthy();
    const p = bullet.get(Movement);
    // performBeamAttack spawns the bullet AT the target loc with zero velocity (not a travelling projectile).
    expect(Math.hypot(p.vx, p.vy)).toBe(0);
    expect(Math.abs(p.x - 300)).toBeLessThan(12); // landed at/near the target (player), not at the caster
  });
});

describe("CPU damage-caster releases a charge-scaled objSpell (not a fixed bolt)", () => {
  it("goblinMage (energyBlast) spawns a real spell actor that flies+explodes, charge-scaled by mana", () => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.armyMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    const player = spawnPlayer(300, 200); game.player = player; game.entities.push(player);
    const mage = spawnEnemy("goblinMage", 440, 200); game.entities.push(mage); // #objAiCPUSpellCaster / energyBlast
    let sawSpell = false;
    for (let t = 0; t < 200 && !sawSpell; t++) { rebuildCombatSubstrate(); mage.send("update"); sawSpell = game.entities.some((e) => e.type === "spell"); }
    expect(sawSpell).toBe(true); // released a real objSpell (grow-fly-explode), NOT a generic immediate bullet
  });
});

describe("#firingType velocity — a #fullstrength thrower fires its bullet at strength px/tick", () => {
  it("fangBunnyBaby (#fullstrength, strength 8) throws at ~8 px/tick, NOT the old fixed 4.5", () => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.armyMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    const player = spawnPlayer(300, 200); game.player = player; game.entities.push(player);
    const thrower = spawnEnemy("fangBunnyBaby", 360, 200); game.entities.push(thrower); // 60px < reach 125
    let bullet: any;
    for (let t = 0; t < 90 && !bullet; t++) { rebuildCombatSubstrate(); thrower.send("update"); bullet = game.entities.find((e) => e.type === "bullet"); }
    expect(bullet).toBeTruthy();
    const m = bullet.get(Movement);
    const speed = Math.hypot(m.vx, m.vy);
    expect(speed).toBeCloseTo(8, 0);   // = strength (firingType #fullstrength), proves the throw-velocity wiring
  });
});

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

import { WeaponManager } from "@/components/weapon";
describe("#firingType — ranged throw velocity model (modAttack performRangedAttack)", () => {
  it("defaults to #proportional and reads #fullstrength overrides", () => {
    // structMaster default is #proportional; fangBunnyBaby explicitly overrides to #fullstrength.
    const baby = spawnEnemy("fangBunnyBaby", 0, 0).get(WeaponManager).getCurrentAttack();
    expect(baby?.firingType.toLowerCase()).toBe("#fullstrength");
    // dwarfTower's #attack explicitly carries #proportional (= the structMaster default).
    const tower = spawnEnemy("dwarfTower", 0, 0).get(WeaponManager).getCurrentAttack();
    expect(tower?.firingType.toLowerCase()).toBe("#proportional");
    // archerBow's weapon record sets #fullstrength → the resolved current attack carries it (read from data).
    const archer = spawnEnemy("archer", 0, 0).get(WeaponManager).getCurrentAttack();
    expect(archer?.firingType.toLowerCase()).toBe("#fullstrength");
  });
});

describe("#runReload — data-driven kiting (objCPUCharacter getRunReload)", () => {
  it("the 4 actors that set #runReload:true kite, even though they are plain #objAiCPU", () => {
    // bat/caveBat/evilTv/vultureGuard are #objAiCPU + #naturalRanged (NOT spellcaster/magic/bomber), so the
    // old AiType-only derivation missed them. The data property #runReload:true must drive the kite.
    for (const a of ["bat", "caveBat", "evilTv", "vultureGuard"]) {
      const ai = spawnEnemy(a, 0, 0).get(EnemyAI);
      expect.soft(ai.runReload, `${a} should kite (data #runReload:true)`).toBe(true);
    }
    // a plain ranged enemy with no #runReload key (archer) does NOT kite.
    expect(spawnEnemy("archer", 0, 0).get(EnemyAI).runReload).toBe(false);
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

import { PlayerControl } from "@/components/control";
describe("player melee autofire (objAiPlayer: #melee/#ranged autofire on cooldown, into empty air)", () => {
  it("the player swings its punch on cooldown even with NO target in reach", () => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.armyMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.input = { moveVector: () => ({ x: 0, y: 0 }), cursor: () => ({ x: 400, y: 200 }), mouseDown: () => true,
      mousePressed: () => false, mouseReleased: () => false, held: () => false, pressed: () => false, endTick() {} } as any;
    const player = spawnPlayer(200, 200); game.player = player; game.entities.push(player);
    // no enemies anywhere — Merlin must still auto-punch (the swing whiffs, but it animates + sounds).
    let swung = false;
    for (let t = 0; t < 40 && !swung; t++) { player.send("update"); swung = player.send("animAction") === "naturalMelee"; }
    expect(swung).toBe(true); // auto-swing happened with nothing in reach
  });

  it("the player does NOT swing when the fire button is NOT held (click/hold-to-attack)", () => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.armyMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.input = { moveVector: () => ({ x: 0, y: 0 }), cursor: () => ({ x: 400, y: 200 }), mouseDown: () => false,
      mousePressed: () => false, mouseReleased: () => false, held: () => false, pressed: () => false, endTick() {} } as any;
    const player = spawnPlayer(200, 200); game.player = player; game.entities.push(player);
    let swung = false;
    for (let t = 0; t < 40 && !swung; t++) { player.send("update"); swung = player.send("animAction") === "naturalMelee"; }
    expect(swung).toBe(false); // fire not held -> no swing (objAiPlayer.interpretMouse #notPressed: nothing)
  });
});
