// Charge-orb + summon-face sprite builder, factored out of drawSpells so the face SIZE is testable.
//
// objSpell.calcSize (objSpell.txt:110-112): the orb's width/height = pCurrentCharge·chargeSize (px diameter),
// NO floor — set via setSpriteWidth/Height. objSpellIcons.update (objSpellIcons.txt:75-78) then does
// `me.big.setRect(spellRect)` every frame: the summon-tier FACE is given the SPELL'S rect, so it fills the
// orb and grows with charge. The port previously blitted the face at its NATIVE size (ignoring charge) — the
// face now scales to the orb size like the original.

import type { Sprite } from "./renderer";

export interface SpellFrame { w: number; h: number; reg: readonly [number, number]; }

/** objSpellIcons.displayIconNumber: the 1-based summon tier whose face to show at this charge (0 = none yet —
 *  before the first tier's chargeRequired). Tiers are pre-sorted ascending. */
export function spellFaceTier(charge: number, multistage: ReadonlyArray<{ chargeRequired: number }>): number {
  let tier = 0;
  for (const t of multistage) { if (t.chargeRequired <= charge) tier++; else break; }
  return tier;
}

/** the narrow view buildSpellSprites needs of a SpellActor (decoupled for testing). */
export interface SpellOrbView {
  size(): number;            // calcSize: charge·chargeSize
  fadeAlpha(): number;       // startQuickFade post-explode fade
  attack: { chargeColour: readonly [number, number, number] };
}

/** the orb (+ optional summon face) sprites for one spell. BOTH scale to `size` — the orb via
 *  setSpriteWidth/Height(calcSize), the face via objSpellIcons setRect(spellRect). */
export function buildSpellSprites(
  sa: SpellOrbView, x: number, y: number,
  orb: { img: CanvasImageSource; frame: SpellFrame },
  face: { img: CanvasImageSource; frame: SpellFrame } | null,
): Sprite[] {
  const size = sa.size();
  const a = sa.fadeAlpha();
  const [cr, cg, cb] = sa.attack.chargeColour;
  const sprites: Sprite[] = [{
    img: orb.img, x, y, regX: orb.frame.reg[0], regY: orb.frame.reg[1], z: y,
    scaleX: size / Math.max(1, orb.frame.w), scaleY: size / Math.max(1, orb.frame.h),
    tint: { rgb: [cr, cg, cb], strength: 1, additive: false }, // setSpriteColour: tint the white orb
    alpha: a,
  }];
  if (face) sprites.push({
    img: face.img, x, y, regX: face.frame.reg[0], regY: face.frame.reg[1], z: y + 1,
    scaleX: size / Math.max(1, face.frame.w), scaleY: size / Math.max(1, face.frame.h), // setRect(spellRect): fill the orb
    alpha: a,
  });
  return sprites;
}
