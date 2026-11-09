#!/usr/bin/env node
// harness-v343 — v343 UNIFORM INTENTION ROWS gate (Plan §2.8,
// 11 legs; leg-family regressions v342 · v339 · v338 · v337 ·
// v336 · v335 · v334 run separately and are tallied in §3).
// Tallies from COMPLETE log files only.
//
//   1  fixture integrity: the presented-day Divine Office courier
//      fixture settles the DO slots present (not named-missing);
//      the intros fixture stands complete for the fixture day
//   2  uniform height + clip guard: every .card.intro-row stands
//      at offsetHeight === 136 and scrollHeight <= 137 collapsed
//   3  ellipsis standing: the >2-line panel shows .ellipsis-btn
//      .stands; the one-line and the exact-two-line panels show
//      no standing ellipsis (the rendered-height test, both ways)
//   4  toggle: tapping ⋯ expands that row only (height > 136,
//      full text visible, aria-expanded true); all other rows
//      stay 136; the expansion survives the row's settle
//      re-render (session set); tapping again restores 136
//   5  item 3 — fresh open, late intro: with the intentions
//      source held past a Divine Office courier slot's settle
//      (and a client-direct slot's), the settled panel-free card
//      gains .intention-panel in the same session, no reopen
//   6  item 3 — cache-valid open: a second open on a valid day
//      cache renders settled external cards WITH panels
//   7  panel correctness at settle: a settled external card's
//      panel text equals that slot's drawn intention text; its
//      panel play button stands and resolves a descriptor
//   8  compact chrome: computed styles on a combined row (card
//      padding 9px · panel padding-right 8px · label margin 2px ·
//      text margin 6px · fonts 13/14/17 · buttons 42/30)
//   9  untouched shapes: a no-intro own card and an unavailable
//      card carry no intro-row class and no fixed height
//  10  panel play still plays: the panel's own play button on a
//      combined row starts its intro descriptor
//  11  served build: the served client parses and executes; the
//      served SW pin reads ora-pro-nobis-v343-1
//
// Fixture texts are CALIBRATED at the 390px verdict viewport
// against the candidate CSS (Plan's measurement method): the
// panel text width is ~75px, so the seeded draw texts land in
// exact line classes — T_LONG 8 lines, T_NOVENA 4 lines,
// T_EXT/T_BIAY/T_DGE 3 lines, T_EXACT2 exactly 2 lines
// (scrollHeight == clientHeight == 39: nothing hidden, no
// ellipsis), T_SHORT 1 line. Draws are re-pointed per item in
// D1 after the draw so each paired track carries its class.
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v343 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/x.js");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8992, FEED_PORT = 8952, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v343");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v343-"));
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
// item_id -> fixture intention id (the length class that item's
// paired tracks must carry)
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

// ---- external fixture feeds --------------------------------------
// The Divine Office feed is GENERATED for the presented day (the
// §2.8 fixture pin): items carry TODAY's month-day in the real
// feed's title shape, so the courier slots settle present by
// construction on any run date.
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
// BIAY feed GENERATED presented-day (like the DO feed): the
// captured fixture's Day-N items carry prior years in their
// titles, and extMatchBible admits only the current year's —
// the stale capture settles the slot named-missing in every
// open. The generated feed carries a current-year Day-N item
// (day-of-year of the presented date) with a presented-day
// pubDate.
const BIAY_XML = rss(
  xitem(`Day ${doyOf(TODAY)}: Fixture Reading (${TODAY.slice(0, 4)})`, rfc(TODAY, 6), `${FEED}/audio/biay-today.mp3`) +
  xitem(`Day ${doyOf(YDAY)}: Fixture Reading (${YDAY.slice(0, 4)})`, rfc(YDAY, 6), `${FEED}/audio/biay-yday.mp3`));
const feedBytes = {
  sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")),
};
const audioBytes = (name) => Buffer.from(`AUDIO-FIXTURE:${name}:` + "x".repeat(64));
const TONE_MP = tone("own-morning.mp3", 440, 2.0);
const TONE_INTRO_MP = tone("own-intro.mp3", 660, 1.0);

// ---- the podcast + intentions fixture feeds (client side) -------
const ownItem = (stem, title, iso, hour = 12) =>
  `<item><title>${title} - ${longDate(iso)}</title><guid isPermaLink="false">${stem}::fixturehash</guid><pubDate>${rfc(iso, hour)}</pubDate><enclosure url="${FEED}/audio/${stem}.mp3" type="audio/mpeg" length="2048"/></item>`;
