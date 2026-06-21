# Audit: #objMusic Region Marker

## Summary
The music region marker (`#objMusic`) behaves identically in the TypeScript port as in the original Lingo codebase. The region correctly plays/stops the appropriate track on player entry, with proper case-insensitive registry lookup, restart guards, and the "stopMusic" sentinel for silence.

## Scope
- **Actor Type**: `#objMusic` (region marker that sets the room's background music)
- **Variants**: musicBaroqueRock, musicBaroqueRockTechno, musicElectronicMerlin, musicLastStand, musicWoodsOfEvil, musicOff
- **Key Data Field**: `#musicName` — the logical track identifier (e.g., "baroque_rock_v1")
- **Core Behavior**: spawn → play track once; same track twice → no-op (guard); musicOff → stop

## Implementation Verification

### 1. Data Mapping ✓
**Original** (casts/data/act_music.txt):
```
#objType: #objMusic
#inherit: #game
#character: #mapMusic
#minimapStatus: #clr
#weight: 1
```
Variant example (act_musicBaroqueRock.txt):
```
#inherit: #music
#name: "musicBaroqueRock"
#musicName: "baroque_rock_v1"
```

**Port** (port/src/generated/data.json):
- `act_music` base: has `objType: "#objMusic"`, `inherit: "#game"`, etc. ✓
- All variants (`musicBaroqueRock`, `musicLastStand`, `musicOff`, etc.) properly inherit from `#music` with correct `musicName` values ✓
- `musicOff` correctly sets `musicName: "stopMusic"` (the stop sentinel) ✓

### 2. Region Marker Spawning ✓
**Original** (casts/script_objects/objMusic.txt):
```lingo
on start me
  ancestor.start()
  g.soundMaster.playMusic(pMusicName)
end
```

**Port** (port/src/entities/actorSerial.ts:51):
```typescript
if (objType === "#objMusic") return spawnRegionMarker("music", str(rec, "musicName", "stopMusic"), x, y, name);
```
- Correctly extracts `musicName` from the resolved actor data ✓
- Uses case-insensitive registry lookup (fallback to lowercase if mismatch) ✓
- Defaults to "stopMusic" if musicName is missing ✓

### 3. Effect Application ✓
**Port** (port/src/components/regionMarker.ts:35–50):
```typescript
private apply(): void {
  if (this.applied) return;  // guard: apply only once
  this.applied = true;
  switch (this.effect) {
    case "music":
      game.audio?.playMusic(String(this.value));
      break;
    // ...
  }
}
```
- Effect applied once in `init()` (matching Lingo's `on start`) ✓
- Guards against re-application ✓
- Calls `game.audio.playMusic()` with the track name ✓

### 4. Playback & Restart Guard ✓
**Port** (port/src/systems/audio.ts:202–218):
```typescript
playMusic(name: string): void {
  if (name === "stopMusic") { this.stopMusic(); return; }
  const file = this.index.music?.[name];
  if (!file || this.currentMusic === name) return;  // ← restart guard
  // ...
  this.currentMusic = name;
  if (!this.musicEl) { this.musicEl = new Audio(); this.musicEl.loop = true; }
  this.musicEl.src = this.base + file;
  this.musicEl.play().catch(() => {});
}
```
- Detects "stopMusic" sentinel and calls `stopMusic()` ✓
- Looks up track name in asset index (`assets.json` music map) ✓
- **Restart guard**: `if (this.currentMusic === name) return;` prevents re-triggering the same track ✓
- Loops playback with `loop: true` (matching original channel-based loop behavior) ✓

### 5. Stop Behavior ✓
**Port** (port/src/systems/audio.ts:220–225):
```typescript
stopMusic(): void {
  this.musicEl?.pause();
  this.currentMusic = "";
  this.channelAt(MUSIC_CHANNEL).busy = false;
  this.channelAt(MUSIC_CHANNEL).name = "empty";
}
```
- Pauses playback ✓
- Clears `currentMusic` (ensures the next call is not guarded as a restart) ✓
- Properly frees the music channel for the SFX pool ✓

### 6. Asset Index ✓
**Port** (port/src/generated/assets.json):
```json
"music": {
  "baroque_rock_v1": "music/baroque_rock_v1.mp3",
  "baroque_rock_techno_v1": "music/baroque_rock_techno_v1.mp3",
  "electronic_merlin_v1_02": "music/electronic_merlin_v1_02.mp3",
  "last_stand_v4": "music/last_stand_v4.mp3",
  "woods_of_evil_v1": "music/woods_of_evil_v1.mp3"
}
```
- All referenced `musicName` values have corresponding files ✓
- Files are accessible under `/assets/music/` ✓

### 7. Room Spawn Integration ✓
**Port** (port/src/world/rooms.ts:314–342):
```typescript
private spawnObjects(reposition?: ..., spawnActors = true): void {
  // ... iterate tile objects layer
  const e = spawnFromSymbol(sym, px, py);  // calls spawnRegionMarker for #objMusic
  if (e) game.entities.push(e);
}
```
- Region markers are spawned during room initialization ✓
- Entities are pushed to `game.entities` immediately after spawn ✓
- The entity dispatch loop calls each component's `init()` before first `update()`, triggering music on entry ✓

## Test Coverage ✓
**Port** (port/test/phase_i.test.ts:93–147):
- ✓ `musicBaroqueRock` plays "baroque_rock_v1"
- ✓ Same track spawned twice does not restart (guard verified)
- ✓ `musicLastStand` resolves to "last_stand_v4"
- ✓ `musicOff` → "stopMusic" sentinel stops the music
- ✓ All bundled music keys match the `#musicName` logical track names

## Behavioral Equivalence
| Behavior | Original | Port | Status |
|----------|----------|------|--------|
| Region spawn triggers music play once | ✓ | ✓ | MATCH |
| Same track spawned twice does not restart | ✓ (checkRestartMusic guard) | ✓ (currentMusic === name guard) | MATCH |
| musicOff stops the music | ✓ (soundMaster.playMusic("stopMusic")) | ✓ (playMusic("stopMusic") → stopMusic()) | MATCH |
| Case-insensitive actor name lookup | ✓ (Lingo semantics) | ✓ (registry lowercase fallback) | MATCH |
| Music loops on playback | ✓ (Director channels loop by default) | ✓ (HTMLAudioElement loop=true) | MATCH |
| Music deferred until user gesture (unlock) | N/A (Lingo always runs) | ✓ (playMusic defers to unlock if !ctx) | PORT REFINEMENT |

## Non-Issues (Catalogued, Not Flagged)
- Audio volume/mixing (presentation concern)
- Exact track timing/looping (subject to asset variation)
- Marker invisibility (region markers are inert, non-visible entities)
- Music channel reservation in SFX pool (correct channel bookkeeping in audio.ts)

## Conclusion
**CLEAN** — The music region marker is correctly implemented with full behavioral parity to the original. The spawn flow, restart guard, musicOff sentinel, and asset mapping all match the Lingo semantics. Testing confirms all variants work as intended.
