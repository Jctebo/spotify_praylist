#!/usr/bin/env node
// harness-v373 — the v373 gate (Plan §2 harness legs (a)–(i)):
// with NO PIN set, the Examination and Confession tabs no longer
// open (D1-B, reversing v356 decision 6) — a set-a-PIN prompt
// stands in the tab in place of the content, with no dismiss
// path; a failed /api/pin/state read fails CLOSED to the same
// prompt's unreadable variant with a Try again. Legs: S* static
// (the changed branches' exact shape, the prompt's exact copy,
// SW pin, diff scope vs the v372 base, the consequential
// Settings copy, the untouched other tabs, whole-worker bundle),
// B* the browser legs — the client's VERBATIM functions (post,
// fetchPinState, gatedTabRender, pinGateTitles, renderPinGate,
// renderPinSetupPrompt, the PIN pad machinery, showRecoverySheet,
// pinRefusalGate, fillPinSection, openPinSetSheet) extracted from
// the candidate source and run in real Chromium over a stubbed
// api() seam whose /api/pin/state answer the fixture controls.
// The content functions are spies: in production the content
// render IS the gated fetch, so "contentFn never called" is the
// "no gated fetch, no content bytes" assertion. Tallies read
// from the COMPLETE log. No wrangler boot: the change is one
// client branch family on state the client already reads.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v373 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const BASE = "39d7de7";

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
const gateSrc = extractFn(CLIENT, "gatedTabRender");
ok((gateSrc.match(/if \(pinToken\) \{ contentFn\(\); return; \}/g) || []).length === 2,
  "S1 gatedTabRender: contentFn is invoked on the two token paths ONLY (standing token + token landed during the fetch)");
ok((gateSrc.match(/renderPinSetupPrompt\(tab, contentFn, \{\}\)/g) || []).length === 2,
  "S1 gatedTabRender: the cached no-PIN branch and the fresh no-PIN branch both render renderPinSetupPrompt");
ok(gateSrc.includes("renderPinSetupPrompt(tab, contentFn, { unreadable: true })") && !gateSrc.includes(".catch(function () { contentFn(); })"),
  "S1 gatedTabRender: the fetch-failure catch renders the fail-closed unreadable variant — the old fail-open catch is gone");
const promptSrc = extractFn(CLIENT, "renderPinSetupPrompt");
ok(CLIENT.indexOf("function renderPinSetupPrompt(") > CLIENT.indexOf("function renderPinGate("),
  "S2 renderPinSetupPrompt stands directly after renderPinGate in the source");
ok(promptSrc.includes("No PIN is set yet &mdash; this tab stays locked until you set a PIN.") &&
   promptSrc.includes("The PIN state could not be read &mdash; this tab stays locked until it can be checked.") &&
   promptSrc.includes('id="pin-setup-open"') && promptSrc.includes("Set a PIN</button>") &&
   promptSrc.includes('id="pin-setup-retry"') && promptSrc.includes("Try again</button>") &&
   promptSrc.includes("openPinSetSheet('set')") && promptSrc.includes("gatedTabRender(tab, contentFn)"),
  "S2 the prompt carries the spec's exact copy, the Set a PIN button into the standing sheet, and the Try again re-invocation");
ok(!promptSrc.includes("contentFn()") && !/close|dismiss|skip/i.test(promptSrc.replace(/addEventListener/g, "")),
  "S2 the prompt never invokes contentFn and carries no close/dismiss/skip control");
ok(UI.includes('var CACHE = "ora-pro-nobis-v373-1";') && !UI.includes("ora-pro-nobis-v372-1"),
  "S3 SW pin ora-pro-nobis-v373-1 stands; the v372 pin is gone");
const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE], { encoding: "utf8" })
  .split("\n").filter(Boolean).sort();
ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]),
  "S4 tracked diff vs the v372 base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
const uiDiff = execFileSync("git", ["-C", WT, "diff", BASE, "--", "app/worker/src/ui.ts"], { encoding: "utf8" })
  .split("\n").filter((l) => /^[+-]/.test(l) && !/^[+-]{3}/.test(l));
ok(uiDiff.length === 2 && uiDiff.every((l) => l.includes("ora-pro-nobis-v37")),
  "S4 the ui.ts diff is the CACHE pin line only — no new CSS (got: " + uiDiff.join(" | ") + ")");
