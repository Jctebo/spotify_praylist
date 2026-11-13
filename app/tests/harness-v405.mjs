#!/usr/bin/env node
// harness-v405 — the v405 client gate (Plan §2.9, web half):
// the Settings WALLPAPER section's Picture fit control. The
// units under test are extracted VERBATIM from
// worker/src/client.ts (the v398/v400/v401/v404 mold) and
// run against a DOM stub + a fake bridge plugin: the
// round-trip (WV405-1), the default shown (WV405-2),
// placement + labels (WV405-3), and the standing guard
// (WV405-4).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v405 runs only inside a release worktree"); process.exit(2); }
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };

// ---- verbatim extraction (balanced braces from the def line) --
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`function ${name} unbalanced`);
}

const FIT_CAPTION = "The whole picture shows, title and all. The side edges are filled with a soft blur of the picture itself.";
const FILL_CAPTION = "The picture fills the whole screen. The top is kept, so the title stays; the bottom is trimmed.";

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
  const setCalls = [];
  const plugin = {
    getWallpaperSettings() { return Promise.resolve(opts.getPayload ? opts.getPayload() : standingPayload()); },
  };
  if (opts.set !== "absent") {
    plugin.setWallpaperSettings = (patch) => {
      setCalls.push(patch);
      return Promise.resolve(
        opts.setResolve ? opts.setResolve(patch) : standingPayload({ fitMode: patch.fitMode }),
      );
    };
  }
  plugin.syncWallpaperNow = () => Promise.resolve(standingPayload());
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
  return { sandbox, el, setCalls };
}

const tick = () => new Promise((r) => setImmediate(r));
const AT = 1794000000000;

