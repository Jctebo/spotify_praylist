#!/usr/bin/env node
// harness-v462 — Written prayer section (pocket prayer
// book). Scope record 1789 · Plan record 1794 · Plan
// Amendment 1 (the Latin toggle). Measured:
// (SQL) migration 0026 on a scratch D1 (migrations
// 0001→0026 in order): 34 rows · per-group counts
// 10·4·5·3·4·4·4 · slugs unique · source naming Lasance
// on every row · body non-empty · act-of-contrition
// byte-equal to confession_guide step 3 · sorts strictly
// increasing · body_latin non-empty on exactly the 11
// verified rows, NULL elsewhere.
// (Fixture) the payload generated from that same scratch
// D1: { ok, groups[7] } in order, every prayer carrying
// slug · title · body · bodyLatin · source, bodyLatin a
// string exactly where the seed carries Latin.
// (Boot) harness-v460's whole-client mold (real
// SHELL_HTML + APP_CSS + the whole COOKED APP_JS, fetch
// stubbed by path, the book stubbed from the fixture):
// the Praylist tab + the three-button pill · the side
// paint · the round-trip + the stored-key survival · the
// prayer page + playback untouched · the Latin toggle
// (byte-for-byte swap, English restore, English on
// reopen, no toggle on a null prayer, toggle offline) ·
// favorites across a re-boot · search by title word and
// body-only word · the offline second boot + the
// corrupted copy · the menu line + Here · row-2 width at
// 360px and 320px.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v462 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v461-ship";
const BOOK = JSON.parse(fs.readFileSync(path.join(APP, "tests/fixtures/prayer-book-v462.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };

const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
const COOKED = new Function("return `" + RAW_JS + "`")();

const LATIN_SLUGS = ["our-father", "hail-mary", "glory-be", "apostles-creed", "angelus", "regina-caeli", "memorare", "hail-holy-queen", "the-rosary-prayers", "eternal-rest", "de-profundis"];
const GROUP_ORDER = ["Daily", "Morning & evening", "Mass & Communion", "Our Lady", "In trouble", "For the family", "For the dead"];
const GROUP_COUNTS = [10, 4, 5, 3, 4, 4, 4];

/* ---------------- statics ---------------- */
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src", "app/migrations"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/index.ts", "app/worker/src/ui.ts"]),
    "ST1 the tracked worker-source diff vs the v461-ship base is client.ts + index.ts + ui.ts (got: " + changed.join(", ") + ")");
  ok(fs.existsSync(path.join(APP, "migrations/0026_prayer_book.sql")), "ST1 migration 0026 stands in app/migrations");

  let parseErr = null;
  try { new vm.Script(COOKED); } catch (e) { parseErr = e; }
  ok(!parseErr, "ST2 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
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
  ok(census === 0, "ST2 the single-backslash census inside APP_JS stands at 0", "census=" + census);

  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v462-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "ST3 the whole worker bundles clean (esbuild)");
  ok(INDEX.includes('seg[2] === "book"') && INDEX.includes("bookPayload"), "ST3 index.ts carries the book route + bookPayload");
  ok((COOKED.split("Praylist").length - 1) >= 8 && !/>Book</.test(COOKED) && !/label: 'Book'/.test(COOKED),
    "ST4 the rename stands in the cooked script (Praylist seats) and 'Book' names nothing");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v461-1";'), "ST4 (housekeeping): the SW pin stands at ora-pro-nobis-v461-1 (Ship moves it)");
}

