// Pickup (modMedikit / powerup writings): a collectible the player walks over to gain an effect
// (heal / speed / power), then it vanishes. Spawned from #medikit/#walkSpeed/#mana* spawn tiles.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { Energy } from "./combat";
import { Mana } from "./mana";
import { PlayerControl } from "./control";
import { resolveAttack } from "./weapon";
import { registry } from "../game/data";
import { game } from "../game/context";

// pickup effect -> the actor whose #attack the scroll grants (modWeaponManager.addWeapon). merlinSword
// is a #weaponMelee, energyBlast a #magic; resolveActor gives the structAttack-merged #attack. The C
// spell scrolls (cBlast/darkBlast/arcticBlast/healBlast/armySummon/monsterSummon/energyMines) are all
// #magic weapons that differ from energyBlast only in their #attack data — picking one up is the same
// addWeapon row (the B2 engine fires them with zero new mechanics; their splash/freeze/heal/summon
// behaviour rides on the C2/C3 payload/cast wiring).
const SCROLL_ACTOR: Record<string, string> = {
  sword: "merlinSword", spell: "energyBlast",
  cBlast: "cBlast", darkBlast: "darkBlast", arcticBlast: "arcticBlast", healBlast: "healBlast",
  armySummon: "armySummon", monsterSummon: "monsterSummon", energyMines: "energyMines",
};
function scrollAttack(effect: string) {
  return resolveAttack((registry.resolveActor(SCROLL_ACTOR[effect]!) ?? {})["attack"] as Record<string, any>);
}

export type PickupEffect = "heal" | "speed" | "sword" | "spell" | "manaCapacity" | "manaFlow" | "manaBurst"
  | "cBlast" | "darkBlast" | "arcticBlast" | "healBlast" | "armySummon" | "monsterSummon" | "energyMines";

export class Pickup extends Component {
  static handles = ["update", "isFinished", "getEffect"];
  effect: PickupEffect = "heal";
  private collected = false;

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["effect"] === "string") this.effect = cfg["effect"] as PickupEffect;
    this.collected = false;
  }
  override reset(): void { this.collected = false; }
  isFinished(): boolean { return this.collected; }
  getEffect(): PickupEffect { return this.effect; }

  update(next: NextFn): void {
    const p = game.player;
    if (p && !p.send("isDead") && !this.collected) {
      const m = this.entity.get(Movement);
      const pp = p.send("getPos") as { x: number; y: number };
      if (Math.abs(pp.x - m.x) < 16 && Math.abs(pp.y - m.y) < 16) {
        this.apply(p);
        this.collected = true;
        game.audio?.play("collect_powerup_01"); // collectSound
      }
    }
    next();
  }

  private apply(player: import("../engine/dispatch").Entity): void {
    switch (this.effect) {
      case "heal": { const en = player.get(Energy); en.energy = en.max; break; }
      case "speed": player.get(Movement).maxSpeed += 0.6; break;
      case "sword": player.get(PlayerControl).equipSword(scrollAttack("sword")); break; // merlinSword: addWeapon
      case "spell": player.get(PlayerControl).grantSpell(scrollAttack("spell")); break; // energyBlast: addWeapon magic
      // C1/C2/C3 spell scrolls — each is a #magic weapon, granted via the same addWeapon path. The
      // payload/splash/summon behaviour is driven off the weapon's #attack at cast time (control.ts).
      case "cBlast": case "darkBlast": case "arcticBlast": case "healBlast":
      case "armySummon": case "monsterSummon": case "energyMines":
        player.get(PlayerControl).grantSpell(scrollAttack(this.effect)); break;
      // mana powerups (objManaCapacity/Flow/Burst) each raise their own stat by the real potion inc
      case "manaCapacity": player.get(Mana).incCapacity(); break;
      case "manaFlow": player.get(Mana).incFlow(); break;
      case "manaBurst": player.get(Mana).incBurst(); break;
    }
  }
}
