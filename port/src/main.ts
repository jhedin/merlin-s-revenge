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
import { Movement } from "./components/movement";
import { Projectile } from "./components/projectile";
import { sweepBullets, bulletPoolStats } from "./systems/bullets";

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
  const enemies = [
    spawnEnemy("blackOrc", 80, 80),                          // real data: energy 1200, walkSpeed 6
    spawnEnemy("dwarf", viewW - 80, 80, { ranged: true }),  // real data: energy 250, ranged
    spawnEnemy("blackOrc", viewW - 80, viewH - 80),
  ];
  game.player = player;
  game.entities = [player, ...enemies];

  const loop = new GameLoop(
    () => {
      game.tick++;
      // iterate a snapshot so bullets spawned this tick don't update until next tick
      const snapshot = game.entities.slice();
      for (const e of snapshot) e.send("update");
      sweepBullets();
      input.endTick();
    },
    () => {
      renderer.clear();
      if (passive && sheets.passive) renderer.drawTileLayer(passive, sheets.passive);
      if (active && sheets.active) renderer.drawTileLayer(active, sheets.active);
      const sprites = game.entities
        .filter((e) => e.type !== "bullet")
        .map((e) => e.get(Anim).sprite()).filter((s): s is Sprite => s !== null);
      renderer.drawSprites(sprites);
      drawBullets(renderer);
      for (const e of enemies) drawEnemyBar(renderer, e);
      drawHud(renderer, player);
    },
  );
  loop.start();
  (window as any).__game = game;
  (window as any).__bulletStats = bulletPoolStats;
  console.log("slice running:", game.entities.length, "entities on a", map.roomSize.x + "x" + map.roomSize.y, "room");
}

function drawHud(renderer: Renderer, player: import("./engine/dispatch").Entity) {
  const ctx = renderer.ctx;
  const frac = player.get(Energy).energyFrac();
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(6, 6, 104, 12);
  ctx.fillStyle = frac > 0.3 ? "#3c9" : "#e44"; ctx.fillRect(8, 8, 100 * frac, 8);
  ctx.fillStyle = "#fff"; ctx.font = "8px monospace"; ctx.fillText("HP", 114, 15);
}

function drawBullets(renderer: Renderer) {
  const ctx = renderer.ctx;
  for (const e of game.entities) {
    if (e.type !== "bullet") continue;
    const m = e.get(Movement);
    ctx.fillStyle = e.get(Projectile).team === "#aldevar" ? "#9cf" : "#fd6";
    ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawEnemyBar(renderer: Renderer, e: import("./engine/dispatch").Entity) {
  if (e.send("isDead")) return;
  const p = e.send("getPos") as { x: number; y: number };
  const frac = e.get(Energy).energyFrac();
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(p.x - 11, p.y - 26, 22, 4);
  ctx.fillStyle = "#e44"; ctx.fillRect(p.x - 10, p.y - 25, 20 * frac, 2);
}

function tileSheet(assets: Assets, sym: string) {
  const t = assets.index.tilesets[sym];
  if (!t) return undefined;
  return { img: assets.img(t.file), cols: t.cols, tile: t.tile };
}

main().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement("pre"), { textContent: String(e), style: "color:#f88" })); });
