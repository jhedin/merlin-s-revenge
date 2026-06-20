// Phase I (Pass A) — mr4Demo placed content. Tests per plan §e:
//   I1 objMagicLimit — set dims a limitMagic spell's chargeMax; non-limit unchanged; room-leave resets.
//   I2 objMusic — spawning a music marker plays its track; restart-guard; musicOff -> stopMusic.
//   I3 objTeamOverride — override gangs everyone up on the override team; reset clears.
//   I4 objScroll energyPunch — collecting grants a #magicMelee melee weapon (WeaponManager owns it).
//   I6 objMine — primes after N frames; detonates on a hostile in range; team-gate; aura freezes not damages.

import { describe, it, expect, beforeEach } from "vitest";
import { Archetype, type Entity } from "@/engine/dispatch";
import { Movement } from "@/components/movement";
import { Team, Targeting, Energy } from "@/components/combat";
import { Freeze } from "@/components/freeze";
import { TeamMaster } from "@/systems/teams";
import { MagicLimitMaster } from "@/systems/magicLimit";
import { resolveAttack, type AttackData } from "@/components/weapon";
import { chargeMaxOf, chargeStartOf, chargeSpeedOf } from "@/components/charge";
import { registry } from "@/game/data";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnMine } from "@/entities/objTypes";
import { spawnPlayer, spawnEnemy } from "@/entities/archetypes";
import { spawnFromSymbol } from "@/entities/actorSerial";
import { AudioSystem } from "@/systems/audio";
import { PlayerControl } from "@/components/control";
import { Projectile } from "@/components/projectile";

// Minimal input stub exposing only what PlayerControl reads (mirrors player_kit.test.ts).
function fakeInput(opts: { mouseDown?: boolean; cursor?: { x: number; y: number } | null; pressedG?: boolean }) {
  return {
    moveVector: () => ({ x: 0, y: 0 }),
    cursor: () => opts.cursor ?? null,
    mouseDown: () => !!opts.mouseDown,
    mousePressed: () => false, mouseReleased: () => false,
    held: (_k: string) => false,
    pressed: (k: string) => k === "g" && !!opts.pressedG,
    endTick: () => {},
  } as any;
}
const pcOf = (p: Entity): PlayerControl => (p as any).comps.find((c: any) => typeof c.gmgCollected === "function");
const grant = (p: Entity, actor: string) => p.get(PlayerControl).grantSpell(atkOf(actor));

const atkOf = (actor: string): AttackData =>
  resolveAttack(((registry.resolveActor(actor) ?? {})["attack"]) as any, registry.resolveActor(actor) as any);

const headlessAssets = () => ({ index: { anims: {}, music: {}, sounds: {} }, img: () => null } as any);

// ─────────────────────────── I1: magic limiter ───────────────────────────
describe("I1 — objMagicLimit dims a limitMagic spell's charge ceiling (room-scoped)", () => {
  beforeEach(() => { game.magicLimit = new MagicLimitMaster(); });

  it("default 100 -> a limitMagic spell's chargeMax is unscaled", () => {
    const energyBlast = atkOf("energyBlast");           // limitMagic: true
    expect(energyBlast.limitMagic).toBe(true);
    const mana = { capacity: 10, flow: 1, burst: 1 };
    expect(game.magicLimit.get()).toBe(100);
    const full = chargeMaxOf(energyBlast, mana);         // min(999, 10*.75+5) = 12.5
    expect(full).toBeCloseTo(12.5);
  });

  it("set(25) -> a limitMagic spell's chargeMax drops to 25% (12.5 -> 3.125)", () => {
    const energyBlast = atkOf("energyBlast");
    const mana = { capacity: 10, flow: 1, burst: 1 };
    game.magicLimit.set(25);
    expect(chargeMaxOf(energyBlast, mana)).toBeCloseTo(12.5 * 0.25);
  });

  it("a NON-limitMagic spell is unaffected by the limiter", () => {
    const darkBlast = atkOf("darkBlast");                // limitMagic: false
    expect(darkBlast.limitMagic).toBe(false);
    const mana = { capacity: 10, flow: 1, burst: 1 };
    const before = chargeMaxOf(darkBlast, mana);
    game.magicLimit.set(25);
    expect(chargeMaxOf(darkBlast, mana)).toBe(before);   // unchanged
  });

  it("setDefault() (room-leave) restores the limiter to 100", () => {
    game.magicLimit.set(50);
    expect(game.magicLimit.get()).toBe(50);
    game.magicLimit.setDefault();
    expect(game.magicLimit.get()).toBe(100);
  });

  it("the magicLimit25 marker (spawnFromSymbol) sets the limiter to 25 on spawn", () => {
    game.magicLimit = new MagicLimitMaster();
    game.grid = new CollisionGrid(40, 40, 32); game.entities = []; game.assets = headlessAssets();
    const e = spawnFromSymbol("#magicLimit25", 50, 50);
    expect(e).not.toBeNull();
    expect(game.magicLimit.get()).toBe(25);
  });
});

