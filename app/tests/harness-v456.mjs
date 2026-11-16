#!/usr/bin/env node
// harness-v456 — Play/pause on the thumbnail (approved To Ship,
// package 30 record 20: D1 A · D2 B). Measured: (1) D1 — on the
// prayer rows the play disc leaves the title line's cluster
// (played dot · ⋮ stand) and stands centered on the thumbnail
// as a compact .playbtn.thumbdisc, keeping data-playkey +
// data-url, so markPlaying's glyph swap and the tap toggle
// stand; unavailable rows (own + external) carry no disc;
// (2) D2 B — the Formation episode rows take the same move:
// podRowString's disc leaves its cluster (podmark · ⋮ stand)
// for the thumbnail (data-podplay), and paintPodOwnSeries'
// disc leaves its cluster seat whole — the cluster held the
// disc alone, so the title row keeps the title alone
// (data-ownplay); the Formation index rows and the video rows
// carry no disc, as today; (3) the mechanism's guard —
// rowArtHtml / podRowArtHtml with no play fragment emit
// byte-as-before, proven at the share sheets (both art
// functions' standing no-fragment callers): the sheet art
// carries no button; (4) standing surfaces — Now Playing's
// #np-play and the dock's #dock-play stand, the reading
// view's own play control stands. Mold: harness-v439's
// whole-client boot (the real SHELL_HTML + APP_CSS + the
// whole COOKED APP_JS, fetch stubbed by path) driven through
// the real UI.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v456 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v457-ship";
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
const count = (s, sub) => s.split(sub).length - 1;

