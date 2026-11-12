// harness-v384.mjs — v384 INTENTIONS IN THE PLAYER legs (§2.8 T1–T9 + statics).
// Mold: harness-v375 (verbatim extraction from the candidate client.ts,
// speechSynthesis stub, hook assertions, http-origin page, Playwright).
// v384 deltas: the spoken descriptor is GONE — a paired prayer carries
// intentionText on its own descriptor and its start runs a speech STEP
// inside the start (speakStep → speakIntro(desc, onDone)); completion is
// ONE token-bound callback (finishSpoken). Legs assert the step, the
// C2 rule (every web onerror kind under the live token completes), the
// toggle (opn-intentions-v384) on both surfaces, the retirement sweep,
// the restore edge, and both speech routes. Runs ONLY inside a
// .worktrees path (hard guard, the standing rule).
import http from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const ROOT = process.cwd();
if (!ROOT.includes(".worktrees")) { console.error("REFUSING: harness runs only inside a .worktrees tree"); process.exit(2); }
const CLIENT = fs.readFileSync(ROOT + "/app/worker/src/client.ts", "utf8");
const UI_TS = fs.readFileSync(ROOT + "/app/worker/src/ui.ts", "utf8");
const INDEX = fs.readFileSync(ROOT + "/app/worker/src/index.ts", "utf8");

