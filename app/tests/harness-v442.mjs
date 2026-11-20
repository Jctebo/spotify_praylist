#!/usr/bin/env node
// harness-v442 — Examination: the commandment chips return
// as navigation, and the commandment is named (§§1–2 of the
// v442 release document; John's words, Ora thread,
// 2026-11-15 10:16–10:18 CT: "The examination row of
// scrollable chips is not there. I am stuck on one
// commandment" · "Also name commandment" · "But only 1 row.
// And I can scroll to right"). Client delta: client.ts —
// state.examCat (null = tonight's focus); the render and
// the wiring resolve the category as
// state.examCat || focusCategory || first; a chips row
// (one .chip per Commandment category, payload order, the
// resolved one active + aria-pressed, disabled with the
// run closed) painted between the header row and the
// sectionhead, which now prints the RESOLVED category;
// chip taps set examCat + reset deepIdx and repaint
// through the standing path. ui.ts — the REQUIRED scoped
// rule: .examchips nowrap + overflow-x auto, its chips
// flex-none, so the row is exactly ONE row scrolling
// sideways. The rest of v428 stands entire. Legs S1–S4
// statics + P/N/G/E/C behavior, run in headless Chromium:
// the client's VERBATIM exam functions extracted from the
// candidate source and run over a stubbed api()/post()
// seam (fixture: the nine commandment categories in
// payload order, prompts in four categories, focus =
// Commandment IV, one standing custom entry under
// Commandment VII), with the real APP_CSS injected so the
// one-row legs measure true layout. renderExamination is
// stubbed to the content render (the standing mold
// practice — in production it is the PIN-gated wrapper,
// untouched by this release).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v442 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const BASE = "release/v441-ship";

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };

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

// ---- S1: the selection resolution + chips seats stand ----
{
  const examSrc = extractFn(CLIENT, "renderExaminationContent");
  const wireSrc = extractFn(CLIENT, "wireExamination");
  ok(CLIENT.includes("examCat: null") && examSrc.includes("var cat = state.examCat || data.focusCategory || cats[0];"),
    "S1 state.examCat stands (null = tonight's focus); the render resolves state.examCat || focusCategory || cats[0]");
  ok(wireSrc.includes("var cat = state.examCat || data.focusCategory || (data.categories || [])[0];"),
    "S1 the wiring resolves the category the same way (the custom-add post keys off it)");
  ok(examSrc.includes('class="chips examchips"') && examSrc.includes('data-examcat="') && examSrc.includes("c.indexOf('Commandment') === 0") &&
     examSrc.indexOf('class="chips examchips"') > examSrc.indexOf('id="ex-gear"') && examSrc.indexOf('class="chips examchips"') < examSrc.indexOf('class="sectionhead"'),
    "S1 the chips row emits between the header row and the heading, one chip per Commandment-prefixed category");
  ok(wireSrc.includes("[data-examcat]") && wireSrc.includes("state.examCat = b.getAttribute('data-examcat')") && wireSrc.includes("state.deepIdx = 0;"),
    "S1 the chip wiring stands: a tap sets examCat, resets deepIdx, repaints through renderExamination");
}

// ---- S2: the payload stands — index.ts byte-identical, return keys exact ----
{
  const diff = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src/index.ts"], { encoding: "utf8" }).trim();
  ok(diff === "", "S2 index.ts is byte-identical to the base (client-only release)", diff);
  ok(INDEX.includes("return { ok: true, date, dateLabel: prayerDateLabel(date), run, prompts: prompts.results ?? [], entries: entries.results ?? [], categories: cats, focusCategory };"),
    "S2 examToday's return keys stand: { ok, date, dateLabel, run, prompts, entries, categories, focusCategory }");
}

// ---- S3: diff scope + bundle + pin housekeeping ----
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]),
    "S3 the worker-source diff vs the v441-ship base is client.ts + ui.ts only (got: " + changed.join(", ") + ")");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v442-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S3 the whole worker bundles clean (esbuild) — no syntax break anywhere in the client");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v441-1";'),
    "S3 (housekeeping): the SW pin stands at ora-pro-nobis-v441-1 (Ship moves it)");
}

// ---- S4: the one-row rule stands in ui.ts (REQUIRED, John's refinement) ----
{
  ok(UI.includes(".examchips { flex-wrap:nowrap; overflow-x:auto; }") && UI.includes(".examchips .chip { flex:0 0 auto; }"),
    "S4 the scoped rule stands: .examchips nowrap + overflow-x auto, its chips flex-none — one row, sideways scroll");
}

