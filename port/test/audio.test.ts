import { describe, it, expect } from "vitest";
import { AudioSystem } from "@/systems/audio";
import type { AssetIndex } from "@/render/assets";

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
});
