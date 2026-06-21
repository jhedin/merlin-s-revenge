import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";

// reservationsMaster.getPermissionToRelease: a team holds at most maxMembers LIVE units — gMaxFriends=12
// (player side) / gMaxEnemies=16 (otherwise); teamOverride halves a cap >5. Dwellings/summons gate on it.
describe("per-team concurrent cap (reservationsMaster / gMaxEnemies,gMaxFriends)", () => {
  beforeEach(() => { game.teamMaster.reset(); });

  function fill(team: string, n: number): void {
    for (let i = 0; i < n; i++) game.teamMaster.register({ id: i } as any, team, "#teamMembers");
  }

  it("a player-side team caps at 12, an enemy team at 16", () => {
    fill("#aldevar", 12);                                   // player side
    expect(game.teamMaster.atCapacity("#aldevar")).toBe(true);
    game.teamMaster.reset();
    fill("#aldevar", 11);
    expect(game.teamMaster.atCapacity("#aldevar")).toBe(false);

    game.teamMaster.reset();
    fill("#monsters", 16);                                  // enemy side
    expect(game.teamMaster.atCapacity("#monsters")).toBe(true);
    game.teamMaster.reset();
    fill("#monsters", 15);
    expect(game.teamMaster.atCapacity("#monsters")).toBe(false);
  });

  it("teamOverride halves a cap > 5 (gang-up)", () => {
    fill("#monsters", 8);
    expect(game.teamMaster.atCapacity("#monsters")).toBe(false); // 8 < 16 normally
    game.teamMaster.teamOverride = "#aldevar";
    expect(game.teamMaster.atCapacity("#monsters")).toBe(true);  // cap halved to 8 -> 8 >= 8
  });

  it("pending releases count against the cap", () => {
    fill("#aldevar", 10);
    expect(game.teamMaster.atCapacity("#aldevar", 2)).toBe(false); // 10+2 = 12, not over
    expect(game.teamMaster.atCapacity("#aldevar", 3)).toBe(true);  // 10+3 = 13 > 12
  });
});
