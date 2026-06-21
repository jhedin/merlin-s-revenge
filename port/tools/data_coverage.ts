// Data-coverage scanner: for every property key used across the actor data (top-level + #attack.*),
// check whether the port source references it at all. NEVER-referenced keys are candidate gaps (a data
// property the engine ignores). Referenced keys still need a semantic check (a key can be read but
// mis-handled, e.g. #naturalRanged) — that's the per-actor agent pass; this is the cheap first cut.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const SRC = join(here, "../src");
const data = JSON.parse(readFileSync(join(SRC, "generated/data.json"), "utf8")) as Record<string, any>;

// concat all port source (excluding generated) into one haystack
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "generated") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}
const haystack = walk(SRC).map((f) => readFileSync(f, "utf8")).join("\n");

// collect (key -> {actors using it, isAttack}) across all act_ records
const keyActors = new Map<string, Set<string>>();
const attackKeys = new Set<string>();
for (const [name, rec] of Object.entries(data)) {
  if (!name.startsWith("act_")) continue;
  const d = rec?.data; if (!d || typeof d !== "object") continue;
  for (const k of Object.keys(d)) {
    if (k === "attack" && d.attack && typeof d.attack === "object") {
      for (const ak of Object.keys(d.attack)) { attackKeys.add(ak); (keyActors.get("attack." + ak) ?? keyActors.set("attack." + ak, new Set()).get("attack." + ak)!).add(name.slice(4)); }
    } else {
      (keyActors.get(k) ?? keyActors.set(k, new Set()).get(k)!).add(name.slice(4));
    }
  }
}

// a key is "referenced" if its bareword appears in the port source (quoted, dotted, or bracketed)
const referenced = (key: string): boolean => {
  const bare = key.replace(/^attack\./, "");
  return new RegExp(`["'.\\[]${bare}\\b`).test(haystack);
};

const unused: { key: string; n: number; sample: string[] }[] = [];
const used: string[] = [];
for (const [key, actors] of [...keyActors].sort((a, b) => b[1].size - a[1].size)) {
  if (referenced(key)) used.push(key);
  else unused.push({ key, n: actors.size, sample: [...actors].slice(0, 4) });
}

console.log(`=== property keys: ${keyActors.size} distinct (${used.length} referenced, ${unused.length} NOT referenced in port src) ===\n`);
console.log("UNUSED (present in data, no reference in port source — candidate gaps):");
for (const u of unused.sort((a, b) => b.n - a.n)) console.log(`  ${u.key.padEnd(28)} ${String(u.n).padStart(4)} actors   e.g. ${u.sample.join(", ")}`);
