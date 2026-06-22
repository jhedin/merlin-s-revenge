import { describe, it, expect, beforeEach } from "vitest";
import { spawnPlayer, spawnEnemy, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Energy } from "@/components/combat";
import { EnemyAI } from "@/components/control";
import { ExtraLives } from "@/components/extraLives";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

function setupWorld() {
  game.grid = new CollisionGrid(60, 60, 32);
  game.entities = [];
  game.assets = { index: { anims: {} }, images: new Map(), ensureChar: () => {}, img: () => null } as any;
  game.teamMaster.reset(); game.armyMaster.reset(); game.potionMaster.reset();
}

describe("H2: death flow (modExtraLives.attemptRespawn vs gameOver)", () => {
  beforeEach(setupWorld);

  it("lives>0 -> die -> respawn IN PLACE at the recorded point, energy restored, lives--", () => {
    const p = spawnPlayer(0, 0);
    p.get(ExtraLives)["lives"] = 1; // bank one extra life
    p.get(Movement).x = 120; p.get(Movement).y = 80;
    p.send("recordRespawnPoint");                  // captured on entering #die
    // walk away + die
    p.get(Movement).x = 300; p.get(Movement).y = 300;
    p.get(Energy).energy = 0; p.get(Energy).dead = true;
    expect(p.send("isDead")).toBe(true);

    const respawned = p.send("attemptRespawn") as boolean;
    expect(respawned).toBe(true);                  // banked a life -> in-place respawn
    expect(p.send("isDead")).toBe(false);          // revived
    expect(p.get(Energy).energy).toBe(p.get(Energy).max); // energy restored
    expect(p.get(Movement).x).toBe(120);           // back at the recorded respawn point
    expect(p.get(Movement).y).toBe(80);
    expect(p.send("getExtraLives")).toBe(0);       // life consumed
  });

  it("lives==0 -> die -> attemptRespawn returns false (game-over pathway)", () => {
    const p = spawnPlayer(0, 0);
    p.get(Energy).energy = 0; p.get(Energy).dead = true;
    expect(p.send("attemptRespawn")).toBe(false);  // no lives -> false -> gameMaster.gameOver
    expect(p.send("isDead")).toBe(true);           // stays dead (the wasted cutscene + reload follows)
  });

  it("recordRespawnPoint captures the current loc", () => {
    const p = spawnPlayer(0, 0);
    p.get(ExtraLives)["lives"] = 2;
    p.get(Movement).x = 55; p.get(Movement).y = 66;
    p.send("recordRespawnPoint");
    p.get(Movement).x = 999;
    p.send("respawn");
    expect(p.get(Movement).x).toBe(55);
    expect(p.send("getExtraLives")).toBe(1);
  });

  it("extra-lives round-trips through the save chain", () => {
    const p = spawnPlayer(0, 0);
    p.send("addExtraLife"); p.send("addExtraLife");
    const sd: Record<string, any> = {}; p.send("addSaveData", sd);
    expect(sd["lives"].lives).toBe(2);
    const p2 = spawnPlayer(0, 0);
    p2.send("restoreFromSave", sd);
    expect(p2.send("getExtraLives")).toBe(2);
  });
});

describe("grave freeze (modGrave: a dead grave is static background, not a live body)", () => {
  beforeEach(setupWorld);

  it("a dead grave-leaving actor does NOT slide from residual knockback or a later shove", () => {
    const e = spawnEnemy("swordOrc", 200, 200);
    game.entities = [e];
    expect(e.send("getGraveOn")).toBe(true);          // leaves a grave
    const m = e.get(Movement);
    e.get(Energy).energy = 0; e.get(Energy).dead = true; // killed
    // arm residual knockback + walk velocity, then step: a grave must hold its death loc.
    m.kvx = 4; m.kvy = -3; m.vx = 2; m.vy = 2;
    for (let i = 0; i < 10; i++) e.send("update");
    expect(m.x).toBe(200); expect(m.y).toBe(200);     // frozen at the death position
    expect(m.kvx).toBe(0); expect(m.kvy).toBe(0);     // knockback zeroed, can't accumulate
    // a later area hit (the reelProof "shove all units" path) can't move it either.
    e.send("takeHit", 9, 0, -1, 1);
    e.send("update");
    expect(m.x).toBe(200); expect(m.y).toBe(200);
  });

  it("#graveOn:false actors (sumo) vanish — getGraveOn is false (no persistent corpse)", () => {
    expect(spawnEnemy("swordOrc", 0, 0).send("getGraveOn")).toBe(true); // default leaves a grave
    expect(spawnEnemy("sumo", 0, 0).send("getGraveOn")).toBe(false);    // #graveOn:false → no grave
  });

  it("sumo's point-blank ranged reach (25) is honored, not floored to 60", () => {
    const sumo = spawnEnemy("sumo", 0, 0).get(EnemyAI) as any;
    expect(sumo.ranged).toBe(true);
    expect(sumo.reachRanged).toBe(25);
  });
});

describe("H2: goWastedMode (modWastedMode) flag", () => {
  beforeEach(setupWorld);
  it("the player + a cutscene-style unit answer goWastedMode/isWasted", () => {
    const p = spawnPlayer(0, 0);
    expect(p.send("isWasted")).toBe(false);
    p.send("goWastedMode");
    expect(p.send("isWasted")).toBe(true);
    p.send("wastedReset");
    expect(p.send("isWasted")).toBe(false);
  });
});
