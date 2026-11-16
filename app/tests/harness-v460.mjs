#!/usr/bin/env node
// harness-v460 — Intentions add disc returns (v459
// amendment; Scope record 1783 · Plan record 1784; John's
// word 2026-11-15 23:36 CT: "Put an add button on the
// intention screen floating bottom right"). Measured:
// (1) the three restores stand byte-identical to their
// v458 lifts — the #int-fab emission in the Intentions
// paint, the two-line fab wiring at wireIntentions' head,
// and the two .intfab dress rules in ui.ts — while
// #int-menu stays retired in every form and the other
// nine v459 bundle censuses stand at 0. (2) D1 the disc
// stands in the Intentions paint and D2 nowhere else
// (the Prayers home, a block page, the episodes page,
// each Conscience side, the Formation home and a series
// page, each Sacred Art side). (3) D3 the disc's tap
// opens the add-intention sheet; D5 the universal menu's
// Add intention still opens the same sheet. (4) D4 the
// offsets: the base variant (tabh + 14px) and, with
// body.dock-on standing, the dock-on variant
// (tabh + dockh + 14px), read as computed style.
// Mold: harness-v459's whole-client boot (the real
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
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v460 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v459-ship";
const RESTORE = "release/v458-ship";
const BASE_CLIENT = execFileSync("git", ["-C", WT, "show", BASE + ":app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const OLD_CLIENT = execFileSync("git", ["-C", WT, "show", RESTORE + ":app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const OLD_UI = execFileSync("git", ["-C", WT, "show", RESTORE + ":app/worker/src/ui.ts"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };

function extractFn(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return null;
  let i = src.indexOf("{", at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (!depth) return src.slice(at, j + 1); }
  }
  return null;
}
const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
const COOKED = new Function("return `" + RAW_JS + "`")();

/* ---------------- statics ---------------- */
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]),
    "ST1 the worker-source diff vs the v459-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");

  let cooked = null, parseErr = null;
  try { cooked = COOKED; new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "ST2 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
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
  ok(census === 0, "ST2 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);

  const NINE = ["data-blockmenu", "data-blockdl", "blockpage-dlact", "int-menu", "sort-btn", "offline-dl-btn", "pod-offline-btn", "data-podfullpage", 'data-menuitem="1"'];
  NINE.forEach((p) => {
    const c = (CLIENT.split(p).length - 1) + (UI.split(p).length - 1);
    ok(c === 0, "ST3 standing v459 census: " + p + " = 0 on the served bundle (client.ts + ui.ts)", "count=" + c);
  });

  const emLine = OLD_CLIENT.split("\n").filter((l) => l.includes('id="int-fab"'))[0];
  const fab1 = OLD_CLIENT.split("\n").filter((l) => l.includes("getElementById('int-fab')"))[0];
  const fab2 = OLD_CLIENT.split("\n").filter((l) => l.includes("fab.addEventListener"))[0];
  ok(!!emLine && CLIENT.includes(emLine) && (COOKED.split('id="int-fab"').length - 1) === 1,
    "ST4 Restore 1: the emission line stands byte-identical to its v458 lift, and id=\"int-fab\" stands exactly once in the cooked script");
  ok(!!fab1 && !!fab2 && CLIENT.includes(fab1 + "\n" + fab2),
    "ST4 Restore 2: the two-line fab wiring stands byte-identical to its v458 lift, contiguous, opening openIntentionEditor(null)");
  const rule1 = OLD_UI.split("\n").filter((l) => l.startsWith(".intfab {"))[0];
  const rule2 = OLD_UI.split("\n").filter((l) => l.startsWith("body.dock-on .intfab"))[0];
  ok(!!rule1 && !!rule2 && UI.includes(rule1) && UI.includes(rule2),
    "ST4 Restore 3: both .intfab dress rules stand byte-identical to their v458 lifts in ui.ts");

  ok(extractFn(CLIENT, "openHeaderMenu") === extractFn(BASE_CLIENT, "openHeaderMenu")
    && extractFn(CLIENT, "openIntentionEditor") === extractFn(BASE_CLIENT, "openIntentionEditor")
    && extractFn(CLIENT, "openSheetMenu") === extractFn(BASE_CLIENT, "openSheetMenu"),
    "ST5 the universal menu is unedited: openHeaderMenu, openIntentionEditor and openSheetMenu are byte-identical to the v459-ship base");

  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v460-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "ST6 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v459-1";'),
    "ST6 (housekeeping): the SW pin stands at ora-pro-nobis-v459-1 (Ship moves it)");
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

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.__opened = [];
window.open = function (u) { window.__opened.push(String(u)); return null; };
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
  const fabHere = () => ev(`!!document.getElementById('int-fab')`);
  const dropSheets = async () => { await ev(`document.querySelectorAll('.sheet, .ordersheet, .sharesheet').forEach(function (s) { s.remove(); });`); await sleep(150); };
  const sheetProbe = () => ev(`(function(){ var t = document.querySelector('.sheet #ed-text'); var h = document.querySelector('.sheet h1.screen'); return { sheet: !!t, title: h ? h.textContent : null }; })()`);

  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);

  /* ---- D2: the Prayers home, a block page, the
     episodes page — no disc ---- */
  ok(!(await fabHere()), "D2 the Prayers home carries no #int-fab");
  await ev(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(250);
  ok(!(await fabHere()), "D2 a block page (Morning) carries no #int-fab");
  await page.click("#hdrrow2 [data-back]");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);
  await ev(`document.querySelector('[data-openblock="__episodes"]').click()`);
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(250);
  ok(!(await fabHere()), "D2 the episodes page carries no #int-fab");
  await page.click("#hdrrow2 [data-back]");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);

  /* ---- the Intentions side: D1, D4, D3, D5 ---- */
  await ev(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await page.waitForFunction(`(document.getElementById('sidehost') || {}).textContent && document.getElementById('sidehost').textContent.includes('For the family')`, null, { timeout: 6000 }).catch(() => {});
  await sleep(300);
  const d1 = await ev(`(function(){ var f = document.getElementById('int-fab'); if (!f) return { stands: false };
    return { stands: true, cls: f.className, glyph: f.textContent, aria: f.getAttribute('aria-label'),
      inPaint: document.getElementById('sidehost').contains(f) }; })()`);
  ok(d1.stands && d1.cls === "intfab" && d1.glyph === "+" && d1.aria === "Add an intention" && d1.inPaint,
    "D1 the Intentions paint seats #int-fab in its own output (class intfab, glyph +, aria-label 'Add an intention')", JSON.stringify(d1));
  const d4a = await ev(`(function(){ var f = document.getElementById('int-fab'); var cs = getComputedStyle(f);
    var varTabh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tabh'));
    var tabh = isNaN(varTabh) ? document.getElementById('tabbar').offsetHeight : varTabh;
    return { bottom: parseFloat(cs.bottom), tabh: tabh, pos: cs.position, w: f.offsetWidth, h: f.offsetHeight }; })()`);
  ok(d4a.pos === "fixed" && d4a.w === 56 && d4a.h === 56 && Math.abs(d4a.bottom - (d4a.tabh + 14)) < 1.6,
    "D4 the base offset stands: position fixed, a 56px disc, computed bottom = tabh + 14px", JSON.stringify(d4a));
  const d4b = await ev(`(function(){ document.documentElement.style.setProperty('--dockh', '60px'); document.body.classList.add('dock-on');
    var f = document.getElementById('int-fab'); var cs = getComputedStyle(f);
    var varTabh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tabh'));
    var tabh = isNaN(varTabh) ? document.getElementById('tabbar').offsetHeight : varTabh;
    return { bottom: parseFloat(cs.bottom), tabh: tabh }; })()`);
  ok(Math.abs(d4b.bottom - (d4b.tabh + 60 + 14)) < 1.6,
    "D4 the dock-on variant stands: with body.dock-on, computed bottom = tabh + dockh (60px) + 14px", JSON.stringify(d4b));
  await ev(`document.body.classList.remove('dock-on'); document.documentElement.style.removeProperty('--dockh');`);
  await sleep(150);
  /* D3: the tap opens the add sheet */
  await page.click("#int-fab");
  await sleep(400);
  const d3 = await sheetProbe();
  ok(d3.sheet && d3.title === "Add an intention",
    "D3 a tap on the disc opens the add-intention editor sheet (the standing openIntentionEditor(null) sheet)", JSON.stringify(d3));
  await dropSheets();
  /* D5: the menu door opens the same sheet */
  await page.click("#hdr-menu");
  await page.waitForSelector(".anchmenu", { timeout: 5000 });
  await sleep(150);
  const d5rows = await ev(`Array.prototype.map.call(document.querySelectorAll('.anchmenu [data-menuitem]'), function (r) {
    var head = r.classList.contains('menuhead');
    return { head: head, label: head ? r.textContent.trim() : r.querySelector('.grow').textContent }; })`);
  const d5grp = d5rows.length > 2 && d5rows[0].head && d5rows[0].label === "Intentions" && d5rows[2].label === "Add intention";
  ok(d5grp, "D5 the universal menu's Intentions page group still stands first (head 'Intentions': Redraw · Add intention)", JSON.stringify(d5rows.map((r) => r.label)));
  await ev(`(function(){ var rows = document.querySelectorAll('.anchmenu [data-menuitem]');
    for (var i = 0; i < rows.length; i++) { var g = rows[i].querySelector('.grow'); if (g && g.textContent === 'Add intention') { rows[i].click(); return; } } })()`);
  await sleep(400);
  const d5 = await sheetProbe();
  ok(d5.sheet && d5.title === "Add an intention",
    "D5 the menu's Add intention opens the same add sheet — two doors, one sheet", JSON.stringify(d5));
  await dropSheets();
  await ev(`document.querySelector('#sidetoggle [data-side="prayers"]').click()`);
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);

  /* ---- D2: each Conscience side (through the PIN gate,
     driven as the user drives it) ---- */
  await page.click('#tabbar [data-tab="conscience"]');
  await page.waitForSelector("#pinpad", { timeout: 5000 });
  for (let k = 0; k < 4; k++) { await page.click('#pinpad [data-pinkey="1"]'); await sleep(60); }
  await page.click("#pin-unlock");
  await page.waitForSelector(".examchips", { timeout: 6000 });
  await sleep(250);
  ok(!(await fabHere()), "D2 the Examination side carries no #int-fab");
  const cSides = await ev(`Array.prototype.map.call(document.querySelectorAll('#sidetoggle [data-side]'), function (b) { return b.getAttribute('data-side'); })`);
  for (const s of cSides) {
    await ev(`document.querySelector('#sidetoggle [data-side="${s}"]').click()`);
    await sleep(500);
    ok(!(await fabHere()), "D2 the Conscience side '" + s + "' carries no #int-fab");
  }

  /* ---- D2: the Formation home and a series page ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 6000 });
  await sleep(300);
  ok(!(await fabHere()), "D2 the Formation home carries no #int-fab");
  await ev(`document.querySelector('[data-podseries="bible"]').click()`);
  await sleep(500);
  ok(!(await fabHere()), "D2 a Formation series page (Bible in a Year) carries no #int-fab");
  await page.click('#tabbar [data-tab="podcasts"]');
  await sleep(400);

  /* ---- D2: each Sacred Art side ---- */
  await page.click('#tabbar [data-tab="wallpaper"]');
  await sleep(700);
  ok(!(await fabHere()), "D2 the Sacred Art Phone side carries no #int-fab");
  const wSides = await ev(`Array.prototype.map.call(document.querySelectorAll('#sidetoggle [data-side]'), function (b) { return b.getAttribute('data-side'); })`);
  for (const s of wSides) {
    await ev(`document.querySelector('#sidetoggle [data-side="${s}"]').click()`);
    await sleep(500);
    ok(!(await fabHere()), "D2 the Sacred Art side '" + s + "' carries no #int-fab");
  }

  ok(pageErrors.length === 0, "Z zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v460: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
