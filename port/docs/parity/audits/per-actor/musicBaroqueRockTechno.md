# Behavioral Audit: act_musicBaroqueRockTechno

**Actor Type:** Region-effect marker (`#objMusic`) — switched music track on room entry  
**Track Name:** `baroque_rock_techno_v1`  
**Variant of:** `#music` (base region marker class)  
**Status:** **CLEAN**

---

## Scope

This audit verifies behavioral parity for a single music region marker variant, `musicBaroqueRockTechno`. As a region-effect actor, it inherits all dispatch and guard logic from the `#objMusic` base class. This document traces each step of the original and port implementations to confirm they are equivalent.

---

## 1. Original Lingo Implementation

### Actor Definition (casts/data/act_musicBaroqueRockTechno.txt:1–6)
```
[#name: "act_musicBaroqueRockTechno", #type: #field]
[
#inherit: #music,
#name: "musicBaroqueRockTechno",
#musicName: "baroque_rock_techno_v1"
]
```

**Key fields:**
- `#inherit: #music` — inherits base music region marker behavior
- `#musicName: "baroque_rock_techno_v1"` — the logical track identifier

### Base Class Behavior (casts/script_objects/objMusic.txt:19–28)

**Init phase:**
```lingo
on init me, params
  ancestor.init(params)
  pMusicName = params.musicName
end
```
Stores the track name from the actor record.

**Start phase:**
```lingo
on start me
  ancestor.start()
  g.soundMaster.playMusic(pMusicName)
end
```
On room entry, calls `g.soundMaster.playMusic(pMusicName)` with the stored track name.

**Original dispatch:**
1. Actor spawned → `new()` + `init(params)` → pMusicName = "baroque_rock_techno_v1"
2. Entity enters play → `start()` → `g.soundMaster.playMusic("baroque_rock_techno_v1")`
3. soundMaster checks restart guard before playing (no re-trigger if same track)

---

## 2. TypeScript Port Implementation

### Actor Definition (port/src/generated/data.json — musicBaroqueRockTechno)
```json
{
  "inherit": "#music",
  "name": "musicBaroqueRockTechno",
  "musicName": "baroque_rock_techno_v1"
}
```
✓ Matches original: same structure, same track name.

### Dispatch: actorSerial → spawnRegionMarker (port/src/entities/actorSerial.ts:51)
```typescript
if (objType === "#objMusic") 
  return spawnRegionMarker("music", str(rec, "musicName", "stopMusic"), x, y, name);
```

**Trace for musicBaroqueRockTechno:**
1. `spawnFromSymbol("musicBaroqueRockTechno", x, y)` called by RoomManager
2. `rec = registry.resolveActor("musicBaroqueRockTechno")`
   - Registry lookup (port/src/data/registry.ts:93–113)
   - `resolveActor` merges `#inherit: #music` chain
   - Returns record with `musicName: "baroque_rock_techno_v1"`
3. `objType` = `"#objMusic"` (from base `#music`)
4. **Extract track name:** `str(rec, "musicName", "stopMusic")`
   - Helper (port/src/entities/actorSerial.ts:36): returns `rec["musicName"]` if string, else default
   - Result: `"baroque_rock_techno_v1"` ✓
5. **Call:** `spawnRegionMarker("music", "baroque_rock_techno_v1", x, y, "musicBaroqueRockTechno")`

### Effect Application: RegionMarker.init (port/src/components/regionMarker.ts:25–30)
```typescript
override init(cfg: Record<string, any>): void {
  this.effect = (cfg["effect"] as RegionEffect) ?? "magicLimit";
  this.value = cfg["value"] ?? 0;
  this.applied = false;
  this.apply();                    // ← apply immediately, like Lingo's `on start`
}
```

**Trace:**
1. Config passed: `{ effect: "music", value: "baroque_rock_techno_v1", ... }`
2. `this.effect = "music"`, `this.value = "baroque_rock_techno_v1"`
3. **apply() called immediately** (port/src/components/regionMarker.ts:35–50):
   ```typescript
   private apply(): void {
     if (this.applied) return;     // guard: apply only once
     this.applied = true;
     switch (this.effect) {
       case "music":
         game.audio?.playMusic(String(this.value));  // ← "baroque_rock_techno_v1"
         break;
     }
   }
   ```
4. **Dispatch:** `game.audio.playMusic("baroque_rock_techno_v1")`

**Match to original:** ✓ Immediate on-spawn call matches Lingo's `on start` phase

### Playback & Restart Guard: AudioSystem.playMusic (port/src/systems/audio.ts:202–218)

```typescript
playMusic(name: string): void {
  // Sentinel: "stopMusic" stops playback
  if (name === "stopMusic") { this.stopMusic(); return; }
  
  const file = this.index.music?.[name];
  if (!file || this.currentMusic === name) return;  // ← RESTART GUARD
  
  // Reserve the music channel
  this.channelAt(MUSIC_CHANNEL).busy = true;
  this.channelAt(MUSIC_CHANNEL).name = name;
  
  if (!this.ctx) { this.pendingMusic = name; return; }  // defer until unlocked
  
  this.currentMusic = name;
  if (!this.musicEl) { this.musicEl = new Audio(); this.musicEl.loop = true; }
  this.musicEl.src = this.base + file;
  this.musicEl.play().catch(() => {});
}
```

**For musicBaroqueRockTechno ("baroque_rock_techno_v1"):**

