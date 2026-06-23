// Thespian cutscene engine (modThespian + cutSceneMaster + objScriptPerformer + objScript collapsed
// into ONE runner, since the port has no objectMaster/structMaster to split them across). It drives
// REAL spawned entities through their gameplay Movement/Anim modules — a cutscene "character" IS the
// same Entity the gameplay spawns (objScriptPerformer.createMissingPlayers -> actorMaster.newActor),
// animating itself through walk/stand/teleport, not a bespoke draw path.
//
// Phases mirror the original (objScriptPerformer.startPerformance):
//   acquirePlayers -> createMissingPlayers (spawn cast at the wings) -> performNextLine loop -> finish.
//
// Two line-completion models (A1.2):
//   - sync verbs (at/walkTo/goMode/turnToFace/teleport/...): run + fall through to the next line SAME tick.
//   - async verbs (speakLine/wait/lights/fade): set `pending` (a frame timer or a fader count) that gates
//     lineFinished -> performNextLine. speakLine auto-advances after displayTime+delayTime frames (NO key).
//
// #key interpolation (interpretSpeechVariables) is re-evaluated at DISPLAY time, so rebinding keys updates
// already-authored lines.

import type { Cutscene, CutStep, CutArg } from "../data/cutscene";
import { makeEntityId, type Entity } from "../engine/dispatch";
import { Movement } from "../components/movement";
import { Anim } from "../components/anim";
import { Energy, Team } from "../components/combat";
import { Identity } from "../components/identity";
import { WastedMode } from "../components/wasted";
import { Archetype } from "../engine/dispatch";
import { registry } from "../game/data";
import { game } from "../game/context";

// objScriptPerformer timing (objScriptPerformer.txt:27-31): a line shows for basicTimePerLine +
// chars·timePerLetter frames, then delayTime (timeBetweenLines) frames of cleared speech.
const BASIC_TIME_PER_LINE = 50;
const TIME_PER_LETTER = 1.4;
const TIME_BETWEEN_LINES = 12;
const FADE_DURATION = 50;     // lights/fade window: startSlowFade(In/Out) = startTransBlend(speed 2) = 100/2 = 50 frames
const WALK_SPEED_PX = 2.4;    // cutscene walk px/tick (the wings/stage geometry is view-space)

