// objPotion vs objMedikit/objScroll: only a POTION (speed + the 3 mana potions) bumps the potionMaster
// "POTIONS DRUNK" tally and plays collect_powerup_02. The port used to count every pickup. (RESWEEP-pickups)
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnPickup, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import type { PickupEffect } from "@/components/pickup";

function collect(effect: PickupEffect) {
  const pk = spawnPickup(effect, 100, 100);
  const m = pk.get(Movement); m.x = 100; m.y = 100;       // on top of the player so the overlap fires
  game.entities = [game.player!, pk];
  pk.send("update");                                       // collect frame: applies effect + bumps tally if a potion
  return pk;
}

describe("potion tally is gated to objPotion (speed + mana potions)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(20, 20, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null, images: new Map(), ensureChar: () => {} } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0); game.potionMaster.reset();
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
    const p = spawnPlayer(100, 100); p.get(Movement).x = 100; p.get(Movement).y = 100; game.player = p;
  });

  it("a POTION bumps the tally for its type", () => {
    collect("speed");
    expect(game.potionMaster.getCount("speed")).toBe(1);
    expect(game.potionMaster.totalCollected()).toBe(1);
  });

  it("the speed potion adds the cast's +0.075 to maxSpeed (incWalkSpeedPotion), not an 8x over-boost", () => {
    const before = game.player!.get(Movement).maxSpeed;
    collect("speed");
    expect(game.player!.get(Movement).maxSpeed).toBeCloseTo(before + 0.075, 5);
  });

  it("a medikit / scroll does NOT bump the tally", () => {
    collect("heal");      // objMedikit
    collect("spell");     // objScroll (energyBlast)
    collect("sword");     // objScroll (merlinSword)
    expect(game.potionMaster.totalCollected()).toBe(0); // none of these are objPotion
  });

  it("each mana potion counts under its own type", () => {
    collect("manaCapacity"); collect("manaFlow"); collect("manaBurst");
    expect(game.potionMaster.totalCollected()).toBe(3);
    expect(game.potionMaster.getCount("manaCapacity")).toBe(1);
  });
});
