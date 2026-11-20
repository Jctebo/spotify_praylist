#!/usr/bin/env node
// harness-v374 — the v374 gate (Plan §2 harness legs L1–L7):
// the block header count becomes a PLAIN count of the tracks
// listed for the block. The counting source of truth is
// state.dayDescs (the expanded descriptor list built by
// extRebuildDescs); updateBlockCounts is rewritten to tally
// descriptors per block, and the count refreshes at four sites:
// block-page paint (NEW), external settle (NEW), intentions
// landing (NEW), and the day build with its order fixed
// (rebuild BEFORE count). Own settles keep their standing
// rebuild-then-count order. Legs: S* static (the rewritten
// tally's shape, the four sites' exact placement, the SW pin,
// the whole-worker bundle), B* the browser legs — the client's
// VERBATIM descriptor + render machinery (trackDesc /
// introDescFor / expandDescs / extRebuildDescs / trackCard /
// the swap paths / paintBlockPage / blockCardHtml /
// updateBlockCounts) extracted from the candidate source and
// run in real Chromium over fixture state. Declared seams (the
// v373 pattern): the played-state store read (readPlayed → {})
// and the pure event-wiring leaves (armEllipsis / wireExpand /
// wirePlayed / refreshPlayedChrome / markPlaying / tapPlay) are
// fixture no-ops — none of them computes or writes a count; the
// settle sequences in the fixture mirror resolveExternals'
// standing settle() and intP.then orders call for call, minus
// the cache write. L7 reads the COMMITTED range (33f629a..HEAD)
// and excludes this harness's own files under app/tests/ — so
// this harness runs AFTER the Implement commit stands (the
// v371 S5 / v372 S10 / v373 S4 artifact rule). Tallies read
// from the COMPLETE log.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v374 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const BASE = "33f629a";

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };

// ---- verbatim extraction from the candidate source -------------
function extractFn(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error("extract: function not found: " + name);
  let i = src.indexOf("{", at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (!depth) return src.slice(at, j + 1); }
  }
  throw new Error("extract: unbalanced: " + name);
}
const seg = (anchor, len) => { const i = CLIENT.indexOf(anchor); if (i < 0) throw new Error("anchor not found: " + anchor); return CLIENT.slice(i, i + len); };

// ---- S legs: static ---------------------------------------------
const ubc = extractFn(CLIENT, "updateBlockCounts");
ok(ubc.includes("state.dayDescs") && ubc.includes("counts[d.block]") &&
   !ubc.includes("ownStanding") && !ubc.includes("extStanding") &&
   !ubc.includes("episodeId === 'novenas'") && !ubc.includes("st.tracks.length"),
  "S1 updateBlockCounts rewritten whole: it tallies state.dayDescs per descriptor block — the own+ext standing-list arithmetic and the novenas special case (its code patterns) are gone");
const pbp = extractFn(CLIENT, "paintBlockPage");
ok(pbp.indexOf("appendBlockSettingsCards(day, b);") >= 0 &&
   pbp.indexOf("updateBlockCounts(day);") > pbp.indexOf("appendBlockSettingsCards(day, b);"),
  "S2 paintBlockPage: updateBlockCounts(day) stands at the end, after appendBlockSettingsCards (site 1 — the defect fix)");
const settleSeg = seg("var settle = function (slot, st) {", 700);
ok(settleSeg.indexOf("extRebuildDescs(day);") >= 0 &&
   settleSeg.indexOf("extRebuildDescs(day);") < settleSeg.indexOf("extSwapCard(slot);") &&
   settleSeg.indexOf("extSwapCard(slot);") < settleSeg.indexOf("updateBlockCounts(day);"),
  "S3 external settle: rebuild → extSwapCard → updateBlockCounts, in that order (site 2)");
