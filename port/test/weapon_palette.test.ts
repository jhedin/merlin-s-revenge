// modWeaponSelector: the #weaponSelector key opens a palette of owned weapons grouped magic/nonMagic;
// clicking an icon sets the current weapon (commandIssued -> setCurrentWeapon) and closes; otherwise it
// auto-closes after the idle timer (pTimer.tim[2] = 60).
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer } from "@/entities/archetypes";
import { PlayerControl } from "@/components/control";
import { WeaponManager } from "@/components/weapon";
import { resolveAttack } from "@/components/weapon";
import { registry } from "@/game/data";
import { WeaponPalette } from "@/scenes/weaponPalette";

const energyBlast = () => resolveAttack((registry.resolveActor("energyBlast") ?? {})["attack"] as any);
const armySummon = () => resolveAttack((registry.resolveActor("armySummon") ?? {})["attack"] as any);

function input(opts: { cursor?: { x: number; y: number } | null; mousePressed?: boolean }) {
  return {
    moveVector: () => ({ x: 0, y: 0 }), cursor: () => opts.cursor ?? null,
    mouseDown: () => false, mousePressed: () => !!opts.mousePressed, mouseReleased: () => false,
    held: () => false, pressed: () => false, endTick: () => {},
  } as any;
}

describe("weapon-selector palette (modWeaponSelector)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  it("opens with the player's magic weapons laid out, including the current one", () => {
    const p = spawnPlayer(200, 200);
    const pc = p.get(PlayerControl);
    pc.grantSpell(energyBlast()); pc.grantSpell(armySummon()); // two magic weapons owned
    const pal = new WeaponPalette();
    pal.open(p);
    expect(pal.displaying).toBe(true);
    const rects = pal.hitRects(p);
    const syms = rects.map((r) => r.sym);
    expect(syms).toContain("#energyBlast");
    expect(syms).toContain("#armySummon");
    expect(syms).toContain("#punch"); // the nonMagic row carries the natural punch
  });

  it("clicking an icon selects that weapon and closes the palette", () => {
    const p = spawnPlayer(200, 200);
    const pc = p.get(PlayerControl);
    pc.grantSpell(energyBlast()); pc.grantSpell(armySummon());
    const wm = p.get(WeaponManager);
    const pal = new WeaponPalette();
    pal.open(p);
    const army = pal.hitRects(p).find((r) => r.sym === "#armySummon")!;
    pal.tick(input({ cursor: { x: army.x + 4, y: army.y + 4 }, mousePressed: true }), p);
    expect(wm.current).toBe("#armySummon");   // commandIssued -> setCurrentWeapon
    expect(pal.displaying).toBe(false);       // offScreen
  });

  it("a click on empty space closes the palette without changing the weapon", () => {
    const p = spawnPlayer(200, 200);
    const pc = p.get(PlayerControl); pc.grantSpell(energyBlast());
    const wm = p.get(WeaponManager); const before = wm.current;
    const pal = new WeaponPalette(); pal.open(p);
    pal.tick(input({ cursor: { x: 5, y: 5 }, mousePressed: true }), p);
    expect(pal.displaying).toBe(false);
    expect(wm.current).toBe(before);
  });

  it("auto-closes after the 60-frame idle timeout when untouched", () => {
    const p = spawnPlayer(200, 200);
    const pc = p.get(PlayerControl); pc.grantSpell(energyBlast());
    const pal = new WeaponPalette(); pal.open(p);
    const away = input({ cursor: { x: 5, y: 5 }, mousePressed: false }); // cursor off the palette
    for (let i = 0; i < 60; i++) pal.tick(away, p);
    expect(pal.displaying).toBe(false);
  });
});