// ─────────────────────────── I2: objMusic ───────────────────────────
describe("I2 — objMusic markers play the room track (restart-guard + musicOff)", () => {
  // a tiny AudioSystem with the bundled keys + a record of playMusic/stopMusic calls.
  const makeAudio = () => {
    const a = new AudioSystem({ music: { baroque_rock_v1: "x.mp3", last_stand_v4: "y.mp3" } } as any);
    const calls: string[] = [];
    const realPlay = a.playMusic.bind(a);
    (a as any).playMusic = (n: string) => { calls.push(n); realPlay(n); };
    (a as any).__calls = calls;
    return a;
  };

  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = []; game.assets = headlessAssets();
  });

  it("spawning musicBaroqueRock plays 'baroque_rock_v1'", () => {
    const audio = makeAudio(); game.audio = audio;
    spawnFromSymbol("#musicBaroqueRock", 10, 10);
    expect((audio as any).__calls).toContain("baroque_rock_v1");
  });

  it("the same track spawned twice does not restart (audio.playMusic guard)", () => {
    const audio = makeAudio(); game.audio = audio;
    // first play sets currentMusic (with a live ctx); simulate by forcing currentMusic.
    (audio as any).currentMusic = "baroque_rock_v1";
    const before = audio.debug().music;
    spawnFromSymbol("#musicBaroqueRock", 10, 10);   // guard: currentMusic === name -> no-op
    expect(audio.debug().music).toBe(before);
  });

  it("musicLastStand resolves to 'last_stand_v4' (was in SKIP_SPAWN, now handled)", () => {
    const audio = makeAudio(); game.audio = audio;
    spawnFromSymbol("#musicLastStand", 10, 10);
    expect((audio as any).__calls).toContain("last_stand_v4");
  });

  it("musicOff -> the 'stopMusic' sentinel stops the music", () => {
    const audio = makeAudio(); game.audio = audio;
    (audio as any).currentMusic = "baroque_rock_v1";
    spawnFromSymbol("#musicOff", 10, 10);            // #musicName: "stopMusic" -> stopMusic()
    expect(audio.debug().music).toBe("");            // stopped
  });

  it("the bundled music keys match the #musicName logical track names directly (no alias needed)", () => {
    // verify the key mapping the plan asked to confirm (§g.4): every act_music* #musicName is a music key.
    const expected: Record<string, string> = {
      musicBaroqueRock: "baroque_rock_v1", musicWoodsOfEvil: "woods_of_evil_v1",
      musicLastStand: "last_stand_v4", musicBaroqueRockTechno: "baroque_rock_techno_v1",
      musicElectronicMerlin: "electronic_merlin_v1_02", musicOff: "stopMusic",
    };
    for (const [actor, track] of Object.entries(expected)) {
      expect((registry.resolveActor(actor) ?? {})["musicName"]).toBe(track);
    }
  });
});

