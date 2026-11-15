#!/usr/bin/env node
// harness-v451 — Move The AI Signal to Formation, AS AN ENTRY
// (John, Ora thread, 2026-11-15 15:19 CT: "Let's move ai
// signal to formation"; correction 16:09 CT: "No. Ai signal
// goes into formation" + "As an entry"; correction-2 16:11 CT:
// "It should look just like anything else"). Measured:
// (1) the registry entry — index.ts carries a third series
// kind (POD_OWN_SERIES_LIST + podOwnIndexEntry/podOwnPayload
// from player_episodes, kind 'own', showImageUrl '/logo.png'
// on both wire forms), appended LAST in podIndexPayload after
// the video loop and routed before the audio def lookup; the
// production hand-off route stands byte-untouched; (2) the
// day lets go — 'The AI Signal' leaves PRAYER_BLOCKS and the
// day build's aiRow fill retires, so the day payload carries
// no block for the show; (3) the Prayers side lets go — the
// shell claim machinery (claimAiSignalShell / resolveAiSignal)
// retires, no home row stands, no block page opens, the
// whole-day queue carries no AI track; the Settings census:
// 'The AI Signal' STANDS in SET_BLOCKS / SET_SECTIONS (its own
// row stands assigned to it; retiring the name would strand
// the row and break every Settings save); (4) the Formation
// paints read the entry — the index reads five entries in
// registry order with the own entry last, its card painted
// EXACTLY like every other (the show image as artwork through
// the standing art line, the standing meta form; NO glyph
// tile special-case anywhere), its tap FETCHES the series
// payload through the standing route (no client special
// case), and its page stands in the standing series grammar
// (bar · .podpage-head with the show image · episode rows
// newest-first in the standing row dress, form-identical,
// carrying NO written intention line); today's row plays
// through the standing local-copy swap seat (the v430 mint,
// read at tap time) and a past row streams its own date's
// audio route; (5) the unavailable + disabled forms — no
// present rows paints the standing unavailable card; the
// server-gated index (no own entry) paints no card. Mold:
// harness-v439/v449's whole-client boot (the real SHELL_HTML
// + APP_CSS + the whole COOKED APP_JS, fetch stubbed by path
// with registry payloads in the NEW wire form). The live
// server read stands at Ship (the Plan's named split): the
// harness proves the client against the wire form and the
// server builders by their statics; the Review reads the
// server diff firsthand.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v451 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v450-ship";
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
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/index.ts"]),
    "S1 the worker-source diff vs the v450-ship base is index.ts + client.ts only — no ui.ts, no migration (got: " + changed.join(", ") + ")");
  ok(INDEX.includes("const POD_OWN_SERIES_LIST") && INDEX.includes('key: "the-ai-signal", title: "The AI Signal"')
    && INDEX.includes("async function podOwnPayload(") && INDEX.includes("async function podOwnIndexEntry(")
    && INDEX.includes('kind: "own"') && INDEX.includes("function podOwnSeriesDef("),
    "S2 the own series kind stands in index.ts — its def list (key 'the-ai-signal'), its two builders, its def lookup, the kind 'own' wire field");
  const ownSection = INDEX.slice(INDEX.indexOf("Podcasts OWN series (v451)"));
  ok((ownSection.match(/showImageUrl: "\/logo.png"/g) || []).length >= 2
    && ownSection.includes("FROM player_episodes WHERE episode_id='the-ai-signal' AND audio_state='present' ORDER BY date DESC")
    && ownSection.includes("streamUrl: `/api/player/audio/${r.date}/the-ai-signal`"),
    "S2 both own wire forms carry showImageUrl '/logo.png'; the catalog read is the standing store read (present rows, newest first) and each entry's streamUrl is its own date's audio route");
  const idxBody = extractFn(INDEX, "podIndexPayload");
  ok(idxBody.indexOf("podVideoIndexEntry") > -1 && idxBody.indexOf("podOwnIndexEntry") > idxBody.indexOf("podVideoIndexEntry")
    && idxBody.includes('s.sourceKey === "the-ai-signal"') && idxBody.includes("ownRow.enabled === 1"),
    "S2 podIndexPayload appends the own entry AFTER the video loop (the seat: last), gated on the settings row's enabled flag read server-side");
  const routeAt = INDEX.indexOf('const readOwnDef = podOwnSeriesDef(readSeries);');
  ok(routeAt > -1 && routeAt < INDEX.indexOf('const readDef = podSeriesDef(readSeries);', routeAt - 2000)
    && INDEX.includes('if (readOwnDef) return json(await podOwnPayload(env, readOwnDef));'),
    "S2 the podcasts GET routes 'the-ai-signal' to podOwnPayload BEFORE the audio def lookup (the v434 seat); the unknown-key 400 stands below it");
  const blocksLine = INDEX.slice(INDEX.indexOf("const PRAYER_BLOCKS"), INDEX.indexOf(";", INDEX.indexOf("const PRAYER_BLOCKS")));
  const dayBuild = extractFn(INDEX, "playerDayPayload");
  ok(!blocksLine.includes("The AI Signal") && !dayBuild.includes("player_episodes") && !dayBuild.includes("aiRow")
    && !INDEX.includes('"The AI Signal": "the day\'s episode"') && !INDEX.includes('"The AI Signal": 24'),
    "S3 the day lets go: 'The AI Signal' stands in neither PRAYER_BLOCKS nor BLOCK_CAPTION nor PRAYER_BLOCK_START, and the day build reads no player_episodes row (no aiRow fill)");
  ok(INDEX.includes('episode id must be the-ai-signal') && INDEX.includes("VALUES (?, 'the-ai-signal', ?, 'The AI Signal', 1, ?, ?, ?, 'present', ?)")
    && INDEX.includes('(key === "the-ai-signal" && s.block === "The AI Signal")'),
    "S3 the production hand-off route stands byte-untouched (its plant + validation), and the source-settings PUT accepts the own row's standing block value for its own row only");
  ok(!CLIENT.includes("function claimAiSignalShell(") && !CLIENT.includes("function resolveAiSignal(")
    && !CLIENT.includes("claimAiSignalShell(day)") && !CLIENT.includes("resolveAiSignal(day")
    && CLIENT.includes("var SET_BLOCKS = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Mass and Homilies', 'Novenas', 'The AI Signal']")
    && CLIENT.includes("function paintPodOwnSeries(") && CLIENT.includes("function podOwnDesc("),
    "S4 the client census: the shell claim machinery is retired whole (no definition, no call); 'The AI Signal' STANDS in SET_BLOCKS (its own row's assignment — the census outcome); the own painter + descriptor builder stand");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v451-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S5 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v450-1";'),
    "S5 (housekeeping): the SW pin stands at ora-pro-nobis-v450-1 (Ship moves it)");
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "S5 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
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
  ok(census === 0, "S5 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);
}


