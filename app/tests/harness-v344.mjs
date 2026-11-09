#!/usr/bin/env node
// harness-v344 — v344 PLAYED STATE + RESUME gate (Plan §2.11,
// 20 legs; leg 20 = the regression families, run separately and
// tallied in §3, the standing pattern).
//
//   1  store round-trip + schema + prune + corrupt-value degrade
//   2  queue completion marks played (before the advance)
//   3  single-play completion marks played (as it clears)
//   4  partial play does not mark (skip + pause; resume holds)
//   5  intro alone does not mark; the prayer then marks
//   6  sleep end-of-track marks (the divert path)
//   7  sleep minutes stop does not mark (the stop is a pause)
//   8  dot toggle (marked via, fill + title tone, no audio)
//   9  block mark-all (exactly the block's available tracks)
//  10  Play All + per-block play skip played (exact queues)
//  11  fully-played fallbacks (block + day; no Continue card)
//  12  Continue gate + naming + count ("N of M heard today")
//  13  Continue position carry + played stand-down
//  14  "Play everything instead" (the full unfiltered queue)
//  15  late-settling played slot never joins; unplayed joins live
//  16  novena across a simulated rollover (Day 8 → Day 9) +
//      the wording states + the no-"Day N" no-line rule
//  17  marker rendering seams (swap · insert · plain · none on
//      unavailable)
//  18  dock skip marks nothing; the skipped track joins a later
//      Continue queue
//  19  NO CHECKLIST guards + served build + SW pin v344-1
//  20  regression gate (families run separately — §3 tallies)
//
// Fixture posture (§2.11): the standing estate fixture (v343's
// mold) with real playable tones for every fixture audio file;
// the novena family carries st-fixture (Day 8 at presentation D,
// Day 9 at the simulated D+1, SAME episode id), st-jude (Day 5),
// st-anne (Day 1), and st-rita (a novena stem whose title carries
// no "Day N"). Counts in legs 10/12 are asserted EXACTLY against
// the live day build (payload order read from state.dayDescs),
// the Plan's "two of five" realized over the estate day.
// The rollover (leg 16) is simulated at the store level: a real
// midnight changes exactly two things — the presented date
// advances and the title rolls — so the harness ages the D
// record one day back in the store and re-presents with the
// Day 9 title; the accumulation assertion is the store's own.
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const FORK = path.resolve(APP, "..");
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v344 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/x.js");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8992, FEED_PORT = 8952, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v344");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v344-"));
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
const shift = (iso, days) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); };
const YDAY = shift(TODAY, -1);
const TOMORROW = shift(TODAY, 1);
const rfc = (iso, hour) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00Z`).toUTCString();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const wdMon0 = (iso) => { const [y, m, d] = iso.split("-").map(Number); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; };
const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const tvTitle = (iso) => `Daily TV Mass ${WDAYS[wdMon0(iso)]} ${longDate(iso)}`;
const readingsTitle = (iso) => `Daily Readings for ${longDate(iso)}`;
const doyOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000); };
const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th");

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
function wranglerD1(appDir, persist, file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"), "--persist-to", persist, "--file", file],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
}
function d1q(appDir, persist, sql) {
  const out = execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"),
    "--persist-to", persist, "--command", sql, "--json"],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[0].results || [];
}
function migFiles(appDir, upto = null) {
  const dir = path.join(appDir, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()
    .filter((f) => !upto || f <= upto)
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
}
function applyMigs(appDir, persist, extraSql = "", upto = null) {
  fs.rmSync(persist, { recursive: true, force: true });
  const parts = migFiles(appDir, upto);
  if (extraSql) parts.push(extraSql);
  const f = path.join(TMPD, `mig-${path.basename(persist)}.sql`);
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1(appDir, persist, f);
}
function tone(name, freq = 440, secs = 1.2) {
  const out = path.join(TMPD, name);
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${secs}`, "-codec:a", "libmp3lame", "-b:a", "32k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr);
  return fs.readFileSync(out);
}
// Real playable tones for EVERY fixture audio file (the played
// legs need true `ended` events): intros 1.0s, the rosary 12s
// (the leg-13 position carry seeks inside it), auxilium 6s (the
// leg-7 minutes stop must land mid-track), everything else 1.6s.
const TONE_1 = tone("t1.mp3", 660, 1.0);
const TONE_16 = tone("t16.mp3", 440, 1.6);
const TONE_6 = tone("t6.mp3", 520, 6.0);
const TONE_12 = tone("t12.mp3", 330, 12.0);
function toneFor(name) {
  if (name.startsWith("intro-")) return TONE_1;
  if (name.includes("daily-rosary")) return TONE_12;
  if (name.includes("auxilium")) return TONE_6;
  return TONE_16;
}
const procs = [];
function startApp(appDir, port, persist, extraVars = []) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1",
    "--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`,
    "--var", `EXT_DGE_FEED_URL:${FEED}/dge.xml`, "--var", `EXT_SAINT_FEED_URL:${FEED}/saint.xml`,
    "--var", `EXT_USCCB_FEED_URL:${FEED}/usccb.xml`, "--var", `EXT_TVMASS_FEED_URL:${FEED}/tvmass.xml`,
    "--var", `EXT_FRMIKE_FEED_URL:${FEED}/frmike.xml`, "--var", `EXT_BARRON_FEED_URL:${FEED}/barron.xml`, ...extraVars];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}

// ---- seed (the estate mold: items + the 11-intention pool) ------
// plus the calibrated fixture intentions 901-907 whose texts the
// draw is re-pointed to below.
const T_LONG = "For the repose of the soul of Margaret Ann Thibeaux, and for her whole family in their grief";
const T_NOVENA = "For the repose of the soul of Margaret";
const T_EXT = "For our daughter Camille";
const T_BIAY = "For Pam, for healing and rest";
const T_DGE = "For Dylan and his exams";
const T_EXACT2 = "For our son Dylan";
const T_SHORT = "For Ana.";
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
const FIXTURE_INTENTIONS = [
  [901, T_LONG], [902, T_EXACT2], [903, T_SHORT], [904, T_NOVENA], [905, T_EXT], [906, T_BIAY], [907, T_DGE],
];
const REPOINT = { 4: 901, 2: 902, 41: 903, 11: 904, 1: 905, 5: 906, 9: 907 };
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
  for (const [id, text] of FIXTURE_INTENTIONS) lines.push(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES (${id}, '${text.replace(/'/g, "''")}', 'M', 'active', '2026-11-01T00:00:00.000Z');`);
  return lines.join("\n");
}

