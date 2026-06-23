// Mine animAction (objMine getMode -> modAnimSet getAnimSym): a static mine must show its #primed armed
// frame and its #explode burst strip, not be stuck on #stand. The #explode mode also holds for the burst
// strip's length before the mine re-arms/dies (modExploder explodeFin-on-strip-loop) — without this the
// _primed/_explode art (pitMonster, fire, the 5 auras) never played.
import { describe, it, expect, beforeEach } from "vitest";
import { spawnPlayer } from "@/entities/archetypes";
import { spawnMine } from "@/entities/objTypes";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import { Anim } from "@/components/anim";
import { Movement } from "@/components/movement";
import assets from "@/generated/assets.json";

describe("Mine plays #primed / #explode strips (not stuck on #stand)", () => {
  beforeEach(() => {
    game.assets = { index: assets, images: new Map(), img: () => null, ensureChar: async () => {} } as any;
    game.grid = new CollisionGrid(80, 80, 32);
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.entities = [];
  });

  it("a pitMonster cycles stand -> primed -> explode and re-arms after the burst", () => {
    const mine = spawnMine("pitMonster", 200, 200); game.entities.push(mine);
    const target = spawnPlayer(700, 200); game.entities.push(target); // out of trigger radius at first
    const seen = new Set<string>();
    for (let t = 0; t < 220; t++) {
      if (t === 130) { target.get(Movement).x = 208; target.get(Movement).y = 200; } // step in AFTER it primes
      rebuildCombatSubstrate();
      for (const e of game.entities) if (e !== target) e.send("update");
      seen.add((mine.get(Anim) as any).action);
    }
    expect(seen.has("stand")).toBe(true);    // un-primed countdown
    expect(seen.has("primed")).toBe(true);   // armed (was the ONLY state shown before the fix)
    expect(seen.has("explode")).toBe(true);  // detonation burst
  });
});
