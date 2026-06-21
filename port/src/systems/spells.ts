// Spell system (K2): pooled spawn of the live objSpell actor + a per-tick sweep of finished spells back
// into the pool (mirrors the bullet system). The caster's controller spawns ONE spell on charge-start,
// grows it each tick (setCharge), and releases it (release) on let-go — the actor then flies + explodes
// on its own update().

import { Pool } from "../engine/pool";
import { SpellArchetype } from "../entities/spell";
import { SpellActor } from "../components/spellActor";
import { Movement } from "../components/movement";
import { game } from "../game/context";
import type { Entity } from "../engine/dispatch";
import type { AttackData } from "../components/weapon";

const pool = new Pool(SpellArchetype);

// spawnSpell: a fresh charge-mode spell over the caster's head (ensureSpell). The controller holds the
// reference, grows it, and releases it; it is added to game.entities so it updates + renders + explodes.
export function spawnSpell(
  attack: AttackData, ownerId: number, x: number, y: number, team: string, hits: string[], allegiance: string,
): Entity {
  const s = pool.acquire();
  s.type = "spell";
  s.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6 }); // no friction/accel => constant fly velocity
  s.get(Movement).vx = s.get(Movement).vy = 0;
  s.get(SpellActor).configure(attack, ownerId, team, hits, allegiance);
  game.entities.push(s);
  return s;
}

// sweepFinishedSpells: return exploded/finished spells to the pool (called once per tick after updates).
export function sweepSpells(): void {
  const ents = game.entities;
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i]!;
    if (e.type === "spell" && e.send("isFinished")) { ents.splice(i, 1); pool.release(e); }
  }
}
