// Vertical-slice entry point. Loads a real map + assets, spawns a player and enemies built from
// component archetypes (all gameplay flows through the four-primitive dispatch), and runs a
// 30 Hz fixed-timestep loop: data -> world -> entities/dispatch -> render -> input -> combat.

import { Assets } from "./render/assets";
import { Renderer, type Sprite } from "./render/renderer";
import { Input } from "./systems/input";
import { GameLoop } from "./engine/loop";
import { parseMap } from "./world/map";
import { parseTileKey } from "./data/tlk";
import { CollisionGrid } from "./world/collision";
import { game, initContext } from "./game/context";
import { spawnPlayer, spawnEnemy } from "./entities/archetypes";
import { Anim } from "./components/anim";
import { Energy } from "./components/combat";

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
  const viewW = map.roomSize.x * tile, viewH = map.roomSize.y * tile;
  const renderer = new Renderer(canvas, viewW, viewH, 2);

  const room = map.roomAt(map.startRoom) ?? map.rooms.get(1)!;
  const passive = room.layer("#backgroundPassive");
  const active = room.layer("#backgroundActive");
  const grid = active ? CollisionGrid.fromActiveLayer(active, activeKey, tile)
                      : new CollisionGrid(map.roomSize.x, map.roomSize.y, tile);
  const sheets = {
    passive: passive && tileSheet(assets, "#merlin4Passive"),
    active: active && tileSheet(assets, "#merlin4Active"),
  };

  const input = new Input();
  initContext({ grid, input, assets, tilePx: tile, entities: [], player: null, tick: 0 });

  const player = spawnPlayer(viewW / 2, viewH / 2);
  const enemies = [spawnEnemy(80, 80), spawnEnemy(viewW - 80, 80), spawnEnemy(viewW - 80, viewH - 80)];
  game.player = player;
  game.entities = [player, ...enemies];

  const loop = new GameLoop(
    () => {
      game.tick++;
      for (const e of game.entities) e.send("update");
      input.endTick();
    },
    () => {
      renderer.clear();
      if (passive && sheets.passive) renderer.drawTileLayer(passive, sheets.passive);
      if (active && sheets.active) renderer.drawTileLayer(active, sheets.active);
      const sprites = game.entities.map((e) => e.get(Anim).sprite()).filter((s): s is Sprite => s !== null);
      renderer.drawSprites(sprites);
      drawHud(renderer, player);
    },
  );
  loop.start();
  (window as any).__game = game;
  console.log("slice running:", game.entities.length, "entities on a", map.roomSize.x + "x" + map.roomSize.y, "room");
}

function drawHud(renderer: Renderer, player: import("./engine/dispatch").Entity) {
  const ctx = renderer.ctx;
  const frac = player.get(Energy).energyFrac();
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(6, 6, 104, 12);
  ctx.fillStyle = frac > 0.3 ? "#3c9" : "#e44"; ctx.fillRect(8, 8, 100 * frac, 8);
  ctx.fillStyle = "#fff"; ctx.font = "8px monospace"; ctx.fillText("HP", 114, 15);
}

function tileSheet(assets: Assets, sym: string) {
  const t = assets.index.tilesets[sym];
  if (!t) return undefined;
  return { img: assets.img(t.file), cols: t.cols, tile: t.tile };
}

main().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement("pre"), { textContent: String(e), style: "color:#f88" })); });