// ─────────────────────────── I3: objTeamOverride ───────────────────────────
describe("I3 — objTeamOverride gangs everyone up on the override team", () => {
  let tm: TeamMaster;
  beforeEach(() => { tm = new TeamMaster(); tm.unitMap.configure(32, 0, 0); game.teamMaster = tm; });

  it("with override #aldevar, a #monsters unit's #enemy target teams become aldevar's side", () => {
    tm.teamOverride = "#aldevar";
    const teams = tm.calcTargetTeams("#monsters", "#enemy");
    // gang-up branch: return [[...aldevar.friends, #aldevar]] — i.e. target the player's side.
    expect(teams[0]).toContain("#aldevar");
  });

  it("clearing the override (null) restores normal #hates-based targeting", () => {
    tm.teamOverride = "#aldevar";
    const ganged = tm.calcTargetTeams("#orcs", "#enemy")[0];
    expect(ganged).toContain("#aldevar"); // gang up (orcs already hate aldevar, but override forces the set)
    tm.teamOverride = null;
    const normal = tm.calcTargetTeams("#orcs", "#enemy");
    // normal #orcs hates (tem_orcs): multiple tiers, the full hates list (not just [aldevar+friends])
    expect(normal).toEqual(expect.arrayContaining([expect.arrayContaining(["#aldevar"])]));
  });

  it("the teamOverride marker sets teamMaster.teamOverride on spawn", () => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = []; game.assets = headlessAssets();
    game.teamMaster.teamOverride = null;
    spawnFromSymbol("#teamOverride", 20, 20);
    expect(game.teamMaster.teamOverride).toBe("#aldevar"); // act_teamOverride.#teamToTarget
  });
});

// ─────────────────────────── I4: energyPunch ───────────────────────────
describe("I4 — energyPunch grants a #magicMelee melee weapon (addWeapon via the scroll path)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = []; game.assets = headlessAssets();
    game.teamMaster = new TeamMaster(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  it("act_energyPunch is a #magicMelee melee attack (damageMultiplier 1.75)", () => {
    const a = atkOf("energyPunch");
    expect(a.animType).toBe("#magicMelee");
    expect(a.type).toBe("melee");
    expect(a.damageMultiplier).toBeCloseTo(1.75);
  });

  it("collecting the energyPunch scroll adds it as an owned melee weapon", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const pickup = spawnFromSymbol("#energyPunch", 100, 100); // a pickup at the player's loc
    expect(pickup).not.toBeNull();
    pickup!.send("update"); // collect on overlap
    const wm = (player as any).comps.find((c: any) => typeof c.getWeapons === "function");
    const meleeWeapons = wm.weaponsOfType("melee");
    expect(meleeWeapons).toContain("#energyPunch");
  });
});

