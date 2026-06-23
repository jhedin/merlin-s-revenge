import { describe, it, expect } from "vitest";
import { parseCutscene } from "@/data/cutscene";

const src = `[#name: "scr_x", #type: #field]
characters

#merlin - m
#tv - t
#ulin - u

lines

setStage
m at 300
m turnToFace t
backgroundColourTo rgb(22,92,7)

m: Ahhh, tv...

u enterStageRight 200
`;

describe("cutscene DSL parser", () => {
  const cut = parseCutscene(src);
  it("parses the character alias table", () => {
    expect(cut.chars).toEqual({ m: "#merlin", t: "#tv", u: "#ulin" });
  });
  it("parses commands (global and actor-scoped) and dialogue", () => {
    const verbs = cut.steps.map((s) => s.kind === "cmd" ? s.verb : "say:" + s.text);
    expect(verbs).toEqual([
      "setStage", "at", "turnToFace", "backgroundColourTo", "say:Ahhh, tv...", "enterStageRight",
    ]);
    const at = cut.steps[1];
    expect(at).toMatchObject({ kind: "cmd", actor: "m", verb: "at", args: ["300"] });
    const say = cut.steps[4];
    expect(say).toMatchObject({ kind: "say", alias: "m", text: "Ahhh, tv..." });
  });
  it("treats dialogue text with a colon as opaque", () => {
    const c = parseCutscene("characters\n#u - u\nlines\nu: Merlin: you are out of shape.");
    expect(c.steps[0]).toMatchObject({ kind: "say", alias: "u", text: "Merlin: you are out of shape." });
  });
});

describe("cutscene DSL: faithful interpretLineArgs (typed args)", () => {
  it("interprets rgb / point / bare-number / symbol / actor / text / sound args", () => {
    const c = parseCutscene(`characters
#merlin - m
#ulin - u
lines
backgroundColourTo rgb(22,92,7)
m at 300
m walkTo point(120,40)
m goMode #look
m turnToFace u
showTitle You Got Wasted!
wait 60
playMusic #electronic_merlin_v1_02 200
`);
    const cmd = (i: number) => c.steps[i] as Extract<typeof c.steps[number], { kind: "cmd" }>;
    expect(cmd(0).arg).toMatchObject({ kind: "rgb", r: 22, g: 92, b: 7 });
    expect(cmd(1).arg).toMatchObject({ kind: "number", n: 300 });        // at -> interpretLoc bare x
    expect(cmd(2).arg).toMatchObject({ kind: "point", x: 120, y: 40 });   // walkTo point
    expect(cmd(3).arg).toMatchObject({ kind: "symbol", sym: "#look" });   // goMode symbol
    expect(cmd(4).arg).toMatchObject({ kind: "actor", alias: "u" });      // turnToFace actor
    expect(cmd(5).arg).toMatchObject({ kind: "text", text: "You Got Wasted!" }); // showTitle raw text
    expect(cmd(6).arg).toMatchObject({ kind: "number", n: 60 });          // wait frame count
    expect(cmd(7).arg).toMatchObject({ kind: "sound", member: "electronic_merlin_v1_02", volume: 200 });
  });

  it("speakLine (`:`) wins over a verb; word2-command when word1 is a character", () => {
    const c = parseCutscene(`characters\n#merlin - m\nlines\nm: hi\nm goWastedMode\n`);
    expect(c.steps[0]).toMatchObject({ kind: "say", alias: "m", text: "hi" });
    expect(c.steps[1]).toMatchObject({ kind: "cmd", actor: "m", verb: "goWastedMode" });
  });

  // Lingo matches aliases case-insensitively; the shipped scripts mix `m:`/`M:` and `T turnToFace m`. Before
  // the fix an uppercase `M:` line was silently dropped (a whole Merlin line in stones1) and `T turnToFace m`
  // fell through to a junk global verb. resolveAlias normalizes to the canonical registered key.
  it("matches a speaker/actor alias CASE-INSENSITIVELY (canonical key preserved)", () => {
    const c = parseCutscene(`characters\n#merlin - m\n#tv - t\nlines\nM: Where might I find this spell?\nT turnToFace M\n`);
    expect(c.steps[0]).toMatchObject({ kind: "say", alias: "m", text: "Where might I find this spell?" });
    expect(c.steps[1]).toMatchObject({ kind: "cmd", actor: "t", verb: "turnToFace" });
    expect((c.steps[1] as Extract<typeof c.steps[number], { kind: "cmd" }>).arg).toMatchObject({ kind: "actor", alias: "m" });
  });
});
