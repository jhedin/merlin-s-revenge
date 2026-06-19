// Vertical-slice entry point. Loads a real map + assets, spawns a player and enemies built from
// component archetypes (all gameplay flows through the four-primitive dispatch), and runs a
// 30 Hz fixed-timestep loop: data -> world -> entities/dispatch -> render -> input -> combat.

import { Assets } from "./render/assets";
import { Renderer, type Sprite } from "./render/renderer";
import { Input } from "./systems/input";
import { GameLoop } from "./engine/loop";
import { parseMap, type GameMap, type Vec2i } from "./world/map";
import { parseTileKey } from "./data/tlk";
import { RoomManager } from "./world/rooms";
import { game, initContext } from "./game/context";
import { spawnPlayer, spawnEnemy, spawnAlly } from "./entities/archetypes";
import { Anim } from "./components/anim";
import { Energy } from "./components/combat";
import { Experience } from "./components/experience";
import { Movement } from "./components/movement";
import { Projectile } from "./components/projectile";
import { sweepBullets, bulletPoolStats } from "./systems/bullets";
import { saveGame, loadSave } from "./systems/save";
import { parseCutscene } from "./data/cutscene";
import { CutscenePlayer } from "./scenes/cutscenePlayer";
import { Menu } from "./scenes/menu";

let flashMsg = ""; let flashUntil = 0;
const flash = (m: string) => { flashMsg = m; flashUntil = Date.now() + 1200; };

async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const assets = await Assets.load();
  const [mapSrc, keySrc, objSrc, introSrc] = await Promise.all([
    fetch("/assets/map.txt").then((r) => r.text()),
    fetch("/assets/active_key.txt").then((r) => r.text()),
    fetch("/assets/objects_key.txt").then((r) => r.text()),
    fetch("/assets/intro.txt").then((r) => r.text()),
  ]);
  const intro = parseCutscene(introSrc);
  const map = parseMap(mapSrc);
  const activeKey = parseTileKey(keySrc);
  const objectsKey = parseTileKey(objSrc);
  const tile = map.tilePx;
  const viewW = map.roomSize.x * tile, viewH = map.roomSize.y * tile;
  const renderer = new Renderer(canvas, viewW, viewH, 2);

  const input = new Input();
  initContext({ input, assets, tilePx: tile, entities: [], player: null, tick: 0, spawnEnemy, spawnAlly });

  // scene state machine (scenes.json): title -> intro cutscene -> playing <-> paused -> gameover
  let mode: "title" | "cutscene" | "playing" | "paused" | "gameover" = "title";
  let player!: import("./engine/dispatch").Entity;
  let rooms!: RoomManager;
  let cutscene: CutscenePlayer | null = null;
  let pauseMenu: Menu | null = null;

  function openPause() {
    pauseMenu = new Menu("PAUSED", [
      { label: "Resume", action: () => { mode = "playing"; } },
      { label: "Save game", action: () => { saveGame(player, rooms.loc); flash("game saved"); mode = "playing"; } },
      { label: "Load game", action: () => { const s = loadSave(); if (s) { rooms.enter(s.room); player.send("restoreFromSave", s.player); } mode = "playing"; } },
      { label: "Return to title", action: () => { mode = "title"; } },
    ]);
    mode = "paused";
  }

  function startGame() {
    player = spawnPlayer(viewW / 2, viewH / 2);
    game.player = player;
    game.entities = [player];
    rooms = new RoomManager(map, assets, activeKey, objectsKey, viewW, viewH, player);
    rooms.enter(map.startRoom);
    mode = "playing";
  }

  const loop = new GameLoop(
    () => {
      game.tick++;
      if (mode === "title") {
        if (input.pressed(" ") || input.pressed("enter")) { cutscene = new CutscenePlayer(intro, assets, viewW, viewH); mode = "cutscene"; }
      } else if (mode === "cutscene") {
        if (cutscene!.tick(input)) startGame();
      } else if (mode === "playing") {
        if (input.pressed("escape")) { openPause(); input.endTick(); return; }
        if (input.pressed("1")) { saveGame(player, rooms.loc); flash("game saved"); }
        if (input.pressed("2")) {
          const s = loadSave();
          if (s) { rooms.enter(s.room); player.send("restoreFromSave", s.player); flash("game loaded"); }
        }
        const snapshot = game.entities.slice();
        for (const e of snapshot) e.send("update");
        sweepBullets();
        rooms.update();
        if (player.send("isDead")) mode = "gameover";
      } else if (mode === "paused") {
        if (input.pressed("escape")) mode = "playing"; else pauseMenu!.tick(input);
      } else if (mode === "gameover") {
        if (input.pressed(" ") || input.pressed("enter")) startGame();
      }
      input.endTick();
    },
    () => {
      renderer.clear();
      if (mode === "title") { drawTitle(renderer, viewW, viewH); return; }
      if (mode === "cutscene") { cutscene!.render(renderer); return; }
      const passive = rooms.room.layer("#backgroundPassive");
      const active = rooms.room.layer("#backgroundActive");
      if (passive && rooms.passiveSheet) renderer.drawTileLayer(passive, rooms.passiveSheet);
      if (active && rooms.activeSheet) renderer.drawTileLayer(active, rooms.activeSheet);
      const sprites = game.entities
        .filter((e) => e.type !== "bullet")
        .map((e) => e.get(Anim).sprite()).filter((s): s is Sprite => s !== null);
      renderer.drawSprites(sprites);
      drawBullets(renderer);
      for (const e of game.entities) {
        if (e.type === "enemy") drawEnemyBar(renderer, e, "#e44");
        else if (e.type === "ally") drawEnemyBar(renderer, e, "#4d6");
      }
      drawHud(renderer, player);
      drawMinimap(renderer, map, rooms.loc, viewW);
      if (mode === "gameover") drawGameOver(renderer, viewW, viewH);
      if (mode === "paused") pauseMenu!.render(renderer, viewW, viewH);
    },
  );
  loop.start();
  (window as any).__game = game;
  (window as any).__startGame = startGame;
  (window as any).__rooms = () => rooms;
  (window as any).__mode = () => mode;
  (window as any).__bulletStats = bulletPoolStats;
  console.log("Merlin's Revenge —", map.mapSize.x + "x" + map.mapSize.y, "room dungeon ready (title screen)");
}

