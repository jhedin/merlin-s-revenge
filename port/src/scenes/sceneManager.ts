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
export type Overlay = "ingameMenu" | "showArmy" | "instructions" | "keyConfig" | null;

// The cutscene "scripts" the FSM routes on finish (movieMaster.cutSceneFinished dispatch). The three
// fixed full-stage scenes (intro/wasted/complete) each route differently; ANY OTHER name (a stones
// chatter scene) is an arbitrary in-game cutscene that just resumes gameplay on finish — mirroring
// movieMaster.cutSceneFinished falling through for a non-gIntro/Over/Complete scene (K12). `CutScene` is
// therefore widened to an open string with the three reserved names called out for the dispatch.
export type NamedCutScene = "intro" | "wasted" | "complete";
export type CutScene = NamedCutScene | (string & {});

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
  /** K12 playInGameCutScene: play an arbitrary named script (#ingame env) over the LIVE game view,
   *  pausing combat. Distinct from a full-stage cutscene (intro/wasted/complete). */
  playInGameCutScene?(name: string): void;
}

type GoScreenAction = "startGame" | "playIntro" | "playWasted" | "playComplete" | "loadGame";

export class SceneManager {
  private screen: Screen = "title";
  private overlay: Overlay = null;
  private backTo: Screen = "title"; // pBackToScreen (backAScreen pops to this)
  private cutscenePlaying: CutScene | null = null;
  // K12: an in-game (#ingame) chatter cutscene plays over the LIVE game screen while combat is paused.
  // It is NOT a screen change (the base stays "game"); it routes to cutSceneFinished -> resume on finish.
  private inGameCut: string | null = null;
  // K19 screen-transition tween (screenMaster: startTransition -> off all screens -> continueTransition ->
  // on the target -> finishTransition -> goScreenFinished -> the action). `transitionFrames` is the off+on
  // window; 0 = instant (the default, so the FSM unit tests keep their synchronous behavior). The host
  // ticks tickTransition() each frame; the goScreen ACTION fires only at finishTransition.
  private transitionFrames: number;
  private trans: { target: Screen; action?: GoScreenAction; left: number; total: number } | null = null;

  constructor(private actions: SceneActions, transitionFrames = 0) { this.transitionFrames = transitionFrames; }

  current(): Screen { return this.screen; }
  currentOverlay(): Overlay { return this.overlay; }
  isCutscene(): boolean { return this.screen === "intro" || this.screen === "gameOver" || this.screen === "gameComplete"; }
  /** K12: an in-game chatter cutscene is playing over the live game (combat paused, no screen change). */
  isInGameCutscene(): boolean { return this.inGameCut !== null; }
  activeCutScene(): CutScene | null { return this.inGameCut ?? this.cutscenePlaying; }
  // combat is suspended while the menu is open OR an in-game cutscene plays.
  isPaused(): boolean { return this.overlay === "ingameMenu" || this.inGameCut !== null; }

  // goScreen(sym, action?): transition to a screen, then run the on-screen action.
  // movieMaster.goScreen -> startTransition -> onScreen -> goScreenFinished -> goScreenAction.
  // With transitionFrames > 0 the screen flips at the tween midpoint and the ACTION fires at the end
  // (finishTransition); with 0 it's instant (default).
  goScreen(target: Screen, action?: GoScreenAction): void {
    this.overlay = null;
    // The screen flips immediately (state queries see the target at once — the fade renders OVER it); only
    // the goScreen ACTION is deferred to the end of the tween (finishTransition -> goScreenAction). With
    // transitionFrames=0 the action also fires synchronously (the default; preserves the FSM unit tests).
    this.screen = target;
    if (this.transitionFrames > 0 && action) {
      this.trans = { target, action, left: this.transitionFrames, total: this.transitionFrames };
      return;
    }
    this.runGoScreenAction(action);
  }

  private runGoScreenAction(action?: GoScreenAction): void {
    switch (action) {
      case "startGame": this.actions.startGame(); break;
      case "playIntro": this.cutscenePlaying = "intro"; this.actions.playCutScene("intro"); break;
      case "playWasted": this.cutscenePlaying = "wasted"; this.actions.playCutScene("wasted"); break;
      case "playComplete": this.cutscenePlaying = "complete"; this.actions.playCutScene("complete"); break;
      case "loadGame": this.actions.loadGame(); break;
      default: break;
    }
  }

  /** K19: advance the inter-screen transition tween. The host calls this once per frame while a transition
   *  is active. Returns the 0..1 tween progress (for the host's fade/flick render), or null when idle. The
   *  screen flips at the midpoint (off-screen done) and the action runs at completion (finishTransition). */
  tickTransition(): number | null {
    if (!this.trans) return null;
    const t = this.trans;
    t.left -= 1;
    if (t.left <= 0) {
      const action = t.action;
      this.trans = null;
      this.runGoScreenAction(action); // finishTransition -> goScreenFinished -> goScreenAction
      return 1;
    }
    return 1 - t.left / t.total;
  }
  /** K19: is an inter-screen transition tween currently running? */
  isTransitioning(): boolean { return this.trans !== null; }
  /** K19: the 0..1 transition progress for the host's fade render (0 when idle). */
  transitionProgress(): number { return this.trans ? 1 - this.trans.left / this.trans.total : 0; }

  // menuOptionSelected(#startGame) (movieMaster.txt:205): title -> intro cutscene -> game.
  startGameFromTitle(): void {
    this.goScreen("intro", "playIntro");
  }

  // K12 playInGameCutScene: play an arbitrary named script over the live game (#ingame environment binds
  // the LIVE Merlin, combat paused). No screen change — the base stays "game". On finish, cutSceneFinished
  // routes through the default branch -> resume gameplay. Ignored unless we're actually in the game.
  playInGameCutScene(name: string): void {
    if (this.screen !== "game" || this.inGameCut !== null) return;
    this.inGameCut = name;
    this.actions.pause();
    this.actions.playInGameCutScene?.(name);
  }

  // cutSceneFinished(scene) (movieMaster.txt:108): dispatch by WHICH script finished.
  //   intro    -> #gameScreen (start the run)
  //   wasted   -> #gameScreen + #loadGame (reload the last save — NOT a fresh run)
  //   complete -> #creditsScreen (victory in the port)
  //   <other>  -> a stones/in-game cutscene: just resume gameplay (the movieMaster default fall-through).
  cutSceneFinished(scene: CutScene): void {
    // an in-game chatter scene finishing returns straight to gameplay (movieMaster.cutSceneFinished's
    // default: a non-gIntro/Over/Complete scene falls through to no screen change -> resume the game).
    if (this.inGameCut !== null && scene === this.inGameCut) {
      this.inGameCut = null;
      this.actions.resume();
      return;
    }
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
        // movieMaster routes the game-complete script to the credits screen, which scroll-to-end then
        // route to the title (K18). The port renders credits as a "victory" overlay screen.
        this.screen = "victory"; this.overlay = null;
        break;
      default:
        // an unrecognized named script (a stones scene played via goScreen, not playInGameCutScene):
        // return to gameplay, no screen change.
        this.actions.resume();
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
