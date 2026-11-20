// harness-v388.mjs — v388 INTENTIONS, WRITTEN ONLY legs (§2.7 T1–T8 + statics).
// Mold: harness-v384 (verbatim extraction from the candidate client.ts,
// speechSynthesis spy + bridge-plugin spy standing as PROOF SURFACES —
// the legs assert both spies stay at zero on every start, ON and OFF).
// v388 deltas: the speech machinery is GONE (T2 statics); the toggle
// (opn-intentions-v384) governs SHOWING only across three fresh reads
// (hero · row · face); the written line stands inside the prayer card
// (T3); the D4 rebuild seam carries the line onto the external
// advance path (T5). Runs ONLY inside a .worktrees path (hard guard).
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
function segFrom(re) {
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return null;
  let j = i;
  while (j < lines.length && lines[j] !== "};") j++;
  return lines.slice(i, j + 1).join("\n");
}
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
for (const v of varStarts) {
  if (v.name === "state") continue;
  const l = lines[v.i];
  try { new Function(l); varPieces.push(l); } catch (e) { /* multi-line: segment pull or inert */ }
}
for (const re of [/^var fade = \{/, /^var mediaHandlers = \{/]) {
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
const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>opn-v388-harness</title></head>
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
function FixtureUtterance(text) { this.text = text; this.voice = null; this.lang = ''; this.rate = 1; this.pitch = 1; this.onstart = null; this.onend = null; this.onerror = null; window.__utterances = (window.__utterances || 0) + 1; }
Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FixtureUtterance, configurable: true, writable: true });
Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: {
  speaking: false, pending: false,
  getVoices: function () { return []; },
  addEventListener: function () {}, removeEventListener: function () {},
  speak: function (u) { window.__spokenTexts.push(u.text); },
  cancel: function () {}, pause: function () {}, resume: function () {}
} });
</script>
<script>
${CLIENT_JS}
</script>
</body></html>`;

const BRIDGE_INIT = `
window.__bridgeCalls = [];
window.__bridgeListeners = {};
window.__nativePayloads = [];
window.Capacitor = { Plugins: { OraDayBridge: {
  speakText: function (args) { window.__bridgeCalls.push(['speakText', args]); return Promise.resolve(); },
  stopSpeech: function () { window.__bridgeCalls.push(['stopSpeech']); return Promise.resolve(); },
  setPlaybackState: function (args) { window.__bridgeCalls.push(['setPlaybackState']); try { window.__nativePayloads.push(JSON.parse(args.state)); } catch (e) {} return Promise.resolve(); },
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
    restoreProbe: null, previewQueue: null, queuePreviewIdx: -1, liturgical: null, playingUrl: null,
    tab: 'prayers', prayersView: { kind: 'home' }, searchQuery: '' };
}
function mkDay(specs) {
  var day = { presentedDay: '2026-11-12', date: '2026-11-12', presented: '2026-11-12', dateStr: '2026-11-12', dateLabel: 'Thursday, November 12, 2026', introTexts: {}, intros: null, blocks: [], __tracks: [] };
  var byBlock = {};
  specs.forEach(function (s) {
    var t = { episodeId: s.id, title: s.title, streamUrl: 'https://audio.invalid/' + s.id + '.mp3', available: s.available !== false, _block: s.block, source: 'own', durationS: 180 };
    day.__tracks.push(t);
    if (!byBlock[s.block]) { byBlock[s.block] = { block: s.block, label: s.block, caption: '', tracks: [] }; day.blocks.push(byBlock[s.block]); }
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
function extFixture() {
  var slot = { slotId: 'ext-slot-1', block: 'midday' };
  var st = { state: 'present', title: 'External One', source: 'Fixture FM', streamUrl: 'https://audio.invalid/ext1.mp3', durationSec: 200 };
  return { slot: slot, st: st };
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

// ---------- T2: statics (node-side, over the candidate source) ----------
{
  const banned = ["speakStep", "speakIntro", "finishSpoken", "pauseSpoken", "resumeSpoken", "stopSpoken",
    "speechCancel", "SpeechSynthesisUtterance", "nativeSpeechPlugin", "setupNativeSpeech", "setupSpeech",
    "inSpeechPhase", "__opnSpeech", "SPEECH_START_MS", "speechTimers", "armSpeechTimers", "clearSpeechTimers",
    "pickEnUsVoice", "speechSupported", "bridgeSpoken", "oraSpeechStart", "oraSpeechEnd", "oraSpeechError", "This prayer is for"];
  const hits = banned.filter((s) => CLIENT.includes(s));
  ok(hits.length === 0, "T2a no speech symbol or reference stands in client.ts", hits);
  const sd = CLIENT.slice(CLIENT.indexOf("function startDesc(desc)"), CLIENT.indexOf("function playTrack(desc)"));
  ok(!sd.includes("intentionsOn") && sd.includes("loadDescAudio(desc);"), "T2b startDesc holds no speech branch and no toggle read; the audio load runs inline", sd.slice(0, 80));
  ok(!CLIENT.includes("speakText("), "T2c the client never calls the bridge speech method (the APK plugin stands, unused)");
  ok(UI_TS.includes('var CACHE = "ora-pro-nobis-v390-1";'), "T2d SW pin ora-pro-nobis-v390-1 stands in ui.ts");
  ok(missing.length === 0 && dropped.length === 0, "T2e extraction complete: no unresolved units (openGuideEditor excluded by name, standing)", { missing, dropped });
}

// ---------- T1: no speech on any start (spies standing), ON and OFF ----------
for (const mode of ["on", "off"]) {
  const { ctx, page } = await newPage(true);
  const r = await page.evaluate(async (mode) => {
    state = freshState();
    localStorage.setItem("opn-intentions-v384", mode);
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "novena-x1", block: "novenas", title: "Novena One" },
    ]);
    day.introTexts["novenas"] = "intention novenas";
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    const out = { starts: [] };
    // own paired start
    startDesc(descs[0]);
    out.starts.push({ id: state.current.episodeId, srcNow: document.getElementById("audio").getAttribute("src") || "" });
    // novena paired start
    startDesc(descs[1]);
    out.starts.push({ id: state.current.episodeId, srcNow: document.getElementById("audio").getAttribute("src") || "" });
    // external paired start (the live rebuild descriptor)
    const fx = extFixture();
    state.extStanding = [fx.slot];
    state.extSlots = { "ext-slot-1": fx.st };
    day.introTexts["ext-slot-1"] = "intention ext";
    day.intros = buildIntroMap(day);
    const live = trackDesc(extSlotTrack(fx.slot, fx.st), day);
    startDesc(live);
    out.starts.push({ id: state.current.episodeId, srcNow: document.getElementById("audio").getAttribute("src") || "" });
    out.spoken = window.__spokenTexts.length;
    out.utterances = window.__utterances || 0;
    out.speakCalls = window.__bridgeCalls.filter((c) => c[0] === "speakText" || c[0] === "stopSpeech").length;
    out.hook = typeof window.__opnSpeech;
    return out;
  }, mode);
  ok(r.starts.every((s) => s.srcNow.includes(".mp3")), "T1-" + mode + "a every start (own · novena · external) loads its audio inline, in the same start", r.starts);
  ok(r.spoken === 0 && r.utterances === 0 && r.speakCalls === 0, "T1-" + mode + "b zero utterance constructions, zero web speaks, zero bridge speech calls — toggle " + mode.toUpperCase(), r);
  ok(r.hook === "undefined", "T1-" + mode + "c the speech harness hook is gone");
  await ctx.close();
}

// ---------- T3: shown, toggle ON — hero · rows · face ----------
{
  const { ctx, page } = await newPage(true);
  const r = await page.evaluate(async () => {
    state = freshState();
    localStorage.removeItem("opn-intentions-v384");
    const out = { freshOn: intentionsOn() };
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two", intro: "intention two" },
      { id: "novena-x1", block: "novenas", title: "Novena One" },
    ]);
    day.introTexts["novenas"] = "intention novenas";
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    const tracks = day.__tracks;
    out.rowOwn = trackCard(tracks[0]);
    out.rowNovena = trackCard(tracks[2]);
    const fx = extFixture();
    out.rowExt = trackCard({ episodeId: "ext-slot-1", kind: "external", available: true, title: "External One", source: "Fixture FM", durationS: 200, streamUrl: "https://audio.invalid/ext1.mp3" });
    day.introTexts["ext-slot-1"] = "intention ext"; day.intros = buildIntroMap(day); state.dayPayload = day;
    out.rowExt = trackCard({ episodeId: "ext-slot-1", kind: "external", available: true, title: "External One", source: "Fixture FM", durationS: 200, streamUrl: "https://audio.invalid/ext1.mp3" });
    out.search = searchResultsHtml(day, "intention two");
    startDesc(descs[0]);
    buildSheet(); updateNowPlaying();
    const npInt = document.getElementById("np-intention");
    out.hero = { text: npInt.textContent, display: npInt.style.display };
    const payload = nativeStatePayload(false);
    out.face = { subtitle: payload.subtitle, kind: payload.kind, estimated: payload.estimated };
    localStorage.setItem("opn-intentions-v384", "on");
    out.storedOn = intentionsOn();
    return out;
  });
  ok(r.freshOn === true && r.storedOn === true, "T3a no stored value and stored 'on' both read shown (the key stands)", r);
  ok(r.hero.text === "Prayer Intention: intention one" && r.hero.display !== "none", "T3b the hero line stands for the playing paired prayer", r.hero);
  ok(r.rowOwn.includes('class="intention-text"') && r.rowOwn.includes("Prayer Intention: intention one") && !r.rowOwn.includes("intention-row"), "T3c the block-page row carries the line INSIDE the card, in the .intention-text form — not the v361 sibling row", r.rowOwn.slice(0, 200));
  ok(r.rowExt.includes("Prayer Intention: intention ext"), "T3d an available external's row carries its line the same way", r.rowExt.slice(0, 200));
  ok(r.rowNovena.includes("Prayer Intention: intention novenas"), "T3e a novena row carries the Novenas draw by the prefix rule", r.rowNovena.slice(0, 200));
  ok(r.search.includes("Prayer Intention: intention two") && r.search.includes("Prayer Two"), "T3f a search render carries the line on its rows too (the one seam)", r.search.slice(0, 200));
  ok(r.face.subtitle === "intention one" && r.face.kind !== "spoken" && r.face.estimated === false, "T3g the native payload: subtitle = the text, kind is the descriptor's own, never estimated", r.face);
  await ctx.close();
}

