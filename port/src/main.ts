// Vertical-slice entry point. Loads a real map + assets, spawns a player and enemies built from
// component archetypes (all gameplay flows through the four-primitive dispatch), and runs a
// 30 Hz fixed-timestep loop: data -> world -> entities/dispatch -> render -> input -> combat.

import { Assets, mapList, type MapMeta } from "./render/assets";
import { drawText } from "./render/text";
import { Renderer, type Sprite } from "./render/renderer";
import { drawMinimap } from "./render/minimap";
import { healthBarColour } from "./render/healthBar";
import { drawHealthRollover, drawEnemyEnergyBars } from "./render/rollover";
import { Input } from "./systems/input";
import { AudioSystem } from "./systems/audio";
import { GameLoop } from "./engine/loop";
import { parseMap, type GameMap, type Vec2i } from "./world/map";
import { parseTileKey, tileSymbol, type TileKey } from "./data/tlk";
import { RoomManager, type ExitArrowRect } from "./world/rooms";
import { registry } from "./game/data";
import { resolveAttack } from "./components/weapon";
import { game, initContext } from "./game/context";
import { spawnPlayer, spawnEnemy, spawnUnit, spawnAlly } from "./entities/archetypes";
import { spawnFromSymbol } from "./entities/actorSerial";
import { Anim } from "./components/anim";
import { Energy } from "./components/combat";
import { Mana } from "./components/mana";
import { Experience } from "./components/experience";
import { Movement } from "./components/movement";
import { Projectile } from "./components/projectile";
import { sweepBullets, bulletPoolStats } from "./systems/bullets";
import { sweepSpells } from "./systems/spells";
import { SpellActor } from "./components/spellActor";
import { rebuildCombatSubstrate } from "./systems/combatTick";
import { saveGame, loadSave, buildSave, clearLegacy, pStateFromSave, hasSave } from "./systems/save";
import { parseCutscene, loadCutscene } from "./data/cutscene";
import { CutscenePlayer } from "./scenes/cutscenePlayer";
import { WeaponPalette } from "./scenes/weaponPalette";
import { Menu } from "./scenes/menu";
import { SceneManager, type CutScene } from "./scenes/sceneManager";
import { Screens } from "./scenes/screens";

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
  initContext({ input, assets, audio, tilePx: tile, entities: [], player: null, tick: 0, spawnEnemy, spawnUnit, spawnAlly, spawnFromSymbol });
  const weaponPalette = new WeaponPalette();
  game.weaponPalette = weaponPalette; // modWeaponSelector overlay (opened by the E key in PlayerControl)
  // teamMaster.pUnitMap sizing from the current map (getTileLoc: world loc -> tile, origin 0,0). Rooms
  // render from (0,0) at map.tilePx, so origin 0,0 / tile=map.tilePx (fallback 32) matches getTileLoc.
  game.teamMaster.unitMap.configure(tile || 32, 0, 0);
  game.teamMaster.bulletMap.configure(tile || 32, 0, 0); // K4: bullet broad-phase, same tiling as unitMap

  // --- scene state ---
  let player!: import("./engine/dispatch").Entity;
  let rooms!: RoomManager;
  let cutscene: CutscenePlayer | null = null;
  let inGameCut: CutscenePlayer | null = null;  // K12: a chatter stones cutscene over the live game view
  let inGameCutName: string | null = null;
  let victoryCredits = false; // K18: the credits scroll is running on the victory (game-complete) screen
  let deathT = 0; // die-animation delay before the death pathway resolves (modExtraLives.attemptRespawn)

  // K18 screen content (credits / showArmy / instructions / key-config), drawn over the live game / victory.
  const screens = new Screens(assets, viewW, viewH);

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
    if (s.sound) audio.setMuted(!!s.sound.muted); // soundMaster.restoreFromSave: restore the mute state
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
    game.wizardMaster.reset(); // forget found wizards (new game)
    game.potionMaster.reset(); // zero the potion tally
    player = spawnPlayer(viewW / 2, viewH / 2);
    game.player = player;
    game.entities = [player];
    // win on TWO triggers (H3): clear-all OR reach+clear the #endRoom (RoomManager.markCleared).
    rooms = new RoomManager(map, assets, activeKey, objectsKey, viewW, viewH, player,
      () => scene.gameComplete());
    // G2 army reserve: bank teleportable allies when leaving a room. They are re-fielded ONLY by the player's
    // explicit summonArmy (#army / C) or summonWizard (#wizard / Q) — interpretGameKeys, never automatically.
    rooms.onLeaveRoom = (leaving) => {
      for (let i = leaving.length - 1; i >= 0; i--) {
        const e = leaving[i]!;
        if (game.armyMaster.teleportOut(e)) {
          if (e.id === game.wizardMaster.activeWizardId) game.wizardMaster.clearActive(); // keep the singleton honest
          const idx = game.entities.indexOf(e);
          if (idx >= 0) game.entities.splice(idx, 1);
        }
      }
    };
    // NO room-enter auto-refield: the original re-fields the bank only on the army/wizard key (objAiPlayer
    // .interpretGameKeys). Auto-refielding dumped the whole army every room AND duplicated a summoned wizard
    // (the auto-refielded copy went untracked, so the next #wizard press spawned a second one).
    rooms.enter(map.startRoom);
    deathT = 0;
    audio.playMusic("electronic_merlin_v1_02"); // the dungeon theme
  }

  // SceneManager (movieMaster + screenMaster + gameMaster): the explicit scene FSM (replaces the mode var).
  // K19: a short inter-screen fade tween (screenMaster #fade); the goScreen action fires at its end. Kept
  // brief (3 frames ≈ 100ms) so it's visible without delaying the title->intro / victory->title flow.
  const SCREEN_TRANSITION_FRAMES = 3;
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
    // K12: play a chatter stone's #scriptToPerform over the LIVE game (the live Merlin bound as `m`,
    // ulin spawned). loadCutscene fetches+parses+caches the bundled scr_stonesN script on first trigger.
    playInGameCutScene: (name: string) => {
      inGameCutName = name;
      void loadCutscene(name, assets.index.cutscenes).then((cut) => {
        if (!cut || inGameCutName !== name) { if (inGameCutName === name) scene.cutSceneFinished(name); return; }
        audio.play("end_screen");
        inGameCut = CutscenePlayer.withBound(cut, assets, viewW, viewH, { ...cutHost, ingame: true }, { m: player });
      });
    },
  }, SCREEN_TRANSITION_FRAMES);
  // expose the cutscene trigger to the Chatter overlap FSM (minimal surface; avoids an import cycle).
  game.scene = { playInGameCutScene: (n) => scene.playInGameCutScene(n), isInGameCutscene: () => scene.isInGameCutscene() };

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

  // open a K18 overlay screen FROM the pause menu (gameMaster.menuOptionSelected -> screenOn). The base
  // stays paused; the overlay screen draws + handles input until it closes back to the ingame menu.
  const openScreen = (overlay: "showArmy" | "instructions" | "keyConfig") => () => {
    screens.open(overlay); scene.screenOn(overlay);
  };
  // in-game pause menu (objMenu): Save is SHADOWED while a cutscene plays (gameMaster.isMenuItemShadowed).
  const pauseMenu = new Menu("PAUSED", [
    { label: "Resume", action: () => scene.closeOverlay() },
    { label: "Save game", action: () => { doSave(); flash("game saved"); scene.closeOverlay(); }, shadowed: () => scene.isCutscene() },
    { label: "Load game", action: () => { if (doLoad()) flash("game loaded"); scene.closeOverlay(); }, shadowed: () => !hasSave() },
    { label: "Show army", action: openScreen("showArmy") },
    { label: "Instructions", action: openScreen("instructions") },
    { label: "Choose keys", action: openScreen("keyConfig") },
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
      // K19: an inter-screen transition tween is running — advance it (the goScreen action fires at its end)
      // and swallow this frame's input while it plays (no scene logic mid-transition).
      if (scene.isTransitioning()) { scene.tickTransition(); input.endTick(); return; }
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
        // K12: a chatter stones cutscene plays over the live game (combat paused). Tick it; on finish (or
        // skip), route through cutSceneFinished -> resume. While its script is still loading, just hold.
        if (scene.isInGameCutscene()) {
          if (inGameCut && inGameCut.tick(input)) {
            const name = inGameCutName; inGameCut = null; inGameCutName = null;
            if (name) scene.cutSceneFinished(name);
          }
          input.endTick(); return;
        }
        if (scene.isPaused()) {
          const ov = scene.currentOverlay();
          if (ov === "ingameMenu") {
            if (input.pressed("escape")) scene.escapePressed(); else pauseMenu.tick(input);
          } else if (ov) {
            // a K18 overlay screen (showArmy / instructions / key-config): on close, pop back to the menu.
            if (screens.handleInput(ov, input)) scene.screenOn("ingameMenu");
          }
          input.endTick(); return;
        }
        if (input.pressed("escape")) { scene.escapePressed(); input.endTick(); return; }
        // debug save/load: moved off 1/2 (now #spell1/#spell2 hotkeys) to F5/F9.
        if (input.pressed("f5")) { doSave(); flash("game saved"); }
        if (input.pressed("f9")) { if (doLoad()) flash("game loaded"); }
        // refresh the team roster + unit-map broad-phase BEFORE AIs run (teamMaster.findTarget /
        // impactMeleeAttack read a current map). Drops dead/left targets, firing #leaveGame.
        rebuildCombatSubstrate();
        for (let i = 0, n = game.entities.length; i < n; i++) game.entities[i]!.send("update");
        sweepBullets();
        sweepSpells(); // K2: return exploded spell actors to the pool
        for (let i = game.entities.length - 1; i >= 0; i--) { // sweep collected pickups + retired allies
          const e = game.entities[i]!;
          // `left`: a #leaveWhenFinished ally that teleported out (already banked to the reserve) — remove it,
          // but only once its #teleportOutStretch beam has finished playing (modTeleport). A `left` ally with
          // no Anim, or whose beam is done, is removed now.
          const beaming = e.flags.has("left") && e.tryGet(Anim)?.isTeleportingOut() === true && !e.get(Anim).teleportOutDone();
          if ((e.type === "pickup" && e.send("isFinished")) || (e.flags.has("left") && !beaming)) game.entities.splice(i, 1);
        }
        game.effects.update(); // advance level-up star particles (modStarReleaser)
        rooms.update();
        // death resolution (modStretchDeath -> #stretchDeathFin -> gameOver/respawn): drive it off the
        // stretch-death FINISHING — one signal, not a second hand-tuned timer that can desync from the
        // anim's STRETCH_DURATION. deathT is just a "death started" latch + a hard safety cap (a non-stretch
        // actor, or a stuck anim, still resolves at the cap).
        if (player.send("isDead")) { if (deathT === 0) deathT = 1; }
        if (deathT > 0) { deathT++; if (player.get(Anim).stretchDeathDone() || deathT > 40) { deathT = 0; resolveDeath(); } }
      } else if (s === "victory") {
        // K18: the game-complete cutscene routes to the CREDITS screen (creditsMaster) — scroll to the end,
        // then to the title. Space/enter skips. (movieMaster: gGameCompleteScript -> #creditsScreen -> title.)
        if (!victoryCredits) { victoryCredits = true; screens.openCredits(); }
        const done = screens.tickCredits();
        if (done || input.pressed(" ") || input.pressed("enter")) { victoryCredits = false; scene.toTitle(); }
      }
      input.endTick();
    },
    () => {
      renderer.clear();
      renderScene();
      // K19: the inter-screen fade tween — a black overlay rising 0->1 (off) then falling 1->0 (on) across
      // the transition, drawn over whatever screen is showing (the screen flips at the midpoint).
      if (scene.isTransitioning()) {
        const prog = scene.transitionProgress();                 // 0..1 across off+on
        const a = 1 - Math.abs(prog - 0.5) * 2;                   // triangle: 0 -> 1 (mid) -> 0
        renderer.ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
        renderer.ctx.fillRect(0, 0, viewW, viewH);
      }
    },
  );

  function renderScene() {
      const s = scene.current();
      if (s === "title") { drawTitle(renderer, viewW, viewH); titleMenu.render(renderer, viewW, viewH, false); return; }
      if (s === "controls") { drawTitle(renderer, viewW, viewH); controlsMenu.render(renderer, viewW, viewH, false); return; }
      if (scene.isCutscene() && cutscene) { cutscene.render(renderer); return; }
      if (s === "victory") { screens.renderCredits(renderer); return; } // K18: game-complete -> credits scroll
      if (!rooms) { drawTitle(renderer, viewW, viewH); return; }
      const passive = rooms.room.layer("#backgroundPassive");
      const active = rooms.room.layer("#backgroundActive");
      if (passive && rooms.passiveSheet) renderer.drawTileLayer(passive, rooms.passiveSheet);
      if (active && rooms.activeSheet) renderer.drawTileLayer(active, rooms.activeSheet);
      // K22 exit arrows (objRoom.drawExitArrows → modScreenExits.drawExitArrowsOnImage): the original bakes
      // these INTO the backgroundActive image, so actors draw OVER them. Draw here (after the active layer,
      // before the actor sprites) to match that z-order. No-op when the arrow art wasn't bundled.
      drawExitArrows(renderer, assets, rooms.exitArrowRects());
      game.effects.draw(renderer); // level-up stars (starMaster setLocZ-1: behind the actors)
      const sprites = game.entities
        .filter((e) => e.type !== "bullet" && e.type !== "pickup" && e.type !== "marker" && e.type !== "spell")
        .map((e) => e.get(Anim).sprite()).filter((sp): sp is Sprite => sp !== null);
      // pickups (objPotion/objScroll) sit at gGameObjectLayer=50 — z-sorted WITH the actors (a unit standing
      // in front occludes a ground pickup), NOT a flat overlay on top. Member-less pickups fall back to a diamond.
      const pickupFallback: import("./engine/dispatch").Entity[] = [];
      for (const e of game.entities) {
        if (e.type !== "pickup") continue;
        const sp = pickupSprite(e, assets);
        if (sp) sprites.push(sp); else pickupFallback.push(e);
      }
      renderer.drawSprites(sprites);
      if (pickupFallback.length) drawPickupFallback(renderer, pickupFallback);
      drawBullets(renderer);
      drawSpells(renderer); // K2: the growing/flying charge orbs (objSpell), over the actors
      // #foregroundPassive (objRoom layer, gMapLayer over the actor band): F1 preserved the data; this
      // draws it OVER the actors (after drawSprites). pFrontLayerBlendLevel=128 -> globalAlpha 0.5 default.
      const fg = rooms.room.layer("#foregroundPassive");
      if (fg && rooms.foregroundSheet) renderer.drawTileLayer(fg, rooms.foregroundSheet, 0, 0, 0.5);
      // The freeze visual is the entity's OWN teal-tinted sprite (modFreeze.glowTeal -> modColourTransform,
      // carried through Anim.sprite()'s tint), NOT a separate overlay — so no box is drawn here (the original
      // has no freeze-overlay object). Merlin's Revenge also has NO always-on health bars (gEnemyEnergyMasterOn
      // =0); health/level/XP show only on mouse-hover (rollover, below).
      drawEnemyEnergyBars(renderer, game.entities); // enemyEnergyMaster: team-colour bar over each DAMAGED CPU unit
      drawHealthRollover(renderer, game.input.cursor(), game.entities, assets); // characterEnergyRollOverMaster (gCharacterEnergyRolloverOn=1)
      weaponPalette.render(renderer, player, assets); // modWeaponSelector palette (over the world, under the HUD)
      drawHud(renderer, player, assets);
      // 5-state minimap (modMiniMap): #cur/#clr/#inf (+ data #fre/#spe) with a proximity distance blend.
      // modMiniMap is OFF by default (pShowMiniMap=false); goNavMode shows it, leaveNavMode hides it — so it
      // appears ONLY once the room is cleared (nav mode), as a "room safe" cue, not during combat.
      const pm = player.get(Movement);
      if (game.navMode) drawMinimap(renderer, {
        map, loc: rooms.loc, cleared: rooms.clearedSet(), infested: rooms.infestedRooms(),
        playerPx: { x: pm.x, y: pm.y }, cursorPx: game.input.cursor(),
      }, viewW, viewH, assets);
      // K12: overlay the in-game chatter cutscene (spawned ulin + speech bubble) over the live game.
      if (scene.isInGameCutscene() && inGameCut) inGameCut.renderInGame(renderer);
      // K18 overlays (showArmy / instructions / key-config) draw over the live game via the screens host.
      else if (scene.currentOverlay() && scene.currentOverlay() !== "ingameMenu") screens.render(renderer, scene.currentOverlay()!);
      if (scene.currentOverlay() === "ingameMenu") pauseMenu.render(renderer, viewW, viewH);
  }
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
  // debug: resolve an actor's #attack to an AttackData (for scripting grantSpell/equipSword in checks).
  (window as any).__resolveActor = (n: string) => registry.resolveActor(n);
  (window as any).__atk = (n: string) => resolveAttack((registry.resolveActor(n) ?? {})["attack"] as any, registry.resolveActor(n) as any);
  console.log("Merlin's Revenge —", loaded.meta.id, map.mapSize.x + "x" + map.mapSize.y, "room dungeon ready (title screen)");
}