/* ---------------- statics ---------------- */
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]),
    "ST1 the worker-source diff vs the v457-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
  const tc = extractFn(CLIENT, "trackCard");
  const clusterAt = tc.indexOf("var cluster = function ()");
  const clusterBody = tc.slice(clusterAt, tc.indexOf("};", clusterAt));
  ok(!clusterBody.includes("playbtn") && clusterBody.includes("playedDotHtml(t)") && clusterBody.includes("data-rowmenu")
    && count(tc, 'data-playkey="') === 1 && tc.includes("playbtn thumbdisc")
    && count(tc, "rowArtHtml(t, thumbDisc)") === 2 && count(tc, "rowArtHtml(t)") === 2,
    "ST2 D1: trackCard's cluster emits played dot · ⋮ and NO playbtn; the disc stands once, as the thumbDisc fragment (playbtn thumbdisc, data-playkey + data-url), passed to rowArtHtml by the two available branches only — the two unavailable branches call rowArtHtml(t) bare");
  const prs = CLIENT.slice(CLIENT.indexOf("var podRowString = function"), CLIENT.indexOf("var podCollapseEmitted"));
  const prsClusterAt = prs.indexOf('prow-cluster">');
  const prsCluster = prs.slice(prsClusterAt, prs.indexOf("</span></div>", prsClusterAt));
  ok(count(prs, 'data-podplay="') === 1 && prs.indexOf("podRowArtHtml(e, ") > -1 && prs.indexOf("podRowArtHtml(e, ") < prs.indexOf('data-podplay="')
    && !prsCluster.includes("playbtn") && prsCluster.includes("data-podmark") && prsCluster.includes("data-podmenu"),
    "ST3 D2 B: podRowString's disc stands once, inside the podRowArtHtml fragment; its cluster carries podmark · ⋮ and no playbtn");
  const pos = extractFn(CLIENT, "paintPodOwnSeries");
  ok(count(pos, 'data-ownplay="') === 1 && pos.indexOf("podRowArtHtml(e, ") > -1 && pos.indexOf("podRowArtHtml(e, ") < pos.indexOf('data-ownplay="')
    && !pos.includes("prow-cluster"),
    "ST3 D2 B: paintPodOwnSeries' disc stands once, inside the podRowArtHtml fragment; the cluster span stands nowhere in the function (the title row keeps the title alone)");
  const rah = extractFn(CLIENT, "rowArtHtml"), prah = extractFn(CLIENT, "podRowArtHtml");
  ok(rah.startsWith("function rowArtHtml(t, playHtml)") && count(rah, "(playHtml || '')") === 2
    && prah.startsWith("function podRowArtHtml(e, playHtml)") && count(prah, "(playHtml || '')") === 2
    && extractFn(CLIENT, "markPlaying") === extractFn(BASE_CLIENT, "markPlaying")
    && extractFn(CLIENT, "openRead") === extractFn(BASE_CLIENT, "openRead"),
    "ST4 the mechanism + the untouched seats: both art functions take the optional fragment (default-empty at both returns); markPlaying and the reading view (openRead) are byte-identical to the base");
  ok(UI.includes(".playbtn.thumbdisc {") && UI.includes("rgba(22,40,63,.78)") && UI.includes("width:30px") && UI.includes(".playbtn.thumbdisc.playing {"),
    "ST5 ui.ts: the thumb-disc dress stands — 30px disc, translucent navy (the --navy token in rgba form), and a .playing form");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v456-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "ST6 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v457-1";'),
    "ST7 (housekeeping): the SW pin stands at ora-pro-nobis-v457-1 (Ship moves it)");
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
const wav = (id) => "__ORIGIN__/audio/" + id + ".wav";
const DAY = {
  ok: true, date: "2026-11-15", presentedDay: "2026-11-15", dateLabel: "Sunday, November 15, 2026",
  liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" },
  introTexts: {},
  blocks: [
    { block: "Morning", label: "Morning", caption: "Morning prayers", spotifyUrl: "https://open.spotify.com/playlist/morning", tracks: [
      { episodeId: "9000", title: "Morning track 1", durationS: 240, available: true, streamUrl: wav(9000), hasText: true, textUrl: "/api/player/episode-text?episodeId=9000" },
      { episodeId: "9001", title: "Morning track 2", durationS: 240, available: true, streamUrl: wav(9001) },
      { episodeId: "9002", title: "Morning track 3", durationS: 240, available: false },
      { episodeId: "9003", title: "Morning track 4", durationS: 240, available: true, kind: "external", source: "Test Source", streamUrl: wav(9003) },
      { episodeId: "9004", title: "Morning track 5", durationS: 240, available: false, kind: "external", source: "Test Source" },
    ] },
  ],
  episodes: [],
};
const INDEX = { seriesList: [
  { series: "bible", title: "Bible in a Year", kind: "audio", available: true, listenedCount: 0, total: 372, currentLabel: "Day 1", showImageUrl: null },
  { series: "catholictv", title: "CatholicTV", kind: "video", available: true, latestLabel: "Nov 15", showImageUrl: null },
  { series: "the-ai-signal", title: "The AI Signal", kind: "own", available: true, currentLabel: "AI Signal Nov 14", showImageUrl: null },
] };
const SERIES = { series: "bible", kind: "audio", title: "Bible in a Year", available: true, showDesc: "", showImageUrl: null,
  listenedCount: 1, total: 2, currentKey: "d1",
  entries: [
    { key: "d1", label: "Day 1", title: "Genesis", durationS: 60, listened: false, url: wav("d1"), imageUrl: null, descText: null },
    { key: "d2", label: "Day 2", title: "Exodus", durationS: 60, listened: true, listenDate: "2026-11-14", url: wav("d2"), imageUrl: null, descText: null },
  ] };
const OWN = { series: "the-ai-signal", kind: "own", title: "The AI Signal", available: true, showImageUrl: null, currentKey: "ai1",
  entries: [
    { key: "ai1", label: "Nov 14", title: "Signal One", durationS: 120, date: "2026-11-14", streamUrl: wav("ai1") },
    { key: "ai2", label: "Nov 13", title: "Signal Two", durationS: 120, date: "2026-11-13", streamUrl: wav("ai2") },
  ] };
