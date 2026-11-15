#!/usr/bin/env node
// harness-v449 — Prayers takes the Formation layout (John,
// Ora thread, 2026-11-15 15:08 CT: "The only one I like is
// formation. Let's actually change prayers to that layout";
// approved To Ship as amended, package 26 record 17).
// Measured: (1) the Prayers home is the Formation home
// pattern — the toggle, the heading line (title · date ·
// the Sort act re-homed to its right), then the block rows
// one per line in the standing order, the episodes row
// last, and NOTHING else above the rows (no search box, no
// filter chips, no Continue card, no play disc on a row,
// NO chevron — the shipped Formation row carries none, the
// main seat's named correction to the package mockup);
// the whole-day Play All row + the offline line stand
// below the rows; (2) each block page opens with the
// series-style head (.podpage-head grammar: the large tile
// · the block's name · the meta line — the v448 body meta
// folded in, its data-bmeta span standing) with the
// download pillrow under it and the track rows as they
// stand; the bar stands as v448 leaves it; (3) the census:
// searchQuery / homeFilter / _dlKey / searchResultsHtml /
// the square-card family stand retired, their updaters'
// spans carried on the rows. Mold: harness-v439's
// whole-client boot (the real SHELL_HTML + APP_CSS + the
// whole COOKED APP_JS, fetch stubbed by path) driven
// through the real UI.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v449 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v448-ship";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };

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

/* ---------------- statics ---------------- */
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]),
    "S1 the worker-source diff vs the v448-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
  ok(!CLIENT.includes('class="searchrow') && !CLIENT.includes('id="day-search"') && !CLIENT.includes('data-homefilter')
    && !CLIENT.includes('id="home-chips"') && !CLIENT.includes('id="continue-slot"')
    && !CLIENT.includes('class="blockgrid') && !CLIENT.includes('class="blockcard'),
    "S2 no retired emission stands in client.ts — no searchrow, no search pill, no filter chips, no Continue slot, no square grid, no square card");
  ok(!CLIENT.includes("function searchResultsHtml(") && !CLIENT.includes("state.searchQuery") && !CLIENT.includes("state.homeFilter") && !CLIENT.includes("state._dlKey"),
    "S3 the census stands retired in code: searchResultsHtml has no standing form and no dotted code reference to state.searchQuery / state.homeFilter / state._dlKey stands (the retirement comments name the fields in prose only; paintContinue's slot read is the machinery's own no-op guard)");
  ok(CLIENT.includes("function paintContinue(") && CLIENT.includes("getElementById('continue-slot')"),
    "S3 the Continue machinery stands untouched — paintContinue keeps its slot guard and no-ops on the home");
  const home = extractFn(CLIENT, "paintListenHome");
  ok(home.includes('<div class="row headrow">') && home.includes('id="sort-btn"') && home.indexOf('id="sort-btn"') < home.indexOf('id="home-body"')
    && home.includes("openBlockOrderEditor") && !home.includes('class="searchrow') && !home.includes("data-homefilter"),
    "S4 the Sort act stands in the heading line, before the home body, wired to openBlockOrderEditor; the home paint carries no searchrow and no chips");
  const row = extractFn(CLIENT, "blockRowHtml");
  const rowRet = row.slice(row.indexOf("return "));
  ok(row.includes('class="card blockrow" data-openblock="') && row.includes("coverTileHtml(b.block, 'sm')")
    && row.includes('data-bcount="') && row.includes('data-bprayed="') && row.includes('data-carddl="')
    && !rowRet.includes("data-queue") && !rowRet.includes("chev") && !rowRet.includes("&#9654;"),
    "S5 the block row is the Formation card form — the tile seat, the standing count/prayed/downloaded spans — with NO play disc and NO chevron");
  const erow = extractFn(CLIENT, "episodesRowHtml");
  const body = extractFn(CLIENT, "homeBodyHtml");
  ok(erow.includes('data-openblock="__episodes"') && erow.includes("tone-teal") && !erow.includes("data-queue")
    && body.includes("orderedBlocks(day)") && body.includes("episodesRowHtml(day)") && !body.includes("continue-slot") && !body.includes("blockgrid"),
    "S6 the episodes row stands last in the same dress (its teal tile kept, no disc); the home body is the ordered rows alone — no slot, no grid");
  const bp = extractFn(CLIENT, "paintBlockPage");
  ok(bp.includes("paintPrayersBar(iosBarHtml({") && bp.includes('podpage-head blockhead') && bp.includes("coverTileHtml(b.block, 'large')")
    && bp.includes("blockhead-name") && bp.includes('data-bmeta="') && bp.indexOf("podpage-head") < bp.indexOf("blockpage-pillrow")
    && !bp.includes('class="blockpage-meta"'),
    "S7 the block page opens with the series head (large tile · the name · the meta line with its data-bmeta span), the pillrow under the head, the bar as v448 leaves it; the plain body meta line is folded in, not duplicated");
  ok(extractFn(CLIENT, "skelHtml").includes("rows(6, 76)") && !extractFn(CLIENT, "skelHtml").includes("blockgrid"),
    "S8 the prayers skeleton takes the rows form — the grid skeleton retires with the grid");
  ok(!UI.includes(".blockgrid") && !UI.includes(".blockcard") && !UI.includes(".searchrow {") && UI.includes(".card.blockrow") && UI.includes(".blockhead-name"),
    "S9 the square-card family + the searchrow seat rules stand down in ui.ts; the row cursor + the head name dress stand");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v449-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S10 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v448-1";'),
    "S10 (housekeeping): the SW pin stands at ora-pro-nobis-v448-1 (Ship moves it)");
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "S11 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
  const VALID = new Set(["'", '"', "`", "$", "\\", "b", "f", "n", "r", "t", "v", "0", "\n"]);
  let census = 0;
  for (let i = 0; i < RAW_JS.length; i++) {
    if (RAW_JS[i] !== "\\") continue;
    const nx = RAW_JS[i + 1];
    if (nx === undefined) break;
    if (nx === "\\") { i++; continue; }
    if (nx === "u" && (/^[0-9a-fA-F]{4}$/.test(RAW_JS.slice(i + 2, i + 6)) || RAW_JS[i + 2] === "{")) { i += 5; continue; }
    if (nx === "x" && /^[0-9a-fA-F]{2}$/.test(RAW_JS.slice(i + 2, i + 4))) { i += 3; continue; }
    if (VALID.has(nx)) { i++; continue; }
    census++; i++;
  }
  ok(census === 0, "S11 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);
}

