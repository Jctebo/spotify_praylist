#!/usr/bin/env node
// harness-v401 — the v401 client gate (Plan §2.8 leg W401-7,
// web half): the Settings WALLPAPER section's changerRun
// lines. The units under test are extracted VERBATIM from
// worker/src/client.ts (the v398/v400 mold) and run against a
// DOM stub + a fake bridge plugin: the changerRun block
// renders in the applyStatus block's identical setrow/meta
// shape directly after it (the two changer instruments stand
// together), absence-tolerant — a payload without the key
// paints byte-identical to the BASE client, read from git —
// and an empty list renders nothing.
// v405 fixture amendment (count held): the BASE is re-pointed
// to 2f415b58, the v404 ship tree — the previous release's
// client — and the byte-identity leg strips the v405 Picture
// fit row, the one unconditional paint addition (§2.3: it
// renders standing at Fit even when the payload carries no
// fitMode), asserting it is exactly one row in the same leg.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v401 runs only inside a release worktree"); process.exit(2); }
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const BASE_CLIENT = execFileSync("git", ["-C", WT, "show", "2f415b58:app/worker/src/client.ts"], { encoding: "utf8" });

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
// v406 amend (named in v406 §3 per Plan §2.8): the base-client
// byte-identity legs predate the folder flattening — the two
// folder rows are v406's deliberate change, so the comparison
// strips exactly those two rows from both paints and asserts
// byte-identity over everything else.
const stripFolderRows = (html) => html.replace(/<div class="setrow"><div class="setname">(?:Phone|Watch) folder<\/div>[\s\S]*?<\/select><\/div><\/div>/g, "");


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

function makeWorld(clientSrc) {
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
  const plugin = {
    getWallpaperSettings() { return Promise.resolve(standingPayload()); },
    setWallpaperSettings() { return Promise.resolve(standingPayload()); },
  };
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
  vm.runInContext(units.map((u) => extractFn(clientSrc, u)).join("\n"), sandbox);
  return { sandbox, el };
}

const NOTICE = "A note line stands here.";
const APPLY_LINE = "Lock screen: cabrini__2026-11-13.jpg, applied Nov 13, 7:04 AM";
const RUN_LINE = "Changer last ran Nov 13, 7:04 AM (via unlock) — saw 4 images, applied.";
const SERVICE_LINE = "Changer service: last seen Nov 13, 7:04 AM (started).";
const NEVER_LINE = "Changer has not run yet on this build.";
const row = (t) => '<div class="setrow"><div class="meta">' + t + '</div></div>';

const main = async () => {
  // W401-7a: with the key, both changerRun lines render in the
  // identical shape, directly after the applyStatus block.
  {
    const w = makeWorld(CLIENT);
    w.sandbox.paintWallpaperControls(standingPayload({
      notices: [NOTICE],
      applyStatus: [APPLY_LINE],
      changerRun: [RUN_LINE, SERVICE_LINE],
    }));
    const html = w.el("set-wallpaper").innerHTML;
    ok(html.includes(row(RUN_LINE)) && html.includes(row(SERVICE_LINE)),
      "W401-7a: changerRun lines render in the identical setrow/meta shape");
    ok(html.indexOf(row(NOTICE)) >= 0 &&
       html.indexOf(row(NOTICE)) < html.indexOf(row(APPLY_LINE)) &&
       html.indexOf(row(APPLY_LINE)) < html.indexOf(row(RUN_LINE)) &&
       html.indexOf(row(RUN_LINE)) < html.indexOf(row(SERVICE_LINE)),
      "W401-7a: the block stands directly after applyStatus (notices < applyStatus < run line < service line)");
  }
  // W401-7b: without the key, the paint is byte-identical to
  // the BASE client's paint of the same payload (the old
  // native emits no key; the section is unchanged).
  {
    const payload = standingPayload({ notices: [NOTICE], applyStatus: [APPLY_LINE] });
    const wNew = makeWorld(CLIENT);
    wNew.sandbox.paintWallpaperControls(payload);
    const wBase = makeWorld(BASE_CLIENT);
    wBase.sandbox.paintWallpaperControls(payload);
    // v405+v406 composed amendment: strip the one fit row from
    // the new paint and the two folder rows from both paints (the
    // v406 stripFolderRows helper above); the remainder is byte-identical.
    const newHtml = wNew.el("set-wallpaper").innerHTML;
    const fitStart = newHtml.indexOf('<div class="setrow"><div class="setname">Picture fit</div>');
    const fitTail = '</select></div></div>';
    const fitEnd = fitStart < 0 ? -1 : newHtml.indexOf(fitTail, fitStart) + fitTail.length;
    const stripped = fitStart < 0 ? newHtml : newHtml.slice(0, fitStart) + newHtml.slice(fitEnd);
    ok(fitStart >= 0 && newHtml.indexOf("Picture fit", fitEnd) < 0
      && stripFolderRows(stripped) === stripFolderRows(wBase.el("set-wallpaper").innerHTML),
      "W401-7b: payload without changerRun paints byte-identical to the base client");
  }
  // W401-7c: an empty list renders nothing extra — the paint
  // equals the no-key paint on this same client.
  {
    const wEmpty = makeWorld(CLIENT);
    wEmpty.sandbox.paintWallpaperControls(standingPayload({ changerRun: [] }));
    const wNone = makeWorld(CLIENT);
    wNone.sandbox.paintWallpaperControls(standingPayload());
    ok(wEmpty.el("set-wallpaper").innerHTML === wNone.el("set-wallpaper").innerHTML,
      "W401-7c: an empty changerRun list renders nothing");
  }
  // W401-7d: the never-ran line renders verbatim in the meta
  // shape (a phone with no run record states it, not a blank).
  {
    const w = makeWorld(CLIENT);
    w.sandbox.paintWallpaperControls(standingPayload({ changerRun: [NEVER_LINE] }));
    const html = w.el("set-wallpaper").innerHTML;
    ok(html.includes(row(NEVER_LINE)),
      "W401-7d: the never-ran line renders verbatim in the meta shape");
  }

  console.log(`\nharness-v401: ${n - fails}/${n} ok`);
  if (fails) process.exit(1);
};

main().catch((e) => { console.error(e); process.exit(1); });