function drawTitle(renderer: Renderer, w: number, h: number) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "#0a1020"; ctx.fillRect(0, 0, w, h);
  // SS-1: title via the #menu bitmap face (scaled ×2 for the big title), hints via #small. Falls back
  // to system fonts (the old fillText path) when the font art isn't bundled/loaded.
  const a = game.assets;
  ctx.fillStyle = "#fc4";
  drawText(ctx, a, "menu", "MERLIN'S REVENGE", w / 2, h / 2 - 48, { align: "center", scale: 2, fallbackFont: "bold 26px serif" });
  ctx.fillStyle = "#566";
  drawText(ctx, a, "small", "move: WASD/arrows   aim: mouse   hold to charge magic, release to cast   punch: auto", w / 2, h - 26, { align: "center", fallbackFont: "8px monospace" });
  drawText(ctx, a, "small", "spells: 1-9   save/load: F5/F9   pause: Esc   mute: M", w / 2, h - 14, { align: "center", fallbackFont: "8px monospace" });
  ctx.textAlign = "left";
}

// (the old "YOU HAVE FALLEN" game-over overlay is gone: death now plays the wasted cutscene -> reload;
// the static victory overlay is replaced by the K18 credits scroll on the victory screen.)

function drawHud(renderer: Renderer, player: import("./engine/dispatch").Entity, assets: Assets) {
  const ctx = renderer.ctx;
  const hp = player.get(Energy).energyFrac();
  const hasSpell = player.send("getHasSpell") as boolean;
  // health_bar_surround (objEnergyBar): the real bar FRAME is blitted first, then the energy fill is drawn
  // ON TOP of it, width-clipped to health % and inset by the 2px bar border — matching the original's
  // surround(locZ) + colour-dot(locZ+1, barBorder-inset) composite. (The surround interior is opaque, so
  // drawing it over the fill — as before — produced a flat blank bar.)
  const surround = assets.member("health_bar_surround");
  if (surround) {
    const b = 2; // barBorder (HUD)
    ctx.drawImage(surround.img, 8, 6);
    ctx.fillStyle = healthBarColour(hp);
    ctx.fillRect(8 + b, 6 + b, Math.round((surround.w - 2 * b) * hp), surround.h - 2 * b); // energy fill, on top
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(6, 6, 104, 24);
    ctx.fillStyle = healthBarColour(hp); ctx.fillRect(8, 8, 100 * hp, 6);
  }
  const xp = player.get(Experience);
  ctx.fillStyle = "#fc4"; ctx.fillRect(8, 22, 100 * Math.min(1, xp.frac()), 4);   // experience
  // no mana bar: magic has no pool (charge is shown by the orb over the head); flag once acquired
  // SS-1: "Lv" label via #small, the level number via #numbers (drawText routes the digit run). The ✦
  // magic-acquired glyph isn't in any font key → kept as a procedural fillText icon.
  ctx.fillStyle = "#fff";
  drawText(ctx, assets, "small", "Lv " + xp.level, 114, 24, { fallbackFont: "8px monospace" });
  if (hasSpell) { ctx.fillStyle = "#fc8"; ctx.font = "8px monospace"; ctx.fillText("✦", 114, 13); } // magic acquired (icon, not a font glyph)
  // medikit bank (medikitMaster.objMedikitDisplayer): a row of on/off kit icons for the banked count.
  const kits = (player.send("getNumOfMedikits") as number) || 0;
  const onImg = assets.member("medikit_on"), offImg = assets.member("medikit_off");
  if (onImg && offImg) {
    const slots = Math.max(3, kits); // at least the 3 default slots, grows if the player banks more
    for (let i = 0; i < slots; i++) ctx.drawImage((i < kits ? onImg : offImg).img, 8 + i * 10, 30);
  } else if (kits > 0) { ctx.fillStyle = "#f88"; drawText(ctx, assets, "small", "Kits " + kits, 8, 38, { fallbackFont: "8px monospace" }); }
  // extra lives (modExtraLives): no extraLives_text bitmap shipped, so a plain counter. The ♥ glyph
  // isn't in any font key → kept as a procedural icon; the count routes through #numbers via drawText.
  const lives = (player.send("getExtraLives") as number) || 0;
  if (lives > 0) { ctx.fillStyle = "#fff"; ctx.font = "8px monospace"; ctx.fillText("♥", 8, 50); drawText(ctx, assets, "numbers", String(lives), 18, 50, { fallbackFont: "8px monospace" }); }
  // SS-hud F2: GMG toggle icon (objGmgDisplayer.updateActive) — drawn only once collected; on/off mirrors
  // the live getGmgOn toggle. The port HUD has its own layout, so it sits right of the medikit kit row.
  if (player.send("getGmgCollected") as boolean) {
    const lit = player.send("getGmgOn") as boolean;
    const gimg = assets.member(lit ? "gmg_on" : "gmg_off");
    if (gimg) ctx.drawImage(gimg.img, 70, 30);
    else { ctx.fillStyle = lit ? "#ff4" : "#666"; drawText(ctx, assets, "small", "GMG", 70, 38, { fallbackFont: "8px monospace" }); }
  }
  // SS-hud F3: wizard summon portrait (objWizardDisplayer) — the SELECTED found wizard's bar portrait
  // (<sym>_off), with the yellow 16×16 wizard_on marker overlaid when one is currently summoned on the
  // field. Placed in the right HUD column below the GMG icon (the left column holds lives/flash).
  const wsym = game.wizardMaster.current();
  if (wsym) {
    const portrait = assets.member(wsym + "_off");
    if (portrait) ctx.drawImage(portrait.img, 70, 48);
    else { ctx.fillStyle = "#8cf"; drawText(ctx, assets, "small", wsym, 70, 56, { fallbackFont: "8px monospace" }); }
    if (game.wizardMaster.isSummoned) {
      const mark = assets.member("wizard_on");
      if (mark) ctx.drawImage(mark.img, 70, 48);
      else { ctx.strokeStyle = "#ff0"; ctx.strokeRect(70, 48, 16, 16); }
    }
  }
  if (Date.now() < flashUntil) { ctx.fillStyle = "#ff4"; drawText(ctx, assets, "small", flashMsg, 8, 62, { fallbackFont: "8px monospace" }); }
}

