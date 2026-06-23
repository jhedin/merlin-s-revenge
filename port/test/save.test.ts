import { describe, it, expect, beforeEach } from "vitest";
import { PlayerArchetype, spawnPlayer, spawnEnemy, spawnUnit, spawnAlly, spawnDwelling, spawnPickup } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Energy, Team } from "@/components/combat";
import { Experience } from "@/components/experience";
import { WeaponManager, resolveAttack } from "@/components/weapon";
import { Medikit } from "@/components/medikit";
import { Dwelling } from "@/components/dwelling";
import { serializeActor, respawnActor } from "@/entities/actorSerial";
import { buildSave, loadSave, saveGame, SAVE_VERSION } from "@/systems/save";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import { registry } from "@/game/data";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

// minimal localStorage stub for the node test env
function stubLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

function setupWorld() {
  game.grid = new CollisionGrid(60, 60, 32);
  game.entities = [];
  game.assets = { index: { anims: {} }, img: () => null } as any;
  game.spawnEnemy = spawnEnemy; game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
  game.teamMaster.reset(); game.armyMaster.reset(); game.potionMaster.reset();
  game.teamMaster.unitMap.configure(32, 0, 0);
}

describe("save/restore: addSaveData fold + restoreFromSave (player chain)", () => {
  beforeEach(setupWorld);
  it("round-trips player state through namespaced sub-dicts", () => {
    const p = PlayerArchetype.create(1).build({ energy: 100, x: 10, y: 20 });
    p.get(Movement).x = 50; p.get(Movement).y = 64;
    p.get(Energy).energy = 30; p.get(Energy).max = 120;
    p.get(Experience).level = 3; p.get(Experience).xp = 15;

    const sd: Record<string, any> = {};
    p.send("addSaveData", sd);
    expect(sd["move"]).toMatchObject({ x: 50, y: 64 });
    expect(sd["energy"]).toMatchObject({ energy: 30, max: 120 });
    expect(sd["xp"]).toMatchObject({ level: 3, xp: 15 });

    const p2 = PlayerArchetype.create(2).build({ energy: 100, x: 0, y: 0 });
    p2.send("restoreFromSave", sd);
    expect(p2.get(Movement).x).toBe(50);
    expect(p2.get(Movement).y).toBe(64);
    expect(p2.get(Energy).energy).toBe(30);
    expect(p2.get(Energy).max).toBe(120);
    expect(p2.get(Experience).level).toBe(3);
    expect(p2.get(Experience).xp).toBe(15);
  });
});

describe("G1a: generic serializeActor / respawnActor", () => {
  beforeEach(setupWorld);

  it("tags every spawned actor with its actor-type symbol (getActorType)", () => {
    expect(spawnEnemy("blackOrc", 0, 0).send("getActorType")).toBe("blackOrc");
    expect(spawnPlayer(0, 0).send("getActorType")).toBe("player");
    expect(spawnPickup("heal", 0, 0).send("getActorType")).toBe("heal");
  });

  it("round-trips an enemy (type + energy/level/position/weapon inventory)", () => {
    const orc = spawnEnemy("blackOrc", 40, 60);
    orc.get(Energy).energy = 17; orc.get(Energy).max = 1200;
    orc.get(Experience).level = 4; orc.get(Experience).xp = 99;
    const snap = serializeActor(orc);
    expect(snap.typ).toBe("blackOrc");
    expect(snap.type).toBe("enemy");

    const re = respawnActor(snap)!;
    expect(re.send("getActorType")).toBe("blackOrc");
    expect(re.type).toBe("enemy");
    expect(re.get(Energy).energy).toBe(17);
    expect(re.get(Energy).max).toBe(1200);
    expect(re.get(Experience).level).toBe(4);
    expect(re.get(Movement).x).toBe(40);
    expect(re.get(Movement).y).toBe(60);
    expect(re.get(WeaponManager).getWeapons(() => {}, "nonMagic"))
      .toEqual(orc.get(WeaponManager).getWeapons(() => {}, "nonMagic"));
  });

  it("round-trips a summoned ally faithfully (forced onto #aldevar, type ally)", () => {
    const ally = spawnAlly("warrior", 30, 30);
    expect(ally.type).toBe("ally");
    expect(ally.get(Team).team).toBe("#aldevar");
    const re = respawnActor(serializeActor(ally))!;
    expect(re.type).toBe("ally");
    expect(re.get(Team).team).toBe("#aldevar"); // not routed back to the warrior's real team
  });

  it("round-trips a dwelling (budget / position)", () => {
    const hut = spawnDwelling("goblinHut", 80, 80);
    const budget0 = hut.get(Dwelling).budget;
    const re = respawnActor(serializeActor(hut))!;
    expect(re.send("getActorType")).toBe("goblinHut");
    expect(re.type).toBe("enemy");
    expect(re.get(Movement).x).toBe(80);
    // budget is re-derived from data at spawn (matches a fresh hut of the same type)
    expect(re.get(Dwelling).budget).toBe(budget0);
  });
});

