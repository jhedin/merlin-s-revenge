import { describe, it, expect } from "vitest";
import { Registry, STRUCT_ATTACK } from "@/data/registry";

const files = {
  act_character: { header: {}, data: { walkType: "#anyDir", energy: 100, strength: 5 } },
  act_CPUCharacter: { header: {}, data: { inherit: "#character", pathfinding: true, walkSpeed: 3 } },
  act_blackOrc: {
    header: {},
    data: { objType: "#objCPUCharacter", inherit: "#CPUCharacter", energy: 1200, strength: 30, name: "blackOrc", weapon: "#blackAxe" },
  },
  act_archerBow: {
    header: {},
    data: { objType: "#objPowerUp", inherit: "#weapon", attack: { bullet: "#archerArrow", cooldown: 10, reach: 100 } },
  },
  act_weapon: { header: {}, data: { character: "#weaponChar" } },
  tem_monsters: { header: {}, data: { teamName: "#monsters", category: "#enemies", hates: [["#aldevar"]] } },
};

describe("registry: #inherit flattening (child overrides parent)", () => {
  const reg = new Registry(files);
  it("blackOrc inherits CPUCharacter -> character, with child overrides", () => {
    const r = reg.resolveActor("blackOrc")!;
    expect(r["energy"]).toBe(1200);        // blackOrc overrides character's 100
    expect(r["strength"]).toBe(30);        // blackOrc overrides character's 5
    expect(r["walkSpeed"]).toBe(3);        // inherited from CPUCharacter
    expect(r["walkType"]).toBe("#anyDir"); // inherited from character (grandparent)
    expect(r["pathfinding"]).toBe(true);   // inherited from CPUCharacter
    expect(r["name"]).toBe("blackOrc");
  });
  it("resolves via #-prefixed symbol too", () => {
    expect(reg.resolveActor("#blackOrc")!["energy"]).toBe(1200);
  });
});

describe("registry: #attack schema merge", () => {
  const reg = new Registry(files);
  it("overlays the record attack on structAttack defaults", () => {
    const atk = reg.resolveActor("archerBow")!["attack"] as Record<string, unknown>;
    expect(atk["bullet"]).toBe("#archerArrow");      // from record
    expect(atk["cooldown"]).toBe(10);                // from record
    expect(atk["reach"]).toBe(100);                  // record overrides default 25
    expect(atk["power"]).toEqual(STRUCT_ATTACK["power"]); // default filled in
    expect(atk["payloadFunction"]).toEqual(["#takeHit"]); // default filled in
  });
});

describe("registry: partitions", () => {
  it("indexes teams separately and skips key/properties records", () => {
    const reg = new Registry(files);
    expect(reg.team("monsters")!["category"]).toBe("#enemies");
    expect(reg.names("actor").sort()).toContain("blackOrc");
  });
});
