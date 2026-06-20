// Vertical-slice entry point. Loads a real map + assets, spawns a player and enemies built from
// component archetypes (all gameplay flows through the four-primitive dispatch), and runs a
// 30 Hz fixed-timestep loop: data -> world -> entities/dispatch -> render -> input -> combat.

import { Assets } from "./render/assets";
import { Renderer, type Sprite } from "./render/renderer";
import { Input } from "./systems/input";
import { AudioSystem } from "./systems/audio";
import { GameLoop } from "./engine/loop";
import { parseMap, type GameMap, type Vec2i } from "./world/map";
import { parseTileKey } from "./data/tlk";
import { RoomManager } from "./world/rooms";
import { game, initContext } from "./game/context";
import { spawnPlayer, spawnEnemy, spawnUnit, spawnAlly } from "./entities/archetypes";
import { Anim } from "./components/anim";
import { Energy } from "./components/combat";
import { Mana } from "./components/mana";
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
  input.attachMouse(canvas); // objAiPlayer aims charged magic at the cursor
  const audio = new AudioSystem(assets.index);
  audio.preload();
  // browsers block audio until a user gesture — resume on the first key/click, then play title music
  const unlock = () => { audio.unlock(); audio.playMusic("baroque_rock_v1"); window.removeEventListener("keydown", unlock); window.removeEventListener("pointerdown", unlock); };
  window.addEventListener("keydown", unlock); window.addEventListener("pointerdown", unlock);
  initContext({ input, assets, audio, tilePx: tile, entities: [], player: null, tick: 0, spawnEnemy, spawnUnit, spawnAlly });

  // scene state machine (scenes.json): title -> intro cutscene -> playing <-> paused -> gameover/victory
  let mode: "title" | "cutscene" | "playing" | "paused" | "gameover" | "victory" = "title";
  let player!: import("./engine/dispatch").Entity;
  let rooms!: RoomManager;
  let cutscene: CutscenePlayer | null = null;
  let pauseMenu: Menu | null = null;

  // title + controls menus
  const startItem = { label: "Start Game", action: () => { cutscene = new CutscenePlayer(intro, assets, viewW, viewH); mode = "cutscene"; } };
  const mainTitleMenu = new Menu("", [startItem, { label: "Controls", action: () => { titleMenu = controlsMenu; } }]);
  const setScheme = (n: "both" | "arrows" | "wasd" | "zqsd") => () => { input.setScheme(n); flash("controls: " + n); titleMenu = mainTitleMenu; };
  const controlsMenu = new Menu("CONTROLS", [
    { label: "Arrows", action: setScheme("arrows") },
    { label: "WASD", action: setScheme("wasd") },
    { label: "ZQSD", action: setScheme("zqsd") },
    { label: "WASD + Arrows", action: setScheme("both") },
    { label: "Back", action: () => { titleMenu = mainTitleMenu; } },
  ]);
  let titleMenu: Menu = mainTitleMenu;

  function openPause() {
    pauseMenu = new Menu("PAUSED", [
      { label: "Resume", action: () => { mode = "playing"; } },
      { label: "Save game", action: () => { saveGame(player, rooms.loc); flash("game saved"); mode = "playing"; } },
      { label: "Load game", action: () => { const s = loadSave(); if (s) { rooms.enter(s.room); player.send("restoreFromSave", s.player); } mode = "playing"; } },
      { label: "Return to title", action: () => { mode = "title"; audio.playMusic("baroque_rock_v1"); } },
    ]);
    mode = "paused";
  }

  function startGame() {
    player = spawnPlayer(viewW / 2, viewH / 2);
    game.player = player;
    game.entities = [player];
    // every room cleared -> the dungeon is won (objMap: last #endRoom #none -> victory)
    rooms = new RoomManager(map, assets, activeKey, objectsKey, viewW, viewH, player,
      () => { mode = "victory"; audio.play("end_level"); audio.playMusic("last_stand_v4"); });
    rooms.enter(map.startRoom);
    audio.playMusic("electronic_merlin_v1_02"); // the dungeon theme
    mode = "playing";
  }

  const loop = new GameLoop(
    () => {
      game.tick++;
      if (input.pressed("m")) { flash(audio.toggleMute() ? "sound off" : "sound on"); } // global mute
      if (mode === "title") {
        titleMenu.tick(input);
      } else if (mode === "cutscene") {
        if (cutscene!.tick(input)) startGame();
      } else if (mode === "playing") {
        if (input.pressed("escape")) { openPause(); input.endTick(); return; }
        if (input.pressed("1")) { saveGame(player, rooms.loc); flash("game saved"); }
        if (input.pressed("2")) {
          const s = loadSave();
          if (s) { rooms.enter(s.room); player.send("restoreFromSave", s.player); flash("game loaded"); }
        }
        // iterate over this tick's entities by captured length (alloc-free; newly spawned
        // bullets/allies appended during the loop are processed next tick, like a snapshot)
        for (let i = 0, n = game.entities.length; i < n; i++) game.entities[i]!.send("update");
        sweepBullets();
        for (let i = game.entities.length - 1; i >= 0; i--) { // sweep collected pickups
          const e = game.entities[i]!;
          if (e.type === "pickup" && e.send("isFinished")) game.entities.splice(i, 1);
        }
        rooms.update();
        if (player.send("isDead")) { mode = "gameover"; audio.play("end_screen"); audio.stopMusic(); }
      } else if (mode === "paused") {
        if (input.pressed("escape")) mode = "playing"; else pauseMenu!.tick(input);
      } else if (mode === "gameover") {
        if (input.pressed(" ") || input.pressed("enter")) startGame();
      } else if (mode === "victory") {
        if (input.pressed(" ") || input.pressed("enter")) { titleMenu = mainTitleMenu; mode = "title"; audio.playMusic("baroque_rock_v1"); }
      }
      input.endTick();
    },
    () => {
      renderer.clear();
      if (mode === "title") { drawTitle(renderer, viewW, viewH); titleMenu.render(renderer, viewW, viewH, false); return; }
      if (mode === "cutscene") { cutscene!.render(renderer); return; }
      const passive = rooms.room.layer("#backgroundPassive");
      const active = rooms.room.layer("#backgroundActive");
      if (passive && rooms.passiveSheet) renderer.drawTileLayer(passive, rooms.passiveSheet);
      if (active && rooms.activeSheet) renderer.drawTileLayer(active, rooms.activeSheet);
      const sprites = game.entities
        .filter((e) => e.type !== "bullet" && e.type !== "pickup")
        .map((e) => e.get(Anim).sprite()).filter((s): s is Sprite => s !== null);
      renderer.drawSprites(sprites);
      drawBullets(renderer);
      drawPickups(renderer);
      for (const e of game.entities) {
        if (e.type === "enemy") drawEnemyBar(renderer, e, "#e44");
        else if (e.type === "ally") drawEnemyBar(renderer, e, "#4d6");
      }
      drawCharge(renderer, player);
      drawHud(renderer, player);
      drawMinimap(renderer, map, rooms.loc, viewW);
      if (mode === "gameover") drawGameOver(renderer, viewW, viewH);
      if (mode === "victory") drawVictory(renderer, viewW, viewH);
      if (mode === "paused") pauseMenu!.render(renderer, viewW, viewH);
    },
  );
  loop.start();
  (window as any).__game = game;
  (window as any).__startGame = startGame;
  (window as any).__rooms = () => rooms;
  (window as any).__mode = () => mode;
  (window as any).__bulletStats = bulletPoolStats;
  (window as any).__audio = audio;
  console.log("Merlin's Revenge —", map.mapSize.x + "x" + map.mapSize.y, "room dungeon ready (title screen)");
}