describe("G1c: relationship restore by spatial locator (no dangling ids)", () => {
  beforeEach(setupWorld);

  it("re-acquires a committed target POSITIONALLY (nearest team+role to the saved loc)", () => {
    const player = spawnPlayer(100, 100); game.player = player;
    const orc = spawnEnemy("blackOrc", 120, 100);
    game.entities = [player, orc];
    rebuildCombatSubstrate();
    // commit the orc to the player via the deferred locator path
    const rel = { team: player.send("getTeam") as string, role: player.send("getTeamRole") as string, x: 100, y: 100 };
    const t = game.teamMaster.restoreTarget(orc, rel);
    expect(t).toBe(player);                       // nearest #aldevar member to (100,100)
    expect(orc.send("getAiTarget")).toBe(player); // committed (setAiTarget)
  });

  it("serializeActor writes a target LOCATOR, never an entity id", () => {
    const player = spawnPlayer(100, 100); game.player = player;
    const orc = spawnEnemy("blackOrc", 120, 100);
    game.entities = [player, orc];
    rebuildCombatSubstrate();
    game.teamMaster.restoreTarget(orc, { team: "#aldevar", role: "#teamMembers", x: 100, y: 100 });
    const snap = serializeActor(orc);
    expect(snap.rel).toBeDefined();
    expect(snap.rel).toMatchObject({ team: "#aldevar", role: "#teamMembers" });
    expect(JSON.stringify(snap)).not.toContain(`"id"`); // never serialized
  });
});

describe("G2: armyMaster reserve (bank on leave, re-field at saved level)", () => {
  beforeEach(setupWorld);

  it("banks a summoned ally at its level and re-fields it at that level, decrementing the reserve", () => {
    const ally = spawnAlly("warrior", 30, 30);
    ally.get(Experience).level = 3; // leveled in the field
    expect(game.armyMaster.teleportOut(ally)).toBe(true);
    expect(game.armyMaster.reserveCount("#aldevar", "warrior")).toBe(1);

    const refielded = game.armyMaster.createUnit("#aldevar", "warrior", 50, 50)!;
    expect(refielded.type).toBe("ally");
    expect(refielded.get(Experience).level).toBe(3);     // re-fielded AT the banked level
    expect(refielded.get(Team).team).toBe("#aldevar");
    expect(game.armyMaster.reserveCount("#aldevar", "warrior")).toBe(0); // consumed
  });

  it("an empty reserve summon returns null (can't summon what you haven't banked)", () => {
    expect(game.armyMaster.createUnit("#aldevar", "warrior", 0, 0)).toBeNull();
  });

  it("does NOT bank the player or an enemy (pTeleportable=false)", () => {
    const player = spawnPlayer(0, 0);
    const orc = spawnEnemy("blackOrc", 10, 10);
    expect(game.armyMaster.teleportOut(player)).toBe(false);
    expect(game.armyMaster.teleportOut(orc)).toBe(false);
  });

  it("banks the #leaveWhenFinished army (incl. tile-spawned), but NOT a non-army ally", () => {
    const summoned = spawnAlly("warrior", 0, 0);     // via spawnAlly -> teleportable
    expect(game.armyMaster.teleportOut(summoned)).toBe(true);
    // #leaveWhenFinished is intrinsic to the actor, not the spawn path: a tile-spawned warrior banks too
    // (objAiCPU #noTargetFound banks any getLeaveWhenFinished ally — warrior/archer/dwarf/monk/king/wizards).
    const tileArmy = spawnUnit("warrior", 0, 0);     // warrior's real team is #aldevar -> routed to ally
    expect(tileArmy.type).toBe("ally");
    expect(game.armyMaster.teleportOut(tileArmy)).toBe(true);
    // a player-side ally that is NOT #leaveWhenFinished (a #monsterSummon throwaway) stays put — not banked.
    const throwaway = spawnUnit("summonArcher", 0, 0);
    expect(game.armyMaster.teleportOut(throwaway)).toBe(false);
  });

  it("round-trips pReserveArmy whole (addSaveData/restoreFromSave)", () => {
    const a = spawnAlly("warrior", 0, 0); a.get(Experience).level = 2;
    const b = spawnAlly("warrior", 0, 0); b.get(Experience).level = 5;
    game.armyMaster.teleportOut(a); game.armyMaster.teleportOut(b);
    const sd = game.armyMaster.addSaveData({});
    game.armyMaster.reset();
    expect(game.armyMaster.reserveCount("#aldevar", "warrior")).toBe(0);
    game.armyMaster.restoreFromSave(sd);
    expect(game.armyMaster.reserveCount("#aldevar", "warrior")).toBe(2);
    // re-field picks the HIGHEST level first (lookupArmyDetails ListGetPosOfMaxByProp)
    const first = game.armyMaster.createUnit("#aldevar", "warrior", 0, 0)!;
    expect(first.get(Experience).level).toBe(5);
  });
});

