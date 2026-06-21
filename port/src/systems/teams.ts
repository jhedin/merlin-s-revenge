// TeamMaster (casts/master_objects/teamMaster.txt): data-driven allegiance + the unit-map broad-phase +
// findTarget / impactMeleeAttack. Allegiance is resolved PER ATTACK from the attacker's
// #attack.targetAllegiance over its team's tiered #hates / #friends (tem_*.txt) — not a static friend set.

import type { Entity } from "../engine/dispatch";
import { registry } from "../game/data";
import { UnitMap } from "./unitMap";
import { aimedVect } from "../engine/math";

export interface TargetConfig {
  allegiance: string;        // "#enemy" | "#friendly"
  criteria: string;          // "#closestDistance" | "#lowestHealth"
  targetRoles: string[][];   // priority tiers of roles ("#teamMembers"/"#teamBuildings")
  hits: string[];            // roles a melee swing can strike
  reach: number;             // px (point reach collapsed to a radius)
}

interface TeamRuntime {
  name: string; friends: string[]; hates: string[][];
  members: Set<Entity>; buildings: Set<Entity>;
}

const isBuilding = (role: string) => role === "#teamBuildings";

export class TeamMaster {
  private teams = new Map<string, TeamRuntime>();
  unitMap = new UnitMap();
  // K4 (objAiCPUSpellCaster): a SECOND broad-phase over live bullets, maintained exactly like pUnitMap
  // but holding Projectile entities keyed by world loc (modListNode.pType = #bullet). Spellcasters query
  // it via findNearestEnemyBullets to dodge incoming bolts (runTangentToObjects).
  bulletMap = new UnitMap();
  teamOverride: string | null = null; // gang-up override (calcTargetTeamsOverride); off by default
  private subs = new Map<Entity, Entity[]>(); // #leaveGame: target -> listeners (keepMePosted #once)
  private rostered = new Set<Entity>();        // all currently-registered units (for the room-exit sweep)

  reset(): void { this.teams.clear(); this.subs.clear(); this.teamOverride = null; this.rostered.clear(); this.bulletMap.clear(); }

  registeredEntities(): Iterable<Entity> { return this.rostered; }

  // initTeams: lazily build a team's runtime struct from its tem_ record (tolerate missing -> neutral).
  private team(name: string): TeamRuntime {
    let t = this.teams.get(name);
    if (!t) {
      const rec = registry.team(name) as any;
      const friends: string[] = Array.isArray(rec?.friends) ? rec.friends.slice() : [];
      const hates: string[][] = Array.isArray(rec?.hates) ? rec.hates.map((tier: string[]) => tier.slice()) : [];
      t = { name, friends, hates, members: new Set(), buildings: new Set() };
      this.teams.set(name, t);
    }
    return t;
  }

  // reservationsMaster.getPermissionToRelease: a team can hold at most team.maxMembers LIVE units —
  // gMaxFriends=12 for the player side, gMaxEnemies=16 otherwise (GameSpecific.ls). teamOverride halves a
  // cap >5 (gang-up). Dwelling releases and summons gate on this so a team can't flood past its cap.
  // pending = units about to be released (default 1 — the common "may I release one more?" query). Blocked
  // when currentMembers + pending > cap, matching reservationsMaster's `current + numToRelease <= maxMembers`.
  atCapacity(teamName: string, pending = 1): boolean {
    const t = this.team(teamName);
    let cap = this.isPlayerSide(teamName) ? 12 : 16;
    if (this.teamOverride && cap > 5) cap = Math.floor(cap / 2);
    return t.members.size + pending > cap;
  }

  // joinTeam / leaveTeam: roster membership (drives cullTeamList + findTarget candidates)
  register(e: Entity, teamName: string, role: string): void {
    const t = this.team(teamName);
    (isBuilding(role) ? t.buildings : t.members).add(e);
    this.rostered.add(e);
  }
  unregister(e: Entity, teamName: string, role: string): void {
    const t = this.team(teamName);
    (isBuilding(role) ? t.buildings : t.members).delete(e);
    this.rostered.delete(e);
    this.emitLeave(e); // outOfEnergy/leaveGame fold together for B1
  }