/* ---------------- fixtures ---------------- */
const tracks = (base, count, label) => Array.from({ length: count }, (_, i) => ({ episodeId: String(base + i), title: label + " track " + (i + 1), durationS: 240, available: true, streamUrl: "__ORIGIN__/audio/" + (base + i) + ".wav" }));
const DAY = {
  ok: true, date: "2026-11-15", presentedDay: "2026-11-15", dateLabel: "Sunday, November 15, 2026",
  liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" },
  introTexts: { "9000": "For the intentions of the family" },
  blocks: [
    { block: "Morning", label: "Morning", caption: "", tracks: tracks(9000, 12, "Morning") },
    { block: "Midday", label: "Midday", caption: "", tracks: tracks(9100, 1, "Midday") },
    { block: "Afternoon", label: "Afternoon", caption: "", tracks: tracks(9200, 1, "Afternoon") },
    { block: "Evening", label: "Evening", caption: "", tracks: tracks(9300, 1, "Evening") },
    { block: "Night", label: "Night", caption: "", tracks: tracks(9400, 1, "Night") },
    { block: "Novenas", label: "Novenas", caption: "Parish novena", tracks: tracks(9500, 1, "Novenas") },
    { block: "Mass", label: "Mass", caption: "", tracks: tracks(9600, 1, "Mass") },
    { block: "Rosary", label: "Rosary", caption: "", tracks: tracks(9700, 1, "Rosary") },
  ],
  episodes: [{ episodeId: "9901", title: "Podcast Episode One", durationS: 300, available: true, streamUrl: "__ORIGIN__/audio/9901.wav" }],
};
const INDEX = { seriesList: [
  { series: "bible", title: "Bible in a Year", kind: "audio", available: true, listenedCount: 0, total: 372, currentLabel: "Day 1", showImageUrl: null },
  { series: "catholictv", title: "CatholicTV", kind: "video", available: true, latestLabel: "Nov 15", showImageUrl: null },
] };
const SERIES = { series: "bible", kind: "audio", title: "Bible in a Year", available: true, showDesc: "", showImageUrl: null,
  listenedCount: 0, total: 2, currentKey: "d1",
  entries: [
    { key: "d1", label: "Day 1", title: "Genesis", durationS: 60, listened: false, url: "https://example.com/d1.mp3", imageUrl: null, descText: null },
    { key: "d2", label: "Day 2", title: "Exodus", durationS: 60, listened: true, listenDate: "2026-11-14", url: "https://example.com/d2.mp3", imageUrl: null, descText: null },
  ] };
