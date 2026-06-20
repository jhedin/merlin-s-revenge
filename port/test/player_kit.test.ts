import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { Mana } from "@/components/mana";
import { Energy } from "@/components/combat";
import { Anim } from "@/components/anim";
import { PlayerControl } from "@/components/control";

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

  it("holds to charge then casts a bolt at the cursor", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } }) as any;
    const p = spawnPlayer(100, 100);
    p.get(PlayerControl).grantSpell();                    // acquired the energyBlast scroll
    game.entities = [p];

    for (let i = 0; i < 6; i++) p.send("update");        // hold to charge
    expect(p.send("chargeFrac")).toBeGreaterThan(0);
    expect(p.get(Anim)["action"]).toBe("charge");

    (game.input as any).mouseDown = () => false;          // release
    p.send("update");
    const bolts = game.entities.filter((e) => e.type === "bullet");
    expect(bolts.length).toBe(1);
    // the bolt travels toward the cursor (to the right)
    const v = bolts[0]!.send("getPos") as { x: number };
    expect(v.x).toBeGreaterThanOrEqual(100);
  });

  it("a cast bolt damages an enemy it flies into", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 40, y: 94 } }) as any; // aim left
    const p = spawnPlayer(100, 100);
    p.get(PlayerControl).grantSpell();
    const foe = spawnEnemy("swordOrc", 60, 94, { animChar: "swordOrc" }); // hostile (#orcs), on the path
    game.entities = [p, foe];
    const hp0 = foe.get(Energy).energy;
    for (let i = 0; i < 6; i++) p.send("update");      // charge
    (game.input as any).mouseDown = () => false;
    p.send("update");                                  // release -> bolt spawned
    const bolt = game.entities.find((e) => e.type === "bullet")!;
    for (let i = 0; i < 12; i++) bolt.send("update");  // let it travel into the foe
    expect(foe.get(Energy).energy).toBeLessThan(hp0);
  });

  it("auto-punches an adjacent enemy when not casting", () => {
    game.input = fakeInput({ mouseDown: false, cursor: null }) as any;
    const p = spawnPlayer(100, 100);
    const foe = spawnEnemy("swordOrc", 110, 100, { animChar: "swordOrc" }); // hostile, within punch reach
    game.entities = [p, foe];
    const hp0 = foe.get(Energy).energy;
    p.send("update"); // melee fires on the first eligible tick
    expect(foe.get(Energy).energy).toBeLessThan(hp0);
  });

  it("routes objects-layer units by team: #aldevar -> ally, hostile -> enemy", () => {
    game.input = fakeInput({}) as any;
    expect(spawnUnit("warrior", 0, 0, { animChar: "warrior" }).type).toBe("ally");   // #aldevar
    expect(spawnUnit("archer", 0, 0, { animChar: "archer" }).type).toBe("ally");     // #aldevar
    expect(spawnUnit("swordOrc", 0, 0, { animChar: "swordOrc" }).type).toBe("enemy"); // #orcs
    expect(spawnUnit("blackOrc", 0, 0, { animChar: "blackOrc" }).type).toBe("enemy"); // #monsters
  });

  it("charge ramps then pins at the capacity-derived ceiling (no pool to run out)", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } }) as any;
    const p = spawnPlayer(100, 100);
    p.get(PlayerControl).grantSpell();
    game.entities = [p];
    for (let i = 0; i < 3; i++) p.send("update");
    const mid = p.send("chargeFrac") as number;
    expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(1); // still ramping
    for (let i = 0; i < 40; i++) p.send("update");
    expect(p.send("chargeFrac")).toBeCloseTo(1, 5);             // pinned at the ceiling, never errors out
  });

  it("higher mana.capacity raises the charge ceiling, so a full blast hits harder", () => {
    const fullBlastDamage = (capacity: number): number => {
      game.input = fakeInput({ mouseDown: true, cursor: { x: 40, y: 94 } }) as any; // aim left
      const p = spawnPlayer(100, 100); p.get(PlayerControl).grantSpell();
      p.get(Mana).capacity = capacity;
      const foe = spawnEnemy("blackOrc", 60, 94, { animChar: "blackOrc" }); // 1200 energy, survives one bolt
      game.entities = [p, foe];
      const hp0 = foe.get(Energy).energy;
      for (let i = 0; i < 30; i++) p.send("update");   // hold to full
      (game.input as any).mouseDown = () => false;
      p.send("update");                                 // release
      const bolt = game.entities.find((e) => e.type === "bullet")!;
      for (let i = 0; i < 14; i++) bolt.send("update"); // fly into the foe
      return hp0 - foe.get(Energy).energy;
    };
    expect(fullBlastDamage(30)).toBeGreaterThan(fullBlastDamage(10)); // capacity 30 -> bigger blast
  });

  it("starts punch-only: holding fire casts nothing until the energyBlast scroll is collected", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } }) as any;
    const p = spawnPlayer(100, 100);
    game.entities = [p];                                  // no spell granted
    for (let i = 0; i < 6; i++) p.send("update");
    expect(p.send("chargeFrac")).toBe(0);                 // no charge builds
    (game.input as any).mouseDown = () => false;
    p.send("update");
    expect(game.entities.filter((e) => e.type === "bullet").length).toBe(0); // no bolt
    expect(p.send("getHasSpell")).toBe(false);
    p.get(PlayerControl).grantSpell();                    // collect the scroll -> magic enabled
    expect(p.send("getHasSpell")).toBe(true);
  });
});
