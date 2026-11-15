#!/usr/bin/env node
// harness-v443 — Examination pager refinements (§§1–2 of
// the v443 release document; John's words, Ora thread,
// 2026-11-15 11:04 CT: "When you select a chip, the
// carousel should not reset to left. Also next only goes
// through questions on same commandment. Can you add the
// ability to flip the question like two different styles
// next buttons"). Client delta: client.ts only —
// (1) scroll preservation: renderExaminationContent reads
// the standing .examchips row's scrollLeft at its head,
// before any paint replaces view.innerHTML, and restores
// it onto the new row after the paint (preservation only,
// never an auto-scroll); (2) the pager row gains a second
// next after the standing Next: id deep-next-cat, label
// "Next commandment", class "btn" (the solid dress —
// visibly different from the ghost Back/Next pair); its
// act resolves the commandment order from the payload
// categories (the chips' order), sets examCat to the next
// one + deepIdx 0, repaints; at the last commandment it
// stands disabled (the standing Next's end clamp,
// mirrored). Legs S1–S4 statics + SC/NC/F behavior, run
// in headless Chromium on the v442 exam mold: the
// client's VERBATIM exam functions over a stubbed
// api()/post() seam with the real APP_CSS injected.
// Fixture note: harness-v442's fixture EXTENDED with two
// prompts under Commandment X (ids 1001/1002) so the
// pager paints at the last commandment and the
// disabled-at-the-end leg can stand; every other fixture
// line is v442's, byte for byte.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v443 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const BASE = "release/v442-ship";

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

// ---- S1: the scroll preservation stands in the paint ----
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
    "S3 the worker-source diff vs the v442-ship base is client.ts only (got: " + changed.join(", ") + ")");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v443-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S3 the whole worker bundles clean (esbuild) — no syntax break anywhere in the client");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v442-1";'),
    "S3 (housekeeping): the SW pin stands at ora-pro-nobis-v442-1 (Ship moves it)");
}