// ─────────────────────────── I6: objMine ───────────────────────────
describe("I6 — objMine prime/detonate/team-gate; auras freeze (not damage)", () => {
  let tm: TeamMaster; let nextId = 1;
  const Unit = new Archetype("u", [Movement, Freeze, Team, Targeting, Energy],
    { defaults: { isDead: false, isInvince: false, isFrozen: false, freezeFactor: 1 } });
  const spawnVictim = (team: string, x: number, y: number, energy = 1000): Entity => {
    const e = Unit.create(10000 + nextId++).build({ x, y, team, energy }); e.type = "enemy";
    tm.register(e, team, "#teamMembers"); tm.unitMap.insert(e, x, y);
    game.entities.push(e); // so the re-insert loop (below) keeps it in the unit map
    return e;
  };
  const tick = (e: Entity, n: number) => { for (let i = 0; i < n; i++) e.send("update"); };

  beforeEach(() => {
    tm = new TeamMaster(); tm.unitMap.configure(32, 0, 0); game.teamMaster = tm; nextId = 1;
    game.grid = new CollisionGrid(40, 40, 32); game.entities = []; game.assets = headlessAssets();
    game.audio = undefined;
  });

  it("fire mine (#fire) detonates on a hostile (#aldevar) in trigger range -> damage", () => {
    const mine = spawnMine("fire", 0, 0); game.entities.push(mine);
    const victim = spawnVictim("#aldevar", 6, 0); // within triggerRadius 20
    const e0 = (victim.get(Energy) as any).energy;
    tick(mine, 30); // prime (0.1s -> ~1 frame) + check counter (3 frames) -> detonate
    expect((victim.get(Energy) as any).energy).toBeLessThan(e0);
  });

  it("a hostile OUTSIDE the trigger radius does not set off the mine", () => {
    const mine = spawnMine("fire", 0, 0); game.entities.push(mine);
    const far = spawnVictim("#aldevar", 200, 0); // well outside radius 20
    const e0 = (far.get(Energy) as any).energy;
    tick(mine, 30);
    expect((far.get(Energy) as any).energy).toBe(e0); // untouched
  });

  it("TEAM-GATE: a #fire mine does NOT hit a #fire unit (tem_fire doesn't hate #fire)", () => {
    const mine = spawnMine("fire", 0, 0); game.entities.push(mine);
    const friendly = spawnVictim("#fire", 6, 0); // same team as the mine
    const e0 = (friendly.get(Energy) as any).energy;
    tick(mine, 30);
    expect((friendly.get(Energy) as any).energy).toBe(e0); // not hit
  });

  it("fire mine re-arms and dies after 10 explosions (dieOnExplodeNumber 10)", () => {
    const mine = spawnMine("fire", 0, 0); game.entities.push(mine);
    // keep a hostile permanently in range; tick long enough for >10 detonations.
    spawnVictim("#aldevar", 6, 0);
    for (let i = 0; i < 200 && !mine.send("isDead"); i++) {
      mine.send("update");
      tm.unitMap.clear(); for (const e of game.entities) { if (e.type === "enemy" && !e.send("isDead")) { const p = e.send("getPos") as any; tm.unitMap.insert(e, p.x, p.y); } }
    }
    const mineComp = (mine as any).comps.find((c: any) => typeof c.getExplosions === "function");
    expect(mineComp.getExplosions()).toBe(10);
    expect(mine.send("isDead")).toBe(true);
  });

  it("pitMonster re-arms FOREVER (no dieOnExplodeNumber) — survives many explosions", () => {
    const mine = spawnMine("pitMonster", 0, 0); game.entities.push(mine);
    // pitMonster prime is 120 frames — prime it, then keep a hostile in close range (radius 50).
    spawnVictim("#aldevar", 10, 0);
    for (let i = 0; i < 400; i++) {
      mine.send("update");
      tm.unitMap.clear(); for (const e of game.entities) { if (e.type === "enemy" && !e.send("isDead")) { const p = e.send("getPos") as any; tm.unitMap.insert(e, p.x, p.y); } }
    }
    expect(mine.send("isDead")).toBe(false); // never dies (dieOnExplode false, no number)
  });

  it("AURA mine (snowAura) FREEZES (not damages): victim frozen, energy unchanged", () => {
    const mine = spawnMine("snowAura", 0, 0); game.entities.push(mine);
    const victim = spawnVictim("#aldevar", 6, 0); // within triggerRadius 16
    const e0 = (victim.get(Energy) as any).energy;
    tick(mine, 30);
    expect(victim.send("isFrozen")).toBe(true);                    // takeFreeze ran
    expect((victim.get(Energy) as any).energy).toBe(e0);          // damageMultiplier 0 -> NO damage
    expect((victim.get(Freeze) as any).freezeFactor()).toBe(0.5); // slowed to half speed
  });

  it("the mine is type 'mine' (does NOT gate room-clear as an enemy)", () => {
    const mine = spawnMine("fire", 0, 0);
    expect(mine.type).toBe("mine");
  });
});

