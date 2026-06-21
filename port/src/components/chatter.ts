// Chatter (casts/script_objects/objChatter.txt): a cutscene-trigger NPC ("talking stones"). Walking onto
// it (in nav mode) swaps to its talking member and plays its #scriptToPerform cutscene via cutSceneMaster,
// then latches pPerformed (objChatter.collected, :43-61).
//
// K12: the #stonesN cutscene scripts (scr_stones1..10) are now BUNDLED (tools/build_assets.ts) and play
// on demand, so the inert-decoration fallback is replaced by the real overlap FSM. Each tick, if not yet
// performed and the player overlaps the stone's per-actor trigger box (derived from its #collisionRect —
// the stones use rect(-320,-320,320,320), but kingStones/armySummonStones/berlinTV carry SMALLER rects),
// the stone goes #talking (swap to its talking member) and asks the scene FSM to play its script over the
// live game (playInGameCutScene). pPerformed latches so it talks ONCE. A second touch while #talking
// reverts to #finishedTalking (waiting member). type "chatter" keeps stones off room-clear.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { game } from "../game/context";

// PLAYER_EDGE: objChatter triggers via CollisionCheck(me.big, player) (objGameObject:271), which expands
// the chatter's OWN #collisionRect by the player's collision half-extent (obj2.edgeOffset) and tests the
// player center against it. The player archetype's box (half-extent) is 12, so the per-axis trigger reach
// = chatterHalfExtent + 12. Fallback reach if an actor carries no rect (matches the legacy stones' ±320).
const PLAYER_EDGE = 12;
const FALLBACK_REACH = 320;

export class Chatter extends Component {
  static handles = ["update", "getScriptToPerform", "getPerformed", "goMode", "getMode"];
  private scriptToPerform = "";
  private performed = false;
  private mode = "waiting"; // #waiting -> #talking -> #finishedTalking (objChatter.goMode member swap)
  // per-axis trigger reach derived from the actor's #collisionRect (half-extent + player edge). The stones
  // carry rect(-320,-320,320,320); kingStones rect(-100,-50,100,50); armySummonStones rect(-16,-16,16,16) —
  // each is a DIFFERENT trigger zone, so this must be data-driven, not a shared constant.
  private reachX = FALLBACK_REACH;
  private reachY = FALLBACK_REACH;

  override init(cfg: Record<string, any>): void {
    this.scriptToPerform = typeof cfg["scriptToPerform"] === "string" ? cfg["scriptToPerform"] : "";
    this.performed = false;
    this.mode = "waiting";
    const r = cfg["collisionRect"];
    if (r && typeof r === "object" && typeof r.left === "number" && typeof r.right === "number") {
      this.reachX = Math.abs(r.right - r.left) / 2 + PLAYER_EDGE;
      this.reachY = Math.abs(r.bottom - r.top) / 2 + PLAYER_EDGE;
    } else {
      this.reachX = this.reachY = FALLBACK_REACH;
    }
  }
  override reset(): void { this.performed = false; this.mode = "waiting"; }

  getScriptToPerform(): string { return this.scriptToPerform; }
  getPerformed(): boolean { return this.performed; }
  getMode(): string { return this.mode; }

  // goMode (objChatter.goMode): #talking swaps to the talking member; #finishedTalking reverts. The port's
  // stones ship a single stand strip (no separate talking/waiting art), so this tracks the FSM state only.
  goMode(mode: string): void { this.mode = mode; }

  // collected (objChatter.collected): on player overlap, if not performed -> #talking + play its script,
  // latch performed. Honors a #scriptToPerform of "" / "#none" (no script: latch without playing). Skips
  // re-trigger while an in-game cutscene is already running (the scene gates a second play).
  update(next: NextFn): void {
    if (!this.performed && this.overlapsPlayer() && !game.scene?.isInGameCutscene()) {
      this.goMode("talking");
      const script = this.scriptToPerform.replace(/^#/, "");
      if (script && script !== "none") game.scene?.playInGameCutScene(script);
      this.performed = true;
    }
    next();
  }

  private overlapsPlayer(): boolean {
    const p = game.player; if (!p) return false;
    const pm = p.tryGet(Movement); const sm = this.entity.tryGet(Movement);
    if (!pm || !sm) return false;
    return Math.abs(pm.x - sm.x) <= this.reachX && Math.abs(pm.y - sm.y) <= this.reachY;
  }
}
