// Vertical-slice entry point: load assets + a real map, render its tile layers, and drive a
// player around it with tile collision at a fixed 30 Hz tick. Proves the data -> world ->
// render -> input -> movement -> collision pipeline end to end.

import { Assets } from "./render/assets";
import { Renderer } from "./render/renderer";
import { Input } from "./systems/input";
import { GameLoop } from "./engine/loop";
import { parseMap } from "./world/map";
import { parseTileKey } from "./data/tlk";
import { CollisionGrid } from "./world/collision";
import { Player } from "./game/player";

async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const assets = await Assets.load();
  const [mapSrc, keySrc] = await Promise.all([
    fetch("/assets/map.txt").then((r) => r.text()),
    fetch("/assets/active_key.txt").then((r) => r.text()),
  ]);
  const map = parseMap(mapSrc);
  const activeKey = parseTileKey(keySrc);

  const tile = map.tilePx;
  const viewW = map.roomSize.x * tile;
  const viewH = map.roomSize.y * tile;
  const renderer = new Renderer(canvas, viewW, viewH, 2);

  const room = map.roomAt(map.startRoom) ?? map.rooms.get(1)!;
  const passive = room.layer("#backgroundPassive");
  const active = room.layer("#backgroundActive");
  const grid = active
    ? CollisionGrid.fromActiveLayer(active, activeKey, tile)
    : new CollisionGrid(map.roomSize.x, map.roomSize.y, tile);

  const sheets = {
    passive: passive && tileSheet(assets, "#merlin4Passive"),
    active: active && tileSheet(assets, "#merlin4Active"),
  };

  const input = new Input();
  const player = new Player(viewW / 2, viewH / 2, assets);

  const loop = new GameLoop(
    () => { player.update(input.moveVector(), grid); input.endTick(); },
    () => {
      renderer.clear();
      if (passive && sheets.passive) renderer.drawTileLayer(passive, sheets.passive);
      if (active && sheets.active) renderer.drawTileLayer(active, sheets.active);
      renderer.drawSprites([player.sprite(50)]);
    },
  );
  loop.start();
  (window as any).__game = { map, player, grid };
  console.log("Merlin's Revenge slice running:", map.roomSize, "tiles");
}

function tileSheet(assets: Assets, sym: string) {
  const t = assets.index.tilesets[sym];
  if (!t) return undefined;
  return { img: assets.img(t.file), cols: t.cols, tile: t.tile };
}

main().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement("pre"), { textContent: String(e) })); });
