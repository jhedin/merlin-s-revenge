// Regression: an uncaught exception in a tick or render must NOT permanently freeze the game. The rAF
// loop schedules the next frame AFTER onTick/onRender, so a throw there used to skip requestAnimationFrame
// entirely — a hard, unrecoverable freeze. The loop now guards each, logging the error and keeping going.
import { describe, it, expect, vi } from "vitest";
import { GameLoop, TICK_MS } from "@/engine/loop";

describe("GameLoop resilience: a throwing tick/render does not kill the loop", () => {
  it("a tick that throws on one frame is caught; later frames still run", () => {
    let raf: ((t: number) => void) | null = null;
    const realRaf = globalThis.requestAnimationFrame;
    const realCaf = globalThis.cancelAnimationFrame;
    (globalThis as any).requestAnimationFrame = (cb: (t: number) => void) => { raf = cb; return 1; };
    (globalThis as any).cancelAnimationFrame = () => {};
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let ticks = 0;
    let clock = 0;
    const onTick = () => { ticks++; if (ticks === 2) throw new Error("boom"); };
    const loop = new GameLoop(onTick, () => {}, () => clock);
    try {
      loop.start();
      // each pumped frame advances the clock one tick's worth, so exactly one onTick fires per frame.
      for (let f = 0; f < 4; f++) { clock += TICK_MS; raf!(clock); }
      // 4 frames => 4 ticks; the 2nd threw but was caught, and frames 3 & 4 still ran.
      expect(ticks).toBe(4);
      expect(errSpy).toHaveBeenCalled();
    } finally {
      loop.stop();
      errSpy.mockRestore();
      globalThis.requestAnimationFrame = realRaf;
      globalThis.cancelAnimationFrame = realCaf;
    }
  });
});
