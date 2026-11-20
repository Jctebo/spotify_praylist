#!/usr/bin/env node
// harness-v448 — fix-forward for v447's failed field check
// (John, Ora thread, 2026-11-15 15:04 CT: "You got this
// wrong"; closed 15:05 CT: "Let's eliminate the old header
// bar completely, shrink size of button and put tabs
// beneath header unfrozen"). Three fixes, measured:
// (1) the iOS bar takes the TOP SLOT on pushed pages — the
// bar hosts (#pushbar for Prayers, #consbar for Conscience)
// paint BEFORE the toggle in paintMergedContainer, the
// hosts keep the sticky seat at the brand height, and the
// toggle + side host scroll beneath the bar; (2) the old
// block-page head band (.blockpage-head) is eliminated —
// its facts stand as one plain meta line at the body's top,
// the download act + note as a plain body row, the episodes
// Play All row as a body row, the cover tiles retire;
// (3) the bar's Play All shrinks to the standing
// .playbtn.small form (30px disc on a 44px tap, wholly
// inside the 44px bar) and the menu act takes the plain
// .iosbar-act dress (no pill). Mold: harness-v439's
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
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v448 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v447-ship";
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
    "S1 the worker-source diff vs the v447-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
  ok(!CLIENT.includes('class="blockpage-head'),
    "S2 no .blockpage-head emission stands anywhere in client.ts — the old head band is eliminated");
  const mc = extractFn(CLIENT, "paintMergedContainer");
  ok(mc.indexOf('id="consbar"') >= 0 && mc.indexOf('id="pushbar"') >= 0
    && mc.indexOf('id="consbar"') < mc.indexOf("paintSideToggle(tab, side)")
    && mc.indexOf('id="pushbar"') < mc.indexOf("paintSideToggle(tab, side)"),
    "S3 the bar hosts paint BEFORE the toggle in paintMergedContainer — the bar takes the top slot, the toggle beneath it");
  ok(extractFn(CLIENT, "paintBlockPage").includes("paintPrayersBar(iosBarHtml({")
    && extractFn(CLIENT, "paintEpisodesPage").includes("paintPrayersBar(iosBarHtml({")
    && extractFn(CLIENT, "paintListenHome").includes("paintPrayersBar(null)")
    && extractFn(CLIENT, "renderIntentions").includes("paintPrayersBar(null)"),
    "S4 the block + episodes paints fill the Prayers bar host; the home + Intentions paints clear it");
  ok(UI.includes("#consbar, #pushbar { position:sticky; top:var(--brandh, 54px); z-index:25; }")
    && UI.includes(".iosbar-act {") && !UI.includes(".blockpage-head {") && !UI.includes(".iosbar.inhead") && !UI.includes(".blockpage-coverrow"),
    "S5 the hosts share the sticky seat at the brand height; the plain bar-act dress stands; the head band's CSS family stood down");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v448-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S6 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v447-1";'),
    "S6 (housekeeping): the SW pin stands at ora-pro-nobis-v447-1 (Ship moves it)");
  // S7: the cooked script parses whole + the backslash census (v439's algorithm) stands at 0
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "S7 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
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
  ok(census === 0, "S7 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);
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

  /* ---- Prayers home: no bar; the toggle beneath the brand bar, unfrozen ---- */
  const brand = await rect(".brandbar");
  const togRest = await rect("#sidetoggle");
  ok(await ev(`!document.querySelector('#pushbar .iosbar') && !document.getElementById('pushbar').hasAttribute('data-barblock')`) && !!togRest,
    "H1 Prayers home: the bar host stands empty (no bar, no block key); the toggle stands");
  ok(togRest && brand && togRest.top >= brand.bottom - 1
    && (await ev(`getComputedStyle(document.querySelector('#sidetoggle')).position`)) === "static",
    "H1 at rest the toggle stands beneath the frozen header and is not frozen (position static)", JSON.stringify({ togRest, brand }));
  await ev(`window.scrollTo(0, 500)`); await sleep(350);
  const togScroll = await rect("#sidetoggle"); const brandScroll = await rect(".brandbar");
  ok(togScroll && brandScroll && togScroll.bottom <= brandScroll.bottom + 2 && brandScroll.top === 0,
    "H2 scrolled: the toggle row scrolls away under the frozen header; the brand bar alone stays", JSON.stringify({ togScroll, brandScroll }));
  await ev(`window.scrollTo(0, 0)`); await sleep(250);

  /* ---- block page: the bar in the top slot ---- */
  await ev(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  const blk = await ev(`(function(){
    var bar = document.querySelector('#pushbar .iosbar');
    var push = document.getElementById('pushbar'), tog = document.getElementById('sidetoggle');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      aria: bar.querySelector('.iosbar-back').getAttribute('aria-label'),
      key: push.getAttribute('data-barblock'), head: !!document.querySelector('.blockpage-head'),
      order: (push.compareDocumentPosition(tog) & 4) !== 0 };
  })()`);
  ok(blk.name === "Prayers" && blk.title === "Morning" && blk.aria === "Back to Prayers" && blk.key === "Morning" && !blk.head && blk.order,
    "B1 block page: the bar stands in the #pushbar host (Prayers · Morning · its aria), the host carries the block key, the host paints BEFORE the toggle, and no .blockpage-head stands anywhere", JSON.stringify(blk));
  const barR = await rect("#pushbar .iosbar"); const brandB = await rect(".brandbar"); const togB = await rect("#sidetoggle");
  ok(barR && brandB && Math.abs(barR.top - brandB.bottom) <= 1 && togB && togB.top >= barR.bottom - 1,
    "B1 layer order at rest: brand bar · the bar flush under it · the toggle wholly beneath the bar", JSON.stringify({ barR, brandB, togB }));

  /* ---- sizes, measured as boxes ---- */
  const sizes = await ev(`(function(){
    var bar = document.querySelector('#pushbar .iosbar').getBoundingClientRect();
    var play = document.querySelector('#pushbar [data-queue="Morning"]');
    var pr = play.getBoundingClientRect();
    var menu = document.querySelector('#pushbar [data-blockmenu]');
    var mr = menu.getBoundingClientRect();
    var cs = getComputedStyle(menu);
    return { bar: { top: Math.round(bar.top), bottom: Math.round(bar.bottom), height: Math.round(bar.height) },
      play: { top: Math.round(pr.top), bottom: Math.round(pr.bottom), height: Math.round(pr.height) },
      disc: getComputedStyle(play, '::after').width,
      menu: { top: Math.round(mr.top), bottom: Math.round(mr.bottom), height: Math.round(mr.height) },
      menuBorder: cs.borderTopStyle, menuBg: cs.backgroundColor, menuText: menu.textContent };
  })()`);
  ok(sizes.play.height <= sizes.bar.height && sizes.play.top >= sizes.bar.top - 1 && sizes.play.bottom <= sizes.bar.bottom + 1 && sizes.disc === "30px",
    "B2 Play All shrunk: its box stands wholly inside the bar (height <= the bar's 44) and the visible disc measures 30px (the .playbtn.small ::after)", JSON.stringify(sizes));
  ok(sizes.menu.top >= sizes.bar.top - 1 && sizes.menu.bottom <= sizes.bar.bottom + 1 && sizes.menuBorder === "none" && sizes.menuText === "⋮",
    "B2 the menu act stands inside the bar in the plain act dress — no border, no pill", JSON.stringify(sizes));

  /* ---- the band's facts in the body ---- */
  await page.waitForFunction(`(document.querySelector('[data-bmeta="Morning"]') || {}).textContent && document.querySelector('[data-bmeta="Morning"]').textContent.includes('48min')`, null, { timeout: 6000 }).catch(() => {});
  const body = await ev(`(function(){
    var meta = document.querySelector('#sidehost .blockpage-meta');
    var dl = document.querySelector('#sidehost [data-blockdl="Morning"]');
    var note = document.querySelector('#sidehost [data-blockdlnote="Morning"]');
    return { metaText: meta ? meta.textContent.trim() : null, metaPos: meta ? getComputedStyle(meta).position : null,
      dlText: dl ? dl.textContent.trim() : null, noteStands: !!note,
      metaInHost: !!(meta && meta.closest('#sidehost')), dlInHost: !!(dl && dl.closest('#sidehost')) };
  })()`);
  ok(body.metaText && body.metaText.includes("12 episodes") && body.metaText.includes("48min") && body.metaInHost && body.metaPos === "static",
    "B3 the band's facts stand as one plain meta line at the body's top (12 episodes · 48min, settled), inside the side host, not frozen", JSON.stringify(body));
  ok(body.dlText === "Download all" && body.noteStands && body.dlInHost,
    "B3 the download act + its state line stand as a plain row in the body under the meta line, with their standing data wiring", JSON.stringify(body));

  /* ---- scrolled: the header alone freezes ---- */
  await ev(`window.scrollTo(0, 600)`); await sleep(350);
  const barS = await rect("#pushbar .iosbar"); const brandS = await rect(".brandbar"); const togS = await rect("#sidetoggle"); const metaS = await rect("#sidehost .blockpage-meta");
  ok(barS && brandS && Math.abs(barS.top - brandS.bottom) <= 1 && togS && togS.bottom <= brandS.bottom + 2 && metaS && metaS.bottom <= brandS.bottom + 2,
    "B4 scrolled: the bar sticks flush under the brand bar; the toggle AND the meta line scroll away beneath it — the header alone is frozen", JSON.stringify({ barS, brandS, togS, metaS }));
  await ev(`window.scrollTo(0, 0)`); await sleep(250);

  /* ---- the bar's acts work ---- */
  await page.click('#pushbar [data-queue="Morning"]');
  await page.waitForFunction(`!document.getElementById('dock').classList.contains('hidden')`, null, { timeout: 6000 }).catch(() => {});
  const dockTitle = await text("#dock-title");
  ok(!!dockTitle, "B5 Play All works from the bar: the queue starts and the dock stands with a track", "dockTitle=" + dockTitle);
  await page.click("#pushbar [data-blockmenu]");
  await page.waitForSelector(".anchmenu", { timeout: 5000 }).catch(() => {});
  const menuText = await text(".anchmenu");
  ok(!!menuText && menuText.includes("Sort") && menuText.includes("Share"),
    "B6 the menu act in the bar opens its anchored menu (Sort · Share stand in it)", String(menuText).slice(0, 120));
  await ev(`(document.querySelector('.menucatcher') || document.body).click()`); await sleep(200);
  await page.click("#pushbar .iosbar-back");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });
  ok(await ev(`!!document.querySelector('[data-openblock="Morning"]') && !document.querySelector('#pushbar .iosbar') && !document.getElementById('pushbar').hasAttribute('data-barblock')`),
    "B7 the bar's back returns one level to the Prayers home and the host clears (no bar, no block key)");

  /* ---- episodes page ---- */
  await ev(`document.querySelector('[data-openblock="__episodes"]').click()`);
  await page.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  const eps = await ev(`(function(){
    var bar = document.querySelector('#pushbar .iosbar');
    var meta = document.querySelector('#sidehost .blockpage-meta');
    var row = document.querySelector('#sidehost .blockpage-playrow [data-queue="__episodes"]');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      key: document.getElementById('pushbar').getAttribute('data-barblock'), head: !!document.querySelector('.blockpage-head'),
      metaText: meta ? meta.textContent.trim() : null, playInBody: !!row };
  })()`);
  ok(eps.name === "Prayers" && eps.title === "From Today’s Podcast" && eps.key === "__episodes" && !eps.head
    && eps.metaText && eps.metaText.includes("1 episodes") && eps.metaText.includes("5min") && eps.playInBody,
    "E1 episodes page: the bar stands in the top slot; no head band; the meta line (1 episodes · 5min) and the Play All row stand in the body", JSON.stringify(eps));
  // The standing startQueue is a pause toggle while a queue
  // plays (v351): pause the B5 Morning queue at the dock
  // first, then the episodes act builds its own queue.
  await page.click("#dock-play");
  await sleep(300);
  await page.click('#sidehost .blockpage-playrow [data-queue="__episodes"]');
  await page.waitForFunction(`(document.getElementById('dock-title') || {}).textContent && document.getElementById('dock-title').textContent.includes('Podcast Episode One')`, null, { timeout: 6000 }).catch(() => {});
  ok(((await text("#dock-title")) || "").includes("Podcast Episode One"),
    "E2 the episodes Play All row in the body plays (the dock names the podcast episode)", await text("#dock-title"));
  await page.click("#pushbar .iosbar-back");
  await page.waitForSelector('[data-openblock="__episodes"]', { timeout: 5000 });
  ok(await ev(`!document.querySelector('#pushbar .iosbar')`),
    "E3 the episodes page's back returns home and the host clears");

  /* ---- Intentions side: no bar stands over a tab home side ---- */
  await ev(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await sleep(900);
  ok(await ev(`!document.querySelector('#pushbar .iosbar') && (document.body.textContent || '').includes('Intentions')`),
    "I1 the Intentions side: no bar stands (the pushed page's bar never crosses to a home side)");
  await ev(`document.querySelector('#sidetoggle [data-side="prayers"]').click()`);
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });

  /* ---- Conscience: the bar above the toggle ---- */
  await page.click('#tabbar [data-tab="conscience"]');
  await page.waitForSelector("#pinpad", { timeout: 5000 });
  for (const d of ["1", "2", "3", "4"]) await page.click(`[data-pinkey="${d}"]`);
  await page.click("#pin-unlock");
  await page.waitForSelector("#consbar .iosbar", { timeout: 6000 });
  const cons = await ev(`(function(){
    var bar = document.querySelector('#consbar .iosbar');
    var host = document.getElementById('consbar'), tog = document.getElementById('sidetoggle');
    return { name: bar.querySelector('.iosbar-name').textContent, title: bar.querySelector('.iosbar-title').textContent,
      order: (host.compareDocumentPosition(tog) & 4) !== 0,
      chips: document.querySelectorAll('.examchips [data-examcat]').length,
      head: (document.querySelector('h2.sectionhead') || {}).textContent };
  })()`);
  ok(cons.name === "Prayers" && cons.title === "Examination" && cons.order && cons.chips === 2 && cons.head === "Commandment I",
    "C1 Examination: the bar stands in its host, the host paints BEFORE the toggle; the chips + heading stand as shipped", JSON.stringify(cons));
  const cBar = await rect("#consbar .iosbar"); const cBrand = await rect(".brandbar"); const cTog = await rect("#sidetoggle");
  ok(cBar && cBrand && Math.abs(cBar.top - cBrand.bottom) <= 1 && cTog && cTog.top >= cBar.bottom - 1,
    "C2 layer order at rest: brand bar · the bar flush under it · the toggle wholly beneath the bar", JSON.stringify({ cBar, cBrand, cTog }));
  await ev(`window.scrollTo(0, 500)`); await sleep(350);
  const cBarS = await rect("#consbar .iosbar"); const cBrandS = await rect(".brandbar"); const cTogS = await rect("#sidetoggle");
  ok(cBarS && cBrandS && Math.abs(cBarS.top - cBrandS.bottom) <= 1 && cTogS && cTogS.bottom <= cBrandS.bottom + 2,
    "C3 scrolled: the bar sticks flush under the brand bar while the toggle scrolls away — the header alone is frozen", JSON.stringify({ cBarS, cBrandS, cTogS }));
  await ev(`window.scrollTo(0, 0)`); await sleep(200);
  await page.click("#consbar .iosbar-back");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 5000 });
  ok(true, "C4 the Conscience bar's back returns to the Prayers home (the sides' one-level return)");

  /* ---- Formation regression spot-check: the series bar stands as shipped ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 5000 });
  ok(await ev(`!document.querySelector('.iosbar')`), "F1 Formation index (tab home): no bar stands");
  await ev(`document.querySelector('[data-podseries="bible"]').click()`);
  await page.waitForSelector(".iosbar", { timeout: 5000 });
  ok((await text(".iosbar-title")) === "Bible in a Year",
    "F2 series page: its bar stands as shipped in v447 (Bible in a Year centered) — untouched by the fix");
  await page.click(".iosbar-back");
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 5000 });

  /* ---- 360px geometry ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  page2.on("pageerror", (e) => pageErrors.push("360: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await page2.evaluate(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page2.waitForSelector("#pushbar .iosbar", { timeout: 5000 });
  const geo = await page2.evaluate(`(function(){
    var bar = document.querySelector('#pushbar .iosbar').getBoundingClientRect();
    var brand = document.querySelector('.brandbar').getBoundingClientRect();
    var tog = document.querySelector('#sidetoggle').getBoundingClientRect();
    return { scrollW: document.documentElement.scrollWidth, barTop: Math.round(bar.top), brandBottom: Math.round(brand.bottom),
      barH: Math.round(bar.height), togTop: Math.round(tog.top), barBottom: Math.round(bar.bottom) };
  })()`);
  ok(Math.abs(geo.barTop - geo.brandBottom) <= 1 && geo.togTop >= geo.barBottom - 1 && geo.barH === 44 && geo.scrollW <= 362,
    "G360 block page at 360px: the bar flush under the brand bar, the toggle beneath it, the bar 44px, no new horizontal overflow (362 is the base's own standing measure)", JSON.stringify(geo));
  await page2.evaluate(`window.scrollTo(0, 600)`); await sleep(350);
  const stuck360 = await page2.evaluate(`(function(){ var b = document.querySelector('#pushbar .iosbar').getBoundingClientRect(); var br = document.querySelector('.brandbar').getBoundingClientRect(); return { barTop: Math.round(b.top), brandBottom: Math.round(br.bottom) }; })()`);
  ok(Math.abs(stuck360.barTop - stuck360.brandBottom) <= 1,
    "G360 scrolled: the bar sticks flush under the brand bar at 360px", JSON.stringify(stuck360));

  ok(pageErrors.length === 0, "browser: zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v448: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
