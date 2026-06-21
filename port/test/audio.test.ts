import { describe, it, expect } from "vitest";
import { AudioSystem, vol255ToGain, SOUND_CHANNELS, FIRST_SFX_CHANNEL } from "@/systems/audio";
import type { AssetIndex } from "@/render/assets";
import generated from "@/generated/assets.json";

// The audio system must be inert and crash-free without a Web Audio context (tests / SSR):
// play() no-ops, playMusic() defers until unlock, has() reflects the index.
const index = {
  tile: 32, tilesets: {}, anims: {},
  sounds: { wizard_punch: "sounds/x.wav", spell_release: "sounds/y.wav" },
  music: { theme: "music/t.mp3" },
} as unknown as AssetIndex;

describe("AudioSystem (no-context safety)", () => {
  it("reports known sounds via has()", () => {
    const a = new AudioSystem(index);
    expect(a.has("wizard_punch")).toBe(true);
    expect(a.has("nope")).toBe(false);
  });
  it("play/playMusic/toggleMute do not throw without an AudioContext", () => {
    const a = new AudioSystem(index);
    expect(() => a.play("wizard_punch")).not.toThrow();
    expect(() => a.playMusic("theme")).not.toThrow(); // deferred until unlock
    expect(a.debug()).toEqual({ state: "none", buffers: 0, music: "" });
    expect(a.toggleMute()).toBe(true);
    expect(a.toggleMute()).toBe(false);
  });
  it("resolves the real vocabulary-mapped SFX names from the generated index", () => {
    const a = new AudioSystem(generated as unknown as AssetIndex);
    // de-mangled logical names the data references (vs the lossy old regex)
    for (const k of ["wizard_punch", "skeleton_fire", "blackOrc_fire", "blackOrc_die",
      "collect_powerup_01", "tree_die", "spell_release", "level_up"]) {
      expect(a.has(k), k).toBe(true);
    }
  });
});

// soundMaster channel-allocation policy: 7 SFX channels (2..8); a round-robin cursor (pNextChan,
// starting at 2); when the cursor is busy fall to the lowest free channel (soundEmptyChan 2->8);
// when all 7 are busy the new effect is dropped (channel 0).
describe("AudioSystem channel allocation (soundMaster.playSound / soundEmptyChan)", () => {
  const SFX_COUNT = SOUND_CHANNELS - FIRST_SFX_CHANNEL + 1; // channels 2..8 = 7

  it("round-robins concurrent effects across the 7 SFX channels", () => {
    const a = new AudioSystem(index);
    // Without a backend, channels stay claimed (no onended), so N concurrent plays take N channels.
    const used: number[] = [];
    for (let i = 0; i < SFX_COUNT; i++) used.push(a.play("wizard_punch"));
    // First claim is the cursor start (2); the rest fill via soundEmptyChan 2..8 -> exactly {2..8}.
    expect(used.every((c) => c >= FIRST_SFX_CHANNEL && c <= SOUND_CHANNELS)).toBe(true);
    expect(new Set(used).size).toBe(SFX_COUNT); // 7 distinct channels
    expect([...new Set(used)].sort((x, y) => x - y)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it("drops the 8th concurrent effect (all SFX channels busy -> channel 0)", () => {
    const a = new AudioSystem(index);
    a.playMusic("theme"); // music occupies channel 1 (the realistic in-game state)
    for (let i = 0; i < SFX_COUNT; i++) a.play("wizard_punch");
    expect(a.play("wizard_punch")).toBe(0); // soundEmptyChan() returns 0, sound dropped
    // Freeing one channel lets the next effect reclaim the lowest free channel.
    a.stopSound(4);
    expect(a.play("wizard_punch")).toBe(4);
  });

  it("reuses a channel once an effect finishes (soundBusy clears)", () => {
    const a = new AudioSystem(index);
    const first = a.play("wizard_punch");
    expect(a.isBusy(first)).toBe(true);
    a.stopAllSound();
    expect(a.isBusy(first)).toBe(false);
    expect(a.channelState().every((c) => c.name === "empty")).toBe(true);
  });

  it("reserves channel 1 for music and skips it for SFX (soundEmptyChan scans 2..8)", () => {
    const a = new AudioSystem(index);
    a.playMusic("theme"); // deferred (no ctx) but still claims the music channel busy flag
    expect(a.isBusy(1)).toBe(true);
    // Fill every SFX channel: none of them is channel 1.
    const used: number[] = [];
    for (let i = 0; i < SFX_COUNT; i++) used.push(a.play("wizard_punch"));
    expect(used.includes(1)).toBe(false);
    expect(a.play("wizard_punch")).toBe(0); // all SFX busy, music channel never borrowed -> drop
    a.stopMusic();
    expect(a.isBusy(1)).toBe(false);
  });
});

describe("AudioSystem volume model (0..255 -> gain, pDefaultVolume = 150)", () => {
  it("maps the 0..255 volume scale onto 0..1 gain", () => {
    expect(vol255ToGain(0)).toBe(0);
    expect(vol255ToGain(255)).toBe(1);
    expect(vol255ToGain(150)).toBeCloseTo(150 / 255, 6); // pDefaultVolume
    expect(vol255ToGain(-10)).toBe(0);   // clamped low
    expect(vol255ToGain(999)).toBe(1);   // clamped high
  });
});
