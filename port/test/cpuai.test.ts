import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy, spawnPlayer } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Energy, Team } from "@/components/combat";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import type { Entity } from "@/engine/dispatch";

// CpuAI (objAiCPU) FSM: committed target, 30-frame retarget throttle, #leaveGame drop, dazed-on-reel.
describe("CpuAI committed-target FSM", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(60, 60, 32); // wide-open arena (no wall detours)
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  // place an orc and a hostile (#aldevar) target; tick the substrate so the orc can acquire.
  const setup = (orcXY: [number, number], targetXY: [number, number]): { orc: Entity; t: Entity } => {
    const orc = spawnEnemy("warrior", orcXY[0], orcXY[1]); orc.get(Movement).x = orcXY[0]; orc.get(Movement).y = orcXY[1];
    orc.get(Team).team = "#orcs"; // warrior is #aldevar by data; make it hostile to the player
    const t = spawnPlayer(targetXY[0], targetXY[1]);
    game.entities = [orc, t];
    return { orc, t };
  };

  it("commits a target and does NOT twitch-retarget to a closer one before the 30-frame counter", () => {
    const { orc, t } = setup([320, 200], [600, 200]); // far apart so it stays in moveToAttack (seeks, no attack)
    rebuildCombatSubstrate();
    orc.send("update");                                  // findTarget -> commit t -> moveToAttack
    expect(orc.send("getAiMode")).toBe("moveToAttack");
    expect(orc.send("getAiTarget")).toBe(t);

    // introduce a MUCH closer hostile ON the orc's path to t (so it stays nearest after seeking right);
    // a per-tick scanner would jump to it immediately.
    const closer = spawnPlayer(360, 200); closer.get(Team).team = "#aldevar";
    game.entities.push(closer);
    for (let i = 0; i < 25; i++) { rebuildCombatSubstrate(); orc.send("update"); } // < 30 frames
    expect(orc.send("getAiTarget")).toBe(t);             // still committed to the original (no twitch)

    for (let i = 0; i < 8; i++) { rebuildCombatSubstrate(); orc.send("update"); } // cross the 30-frame throttle
    expect(orc.send("getAiTarget")).toBe(closer);        // forced re-eval picked the nearer one
  });

  it("drops its target reactively on #leaveGame (target death) and re-acquires next tick", () => {
    const { orc, t } = setup([320, 200], [560, 200]);
    rebuildCombatSubstrate(); orc.send("update");
    expect(orc.send("getAiTarget")).toBe(t);

    const t2 = spawnPlayer(60, 200); t2.get(Team).team = "#aldevar";
    game.entities.push(t2);
    (t.get(Energy) as any).energy = 0; (t.get(Energy) as any).dead = true; // kill the committed target
    rebuildCombatSubstrate();                            // unregister t -> emits #leaveGame -> orc drops it
    expect(orc.send("getAiTarget")).toBe(t2);            // re-acquired the surviving hostile, no chase-corpse
  });

  it("enters #dazed (zero intent) on reel and returns to #findTarget when it clears", () => {
    const { orc, t } = setup([320, 200], [440, 200]);
    rebuildCombatSubstrate(); orc.send("update");
    expect(orc.send("getAiMode")).toBe("moveToAttack");

    orc.send("characterModeChanged", "#reel");
    expect(orc.send("getAiMode")).toBe("dazed");
    const m = orc.get(Movement);
    rebuildCombatSubstrate(); orc.send("update");
    expect(m.intentX).toBe(0); expect(m.intentY).toBe(0); // frozen — no steering while reeling
    expect(t).toBeTruthy();

    orc.send("characterModeChanged", "#walk");           // reel cleared
    expect(orc.send("getAiMode")).toBe("findTarget");
    rebuildCombatSubstrate(); orc.send("update");
    expect(orc.send("getAiMode")).toBe("moveToAttack");  // re-acquired
  });

  it("attackFin: after a strike it re-acquires (clear + refresh)", () => {
    const { orc, t } = setup([320, 200], [330, 200]); // adjacent -> in melee reach
    rebuildCombatSubstrate(); orc.send("update");        // tick 1: findTarget -> commit -> moveToAttack
    rebuildCombatSubstrate(); orc.send("update");        // tick 2: in reach -> attack -> attackFin re-acquires
    const hp = (t.get(Energy) as any).energy as number;
    expect(hp).toBeLessThan(200);                        // area melee landed on the player
    expect(orc.send("getAiTarget")).toBe(t);             // attackFin re-committed the same (only) hostile
  });
});
