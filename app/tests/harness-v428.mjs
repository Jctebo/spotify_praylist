#!/usr/bin/env node
// harness-v428 — Examination streamlined: deep reflection only
// (§1/§2 of the v428 release document; John's word 2026-11-14:
// "Let's streamline examination of conscious" · "Deep
// reflection only"). Client-only delta: client.ts — the intro
// paragraph + focus-line emits, the chips emit + [data-cat]
// wiring, the segtoggle emit + mode wiring and the quick list
// branch, and state.examMode / state.examCat / catChipLabel
// retire; the category is a local `cat = data.focusCategory ||
// cats[0]`; the standing deep construction (one card + Back /
// "n of N" / Next pager) is the page's only form. Legs S1–S2
// statics + S3 scope/pin + B1–B8 behavior per Plan §2.8, run
// in headless Chromium: the client's VERBATIM exam functions
// (esc, skelHtml, entriesHtml, entryHtml, entryFieldHtml,
// renderExaminationContent, wireExamination, openPromptsEditor)
// extracted from the candidate source and run over a stubbed
// api()/post() seam whose fixture payload the legs control
// (focusCategory = Commandment X, prompts across three
// categories). renderExamination is stubbed to the content
// render (the standing mold practice — in production it is
// the PIN-gated wrapper, untouched by this release).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v428 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const BASE = "ded05501ce54f863bb7204fb6ef27ca285e631be";

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

// ---- S1: the retired seats are absent; the shared constructions stand ----
{
  const absent = ["Begin with gratitude", "Tonight&rsquo;s focus in depth", "data-cat=",
    'id="m-quick"', 'id="m-deep"', "examMode", "examCat", "catChipLabel"];
  const found = absent.filter((s) => CLIENT.includes(s));
  ok(found.length === 0, "S1 the retired seats are absent from client.ts (intro · focus line · data-cat · m-quick · m-deep · examMode · examCat · catChipLabel)", "found: " + found.join(", "));
  const examSrc = extractFn(CLIENT, "renderExaminationContent");
  ok(!examSrc.includes('class="chips"') && !examSrc.includes("segtoggle inflow") && !examSrc.includes("Quick Review"),
    "S1 renderExaminationContent carries no .chips emit, no .segtoggle inflow emit, no Quick Review branch");
  ok((CLIENT.match(/class="chips"/g) || []).length >= 2 && CLIENT.includes('<div class="segtoggle" id="sidetoggle">'),
    "S1 the shared constructions stand elsewhere (the other .chips emits · the Conscience sidetoggle emit)");
  const wireSrc = extractFn(CLIENT, "wireExamination");
  ok(!wireSrc.includes("[data-cat]") && wireSrc.includes("data.focusCategory || (data.categories || [])[0]") &&
     examSrc.includes("var cat = data.focusCategory || cats[0];"),
    "S1 the category is a local in both the paint and the wiring, from the standing default rule (focus, else first category)");
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
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts"]),
    "S3 the worker-source diff vs the v438-ship base is client.ts only (got: " + changed.join(", ") + ")");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v428-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S3 the whole worker bundles clean (esbuild) — no syntax break anywhere in the client");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v438-1";'),
    "S3 (housekeeping): the SW pin stands at ora-pro-nobis-v438-1 (Ship moves it)");
}

// ---- B legs: verbatim client in real Chromium -------------------
const PAGE_SRC = [
  extractFn(CLIENT, "esc"), extractFn(CLIENT, "skelHtml"), extractFn(CLIENT, "entriesHtml"),
  extractFn(CLIENT, "entryHtml"), extractFn(CLIENT, "entryFieldHtml"),
  extractFn(CLIENT, "renderExaminationContent"), extractFn(CLIENT, "wireExamination"),
  extractFn(CLIENT, "openPromptsEditor"),
].join("\n");