  // keepMePosted(target, #leaveGame, #once): subscriber is told once when target leaves play
  subscribe(target: Entity, listener: Entity): void {
    const list = this.subs.get(target);
    if (list) { if (!list.includes(listener)) list.push(listener); } else this.subs.set(target, [listener]);
  }
  private emitLeave(target: Entity): void {
    const list = this.subs.get(target);
    if (!list) return;
    this.subs.delete(target);          // #once
    for (const l of list) l.send("eventLeaveGame", target);
  }

  // Is `teamName` on the player's side (#aldevar + its #friends)? Used only to tag spawned units as
  // ally vs enemy for rendering / room-clear counting — targeting itself is fully data-driven.
  isPlayerSide(teamName: string): boolean {
    if (teamName === "#aldevar") return true;
    return this.team("#aldevar").friends.includes(teamName);
  }

  // calcTargetTeamsByAllegiance (+Override): the tiered list of teams this attacker may target.
  calcTargetTeams(teamName: string, allegiance: string): string[][] {
    const t = this.team(teamName);
    const ov = this.teamOverride;
    if (ov && teamName !== ov && allegiance === "#enemy" && !t.friends.includes(ov)) {
      const o = this.team(ov);
      return [[...o.friends, ov]];                    // gang up on the override team
    }
    if (allegiance === "#friendly") {
      return t.friends.length ? [[...t.friends, teamName]] : [[teamName]];
    }
    return t.hates.map((tier) => tier.slice());        // #enemy
  }

  // cullTeamList: keep only non-empty target teams; if none, or fewer than 5 live hostiles total,
  // prepend #none (signal "give up / fall back"). #collectables is stripped by callers.
  cullTeamList(teamList: string[]): string[] {
    let running = 0; const teams: string[] = [];
    for (const name of teamList) {
      const t = this.team(name);
      const sum = t.buildings.size + t.members.size;
      if (sum > 0) { running += sum; teams.push(name); }
    }
    if (teams.length === 0 || running < 5) teams.unshift("#none");
    return teams;
  }

  private roleOf(e: Entity): string { return (e.send("getTeamRole") as string) || "#teamMembers"; }

  // findTarget: the single best target by the attacker's criteria/roles (objAiCPU.refreshTarget input).
  findTarget(e: Entity): { obj: Entity | null; dist: number } {
    const tg = e.send("getTargeting") as TargetConfig | undefined;
    if (!tg) return { obj: null, dist: 999999 };
    const myTeam = e.send("getTeam") as string;
    const tier0 = this.cullTeamList((this.calcTargetTeams(myTeam, tg.allegiance)[0] ?? []));
    const targetTeams = tier0.filter((n) => n !== "#none" && n !== "#collectables");
    if (targetTeams.length === 0) return { obj: null, dist: 999999 };
    const teamSet = new Set(targetTeams);
    const pos = e.send("getPos") as { x: number; y: number };

    // #lowestHealth (healers): pick the weakest rostered member; skip full-health (healBlast). No map.
    if (tg.criteria === "#lowestHealth") {
      let best: Entity | null = null, bf = Infinity;
      for (const name of targetTeams) {
        for (const u of this.team(name).members) {
          if (u.send("isDead")) continue;
          const f = u.send("energyFrac") as number;
          if (f >= 1) continue;        // refreshTarget rejects 100%-health heal targets
          if (f < bf) { bf = f; best = u; }
        }
      }
      return { obj: best, dist: best ? 1 : 999999 };
    }

    // #closestDistance: expanding-shell unit-map search, optional single-role filter, min squared dist.
    const roles = tg.targetRoles[0] ?? [];
    const onlyRole = roles.length === 1 ? roles[0]! : null;
    const cands = this.unitMap.search(pos.x, pos.y, (u) =>
      teamSet.has(u.send("getTeam") as string) && !u.send("isDead") &&
      (onlyRole === null || this.roleOf(u) === onlyRole), 0, 20);
    let best: Entity | null = null, bd = Infinity;
    for (const u of cands) {
      const p = u.send("getPos") as { x: number; y: number };
      const dd = (p.x - pos.x) ** 2 + (p.y - pos.y) ** 2;
      if (dd < bd) { bd = dd; best = u; }
    }
    return { obj: best, dist: best ? bd : 999999 };
  }