// pickup effect -> its static gfx member (objPotion/objMedikit #member: "<x>_potion"; objScroll #member:
// "<x>_scroll"). The scroll names key off the granted actor (SCROLL_ACTOR): spell->energyBlast, sword->
// merlinSword. darkBlast shares energyBlast's scroll art (act_darkBlast #member). These render as real
// bitmaps z-sorted with the actors (gGameObjectLayer), replacing the old procedural diamond.
const PICKUP_MEMBER: Record<string, string> = {
  heal: "medikit_potion", maxikit: "maxikit_potion", speed: "walkSpeed_potion",
  manaCapacity: "manaCapacity_potion", manaFlow: "manaFlow_potion", manaBurst: "manaBurst_potion",
  sword: "merlinSword_scroll", spell: "energyBlast_scroll", cBlast: "cBlast_scroll",
  darkBlast: "energyBlast_scroll", arcticBlast: "arcticBlast_scroll", healBlast: "healBlast_scroll",
  armySummon: "armySummon_scroll", monsterSummon: "monsterSummon_scroll", energyMines: "energyMines_scroll",
  energyPunch: "energyPunch_scroll", gmg: "gmg_scroll", energyBeam: "energyBeamSpell_scroll",
  energyPulse: "energyPulseSpell_scroll",
};
const PICKUP_COLOR: Record<string, string> = {
  heal: "#3d6", speed: "#4cf", power: "#c5f", sword: "#fe8", spell: "#fc8",
  manaCapacity: "#48f", manaFlow: "#4cf", manaBurst: "#88f",
};
// SS-hud F1: pickup effect -> its name-caption member (objPowerUpWriting <character>_writing). darkBlast
// shares energyBlast's caption; beams use their *Spell caption (mirrors PICKUP_MEMBER's shared scroll art).
const PICKUP_WRITING: Record<string, string> = {
  heal: "medikit_writing", maxikit: "maxikit_writing", speed: "walkSpeed_writing",
  manaCapacity: "manaCapacity_writing", manaFlow: "manaFlow_writing", manaBurst: "manaBurst_writing",
  sword: "merlinSword_writing", spell: "energyBlast_writing", energyPunch: "energyPunch_writing",
  cBlast: "cBlast_writing", darkBlast: "energyBlast_writing", arcticBlast: "arcticBlast_writing",
  healBlast: "healBlast_writing", armySummon: "armySummon_writing", monsterSummon: "monsterSummon_writing",
  energyMines: "energyMines_writing", gmg: "gmg_writing",
  energyBeam: "energyBeamSpell_writing", energyPulse: "energyPulseSpell_writing",
};
// a pickup's display sprite (its #member bitmap at the pickup loc), or null when the art isn't bundled.
// Once collected, objPowerUpWriting swaps to the <effect>_writing caption and fades it out in place — so
// the writing phase returns the caption member at the entity's fading alpha (centred via its reg point).
function pickupSprite(e: import("./engine/dispatch").Entity, assets: Assets): Sprite | null {
  const ph = e.send("writingPhase") as { effect: string; alpha: number } | null;
  const name = ph ? PICKUP_WRITING[ph.effect] : PICKUP_MEMBER[e.send("getEffect") as string];
  const mem = assets.member(name ?? "");
  if (!mem) return null;
  const m = e.get(Movement);
  return { img: mem.img, x: m.x, y: m.y, regX: mem.reg[0], regY: mem.reg[1], z: m.y, alpha: ph ? ph.alpha : undefined };
}
// fallback for any pickup whose art wasn't bundled: the old coloured diamond.
function drawPickupFallback(renderer: Renderer, pickups: import("./engine/dispatch").Entity[]) {
  const ctx = renderer.ctx;
  for (const e of pickups) {
    const m = e.get(Movement);
    ctx.fillStyle = PICKUP_COLOR[e.send("getEffect") as string] ?? "#fff";
    ctx.beginPath(); // diamond
    ctx.moveTo(m.x, m.y - 5); ctx.lineTo(m.x + 5, m.y); ctx.lineTo(m.x, m.y + 5); ctx.lineTo(m.x - 5, m.y);
    ctx.closePath(); ctx.fill();
  }
}

