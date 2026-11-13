#!/usr/bin/env node
// harness-v398 — the v398 client gate (Plan §2.11 leg W398-10):
// the Settings WALLPAPER section's applyStatus lines. The units
// under test are extracted VERBATIM from worker/src/client.ts
// (the v381/v397/v399 mold) and run against a DOM stub + a fake
// bridge plugin: the applyStatus block renders in the notices'
// identical setrow/meta shape directly after them (absence-
// tolerant — a payload without the key paints byte-identical to
// the BASE client at 86223a5, the v398 branch's base, read from
// git), and the notices render itself is byte-unchanged.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v398 runs only inside a release worktree"); process.exit(2); }
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const BASE_CLIENT = execFileSync("git", ["-C", WT, "show", "86223a5:app/worker/src/client.ts"], { encoding: "utf8" });

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
    "wallpaperSyncTime", "wallpaperSyncLine", "wallpaperSyncNow"];
  vm.runInContext(units.map((u) => extractFn(clientSrc, u)).join("\n"), sandbox);
  return { sandbox, el };
}

const LOCK_LINE = "Lock screen: cabrini__2026-11-13.jpg, applied Nov 13, 7:04 AM";
const HOME_LINE = "Home screen: cabrini__2026-11-13.jpg, applied Nov 13, 7:04 AM — the system confirms the change";
const NOTICE = "A note line stands here.";

const main = async () => {
  // W398-10a: with the key, both lines render in the notices'
  // identical shape, lock first as sent, AFTER the notices.
  {
    const w = makeWorld(CLIENT);
    w.sandbox.paintWallpaperControls(standingPayload({
      notices: [NOTICE],
      applyStatus: [LOCK_LINE, HOME_LINE],
    }));
    const html = w.el("set-wallpaper").innerHTML;
    const row = (t) => '<div class="setrow"><div class="meta">' + t + '</div></div>';
    ok(html.includes(row(LOCK_LINE)) && html.includes(row(HOME_LINE)),
      "W398-10a: applyStatus lines render in the identical setrow/meta shape");
    ok(html.indexOf(row(NOTICE)) >= 0 &&
       html.indexOf(row(NOTICE)) < html.indexOf(row(LOCK_LINE)) &&
       html.indexOf(row(LOCK_LINE)) < html.indexOf(row(HOME_LINE)),
      "W398-10a: the block stands directly after the notices, lock line before home line");
  }
  // W398-10b: without the key, the paint is byte-identical to
  // the BASE client's paint of the same payload (the old
  // native emits no key; the section is unchanged) — and the
  // notices render inside it is byte-unchanged.
  {
    const payload = standingPayload({ notices: [NOTICE, "Second note."] });
    const wNew = makeWorld(CLIENT);
    wNew.sandbox.paintWallpaperControls(payload);
    const wBase = makeWorld(BASE_CLIENT);
    wBase.sandbox.paintWallpaperControls(payload);
    ok(wNew.el("set-wallpaper").innerHTML === wBase.el("set-wallpaper").innerHTML,
      "W398-10b: payload without applyStatus paints byte-identical to the base client (notices render byte-unchanged)");
  }
  // W398-10c: an empty list renders nothing extra — the paint
  // equals the no-key paint on this same client.
  {
    const wEmpty = makeWorld(CLIENT);
    wEmpty.sandbox.paintWallpaperControls(standingPayload({ applyStatus: [] }));
    const wNone = makeWorld(CLIENT);
    wNone.sandbox.paintWallpaperControls(standingPayload());
    ok(wEmpty.el("set-wallpaper").innerHTML === wNone.el("set-wallpaper").innerHTML,
      "W398-10c: an empty applyStatus list renders nothing");
  }
  // W398-10d: a failed line renders verbatim through esc, in
  // the same shape (plain text, no control rides on it).
  {
    const FAIL = "Home screen: last try failed — SecurityException";
    const w = makeWorld(CLIENT);
    w.sandbox.paintWallpaperControls(standingPayload({ applyStatus: [FAIL] }));
    const html = w.el("set-wallpaper").innerHTML;
    ok(html.includes('<div class="setrow"><div class="meta">' + FAIL + '</div></div>'),
      "W398-10d: a failed-apply line renders verbatim in the meta shape");
  }

  console.log(`\nharness-v398: ${n - fails}/${n} ok`);
  if (fails) process.exit(1);
};

main().catch((e) => { console.error(e); process.exit(1); });
