import { describe, it, expect } from "vitest";
import { Input } from "@/systems/input";

function press(t: EventTarget, key: string) { t.dispatchEvent(Object.assign(new Event("keydown"), { key, preventDefault() {} })); }

describe("input control schemes", () => {
  it("wasd scheme maps d->right, w->up", () => {
    const t = new EventTarget(); const inp = new Input(t); inp.setScheme("wasd");
    press(t, "d"); expect(inp.moveVector()).toEqual({ x: 1, y: 0 });
    press(t, "w"); expect(inp.moveVector()).toEqual({ x: 1, y: -1 });
  });
  it("zqsd scheme maps q->left, z->up", () => {
    const t = new EventTarget(); const inp = new Input(t); inp.setScheme("zqsd");
    press(t, "q"); press(t, "z"); expect(inp.moveVector()).toEqual({ x: -1, y: -1 });
  });
  it("arrows scheme ignores wasd", () => {
    const t = new EventTarget(); const inp = new Input(t); inp.setScheme("arrows");
    press(t, "d"); expect(inp.moveVector()).toEqual({ x: 0, y: 0 });
    press(t, "arrowright"); expect(inp.moveVector()).toEqual({ x: 1, y: 0 });
  });
  // scr_stones6..10 interpolate `#key #spell1` / `#key #weaponSelector` in the magic tutorial. The
  // bound-key lookup must resolve to a real key, not echo the raw control name back ("SPELL1").
  it("keyForControl resolves cutscene action controls (no raw-string echo)", () => {
    const inp = new Input(new EventTarget()); inp.setScheme("wasd");
    expect(inp.keyForControl("#spell1")).toBe("1");
    expect(inp.keyForControl("#spell2")).toBe("2");
    expect(inp.keyForControl("#spell9")).toBe("9");
    expect(inp.keyForControl("#weaponSelector")).toBe("E");
    expect(inp.keyForControl("#army")).toBe("C");
    expect(inp.keyForControl("#gmg")).toBe("G");
    // none of these may leak the lowercased control name through the default branch
    for (const c of ["spell1", "weaponselector", "army", "gmg"])
      expect(inp.keyForControl("#" + c).toLowerCase()).not.toBe(c);
  });
});
