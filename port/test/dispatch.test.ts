import { describe, it, expect } from "vitest";
import { Archetype, Component, NextFn } from "@/engine/dispatch";

// Each test builds a small archetype with components in chain order
// (leaf -> base -> modules -> catcher) and checks one Lingo dispatch semantic.

describe("dispatch: ordered chain walk (forward)", () => {
  it("runs every forwarding handler in chain order", () => {
    const log: string[] = [];
    class Leaf extends Component { static handles = ["update"]; update(next: NextFn) { log.push("leaf"); next(); } }
    class Base extends Component { static handles = ["update"]; update(next: NextFn) { log.push("base"); next(); } }
    class Mod extends Component { static handles = ["update"]; update(next: NextFn) { log.push("mod"); next(); } }
    const a = new Archetype("t", [Leaf, Base, Mod]);
    a.create(1).send("update");
    expect(log).toEqual(["leaf", "base", "mod"]);
  });
});

describe("dispatch: shadow (no forward stops the chain)", () => {
  it("objWeapon.goMode-style shadow prevents lower handlers from running", () => {
    const log: string[] = [];
    class Weapon extends Component { static handles = ["goMode"]; goMode(_next: NextFn, m: string) { log.push("weapon:" + m); /* no next() */ } }
    class Base extends Component { static handles = ["goMode"]; goMode(next: NextFn, m: string) { log.push("base:" + m); next(); } }
    const a = new Archetype("t", [Weapon, Base]);
    a.create(1).send("goMode", "#walk");
    expect(log).toEqual(["weapon:#walk"]); // base never runs
  });
});

describe("dispatch: fold/pipeline (value transformed through chain)", () => {
  it("getAnimSym-style: each link rewrites the threaded value", () => {
    // leaf rewrites #reel->#stand only after base/mod produced the raw sym
    class Leaf extends Component {
      static handles = ["getAnimSym"];
      getAnimSym(next: NextFn, sym: string): string { const s = next(sym); return s === "#reel" ? "#stand" : s; }
    }
    class ModAnim extends Component {
      static handles = ["getAnimSym"];
      getAnimSym(_next: NextFn, sym: string): string { return sym === "#hurt" ? "#reel" : sym; }
    }
    const a = new Archetype("t", [Leaf, ModAnim]);
    expect(a.create(1).send("getAnimSym", "#hurt")).toBe("#stand"); // #hurt -> #reel -> #stand
    expect(a.create(2).send("getAnimSym", "#walk")).toBe("#walk");
  });
});

describe("dispatch: first-match query + catcher default", () => {
  it("returns the first responder; falls back to default when none answer", () => {
    class HasMode extends Component { static handles = ["getMode"]; getMode(): string { return "#attack"; } }
    class Other extends Component {}
    const withMode = new Archetype("a", [Other, HasMode], { defaults: { getMode: "#finish" } });
    const withoutMode = new Archetype("b", [Other], { defaults: { getMode: "#finish" } });
    expect(withMode.create(1).send("getMode")).toBe("#attack");
    expect(withoutMode.create(2).send("getMode")).toBe("#finish"); // objModuleCatcher default
  });

  it("pinned winner: a base service ordered before modules wins (getAttack)", () => {
    class BaseGetAttack extends Component { static handles = ["getAttack"]; getAttack(): string { return "base-weapon"; } }
    class ModAttack extends Component { static handles = ["getAttack"]; getAttack(): string { return "mod-weapon"; } }
    // base ordered before module -> base wins (objAiGameObject over modAttack)
    const a = new Archetype("t", [BaseGetAttack, ModAttack]);
    expect(a.create(1).send("getAttack")).toBe("base-weapon");
  });
});

describe("dispatch: full re-entry (me.big.foo restarts from top)", () => {
  it("me.big.goMode hits leaf handlers above the caller, unlike next()", () => {
    const log: string[] = [];
    class Leaf extends Component {
      static handles = ["goMode"];
      goMode(next: NextFn, m: string) { log.push("leaf:" + m); next(); }
    }
    class ModReel extends Component {
      static handles = ["goMode", "goDamageMode"];
      goMode(next: NextFn, m: string) { log.push("reel.goMode:" + m); next(); }
      // me.big.goMode(#reel) -> full re-entry from the top (re-runs Leaf.goMode)
      goDamageMode() { this.entity.send("goMode", "#reel"); }
    }
    const a = new Archetype("t", [Leaf, ModReel]);
    a.create(1).send("goDamageMode");
    expect(log).toEqual(["leaf:#reel", "reel.goMode:#reel"]);
  });
});

describe("dispatch: takeHit ordering contract", () => {
  it("modExperience records attacker BEFORE modEnergy applies damage", () => {
    const events: string[] = [];
    const state = { lastAttacker: "" as string };
    // chain order must place experience before energy (addModule order is the contract)
    class ModExperience extends Component {
      static handles = ["takeHit"];
      takeHit(next: NextFn, attacker: string) { state.lastAttacker = attacker; events.push("exp:set " + attacker); next(attacker); }
    }
    class ModEnergy extends Component {
      static handles = ["takeHit"];
      takeHit(next: NextFn, attacker: string) {
        next(attacker);
        // by now lastAttacker is set -> XP would route correctly
        events.push("energy:died lastAttacker=" + state.lastAttacker);
      }
    }
    const a = new Archetype("char", [ModExperience, ModEnergy]);
    a.create(1).send("takeHit", "playerA");
    expect(events).toEqual(["exp:set playerA", "energy:died lastAttacker=playerA"]);
  });
});