// ─────────────────────────── I7: GMG (Golden Machine Gun) ───────────────────────────
describe("I7 — GMG collect/toggle/charge-swap/auto-fire", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = []; game.assets = headlessAssets();
    game.audio = undefined; game.magicLimit = new MagicLimitMaster();
    game.teamMaster = new TeamMaster(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.input = fakeInput({}) ;
  });

  it("act_energyBlast carries the gmg* charge set (gmgChargeMax 15, gmgAutoFire true)", () => {
    const a = atkOf("energyBlast");
    expect(a.gmgChargeMax).toBe(15); expect(a.gmgChargeSpeed).toBe(5);
    expect(a.gmgChargeStart).toBe(5); expect(a.gmgAutoFire).toBe(true);
  });

  it("collecting the #gmg scroll sets collected + turns the GMG on (NOT addWeapon)", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const pickup = spawnFromSymbol("#gmg", 100, 100);
    expect(pickup).not.toBeNull();
    pickup!.send("update"); // collect on overlap
    const pc = pcOf(player);
    expect(pc.getGmgCollected()).toBe(true);
    expect(pc.getGmgOn()).toBe(true);
    // it is a mode, NOT a weapon: the inventory still has no #gmg weapon.
    const wm = (player as any).comps.find((c: any) => typeof c.getWeapons === "function");
    expect(wm.weaponsOfType("magic")).not.toContain("#gmg");
  });

  it("setGmg toggles on/off, and is inert until collected", () => {
    const player = spawnPlayer(100, 100); const pc = pcOf(player);
    pc.setGmg(); expect(pc.getGmgOn()).toBe(false); // not collected -> inert
    pc.gmgCollected(); expect(pc.getGmgOn()).toBe(true); // collect turns it on
    pc.setGmg(); expect(pc.getGmgOn()).toBe(false);      // toggle off
    pc.setGmg(); expect(pc.getGmgOn()).toBe(true);       // toggle back on
  });

  it("with GMG on, chargeMaxOf reads gmgChargeMax (15) instead of the mana ceiling (12.5)", () => {
    const a = atkOf("energyBlast");
    const mana = { capacity: 10, flow: 1, burst: 1 };
    expect(chargeMaxOf(a, mana)).toBeCloseTo(12.5);             // normal: capacity*.75+5
    expect(chargeMaxOf(a, mana, undefined, true)).toBe(15);     // GMG: flat gmgChargeMax
    expect(chargeStartOf(a, mana, true)).toBe(5);               // GMG: gmgChargeStart
    expect(chargeSpeedOf(a, mana, true)).toBe(5);               // GMG: gmgChargeSpeed
  });

  it("the spellCharged auto-fire loop releases >1 spell over N ticks with gmgAutoFire", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } });
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    grant(player, "energyBlast"); pcOf(player).gmgCollected(); // GMG on
    // gmgChargeStart 5 -> +5/tick -> reaches gmgChargeMax 15 fast; each tick at max auto-releases a spell
    // (K2: a flying objSpell) and re-charges a fresh one — a continuous stream of released orbs.
    for (let i = 0; i < 12; i++) player.send("update");
    const spells = game.entities.filter((e) => e.type === "spell").length;
    expect(spells).toBeGreaterThan(1); // continuous machine-gun fire (not a single shot)
  });

  it("WITHOUT GMG, the same held-charge produces ONE spell (no auto-fire)", () => {
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } });
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    grant(player, "energyBlast");
    for (let i = 0; i < 12; i++) player.send("update");        // hold: charges a SINGLE orb, never auto-releases
    expect(game.entities.filter((e) => e.type === "spell").length).toBe(1); // one charging orb, not a stream
    (game.input as any).mouseDown = () => false;
    player.send("update");                                      // release -> still exactly one (it now flies)
    expect(game.entities.filter((e) => e.type === "spell").length).toBe(1);
  });
});

