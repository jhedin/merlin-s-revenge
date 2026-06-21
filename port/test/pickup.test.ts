import { describe, it, expect } from "vitest";
import { spawnPlayer, spawnPickup } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { Medikit } from "@/components/medikit";
import { Mana } from "@/components/mana";
import { WeaponManager } from "@/components/weapon";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

describe("pickups", () => {
  it("a medikit BANKS a kit (gradual heal) AND grants the +25 instant bonus (medikitCollected #medikit)", () => {
    game.grid = new CollisionGrid(20, 20, 32);
    const player = spawnPlayer(100, 100);
    game.player = player;
    player.get(Energy).energy = 20;            // hurt the player (well below max)
    const pickup = spawnPickup("heal", 100, 100); // on top of the player
    game.entities = [player, pickup];
    pickup.send("update");
    // objPlayerMerlinCharacter.medikitCollected(#medikit): ancestor.medikitCollected() BANKS a kit AND
    // increaseEnergy(pBonusEnergy=25) heals instantly. So energy 20 -> 45, plus a banked gradual kit.
    expect(player.send("getNumOfMedikits")).toBe(1);               // banked
    expect(player.get(Energy).energy).toBe(45);                    // +25 instant bonus
    expect(pickup.send("isFinished")).toBe(true);                  // consumed
    // the banked kit then heals +1 every 5 frames (tick Medikit directly — PlayerControl needs live input)
    const med = player.get(Medikit);
    for (let i = 0; i < 30; i++) med.update(() => {});
    expect(player.get(Energy).energy).toBeGreaterThan(45);         // gradual heal in progress
    expect(player.get(Energy).energy).toBeLessThan(player.get(Energy).max); // still gradual
  });
  it("a maxikit is an INSTANT FULL heal (medikitCollected #maxikit), not a banked kit", () => {
    game.grid = new CollisionGrid(20, 20, 32);
    const player = spawnPlayer(100, 100); game.player = player;
    player.get(Energy).energy = 10;            // badly hurt
    const pickup = spawnPickup("maxikit", 100, 100);
    game.entities = [player, pickup];
    pickup.send("update");
    expect(player.get(Energy).energy).toBe(player.get(Energy).max); // filled to MAX instantly
    expect(player.send("getNumOfMedikits")).toBe(0);               // NOT banked (no gradual kit)
    expect(pickup.send("isFinished")).toBe(true);
  });
  it("a far pickup is not collected", () => {
    game.grid = new CollisionGrid(20, 20, 32);
    const player = spawnPlayer(0, 0); game.player = player;
    const pickup = spawnPickup("speed", 400, 400);
    game.entities = [player, pickup];
    pickup.send("update");
    expect(pickup.send("isFinished")).toBe(false);
  });
  it("each mana powerup raises its own stat (not one generic boost)", () => {
    game.grid = new CollisionGrid(20, 20, 32);
    const player = spawnPlayer(100, 100); game.player = player;
    const mana = player.get(Mana);
    const cap0 = mana.capacity, flow0 = mana.flow, burst0 = mana.burst;
    game.entities = [player];
    for (const eff of ["manaCapacity", "manaFlow", "manaBurst"] as const) {
      const pk = spawnPickup(eff, 100, 100);
      game.entities.push(pk); pk.send("update");
    }
    expect(mana.capacity).toBeGreaterThan(cap0);
    expect(mana.flow).toBeGreaterThan(flow0);
    expect(mana.burst).toBeGreaterThan(burst0);
  });
  it("the merlinSword pickup addWeapon's a #weaponMelee, auto-selected with longer reach", () => {
    game.grid = new CollisionGrid(20, 20, 32);
    const player = spawnPlayer(100, 100); game.player = player;
    const wm = player.get(WeaponManager);
    expect(wm.weaponsOfType("nonMagic")).toEqual(["#punch"]);           // starts punch-only
    const punchReach = wm.getMeleeAttack()!.reach;
    const pickup = spawnPickup("sword", 100, 100);
    game.entities = [player, pickup];
    pickup.send("update");
    // both melee weapons owned; the sword is auto-selected (setCurrentWeapon) as the current melee
    expect(wm.weaponsOfType("nonMagic")).toEqual(["#punch", "#merlinSword"]);
    const sword = wm.getMeleeAttack()!;
    expect(sword.name).toBe("#merlinSword");
    expect(sword.damageMultiplier).toBe(16);
    expect(sword.reach).toBeGreaterThan(punchReach);                 // longer reach (point(12,5))
    expect(player.send("getHasSpell")).toBe(false);                 // still no magic weapon
    expect(pickup.send("isFinished")).toBe(true);
  });
});
