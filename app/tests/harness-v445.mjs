#!/usr/bin/env node
// harness-v445 — Examination: multiple examinations in a
// day (§§1–2 of the v445 release document; John's words,
// Ora thread, 2026-11-15 12:03 CT: "Also, I need to be able
// to make multiple examinations in a day"). One pass per
// day was a read-side accident: examToday took the FIRST
// run for the date and a closed run disabled the page for
// the rest of the day. The fix: (1) the day read takes the
// day's LATEST run (ORDER BY id DESC), creating an open
// run only when no run stands for the date; (2) a new
// session-guarded route POST /api/exam/runs (inside the
// pin-gated exam block) starts a fresh pass — the latest
// run governs: open → returned unchanged (created:false,
// never two open runs for a date); closed → a fresh open
// run (201, created:true, the run carried in the answer);
// (3) the closed page gains ONE solid act in the head
// area, #run-new "Start a new examination" — its tap
// resets examCat/deepIdx, posts the route, and repaints
// open on tonight's focus. The Confession read already
// spans runs (unchanged).
//
// IMPLEMENT FINDING (named in §3 + the migration's commit):
// §1's "no schema rule" premise is false — migration 0004
// created exam_runs with date TEXT NOT NULL UNIQUE, and
// this harness's first run failed the new-pass INSERT with
// SQLITE_CONSTRAINT_UNIQUE against the real table.
// Migration 0024 (safe-rebuild, 0018's idiom) drops the
// constraint; the fixture D1 below is built from ALL
// migrations, 0024 included, and SV0 asserts the rebuilt
// DDL carries no UNIQUE.
//
// VEHICLES (named per §2): the server legs (SV) ride the
// estate wrangler LOCAL_DEV mold (harness-v434's pattern)
// — the REAL worker over HTTP against a fixture D1 built
// from all migrations, with direct D1 asserts through
// wrangler d1 execute --local. The fresh fixture DB
// carries no PIN state, so the exam block's pinGate passes
// exactly as it does for a user who has not set a PIN. The
// client legs (CL) ride the v444 exam mold: the client's
// VERBATIM exam functions in headless Chromium over a
// stubbed api()/post() seam with the real APP_CSS — the
// fixture is v444's, with the post stub extended by the
// /api/exam/runs route (it swaps the world to a fresh open
// run with no entries, as the real route + day re-read do).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v445 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8998;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v445");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v445-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHIPBASE = "release/v444-ship";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---- S1: the day read takes the latest run ----------------------
{
  const src = INDEX.slice(INDEX.indexOf("async function examToday"), INDEX.indexOf("function elapsedText"));
  ok(src.includes('SELECT * FROM exam_runs WHERE date=? ORDER BY id DESC'),
    "S1 examToday selects the day's run by latest id (ORDER BY id DESC)");
  ok(src.includes("if (!run) {") && src.includes("INSERT INTO exam_runs (date, state, opened_at) VALUES (?, 'open', ?) RETURNING id"),
    "S1 an open run is created only when NO run stands for the date at all");
  ok(src.includes("entries.results ?? []") && src.includes("run, prompts:"),
    "S1 the payload still carries the selected run and its entries (the return shape stands)");
}

// ---- S2: the new-pass route + the never-two-open guard ----------
{
  const gateAt = INDEX.indexOf('seg[1] === "exam" || seg[1] === "confession"');
  const routeAt = INDEX.indexOf('seg[2] === "runs" && !seg[3] && request.method === "POST"');
  ok(gateAt >= 0 && routeAt > gateAt,
    "S2 POST /api/exam/runs stands inside the exam block, below the block's pinGate application (the same guard shape as the entry/close routes)");
  ok(INDEX.includes('if (latest && latest.state === "open") return json({ ok: true, run: latest, created: false });'),
    "S2 an open latest run returns unchanged (created:false) — never two open runs for a date");
  ok(routeAt >= 0 && INDEX.slice(routeAt, routeAt + 1800).includes("ORDER BY id DESC") && INDEX.slice(routeAt, routeAt + 1800).includes("created: true }, 201)"),
    "S2 a closed latest (read by id DESC) starts a fresh open run — 201, created:true, the run carried in the answer");
  ok(INDEX.includes("UPDATE exam_runs SET state='closed', closed_at=? WHERE id=? AND state='open'"),
    "S2 the standing close route stands untouched");
}