function drawTitle(renderer: Renderer, w: number, h: number) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "#0a1020"; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fc4"; ctx.font = "bold 26px serif";
  ctx.fillText("MERLIN'S REVENGE", w / 2, h / 2 - 48);
  ctx.fillStyle = "#566"; ctx.font = "8px monospace";
  ctx.fillText("move: WASD/arrows   aim: mouse   hold to charge magic, release to cast   punch: auto", w / 2, h - 26);
  ctx.fillText("summon: E   save/load: 1/2   pause: Esc   mute: M", w / 2, h - 14);
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

function drawVictory(renderer: Renderer, w: number, h: number) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(8,16,32,0.78)"; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fc4"; ctx.font = "bold 24px serif";
  ctx.fillText("THE DUNGEON IS CLEARED", w / 2, h / 2 - 6);
  ctx.fillStyle = "#9cf"; ctx.font = "11px serif";
  ctx.fillText("Merlin's revenge is complete.", w / 2, h / 2 + 16);
  ctx.fillStyle = "#fff"; ctx.font = "9px monospace";
  ctx.fillText("press SPACE to return to the title", w / 2, h / 2 + 40);
  ctx.textAlign = "left";
}

function drawHud(renderer: Renderer, player: import("./engine/dispatch").Entity) {
  const ctx = renderer.ctx;
  const hp = player.get(Energy).energyFrac();
  const hasSpell = player.send("getHasSpell") as boolean;
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(6, 6, 104, 24);
  ctx.fillStyle = hp > 0.3 ? "#3c9" : "#e44"; ctx.fillRect(8, 8, 100 * hp, 6);   // health (energy)
  const xp = player.get(Experience);
  ctx.fillStyle = "#fc4"; ctx.fillRect(8, 18, 100 * Math.min(1, xp.frac()), 4);   // experience
  // no mana bar: magic has no pool (charge is shown by the ring at the cursor); flag once acquired
  ctx.fillStyle = "#fff"; ctx.font = "8px monospace";
  ctx.fillText("HP", 114, 13);
  ctx.fillText("Lv " + xp.level, 114, 24);
  if (hasSpell) { ctx.fillStyle = "#fc8"; ctx.fillText("✦", 100, 13); } // magic acquired
  if (Date.now() < flashUntil) { ctx.fillStyle = "#ff4"; ctx.fillText(flashMsg, 8, 44); }
}

