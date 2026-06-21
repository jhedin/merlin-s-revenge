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
  // mouse (objAiPlayer aims magic at the cursor): view-space cursor + left-button edges
  mouseX = 0; mouseY = 0; private hasMouse = false;
  private mouseHeld = false;
  private mousePressedTick = false; private mouseReleasedTick = false;

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

  /** Map cursor + left button into view space; canvas is CSS-scaled so divide by the display ratio. */
  attachMouse(canvas: HTMLCanvasElement): void {
    const toView = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
      this.hasMouse = true;
    };
    canvas.addEventListener("mousemove", toView);
    canvas.addEventListener("mousedown", (e) => { toView(e); if (e.button === 0) { if (!this.mouseHeld) this.mousePressedTick = true; this.mouseHeld = true; } e.preventDefault(); });
    canvas.addEventListener("mouseup", (e) => { if (e.button === 0) { if (this.mouseHeld) this.mouseReleasedTick = true; this.mouseHeld = false; } });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** view-space cursor, or null if the mouse has never moved over the canvas */
  cursor(): { x: number; y: number } | null { return this.hasMouse ? { x: this.mouseX, y: this.mouseY } : null; }
  mouseDown(): boolean { return this.mouseHeld; }
  mousePressed(): boolean { return this.mousePressedTick; }
  mouseReleased(): boolean { return this.mouseReleasedTick; }

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

  /** keyForControl (keyMaster.getKeyFor): the live bound key for a control name, for #key interpolation.
   *  Movement controls resolve to the active scheme's first key; fire/charge map to the primary action. */
  keyForControl(control: string): string { return this.keyForControlInScheme(control, this.schemeName); }

  /** the bound key for a control under a GIVEN scheme (no mutation) — for the key-config preview table. */
  keyForControlInScheme(control: string, scheme: SchemeName): string {
    const keys = SCHEMES[scheme] ?? this.keys;
    const c = control.replace(/^#/, "").toLowerCase();
    const first = (list: string[]) => list[0] ?? "";
    switch (c) {
      case "up": return first(keys.up);
      case "down": return first(keys.down);
      case "left": return first(keys.left);
      case "right": return first(keys.right);
      case "fire": case "attack": case "magic": case "charge": return "mouse"; // hold-to-charge on the mouse/space
      // summon controls (the stones cutscene interpolates `#key #wizard` / `#key #wizardSelector`):
      case "wizard": return "Q";          // summon the selected wizard (the documented summon key)
      case "wizardselector": return "Tab"; // cycle the wizard to summon
      default: return c;
    }
  }

  /** call at end of each logical tick to clear edge state */
  endTick(): void { this.pressedThisTick.clear(); this.mousePressedTick = false; this.mouseReleasedTick = false; }
}
