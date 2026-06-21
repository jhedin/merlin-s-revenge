import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { Archetype } from "@/engine/dispatch";
import { ColourTransform } from "@/components/colourTransform";
import { Movement } from "@/components/movement";
import { Anim } from "@/components/anim";
import { Grave } from "@/components/grave";
import { CollisionGrid } from "@/world/collision";

// F3 structural tests. Render is hard to unit-test; these lock the state machines + data wiring.

describe("F3 ColourTransform state machine", () => {
  let e: any, ct: ColourTransform;
  const A = new Archetype("ctprobe", [ColourTransform]);
  beforeEach(() => { game.gameSpeed = 1; e = A.create(1).build({}); ct = e.get(ColourTransform); });

  it("flickWhite is a one-shot white->black that finishes and clears", () => {
    ct.flickWhite();
    const t0 = ct.getColourTransform();
    expect(t0).not.toBeNull();
    expect(t0!.rgb[0]).toBe(255); // starts white (pCurr=0 -> start colour WHITE)
    // faithful objTransColor: pCurr is a percent in [0,100], stepped by speed 33/tick (first frame holds),
    // so ~4 steps to reach 100 and finish. 8 ticks is comfortably past the end.
    for (let i = 0; i < 8; i++) e.send("update");
    expect(ct.getColourTransform()).toBeNull(); // finished -> no tint (faded fully to black)
  });

  it("glowGold chains to fadeGoldBlack and then ends", () => {
    ct.glowGold(); // #current(black) -> gold, speed 10; first frame holds at black (no tint yet)
    e.send("update"); e.send("update"); // 1st holds, 2nd steps pCurr -> the gold overlay reads
    expect(ct.getColourTransform()).not.toBeNull();
    // glowGold (speed 10) reaches pCurr=100 at ~tick 11 -> chains fadeGoldBlack (gold->black, speed 10).
    for (let i = 0; i < 12; i++) e.send("update");
    // now in fadeGoldBlack (chained) — still active until it too fades to black.
    let activeMid = ct.getColourTransform();
    for (let i = 0; i < 12; i++) e.send("update");
    expect(ct.getColourTransform()).toBeNull(); // both transforms done
    expect(activeMid).not.toBeNull(); // the chain was still tinting mid-way
  });

  it("glowRed ping-pongs (stays active) and stopGlowRed clears it", () => {
    ct.glowRed();
    for (let i = 0; i < 60; i++) e.send("update"); // ping-pong -> never finishes
    expect(ct.getColourTransform()).not.toBeNull();
    ct.stopGlowRed();
    expect(ct.getColourTransform()).toBeNull();
  });

  it("glowRed + glowTeal promote to glowRedAndTeal", () => {
    ct.glowRed();
    ct.glowTeal(); // promotes
    const t = ct.getColourTransform();
    expect(t).not.toBeNull();
    // glowRedAndTeal tweens teal -> red, so early on it reads teal-ish (high green/blue)
    expect(t!.additive).toBe(true);
    // stopGlowTeal demotes back to glowRed (still active)
    ct.stopGlowTeal();
    expect(ct.getColourTransform()).not.toBeNull();
  });

  it("getColourTransform returns rgb+strength at sampled t", () => {
    ct.glowRed(); // #current(black) -> red, speed 10
    for (let i = 0; i < 3; i++) e.send("update"); // step the red ramp so the lerped colour reads
    const t = ct.getColourTransform()!;
    expect(t.rgb[0]).toBeGreaterThan(0); // red channel ramping up
    expect(t.strength).toBeGreaterThan(0);
    expect(t.strength).toBeLessThanOrEqual(1);
  });

  // K15: faithful objTransColor tween. flickWhite is white->black at speed 33; the lerped colour darkens
  // each tick (pCurr 0->100 over white->black), so the overlay STRENGTH must ramp DOWN, not up.
  it("flickWhite (speed 33) tweens white->black: strength ramps DOWN as t advances", () => {
    ct.flickWhite();
    e.send("update"); // consume the held first frame (still white)
    const s0 = ct.getColourTransform()!.strength;
    expect(ct.getColourTransform()!.rgb[0]).toBe(255); // white start (pCurr=0)
    e.send("update"); // pCurr += 33 -> colour darkens toward black
    const s1 = ct.getColourTransform()!.strength;
    e.send("update"); // pCurr += 33 again
    const s2 = ct.getColourTransform()!.strength;
    expect(s1).toBeLessThan(s0); // white -> grey: strength falls
    expect(s2).toBeLessThan(s1); // monotonically toward black
  });

  // K15: a #current-start glow armed WHILE another glow is active must begin from the LIVE colour of the
  // glow it interrupts (initCurrentColor), not snap to black.
  it("a #current glow interrupting an active glow starts from the live colour, not black", () => {
    ct.glowGold(); // #current(black) -> gold; ramp it partway so the live colour is a real gold
    for (let i = 0; i < 6; i++) e.send("update");
    const live = ct.getColourTransform()!.rgb;
    expect(Math.max(...live)).toBeGreaterThan(0); // genuinely tinted gold mid-ramp

    ct.glowPink(); // glowPink uses a #current start -> must begin from `live`, NOT black
    const t0 = ct.getColourTransform();
    expect(t0).not.toBeNull();           // would be null (black, strength 0) if it snapped to black
    // the freshly-armed pink tween's start colour equals the gold we were just showing.
    expect(t0!.rgb).toEqual(live);
  });
});