const VIDEO = { series: "catholictv", kind: "video", title: "CatholicTV", available: true,
  videos: [{ id: "vid1", title: "Daily Mass for Monday", dateLabel: "Nov 15, 2026", imageUrl: "", url: "https://www.youtube.com/watch?v=vid1" }] };
const EXAM = { ok: true, date: "2026-11-15", dateLabel: "Saturday, November 15",
  run: { id: 7, date: "2026-11-15", state: "open" },
  categories: ["Commandment I", "Precepts of the Church"], focusCategory: "Commandment I",
  prompts: [
    { id: 101, category: "Commandment I", text: "First question?" },
    { id: 102, category: "Commandment I", text: "Second question?" },
    { id: 1101, category: "Precepts of the Church", text: "Precepts question?" },
  ], entries: [] };
const CONF = { elapsed: "2 weeks", lastConfession: null,
  guide: [{ step_no: 1, title: "Begin", body: "Make the sign of the cross." }],
  penance: null, prep: [], history: [] };

const TPL_A2 = CLIENT.indexOf("APP_JS = `") + 10;
const COOKED = new Function("return `" + CLIENT.slice(TPL_A2, CLIENT.indexOf("`;", TPL_A2)) + "`")();
const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
var FIX = { DAY: ${JSON.stringify(DAY)}, INDEX: ${JSON.stringify(INDEX)}, SERIES: ${JSON.stringify(SERIES)}, VIDEO: ${JSON.stringify(VIDEO)}, EXAM: ${JSON.stringify(EXAM)}, CONF: ${JSON.stringify(CONF)} };
window.fetch = function (path, opts) {
  var p = String(path);
  window.__fetchLog.push(p);
  var J = function (obj) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(obj))); } }); };
  if (p.indexOf('/api/player/day') === 0) return J(FIX.DAY);
  if (p === '/api/player/podcasts') return J(FIX.INDEX);
  if (p.indexOf('/api/player/podcasts?series=bible') === 0) return J(FIX.SERIES);
  if (p.indexOf('/api/player/podcasts?series=catholictv') === 0) return J(FIX.VIDEO);
  if (p.indexOf('/api/player/source-settings') === 0) return J({ sources: [], version: 3 });
  if (p.indexOf('/api/pin/state') === 0) return J({ pinSet: true, retryAfterSeconds: 0 });
  if (p.indexOf('/api/pin/verify') === 0) return J({ token: 'tok' });
  if (p.indexOf('/api/exam/today') === 0) return J(FIX.EXAM);
  if (p.indexOf('/api/confession') === 0) return J(FIX.CONF);
  if (p.indexOf('/api/player/feed-audio') === 0) return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  return J({ ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
</` + `script>
<script>
${COOKED}
</` + `script>
</body></html>`;

const WAV = (() => {
  const sr = 8000, secs = 300, dataSize = sr * secs * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  return buf;
})();
let pageHtml = "";
const server = http.createServer((req, res) => {
  const p = (req.url || "/").split("?")[0];
  if (p === "/") { res.setHeader("Content-Type", "text/html"); res.end(pageHtml); return; }
  if (p.indexOf("/audio/") === 0) { res.setHeader("Content-Type", "audio/wav"); res.end(WAV); return; }
  res.statusCode = 404; res.end("not found");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;
pageHtml = PAGE.split("__ORIGIN__").join(ORIGIN);

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  const ev = (fn) => page.evaluate(fn);
  const rect = (sel) => ev(`(function(){ var el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; var r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height), width: Math.round(r.width) }; })()`);
  const text = (sel) => ev(`(function(){ var el = document.querySelector(${JSON.stringify(sel)}); return el ? el.textContent.trim() : null; })()`);
  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);

  /* ---- home: the stack — toggle · heading · rows, nothing else above the rows ---- */
  const stack = await ev(`(function(){
    var tog = document.getElementById('sidetoggle'), head = document.querySelector('#sidehost .headrow'), bodyEl = document.getElementById('home-body');
    var sort = document.querySelector('#sidehost .headrow #sort-btn');
    return { togStands: !!tog, headStands: !!head, sortInHead: !!sort,
      order: (tog.compareDocumentPosition(head) & 4) !== 0 && (head.compareDocumentPosition(bodyEl) & 4) !== 0,
      h1: head ? head.querySelector('h1').textContent : null,
      date: head ? head.querySelector('.sub').textContent : null,
      search: !!document.querySelector('#day-search'), chips: document.querySelectorAll('[data-homefilter]').length,
      cont: !!document.querySelector('#continue-slot'), grid: !!document.querySelector('#sidehost .blockgrid'),
      cards: document.querySelectorAll('#sidehost .blockcard').length, searchrow: !!document.querySelector('#sidehost .searchrow'),
      bar: !!document.querySelector('#pushbar .iosbar') };
  })()`);
  ok(stack.togStands && stack.headStands && stack.sortInHead && stack.order && stack.h1 === "Prayers" && !!stack.date
    && !stack.search && stack.chips === 0 && !stack.cont && !stack.grid && stack.cards === 0 && !stack.searchrow && !stack.bar,
    "H1 home stack: the toggle · the heading line (Prayers · the date · the Sort act at its right) · the rows — no search box, no chips, no Continue slot, no grid, no square cards, no bar", JSON.stringify(stack));

  /* ---- rows: one per line, full width, the standing order, the episodes row last ---- */
  await page.waitForFunction(`(document.querySelector('[data-bcount="Morning"]') || {}).textContent === '12 tracks'`, null, { timeout: 6000 }).catch(() => {});
  const rows = await ev(`(function(){
    var bodyEl = document.getElementById('home-body');
    var els = Array.prototype.slice.call(bodyEl.querySelectorAll('[data-openblock]'));
    return { keys: els.map(function (e) { return e.getAttribute('data-openblock'); }),
      forms: els.map(function (e) { return e.className; }),
      geo: els.map(function (e) { var r = e.getBoundingClientRect(); return { left: Math.round(r.left), width: Math.round(r.width), top: Math.round(r.top), height: Math.round(r.height) }; }),
      bodyW: Math.round(bodyEl.getBoundingClientRect().width),
      discs: els.filter(function (e) { return !!e.querySelector('[data-queue], .playbtn'); }).length,
      chevs: els.filter(function (e) { return !!e.querySelector('[class*=chev]'); }).length,
      counts: els.map(function (e) { var s = e.querySelector('[data-bcount]'); return s ? s.textContent : null; }),
      morningMeta: (els[0].querySelector('.meta') || {}).textContent || "",
      novenasMeta: (els.filter(function (e) { return e.getAttribute('data-openblock') === 'Novenas'; })[0].querySelector('.meta') || {}).textContent || "",
      epsMeta: (els[els.length - 1].querySelector('.meta') || {}).textContent || "" };
  })()`);
  ok(JSON.stringify(rows.keys) === JSON.stringify(["Morning", "Midday", "Afternoon", "Evening", "Night", "Novenas", "Mass", "Rosary", "__episodes"]),
    "H2 the rows stand in the standing order (the day's blocks in payload order, the episodes row last)", JSON.stringify(rows.keys));
  ok(rows.forms.every(function (c) { return c === "card blockrow"; }) && rows.discs === 0 && rows.chevs === 0,
    "H2 every row is the Formation card form (.card) with NO play disc and NO chevron element", JSON.stringify({ forms: rows.forms, discs: rows.discs, chevs: rows.chevs }));
  ok(rows.geo.every(function (g) { return g.width >= rows.bodyW - 2 && g.left === rows.geo[0].left && g.height >= 44; })
    && rows.geo.every(function (g, i) { return i === 0 || g.top > rows.geo[i - 1].top; }),
    "H2 rows stand one per line, full width, each at the 44px tap floor", JSON.stringify(rows.geo.slice(0, 3)));
  ok(rows.counts[0] === "12 tracks" && rows.morningMeta.includes("48min") && rows.novenasMeta.includes("Parish novena") && rows.novenasMeta.includes("1 tracks") && rows.epsMeta.includes("1 tracks") && rows.epsMeta.includes("5min"),
    "H3 each row's meta carries its facts — the settled count span (12 tracks), the summed duration (48min), the caption where it stands (Parish novena), the episodes row's count + duration", JSON.stringify({ counts: rows.counts, morningMeta: rows.morningMeta, novenasMeta: rows.novenasMeta, epsMeta: rows.epsMeta }));

  /* ---- the sort editor from the heading line ---- */
  await page.click("#sort-btn");
  await page.waitForSelector(".ordersheet [data-orderlist]", { timeout: 5000 });
  const before = await ev(`Array.prototype.map.call(document.querySelectorAll('.ordersheet [data-orderlist] .setname'), function (e) { return e.textContent; })`);
  await page.click('.ordersheet [data-orddown="0"]');
  await sleep(400);
  const afterMove = await ev(`(function(){
    return { sheet: Array.prototype.map.call(document.querySelectorAll('.ordersheet [data-orderlist] .setname'), function (e) { return e.textContent; }),
      homeFirst: document.querySelector('#home-body [data-openblock]').getAttribute('data-openblock') };
  })()`);
  ok(before[0] === "Morning" && afterMove.sheet[0] === "Midday" && afterMove.sheet[1] === "Morning" && afterMove.homeFirst === "Midday",
    "H4 the heading's Sort act opens the order editor; a move down re-orders the editor AND the home rows behind it (Midday first)", JSON.stringify({ before: before.slice(0, 2), afterMove }));
  await page.click('.ordersheet [data-ordup="1"]');
  await sleep(400);
  ok((await ev(`document.querySelector('#home-body [data-openblock]').getAttribute('data-openblock')`)) === "Morning",
    "H4 the move back restores the standing order on the home");
  await ev(`document.querySelector('.ordersheet').remove()`);
  await sleep(200);

  /* ---- below the rows: Play All + the offline line stand ---- */
  const below = await ev(`(function(){
    var bodyEl = document.getElementById('home-body'), pa = document.getElementById('play-all');
    return { order: (bodyEl.compareDocumentPosition(pa) & 4) !== 0, offline: !!document.getElementById('offline-dl-btn') };
  })()`);
  ok(below.order && below.offline, "H5 below the rows stand the whole-day Play All row and the offline line, as today", JSON.stringify(below));
  await ev(`document.getElementById('play-all').click()`);
  await page.waitForFunction(`!document.getElementById('dock').classList.contains('hidden')`, null, { timeout: 6000 }).catch(() => {});
  ok(((await text("#dock-title")) || "").includes("Morning track 1"),
    "H5 the whole-day Play All plays the day (the dock names its first track)", await text("#dock-title"));
  await page.click("#dock-play");
  await sleep(300);

  /* ---- block page: the bar (v448) + the series head + the pillrow + the track rows ---- */
  await ev(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  await page.waitForFunction(`(document.querySelector('[data-bmeta="Morning"]') || {}).textContent && document.querySelector('[data-bmeta="Morning"]').textContent.includes('48min')`, null, { timeout: 6000 }).catch(() => {});
  const bp = await ev(`(function(){
    var head = document.querySelector('#sidehost .podpage-head.blockhead');
    var pill = document.querySelector('#sidehost .blockpage-pillrow');
    var firstRow = document.querySelector('#sidehost .card.trow');
    var meta = head ? head.querySelector('.meta') : null;
    return { barTitle: document.querySelector('#pushbar .iosbar-title').textContent,
      headStands: !!head, cover: head ? !!head.querySelector('.blockcover.large') : false,
      name: head ? head.querySelector('.blockhead-name').textContent : null,
      metaText: meta ? meta.textContent.trim() : null,
      order: head && pill && (head.compareDocumentPosition(pill) & 4) !== 0 && (pill.compareDocumentPosition(firstRow) & 4) !== 0,
      dl: pill ? pill.querySelector('[data-blockdl="Morning"]').textContent.trim() : null,
      note: pill ? !!pill.querySelector('[data-blockdlnote="Morning"]') : false,
      plainMeta: !!document.querySelector('#sidehost .blockpage-meta'),
      rows: document.querySelectorAll('#sidehost .card.trow').length,
      rowActs: firstRow ? { play: !!firstRow.querySelector('[data-playkey]'), menu: !!firstRow.querySelector('[data-rowmenu]') } : null,
      intention: firstRow ? (firstRow.querySelector('.intention-text') || {}).textContent || null : null };
  })()`);
  ok(bp.barTitle === "Morning" && bp.headStands && bp.cover && bp.name === "Morning"
    && bp.metaText && bp.metaText.includes("12 episodes") && bp.metaText.includes("48min") && bp.order
    && bp.dl === "Download all" && bp.note && !bp.plainMeta && bp.rows === 12,
    "B1 block page: the bar as v448 leaves it; the body opens with the series head (the large tile · Morning · the meta line, 12 episodes · 48min settled in its data-bmeta span); the download pillrow stands under the head; 12 track rows follow; no plain body meta line duplicates the head", JSON.stringify(bp));
  ok(bp.rowActs && bp.rowActs.play && bp.rowActs.menu && bp.intention && bp.intention.includes("Prayer Intention:") && bp.intention.includes("For the intentions of the family"),
    "B1 the track rows stand as they are — play, the menu act, and the written intention line inside the row", JSON.stringify({ rowActs: bp.rowActs, intention: bp.intention }));

  /* ---- the head scrolls with the body; the header alone freezes ---- */
  await ev(`window.scrollTo(0, 600)`); await sleep(350);
  const barS = await rect("#pushbar .iosbar"); const brandS = await rect(".brandbar"); const headS = await rect("#sidehost .podpage-head");
  ok(barS && brandS && Math.abs(barS.top - brandS.bottom) <= 1 && headS && headS.bottom <= brandS.bottom + 2,
    "B2 scrolled: the bar sticks flush under the brand bar while the series head scrolls away beneath it — the header alone is frozen", JSON.stringify({ barS, brandS, headS }));
  await ev(`window.scrollTo(0, 0)`); await sleep(250);

  /* ---- the bar's Play All plays the block ---- */
  await page.click('#pushbar [data-queue="Morning"]');
  await page.waitForFunction(`(document.getElementById('dock-title') || {}).textContent && document.getElementById('dock-title').textContent.includes('Morning track 1')`, null, { timeout: 6000 }).catch(() => {});
  ok(((await text("#dock-title")) || "").includes("Morning track 1"),
    "B3 Play All in the bar plays the block (the dock names Morning track 1)", await text("#dock-title"));
  await page.click("#dock-play");
  await sleep(300);

  /* ---- a track row plays; its menu opens ---- */
  await page.click('#sidehost .card.trow [data-playkey="9001"]');
  await page.waitForFunction(`(document.getElementById('dock-title') || {}).textContent && document.getElementById('dock-title').textContent.includes('Morning track 2')`, null, { timeout: 6000 }).catch(() => {});
  ok(((await text("#dock-title")) || "").includes("Morning track 2"),
    "B4 a track row's play plays that track (the dock names Morning track 2)", await text("#dock-title"));
  await page.click('#sidehost .card.trow [data-rowmenu]');
  await page.waitForSelector(".anchmenu", { timeout: 5000 }).catch(() => {});
  const rowMenu = await text(".anchmenu");
  ok(!!rowMenu && rowMenu.length > 0, "B4 the track row's menu act opens its menu", String(rowMenu).slice(0, 120));
  await ev(`(document.querySelector('.menucatcher') || document.body).click()`); await sleep(200);

  /* ---- back returns home, its place kept ---- */
  await page.click("#pushbar .iosbar-back");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });
  const backHome = await ev(`(function(){
    var r = document.querySelector('[data-openblock="Morning"]').getBoundingClientRect();
    return { bar: !!document.querySelector('#pushbar .iosbar'), top: Math.round(r.top) };
  })()`);
  ok(!backHome.bar && backHome.top >= -1 && backHome.top < 915,
    "B5 the bar's back returns to the home (the host clears) with the Morning row scrolled back into view", JSON.stringify(backHome));

  /* ---- episodes page: stands as v448 leaves it (it is not a block) ---- */
  await ev(`document.querySelector('[data-openblock="__episodes"]').click()`);
  await page.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  const eps = await ev(`(function(){
    var meta = document.querySelector('#sidehost .blockpage-meta');
    return { title: document.querySelector('#pushbar .iosbar-title').textContent,
      metaText: meta ? meta.textContent.trim() : null,
      head: !!document.querySelector('#sidehost .podpage-head'),
      playrow: !!document.querySelector('#sidehost .blockpage-playrow [data-queue="__episodes"]') };
  })()`);
  ok(eps.title === "From Today’s Podcast" && eps.metaText && eps.metaText.includes("1 episodes") && eps.metaText.includes("5min") && !eps.head && eps.playrow,
    "E1 the episodes page stands as v448 leaves it — the bar, the plain meta line, the Play All body row; no series head (it is not a block page)", JSON.stringify(eps));
  await page.click("#pushbar .iosbar-back");
  await page.waitForSelector('[data-openblock="__episodes"]', { timeout: 5000 });

  /* ---- Intentions side: paints as today, bar-free ---- */
  await ev(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await sleep(900);
  ok(await ev(`!document.querySelector('#pushbar .iosbar') && (document.body.textContent || '').includes('Intentions')`),
    "I1 the Intentions side paints as today — no bar stands over a home side");
  await ev(`document.querySelector('#sidetoggle [data-side="prayers"]').click()`);
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });

  /* ---- Formation regression: the pattern Prayers now mirrors stands as shipped ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 5000 });
  ok(await ev(`document.querySelector('[data-podseries="bible"]').className === 'card' && !document.querySelector('.iosbar')`),
    "F1 the Formation index stands as shipped — its rows the plain .card form the Prayers rows now mirror; no bar on the tab home");
  await ev(`document.querySelector('[data-podseries="bible"]').click()`);
  await page.waitForSelector(".podpage-head", { timeout: 5000 });
  const fhead = await ev(`(function(){ var m = document.querySelector('.podpage-head .meta'); return m ? m.textContent.trim() : null; })()`);
  ok(!!fhead && fhead.includes("0 of 2 listened"),
    "F2 the series page's own head stands as shipped (its meta line: 0 of 2 listened) — the grammar the block pages took", String(fhead));
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 5000 });

  /* ---- 360px geometry ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  page2.on("pageerror", (e) => pageErrors.push("360: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(300);
  const geo = await page2.evaluate(`(function(){
    var els = Array.prototype.slice.call(document.querySelectorAll('#home-body [data-openblock]'));
    var g = els.map(function (e) { var r = e.getBoundingClientRect(); return { left: Math.round(r.left), width: Math.round(r.width), top: Math.round(r.top) }; });
    return { scrollW: document.documentElement.scrollWidth, first: g[0], second: g[1] };
  })()`);
  ok(geo.scrollW <= 362 && geo.first.width >= 330 && geo.second.left === geo.first.left && geo.second.top > geo.first.top,
    "G360 home at 360px: the rows stand full width, one per line, no new horizontal overflow (362 is the base's own standing measure)", JSON.stringify(geo));
  await page2.evaluate(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page2.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  const geo2 = await page2.evaluate(`(function(){
    var head = document.querySelector('#sidehost .podpage-head.blockhead');
    return { scrollW: document.documentElement.scrollWidth, head: !!head,
      name: head ? head.querySelector('.blockhead-name').textContent : null };
  })()`);
  ok(geo2.scrollW <= 362 && geo2.head && geo2.name === "Morning",
    "G360 block page at 360px: the series head stands (Morning), no new horizontal overflow", JSON.stringify(geo2));

  ok(pageErrors.length === 0, "browser: zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v449: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