const wavBuf = (secs) => {
  const sr = 8000, dataSize = sr * secs * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  return buf;
};
const WAV = wavBuf(300);
const WAV_SHORT = wavBuf(2);

/* ---------------- fixtures (the NEW wire form) ---------------- */
const tracks = (base, count, label) => Array.from({ length: count }, (_, i) => ({ episodeId: String(base + i), title: label + " track " + (i + 1), durationS: 240, available: true, streamUrl: "__ORIGIN__/audio/" + (base + i) + ".wav" }));
const DAY = {
  ok: true, date: "2026-11-15", presentedDay: "2026-11-15", dateLabel: "Sunday, November 15, 2026",
  liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" },
  introTexts: { "9000": "For the intentions of the family", "the-ai-signal": "For the work of this day" },
  blocks: [
    { block: "Morning", label: "Morning", caption: "", tracks: tracks(9000, 3, "Morning") },
    { block: "Novenas", label: "Novenas", caption: "Parish novena", tracks: tracks(9500, 1, "Novenas") },
  ],
  episodes: [{ episodeId: "9901", title: "Podcast Episode One", durationS: 300, available: true, streamUrl: "__ORIGIN__/audio/9901.wav" }],
};
const AUDIO_ENTRY = (series, title, label, img) => ({ series, title, available: true, listenedCount: 3, total: 369, currentKey: series + ":cur", currentLabel: label, showImageUrl: img, showDesc: null });
const OWN_INDEX = { kind: "own", series: "the-ai-signal", title: "The AI Signal", available: true, currentKey: "the-ai-signal-2026-11-15", currentLabel: "Signals for Sunday", showImageUrl: "/logo.png" };
const INDEX5 = { seriesList: [
  AUDIO_ENTRY("catechism-in-a-year", "Catechism in a Year", "Day 4", "https://img.example/ciy-show.jpg"),
  AUDIO_ENTRY("bible-in-a-year", "Bible in a Year", "Day 316", "https://img.example/biy-show.jpg"),
  AUDIO_ENTRY("rosary-in-a-year", "The Rosary in a Year", "Day 1", "https://img.example/riy-show.jpg"),
  { kind: "video", series: "catholictv", title: "CatholicTV", available: true, latestLabel: "Nov 15, 2026", showImageUrl: "https://i.ytimg.com/vi/vid1/hqdefault.jpg" },
  OWN_INDEX,
] };
const INDEX4 = { seriesList: INDEX5.seriesList.slice(0, 4) };
const WAV_SHORT_LEN = WAV_SHORT.length;
const OWN = { ok: true, series: "the-ai-signal", kind: "own", title: "The AI Signal", available: true,
  currentKey: "the-ai-signal-2026-11-15", currentLabel: "Signals for Sunday", showImageUrl: "/logo.png", showDesc: null,
  entries: [
    { key: "the-ai-signal-2026-11-15", date: "2026-11-15", label: "Nov 15, 2026", title: "Signals for Sunday", streamUrl: "/api/player/audio/2026-11-15/the-ai-signal", durationS: 600, sizeBytes: WAV_SHORT_LEN },
    { key: "the-ai-signal-2026-11-14", date: "2026-11-14", label: "Nov 14, 2026", title: "Signals for Saturday", streamUrl: "/api/player/audio/2026-11-14/the-ai-signal", durationS: 540, sizeBytes: 90000 },
    { key: "the-ai-signal-2026-11-13", date: "2026-11-13", label: "Nov 13, 2026", title: "Signals for Friday", streamUrl: "/api/player/audio/2026-11-13/the-ai-signal", durationS: 480, sizeBytes: 80000 },
  ] };
