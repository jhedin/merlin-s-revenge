import { describe, it, expect, beforeEach } from "vitest";
import { Archetype, type Entity } from "@/engine/dispatch";
import { Movement } from "@/components/movement";
import { Team, Targeting, Energy } from "@/components/combat";
import { TeamMaster, meleeHitFn } from "@/systems/teams";

const Unit = new Archetype("u", [Movement, Team, Targeting, Energy],
  { defaults: { isDead: false, isInvince: false, isFrozen: false } });

describe("TeamMaster (allegiance, roster, findTarget, impactMeleeAttack)", () => {
  let tm: TeamMaster; let nextId = 1;
  const spawn = (team: string, x: number, y: number, opts: Record<string, any> = {}): Entity => {
    const e = Unit.create(nextId++).build({ x, y, team, energy: 100, ...opts });
    e.type = "enemy";
    tm.register(e, team, opts["teamRole"] ?? "#teamMembers");
    tm.unitMap.insert(e, x, y);
    return e;
  };
  beforeEach(() => { tm = new TeamMaster(); tm.unitMap.configure(32, 0, 0); nextId = 1; });

  it("resolves allegiance from real tem_ data (hates tiers / friends+self)", () => {
    const orcEnemies = tm.calcTargetTeams("#orcs", "#enemy");
    expect(orcEnemies[0]).toContain("#aldevar");        // tem_orcs.hates
    const aldevarFriends = tm.calcTargetTeams("#aldevar", "#friendly");
    expect(aldevarFriends[0]).toEqual(expect.arrayContaining(["#village", "#monsterSummon", "#aldevar"]));
  });

  it("cullTeamList drops empty teams and signals #none below 5 live hostiles", () => {
    spawn("#aldevar", 0, 0); spawn("#aldevar", 10, 0);  // 2 live -> below the 5 threshold
    expect(tm.cullTeamList(["#aldevar", "#orcs"])).toEqual(["#none", "#aldevar"]); // #orcs empty dropped
    for (let i = 0; i < 4; i++) spawn("#aldevar", 20 + i, 0); // now 6 live
    expect(tm.cullTeamList(["#aldevar"])).toEqual(["#aldevar"]); // no #none once >=5
  });

  it("findTarget picks the nearest hostile (data allegiance, not entity type)", () => {
    const orc = spawn("#orcs", 0, 0);
    spawn("#aldevar", 300, 0);                 // far ally of the player's team
    const near = spawn("#aldevar", 48, 0);     // nearer hostile (to the orc)
    const t = tm.findTarget(orc);
    expect(t.obj).toBe(near);
  });

  it("respects a single targetRole filter (e.g. buildings only)", () => {
    const orc = spawn("#orcs", 0, 0, { targetRoles: [["#teamBuildings"]] });
    spawn("#aldevar", 40, 0);                                   // a member, closer
    const hut = spawn("#aldevar", 60, 0, { teamRole: "#teamBuildings" }); // a building, farther
    expect(tm.findTarget(orc).obj).toBe(hut);                   // role filter skips the member
  });

  it("targetRoles priority TIERS: take the first tier with a target, fall through only when empty", () => {
    // dwarfTower-style [[#teamBuildings],[#teamMembers]]: hunt buildings first, members only if none.
    const tower = spawn("#orcs", 0, 0, { targetRoles: [["#teamBuildings"], ["#teamMembers"]] });
    const member = spawn("#aldevar", 40, 0);                                  // member, closer
    const hut = spawn("#aldevar", 60, 0, { teamRole: "#teamBuildings" });     // building, farther
    expect(tm.findTarget(tower).obj).toBe(hut);   // tier-0 building wins despite the closer member
    hut.send("loseEnergy", 9999);                 // building gone → fall through to tier-1 members
    expect(tm.findTarget(tower).obj).toBe(member);
  });

  it("#lowestHealth targets the weakest member and skips full health", () => {
    const healer = spawn("#orcs", 0, 0, { targetCriteria: "#lowestHealth" });
    spawn("#aldevar", 20, 0);                          // full health -> skipped (healBlast rule)
    const hurt = spawn("#aldevar", 200, 0);            // wounded, even though far
    (hurt.get(Energy) as any).energy = 30;
    expect(tm.findTarget(healer).obj).toBe(hurt);
  });

  it("impactMeleeAttack hits EVERY hostile in reach (area), reusing A1's vector takeHit", () => {
    const orc = spawn("#orcs", 100, 100, { targetReach: 30 });
    const a = spawn("#aldevar", 110, 100); // in reach
    const b = spawn("#aldevar", 100, 120); // in reach
    const c = spawn("#aldevar", 200, 100); // out of reach
    const e = [a, b, c].map((u) => (u.get(Energy) as any).energy);
    tm.impactMeleeAttack(orc, meleeHitFn(orc, orc.id, 12, 1)); // dmg 12 each
    expect((a.get(Energy) as any).energy).toBe(e[0]! - 12);
    expect((b.get(Energy) as any).energy).toBe(e[1]! - 12);
    expect((c.get(Energy) as any).energy).toBe(e[2]!);          // untouched (out of reach)
  });

  it("#leaveGame fires once to subscribers when a target unregisters", () => {
    const hunter = spawn("#orcs", 0, 0);
    const prey = spawn("#aldevar", 40, 0);
    let notified: Entity | null = null;
    // stand-in listener that records the eventLeaveGame payload
    const listener = { send: (m: string, t: Entity) => { if (m === "eventLeaveGame") notified = t; } } as any;
    tm.subscribe(prey, listener);
    tm.unregister(prey, "#aldevar", "#teamMembers");
    expect(notified).toBe(prey);
  });
});