const main = async () => {
  // ---- WV405-1: the round-trip — a payload with fitMode
  // "fill" paints the select standing at Fill with the Fill
  // caption; a change to Fit calls setWallpaperSettings
  // exactly once with { fitMode: "fit" }; the repaint renders
  // from the resolved payload, not the tap. ----
  {
    const { sandbox, el, setCalls } = makeWorld({
      getPayload: () => standingPayload({ fitMode: "fill" }),
    });
    sandbox.fillWallpaperSection();
    await tick(); await tick();
    let html = el("set-wallpaper").innerHTML;
    ok(html.includes('<option value="fill" selected>Fill the screen</option>'),
      "WV405-1: a fill payload paints the select standing at Fill");
    ok(html.includes(FILL_CAPTION) && !html.includes(FIT_CAPTION),
      "WV405-1: the Fill caption stands under Fill");
    const sel = el("set-wp-fit");
    ok(!!sel.listeners.change, "WV405-1: the select binds its change");
    sel.listeners.change({ target: { value: "fit" } });
    await tick(); await tick();
    ok(setCalls.length === 1 && setCalls[0].fitMode === "fit"
      && Object.keys(setCalls[0]).length === 1,
      "WV405-1: the change writes exactly once, the fitMode subset alone");
    html = el("set-wallpaper").innerHTML;
    ok(html.includes('<option value="fit" selected>Fit the whole picture</option>')
      && html.includes(FIT_CAPTION),
      "WV405-1: the repaint follows the resolved payload (Fit + its caption)");
  }

  // ---- WV405-2: the default shown — a payload with NO
  // fitMode key (the old shell) paints the control standing
  // at Fit with the Fit caption; fitMode "fit" paints
  // identically. ----
  {
    const bare = makeWorld({ getPayload: () => standingPayload() });
    bare.sandbox.fillWallpaperSection();
    await tick(); await tick();
    const bareHtml = bare.el("set-wallpaper").innerHTML;
    ok(bareHtml.includes('<option value="fit" selected>Fit the whole picture</option>'),
      "WV405-2: no fitMode key paints standing at Fit the whole picture");
    ok(bareHtml.includes(FIT_CAPTION),
      "WV405-2: no fitMode key paints the Fit caption");
    const explicit = makeWorld({ getPayload: () => standingPayload({ fitMode: "fit" }) });
    explicit.sandbox.fillWallpaperSection();
    await tick(); await tick();
    ok(explicit.el("set-wallpaper").innerHTML === bareHtml,
      "WV405-2: fitMode 'fit' paints identically to the absent key");
  }

  // ---- WV405-3: placement + labels — the Picture fit row
  // stands after the Lock/Home toggle rows and before the
  // Phone folder row; the two option labels are exact; the
  // section's standing tail order is unmoved. ----
  {
    const payload = standingPayload({
      fitMode: "fit",
      notices: ["No saint image for today stands in the library yet."],
      applyStatus: ["Lock screen: cabrini.jpg, applied Nov 13, 7:04 AM"],
      changerRun: ["Last run: Nov 13, 7:04 AM"],
      lastSync: { outcome: "updated", changed: 5, filed: 3, removed: 2, at: AT },
      saintStatus: { standing: "filed", name: "Saint Frances Xavier Cabrini" },
    });
    const { sandbox, el } = makeWorld({ getPayload: () => payload });
    sandbox.fillWallpaperSection();
    await tick(); await tick();
    const html = el("set-wallpaper").innerHTML;
    const iHome = html.indexOf('id="set-wp-home"');
    const iFit = html.indexOf("Picture fit");
    const iPhone = html.indexOf("Phone folder");
    ok(iHome >= 0 && iFit > iHome && iPhone > iFit,
      "WV405-3: the Picture fit row stands after the toggle rows, before Phone folder");
    ok(html.includes(">Fit the whole picture</option>") && html.includes(">Fill the screen</option>"),
      "WV405-3: the two option labels are exact");
    const iNotices = html.indexOf("No saint image for today");
    const iApply = html.indexOf("Lock screen: cabrini.jpg");
    const iRun = html.indexOf("Last run: Nov 13");
    const iSync = html.indexOf('id="set-wp-sync"');
    const iSyncLine = html.indexOf("— filed 3, removed 2.");
    const iSaint = html.indexOf("Today’s saint:");
    ok(iNotices >= 0 && iApply > iNotices && iRun > iApply && iSync > iRun
      && iSyncLine > iSync && iSaint > iSyncLine,
      "WV405-3: the standing tail order is unmoved — notices · applyStatus · changerRun · Sync row · sync line · saint line");
  }

  // ---- WV405-4: the standing guard — a bridge without
  // setWallpaperSettings renders the unavailable note and
  // wires no fit control; a write against an old-shell fake
  // (a set that ignores fitMode and resolves without it)
  // repaints standing at Fit: truth wins. ----
  {
    const bare = makeWorld({ set: "absent" });
    bare.sandbox.fillWallpaperSection();
    await tick(); await tick();
    const bareHtml = bare.el("set-wallpaper").innerHTML;
    ok(bareHtml.includes("Wallpaper controls live in the app on your phone.")
      && !bareHtml.includes("set-wp-fit"),
      "WV405-4: no setWallpaperSettings renders the unavailable note, no fit control");

    const old = makeWorld({
      getPayload: () => standingPayload({ fitMode: "fit" }),
      setResolve: () => standingPayload(),
    });
    old.sandbox.fillWallpaperSection();
    await tick(); await tick();
    old.el("set-wp-fit").listeners.change({ target: { value: "fill" } });
    await tick(); await tick();
    const html = old.el("set-wallpaper").innerHTML;
    ok(old.setCalls.length === 1 && old.setCalls[0].fitMode === "fill",
      "WV405-4: the change was written once against the old-shell fake");
    ok(html.includes('<option value="fit" selected>Fit the whole picture</option>'),
      "WV405-4: the old shell's answer repaints standing at Fit — truth wins");
  }

  console.log(`\n${n - fails}/${n} harness-v405 checks passed`);
  if (fails) process.exit(1);
};

main().catch((e) => { console.error(e); process.exit(1); });
