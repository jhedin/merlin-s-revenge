import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnEnemy } from "@/entities/archetypes";
import { Mana } from "@/components/mana";
import { Energy } from "@/components/combat";
import { Anim } from "@/components/anim";

// Minimal input stub exposing only what PlayerControl reads.
function fakeInput(opts: { mouseDown?: boolean; cursor?: { x: number; y: number } | null; held?: Set<string> }) {
  const held = opts.held ?? new Set<string>();
  return {
    moveVector: () => ({ x: 0, y: 0 }),
    cursor: () => opts.cursor ?? null,
    mouseDown: () => !!opts.mouseDown,
    mousePressed: () => false,
    mouseReleased: () => false,
    held: (k: string) => held.has(k),
    pressed: (_k: string) => false,
    endTick: () => {},
  };
}

describe("Merlin's charged-magic + punch kit", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); // open arena
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any; // Anim.update reads index.anims
  });

  it("holds to charge then casts a bolt at the cursor, spending mana", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } }) as any;
    const p = spawnPlayer(100, 100);
    game.entities = [p];
    const mana = p.get(Mana);
    const full = mana.current;

    for (let i = 0; i < 6; i++) p.send("update");        // hold to charge
    expect(p.send("chargeFrac")).toBeGreaterThan(0);
    expect(p.get(Anim)["action"]).toBe("charge");

    (game.input as any).mouseDown = () => false;          // release
    p.send("update");
    const bolts = game.entities.filter((e) => e.type === "bullet");
    expect(bolts.length).toBe(1);
    expect(mana.current).toBeLessThan(full);              // mana spent
    // the bolt travels toward the cursor (to the right)
    const v = bolts[0]!.send("getPos") as { x: number };
    expect(v.x).toBeGreaterThanOrEqual(100);
  });

  it("auto-punches an adjacent enemy when not casting", () => {
    game.input = fakeInput({ mouseDown: false, cursor: null }) as any;
    const p = spawnPlayer(100, 100);
    const foe = spawnEnemy("warrior", 110, 100, { animChar: "warrior" }); // within punch reach
    game.entities = [p, foe];
    const hp0 = foe.get(Energy).energy;
    p.send("update"); // melee fires on the first eligible tick
    expect(foe.get(Energy).energy).toBeLessThan(hp0);
  });

  it("cannot cast with an empty mana pool", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } }) as any;
    const p = spawnPlayer(100, 100);
    game.entities = [p];
    p.get(Mana).current = 0;
    for (let i = 0; i < 6; i++) p.send("update");
    (game.input as any).mouseDown = () => false;
    p.send("update");
    expect(game.entities.filter((e) => e.type === "bullet").length).toBe(0);
  });
});
