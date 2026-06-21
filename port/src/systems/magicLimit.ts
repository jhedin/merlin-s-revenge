// MagicLimitMaster (casts/master_objects/magicLimitMaster.txt): a trivial holder for the magic
// charge-limiter percentage. `gMagicLimit` is the global default (100 — "no limit"). objMagicLimit
// region markers call set(N) on spawn and setDefault() on room-leave (room-scoped, plan §c.2/§g.5).
//
// The limiter is READ by charge.ts (calcAttackChargeMax): a #limitMagic spell's charge ceiling is
// scaled by magicLimit/100. So a magicLimit25 region dims every limitMagic spell's max to 25% while
// you're in that room; leaving restores 100.

export const MAGIC_LIMIT_DEFAULT = 100; // gMagicLimit (the original's global default)

export class MagicLimitMaster {
  private limit = MAGIC_LIMIT_DEFAULT;       // pMagicLimit
  private def = MAGIC_LIMIT_DEFAULT;         // gMagicLimit

  getMagicLimit(): number { return this.limit; }
  get(): number { return this.limit; }                       // alias used by charge.ts
  setMagicLimit(n: number): void { this.limit = n; }
  set(n: number): void { this.limit = n; }                   // alias used by objMagicLimit marker
  setMagicLimitToDefault(): void { this.limit = this.def; }
  setDefault(): void { this.limit = this.def; }              // room-leave reset
  setDefaultValue(n: number): void { this.def = n; }
  reset(): void { this.def = MAGIC_LIMIT_DEFAULT; this.limit = MAGIC_LIMIT_DEFAULT; }
}