  // restoreTarget (teamMaster.txt 1297-1306): re-acquire a committed reference POSITIONALLY on load.
  // findTargetInTeam(team, loc, #closestDistance, [[role]]) — the nearest LIVE unit of the saved team+role
  // to the saved location wins. Exact identity isn't preserved (it can't be — ids regenerate); behavioral
  // parity is (the hunter re-commits to "the unit that was roughly there"). Called by the deferred phase-2
  // relationship pass AFTER every actor in the restored batch already exists. Returns the re-committed
  // target (and subscribes the hunter to its #leaveGame, like refreshTarget) or null.
  restoreTarget(hunter: Entity, rel: { team: string; role: string; x: number; y: number }): Entity | null {
    const t = this.team(rel.team);
    const pool = rel.role === "#teamBuildings" ? t.buildings : t.members;
    let best: Entity | null = null, bd = Infinity;
    for (const u of pool) {
      if (u.send("isDead")) continue;
      const p = u.send("getPos") as { x: number; y: number };
      const dd = (p.x - rel.x) ** 2 + (p.y - rel.y) ** 2;
      if (dd < bd) { bd = dd; best = u; }
    }
    if (best && (hunter as any).get) {
      // re-file as the hunter's committed #target via the same path refreshTarget uses.
      this.subscribe(best, hunter);
      hunter.send("setAiTarget", best); // CpuAI commits it (no-op for non-AI entities)
    }
    return best;
  }

  // findHostileWithin (teamMaster.findTargetWithin, objMine.updateCheckCollisions): the nearest hostile
  // to (cx,cy) within `radius`, scoped to `attacker`'s hostile teams by `allegiance` (default #enemy) and
  // role-filtered by `hits` (a mine's #attack.hits). Reuses calcTargetTeams + the unit-map broad-phase
  // (mirrors findTarget's #closestDistance path). Returns {obj,dist} (dist = euclidean px, 1e9 if none).
  // Team-gates implicitly: a #fire mine's hostile set comes from tem_fire.#hates, which excludes #fire.
  findHostileWithin(
    attacker: Entity, cx: number, cy: number, radius: number, hits: string[], allegiance = "#enemy",
  ): { obj: Entity | null; dist: number } {
    const myTeam = attacker.send("getTeam") as string;
    const targetTeams = (this.calcTargetTeams(myTeam, allegiance)[0] ?? [])
      .filter((n) => n !== "#none" && n !== "#collectables");
    if (targetTeams.length === 0) return { obj: null, dist: 1e9 };
    const teamSet = new Set(targetTeams);
    const maxShell = Math.max(1, Math.ceil(radius / this.unitMap.tileSize) + 1);
    const cands = this.unitMap.search(cx, cy, (u) =>
      teamSet.has(u.send("getTeam") as string) && !u.send("isDead") && hits.includes(this.roleOf(u)),
      maxShell, maxShell);
    const r2 = radius * radius;
    let best: Entity | null = null, bd = Infinity;
    for (const u of cands) {
      const p = u.send("getPos") as { x: number; y: number };
      const dd = (p.x - cx) ** 2 + (p.y - cy) ** 2;
      if (dd <= r2 && dd < bd) { bd = dd; best = u; }
    }
    return best ? { obj: best, dist: Math.sqrt(bd) } : { obj: null, dist: 1e9 };
  }

  // findNearestEnemyBullets (teamMaster.findNearestEnemyBullets → findNearest(obj,#enemy,#teamBullets,2)):
  // the nearest `n` (default 2) live bullets in `bulletMap` whose OWNER team is hostile to `seeker` (a
  // bullet's "team" is its owner's team — getTeam on Projectile). Expanding-shell search (min 0, max 3,
  // faithful). Returns {closestPos, closestList:[{obj,dist}]} mirroring the Lingo's two-nearest payload;
  // closestList[closestPos] is the nearest, the other slot the second-nearest (or {obj:null} if only one).
  findNearestEnemyBullets(
    seeker: Entity, sx: number, sy: number, n = 2,
  ): { closestPos: number; closestList: Array<{ obj: Entity | null; dist: number }> } {
    const myTeam = seeker.send("getTeam") as string;
    const targetTeams = (this.calcTargetTeams(myTeam, "#enemy")[0] ?? [])
      .filter((t) => t !== "#none" && t !== "#collectables");
    const teamSet = new Set(targetTeams);
    const empty = { closestPos: 1, closestList: [{ obj: null, dist: 1e9 }, { obj: null, dist: 1e9 }] };
    if (teamSet.size === 0) return empty;
    const cands = this.bulletMap.search(sx, sy, (b) =>
      teamSet.has(b.send("getTeam") as string), 0, 3);
    // pick the nearest `n` by squared distance.
    const scored = cands.map((b) => {
      const p = b.send("getPos") as { x: number; y: number };
      return { obj: b, dist: Math.hypot(p.x - sx, p.y - sy) };
    }).sort((a, b) => a.dist - b.dist);
    if (scored.length === 0) return empty;
    const list: Array<{ obj: Entity | null; dist: number }> = [
      scored[0]!, scored[1] ?? { obj: null, dist: 1e9 },
    ];
    void n;
    return { closestPos: 1, closestList: list };
  }