describe("G3a: real medikit (stockpiled gradual heal)", () => {
  beforeEach(setupWorld);

  it("collecting banks a kit; heals +1 every 5 frames up to max; no heal at full", () => {
    const p = spawnPlayer(0, 0); game.player = p;
    p.get(Energy).max = 50; p.get(Energy).energy = 10;
    const med = p.get(Medikit);
    p.send("medikitCollected", 1);
    expect(p.send("getNumOfMedikits")).toBe(1);
    // tick 5 frames: loads the kit (no heal on the load tick) then heals 1
    for (let i = 0; i < 5; i++) med.update(() => {});
    const afterLoad = p.get(Energy).energy;
    for (let i = 0; i < 5; i++) med.update(() => {});
    expect(p.get(Energy).energy).toBe(afterLoad + 1); // +1 per 5-frame cadence
    // at full energy nothing heals + the kit deactivates
    p.get(Energy).energy = p.get(Energy).max;
    med.update(() => {});
    expect(p.get(Energy).energy).toBe(p.get(Energy).max);
  });

  it("nextMedikit: a second banked kit refills once the first is exhausted", () => {
    const p = spawnPlayer(0, 0); game.player = p;
    p.get(Energy).max = 4; p.get(Energy).energy = 0;
    const med = p.get(Medikit);
    p.send("medikitCollected", 1); p.send("medikitCollected", 1); // bank 2
    // run enough frames to fully heal (two kits, 4 hp, +1/5 frames)
    for (let i = 0; i < 200; i++) med.update(() => {});
    expect(p.get(Energy).energy).toBe(4); // healed to max across kits
  });

  it("save/restore mid-heal resumes numOfMedikits + remainingHitpoints + counter", () => {
    const p = spawnPlayer(0, 0); game.player = p;
    p.get(Energy).max = 100; p.get(Energy).energy = 10;
    p.send("medikitCollected", 1); p.send("medikitCollected", 1);
    const med = p.get(Medikit);
    for (let i = 0; i < 12; i++) med.update(() => {}); // mid-heal (one kit loaded + partially used)
    const sd: Record<string, any> = {}; p.send("addSaveData", sd);
    expect(sd["medikit"].numOfMedikits).toBe(1); // one banked, one active
    expect(sd["medikit"].remainingHitpoints).toBeGreaterThan(0);

    const p2 = spawnPlayer(0, 0);
    p2.send("restoreFromSave", sd);
    expect(p2.get(Medikit).numOfMedikits).toBe(1);
    expect(p2.get(Medikit).remainingHitpoints).toBe(med.remainingHitpoints);
  });
});

describe("G3b: potionMaster per-type counter", () => {
  beforeEach(setupWorld);

  it("tallies per-type drinks and round-trips the counts", () => {
    game.potionMaster.potionCollected("manaFlow");
    game.potionMaster.potionCollected("manaFlow");
    game.potionMaster.potionCollected("manaFlow");
    game.potionMaster.potionCollected("heal");
    expect(game.potionMaster.getCount("manaFlow")).toBe(3);
    expect(game.potionMaster.getCount("heal")).toBe(1);
    const sd = game.potionMaster.addSaveData({});
    game.potionMaster.reset();
    expect(game.potionMaster.getCount("manaFlow")).toBe(0);
    game.potionMaster.restoreFromSave(sd);
    expect(game.potionMaster.getCount("manaFlow")).toBe(3);
    expect(game.potionMaster.getCount("heal")).toBe(1);
  });
});