const OWN_TODAY_ITEMS = [
  ownItem(`morning-prayer-elevenlabs-${TODAY}`, "Morning Prayer", TODAY),
  ownItem(`daily-rosary-${TODAY}`, "Daily Rosary", TODAY),
  ownItem(`marian-antiphon-angelus-${TODAY}`, "Marian Antiphon — Angelus", TODAY),
  ownItem(`${TODAY}-st-fixture-day-3`, "Novena to St. Fixture — Day 3", TODAY),
  ownItem(`${TODAY}-st-jude-day-5`, "Novena to St. Jude — Day 5", TODAY),
  ownItem(`auxilium-christianorum-${TODAY}`, "Auxilium Christianorum", TODAY),
  ownItem(`daily-reflection-${TODAY}`, "Daily Reflection", TODAY),
];
const OWN_YDAY_ITEMS = [
  ownItem(`morning-prayer-elevenlabs-${YDAY}`, "Morning Prayer", YDAY),
  ownItem(`daily-rosary-${YDAY}`, "Daily Rosary", YDAY),
];
const podcastXml = (todayItems, ydayItems = OWN_YDAY_ITEMS, tomorrow = true) =>
  rss((tomorrow ? ownItem(`morning-prayer-elevenlabs-${TOMORROW}`, "Morning Prayer", TOMORROW) : "") + todayItems.join("") + ydayItems.join(""));
const PODCAST_MAIN = podcastXml(OWN_TODAY_ITEMS);
const PODCAST_NO_AUX = podcastXml(OWN_TODAY_ITEMS.filter((x) => !x.includes("auxilium")));
const INTRO_IDS = ["morning-prayer", "daily-rosary", "marian-antiphon-angelus", "novena-st-fixture", "novena-st-jude",
  "auxilium-christianorum", "daily-reflection", "ext-invitatory", "ext-bible-in-a-year", "ext-gospel-exegesis"];
