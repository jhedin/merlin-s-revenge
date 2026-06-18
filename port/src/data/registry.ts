// Port of collectionsMaster (symbol registry) + actorMaster.retrieveActorData (#inherit merge
// + #attack schema merge). See PLAN_REVIEW §3 / data-pipeline research.
//
// Records are indexed by filename prefix -> type partition, name (after the underscore) -> record.
// `#inherit` chains are flattened child-over-parent (ListsMerge); `#attack` sub-records are
// overlaid on the structAttack defaults (ListModifyProperties).

import type { Lingo } from "./lingo";

export type Record_ = { [k: string]: Lingo };

/** prefix (first 3 chars of filename) -> partition type */
export const PREFIX_TYPE: Record<string, string> = {
  act: "actor", bnd: "keyBinding", kyd: "keyDesc", fnt: "font",
  scr: "script", tem: "team", txt: "text", tls: "tileSet", tlk: "tileSetKey",
};

/** structMaster.structAttack defaults (the #attack schema). Values are merged under by data. */
export const STRUCT_ATTACK: Record_ = {
  animFrame: 2, animType: "#none", beam: false, bullet: "#none",
  chargeColour: { r: 255, g: 255, b: 255 }, chargePerUnit: 1, chargeMax: 0,
  chargeSpeed: 0, chargeStart: 0, chargeVolumeMap: { charge: [1, 100], vol: [10, 255] },
  collisionLoc: { x: 25, y: 0 }, cooldown: 0, fireDelay: 2, firingType: "#proportional",
  hits: ["#teamMembers"], limitMagic: false, multistage: "#none", name: "#none",
  payloadFunction: ["#takeHit"], power: { x: 5, y: -1 }, reach: 25, spellSpeed: 2,
  targetAllegiance: "#enemy", targetCriteria: "#closestDistance",
  targetRoles: [["#teamMembers", "#teamBuildings"]], type: "#auto", volume: 150,
};

const isPlainObject = (v: Lingo): v is Record_ =>
  v != null && typeof v === "object" && !Array.isArray(v) &&
  !("$member" in v) && !("$global" in v) && !("$call" in v) &&
  !("x" in v) && !("r" in v) && !("left" in v);

/** ListsMerge: shallow child-over-parent. Child keys override parent keys. */
export function mergeRecords(parent: Record_, child: Record_): Record_ {
  return { ...parent, ...child };
}

export interface DataFileLike { header: { [k: string]: Lingo }; data: Lingo; }

export class Registry {
  /** type -> (name -> record) */
  private partitions = new Map<string, Map<string, Record_>>();
  private inheritCache = new Map<string, Record_>();

  /** Load parsed data files keyed by base filename (e.g. "act_blackOrc"). */
  constructor(files: Record<string, DataFileLike>) {
    for (const [base, file] of Object.entries(files)) {
      const prefix = base.slice(0, 3);
      const type = PREFIX_TYPE[prefix];
      if (!type) continue;
      const name = base.slice(4); // after "act_"
      if (name.includes("key") || name.includes("properties")) continue; // pNamesToSkip
      let part = this.partitions.get(type);
      if (!part) { part = new Map(); this.partitions.set(type, part); }
      if (isPlainObject(file.data)) part.set(name, file.data);
    }
  }

  raw(type: string, name: string): Record_ | undefined {
    return this.partitions.get(type)?.get(name.replace(/^#/, ""));
  }

  /** retrieveActorData: resolve #inherit chain + #attack schema, memoized. */
  resolveActor(name: string): Record_ | undefined {
    const key = name.replace(/^#/, "");
    const cached = this.inheritCache.get(key);
    if (cached) return cached;
    const base = this.raw("actor", key);
    if (!base) return undefined;
    let data: Record_ = { ...base };
    const inherit = data["inherit"];
    if (typeof inherit === "string") {
      const parent = this.resolveActor(inherit);
      if (parent) data = mergeRecords(parent, data);
    }
    // #attack schema merge (after inherit so inherited attack is included)
    const atk = data["attack"];
    if (isPlainObject(atk)) {
      data = { ...data, attack: { ...STRUCT_ATTACK, ...atk } };
    }
    this.inheritCache.set(key, data);
    return data;
  }

  team(name: string): Record_ | undefined { return this.raw("team", name); }
  names(type: string): string[] { return [...(this.partitions.get(type)?.keys() ?? [])]; }
}