describe("G1b/H3: save tree v3 (full per-room pState) + version gate", () => {
  beforeEach(() => { setupWorld(); stubLocalStorage(); });

  it("buildSave -> saveGame -> loadSave round-trips the whole world (rooms/cleared/player/army/medikit/potions)", () => {
    const player = spawnPlayer(64, 64); game.player = player;
    player.get(Energy).energy = 42; player.get(Experience).level = 2;
    player.send("medikitCollected", 1);
    player.get(WeaponManager).addWeapon("#merlinSword", resolveAttack((registry.resolveActor("merlinSword") ?? {})["attack"] as any));
    const orc = spawnEnemy("blackOrc", 100, 80); orc.get(Energy).energy = 11;
    const ally = spawnAlly("warrior", 40, 40); ally.get(Experience).level = 4;
    game.entities = [player, orc];                  // ally already banked below
    game.armyMaster.teleportOut(ally);
    game.potionMaster.potionCollected("manaFlow");

    const currentObjects = game.entities.filter((e) => e.type !== "player").map(serializeActor);
    const blob = buildSave({
      player, mapId: "dungeon", currentRoom: { x: 1, y: 1 }, currentRoomNum: 1,
      clearedRooms: [2, 3], currentObjects,
    });
    saveGame(blob);

    const s = loadSave()!;
    expect(s.ver).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(3);
    expect(s.map).toBe("dungeon");
    expect(s.currentRoomNum).toBe(1);
    expect(s.rooms.filter((r) => r.cleared).map((r) => r.num).sort()).toEqual([2, 3]);
    expect(s.player.energy.energy).toBe(42);
    expect(s.player.xp.level).toBe(2);
    expect(s.player.medikit.numOfMedikits).toBe(1);
    expect(s.player.weaponMgr.order).toContain("#merlinSword");
    // current-room objects round-trip (the live orc)
    const roomObjs = s.rooms.find((r) => r.num === 1)!.objects;
    expect(roomObjs.length).toBe(1);
    expect(roomObjs[0]!.typ).toBe("blackOrc");
    expect(roomObjs[0]!.chain.energy.energy).toBe(11);
    // masters
    expect(s.army.pReserveArmy["#aldevar"].warrior.length).toBe(1);
    expect(s.army.pReserveArmy["#aldevar"].warrior[0].level).toBe(4);
    expect(s.potions.pPotionsCollected.find((r: any) => r.character === "manaFlow").numCollected).toBe(1);
  });

  it("persists the sound mute state (soundMaster slice)", () => {
    const player = spawnPlayer(0, 0); game.player = player; game.entities = [player];
    const prev = game.audio;
    game.audio = { muted: true } as any;                 // muted before saving
    const blob = buildSave({ player, mapId: "m", currentRoom: { x: 1, y: 1 }, currentRoomNum: 1, clearedRooms: [], currentObjects: [] });
    game.audio = prev;
    expect(blob.sound?.muted).toBe(true);                 // the mute state round-trips in the save blob
  });

  it("H3: serializes the FULL per-room pState map (every visited room, not just the current one)", () => {
    const player = spawnPlayer(0, 0); game.player = player;
    const orcA = spawnEnemy("blackOrc", 10, 10); orcA.get(Energy).energy = 5;
    game.entities = [player, orcA];
    const curObjects = game.entities.filter((e) => e.type !== "player").map(serializeActor);
    // room 1 is current (live); rooms 2 + 5 carry FROZEN pState snapshots from earlier visits.
    const orcB = spawnEnemy("orc", 20, 20); orcB.get(Energy).energy = 7;
    const orcC = spawnEnemy("blackOrc", 30, 30); orcC.get(Energy).energy = 3;
    const pState: Record<number, any[]> = { 2: [serializeActor(orcB)], 5: [serializeActor(orcC)] };
    const blob = buildSave({
      player, mapId: "m", currentRoom: { x: 1, y: 1 }, currentRoomNum: 1,
      clearedRooms: [2], currentObjects: curObjects, pState: { ...pState, 1: curObjects },
    });
    saveGame(blob);
    const s = loadSave()!;
    const byNum = new Map(s.rooms.map((r) => [r.num, r]));
    expect(byNum.get(1)!.objects[0]!.chain.energy.energy).toBe(5); // current room
    expect(byNum.get(2)!.objects[0]!.chain.energy.energy).toBe(7); // a frozen visited room
    expect(byNum.get(5)!.objects[0]!.chain.energy.energy).toBe(3); // another frozen room
    expect(byNum.get(2)!.cleared).toBe(true);
    expect(byNum.get(5)!.cleared).toBe(false);
  });

  it("rejects a version mismatch and a malformed/legacy blob (returns null, no throw)", () => {
    localStorage.setItem("mr_save_v3", JSON.stringify({ ver: 2, map: "x" }));
    expect(loadSave()).toBeNull();
    localStorage.setItem("mr_save_v3", "{ not json");
    expect(loadSave()).toBeNull();
    localStorage.removeItem("mr_save_v3");
    expect(loadSave()).toBeNull();
  });
});
