// Fixed-timestep logical loop decoupled from rendering (PORTING_PLAN §2.4). The original ran
// a 30 Hz busy-wait frame timer; we use an accumulator so logic ticks deterministically at
// 30 Hz regardless of display refresh, and render interpolates/draws on rAF.

export const TICK_HZ = 30;
export const TICK_MS = 1000 / TICK_HZ;

export class GameLoop {
  private acc = 0;
  private last = 0;
  private running = false;
  private raf = 0;
  /** guard against spiral-of-death after a long stall */
  maxTicksPerFrame = 5;
  /** errors logged so far (capped so a per-frame throw doesn't spam the console forever). */
  private errorsLogged = 0;
  private static readonly MAX_ERROR_LOGS = 20;

  constructor(
    private readonly onTick: () => void,
    private readonly onRender: (alpha: number) => void,
    private readonly now: () => number = () => performance.now(),
  ) {}

  // A thrown tick/render must NOT kill the rAF loop (the next requestAnimationFrame would never be reached
  // — a hard, unrecoverable FREEZE). Catch, log the first MAX_ERROR_LOGS with their stack so the real bug
  // surfaces in the console, and keep the loop alive: a transient per-state throw degrades to one dropped
  // frame instead of a dead game (e.g. an occasional room-re-entry edge case).
  private guard(label: string, fn: () => void): void {
    try { fn(); }
    catch (err) {
      if (this.errorsLogged < GameLoop.MAX_ERROR_LOGS) {
        this.errorsLogged++;
        console.error(`[GameLoop] ${label} threw (frame kept alive):`, err);
        if (this.errorsLogged === GameLoop.MAX_ERROR_LOGS) console.error("[GameLoop] further errors suppressed");
      }
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = this.now();
    this.acc = 0;
    const frame = () => {
      if (!this.running) return;
      const t = this.now();
      let dt = t - this.last;
      this.last = t;
      if (dt > 250) dt = 250; // clamp huge gaps (tab switch)
      this.acc += dt;
      let ticks = 0;
      while (this.acc >= TICK_MS && ticks < this.maxTicksPerFrame) {
        this.guard("onTick", this.onTick);
        this.acc -= TICK_MS;
        ticks++;
      }
      if (ticks === this.maxTicksPerFrame) this.acc = 0; // drop backlog
      this.guard("onRender", () => this.onRender(this.acc / TICK_MS));
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  /** Drive N ticks synchronously (for tests / headless replay). */
  stepTicks(n: number): void { for (let i = 0; i < n; i++) this.onTick(); }
}