describe("F3 Anim per-frame delay + loop flag (data-driven)", () => {
  const A = new Archetype("animprobe", [Movement, Anim]);
  function withAnims(anims: Record<string, any>) {
    game.assets = {
      index: { anims },
      images: { has: () => true },
      img: () => ({}),
      ensureChar: () => {},
    } as any;
  }
  beforeEach(() => { game.gameSpeed = 1; game.grid = new CollisionGrid(40, 40, 32); });

  it("advances on the CURRENT frame's dela (varying per-frame delay)", () => {
    // a 2-frame strip: frame0 dela=1, frame1 dela=5. Frame advances after 1 tick, then holds 5.
    withAnims({
      x_stand: { delay: 1, loop: true, frames: [
        { file: "a", w: 1, h: 1, reg: [0, 0], dela: 1 },
        { file: "b", w: 1, h: 1, reg: [0, 0], dela: 5 },
      ] },
    });
    const e = A.create(1).build({ animChar: "x" });
    const an = e.get(Anim);
    const frame = () => (an as any).frame;
    e.send("update"); expect(frame()).toBe(1); // after 1 tick (frame0 dela=1) -> frame1
    for (let i = 0; i < 4; i++) e.send("update"); // 4 ticks < frame1 dela 5 -> still frame1
    expect(frame()).toBe(1);
    e.send("update"); expect(frame()).toBe(0); // 5th tick -> wrap to frame0 (loop)
  });

  it("scales the advance with gGameSpeed", () => {
    withAnims({ x_stand: { delay: 1, loop: true, frames: [
      { file: "a", w: 1, h: 1, reg: [0, 0], dela: 4 },
      { file: "b", w: 1, h: 1, reg: [0, 0], dela: 4 },
    ] } });
    game.gameSpeed = 2; // each tick counts double
    const e = A.create(1).build({ animChar: "x" });
    const an = e.get(Anim);
    e.send("update"); e.send("update"); // 2 ticks * speed 2 = 4 >= dela 4 -> advance
    expect((an as any).frame).toBe(1);
  });

  it("Anim.sprite() carries the ColourTransform tint (not a binary flash)", () => {
    withAnims({ x_stand: { delay: 1, loop: true, frames: [
      { file: "a", w: 16, h: 16, reg: [8, 8], dela: 1 },
      { file: "b", w: 16, h: 16, reg: [8, 8], dela: 1 },
    ] } });
    const B = new Archetype("tintsprite", [Movement, Anim, ColourTransform]);
    const e = B.create(1).build({ animChar: "x" });
    e.get(ColourTransform).glowRed(); // #current(black) -> red, speed 10
    for (let i = 0; i < 11; i++) e.send("update"); // ramp the red glow to its peak (pCurr=100 -> pure red)
    const sp = e.get(Anim).sprite()!;
    expect(sp.tint).toBeDefined();
    expect(sp.tint!.rgb[0]).toBe(255); // red glow at peak
    expect(sp.tint!.additive).toBe(true);
  });

  it("one-shot (loop:false) holds the last frame instead of wrapping", () => {
    // pickAction returns "stand" (not moving, not dead) -> mark x_stand one-shot to test the hold.
    withAnims({ x_stand: { delay: 1, loop: false, frames: [
      { file: "a", w: 1, h: 1, reg: [0, 0], dela: 1 },
      { file: "b", w: 1, h: 1, reg: [0, 0], dela: 1 },
    ] } });
    const e = A.create(1).build({ animChar: "x" });
    const an = e.get(Anim);
    for (let i = 0; i < 6; i++) e.send("update"); // run past the end
    expect((an as any).frame).toBe(1); // held at last frame, not wrapped to 0
  });
});

