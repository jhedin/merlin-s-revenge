// ArmyMaster (casts/master_objects/armyMaster.txt) — "records details of units that have been teleported
// off the screen and saved." The army is a BANK: leaving a room with a summoned ally deposits it (at its
// current level); armySummon / a new room withdraws the best one and re-fields it at that level. The whole
// bank persists in the save (G2).
//
// pReserveArmy is a 2-level store keyed [team][typ] = ArmyDetails[]. generateArmyDetails is deliberately
// LOSSY (modArmyUnit.generateArmyDetails comment: "a lot of things we don't want to record — targeting,
// health, animFrame"): we bank LEVEL only and rebuild grown stats via the existing level-up growth
// (plan §C.4 route i — forceLevelUp). No entity refs in the reserve, so this master has no locator problem.

import type { Entity } from "../engine/dispatch";
import { game } from "../game/context";
import { Team } from "../components/combat";
import { spriteCharOr } from "../components/anim";

export interface ArmyDetails { typ: string; team: string; level: number; }

export class ArmyMaster {
  // [team][typ] -> ArmyDetails[]
  private reserve = new Map<string, Map<string, ArmyDetails[]>>();

  reset(): void { this.reserve.clear(); }

  // generateArmyDetails (80-93): the lossy snapshot — record LEVEL (+ typ/team), not health/position/target.
  generateArmyDetails(e: Entity): ArmyDetails {
    return {
      typ: (e.send("getActorType") as string) || "",
      team: (e.send("getTeam") as string) || "#aldevar",
      level: (e.send("getLevel") as number) || 0,
    };
  }

  private ensureLists(team: string, typ: string): ArmyDetails[] {
    let byTyp = this.reserve.get(team);
    if (!byTyp) { byTyp = new Map(); this.reserve.set(team, byTyp); }
    let list = byTyp.get(typ);
    if (!list) { list = []; byTyp.set(typ, list); }
    return list;
  }

  // recordUnitDetails (280-307): bank a unit's details into [team][typ].
  recordUnitDetails(e: Entity): void {
    const d = this.generateArmyDetails(e);
    if (!d.typ) return;
    this.ensureLists(d.team, d.typ).push(d);
  }

  // teleportOut (modArmyUnit.armyTeleportOut -> #teleportOutFinished): the room-leave hook. A TELEPORTABLE
  // ally (type==="ally", not the player, not a ghost) is banked at its level then despawned (the port
  // collapses the teleport animation — render only). Merlin/ghosts are pTeleportable=false (not banked).
  // Returns true if the unit was banked (so the caller can remove it).
  teleportOut(e: Entity): boolean {
    if (e.type !== "ally" || !e.flags.has("teleportable")) return false; // only SUMMONED allies bank
    this.recordUnitDetails(e);
    return true;
  }

  // lookupArmyDetails (251-268): the highest-level reserve record of [team][typ] (ListGetPosOfMaxByProp).
  private lookupArmyDetails(team: string, typ: string): { list: ArmyDetails[]; idx: number } | null {
    const list = this.reserve.get(team)?.get(typ);
    if (!list || list.length === 0) return null;
    let idx = 0, best = list[0]!.level;
    for (let i = 1; i < list.length; i++) { if (list[i]!.level > best) { best = list[i]!.level; idx = i; } }
    return { list, idx };
  }

  // checkUnitAvailability (65-78): an #armySummon is only castable if a reserve record of typ exists.
  hasReserve(team: string, typ: string): boolean { return (this.reserve.get(team)?.get(typ)?.length ?? 0) > 0; }
  reserveCount(team: string, typ: string): number { return this.reserve.get(team)?.get(typ)?.length ?? 0; }

  // createUnit (80-108): withdraw the best reserve record, spawn the unit, re-field it AT its saved level
  // (re-running level-up growth), and remove the consumed record (restoreUnitToCombat). Empty reserve ->
  // null (you can't summon what you haven't banked). Returns the re-fielded ally (already in game.entities).
  createUnit(team: string, typ: string, x: number, y: number): Entity | null {
    const found = this.lookupArmyDetails(team, typ);
    if (!found || !game.spawnAlly) return null;
    const details = found.list[found.idx]!;
    const e = game.spawnAlly(typ, x, y, spriteCharOr(typ));
    // force the ally onto the banked team (it may differ from the default ally team) and re-field at level.
    const teamComp = e.tryGet(Team); if (teamComp) teamComp.team = details.team || "#aldevar";
    this.restoreArmyDetails(e, details);
    // restoreUnitToCombat (315-330): remove the consumed record from the reserve.
    found.list.splice(found.idx, 1);
    game.entities.push(e);
    return e;
  }

  // restoreArmyDetails (modArmyUnit.restoreFromArmyDetails): re-field a default-level unit AT its saved
  // level by re-running the per-level growth (forceLevelUp) `level` times (plan §C.4 route i).
  private restoreArmyDetails(e: Entity, details: ArmyDetails): void {
    for (let i = 0; i < details.level; i++) e.send("forceLevelUp");
  }

  // re-field every banked unit of a team (e.g. on entering a new room) at its saved level, at `at`.
  // Used by the room-enter re-summon path; returns the re-fielded allies.
  refieldAll(team: string, x: number, y: number): Entity[] {
    const byTyp = this.reserve.get(team);
    if (!byTyp) return [];
    const out: Entity[] = [];
    for (const typ of [...byTyp.keys()]) {
      while (this.hasReserve(team, typ)) {
        const e = this.createUnit(team, typ, x, y);
        if (!e) break;
        out.push(e);
      }
    }
    return out;
  }

  // getReserveArmy (showArmyMaster.start -> armyMaster.getReserveArmy): the displayable reserve roster for
  // a team (default the player team #aldevar) — a flat list of banked units (one entry per record) sorted
  // by type then level, for the showArmy paginated grid (K18). Each entry is the unit's display info.
  getReserveArmy(team = "#aldevar"): { typ: string; team: string; level: number }[] {
    const byTyp = this.reserve.get(team);
    if (!byTyp) return [];
    const out: { typ: string; team: string; level: number }[] = [];
    for (const [typ, list] of byTyp) for (const d of list) out.push({ typ, team, level: d.level });
    out.sort((a, b) => a.typ === b.typ ? b.level - a.level : a.typ.localeCompare(b.typ));
    return out;
  }

  // addSaveData (57-59): the whole nested structure as plain data.
  addSaveData(sd: Record<string, any> = {}): Record<string, any> {
    const out: Record<string, Record<string, ArmyDetails[]>> = {};
    for (const [team, byTyp] of this.reserve) {
      out[team] = {};
      for (const [typ, list] of byTyp) out[team]![typ] = list.map((d) => ({ ...d }));
    }
    sd["pReserveArmy"] = out;
    return sd;
  }
  // restoreFromSave (309-313): restore the whole structure.
  restoreFromSave(sd: Record<string, any> | null | undefined): void {
    this.reserve.clear();
    const data = sd && sd["pReserveArmy"];
    if (!data || typeof data !== "object") return;
    for (const team of Object.keys(data)) {
      const byTyp = data[team];
      if (!byTyp || typeof byTyp !== "object") continue;
      for (const typ of Object.keys(byTyp)) {
        const list = Array.isArray(byTyp[typ]) ? byTyp[typ] : [];
        const dest = this.ensureLists(team, typ);
        for (const d of list) dest.push({ typ, team, level: Number(d.level) || 0 });
      }
    }
  }
}
