import { describe, it, expect } from "vitest";
import { Archetype, Component, type NextFn } from "@/engine/dispatch";
import { Pool } from "@/engine/pool";

class Life extends Component {
  static handles = ["isFinished"];
  done = false; resets = 0;
  override reset(): void { this.done = false; this.resets++; }
  isFinished(_n: NextFn): boolean { return this.done; }
}

describe("pool: recycles instances instead of allocating", () => {
  it("reuses released entities and calls reset", () => {
    const arch = new Archetype("bullet", [Life], { defaults: { isFinished: false }, pooled: true });
    const pool = new Pool(arch);
    const a = pool.acquire();
    expect(pool.stats.created).toBe(1);
    pool.release(a);
    expect(pool.stats.free).toBe(1);
    const b = pool.acquire();          // should reuse `a`
    expect(b).toBe(a);
    expect(pool.stats.created).toBe(1); // no new allocation
    expect(b.get(Life).resets).toBe(1); // reset ran on release
  });

  it("allocates only when the free list is empty", () => {
    const arch = new Archetype("b", [Life], { pooled: true });
    const pool = new Pool(arch);
    const a = pool.acquire(), b = pool.acquire();
    expect(a).not.toBe(b);
    expect(pool.stats.created).toBe(2);
  });
});
