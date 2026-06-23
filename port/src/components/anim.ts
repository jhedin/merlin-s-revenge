// Animation component (modAnimSet + objAnimStrip): picks an action strip from the entity's mode
// (dead->grave, moving->walk, else stand) and advances frames on a PER-FRAME delay (objAnimStrip's
// pDelayList: each frame carries its own `dela`), scaled by gGameSpeed (pDelay.inc = 1*gGameSpeed).
// Loop vs one-shot is DATA-DRIVEN (anim.loop from assets.json, derived from the action classification
// in the builder — see plan §C.3.2): cyclic strips wrap, one-shot strips advance-and-hold. Sprites
// are mirrored by facing direction. Provides the render Sprite (tint/alpha from ColourTransform).

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { ColourTransform } from "./colourTransform";
import { game } from "../game/context";
import { registry } from "../game/data";
import type { Sprite } from "../render/renderer";

// A few actors carry no bundled art of their own (#inherit:CPUCharacter, no #character, and no extracted
// sprite — e.g. the dwelling residents goblinArcher / swordNinja / skeletonWarrior and the friendly goblin
// variants). Map them to their closest bundled KIN sprite so a goblin/skeleton/ninja spawner produces the
// right FAMILY, not the generic blackOrc stand-in ("wrong enemies" from spawners).
const CHAR_ALIAS: Record<string, string> = {
  goblinHero: "goblinWarrior",
  // match the unit's COMBAT TYPE so a ranged unit looks ranged and a melee unit looks melee — otherwise an
  // archer wearing a swordsman sprite reads as "a swordsman shooting arrows" (and vice-versa).
  goblinArcher: "archer", friendlyGoblinArcher: "archer",           // ranged -> an archer sprite
  friendlyGoblinWarrior: "goblinWarrior", swordNinja: "ninja",      // melee  -> a melee sprite
  skeletonWarrior: "skelitonFootSoldier",                           // melee skeleton (not skeletonArcher)
  friendlyGoblinMage: "goblinMage",                                 // caster
};

