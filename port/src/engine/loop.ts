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

  constructor(
    private readonly onTick: () => void,
    private readonly onRender: (alpha: number) => void,
    private readonly now: () => number = () => performance.now(),
  ) {}

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
        this.onTick();
        this.acc -= TICK_MS;
        ticks++;
      }
      if (ticks === this.maxTicksPerFrame) this.acc = 0; // drop backlog
      this.onRender(this.acc / TICK_MS);
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
