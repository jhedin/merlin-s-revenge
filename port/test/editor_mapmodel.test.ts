import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { EditorMap } from "../src/editor/mapModel";
import { parse, serialize, deepEqual } from "../src/editor/lingo";

const read = (id: string) => readFileSync(join(__dirname, `../public/assets/maps/${id}.txt`), "utf8");

describe("EditorMap — read", () => {
  it("reads header + layers + rooms from a real map", () => {
    const m = EditorMap.load(read("Scarlet_Castle"));
    expect(m.roomSize).toEqual({ x: 18, y: 9 });
    expect(m.mapSize.x).toBeGreaterThanOrEqual(1);
    expect(m.layerDefs.map((d) => d.name)).toEqual(["backgroundPassive", "backgroundActive", "objects"]);
    expect(m.layerDefs[0]!.tileSet).toBe("merlinOpenPassive");
    expect(m.roomNums.length).toBeGreaterThan(0);
    const first = m.roomNums[0]!;
    const g = m.grid(first, "backgroundPassive");
    expect(g.length).toBe(9); // roomSize.y rows
    expect(g[0]!.length).toBe(18); // roomSize.x cols
  });

  it("#endRoom #none reads as null", () => {
    const m = EditorMap.load(read("Scarlet_Castle"));
    expect(m.endRoom).toBeNull();
  });
});

describe("EditorMap — mutate in place", () => {
  it("setTile changes exactly one cell and round-trips", () => {
    const src = read("Scarlet_Castle");
    const m = EditorMap.load(src);
    const room = m.roomNums[0]!;
    const before = m.grid(room, "backgroundActive");
    const r = 3, c = 5;
    const old = m.tile(room, "backgroundActive", r, c)!;
    const prev = m.setTile(room, "backgroundActive", r, c, old + 7);
    expect(prev).toBe(old);
    expect(m.tile(room, "backgroundActive", r, c)).toBe(old + 7);

    // only that one cell differs from the original grid
    const after = m.grid(room, "backgroundActive");
    let diffs = 0;
    for (let i = 0; i < after.length; i++)
      for (let j = 0; j < after[i]!.length; j++)
        if (after[i]![j] !== before[i]![j]) diffs++;
    expect(diffs).toBe(1);

    // the serialized output re-parses to the edited value (value identity)
    const out = m.serialize();
    expect(deepEqual(parse(out), m.root)).toBe(true);
    // and the edit survives a full reload
    const reloaded = EditorMap.load(out);
    expect(reloaded.tile(room, "backgroundActive", r, c)).toBe(old + 7);
  });

  it("serializing an unedited map equals the clean serialization of its source", () => {
    const src = read("Scarlet_Castle");
    const m = EditorMap.load(src);
    expect(m.serialize()).toBe(serialize(parse(src)));
  });
});

