#!/usr/bin/env node
// harness-v361 — the v361 gate (Plan §2.8 legs L1-L10): plain
// Spotify-style rows replace the 25/75 combined intention rows.
// Every track its own standard card; a standing intro renders as
// its OWN card (intentionRowCard) titled "Prayer Intention:
// <prayer name>" (the pinned helper, both families), the
// intention text as the row's second line under the two-line
// clamp with the ⋯ expand re-pointed to the row; the prayer card
// byte-identical when no intro stands; the pair replaces
// atomically at both swap paths (ownSwapRow · extSwapCard) and
// at the two fragment-append paths (blockInsertCards ·
// appendBlockSettingsCards); the queue carries the same title
// through the descriptor form of the helper. NO migration.
// Fixture posture: the standing estate mold (v343/v360) — local
// feed + HTTPS site servers, the presented day built by the
// shipped client from fixture feeds, the draw re-pointed to
// calibrated intention texts (v343's method), the fixture
// migration set running the FULL sequence through 0015.
// Pristine expectations (§2.8): on the pre-v361 tree L1, L2, L6,
// L8 FAIL (the combined row stands; the queue prefix differs)
// and L4, L5, L10 PASS (the behavior pre-exists the form).
// Tallies from COMPLETE log files only.
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = process.env.OPN_APP ? path.resolve(process.env.OPN_APP) : path.dirname(fileURLToPath(import.meta.url)) + "/..";
const FORK = path.resolve(APP, "..");
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v361 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8996, FEED_PORT = 8956, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v361");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v361-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
const ordinal = (x) => x + (["th", "st", "nd", "rd"][(x % 100 > 10 && x % 100 < 14) ? 0 : Math.min(x % 10, 4)] || "th");

const api = async (base, method, p, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  let body;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
  if (opts.raw !== undefined) body = opts.raw;
  const res = await fetch(base + p, { method, headers, body, redirect: "manual" });
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, text, headers: res.headers };
};
function wranglerD1File(appDir, persist, file) {
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
function migFiles(appDir) {
  const dir = path.join(appDir, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(dir, f));
}
function applyFiles(appDir, persist, files, extraSql = "") {
  fs.rmSync(persist, { recursive: true, force: true });
  const parts = files.map((f) => fs.readFileSync(f, "utf8"));
  if (extraSql) parts.push(extraSql);
  const f = path.join(TMPD, `mig-${path.basename(persist)}-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1File(appDir, persist, f);
}
function tone(name, freq = 440, secs = 1.6) {
  const out = path.join(TMPD, name);
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${secs}`, "-codec:a", "libmp3lame", "-b:a", "32k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr);
  return fs.readFileSync(out);
}
const TONE_30 = tone("t30.mp3", 330, 30);
const TONE_3 = tone("t3.mp3", 550, 3);
const TONE_1 = tone("t1.mp3", 660, 1.0);
const TONE_16 = tone("t16.mp3", 440, 1.6);
function toneFor(name) {
  if (name.startsWith("intro-")) return TONE_1;
  if (name.includes("daily-reflection") || name.includes("st-anne")) return TONE_3;
  if (name.includes("daily-rosary") || name.includes("morning-prayer-elevenlabs") || name.includes("st-jude") || name.includes("st-rita") || name.includes("auxilium") || name.includes("marian-antiphon")) return TONE_30;
  return TONE_16;
}
const procs = [];
function startApp(appDir, port, persist) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1",
    "--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`,
    "--var", `EXT_DGE_FEED_URL:${FEED}/dge.xml`, "--var", `EXT_SAINT_FEED_URL:${FEED}/saint.xml`,
    "--var", `EXT_USCCB_FEED_URL:${FEED}/usccb.xml`, "--var", `EXT_TVMASS_FEED_URL:${FEED}/tvmass.xml`,
    "--var", `EXT_FRMIKE_FEED_URL:${FEED}/frmike.xml`, "--var", `EXT_BARRON_FEED_URL:${FEED}/barron.xml`];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}

// ---- seed (the estate mold: 35 items + the 11-intention pool) ---
// plus the calibrated fixture intentions 901-905 whose texts the
// draw is re-pointed to below. Text classes at the intention
// ROW's full width (v343 calibrated at the 25% panel; the row is
// ~4x wider, so the classes are re-aimed): T_LONG ~4 lines
// (clamped, ellipsis stands), T_EXACT2 exactly 2 lines (nothing
// hidden, no ellipsis), T_SHORT 1 line.
const T_LONG = "For the repose of the soul of Margaret Ann Thibeaux, and for her whole family in their grief, and for all the faithful departed of our parish";
const T_EXACT2 = "For our son Dylan, for his exams and his game this week";
const T_SHORT = "For Ana.";
const T_EXT = "For our daughter Camille";
const T_DGE = "For Dylan and his exams";
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
  [901, T_LONG], [902, T_EXACT2], [903, T_SHORT], [904, T_EXT], [905, T_DGE],
];
// item_id -> fixture intention id (the text class that item's
// paired tracks must carry)
const REPOINT = { 4: 901, 2: 902, 41: 903, 1: 904, 9: 905 };
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

