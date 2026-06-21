# monsterSummon Parity Audit

## Overview
**Spell Type:** Player summon spell  
**Tiers:** summonArcher (12) → summonWarrior (15) → summonOrc (20) → summonBoulder (25) → summonGolem (31)  
**Key Behavior:** Fresh-spawn summon spell (no reserve bank required, unlike #armySummon)

---

## Data Parity

| Aspect | Lingo (casts/) | Port (port/src/) | Status |
|--------|---|---|---|
| **Spell Name** | #monsterSummon | #monsterSummon | ✓ Match |
| **Animation Type** | #magic | #magic | ✓ Match |
| **Charge Max** | 37 | 37 | ✓ Match |
| **Charge Start** | 8 | 8 | ✓ Match |
| **Charge Speed** | 0.6 | 0.6 | ✓ Match |
| **Explode Function** | #summonUnit | #summonUnit | ✓ Match |
| **Multistage Enabled** | randomSummon: false | randomSummon: false | ✓ Match |
| **Multistage Tiers** | summonArcher/Warrior/Orc/Boulder/Golem | summonArcher/Warrior/Orc/Boulder/Golem | ✓ Match |
| **Charge Thresholds** | 12/15/20/25/31 | 12/15/20/25/31 | ✓ Match |
| **Team Category** | #monsterSummon | #monsterSummon | ✓ Match |
| **Cooldown** | 15 | 15 | ✓ Match |
| **Power** | 0.75 | 0.75 | ✓ Match |
| **Reach** | 9999 | 9999 | ✓ Match |

---

## Behavior Parity

### Charge → Tier Selection
**Lingo (modSpellMultistage.selectPayload, lines 316-341):**
```lingo
-- Iterate tiers in order; pick highest affordable tier
i = 1
repeat with spellPayload in pSpellPayloads
  if spellPayload.chargeRequired <= charge then
    pCurrentPayload = spellPayload.payload
    pCurrentPayloadNum = i
  else
    exit repeat
  end if
  i = i + 1
end repeat
```

**Port (summon.ts selectTier, lines 40-49):**
```typescript
export function selectTier(charge: number, multistage: Array<{ type: string; chargeRequired: number }>): string | null {
  let picked: string | null = null;
  for (const tier of multistage) {
    if (tier.chargeRequired <= charge) picked = tier.type;
    else break;
  }
  return picked;
}
```

**Analysis:** ✓ Identical logic — highest affordable tier wins.

---

### Fresh Spawn (No Reserve Required)
**Lingo (modSpellMultistage.summonPayload, lines 372-393):**
```lingo
on summonPayload me
  if pCurrentPayload = #none then return end if
  
  g.armyMaster.createUnitFromSummonSpell(me.big)
  
  if me.big.getTeam() = #aldevar and pSpellName <> #armySummon then
    -- monsterSummon: clear the player reservation (line 383)
    team = g.teamMaster.pteams[pResidentTeamCategory]
    g.reservationsMaster.objectReleasedFromReservationTeam(me.big, team)
  else
    g.reservationsMaster.objectReleasedFromReservation(me.big)
  end if
end on
```

**Lingo (armyMaster.createUnit, lines 80-108):**
```lingo
-- Check reserve ONLY for armySummon
if spellName = #armySummon and armyDetails = #none then
  return #none
end if

-- Spawn fresh if armyDetails = #none (all non-armySummon always fall through)
params = g.actorMaster.getParams(#newActor)
params.typ = typ
params.startLoc = startLoc
params.useOffset = false
newActor = g.actorMaster.newActor(params)  -- FRESH SPAWN
```

**Port (summon.ts summonUnit, lines 55-80):**
```typescript
const isArmySummon = attack.name === "#armySummon" || attack.name === "armySummon";

if (game.armyMaster && game.armyMaster.hasReserve(team, type)) {
  const fielded = game.armyMaster.createUnit(team, type, x, y);
  if (fielded) { owner?.send("gainXp", 0.5); return fielded; }
}

if (isArmySummon) return null;  // createUnit returns #none for armySummon w/ armyDetails=#none

if (!game.spawnUnit) return null;
const e = game.spawnUnit(type, x, y, {});
game.entities.push(e);
owner?.send("gainXp", 0.5);
return e;
```

**Analysis:** ✓ monsterSummon skips the `isArmySummon` null-return gate and falls through to fresh spawn. Reserve is optional (try-check only).

---

### Team Allegiance (#monsterSummon)
**Lingo (tem_monsterSummon.txt, lines 1-9):**
```lingo
[#name: "tem_monsterSummon", #type: #field]
[
  #teamName: #monsterSummon,
  #category: #friends,
  #colour: rgb(100,100,255),
  #friends:[#aldevar, #village],
  #hates: [[#blackSorcerer, #scarlet, #cave, #goblins, #karate, #ice, #magicalAlliance, #monsters, #ninja, #swamp, #undead, #orcs], [#pitMonsters, #invisible]],
  #maxMembers: 3
]
```

**Lingo (act_summonArcher.txt, line 16):**
```lingo
#team: #monsterSummon,
```

**Port (data.json tem_monsterSummon):**
```json
{
  "teamName": "#monsterSummon",
  "category": "#friends",
  "friends": ["#aldevar", "#village"],
  "hates": [["#blackSorcerer", "#scarlet", ...], ["#pitMonsters", "#invisible"]]
}
```

**Port (summon.ts summonUnit, line 62):**
```typescript
const team = (owner?.send("getTeam") as string) || attack.residentTeamCategory || "#aldevar";
```

**Port (data.json act_summonArcher):**
```json
{ "team": "#monsterSummon", ... }
```

**Port (systems/teams.ts isPlayerSide, lines 80-82):**
```typescript
isPlayerSide(teamName: string): boolean {
  if (teamName === "#aldevar") return true;
  return this.team("#aldevar").friends.includes(teamName);
}
```

**Analysis:** ✓ monsterSummon units always carry `team: #monsterSummon`, which is in #aldevar's friend list. Spawned unit is player-side (render correctly).

---

### Experience Gain
**Lingo (modSpellMultistage.summonPayload, lines 389-392):**
```lingo
owner = me.big.getOwner()
if owner <> #none then
  owner.gainExperience(pExperienceGain)  -- 0.5 (line 41)
end if
```

**Port (summon.ts summonUnit, line 70 and 78):**
```typescript
owner?.send("gainXp", 0.5);  // Both paths (reserve and fresh)
```

**Analysis:** ✓ Both award +0.5 XP to the caster on summon.

---

## Known Out-of-Scope
- **Permission/Icon UI:** obtainPermissionOrHalt / displayIcon / chargeReinIn (render only in port)
- **Teleport Animation:** Collapsed to instant re-field (render only)
- **Audio:** Volume/cue details
- **Attack Cooldown Rate:** Cooldown management deferred to charge.ts
- **DieSound:** Set to #none in original; not flagged

---

## Conclusion
**CLEAN** — monsterSummon exhibits full behavioral parity. Charge-to-tier selection, fresh-spawn guarantee (no reserve required), team routing to #monsterSummon, and experience award are all faithful to the original.
