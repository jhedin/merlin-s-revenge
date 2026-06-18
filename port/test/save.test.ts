import { describe, it, expect } from "vitest";
import { PlayerArchetype } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Energy } from "@/components/combat";
import { Experience } from "@/components/experience";

describe("save/restore: addSaveData fold + restoreFromSave", () => {
  it("round-trips player state through namespaced sub-dicts", () => {
    const p = PlayerArchetype.create(1).build({ energy: 100, x: 10, y: 20 });
    p.get(Movement).x = 50; p.get(Movement).y = 64;
    p.get(Energy).energy = 30; p.get(Energy).max = 120;
    p.get(Experience).level = 3; p.get(Experience).xp = 15;

    const sd: Record<string, any> = {};
    p.send("addSaveData", sd);
    expect(sd["move"]).toMatchObject({ x: 50, y: 64 });
    expect(sd["energy"]).toMatchObject({ energy: 30, max: 120 });
    expect(sd["xp"]).toMatchObject({ level: 3, xp: 15 });

    // a fresh player restores to the saved state
    const p2 = PlayerArchetype.create(2).build({ energy: 100, x: 0, y: 0 });
    p2.send("restoreFromSave", sd);
    expect(p2.get(Movement).x).toBe(50);
    expect(p2.get(Movement).y).toBe(64);
    expect(p2.get(Energy).energy).toBe(30);
    expect(p2.get(Energy).max).toBe(120);
    expect(p2.get(Experience).level).toBe(3);
    expect(p2.get(Experience).xp).toBe(15);
  });
});