// ---- S3: the client offers the new pass on a closed run ---------
{
  const examSrc = extractFn(CLIENT, "renderExaminationContent");
  const wireSrc = extractFn(CLIENT, "wireExamination");
  ok(examSrc.includes("if (closed) html += '<button class=\"btn\" id=\"run-new\"") && examSrc.includes("Start a new examination</button>") &&
     examSrc.indexOf('id="run-new"') > examSrc.indexOf('id="ex-gear"') && examSrc.indexOf('id="run-new"') < examSrc.indexOf('<div class="chips examchips">'),
    "S3 the closed paint emits ONE solid act in the head area (after the head row, before the chips): #run-new 'Start a new examination', only when closed");
  ok(wireSrc.includes("var rn = document.getElementById('run-new');") && wireSrc.includes("state.examCat = null; state.deepIdx = 0; post('/api/exam/runs', {}).then(renderExamination);"),
    "S3 the act's wiring resets examCat/deepIdx (a fresh pass on the focus), posts /api/exam/runs, and repaints");
}

// ---- S4: diff scope + pin housekeeping + bundle ------------------
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", SHIPBASE, "--", "app/worker/src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/index.ts"]),
    "S4 the worker-source diff vs the v444-ship base is client.ts + index.ts only (got: " + changed.join(", ") + ")");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v444-1";'),
    "S4 (housekeeping): the SW pin stands at ora-pro-nobis-v444-1 (Ship moves it)");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v445-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S4 the whole worker bundles clean (esbuild) — no syntax break anywhere");
}

// ---- S5: migration 0024 stands (the Implement finding) ----------
// §1's premise — no schema rule against a second run per
// date — is false: migration 0004 created exam_runs with
// date UNIQUE (this harness's first run proved it against
// the real table: the new-pass INSERT failed with
// SQLITE_CONSTRAINT_UNIQUE). 0024 is the safe-rebuild that
// drops it; the SV legs below run against a fixture D1
// built from ALL migrations, 0024 included.
{
  const migPath = path.join(APP, "migrations/0024_exam_runs_multiple_per_day.sql");
  ok(fs.existsSync(migPath), "S5 migration 0024 stands in the tree");
  const mig = fs.existsSync(migPath) ? fs.readFileSync(migPath, "utf8") : "";
  const newDdl = mig.slice(mig.indexOf("CREATE TABLE exam_runs_new"), mig.indexOf(");", mig.indexOf("CREATE TABLE exam_runs_new")));
  ok(newDdl.includes("date TEXT NOT NULL") && !/UNIQUE/i.test(newDdl) &&
     mig.includes("INSERT INTO exam_runs_new (id, date, state, opened_at, closed_at)") &&
     mig.includes("SELECT id, date, state, opened_at, closed_at FROM exam_runs") &&
     mig.includes("ALTER TABLE exam_runs_new RENAME TO exam_runs"),
    "S5 0024 rebuilds exam_runs with identical columns + PK, the UNIQUE on date dropped, every row copied across with its id (0018's idiom)");
}

