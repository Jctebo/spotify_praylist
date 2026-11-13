#!/usr/bin/env node
// harness-v404 — the v404 client gate (Plan §2.8, web half):
// the Settings WALLPAPER section after the simplification.
// The units under test are extracted VERBATIM from
// worker/src/client.ts (the v398/v400/v401 mold) and run
// against a DOM stub + a fake bridge plugin: the sync line's
// count form (WV404-1), the saint line's six forms
// (WV404-2), a stale payload carrying the retired keys
// painting no restore surface (WV404-3), and the Sync all
// button — relabeled, guarded, wired (WV404-4). The retired
// units' absence is asserted by extraction failure.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v404 runs only inside a release worktree"); process.exit(2); }
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };

// ---- verbatim extraction (balanced braces from the def line) --
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  let i = src.indexOf("{"), depth = 0;
  i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`function ${name} unbalanced`);
}

function standingPayload(extra) {
  return Object.assign({
    lockOn: true, homeOn: true,
    phoneRoot: "Pictures/Ora Pro Nobis", watchRoot: "Pictures/Ora Pro Nobis",
    offeredRoots: ["Pictures/Ora Pro Nobis", "Pictures/Wallpapers", "DCIM/Wallpapers", "Download/Wallpapers"],
    paths: {
      phoneSaints: "Pictures/Ora Pro Nobis/Phone/Saints",
      phoneMonthly: "Pictures/Ora Pro Nobis/Phone/Monthly Devotion",
      watchSaints: "Pictures/Ora Pro Nobis/Watch/Saints",
      watchMonthly: "Pictures/Ora Pro Nobis/Watch/Monthly Devotion",
    },
    notices: [],
  }, extra || {});
}

function makeWorld(opts) {
  opts = opts || {};
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id, innerHTML: "", textContent: "", disabled: false, value: "",
        listeners: {},
        addEventListener(type, fn) { this.listeners[type] = fn; },
      });
    }
    return elements.get(id);
  };
  const calls = [];
  const plugin = {
    getWallpaperSettings() { return Promise.resolve(opts.getPayload ? opts.getPayload() : standingPayload()); },
    setWallpaperSettings() { return Promise.resolve(standingPayload()); },
  };
  if (opts.sync !== "absent") {
    plugin.syncWallpaperNow = () => {
      calls.push("sync");
      return Promise.resolve(opts.syncPayload ? opts.syncPayload() : standingPayload());
    };
  }
  // A stale shell may still carry the retired method; the
  // v404 client must never call it (WV404-3).
  plugin.restoreWallpaperRemoved = () => { calls.push("restore"); return Promise.resolve(standingPayload()); };
  const sandbox = {
    console,
    document: { getElementById: el },
    window: { Capacitor: { Plugins: { OraDayBridge: plugin } } },
  };
  vm.createContext(sandbox);
  const units = ["esc", "oraBridgePlugin", "wallpaperBridge", "fillWallpaperSection",
    "paintWallpaperUnavailable", "wallpaperToggleRow", "wallpaperRootOptions",
    "paintWallpaperControls", "wallpaperWrite",
    "wallpaperSyncTime", "wallpaperSyncLine", "wallpaperSaintLine", "wallpaperSyncNow"];
  const bundle = units.map((u) => extractFn(CLIENT, u)).join("\n");
  vm.runInContext(bundle, sandbox);
  return { sandbox, el, calls };
}

const tick = () => new Promise((r) => setImmediate(r));
const AT = 1794000000000;

