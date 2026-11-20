#!/usr/bin/env node
// harness-v372 — the v372 gate (Plan §2 Step 6 legs (a)–(j)):
// Now Playing shows the current track's paired prayer intention in
// the hero, under #np-meta and above #np-litday, labeled exactly
// 'Prayer Intention: ' + the drawn text (D1-A · D2-A), wrapping in
// full with no clamp (D4-A), the dock untouched (D3-A). Legs:
// S* static (hero element position in the openNowPlaying markup,
// the .np-intention rule's exact text + the ABSENCE of any clamp /
// max-height / overflow restriction in it, SW pin, the updateDock
// source carrying no intention reference, tracked diff scope vs
// the v371 base), B* the browser legs — the client's VERBATIM
// functions (esc, fmtDur, trackDesc, introDescFor, expandDescs,
// introForTrack, npDuration, openNowPlaying, updateNowPlaying,
// updateNpSeek, updateDock, updateDockProgress) extracted from the
// candidate source and run in real Chromium over fixture
// descriptors built through the verbatim expandDescs seam, so the
// intro descriptors carry intentionText exactly as production
// builds them. (j) is the harness-v368 regression, run separately
// in its standing posture and tallied from its own complete log.
// Tallies read from the COMPLETE log. No wrangler boot: the change
// is a client display sync on data already on the device.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v372 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const BASE = "737661d";

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

// ---- S legs: static ---------------------------------------------
const metaAt = CLIENT.indexOf('id="np-meta"');
const intAt = CLIENT.indexOf('id="np-intention"');
const litAt = CLIENT.indexOf('id="np-litday"');
ok(metaAt >= 0 && intAt > metaAt && litAt > intAt,
  "S1 hero markup order in openNowPlaying: #np-meta -> #np-intention -> #np-litday");
ok(CLIENT.includes('<div class="np-intention" id="np-intention" style="display:none"></div>'),
  "S2 #np-intention stands always in the hero markup, starting hidden and empty");
const ruleM = UI.match(/\.np-intention \{[^}]*\}/);
ok(!!ruleM, "S3 .np-intention rule stands in ui.ts");
const RULE = ".np-intention { font-size:14px; line-height:1.45; letter-spacing:.2px; color:var(--bar-sub); text-align:center; margin-top:6px; }";
ok(ruleM && ruleM[0] === RULE, "S4 .np-intention rule is exactly the Plan Step 3 rule");
ok(ruleM && !/line-clamp|max-height|overflow|text-overflow/.test(ruleM[0]),
  "S5 D4-A: the rule carries NO line-clamp, max-height, or overflow restriction");
ok(UI.includes('var CACHE = "ora-pro-nobis-v372-1";') && !UI.includes("ora-pro-nobis-v371-1"),
  "S6 SW pin ora-pro-nobis-v372-1 stands; the v371 pin is gone");
const dockSrc = extractFn(CLIENT, "updateDock");
ok(!/np-intention|intentionText|introForTrack/.test(dockSrc),
  "S7 D3-A: updateDock source carries no intention element, text, or lookup");
const updSrc = extractFn(CLIENT, "updateNowPlaying");
const litSyncAt = updSrc.indexOf("#np-litday");
const intSyncAt = updSrc.indexOf("#np-intention");
const previewAt = updSrc.indexOf("np-preview");
ok(previewAt >= 0 && litSyncAt > previewAt && intSyncAt > litSyncAt,
  "S8 the intention sync stands after the np-preview early return and directly after the #np-litday sync");
ok(updSrc.includes("cur.kind === 'intention'") && updSrc.includes("cur.intentionText") &&
   updSrc.includes("introForTrack(cur)") && updSrc.includes("'Prayer Intention: ' + intText"),
  "S9 source rule order stands: intro track reads its own intentionText; other tracks read introForTrack; the label is set as one string in the paired branch only");
const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE], { encoding: "utf8" })
  .split("\n").filter(Boolean).sort();
ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]),
  "S10 tracked diff vs the v371 base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");

// ---- B legs: verbatim client in real Chromium -------------------
const PAGE_SRC = [
  extractFn(CLIENT, "esc"), extractFn(CLIENT, "fmtDur"),
  extractFn(CLIENT, "trackDesc"), extractFn(CLIENT, "introDescFor"), extractFn(CLIENT, "expandDescs"),
  extractFn(CLIENT, "introForTrack"), extractFn(CLIENT, "npDuration"),
  extractFn(CLIENT, "openNowPlaying"), extractFn(CLIENT, "updateNowPlaying"), extractFn(CLIENT, "updateNpSeek"),
  extractFn(CLIENT, "updateDockProgress"), extractFn(CLIENT, "updateDock"),
].join("\n");

