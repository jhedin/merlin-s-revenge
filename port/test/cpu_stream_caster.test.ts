// I8 streaming CPU caster (ochreInGame/prestotolinInGame, weapon energyPulseSpell #releaseFunction:
// #fireBullets): the original modFireBullets.releaseSpell STREAMS chargeMax/chargePerUnit bullets at
// fireDelay spacing. The port previously fired ONE splash bullet per cooldown (CpuAI excluded isStreaming),
// under-firing ~5×. CpuAI now latches a stream and empties it over the next frames, like the player.
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy, spawnPlayer, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Team } from "@/components/combat";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import type { Entity } from "@/engine/dispatch";

function stubAssets() {
  const f = (file: string, dela = 1) => ({ file, w: 16, h: 16, reg: [8, 16] as [number, number], dela });
  game.assets = {
    index: { anims: {
      ochreWizard_stand: { delay: 1, loop: true, frames: [f("s.png")] },
      ochreWizard_charge: { delay: 2, loop: false, frames: [f("c0.png", 2), f("c1.png", 2), f("c2.png", 2)] },
      ochreWizard_release: { delay: 1, loop: false, frames: [f("r0.png"), f("r1.png")] },
      energyPulse_fly: { delay: 1, loop: true, frames: [f("b.png")] },
    } },
    images: new Map(), img: () => null, ensureChar: () => {},
  } as any;
}

describe("I8: CPU energyPulse caster streams a VOLLEY, not one bullet", () => {
  let shots = 0;
  beforeEach(() => {
    game.grid = new CollisionGrid(60, 60, 32);
    game.entities = [];
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
    shots = 0;
    game.audio = { play: (m: string) => { if (m === "spell_release") shots++; }, playMusic: () => {} } as any;
    game.input = {
      moveVector: () => ({ x: 0, y: 0 }), cursor: () => ({ x: 0, y: 0 }), pressed: () => false,
      down: () => false, held: () => false, mousePressed: () => false, mouseDown: () => false,
      mouseVector: () => ({ x: 0, y: 0 }), endTick: () => {},
    } as any;
    stubAssets();
  });

  const tick = () => {
    rebuildCombatSubstrate();
    for (let i = 0, n = game.entities.length; i < n; i++) game.entities[i]!.send("update");
  };

  it("fires ~chargeMax/chargePerUnit (≈5) stream bullets per cast, not a single shot", () => {
    const mage = spawnEnemy("ochreInGame", 300, 200); mage.get(Team).team = "#orcs"; // hostile to the player
    mage.get(Movement).x = 300; mage.get(Movement).y = 200;
    const foe = spawnPlayer(330, 200);                  // adjacent; energyPulseSpell reach 9999 -> in range
    game.entities = [mage, foe as Entity];
    // wind-up + the streamed volley: chargeMax 10 / chargePerUnit 2 = 5 shots @ fireDelay 5 PER cast (the
    // caster may start a second cast within the window). Before the fix this fired exactly ONE bullet total.
    for (let i = 0; i < 45; i++) tick();
    expect(shots).toBeGreaterThanOrEqual(4);            // a real volley (was 1 before the fix)
    expect(shots).toBeLessThanOrEqual(15);              // bounded by the charge ceiling × a few casts (no runaway)
  });
});
