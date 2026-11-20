#!/usr/bin/env node
// harness-v450 — Conscience navigation fix (§§1–2 of the
// v450 release document; John's rider on the v449 approval,
// Ora thread, 2026-11-15 15:14 CT: "Also fix conscious
// navigation as well it has some errors"; his governing
// detail 15:15 CT: "The order and irs registering as a
// subpage of prayers and it's not"). Measured: (1) the
// Conscience bar drops its false Prayers parent —
// paintConscienceBar emits the title-only bar (iosBarHtml's
// no-dest form), no back act, no "Prayers" text, on BOTH
// sides; the [data-consback] wiring retires (census 0);
// the layer order stands as v448 leaves it (bar · toggle ·
// body, the header alone frozen); the bottom tab bar still
// leaves the tab. (2) The Examination chips row follows to
// the selected chip at FIRST ENTRY — an entry paint (the
// head read stands null: first entry, tab entry, re-entry
// after the Confession side painted) runs the shared
// followExamChip (v444's math, extracted) — while every
// other paint stands as today: v443 preservation on a
// standing row, the v444 pager follow on its flag, chip
// taps never moving the row. (3) The PIN gate and the
// no-PIN setup prompt carry no bar, as today. Mold:
// harness-v439's whole-client boot (the real SHELL_HTML +
// APP_CSS + the whole COOKED APP_JS, fetch stubbed by
// path) driven through the real UI; the exam fixture
// carries all 13 categories with the focus at Commandment
// VIII (the inspection's measured case: the VIII chip
// stands off-screen at entry on the shipped tree).
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v450 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v449-ship";
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
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts"]),
    "S1 the worker-source diff vs the v449-ship base is client.ts only (got: " + changed.join(", ") + ")");
  const pcb = extractFn(CLIENT, "paintConscienceBar");
  ok(pcb.includes("iosBarHtml({ title:") && !pcb.includes("dest:") && !pcb.includes("backAttrs") && !pcb.includes("setTab"),
    "S2 paintConscienceBar emits the title-only bar — no destination, no back attrs, no tab wiring in the function");
  const census = (CLIENT + UI + INDEX).split("consback").length - 1;
  ok(census === 0, "S3 the consback census stands at 0 across the worker source (the emission and its wiring retired whole)", "census=" + census);
  const bar = extractFn(CLIENT, "iosBarHtml");
  ok(bar.includes("if (!o.dest)") && bar.includes("iosbar-title") && bar.includes("iosbar-back") && bar.includes("o.dest.length"),
    "S4 iosBarHtml carries the no-dest title-only form AND the standing dest form (every standing caller's output unchanged)");
  const exam = extractFn(CLIENT, "renderExaminationContent");
  const follow = extractFn(CLIENT, "followExamChip");
  const restoreAt = exam.indexOf("newChipsRow.scrollLeft = chipsScroll");
  const entryAt = exam.indexOf("if (chipsScroll === null) followExamChip();");
  const pagerAt = exam.indexOf("if (state.examFollowActive)");
  ok(follow.includes("followRow.scrollLeft = chipR - followRow.clientWidth") && follow.includes("activeChip.offsetWidth >= followRow.clientWidth"),
    "S5 followExamChip carries v444's follow math exactly (the smallest move; a wider-than-band chip aligns its left edge)");
  ok(restoreAt >= 0 && entryAt > restoreAt && pagerAt > entryAt
    && exam.includes("state.examFollowActive = false;") && exam.includes("followExamChip();"),
    "S5 the paint's order stands: the v443 restore, then the v450 entry follow (head read null), then the v444 pager follow on its flag");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v450-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S6 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v449-1";'),
    "S6 (housekeeping): the SW pin stands at ora-pro-nobis-v449-1 (Ship moves it)");
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "S7 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
  const VALID = new Set(["'", '"', "`", "$", "\\", "b", "f", "n", "r", "t", "v", "0", "\n"]);
  let bcensus = 0;
  for (let i = 0; i < RAW_JS.length; i++) {
    if (RAW_JS[i] !== "\\") continue;
    const nx = RAW_JS[i + 1];
    if (nx === undefined) break;
    if (nx === "\\") { i++; continue; }
    if (nx === "u" && (/^[0-9a-fA-F]{4}$/.test(RAW_JS.slice(i + 2, i + 6)) || RAW_JS[i + 2] === "{")) { i += 5; continue; }
    if (nx === "x" && /^[0-9a-fA-F]{2}$/.test(RAW_JS.slice(i + 2, i + 4))) { i += 3; continue; }
    if (VALID.has(nx)) { i++; continue; }
    bcensus++; i++;
  }
  ok(bcensus === 0, "S7 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + bcensus);
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
    { block: "Night", label: "Night", caption: "", tracks: tracks(9400, 1, "Night") },
  ],
  episodes: [{ episodeId: "9901", title: "Podcast Episode One", durationS: 300, available: true, streamUrl: "__ORIGIN__/audio/9901.wav" }],
};
const INDEXF = { seriesList: [
  { series: "bible", title: "Bible in a Year", kind: "audio", available: true, listenedCount: 0, total: 372, currentLabel: "Day 1", showImageUrl: null },
] };
const SERIES = { series: "bible", kind: "audio", title: "Bible in a Year", available: true, showDesc: "", showImageUrl: null,
  listenedCount: 0, total: 2, currentKey: "d1",
  entries: [
    { key: "d1", label: "Day 1", title: "Genesis", durationS: 60, listened: false, url: "https://example.com/d1.mp3", imageUrl: null, descText: null },
    { key: "d2", label: "Day 2", title: "Exodus", durationS: 60, listened: true, listenDate: "2026-11-14", url: "https://example.com/d2.mp3", imageUrl: null, descText: null },
  ] };