const OWN_UNAVAIL = { ok: true, series: "the-ai-signal", kind: "own", title: "The AI Signal", available: false,
  currentKey: null, currentLabel: null, showImageUrl: "/logo.png", showDesc: null, entries: [] };
const INDEX_UNAVAIL = { seriesList: INDEX5.seriesList.slice(0, 4).concat([{ kind: "own", series: "the-ai-signal", title: "The AI Signal", available: false, currentKey: null, currentLabel: null, showImageUrl: "/logo.png" }]) };
const SERIES = { series: "bible-in-a-year", kind: "audio", title: "Bible in a Year", available: true, showDesc: "", showImageUrl: null,
  listenedCount: 0, total: 2, currentKey: "d1",
  entries: [
    { key: "d1", label: "Day 1", title: "Genesis", durationS: 60, listened: false, url: "https://example.com/d1.mp3", imageUrl: null, descText: null },
    { key: "d2", label: "Day 2", title: "Exodus", durationS: 60, listened: true, listenDate: "2026-11-14", url: "https://example.com/d2.mp3", imageUrl: null, descText: null },
  ] };
const VIDEO = { series: "catholictv", kind: "video", title: "CatholicTV", available: true,
  videos: [{ id: "vid1", title: "Daily Mass for Monday", dateLabel: "Nov 15, 2026", imageUrl: "", url: "https://www.youtube.com/watch?v=vid1" }] };

