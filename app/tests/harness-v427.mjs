#!/usr/bin/env node
// harness-v427 — the v427 gate (Plan §2.9): NOVENAS, PER-EPISODE
// DRAWS. Server legs on the v392 wrangler mold (LOCAL_DEV, the
// deterministic drawHash makes every draw exactly assertable):
// migration 0022's store fills once per (date, episode) from the
// enumerated own-feed set, the family key "novenas" retires from
// introTexts, the redraw join re-draws BOTH stores under v426's
// snapshot/restore discipline, and a forced failure restores both
// row for row. F-427-I2's stub: the Worker's feed fetch is the
// ONE named constant OWN_FEED_URL in index.ts, overridden under
// LOCAL_DEV by the OWN_FEED_URL env var — this harness serves the
// fixture feed itself on a local port (ok / fail / big modes) and
// counts the fetches, so the §2.3 gate (standing rows → no fetch)
// is directly assertable. F-427-I3: the per-item picks are checked
// against the PRE-REFACTOR hash replicated below — byte-identical
// seeds through the factored drawHash. F-427-I4: the first fill
// runs against the ~2.1 MB "big" feed and its shell cost is timed
// and printed. Client legs: the §2.7 seam extraction mold on the
// built client (per-episode wins; undrawn → null) + a Chromium
// surfaces pass (each novena card its own line; Now Playing).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v427 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8996;
const FEEDPORT = 8997;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v427");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v427-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const shift = (d, days) => { const p = d.split("-").map(Number); const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days, 12)); const z = (x) => String(x).padStart(2, "0"); return `${dt.getUTCFullYear()}-${z(dt.getUTCMonth() + 1)}-${z(dt.getUTCDate())}`; };
const TODAY = chicagoToday(), TOMORROW = shift(TODAY, 1), YDAY = shift(TODAY, -1);

// ---- the draw, replicated exactly (the PRE-REFACTOR drawRandom
// hash + the weighted pick loop) so expected sets are computable
// and F-427-I3's byte-identity is a real comparison --------------
function drawRandom(date, itemId) {
  const s = `${date}:${itemId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function expectedDraw(date, itemIds, pool) {
  const weights = pool.map((i) => (i.priority === "H" ? 4 : i.priority === "M" ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const out = {};
  for (const itemId of itemIds) {
    let x = drawRandom(date, itemId) * total;
    let pick = pool[pool.length - 1];
    for (let k = 0; k < pool.length; k++) { x -= weights[k]; if (x <= 0) { pick = pool[k]; break; } }
    out[itemId] = pick.id;
  }
  return out;
}
const sameSet = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// ---- the fixture feed (F-427-I2's stub server) ------------------
let feedMode = "big";
let feedFetches = 0;
const enc = (file) => `<item><title>x</title><enclosure url="https://orapronobis.media/audio/${file}" length="1000" type="audio/mpeg"/></item>`;
function feedXml(mode) {
  const items = [
    enc(`${TODAY}-st_alpha-day-3.mp3`),
    enc(`${TODAY}-st_beta-day-1.mp3`),
    enc(`${TODAY}-feast-day-of-st_gamma-day-2.mp3`),   // the last -day- rules: novena-feast-day-of-st_gamma
    enc(`${TODAY}-st_alpha-day-4.mp3`),                // duplicate episode, deduped
    enc(`${TODAY}-morning-prayer.mp3`),                // dated stem, no -day-: not a novena
    enc(`daily-rosary-${TODAY}.mp3`),                  // date not at stem start: not enumerated
    enc(`${TOMORROW}-st_delta-day-1.mp3`),
    enc(`${TOMORROW}-st_epsilon-day-5.mp3`),
    enc(`${YDAY}-st_zeta-day-2.mp3`),
  ];
  if (mode === "big") {
    // ~2.1 MB of catalog padding (other dates), F-427-I4's shape.
    let pad = "";
    const chunk = enc(`2020-01-01-padding-item-with-a-longish-slug-name-day-1.mp3`) + "\n";
    while (pad.length < 2_100_000) pad += chunk;
    items.push(pad);
  }
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Ora Pro Nobis</title>${items.join("\n")}</channel></rss>`;
}
const feedServer = http.createServer((rq, rs) => {
  feedFetches++;
  if (feedMode === "fail") { rs.writeHead(500); rs.end("no"); return; }
  rs.writeHead(200, { "content-type": "application/rss+xml" });
  rs.end(feedXml(feedMode));
});