| Check | Result | Behavior |
|-------|--------|----------|
| `name === "stopMusic"` | false | continue |
| `file = this.index.music["baroque_rock_techno_v1"]` | `"music/baroque_rock_techno_v1.mp3"` ✓ | found |
| `this.currentMusic === name` | (first play: false) | NOT a restart |
| Reserve channel 1 | success | channel.busy = true |
| Play: `musicEl.src = base + file` | `/assets/music/baroque_rock_techno_v1.mp3` | source set |
| `musicEl.loop = true` | enabled | loops like original |

**Asset verification (port/src/generated/assets.json):**
```json
"music": {
  "baroque_rock_techno_v1": "music/baroque_rock_techno_v1.mp3",
  ...
}
```
✓ Asset present and accessible

**Match to original:** ✓ Restart guard matches soundMaster's `checkRestartMusic` semantics

---

## 3. Detailed Verification Checklist

### 3.1 Initialization & Actor Lookup
- [x] Actor record exists: `act_musicBaroqueRockTechno`
- [x] Inherits from `#music` correctly
- [x] `musicName` field present and set to `"baroque_rock_techno_v1"`
- [x] Registry resolveActor() merges inheritance chain correctly
- [x] Case-insensitive fallback works for mismatched casing

### 3.2 Spawn → Effect Dispatch
- [x] `spawnFromSymbol("musicBaroqueRockTechno", x, y)` called
- [x] `objType === "#objMusic"` detected
- [x] `spawnRegionMarker("music", "baroque_rock_techno_v1", x, y, name)` called
- [x] RegionMarker component created with effect="music", value="baroque_rock_techno_v1"
- [x] init() applies effect immediately (matching Lingo's on start)

### 3.3 Effect Application: Music Playback
- [x] apply() guard ensures one-time application (applied flag)
- [x] game.audio.playMusic("baroque_rock_techno_v1") called
- [x] Asset lookup succeeds: found in assets.json
- [x] Audio element created with loop=true
- [x] playback starts (or deferred to unlock if no gesture yet)

### 3.4 Restart Guard
- [x] First spawn plays immediately
- [x] Same track spawned again is ignored (currentMusic === name check)
- [x] Different track replaces current one
- [x] Guard semantics match original soundMaster.checkRestartMusic

### 3.5 Room Context
- [x] Marker spawned during RoomManager.spawnObjects()
- [x] Entity added to game.entities
- [x] Dispatch loop calls component.init() before first update()
- [x] Effect applies on room entry (before player movement)

---

## 4. Comparison: Original vs Port

| Aspect | Original | Port | Status |
|--------|----------|------|--------|
| **Actor Definition** | act_musicBaroqueRockTechno.txt: #inherit #music, #musicName "baroque_rock_techno_v1" | data.json: inherit "#music", musicName "baroque_rock_techno_v1" | ✓ MATCH |
| **Spawn Hook** | spawnFromSymbol in RoomManager | spawnFromSymbol in actorSerial.ts | ✓ MATCH |
| **objType Dispatch** | objType === #objMusic | objType === "#objMusic" | ✓ MATCH |
| **Effect Application** | on start → soundMaster.playMusic(pMusicName) | init() → apply() → game.audio.playMusic(value) | ✓ MATCH |
| **Restart Guard** | soundMaster.checkRestartMusic (no re-trigger if same) | playMusic: if (currentMusic === name) return | ✓ MATCH |
| **Track Name Flow** | params.musicName → pMusicName → playMusic(pMusicName) | str(rec, "musicName", default) → spawnRegionMarker → playMusic(value) | ✓ MATCH |
| **Asset Presence** | Lingo audio channel (implicit available) | assets.json music map lookup | ✓ MATCH |
| **Looping Behavior** | Director audio channels loop by default | HTMLAudioElement loop=true | ✓ MATCH |

---

## 5. Test Evidence

From port/test/phase_i.test.ts (music region marker tests):
- ✓ musicBaroqueRock resolves to "baroque_rock_v1"
- ✓ musicBaroqueRockTechno resolves to "baroque_rock_techno_v1"
- ✓ Restart guard verified: same track twice does not restart
- ✓ musicOff resolves to "stopMusic" sentinel

All variants follow identical dispatch and guard logic. No behavioral divergence detected.

---

## 6. Conclusion

**CLEAN** — The musicBaroqueRockTechno region marker behaves identically between the original Lingo implementation and the TypeScript port:

1. ✓ Actor record correctly inherits from #music with musicName="baroque_rock_techno_v1"
2. ✓ Spawn dispatch correctly routes through objType=#objMusic
3. ✓ Track name extracted faithfully via registry lookup
4. ✓ Effect applied once on room entry (init phase)
5. ✓ Restart guard prevents re-triggering the same track
6. ✓ Asset present and accessible
7. ✓ Playback loop behavior matches original

**No gaps in dispatch, guard logic, or track routing detected.**

---

## Evidence References

- **Original actor definition:** `/home/user/merlin-s-revenge/casts/data/act_musicBaroqueRockTechno.txt:1–6`
- **Original base class:** `/home/user/merlin-s-revenge/casts/script_objects/objMusic.txt:19–28`
- **Port actor data:** `/home/user/merlin-s-revenge/port/src/generated/data.json` (musicBaroqueRockTechno)
- **Port dispatch:** `/home/user/merlin-s-revenge/port/src/entities/actorSerial.ts:51` (spawnRegionMarker routing)
- **Port effect:** `/home/user/merlin-s-revenge/port/src/components/regionMarker.ts:25–50` (RegionMarker.init and apply)
- **Port playback & guard:** `/home/user/merlin-s-revenge/port/src/systems/audio.ts:202–218` (AudioSystem.playMusic)
- **Port assets:** `/home/user/merlin-s-revenge/port/src/generated/assets.json` (music asset index)
