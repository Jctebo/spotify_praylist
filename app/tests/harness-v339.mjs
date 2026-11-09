#!/usr/bin/env node
// harness-v339 — v339 MASS AND HOMILIES BLOCK gate (Plan §2.7, 15 legs
// + the regression family as leg 16, run separately). Tallies from
// COMPLETE log files only.
//
//   1  mirror parity: Worker PRAYER_BLOCKS, client SET_BLOCKS /
//      SET_SECTIONS agree — seven blocks, "Mass and Homilies" last;
//      EXTERNAL_SLOTS maps exactly the four new ids to the block;
//      served build parses
//   2  migration 0012 on a fresh 0011 D1: the four rows stand
//      placed (block · slot_id · sort 1–4 · enabled · family) with
//      day rules daily ×4; meta version incremented by exactly 1
//   3  migration guard: one row PUT-moved off seed first → 0012
//      leaves it standing, aligns the other three; second
//      application changes nothing (no double-place)
//   4  payload placement: /api/player/day emits the block last;
//      the courier payload carries the four slots in settings
//      order 1–4; the intros map carries the four slot ids
//   5  USCCB date discipline: fixture feed publishing ahead → the
//      pick for the presented day is that day's dated item, never
//      the latest
//   6  Sunday standing: the presented day (a Monday on the first
//      gate run) presents the standing Sunday's Fr. Mike + Barron
//      items; the oracle agrees for Monday and Sunday targets
//   7  Barron courier UA: fixture 403s a bare resolver UA, 200s a
//      browser UA → the courier fetch succeeds, pick == oracle
//   8  courier/pass-through parity: for all four slots — client
//      pick == courier pick == pass-through bytes == oracle pick
//   9  downloads: each resolved item downloads to the device
//      cache for the day and stands present from the local copy
//  10  intro generation: the step-4D helper (--intros-only) renders
//      four intros keyed by slot id from the Mass item's draw; a
//      forced render failure names the slot's title in the
//      Segments field and blocks nothing
//  11  treatment A in the block: combined rows, panel first ~25%
//      with its own play control; the intro plays from its panel
//  12  missing takes its intro: a slot standing missing shows no
//      intro in the block or the queue though its intro file
//      stands in the family
//  13  play order: day Play All ends with the block; the block
//      Play All queue is Readings · TV Mass · Fr. Mike · Barron
//      with intros interleaved
//  14  settings in the block: the Settings screen lists the
//      section; a PUT disable removes the source (and its intro)
//      from the payload; a PUT re-order reflects in block order;
//      a Worker restart re-applies nothing
//  15  served build + SW pin: ora-pro-nobis-v339-1 stands; the
//      opn-ext-audio-v1 purge exemption stands verbatim
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const FORK = path.resolve(APP, "..");
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v339 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/x.js");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8992, PORT2 = 8993, FEED_PORT = 8952;
const BASE = `http://127.0.0.1:${PORT}`, BASE2 = `http://127.0.0.1:${PORT2}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v339");
const PERSIST2 = path.join(APP, ".wrangler-test-v339-missing");
const PERSISTF = path.join(APP, ".wrangler-test-v339-fresh");
const PERSISTG = path.join(APP, ".wrangler-test-v339-guard");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v339-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");

let passed = 0, failed = 0; const fails = [];
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`ok - ${name}`); }
  else { failed++; fails.push(name); console.log(`FAIL - ${name}${detail ? " :: " + String(detail).slice(0, 400) : ""}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chicagoParts = (d) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
const isoOf = (p) => `${p.year}-${p.month}-${p.day}`;
const TODAY = isoOf(chicagoParts(new Date()));
const shift = (iso, days) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d + days)); return isoOf(chicagoParts(dt)); };
const YDAY = shift(TODAY, -1);
const wdMon0 = (iso) => { const [y, m, d] = iso.split("-").map(Number); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; };
const SUNDAY = shift(TODAY, -((wdMon0(TODAY) + 1) % 7)); // the standing Sunday (today if Sunday)
const MONDAY_AFTER = shift(SUNDAY, 1);
const rfc = (iso, hour) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00Z`).toUTCString();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const tvTitle = (iso) => `Daily TV Mass ${WDAYS[wdMon0(iso)]} ${longDate(iso)}`;
const readingsTitle = (iso) => `Daily Readings for ${longDate(iso)}`;

const api = async (base, method, p, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  let body;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
  if (opts.raw !== undefined) body = opts.raw;
  const res = await fetch(base + p, { method, headers, body, redirect: "manual" });
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, headers: res.headers };
};
const apiRaw = async (base, p, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(base + p, { method: "GET", headers, redirect: "manual" });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
};
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
let d1wSeq = 0;
function d1write(persist, sql) {
  const f = path.join(TMPD, `d1w-${process.pid}-${d1wSeq++}.sql`);
  fs.writeFileSync(f, sql);
  wranglerD1(persist, f);
}
function migFiles(upto = null) {
  const dir = path.join(APP, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()
    .filter((f) => !upto || f <= upto)
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
}
function applyMigs(persist, extraSql = "", upto = null) {
  fs.rmSync(persist, { recursive: true, force: true });
  const parts = migFiles(upto);
  if (extraSql) parts.push(extraSql);
  const f = path.join(TMPD, `mig-${path.basename(persist)}.sql`);
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1(persist, f);
}
function applyMigFile(persist, name) {
  wranglerD1(persist, path.join(APP, "migrations", name));
}
function tone(name, freq = 440, secs = 1.2) {
  const out = path.join(TMPD, name);
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${secs}`, "-codec:a", "libmp3lame", "-b:a", "32k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr);
  return fs.readFileSync(out);
}
const procs = [];
function startApp(port, persist, extraVars = []) {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1",
    "--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`,
    "--var", `EXT_DGE_FEED_URL:${FEED}/dge.xml`, "--var", `EXT_SAINT_FEED_URL:${FEED}/saint.xml`,
    "--var", `EXT_USCCB_FEED_URL:${FEED}/usccb.xml`, "--var", `EXT_TVMASS_FEED_URL:${FEED}/tvmass.xml`,
    "--var", `EXT_FRMIKE_FEED_URL:${FEED}/frmike.xml`, "--var", `EXT_BARRON_FEED_URL:${FEED}/barron.xml`, ...extraVars];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}

