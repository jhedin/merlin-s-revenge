# Per-Actor Parity Audit: shrouder

**Date:** 2026-06-22
**Method:** Throwaway probe (`tools/_audit_shrouder.ts`) spawned shrouder vs an inert pinned player target at varying distances (40 / 70 / 200 / 350 px), ticked 220 frames each, real `@/generated/assets.json` bundle loaded (so missing art / wrong bullets fall back visibly), `rebuildCombatSubstrate()` per tick, all entities updated. Observed: resolved anim char, weapon switch by range, the SPAWNED projectile per weapon (char + splash payload), shot count per `#animframe` play, cadence, team/targeting/energy/components. Original behavior derived from `casts/data/act_shrouder.txt`, `act_pinShooter.txt`, `act_smoke.txt` (`#smoke`+`#smokePin`), `casts/script_objects/objAiCPU.txt`, `modWeaponManager.txt`, `modAttack.txt`, `act_CPUCharacter.txt`. Cross-checked vs the sibling `ninja` multiAttack audit.

---

## Identity & Derived Correct Behavior (from the ORIGINAL)

| Property | Original value / behavior |
|---|---|
| Name / sprite char | `"shrouder"` (`act_shrouder.txt:30`) → sprite char `shrouder` |
| Team | `#magicalAlliance` |
| AiType / ObjType | `#objAiCPU` (committed-target FSM) / `#objCPUCharacter` (grave on death) |
| Energy | 150 |
| Strength | 7 |
| WalkSpeed | 3 |
| Inertia | 50 |
| Dexterity | 10 (ranged cooldown-counter inc) |
| Eyestrain | 50 (aim scatter at range) |
| DamageSpeed | 2 |
| ExperienceImWorth | 15 |
| WeaponTechnique | 20 |
| **multiAttack** | `true` — 2-weapon range-based switch (`#bufferDist` default 100) |
| **Weapon 1 (primary, ranged FAR)** | Natural `#attack`: `#throwSmoke`, `#naturalRanged`, bullet **`#smoke`**, `#animframe:[2,3,4,5,6,7]`, reach **300**, cooldown 400, firingType `#fullstrength`, collisionLoc `(0,0)`, sound `#none` |
| **Weapon 2 (secondary, ranged NEAR)** | `#pinShooter` (via `#weapon`): `#naturalRanged`, bullet **`#smokePin`**, `#animframe:[2,3,4,5,6,7]`, reach **80**, cooldown 0, firingType `#fullstrength`, collisionLoc `(0,-2)` |
| **multiAttack switch rule** | Both weapons are `#naturalRanged`. Per `modWeaponManager.setMultiAttack` (`:366`): since `pWeapons[2].type = #ranged`, the buffer = weapon-2 reach = **80**. Beyond 80 → `#throwSmoke`; within 80 → falls through the `#ranged` weapon-2 buffer to `#pinShooter` (the `melee`-target sub-branch never matters because weapon 2 is not `#melee`). |
| **`#smoke` bullet (weapon 1)** | `act_smoke`: `#type:#explode`, damageMultiplier **6**, explodeCharge 30, power 0.25, splash/AoE, explodeSound `spell_explode`, sprite `smoke_fly`/`smoke_explode` |
| **`#smokePin` bullet (weapon 2)** | `act_smokePin`: `#type:#bullet` (plain single-target), damageMultiplier **4**, power 1.5, friction `(10,10)`, weight 0.6, sprite `smokePin_fly`/`smokePin_land` |
| `#animframe` firing | `[2,3,4,5,6,7]` = SIX shots per play of the `naturalRanged` strip (one per fresh frame crossing) |
| Animations | `shrouder_stand` (4f), `shrouder_walk` (3f), `shrouder_naturalRanged` (9f — both weapons use it), `shrouder_grave` (2f). All bundled. No `_weaponRanged` (pinShooter is `#naturalRanged`, shares the strip). |
| Death / grave | `#objCPUCharacter` → `modGrave`: leaves `shrouder_grave` at death loc |
| RunReload | none (no `#runReload`) → does NOT kite |
| Reincarnation | none |

---

## Reproduced (Port Observed) vs Derived Table

