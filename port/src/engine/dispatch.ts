// Faithful translation of the Lingo ancestor-chain + module dispatch (see PLAN_REVIEW §1).
//
// The chain is a continuation-passing pipeline. Each handler receives `next` and may:
//   - forward:     return next(...)            (Lingo `ancestor.foo()`)
//   - shadow:      do NOT call next            (`objWeapon.goMode` sets state, no forward)
//   - fold:        return f(next(...))         (`sym = ancestor.getAnimSym(sym)` then rewrite)
//   - answer:      return v without next       (first-match query winner)
// A handler that wants full re-entry from the top of the chain (Lingo `me.big.foo()`)
// calls `this.entity.send(msg, ...)` again — distinct from `next()`.
//
// Handler order is the real chain order: leaf obj* handlers -> base services -> modules in
// addModule order -> catcher. Handler method references are resolved at archetype-build
// time (not via per-call `obj[msg]` lookup) to keep dispatch monomorphic.

export type NextFn = (...args: any[]) => any;

export abstract class Component {
  entity!: Entity;
  // Subclasses declare `static handles: readonly string[]` listing message method names.
  // (Not declared on the base so subclass statics don't trip noImplicitOverride.)
  /** optional two-phase init: collect defaults, then apply merged config */
  collectDefaults?(cfg: Record<string, any>): void;
  init?(cfg: Record<string, any>): void;
  /** for pooled archetypes */
  reset?(): void;
}

type ComponentClass = (new () => Component) & { handles?: readonly string[] };

interface HandlerEntry { compIndex: number; fn: (next: NextFn, ...a: any[]) => any; }

export class Archetype {
  readonly name: string;
  readonly classes: ComponentClass[];
  /** msg -> ordered handlers (chain order) */
  readonly table = new Map<string, HandlerEntry[]>();
  /** msg -> default return when nothing in the chain answers (objModuleCatcher stubs) */
  readonly defaults: Map<string, any>;
  readonly pooled: boolean;

  constructor(name: string, classes: ComponentClass[], opts: { defaults?: Record<string, any>; pooled?: boolean } = {}) {
    this.name = name;
    this.classes = classes;
    this.pooled = opts.pooled ?? false;
    this.defaults = new Map(Object.entries(opts.defaults ?? {}));
    classes.forEach((C, compIndex) => {
      const handles = (C as any).handles as readonly string[] | undefined;
      if (!handles) return;
      for (const msg of handles) {
        const fn = (C.prototype as any)[msg];
        if (typeof fn !== "function") {
          throw new Error(`${name}: ${C.name} declares handler '${msg}' but has no such method`);
        }
        let list = this.table.get(msg);
        if (!list) { list = []; this.table.set(msg, list); }
        list.push({ compIndex, fn });
      }
    });
  }

  create(id: number): Entity { return new Entity(id, this); }
}

let nextEntityId = 1;
export const resetEntityIds = () => { nextEntityId = 1; };

export class Entity {
  readonly id: number;
  readonly archetype: Archetype;
  type = "";
  readonly flags = new Set<string>();
  readonly comps: Component[];
  private readonly byCtor = new Map<Function, Component>();
  /** set when pooled and idle */
  dead = false;

  constructor(id: number, archetype: Archetype) {
    this.id = id;
    this.archetype = archetype;
    this.comps = archetype.classes.map((C) => {
      const c = new C();
      c.entity = this;
      this.byCtor.set(C, c);
      return c;
    });
  }

  get<T extends Component>(C: new (...a: any[]) => T): T {
    const c = this.byCtor.get(C);
    if (!c) throw new Error(`entity ${this.archetype.name} has no component ${C.name}`);
    return c as T;
  }
  tryGet<T extends Component>(C: new (...a: any[]) => T): T | undefined {
    return this.byCtor.get(C) as T | undefined;
  }
  has(C: Function): boolean { return this.byCtor.has(C); }

  /**
   * Dispatch a message through the chain (== Lingo `me.big.foo()` / full send).
   * Returns whatever the chain returns (query winner, folded value, or default).
   */
  send(msg: string, ...args: any[]): any {
    const list = this.archetype.table.get(msg);
    if (list === undefined) return this.archetype.defaults.get(msg);
    const comps = this.comps;
    const defaults = this.archetype.defaults;
    let i = 0;
    const next: NextFn = (...nargs: any[]) => {
      const idx = i++;
      if (idx >= list.length) return defaults.get(msg);
      const e = list[idx]!;
      const a = nargs.length ? nargs : args;
      return e.fn.call(comps[e.compIndex], next, ...a);
    };
    return next(...args);
  }

  /** Two-phase construction: collect each component's defaults, overlay record, init. */
  build(record: Record<string, any> = {}): this {
    const cfg: Record<string, any> = {};
    for (const c of this.comps) c.collectDefaults?.(cfg);
    Object.assign(cfg, record); // ListModifyProperties: data overrides defaults
    for (const c of this.comps) c.init?.(cfg);
    return this;
  }

  resetForPool(): void {
    this.dead = true;
    this.type = "";
    this.flags.clear();
    for (const c of this.comps) c.reset?.();
  }
}

export const makeEntityId = (): number => nextEntityId++;