const FIXTURE = `
var npScrubbing = false;
var audioEl = document.createElement('audio');
var state = {
  current: null,
  liturgical: { name: 'Memorial of Saint Martin of Tours, Bishop' },
  dateLabel: 'Wednesday, November 11, 2026',
  queue: [], queueIdx: 0, rate: 1, readTracks: {}, dayDescs: [], dayPayload: { intros: {} },
  expandedIntros: {}
};
function renderQueueList() {}
function syncAutoplayToggles() {}
function sleepLabel() { return 'Sleep Off'; }
function measureBars() {}
${PAGE_SRC}
var TEXTS = {
  mp: 'For Jennifer — that she study well and pass the bar examination.',
  biay: 'For Dylan — for diligence in his schoolwork and band practice.',
  nov: 'For Pamela — for rest and strength in her nursing work.',
  ros: 'For Camille — for joy in learning and kindness to her classmates.',
  sig: 'For those discerning a vocation — for clarity and peace.',
  long: 'For the whole Thibeaux family and for everyone named in the parish book of intentions this week — for health of body and soul, for steady work and honest provision, for reconciliation where it is needed, for the repose of the souls of the faithful departed, and for the grace to keep the morning offering faithfully through every day of this novena and beyond it, without ceasing.'
};
var day = { intros: {
  'morning-prayer': { title: 'Morning Prayer', text: TEXTS.mp, streamUrl: 'https://x/mp-intro.mp3' },
  'daily-rosary': { title: 'Daily Rosary', text: TEXTS.ros, streamUrl: 'https://x/ros-intro.mp3' },
  'ext-bible-in-a-year': { title: 'Bible in a Year', text: TEXTS.biay, streamUrl: 'https://x/biay-intro.mp3' },
  'novena-st-jude': { title: 'Novena to Saint Jude', text: TEXTS.nov, streamUrl: 'https://x/nov-intro.mp3' },
  'the-ai-signal': { title: 'The AI Signal', text: TEXTS.sig, streamUrl: 'https://x/sig-intro.mp3' },
  'daily-reflection': { title: 'Daily Reflection', text: TEXTS.long, streamUrl: 'https://x/long-intro.mp3' }
} };
function track(episodeId, title, block) {
  return { episodeId: episodeId, title: title, streamUrl: 'https://x/' + episodeId + '.mp3', available: true, _block: block, source: 'Ora Pro Nobis', durationS: 600 };
}
var pairs = {};
['morning-prayer|Morning Prayer|Morning', 'daily-rosary|Daily Rosary|Morning',
 'ext-bible-in-a-year|Bible in a Year Day 315|Morning', 'novena-st-jude|Novena to Saint Jude|Novenas',
 'the-ai-signal|The AI Signal|The AI Signal', 'daily-reflection|Daily Reflection|Midmorning']
.forEach(function (s) { var p = s.split('|'); pairs[p[0]] = expandDescs(track(p[0], p[1], p[2]), day); });
state.dayDescs = Object.values(pairs).flat();
var segDesc = trackDesc({ _block: 'Morning' });
function setCurrent(desc) { state.current = desc; openNowPlaying(); }
function npState() {
  var sheet = document.querySelector('.np-sheet');
  var el = sheet && sheet.querySelector('#np-intention');
  if (!el) return { el: false };
  var kids = Array.prototype.slice.call(sheet.querySelector('.np-hero').children);
  return {
    el: true,
    text: el.textContent,
    display: el.style.display,
    visible: el.offsetParent !== null || el.getClientRects().length > 0,
    heroOrder: kids.map(function (k) { return k.id || k.className; }),
    sheetText: sheet.textContent,
    height: el.offsetHeight,
    clamp: getComputedStyle(el).webkitLineClamp,
    overflow: getComputedStyle(el).overflow,
    fontSize: getComputedStyle(el).fontSize
  };
}
var R = {};
// (a) own prayer
setCurrent(pairs['morning-prayer'][1]); R.a = npState();
// (b) external — Bible in a Year
setCurrent(pairs['ext-bible-in-a-year'][1]); R.b = npState();
// (c) novena track — the shared Novenas draw
setCurrent(pairs['novena-st-jude'][1]); R.c = npState();
// (d) the intro descriptor itself playing
setCurrent(pairs['morning-prayer'][0]); R.d = npState();
// (e) The AI Signal episode
setCurrent(pairs['the-ai-signal'][1]); R.e = npState();
// (f) no-intention track — the block-opening seg descriptor
setCurrent(segDesc); R.f = npState();
// (g) track change on the standing sheet: paired -> unpaired -> paired
state.current = pairs['daily-rosary'][1]; updateNowPlaying(); R.g1 = npState();
state.current = segDesc; updateNowPlaying(); R.g2 = npState();
state.current = pairs['daily-rosary'][1]; updateNowPlaying(); R.g3 = npState();
// (h) long intention wraps in full
setCurrent(pairs['daily-reflection'][1]); R.h = npState();
// (i) dock after updateDock on a paired track
state.current = pairs['morning-prayer'][1]; updateDock();
var dock = document.getElementById('dock');
R.i = { html: dock.innerHTML, title: document.getElementById('dock-title').textContent, meta: document.getElementById('dock-meta').textContent };
return { R: R, TEXTS: TEXTS };
`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    :root { --bar-sub: #666; }
    body { margin: 0; font-family: sans-serif; }
    .sheet { position: relative; } .inner { padding: 14px; }
    ${ruleM ? ruleM[0] : ""}
    .np-litday { font-size:13px; letter-spacing:.4px; color:var(--bar-sub); text-align:center; margin-top:2px; }
  </style></head><body>
    <div id="dock" class="hidden"><span id="dock-title"></span><span id="dock-meta"></span><button id="dock-play"></button><button id="dock-next"></button><div id="dock-progress-fill"></div></div>
  </body></html>`);
  const out = await page.evaluate("(() => {\n" + FIXTURE + "\n})()");
  const { R, TEXTS } = out;
  const heroOrderOk = (s) => {
    const ids = s.heroOrder;
    const ti = ids.indexOf("np-title"), me = ids.indexOf("np-meta"), it = ids.indexOf("np-intention"), li = ids.indexOf("np-litday");
    return ti >= 0 && me > ti && it > me && li > it;
  };
  ok(R.a.el && R.a.text === "Prayer Intention: " + TEXTS.mp && R.a.display === "" && R.a.visible,
    "(a) own prayer: Now Playing shows the paired intention under the exact label, element shown");
  ok(heroOrderOk(R.a), "(a) hero DOM order stands #np-title -> #np-meta -> #np-intention -> #np-litday");
  ok(R.b.el && R.b.text === "Prayer Intention: " + TEXTS.biay && R.b.display === "",
    "(b) Bible in a Year external: the line shows that slot's drawn text under the same label");
  ok(R.c.el && R.c.text === "Prayer Intention: " + TEXTS.nov && R.c.display === "",
    "(c) novena track: the line shows the shared Novenas draw");
  ok(R.d.el && R.d.text === "Prayer Intention: " + TEXTS.mp && R.d.display === "",
    "(d) intro track playing: the line shows its own intentionText under the label");
  ok(R.e.el && R.e.text === "Prayer Intention: " + TEXTS.sig && R.e.display === "",
    "(e) The AI Signal episode: the line shows its own item's draw");
  ok(R.f.el && R.f.display === "none" && R.f.text === "" && !R.f.sheetText.includes("Prayer Intention:"),
    "(f) no-intention track: element hidden and emptied; no 'Prayer Intention:' label string anywhere in the sheet");
  ok(R.g1.text === "Prayer Intention: " + TEXTS.ros && R.g1.display === "" &&
     R.g2.display === "none" && R.g2.text === "" &&
     R.g3.text === "Prayer Intention: " + TEXTS.ros && R.g3.display === "",
    "(g) track change paired -> unpaired -> paired: the line follows state.current on every updateNowPlaying");
  ok(R.h.text === "Prayer Intention: " + TEXTS.long && (R.h.clamp === "none" || R.h.clamp === "") && R.h.overflow === "visible" && R.h.height > 61,
    "(h) long intention renders in full: text entire, no clamp, overflow visible, height wraps past two lines (got " + R.h.height + "px)");
  ok(!R.i.html.includes("np-intention") && !R.i.html.includes(TEXTS.mp) && R.i.title === "Morning Prayer" && R.i.meta === "Morning",
    "(i) dock after updateDock: no intention element and no intention text; title/meta painting unchanged");
} finally {
  await browser.close();
}

console.log(`# harness-v372: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