// ---- wrangler helpers (the estate mold) -------------------------
function wranglerD1(args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function d1q(sql) {
  const out = wranglerD1(["--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results || [];
}
function d1run(sql) { wranglerD1(["--command", sql]); }
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
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`, "--var", `OWN_FEED_URL:http://127.0.0.1:${FEEDPORT}/podcast.xml`];
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
      if (out.status >= 500 && i < 4 && p !== "/api/prayer/redraw") { await sleep(800); continue; }
      return out;
    } catch (e) { lastErr = e; await sleep(800); }
  }
  throw lastErr;
};
const poolNow = () => d1q("SELECT id, priority FROM prayer_intentions WHERE status='active' ORDER BY CASE priority WHEN 'H' THEN 0 WHEN 'M' THEN 1 ELSE 2 END, id");
const textOf = (id) => ({ 1: "For Alpha", 2: "For Beta", 3: "For Gamma", 4: "For Delta", 5: "For Retired", 6: "For Epsilon" })[id];
const drawsNow = (date) => { const o = {}; for (const r of d1q(`SELECT item_id, intention_id FROM prayer_draws WHERE date='${date}' ORDER BY item_id`)) o[r.item_id] = r.intention_id; return o; };
const epDrawsNow = (date) => { const o = {}; for (const r of d1q(`SELECT episode_id, intention_id FROM prayer_episode_draws WHERE date='${date}' ORDER BY episode_id`)) o[r.episode_id] = r.intention_id; return o; };
const EPS_TODAY = ["novena-st_alpha", "novena-st_beta", "novena-feast-day-of-st_gamma"];
const EPS_TOMORROW = ["novena-st_delta", "novena-st_epsilon"];

// ---- statics ------------------------------------------------------
function statics() {
  ok(fs.existsSync(path.join(APP, "migrations/0022_prayer_episode_draws.sql")), "S: migration 0022 stands in the tree");
  const mig = fs.readFileSync(path.join(APP, "migrations/0022_prayer_episode_draws.sql"), "utf8");
  ok(mig.includes("CREATE TABLE IF NOT EXISTS prayer_episode_draws") && mig.includes("PRIMARY KEY (date, episode_id)"),
    "S: 0022 creates prayer_episode_draws keyed (date, episode_id)");
  ok(INDEX.includes('const OWN_FEED_URL = "https://orapronobis.media/podcast.xml"'),
    "S/F-427-I2: the feed URL stands as ONE named constant in index.ts (the LOCAL_DEV env override is the harness stub)");
  ok(!INDEX.includes('out["novenas"]'), "S: the \"novenas\" family key emission is RETIRED from playerIntroTexts");
  ok(INDEX.includes("async function prayerEpisodeDrawForDate") && INDEX.includes("prayerEpisodeDrawForDate(env, date, true)"),
    "S: the episode draw stands, and the redraw joins it with forced enumeration inside prayerRedrawForDate");
  const epFn = INDEX.slice(INDEX.indexOf("async function prayerEpisodeDrawForDate"), INDEX.indexOf("// v426 §2.3"));
  ok(epFn.includes("if (!forceEnumerate && map.size > 0) return map;") && epFn.includes("env.DB.batch(stmts)"),
    "S: the §2.3 gate (standing rows → no fetch) and the one-batch fill stand in the episode draw");
  ok(INDEX.includes("function drawHash(") && INDEX.includes("return drawHash(`${date}:${itemId}`)") && INDEX.includes("return drawHash(`${date}:${episodeId}`)"),
    "S/F-427-I3: drawHash is factored and BOTH seed shapes run through it");
}

