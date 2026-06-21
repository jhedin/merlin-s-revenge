// PotionMaster (casts/master_objects/potionMaster.txt) — "displays how many potions have been drunk."
// A per-type tally: potionCollected(character) finds-or-creates the record and bumps numCollected. The
// counter persists in the save; the display widgets (icon/counter sprites) are render-only (agent 5) and
// reconstructed on restore — here we keep only the count (+ the type key), faithful to addSaveData which
// strips to {character, numCollected}.

export interface PotionRecord { character: string; numCollected: number; }

export class PotionMaster {
  private potions = new Map<string, PotionRecord>(); // pPotionsCollected, keyed by character (the type)

  reset(): void { this.potions.clear(); }

  // potionCollected(thePotion): getPotionRecord (find-or-create by character), numCollected += 1, display.
  potionCollected(character: string): void {
    if (!character) return;
    let rec = this.potions.get(character);
    if (!rec) { rec = { character, numCollected: 0 }; this.potions.set(character, rec); }
    rec.numCollected += 1;
  }

  getCount(character: string): number { return this.potions.get(character)?.numCollected ?? 0; }
  totalCollected(): number { let n = 0; for (const r of this.potions.values()) n += r.numCollected; return n; }

  // addSaveData (43-57): the stripped list {character, numCollected} per record.
  addSaveData(sd: Record<string, any> = {}): Record<string, any> {
    sd["pPotionsCollected"] = [...this.potions.values()].map((r) => ({ character: r.character, numCollected: r.numCollected }));
    return sd;
  }
  // restoreFromSave (192-213): clear + rebuild each record from the saved fields.
  restoreFromSave(sd: Record<string, any> | null | undefined): void {
    this.potions.clear();
    const list = sd && Array.isArray(sd["pPotionsCollected"]) ? sd["pPotionsCollected"] : [];
    for (const r of list) {
      if (r && typeof r.character === "string") this.potions.set(r.character, { character: r.character, numCollected: Number(r.numCollected) || 0 });
    }
  }
}
