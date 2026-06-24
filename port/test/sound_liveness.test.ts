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

// Assets the ORIGINAL itself ships but never triggers — dead in the source cast too. We mirror the original
// faithfully: bundle them for completeness (the wav exists in the extracted data) but play nothing. Exempt
// from the "must be requestable" rule, with the reason recorded so a NEW dead bundle still fails loudly.
//  - spell_charge: the charge ORB is an animation (act_spell #character:#spell); objSpell plays a sound only
//    on release (releaseSound) and explode (explodeSound), NEVER on charge — so the spell_charge WAV is dead.
const ORIGINAL_DEAD = new Set(["spell_charge"]);

const bundled = [
  ...Object.keys((assets as any).sounds ?? {}).map((k) => ["sfx", k] as const),
  ...Object.keys((assets as any).music ?? {}).map((k) => ["music", k] as const),
];

describe("sound liveness: every bundled SFX/music is requestable", () => {
  for (const [kind, name] of bundled) {
    if (ORIGINAL_DEAD.has(name)) {
      it.skip(`${kind} "${name}" is an original-dead asset (shipped, never played — like the source cast)`, () => {});
      continue;
    }
    it(`${kind} "${name}" is referenced by a play path or data field`, () => {
      expect(referenced.has(name)).toBe(true);
    });
  }
});