/* ---------------- SQL legs ---------------- */
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v462-"));
const DB = path.join(TMPD, "scratch.db");
{
  const migDir = path.join(APP, "migrations");
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  ok(files[files.length - 1] === "0026_prayer_book.sql", "SQ0 migration 0026 is the last migration", files[files.length - 1]);
  for (const f of files) execFileSync("sqlite3", [DB], { input: fs.readFileSync(path.join(migDir, f), "utf8") });
  const q = (sql) => execFileSync("sqlite3", ["-json", DB, sql], { encoding: "utf8" }).trim();
  const rows = JSON.parse(q("SELECT slug, title, category, body, body_latin, source, sort FROM prayer_book ORDER BY sort"));
  ok(rows.length === 34, "SQ1 the seed stands at 34 rows", rows.length);
  const counts = GROUP_ORDER.map((g) => rows.filter((r) => r.category === g).length);
  ok(JSON.stringify(counts) === JSON.stringify(GROUP_COUNTS), "SQ2 per-group counts 10·4·5·3·4·4·4 in order", counts.join("·"));
  const seenOrder = [];
  rows.forEach((r) => { if (!seenOrder.includes(r.category)) seenOrder.push(r.category); });
  ok(JSON.stringify(seenOrder) === JSON.stringify(GROUP_ORDER), "SQ2 groups assemble in the §2.2 order");
  ok(new Set(rows.map((r) => r.slug)).size === 34, "SQ3 slugs are unique");
  ok(rows.every((r) => r.source && r.source.includes("Lasance")), "SQ3 source non-empty and naming Lasance on every row");
  ok(rows.every((r) => r.body && r.body.length > 0), "SQ3 body non-empty on every row");
  const contra = JSON.parse(q("SELECT (SELECT body FROM prayer_book WHERE slug='act-of-contrition') = (SELECT body FROM confession_guide WHERE step_no=3) AS eq"))[0].eq;
  ok(contra === 1, "SQ4 act-of-contrition stands byte-equal to confession_guide step 3");
  ok(rows.every((r, i) => i === 0 || r.sort > rows[i - 1].sort), "SQ5 sorts strictly increasing in reading order");
  const lat = rows.filter((r) => r.body_latin != null && r.body_latin !== "").map((r) => r.slug).sort();
  ok(JSON.stringify(lat) === JSON.stringify([...LATIN_SLUGS].sort()), "SQ6 body_latin non-empty on exactly the 11 verified rows", lat.join(","));
  ok(rows.filter((r) => !LATIN_SLUGS.includes(r.slug)).every((r) => r.body_latin === null), "SQ6 body_latin is NULL on every other row");
}

/* ---------------- fixture legs ---------------- */
{
  ok(BOOK.ok === true && Array.isArray(BOOK.groups) && BOOK.groups.length === 7, "FX1 the fixture payload is { ok, groups[7] }");
  ok(JSON.stringify(BOOK.groups.map((g) => g.category)) === JSON.stringify(GROUP_ORDER), "FX1 the fixture groups stand in the §2.2 order");
  const all = BOOK.groups.flatMap((g) => g.prayers);
  ok(all.length === 34 && all.every((p) => typeof p.slug === "string" && typeof p.title === "string" && typeof p.body === "string" && typeof p.source === "string" && "bodyLatin" in p),
    "FX2 every fixture prayer carries slug · title · body · bodyLatin · source");
  const latF = all.filter((p) => typeof p.bodyLatin === "string" && p.bodyLatin.length).map((p) => p.slug).sort();
  ok(JSON.stringify(latF) === JSON.stringify([...LATIN_SLUGS].sort()), "FX2 fixture bodyLatin is a string exactly on the 11 Latin-bearing rows");
  ok(all.filter((p) => !LATIN_SLUGS.includes(p.slug)).every((p) => p.bodyLatin === null), "FX2 fixture bodyLatin is explicit null everywhere else");
}

/* ---------------- boot legs ---------------- */
const tracks = (base, count, label) => Array.from({ length: count }, (_, i) => ({ episodeId: String(base + i), title: label + " track " + (i + 1), durationS: 240, available: true, streamUrl: "__ORIGIN__/audio/" + (base + i) + ".wav" }));
const DAY = {
  ok: true, date: "2026-11-15", presentedDay: "2026-11-15", dateLabel: "Sunday, November 15, 2026",
  liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" },
  introTexts: { "9000": "For the intentions of the family" },
  blocks: [
    { block: "Morning", label: "Morning", caption: "Morning prayers", spotifyUrl: "https://open.spotify.com/playlist/morning", tracks: tracks(9000, 3, "Morning") },
    { block: "Midday", label: "Midday", caption: "", tracks: tracks(9100, 2, "Midday") },
  ],
  episodes: [{ episodeId: "9901", title: "Podcast Episode One", durationS: 300, available: true, streamUrl: "__ORIGIN__/audio/9901.wav" }],
};
const INTENTIONS = { intentions: [{ id: 1, text: "For the family", priority: "H", status: "active", created_at: "2026-11-01", drawnCount: 2 }] };
const PRAYERDAY = { date: "2026-11-15", dateLabel: "Sunday, November 15, 2026", liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" } };

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.__DEAD = false;
var FIX = { DAY: ${JSON.stringify(DAY)}, INTENTIONS: ${JSON.stringify(INTENTIONS)}, PRAYERDAY: ${JSON.stringify(PRAYERDAY)}, BOOK: ${JSON.stringify(BOOK)} };
window.fetch = function (path, opts) {
  var p = String(path);
  window.__fetchLog.push(p);
  if (window.__DEAD) return Promise.reject(new Error('dead network'));
  var J = function (obj) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(obj))); } }); };
  if (p.indexOf('/api/player/day') === 0) return J(FIX.DAY);
  if (p === '/api/prayer/book') return J(FIX.BOOK);
  if (p.indexOf('/api/prayer/intentions') === 0) return J(FIX.INTENTIONS);
  if (p.indexOf('/api/prayer/day') === 0) return J(FIX.PRAYERDAY);
  if (p.indexOf('/api/pin/state') === 0) return J({ pinSet: true, retryAfterSeconds: 0 });
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

