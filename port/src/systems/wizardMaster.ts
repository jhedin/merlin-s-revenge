// wizardMaster + modSummonWizard: the player can rescue/meet named wizards (act_*InGame, #wizard:true)
// then summon them as helper allies on demand.
//
//  - newWizardFound (objGameObject.init, params.wizard==true): a wizard actor registers itself the first
//    time it spawns. pWizardsFound determines who can be summoned and the cycle order. This does NOT show
//    the HUD portrait — see the "hasSelected" note below.
//  - selectNextWizard (#wizardSelector / Tab): cycle which found wizard will be summoned next.
//  - summonWizard (#wizard / Q): if a wizard is out, unsummon it; else summon the selected found wizard at
//    the cursor (createUnit from the army reserve when banked, else a fresh spawn) and track it.
//
// The original pulls strictly from the army reserve (the wizard must have been banked on a prior room-leave);
// the port falls back to a fresh spawn so a found wizard is always summonable — a documented adaptation that
// preserves the observable behaviour (meet a wizard -> summon it at will).
//
// HUD-portrait timing (a faithfully-reproduced ORIGINAL BUG, matching this project's convention of
// reproducing shipped bugs rather than the "intended" behavior — see docs/parity/audits/original-game-bugs.md):
// `objWizardDisplayer`'s auto-show-on-first-find branch (`wizardMaster.newWizardFound`, gated on
// `pSummonMod <> #none`) is DEAD in the shipped game — `registerMod` (the only thing that ever sets
// `pSummonMod`) is never called anywhere in the decompiled corpus. So finding a wizard shows NOTHING in the
// HUD; the portrait only appears once the player explicitly cycles selection (`selectNextWizard`/Tab, which
// calls `g.wizardMaster.setWizard` unconditionally) or a save with `pWizards.count <> 0` is restored
// (`modSummonWizard.restoreFromSave` also calls `setWizard` unconditionally). IMPORTANT: this ONLY gates the
// HUD portrait (`displayedWizard()`) — `modSummonWizard.summonWizard` (Q) reads `pWizardToSummon` directly
// (defaults to slot 1) and does NOT require the portrait to have ever been shown, so `current()`/
// `currentActorType()` (the summon-target accessors) stay UNGATED, matching the original's real Q-handler.
const SUFFIX = "InGame";

/** "amotonlinInGame" -> "amotonlin" (newWizardFound strips the trailing "InGame"). */
export function baseWizardSym(actorType: string): string {
  const s = actorType.replace(/^#/, "");
  return s.endsWith(SUFFIX) ? s.slice(0, -SUFFIX.length) : s;
}

export class WizardMaster {
  private found: string[] = [];   // base wizard syms in discovery order (pWizardsFound)
  private selected = 0;           // pWizardToSummon (0-based here)
  private hasSelected = false;    // true once selectNext() or a save-restore has actually shown a portrait
  private activeId = -1;          // the summoned wizard's entity id, or -1 (pWizard relation)
  private lost = new Set<string>(); // wizards summoned then KILLED — gone for good (no banked record exists)

  reset(): void { this.found = []; this.selected = 0; this.hasSelected = false; this.activeId = -1; this.lost.clear(); }

  /** newWizardFound: register a wizard the first time its actor spawns. Does NOT reveal the HUD portrait. */
  register(actorType: string): void {
    const base = baseWizardSym(actorType);
    if (!this.found.includes(base)) this.found.push(base);
  }

  get foundList(): readonly string[] { return this.found; }
  get hasWizards(): boolean { return this.found.length > 0; }

  /** the selected wizard's base sym (its summonable actor type is `<sym>InGame`), or null if none found —
   *  UNGATED (pWizardToSummon defaults to slot 1 regardless of whether the portrait has ever been shown). */
  current(): string | null { return this.found[this.selected] ?? null; }
  /** the full actor type to summon for the current selection (`<sym>InGame`). */
  currentActorType(): string | null { const c = this.current(); return c ? c + SUFFIX : null; }
  /** the wizard whose portrait the HUD should actually show — null until selectNext()/a save-restore has
   *  revealed one, even if a wizard is already found (see the HUD-portrait-timing note above). */
  displayedWizard(): string | null { return this.hasSelected ? this.current() : null; }

  /** selectNextWizard: cycle the selection (and reveal the HUD portrait, if this is the first time). */
  selectNext(): void { if (this.found.length) { this.selected = (this.selected + 1) % this.found.length; this.hasSelected = true; } }

  get activeWizardId(): number { return this.activeId; }
  /** pWizardOn (objWizardDisplayer.setWizardOn): a found wizard is currently summoned on the field. */
  get isSummoned(): boolean { return this.activeId >= 0; }
  setActive(id: number): void { this.activeId = id; }
  clearActive(): void { this.activeId = -1; }

  /** mark a wizard KILLED in the field — the original never re-banks a dead wizard, so it can't be summoned
   *  again (modSummonWizard skips a wizard with no army-details record). Guards the port's fresh-spawn path. */
  markLost(base: string): void { this.lost.add(base); }
  isLost(base: string): boolean { return this.lost.has(base); }

  // addSaveData/restoreFromSave (modSummonWizard #pWizardOn/#pWizardToSummon/#pWizard/#pWizards): the
  // found list, current selection, active-summon id, and lost set. restoreFromSave unconditionally reveals
  // the portrait when there's at least one found wizard — matching `restoreFromSave`'s unconditional
  // `setWizard` call `if pWizards.count <> 0` (the same call selectNextWizard makes; see the timing note).
  addSaveData(sd: Record<string, any> = {}): Record<string, any> {
    sd["found"] = [...this.found];
    sd["selected"] = this.selected;
    sd["activeId"] = this.activeId;
    sd["lost"] = [...this.lost];
    return sd;
  }
  restoreFromSave(sd: Record<string, any> | undefined): void {
    if (!sd) return;
    this.found = Array.isArray(sd["found"]) ? sd["found"].slice() : [];
    this.selected = typeof sd["selected"] === "number" ? sd["selected"] : 0;
    // faithful to modSummonWizard.restoreFromSave: reveal the portrait whenever any wizard is known, not
    // only when the save recorded hasSelected — restoreFromSave's own setWizard call is unconditional.
    this.hasSelected = this.found.length > 0;
    this.activeId = typeof sd["activeId"] === "number" ? sd["activeId"] : -1;
    this.lost = new Set(Array.isArray(sd["lost"]) ? sd["lost"] : []);
  }
}
