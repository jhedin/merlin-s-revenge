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
export function scrollAttack(effect: string) {
  return resolveAttack((registry.resolveActor(SCROLL_ACTOR[effect]!) ?? {})["attack"] as Record<string, any>);
}

export type PickupEffect = "heal" | "maxikit" | "speed" | "sword" | "spell" | "energyPunch" | "manaCapacity" | "manaFlow" | "manaBurst"
  | "cBlast" | "darkBlast" | "arcticBlast" | "healBlast" | "armySummon" | "monsterSummon" | "energyMines"
  | "gmg" | "energyBeam" | "energyPulse";

// objPotion (speed + the three mana potions): the only pickups that are POTIONS. Two cast behaviours key off
// this: (a) the collectSound is act_powerUp's inherited "collect_powerup_02" (scrolls/medikits keep _01), and
// (b) only a potion bumps the potionMaster "POTIONS DRUNK" tally — medikits/scrolls/sword/gmg do NOT.
const POTIONS = new Set<PickupEffect>(["speed", "manaCapacity", "manaFlow", "manaBurst"]);

export class Pickup extends Component {
  static handles = ["update", "isFinished", "getEffect", "writingPhase"];
  effect: PickupEffect = "heal";
  // objPowerUpWriting: on collect the powerup does NOT vanish — it swaps its sprite to <effect>_writing,
  // goMode(#writing) + startFade (startTransBlend(2,#out): blend 100->0 at speed 2 = 50 ticks), then
  // setDead(true) on faderFin. writingTicks: -1 = not collected; 0..WRITE_FADE counts up the fade.
  private writingTicks = -1;
  private static readonly WRITE_FADE = 50;

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["effect"] === "string") this.effect = cfg["effect"] as PickupEffect;
    this.writingTicks = -1;
  }
  override reset(): void { this.writingTicks = -1; }
  isFinished(): boolean { return this.writingTicks >= Pickup.WRITE_FADE; } // dies only AFTER the caption fades
  getEffect(): PickupEffect { return this.effect; }

  // the live writing-caption phase for the renderer (objPowerUpWriting): the granted effect + the caption's
  // fading alpha (1 -> 0 over WRITE_FADE), or null before collection (still the potion/scroll art).
  writingPhase(): { effect: PickupEffect; alpha: number } | null {
    if (this.writingTicks < 0) return null;
    return { effect: this.effect, alpha: 1 - this.writingTicks / Pickup.WRITE_FADE };
  }

  update(next: NextFn): void {
    const p = game.player;
    if (p && !p.send("isDead") && this.writingTicks < 0) {
      const m = this.entity.get(Movement);
      const pp = p.send("getPos") as { x: number; y: number };
      if (Math.abs(pp.x - m.x) < 16 && Math.abs(pp.y - m.y) < 16) {
        this.apply(p);             // grant the effect exactly once, on the collect frame
        this.writingTicks = 0;     // enter the writing/fade phase (displayWriting + startFade) instead of dying
        game.audio?.play(POTIONS.has(this.effect) ? "collect_powerup_02" : "collect_powerup_01"); // collectSound (act_powerUp inherits _02)
      }
    } else if (this.writingTicks >= 0 && this.writingTicks < Pickup.WRITE_FADE) {
      this.writingTicks++;         // advance the fade (modFader.startFade); faderFin -> isFinished -> swept
    }
    next();
  }

  private apply(player: import("../engine/dispatch").Entity): void {
    // only a POTION bumps the potionMaster tally (G3b: pPotionsCollected) — objPotion.collect calls it;
    // objMedikit/objScroll/gmg never do (the port previously over-counted every pickup).
    if (POTIONS.has(this.effect)) game.potionMaster?.potionCollected(this.effect);
    switch (this.effect) {
      // real medikit (G3a): BANK a kit (gradual stockpiled heal via Medikit.update) + a flat +25 below.
      case "heal": player.send("medikitCollected", 1); break;
      // maxikit (objPlayerMerlinCharacter.medikitCollected #maxikit branch): an INSTANT FULL heal
      // (increaseEnergy(maxEnergy-energy)) — NOT a banked gradual kit, and NOT the +25 bonus.
      case "maxikit": player.send("increaseEnergy", 1e9); break; // full top-up via increaseEnergy (NO gold glow)
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
    // supersedes the bonus) and gmg (gmgCollected has no bonus). Goes through increaseEnergy, NOT takeHeal —
    // the original's pickup bonus is increaseEnergy(25) with NO gold glow (that's heal-spell-only).
    if (this.effect !== "maxikit" && this.effect !== "gmg") player.send("increaseEnergy", 25);
    // startTempInvince (objPlayerMerlinCharacter:153,170,199): collecting ANY pickup grants
    // pTempInvinceTime=200 frames of invincibility (a safety window, distinct from the post-hit i-frames).
    player.send("grantInvince", 200);
  }
}