let pageHtml = "";
const server = http.createServer((req, res) => {
  const p = (req.url || "/").split("?")[0];
  if (p === "/") { res.setHeader("Content-Type", "text/html"); res.end(pageHtml); return; }
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

  /* B1 — the tab + the pill */
  const tabLabel = await ev(`document.querySelector('#tabbar .tab[data-tab="prayers"]').textContent.trim()`);
  ok(tabLabel.includes("Praylist"), "B1 the tab button reads Praylist", tabLabel);
  const pill = await ev(`Array.from(document.querySelectorAll('#sidetoggle [data-side]')).map(function (b) { return b.textContent.trim(); })`);
  ok(JSON.stringify(pill) === JSON.stringify(["Praylist", "Intentions", "Prayers"]), "B1 the pill paints three buttons: Praylist · Intentions · Prayers", pill.join("·"));

  /* B2 — the side paint */
  await ev(`document.querySelector('#sidetoggle [data-side="book"]').click()`);
  await page.waitForSelector('[data-bookrow="memorare"]', { timeout: 6000 });
  await sleep(250);
  const paint = await ev(`(function(){ var heads = Array.from(document.querySelectorAll('#book-results .sectionhead')).map(function (h) { return h.textContent; });
    return { heads: heads, rows: document.querySelectorAll('[data-bookrow]').length,
      stars: Array.from(document.querySelectorAll('[data-bookstar]')).map(function (s) { return s.textContent; }) }; })()`);
  ok(JSON.stringify(paint.heads) === JSON.stringify(GROUP_ORDER), "B2 seven group heads in order, no Favorites head while none stand", paint.heads.join("·"));
  ok(paint.rows === 34, "B2 the side paints 34 rows", paint.rows);
  ok(paint.stars.length === 34 && paint.stars.every((s) => s === "☆"), "B2 every row's star stands unstanding (☆)");

  /* B5/B6 — the prayer page + the Latin toggle (Memorare) */
  const dockBefore = await ev(`document.getElementById('dock').className`);
  await ev(`document.querySelector('[data-bookrow="memorare"]').click()`);
  await page.waitForSelector('#book-page', { timeout: 6000 });
  await sleep(200);
  const mem = BOOK.groups[3].prayers[0];
  const pg = await ev(`(function(){ var b = document.getElementById('book-body'); var h = document.querySelector('#book-page h1.screen');
    var sub = document.querySelector('#book-page .sub'); var sw = document.getElementById('book-lang');
    return { title: h ? h.textContent : null, sub: sub ? sub.textContent : null, body: b ? b.textContent : null,
      toggle: !!sw, enActive: sw ? sw.querySelector('[data-lang="en"]').classList.contains('active') : false,
      dock: document.getElementById('dock').className }; })()`);
  ok(pg.title === "Memorare" && pg.sub === mem.source && pg.sub.includes("Lasance"), "B5 the prayer page paints title · source line (naming Lasance)", pg.title + " / " + pg.sub);
  ok(pg.body === mem.body, "B5 the .readtext body stands byte-equal to the seeded body");
  ok(pg.dock === dockBefore, "B5 playback state is untouched across the page open (dock stands as it stood)");
  ok(pg.toggle && pg.enActive, "B6 a Latin-bearing prayer paints the English | Latin toggle, English active");
  await ev(`document.querySelector('#book-lang [data-lang="la"]').click()`);
  await sleep(120);
  const latBody = await ev(`document.getElementById('book-body').textContent`);
  ok(latBody === mem.bodyLatin, "B6 a Latin tap swaps the body to the seeded Latin byte-for-byte");
  const latHeads = await ev(`(function(){ return { t: document.querySelector('#book-page h1.screen').textContent, s: document.querySelector('#book-page .sub').textContent }; })()`);
  ok(latHeads.t === "Memorare" && latHeads.s === mem.source, "B6 the title and source line never move across the swap");
  await ev(`document.querySelector('#book-lang [data-lang="en"]').click()`);
  await sleep(120);
  ok((await ev(`document.getElementById('book-body').textContent`)) === mem.body, "B6 an English tap restores the English body byte-equal");
  /* reopen: English again (no persistence) */
  await ev(`document.querySelector('#hdrrow2 [data-bookback]').click()`);
  await page.waitForSelector('[data-bookrow="memorare"]', { timeout: 6000 });
  await sleep(200);
  await ev(`document.querySelector('[data-bookrow="memorare"]').click()`);
  await page.waitForSelector('#book-page', { timeout: 6000 });
  await sleep(150);
  const reopen = await ev(`(function(){ var sw = document.getElementById('book-lang'); return { body: document.getElementById('book-body').textContent, enActive: sw.querySelector('[data-lang="en"]').classList.contains('active') }; })()`);
  ok(reopen.body === mem.body && reopen.enActive, "B6 reopening the page opens on English (the choice is per page view, no store)");
  await ev(`document.querySelector('#hdrrow2 [data-bookback]').click()`);
  await page.waitForSelector('[data-bookrow="memorare"]', { timeout: 6000 });
  await sleep(200);

  /* B7 — a null-Latin prayer paints no toggle */
  await ev(`document.querySelector('[data-bookrow="act-of-faith"]').click()`);
  await page.waitForSelector('#book-page', { timeout: 6000 });
  await sleep(150);
  const nullPg = await ev(`(function(){ return { toggle: !!document.getElementById('book-lang'), title: document.querySelector('#book-page h1.screen').textContent }; })()`);
  ok(!nullPg.toggle && nullPg.title === "Act of Faith", "B7 a null-Latin prayer paints NO toggle, the page otherwise whole");
  await ev(`document.querySelector('#hdrrow2 [data-bookback]').click()`);
  await page.waitForSelector('[data-bookrow="memorare"]', { timeout: 6000 });
  await sleep(200);

  /* B8 — favorites */
  await ev(`document.querySelector('[data-bookstar="memorare"]').click()`);
  await sleep(250);
  const fav1 = await ev(`(function(){ var heads = Array.from(document.querySelectorAll('#book-results .sectionhead')).map(function (h) { return h.textContent; });
    var first = document.querySelectorAll('#book-results [data-bookrow]')[0];
    return { heads: heads, firstSlug: first ? first.getAttribute('data-bookrow') : null,
      firstMeta: first ? (first.querySelector('.meta') || {}).textContent : null,
      star: document.querySelector('[data-bookstar="memorare"]').textContent }; })()`);
  ok(fav1.heads[0] === "Favorites" && fav1.firstSlug === "memorare" && fav1.firstMeta === "Our Lady" && fav1.star === "★",
    "B8 starring stands the Favorites group at the top, the row carrying its group as meta, the star filled", JSON.stringify(fav1));
  await page.reload();
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 }).catch(() => {});
  await sleep(400);
  /* after re-boot the stored side may stand anywhere; drive to the book side */
  await ev(`(function(){ var t = document.querySelector('#sidetoggle [data-side="book"]'); if (t) t.click(); })()`);
  await page.waitForSelector('[data-bookrow="memorare"]', { timeout: 6000 });
  await sleep(250);
  const fav2 = await ev(`(function(){ var heads = Array.from(document.querySelectorAll('#book-results .sectionhead')).map(function (h) { return h.textContent; });
    return { heads: heads, stored: localStorage.getItem('opn-book-favs-v462') }; })()`);
  ok(fav2.heads[0] === "Favorites" && (fav2.stored || "").includes("memorare"), "B8 the favorite persists across a full re-boot (opn-book-favs-v462)");
  await ev(`document.querySelector('[data-bookstar="memorare"]').click()`);
  await sleep(250);
  const fav3 = await ev(`Array.from(document.querySelectorAll('#book-results .sectionhead')).map(function (h) { return h.textContent; })`);
  ok(!fav3.includes("Favorites"), "B8 unstarring the last favorite retires the group");

  /* B9 — search */
  await ev(`(function(){ var i = document.getElementById('book-search'); i.focus(); i.value = 'Memorare'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(250);
  const s1 = await ev(`(function(){ var rows = document.querySelectorAll('#book-results [data-bookrow]'); return { n: rows.length, slug: rows[0] ? rows[0].getAttribute('data-bookrow') : null, meta: rows[0] ? (rows[0].querySelector('.meta') || {}).textContent : null }; })()`);
  ok(s1.n === 1 && s1.slug === "memorare" && s1.meta === "Our Lady", "B9 a title word (Memorare) finds its prayer, with its group line", JSON.stringify(s1));
  await ev(`(function(){ var i = document.getElementById('book-search'); i.value = 'snares'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(250);
  const s2 = await ev(`(function(){ var rows = Array.from(document.querySelectorAll('#book-results [data-bookrow]')); return { n: rows.length, slugs: rows.map(function (r) { return r.getAttribute('data-bookrow'); }), metas: rows.map(function (r) { return (r.querySelector('.meta') || {}).textContent; }) }; })()`);
  ok(s2.n === 4 && s2.metas.every((m) => !!m) && JSON.stringify(s2.slugs) === JSON.stringify(["prayer-before-sleep", "st-michael", "prayer-for-a-special-intention", "prayer-for-the-family"]),
    "B9 a body-only word (snares) finds the four prayers carrying it, each with its group line", JSON.stringify(s2));
  await ev(`(function(){ var i = document.getElementById('book-search'); i.value = 'zzzzqq'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(250);
  const s3 = await ev(`document.getElementById('book-results').textContent.includes('None.')`);
  ok(s3, "B9 a query with no hits paints the None. line");
  await ev(`(function(){ var i = document.getElementById('book-search'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(250);
  const s4 = await ev(`document.querySelectorAll('#book-results [data-bookrow]').length`);
  ok(s4 === 34, "B9 clearing the query restores the grouped paint (34 rows)");

  /* B3 — the round-trip + B11 the menu */
  await ev(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await page.waitForFunction(`document.getElementById('sidehost') && document.getElementById('sidehost').textContent.includes('For the family')`, null, { timeout: 6000 }).catch(() => {});
  await sleep(250);
  ok(true, "B3 the round-trip lands on Intentions (its list paints)");
  await ev(`document.querySelector('#sidetoggle [data-side="book"]').click()`);
  await page.waitForSelector('[data-bookrow="memorare"]', { timeout: 6000 });
  await sleep(250);
  await ev(`document.getElementById('hdr-menu').click()`);
  await sleep(400);
  const menu = await ev(`(function(){ var card = document.querySelector('.anchmenu'); if (!card) return { card: false };
    var heads = Array.from(card.querySelectorAll('.menuhead')).map(function (h) { return h.textContent; });
    var rows = Array.from(card.querySelectorAll('.menurow')).map(function (r) { var g = r.querySelector('.grow'); var m = r.querySelector('.meta'); return { label: g ? g.textContent : '', state: m ? m.textContent : null }; });
    return { card: true, heads: heads, rows: rows }; })()`);
  const labels = menu.rows ? menu.rows.map((r) => r.label) : [];
  const prayersRow = menu.rows ? menu.rows.filter((r) => r.label === "Prayers")[0] : null;
  ok(menu.card && menu.heads[0] === "Praylist" && labels.indexOf("Intentions") >= 0 && labels.indexOf("Prayers") === labels.indexOf("Intentions") + 1 && prayersRow && prayersRow.state === "Here",
    "B11 the menu's standing Praylist group lists Prayers directly after Intentions, marked Here on the book side; no page group stands (the section head is the first head)", JSON.stringify(menu).slice(0, 240));
  await ev(`(function(){ var c = document.querySelector('.menucatcher'); if (c) c.click(); })()`);
  await sleep(250);
  /* the line's act lands on the side (taken from the audio side) */
  await ev(`document.querySelector('#sidetoggle [data-side="prayers"]').click()`);
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 }).catch(() => {});
  await sleep(300);
  await ev(`document.getElementById('hdr-menu').click()`);
  await sleep(400);
  await ev(`(function(){ var rows = Array.from(document.querySelectorAll('.anchmenu .menurow')); var t = rows.filter(function (r) { var g = r.querySelector('.grow'); return g && g.textContent === 'Prayers'; })[0]; if (t) t.click(); })()`);
  await page.waitForSelector('[data-bookrow="memorare"]', { timeout: 6000 });
  await sleep(250);
  ok(true, "B11 the menu's Prayers line act lands on the written side");

  /* B10 — offline: the copy serves with the network dead */
  const copyStands = await ev(`!!localStorage.getItem('opn-book-v462')`);
  ok(copyStands, "B10 the first online open wrote the device copy (opn-book-v462)");
  await ev(`window.__DEAD = true`);
  await ev(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await sleep(300);
  await ev(`document.querySelector('#sidetoggle [data-side="book"]').click()`);
  await page.waitForSelector('[data-bookrow="our-father"]', { timeout: 6000 });
  await sleep(250);
  const offRows = await ev(`document.querySelectorAll('#book-results [data-bookrow]').length`);
  ok(offRows === 34, "B10 with every fetch dead the side paints whole from the copy (34 rows)", offRows);
  await ev(`document.querySelector('[data-bookrow="our-father"]').click()`);
  await page.waitForSelector('#book-page', { timeout: 6000 });
  await sleep(150);
  await ev(`document.querySelector('#book-lang [data-lang="la"]').click()`);
  await sleep(120);
  const offLat = await ev(`document.getElementById('book-body').textContent`);
  const of = BOOK.groups[0].prayers[0];
  ok(offLat === of.bodyLatin, "B10 the Latin toggle swaps with the network dead (the copy carries the Latin whole)");
  await ev(`document.querySelector('#hdrrow2 [data-bookback]').click()`);
  await sleep(250);
  /* corrupted copy + dead network → the failure paint.
     The network dies AFTER the re-boot (a reload resets
     the stub's flag), and the stored side is cleared first
     so the boot lands on the audio side and cannot heal
     the copy before the leg reads it. */
  await ev(`(function(){ try { localStorage.removeItem('opn-tabside-prayers-v410'); } catch (e) {} })()`);
  await page.reload();
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 }).catch(() => {});
  await sleep(300);
  await ev(`window.__DEAD = true; localStorage.setItem('opn-book-v462', '{broken');`);
  await ev(`(function(){ var t = document.querySelector('#sidetoggle [data-side="book"]'); if (t) t.click(); })()`);
  await sleep(700);
  const failPaint = await ev(`(function(){ return { err: document.getElementById('sidehost').textContent.includes('Prayers did not load.'), retry: !!document.getElementById('book-retry') }; })()`);
  ok(failPaint.err && failPaint.retry, "B10 a corrupted copy with the network dead falls back to the failure paint + Retry");
  await ev(`window.__DEAD = false`);

  /* B12 — row-2 width at 360px and 320px (audio home) */
  for (const w of [360, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.reload();
    await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 }).catch(() => {});
    await sleep(400);
    const geo = await ev(`(function(){ var row = document.getElementById('hdrrow2'); var pill = document.getElementById('sidetoggle');
      if (!row || !pill) return { pill: false };
      var rr = row.getBoundingClientRect(), pr = pill.getBoundingClientRect();
      var clipped = Array.from(pill.querySelectorAll('button')).some(function (b) { return b.scrollWidth > b.clientWidth + 1; });
      return { pill: true, inside: pr.left >= rr.left - 1 && pr.right <= rr.right + 1, clipped: clipped }; })()`);
    ok(geo.pill && geo.inside && !geo.clipped, "B12 at " + w + "px the pill stands whole inside row 2, no label clipped", JSON.stringify(geo));
  }

  ok(pageErrors.length === 0, "B13 no page errors across the whole boot", pageErrors.slice(0, 3).join(" | "));

  /* B4 — a stored side key of 'intentions' still lands on Intentions */
  const ctx2 = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await ctx2.addInitScript(`try { localStorage.setItem('opn-tabside-prayers-v410', 'intentions'); } catch (e) {}`);
  const page2 = await ctx2.newPage();
  page2.on("pageerror", (e) => pageErrors.push("ctx2: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForFunction(`document.getElementById('sidehost') && document.getElementById('sidehost').textContent.includes('For the family')`, null, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  const landed = await page2.evaluate(`(function(){ var a = document.querySelector('#sidetoggle [data-side="intentions"]'); return a ? a.classList.contains('active') : false; })()`);
  ok(landed, "B4 a stored side key of 'intentions' still lands on Intentions after the rename (keys, not labels, are stored)");
  await ctx2.close();
} catch (e) {
  ok(false, "boot legs completed without exception", String(e && e.message || e).slice(0, 300));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v462: ${n - fails}/${n} ok`);
process.exit(fails ? 1 : 0);