const EXAM = { ok: true, date: "2026-11-15", dateLabel: "Saturday, November 15",
  run: { id: 7, date: "2026-11-15", state: "open" },
  categories: ["Preliminary Examination", "Commandment I", "Commandment II", "Commandment III", "Commandment IV", "Commandment V", "Commandment VI", "Commandment VII", "Commandment VIII", "Commandment IX", "Commandment X", "Precepts of the Church", "Capital Sins"],
  focusCategory: "Commandment VIII",
  prompts: [
    { id: 1, category: "Preliminary Examination", text: "Preliminary question?" },
    { id: 101, category: "Commandment I", text: "First commandment question A?" },
    { id: 102, category: "Commandment I", text: "First commandment question B?" },
    { id: 201, category: "Commandment II", text: "Second commandment question?" },
    { id: 801, category: "Commandment VIII", text: "Eighth commandment question A?" },
    { id: 802, category: "Commandment VIII", text: "Eighth commandment question B?" },
    { id: 803, category: "Commandment VIII", text: "Eighth commandment question C?" },
    { id: 901, category: "Commandment IX", text: "Ninth commandment question?" },
    { id: 1001, category: "Commandment X", text: "Tenth commandment question?" },
    { id: 1101, category: "Precepts of the Church", text: "Precepts question?" },
    { id: 1201, category: "Capital Sins", text: "Capital sins question?" },
  ], entries: [] };
const CONF = { elapsed: "2 weeks", lastConfession: null,
  guide: [{ step_no: 1, title: "Begin", body: "Make the sign of the cross." }],
  penance: null, prep: [], history: [] };

const TPL_A2 = CLIENT.indexOf("APP_JS = `") + 10;
const COOKED = new Function("return `" + CLIENT.slice(TPL_A2, CLIENT.indexOf("`;", TPL_A2)) + "`")();
function buildPage(pinSet) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
var FIX = { DAY: ${JSON.stringify(DAY)}, INDEX: ${JSON.stringify(INDEXF)}, SERIES: ${JSON.stringify(SERIES)}, EXAM: ${JSON.stringify(EXAM)}, CONF: ${JSON.stringify(CONF)} };
window.fetch = function (path, opts) {
  var p = String(path);
  window.__fetchLog.push(p);
  var J = function (obj) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(obj))); } }); };
  if (p.indexOf('/api/player/day') === 0) return J(FIX.DAY);
  if (p === '/api/player/podcasts') return J(FIX.INDEX);
  if (p.indexOf('/api/player/podcasts?series=bible') === 0) return J(FIX.SERIES);
  if (p.indexOf('/api/player/source-settings') === 0) return J({ sources: [], version: 3 });
  if (p.indexOf('/api/pin/state') === 0) return J({ pinSet: ${pinSet ? "true" : "false"}, retryAfterSeconds: 0 });
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
}

