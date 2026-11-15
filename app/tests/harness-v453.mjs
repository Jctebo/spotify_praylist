#!/usr/bin/env node
// harness-v453 — Reflections in the Examination (§§1–2 of
// the v453 release document; John, Ora thread, 2026-11-15
// 16:18 CT + amendments 16:20/16:21, approved 17:49 CT:
// D1 A · D2 A · D3 A · D4 To Ship). Examination entries gain
// a KIND (Sin | Reflection): migration 0025 adds
// exam_entries.kind TEXT NOT NULL DEFAULT 'sin' (additive;
// standing rows read 'sin'). The kind switch stands in all
// three entry forms (Sin default); a reflection renders in
// place in the gold reflection dress; Confession lists sins
// only and its guide step 2 paints composed (the short
// preamble + the sins grouped, each with a Delete behind the
// standing confirm) — the standalone PREPARATION section
// retires into step 2; the confession stamp takes sins only;
// DELETE /api/confession/entries/:id deletes a sin on an open
// OR a closed run (a reflection 404s and stands) while the
// standing DELETE /api/exam/entries/:id is untouched (its
// open-run 409 = the v450 finding 3, preserved); the
// Conscience toggle gains the third side, Spiritual
// Direction, gathering every reflection grouped by day
// (GET /api/exam/reflections).
//
// VEHICLES (per §2): the server legs (SV) + migration legs
// (MG) ride the estate wrangler LOCAL_DEV mold
// (harness-v434/v445) — the REAL worker over HTTP against
// fixture D1s built from the migration files, with direct
// D1 asserts through wrangler d1 execute --local. The fresh
// fixture DBs carry no PIN state, so the exam/confession
// blocks' pinGate passes exactly as it does for a user who
// has not set a PIN. The client legs (EX/CF/DR) ride the
// verbatim-extraction mold (harness-v444/v445): the client's
// own functions in headless Chromium over a stubbed
// api()/post() seam with the real APP_CSS.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v453 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const ESBUILD = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild";
const PORT = 8999;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v453");
const PERSIST_A = path.join(APP, ".wrangler-test-v453a");
const PERSIST_B = path.join(APP, ".wrangler-test-v453b");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v453-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHIPBASE = "release/v452-ship";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const YDAY = new Date(Date.parse(TODAY + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---- ST: statics -------------------------------------------------
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", SHIPBASE, "--", "app/worker/src", "app/migrations"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/migrations/0025_exam_entry_kind.sql", "app/worker/src/client.ts", "app/worker/src/index.ts", "app/worker/src/ui.ts"]),
    "ST1 the diff vs the v452-ship base is migration 0025 + client.ts + index.ts + ui.ts only (got: " + changed.join(", ") + ")");
  const mig = fs.readFileSync(path.join(APP, "migrations/0025_exam_entry_kind.sql"), "utf8");
  ok(mig.includes("ALTER TABLE exam_entries ADD COLUMN kind TEXT NOT NULL DEFAULT 'sin';") && (mig.match(/ALTER TABLE/g) || []).length === 1,
    "ST2 migration 0025 is exactly the one additive ALTER (kind TEXT NOT NULL DEFAULT 'sin')");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v452-1";'),
    "ST3 (housekeeping): the SW pin stands at ora-pro-nobis-v452-1 (Ship moves it)");

  // The cooked-parse gate + the backslash census (the v439
  // mold): APP_JS is one template literal; the served script
  // must parse whole and carry no single-backslash
  // non-escape sequence cooking would silently rewrite.
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let COOKED = null, cookErr = null, parseErr = null;
  try { COOKED = new Function("return `" + RAW_JS + "`")(); } catch (e) { cookErr = e; }
  if (COOKED != null) { try { new vm.Script(COOKED); } catch (e) { parseErr = e; } }
  ok(!cookErr && COOKED != null && !parseErr, "ST4 the whole cooked APP_JS parses (vm.Script) — the v439 gate", (cookErr || parseErr || {}).message);
  const VALID = new Set(["'", '"', "`", "$", "\\", "b", "f", "n", "r", "t", "v", "0", "\n"]);
  const sites = [];
  for (let i = 0; i < RAW_JS.length; i++) {
    const ch = RAW_JS[i];
    if (ch !== "\\") continue;
    const nx = RAW_JS[i + 1];
    if (nx === undefined) break;
    if (nx === "\\") { i++; continue; }
    if (nx === "u" && (/^[0-9a-fA-F]{4}$/.test(RAW_JS.slice(i + 2, i + 6)) || RAW_JS[i + 2] === "{")) { i += 5; continue; }
    if (nx === "x" && /^[0-9a-fA-F]{2}$/.test(RAW_JS.slice(i + 2, i + 4))) { i += 3; continue; }
    if (VALID.has(nx)) { i++; continue; }
    sites.push("\\" + nx + " @" + i);
    i++;
  }
  ok(sites.length === 0, "ST5 the APP_JS backslash census reads 0 (no non-escape sequence for cooking to rewrite)", sites.join(" · "));
  let bundles = true;
  try { execFileSync(ESBUILD, [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v453-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" }); }
  catch { bundles = false; }
  ok(bundles, "ST6 the whole worker bundles clean (esbuild)");
}

// ---- SS: server source form ---------------------------------------
{
  const gateAt = INDEX.indexOf('seg[0] === "api" && (seg[1] === "exam" || seg[1] === "confession")');
  const postAt = INDEX.indexOf('seg[2] === "entries" && request.method === "POST"');
  const postSeg = INDEX.slice(postAt, postAt + 2600);
  ok(postSeg.includes('body.kind === "reflection" ? "reflection" : "sin"') &&
     postSeg.includes("INSERT INTO exam_entries (run_id, prompt_id, category, text, kind, created_at)"),
    "SS1 the entries POST folds kind ('reflection' stands; anything else 'sin') and the INSERT carries the column");
  const todaySeg = INDEX.slice(INDEX.indexOf("async function examToday"), INDEX.indexOf("function elapsedText"));
  ok(todaySeg.includes("created_at, kind FROM exam_entries WHERE run_id=?"),
    "SS2 examToday's entry select names kind with the standing columns (the seat as found was SELECT *; §3 states it)");
  const payloadSeg = INDEX.slice(INDEX.indexOf("async function confessionPayload"), INDEX.indexOf("// ---- Source-mapping settings"));
  ok(payloadSeg.includes("WHERE e.confession_id IS NULL AND e.kind='sin'"),
    "SS3 confessionPayload's prep read takes sins only (AND e.kind='sin')");
  ok(INDEX.includes("UPDATE exam_entries SET confession_id=? WHERE confession_id IS NULL AND kind='sin'"),
    "SS4 the confession stamp takes sins only (AND kind='sin') — reflections are never swept");
  ok(INDEX.includes("SELECT e.id FROM exam_entries e JOIN exam_runs r ON r.id = e.run_id WHERE e.id=? AND r.state='open'") &&
     INDEX.includes('if (!row) return err(409, "entry is not on an open run");'),
    "SS5 the standing DELETE /api/exam/entries/:id stands untouched (the open-run select + its 409 — finding 3 preserved)");
  const reflAt = INDEX.indexOf('seg[2] === "reflections" && request.method === "GET"');
  const cfDelAt = INDEX.indexOf('const cfDelMatch = seg[2] === "entries"');
  ok(gateAt >= 0 && reflAt > gateAt && cfDelAt > gateAt,
    "SS6 both new routes stand below the exam/confession pinGate application (PIN-gated with their blocks)");
  const cfDelSeg = INDEX.slice(cfDelAt, cfDelAt + 1400);
  ok(cfDelSeg.includes("SELECT id FROM exam_entries WHERE id=? AND kind='sin'") && cfDelSeg.includes('return err(404, "entry not found");'),
    "SS7 the Confession-side delete selects sins only, run state unconditioned; a reflection or missing id answers 404");
  const reflSeg = INDEX.slice(INDEX.indexOf("async function reflectionsPayload"), INDEX.indexOf("// ---- Source-mapping settings"));
  ok(reflSeg.includes("WHERE e.kind='reflection'") && reflSeg.includes("ORDER BY r.date DESC, e.created_at, e.id"),
    "SS8 reflectionsPayload reads kind='reflection' joined to the run date, newest day first, written order within the day");
}

// ---- wrangler helpers (the estate mold, harness-v434/v445) --------
function wranglerD1(persist, args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", persist, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function d1q(persist, sql) {
  const out = wranglerD1(persist, ["--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results || [];
}
function applyFiles(persist, files) {
  fs.rmSync(persist, { recursive: true, force: true });
  const f = path.join(TMPD, "migs-" + path.basename(persist) + ".sql");
  fs.writeFileSync(f, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  wranglerD1(persist, ["--file", f]);
}
const migDir = path.join(APP, "migrations");
const allMigs = fs.readdirSync(migDir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(migDir, f));
const procs = [];
function startApp() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(3000) }); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const req = async (method, p, body, headers = {}) => {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const out = { status: r.status, body: await r.json().catch(() => ({})) };
      if (out.status >= 500 && i < 4) { await sleep(800); continue; }
      return out;
    } catch (e) { lastErr = e; await sleep(800); }
  }
  throw lastErr;
};

// ---- client fixture compositions -----------------------------------
const EXAM_SRC = [
  extractFn(CLIENT, "esc"), extractFn(CLIENT, "skelHtml"), extractFn(CLIENT, "entriesHtml"),
  extractFn(CLIENT, "entryHtml"), extractFn(CLIENT, "reflectionEntryHtml"),
  extractFn(CLIENT, "kindSwitchHtml"), extractFn(CLIENT, "kindOf"), extractFn(CLIENT, "wireKindSwitches"),
  extractFn(CLIENT, "entryFieldHtml"), extractFn(CLIENT, "followExamChip"),
  extractFn(CLIENT, "renderExaminationContent"), extractFn(CLIENT, "wireExamination"),
  extractFn(CLIENT, "openPromptsEditor"),
].join("\n");

const EXAM_FIXTURE = `
var view = document.getElementById('view');
var state = { deepIdx: 0, examCat: null, examFollowActive: false };
var placeSkip = {};
var nextEntryId = 900;
function fixturePayload() {
  return {
    ok: true, date: '2026-11-15', dateLabel: 'Sunday, November 15',
    run: { id: 7, date: '2026-11-15', state: 'open' },
    categories: ['Preliminary Examination', 'Commandment I', 'Commandment IV', 'Capital Sins'],
    focusCategory: 'Commandment IV',
    prompts: [
      { id: 401, category: 'Commandment IV', text: 'Focus question one?' },
      { id: 402, category: 'Commandment IV', text: 'Focus question two?' },
      { id: 101, category: 'Commandment I', text: 'First commandment question?' }
    ],
    entries: [
      { id: 55, run_id: 7, prompt_id: 401, category: 'Commandment IV', text: 'A sin under the focus prompt.', kind: 'sin', created_at: '2026-11-15T21:05:00' },
      { id: 56, run_id: 7, prompt_id: 401, category: 'Commandment IV', text: 'A reflection under the focus prompt.', kind: 'reflection', created_at: '2026-11-15T21:06:00' },
      { id: 57, run_id: 7, prompt_id: null, category: 'Commandment IV', text: 'A custom reflection.', kind: 'reflection', created_at: '2026-11-15T21:07:00' },
      { id: 58, run_id: 7, prompt_id: 401, category: 'Commandment IV', text: 'A legacy entry with no kind field.', created_at: '2026-11-15T21:08:00' }
    ]
  };
}
var WORLD = fixturePayload();
var CALLS = { posts: [], deletes: [] };
function api(path, opts) {
  opts = opts || {};
  var method = opts.method || 'GET';
  if (method === 'GET' && path === '/api/exam/today') return Promise.resolve(JSON.parse(JSON.stringify(WORLD)));
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
    WORLD.entries.push({ id: nextEntryId++, run_id: body.runId, prompt_id: body.promptId, category: body.category, text: body.text, kind: body.kind, created_at: '2026-11-15T21:30:00' });
    return Promise.resolve({ ok: true });
  }
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
${EXAM_SRC}
function flush() { return new Promise(function (r) { setTimeout(r, 10); }).then(function () { return new Promise(function (r) { setTimeout(r, 10); }); }); }
var R = {};
// ---- EX1/EX2: the switch in all three forms; the dress in place ---
WORLD = fixturePayload();
state.deepIdx = 0; state.examCat = null; renderExaminationContent(); await flush();
view.querySelector('.prompt').click();
var efSwitch = view.querySelector('#ef-401 .kindswitch');
R.ex1 = { promptSwitch: !!efSwitch,
  promptBtns: efSwitch ? efSwitch.querySelectorAll('[data-kind]').length : 0,
  promptSinActive: !!(efSwitch && efSwitch.querySelector('[data-kind="sin"].active')),
  promptReflActive: !!(efSwitch && efSwitch.querySelector('[data-kind="reflection"].active')),
  customSwitch: !!view.querySelector('#kind-custom'), freeSwitch: !!view.querySelector('#kind-free') };
var reflEl = null, sinEl = null, legacyEl = null;
view.querySelectorAll('.entry').forEach(function (el) {
  if (el.textContent.indexOf('A reflection under the focus prompt.') >= 0) reflEl = el;
  if (el.textContent.indexOf('A sin under the focus prompt.') >= 0) sinEl = el;
  if (el.textContent.indexOf('A legacy entry with no kind field.') >= 0) legacyEl = el;
});
R.ex2 = { reflStands: !!reflEl, reflDress: !!(reflEl && reflEl.classList.contains('refl')),
  reflTag: !!(reflEl && reflEl.querySelector('.refltag') && reflEl.querySelector('.refltag').textContent === 'REFLECTION'),
  reflRemove: !!(reflEl && reflEl.querySelector('[data-del-entry="56"]')),
  sinPlain: !!(sinEl && !sinEl.classList.contains('refl')), sinRemove: !!(sinEl && sinEl.querySelector('[data-del-entry="55"]')),
  customRefl: !!Array.prototype.slice.call(view.querySelectorAll('.entry.refl')).some(function (el) { return el.textContent.indexOf('A custom reflection.') >= 0; }),
  legacyPlain: !!(legacyEl && !legacyEl.classList.contains('refl')) };
// ---- EX3: a prompt-form save with the switch on Reflection --------
view.querySelector('#ef-401 [data-kind="reflection"]').click();
document.getElementById('et-401').value = 'A new reflection from the prompt form.';
view.querySelector('[data-save-entry="401"]').click(); await flush();
var lastPost = CALLS.posts[CALLS.posts.length - 1];
var newReflEl = null;
view.querySelectorAll('.entry').forEach(function (el) { if (el.textContent.indexOf('A new reflection from the prompt form.') >= 0) newReflEl = el; });
R.ex3 = { kind: lastPost && lastPost.body && lastPost.body.kind, path: lastPost && lastPost.path,
  renderedRefl: !!(newReflEl && newReflEl.classList.contains('refl')) };
// ---- EX4: the custom form saves Sin by default ---------------------
document.getElementById('custom-text').value = 'A default custom entry.';
document.getElementById('custom-add').click(); await flush();
lastPost = CALLS.posts[CALLS.posts.length - 1];
R.ex4 = { kind: lastPost && lastPost.body && lastPost.body.kind };
// ---- EX5: the free form with the switch flipped --------------------
view.querySelector('#kind-free [data-kind="reflection"]').click();
document.getElementById('free-text').value = 'A free-form reflection.';
document.getElementById('free-add').click(); await flush();
lastPost = CALLS.posts[CALLS.posts.length - 1];
R.ex5 = { kind: lastPost && lastPost.body && lastPost.body.kind, category: lastPost && lastPost.body && lastPost.body.category };
return R;
`;

const CONF_SRC = [
  extractFn(CLIENT, "esc"), extractFn(CLIENT, "skelHtml"), extractFn(CLIENT, "openConfirm"),
  extractFn(CLIENT, "renderConfessionContent"), extractFn(CLIENT, "openGuideEditor"),
].join("\n");

const CONF_FIXTURE = `
var view = document.getElementById('view');
var placeSkip = {};
function baseWorld() {
  return {
    ok: true, elapsed: 'It has been 2 weeks since your last confession',
    lastConfession: { id: 3, date: '2026-11-01', note: '' },
    guide: [
      { step_no: 1, title: 'Opening', body: 'STEP ONE STORED BODY' },
      { step_no: 2, title: 'The list', body: 'STEP TWO STORED BODY' },
      { step_no: 3, title: 'Act of Contrition', body: 'STEP THREE STORED BODY' }
    ],
    penance: null,
    prep: [ { category: 'Commandment I', repeatPrompts: 0, entries: [
      { id: 71, text: 'First sin text here', date: '2026-11-14' },
      { id: 72, text: 'Second sin stands', date: '2026-11-15' }
    ] } ],
    history: [ { id: 3, date: '2026-11-01', note: '', penance_text: '', penance_done_at: null, entryCount: 4 } ]
  };
}
var WORLD = baseWorld();
var CALLS = { deletes: [], puts: [] };
function api(path, opts) {
  opts = opts || {};
  var method = opts.method || 'GET';
  if (method === 'GET' && path === '/api/confession') return Promise.resolve(JSON.parse(JSON.stringify(WORLD)));
  if (method === 'DELETE' && path.indexOf('/api/confession/entries/') === 0) {
    var id = Number(path.slice('/api/confession/entries/'.length));
    CALLS.deletes.push(id);
    WORLD.prep.forEach(function (g) { g.entries = g.entries.filter(function (e) { return e.id !== id; }); });
    WORLD.prep = WORLD.prep.filter(function (g) { return g.entries.length; });
    return Promise.resolve({ ok: true });
  }
  if (method === 'PUT' && path === '/api/confession/guide') { CALLS.puts.push(JSON.parse(opts.body)); return Promise.resolve({ ok: true }); }
  return Promise.reject(new Error('unstubbed api: ' + method + ' ' + path));
}
function post(path, body) { return Promise.resolve({ ok: true }); }
function renderConfession() { renderConfessionContent(); }
function renderConscienceContent() {}
function pinRefusalGate() { return false; }
function fieldNote() {}
function wireFieldNotes() {}
function todayChicago() { return '2026-11-15'; }
function mountDrawer() {}
${CONF_SRC}
function flush() { return new Promise(function (r) { setTimeout(r, 10); }).then(function () { return new Promise(function (r) { setTimeout(r, 10); }); }); }
function step2Card() {
  var cards = view.querySelectorAll('.card');
  for (var i = 0; i < cards.length; i++) { var h = cards[i].querySelector('h3'); if (h && h.textContent.indexOf('2 ·') === 0) return cards[i]; }
  return null;
}
var R = {};
// ---- CF1: step 2 composed; the rest of the page stands -------------
WORLD = baseWorld(); renderConfessionContent(); await flush();
var s2 = step2Card();
R.cf1 = { s2Stands: !!s2,
  preamble: !!(s2 && s2.textContent.indexOf('Bless me, Father, for I have sinned.') >= 0),
  elapsedClause: !!(s2 && s2.textContent.indexOf('It has been 2 weeks since your last confession.') >= 0),
  sinsCue: !!(s2 && s2.textContent.indexOf('These are my sins:') >= 0),
  storedBodyGone: view.textContent.indexOf('STEP TWO STORED BODY') < 0,
  step1Body: view.textContent.indexOf('STEP ONE STORED BODY') >= 0,
  step3Body: view.textContent.indexOf('STEP THREE STORED BODY') >= 0,
  noPreparation: view.textContent.indexOf('PREPARATION') < 0,
  sin1: view.textContent.indexOf('First sin text here') >= 0,
  sin2: view.textContent.indexOf('Second sin stands') >= 0,
  delBtns: view.querySelectorAll('[data-confdel]').length,
  penanceStands: view.textContent.indexOf('PENANCE') >= 0,
  madeStands: view.textContent.indexOf('Confession made') >= 0,
  historyStands: view.textContent.indexOf('HISTORY') >= 0 };
// ---- CF2: the confirm gates the delete; the entry leaves -----------
view.querySelector('[data-confdel="71"]').click(); await flush();
var sheet = document.querySelector('.confirmsheet');
R.cf2a = { sheetStands: !!sheet, noDeleteYet: CALLS.deletes.length === 0,
  lineNames: !!(sheet && sheet.textContent.indexOf('First sin text here') >= 0) };
sheet.querySelector('[data-cfgo]').click(); await flush();
R.cf2b = { deleted: CALLS.deletes.join(','), gone: view.textContent.indexOf('First sin text here') < 0,
  otherStands: view.textContent.indexOf('Second sin stands') >= 0 };
// ---- CF3: no last confession + no sins ------------------------------
WORLD = baseWorld(); WORLD.lastConfession = null; WORLD.elapsed = 'No confession recorded yet in this app'; WORLD.prep = []; WORLD.history = [];
renderConfessionContent(); await flush();
s2 = step2Card();
R.cf3 = { preamble: !!(s2 && s2.textContent.indexOf('Bless me, Father, for I have sinned.') >= 0),
  sinsCue: !!(s2 && s2.textContent.indexOf('These are my sins:') >= 0),
  noElapsedClause: !!(s2 && s2.textContent.indexOf('No confession recorded yet') < 0 && s2.textContent.indexOf('It has been') < 0),
  emptyLine: !!(s2 && s2.textContent.indexOf('No sins stand ready') >= 0),
  noDelBtns: view.querySelectorAll('[data-confdel]').length === 0 };
// ---- CF4: the Guide editor's step-2 note; the save omits step 2 -----
WORLD = baseWorld(); renderConfessionContent(); await flush();
document.getElementById('cf-gear').click(); await flush();
var ed = document.querySelector('.sheet');
R.cf4a = { sheetStands: !!ed,
  noStep2Title: !document.querySelector('[data-guide-title="2"]'),
  noStep2Body: !document.querySelector('[data-guide-body="2"]'),
  noteStands: !!(ed && ed.textContent.indexOf('Step 2 reads as the short preamble and your sins') >= 0),
  step1Field: !!document.querySelector('[data-guide-title="1"]'),
  step3Field: !!document.querySelector('[data-guide-body="3"]') };
document.getElementById('ge-save').click(); await flush();
var put = CALLS.puts[CALLS.puts.length - 1];
R.cf4b = { putSteps: put && put.steps ? put.steps.map(function (s) { return s.step_no; }).join(',') : '' };
return R;
`;

const DIR_SRC = [
  extractFn(CLIENT, "esc"), extractFn(CLIENT, "skelHtml"), extractFn(CLIENT, "iosBarHtml"),
  extractFn(CLIENT, "tabSideCfg"), extractFn(CLIENT, "paintSideToggle"), extractFn(CLIENT, "paintConscienceBar"),
  extractFn(CLIENT, "reflectionEntryHtml"), extractFn(CLIENT, "longDateLabel"),
  extractFn(CLIENT, "renderDirectionContent"),
].join("\n");

const DIR_FIXTURE = `
var view = document.getElementById('view');
var TAB_SIDE_PRAYERS_KEY = 'opn-tabside-prayers-v410';
var TAB_SIDE_CONSCIENCE_KEY = 'opn-tabside-conscience-v410';
var TAB_SIDE_WALLPAPER_KEY = 'opn-tabside-wallpaper-v414';
var DWORLD = { ok: true, groups: [
  { date: '2026-11-15', entries: [ { id: 81, text: 'Today reflection text', category: 'Commandment I', created_at: '2026-11-15T21:00:00' } ] },
  { date: '2026-11-13', entries: [ { id: 80, text: 'Older reflection text', category: 'Capital Sins', created_at: '2026-11-13T21:00:00' } ] }
] };
var MODE = 'full';
var GATECALLS = [];
function api(path, opts) {
  if (path === '/api/exam/reflections') {
    if (MODE === 'refuse') return Promise.reject(new Error('pin_required'));
    if (MODE === 'empty') return Promise.resolve({ ok: true, groups: [] });
    return Promise.resolve(JSON.parse(JSON.stringify(DWORLD)));
  }
  return Promise.reject(new Error('unstubbed api: ' + path));
}
function renderConscienceContent() {}
function pinRefusalGate(tab, contentFn, e) {
  if (!e || e.message !== 'pin_required') return false;
  GATECALLS.push({ tab: tab, fn: contentFn === renderConscienceContent ? 'renderConscienceContent' : 'other' });
  return true;
}
${DIR_SRC}
function flush() { return new Promise(function (r) { setTimeout(r, 10); }).then(function () { return new Promise(function (r) { setTimeout(r, 10); }); }); }
var R = {};
// ---- DR1: the toggle reads three sides -------------------------------
var tgl = document.createElement('div'); tgl.innerHTML = paintSideToggle('conscience', 'direction');
var btns = tgl.querySelectorAll('[data-side]');
R.dr1 = { count: btns.length,
  labels: Array.prototype.map.call(btns, function (b) { return b.textContent; }).join('|'),
  activeIsDirection: !!(btns[2] && btns[2].classList.contains('active') && btns[2].getAttribute('data-side') === 'direction') };
// ---- DR2: the bar reads Spiritual Direction alone ---------------------
paintConscienceBar('direction');
var bar = document.getElementById('consbar');
R.dr2 = { title: !!(bar && bar.textContent.indexOf('Spiritual Direction') >= 0),
  noBack: !(bar && bar.querySelector('[data-back], .iosbar-back')) };
// ---- DR3: the page groups reflections by day, newest first ------------
MODE = 'full'; renderDirectionContent(); await flush();
var heads = view.querySelectorAll('h2.sectionhead');
R.dr3 = { headCount: heads.length,
  head1: heads[0] ? heads[0].textContent : '', head2: heads[1] ? heads[1].textContent : '',
  todayStands: view.textContent.indexOf('Today reflection text') >= 0,
  olderStands: view.textContent.indexOf('Older reflection text') >= 0,
  orderOk: view.textContent.indexOf('Today reflection text') < view.textContent.indexOf('Older reflection text'),
  categoryShown: view.textContent.indexOf('Commandment I') >= 0 && view.textContent.indexOf('Capital Sins') >= 0,
  dressCount: view.querySelectorAll('.entry.refl').length,
  tagCount: view.querySelectorAll('.refltag').length,
  noDelete: view.querySelectorAll('[data-confdel], [data-del-entry]').length === 0 };
// ---- DR4: the empty state ----------------------------------------------
MODE = 'empty'; renderDirectionContent(); await flush();
R.dr4 = { emptyLine: view.textContent.indexOf('No reflections yet.') >= 0 };
// ---- DR5: a PIN refusal routes through the standing gate ----------------
MODE = 'refuse'; renderDirectionContent(); await flush();
R.dr5 = { gateCalls: GATECALLS.length, gateTab: GATECALLS[0] && GATECALLS[0].tab, gateFn: GATECALLS[0] && GATECALLS[0].fn,
  noFailurePaint: view.textContent.indexOf('This page did not load.') < 0 };
return R;
`;

const DIR360 = `
var view = document.getElementById('view');
var TAB_SIDE_PRAYERS_KEY = 'x'; var TAB_SIDE_CONSCIENCE_KEY = 'y'; var TAB_SIDE_WALLPAPER_KEY = 'z';
function api() { return Promise.resolve({ ok: true, groups: [ { date: '2026-11-15', entries: [ { id: 81, text: 'Today reflection text', category: 'Commandment I', created_at: '2026-11-15T21:00:00' } ] } ] }); }
function renderConscienceContent() {}
function pinRefusalGate() { return false; }
${DIR_SRC}
var host = document.createElement('div'); host.innerHTML = paintSideToggle('conscience', 'direction'); document.body.appendChild(host);
renderDirectionContent();
await new Promise(function (r) { setTimeout(r, 30); });
return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, heads: view.querySelectorAll('h2.sectionhead').length };
`;

let browser = null;
try {
  // ---------- MG: migration legs -----------------------------------
  {
    applyFiles(PERSIST_A, allMigs.filter((f) => !f.includes("0025")));
    d1q(PERSIST_A, `INSERT INTO exam_runs (date, state, opened_at) VALUES ('2026-11-10', 'open', '2026-11-10T02:00:00.000Z')`);
    const runA = d1q(PERSIST_A, "SELECT id FROM exam_runs WHERE date='2026-11-10'")[0].id;
    d1q(PERSIST_A, `INSERT INTO exam_entries (run_id, prompt_id, category, text, confession_id, created_at) VALUES (${runA}, NULL, 'Commandment I', 'MG standing entry', NULL, '2026-11-10T02:05:00.000Z')`);
    const f25 = path.join(TMPD, "mig-0025.sql");
    fs.writeFileSync(f25, fs.readFileSync(path.join(migDir, "0025_exam_entry_kind.sql"), "utf8"));
    wranglerD1(PERSIST_A, ["--file", f25]);
    const infoA = d1q(PERSIST_A, "PRAGMA table_info(exam_entries)");
    const kindRow = infoA.find((r) => r.name === "kind");
    ok(!!kindRow && kindRow.type === "TEXT" && kindRow.notnull === 1 && String(kindRow.dflt_value) === "'sin'",
      "MG1 migration 0025 applies over a 0024-state DB — exam_entries.kind stands TEXT NOT NULL DEFAULT 'sin'", JSON.stringify(kindRow || null));
    const mgRow = d1q(PERSIST_A, "SELECT kind FROM exam_entries WHERE text='MG standing entry'");
    ok(mgRow.length === 1 && mgRow[0].kind === "sin",
      "MG1 a row standing before 0025 reads kind='sin' after it (standing entries are sins)", JSON.stringify(mgRow));
    applyFiles(PERSIST_B, allMigs);
    const infoB = d1q(PERSIST_B, "PRAGMA table_info(exam_entries)");
    ok(JSON.stringify(infoA) === JSON.stringify(infoB),
      "MG2 a fresh full-migration DB's exam_entries schema agrees with the 0024→0025 path");
  }

  // ---------- SV: server legs, the real worker over HTTP ------------
  try { execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stood on the port */ }
  for (let i = 0; i < 20; i++) {
    try { await fetch(BASE + "/", { signal: AbortSignal.timeout(1000) }); await sleep(500); }
    catch { break; }
    if (i === 19) throw new Error("port never freed — a stale server stands");
  }
  applyFiles(PERSIST, allMigs);
  startApp();
  ok(await waitUp(), "SV0 app up on local wrangler (LOCAL_DEV)");
  const svInfo = d1q(PERSIST, "PRAGMA table_info(exam_entries)");
  ok(svInfo.some((r) => r.name === "kind"), "SV0 the fixture D1 (all migrations) carries exam_entries.kind");

  const t0 = await req("GET", "/api/exam/today");
  ok(t0.status === 200 && t0.body.run && t0.body.run.state === "open", "SV1 the day read stands with an open run", JSON.stringify(t0.body.run || {}));
  const runT = t0.body.run.id;
  const kindOfText = (text) => { const r = d1q(PERSIST, `SELECT kind, confession_id FROM exam_entries WHERE text='${text}'`); return r[0] || {}; };

  const p1 = await req("POST", "/api/exam/entries", { runId: runT, promptId: null, category: "Commandment I", text: "SV sin one no kind" });
  const p2 = await req("POST", "/api/exam/entries", { runId: runT, promptId: null, category: "Commandment I", text: "SV reflection one", kind: "reflection" });
  const p3 = await req("POST", "/api/exam/entries", { runId: runT, promptId: null, category: "Commandment I", text: "SV unknown kind entry", kind: "bogus" });
  const p4 = await req("POST", "/api/exam/entries", { runId: runT, promptId: null, category: "Commandment I", text: "SV sin two explicit", kind: "sin" });
  ok(p1.status === 201 && p2.status === 201 && p3.status === 201 && p4.status === 201,
    "SV2 all four entry posts land (201)", [p1.status, p2.status, p3.status, p4.status].join(","));
  ok(kindOfText("SV sin one no kind").kind === "sin" && kindOfText("SV reflection one").kind === "reflection" &&
     kindOfText("SV unknown kind entry").kind === "sin" && kindOfText("SV sin two explicit").kind === "sin",
    "SV2 D1 kinds: absent → 'sin' · 'reflection' stands · an unknown kind → 'sin' · 'sin' stands",
    JSON.stringify([kindOfText("SV sin one no kind"), kindOfText("SV reflection one"), kindOfText("SV unknown kind entry"), kindOfText("SV sin two explicit")]));

  const t1 = await req("GET", "/api/exam/today");
  const todayKinds = {};
  (t1.body.entries || []).forEach((e) => { todayKinds[e.text] = e.kind; });
  ok(todayKinds["SV sin one no kind"] === "sin" && todayKinds["SV reflection one"] === "reflection",
    "SV3 the day read's entry rows carry kind (sin + reflection ride the payload)", JSON.stringify(todayKinds));

  d1q(PERSIST, `INSERT INTO exam_runs (date, state, opened_at, closed_at) VALUES ('${YDAY}', 'closed', '${YDAY}T02:00:00.000Z', '${YDAY}T03:00:00.000Z')`);
  const runY = d1q(PERSIST, `SELECT id FROM exam_runs WHERE date='${YDAY}'`)[0].id;
  d1q(PERSIST, `INSERT INTO exam_entries (run_id, prompt_id, category, text, kind, confession_id, created_at) VALUES (${runY}, NULL, 'Commandment I', 'SV yesterday sin', 'sin', NULL, '${YDAY}T02:30:00.000Z')`);
  d1q(PERSIST, `INSERT INTO exam_entries (run_id, prompt_id, category, text, kind, confession_id, created_at) VALUES (${runY}, NULL, 'Capital Sins', 'SV yesterday reflection', 'reflection', NULL, '${YDAY}T02:31:00.000Z')`);
  const ySinId = d1q(PERSIST, "SELECT id FROM exam_entries WHERE text='SV yesterday sin'")[0].id;
  const yReflId = d1q(PERSIST, "SELECT id FROM exam_entries WHERE text='SV yesterday reflection'")[0].id;
  const sin1Id = d1q(PERSIST, "SELECT id FROM exam_entries WHERE text='SV sin one no kind'")[0].id;
  const sin2Id = d1q(PERSIST, "SELECT id FROM exam_entries WHERE text='SV sin two explicit'")[0].id;

  const cf0 = await req("GET", "/api/confession");
  const prepTexts = [];
  (cf0.body.prep || []).forEach((g) => (g.entries || []).forEach((e) => prepTexts.push(e.text)));
  ok(prepTexts.includes("SV sin one no kind") && prepTexts.includes("SV sin two explicit") && prepTexts.includes("SV unknown kind entry") && prepTexts.includes("SV yesterday sin") &&
     !prepTexts.includes("SV reflection one") && !prepTexts.includes("SV yesterday reflection"),
    "SV4 Confession prep lists the sins (today's + yesterday's open ones) and NO reflection", prepTexts.join(" | "));

  const rf = await req("GET", "/api/exam/reflections");
  ok(rf.status === 200 && (rf.body.groups || []).length === 2 &&
     rf.body.groups[0].date === TODAY && rf.body.groups[1].date === YDAY &&
     (rf.body.groups[0].entries || []).map((e) => e.text).join() === "SV reflection one" &&
     (rf.body.groups[1].entries || []).map((e) => e.text).join() === "SV yesterday reflection",
    "SV5 the reflections read groups by day, newest first, reflections only", JSON.stringify(rf.body.groups || []).slice(0, 300));
  const rfEntry = ((rf.body.groups || [])[0] || {}).entries?.[0] || {};
  ok("id" in rfEntry && "text" in rfEntry && "category" in rfEntry && "created_at" in rfEntry,
    "SV5 each reflections entry carries {id, text, category, created_at}", JSON.stringify(rfEntry));

  const dY = await req("DELETE", `/api/confession/entries/${ySinId}`);
  ok(dY.status === 200 && d1q(PERSIST, `SELECT id FROM exam_entries WHERE id=${ySinId}`).length === 0,
    "SV6 the Confession-side delete removes a sin standing on a CLOSED run (200; the row is gone)");
  const dYR = await req("DELETE", `/api/confession/entries/${yReflId}`);
  ok(dYR.status === 404 && d1q(PERSIST, `SELECT id FROM exam_entries WHERE id=${yReflId}`).length === 1,
    "SV6 the Confession-side delete answers 404 on a reflection — and the reflection stands");
  const dS2 = await req("DELETE", `/api/confession/entries/${sin2Id}`);
  ok(dS2.status === 200 && d1q(PERSIST, `SELECT id FROM exam_entries WHERE id=${sin2Id}`).length === 0,
    "SV6 the Confession-side delete removes a sin standing on an OPEN run (200)");
  const dMiss = await req("DELETE", "/api/confession/entries/999999");
  ok(dMiss.status === 404, "SV6 the Confession-side delete answers 404 on a missing id");

  const dExamClosed = await req("DELETE", `/api/exam/entries/${yReflId}`);
  ok(dExamClosed.status === 409 && d1q(PERSIST, `SELECT id FROM exam_entries WHERE id=${yReflId}`).length === 1,
    "SV7 the standing exam DELETE still refuses a closed-run entry (409 — finding 3 preserved; the row stands)");
  const dExamOpen = await req("DELETE", `/api/exam/entries/${sin1Id}`);
  ok(dExamOpen.status === 200 && d1q(PERSIST, `SELECT id FROM exam_entries WHERE id=${sin1Id}`).length === 0,
    "SV7 the standing exam DELETE still removes an open-run entry (200)");

  const made = await req("POST", "/api/confession/made", { date: TODAY, note: "harness-v453" });
  ok(made.status === 200 && made.body.entriesClosed === 1,
    "SV8 recording a confession closes exactly the one standing open sin (entriesClosed 1)", JSON.stringify(made.body));
  ok(kindOfText("SV unknown kind entry").confession_id === made.body.id && kindOfText("SV reflection one").confession_id === null,
    "SV8 D1: the sin carries the confession id; the reflection's confession_id stays NULL (never swept)",
    JSON.stringify([kindOfText("SV unknown kind entry"), kindOfText("SV reflection one")]));
  const cf1 = await req("GET", "/api/confession");
  const prepAfter = [];
  (cf1.body.prep || []).forEach((g) => (g.entries || []).forEach((e) => prepAfter.push(e.text)));
  ok(((cf1.body.history || [])[0] || {}).entryCount === 1 && !prepAfter.includes("SV unknown kind entry") && !prepAfter.includes("SV reflection one"),
    "SV8 after the confession: the history count reads sins (1); prep stands empty of the closed sin; the reflection stands nowhere in prep",
    JSON.stringify({ hist: (cf1.body.history || [])[0] || {}, prepAfter }));

  // ---------- client legs --------------------------------------------
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const pageErrors = [];
  const mkPage = async (width) => {
    const p = await browser.newPage({ viewport: { width, height: 915 } });
    p.on("pageerror", (e) => pageErrors.push(String(e)));
    await p.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="consbar"></div><div id="view"></div></body></html>`);
    return p;
  };
  const EX = await (await mkPage(412)).evaluate("(async () => {\n" + EXAM_FIXTURE + "\n})()");
  ok(EX.ex1.promptSwitch && EX.ex1.promptBtns === 2 && EX.ex1.promptSinActive && !EX.ex1.promptReflActive && EX.ex1.customSwitch && EX.ex1.freeSwitch,
    "EX1 the kind switch stands in all three entry forms (the prompt form's, the custom form's, the Anything-else form's) — two segments, Sin selected", JSON.stringify(EX.ex1));
  ok(EX.ex2.reflStands && EX.ex2.reflDress && EX.ex2.reflTag && EX.ex2.reflRemove && EX.ex2.sinPlain && EX.ex2.sinRemove && EX.ex2.customRefl && EX.ex2.legacyPlain,
    "EX2 a reflection renders in place in the reflection dress (the REFLECTION tag, the remove link stands); a sin and a kind-less legacy entry render plain", JSON.stringify(EX.ex2));
  ok(EX.ex3.path === "/api/exam/entries" && EX.ex3.kind === "reflection" && EX.ex3.renderedRefl,
    "EX3 a prompt-form save with the switch on Reflection POSTs kind='reflection' and the saved entry repaints in the dress", JSON.stringify(EX.ex3));
  ok(EX.ex4.kind === "sin", "EX4 the custom form saves kind='sin' by default (the switch untouched)", JSON.stringify(EX.ex4));
  ok(EX.ex5.kind === "reflection" && EX.ex5.category === "Anything else",
    "EX5 the Anything-else form with the switch flipped POSTs kind='reflection'", JSON.stringify(EX.ex5));

  const CF = await (await mkPage(412)).evaluate("(async () => {\n" + CONF_FIXTURE + "\n})()");
  ok(CF.cf1.s2Stands && CF.cf1.preamble && CF.cf1.elapsedClause && CF.cf1.sinsCue && CF.cf1.storedBodyGone &&
     CF.cf1.step1Body && CF.cf1.step3Body && CF.cf1.noPreparation && CF.cf1.sin1 && CF.cf1.sin2 && CF.cf1.delBtns === 2 &&
     CF.cf1.penanceStands && CF.cf1.madeStands && CF.cf1.historyStands,
    "CF1 step 2 paints composed (preamble + the elapsed clause + 'These are my sins:' + the sins grouped, each with Delete); the stored step-2 body and the PREPARATION section stand nowhere; steps 1/3, PENANCE, Confession made, HISTORY stand", JSON.stringify(CF.cf1));
  ok(CF.cf2a.sheetStands && CF.cf2a.noDeleteYet && CF.cf2a.lineNames,
    "CF2 the Delete act opens the standing confirmation (its line names the entry) and no DELETE fires before the confirm", JSON.stringify(CF.cf2a));
  ok(CF.cf2b.deleted === "71" && CF.cf2b.gone && CF.cf2b.otherStands,
    "CF2 the confirm fires DELETE /api/confession/entries/71 and the entry leaves the list; the other sin stands", JSON.stringify(CF.cf2b));
  ok(CF.cf3.preamble && CF.cf3.sinsCue && CF.cf3.noElapsedClause && CF.cf3.emptyLine && CF.cf3.noDelBtns,
    "CF3 with no last confession the preamble drops the elapsed clause; with no sins step 2 carries the quiet empty line and no Delete stands", JSON.stringify(CF.cf3));
  ok(CF.cf4a.sheetStands && CF.cf4a.noStep2Title && CF.cf4a.noStep2Body && CF.cf4a.noteStands && CF.cf4a.step1Field && CF.cf4a.step3Field,
    "CF4 the Guide editor shows the step-2 note in place of its fields; the other steps' fields stand", JSON.stringify(CF.cf4a));
  ok(CF.cf4b.putSteps === "1,3",
    "CF4 the Guide editor's save payload omits step 2 (steps 1,3 only) — the stored step-2 row stands untouched", JSON.stringify(CF.cf4b));

  const DR = await (await mkPage(412)).evaluate("(async () => {\n" + DIR_FIXTURE + "\n})()");
  const longFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const longOf = (d) => longFmt.format(new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), 12)));
  ok(DR.dr1.count === 3 && DR.dr1.labels === "Examination|Confession|Spiritual Direction" && DR.dr1.activeIsDirection,
    "DR1 the Conscience toggle reads three sides (Examination · Confession · Spiritual Direction), the standing side active", JSON.stringify(DR.dr1));
  ok(DR.dr2.title && DR.dr2.noBack,
    "DR2 the Spiritual Direction bar reads its title alone — no back act stands", JSON.stringify(DR.dr2));
  ok(DR.dr3.headCount === 2 && DR.dr3.head1 === longOf("2026-11-15") && DR.dr3.head2 === longOf("2026-11-13") &&
     DR.dr3.todayStands && DR.dr3.olderStands && DR.dr3.orderOk && DR.dr3.categoryShown && DR.dr3.dressCount === 2 && DR.dr3.tagCount === 2 && DR.dr3.noDelete,
    "DR3 the Direction page groups reflections by day (long-form day heads, newest first), each in the reflection dress with its category; no delete stands", JSON.stringify(DR.dr3));
  ok(DR.dr4.emptyLine, "DR4 the empty state stands (one quiet card: 'No reflections yet.')", JSON.stringify(DR.dr4));
  ok(DR.dr5.gateCalls === 1 && DR.dr5.gateTab === "conscience" && DR.dr5.gateFn === "renderConscienceContent" && DR.dr5.noFailurePaint,
    "DR5 a PIN refusal routes through the standing pinRefusalGate (the conscience tab, the container repaint) as the other sides do", JSON.stringify(DR.dr5));

  const D360 = await (await mkPage(360)).evaluate("(async () => {\n" + DIR360 + "\n})()");
  ok(D360.heads === 1 && D360.sw <= D360.iw,
    "DR6 at 360px the three-segment toggle + the Direction page stand with no horizontal overflow", JSON.stringify(D360));
  ok(pageErrors.length === 0, "browser: zero page errors across all client legs" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
  await browser.close(); browser = null;
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  procs.forEach((p) => { try { process.kill(-p.pid, "SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch { /* noop */ } } });
}
console.log(`# harness-v453: ${n} ok / ${fails} not-ok`);
process.exit(fails ? 1 : 0);
