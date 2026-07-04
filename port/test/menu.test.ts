import { describe, it, expect } from "vitest";
import { Menu } from "@/scenes/menu";
import { Input } from "@/systems/input";

function makeInput(key: string): Input {
  const target = new EventTarget();
  const inp = new Input(target);
  // simulate key press in a Node-safe way
  target.dispatchEvent(Object.assign(new Event("keydown"), { key, preventDefault() {} }));
  return inp;
}

describe("Menu navigation and dividers", () => {
  it("initializes index to the first selectable item", () => {
    const items = [
      { label: "-", action: () => {} },
      { label: "Item 1", action: () => {}, shadowed: () => true },
      { label: "Item 2", action: () => {} },
    ];
    const m = new Menu("", items);
    expect(m.index).toBe(2); // Should skip "-" and shadowed "Item 1"
  });

  it("skips dividers and shadowed items on tick (down)", () => {
    let triggered = false;
    const items = [
      { label: "Item 1", action: () => {} },
      { label: "-", action: () => {} },
      { label: "Item 2", action: () => {} },
      { label: "Item 3", action: () => {}, shadowed: () => true },
      { label: "Item 4", action: () => { triggered = true; } },
    ];
    const m = new Menu("", items);
    expect(m.index).toBe(0);

    // Press down: should skip "-" and go to "Item 2"
    m.tick(makeInput("ArrowDown"));
    expect(m.index).toBe(2);

    // Press down again: should skip shadowed "Item 3" and go to "Item 4"
    m.tick(makeInput("ArrowDown"));
    expect(m.index).toBe(4);

    // Press Space: should run the action
    m.tick(makeInput(" "));
    expect(triggered).toBe(true);
  });

  it("skips dividers and shadowed items on tick (up)", () => {
    const items = [
      { label: "Item 1", action: () => {} },
      { label: "-", action: () => {} },
      { label: "Item 2", action: () => {} },
    ];
    const m = new Menu("", items);
    m.index = 2; // starts at Item 2

    // Press up: should skip "-" and wrap/go to "Item 1"
    m.tick(makeInput("ArrowUp"));
    expect(m.index).toBe(0);
  });
});
