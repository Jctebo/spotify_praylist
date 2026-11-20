#!/usr/bin/env node
// harness-v394 — the v394 gate (Plan §2.5 legs WV1–WV5):
// WALLPAPER HOME SCREEN + SETTINGS — the Settings WALLPAPER
// section: fill from a stubbed bridge payload, the unavailable
// note without a shell (and on a rejecting get), switch writes
// and folder writes through the bridge with repaint from the
// resolved payload, and no ride on the mapping Save.
// Mold: harness-v392 — local wrangler (LOCAL_DEV), fixture D1
// through migration 0018 (v394 carries no migration). The
// bridge is a page-side stub installed by addInitScript; its
// call log is the assertion surface for the write legs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v394 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8994;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v394");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v394-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI_TS = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- wrangler helpers (the estate mold) -------------------------
function wranglerD1(args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function applyMigrations() {
  const dir = path.join(APP, "migrations");
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(dir, f));
  fs.rmSync(PERSIST, { recursive: true, force: true });
  const f = path.join(TMPD, "migs.sql");
  fs.writeFileSync(f, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  wranglerD1(["--file", f]);
}
const procs = [];
function startApp() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}

// The bridge stub: a mutable settings object + a call log. The
// payload shape is §2.3's, computed from the standing roots the
// same way FilingDecision computes it natively.
const STUB_JS = `
window.__wp = {
  state: { lockOn: true, homeOn: false, phoneRoot: "Pictures/Wallpapers", watchRoot: "Pictures/Ora Pro Nobis" },
  calls: [],
};
window.__wpPayload = function () {
  var s = window.__wp.state;
  var roots = ["Pictures/Ora Pro Nobis", "Pictures/Wallpapers", "DCIM/Wallpapers", "Download/Wallpapers"];
  return {
    lockOn: s.lockOn, homeOn: s.homeOn, phoneRoot: s.phoneRoot, watchRoot: s.watchRoot,
    offeredRoots: roots,
    paths: {
      phoneSaints: s.phoneRoot + "/Phone/Saints", phoneMonthly: s.phoneRoot + "/Phone/Monthly Devotion",
      watchSaints: s.watchRoot + "/Watch/Saints", watchMonthly: s.watchRoot + "/Watch/Monthly Devotion",
    },
  };
};
window.Capacitor = { Plugins: { OraDayBridge: {
  getWallpaperSettings: function () { window.__wp.calls.push(["get"]); return Promise.resolve(window.__wpPayload()); },
  setWallpaperSettings: function (args) {
    window.__wp.calls.push(["set", JSON.parse(JSON.stringify(args))]);
    Object.assign(window.__wp.state, args);
    return Promise.resolve(window.__wpPayload());
  },
} } };
`;
const STUB_REJECT_JS = `
window.Capacitor = { Plugins: { OraDayBridge: {
  getWallpaperSettings: function () { return Promise.reject(new Error("no store")); },
  setWallpaperSettings: function () { return Promise.reject(new Error("no store")); },
} } };
`;