function drawTitle(renderer: Renderer, w: number, h: number) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "#0a1020"; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fc4"; ctx.font = "bold 28px serif";
  ctx.fillText("MERLIN'S REVENGE", w / 2, h / 2 - 24);
  ctx.fillStyle = "#9cf"; ctx.font = "10px monospace";
  ctx.fillText("a TypeScript/HTML5 port", w / 2, h / 2 - 4);
  ctx.fillStyle = (Math.floor(Date.now() / 400) % 2) ? "#fff" : "#888";
  ctx.fillText("press SPACE to begin", w / 2, h / 2 + 28);
  ctx.fillStyle = "#566"; ctx.font = "8px monospace";
  ctx.fillText("move: WASD   attack: space   summon: Q   save/load: 1/2   pause: Esc", w / 2, h - 16);
  ctx.textAlign = "left";
}

function drawGameOver(renderer: Renderer, w: number, h: number) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#e44"; ctx.font = "bold 24px serif";
  ctx.fillText("YOU HAVE FALLEN", w / 2, h / 2 - 6);
  ctx.fillStyle = "#fff"; ctx.font = "9px monospace";
  ctx.fillText("press SPACE to try again", w / 2, h / 2 + 18);
  ctx.textAlign = "left";
}

function drawHud(renderer: Renderer, player: import("./engine/dispatch").Entity) {
  const ctx = renderer.ctx;
  const hp = player.get(Energy).energyFrac();
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(6, 6, 104, 20);
  ctx.fillStyle = hp > 0.3 ? "#3c9" : "#e44"; ctx.fillRect(8, 8, 100 * hp, 7);
  const xp = player.get(Experience);
  ctx.fillStyle = "#fc4"; ctx.fillRect(8, 17, 100 * Math.min(1, xp.frac()), 5);
  ctx.fillStyle = "#fff"; ctx.font = "8px monospace";
  ctx.fillText("HP", 114, 14);
  ctx.fillText("Lv " + xp.level, 114, 23);
  ctx.fillText("1:save 2:load", 6, 36);
  if (Date.now() < flashUntil) { ctx.fillStyle = "#ff4"; ctx.fillText(flashMsg, 90, 36); }
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

function drawEnemyBar(renderer: Renderer, e: import("./engine/dispatch").Entity, color: string) {
  if (e.send("isDead")) return;
  const p = e.send("getPos") as { x: number; y: number };
  const ctx = renderer.ctx;
  if (e.send("isFrozen")) { // modFreeze: teal frost overlay
    ctx.fillStyle = "rgba(80,220,255,0.35)";
    ctx.fillRect(p.x - 9, p.y - 20, 18, 22);
  }
  const frac = e.get(Energy).energyFrac();
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(p.x - 11, p.y - 26, 22, 4);
  ctx.fillStyle = color; ctx.fillRect(p.x - 10, p.y - 25, 20 * frac, 2);
}

function drawMinimap(renderer: Renderer, map: GameMap, loc: Vec2i, viewW: number) {
  const ctx = renderer.ctx;
  const cell = 5;
  const w = map.mapSize.x * cell, h = map.mapSize.y * cell;
  const ox = viewW - w - 6, oy = 6;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(ox - 2, oy - 2, w + 4, h + 4);
  for (let y = 0; y < map.mapSize.y; y++) {
    for (let x = 0; x < map.mapSize.x; x++) {
      const here = x + 1 === loc.x && y + 1 === loc.y;
      ctx.fillStyle = here ? "#fff" : map.roomAt({ x: x + 1, y: y + 1 }) ? "#69a" : "#333";
      ctx.fillRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
    }
  }
}

main().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement("pre"), { textContent: String(e), style: "color:#f88" })); });
