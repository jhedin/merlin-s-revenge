# Behavioral Audit: act_ochre

## Classification
- **Type:** Cutscene/prop character (named wizard)
- **Class:** `#inherit #actorPlayer`, `#character #ochreWizard`, team `#collectables`
- **Presence:** NOT in any object key → never placed in a gameplay map (verified)
- **Role:** Story/intro presentation only; gameplay variants (act_ochreInGame) audited separately

## Property-by-Property Verification

| Property | Lingo (casts/data/act_ochre.txt) | Port (src/generated/data.json) | Status |
|----------|----------------------------------|--------------------------------|--------|
| `#name` | "act_ochre" | "act_ochre" | ✓ MATCH |
| `#type` | #field | "#field" | ✓ MATCH |
| `#inherit` | #actorPlayer | "#actorPlayer" | ✓ MATCH |
| `#character` | #ochreWizard | "#ochreWizard" | ✓ MATCH |
| `#initFaceDir` | -1 | -1 | ✓ MATCH |
| `#miniMapStatus` | #spe | "#spe" | ✓ MATCH |
| `name` (actor) | "ochreWizard" | "ochreWizard" | ✓ MATCH |
| `#team` | #collectables | "#collectables" | ✓ MATCH |
| `#speechColor` | rgb(215,209,49) | {r:215,g:209,b:49} | ✓ MATCH |
| `#startOffset` | point(-16,-16) | {x:-16,y:-16} | ✓ MATCH |
| `#walkSpeed` | 4 | 4 | ✓ MATCH |

**All 11 properties match exactly.**

## Gameplay-Relevant Data (Combat/Mechanics)
- ✓ No `#attack` → not a combat actor
- ✓ No `#energy`/`#strength` → no stats
- ✓ No `#weapon` → no combat equipment
- ✓ No `#scriptToPerform` → not a trigger
- ✓ No `#reincarnateAs` → not a pooled projectile
- ✓ No pickup/effect → not a collectible

**Confirmed:** No gameplay mechanics to port.

## Inheritance Chain Verification

**Lingo:** `act_ochre` → `#actorPlayer` (aka `act_actorPlayer`) → `#actor`
- `act_actorPlayer` defines: `objType: #objActorPlayer`, `AiType: #objAiAttack`, `inherit: #actor`

**Port:** `act_ochre` → `#actorPlayer` → `#actor`
- Same `act_actorPlayer` definition: `objType: "#objActorPlayer"`, `AiType: "#objAiAttack"`, `inherit: "#actor"`

**Chain verification:** ✓ IDENTICAL

## Port Instantiation
✓ Present in src/generated/data.json as `act_ochre`
✓ All 11 properties correctly serialized
✓ No missing references or null values
✓ Can be instantiated as an objActorPlayer with character #ochreWizard

## Status: CLEAN

Per covered-by-class: Cutscene/prop actors are validated through the inheritance chain and character definitions. Ochre carries no gameplay mechanics and is never placed in gameplay maps. Port has 100% behavioral parity.
