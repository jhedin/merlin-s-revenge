import { describe, it, expect } from "vitest";
import { UnitMap } from "@/systems/unitMap";

// stand-in entities: searchShells only needs identity; accept() does the filtering.
const E = (id: number, team = "#a") => ({ id, send: (m: string) => (m === "getTeam" ? team : false) }) as any;

describe("UnitMap broad-phase (searchUnitMap shell walk)", () => {
  it("returns the nearest occupant and stops expanding once found (no full scan)", () => {
    const map = new UnitMap(32, 0, 0);
    const near = E(1), far = E(2);
    map.insert(near, 40, 0);   // tile (1,0)
    map.insert(far, 400, 0);   // tile (12,0) — far away
    const found = map.search(0, 0, () => true, 0, 20); // searcher at tile (0,0)
    expect(found).toContain(near);
    expect(found).not.toContain(far); // early-out: never walked out to shell 12
  });

  it("filters by the accept predicate (team membership)", () => {
    const map = new UnitMap(32, 0, 0);
    const friend = E(1, "#a"), foe = E(2, "#b");
    map.insert(friend, 40, 0); map.insert(foe, 41, 0); // same tile (1,0)
    const foes = map.search(0, 0, (e) => e.send("getTeam") === "#b", 0, 20);
    expect(foes).toEqual([foe]);
  });

  it("empty map returns nothing and respects maxShell", () => {
    const map = new UnitMap(32, 0, 0);
    expect(map.search(0, 0, () => true, 0, 5)).toEqual([]);
  });

  it("clear() empties the buckets", () => {
    const map = new UnitMap(32, 0, 0);
    map.insert(E(1), 0, 0); map.clear();
    expect(map.search(0, 0, () => true, 0, 3)).toEqual([]);
  });
});
