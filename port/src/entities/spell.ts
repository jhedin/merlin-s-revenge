// Spell archetype (objSpell, K2): a pooled live spell actor — Movement (the release fly) + SpellActor
// (the grow/charge/explode lifecycle). Kept separate from character archetypes (like BulletArchetype) so
// the spell system can import it without pulling in control/AI.

import { Archetype } from "../engine/dispatch";
import { Movement } from "../components/movement";
import { SpellActor } from "../components/spellActor";

export const SpellArchetype = new Archetype("spell", [Movement, SpellActor], {
  defaults: { isDead: false, getTeam: "", getActorType: "spell", isFinished: false },
  pooled: true,
});
