#!/usr/bin/env node
// harness-v379 — the v379 fix-forward gate: native TTS in the
// Android shell. Carries the v375 harness whole (legs S1–S9,
// L1–L13 below, the web-path regression proof) and adds the
// N legs: with a stubbed OraDayBridge plugin installed as
// window.Capacitor, the spoken funnel must route to the native
// transport (exact script text, utterance ids), advance on the
// native end event, pass over on native error and on native
// silence (the watchdog, with stopSpeech as the cancel), guard
// stale event ids, and re-speak on resume — while a no-bridge
// page keeps the web path. The v375 header follows:
// harness-v375 — the v375 gate (Plan §2 harness legs L1–L14):
// app-side intention pairing with on-device TTS intros. D1 all
// classes pair app-side · D2 TTS ALWAYS (no feed-audio join) ·
// D3 retire the app's reliance only · D4 the spoken intro is a
// first-class queue entry · D5 foreground-only speech with the
// two-bound watchdog · D6 the best en-US voice picker. Fixture
// posture: the v374 mold — the client's VERBATIM machinery
// (buildIntroMap / introDescFor / expandDescs / extRebuildDescs
// / the queue + transport + speech module) extracted from the
// candidate source and run in real Chromium over fixture state,
// with the speechSynthesis surface STUBBED before boot (headless
// Chromium has no voices): speak records utterances and fires
// synthetic events per a mode switch (normal · never-start ·
// not-allowed · never-end), cancel/pause/resume recorded,
// getVoices returns a fixture list incl. en_US underscore forms
// and a default flag. Bounds are read from window.__opnSpeech,
// never re-derived. Declared seams: refreshPlayedChrome is a
// fixture no-op (played chrome paints nothing the legs assert);
// extFetchText is a fixture stub over the intentions feed (its
// call log is itself asserted in L3); the dock/NP transport
// handlers call the same verbatim functions the legs drive
// directly (pauseTransport / resumeCurrent / advanceQueue).
// L14 reads the COMMITTED range (31fe142..HEAD) and excludes
// this harness's own files under app/tests/ — so this harness
// runs AFTER the Implement commit stands (the v371 S5 / v372
// S10 / v373 S4 artifact rule). Tallies read from the COMPLETE
// log.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v379 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const BASE = "8be95f0"; // the production base (v375 + v359 bridge, Worker 2fd2ea1f)

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };

// ---- verbatim extraction from the candidate source -------------
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
const seg = (anchor, len) => { const i = CLIENT.indexOf(anchor); if (i < 0) throw new Error("anchor not found: " + anchor); return CLIENT.slice(i, i + len); };
const segUntil = (anchor, term) => { const i = CLIENT.indexOf(anchor); if (i < 0) throw new Error("anchor not found: " + anchor); const j = CLIENT.indexOf(term, i); if (j < 0) throw new Error("terminator not found for: " + anchor); return CLIENT.slice(i, j + term.length); };
const lineOf = (anchor) => seg(anchor, CLIENT.indexOf("\n", CLIENT.indexOf(anchor)) - CLIENT.indexOf(anchor));

// ---- S legs: static ---------------------------------------------
const bim = extractFn(CLIENT, "buildIntroMap");
ok(bim.includes("day.introTexts") && bim.includes("id === 'novenas'") && bim.includes("spoken: true") && !bim.includes("streamUrl:"),
  "S1 buildIntroMap: entries build from introTexts only — text + spoken flag, NO streamUrl (D2); the 'novenas' key is skipped (prefix rule at the read seam)");
const rp = extractFn(CLIENT, "renderPrayers");
ok(rp.includes("day.intros = buildIntroMap(day);") && rp.indexOf("day.intros = buildIntroMap(day);") < rp.indexOf("expandDescs(tt, day)"),
  "S2 renderPrayers: day.intros = buildIntroMap(day) stands BEFORE the first expandDescs build (rows at first paint)");
const obi = extractFn(CLIENT, "ownBuildIntentions");
ok(!CLIENT.includes("function ownFetchIntro") && !CLIENT.includes("ownFetchIntro(") &&
   !/day\.intros\s*=/.test(obi) && obi.includes("state.daySegments = rec2.segments") &&
   obi.includes("state.daySegments = {};") && !obi.includes("extRebuildDescs") && !obi.includes("extSwapCard"),
  "S3 step 3: ownFetchIntro is DELETED whole (definition + call sites); ownBuildIntentions assigns NO day.intros anywhere — the feed-failure catch clears segments only; the late-map completion leg (rebuild + swap) is gone");
const idf = extractFn(CLIENT, "introDescFor");
ok(idf.includes("spoken: true") && idf.includes("url: null") && idf.includes("intentionText: text") && idf.includes("title: t.title || ''"),
  "S4 introDescFor emits the spoken form: spoken:true, url:null, intentionText set, title = the prayer's own title");
const sd = extractFn(CLIENT, "startDesc");
ok(sd.includes("if (speech.active || speech.paused) stopSpoken();") && sd.includes("if (desc && desc.spoken) { startSpokenDesc(desc); return; }") &&
   extractFn(CLIENT, "playTrack").includes("!desc.url && !desc.spoken"),
  "S5 start path: stopSpoken at startDesc's head, the spoken branch to startSpokenDesc, and playTrack's guard admits the spoken form");
ok(CLIENT.includes("var SPEECH_START_MS = 3000;") && CLIENT.includes("Math.min(90000, Math.max(30000, text.length * 90))") &&
   CLIENT.includes("'This prayer is for ' + (desc.intentionText || '')"),
  "S6 watchdog bounds stand as named constants (start 3000ms; cap min(90s, max(30s, len*90ms))) and the utterance text is exactly the standing intro script");
