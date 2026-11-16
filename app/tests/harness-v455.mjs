#!/usr/bin/env node
// harness-v455 — Streamline the prayer pages (approved To
// Ship, package 29 record 19, as amended by v457's approval
// record 22: v455 ships D1 + D3 ONLY — D2, the toggle
// compression, is superseded by v457 and the .segtoggle
// stands untouched here). Measured: (1) D1 — the block
// page's series-style head retires completely: no
// .podpage-head.blockhead, no cover tile, no
// .blockhead-name; the bar carries the block's name once;
// the body opens with the meta as one plain .blockpage-meta
// line (the data-bmeta span inside it, its settlement
// writer untouched), then the download as plain body lines
// (the .blockpage-dlact text act + its note), the track
// rows as they stand; (2) D3 — the block page bar's menu
// gains the Go to group APPENDED after the standing items
// (Sort · Mark all · Share · Open in Spotify): one item per
// block of the day in day order, the standing block's item
// carrying the 'Here' state with the close-only act,
// Intentions last flipping the Prayers side; the Mark-all
// post-mount wiring reads [data-menuitem="1"] BY POSITION,
// so the append order is a hard constraint and carries its
// proof leg; (3) in-scope regressions: the episodes page,
// the Formation series pages' .podpage-head, the Prayers
// home, the untouched toggle. Mold: harness-v439's
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
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v455 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v453-ship";
const BASE_CLIENT = execFileSync("git", ["-C", WT, "show", BASE + ":app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
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
    "ST1 the worker-source diff vs the v453-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
  const bp = extractFn(CLIENT, "paintBlockPage");
  ok(!bp.includes("podpage-head blockhead") && !bp.includes("blockhead-name") && !bp.includes("coverTileHtml(b.block, 'large')") && !bp.includes("blockpage-pillrow") && !bp.includes("chipbtn")
    && bp.includes("coverTileHtml(b.block, 'sm')"),
    "ST2 D1: paintBlockPage emits no series head — no .podpage-head.blockhead, no .blockhead-name, no large cover tile call, no pillrow, no chipbtn (the share sheet's standing 'sm' tile call stands)");
  ok(bp.includes('class="blockpage-meta"') && bp.includes('<span data-bmeta="') && bp.includes('class="blockpage-dlact" data-blockdl="') && bp.includes('data-blockdlnote="')
    && bp.indexOf('class="blockpage-meta"') < bp.indexOf('data-blockdl="') && bp.indexOf('data-blockdl="') < bp.indexOf('data-blockdlnote="'),
    "ST2 D1: the body opens with the plain .blockpage-meta line (the data-bmeta span inside it), then the download text act, then its note line — in that order");
  ok(bp.includes("state: 'Here'") && bp.includes("openBlockPage(x.block)") && bp.includes("switchSide('prayers', 'intentions')") && bp.includes("x.block === '__episodes'")
    && bp.indexOf("Open in Spotify") < bp.indexOf("state: 'Here'") && bp.indexOf("state: 'Here'") < bp.indexOf("openSheetMenu(b.label")
    && bp.indexOf("openSheetMenu(b.label") < bp.indexOf("querySelector('[data-menuitem=\"1\"]')"),
    "ST3 D3: the Go to construction reads day.blocks (the episodes pseudo-page skipped), marks the standing block 'Here', calls the standing openBlockPage / switchSide acts, and APPENDS after the standing items — the openSheetMenu call and the [data-menuitem=\"1\"] Mark-all wiring stand after it");
  ok(CLIENT.includes("function coverTileHtml(") && (CLIENT.split('<div class="podpage-head">').length - 1) === 3
    && extractFn(CLIENT, "openBlockPage") === extractFn(BASE_CLIENT, "openBlockPage")
    && extractFn(CLIENT, "switchSide") === extractFn(BASE_CLIENT, "switchSide")
    && extractFn(CLIENT, "updateBlockCounts") === extractFn(BASE_CLIENT, "updateBlockCounts"),
    "ST4 the standing machinery stands untouched: coverTileHtml + the three series-page .podpage-head emissions stand; openBlockPage, switchSide and the data-bmeta settlement writer (updateBlockCounts) are byte-identical to the base");
  ok(extractFn(CLIENT, "paintSideToggle") === extractFn(BASE_CLIENT, "paintSideToggle") && !bp.includes("segtoggle"),
    "ST5 D2 stands untouched (superseded by v457): paintSideToggle is byte-identical to the base and paintBlockPage carries no toggle work");
  ok(!UI.includes(".blockhead-name") && !UI.includes(".blockpage-pillrow") && UI.includes(".podpage-head {") && UI.includes(".blockpage-meta {") && UI.includes(".blockpage-dlnote {") && UI.includes(".blockpage-dlact {"),
    "ST6 ui.ts: the .blockhead-name + .blockpage-pillrow rules retire with their only emitters; .podpage-head (the series pages), .blockpage-meta, .blockpage-dlnote stand; the download act's plain text-act dress (.blockpage-dlact) stands");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v455-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "ST7 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v453-1";'),
    "ST8 (housekeeping): the SW pin stands at ora-pro-nobis-v453-1 (Ship moves it)");
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "ST9 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
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
  ok(census === 0, "ST9 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);
}

/* ---------------- fixtures ---------------- */
const tracks = (base, count, label) => Array.from({ length: count }, (_, i) => ({ episodeId: String(base + i), title: label + " track " + (i + 1), durationS: 240, available: true, streamUrl: "__ORIGIN__/audio/" + (base + i) + ".wav" }));
const DAY = {
  ok: true, date: "2026-11-15", presentedDay: "2026-11-15", dateLabel: "Sunday, November 15, 2026",
  liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" },
  introTexts: { "9000": "For the intentions of the family" },
  blocks: [
    { block: "Morning", label: "Morning", caption: "Morning prayers", spotifyUrl: "https://open.spotify.com/playlist/morning", tracks: tracks(9000, 3, "Morning") },
    { block: "Midday", label: "Midday", caption: "", tracks: tracks(9100, 2, "Midday") },
    { block: "Evening", label: "Evening", caption: "", tracks: tracks(9200, 1, "Evening") },
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
  const sr = 8000, secs = 1, dataSize = sr * secs * 2;
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
  const text = (sel) => ev(`(function(){ var el = document.querySelector(${JSON.stringify(sel)}); return el ? el.textContent.trim() : null; })()`);
  const menuRows = () => ev(`Array.prototype.map.call(document.querySelectorAll('.anchmenu [data-menuitem]'), function (r) {
    var st = r.querySelector('[data-menustate]');
    return { label: r.querySelector('.grow').textContent, state: st ? st.textContent : null, mark: r.getAttribute('data-markblock') };
  })`);
  const openMenu = async () => { await page.click('#pushbar [data-blockmenu]'); await page.waitForSelector(".anchmenu", { timeout: 5000 }); await sleep(150); };
  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);

  /* ---- home regression: the toggle + the rows stand as today ---- */
  const home = await ev(`(function(){
    var tog = document.getElementById('sidetoggle');
    var els = Array.prototype.slice.call(document.querySelectorAll('#home-body [data-openblock]'));
    return { tog: !!tog, togBtns: tog ? Array.prototype.map.call(tog.querySelectorAll('[data-side]'), function (b) { return b.getAttribute('data-side'); }) : [],
      keys: els.map(function (e) { return e.getAttribute('data-openblock'); }),
      forms: els.map(function (e) { return e.className; }), bar: !!document.querySelector('#pushbar .iosbar') };
  })()`);
  ok(home.tog && JSON.stringify(home.togBtns) === JSON.stringify(["prayers", "intentions"])
    && JSON.stringify(home.keys) === JSON.stringify(["Morning", "Midday", "Evening", "__episodes"])
    && home.forms.every(function (c) { return c === "card blockrow"; }) && !home.bar,
    "H1 home stands as today — the Prayers | Intentions toggle (D2 untouched), the block rows in day order with the episodes row last, no bar over the home", JSON.stringify(home));

  /* ---- D1: the block page opens on the plain meta line ---- */
  await ev(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  await page.waitForFunction(`(document.querySelector('[data-bmeta="Morning"]') || {}).textContent && document.querySelector('[data-bmeta="Morning"]').textContent.includes('12min')`, null, { timeout: 6000 }).catch(() => {});
  const bp = await ev(`(function(){
    var host = document.getElementById('sidehost');
    var first = host ? host.firstElementChild : null;
    var meta = host.querySelector('.blockpage-meta');
    var span = host.querySelector('[data-bmeta="Morning"]');
    var dl = host.querySelector('[data-blockdl="Morning"]');
    var note = host.querySelector('[data-blockdlnote="Morning"]');
    var firstRow = host.querySelector('.card.trow');
    return { barTitle: document.querySelector('#pushbar .iosbar-title').textContent,
      barDisc: !!document.querySelector('#pushbar [data-queue="Morning"]'), barMenu: !!document.querySelector('#pushbar [data-blockmenu]'),
      head: !!host.querySelector('.podpage-head'), headName: !!host.querySelector('.blockhead-name'),
      cover: !!host.querySelector('.blockcover'), pillrow: !!host.querySelector('.blockpage-pillrow'),
      firstCls: first ? first.className : null,
      metaText: meta ? meta.textContent.trim() : null,
      spanInMeta: !!(span && meta && meta.contains(span)),
      dlCls: dl ? dl.className : null, dlText: dl ? dl.textContent.trim() : null,
      dlNoteOrder: !!(dl && note && (dl.compareDocumentPosition(note) & 4) !== 0),
      rows: host.querySelectorAll('.card.trow').length,
      intention: firstRow ? (firstRow.querySelector('.intention-text') || {}).textContent || null : null };
  })()`);
  ok(bp.barTitle === "Morning" && bp.barDisc && bp.barMenu && !bp.head && !bp.headName && !bp.cover && !bp.pillrow
    && bp.firstCls === "blockpage-meta" && bp.metaText && bp.metaText.includes("Morning prayers") && bp.metaText.includes("3 episodes") && bp.metaText.includes("12min")
    && bp.spanInMeta && bp.rows === 3,
    "B1 D1: the bar names the block once (Play All + the menu act stand); NO series head, NO name line, NO cover tile, NO pillrow stands; the body's first line is the plain meta line (Morning prayers · 3 episodes · 12min, settled in its data-bmeta span); the 3 track rows follow", JSON.stringify(bp));
  ok(bp.dlCls === "blockpage-dlact" && bp.dlText === "Download all" && bp.dlNoteOrder && bp.intention && bp.intention.includes("For the intentions of the family"),
    "B1 D1: the download stands as a plain text-act line (no chipbtn dress) with its note line under it; the track rows stand as they are (the written intention line inside the first row)", JSON.stringify({ dlCls: bp.dlCls, dlText: bp.dlText, intention: bp.intention }));

  /* ---- D1: the download tap runs the download ----
     The arrangement mirrors production's shape: the block's
     tracks stand as own items in the offline enumeration
     (state.ownStanding / state.ownSlots, fed by the source
     settings the fixture leaves empty), so blockDownloadAll
     has its standing set to fetch through the feed-audio
     pass-through the stub serves. */
  await ev(`(function(){
    state.ownStanding = [{ sourceKey: 'morning-own', block: 'Morning' }];
    state.ownSlots = { 'morning-own': { state: 'present', tracks: [9000, 9001, 9002].map(function (id) { return { episodeId: String(id), enclosureUrl: location.origin + '/audio/' + id + '.wav' }; }) } };
  })()`);
  await page.click('#sidehost [data-blockdl="Morning"]');
  await page.waitForFunction(`(document.querySelector('[data-blockdlnote="Morning"]') || {}).textContent && document.querySelector('[data-blockdlnote="Morning"]').textContent.includes('Downloaded')`, null, { timeout: 12000 }).catch(() => {});
  const dlAfter = await ev(`(function(){
    var dl = document.querySelector('[data-blockdl="Morning"]'), note = document.querySelector('[data-blockdlnote="Morning"]');
    return { text: dl ? dl.textContent.trim() : null, disabled: dl ? dl.disabled : null, note: note ? note.textContent.trim() : null };
  })()`);
  ok(dlAfter.note && dlAfter.note.includes("Downloaded") && dlAfter.note.includes("remove in Settings") && dlAfter.text === "On this device" && dlAfter.disabled === true,
    "B2 D1: the download tap runs the download — the note line updates as today (Downloaded · remove in Settings) and the act reads On this device, disabled", JSON.stringify(dlAfter));

  /* ---- D3: the menu — standing items first, then the Go to group ---- */
  await openMenu();
  const rows1 = await menuRows();
  ok(JSON.stringify(rows1.map(function (r) { return r.label; })) === JSON.stringify(["Sort", "Mark all played", "Share", "Open in Spotify", "Morning", "Midday", "Evening", "Intentions"])
    && rows1[4].state === "Here" && rows1[1].mark === "Morning" && rows1.slice(4).every(function (r) { return r.mark === null; }),
    "B3 D3: the menu lists the standing items first in their order, then one Go to item per block in day order, then Intentions; the standing block's item carries the 'Here' state; the [data-menuitem=\"1\"] Mark-all wiring lands on the Mark-all row (data-markblock stands there, on no Go to row) — the append-position proof", JSON.stringify(rows1));
  await ev(`document.querySelector('.anchmenu [data-menuitem="4"]').click()`);
  await sleep(250);
  const hereTap = await ev(`(function(){ return { menu: !!document.querySelector('.anchmenu'), barTitle: document.querySelector('#pushbar .iosbar-title').textContent }; })()`);
  ok(!hereTap.menu && hereTap.barTitle === "Morning",
    "B3 D3: a tap on the 'Here' item only closes the menu — the page stands on Morning", JSON.stringify(hereTap));

  /* ---- D3: the Mark-all act still marks the block ---- */
  await openMenu();
  await ev(`document.querySelector('.anchmenu [data-menuitem="1"]').click()`);
  await sleep(300);
  await openMenu();
  const rows2 = await menuRows();
  ok(rows2[1].label === "Mark all unplayed",
    "B4 D3: the Mark-all row's act marks the block — at the next open its label reads Mark all unplayed (the wiring bound the standing act, not a Go to item)", JSON.stringify(rows2.map(function (r) { return r.label; })));
  await ev(`(document.querySelector('.menucatcher') || document.body).click()`); await sleep(200);

  /* ---- D3: a Go to tap opens that block ---- */
  await openMenu();
  await ev(`document.querySelector('.anchmenu [data-menuitem="5"]').click()`);
  await page.waitForFunction(`(document.querySelector('#pushbar .iosbar-title') || {}).textContent === 'Midday'`, null, { timeout: 5000 }).catch(() => {});
  const mid = await ev(`(function(){
    var host = document.getElementById('sidehost');
    var meta = host.querySelector('.blockpage-meta');
    return { title: document.querySelector('#pushbar .iosbar-title').textContent,
      metaText: meta ? meta.textContent.trim() : null, head: !!host.querySelector('.podpage-head'),
      rows: host.querySelectorAll('.card.trow').length };
  })()`);
  ok(mid.title === "Midday" && mid.metaText && mid.metaText.includes("2 episodes") && !mid.head && mid.rows === 2,
    "B5 D3: a tap on Midday's Go to item closes the menu and opens the Midday page (its plain meta line, 2 episodes, its 2 rows, no head)", JSON.stringify(mid));

  /* ---- D3: the Intentions item flips the side ---- */
  await openMenu();
  const rows3 = await menuRows();
  await ev(`document.querySelector('.anchmenu [data-menuitem="6"]').click()`);
  await page.waitForFunction(`(document.querySelector('#sidetoggle [data-side="intentions"]') || {}).className === 'active'`, null, { timeout: 5000 }).catch(() => {});
  await sleep(500);
  const flip = await ev(`(function(){
    var host = document.getElementById('sidehost');
    return { active: (document.querySelector('#sidetoggle [data-side="intentions"]') || {}).className,
      bar: !!document.querySelector('#pushbar .iosbar'),
      paints: host ? (host.textContent || '').includes('Intentions') : false };
  })()`);
  ok(JSON.stringify(rows3.map(function (r) { return r.label; })) === JSON.stringify(["Sort", "Mark all played", "Share", "Morning", "Midday", "Evening", "Intentions"])
    && rows3[4].state === "Here" && rows3[3].state === null
    && flip.active === "active" && !flip.bar && flip.paints,
    "B6 D3: on Midday's page the Go to group stands in the same day order with Midday's item marked 'Here'; a tap on Intentions flips the Prayers side — the toggle's Intentions segment stands active, the Intentions side paints, the bar clears", JSON.stringify({ rows: rows3, flip }));
  await ev(`document.querySelector('#sidetoggle [data-side="prayers"]').click()`);
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });

  /* ---- regression: the episodes page stands as today ---- */
  await ev(`document.querySelector('[data-openblock="__episodes"]').click()`);
  await page.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  const eps = await ev(`(function(){
    var meta = document.querySelector('#sidehost .blockpage-meta');
    return { title: document.querySelector('#pushbar .iosbar-title').textContent,
      metaText: meta ? meta.textContent.trim() : null,
      head: !!document.querySelector('#sidehost .podpage-head'),
      menu: !!document.querySelector('#pushbar [data-blockmenu]'),
      playrow: !!document.querySelector('#sidehost .blockpage-playrow [data-queue="__episodes"]') };
  })()`);
  ok(eps.title === "From Today’s Podcast" && eps.metaText && eps.metaText.includes("1 episodes") && eps.metaText.includes("5min") && !eps.head && !eps.menu && eps.playrow,
    "R1 regression: the episodes page stands as today — the bar, the plain meta line, the Play All body row; no series head and NO menu (it is not a block and stands outside the Go to list)", JSON.stringify(eps));
  await page.click("#pushbar .iosbar-back");
  await page.waitForSelector('[data-openblock="__episodes"]', { timeout: 5000 });

  /* ---- regression: the Formation series page keeps its head ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 5000 });
  await ev(`document.querySelector('[data-podseries="bible"]').click()`);
  await page.waitForSelector(".podpage-head", { timeout: 5000 });
  const fhead = await ev(`(function(){ var m = document.querySelector('.podpage-head .meta'); return m ? m.textContent.trim() : null; })()`);
  ok(!!fhead && fhead.includes("0 of 2 listened"),
    "R2 regression: the Formation series page still paints its .podpage-head (its meta line: 0 of 2 listened) — D1 retires the block page's use of the shared class only", String(fhead));
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 5000 });

  /* ---- 360px geometry ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  page2.on("pageerror", (e) => pageErrors.push("360: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(300);
  await page2.evaluate(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page2.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  const geo = await page2.evaluate(`(function(){
    var host = document.getElementById('sidehost');
    var meta = host.querySelector('.blockpage-meta');
    return { scrollW: document.documentElement.scrollWidth, head: !!host.querySelector('.podpage-head'),
      meta: meta ? meta.textContent.trim() : null };
  })()`);
  ok(geo.scrollW <= 362 && !geo.head && geo.meta && geo.meta.includes("Morning prayers") && geo.meta.includes("3 episodes"),
    "G360 block page at 360px: no series head; the plain meta line stands (Morning prayers · 3 episodes); no new horizontal overflow (362 is the base's own standing measure)", JSON.stringify(geo));

  ok(pageErrors.length === 0, "browser: zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v455: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
