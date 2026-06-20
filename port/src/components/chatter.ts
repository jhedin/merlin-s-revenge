// Chatter (casts/script_objects/objChatter.txt): a decorative cutscene-trigger NPC ("talking stones").
// In the original, walking onto it (in nav mode) swaps to its talking member and plays its #scriptToPerform
// cutscene via cutSceneMaster, then latches pPerformed.
//
// FAITHFUL FALLBACK (plan §c.5 / §g.8): the #stonesN cutscene scripts (scr_stones1..5) are NOT bundled
// in the port (only intro/wasted/complete are — see tools/build_assets.ts). The original's own collected
// handler is gated behind a "temporarily disabled inGame Scripts" note. So rather than fabricate
// cutscenes, the stones spawn as INERT decorative sprites: they render (visible, non-blocking) and simply
// don't talk. The component holds the scriptToPerform so a future Pass that bundles the scripts can wire
// the overlap trigger here without re-plumbing the spawn. type "chatter" keeps them off room-clear.

import { Component, type NextFn } from "../engine/dispatch";

export class Chatter extends Component {
  static handles = ["update", "getScriptToPerform", "getPerformed"];
  private scriptToPerform = "";
  private performed = false;

  override init(cfg: Record<string, any>): void {
    this.scriptToPerform = typeof cfg["scriptToPerform"] === "string" ? cfg["scriptToPerform"] : "";
    this.performed = false;
  }
  override reset(): void { this.performed = false; }

  getScriptToPerform(): string { return this.scriptToPerform; }
  getPerformed(): boolean { return this.performed; }

  // Inert: no overlap trigger (scripts unbundled). Kept as a no-op chain handler so the stone participates
  // in the entity loop (and renders via Anim). The disabled-script fallback is the faithful state.
  update(next: NextFn): void { next(); }
}
