// Counter (casts/general_functions: CounterNew/Counter/CounterReset/CounterOnce) — the Lingo counter
// primitive modWeaponManager uses for per-weapon cooldowns. A counter has tim:[lo,hi], inc, theCount,
// fin. CounterNew seeds tim:[1,10], inc:1, then CounterReset (theCount=tim[1] for inc>0, fin=false).
// addCooldownCounter overrides tim[2]=cooldown and inc=the skill stat, and starts fin=true (ready).
//
// Counter(): if tim[1]==tim[2] -> instantly fin (a cooldown<=1 weapon, e.g. merlinSword cooldown:0
// gives tim:[1,0]). If already fin -> reset+loop. Else add inc; clamp at tim[1] (low) or tim[2] (high)
// and latch fin. CounterOnce(): advance only while NOT fin (no looping). updateCooldowns calls
// CounterOnce on every weapon's counter each tick — so recovery ≈ ceil((cooldown-1)/inc) frames.

export class Counter {
  lo = 1;
  hi = 10;
  inc = 1;
  count = 0;
  fin = false;
  looped = false;

  constructor(hi = 10, inc = 1) {
    this.hi = hi; this.inc = inc;
    this.reset();
  }

  // CounterReset(theC): theCount = tim[whichEnd]; default end from sign of inc (inc>0 -> low end).
  reset(): void {
    const whichEndLow = this.inc >= 0; // VarMoreLess(0,inc): inc>0 -> 1 (low); inc<0 -> 2 (high)
    this.count = whichEndLow ? this.lo : this.hi;
    this.fin = false; this.looped = false;
  }

  // Counter(theC): one advance step.
  private step(): void {
    if (this.lo === this.hi) { this.fin = true; return; }   // a counter going nowhere -> instantly fin
    if (this.fin) { this.reset(); this.looped = true; return; }
    this.looped = false;
    this.count += this.inc;
    if (this.count <= this.lo) { this.count = this.lo; this.fin = true; }
    else if (this.count >= this.hi) { this.count = this.hi; this.fin = true; }
  }

  // CounterOnce(theC): iterate until fin, then stop (no looping). This is what updateCooldowns calls.
  once(): void { if (!this.fin) this.step(); }

  save(): { hi: number; inc: number; count: number; fin: boolean } {
    return { hi: this.hi, inc: this.inc, count: this.count, fin: this.fin };
  }
  static restore(s: { hi: number; inc: number; count: number; fin: boolean }): Counter {
    const c = new Counter(s.hi, s.inc);
    c.count = s.count; c.fin = s.fin;
    return c;
  }
}