// ---------- T4: hidden, toggle OFF (stored 'off') ----------
{
  const { ctx, page } = await newPage(true);
  const r = await page.evaluate(async () => {
    state = freshState();
    localStorage.setItem("opn-intentions-v384", "off");
    const out = { readsOff: intentionsOn() };
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    out.row = trackCard(day.__tracks[0]);
    startDesc(descs[0]);
    buildSheet(); updateNowPlaying();
    const npInt = document.getElementById("np-intention");
    out.hero = { text: npInt.textContent, display: npInt.style.display };
    const payload = nativeStatePayload(false);
    out.face = { subtitle: payload.subtitle };
    return out;
  });
  ok(r.readsOff === false, "T4a a stored 'off' reads OFF under the new model (the key stands, semantics flipped to showing)", r);
  ok(r.hero.text === "" && r.hero.display === "none", "T4b OFF: the hero line is emptied + display:none", r.hero);
  ok(!r.row.includes("Prayer Intention:"), "T4c OFF: row lines are absent");
  ok(r.face.subtitle === "", "T4d OFF: the native subtitle is empty", r.face);
  await ctx.close();
}

// ---------- T5: the external advance path (D4) + own-advance regression ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    setAutoplay(true);
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    day.introTexts["ext-slot-1"] = "intention ext";
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    const fx = extFixture();
    state.extStanding = [fx.slot];
    state.extSlots = { "ext-slot-1": fx.st };
    // the queue snapshot froze the external slot descriptor while
    // its download was in flight: available false, no URL, no text
    const frozen = { episodeId: "ext-slot-1", kind: "external", block: "midday", title: "External One", available: false, url: null };
    startQueue([descs[0], frozen], true);
    const firstOk = (document.getElementById("audio").getAttribute("src") || "").includes("midday-p1.mp3");
    endTrack(); // advance onto the settled external slot — queueLiveDesc rebuilds it
    const cur = state.current;
    buildSheet(); updateNowPlaying();
    const npInt = document.getElementById("np-intention");
    return { firstOk, curId: cur && cur.episodeId, curText: cur && cur.intentionText || null,
      src: document.getElementById("audio").getAttribute("src") || "",
      hero: npInt.textContent, spoken: window.__spokenTexts.length };
  });
  ok(r.firstOk && r.curId === "ext-slot-1" && r.src.includes("ext1.mp3"), "T5a queue advance onto the settled external slot starts it", r);
  ok(r.curText === "intention ext" && r.hero === "Prayer Intention: intention ext", "T5b the rebuilt descriptor carries its drawn text (D4: the rebuild passes the live day) — the hero line stands on the advance path", r);
  ok(r.spoken === 0, "T5c no speech at the external boundary", r);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two", intro: "intention two" },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    startQueue(descs.slice(), true);
    endTrack();
    return { cur: state.current && state.current.episodeId, text: state.current && state.current.intentionText || null };
  });
  ok(r.cur === "midday-p2" && r.text === "intention two", "T5d own-track advance regression: the next prayer carries its text as before", r);
  await ctx.close();
}

