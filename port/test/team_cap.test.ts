import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";

// reservationsMaster.getPermissionToRelease: a team holds at most its DATA-DRIVEN team.maxMembers LIVE
// units (tem_*.txt #maxMembers); teams with no field -> structMaster default 5. teamOverride halves a cap
// >5. Dwellings/summons gate on it. (Was a blanket 12/16 hardcode that over-capped most enemy teams.)
describe("per-team concurrent cap (reservationsMaster, data-driven maxMembers)", () => {
  beforeEach(() => { game.teamMaster.reset(); });

  function fill(team: string, n: number): void {
    for (let i = 0; i < n; i++) game.teamMaster.register({ id: i } as any, team, "#teamMembers");
  }
  // assert team `t` caps exactly at `cap`: full at cap, not full at cap-1.
  function expectCap(t: string, cap: number): void {
    game.teamMaster.reset(); fill(t, cap);
    expect(game.teamMaster.atCapacity(t)).toBe(true);
    game.teamMaster.reset(); fill(t, cap - 1);
    expect(game.teamMaster.atCapacity(t)).toBe(false);
  }

  it("caps at each team's data-driven maxMembers, not a blanket 12/16", () => {
    expectCap("#aldevar", 12);          // tem_aldevar #maxMembers: 12 (player side)
    expectCap("#monsters", 10);         // tem_monsters: 10  (old hardcode wrongly said 16)
    expectCap("#orcs", 11);             // tem_orcs: 11
    expectCap("#monsterSummon", 3);     // tem_monsterSummon: 3 — the headline over-cap (was 16)
    expectCap("#cave", 5);              // no #maxMembers field -> structMaster default 5 (was 16)
  });

  it("teamOverride halves a cap > 5 (gang-up)", () => {
    fill("#monsters", 5);                                          // cap 10
    expect(game.teamMaster.atCapacity("#monsters")).toBe(false);   // 5+1 = 6 < 10
    game.teamMaster.teamOverride = "#aldevar";
    expect(game.teamMaster.atCapacity("#monsters")).toBe(true);    // cap halved to 5 -> 5+1 = 6 > 5
  });

  it("pending releases count against the cap", () => {
    fill("#aldevar", 10);
    expect(game.teamMaster.atCapacity("#aldevar", 2)).toBe(false); // 10+2 = 12, not over
    expect(game.teamMaster.atCapacity("#aldevar", 3)).toBe(true);  // 10+3 = 13 > 12
  });
});
