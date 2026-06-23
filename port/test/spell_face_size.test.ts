// Size parity for the summon-spell FACE. objSpellIcons.update (objSpellIcons.txt:75-78) sets the tier face's
// rect to the SPELL's rect — so the face scales to the orb size (charge·chargeSize), growing as you charge.
// The port used to blit it at native size, so the face stayed small while the orb grew. These pin the exact
// rendered sizes from the original's numbers (armySummon: chargeSize 2; tiers warrior@10 .. king@32).
import { describe, it, expect } from "vitest";
import { buildSpellSprites, spellFaceTier, type SpellOrbView } from "@/render/spellSprites";

const frame = (w: number, h: number) => ({ w, h, reg: [w / 2, h / 2] as const });
const view = (size: number): SpellOrbView => ({ size: () => size, fadeAlpha: () => 1, attack: { chargeColour: [9, 113, 255] } });
const eff = (scale: number | undefined, nativeW: number) => (scale ?? 1) * nativeW; // rendered px = scale × native

describe("summon-spell face is sized to the orb (objSpellIcons setRect(spellRect))", () => {
  it("the FACE renders at the orb size (charge·chargeSize), NOT its native size", () => {
    const orbF = frame(64, 64);   // orb art native 64px
    const faceF = frame(16, 16);  // face art native 16px
    // armySummon chargeSize=2 -> charge 10/15/20 give orb sizes 20/30/40 px.
    for (const size of [20, 30, 40]) {
      const sp = buildSpellSprites(view(size), 100, 100, { img: {} as any, frame: orbF }, { img: {} as any, frame: faceF });
      expect(sp.length).toBe(2);
      const orb = sp[0]!, face = sp[1]!;
      expect(eff(orb.scaleX, orbF.w)).toBeCloseTo(size);            // orb fills `size`
      expect(eff(face.scaleX, faceF.w)).toBeCloseTo(size);          // face fills `size` too (was stuck at 16)
      expect(eff(face.scaleY, faceF.h)).toBeCloseTo(size);
      expect(eff(face.scaleX, faceF.w)).toBeCloseTo(eff(orb.scaleX, orbF.w)); // face size == orb size
      expect(face.z).toBeGreaterThan(orb.z);                        // face drawn over the orb
    }
  });

  it("with no face, only the orb is emitted", () => {
    const sp = buildSpellSprites(view(24), 0, 0, { img: {} as any, frame: frame(32, 32) }, null);
    expect(sp.length).toBe(1);
    expect(eff(sp[0]!.scaleX, 32)).toBeCloseTo(24);
  });

  it("spellFaceTier picks the tier from the cast thresholds (armySummon warrior@10 .. king@32)", () => {
    const ms = [10, 15, 20, 25, 32].map((chargeRequired) => ({ chargeRequired }));
    expect(spellFaceTier(9, ms)).toBe(0);   // no face before the first tier
    expect(spellFaceTier(10, ms)).toBe(1);  // warrior
    expect(spellFaceTier(15, ms)).toBe(2);  // archer
    expect(spellFaceTier(24, ms)).toBe(3);  // monk
    expect(spellFaceTier(31, ms)).toBe(4);  // dwarf
    expect(spellFaceTier(40, ms)).toBe(5);  // king (charge past the top tier)
  });
});