const mh = segUntil("var mediaHandlers = {", "\n};");
ok(mh.includes("pause: function () { pauseTransport(); }") &&
   extractFn(CLIENT, "updateDock").includes("transportPlaying() ? '&#10073;&#10073;' : '&#9654;'") &&
   extractFn(CLIENT, "updateNowPlaying").includes("transportPlaying() ? '&#10073;&#10073;' : '&#9654;'") &&
   extractFn(CLIENT, "fireTimedStop").includes("if (speech.active) pauseSpoken();") &&
   extractFn(CLIENT, "standRestoredQueue").includes("chosen.desc.spoken") &&
   extractFn(CLIENT, "resumeCurrent").includes("state.current.spoken"),
  "S7 step 7 call sites carry the transport predicates: mediaHandlers.pause, both play glyphs, fireTimedStop's spoken branch, the restore checkpoint, resumeCurrent's spoken branch");
ok(UI.includes('var CACHE = "ora-pro-nobis-v379-1";') && !UI.includes("ora-pro-nobis-v359-1"),
  "S8 SW pin ora-pro-nobis-v379-1 stands; the production v359 pin is gone");
let bundles = true;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v375-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
} catch { bundles = false; }
ok(bundles, "S9 the whole worker bundles clean (esbuild) — no syntax break anywhere in the client");
ok(CLIENT.includes("oraSpeechStart") && CLIENT.includes("oraSpeechEnd") && CLIENT.includes("oraSpeechError") &&
   extractFn(CLIENT, "speakIntro").indexOf("nativeSpeechPlugin()") >= 0 &&
   extractFn(CLIENT, "speakIntro").indexOf("nativeSpeechPlugin()") < extractFn(CLIENT, "speakIntro").indexOf("if (!speechSupported())") &&
   extractFn(CLIENT, "nativeSpeechPlugin").includes("cap.Plugins.OraDayBridge") &&
   extractFn(CLIENT, "nativeSpeechPlugin").includes("typeof p.speakText !== 'function'"),
  "S10 v379 native route: speakIntro consults the bridge BEFORE the web support check; the plugin guard requires speakText; the three oraSpeech* events are wired");
// L14 — diff scope from the COMMITTED range, harness files excluded.
const committed = execFileSync("git", ["-C", WT, "diff", "--name-only", `${BASE}..HEAD`], { encoding: "utf8" })
  .split("\n").filter(Boolean).sort();
const scope = committed.filter((f) => !f.startsWith("app/tests/"));
ok(JSON.stringify(scope) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]) &&
   committed.some((f) => f === "app/tests/harness-v379.mjs"),
  "L14 committed range " + BASE + "..HEAD, harness files excluded, is exactly client.ts + ui.ts (committed: " + committed.join(", ") + ")");

// ---- B legs: verbatim client in real Chromium -------------------
const PAGE_SRC = [
  (CLIENT.match(/var BS_CH = [^\n]+/) || [""])[0],
  lineOf("var QUEUE_KEY"), lineOf("var PLAYED_KEY"), lineOf("var AUTOPLAY_KEY"),
  lineOf("var SPEECH_START_MS"), lineOf("var speech = {"), lineOf("var speechTimers = {"), lineOf("var fade = {"), lineOf("var npScrubbing"),
  "esc", "fmtDur",
  "readPlayed", "playedMap", "presentedDateStr", "refreshRepeatIds", "playedKey", "isPlayed", "writePlayedQuiet", "writePlayed", "markCompleted",
  "queueStartPos", "saveQueueSnapshot", "removeQueueSnapshot", "readQueueSnapshot", "clearRestoredQueue",
  "markPlaying", "markSkipped",
  "setMediaSessionFor", "setPlaybackState", "reassertMediaSession", "updatePositionState",
  "speechSupported", "setupSpeech", "pickEnUsVoice", "clearSpeechTimers", "stopSpoken", "speakIntro", "finishSpoken", "pauseSpoken", "resumeSpoken", "startSpokenDesc", "transportPlaying", "pauseTransport",
  "nativeSpeechPlugin", "setupNativeSpeech", "speechCancel", "armSpeechTimers", "pushDaySnapshot",
  "startDesc", "playTrack", "tapPlay", "resumeCurrent", "queueLiveDesc",
  "unplayedOnly", "queueBuild", "sectionQueueFrom", "startQueue", "advanceQueue", "jumpQueueTo",
  "standRestoredQueue",
  "autoplayOn", "setAutoplay", "syncAutoplayToggles", "chainForward",
  "measureBars", "updateDockProgress", "updateDock",
  "fadeRestore", "sleepLabel", "updateSleepLabel", "armSleepMinutes", "armSleepTrack", "disarmSleep", "fireTimedStop", "sleepTick", "sleepTrackEnd",
  "registerMediaHandlers", "setupMediaSession",
  "trackDesc", "buildIntroMap", "introTextFor", "introDescFor", "expandDescs", "prayerIntentionTitle", "prayerIntentionTitleForDesc", "intentionRowCard", "introForTrack",
  "playedDotHtml", "heardCls", "novenaInfo", "novenaLineText", "novenaSpanHtml", "readButton", "trackCard",
  "extSlotTrack", "ownSlotTrack", "extRebuildDescs",
  "npDuration", "updateNpSeek", "renderQueueList", "updateNowPlaying",
  "extWs", "ownBuildIntentions",
].map((x) => (x.startsWith("var ") ? x : extractFn(CLIENT, x))).join("\n")
  + "\n" + segUntil("var mediaHandlers = {", "\n};")
  + "\n" + segUntil("window.__opnSpeech = {", "\n};");