// ---- B legs: verbatim client in real Chromium, real CSS --------
const PAGE_SRC = [
  extractFn(CLIENT, "esc"), extractFn(CLIENT, "skelHtml"), extractFn(CLIENT, "entriesHtml"),
  extractFn(CLIENT, "entryHtml"), extractFn(CLIENT, "entryFieldHtml"),
  extractFn(CLIENT, "renderExaminationContent"), extractFn(CLIENT, "wireExamination"),
  extractFn(CLIENT, "openPromptsEditor"),
].join("\n");

const FIXTURE = `
var view = document.getElementById('view');
var state = { deepIdx: 0, examCat: null };
var placeSkip = {};
var nextEntryId = 900;
function fixturePayload() {
  return {
    ok: true, date: '2026-11-15', dateLabel: 'Saturday, November 15',
    run: { id: 7, date: '2026-11-15', state: 'open' },
    categories: ['Preliminary Examination', 'Commandment I', 'Commandment II', 'Commandment III', 'Commandment IV', 'Commandment V', 'Commandment VI and IX', 'Commandment VII', 'Commandment VIII', 'Commandment X', 'Precepts of the Church', 'Capital Sins'],
    focusCategory: 'Commandment IV',
    prompts: [
      { id: 101, category: 'Commandment I', text: 'First commandment question A?' },
      { id: 102, category: 'Commandment I', text: 'First commandment question B?' },
      { id: 301, category: 'Commandment III', text: 'Third commandment question A?' },
      { id: 302, category: 'Commandment III', text: 'Third commandment question B?' },
      { id: 401, category: 'Commandment IV', text: 'Focus question one?' },
      { id: 402, category: 'Commandment IV', text: 'Focus question two?' },
      { id: 403, category: 'Commandment IV', text: 'Focus question three?' },
      { id: 701, category: 'Commandment VII', text: 'Seventh commandment question A?' },
      { id: 702, category: 'Commandment VII', text: 'Seventh commandment question B?' },
      { id: 901, category: 'Capital Sins', text: 'Capital sins question?' }
    ],
    entries: [
      { id: 55, run_id: 7, prompt_id: null, category: 'Commandment VII', text: 'A standing custom entry under VII.', created_at: '2026-11-15T02:00:00' }
    ]
  };
}
var WORLD = fixturePayload();
var CALLS = { posts: [], puts: [], deletes: [] };
function api(path, opts) {
  opts = opts || {};
  var method = opts.method || 'GET';
  if (method === 'GET' && path === '/api/exam/today') return Promise.resolve(JSON.parse(JSON.stringify(WORLD)));
  if (method === 'PUT' && path === '/api/exam/prompts') {
    var updates = JSON.parse(opts.body).prompts;
    CALLS.puts.push(updates);
    updates.forEach(function (u) { WORLD.prompts.forEach(function (p) { if (p.id === u.id) p.text = u.text; }); });
    return Promise.resolve({ ok: true });
  }
  if (method === 'DELETE' && path.indexOf('/api/exam/entries/') === 0) {
    var id = Number(path.slice('/api/exam/entries/'.length));
    CALLS.deletes.push(id);
    WORLD.entries = WORLD.entries.filter(function (e) { return e.id !== id; });
    return Promise.resolve({ ok: true });
  }
  return Promise.reject(new Error('unstubbed api: ' + method + ' ' + path));
}
function post(path, body) {
  CALLS.posts.push({ path: path, body: body });
  if (path === '/api/exam/entries') {
    WORLD.entries.push({ id: nextEntryId++, run_id: body.runId, prompt_id: body.promptId, category: body.category, text: body.text, created_at: '2026-11-15T03:00:00' });
    return Promise.resolve({ ok: true });
  }
  if (path === '/api/exam/runs/' + WORLD.run.id + '/close') { WORLD.run.state = 'closed'; return Promise.resolve({ ok: true }); }
  return Promise.reject(new Error('unstubbed post: ' + path));
}
function renderExamination() { renderExaminationContent(); }
function renderConscienceContent() {}
function pinRefusalGate() { return false; }
function fieldNote() {}
function wireFieldNotes() {}
var confirmOpts = null;
function openConfirm(opts) { confirmOpts = opts; }
function mountDrawer() {}
${PAGE_SRC}
function flush() { return new Promise(function (r) { setTimeout(r, 10); }).then(function () { return new Promise(function (r) { setTimeout(r, 10); }); }); }
function pagerText() { var el = view.querySelector('.row .meta.grow'); return el ? el.textContent : null; }
function headText() { var el = view.querySelector('h2.sectionhead'); return el ? el.textContent : null; }
function chipEls() { return Array.prototype.slice.call(view.querySelectorAll('[data-examcat]')); }
function rowMetrics() {
  var row = view.querySelector('.examchips');
  var chips = chipEls();
  if (!row || !chips.length) return null;
  var tops = chips.map(function (c) { return Math.round(c.getBoundingClientRect().top); });
  return { tops: tops, scrollW: row.scrollWidth, clientW: row.clientWidth,
    rowH: Math.round(row.getBoundingClientRect().height), chipH: Math.round(chips[0].getBoundingClientRect().height) };
}
var R = {};
// ---- P1: the paint at 412 ----
view.style.width = '412px';
state.deepIdx = 0; state.examCat = null; renderExaminationContent(); await flush();
var chips0 = chipEls();
R.p1 = {
  count: chips0.length,
  labels: chips0.map(function (c) { return c.textContent; }),
  cats: chips0.map(function (c) { return c.getAttribute('data-examcat'); }),
  active: chips0.filter(function (c) { return c.classList.contains('active'); }).map(function (c) { return c.getAttribute('data-examcat'); }),
  pressed: chips0.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return c.getAttribute('data-examcat'); }),
  anyDisabled: chips0.some(function (c) { return c.disabled; }),
  head: headText(), pager: pagerText(),
  firstText: (view.querySelector('.ptext') || {}).textContent || null,
  addOwn: view.textContent.includes('Add your own — Commandment IV')
};
R.row412 = rowMetrics();
// ---- P2: the one-row metrics at 360 ----
view.style.width = '360px';
renderExaminationContent(); await flush();
R.row360 = rowMetrics();
view.style.width = '412px';
renderExaminationContent(); await flush();
// ---- N: navigation — page inside IV first, then tap chip 3, then chip 1 ----
document.getElementById('deep-next').click(); await flush();
var midPager = pagerText();
view.querySelector('[data-examcat="Commandment III"]').click(); await flush();
var chipsN = chipEls();
R.n1 = { midPager: midPager, head: headText(), pager: pagerText(),
  firstText: (view.querySelector('.ptext') || {}).textContent || null,
  addOwn: view.textContent.includes('Add your own — Commandment III'),
  active: chipsN.filter(function (c) { return c.classList.contains('active'); }).map(function (c) { return c.getAttribute('data-examcat'); }),
  examCat: state.examCat, deepIdx: state.deepIdx };
view.querySelector('[data-examcat="Commandment I"]').click(); await flush();
R.n2 = { head: headText(), pager: pagerText(),
  firstText: (view.querySelector('.ptext') || {}).textContent || null,
  addOwn: view.textContent.includes('Add your own — Commandment I'), examCat: state.examCat };
// ---- G: the pager inside the selected commandment (III) ----
view.querySelector('[data-examcat="Commandment III"]').click(); await flush();
document.getElementById('deep-next').click(); await flush();
var gA = { pager: pagerText(), text: (view.querySelector('.ptext') || {}).textContent || null,
  nextDisabled: document.getElementById('deep-next').disabled, prevDisabled: document.getElementById('deep-prev').disabled };
document.getElementById('deep-prev').click(); await flush();
var gB = { pager: pagerText(), text: (view.querySelector('.ptext') || {}).textContent || null,
  prevDisabled: document.getElementById('deep-prev').disabled };
R.g1 = { a: gA, b: gB };
// ---- E: entries under a non-focus selected commandment (VII) ----
view.querySelector('[data-examcat="Commandment VII"]').click(); await flush();
var standingCustom = view.textContent.includes('A standing custom entry under VII.');
view.querySelector('.card.prompt').click();
var formShown = !view.querySelector('.entryform').classList.contains('hidden');
document.getElementById('et-701').value = 'My entry under VII.';
document.querySelector('[data-save-entry="701"]').click(); await flush();
var promptPost = CALLS.posts[CALLS.posts.length - 1] || null;
var promptPainted = view.textContent.includes('My entry under VII.');
document.getElementById('custom-text').value = 'A custom entry under VII.';
document.getElementById('custom-add').click(); await flush();
var customPost = CALLS.posts[CALLS.posts.length - 1] || null;
var customPainted = view.textContent.includes('A custom entry under VII.');
R.e1 = { head: headText(), standingCustom: standingCustom, formShown: formShown,
  promptPost: promptPost, promptPainted: promptPainted, customPost: customPost, customPainted: customPainted };
// ---- C: the closed run — chips disabled like the rest of the page ----
WORLD.run.state = 'closed'; state.examCat = null; state.deepIdx = 0;
renderExaminationContent(); await flush();
var chipsC = chipEls();
var allDisabled = chipsC.length === 9 && chipsC.every(function (c) { return c.disabled; });
view.querySelector('[data-examcat="Commandment III"]').click(); await flush();
R.c1 = { count: chipsC.length, allDisabled: allDisabled, head: headText(),
  closedNote: view.textContent.includes('Tonight’s run is closed. Its entries stand in Confession preparation.'),
  examCat: state.examCat };
return R;
`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="view"></div><audio id="audio"></audio></body></html>`);
  const R = await page.evaluate("(async () => {\n" + FIXTURE + "\n})()");
  const NINE = ["Commandment I", "Commandment II", "Commandment III", "Commandment IV", "Commandment V", "Commandment VI and IX", "Commandment VII", "Commandment VIII", "Commandment X"];
  ok(R.p1.count === 9 && JSON.stringify(R.p1.cats) === JSON.stringify(NINE) && JSON.stringify(R.p1.labels) === JSON.stringify(NINE),
    "P1 (paint): the chips row stands — nine chips, one per commandment category, in payload order (Preliminary · Precepts · Capital Sins are not chips)", JSON.stringify(R.p1));
  ok(JSON.stringify(R.p1.active) === JSON.stringify(["Commandment IV"]) && JSON.stringify(R.p1.pressed) === JSON.stringify(["Commandment IV"]) && !R.p1.anyDisabled,
    "P1 (paint): on open the focus chip (Commandment IV) alone carries the active dress + aria-pressed; no chip is disabled on an open run", JSON.stringify(R.p1));
  ok(R.p1.head === "Commandment IV" && R.p1.firstText === "Focus question one?" && R.p1.pager === "1 of 3" && R.p1.addOwn,
    "P1 (paint): the page opens on tonight's focus — the heading names Commandment IV, its first question stands at \"1 of 3\", \"Add your own\" names it", JSON.stringify(R.p1));
  const oneRow = (m) => m && m.tops.length === 9 && m.tops.every((t) => t === m.tops[0]) && m.scrollW > m.clientW && m.rowH < 2 * m.chipH;
  ok(oneRow(R.row412), "P2 (one row, 412px): every chip's top is equal (one chip tall, none wrapped below) and the row's scrollWidth exceeds its clientWidth — the later chips are reached by sideways scroll", JSON.stringify(R.row412));
  ok(oneRow(R.row360), "P2 (one row, 360px): the same at 360px — one row, sideways scroll, none wrapped", JSON.stringify(R.row360));
  ok(R.n1.midPager === "2 of 3" && R.n1.head === "Commandment III" && R.n1.firstText === "Third commandment question A?" && R.n1.pager === "1 of 2" &&
     R.n1.addOwn && JSON.stringify(R.n1.active) === JSON.stringify(["Commandment III"]) && R.n1.examCat === "Commandment III" && R.n1.deepIdx === 0,
    "N1 (navigation): a tap on the 3rd chip jumps — the heading names Commandment III, its first question stands, the pager resets to \"1 of 2\", \"Add your own\" names it, its chip alone is active", JSON.stringify(R.n1));
  ok(R.n2.head === "Commandment I" && R.n2.firstText === "First commandment question A?" && R.n2.pager === "1 of 2" && R.n2.addOwn && R.n2.examCat === "Commandment I",
    "N2 (navigation): a tap on the 1st chip jumps back — the heading, the question, the pager, and \"Add your own\" all follow to Commandment I", JSON.stringify(R.n2));
  ok(R.g1.a.pager === "2 of 2" && R.g1.a.text === "Third commandment question B?" && R.g1.a.nextDisabled && !R.g1.a.prevDisabled &&
     R.g1.b.pager === "1 of 2" && R.g1.b.text === "Third commandment question A?" && R.g1.b.prevDisabled,
    "G1 (pager): inside the selected commandment Next advances and stands disabled at its end; Back returns and stands disabled at its start — the pager never leaves the selected commandment", JSON.stringify(R.g1));
  ok(R.e1.head === "Commandment VII" && R.e1.standingCustom && R.e1.formShown && R.e1.promptPainted && R.e1.customPainted &&
     R.e1.promptPost && R.e1.promptPost.body.promptId === 701 && R.e1.promptPost.body.category === "Commandment VII" &&
     R.e1.customPost && R.e1.customPost.body.promptId === null && R.e1.customPost.body.category === "Commandment VII",
    "E1 (entries): under the selected non-focus Commandment VII the standing custom entry paints, a prompt entry posts { promptId: 701, category: Commandment VII }, and \"Add your own\" posts { promptId: null, category: Commandment VII } — the wiring's resolved category, the Confession flow input", JSON.stringify(R.e1));
  ok(R.c1.count === 9 && R.c1.allDisabled && R.c1.head === "Commandment IV" && R.c1.closedNote && R.c1.examCat === null,
    "C1 (closed run): with the run closed the nine chips stand disabled like the rest of the page, the closed note stands, and a tap on a disabled chip moves nothing", JSON.stringify(R.c1));
  ok(pageErrors.length === 0, "browser: zero page errors" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
}

console.log(`# harness-v442: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