// ---- fixture feeds (the v360 presented-day set) -----------------
const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Fixture</title>${items}</channel></rss>`;
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
const mmdd = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const SAINT_XML = rss(xitem(`${mmdd(TODAY)} - St. Fixture`, rfc(TODAY, 5), `${FEED}/audio/saint-today.mp3`));
const BIAY_XML = rss(
  xitem(`Day ${doyOf(TODAY)}: Fixture Reading (${TODAY.slice(0, 4)})`, rfc(TODAY, 6), `${FEED}/audio/biay-today.mp3`) +
  xitem(`Day ${doyOf(YDAY)}: Fixture Reading (${YDAY.slice(0, 4)})`, rfc(YDAY, 6), `${FEED}/audio/biay-yday.mp3`));
const DGE_XML = rss(xitem("Fixture Exegesis — Presented Day Pick", rfc(TODAY, 6), `${FEED}/audio/dge-pick.mp3`));
const feedBytes = { sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")) };

// ---- the podcast + intentions fixture feeds (client side) -------
const ownItem = (stem, title, iso, hour = 12) =>
  `<item><title>${title} - ${longDate(iso)}</title><guid isPermaLink="false">${stem}::fixturehash</guid><pubDate>${rfc(iso, hour)}</pubDate><enclosure url="${FEED}/audio/${stem}.mp3" type="audio/mpeg" length="2048"/></item>`;
const ownTodayItems = () => [
  ownItem(`morning-prayer-elevenlabs-${TODAY}`, "Morning Prayer", TODAY),
  ownItem(`daily-rosary-${TODAY}`, "Daily Rosary", TODAY),
  ownItem(`marian-antiphon-angelus-${TODAY}`, "Marian Antiphon — Angelus", TODAY),
  ownItem(`${TODAY}-st-jude-day-5`, "Novena to St. Jude — Day 5", TODAY),
  ownItem(`${TODAY}-st-anne-day-1`, "Novena to St. Anne — Day 1", TODAY),
  ownItem(`${TODAY}-st-rita-day-3`, "Novena to St. Rita — Day 3", TODAY),
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
const INTRO_IDS = ["morning-prayer", "daily-rosary", "marian-antiphon-angelus", "novena-st-fixture", "novena-st-jude",
  "novena-st-anne", "novena-st-rita", "auxilium-christianorum", "daily-reflection", "ext-invitatory", "ext-bible-in-a-year", "ext-gospel-exegesis"];
const TRACK_TITLES = {
  "morning-prayer": "Morning Prayer", "daily-rosary": "Daily Rosary", "marian-antiphon-angelus": "Marian Antiphon — Angelus",
  "novena-st-fixture": "Novena to St. Fixture", "novena-st-jude": "Novena to St. Jude — Day 5",
  "novena-st-anne": "Novena to St. Anne — Day 1", "novena-st-rita": "Novena to St. Rita — Day 3",
  "auxilium-christianorum": "Auxilium Christianorum", "daily-reflection": "Daily Reflection",
  "ext-invitatory": "Invitatory", "ext-bible-in-a-year": "Bible in a Year", "ext-gospel-exegesis": "Daily Gospel Exegesis",
};
const introItem = (id, len) =>
  `<item><title>Intention — ${TRACK_TITLES[id]}</title><guid isPermaLink="false">intentions-intro-${id}-${TODAY}</guid><pubDate>${rfc(TODAY, 0)}</pubDate><description>Intention audio.</description><enclosure url="${FEED}/audio/intro-${id}.mp3" type="audio/mpeg" length="${len}"/></item>`;
const segmentItem = (block, len) =>
  `<item><title>Intentions — ${block}</title><guid isPermaLink="false">intentions-segment-${block}-${TODAY}</guid><pubDate>${rfc(TODAY, 0)}</pubDate><description>Segment audio.</description><enclosure url="${FEED}/audio/segment-${block}.mp3" type="audio/mpeg" length="${len}"/></item>`;
const intentionsXml = (ids) => rss(ids.map((id, i) => introItem(id, 4100 + i * 137)).join("") + segmentItem("Morning", 9100));
const INTENTIONS_MAIN = intentionsXml(INTRO_IDS);

// ---- HTTP fixture server (Worker env feeds + audio host) --------
// audioDelayMs: per-file response delays (L6a holds the rosary
// intro's download so its row's swap re-render lands mid-leg).
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
      const sendIntentions = () => { res.writeHead(200, { "content-type": "application/rss+xml", "access-control-allow-origin": "*" }); res.end(siteState.intentions); };
      if (siteState.intentionsDelayMs) setTimeout(sendIntentions, siteState.intentionsDelayMs); else sendIntentions();
      return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise((r) => siteServer.listen(SITE_PORT, r));
}

async function wireContext(ctx) {
  await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
  await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
  await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
  await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: BIAY_XML }));
  await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: TONE_16 }));
}

// Readiness (the v360 A1 mold): every own row settled AND the
// core descriptors available with intros standing.
async function waitReady(page, timeout = 60000) {
  const t0 = Date.now();
  const r = await page.waitForFunction(() => {
    const st = window.state;
    if (!st || !st.dayPayload || !st.ownStanding || !st.ownStanding.length) return false;
    const ownOk = st.ownStanding.every((row) => { const s = st.ownSlots[row.sourceKey]; return s && (s.state === "present" || s.state === "missing"); });
    if (!ownOk) return false;
    const ds = st.dayDescs || [];
    const need = ["daily-rosary", "morning-prayer", "marian-antiphon-angelus", "auxilium-christianorum"];
    return need.every((id) => ds.some((x) => x.episodeId === id && x.available)) && ds.some((x) => x.episodeId === "intro:daily-rosary");
  }, null, { timeout }).then(() => true).catch(() => false);
  return { ready: r, ms: Date.now() - t0 };
}
async function waitExtSettled(page, timeout = 60000) {
  return page.waitForFunction(() => {
    const s = window.state && window.state.extSlots;
    if (!s || !Object.keys(s).length) return false;
    return Object.values(s).every((st) => st.state !== "loading" && st.state !== "downloading");
  }, null, { timeout }).then(() => true).catch(() => false);
}

async function main() {
  let browser = null;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v361-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    // ============ candidate app: FULL migrations through 0015 ====
    const migs = migFiles(APP);
    ok(migs.some((f) => path.basename(f).startsWith("0015")) && !migs.some((f) => path.basename(f).startsWith("0016")),
      "fixture: the migration set runs through 0015 and NO 0016 stands (v361 carries no migration)");
    applyFiles(APP, PERSIST, migs, seedSql());
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    // Re-point the draw: each paired item carries its calibrated
    // text class (v343's method), then restart the app on the
    // same persist dir (the post-boot D1 write can drop the dev
    // socket; the re-pointed draws stand in the persisted state).
    for (const [itemId, intentionId] of Object.entries(REPOINT)) {
      d1q(APP, PERSIST, `UPDATE prayer_draws SET intention_id = ${intentionId} WHERE date = '${TODAY}' AND item_id = ${itemId};`);
    }
    for (const p of procs.splice(0)) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
    for (let i = 0; i < 15; i++) { try { await fetch(BASE + "/"); } catch { break; } await sleep(1000); }
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "setup: candidate app re-boots after the draw re-point");
    const prayerDay = (await api(BASE, "GET", `/api/agent/prayer/day?date=${TODAY}`, { token: TOKEN })).body;
    const drawText = {};
    for (const b of prayerDay.blocks || []) for (const d of b.devotions || []) drawText[d.name] = (d.intentions || [])[0] ? d.intentions[0].text : "";
    ok(drawText["Daily Rosary"] === T_LONG && drawText["Morning Prayer"] === T_EXACT2 && drawText["Daily Reflection"] === T_SHORT &&
      drawText["Invitatory"] === T_EXT && drawText["Daily Gospel Exegesis"] === T_DGE,
      `setup: re-pointed draws carry the calibrated texts (rosary=${JSON.stringify((drawText["Daily Rosary"] || "").slice(0, 30))}, mp=${JSON.stringify((drawText["Morning Prayer"] || "").slice(0, 30))})`);

    // ============ served build ===================================
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "served build: the served /app.js parses (vm.Script)");
    ok(appJs.includes("intentionRowCard") && appJs.includes("prayerIntentionTitle") && !appJs.includes("function intentionPanelHtml"),
      "served build: the served client carries intentionRowCard + the pinned title helper and NO intentionPanelHtml function");
    const swJs = (await api(BASE, "GET", "/sw.js")).text;
    ok(swJs.includes('var CACHE = "ora-pro-nobis-v361-1";') && swJs.includes('k !== CACHE && k !== "opn-ext-audio-v1"'),
      "served build: SW pin ora-pro-nobis-v361-1 with the opn-ext-audio-v1 purge exemption verbatim");
    const uiCss = (await api(BASE, "GET", "/styles.css")).text;
    ok(!uiCss.includes(".card.intro-row {") && !uiCss.includes("height:136px") && uiCss.includes(".card.intention-row.expanded .intention-text"),
      "served build: the combined-row CSS is retired from the served stylesheet (no .card.intro-row rule, no 136px) and the re-scoped expanded rule stands");

    // ============ browser ========================================
    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    browser = await chromium.launch({
      executablePath: CHROME, env: browserEnv,
      args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server", "--autoplay-policy=no-user-gesture-required",
        "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
    });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await wireContext(ctx);
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const stopQ = () => ev(() => {
      const a = document.getElementById("audio"); if (a) a.pause();
      window.state.queue = []; window.state.queueIdx = -1; window.state.current = null;
      document.querySelectorAll(".np-sheet, .readsheet").forEach((s) => s.remove());
    });
    const wipe = async () => {
      await stopQ();
      await ev(() => { localStorage.removeItem("opn-queue-v355"); localStorage.removeItem("opn-resume-v312"); localStorage.removeItem("opn-played-v344"); window.state.playedCache = null; window.state.restoredQueue = false; });
    };
    const rowInfo = (id) => ev((pid) => {
      const intro = document.querySelector('[data-card="intro:' + pid + '"]');
      const prayer = document.querySelector('[data-card="' + pid + '"]');
      const info = { intro: null, prayer: null, adjacent: false };
      if (intro) {
        const txt = intro.querySelector(".intention-text");
        const btn = intro.querySelector(".ellipsis-btn");
        const pb = intro.querySelector(".playbtn");
        info.intro = {
          cls: intro.className, title: intro.querySelector("h3") ? intro.querySelector("h3").textContent : null,
          text: txt ? txt.textContent : null, textSH: txt ? txt.scrollHeight : -1, textCH: txt ? txt.clientHeight : -1,
          btnStands: !!btn && btn.classList.contains("stands"), btnAria: btn ? btn.getAttribute("aria-expanded") : null,
          expanded: intro.classList.contains("expanded"), ownRow: intro.getAttribute("data-own-row"),
          dot: !!intro.querySelector("[data-markplayed], .played-dot"),
          playSize: pb ? [pb.offsetWidth, pb.offsetHeight] : null,
        };
        info.adjacent = !!prayer && intro.nextElementSibling === prayer;
      }
      if (prayer) {
        const row = prayer.querySelector(".row");
        const last = row ? row.lastElementChild : null;
        info.prayer = {
          cls: prayer.className, title: prayer.querySelector("h3") ? prayer.querySelector("h3").textContent : null,
          ownRow: prayer.getAttribute("data-own-row"),
          lastIsDot: !!last && (!!last.querySelector("[data-markplayed]") || last.hasAttribute("data-markplayed")),
          panel: !!prayer.querySelector(".intention-panel"),
        };
      }
      return info;
    }, id);

    // The rosary intro's download is held 25s: its row's settle
    // re-render (ownSwapRow) lands mid-run, after L3's expand.
    feedState.audioDelayMs["intro-daily-rosary.mp3"] = 25000;
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const boot = await waitReady(page);
    ok(boot.ready, `boot: the fixture pass reaches readiness (own settled + descriptors + intros) in ${boot.ms} ms`);
    await waitExtSettled(page);

    // ---- L9 · title fallback (pure-helper legs, run early) ------
    const fb = await ev(() => {
      if (typeof window.prayerIntentionTitle !== "function" || typeof window.prayerIntentionTitleForDesc !== "function") return { missing: true };
      const saved = window.state.dayDescs;
      window.state.dayDescs = [{ episodeId: "prayer-x", title: "Prayer X Title", kind: "external" }];
      const out = {
        prayerFirst: window.prayerIntentionTitle({ title: "Track Title" }, { title: "Intro Title" }),
        introFallback: window.prayerIntentionTitle({ title: null }, { title: "Feed Item Title" }),
        bareFromEmpty: window.prayerIntentionTitle({ title: "" }, { title: "" }),
        bareFromNull: window.prayerIntentionTitle({}, null),
        descResolvesPrayer: window.prayerIntentionTitleForDesc({ episodeId: "intro:prayer-x", title: "Intro Own Title" }),
        descIntroFallback: window.prayerIntentionTitleForDesc({ episodeId: "intro:absent", title: "Intro Own Title" }),
        descBare: window.prayerIntentionTitleForDesc({ episodeId: "intro:absent", title: "" }),
      };
      window.state.dayDescs = saved;
      return out;
    });
    ok(!fb.missing && fb.prayerFirst === "Prayer Intention: Track Title" && fb.introFallback === "Prayer Intention: Feed Item Title" &&
      fb.bareFromEmpty === "Prayer Intention" && fb.bareFromNull === "Prayer Intention",
      `L9 title fallback (track form): prayer title wins, then the intro's own title, then the bare "Prayer Intention" — never a fabricated name (=${JSON.stringify(fb)})`);
    ok(!fb.missing && fb.descResolvesPrayer === "Prayer Intention: Prayer X Title" && fb.descIntroFallback === "Prayer Intention: Intro Own Title" && fb.descBare === "Prayer Intention",
      `L9 title fallback (descriptor form): the prayer resolves from state.dayDescs by the stripped prefix, then the intro descriptor's own title, then bare (=${JSON.stringify({ a: fb.descResolvesPrayer, b: fb.descIntroFallback, c: fb.descBare })})`);

    // ---- L10 · no behavior drift (descriptors, counts, Continue) -
    const order10 = await ev(() => {
      const ds = window.extRebuildDescs(window.state.dayPayload);
      const ri = ds.findIndex((x) => x.episodeId === "intro:daily-rosary");
      const rp = ds.findIndex((x) => x.episodeId === "daily-rosary");
      const ii = ds.findIndex((x) => x.episodeId === "intro:ext-invitatory");
      const ip = ds.findIndex((x) => x.episodeId === "ext-invitatory");
      return { ri, rp, ii, ip };
    });
    ok(order10.rp > 0 && order10.ri === order10.rp - 1 && order10.ip > 0 && order10.ii === order10.ip - 1,
      `L10 descriptor order stands [intro, prayer, …] for both families in a fresh build (=${JSON.stringify(order10)})`);
    const totals10 = await ev(() => (window.state.dayDescs || []).filter((x) => x.kind !== "intention" && x.available).length);
    // Played counts + Continue (paintContinue stands EMPTY until
    // a first mark or a resume record stands — the standing
    // rule): seed ONE mark through the store's own write path,
    // then read both surfaces.
    const morningTotal10 = await ev(() => (window.state.dayDescs || []).filter((x) => x.block === "Morning" && x.kind !== "intention" && x.available).length);
    const countsBefore10 = await ev(() => window.blockPlayedCounts("Morning"));
    // The v360 L7 order: stand on the Listen home FIRST, then
    // write the mark — refreshPlayedChrome re-paints the
    // Continue card in place on the standing home.
    await ev(() => window.goListenHome());
    await sleep(300);
    await ev(() => { window.writePlayedQuiet("daily-rosary", window.state.presentedDay, "played", "Morning"); window.refreshPlayedChrome(); });
    const countsAfter10 = await ev(() => window.blockPlayedCounts("Morning"));
    ok(countsBefore10.played === 0 && countsAfter10.played === 1 && countsAfter10.total === morningTotal10,
      `L10 block played counts read as before (Morning ${JSON.stringify(countsBefore10)} -> ${JSON.stringify(countsAfter10)} against ${morningTotal10} non-intention Morning descriptors; the intro never counts)`);
    await sleep(400);
    const cont10 = await ev(() => { const s = document.getElementById("continue-slot"); return s ? s.textContent : ""; });
    ok(cont10.includes(`1 of ${totals10} heard`), `L10 Continue reads as before (text=${JSON.stringify(cont10.slice(0, 110))}, totals=${totals10})`);
    await wipe();

    // ---- Morning block page: L1, L2, L3 (long), L6a --------------
    await ev(() => window.openBlockPage("Morning"));
    await sleep(400);
    const waitIntro = (pid, timeout = 30000) => page.waitForFunction((id) => !!document.querySelector('[data-card="intro:' + id + '"]'), pid, { timeout }).then(() => true).catch(() => false);
    ok(await waitIntro("ext-invitatory"), "setup: the external pair stands on the Morning page (ext-invitatory settled with its intro)");
    const remnants = await ev(() => document.querySelectorAll(".intro-row, .intention-panel, .intention-label, .panel-foot").length);
    const rosary1 = await rowInfo("daily-rosary");
    ok(!!rosary1.intro && !!rosary1.prayer && rosary1.adjacent && rosary1.intro.cls.includes("intention-row") && !rosary1.prayer.panel && remnants === 0,
      `L1 block page, single rows: the rosary renders exactly TWO cards — intention row first, prayer card immediately after — and no combined-row remnant stands anywhere in the document (remnants=${remnants}, intro=${rosary1.intro && rosary1.intro.cls}, prayer=${rosary1.prayer && rosary1.prayer.cls})`);
    const inv2 = await rowInfo("ext-invitatory");
    ok(!!rosary1.intro && rosary1.intro.title === "Prayer Intention: Daily Rosary",
      `L2 title form, own family: the rosary's intention row is titled exactly "Prayer Intention: Daily Rosary" (=${JSON.stringify(rosary1.intro && rosary1.intro.title)})`);
    ok(!!inv2.intro && !!inv2.prayer && inv2.adjacent && inv2.intro.title === "Prayer Intention: " + inv2.prayer.title && inv2.intro.text === T_EXT,
      `L2 title form, external family: the invitatory's intention row stands before its prayer, titled "Prayer Intention: " + the prayer track's own title, carrying the slot's drawn text (title=${JSON.stringify(inv2.intro && inv2.intro.title)}, prayer=${JSON.stringify(inv2.prayer && inv2.prayer.title)})`);
    ok(!!rosary1.intro && JSON.stringify(rosary1.intro.playSize) === "[42,42]",
      `L2 the intention row's play button is the STANDARD size (42px, not the panel's 30px small variant) (=${JSON.stringify(rosary1.intro && rosary1.intro.playSize)})`);

    // ---- L3 · second line + expand (the rosary's long text) ------
    ok(!!rosary1.intro && rosary1.intro.text === T_LONG && rosary1.intro.btnStands && rosary1.intro.textSH > rosary1.intro.textCH + 1,
      `L3 the intention text stands as the row's second line under the clamp, and the >2-line text arms its ellipsis by measurement (textSH=${rosary1.intro && rosary1.intro.textSH}, textCH=${rosary1.intro && rosary1.intro.textCH})`);
    // Stamp both cards, then expand — L6a reads the stamps after
    // the held download lands and the swap re-renders the pair.
    await ev(() => {
      const i = document.querySelector('[data-card="intro:daily-rosary"]');
      const p = document.querySelector('[data-card="daily-rosary"]');
      if (i) i.__swapStamp = "intro-before";
      if (p) p.__swapStamp = "prayer-before";
    });
    const ownKey = await ev(() => {
      const row = (window.state.ownStanding || []).find((r) => (window.state.ownSlots[r.sourceKey] || {}).tracks && window.state.ownSlots[r.sourceKey].tracks.some((m) => m.episodeId === "daily-rosary"));
      return row ? row.sourceKey : null;
    });
    await ev(() => { const b = document.querySelector('[data-card="intro:daily-rosary"] .ellipsis-btn'); if (b) b.click(); });
    await sleep(250);
    const exp3 = await rowInfo("daily-rosary");
    ok(!!exp3.intro && exp3.intro.expanded && exp3.intro.textSH === exp3.intro.textCH && exp3.intro.btnAria === "true",
      `L3 a click expands the intention row in place (clamp released, full text visible, aria-expanded true) (textSH=${exp3.intro && exp3.intro.textSH}, textCH=${exp3.intro && exp3.intro.textCH})`);

    // ---- L6a · ownSwapRow replaces BOTH cards --------------------
    let swapped = null;
    for (let i = 0; i < 50; i++) {
      swapped = await ev(() => {
        const intro = document.querySelector('[data-card="intro:daily-rosary"]');
        const prayer = document.querySelector('[data-card="daily-rosary"]');
        if (!intro || !prayer) return null;
        return { fresh: !intro.__swapStamp && !prayer.__swapStamp, expanded: intro.classList.contains("expanded"),
          introOwn: intro.getAttribute("data-own-row"), prayerOwn: prayer.getAttribute("data-own-row"),
          adjacent: intro.nextElementSibling === prayer };
      }).catch(() => null);
      if (swapped && swapped.fresh) break;
      await sleep(1000);
    }
    feedState.audioDelayMs = {};
    ok(!!swapped && swapped.fresh && swapped.adjacent && !!ownKey && swapped.introOwn === ownKey && swapped.prayerOwn === ownKey,
      `L6 ownSwapRow: when the rosary's held intro download lands, the swap replaces BOTH cards — fresh pair nodes in order, both carrying the row identity (ownKey=${ownKey}, swapped=${JSON.stringify(swapped)})`);
    ok(!!swapped && swapped.expanded,
      "L6 the expansion survives the swap re-render (the session set re-renders the fresh intention row expanded)");

    // ---- L3 (rest) · collapse, exact-2, short ---------------------
    await ev(() => { const b = document.querySelector('[data-card="intro:daily-rosary"] .ellipsis-btn'); if (b) b.click(); });
    await sleep(250);
    const col3 = await rowInfo("daily-rosary");
    ok(!!col3.intro && !col3.intro.expanded && col3.intro.textSH > col3.intro.textCH + 1 && col3.intro.btnAria === "false",
      "L3 a second click collapses the row back under the clamp (aria-expanded false)");
    const mp3 = await rowInfo("morning-prayer");
    ok(!!mp3.intro && mp3.intro.text === T_EXACT2 && !mp3.intro.btnStands && mp3.intro.textSH === mp3.intro.textCH && mp3.intro.textCH >= 40,
      `L3 the exact-two-line text (morning prayer) stands NO ellipsis — nothing is hidden (textSH=${mp3.intro && mp3.intro.textSH}, textCH=${mp3.intro && mp3.intro.textCH})`);
    await ev(() => window.openBlockPage("Night"));
    await sleep(400);
    ok(await waitIntro("daily-reflection"), "setup: the reflection pair stands on the Night page");
    const refl3 = await rowInfo("daily-reflection");
    ok(!!refl3.intro && refl3.intro.text === T_SHORT && !refl3.intro.btnStands && refl3.intro.textSH === refl3.intro.textCH && refl3.intro.textCH < 40,
      `L3 the one-line text (daily reflection) stands NO ellipsis (textSH=${refl3.intro && refl3.intro.textSH}, textCH=${refl3.intro && refl3.intro.textCH})`);
    await ev(() => window.openBlockPage("Morning"));
    await sleep(400);
    await waitIntro("daily-rosary");

    // ---- L5 · prayer row unchanged --------------------------------
    const rosary5 = await rowInfo("daily-rosary");
    ok(!!rosary5.prayer && rosary5.prayer.lastIsDot && (!rosary5.intro || rosary5.intro.dot === false),
      `L5 the prayer row keeps its played dot as the row's LAST element, and no dot stands on the intention row where one stands (prayer=${JSON.stringify(rosary5.prayer)}, introDot=${rosary5.intro && rosary5.intro.dot})`);
    await ev(() => { const b = document.querySelector('[data-card="daily-rosary"] [data-playkey="daily-rosary"]'); if (b) b.click(); });
    await sleep(500);
    const q5 = await ev(() => ({ q: window.state.queue.map((d) => d.episodeId), cur: window.state.current && window.state.current.episodeId }));
    ok(q5.q.length >= 2 && q5.q[0] === "intro:daily-rosary" && q5.q[1] === "daily-rosary",
      `L5 a tap on the prayer row behaves as the standing rules (its intro pulled in as the pair head, v351) (q=${JSON.stringify(q5.q.slice(0, 3))})`);
    await wipe();

    // ---- L4 · pair selection from the intention row ---------------
    await ev(() => { const b = document.querySelector('[data-playkey="intro:morning-prayer"]'); if (b) b.click(); });
    await sleep(500);
    const q4 = await ev(() => ({ q: window.state.queue.map((d) => d.episodeId), cur: window.state.current && window.state.current.episodeId }));
    ok(q4.q.length >= 2 && q4.q[0] === "intro:morning-prayer" && q4.q[1] === "morning-prayer" && q4.cur === "intro:morning-prayer",
      `L4 pair selection: a click on the intention row's play button selects the pair — queue [intro, prayer], the intro playing (the v351 decision-5 path) (q=${JSON.stringify(q4.q.slice(0, 3))}, cur=${q4.cur})`);
    await wipe();

    // ---- L7 · search ----------------------------------------------
    await ev(() => window.goListenHome());
    await sleep(400);
    await page.fill("#day-search", "Rosary");
    await sleep(300);
    const s7a = await ev(() => {
      const body = document.getElementById("home-body");
      const intro = body ? body.querySelector('[data-card="intro:daily-rosary"]') : null;
      const prayer = body ? body.querySelector('[data-card="daily-rosary"]') : null;
      return { pair: !!intro && !!prayer && intro.nextElementSibling === prayer, panel: !!body && !!body.querySelector(".intention-panel") };
    });
    ok(s7a.pair && !s7a.panel, `L7 search: a title hit renders the PAIR (intention row above its prayer), never a combined card (=${JSON.stringify(s7a)})`);
    await page.fill("#day-search", "Margaret");
    await sleep(300);
    const s7b = await ev(() => {
      const body = document.getElementById("home-body");
      const intro = body ? body.querySelector('[data-card="intro:daily-rosary"]') : null;
      const prayer = body ? body.querySelector('[data-card="daily-rosary"]') : null;
      return { pair: !!intro && !!prayer && intro.nextElementSibling === prayer };
    });
    ok(s7b.pair, `L7 search: an intro-text-only hit ("Margaret" stands only in the rosary's intention text) surfaces the prayer hit with its intention row above it (=${JSON.stringify(s7b)})`);
    await page.fill("#day-search", "");
    await sleep(300);

    // ---- L8 · queue titles ----------------------------------------
    await ev(() => {
      const ds = window.state.dayDescs || [];
      const slice = ["intro:daily-rosary", "daily-rosary", "intro:morning-prayer", "morning-prayer"]
        .map((id) => ds.find((x) => x.episodeId === id)).filter(Boolean);
      window.startQueue(slice);
    });
    await sleep(500);
    await ev(() => window.openNowPlaying());
    await sleep(400);
    const rows8 = await ev(() => Array.from(document.querySelectorAll(".npq-row")).map((r) => ({
      id: r.getAttribute("data-npq-id"),
      title: (r.querySelector(".npq-title") || {}).textContent || "",
      dot: !!r.querySelector(".npq-dot"),
      introCls: r.classList.contains("npq-intro"),
    })));
    const introRow8 = rows8.find((r) => r.id === "intro:daily-rosary");
    const prayerRow8 = rows8.find((r) => r.id === "daily-rosary");
    ok(!!introRow8 && introRow8.title === "Prayer Intention: Daily Rosary" && introRow8.dot === false && introRow8.introCls,
      `L8 queue titles: the queue's intro row carries the same "Prayer Intention: Daily Rosary" title with NO played dot (=${JSON.stringify(introRow8)})`);
    ok(!!prayerRow8 && prayerRow8.title === "Daily Rosary" && prayerRow8.dot === true,
      `L8 queue titles: prayer rows are unchanged (bare title, played dot stands) (=${JSON.stringify(prayerRow8)})`);
    await wipe();
    await page.close(); await ctx.close();

    // ---- L6b · extSwapCard at the completion leg (fresh open) -----
    // Intentions delayed 5s (inside the client's 8s fetch budget,
    // past the slots' settle): the invitatory's card first stands
    // ALONE; when the map lands, the completion leg's guard (its
    // panel test re-pointed to the pair form) fires extSwapCard
    // and the pair replaces the card in order, in the same session.
    siteState.intentionsDelayMs = 5000;
    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await wireContext(ctxB);
    const pageB = await ctxB.newPage();
    const evB = (fn, arg) => pageB.evaluate(fn, arg);
    await pageB.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    // Poll from load (NO readiness gate first — the readiness
    // mold waits for intro descriptors, which is exactly what
    // the delay holds back, and the window would close before
    // the poll started). Open the Morning page as soon as the
    // day stands, then watch for the defect shape inside the
    // delay window: slot settled present, intros map still
    // empty, the card standing alone.
    let preB = null;
    let openedB = false;
    for (let i = 0; i < 60; i++) {
      const s = await evB(() => {
        const st = window.state || {};
        return {
          day: !!st.dayPayload,
          inv: st.extSlots && st.extSlots["ext-invitatory"] && st.extSlots["ext-invitatory"].state,
          intros: st.dayPayload && st.dayPayload.intros ? Object.keys(st.dayPayload.intros).length : 0,
          pair: !!document.querySelector('[data-card="intro:ext-invitatory"]'),
          card: !!document.querySelector('[data-card="ext-invitatory"]'),
        };
      }).catch(() => null);
      if (s && s.day && !openedB) { openedB = true; await evB(() => window.openBlockPage("Morning")).catch(() => {}); }
      if (s && s.inv === "present" && s.intros === 0 && s.pair === false && s.card === true) { preB = s; break; }
      await sleep(200);
    }
    ok(!!preB, `L6 precondition: with intentions delayed, the settled invitatory card stands ALONE (no intention row yet) (pre=${JSON.stringify(preB)})`);
    await evB(() => { window.__leg6session = "same-session"; });
    const pairB = await pageB.waitForFunction(() => !!document.querySelector('[data-card="intro:ext-invitatory"]'), null, { timeout: 30000 }).then(() => true).catch(() => false);
    const postB = await evB(() => {
      const intro = document.querySelector('[data-card="intro:ext-invitatory"]');
      const prayer = document.querySelector('[data-card="ext-invitatory"]');
      return { adjacent: !!intro && !!prayer && intro.nextElementSibling === prayer,
        title: intro && intro.querySelector("h3") ? intro.querySelector("h3").textContent : null,
        prayerTitle: prayer && prayer.querySelector("h3") ? prayer.querySelector("h3").textContent : null,
        seq: Array.from(document.querySelectorAll("[data-card]")).map((c) => c.getAttribute("data-card")),
        introCount: document.querySelectorAll('[data-card="intro:ext-invitatory"]').length,
        session: window.__leg6session };
    });
    ok(pairB && postB.adjacent && postB.introCount === 1 && postB.session === "same-session" && postB.title === "Prayer Intention: " + postB.prayerTitle,
      `L6 extSwapCard: when the intro lands, the pair replaces the settled card IN ORDER in the same session — exactly ONE intention row immediately before the prayer card, however many swaps run (=${JSON.stringify(postB)})`);
    siteState.intentionsDelayMs = 0;
    await pageB.close(); await ctxB.close();

    ok(pageErrors.length === 0, `browser: no page errors across the v361 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v361: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