// K21 — modGrave: a dead actor renders as a grave (behind the living, facing right); a ghost leaves none.
describe("K21 grave render (modGrave)", () => {
  function withGraveAnims() {
    game.assets = {
      index: { anims: { x_stand: { delay: 1, loop: false, frames: [{ file: "a", w: 16, h: 16, reg: [8, 8], dela: 1 }] },
                        x_grave: { delay: 1, loop: false, frames: [{ file: "g", w: 16, h: 16, reg: [8, 8], dela: 1 }] } } },
      images: { has: () => true }, img: () => ({}), ensureChar: () => {},
    } as any;
  }
  // isDead is forced true via archetype default (pickAction -> "grave"); facingLeft set true to prove the flip override.
  const Dead = new Archetype("graveprobe", [Movement, Anim, Grave], { defaults: { isDead: true } });
  const Live = new Archetype("liveprobe", [Movement, Anim, Grave], { defaults: { isDead: false } });
  beforeEach(() => { game.gameSpeed = 1; game.grid = new CollisionGrid(40, 40, 32); withGraveAnims(); });

  it("a dead non-ghost is a grave: behind the living (z << y) and faces right (flip=false)", () => {
    const grave = Dead.create(1).build({ animChar: "x", x: 50, y: 80 });
    grave.get(Movement).facingLeft = true; // would mirror if alive; a grave forces face-right
    const live = Live.create(2).build({ animChar: "x", x: 60, y: 70 });
    const gs = grave.get(Anim).sprite()!;
    const ls = live.get(Anim).sprite()!;
    expect(gs.flip).toBe(false);            // setFlipFromDir(1)
    expect(gs.z).toBeLessThan(ls.z);        // grave drawn behind even a live actor at a LOWER y
    expect(gs.z).toBe(80 - 100000);
  });

  it("a dead GHOST (graveOn=false) leaves no grave (sprite null)", () => {
    const ghost = Dead.create(1).build({ animChar: "x", x: 50, y: 80, ghost: true });
    expect(ghost.get(Anim).sprite()).toBeNull();
  });

  it("graves still order among themselves by world-y", () => {
    const near = Dead.create(1).build({ animChar: "x", x: 0, y: 40 }).get(Anim).sprite()!;
    const far = Dead.create(2).build({ animChar: "x", x: 0, y: 90 }).get(Anim).sprite()!;
    expect(far.z).toBeGreaterThan(near.z); // y90 grave draws over y40 grave
  });
});
