// Keyboard input -> semantic move vector + action edges. Held-vs-edge polling on top of DOM
// events (the original polls keyPressed each frame). Mac keycode translation lands here later
// (per-binding-file, PLAN_REVIEW §3); for now WASD + arrows are wired directly.

export class Input {
  private down = new Set<string>();
  private pressedThisTick = new Set<string>();

  constructor(target: EventTarget = window) {
    target.addEventListener("keydown", (e) => {
      const k = (e as KeyboardEvent).key.toLowerCase();
      if (!this.down.has(k)) this.pressedThisTick.add(k);
      this.down.add(k);
      if (MOVE_KEYS.has(k)) e.preventDefault();
    });
    target.addEventListener("keyup", (e) => this.down.delete((e as KeyboardEvent).key.toLowerCase()));
  }

  held(k: string): boolean { return this.down.has(k); }
  pressed(k: string): boolean { return this.pressedThisTick.has(k); }

  /** semantic move vector in [-1,1] (x right, y down) */
  moveVector(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.held("arrowleft") || this.held("a")) x -= 1;
    if (this.held("arrowright") || this.held("d")) x += 1;
    if (this.held("arrowup") || this.held("w")) y -= 1;
    if (this.held("arrowdown") || this.held("s")) y += 1;
    return { x, y };
  }

  /** call at end of each logical tick to clear edge state */
  endTick(): void { this.pressedThisTick.clear(); }
}

const MOVE_KEYS = new Set(["arrowleft", "arrowright", "arrowup", "arrowdown", " "]);
