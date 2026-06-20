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
const FADE_DURATION = 18;     // shared all-actor fade window (lightsUp/Down/fadeDown faders)
const WALK_SPEED_PX = 2.4;    // cutscene walk px/tick (the wings/stage geometry is view-space)

// The abbreviated anim-sheet name for a cutscene character (the sheets are anm_mer/uli/ber/tv, NOT the
// actor name). Falls back to the first 3 chars (the original CutscenePlayer's heuristic).
const CUT_ANIM_CHAR: Record<string, string> = { merlin: "mer", ulin: "uli", berlin: "ber", tv: "tv" };
function cutAnimChar(name: string): string {
  if (CUT_ANIM_CHAR[name]) return CUT_ANIM_CHAR[name];
  return game.assets?.index.anims[`${name}_stand`] ? name : name.slice(0, 3);
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
}

export interface SpeechState { speaker: string; text: string; }

export class Thespian {
  private players = new Map<string, Player>();
  private lineIdx = 0;
  private pending: { left: number } | null = null;     // async-verb frame gate (wait/speak/fade)
  private finished = false;
  private cancelled = false;

  // stage state (cutSceneMaster pBackground/pTitle/lights)
  bg = { r: 10, g: 16, b: 24 };
  private bgTarget = { r: 10, g: 16, b: 24 };
  lights = true;
  private lightsTarget = true;
  private lightsAlpha = 0; // 0 = lit, 1 = dark; tweened toward lightsTarget
  title = "";
  speech: SpeechState | null = null;

  private readonly floor: number;
  private readonly stageLeft: number;
  private readonly stageRight: number;

  constructor(private cut: Cutscene, private host: ThespianHost) {
    this.floor = Math.round(host.viewH * 0.6);            // getStageFloor (the ground line)
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
      this.players.set(alias, {
        alias, entity, spawned, walkTarget: null, onArrive: null, wasted: false, modeOverride: null,
        visible: false,
      });
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
  isFinished(): boolean { return this.finished; }

  /** ESC/space cancels the whole scene (scriptCancelled / pSkipCounter). */
  cancel(): void { this.cancelled = true; }

  // advance one tick. Returns true when the scene is finished (or cancelled). Drives each actor's
  // Movement/Anim (cutscene actors aren't in game.entities, so the combat loop never updates them).
  tick(): boolean {
    if (this.finished) return true;
    if (this.cancelled) { this.finish(); return true; }
    this.tweenStage();
    this.driveActors();
    // async gate: tick the timer; when it expires, fall through to the next line(s).
    if (this.pending) {
      if (--this.pending.left > 0) return false;
      this.pending = null;
      this.speech = null; // delay-after-line cleared the bubble
    }
    this.performLines();
    return this.finished;
  }

  // performNextLine loop: run sync verbs until one sets `pending` (async) or the script ends.
  private performLines(): void {
    while (!this.pending && this.lineIdx < this.cut.steps.length) {
      const step = this.cut.steps[this.lineIdx++]!;
      this.performLine(step);
    }
    if (!this.pending && this.lineIdx >= this.cut.steps.length) this.finish();
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
      case "propAt": if (p) { this.at(p, this.interpretLoc(step.arg)); p.visible = true; } break;
      case "produceProp": case "putAwayProp": case "dropProp": break; // prop verbs staged behind core (plan §f.1)
      case "fadeDown": if (p) this.fadeDown(); break;
      // --- global verbs ---
      case "wait": this.pending = { left: step.arg.kind === "number" ? Math.max(1, Math.round(step.arg.n)) : 30 }; break;
      case "backgroundColourTo": if (step.arg.kind === "rgb") this.bgTarget = { r: step.arg.r, g: step.arg.g, b: step.arg.b }; break;
      case "lightsUp": this.lightsTarget = true; this.pending = { left: FADE_DURATION }; break;
      case "lightsDown": this.lightsTarget = false; this.pending = { left: FADE_DURATION }; break;
      case "showTitle": this.title = step.arg.kind === "text" ? step.arg.text : step.args.join(" "); break;
      case "setStage": this.setStage(); break;
      case "playSound": if (step.arg.kind === "sound") this.host.playSound?.(step.arg.member, step.arg.volume); break;
      case "playMusic": if (step.arg.kind === "sound") this.host.playMusic?.(step.arg.member, step.arg.volume); break;
      case "walkScrollRight": case "walkScrollLeft": case "walkScrollStop": break; // continuous scroll staged (plan §f.1)
      case "backgroundColourRandomFlash": break; // bg loop staged behind core
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
    p.wasted = true; p.visible = true;
    this.setMode(p, "die"); // modWastedMode: blend + squash; the port renders a die/grave-ish pose
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

  private fadeDown(): void { this.lightsTarget = false; this.pending = { left: FADE_DURATION }; }

  private setStage(): void {
    // putPlayersIntoWings + makePlayersInvisible + backgroundColour(setColour)
    for (const p of this.players.values()) this.gotoWings(p);
    this.bg = { ...this.bgTarget };
  }

  private speakLine(alias: string, text: string): void {
    const p = this.player(alias);
    if (p) p.visible = true;
    const sym = this.cut.chars[alias] ?? alias;
    const speaker = sym.replace(/^#/, "");
    const display = this.interpretSpeech(text); // #key interpolation re-evaluated at display time
    this.speech = { speaker, text: display };
    // displayTime = basicTimePerLine + chars·timePerLetter, then delayTime (timeBetweenLines)
    const displayTime = Math.round(BASIC_TIME_PER_LINE + display.length * TIME_PER_LETTER);
    this.pending = { left: displayTime + TIME_BETWEEN_LINES };
  }

  // interpretSpeechVariables: replace "#key <control>" with the live bound key (re-evaluated each display).
  private interpretSpeech(text: string): string {
    if (!text.includes("#key")) return text;
    return text.replace(/#key\s+(\w+)/g, (_m, ctrl: string) => {
      const k = this.host.keyForControl?.(ctrl);
      return k ? k.toUpperCase() : ctrl;
    });
  }

  // drive each actor's Movement toward its walk target, fire onArrive, and tick its Anim each frame.
  private driveActors(): void {
    for (const p of this.players.values()) {
      const m = p.entity.get(Movement);
      if (p.walkTarget) {
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
    const step = (cur: number, tgt: number) => cur + Math.max(-2, Math.min(2, tgt - cur));
    this.bg.r = step(this.bg.r, this.bgTarget.r);
    this.bg.g = step(this.bg.g, this.bgTarget.g);
    this.bg.b = step(this.bg.b, this.bgTarget.b);
    const da = 1 / FADE_DURATION;
    if (this.lightsTarget && this.lightsAlpha > 0) this.lightsAlpha = Math.max(0, this.lightsAlpha - da);
    else if (!this.lightsTarget && this.lightsAlpha < 1) this.lightsAlpha = Math.min(1, this.lightsAlpha + da);
    this.lights = this.lightsAlpha < 0.5;
  }

  /** lights dim factor 0..1 (0 lit, 1 black) for the host renderer. */
  darkness(): number { return this.lightsAlpha; }
  stageFloor(): number { return this.floor; }
}
