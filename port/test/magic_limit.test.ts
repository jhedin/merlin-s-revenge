// objMagicLimit region (magicLimitMaster.getMagicLimit): an objMagicLimit area scales a #limitMagic
// spell's charge ceiling by magicLimit/100 (set on region entry, reset to 100 on room-leave). A
// non-#limitMagic spell is unaffected. calcAttackChargeMax: cm = cm * magicLimit/100 when limitMagic.
import { describe, it, expect, beforeEach } from "vitest";
import { chargeMaxOf } from "@/components/charge";
import { game } from "@/game/context";

// minimal AttackData/ManaStats — only the fields chargeMaxOf reads.
const mkAttack = (limitMagic: boolean) => ({
  chargeMax: 999, chargeMaxModifier: 1, chargeMaxBasic: 0,
  limitMagic, gmgChargeMax: 0, randomSummon: false, multistage: [] as any[],
}) as any;
const mana = { capacity: 20 } as any; // cm = min(999, 20*1+0) = 20 at full limit

describe("objMagicLimit charge-ceiling scaling", () => {
  beforeEach(() => { game.magicLimit.setDefaultValue(100); game.magicLimit.setDefault(); });

  it("default limit (100) leaves the ceiling unscaled", () => {
    expect(chargeMaxOf(mkAttack(true), mana)).toBe(20);
  });

  it("a magicLimit-50 region HALVES a #limitMagic spell's ceiling", () => {
    game.magicLimit.set(50);
    expect(chargeMaxOf(mkAttack(true), mana)).toBe(10); // 20 * 50/100
  });

  it("a magicLimit-25 region quarters the ceiling; a non-limitMagic spell is untouched", () => {
    game.magicLimit.set(25);
    expect(chargeMaxOf(mkAttack(true), mana)).toBe(5);   // 20 * 25/100
    expect(chargeMaxOf(mkAttack(false), mana)).toBe(20); // limiter ignored for non-#limitMagic
  });

  it("room-leave (setDefault) restores the full ceiling", () => {
    game.magicLimit.set(40);
    expect(chargeMaxOf(mkAttack(true), mana)).toBe(8);
    game.magicLimit.setDefault();                         // objMagicLimit region exited / room-leave
    expect(chargeMaxOf(mkAttack(true), mana)).toBe(20);
  });
});