describe("EditorMap — structural edits", () => {
  it("addRoom creates a BLANK room (all layers 0, like the original) and round-trips", () => {
    const m = EditorMap.load(read("AutoSummonTest"));
    const newNum = Math.max(...m.roomNums) + 1;
    expect(m.hasRoom(newNum)).toBe(false);
    m.addRoom(newNum);
    expect(m.hasRoom(newNum)).toBe(true);
    // every layer (incl. passive) is uniformly 0 — the original never grass-fills; correct dimensions
    const passive = m.grid(newNum, "backgroundPassive");
    expect(passive.length).toBe(m.roomSize.y);
    expect(passive[0]!.length).toBe(m.roomSize.x);
    expect(passive.flat().every((v) => v === 0)).toBe(true);
    expect(m.grid(newNum, "objects").flat().every((v) => v === 0)).toBe(true);
    // round-trips and survives a reload
    const reloaded = EditorMap.load(m.serialize());
    expect(reloaded.hasRoom(newNum)).toBe(true);
    expect(reloaded.tile(newNum, "backgroundPassive", 0, 0)).toBe(0);
  });

  it("addRoom is a no-op if the room already exists", () => {
    const m = EditorMap.load(read("AutoSummonTest"));
    const existing = m.roomNums[0]!;
    const count = m.roomNums.length;
    m.addRoom(existing);
    expect(m.roomNums.length).toBe(count);
  });

  it("removeRoom deletes it", () => {
    const m = EditorMap.load(read("AutoSummonTest"));
    const target = m.roomNums[m.roomNums.length - 1]!;
    m.removeRoom(target);
    expect(m.hasRoom(target)).toBe(false);
    expect(EditorMap.load(m.serialize()).hasRoom(target)).toBe(false);
  });

  it("createBlank builds a dense blank map that round-trips", () => {
    const m = EditorMap.createBlank(3, 2, 18, 9);
    expect(m.mapSize).toEqual({ x: 3, y: 2 });
    expect(m.roomSize).toEqual({ x: 18, y: 9 });
    expect(m.roomNums.length).toBe(6); // dense 3×2
    expect(m.layerDefs.map((d) => d.name)).toEqual(["backgroundPassive", "backgroundActive", "objects"]);
    expect(m.grid(1, "backgroundPassive").flat().every((v) => v === 0)).toBe(true);
    expect(EditorMap.load(m.serialize()).roomNums.length).toBe(6);
  });

  it("setRoomSize pads/crops every room grid and round-trips", () => {
    const m = EditorMap.load(read("AutoSummonTest")); // 18×9
    m.setRoomSize(20, 10);
    expect(m.roomSize).toEqual({ x: 20, y: 10 });
    let g = m.grid(m.roomNums[0]!, "backgroundPassive");
    expect(g.length).toBe(10); expect(g[0]!.length).toBe(20);
    m.setRoomSize(5, 4); // crop
    g = m.grid(m.roomNums[0]!, "backgroundPassive");
    expect(g.length).toBe(4); expect(g[0]!.length).toBe(5);
    expect(EditorMap.load(m.serialize()).roomSize).toEqual({ x: 5, y: 4 });
  });

  it("setMapSize renumbers rooms by position and stays dense", () => {
    const m = EditorMap.load(read("AutoSummonTest")); // 3×4 = 12 rooms
    m.setTile(1, "backgroundActive", 0, 0, 777); // tag the (1,1) room
    m.setMapSize(4, 4); // grow cols 3→4
    expect(m.mapSize).toEqual({ x: 4, y: 4 });
    expect(m.roomNums.length).toBe(16); // dense 4×4
    expect(m.tile(1, "backgroundActive", 0, 0)).toBe(777); // (1,1) still num 1, tile preserved
  });

  it("setLayerTileset rewrites the layer's tileset in #layerDefinitions and round-trips", () => {
    const m = EditorMap.load(read("Scarlet_Castle"));
    expect(m.layerDefs[0]!.tileSet).toBe("merlinOpenPassive");
    m.setLayerTileset("backgroundPassive", "merlin4Passive");
    expect(m.layerDefs[0]!.tileSet).toBe("merlin4Passive");
    expect(EditorMap.load(m.serialize()).layerDefs[0]!.tileSet).toBe("merlin4Passive");
  });

  it("remapLayer applies an index remap across all rooms", () => {
    const m = EditorMap.load(read("Scarlet_Castle"));
    m.remapLayer("backgroundPassive", (n) => (n > 0 ? n + 100 : 0));
    for (const num of m.roomNums) {
      expect(m.grid(num, "backgroundPassive").flat().every((v) => v === 0 || v >= 101)).toBe(true);
    }
    // other layers untouched
    const room = m.roomNums[0]!;
    expect(m.grid(room, "objects").flat().some((v) => v < 100 || v === 0)).toBe(true);
  });

  it("setStartRoom / setEndRoom update the header (point or #none)", () => {
    const m = EditorMap.load(read("AutoSummonTest"));
    m.setStartRoom(2, 3);
    expect(m.startRoom).toEqual({ x: 2, y: 3 });
    m.setEndRoom({ x: 3, y: 4 });
    expect(m.endRoom).toEqual({ x: 3, y: 4 });
    m.setEndRoom(null);
    expect(m.endRoom).toBeNull();
    // changes persist through a round-trip
    const r = EditorMap.load(m.serialize());
    expect(r.startRoom).toEqual({ x: 2, y: 3 });
    expect(r.endRoom).toBeNull();
  });
});