// K14: the energyBeam fly strip (act_energyBeam #member: anm_energyBeam_fly_03_01 -> char "energyBeam",
// action "fly"). The original setBeam stretches this sprite's WIDTH to the caster->target distance and
// rotates it to GeomAngle(caster,target), pivoting at the caster anchor. Loaded lazily (the spell is a
// pickup, so the char isn't in the map's spawn set); until the frame is in memory we fall back to a line.
const BEAM_ANIM = "energyBeam_fly";
const SPELL_ANIM = "spell_charge"; // act_spell #character:#spell -> the generic charge-orb anim (tinted per spell)

// K22: tile each arrow member across its exit rect (modScreenExits.drawExitArrowsOnImage → ImageDrawRepeated).
// The member image is repeated to fill the rect; clipped to the rect so a partial tile at the far end crops
// cleanly. No-ops per-rect when the colour/edge member wasn't bundled (guarded — never crashes on missing art).
function drawExitArrows(renderer: Renderer, assets: Assets, rects: ExitArrowRect[]) {
  if (rects.length === 0) return;
  const ctx = renderer.ctx;
  for (const r of rects) {
    const img = assets.arrowImg(r.colour, r.edge);
    if (!img) continue; // art not bundled for this colour/edge — skip (overlay no-ops)
    const iw = img.width, ih = img.height;
    if (iw === 0 || ih === 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    for (let dy = 0; dy < r.h; dy += ih)
      for (let dx = 0; dx < r.w; dx += iw)
        ctx.drawImage(img, r.x + dx, r.y + dy);
    ctx.restore();
  }
}

// K2 (objSpell render / modAnimSet + updateSize + setSpriteColour): a spell IS the generic `spell_charge`
// orb sprite (act_spell #character:#spell; getAnimSym maps charge/fly/explode -> #charge), TINTED to the
// spell's #chargeColour (setSpriteColour) and SCALED so its width/height = size = charge·chargeSize
// (updateSize). Falls back to the procedural gradient orb only when the art hasn't lazy-loaded yet.
function drawSpells(renderer: Renderer) {
  const ctx = renderer.ctx;
  const spellSprites: Sprite[] = [];
  const anim = game.assets.index.anims[SPELL_ANIM];
  const f = anim?.frames[0];
  const ready = !!f && game.assets.images.has(f.file);
  if (f && !ready) void game.assets.ensureChar("spell");
  for (const e of game.entities) {
    if (e.type !== "spell") continue;
    const sa = e.get(SpellActor);
    const m = e.get(Movement);
    // size = charge·chargeSize, NO minimum floor (objSpriteMember.setSpriteHeight has none). A Math.max(4,…)
    // floor here drew sub-4 charge orbs (the opening frames of every cast) too big AND ~1.5px too high (the
    // #top rise is computed from the true size while the floored size was painted). Faithful: paint the true size.
    const size = sa.size();
    const fade = sa.fadeAlpha(); // 1 while charging/flying; 1->0 over the post-explode quick-fade (grown orb)
    const [cr, cg, cb] = sa.attack.chargeColour;
    if (ready) {
      // setSpriteWidth/Height(size): scale the native frame to the live charge size about its centred reg.
      spellSprites.push({
        img: game.assets.img(f!.file)!,
        x: m.x, y: m.y, regX: f!.reg[0], regY: f!.reg[1], z: m.y,
        scaleX: size / Math.max(1, f!.w), scaleY: size / Math.max(1, f!.h),
        tint: { rgb: [cr, cg, cb], strength: 1, additive: false }, // setSpriteColour: tint the white orb
        alpha: fade,                                                 // startQuickFade: the explode flash fades out
      });
      // objSpellIcons.displayIconNumber: a SUMMON spell overlays the current tier's unit FACE on the orb
      // (spellIcons_<spellName>, frame = the tier number). It appears once the charge reaches the first
      // summon tier and changes as the charge crosses higher tiers (armySummon: warrior->archer->...->king).
      const ms = sa.attack.multistage;
      if (ms.length && sa.attack.explodeFunction.includes("summonUnit")) {
        let tier = 0;
        for (const t of ms) { if (t.chargeRequired <= sa.charge) tier++; else break; }
        if (tier > 0) {
          const ia = game.assets.index.anims[`spellIcons_${sa.attack.name.replace(/^#/, "")}`];
          const ifr = ia?.frames[Math.min(tier - 1, ia.frames.length - 1)];
          if (ifr && game.assets.images.has(ifr.file)) {
            spellSprites.push({ img: game.assets.img(ifr.file)!, x: m.x, y: m.y, regX: ifr.reg[0], regY: ifr.reg[1], z: m.y + 1 });
          } else if (ia) void game.assets.ensureChar("spellIcons");
        }
      }
      continue;
    }
    // fallback (art not yet loaded): the soft gradient orb, radius size/2.
    const r = size / 2;
    ctx.save();
    ctx.globalAlpha = fade; // startQuickFade: the grown orb fades out post-explode
    const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 1.6);
    grad.addColorStop(0, `rgba(255,255,255,0.95)`);
    grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.85)`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(m.x, m.y, r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (spellSprites.length) renderer.drawSprites(spellSprites);
}

function drawBullets(renderer: Renderer) {
  const ctx = renderer.ctx;
  // collect beam sprites so they go through the renderer's stretched/rotated sprite path (which
  // transforms about the registration point exactly like setSpriteRotation + setSpriteWidth).
  const beamSprites: Sprite[] = [];
  for (const e of game.entities) {
    if (e.type !== "bullet") continue;
    const m = e.get(Movement);
    const proj = e.get(Projectile);
    // I8/K14 energyBeam: the energyBeam fly strip stretched to the caster->target distance and rotated to
    // the beam angle (objBullet.setBeam: setSpriteWidth(dist) + setSpriteRotation(GeomAngle(distXY))).
    if (proj.beam) {
      // SS-vfx 2c: act_energyBeam is #type:#explode (#explodeEvents [#bulletArrivedAtTargetLoc,#bulletLanded])
      // — modExploder goMode(#explode) plays the energyBeam_explode burst AT the impact target. The beam
      // resolves on frame 0 then lingers beamLife frames, so draw the one-shot burst at the target end over
      // its life (un-rotated, clamped at the last frame), on TOP of the stretched beam line.
      drawBulletSprite(renderer, proj.char, m.x, m.y, 0, 0, proj.life, "_explode", false);
      const sp = beamSprite(proj);
      if (sp) { beamSprites.push(sp); continue; }
      // fallback (frame not loaded yet / art missing): a bright line caster->target. Kept so the beam is
      // always visible even on the first frames after the char's lazy load is kicked off.
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,120,0.9)"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(proj.beamCasterX, proj.beamCasterY); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(proj.beamCasterX, proj.beamCasterY); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.restore();
      continue;
    }
    // a detonated splash bullet plays its <char>_explode burst (modExploder #explode), un-rotated and one-shot.
    if (proj.exploding) {
      drawBulletSprite(renderer, proj.char, m.x, m.y, 0, 0, proj.life, "_explode", false);
    } else if (!drawBulletSprite(renderer, proj.char, m.x, m.y, m.vx, m.vy, proj.life)) {
      // objBullet sprite: the `<char>_fly` strip (archerArrow/gobarrow/axe/crossBolt…) rotated to the flight
      // direction. Falls back to a coloured dot only when the bullet has no sprite char or its art hasn't
      // lazy-loaded yet — so a thrown axe/arrow finally LOOKS like one (was a 3px dot).
      ctx.fillStyle = proj.team === "#aldevar" ? "#9cf" : "#fd6";
      ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (beamSprites.length) renderer.drawSprites(beamSprites);
}

// render a bullet's `<char>_fly` frame, animated over its life and rotated to its velocity (GeomAngle).
// Returns false (caller draws the dot) when there's no char or the art isn't loaded yet.
function drawBulletSprite(renderer: Renderer, char: string, x: number, y: number, vx: number, vy: number, life: number, suffix = "_fly", rotate = true): boolean {
  if (!char) return false;
  const anim = game.assets.index.anims[char + suffix];
  if (!anim || anim.frames.length === 0) return false;
  const dela = Math.max(1, anim.frames[0]!.dela ?? anim.delay ?? 1);
  const idx = Math.floor(life / dela);
  // _fly loops (a travelling bullet cycles its strip); _explode is one-shot (clamp at the last burst frame).
  const f = anim.frames[rotate ? idx % anim.frames.length : Math.min(idx, anim.frames.length - 1)]!;
  if (!game.assets.images.has(f.file)) { void game.assets.ensureChar(char); return false; }
  const img = game.assets.img(f.file) as CanvasImageSource | null;
  if (!img) return false;
  const ctx = renderer.ctx;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (rotate && (vx !== 0 || vy !== 0)) ctx.rotate(Math.atan2(vy, vx)); // art faces +x; rotate to the flight angle
  ctx.drawImage(img, -f.reg[0], -f.reg[1]);
  ctx.restore();
  return true;
}

// beamSprite: build the energyBeam fly sprite anchored at the caster anchor, stretched to the beam
// distance and rotated to the beam angle (objBullet.setBeam). Returns null (caller falls back to a line)
// when the art isn't bundled or its frame hasn't lazily loaded yet — kicks off the load on the way out.
function beamSprite(proj: Projectile): Sprite | null {
  const anim = game.assets.index.anims[BEAM_ANIM];
  const f = anim?.frames[0];
  if (!f) return null; // energyBeam art genuinely not bundled -> fall back to the line.
  if (!game.assets.images.has(f.file)) { void game.assets.ensureChar("energyBeam"); return null; }
  // setSpriteWidth(dist): horizontal stretch = dist / frame width. The strip is drawn left->right from
  // its registration point (regX 0 -> anchor at the caster, beam extends +X toward the target before the
  // rotation), regY centred so the strip straddles the beam line. setSpriteRotation(GeomAngle) = rotation.
  // brief beamLife flicker: alternate the strip's alpha across the beam's few frames (proj.life counts up
  // 0..beamLife in Projectile.update) so the beam shimmers as it sweeps out.
  const flicker = (proj.life & 1) ? 0.7 : 1;
  return {
    img: game.assets.img(f.file),
    x: proj.beamCasterX, y: proj.beamCasterY,
    regX: 0, regY: f.h / 2,
    z: proj.beamCasterY,
    rotation: proj.beamAngle,
    scaleX: proj.beamDist / Math.max(1, f.w),
    alpha: flicker,
  };
}


main().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement("pre"), { textContent: String(e), style: "color:#f88" })); });