// ---------- extraction (scan-driven: every top-level function, verbatim) ----------
const lines = CLIENT.split("\n");
const fnStarts = [];
const varStarts = [];
lines.forEach((l, i) => {
  const mf = l.match(/^function ([A-Za-z_$][\w$]*)\s*\(/);
  if (mf) fnStarts.push({ name: mf[1], i });
  const mv = l.match(/^var ([A-Za-z_$][\w$]*)\s*=/);
  if (mv) varStarts.push({ name: mv[1], i });
});
const bounds = [...fnStarts.map((s) => s.i), ...varStarts.map((s) => s.i)].sort((a, b) => a - b);
function unit(name) {
  const s = fnStarts.find((x) => x.name === name);
  if (!s) return null;
  // Trim to the function's own closing brace: candidate ends are the
  // lines where naive brace depth returns to 0, plus the declaration
  // bounds; the first candidate that parses as one function wins.
  // (A raw bound slice would swallow inter-function top-level
  // statements, which must NOT run in the fixture page.)
  const candidates = [];
  let depth = 0, opened = false;
  for (let j = s.i; j < lines.length; j++) {
    for (const ch of lines[j]) { if (ch === "{") { depth++; opened = true; } else if (ch === "}") depth--; }
    if (opened && depth === 0) candidates.push(j + 1);
    if (candidates.length > 40) break;
  }
  for (const b of bounds) if (b > s.i) candidates.push(b);
  candidates.push(lines.length);
  for (const end of [...new Set(candidates)].sort((a, b) => a - b)) {
    const code = lines.slice(s.i, end).join("\n");
    try { new Function(code); return code; } catch (e) { /* next candidate */ }
  }
  return null;
}
function lineMatching(re) {
  const i = lines.findIndex((l) => re.test(l));
  return i < 0 ? null : lines[i];
}
function segFrom(re) {
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return null;
  let j = i;
  while (j < lines.length && lines[j] !== "};") j++;
  return lines.slice(i, j + 1).join("\n");
}
// Fixture seams (v375 pattern): functions whose real bodies need the
// full app DOM the fixture does not build. Declared FIRST; a real
// extraction of the same name would override — both are excluded.
// openGuideEditor: the guide-editor sheet (not a v384 surface); its
// body runs into the APP_JS template tail, so no clean unit exists.
const EXCLUDE = new Set(["refreshPlayedChrome", "extFetchText", "openGuideEditor"]);
const extracted = [];
const missing = [];
const dropped = [];
for (const s of fnStarts) {
  if (EXCLUDE.has(s.name)) continue;
  const u = unit(s.name);
  if (u) extracted.push(u); else dropped.push(s.name);
}
const varPieces = [];
// Every top-level var line that parses standalone (data constants,
// feed URLs, caches) — `state` is the fixture's own, never extracted;
// multi-line objects come in through the segment pulls below.
for (const v of varStarts) {
  if (v.name === "state") continue;
  const l = lines[v.i];
  try { new Function(l); varPieces.push(l); } catch (e) { /* multi-line: segment pull or inert */ }
}
for (const re of [/^var speech = \{/, /^var speechTimers = \{/, /^var fade = \{/, /^var mediaHandlers = \{/, /window\.__opnSpeech = \{/]) {
  const s = segFrom(re);
  if (s) varPieces.push(s); else missing.push(String(re));
}
const CLIENT_JS = [
  "function refreshPlayedChrome() {}",
  "function extFetchText(url) { window.__extFetches.push(String(url)); return Promise.resolve(''); }",
  ...varPieces,
  ...extracted,
].join("\n");

// ---------- page ----------
const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>opn-v384-harness</title></head>
<body>
<div id="view"></div>
<nav id="tabbar"></nav>
<audio id="audio" preload="auto"></audio>
<div id="dock" class="hidden">
  <div id="dock-title"></div><div id="dock-meta"></div>
  <button id="dock-play">Play</button>
  <button id="dock-autoplay" class="docknext dockauto" aria-pressed="true">Autoplay On</button>
  <button id="dock-intentions" class="docknext dockauto" aria-pressed="true">Intentions On</button>
  <button id="dock-next">Next</button>
  <div id="dock-progress-fill"></div>
</div>
<script>
window.__extFetches = [];
window.__spokenTexts = [];
window.__lastUtterance = null;
window.__cancelCount = 0;
window.__speechMode = 'normal';
function FixtureUtterance(text) { this.text = text; this.voice = null; this.lang = ''; this.rate = 1; this.pitch = 1; this.onstart = null; this.onend = null; this.onerror = null; }
Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FixtureUtterance, configurable: true, writable: true });
Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: {
  speaking: false, pending: false,
  __voices: [{ lang: 'en-US', name: 'Fixture US English', default: true }, { lang: 'en-GB', name: 'Fixture GB', default: false }],
  getVoices: function () { return this.__voices; },
  addEventListener: function () {}, removeEventListener: function () {},
  speak: function (u) {
    window.__lastUtterance = u; window.__spokenTexts.push(u.text);
    var mode = window.__speechMode || 'normal';
    if (mode === 'normal') {
      setTimeout(function () { if (u.onstart) u.onstart({}); }, 5);
      setTimeout(function () { if (u.onend) u.onend({}); }, 45);
    } else if (mode === 'interrupt') {
      setTimeout(function () { if (u.onerror) u.onerror({ error: 'interrupted' }); }, 30);
    } else if (mode === 'error-kind') {
      setTimeout(function () { if (u.onstart) u.onstart({}); }, 5);
      setTimeout(function () { if (u.onerror) u.onerror({ error: 'audio-busy' }); }, 25);
    } else if (mode === 'never-end') {
      setTimeout(function () { if (u.onstart) u.onstart({}); }, 5);
    } else if (mode === 'never-start') { /* nothing ever fires */ }
  },
  cancel: function () { window.__cancelCount++; },
  pause: function () {}, resume: function () {}
} });
</script>
<script>
${CLIENT_JS}
</script>
</body></html>`;

const BRIDGE_INIT = `
window.__bridgeCalls = [];
window.__bridgeListeners = {};
window.Capacitor = { Plugins: { OraDayBridge: {
  speakText: function (args) { window.__bridgeCalls.push(['speakText', args]); return Promise.resolve(); },
  stopSpeech: function () { window.__bridgeCalls.push(['stopSpeech']); return Promise.resolve(); },
  setState: function (s) { window.__bridgeCalls.push(['setState']); return Promise.resolve(); },
  addListener: function (name, fn) { (window.__bridgeListeners[name] = window.__bridgeListeners[name] || []).push(fn); return Promise.resolve({ remove: function () {} }); }
}}};
`;

// ---------- fixture JS (injected per leg) ----------
const FIXTURE_JS = `
window.__fixtureLoaded = true;
function freshState() {
  return { ownStanding: [], extStanding: [], ownSlots: {}, extSlots: {},
    dayDescs: [], dayPayload: null, daySegments: [], presentedDay: '2026-11-12', storedDay: '2026-11-12',
    dateLabel: 'Thursday, November 12, 2026', playedCache: null, readTracks: {}, current: null,
    queue: [], queueIdx: -1, repeatIds: {}, introRec: null, rate: 1, sleep: { mode: 'off' },
    pendingResume: null, lastStartAt: 0, errWaitKey: null, errWaitN: 0, restoredQueue: null,
    restoreProbe: null, previewQueue: null, queuePreviewIdx: -1, liturgical: null, playingUrl: null };
}
function mkDay(specs) {
  var day = { presentedDay: '2026-11-12', date: '2026-11-12', presented: '2026-11-12', dateStr: '2026-11-12', dateLabel: 'Thursday, November 12, 2026', introTexts: {}, intros: null, blocks: [], __tracks: [] };
  var byBlock = {};
  specs.forEach(function (s) {
    var t = { episodeId: s.id, title: s.title, streamUrl: 'https://audio.invalid/' + s.id + '.mp3', available: true, _block: s.block, source: 'own', durationS: 180 };
    day.__tracks.push(t);
    if (!byBlock[s.block]) { byBlock[s.block] = { block: s.block, tracks: [] }; day.blocks.push(byBlock[s.block]); }
    byBlock[s.block].tracks.push(t);
    if (s.intro) day.introTexts[s.id] = s.intro;
  });
  return day;
}
function buildDescs(day) {
  day.intros = buildIntroMap(day);
  var out = [];
  day.__tracks.forEach(function (t) { expandDescs(t, day).forEach(function (d) { out.push(d); }); });
  return out;
}
function buildSheet() {
  document.getElementById('view').innerHTML = '<div class="np-sheet" id="np-sheet">'
    + '<div id="np-title"></div><div id="np-meta"></div><div id="np-intention"></div><div id="np-day"></div>'
    + '<button id="np-play"></button><button id="np-prev"></button><button id="np-next"></button>'
    + '<button id="np-speed"></button><button id="np-sleep"></button><button id="np-read"></button>'
    + '<button id="np-autoplay" class="settoggle" aria-pressed="true">Autoplay On</button>'
    + '<button id="np-intentions" class="settoggle" aria-pressed="true">Intentions On</button>'
    + '<div id="np-queue-pos"></div><div id="np-queue"></div>'
    + '<span id="np-elapsed"></span><input id="np-seek" type="range" value="0"><span id="np-remain"></span></div>';
}
function sleepMs(n) { return new Promise(function (r) { setTimeout(r, n); }); }
function endTrack() {
  // The element 'ended' handler's own dispatch (mark, queue advance,
  // chain on exhaustion / single play) — the seam the T2/T4/T6 legs
  // drive, since the anonymous listener itself is not extractable.
  var endedDesc = state.current;
  markCompleted(state.current);
  if (state.queue.length) {
    if (advanceQueue(1)) return;
    if (autoplayOn()) chainForward(endedDesc);
    return;
  }
  if (autoplayOn() && chainForward(endedDesc)) return;
  state.current = null; setPlaybackState('none'); markPlaying(null); updateDock();
}
async function waitFor(fn, timeoutMs) {
  var t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (fn()) return Date.now() - t0; await sleepMs(25); }
  return -1;
}
`;

let failures = 0, total = 0;
function ok(cond, label, extra) {
  total++;
  if (cond) console.log("PASS " + label);
  else { failures++; console.log("FAIL " + label + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}

const server = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE_HTML); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port + "/";
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

async function newPage(bridge) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR: " + e.message));
  if (bridge) await page.addInitScript(BRIDGE_INIT);
  await page.goto(ORIGIN);
  await page.evaluate(FIXTURE_JS);
  return { ctx, page };
}

// ---------- S: smoke — the fixture day builds the v384 descriptor shape ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(() => {
    state = freshState();
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two" },
    ]);
    const descs = buildDescs(day);
    return { n: descs.length, ids: descs.map((d) => d.episodeId), texts: descs.map((d) => d.intentionText || null),
      kinds: descs.map((d) => d.kind || null), anySpoken: descs.some((d) => d.spoken) };
  });
  ok(r.n === 2, "S1 day builds two descriptors (prayers only)", r);
  ok(r.texts[0] === "intention one" && r.texts[1] === null, "S2 intentionText stamped on the prayer; unpaired prayer carries none", r.texts);
  ok(!r.anySpoken && !r.ids.some((i) => String(i).startsWith("intro:")), "S3 no spoken descriptor, no intro: ids anywhere in the build", r);
  await ctx.close();
}

// ---------- T1: speech present, order proven ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    startQueue(descs.slice(), true);
    const during = { hook: window.__opnSpeech.state(), src: document.getElementById("audio").getAttribute("src") || "",
      spoken: window.__spokenTexts.slice(), cur: state.current && state.current.episodeId };
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    return { during, waited, srcAfter: document.getElementById("audio").getAttribute("src") || "",
      hookAfter: window.__opnSpeech.state(), curAfter: state.current && state.current.episodeId };
  });
  ok(r.during.hook.active === true && r.during.cur === "midday-p1", "T1a step active with the PRAYER's id from the first instant", r.during);
  ok(r.during.spoken[0] === "This prayer is for intention one", "T1b spoken script is exactly the standing intro script", r.during.spoken);
  ok(r.during.src === "", "T1c element carries no src during the step", r.during);
  ok(r.waited >= 0 && r.srcAfter.includes("midday-p1.mp3") && r.hookAfter.active === false, "T1d on the end signal the element loads that prayer's URL", r);
  await ctx.close();
}

// ---------- T2: no pause at the boundary (the headline leg) ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    setAutoplay(true);
    const specs = [1, 2, 3, 4].map((i) => ({ id: "midday-p" + i, block: "midday", title: "Prayer " + i, intro: "intention " + i }));
    const day = mkDay(specs);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    state.dayPayload = day;
    startQueue(descs.slice(), true);
    const seen = [];
    let boundaryStall = false;
    for (let k = 0; k < 4; k++) {
      const w = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p" + (k + 1) + ".mp3"), 4000);
      if (w < 0) { boundaryStall = true; break; }
      seen.push(state.current && state.current.episodeId);
      if (state.queue.some((d) => d.spoken || d.kind === 'intention')) boundaryStall = true;
      if (k < 3) endTrack(); // the ended seam
    }
    return { seen, boundaryStall, spoken: window.__spokenTexts.slice(), queueLen: state.queue.length };
  });
  ok(!r.boundaryStall && r.seen.join(",") === "midday-p1,midday-p2,midday-p3,midday-p4", "T2a four pairs run continuously, speech-end to audio start inside one start each", r);
  ok(r.spoken.length === 4 && r.spoken.every((t, i) => t === "This prayer is for intention " + (i + 1)), "T2b every transition carries its step; the queue holds prayers only throughout", r);
  await ctx.close();
}

// ---------- T3: the speech-absent routes, each ----------
{
  // (a) C2's regression leg: system cancel, web onerror 'interrupted' under the live token
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    window.__speechMode = "interrupt";
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    const t0 = Date.now();
    startDesc(descs[0]);
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 6000);
    return { waited, elapsed: Date.now() - t0 };
  });
  ok(r.waited >= 0 && r.elapsed < 5000, "T3a system cancel (interrupted, no canceller) completes the step; the prayer plays inside the start bound, not the cap", r);
  await ctx.close();
}
{
  // (b) native oraSpeechError under the live id
  const { ctx, page } = await newPage(true);
  const r = await page.evaluate(async () => {
    state = freshState();
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    startDesc(descs[0]);
    const hook = window.__opnSpeech.state();
    const fns = window.__bridgeListeners["oraSpeechError"] || [];
    fns.forEach((f) => f({ id: hook.nativeId }));
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    return { hook, waited };
  });
  ok(r.hook.native === true && r.waited >= 0, "T3b native Error under the live id completes the step; the prayer plays", r);
  await ctx.close();
}
{
  // (c) no start event inside 3 s -> the start bound completes the step
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    window.__speechMode = "never-start";
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    const t0 = Date.now();
    startDesc(descs[0]);
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 8000);
    return { waited, elapsed: Date.now() - t0 };
  });
  ok(r.waited >= 0 && r.elapsed >= 2500 && r.elapsed < 8000, "T3c no start event: the prayer plays at the 3 s start bound", r);
  await ctx.close();
}
{
  // (d) a hung utterance -> the total cap completes the step, never past it
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    window.__speechMode = "never-end";
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    const t0 = Date.now();
    startDesc(descs[0]);
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 45000);
    return { waited, elapsed: Date.now() - t0 };
  });
  ok(r.waited >= 0 && r.elapsed >= 20000 && r.elapsed < 45000, "T3d hung utterance: the prayer plays at the total cap (30-90 s band), never past it", r);
  await ctx.close();
}
{
  // (e) no transport at all -> the prayer plays at once
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    delete window.speechSynthesis;
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    startDesc(descs[0]);
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 2000);
    return { waited };
  });
  ok(r.waited >= 0, "T3e no speech transport: the prayer plays at once", r);
  await ctx.close();
}
{
  // (f) backgrounded at the start -> no speech, the prayer plays at once (D5)
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    startDesc(descs[0]);
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 2000);
    return { waited, spoken: window.__spokenTexts.length };
  });
  ok(r.waited >= 0 && r.spoken === 0, "T3f hidden at the start: speech skipped, the prayer plays at once", r);
  await ctx.close();
}

// ---------- T4: toggle, both surfaces ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const out = {};
    out.freshReadsOn = intentionsOn();
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two", intro: "intention two" },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    // OFF: no step, and the NP line stands absent (emptied + display:none)
    setIntentions(false);
    out.storeOff = localStorage.getItem("opn-intentions-v384");
    startDesc(descs[0]);
    out.offSpoken = window.__spokenTexts.length;
    out.offSrcNow = (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3");
    buildSheet(); updateNowPlaying();
    const npInt = document.getElementById("np-intention");
    out.offNp = { display: npInt.style.display, text: npInt.textContent };
    out.offSync = { dock: document.getElementById("dock-intentions").getAttribute("aria-pressed"),
      np: document.getElementById("np-intentions").getAttribute("aria-pressed") };
    // ON: both restore
    setIntentions(true);
    updateNowPlaying();
    out.onNp = { display: npInt.style.display, text: npInt.textContent };
    out.onSync = { dock: document.getElementById("dock-intentions").getAttribute("aria-pressed"),
      np: document.getElementById("np-intentions").getAttribute("aria-pressed") };
    return out;
  });
  ok(r.freshReadsOn === true, "T4a a fresh store reads ON (default)", r);
  ok(r.storeOff === "off" && r.offSpoken === 0 && r.offSrcNow === true, "T4b OFF: a paired prayer starts with no step, audio at once", r);
  ok(r.offNp.display === "none" && r.offNp.text === "", "T4c OFF: the player line is absent, not blank (emptied + display:none)", r.offNp);
  ok(r.offSync.dock === "false" && r.offSync.np === "false" && r.onSync.dock === "true" && r.onSync.np === "true", "T4d the dock + Now Playing switches stay in sync through flips", r);
  ok(r.onNp.text === "Prayer Intention: intention one" && r.onNp.display !== "none", "T4e ON: the line restores from the current prayer's intentionText", r.onNp);
  // mid-queue flip takes effect on the next prayer (read-at-play-time)
  const r2 = await page.evaluate(async () => {
    state = freshState();
    window.__spokenTexts.length = 0;
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two", intro: "intention two" },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    state.dayPayload = day;
    setIntentions(true);
    startQueue(descs.slice(), true);
    await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    const afterFirst = window.__spokenTexts.length;
    setIntentions(false); // flip between the two prayers of one standing queue
    endTrack();
    const w = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p2.mp3"), 3000);
    return { afterFirst, w, spokenTotal: window.__spokenTexts.length, cur: state.current && state.current.episodeId };
  });
  ok(r2.afterFirst === 1 && r2.w >= 0 && r2.spokenTotal === 1 && r2.cur === "midday-p2", "T4f a mid-queue flip takes effect on the next prayer with no reload", r2);
  // the store survives a reload; a fresh context reads ON
  await page.reload(); await page.evaluate(FIXTURE_JS);
  const persisted = await page.evaluate(() => { state = freshState(); return intentionsOn(); });
  ok(persisted === false, "T4g the store survives a reload", { persisted });
  await ctx.close();
  const fresh = await newPage(false);
  const freshOn = await fresh.page.evaluate(() => { state = freshState(); return intentionsOn(); });
  ok(freshOn === true, "T4h a fresh store in a new context reads ON", { freshOn });
  await fresh.ctx.close();
}

// ---------- T5: navigation and transport mid-unit ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const out = {};
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two", intro: "intention two" },
      { id: "midday-p3", block: "midday", title: "Prayer Three", intro: "intention three" },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    startQueue(descs.slice(), true);
    out.inStep = window.__opnSpeech.state().active === true;
    // seek during the step is inert
    const audio = document.getElementById("audio");
    handleTransportCommand({ detail: { action: "seekTo", seekTime: 50 } });
    out.seekInert = audio.currentTime === 0 && !(audio.getAttribute("src") || "");
    // next during the step: departed speech token-dead, landed prayer runs its own start
    const departed = window.__lastUtterance;
    advanceQueue(1);
    out.landed = state.current && state.current.episodeId;
    out.landedSpeaking = window.__opnSpeech.state().active === true;
    if (departed && departed.onend) departed.onend({}); // the departed utterance's late end event
    await sleepMs(80);
    out.afterLateEnd = { cur: state.current && state.current.episodeId, src: audio.getAttribute("src") || "", spoken: window.__spokenTexts.slice() };
    await waitFor(() => (audio.getAttribute("src") || "").includes("midday-p2.mp3"), 3000);
    // previous mid-audio: the landed prayer re-runs its start sequence
    const before = window.__spokenTexts.length;
    advanceQueue(-1);
    out.prevReran = { cur: state.current && state.current.episodeId, speaking: window.__opnSpeech.state().active === true, spokenBefore: before };
    await waitFor(() => (audio.getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    out.prevSpoken = window.__spokenTexts.slice();
    return out;
  });
  ok(r.inStep && r.seekInert, "T5a seek during a speech step is inert", r);
  ok(r.landed === "midday-p2" && r.landedSpeaking === true, "T5b next during a step lands on the next prayer, which runs its own start", r);
  ok(r.afterLateEnd.cur === "midday-p2" && !r.afterLateEnd.src.includes("midday-p1") && r.afterLateEnd.spoken.filter((t) => t.includes("intention two")).length === 1, "T5c the departed speech is token-dead: its late end event starts nothing", r.afterLateEnd);
  ok(r.prevReran.cur === "midday-p1" && r.prevReran.speaking === true && r.prevSpoken.filter((t) => t.includes("intention one")).length >= 2, "T5d previous mid-audio re-runs the landed prayer's own start sequence", r);
  await ctx.close();
}
{
  // pause during a step -> unit stands paused pre-audio; resume re-speaks from the start
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    startDesc(descs[0]);
    const inStep = window.__opnSpeech.state().active === true;
    pauseTransport();
    const paused = { hook: window.__opnSpeech.state(), src: document.getElementById("audio").getAttribute("src") || "",
      phase: inSpeechPhase(), playing: transportPlaying() };
    const spokenBefore = window.__spokenTexts.length;
    resumeCurrent();
    const respeaking = window.__opnSpeech.state().active === true;
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    return { inStep, paused, spokenBefore, spokenAfter: window.__spokenTexts.length, respeaking, waited };
  });
  ok(r.inStep && r.paused.hook.paused === true && r.paused.src === "" && r.paused.phase === true && r.paused.playing === false, "T5e pause during a step: the unit stands paused pre-audio (nothing loaded)", r);
  ok(r.respeaking && r.spokenAfter === r.spokenBefore + 1 && r.waited >= 0, "T5f resume re-speaks from the start, then loads the audio", r);
  await ctx.close();
}

// ---------- T6: autoplay, the v358 class ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const out = {};
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "afternoon-a1", block: "afternoon", title: "Prayer A One", intro: "intention a one" },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    state.dayPayload = day;
    // autoplay OFF: a single play's end does not chain, no step started for a next unit
    setAutoplay(false);
    playTrack(descs[0]);
    await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    endTrack();
    await sleepMs(120);
    out.offEnd = { cur: state.current && state.current.episodeId, spoken: window.__spokenTexts.length };
    // autoplay ON: the chain crosses the block boundary and carries the boundary prayer's step
    setAutoplay(true);
    window.__spokenTexts.length = 0;
    startQueue(descs.slice(), true);
    await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    endTrack();
    const wBoundary = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("afternoon-a1.mp3"), 3000);
    out.boundary = { w: wBoundary, cur: state.current && state.current.episodeId, spoken: window.__spokenTexts.slice() };
    // the queue's end is the day's end: clean stop, no step started
    endTrack();
    await sleepMs(120);
    out.endStop = { cur: state.current && state.current.episodeId, spoken: window.__spokenTexts.length, idx: state.queueIdx, qlen: state.queue.length };
    return out;
  });
  ok(r.offEnd.cur === null && r.offEnd.spoken === 1, "T6a autoplay OFF stops at a single play's end (the standing stop: current clears), with no step started", r.offEnd);
  ok(r.boundary.w >= 0 && r.boundary.cur === "afternoon-a1" && r.boundary.spoken.some((t) => t === "This prayer is for intention a one"), "T6b a chain across a block boundary carries the boundary prayer's step", r.boundary);
  ok(r.endStop.cur === null && r.endStop.spoken === 2 && r.endStop.qlen === 0, "T6c a Play All queue's end is the day's end: empty tail, clean stop (queue clears, no step started)", r.endStop);
  await ctx.close();
}

// ---------- T7: surfaces ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const out = {};
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two", intro: "intention two" },
      { id: "midday-p3", block: "midday", title: "Prayer Three" },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    const tracks = day.__tracks;
    out.cardCounts = tracks.map((t) => (trackCard(t).match(/card trow/g) || []).length);
    out.cardHasIntentionRow = tracks.some((t) => trackCard(t).includes("intention-row"));
    startQueue(descs.slice(), true);
    buildSheet(); renderQueueList(); updateNowPlaying();
    out.queueRows = document.getElementById("np-queue").children.length;
    out.npTitle = document.getElementById("np-title").textContent;
    out.searchHit = searchResultsHtml(day, "intention two").includes("Prayer Two");
    // played marking lands on the prayer alone; a completed speech step alone marks nothing
    await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    out.playedAfterStepOnly = isPlayed("midday-p1", "2026-11-12", "midday");
    markCompleted(state.current);
    out.playedAfterMark = isPlayed("midday-p1", "2026-11-12", "midday");
    return out;
  });
  ok(r.cardCounts.every((c) => c === 1) && r.cardHasIntentionRow === false, "T7a every block list's card count equals its prayer count; no intention rows anywhere", r);
  ok(r.queueRows === 3, "T7b the queue list shows prayers only and its position counts prayers", r);
  ok(r.npTitle === "Prayer One", "T7c Now Playing never titles an intention", r);
  ok(r.searchHit === true, "T7d search by a drawn intention's text finds its prayer", r);
  ok(r.playedAfterStepOnly === false && r.playedAfterMark === true, "T7e a completed speech step alone marks nothing; played marking lands on the prayer alone", r);
  await ctx.close();
}

// ---------- T8: the restore edge ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two", intro: "intention two" },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs;
    state.dayPayload = day;
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ v: 2, date: "2026-11-12",
      ids: ["intro:midday-p1", "midday-p1", "intro:midday-p2", "midday-p2"],
      blocks: ["midday", "midday", "midday", "midday"],
      idx: 0, currentId: "midday-p1", currentBlock: "midday", positionS: 0, savedAt: new Date().toISOString() }));
    const stood = standRestoredQueue(day);
    const live = queueLiveDesc({ id: "intro:midday-p1", episodeId: "midday-p1", block: "midday", spoken: true, kind: "intention" });
    return { stood, queueIds: state.queue.map((d) => d.episodeId), cur: state.current && state.current.episodeId,
      spoken: window.__spokenTexts.length, liveId: live && live.episodeId, liveSpoken: !!(live && live.spoken) };
  });
  ok(r.queueIds.join(",") === "midday-p1,midday-p2" && r.spoken === 0, "T8a a pre-v384 snapshot's intro: entries restore as passed over: no speech from a snapshot, no stall, prayers in order", r);
  ok(r.liveId === "midday-p1" && r.liveSpoken === false, "T8b the advance-time dead-entry rule resolves an intro entry to its paired prayer only", r);
  await ctx.close();
}

// ---------- T9: both speech routes ----------
{
  const { ctx, page } = await newPage(true);
  const r = await page.evaluate(async () => {
    state = freshState();
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    startDesc(descs[0]);
    const hook = window.__opnSpeech.state();
    const speakCalls = window.__bridgeCalls.filter((c) => c[0] === "speakText");
    const fns = window.__bridgeListeners["oraSpeechEnd"] || [];
    fns.forEach((f) => f({ id: hook.nativeId }));
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    const methods = [...new Set(window.__bridgeCalls.map((c) => c[0]))].sort();
    return { hook, speakCalls, waited, methods };
  });
  ok(r.hook.native === true && r.hook.nativeId, "T9a with the bridge present the hook reads the native route, id discipline live", r.hook);
  ok(r.speakCalls.length === 1 && r.speakCalls[0][1].text === "This prayer is for intention one" && r.speakCalls[0][1].utteranceId === r.hook.nativeId, "T9b the step completes on oraSpeechEnd under the live id; exact script over the bridge", r);
  ok(r.waited >= 0 && r.methods.every((m) => ["speakText", "stopSpeech", "addListener", "setState"].includes(m)), "T9c the bridge contract's surface (methods + event names) is unchanged", r.methods);
  await ctx.close();
  const web = await newPage(false);
  const rw = await web.page.evaluate(async () => {
    state = freshState();
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    startDesc(descs[0]);
    const hook = window.__opnSpeech.state();
    const waited = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3"), 3000);
    return { hook, waited };
  });
  ok(rw.hook.native === false && rw.waited >= 0, "T9d in a plain browser the hook reads the web route and the step completes on onend", rw);
  await web.ctx.close();
}

// ---------- statics ----------
ok(UI_TS.includes('var CACHE = "ora-pro-nobis-v384-1";'), "S9a SW pin ora-pro-nobis-v384-1 stands in ui.ts");
ok(missing.length === 0 && dropped.length === 0, "S9b extraction complete: no unresolved units (openGuideEditor excluded by name: guide-editor sheet, not a v384 surface)", { missing, dropped });
{
  let bundleOk = true, bundleErr = "";
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [ROOT + "/app/worker/src/index.ts", "--bundle", "--format=esm", "--outfile=/dev/null"], { stdio: "pipe" });
  } catch (e) { bundleOk = false; bundleErr = String(e.stderr || e.message).slice(0, 400); }
  ok(bundleOk, "S9c the candidate bundles clean (esbuild over index.ts)", bundleErr);
}

console.log("== harness-v384: " + (total - failures) + "/" + total + " legs green, " + failures + " failures ==");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