| Attribute | Original (derived) | Port (observed by probe) | Match? |
|---|---|---|---|
| Sprite anim char | `shrouder` | `shrouder` (NOT blackOrc) | ✓ |
| Team | `#magicalAlliance` | `#magicalAlliance` | ✓ |
| Energy | 150 | 150 | ✓ |
| Targeting allegiance / criteria | `#enemy` / `#closestDistance` | `#enemy` / `#closestDistance` | ✓ |
| Targeting roles | `[#teamMembers,#teamBuildings]` | `[#teamMembers,#teamBuildings]` | ✓ |
| Components (Grave/WeaponTechnique/Mana/Movement) | present | all present | ✓ |
| Weapon order | `[#throwSmoke, #pinShooter]` | `[#throwSmoke, #pinShooter]` | ✓ |
| Weapon 1 type/reach/animFrame | ranged / 300 / [2..7] | ranged / 300 / [2,3,4,5,6,7] | ✓ |
| Weapon 2 type/reach/animFrame | ranged / 80 / [2..7] | ranged / 80 / [2,3,4,5,6,7] | ✓ |
| Switch FAR (dist 200, >80) | `#throwSmoke` | `#throwSmoke` only | ✓ |
| Switch NEAR (dist 40, ≤80) | `#pinShooter` | `#pinShooter` | ✓ |
| Switch MID (dist 70, ≤80) | `#pinShooter` | `#pinShooter` | ✓ |
| VERY FAR (dist 350, >300) | approach, then `#throwSmoke` | approaches; fires `#throwSmoke` from t≈32 | ✓ |
| Shots per strip play | 6 (frames 2–7) | 6 (burst of 6, gap=1 each), then recovery gap | ✓ |
| throwSmoke cadence | recovery from cd 400, dex 10 → strip-gated ~43–44f between bursts | ~43–44f | ✓ |
| pinShooter cadence | cd 0, dex 10 → strip-gated ~13–14f between bursts | ~13–14f | ✓ |
| **Weapon-1 fired bullet** | `#smoke` splash/explode (`smoke_fly`, mult 6, AoE) | `smoke` splash `#explode` | ✓ |
| **Weapon-2 fired bullet** | `#smokePin` plain bullet (`smokePin_fly`, mult 4, single-target) | **`smoke` splash `#explode`** (WRONG) | ✗ **DIV-1** |
| Grave | `shrouder_grave` (2f) | Grave component present | ✓ |
| RunReload (kite) | false | false (no kiting observed) | ✓ |

---

## DIVERGENCES

### DIV-1 (PORT BUG): weapon-2 (`#pinShooter`) fires weapon-1's `#smoke` splash bomb instead of `#smokePin`

**Derived correct:** A `#multiAttack` CPU's fired bullet is the CURRENT weapon's bullet. `modWeaponManager.setCurrentWeapon` (`casts/script_objects/modWeaponManager.txt:305–315`) calls `me.ID.bigMe.setAttack(attack)`, which sets `pAttack` to the selected weapon. The fire path then reads:

```lingo
-- casts/script_objects/modAttack.txt:787 (performRangedAttack)
params.typ = me.getAttack().bullet   -- getAttack() returns pAttack = the CURRENT weapon
```

So at range (`#throwSmoke`) shrouder throws the `#smoke` explode-bomb (mult 6, AoE); up close (`#pinShooter`) it fires `#smokePin` — a plain single-target pin (mult 4, no explosion). Two genuinely different projectiles.

**Port (bug):** the bullet identity (`splashBullet` / `bulletChar` / `bulletAttack`) is resolved ONCE from the PRIMARY attack at spawn and never re-derived on the per-weapon switch.

