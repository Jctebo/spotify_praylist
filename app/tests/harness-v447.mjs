#!/usr/bin/env node
// harness-v447 — iOS-style header and back on pushed pages
// (v447 release document §§1–2 + John's mid-flight
// amendment, Ora thread, 2026-11-15 14:26 CT: "Make sure
// tabbed pages are beneath frozen header and not frozen").
// The bar: one shared emission (iosBarHtml) replaces the
// navy back disc at the five standing sites (block page ·
// episodes page · audio series · video series · watch),
// the head title lines retire into the bar's center (one
// title per page), Play All + the page menu ride the bar's
// right on block pages (D1 A), and the bar stands new on
// the disc-less named pages (Settings; the Conscience
// sides through their own consbar host). The amendment:
// the toggle rows are NOT frozen — .segtoggle loses its
// sticky seat, the compact block head re-seats flush under
// the brand bar, and the frozen layer on a pushed page is
// the header alone (brand bar + the bar/head under it).
// Census carried: no wallpaper detail page stands in the
// client (the Sacred Art tab's views are the tab home
// itself) — the wallpaper leg asserts the tab home carries
// no bar. Mold: harness-v439's whole-client boot (the real
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
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v447 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v445-ship";
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
    "S1 the worker-source diff vs the v445-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
  ok(!CLIENT.includes("backdisc"),
    "S2 no backdisc stands anywhere in client.ts — the disc's five emissions are gone");
  const sites = ["paintBlockPage", "paintEpisodesPage", "paintPodcasts", "paintPodcastVideos", "paintPodWatch", "paintSettings", "paintConscienceBar"];
  ok(sites.every((f) => extractFn(CLIENT, f).includes("iosBarHtml({")),
    "S2 every converted painter emits the shared bar: " + sites.join(" · "));
  const homes = ["paintListenHome", "paintPodcastsIndex", "renderWallpaper", "renderIntentions"];
  ok(homes.every((f) => !extractFn(CLIENT, f).includes("iosBarHtml")),
    "S3 the tab-home painters emit no bar: " + homes.join(" · "));
  const seg = UI.slice(UI.indexOf(".segtoggle {"), UI.indexOf("}", UI.indexOf(".segtoggle {")));
  ok(!seg.includes("position:sticky") && !seg.includes("position: sticky"),
    "S4 (amendment) the .segtoggle rule carries no sticky seat — the toggle rows are not frozen");
  ok(UI.includes(".blockpage-head.compact { padding:4px 14px; top:var(--brandh, 54px); }"),
    "S4 (amendment) the compact block head re-seats flush under the brand bar — the +46px toggle allowance is gone");
  const bar = UI.slice(UI.indexOf(".iosbar {"), UI.indexOf("}", UI.indexOf(".iosbar {")));
  ok(bar.includes("position:sticky") && bar.includes("top:var(--brandh, 54px)") && UI.includes(".iosbar-back {") && UI.includes("color:var(--accent-text)"),
    "S4 the .iosbar rule stands sticky at the brand height and its back act reads var(--accent-text), the standing theme token");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v447-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S5 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v445-1";'),
    "S5 (housekeeping): the SW pin stands at ora-pro-nobis-v445-1 (Ship moves it)");
  // S6: the cooked script parses whole + the backslash census (v439's algorithm) stands at 0
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "S6 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
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
  ok(census === 0, "S6 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);
}