// The anim-sheet name for a cutscene character (the sheets are anm_mer/uli/ber/tv/presto…, NOT the actor
// alias). Resolve like a live actor: the actor's data #name keys its sprite sheet (objCharacter.getCharacter
// → the #name strip). So prestotolin → #name "presto" → presto_stand (NOT slice(0,3)="pre", which is blank
// and renders the actor INVISIBLE all scene). Falls back to the name itself, then the first-3-chars heuristic.
const CUT_ANIM_CHAR: Record<string, string> = { merlin: "mer", ulin: "uli", berlin: "ber", tv: "tv" };
function cutAnimChar(name: string): string {
  if (CUT_ANIM_CHAR[name]) return CUT_ANIM_CHAR[name];
  const anims = game.assets?.index.anims;
  if (anims?.[`${name}_stand`]) return name;
  // the actor's data #name owns the sprite sheet (presto/amotonlin/… in-game wizards share a #name with the sheet).
  const dataName = (registry.resolveActor(name) ?? {})["name"];
  if (typeof dataName === "string" && anims?.[`${dataName.replace(/^#/, "")}_stand`]) return dataName.replace(/^#/, "");
  return name.slice(0, 3);
}

// A minimal cutscene-actor archetype: Identity + Movement + Anim + Energy + Team. Enough to walk, stand,
// face, and (for the wasted scene) be squashed — driven entirely by the Thespian, never by the combat
// loop (cutscene actors are NOT added to game.entities, so AIs/collision never touch them).
const CutActorArchetype = new Archetype("cutscene", [Identity, Movement, Anim, Energy, WastedMode, Team], {
  defaults: { isDead: false, getTeam: "", getTeamRole: "#teamMembers", isFrozen: false, freezeFactor: 1, isInvince: false, isHurt: false, getActorType: "", animAction: null, isReelProof: false, isWasted: false },
});

/** A cutscene character: a live entity + per-actor cutscene state (walk target, prop, wasted). */
interface Player {
  alias: string;
  entity: Entity;
  spawned: boolean;        // true if the Thespian created it (finish on scene end)
  walkTarget: { x: number; y: number } | null;
  onArrive: (() => void) | null;
  wasted: boolean;
  modeOverride: string | null; // goMode override (#stand/#look) routed to Anim.animAction
  visible: boolean;
  // K16 prop link (modThespian.produceProp / carryProp): a character can be CARRIED by another as a prop.
  // While #prop, the carried actor's position tracks its carrier (+offset) and turnToFace is suppressed.
  propStatus: "notAProp" | "prop"; // me.big.getPropStatus
  carriedBy: Player | null;        // the carrier this prop tracks
  carryOffset: { x: number; y: number };
  // K16 per-actor fade (K17 fader): each actor fades under its OWN fader; the line completes only when
  // every started fader reaches its target (objScriptPerformer.pWaitingForPlayers count-to-zero).
  alpha: number;                   // 1 = lit, 0 = faded out (the per-sprite alpha the host renders)
  fadeTarget: number | null;       // the alpha this actor is fading toward (null = not fading)
  // K16 walkScroll (modThespian.startWalkScrollLeft/Right): continuous scroll-walk until stop.
  scrollDir: number;               // -1 left, +1 right, 0 none
}

export interface ThespianHost {
  /** view dimensions (the cutscene stage rect). */
  viewW: number; viewH: number;
  /** play a sound / music member (soundMaster). */
  playSound?(member: string, volume: number): void;
  playMusic?(member: string, volume: number): void;
  /** look up the live bound key for a control name (#key interpolation). */
  keyForControl?(control: string): string;
  /** bind an existing entity to an alias instead of spawning (the wasted scene drives the real Merlin). */
  bound?: Record<string, Entity>;
  /** K12: #ingame environment (calcEnvironment: no background sprite). The scene plays over the LIVE game
   *  view (no full-stage geometry) and speech renders as a bubble above the speaker's head, not a caption.
   *  Actor locs in the script are world coords; spawned actors place straight in world space. */
  ingame?: boolean;
}

export interface SpeechState { speaker: string; text: string; alias: string; }

export class Thespian {
  private players = new Map<string, Player>();
  private lineIdx = 0;
  private pending: { left: number } | null = null;     // async-verb frame gate (wait/speak/fade)
  private finished = false;
  private cancelled = false;

  // stage state (cutSceneMaster pBackground/pTitle/lights)
  bg = { r: 10, g: 16, b: 24 };
  private bgTarget = { r: 10, g: 16, b: 24 };
  // objTransColour: backgroundColourTo is a PERCENT tween from the current colour to the target over a FIXED
  // 100/speed frames (speed 2 -> 50), independent of the colour distance — NOT a per-channel step rate.
  private bgStart = { r: 10, g: 16, b: 24 };
  private bgTweenT = 1; private bgTweenDur = 1; // progress / total frames (T>=Dur => settled)
  private bgSpeed = 10;         // remembered flash speed (pBackgroundRandomFlashSpeed); backgroundColourTo is speed 2
  private bgFlash = false;      // K16 backgroundColourRandomFlash: self-restarting random-target loop
  lights = true;
  private lightsTarget = true;
  private lightsAlpha = 0; // 0 = lit, 1 = dark; tweened toward lightsTarget (legacy stage darkness)
  // K17 per-actor fader: the line completes only when this count of started faders reaches zero
  // (objScriptPerformer.pWaitingForPlayers — each playerFaderFin decrements; 0 -> lineFinished).
  private waitingForFaders = 0;
  title = "";
  // objCutSceneTitle lifecycle: cross-fade IN, HOLD ~150 frames, fade OUT, then clear. titleAlpha (0..1)
  // drives the host draw; the port previously popped the title on and never hid it.
  titleAlpha = 0;
  private titlePhase: 0 | 1 | 2 | 3 = 0;   // 0 none, 1 fade-in, 2 hold, 3 fade-out
  private titleT = 0;
  private static readonly TITLE_FADE = 25; // objCutSceneTitle colour-transform speed 4 -> 100/4 = 25 frames
  private static readonly TITLE_HOLD = 150;
  speech: SpeechState | null = null;

  private readonly floor: number;
  private readonly stageLeft: number;
  private readonly stageRight: number;
  readonly ingame: boolean;

  constructor(private cut: Cutscene, private host: ThespianHost) {
    this.ingame = host.ingame === true;
    // getStageFloor: the original ground line is stageRect.bottom - 16 (actors stand near the bottom edge).
    // The in-game path keeps actors at their world y, so the floor only matters for the full-cutscene stage.
    this.floor = this.ingame ? Math.round(host.viewH * 0.6) : host.viewH - 16;
    this.stageLeft = 24; this.stageRight = host.viewW - 24;
    this.acquirePlayers();
  }

  /** acquirePlayers + createMissingPlayers: spawn (or bind) each character at the wings (offscreen). */
  private acquirePlayers(): void {
    for (const [alias, sym] of Object.entries(this.cut.chars)) {
      const name = sym.replace(/^#/, "");
      const bound = this.host.bound?.[alias];
      let entity: Entity; let spawned: boolean;
      if (bound) { entity = bound; spawned = false; }
      else { entity = this.spawnCutActor(name); spawned = true; }
      // In an #ingame scene a BOUND actor is the live Merlin — leave it at its live position, visible,
      // never parked at the wings (it stays part of the on-screen game). Spawned actors still wait offstage.
      const liveBound = this.ingame && !spawned;
      this.players.set(alias, {
        alias, entity, spawned, walkTarget: null, onArrive: null, wasted: false, modeOverride: null,
        visible: liveBound,
        propStatus: "notAProp", carriedBy: null, carryOffset: { x: 0, y: 0 },
        alpha: 1, fadeTarget: null, scrollDir: 0,
      });
      if (liveBound) continue;
      // park at the wings (offscreen) until a verb places it.
      const m = entity.get(Movement); m.x = -200; m.y = this.floor; m.vx = m.vy = 0;
    }
  }

  private spawnCutActor(name: string): Entity {
    const d = registry.resolveActor(name) ?? {};
    const team = typeof d["team"] === "string" ? (d["team"] as string) : "#chatters";
    const e = CutActorArchetype.create(makeEntityId());
    e.type = "cutscene";
    return e.build({ x: -200, y: this.floor, walkSpeed: 99, accel: 99, friction: 0,
      animChar: cutAnimChar(name), team, energy: 100, box: 8, actorType: name });
  }

  private player(alias: string): Player | undefined { return this.players.get(alias); }

  /** interpretLoc(x): a bare number -> point(x, floor); a point passes through. */
  private interpretLoc(arg: CutArg): { x: number; y: number } {
    if (arg.kind === "point") return { x: arg.x, y: arg.y };
    if (arg.kind === "number") return { x: arg.n, y: this.floor };
    return { x: this.host.viewW / 2, y: this.floor };
  }

  /** the active speech (for the host renderer). */
  getSpeech(): SpeechState | null { return this.speech; }
  /** every visible cutscene actor (for the host renderer to draw). */
  visibleActors(): Player[] { return [...this.players.values()].filter((p) => p.visible); }
  /** visible actors the Thespian SPAWNED (excludes bound live-game actors that the game loop already
   *  renders) — the in-game host draws these in world space over the live view. */
  spawnedVisibleActors(): Player[] { return [...this.players.values()].filter((p) => p.visible && p.spawned); }
  /** the live position of a speaking actor (for the in-game speech bubble above its head). */
  speakerPos(alias: string): { x: number; y: number } | null {
    const p = this.players.get(alias); if (!p) return null;
    const m = p.entity.get(Movement); return { x: m.x, y: m.y };
  }
  // objCutSceneTitle: cross-fade in over TITLE_FADE, hold TITLE_HOLD, fade out over TITLE_FADE, then clear.
  private tickTitle(): void {
    if (this.titlePhase === 0) return;
    this.titleT++;
    if (this.titlePhase === 1) {                                  // fade in
      this.titleAlpha = Math.min(1, this.titleT / Thespian.TITLE_FADE);
      if (this.titleT >= Thespian.TITLE_FADE) { this.titlePhase = 2; this.titleT = 0; this.titleAlpha = 1; }
    } else if (this.titlePhase === 2) {                           // hold
      if (this.titleT >= Thespian.TITLE_HOLD) { this.titlePhase = 3; this.titleT = 0; }
    } else {                                                      // fade out
      this.titleAlpha = Math.max(0, 1 - this.titleT / Thespian.TITLE_FADE);
      if (this.titleT >= Thespian.TITLE_FADE) { this.titlePhase = 0; this.titleAlpha = 0; this.title = ""; }
    }
  }

  isFinished(): boolean { return this.finished; }

  /** ESC/space cancels the whole scene (scriptCancelled / pSkipCounter). */
  cancel(): void { this.cancelled = true; }

  // advance one tick. Returns true when the scene is finished (or cancelled). Drives each actor's
  // Movement/Anim (cutscene actors aren't in game.entities, so the combat loop never updates them).
  tick(): boolean {
    if (this.finished) return true;
    if (this.cancelled) { this.finish(); return true; }
    this.tweenStage();         // advances the per-actor faders (decrements waitingForFaders on completion)
    this.driveActors();
    this.tickTitle();          // objCutSceneTitle: fade-in -> hold -> fade-out -> clear
    // async gate: tick the timer; when it expires, fall through to the next line(s).
    if (this.pending) {
      if (--this.pending.left > 0) return false;
      this.pending = null;
      this.speech = null; // delay-after-line cleared the bubble
    }
    // K17 fader gate: lights/fade lines complete only when EVERY started fader reaches its target
    // (objScriptPerformer.pWaitingForPlayers -> 0). Block the chain while faders are still running.
    if (this.waitingForFaders > 0) return false;
    this.performLines();
    return this.finished;
  }

  // performNextLine loop: run sync verbs until one sets `pending`/a fader (async) or the script ends.
  private performLines(): void {
    while (!this.pending && this.waitingForFaders === 0 && this.lineIdx < this.cut.steps.length) {
      const step = this.cut.steps[this.lineIdx++]!;
      this.performLine(step);
    }
    if (!this.pending && this.waitingForFaders === 0 && this.lineIdx >= this.cut.steps.length) this.finish();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.speech = null;
    // putCreatedPlayersIntoWings + finishPlayersInWings: remove every actor the Thespian spawned.
    for (const p of this.players.values()) if (p.spawned) p.entity.resetForPool?.();
    this.players.clear();
  }

  // performLine: dispatch the verb to its real-actor / global effect, mirroring modThespian.performLine
  // (actor verbs) + cutSceneMaster.performLine (global verbs).
  private performLine(step: CutStep): void {
    if (step.kind === "say") { this.speakLine(step.alias, step.text); return; }
    const p = step.actor ? this.player(step.actor) : undefined;
    switch (step.verb) {
      // --- actor verbs (drive the real entity) ---
      case "at": if (p) this.at(p, this.interpretLoc(step.arg)); break;
      case "walkTo": if (p) this.walkTo(p, this.interpretLoc(step.arg)); break;
      case "teleportInAt": if (p) { this.at(p, this.interpretLoc(step.arg)); this.setMode(p, "teleportIn"); } break;
      case "teleportOut": if (p) { this.setMode(p, "teleportOut"); this.gotoWings(p); } break;
      case "turnToFace": if (p && step.arg.kind === "actor") this.turnToFace(p, step.arg.alias); break;
      case "walkToPlayer": case "atPlayer": if (p && step.arg.kind === "actor") this.toPlayer(p, step.arg.alias, step.verb === "walkToPlayer"); break;
      case "goMode": if (p && step.arg.kind === "symbol") this.setMode(p, step.arg.sym.replace(/^#/, "")); break;
      case "goWastedMode": if (p) this.goWastedMode(p); break;
      case "enterStageLeft": if (p) { this.at(p, { x: this.stageLeft - 60, y: this.floor }); this.walkTo(p, { x: this.stageLeft + 40, y: this.floor }); } break;
      case "enterStageRight": if (p) { this.at(p, { x: this.stageRight + 60, y: this.floor }); this.walkTo(p, { x: this.stageRight - 40, y: this.floor }); } break;
      case "exitStageLeft": if (p) this.exitStage(p, "left"); break;
      case "exitStageRight": if (p) this.exitStage(p, "right"); break;
      case "gotoWings": if (p) this.gotoWings(p); break;
      // propAt (modThespian.propAt): set #prop status THEN teleport there (a character placed as a prop).
      case "propAt": if (p) { p.propStatus = "prop"; this.at(p, this.interpretLoc(step.arg)); p.visible = true; } break;
      // K16 prop verbs (modThespian.produceProp/putAwayProp/dropProp): a character carried by another.
      case "produceProp": if (p && step.arg.kind === "actor") this.produceProp(p, step.arg.alias); break;
      case "putAwayProp": if (p) this.putAwayProp(p, true); break;  // snap to carrier's wings (offscreen)
      case "dropProp": if (p) this.putAwayProp(p, false); break;    // leave at the current loc
      case "fadeDown": if (p) this.fadeActor(p, 0); break;          // K17: this actor's OWN fader (count gate)
      // --- global verbs ---
      case "wait": this.pending = { left: step.arg.kind === "number" ? Math.max(1, Math.round(step.arg.n)) : 30 }; break;
      case "backgroundColourTo": if (step.arg.kind === "rgb") { this.bgFlash = false; this.startBgTween({ r: step.arg.r, g: step.arg.g, b: step.arg.b }, 2); } break;
      case "lightsUp": this.lightsChange(1); break;   // K17: each actor fades IN under its own fader
      case "lightsDown": this.lightsChange(0); break; // K17: each actor fades OUT under its own fader
      case "showTitle": this.title = step.arg.kind === "text" ? step.arg.text : step.args.join(" ");
        this.titlePhase = 1; this.titleT = 0; this.titleAlpha = 0; break; // start the fade-in/hold/out
      case "setStage": this.setStage(); break;
      case "playSound": if (step.arg.kind === "sound") this.host.playSound?.(step.arg.member, step.arg.volume); break;
      case "playMusic": if (step.arg.kind === "sound") this.host.playMusic?.(step.arg.member, step.arg.volume); break;
      // K16 walkScroll (cutSceneMaster.walkScroll* -> putPlayersIntoWalkMode): continuous scroll-walk until stop.
      case "walkScrollRight": this.putPlayersIntoWalkMode(1); break;
      case "walkScrollLeft": this.putPlayersIntoWalkMode(-1); break;
      case "walkScrollStop": this.putPlayersIntoWalkMode(0); break;
      // K16 backgroundColourRandomFlash (cutSceneMaster: goMode + self-restarting random colour-tween loop).
      case "backgroundColourRandomFlash": this.startBgRandomFlash(step.arg.kind === "number" ? step.arg.n : undefined); break;
      default: break;
    }
  }

  // --- verb effects ---

  private at(p: Player, loc: { x: number; y: number }): void {
    const m = p.entity.get(Movement);
    m.x = loc.x; m.y = loc.y; m.vx = m.vy = 0;
    p.walkTarget = null; p.onArrive = null; p.visible = true;
  }

  // walkTo: the actor keeps walking under its own Movement; the SCRIPT does not block on arrival (A1.2).
  private walkTo(p: Player, loc: { x: number; y: number }): void {
    p.walkTarget = { ...loc }; p.onArrive = null; p.visible = true;
    const m = p.entity.get(Movement);
    m.facingLeft = loc.x < m.x;
  }

  private turnToFace(p: Player, otherAlias: string): void {
    const other = this.player(otherAlias); if (!other) return;
    const m = p.entity.get(Movement); const om = other.entity.get(Movement);
    m.facingLeft = om.x < m.x;
  }

  private toPlayer(p: Player, otherAlias: string, walk: boolean): void {
    const other = this.player(otherAlias); if (!other) return;
    const om = other.entity.get(Movement);
    const loc = { x: om.x + (om.x < p.entity.get(Movement).x ? 30 : -30), y: this.floor };
    if (walk) this.walkTo(p, loc); else this.at(p, loc);
  }

  private setMode(p: Player, mode: string): void {
    p.modeOverride = mode === "stand" ? null : mode; // #stand falls back to the default pick
    p.visible = true;
  }

  private goWastedMode(p: Player): void {
    // modWastedMode.wastedModeOn does ONLY setBlend(30) + setAnimKeepSize(true) + setSpriteHeight(60): a
    // translucent vertical STRETCH. It does NOT change the animation — the wasted actor keeps walking/
    // standing under the normal anim system (he walks on, walks off, then speaks). The earlier port forced
    // a "die" pose here, which froze him on the mer_die frame the whole scene (wrong frame). Just flag him
    // wasted; the WastedMode component (isWasted) makes Anim animate normally despite the dead energy, and
    // the cutscene renderer applies the blend + stretch.
    p.wasted = true; p.visible = true;
    p.entity.send("goWastedMode");
  }

  // exitStage: walk off to the wings, then snap offscreen on arrival (pExitingStage + moveToLocFinished).
  // This does NOT block the line chain (it's actor-internal); the engine fires it and moves on.
  private exitStage(p: Player, dir: "left" | "right"): void {
    const target = dir === "left" ? { x: this.stageLeft - 80, y: this.floor } : { x: this.stageRight + 80, y: this.floor };
    this.walkTo(p, target);
    p.onArrive = () => this.gotoWings(p);
  }

  private gotoWings(p: Player): void {
    const m = p.entity.get(Movement); m.x = -200; m.y = this.floor; m.vx = m.vy = 0;
    p.walkTarget = null; p.onArrive = null; p.visible = false;
  }

  // K17 lightsChange (objScriptPerformer.lightsChange): start a fade on EVERY actor, count the started
  // faders (pWaitingForPlayers). The line completes only when all reach the target (playerFaderFin -> 0).
  private lightsChange(target: number): void {
    this.lightsTarget = target >= 0.5;
    this.waitingForFaders = 0;
    for (const p of this.players.values()) { p.fadeTarget = target; this.waitingForFaders += 1; }
  }

  // fadeActor (modThespian.fadeDown -> startSlowFadeOut): a SINGLE actor's own fader (count gate of 1).
  private fadeActor(p: Player, target: number): void {
    p.fadeTarget = target; this.waitingForFaders += 1;
  }

  // K16 produceProp (modThespian.produceProp -> carryProp + beProducedAsProp): `p` carries `propAlias` as
  // a prop. The carried actor's position tracks the carrier (+ a wings offset) and is marked #prop.
  private produceProp(p: Player, propAlias: string): void {
    const prop = this.player(propAlias); if (!prop) return;
    prop.propStatus = "prop"; prop.carriedBy = p; prop.visible = true;
    prop.walkTarget = null; prop.onArrive = null; prop.scrollDir = 0;
    const m = p.entity.get(Movement);
    prop.carryOffset = { x: m.facingLeft ? -14 : 14, y: -10 }; // carried at the carrier's wings
  }

  // K16 putAwayProp / dropProp (modThespian.putAwayProp/dropProp): release the prop link. putAway snaps the
  // prop to the carrier's wings (offscreen); drop leaves it at its current loc.
  private putAwayProp(p: Player, away: boolean): void {
    // the verb targets the CARRIER; find which prop it carries.
    const prop = [...this.players.values()].find((q) => q.carriedBy === p) ?? p;
    prop.carriedBy = null; prop.propStatus = "notAProp";
    if (away) this.gotoWings(prop);
  }

  // K16 walkScroll (cutSceneMaster.putPlayersIntoWalkMode -> modThespian.startWalkScroll*): set every
  // non-prop actor scrolling continuously in `dir` until stop. A #prop character exits the stage instead.
  private putPlayersIntoWalkMode(dir: number): void {
    for (const p of this.players.values()) {
      if (p.propStatus === "prop") {
        if (dir !== 0) this.exitStage(p, dir > 0 ? "left" : "right"); // propExitStage* (rides off)
        continue;
      }
      p.scrollDir = dir;
      if (dir !== 0) { p.visible = true; const m = p.entity.get(Movement); m.facingLeft = dir < 0; }
    }
  }

  // K16 backgroundColourRandomFlash (cutSceneMaster: a self-restarting random-target colour loop). Fire-
  // and-forget (sync + falls through). backgroundColourTo / setStage cancels it (bgFlash=false).
  private startBgRandomFlash(speed?: number): void {
    this.bgFlash = true;
    this.bgSpeed = speed && speed > 0 ? speed : 10; // pBackgroundRandomFlashDefaultSpeed = 10
    this.pickRandomBgTarget();
  }
  private pickRandomBgTarget(): void {
    this.startBgTween({ r: this.randByte(), g: this.randByte(), b: this.randByte() }, this.bgSpeed); // ColourRandom
  }
  // objTransColour.calcStart: begin a percent tween from the current colour to `target` over 100/speed frames.
  private startBgTween(target: { r: number; g: number; b: number }, speed: number): void {
    this.bgStart = { ...this.bg };
    this.bgTarget = { ...target };
    this.bgTweenDur = Math.max(1, Math.round(100 / Math.max(1, speed)));
    this.bgTweenT = 0;
  }
  private randByte(): number {
    const r = game.rng?.next ? game.rng.next() : Math.random();
    return Math.floor(r * 256) & 255;
  }

  private setStage(): void {
    // putPlayersIntoWings + makePlayersInvisible + backgroundColour(pSetSceneColour). pSetSceneColour =
    // rgb(0,0,0): setStage SNAPS the stage to BLACK (an instant backgroundColour, not a tween), so a later
    // backgroundColourTo fades up FROM black. (The port previously left the bg at its default slate blue.)
    this.bgFlash = false; // backgroundColour cancels any random flash (cutSceneMaster.backgroundColour -> goMode #none)
    for (const p of this.players.values()) { p.scrollDir = 0; this.gotoWings(p); }
    this.bg = { r: 0, g: 0, b: 0 }; this.bgStart = { r: 0, g: 0, b: 0 }; this.bgTarget = { r: 0, g: 0, b: 0 };
    this.bgTweenT = this.bgTweenDur = 1; // settled (no in-progress tween)
  }

  private speakLine(alias: string, text: string): void {
    const p = this.player(alias);
    if (p) p.visible = true;
    const sym = this.cut.chars[alias] ?? alias;
    let speaker = sym.replace(/^#/, "");
    if (speaker === "playerCharacter") speaker = "merlin"; // the stones bind #playerCharacter -> the live Merlin
    const display = this.interpretSpeech(text); // #key interpolation re-evaluated at display time
    this.speech = { speaker, text: display, alias };
    // objScriptPerformer.performNextLine: pAutoTurn (default true) turns every OTHER on-stage actor to face
    // the speaker on each line (turnPlayersToFace). Props don't turn (their facing tracks their carrier).
    for (const [a, listener] of this.players) {
      if (a === alias || !listener.spawned || listener.propStatus === "prop") continue;
      this.turnToFace(listener, alias);
    }
    // displayTime = basicTimePerLine + chars·timePerLetter, then delayTime (timeBetweenLines)
    const displayTime = Math.round(BASIC_TIME_PER_LINE + display.length * TIME_PER_LETTER);
    this.pending = { left: displayTime + TIME_BETWEEN_LINES };
  }

  // interpretSpeechVariables (modThespian.txt:353): replace "#key <control>" with the live bound key,
  // re-evaluated each display. The original wraps it in literal QUOTE chars with the keyMaster's natural
  // casing (`... QUOTE & currentKey & QUOTE ...` -> `press "w"`) — NOT force-uppercased and unquoted. The
  // control token may be `#`-prefixed (the stones write `#key #wizard`) — strip the hash.
  private interpretSpeech(text: string): string {
    if (!text.includes("#key")) return text;
    return text.replace(/#key\s+#?(\w+)/g, (_m, ctrl: string) => {
      const k = this.host.keyForControl?.(ctrl);
      return k ? `"${k}"` : ctrl;
    });
  }

  // drive each actor's Movement toward its walk target, fire onArrive, and tick its Anim each frame.
  private driveActors(): void {
    for (const p of this.players.values()) {
      const m = p.entity.get(Movement);
      // K16 prop: a carried character tracks its carrier (+ offset); no walk of its own (modThespian.turnToFace
      // and walk are suppressed for a #prop).
      if (p.carriedBy) {
        const cm = p.carriedBy.entity.get(Movement);
        m.x = cm.x + p.carryOffset.x; m.y = cm.y + p.carryOffset.y; m.vx = m.vy = 0;
        continue;
      }
      if (p.scrollDir !== 0) {
        // K16 walkScroll: continuous scroll-walk at walk speed in scrollDir (lockTurnToFace).
        m.vx = p.scrollDir * WALK_SPEED_PX; m.vy = 0; m.x += m.vx; m.facingLeft = p.scrollDir < 0;
      } else if (p.walkTarget) {
        const dx = p.walkTarget.x - m.x, dy = p.walkTarget.y - m.y;
        const d = Math.hypot(dx, dy);
        if (d <= WALK_SPEED_PX) {
          m.x = p.walkTarget.x; m.y = p.walkTarget.y; m.vx = m.vy = 0;
          p.walkTarget = null;
          const cb = p.onArrive; p.onArrive = null; cb?.();
        } else {
          m.vx = (dx / d) * WALK_SPEED_PX; m.vy = (dy / d) * WALK_SPEED_PX;
          m.x += m.vx; m.y += m.vy;
          m.facingLeft = m.vx < 0;
        }
      } else { m.vx = m.vy = 0; }
      // advance the anim strip (walk while moving, else the mode override, else stand). A mode override
      // (#look/#teleportIn/#die/wasted) wins over stand when the actor is at rest — set it AFTER update
      // (which would otherwise pick stand) so the strip plays.
      const a = p.entity.tryGet(Anim);
      if (a) {
        a.update(() => {});
        if (p.modeOverride && !p.walkTarget) {
          const prev = (a as any).action;
          if (prev !== p.modeOverride) { (a as any).action = p.modeOverride; (a as any).frame = 0; (a as any).timer = 0; }
        }
      }
    }
  }

  private tweenStage(): void {
    // objTransColour: a PERCENT lerp from bgStart to bgTarget over bgTweenDur (= 100/speed) frames — a fixed
    // duration regardless of the colour distance (the port's old per-channel step rate took ~2× as long).
    if (this.bgTweenT < this.bgTweenDur) {
      this.bgTweenT++;
      const f = this.bgTweenT / this.bgTweenDur;
      this.bg.r = this.bgStart.r + (this.bgTarget.r - this.bgStart.r) * f;
      this.bg.g = this.bgStart.g + (this.bgTarget.g - this.bgStart.g) * f;
      this.bg.b = this.bgStart.b + (this.bgTarget.b - this.bgStart.b) * f;
    }
    // K16 backgroundColourRandomFlash: when the bg reaches its random target, pick a new one (the self-
    // restarting loop, cutSceneMaster.eventNotification(#colourTransformFin) -> backgroundColourToRandom).
    if (this.bgFlash && this.bgTweenT >= this.bgTweenDur) this.pickRandomBgTarget();
    // K17 per-actor faders: advance each fading actor's alpha toward its target; on arrival the fader
    // finishes (playerFaderFin) and decrements waitingForFaders. A uniform step, but per-actor state +
    // a count-to-zero gate (faithful completion model; actors CAN have different fade lengths).
    const da = 1 / FADE_DURATION;
    for (const p of this.players.values()) {
      if (p.fadeTarget === null) continue;
      if (p.alpha < p.fadeTarget) p.alpha = Math.min(p.fadeTarget, p.alpha + da);
      else if (p.alpha > p.fadeTarget) p.alpha = Math.max(p.fadeTarget, p.alpha - da);
      if (p.alpha === p.fadeTarget) { p.fadeTarget = null; this.waitingForFaders = Math.max(0, this.waitingForFaders - 1); }
    }
    // legacy stage darkness (the background dim), kept for the full-stage host renderer's overlay.
    if (this.lightsTarget && this.lightsAlpha > 0) this.lightsAlpha = Math.max(0, this.lightsAlpha - da);
    else if (!this.lightsTarget && this.lightsAlpha < 1) this.lightsAlpha = Math.min(1, this.lightsAlpha + da);
    this.lights = this.lightsAlpha < 0.5;
  }

  /** lights dim factor 0..1 (0 lit, 1 black) for the host renderer. */
  darkness(): number { return this.lightsAlpha; }
  /** K17: a cutscene actor's per-actor fade alpha (1 lit, 0 faded) for the host renderer. */
  actorAlpha(p: Player): number { return p.alpha; }
  stageFloor(): number { return this.floor; }
}