const intpSeg = seg("intP.then(function () {", 1000);
ok(intpSeg.indexOf("extRebuildDescs(day);") >= 0 &&
   intpSeg.indexOf("extRebuildDescs(day);") < intpSeg.indexOf("updateBlockCounts(day);") &&
   intpSeg.indexOf("updateBlockCounts(day);") < intpSeg.indexOf("paintContinue(day);"),
  "S4 intentions landing: updateBlockCounts(day) stands after the leg's extRebuildDescs and before paintContinue (site 3)");
const buildSeg = seg("blockInsertCards(day, standing);", 500);
ok(buildSeg.indexOf("extRebuildDescs(day);") >= 0 &&
   buildSeg.indexOf("extRebuildDescs(day);") < buildSeg.indexOf("updateBlockCounts(day);"),
  "S5 day build: extRebuildDescs now runs BEFORE updateBlockCounts (site 4 — the order fix)");
const osp = extractFn(CLIENT, "ownSettlePresent");
const osm = extractFn(CLIENT, "ownSettleMissing");
ok(osp.indexOf("extRebuildDescs(day);") >= 0 && osp.indexOf("extRebuildDescs(day);") < osp.indexOf("updateBlockCounts(day);") &&
   osm.indexOf("extRebuildDescs(day);") >= 0 && osm.indexOf("extRebuildDescs(day);") < osm.indexOf("updateBlockCounts(day);") &&
   !extractFn(CLIENT, "paintListenHome").includes("updateBlockCounts"),
  "S6 own settles keep their standing rebuild-then-count order unchanged; paintListenHome carries NO count call (per Plan)");
ok(UI.includes('var CACHE = "ora-pro-nobis-v374-1";') && !UI.includes("ora-pro-nobis-v373-1"),
  "S7 SW pin ora-pro-nobis-v374-1 stands; the v373 pin is gone");
let bundles = true;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v374-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
} catch { bundles = false; }
ok(bundles, "S8 the whole worker bundles clean (esbuild) — no syntax break anywhere in the client");
// L7 — diff scope from the COMMITTED range, harness files excluded.
const committed = execFileSync("git", ["-C", WT, "diff", "--name-only", `${BASE}..HEAD`], { encoding: "utf8" })
  .split("\n").filter(Boolean).sort();
const scope = committed.filter((f) => !f.startsWith("app/tests/"));
ok(JSON.stringify(scope) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]) &&
   committed.some((f) => f === "app/tests/harness-v374.mjs"),
  "L7 committed range " + BASE + "..HEAD, harness files excluded, is exactly client.ts + ui.ts (committed: " + committed.join(", ") + ")");

// ---- B legs: verbatim client in real Chromium -------------------
const PAGE_SRC = [
  (CLIENT.match(/var BS_CH = [^\n]+/) || [""])[0],
  "esc", "fmtDur", "playedMap", "presentedDateStr", "playedKey", "isPlayed", "refreshRepeatIds",
  "trackDesc", "introDescFor", "expandDescs", "introForTrack", "prayerIntentionTitle", "intentionRowCard",
  "playedDotHtml", "heardCls", "novenaInfo", "novenaLineText", "novenaSpanHtml", "readButton", "trackCard",
  "extDownloadingCard", "extPlaceholderCard", "extSlotTrack", "extSwapCard",
  "ownSlotTrack", "ownPlaceholderCard", "ownSwapRow", "extRebuildDescs", "updateBlockCounts",
  "blockCardHtml", "appendBlockSettingsCards", "paintBlockPage",
].map((x) => (x.startsWith("var BS_CH") ? x : extractFn(CLIENT, x))).join("\n");