const FIXTURE = `
var view = document.getElementById('view');
var state = { deepIdx: 0 };
var placeSkip = {};
var nextEntryId = 900;
function fixturePayload() {
  return {
    ok: true, date: '2026-11-15', dateLabel: 'Saturday, November 15',
    run: { id: 7, date: '2026-11-15', state: 'open' },
    categories: ['Preliminary Examination', 'Commandment I', 'Commandment X', 'Capital Sins'],
    focusCategory: 'Commandment X',
    prompts: [
      { id: 101, category: 'Commandment X', text: 'Focus question one?' },
      { id: 102, category: 'Commandment X', text: 'Focus question two?' },
      { id: 103, category: 'Commandment X', text: 'Focus question three?' },
      { id: 201, category: 'Commandment I', text: 'Other category question A?' },
      { id: 202, category: 'Commandment I', text: 'Other category question B?' },
      { id: 301, category: 'Capital Sins', text: 'Capital sins question?' }
    ],
    entries: []
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
var R = {};
// ---- B1: the paint ----
state.deepIdx = 0; renderExaminationContent(); await flush();
R.b1 = {
  title: !!view.querySelector('h1.screen'), gear: !!document.getElementById('ex-gear'),
  date: view.textContent.includes('Saturday, November 15'), head: headText(),
  cards: view.querySelectorAll('.card.prompt').length, pager: pagerText(),
  chips: !!view.querySelector('.chips'), seg: !!view.querySelector('.segtoggle'),
  dataCat: !!view.querySelector('[data-cat]'), quick: !!document.getElementById('m-quick'), deep: !!document.getElementById('m-deep'),
  intro: view.textContent.includes('Begin with gratitude'), focusLine: view.textContent.includes('focus in depth'),
  firstText: (view.querySelector('.ptext') || {}).textContent || null,
  attribution: view.textContent.includes('Lasance'), addOwn: view.textContent.includes('Add your own — Commandment X'),
  anythingElse: view.textContent.includes('Anything else'), closeBtn: !!document.getElementById('run-close')
};
// ---- B2: the pager + the clamp ----
document.getElementById('deep-next').click(); await flush();
var b2a = { pager: pagerText(), text: (view.querySelector('.ptext') || {}).textContent || null };
document.getElementById('deep-next').click(); await flush();
var b2b = { pager: pagerText(), text: (view.querySelector('.ptext') || {}).textContent || null,
  nextDisabled: document.getElementById('deep-next').disabled, prevDisabled: document.getElementById('deep-prev').disabled };
document.getElementById('deep-prev').click(); await flush();
var b2c = { pager: pagerText(), text: (view.querySelector('.ptext') || {}).textContent || null };
state.deepIdx = 99; renderExaminationContent(); await flush();
var b2d = { pager: pagerText(), text: (view.querySelector('.ptext') || {}).textContent || null, deepIdx: state.deepIdx };
R.b2 = { a: b2a, b: b2b, c: b2c, d: b2d };
// ---- B3: focus only, the whole set by paging ----
state.deepIdx = 0; renderExaminationContent(); await flush();
var seen = [];
for (var i = 0; i < 5; i++) {
  var t = (view.querySelector('.ptext') || {}).textContent || null;
  if (t && seen[seen.length - 1] !== t) seen.push(t);
  var nx = document.getElementById('deep-next');
  if (!nx || nx.disabled) break;
  nx.click(); await flush();
}
R.b3 = { seen: seen };
// ---- B4: a prompt entry, saved and removed ----
state.deepIdx = 0; renderExaminationContent(); await flush();
view.querySelector('.card.prompt').click();
var formShown = !view.querySelector('.entryform').classList.contains('hidden');
document.getElementById('et-101').value = 'My entry on question one.';
document.querySelector('[data-save-entry="101"]').click(); await flush();
var savedEntry = Array.prototype.some.call(view.querySelectorAll('.entry'), function (e) { return e.textContent.includes('My entry on question one.'); });
var del = view.querySelector('[data-del-entry]');
if (del) { del.click(); await flush(); }
var afterDel = Array.prototype.some.call(view.querySelectorAll('.entry'), function (e) { return e.textContent.includes('My entry on question one.'); });
R.b4 = { formShown: formShown, post: CALLS.posts[0] || null, savedEntry: savedEntry, deletes: CALLS.deletes.slice(), afterDel: afterDel };
// ---- B5: the free entries ----
document.getElementById('custom-text').value = 'A custom entry.';
document.getElementById('custom-add').click(); await flush();
var customPainted = view.textContent.includes('A custom entry.');
document.getElementById('free-text').value = 'A free entry.';
document.getElementById('free-add').click(); await flush();
var freePainted = view.textContent.includes('A free entry.');
R.b5 = { customPost: CALLS.posts[1] || null, customPainted: customPainted, freePost: CALLS.posts[2] || null, freePainted: freePainted };
// ---- B6: close the run ----
document.getElementById('run-close').click();
var hadConfirm = !!confirmOpts;
if (confirmOpts) { confirmOpts.act(); }
await flush();
var closedNote = view.textContent.includes('Tonight’s run is closed. Its entries stand in Confession preparation.');
var noCloseBtn = !document.getElementById('run-close');
var noForms = view.querySelectorAll('.entryform').length === 0;
document.getElementById('deep-next').click(); await flush();
var walked = pagerText();
R.b6 = { hadConfirm: hadConfirm, closePost: CALLS.posts[3] || null, closedNote: closedNote, noCloseBtn: noCloseBtn, noForms: noForms, walked: walked };
// ---- B7: the Prompts editor ----
WORLD = fixturePayload(); CALLS = { posts: [], puts: [], deletes: [] }; state.deepIdx = 0;
renderExaminationContent(); await flush();
document.getElementById('ex-gear').click(); await flush();
var sheet = document.querySelector('.sheet');
var editCount = sheet ? sheet.querySelectorAll('[data-prompt-edit]').length : 0;
if (sheet) {
  sheet.querySelector('[data-prompt-edit="101"]').value = 'Edited focus question?';
  sheet.querySelector('#pe-save').click(); await flush();
}
var sheetGone = !document.querySelector('.sheet');
R.b7 = { editCount: editCount, put: CALLS.puts[0] ? CALLS.puts[0].filter(function (u) { return u.id === 101; })[0] : null,
  sheetGone: sheetGone, firstText: (view.querySelector('.ptext') || {}).textContent || null };
// ---- B8: an empty focus category ----
WORLD = fixturePayload();
WORLD.prompts = WORLD.prompts.filter(function (p) { return p.category !== 'Commandment X'; });
WORLD.categories = ['Commandment I', 'Capital Sins'];
state.deepIdx = 0; renderExaminationContent(); await flush();
R.b8 = { empty: view.textContent.includes('No prompts in this category.'), pagerBtns: !!document.getElementById('deep-next') || !!document.getElementById('deep-prev'),
  head: headText(), cards: view.querySelectorAll('.card.prompt').length };
return R;
`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="view"></div><audio id="audio"></audio></body></html>`);
  const R = await page.evaluate("(async () => {\n" + FIXTURE + "\n})()");
  ok(R.b1.title && R.b1.gear && R.b1.date && R.b1.head === "Commandment X" && R.b1.cards === 1 && R.b1.pager === "1 of 3" &&
     R.b1.firstText === "Focus question one?",
    "B1 (paint): title + date + Prompts button + the bare focus heading + exactly one prompt card at \"1 of 3\"", JSON.stringify(R.b1));
  ok(!R.b1.chips && !R.b1.seg && !R.b1.dataCat && !R.b1.quick && !R.b1.deep && !R.b1.intro && !R.b1.focusLine,
    "B1 (paint): no chip filter, no segtoggle, no intro or focus text stands in the DOM", JSON.stringify(R.b1));
  ok(R.b1.attribution && R.b1.addOwn && R.b1.anythingElse && R.b1.closeBtn,
    "B1 (paint): the working furniture stands entire — Lasance attribution · \"Add your own — Commandment X\" · \"Anything else\" · the Close button", JSON.stringify(R.b1));
  ok(R.b2.a.pager === "2 of 3" && R.b2.a.text === "Focus question two?" && R.b2.b.pager === "3 of 3" && R.b2.b.text === "Focus question three?" &&
     R.b2.b.nextDisabled && !R.b2.b.prevDisabled && R.b2.c.pager === "2 of 3" && R.b2.c.text === "Focus question two?",
    "B2 (pager): Next walks the set, Next stands disabled at N, Back returns", JSON.stringify(R.b2));
  ok(R.b2.d.pager === "1 of 3" && R.b2.d.text === "Focus question one?" && R.b2.d.deepIdx === 0,
    "B2 (clamp): a repainted set shorter than deepIdx clamps back to the first prompt", JSON.stringify(R.b2.d));
  ok(JSON.stringify(R.b3.seen) === JSON.stringify(["Focus question one?", "Focus question two?", "Focus question three?"]),
    "B3 (focus only): paging the whole set shows exactly the focus category's prompts, each once — no other category ever paints", JSON.stringify(R.b3.seen));
  ok(R.b4.formShown && R.b4.savedEntry && !R.b4.afterDel && R.b4.deletes.length === 1 &&
     R.b4.post && R.b4.post.path === "/api/exam/entries" && R.b4.post.body.runId === 7 && R.b4.post.body.promptId === 101 &&
     R.b4.post.body.category === "Commandment X" && R.b4.post.body.text === "My entry on question one.",
    "B4 (entries): tap opens the writer; Save posts { runId, promptId, category: focus }; the entry stands under its prompt; remove deletes it", JSON.stringify(R.b4));
  ok(R.b5.customPost && R.b5.customPost.body.category === "Commandment X" && R.b5.customPost.body.promptId === null && R.b5.customPainted &&
     R.b5.freePost && R.b5.freePost.body.category === "Anything else" && R.b5.freePainted,
    "B5 (free entries): \"Add your own\" posts the focus category and paints; \"Anything else\" posts its own category and paints", JSON.stringify(R.b5));
  ok(R.b6.hadConfirm && R.b6.closePost && R.b6.closePost.path === "/api/exam/runs/7/close" && R.b6.closedNote && R.b6.noCloseBtn && R.b6.noForms && R.b6.walked === "2 of 3",
    "B6 (close): Close posts the close behind the confirm; the closed note stands, writing is disabled, and the pager still walks the set", JSON.stringify(R.b6));
  ok(R.b7.editCount === 6 && R.b7.put && R.b7.put.text === "Edited focus question?" && R.b7.sheetGone && R.b7.firstText === "Edited focus question?",
    "B7 (editor): the Prompts button opens the editor over every prompt of every category; Save PUTs the prompts; the edited focus text is what the deep set renders", JSON.stringify(R.b7));
  ok(R.b8.empty && !R.b8.pagerBtns && R.b8.cards === 0 && R.b8.head === "Commandment X",
    "B8 (empty focus): a focus category with no prompts paints \"No prompts in this category.\", no pager, no error", JSON.stringify(R.b8));
  ok(pageErrors.length === 0, "browser: zero page errors" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
}

console.log(`# harness-v428: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
