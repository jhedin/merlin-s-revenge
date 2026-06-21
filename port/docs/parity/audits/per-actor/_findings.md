# Per-actor sweep — CONFIRMED real gaps (verified, to fix)

Only behavioral/real gaps (property-coverage non-gaps are catalogued in ../data-coverage.md and excluded).

- [x] **leaveWhenFinished not acted on for non-builders** (amotonlinInGame, berlinInGame, archer, +~10).
  objCharacter `on finish: return pLeaveWhenFinished` → a summoned ally with no remaining targets teleports
  OUT. Port handles it ONLY in the builder FSM (control.ts:778); a finished summoned wizard/ally lingers
  instead of retiring. casts/script_objects/objCharacter.txt:15,181 | port/src/components/control.ts:354,778.
