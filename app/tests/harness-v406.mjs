#!/usr/bin/env node
// harness-v406 — the v406 client gate (Plan §2.8, web half):
// one folder per side + the survival sync line. The units
// under test are extracted VERBATIM from worker/src/
// client.ts (the v404 mold) and run against a DOM stub +
// a fake bridge plugin: the folder rows over the flat pair
// and over a legacy four-key payload (WV406-1), the sync
// line's missing form with precedence (WV406-2), and the
// full section over the v406 payload (WV406-3).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v406 runs only inside a release worktree"); process.exit(2); }
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
      // v406 fixture amend: the flat pair (the legs stand).
      phone: "Pictures/Ora Pro Nobis/Phone",
      watch: "Pictures/Ora Pro Nobis/Watch",
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
  // ---- WV406-1: the folder rows ----
  {
    const { sandbox, el } = makeWorld();
    sandbox.fillWallpaperSection();
    await tick(); await tick();
    const html = el("set-wallpaper").innerHTML;
    ok(html.includes("Pictures/Ora Pro Nobis/Phone") && html.includes("Pictures/Ora Pro Nobis/Watch"),
      "WV406-1: the flat pair renders — one path line per folder row");
    ok(html.includes("Phone folder") && html.includes("Watch folder"),
      "WV406-1: both folder rows stand");
    ok(!html.includes("Saints") && !html.includes("Monthly Devotion"),
      "WV406-1: no Saints / Monthly Devotion text anywhere in the section");
    // A legacy four-key payload renders the two rows from
    // the root fallback, still with no subfolder text.
    const legacy = standingPayload({
      paths: {
        phoneSaints: "Pictures/Ora Pro Nobis/Phone/Saints",
        phoneMonthly: "Pictures/Ora Pro Nobis/Phone/Monthly Devotion",
        watchSaints: "Pictures/Ora Pro Nobis/Watch/Saints",
        watchMonthly: "Pictures/Ora Pro Nobis/Watch/Monthly Devotion",
      },
    });
    const w2 = makeWorld({ getPayload: () => legacy });
    w2.sandbox.fillWallpaperSection();
    await tick(); await tick();
    const html2 = w2.el("set-wallpaper").innerHTML;
    ok(html2.includes("Pictures/Ora Pro Nobis/Phone") && html2.includes("Pictures/Ora Pro Nobis/Watch"),
      "WV406-1: the legacy payload renders the rows from the root fallback");
    ok(!html2.includes("Saints") && !html2.includes("Monthly Devotion"),
      "WV406-1: the legacy payload renders no subfolder text either");
  }

  // ---- WV406-2: the sync line's missing form ----
  {
    const { sandbox } = makeWorld();
    const T = sandbox.wallpaperSyncTime(AT);
    const L = sandbox.wallpaperSyncLine;
    const name = "Saint Frances Xavier Cabrini";
    ok(L({ outcome: "updated", changed: 5, filed: 3, removed: 2, at: AT, missing: [name] }, null)
      === "Synced " + T + " — " + name + " is not on your phone.",
      "WV406-2: one missing names her — is not on your phone");
    ok(L({ outcome: "upToDate", changed: 0, filed: 0, removed: 0, at: AT, missing: [name, "A", "B"] }, null)
      === "Synced " + T + " — " + name + " and 2 more are not on your phone.",
      "WV406-2: three missing — first name and 2 more; precedence over upToDate");
    ok(L({ outcome: "upToDate", changed: 0, at: AT, missing: [name] }, null)
      === "Synced " + T + " — " + name + " is not on your phone.",
      "WV406-2: an upToDate pass with a missing entry renders the missing form");
    ok(L({ outcome: "updated", changed: 5, filed: 3, removed: 2, at: AT }, null)
      === "Synced " + T + " — filed 3, removed 2.",
      "WV406-2: missing absent — the v404 count form stands byte-equal");
    ok(L({ outcome: "upToDate", changed: 0, at: AT, missing: [] }, null)
      === "Synced " + T + " — already up to date.",
      "WV406-2: missing empty — up to date stands");
    ok(L({ outcome: "alreadyRunning", at: 0, missing: [name] }, null)
      === "A sync is already running.",
      "WV406-2: alreadyRunning keeps precedence over the missing form");
  }

  // ---- WV406-3: the section over the new payload ----
  {
    const payload = standingPayload({
      notices: [],
      applyStatus: ["Lock screen: cabrini.jpg, applied Nov 13, 7:04 AM"],
      changerRun: ["Changer last ran Nov 13, 7:04 AM (via sync) — saw 4 images, applied."],
      lastSync: { outcome: "updated", changed: 5, filed: 3, removed: 2, at: AT, missing: [] },
      saintStatus: { standing: "filed", name: "Saint Frances Xavier Cabrini" },
    });
    const { sandbox, el } = makeWorld({ getPayload: () => payload });
    sandbox.fillWallpaperSection();
    await tick(); await tick();
    const html = el("set-wallpaper").innerHTML;
    ok(html.includes("Phone folder") && html.includes("Watch folder")
      && html.includes('id="set-wp-sync"'),
      "WV406-3: the full section renders — folder rows + Sync all");
    ok(html.includes("— filed 3, removed 2."),
      "WV406-3: the sync line renders its count form (missing empty)");
    ok(!html.includes("undefined"),
      "WV406-3: no undefined text in any row");
    ok(!html.includes("Saints") && !html.includes("Monthly Devotion"),
      "WV406-3: no subfolder text in the full render");
  }

  console.log(`\n${n - fails}/${n} harness-v406 checks passed`);
  if (fails) process.exit(1);
};

main();