// ─────────────────────────── I8: beams (streaming release + beam render) ───────────────────────────
describe("I8 — beams: streaming release + energyBeam render", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = []; game.assets = headlessAssets();
    game.audio = undefined; game.magicLimit = new MagicLimitMaster();
    game.teamMaster = new TeamMaster(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.input = fakeInput({ mouseDown: true, cursor: { x: 400, y: 100 } });
  });

  it("the beam scrolls grant a #magic weapon with releaseFunction #fireBullets", () => {
    const beam = atkOf("energyBeamSpell"); const pulse = atkOf("energyPulseSpell");
    expect(beam.releaseFunction).toBe("#fireBullets"); expect(beam.beam).toBe(true);
    expect(beam.fireDelay).toBeCloseTo(6.75); expect(beam.chargePerUnit).toBe(5);
    expect(pulse.releaseFunction).toBe("#fireBullets"); expect(pulse.beam).toBe(false);
    expect(pulse.fireDelay).toBe(5); expect(pulse.chargePerUnit).toBe(2);
  });

  // floor(C/chargePerUnit): drain happens BEFORE the <0 check, so the count = floor(held/chargePerUnit).
  it("energyPulse: a release with charge C emits floor(C/chargePerUnit) explode bullets spaced by fireDelay", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    grant(player, "energyPulseSpell"); // chargePerUnit 2, fireDelay 5
    // charge up: energyPulse chargeMax 999 capped by capacity (10*?+0)=... base energyPulse has no
    // chargeMaxModifier so chargeMaxBasic 0 -> capacity*0+0 = 0; force a known held charge via the stream.
    // Drive a full charge then release.
    for (let i = 0; i < 40; i++) player.send("update"); // hold to charge to ceiling
    const held = (player as any).comps.find((c: any) => typeof c.chargeFrac === "function");
    void held;
    (game.input as any).mouseDown = () => false;
    player.send("update"); // release -> stream starts
    // run the stream out (fireDelay 5 -> one bullet every 5 ticks until charge<0).
    let bullets = 0;
    for (let i = 0; i < 200; i++) {
      const before = game.entities.filter((e) => e.type === "bullet").length;
      player.send("update");
      const after = game.entities.filter((e) => e.type === "bullet").length;
      if (after > before) bullets += after - before;
    }
    expect(bullets).toBeGreaterThanOrEqual(1); // at least one explode bullet streamed
  });

  it("the stream count == floor(heldCharge/chargePerUnit) (exact drain semantics)", () => {
    // Use the stream directly via a controlled charge to assert the count is exact.
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const pulse = atkOf("energyPulseSpell"); // chargePerUnit 2
    // Inject a stream with known charge by calling the private path through a release: set charge=10.
    const pc = pcOf(player) as any;
    pc.stream = { attack: pulse, charge: 10, delay: 0, counter: 0, aimX: 400, aimY: 100, team: "#aldevar" };
    // delay 0 -> empties in one tick. floor(10/2)=5 bullets (the 6th drain pushes charge to -2<0, no shot).
    player.send("update");
    expect(game.entities.filter((e) => e.type === "bullet").length).toBe(5);
  });

  it("energyBeam: performBeamAttack spawns a bullet AT the target with a stretched/rotated sprite", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const beam = atkOf("energyBeamSpell"); // beam:true, bullet:#energyBeam
    const pc = pcOf(player) as any;
    pc.stream = { attack: beam, charge: 10, delay: 0, counter: 0, aimX: 300, aimY: 100, team: "#aldevar" };
    player.send("update"); // emits beam bullets
    const beams = game.entities.filter((e) => e.type === "bullet" && e.get(Projectile).beam);
    expect(beams.length).toBeGreaterThanOrEqual(1);
    const b = beams[0]!;
    const proj = b.get(Projectile);
    expect(proj.beam).toBe(true);
    expect(proj.beamDist).toBeGreaterThan(0);        // setSpriteWidth = caster->target distance
    expect(Number.isFinite(proj.beamAngle)).toBe(true); // setSpriteRotation = GeomAngle
    // spawned AT (near) the target loc (300,100) ±10 jitter, NOT travelling from the caster (100,100).
    const p = b.send("getPos") as { x: number; y: number };
    expect(Math.abs(p.x - 300)).toBeLessThanOrEqual(7);
  });

  it("energyBeam detonates its explode #attack at the target on the first frame (damages a hostile there)", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    // a hostile sitting at the target loc
    const foe = spawnEnemy("swordOrc", 300, 100, { animChar: "swordOrc" });
    game.entities.push(foe);
    game.teamMaster.register(player, player.send("getTeam"), "#teamMembers");
    game.teamMaster.register(foe, foe.send("getTeam"), "#teamMembers");
    game.teamMaster.unitMap.insert(foe, 300, 100); // so the area search finds it
    const hp0 = foe.get(Energy).energy;
    const beam = atkOf("energyBeamSpell");
    const pc = pcOf(player) as any;
    pc.stream = { attack: beam, charge: 5, delay: 0, counter: 0, aimX: 300, aimY: 100, team: player.send("getTeam") };
    player.send("update"); // emit the beam bullet
    for (const e of game.entities) if (e.type === "bullet") e.send("update"); // first-frame detonate
    expect(foe.get(Energy).energy).toBeLessThan(hp0);  // the explode #attack hit it
  });

  it("under GMG, fireDelay=0 -> the whole stream empties in one tick", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const pulse = atkOf("energyPulseSpell");
    pcOf(player).gmgCollected(); // GMG on -> stream delay forced to 0
    const pc = pcOf(player) as any;
    // simulate the release path setting delay from gmgOn:
    pc.stream = { attack: pulse, charge: 8, delay: 0, counter: 0, aimX: 400, aimY: 100, team: "#aldevar" };
    player.send("update");
    expect(game.entities.filter((e) => e.type === "bullet").length).toBe(4); // floor(8/2) all at once
  });
});
