import { describe, it, expect } from "vitest";
import { spawnPlayer, spawnPickup } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { PlayerControl } from "@/components/control";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

describe("pickups", () => {
  it("a heal pickup the player overlaps restores energy and is consumed", () => {
    game.grid = new CollisionGrid(20, 20, 32);
    const player = spawnPlayer(100, 100);
    game.player = player;
    player.get(Energy).energy = 20;            // hurt the player
    const pickup = spawnPickup("heal", 100, 100); // on top of the player
    game.entities = [player, pickup];
    pickup.send("update");
    expect(player.get(Energy).energy).toBe(player.get(Energy).max); // healed
    expect(pickup.send("isFinished")).toBe(true);                   // consumed
  });
  it("a far pickup is not collected", () => {
    game.grid = new CollisionGrid(20, 20, 32);
    const player = spawnPlayer(0, 0); game.player = player;
    const pickup = spawnPickup("speed", 400, 400);
    game.entities = [player, pickup];
    pickup.send("update");
    expect(pickup.send("isFinished")).toBe(false);
  });
  it("the merlinSword pickup equips a stronger, longer-reaching melee", () => {
    game.grid = new CollisionGrid(20, 20, 32);
    const player = spawnPlayer(100, 100); game.player = player;
    const pc = player.get(PlayerControl);
    const basePower = pc.power, baseReach = pc.meleeReach;
    const pickup = spawnPickup("sword", 100, 100);
    game.entities = [player, pickup];
    pickup.send("update");
    expect(pc.hasSword).toBe(true);
    expect(pc.power).toBeGreaterThan(basePower);
    expect(pc.meleeReach).toBeGreaterThan(baseReach);
    expect(pickup.send("isFinished")).toBe(true);
  });
});
