# Audit: `act_babyOstrich`

Per-property audit of the baby ostrich actor (CPUCharacter, ranged laser-firing enemy).

## Properties Table

| Property | Verdict | Original Cite | Port Cite | Note |
|----------|---------|---------------|-----------|------|
| objType: #objCPUCharacter | USED | objCPUCharacter.txt:1, archetypes resolveActor | archetypes.ts:137 (spawnEnemy) | Type determines archetype (EnemyArchetype) |
| AiType: #objAiCPU | USED | objAiPlayer.txt (AI dispatch), archetypes determines behaviour | archetypes.ts:171 (str "AiType") | Routed to EnemyAI (standard hunt/attack FSM) |
| inherit: #CPUCharacter | USED | registry.resolveActor merges chains | registry.ts:93–110 (resolveActor) | Parent merged into child; stats inherited |
| name: "babyOstrich" | USED | objActorData.txt, identity tracking | archetypes.ts:256 (actorType: actorName) | Actor type key for respawning |
| team: #monsters | USED | modTeam uses for allegiance/targeting | archetypes.ts:260 (str "team") | Determines enemy vs ally; #monsters hunts #aldevar |
| energy: 100 | USED | modEnergy init pEnergy | archetypes.ts:258 (num "energy", 40) | Max health; babyOstrich 100 > default 40 |
| strength: 10 | USED | modCharacterAttackProperties pStrength multiplies attack power | archetypes.ts:259 (num "strength", 5) | Melee damage: power × strength × scale; babyOstrich 10 > default 5 |
| dexterity: 10 | USED | modCharacterAttackProperties pDexterity modifies ranged cooldown | archetypes.ts:174 (num "dexterity", 0.2) | Ranged cooldown inc; babyOstrich 10 >> default 0.2 |
| inertia: 30 | USED | objGameObject.takeHit damps knockback/damage (100-inertia)/100 | archetypes.ts:262 (num "inertia", 0); Movement.ts:41, 55 | Knockback resistance: 30% dampening |
| damageSpeed: 3 | GAP | modEnergy.takeDamage: `if amount > pDamageSpeed then amount -= pDamageSpeed` | absent | Physical armor: incoming damage ≥3 is reduced by 3. Port takes full damage. |
| dieSound: #none | USED | objCharacter.playSound(pDieSound) on death (line unclear, search modGrave) | archetypes.ts:289 (dieSound from d) | Sound on death; #none = silent (default) |
| takeHitSound: "dragon_hit" | GAP | modEnergy.loseEnergy:206 plays pTakeHitSound on damage | absent from port | Damage feedback sound; never played in port |
| takeHitVolume: 50 | GAP | modEnergy.loseEnergy:206 playSound(pTakeHitSound, pTakeHitVolume) | absent from port | Volume scale for damage sound (50/100); no takeHit sound at all |
| walkSpeed: 1 | USED | modMoveToLoc pWalkSpeed target speed | archetypes.ts:257 (walkSpeed: num * 0.6) | Movement max speed; babyOstrich 1 → 0.6 px/tick (v. slow) |
| experienceImWorth: 4 | USED | modExperience.attributeExperience awards imWorth + xp/2 | archetypes.ts:290 (experienceImWorth); experience.ts:15, 25, 40 | XP on kill: 4 + (victim's earned XP / 2) |
| startingLevel: 0 | USED | modExperience.levelUpToStartingLevel runs `repeat 1 to pStartingLevel: levelUp` | archetypes.ts:307–308 (for loop forceLevelUp) | Pre-levelling (goblin heros use this); 0 = no pre-level |
| eyestrain: 25 | GAP | modCharacterAttackProperties pEyestrain multiplies attack.inaccuracy on #ranged/#magic | absent from port | Ranged/spell accuracy debuff; not modelled in port |
| attack.animframe: 3 | USED | modAnim plays frame N of attack strip | archetypes.ts:163 (typeFromAnimType determines ranged; animType used) | Attack animation keyframe; not directly read in port (anim driven by component state) |
| attack.animType: #naturalRanged | USED | modAttack.calcAttackType returns pAttack.type; animType→type enum | archetypes.ts:163, 169; weapon.ts:86–94 (typeFromAnimType) | Maps to "ranged" (fires bullet) vs "melee"/"magic" |
| attack.bullet: #laser | USED | modAttack.calcAttackHitBullet fires the actor#bullet | archetypes.ts:240–241 (bulletActor resolution); weapon.ts:174 | Bullet type resolved at spawn; #laser → looks up act_laser data |
| attack.collisionLoc: point(5,-9) | USED? | modAttack.calcAttackLoc = me.getLoc() + attack.collisionLoc (melee reach anchor) | registry.ts:25 (STRUCT_ATTACK default point); archetype doesn't extract | Melee offset (not used by ranged); port may use default or ignore |
| attack.cooldown: 100 | USED | modAttack pChargeSpeedMax tied to cooldown; CpuAI fires if getCooldownFin() | archetypes.ts:180 (rawCooldown); weapon.ts:168 | Shot recovery frames; babyOstrich 100 (v. slow, ~1.6s at 60fps) |
| attack.firingType: #fullstrength | NEEDS-REVIEW | modAttack.calcAttackPowerBullet reads firingType to scale power | registry.ts (not in STRUCT_ATTACK or resolveAttack output) | Bullet power scaling (#fullstrength, #proportional, etc.); unclear if port honors |
| attack.name: #babyLaser | USED | modWeaponManager tracks as weapon identity (pWeapons[name]) | archetypes.ts:196–198 (enemyAttack = resolveAttack); weapon.ts:235 | Weapon/attack symbol; used as key |
| attack.reach: 100 | USED | modAttack.calcAttackReach; CpuAI hunts if distToTarget ≤ reach | archetypes.ts:248–251 (reach resolved to px distance); weapon.ts:161–164 | Target range for firing (100 units = ~60 px at slice scale) |
| attack.sound: "quadranid_fire" | USED | modSoundFX plays on attack release | archetypes.ts:282 (atkSound); weapon.ts:173 | Attack fire sound |
| attack.volume: 10 | USED? | modSoundFX plays at this volume | archetypes.ts:282 (sound extracted); weapon.ts:173 | Fire sound volume (10/100 = quiet) |

## GAPS

### 1. damageSpeed (3 pts)
- **Original**: modEnergy.takeDamage (line 250) — incoming damage ≥ damageSpeed is reduced by damageSpeed before being applied to energy. A unit with damageSpeed 3 takes 3 fewer HP per hit.
- **Port**: No damageSpeed mechanic. All damage flows straight through to Energy (Movement.takeHit → next → Energy.takeHit → loseEnergy).
- **Consequence**: babyOstrich (and all enemies) take unmitigated damage; effective toughness is reduced vs original (pre-fight durability changes).

### 2. takeHitSound: "dragon_hit" (not played)
- **Original**: modEnergy.loseEnergy (line 206) — `me.big.playSound(pTakeHitSound, pTakeHitVolume)` plays whenever the unit is damaged.
- **Port**: No takeHitSound handler exists; Hurt.takeHit skips sound, only plays visual flash. Dwelling plays dieSound on death (combat.ts:1062), but not takeHitSound on damage.
- **Consequence**: babyOstrich makes no sound when hit (only on death via dieSound #none). Missing combat feedback.

### 3. takeHitVolume: 50 (unused without takeHitSound)
- **Original**: modEnergy.loseEnergy (line 206) — volume scalar for the takeHitSound.
- **Port**: No takeHitVolume used; takeHitSound not played at all (see gap 2).
- **Consequence**: N/A (cascades from gap 2).

### 4. eyestrain: 25
- **Original**: modCharacterAttackProperties (line 8) — pEyestrain is a "multiplier of attack.inaccuracy on #ranged and #magic". Ranged attack inaccuracy is scaled by eyestrain.
- **Port**: No eyestrain property exists. Ranged attacks fire with fixed trajectories (no RNG scatter).
- **Consequence**: babyOstrich's laser fires with zero inaccuracy (perfectly accurate); original had 25× base inaccuracy (very twitchy aim). Makes babyOstrich much more accurate than intended.

### 5. attack.firingType: #fullstrength
- **Original**: modAttack.calcAttackPowerBullet — firingType controls how the bullet's power is scaled relative to the caster's charge/stats. #fullstrength = max power; #proportional = scales with charge.
- **Port**: firingType is not extracted or used in resolveAttack (not in STRUCT_ATTACK defaults, not in AttackData interface).
- **Consequence**: babyOstrich's laser fire always at base power; if #fullstrength has a distinct multiplier, it's lost. (Likely low-impact if bullet.attack.power is already tuned, but a faithful gap.)

## Summary

**5 gaps total:**
1. damageSpeed — physical damage reduction (toughness)
2. takeHitSound — damage feedback audio
3. takeHitVolume — volume for damage sound (cascades from 2)
4. eyestrain — ranged attack accuracy/inaccuracy scatter (accuracy overpowered)
5. firingType — bullet power scaling mode (likely minor; power may be pre-tuned)

**Most impactful:** damageSpeed (survivability), takeHitSound (feedback), eyestrain (combat feel).