// ---- feeds ----------------------------------------------------------
const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Fixture</title>${items}</channel></rss>`;
const item = (title, pub, enc) => `<item><title>${title}</title><pubDate>${pub}</pubDate><enclosure url="${enc}" type="audio/mpeg" length="1000"/></item>`;
// USCCB publishes AHEAD: future items stand FIRST and LAST in the
// feed; the presented day's dated item stands in the middle.
const USCCB_XML = rss(
  item(readingsTitle(shift(TODAY, 10)), rfc(shift(TODAY, 10), 5), `${FEED}/audio/usccb-future10.mp3`) +
  item(readingsTitle(shift(TODAY, 3)), rfc(shift(TODAY, 3), 5), `${FEED}/audio/usccb-future3.mp3`) +
  item(readingsTitle(TODAY), rfc(TODAY, 5), `${FEED}/audio/usccb-today.mp3`) +
  item(readingsTitle(YDAY), rfc(YDAY, 5), `${FEED}/audio/usccb-yday.mp3`));
const TVMASS_XML = rss(
  item(tvTitle(TODAY), rfc(TODAY, 6), `${FEED}/audio/tvmass-today.mp3`) +
  item(tvTitle(YDAY), rfc(YDAY, 6), `${FEED}/audio/tvmass-yday.mp3`));
const FRMIKE_XML = rss(
  item("The Final Exam: The First Question", rfc(SUNDAY, 12), `${FEED}/audio/frmike-sunday.mp3`) +
  item("An Older Homily", rfc(shift(SUNDAY, -7), 12), `${FEED}/audio/frmike-older.mp3`));
const BARRON_XML = rss(
  item("Wisdom Is Seeking You Out", rfc(SUNDAY, 13), `${FEED}/audio/barron-sunday.mp3`) +
  item("An Older Sermon", rfc(shift(SUNDAY, -7), 13), `${FEED}/audio/barron-older.mp3`));
const DGE_XML = rss(
  item("Daily Gospel Exegesis — Presented", rfc(TODAY, 6), `${FEED}/audio/dge-today.mp3`) +
  item("Daily Gospel Exegesis — Old", rfc(YDAY, 6), `${FEED}/audio/dge-old.mp3`));
const mmdd = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const SAINT_XML = rss(item(`${mmdd(TODAY)} - St. Fixture`, rfc(TODAY, 5), `${FEED}/audio/saint-today.mp3`));
const feedBytes = {
  do: fs.readFileSync(path.join(FIX, "divine-office.xml")),
  biay: fs.readFileSync(path.join(FIX, "bible-in-a-year.xml")),
  sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")),
};
const audioBytes = (name) => Buffer.from(`AUDIO-FIXTURE:${name}:` + "x".repeat(64));
let barronHits = { bare: 0, browser: 0 };
const feedServer = http.createServer((req, res) => {
  const u = new URL(req.url, FEED);
  const cors = { "access-control-allow-origin": "*" };
  const xml = (body) => { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(body); };
  if (u.pathname === "/do.xml") return xml(feedBytes.do);
  if (u.pathname === "/biay.xml") return xml(feedBytes.biay);
  if (u.pathname === "/sth.xml") return xml(feedBytes.sth);
  if (u.pathname === "/dge.xml") return xml(DGE_XML);
  if (u.pathname === "/saint.xml") return xml(SAINT_XML);
  if (u.pathname === "/usccb.xml") return xml(USCCB_XML);
  if (u.pathname === "/tvmass.xml") return xml(TVMASS_XML);
  if (u.pathname === "/frmike.xml") return xml(FRMIKE_XML);
  if (u.pathname === "/barron.xml") {
    // Word on Fire's posture (§1): a bare resolver UA is refused.
    const ua = req.headers["user-agent"] || "";
    if (!/Chrome\//.test(ua)) { barronHits.bare++; res.writeHead(403); return res.end("forbidden"); }
    barronHits.browser++;
    return xml(BARRON_XML);
  }
  if (u.pathname === "/barron-broken.xml") { res.writeHead(404); return res.end(); }
  if (u.pathname.startsWith("/audio/")) { res.writeHead(200, { "content-type": "audio/mpeg", ...cors }); return res.end(audioBytes(u.pathname.slice(7))); }
  res.writeHead(404); res.end();
});

// ---- seed (the estate mold: items + the 11-intention pool) ----------
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
const SLOT_IDS = ["ext-usccb-readings", "ext-daily-tv-mass", "ext-fr-mike-homily", "ext-barron-sermon"];
const SLOT_ROWS = {
  "usccb-daily-readings": ["ext-usccb-readings", 1], "daily-tv-mass": ["ext-daily-tv-mass", 2],
  "fr-mike-homily": ["ext-fr-mike-homily", 3], "barron-sermon": ["ext-barron-sermon", 4],
};
const MANIFEST = [
  ["morning-prayer", "Morning Prayer", 440], ["daily-rosary", "Daily Rosary", 450],
  ["marian-antiphon-angelus", "Marian Antiphon — Angelus", 460],
  ["novena-st-fixture", "Novena to St. Fixture", 470], ["novena-st-jude", "Novena to St. Jude", 480],
  ["novena-st-rita", "Novena to St. Rita", 490], ["auxilium-christianorum", "Auxilium Christianorum", 500],
  ["daily-reflection", "Daily Reflection", 510],
];
const pushIntro = (base, id, buf) => api(base, "POST", "/api/agent/prayer/intro",
  { token: TOKEN, raw: buf, headers: { "content-type": "audio/mpeg", "x-prayer-date": "current", "x-episode-id": id } });

async function main() {
  await new Promise((r) => feedServer.listen(FEED_PORT, r));

  // ================= LEG 2 — migration on a fresh 0011 D1 ==========
  applyMigs(PERSISTF, "", "0011_player_contract_defaults.sql");
  const metaBefore = d1q(PERSISTF, "SELECT version FROM player_settings_meta WHERE id=1;")[0].version;
  applyMigFile(PERSISTF, "0012_mass_homilies_block.sql");
  const fresh = d1q(PERSISTF, "SELECT source_key, family, block, slot_id, sort_order, enabled, day_rule FROM player_source_settings WHERE source_key IN ('usccb-daily-readings','daily-tv-mass','fr-mike-homily','barron-sermon') ORDER BY sort_order;");
  check("2 fresh 0011 + 0012: the four rows stand placed in order 1–4",
    fresh.length === 4 && fresh.every((r) => {
      const [slot, sort] = SLOT_ROWS[r.source_key];
      return r.family === "external" && r.block === "Mass and Homilies" && r.slot_id === slot && r.sort_order === sort && r.enabled === 1;
    }), JSON.stringify(fresh));
  check("2 day rules corrected: daily ×4 (TV Mass + both homilies off sundays)",
    fresh.every((r) => r.day_rule === "daily"), JSON.stringify(fresh.map((r) => [r.source_key, r.day_rule])));
  const metaAfter = d1q(PERSISTF, "SELECT version FROM player_settings_meta WHERE id=1;")[0].version;
  check("2 meta version incremented by exactly 1 (relative)", metaAfter === metaBefore + 1, `${metaBefore} -> ${metaAfter}`);

  // ================= LEG 3 — the override guard ====================
  applyMigs(PERSISTG, "", "0011_player_contract_defaults.sql");
  d1write(PERSISTG, "UPDATE player_source_settings SET block='Night', sort_order=9, enabled=1 WHERE source_key='barron-sermon';");
  applyMigFile(PERSISTG, "0012_mass_homilies_block.sql");
  const guardRows = d1q(PERSISTG, "SELECT source_key, block, slot_id, sort_order, enabled FROM player_source_settings WHERE source_key IN ('usccb-daily-readings','daily-tv-mass','fr-mike-homily','barron-sermon');");
  const barronRow = guardRows.find((r) => r.source_key === "barron-sermon");
  const others = guardRows.filter((r) => r.source_key !== "barron-sermon");
  check("3 the user-moved row stands untouched (held override: barron-sermon in Night at 9, no slot)",
    barronRow.block === "Night" && barronRow.sort_order === 9 && barronRow.enabled === 1 && barronRow.slot_id === null,
    JSON.stringify(barronRow));
  check("3 the other three align under the same application",
    others.length === 3 && others.every((r) => r.block === "Mass and Homilies" && r.slot_id === SLOT_ROWS[r.source_key][0] && r.enabled === 1),
    JSON.stringify(others));
  const dump1 = JSON.stringify(d1q(PERSISTG, "SELECT * FROM player_source_settings ORDER BY source_key;"));
  applyMigFile(PERSISTG, "0012_mass_homilies_block.sql");
  const dump2 = JSON.stringify(d1q(PERSISTG, "SELECT * FROM player_source_settings ORDER BY source_key;"));
  check("3 second application changes nothing (no double-place)", dump1 === dump2);

  // ================= MAIN instance =================================
  applyMigs(PERSIST, seedSql());
  startApp(PORT, PERSIST);
  check("setup: main app boots", await waitUp(BASE));
  const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
  check("setup: the day's draw stands", draw.status === 200, `status=${draw.status}`);
  const prayerDay = (await api(BASE, "GET", `/api/agent/prayer/day?date=${TODAY}`, { token: TOKEN })).body;
  const drawText = {};
  for (const b of prayerDay.blocks || []) for (const d of b.devotions || []) drawText[d.name] = (d.intentions || [])[0] ? d.intentions[0].text : "";
  check("setup: the Mass item drew an intention", !!drawText["Mass"], JSON.stringify(Object.keys(drawText)));
  // The day commit through the REAL push helper.
  const rundir = path.join(TMPD, "rundir-v339");
  fs.mkdirSync(path.join(rundir, "out"), { recursive: true });
  for (const [key, , freq] of MANIFEST) {
    fs.writeFileSync(path.join(rundir, "out", `${key}.mp3`), tone(`push-${key}.mp3`, freq, 1));
    fs.writeFileSync(path.join(rundir, "out", `script-${key}.txt`), `Fixture script for ${key}.`);
    fs.writeFileSync(path.join(rundir, `script-${key}.txt`), `Fixture script for ${key}.`);
  }
  fs.writeFileSync(path.join(rundir, "report.json"), JSON.stringify({
    date: TODAY,
    episodes: Object.fromEntries(MANIFEST.map(([key, title]) => [key, { title, file: `${key}.mp3`, duration_s: 60, status: "built" }])),
  }));
  const push1 = spawnSync("python3", [path.join(APP, "tests", "push-leg-v339.py"), String(PORT), path.join(rundir, "report.json"), path.join(rundir, "out")],
    { cwd: FORK, encoding: "utf8", timeout: 240000 });
  check("setup: the real push helper commits the day", push1.status === 0, (push1.stdout + push1.stderr).slice(-300));

  // ================= LEG 10 — intro generation (step 4D) ===========
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
  const stubLog = path.join(TMPD, "tts-stub.log");
  const runCompose = (extra) => spawnSync("python3", [path.join(FORK, "jobs", "compose_app_audio.py"), "--date", TODAY, "--intros-only"],
    { cwd: FORK, encoding: "utf8", timeout: 240000, env: { ...process.env, OPN_APP_BASE: BASE, OPN_APP_TOKEN: TOKEN, OPN_TTS_CMD: ttsStub, OPN_RETRY_DELAY_S: "0", TTS_STUB_LOG: stubLog, ...extra } });
  const c1 = runCompose();
  const c1Out = c1.stdout + c1.stderr;
  check("10 compose run exits 0", c1.status === 0, c1Out.slice(-300));
  const intros1 = (await api(BASE, "GET", "/api/agent/prayer/intros", { token: TOKEN })).body;
  const introIds1 = (intros1.intros || []).map((r) => r.episodeId);
  check("10 four intro files keyed by slot id stand at 'current'",
    SLOT_IDS.every((id) => introIds1.includes(id)), JSON.stringify(introIds1));
  const stubLines = fs.existsSync(stubLog) ? fs.readFileSync(stubLog, "utf8").split("\n").filter(Boolean) : [];
  const massText = "This prayer is for " + String(drawText["Mass"] || "").replace(/^for\s+/i, "");
  check("10 each slot's intro renders from the Mass item's draw (template + for-join)",
    SLOT_IDS.every((id) => stubLines.some((l) => l.includes(`intro-${id}.mp3`) && l.endsWith(massText))),
    stubLines.filter((l) => l.includes("intro-ext-")).map((l) => l.slice(-80)).join(" | ").slice(0, 300));
  const field1 = c1Out.split("\n").find((l) => l.startsWith("Segments (v337):")) || "";
  check("10 Segments field reports the four standing (no block-slot missing)",
    field1.includes("standing") && !/usccb|TV Mass|Fr\. Mike|Barron/.test(field1.split("missing:")[1] || ""), field1);
  const c2 = runCompose({ TTS_STUB_FAIL_SUBSTR: "ext-barron-sermon" });
  const c2Out = c2.stdout + c2.stderr;
  const field2 = c2Out.split("\n").find((l) => l.startsWith("Segments (v337):")) || "";
  check("10 a forced render failure names the slot's title in the Segments field and blocks nothing (the run completes the rest; the helper's standing contract exits 1 on any missing)",
    field2.includes("Bp. Barron Sunday Sermon") && /intros \d+\/\d+/.test(field2) && c2Out.includes("compose_app_audio: presented"), `status=${c2.status} field=${field2}`);
  const intros2 = (await api(BASE, "GET", "/api/agent/prayer/intros", { token: TOKEN })).body;
  check("10 the other slots' intros survive the failed run (the step completes the rest)",
    SLOT_IDS.every((id) => (intros2.intros || []).some((r) => r.episodeId === id)));

  // ================= LEGS 1/4/5/6/7 (HTTP halves) ==================
  const day = (await api(BASE, "GET", "/api/player/day")).body;
  check("4 payload emits seven blocks, Mass and Homilies last",
    (day.blocks || []).length === 7 && day.blocks[6].block === "Mass and Homilies",
    JSON.stringify((day.blocks || []).map((b) => b.block)));
  check("4 the payload's intros map carries the four slot ids, titled for the Mass item",
    SLOT_IDS.every((id) => day.intros && day.intros[id] && day.intros[id].title === "Intention — Bp. Barron Sunday Sermon".replace("Bp. Barron Sunday Sermon", SLOT_TITLE[id]) && day.intros[id].text === drawText["Mass"] && day.intros[id].streamUrl === `/api/player/intro-audio/${id}`),
    JSON.stringify(Object.keys(day.intros || {})));
  const live = (await api(BASE, "GET", `/api/player/externals/live?date=${TODAY}`)).body;
  const liveSlots = (live.slots || []).filter((s) => SLOT_IDS.includes(s.slotId));
  const settingsNow = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
  const fourRows = settingsNow.sources.filter((s) => SLOT_IDS.includes(s.slotId)).sort((a, b) => a.sortOrder - b.sortOrder);
  check("4 the block's four slots stand in settings order 1–4; the courier payload carries its three courier-class slots with their orders",
    fourRows.map((s) => s.slotId).join(",") === SLOT_IDS.join(",") && fourRows.map((s) => s.sortOrder).join(",") === "1,2,3,4" &&
    liveSlots.length === 3 && liveSlots.every((s) => s.sortOrder === fourRows.find((r) => r.slotId === s.slotId).sortOrder),
    JSON.stringify(liveSlots.map((s) => [s.slotId, s.sortOrder, s.state])));
  const usccbPick = (live.slots || []).find((s) => s.slotId === "ext-usccb-readings");
  check("5 USCCB date discipline: the presented day's dated item, never the latest (feed publishes +10d)",
    !!usccbPick && usccbPick.state === "present" && usccbPick.streamUrl === `${FEED}/audio/usccb-today.mp3`,
    JSON.stringify(usccbPick));
  const frmikePick = (live.slots || []).find((s) => s.slotId === "ext-fr-mike-homily");
  const barronPick = (live.slots || []).find((s) => s.slotId === "ext-barron-sermon");
  check("6 Sunday standing: the presented day presents the standing Sunday's homilies",
    !!frmikePick && frmikePick.streamUrl === `${FEED}/audio/frmike-sunday.mp3` &&
    !!barronPick && barronPick.streamUrl === `${FEED}/audio/barron-sunday.mp3`,
    `presented=${TODAY} sunday=${SUNDAY} frmike=${frmikePick && frmikePick.streamUrl} barron=${barronPick && barronPick.streamUrl}`);
  check("7 Barron courier UA: the fixture refused the bare UA posture and the browser-UA fetch succeeded",
    barronHits.browser >= 1 && !!barronPick && barronPick.state === "present",
    JSON.stringify(barronHits));
  // The oracle (Python) — the ports prove against it, never themselves.
  const oraclePy = path.join(TMPD, "oracle-v339.py");
  fs.writeFileSync(oraclePy, `