const TRACK_TITLES = {
  "morning-prayer": "Morning Prayer", "daily-rosary": "Daily Rosary", "marian-antiphon-angelus": "Marian Antiphon — Angelus",
  "novena-st-fixture": "Novena to St. Fixture — Day 3", "novena-st-jude": "Novena to St. Jude — Day 5",
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
// audioDelayMs: per-file response delays (leg 4 holds the rosary
// intro's download so its row re-renders mid-leg).
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
      const range = req.headers.range;
      let buf = audioBytes(name);
      if (name === `morning-prayer-elevenlabs-${TODAY}.mp3`) buf = TONE_MP;
      if (name === "intro-morning-prayer.mp3") buf = TONE_INTRO_MP;
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
const siteState = { podcast: PODCAST_MAIN, intentions: INTENTIONS_MAIN, intentionsDelayMs: 0 };
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

const PAIRING = {
  "morning-prayer": "Morning Prayer", "daily-rosary": "Daily Rosary",
  "marian-antiphon-angelus": "Morning Marian Antiphon", "auxilium-christianorum": "Auxilium Christianorum",
  "daily-reflection": "Daily Reflection", "novena-st-fixture": "Novenas", "novena-st-jude": "Novenas",
  "ext-invitatory": "Invitatory", "ext-bible-in-a-year": "Bible in a Year", "ext-gospel-exegesis": "Daily Gospel Exegesis",
};
const EXPECTED_TEXT = {
  "morning-prayer": T_EXACT2, "daily-rosary": T_LONG, "daily-reflection": T_SHORT,
  "novena-st-fixture": T_NOVENA, "novena-st-jude": T_NOVENA,
  "ext-invitatory": T_EXT, "ext-bible-in-a-year": T_BIAY, "ext-gospel-exegesis": T_DGE,
};

async function main() {
  await new Promise((r) => feedServer.listen(FEED_PORT, r));
  await startSite();

  // ================= instance =====================================
  applyMigs(APP, PERSIST, seedSql());
  startApp(APP, PORT, PERSIST);
  check("setup: candidate app boots", await waitUp(BASE));
  const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
  check("setup: the day's draw stands", draw.status === 200, `status=${draw.status}`);
  // Re-point the draw: each paired item carries its calibrated
  // length-class text (deterministic panels at the gate).
  for (const [itemId, intentionId] of Object.entries(REPOINT)) {
    d1q(APP, PERSIST, `UPDATE prayer_draws SET intention_id = ${intentionId} WHERE date = '${TODAY}' AND item_id = ${itemId};`);
  }
  // The post-boot D1 write can drop the dev instance's socket
  // (observed: "other side closed" on the next fetch) — restart
  // the app on the same persist dir before reading back; the
  // re-pointed draws stand in the persisted state.
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

  // ================= LEG 11 — served build ========================
  const appJs = (await apiRaw(BASE, "/app.js")).buf.toString("utf8");
  const swJs = (await apiRaw(BASE, "/sw.js")).buf.toString("utf8");
  let servedParses = true;
  try { new Function(appJs.replace(/import[^;]+;/g, "")); } catch { servedParses = false; }
  check("11 served build parses and executes (construction proof deferred to the browser legs) and carries the v343 seams",
    servedParses && appJs.includes("introForTrack") && appJs.includes("armEllipsis") && appJs.includes("expandedIntros"),
    `parses=${servedParses}`);
  check("11 SW pin ora-pro-nobis-v343-1 with the opn-ext-audio-v1 purge exemption verbatim",
    swJs.includes('var CACHE = "ora-pro-nobis-v343-1";') && swJs.includes('k !== CACHE && k !== "opn-ext-audio-v1"'));

  // ================= browser legs =================================
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
    // The client-direct BIAY leg fetches the hardcoded fireside
    // URL (EXT_BIAY_URL in the client) — the route fulfills it
    // with the generated presented-day feed (the v336-v338
    // pattern; v342's routes omitted it because its legs never
    // rode the BIAY slot).
    await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: BIAY_XML }));
    await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: tone("media-route.mp3", 330, 1) }));
  };
  const newCtx = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await wireExtRoutes(ctx);
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
  const waitPanel = (page, cardId, timeout = 30000) => page.waitForFunction((id) => {
    const c = document.querySelector(`[data-card="${id}"]`);
    return !!c && !!c.querySelector(".intention-panel");
  }, cardId, { timeout }).catch(() => {});
  const cardInfo = (page, cardId) => page.evaluate((id) => {
    const c = document.querySelector(`[data-card="${id}"]`);
    if (!c) return null;
    const txt = c.querySelector(".intention-text");
    const btn = c.querySelector(".ellipsis-btn");
    return {
      introRow: c.classList.contains("intro-row"), expanded: c.classList.contains("expanded"),
      h: c.offsetHeight, scrollH: c.scrollHeight,
      panel: !!c.querySelector(".intention-panel"),
      panelText: txt ? txt.textContent : null,
      textSH: txt ? txt.scrollHeight : -1, textCH: txt ? txt.clientHeight : -1,
      btnStands: !!btn && btn.classList.contains("stands"),
      btnAria: btn ? btn.getAttribute("aria-expanded") : null,
      notavail: !!c.querySelector(".notavail"),
    };
  }, cardId);

  // ---- OPEN A — legs 1, 2, 3, 4, 7, 8, 10 -------------------------
  // The rosary intro's download is held 30s: its row re-renders
  // (ownSwapRow on download landing) in the middle of leg 4.
  // Leg 4 executes immediately after the leg 1-3 reads so the
  // expand click lands well before the held download.
  feedState.audioDelayMs[`intro-daily-rosary.mp3`] = 30000;
  const ctxA = await newCtx();
  const pageA = await ctxA.newPage();
  await pageA.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(pageA);
  await waitExtSettled(pageA);
  await waitPanel(pageA, "daily-rosary");
  await waitPanel(pageA, "ext-invitatory");

  const stateA = await pageA.evaluate(() => ({
    invitatory: window.state.extSlots["ext-invitatory"] && window.state.extSlots["ext-invitatory"].state,
    doMorning: window.state.extSlots["ext-morning-prayer"] && window.state.extSlots["ext-morning-prayer"].state,
    biay: window.state.extSlots["ext-bible-in-a-year"] && window.state.extSlots["ext-bible-in-a-year"].state,
    intros: Object.keys(window.state.dayPayload.intros || {}),
  }));
  check("1 the presented-day DO courier fixture settles present (invitatory + morning prayer, not named-missing)",
    stateA.invitatory === "present" && stateA.doMorning === "present", JSON.stringify(stateA));
  check("1 the generated presented-day BIAY fixture settles present (current-year Day-N match)",
    stateA.biay === "present", JSON.stringify(stateA));
  check("1 the intros fixture stands complete for the fixture day (all 10 ids in the built map)",
    INTRO_IDS.every((id) => stateA.intros.includes(id)), JSON.stringify(stateA.intros));

  const rowsA = await pageA.evaluate(() => {
    const out = [];
    document.querySelectorAll(".card.intro-row").forEach((el) => out.push({ id: el.getAttribute("data-card"), h: el.offsetHeight, scrollH: el.scrollHeight }));
    return out;
  });
  check("2 every combined row stands at exactly 136px (own + external, short + long intention, two-line novena title)",
    rowsA.length >= 10 && rowsA.every((r) => r.h === 136), JSON.stringify(rowsA));
  check("2 clip guard: no combined row's content exceeds the fixed height (scrollHeight <= 137 collapsed)",
    rowsA.length >= 10 && rowsA.every((r) => r.scrollH <= 137), JSON.stringify(rowsA.map((r) => `${r.id}:${r.scrollH}`)));

  const rosaryA = await cardInfo(pageA, "daily-rosary");
  const mpA = await cardInfo(pageA, "morning-prayer");
  const reflA = await cardInfo(pageA, "daily-reflection");
  check("3 the >2-line panel (rosary, 8-line text) stands its ellipsis",
    !!rosaryA && rosaryA.btnStands && rosaryA.textSH > rosaryA.textCH + 1, JSON.stringify(rosaryA));
  check("3 the exact-two-line panel (morning prayer) stands NO ellipsis — nothing is hidden (scrollHeight == clientHeight)",
    !!mpA && !mpA.btnStands && mpA.textSH === mpA.textCH, JSON.stringify(mpA));
  check("3 the one-line panel (daily reflection) stands NO ellipsis",
    !!reflA && !reflA.btnStands && reflA.textSH === reflA.textCH, JSON.stringify(reflA));

  // Leg 4: toggle — expand the clamped rosary row; the expansion
  // must survive the row's settle re-render when the held intro
  // download lands; a second tap on the re-rendered control
  // collapses it back to 136.
  await pageA.evaluate(() => { const c = document.querySelector('[data-card="daily-rosary"]'); if (c) c.__leg4stamp = "before"; });
  await pageA.click('[data-card="daily-rosary"] .ellipsis-btn');
  const expA = await cardInfo(pageA, "daily-rosary");
  const othersA = await pageA.evaluate(() => {
    const out = [];
    document.querySelectorAll(".card.intro-row").forEach((el) => { if (el.getAttribute("data-card") !== "daily-rosary") out.push(el.offsetHeight); });
    return out;
  });
  check("4 tapping the ellipsis expands that row only (height > 136, clamp released, full text visible, aria-expanded true)",
    !!expA && expA.expanded && expA.h > 136 && expA.textSH === expA.textCH && expA.btnAria === "true", JSON.stringify(expA));
  check("4 every other combined row stays at 136 while one row is expanded",
    othersA.length >= 9 && othersA.every((h) => h === 136), JSON.stringify(othersA));
  // Wait for the held download to land and re-render the row.
  let rerendered = null;
  for (let i = 0; i < 45; i++) {
    rerendered = await pageA.evaluate(() => {
      const c = document.querySelector('[data-card="daily-rosary"]');
      if (!c) return null;
      return { fresh: !c.__leg4stamp, expanded: c.classList.contains("expanded"), h: c.offsetHeight };
    }).catch(() => null);
    if (rerendered && rerendered.fresh) break;
    await sleep(1000);
  }
  check("4 the expansion survives the row's settle re-render (session set re-renders it expanded)",
    !!rerendered && rerendered.fresh && rerendered.expanded && rerendered.h > 136, JSON.stringify(rerendered));
  await pageA.click('[data-card="daily-rosary"] .ellipsis-btn');
  const colA = await cardInfo(pageA, "daily-rosary");
  check("4 tapping again on the re-rendered control collapses the row back to 136",
    !!colA && !colA.expanded && colA.h === 136 && colA.btnAria === "false", JSON.stringify(colA));
  feedState.audioDelayMs = {};

  const chrome8 = await pageA.evaluate(() => {
    const c = document.querySelector('[data-card="daily-rosary"]');
    if (!c) return null;
    const cs = getComputedStyle(c);
    const panel = c.querySelector(".intention-panel");
    const label = c.querySelector(".intention-label");
    const text = c.querySelector(".intention-text");
    const title = c.querySelector("h3");
    const playMain = c.querySelector(".row").children[1];
    const playPanel = c.querySelector(".playbtn.small");
    return {
      padTop: cs.paddingTop, padBottom: cs.paddingBottom,
      panelPR: panel ? getComputedStyle(panel).paddingRight : null,
      labelMB: label ? getComputedStyle(label).marginBottom : null,
      textMB: text ? getComputedStyle(text).marginBottom : null,
      labelFont: label ? getComputedStyle(label).fontSize : null,
      textFont: text ? getComputedStyle(text).fontSize : null,
      titleFont: title ? getComputedStyle(title).fontSize : null,
      mainBtn: playMain ? [playMain.offsetWidth, playMain.offsetHeight] : null,
      panelBtn: playPanel ? [playPanel.offsetWidth, playPanel.offsetHeight] : null,
    };
  });
  check("8 compact chrome on a combined row (padding 9 · panel 8 · margins 2/6 · fonts 13/14/17 · buttons 42/30)",
    !!chrome8 && chrome8.padTop === "9px" && chrome8.padBottom === "9px" && chrome8.panelPR === "8px" &&
    chrome8.labelMB === "2px" && chrome8.textMB === "6px" && chrome8.labelFont === "13px" && chrome8.textFont === "14px" &&
    chrome8.titleFont === "17px" && JSON.stringify(chrome8.mainBtn) === "[42,42]" && JSON.stringify(chrome8.panelBtn) === "[30,30]",
    JSON.stringify(chrome8));

  // Leg 10: the panel's own play button starts its intro descriptor.
  await pageA.click('[data-card="morning-prayer"] [data-playkey="intro:morning-prayer"]');
  await pageA.waitForFunction(() => window.state.current && window.state.current.episodeId === "intro:morning-prayer", null, { timeout: 10000 }).catch(() => {});
  const cur10 = await pageA.evaluate(() => window.state.current && window.state.current.episodeId);
  check("10 the panel play button on a combined row starts its intro descriptor (treatment A behavior preserved)",
    cur10 === "intro:morning-prayer", `current=${cur10}`);

  // Leg 7: settled external panel — text equals the drawn text,
  // its play button stands and resolves a descriptor on click.
  const invA = await cardInfo(pageA, "ext-invitatory");
  check("7 the settled courier card's panel text equals that slot's drawn intention text",
    !!invA && invA.panel && invA.panelText === EXPECTED_TEXT["ext-invitatory"], JSON.stringify(invA));
  await pageA.click('[data-card="ext-invitatory"] [data-playkey="intro:ext-invitatory"]');
  await pageA.waitForFunction(() => window.state.current && window.state.current.episodeId === "intro:ext-invitatory", null, { timeout: 10000 }).catch(() => {});
  const cur7 = await pageA.evaluate(() => window.state.current && window.state.current.episodeId);
  check("7 the settled external panel's play button resolves its intro descriptor on click",
    cur7 === "intro:ext-invitatory", `current=${cur7}`);


  // Leg 6: cache-valid second open (same context — reload) renders
  // settled external cards WITH panels. The DO pair's second slot
  // (ext-morning-prayer) carries no keyed intro in the fixture
  // model — intentions key per block, and the Divine Office
  // block's intention stands on the Invitatory row — so it stands
  // present and panel-free by design; the panel assertions ride
  // the keyed courier slot (ext-invitatory) and the keyed
  // client-direct slot (ext-bible-in-a-year).
  await pageA.reload({ waitUntil: "load" });
  await waitOwnSettled(pageA);
  await waitExtSettled(pageA);
  await waitPanel(pageA, "ext-invitatory");
  await waitPanel(pageA, "ext-bible-in-a-year");
  const inv6 = await cardInfo(pageA, "ext-invitatory");
  const biay6 = await cardInfo(pageA, "ext-bible-in-a-year");
  const doM6 = await cardInfo(pageA, "ext-morning-prayer");
  check("6 cache-valid open: settled external cards render WITH their panels (courier slots included)",
    !!inv6 && inv6.panel && !!biay6 && biay6.panel, JSON.stringify({ inv: inv6 && inv6.panel, biay: biay6 && biay6.panel }));
  check("6 the DO pair's second slot stands present and panel-free (its block's intention is keyed to the Invitatory row)",
    !!doM6 && !doM6.panel && !doM6.notavail, JSON.stringify(doM6));
  await pageA.close(); await ctxA.close();

  // ---- OPEN B — leg 5: fresh open, intentions delayed ------------
  // The intentions response is delayed 5s at the fixture server:
  // inside the client's 8s fetch budget (extFetchText aborts at
  // 8s — a network-level hold would kill the fetch outright) but
  // past the courier + direct slots' settle (~1-2s locally). The
  // precondition is polled inside the delay window: both slots
  // present, the built intros map still empty, both cards
  // panel-free — the defect shape, SEEN before the source lands.
  siteState.intentionsDelayMs = 5000;
  const ctxB = await newCtx();
  const pageB = await ctxB.newPage();
  await pageB.goto(BASE + "/", { waitUntil: "load" });
  let preB = null;
  for (let i = 0; i < 18; i++) {
    const s = await pageB.evaluate(() => {
      const st = window.state || {};
      const panelOf = (id) => { const c = document.querySelector('[data-card="' + id + '"]'); return c ? !!c.querySelector(".intention-panel") : null; };
      return {
        inv: st.extSlots && st.extSlots["ext-invitatory"] && st.extSlots["ext-invitatory"].state,
        biay: st.extSlots && st.extSlots["ext-bible-in-a-year"] && st.extSlots["ext-bible-in-a-year"].state,
        intros: st.dayPayload && st.dayPayload.intros ? Object.keys(st.dayPayload.intros).length : 0,
        invPanel: panelOf("ext-invitatory"), biayPanel: panelOf("ext-bible-in-a-year"),
      };
    }).catch(() => null);
    if (s && s.inv === "present" && s.biay === "present" && s.intros === 0 && s.invPanel === false && s.biayPanel === false) { preB = s; break; }
    await sleep(250);
  }
  check("5 precondition: with intentions delayed, the settled courier + direct cards stand panel-free (the defect shape)",
    !!preB, JSON.stringify(preB));
  await pageB.evaluate(() => { window.__leg5session = "same-session"; });
  await waitPanel(pageB, "ext-invitatory");
  await waitPanel(pageB, "ext-bible-in-a-year");
  const postB = {
    inv: await cardInfo(pageB, "ext-invitatory"),
    biay: await cardInfo(pageB, "ext-bible-in-a-year"),
    session: await pageB.evaluate(() => window.__leg5session),
  };
  check("5 the settled courier card gains its panel in the same session when the intro lands, no reopen",
    !!postB.inv && postB.inv.panel && postB.session === "same-session", JSON.stringify(postB.inv));
  check("5 the settled client-direct card gains its panel in the same session too",
    !!postB.biay && postB.biay.panel, JSON.stringify(postB.biay));
  siteState.intentionsDelayMs = 0;
  await pageB.close(); await ctxB.close();

  // ---- OPEN D — leg 9: untouched shapes ---------------------------
  siteState.podcast = PODCAST_NO_AUX;
  siteState.intentions = INTENTIONS_NO_REFLECTION;
  const ctxD = await newCtx();
  const pageD = await ctxD.newPage();
  await pageD.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(pageD);
  await waitExtSettled(pageD);
  const reflD = await cardInfo(pageD, "daily-reflection");
  const auxD = await cardInfo(pageD, "auxilium-christianorum");
  check("9 a no-intro own card keeps its standing shape (no intro-row class, no panel, no fixed height)",
    !!reflD && !reflD.introRow && !reflD.panel && reflD.h !== 136, JSON.stringify(reflD));
  check("9 an unavailable card keeps its standing shape (no intro-row class, no fixed height)",
    !!auxD && !auxD.introRow && auxD.notavail && auxD.h !== 136, JSON.stringify(auxD));
  siteState.podcast = PODCAST_MAIN;
  siteState.intentions = INTENTIONS_MAIN;
  await pageD.close(); await ctxD.close();

  await browser.close();
  console.log("\nregressions (v342 · v339 · v338 · v337 · v336 · v335 · v334) run separately — tallies in §3.");
  // ---- teardown ---------------------------------------------------
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* already gone */ } }
  try { feedServer.close(); } catch { /* noop */ }
  try { siteServer.close(); } catch { /* noop */ }
  console.log(`\nharness-v343: ${passed} passed, ${failed} failed`);
  if (fails.length) console.log("failures: " + fails.join(" · "));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("harness-v343 crashed:", e); for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } } process.exit(2); });
