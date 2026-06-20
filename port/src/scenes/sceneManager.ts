// SceneManager (movieMaster + screenMaster + gameMaster, collapsed): the explicit scene state machine
// that replaces main.ts's mode var. It owns the current screen symbol + an overlay stack, runs screen
// transitions (instant in the port — the #fade/#flick tweens are F3 cosmetic), and dispatches the
// cutSceneFinished routing by WHICH script finished (the load-bearing movieMaster.cutSceneFinished
// dispatch: intro->game, gameOver->game+reload, gameComplete->victory).
//
// It is decoupled from the DOM: the host (main.ts) supplies action callbacks (start game, play a cutscene,
// reload the save). Transitions are synchronous, so the FSM is unit-testable without a renderer.

export type Screen =
  | "title" | "controls" | "intro" | "game" | "gameOver" | "gameComplete" | "victory";
export type Overlay = "ingameMenu" | "showArmy" | "instructions" | null;

// the cutscene "scripts" the FSM routes on finish (movieMaster.cutSceneFinished dispatch).
export type CutScene = "intro" | "wasted" | "complete";

export interface SceneActions {
  /** #startGame: begin a fresh run (spawn player + enter the start room). */
  startGame(): void;
  /** play a cutscene by its script symbol; the host calls back sceneManager.cutSceneFinished(scene). */
  playCutScene(scene: CutScene): void;
  /** #loadGame: reload the last save (movieMaster reloads after the wasted scene). Returns success. */
  loadGame(): boolean;
  /** pause / resume the simulation around the in-game menu overlay. */
  pause(): void;
  resume(): void;
  /** play the title theme (returning to the title screen). */
  onTitle?(): void;
}

export class SceneManager {
  private screen: Screen = "title";
  private overlay: Overlay = null;
  private backTo: Screen = "title"; // pBackToScreen (backAScreen pops to this)
  private cutscenePlaying: CutScene | null = null;

  constructor(private actions: SceneActions) {}

  current(): Screen { return this.screen; }
  currentOverlay(): Overlay { return this.overlay; }
  isCutscene(): boolean { return this.screen === "intro" || this.screen === "gameOver" || this.screen === "gameComplete"; }
  activeCutScene(): CutScene | null { return this.cutscenePlaying; }
  isPaused(): boolean { return this.overlay === "ingameMenu"; }

  // goScreen(sym, action?): transition to a screen (instant), then run the on-screen action.
  // movieMaster.goScreen -> startTransition -> onScreen -> goScreenFinished -> goScreenAction.
  goScreen(target: Screen, action?: "startGame" | "playIntro" | "playWasted" | "playComplete" | "loadGame"): void {
    this.overlay = null;
    this.screen = target;
    switch (action) {
      case "startGame": this.actions.startGame(); break;
      case "playIntro": this.cutscenePlaying = "intro"; this.actions.playCutScene("intro"); break;
      case "playWasted": this.cutscenePlaying = "wasted"; this.actions.playCutScene("wasted"); break;
      case "playComplete": this.cutscenePlaying = "complete"; this.actions.playCutScene("complete"); break;
      case "loadGame": this.actions.loadGame(); break;
      default: break;
    }
  }

  // menuOptionSelected(#startGame) (movieMaster.txt:205): title -> intro cutscene -> game.
  startGameFromTitle(): void {
    this.goScreen("intro", "playIntro");
  }

  // cutSceneFinished(scene) (movieMaster.txt:108): dispatch by WHICH script finished.
  //   intro    -> #gameScreen (start the run)
  //   wasted   -> #gameScreen + #loadGame (reload the last save — NOT a fresh run)
  //   complete -> #creditsScreen (victory in the port)
  cutSceneFinished(scene: CutScene): void {
    this.cutscenePlaying = null;
    switch (scene) {
      case "intro":
        this.goScreen("game", "startGame");
        break;
      case "wasted": {
        // movieMaster: gGameOverScript finished -> #gameScreen with action #loadGame. Fall back to the
        // title when there's no save to reload (or no run to resume).
        const ok = this.actions.loadGame();
        if (ok) { this.screen = "game"; this.overlay = null; this.actions.resume(); }
        else this.toTitle();
        break;
      }
      case "complete":
        this.screen = "victory"; this.overlay = null;
        break;
    }
  }

  // gameComplete (gameMaster): play the game-complete cutscene (-> victory/credits).
  gameComplete(): void { this.goScreen("gameComplete", "playComplete"); }

  // gameOver (gameMaster.txt:102): if no wasted script -> quitToTitle; else play the wasted cutscene
  // (-> reload save). The host decides whether a wasted script exists (always true in the port).
  gameOver(hasWastedScript = true): void {
    if (!hasWastedScript) { this.toTitle(); return; }
    this.goScreen("gameOver", "playWasted");
  }

  // escapePressed (gameMaster.txt:63): pause + overlay the in-game menu.
  escapePressed(): void {
    if (this.screen !== "game") return;
    if (this.overlay === "ingameMenu") { this.closeOverlay(); return; }
    this.overlay = "ingameMenu";
    this.actions.pause();
  }

  // screenOn(sym): overlay a screen without replacing the base (instructions / showArmy / the menu).
  screenOn(overlay: Exclude<Overlay, null>): void {
    this.backTo = this.screen; this.overlay = overlay;
  }
  // backAScreen: pop the overlay (screenMaster.backAScreen -> pBackToScreen).
  backAScreen(): void { this.overlay = null; }
  closeOverlay(): void { this.overlay = null; this.actions.resume(); }

  toTitle(): void {
    this.screen = "title"; this.overlay = null; this.cutscenePlaying = null;
    this.actions.onTitle?.();
  }
  toControls(): void { this.screen = "controls"; }
}