const FIXTURE = `
var view = document.getElementById('view');
var audioEl = document.getElementById('audio');
// ---- declared fixture seams -------------------------------------
function refreshPlayedChrome() {}
var INTRO_FEED_URL = 'https://fixture.invalid/intentions.xml';
window.__fetchLog = [];
window.__fetchImpl = function () { return Promise.reject(new Error('no fixture feed')); };
function extFetchText(url) { window.__fetchLog.push(url); return window.__fetchImpl(url); }
// The speechSynthesis stub: speak records utterances and fires
// synthetic events per mode; cancel records and (when armed)
// echoes error:interrupted like the real platform.
window.__speechLog = { speaks: [], cancels: 0 };
window.__speechMode = 'normal';
window.__cancelFiresError = false;
window.__lastUtterance = null;
window.__voicesFixture = [
  { lang: 'en-GB', name: 'English UK', default: false },
  { lang: 'en_US', name: 'US Voice A', default: false },
  { lang: 'en_US', name: 'US Voice Default', default: true },
];
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
  speak: function (u) {
    window.__speechLog.speaks.push(u); window.__lastUtterance = u;
    var mode = window.__speechMode;
    if (mode === 'normal') {
      setTimeout(function () { if (u.onstart) u.onstart(); }, 5);
      setTimeout(function () { if (u.onend) u.onend({}); }, 40);
    } else if (mode === 'not-allowed') {
      setTimeout(function () { if (u.onerror) u.onerror({ error: 'not-allowed' }); }, 5);
    } else if (mode === 'never-end') {
      setTimeout(function () { if (u.onstart) u.onstart(); }, 5);
    } // never-start: fires nothing at all
  },
  cancel: function () {
    window.__speechLog.cancels++;
    var u = window.__lastUtterance;
    if (u && window.__cancelFiresError && u.onerror) { var f = u.onerror; setTimeout(function () { f({ error: 'interrupted' }); }, 1); }
  },
  pause: function () {}, resume: function () {},
  getVoices: function () { return window.__voicesFixture; },
  addEventListener: function () {},
}});
// The utterance constructor is stubbed too: a NATIVE
// SpeechSynthesisUtterance's voice setter rejects the
// fixture's plain voice objects (a platform type check, not
// app behavior — production voices are the engine's own
// objects from getVoices()). The fixture class records every
// property the client sets, verbatim.
try {
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: function (text) {
    this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.voice = null;
    this.onstart = null; this.onend = null; this.onerror = null;
  } });
} catch (e) {
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.voice = null; this.onstart = null; this.onend = null; this.onerror = null; };
}
// ---- v379: the OraDayBridge stub (installed per scenario) --
// speakText records calls and fires the oraSpeech* events per
// mode: normal (start, then end) · start-only · error · silent
// (nothing — the watchdog's prey) · manual (the leg fires).
window.__bridgeLog = { speaks: [], stops: 0, snapshots: 0 };
window.__bridgeMode = 'normal';
window.__bridgeListeners = {};
window.__fireBridge = function (name, ev) { (window.__bridgeListeners[name] || []).slice().forEach(function (fn) { fn(ev); }); };
window.__installBridge = function () {
  window.Capacitor = { Plugins: { OraDayBridge: {
    setDaySnapshot: function () { window.__bridgeLog.snapshots++; return Promise.resolve(); },
    speakText: function (args) {
      window.__bridgeLog.speaks.push(args);
      var mode = window.__bridgeMode;
      if (mode === 'normal') {
        setTimeout(function () { window.__fireBridge('oraSpeechStart', { id: args.utteranceId }); }, 5);
        setTimeout(function () { window.__fireBridge('oraSpeechEnd', { id: args.utteranceId }); }, 60);
      } else if (mode === 'start-only') {
        setTimeout(function () { window.__fireBridge('oraSpeechStart', { id: args.utteranceId }); }, 5);
      } else if (mode === 'error') {
        setTimeout(function () { window.__fireBridge('oraSpeechError', { id: args.utteranceId, error: 'unavailable' }); }, 5);
      }
      return Promise.resolve();
    },
    stopSpeech: function () { window.__bridgeLog.stops++; return Promise.resolve(); },
    addListener: function (name, fn) { (window.__bridgeListeners[name] = window.__bridgeListeners[name] || []).push(fn); return Promise.resolve({ remove: function () {} }); },
  } } };
};
window.__removeBridge = function () { try { delete window.Capacitor; } catch (e) { window.Capacitor = undefined; } };
window.__vis = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return window.__vis; } });
window.__playCalls = 0;
audioEl.play = function () { window.__playCalls++; return Promise.resolve(); };
var state = null;
${PAGE_SRC}
setupSpeech();
var DATE = '2026-11-11';
function freshState() {
  return { ownStanding: [], extStanding: [], ownSlots: {}, extSlots: {}, dayDescs: [], dayPayload: null,
    daySegments: {}, presentedDay: DATE, storedDay: DATE, dateLabel: 'Wednesday, November 11, 2026',
    expandedIntros: {}, playedCache: null, readTracks: {}, current: null, queue: [], queueIdx: -1,
    repeatIds: {}, introRec: null, rate: 1, sleep: { mode: 'off' }, pendingResume: null, lastStartAt: 0,
    errWaitKey: null, errWaitN: 0, restoredQueue: false, restoreProbe: null, previewQueue: null, queuePreviewIdx: -1,
    liturgical: null, playingUrl: null };
}
function mkDay(introTexts, blocks) {
  var day = { date: DATE, presentedDay: DATE, dateLabel: 'Wednesday, November 11, 2026', introTexts: introTexts || {},
    blocks: (blocks || []).map(function (b) { return { block: b, label: b, caption: '', trackCount: 0, tracks: [], spotifyUrl: null }; }),
    episodes: [] };
  day.intros = buildIntroMap(day);
  return day;
}
function ownRow(sourceKey, episodeId, block, sortOrder, title) { return { sourceKey: sourceKey, episodeId: episodeId, block: block, sortOrder: sortOrder, title: title, enabled: 1 }; }
function meta(episodeId, title) { return { episodeId: episodeId, title: title, state: 'present', enclosureUrl: 'https://fixture.invalid/' + episodeId + '.mp3', streamUrl: 'https://fixture.invalid/stream-' + episodeId + '.mp3', durationS: 300, sizeBytes: 1000 }; }
function extSlot(slotId, title, block, sortOrder, source) { return { slotId: slotId, title: title, block: block, sortOrder: sortOrder, source: source, fallbackToken: null, fbRow: null, feedUrl: null, matcher: null, download: null, courier: null }; }
function extPresent(title, source) { return { state: 'present', title: title, streamUrl: 'https://fixture.invalid/' + title.replace(/[^a-z0-9]+/gi, '-') + '.mp3', enclosureUrl: 'https://fixture.invalid/enc.mp3', durationSec: 480, sizeBytes: 2000, source: source }; }
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var R = { bounds: { startMs: window.__opnSpeech.startMs } };

// ===== Scenario A — the defect shape: NO feed intros at all (L1, L2) =====
// The day builds from introTexts alone (the feed is never
// consulted for pairing). Classes: own · novena · external ·
// Mass and Homilies slot · The AI Signal.
state = freshState();
var textsA = { 'morning-prayer': 'For Alice and her family.',
  'novenas': 'For the novena intention of the day.',
  'ext-gospel-exegesis': 'For Ben and his work.',
  'ext-midmorning-prayer': 'For Clara and her health.',
  'daily-mass-readings': 'For David and his studies.',
  'the-ai-signal': 'For Erin and her team.',
  'marian-antiphon-angelus': 'For Frank and his journey.' };
var dayA = mkDay(textsA, ['Morning', 'Midmorning', 'Midday', 'Evening', 'Novenas', 'Mass and Homilies', 'The AI Signal']);
dayA.blocks[0].tracks = [{ episodeId: 'marian-antiphon-angelus', title: 'Marian Antiphon', streamUrl: 'https://fixture.invalid/antiphon.mp3', available: true }];
dayA.blocks[2].tracks = [{ episodeId: 'marian-antiphon-angelus', title: 'Marian Antiphon', streamUrl: 'https://fixture.invalid/antiphon.mp3', available: true },
  { episodeId: 'unavailable-prayer', title: 'Unavailable Prayer', streamUrl: null, available: false }];
dayA.blocks[3].tracks = [{ episodeId: 'marian-antiphon-angelus', title: 'Marian Antiphon', streamUrl: 'https://fixture.invalid/antiphon.mp3', available: true }];
state.dayPayload = dayA;
state.ownStanding = [ ownRow('morning-prayer', 'morning-prayer', 'Morning', 10, 'Morning Prayer'),
  ownRow('novenas', 'novenas', 'Novenas', 10, 'Novenas'),
  ownRow('the-ai-signal', 'the-ai-signal', 'The AI Signal', 10, 'The AI Signal') ];
state.ownSlots = {
  'morning-prayer': { state: 'present', tracks: [ meta('morning-prayer', 'Morning Prayer') ] },
  'novenas': { state: 'present', tracks: [ meta('novena-alpha', 'Novena Alpha - Day 1'), meta('novena-beta', 'Novena Beta - Day 2'), meta('novena-gamma', 'Novena Gamma - Day 3') ] },
  'the-ai-signal': { state: 'present', tracks: [ { episodeId: 'the-ai-signal', title: 'The AI Signal - November 11, 2026', state: 'present', streamUrl: '/api/player/audio/2026-11-11/the-ai-signal', enclosureUrl: null, durationS: 353, sizeBytes: 2825509, hasText: false } ] } };
state.extStanding = [ extSlot('ext-gospel-exegesis', 'Daily Gospel Exegesis', 'Midmorning', 10, 'Logical Bible Study'),
  extSlot('ext-midmorning-prayer', 'Midmorning Prayer', 'Midmorning', 20, 'Divine Office'),
  extSlot('daily-mass-readings', 'Daily Readings', 'Mass and Homilies', 10, 'USCCB') ];
state.extSlots = { 'ext-gospel-exegesis': extPresent('Daily Gospel Exegesis', 'Logical Bible Study'),
  'ext-midmorning-prayer': extPresent('Midmorning Prayer', 'Divine Office'),
  'daily-mass-readings': extPresent('Daily Readings for November 11, 2026', 'USCCB') };
extRebuildDescs(dayA);
R.descsA = state.dayDescs.map(function (d) { return { id: d.episodeId, kind: d.kind || '', block: d.block || '', spoken: !!d.spoken, url: d.url || null, text: d.intentionText || null, avail: d.available }; });
// Rows as listed: every pair rendered through the verbatim card seam.
var pairHtml = [];
state.dayDescs.forEach(function (d, i) {
  if (d.kind !== 'intention') return;
  var prayer = state.dayDescs[i + 1];
  pairHtml.push(intentionRowCard({ episodeId: prayer.episodeId.replace(/^intro:/, ''), title: prayer.title }, { text: d.intentionText }));
});
view.innerHTML = pairHtml.join('');
R.rowsA = Array.prototype.map.call(view.querySelectorAll('.card.intention-row'), function (el) {
  return { playkey: el.querySelector('[data-playkey]').getAttribute('data-playkey'), text: el.querySelector('.intention-text').textContent };
});

// ===== Scenario B — feed WITH audio items: still ignored (L3) =====
state = freshState();
var dayB = mkDay({ 'morning-prayer': 'For Alice and her family.' }, ['Morning']);
state.dayPayload = dayB;
window.__fetchLog = [];
window.__fetchImpl = function () {
  return Promise.resolve('<?xml version="1.0"?><rss><channel>'
    + '<item><guid>intentions-intro-morning-prayer-' + DATE + '</guid><title>Morning Prayer Intention</title><enclosure url="https://fixture.invalid/feed-intro.mp3" length="100"/></item>'
    + '<item><guid>intentions-segment-Morning-' + DATE + '</guid><title>Morning Segment</title><enclosure url="https://fixture.invalid/segment.mp3" length="50"/></item>'
    + '</channel></rss>');
};
await ownBuildIntentions(dayB, null);
R.feedB = { calls: window.__fetchLog.slice(), intros: dayB.intros, segments: state.daySegments };

// ===== Scenario C — feed failure: the map stands (L9) =====
state = freshState();
var dayC = mkDay({ 'morning-prayer': 'For Alice and her family.' }, ['Morning']);
state.dayPayload = dayC;
window.__fetchImpl = function () { return Promise.reject(new Error('feed down')); };
await ownBuildIntentions(dayC, null);
state.ownStanding = [ ownRow('morning-prayer', 'morning-prayer', 'Morning', 10, 'Morning Prayer') ];
state.ownSlots = { 'morning-prayer': { state: 'present', tracks: [ meta('morning-prayer', 'Morning Prayer') ] } };
extRebuildDescs(dayC);
R.failC = { intros: dayC.intros, segments: state.daySegments, descs: state.dayDescs.map(function (d) { return { id: d.episodeId, spoken: !!d.spoken, text: d.intentionText || null }; }) };

// ===== Playback scenarios over one pair (L4–L8, L10–L13) =====
function pairState(text) {
  state = freshState();
  var day = mkDay({ 'morning-prayer': text || 'For Alice and her family.' }, ['Morning']);
  state.dayPayload = day;
  state.ownStanding = [ ownRow('morning-prayer', 'morning-prayer', 'Morning', 10, 'Morning Prayer') ];
  state.ownSlots = { 'morning-prayer': { state: 'present', tracks: [ meta('morning-prayer', 'Morning Prayer'), meta('evening-prayer', 'Evening Prayer') ] } };
  extRebuildDescs(day);
  return state.dayDescs.slice();
}
// L4 — utterance end advances into the prayer; nothing marked.
var descs = pairState();
var introD = descs[0], prayerD = descs[1];
window.__speechMode = 'normal'; window.__speechLog = { speaks: [], cancels: 0 }; window.__playCalls = 0;
startQueue([introD, prayerD], true);
await wait(160);
R.l4 = { current: state.current ? state.current.episodeId : null, src: audioEl.getAttribute('src') || audioEl.src || '',
  playCalls: window.__playCalls, spokenText: window.__speechLog.speaks.length ? window.__speechLog.speaks[0].text : null,
  played: readPlayed(), introNoMark: true };
markCompleted(introD);
R.l4.afterIntroMark = readPlayed();
markCompleted(prayerD);
R.l4.afterPrayerMark = readPlayed();
// L5 — never-start: the watchdog passes over inside the bound.
descs = pairState();
window.__speechMode = 'never-start'; window.__speechLog = { speaks: [], cancels: 0 };
startQueue([descs[0], descs[1]], true);
await wait(window.__opnSpeech.startMs + 800);
R.l5 = { current: state.current ? state.current.episodeId : null, cancels: window.__speechLog.cancels };
// L6 — not-allowed: pass-over, prayer plays.
descs = pairState();
window.__speechMode = 'not-allowed'; window.__speechLog = { speaks: [], cancels: 0 };
startQueue([descs[0], descs[1]], true);
await wait(400);
R.l6 = { current: state.current ? state.current.episodeId : null };
// L7 — pause = cancel; resume re-speaks from the start; a
// minutes-mode sleep stop mid-utterance pauses the speech.
descs = pairState();
window.__speechMode = 'never-end'; window.__speechLog = { speaks: [], cancels: 0 };
startQueue([descs[0], descs[1]], true);
await wait(30);
var speaksBefore = window.__speechLog.speaks.length;
pauseTransport();
R.l7paused = { cancels: window.__speechLog.cancels, playing: transportPlaying(), hook: window.__opnSpeech.state() };
resumeCurrent();
await wait(30);
R.l7resumed = { speaks: window.__speechLog.speaks.length, before: speaksBefore,
  sameText: window.__speechLog.speaks.length > speaksBefore && window.__speechLog.speaks[window.__speechLog.speaks.length - 1].text === window.__speechLog.speaks[0].text,
  playing: transportPlaying() };
armSleepMinutes(0); sleepTick();
R.l7sleep = { paused: window.__opnSpeech.state().paused, playing: transportPlaying() };
disarmSleep();
// L8 — skip mid-speech + the token guard: the killed
// utterance's late interrupted error changes nothing.
descs = pairState();
window.__speechMode = 'never-end'; window.__cancelFiresError = true; window.__speechLog = { speaks: [], cancels: 0 };
startQueue([descs[0], descs[1], descs[2]], true);
await wait(30);
advanceQueue(1);
await wait(120);
R.l8 = { cancels: window.__speechLog.cancels, current: state.current ? state.current.episodeId : null, idx: state.queueIdx };
window.__cancelFiresError = false;
// L10 — the foreground gate: hidden at the intro's turn.
descs = pairState();
window.__speechMode = 'normal'; window.__speechLog = { speaks: [], cancels: 0 };
state.queue = [descs[0], descs[1]]; state.queueIdx = 0;
window.__vis = 'hidden';
startDesc(descs[0]);
window.__vis = 'visible';
R.l10 = { speaks: window.__speechLog.speaks.length, current: state.current ? state.current.episodeId : null };
// L11 — advance re-resolves the spoken descriptor (fresh text).
descs = pairState('First drawn text.');
var introV1 = descs[0], prayerX = descs[1], prayerY = descs[2];
var dayNew = mkDay({ 'morning-prayer': 'Second drawn text.' }, ['Morning']);
state.dayPayload = dayNew;
extRebuildDescs(dayNew);
window.__speechMode = 'normal'; window.__speechLog = { speaks: [], cancels: 0 };
state.queue = [prayerX, introV1, prayerY]; state.queueIdx = 0; state.current = prayerX;
advanceQueue(1);
await wait(30);
R.l11 = { spokenText: window.__speechLog.speaks.length ? window.__speechLog.speaks[window.__speechLog.speaks.length - 1].text : null,
  current: state.current ? state.current.episodeId : null };
// L12 — Now Playing shows the intention; grouping drops the pair.
descs = pairState();
window.__speechMode = 'never-end'; window.__speechLog = { speaks: [], cancels: 0 };
startQueue([descs[0], descs[1]], true);
await wait(30);
var sheet = document.createElement('div');
sheet.className = 'sheet np-sheet';
sheet.innerHTML = '<div class="inner"><h1 id="np-title"></h1><p id="np-meta"></p><div class="np-intention" id="np-intention" style="display:none"></div>'
  + '<button id="np-play"></button><button id="np-prev"></button><button id="np-next"></button>'
  + '<button id="np-speed"></button><button id="np-sleep"></button><button id="np-read"></button>'
  + '<span id="np-queue-pos"></span><div id="np-queue"></div>'
  + '<span id="np-elapsed"></span><input type="range" id="np-seek"><span id="np-remain"></span></div>';
document.body.appendChild(sheet);
updateNowPlaying();
var intEl = sheet.querySelector('#np-intention');
var introRow = sheet.querySelector('.npq-row.npq-intro .npq-title');
R.l12 = { npIntention: intEl ? intEl.textContent : null, npShown: intEl ? intEl.style.display !== 'none' : false,
  queueIntroTitle: introRow ? introRow.textContent : null, glyph: sheet.querySelector('#np-play').innerHTML };
sheet.remove();
markCompleted(descs[1]);
R.l12group = unplayedOnly([descs[0], descs[1]]).length;
// L13 — the voice pick (D6).
R.l13a = window.__opnSpeech.pick();
window.__voicesFixture = [ { lang: 'en-GB', name: 'English UK', default: false }, { lang: 'en_US', name: 'US Voice A', default: false } ];
setupSpeech();
R.l13b = window.__opnSpeech.pick();
descs = pairState();
window.__speechMode = 'normal'; window.__speechLog = { speaks: [], cancels: 0 };
startDesc(descs[0]);
await wait(20);
var u13 = window.__speechLog.speaks[window.__speechLog.speaks.length - 1];
R.l13c = { voiceName: u13 && u13.voice ? u13.voice.name : null, lang: u13 ? u13.lang : null };

// ===== v379 N scenarios — the native route (bridge installed) =====
// N1/N2 — route + advance: the web engine is DEAD here on
// purpose (never-start); only the native events may advance.
descs = pairState();
window.__installBridge(); window.__bridgeMode = 'normal';
window.__bridgeLog = { speaks: [], stops: 0, snapshots: 0 };
window.__speechMode = 'never-start'; window.__speechLog = { speaks: [], cancels: 0 };
startQueue([descs[0], descs[1]], true);
await wait(25);
R.n1mid = { hook: window.__opnSpeech.state(), bridgeSpeaks: window.__bridgeLog.speaks.length,
  text: window.__bridgeLog.speaks.length ? window.__bridgeLog.speaks[0].text : null,
  id: window.__bridgeLog.speaks.length ? window.__bridgeLog.speaks[0].utteranceId : null,
  webSpeaks: window.__speechLog.speaks.length };
await wait(200);
R.n1 = { current: state.current ? state.current.episodeId : null, bridgeSpeaks: window.__bridgeLog.speaks.length, webSpeaks: window.__speechLog.speaks.length };
// N3 — native error: fast pass-over to the prayer.
descs = pairState();
window.__bridgeMode = 'error'; window.__bridgeLog = { speaks: [], stops: 0, snapshots: 0 };
startQueue([descs[0], descs[1]], true);
await wait(300);
R.n3 = { current: state.current ? state.current.episodeId : null, bridgeSpeaks: window.__bridgeLog.speaks.length };
// N4 — native silence: the start watchdog passes over and the
// cancel reaches the native transport (stopSpeech).
descs = pairState();
window.__bridgeMode = 'silent'; window.__bridgeLog = { speaks: [], stops: 0, snapshots: 0 };
startQueue([descs[0], descs[1]], true);
await wait(window.__opnSpeech.startMs + 800);
R.n4 = { current: state.current ? state.current.episodeId : null, stops: window.__bridgeLog.stops };
// N5 — pause stops the native speech; resume re-speaks it.
descs = pairState();
window.__bridgeMode = 'start-only'; window.__bridgeLog = { speaks: [], stops: 0, snapshots: 0 };
startQueue([descs[0], descs[1]], true);
await wait(30);
pauseTransport();
R.n5paused = { stops: window.__bridgeLog.stops, playing: transportPlaying(), hook: window.__opnSpeech.state() };
var n5speaksBefore = window.__bridgeLog.speaks.length;
resumeCurrent();
await wait(30);
R.n5 = { speaks: window.__bridgeLog.speaks.length, before: n5speaksBefore,
  sameText: window.__bridgeLog.speaks.length > n5speaksBefore && window.__bridgeLog.speaks[window.__bridgeLog.speaks.length - 1].text === window.__bridgeLog.speaks[0].text,
  playing: transportPlaying() };
// N6 — stale event ids are dead: a foreign end changes
// nothing; the live id's end advances.
descs = pairState();
window.__bridgeMode = 'manual'; window.__bridgeLog = { speaks: [], stops: 0, snapshots: 0 };
startQueue([descs[0], descs[1]], true);
await wait(25);
var liveId = window.__bridgeLog.speaks.length ? window.__bridgeLog.speaks[0].utteranceId : null;
window.__fireBridge('oraSpeechEnd', { id: 'opn-999999' });
await wait(20);
R.n6mid = { current: state.current ? state.current.episodeId : null, liveId: liveId };
window.__fireBridge('oraSpeechEnd', { id: liveId });
await wait(30);
R.n6 = { current: state.current ? state.current.episodeId : null };
// N7 — bridge removed: the web path speaks, exactly as before.
window.__removeBridge();
descs = pairState();
window.__speechMode = 'normal'; window.__speechLog = { speaks: [], cancels: 0 };
startQueue([descs[0], descs[1]], true);
await wait(160);
R.n7 = { webSpeaks: window.__speechLog.speaks.length, current: state.current ? state.current.episodeId : null };
return R;
`;

