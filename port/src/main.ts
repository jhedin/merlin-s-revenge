// Vertical-slice entry point. Loads a real map + assets, spawns a player and enemies built from
// component archetypes (all gameplay flows through the four-primitive dispatch), and runs a
// 30 Hz fixed-timestep loop: data -> world -> entities/dispatch -> render -> input -> combat.

import { Assets, mapList, type MapMeta } from "./render/assets";
import { Renderer, type Sprite } from "./render/renderer";
import { drawMinimap } from "./render/minimap";
import { Input } from "./systems/input";
import { AudioSystem } from "./systems/audio";
import { GameLoop } from "./engine/loop";
import { parseMap, type GameMap, type Vec2i } from "./world/map";
import { parseTileKey, tileSymbol, type TileKey } from "./data/tlk";
import { RoomManager } from "./world/rooms";
import { registry } from "./game/data";
import { game, initContext } from "./game/context";
import { spawnPlayer, spawnEnemy, spawnUnit, spawnAlly } from "./entities/archetypes";
import { Anim } from "./components/anim";
import { Energy } from "./components/combat";
import { Mana } from "./components/mana";
import { Experience } from "./components/experience";
import { Movement } from "./components/movement";
import { Projectile } from "./components/projectile";
import { sweepBullets, bulletPoolStats } from "./systems/bullets";
import { rebuildCombatSubstrate } from "./systems/combatTick";
import { saveGame, loadSave, buildSave, clearLegacy, pStateFromSave } from "./systems/save";
import { parseCutscene } from "./data/cutscene";
import { CutscenePlayer } from "./scenes/cutscenePlayer";
import { Menu } from "./scenes/menu";
import { SceneManager, type CutScene } from "./scenes/sceneManager";

let flashMsg = ""; let flashUntil = 0;
const flash = (m: string) => { flashMsg = m; flashUntil = Date.now() + 1200; };

// A fully-resolved, ready-to-play map: the parsed map + the active/objects tile keys + its assets
// loaded. loadMap can build ANY of the 47 bundled maps (objMap: "maps are data"); the engine renders
// whatever the data ships. Per-layer keys come from each tileset's keyFile in the asset index.
interface LoadedMap { meta: MapMeta; map: GameMap; activeKey: TileKey; objectsKey: TileKey; }

async function loadMap(assets: Assets, id: string): Promise<LoadedMap> {
  const meta = mapList.find((m) => m.id === id) ?? mapList.find((m) => m.id === assets.index.defaultMap) ?? mapList[0]!;
  const tilesets = assets.index.tilesets;
  const tilePxFor = (sym: string) => tilesets[sym]?.tile;

  const src = await fetch("/assets/" + meta.file).then((r) => r.text());
  const map = parseMap(src, tilePxFor);

  // resolve the active/objects tile keys from the layers' tilesets (fall back to a small empty key).
  const symFor = (layer: string) => map.layerDefs.find((d) => d.name === layer)?.tileSet ?? "";
  const fetchKey = async (sym: string): Promise<TileKey> => {
    const kf = tilesets[sym]?.keyFile;
    if (!kf) return { tileSize: { w: map.tilePx, h: map.tilePx }, symbols: [] };
    return parseTileKey(await fetch("/assets/" + kf).then((r) => r.text()));
  };
  const [activeKey, objectsKey] = await Promise.all([
    fetchKey(symFor("#backgroundActive")), fetchKey(symFor("#objects")),
  ]);

  // collect every char this map can spawn (objects-layer symbols across all rooms) so ensureMapAssets
  // loads only their frames — not all 171 chars (14 MB). Pickups/skip symbols contribute no char.
  // (Resolved straight off the index here — game context isn't initialized yet, so spriteCharOr's
  // game.assets is unavailable; ensureMapAssets always adds the blackOrc fallback anyway.)
  const hasChar = (name: string) => !!assets.index.anims[`${name}_stand`];
  const spawnChars = new Set<string>();
  for (const room of map.rooms.values()) {
    const objects = room.layer("#objects");
    if (!objects) continue;
    for (const row of objects.grid) for (const n of row) {
      if (n <= 0) continue;
      const sym = tileSymbol(objectsKey, n);
      if (sym === "#none" || sym === "#player") continue;
      const name = sym.slice(1);
      if (registry.resolveActor(name) && hasChar(name)) spawnChars.add(name);
    }
  }
  const tilesetFiles = meta.tilesets.map((s) => tilesets[s]?.file).filter((f): f is string => !!f);
  await assets.ensureMapAssets(tilesetFiles, [...spawnChars]);
  return { meta, map, activeKey, objectsKey };
}

