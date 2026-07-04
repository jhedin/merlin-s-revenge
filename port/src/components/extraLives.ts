// ExtraLives (modExtraLives): banks extra lives and decides the death pathway. On entering #die the
// player records its respawn point; when the die animation finishes, the death handler asks
// attemptRespawn():
//   pExtraLives>0 -> respawn() in place (setLoc(respawnPoint), restoreEnergy, lives--), gameOver=false
//   else          -> gameOver=true   (-> gameMaster.gameOver -> wasted cutscene -> reload save)
// (modExtraLives.txt:59-93). The shipped config banks 0 extra lives by default, so the common path is
// straight to game-over — matching the original.
//
// NOT persisted (deliberately, faithfully): `modExtraLives.txt` has NO addSaveData/restoreFromSave at
// all — extra lives are a mechanic carried over from a sibling game on this shared engine (Rapunzel's
// Escape) and the shipped Merlin's Revenge config never expects them to survive a save/load. A restored
// player re-runs init() with the same config, resetting to the default (0 unless data-driven). An earlier
// port version added addSaveData/restoreFromSave here — a port-only addition diverging from the original.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";

export class ExtraLives extends Component {
  static handles = ["recordRespawnPoint", "attemptRespawn", "respawn", "getExtraLives", "addExtraLife"];
  private lives = 0;
  private respawnX = 0;
  private respawnY = 0;

  override init(cfg: Record<string, any>): void {
    this.lives = typeof cfg["extraLives"] === "number" ? cfg["extraLives"] : 0;
    this.respawnX = 0; this.respawnY = 0;
  }
  override reset(): void { this.lives = 0; this.respawnX = this.respawnY = 0; }

  // recordRespawnPoint: snapshot the loc on entering #die.
  recordRespawnPoint(next: NextFn): void {
    const m = this.entity.get(Movement); this.respawnX = m.x; this.respawnY = m.y; next();
  }

  // attemptRespawn -> true if the player respawned in place (still has lives), false -> game-over.
  attemptRespawn(_next: NextFn): boolean {
    if (this.lives > 0) { this.entity.send("respawn"); return true; }
    return false;
  }

  // respawn: setLoc(respawnPoint), restoreEnergy + revive, lives--.
  respawn(next: NextFn): void {
    const m = this.entity.get(Movement);
    m.x = this.respawnX; m.y = this.respawnY; m.vx = m.vy = 0; m.kvx = m.kvy = 0;
    this.entity.send("reviveFull"); // clear the dead latch + refill energy
    this.lives--;
    next();
  }

  getExtraLives(): number { return this.lives; }
  addExtraLife(next: NextFn): void { this.lives++; next(); }
}
