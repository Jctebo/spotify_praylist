#!/usr/bin/env node
// harness-v444 — Examination: every category on the chips +
// the carousel follows the pager (§§1–2 of the v444 release
// document, incl. the 12:05 CT amendment; John's words, Ora
// thread, 2026-11-15 12:02 CT: "What happened to precepts of
// the church? When you use next, carousel doesn't move";
// main chat 12:05 CT: "An arrow replaces next... keep it
// more distinct"). Client delta: client.ts only —
// (1) the chips carry EVERY payload category in payload
// order (the Commandment-prefix filter drops) — the
// Precepts of the Church stand reachable; heading + pager
// follow the selected category, commandment or not;
// (2) deep-next-cat resolves the FULL category order, its
// label becomes "Next section", disabled only at the LAST
// category; (2b, the amendment) the standing next-question
// button loses its word — text exactly "›", ghost dress
// unchanged, aria-label "Next question" — so the two
// forward acts read MORE distinct: arrow-only ghost vs
// labeled solid; (3) a pager-driven change sets
// state.examFollowActive; the paint, AFTER the v443 scroll
// restore, moves the row by the smallest amount that puts
// the active chip fully inside the visible band (the row
// only). Chip taps never set the flag — v443 preservation
// stands exact for them. Legs S1–S4 statics + C/R/PG/CAR/
// AR/F behavior, run in headless Chromium on the v443 exam
// mold: the client's VERBATIM exam functions over a stubbed
// api()/post() seam with the real APP_CSS injected.
// Fixture note: harness-v443's fixture EXTENDED with two
// prompts under the Precepts of the Church (ids 1101/1102)
// so the Precepts stand reachable with questions to page
// and post under; the fixture state gains
// examFollowActive: false (the v444 flag's initial value);
// every other fixture line is v443's, byte for byte.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v444 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const BASE = "release/v443-ship";

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

// ---- S1: the v443 scroll preservation stands in the paint ----
{
  const examSrc = extractFn(CLIENT, "renderExaminationContent");
  const readAt = examSrc.indexOf("view.querySelector('.examchips')");
  const skelAt = examSrc.indexOf("skelHtml('conscience')");
  const paintAt = examSrc.indexOf("view.innerHTML = html;");
  const restoreAt = examSrc.indexOf("newChipsRow.scrollLeft = chipsScroll");
  ok(readAt >= 0 && skelAt > readAt && examSrc.includes("var chipsScroll = chipsRow ? chipsRow.scrollLeft : null;"),
    "S1 the paint reads the standing chips row's scrollLeft at its head, before the skeleton paint replaces view.innerHTML");
  ok(paintAt >= 0 && restoreAt > paintAt && examSrc.includes("if (chipsScroll !== null)"),
    "S1 the paint restores the read value onto the new row after view.innerHTML is replaced (and only when a row stood)");
}

// ---- S2: the payload + CSS stand — index.ts and ui.ts byte-identical ----
{
  const diff = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src/index.ts", "app/worker/src/ui.ts"], { encoding: "utf8" }).trim();
  ok(diff === "", "S2 index.ts and ui.ts are byte-identical to the base (client-only release)", diff);
  ok(INDEX.includes("return { ok: true, date, dateLabel: prayerDateLabel(date), run, prompts: prompts.results ?? [], entries: entries.results ?? [], categories: cats, focusCategory };"),
    "S2 examToday's return keys stand: { ok, date, dateLabel, run, prompts, entries, categories, focusCategory }");
}

// ---- S3: diff scope + bundle + pin housekeeping ----
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts"]),
    "S3 the worker-source diff vs the v443-ship base is client.ts only (got: " + changed.join(", ") + ")");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v444-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S3 the whole worker bundles clean (esbuild) — no syntax break anywhere in the client");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v443-1";'),
    "S3 (housekeeping): the SW pin stands at ora-pro-nobis-v443-1 (Ship moves it)");
}

