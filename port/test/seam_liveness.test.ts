// Seam liveness (AUDIT-CHARTER §4, inter-component edition): every send("literal") must resolve to a
// handler (some component's `static handles`) or a registered archetype default. A send that resolves to
// nothing is a silent no-op — the logic-layer twin of "bundled but never drawn" (it's how the GMG HUD
// toggle icon shipped dead: getGmgOn/getGmgCollected were emitted but absent from PlayerControl.handles).
// This is a static guard built from the seam-census; it fails the moment anyone fires an unhandled event.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";

function allSrc(): { path: string; text: string }[] {
  const root = resolve(process.cwd(), "src"); const out: { path: string; text: string }[] = [];
  const walk = (d: string) => { for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== "generated") walk(p); }
    else if (e.endsWith(".ts")) out.push({ path: p, text: readFileSync(p, "utf8") });
  }};
  walk(root); return out;
}

const files = allSrc();
const blob = files.map(f => f.text).join("\n");

// handlers: every name inside any `static handles = [ ... ]`
const handlers = new Set<string>();
for (const m of blob.matchAll(/static\s+handles\s*=\s*\[([\s\S]*?)\]/g))
  for (const s of m[1]!.matchAll(/"([^"]+)"/g)) handlers.add(s[1]!);

// legitimate no-handler targets: any key in a `defaults: { ... }` archetype map OR the shared
// `const DEFAULTS = { ... }` object that the archetypes spread in. A registered default is the ONLY
// legitimate reason a literal send has no handler (e.g. getAlpha: undefined = always opaque).
const defaults = new Set<string>();
for (const m of blob.matchAll(/(?:defaults\s*:|const\s+DEFAULTS\s*=)\s*\{([\s\S]*?)\}/g))
  for (const s of m[1]!.matchAll(/(\w+)\s*:/g)) defaults.add(s[1]!);

// known-intentional no-op stubs (top-down port doesn't implement side-scroll collision reactions).
const ALLOWED_NOOP = new Set([
  "collisionWallLeft", "collisionWallRight", "collisionCeiling",
  "collisionPlatform", "collisionNoPlatform",
]);

// emitters: every send("literal").  (Codebase has zero computed-string sends — assert that stays true.)
type Emit = { ev: string; where: string };
const emits: Emit[] = [];
let dynamic = 0;
for (const f of files) f.text.split("\n").forEach((line, i) => {
  for (const m of line.matchAll(/\bsend\(\s*"([^"]+)"/g))
    emits.push({ ev: m[1]!, where: `${f.path}:${i + 1}` });
  // a send( whose first arg is NOT a string literal and NOT the dispatcher's own `msg` param
  if (/\bsend\(\s*[`a-zA-Z_$]/.test(line) && !/\bsend\(\s*"/.test(line)
      && !/dispatch\.ts/.test(f.path)) dynamic++;
});

describe("seam liveness: every send(\"literal\") has a handler or an archetype default", () => {
  it("no dead sends", () => {
    const dead = emits.filter(e =>
      !handlers.has(e.ev) && !defaults.has(e.ev) && !ALLOWED_NOOP.has(e.ev));
    expect(dead.map(d => `${d.ev} @ ${d.where}`)).toEqual([]);
  });
  it("no computed-string sends sneak in (would defeat this guard)", () => {
    expect(dynamic).toBe(0); // if this ever fails, extend the parser before trusting the dead-send check
  });
});