const PAGE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="view"></div>`
  + `<div id="tabbar"></div><audio id="audio" preload="none"></audio>`
  + `<div id="dock" class="hidden"><span id="dock-title"></span><span id="dock-meta"></span><button id="dock-play"></button><button id="dock-next"></button><div id="dock-progress-fill"></div></div>`
  + `</body></html>`;

// The fixture page is served over a real http origin — the
// played-store legs read localStorage, which an about:blank
// page cannot be trusted to hold.
const server = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE_HTML); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(ORIGIN);
  const R = await page.evaluate("(async () => {\n" + FIXTURE + "\n})()");

  // L1 — rows stand for every class on an EMPTY intentions feed.
  const introDescs = R.descsA.filter((d) => d.kind === "intention");
  const classes = { own: "intro:morning-prayer", novena: "intro:novena-alpha", external: "intro:ext-gospel-exegesis", mass: "intro:daily-mass-readings", ai: "intro:the-ai-signal" };
  ok(Object.values(classes).every((id) => introDescs.some((d) => d.id === id)) && introDescs.length === 11,
    "L1 every paired track lists its intention on an empty intentions feed — own, novena (x3), externals (x2), Mass and Homilies, The AI Signal, Antiphon occurrences: " + introDescs.length + " spoken intro descriptors stand in the day build");
  ok(R.rowsA.length === introDescs.length && R.rowsA.every((r) => r.text && r.text.startsWith("For ")),
    "L1 the listed intention rows carry the drawn texts (" + R.rowsA.map((r) => r.playkey).join(", ") + ")");
  const tally = {};
  R.descsA.forEach((d) => { tally[d.block] = (tally[d.block] || 0) + 1; });
  ok(tally.Midmorning === 4 && tally.Novenas === 6 && tally["The AI Signal"] === 2,
    "L1 block tallies count the listed tracks incl. intention rows (the v374 surface): Midmorning 4, Novenas 6, The AI Signal 2 — " + JSON.stringify(tally));
  // L2 — spoken descriptors, per occurrence.
  const antiphon = introDescs.filter((d) => d.id === "intro:marian-antiphon-angelus");
  ok(antiphon.length === 3 && antiphon.every((d) => d.spoken && d.url === null && d.text === "For Frank and his journey.") &&
     JSON.stringify(antiphon.map((d) => d.block).sort()) === JSON.stringify(["Evening", "Midday", "Morning"]) &&
     !introDescs.some((d) => d.id === "intro:unavailable-prayer") &&
     introDescs.every((d) => d.spoken && d.url === null),
    "L2 spoken descriptors stand per occurrence: the Antiphon's three dayparts pair three times (spoken, no url, drawn text); an unavailable prayer carries NO intro; every intro descriptor is spoken with url null");
  // L3 — feed audio ignored (D2).
  ok(R.feedB.calls.length === 1 && R.feedB.calls[0].includes("intentions.xml") &&
     R.feedB.intros["morning-prayer"] && R.feedB.intros["morning-prayer"].spoken === true && !("streamUrl" in R.feedB.intros["morning-prayer"]) &&
     R.feedB.segments.Morning && R.feedB.segments.Morning.streamUrl.includes("segment.mp3"),
    "L3 the feed's intro AUDIO is ignored under D2: the map entry stays text-only spoken (no streamUrl ever joins) while the segments map still resolves from the same fetch — calls=" + JSON.stringify(R.feedB.calls));
  // L9 — feed failure pin.
  ok(R.failC.intros["morning-prayer"] && R.failC.intros["morning-prayer"].text === "For Alice and her family." &&
     R.failC.descs.some((d) => d.id === "intro:morning-prayer" && d.spoken),
    "L9 a rejected intentions fetch leaves day.intros text-built and the spoken intro descriptor standing (the defect-shape regression pin)");
  // L4 — end → advance; played state untouched by the intro.
  ok(R.l4.spokenText === "This prayer is for For Alice and her family." && R.l4.current === "morning-prayer" && R.l4.playCalls >= 1 && R.l4.src.includes("morning-prayer"),
    "L4 the utterance speaks the standing script, its end advances into the prayer on the element (src set, play called) — spoken=" + JSON.stringify(R.l4.spokenText) + ", current=" + R.l4.current);
  ok(Object.keys(R.l4.played).length === 0 && Object.keys(R.l4.afterIntroMark).length === 0 && !!R.l4.afterPrayerMark["morning-prayer"],
    "L4 played state: the intro's end marks NOTHING, markCompleted refuses the intro descriptor itself, and the prayer marks only at its own end (the pair shares the prayer's record) — played=" + JSON.stringify(R.l4.played) + ", afterIntroMark=" + JSON.stringify(R.l4.afterIntroMark) + ", afterPrayerMark=" + JSON.stringify(R.l4.afterPrayerMark));
  // L5 — watchdog, never-start.
  ok(R.l5.current === "morning-prayer" && R.l5.cancels >= 1,
    "L5 a never-starting utterance passes over inside the start bound (" + R.bounds.startMs + "ms) — cancel fired, the prayer plays (current=" + R.l5.current + ")");
  // L6 — not-allowed.
  ok(R.l6.current === "morning-prayer",
    "L6 a not-allowed utterance passes over inside the bound and the prayer plays — no stall, no error surface (current=" + R.l6.current + ")");
  // L7 — pause/resume + the sleep-stop branch.
  ok(R.l7paused.cancels >= 1 && R.l7paused.playing === false && R.l7paused.hook.paused === true &&
     R.l7resumed.speaks > R.l7resumed.before && R.l7resumed.sameText && R.l7resumed.playing === true &&
     R.l7sleep.paused === true && R.l7sleep.playing === false,
    "L7 pause = cancel (glyphs paused); resume re-speaks the SAME text from the start; a minutes-mode sleep stop landing mid-utterance pauses the speech");
  // L8 — skip + token guard.
  ok(R.l8.cancels >= 1 && R.l8.current === "morning-prayer" && R.l8.idx === 1,
    "L8 skip mid-speech cancels once and starts the prayer; the killed utterance's late interrupted error changes nothing (current=" + R.l8.current + ", idx=" + R.l8.idx + ")");
  // L10 — foreground gate.
  ok(R.l10.speaks === 0 && R.l10.current === "morning-prayer",
    "L10 hidden at the intro's turn: NO speak call — the intro passes over at once and the prayer starts (D5)");
  // L11 — re-resolution.
  ok(R.l11.spokenText === "This prayer is for Second drawn text." && R.l11.current === "intro:morning-prayer",
    "L11 advance re-resolves the spoken descriptor against the fresh build — the FRESH drawn text is what speaks (spoken=" + JSON.stringify(R.l11.spokenText) + ")");
  // L12 — Now Playing + grouping.
  ok(R.l12.npIntention === "Prayer Intention: For Alice and her family." && R.l12.npShown &&
     R.l12.queueIntroTitle === "Prayer Intention: Morning Prayer" && R.l12group === 0,
    "L12 during a spoken intro, Now Playing shows 'Prayer Intention: ' + the drawn text (v372 reads the descriptor) and the queue lists the entry under its recomputed title; once the prayer stands played, the rebuilt queue drops BOTH (no orphan spoken intro)");
  // L13 — voice pick.
  ok(R.l13a && R.l13a.name === "US Voice Default" && R.l13a.isDefault === true &&
     R.l13b && R.l13b.name === "US Voice A" &&
     R.l13c.voiceName === "US Voice A" && R.l13c.lang === "en-US",
    "L13 the D6 pick: the default-flagged en-US wins (en_US normalized before comparison); with no default, the first en-US; the utterance carries that voice and lang en-US — a=" + JSON.stringify(R.l13a) + ", b=" + JSON.stringify(R.l13b) + ", c=" + JSON.stringify(R.l13c));
  // N1/N2 — the native route carries the speech; the dead web
  // engine is never consulted; the native end advances.
  ok(R.n1mid.bridgeSpeaks === 1 && R.n1mid.text === "This prayer is for For Alice and her family." &&
     typeof R.n1mid.id === "string" && R.n1mid.id.indexOf("opn-") === 0 && R.n1mid.webSpeaks === 0 &&
     R.n1mid.hook.native === true && R.n1mid.hook.nativeId === R.n1mid.id,
    "N1 in the shell the funnel routes to the bridge: speakText called once with the exact standing script and an opn- utterance id; the web engine (dead here) is never spoken to; the hook shows the native route live — " + JSON.stringify(R.n1mid));
  ok(R.n1.current === "morning-prayer" && R.n1.bridgeSpeaks === 1 && R.n1.webSpeaks === 0,
    "N2 the native end event advances the funnel into the prayer (current=" + R.n1.current + ")");
  // N3 — native error pass-over.
  ok(R.n3.current === "morning-prayer" && R.n3.bridgeSpeaks === 1,
    "N3 a native error (engine unavailable) passes over fast and the prayer plays (current=" + R.n3.current + ")");
  // N4 — native silence: watchdog + stopSpeech.
  ok(R.n4.current === "morning-prayer" && R.n4.stops >= 1,
    "N4 native silence is bounded by the same start watchdog (" + R.bounds.startMs + "ms); the cancel reaches the native transport via stopSpeech (stops=" + R.n4.stops + ", current=" + R.n4.current + ")");
  // N5 — pause/resume on the native transport.
  ok(R.n5paused.stops >= 1 && R.n5paused.playing === false && R.n5paused.hook.paused === true &&
     R.n5.speaks > R.n5.before && R.n5.sameText && R.n5.playing === true,
    "N5 pause stops the native speech; resume re-speaks the SAME text natively (speaks " + R.n5.before + " -> " + R.n5.speaks + ")");
  // N6 — stale event guard.
  ok(R.n6mid.current === "intro:morning-prayer" && R.n6.current === "morning-prayer" && typeof R.n6mid.liveId === "string",
    "N6 a foreign utterance id's end event changes nothing (still on the intro); the live id's end advances (current=" + R.n6.current + ")");
  // N7 — no bridge: the web path, unchanged.
  ok(R.n7.webSpeaks === 1 && R.n7.current === "morning-prayer",
    "N7 with the bridge absent the web path speaks and advances exactly as in v375 (webSpeaks=" + R.n7.webSpeaks + ", current=" + R.n7.current + ")");
  ok(pageErrors.length === 0, "browser: zero page errors" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v379: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
