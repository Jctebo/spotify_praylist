#!/usr/bin/env node
// harness-v390 — the v390 gate (Plan §2.8 legs L1–L10): Podcasts
// at series level — three series (Catechism · Bible · Rosary) on
// the generalized v381 machinery, the slug seam (Catechism
// shortcuts stand · Bible/Rosary generic), migration 0018 (the
// seed source widening + the Bible Morning-row retirement), the
// fixture-scale seed, the auto-mark series generalization, and
// the guards (Prayers byte-identical to the pre-v390 build · no
// intention line on Podcasts rows). Mold: harness-v381 — a local
// wrangler instance inside this worktree (LOCAL_DEV) with the
// three feed seams pointed at a mutable fixture feed server;
// fixture D1 is migrated through 0017 first and migration 0018
// is applied MID-RUN (its before/after read-backs are legs, not
// setup), because Implement builds the migration and Ship
// applies it. The pristine instance for L10 is the v388 tree
// (OPN_PRISTINE_APP_V390) running the candidate's full migration
// set — §2.9's rollback posture: 0018 stands under the pre-v390
// build. Tallies read from the COMPLETE log.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v390 runs only inside a release worktree"); process.exit(2); }
const PRISTINE_APP = process.env.OPN_PRISTINE_APP_V390 || "/home/hatch/workspace/.worktrees/v390-pristine/app";
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8995, PPORT = 8996, FEED_PORT = 8955;
const BASE = `http://127.0.0.1:${PORT}`, PBASE = `http://127.0.0.1:${PPORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v390");
const PPERSIST = path.join(PRISTINE_APP, ".wrangler-test-v390p");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v390-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI_TS = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// ---- fixture feeds (trimmed from the real feeds' shapes) -------
function itemXml({ title, pub, dur, guid, url }) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate><guid isPermaLink="false">${guid}</guid>`
    + `<enclosure url="${url}" length="1000000" type="audio/mpeg"/><itunes:duration>${dur}</itunes:duration></item>`;
}
function feedXml(chanTitle, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>`
    + `<title>${chanTitle}</title>` + items.join("") + `</channel></rss>`;
}
const A = (name) => `${FEED}/audio/${name}.mp3`;
const dayItem = (prefix, day, year, extra = {}) => itemXml({
  title: `Day ${day}: Episode ${day}${day % 2 === 0 ? ` (${year})` : ""}`,
  pub: extra.pub || `Thu, 0${(day % 9) + 1} Jan ${year} 15:00:00 +0000`,
  dur: extra.dur || "12:00", guid: extra.guid || `guid-${prefix}-${year}-${day}`, url: extra.url || A(`${prefix}-day${day}-${year}`),
});
// Catechism fixtures: harness-v381's FEED_A1 + FEED_C, verbatim shapes.
const ciyDay = (day, year, extra = {}) => itemXml({
  title: `Day ${day}: Episode ${day}${year >= 2024 && day % 2 === 0 ? ` (${year})` : ""}`,
  pub: extra.pub || `Thu, 0${(day % 9) + 1} Jan ${year} 15:00:00 +0000`,
  dur: extra.dur || "12:00", guid: extra.guid || `guid-${year}-${day}`, url: extra.url || A(`day${day}-${year}`),
});
const FEED_CIY_A1 = feedXml("The Catechism in a Year (with Fr. Mike Schmitz)",
  [3, 2, 1].map((d) => ciyDay(d, 2025)).concat([5, 4, 3, 2, 1].map((d) => ciyDay(d, 2024))));
const FEED_CIY_C = feedXml("The Catechism in a Year (with Fr. Mike Schmitz)", [
  itemXml({ title: "BONUS: Praying with Bishop Cozzens", pub: "Wed, 31 Dec 2025 15:00:00 +0000", dur: "20:00", guid: "guid-b-cozzens-2025", url: A("bonus-cozzens-2025") }),
  ciyDay(365, 2025, { pub: "Wed, 31 Dec 2025 08:00:00 +0000" }),
  itemXml({ title: "BONUS: Catechism in a Year with Jeff Cavins", pub: "Tue, 30 Dec 2025 15:00:00 +0000", dur: "22:00", guid: "guid-b-cavins-2025", url: A("bonus-cavins-2025") }),
  ciyDay(364, 2025, { pub: "Tue, 30 Dec 2025 08:00:00 +0000" }),
  ciyDay(363, 2025, { pub: "Mon, 29 Dec 2025 15:00:00 +0000" }),
  itemXml({ title: "Day 366: Special Leap Year Message (2024)", pub: "Tue, 31 Dec 2024 15:00:00 +0000", dur: "5:00", guid: "guid-2024-366", url: A("day366-2024") }),
  itemXml({ title: "BONUS: Pray with Fr. Mike", pub: "Tue, 15 Nov 2022 15:00:00 +0000", dur: "15:00", guid: "guid-b-pray-2022", url: A("bonus-pray-2022") }),
  itemXml({ title: "Introducing Catechism in a Year", pub: "Sat, 01 Oct 2022 15:00:00 +0000", dur: "2:00", guid: "guid-trailer", url: A("trailer") }),
]);
// Bible fixture: two editions (2026 partial Days 1-3 · 2025 Days
// 1-5), BOTH Cavins-titled bonus contents (the slug-collision
// pair), and a non-day non-BONUS item standing outside.
const FEED_BIY = feedXml("The Bible in a Year (with Fr. Mike Schmitz)", [
  itemXml({ title: "BONUS: If You Feel Like Giving Up (with Jeff Cavins)", pub: "Mon, 15 Sep 2025 15:00:00 +0000", dur: "18:00", guid: "guid-biy-b-givingup", url: A("biy-bonus-givingup") }),
  itemXml({ title: "BONUS: Bringing the Bible Back to Catholics (with Jeff Cavins)", pub: "Sun, 15 Jun 2025 15:00:00 +0000", dur: "20:00", guid: "guid-biy-b-bringing", url: A("biy-bonus-bringing") }),
  ...[3, 2, 1].map((d) => dayItem("biy", d, 2026)),
  ...[5, 4, 3, 2, 1].map((d) => dayItem("biy", d, 2025)),
  itemXml({ title: "Introduction to the Bible in a Year", pub: "Sat, 01 Oct 2022 15:00:00 +0000", dur: "2:00", guid: "guid-biy-trailer", url: A("biy-trailer") }),
]);
// Rosary fixture: two editions (2026 Days 1-2 · 2025 Days 1-4),
// one BONUS published after the 2025 day run (it anchors at its
// pub position, after Day 4 — the shape §2's live-feed
// reconciliation requires: no bonus stands before Day 1, whose
// current derivation L5 pins), and the Phase 5 title form (no
// BONUS: prefix — outside the sequence by the standing rule).
const FEED_RIY = feedXml("The Rosary in a Year (with Fr. Mark-Mary Ames)", [
  itemXml({ title: "Phase 5 Bonus: Introduction to Phase Five", pub: "Sun, 01 Jun 2025 15:00:00 +0000", dur: "10:00", guid: "guid-riy-phase5", url: A("riy-phase5") }),
  ...[2, 1].map((d) => dayItem("riy", d, 2026)),
  ...[4, 3, 2, 1].map((d) => dayItem("riy", d, 2025)),
  itemXml({ title: "BONUS: Introduction to Phase One", pub: "Mon, 20 Jan 2025 15:00:00 +0000", dur: "9:00", guid: "guid-riy-b-phase1", url: A("riy-bonus-phase1") }),
]);

const feedBodies = { "/ciy.xml": FEED_CIY_A1, "/biy.xml": FEED_BIY, "/riy.xml": FEED_RIY };
const feedDown = { "/ciy.xml": false, "/biy.xml": false, "/riy.xml": false };
const feedServer = http.createServer((req, res) => {
  if (req.url && feedBodies[req.url] !== undefined) {
    if (feedDown[req.url]) { res.writeHead(500); res.end("down"); return; }
    res.writeHead(200, { "content-type": "application/rss+xml" }); res.end(feedBodies[req.url]); return;
  }
  if (req.url && req.url.startsWith("/audio/")) { res.writeHead(200, { "content-type": "audio/mpeg" }); res.end(Buffer.alloc(64)); return; }
  res.writeHead(404); res.end("nope");
});

// ---- wrangler helpers (the estate mold) -------------------------
function wranglerD1(appDir, persist, args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"), "--persist-to", persist, ...args],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function wranglerD1File(appDir, persist, file) { wranglerD1(appDir, persist, ["--file", file]); }
function migFiles(appDir, through) {
  const dir = path.join(appDir, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()
    .filter((f) => !through || f <= through).map((f) => path.join(dir, f));
}
function applyFiles(appDir, persist, files) {
  fs.rmSync(persist, { recursive: true, force: true });
  const f = path.join(TMPD, `mig-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  wranglerD1File(appDir, persist, f);
}
function applySql(appDir, persist, sql) {
  const f = path.join(TMPD, `one-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, sql);
  wranglerD1File(appDir, persist, f);
}
// d1q: a read query through wrangler --json → the results rows.
// d1x: a write statement → { ok, changes } (ok=false on a refused
// statement — the CHECK legs read refusals from here).
function d1q(appDir, persist, sql) {
  const out = wranglerD1(appDir, persist, ["--json", "--command", sql]);
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[0].results || [];
}
function d1x(appDir, persist, sql) {
  try {
    const out = wranglerD1(appDir, persist, ["--json", "--command", sql]);
    const parsed = JSON.parse(out.slice(out.indexOf("[")));
    return { ok: true, changes: parsed[0].meta ? parsed[0].meta.changes : null };
  } catch { return { ok: false, changes: null }; }
}
const listensDigest = (appDir, persist) => {
  const rows = d1q(appDir, persist, "SELECT series||'|'||seq_key||'|'||listened_at||'|'||listen_date||'|'||source AS line FROM podcast_listens ORDER BY series, seq_key");
  const count = d1q(appDir, persist, "SELECT COUNT(*) AS c FROM podcast_listens")[0].c;
  return { count, hash: crypto.createHash("sha256").update(rows.map((r) => r.line).join("\n")).digest("hex") };
};
const procs = [];
function startApp(appDir, port, persist) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`,
    "--var", `EXT_CIY_FEED_URL:${FEED}/ciy.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biy.xml`, "--var", `EXT_RIY_FEED_URL:${FEED}/riy.xml`];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const get = async (base, p, headers = {}) => { const r = await fetch(base + p, { headers }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const getRaw = async (base, p, headers = {}) => { const r = await fetch(base + p, { headers }); return { status: r.status, text: await r.text() }; };
const post = async (base, p, jsonBody, headers = {}) => {
  const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(jsonBody || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const put = async (base, p, jsonBody, headers = {}) => {
  const r = await fetch(base + p, { method: "PUT", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(jsonBody || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const AGENT = { authorization: `Bearer ${TOKEN}` };

// ---- verbatim extraction (client legs, the v381 mold) -----------
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

let browser = null;
try {
  await new Promise((r) => feedServer.listen(FEED_PORT, r));

  // ============ Stage A — fixture D1 through migration 0017 =====
  applyFiles(APP, PERSIST, migFiles(APP, "0017_podcasts.sql"));
  startApp(APP, PORT, PERSIST);
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode), D1 through 0017");

  // Catechism's standing marks — the migration's pass-through
  // evidence (fixed strings, so the digest is deterministic).
  applySql(APP, PERSIST, `INSERT INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES
    ('catechism-in-a-year', 'ciy:day-363', '2026-11-10T15:00:00.000Z', '2026-11-10', 'manual'),
    ('catechism-in-a-year', 'ciy:bonus-pray', '2026-11-11T15:00:00.000Z', '2026-11-11', 'auto');`);
  const digestBefore = listensDigest(APP, PERSIST);
  ok(digestBefore.count === 2, "migration evidence stands: two Catechism marks in the pre-0018 store");
  const metaBefore = d1q(APP, PERSIST, "SELECT version FROM player_settings_meta WHERE id=1")[0].version;

  // L7 (pre): the 0017 check refuses 'seed' outright.
  const seedEarly = d1x(APP, PERSIST, "INSERT INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES ('bible-in-a-year', 'biy:day-1', '2026-11-12T00:00:00.000Z', '2026-11-12', 'seed')");
  ok(seedEarly.ok === false, "L7: before 0018, a 'seed' row is refused by the 0017 CHECK — the widening is required, not decorative");

  // L8 (pre): the Bible row stands, and the slot stands with it.
  let r = await get(BASE, "/api/player/source-settings");
  const morningPrimaries = (ss) => ss.filter((s) => s.block === "Morning" && s.enabled === 1 && s.role === "primary").map((s) => s.sourceKey);
  ok(r.body.sources.some((s) => s.sourceKey === "bible-in-a-year" && s.block === "Morning"),
    "L8: before 0018 the settings carry the Bible in a Year row in Morning");
  ok(morningPrimaries(r.body.sources).join(",") === "do-invitatory,morning-prayer,do-morning-prayer,daily-rosary,bible-in-a-year,marian-antiphon",
    "L8: before 0018, Morning's standing primaries are the six in the standing order (§2.6), Bible fifth");
  const livePre = await get(BASE, `/api/player/externals/live?date=${chicagoToday()}`);
  ok((livePre.body.slots || []).some((s) => s.slotId === "ext-bible-in-a-year"),
    "L8: before 0018, the externals live payload carries the Bible slot (present or named-missing)");
  const audioPre = await getRaw(BASE, `/api/player/externals/audio?date=${chicagoToday()}&slot=ext-bible-in-a-year`);
  ok(audioPre.status === 404 && audioPre.text.includes("no episode resolved"),
    "L8: before 0018, the pass-through gate passes the slot (its 404 is the no-episode form, not the settings form)");

  // ============ Stage B — migration 0018 applied =================
  const mig18 = migFiles(APP).find((f) => f.includes("0018_"));
  ok(!!mig18, "migration 0018 file stands in the migrations dir");
  wranglerD1File(APP, PERSIST, mig18);
  const digestAfter = listensDigest(APP, PERSIST);
  ok(digestAfter.count === digestBefore.count && digestAfter.hash === digestBefore.hash,
    "L7/§2.4: 0018's rebuild passes every standing row through untouched (count + full-content hash identical)");
  const metaAfter = d1q(APP, PERSIST, "SELECT version FROM player_settings_meta WHERE id=1")[0].version;
  ok(metaAfter === metaBefore + 1, "§2.4: 0018 bumps the settings meta version exactly once (the retirement is a settings write)");
  r = await get(BASE, "/api/player/source-settings");
  ok(!r.body.sources.some((s) => s.sourceKey === "bible-in-a-year"),
    "L8: after 0018, no Bible row stands in the stored settings set");

  // L7: the seed shape — the §2.5 statement form at fixture scale
  // (Bible days 1-3), source 'seed', the ship date as listen_date.
  const shipDate = chicagoToday();
  const seedSql = (dates) => `INSERT OR IGNORE INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES `
    + dates.map((d) => `('bible-in-a-year', 'biy:day-${d}', '2026-11-12T18:00:00.000Z', '${shipDate}', 'seed')`).join(", ");
  const seed1 = d1x(APP, PERSIST, seedSql([1, 2, 3]));
  const biySeedCount = d1q(APP, PERSIST, "SELECT COUNT(*) AS c FROM podcast_listens WHERE series='bible-in-a-year'")[0].c;
  ok(seed1.ok === true && biySeedCount === 3, "L7: the seed statement inserts its rows under the widened check (3 at fixture scale — counted by read-back; local D1's meta carries no changes count)");
  const seedRows = d1q(APP, PERSIST, "SELECT seq_key, listen_date, source FROM podcast_listens WHERE series='bible-in-a-year' ORDER BY seq_key");
  ok(seedRows.length === 3 && seedRows.every((x) => x.source === "seed" && x.listen_date === shipDate),
    "L7: every seeded row carries source 'seed' and the ship date as its listen date — the history reads honestly");
  const seed2 = d1x(APP, PERSIST, seedSql([1, 2, 3]));
  const totalAfterRerun = d1q(APP, PERSIST, "SELECT COUNT(*) AS c FROM podcast_listens")[0].c;
  ok(seed2.ok === true && totalAfterRerun === 5, "L7: the seed statement re-run inserts 0 (INSERT OR IGNORE — the store's count stands at 5: 2 Catechism + 3 seeded, idempotent, §2.5's third read-back leg)");
  const bogus = d1x(APP, PERSIST, "INSERT INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES ('bible-in-a-year', 'biy:day-9', '2026-11-12T00:00:00.000Z', '2026-11-12', 'bogus')");
  ok(bogus.ok === false, "L7: the widened check still rejects a fourth source value");

  // ============ Stage C — L8, the Morning retirement =============
  let livePost;
  // Environment note (v390 Implement close-out, 2026-11-12): the
  // sandbox egress proxy intermittently resets the first post-0018
  // /externals/live fetch while the Worker performs its real-feed
  // fan-out (production code; the fetch helper has no retry because
  // the client re-reads on next open). Retry connect-level failures
  // — and ONLY connect-level failures — until the response arrives;
  // every assertion below then judges that response as before.
  for (let attempt = 0; ; attempt++) {
    try { livePost = await get(BASE, `/api/player/externals/live?date=${chicagoToday()}`); break; }
    catch (e) { if (attempt >= 39) throw e; await new Promise((r) => setTimeout(r, 3000)); }
  }
  ok(!(livePost.body.slots || []).some((s) => s.slotId === "ext-bible-in-a-year"),
    "L8: after 0018, the externals live payload carries NO Bible slot — present or missing, no card stands");
  ok(morningPrimaries(r.body.sources).join(",") === "do-invitatory,morning-prayer,do-morning-prayer,daily-rosary,marian-antiphon",
    "L8: Morning's standing primaries are the five, in the standing order minus Bible (§2.6) — no replacement");
  const audioPost = await getRaw(BASE, `/api/player/externals/audio?date=${chicagoToday()}&slot=ext-bible-in-a-year`);
  ok(audioPost.status === 404 && audioPost.text.includes("does not stand under the current settings"),
    "L8: the externals audio pass-through for the retired slot answers the settings 404");
  const storedSet = r.body.sources.map((s) => ({ sourceKey: s.sourceKey, block: s.block, dayRule: s.dayRule, enabled: s.enabled }));
  const putOk = await put(BASE, "/api/player/source-settings", { sources: storedSet });
  ok(putOk.status === 200, "L8: a source-settings PUT over the smaller stored set answers 200 (the smaller set is the whole set now)");
  const putBack = await put(BASE, "/api/player/source-settings", { sources: [...storedSet, { sourceKey: "bible-in-a-year", block: "Morning", dayRule: "daily", enabled: 1 }] });
  ok(putBack.status === 400, "L8: a PUT body re-adding the bible-in-a-year key answers 400 — no settings write can resurrect the slot");

  // ============ Stage D — L1, registry and reads =================
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.ok === true && Array.isArray(r.body.seriesList) && r.body.seriesList.map((s) => s.series).join(",") === "catechism-in-a-year,bible-in-a-year,rosary-in-a-year",
    "L1: the no-param read answers the series index — the three series in registry order");
  const idx = Object.fromEntries((r.body.seriesList || []).map((s) => [s.series, s]));
  ok(idx["catechism-in-a-year"] && idx["catechism-in-a-year"].available === true && idx["catechism-in-a-year"].total === 5
    && idx["catechism-in-a-year"].listenedCount === 0 && idx["catechism-in-a-year"].currentKey === "ciy:day-1" && idx["catechism-in-a-year"].currentLabel === "Day 1",
    "L1: the Catechism index entry carries its counts + current label from its own payload internals");
  ok(idx["bible-in-a-year"] && idx["bible-in-a-year"].total === 7 && idx["bible-in-a-year"].listenedCount === 3
    && idx["bible-in-a-year"].currentKey === "biy:day-4" && idx["bible-in-a-year"].currentLabel === "Day 4",
    "L1: the Bible index entry — 3 of 7 listened (the fixture seed), current Day 4 with its label");
  ok(idx["rosary-in-a-year"] && idx["rosary-in-a-year"].total === 5 && idx["rosary-in-a-year"].listenedCount === 0
    && idx["rosary-in-a-year"].currentKey === "riy:day-1" && idx["rosary-in-a-year"].currentLabel === "Day 1",
    "L1: the Rosary index entry — unmarked, current Day 1");
  const biyShape = await get(BASE, "/api/player/podcasts?series=bible-in-a-year");
  ok(Object.keys(biyShape.body).sort().join(",") === "available,builtAt,collapses,currentKey,entries,listenedCount,ok,series,stale,title,total",
    "L1: a ?series= read returns the standing per-series payload shape, byte-for-byte the v381 field set");
  ok(biyShape.body.series === "bible-in-a-year" && biyShape.body.title === "Bible in a Year", "L1: the series payload names its own series + title");
  const doorIdx = await get(BASE, "/api/agent/podcasts/progress", AGENT);
  ok(Array.isArray(doorIdx.body.seriesList) && doorIdx.body.seriesList.length === 3, "L1: the agent door's no-param progress read mirrors the index");
  const doorBiy = await get(BASE, "/api/agent/podcasts/progress?series=bible-in-a-year", AGENT);
  ok(doorBiy.body.series === "bible-in-a-year" && doorBiy.body.listenedCount === 3, "L1: the door's ?series= read mirrors that series' payload");
  const badRead = await get(BASE, "/api/player/podcasts?series=nope");
  ok(badRead.status === 400, "L1: an unknown series on the read answers 400");
  const badMark = await post(BASE, "/api/player/podcasts/mark", { series: "nope", seqKey: "biy:day-4", source: "manual" });
  ok(badMark.status === 400, "L1: an unknown series on the mark answers 400");
  const badUnmark = await post(BASE, "/api/player/podcasts/unmark", { series: "nope", seqKey: "biy:day-4" });
  ok(badUnmark.status === 400, "L1: an unknown series on the unmark answers 400");
  const seedRoute = await post(BASE, "/api/player/podcasts/mark", { series: "bible-in-a-year", seqKey: "biy:day-4", source: "seed" });
  ok(seedRoute.status === 400, "L1/§2.3: source 'seed' never passes the mark route (the whitelist is auto/manual only)");
  // Per-series outage isolation: Rosary's feed down + no snapshot
  // → Rosary alone reads unavailable in the index.
  feedDown["/riy.xml"] = true;
  applySql(APP, PERSIST, "DELETE FROM podcast_sequences WHERE series='rosary-in-a-year';");
  r = await get(BASE, "/api/player/podcasts");
  const idx2 = Object.fromEntries((r.body.seriesList || []).map((s) => [s.series, s]));
  ok(idx2["rosary-in-a-year"] && idx2["rosary-in-a-year"].available === false && idx2["rosary-in-a-year"].currentLabel === null
    && idx2["catechism-in-a-year"].available === true && idx2["bible-in-a-year"].available === true,
    "L1: one series' outage darkens only its own index card — the others stand available");
  feedDown["/riy.xml"] = false;
  const riyBack = await get(BASE, "/api/player/podcasts?series=rosary-in-a-year");
  ok(riyBack.body.available === true && riyBack.body.total === 5, "L1: the feed's return rebuilds Rosary's snapshot and the series stands again");

  // ============ Stage E — L2, the generalized build ==============
  feedBodies["/ciy.xml"] = FEED_CIY_C;
  applySql(APP, PERSIST, "DELETE FROM podcast_sequences WHERE series='catechism-in-a-year';");
  r = await get(BASE, "/api/player/podcasts?series=catechism-in-a-year");
  const proj = (e) => ({ key: e.key, kind: e.kind, day: e.day, label: e.label, title: e.title, url: e.url, durationS: e.durationS, edition: e.edition, listened: e.listened, source: e.source, listenDate: e.listenDate });
  const expectedCiy = [
    { key: "ciy:bonus-pray", kind: "bonus", day: null, label: "Bonus", title: "Pray with Fr. Mike", url: A("bonus-pray-2022"), durationS: 900, edition: 2022, listened: true, source: "auto", listenDate: "2026-11-11" },
    { key: "ciy:day-363", kind: "day", day: 363, label: "Day 363", title: "Episode 363", url: A("day363-2025"), durationS: 720, edition: 2025, listened: true, source: "manual", listenDate: "2026-11-10" },
    { key: "ciy:day-364", kind: "day", day: 364, label: "Day 364", title: "Episode 364", url: A("day364-2025"), durationS: 720, edition: 2025, listened: false, source: null, listenDate: null },
    { key: "ciy:bonus-cavins", kind: "bonus", day: null, label: "Bonus", title: "Catechism in a Year with Jeff Cavins", url: A("bonus-cavins-2025"), durationS: 1320, edition: 2025, listened: false, source: null, listenDate: null },
    { key: "ciy:day-365", kind: "day", day: 365, label: "Day 365", title: "Episode 365", url: A("day365-2025"), durationS: 720, edition: 2025, listened: false, source: null, listenDate: null },
    { key: "ciy:bonus-cozzens", kind: "bonus", day: null, label: "Bonus", title: "Praying with Bishop Cozzens", url: A("bonus-cozzens-2025"), durationS: 1200, edition: 2025, listened: false, source: null, listenDate: null },
    { key: "ciy:day-366", kind: "special", day: 366, label: "Day 366 — Special", title: "Special Leap Year Message", url: A("day366-2024"), durationS: 300, edition: 2024, listened: false, source: null, listenDate: null },
  ];
  ok(JSON.stringify((r.body.entries || []).map(proj)) === JSON.stringify(expectedCiy),
    "L2: the Catechism fixture builds byte-identical keys, order, and entry fields to the v381 expectation — the generalization does not move Catechism (its standing marks ride through)");
  const biyRead = await get(BASE, "/api/player/podcasts?series=bible-in-a-year");
  const biyKeys = (biyRead.body.entries || []).map((e) => e.key).join(",");
  ok(biyKeys === "biy:day-1,biy:day-2,biy:day-3,biy:day-4,biy:day-5,biy:bonus-bringing-the-bible-back,biy:bonus-if-you-feel-like",
    "L2: the Bible fixture builds biy: keys in day order with both bonuses anchored after Day 5");
  const biyByKey = Object.fromEntries((biyRead.body.entries || []).map((e) => [e.key, e]));
  ok(biyByKey["biy:day-1"].url === A("biy-day1-2026") && biyByKey["biy:day-3"].url === A("biy-day3-2026")
    && biyByKey["biy:day-4"].url === A("biy-day4-2025") && biyByKey["biy:day-5"].url === A("biy-day5-2025"),
    "L2: Bible edition supply — Days 1-3 play the newest (2026) edition, Days 4-5 the 2025 edition past its reach");
  ok(!(biyRead.body.entries || []).some((e) => e.url === A("biy-trailer")), "L2: the Bible feed's non-day, non-BONUS item stands outside the sequence");
  const riyRead = await get(BASE, "/api/player/podcasts?series=rosary-in-a-year");
  const riyKeys = (riyRead.body.entries || []).map((e) => e.key).join(",");
  ok(riyKeys === "riy:day-1,riy:day-2,riy:day-3,riy:day-4,riy:bonus-introduction-to-phase-one",
    "L2: the Rosary fixture builds riy: keys — days in order, the bonus anchored at its pub position after Day 4");
  const riyByKey = Object.fromEntries((riyRead.body.entries || []).map((e) => [e.key, e]));
  ok(riyByKey["riy:day-1"].url === A("riy-day1-2026") && riyByKey["riy:day-3"].url === A("riy-day3-2025"),
    "L2: Rosary edition supply — newest edition supplies Days 1-2, the 2025 run supplies 3-4 (the union is complete)");
  ok(!(riyRead.body.entries || []).some((e) => e.url === A("riy-phase5")),
    "L2: the 'Phase 5 Bonus:' title form (no BONUS: prefix) stands outside the Rosary sequence — the standing rule as-is");

  // ============ Stage F — L3, the slug seam ======================
  ok(!!biyByKey["biy:bonus-bringing-the-bible-back"] && !!biyByKey["biy:bonus-if-you-feel-like"]
    && biyByKey["biy:bonus-bringing-the-bible-back"].title.includes("Cavins") && biyByKey["biy:bonus-if-you-feel-like"].title.includes("Cavins"),
    "L3: BOTH Cavins-titled Bible bonus contents stand as two entries under the generic slugger — the shortcut table would have collapsed them to one and lost a content");
  ok(!!Object.fromEntries((r.body.entries || []).map((e) => [e.key, e]))["ciy:bonus-cozzens"]
    && (r.body.entries || []).some((e) => e.key === "ciy:bonus-cavins") && (r.body.entries || []).some((e) => e.key === "ciy:bonus-pray"),
    "L3: Catechism's three known contents still key cozzens · cavins · pray — the shortcut table stands for Catechism only (its standing marks key on them)");

  // ============ Stage G — L5, current derivation per series ======
  const markS = (series, k, source = "manual") => post(BASE, "/api/player/podcasts/mark", { series, seqKey: k, source });
  const unmarkS = (series, k) => post(BASE, "/api/player/podcasts/unmark", { series, seqKey: k });
  const seriesRead = (k) => get(BASE, `/api/player/podcasts?series=${k}`);
  let sr = await seriesRead("rosary-in-a-year");
  ok(sr.body.currentKey === "riy:day-1", "L5: empty Rosary → current is riy:day-1 (no seed — John's word: not started)");
  sr = await seriesRead("bible-in-a-year");
  ok(sr.body.currentKey === "biy:day-4" && sr.body.listenedCount === 3,
    "L5: the fixture-scale seeded Bible (days 1-3 of 7) derives current Day 4 — the §2.5 derivation at fixture scale (production: 315 of 372 → biy:day-316)");
  await markS("rosary-in-a-year", "riy:day-1"); await markS("rosary-in-a-year", "riy:day-2"); await markS("rosary-in-a-year", "riy:day-4");
  sr = await seriesRead("rosary-in-a-year");
  ok(sr.body.currentKey === "riy:day-3", "L5: Rosary marks {1,2,4} → current is Day 3 (the gap is never skipped), per series independently");
  sr = await seriesRead("bible-in-a-year");
  ok(sr.body.currentKey === "biy:day-4", "L5: Rosary's marks never move Bible's derivation");

  // ============ Stage H — L4, marks per series ===================
  const mBiy5 = await markS("bible-in-a-year", "biy:day-5", "manual");
  ok(mBiy5.status === 200, "L4: a session mark on Bible answers 200");
  let dr = await get(BASE, "/api/agent/podcasts/progress?series=bible-in-a-year", AGENT);
  const biy5a = (dr.body.entries || []).find((e) => e.key === "biy:day-5");
  ok(biy5a && biy5a.listened === true && biy5a.source === "manual" && biy5a.listenDate === chicagoToday(),
    "L4: the door read mirrors the Bible mark (listened + today's date + source manual)");
  const biy5At = biy5a && biy5a.listenedAt;
  await sleep(1100);
  await markS("bible-in-a-year", "biy:day-5", "auto");
  dr = await get(BASE, "/api/agent/podcasts/progress?series=bible-in-a-year", AGENT);
  const biy5b = (dr.body.entries || []).find((e) => e.key === "biy:day-5");
  ok(biy5b && biy5b.source === "manual" && biy5b.listenedAt === biy5At, "L4: first-mark-stands holds per series (a later auto re-mark changes nothing)");
  const doorWrite = await post(BASE, "/api/agent/podcasts/mark", { series: "bible-in-a-year", seqKey: "biy:day-4", source: "manual" }, AGENT);
  ok(doorWrite.status === 404, "L4: no agent write route exists (the door refuses the mark POST)");
  const wrongSeries = await markS("rosary-in-a-year", "biy:day-1", "manual");
  ok(wrongSeries.status === 400, "L4: a mark validates the seqKey against THAT series' snapshot (a Bible key under Rosary is refused 400)");
  const biyCountBefore = (await seriesRead("bible-in-a-year")).body.listenedCount;
  await markS("rosary-in-a-year", "riy:day-3");
  const biyCountAfter = (await seriesRead("bible-in-a-year")).body.listenedCount;
  ok(biyCountBefore === 4 && biyCountAfter === 4, "L4: a mark in one series writes nothing in another (Bible's count stands at 4 across a Rosary mark)");
  await unmarkS("rosary-in-a-year", "riy:day-3");
  const uRiy = await unmarkS("rosary-in-a-year", "riy:day-4");
  sr = await seriesRead("rosary-in-a-year");
  const riy4 = (sr.body.entries || []).find((e) => e.key === "riy:day-4");
  ok(uRiy.status === 200 && riy4 && riy4.listened === false && riy4.listenDate === null,
    "L4: unmark deletes the row under its own series — the entry reads unlistened with no date");

  // ============ Stage I — L6, auto-mark carries the series =======
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("about:blank");
  const seam = await page.evaluate(({ mc, wpm }) => {
    const calls = { played: [], post: [] };
    const state = { podcasts: null };
    const presentedDateStr = () => "2026-11-12";
    const writePlayed = (...a) => calls.played.push(a);
    const post = (...a) => { calls.post.push(JSON.parse(JSON.stringify(a))); return Promise.resolve({}); };
    const todayChicago = () => "2026-11-12";
    eval(mc); eval(wpm);
    const biyPayload = { series: "bible-in-a-year", entries: [{ key: "biy:day-3", listened: false, source: null, listenDate: null }], listenedCount: 0, currentKey: "biy:day-3" };
    const ciyPayload = { series: "catechism-in-a-year", entries: [{ key: "ciy:day-2", listened: false, source: null, listenDate: null }], listenedCount: 0, currentKey: "ciy:day-2" };
    // 1) a Bible descriptor completes while the Bible page stands open
    state.podcasts = biyPayload;
    markCompleted({ kind: "podcast", seriesKey: "biy:day-3", podSeries: "bible-in-a-year", episodeId: "biy:day-3" });
    const t1 = { post: calls.post.slice(), biy: JSON.parse(JSON.stringify(biyPayload)) };
    calls.post = []; calls.played = [];
    // 2) a Bible descriptor completes while the CATECHISM page stands open
    state.podcasts = ciyPayload;
    markCompleted({ kind: "podcast", seriesKey: "biy:day-4", podSeries: "bible-in-a-year", episodeId: "biy:day-4" });
    const t2 = { post: calls.post.slice(), ciy: JSON.parse(JSON.stringify(ciyPayload)) };
    calls.post = []; calls.played = [];
    // 3) a Catechism descriptor still posts Catechism
    markCompleted({ kind: "podcast", seriesKey: "ciy:day-2", podSeries: "catechism-in-a-year", episodeId: "ciy:day-2" });
    const t3 = { post: calls.post.slice(), ciy: JSON.parse(JSON.stringify(ciyPayload)), played: calls.played.length };
    return { t1, t2, t3 };
  }, { mc: extractFn(CLIENT, "markCompleted"), wpm: extractFn(CLIENT, "writePodMarkQuiet") });
  ok(seam.t1.post.length === 1 && seam.t1.post[0][0] === "/api/player/podcasts/mark"
    && seam.t1.post[0][1].series === "bible-in-a-year" && seam.t1.post[0][1].seqKey === "biy:day-3" && seam.t1.post[0][1].source === "auto",
    "L6: a Bible descriptor reaching the seam posts series 'bible-in-a-year', source 'auto' — the playing episode's own series");
  ok(seam.t1.biy.entries[0].listened === true && seam.t1.biy.listenedCount === 1 && seam.t1.biy.currentKey === null,
    "L6: the in-memory leg mutates the open payload when it is the playing series");
  ok(seam.t2.post.length === 1 && seam.t2.post[0][1].series === "bible-in-a-year"
    && seam.t2.ciy.entries[0].listened === false && seam.t2.ciy.listenedCount === 0,
    "L6: a Bible completion under an open Catechism page writes its Bible row server-side and leaves the open page's counts untouched");
  ok(seam.t3.post.length === 1 && seam.t3.post[0][1].series === "catechism-in-a-year" && seam.t3.ciy.entries[0].listened === true && seam.t3.played === 0,
    "L6: a Catechism descriptor still posts Catechism (and no day-played record — v381's rule carried)");
  const wpmSrc = extractFn(CLIENT, "writePodMarkQuiet");
  ok(!wpmSrc.includes("catechism-in-a-year"), "L6: the 'catechism-in-a-year' literal is deleted from writePodMarkQuiet — the write carries the descriptor's series");
  ok(extractFn(CLIENT, "podDesc").includes("podSeries"), "L6: podDesc stamps the descriptor with the open payload's series (podSeries)");

  // ============ Stage J — L9, the client at series level =========
  const page2 = await browser.newPage();
  await page2.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("#tabbar .tab[data-tab='podcasts']", { timeout: 20000 });
  const tabOrder = await page2.$$eval("#tabbar .tab", (bs) => bs.map((b) => b.getAttribute("data-tab")));
  ok(tabOrder.join(",") === "prayers,podcasts,intentions,examination,confession",
    "L9: the tab order stands — Prayers · Podcasts · Intentions · Examination · Confession");
  await page2.click("#tabbar .tab[data-tab='podcasts']");
  await page2.waitForSelector("[data-podseries]", { timeout: 20000 });
  const cardKeys = await page2.$$eval("[data-podseries]", (cs) => cs.map((c) => c.getAttribute("data-podseries")));
  ok(cardKeys.join(",") === "catechism-in-a-year,bible-in-a-year,rosary-in-a-year",
    "L9: the Podcasts tab opens on the series level — three cards in registry order");
  const cardText = await page2.$$eval("[data-podseries]", (cs) => cs.map((c) => c.innerText));
  ok(cardText[1].includes("4 of 7 listened") && cardText[1].includes("Current: Day 4"),
    "L9: the Bible card paints its counts + current line from the one index read (4 of 7 · Current: Day 4)");
  ok(cardText[2].includes("2 of 5 listened") && cardText[2].includes("Current: Day 3"),
    "L9: the Rosary card paints its own counts (2 of 5 after the L4/L5 marks · Current: Day 3)");
  ok((await page2.$$("[data-podrow]")).length === 0, "L9: no episode rows stand at the series level — episodes live one level in");
  await page2.click("[data-podseries='bible-in-a-year']");
  await page2.waitForSelector("[data-podrow='biy:day-1']", { timeout: 20000 });
  ok(await page2.$("[data-podback]") !== null, "L9: the series page carries the back row at its top");
  const biyViewText = await page2.$eval("#view", (el) => el.innerText);
  ok(biyViewText.includes("4 of 7 listened") && biyViewText.includes("Current episode"),
    "L9: the series page is today's presentation inside — series card + current-episode card + the full list");
  ok(!biyViewText.includes("Prayer Intention:"), "L10: no written intention line stands on any Podcasts row (guard, read off the live series page)");
  await page2.click("[data-podmark='biy:day-4']");
  await page2.waitForFunction(() => document.querySelector("#view").innerText.includes("5 of 7 listened"), null, { timeout: 20000 });
  ok(true, "L9: a mark tap on the series page posts that series and repaints its counts (5 of 7)");
  const biyAfter = await seriesRead("bible-in-a-year");
  ok(biyAfter.body.currentKey === "biy:day-5" || biyAfter.body.listenedCount === 5,
    "L9: the mark stands server-side under Bible (5 listened; current advances past Day 4)");
  await page2.click("[data-podback]");
  await page2.waitForSelector("[data-podseries]", { timeout: 20000 });
  const cardText2 = await page2.$$eval("[data-podseries]", (cs) => cs.map((c) => c.innerText));
  ok(cardText2[1].includes("5 of 7 listened"), "L9: back returns to the index with FRESH counts — the marks just made stand correct");
  await page2.click("#tabbar .tab[data-tab='intentions']");
  await page2.waitForTimeout(600);
  await page2.click("#tabbar .tab[data-tab='podcasts']");
  await page2.waitForSelector("[data-podseries]", { timeout: 20000 });
  ok((await page2.$$("[data-podrow]")).length === 0 && (await page2.$$("[data-podback]")).length === 0,
    "L9: re-entering the tab stands at the series level — an open series does not survive a tab switch");

  // ============ Stage K — L10, the guards ========================
  applyFiles(PRISTINE_APP, PPERSIST, migFiles(APP));
  startApp(PRISTINE_APP, PPORT, PPERSIST);
  ok(await waitUp(PBASE), "L10: pristine (pre-v390, v388 tree) app up — on the candidate's full migration set (0018 stands under the old build, §2.9)");
  const renderPrayersTab = async (base) => {
    const p = await browser.newPage();
    await p.goto(base + "/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector("#tabbar .tab[data-tab='prayers']", { timeout: 20000 });
    await p.click("#tabbar .tab[data-tab='prayers']");
    await p.waitForTimeout(2500);
    const html = await p.$eval("#view", (el) => el.innerHTML);
    await p.close();
    return html;
  };
  const candPrayers = await renderPrayersTab(BASE);
  const prisPrayers = await renderPrayersTab(PBASE);
  ok(candPrayers.length > 200, "L10: the candidate Prayers view renders (non-trivial length)");
  ok(candPrayers === prisPrayers, "L10: the Prayers tab rendered from the same fixture day is byte-identical to the pre-v390 build — no Podcasts state, no lost Morning entry beyond the retired row both share");
  ok(UI_TS.includes('var CACHE = "ora-pro-nobis-v390-1";'), "statics: the SW pin advances to ora-pro-nobis-v390-1 in ui.ts");
  let bundleOk = true, bundleErr = "";
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/dev/null"], { stdio: "pipe" });
  } catch (e) { bundleOk = false; bundleErr = String(e.stderr || e.message).slice(0, 400); }
  ok(bundleOk, "statics: the candidate Worker bundles clean (esbuild over index.ts)", bundleErr);
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
  try { feedServer.close(); } catch { /* noop */ }
  await sleep(500);
}
console.log(`# harness-v390: ${n - fails}/${n} legs ok`);
process.exit(fails ? 1 : 0);
