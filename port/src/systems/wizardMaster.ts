// wizardMaster + modSummonWizard: the player can rescue/meet named wizards (act_*InGame, #wizard:true)
// then summon them as helper allies on demand.
//
//  - newWizardFound (objGameObject.init, params.wizard==true): a wizard actor registers itself the first
//    time it spawns. pWizardsFound determines who can be summoned and the cycle order.
//  - selectNextWizard (#wizardSelector / Tab): cycle which found wizard will be summoned next.
//  - summonWizard (#wizard / Q): if a wizard is out, unsummon it; else summon the selected found wizard at
//    the cursor (createUnit from the army reserve when banked, else a fresh spawn) and track it.
//
// The original pulls strictly from the army reserve (the wizard must have been banked on a prior room-leave);
// the port falls back to a fresh spawn so a found wizard is always summonable — a documented adaptation that
// preserves the observable behaviour (meet a wizard -> summon it at will).

const SUFFIX = "InGame";

/** "amotonlinInGame" -> "amotonlin" (newWizardFound strips the trailing "InGame"). */
export function baseWizardSym(actorType: string): string {
  const s = actorType.replace(/^#/, "");
  return s.endsWith(SUFFIX) ? s.slice(0, -SUFFIX.length) : s;
}

export class WizardMaster {
  private found: string[] = [];   // base wizard syms in discovery order (pWizardsFound)
  private selected = 0;           // pWizardToSummon (0-based here)
  private activeId = -1;          // the summoned wizard's entity id, or -1 (pWizard relation)
  private lost = new Set<string>(); // wizards summoned then KILLED — gone for good (no banked record exists)

  reset(): void { this.found = []; this.selected = 0; this.activeId = -1; this.lost.clear(); }

  /** newWizardFound: register a wizard the first time its actor spawns. */
  register(actorType: string): void {
    const base = baseWizardSym(actorType);
    if (!this.found.includes(base)) this.found.push(base);
  }

  get foundList(): readonly string[] { return this.found; }
  get hasWizards(): boolean { return this.found.length > 0; }

  /** the selected wizard's base sym (its summonable actor type is `<sym>InGame`), or null. */
  current(): string | null { return this.found[this.selected] ?? null; }
  /** the full actor type to summon for the current selection (`<sym>InGame`). */
  currentActorType(): string | null { const c = this.current(); return c ? c + SUFFIX : null; }

  /** selectNextWizard: cycle the selection. */
  selectNext(): void { if (this.found.length) this.selected = (this.selected + 1) % this.found.length; }

  get activeWizardId(): number { return this.activeId; }
  /** pWizardOn (objWizardDisplayer.setWizardOn): a found wizard is currently summoned on the field. */
  get isSummoned(): boolean { return this.activeId >= 0; }
  setActive(id: number): void { this.activeId = id; }
  clearActive(): void { this.activeId = -1; }

  /** mark a wizard KILLED in the field — the original never re-banks a dead wizard, so it can't be summoned
   *  again (modSummonWizard skips a wizard with no army-details record). Guards the port's fresh-spawn path. */
  markLost(base: string): void { this.lost.add(base); }
  isLost(base: string): boolean { return this.lost.has(base); }
}
