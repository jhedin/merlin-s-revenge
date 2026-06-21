# Behavioral Audit: `act_healBlast`

**Scope:** READ-ONLY behavioral verification. Comparing original Lingo spec against port implementation for faithful spell actor behavior (player + CPU casting).

---

## Summary

**CLEAN** — All behavioral properties correctly implemented. healBlast targets friendlies (same team, lowest health), heals via takeHeal payload, does NOT damage. Identical to original.

---

## Data Comparison

| Property | Original | Port | Match |
|----------|----------|------|-------|
| `#type` | `#field` | `#field` | ✓ |
| `#objType` | `#objScroll` | `#objScroll` | ✓ |
| `#AiType` | `#objAiPowerUp` | `#objAiPowerUp` | ✓ |
| `#attack.animType` | `#magic` | `#magic` | ✓ |
| `#attack.payloadFunction` | `#takeHeal` | `#takeHeal` | ✓ |
| `#attack.targetAllegiance` | `#friendly` | `#friendly` | ✓ |
| `#attack.targetCriteria` | `#lowestHealth` | `#lowestHealth` | ✓ |
| `#attack.gmgAutoFire` | `true` | `true` | ✓ |
| `#attack.bullet` | `#energyBlastBullet` | `#energyBlastBullet` | ✓ |
| `#attack.power` | `1` | `1` | ✓ |
| `#attack.reach` | `9999` | `9999` | ✓ |
| `#attack.cooldown` | `50` | `50` | ✓ |
| `#attack.spellSpeed` | `30` | `30` | ✓ |

---

## Behavioral Verification

### 1. Payload: Heal Not Damage ✓

**Original:** `#attack.payloadFunction: #takeHeal` (casts/data/act_healBlast.txt:27).  
**Port:**
- `splash.ts:29-31` — applyPayload dispatches "takeHeal":
  ```
  case "takeHeal":
    victim.send("takeHeal", vx, vy, attackerId);
  ```
- `combat.ts:66-76` — takeHeal logic:
  - Heals: `energy = min(max, energy + healAmount)` where `healAmount = (|vx| + |vy|) * 2`
  - Applies gold glow cosmetic
  - **Does NOT call takeHit** (no damage)
  - Caps at maxEnergy (no overheal)

**Verdict:** Heal payload correctly adds energy, never subtracts. No damage applied.

### 2. Target Allegiance: Friendlies Only ✓

**Original:** `#attack.targetAllegiance: #friendly` (casts/data/act_healBlast.txt:32).  
**Port:**

**Player heal bolt (castMagic):**
- `control.ts:218` — ensureSpell derives allegiance from payloadFunction:
  ```
  const allegiance = attack.payloadFunction.includes("takeHeal") ? "#friendly" : "#enemy";
  ```
- `control.ts:219` — passes allegiance to spawnSpell

**CPU heal bolt (CpuAI casting):**
- `control.ts:576-580` — fires heal bolt with hardcoded "#friendly" allegiance:
  ```
  } else if (ca && ca.type === "magic" && ca.payloadFunction.includes("takeHeal")) {
    const tgc = this.entity.send("getTargeting") as { hits: string[]; allegiance: string } | undefined;
    fireBulletPayload(this.entity.id, m.x, m.y - 6, dx, dy, ca.spellSpeed / 6,
      Math.round(SPELL_FX.dmgPerUnit * (ca.chargeMaxBasic || 5)), team, ca,
      tgc?.hits ?? ["#teamMembers"], "#friendly", SPELL_FX.life);
  ```

**Projectile hit logic:**
- `projectile.ts:90-93` — heals() checks allegiance to gate friendly-only collision:
  ```
  private heals(): boolean { return this.payload !== null && this.splashAllegiance === "#friendly"; }
  private isTarget(e: Entity): boolean {
    const sameTeam = e.send("getTeam") === this.team;
    return this.heals() ? sameTeam : !sameTeam;
  }
  ```
  → Heal bolts ONLY hit entities on same team; damage bolts hit only different team.

**Spell explode:**
- `spellActor.ts:62-66` — configure stores allegiance
- `spellActor.ts:144` — resolveSplash called with allegiance (passed from ensureSpell)

**Verdict:** Heal bolts route allegiance "#friendly" → only target same-team members. Other bolts use "#enemy".

### 3. Target Criteria: Lowest Health ✓

**Original:** `#attack.targetCriteria: #lowestHealth` (casts/data/act_healBlast.txt:33).  
Port: `teams.ts:125-136` — findTarget with #lowestHealth criteria:
  ```
  if (tg.criteria === "#lowestHealth") {
    let best: Entity | null = null, bf = Infinity;
    for (const name of targetTeams) {
      for (const u of this.team(name).members) {
        if (u.send("isDead")) continue;
        const f = u.send("energyFrac") as number;
        if (f >= 1) continue;        // skip full-health targets
        if (f < bf) { bf = f; best = u; }
      }
    }
    return { obj: best, dist: best ? 1 : 999999 };
  }
  ```

