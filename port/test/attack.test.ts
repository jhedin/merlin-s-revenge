import { describe, it, expect } from "vitest";
import { spawnEnemy } from "@/entities/archetypes";
import { EnemyAI } from "@/components/control";

describe("data-driven attacks (real #attack via #weapon)", () => {
  it("archer resolves to a ranged attack with long reach", () => {
    const ai = spawnEnemy("archer", 0, 0).get(EnemyAI);
    expect(ai.ranged).toBe(true);
    expect(ai.reachRanged).toBe(100); // archerBow reach
  });
  it("warrior resolves to a melee attack with short reach", () => {
    const ai = spawnEnemy("warrior", 0, 0).get(EnemyAI);
    expect(ai.ranged).toBe(false);
    expect(ai.reach).toBe(25); // warriorSword reach
  });
  it("magic reach (9999) is capped", () => {
    const ai = spawnEnemy("mageOrc", 0, 0).get(EnemyAI);
    expect(ai.ranged).toBe(true);
    expect(ai.reachRanged).toBeLessThanOrEqual(220);
  });
});
