#!/usr/bin/env node
// harness-v583 — Nav order: Catechesis next to Pray, Conscience one over.
//
// v583 changes (client only, presentation only): the bottom tab
// bar's conscience and podcasts buttons swap places in the
// shell markup (ui.ts SHELL_HTML), and the page menu's sections
// array (client.ts) swaps its conscience/podcasts pair to stay
// in tab order. Names, icons, contents stand; the cold open on
// Worship stands. New order: Worship · Pray · Catechesis ·
// Conscience · Sacred Art.
//
// S-legs (static, against the committed tree):
//   S1 the diff vs BASE is confined to client.ts, ui.ts,
//      this harness, and the release doc.
//   S2 migrations unchanged vs BASE; the newest stays 0042.
//   S3 the SW pin is unmoved vs BASE pre-Ship.
//   S4 the tab bar stands in the new order in ui.ts: the
//      data-tab sequence is mass · prayers · podcasts ·
//      conscience · wallpaper, the label sequence is
//      Worship · Pray · Catechesis · Conscience · Sacred
//      Art, and each moved button keeps its own icon.
//   S5 the tab machinery is unmoved vs BASE: setTab's source
//      is identical, the last-tab write + boot validation
//      lines are identical (the saved state is name-keyed),
//      and the menu sections key sequence differs from
//      BASE's only by the conscience/podcasts swap.
//   S6 THE SERVED CLIENT PARSES: the APP_JS template,
//      rendered exactly as the Worker serves it, compiles
//      whole (the 2026-11-21 v568 lesson).
//
// C-legs (over the RENDERED shell + client):
//   C1 the rendered SHELL_HTML carries the tab bar in the
//      new order (data-tab + label sequences), and the
//      cold-open default stands: bootTab starts at 'mass'.
//   C2 the boot validation, run in a slice world with a
//      stub localStorage, resolves a stored 'podcasts' and
//      a stored 'conscience' to themselves and an unknown
//      value to 'mass' — saved last-tab state survives the
//      swap by name.
//
// Run: node harness-v583.mjs [BASE_SHA]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const APP = new URL(".", import.meta.url).pathname;
const BASE = process.argv[2] || "origin/main";
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok -", name); }
  else { bad++; console.log("not ok -", name, extra === undefined ? "" : ":: " + JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync("git", args, { cwd: APP, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// ---------- S-legs ----------
const changed = git(["diff", "--name-only", BASE, "--", "app", "harness-v583.mjs", "releases"])
  .split("\n").filter(Boolean);
const allowed = new Set(["app/worker/src/client.ts", "app/worker/src/ui.ts", "harness-v583.mjs", "releases/v583-nav-order-catechesis.md"]);
check("S1 diff confined to client.ts + ui.ts + harness + release doc", changed.every((p) => allowed.has(p)), changed);
const migChanged = git(["diff", "--name-only", BASE, "--", "app/migrations"]).trim();
check("S2 migrations unchanged vs BASE", migChanged === "", migChanged);
const migList = execFileSync("ls", [APP + "app/migrations"], { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".sql")).sort();
check("S2 newest migration is 0042", migList[migList.length - 1].startsWith("0042"), migList[migList.length - 1]);
const uiSrc = readFileSync(APP + "app/worker/src/ui.ts", "utf8");
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(["show", BASE + ":app/worker/src/ui.ts"]);
check("S3 SW pin unmoved vs BASE pre-Ship", pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const clientSrc = readFileSync(APP + "app/worker/src/client.ts", "utf8");
const baseClient = git(["show", BASE + ":app/worker/src/client.ts"]);

function navBlock(src) {
  const a = src.indexOf('<nav class="tabbar"');
  const b = src.indexOf("</nav>", a);
  return a < 0 || b < 0 ? "" : src.slice(a, b);
}
function tabSeq(block) { return [...block.matchAll(/data-tab="([a-z]+)"/g)].map((m) => m[1]); }
function labelSeq(block) { return [...block.matchAll(/<span>([A-Za-z ]+)<\/span><\/span><\/button>/g)].map((m) => m[1]); }
const nav = navBlock(uiSrc);
check("S4 tab bar data-tab order is mass·prayers·podcasts·conscience·wallpaper",
  JSON.stringify(tabSeq(nav)) === JSON.stringify(["mass", "prayers", "podcasts", "conscience", "wallpaper"]), tabSeq(nav));
check("S4 tab bar label order is Worship·Pray·Catechesis·Conscience·Sacred Art",
  JSON.stringify(labelSeq(nav)) === JSON.stringify(["Worship", "Pray", "Catechesis", "Conscience", "Sacred Art"]), labelSeq(nav));
const btnOf = (block, tab) => (block.match(new RegExp('<button data-tab="' + tab + '"[\\s\\S]*?</button>')) || [""])[0];
check("S4 the Conscience button keeps its cross icon (&#10013;)", btnOf(nav, "conscience").includes("&#10013;"));
check("S4 the Catechesis button keeps its book icon", btnOf(nav, "podcasts").includes("M12 6.6 C9.9 4.8"));
check("S4 the Pray button keeps its glyph (&#10022;)", btnOf(nav, "prayers").includes("&#10022;"));

function sliceFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) return null;
  const next = src.indexOf("\nfunction ", start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}
check("S5 setTab source identical to BASE",
  sliceFn(clientSrc, "setTab") !== null && sliceFn(clientSrc, "setTab") === sliceFn(baseClient, "setTab"));
check("S5 last-tab write line identical to BASE",
  clientSrc.includes("localStorage.setItem('opn-lasttab-v492', tab)") && baseClient.includes("localStorage.setItem('opn-lasttab-v492', tab)"));
const bootLine = (s) => (s.match(/try \{ var lt = localStorage\.getItem\('opn-lasttab-v492'\);[^\n]*/) || [""])[0];
check("S5 boot validation line identical to BASE", bootLine(clientSrc) !== "" && bootLine(clientSrc) === bootLine(baseClient), bootLine(clientSrc));
function sectionKeys(src) {
  const a = src.indexOf("var sections = [");
  const b = src.indexOf("];", a);
  return [...src.slice(a, b).matchAll(/key: '([a-z]+)'/g)].map((m) => m[1]);
}
check("S5 menu sections key order differs from BASE only by the swap",
  JSON.stringify(sectionKeys(baseClient)) === JSON.stringify(["prayers", "mass", "conscience", "podcasts", "wallpaper"])
  && JSON.stringify(sectionKeys(clientSrc)) === JSON.stringify(["prayers", "mass", "podcasts", "conscience", "wallpaper"]),
  { base: sectionKeys(baseClient), cand: sectionKeys(clientSrc) });

// ---------- rendered shell + client (S6 + C-legs) ----------
function renderTpl(src, marker) {
  const at = src.indexOf(marker);
  const start = src.indexOf("= `", at) + 3;
  const end = src.indexOf("\n`;", start);
  if (at < 0 || start < 3 || end < 0) return null;
  return vm.runInContext("`" + src.slice(start, end) + "`", vm.createContext({}));
}
const shell = renderTpl(uiSrc, "SHELL_HTML");
check("C1 rendered SHELL_HTML stands", typeof shell === "string" && shell.includes('<nav class="tabbar"'));
if (typeof shell === "string") {
  const rNav = navBlock(shell);
  check("C1 rendered tab bar data-tab order is the new order",
    JSON.stringify(tabSeq(rNav)) === JSON.stringify(["mass", "prayers", "podcasts", "conscience", "wallpaper"]), tabSeq(rNav));
  check("C1 rendered tab bar label order is the new order",
    JSON.stringify(labelSeq(rNav)) === JSON.stringify(["Worship", "Pray", "Catechesis", "Conscience", "Sacred Art"]), labelSeq(rNav));
}
const appJs = renderTpl(clientSrc, "APP_JS");
check("S6 served client (rendered APP_JS) stands", typeof appJs === "string" && appJs.length > 100000);
if (typeof appJs === "string") {
  let parses = true, perr = "";
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check("S6 served client (rendered APP_JS) parses whole", parses, perr);
  check("C1 cold-open default stands in the rendered client (bootTab = 'mass')", appJs.includes("var bootTab = 'mass';"));
  const bootSrc = "var bootTab = 'mass';\n" + bootLine(appJs) + "\n;this.__boot = bootTab;";
  for (const [stored, want] of [["podcasts", "podcasts"], ["conscience", "conscience"], ["bogus", "mass"], [null, "mass"]]) {
    const world = { localStorage: { getItem: () => stored } };
    vm.createContext(world);
    vm.runInContext(bootSrc, world);
    check("C2 boot resolves stored " + JSON.stringify(stored) + " -> " + want, world.__boot === want, world.__boot);
  }
}

console.log(`# harness-v583: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
