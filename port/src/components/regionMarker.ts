// RegionMarker: a zero-cost effect Entity for the placed region-effect objTypes (objMagicLimit /
// objMusic / objTeamOverride). On spawn it applies its effect once (mirroring the original's `on init`
// / `on start`):
//   magicLimit   -> game.magicLimit.set(N)                  (objMagicLimit.init: setMagicLimit)
//   teamOverride -> game.teamMaster.teamOverride = #teamSym  (objTeamOverride.init: setTeamOverride)
//   music        -> game.audio.playMusic(track)             (objMusic.start: soundMaster.playMusic)
//
// The magicLimit / teamOverride effects are ROOM-SCOPED (the original's `on finish` restores the
// default on room-leave): the RoomManager resets game.magicLimit + teamMaster.teamOverride to their
// defaults at the start of each room entry, BEFORE this room's markers re-apply on spawn — so a dimmed
// region or a gang-up override can't leak into the next room (plan §g.5). Music is one-shot (the
// restart-guard in audio.playMusic prevents a re-trigger when the same track is already playing).

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export type RegionEffect = "magicLimit" | "music" | "teamOverride";

export class RegionMarker extends Component {
  static handles = ["update", "isFinished"];
  private effect: RegionEffect = "magicLimit";
  private value: number | string = 0;
  private applied = false;

  override init(cfg: Record<string, any>): void {
    this.effect = (cfg["effect"] as RegionEffect) ?? "magicLimit";
    this.value = cfg["value"] ?? 0;
    this.applied = false;
    this.apply();
  }
  override reset(): void { this.applied = false; }

  isFinished(): boolean { return false; } // a marker persists for the life of the room

  private apply(): void {
    if (this.applied) return;
    this.applied = true;
    switch (this.effect) {
      case "magicLimit":
        game.magicLimit.set(Number(this.value));
        break;
      case "teamOverride":
        // setTeamOverride(#teamSym): everyone seeking #enemy gangs up on the override team (teams.ts).
        game.teamMaster.teamOverride = String(this.value);
        break;
      case "music":
        game.audio?.playMusic(String(this.value)); // restart-guard inside; "stopMusic" sentinel -> stop
        break;
    }
  }

  // a spawned marker applies once on init; nothing to do per-tick (kept as a no-op chain handler so the
  // entity has at least one update handler and participates in the entity loop).
  update(next: NextFn): void { next(); }
}