/* ---------------- fixtures ---------------- */
const tracks = (base, count, label) => Array.from({ length: count }, (_, i) => ({ episodeId: String(base + i), title: label + " track " + (i + 1), durationS: 240, available: true, streamUrl: "__ORIGIN__/audio/" + (base + i) + ".wav" }));
const DAY = {
  ok: true, date: "2026-11-15", presentedDay: "2026-11-15", dateLabel: "Sunday, November 15, 2026",
  liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" }, introTexts: {},
  blocks: [
    { block: "Morning", label: "Morning", caption: "", tracks: tracks(9000, 12, "Morning") },
    { block: "Midday", label: "Midday", caption: "", tracks: tracks(9100, 1, "Midday") },
    { block: "Afternoon", label: "Afternoon", caption: "", tracks: tracks(9200, 1, "Afternoon") },
    { block: "Evening", label: "Evening", caption: "", tracks: tracks(9300, 1, "Evening") },
    { block: "Night", label: "Night", caption: "", tracks: tracks(9400, 1, "Night") },
    { block: "Novenas", label: "Novenas", caption: "", tracks: tracks(9500, 1, "Novenas") },
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

// A valid, long, silent WAV for the fixture streamUrls —
// a stream that loads and plays, so the queue never churns
// on load errors mid-run (a churning advance would close a
// standing watch through the estate's own choke point).
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
  const rect = (sel) => ev(`(function(){ var el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; var r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height) }; })()`);
  const text = (sel) => ev(`(function(){ var el = document.querySelector(${JSON.stringify(sel)}); return el ? el.textContent.trim() : null; })()`);
  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);

  /* ---- tab home: no bar; the amendment at rest + on scroll ---- */
  const brand = await rect(".brandbar");
  const togRest = await rect("#sidetoggle");
  ok(await ev(`!document.querySelector('.iosbar')`) && !!togRest,
    "H1 Prayers home (tab home): no bar stands; the Prayers | Intentions toggle stands");
  ok(await ev(`getComputedStyle(document.querySelector('#sidetoggle')).position`) === "static",
    "H1 (amendment) the toggle's computed position is static — it is not frozen");
  ok(togRest && brand && togRest.top >= brand.bottom - 1,
    "H1 (amendment) at rest the toggle stands beneath the frozen header — no content hidden under it", JSON.stringify({ togRest, brand }));
  await ev(`window.scrollTo(0, 500)`); await sleep(350);
  const togScroll = await rect("#sidetoggle"); const brandScroll = await rect(".brandbar");
  ok(togScroll && brandScroll && togScroll.bottom <= brandScroll.bottom + 2 && brandScroll.top === 0,
    "H2 (amendment) scrolled: the toggle row scrolls away under the frozen header; the brand bar alone stays at the top", JSON.stringify({ togScroll, brandScroll }));
  await ev(`window.scrollTo(0, 0)`); await sleep(250);

  /* ---- block page ---- */
  await ev(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page.waitForSelector(".blockpage-head .iosbar", { timeout: 5000 });
  const blk = await ev(`(function(){
    var head = document.querySelector('.blockpage-head');
    var bar = head.querySelector('.iosbar');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      aria: bar.querySelector('.iosbar-back').getAttribute('aria-label'),
      queue: !!bar.querySelector('[data-queue="Morning"]'), menu: !!bar.querySelector('[data-blockmenu]'),
      disc: !!document.querySelector('.backdisc'), headTitle: !!head.querySelector('.blockpage-title'),
      cover: !!head.querySelector('.blockpage-coverrow .blockcover'), meta: !!head.querySelector('[data-bmeta]'),
      barFirst: head.firstElementChild === bar, headH: Math.round(head.getBoundingClientRect().height) };
  })()`);
  ok(blk.name === "Prayers" && blk.title === "Morning" && blk.aria === "Back to Prayers",
    "B1 block page: the bar stands at the head's top — left reads Prayers (aria names it), the center names the page (Morning)", JSON.stringify(blk));
  ok(blk.queue && blk.menu && !blk.disc && !blk.headTitle && blk.cover && blk.meta && blk.barFirst,
    "B1 block page: Play All + the page menu ride the bar's right (D1 A); no disc stands; the head's title line retired; the coverrow keeps cover + meta", JSON.stringify(blk));
  console.log("note - block head measured height at 412px: " + blk.headH + "px (bar 44 + cover row + pill line over the head padding)");
  await ev(`window.scrollTo(0, 600)`); await sleep(350);
  const headStuck = await rect(".blockpage-head"); const brand2 = await rect(".brandbar");
  ok(headStuck && brand2 && Math.abs(headStuck.top - brand2.bottom) <= 1,
    "B2 block page frozen: scrolled, the head (bar inside) sticks flush under the brand bar — the header alone is frozen", JSON.stringify({ headStuck, brand2 }));
  await page.click('.blockpage-head .iosbar [data-queue="Morning"]');
  await page.waitForFunction(`!document.getElementById('dock').classList.contains('hidden')`, null, { timeout: 6000 }).catch(() => {});
  const dockTitle = await text("#dock-title");
  ok(!!dockTitle, "B3 Play All works from the bar: the queue starts and the dock stands with a track", "dockTitle=" + dockTitle);
  await page.click(".blockpage-head .iosbar-back");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });
  ok(await ev(`!!document.querySelector('[data-openblock="Morning"]') && !document.querySelector('.blockpage-head')`),
    "B4 block page back: the bar's back returns one level to the Prayers home (its standing data-back act)");

  /* ---- episodes page ---- */
  await ev(`document.querySelector('[data-openblock="__episodes"]').click()`);
  await page.waitForSelector('.blockpage-head[data-block="__episodes"] .iosbar', { timeout: 5000 });
  const eps = await ev(`(function(){
    var head = document.querySelector('.blockpage-head[data-block="__episodes"]');
    var bar = head.querySelector('.iosbar');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      playrow: !!head.querySelector('.blockpage-playrow [data-queue="__episodes"]'), headTitle: !!head.querySelector('.blockpage-title') };
  })()`);
  ok(eps.name === "Prayers" && eps.title === "From Today’s Podcast" && eps.playrow && !eps.headTitle,
    "E1 episodes page: the bar takes the backrow's seat in the head — Prayers at the left, the page's name centered; the Play All row stands below as before; the old title line retired", JSON.stringify(eps));
  await page.click('.blockpage-head[data-block="__episodes"] .iosbar-back');
  await page.waitForSelector('[data-openblock="__episodes"]', { timeout: 5000 });

  /* ---- Formation: index (tab home) + series + watch ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 5000 });
  ok(await ev(`!document.querySelector('.iosbar')`),
    "F1 Formation index (tab home): no bar stands");
  await ev(`document.querySelector('[data-podseries="bible"]').click()`);
  await page.waitForSelector(".iosbar", { timeout: 5000 });
  const ser = await ev(`(function(){
    var bar = document.querySelector('.iosbar');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      rightKids: bar.querySelector('.iosbar-right').children.length, headH1: !!document.querySelector('.podpage-head h1'),
      sticky: getComputedStyle(bar).position };
  })()`);
  ok(ser.name === "Formation" && ser.title === "Bible in a Year" && ser.rightKids === 0 && !ser.headH1 && ser.sticky === "sticky",
    "F2 series page: the bar replaces the sticky backrow in its seat — Formation at the left, the series name centered, the right stands empty (no page menu stands today), the head's title line retired", JSON.stringify(ser));
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-podseries="catholictv"]', { timeout: 5000 });
  await ev(`document.querySelector('[data-podseries="catholictv"]').click()`);
  await page.waitForSelector(".iosbar", { timeout: 5000 });
  ok((await text(".iosbar-title")) === "CatholicTV",
    "F3 video series page: the bar stands — CatholicTV centered");
  await ev(`document.querySelector('[data-podvideo]').click()`);
  await page.waitForSelector(".iosbar", { timeout: 5000 });
  const wat = await ev(`(function(){
    var bar = document.querySelector('.iosbar');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      watchtitle: !!document.querySelector('.watchtitle'), frame: !!document.querySelector('iframe.podwatch-frame') };
  })()`);
  ok(wat.name === "CatholicTV" && wat.title === "Daily Mass for Monday" && !wat.watchtitle && wat.frame,
    "F4 watch page: the bar stands — CatholicTV at the left, the video's name centered (its standing title line retired into the bar); the frame stands", JSON.stringify(wat));
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-podvideo]', { timeout: 5000 });
  ok((await text(".iosbar-title")) === "CatholicTV",
    "F4 watch back: the bar's back returns one level to the series page");

  /* ---- Settings ---- */
  await page.click("#gearbtn");
  await page.waitForSelector(".iosbar", { timeout: 5000 });
  const set = await ev(`(function(){
    var bar = document.querySelector('.iosbar');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      playback: (document.body.textContent || '').includes('PLAYBACK'), footBack: !!document.getElementById('set-back') };
  })()`);
  ok(set.name === "Prayers" && set.title === "Settings" && set.playback && set.footBack,
    "G1 Settings: the bar stands at the page top — Prayers at the left, Settings centered; the page below stands as before (Playback section, the footer's Back)", JSON.stringify(set));
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });
  ok(true, "G2 Settings back: the bar's back performs the page's standing back act — the Prayers home stands");

  /* ---- Conscience: gate (tab entry, no bar) -> Examination -> Confession ---- */
  await page.click('#tabbar [data-tab="conscience"]');
  await page.waitForSelector("#pinpad", { timeout: 5000 });
  ok(await ev(`!document.querySelector('.iosbar')`),
    "C1 Conscience entry (the PIN gate): no bar stands on the gate surface");
  for (const d of ["1", "2", "3", "4"]) await page.click(`[data-pinkey="${d}"]`);
  await page.click("#pin-unlock");
  await page.waitForSelector("#consbar .iosbar", { timeout: 6000 });
  const exa = await ev(`(function(){
    var bar = document.querySelector('#consbar .iosbar');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      chips: document.querySelectorAll('.examchips [data-examcat]').length,
      head: (document.querySelector('h2.sectionhead') || {}).textContent,
      togPos: getComputedStyle(document.querySelector('#sidetoggle')).position };
  })()`);
  ok(exa.name === "Prayers" && exa.title === "Examination" && exa.chips === 2 && exa.head === "Commandment I" && exa.togPos === "static",
    "C2 Examination: the bar stands over the page (Prayers at the left, Examination centered); the chips row and the heading stand as shipped; the toggle above is not frozen", JSON.stringify(exa));
  await ev(`window.scrollTo(0, 500)`); await sleep(350);
  const consBarStuck = await rect("#consbar .iosbar"); const brand3 = await rect(".brandbar"); const togC = await rect("#sidetoggle");
  ok(consBarStuck && brand3 && Math.abs(consBarStuck.top - brand3.bottom) <= 1 && togC && togC.bottom <= brand3.bottom + 2,
    "C3 (amendment) Examination scrolled: the bar sticks flush under the brand bar while the toggle row scrolls away — the header alone is frozen", JSON.stringify({ consBarStuck, brand3, togC }));
  await ev(`window.scrollTo(0, 0)`); await sleep(200);
  await ev(`document.querySelector('[data-examcat="Precepts of the Church"]').click()`);
  await page.waitForFunction(`(document.querySelector('h2.sectionhead') || {}).textContent === 'Precepts of the Church'`, null, { timeout: 5000 });
  ok(await ev(`!!document.querySelector('#consbar .iosbar')`),
    "C4 Examination under the bar: a chip tap crosses to the Precepts (v444 stands) and the bar stands through the repaint");
  await ev(`document.querySelector('#sidetoggle [data-side="confession"]').click()`);
  await page.waitForFunction(`(document.querySelector('#consbar .iosbar-title') || {}).textContent === 'Confession'`, null, { timeout: 6000 });
  const con = await ev(`(function(){
    return { guide: (document.body.textContent || '').includes('Make the sign of the cross'), gear: !!document.getElementById('cf-gear') };
  })()`);
  ok(con.guide && con.gear,
    "C5 Confession: the bar's center names Confession; the page below stands as before (the guide, its Guide act)", JSON.stringify(con));
  await page.click("#consbar .iosbar-back");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });
  ok(true, "C6 Conscience back: the bar's back returns to the Prayers home, the app's home tab (the sides' one-level return)");

  /* ---- Sacred Art (tab home; no detail page stands) ---- */
  await page.click('#tabbar [data-tab="wallpaper"]');
  await sleep(700);
  ok(await ev(`!document.querySelector('.iosbar')`),
    "W1 Sacred Art (tab home): no bar stands — and no wallpaper detail page stands in the client to carry one (census)");

  /* ---- the long-name rule ---- */
  const ln = await ev(`(function(){
    var d = document.createElement('div');
    d.innerHTML = iosBarHtml({ dest: 'A Very Long Destination Name', title: 'T', backAttrs: 'data-x' });
    var b = d.querySelector('.iosbar-back');
    var d2 = document.createElement('div');
    d2.innerHTML = iosBarHtml({ dest: 'Prayers', title: 'T', backAttrs: 'data-x' });
    return { shown: b.querySelector('.iosbar-name').textContent, aria: b.getAttribute('aria-label'),
      short: d2.querySelector('.iosbar-name').textContent };
  })()`);
  ok(ln.shown === "Back" && ln.aria === "Back to A Very Long Destination Name" && ln.short === "Prayers",
    "L1 long-name rule: a destination name over the measure renders Back (the full name stands in the aria-label); a short name stands as itself", JSON.stringify(ln));

  /* ---- 360px geometry ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  page2.on("pageerror", (e) => pageErrors.push("360: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  const tog360 = await page2.evaluate(`(function(){ var t = document.querySelector('#sidetoggle').getBoundingClientRect(); var b = document.querySelector('.brandbar').getBoundingClientRect(); return { top: Math.round(t.top), brandBottom: Math.round(b.bottom) }; })()`);
  ok(tog360.top >= tog360.brandBottom - 1,
    "F360 (amendment) at rest at 360px the toggle stands beneath the frozen header — nothing hidden under it", JSON.stringify(tog360));
  await page2.evaluate(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page2.waitForSelector(".blockpage-head .iosbar", { timeout: 5000 });
  const geo = await page2.evaluate(`(function(){
    var bar = document.querySelector('.blockpage-head .iosbar');
    var title = bar.querySelector('.iosbar-title');
    var br = bar.getBoundingClientRect(), tr = title.getBoundingClientRect();
    return { scrollW: document.documentElement.scrollWidth, titleL: Math.round(tr.left), titleR: Math.round(tr.right),
      barL: Math.round(br.left), barR: Math.round(br.right), barH: Math.round(br.height) };
  })()`);
  ok(geo.scrollW <= 362 && geo.titleL >= geo.barL - 1 && geo.titleR <= geo.barR + 1 && geo.barH === 44,
    "F360 block page at 360px: no NEW horizontal overflow (scrollWidth 362 is the base's own measure on release/v445-ship — the standing head bleed, probed identical; the bar adds nothing); the centered title stands inside the bar; the bar measures 44px", JSON.stringify(geo));
  await page2.evaluate(`window.scrollTo(0, 600)`); await sleep(350);
  const stuck360 = await page2.evaluate(`(function(){ var h = document.querySelector('.blockpage-head').getBoundingClientRect(); var b = document.querySelector('.brandbar').getBoundingClientRect(); return { headTop: Math.round(h.top), brandBottom: Math.round(b.bottom), headH: Math.round(h.height) }; })()`);
  ok(Math.abs(stuck360.headTop - stuck360.brandBottom) <= 1,
    "F360 block page frozen at 360px: the head sticks flush under the brand bar", JSON.stringify(stuck360));
  console.log("note - block head measured height at 360px: " + stuck360.headH + "px");

  ok(pageErrors.length === 0, "browser: zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v447: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
