// Parser for the cutscene DSL (scr_*.txt / cut_scenes/*). Two sections:
//   characters:  "#sym - alias"   (alias is a short handle used in the lines)
//   lines:       "alias: dialogue text"   OR   "[actor] verb args..."
// Verbs seen: setStage, at, enterStageRight/Left, exitStageRight, turnToFace, teleportInAt,
//             teleportOut, backgroundColourTo, lightsUp/Down, showTitle, wait.

export type CutStep =
  | { kind: "say"; alias: string; text: string }
  | { kind: "cmd"; actor?: string; verb: string; args: string[] };

export interface Cutscene {
  chars: Record<string, string>; // alias -> symbol
  steps: CutStep[];
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
      const say = /^(\w+):\s?(.*)$/.exec(line);
      if (say && chars[say[1]!] !== undefined) { steps.push({ kind: "say", alias: say[1]!, text: say[2]! }); continue; }
      const toks = line.split(/\s+/);
      if (toks.length >= 2 && chars[toks[0]!] !== undefined) {
        steps.push({ kind: "cmd", actor: toks[0]!, verb: toks[1]!, args: toks.slice(2) });
      } else {
        steps.push({ kind: "cmd", verb: toks[0]!, args: toks.slice(1) });
      }
    }
  }
  return { chars, steps };
}