  // findUnitOfType (teamMaster.findUnitOfType, objAiCPUGhost): the FIRST rostered member/building of team
  // `teamName` whose getActorType()==`typ` (no distance sort — first match wins). The ghost's #monk hunt.
  findUnitOfType(typ: string, teamName: string): Entity | null {
    const bare = typ.replace(/^#/, "");
    const t = this.team(teamName);
    for (const u of t.members) {
      if (u.send("isDead")) continue;
      if (((u.send("getActorType") as string) || "") === bare) return u;
    }
    for (const u of t.buildings) {
      if (u.send("isDead")) continue;
      if (((u.send("getActorType") as string) || "") === bare) return u;
    }
    return null;
  }

  // impactAreaAttack (teamMaster.impactMeleeAttack/impactAttack core): the team-scoped disc search.
  // Resolves the hostile teams for `attacker` (by its #attack.targetAllegiance), searches the unit map
  // around (cx,cy) out to `radius`, role-filters by `hits`, and invokes hitFn(victim) for every hostile
  // strictly inside the disc — which builds the collision vector and runs the payload. Both melee
  // (radius=reach, center=attacker) and splash (radius=explodeCharge/2 or power, center=bullet loc)
  // share this loop; only the radius + per-victim vector differ. (cite teamMaster.txt 1041-1123.)
  impactAreaAttack(
    attacker: Entity, cx: number, cy: number, radius: number, hits: string[],
    allegiance: string, hitFn: (victim: Entity) => void,
  ): void {
    const myTeam = attacker.send("getTeam") as string;
    const targetTeams = (this.calcTargetTeams(myTeam, allegiance)[0] ?? []).filter((n) => n !== "#collectables");
    if (targetTeams.length === 0) return;
    const teamSet = new Set(targetTeams);
    const radius2 = radius * radius;
    const maxShell = Math.max(1, Math.ceil(radius / this.unitMap.tileSize) + 1);
    const cands = this.unitMap.search(cx, cy, (u) =>
      teamSet.has(u.send("getTeam") as string) && !u.send("isDead") && hits.includes(this.roleOf(u)),
      maxShell, maxShell); // sweep the whole radius (not nearest-only) for an area hit
    for (const u of cands) {
      const p = u.send("getPos") as { x: number; y: number };
      if ((p.x - cx) ** 2 + (p.y - cy) ** 2 <= radius2) hitFn(u);
    }
  }

  // impactMeleeAttack: the melee special case of impactAreaAttack (radius=reach, centered on attacker).
  // teamMaster decides WHO; A1 (the hitFn) decides what the hit does.
  impactMeleeAttack(attacker: Entity, hitFn: (victim: Entity) => void): void {
    const tg = attacker.send("getTargeting") as TargetConfig | undefined;
    if (!tg) return;
    const pos = attacker.send("getPos") as { x: number; y: number };
    this.impactAreaAttack(attacker, pos.x, pos.y, tg.reach, tg.hits, tg.allegiance, hitFn);
  }
}

// Helper for callers building a melee hitFn (keeps A1's aimedVect import out of control.ts churn).
export function meleeHitFn(attacker: Entity, attackerId: number, dmg: number, mult = 1): (v: Entity) => void {
  const ap = attacker.send("getPos") as { x: number; y: number };
  return (v: Entity) => {
    const p = v.send("getPos") as { x: number; y: number };
    const vec = aimedVect(p.x - ap.x, p.y - ap.y, dmg);
    v.send("takeHit", vec.x, vec.y, attackerId, mult);
  };
}
