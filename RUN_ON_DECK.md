# Running the native build on Steam Deck (Proton)

The native game is an **Adobe/Macromedia Director projector** (`merlin_engine_76_*.exe`).
Out of the box it **crashes instantly under Proton/Wine** — before any window appears.

## Why it crashes

The projector self-extracts its Xtras to a temp folder and initializes DirectDraw. Wine's
**built-in `ddraw`** faults during that init (an access violation / near-null deref deep in
`DDRAW.DLL`), so the projector dies before drawing its first frame. This is the classic
"old DirectDraw game on Wine" failure — nothing to do with the game data or file paths.

## The fix: cnc-ddraw

[cnc-ddraw](https://github.com/FunkyFr3sh/cnc-ddraw) is a drop-in DirectDraw replacement for
old 2D games. It translates DirectDraw to OpenGL/GDI and avoids Wine's broken path entirely.

1. Download the latest `cnc-ddraw.zip` from the releases page.
2. Copy these three items **next to the `.exe`** (same folder as `merlin_engine_76_slowStart.exe`):
   - `ddraw.dll`
   - `ddraw.ini`
   - `Shaders/`
3. Force Wine to use that local `ddraw.dll` instead of its built-in one (Wine prefers built-in
   for core DLLs unless told otherwise) — see launch options below.

That's it. No winetricks, no virtual desktop, no DirectX installs needed.

## Add it to Steam

1. **Add a Non-Steam Game** → point it at `merlin_engine_76_slowStart.exe`
   (or `merlin_engine_76_fastStart.exe`).
2. Right-click → **Properties**:
   - **Compatibility** → Force a specific Proton (Experimental or any recent build works).
   - **Start In** (Shortcut → "Start In") → the folder containing the `.exe` and its
     `casts/ maps/ gfx/` data. The projector loads data relative to this dir; if it's wrong
     you get a blank screen.
   - **Launch Options**:
     ```
     WINEDLLOVERRIDES="ddraw=n" %command%
     ```
     (`ddraw=n` = use the native/local `ddraw.dll`, i.e. cnc-ddraw.)

Launch it. Big Picture / Game Mode is **not** required — this works the same in Desktop Mode.

## Test from a terminal (optional)

```sh
GAME="/path/to/merlin_open_30_speedy_and _tvs"          # folder with the .exe + casts/maps/gfx
PROTON="$HOME/.local/share/Steam/steamapps/common/Proton - Experimental/files"
export WINEPREFIX="$HOME/.local/share/merlin_proton_prefix/pfx"
export LD_LIBRARY_PATH="$PROTON/lib64:$PROTON/lib"
export WINEDLLOVERRIDES="ddraw=n"
cd "$GAME"
"$PROTON/bin/wine" merlin_engine_76_slowStart.exe
```

You should get the **"Merlin's Revenge" title screen** (Start Game / Load Game / Show Keys /
Instructions / View Credits), then playable gameplay.

## Tuning cnc-ddraw

`ddraw.ini` controls the renderer. Defaults that are known-good here:

- `renderer=gdi` — most compatible (software). Use this if anything looks wrong.
- `renderer=opengl` — smoother scaling / better performance on the Deck. Try this once it runs.
- `windowed=true` / `fullscreen=false` — windowed; flip for borderless fullscreen.

There's also a GUI: run `cnc-ddraw config.exe` from the game folder to change settings visually.

## Notes

- cnc-ddraw only helps **2D DirectDraw** games. It does nothing for 3D Direct3D titles
  (e.g. C&C Generals / Zero Hour). It *is* the right tool for 2D C&C games like Red Alert II.
- A browser-playable HTML5 port of this game also exists (see `port/`), deployed at
  <https://jhedin.github.io/merlin-s-revenge/> — useful if you want zero-Wine play.
