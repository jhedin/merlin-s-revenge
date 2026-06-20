import { describe, it, expect } from "vitest";
import { Archetype } from "@/engine/dispatch";
import { Experience } from "@/components/experience";
import { Energy } from "@/components/combat";
import { game } from "@/game/context";

// modExperience: cumulative XP, rising absolute threshold (L^3+L^2+prev/(L+1)+5+init), levels at 0.
describe("experience: XP + leveling (faithful curve)", () => {
  const arch = new Archetype("char", [Experience, Energy], { defaults: { isDead: false, getLevel: 0, isInvince: false, gainXp: undefined } });

  it("levels up on the rising cumulative threshold and does not reset XP", () => {
    const e = arch.create(1).build({ energy: 100, energyIncPercentage: 0 }); // init threshold 10
    const xp = e.get(Experience);
    expect(xp.level).toBe(0);
    e.send("gainXp", 10);          // xp 10 >= 10 -> level 1; next threshold = 0+0+10/1 +5+10 = 25
    expect(xp.level).toBe(1);
    expect(xp.xp).toBe(10);        // cumulative (not reset)
    e.send("gainXp", 10);          // xp 20 < 25
    expect(xp.level).toBe(1);
    e.send("gainXp", 6);           // xp 26 >= 25 -> level 2
    expect(xp.level).toBe(2);
  });

  it("a single big gain can grant several levels", () => {
    const e = arch.create(2).build({ energy: 100 });
    e.send("gainXp", 1000);
    expect(e.get(Experience).level).toBeGreaterThan(2);
  });

  it("energy grows by energyIncPercentage of base per level (not a full heal)", () => {
    const e = arch.create(3).build({ energy: 100, energyIncPercentage: 2 });
    const en = e.get(Energy); en.energy = 50;
    e.send("gainXp", 10);          // exactly one level
    expect(en.max).toBe(102);      // +2 (2% of base 100)
    expect(en.energy).toBe(52);    // healed by the increment only
  });

  it("a kill awards imWorth + half the victim's gained XP, and records the attacker", () => {
    game.entities = [];
    const victim = arch.create(4).build({ energy: 10, experienceImWorth: 6 });
    const killer = arch.create(5).build({ energy: 100 });
    game.entities = [victim, killer];
    victim.send("takeHit", 999, 0, killer.id); // collisionVect (vx=999) -> damage 999
    expect(victim.send("isDead")).toBe(true);
    expect(victim.get(Experience).lastAttacker).toBe(killer.id);
    expect(killer.get(Experience).xp).toBe(6); // imWorth 6 + floor(0/2)
  });
});
