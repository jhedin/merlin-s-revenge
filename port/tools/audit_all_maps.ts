import { readFileSync, readdirSync } from "fs";
import { parseMap } from "../src/world/map";
import { parseTileKey, tileSymbol } from "../src/data/tlk";
import { registry } from "../src/game/data";
import { PICKUPS, SKIP_SPAWN } from "../src/world/spawnTable";
import assets from "../src/generated/assets.json";

const HANDLED_OBJTYPES = new Set(["#objCPUCharacter","#objActorPlayer","#objDwelling","#objMine","#objMagicLimit","#objMusic","#objTeamOverride","#objChatter","#objScroll"]);
const dir = "/home/user/merlin-s-revenge/port/public/assets/maps";
const inert: Record<string,Set<string>> = {}; const noRecord: Record<string,number> = {};
const add=(o:Record<string,any>,k:string)=>{ (o[k]??=new Set())as any; };
for (const f of readdirSync(dir)) {
  const src = readFileSync(dir+"/"+f, "utf8");
  let map; try { map = parseMap(src, (s:string)=>(assets as any).tilesets?.[s]?.tile); } catch { continue; }
  const objSym = map.layerDefs.find((d:any)=>d.name==="#objects")?.tileSet ?? "";
  const kf=(assets as any).tilesets?.[objSym]?.keyFile; if(!kf) continue;
  let key; try { key=parseTileKey(readFileSync("/home/user/merlin-s-revenge/port/public/assets/"+kf,"utf8")); } catch { continue; }
  for (const room of map.rooms.values()) { const o=room.layer("#objects"); if(!o) continue;
    for (const row of o.grid) for (const n of row) { if(n<=0) continue; const sym=tileSymbol(key,n); if(sym==="#none"||sym==="#player") continue;
      const name=sym.slice(1);
      if (PICKUPS[sym]) continue;
      const d = registry.resolveActor(name);
      if (!d) { noRecord[name]=(noRecord[name]||0)+1; continue; }
      const ot=(d as any).objType as string;
      if (!HANDLED_OBJTYPES.has(ot)) { (inert[ot]??=new Set()).add(name); }
    }
  }
}
console.log("=== INERT objTypes (placed, no handler) across all 47 maps ===");
for (const [ot,s] of Object.entries(inert)) console.log(`  ${ot}: ${[...s].join(" ")}`);
console.log("\n=== NO act_ RECORD (placed but unresolvable — alias/typo) ===");
console.log("  " + Object.entries(noRecord).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`${n}(${c})`).join("  "));
