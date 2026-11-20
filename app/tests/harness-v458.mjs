#!/usr/bin/env node
// harness-v458 — Block page body lines: one row, no
// Settings comment (John's directive 2026-11-15 20:10 CT
// on the LIVE v455 Morning block page: "This can be one
// row. Get rid of settings comment and streamline.";
// Scope+Plan records 1765/1766). Measured: (1) the block
// page's three stacked body elements — the .blockpage-meta
// line, the [data-blockdl] act line, the note line —
// collapse into ONE ROW: the meta div is the row, carrying
// a .blockpage-metatext span (the caption + the data-bmeta
// span inside it, so updateBlockCounts' settlement still
// lands) and the act at its trailing end, its tap flow and
// states unchanged; (2) the note line retires whole — its
// emission AND its settlement sweep in refreshGridDlStates
// — so "Downloaded · remove in Settings" leaves the bundle
// (census 0) and no Settings pointer stands on the page in
// either download state; (3) the episodes page stands
// outside the change (its meta line text-only, no act).
// harness-v455's three-line legs are premise-superseded by
// this release and are not gates here. Mold:
// harness-v457/v455's whole-client boot (the real
// SHELL_HTML + APP_CSS + the whole COOKED APP_JS, fetch
// stubbed by path) driven through the real UI.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v458 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v454-ship";
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
    "ST1 the worker-source diff vs the v454-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
  const bp = extractFn(CLIENT, "paintBlockPage");
  ok((bp.split('class="blockpage-meta"').length - 1) === 1
    && bp.includes('class="blockpage-meta"><span class="blockpage-metatext">')
    && bp.indexOf('blockpage-metatext') < bp.indexOf('<span data-bmeta="')
    && bp.indexOf('<span data-bmeta="') < bp.indexOf('class="blockpage-dlact" data-blockdl="')
    && bp.includes('">Download all</button></div>')
    && !bp.includes("blockpage-dlnote") && !bp.includes("data-blockdlnote"),
    "ST2 paintBlockPage emits exactly ONE body-line element before the rows: the .blockpage-meta row carrying the .blockpage-metatext span (the data-bmeta span inside it) and the [data-blockdl] act inside the same div; no note emission stands");
  ok(!CLIENT.includes("data-blockdlnote") && !CLIENT.includes("remove in Settings"),
    "ST3 the note retires whole from the script: no data-blockdlnote emission or sweep stands anywhere in client.ts; 'remove in Settings' census 0");
  const rg = extractFn(CLIENT, "refreshGridDlStates");
  ok(rg.includes("view.querySelectorAll('[data-blockdl]').forEach(function (btn) {")
    && rg.includes("btn.textContent = full ? 'On this device' : 'Download all';")
    && rg.includes("btn.disabled = full;")
    && !rg.includes("blockdlnote")
    && bp.includes("var dlBtn = view.querySelector('[data-blockdl]');")
    && bp.includes("if (dlBtn) dlBtn.addEventListener('click', function () { blockDownloadAll(b.block); });")
    && extractFn(CLIENT, "blockDownloadAll") === extractFn(BASE_CLIENT, "blockDownloadAll")
    && extractFn(CLIENT, "updateBlockCounts") === extractFn(BASE_CLIENT, "updateBlockCounts")
    && extractFn(CLIENT, "paintEpisodesPage") === extractFn(BASE_CLIENT, "paintEpisodesPage"),
    "ST4 the standing machinery stands in its standing form: the [data-blockdl] settlement sweep (text + disabled) and the act wiring unchanged; blockDownloadAll, updateBlockCounts and paintEpisodesPage byte-identical to the base");
  const dlact = (UI.match(/\.blockpage-dlact \{[^}]*\}/) || [""])[0];
  ok(!UI.includes(".blockpage-dlnote")
    && UI.includes(".blockpage-meta { display:flex; align-items:center; gap:10px;")
    && UI.includes(".blockpage-metatext { flex:1; min-width:0; }")
    && dlact.includes("flex:none") && dlact.includes("white-space:nowrap") && dlact.includes("padding:6px 0") && !dlact.includes("display:block")
    && UI.includes(".blockpage-dlrow {"),
    "ST5 ui.ts: the .blockpage-dlnote rule retires; .blockpage-meta gains the flex row form; the .blockpage-metatext rule stands (flex:1, min-width:0); the act re-forms (flex:none, nowrap, padding 6px 0, no display:block); the orphaned .blockpage-dlrow stands untouched");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v458-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "ST6 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v454-1";'),
    "ST7 (housekeeping): the SW pin stands at ora-pro-nobis-v454-1 (Ship moves it)");
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "ST8 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
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
  ok(census === 0, "ST8 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);
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
const INTENTIONS = { intentions: [
  { id: 1, text: "For the family", priority: "H", status: "active", created_at: "2026-11-01", drawnCount: 2 },
] };
const PRAYERDAY = { date: "2026-11-15", dateLabel: "Sunday, November 15, 2026", liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" } };

const TPL_A2 = CLIENT.indexOf("APP_JS = `") + 10;
const COOKED = new Function("return `" + CLIENT.slice(TPL_A2, CLIENT.indexOf("`;", TPL_A2)) + "`")();
const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
var FIX = { DAY: ${JSON.stringify(DAY)}, INDEX: ${JSON.stringify(INDEX)}, SERIES: ${JSON.stringify(SERIES)}, VIDEO: ${JSON.stringify(VIDEO)}, EXAM: ${JSON.stringify(EXAM)}, CONF: ${JSON.stringify(CONF)}, INTENTIONS: ${JSON.stringify(INTENTIONS)}, PRAYERDAY: ${JSON.stringify(PRAYERDAY)} };
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
  if (p.indexOf('/api/exam/reflections') === 0) return J({ ok: true, reflections: [] });
  if (p.indexOf('/api/confession') === 0) return J(FIX.CONF);
  if (p.indexOf('/api/prayer/intentions') === 0) return J(FIX.INTENTIONS);
  if (p.indexOf('/api/prayer/day') === 0) return J(FIX.PRAYERDAY);
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
  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);

  /* ---- B1: the block page opens on ONE row ---- */
  await ev(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await page.waitForFunction(`(document.querySelector('[data-bmeta="Morning"]') || {}).textContent && document.querySelector('[data-bmeta="Morning"]').textContent.includes('12min')`, null, { timeout: 6000 }).catch(() => {});
  await sleep(250);
  const b1 = await ev(`(function(){
    var host = document.getElementById('sidehost');
    var meta = host.querySelector('.blockpage-meta');
    var first = host.firstElementChild;
    var txt = meta ? meta.querySelector('.blockpage-metatext') : null;
    var span = meta ? meta.querySelector('[data-bmeta="Morning"]') : null;
    var btn = meta ? meta.querySelector('[data-blockdl="Morning"]') : null;
    var firstRow = host.querySelector('.card.trow');
    var mr = meta ? meta.getBoundingClientRect() : null;
    var br = btn ? btn.getBoundingClientRect() : null;
    var tr = txt ? txt.getBoundingClientRect() : null;
    return { firstIsMeta: !!meta && first === meta,
      metaCount: host.querySelectorAll('.blockpage-meta').length,
      noteEls: document.querySelectorAll('.blockpage-dlnote, [data-blockdlnote]').length,
      txtText: txt ? txt.textContent.trim() : null,
      spanInTxt: !!(span && txt && txt.contains(span)),
      spanText: span ? span.textContent.trim() : null,
      btnInMeta: !!btn, btnText: btn ? btn.textContent.trim() : null, btnDisabled: btn ? btn.disabled : null,
      dlactOutside: Array.prototype.filter.call(host.querySelectorAll('.blockpage-dlact'), function (b) { return !meta.contains(b); }).length,
      sameLine: (br && tr) ? Math.abs((br.top + br.bottom) / 2 - (tr.top + tr.bottom) / 2) <= 8 : false,
      atEnd: (br && mr) ? (br.right >= mr.right - 4 && br.left >= mr.left + mr.width / 2) : false,
      rowBeforeRows: !!(meta && firstRow && (meta.compareDocumentPosition(firstRow) & 4) !== 0),
      rows: host.querySelectorAll('.card.trow').length };
  })()`);
  ok(b1.firstIsMeta && b1.metaCount === 1 && b1.noteEls === 0 && b1.spanInTxt
    && b1.txtText && b1.txtText.includes("Morning prayers") && b1.spanText === "3 episodes · 12min"
    && b1.btnInMeta && b1.btnText === "Download all" && b1.btnDisabled === false && b1.dlactOutside === 0
    && b1.sameLine && b1.atEnd && b1.rowBeforeRows && b1.rows === 3,
    "B1 the block page opens on ONE row: the body's first element is the single .blockpage-meta row — the text span (Morning prayers · the settled span) at the left, the Download all act at the row's trailing end on the same line; NO note element stands anywhere; the 3 track rows follow", JSON.stringify(b1));

  /* ---- B2: no Settings text in the not-downloaded state ---- */
  const b2 = await ev(`(function(){
    var host = document.getElementById('sidehost');
    return { hostSettings: host.textContent.includes('Settings'),
      bodyRemove: document.body.textContent.includes('remove in Settings'),
      rowSettings: document.querySelector('.blockpage-meta').textContent.includes('Settings') };
  })()`);
  ok(!b2.hostSettings && !b2.bodyRemove && !b2.rowSettings,
    "B2 no Settings text stands in the body lines in the not-downloaded state (no 'Settings' in the page body host, no 'remove in Settings' anywhere in the document)", JSON.stringify(b2));

  /* ---- B3: the data-bmeta settlement lands in the row ---- */
  const b3 = await ev(`(function(){
    var span = document.querySelector('[data-bmeta="Morning"]');
    span.textContent = 'SETTLING';
    updateBlockCounts(state.dayPayload);
    var meta = document.querySelector('.blockpage-meta');
    var txt = meta.querySelector('.blockpage-metatext');
    return { after: span.textContent.trim(), inRow: meta.contains(span) && txt.contains(span) };
  })()`);
  ok(b3.after === "3 episodes · 12min" && b3.inRow,
    "B3 the data-bmeta settlement lands in the row: after a stomp, updateBlockCounts rewrites the span in place (3 episodes · 12min) — the span stands inside the text span inside the row", JSON.stringify(b3));

  /* ---- B4: the download tap flow, end to end ----
     The arrangement mirrors production's shape (the v455
     harness's B2 arrangement): the block's tracks stand as
     own items in the offline enumeration, so
     blockDownloadAll has its standing set to fetch through
     the feed-audio pass-through the stub serves. */
  await ev(`(function(){
    state.ownStanding = [{ sourceKey: 'morning-own', block: 'Morning' }];
    state.ownSlots = { 'morning-own': { state: 'present', tracks: [9000, 9001, 9002].map(function (id) { return { episodeId: String(id), enclosureUrl: location.origin + '/audio/' + id + '.wav' }; }) } };
  })()`);
  await page.click('#sidehost [data-blockdl="Morning"]');
  await page.waitForFunction(`(function(){ var b = document.querySelector('[data-blockdl="Morning"]'); return b && b.disabled && b.textContent.trim() === 'On this device'; })()`, null, { timeout: 12000 }).catch(() => {});
  await sleep(250);
  const b4 = await ev(`(function(){
    var host = document.getElementById('sidehost');
    var meta = host.querySelector('.blockpage-meta');
    var btn = meta ? meta.querySelector('[data-blockdl="Morning"]') : null;
    return { text: btn ? btn.textContent.trim() : null, disabled: btn ? btn.disabled : null,
      metaCount: host.querySelectorAll('.blockpage-meta').length,
      noteEls: document.querySelectorAll('.blockpage-dlnote, [data-blockdlnote]').length,
      hostSettings: host.textContent.includes('Settings'),
      bodyRemove: document.body.textContent.includes('remove in Settings'),
      firstIsMeta: host.firstElementChild === meta };
  })()`);
  ok(b4.text === "On this device" && b4.disabled === true && b4.metaCount === 1 && b4.noteEls === 0
    && !b4.hostSettings && !b4.bodyRemove && b4.firstIsMeta,
    "B4 the download tap runs the download end to end: the act reads On this device, disabled — in the same single row; no note element appears and no Settings text stands in the downloaded state either", JSON.stringify(b4));

  /* ---- B5: the episodes page stands outside the change ---- */
  await page.click("#hdrrow2 [data-back]");
  await page.waitForSelector('[data-openblock="__episodes"]', { timeout: 6000 });
  await sleep(300);
  await ev(`document.querySelector('[data-openblock="__episodes"]').click()`);
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(250);
  const b5 = await ev(`(function(){
    var host = document.getElementById('sidehost');
    var meta = host.querySelector('.blockpage-meta');
    return { metaText: meta ? meta.textContent.trim() : null,
      btnInMeta: meta ? !!meta.querySelector('button') : null,
      anyDl: !!host.querySelector('[data-blockdl]'),
      playrow: !!host.querySelector('.blockpage-playrow [data-queue="__episodes"]') };
  })()`);
  ok(b5.metaText && b5.metaText.includes("1 episodes") && b5.metaText.includes("5min")
    && b5.btnInMeta === false && !b5.anyDl && b5.playrow,
    "B5 the episodes page stands as today: its meta line is text-only (1 episodes · 5min) with NO act inside it and no download act on the page; the Play All body row stands", JSON.stringify(b5));

  /* ---- B6: 360px — a long caption wraps in the text span,
     the act holds the row's end, tappable ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  page2.on("pageerror", (e) => pageErrors.push("360: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(300);
  await page2.evaluate(`(function(){
    var b = (state.dayPayload.blocks || []).filter(function (x) { return x.block === 'Morning'; })[0];
    if (b) b.caption = 'The morning prayers of the whole household, gathered from the day book';
  })()`);
  await page2.evaluate(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page2.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(250);
  const b6 = await page2.evaluate(`(function(){
    var host = document.getElementById('sidehost');
    var meta = host.querySelector('.blockpage-meta');
    var btn = meta ? meta.querySelector('[data-blockdl="Morning"]') : null;
    var mr = meta.getBoundingClientRect(), br = btn.getBoundingClientRect();
    var cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    var hit = document.elementFromPoint(cx, cy);
    return { scrollW: document.documentElement.scrollWidth,
      btnInMeta: !!btn, btnRight: br.right, metaRight: mr.right,
      centered: Math.abs(cy - (mr.top + mr.bottom) / 2) <= 6,
      hitBtn: !!hit && (hit === btn || btn.contains(hit)),
      captionThere: meta.textContent.includes('whole household') };
  })()`);
  ok(b6.btnInMeta && b6.captionThere && b6.btnRight <= b6.metaRight + 1 && b6.centered && b6.hitBtn && b6.scrollW <= 362,
    "B6 at 360px with a long caption: the caption wraps inside the text span, the act holds the row's trailing end on the row's line (centered against the row), the tap point hits the act, no horizontal overflow (362 is the base's own standing measure)", JSON.stringify(b6));

  ok(pageErrors.length === 0, "Z zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v458: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