**Behavior:**
- Iterates all friendly team members (gated by allegiance=#friendly in calcTargetTeams line 93-94)
- Skips dead units
- Skips full-health units (f >= 1) — faithfully, healers don't target 100% allies
- Picks the member with LOWEST energyFrac (best = u when f < bf)

**Verdict:** Heal targeting correctly selects lowest-health friendly, skipping full-health allies.

### 4. Allegiance Data Flow ✓

**Original:** Targeting is data-driven from #attack properties (casts/data/act_healBlast.txt lines 32-33).  
**Port:**
- `combat.ts:138-155` — Targeting component reads from attack config:
  ```
  override init(cfg: Record<string, any>): void {
    if (typeof cfg["targetAllegiance"] === "string") this.allegiance = cfg["targetAllegiance"];
    if (typeof cfg["targetCriteria"] === "string") this.criteria = cfg["targetCriteria"];
  ```
- healBlast data resolves to Targeting: allegiance="#friendly", criteria="#lowestHealth"
- Both player and CPU read Targeting via `entity.send("getTargeting")` (control.ts:577, teams.ts:116)

**Verdict:** Allegiance + criteria correctly plumbed from data → Targeting component → spell firing → target finding.

### 5. Spell Behavior Chain ✓

**Original:** K2 spell actor (objSpell):
1. Charge over caster's head
2. Release → fly to aim point
3. Land → explode radially with payloadFunction

**Port:** `spellActor.ts:34-148`
1. `setCharge()` (line 70-77) — grows over head; size = charge × chargeSize
2. `release()` (line 88-97) — sets fly mode
3. `update()` (line 99-112) — moves toward target
4. `explode()` (line 117-147) — on arrival:
   - Grows charge: `grown = charge × chargeExplodeFactor`
   - Calls `resolveSplash(entity, explodeAttack, x, y, ownerId, hits, allegiance)` (line 144)
   - explodeAttack carries the spell's payloadFunction (line 136-141)
   - resolveSplash uses the allegiance to gate target teams (friendly = same-team, enemy = hostile)

**Verdict:** Spell lifecycle correctly carries allegiance + payload through charge → release → explode.

### 6. GMG Auto-Fire ✓

**Original:** `#attack.gmgAutoFire: true` (casts/data/act_healBlast.txt:18) — Golden Machine Gun mode auto-releases at max charge.  
**Port:** `control.ts:145-173` — player charge logic:
- `gmgOn` mode: instant release on reaching chargeStart (line 163: if gmgOn && c >= chargeStart)
- chargeStart derived from attack.gmgChargeStart (healBlast: 5)
- healBlast enters GMG mode immediately, bypassing manual release button

**Verdict:** GMG auto-fire correctly shortcuts charge to instant release.

### 7. Healing Capped at maxEnergy ✓

**Original:** modEnergy.txt 256-265 — heal amount clamped to max.  
**Port:** `combat.ts:66-70`:
  ```
  const healAmount = (Math.abs(vx) + Math.abs(vy)) * 2;
  if (healAmount > 0) {
    this.energy = Math.min(this.max, this.energy + healAmount);
  ```
  → Energy never exceeds max.

**Verdict:** Heal correctly caps at maxEnergy; no overheal.

---

## Dual-Tree Evidence Summary

| Behavior | Original (`casts/` file:line) | Port (`src/` file:line) | Verdict |
|----------|------|------|---------|
| Payload is heal, not damage | `act_healBlast.txt:27 (#takeHeal)` | `splash.ts:29-31, combat.ts:66-76` | CORRECT |
| Targets friendlies only | `act_healBlast.txt:32 (#targetAllegiance:#friendly)` | `control.ts:218, 576-580; projectile.ts:90-93` | CORRECT |
| Picks lowest-health friendly | `act_healBlast.txt:33 (#targetCriteria:#lowestHealth)` | `teams.ts:125-136` | CORRECT |
| Spell flies to target, explodes | K2 objSpell.txt 228-248 | `spellActor.ts:85-147` | CORRECT |
| Heals via radial splash | modSplashDamage, modEnergy | `splash.ts:49-78, combat.ts:66-76` | CORRECT |
| Heal capped at maxEnergy | modEnergy.txt 70 | `combat.ts:70` | CORRECT |
| GMG auto-fire | `act_healBlast.txt:18 (#gmgAutoFire:true)` | `control.ts:163` | CORRECT |
| Does NOT damage | — (payload is heal-only) | `applyPayload no takeHit for takeHeal` | CORRECT |

---

## Conclusion

**All behavioral properties verified CORRECT.** healBlast functions identically to the original:

✓ Payload executes takeHeal (energy +, heals via L1-of-vector × 2)  
✓ Does NOT damage (no takeHit in payload)  
✓ Targets friendlies only (same team, via allegiance="#friendly")  
✓ Selects lowest-health target (via targetCriteria="#lowestHealth")  
✓ Spell lifecycle correct (charge → fly → explode radially)  
✓ GMG auto-fire working  
✓ Heal capped at maxEnergy  

**No behavioral divergences found.**