import importlib.util, datetime, json, sys
spec = importlib.util.spec_from_file_location("res", ${JSON.stringify(path.join(FORK, "jobs", "externals_resolver.py"))})
res = importlib.util.module_from_spec(spec); spec.loader.exec_module(res)
def go(fn, xml, target):
    items = res.parse_feed(xml.encode())
    it = getattr(res, fn)(items, target)
    return it["url"] if it else None
out = {
  "usccb_today": go("match_usccb_readings", ${JSON.stringify(USCCB_XML)}, datetime.date.fromisoformat(${JSON.stringify(TODAY)})),
  "usccb_monday": go("match_usccb_readings", ${JSON.stringify(USCCB_XML)}, datetime.date.fromisoformat(${JSON.stringify(MONDAY_AFTER)})),
  "tvmass_today": go("match_daily_tv_mass", ${JSON.stringify(TVMASS_XML)}, datetime.date.fromisoformat(${JSON.stringify(TODAY)})),
  "frmike_monday": go("match_fr_mike_homily", ${JSON.stringify(FRMIKE_XML)}, datetime.date.fromisoformat(${JSON.stringify(MONDAY_AFTER)})),
  "frmike_sunday": go("match_fr_mike_homily", ${JSON.stringify(FRMIKE_XML)}, datetime.date.fromisoformat(${JSON.stringify(SUNDAY)})),
  "barron_monday": go("match_barron_sermon", ${JSON.stringify(BARRON_XML)}, datetime.date.fromisoformat(${JSON.stringify(MONDAY_AFTER)})),
}
print(json.dumps(out))
`);
  const oracleRun = spawnSync("python3", [oraclePy], { encoding: "utf8" });
  const oracle = oracleRun.status === 0 ? JSON.parse(oracleRun.stdout.trim()) : {};
  check("6 oracle: Monday after the Sunday presents the same Sunday items (weekly standing)",
    oracle.frmike_monday === `${FEED}/audio/frmike-sunday.mp3` && oracle.barron_monday === `${FEED}/audio/barron-sunday.mp3` &&
    oracle.frmike_sunday === `${FEED}/audio/frmike-sunday.mp3`, JSON.stringify(oracle));
  check("5 oracle agrees: USCCB pick is the dated item for the presented day",
    oracle.usccb_today === `${FEED}/audio/usccb-today.mp3`, JSON.stringify(oracle));

  // ================= LEG 8 — pass-through parity ===================
  const expectBytes = {
    "ext-usccb-readings": "usccb-today.mp3", "ext-daily-tv-mass": "tvmass-today.mp3",
    "ext-fr-mike-homily": "frmike-sunday.mp3", "ext-barron-sermon": "barron-sunday.mp3",
  };
  for (const slot of SLOT_IDS) {
    const pt = await apiRaw(BASE, `/api/player/externals/audio?date=${TODAY}&slot=${slot}`);
    check(`8 pass-through parity: ${slot} serves the oracle/courier pick`,
      pt.status === 200 && pt.buf.equals(audioBytes(expectBytes[slot])),
      `status=${pt.status} len=${pt.buf.length}`);
  }
  check("8 oracle parity: TV Mass pick == the client/courier pick",
    oracle.tvmass_today === `${FEED}/audio/tvmass-today.mp3`, JSON.stringify(oracle));

  // ================= LEG 15 — served build + SW pin ================
  const appJs = (await apiRaw(BASE, "/app.js")).buf.toString("utf8");
  const swJs = (await apiRaw(BASE, "/sw.js")).buf.toString("utf8");
  check("15 served SW pins ora-pro-nobis-v339-1", swJs.includes('var CACHE = "ora-pro-nobis-v339-1";'));
  check("15 the opn-ext-audio-v1 purge exemption stands verbatim in the served SW",
    swJs.includes('k !== CACHE && k !== "opn-ext-audio-v1"'));
  const srcIndex = fs.readFileSync(path.join(APP, "worker", "src", "index.ts"), "utf8");
  const srcClient = fs.readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
  const blocksOf = (txt) => { const m = txt.match(/PRAYER_BLOCKS = \[([^\]]+)\]|SET_BLOCKS = \[([^\]]+)\]/); return (m[1] || m[2]).split(",").map((s) => s.trim().replace(/["']/g, "")); };
  check("1 mirror parity: Worker + client block lists agree, seven, Mass and Homilies last",
    JSON.stringify(blocksOf(srcIndex)) === JSON.stringify(blocksOf(srcClient)) && blocksOf(srcIndex).length === 7 && blocksOf(srcIndex)[6] === "Mass and Homilies",
    `${JSON.stringify(blocksOf(srcIndex))} vs ${JSON.stringify(blocksOf(srcClient))}`);
  check("1 EXTERNAL_SLOTS maps exactly the four new ids to the block; SET_SECTIONS carries the section",
    SLOT_IDS.every((id) => srcIndex.includes(`"${id}": "Mass and Homilies"`)) &&
    srcClient.includes("'Mass and Homilies', 'No block', 'Off'") &&
    SLOT_IDS.every((id) => srcClient.includes(`slotId: '${id}'`)));
  let servedParses = true;
  try { new Function(appJs.replace(/import[^;]+;/g, "")); } catch { servedParses = false; }
  check("1 served build parses (client bundle is valid JS)", servedParses && appJs.includes("extMatchTvMass") && appJs.includes("ext-usccb-readings"));

  // ================= browser legs (8 client half · 9 · 11 · 13) ====
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  // The client-direct legs fetch their feeds at their real URLs —
  // the gate replays the fixtures there (the v337 pattern).
  await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
  await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
  await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForFunction(() => {
    const cards = document.querySelectorAll('[data-card^="ext-"]');
    return cards.length >= 4;
  }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => {
    const s = window.state && window.state.extSlots;
    if (!s) return false;
    return ["ext-usccb-readings", "ext-daily-tv-mass", "ext-fr-mike-homily", "ext-barron-sermon"]
      .every((id) => s[id] && s[id].state === "present");
  }, null, { timeout: 45000 }).catch(() => {});
  const clientPicks = await page.evaluate(() => {
    const out = {};
    for (const id of Object.keys(window.state.extSlots || {})) {
      const st = window.state.extSlots[id];
      out[id] = { state: st.state, enclosureUrl: st.enclosureUrl || null };
    }
    return out;
  }).catch(() => ({}));
  check("8 client half: the client's picks equal the courier/oracle picks (TV Mass direct; the rest via courier)",
    clientPicks["ext-usccb-readings"] && clientPicks["ext-usccb-readings"].enclosureUrl === `${FEED}/audio/usccb-today.mp3` &&
    clientPicks["ext-daily-tv-mass"] && clientPicks["ext-daily-tv-mass"].enclosureUrl === `${FEED}/audio/tvmass-today.mp3` &&
    clientPicks["ext-fr-mike-homily"] && clientPicks["ext-fr-mike-homily"].enclosureUrl === `${FEED}/audio/frmike-sunday.mp3` &&
    clientPicks["ext-barron-sermon"] && clientPicks["ext-barron-sermon"].enclosureUrl === `${FEED}/audio/barron-sunday.mp3`,
    JSON.stringify(clientPicks));
  const blockCards = await page.evaluate(() => {
    const heads = [...document.querySelectorAll(".blockhead h2")];
    const massHead = heads.find((h) => h.textContent.trim() === "MASS AND HOMILIES");
    const order = heads.map((h) => h.textContent.trim());
    const cards = [...document.querySelectorAll('[data-card^="ext-"]')].map((e) => e.getAttribute("data-card"));
    return { order, cards, hasMass: !!massHead };
  });
  check("8 client half: the block section stands last in the day list with its four cards",
    blockCards.hasMass && blockCards.order[blockCards.order.length - 1] === "MASS AND HOMILIES" &&
    SLOT_IDS.every((id) => blockCards.cards.includes(id)), JSON.stringify(blockCards));
  const cacheKeys = await page.evaluate(async () => {
    const c = await caches.open("opn-ext-audio-v1");
    const reqs = await c.keys();
    return reqs.map((r) => new URL(r.url).pathname.split("/").pop());
  }).catch(() => []);
  check("9 downloads: the four items stand in the device audio cache for the day",
    SLOT_IDS.every((id) => cacheKeys.includes(id)), JSON.stringify(cacheKeys));
  const panelInfo = await page.evaluate(() => {
    const out = {};
    for (const id of ["ext-usccb-readings", "ext-daily-tv-mass", "ext-fr-mike-homily", "ext-barron-sermon"]) {
      const card = document.querySelector(`[data-card="${id}"]`);
      if (!card) { out[id] = null; continue; }
      const panel = card.querySelector(".intention-panel");
      const row = card.querySelector(".row");
      out[id] = {
        combined: card.classList.contains("intro-row"),
        panelFirst: !!panel && !!row && row.firstElementChild === panel,
        panelPct: panel && row ? Math.round((panel.getBoundingClientRect().width / row.getBoundingClientRect().width) * 100) : -1,
        ownBtn: !!card.querySelector(`[data-playkey="intro:${id}"]`),
      };
    }
    return out;
  });
  check("11 treatment A in the block: combined rows, panel first at ~25%, own play control",
    SLOT_IDS.every((id) => panelInfo[id] && panelInfo[id].combined && panelInfo[id].panelFirst && panelInfo[id].ownBtn && panelInfo[id].panelPct >= 18 && panelInfo[id].panelPct <= 34),
    JSON.stringify(panelInfo));
  await page.click('[data-card="ext-usccb-readings"] [data-playkey="intro:ext-usccb-readings"]');
  await page.waitForFunction(() => {
    const t = document.getElementById("dock-title");
    return t && t.textContent.includes("Intention");
  }, null, { timeout: 10000 }).catch(() => {});
  const dockText = await page.evaluate(() => (document.getElementById("dock-title") || {}).textContent || "");
  check("11 the intro plays from its panel (the dock names the intention)", dockText.includes("Intention — USCCB Daily Readings"), dockText.slice(0, 120));
  await page.evaluate(() => { window.state.queue = []; });
  // Play order (13): the day descriptor list ends with the block;
  // the block Play All queue is the four intro pairs in order.
  const dayDescIds = await page.evaluate(() => window.state.dayDescs.map((d) => d.episodeId)).catch(() => []);
  check("13 day Play All ends with the block: the day queue's tail is the four pairs in order",
    JSON.stringify(dayDescIds.slice(-8)) === JSON.stringify(SLOT_IDS.flatMap((id) => [`intro:${id}`, id])),
    JSON.stringify(dayDescIds.slice(-10)));
  const queueIds = await page.evaluate(() => {
    const descs = window.state.dayDescs.filter((d) => d.block === "Mass and Homilies");
    window.startQueue(descs);
    return window.state.queue.map((d) => d.episodeId);
  }).catch(() => []);
  check("13 block queue: pairs in order Readings · TV Mass · Fr. Mike · Barron",
    JSON.stringify(queueIds) === JSON.stringify(SLOT_IDS.flatMap((id) => [`intro:${id}`, id])),
    JSON.stringify(queueIds));
  await page.evaluate(() => { window.state.queue = []; });

  // ================= LEG 14 — settings in the block ================
  const settingsPage = await ctx.newPage();
  await settingsPage.goto(BASE + "/", { waitUntil: "load" });
  await settingsPage.click("#gearbtn");
  await sleep(1500);
  const settingsText = await settingsPage.evaluate(() => document.body.textContent);
  check("14 the Settings screen lists the Mass and Homilies section with the four sources",
    settingsText.includes("Mass and Homilies") && ["USCCB Daily Readings", "Daily TV Mass", "Fr. Mike Sunday Homily", "Bp. Barron Sunday Sermon"].every((t) => settingsText.includes(t)));
  const curSettings = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
  const putRows = curSettings.sources.map((x) => ({ sourceKey: x.sourceKey, block: x.block, dayRule: x.dayRule, enabled: x.enabled }));
  const dis = putRows.map((r) => r.sourceKey === "barron-sermon" ? { ...r, enabled: 0 } : r);
  const put1 = await api(BASE, "PUT", "/api/player/source-settings", { json: { sources: dis } });
  const dayAfterDisable = (await api(BASE, "GET", "/api/player/day")).body;
  const liveAfterDisable = (await api(BASE, "GET", `/api/player/externals/live?date=${TODAY}`)).body;
  check("14 a PUT disable removes the source (and its intro) from the payloads",
    put1.status === 200 && !(dayAfterDisable.intros || {})["ext-barron-sermon"] &&
    !(liveAfterDisable.slots || []).some((s) => s.slotId === "ext-barron-sermon"),
    `put=${put1.status}`);
  const re = putRows.map((r) => {
    if (r.sourceKey === "usccb-daily-readings") return { ...r, block: "Mass and Homilies" };
    return r;
  });
  // Reorder: swap the block assignment order by moving Readings to
  // sort last via a block-internal reorder — the settings PUT sorts
  // by array position within the block, so reverse the four rows.
  const idxs = re.map((r, i) => [r, i]).filter(([r]) => ["usccb-daily-readings", "daily-tv-mass", "fr-mike-homily", "barron-sermon"].includes(r.sourceKey)).map(([, i]) => i);
  const four = idxs.map((i) => re[i]).reverse();
  idxs.forEach((pos, k) => { re[pos] = four[k]; });
  const put2 = await api(BASE, "PUT", "/api/player/source-settings", { json: { sources: re } });
  const liveAfterReorder = (await api(BASE, "GET", `/api/player/externals/live?date=${TODAY}`)).body;
  const orderAfter = (liveAfterReorder.slots || []).filter((s) => SLOT_IDS.includes(s.slotId))
    .sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.slotId);
  check("14 a PUT re-order reflects in the block order (Barron first after the reversal)",
    put2.status === 200 && orderAfter[0] === "ext-barron-sermon", JSON.stringify(orderAfter));
  const settingsDump1 = JSON.stringify(d1q(PERSIST, "SELECT source_key, block, slot_id, sort_order, enabled, day_rule FROM player_source_settings ORDER BY source_key;"));
  applyMigFile(PERSIST, "0012_mass_homilies_block.sql");
  const settingsDump2 = JSON.stringify(d1q(PERSIST, "SELECT source_key, block, slot_id, sort_order, enabled, day_rule FROM player_source_settings ORDER BY source_key;"));
  check("14 nothing re-applies the defaults over a user's moves (0012 re-run against the live D1 changes nothing)",
    settingsDump1 === settingsDump2);
  await settingsPage.close();
  await page.close();
  await ctx.close();
  await browser.close();

  // ================= LEG 12 — missing takes its intro ==============
  applyMigs(PERSIST2, seedSql());
  startApp(PORT2, PERSIST2, [`EXT_BARRON_FEED_URL:${FEED}/barron-broken.xml`]);
  check("setup: missing-instance app boots", await waitUp(BASE2));
  await api(BASE2, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
  const rundir2 = path.join(TMPD, "rundir-v339-missing");
  fs.mkdirSync(path.join(rundir2, "out"), { recursive: true });
  for (const [key, , freq] of MANIFEST) {
    fs.writeFileSync(path.join(rundir2, "out", `${key}.mp3`), tone(`push2-${key}.mp3`, freq, 1));
    fs.writeFileSync(path.join(rundir2, "out", `script-${key}.txt`), `Fixture script for ${key}.`);
    fs.writeFileSync(path.join(rundir2, `script-${key}.txt`), `Fixture script for ${key}.`);
  }
  fs.writeFileSync(path.join(rundir2, "report.json"), JSON.stringify({
    date: TODAY,
    episodes: Object.fromEntries(MANIFEST.map(([key, title]) => [key, { title, file: `${key}.mp3`, duration_s: 60, status: "built" }])),
  }));
  spawnSync("python3", [path.join(APP, "tests", "push-leg-v339.py"), String(PORT2), path.join(rundir2, "report.json"), path.join(rundir2, "out")],
    { cwd: FORK, encoding: "utf8", timeout: 240000 });
  // The Barron intro STANDS in the family; its feed is broken.
  const bi = await pushIntro(BASE2, "ext-barron-sermon", tone("intro-barron-missing.mp3", 320, 1));
  check("setup: the missing slot's intro stands in the family", bi.status === 200 || bi.status === 201, `status=${bi.status}`);
  const live2 = (await api(BASE2, "GET", `/api/player/externals/live?date=${TODAY}`)).body;
  const barron2 = (live2.slots || []).find((s) => s.slotId === "ext-barron-sermon");
  check("12 the slot stands named-missing when its feed fails", !!barron2 && barron2.state === "missing", JSON.stringify(barron2));
  const browser2 = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx2 = await browser2.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(BASE2 + "/", { waitUntil: "load" });
  await page2.waitForFunction(() => {
    const els = [...document.querySelectorAll('[data-card="ext-barron-sermon"]')];
    return els.length === 1 && !els[0].textContent.includes("Loading");
  }, null, { timeout: 30000 }).catch(() => {});
  const missingDom = await page2.evaluate(() => {
    const card = document.querySelector('[data-card="ext-barron-sermon"]');
    return { hasPanel: !!card && !!card.querySelector(".intention-panel"), text: card ? card.textContent.slice(0, 120) : "" };
  });
  check("12 missing takes its intro: no panel stands for the missing slot though its intro file stands",
    missingDom.hasPanel === false, JSON.stringify(missingDom));
  await page2.close(); await ctx2.close(); await browser2.close();

  // ---- teardown -----------------------------------------------------
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* already gone */ } }
  try { feedServer.close(); } catch { /* noop */ }
  console.log(`\nharness-v339: ${passed} passed, ${failed} failed`);
  if (fails.length) console.log("failures: " + fails.join(" · "));
  process.exit(failed ? 1 : 0);
}
const SLOT_TITLE = {
  "ext-usccb-readings": "USCCB Daily Readings", "ext-daily-tv-mass": "Daily TV Mass",
  "ext-fr-mike-homily": "Fr. Mike Sunday Homily", "ext-barron-sermon": "Bp. Barron Sunday Sermon",
};
main().catch((e) => { console.error("harness-v339 crashed:", e); for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } } process.exit(2); });
