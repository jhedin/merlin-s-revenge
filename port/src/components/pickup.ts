// Pickup (modMedikit / powerup writings): a collectible the player walks over to gain an effect
// (heal / speed / power), then it vanishes. Spawned from #medikit/#walkSpeed/#mana* spawn tiles.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
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
  sword: "merlinSword", spell: "energyBlast", energyPunch: "energyPunch",
  cBlast: "cBlast", darkBlast: "darkBlast", arcticBlast: "arcticBlast", healBlast: "healBlast",
  armySummon: "armySummon", monsterSummon: "monsterSummon", energyMines: "energyMines",
  // I8 beams: each grants a #magic weapon with a #releaseFunction:#fireBullets streaming release.
  energyBeam: "energyBeamSpell", energyPulse: "energyPulseSpell",
};
function scrollAttack(effect: string) {
  return resolveAttack((registry.resolveActor(SCROLL_ACTOR[effect]!) ?? {})["attack"] as Record<string, any>);
}

export type PickupEffect = "heal" | "maxikit" | "speed" | "sword" | "spell" | "energyPunch" | "manaCapacity" | "manaFlow" | "manaBurst"
  | "cBlast" | "darkBlast" | "arcticBlast" | "healBlast" | "armySummon" | "monsterSummon" | "energyMines"
  | "gmg" | "energyBeam" | "energyPulse";

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
    // every collected powerup bumps the potionMaster tally for its type (G3b: pPotionsCollected).
    game.potionMaster?.potionCollected(this.effect);
    switch (this.effect) {
      // real medikit (G3a): BANK a kit (gradual stockpiled heal via Medikit.update) + a flat +25 below.
      case "heal": player.send("medikitCollected", 1); break;
      // maxikit (objPlayerMerlinCharacter.medikitCollected #maxikit branch): an INSTANT FULL heal
      // (increaseEnergy(maxEnergy-energy)) — NOT a banked gradual kit, and NOT the +25 bonus.
      case "maxikit": player.send("takeHeal", 1e9, 0, -1); break;
      case "speed": player.get(Movement).maxSpeed += 0.6; break;
      case "sword": player.get(PlayerControl).equipSword(scrollAttack("sword")); break; // merlinSword: addWeapon
      // energyPunch (I4): a #magicMelee melee-weapon scroll (newScrollCollected -> addWeapon). Granted
      // as a melee weapon via the SAME equipSword path (addWeapon + widen the melee sweep). Fires through
      // the B2 WeaponManager like merlinSword. DEVIATION (plan §g.6): the original #magicMelee adds a mana
      // term in calcCollisionVectMelee (·(strength+1.5·manaCapacity)/1.5); the port's melee uses
      // power·strength·MELEE_SCALE (the documented B2 calibration), so energyPunch does not scale with mana
      // — it lands as a faithful melee upgrade (damageMultiplier 1.75) without the mana coupling.
      case "energyPunch": player.get(PlayerControl).equipSword(scrollAttack("energyPunch")); break;
      case "spell": player.get(PlayerControl).grantSpell(scrollAttack("spell")); break; // energyBlast: addWeapon magic
      // C1/C2/C3 spell scrolls — each is a #magic weapon, granted via the same addWeapon path. The
      // payload/splash/summon behaviour is driven off the weapon's #attack at cast time (control.ts).
      case "cBlast": case "darkBlast": case "arcticBlast": case "healBlast":
      case "armySummon": case "monsterSummon": case "energyMines":
      // I8 beams: energyBeam/energyPulse scrolls grant a #magic weapon with the streaming release.
      case "energyBeam": case "energyPulse":
        player.get(PlayerControl).grantSpell(scrollAttack(this.effect)); break;
      // I7 GMG (newScrollCollected's #gmg branch): NOT addWeapon — it's a MODE. Collecting sets the
      // collected flag and turns it on (PlayerControl.gmgCollected).
      case "gmg": player.get(PlayerControl).gmgCollected(); break;
      // mana powerups (objManaCapacity/Flow/Burst) each raise their own stat by the real potion inc
      case "manaCapacity": player.get(Mana).incCapacity(); break;
      case "manaFlow": player.get(Mana).incFlow(); break;
      case "manaBurst": player.get(Mana).incBurst(); break;
    }
    // medikitCollected / newScrollCollected / potionCollected ALL end with increaseEnergy(pBonusEnergy=25):
    // collecting ANY medikit/scroll/sword/potion grants a flat +25 health. EXCEPT maxikit (its full heal
    // supersedes the bonus) and gmg (gmgCollected has no bonus). takeHeal(12.5,0) = (12.5+0)·2 = +25, capped
    // at maxEnergy. objPlayerMerlinCharacter.txt:156,166,200.
    if (this.effect !== "maxikit" && this.effect !== "gmg") player.send("takeHeal", 12.5, 0, -1);
  }
}
