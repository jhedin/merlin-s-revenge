import { describe, it, expect } from "vitest";
import { SceneManager, type SceneActions, type CutScene } from "@/scenes/sceneManager";

function makeScene(overrides: Partial<SceneActions> = {}) {
  const log: string[] = [];
  const actions: SceneActions = {
    startGame: () => log.push("startGame"),
    playCutScene: (s: CutScene) => log.push("play:" + s),
    loadGame: () => { log.push("loadGame"); return overrides.loadGame ? overrides.loadGame() : true; },
    pause: () => log.push("pause"),
    resume: () => log.push("resume"),
    onTitle: () => log.push("onTitle"),
    ...overrides,
  };
  return { scene: new SceneManager(actions), log };
}

describe("H2: SceneManager FSM (movieMaster/screenMaster/gameMaster)", () => {
  it("title -> startGame plays the intro cutscene; cutSceneFinished(intro) -> game + startGame", () => {
    const { scene, log } = makeScene();
    expect(scene.current()).toBe("title");
    scene.startGameFromTitle();
    expect(scene.current()).toBe("intro");
    expect(scene.isCutscene()).toBe(true);
    expect(scene.activeCutScene()).toBe("intro");
    expect(log).toContain("play:intro");
    scene.cutSceneFinished("intro");
    expect(scene.current()).toBe("game");
    expect(log).toContain("startGame");
  });

  it("gameOver plays the wasted cutscene; cutSceneFinished(wasted) -> reload save (NOT a fresh run)", () => {
    const { scene, log } = makeScene();
    scene.startGameFromTitle(); scene.cutSceneFinished("intro"); // get into game
    scene.gameOver(true);
    expect(scene.current()).toBe("gameOver");
    expect(scene.activeCutScene()).toBe("wasted");
    expect(log).toContain("play:wasted");
    const startsBefore = log.filter((l) => l === "startGame").length;
    scene.cutSceneFinished("wasted");
    expect(log).toContain("loadGame");                                   // reloaded the save
    expect(log.filter((l) => l === "startGame").length).toBe(startsBefore); // NOT a fresh run
    expect(scene.current()).toBe("game");
  });

  it("gameOver with no save falls back to the title (quitToTitle)", () => {
    const { scene, log } = makeScene({ loadGame: () => false });
    scene.startGameFromTitle(); scene.cutSceneFinished("intro");
    scene.gameOver(true);
    scene.cutSceneFinished("wasted");
    expect(scene.current()).toBe("title");        // no save -> title
    expect(log).toContain("onTitle");
  });

  it("gameOver with NO wasted script quits straight to the title", () => {
    const { scene } = makeScene();
    scene.startGameFromTitle(); scene.cutSceneFinished("intro");
    scene.gameOver(false);
    expect(scene.current()).toBe("title");
  });

  it("gameComplete plays the complete cutscene; cutSceneFinished(complete) -> victory", () => {
    const { scene, log } = makeScene();
    scene.startGameFromTitle(); scene.cutSceneFinished("intro");
    scene.gameComplete();
    expect(scene.current()).toBe("gameComplete");
    expect(log).toContain("play:complete");
    scene.cutSceneFinished("complete");
    expect(scene.current()).toBe("victory");
  });

  it("escapePressed in game pauses + overlays the menu; closeOverlay resumes", () => {
    const { scene, log } = makeScene();
    scene.startGameFromTitle(); scene.cutSceneFinished("intro");
    scene.escapePressed();
    expect(scene.isPaused()).toBe(true);
    expect(scene.currentOverlay()).toBe("ingameMenu");
    expect(log).toContain("pause");
    scene.escapePressed(); // a second escape closes the overlay
    expect(scene.isPaused()).toBe(false);
    expect(log).toContain("resume");
  });

  it("a K18 sub-screen overlay (showArmy/keyConfig/instructions) also pauses combat", () => {
    const { scene } = makeScene();
    scene.startGameFromTitle(); scene.cutSceneFinished("intro");
    for (const ov of ["showArmy", "keyConfig", "instructions"] as const) {
      scene.screenOn(ov);
      expect(scene.currentOverlay()).toBe(ov);
      expect(scene.isPaused()).toBe(true); // combat must freeze under the sub-screen (was: ran live)
    }
  });

  it("overlay screenOn / backAScreen round-trips without changing the base screen", () => {
    const { scene } = makeScene();
    scene.startGameFromTitle(); scene.cutSceneFinished("intro");
    scene.screenOn("showArmy");
    expect(scene.currentOverlay()).toBe("showArmy");
    expect(scene.current()).toBe("game"); // base unchanged
    scene.backAScreen();
    expect(scene.currentOverlay()).toBeNull();
    expect(scene.current()).toBe("game");
  });

  it("victory -> toTitle returns to the title and plays the theme", () => {
    const { scene, log } = makeScene();
    scene.startGameFromTitle(); scene.cutSceneFinished("intro");
    scene.gameComplete(); scene.cutSceneFinished("complete");
    expect(scene.current()).toBe("victory");
    scene.toTitle();
    expect(scene.current()).toBe("title");
    expect(log).toContain("onTitle");
  });
});
