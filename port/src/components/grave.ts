// Grave (modGrave): "leaves a permanent grave behind when an object dies." On death-finalize the actor's
// #grave anim member is drawn into the room background and recorded in the room's pGraves, so it stays
// where the actor fell, BEHIND the living actors, persisting across re-entry and save.
//
// Port representation: the dead actor IS its own grave — it holds the #grave anim frame at the death loc
// and persists through the per-room pState snapshot exactly like the original's recorded grave (the
// heavy-entity-vs-baked-blit difference is internal, not observable). The grave faces RIGHT
// (setFlipFromDir(1)) and renders behind live actors (a low render-z, see Anim.sprite). A GHOST sets
// pGraveOn=false (modGrave.init: `if params[#ghost] then pGraveOn = false`) and leaves NO grave — it
// simply vanishes when finished.

import { Component } from "../engine/dispatch";

export class Grave extends Component {
  static handles = ["getGraveOn"];
  private graveOn = true;

  // modGrave.init: pGraveOn = params.graveOn (data, default true), then forced false for a #ghost. A few
  // actors ship #graveOn:false (sumo / skelitonLord / skelitonUpper / orcInvasion / undeadInvasion) and
  // must vanish on death (no #grave strip → otherwise a persistent _stand corpse). Was dropping the data
  // field and keying off ghost alone.
  override init(cfg: Record<string, any>): void { this.graveOn = cfg["graveOn"] !== false && cfg["ghost"] !== true; }
  override reset(): void { this.graveOn = true; }

  // getGraveOn (modGrave.getGraveOn): does this actor leave a grave on death? (false for ghosts.)
  getGraveOn(): boolean { return this.graveOn; }
}
