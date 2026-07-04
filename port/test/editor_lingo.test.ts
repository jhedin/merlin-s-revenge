import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parse, serialize, deepEqual, propGet, hasTrailingJunk, type LingoValue } from "../src/editor/lingo";

const MAPS_DIR = join(__dirname, "../public/assets/maps");

describe("lingo serializer — primitives & structure", () => {
  const rt = (src: string) => serialize(parse(src));

  it("ints vs floats keep their literal form", () => {
    expect(rt("12")).toBe("12");
    expect(rt("0.0625")).toBe("0.0625");
    expect(rt("-3")).toBe("-3");
  });

  it("symbols, strings, atoms", () => {
    expect(rt("#backgroundPassive")).toBe("#backgroundPassive");
    expect(rt("#none")).toBe("#none");
    expect(rt('"hello world"')).toBe('"hello world"');
    expect(rt("VOID")).toBe("VOID");
  });

  it("point() calls normalize spacing", () => {
    expect(rt("point(3,4)")).toBe("point(3, 4)");
    expect(rt("point(18, 9)")).toBe("point(18, 9)");
  });

  it("lists vs prop-lists, including empties", () => {
    expect(rt("[1, 2, 3]")).toBe("[1, 2, 3]");
    expect(rt("[]")).toBe("[]"); // empty list
    expect(rt("[:]")).toBe("[:]"); // empty prop-list
    expect(rt("[#a: 1,#b: 2]")).toBe("[#a: 1, #b: 2]"); // normalized spacing
    expect(rt("[[1, 2], [3, 4]]")).toBe("[[1, 2], [3, 4]]"); // nested lists (tile rows)
  });

  it("an empty list is a list, not a prop-list (so #rooms: [] round-trips)", () => {
    const v = parse("[#rooms: []]");
    const rooms = propGet(v, "rooms")!;
    expect(rooms.t).toBe("list");
    expect((rooms as Extract<LingoValue, { t: "list" }>).items.length).toBe(0);
  });
});

const allTxt = readdirSync(MAPS_DIR).filter((f) => f.endsWith(".txt"));

describe("lingo round-trip — every bundled map (value identity)", () => {
  it(`covers all bundled maps`, () => {
    expect(allTxt.length).toBeGreaterThan(40);
  });

  for (const f of allTxt) {
    it(`round-trips ${f}`, () => {
      const src = readFileSync(join(MAPS_DIR, f), "utf8");
      const v1 = parse(src);
      const out = serialize(v1);
      const v2 = parse(out);
      // value identity: re-parsing the serialized form yields the same structure
      expect(deepEqual(v1, v2)).toBe(true);
      // and it's idempotent: serializing the re-parse is byte-identical to the first serialize
      expect(serialize(v2)).toBe(out);
    });
  }
});

describe("trailing-junk maps load leniently and re-save clean (like the game's parseLingo)", () => {
  // A few bundled maps carry junk after a valid `[#map: …]`. The game ignores it; so do we — and the
  // serialized form drops it, so opening + saving such a map repairs it.
  it("at least one map has trailing junk, and serialization strips it", () => {
    const junkMaps = allTxt.filter((f) => hasTrailingJunk(readFileSync(join(MAPS_DIR, f), "utf8")));
    expect(junkMaps.length).toBeGreaterThan(0);
    for (const f of junkMaps) {
      const cleaned = serialize(parse(readFileSync(join(MAPS_DIR, f), "utf8")));
      expect(hasTrailingJunk(cleaned)).toBe(false); // re-saving is clean
    }
  });
});
