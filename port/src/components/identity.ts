// Identity (objGameObject.getActorType): every spawned actor carries the bare actor-type NAME it was
// spawned from (e.g. "blackOrc", "orcVillage", "player", or a pickup effect key). This is the respawn
// KEY — the generic (de)serializer routes a saved actor back through the right spawn factory by this
// symbol, exactly as the original keys every respawn off getActorType(). Set at spawn via the build cfg.

import { Component } from "../engine/dispatch";

export class Identity extends Component {
  static handles = ["getActorType"];
  actorType = "";

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["actorType"] === "string") this.actorType = cfg["actorType"];
  }
  override reset(): void { this.actorType = ""; }
  getActorType(): string { return this.actorType; }
}