// ---- external fixture feeds (v343's generated presented-day set)
const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Fixture</title>${items}</channel></rss>`;
const xitem = (title, pub, enc, len = 1000) => `<item><title>${title}</title><pubDate>${pub}</pubDate><enclosure url="${enc}" type="audio/mpeg" length="${len}"/></item>`;
const SUNDAY = shift(TODAY, -((wdMon0(TODAY) + 1) % 7));
const doTitle = (label) => `${MONTHS[Number(TODAY.slice(5, 7)) - 1]} ${ordinal(Number(TODAY.slice(8, 10)))}, ${TODAY.slice(0, 4)} – ${label} – Divine Office: Liturgy of the Hours`;
const DO_XML = rss(
  xitem(doTitle("Invitatory"), rfc(TODAY, 5), `${FEED}/audio/do-invitatory.mp3`) +
  xitem(doTitle("Morning Prayer"), rfc(TODAY, 5), `${FEED}/audio/do-morning.mp3`) +
  xitem(doTitle("Office of Readings"), rfc(TODAY, 5), `${FEED}/audio/do-office.mp3`));
const USCCB_XML = rss(
  xitem(readingsTitle(shift(TODAY, 3)), rfc(shift(TODAY, 3), 5), `${FEED}/audio/usccb-future3.mp3`) +
  xitem(readingsTitle(TODAY), rfc(TODAY, 5), `${FEED}/audio/usccb-today.mp3`) +
  xitem(readingsTitle(YDAY), rfc(YDAY, 5), `${FEED}/audio/usccb-yday.mp3`));
const TVMASS_XML = rss(
  xitem(tvTitle(TODAY), rfc(TODAY, 6), `${FEED}/audio/tvmass-today.mp3`) +
  xitem(tvTitle(YDAY), rfc(YDAY, 6), `${FEED}/audio/tvmass-yday.mp3`));
const FRMIKE_XML = rss(
  xitem("The Final Exam: The First Question", rfc(SUNDAY, 12), `${FEED}/audio/frmike-sunday.mp3`) +
  xitem("An Older Homily", rfc(shift(SUNDAY, -7), 12), `${FEED}/audio/frmike-older.mp3`));
const BARRON_XML = rss(
  xitem("Wisdom Is Seeking You Out", rfc(SUNDAY, 13), `${FEED}/audio/barron-sunday.mp3`) +
  xitem("An Older Sermon", rfc(shift(SUNDAY, -7), 13), `${FEED}/audio/barron-older.mp3`));
const DGE_XML = rss(
  xitem("Daily Gospel Exegesis — Presented", rfc(TODAY, 6), `${FEED}/audio/dge-today.mp3`) +
  xitem("Daily Gospel Exegesis — Old", rfc(YDAY, 6), `${FEED}/audio/dge-old.mp3`));
const mmdd = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const SAINT_XML = rss(xitem(`${mmdd(TODAY)} - St. Fixture`, rfc(TODAY, 5), `${FEED}/audio/saint-today.mp3`));
const BIAY_XML = rss(
  xitem(`Day ${doyOf(TODAY)}: Fixture Reading (${TODAY.slice(0, 4)})`, rfc(TODAY, 6), `${FEED}/audio/biay-today.mp3`) +
  xitem(`Day ${doyOf(YDAY)}: Fixture Reading (${YDAY.slice(0, 4)})`, rfc(YDAY, 6), `${FEED}/audio/biay-yday.mp3`));
const feedBytes = {
  sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")),
};

// ---- the podcast + intentions fixture feeds (client side) -------
// st-fixture's title day is a variable: Day 8 at presentation D,
// Day 9 at the simulated D+1 (leg 16), same stem = same id.
let fixtureNovenaDay = 8;
const ownItem = (stem, title, iso, hour = 12) =>
  `<item><title>${title} - ${longDate(iso)}</title><guid isPermaLink="false">${stem}::fixturehash</guid><pubDate>${rfc(iso, hour)}</pubDate><enclosure url="${FEED}/audio/${stem}.mp3" type="audio/mpeg" length="2048"/></item>`;
const ownTodayItems = () => [
  ownItem(`morning-prayer-elevenlabs-${TODAY}`, "Morning Prayer", TODAY),
  ownItem(`daily-rosary-${TODAY}`, "Daily Rosary", TODAY),
  ownItem(`marian-antiphon-angelus-${TODAY}`, "Marian Antiphon — Angelus", TODAY),
  ownItem(`${TODAY}-st-fixture-day-${fixtureNovenaDay}`, `Novena to St. Fixture — Day ${fixtureNovenaDay}`, TODAY),
  ownItem(`${TODAY}-st-jude-day-5`, "Novena to St. Jude — Day 5", TODAY),
  ownItem(`${TODAY}-st-anne-day-1`, "Novena to St. Anne — Day 1", TODAY),
  ownItem(`${TODAY}-st-rita-day-4`, "Novena to St. Rita", TODAY),
  ownItem(`auxilium-christianorum-${TODAY}`, "Auxilium Christianorum", TODAY),
  ownItem(`daily-reflection-${TODAY}`, "Daily Reflection", TODAY),
];
const OWN_YDAY_ITEMS = [
  ownItem(`morning-prayer-elevenlabs-${YDAY}`, "Morning Prayer", YDAY),
  ownItem(`daily-rosary-${YDAY}`, "Daily Rosary", YDAY),
];
const podcastXml = (todayItems, ydayItems = OWN_YDAY_ITEMS, tomorrow = true) =>
  rss((tomorrow ? ownItem(`morning-prayer-elevenlabs-${TOMORROW}`, "Morning Prayer", TOMORROW) : "") + todayItems.join("") + ydayItems.join(""));
const podcastMain = () => podcastXml(ownTodayItems());
const PODCAST_NO_AUX = podcastXml(ownTodayItems().filter((x) => !x.includes("auxilium")));
const INTRO_IDS = ["morning-prayer", "daily-rosary", "marian-antiphon-angelus", "novena-st-fixture", "novena-st-jude",
  "novena-st-anne", "novena-st-rita", "auxilium-christianorum", "daily-reflection", "ext-invitatory", "ext-bible-in-a-year", "ext-gospel-exegesis"];
const TRACK_TITLES = {
  "morning-prayer": "Morning Prayer", "daily-rosary": "Daily Rosary", "marian-antiphon-angelus": "Marian Antiphon — Angelus",
  "novena-st-fixture": "Novena to St. Fixture", "novena-st-jude": "Novena to St. Jude — Day 5",
  "novena-st-anne": "Novena to St. Anne — Day 1", "novena-st-rita": "Novena to St. Rita",
  "auxilium-christianorum": "Auxilium Christianorum", "daily-reflection": "Daily Reflection",
  "ext-invitatory": "Invitatory", "ext-bible-in-a-year": "Bible in a Year", "ext-gospel-exegesis": "Daily Gospel Exegesis",
};
const introItem = (id, len) =>
  `<item><title>Intention — ${TRACK_TITLES[id]}</title><guid isPermaLink="false">intentions-intro-${id}-${TODAY}</guid><pubDate>${rfc(TODAY, 0)}</pubDate><description>Intention audio.</description><enclosure url="${FEED}/audio/intro-${id}.mp3" type="audio/mpeg" length="${len}"/></item>`;
const segmentItem = (block, len) =>
  `<item><title>Intentions — ${block}</title><guid isPermaLink="false">intentions-segment-${block}-${TODAY}</guid><pubDate>${rfc(TODAY, 0)}</pubDate><description>Segment audio.</description><enclosure url="${FEED}/audio/segment-${block}.mp3" type="audio/mpeg" length="${len}"/></item>`;
const intentionsXml = (ids) => rss(ids.map((id, i) => introItem(id, 4100 + i * 137)).join("") + segmentItem("Morning", 9100));
const INTENTIONS_MAIN = intentionsXml(INTRO_IDS);
const INTENTIONS_NO_REFLECTION = intentionsXml(INTRO_IDS.filter((id) => id !== "daily-reflection"));

// ---- HTTP fixture server (Worker env feeds + audio host) ---------
const feedState = { audioDelayMs: {} };
const feedServer = http.createServer((req, res) => {
  const u = new URL(req.url, FEED);
  const cors = { "access-control-allow-origin": "*" };
  const xml = (body) => { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(body); };
  if (u.pathname === "/do.xml") return xml(DO_XML);
  if (u.pathname === "/biay.xml") return xml(BIAY_XML);
  if (u.pathname === "/sth.xml") return xml(feedBytes.sth);
  if (u.pathname === "/dge.xml") return xml(DGE_XML);
  if (u.pathname === "/saint.xml") return xml(SAINT_XML);
  if (u.pathname === "/usccb.xml") return xml(USCCB_XML);
  if (u.pathname === "/tvmass.xml") return xml(TVMASS_XML);
  if (u.pathname === "/frmike.xml") return xml(FRMIKE_XML);
  if (u.pathname === "/barron.xml") {
    const ua = req.headers["user-agent"] || "";
    if (!/Chrome\//.test(ua)) { res.writeHead(403); return res.end("forbidden"); }
    return xml(BARRON_XML);
  }
  if (u.pathname.startsWith("/audio/")) {
    // NO CORS header on the audio host (the probed posture).
    const name = u.pathname.slice(7);
    const delay = feedState.audioDelayMs[name] || 0;
    const sendAudio = () => {
      const buf = toneFor(name);
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (m) {
          const start = Number(m[1]); const end = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
          res.writeHead(206, { "content-type": "audio/mpeg", "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": String(end - start + 1) });
          return res.end(buf.subarray(start, end + 1));
        }
      }
      res.writeHead(200, { "content-type": "audio/mpeg", "accept-ranges": "bytes", "content-length": String(buf.length) });
      return res.end(buf);
    };
    if (delay) setTimeout(sendAudio, delay); else sendAudio();
    return;
  }
  res.writeHead(404); res.end();
});

// ---- HTTPS site (orapronobis.media, host-mapped in the browser) --
const siteState = { podcast: podcastMain(), intentions: INTENTIONS_MAIN, intentionsDelayMs: 0 };
let siteServer = null;
function startSite() {
  const crt = path.join(TMPD, "site.crt"), key = path.join(TMPD, "site.key");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", key, "-out", crt, "-days", "2", "-nodes",
    "-subj", "/CN=orapronobis.media", "-addext", "subjectAltName=DNS:orapronobis.media,DNS:audio.orapronobis.media"], { stdio: "pipe" });
  siteServer = https.createServer({ cert: fs.readFileSync(crt), key: fs.readFileSync(key) }, (req, res) => {
    const u = new URL(req.url, "https://orapronobis.media");
    if (u.pathname === "/podcast.xml") {
      res.writeHead(200, { "content-type": "application/rss+xml", "access-control-allow-origin": "*" });
      return res.end(siteState.podcast);
    }
    if (u.pathname === "/intentions.xml") {
      if (siteState.intentions == null) { res.writeHead(404); return res.end("not found"); }
      const sendIntentions = () => { res.writeHead(200, { "content-type": "application/rss+xml", "access-control-allow-origin": "*" }); res.end(siteState.intentions); };
      if (siteState.intentionsDelayMs) setTimeout(sendIntentions, siteState.intentionsDelayMs); else sendIntentions();
      return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise((r) => siteServer.listen(SITE_PORT, r));
}

async function main() {
  await new Promise((r) => feedServer.listen(FEED_PORT, r));
  await startSite();

  // ================= instance =====================================
  applyMigs(APP, PERSIST, seedSql());
  startApp(APP, PORT, PERSIST);
  check("setup: candidate app boots", await waitUp(BASE));
  const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
  check("setup: the day's draw stands", draw.status === 200, `status=${draw.status}`);
  for (const [itemId, intentionId] of Object.entries(REPOINT)) {
    d1q(APP, PERSIST, `UPDATE prayer_draws SET intention_id = ${intentionId} WHERE date = '${TODAY}' AND item_id = ${itemId};`);
  }
  for (const p of procs.splice(0)) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
  for (let i = 0; i < 15; i++) { try { await fetch(BASE + "/"); } catch { break; } await sleep(1000); }
  startApp(APP, PORT, PERSIST);
  check("setup: candidate app re-boots after the draw re-point", await waitUp(BASE));
  const prayerDay = (await api(BASE, "GET", `/api/agent/prayer/day?date=${TODAY}`, { token: TOKEN })).body;
  const drawText = {};
  for (const b of prayerDay.blocks || []) for (const d of b.devotions || []) drawText[d.name] = (d.intentions || [])[0] ? d.intentions[0].text : "";
  check("setup: re-pointed draws carry the calibrated texts",
    drawText["Daily Rosary"] === T_LONG && drawText["Morning Prayer"] === T_EXACT2 && drawText["Daily Reflection"] === T_SHORT &&
    drawText["Novenas"] === T_NOVENA && drawText["Invitatory"] === T_EXT && drawText["Bible in a Year"] === T_BIAY &&
    drawText["Daily Gospel Exegesis"] === T_DGE,
    JSON.stringify({ rosary: drawText["Daily Rosary"], mp: drawText["Morning Prayer"], inv: drawText["Invitatory"] }));

  // ================= LEG 19 (served half) ==========================
  const appJs = (await apiRaw(BASE, "/app.js")).buf.toString("utf8");
  const swJs = (await apiRaw(BASE, "/sw.js")).buf.toString("utf8");
  let servedParses = true;
  try { new Function(appJs.replace(/import[^;]+;/g, "")); } catch { servedParses = false; }
  check("19 served build parses and carries the v344 seams (store key, markCompleted, unplayedOnly, paintContinue, refreshPlayedChrome)",
    servedParses && appJs.includes("opn-played-v344") && appJs.includes("markCompleted") && appJs.includes("unplayedOnly") &&
    appJs.includes("paintContinue") && appJs.includes("refreshPlayedChrome"),
    `parses=${servedParses}`);
  check("19 SW pin ora-pro-nobis-v344-1 with the opn-ext-audio-v1 purge exemption verbatim",
    swJs.includes('var CACHE = "ora-pro-nobis-v344-1";') && swJs.includes('k !== CACHE && k !== "opn-ext-audio-v1"'));
  check("19 NO CHECKLIST source guard: no checkmark glyph in the served client or styles",
    !/[✓✔✅]/.test(appJs) && !/[✓✔✅]/.test(swJs));

  // ================= browser scaffolding ===========================
  const browserEnv = { ...process.env };
  for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
  const browser = await chromium.launch({
    executablePath: CHROME,
    env: browserEnv,
    args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server",
      "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
  });
  const wireExtRoutes = async (ctx) => {
    await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
    await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
    await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
    await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: BIAY_XML }));
    await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: TONE_16 }));
  };
  const newCtx = async (init) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await wireExtRoutes(ctx);
    if (init) await ctx.addInitScript(init);
    return ctx;
  };
  const waitOwnSettled = (page, timeout = 45000) => page.waitForFunction(() => {
    const s = window.state && window.state.ownSlots;
    if (!s || !Object.keys(s).length) return false;
    return Object.values(s).every((st) => st.state !== "loading");
  }, null, { timeout }).catch(() => {});
  const waitExtSettled = (page, timeout = 60000) => page.waitForFunction(() => {
    const s = window.state && window.state.extSlots;
    if (!s || !Object.keys(s).length) return false;
    return Object.values(s).every((st) => st.state !== "loading" && st.state !== "downloading");
  }, null, { timeout }).catch(() => {});
  const settle = async (page) => { await waitOwnSettled(page); await waitExtSettled(page); await sleep(400); };
  const store = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); } catch (e) { return { __corrupt: true }; } });
  const waitStoreHas = (page, id, timeout = 15000) => page.waitForFunction((x) => { try { const s = JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); return !!(s[x] && Object.keys(s[x]).length); } catch (e) { return false; } }, id, { timeout }).catch(() => {});
  const seekEnd = (page) => page.evaluate(() => { const a = document.getElementById("audio"); if (a && isFinite(a.duration) && a.duration > 0) a.currentTime = Math.max(0, a.duration - 0.05); });
  const waitPlaying = (page, id, timeout = 15000) => page.waitForFunction((x) => window.state.current && window.state.current.episodeId === x && !document.getElementById("audio").paused, id, { timeout }).catch(() => {});
  const availPrayers = (page) => page.evaluate(() => (window.state.dayDescs || []).filter((x) => x.kind !== "intention" && x.available).map((x) => x.episodeId));
  const fullDescs = (page) => page.evaluate(() => (window.state.dayDescs || []).map((x) => x.episodeId));
  // The filter's expected output, computed from the live build
  // over the FULL descriptor list (unavailable descriptors pass
  // through the filter untouched, exactly as the client does):
  // unplayed prayers in payload order, each unplayed prayer's
  // intro riding immediately before it (the §2.4 grouping).
  const expectedFiltered = (page) => page.evaluate((today) => {
    let played = {};
    try { played = JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); } catch (e) { /* empty */ }
    const isP = (id) => !!(played[id] && played[id][today]);
    const out = [];
    let pendingIntro = null;
    (window.state.dayDescs || []).forEach((x) => {
      if (x.kind === "intention") { pendingIntro = x.episodeId; return; }
      if (isP(x.episodeId)) { pendingIntro = null; return; }
      if (pendingIntro) { out.push(pendingIntro); pendingIntro = null; }
      out.push(x.episodeId);
    });
    return out;
  }, TODAY);
  const queueIds = (page) => page.evaluate(() => (window.state.queue || []).map((x) => x.episodeId));

  // ================= LEG 1a — corrupt value degrades ===============
  {
    const ctx = await newCtx(() => { try { localStorage.setItem("opn-played-v344", "{oops"); } catch (e) { /* noop */ } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "load" });
    await settle(page);
    const dots = await page.evaluate(() => document.querySelectorAll("[data-markplayed]").length);
    check("1 a corrupt stored value reads as empty — the day renders, dots stand hollow, no path throws",
      dots > 0, `dots=${dots}`);
    await page.click('[data-card="daily-reflection"] [data-markplayed]');
    const s = await store(page);
    check("1 the first write after a corrupt value lands a valid store (the degrade is total)",
      !!s && !s.__corrupt && !!(s["daily-reflection"] && s["daily-reflection"][TODAY]), JSON.stringify(s).slice(0, 200));
    await page.close(); await ctx.close();
  }

  // ================= LEG 1b — schema + prune =======================
  {
    const seedStore = {
      "old-ep": { [shift(TODAY, -121)]: { playedAt: "2026-01-01T00:00:00.000Z", via: "played" } },
      "recent-ep": { [shift(TODAY, -9)]: { playedAt: "2026-01-01T00:00:00.000Z", via: "marked" } },
    };
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await wireExtRoutes(ctx2);
    await ctx2.addInitScript((ss) => { try { localStorage.setItem("opn-played-v344", JSON.stringify(ss)); } catch (e) { /* noop */ } }, seedStore);
    const page = await ctx2.newPage();
    await page.goto(BASE + "/", { waitUntil: "load" });
    await settle(page);
    await page.click('[data-card="daily-reflection"] [data-markplayed]');
    const s = await store(page);
    const rec = s["daily-reflection"] && s["daily-reflection"][TODAY];
    check("1 store round-trip: a dot write lands the exact §2.2 shape (playedAt ISO + via) under episode id then presented date",
      !!rec && rec.via === "marked" && typeof rec.playedAt === "string" && isFinite(Date.parse(rec.playedAt)), JSON.stringify(s).slice(0, 300));
    check("1 prune on write: the 121-day-old entry is gone, the 9-day-old entry stands",
      !("old-ep" in s) && !!(s["recent-ep"] && s["recent-ep"][shift(TODAY, -9)]), JSON.stringify(Object.keys(s)));
    await page.close(); await ctx2.close();
  }

  // ================= OPEN A — legs 12a, 17, 8, 9, 12, 2, 5, 3, 4, 18, 6, 7
  const ctxA = await newCtx();
  const pageA = await ctxA.newPage();
  await pageA.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageA);

  check("12 fresh day: no Continue card stands (nothing played, no resume record)",
    (await pageA.evaluate(() => document.getElementById("continue-slot").innerHTML)) === "");

  const dotsA = await pageA.evaluate(() => {
    const own = document.querySelector('[data-card="morning-prayer"] [data-markplayed]');
    const ext = document.querySelector('[data-card="ext-invitatory"] [data-markplayed]');
    let unavailCard = null;
    document.querySelectorAll(".card").forEach((c) => { if (!unavailCard && c.querySelector(".notavail") && !c.querySelector("[data-playkey]")) unavailCard = c; });
    return { own: !!own, ext: !!ext, unavailDot: unavailCard ? !!unavailCard.querySelector("[data-markplayed]") : null, unavailFound: !!unavailCard };
  });
  check("17 a plain no-intro own card carries the dot; a settled external card (extSwapCard path) carries it in its standing state",
    dotsA.own && dotsA.ext, JSON.stringify(dotsA));
  check("17 an unavailable card carries NO dot",
    dotsA.unavailFound && dotsA.unavailDot === false, JSON.stringify(dotsA));

  // Leg 8 — dot toggle on the rosary.
  await pageA.click('[data-card="daily-rosary"] [data-markplayed]');
  const s8a = await store(pageA);
  const dot8a = await pageA.evaluate(() => {
    const c = document.querySelector('[data-card="daily-rosary"]');
    return { on: c.querySelector("[data-markplayed]").classList.contains("on"), heard: c.querySelector("h3").classList.contains("heard"),
      cur: window.state.current, paused: document.getElementById("audio").paused };
  });
  check("8 tapping a hollow dot writes via:\"marked\" for the presented date, fills the dot, steps the title to meta — and starts no audio",
    !!s8a["daily-rosary"] && s8a["daily-rosary"][TODAY] && s8a["daily-rosary"][TODAY].via === "marked" && dot8a.on && dot8a.heard && dot8a.cur === null && dot8a.paused,
    JSON.stringify({ s: s8a["daily-rosary"], dot: dot8a }));
  await pageA.click('[data-card="daily-rosary"] [data-markplayed]');
  const s8b = await store(pageA);
  const dot8b = await pageA.evaluate(() => {
    const c = document.querySelector('[data-card="daily-rosary"]');
    return { on: c.querySelector("[data-markplayed]").classList.contains("on"), heard: c.querySelector("h3").classList.contains("heard") };
  });
  check("8 tapping the filled dot removes the record; dot and title revert",
    !("daily-rosary" in s8b) && !dot8b.on && !dot8b.heard, JSON.stringify(dot8b));

  // Leg 9 — block mark-all on Night.
  const nightAvail = await pageA.evaluate(() => (window.state.dayDescs || []).filter((x) => x.kind !== "intention" && x.available && x.block === "Night").map((x) => x.episodeId));
  const lbl9a = await pageA.evaluate(() => document.querySelector('[data-markblock="Night"]').textContent);
  await pageA.click('[data-markblock="Night"]');
  const s9 = await store(pageA);
  const lbl9b = await pageA.evaluate(() => document.querySelector('[data-markblock="Night"]').textContent);
  check("9 the label reads \"Mark all played\" with unplayed standing; one tap marks exactly the block's available tracks (via marked), nothing else",
    lbl9a === "Mark all played" && nightAvail.length > 0 && nightAvail.every((id) => s9[id] && s9[id][TODAY] && s9[id][TODAY].via === "marked") &&
    Object.keys(s9).every((id) => nightAvail.includes(id)), JSON.stringify({ nightAvail, keys: Object.keys(s9) }));
  check("9 the label flips to \"Mark all unplayed\" on the fully-played block",
    lbl9b === "Mark all unplayed", lbl9b);
  await pageA.click('[data-markblock="Night"]');
  const s9b = await store(pageA);
  const lbl9c = await pageA.evaluate(() => document.querySelector('[data-markblock="Night"]').textContent);
  check("9 a second tap unmarks the block; the label returns",
    nightAvail.every((id) => !(id in s9b)) && lbl9c === "Mark all played", JSON.stringify(Object.keys(s9b)));

  // Leg 12 — naming + count with two played.
  await pageA.click('[data-card="morning-prayer"] [data-markplayed]');
  await pageA.click('[data-card="daily-rosary"] [data-markplayed]');
  const expFirst = await pageA.evaluate((today) => {
    let played = {};
    try { played = JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); } catch (e) { /* empty */ }
    const prayers = (window.state.dayDescs || []).filter((x) => x.kind !== "intention" && x.available);
    const first = prayers.find((x) => !(played[x.episodeId] && played[x.episodeId][today]));
    const blk = (window.state.dayPayload.blocks || []).find((b) => b.block === first.block);
    return { name: "Continue — " + (blk ? (blk.label || blk.block) : first.block) + " · " + first.title, count: prayers.filter((x) => played[x.episodeId] && played[x.episodeId][today]).length + " of " + prayers.length + " heard today" };
  }, TODAY);
  const card12 = await pageA.evaluate(() => { const s = document.getElementById("continue-slot"); return s ? s.textContent : ""; });
  check("12 after two tracks stand played the card stands, names the first unplayed in play order, and reads \"N of M heard today\" — position, no score, no percentage",
    card12.includes(expFirst.name) && card12.includes(expFirst.count) && !/%/.test(card12), JSON.stringify({ expFirst, card12: card12.slice(0, 200) }));
  await pageA.click('[data-card="morning-prayer"] [data-markplayed]');
  await pageA.click('[data-card="daily-rosary"] [data-markplayed]');
  check("12 unmarking back to a fresh day retires the card (the gate re-evaluates on every write)",
    (await pageA.evaluate(() => document.getElementById("continue-slot").innerHTML)) === "");

  // Leg 2 — queue completion. Play All on the clean store; the
  // first intro ends first (nothing marked), then its prayer.
  await pageA.click("#play-all");
  let prayer2 = null;
  for (let i = 0; i < 30; i++) {
    prayer2 = await pageA.evaluate(() => (window.state.current && window.state.current.kind !== "intention") ? window.state.current.episodeId : null);
    if (prayer2) break;
    await sleep(400);
  }
  const s2a = await store(pageA);
  check("2 (with leg 5) the queue's first intro ended into its prayer and wrote NOTHING for the prayer",
    !!prayer2 && !(prayer2 in s2a), JSON.stringify({ prayer2, keys: Object.keys(s2a) }));
  await seekEnd(pageA);
  await waitStoreHas(pageA, prayer2);
  const s2b = await store(pageA);
  const st2 = await pageA.evaluate(() => ({ cur: window.state.current && window.state.current.episodeId, paused: document.getElementById("audio").paused }));
  const rec2 = s2b[prayer2] && s2b[prayer2][TODAY];
  check("2 a queued track played to its end stands marked (via played, presented date) AND the queue has advanced — the next track stands started",
    !!rec2 && rec2.via === "played" && st2.cur !== null && st2.cur !== prayer2 && !st2.paused, JSON.stringify({ rec2, st2 }));
  const dot2 = await pageA.evaluate((id) => { const b = document.querySelector(`[data-card="${id}"] [data-markplayed]`); return b ? b.classList.contains("on") : null; }, prayer2);
  check("2 the completed track's dot stands filled in place", dot2 === true, `dot=${dot2}`);
  await pageA.evaluate(() => { document.getElementById("audio").pause(); });

  // Leg 5 — the rosary intro alone, then the rosary itself (new
  // page, same context: the store carries leg 2's mark only).
  const pageA5 = await ctxA.newPage();
  await pageA5.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageA5);
  await pageA5.click('[data-card="daily-rosary"] [data-playkey="intro:daily-rosary"]');
  await waitPlaying(pageA5, "intro:daily-rosary");
  await pageA5.waitForFunction(() => !window.state.current, null, { timeout: 20000 }).catch(() => {});
  const s5a = await store(pageA5);
  check("5 the panel intro played to ITS end writes nothing for the prayer (intro alone does not mark)",
    !("daily-rosary" in s5a), JSON.stringify(Object.keys(s5a)));
  await pageA5.click('[data-card="daily-rosary"] [data-playkey="daily-rosary"]');
  await waitPlaying(pageA5, "daily-rosary");
  await seekEnd(pageA5);
  await pageA5.waitForFunction(() => !window.state.current, null, { timeout: 20000 }).catch(() => {});
  const s5b = await store(pageA5);
  check("5 the prayer then played to its end stands marked (via played)",
    !!(s5b["daily-rosary"] && s5b["daily-rosary"][TODAY] && s5b["daily-rosary"][TODAY].via === "played"), JSON.stringify(s5b["daily-rosary"]));
  check("3 a lone track played to its end stands marked as it clears (state.current null after the end)",
    (await pageA5.evaluate(() => window.state.current)) === null);

  // Leg 4 — partial play: skip + pause (new page; a hand-built
  // queue of three known prayers, the v338 harness pattern).
  const pageA4 = await ctxA.newPage();
  await pageA4.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageA4);
  await pageA4.evaluate(() => {
    const d = (id) => (window.state.dayDescs || []).find((x) => x.episodeId === id);
    window.startQueue([d("auxilium-christianorum"), d("daily-reflection"), d("marian-antiphon-angelus")]);
  });
  await waitPlaying(pageA4, "auxilium-christianorum");
  await pageA4.evaluate(() => { const a = document.getElementById("audio"); a.currentTime = 1.0; });
  await sleep(250);
  await pageA4.click("#dock-next");
  await waitPlaying(pageA4, "daily-reflection");
  const s4a = await store(pageA4);
  check("4 a track played part-way then skipped (dock next) stands unplayed",
    !("auxilium-christianorum" in s4a), JSON.stringify(Object.keys(s4a)));
  await pageA4.evaluate(() => { const a = document.getElementById("audio"); a.currentTime = 0.2; });
  await pageA4.click("#dock-play");
  await sleep(500);
  const s4b = await store(pageA4);
  const resume4 = await pageA4.evaluate(() => { try { return JSON.parse(localStorage.getItem("opn-resume-v312") || "null"); } catch (e) { return null; } });
  check("4 a track paused part-way stands unplayed, and the resume record still holds its position",
    !("daily-reflection" in s4b) && !!resume4 && resume4.episodeId === "daily-reflection" && resume4.positionS > 0,
    JSON.stringify({ resume4, keys: Object.keys(s4b) }));
  // Leg 18 — the skipped track joins a later Continue queue.
  await pageA4.click('[data-card="marian-antiphon-angelus"] [data-markplayed]');
  await sleep(400);
  const hasContinue = await pageA4.evaluate(() => !!document.getElementById("continue-btn"));
  if (hasContinue) await pageA4.click("#continue-btn");
  await sleep(600);
  const q18 = await queueIds(pageA4);
  check("18 the dock-skipped track marks nothing and stands in a later Continue queue",
    hasContinue && q18.includes("auxilium-christianorum"), JSON.stringify({ hasContinue, q18 }));
  await pageA4.evaluate(() => { document.getElementById("audio").pause(); });
  await pageA4.close(); await pageA5.close();

  // Leg 6 — sleep end-of-track (new page; arm via the shipped seam).
  const pageA6 = await ctxA.newPage();
  await pageA6.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageA6);
  await pageA6.click("#play-all");
  // Wait until a PRAYER (not its intro) is the playing track.
  let pair6 = { cur: null, nxt: null };
  for (let i = 0; i < 30; i++) {
    pair6 = await pageA6.evaluate(() => ({
      cur: (window.state.current && window.state.current.kind !== "intention") ? window.state.current.episodeId : null,
      nxt: (window.state.queue[window.state.queueIdx + 1] || {}).episodeId || null,
    }));
    if (pair6.cur) break;
    await sleep(400);
  }
  await pageA6.evaluate(() => window.__opnSleep.armTrack());
  await seekEnd(pageA6);
  await sleep(1500);
  const s6 = await store(pageA6);
  const st6 = await pageA6.evaluate(() => ({ q: (window.state.queue || []).length, paused: document.getElementById("audio").paused, cur: window.state.current && window.state.current.episodeId }));
  check("6 with the timer armed to end-of-track, the playing track's natural end marks it played, and the next track stands held unstarted at its head (the standing v320 sleep shape: current = next, paused, queue intact)",
    !!pair6.cur && !!(s6[pair6.cur] && s6[pair6.cur][TODAY]) && st6.q > 0 && st6.paused && st6.cur === pair6.nxt, JSON.stringify({ pair6, st6 }));
  await pageA6.close();

  // Leg 7 — sleep minutes stop (new page).
  const pageA7 = await ctxA.newPage();
  await pageA7.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageA7);
  await pageA7.click('[data-card="auxilium-christianorum"] [data-playkey="auxilium-christianorum"]');
  await waitPlaying(pageA7, "auxilium-christianorum");
  await pageA7.evaluate(() => window.__opnSleep.armMinutes(0));
  await pageA7.waitForFunction(() => document.getElementById("audio").paused, null, { timeout: 8000 }).catch(() => {});
  await sleep(400);
  const s7 = await store(pageA7);
  const resume7 = await pageA7.evaluate(() => { try { return JSON.parse(localStorage.getItem("opn-resume-v312") || "null"); } catch (e) { return null; } });
  check("7 the minutes-mode stop fires mid-track as a pause: no played record, and the resume position stands saved",
    !("auxilium-christianorum" in s7) && !!resume7 && resume7.episodeId === "auxilium-christianorum" && resume7.positionS > 0,
    JSON.stringify({ resume7, keys: Object.keys(s7) }));
  await pageA7.close();
  await pageA.close(); await ctxA.close();

  // ================= OPEN B — legs 10, 14, 11 ======================
  const ctxB = await newCtx();
  const pageB = await ctxB.newPage();
  await pageB.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageB);
  const prayersB = await availPrayers(pageB);
  // Mark the first two available prayers via their dots.
  for (const id of prayersB.slice(0, 2)) await pageB.click(`[data-card="${id}"] [data-markplayed]`);
  await pageB.click("#play-all");
  await sleep(500);
  const q10 = await queueIds(pageB);
  const exp10 = await expectedFiltered(pageB);
  check("10 Play All's queue is exactly the unplayed in payload order — played prayers and their intros out, unplayed intros riding before their prayers",
    JSON.stringify(q10) === JSON.stringify(exp10) && q10.length > 0, JSON.stringify({ q10, exp10 }).slice(0, 400));
  await pageB.evaluate(() => { document.getElementById("audio").pause(); });
  // Leg 14 — Play everything instead (the Continue card stands: 2 played).
  await pageB.click("#continue-all");
  await sleep(500);
  const q14 = await queueIds(pageB);
  const exp14 = await fullDescs(pageB);
  check("14 \"Play everything instead\" starts the FULL unfiltered day queue (played tracks included, payload order)",
    JSON.stringify(q14) === JSON.stringify(exp14), JSON.stringify({ q14, exp14 }).slice(0, 400));
  await pageB.evaluate(() => { document.getElementById("audio").pause(); });
  // Per-block filter (leg 10, second half): Morning block.
  const pageB2 = await ctxB.newPage();
  await pageB2.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageB2);
  await pageB2.click('[data-queue="Morning"]');
  await sleep(500);
  const q10b = await queueIds(pageB2);
  const exp10bReal = await pageB2.evaluate((today) => {
    let played = {};
    try { played = JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); } catch (e) { /* empty */ }
    const isP = (id) => !!(played[id] && played[id][today]);
    const out = [];
    let pendingIntro = null;
    (window.state.dayDescs || []).filter((x) => x.available && x.block === "Morning").forEach((x) => {
      if (x.kind === "intention") { pendingIntro = x.episodeId; return; }
      if (isP(x.episodeId)) { pendingIntro = null; return; }
      if (pendingIntro) { out.push(pendingIntro); pendingIntro = null; }
      out.push(x.episodeId);
    });
    return out;
  }, TODAY);
  check("10 a block's play button filters the same way (Morning: exact filtered block queue)",
    JSON.stringify(q10b) === JSON.stringify(exp10bReal), JSON.stringify({ q10b, exp10bReal }).slice(0, 400));
  await pageB2.evaluate(() => { document.getElementById("audio").pause(); });
  await pageB2.close();
  // Leg 11 — fully-played fallbacks.
  const pageB3 = await ctxB.newPage();
  await pageB3.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageB3);
  await pageB3.click('[data-markblock="Night"]');
  await pageB3.click('[data-queue="Night"]');
  await sleep(500);
  const q11a = await queueIds(pageB3);
  const exp11a = await pageB3.evaluate(() => (window.state.dayDescs || []).filter((x) => x.block === "Night").map((x) => x.episodeId));
  check("11 a fully-played block plays in full from its button (the fallback, never a dead button)",
    JSON.stringify(q11a) === JSON.stringify(exp11a) && q11a.length > 0, JSON.stringify({ q11a, exp11a }));
  await pageB3.evaluate(() => { document.getElementById("audio").pause(); });
  // Mark every remaining block fully played, then Play All.
  const blocksB3 = await pageB3.evaluate(() => [...document.querySelectorAll("[data-markblock]")].map((b) => ({ block: b.getAttribute("data-markblock"), label: b.textContent })));
  for (const b of blocksB3) if (b.label === "Mark all played") await pageB3.click(`[data-markblock="${b.block}"]`);
  await sleep(400);
  check("11 no Continue card stands on the fully-played day",
    (await pageB3.evaluate(() => document.getElementById("continue-slot").innerHTML)) === "");
  await pageB3.click("#play-all");
  await sleep(500);
  const q11b = await queueIds(pageB3);
  const exp11b = await fullDescs(pageB3);
  check("11 a fully-played day plays in full from Play All (the fallback)",
    JSON.stringify(q11b) === JSON.stringify(exp11b) && q11b.length > 0, JSON.stringify({ n: q11b.length, m: exp11b.length }));
  await pageB3.evaluate(() => { document.getElementById("audio").pause(); });
  await pageB3.close(); await pageB.close(); await ctxB.close();

  // ================= OPEN C — leg 13 ===============================
  const ctxC = await newCtx();
  const pageC = await ctxC.newPage();
  await pageC.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageC);
  const prayersC = await availPrayers(pageC);
  await pageC.evaluate((args) => {
    const [ids, today] = args;
    const keep = ["daily-rosary", "daily-reflection"];
    const s = {};
    ids.filter((id) => !keep.includes(id)).forEach((id) => { s[id] = { [today]: { playedAt: new Date().toISOString(), via: "marked" } }; });
    localStorage.setItem("opn-played-v344", JSON.stringify(s));
    localStorage.setItem("opn-resume-v312", JSON.stringify({ episodeId: "daily-rosary", positionS: 5, date: today }));
  }, [prayersC, TODAY]);
  await pageC.reload({ waitUntil: "load" });
  await settle(pageC);
  const card13 = await pageC.evaluate(() => document.getElementById("continue-slot").textContent);
  check("13 with only the rosary + reflection unplayed and the resume record on the rosary, Continue names the rosary",
    card13.includes("Daily Rosary"), card13.slice(0, 200));
  await pageC.click("#continue-btn");
  await waitPlaying(pageC, "daily-rosary");
  let pos13 = -1;
  for (let i = 0; i < 20; i++) { pos13 = await pageC.evaluate(() => document.getElementById("audio").currentTime); if (pos13 >= 3) break; await sleep(400); }
  const q13 = await queueIds(pageC);
  const iIntroRefl = q13.indexOf("intro:daily-reflection");
  check("13 Continue starts the named track at the saved position (±2s of 5s) and the queue continues with the remaining unplayed (the rosary first; the reflection follows with its intro riding; no played available prayer stands in it)",
    pos13 >= 3 && pos13 <= 7 && q13[0] === "daily-rosary" && iIntroRefl > 0 && q13[iIntroRefl + 1] === "daily-reflection" &&
    q13.every((id) => !prayersC.includes(id) || id === "daily-rosary" || id === "daily-reflection"),
    JSON.stringify({ pos13, q13 }));
  await pageC.evaluate(() => { document.getElementById("audio").pause(); });
  // Stand-down: re-point the resume record at a PLAYED track.
  const pageC2 = await ctxC.newPage();
  await pageC2.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageC2);
  await pageC2.evaluate((today) => {
    localStorage.setItem("opn-resume-v312", JSON.stringify({ episodeId: "morning-prayer", positionS: 40, date: today }));
  }, TODAY);
  await pageC2.reload({ waitUntil: "load" });
  await settle(pageC2);
  const card13b = await pageC2.evaluate(() => document.getElementById("continue-slot").textContent);
  const resumeAtBtns = await pageC2.evaluate(() => document.querySelectorAll("[data-resumeat]").length);
  await pageC2.click("#continue-btn");
  await waitPlaying(pageC2, "daily-rosary");
  const pos13b = await pageC2.evaluate(() => document.getElementById("audio").currentTime);
  check("13 a resume record pointing at a PLAYED track stands down: Continue names the first unplayed, starts it from its head, and no \"Resume at …\" button stands",
    card13b.includes("Daily Rosary") && resumeAtBtns === 0 && pos13b < 3, JSON.stringify({ card13b: card13b.slice(0, 160), resumeAtBtns, pos13b }));
  await pageC2.evaluate(() => { document.getElementById("audio").pause(); });
  await pageC2.close(); await pageC.close(); await ctxC.close();

  // ================= OPEN C2 — leg 15 ==============================
  // (b) UNPLAYED late-settling slot joins its turn live.
  // Delay 3000, not 6000: the download chain is direct (fails on
  // the host's missing CORS after the delay) then the Worker
  // pass-through (the delay again) — 3s+3s lands present at ~9s,
  // inside the client's standing 9s resolve watchdog; 6s+6s is
  // watchdog-killed to named-missing for the open (standing
  // behavior, probed first-hand), so no present settle exists to
  // join. Late here means: still downloading at tap/build, settled
  // before its turn (the queue carries ~18s of audio ahead of it).
  feedState.audioDelayMs["do-invitatory.mp3"] = 3000;
  const ctxC3 = await newCtx();
  const pageC3 = await ctxC3.newPage();
  await pageC3.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(pageC3);
  await pageC3.click("#play-all");
  await sleep(400);
  const q15b = await queueIds(pageC3);
  check("15 the unplayed late-settling slot stands IN the Play All queue (passed through at build; availability is the live re-check's question)",
    q15b.includes("ext-invitatory"), JSON.stringify(q15b).slice(0, 300));
  // Let the slot settle present while the queue plays the tracks
  // ahead of it naturally (seek-racing first would burn its turn
  // while it still stands downloading — the skip is the standing
  // shape for a slot unpresent AT its turn, a different leg).
  for (let i = 0; i < 45; i++) {
    const st = await pageC3.evaluate(() => window.state.extSlots && window.state.extSlots["ext-invitatory"] && window.state.extSlots["ext-invitatory"].state);
    if (st === "present") break;
    await sleep(450);
  }
  let joined15 = false;
  for (let i = 0; i < 90; i++) {
    const cur = await pageC3.evaluate(() => window.state.current && window.state.current.episodeId);
    if (cur === "ext-invitatory") { joined15 = true; break; }
    await seekEnd(pageC3);
    await sleep(450);
  }
  check("15 when the slot settles, the queue's live re-check starts it at its turn, exactly as today",
    joined15, `joined=${joined15}`);
  await pageC3.evaluate(() => { document.getElementById("audio").pause(); });
  await pageC3.close(); await ctxC3.close();
  feedState.audioDelayMs = {};
  // (a) PLAYED late-settling slot never joins. Same 3s delay: the
  // slot must settle PRESENT for its card to stand marked (a
  // watchdog-missing card carries no dot by design).
  feedState.audioDelayMs["do-invitatory.mp3"] = 3000;
  const ctxC5 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await wireExtRoutes(ctxC5);
  await ctxC5.addInitScript((today) => {
    try { localStorage.setItem("opn-played-v344", JSON.stringify({ "ext-invitatory": { [today]: { playedAt: new Date().toISOString(), via: "marked" } } })); } catch (e) { /* noop */ } }, TODAY);
  const pageC5 = await ctxC5.newPage();
  await pageC5.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(pageC5);
  await pageC5.click("#play-all");
  await sleep(400);
  const q15a = await queueIds(pageC5);
  check("15 the PLAYED late-settling slot never enters the Play All queue (excluded at build time)",
    !q15a.includes("ext-invitatory") && q15a.length > 0, JSON.stringify(q15a).slice(0, 300));
  await waitExtSettled(pageC5);
  await sleep(400);
  const dot15 = await pageC5.evaluate(() => { const b = document.querySelector('[data-card="ext-invitatory"] [data-markplayed]'); return b ? b.classList.contains("on") : null; });
  const cur15 = await pageC5.evaluate(() => window.state.current && window.state.current.episodeId);
  check("15 the played slot settles into a card standing marked, and was never started at its turn",
    dot15 === true && cur15 !== "ext-invitatory", JSON.stringify({ dot15, cur15 }));
  await pageC5.evaluate(() => { document.getElementById("audio").pause(); });
  await pageC5.close(); await ctxC5.close();
  feedState.audioDelayMs = {};

  // ================= OPEN D — leg 16 + leg 19 (DOM half) ===========
  const ctxD = await newCtx();
  const pageD = await ctxD.newPage();
  await pageD.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageD);
  const nov = (page, id) => page.evaluate((x) => { const s = document.querySelector(`[data-novline="${x}"]`); return s ? s.textContent : null; }, id);
  check("16 wording state: at Day 5 with nothing prayed the line reads \"Day 5 of 9 · no days prayed yet\"",
    (await nov(pageD, "novena-st-jude")) === " · Day 5 of 9 · no days prayed yet", await nov(pageD, "novena-st-jude"));
  check("16 wording state: at Day 1 with nothing prayed the line reads \"Day 1 of 9 · not yet prayed\"",
    (await nov(pageD, "novena-st-anne")) === " · Day 1 of 9 · not yet prayed", await nov(pageD, "novena-st-anne"));
  check("16 a novena title carrying no \"Day N\" renders no line",
    (await nov(pageD, "novena-st-rita")) === null);
  check("16 at Day 8 with nothing prayed the line reads \"Day 8 of 9 · no days prayed yet\"",
    (await nov(pageD, "novena-st-fixture")) === " · Day 8 of 9 · no days prayed yet", await nov(pageD, "novena-st-fixture"));
  // Pray the Day 8 novena.
  await pageD.click('[data-card="novena-st-fixture"] [data-playkey="novena-st-fixture"]');
  await waitPlaying(pageD, "novena-st-fixture");
  await seekEnd(pageD);
  await pageD.waitForFunction(() => !window.state.current, null, { timeout: 20000 }).catch(() => {});
  check("16 praying the Day 8 novena lands the record and the line reads \"Day 8 of 9 · prayed 1 of 8 days\"",
    (await nov(pageD, "novena-st-fixture")) === " · Day 8 of 9 · prayed 1 of 8 days", await nov(pageD, "novena-st-fixture"));
  const storeD = await store(pageD);
  await pageD.close(); await ctxD.close();
  // Simulated rollover: age the D record to D-1 (= yesterday once
  // presented a day later), re-present with the Day 9 title.
  fixtureNovenaDay = 9;
  siteState.podcast = podcastMain();
  const aged = JSON.parse(JSON.stringify(storeD));
  if (aged["novena-st-fixture"] && aged["novena-st-fixture"][TODAY]) {
    aged["novena-st-fixture"][YDAY] = aged["novena-st-fixture"][TODAY];
    delete aged["novena-st-fixture"][TODAY];
  }
  const ctxD2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await wireExtRoutes(ctxD2);
  await ctxD2.addInitScript((ss) => { try { localStorage.setItem("opn-played-v344", JSON.stringify(ss)); } catch (e) { /* noop */ } }, aged);
  const pageD2 = await ctxD2.newPage();
  await pageD2.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageD2);
  check("16 re-presented a day later (same episode id, title Day 9): the line reads \"Day 9 of 9 · prayed 1 of 9 days\" — the D record accumulated under the one key",
    (await nov(pageD2, "novena-st-fixture")) === " · Day 9 of 9 · prayed 1 of 9 days", await nov(pageD2, "novena-st-fixture"));
  await pageD2.click('[data-card="novena-st-fixture"] [data-playkey="novena-st-fixture"]');
  await waitPlaying(pageD2, "novena-st-fixture");
  await seekEnd(pageD2);
  await pageD2.waitForFunction(() => !window.state.current, null, { timeout: 20000 }).catch(() => {});
  check("16 praying day 9 adds the second date under the same key: \"Day 9 of 9 · prayed 2 of 9 days\"",
    (await nov(pageD2, "novena-st-fixture")) === " · Day 9 of 9 · prayed 2 of 9 days", await nov(pageD2, "novena-st-fixture"));
  // Leg 17 (cache-insert seam): a cache-valid reload's inserted
  // cards carry their dots.
  await pageD2.reload({ waitUntil: "load" });
  await settle(pageD2);
  const dotCache = await pageD2.evaluate(() => {
    const c = document.querySelector('[data-card="daily-reflection"]');
    return c ? !!c.querySelector("[data-markplayed]") : null;
  });
  check("17 a cache-valid open's inserted card carries the dot",
    dotCache === true, `dot=${dotCache}`);
  // Leg 19 (DOM half).
  const dom19 = await pageD2.evaluate(() => document.getElementById("view").textContent);
  check("19 the rendered Listen DOM carries no checkmark glyph; the novena chrome reads \"prayed\"",
    !/[✓✔✅]/.test(dom19) && dom19.includes("prayed"), "");
  await pageD2.close(); await ctxD2.close();
  fixtureNovenaDay = 8;
  siteState.podcast = podcastMain();

  // ================= OPEN E — leg 17/9 unavailable seam ============
  siteState.podcast = PODCAST_NO_AUX;
  siteState.intentions = INTENTIONS_NO_REFLECTION;
  const ctxE = await newCtx();
  const pageE = await ctxE.newPage();
  await pageE.goto(BASE + "/", { waitUntil: "load" });
  await settle(pageE);
  const auxE = await pageE.evaluate(() => {
    const c = document.querySelector('[data-card="auxilium-christianorum"]');
    return c ? { dot: !!c.querySelector("[data-markplayed]"), notavail: !!c.querySelector(".notavail") } : null;
  });
  check("17 an unavailable own card (missing from the feed) carries NO dot",
    !!auxE && auxE.notavail && auxE.dot === false, JSON.stringify(auxE));
  await pageE.click('[data-markblock="Afternoon"]');
  const sE = await store(pageE);
  check("9 block mark-all never writes an unavailable track (auxilium stands unmarked after the Afternoon mark-all)",
    !("auxilium-christianorum" in sE), JSON.stringify(Object.keys(sE)));
  await pageE.close(); await ctxE.close();
  siteState.podcast = podcastMain();
  siteState.intentions = INTENTIONS_MAIN;

  await browser.close();
  console.log("\nleg 20 (regression gate): harness-v338 · harness-v339 · harness-v343 families + v334/v337 pristine-delta runs — executed separately, tallies in §3.");
  // ---- teardown ---------------------------------------------------
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* already gone */ } }
  try { feedServer.close(); } catch { /* noop */ }
  try { siteServer.close(); } catch { /* noop */ }
  console.log(`\nharness-v344: ${passed} passed, ${failed} failed`);
  if (fails.length) console.log("failures: " + fails.join(" · "));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("harness-v344 crashed:", e); for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } } process.exit(2); });
