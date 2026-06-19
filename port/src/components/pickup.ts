// Pickup (modMedikit / powerup writings): a collectible the player walks over to gain an effect
// (heal / speed / power), then it vanishes. Spawned from #medikit/#walkSpeed/#mana* spawn tiles.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { Energy } from "./combat";
import { Mana } from "./mana";
import { PlayerControl } from "./control";
import { game } from "../game/context";

export type PickupEffect = "heal" | "speed" | "sword" | "manaCapacity" | "manaFlow" | "manaBurst";

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
      }
    }
    next();
  }

  private apply(player: import("../engine/dispatch").Entity): void {
    switch (this.effect) {
      case "heal": { const en = player.get(Energy); en.energy = en.max; break; }
      case "speed": player.get(Movement).maxSpeed += 0.6; break;
      case "sword": player.get(PlayerControl).equipSword(); break;       // merlinSword: strong melee weapon
      // mana powerups (objManaCapacity/Flow/Burst) each raise their own stat, then top up the pool
      case "manaCapacity": { const m = player.get(Mana); m.capacity += 5; m.current = m.capacity; break; }
      case "manaFlow": player.get(Mana).flow += 0.5; break;
      case "manaBurst": player.get(Mana).burst += 1; break;
    }
  }
}
