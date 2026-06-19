// Keyboard input -> semantic move vector + action edges. Held-vs-edge polling on top of DOM
// events (the original polls keyPressed each frame). The movement scheme is selectable
// (chooseKeysScreen: arrow / wasd / zqsd) and persisted, mirroring the original's keyset prefs.

export type SchemeName = "both" | "arrows" | "wasd" | "zqsd";

interface MoveKeys { up: string[]; down: string[]; left: string[]; right: string[]; }

const SCHEMES: Record<SchemeName, MoveKeys> = {
  both: { up: ["w", "arrowup"], down: ["s", "arrowdown"], left: ["a", "arrowleft"], right: ["d", "arrowright"] },
  arrows: { up: ["arrowup"], down: ["arrowdown"], left: ["arrowleft"], right: ["arrowright"] },
  wasd: { up: ["w"], down: ["s"], left: ["a"], right: ["d"] },
  zqsd: { up: ["z"], down: ["s"], left: ["q"], right: ["d"] },
};
const PREF_KEY = "mr_scheme";

export class Input {
  private down = new Set<string>();
  private pressedThisTick = new Set<string>();
  private keys: MoveKeys;
  schemeName: SchemeName;

  constructor(target: EventTarget = window) {
    this.schemeName = (typeof localStorage !== "undefined" && localStorage.getItem(PREF_KEY) as SchemeName) || "both";
    if (!SCHEMES[this.schemeName]) this.schemeName = "both";
    this.keys = SCHEMES[this.schemeName];
    target.addEventListener("keydown", (e) => {
      const k = (e as KeyboardEvent).key.toLowerCase();
      if (!this.down.has(k)) this.pressedThisTick.add(k);
      this.down.add(k);
      if (this.isMoveKey(k) || k === " ") e.preventDefault();
    });
    target.addEventListener("keyup", (e) => this.down.delete((e as KeyboardEvent).key.toLowerCase()));
  }

  setScheme(name: SchemeName): void {
    this.schemeName = name; this.keys = SCHEMES[name];
    try { localStorage.setItem(PREF_KEY, name); } catch { /* ignore */ }
  }

  private isMoveKey(k: string): boolean {
    return this.keys.up.includes(k) || this.keys.down.includes(k) || this.keys.left.includes(k) || this.keys.right.includes(k);
  }
  private anyHeld(list: string[]): boolean { return list.some((k) => this.down.has(k)); }

  held(k: string): boolean { return this.down.has(k); }
  pressed(k: string): boolean { return this.pressedThisTick.has(k); }

  /** semantic move vector in [-1,1] (x right, y down) */
  moveVector(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.anyHeld(this.keys.left)) x -= 1;
    if (this.anyHeld(this.keys.right)) x += 1;
    if (this.anyHeld(this.keys.up)) y -= 1;
    if (this.anyHeld(this.keys.down)) y += 1;
    return { x, y };
  }

  /** call at end of each logical tick to clear edge state */
  endTick(): void { this.pressedThisTick.clear(); }
}
