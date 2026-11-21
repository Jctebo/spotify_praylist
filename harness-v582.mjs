#!/usr/bin/env node
// harness-v582 — Novenas search, a bigger search box.
//
// v582 changes (client only, presentation only): the Novenas
// catalog page's search input — a bare <p><input> with no
// class, and no stylesheet rule anywhere for
// input[type=search], so it rendered at browser-default
// size — gains the .novsearchbar dress in ui.ts (full
// width, 56px tall, 18px text, the entire row) and its
// wrapper in paintCatechesisNovenas. The input's id, type,
// placeholder, value binding, and wiring are unchanged;
// novenaSearchMatch and the saint order are unchanged.
//
// S-legs (static, against the committed tree):
//   S1 the diff vs BASE is confined to client.ts, ui.ts,
//      this harness, and the release doc.
//   S2 migrations unchanged vs BASE; the newest stays 0042
//      (0043 stands reserved; v582 takes no migration).
//   S3 the SW pin is unmoved vs BASE pre-Ship.
//   S4 the new dress stands: the .novsearchbar rules in
//      ui.ts (full width, 56px height, 18px text), the
//      Novenas head markup carries the new wrapper and
//      keeps id="nov-search", and the old bare <p><input
//      form is gone from the Novenas head.
//   S5 the search behavior is unmoved: novenaSearchMatch's
//      source is identical to BASE's, and the input wiring
//      (novenaSearchText = inp.value, list-only repaint)
//      stands.
//   S6 THE SERVED CLIENT PARSES: the APP_JS template,
//      rendered exactly as the Worker serves it, compiles
//      whole (the 2026-11-21 v568 lesson — worlds and
//      served legs run the RENDERED text, never the raw
//      source).
//
// C-legs (slice worlds over the RENDERED client):
//   C1 novenaSearchMatch: name hit, saint hit, miss, and
//      the empty needle (every novena matches) — the
//      matching behavior is unchanged.
//   C2 the rendered Novenas head markup carries the
//      full-width bar: the novsearchbar wrapper stands on
//      the search container and the input keeps its id.
//
// Run: node harness-v582.mjs [BASE_SHA]
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
const changed = git(["diff", "--name-only", BASE, "--", "app", "harness-v582.mjs", "releases"])
  .split("\n").filter(Boolean);
const allowed = new Set(["app/worker/src/client.ts", "app/worker/src/ui.ts", "harness-v582.mjs", "releases/v582-novenas-search-bigger.md"]);
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
const barRule = (uiSrc.match(/\.novsearchbar input \{[^}]*\}/) || [""])[0];
check("S4 .novsearchbar input rule stands (full width, 56px, 18px)",
  barRule.includes("width:100%") && barRule.includes("height:56px") && barRule.includes("font-size:18px"), barRule);
check("S4 .novsearchbar bar stands full-width with its glyph seat",
  uiSrc.includes(".novsearchbar { margin:0 0 14px; position:relative; }") && uiSrc.includes(".novsearchbar::before"));
check("S4 Novenas head carries the new wrapper and keeps the input id",
  clientSrc.includes('<div class="novsearchbar"><input type="search" id="nov-search"'));
check("S4 the old bare form is gone from the Novenas head",
  !clientSrc.includes('<p><input type="search" id="nov-search"'));
function sliceFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) return null;
  const next = src.indexOf("\nfunction ", start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}
const baseClient = git(["show", BASE + ":app/worker/src/client.ts"]);
check("S5 novenaSearchMatch source identical to BASE",
  sliceFn(clientSrc, "novenaSearchMatch") !== null && sliceFn(clientSrc, "novenaSearchMatch") === sliceFn(baseClient, "novenaSearchMatch"));
check("S5 input wiring stands (value binding + list-only repaint)",
  clientSrc.includes("novenaSearchText = inp.value;") && clientSrc.includes("list.innerHTML = novenaCatalogListHtml(state.novenasCatalog);"));

// ---------- rendered client (S6 + C-legs) ----------
const tplStart = clientSrc.indexOf("= `") + 3;
const tplEnd = clientSrc.indexOf("\n`;", tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log("not ok - APP_JS template markers"); process.exit(1); }
const appJs = vm.runInContext("`" + clientSrc.slice(tplStart, tplEnd) + "`", vm.createContext({}));
{
  let parses = true, perr = "";
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check("S6 served client (rendered APP_JS) parses whole", parses, perr);
}
{
  const world = { console };
  vm.createContext(world);
  const slice = sliceFn(appJs, "novenaSearchMatch");
  vm.runInContext(slice + "\n;this.__x = { novenaSearchMatch };", world);
  const x = world.__x;
  check("C1 search matches by name", x.novenaSearchMatch({ name: "Traditional Novena to St. Martin of Tours", saint: "St. Martin of Tours" }, "martin") === true);
  check("C1 search matches by saint", x.novenaSearchMatch({ name: "Traditional Novena to St. Martin of Tours", saint: "St. Martin of Tours" }, "tours") === true);
  check("C1 search misses cleanly", x.novenaSearchMatch({ name: "Traditional Novena to St. Martin of Tours", saint: "St. Martin of Tours" }, "xyz") === false);
  check("C1 empty search matches all", x.novenaSearchMatch({ name: "Anything", saint: "Anything" }, "  ") === true);
}
check("C2 rendered head markup carries the full-width bar + the input id",
  appJs.includes('class="novsearchbar"') && appJs.includes('id="nov-search"') && !appJs.includes('<p><input type="search" id="nov-search"'));

console.log(`# harness-v582: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