// the charge meter follows the cursor while a spell is being held (gmgChargeLoc feedback)
function drawCharge(renderer: Renderer, player: import("./engine/dispatch").Entity) {
  const frac = player.send("chargeFrac") as number;
  if (frac <= 0) return;
  const aim = game.input.cursor();
  const m = player.get(Movement);
  const x = aim ? aim.x : m.x, y = aim ? aim.y : m.y - 18;
  const ctx = renderer.ctx;
  ctx.strokeStyle = "rgba(120,180,255,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#9cf"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
}

const PICKUP_COLOR: Record<string, string> = {
  heal: "#3d6", speed: "#4cf", power: "#c5f", sword: "#fe8", spell: "#fc8",
  manaCapacity: "#48f", manaFlow: "#4cf", manaBurst: "#88f",
};
function drawPickups(renderer: Renderer) {
  const ctx = renderer.ctx;
  for (const e of game.entities) {
    if (e.type !== "pickup") continue;
    const m = e.get(Movement);
    const blink = (Math.floor(Date.now() / 250) % 2) ? 1 : 0.6;
    ctx.globalAlpha = blink;
    ctx.fillStyle = PICKUP_COLOR[e.send("getEffect") as string] ?? "#fff";
    ctx.beginPath(); // diamond
    ctx.moveTo(m.x, m.y - 5); ctx.lineTo(m.x + 5, m.y); ctx.lineTo(m.x, m.y + 5); ctx.lineTo(m.x - 5, m.y);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
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
