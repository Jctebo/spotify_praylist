#!/usr/bin/env node
// harness-v470 — Prayer book favorites, server-side (Plan
// §2.6). Scope record 1820 · Plan record 1821. Molds:
// harness-v462 (statics + scratch-D1 SQL + the Chromium
// boot with fetch stubbed by path) and harness-v413 (the
// W legs: local wrangler + a fixture D1 through every
// migration, LOCAL_DEV session routes, the Bearer door).
// Legs:
// (ST) migration 0028 stands last with 0021's DDL shape ·
// index.ts carries the session GET/PUT + the door GET ·
// the cooked client carries the favorites path + the
// load/sync pair · the whole cooked APP_JS parses (the
// v439 gate) · the single-backslash census stands at 0 ·
// the worker bundles clean · the SW pin stands untouched
// at ora-pro-nobis-v466-1 on this base (Ship moves it).
// (SQ) a scratch D1 through migration 0028: the favorites
// table's columns + slug PK · the book seed unregressed.
// (W) the real Worker on the fixture D1: the session GET
// on an empty store · the PUT round-trip (dedupe, stored
// order, sort_order rows) · the session GET back · the
// door GET · a bad-slug PUT 400s and writes nothing · no
// door write route stands · an empty PUT clears.
// (B) Chromium against a faithful favorites stub whose
// store stands on the harness server (so it survives page
// reloads, as the real server does): B1 favorite two →
// wipe localStorage whole → reload → the Favorites
// section stands from the server · B2 the carry-up runs
// once and is idempotent · B3 the server wins over a
// divergent mirror · B4 the favorites routes dead → the
// book paints from the mirror, toggles land locally, no
// page error.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import os from "node:os";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v470 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BOOK = JSON.parse(fs.readFileSync(path.join(APP, "tests/fixtures/prayer-book-v462.json"), "utf8"));
const BOOK_SLUGS = new Set(BOOK.groups.flatMap((g) => g.prayers.map((p) => p.slug)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };

const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
const COOKED = new Function("return `" + RAW_JS + "`")();

/* ---------------- statics ---------------- */
{
  const migDir = path.join(APP, "migrations");
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  ok(files[files.length - 1] === "0028_prayer_book_favorites.sql", "ST1 migration 0028 is the last migration", files[files.length - 1]);
  const ddl = fs.readFileSync(path.join(migDir, "0028_prayer_book_favorites.sql"), "utf8");
  ok(/CREATE TABLE IF NOT EXISTS prayer_book_favorites/.test(ddl) && /slug TEXT PRIMARY KEY/.test(ddl)
    && /sort_order INTEGER NOT NULL/.test(ddl) && /updated_at TEXT NOT NULL/.test(ddl),
    "ST1 migration 0028 creates prayer_book_favorites in 0021's shape (slug PK · sort_order · updated_at)");
  ok(/seg\[2\] === "book" && seg\[3\] === "favorites" && request\.method === "GET"/.test(INDEX)
    && /seg\[2\] === "book" && seg\[3\] === "favorites" && request\.method === "PUT"/.test(INDEX),
    "ST2 index.ts carries the session favorites GET + PUT");
  ok(/seg\[2\] === "prayer" && seg\[3\] === "book" && seg\[4\] === "favorites" && request\.method === "GET"/.test(INDEX),
    "ST2 index.ts carries the door favorites GET (read-only mirror)");
  ok((COOKED.split("/api/prayer/book/favorites").length - 1) === 2
    && COOKED.includes("function bookFavsLoad") && COOKED.includes("function bookFavsSync") && COOKED.includes("function bookFavsList"),
    "ST3 the cooked client carries the favorites path (load GET + sync PUT) and the working-copy pair");
  let parseErr = null;
  try { new vm.Script(COOKED); } catch (e) { parseErr = e; }
  ok(!parseErr, "ST4 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
  const VALID = new Set(["'", '"', "`", "$", "\\", "b", "f", "n", "r", "t", "v", "0", "\n"]);
  let census = 0;
  for (let i = 0; i < RAW_JS.length; i++) {
    if (RAW_JS[i] !== "\\") continue;
    const nx = RAW_JS[i + 1];
    if (nx === undefined) break;
    if (nx === "\\") { i++; continue; }
    if (nx === "u" && (/^[0-9a-fA-F]{4}$/.test(RAW_JS.slice(i + 2, i + 6)) || RAW_JS[i + 2] === "{")) { i += 5; continue; }
    if (nx === "x" && /^[0-9a-fA-F]{2}$/.test(RAW_JS.slice(i + 2, i + 4))) { i += 3; continue; }
    if (VALID.has(nx)) { i++; continue; }
    census++; i++;
  }
  ok(census === 0, "ST4 the single-backslash census inside APP_JS stands at 0", "census=" + census);
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v470-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "ST5 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v466-1";'), "ST5 (housekeeping): the SW pin stands at ora-pro-nobis-v466-1 on this base (Ship moves it)");
}

/* ---------------- SQL legs ---------------- */
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v470-"));
const DB = path.join(TMPD, "scratch.db");
{
  const migDir = path.join(APP, "migrations");
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) execFileSync("sqlite3", [DB], { input: fs.readFileSync(path.join(migDir, f), "utf8") });
  const q = (sql) => execFileSync("sqlite3", ["-json", DB, sql], { encoding: "utf8" }).trim();
  const cols = JSON.parse(q("PRAGMA table_info(prayer_book_favorites)"));
  ok(cols.map((c) => c.name).join(",") === "slug,sort_order,updated_at" && cols.find((c) => c.name === "slug").pk === 1,
    "SQ1 migration 0028 stands applied: prayer_book_favorites (slug PK · sort_order · updated_at)", JSON.stringify(cols.map((c) => [c.name, c.pk])));
  const book = JSON.parse(q("SELECT COUNT(*) AS n FROM prayer_book"));
  ok(book[0].n === 34, "SQ2 the book seed stands unregressed at 34 rows", book[0].n);
  const favs = JSON.parse(q("SELECT COUNT(*) AS n FROM prayer_book_favorites"));
  ok(favs[0].n === 0, "SQ2 the favorites table stands empty at seed (the standing state)");
}

/* ---------------- W legs: the real Worker on a fixture D1 ---------------- */
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const WPORT = 9000 + (process.pid % 400);
const WBASE = "http://127.0.0.1:" + WPORT;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v470");
function wranglerD1(appDir, persist, args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"), "--persist-to", persist, ...args],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function d1q(appDir, persist, sql) {
  const out = wranglerD1(appDir, persist, ["--json", "--command", sql]);
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[0].results || [];
}
const procs = [];
function startApp(appDir, port, persist) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", "LOCAL_DEV:1", "--var", "AGENT_TOKEN:" + TOKEN];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const wget = async (p, headers = {}) => { const r = await fetch(WBASE + p, { headers }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const wput = async (p, jsonBody, headers = {}) => {
  const r = await fetch(WBASE + p, { method: "PUT", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(jsonBody || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
try {
  const migDir = path.join(APP, "migrations");
  const files = fs.readdirSync(migDir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(migDir, f));
  fs.rmSync(PERSIST, { recursive: true, force: true });
  const joined = path.join(TMPD, "all-migrations.sql");
  fs.writeFileSync(joined, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, "--file", joined],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  startApp(APP, WPORT, PERSIST);
  const up = await waitUp(WBASE);
  ok(up, "W0 the fixture Worker boots (LOCAL_DEV)");
  const g0 = await wget("/api/prayer/book/favorites");
  ok(g0.status === 200 && Array.isArray(g0.body.favorites) && g0.body.favorites.length === 0,
    "W1 the session GET on an empty store reads { favorites: [] }", JSON.stringify(g0.body));
  const p1 = await wput("/api/prayer/book/favorites", { favorites: ["memorare", "our-father", "memorare"] });
  ok(p1.status === 200 && JSON.stringify(p1.body.favorites) === '["memorare","our-father"]',
    "W2 the PUT stores the list deduped, first occurrence kept, and answers the stored list re-read", JSON.stringify(p1.body));
  const rows = d1q(APP, PERSIST, "SELECT slug, sort_order FROM prayer_book_favorites ORDER BY sort_order");
  ok(rows.length === 2 && rows[0].slug === "memorare" && rows[0].sort_order === 0 && rows[1].slug === "our-father" && rows[1].sort_order === 1,
    "W2 the rows stand with sort_order = index", JSON.stringify(rows));
  const g1 = await wget("/api/prayer/book/favorites");
  ok(g1.status === 200 && JSON.stringify(g1.body.favorites) === '["memorare","our-father"]',
    "W3 the session GET reads the stored list back", JSON.stringify(g1.body));
  const door = await wget("/api/agent/prayer/book/favorites", { authorization: "Bearer " + TOKEN });
  ok(door.status === 200 && JSON.stringify(door.body.favorites) === '["memorare","our-father"]',
    "W4 the door GET carries the stored list (the Review/Ship verify surface)", JSON.stringify(door.body));
  const pBad = await wput("/api/prayer/book/favorites", { favorites: ["memorare", "not-a-prayer"] });
  const doorAfterBad = await wget("/api/agent/prayer/book/favorites", { authorization: "Bearer " + TOKEN });
  ok(pBad.status === 400 && JSON.stringify(doorAfterBad.body.favorites) === '["memorare","our-father"]',
    "W5 a bad-slug PUT answers 400 and writes nothing (the store stands)", "status=" + pBad.status + " store=" + JSON.stringify(doorAfterBad.body.favorites));
  const pDoor = await wput("/api/agent/prayer/book/favorites", { favorites: ["angelus"] }, { authorization: "Bearer " + TOKEN });
  const doorAfterDoorPut = await wget("/api/agent/prayer/book/favorites", { authorization: "Bearer " + TOKEN });
  ok(pDoor.status !== 200 && JSON.stringify(doorAfterDoorPut.body.favorites) === '["memorare","our-father"]',
    "W6 no door write route stands (a door PUT does not write)", "status=" + pDoor.status);
  const pClear = await wput("/api/prayer/book/favorites", { favorites: [] });
  const doorCleared = await wget("/api/agent/prayer/book/favorites", { authorization: "Bearer " + TOKEN });
  ok(pClear.status === 200 && Array.isArray(doorCleared.body.favorites) && doorCleared.body.favorites.length === 0,
    "W7 an empty PUT clears the list", JSON.stringify(doorCleared.body));
} finally {
  for (const p of procs) { try { process.kill(-p.pid, "SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch { /* gone */ } } }
  fs.rmSync(PERSIST, { recursive: true, force: true });
}

/* ---------------- B legs: Chromium on the v462 boot mold ----------------
   The favorites stub delegates to this harness server, whose
   store survives page reloads exactly as the real server
   does. /__favproxy is the stub's upstream (validation in
   the worker's own discipline: bad slug 400s, dedupe keeps
   first occurrence); /__favstate + /__favctl are the
   harness's own read/control surface. */
let favStore = [], favPuts = 0, favDead = false;
const tracks = (base, count, label) => Array.from({ length: count }, (_, i) => ({ episodeId: String(base + i), title: label + " track " + (i + 1), durationS: 240, available: true, streamUrl: "__ORIGIN__/audio/" + (base + i) + ".wav" }));
const DAY = {
  ok: true, date: "2026-11-15", presentedDay: "2026-11-15", dateLabel: "Sunday, November 15, 2026",
  liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" },
  introTexts: { "9000": "For the intentions of the family" },
  blocks: [
    { block: "Morning", label: "Morning", caption: "Morning prayers", spotifyUrl: "https://open.spotify.com/playlist/morning", tracks: tracks(9000, 3, "Morning") },
    { block: "Midday", label: "Midday", caption: "", tracks: tracks(9100, 2, "Midday") },
  ],
  episodes: [{ episodeId: "9901", title: "Podcast Episode One", durationS: 300, available: true, streamUrl: "__ORIGIN__/audio/9901.wav" }],
};
const INTENTIONS = { intentions: [{ id: 1, text: "For the family", priority: "H", status: "active", created_at: "2026-11-01", drawnCount: 2 }] };
const PRAYERDAY = { date: "2026-11-15", dateLabel: "Sunday, November 15, 2026", liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" } };

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
var __realFetch = window.fetch.bind(window);
var FIX = { DAY: ${JSON.stringify(DAY)}, INTENTIONS: ${JSON.stringify(INTENTIONS)}, PRAYERDAY: ${JSON.stringify(PRAYERDAY)}, BOOK: ${JSON.stringify(BOOK)} };
window.fetch = function (path, opts) {
  var p = String(path);
  window.__fetchLog.push(p);
  var J = function (obj) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(obj))); } }); };
  if (p === '/api/prayer/book/favorites') {
    var method = (opts && opts.method) || 'GET';
    return __realFetch('/__favproxy', { method: method, headers: { 'content-type': 'application/json' }, body: opts && opts.body }).then(function (r) {
      if (r.status >= 500) throw new Error('favorites server down');
      return r.json().then(function (j) { return { ok: r.ok, status: r.status, json: function () { return Promise.resolve(j); } }; });
    });
  }
  if (p.indexOf('/api/player/day') === 0) return J(FIX.DAY);
  if (p === '/api/prayer/book') return J(FIX.BOOK);
  if (p.indexOf('/api/prayer/intentions') === 0) return J(FIX.INTENTIONS);
  if (p.indexOf('/api/prayer/day') === 0) return J(FIX.PRAYERDAY);
  if (p.indexOf('/api/pin/state') === 0) return J({ pinSet: true, retryAfterSeconds: 0 });
  return J({ ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
</` + `script>
<script>
${COOKED}
</` + `script>
</body></html>`;

let pageHtml = "";
const server = http.createServer((req, res) => {
  const p = (req.url || "/").split("?")[0];
  const sendJson = (status, obj) => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
  if (p === "/") { res.setHeader("Content-Type", "text/html"); res.end(pageHtml); return; }
  if (p === "/__favstate") { sendJson(200, { favorites: favStore, puts: favPuts, dead: favDead }); return; }
  if (p === "/__favctl" && req.method === "POST") {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const ctl = JSON.parse(raw || "{}");
      if (Array.isArray(ctl.set)) favStore = ctl.set.slice();
      if (typeof ctl.dead === "boolean") favDead = ctl.dead;
      if (ctl.resetPuts) favPuts = 0;
      sendJson(200, { favorites: favStore, puts: favPuts, dead: favDead });
    });
    return;
  }
  if (p === "/__favproxy") {
    if (favDead) { sendJson(500, { ok: false, error: "down" }); return; }
    if (req.method === "GET") { sendJson(200, { ok: true, favorites: favStore.slice() }); return; }
    if (req.method === "PUT") {
      let raw = "";
      req.on("data", (c) => { raw += c; });
      req.on("end", () => {
        const body = JSON.parse(raw || "{}");
        if (!Array.isArray(body.favorites)) { sendJson(400, { ok: false, error: "favorites required" }); return; }
        const slugs = [];
        for (const rawSlug of body.favorites) {
          const slug = String(rawSlug ?? "");
          if (!BOOK_SLUGS.has(slug)) { sendJson(400, { ok: false, error: "bad slug " + slug }); return; }
          if (!slugs.includes(slug)) slugs.push(slug);
        }
        favStore = slugs;
        favPuts++;
        sendJson(200, { ok: true, favorites: favStore.slice() });
      });
      return;
    }
    sendJson(405, { ok: false });
    return;
  }
  res.statusCode = 404; res.end("not found");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;
pageHtml = PAGE.split("__ORIGIN__").join(ORIGIN);

const favState = async () => (await (await fetch(ORIGIN + "/__favstate")).json());
const favCtl = async (ctl) => { await fetch(ORIGIN + "/__favctl", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ctl) }); };
const untilFav = async (want, timeout = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const s = await favState(); if (want(s)) return s; await sleep(200); }
  return await favState();
};

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  const ev = (fn) => page.evaluate(fn);
  const openBook = async () => {
    await ev(`(function(){ var t = document.querySelector('#sidetoggle [data-side="book"]'); if (t) t.click(); })()`);
    await page.waitForSelector('[data-bookrow="memorare"]', { timeout: 8000 });
    await sleep(350);
  };
  const favSection = () => ev(`(function(){ var host = document.getElementById('book-results'); if (!host) return null;
    var out = {}, cur = null;
    Array.from(host.children).forEach(function (el) {
      if (el.classList.contains('sectionhead')) { cur = el.textContent; out[cur] = []; }
      else if (el.getAttribute && el.getAttribute('data-bookrow') && cur) out[cur].push(el.getAttribute('data-bookrow'));
    });
    return out; })()`);
  const untilFavSection = async (want, timeout = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const s = await favSection(); if (s && want(s)) return s; await sleep(200); }
    return await favSection();
  };

  /* B1 — favorite two on a fresh store, wipe the device
     storage whole, reload: the section stands from the
     server (Plan §2.6 leg 1). */
  await favCtl({ set: [], dead: false, resetPuts: true });
  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(300);
  await openBook();
  await ev(`document.querySelector('[data-bookstar="memorare"]').click()`);
  await untilFav((s) => s.favorites.includes("memorare"));
  await ev(`document.querySelector('[data-bookstar="our-father"]').click()`);
  const st1 = await untilFav((s) => s.favorites.length === 2);
  ok(JSON.stringify(st1.favorites) === '["memorare","our-father"]' && st1.puts === 2,
    "B1 two stars write through: the server store holds both, one PUT per toggle", JSON.stringify(st1));
  await ev(`localStorage.clear()`);
  await page.reload();
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 }).catch(() => {});
  await sleep(300);
  await openBook();
  const sec1 = await untilFavSection((s) => Array.isArray(s.Favorites));
  ok(JSON.stringify(sec1.Favorites) === '["our-father","memorare"]',
    "B1 after a whole localStorage wipe + reload, the Favorites section stands from the server (painted in book order)", JSON.stringify(sec1));
  const mirror1 = await ev(`localStorage.getItem('opn-book-favs-v462')`);
  ok(mirror1 === '["memorare","our-father"]', "B1 the device key stands rewritten as the server list's mirror", mirror1);

  /* B2 — the carry-up: only the device key holds slugs;
     the first open PUTs them up once, the second open
     carries nothing (Plan §2.6 leg 2). */
  await favCtl({ set: [], dead: false, resetPuts: true });
  await ev(`(function(){ localStorage.clear(); localStorage.setItem('opn-book-favs-v462', '["angelus"]'); })()`);
  await page.reload();
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 }).catch(() => {});
  await sleep(300);
  await openBook();
  const st2 = await untilFav((s) => s.favorites.length === 1);
  ok(JSON.stringify(st2.favorites) === '["angelus"]' && st2.puts === 1,
    "B2 the carry-up PUTs the device list up once on first open", JSON.stringify(st2));
  await page.reload();
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 }).catch(() => {});
  await sleep(300);
  await openBook();
  await sleep(800);
  const st2b = await favState();
  ok(JSON.stringify(st2b.favorites) === '["angelus"]' && st2b.puts === 1,
    "B2 a second open carries nothing — the stored list stands unchanged (idempotent)", JSON.stringify(st2b));

  /* B3 — the server wins over a divergent mirror
     (Plan §2.6 leg 3). */
  await favCtl({ set: ["memorare"], dead: false, resetPuts: true });
  await ev(`(function(){ localStorage.clear(); localStorage.setItem('opn-book-favs-v462', '["angelus"]'); })()`);
  await page.reload();
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 }).catch(() => {});
  await sleep(300);
  await openBook();
  const sec3 = await untilFavSection((s) => Array.isArray(s.Favorites));
  const mirror3 = await ev(`localStorage.getItem('opn-book-favs-v462')`);
  const st3 = await favState();
  ok(JSON.stringify(sec3.Favorites) === '["memorare"]' && mirror3 === '["memorare"]' && JSON.stringify(st3.favorites) === '["memorare"]' && st3.puts === 0,
    "B3 a standing server list wins whole over a divergent device mirror — paint, mirror, and store all read the server list", JSON.stringify({ sec: sec3.Favorites, mirror: mirror3, st: st3 }));

  /* B4 — the favorites routes dead: the book paints from
     the mirror, a toggle lands locally, nothing crashes
     (Plan §2.6 leg 5's client half). */
  await favCtl({ set: [], dead: true, resetPuts: true });
  await ev(`(function(){ localStorage.clear(); localStorage.setItem('opn-book-favs-v462', '["angelus"]'); })()`);
  await page.reload();
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 }).catch(() => {});
  await sleep(300);
  const errsBefore = pageErrors.length;
  await openBook();
  const sec4 = await untilFavSection((s) => Array.isArray(s.Favorites));
  ok(JSON.stringify(sec4.Favorites) === '["angelus"]',
    "B4 with the favorites routes dead, the Favorites section paints from the device mirror", JSON.stringify(sec4));
  await ev(`document.querySelector('[data-bookstar="memorare"]').click()`);
  await sleep(500);
  const mirror4 = await ev(`localStorage.getItem('opn-book-favs-v462')`);
  ok((mirror4 || "").includes("memorare") && (mirror4 || "").includes("angelus") && pageErrors.length === errsBefore,
    "B4 a toggle with the server down lands in the mirror and nothing crashes", mirror4 + " errs=" + (pageErrors.length - errsBefore));
  await favCtl({ dead: false });
  ok(pageErrors.length === 0, "B0 no page errors across the whole run", pageErrors.join(" | ").slice(0, 300));
} finally {
  await browser.close();
  server.close();
}

console.log("---");
console.log(`harness-v470: ${n - fails}/${n} ok` + (fails ? ` — ${fails} FAILED` : ""));
process.exit(fails ? 1 : 0);
