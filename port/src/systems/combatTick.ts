// Per-tick combat substrate refresh, run BEFORE AIs update (objAiGameObject.update reads a current
// teamMaster). Faithful to teamMaster keeping pUnitMap + the team rosters live: every tick we
//   1. reconcile the roster (joinTeam on first sight, leaveTeam — firing #leaveGame — on death/removal),
//   2. clear + re-insert every live combatant into the unit map by world loc.
// Rebuild-per-tick is behaviour-equivalent to the original's lazy poke/peek for a synchronous query
// (see unitMap.ts header). Combatants are entities that carry a Team (player/enemy/ally/dwelling).

import { game } from "../game/context";
import type { Entity } from "../engine/dispatch";
import { Team } from "../components/combat";

const COMBATANT = new Set(["player", "enemy", "ally", "dwelling"]);
const isCombatant = (e: Entity): boolean => COMBATANT.has(e.type) && e.has(Team);

// rebuildCombatSubstrate: reconcile roster + rebuild the unit map. Call once per tick before AIs run.
export function rebuildCombatSubstrate(): void {
  const tm = game.teamMaster;
  const live = new Set<Entity>();

  // 1. rebuild the broad-phase index FIRST from current world locations (live, non-dead combatants).
  //    Ordering it before the roster reconcile means a #leaveGame fired below (death/exit) sees a
  //    current unit map when its reactive refreshTarget runs — so a hunter re-acquires immediately.
  tm.unitMap.clear();
  for (const e of game.entities) {
    if (!isCombatant(e)) continue;
    live.add(e);
    if (e.send("isDead")) continue;
    const p = e.send("getPos") as { x: number; y: number };
    tm.unitMap.insert(e, p.x, p.y);
  }

  // 2. joinTeam every newly-seen live combatant FIRST, so when a #leaveGame fires below the roster
  //    already reflects this tick's survivors (a hunter's reactive findTarget sees them).
  for (const e of live) {
    const t = e.get(Team);
    if (!t.registered && !(e.send("isDead") as boolean)) {
      tm.register(e, t.getTeam(), t.getTeamRole());
      t.registered = true;
    }
  }
  // 3. leaveTeam (firing #leaveGame) on death-finalize so hunters drop dead targets reactively.
  for (const e of live) {
    const t = e.get(Team);
    if (t.registered && (e.send("isDead") as boolean)) {
      tm.unregister(e, t.getTeam(), t.getTeamRole());
      t.registered = false;
    }
  }
  // 4. room-exit / pool reuse: a registered entity no longer in the live set has left the game.
  for (const e of [...tm.registeredEntities()]) {
    if (!live.has(e)) {
      const t = e.get(Team);
      tm.unregister(e, t.getTeam(), t.getTeamRole());
      t.registered = false;
    }
  }
}