// ---------- T6: no-pause regression (the v384 boundary outcome, new model) ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    setAutoplay(true);
    const specs = [1, 2, 3, 4].map((i) => ({ id: "midday-p" + i, block: "midday", title: "Prayer " + i, intro: "intention " + i }));
    const day = mkDay(specs);
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    startQueue(descs.slice(), true);
    const seen = [];
    let stall = false;
    for (let k = 0; k < 4; k++) {
      const w = await waitFor(() => (document.getElementById("audio").getAttribute("src") || "").includes("midday-p" + (k + 1) + ".mp3"), 4000);
      if (w < 0) { stall = true; break; }
      seen.push(state.current && state.current.episodeId);
      if (k < 3) endTrack();
    }
    return { seen, stall, spoken: window.__spokenTexts.length };
  });
  ok(!r.stall && r.seen.join(",") === "midday-p1,midday-p2,midday-p3,midday-p4", "T6a four paired prayers run back-to-back with no step, no gap, no stranded start", r);
  ok(r.spoken === 0, "T6b no speech at any boundary", r);
  await ctx.close();
}

// ---------- T7: a flip lands live (rows · hero · face) ----------
{
  // rows + face: a block page stands; the flip re-paints it and pushes the face
  const { ctx, page } = await newPage(true);
  const r = await page.evaluate(async () => {
    state = freshState();
    localStorage.removeItem("opn-intentions-v384");
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two", intro: "intention two" },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    state.tab = "prayers"; state.prayersView = { kind: "block", block: "midday" };
    startDesc(descs[0]);
    paintPrayersView(day);
    const out = { before: document.getElementById("view").innerHTML.includes("Prayer Intention: intention") };
    window.__nativePayloads.length = 0;
    setIntentions(false);
    out.afterOff = document.getElementById("view").innerHTML.includes("Prayer Intention:");
    out.faceOff = window.__nativePayloads.length ? window.__nativePayloads[window.__nativePayloads.length - 1].subtitle : "(no push)";
    setIntentions(true);
    out.afterOn = document.getElementById("view").innerHTML.includes("Prayer Intention: intention");
    out.faceOn = window.__nativePayloads.length ? window.__nativePayloads[window.__nativePayloads.length - 1].subtitle : "(no push)";
    return out;
  });
  ok(r.before === true && r.afterOff === false, "T7a a flip to OFF re-paints the standing block page: the row lines vanish with no reload", r);
  ok(r.faceOff === "" && r.faceOn === "intention one", "T7b the flip pushes the face at once: subtitle empties OFF, restores ON", r);
  ok(r.afterOn === true, "T7c a flip back to ON restores the row lines on the standing page", r);
  await ctx.close();
}
{
  // hero: the Now Playing sheet stands; the flip re-renders it in place
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    localStorage.removeItem("opn-intentions-v384");
    state.tab = "settings"; // the paint leg stands down; the sheet leg is this context's surface
    const day = mkDay([{ id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" }]);
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    startDesc(descs[0]);
    buildSheet(); updateNowPlaying();
    const npInt = document.getElementById("np-intention");
    const out = { before: npInt.textContent };
    setIntentions(false);
    out.off = { text: npInt.textContent, display: npInt.style.display };
    setIntentions(true);
    out.on = { text: npInt.textContent, display: npInt.style.display };
    return out;
  });
  ok(r.before === "Prayer Intention: intention one" && r.off.text === "" && r.off.display === "none", "T7d a flip to OFF empties + hides the standing hero line at once", r);
  ok(r.on.text === "Prayer Intention: intention one" && r.on.display !== "none", "T7e a flip back to ON restores the hero line", r);
  await ctx.close();
}

// ---------- T8: absence rules + the Intentions tab ----------
{
  const { ctx, page } = await newPage(false);
  const r = await page.evaluate(async () => {
    state = freshState();
    const out = {};
    const day = mkDay([
      { id: "midday-p1", block: "midday", title: "Prayer One", intro: "intention one" },
      { id: "midday-p2", block: "midday", title: "Prayer Two" },
      { id: "midday-p3", block: "midday", title: "Prayer Three", intro: "intention three", available: false },
    ]);
    const descs = buildDescs(day);
    state.dayDescs = descs; state.dayPayload = day;
    out.unpairedRow = trackCard(day.__tracks[1]);
    out.unavailRow = trackCard(day.__tracks[2]);
    out.unavailDescText = descs[2].intentionText || null;
    // an unpaired podcast-group descriptor carries no line either
    out.episodeRow = trackCard({ episodeId: "pod-ep-1", title: "Podcast Episode", available: true, streamUrl: "https://audio.invalid/pod.mp3", durationS: 600, hasText: false });
    // the Intentions tab is not a toggle surface: with the tab
    // standing, a flip leaves the view exactly as it stood
    state.tab = "intentions";
    document.getElementById("view").innerHTML = "<h1>INTENTIONS SENTINEL</h1>";
    setIntentions(false); setIntentions(true);
    out.tabUntouched = document.getElementById("view").innerHTML === "<h1>INTENTIONS SENTINEL</h1>";
    return out;
  });
  ok(!r.unpairedRow.includes("Prayer Intention:"), "T8a an unpaired available track carries no line");
  ok(!r.unavailRow.includes("Prayer Intention:") && r.unavailDescText === null, "T8b an unavailable paired track carries no line and no stamped text (no orphans)", r);
  ok(!r.episodeRow.includes("Prayer Intention:"), "T8c an unpaired podcast-group row carries no line");
  ok(r.tabUntouched === true, "T8d a toggle flip never re-paints over the Intentions tab", r);
  const tabSrc = CLIENT.slice(CLIENT.indexOf("function renderIntentions()"), CLIENT.indexOf("function renderIntentions()") + 4000);
  ok(!tabSrc.includes("intentionsOn"), "T8e the Intentions tab render reads no toggle (static, the standing rule in both models)");
  await ctx.close();
}

// ---------- statics: the candidate bundles ----------
{
  let bundleOk = true, bundleErr = "";
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [ROOT + "/app/worker/src/index.ts", "--bundle", "--format=esm", "--outfile=/dev/null"], { stdio: "pipe" });
  } catch (e) { bundleOk = false; bundleErr = String(e.stderr || e.message).slice(0, 400); }
  ok(bundleOk, "S9 the candidate bundles clean (esbuild over index.ts)", bundleErr);
}

console.log("== harness-v388: " + (total - failures) + "/" + total + " legs green, " + failures + " failures ==");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
