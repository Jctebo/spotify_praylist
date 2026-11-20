#!/usr/bin/env node
// harness-v459 — One universal menu (Scope record 1776 +
// Amendment 1 · Plan record 1779 · approval record 23 on
// package 32: D1 A · D2 A · D3 A · D4 A · D5 A · To Ship).
// Measured: (1) the composition — openHeaderMenu rebuilt:
// the current page's action group FIRST under the page's
// name (D5 A), the standing section's group in full, each
// other section as ONE entry (state ›, act setTab), and
// Settings alone at the foot (D2 A); on the Settings
// screen no section stands. C1–C10, one per standing.
// (2) the merged acts fire their standing sheets/flows
// from the menu — A1–A12 — including the mark-all rewired
// BY KEY (openSheetMenu's additive data-menukey; no
// positional [data-menuitem="1"] read survives), the
// download state settling on the menu item, the Redraw
// adapter (busy seat #hdr-menu + its restore line), and
// the Full-page adapter (openFullPage whole with the
// Browser plugin; the native open by hand without it).
// (3) the retirements — 11 censuses at 0 on the served
// bundle (cooked APP_JS + ui.ts dress), and the retired
// elements absent from the live DOM at their old seats.
// (4) the stands — the untouched functions byte-identical
// to the base; the item menus/buttons, playback buttons,
// player/dock menus, in-body controls, the header with
// its pages-menu pill, and the tab bar asserted present.
// Mold: harness-v458/v455's whole-client boot (the real
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
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v459 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v458-ship";
const BASE_CLIENT = execFileSync("git", ["-C", WT, "show", BASE + ":app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
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

/* ---------------- statics ---------------- */
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]),
    "ST1 the worker-source diff vs the v458-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");

  const CENSUS = ["data-blockmenu", "data-blockdl", "blockpage-dlact", "int-fab", "intfab", "int-menu", "sort-btn", "offline-dl-btn", "pod-offline-btn", "data-podfullpage", 'data-menuitem="1"'];
  CENSUS.forEach((p) => {
    const c = (CLIENT.split(p).length - 1) + (UI.split(p).length - 1);
    ok(c === 0, "ST2 retirement census: " + p + " = 0 on the served bundle (client.ts + ui.ts)", "count=" + c);
  });

  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "ST3 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
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
  ok(census === 0, "ST3 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);

  ok(cooked.includes("data-menukey") && cooked.includes("data-queue") && cooked.includes('id="play-all"')
    && cooked.includes('class="segtoggle pill" id="sidetoggle"')
    && cooked.includes('id="np-menu"') && UI.includes('id="dock-menu"')
    && extractFn(CLIENT, "openSheetMenu").includes("it.key ? ' data-menukey=\"'"),
    "ST4 stands asserted present: data-menukey (openSheetMenu's additive key render, gated on it.key) · the [data-queue] discs · #play-all · the pages-menu pill markup · the player menu button (the Now Playing sheet's emission, in the cooked script) · the dock menu button (the shell)");

  const STANDS = ["openFullPage", "wirePlayed", "blockPlayedCounts", "blockDownloadAll", "openBlockOrderEditor", "offlineCompleteness", "settleIntentions", "openIntentionEditor", "paintEpisodesPage", "paintSideToggle", "openShareSheet", "goBlock", "goSide", "goSeries", "setTab"];
  const diffs = STANDS.filter((f) => extractFn(CLIENT, f) !== extractFn(BASE_CLIENT, f));
  ok(diffs.length === 0, "ST5 the stands are byte-identical to the base: " + STANDS.join(" · "), "differ: " + diffs.join(", "));
  ok(extractFn(CLIENT, "wireOfflineButtons") === null && extractFn(CLIENT, "podFullPageActHtml") === null && extractFn(CLIENT, "wirePodFullPage") === null,
    "ST5 the retired functions are gone whole: the offline-buttons wiring · the full-page anchor emission · its wiring");

  const ohm = extractFn(CLIENT, "openHeaderMenu");
  ok(ohm.includes("cap.Plugins.Browser") && ohm.includes("openFullPage(null)") && ohm.includes("window.open(YT_CHANNEL_URL, '_blank', 'noopener')")
    && ohm.includes("card.querySelector('[data-menukey=\"markall\"]')") && ohm.includes("setTab(sec.tab)"),
    "ST6 by construction: the Full-page adapter's two branches (the plugin branch runs openFullPage(null); the no-plugin branch performs the native open by hand) · the mark-all row found BY KEY · the one-entry rows act through setTab");

  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v459-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "ST7 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v458-1";'),
    "ST7 (housekeeping): the SW pin stands at ora-pro-nobis-v458-1 (Ship moves it)");
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
  const menuRows = () => ev(`Array.prototype.map.call(document.querySelectorAll('.anchmenu [data-menuitem]'), function (r) {
    var st = r.querySelector('[data-menustate]');
    var head = r.classList.contains('menuhead');
    return { i: Number(r.getAttribute('data-menuitem')), head: head,
      label: head ? r.textContent.trim() : r.querySelector('.grow').textContent,
      state: st ? st.textContent : null, key: r.getAttribute('data-menukey'), mark: r.getAttribute('data-markblock') };
  })`);
  const openMenu = async () => { await page.click("#hdr-menu"); await page.waitForSelector(".anchmenu", { timeout: 5000 }); await sleep(150); };
  const closeMenu = async () => { await ev(`(function(){ var c = document.querySelector('.menucatcher'); if (c) c.click(); })()`); await sleep(150); };
  const clickRow = async (pred, what) => {
    const rows = await menuRows();
    const t = rows.filter(pred)[0];
    if (!t) throw new Error("menu row not found: " + what + " in " + JSON.stringify(rows.map((r) => r.label)));
    await ev(`document.querySelector('.anchmenu [data-menuitem="${t.i}"]').click()`);
    await sleep(300);
  };
  const labels = (rows) => rows.map((r) => r.label);
  const dropSheets = async () => { await ev(`document.querySelectorAll('.sheet, .ordersheet, .sharesheet').forEach(function (s) { s.remove(); });`); await sleep(150); };

  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);
  // Let the boot's own automatic offline pass land before
  // the A8 counter wraps the act (its 4s deferred timer).
  await page.waitForFunction(`window.__fetchLog.some(function (p) { return p.indexOf('2026-11-16') >= 0; })`, null, { timeout: 9000 }).catch(() => {});
  await ev(`(function(){ window.__ocCalls = 0; var orig = offlineCompleteness; offlineCompleteness = function (m) { window.__ocCalls++; return orig(m); }; })()`);

  /* ---- C4: the Prayers home — page group 'Prayers',
     then the Prayers group in full (two 'Prayers' heads
     stand, per D5 A as approved) ---- */
  await openMenu();
  const c4 = await menuRows();
  ok(JSON.stringify(labels(c4)) === JSON.stringify(["Prayers", "Sort", "Download for offline", "Prayers", "Morning", "Midday", "Evening", "Intentions", "Conscience", "Formation", "Sacred Art", "Settings"])
    && c4[0].head && c4[3].head && c4.slice(8, 11).every((r) => r.state === "›") && c4[11].state === null
    && c4.slice(4, 8).every((r) => r.state === null),
    "C4 the Prayers home menu: the page group first (head 'Prayers': Sort · Download for offline), the standing Prayers group in full under its own 'Prayers' head (the two same-name heads of D5 A), the other three sections as one-entry rows (state ›), Settings alone at the foot", JSON.stringify(c4));
  /* A1 (home seat): Sort opens the block order editor */
  await clickRow((r) => r.label === "Sort", "home Sort");
  const a1a = await ev(`!!document.querySelector('.ordersheet [data-orderlist]')`);
  ok(a1a, "A1 Sort from the Prayers home group opens the standing block order editor");
  await dropSheets();
  /* A8 (home seat): Download for offline runs the act */
  await openMenu();
  const ocBefore = await ev(`window.__ocCalls`);
  await clickRow((r) => r.label === "Download for offline", "home Download for offline");
  const ocAfter = await ev(`window.__ocCalls`);
  ok(ocAfter > ocBefore, "A8 Download for offline from the Prayers home group runs offlineCompleteness", ocBefore + " -> " + ocAfter);

  /* ---- the Morning block page ---- */
  await ev(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(250);
  const domRet = await ev(`(function(){
    var host = document.getElementById('sidehost');
    var meta = host.querySelector('.blockpage-meta');
    return { barMenu: !!document.querySelector('#hdrrow2 [data-blockmenu]'),
      barDisc: !!document.querySelector('#hdrrow2 [data-queue="Morning"]'),
      dlInView: !!host.querySelector('[data-blockdl]'),
      metaBtn: meta ? !!meta.querySelector('button') : null,
      metaText: meta ? meta.textContent.trim() : null };
  })()`);
  ok(!domRet.barMenu && domRet.barDisc && !domRet.dlInView && domRet.metaBtn === false
    && domRet.metaText && domRet.metaText.includes("Morning prayers"),
    "C1 (DOM) the block page after: the bar carries back · title · the Play All disc alone (no page-menu button); the one meta row keeps its text alone (no download act inside it)", JSON.stringify(domRet));
  await openMenu();
  const c1 = await menuRows();
  ok(JSON.stringify(labels(c1)) === JSON.stringify(["Morning", "Sort", "Mark all played", "Share", "Open in Spotify", "Download all", "Prayers", "Morning", "Midday", "Evening", "Intentions", "Conscience", "Formation", "Sacred Art", "Settings"])
    && c1[0].head && c1[6].head && c1[2].key === "markall" && c1[2].mark === "Morning" && c1[5].state === null
    && c1[7].state === "Here" && c1.slice(11, 14).every((r) => r.state === "›"),
    "C1 the block page menu: the page group first (head = the block's name: Sort · Mark all played · Share · Open in Spotify · Download all, unsettled), the Prayers group in full with the standing block Here, the other sections one-entry, Settings at the foot; the mark-all row carries the key AND data-markblock already (the by-key wiring landed at open)", JSON.stringify(c1));
  /* A1 (block seat) */
  await clickRow((r) => r.label === "Sort", "block Sort");
  ok(await ev(`!!document.querySelector('.ordersheet [data-orderlist]')`), "A1 Sort from the block page group opens the standing block order editor");
  await dropSheets();
  /* A3: Share opens the share sheet with the block's facts */
  await openMenu();
  await clickRow((r) => r.label === "Share", "Share");
  const a3 = await ev(`(function(){ var s = document.querySelector('.sharesheet'); return s ? s.textContent : null; })()`);
  ok(!!a3 && a3.includes("Morning") && a3.includes("Playlist · 3 episodes"),
    "A3 Share opens the standing share sheet with the block's title and line (Playlist · 3 episodes)", String(a3).slice(0, 160));
  await dropSheets();
  /* A4: Open in Spotify opens the block's URL */
  await openMenu();
  await clickRow((r) => r.label === "Open in Spotify", "Open in Spotify");
  const a4 = await ev(`window.__opened`);
  ok(a4.includes("https://open.spotify.com/playlist/morning"),
    "A4 Open in Spotify calls window.open with the block's Spotify URL", JSON.stringify(a4));
  /* A2: mark-all BY KEY — the round trip */
  await openMenu();
  const a2pre = await menuRows();
  const markRow = a2pre.filter((r) => r.key === "markall")[0];
  ok(!!markRow && markRow.mark === "Morning" && markRow.label === "Mark all played"
    && a2pre.every((r) => r.key === "markall" || r.mark === null),
    "A2 the mark-all row is found BY KEY ([data-menukey=\"markall\"]) and carries data-markblock for the block after open; no other row carries it", JSON.stringify(a2pre));
  await clickRow((r) => r.key === "markall", "mark-all");
  await sleep(200);
  await openMenu();
  const a2mid = await menuRows();
  ok(a2mid.filter((r) => r.key === "markall")[0].label === "Mark all unplayed",
    "A2 a tap on the by-key row writes the block's whole available set — at the next open the label reads Mark all unplayed", JSON.stringify(labels(a2mid)));
  await clickRow((r) => r.key === "markall", "mark-all again");
  await sleep(200);
  await openMenu();
  const a2post = await menuRows();
  ok(a2post.filter((r) => r.key === "markall")[0].label === "Mark all played",
    "A2 the second round marks unplayed — the label flips back to Mark all played", JSON.stringify(labels(a2post)));
  await closeMenu();
  /* A5: Download all — the state settles on the item */
  await ev(`(function(){
    state.ownStanding = [{ sourceKey: 'morning-own', block: 'Morning' }];
    state.ownSlots = { 'morning-own': { state: 'present', tracks: [9000, 9001, 9002].map(function (id) { return { episodeId: String(id), enclosureUrl: location.origin + '/audio/' + id + '.wav' }; }) } };
  })()`);
  await openMenu();
  await clickRow((r) => r.label === "Download all", "Download all");
  await page.waitForFunction(`!!(state.gridDl && state.gridDl.Morning)`, null, { timeout: 12000 }).catch(() => {});
  await openMenu();
  const a5 = await menuRows();
  const dlRow = a5.filter((r) => r.label === "Download all")[0];
  ok(!!dlRow && dlRow.state === "On this device",
    "A5 after the download runs, the reopened menu's Download all item carries the settled state 'On this device' (the v458 settlement, moved onto the item)", JSON.stringify(dlRow));
  const fetchBefore = await ev(`window.__fetchLog.length`);
  await clickRow((r) => r.label === "Download all", "settled Download all");
  await sleep(400);
  const fetchAfter = await ev(`window.__fetchLog.length`);
  ok(fetchAfter === fetchBefore,
    "A5 the settled item is inert — its tap closes the menu and writes nothing (no fetch fires)", fetchBefore + " -> " + fetchAfter);
  /* A11: a one-entry section row lands the tab (setTab) */
  await openMenu();
  await clickRow((r) => !r.head && r.label === "Conscience" && r.state === "›", "Conscience one-entry");
  await page.waitForFunction(`state.tab === 'conscience'`, null, { timeout: 5000 }).catch(() => {});
  const a11 = await ev(`state.tab`);
  ok(a11 === "conscience", "A11 the one-entry Conscience row lands the Conscience tab (setTab — the tab-bar landing)", String(a11));
  /* the PIN gate, driven as the user drives it */
  await page.waitForSelector("#pinpad", { timeout: 5000 });
  for (let k = 0; k < 4; k++) { await page.click('#pinpad [data-pinkey="1"]'); await sleep(60); }
  await page.click("#pin-unlock");
  await page.waitForSelector(".examchips", { timeout: 6000 });
  await sleep(250);
  /* C5: Conscience — no page group, the group in full */
  await openMenu();
  const c5 = await menuRows();
  ok(JSON.stringify(labels(c5)) === JSON.stringify(["Conscience", "Exam", "Confess", "Direction", "Prayers", "Formation", "Sacred Art", "Settings"])
    && c5[0].head && c5[1].state === "Here" && c5.slice(4, 7).every((r) => r.state === "›"),
    "C5 the Conscience menu: NO page group (the Examination form is content, not a menu) — the Conscience group stands first and full (Exam Here · Confess · Direction), the other sections one-entry, Settings at the foot", JSON.stringify(c5));
  await closeMenu();
  await page.click('#tabbar [data-tab="prayers"]');
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);

  /* ---- C2: the episodes page — no page group ---- */
  await ev(`document.querySelector('[data-openblock="__episodes"]').click()`);
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(250);
  await openMenu();
  const c2 = await menuRows();
  ok(JSON.stringify(labels(c2)) === JSON.stringify(["Prayers", "Morning", "Midday", "Evening", "Intentions", "Conscience", "Formation", "Sacred Art", "Settings"])
    && c2[0].head && c2.every((r) => r.state === null || r.state === "›"),
    "C2 the episodes page menu is the navigation form alone: no page group (its Play All row and its rows' menus stand untouched), Prayers in full, NO block marked Here", JSON.stringify(c2));
  await closeMenu();
  await page.click("#hdrrow2 [data-back]");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);

  /* ---- C3: the Intentions side ---- */
  await ev(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await page.waitForFunction(`(document.getElementById('sidehost') || {}).textContent && document.getElementById('sidehost').textContent.includes('For the family')`, null, { timeout: 6000 }).catch(() => {});
  await sleep(300);
  const intDom = await ev(`(function(){ return { fab: !!document.getElementById('int-fab'), menu: !!document.getElementById('int-menu'), pill: !!document.getElementById('sidetoggle') }; })()`);
  ok(!intDom.fab && !intDom.menu && intDom.pill,
    "C3 (DOM) the Intentions side after: no floating add disc and no heading menu button stand; the pages-menu pill stands in the header (John's settled keep)", JSON.stringify(intDom));
  await openMenu();
  const c3 = await menuRows();
  ok(JSON.stringify(labels(c3)) === JSON.stringify(["Intentions", "Redraw", "Add intention", "Prayers", "Morning", "Midday", "Evening", "Intentions", "Conscience", "Formation", "Sacred Art", "Settings"])
    && c3[0].head && c3[3].head && c3[7].state === "Here",
    "C3 the Intentions menu: the page group first (head 'Intentions': Redraw · Add intention), the Prayers group in full with Intentions Here, the other sections one-entry, Settings at the foot", JSON.stringify(c3));
  /* A6: Redraw fires the draw POST; the busy seat restores */
  await clickRow((r) => r.label === "Redraw", "Redraw");
  await page.waitForFunction(`window.__fetchLog.some(function (p) { return p.indexOf('/api/prayer/redraw') === 0; })`, null, { timeout: 6000 }).catch(() => {});
  await sleep(700);
  const a6 = await ev(`(function(){ var b = document.getElementById('hdr-menu'); return { fired: window.__fetchLog.some(function (p) { return p.indexOf('/api/prayer/redraw') === 0; }), disabled: b.disabled, text: b.textContent }; })()`);
  ok(a6.fired && a6.disabled === false && a6.text.includes("☰"),
    "A6 Redraw POSTs the draw re-run and the side settles; the adapter's restore line stands the busy seat back (the header menu button enabled, its glyph restored)", JSON.stringify(a6));
  /* A7: Add intention opens the add sheet */
  await openMenu();
  await clickRow((r) => r.label === "Add intention", "Add intention");
  const a7 = await ev(`(function(){ var t = document.querySelector('.sheet #ed-text'); var h = document.querySelector('.sheet h1.screen'); return { sheet: !!t, title: h ? h.textContent : null }; })()`);
  ok(a7.sheet && a7.title === "Add an intention",
    "A7 Add intention opens the standing add sheet (the retired disc's and menu item's one act)", JSON.stringify(a7));
  await dropSheets();
  await ev(`document.querySelector('#sidetoggle [data-side="prayers"]').click()`);
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);

  /* ---- C6: the Formation home ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 6000 });
  await sleep(300);
  const podDom = await ev(`!!document.getElementById('pod-offline-btn')`);
  ok(!podDom, "C6 (DOM) the Formation home's row 2 carries no Download-for-offline button (title alone)");
  await openMenu();
  const c6 = await menuRows();
  ok(JSON.stringify(labels(c6)) === JSON.stringify(["Formation", "Download for offline", "Formation", "Bible in a Year", "CatholicTV", "Prayers", "Conscience", "Sacred Art", "Settings"])
    && c6[0].head && c6[2].head && c6.slice(3, 5).every((r) => r.state === null),
    "C6 the Formation home menu: the page group first (head 'Formation': Download for offline), the Formation group in full (no Here at the index), the other sections one-entry, Settings at the foot", JSON.stringify(c6));
  /* A8 (Formation seat) */
  const ocB2 = await ev(`window.__ocCalls`);
  await clickRow((r) => r.label === "Download for offline", "Formation Download for offline");
  const ocA2 = await ev(`window.__ocCalls`);
  ok(ocA2 > ocB2, "A8 Download for offline from the Formation home group runs offlineCompleteness", ocB2 + " -> " + ocA2);

  /* ---- C7: the CatholicTV series page ---- */
  await ev(`document.querySelector('[data-podseries="catholictv"]').click()`);
  await page.waitForSelector('[data-podvideo="vid1"]', { timeout: 6000 });
  await sleep(300);
  const tvDom = await ev(`!!document.querySelector('[data-podfullpage]')`);
  ok(!tvDom, "C7 (DOM) the CatholicTV page carries no full-page anchor (it retired from both paints)");
  await openMenu();
  const c7 = await menuRows();
  ok(JSON.stringify(labels(c7)) === JSON.stringify(["CatholicTV", "Full page on YouTube", "Formation", "Bible in a Year", "CatholicTV", "Prayers", "Conscience", "Sacred Art", "Settings"])
    && c7[0].head && c7[2].head && c7[4].state === "Here",
    "C7 the CatholicTV menu: the page group first (head 'CatholicTV': Full page on YouTube), the Formation group in full with CatholicTV Here, the other sections one-entry, Settings at the foot", JSON.stringify(c7));
  /* A9 (no-plugin branch, live): the native open by hand */
  await clickRow((r) => r.label === "Full page on YouTube", "Full page on YouTube");
  const a9 = await ev(`window.__opened`);
  ok(a9.includes("https://www.youtube.com/@catholictv"),
    "A9 with no Browser plugin the adapter performs the retired anchor's native open by hand, exactly once (window.open with the channel URL)", JSON.stringify(a9));

  /* ---- C8: the watch view ---- */
  await ev(`document.querySelector('[data-podvideo="vid1"]').click()`);
  await page.waitForSelector(".podwatch-frame", { timeout: 6000 });
  await sleep(300);
  const watchDom = await ev(`(function(){ var links = Array.prototype.map.call(document.querySelectorAll('#sidehost a, #view a'), function (a) { return a.textContent.trim(); }); return { ytLink: links.includes('Open in YouTube') }; })()`);
  ok(!watchDom.ytLink, "C8 (DOM) the watch view carries no Open in YouTube anchor under the frame");
  await openMenu();
  const c8 = await menuRows();
  ok(JSON.stringify(labels(c8)) === JSON.stringify(["CatholicTV", "Open in YouTube", "Formation", "Bible in a Year", "CatholicTV", "Prayers", "Conscience", "Sacred Art", "Settings"])
    && c8[0].head && c8[4].state === "Here",
    "C8 the watch view menu: the page group first (head 'CatholicTV': Open in YouTube), the Formation group in full with CatholicTV Here (the watch extension of the Here rule), the other sections one-entry, Settings at the foot", JSON.stringify(c8));
  /* A10: Open in YouTube opens the video's URL */
  await clickRow((r) => r.label === "Open in YouTube", "Open in YouTube");
  const a10 = await ev(`window.__opened`);
  ok(a10.includes("https://www.youtube.com/watch?v=vid1"),
    "A10 Open in YouTube calls window.open with the standing video's watch URL", JSON.stringify(a10));
  await page.click("#hdrrow2 [data-podwatchback]");
  await page.waitForSelector('[data-podvideo="vid1"]', { timeout: 6000 });
  await sleep(300);

  /* ---- C9: Sacred Art — no page group ---- */
  await page.click('#tabbar [data-tab="wallpaper"]');
  await sleep(700);
  await openMenu();
  const c9 = await menuRows();
  ok(JSON.stringify(labels(c9)) === JSON.stringify(["Sacred Art", "Phone", "Watch", "Prayers", "Conscience", "Formation", "Settings"])
    && c9[0].head && c9[1].state === "Here" && c9.slice(3, 6).every((r) => r.state === "›"),
    "C9 the Sacred Art menu: NO page group (its controls are in-body and stand) — the Sacred Art group stands first and full (Phone Here · Watch), the other sections one-entry, Settings at the foot", JSON.stringify(c9));
  /* A12: Settings fires renderSettings */
  await clickRow((r) => r.label === "Settings", "Settings");
  await page.waitForFunction(`state.tab === 'settings'`, null, { timeout: 5000 }).catch(() => {});
  await sleep(400);
  const a12 = await ev(`(function(){ return { tab: state.tab, paints: (document.getElementById('view') || {}).textContent.includes('Playback') }; })()`);
  ok(a12.tab === "settings" && a12.paints,
    "A12 the foot's Settings item fires the standing renderSettings — the Settings screen paints", JSON.stringify(a12));
  /* C10: the Settings screen — no section stands */
  await openMenu();
  const c10 = await menuRows();
  ok(JSON.stringify(labels(c10)) === JSON.stringify(["Prayers", "Conscience", "Formation", "Sacred Art", "Settings"])
    && c10.every((r) => !r.head) && c10.slice(0, 4).every((r) => r.state === "›") && c10[4].state === "Here",
    "C10 the Settings screen menu: no page group and NO standing group — all four sections stand as one-entry rows in tab order, Settings at the foot marked Here yet still acting", JSON.stringify(c10));
  await closeMenu();

  /* ---- A9 (plugin branch): a second page whose shell
     carries the Browser plugin — the adapter runs the
     standing openFullPage whole ---- */
  const page2 = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page2.on("pageerror", (e) => pageErrors.push("plugin page: " + String(e)));
  await page2.addInitScript(() => {
    window.Capacitor = { Plugins: { Browser: { open: function (o) { window.__browserOpen = o; return Promise.resolve(); } } } };
  });
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await page2.click('#tabbar [data-tab="podcasts"]');
  await page2.waitForSelector('[data-podseries="catholictv"]', { timeout: 6000 });
  await page2.evaluate(`document.querySelector('[data-podseries="catholictv"]').click()`);
  await page2.waitForSelector('[data-podvideo="vid1"]', { timeout: 6000 });
  await page2.click("#hdr-menu");
  await page2.waitForSelector(".anchmenu", { timeout: 5000 });
  await sleep(150);
  await page2.evaluate(`(function(){ var rows = document.querySelectorAll('.anchmenu [data-menuitem]'); for (var i = 0; i < rows.length; i++) { if (rows[i].textContent.includes('Full page on YouTube')) { rows[i].click(); return; } } })()`);
  await sleep(400);
  const a9b = await page2.evaluate(`window.__browserOpen || null`);
  ok(!!a9b && a9b.url === "https://www.youtube.com/@catholictv",
    "A9 with the Browser plugin standing, the adapter runs openFullPage whole — the plugin's open fires with the channel URL (the Custom Tab branch)", JSON.stringify(a9b));

  ok(pageErrors.length === 0, "Z zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v459: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