const TPL_A2 = CLIENT.indexOf("APP_JS = `") + 10;
const COOKED = new Function("return `" + CLIENT.slice(TPL_A2, CLIENT.indexOf("`;", TPL_A2)) + "`")();
function makePage(fix) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
var FIX = ${JSON.stringify(fix)};
window.fetch = function (path, opts) {
  var p = String(path);
  window.__fetchLog.push(p);
  var J = function (obj) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(obj))); } }); };
  if (p.indexOf('/api/player/day') === 0) return J(FIX.DAY);
  if (p === '/api/player/podcasts') return J(FIX.INDEX);
  if (p.indexOf('/api/player/podcasts?series=the-ai-signal') === 0) return J(FIX.OWN);
  if (p.indexOf('/api/player/podcasts?series=bible-in-a-year') === 0) return J(FIX.SERIES);
  if (p.indexOf('/api/player/podcasts?series=catholictv') === 0) return J(FIX.VIDEO);
  if (p.indexOf('/api/player/source-settings') === 0) return J({ sources: [], version: 3 });
  if (p.indexOf('/api/pin/state') === 0) return J({ pinSet: true, retryAfterSeconds: 0 });
  if (p.indexOf('/api/player/feed-audio') === 0) return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  return J({ ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
</` + `script>
<script>
${COOKED}
</` + `script>
</body></html>`;
}

const PAGES = {
  "/": makePage({ DAY, INDEX: INDEX5, SERIES, VIDEO, OWN }),
  "/u": makePage({ DAY, INDEX: INDEX_UNAVAIL, SERIES, VIDEO, OWN: OWN_UNAVAIL }),
  "/d": makePage({ DAY, INDEX: INDEX4, SERIES, VIDEO, OWN }),
};
let pageHtml = "";
const server = http.createServer((req, res) => {
  const p = (req.url || "/").split("?")[0];
  if (PAGES[p]) { res.setHeader("Content-Type", "text/html"); res.end(PAGES[p].split("__ORIGIN__").join(pageHtml)); return; }
  if (p === "/logo.png") { res.setHeader("Content-Type", "image/png"); res.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64")); return; }
  if (p.indexOf("/audio/") === 0 || p.indexOf("/api/player/audio/") === 0) { res.setHeader("Content-Type", "audio/wav"); res.end(WAV); return; }
  res.statusCode = 404; res.end("not found");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;
pageHtml = ORIGIN;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  const ev = (fn) => page.evaluate(fn);
  const text = (sel) => ev(`(function(){ var el = document.querySelector(${JSON.stringify(sel)}); return el ? el.textContent.trim() : null; })()`);
  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(600);

  /* ---- Prayers legs: the show stands nowhere on the Prayers side ---- */
  const home = await ev(`(function(){
    var els = Array.prototype.slice.call(document.querySelectorAll('#home-body [data-openblock]'));
    return { keys: els.map(function (e) { return e.getAttribute('data-openblock'); }),
      bodyText: (document.getElementById('home-body') || {}).textContent || '',
      payloadBlocks: (state.dayPayload && state.dayPayload.blocks || []).map(function (b) { return b.block; }) };
  })()`);
  ok(JSON.stringify(home.keys) === JSON.stringify(["Morning", "Novenas", "__episodes"]) && !home.payloadBlocks.includes("The AI Signal")
    && !home.bodyText.includes("Signals for Sunday") && !home.bodyText.includes("For the work of this day"),
    "P1 Prayers home from a block-less day payload: the standing rows only (Morning · Novenas · episodes) — no AI Signal row, no show title, no AI intention text anywhere on the side", JSON.stringify({ keys: home.keys, payloadBlocks: home.payloadBlocks }));
  await ev(`document.getElementById('play-all').click()`);
  await page.waitForFunction(`(document.getElementById('dock-title') || {}).textContent && document.getElementById('dock-title').textContent.includes('Morning track 1')`, null, { timeout: 6000 }).catch(() => {});
  const queue = await ev(`(function(){
    var ids = (state.queue || []).map(function (d) { return d.episodeId; });
    if (state.current) ids.unshift(state.current.episodeId);
    return { ids: ids, dock: (document.getElementById('dock-title') || {}).textContent || '' };
  })()`);
  ok(queue.dock.includes("Morning track 1") && queue.ids.length > 0 && queue.ids.every(function (id) { return String(id).indexOf('ai-signal') < 0; }),
    "P2 the whole-day Play All plays the day and its queue carries NO AI Signal track (the episode left the queue with the block)", JSON.stringify(queue));
  await page.click("#dock-play");
  await sleep(300);

  /* ---- seed today's device-local copy (the swap's standing fact) ---- */
  await sleep(2000); // the boot's offline pass settles first
  await page.evaluate((bytes) => caches.open('opn-ext-audio-v1').then(function (c) { return c.put('day/2026-11-15/the-ai-signal', new Response(new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }))); }), Array.from(WAV_SHORT));
  await sleep(300);

  /* ---- Formation index: five entries, the own entry last, painted like any other ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="the-ai-signal"]', { timeout: 6000 });
  const idx = await ev(`(function(){
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-podseries]'));
    var own = document.querySelector('[data-podseries="the-ai-signal"]');
    var img = own ? own.querySelector('img.rowart') : null;
    return { keys: cards.map(function (c) { return c.getAttribute('data-podseries'); }),
      ownCls: own ? own.className : null,
      ownImg: img ? img.getAttribute('src') : null,
      ownText: own ? own.textContent : '',
      fetches: window.__fetchLog.filter(function (p) { return p.indexOf('series=the-ai-signal') > -1; }).length };
  })()`);
  ok(JSON.stringify(idx.keys) === JSON.stringify(["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year", "catholictv", "the-ai-signal"]),
    "F1 the Formation index reads five entries in registry order — Catechism · Bible · Rosary · CatholicTV · The AI Signal, the own entry LAST", JSON.stringify(idx.keys));
  ok(idx.ownCls === "card" && idx.ownImg === "/logo.png" && idx.ownText.includes("Current: Signals for Sunday")
    && !idx.ownText.includes("\u26a1") && !idx.ownText.includes("listened"),
    "F2 the own card is painted EXACTLY like every other — the plain .card form, its artwork an <img> of the show image ('/logo.png') through the standing art line, its meta the standing Current form naming today's episode; NO bolt glyph, NO counts", JSON.stringify({ cls: idx.ownCls, img: idx.ownImg, text: idx.ownText.slice(0, 120) }));

  /* ---- the series page: fetched through the standing route, standing grammar ---- */
  await ev(`document.querySelector('[data-podseries="the-ai-signal"]').click()`);
  await page.waitForSelector('[data-podrow="the-ai-signal-2026-11-15"]', { timeout: 6000 });
  await page.waitForFunction(`!!(window.ownBlobOwners && ownBlobOwners['day/2026-11-15/the-ai-signal'] && ownBlobOwners['day/2026-11-15/the-ai-signal'].blobUrl)`, null, { timeout: 6000 }).catch(() => {});
  const pg = await ev(`(function(){
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-podrow]'));
    var head = document.querySelector('.podpage-head');
    var cover = head ? head.querySelector('img.coverimg') : null;
    return { fetches: window.__fetchLog.filter(function (p) { return p.indexOf('series=the-ai-signal') > -1; }).length,
      barTitle: (document.querySelector('.iosbar-title') || {}).textContent || null,
      barName: (document.querySelector('.iosbar-name') || {}).textContent || null,
      cover: cover ? cover.getAttribute('src') : null,
      headMeta: head ? head.querySelector('.meta').textContent.trim() : null,
      keys: rows.map(function (r) { return r.getAttribute('data-podrow'); }),
      forms: rows.map(function (r) { return r.className; }),
      clusters: rows.map(function (r) { return { play: !!r.querySelector('[data-ownplay]'), mark: !!r.querySelector('[data-podmark]'), menu: !!r.querySelector('[data-podmenu]') }; }),
      metas: rows.map(function (r) { return (r.querySelector('.meta') || {}).textContent.trim(); }),
      art: rows.map(function (r) { var i = r.querySelector('img.rowart'); return i ? i.getAttribute('src') : null; }),
      pageText: (document.getElementById('view') || document.body).textContent || '' };
  })()`);
  ok(pg.fetches > idx.fetches,
    "F3 the tap FETCHED the series payload through the standing route (/api/player/podcasts?series=the-ai-signal — the fetch count rose from " + idx.fetches + " to " + pg.fetches + "); no client special case stands");
  ok(pg.barTitle === "The AI Signal" && pg.barName === "Formation" && pg.cover === "/logo.png"
    && pg.headMeta && pg.headMeta.includes("3 episodes") && pg.headMeta.includes("Current: Signals for Sunday"),
    "F4 the series page stands in the standing grammar — the bar (‹ Formation · The AI Signal), the .podpage-head whose cover is the show image ('/logo.png') like every other series page, the meta line (3 episodes · the current episode named)", JSON.stringify({ barTitle: pg.barTitle, barName: pg.barName, cover: pg.cover, headMeta: pg.headMeta }));
  ok(JSON.stringify(pg.keys) === JSON.stringify(["the-ai-signal-2026-11-15", "the-ai-signal-2026-11-14", "the-ai-signal-2026-11-13"])
    && pg.forms.every(function (c) { return c === "card trow prow"; })
    && pg.clusters.every(function (c) { return c.play && !c.mark && !c.menu; })
    && pg.art.every(function (a) { return a === "/logo.png"; }),
    "F5 the rows stand newest-first in the standing episode-row dress — every row form-identical (.card.trow.prow, one play disc in the cluster, no mark, no menu — the kind carries none), every row's art the show image", JSON.stringify({ keys: pg.keys, forms: pg.forms, clusters: pg.clusters, art: pg.art }));
  ok(pg.metas[0].indexOf("Current episode \u00b7 Nov 15, 2026") === 0 && pg.metas[0].includes("10:00") && pg.metas[1].indexOf("Nov 14, 2026") === 0
    && !pg.pageText.includes("For the work of this day") && !pg.pageText.includes("Prayer Intention:"),
    "F6 the rows' meta lines: today's leads 'Current episode · Nov 15, 2026 · 10:00', a past row reads its own date — and NO row carries a written intention line (the day payload's AI intention text stands nowhere on the page)", JSON.stringify({ metas: pg.metas }));

  /* ---- today's row plays through the swap seat; a past row streams its own route ---- */
  await ev(`document.querySelector('[data-ownplay="the-ai-signal-2026-11-15"]').click()`);
  await sleep(600);
  const playToday = await ev(`({ cur: state.current ? state.current.episodeId : null, curUrl: state.current ? state.current.url : null, src: audioEl.src || '', dock: (document.getElementById('dock-title') || {}).textContent || '' })`);
  ok(playToday.cur === "the-ai-signal-2026-11-15" && playToday.curUrl && playToday.curUrl.indexOf("blob:") === 0 && playToday.src.indexOf("blob:") === 0
    && playToday.dock.includes("Signals for Sunday"),
    "F7 today's row plays through the standing swap seat — the descriptor built from the entry takes the device-local copy (its url and the element's src are the mint), the dock names the episode", JSON.stringify(playToday));
  await page.click("#dock-play");
  await sleep(300);
  await ev(`document.querySelector('[data-ownplay="the-ai-signal-2026-11-14"]').click()`);
  await sleep(600);
  const playPast = await ev(`({ cur: state.current ? state.current.episodeId : null, src: audioEl.src || '', dock: (document.getElementById('dock-title') || {}).textContent || '' })`);
  ok(playPast.cur === "the-ai-signal-2026-11-14" && playPast.src.includes("/api/player/audio/2026-11-14/the-ai-signal") && playPast.dock.includes("Signals for Saturday"),
    "F8 a past row streams its OWN date's audio route (no swap — the swap seat is today's alone)", JSON.stringify(playPast));
  await page.click("#dock-play");
  await sleep(300);
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-podseries="the-ai-signal"]', { timeout: 6000 });
  ok(await ev(`!!document.querySelector('[data-podseries="the-ai-signal"]')`),
    "F9 back returns to the index with the own entry standing");

  /* ---- the standing series stand as shipped (regression) ---- */
  await ev(`document.querySelector('[data-podseries="bible-in-a-year"]').click()`);
  await page.waitForSelector(".podpage-head", { timeout: 6000 });
  ok(((await text(".podpage-head .meta")) || "").includes("0 of 2 listened"),
    "F10 the audio series page stands as shipped (its head meta: 0 of 2 listened) — the registry's standing members are untouched by the new kind");
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-podseries="catholictv"]', { timeout: 6000 });
  await ev(`document.querySelector('[data-podseries="catholictv"]').click()`);
  await page.waitForSelector('[data-podvideo="vid1"]', { timeout: 6000 });
  ok(await ev(`!!document.querySelector('[data-podvideo="vid1"]')`),
    "F11 the video series page stands as shipped (its watch rows paint) — the dispatch by kind holds for every kind");
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-podseries="the-ai-signal"]', { timeout: 6000 });

  /* ---- unavailable: no present rows ---- */
  const pageU = await browser.newPage({ viewport: { width: 412, height: 915 } });
  pageU.on("pageerror", (e) => pageErrors.push("unavail: " + String(e)));
  await pageU.goto(ORIGIN + "/u");
  await pageU.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await pageU.click('#tabbar [data-tab="podcasts"]');
  await pageU.waitForSelector('[data-podseries="the-ai-signal"]', { timeout: 6000 });
  const unav = await pageU.evaluate(`(function(){
    var own = document.querySelector('[data-podseries="the-ai-signal"]');
    return { meta: own ? (own.querySelector('.meta') || {}).textContent.trim() : null };
  })()`);
  ok(!!unav.meta && unav.meta.includes("unavailable right now"),
    "U1 with no present rows the own card stands with the standing unavailable line, like every unavailable series", JSON.stringify(unav));
  await pageU.evaluate(`document.querySelector('[data-podseries="the-ai-signal"]').click()`);
  await pageU.waitForFunction(`(document.getElementById('view') || document.body).textContent.includes('unavailable right now')`, null, { timeout: 6000 }).catch(() => {});
  const unavPage = await pageU.evaluate(`(function(){
    return { rows: document.querySelectorAll('[data-podrow]').length,
      card: !!Array.prototype.slice.call(document.querySelectorAll('.card')).filter(function (c) { return c.textContent.includes('unavailable right now'); }).length };
  })()`);
  ok(unavPage.card && unavPage.rows === 0,
    "U2 the unavailable series page paints the standing unavailable card and no episode rows", JSON.stringify(unavPage));

  /* ---- disabled: the server gate's wire result — no entry, no card ---- */
  const pageD = await browser.newPage({ viewport: { width: 412, height: 915 } });
  pageD.on("pageerror", (e) => pageErrors.push("disabled: " + String(e)));
  await pageD.goto(ORIGIN + "/d");
  await pageD.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await pageD.click('#tabbar [data-tab="podcasts"]');
  await pageD.waitForSelector('[data-podseries="catholictv"]', { timeout: 6000 });
  await sleep(400);
  const dis = await pageD.evaluate(`(function(){
    return { cards: document.querySelectorAll('[data-podseries]').length, own: !!document.querySelector('[data-podseries="the-ai-signal"]') };
  })()`);
  ok(dis.cards === 4 && !dis.own,
    "D1 the disabled-source index (the server gate's wire result: the payload carries no own entry) paints the four standing cards and NO AI Signal card", JSON.stringify(dis));

  /* ---- 360px geometry: the own page at the narrow width ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  page2.on("pageerror", (e) => pageErrors.push("360: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await page2.click('#tabbar [data-tab="podcasts"]');
  await page2.waitForSelector('[data-podseries="the-ai-signal"]', { timeout: 6000 });
  await page2.evaluate(`document.querySelector('[data-podseries="the-ai-signal"]').click()`);
  await page2.waitForSelector('[data-podrow="the-ai-signal-2026-11-15"]', { timeout: 6000 });
  const geo = await page2.evaluate(`(function(){
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-podrow]'));
    return { scrollW: document.documentElement.scrollWidth, rows: rows.length,
      first: rows.length ? Math.round(rows[0].getBoundingClientRect().width) : 0 };
  })()`);
  ok(geo.scrollW <= 362 && geo.rows === 3 && geo.first >= 300,
    "G360 the own series page at 360px: its three rows stand, no new horizontal overflow (362 is the base's own standing measure)", JSON.stringify(geo));

  ok(pageErrors.length === 0, "browser: zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v451: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