const FIXTURE = `
var view = document.getElementById('view');
// Declared fixture seams: the played-store read and the pure
// event-wiring leaves. None computes or writes a count.
function readPlayed() { return {}; }
function armEllipsis() {}
function wireExpand() {}
function wirePlayed() {}
function refreshPlayedChrome() {}
function markPlaying() {}
function tapPlay() {}
var state = null;
${PAGE_SRC}
var DATE = '2026-11-11';
function freshState() {
  return { ownStanding: [], extStanding: [], ownSlots: {}, extSlots: {}, dayDescs: [], dayPayload: null,
    daySegments: {}, presentedDay: DATE, storedDay: DATE, expandedIntros: {}, playedCache: null,
    readTracks: {}, current: null, queue: [], repeatIds: {}, introRec: null };
}
function mkDay(blocks) {
  var caps = { 'Morning': 'from 5 AM', 'Midmorning': 'from 9 AM', 'Midday': 'at noon', 'Novenas': 'through the day', 'The AI Signal': 'after the Novenas' };
  return { date: DATE, presentedDay: DATE, dateLabel: 'Wednesday, November 11, 2026', intros: {},
    blocks: blocks.map(function (b) { return { block: b, label: b, caption: caps[b] || '', trackCount: 0, tracks: [], spotifyUrl: null }; }),
    episodes: [] };
}
function intro(name) { return { title: name, text: 'For the intention paired with ' + name + '.', streamUrl: 'https://fixture.invalid/intro-' + name.replace(/[^a-z0-9]+/gi, '-') + '.mp3', sizeBytes: 100 }; }
function ownRow(sourceKey, episodeId, block, sortOrder, title) { return { sourceKey: sourceKey, episodeId: episodeId, block: block, sortOrder: sortOrder, title: title, enabled: 1 }; }
function meta(episodeId, title) { return { episodeId: episodeId, title: title, state: 'present', enclosureUrl: 'https://fixture.invalid/' + episodeId + '.mp3', streamUrl: null, durationS: 300, sizeBytes: 1000 }; }
function extSlot(slotId, title, block, sortOrder, source) { return { slotId: slotId, title: title, block: block, sortOrder: sortOrder, source: source, fallbackToken: null, fbRow: null, feedUrl: null, matcher: null, download: null, courier: null }; }
function extPresent(title, source) { return { state: 'present', title: title, streamUrl: 'https://fixture.invalid/' + title.replace(/[^a-z0-9]+/gi, '-') + '.mp3', enclosureUrl: 'https://fixture.invalid/enc.mp3', durationSec: 480, sizeBytes: 2000, source: source }; }
function spanCount(block) { var el = view.querySelector('[data-bcount="' + block + '"]'); if (!el) return null; var m = /(\\d+) tracks/.exec(el.textContent); return m ? Number(m[1]) : null; }
function listedRows() { return view.querySelectorAll('.card').length; }
var R = {};

// ===== Scenario A — the settled world (L1, L3, L4, L6) =====
state = freshState();
var dayA = mkDay(['Morning', 'Midmorning', 'Novenas', 'The AI Signal']);
dayA.intros = { 'morning-prayer': intro('Morning Prayer'),
  'ext-gospel-exegesis': intro('Daily Gospel Exegesis'), 'ext-midmorning-prayer': intro('Midmorning Prayer'),
  'novena-alpha': intro('Novena Alpha'), 'novena-beta': intro('Novena Beta'), 'novena-gamma': intro('Novena Gamma'),
  'the-ai-signal': intro('The AI Signal') };
state.dayPayload = dayA;
state.ownStanding = [ ownRow('morning-prayer', 'morning-prayer', 'Morning', 10, 'Morning Prayer'),
  ownRow('novenas', 'novenas', 'Novenas', 10, 'Novenas'),
  ownRow('the-ai-signal', 'the-ai-signal', 'The AI Signal', 10, 'The AI Signal') ];
state.ownSlots = {
  'morning-prayer': { state: 'present', tracks: [ meta('morning-prayer', 'Morning Prayer') ] },
  'novenas': { state: 'present', tracks: [ meta('novena-alpha', 'Novena Alpha - Day 1'), meta('novena-beta', 'Novena Beta - Day 2'), meta('novena-gamma', 'Novena Gamma - Day 3') ] },
  'the-ai-signal': { state: 'present', tracks: [ { episodeId: 'the-ai-signal', title: 'The AI Signal - November 11, 2026', state: 'present', streamUrl: '/api/player/audio/2026-11-11/the-ai-signal', enclosureUrl: null, durationS: 353, sizeBytes: 2825509, hasText: false } ] } };
state.extStanding = [ extSlot('ext-gospel-exegesis', 'Daily Gospel Exegesis', 'Midmorning', 10, 'Logical Bible Study'),
  extSlot('ext-midmorning-prayer', 'Midmorning Prayer', 'Midmorning', 20, 'Divine Office') ];
state.extSlots = { 'ext-gospel-exegesis': extPresent('Daily Gospel Exegesis', 'Logical Bible Study'),
  'ext-midmorning-prayer': extPresent('Midmorning Prayer', 'Divine Office') };
extRebuildDescs(dayA);
// Home: the block cards painted, then the day-build count pass.
view.innerHTML = dayA.blocks.map(function (b) { return blockCardHtml(b); }).join('');
updateBlockCounts(dayA);
R.homeA = {}; dayA.blocks.forEach(function (b) { R.homeA[b.block] = spanCount(b.block); });
// Each block page: painted AFTER full settlement (the defect case).
R.pageA = {};
dayA.blocks.forEach(function (b) { paintBlockPage(dayA, b.block); R.pageA[b.block] = { header: spanCount(b.block), rows: listedRows() }; });

// ===== Scenario B — settles land on an open page (L2) =====
state = freshState();
var dayB = mkDay(['Midmorning']);
state.dayPayload = dayB;
state.extStanding = [ extSlot('ext-gospel-exegesis', 'Daily Gospel Exegesis', 'Midmorning', 10, 'Logical Bible Study'),
  extSlot('ext-midmorning-prayer', 'Midmorning Prayer', 'Midmorning', 20, 'Divine Office') ];
state.extSlots = { 'ext-gospel-exegesis': { state: 'loading', title: 'Daily Gospel Exegesis' },
  'ext-midmorning-prayer': { state: 'loading', title: 'Midmorning Prayer' } };
extRebuildDescs(dayB);
paintBlockPage(dayB, 'Midmorning');
R.b0 = { header: spanCount('Midmorning'), rows: listedRows() };
// Settle 1 (the standing settle() order: state, rebuild, swap,
// count — the cache write is not a display step).
var slotB1 = state.extStanding[0];
state.extSlots['ext-gospel-exegesis'] = extPresent('Daily Gospel Exegesis', 'Logical Bible Study');
extRebuildDescs(dayB); extSwapCard(slotB1); updateBlockCounts(dayB);
R.b1 = { header: spanCount('Midmorning'), rows: listedRows() };
// Settle 2.
var slotB2 = state.extStanding[1];
state.extSlots['ext-midmorning-prayer'] = extPresent('Midmorning Prayer', 'Divine Office');
extRebuildDescs(dayB); extSwapCard(slotB2); updateBlockCounts(dayB);
R.b2 = { header: spanCount('Midmorning'), rows: listedRows() };
// Intentions landing (the intP.then order for present externals:
// swap each standing card, rebuild, count).
dayB.intros = { 'ext-gospel-exegesis': intro('Daily Gospel Exegesis'), 'ext-midmorning-prayer': intro('Midmorning Prayer') };
extSwapCard(slotB1); extSwapCard(slotB2);
extRebuildDescs(dayB); updateBlockCounts(dayB);
R.b3 = { header: spanCount('Midmorning'), rows: listedRows() };

// ===== Scenario C — missing counts exactly 1 (L5) =====
state = freshState();
var dayC = mkDay(['Morning', 'Midday']);
dayC.intros = { 'daily-rosary': intro('Daily Rosary'), 'ext-midday-prayer': intro('Midday Prayer') };
state.dayPayload = dayC;
state.ownStanding = [ ownRow('daily-rosary', 'daily-rosary', 'Morning', 10, 'Daily Rosary') ];
state.ownSlots = { 'daily-rosary': { state: 'missing', tracks: [] } };
state.extStanding = [ extSlot('ext-midday-prayer', 'Midday Prayer', 'Midday', 10, 'Divine Office') ];
state.extSlots = { 'ext-midday-prayer': { state: 'missing', title: 'Midday Prayer', source: 'Divine Office' } };
extRebuildDescs(dayC);
R.descsC = state.dayDescs.map(function (d) { return { block: d.block, kind: d.kind || '', available: d.available }; });
paintBlockPage(dayC, 'Morning');
R.cMorning = { header: spanCount('Morning'), rows: listedRows() };
paintBlockPage(dayC, 'Midday');
R.cMidday = { header: spanCount('Midday'), rows: listedRows() };
return R;
`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="view"></div></body></html>`);
  const R = await page.evaluate("(async () => {\n" + FIXTURE + "\n})()");
  ok(R.pageA.Midmorning.header === 4 && R.pageA.Midmorning.rows === 4,
    "L1 paint after settlement (the reported defect): the Midmorning page header reads 4 tracks = its 4 listed rows (2 intention rows + Exegesis + Midmorning Prayer) — header=" + R.pageA.Midmorning.header + ", rows=" + R.pageA.Midmorning.rows);
  ok(R.b0.header === 2 && R.b0.rows === 2 && R.b1.header === 2 && R.b1.rows === 2 && R.b2.header === 2 && R.b2.rows === 2,
    "L2 live as settles land: the open Midmorning page reads 2 at paint (two loading slots) and holds 2 through both settles, header = listed rows at every step (" +
    [R.b0, R.b1, R.b2].map((x) => x.header + "/" + x.rows).join(" → ") + ")");
  ok(R.b3.header === 4 && R.b3.rows === 4,
    "L2 the intentions landing grows the open page's count by the two intention rows, without a repaint — header=" + R.b3.header + ", rows=" + R.b3.rows);
  ok(["Morning", "Midmorning", "Novenas", "The AI Signal"].every((b) => R.homeA[b] === R.pageA[b].header),
    "L3 Home card and block page agree for every block (home " + JSON.stringify(R.homeA) + " vs pages " +
    JSON.stringify(Object.fromEntries(Object.entries(R.pageA).map(([k, v]) => [k, v.header]))) + ")");
  ok(R.pageA.Novenas.header === 6 && R.pageA.Novenas.rows === 6,
    "L4 Novenas counts its listed tracks: 3 novenas × (intention + track) = 6, by the general rule — header=" + R.pageA.Novenas.header + ", rows=" + R.pageA.Novenas.rows);
  ok(R.pageA["The AI Signal"].header === 2 && R.pageA["The AI Signal"].rows === 2,
    "L6 The AI Signal = 2 (intention + episode) via the general computation only — header=" + R.pageA["The AI Signal"].header + ", rows=" + R.pageA["The AI Signal"].rows);
  ok(R.descsC.length === 2 && R.descsC.every((d) => d.kind !== "intention") &&
     R.descsC.filter((d) => d.block === "Morning").length === 1 && R.descsC.filter((d) => d.block === "Midday").length === 1,
    "L5 the descriptor list carries exactly one descriptor per missing track and NO orphan intention descriptor, though both intros stand in the map (descs=" + JSON.stringify(R.descsC) + ")");
  ok(R.cMorning.header === 1 && R.cMorning.rows === 1 && R.cMidday.header === 1 && R.cMidday.rows === 1,
    "L5 a missing own track and a missing external each count exactly 1 on their block pages — Morning " + R.cMorning.header + "/" + R.cMorning.rows + ", Midday " + R.cMidday.header + "/" + R.cMidday.rows);
  ok(pageErrors.length === 0, "browser: zero page errors" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
}

console.log(`# harness-v374: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