ok(!CLIENT.includes("open without a PIN") && !CLIENT.includes("will open without it") &&
   CLIENT.includes("No PIN is set. Confession and Examination stay locked until you set one.") &&
   CLIENT.includes("Remove the PIN? Confession and Examination will stay locked until a new PIN is set."),
  "S5 consequential copy: both old strings are gone from the client; both new strings stand (Settings card + Remove-PIN confirm)");
let bundles = true;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v373-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
} catch { bundles = false; }
ok(bundles, "S6 the whole worker bundles clean (esbuild) — no syntax break anywhere in the client");
const prayersSrc = extractFn(CLIENT, "renderPrayers");
const intentionsSrc = extractFn(CLIENT, "renderIntentions");
ok(!prayersSrc.includes("gatedTabRender") && !prayersSrc.includes("renderPinSetupPrompt") &&
   !intentionsSrc.includes("gatedTabRender") && !intentionsSrc.includes("renderPinSetupPrompt") &&
   CLIENT.includes("function renderExamination() { gatedTabRender('examination', renderExaminationContent); }") &&
   CLIENT.includes("function renderConfession() { gatedTabRender('confession', renderConfessionContent); }"),
  "S7 (g, static) Prayers and Intentions never touch the gate or the prompt; Examination and Confession route through gatedTabRender exactly as before");

// ---- B legs: verbatim client in real Chromium -------------------
const PAGE_SRC = [
  extractFn(CLIENT, "esc"), extractFn(CLIENT, "post"), extractFn(CLIENT, "clearPinWait"),
  extractFn(CLIENT, "fetchPinState"), extractFn(CLIENT, "gatedTabRender"), extractFn(CLIENT, "pinGateTitles"),
  extractFn(CLIENT, "renderPinGate"), extractFn(CLIENT, "renderPinSetupPrompt"), extractFn(CLIENT, "paintPinDots"),
  extractFn(CLIENT, "setPinMsg"), extractFn(CLIENT, "startPinWait"), extractFn(CLIENT, "submitPinVerify"),
  extractFn(CLIENT, "renderPinRecoveryForm"), extractFn(CLIENT, "showRecoverySheet"), extractFn(CLIENT, "selectRecoveryText"),
  extractFn(CLIENT, "pinRefusalGate"), extractFn(CLIENT, "fillPinSection"), extractFn(CLIENT, "openPinSetSheet"),
].join("\n");

