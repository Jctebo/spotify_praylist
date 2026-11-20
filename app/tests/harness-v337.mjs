// harness-v337 — v337 (Same-day consumption) Implement gate.
//
// Stands a local wrangler dev of the app worker (this worktree) on a
// throwaway D1 + R2 persist and proves the 17 legs of the Plan (§2.10):
//
//   1  presented-day selection: rows seeded for the real Chicago
//      yesterday/today/+1/+2 with the singleton at +2; the payload
//      serves today's rows, date == presentedDay == today, storedDay
//      == +2; the dated Intentions heal shape for an old date stands
//      before the floor commit and is gone after it.
//   2  retention floor at commit: the real push helper's replace-day
//      commit leaves rows standing for every date >= Chicago
//      yesterday and none older; dated prayer_audio rows obey the
//      same floor; 'current' untouched; the singleton names the
//      pushed date.
//   3  R2 sweep floor: objects staged pre-floor under episodes/,
//      texts/ and dated segments/ are swept by the same commit; the
//      'current' families survive (served 200 over HTTP after it).
//   4  failed-push presented day: a second instance whose only rows
//      stand at +2 — the payload returns presentedMissing: true, own
//      tracks named-missing from the enabled own settings rows
//      (Antiphon in Morning, Midday AND Evening), the Intentions
//      card standing from 'current', no +2 title anywhere.
//   5  courier gates re-keyed: /externals/live and /externals/audio
//      accept the presented day (200 shape) and refuse +2 and
//      yesterday (400 naming the presented day).
//   6  device-cache keying (browser): a settled open writes the
//      cache record keyed to the PRESENTED date + settings version;
//      a valid record means the second open fetches no feed again; a
//      record keyed to the stored (+2) date or an old version is
//      discarded whole and the feeds are fetched again.
//   7  migration 0011 defaults + guard: fresh 0010 D1 -> 0011 lands
//      the §2.5 table exactly, prayer_intros stands, the player_
//      episodes PK is (date, episode_id, block), meta +1 exactly;
//      a second 0010 D1 with one row PUT-moved off its seed stands
//      untouched under 0011 while every unmoved row aligns.
//   8  Morning order: the settings payload's Morning order IS the
//      §2.5 contract list (Invitatory · Morning Prayer · Divine
//      Office Morning Prayer · Daily Rosary · Bible in a Year ·
//      Marian Antiphon), the payload's own tracks stand in their
//      contract relative order, the fallback stands numbered at its
//      slot, the browser's Morning cards stand own-then-externals
//      (the v334 queue rule), and a version-1 cache record is
//      invalidated by the bump (leg 6's version half).
//   9  Antiphon three-block placement: the real push helper's
//      manifest carries THREE placements for the one Antiphon
//      episode; the payload lists it in Morning, Midday and Evening
//      at the contract positions; the audio route serves the one R2
//      object under all three placements.
//  10  Exegesis port parity: the Anchor fixture (an item dated AFTER
//      the presented day standing newest) — the client matcher, the
//      Worker pass-through pick and the Python oracle all choose the
//      newest item released on or before the presented day, same
//      enclosure; the slot stands at Midmorning sort 1 after
//      resolve; download is the pass-through route.
//  11  Saint port parity: the Buzzsprout fixture — latest-by-date +
//      MM/DD title check picks the presented day's item in all
//      three ports; a fixture whose latest title carries a different
//      MM/DD stands named-missing (never a wrong-day saint); the
//      download route taken is direct (no pass-through request).
//  12  overrides win: after 0011, a session PUT moves a row; the
//      payload reflects it; a Worker restart re-applies nothing —
//      the move stands.
//  13  amended-4D generation: jobs/compose_app_audio.py against a
//      fixture consumption date — six standing segments pushed
//      (read-back 6 blocks) AND intros pushed for every paired
//      presented track (each novena episode counted separately);
//      intro texts follow the template + the for-join rule (oracle
//      unit checks); one deliberately failed render is named by
//      title in the Segments field and the run completes the rest.
//  14  midnight ordering: with the Suite composition absent the step
//      exhausts its bounded retry, names the composition missing,
//      composes no substitute, exits non-zero; with the composition
//      standing the leg-13 path succeeds.
//  15  dual-compose interval: the player payload carries NO intro
//      entries while the intro family stands populated (door
//      read-back) — two separate facts.
//  16  regressions: v312, v320, v325, v326, v334, v335, v336 and
//      check-v328-consumption are run COMPLETE by the gate runner
//      alongside this harness; their tallies land in §3 (this file
//      prints the marker line only).
//  17  served build: the served /app.js parses (the browser legs run
//      on it) and contains both new slot ids + the ported matchers;
//      /sw.js pins ora-pro-nobis-v337-1 with the opn-ext-audio-v1
//      purge exemption verbatim; the candidate /api/player/day
//      responses above prove legs 1/4 end-to-end over HTTP.
//
// All dates are the REAL Chicago calendar dates at run time (the
// presented-day model keys on the real clock — §2 pins no test
// seam): yesterday/today/+1/+2 are computed from America/Chicago.
//
// Run: node tests/harness-v337.mjs   (from app/)
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("/home/hatch/workspace/.tools/pwtest/node_modules/playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORK = path.resolve(APP, "..");
// HARD GUARD (the v324/v329 lesson): the shared checkout serves the
// nightly jobs; a harness run must never execute from inside it.
if (!APP.includes(".worktrees")) {
  console.error("REFUSING TO RUN: harness-v337 must run from a per-release worktree" +
    " (the shared checkout's tree serves the nightly jobs). APP=" + APP);
  process.exit(2);
}
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8990, PORT2 = 8991, FEED_PORT = 8950;
const BASE = `http://127.0.0.1:${PORT}`, BASE2 = `http://127.0.0.1:${PORT2}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v337");
const PERSIST2 = path.join(APP, ".wrangler-test-v337-failed");
const PERSIST7F = path.join(APP, ".wrangler-test-v337-mig-fresh");
const PERSIST7M = path.join(APP, ".wrangler-test-v337-mig-moved");
const TMPD = path.join(APP, "tests", ".tmp-v337");
const FIX = path.join(APP, "tests", "fixtures", "v324");
fs.mkdirSync(TMPD, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`ok - ${name}`); }
  else { failed++; console.log(`FAIL - ${name}${extra ? " :: " + extra : ""}`); }
}

// ---- real Chicago-relative dates -----------------------------------
function chicagoToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}
function shift(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function mmdd(dateStr) { const [, m, d] = dateStr.split("-"); return `${m}/${d}`; }
function rfc(dateStr, hh) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, 0, 0)).toUTCString();
}
const TODAY = chicagoToday();
const YDAY = shift(TODAY, -1), PLUS1 = shift(TODAY, 1), PLUS2 = shift(TODAY, 2), OLD = shift(TODAY, -3);

// ---- fixture feeds for the two new slots ---------------------------
const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>fixture</title><link>https://example.invalid/</link>
<description>harness fixture</description>${items}</channel></rss>`;
const item = (title, pub, enc) => `<item><title>${title}</title><pubDate>${pub}</pubDate>` +
  `<enclosure url="${enc}" type="audio/mpeg" length="1000"/></item>`;
const DGE_XML = rss(
  item("Daily Gospel Exegesis — Future", rfc(PLUS1, 6), `${FEED}/audio/dge-future.mp3`) +
  item("Daily Gospel Exegesis — Presented", rfc(TODAY, 6), `${FEED}/audio/dge-today.mp3`) +
  item("Daily Gospel Exegesis — Old", rfc(YDAY, 6), `${FEED}/audio/dge-old.mp3`));
const SAINT_XML = rss(
  item(`${mmdd(TODAY)} - St. Fixture`, rfc(TODAY, 5), `${FEED}/audio/saint-today.mp3`) +
  item(`${mmdd(YDAY)} - St. Old`, rfc(YDAY, 5), `${FEED}/audio/saint-old.mp3`));
const SAINT_BAD_XML = rss(
  item(`${mmdd(YDAY)} - St. Wrong`, rfc(TODAY, 5), `${FEED}/audio/saint-wrong.mp3`) +
  item(`${mmdd(shift(TODAY, -2))} - St. Older`, rfc(shift(TODAY, -2), 5), `${FEED}/audio/saint-older.mp3`));
const feedBytes = {
  do: fs.readFileSync(path.join(FIX, "divine-office.xml")),
  biay: fs.readFileSync(path.join(FIX, "bible-in-a-year.xml")),
  sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")),
};
const audioBytes = (name) => Buffer.from(`AUDIO-FIXTURE:${name}:` + "x".repeat(64));
const feedHits = { anchor: 0, buzz: 0 };
const feedServer = http.createServer((req, res) => {
  const u = new URL(req.url, FEED);
  const cors = { "access-control-allow-origin": "*" };
  if (u.pathname === "/do.xml") { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(feedBytes.do); }
  if (u.pathname === "/biay.xml") { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(feedBytes.biay); }
  if (u.pathname === "/sth.xml") { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(feedBytes.sth); }
  if (u.pathname === "/dge.xml") { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(DGE_XML); }
  if (u.pathname === "/saint.xml") { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(SAINT_XML); }
  if (u.pathname.startsWith("/audio/")) { res.writeHead(200, { "content-type": "audio/mpeg", ...cors }); return res.end(audioBytes(u.pathname.slice(7))); }
  res.writeHead(404); res.end();
});

// ---- seed (the estate mold: items + the 11-intention pool) ---------
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
  const pool = [];
  for (let i = 1; i <= 3; i++) pool.push([100 + i, `Synthetic intention H${i}`, "H"]);
  for (let i = 1; i <= 7; i++) pool.push([110 + i, `Synthetic intention M${i}`, "M"]);
  pool.push([120, "Synthetic intention L1", "L"]);
  for (const [id, text, pr] of pool) lines.push(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES (${id}, '${text}', '${pr}', 'active', '2026-11-01T00:00:00.000Z');`);
  return lines.join("\n");
}
function tone(name, freq, seconds) {
  const f = path.join(TMPD, name);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${seconds}`,
    "-codec:a", "libmp3lame", "-b:a", "32k", "-y", f], { stdio: "pipe" });
  return fs.readFileSync(f);
}