const WAV = (() => {
  const sr = 8000, secs = 300, dataSize = sr * secs * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  return buf;
})();
const pageMain = buildPage(true);
const pageNoPin = buildPage(false);
const server = http.createServer((req, res) => {
  const p = (req.url || "/").split("?")[0];
  if (p === "/") { res.setHeader("Content-Type", "text/html"); res.end(pageMain.split("__ORIGIN__").join(ORIGIN)); return; }
  if (p === "/nopin") { res.setHeader("Content-Type", "text/html"); res.end(pageNoPin.split("__ORIGIN__").join(ORIGIN)); return; }
  if (p.indexOf("/audio/") === 0) { res.setHeader("Content-Type", "audio/wav"); res.end(WAV); return; }
  res.statusCode = 404; res.end("not found");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  const ev = (fn) => page.evaluate(fn);
  const rect = (sel) => ev(`(function(){ var el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; var r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height), width: Math.round(r.width) }; })()`);
  const band = () => ev(`(function(){
    var row = document.querySelector('.examchips'); var chip = row ? row.querySelector('.chip.active') : null;
    if (!row || !chip) return null;
    var rr = row.getBoundingClientRect(), cr = chip.getBoundingClientRect();
    return { scroll: row.scrollLeft, active: chip.getAttribute('data-examcat'),
      inside: cr.left >= rr.left - 1 && cr.right <= rr.right + 1,
      chips: row.querySelectorAll('[data-examcat]').length,
      head: (document.querySelector('h2.sectionhead') || {}).textContent || null };
  })()`);
  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);

  /* ---- P1: the PIN gate carries no bar ---- */
  await page.click('#tabbar [data-tab="conscience"]');
  await page.waitForSelector("#pinpad", { timeout: 5000 });
  await sleep(300);
  ok(await ev(`!document.querySelector('#consbar .iosbar') && !document.querySelector('.iosbar')`),
    "P1 the PIN gate stands with NO bar anywhere (the gate is not a Conscience side)");

  /* ---- unlock → the first Examination paint ---- */
  for (const d of ["1", "2", "3", "4"]) await page.click(`[data-pinkey="${d}"]`);
  await page.click("#pin-unlock");
  await page.waitForSelector("#consbar .iosbar", { timeout: 6000 });
  await page.waitForSelector(".examchips .chip.active", { timeout: 6000 });
  await sleep(500);

  /* ---- B1: the Examination bar — title only, no parent ---- */
  const bar1 = await ev(`(function(){
    var host = document.getElementById('consbar'), bar = host.querySelector('.iosbar'), tog = document.getElementById('sidetoggle');
    return { title: bar.querySelector('.iosbar-title').textContent,
      back: !!bar.querySelector('.iosbar-back'), name: !!bar.querySelector('.iosbar-name'),
      text: bar.textContent, order: (host.compareDocumentPosition(tog) & 4) !== 0 };
  })()`);
  ok(bar1.title === "Examination" && !bar1.back && !bar1.name && !/Prayers/.test(bar1.text) && bar1.order,
    "B1 Examination bar: the title \"Examination\" alone — no back act, no destination name, no \"Prayers\" text in the bar; the host still paints before the toggle", JSON.stringify(bar1));
  const bBar = await rect("#consbar .iosbar"); const bBrand = await rect(".brandbar"); const bTog = await rect("#sidetoggle");
  ok(bBar && bBrand && Math.abs(bBar.top - bBrand.bottom) <= 1 && bTog && bTog.top >= bBar.bottom - 1 && bBar.height === 44,
    "B1 layer order at rest stands as v448 leaves it: brand bar · the (title-only) bar flush under it at 44px · the toggle wholly beneath", JSON.stringify({ bBar, bBrand, bTog }));
  await ev(`window.scrollTo(0, 500)`); await sleep(350);
  const bBarS = await rect("#consbar .iosbar"); const bBrandS = await rect(".brandbar"); const bTogS = await rect("#sidetoggle");
  ok(bBarS && bBrandS && Math.abs(bBarS.top - bBrandS.bottom) <= 1 && bTogS && bTogS.bottom <= bBrandS.bottom + 2,
    "B1 scrolled: the title-only bar sticks flush under the brand bar while the toggle scrolls away — the header alone is frozen, the toggle unfrozen (v448's C3 substance, re-proven on the new bar)", JSON.stringify({ bBarS, bBrandS, bTogS }));
  await ev(`window.scrollTo(0, 0)`); await sleep(250);

  /* ---- E1: first entry — the row follows to the focus chip (the VIII case) ---- */
  const e1 = await band();
  ok(e1 && e1.chips === 13 && e1.active === "Commandment VIII" && e1.head === "Commandment VIII" && e1.inside && e1.scroll > 0,
    "E1 first entry (focus Commandment VIII, 13 categories): the active chip stands fully inside the visible band at first paint and the row's scrollLeft > 0 — the page opens on today's section", JSON.stringify(e1));

  /* ---- E2: a chip tap never moves the row (v444 stands) ---- */
  const pre2 = e1.scroll;
  await ev(`document.querySelector('[data-examcat="Commandment I"]').click()`);
  await sleep(700);
  const e2 = await band();
  ok(e2 && e2.active === "Commandment I" && e2.head === "Commandment I" && e2.scroll === pre2,
    "E2 a chip tap repainted to Commandment I with the row's scrollLeft exactly the pre-tap value — a tap never auto-scrolls (v443/v444 exact)", JSON.stringify({ pre: pre2, e2 }));

  /* ---- E3: the pager follow stands (v444 regression) ---- */
  await ev(`document.querySelector('[data-examcat="Commandment VIII"]').click()`);
  await sleep(700);
  await ev(`document.querySelector('.examchips').scrollLeft = 0`);
  const pre3 = await band();
  await ev(`document.getElementById('deep-next-cat').click()`);
  await sleep(700);
  const e3 = await band();
  ok(pre3 && pre3.scroll === 0 && e3 && e3.active === "Commandment IX" && e3.head === "Commandment IX" && e3.inside && e3.scroll > 0,
    "E3 Next section from VIII (row hand-scrolled to 0) crosses to Commandment IX and the row follows — the active chip inside the band, scrollLeft > 0 (v444's pager follow stands)", JSON.stringify({ pre3, e3 }));

  /* ---- E4: an entry-write repaint preserves the row's place (v443 regression) ---- */
  const pre4 = e3.scroll;
  await ev(`document.querySelector('.prompt').click()`);
  await sleep(300);
  await ev(`document.getElementById('et-901').value = 'A ninth-commandment note.'`);
  await ev(`document.querySelector('[data-save-entry="901"]').click()`);
  await sleep(900);
  const e4 = await band();
  ok(e4 && e4.active === "Commandment IX" && Math.abs(e4.scroll - pre4) <= 1,
    "E4 an entry saved under Commandment IX repainted with the row's place preserved (scrollLeft unchanged) — no entry follow on a standing row", JSON.stringify({ pre: pre4, e4 }));

  /* ---- B2: the Confession bar — the same title-only form ---- */
  await ev(`document.querySelector('#sidetoggle [data-side="confession"]').click()`);
  await page.waitForFunction(`(document.querySelector('#consbar .iosbar-title') || {}).textContent === 'Confession'`, null, { timeout: 6000 }).catch(() => {});
  await sleep(600);
  const bar2 = await ev(`(function(){
    var bar = document.querySelector('#consbar .iosbar');
    return { title: bar.querySelector('.iosbar-title').textContent,
      back: !!bar.querySelector('.iosbar-back'), text: bar.textContent,
      side: (document.querySelector('#sidehost') || {}).textContent || '' };
  })()`);
  ok(bar2.title === "Confession" && !bar2.back && !/Prayers/.test(bar2.text) && bar2.side.includes("Begin"),
    "B2 Confession bar: the title \"Confession\" alone — no back act, no \"Prayers\" text; the Confession side paints beneath it", JSON.stringify({ title: bar2.title, back: bar2.back, text: bar2.text }));

  /* ---- E5: return to Examination — the entry follow fires again ---- */
  await ev(`document.querySelector('#sidetoggle [data-side="examination"]').click()`);
  await page.waitForSelector(".examchips .chip.active", { timeout: 6000 });
  await sleep(600);
  const e5 = await band();
  ok(e5 && e5.active === "Commandment IX" && e5.inside && e5.scroll > 0,
    "E5 leaving to Confession and returning re-follows to the then-selected chip (Commandment IX inside the band, scrollLeft > 0) — re-entry is an entry paint", JSON.stringify(e5));

  /* ---- B3: the bottom tab bar still leaves the tab ---- */
  await page.click('#tabbar [data-tab="prayers"]');
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 6000 });
  ok(true, "B3 the bottom tab bar leaves Conscience for Prayers — the tab bar is the way between tabs, as on every tab home");

  /* ---- G360: Examination at 360px ---- */
  await page.setViewportSize({ width: 360, height: 800 });
  await page.click('#tabbar [data-tab="conscience"]');
  await page.waitForSelector(".examchips .chip.active", { timeout: 6000 });
  await sleep(600);
  const g = await band();
  const gBar = await ev(`(function(){ var bar = document.querySelector('#consbar .iosbar'); return { title: bar.querySelector('.iosbar-title').textContent, back: !!bar.querySelector('.iosbar-back'), scrollW: document.documentElement.scrollWidth }; })()`);
  ok(g && g.inside && gBar.title === "Examination" && !gBar.back && gBar.scrollW <= 362,
    "G360 at 360px: the title-only bar stands (no back), the selected chip stands inside the band, no new horizontal overflow (362 is the base's own standing measure)", JSON.stringify({ g, gBar }));
  await page.setViewportSize({ width: 412, height: 915 });

  /* ---- P2: the no-PIN setup prompt carries no bar ---- */
  const page2 = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page2.on("pageerror", (e) => pageErrors.push("nopin: " + String(e)));
  await page2.goto(ORIGIN + "/nopin");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await page2.click('#tabbar [data-tab="conscience"]');
  await page2.waitForSelector("#pin-setup-open", { timeout: 6000 });
  await sleep(300);
  ok(await page2.evaluate(`!document.querySelector('#consbar .iosbar') && !!document.getElementById('pin-setup-open')`),
    "P2 with no PIN set, the setup prompt stands (\"Set a PIN\") and NO bar stands over it, as today");

  ok(pageErrors.length === 0, "browser: zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v450: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