async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const assets = await Assets.load();
  // dev map picker: ?map=<id> selects any of the 47 bundled maps; default is unchanged.
  const wantMap = new URLSearchParams(location.search).get("map") ?? assets.index.defaultMap ?? "";
  const [loaded, introSrc, wastedSrc, completeSrc] = await Promise.all([
    loadMap(assets, wantMap),
    fetch("/assets/intro.txt").then((r) => r.text()),
    fetch("/assets/wasted.txt").then((r) => r.text()).catch(() => ""),
    fetch("/assets/complete.txt").then((r) => r.text()).catch(() => ""),
  ]);
  const intro = parseCutscene(introSrc);
  const wastedScript = wastedSrc ? parseCutscene(wastedSrc) : null;   // gGameOverScript (real Merlin, wasted)
  const completeScript = completeSrc ? parseCutscene(completeSrc) : null; // gGameCompleteScript
  // preload the cutscene cast's frames (small) so the intro renders immediately on first play.
  const CUT_SYM_CHAR: Record<string, string> = { merlin: "mer", ulin: "uli", berlin: "ber", tv: "tv" };
  for (const sym of Object.values(intro.chars)) {
    const name = sym.replace("#", "");
    void assets.ensureChar(CUT_SYM_CHAR[name] ?? name.slice(0, 3));
  }
  const { map, activeKey, objectsKey } = loaded;
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
  // teamMaster.pUnitMap sizing from the current map (getTileLoc: world loc -> tile, origin 0,0). Rooms
  // render from (0,0) at map.tilePx, so origin 0,0 / tile=map.tilePx (fallback 32) matches getTileLoc.
  game.teamMaster.unitMap.configure(tile || 32, 0, 0);

  // --- scene state ---
  let player!: import("./engine/dispatch").Entity;
  let rooms!: RoomManager;
  let cutscene: CutscenePlayer | null = null;
  let deathT = 0; // die-animation delay before the death pathway resolves (modExtraLives.attemptRespawn)

  // cutscene host services (sounds/music/#key) shared by every scene the Thespian plays.
  const cutHost = {
    viewW, viewH,
    playSound: (m: string, vol: number) => audio.play(m, vol / 255),
    playMusic: (m: string) => audio.playMusic(m),
    keyForControl: (c: string) => input.keyForControl(c),
  };

  // doSave (saveMaster.saveGame): cascade the WHOLE world — full per-room pState (H3) + cleared set +
  // masters + player chain.
  function doSave() {
    const blob = buildSave({
      player, mapId: loaded.meta.id, currentRoom: rooms.loc, currentRoomNum: rooms.currentRoomNum(),
      clearedRooms: rooms.clearedRooms(), currentObjects: rooms.snapshotCurrentRoom(),
      pState: rooms.fullPState(),
    });
    saveGame(blob);
  }

  // doLoad (objMap.restoreFromSave): reject a version mismatch; else restore masters + cleared set + the
  // FULL per-room pState (H3) + the player chain, then rebuild the current room from its saved actors.
  function doLoad(): boolean {
    if (!rooms) return false;
    const s = loadSave();
    if (!s) return false;
    if (s.map !== loaded.meta.id) { flash("save is for a different map"); return false; }
    game.armyMaster.restoreFromSave(s.army);
    game.potionMaster.restoreFromSave(s.potions);
    rooms.restoreCleared(s.rooms.filter((r) => r.cleared).map((r) => r.num));
    rooms.restorePState(pStateFromSave(s));            // every visited room's exact state (H3)
    player.send("restoreFromSave", s.player);          // player chain (energy/xp/mana/weapons/medikit/lives)
    const cur = s.rooms.find((r) => r.num === s.currentRoomNum);
    rooms.restoreInto(s.currentRoom, cur?.objects ?? []); // tear down + respawn the current room's actors
    return true;
  }

  function freshGame() {
    game.teamMaster.reset(); // fresh rosters/subscriptions for a new run
    game.armyMaster.reset(); // empty the reserve bank
    game.potionMaster.reset(); // zero the potion tally
    player = spawnPlayer(viewW / 2, viewH / 2);
    game.player = player;
    game.entities = [player];
    // win on TWO triggers (H3): clear-all OR reach+clear the #endRoom (RoomManager.markCleared).
    rooms = new RoomManager(map, assets, activeKey, objectsKey, viewW, viewH, player,
      () => scene.gameComplete());
    // G2 army reserve: bank teleportable allies when leaving a room; re-field them on the next room.
    rooms.onLeaveRoom = (leaving) => {
      for (let i = leaving.length - 1; i >= 0; i--) {
        const e = leaving[i]!;
        if (game.armyMaster.teleportOut(e)) {
          const idx = game.entities.indexOf(e);
          if (idx >= 0) game.entities.splice(idx, 1);
        }
      }
    };
    rooms.onEnterRoom = (x, y) => { game.armyMaster.refieldAll("#aldevar", x, y); };
    rooms.enter(map.startRoom);
    deathT = 0;
    audio.playMusic("electronic_merlin_v1_02"); // the dungeon theme
  }

  // SceneManager (movieMaster + screenMaster + gameMaster): the explicit scene FSM (replaces the mode var).
  const scene = new SceneManager({
    startGame: () => { clearLegacy(); freshGame(); },
    playCutScene: (s: CutScene) => {
      if (s === "wasted" && wastedScript) {
        audio.play("end_screen"); audio.stopMusic();
        // the wasted cutscene DRIVES THE REAL MERLIN actor (bound by its alias `m`) in goWastedMode.
        cutscene = CutscenePlayer.withBound(wastedScript, assets, viewW, viewH, cutHost, { m: player });
      } else if (s === "complete" && completeScript) {
        audio.play("end_level"); audio.playMusic("last_stand_v4");
        cutscene = CutscenePlayer.withBound(completeScript, assets, viewW, viewH, cutHost, { m: player });
      } else if (s === "intro") {
        cutscene = new CutscenePlayer(intro, assets, viewW, viewH, cutHost);
      } else {
        // no script available (e.g. no wasted asset): finish immediately so the FSM advances.
        cutscene = null; queueMicrotask(() => scene.cutSceneFinished(s));
      }
    },
    loadGame: () => doLoad(),
    pause: () => { /* simulation is gated on scene.isPaused() in the loop */ },
    resume: () => { /* resume handled by the loop reading scene state */ },
    onTitle: () => audio.playMusic("baroque_rock_v1"),
  });

  // title + controls menus (data-driven objMenu)
  const mainTitleMenu = new Menu("", [
    { label: "Start Game", action: () => scene.startGameFromTitle() },
    { label: "Controls", action: () => { titleMenu = controlsMenu; } },
  ]);
  const setScheme = (n: "both" | "arrows" | "wasd" | "zqsd") => () => { input.setScheme(n); flash("controls: " + n); titleMenu = mainTitleMenu; };
  const controlsMenu = new Menu("CONTROLS", [
    { label: "Arrows", action: setScheme("arrows") },
    { label: "WASD", action: setScheme("wasd") },
    { label: "ZQSD", action: setScheme("zqsd") },
    { label: "WASD + Arrows", action: setScheme("both") },
    { label: "Back", action: () => { titleMenu = mainTitleMenu; } },
  ]);
  let titleMenu: Menu = mainTitleMenu;

  // in-game pause menu (objMenu): Save is SHADOWED while a cutscene plays (gameMaster.isMenuItemShadowed).
  const pauseMenu = new Menu("PAUSED", [
    { label: "Resume", action: () => scene.closeOverlay() },
    { label: "Save game", action: () => { doSave(); flash("game saved"); scene.closeOverlay(); }, shadowed: () => scene.isCutscene() },
    { label: "Load game", action: () => { if (doLoad()) flash("game loaded"); scene.closeOverlay(); } },
    { label: "Return to title", action: () => scene.toTitle() },
  ]);

  // death pathway (objPlayerMerlinCharacter.takeHit -> #die -> attemptRespawn / gameOver). The die anim
  // plays, then: lives>0 -> respawn in place (keep playing); else -> game-over -> wasted cutscene -> reload.
  function resolveDeath() {
    const respawned = player.send("attemptRespawn") as boolean; // modExtraLives.attemptRespawn (in place)
    if (respawned) { audio.play("level_up"); return; }          // banked a life: back on your feet
    scene.gameOver(!!wastedScript);                             // else: wasted cutscene -> #loadGame
  }

  const loop = new GameLoop(
    () => {
      game.tick++;
      if (input.pressed("m")) { flash(audio.toggleMute() ? "sound off" : "sound on"); } // global mute
      const s = scene.current();
      if (s === "title") {
        titleMenu.tick(input);
      } else if (s === "controls") {
        controlsMenu.tick(input);
      } else if (scene.isCutscene()) {
        // intro / wasted / gameComplete: a Thespian cutscene drives real actors; on finish, route by script.
        if (!cutscene || cutscene.tick(input)) {
          const which = scene.activeCutScene();
          cutscene = null;
          if (which) scene.cutSceneFinished(which);
        }
      } else if (s === "game") {
        if (scene.isPaused()) {
          if (input.pressed("escape")) scene.escapePressed(); else pauseMenu.tick(input);
          input.endTick(); return;
        }
        if (input.pressed("escape")) { scene.escapePressed(); input.endTick(); return; }
        if (input.pressed("1")) { doSave(); flash("game saved"); }
        if (input.pressed("2")) { if (doLoad()) flash("game loaded"); }
        // refresh the team roster + unit-map broad-phase BEFORE AIs run (teamMaster.findTarget /
        // impactMeleeAttack read a current map). Drops dead/left targets, firing #leaveGame.
        rebuildCombatSubstrate();
        for (let i = 0, n = game.entities.length; i < n; i++) game.entities[i]!.send("update");
        sweepBullets();
        for (let i = game.entities.length - 1; i >= 0; i--) { // sweep collected pickups
          const e = game.entities[i]!;
          if (e.type === "pickup" && e.send("isFinished")) game.entities.splice(i, 1);
        }
        rooms.update();
        // death: let the die animation play (deathT frames) before resolving respawn/game-over.
        if (player.send("isDead")) { if (deathT === 0) deathT = 1; }
        if (deathT > 0 && ++deathT > 36) { deathT = 0; resolveDeath(); }
      } else if (s === "victory") {
        if (input.pressed(" ") || input.pressed("enter")) scene.toTitle();
      }
      input.endTick();
    },
    () => {
      renderer.clear();
      const s = scene.current();
      if (s === "title") { drawTitle(renderer, viewW, viewH); titleMenu.render(renderer, viewW, viewH, false); return; }
      if (s === "controls") { drawTitle(renderer, viewW, viewH); controlsMenu.render(renderer, viewW, viewH, false); return; }
      if (scene.isCutscene() && cutscene) { cutscene.render(renderer); return; }
      if (!rooms) { drawTitle(renderer, viewW, viewH); return; }
      const passive = rooms.room.layer("#backgroundPassive");
      const active = rooms.room.layer("#backgroundActive");
      if (passive && rooms.passiveSheet) renderer.drawTileLayer(passive, rooms.passiveSheet);
      if (active && rooms.activeSheet) renderer.drawTileLayer(active, rooms.activeSheet);
      const sprites = game.entities
        .filter((e) => e.type !== "bullet" && e.type !== "pickup" && e.type !== "marker")
        .map((e) => e.get(Anim).sprite()).filter((sp): sp is Sprite => sp !== null);
      renderer.drawSprites(sprites);
      drawBullets(renderer);
      drawPickups(renderer);
      // #foregroundPassive (objRoom layer, gMapLayer over the actor band): F1 preserved the data; this
      // draws it OVER the actors (after drawSprites). pFrontLayerBlendLevel=128 -> globalAlpha 0.5 default.
      const fg = rooms.room.layer("#foregroundPassive");
      if (fg && rooms.foregroundSheet) renderer.drawTileLayer(fg, rooms.foregroundSheet, 0, 0, 0.5);
      for (const e of game.entities) {
        if (e.type === "enemy") drawEnemyBar(renderer, e, "#e44");
        else if (e.type === "ally") drawEnemyBar(renderer, e, "#4d6");
      }
      drawCharge(renderer, player);
      drawHud(renderer, player);
      // 5-state minimap (modMiniMap): #cur/#clr/#inf (+ data #fre/#spe) with a proximity distance blend.
      const pm = player.get(Movement);
      drawMinimap(renderer, {
        map, loc: rooms.loc, cleared: rooms.clearedSet(), infested: rooms.infestedRooms(),
        playerPx: { x: pm.x, y: pm.y }, cursorPx: game.input.cursor(),
      }, viewW);
      if (s === "victory") drawVictory(renderer, viewW, viewH);
      if (scene.isPaused()) pauseMenu.render(renderer, viewW, viewH);
    },
  );
  loop.start();
  (window as any).__game = game;
  (window as any).__scene = scene;
  (window as any).__startGame = () => scene.startGameFromTitle();
  (window as any).__rooms = () => rooms;
  // __mode: a compatibility shim for the smoke tools (title/cutscene/playing/paused/gameover/victory).
  (window as any).__mode = () => {
    const s = scene.current();
    if (s === "intro") return "cutscene";
    if (s === "gameOver" || s === "gameComplete") return "cutscene";
    if (s === "game") return scene.isPaused() ? "paused" : "playing";
    if (s === "victory") return "victory";
    return s;
  };
  (window as any).__cut = () => cutscene;
  (window as any).__bulletStats = bulletPoolStats;
  (window as any).__audio = audio;
  console.log("Merlin's Revenge —", loaded.meta.id, map.mapSize.x + "x" + map.mapSize.y, "room dungeon ready (title screen)");
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

// (the old "YOU HAVE FALLEN" game-over overlay is gone: death now plays the wasted cutscene -> reload.)
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

main().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement("pre"), { textContent: String(e), style: "color:#f88" })); });
