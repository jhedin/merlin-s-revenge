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
