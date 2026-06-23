// All 8 wizard summon-portrait HUD members must be bundled. 3 of them (berlin/ulin/prestotolin) shipped
// drawing as NAME TEXT because their portraits exist in extracted/ but were absent from the build_assets
// MEMBER_NAMES allowlist (the title-screen class: real art present, dropped to a procedural fallback). This
// guards the allowlist so a wizard portrait can't silently regress to text again. (equivalence re-sweep)
import { describe, it, expect } from "vitest";
import assets from "../src/generated/assets.json";

const WIZARDS = ["amotonlin", "flaetorlin", "foelin", "garonlin", "verdanlin", "berlin", "ulin", "prestotolin"];

describe("all 8 wizard HUD portraits are bundled (not drawn as name text)", () => {
  const members = (assets as any).members ?? {};
  for (const w of WIZARDS) {
    it(`${w}_off portrait is a bundled member`, () => {
      expect(members[`${w}_off`]?.file).toBeTruthy();
    });
  }
});