const main = async () => {
  // ---- WV404-1: the sync line's forms ----
  {
    const { sandbox } = makeWorld();
    const T = sandbox.wallpaperSyncTime(AT);
    const L = sandbox.wallpaperSyncLine;
    ok(L({ outcome: "updated", changed: 5, filed: 3, removed: 2, at: AT }, null)
      === "Synced " + T + " — filed 3, removed 2.",
      "WV404-1: updated with counts renders the count form");
    ok(L({ outcome: "updated", changed: 0, filed: 0, removed: 4, at: AT }, null)
      === "Synced " + T + " — filed 0, removed 4.",
      "WV404-1: a removal-only pass names its removals");
    ok(L({ outcome: "updated", changed: 4, at: AT }, null)
      === "Synced " + T + " — 4 images filed or removed.",
      "WV404-1: a legacy record without counts renders the standing changed form");
    ok(L({ outcome: "updated", changed: 1, at: AT }, null)
      === "Synced " + T + " — 1 image filed or removed.",
      "WV404-1: the legacy singular stands");
    // Up to date is UNCONDITIONAL: the v401 suppression over
    // a downlevel saint is deleted.
    ok(L({ outcome: "upToDate", changed: 0, at: AT }, { standing: "notStocked", name: "" })
      === "Synced " + T + " — already up to date.",
      "WV404-1: upToDate over a notStocked saint still reads up to date");
    ok(L({ outcome: "upToDate", changed: 0, at: AT }, { standing: "notOnPhone", name: "Saint X" })
      === "Synced " + T + " — already up to date.",
      "WV404-1: upToDate over a notOnPhone saint still reads up to date");
    ok(L({ outcome: "alreadyRunning", at: 0 }, null) === "A sync is already running.",
      "WV404-1: alreadyRunning stands");
    ok(L({ outcome: "failed", changed: 0, at: AT }, null)
      === "Sync at " + T + " did not complete. The standing checks keep running and will catch up.",
      "WV404-1: failed stands");
  }

  // ---- WV404-2: the saint line's six forms ----
  {
    const { sandbox } = makeWorld();
    const S = sandbox.wallpaperSaintLine;
    const name = "Saint Frances Xavier Cabrini";
    ok(S({ standing: "filed", name }) === "Today’s saint: " + name + " — on your phone.",
      "WV404-2: filed form verbatim");
    ok(S({ standing: "filedThisPass", name }) === "Today’s saint: " + name + " — filed at the last check and on your phone.",
      "WV404-2: filedThisPass form verbatim");
    ok(S({ standing: "refiledThisPass", name }) === "Today’s saint: " + name + " — re-filed at the last check and on your phone.",
      "WV404-2: refiledThisPass form verbatim");
    ok(S({ standing: "failed", name, cause: "hash" }) === "Today’s saint: " + name + " — not on your phone. The last filing attempt failed (hash) — the app keeps retrying at the next check.",
      "WV404-2: failed form verbatim");
    ok(S({ standing: "notOnPhone", name }) === "Today’s saint: " + name + " — not on your phone.",
      "WV404-2: notOnPhone form verbatim");
    ok(S({ standing: "notStocked", name: "" }) === "No saint image for today stands in the library yet.",
      "WV404-2: notStocked form verbatim");
    ok(S({ standing: "writtenOff", name }) === "",
      "WV404-2: the writtenOff standing composes nothing — the form is deleted");
  }

  // ---- WV404-3: a stale payload paints no restore surface;
  // the §2.5 row order stands ----
  {
    const payload = standingPayload({
      notices: ["No saint image for today stands in the library yet."],
      removedEntries: [{ name: "saint-cabrini__2026-11-13.jpg", variant: "phone" }],
      restoreOutcome: "restored",
      applyStatus: ["Lock screen: cabrini.jpg, applied Nov 13, 7:04 AM"],
      changerRun: ["Last run: Nov 13, 7:04 AM"],
      lastSync: { outcome: "updated", changed: 5, filed: 3, removed: 2, at: AT },
      saintStatus: { standing: "filed", name: "Saint Frances Xavier Cabrini" },
    });
    const { sandbox, el, calls } = makeWorld({ getPayload: () => payload });
    sandbox.fillWallpaperSection();
    await tick(); await tick();
    const html = el("set-wallpaper").innerHTML;
    ok(!html.includes("set-wp-restore") && !html.includes(">Restore</button>"),
      "WV404-3: no restore rows render from a stale payload");
    ok(!html.includes("Restored ") && !html.includes("back on your phone"),
      "WV404-3: no restore outcome line renders");
    ok(!calls.includes("restore"),
      "WV404-3: the retired bridge method is never called");
    const iNotices = html.indexOf("No saint image for today");
    const iApply = html.indexOf("Lock screen: cabrini.jpg");
    const iRun = html.indexOf("Last run: Nov 13");
    const iSync = html.indexOf('id="set-wp-sync"');
    const iSyncLine = html.indexOf("— filed 3, removed 2.");
    const iSaint = html.indexOf("Today’s saint:");
    ok(iNotices >= 0 && iApply > iNotices && iRun > iApply && iSync > iRun
      && iSyncLine > iSync && iSaint > iSyncLine,
      "WV404-3: the row order stands — notices · applyStatus · changerRun · Sync row · sync line · saint line");
  }

  // ---- WV404-4: the Sync all button ----
  {
    ok(CLIENT.includes('id="set-wp-sync">Sync all</button>') && !CLIENT.includes("Sync now"),
      "WV404-4: the button reads Sync all; Sync now stands nowhere");
    let threw = 0;
    for (const gone of ["wallpaperRestoreRemoved", "wallpaperRestoreLine"]) {
      try { extractFn(CLIENT, gone); } catch (e) { threw++; }
    }
    ok(threw === 2, "WV404-4: the retired restore units are absent from the client");
    const { sandbox, el, calls } = makeWorld({
      syncPayload: () => standingPayload({
        lastSync: { outcome: "updated", changed: 2, filed: 2, removed: 0, at: AT },
      }),
    });
    sandbox.fillWallpaperSection();
    await tick(); await tick();
    const btn = el("set-wp-sync");
    ok(!!btn.listeners.click, "WV404-4: the button renders under the guard and binds its tap");
    btn.listeners.click();
    await tick(); await tick();
    ok(calls.filter((c) => c === "sync").length === 1,
      "WV404-4: the tap calls syncWallpaperNow exactly once");
    const html = el("set-wallpaper").innerHTML;
    ok(html.includes("— filed 2, removed 0."),
      "WV404-4: the answer repaint carries the count form");
    // The guard: a shell without the method renders no button.
    const bare = makeWorld({ sync: "absent" });
    bare.sandbox.fillWallpaperSection();
    await tick(); await tick();
    ok(!bare.el("set-wallpaper").innerHTML.includes('id="set-wp-sync"'),
      "WV404-4: no button without the bridge method (the guarded render stands)");
  }

  console.log(`\n${n - fails}/${n} harness-v404 checks passed`);
  if (fails) process.exit(1);
};

main().catch((e) => { console.error(e); process.exit(1); });
