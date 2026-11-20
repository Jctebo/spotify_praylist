#!/usr/bin/env node
// harness-v457 — Header merge, unified (Sample B) + the
// header hamburger (approved To Ship, package 31 record 22:
// D1 A · D2 A · D3 A · D4 A, with Amendment 1 — the pages
// menu pill stands right-aligned and compact in the header
// on all pages — and Amendment 2 — the Conscience pages-
// menu labels read Exam · Confess · Direction). Measured:
// (1) the two-row header in the color of the day on every
// tab and page: row 1 = logo · the wordmark as a small caps
// label · the DAY prominent · the menu act alone at the
// right (the gear stands nowhere); row 2 = title · date ·
// the compact pill at the right · the home's act; pushed
// pages carry their back in row 2 beside the title (the
// v447/v448 bar folds in — its hosts and dress stand
// nowhere; every data-barblock reader re-pointed to the
// row); the header alone is frozen, the pill inside it
// never scrolls away; (2) the menu = navigation only (the
// Go to groups: the day's blocks + Intentions · the
// Conscience sides in the short labels · the Formation
// series · the Sacred Art sides; the standing place marked
// Here and inert) + the Settings entry (D2: the gear's
// heir — fires the standing renderSettings); (3) D3: from
// applyLiturgical, the computed --bar-solid goes over the
// standing OraDayBridge as setStatusBarColor, guarded (the
// shell's paint is the APK's leg — not measured here; the
// bridge is stubbed and the CALL is what is proven).
// Mold: harness-v439/v455's whole-client boot (the real
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
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v457 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v455-ship";
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
    "ST1 the worker-source diff vs the v455-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
  ok(SHELL.includes('id="hdr-menu"') && SHELL.includes('id="hdrrow2"') && SHELL.includes('class="hdr-row1"')
    && !UI.includes("gearbtn") && !CLIENT.includes("gearbtn"),
    "ST2 the shell carries the two-row header (row 1 + #hdrrow2) with the menu act; the gear stands nowhere in the shell, the styles, or the script");
  ok(!CLIENT.includes("pushbar") && !CLIENT.includes("consbar") && !CLIENT.includes("iosbar") && !CLIENT.includes("iosBar")
    && !UI.includes("iosbar") && !UI.includes("pushbar") && !UI.includes("consbar"),
    "ST3 the v447/v448 bar stands nowhere: no bar hosts, no bar builder, no bar dress in the served styles or the script");
  const al = extractFn(CLIENT, "applyLiturgical"), pbc = extractFn(CLIENT, "pushStatusBarColor");
  ok(al.includes("pushStatusBarColor()") && pbc.includes("oraBridgePlugin()") && pbc.includes("setStatusBarColor")
    && pbc.includes("getPropertyValue('--bar-solid')"),
    "ST4 D3: applyLiturgical (the one theme apply point) calls pushStatusBarColor, which reads the computed --bar-solid and pushes it over the guarded OraDayBridge");
  ok(CLIENT.includes("'Spiritual Direction', 'Direction'") && CLIENT.includes("'Examination', 'Exam'") && CLIENT.includes("'Confession', 'Confess'")
    && extractFn(CLIENT, "paintSideToggle").includes("segtoggle pill") && extractFn(CLIENT, "paintSideToggle").includes("s[2] || s[1]"),
    "ST5 Amendment 2 + 1: the Conscience sides carry the short labels (Exam/Confess/Direction) and the pages menu paints in the compact pill form, reading the short label where one stands");
  ok(CLIENT.includes("getElementById('hdrrow2')") && CLIENT.includes("'#hdrrow2 [data-blockmenu]'")
    && extractFn(CLIENT, "paintPrayersBar").includes("hdrRow2()") && extractFn(CLIENT, "paintPrayersBar").includes("paintRow2Home('prayers')"),
    "ST6 every barblock reader is re-pointed at the row: the settlement inserter + the Play All scan read #hdrrow2, the block menu wiring reads #hdrrow2, paintPrayersBar seats in the row and repaints the home row on null");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v457-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "ST7 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v455-1";'),
    "ST8 (housekeeping): the SW pin stands at ora-pro-nobis-v455-1 (Ship moves it)");
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
  { series: "catechism", title: "Catechism in a Year", kind: "audio", available: true, listenedCount: 0, total: 369, currentLabel: "Day 1", showImageUrl: null },
  { series: "bible", title: "Bible in a Year", kind: "audio", available: true, listenedCount: 0, total: 372, currentLabel: "Day 1", showImageUrl: null },
  { series: "rosary", title: "Rosary in a Year", kind: "audio", available: true, listenedCount: 0, total: 371, currentLabel: "Day 1", showImageUrl: null },
  { series: "catholictv", title: "CatholicTV", kind: "video", available: true, latestLabel: "Nov 15", showImageUrl: null },
  { series: "the-ai-signal", title: "The AI Signal", kind: "own", available: true, currentLabel: "AI Signal Nov 15", showImageUrl: "/logo.png" },
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
  { id: 2, text: "For a retired intention", priority: "L", status: "retired", created_at: "2026-10-01", drawnCount: 0 },
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
  if (p.indexOf('/api/player/podcasts?series=') === 0) return J({ series: 'x', kind: 'audio', title: 'Series', available: false, entries: [] });
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
  const menuHeads = () => ev(`Array.prototype.map.call(document.querySelectorAll('.anchmenu .menuhead'), function (r) { return r.textContent.trim(); })`);
  const menuRows = () => ev(`Array.prototype.map.call(document.querySelectorAll('.anchmenu button[data-menuitem]'), function (r) {
    var st = r.querySelector('[data-menustate]');
    var g = r.querySelector('.grow');
    return { label: g ? g.textContent.trim() : r.textContent.trim(), state: st ? st.textContent : null };
  })`);
  const openHeaderMenu = async () => { await page.click("#hdr-menu"); await page.waitForSelector(".anchmenu", { timeout: 5000 }); await sleep(200); };
  const closeMenu = async () => { await ev(`(function(){ var c = document.querySelector('.menucatcher'); if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !document.querySelector('.anchmenu'); })()`); await sleep(150); };
  const row2 = () => ev(`(function(){
    var h = document.getElementById('hdrrow2');
    var t = document.getElementById('hdr2-title');
    var pill = document.getElementById('sidetoggle');
    return { title: t ? t.textContent.trim() : null, barblock: h ? h.getAttribute('data-barblock') : null,
      pill: pill ? Array.prototype.map.call(pill.querySelectorAll('[data-side]'), function (b) { return { side: b.getAttribute('data-side'), text: b.textContent.trim(), active: b.classList.contains('active') }; }) : null,
      pillInHeader: !!(pill && document.getElementById('brandbar').contains(pill)) };
  })()`);
  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);

  /* ---- B1: the boot home — the two-row header in the day's color ---- */
  const b1 = await ev(`(function(){
    var r2 = document.getElementById('hdrrow2').getBoundingClientRect();
    var pill = document.getElementById('sidetoggle');
    var pr = pill ? pill.getBoundingClientRect() : null;
    var sort = document.getElementById('sort-btn');
    return { lit: document.documentElement.getAttribute('data-lit'),
      litday: document.getElementById('litday').textContent,
      menu: !!document.getElementById('hdr-menu'), gear: !!document.getElementById('gearbtn'),
      date: (document.querySelector('.hdr2-date') || {}).textContent || null,
      pillRight: pr ? (r2.right - pr.right) : null, pillCenter: pr ? (pr.left + pr.width / 2) : null, rowMid: r2.left + r2.width / 2,
      sortInRow: !!(sort && document.getElementById('hdrrow2').contains(sort)) };
  })()`);
  const r2a = await row2();
  ok(b1.lit === "green" && b1.litday === "33rd Sunday in Ordinary Time" && b1.menu && !b1.gear
    && r2a.title === "Prayers" && b1.date && b1.date.includes("Nov 15, 2026")
    && r2a.pill && JSON.stringify(r2a.pill.map(function (p) { return p.side; })) === JSON.stringify(["prayers", "intentions"]) && r2a.pill[0].active
    && r2a.pillInHeader && b1.pillCenter > b1.rowMid && b1.sortInRow,
    "B1 boot: data-lit=green, row 1 carries the DAY prominent + the menu act alone (no gear); row 2 = Prayers · the short date · the pill (Prayers|Intentions, standing side active) in the header's right half · the Sort act in the row", JSON.stringify({ b1, r2a }));

  /* ---- B2: the pill switches sides from inside the header ---- */
  await page.click('#sidetoggle [data-side="intentions"]');
  await page.waitForSelector("#int-fab", { timeout: 6000 });
  await sleep(300);
  const r2b = await row2();
  const b2 = await ev(`(function(){
    var rows = Array.prototype.map.call(document.querySelectorAll('#view .trow, #view .card'), function (c) { return c.textContent; }).join(' ');
    return { intMenuInRow: !!document.querySelector('#hdrrow2 #int-menu'), bodyHas: rows.includes('For the family') };
  })()`);
  ok(r2b.title === "Intentions" && r2b.pill && r2b.pill[1].active && b2.intMenuInRow && b2.bodyHas,
    "B2 the header pill switches Prayers -> Intentions: row 2 re-reads Intentions, the pill's standing side follows, the heading menu act stands in the row, the pool paints", JSON.stringify({ r2b, b2 }));
  await page.click("#hdrrow2 #int-menu");
  await page.waitForSelector(".anchmenu", { timeout: 5000 });
  await sleep(150);
  const intMenu = await menuRows();
  ok(JSON.stringify(intMenu.map(function (r) { return r.label; })) === JSON.stringify(["Redraw", "Add intention"]),
    "B2 the Intentions heading menu opens from the row (Redraw · Add intention)", JSON.stringify(intMenu));
  await closeMenu();
  await page.click('#sidetoggle [data-side="prayers"]');
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);

  /* ---- B3: the header is the frozen layer; the pill never scrolls away ---- */
  await page.setViewportSize({ width: 412, height: 560 });
  const b3 = await ev(`(function(){
    document.getElementById('view').style.minHeight = '1600px';
    window.scrollTo(0, 500);
    var bb = document.getElementById('brandbar').getBoundingClientRect();
    var pill = document.getElementById('sidetoggle').getBoundingClientRect();
    return { y: window.scrollY, barTop: bb.top, pillTop: pill.top, pillBottom: pill.bottom, barBottom: bb.bottom };
  })()`);
  ok(b3.y > 0 && b3.barTop === 0 && b3.pillTop >= 0 && b3.pillBottom <= b3.barBottom + 1,
    "B3 scrolled: the brand bar's top stays at 0 and the pages-menu pill stands inside the frozen header (it never scrolls away)", JSON.stringify(b3));
  await ev(`document.getElementById('view').style.minHeight = ''; window.scrollTo(0, 0);`);
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(200);

  /* ---- B4: a pushed block page — the back stands in row 2 ---- */
  await page.click('[data-openblock="Morning"]');
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(300);
  const r2c = await row2();
  const b4 = await ev(`(function(){
    var back = document.querySelector('#hdrrow2 [data-back]');
    var host = document.getElementById('sidehost');
    var first = host ? host.firstElementChild : null;
    return { backName: back ? back.textContent.trim() : null,
      disc: !!document.querySelector('#hdrrow2 [data-queue="Morning"]'), menu: !!document.querySelector('#hdrrow2 [data-blockmenu]'),
      firstCls: first ? first.className : null };
  })()`);
  ok(r2c.barblock === "Morning" && r2c.title === "Morning" && b4.backName.includes("Prayers") && b4.disc && b4.menu && b4.firstCls === "blockpage-meta",
    "B4 the block page's bar stands in row 2: back (Prayers) beside the title, Play All + the menu act at the right, data-barblock=Morning on the row; the body opens on the plain meta line", JSON.stringify({ r2c, b4 }));
  await page.click("#hdrrow2 [data-blockmenu]");
  await page.waitForSelector(".anchmenu", { timeout: 5000 });
  await sleep(150);
  const goRows = await menuRows();
  const goMorning = goRows.filter(function (r) { return r.label === "Morning"; })[0];
  const goMidday = goRows.filter(function (r) { return r.label === "Midday"; })[0];
  ok(goMorning && goMorning.state === "Here" && goMidday && goMidday.state === null
    && goRows.some(function (r) { return r.label === "Intentions"; }),
    "B4 the block page's Go to group stands in its menu (v455 D3): the standing block marked Here, the others plain, Intentions last", JSON.stringify(goRows));
  await closeMenu();
  await page.click("#hdrrow2 [data-back]");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);
  const r2d = await row2();
  ok(r2d.title === "Prayers" && r2d.barblock === null && r2d.pill,
    "B4 the row-2 back returns home: the home row stands again (title + pill, no block key)", JSON.stringify(r2d));

  /* ---- B5: the header menu — groups, the Here mark, jumps ---- */
  await openHeaderMenu();
  const heads = await menuHeads();
  const rows = await menuRows();
  const labels = rows.map(function (r) { return r.label; });
  ok(JSON.stringify(heads) === JSON.stringify(["Prayers", "Conscience", "Formation", "Sacred Art"])
    && ["Morning", "Midday", "Evening", "Intentions", "Exam", "Confess", "Direction", "Catechism in a Year", "Bible in a Year", "Rosary in a Year", "CatholicTV", "The AI Signal", "Phone", "Watch", "Settings"].every(function (l) { return labels.includes(l); })
    && rows.every(function (r) { return r.state === null; }),
    "B5 the header menu opens with the four Go to groups (blocks + Intentions · Exam/Confess/Direction · the five series · Phone/Watch) + Settings; from the home nothing is marked Here", JSON.stringify({ heads, labels }));
  await ev(`Array.prototype.slice.call(document.querySelectorAll('.anchmenu button[data-menuitem]')).filter(function (b) { return b.querySelector('.grow') && b.querySelector('.grow').textContent.trim() === 'Midday'; })[0].click()`);
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(300);
  const r2e = await row2();
  const menuGone = await ev(`!document.querySelector('.anchmenu')`);
  ok(r2e.title === "Midday" && menuGone,
    "B5 a menu jump lands and closes: Midday's block page stands, its title in row 2", JSON.stringify(r2e));
  await openHeaderMenu();
  const rows2 = await menuRows();
  const midRow = rows2.filter(function (r) { return r.label === "Midday"; })[0];
  ok(midRow && midRow.state === "Here",
    "B5 the standing place is marked Here in the menu", JSON.stringify(midRow));
  await ev(`Array.prototype.slice.call(document.querySelectorAll('.anchmenu button[data-menuitem]')).filter(function (b) { return b.querySelector('.grow') && b.querySelector('.grow').textContent.trim() === 'Exam'; })[0].click()`);
  await page.waitForSelector("#pinpad", { timeout: 6000 });
  await sleep(200);
  const r2f = await row2();
  ok(r2f.title === "Conscience" && !r2f.pill,
    "B5 the Conscience jump lands on the PIN gate: row 2 stands title-only (no foreign pill strands during the gate)", JSON.stringify(r2f));
  for (const d of ["1", "2", "3", "4"]) await page.click('[data-pinkey="' + d + '"]');
  await page.click("#pin-unlock");
  await page.waitForSelector("#sidetoggle", { timeout: 6000 });
  await sleep(400);
  const r2g = await row2();
  ok(r2g.title === "Examination" && r2g.pill && JSON.stringify(r2g.pill.map(function (p) { return p.text; })) === JSON.stringify(["Exam", "Confess", "Direction"]) && r2g.pill[0].active,
    "B5 past the gate the Conscience home stands: row 2 title Examination (full name) + the pill in the Amendment 2 short labels", JSON.stringify(r2g));
  await page.click('#sidetoggle [data-side="confession"]');
  await sleep(600);
  const r2h = await row2();
  const confBody = await ev(`document.getElementById('view').textContent.includes('Make the sign of the cross.')`);
  ok(r2h.title === "Confession" && r2h.pill && r2h.pill[1].active && confBody,
    "B5 the pill switches to Confession from the header: the title follows in full, the guide paints", JSON.stringify(r2h));

  /* ---- B6: Settings stands in the menu (D2) and opens the standing screen ---- */
  await openHeaderMenu();
  await ev(`Array.prototype.slice.call(document.querySelectorAll('.anchmenu button[data-menuitem]')).filter(function (b) { return b.querySelector('.grow') && b.querySelector('.grow').textContent.trim() === 'Settings'; })[0].click()`);
  await page.waitForSelector("#set-autoplay", { timeout: 6000 });
  await sleep(300);
  const b6 = await ev(`(function(){
    var h = document.getElementById('hdrrow2');
    return { back: !!h.querySelector('[data-settingsback]'), title: document.getElementById('hdr2-title').textContent,
      sections: document.getElementById('view').textContent.includes('PLAYBACK') };
  })()`);
  ok(b6.back && b6.title === "Settings" && b6.sections,
    "B6 the menu's Settings entry opens the standing Settings screen: its back + title stand in row 2, the contents untouched", JSON.stringify(b6));
  await page.click("#hdrrow2 [data-settingsback]");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  await sleep(300);
  const r2i = await row2();
  ok(r2i.title === "Prayers",
    "B6 the row-2 back returns to the Prayers home", JSON.stringify(r2i));

  /* ---- B7: Formation — the index row + a series page's row-2 back ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 6000 });
  await sleep(300);
  const b7 = await ev(`(function(){
    return { offlineInRow: !!document.querySelector('#hdrrow2 #pod-offline-btn'),
      viewH1: !!document.querySelector('#view h1') };
  })()`);
  const r2j = await row2();
  ok(r2j.title === "Formation" && b7.offlineInRow && !b7.viewH1,
    "B7 the Formation index: row 2 carries the title + the offline act; no in-view head stands", JSON.stringify({ r2j, b7 }));
  await page.click('[data-podseries="bible"]');
  await page.waitForSelector("#hdrrow2 [data-podback]", { timeout: 6000 });
  await sleep(400);
  const r2k = await row2();
  ok(r2k.title === "Bible in a Year",
    "B7 a series page: its back + title stand in row 2", JSON.stringify(r2k));
  await page.click("#hdrrow2 [data-podback]");
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 6000 });
  await sleep(300);
  const r2l = await row2();
  ok(r2l.title === "Formation",
    "B7 the row-2 back returns to the Formation index row", JSON.stringify(r2l));

  /* ---- B8: Sacred Art on the web — title-only row, the unavailable state ---- */
  await page.click('#tabbar [data-tab="wallpaper"]');
  await sleep(600);
  const r2m = await row2();
  const b8 = await ev(`document.getElementById('view').textContent.includes('Sacred Art controls live in the app')`);
  ok(r2m.title === "Sacred Art" && !r2m.pill && b8,
    "B8 Sacred Art (web): row 2 stands title-only, the unavailable state paints, no pill strands", JSON.stringify(r2m));

  /* ---- B9: D3 — the bridge call fires with the day's solid ---- */
  const b9 = await ev(`(function(){
    window.__sbc = [];
    window.Capacitor = { Plugins: { OraDayBridge: {
      setStatusBarColor: function (o) { window.__sbc.push(o.color); return Promise.resolve(); },
      setDaySnapshot: function () { return Promise.resolve(); }
    } } };
    applyLiturgical({ liturgicalDay: { name: 'A Red Day', color: 'red' }, dateLabel: 'x' });
    applyLiturgical({ liturgicalDay: null, dateLabel: 'A plain day' });
    return { calls: window.__sbc, lit: document.documentElement.getAttribute('data-lit') };
  })()`);
  ok(JSON.stringify(b9.calls) === JSON.stringify(["#5d1616", "#16283f"]) && b9.lit === null,
    "B9 D3: applyLiturgical pushes the computed solid over the bridge — the red theme's #5d1616, the unthemed day's default #16283f (the shell's paint itself is the APK's leg, not measured here)", JSON.stringify(b9));

  /* ---- B10: 360px — the header stands, no horizontal overflow ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 740 } });
  page2.on("pageerror", (e) => pageErrors.push(String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(300);
  const b10 = await page2.evaluate(`(function(){
    var pill = document.getElementById('sidetoggle');
    return { sw: document.documentElement.scrollWidth, pillW: pill ? pill.offsetWidth : 0,
      menu: !!document.getElementById('hdr-menu'), title: document.getElementById('hdr2-title').textContent };
  })()`);
  ok(b10.sw <= 361 && b10.pillW > 0 && b10.menu && b10.title === "Prayers",
    "B10 at 360px the two-row header stands whole (pill visible, menu act stands) with no horizontal overflow", JSON.stringify(b10));

  ok(pageErrors.length === 0, "Z zero page errors across every leg", pageErrors.join(" | "));
} finally {
  await browser.close();
  server.close();
}
console.log(`\n# harness-v457: ${n - fails}/${n} ok`);
process.exit(fails ? 1 : 0);