// ---- wrangler D1 helpers -------------------------------------------
function wranglerD1(persist, file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", persist, "--file", file],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
}
function d1q(persist, sql) {
  const out = execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"),
    "--persist-to", persist, "--command", sql, "--json"],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[0].results || [];
}
function migFiles(upto) {
  const dir = path.join(APP, "migrations");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .filter((f) => !upto || f <= upto);
}
function applyMigs(persist, upto, extraSql = "") {
  fs.rmSync(persist, { recursive: true, force: true });
  const parts = migFiles(upto).map((f) => fs.readFileSync(path.join(APP, "migrations", f), "utf8"));
  if (extraSql) parts.push(extraSql);
  const f = path.join(TMPD, `mig-${path.basename(persist)}-${upto || "all"}.sql`);
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1(persist, f);
}
function applyOneMig(persist, name) {
  const f = path.join(TMPD, `one-${name}`);
  fs.writeFileSync(f, fs.readFileSync(path.join(APP, "migrations", name), "utf8"));
  wranglerD1(persist, f);
}

// ---- HTTP helpers ----------------------------------------------------
function api(base, method, p, opts = {}) {
  return fetch(base + p, {
    method,
    headers: {
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.json ? { "content-type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
    body: opts.raw !== undefined ? opts.raw : (opts.json ? JSON.stringify(opts.json) : undefined),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})), text: "" }));
}
function apiRaw(base, p, opts = {}) {
  return fetch(base + p, { headers: opts.headers || {} }).then(async (r) => ({ status: r.status, buf: Buffer.from(await r.arrayBuffer()), text: "" }));
}
function startApp(port, persist) {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1",
    "--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`,
    "--var", `EXT_DGE_FEED_URL:${FEED}/dge.xml`, "--var", `EXT_SAINT_FEED_URL:${FEED}/saint.xml`];
  const proc = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  proc.stdout.on("data", () => {}); proc.stderr.on("data", () => {});
  return proc;
}
async function waitUp(base, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(base + "/"); if (r.status) return true; } catch (e) {}
    await sleep(1000);
  }
  throw new Error("app did not come up: " + base);
}
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];

const pushAudioDoor = (base, date, id, bytes) => api(base, "POST", "/api/agent/player/episodes/audio",
  { token: TOKEN, raw: bytes, headers: { "x-episode-date": date, "x-episode-id": id, "content-type": "audio/mpeg" } });
const pushSegmentDoor = (base, date, block, bytes) => api(base, "POST", "/api/agent/prayer/audio",
  { token: TOKEN, raw: bytes, headers: { "x-prayer-date": date, "x-prayer-block": block, "content-type": "audio/mpeg" } });