// ---- wrangler helpers (the estate mold, harness-v434) -----------
function wranglerD1(args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function d1q(sql) {
  const out = wranglerD1(["--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results || [];
}
function applyMigrations() {
  const dir = path.join(APP, "migrations");
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(dir, f));
  fs.rmSync(PERSIST, { recursive: true, force: true });
  const f = path.join(TMPD, "migs.sql");
  fs.writeFileSync(f, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  wranglerD1(["--file", f]);
}
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
const runsToday = () => d1q(`SELECT id, state FROM exam_runs WHERE date='${TODAY}' ORDER BY id`);

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
  if (path === '/api/exam/runs') {
    // v445: the new-pass route, stubbed with its real
    // contract — on a closed world a fresh open run stands
    // (new id, no entries); the client's re-read of the day
    // then paints the new pass. On an open world the route
    // would return the standing run unchanged (the SV legs
    // prove that half against the real worker).
    if (WORLD.run.state === 'closed') { WORLD.run = { id: 8, date: '2026-11-15', state: 'open' }; WORLD.entries = []; return Promise.resolve({ ok: true, run: WORLD.run, created: true }); }
    return Promise.resolve({ ok: true, run: WORLD.run, created: false });
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
${PAGE_SRC}
function flush() { return new Promise(function (r) { setTimeout(r, 10); }).then(function () { return new Promise(function (r) { setTimeout(r, 10); }); }); }
function headText() { var el = view.querySelector('h2.sectionhead'); return el ? el.textContent : null; }
function chipEls() { return Array.prototype.slice.call(view.querySelectorAll('[data-examcat]')); }
var R = {};
// ---- CL1: a closed payload offers the new pass ------------------
WORLD = fixturePayload(); WORLD.run.state = 'closed';
state.deepIdx = 0; state.examCat = null; renderExaminationContent(); await flush();
var rn1 = document.getElementById('run-new');
R.cl1 = { stands: !!rn1, text: rn1 ? rn1.textContent : null, cls: rn1 ? rn1.className : null,
  chipsDisabled: chipEls().length > 0 && chipEls().every(function (c) { return c.disabled; }),
  closeStands: !!document.getElementById('run-close'),
  closedLine: view.textContent.indexOf('run is closed') >= 0,
  customField: !!document.getElementById('custom-text') };
// ---- CL2: an open payload carries no Start act ------------------
WORLD = fixturePayload();
state.deepIdx = 0; state.examCat = null; renderExaminationContent(); await flush();
R.cl2 = { startStands: !!document.getElementById('run-new'), closeStands: !!document.getElementById('run-close') };
// ---- CL3: the tap starts the fresh pass --------------------------
WORLD = fixturePayload(); WORLD.run.state = 'closed';
state.examCat = 'Commandment VII'; state.deepIdx = 1; renderExaminationContent(); await flush();
document.getElementById('run-new').click(); await flush();
R.cl3 = { posted: CALLS.posts.some(function (p) { return p.path === '/api/exam/runs'; }),
  examCat: state.examCat, deepIdx: state.deepIdx, head: headText(),
  startGone: !document.getElementById('run-new'), closeStands: !!document.getElementById('run-close'),
  chipsEnabled: chipEls().length > 0 && chipEls().every(function (c) { return !c.disabled; }),
  customField: !!document.getElementById('custom-text'),
  entryForm: !!view.querySelector('.entryform') };
return R;
`;

let browser = null;
try {
  // ---------- server legs: the real worker over HTTP -------------
  try { execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stood on the port */ }
  for (let i = 0; i < 20; i++) {
    try { await fetch(BASE + "/", { signal: AbortSignal.timeout(1000) }); await sleep(500); }
    catch { break; }
    if (i === 19) throw new Error("port never freed — a stale server stands");
  }
  applyMigrations();
  ok(d1q("SELECT name FROM sqlite_master WHERE type='table' AND name='exam_runs'").length === 1,
    "SV0 all migrations apply clean — exam_runs stands in the fixture D1");
  const ddlRows = d1q("SELECT sql FROM sqlite_master WHERE type='table' AND name='exam_runs'");
  ok(ddlRows.length === 1 && !/UNIQUE/i.test(ddlRows[0].sql || ""),
    "SV0 the rebuilt exam_runs carries NO unique constraint on date (migration 0024 applied) — a second run for a date can insert", (ddlRows[0] && ddlRows[0].sql || "").slice(0, 200));
  startApp();
  ok(await waitUp(), "SV0 app up on local wrangler (LOCAL_DEV)");

  const t1 = await req("GET", "/api/exam/today");
  ok(t1.status === 200 && t1.body.run && t1.body.run.state === "open",
    "SV1 (day read, no run stands): the payload carries a fresh OPEN run — created as today", JSON.stringify(t1.body.run || {}));
  ok((t1.body.prompts || []).length >= 20 && (t1.body.categories || []).includes("Precepts of the Church"),
    "SV1 the payload carries the seeded prompts and every category incl. the Precepts (the tree seed carries 23 prompts; production's fuller edited set does not ride the fixture — no leg depends on the count)", `prompts=${(t1.body.prompts || []).length}`);
  const run1 = t1.body.run.id;
  let rows = runsToday();
  ok(rows.length === 1 && rows[0].state === "open",
    "SV1 D1: exactly one run stands for today, open", JSON.stringify(rows));

  const e1 = await req("POST", "/api/exam/entries", { runId: run1, promptId: null, category: "Commandment I", text: "first pass entry" });
  ok(e1.status === 201, "SV2 an entry posts on the open first pass (201)");
  const c1 = await req("POST", `/api/exam/runs/${run1}/close`, {});
  ok(c1.status === 200 && c1.body.ok === true, "SV2 the standing close route closes the first pass");
  const e1b = await req("POST", "/api/exam/entries", { runId: run1, promptId: null, category: "Commandment I", text: "too late" });
  ok(e1b.status === 409, "SV2 the closed run refuses new entries (409) — the standing guard stands");

  const n1 = await req("POST", "/api/exam/runs", {});
  ok(n1.status === 201 && n1.body.created === true && n1.body.run && n1.body.run.state === "open" && n1.body.run.id !== run1,
    "SV3 (new pass, latest closed): POST /api/exam/runs starts a fresh OPEN run — 201, created:true, a new id", JSON.stringify(n1.body));
  const run2 = n1.body.run && n1.body.run.id;
  rows = runsToday();
  ok(rows.length === 2 && rows.filter((r) => r.state === "open").length === 1,
    "SV3 D1: two runs stand for today, exactly one open", JSON.stringify(rows));

  if (run2) {
  const e2 = await req("POST", "/api/exam/entries", { runId: run2, promptId: null, category: "Commandment I", text: "second pass entry" });
  ok(e2.status === 201, "SV4 an entry posts on the second pass (201)");
  const t2 = await req("GET", "/api/exam/today");
  ok(t2.body.run && t2.body.run.id === run2 && t2.body.run.state === "open",
    "SV4 (day read, closed + newer open stand): the payload carries the OPEN latest run");
  const texts2 = (t2.body.entries || []).map((e) => e.text);
  ok(texts2.includes("second pass entry") && !texts2.includes("first pass entry"),
    "SV4 the payload carries the latest run's entries only — the first pass's entries do not re-show in the new pass", texts2.join(" | "));

  const n2 = await req("POST", "/api/exam/runs", {});
  ok(n2.status === 200 && n2.body.created === false && n2.body.run && n2.body.run.id === run2,
    "SV5 (new pass, latest open): the standing run returns unchanged — 200, created:false", JSON.stringify(n2.body));
  rows = runsToday();
  ok(rows.length === 2 && rows.filter((r) => r.state === "open").length === 1,
    "SV5 D1: still two runs for today, exactly one open — never two open runs", JSON.stringify(rows));

  const c2 = await req("POST", `/api/exam/runs/${run2}/close`, {});
  ok(c2.status === 200 && c2.body.ok === true, "SV6 the second pass closes");
  const n3 = await req("POST", "/api/exam/runs", {});
  const n4 = await req("POST", "/api/exam/runs", {});
  ok(n3.body.created === true && n4.body.created === false && n4.body.run && n3.body.run && n4.body.run.id === n3.body.run.id,
    "SV6 two new-pass POSTs in a row after a close yield exactly ONE fresh run (the second returns it, created:false)");
  rows = runsToday();
  ok(rows.length === 3 && rows.filter((r) => r.state === "open").length === 1,
    "SV6 D1: three runs stand for today, exactly one open", JSON.stringify(rows));

  const cf = await req("GET", "/api/confession");
  const prepTexts = [];
  (cf.body.prep || []).forEach((g) => (g.entries || []).forEach((e) => prepTexts.push(e.text)));
  ok(prepTexts.includes("first pass entry") && prepTexts.includes("second pass entry"),
    "SV7 Confession preparation carries BOTH passes' entries — the run-agnostic read spans the day's runs", prepTexts.join(" | "));
  } else {
    ok(false, "SV4–SV7 skipped: no second run stands — SV3's failure governs");
  }

  // ---------- client legs: the v444 exam mold in Chromium --------
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="view"></div><audio id="audio"></audio></body></html>`);
  const R = await page.evaluate("(async () => {\n" + FIXTURE + "\n})()");
  ok(R.cl1.stands && R.cl1.text === "Start a new examination" && R.cl1.cls === "btn" &&
     R.cl1.chipsDisabled && !R.cl1.closeStands && R.cl1.closedLine && !R.cl1.customField,
    "CL1 (closed payload): #run-new stands in the solid btn dress, labeled 'Start a new examination'; the closed read stands whole (chips disabled, no Close act, the closed line stands, no entry field)", JSON.stringify(R.cl1));
  ok(!R.cl2.startStands && R.cl2.closeStands,
    "CL2 (open payload): no Start act stands; the Close act stands as before", JSON.stringify(R.cl2));
  ok(R.cl3.posted && R.cl3.examCat === null && R.cl3.deepIdx === 0 && R.cl3.head === "Commandment IV" &&
     R.cl3.startGone && R.cl3.closeStands && R.cl3.chipsEnabled && R.cl3.customField && R.cl3.entryForm,
    "CL3 (the tap): posts /api/exam/runs, resets examCat/deepIdx, and repaints OPEN on tonight's focus (heading names the focus; chips + fields enabled; the Close act stands; the Start act is gone)", JSON.stringify(R.cl3));
  ok(pageErrors.length === 0, "browser: zero page errors" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
  await browser.close(); browser = null;
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  procs.forEach((p) => { try { process.kill(-p.pid, "SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch { /* noop */ } } });
}
console.log(`# harness-v445: ${n} ok / ${fails} not-ok`);
process.exit(fails ? 1 : 0);
