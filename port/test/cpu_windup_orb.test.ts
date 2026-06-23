// SS-vfx 1 (objAiAttack.chargeMagic → ensureSpell/chargeSpell): a CPU magic caster grows a LIVE objSpell
// over its head DURING the #charge wind-up, then RELEASES that same orb at the cast — instead of a spell
// springing into existence already flying. An interrupted wind-up (daze/death) discards the orb (no strand).
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy, spawnPlayer } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Team } from "@/components/combat";
import { SpellActor } from "@/components/spellActor";
import { spawnUnit, spawnAlly } from "@/entities/archetypes";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import type { Entity } from "@/engine/dispatch";

// stub just enough anim strips for a darkMage caster: a multi-frame #charge wind-up (so attackAnimates and
// the strip completes), a #release fire strip, and a #stand idle. growWindupSpell keys off `<char>_charge`.
function stubCasterAssets() {
  const f = (file: string, dela = 1) => ({ file, w: 16, h: 16, reg: [8, 16] as [number, number], dela });
  // a LONG charge wind-up (5 frames × delay 3 ≈ 15 ticks) so the orb visibly grows across several ticks.
  game.assets = {
    index: { anims: {
      darkMage_stand: { delay: 1, loop: true, frames: [f("s.png")] },
      darkMage_charge: { delay: 3, loop: false, frames: [f("c0.png", 3), f("c1.png", 3), f("c2.png", 3), f("c3.png", 3), f("c4.png", 3)] },
      darkMage_release: { delay: 1, loop: false, frames: [f("r0.png"), f("r1.png")] },
      spell_charge: { delay: 1, loop: true, frames: [f("orb.png")] },
    } },
    images: new Map(),         // no images needed (no render in tests; growWindupSpell checks the index only)
    img: () => null,
    ensureChar: () => {},
  } as any;
}

const spells = (): Entity[] => game.entities.filter((e) => e.type === "spell");

describe("SS-vfx 1: CPU caster grows + releases a charge orb during the wind-up", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(60, 60, 32);
    game.entities = [];
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
    game.audio = { play: () => {}, playMusic: () => {} } as any;
    game.input = {
      moveVector: () => ({ x: 0, y: 0 }), cursor: () => ({ x: 0, y: 0 }), pressed: () => false,
      down: () => false, held: () => false, mousePressed: () => false, mouseDown: () => false,
      mouseVector: () => ({ x: 0, y: 0 }), endTick: () => {},
    } as any;
    stubCasterAssets();
  });

  // one world tick: refresh the combat substrate, then update EVERY entity (so a released orb actually flies).
  const tick = () => {
    rebuildCombatSubstrate();
    for (let i = 0, n = game.entities.length; i < n; i++) game.entities[i]!.send("update");
  };

  const spawnCaster = (): { mage: Entity; foe: Entity } => {
    const mage = spawnEnemy("darkMage", 300, 200); mage.get(Team).team = "#orcs"; // hostile to the player
    mage.get(Movement).x = 300; mage.get(Movement).y = 200;
    const foe = spawnPlayer(320, 200);                 // adjacent; darkBlast reach 9999 -> always in range
    game.entities = [mage, foe];
    return { mage, foe };
  };

  it("an orb exists and GROWS during the wind-up, then is RELEASED as the same flying spell (no double-spawn)", () => {
    const { mage } = spawnCaster();
    let maxConcurrent = 0, chargeLow = Infinity, chargeHigh = 0;
    let sawCharge = false, sawReleased = false;
    for (let i = 0; i < 30; i++) {
      tick();
      const sp = spells();
      maxConcurrent = Math.max(maxConcurrent, sp.length);
      const orb = sp.find((s) => !s.send("isFinished"));
      if (orb) {
        const sa = orb.get(SpellActor);
        if (sa.phase() === "charge") { sawCharge = true; chargeLow = Math.min(chargeLow, sa.charge); chargeHigh = Math.max(chargeHigh, sa.charge); }
        if (sa.phase() === "fly" || sa.phase() === "fade") sawReleased = true; // released to fly, then quick-fade
      }
    }
    expect(sawCharge).toBe(true);                 // the orb appeared over the head during the wind-up
    expect(chargeHigh).toBeGreaterThan(chargeLow); // and GREW across the wind-up
    expect(sawReleased).toBe(true);               // then was RELEASED (flew/exploded), not vanished mid-charge
    expect(maxConcurrent).toBe(1);                // exactly ONE orb — the wind-up orb IS the released one (no dup)
  });

  it("a wind-up interrupted by a daze discards the orb (no stranded charge-mode spell)", () => {
    const { mage } = spawnCaster();
    // tick until the wind-up orb appears
    let appeared = false;
    for (let i = 0; i < 30 && !appeared; i++) {
      tick();
      if (spells().some((s) => !s.send("isFinished") && s.get(SpellActor).phase() === "charge")) appeared = true;
    }
    expect(appeared).toBe(true);
    // interrupt the wind-up with a reel hit, then tick — the orb must be discarded, not stranded.
    mage.send("characterModeChanged", "#reel");
    tick();
    const live = spells().filter((s) => !s.send("isFinished"));
    expect(live.length).toBe(0);            // no orb left charging forever over a dazed caster
  });
});