const stageTextDoor = (base, date, epId, text) => api(base, "POST", "/api/agent/player/episodes/text",
  { token: TOKEN, raw: Buffer.from(text, "utf8"), headers: { "x-episode-date": date, "x-episode-id": epId, "content-type": "text/plain; charset=utf-8" } });

async function main() {
  const kill = spawnSync("/tmp/kill-wrangler.sh", [], { stdio: "ignore" });
  void kill;
  await new Promise((r) => feedServer.listen(FEED_PORT, r));

  // ================= LEG 7 — migration defaults + guard (SQL level)
  const settingsRows = (persist) => d1q(persist,
    "SELECT source_key, block, sort_order, family, slot_id, enabled, role FROM player_source_settings ORDER BY source_key;");
  const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.source_key, r]));
  const blockOrder = (rows, block) => rows.filter((r) => r.block === block && r.role === "primary")
    .sort((a, b) => a.sort_order - b.sort_order).map((r) => `${r.source_key}:${r.sort_order}`);
  const expectDefaults = (persist, label) => {
    const rows = settingsRows(persist);
    const k = byKey(rows);
    check(`7 ${label}: Morning contract order`, JSON.stringify(blockOrder(rows, "Morning")) === JSON.stringify(
      ["do-invitatory:1", "morning-prayer:2", "do-morning-prayer:3", "daily-rosary:4", "bible-in-a-year:5", "marian-antiphon:6"]), JSON.stringify(blockOrder(rows, "Morning")));
    check(`7 ${label}: Midmorning contract order`, JSON.stringify(blockOrder(rows, "Midmorning")) === JSON.stringify(
      ["daily-gospel-exegesis:1", "novenas:2", "do-midmorning-prayer:3"]), JSON.stringify(blockOrder(rows, "Midmorning")));
    check(`7 ${label}: Midday contract order`, JSON.stringify(blockOrder(rows, "Midday")) === JSON.stringify(
      ["marian-antiphon-midday:1", "do-midday-prayer:2"]), JSON.stringify(blockOrder(rows, "Midday")));
    check(`7 ${label}: Afternoon contract order`, JSON.stringify(blockOrder(rows, "Afternoon")) === JSON.stringify(
      ["saint-of-the-day:1", "auxilium-christianorum:2", "do-midafternoon-prayer:3"]), JSON.stringify(blockOrder(rows, "Afternoon")));
    check(`7 ${label}: Evening contract order`, JSON.stringify(blockOrder(rows, "Evening")) === JSON.stringify(
      ["do-office-of-readings:1", "marian-antiphon-evening:2", "do-evening-prayer:3"]), JSON.stringify(blockOrder(rows, "Evening")));
    check(`7 ${label}: Night unchanged`, JSON.stringify(blockOrder(rows, "Night")) === JSON.stringify(
      ["daily-reflection:1", "do-night-prayer:2"]), JSON.stringify(blockOrder(rows, "Night")));
    check(`7 ${label}: fallbacks follow their slots`, k["sth-lauds"].sort_order === 3 && k["sth-vespers"].sort_order === 3,
      `lauds=${k["sth-lauds"].sort_order} vespers=${k["sth-vespers"].sort_order}`);
    check(`7 ${label}: saint converted to external`, k["saint-of-the-day"].family === "external" && k["saint-of-the-day"].slot_id === "ext-saint-of-the-day",
      JSON.stringify(k["saint-of-the-day"]));
    check(`7 ${label}: exegesis inserted external`, k["daily-gospel-exegesis"].family === "external" && k["daily-gospel-exegesis"].slot_id === "ext-gospel-exegesis" && k["daily-gospel-exegesis"].enabled === 1,
      JSON.stringify(k["daily-gospel-exegesis"]));
    check(`7 ${label}: antiphon rows stand own`, k["marian-antiphon-midday"].family === "own" && k["marian-antiphon-evening"].family === "own");
    const meta = d1q(persist, "SELECT version FROM player_settings_meta WHERE id = 1;");
    check(`7 ${label}: meta version bumped exactly +1 (1 -> 2)`, meta[0] && meta[0].version === 2, JSON.stringify(meta));
    const intros = d1q(persist, "SELECT name FROM sqlite_master WHERE type='table' AND name='prayer_intros';");
    check(`7 ${label}: prayer_intros table stands`, intros.length === 1);
    const pk = d1q(persist, "PRAGMA table_info(player_episodes);").filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    check(`7 ${label}: player_episodes PK widened to (date, episode_id, block)`, JSON.stringify(pk) === JSON.stringify(["date", "episode_id", "block"]), JSON.stringify(pk));
  };
  applyMigs(PERSIST7F, "0010_player_source_settings.sql");
  applyOneMig(PERSIST7F, "0011_player_contract_defaults.sql");
  expectDefaults(PERSIST7F, "fresh D1");
  applyMigs(PERSIST7M, "0010_player_source_settings.sql",
    "UPDATE player_source_settings SET block = 'Evening', sort_order = 9, updated_at = '2026-11-09T00:00:00.000Z' WHERE source_key = 'do-midday-prayer';");
  applyOneMig(PERSIST7M, "0011_player_contract_defaults.sql");
  {
    const rows = settingsRows(PERSIST7M);
    const k = byKey(rows);
    check("7 moved D1: the user-moved row stands untouched (held override)",
      k["do-midday-prayer"].block === "Evening" && k["do-midday-prayer"].sort_order === 9, JSON.stringify(k["do-midday-prayer"]));
    check("7 moved D1: every unmoved row still aligns",
      k["novenas"].sort_order === 2 && k["saint-of-the-day"].sort_order === 1 && k["marian-antiphon"].sort_order === 6 &&
      d1q(PERSIST7M, "SELECT version FROM player_settings_meta WHERE id = 1;")[0].version === 2);
  }

  // ================= main instances =================================
  const epRow = (date, id, title, block, sort) =>
    `INSERT INTO player_episodes (date, episode_id, title, block, sort, duration_s, r2_key, size_bytes, audio_state, pushed_at) VALUES ('${date}', '${id}', '${title}', '${block}', ${sort}, 60, 'episodes/${date}/${id}.mp3', 1000, 'present', '2026-11-09T00:00:00.000Z');`;
  const segRows = (withOld) => BLOCKS.map((b) =>
    `INSERT INTO prayer_audio (date, block, r2_key, size_bytes, pushed_at) VALUES ('current', '${b}', 'segments/current/${b}.mp3', 111, '2026-11-09T00:00:00.000Z');`).join("\n") +
    (withOld ? `\nINSERT INTO prayer_audio (date, block, r2_key, size_bytes, pushed_at) VALUES ('${OLD}', 'Morning', 'segments/${OLD}/Morning.mp3', 99, '2026-11-09T00:00:00.000Z');` : "");
  applyMigs(PERSIST, null, seedSql() + "\n" + [
    `INSERT INTO player_day (id, date, episode_count, pushed_at) VALUES (1, '${PLUS2}', 2, '2026-11-09T00:00:00.000Z');`,
    epRow(OLD, "ep-old", "OLD TITLE", "Morning", 100100),
    epRow(YDAY, "ep-yday", "YDAY TITLE", "Morning", 100100),
    epRow(TODAY, "morning-prayer", "Morning Prayer", "Morning", 100200),
    epRow(TODAY, "daily-rosary", "Daily Rosary", "Morning", 100400),
    epRow(TODAY, "marian-antiphon-angelus", "Marian Antiphon — Angelus", "Morning", 100600),
    epRow(PLUS1, "ep-plus1", "PLUS1 TITLE", "Morning", 100100),
    epRow(PLUS2, "ep-plus2a", "PLUS2 TITLE A", "Morning", 100100),
    epRow(PLUS2, "ep-plus2b", "PLUS2 TITLE B", "Night", 600100),
    segRows(true),
  ].join("\n"));
  applyMigs(PERSIST2, null, seedSql() + "\n" + [
    `INSERT INTO player_day (id, date, episode_count, pushed_at) VALUES (1, '${PLUS2}', 2, '2026-11-09T00:00:00.000Z');`,
    epRow(PLUS2, "ep-plus2a", "PLUS2 TITLE A", "Morning", 100100),
    epRow(PLUS2, "ep-plus2b", "PLUS2 TITLE B", "Night", 600100),
    segRows(false),
  ].join("\n"));
  // Sequential boot: two simultaneous wrangler dev spawns race on
  // wrangler's shared local state and the second never listens
  // (observed first-hand at this gate); boot one, wait, boot the next.
  const app1 = startApp(PORT, PERSIST);
  let app2 = null;
  try {
    await waitUp(BASE);
    app2 = startApp(PORT2, PERSIST2);
    await waitUp(BASE2);

    // ================= LEG 1 — presented-day selection ==============
    const day = (await api(BASE, "GET", "/api/player/day")).body;
    check("1 payload date == presentedDay == real Chicago today", day.date === TODAY && day.presentedDay === TODAY, `date=${day.date} presented=${day.presentedDay} today=${TODAY}`);
    check("1 storedDay stays the produced fact (+2)", day.storedDay === PLUS2, `storedDay=${day.storedDay}`);
    check("1 presentedMissing false on a standing day", day.presentedMissing === false);
    const morningOwn = (day.blocks.find((b) => b.block === "Morning") || { tracks: [] }).tracks.filter((t) => t.kind === "episode").map((t) => t.title);
    check("1 today's own rows served in Morning", JSON.stringify(morningOwn) === JSON.stringify(["Morning Prayer", "Daily Rosary", "Marian Antiphon — Angelus"]), JSON.stringify(morningOwn));
    const allTitles = JSON.stringify(day.blocks.flatMap((b) => b.tracks.map((t) => t.title || "")));
    check("1 no other date's title leaks into the payload", !/PLUS2 TITLE|PLUS1 TITLE|YDAY TITLE|OLD TITLE/.test(allTitles));
    const oldAudioRows = d1q(PERSIST, `SELECT COUNT(*) AS n FROM prayer_audio WHERE date = '${OLD}';`);
    check("1 pre-commit: the dated segment row for the old date stands in D1 (the floor leg's target)",
      oldAudioRows[0] && oldAudioRows[0].n === 1, JSON.stringify(oldAudioRows));

    // ================= LEG 4 — failed-push presented day ============
    const day2 = (await api(BASE2, "GET", "/api/player/day")).body;
    check("4 presentedMissing true when the presented day has no rows", day2.presentedMissing === true && day2.presentedDay === TODAY && day2.storedDay === PLUS2,
      `missing=${day2.presentedMissing} presented=${day2.presentedDay} stored=${day2.storedDay}`);
    const missByBlock = {};
    for (const b of day2.blocks) missByBlock[b.block] = b.tracks.filter((t) => t.kind === "episode" && t.available === false).map((t) => t.title);
    check("4 Morning named-missing set", JSON.stringify(missByBlock.Morning) === JSON.stringify(["Morning Prayer", "Daily Rosary", "Marian Antiphon — Angelus"]), JSON.stringify(missByBlock.Morning));
    check("4 Antiphon named-missing in Midday and Evening too",
      (missByBlock.Midday || []).join() === "Marian Antiphon — Angelus" && (missByBlock.Evening || []).join() === "Marian Antiphon — Angelus",
      `midday=${JSON.stringify(missByBlock.Midday)} evening=${JSON.stringify(missByBlock.Evening)}`);
    check("4 novenas named-missing once in Midmorning", (missByBlock.Midmorning || []).some((t) => t === "Novenas"), JSON.stringify(missByBlock.Midmorning));
    const morn2 = day2.blocks.find((b) => b.block === "Morning");
    check("4 Intentions card stands first in Morning from 'current'",
      morn2.tracks[0] && morn2.tracks[0].kind === "segment" && String(morn2.tracks[0].streamUrl || "").includes("/current/"), JSON.stringify((morn2.tracks[0] || {}).streamUrl));
    check("4 no +2 title anywhere in the missing payload", !JSON.stringify(day2).includes("PLUS2 TITLE"));

    // ================= staging for the floor legs ===================
    const toneA = tone("tone-a.mp3", 440, 1);
    for (const b of BLOCKS) {
      const r = await pushSegmentDoor(BASE, "current", b, toneA);
      if (r.status !== 200) throw new Error(`current segment stage ${b} -> ${r.status}`);
    }
    check("staging: 'current' segment objects staged via the door", true);
    const so = await pushAudioDoor(BASE, OLD, "ep-old", toneA);
    const st = await stageTextDoor(BASE, OLD, "ep-old", "old day text");
    const ss = await pushSegmentDoor(BASE, OLD, "Morning", toneA);
    const sp = await pushAudioDoor(BASE, PLUS1, "ep-plus1", toneA);
    check("staging: pre-floor + survivor objects staged", so.status === 200 && st.status === 200 && ss.status === 200 && sp.status === 200,
      `audio=${so.status} text=${st.status} seg=${ss.status} plus1=${sp.status}`);

    // ================= LEG 9 + 2 + 3 — the real push ================
    const rundir = path.join(TMPD, "rundir-v337");
    fs.mkdirSync(path.join(rundir, "out"), { recursive: true });
    const manifestEps = [
      ["morning-prayer", "Morning Prayer", 440], ["daily-rosary", "Daily Rosary", 450],
      ["marian-antiphon-angelus", "Marian Antiphon — Angelus", 460],
      ["novena-st-fixture", "Novena to St. Fixture", 470], ["novena-st-jude", "Novena to St. Jude", 480],
    ];
    for (const [key, , freq] of manifestEps) {
      fs.writeFileSync(path.join(rundir, "out", `${key}.mp3`), tone(`push-${key}.mp3`, freq, 1));
      // The helper's rundir IS the out directory (the sheet's step 4B
      // stages the scripts into it before pushing); the run-root copy
      // stands as the manifest's home.
      fs.writeFileSync(path.join(rundir, "out", `script-${key}.txt`), `Fixture script for ${key}.`);
      fs.writeFileSync(path.join(rundir, `script-${key}.txt`), `Fixture script for ${key}.`);
    }
    fs.writeFileSync(path.join(rundir, "report.json"), JSON.stringify({
      date: TODAY,
      episodes: Object.fromEntries(manifestEps.map(([key, title]) => [key, { title, file: `${key}.mp3`, duration_s: 60, status: "built" }])),
    }));
    const push = spawnSync("python3", [path.join(APP, "tests", "push-leg-v337.py"), String(PORT), path.join(rundir, "report.json"), path.join(rundir, "out")],
      { cwd: FORK, encoding: "utf8", timeout: 240000 });
    const pushOut = push.stdout + push.stderr;
    check("9 real push helper exits 0", push.status === 0, pushOut.slice(-400));
    check("9 manifest carries three Antiphon placements (7 entries, all present)",
      pushOut.includes("episodes 7 (7 present / 0 missing)"), pushOut.split("\n").find((l) => l.includes("App push")) || "");
    check("9 the helper's own read-backs verify all 7 placement rows",
      pushOut.includes("per-track audio verified 7") && pushOut.includes(`stored date after push ${TODAY}`), pushOut.split("\n").find((l) => l.includes("App push")) || "");
    const dayAfter = (await api(BASE, "GET", "/api/player/day")).body;
    const antiphonBlocks = dayAfter.blocks.filter((b) => b.tracks.some((t) => t.episodeId === "marian-antiphon-angelus")).map((b) => b.block);
    check("9 payload lists the Antiphon in Morning, Midday, Evening", JSON.stringify(antiphonBlocks) === JSON.stringify(["Morning", "Midday", "Evening"]), JSON.stringify(antiphonBlocks));
    const middayTracks = dayAfter.blocks.find((b) => b.block === "Midday").tracks.filter((t) => t.kind === "episode").map((t) => t.episodeId);
    check("9 Midday's only episode is the Antiphon (contract slot 1)", JSON.stringify(middayTracks) === JSON.stringify(["marian-antiphon-angelus"]), JSON.stringify(middayTracks));
    const antAudio = await apiRaw(BASE, `/api/player/audio/${TODAY}/marian-antiphon-angelus`);
    check("9 the one R2 object serves under the placements", antAudio.status === 200 && antAudio.buf.length > 0, `status=${antAudio.status}`);

    // LEG 2 — retention floor at commit
    const datesStanding = d1q(PERSIST, "SELECT DISTINCT date FROM player_episodes ORDER BY date;").map((r) => r.date);
    check("2 rows stand for every date >= floor and none older", JSON.stringify(datesStanding) === JSON.stringify([YDAY, TODAY, PLUS1, PLUS2].sort()), JSON.stringify(datesStanding));
    const singleton = d1q(PERSIST, "SELECT date FROM player_day WHERE id = 1;");
    check("2 the singleton names the pushed date", singleton[0] && singleton[0].date === TODAY, JSON.stringify(singleton));
    const audioDates = d1q(PERSIST, "SELECT date, COUNT(*) AS n FROM prayer_audio GROUP BY date ORDER BY date;");
    check("2 dated prayer_audio obeys the floor; 'current' untouched (6 rows)",
      !audioDates.some((r) => r.date === OLD) && (audioDates.find((r) => r.date === "current") || {}).n === 6, JSON.stringify(audioDates));
    // LEG 3 — the R2 sweep floor (rows + served survival as evidence)
    const oldAudio = await apiRaw(BASE, `/api/player/audio/${OLD}/ep-old`);
    const plusAudio = await apiRaw(BASE, `/api/player/audio/${PLUS1}/ep-plus1`);
    const curSeg = await apiRaw(BASE, `/api/prayer/audio/current/Morning`);
    const oldSeg = await apiRaw(BASE, `/api/prayer/audio/${OLD}/Morning`);
    check("3 pre-floor episode object swept (route 404)", oldAudio.status === 404, `status=${oldAudio.status}`);
    check("3 at-floor episode object survives (route 200)", plusAudio.status === 200, `status=${plusAudio.status}`);
    check("3 segments/current survives the sweep (route 200)", curSeg.status === 200, `status=${curSeg.status}`);
    check("3 pre-floor dated segment swept (route 404)", oldSeg.status === 404, `status=${oldSeg.status}`);

    // ================= LEG 8 (door half) — settings order ===========
    const settings = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
    const sByKey = Object.fromEntries(settings.sources.map((s) => [s.sourceKey, s]));
    const morningSettings = settings.sources.filter((s) => s.block === "Morning" && s.role === "primary" && s.enabled === 1)
      .sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.name);
    check("8 Morning settings order is the contract list", JSON.stringify(morningSettings) === JSON.stringify(
      ["Divine Office — Invitatory", "Morning Prayer", "Divine Office — Morning Prayer", "Daily Rosary", "Bible in a Year", "Marian Antiphon — Angelus"]), JSON.stringify(morningSettings));
    check("8 the StH fallback stands numbered at its slot's position",
      sByKey["sth-lauds"].sortOrder === sByKey["do-morning-prayer"].sortOrder && sByKey["sth-vespers"].sortOrder === sByKey["do-evening-prayer"].sortOrder,
      `lauds=${sByKey["sth-lauds"].sortOrder} domp=${sByKey["do-morning-prayer"].sortOrder}`);
    check("8 settings version stands at 2 after 0011", settings.version === 2, `version=${settings.version}`);

    // ================= LEG 5 — courier gates re-keyed ===============
    const liveToday = await api(BASE, "GET", `/api/player/externals/live?date=${TODAY}`);
    check("5 live courier accepts the presented day (200 shape)", liveToday.status === 200 && liveToday.body.date === TODAY && Array.isArray(liveToday.body.slots), `status=${liveToday.status}`);
    const livePlus = await api(BASE, "GET", `/api/player/externals/live?date=${PLUS2}`);
    check("5 live courier refuses +2 naming the presented day", livePlus.status === 400 && JSON.stringify(livePlus.body).includes(TODAY) && JSON.stringify(livePlus.body).includes("presented day"), `status=${livePlus.status} body=${JSON.stringify(livePlus.body).slice(0, 160)}`);
    const liveYday = await api(BASE, "GET", `/api/player/externals/live?date=${YDAY}`);
    check("5 live courier refuses yesterday too", liveYday.status === 400, `status=${liveYday.status}`);
    const audioPlus = await api(BASE, "GET", `/api/player/externals/audio?date=${PLUS2}&slot=ext-gospel-exegesis`);
    check("5 audio courier refuses +2 with the same gate", audioPlus.status === 400, `status=${audioPlus.status}`);
    const audioInv = await api(BASE, "GET", `/api/player/externals/audio?date=${TODAY}&slot=ext-invitatory`);
    check("5 audio courier passes the gate for the presented day (200 or named 404, never 400)", audioInv.status === 200 || audioInv.status === 404, `status=${audioInv.status}`);

    // ================= LEGS 10/11 (Worker + oracle halves) ==========
    const dgeWorker = await apiRaw(BASE, `/api/player/externals/audio?date=${TODAY}&slot=ext-gospel-exegesis`);
    check("10 Worker pass-through picks the presented-day Exegesis item", dgeWorker.status === 200 && dgeWorker.buf.equals(audioBytes("dge-today.mp3")), `status=${dgeWorker.status}`);
    const saintWorker = await apiRaw(BASE, `/api/player/externals/audio?date=${TODAY}&slot=ext-saint-of-the-day`);
    check("11 Worker pass-through picks the presented-day Saint item", saintWorker.status === 200 && saintWorker.buf.equals(audioBytes("saint-today.mp3")), `status=${saintWorker.status}`);
    fs.writeFileSync(path.join(TMPD, "dge.xml"), DGE_XML);
    fs.writeFileSync(path.join(TMPD, "saint.xml"), SAINT_XML);
    fs.writeFileSync(path.join(TMPD, "saint-bad.xml"), SAINT_BAD_XML);
    const oracle = spawnSync("python3", [path.join(APP, "tests", "oracle-leg-v337.py"),
      path.join(TMPD, "dge.xml"), path.join(TMPD, "saint.xml"), path.join(TMPD, "saint-bad.xml"), TODAY],
      { cwd: FORK, encoding: "utf8", timeout: 60000 });
    const oracleOut = oracle.stdout || "";
    check("10 oracle picks the same Exegesis enclosure", oracleOut.includes(`ORACLE dge=${FEED}/audio/dge-today.mp3`), oracleOut.split("\n")[0] || oracle.stderr);
    check("11 oracle picks the same Saint enclosure", oracleOut.includes(`ORACLE saint=${FEED}/audio/saint-today.mp3`));
    check("11 oracle stands the wrong-day Saint fixture missing", oracleOut.includes("ORACLE saint_bad=-"));
    check("13 join rule: a leading 'for' is not doubled", oracleOut.includes("ORACLE intro1=This prayer is for the fixture join rule"), oracleOut);
    check("13 template: a bare intention joins plainly", oracleOut.includes("ORACLE intro2=This prayer is for perseverance in prayer"));
    check("13 pairing: Antiphon pairs once to its home-block item; novenas pair per episode",
      oracleOut.includes("ORACLE pair-antiphon=Morning Marian Antiphon") && oracleOut.includes("ORACLE pair-novena=Novenas") && oracleOut.includes("ORACLE pair-none=None"));

    // ================= LEGS 13/14/15 — amended step 4D ==============
    const drawPost = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    check("13 draw for the consumption day stands", drawPost.status === 200, `status=${drawPost.status}`);
    const drawPayload = (await api(BASE, "GET", `/api/agent/prayer/day?date=${TODAY}`, { token: TOKEN })).body;
    let novenasIntention = null;
    for (const b of drawPayload.blocks || []) for (const d of b.devotions || []) {
      if (d.name === "Novenas" && d.intentions && d.intentions[0]) novenasIntention = d.intentions[0].text;
    }
    check("13 the Novenas item carries a drawn intention", !!novenasIntention, JSON.stringify(novenasIntention));
    const ttsStub = path.join(TMPD, "tts-stub.py");
    fs.writeFileSync(ttsStub, `#!/usr/bin/env python3
import os, sys
args = sys.argv[1:]
out = args[args.index("--output") + 1]
text = sys.stdin.read()
fail = os.environ.get("TTS_STUB_FAIL_SUBSTR", "")
if fail and fail in out:
    sys.exit(1)
with open(out, "wb") as f:
    f.write(b"STUBMP3:" + text.encode("utf-8")[:120])
log = os.environ.get("TTS_STUB_LOG")
if log:
    with open(log, "a") as f:
        f.write(out + "\\t" + text.replace("\\n", " ") + "\\n")
`);
    fs.chmodSync(ttsStub, 0o755);
    const segFixture = {};
    for (const b of BLOCKS) segFixture[b] = `Fixture segment text for ${b}.`;
    const segFile = path.join(TMPD, "segments-fixture.json");
    fs.writeFileSync(segFile, JSON.stringify(segFixture));
    const stubLog = path.join(TMPD, "tts-stub.log");
    fs.rmSync(stubLog, { force: true });
    const composeEnv = (extra) => ({ ...process.env, OPN_APP_BASE: BASE, OPN_APP_TOKEN: TOKEN,
      OPN_SEGMENTS_FILE: segFile, OPN_TTS_CMD: ttsStub, OPN_RETRY_DELAY_S: "0", TTS_STUB_LOG: stubLog, ...extra });
    const runCompose = (extra) => spawnSync("python3", [path.join(FORK, "jobs", "compose_app_audio.py"), "--date", TODAY],
      { cwd: FORK, encoding: "utf8", timeout: 240000, env: composeEnv(extra || {}) });
    const settingsNow = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
    const slotIds = settingsNow.sources.filter((s) => s.family === "external" && s.enabled === 1 && s.role !== "fallback").map((s) => s.slotId);
    const ownIds = manifestEps.map(([k]) => k);
    const eligible = ownIds.length + slotIds.length;
    const c1 = runCompose();
    const c1Out = c1.stdout + c1.stderr;
    const field1 = c1Out.split("\n").find((l) => l.startsWith("Segments (v337):")) || "";
    check("13 compose run exits 0", c1.status === 0, c1Out.slice(-300));
    check("13 Segments field exact shape, all standing", field1 ===
      `Segments (v337): standing — segments 6/6 for presented ${TODAY} · intros ${eligible}/${eligible} for presented ${TODAY} · missing: none`, field1);
    const intros1 = (await api(BASE, "GET", "/api/agent/prayer/intros", { token: TOKEN })).body;
    const introIds = (intros1.intros || []).map((r) => r.episodeId);
    check("13 intros stand for every paired presented track (each novena separately)",
      introIds.length === eligible && ownIds.every((id) => introIds.includes(id)) && slotIds.every((id) => introIds.includes(id)),
      `count=${introIds.length} eligible=${eligible}`);
    const stored = (await api(BASE, "GET", "/api/agent/player/stored-day", { token: TOKEN })).body;
    check("13 six standing segments read back", (stored.segmentBlocks || []).length === 6, JSON.stringify(stored.segmentBlocks));
    const logLines = fs.readFileSync(stubLog, "utf8").split("\n").filter(Boolean);
    const segLines = logLines.filter((l) => l.includes("segment-"));
    check("13 segment renders use the Suite composition texts verbatim (dual-compose)",
      segLines.length === 6 && BLOCKS.every((b) => segLines.some((l) => l.includes(`segment-${b}.mp3`) && l.endsWith(segFixture[b]))), `${segLines.length} segment renders`);
    const judeLine = logLines.find((l) => l.includes("intro-novena-st-jude.mp3")) || "";
    check("13 intro text = template + the Novenas draw (join rule applied)",
      judeLine.endsWith("This prayer is for " + String(novenasIntention || "").replace(/^for\s+/i, "")), judeLine.slice(-160));
    const c2 = runCompose({ TTS_STUB_FAIL_SUBSTR: "novena-st-jude" });
    const field2 = (c2.stdout + c2.stderr).split("\n").find((l) => l.startsWith("Segments (v337):")) || "";
    check("13 one failed render is named by title; the run completes the rest",
      c2.status === 1 && field2.includes("Novena to St. Jude") && field2.includes(`intros ${eligible - 1}/${eligible}`), field2);
    // LEG 14 — composition absent: bounded retry, named, no substitute
    const segLinesBefore = fs.readFileSync(stubLog, "utf8").split("\n").filter((l) => l.includes("segment-")).length;
    const c3 = runCompose({ OPN_SEGMENTS_FILE: path.join(TMPD, "composition-absent.json") });
    const field3 = (c3.stdout + c3.stderr).split("\n").find((l) => l.startsWith("Segments (v337):")) || "";
    const segLinesAfter = fs.readFileSync(stubLog, "utf8").split("\n").filter((l) => l.includes("segment-")).length;
    check("14 missing composition: named, exit non-zero, no substitute composed",
      c3.status === 1 && field3.startsWith("Segments (v337): MISSING") && field3.includes(`segments: composition missing for ${TODAY}`) && segLinesAfter === segLinesBefore, field3);
    // LEG 15 — the interval fact pair
    const dayText = await (await fetch(BASE + "/api/player/day")).text();
    const intros2 = (await api(BASE, "GET", "/api/agent/prayer/intros", { token: TOKEN })).body;
    check("15 payload carries NO intro entries while the intro family stands populated",
      !dayText.includes("intro-audio") && !dayText.includes("Intention —") && (intros2.intros || []).length > 0,
      `intros=${(intros2.intros || []).length}`);

    // ================= LEG 12 — overrides win =======================
    const curSettings = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
    const putRows = curSettings.sources.map((x) => ({ sourceKey: x.sourceKey, block: x.block, dayRule: x.dayRule, enabled: x.enabled }));
    const iR = putRows.findIndex((x) => x.sourceKey === "daily-rosary");
    const iB = putRows.findIndex((x) => x.sourceKey === "bible-in-a-year");
    [putRows[iR], putRows[iB]] = [putRows[iB], putRows[iR]];
    const put = await api(BASE, "PUT", "/api/player/source-settings", { json: { sources: putRows } });
    check("12 session PUT accepted (whole-table write)", put.status === 200 && put.body.ok === true, `status=${put.status} ${JSON.stringify(put.body).slice(0, 120)}`);
    const afterPut = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
    const rosaryAfter = afterPut.sources.find((x) => x.sourceKey === "daily-rosary");
    const bibleAfter = afterPut.sources.find((x) => x.sourceKey === "bible-in-a-year");
    check("12 the settings read-back reflects the move (rosary renumbered after bible, version 3)",
      rosaryAfter.sortOrder === 6 && bibleAfter.sortOrder === 5 && afterPut.version === 3,
      `rosary=${rosaryAfter.sortOrder} bible=${bibleAfter.sortOrder} version=${afterPut.version}`);

    // ================= browser legs =================================
    const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
    const currentVersion = afterPut.version;
    const wireContext = async (saintXml) => {
      const ctx = await browser.newContext();
      await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => { feedHits.anchor++;
        route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }); });
      await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => { feedHits.buzz++;
        route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: saintXml }); });
      await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => { feedHits.fireside = (feedHits.fireside || 0) + 1;
        route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: feedBytes.biay }); });
      await ctx.route("https://feeds.castos.com/x8g54", (route) =>
        route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: feedBytes.sth }));
      await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) =>
        route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: toneA }));
      return ctx;
    };
    const settled = async (page) => {
      await page.waitForSelector("#play-all", { timeout: 20000 });
      for (let i = 0; i < 60; i++) {
        const done = await page.evaluate(() => {
          const s = window.state && window.state.extSlots;
          if (!s) return false;
          return ["ext-gospel-exegesis", "ext-saint-of-the-day", "ext-bible-in-a-year"].every((k) => s[k] && (s[k].state === "present" || s[k].state === "missing"));
        }).catch(() => false);
        if (done) return true;
        await sleep(1000);
      }
      return false;
    };
    const blockCards = (page, blockName) => page.evaluate((bn) => {
      const heads = [...document.querySelectorAll(".blockhead")];
      const head = heads.find((h) => (h.querySelector("h2") || {}).textContent === bn.toUpperCase());
      if (!head) return [];
      const out = [];
      let el = head.nextElementSibling;
      while (el && !el.classList.contains("blockhead")) {
        if (el.dataset && el.dataset.card) out.push(el.dataset.card);
        el = el.nextElementSibling;
      }
      return out;
    }, blockName);
    try {
      const ctxA = await wireContext(SAINT_XML);
      const pageA = await ctxA.newPage();
      const passThrough = [];
      pageA.on("request", (r) => { if (r.url().includes("/api/player/externals/audio")) passThrough.push(r.url()); });
      await pageA.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      check("browser: first open settles the externals", await settled(pageA));
      const slotsA = await pageA.evaluate(() => window.state.extSlots);
      check("10 client matcher picks the presented-day Exegesis item (parity x3)",
        slotsA["ext-gospel-exegesis"].enclosureUrl === `${FEED}/audio/dge-today.mp3`, JSON.stringify(slotsA["ext-gospel-exegesis"]));
      check("11 client matcher picks the presented-day Saint item (parity x3)",
        slotsA["ext-saint-of-the-day"].enclosureUrl === `${FEED}/audio/saint-today.mp3`, JSON.stringify(slotsA["ext-saint-of-the-day"]));
      check("10 Exegesis download takes the pass-through route", passThrough.some((u) => u.includes("slot=ext-gospel-exegesis")), JSON.stringify(passThrough));
      check("11 Saint download takes the direct route (no pass-through request)", !passThrough.some((u) => u.includes("slot=ext-saint-of-the-day")), JSON.stringify(passThrough));
      const rec = await pageA.evaluate(() => JSON.parse(localStorage.getItem("opn-ext-cache-v1") || "null"));
      check("6 cache record keyed to the PRESENTED date + current settings version",
        rec && rec.date === TODAY && rec.settingsVersion === currentVersion && rec.slots["ext-gospel-exegesis"].streamUrl === `${FEED}/audio/dge-today.mp3`,
        JSON.stringify(rec && { date: rec.date, v: rec.settingsVersion }));
      const morningCards = await blockCards(pageA, "Morning");
      check("8 Morning cards: Intentions, own in contract order, externals after (v334 queue rule)",
        JSON.stringify(morningCards) === JSON.stringify(["seg:Morning", "morning-prayer", "daily-rosary", "marian-antiphon-angelus", "ext-invitatory", "ext-morning-prayer", "ext-bible-in-a-year"]), JSON.stringify(morningCards));
      const midCards = await blockCards(pageA, "Midmorning");
      check("10 Exegesis card stands in Midmorning at the head of its externals",
        JSON.stringify(midCards) === JSON.stringify(["seg:Midmorning", "novena-st-fixture", "novena-st-jude", "ext-gospel-exegesis", "ext-midmorning-prayer"]), JSON.stringify(midCards));
      const hitsBefore = { ...feedHits };
      await pageA.reload({ waitUntil: "domcontentloaded" });
      check("browser: second open settles", await settled(pageA));
      check("6 valid cache record: the second open fetches no feed again for the cached slots",
        feedHits.anchor === hitsBefore.anchor && feedHits.buzz === hitsBefore.buzz,
        JSON.stringify({ before: hitsBefore, after: feedHits }) + " (a slot missing at first settle re-checks at open by design — the two present new slots are the leg's subject)");
      await pageA.evaluate((plus2) => {
        const r = JSON.parse(localStorage.getItem("opn-ext-cache-v1"));
        r.date = plus2;
        localStorage.setItem("opn-ext-cache-v1", JSON.stringify(r));
      }, PLUS2);
      await pageA.reload({ waitUntil: "domcontentloaded" });
      await settled(pageA);
      const rec2 = await pageA.evaluate(() => JSON.parse(localStorage.getItem("opn-ext-cache-v1") || "null"));
      check("6 a record keyed to the stored (+2) date is discarded whole and re-resolved",
        feedHits.anchor > hitsBefore.anchor && rec2 && rec2.date === TODAY, `anchor ${hitsBefore.anchor} -> ${feedHits.anchor}`);
      const hitsV = { ...feedHits };
      await pageA.evaluate((v) => {
        const r = JSON.parse(localStorage.getItem("opn-ext-cache-v1"));
        r.settingsVersion = v;
        localStorage.setItem("opn-ext-cache-v1", JSON.stringify(r));
      }, currentVersion - 1);
      await pageA.reload({ waitUntil: "domcontentloaded" });
      await settled(pageA);
      check("8/6 an old-settings-version record is invalidated by the 0011 bump",
        feedHits.anchor > hitsV.anchor, `anchor ${hitsV.anchor} -> ${feedHits.anchor}`);
      await ctxA.close();
      // Saint named-missing context (wrong-day title)
      const ctxB = await wireContext(SAINT_BAD_XML);
      const pageB = await ctxB.newPage();
      await pageB.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      await settled(pageB);
      const saintB = await pageB.evaluate(() => window.state.extSlots["ext-saint-of-the-day"]);
      check("11 a latest title with a different MM/DD stands named-missing (never a wrong-day saint)",
        saintB.state === "missing" && !saintB.enclosureUrl, JSON.stringify(saintB).slice(0, 200));
      await ctxB.close();
    } finally {
      await browser.close();
    }

    // ================= LEG 12 (restart half) ========================
    app1.kill("SIGTERM");
    await sleep(1500);
    const app1b = startApp(PORT, PERSIST);
    try {
      await waitUp(BASE);
      const afterRestart = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
      const rosaryFinal = afterRestart.sources.find((s) => s.sourceKey === "daily-rosary");
      check("12 a Worker restart re-applies nothing — the user's move stands", rosaryFinal.sortOrder === 6, `sort=${rosaryFinal.sortOrder}`);
    } finally {
      app1b.kill("SIGTERM");
    }

    // ================= LEG 17 — served build ========================
    const appJs = await (await fetch(BASE2 + "/app.js")).text().catch(() => "");
    const swJs = await (await fetch(BASE2 + "/sw.js")).text().catch(() => "");
    check("17 served client carries both new slots + the ported matchers",
      appJs.includes("ext-gospel-exegesis") && appJs.includes("ext-saint-of-the-day") && appJs.includes("extMatchLatestByDate") && appJs.includes("extMatchSaint"));
    check("17 SW pins ora-pro-nobis-v337-1 with the opn-ext-audio-v1 exemption verbatim",
      swJs.includes("ora-pro-nobis-v337-1") && swJs.includes('k !== "opn-ext-audio-v1"'), swJs.slice(0, 200));
    console.log("note - leg 16 regressions run COMPLETE by the gate runner alongside this harness; tallies land in §3");
  } finally {
    try { app1.kill("SIGTERM"); } catch (e) {}
    try { if (app2) app2.kill("SIGTERM"); } catch (e) {}
    feedServer.close();
  }
  console.log(`RESULT harness-v337: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
