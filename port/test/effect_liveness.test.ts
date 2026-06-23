// Liveness lint (AUDIT-CHARTER §4): every bundled effect-strip FAMILY must be referenced by some render
// path, else it's bundled-but-never-drawn — the failure mode where 17 *_explode strips shipped but drew
// ZERO frames until someone noticed. This is a static guard: if a family is in assets.json but no src file
// requests it, an effect silently renders nothing. Add a row when a new effect-strip family is bundled.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import assets from "../src/generated/assets.json";

// concat every src/*.ts (excluding the generated index + tests) — the render/logic that requests strips.
function allSrc(): string {
  const root = resolve(process.cwd(), "src");
  let out = "";
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { if (e !== "generated") walk(p); }
      else if (e.endsWith(".ts")) out += readFileSync(p, "utf8");
    }
  };
  walk(root);
  return out;
}

const keys = new Set<string>([...Object.keys(assets.anims ?? {}), ...Object.keys((assets as any).members ?? {})]);

// family: how to detect its bundled strips, and the token a render path must contain to request them
// (references are dynamic — `${char}_explode`, `spellIcons_${name}` — so we assert the FAMILY token, not each key).
const FAMILIES: { name: string; match: (k: string) => boolean; token: string }[] = [
  { name: "explosion strips (*_explode)", match: (k) => k.endsWith("_explode"), token: "_explode" },
  { name: "charge orb (spell_charge)", match: (k) => k.startsWith("spell_charge"), token: "spell_charge" },
  { name: "summon-tier faces (spellIcons_*)", match: (k) => k.startsWith("spellIcons_"), token: "spellIcons_" },
  { name: "pickup captions (*_writing)", match: (k) => k.endsWith("_writing"), token: "_writing" },
];

describe("effect liveness: every bundled effect-strip family is referenced by a render path", () => {
  const src = allSrc();
  for (const f of FAMILIES) {
    it(`${f.name} is requested by some render path (not bundled-but-never-drawn)`, () => {
      const bundled = [...keys].filter(f.match);
      expect(bundled.length).toBeGreaterThan(0); // the family IS bundled (else this row is stale)
      expect(src.includes(f.token)).toBe(true);   // ...and some src file requests it
    });
  }
});
