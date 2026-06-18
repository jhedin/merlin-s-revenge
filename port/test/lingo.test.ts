import { describe, it, expect } from "vitest";
import { parseLingo, parseDataFile } from "@/data/lingo";

describe("lingo parser: value forms", () => {
  it("proplist with mixed value types", () => {
    expect(parseLingo('[#objType: #objCPUCharacter, #energy: 1200, #name: "blackOrc"]')).toEqual({
      objType: "#objCPUCharacter", energy: 1200, name: "blackOrc",
    });
  });
  it("lists, list-of-lists, empties", () => {
    expect(parseLingo("[#warrior, #archer]")).toEqual(["#warrior", "#archer"]);
    expect(parseLingo("[[#teamMembers, #teamBuildings]]")).toEqual([["#teamMembers", "#teamBuildings"]]);
    expect(parseLingo("[]")).toEqual([]);
    expect(parseLingo("[:]")).toEqual({});
  });
  it("numbers incl. leading-dot and negatives", () => {
    expect(parseLingo("[#a: .25, #b: -16, #c: 0.75, #d: -2]")).toEqual({ a: 0.25, b: -16, c: 0.75, d: -2 });
  });
  it("point / rgb / rect", () => {
    expect(parseLingo("point(0,-2)")).toEqual({ x: 0, y: -2 });
    expect(parseLingo("rgb(0,255,255)")).toEqual({ r: 0, g: 255, b: 255 });
    expect(parseLingo("rect(-320,-320,320,320)")).toEqual({ left: -320, top: -320, right: 320, bottom: 320 });
  });
  it("tagged nodes: member / global / call, incl. nested in point", () => {
    expect(parseLingo('member("arcticBlast_scroll", "gfx")')).toEqual({ $member: ["arcticBlast_scroll", "gfx"] });
    expect(parseLingo("gGameObjectLayer")).toEqual({ $global: "gGameObjectLayer" });
    expect(parseLingo("point(random(450), 300)")).toEqual({ x: { $call: "random", args: [450] }, y: 300 });
  });
  it("booleans", () => {
    expect(parseLingo("[#a: true, #b: false]")).toEqual({ a: true, b: false });
  });
});

describe("lingo parser: data file header/payload split", () => {
  it("separates the header proplist from the payload", () => {
    const f = parseDataFile('[#name: "act_x", #type: #field]\n[#objType: #objPowerUp, #inherit: #weapon]');
    expect(f.header).toEqual({ name: "act_x", type: "#field" });
    expect(f.data).toEqual({ objType: "#objPowerUp", inherit: "#weapon" });
  });
  it("nested attack record", () => {
    const f = parseDataFile(
      '[#name:"act_archerBow",#type:#field]\n' +
      '[#objType:#objPowerUp,#attack:[#bullet:#archerArrow,#cooldown:10,#targetRoles:[[#teamMembers,#teamBuildings]]]]',
    );
    expect((f.data as any).attack).toEqual({
      bullet: "#archerArrow", cooldown: 10, targetRoles: [["#teamMembers", "#teamBuildings"]],
    });
  });
});
