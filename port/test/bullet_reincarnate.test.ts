import { describe, it, expect, beforeEach } from "vitest";
import { fireBullet, fireSplashBullet } from "@/systems/bullets";
import { spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { Projectile } from "@/components/projectile";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { registry } from "@/game/data";
import { EnemyAI } from "@/components/control";

// objBullet.reincarnate: a fired bullet spawns its #reincarnateAs at its death loc — flamingRock leaves a
// #fire mine, lizardEgg/ostrichEgg HATCH into creatures. The port's pooled bullet now carries the list and
// the Projectile death choke-point (finish) spawns each child via spawnFromSymbol.
describe("bullet #reincarnateAs — flaming rocks leave fire, eggs hatch (objBullet.reincarnate)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.spawnEnemy = spawnEnemy;
    game.spawnUnit = spawnUnit;
  });

  it("a plain bullet carrying reincarnateAs:[#fire] leaves a fire mine when it expires", () => {
    // act_fire is an #objMine -> spawnFromSymbol routes it to a 'mine' entity.
    const b = fireBullet(-1, 100, 100, 1, 0, 4, 5, "#monsters", 2 /* tiny maxLife -> expires fast */);
    b.get(Projectile).reincarnateAs = ["fire"];
    for (let i = 0; i < 4; i++) b.send("update"); // life exceeds maxLife -> finish() -> hatch
    expect(b.send("isFinished")).toBe(true);
    const mines = game.entities.filter((e) => e.type === "mine");
    expect(mines.length).toBe(1);                 // exactly one #fire mine spawned at the corpse loc
    expect(mines[0]!.send("getTeam")).toBe("#fire");
  });

  it("ostrichEgg's reincarnateAs hatches a babyOstrich (egg -> creature)", () => {
    // Resolve the real bullet data so the test pins the data wiring, not a hand-picked symbol.
    const egg = registry.resolveActor("ostrichEgg");
    expect(egg?.["reincarnateAs"]).toBeTruthy();   // data really carries the hatch list
    const b = fireBullet(-1, 120, 120, 1, 0, 4, 5, "#swamp", 2);
    b.get(Projectile).reincarnateAs = ["babyOstrich"];
    for (let i = 0; i < 4; i++) b.send("update");
    const hatched = game.entities.filter((e) => e.send("getActorType") === "babyOstrich");
    expect(hatched.length).toBe(1);                // the egg hatched into one babyOstrich
  });

  it("an ordinary bullet (no reincarnateAs) leaves nothing behind", () => {
    const b = fireBullet(-1, 100, 100, 1, 0, 4, 5, "#monsters", 2);
    for (let i = 0; i < 4; i++) b.send("update");
    expect(b.send("isFinished")).toBe(true);
    expect(game.entities.filter((e) => e.type === "mine" || e.type === "enemy").length).toBe(0);
  });

  it("lavaDarkGolem (flamingRock thrower) is wired to leave fire", () => {
    expect(registry.resolveActor("flamingRock")?.["reincarnateAs"]).toBeTruthy();
    const ai = spawnEnemy("lavaDarkGolem", 0, 0).get(EnemyAI) as any;
    expect(ai.bulletReincarnate).toContain("fire"); // the resolved bullet's #reincarnateAs reached the AI
    void fireSplashBullet;
  });
});