/** The sprite character for an actor, or a stand-in ("blackOrc") when its anims aren't bundled. */
export function spriteCharOr(name: string, fallback = "blackOrc"): string {
  // modAnimSet/objAnimSet key sprite strips by the actor's #name, NOT its record key: fireDragon/dragon
  // -> "dragon", goblinArcher -> "gar", skeletonWarrior -> "skw", lavaGolem -> "lavaDarkGolem", the
  // summonOrc/Golem/Warrior units and the cutscene wizards (berlinInGame -> "ber") all render off #name.
  // The port already does this for bullet chars; do it for actors too — else they fall back to blackOrc /
  // a wrong kin alias. Only switch when the #name strip is actually bundled (else keep the key/alias path).
  const anims = game.assets?.index?.anims;
  if (!anims) return name; // assets not loaded (some unit tests) — keep the raw key, the prior default
  const rec = registry.resolveActor(name);
  const dn = rec && typeof rec["name"] === "string" ? (rec["name"] as string).replace(/^#/, "") : "";
  if (dn && anims[`${dn}_stand`]) return dn;
  if (anims[`${name}_stand`]) return name;
  const alias = CHAR_ALIAS[name];
  if (alias && anims[`${alias}_stand`]) return alias;
  // #character fallback (the actor's character TYPE): kingStones -> king, friendlyGoblinMage -> goblinMage,
  // ochre -> ochreWizard. Rescues actors whose own #name strip is missing from the dump but whose character
  // art is bundled — closer than the blackOrc fallback. Only reached after #name/key/alias all miss.
  const chr = rec && typeof rec["character"] === "string" ? (rec["character"] as string).replace(/^#/, "") : "";
  if (chr && anims[`${chr}_stand`]) return chr;
  return fallback;
}

// Fallback one-shot classification when an anim's `loop` flag is absent (old assets.json). Mirrors the
// builder's ONE_SHOT_ACTIONS so behaviour is identical pre/post-rebuild. The data flag (anim.loop) wins.
const ONE_SHOT_FALLBACK = new Set([
  "grave", "die", "reel",
  "naturalMelee", "weaponMelee", "magicMelee", "weaponMagic",
  "release", "weaponRanged", "naturalRanged",
]);

export class Anim extends Component {
  static handles = ["update", "syncAnimAfterRestore"];
  char = "mer";
  private action = "stand";
  private frame = 0;
  private timer = 0;
  // objAnimStrip frame-event latches (set per Anim.update, read by the animation-driven attack drivers):
  // justAdvanced = the strip advanced a frame THIS tick (getFrameFresh); justLooped = it wrapped / a one-shot
  // reached its last frame THIS tick (getLooped). So a #animframe hit fires once per frame, and the attack
  // window ends exactly when the strip completes — the animation is the clock.
  private justAdvanced = false;
  private justLooped = false;
  private extraDelay = 0;   // modWeaponTechnique.frameExtendDelay: extra frames added to the current frame's delay
  // modStretchDeath (act_player #stretchDeath): a magical death — the body stretches vertically + fades to
  // transparent over STRETCH_DURATION frames instead of switching to a grave, then resolves (gameOver).
  private stretchDeath = false;
  private deathT = 0;
  private static readonly STRETCH_DURATION = 33; // blendSpeed 3: ~100/3 frames to fade out
  private static readonly STRETCH_AMOUNT = 0.7;  // scaleY 1 -> 1.7 (stretchHeight 50, anchored at the feet)
  // modTeleport (armyTeleportIn/Out): the summon/desummon "beam" — the sprite stretches vertically to/from a
  // tall thin streak (anchored at the feet) while fading in/out over TELE_FRAMES. "in" plays as a freshly
  // summoned unit collapses into place; "out" as a desummoned/retired unit stretches away (the caller defers
  // removal until teleportOutDone()).
  private teleport: "in" | "out" | null = null;
  private teleT = 0;
  private static readonly TELE_FRAMES = 15;  // pTeleportFrames
  private static readonly TELE_PEAK = 6;     // scaleY at the fully-stretched streak (pTeleportHeight, capped)

  override init(cfg: Record<string, any>): void {
    this.char = cfg["animChar"] ?? "mer"; this.extraDelay = 0;
    this.stretchDeath = cfg["stretchDeath"] === true; this.deathT = 0;
  }
  override reset(): void { this.deathT = 0; }

  /** modStretchDeath #stretchDeathFin: true once the stretch+fade transform has fully played out — the
   *  death-resolution signal (the original fires gameOver/respawn HERE, not on a separate hand-tuned timer).
   *  False for a non-stretch-death actor, so the caller falls back to its own delay. */
  stretchDeathDone(): boolean {
    return this.stretchDeath && this.entity.send("isDead") === true && this.deathT >= Anim.STRETCH_DURATION;
  }
  hasStretchDeath(): boolean { return this.stretchDeath; }

  // modTeleport seams. startTeleportIn: a freshly summoned unit beams in. startTeleportOut: a desummoned unit
  // beams out (idempotent). teleportOutDone: the out-beam has fully played (caller may now remove the entity).
  startTeleportIn(): void { this.teleport = "in"; this.teleT = 0; }
  startTeleportOut(): void { if (this.teleport !== "out") { this.teleport = "out"; this.teleT = 0; } }
  teleportOutDone(): boolean { return this.teleport === "out" && this.teleT >= Anim.TELE_FRAMES; }
  isTeleportingOut(): boolean { return this.teleport === "out"; }

  // restart the current action strip from frame 0 (ensureMode re-entry): a NEW attack/swing replays its
  // one-shot strip even though the action STRING is unchanged across consecutive swings — without this the
  // strip plays once then holds its last frame for every following swing (the "stuck on the last frame" bug).
  restart(): void { this.frame = 0; this.timer = 0; this.extraDelay = 0; this.justAdvanced = false; this.justLooped = false; }

  // syncAnimAfterRestore (objRoom.restoreState / save-load): respawnActor restores the entity's combat
  // state (energy.dead, stretchDeath, etc.) AFTER the archetype build left Anim at its default "stand". If
  // we wait for the first update() to run pickAction, a freshly-restored DEAD actor renders ONE frame as a
  // live stand pose before snapping to its grave — the "units spawn as not graves, then instantly switch"
  // flicker on room re-entry. Prime the action from the now-restored state so the very first sprite is right.
  syncAnimAfterRestore(): void {
    this.deathT = this.stretchDeath && this.entity.send("isDead") === true ? Anim.STRETCH_DURATION : 0;
    const a = this.pickAction();
    if (a !== this.action) { this.action = a; this.frame = 0; this.timer = 0; this.extraDelay = 0; }
  }

  // ── objAnimStrip frame state, for the animation-driven attack drivers (control.ts) ──────────────
  /** getFrame: current 1-based frame index of the active strip (Lingo #animframe values are 1-based). */
  attackFrame(): number { return this.frame + 1; }
  /** getFrameFresh: true only on the tick the strip just advanced a frame (a #animframe fires once). */
  frameFresh(): boolean { return this.justAdvanced; }
  /** getLooped: true on the tick the strip wrapped / a one-shot reached its last frame (attack complete). */
  looped(): boolean { return this.justLooped; }
  /** the active strip has >1 frame and so can drive frame-events; a 0/1-frame strip can't (caller falls back). */
  canAnimate(): boolean { const a = this.animFor(this.action); return !!a && a.frames.length > 1; }

  // frameAdvance (modWeaponTechnique.skipFramesForWeaponTechnique → me.big.frameAdvance): step the strip
  // one frame early (faster attack cadence). Wraps for looped strips, clamps for one-shots; resets the
  // per-frame timer so the early advance counts as a fresh frame.
  frameAdvance(): void {
    const anim = this.animFor(this.action);
    if (!anim || anim.frames.length <= 1) return;
    if (this.isLooped(this.action, anim)) this.frame = (this.frame + 1) % anim.frames.length;
    else this.frame = Math.min(this.frame + 1, anim.frames.length - 1);
    this.timer = 0;
  }
  // frameExtendDelay (modWeaponTechnique.addFramesForWeaponTechnique → me.big.frameExtendDelay): hold the
  // current frame for `n` extra delay-ticks (slower attack cadence for negative-technique units).
  frameExtendDelay(n: number): void { this.extraDelay += Math.max(0, n); }

  private pickAction(): string {
    // modWastedMode: a WASTED actor (the game-over cutscene's Merlin) is "dead" by energy but still animates
    // normally — wastedModeOn only blends+stretches him, it never changes the strip. So it walks on / stands
    // / speaks under the usual walk/stand pick, NOT the grave/stretch-death path (which would freeze a frame).
    const deadAnim = this.entity.send("isDead") === true && this.entity.send("isWasted") !== true;
    // modStretchDeath: a stretch-death unit keeps its BODY frame while it stretches+fades (no grave swap).
    if (deadAnim && this.stretchDeath) return this.action === "grave" ? "stand" : this.action;
    if (deadAnim) return "grave";
    const override = this.entity.send("animAction"); // control may force charge/release/punch
    if (typeof override === "string") return override;
    return this.entity.get(Movement).moving() ? "walk" : "stand";
  }

  // looped (objAnimStrip.getLooped via modAnimSet): true if the strip cycles. Data-driven from
  // anim.loop; falls back to the action-name classification if the flag is missing.
  private isLooped(action: string, anim: { loop?: boolean }): boolean {
    return anim.loop ?? !ONE_SHOT_FALLBACK.has(action);
  }

  update(next: NextFn): void {
    this.justAdvanced = false; this.justLooped = false; // frame-event latches, set only on an advance this tick
    // modStretchDeath transform progress: advance while the stretch-death unit is dead; reset on revive
    // (extra-life respawn in place) so the next death stretches from scratch.
    if (this.stretchDeath) {
      // a wasted actor is "dead" but NOT stretch-dying (the wasted cutscene presents him fresh) — hold the
      // transform at 0 so he isn't ALSO faded/stretched by modStretchDeath on top of the wasted blend.
      const stretchDying = this.entity.send("isDead") === true && this.entity.send("isWasted") !== true;
      if (stretchDying) { if (this.deathT <= Anim.STRETCH_DURATION) this.deathT++; }
      else if (this.deathT > 0) this.deathT = 0;
    }
    if (this.teleport) {
      if (this.teleT < Anim.TELE_FRAMES) this.teleT++;
      else if (this.teleport === "in") this.teleport = null; // in-beam complete -> resume normal render
    }
    const action = this.pickAction();
    if (action !== this.action) {
      // entering a new strip: its first frame (frame 0 / attackFrame 1) is FRESHLY shown this tick, so it
      // counts as a frame crossing (objAnimStrip onAttackFrame: currentFrame==animFrame matches the first
      // DISPLAYED frame). Without this, frame 0 is only ever reset-to, never advanced-into, so any #animframe
      // that lists frame 1 can never fire its first hit — a general off-by-one. Consumed only by the attack/
      // swing drivers, which gate on #animframe membership, so a strip whose list omits 1 sees no spurious
      // hit; the only shipped weapon affected is flameThrower [1,3,5,7] (the fireDragon breath: 4 shots, was 3).
      this.action = action; this.frame = 0; this.timer = 0; this.extraDelay = 0; this.justAdvanced = true;
    }
    const anim = this.animFor(action);
    // A grave holds a SINGLE static frame (modGrave.drawGrave captures getAnimMemberFromStrip(#grave) — the
    // current member — once at death; the corpse is then background, not an animating sprite). Don't advance.
    const isGrave = this.entity.send("isDead") === true && this.entity.send("getGraveOn") === true;
    if (!isGrave && anim && anim.frames.length > 1) {
      // per-frame delay (objAnimStrip.moveNextFrame: pDelay.tim[2] = pDelayList.nextValue()): the current
      // frame's own `dela` gates the advance; the counter steps by gGameSpeed (pDelay.inc = 1*gGameSpeed).
      const cur = anim.frames[this.frame % anim.frames.length]!;
      // modWeaponTechnique.frameExtendDelay adds `extraDelay` to this frame's own `dela` (slower cadence).
      const frameDelay = Math.max(1, (cur.dela ?? anim.delay) + this.extraDelay);
      this.timer += game.gameSpeed;
      if (this.timer >= frameDelay) {
        this.timer = 0; this.extraDelay = 0; // the held-extra is spent once this frame finally advances
        const prev = this.frame, last = anim.frames.length - 1, looped = this.isLooped(action, anim);
        // cyclic strips wrap; one-shot strips advance to the last frame and hold (data-driven loop flag)
        if (looped) this.frame = (this.frame + 1) % anim.frames.length;
        else this.frame = Math.min(this.frame + 1, last);
        if (this.frame !== prev) {
          this.justAdvanced = true;
          // getLooped: the strip completed a play THIS tick — a looped strip wrapping to 0, or a one-shot
          // reaching its last frame (the original exits #attack mode on this event via attackFin).
          if (looped ? this.frame === 0 : this.frame === last) this.justLooped = true;
        }
      }
    }
    next();
  }

  private animFor(action: string) {
    const idx = game.assets.index.anims;
    return idx[`${this.char}_${action}`] ?? idx[`${this.char}_stand`];
  }

  sprite(): Sprite | null {
    const m = this.entity.get(Movement);
    // modGrave: a DEAD actor is its own grave. A ghost (pGraveOn=false) leaves NO grave — it vanishes when
    // finished; every other dead actor holds the #grave frame BEHIND the living (the original draws it into
    // the room background — modelled here as a low render-z) and faces RIGHT (drawGrave: setFlipFromDir(1)).
    // getGraveOn is undefined for the player (no grave system — its in-game death plays on the normal path).
    // a wasted actor (game-over cutscene Merlin) is energy-dead but renders as a normal live frame here —
    // the cutscene host applies the modWastedMode blend (0.3) + vertical stretch, so Anim must NOT also
    // draw him as a grave or stretch-death body.
    const dead = this.entity.send("isDead") === true && this.entity.send("isWasted") !== true;
    const graveOn = this.entity.send("getGraveOn"); // true=leaves grave, false=ghost, undefined=player
    const stretching = dead && this.stretchDeath;   // modStretchDeath: stretch+fade instead of grave/vanish
    if (dead && graveOn === false && !stretching) return null; // ghost: no grave, vanishes
    const isGrave = dead && graveOn === true;
    const anim = this.animFor(this.action);
    if (!anim || anim.frames.length === 0) return null;
    const f = anim.frames[this.frame % anim.frames.length]!;
    // frames load lazily per map; a char spawned mid-run (e.g. a summon) may not be loaded yet —
    // kick off its load and skip this frame rather than throwing (it'll draw next tick once ready).
    if (!game.assets.images.has(f.file)) { void game.assets.ensureChar(this.char); return null; }
    // tint: the real modColourTransform palette (white flick on hit, glowRed/Teal/Gold). Falls back to
    // the binary white flash (isHurt) only when no ColourTransform component is present on this archetype.
    const ct = this.entity.tryGet(ColourTransform);
    // a GRAVE is a plain static background blit — NO glow. Drop any tint the unit carried at death (a
    // glowRed low-health pulse / glowTeal freeze), else the corpse flashes red/teal forever.
    const tint = isGrave ? null
      : ct ? ct.getColourTransform() : (this.entity.send("isHurt") === true ? { rgb: [255, 255, 255] as [number, number, number], strength: 0.85, additive: false } : null);
    const alpha = this.entity.send("getAlpha"); // per-sprite alpha (globalAlpha), default opaque
    // modStretchDeath transforms: startTransBlend(out) fades opacity 1->0; startStretchHeight stretches the
    // body taller (anchored at the feet via the reg point) — both over STRETCH_DURATION.
    const prog = stretching ? Math.min(1, this.deathT / Anim.STRETCH_DURATION) : 0;
    // modTeleport beam (overrides the normal scale/alpha): "in" collapses from a tall streak to 1x as it
    // fades in; "out" stretches up to the streak as it fades out — both anchored at the feet (the reg point).
    const teleProg = this.teleport ? Math.min(1, this.teleT / Anim.TELE_FRAMES) : 0;
    const teleScaleY = this.teleport === "in" ? 1 + (Anim.TELE_PEAK - 1) * (1 - teleProg)
      : this.teleport === "out" ? 1 + (Anim.TELE_PEAK - 1) * teleProg : undefined;
    const teleAlpha = this.teleport === "in" ? teleProg : this.teleport === "out" ? 1 - teleProg : undefined;
    return {
      img: game.assets.img(f.file),
      x: m.x, y: m.y, regX: f.reg[0], regY: f.reg[1],
      // painter's depth by world-y; a grave sits BEHIND every live actor (room-background blit) while still
      // ordering grave-vs-grave by y — a large negative bias keeps it under the living band.
      z: isGrave ? m.y - 100000 : m.y,
      flip: isGrave ? false : m.facingLeft, // graves face right (setFlipFromDir(1)); else mirror to aim dir
      tint: tint ?? undefined,
      scaleY: teleScaleY ?? (stretching ? 1 + prog * Anim.STRETCH_AMOUNT : undefined),
      alpha: teleAlpha ?? (stretching ? 1 - prog : (typeof alpha === "number" ? alpha : undefined)),
    };
  }
}

