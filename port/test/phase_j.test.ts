import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { Mana } from "@/components/mana";
import { WeaponManager } from "@/components/weapon";
import { summonUnit } from "@/components/summon";

// J1: enemy casters get their real mana_* stats (was: defaulted to capacity 10), so a summoner's
// charge reaches its multistage tiers and it actually summons.
describe("J1 — AI caster mana stats + summon payload", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnEnemy = spawnEnemy;
  });

  it("spawnEnemy forwards the actor's real mana_capacity (not the default 10)", () => {
    const caster = spawnEnemy("scarletInGame", 100, 100, { animChar: "scarletInGame" });
    expect(caster.get(Mana).capacity).toBe(35); // act_scarletInGame mana_capacity
  });

  it("the caster's magic weapon is the summon spell, and that charge summons a tier", () => {
    const caster = spawnEnemy("scarletInGame", 100, 100, { animChar: "scarletInGame" });
    const ca = caster.get(WeaponManager).getCurrentAttack()!;
    expect(ca.name).toBe("#undeadSummon");
    expect(ca.explodeFunction).toBe("#summonUnit");
    game.entities = [caster];
    const before = game.entities.length;
    // at capacity 35 the charge clears the lowest tier (skeletonWarrior@15) and summons
    summonUnit(ca, caster.get(Mana).capacity, 100, 100, caster.id);
    expect(game.entities.length).toBeGreaterThan(before);
  });

  it("a capacity-10 caster could NOT afford the tier (proves the fix mattered)", () => {
    const caster = spawnEnemy("scarletInGame", 100, 100, { animChar: "scarletInGame" });
    const ca = caster.get(WeaponManager).getCurrentAttack()!;
    game.entities = [caster];
    summonUnit(ca, 10, 100, 100, caster.id); // the old default charge — below skeletonWarrior@15
    expect(game.entities.length).toBe(1); // nothing summoned
  });
});
