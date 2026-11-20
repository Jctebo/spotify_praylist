#!/usr/bin/env node
// harness-v403 — the v403 client gate (Plan §2.8, web half):
// the Settings WALLPAPER section's restore rows + outcome
// line. The units under test are extracted VERBATIM from
// worker/src/client.ts (the v398/v400/v401 mold) and run
// against a DOM stub + a fake bridge plugin: the rows render
// directly after the notices block and before applyStatus,
// guarded on the bridge method (a shell without
// restoreWallpaperRemoved paints byte-identical to the BASE
// client at 8c07da3 — the v402 ship tree, this branch's
// base, read from git); the outcome line composes the seven
// §1.4 forms verbatim from the wire value + the tap-stored
// name; the tap contract mirrors wallpaperSyncNow.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v403 runs only inside a release worktree"); process.exit(2); }
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const BASE_CLIENT = execFileSync("git", ["-C", WT, "show", "8c07da3:app/worker/src/client.ts"], { encoding: "utf8" });

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };

// ---- verbatim extraction (balanced braces from the def line) --
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  let i = src.indexOf("{", start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`function ${name} unbalanced`);
}
function extractVar(src, name) {
  const line = src.split("\n").find((l) => l.startsWith(`var ${name} `));
  if (!line) throw new Error(`var ${name} not found`);
  return line;
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

function makeWorld(clientSrc, opts) {
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
  if (opts.restore !== "absent") {
    plugin.restoreWallpaperRemoved = (args) => {
      calls.push(args);
      return opts.restoreImpl ? opts.restoreImpl(args) : Promise.resolve(standingPayload());
    };
  }
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
  // The BASE world extracts the standing set only — the base
  // client carries no v403 units, and its paint never calls
  // them (that absence is exactly what the guard proves).
  if (!opts.base) units.push("wallpaperRestoreLine", "wallpaperRestoreRemoved");
  const bundle = units.map((u) => extractFn(clientSrc, u)).join("\n")
    + (opts.base ? "" : "\n" + extractVar(clientSrc, "wallpaperLastRestoreName"));
  vm.runInContext(bundle, sandbox);
  return { sandbox, el, calls };
}

const tick = () => new Promise((r) => setImmediate(r));
const CABRINI = "saint-frances-xavier-cabrini__2026-11-13.jpg";
const NOAH = "as-in-the-days-of-noah__2026-11-13.jpg";
const REMOVED_LINE = "Removed by you: " + CABRINI + " — the app will not file it again.";
const APPLY_LINE = "Lock screen: cabrini.jpg, applied Nov 13, 7:04 AM";
const ENTRIES = [
  { name: CABRINI, variant: "phone" },
  { name: NOAH, variant: "watch" },
];
const restoreRow = (i, name) => '<div class="setrow"><div class="meta">' + name + '</div>'
  + '<div class="setcontrols"><button class="btn ghost" id="set-wp-restore-' + i + '">Restore</button></div></div>';
const metaRow = (t) => '<div class="setrow"><div class="meta">' + t + '</div></div>';

const main = async () => {
  // WV403-1a: with the method + two entries, exactly two
  // restore rows render directly after the notices block and
  // before applyStatus, in payload order, name in meta +
  // ghost Restore button in setcontrols.
  {
    const w = makeWorld(CLIENT);
    w.sandbox.paintWallpaperControls(standingPayload({
      notices: [REMOVED_LINE],
      removedEntries: ENTRIES,
      applyStatus: [APPLY_LINE],
    }));
    const html = w.el("set-wallpaper").innerHTML;
    ok(html.includes(restoreRow(0, CABRINI)) && html.includes(restoreRow(1, NOAH)),
      "WV403-1a: two restore rows render in the pinned shape, payload order");
    ok(html.indexOf(metaRow(REMOVED_LINE)) >= 0 &&
       html.indexOf(metaRow(REMOVED_LINE)) < html.indexOf(restoreRow(0, CABRINI)) &&
       html.indexOf(restoreRow(0, CABRINI)) < html.indexOf(restoreRow(1, NOAH)) &&
       html.indexOf(restoreRow(1, NOAH)) < html.indexOf(metaRow(APPLY_LINE)),
      "WV403-1a: the rows stand directly after the notices block and before applyStatus");
    ok((html.match(/set-wp-restore-/g) || []).length === 2,
      "WV403-1a: exactly two restore buttons stand");
  }
  // WV403-1b: the method absent (the standing shell) — the
  // section paints byte-identical to the BASE client on the
  // same payload, entries and all.
  {
    const payload = standingPayload({ notices: [REMOVED_LINE], removedEntries: ENTRIES, applyStatus: [APPLY_LINE] });
    const wNew = makeWorld(CLIENT, { restore: "absent" });
    wNew.sandbox.paintWallpaperControls(payload);
    const wBase = makeWorld(BASE_CLIENT, { restore: "absent", base: true });
    wBase.sandbox.paintWallpaperControls(payload);
    ok(wNew.el("set-wallpaper").innerHTML === wBase.el("set-wallpaper").innerHTML,
      "WV403-1b: method absent paints byte-identical to the base client");
    ok(!wNew.el("set-wallpaper").innerHTML.includes("set-wp-restore-"),
      "WV403-1b: no restore row stands without the method");
  }
  // WV403-1c: the key absent or empty renders nothing, even
  // with the method present.
  {
    const wNone = makeWorld(CLIENT);
    wNone.sandbox.paintWallpaperControls(standingPayload({ notices: [REMOVED_LINE] }));
    const wEmpty = makeWorld(CLIENT);
    wEmpty.sandbox.paintWallpaperControls(standingPayload({ notices: [REMOVED_LINE], removedEntries: [] }));
    const wPlain = makeWorld(BASE_CLIENT, { base: true });
    wPlain.sandbox.paintWallpaperControls(standingPayload({ notices: [REMOVED_LINE] }));
    ok(wNone.el("set-wallpaper").innerHTML === wEmpty.el("set-wallpaper").innerHTML &&
       wNone.el("set-wallpaper").innerHTML === wPlain.el("set-wallpaper").innerHTML,
      "WV403-1c: absent/empty removedEntries renders nothing extra");
  }
  // WV403-2a: the composer over all seven §1.4 forms,
  // verbatim, plus the failed:<cause> suffix parse and the
  // empty-for-unknown rule.
  {
    const w = makeWorld(CLIENT);
    const L = w.sandbox.wallpaperRestoreLine;
    ok(L("restored", CABRINI) === "Restored " + CABRINI + " — it is back on your phone.", "WV403-2a: restored form verbatim");
    ok(L("alreadyRunning", CABRINI) === "A sync is already running. Try the restore again in a moment.", "WV403-2a: alreadyRunning form verbatim");
    ok(L("notRemoved", CABRINI) === "That image does not stand as removed — nothing to restore.", "WV403-2a: notRemoved form verbatim");
    ok(L("notInLibrary", CABRINI) === CABRINI + " is no longer in the library, so it cannot be restored.", "WV403-2a: notInLibrary form verbatim");
    ok(L("notInSet", CABRINI) === CABRINI + " is not in today’s set, so it is not restored — the next check would remove it again.", "WV403-2a: notInSet form verbatim");
    ok(L("libraryUnread", CABRINI) === "The library could not be read just now, so nothing was changed.", "WV403-2a: libraryUnread form verbatim");
    ok(L("failed:hash", CABRINI) === "The restore did not file " + CABRINI + " (hash). It still stands as removed.", "WV403-2a: failed:hash form verbatim");
    ok(L("failed:download", CABRINI) === "The restore did not file " + CABRINI + " (download). It still stands as removed.", "WV403-2a: failed:download parses the suffix as the cause");
    ok(L("", CABRINI) === "" && L(null, CABRINI) === "" && L("somethingElse", CABRINI) === "",
      "WV403-2a: absent/empty/unrecognized composes '' (nothing renders)");
  }
  // WV403-2b: the line renders from a payload whose
  // removedEntries is already empty (the restored case: the
  // rows are gone, the line still stands, named from the
  // tap-stored variable); without the key nothing renders.
  {
    const w = makeWorld(CLIENT);
    w.sandbox.wallpaperLastRestoreName = CABRINI;
    w.sandbox.paintWallpaperControls(standingPayload({
      notices: [], removedEntries: [], restoreOutcome: "restored",
    }));
    const html = w.el("set-wallpaper").innerHTML;
    ok(html.includes(metaRow("Restored " + CABRINI + " — it is back on your phone.")),
      "WV403-2b: the outcome line stands with the rows gone, named from the tap variable");
    ok(!html.includes("set-wp-restore-"), "WV403-2b: no restore row stands after the restore");
    const w2 = makeWorld(CLIENT);
    w2.sandbox.wallpaperLastRestoreName = CABRINI;
    w2.sandbox.paintWallpaperControls(standingPayload({ notices: [], removedEntries: [] }));
    ok(!w2.el("set-wallpaper").innerHTML.includes("Restored"),
      "WV403-2b: no line renders on a payload without restoreOutcome (no stale line at open)");
  }
  // WV403-3a: the tap — the tapped button takes its running
  // state, the bridge receives exactly the tapped entry's
  // {variant, name}, the other entry's button is untouched,
  // and the resolve repaints from the answer payload.
  {
    const answer = standingPayload({ notices: [], removedEntries: [], restoreOutcome: "restored" });
    const w = makeWorld(CLIENT, { restoreImpl: () => Promise.resolve(answer) });
    w.sandbox.paintWallpaperControls(standingPayload({ notices: [REMOVED_LINE], removedEntries: ENTRIES }));
    const btn0 = w.el("set-wp-restore-0");
    const btn1 = w.el("set-wp-restore-1");
    btn0.listeners.click();
    ok(btn0.disabled === true && btn0.textContent === "Restoring…",
      "WV403-3a: the tapped button is disabled, labeled Restoring…");
    ok(w.calls.length === 1 && w.calls[0].variant === "phone" && w.calls[0].name === CABRINI &&
       Object.keys(w.calls[0]).length === 2,
      "WV403-3a: the bridge received exactly the tapped entry's {variant, name}");
    ok(btn1.disabled === false && btn1.textContent === "",
      "WV403-3a: the other entry's button is untouched");
    await tick(); await tick();
    ok(w.el("set-wallpaper").innerHTML.includes(metaRow("Restored " + CABRINI + " — it is back on your phone.")),
      "WV403-3a: the resolve repaints the section from the answer payload");
  }
  // WV403-3b: a rejection repaints through the standing get.
  {
    const w = makeWorld(CLIENT, {
      restoreImpl: () => Promise.reject(new Error("bridge down")),
      getPayload: () => standingPayload({ notices: ["GET-MARKER"], removedEntries: ENTRIES }),
    });
    w.sandbox.paintWallpaperControls(standingPayload({ notices: [REMOVED_LINE], removedEntries: ENTRIES }));
    w.el("set-wp-restore-1").listeners.click();
    ok(w.calls.length === 1 && w.calls[0].variant === "watch" && w.calls[0].name === NOAH,
      "WV403-3b: the second entry's tap sends its own identity");
    await tick(); await tick(); await tick();
    ok(w.el("set-wallpaper").innerHTML.includes(metaRow("GET-MARKER")),
      "WV403-3b: the rejection repaints through the standing get");
  }

  console.log(`\nharness-v403: ${n - fails}/${n} ok`);
  if (fails) process.exit(1);
};

main().catch((e) => { console.error(e); process.exit(1); });
