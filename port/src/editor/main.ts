// Map editor bootstrap. Reuses the game's Assets (tilesets load up front) + mapList manifest, loads a map's
// .txt, and wires the DOM toolbar to an EditorApp. A route-less second Vite entry (editor.html).

import { Assets, mapList } from "../render/assets";
import { parseTileKey, type TileKey } from "../data/tlk";
import { EditorMap } from "./mapModel";
import { EditorApp, type Tool } from "./editorApp";
import { saveMap } from "./save";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function boot(): Promise<void> {
  const status = $("status");
  const assets = await Assets.load();

  const params = new URLSearchParams(location.search);
  const wantId = params.get("map") || assets.index.defaultMap || mapList[0]!.id;
  const meta = mapList.find((m) => m.id.toLowerCase() === wantId.toLowerCase()) ?? mapList[0]!;
  const text = await fetch("/assets/" + meta.file).then((r) => r.text());
  const map = EditorMap.load(text);

  // Every tileset's key (symbol↔tile-index), for the hover labels + the changeKeySet remap. Small text
  // files; load them all up front so the tileset picker can switch to any of them.
  const tileKeys: Record<string, TileKey> = {};
  await Promise.all(Object.entries(assets.index.tilesets).map(async ([sym, tmeta]) => {
    if (tmeta.keyFile) tileKeys[sym] = parseTileKey(await fetch("/assets/" + tmeta.keyFile).then((r) => r.text()));
  }));

  const app = new EditorApp({
    mapCanvas: $<HTMLCanvasElement>("mapCanvas"),
    paletteCanvas: $<HTMLCanvasElement>("paletteCanvas"),
    minimapCanvas: $<HTMLCanvasElement>("minimapCanvas"),
    assets,
    map,
    mapId: meta.id,
    tileKeys,
    onChange: () => refreshStatus(),
    onRoom: (num) => { roomSel.value = String(num); }, // keep the dropdown in sync with minimap clicks
    onStructure: () => { rebuildRoomSel(); rebuildTilesetSel(); }, // rooms/layers changed → rebuild dropdowns
    onZoom: (z) => { $("zoomVal").textContent = z + "×"; },
    onTool: (tool) => toolBtns.forEach((x) => x.b.classList.toggle("on", x.tool === tool)), // grabber → brush, etc.
  });

  // ── map selector ──────────────────────────────────────────────────────────────
  const mapSel = $<HTMLSelectElement>("mapSel");
  for (const m of [...mapList].sort((a, b) => a.id.localeCompare(b.id))) {
    const opt = document.createElement("option");
    opt.value = m.id; opt.textContent = m.name && m.name !== m.id ? `${m.id}  (${m.name})` : m.id;
    if (m.id === meta.id) opt.selected = true;
    mapSel.appendChild(opt);
  }
  mapSel.addEventListener("change", () => {
    if (app.isDirty && !confirm("Discard unsaved changes and open another map?")) {
      mapSel.value = meta.id; return;
    }
    location.search = "?map=" + encodeURIComponent(mapSel.value);
  });

  // ── room selector ─────────────────────────────────────────────────────────────
  const roomSel = $<HTMLSelectElement>("roomSel");
  const rebuildRoomSel = () => {
    roomSel.innerHTML = "";
    for (const num of [...map.roomNums].sort((a, b) => a - b)) {
      const opt = document.createElement("option");
      opt.value = String(num); opt.textContent = "room " + num;
      roomSel.appendChild(opt);
    }
    roomSel.value = String(app.room);
    $("roomHint").textContent = `· ${map.mapSize.x}×${map.mapSize.y}, ${map.roomNums.length} rooms`;
  };
  rebuildRoomSel();
  roomSel.addEventListener("change", () => app.setRoom(Number(roomSel.value)));

  // ── room-structure actions ──────────────────────────────────────────────────
  const roomActions = $("roomActions");
  const actionBtn = (label: string, title: string, fn: () => void) => {
    const b = document.createElement("button");
    b.textContent = label; b.title = title; b.addEventListener("click", fn);
    roomActions.appendChild(b); return b;
  };
  actionBtn("⚑ Start", "Make the current room the START room", () => app.setStartHere());
  actionBtn("⚐ End", "Make the current room the END (win) room", () => app.setEndHere());
  actionBtn("✕ End", "Clear the end/win room (#none)", () => app.clearEnd());
  actionBtn("Del", "Delete the current room", () => {
    if (confirm(`Delete room ${app.room}?`)) app.deleteRoom();
  });

  // ── layer buttons ─────────────────────────────────────────────────────────────
  const tilesetSel = $<HTMLSelectElement>("tilesetSel");
  const rebuildTilesetSel = () => {
    tilesetSel.innerHTML = "";
    const cur = app.currentLayerTileset();
    for (const sym of app.tilesetsForLayer(app.layerName)) {
      const opt = document.createElement("option");
      opt.value = sym; opt.textContent = sym.replace(/^#/, "");
      if (sym === cur) opt.selected = true;
      tilesetSel.appendChild(opt);
    }
  };
  tilesetSel.addEventListener("change", () => {
    if (app.isDirty && app.currentLayerTileset() !== tilesetSel.value &&
        !confirm(`Swap the ${app.layerName} tileset to ${tilesetSel.value.replace(/^#/, "")}? Tiles remap by symbol; tiles absent from the new set become empty.`)) {
      rebuildTilesetSel(); return;
    }
    app.changeLayerTileset(app.layerName, tilesetSel.value);
  });

  const layerGroup = $("layerGroup");
  const layerBtns = app.layerNames.map((name) => {
    const b = document.createElement("button");
    b.textContent = shortLayer(name);
    b.title = name;
    b.classList.toggle("on", name === app.layerName);
    b.addEventListener("click", () => {
      app.setLayer(name);
      layerBtns.forEach((x) => x.classList.toggle("on", x === b));
      rebuildTilesetSel();
    });
    layerGroup.appendChild(b);
    return b;
  });
  rebuildTilesetSel();

  // ── tool buttons ──────────────────────────────────────────────────────────────
  const toolGroup = $("toolGroup");
  const tools: { tool: Tool; label: string }[] = [
    { tool: "paint", label: "🖌 Brush" },
    { tool: "grab", label: "⊡ Grab" },
    { tool: "fill", label: "🪣 Fill" },
    { tool: "rect", label: "▭ Rect" },
    { tool: "erase", label: "⌫ Erase" },
    { tool: "eyedropper", label: "💧 Pick" },
  ];
  const toolBtns = tools.map(({ tool, label }) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.classList.toggle("on", tool === app.tool);
    b.addEventListener("click", () => { setTool(tool); });
    toolGroup.appendChild(b);
    return { b, tool };
  });
  const setTool = (tool: Tool) => app.setTool(tool); // app.onTool keeps the button highlight in sync

  // ── undo / save ───────────────────────────────────────────────────────────────
  // ── new map / resize ──────────────────────────────────────────────────────────
  const dims = (label: string, dflt: string): [number, number] | null => {
    const s = prompt(label, dflt);
    if (!s) return null;
    const [a, b] = s.split(",").map((n) => parseInt(n.trim(), 10));
    if (!a || !b || a < 1 || b < 1 || a > 99 || b > 99) { alert("Enter two numbers 1–99, like 18,9"); return null; }
    return [a, b];
  };
  $("newBtn").addEventListener("click", () => {
    if (app.isDirty && !confirm("Discard unsaved changes and start a new blank map?")) return;
    const ms = dims("New map — rooms grid (cols,rows):", "4,4"); if (!ms) return;
    const rs = dims("Room size in tiles (cols,rows):", "18,9"); if (!rs) return;
    app.newBlankMap(ms[0], ms[1], rs[0], rs[1]);
    status.textContent = "new blank map — Save downloads it (not a bundled map yet)";
  });
  $("resizeBtn").addEventListener("click", () => {
    const ms = dims("Map grid (cols,rows):", `${app.map.mapSize.x},${app.map.mapSize.y}`); if (!ms) return;
    const rs = dims("Room size in tiles (cols,rows):", `${app.map.roomSize.x},${app.map.roomSize.y}`); if (!rs) return;
    if (ms[0] !== app.map.mapSize.x || ms[1] !== app.map.mapSize.y) app.resizeMap(ms[0], ms[1]);
    if (rs[0] !== app.map.roomSize.x || rs[1] !== app.map.roomSize.y) app.resizeRoom(rs[0], rs[1]);
  });

  $("zoomIn").addEventListener("click", () => app.setZoom(app.zoomLevel + 1));
  $("zoomOut").addEventListener("click", () => app.setZoom(app.zoomLevel - 1));
  $("zoomVal").textContent = app.zoomLevel + "×";

  $("undoBtn").addEventListener("click", () => app.undo());
  const saveBtn = $<HTMLButtonElement>("saveBtn");
  const doSave = async () => {
    // A brand-new ("untitled") map needs a real id before it can be saved + registered.
    if (app.mapId === "untitled" || !app.mapId) {
      const name = prompt("Save as — map id (letters/numbers/_/- only):", "myMap");
      if (!name) return;
      if (!/^[A-Za-z0-9_-]+$/.test(name)) { alert("Invalid id — use letters, numbers, _ or -"); return; }
      app.mapId = name;
    }
    saveBtn.disabled = true; status.textContent = "saving…";
    try {
      const res = await saveMap(app.mapId, app.serialize(), app.mapMeta());
      app.markSaved();
      status.textContent = res.method !== "dev-write" ? "downloaded .txt"
        : res.registered ? `saved + registered — play at /?map=${app.mapId}` : `saved → ${res.path ?? "maps/"}`;
      status.classList.remove("dirty");
    } catch (e) {
      status.textContent = "save failed: " + String(e);
    } finally { saveBtn.disabled = false; }
  };
  saveBtn.addEventListener("click", doSave);

  // ── keyboard ──────────────────────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); app.undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void doSave(); }
    else if (e.key.toLowerCase() === "e") setTool("eyedropper");
    else if (e.key.toLowerCase() === "x") setTool("erase");
    else if (e.key.toLowerCase() === "g") setTool("fill");
    else if (e.key.toLowerCase() === "c") setTool("grab"); // clone/grab a region into the brush
    else if (e.key.toLowerCase() === "r") setTool("rect");
    else if (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "p") setTool("paint");
  });

  function refreshStatus(): void {
    if (app.isDirty) { status.textContent = "● unsaved"; status.classList.add("dirty"); }
  }

  $("palTitle").textContent = "Tiles · " + meta.id;
  app.redraw();
  status.textContent = "ready";
  (window as unknown as { editor: EditorApp }).editor = app; // dev affordance: inspect/drive from console
}

function shortLayer(name: string): string {
  return name.replace(/^background/i, "bg ").replace(/^objects$/i, "objects");
}

void boot().catch((e) => {
  const s = document.getElementById("status");
  if (s) s.textContent = "error: " + String(e);
  console.error(e);
});
