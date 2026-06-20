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
// is a #weaponMelee, energyBlast a #magic; resolveActor gives the structAttack-merged #attack.
const SCROLL_ACTOR: Record<string, string> = { sword: "merlinSword", spell: "energyBlast" };
function scrollAttack(effect: string) {
  return resolveAttack((registry.resolveActor(SCROLL_ACTOR[effect]!) ?? {})["attack"] as Record<string, any>);
}

export type PickupEffect = "heal" | "speed" | "sword" | "spell" | "manaCapacity" | "manaFlow" | "manaBurst";

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
      // mana powerups (objManaCapacity/Flow/Burst) each raise their own stat by the real potion inc
      case "manaCapacity": player.get(Mana).incCapacity(); break;
      case "manaFlow": player.get(Mana).incFlow(); break;
      case "manaBurst": player.get(Mana).incBurst(); break;
    }
  }
}
