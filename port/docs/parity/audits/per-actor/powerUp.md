# Behavioral Audit: act_powerUp

**Actor:** powerUp | #objPotion / #objAiPowerUp | Team: #collectables

A collectible base. Collect-on-touch + effect application verified faithful.

## Agent findings — both VERIFIED NON-ISSUES (false positives)
- **"collectSound hard-coded"** — the port plays a fixed "collect_powerup_01" instead of the data
  #collectSound ("collect_powerup_02"). This is purely AUDIO (catalogued audio/volume non-issue) — zero
  gameplay impact. NOT a behavioral gap.
- **"timeAlive auto-expire not implemented"** — objPowerUp DOES support timeAlive (counter expiry), but ONLY
  when `timeAlive > 0`; the default is 0 (never expires) and NO shipped pickup sets #timeAlive at all
  (grep of casts/data: zero occurrences). So pickups persisting until collected is FAITHFUL. NOT a gap.

**Status: CLEAN (both agent flags are catalogued/false-positive non-issues).**
