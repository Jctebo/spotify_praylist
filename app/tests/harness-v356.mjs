#!/usr/bin/env node
// harness-v356 — the v356 gate (Plan §2.9 legs L1–L11): the
// Confession PIN. Server-verified gate withholding the exam +
// confession families' bytes until a token stands; PBKDF2-hashed
// PIN + recovery code in the singleton pin_state; one shared
// attempt counter with the 30·60·120·240·300 wait ladder; recovery
// rolls the credential generation and keeps the content; the
// client token lives in memory only (reload re-locks). Fixture
// posture: the standing estate mold — local wrangler, test D1
// fresh per run, the FULL migration sequence through 0015 (0014
// applies in filename order in the gap v352's 0015 left), PIN
// values are fixtures on that test D1 only. Tallies read from the
// COMPLETE log.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = process.env.OPN_APP ? path.resolve(process.env.OPN_APP) : path.dirname(fileURLToPath(import.meta.url)) + "/..";
const FORK = path.resolve(APP, "..");
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v356 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997, FEED_PORT = 8957;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v356");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v356-"));

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chicagoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const p = {}; for (const x of parts) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
const TODAY = chicagoToday();

const api = async (base, method, p, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  let body;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.pinToken) headers["x-pin-token"] = opts.pinToken;
  if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
  if (opts.raw !== undefined) body = opts.raw;
  const res = await fetch(base + p, { method, headers, body, redirect: "manual" });
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, text, headers: res.headers };
};
function wranglerD1File(persist, file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", persist, "--file", file],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
}
function d1Query(persist, sql) {
  const out = execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", persist, "--command", sql, "--json"],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
  const arr = JSON.parse(out.slice(out.indexOf("[")));
  return (arr[0] && arr[0].results) || [];
}
function d1Exec(persist, sql) {
  const f = path.join(TMPD, `one-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, sql);
  wranglerD1File(persist, f);
}
function migFiles(upto = null) {
  const dir = path.join(APP, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()
    .filter((f) => !upto || f <= upto).map((f) => path.join(dir, f));
}
function applyFiles(persist, files, extraSql = "") {
  fs.rmSync(persist, { recursive: true, force: true });
  const parts = files.map((f) => fs.readFileSync(f, "utf8"));
  if (extraSql) parts.push(extraSql);
  const f = path.join(TMPD, `mig-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1File(persist, f);
}
// The seed the exam/confession flows need: the 35 prayer items +
// the 11-intention pool (the estate mold, from harness-v305) — the
// migrations themselves seed the Lasance prompts + confession guide.
const ITEMS = [
  [1, "Morning", "Invitatory", "prayer", 3], [2, "Morning", "Morning Prayer", "prayer", 4],
  [3, "Morning", "Morning Prayer (Liturgy of the Hours)", "prayer", 5], [4, "Morning", "Daily Rosary", "prayer", 6],
  [5, "Morning", "Bible in a Year", "prayer", 7], [6, "Morning", "Morning Marian Antiphon", "prayer", 8],
  [8, "Midmorning", "Midmorning (Terce)", "prayer", 5], [9, "Midmorning", "Daily Gospel Exegesis", "prayer", 3],
  [10, "Midday", "Midday Prayer", "prayer", 4], [11, "Midmorning", "Novenas", "prayer", 4],
  [12, "Midday", "Midday Marian Antiphon", "prayer", 3], [14, "Afternoon", "None (Liturgy of the Hours)", "prayer", 7],
  [15, "Afternoon", "Saint of the Day", "prayer", 5], [16, "Afternoon", "Auxilium Christianorum", "prayer", 6],
  [17, "Evening", "Office of Readings", "prayer", 2], [20, "Evening", "Vespers", "prayer", 3],
  [21, "Night", "Compline", "prayer", 2], [23, "Morning", "Workout", "activity", 1],
  [24, "Morning", "Shower", "activity", 2], [25, "Midmorning", "Morning task", "activity", 1],
  [26, "Midmorning", "Socializing", "activity", 2], [27, "Midday", "Midday task", "activity", 1],
  [28, "Midday", "Socializing", "activity", 2], [29, "Morning", "Mass", "prayer", 9],
  [30, "Afternoon", "Afternoon task", "activity", 1], [31, "Afternoon", "Socializing", "activity", 2],
  [32, "Afternoon", "Additional spiritual prayer", "prayer", 3], [33, "Evening", "Evening task", "activity", 1],
  [34, "Evening", "Family quality time", "activity", 4], [35, "Evening", "Muse Feed", "activity", 5],
  [38, "Night", "Sleep", "activity", 3], [39, "Evening", "Next day prep", "activity", 6],
  [40, "Evening", "The AI Signal", "activity", 7], [41, "Night", "Daily Reflection", "prayer", 1],
  [42, "Afternoon", "Afternoon Marian Antiphon", "prayer", 4],
];
function seedSql() {
  const lines = [];
  for (const [id, block, name, kind, sort] of ITEMS) {
    lines.push(`INSERT INTO prayer_items (id, block, name, sub, kind, color, opening_prayer, closing_prayer, enabled, sort) VALUES (${id}, '${block}', '${name.replace(/'/g, "''")}', 'synthetic sub', '${kind}', '', 'Synthetic opening.', 'Synthetic closing.', 1, ${sort});`);
  }
  for (let i = 1; i <= 3; i++) lines.push(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES (${100 + i}, 'Synthetic intention H${i}', 'H', 'active', '2026-11-01T00:00:00.000Z');`);
  for (let i = 1; i <= 7; i++) lines.push(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES (${110 + i}, 'Synthetic intention M${i}', 'M', 'active', '2026-11-01T00:00:00.000Z');`);
  lines.push(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES (120, 'Synthetic intention L1', 'L', 'active', '2026-11-01T00:00:00.000Z');`);
  return lines.join("\n");
}
// A feed server that 404s everything: the externals resolution
// fails fast and the player/day payload stands with missing slots —
// all L11 needs of it.
const feedServer = http.createServer((req, res) => { res.writeHead(404); res.end(); });

const procs = [];
function startApp() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1",
    "--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`,
    "--var", `EXT_DGE_FEED_URL:${FEED}/dge.xml`, "--var", `EXT_SAINT_FEED_URL:${FEED}/saint.xml`,
    "--var", `EXT_USCCB_FEED_URL:${FEED}/usccb.xml`, "--var", `EXT_TVMASS_FEED_URL:${FEED}/tvmass.xml`,
    "--var", `EXT_FRMIKE_FEED_URL:${FEED}/frmike.xml`, "--var", `EXT_BARRON_FEED_URL:${FEED}/barron.xml`];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}

let browser = null;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v356-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "worker bundles clean (esbuild)");

  await new Promise((r) => feedServer.listen(FEED_PORT, "127.0.0.1", r));
  applyFiles(PERSIST, migFiles(), seedSql());
  startApp();
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
  const tables = d1Query(PERSIST, "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pin_state','pin_tokens') ORDER BY name").map((r) => r.name);
  ok(tables.join(",") === "pin_state,pin_tokens", "migration 0014 stands on the test D1 (pin_state + pin_tokens)");

  // ---------- L1 — no-PIN-set is today ----------
  let r = await api(BASE, "GET", "/api/pin/state");
  ok(r.status === 200 && r.body.pinSet === false && r.body.retryAfterSeconds === 0, "L1: /api/pin/state answers pinSet:false with no PIN set");
  r = await api(BASE, "GET", "/api/exam/today");
  ok(r.status === 200 && r.body.run.state === "open" && r.body.prompts.length === 23, "L1: examination opens tonight's run with the 23 seeded prompts, no PIN");
  const runId = r.body.run.id;
  const ivPrompt = r.body.prompts.find((p) => p.category === "Commandment IV");
  r = await api(BASE, "POST", "/api/exam/entries", { json: { runId, promptId: ivPrompt.id, text: "Synthetic entry one" } });
  ok(r.status === 201, "L1: entry saves with no PIN set");
  r = await api(BASE, "POST", "/api/exam/entries", { json: { runId, category: "Anything else", text: "Synthetic entry two" } });
  ok(r.status === 201, "L1: free entry saves with no PIN set");
  r = await api(BASE, "GET", "/api/confession");
  ok(r.status === 200 && r.body.guide.length === 5 && r.body.prep.length === 2, "L1: confession payload open with no PIN (guide + the two entries in prep)");
  r = await api(BASE, "POST", "/api/confession/penance", { json: { text: "x" } });
  ok(r.status === 400, "L1: writes run their normal handlers with no PIN (penance without a confession = the standing 400, not a gate refusal)");

  // ---------- Browser: Settings set flow + L7 session + L10 pad UX ----------
  browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector(".blockhead", { timeout: 20000 });
  await page.click("#gearbtn");
  await page.waitForSelector("#pin-section .card", { timeout: 15000 });
  const noPinText = await page.locator("#pin-section").innerText();
  ok(noPinText.includes("No PIN is set"), "L10: Settings PIN section shows the no-PIN state (decision 6)");
  await page.click("#pin-set-open");
  await page.waitForSelector(".pinsetsheet", { timeout: 10000 });
  await page.fill("#ps-pin1", "135790");
  await page.fill("#ps-pin2", "135791");
  await page.click("#ps-save");
  await page.waitForFunction(() => document.querySelector("#ps-msg") && document.querySelector("#ps-msg").textContent.includes("do not match"), null, { timeout: 10000 });
  ok(true, "L10: set flow refuses a mismatched confirm in the sheet");
  await page.fill("#ps-pin2", "135790");
  await page.click("#ps-save");
  await page.waitForSelector(".recoverysheet .recoverycode", { timeout: 15000 });
  const codeText = (await page.locator(".recoverysheet .recoverycode").innerText()).trim();
  ok(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(codeText), "L10: the recovery sheet shows the grouped code once, at set (format XXXX-XXXX-XXXX)");
  ok(await page.locator(".recoverysheet #rec-copy").count() === 1, "L10: the recovery sheet carries a Copy button");
  const BROWSER_PIN = "135790";
  const CODE0 = codeText;
  await page.click("#rec-done");
  await page.waitForSelector("#pin-section .card", { timeout: 15000 });
  const unlockedText = await page.locator("#pin-section").innerText();
  ok(unlockedText.includes("Change PIN") && unlockedText.includes("Remove PIN"), "L10: after set, Settings offers Change + Remove while unlocked");

  // L7: within one session both gated tabs stand open on the set token.
  await page.click('[data-tab="examination"]');
  await page.waitForSelector(".prompt", { timeout: 15000 });
  ok(true, "L7: Examination renders in-session after set (token stands)");
  await page.click('[data-tab="confession"]');
  await page.waitForSelector("text=Act of Contrition", { timeout: 15000 });
  ok(true, "L7: Confession renders in the same session — one unlock opens both (decision 2)");
  const storageDump = await page.evaluate(() => {
    const dump = [];
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) { const k = store.key(i); dump.push(k + "=" + store.getItem(k)); }
    }
    return dump.join("\n");
  });
  ok(!/[0-9a-f]{64}/.test(storageDump) && !/pin/i.test(storageDump), "L7: the token string stands in NEITHER localStorage NOR sessionStorage");

  // L7: a full reload re-locks (memory-only residence).
  await page.reload({ waitUntil: "networkidle" });
  await page.click('[data-tab="examination"]');
  await page.waitForSelector("#pingate-card", { timeout: 15000 });
  ok(true, "L7: after a page reload the gated tab shows the gate again (memory-only token gone)");

  // L10: the pad — accent token, wrong-entry shake + attempts line.
  const accent = await page.evaluate(() => {
    const b = document.querySelector("[data-pinkey='5']");
    const cs = getComputedStyle(b);
    const root = getComputedStyle(document.documentElement);
    return { borderUsesAccent: cs.borderColor !== "", accent: root.getPropertyValue("--accent").trim(), gold: root.getPropertyValue("--gold").trim() };
  });
  ok(accent.accent === accent.gold && !!accent.accent, `L10: the gate reads the standing accent token (--accent = --gold today: ${accent.accent})`);
  const enterPin = async (pin) => {
    for (const d of pin) await page.click(`[data-pinkey='${d}']`);
    await page.click("#pin-unlock");
  };
  await enterPin("000000");
  await page.waitForFunction(() => document.querySelector("#pinmsg") && document.querySelector("#pinmsg").textContent.includes("4 attempts"), null, { timeout: 10000 });
  ok(await page.locator("#pingate-card.shake").count() === 1, "L10: a wrong entry shakes the gate card");
  ok(true, "L10: the wrong-entry line reads the attempts remaining (4 after the first failure)");
  // Four more wrong entries engage the wait: pad disabled + countdown.
  for (let i = 0; i < 4; i++) {
    await enterPin("000000");
    // Wait until the verify response has landed and cleared the
    // entry (dots all empty) before typing the next attempt — a
    // late response clearing the entry would otherwise eat the
    // next attempt's digits.
    await page.waitForFunction(() => !document.querySelector("#pindots .pindot.on"), null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const m = document.querySelector("#pinmsg");
      return m && (m.textContent.includes("attempt") || m.textContent.includes("try again in"));
    }, null, { timeout: 10000 });
  }
  await page.waitForFunction(() => document.querySelector("#pinmsg") && document.querySelector("#pinmsg").textContent.includes("try again in"), null, { timeout: 10000 });
  const unlockDisabled = await page.locator("#pin-unlock").isDisabled();
  const padDisabled = await page.locator("[data-pinkey='5']").isDisabled();
  ok(unlockDisabled && padDisabled, "L10: in the wait the pad and Unlock disable with a counting-down line");
  // The Forgot line swaps the pad for the recovery form.
  await page.click("#pin-forgot");
  await page.waitForSelector("#rec-code", { timeout: 10000 });
  ok(true, "L10: Forgot PIN swaps the pad for the recovery form");
  ok(pageErrors.length === 0, `browser: zero page errors${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
  await browser.close(); browser = null;

  const PIN = BROWSER_PIN;
  // ---------- L2 — set is one-shot; the row holds hashes only ----------
  r = await api(BASE, "POST", "/api/pin/set", { json: { pin: "246810" } });
  ok(r.status === 409, "L2: a second set is refused 409 (pin already set)");
  r = await api(BASE, "POST", "/api/pin/set", { json: { pin: "12" } });
  ok(r.status === 400 || r.status === 409, "L2: a short PIN never creates a row (400 format / 409 already-set)");
  const stateRows = d1Query(PERSIST, "SELECT * FROM pin_state");
  ok(stateRows.length === 1, "L2: exactly one pin_state row (the singleton)");
  const rowText = JSON.stringify(stateRows[0]);
  ok(!rowText.includes(PIN) && !rowText.includes(CODE0) && !rowText.includes(CODE0.replace(/-/g, "")), "L2: the pin_state row contains NEITHER the PIN NOR the recovery code in plaintext");
  ok(stateRows[0].pin_iterations === 100000 && stateRows[0].recovery_iterations === 100000, "L2: both credentials stored at 100,000 PBKDF2 iterations (the runtime accepted Plan's value)");

  // ---------- L3 — the gate withholds bytes ----------
  const runsBefore = d1Query(PERSIST, "SELECT COUNT(*) AS c FROM exam_runs")[0].c;
  r = await api(BASE, "GET", "/api/exam/today");
  ok(r.status === 403 && r.body.error === "pin_required" && !r.text.includes("Synthetic entry"), "L3: GET /api/exam/today refuses 403 pin_required and the body carries NONE of the seeded entry text");
  const runsAfter = d1Query(PERSIST, "SELECT COUNT(*) AS c FROM exam_runs")[0].c;
  ok(runsAfter === runsBefore, "L3: the refused GET created no exam_runs row (refusal before the handler)");
  r = await api(BASE, "GET", "/api/confession");
  ok(r.status === 403 && r.body.error === "pin_required" && !r.text.includes("Synthetic"), "L3: GET /api/confession refuses 403 pin_required with no content bytes");
  r = await api(BASE, "POST", "/api/exam/entries", { json: { runId, category: "Anything else", text: "gatecrash" } });
  ok(r.status === 403, "L3: POST entries without a token refuses 403");
  r = await api(BASE, "POST", "/api/confession/made", { json: { date: TODAY, note: "gatecrash" } });
  ok(r.status === 403, "L3: POST confession/made without a token refuses 403");
  r = await api(BASE, "PUT", "/api/exam/prompts", { json: { prompts: [{ id: 1, text: "gatecrash" }] } });
  ok(r.status === 403, "L3: PUT prompts without a token refuses 403");
  r = await api(BASE, "PUT", "/api/confession/guide", { json: { steps: [{ step_no: 1, title: "x", body: "y" }] } });
  ok(r.status === 403, "L3: PUT guide without a token refuses 403");
  const entriesNow = d1Query(PERSIST, "SELECT COUNT(*) AS c FROM exam_entries")[0].c;
  const confsNow = d1Query(PERSIST, "SELECT COUNT(*) AS c FROM confessions")[0].c;
  ok(entriesNow === 2 && confsNow === 0, "L3: the refused writes changed nothing in D1 (entries still 2, confessions still 0)");

  // ---------- L4 — wrong attempts + the wait ----------
  d1Exec(PERSIST, "UPDATE pin_state SET failed_attempts=0, next_allowed_at=NULL");
  const remaining = [];
  for (let i = 0; i < 4; i++) {
    r = await api(BASE, "POST", "/api/pin/verify", { json: { pin: "000000" } });
    remaining.push(r.body.attemptsRemaining);
    if (r.status !== 401) break;
  }
  ok(JSON.stringify(remaining) === "[4,3,2,1]", `L4: four wrong verifies answer 401 with attemptsRemaining 4·3·2·1 (got ${remaining.join("·")})`);
  const t0 = Date.now();
  r = await api(BASE, "POST", "/api/pin/verify", { json: { pin: "000000" } });
  ok(r.status === 401 && Math.abs((r.body.retryAfterSeconds ?? 0) - 30) <= 2, `L4: the 5th failure engages a 30s wait (retryAfterSeconds=${r.body.retryAfterSeconds})`);
  r = await api(BASE, "POST", "/api/pin/verify", { json: { pin: PIN } });
  ok(r.status === 429 && (r.body.retryAfterSeconds ?? 0) > 0, "L4: even the CORRECT PIN during the wait answers 429 — the wait is real");
  const counterDuringWait = d1Query(PERSIST, "SELECT failed_attempts FROM pin_state")[0].failed_attempts;
  ok(counterDuringWait === 5, "L4: the during-wait attempt was NOT evaluated and NOT counted (counter still 5)");
  d1Exec(PERSIST, "UPDATE pin_state SET next_allowed_at='2000-01-01T00:00:00.000Z'");
  r = await api(BASE, "POST", "/api/pin/verify", { json: { pin: PIN } });
  ok(r.status === 200 && typeof r.body.token === "string" && r.body.token.length === 64, "L4→L5: after the wait is time-shifted past, the correct PIN verifies and issues a token");
  const T1 = r.body.token;
  const counterAfterSuccess = d1Query(PERSIST, "SELECT failed_attempts, next_allowed_at FROM pin_state")[0];
  ok(counterAfterSuccess.failed_attempts === 0 && !counterAfterSuccess.next_allowed_at, "L4: a successful verify resets the counter and clears the wait");

  // ---------- L5 — one unlock opens both ----------
  r = await api(BASE, "GET", "/api/exam/today", { pinToken: T1 });
  ok(r.status === 200 && JSON.stringify(r.body).includes("Synthetic entry one"), "L5: the verify token opens Examination (content flows)");
  r = await api(BASE, "GET", "/api/confession", { pinToken: T1 });
  ok(r.status === 200 && r.body.guide.length === 5, "L5: the SAME token opens Confession without a second verify (decision 2)");
  r = await api(BASE, "POST", "/api/confession/penance", { pinToken: T1, json: { text: "x" } });
  ok(r.status === 400, "L5: writes ride the token too (penance answers its standing 400, not a gate refusal)");

  // ---------- L6 — token expiry ----------
  d1Exec(PERSIST, "UPDATE pin_tokens SET expires_at='2000-01-01T00:30:00.000Z'");
  const tokenRowsBefore = d1Query(PERSIST, "SELECT COUNT(*) AS c FROM pin_tokens")[0].c;
  r = await api(BASE, "GET", "/api/exam/today", { pinToken: T1 });
  ok(r.status === 403 && r.body.error === "pin_required", "L6: an expired token refuses 403 pin_required");
  const tokenRows = d1Query(PERSIST, "SELECT COUNT(*) AS c FROM pin_tokens")[0].c;
  ok(tokenRows === tokenRowsBefore - 1, `L6: the expired token row is deleted on lookup (rows ${tokenRowsBefore} -> ${tokenRows}; other rows are untouched until their own lookup)`);

  // ---------- L8 — recovery rolls the generation, content kept ----------
  d1Exec(PERSIST, "UPDATE pin_state SET failed_attempts=0, next_allowed_at=NULL");
  r = await api(BASE, "POST", "/api/pin/recover", { json: { code: "0000-0000-0000", newPin: "975310" } });
  ok(r.status === 401 && r.body.attemptsRemaining === 4, "L8: a wrong recovery code answers 401 on the shared counter (attemptsRemaining 4)");
  r = await api(BASE, "POST", "/api/pin/verify", { json: { pin: "000000" } });
  ok(r.status === 401 && r.body.attemptsRemaining === 3, "L8: a wrong PIN next continues the SAME count (3) — one counter for both routes");
  d1Exec(PERSIST, "UPDATE pin_state SET failed_attempts=0, next_allowed_at=NULL");
  r = await api(BASE, "POST", "/api/pin/recover", { json: { code: CODE0.toLowerCase(), newPin: "975310" } });
  ok(r.status === 200 && /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(r.body.recoveryCode || "") && r.body.recoveryCode !== CODE0, "L8: the correct code (lowercase, normalized) sets the new PIN and returns a NEW recovery code");
  const CODE1 = r.body.recoveryCode;
  const T2 = r.body.token;
  r = await api(BASE, "POST", "/api/pin/verify", { json: { pin: PIN } });
  ok(r.status === 401, "L8: the OLD PIN now fails verify");
  d1Exec(PERSIST, "UPDATE pin_state SET failed_attempts=0, next_allowed_at=NULL");
  r = await api(BASE, "POST", "/api/pin/recover", { json: { code: CODE0, newPin: "111111" } });
  ok(r.status === 401, "L8: the OLD recovery code is dead with its generation");
  r = await api(BASE, "GET", "/api/exam/today", { pinToken: T2 });
  ok(r.status === 200 && JSON.stringify(r.body).includes("Synthetic entry one") && JSON.stringify(r.body).includes("Synthetic entry two"), "L8: the pre-set fixture entries stand intact after recovery (content kept, decision 4)");
  r = await api(BASE, "GET", "/api/confession", { pinToken: T2 });
  ok(r.status === 200 && r.body.prep.length === 2, "L8: the confession prep stands intact after recovery");

  // ---------- L9 — change + remove ----------
  d1Exec(PERSIST, "UPDATE pin_state SET failed_attempts=0, next_allowed_at=NULL");
  r = await api(BASE, "POST", "/api/pin/change", { json: { pin: "864200" } });
  ok(r.status === 403 && r.body.error === "pin_required", "L9: change without a token refuses 403 pin_required");
  r = await api(BASE, "POST", "/api/pin/change", { pinToken: T2, json: { pin: "864200" } });
  ok(r.status === 200 && /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(r.body.recoveryCode || "") && r.body.recoveryCode !== CODE1, "L9: change with a token rolls the generation — a NEW recovery code shows");
  const T3 = r.body.token;
  r = await api(BASE, "GET", "/api/exam/today", { pinToken: T2 });
  ok(r.status === 403, "L9: the pre-change token is revoked by the change (403)");
  r = await api(BASE, "POST", "/api/pin/verify", { json: { pin: "975310" } });
  ok(r.status === 401, "L9: the pre-change PIN is dead");
  d1Exec(PERSIST, "UPDATE pin_state SET failed_attempts=0, next_allowed_at=NULL");
  r = await api(BASE, "POST", "/api/pin/remove", { json: {} });
  ok(r.status === 403, "L9: remove without a token refuses 403");
  r = await api(BASE, "POST", "/api/pin/remove", { pinToken: T3, json: {} });
  ok(r.status === 200 && r.body.ok === true, "L9: remove with a token succeeds");
  const afterRemove = d1Query(PERSIST, "SELECT (SELECT COUNT(*) FROM pin_state) AS s, (SELECT COUNT(*) FROM pin_tokens) AS t")[0];
  ok(afterRemove.s === 0 && afterRemove.t === 0, "L9: remove empties pin_state and pin_tokens");
  r = await api(BASE, "GET", "/api/exam/today");
  ok(r.status === 200, "L9→L1: after remove both families stand open with no header — back to the no-PIN world");
  r = await api(BASE, "GET", "/api/pin/state");
  ok(r.status === 200 && r.body.pinSet === false, "L9: /api/pin/state reads pinSet:false after remove");

  // ---------- L11 — the machine flows never feel the gate ----------
  r = await api(BASE, "POST", "/api/pin/set", { json: { pin: "112233" } });
  ok(r.status === 201, "L11 setup: a fresh PIN stands set and locked (no token used from here)");
  r = await api(BASE, "GET", `/api/agent/prayer/day?date=${TODAY}`, { token: TOKEN });
  ok(r.status === 200 && Array.isArray(r.body.blocks), "L11: agent door prayer/day answers with a PIN set + locked, exactly as with no PIN");
  r = await api(BASE, "GET", "/api/agent/prayer/intros", { token: TOKEN });
  ok(r.status === 200 && r.body.ok === true, "L11: agent door prayer/intros answers with a PIN set + locked");
  r = await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN });
  ok(r.status === 200 && Array.isArray(r.body.sources), "L11: agent door player/settings answers with a PIN set + locked");
  r = await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN });
  ok(r.status === 200 && Array.isArray(r.body.blocks), "L11: agent door player/day answers with a PIN set + locked");
  r = await api(BASE, "GET", "/api/pin/state");
  ok(r.status === 200 && r.body.pinSet === true, "L11: the PIN still stands after the door reads (the gate never reaches the door)");

  // ---------- Shell pins ----------
  const sw = await api(BASE, "GET", "/sw.js");
  ok(sw.text.includes("ora-pro-nobis-v356-1"), "SW pin reads ora-pro-nobis-v356-1");
  const appJs = (await api(BASE, "GET", "/app.js")).text;
  let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
  ok(parses, "served /app.js parses (vm.Script)");
  const storageWrites = appJs.match(/(?:localStorage|sessionStorage)\.setItem\([^)]*\)/g) || [];
  ok(storageWrites.every((w) => !/pin/i.test(w)), "the served client writes no PIN/token value to any storage (every setItem call is pin-free)");
} catch (e) {
  n++; fails++; console.log(`not ok ${n} - harness crashed: ${e.stack || e.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const c of procs) c.kill("SIGTERM");
  feedServer.close();
  await sleep(500);
}
console.log(`TALLY: ${n - fails} ok / ${fails} FAIL (${n} checks)`);
process.exit(fails ? 1 : 0);
