import { describe, it, expect, beforeEach } from "vitest";
import { spawnPlayer } from "@/entities/archetypes";
import { WeaponManager as WM } from "@/components/weapon";
import { scrollAttack } from "@/components/pickup";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

// objAiPlayer:157-187 — number keys 1-9 select the current magic weapon (selectSpell). Without the wiring
// the player was stuck on the last-collected spell. Verify pressing a digit switches the current magic.
describe("spell hotkeys 1-9 (objAiPlayer.selectSpell)", () => {
  let pressed = new Set<string>();
  const stubInput = () => ({
    moveVector: () => ({ x: 0, y: 0 }), cursor: () => null,
    mouseDown: () => false, mousePressed: () => false, mouseReleased: () => false,
    held: () => false, pressed: (k: string) => pressed.has(k), endTick() {},
  });

  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.armyMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    pressed = new Set<string>();
    game.input = stubInput() as any;
  });

  it("pressing 1 / 2 switches the current magic weapon between collected spells", () => {
    const player = spawnPlayer(300, 200); game.player = player; game.entities.push(player);
    const wm = player.get(WM);
    // grant two magic weapons (energyBlast = "spell", then armySummon). addWeapon auto-selects the latest.
    wm.addWeapon("#energyBlast", scrollAttack("spell"));
    wm.addWeapon("#armySummon", scrollAttack("armySummon"));
    const magic = wm.weaponsOfType("magic");
    expect(magic.length).toBe(2);
    expect(wm.getMagicAttack()!.name).toBe(magic[1]); // last-collected is current

    pressed = new Set(["1"]); player.send("update");          // #spell1 -> selectSpell(0) -> first magic
    expect(wm.getMagicAttack()!.name).toBe(magic[0]);

    pressed = new Set(["2"]); player.send("update");          // #spell2 -> selectSpell(1) -> second magic
    expect(wm.getMagicAttack()!.name).toBe(magic[1]);
  });
});
