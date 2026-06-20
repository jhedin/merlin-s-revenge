// WastedMode (modWastedMode): the death/wasted presentation the wasted cutscene drives. wastedModeOn()
// sets a blend (alpha 30%) + squash (height 60%) latch the renderer reads; the real Merlin actor is put
// into this mode by the gGameOverScript cutscene's `m goWastedMode` verb (modThespian.performLine:443).
// It is purely presentational (no combat effect) — a flag + render hint.

import { Component } from "../engine/dispatch";

export class WastedMode extends Component {
  static handles = ["goWastedMode", "isWasted", "wastedReset"];
  private wasted = false;

  override reset(): void { this.wasted = false; }
  goWastedMode(): void { this.wasted = true; }
  wastedReset(): void { this.wasted = false; }
  isWasted(): boolean { return this.wasted; }
}
