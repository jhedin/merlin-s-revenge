// Parser for the cutscene DSL (scr_*.txt / cut_scenes/*). Mirrors objScript's interpretLineCommand +
// interpretLineArgs (objScript.txt:152,248). Two sections:
//   characters:  "#sym - alias"   (alias is a short handle used in the lines)
//   lines:       "alias: dialogue text"   OR   "[actor] verb args..."
//
// interpretLineCommand: a line whose first word ends in ":" is dialogue (speakLine). Else, if word1 is a
// known character alias, word2 is the (actor-scoped) verb; otherwise word1 is a global verb.
// interpretLineArgs: each verb parses its remaining words into a typed arg — a value() of a
// point/rgb/symbol, raw text, or a sound member+volume. The Thespian re-interprets #key at display time.

export type CutArg =
  | { kind: "point"; x: number; y: number }   // interpretLoc target / propAt / teleportInAt
  | { kind: "number"; n: number }             // a bare x (walkTo 200) or a wait/flash count
  | { kind: "rgb"; r: number; g: number; b: number } // backgroundColourTo rgb(r,g,b)
  | { kind: "symbol"; sym: string }           // goMode #stand
  | { kind: "actor"; alias: string }          // turnToFace u / walkToPlayer / produceProp
  | { kind: "text"; text: string }            // showTitle raw text
  | { kind: "sound"; member: string; volume: number } // playSound/playMusic member [volume]
  | { kind: "none" };

export type CutStep =
  | { kind: "say"; alias: string; text: string }
  | { kind: "cmd"; actor?: string; verb: string; arg: CutArg; args: string[] };

export interface Cutscene {
  chars: Record<string, string>; // alias -> symbol
  steps: CutStep[];
}

// Verbs that take an actor name as their argument (turnToFace u, walkToPlayer m, produceProp ber).
const ACTOR_ARG_VERBS = new Set(["turnToFace", "walkToPlayer", "atPlayer", "produceProp"]);
// Verbs whose remaining words are raw display text (not value()'d).
const TEXT_ARG_VERBS = new Set(["showTitle"]);
// Verbs whose remaining words are a sound member + optional volume.
const SOUND_ARG_VERBS = new Set(["playSound", "playMusic"]);
// Verbs whose single remaining word is a count (frames / flash speed).
const NUMBER_ARG_VERBS = new Set(["wait", "backgroundColourRandomFlash", "walkScrollRight", "walkScrollLeft"]);
// Verbs whose argument is a location/x (interpretLoc): point or bare number.
const LOC_ARG_VERBS = new Set(["at", "walkTo", "teleportInAt", "propAt"]);

const num = (s?: string): number => { const m = /-?\d+(?:\.\d+)?/.exec(s ?? ""); return m ? Number(m[0]) : 0; };

/** interpretLineArgs: parse the verb's remaining words into a typed argument (objScript.txt:248). */
function interpretArg(verb: string, words: string[], chars: Record<string, string>): CutArg {
  const joined = words.join(" ");
  if (ACTOR_ARG_VERBS.has(verb)) {
    const a = words[0];
    return a !== undefined && chars[a] !== undefined ? { kind: "actor", alias: a } : { kind: "none" };
  }
  if (TEXT_ARG_VERBS.has(verb)) return { kind: "text", text: joined };
  if (SOUND_ARG_VERBS.has(verb)) {
    const member = words[0] ?? "";
    const volume = words.length > 1 ? num(words[1]) : 255;
    return { kind: "sound", member: member.replace(/^#/, ""), volume };
  }
  // rgb(r,g,b) — backgroundColourTo
  const rgb = /rgb\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/.exec(joined);
  if (rgb) return { kind: "rgb", r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  // point(x,y) — interpretLoc / propAt / teleportInAt
  const pt = /point\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/.exec(joined);
  if (pt) return { kind: "point", x: Number(pt[1]), y: Number(pt[2]) };
  if (LOC_ARG_VERBS.has(verb) || NUMBER_ARG_VERBS.has(verb)) {
    if (words.length === 0) return { kind: "none" };
    return { kind: "number", n: num(words[0]) };
  }
  // goMode #stand — a bare symbol
  if (words[0]?.startsWith("#")) return { kind: "symbol", sym: words[0] };
  if (words.length === 0) return { kind: "none" };
  // fallback: a leading number is a number arg, else a symbol/text token
  if (/^-?\d/.test(words[0]!)) return { kind: "number", n: num(words[0]) };
  return { kind: "symbol", sym: words[0]! };
}

export function parseCutscene(src: string): Cutscene {
  const chars: Record<string, string> = {};
  const steps: CutStep[] = [];
  let section = "";
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("[#name")) continue;
    if (line === "characters") { section = "characters"; continue; }
    if (line === "lines") { section = "lines"; continue; }
    if (section === "characters") {
      const m = /^(#\w+)\s*-\s*(\w+)$/.exec(line);
      if (m) chars[m[2]!] = m[1]!;
      continue;
    }
    if (section === "lines") {
      // interpretLineCommand: first word ends in ":" -> dialogue (speakLine). The speaker is word1's alias.
      const say = /^(\w+):\s?(.*)$/.exec(line);
      if (say && chars[say[1]!] !== undefined) { steps.push({ kind: "say", alias: say[1]!, text: say[2]! }); continue; }
      const toks = line.split(/\s+/);
      if (toks.length >= 2 && chars[toks[0]!] !== undefined) {
        // actor-scoped verb: word1 is the character, word2 the verb, rest the args.
        const verb = toks[1]!; const words = toks.slice(2);
        steps.push({ kind: "cmd", actor: toks[0]!, verb, arg: interpretArg(verb, words, chars), args: words });
      } else {
        // global verb: word1 is the verb.
        const verb = toks[0]!; const words = toks.slice(1);
        steps.push({ kind: "cmd", verb, arg: interpretArg(verb, words, chars), args: words });
      }
    }
  }
  return { chars, steps };
}
