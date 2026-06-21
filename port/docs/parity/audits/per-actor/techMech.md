# Behavioral Audit: act_techMech

**Actor:** techMech | #objCPUCharacter | Team: #magicalAlliance | AiType: #objAiCPU | weapon: #laserBeam (#beam)

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `weapon.attack.animType` | #weaponRanged | RANGED | ✓ |
| `weapon.attack.beam` | true | **FIXED** — CpuAI now fires performBeamAttack (instant stretched beam at target), was a travelling bullet | ✓ |
| `weapon.bullet` | #energyBeam (#explode) | beam explode resolved at target loc | ✓ |
| `team` | #magicalAlliance | allegiance routing | ✓ |

## Gap found + FIXED
- **CPU beam attacks not executed** — objAiCPU inherits objAiAttack.attack, which dispatches #ranged+#beam →
  performBeamAttack. The port's CpuAI.attack() had no beam branch, so techMech fired a travelling splash
  bullet instead of an instant stretched laser. Now CpuAI checks `currentAttack.beam` and calls
  performBeamAttack at the target loc. casts/script_objects/objAiAttack.txt:308-312 (inherited by objAiCPU) |
  port/src/components/control.ts (attack ranged branch).

**Status: FIXED (CPU beam — techMech).**
