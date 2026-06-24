// Anim-state liveness (AUDIT-CHARTER §4, per-actor edition). effect_liveness covers cross-actor effect
// FAMILIES; this covers per-actor <char>_<state> strips: every bundled state-family must be reachable by some
// render/FSM selector, else it's "bundled but never drawn" (the class that shipped 17 dead *_explode strips).
// Selectors compute the state string (`${char}_${action}`), so this asserts each bundled state token is in
// the LIVE set, the faithfully-N/A set, or the explicitly-DEFERRED set — a NEW dead family fails loudly.
import { describe, it, expect } from "vitest";
import assets from "../src/generated/assets.json";

// states a selector can return (control/anim/hurt/mine animAction + drawBullets). Keep in sync with drivers.
const LIVE = new Set([
  "stand", "walk", "grave", "reel", "charge", "chargewalk", "release", "releasewalk",
  "naturalmelee", "weaponmelee", "weaponranged", "naturalranged", "build", "primed", "explode", "fly",
  "land", // objBullet #land: a stalled plain bullet plays <char>_land before dying (projectile.ts + drawBullets)
  "bebuilt", // Dwelling.animAction: under-construction building art (underConstruction flag)
  "producegroup", // Dwelling.animAction: a portal/dwelling spawning a wave (#produceGroup, mode==="produce")
  "magicmelee", // PlayerControl: energyPunch swing strip (mer_magicMelee), not the generic punch
  "armysummon", "goblinsummon", "monstersummon", "scsummon", "skelitonsummon", "undeadsummon", "firebullets",
]);
// real gaps the audit finds but that aren't wired yet go here (tracked, not hidden) — empty today, all wired.
const DEFERRED = new Set<string>([]);
// art with no cast driver / intentionally superseded (player stretchDeath supersedes die; band/king cutscene
// art with no driver; side-scroll heritage) — faithful to drop.
const NA = new Set(["die", "weaponmagic", "weaponmagicwalk", "mosh", "strum", "rock", "play", "altstand", "sidestand", "02"]);

const STATES = ["weaponMagicWalk", "naturalMelee", "weaponMelee", "weaponRanged", "naturalRanged", "weaponMagic",
  "magicMelee", "releaseWalk", "chargeWalk", "releasewalk", "chargewalk", "altStand", "sideStand", "beBuilt", "release",
  "charge", "produceGroup", "fireBullets", "build", "primed", "stand", "walk", "reel", "die", "grave", "land", "fly",
  "explode", "mosh", "strum", "rock", "play", "special", "02",
  "armySummon", "goblinSummon", "monsterSummon", "scSummon", "skelitonSummon", "undeadSummon"];
const stateOf = (k: string) => STATES.find((s) => k.toLowerCase().endsWith(s.toLowerCase()))?.toLowerCase() ?? "?";

describe("anim-state liveness: every bundled <char>_<state> family is selectable, deferred, or N/A", () => {
  const states = new Set(Object.keys((assets as any).anims).map(stateOf));
  for (const s of states) {
    it(`state "${s}" is reachable by a selector (or explicitly deferred/N-A)`, () => {
      expect(LIVE.has(s) || DEFERRED.has(s) || NA.has(s)).toBe(true);
    });
  }
});