let browser = null;
try {
  applyMigrations();
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV), D1 through 0018");

  // ---------- pin + presence (static/served) --------------------
  const sw = await (await fetch(BASE + "/sw.js")).text();
  ok(sw.includes("ora-pro-nobis-v395-1"), "pin: the served service worker carries ora-pro-nobis-v395-1");
  ok(UI_TS.includes('var CACHE = "ora-pro-nobis-v395-1"'), "pin: ui.ts pin stands at ora-pro-nobis-v395-1");
  ok(CLIENT.includes("getWallpaperSettings") && CLIENT.includes("setWallpaperSettings") && CLIENT.includes("set-wallpaper"),
    "presence: the client carries the bridge calls and the section host");

  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const openSettings = async (page) => {
    await page.goto(BASE + "/", { waitUntil: "load" });
    await page.click("#gearbtn");
    await page.waitForSelector("#set-wallpaper", { timeout: 30000 });
  };

  // ---------- WV2: no shell → the unavailable note --------------
  {
    const page = await browser.newPage();
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (/\.mp3($|\?)/.test(url)) { await route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(64) }); return; }
      await route.continue();
    });
    await openSettings(page);
    await page.waitForFunction(() => {
      const h = document.getElementById("set-wallpaper");
      return h && h.textContent.includes("Wallpaper controls live in the app on your phone.");
    }, { timeout: 15000 });
    ok(true, "WV2: with no bridge the section renders the unavailable note");
    const wired = await page.evaluate(() => !!document.getElementById("set-wp-lock") || !!document.getElementById("set-wp-phone-root"));
    ok(!wired, "WV2: with no bridge no controls are wired");
    await page.close();
  }

  // ---------- WV2b: a rejecting get → the unavailable note ------
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(STUB_REJECT_JS);
    const page = await ctx.newPage();
    await openSettings(page);
    await page.waitForFunction(() => {
      const h = document.getElementById("set-wallpaper");
      return h && h.textContent.includes("Wallpaper controls live in the app on your phone.");
    }, { timeout: 15000 });
    ok(true, "WV2: a rejecting get renders the unavailable note");
    await ctx.close();
  }

  // ---------- WV1 + WV3 + WV4 + WV5: the stubbed shell ----------
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(STUB_JS);
    const page = await ctx.newPage();
    let saveBody = null;
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (/\.mp3($|\?)/.test(url)) { await route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(64) }); return; }
      await route.continue();
    });
    await page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes("/api/player/source-settings")) {
        try { saveBody = JSON.parse(req.postData() || "null"); } catch { saveBody = null; }
      }
    });
    await openSettings(page);
    await page.waitForSelector("#set-wp-lock", { timeout: 15000 });

    // WV1: the fill renders the payload's values.
    const fill = await page.evaluate(() => {
      const lock = document.getElementById("set-wp-lock");
      const home = document.getElementById("set-wp-home");
      const host = document.getElementById("set-wallpaper");
      const phoneSel = document.getElementById("set-wp-phone-root");
      const watchSel = document.getElementById("set-wp-watch-root");
      return {
        lockText: lock && lock.textContent, lockOn: lock && lock.classList.contains("on"), lockPressed: lock && lock.getAttribute("aria-pressed"),
        homeText: home && home.textContent, homeOn: home && home.classList.contains("on"),
        text: host ? host.textContent : "",
        phoneSel: phoneSel && phoneSel.value, watchSel: watchSel && watchSel.value,
        phoneOptions: phoneSel ? phoneSel.options.length : 0,
      };
    });
    ok(fill.lockText === "On" && fill.lockOn && fill.lockPressed === "true", "WV1: the Lock switch renders the payload's ON state");
    ok(fill.homeText === "Off" && !fill.homeOn, "WV1: the Home switch renders the payload's OFF state");
    ok(fill.text.includes("Pictures/Wallpapers/Phone") && fill.text.includes("Pictures/Wallpapers/Phone/Saints") && fill.text.includes("Pictures/Wallpapers/Phone/Monthly Devotion"),
      "WV1: the phone folder row names the payload's root and its two subfolder paths");
    ok(fill.text.includes("Pictures/Ora Pro Nobis/Watch") && fill.text.includes("Pictures/Ora Pro Nobis/Watch/Saints"),
      "WV1: the watch folder row names the payload's root and its subfolder paths");
    ok(fill.phoneSel === "Pictures/Wallpapers" && fill.watchSel === "Pictures/Ora Pro Nobis" && fill.phoneOptions === 4,
      "WV1: both folder selects stand on the payload's roots over the four offered roots");

    // WV3: a switch tap writes exactly the one flipped key; the
    // repaint follows the resolved payload.
    await page.click("#set-wp-lock");
    await page.waitForFunction(() => {
      const b = document.getElementById("set-wp-lock");
      return b && b.textContent === "Off";
    }, { timeout: 15000 });
    const callsAfterLock = await page.evaluate(() => window.__wp.calls.filter((c) => c[0] === "set").map((c) => c[1]));
    ok(callsAfterLock.length === 1 && JSON.stringify(callsAfterLock[0]) === JSON.stringify({ lockOn: false }),
      "WV3: the Lock tap calls the bridge set with exactly {lockOn:false}");
    ok(true, "WV3: the repaint follows the resolved payload (the Lock switch now reads Off)");

    // WV4: a folder change writes exactly that side's root.
    await page.selectOption("#set-wp-phone-root", "DCIM/Wallpapers");
    await page.waitForFunction(() => {
      const h = document.getElementById("set-wallpaper");
      return h && h.textContent.includes("DCIM/Wallpapers/Phone/Saints");
    }, { timeout: 15000 });
    const callsAfterFolder = await page.evaluate(() => window.__wp.calls.filter((c) => c[0] === "set").map((c) => c[1]));
    ok(callsAfterFolder.length === 2 && JSON.stringify(callsAfterFolder[1]) === JSON.stringify({ phoneRoot: "DCIM/Wallpapers" }),
      "WV4: the phone-folder change calls the set with exactly {phoneRoot:'DCIM/Wallpapers'} — the watch root is not in the payload");
    ok(true, "WV4: the repaint follows the resolved object (the phone row now names the DCIM paths)");

    // WV5: the mapping Save carries none of it, and the section's
    // writes never waited for it (both already landed above).
    await page.click("#set-save");
    await sleep(2500);
    ok(!!saveBody && Array.isArray(saveBody.sources) && Object.keys(saveBody).length === 1,
      "WV5: the mapping Save's payload is unchanged — {sources} only, no wallpaper keys ride it");
    const callsFinal = await page.evaluate(() => window.__wp.calls.filter((c) => c[0] === "set").length);
    ok(callsFinal === 2, "WV5: the Save click issued no wallpaper write — the section's writes stand on their own");
    await ctx.close();
  }
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  procs.forEach((p) => { try { p.kill("SIGKILL"); } catch { /* noop */ } });
}
console.log(`# harness-v394: ${n} ok / ${fails} not-ok`);
process.exit(fails ? 1 : 0);
