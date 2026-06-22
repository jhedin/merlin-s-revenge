import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { Mana } from "@/components/mana";
import { Movement } from "@/components/movement";
import { Energy } from "@/components/combat";
import { Anim } from "@/components/anim";
import { PlayerControl } from "@/components/control";
import { resolveAttack } from "@/components/weapon";
import { registry } from "@/game/data";
import { rebuildCombatSubstrate } from "@/systems/combatTick";

// grant Merlin the energyBlast magic weapon (modWeaponManager.addWeapon), as the room-6 scroll does.
const energyBlast = () => resolveAttack((registry.resolveActor("energyBlast") ?? {})["attack"] as any);
const grantSpell = (p: import("@/engine/dispatch").Entity) => p.get(PlayerControl).grantSpell(energyBlast());

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
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  it("holds to charge then releases a spell that flies at the cursor", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } }) as any;
    const p = spawnPlayer(100, 100);
    grantSpell(p);                    // acquired the energyBlast scroll
    game.entities = [p];

    for (let i = 0; i < 6; i++) p.send("update");        // hold to charge
    expect(p.send("chargeFrac")).toBeGreaterThan(0);
    expect(p.get(Anim)["action"]).toBe("charge");
    // K2: the charged spell is a LIVE objSpell actor over Merlin's head (not a number) while charging.
    expect(game.entities.filter((e) => e.type === "spell").length).toBe(1);

    (game.input as any).mouseDown = () => false;          // release -> the spell flies to the cursor
    p.send("update");
    const spells = game.entities.filter((e) => e.type === "spell");
    expect(spells.length).toBe(1);
    const x0 = (spells[0]!.send("getPos") as { x: number }).x;
    for (let i = 0; i < 5; i++) spells[0]!.send("update"); // it flies toward the cursor (to the right)
    const x1 = (spells[0]!.send("getPos") as { x: number }).x;
    expect(x1).toBeGreaterThan(x0);
  });

  it("dying mid-charge discards the held spell (no frozen-orb leak)", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } }) as any;
    const p = spawnPlayer(100, 100); grantSpell(p); game.entities = [p];
    for (let i = 0; i < 4; i++) p.send("update");        // charge -> a live spell actor exists
    const spell = game.entities.find((e) => e.type === "spell")!;
    expect(spell).toBeDefined();
    p.get(Energy).dead = true;                           // die while still holding the charge
    p.send("update");                                    // death branch must drop the orb
    expect(spell.send("isFinished")).toBe(true);         // discarded -> sweepSpells reaps it (no leak)
    expect(p.send("chargeFrac")).toBe(0);                // charge latch cleared
  });

  it("a released spell explodes on arrival, damaging an enemy in the blast", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 40, y: 94 } }) as any; // aim left
    const p = spawnPlayer(100, 100);
    grantSpell(p);
    const foe = spawnEnemy("swordOrc", 60, 94, { animChar: "swordOrc" }); // hostile (#orcs), in the blast radius
    game.entities = [p, foe];
    const hp0 = foe.get(Energy).energy;
    for (let i = 0; i < 6; i++) p.send("update");      // charge
    (game.input as any).mouseDown = () => false;
    p.send("update");                                  // release -> spell flies left
    const spell = game.entities.find((e) => e.type === "spell")!;
    rebuildCombatSubstrate();                          // populate the unit map for the radial area hit
    for (let i = 0; i < 14; i++) spell.send("update"); // fly to the aim + explode radially over the foe
    expect(foe.get(Energy).energy).toBeLessThan(hp0);
  });

  it("punches an adjacent enemy while the fire button is HELD (no magic weapon -> melee)", () => {
    game.input = fakeInput({ mouseDown: true, cursor: null }) as any; // hold fire (click-to-attack)
    const p = spawnPlayer(100, 100);
    const foe = spawnEnemy("swordOrc", 110, 100, { animChar: "swordOrc" }); // hostile, within punch reach
    game.entities = [p, foe];
    const hp0 = foe.get(Energy).energy;
    rebuildCombatSubstrate(); // roster + unit map (auto-aim + area melee both read teamMaster now)
    p.send("update"); // melee fires on the first eligible tick while fire is held
    expect(foe.get(Energy).energy).toBeLessThan(hp0);
  });

  it("ONE swing = ONE hit — holding fire through the swing window doesn't re-hit every frame", () => {
    // merlinSword #cooldown:0 recovers within a tick; the re-hit gate is the swing animation (meleeT), so a
    // foe must take exactly one hit per swing, not N (the 'orcs die in one hit' multi-hit bug).
    game.input = fakeInput({ mouseDown: true, cursor: null }) as any; // hold fire the whole time
    const p = spawnPlayer(100, 100);
    const foe = spawnEnemy("blackOrc", 110, 100, { animChar: "blackOrc" }); // big HP so it survives one hit
    foe.get(Movement).inertia = 0;
    game.entities = [p, foe];
    rebuildCombatSubstrate();
    p.send("update");
    const afterOne = foe.get(Energy).energy;          // damage from the single swing
    const dmg1 = (foe.get(Energy).max) - afterOne;
    for (let i = 0; i < 5; i++) p.send("update");     // still mid-swing window (sword swing is 12 ticks)
    expect(foe.get(Energy).energy).toBe(afterOne);    // NO further damage — the swing can't re-hit
    expect(dmg1).toBeGreaterThan(0);
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
    grantSpell(p);
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
      const p = spawnPlayer(100, 100); grantSpell(p);
      p.get(Mana).capacity = capacity;
      const foe = spawnEnemy("blackOrc", 60, 94, { animChar: "blackOrc" }); // 1200 energy, survives one blast
      game.entities = [p, foe];
      const hp0 = foe.get(Energy).energy;
      for (let i = 0; i < 30; i++) p.send("update");   // hold to full
      (game.input as any).mouseDown = () => false;
      p.send("update");                                 // release -> spell flies
      const spell = game.entities.find((e) => e.type === "spell")!;
      rebuildCombatSubstrate();                         // unit map for the radial hit
      for (let i = 0; i < 16; i++) spell.send("update"); // K2: a BIGGER charge -> bigger radius + magnitude
      return hp0 - foe.get(Energy).energy;
    };
    expect(fullBlastDamage(30)).toBeGreaterThan(fullBlastDamage(10)); // capacity 30 -> bigger blast
  });

  it("the player KEEPS control on a hit — never dazed (objPlayerMerlinCharacter.takeHit overrides modReel)", () => {
    // Unlike a CPU unit (which goes #dazed for the reel window), Merlin's takeHit immediately goMode(#walk),
    // so a hit never locks input — the held key is honoured the same frame (he just also slides from knockback).
    const inp = fakeInput({}) as any;
    inp.moveVector = () => ({ x: 1, y: 0 });  // hold "move right" the whole time
    game.input = inp;
    const p = spawnPlayer(100, 100);
    game.entities = [p];
    const m = p.get(Movement);

    p.send("update");
    expect(m.intentX).toBe(1);               // input honoured

    p.send("takeHit", 5, 0, -1, 1);          // a hit -> white flash (isHurt) + knockback, but NO daze
    p.send("update");
    expect(m.intentX).toBe(1);               // still controllable mid-flash — the held "move right" is honoured
  });

  it("toggling GMG mid-charge releases the held spell (objAiPlayer internalEvent #gmgTurnedOn/Off)", () => {
    const inp = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } }) as any;
    let gPressed = false;
    inp.pressed = (k: string) => (k === "g" ? gPressed : false);
    game.input = inp;
    const p = spawnPlayer(100, 100); grantSpell(p);
    const pc = p.get(PlayerControl);
    pc.gmgCollected(); pc.setGmg();            // GMG collected, then toggled back OFF
    game.entities = [p];

    for (let i = 0; i < 5; i++) p.send("update");   // hold to charge a live spell orb
    expect(p.send("chargeFrac")).toBeGreaterThan(0);
    const spell = game.entities.find((e) => e.type === "spell")!;
    expect(spell).toBeDefined();

    gPressed = true; p.send("update"); gPressed = false; // tap G -> #gmgTurnedOn -> release the held charge
    expect(p.send("chargeFrac")).toBe(0);               // the charge was fired, not carried across the toggle
    const x0 = (spell.send("getPos") as { x: number }).x;
    for (let i = 0; i < 5; i++) spell.send("update");   // the released spell flies toward the cursor (right)
    expect((spell.send("getPos") as { x: number }).x).toBeGreaterThan(x0);
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
    grantSpell(p);                    // collect the scroll -> magic enabled
    expect(p.send("getHasSpell")).toBe(true);
  });
});
