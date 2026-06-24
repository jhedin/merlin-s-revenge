// Sound liveness (AUDIT-CHARTER §4, audio edition). Every bundled SFX/music in assets.json must be
// REQUESTABLE — referenced by a src play("X")/playMusic("X") literal, OR by a data sound field
// (#sound/#dieSound/#collectSound/... -> audio.play(actor.sound)), OR a data #musicName. A bundled sound
// nothing can trigger is the audio analog of the dead *_explode strips (build used to copy every .mp3,
// shipping 3 dead music tracks). A new dead bundle fails loudly.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import assets from "../src/generated/assets.json";
import data from "../src/generated/data.json";

function allSrc(): string {
  const root = resolve(process.cwd(), "src");
  let out = "";
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { if (e !== "generated") walk(p); }
      else if (e.endsWith(".ts")) out += readFileSync(p, "utf8");
    }
  };
  walk(root);
  return out;
}

// referenced names: src play()/playMusic() string literals ∪ every data field whose key mentions "sound" or
// "music" (the data-driven audio.play(actor.<x>) / playMusic paths).
const referenced = new Set<string>();
const src = allSrc();
for (const m of src.matchAll(/\b(?:play|playMusic)\(\s*"([^"]+)"/g)) referenced.add(m[1]!);
const walkData = (o: unknown): void => {
  if (Array.isArray(o)) { o.forEach(walkData); return; }
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string" && /sound|music/i.test(k)) referenced.add(v.replace(/^#/, ""));
      else walkData(v);
    }
  }
};
walkData(data);

const bundled = [
  ...Object.keys((assets as any).sounds ?? {}).map((k) => ["sfx", k] as const),
  ...Object.keys((assets as any).music ?? {}).map((k) => ["music", k] as const),
];

describe("sound liveness: every bundled SFX/music is requestable", () => {
  for (const [kind, name] of bundled) {
    it(`${kind} "${name}" is referenced by a play path or data field`, () => {
      expect(referenced.has(name)).toBe(true);
    });
  }
});
