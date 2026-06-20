// ExtraLives (modExtraLives): banks extra lives and decides the death pathway. On entering #die the
// player records its respawn point; when the die animation finishes, the death handler asks
// attemptRespawn():
//   pExtraLives>0 -> respawn() in place (setLoc(respawnPoint), restoreEnergy, lives--), gameOver=false
//   else          -> gameOver=true   (-> gameMaster.gameOver -> wasted cutscene -> reload save)
// (modExtraLives.txt:59-93). The shipped config banks 0 extra lives by default, so the common path is
// straight to game-over — matching the original.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";

export class ExtraLives extends Component {
  static handles = ["recordRespawnPoint", "attemptRespawn", "respawn", "getExtraLives", "addExtraLife",
    "addSaveData", "restoreFromSave"];
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

  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["lives"] = { lives: this.lives };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const s = sd["lives"]; if (s) this.lives = s.lives;
    return next(sd);
  }
}