// ---- S4: the v444 builds stand in the source ----
{
  const examSrc = extractFn(CLIENT, "renderExaminationContent");
  const wireSrc = extractFn(CLIENT, "wireExamination");
  ok(!examSrc.includes("indexOf('Commandment') === 0") && !wireSrc.includes("indexOf('Commandment') === 0") &&
     examSrc.includes("cats.map(function (c) { return '<button class=\"chip'"),
    "S4 the Commandment-prefix filter is gone from paint and wiring — the chips map over every payload category");
  ok(examSrc.includes('id="deep-next-cat"') && examSrc.includes('class="btn" id="deep-next-cat"') && examSrc.includes(">Next section</button>") &&
     examSrc.indexOf('id="deep-next-cat"') > examSrc.indexOf('id="deep-next"') &&
     examSrc.includes("cats.indexOf(cat) + 1 >= cats.length ? ' disabled' : ''") &&
     !examSrc.includes(">Next commandment</button>"),
    "S4 the pager emits deep-next-cat after deep-next, in the solid btn dress, labeled \"Next section\", disabled when the resolved category is the LAST category in the full order");
  ok(examSrc.includes('id="deep-next" aria-label="Next question"') && examSrc.includes(">&#8250;</button>") &&
     !examSrc.includes(">Next &#8250;</button>"),
    "S4 (amendment) the next-question button carries aria-label \"Next question\" and the arrow alone — the worded Next is gone from the emission");
  const restoreAt = examSrc.indexOf("newChipsRow.scrollLeft = chipsScroll");
  const followAt = examSrc.indexOf("if (state.examFollowActive)");
  ok(wireSrc.includes("state.examFollowActive = true;") && wireSrc.includes("var order = data.categories || [];") &&
     followAt > restoreAt && restoreAt >= 0 && examSrc.includes("state.examFollowActive = false;") &&
     examSrc.includes("followRow.scrollLeft = chipR - followRow.clientWidth"),
    "S4 the next-section act resolves the full category order and sets examFollowActive; the paint consumes the flag AFTER the v443 restore, moving the row by the chip's right edge less the row's width at most");
  ok(wireSrc.includes("if (nx) nx.addEventListener('click', function () { state.deepIdx++; renderExamination(); });") &&
     wireSrc.includes("if (pv) pv.addEventListener('click', function () { state.deepIdx--; renderExamination(); });"),
    "S4 the standing Back/Next wiring lines stand byte-untouched (question-only, inside the category)");
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
var state = { deepIdx: 0, examCat: null, examFollowActive: false };
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
      { id: 1001, category: 'Commandment X', text: 'Tenth commandment question A?' },
      { id: 1002, category: 'Commandment X', text: 'Tenth commandment question B?' },
      { id: 1101, category: 'Precepts of the Church', text: 'Precepts question A?' },
      { id: 1102, category: 'Precepts of the Church', text: 'Precepts question B?' },
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
function chipsRow() { return view.querySelector('.examchips'); }
function chipBand(chip) {
  var row = chipsRow(); if (!row || !chip) return null;
  var rr = row.getBoundingClientRect(), cr = chip.getBoundingClientRect();
  return { rowL: Math.round(rr.left), rowR: Math.round(rr.right), chipL: Math.round(cr.left), chipR: Math.round(cr.right),
    inside: cr.left >= rr.left - 1 && cr.right <= rr.right + 1, scroll: row.scrollLeft };
}
function activeChip() { return view.querySelector('.examchips .chip.active'); }
function pagerRowMetrics() {
  var nc = document.getElementById('deep-next-cat');
  if (!nc) return null;
  var row = nc.parentElement;
  var kids = Array.prototype.slice.call(row.children);
  var viewRect = view.getBoundingClientRect();
  return { scrollW: row.scrollWidth, clientW: row.clientWidth,
    lastRight: Math.round(Math.max.apply(null, kids.map(function (k) { return k.getBoundingClientRect().right; })) - viewRect.left),
    viewW: Math.round(viewRect.width),
    order: kids.map(function (k) { return k.id || '(count)'; }) };
}
var R = {};
// ---- C1 + P1 + F412: the paint at 412 — every category a chip; the two forward acts ----
view.style.width = '412px';
state.deepIdx = 0; state.examCat = null; renderExaminationContent(); await flush();
var chips0 = chipEls();
R.c1 = { labels: chips0.map(function (c) { return c.getAttribute('data-examcat'); }),
  tops: chips0.map(function (c) { return Math.round(c.getBoundingClientRect().top); }),
  rowScrollW: chipsRow().scrollWidth, rowClientW: chipsRow().clientWidth };
var nc0 = document.getElementById('deep-next-cat'), nx0 = document.getElementById('deep-next');
R.p1 = { stands: !!nc0, label: nc0 ? nc0.textContent : null, cls: nc0 ? nc0.className : null,
  nextCls: nx0 ? nx0.className : null, nextText: nx0 ? nx0.textContent : null,
  nextAria: nx0 ? nx0.getAttribute('aria-label') : null, disabled: nc0 ? nc0.disabled : null,
  bg: nc0 ? getComputedStyle(nc0).backgroundColor : null, nextBg: nx0 ? getComputedStyle(nx0).backgroundColor : null,
  head: headText(), pager: pagerText() };
R.f412 = pagerRowMetrics();
// ---- SC1: scroll the row right, tap a chip — the place survives ----
var rowA = chipsRow(); rowA.scrollLeft = 150; var preChip = rowA.scrollLeft;
view.querySelector('[data-examcat="Commandment VII"]').click(); await flush();
R.sc1 = { pre: preChip, post: chipsRow().scrollLeft, head: headText(), pager: pagerText() };
// ---- SC2 + AR: scroll again, tap the arrow — the place survives, the question flips ----
var rowB = chipsRow(); rowB.scrollLeft = 200; var preNext = rowB.scrollLeft;
document.getElementById('deep-next').click(); await flush();
R.sc2 = { pre: preNext, post: chipsRow().scrollLeft, pager: pagerText(),
  text: (view.querySelector('.ptext') || {}).textContent || null };
R.ar1 = { nextDisabled: document.getElementById('deep-next').disabled,
  nextCatDisabled: document.getElementById('deep-next-cat').disabled, pager: pagerText() };
// ---- CAR2: a chip tap never auto-scrolls — tap a chip that stands off-screen right ----
var rowC = chipsRow(); var preTap = rowC.scrollLeft;
view.querySelector('[data-examcat="Commandment X"]').click(); await flush();
R.car2 = { pre: preTap, post: chipsRow().scrollLeft, head: headText(),
  band: chipBand(view.querySelector('[data-examcat="Commandment X"]')) };
// ---- R1: the Precepts reached — heading, questions, an entry posts under them ----
view.querySelector('[data-examcat="Precepts of the Church"]').click(); await flush();
var r1head = headText(), r1pager = pagerText(), r1text = (view.querySelector('.ptext') || {}).textContent || null;
view.querySelector('.prompt').click();
document.getElementById('et-1101').value = 'I missed a day of prayer.';
view.querySelector('[data-save-entry="1101"]').click(); await flush();
R.r1 = { head: r1head, pager: r1pager, firstText: r1text,
  posts: CALLS.posts.filter(function (p) { return p.path === '/api/exam/entries'; }).map(function (p) { return p.body; }),
  entryStands: view.textContent.indexOf('I missed a day of prayer.') >= 0, headAfter: headText() };
// ---- PG1 + CAR1: from Commandment X, Next section crosses to the Precepts and the carousel follows ----
state.examCat = 'Commandment X'; state.deepIdx = 0; renderExaminationContent(); await flush();
chipsRow().scrollLeft = 0;
var preBand = chipBand(view.querySelector('[data-examcat="Precepts of the Church"]'));
document.getElementById('deep-next-cat').click(); await flush();
R.pg1 = { head: headText(), pager: pagerText(),
  firstText: (view.querySelector('.ptext') || {}).textContent || null,
  active: chipEls().filter(function (c) { return c.classList.contains('active'); }).map(function (c) { return c.getAttribute('data-examcat'); }),
  examCat: state.examCat, deepIdx: state.deepIdx,
  preBand: preBand, postBand: chipBand(activeChip()) };
// ---- PG2: the last category — Next section stands disabled ----
document.getElementById('deep-next-cat').click(); await flush();
R.pg2 = { head: headText(), pager: pagerText(),
  nextCatDisabled: document.getElementById('deep-next-cat').disabled,
  nextDisabled: document.getElementById('deep-next').disabled };
// ---- F360: the pager row and the one chips row fit 360 ----
view.style.width = '360px';
state.examCat = 'Commandment IV'; state.deepIdx = 0;
renderExaminationContent(); await flush();
R.f360 = pagerRowMetrics();
R.f360.chipTops = chipEls().map(function (c) { return Math.round(c.getBoundingClientRect().top); });
return R;
`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="view"></div><audio id="audio"></audio></body></html>`);
  const R = await page.evaluate("(async () => {\n" + FIXTURE + "\n})()");
  const CATS = ['Preliminary Examination', 'Commandment I', 'Commandment II', 'Commandment III', 'Commandment IV', 'Commandment V', 'Commandment VI and IX', 'Commandment VII', 'Commandment VIII', 'Commandment X', 'Precepts of the Church', 'Capital Sins'];
  ok(JSON.stringify(R.c1.labels) === JSON.stringify(CATS) &&
     R.c1.tops.every(function (t) { return t === R.c1.tops[0]; }) && R.c1.rowScrollW > R.c1.rowClientW,
    "C1 (chips): a chip stands for EVERY fixture category incl. the Precepts of the Church, in payload order, in exactly ONE row (one top for all chips) that scrolls sideways", JSON.stringify(R.c1));
  ok(R.p1.stands && R.p1.label === "Next section" && R.p1.cls === "btn" && R.p1.disabled === false &&
     R.p1.head === "Commandment IV" && R.p1.pager === "1 of 3",
    "P1 (paint): deep-next-cat stands in the pager row — label \"Next section\", the solid btn dress, enabled at the focus commandment; the heading names the focus, the pager reads \"1 of 3\"", JSON.stringify(R.p1));
  ok(R.p1.nextText === "›" && R.p1.nextAria === "Next question" && R.p1.nextCls === "btn ghost" &&
     R.p1.nextBg === "rgba(0, 0, 0, 0)" && R.p1.bg !== "rgba(0, 0, 0, 0)" && R.p1.bg !== R.p1.nextBg,
    "AR (amendment, distinctness on the paint): the next-question act reads as an unlabeled arrow — text exactly \"›\", aria-label \"Next question\", the ghost dress (computed background transparent) — against the labeled solid Next section (filled background): the pair reads more distinct", JSON.stringify(R.p1));
  ok(R.f412 && JSON.stringify(R.f412.order) === JSON.stringify(["deep-prev", "(count)", "deep-next", "deep-next-cat"]) &&
     R.f412.scrollW <= R.f412.clientW + 1 && R.f412.lastRight <= R.f412.viewW + 1,
    "F412 (fit): the pager row at 412px reads Back · count · arrow · Next section in order, with no overflow (scrollWidth within clientWidth, last edge inside the view)", JSON.stringify(R.f412));
  ok(R.sc1.pre === 150 && R.sc1.post === R.sc1.pre && R.sc1.head === "Commandment VII" && R.sc1.pager === "1 of 2",
    "SC1 (scroll, chip tap): the row scrolled to 150, a chip tap repainted to Commandment VII — the new row's scrollLeft is the pre-tap 150, not 0 (v443 stands)", JSON.stringify(R.sc1));
  ok(R.sc2.pre === 200 && R.sc2.post === R.sc2.pre && R.sc2.pager === "2 of 2" && R.sc2.text === "Seventh commandment question B?",
    "SC2 (scroll, arrow tap): the row scrolled to 200, an arrow tap flipped to VII's second question — the new row's scrollLeft is the pre-tap 200, not 0 (v443 stands)", JSON.stringify(R.sc2));
  ok(R.ar1.pager === "2 of 2" && R.ar1.nextDisabled === true && R.ar1.nextCatDisabled === false,
    "AR (clamp): at VII's last question the arrow stands disabled (the within-category clamp stands) while Next section stands enabled — the boundary stays crossable from the pager", JSON.stringify(R.ar1));
  ok(R.car2.pre === 200 && R.car2.post === 200 && R.car2.head === "Commandment X" && R.car2.band && R.car2.band.inside === false,
    "CAR2 (chip tap, no follow): the row stood at 200, a tap on the Commandment X chip — itself outside the visible band — repainted to Commandment X with the scrollLeft exactly 200 still: a chip tap never auto-scrolls (v443 exact)", JSON.stringify(R.car2));
  ok(R.r1.head === "Precepts of the Church" && R.r1.pager === "1 of 2" && R.r1.firstText === "Precepts question A?" &&
     R.r1.posts.length === 1 && R.r1.posts[0].category === "Precepts of the Church" && R.r1.posts[0].promptId === 1101 &&
     R.r1.entryStands && R.r1.headAfter === "Precepts of the Church",
    "R1 (reach): a tap on the Precepts chip opens them — the heading names the Precepts of the Church, their questions page (\"1 of 2\", first question stands), and an entry saved at their first prompt posts under the Precepts and stands after the repaint", JSON.stringify(R.r1));
  ok(R.pg1.head === "Precepts of the Church" && R.pg1.firstText === "Precepts question A?" && R.pg1.pager === "1 of 2" &&
     JSON.stringify(R.pg1.active) === JSON.stringify(["Precepts of the Church"]) && R.pg1.examCat === "Precepts of the Church" && R.pg1.deepIdx === 0,
    "PG1 (pager crossing): Next section from Commandment X lands on the next category in order — the heading names the Precepts of the Church, its first question stands, the pager reads \"1 of 2\", its chip alone is active, deepIdx reset", JSON.stringify(R.pg1));
  ok(R.pg1.preBand && R.pg1.preBand.inside === false && R.pg1.preBand.scroll === 0 &&
     R.pg1.postBand && R.pg1.postBand.inside === true && R.pg1.postBand.scroll > 0,
    "CAR1 (carousel follows the pager): with the row at 0 the Precepts chip stood outside the visible band; after the Next section crossing the row moved (scrollLeft > 0) and the active chip stands fully inside the band", JSON.stringify(R.pg1));
  ok(R.pg2.head === "Capital Sins" && R.pg2.pager === "1 of 1" && R.pg2.nextCatDisabled === true && R.pg2.nextDisabled === true,
    "PG2 (last category): Next section from the Precepts lands on the Capital Sins, and there Next section stands disabled — the clamp sits at the last category in the full order, not the last commandment", JSON.stringify(R.pg2));
  ok(R.f360 && R.f360.scrollW <= R.f360.clientW + 1 && R.f360.lastRight <= R.f360.viewW + 1 &&
     R.f360.chipTops.every(function (t) { return t === R.f360.chipTops[0]; }),
    "F360 (fit): the pager row fits 360px — no overflow, the last edge inside the view (the count span flexes) — and the chips still stand in one row", JSON.stringify(R.f360));
  ok(pageErrors.length === 0, "browser: zero page errors" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
}

console.log(`# harness-v444: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