let browser = null;
try {
  statics();
  await new Promise((r) => feedServer.listen(FEEDPORT, "127.0.0.1", r));
  try { execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stood on the port */ }
  // A prior run's workerd can outlive its wrapper and hold the
  // port (the v426 mold lesson) — do not proceed until the port
  // refuses connections, or this run talks to a stale server.
  for (let i = 0; i < 20; i++) {
    try { await fetch(BASE + "/", { signal: AbortSignal.timeout(1000) }); await sleep(500); }
    catch { break; }
    if (i === 19) throw new Error("port 8996 never freed — a stale server stands");
  }
  applyMigrations();
  ok(d1q("SELECT name FROM sqlite_master WHERE type='table' AND name='prayer_episode_draws'").length === 1,
    "migration 0022 applies clean — prayer_episode_draws stands");
  // Fixture pool: 1 H · 2 M · 3 L · 4 M active, 5 H retired (v426's).
  d1run("DELETE FROM prayer_intentions; DELETE FROM prayer_draws;");
  d1run(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES
    (1,'For Alpha','H','active','2026-11-01T00:00:00Z'),(2,'For Beta','M','active','2026-11-01T00:00:00Z'),
    (3,'For Gamma','L','active','2026-11-01T00:00:00Z'),(4,'For Delta','M','active','2026-11-01T00:00:00Z'),
    (5,'For Retired','H','retired','2026-11-01T00:00:00Z')`);
  d1run(`INSERT INTO prayer_items (id, block, name, sub, kind, color, opening_prayer, closing_prayer, enabled, sort) VALUES
    (101,'Morning','Fixture Morning Prayer','','prayer','gold','','',1,1),
    (102,'Morning','Daily Rosary','','prayer','gold','','',1,2),
    (103,'Midmorning','Fixture Novena','','prayer','gold','','',1,1),
    (104,'Midday','Fixture Angelus','','prayer','gold','','',1,1),
    (105,'Afternoon','Fixture Chaplet','','prayer','gold','','',1,1),
    (106,'Evening','Fixture Evening Prayer','','prayer','gold','','',1,1),
    (107,'Night','Fixture Night Prayer','','prayer','gold','','',1,1),
    (108,'Mass and Homilies','Fixture Mass','','prayer','gold','','',1,1),
    (109,'Novenas','Novenas','','prayer','gold','','',1,1)`);
  const items = d1q("SELECT id FROM prayer_items WHERE enabled=1 ORDER BY id").map((r) => r.id);
  for (const it of items) {
    d1run(`INSERT INTO prayer_draws (date, item_id, intention_id) VALUES ('${YDAY}', ${it}, 2), ('${TOMORROW}', ${it}, 3)`);
  }
  // Yesterday's episode rows stand seeded (the past-date redraw leg).
  d1run(`INSERT INTO prayer_episode_draws (date, episode_id, intention_id) VALUES ('${YDAY}', 'novena-st_zeta', 2), ('${YDAY}', 'novena-st_eta', 4)`);
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV)");

  // ---------- first fill over the ~2.1 MB feed (F-427-I4) --------
  feedMode = "big";
  const fetchesBefore = feedFetches;
  const t0 = Date.now();
  const shell1 = await req("GET", "/api/player/day");
  const firstFillMs = Date.now() - t0;
  console.log(`# F-427-I4: first-fill shell cost (2.1 MB feed fetch + enclosure scan + fill): ${firstFillMs} ms, feed fetches: ${feedFetches - fetchesBefore}`);
  ok(shell1.status === 200, "E1: the first-fill day shell answers 200 over the big feed");
  ok(firstFillMs < 30000, `F-427-I4: the first-fill shell cost is bounded (${firstFillMs} ms)`);
  const expEpToday = expectedDraw(TODAY, EPS_TODAY, poolNow());
  ok(sameSet(epDrawsNow(TODAY), expEpToday),
    "E1: the fill records exactly one row per enumerated episode (3 canonical ids — dedupe + the last-day- rule), each the LCG-expected pick for seed `${date}:${episodeId}`");
  const it1 = shell1.body.introTexts || {};
  ok(!("novenas" in it1), "E2: the shell's introTexts carries NO \"novenas\" family key");
  ok(EPS_TODAY.every((e) => it1[e] === textOf(expEpToday[e])),
    "E2: introTexts carries one entry per drawn episode under its own id, with that episode's drawn text");
  // F-427-I3: per-item picks byte-identical to the pre-refactor hash.
  ok(sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "F-427-I3: today's per-item draws equal the PRE-REFACTOR algorithm's expected set — the shared-hash refactor moved no per-item pick");
  ok(it1["daily-rosary"] === textOf(expectedDraw(TODAY, items, poolNow())[102]),
    "E2: every per-item introTexts entry stands as before (daily-rosary carries item 102's drawn text)");

  // ---------- the gate: standing rows → no fetch, no re-pick -----
  const rowsAfterFill = epDrawsNow(TODAY);
  const fetchMark = feedFetches;
  await req("GET", "/api/player/day");
  await req("GET", "/api/player/day");
  ok(feedFetches === fetchMark, "G1: a date with standing episode rows triggers NO feed fetch on re-read (the §2.3 gate)");
  ok(sameSet(epDrawsNow(TODAY), rowsAfterFill), "G1: a second read re-picks NOTHING — today's episode rows stand byte-identical");

  // ---------- §2.8: prayerDayPayload stands untouched ------------
  const pd = await req("GET", `/api/prayer/day?date=${TODAY}`);
  const expItems = expectedDraw(TODAY, items, poolNow());
  let pdOk = pd.status === 200;
  const seen = {};
  for (const b of pd.body.blocks || []) for (const d of b.devotions || []) { seen[d.id] = d.intentions && d.intentions[0] ? d.intentions[0].id : null; }
  for (const it of items) if (seen[it] !== expItems[it]) pdOk = false;
  ok(pdOk, "F-427-5/§2.8: prayerDayPayload's per-item draws (the feed composer's read) are byte-identical — item 11's shape stands beside the episode store, never instead of it");

  // ---------- enumeration failure: no rows, no error -------------
  feedMode = "fail";
  const shellF = await req("GET", `/api/player/day?date=${TOMORROW}`);
  ok(shellF.status === 200 && !EPS_TOMORROW.some((e) => e in (shellF.body.introTexts || {})) && Object.keys(epDrawsNow(TOMORROW)).length === 0,
    "E3: a feed fetch failure on an unfilled date → no rows written, no episode keys, the shell never errors");
  feedMode = "ok";
  const shellT = await req("GET", `/api/player/day?date=${TOMORROW}`);
  const expEpTom = expectedDraw(TOMORROW, EPS_TOMORROW, poolNow());
  ok(sameSet(epDrawsNow(TOMORROW), expEpTom) && EPS_TOMORROW.every((e) => (shellT.body.introTexts || {})[e] === textOf(expEpTom[e])),
    "E3: the next read retries the fill — tomorrow's episodes stand drawn and emitted");

  // ---------- the redraw join (§2.5) ------------------------------
  d1run(`UPDATE prayer_episode_draws SET intention_id=2 WHERE date='${TODAY}'`);
  const rd = await req("POST", "/api/prayer/redraw");
  ok(rd.status === 200 && sameSet(epDrawsNow(TODAY), expEpToday),
    "R1: POST /api/prayer/redraw re-draws the episode rows (forced enumeration) — the corrupted set returns to the expected set");
  ok(sameSet(drawsNow(TODAY), expItems), "R1: the same redraw keeps the per-item set at its expected set (one endpoint, one algorithm)");

  // ADD mutation: the settle re-draws the episodes over the widened pool.
  const add = await req("POST", "/api/prayer/intentions", { text: "For Epsilon", priority: "H" });
  const expEpWide = expectedDraw(TODAY, EPS_TODAY, poolNow());
  ok(add.status === 201 && add.body.redrawn === true && sameSet(epDrawsNow(TODAY), expEpWide),
    "R2: an ADD's settle re-draws the episodes over the widened pool inside its own request");

  // Forced fill failure: BOTH stores restore row for row.
  const snapItems = drawsNow(TODAY), snapEps = epDrawsNow(TODAY);
  d1run("ALTER TABLE prayer_items RENAME TO prayer_items_hold");
  const rdFail = await req("POST", "/api/prayer/redraw");
  d1run("ALTER TABLE prayer_items_hold RENAME TO prayer_items");
  ok(rdFail.status === 500 && typeof rdFail.body.error === "string",
    "R3: a forced fill failure answers 500 in the standing error shape");
  ok(sameSet(drawsNow(TODAY), snapItems) && sameSet(epDrawsNow(TODAY), snapEps),
    "R3: BOTH stores stand restored row for row after the failed re-run");
  ok(sameSet(epDrawsNow(YDAY), { "novena-st_zeta": 2, "novena-st_eta": 4 }),
    "R4: a past date's episode rows stand byte-identical after today's redraws");

  // ---------- the client seam (extraction mold, §2.7) ------------
  const seamSrc = CLIENT.slice(CLIENT.indexOf("function buildIntroMap"), CLIENT.indexOf("function expandDescs"))
    + CLIENT.slice(CLIENT.indexOf("function introForTrack"), CLIENT.indexOf("function armEllipsis"));
  const state = { dayDescs: [], dayPayload: null };
  const seam = new Function("state", seamSrc + `
    return { buildIntroMap, introTextFor, introForTrack };`)(state);
  const dayBoth = { introTexts: { "novenas": "FAMILY", "novena-a": "Text A", "novena-b": "Text B", "daily-rosary": "Rosary Text" }, intros: null };
  dayBoth.intros = seam.buildIntroMap(dayBoth);
  ok(dayBoth.intros["novena-a"] && dayBoth.intros["novena-a"].text === "Text A" && !("novenas" in dayBoth.intros),
    "C1: buildIntroMap carries each episode's own entry and excludes the family key");
  ok(seam.introTextFor({ episodeId: "novena-a" }, dayBoth) === "Text A" && seam.introTextFor({ episodeId: "novena-b" }, dayBoth) === "Text B",
    "C1: introTextFor resolves each novena to its OWN text — the per-id entry wins (client delta ZERO, verified on the built client)");
  const dayNone = { introTexts: { "daily-rosary": "Rosary Text" }, intros: null };
  dayNone.intros = seam.buildIntroMap(dayNone);
  state.dayPayload = dayNone;
  ok(seam.introTextFor({ episodeId: "novena-undrawn" }, dayNone) === null && seam.introForTrack({ episodeId: "novena-undrawn" }) === null,
    "C2: with the family key retired, an undrawn novena resolves null at BOTH seams — absence, never another text (§1.7 leg 5)");
  ok(seam.introTextFor({ episodeId: "daily-rosary" }, dayNone) === "Rosary Text",
    "C2: a non-novena paired id resolves per-id exactly as before");

  // ---------- surfaces (Chromium, F-427-7) ------------------------
  // Two episode rows with DISTINCT texts stand seeded for today;
  // the page route serves the fixture feed so the client builds
  // the two novena tracks itself.
  d1run(`DELETE FROM prayer_episode_draws WHERE date='${TODAY}'`);
  d1run(`INSERT INTO prayer_episode_draws (date, episode_id, intention_id) VALUES ('${TODAY}', 'novena-st_alpha', 1), ('${TODAY}', 'novena-st_beta', 3)`);
  feedMode = "ok";
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const pub = new Date(`${TODAY}T12:00:00Z`).toUTCString();
  const encFull = (file, title) => `<item><title>${title}</title><pubDate>${pub}</pubDate><enclosure url="https://orapronobis.media/audio/${file}" length="1000" type="audio/mpeg"/></item>`;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === "https://orapronobis.media/podcast.xml") {
      const fx = `<?xml version="1.0"?><rss version="2.0"><channel><title>f</title>${encFull(`${TODAY}-st_alpha-day-3.mp3`, "Novena to St Alpha - Day 3")}${encFull(`${TODAY}-st_beta-day-1.mp3`, "Novena to St Beta - Day 1")}</channel></rss>`;
      await route.fulfill({ status: 200, contentType: "application/rss+xml", body: fx }); return;
    }
    if (url === "https://orapronobis.media/intentions.xml") {
      await route.fulfill({ status: 200, contentType: "application/rss+xml", body: `<?xml version="1.0"?><rss version="2.0"><channel><title>f</title></channel></rss>` }); return;
    }
    if (/\.mp3($|\?)/.test(url)) { await route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(64) }); return; }
    await route.continue();
  });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.click('[data-tab="prayers"]');
  await page.waitForSelector(".blockcard", { timeout: 30000 });
  // Let the day load settle (a late load pass re-paints home),
  // then open the home Novenas filter view — the novena cards'
  // standing home surface (F-427-7).
  await sleep(4000);
  await page.click('[data-homefilter="novenas"]');
  await page.waitForFunction(() => [...document.querySelectorAll(".intention-text")].some((e) => e.textContent.includes("For Alpha")), null, { timeout: 30000 });
  const cardTexts = await page.evaluate(() => [...document.querySelectorAll(".intention-text")].map((e) => e.textContent));
  ok(cardTexts.includes("Prayer Intention: For Alpha") && cardTexts.includes("Prayer Intention: For Gamma"),
    `C3/F-427-7: the novena cards each show their OWN episode's line (${JSON.stringify(cardTexts)})`);
  // Now Playing: play the st_alpha novena, read the face's line.
  await page.click('[data-playkey="novena-st_alpha"]');
  await page.waitForFunction(() => { const el = document.querySelector("#np-intention"); return el && el.textContent.includes("For Alpha"); }, null, { timeout: 20000 });
  const npText = await page.evaluate(() => document.querySelector("#np-intention").textContent);
  ok(npText === "Prayer Intention: For Alpha",
    `C4/F-427-7: Now Playing for the st_alpha novena reads that episode's own line (${JSON.stringify(npText)})`);
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  try { feedServer.close(); } catch { /* noop */ }
  procs.forEach((p) => { try { process.kill(-p.pid, "SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch { /* noop */ } } });
}
console.log(`# harness-v427: ${n} ok / ${fails} not-ok`);
process.exit(fails ? 1 : 0);
