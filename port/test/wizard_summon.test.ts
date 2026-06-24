// modSummonWizard + wizardMaster: a #wizard:true ally registers as "found" on spawn; Q summons the
// selected found wizard at the cursor (and toggles it off), Tab cycles which wizard, C summons a battalion.
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { PlayerControl } from "@/components/control";
import { Energy } from "@/components/combat";
import { WizardMaster, baseWizardSym } from "@/systems/wizardMaster";

function input(cursor: { x: number; y: number } | null) {
  return { moveVector: () => ({ x: 0, y: 0 }), cursor: () => cursor, mouseDown: () => false,
    mousePressed: () => false, mouseReleased: () => false, held: () => false, pressed: () => false, endTick: () => {} } as any;
}

describe("wizard summon helper (modSummonWizard / wizardMaster)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(60, 60, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.armyMaster.reset(); game.wizardMaster.reset();
    game.spawnEnemy = (n, x, y, o) => spawnUnit(n, x, y, o as any);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
  });

  it("baseWizardSym strips the InGame suffix (newWizardFound)", () => {
    expect(baseWizardSym("amotonlinInGame")).toBe("amotonlin");
    expect(baseWizardSym("#ulinInGame")).toBe("ulin");
  });

  it("a #wizard:true ally registers itself as found on spawn", () => {
    expect(game.wizardMaster.hasWizards).toBe(false);
    spawnUnit("amotonlinInGame", 100, 100, { animChar: "amo" });
    expect(game.wizardMaster.foundList).toContain("amotonlin");
    expect(game.wizardMaster.currentActorType()).toBe("amotonlinInGame");
  });

  it("selectNext cycles the found wizards", () => {
    const wm = new WizardMaster();
    wm.register("amotonlinInGame"); wm.register("verdanlinInGame");
    expect(wm.current()).toBe("amotonlin");
    wm.selectNext(); expect(wm.current()).toBe("verdanlin");
    wm.selectNext(); expect(wm.current()).toBe("amotonlin"); // wraps
  });

  it("Q summons the selected found wizard at the cursor, and Q again unsummons it", () => {
    const p = spawnPlayer(50, 50); game.player = p; game.entities = [p];
    spawnUnit("amotonlinInGame", 100, 100, { animChar: "amo" }); // meet a wizard -> found
    game.entities = game.entities.filter((e) => e.type === "player"); // clear the field (it left the room)
    const pc = p.get(PlayerControl);

    pc.summonWizard(input({ x: 300, y: 200 }));
    const wiz = game.entities.find((e) => e.id === game.wizardMaster.activeWizardId);
    expect(wiz).toBeDefined();                       // a wizard ally is now on the field
    expect(wiz!.type).toBe("ally");

    pc.summonWizard(input({ x: 300, y: 200 }));       // toggle off
    expect(game.wizardMaster.activeWizardId).toBe(-1);
    expect(wiz!.flags.has("left")).toBe(true);        // teleported out
  });

  it("Q does nothing when no wizard has been found", () => {
    const p = spawnPlayer(50, 50); game.player = p; game.entities = [p];
    p.get(PlayerControl).summonWizard(input({ x: 100, y: 100 }));
    expect(game.wizardMaster.activeWizardId).toBe(-1);
    expect(game.entities.length).toBe(1);             // only the player
  });

  it("a wizard summoned and then KILLED cannot be re-summoned (no banked record for a dead wizard)", () => {
    const p = spawnPlayer(50, 50); game.player = p; game.entities = [p];
    spawnUnit("amotonlinInGame", 100, 100, { animChar: "amo" });    // meet -> found
    game.entities = game.entities.filter((e) => e.type === "player");
    const pc = p.get(PlayerControl);

    pc.summonWizard(input({ x: 300, y: 200 }));                     // summon it onto the field
    const wiz = game.entities.find((e) => e.id === game.wizardMaster.activeWizardId)!;
    expect(wiz.type).toBe("ally");

    // it dies in the field — the main loop marks it lost + clears the active slot (simulated here). The
    // corpse stays in the world (it becomes a grave), so count allies BEFORE the re-summon attempt.
    wiz.get(Energy).dead = true;
    game.wizardMaster.markLost(baseWizardSym(wiz.send("getActorType") as string));
    game.wizardMaster.clearActive();
    const alliesAfterDeath = game.entities.filter((e) => e.type === "ally").length; // 1 (the corpse)

    pc.summonWizard(input({ x: 300, y: 200 }));                     // Q again -> must NOT respawn it
    expect(game.wizardMaster.activeWizardId).toBe(-1);
    expect(game.entities.filter((e) => e.type === "ally").length).toBe(alliesAfterDeath); // no fresh copy
  });
});
