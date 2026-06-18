// Build-time: parse every casts/data/*.txt into JSON, report any grammar failures, and
// tally the tagged-node forms (member/global/call) so we know the expression surface.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDataFile, type Lingo } from "../src/data/lingo.ts";
import { Registry } from "../src/data/registry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(here, "../../casts/data");
const OUT_DIR = join(here, "../src/generated");

function walk(v: Lingo, f: (v: Lingo) => void): void {
  f(v);
  if (Array.isArray(v)) v.forEach((x) => walk(x, f));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) walk((v as any)[k], f);
}

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".txt"));
// scr_* (cutscene DSL) and tlk_* (tileset key) have their own grammars, parsed elsewhere.
const SEPARATE = (f: string) => f.startsWith("scr_") || f.startsWith("tlk_");
const out: Record<string, { header: any; data: any }> = {};
const fails: Array<{ file: string; err: string }> = [];
const separate: string[] = [];
const tags = { member: 0, global: 0, call: 0 };
const globals = new Set<string>();
const calls = new Set<string>();

for (const f of files) {
  if (SEPARATE(f)) { separate.push(f); continue; }
  const src = readFileSync(join(DATA_DIR, f), "utf8");
  try {
    const parsed = parseDataFile(src);
    out[f.replace(/\.txt$/, "")] = parsed;
    walk(parsed.data, (v) => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if ("$member" in v) tags.member++;
        if ("$global" in v) { tags.global++; globals.add((v as any).$global); }
        if ("$call" in v) { tags.call++; calls.add((v as any).$call); }
      }
    });
  } catch (e) {
    fails.push({ file: f, err: (e as Error).message });
  }
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "data.json"), JSON.stringify(out, null, 0));

const lingoCount = files.length - separate.length;
console.log(`parsed ${lingoCount - fails.length}/${lingoCount} Lingo data records (${separate.length} scr_/tlk_ use separate grammars)`);
console.log(`tagged nodes: member=${tags.member} global=${tags.global} call=${tags.call}`);
console.log(`globals: ${[...globals].join(", ")}`);
console.log(`calls: ${[...calls].join(", ")}`);
if (fails.length) {
  console.log(`\nFAILURES (${fails.length}):`);
  for (const { file, err } of fails.slice(0, 20)) console.log(`  ${file}: ${err}`);
  process.exit(1);
}

// Integration: build the registry and resolve every actor (#inherit + #attack).
const reg = new Registry(out);
const actors = reg.names("actor");
let resolved = 0, withAttack = 0, brokenInherit = 0;
for (const a of actors) {
  const r = reg.resolveActor(a);
  if (!r) continue;
  resolved++;
  if (r["attack"] && typeof r["attack"] === "object") withAttack++;
  // an inherit that didn't resolve leaves the raw symbol reachable; check chain integrity
  const inh = r["inherit"];
  if (typeof inh === "string" && !reg.raw("actor", inh)) brokenInherit++;
}
console.log(`registry: resolved ${resolved}/${actors.length} actors; ${withAttack} have #attack; ${brokenInherit} reference a missing #inherit parent`);
