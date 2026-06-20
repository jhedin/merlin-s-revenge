import { describe, it, expect } from "vitest";
import { AudioSystem } from "@/systems/audio";
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
