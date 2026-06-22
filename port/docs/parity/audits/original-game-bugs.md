# Original-game bugs (faithfully reproduced — candidates to fix later)

Bugs that exist in the **shipped original** (Lingo/data), which the port reproduces *faithfully*
for parity. These are NOT port divergences — "fixing" them in the port makes it diverge from the
real game. Listed here so we can optionally fix them later as **deliberate improvements** (behind a
flag / as a separate "fix the original's bugs" pass), distinct from parity work.

Each entry: what the original intended, the bug, what actually shipped (= what the port reproduces),
and how to fix it IF we choose to depart from the original.

---

## OGB-1 — `dammageMultiplier` typo: skeletonGiant / skeletonComando deal ~1× melee

- **Intended:** `act_skeletonGiantSword` `#dammageMultiplier: 8`, `act_skeletonComandoSword` `#dammageMultiplier: 14` — heavy-hitting melee.
- **Bug:** the key is misspelled (double-m). The engine reads the correctly-spelled `getAttack().damageMultiplier` (`modEnergy.txt:276`); nothing reads the typo'd key, so it falls back to the `structMaster` default `damageMultiplier = 1` (`structMaster.txt:171`).
- **Shipped (= port reproduces):** both weapons deal multiplier **1**, i.e. ~8× / ~14× *less* melee damage than the designer intended. Port matches exactly (reads the same correct key, same default 1 — `weapon.ts` resolveAttack / `registry.ts:26`).
- **Fix later (if departing from original):** in `resolveAttack`, read `r["damageMultiplier"] ?? r["dammageMultiplier"]`, OR normalise the typo in `parse_data.ts`. Would make skeletonGiant 8× / skeletonComando 14× stronger — a real balance change vs the shipped game.
- Source: per-actor audit `per-actor/skeletonGiant.md` (DIV-1, marked WONTFIX).

---

_Add new entries as the per-actor sweep finds more original-game quirks. Keep the verdict in the
per-actor doc as WONTFIX (faithful) and cross-reference it here._