const VIDEO = { series: "catholictv", kind: "video", title: "CatholicTV", available: true,
  videos: [{ id: "vid1", title: "Daily Mass for Monday", dateLabel: "Nov 15, 2026", imageUrl: "", url: "https://www.youtube.com/watch?v=vid1" }] };
const EXAM = { ok: true, date: "2026-11-15", dateLabel: "Saturday, November 15",
  run: { id: 7, date: "2026-11-15", state: "open" },
  categories: ["Commandment I"], focusCategory: "Commandment I",
  prompts: [{ id: 101, category: "Commandment I", text: "First question?" }], entries: [] };
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
var FIX = { DAY: ${JSON.stringify(DAY)}, INDEX: ${JSON.stringify(INDEX)}, SERIES: ${JSON.stringify(SERIES)}, OWN: ${JSON.stringify(OWN)}, VIDEO: ${JSON.stringify(VIDEO)}, EXAM: ${JSON.stringify(EXAM)}, CONF: ${JSON.stringify(CONF)} };
window.fetch = function (path, opts) {
  var p = String(path);
  window.__fetchLog.push(p);
  var J = function (obj) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(obj))); }, text: function () { return Promise.resolve("The episode text stands here."); } }); };
  if (p.indexOf('/api/player/day') === 0) return J(FIX.DAY);
  if (p === '/api/player/podcasts') return J(FIX.INDEX);
  if (p.indexOf('/api/player/podcasts?series=bible') === 0) return J(FIX.SERIES);
  if (p.indexOf('/api/player/podcasts?series=the-ai-signal') === 0) return J(FIX.OWN);
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
  const sr = 8000, secs = 30, dataSize = sr * secs * 2;
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
  await ev(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  await sleep(300);

  /* ---- B1: the block page's rows — the disc on the art, none in the title line ---- */
  const rows = await ev(`(function(){
    var out = {};
    ['9000','9001','9002','9003','9004'].forEach(function (id) {
      var card = document.querySelector('[data-card="' + id + '"]');
      if (!card) { out[id] = null; return; }
      var wrap = card.querySelector('.rowartwrap');
      var disc = wrap ? wrap.querySelector('button.playbtn.thumbdisc') : null;
      var cluster = card.querySelector('.prow-cluster');
      out[id] = { disc: !!disc,
        discKey: disc ? disc.getAttribute('data-playkey') : null,
        discUrl: disc ? !!disc.getAttribute('data-url') : null,
        discInWrap: !!(disc && wrap && wrap.contains(disc)),
        titlePlay: !!card.querySelector('.titlerow .playbtn'),
        clusterPlay: !!(cluster && cluster.querySelector('.playbtn')),
        menu: !!card.querySelector('[data-rowmenu]') };
    });
    return out;
  })()`);
  ok(rows["9000"] && rows["9000"].disc && rows["9000"].discKey === "9000" && rows["9000"].discUrl && rows["9000"].discInWrap && !rows["9000"].titlePlay && !rows["9000"].clusterPlay && rows["9000"].menu
    && rows["9001"] && rows["9001"].disc && !rows["9001"].titlePlay,
    "B1 D1: the available own rows carry the disc centered on the thumbnail (playbtn thumbdisc, data-playkey + data-url standing) and NO disc in the title line or the cluster; the ⋮ stands", JSON.stringify(rows));
  ok(rows["9003"] && rows["9003"].disc && !rows["9003"].titlePlay
    && rows["9002"] && !rows["9002"].disc && rows["9004"] && !rows["9004"].disc,
    "B1 D1: the available external row carries the disc the same way; the unavailable rows (own + external) carry NO disc", JSON.stringify({ e: rows["9003"], u1: rows["9002"], u2: rows["9004"] }));
  const geo = await ev(`(function(){
    var card = document.querySelector('[data-card="9000"]');
    var wrap = card.querySelector('.rowartwrap'), disc = wrap.querySelector('button.thumbdisc');
    var wr = wrap.getBoundingClientRect(), dr = disc.getBoundingClientRect();
    var cs = getComputedStyle(disc);
    return { dx: Math.abs((dr.left + dr.width / 2) - (wr.left + wr.width / 2)), dy: Math.abs((dr.top + dr.height / 2) - (wr.top + wr.height / 2)),
      w: dr.width, h: dr.height, bg: cs.backgroundColor, color: cs.color };
  })()`);
  ok(geo.dx <= 1.5 && geo.dy <= 1.5 && geo.w === 30 && geo.h === 30 && geo.bg === "rgba(22, 40, 63, 0.78)" && geo.color === "rgb(255, 255, 255)",
    "B1 D1: the disc is a 30px disc centered on the 44px thumbnail, translucent navy with a white glyph", JSON.stringify(geo));

  /* ---- B2: tap plays, tap again pauses — the glyph follows ---- */
  await page.click('[data-card="9000"] button.thumbdisc');
  await page.waitForFunction(`(function(){ var a = document.getElementById('audio'); var d = document.querySelector('[data-card="9000"] button.thumbdisc'); return a && !a.paused && d && d.classList.contains('playing'); })()`, null, { timeout: 6000 }).catch(() => {});
  const playing = await ev(`(function(){
    var d = document.querySelector('[data-card="9000"] button.thumbdisc');
    var a = document.getElementById('audio');
    var card = document.querySelector('[data-card="9000"]');
    var cs = getComputedStyle(d);
    return { paused: a.paused, playing: d.classList.contains('playing'), glyph: d.textContent,
      bars: card.classList.contains('barsrow'), bg: cs.backgroundColor, ring: cs.boxShadow };
  })()`);
  ok(!playing.paused && playing.playing && playing.glyph === "❙❙" && playing.bars && playing.bg === "rgb(22, 40, 63)" && playing.ring !== "none",
    "B2 D1: a tap on the thumbnail disc plays — the audio runs, markPlaying dresses the disc .playing and swaps its glyph to ❚❚ (solid navy + the accent ring), and the bars mark stands on the row beneath the disc", JSON.stringify(playing));

  /* ---- B4 (while playing): the dock + Now Playing stand ---- */
  const dock = await ev(`(function(){
    var d = document.getElementById('dock');
    return { visible: !!d && !d.classList.contains('hidden'), play: !!document.getElementById('dock-play') };
  })()`);
  ok(dock.visible && dock.play, "B4 standing surfaces: the dock stands while playing, with its own #dock-play control", JSON.stringify(dock));
  await page.click("#dock-thumb");
  await page.waitForSelector("#np-play", { timeout: 5000 }).catch(() => {});
  const np = await ev(`(function(){
    var b = document.getElementById('np-play');
    return { stands: !!b, thumb: b ? b.classList.contains('thumbdisc') : null, glyph: b ? b.textContent : null };
  })()`);
  ok(np.stands && np.thumb === false && np.glyph === "❙❙",
    "B4 standing surfaces: Now Playing opens from the dock and keeps its own controls — #np-play stands (not a thumbnail disc), reading the transport's pause glyph", JSON.stringify(np));
  await ev(`document.querySelector('.np-sheet').remove()`);

  await page.click('[data-card="9000"] button.thumbdisc');
  await page.waitForFunction(`(function(){ var a = document.getElementById('audio'); var c = document.querySelector('[data-card="9000"]'); return a && a.paused && c && c.classList.contains('barspaused'); })()`, null, { timeout: 6000 }).catch(() => {});
  const paused = await ev(`(function(){
    var d = document.querySelector('[data-card="9000"] button.thumbdisc');
    var card = document.querySelector('[data-card="9000"]');
    return { paused: document.getElementById('audio').paused, playing: d.classList.contains('playing'), glyph: d.textContent,
      barsPaused: card.classList.contains('barspaused'), dockGlyph: document.getElementById('dock-play').textContent };
  })()`);
  ok(paused.paused && paused.dockGlyph === "▶" && paused.barsPaused && paused.playing && paused.glyph === "❙❙",
    "B2 D1: a second tap on the disc pauses (the standing toggle act) — the audio stands paused, the dock glyph reads ▶, the row's bars freeze; the disc keeps the current-track mark (.playing + ❚❚), exactly as the cluster disc did", JSON.stringify(paused));
  await page.click('[data-card="9000"] button.thumbdisc');
  await page.waitForFunction(`(function(){ var a = document.getElementById('audio'); return a && !a.paused; })()`, null, { timeout: 6000 }).catch(() => {});
  const resumed = await ev(`(function(){
    var d = document.querySelector('[data-card="9000"] button.thumbdisc');
    return { paused: document.getElementById('audio').paused, playing: d.classList.contains('playing'), glyph: d.textContent };
  })()`);
  ok(!resumed.paused && resumed.playing && resumed.glyph === "❙❙",
    "B2 D1: a third tap on the disc plays again — the toggle round-trips on the thumbnail seat", JSON.stringify(resumed));
  await page.click('[data-card="9000"] button.thumbdisc');
  await page.waitForFunction(`(function(){ var a = document.getElementById('audio'); return a && a.paused; })()`, null, { timeout: 6000 }).catch(() => {});

  /* ---- B3: the row ⋮ menu + the Share sheet's art carries no button ---- */
  await page.click('[data-card="9000"] [data-rowmenu]');
  await page.waitForSelector(".anchmenu", { timeout: 5000 });
  await sleep(150);
  const shareIdx = await ev(`(function(){
    var labels = Array.prototype.map.call(document.querySelectorAll('.anchmenu [data-menuitem]'), function (r) { return r.querySelector('.grow').textContent; });
    return labels.indexOf('Share');
  })()`);
  ok(shareIdx > -1, "B3 the row ⋮ menu opens as today (Share stands in it)", "shareIdx=" + shareIdx);
  await ev(`document.querySelectorAll('.anchmenu [data-menuitem]')[${shareIdx}].click()`);
  await page.waitForSelector(".sharesheet", { timeout: 5000 }).catch(() => {});
  const share = await ev(`(function(){
    var w = document.querySelector('.sharesheet .rowartwrap');
    return { wrap: !!w, btn: w ? !!w.querySelector('button') : null, anyBtn: !!document.querySelector('.sharesheet [data-playkey]') };
  })()`);
  ok(share.wrap && share.btn === false && !share.anyBtn,
    "B3 the mechanism's guard: the track Share sheet's art (rowArtHtml with no fragment) carries NO button", JSON.stringify(share));
  await ev(`document.querySelector('.sharesheet').remove()`);

  /* ---- B5: the reading view keeps its own play control ---- */
  await page.click('[data-card="9000"] [data-read]');
  await page.waitForSelector(".readsheet [data-playkey]", { timeout: 5000 }).catch(() => {});
  const read = await ev(`(function(){
    var b = document.querySelector('.readsheet [data-playkey]');
    return { stands: !!b, thumb: b ? b.classList.contains('thumbdisc') : null, inWrap: b ? !!b.closest('.rowartwrap') : null };
  })()`);
  ok(read.stands && read.thumb === false && read.inWrap === false,
    "B5 standing surfaces: the reading view's own play control stands as today — a plain playbtn in the sheet's head row, not a thumbnail disc", JSON.stringify(read));
  await ev(`document.querySelector('.readsheet').remove()`);

  /* ---- F1: the Formation index rows carry no disc ---- */
  await page.click('#tabbar [data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries="bible"]', { timeout: 6000 });
  await sleep(300);
  const idx = await ev(`(function(){
    return { playbtns: document.querySelectorAll('#view .playbtn').length,
      series: Array.prototype.map.call(document.querySelectorAll('[data-podseries]'), function (e) { return e.getAttribute('data-podseries'); }) };
  })()`);
  ok(idx.playbtns === 0 && JSON.stringify(idx.series) === JSON.stringify(["bible", "catholictv", "the-ai-signal"]),
    "F1 D2 B: the Formation index stands as today — the series cards (audio · video · The AI Signal) carry NO disc", JSON.stringify(idx));

  /* ---- F2: the podcast series rows ---- */
  await page.click('[data-podseries="bible"]');
  await page.waitForSelector("#hdrrow2 [data-podback]", { timeout: 6000 });
  await sleep(300);
  const prows = await ev(`(function(){
    var out = {};
    ['d1','d2'].forEach(function (k) {
      var row = document.querySelector('[data-podrow="' + k + '"]');
      var wrap = row.querySelector('.rowartwrap');
      var disc = wrap ? wrap.querySelector('button.playbtn.thumbdisc') : null;
      var cluster = row.querySelector('.prow-cluster');
      out[k] = { disc: !!disc, key: disc ? disc.getAttribute('data-podplay') : null,
        clusterPlay: !!(cluster && cluster.querySelector('.playbtn')),
        mark: !!(cluster && cluster.querySelector('[data-podmark]')), markOn: !!(cluster && cluster.querySelector('[data-podmark].on')),
        menu: !!(cluster && cluster.querySelector('[data-podmenu]')) };
    });
    return out;
  })()`);
  ok(prows.d1.disc && prows.d1.key === "d1" && !prows.d1.clusterPlay && prows.d1.mark && !prows.d1.markOn && prows.d1.menu
    && prows.d2.disc && prows.d2.key === "d2" && !prows.d2.clusterPlay && prows.d2.markOn,
    "F2 D2 B: the podcast episode rows carry the disc on the thumbnail (data-podplay standing); the cluster keeps podmark · ⋮ with no disc — the listened row's mark reads on", JSON.stringify(prows));
  await page.click('[data-podrow="d1"] button.thumbdisc');
  await page.waitForFunction(`(function(){ var a = document.getElementById('audio'); var r = document.querySelector('[data-podrow="d1"]'); return a && !a.paused && r && r.classList.contains('barsrow'); })()`, null, { timeout: 6000 }).catch(() => {});
  const podPlay = await ev(`(function(){
    return { paused: document.getElementById('audio').paused, bars: document.querySelector('[data-podrow="d1"]').classList.contains('barsrow') };
  })()`);
  ok(!podPlay.paused && podPlay.bars,
    "F2 D2 B: a tap on the episode row's thumbnail disc starts the queue from that entry (the standing act) — the audio runs and the bars mark stands on the row", JSON.stringify(podPlay));
  await page.click('[data-podrow="d1"] [data-podmenu]');
  await page.waitForSelector(".anchmenu", { timeout: 5000 });
  await sleep(150);
  const podShareIdx = await ev(`(function(){
    var labels = Array.prototype.map.call(document.querySelectorAll('.anchmenu [data-menuitem]'), function (r) { return r.querySelector('.grow').textContent; });
    return labels.indexOf('Share');
  })()`);
  await ev(`document.querySelectorAll('.anchmenu [data-menuitem]')[${podShareIdx}].click()`);
  await page.waitForSelector(".sharesheet", { timeout: 5000 }).catch(() => {});
  const podShare = await ev(`(function(){
    var w = document.querySelector('.sharesheet .rowartwrap');
    return { wrap: !!w, btn: w ? !!w.querySelector('button') : null };
  })()`);
  ok(podShareIdx > -1 && podShare.wrap && podShare.btn === false,
    "F2 the mechanism's guard: the podcast row's Share sheet art (podRowArtHtml with no fragment) carries NO button", JSON.stringify({ i: podShareIdx, s: podShare }));
  await ev(`document.querySelector('.sharesheet').remove()`);
  await page.click("#hdrrow2 [data-podback]");
  await page.waitForSelector('[data-podseries="the-ai-signal"]', { timeout: 6000 });
  await sleep(200);

  /* ---- F3: the own-series rows (The AI Signal) ---- */
  await page.click('[data-podseries="the-ai-signal"]');
  await page.waitForSelector('[data-podrow="ai1"]', { timeout: 6000 });
  await sleep(300);
  const orows = await ev(`(function(){
    var out = {};
    ['ai1','ai2'].forEach(function (k) {
      var row = document.querySelector('[data-podrow="' + k + '"]');
      var wrap = row.querySelector('.rowartwrap');
      var disc = wrap ? wrap.querySelector('button.playbtn.thumbdisc') : null;
      var title = row.querySelector('.titlerow');
      out[k] = { disc: !!disc, key: disc ? disc.getAttribute('data-ownplay') : null,
        cluster: !!row.querySelector('.prow-cluster'), titleKids: title ? title.children.length : -1 };
    });
    return out;
  })()`);
  ok(orows.ai1.disc && orows.ai1.key === "ai1" && !orows.ai1.cluster && orows.ai1.titleKids === 1
    && orows.ai2.disc && orows.ai2.key === "ai2" && !orows.ai2.cluster,
    "F3 D2 B: The AI Signal's rows carry the disc on the thumbnail (data-ownplay standing); NO cluster stands in the title row — it keeps the title alone", JSON.stringify(orows));
  await page.click('[data-podrow="ai1"] button.thumbdisc');
  await page.waitForFunction(`(function(){ var a = document.getElementById('audio'); var r = document.querySelector('[data-podrow="ai1"]'); return a && !a.paused && r && r.classList.contains('barsrow'); })()`, null, { timeout: 6000 }).catch(() => {});
  const ownPlay = await ev(`(function(){
    return { paused: document.getElementById('audio').paused, bars: document.querySelector('[data-podrow="ai1"]').classList.contains('barsrow') };
  })()`);
  ok(!ownPlay.paused && ownPlay.bars,
    "F3 D2 B: a tap on the own row's thumbnail disc starts its queue from that entry (the standing act) — the audio runs and the bars mark stands on the row", JSON.stringify(ownPlay));
  await page.click("#hdrrow2 [data-podback]");
  await page.waitForSelector('[data-podseries="catholictv"]', { timeout: 6000 });
  await sleep(200);

  /* ---- F4: the video rows carry no disc ---- */
  await page.click('[data-podseries="catholictv"]');
  await page.waitForSelector("#hdrrow2 [data-podback]", { timeout: 6000 });
  await sleep(300);
  const vid = await ev(`(function(){ return { playbtns: document.querySelectorAll('#view .playbtn').length, rows: document.querySelectorAll('#view .card').length }; })()`);
  ok(vid.playbtns === 0 && vid.rows > 0,
    "F4 D2 B: the video series page stands untouched — its rows' one act is open-and-watch; no disc stands anywhere on the page", JSON.stringify(vid));

  /* ---- G360: the block page at 360px ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  page2.on("pageerror", (e) => pageErrors.push("360: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(300);
  await page2.evaluate(`document.querySelector('[data-openblock="Morning"]').click()`);
  await page2.waitForSelector("#hdrrow2 [data-back]", { timeout: 6000 });
  const g = await page2.evaluate(`(function(){
    var card = document.querySelector('[data-card="9000"]');
    var wrap = card.querySelector('.rowartwrap'), disc = wrap.querySelector('button.thumbdisc');
    var wr = wrap.getBoundingClientRect(), dr = disc.getBoundingClientRect();
    return { scrollW: document.documentElement.scrollWidth,
      dx: Math.abs((dr.left + dr.width / 2) - (wr.left + wr.width / 2)), dy: Math.abs((dr.top + dr.height / 2) - (wr.top + wr.height / 2)) };
  })()`);
  ok(g.scrollW <= 362 && g.dx <= 1.5 && g.dy <= 1.5,
    "G360 block page at 360px: the disc stands centered on the thumbnail; no new horizontal overflow (362 is the base's own standing measure)", JSON.stringify(g));

  ok(pageErrors.length === 0, "browser: zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v456: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
