// SS-hud families: F1 powerup-collect name captions (objPowerUpWriting: keep the pickup alive through a
// ~50-tick in-place fade), and F3 wizard portrait bar state (objWizardDisplayer.setWizardOn -> isSummoned).
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnPickup } from "@/entities/archetypes";
import { Energy } from "@/components/combat";

describe("SS-hud F1: powerup-collect writing caption (objPowerUpWriting)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(20, 20, 32);
    game.audio = { play: () => {}, playMusic: () => {} } as any;
  });

  it("on collect the pickup enters a fading caption phase, then finishes after the fade", () => {
    const player = spawnPlayer(100, 100); game.player = player; player.get(Energy).energy = 20;
    const pickup = spawnPickup("speed", 100, 100);
    game.entities = [player, pickup];

    expect(pickup.send("writingPhase")).toBeNull();   // not collected yet -> still the potion art
    pickup.send("update");                            // collect
    const ph0 = pickup.send("writingPhase") as { effect: string; alpha: number } | null;
    expect(ph0).not.toBeNull();
    expect(ph0!.effect).toBe("speed");
    expect(ph0!.alpha).toBeCloseTo(1, 5);             // full opacity at the moment of collection
    expect(pickup.send("isFinished")).toBe(false);

    for (let i = 0; i < 25; i++) pickup.send("update");
    const phMid = pickup.send("writingPhase") as { alpha: number };
    expect(phMid.alpha).toBeGreaterThan(0);
    expect(phMid.alpha).toBeLessThan(1);              // fading
    expect(pickup.send("isFinished")).toBe(false);

    for (let i = 0; i < 25; i++) pickup.send("update");
    expect(pickup.send("isFinished")).toBe(true);     // faderFin -> setDead -> swept
  });

  it("the effect is granted exactly once (on the collect frame), not re-applied during the fade", () => {
    const player = spawnPlayer(100, 100); game.player = player;
    const base = player.get(Energy).max;
    player.get(Energy).energy = 10;
    const pickup = spawnPickup("speed", 100, 100);
    const speed0 = player.get(Energy); void speed0;
    game.entities = [player, pickup];
    pickup.send("update");
    const afterCollect = player.get(Energy).energy;   // +25 bonus applied once
    for (let i = 0; i < 40; i++) pickup.send("update");
    expect(player.get(Energy).energy).toBe(Math.min(base, afterCollect)); // no further bonus during the fade
  });
});

describe("SS-hud F3: wizard summon marker (objWizardDisplayer.setWizardOn)", () => {
  beforeEach(() => { game.wizardMaster.reset(); });
  it("isSummoned mirrors an active summoned wizard", () => {
    expect(game.wizardMaster.isSummoned).toBe(false);
    game.wizardMaster.setActive(42);
    expect(game.wizardMaster.isSummoned).toBe(true);
    game.wizardMaster.clearActive();
    expect(game.wizardMaster.isSummoned).toBe(false);
  });
});