// ---- S4: the next-commandment button + wiring stand ----
{
  const examSrc = extractFn(CLIENT, "renderExaminationContent");
  const wireSrc = extractFn(CLIENT, "wireExamination");
  ok(examSrc.includes('id="deep-next-cat"') && examSrc.includes('class="btn" id="deep-next-cat"') && examSrc.includes(">Next commandment</button>") &&
     examSrc.indexOf('id="deep-next-cat"') > examSrc.indexOf('id="deep-next"') &&
     examSrc.includes("cmdCats.indexOf(cat) + 1 >= cmdCats.length ? ' disabled' : ''"),
    "S4 the pager emits deep-next-cat after deep-next, in the solid btn dress (no ghost), disabled when the resolved category is the last commandment");
  ok(wireSrc.includes("document.getElementById('deep-next-cat')") && wireSrc.includes("c.indexOf('Commandment') === 0") &&
     wireSrc.includes("state.examCat = nxt; state.deepIdx = 0; renderExamination();"),
    "S4 the wiring stands beside deep-next: the act resolves the chips' payload order, sets examCat + deepIdx 0, repaints");
  ok(wireSrc.includes("if (nx) nx.addEventListener('click', function () { state.deepIdx++; renderExamination(); });") &&
     wireSrc.includes("if (pv) pv.addEventListener('click', function () { state.deepIdx--; renderExamination(); });"),
    "S4 the standing Back/Next wiring lines stand byte-untouched (question-only, inside the commandment)");
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
      { id: 1001, category: 'Commandment X', text: 'Tenth commandment question A?' },
      { id: 1002, category: 'Commandment X', text: 'Tenth commandment question B?' },
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
// ---- P1 + F412: the paint at 412 — the button stands, solid, after Next ----
view.style.width = '412px';
state.deepIdx = 0; state.examCat = null; renderExaminationContent(); await flush();
var nc0 = document.getElementById('deep-next-cat'), nx0 = document.getElementById('deep-next');
R.p1 = { stands: !!nc0, label: nc0 ? nc0.textContent : null, cls: nc0 ? nc0.className : null,
  nextCls: nx0 ? nx0.className : null, disabled: nc0 ? nc0.disabled : null,
  bg: nc0 ? getComputedStyle(nc0).backgroundColor : null, nextBg: nx0 ? getComputedStyle(nx0).backgroundColor : null,
  head: headText(), pager: pagerText() };
R.f412 = pagerRowMetrics();
// ---- SC1: scroll the row right, tap a chip — the place survives ----
var rowA = chipsRow(); rowA.scrollLeft = 150; var preChip = rowA.scrollLeft;
view.querySelector('[data-examcat="Commandment VII"]').click(); await flush();
R.sc1 = { pre: preChip, post: chipsRow().scrollLeft, head: headText(), pager: pagerText() };
// ---- SC2: scroll again, tap the pager Next — the place survives ----
var rowB = chipsRow(); rowB.scrollLeft = 200; var preNext = rowB.scrollLeft;
document.getElementById('deep-next').click(); await flush();
R.sc2 = { pre: preNext, post: chipsRow().scrollLeft, pager: pagerText(),
  text: (view.querySelector('.ptext') || {}).textContent || null };
// ---- NC2: at III's last question — Next disabled, next-commandment enabled ----
view.querySelector('[data-examcat="Commandment III"]').click(); await flush();
document.getElementById('deep-next').click(); await flush();
R.nc2 = { pager: pagerText(), nextDisabled: document.getElementById('deep-next').disabled,
  nextCatDisabled: document.getElementById('deep-next-cat').disabled };
// ---- NC1: from III's last question, the solid button crosses to IV ----
document.getElementById('deep-next-cat').click(); await flush();
var chipsNC = chipEls();
R.nc1 = { head: headText(), pager: pagerText(),
  firstText: (view.querySelector('.ptext') || {}).textContent || null,
  active: chipsNC.filter(function (c) { return c.classList.contains('active'); }).map(function (c) { return c.getAttribute('data-examcat'); }),
  examCat: state.examCat, deepIdx: state.deepIdx };
// ---- NC3: the last commandment — next-commandment disabled ----
view.querySelector('[data-examcat="Commandment X"]').click(); await flush();
R.nc3 = { head: headText(), pager: pagerText(),
  nextCatDisabled: document.getElementById('deep-next-cat').disabled,
  nextDisabled: document.getElementById('deep-next').disabled };
// ---- F360: the four-element pager row fits 360 ----
view.style.width = '360px';
state.examCat = 'Commandment IV'; state.deepIdx = 0;
renderExaminationContent(); await flush();
R.f360 = pagerRowMetrics();
return R;
`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="view"></div><audio id="audio"></audio></body></html>`);
  const R = await page.evaluate("(async () => {\n" + FIXTURE + "\n})()");
  ok(R.p1.stands && R.p1.label === "Next commandment" && R.p1.cls === "btn" && R.p1.nextCls === "btn ghost" &&
     R.p1.bg !== "rgba(0, 0, 0, 0)" && R.p1.bg !== R.p1.nextBg && R.p1.disabled === false &&
     R.p1.head === "Commandment IV" && R.p1.pager === "1 of 3",
    "P1 (paint): deep-next-cat stands in the pager row — label \"Next commandment\", the solid btn dress (computed background filled, the ghost Next's transparent), enabled at the focus commandment", JSON.stringify(R.p1));
  ok(R.f412 && JSON.stringify(R.f412.order) === JSON.stringify(["deep-prev", "(count)", "deep-next", "deep-next-cat"]) &&
     R.f412.scrollW <= R.f412.clientW + 1 && R.f412.lastRight <= R.f412.viewW + 1,
    "F412 (fit): the pager row at 412px reads Back · count · Next · Next commandment in order, with no overflow (scrollWidth within clientWidth, last edge inside the view)", JSON.stringify(R.f412));
  ok(R.sc1.pre === 150 && R.sc1.post === R.sc1.pre && R.sc1.head === "Commandment VII" && R.sc1.pager === "1 of 2",
    "SC1 (scroll, chip tap): the row scrolled to 150, a chip tap repainted to Commandment VII — the new row's scrollLeft is the pre-tap 150, not 0", JSON.stringify(R.sc1));
  ok(R.sc2.pre === 200 && R.sc2.post === R.sc2.pre && R.sc2.pager === "2 of 2" && R.sc2.text === "Seventh commandment question B?",
    "SC2 (scroll, pager Next tap): the row scrolled to 200, a Next tap repainted to VII's second question — the new row's scrollLeft is the pre-tap 200, not 0", JSON.stringify(R.sc2));
  ok(R.nc2.pager === "2 of 2" && R.nc2.nextDisabled === true && R.nc2.nextCatDisabled === false,
    "NC2 (boundary): at Commandment III's last question the standing Next stands disabled while Next commandment stands enabled — the boundary is crossable from the pager", JSON.stringify(R.nc2));
  ok(R.nc1.head === "Commandment IV" && R.nc1.firstText === "Focus question one?" && R.nc1.pager === "1 of 3" &&
     JSON.stringify(R.nc1.active) === JSON.stringify(["Commandment IV"]) && R.nc1.examCat === "Commandment IV" && R.nc1.deepIdx === 0,
    "NC1 (crossing): a Next commandment tap from III crosses — the heading names Commandment IV, its first question stands, the pager reads \"1 of 3\", its chip alone is active, deepIdx reset", JSON.stringify(R.nc1));
  ok(R.nc3.head === "Commandment X" && R.nc3.pager === "1 of 2" && R.nc3.nextCatDisabled === true && R.nc3.nextDisabled === false,
    "NC3 (last commandment): at Commandment X the pager stands and Next commandment stands disabled (the end clamp, mirrored); the standing Next still works inside X", JSON.stringify(R.nc3));
  ok(R.f360 && R.f360.scrollW <= R.f360.clientW + 1 && R.f360.lastRight <= R.f360.viewW + 1,
    "F360 (fit): the four-element pager row fits 360px — no overflow, the last edge inside the view (the count span flexes)", JSON.stringify(R.f360));
  ok(pageErrors.length === 0, "browser: zero page errors" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
}

console.log(`# harness-v443: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