const FIXTURE = `
var pinToken = null;
var pinStateCache = null;
var pinGateCtx = null;
var pinWaitTimer = null;
var view = document.getElementById('view');
var apiCalls = [];
var pinWorld = { mode: 'unset' };
function api(path, opts) {
  opts = opts || {};
  var method = opts.method || 'GET';
  apiCalls.push(method + ' ' + path);
  if (path === '/api/pin/state') {
    if (pinWorld.mode === 'fail') return Promise.reject(new Error('network down'));
    return Promise.resolve({ pinSet: pinWorld.mode === 'set', retryAfterSeconds: 0 });
  }
  if (path === '/api/pin/set') { pinWorld.mode = 'set'; return Promise.resolve({ token: 'tok-set-1', recoveryCode: 'AAAA-BBBB-CCCC' }); }
  if (path === '/api/pin/verify') return Promise.resolve({ token: 'tok-verify-1' });
  if (path === '/api/pin/remove') { pinWorld.mode = 'unset'; return Promise.resolve({ ok: true }); }
  return Promise.resolve({});
}
var settingsRenders = 0;
function renderSettings() { settingsRenders++; view.innerHTML = '<div id="settings-marker">SETTINGS</div><div id="pin-section"></div>'; }
window.__confirmMsg = null;
window.confirm = function (m) { window.__confirmMsg = m; return false; };
window.alert = function () {};
var examCalls = 0, confCalls = 0;
function examContent() { examCalls++; view.innerHTML = '<div id="exam-content">EXAM CONTENT</div>'; }
function confContent() { confCalls++; view.innerHTML = '<div id="conf-content">CONF CONTENT</div>'; }
${PAGE_SRC}
function resetGate() {
  pinToken = null; pinStateCache = null; pinGateCtx = null; clearPinWait();
  document.querySelectorAll('.sheet').forEach(function (s) { s.remove(); });
  view.innerHTML = ''; apiCalls = []; settingsRenders = 0; window.__confirmMsg = null;
}
function flush() { return new Promise(function (r) { setTimeout(r, 5); }).then(function () { return new Promise(function (r) { setTimeout(r, 5); }); }); }
function lockline() { var el = view.querySelector('.lockline'); return el ? el.textContent : null; }
function heading() { var el = view.querySelector('h1.screen'); return el ? el.textContent : null; }
var R = {};
// (a) Examination, no PIN set, fresh state read
pinWorld.mode = 'unset'; resetGate(); examCalls = 0;
gatedTabRender('examination', examContent); await flush();
R.a = { btn: !!document.getElementById('pin-setup-open'), heading: heading(), line: lockline(),
  content: !!document.getElementById('exam-content'), examCalls: examCalls, calls: apiCalls.slice(),
  cardCls: (view.querySelector('.card') || { className: '' }).className };
// (b) Confession, no PIN set, fresh state read
resetGate(); confCalls = 0;
gatedTabRender('confession', confContent); await flush();
R.b = { btn: !!document.getElementById('pin-setup-open'), heading: heading(), line: lockline(),
  content: !!document.getElementById('conf-content'), confCalls: confCalls, calls: apiCalls.slice() };
// (c) no dismiss path: click everything that is not the Set a PIN
// button; then re-enter (the cached branch) — the prompt stands.
var cBtns = Array.prototype.map.call(view.querySelectorAll('button'), function (b) { return b.id; });
var cLinks = view.querySelectorAll('a').length;
view.querySelector('h1.screen').click();
view.querySelector('.card.pingate').click();
view.querySelector('.lockline').click();
await flush();
var cClicks = { confCalls: confCalls, prompt: !!document.getElementById('pin-setup-open') };
gatedTabRender('confession', confContent);
R.c = { btns: cBtns, links: cLinks, afterClicks: cClicks,
  reentryPrompt: !!document.getElementById('pin-setup-open'), confCalls: confCalls, calls: apiCalls.slice() };
// (d) set a PIN from the prompt
document.getElementById('pin-setup-open').click();
var dSheet = !!document.querySelector('.pinsetsheet');
document.getElementById('ps-pin1').value = '2468';
document.getElementById('ps-pin2').value = '2468';
document.getElementById('ps-save').click(); await flush();
var dRec = !!document.querySelector('.recoverysheet');
var dCode = (document.getElementById('rec-code-text') || {}).textContent || null;
var dToken = pinToken;
document.getElementById('rec-done').click(); await flush();
var dSettings = settingsRenders, dMarker = !!document.getElementById('settings-marker');
examCalls = 0;
gatedTabRender('examination', examContent);
var dTokenPath = { examCalls: examCalls, content: !!document.getElementById('exam-content') };
pinToken = null; // the app closes: the memory-only token is gone
gatedTabRender('examination', examContent); await flush();
R.d = { sheet: dSheet, recovery: dRec, code: dCode, token: dToken, settingsRenders: dSettings, marker: dMarker,
  tokenPath: dTokenPath,
  lockedAgain: { card: !!document.getElementById('pingate-card'), pad: !!document.getElementById('pinpad'),
    forgot: !!document.getElementById('pin-forgot'), examCalls: examCalls, content: !!document.getElementById('exam-content') } };
// (f) PIN set + unlocked session: the token path, exactly as today
pinToken = 'tok-manual'; confCalls = 0;
gatedTabRender('confession', confContent);
R.f = { confCalls: confCalls, content: !!document.getElementById('conf-content') };
// (h) Settings copy in the live section
resetGate(); pinWorld.mode = 'unset';
view.innerHTML = '<div id="pin-section"></div>';
fillPinSection(); await flush();
var hNoPin = document.getElementById('pin-section').textContent;
var hSetOpen = !!document.getElementById('pin-set-open');
pinWorld.mode = 'set'; pinToken = 'tok-m'; pinStateCache = null;
fillPinSection(); await flush();
var hRemove = !!document.getElementById('pin-remove');
if (hRemove) document.getElementById('pin-remove').click();
R.h = { noPinText: hNoPin, setOpen: hSetOpen, hasRemove: hRemove, confirmMsg: window.__confirmMsg };
// (i) the state read fails: fail closed, Try again restores
resetGate(); pinWorld.mode = 'fail'; examCalls = 0;
gatedTabRender('examination', examContent); await flush();
var iFirst = { retry: !!document.getElementById('pin-setup-retry'), line: lockline(),
  content: !!document.getElementById('exam-content'), examCalls: examCalls, setupBtn: !!document.getElementById('pin-setup-open') };
pinWorld.mode = 'unset';
document.getElementById('pin-setup-retry').click(); await flush();
R.i = { first: iFirst, afterRetry: { setupBtn: !!document.getElementById('pin-setup-open'),
  retry: !!document.getElementById('pin-setup-retry'), examCalls: examCalls, content: !!document.getElementById('exam-content') } };
return R;
`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="view"></div></body></html>`);
  const R = await page.evaluate("(async () => {\n" + FIXTURE + "\n})()");
  ok(R.a.btn && R.a.heading === "Tonight’s examination" && R.a.cardCls.includes("pingate"),
    "(a) Examination with no PIN set: the set-a-PIN prompt stands in the tab (gate heading + .card.pingate shell)");
  ok(R.a.line === "No PIN is set yet — this tab stays locked until you set a PIN.",
    "(a) the prompt's explanation line is the spec copy, verbatim");
  ok(!R.a.content && R.a.examCalls === 0 && JSON.stringify(R.a.calls) === JSON.stringify(["GET /api/pin/state"]),
    "(a) the examination content is absent from the DOM, the content render never ran, and the ONLY call was the state read — no gated fetch");
  ok(R.b.btn && R.b.heading === "Confession" && R.b.line === "No PIN is set yet — this tab stays locked until you set a PIN." &&
     !R.b.content && R.b.confCalls === 0 && JSON.stringify(R.b.calls) === JSON.stringify(["GET /api/pin/state"]),
    "(b) Confession with no PIN set: the same prompt with the Confession heading; content absent; no gated fetch");
  ok(JSON.stringify(R.c.btns) === JSON.stringify(["pin-setup-open"]) && R.c.links === 0 &&
     R.c.afterClicks.confCalls === 0 && R.c.afterClicks.prompt && R.c.reentryPrompt && R.c.confCalls === 0 &&
     JSON.stringify(R.c.calls) === JSON.stringify(["GET /api/pin/state"]),
    "(c) no dismiss path: the prompt's only button is Set a PIN, there are no links, clicking the heading/card/line renders no content, and re-entry (cached branch) re-renders the prompt with no second fetch");
  ok(R.d.sheet && R.d.recovery && R.d.code === "AAAA-BBBB-CCCC" && R.d.token === "tok-set-1",
    "(d) Set a PIN at the prompt opens the standing sheet unchanged; a matching pair POSTs the set and the recovery sheet shows the code once, token standing");
  ok(R.d.settingsRenders === 1 && R.d.marker && R.d.tokenPath.examCalls === 1 && R.d.tokenPath.content,
    "(d) dismissing the recovery sheet lands on Settings (the sheet's standing onDone); the next gated entry renders the content through the unchanged token path");
  ok(R.d.lockedAgain.card && R.d.lockedAgain.pad && R.d.lockedAgain.forgot && R.d.lockedAgain.examCalls === 1 && !R.d.lockedAgain.content,
    "(e) PIN set + locked session (token gone after close): renderPinGate stands exactly as today — pad, Unlock, Forgot line — and no content is fetched");
  ok(R.f.confCalls === 1 && R.f.content,
    "(f) PIN set + unlocked session (token standing): the content renders exactly as today");
  ok(R.h.noPinText.includes("No PIN is set. Confession and Examination stay locked until you set one.") && R.h.setOpen,
    "(h) the Settings no-PIN card reads the new copy and still offers its own Set a PIN");
  ok(R.h.hasRemove && R.h.confirmMsg === "Remove the PIN? Confession and Examination will stay locked until a new PIN is set.",
    "(h) the Remove-PIN confirm reads the new copy, verbatim");
  ok(R.i.first.retry && R.i.first.line === "The PIN state could not be read — this tab stays locked until it can be checked." &&
     !R.i.first.content && R.i.first.examCalls === 0 && !R.i.first.setupBtn,
    "(i) a failed state read fails CLOSED: the unreadable variant stands (copy + Try again), no content in the DOM, no Set a PIN offered against an unknown state");
  ok(R.i.afterRetry.setupBtn && !R.i.afterRetry.retry && R.i.afterRetry.examCalls === 0 && !R.i.afterRetry.content,
    "(i) Try again re-invokes the gate and, with the read restored to pinSet:false, lands on the set-a-PIN prompt");
  ok(pageErrors.length === 0, "browser: zero page errors" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
}

console.log(`# harness-v373: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
