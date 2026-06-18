// Bullet archetype, kept separate from character archetypes so the bullet system can import it
// without pulling in control/AI (avoids an import cycle). Chain order: Movement (fly) then
// Projectile (collide/expire).

import { Archetype } from "../engine/dispatch";
import { Movement } from "../components/movement";
import { Projectile } from "../components/projectile";

export const BulletArchetype = new Archetype("bullet", [Movement, Projectile], {
  defaults: { isDead: false, getTeam: "", isFinished: false },
  pooled: true,
});
