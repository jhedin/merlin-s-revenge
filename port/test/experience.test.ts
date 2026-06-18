import { describe, it, expect } from "vitest";
import { Archetype } from "@/engine/dispatch";
import { Experience } from "@/components/experience";
import { Energy } from "@/components/combat";

// Energy.takeHit references the global entity list; provide a minimal stub.
import { game } from "@/game/context";

describe("experience: XP + leveling", () => {
  const arch = new Archetype("char", [Experience, Energy], { defaults: { isDead: false, getLevel: 1, gainXp: undefined } });

  it("levels up when XP crosses the threshold and heals/grows energy", () => {
    const e = arch.create(1).build({ energy: 100 });
    const xp = e.get(Experience), en = e.get(Energy);
    expect(xp.level).toBe(1);
    expect(xp.needed()).toBe(40);
    en.energy = 50;
    e.send("gainXp", 45);                 // > 40 -> level 2
    expect(xp.level).toBe(2);
    expect(xp.xp).toBe(5);                // carryover
    expect(en.max).toBe(115);            // +15%
    expect(en.energy).toBe(115);         // healed to new max
  });

  it("takeHit records the attacker before energy applies death (ordering)", () => {
    game.entities = [];
    const victim = arch.create(2).build({ energy: 10 });
    const killer = arch.create(3).build({ energy: 100 });
    game.entities = [victim, killer];
    const kxp = killer.get(Experience);
    victim.send("takeHit", 999, killer.id); // lethal, attacker = killer
    expect(victim.send("isDead")).toBe(true);
    expect(victim.get(Experience).lastAttacker).toBe(killer.id);
    expect(kxp.xp).toBeGreaterThan(0);      // killer got XP reward
  });
});
