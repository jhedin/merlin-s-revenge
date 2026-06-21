// Boot the packed single-file build from file:// in headless chromium, drive the player a little,
// and assert the engine reached play state with assets resolved (no network).
import { chromium } from "playwright-core";
import { readdirSync } from "node:fs";

const base = `${process.env.HOME}/.cache/ms-playwright`;
const dir = readdirSync(base).find((d) => d.startsWith("chromium_headless_shell"))!;
const EXE = `${base}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`;
const PAGE_URL = "file://" + new URL("../dist/merlins-revenge.html", import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
const logs: string[] = [];
const errs: string[] = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
page.on("requestfailed", (r) => errs.push("REQFAIL: " + r.url().slice(0, 60)));

await page.goto(PAGE_URL, { waitUntil: "load" });
await page.waitForTimeout(800);
await page.keyboard.press("Space"); // start / advance intro
await page.waitForTimeout(800);
await page.keyboard.down("ArrowDown"); await page.waitForTimeout(400); await page.keyboard.up("ArrowDown");
await page.keyboard.press("Space");
await page.waitForTimeout(400);

const state = await page.evaluate(`(() => {
  const g = window.__game;
  if (!g) return { ok:false, why:"no __game" };
  return { ok:true, mode: window.__mode && window.__mode(), entities: g.entities.length };
})()`);

await page.screenshot({ path: new URL("../dist/singlefile-check.png", import.meta.url).pathname });
await browser.close();

const assetReqFails = errs.filter((e) => e.includes("/assets/"));
console.log("pageerrors:", errs.filter((e) => e.startsWith("PAGEERROR")).join(" | ") || "none");
console.log("asset request failures:", assetReqFails.length);
console.log("state:", JSON.stringify(state));
const ok = (state as { ok?: boolean }).ok && errs.filter((e) => e.startsWith("PAGEERROR")).length === 0 && assetReqFails.length === 0;
console.log(ok ? "VERIFY: PASS" : "VERIFY: FAIL");
process.exit(ok ? 0 : 1);
