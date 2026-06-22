// modAnimSet keys an actor's sprite strips by its data #name, NOT its record key. spriteCharOr resolves
// that (like it already does for bullet chars), so fireDragon -> "dragon", goblinArcher -> "gar", etc.
// render their real art instead of a blackOrc / wrong-kin fallback. Uses the REAL assets.json bundle so a
// regression (dropping the #name rule) re-surfaces the blackOrc fallback.
import { describe, it, expect, beforeEach } from "vitest";
import { spriteCharOr } from "@/components/anim";
import { spawnEnemy } from "@/entities/archetypes";
import { Anim } from "@/components/anim";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import assets from "@/generated/assets.json";

describe("spriteCharOr resolves the faithful #name sprite (not the record key / a kin alias)", () => {
  beforeEach(() => {
    game.assets = { index: assets, images: new Map(), img: () => null, ensureChar: async () => {} } as any;
    game.collision = new CollisionGrid(80, 80, 32) as any;
  });

  it("maps key -> #name sprite when the #name strip is bundled", () => {
    expect(spriteCharOr("fireDragon")).toBe("dragon");   // #name "dragon" (was blackOrc → no weaponRanged)
    expect(spriteCharOr("dragon")).toBe("dragon");
    expect(spriteCharOr("goblinArcher")).toBe("gar");    // its own sprite, not the "archer" kin alias
    expect(spriteCharOr("skeletonWarrior")).toBe("skw"); // not the "skelitonFootSoldier" kin alias
    expect(spriteCharOr("lavaGolem")).toBe("lavaDarkGolem");
    expect(spriteCharOr("summonOrc")).toBe("bowOrc");    // summoned units were all blackOrc
  });

  it("falls back to the raw key when #name has no bundled strip (no regression for name===key actors)", () => {
    expect(spriteCharOr("swordOrc")).toBe("swordOrc");
    expect(spriteCharOr("archer")).toBe("archer");
  });

  it("spawnEnemy gives fireDragon the dragon sprite char (and its weaponRanged strip exists)", () => {
    const dragon = spawnEnemy("fireDragon", 0, 0);
    expect(dragon.get(Anim).char).toBe("dragon");
    expect((assets as any).anims["dragon_weaponRanged"]).toBeTruthy(); // the 4-shot breath strip is bundled
  });
});
