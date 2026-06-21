import { describe, it, expect, beforeEach } from "vitest";
import { depositMines } from "@/components/summon";
import { spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { resolveAttack } from "@/components/weapon";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { registry } from "@/game/data";

// modSpellMultistage.depositMines: an #explodeFunction:#depositMines spell (energyMines) drops
// numMines = charge/chargePerUnit #energyMine actors scattered around the loc. Previously unimplemented
// (spellActor only handled #summonUnit) — the player energyMines spell AND verdanlinInGame now deposit.
describe("#depositMines — energyMines drops energyMine actors (modSpellMultistage.depositMines)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.spawnEnemy = spawnEnemy;
    game.spawnUnit = spawnUnit;
  });

  const energyMinesAttack = () => {
    const rec = registry.resolveActor("energyMines")!;
    return resolveAttack(rec["attack"] as Record<string, any>, rec);
  };

  it("deposits floor(charge / chargePerUnit) energyMine actors (chargePerUnit 10)", () => {
    const a = energyMinesAttack();
    expect(a.explodeFunction.toLowerCase()).toContain("depositmines");
    expect(a.chargePerUnit).toBe(10);
    depositMines(a, 35, 200, 200);                 // 35/10 = 3 mines
    const mines = game.entities.filter((e) => e.type === "mine");
    expect(mines.length).toBe(3);
    expect(mines.every((m) => m.send("getTeam") === "#aldevar")).toBe(true); // hits the caster's enemies
  });

  it("a non-depositMines attack deposits nothing", () => {
    const a = energyMinesAttack();
    depositMines({ ...a, explodeFunction: "#summonUnit" }, 35, 200, 200);
    expect(game.entities.filter((e) => e.type === "mine").length).toBe(0);
  });

  it("an energyMine is SINGLE-SHOT — objMine default i[#dieOnExplode]=true (energyMine sets none)", () => {
    // The re-arming mines (fire/pitMonster/auras) all set dieOnExplode:false; energyMine leaves it UNSET, so
    // it must default TRUE (consumed after one blast). The old `=== true` wrongly re-armed it forever.
    depositMines(energyMinesAttack(), 10, 200, 200);
    const mine = game.entities.find((e) => e.type === "mine")!;
    const mineComp = (mine as any).comps.find((c: any) => "dieOnExplode" in c);
    expect(mineComp.dieOnExplode).toBe(true);
  });
});