```ts
// port/src/components/control.ts:511–513 (CpuAI.init — set ONCE, from the primary #attack = throwSmoke)
this.splashBullet = (cfg["splashBullet"] as AttackData | undefined) ?? null;
this.bulletAttack = (cfg["bulletAttack"] as AttackData | undefined) ?? null;
this.bulletChar   = typeof cfg["bulletChar"] === "string" ? cfg["bulletChar"] : "";
```
```ts
// port/src/components/control.ts:797–802 (performAttack — fires this.splashBullet whenever it is set,
// regardless of which weapon setMultiAttack selected this tick)
} else if (this.splashBullet) {
  const sb = fireSplashBullet(this.entity.id, mz.x, mz.y, dx, dy, throwSpeed, this.splashBullet, team,
    this.splashBullet.hits, tg?.allegiance ?? "#enemy", 140, this.bulletChar);
```
`splashBullet`/`bulletChar` are seeded from `#throwSmoke`'s `#smoke` bullet (`port/src/entities/archetypes.ts:303–314` resolves them off the primary `atk`). The weapon-2 (`#smokePin`) bullet is built into `secondAttack` for the cooldown/reach switch (`archetypes.ts:277–289`) but its BULLET is never wired into the fire path. `getCurrentAttack()` is re-read each `performAttack` for muzzle/reach/firingType/cooldown (`control.ts:782`), but the bullet payload is not.

**Observable effect (reproduced):** probe NEAR (dist 40) and MID (dist 70), current weapon `#pinShooter`, the spawned projectile is `{char:"smoke", hasSplash:true, splashType:"#explode"}` — i.e. the AoE smoke bomb. Expected `{char:"smokePin", hasSplash:false}` single-target pin. Both `smokePin_fly`/`smokePin_land` ARE bundled, so the correct sprite/strip exists and is being skipped. Net gameplay effect: shrouder's close-range attack does the wrong damage model (AoE explode mult 6 instead of a plain mult-4 pin) and shows the wrong projectile/impact art.

**Scope:** this is the FIRST multiAttack actor whose TWO weapons fire DIFFERENT bullet kinds (splash vs plain). ninja escapes it (weapon 2 is melee, no bullet; weapon 1 is the only ranged bullet). Any future multiAttack CPU with two distinct ranged bullets would hit the same code path.

**Fix sketch (not applied):** in `CpuAI`, after `setMultiAttack`+`syncWeaponMode`, re-derive the bullet trio (`splashBullet`/`bulletChar`/`bulletAttack`/`bulletReincarnate`) from the now-current weapon's `#attack.bullet` — i.e. carry a per-weapon resolved-bullet map (built alongside `secondAttack` in `archetypes.ts`) and select it in `syncWeaponMode`, rather than freezing the primary's bullet at init.

---

## Non-Divergences (Verified Correct)

- Anim char resolves to the real bundled `shrouder` strip — NO blackOrc fallback. (`shrouder_stand/walk/naturalRanged/grave` all present, frame counts 4/3/9/2.)
- Weapon range-switch is faithful: beyond reach-80 buffer → `#throwSmoke` (reach 300); within 80 → `#pinShooter`. Buffer correctly taken from weapon-2's reach (both weapons `#ranged`, so `modWeaponManager.txt:366` branch). Confirmed at 40/70/200/350 px.
- `setMultiAttack` is now passed the committed TARGET (not self) — `control.ts:667` — so the prior ninja DIV-1 (self-as-target) is already fixed and does not recur here.
- 6 shots per `naturalRanged` strip play (`#animframe:[2,3,4,5,6,7]`), one per fresh frame crossing; observed bursts of 6 with gap=1, then the per-weapon recovery gap.
- Cadence faithful to the calibrated counter: throwSmoke (cd 400, dex 10) ~43–44f between bursts; pinShooter (cd 0) ~13–14f. Strip-gated, consistent with the K6/cadence model.
- `#throwSmoke` (weapon 1) correctly fires the `#smoke` splash/explode bullet (`smoke_fly`, `#explode`) at range — this part is right; only the weapon-2 swap is wrong (DIV-1).
- Team `#magicalAlliance`; Targeting `allegiance #enemy`, `criteria #closestDistance`, roles `[#teamMembers,#teamBuildings]` (structAttack defaults); `#hits:[#teamMembers]` on the attack.
- Energy 150, strength 7, dexterity 10, eyestrain 50, inertia 50, weaponTechnique 20 — all forwarded.
- `#objCPUCharacter` → Grave component present; `shrouder_grave` (2f) will render at death loc.
- No `#runReload` → does NOT kite (stationary fire-and-stay), matching the original.
- No reincarnation.
- Probe API note: all probes used the documented harness (`game.assets/grid/teamMaster.unitMap.configure`, `rebuildCombatSubstrate` per tick); no probe-API false FAILs.
