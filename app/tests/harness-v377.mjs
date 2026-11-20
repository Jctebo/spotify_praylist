#!/usr/bin/env node
// harness-v377 — the v377 gate (Plan §2.7, client legs): the
// two-way OraDayBridge. Legs: (A) with NO Capacitor global (the
// browser case) the day builds identically, the web MediaSession
// is written as always (B6 negative), and no error is raised;
// (B) with a stubbed OraDayBridge (setDaySnapshot +
// setPlaybackState + addListener) the client: pushes a snapshot
// v2 (queueIds + currentIndex), pushes B1 state on play / pause
// / next / stop with the full field set, executes
// transportCommand events through its own transport (play
// resumes, next advances, stop clears + a stopped push), and
// never writes the web MediaSession (B6). A spoken (v375 TTS)
// descriptor pushes kind 'spoken' with estimated:true.
// Fixture posture: the standing estate mold (v358/v359) —
// local feed + HTTPS site servers, the presented day built by
// the shipped client from fixture feeds. Scratch wrangler
// instance INSIDE the worktree, synthetic fixture only, tallies
// read from the COMPLETE log.
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const FORK = path.resolve(APP, "..");
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v377 runs only inside a release worktree"); process.exit(2); }
const PRISTINE_APP = process.env.OPN_PRISTINE_APP || "";
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997, FEED_PORT = 8957, SITE_PORT = 443, PPORT = 8987;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`, PBASE = `http://127.0.0.1:${PPORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v377");
const PPERSIST = "";
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v377-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");
const NOVENAS_PLAYLIST = "2hclGC0JlP4tC51uohete6";

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chicagoParts = (d) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
const isoOf = (p) => `${p.year}-${p.month}-${p.day}`;
const TODAY = isoOf(chicagoParts(new Date()));
const chicagoHour = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hourCycle: "h23" }).format(new Date())) % 24;
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
function d1Query(appDir, persist, sql) {
  const out = execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"), "--persist-to", persist, "--command", sql, "--json"],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
  const arr = JSON.parse(out.slice(out.indexOf("[")));
  return (arr[0] && arr[0].results) || [];
}
function migFiles(appDir, upto = null) {
  const dir = path.join(appDir, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()
    .filter((f) => !upto || f <= upto).map((f) => path.join(dir, f));
}
function applyFiles(appDir, persist, files, extraSql = "") {
  fs.rmSync(persist, { recursive: true, force: true });
  const parts = files.map((f) => fs.readFileSync(f, "utf8"));
  if (extraSql) parts.push(extraSql);
  const f = path.join(TMPD, `mig-${path.basename(persist)}-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1File(appDir, persist, f);
}
function applySql(appDir, persist, sql) {
  const f = path.join(TMPD, `one-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, sql);
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

// ---- fixture feeds (the v344/v348 presented-day set, + a third novena) ---
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
const feedServer = http.createServer(async (req, res) => {
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
    // v358 repro posture: the production enclosure host refuses direct
    // browser reads (client §2.3) — a request carrying the app's Referer
    // is a browser read; the Worker's pass-through fetch carries none.
    if (req.headers.referer && /^(morning-prayer-elevenlabs-|daily-rosary-|marian-antiphon-angelus-|\d{4}-\d{2}-\d{2}-st-|auxilium-christianorum-|daily-reflection-)/.test(name)) { res.writeHead(403); return res.end("refused"); }
    if (name.startsWith("daily-rosary-")) await new Promise((r) => setTimeout(r, 30000));
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
  }
  res.writeHead(404); res.end();
});

// ---- HTTPS site (orapronobis.media, host-mapped in the browser) --
const siteState = { podcast: podcastMain(), intentions: INTENTIONS_MAIN };
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
      res.writeHead(200, { "content-type": "application/rss+xml", "access-control-allow-origin": "*" });
      return res.end(siteState.intentions);
    }
    res.writeHead(404); res.end();
  });
  return new Promise((r) => siteServer.listen(SITE_PORT, r));
}

async function main() {
  let browser = null;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v358-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    // ============ candidate app (v349 boot order: items seed ====
    // after migrations <= 0012, migration 0013 applies last) =====
    // Ship-tree fixture adaptation (v359 Ship, on the v375 base):
    // migrations 0014-0016 postdate this harness; 0016's unkeyed
    // prayer_items INSERT takes the id the seed's first keyed item
    // wants (the estate's known 0016-insert/seed collision). Boot
    // order generalized per the v368 mold: seed after <= 0012,
    // then 0013..0016 apply in order on top.
    applyFiles(APP, PERSIST, migFiles(APP, "0012_mass_homilies_block.sql"), seedSql());
    const postSeed = migFiles(APP).filter((f) => path.basename(f) > "0012_mass_homilies_block.sql");
    applySql(APP, PERSIST, postSeed.map((f) => fs.readFileSync(f, "utf8")).join("\n"));
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");
    const swJs = (await api(BASE, "GET", "/sw.js")).text;
    ok(swJs.includes("ora-pro-nobis-v377-1"), "SW pin: the served service worker carries CACHE 'ora-pro-nobis-v377-1'");

    // ============ browser ========================================
    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    browser = await chromium.launch({
      executablePath: CHROME, env: browserEnv,
      args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server", "--autoplay-policy=no-user-gesture-required",
        "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
    });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
    await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
    await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
    await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: BIAY_XML }));
    await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: TONE_16 }));
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const ds = (window.state && window.state.dayDescs) || [];
      const need = ["daily-rosary", "morning-prayer", "novena-st-anne", "novena-st-rita", "auxilium-christianorum", "ext-invitatory"];
      return need.every((id) => ds.some((x) => x.episodeId === id && x.available))
        && ds.some((x) => x.episodeId === "intro:daily-rosary");
    }, null, { timeout: 45000 }).catch(() => {});
    await sleep(800);

    // ================= A · absent plugin: browser unchanged =====
    const aState = await page.evaluate(() => ({
      descs: (window.state.dayDescs || []).length,
      cap: typeof window.Capacitor,
      presented: window.state.presentedDay,
    }));
    ok(aState.cap === "undefined", `A0 leg validity: no Capacitor global in the plain browser page (typeof=${aState.cap})`);
    ok(aState.descs >= 15 && aState.presented === TODAY,
      `A1 absent plugin: the day builds identically (descs=${aState.descs}, presented=${aState.presented})`);
    // B6 negative: in a browser the web MediaSession IS the face.
    // Playback is driven through tapPlay — the one dispatch every
    // [data-playkey] surface calls (the standing harness seam).
    await page.evaluate(() => { const d = window.state.dayDescs.find((x) => x.episodeId === "morning-prayer"); tapPlay(d); });
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "morning-prayer", null, { timeout: 30000 }).catch(() => {});
    await sleep(600);
    const aMs = await page.evaluate(() => ({
      hasMeta: !!(navigator.mediaSession && navigator.mediaSession.metadata),
      title: navigator.mediaSession && navigator.mediaSession.metadata ? navigator.mediaSession.metadata.title : null,
      ps: navigator.mediaSession ? navigator.mediaSession.playbackState : null,
    }));
    ok(aMs.hasMeta && !!aMs.title, `A2 browser face intact: web MediaSession metadata written outside the shell (title=${JSON.stringify(aMs.title)})`);
    ok(pageErrors.length === 0, `A3 absent plugin: no page errors (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);

    // ================= B · stubbed plugin: the two-way bridge ===
    const page2 = await ctx.newPage();
    const page2Errors = [];
    page2.on("pageerror", (e) => page2Errors.push(String(e)));
    await page2.addInitScript(() => {
      window.__snaps = [];
      window.__states = [];
      window.__cmdHandlers = [];
      window.Capacitor = { Plugins: { OraDayBridge: {
        setDaySnapshot: (args) => { window.__snaps.push(args); return Promise.resolve(); },
        setPlaybackState: (args) => { try { window.__states.push(JSON.parse(args.state)); } catch (e) {} return Promise.resolve(); },
        addListener: (name, fn) => { window.__cmdHandlers.push({ name, fn }); return Promise.resolve({ remove: () => {} }); },
      } } };
      // Speech stub (the v375 pattern): the spoken leg needs an
      // engine; headless has none with voices.
      window.__speechLog = { speaks: [], cancels: 0 };
      Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
        speak: function (u) {
          window.__speechLog.speaks.push(u);
          setTimeout(function () { if (u.onstart) u.onstart(); }, 5);
          // Fast end (the v375 'normal' mode shape): the pair
          // advances to its prayer in well under a second, so
          // the transport legs read the prayer's pushes, not a
          // 30 s spoken hold.
          setTimeout(function () { if (u.onend) u.onend({}); }, 300);
        },
        cancel: function () { window.__speechLog.cancels++; },
        pause: function () {}, resume: function () {},
        getVoices: function () { return [{ lang: "en_US", name: "US Voice Default", default: true }]; },
        addEventListener: function () {},
      } });
      try {
        Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, writable: true, value: function (text) {
          this.text = text; this.lang = ""; this.rate = 1; this.pitch = 1; this.voice = null;
          this.onstart = null; this.onend = null; this.onerror = null;
        } });
      } catch (e) { /* the native constructor stands; the leg reads pushes only */ }
    });
    await page2.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page2.waitForFunction(() => {
      const ds = (window.state && window.state.dayDescs) || [];
      return ds.some((x) => x.episodeId === "morning-prayer" && x.available)
        && ds.some((x) => x.episodeId === "intro:daily-rosary")
        && (window.__snaps || []).length > 0;
    }, null, { timeout: 60000 }).catch(() => {});
    const lastState = async () => page2.evaluate(() => {
      const s = window.__states || [];
      return s.length ? s[s.length - 1] : null;
    });
    const waitState = async (pred, timeout = 25000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const s = await page2.evaluate(() => (window.__states || []).slice());
        const hit = s.filter(pred);
        if (hit.length) return hit[hit.length - 1];
        await sleep(400);
      }
      return null;
    };
    const fireCmd = async (cmd, extra = {}) => page2.evaluate(([c, x]) => {
      const h = (window.__cmdHandlers || []).filter((y) => y.name === "transportCommand");
      if (!h.length) return false;
      h.forEach((y) => y.fn({ command: c, ...x }));
      return true;
    }, [cmd, extra]);

    // Snapshot v2 (§2.6).
    const snapRaw = await page2.evaluate(() => {
      const s = window.__snaps || [];
      return s.length ? s[s.length - 1].snapshot : null;
    });
    let snap = null; try { snap = JSON.parse(snapRaw || ""); } catch { /* stays null */ }
    ok(!!snap && Array.isArray(snap.queueIds) && "currentIndex" in snap && Array.isArray(snap.tracks) && snap.tracks.length >= 8,
      `B1 snapshot v2: queueIds + currentIndex ride the snapshot (queueIds=${snap && JSON.stringify(snap.queueIds)}, currentIndex=${snap && snap.currentIndex})`);

    // Play from the card's dispatch: a B1 push with the full
    // field set.
    await page2.evaluate(() => { const d = window.state.dayDescs.find((x) => x.episodeId === "morning-prayer"); tapPlay(d); });
    const playPush = await waitState((s) => s.trackId === "morning-prayer" && s.playing === true);
    ok(!!playPush, "B2 play: a state push reports morning-prayer playing");
    ok(!!playPush && playPush.engine === "web" && playPush.kind === "episode" && playPush.title === "Morning Prayer"
        && typeof playPush.positionS === "number" && typeof playPush.durationS === "number"
        && Array.isArray(playPush.queueIds) && playPush.queueIds[playPush.queueIndex] === "morning-prayer"
        && playPush.queueCount === playPush.queueIds.length && typeof playPush.rate === "number" && typeof playPush.ts === "number",
      `B3 push field set (B1): ${JSON.stringify(playPush && { kind: playPush.kind, qi: playPush.queueIndex, qc: playPush.queueCount })}`);
    // B6: inside the shell the web MediaSession is never written.
    const bMs = await page2.evaluate(() => ({
      meta: navigator.mediaSession ? navigator.mediaSession.metadata : undefined,
      ps: navigator.mediaSession ? navigator.mediaSession.playbackState : null,
      handler: !!(window.__opnMediaHandlers),
    }));
    ok(bMs.meta === null && bMs.ps === "none",
      `B4 B6: web MediaSession untouched in the shell (metadata=${bMs.meta}, playbackState=${bMs.ps})`);

    // Commands through the app's own transport (B3/B4).
    ok(await fireCmd("pause"), "B5 command channel: the transportCommand listener stands registered");
    const pausePush = await waitState((s) => s.trackId === "morning-prayer" && s.playing === false);
    ok(!!pausePush, "B6 pause command: the app pauses and the ack push reports playing=false");
    await fireCmd("play");
    const resumePush = await waitState((s) => s.trackId === "morning-prayer" && s.playing === true);
    ok(!!resumePush, "B7 play command: resumeCurrent resumes and the ack push reports playing=true");
    const beforeNext = await page2.evaluate(() => window.state.queueIdx);
    await fireCmd("next");
    const nextPush = await waitState((s) => s.queueIndex === beforeNext + 1 && s.playing === true);
    ok(!!nextPush, `B8 next command: the queue advances (index ${beforeNext} -> ${nextPush && nextPush.queueIndex}, track=${nextPush && nextPush.trackId})`);
    await fireCmd("stop");
    const stopPush = await waitState((s) => s.stopped === true);
    const afterStop = await page2.evaluate(() => ({ current: window.state.current, queue: (window.state.queue || []).length }));
    ok(!!stopPush && afterStop.current === null && afterStop.queue === 0,
      "B9 stop command: the standing transport clears and a stopped push lands");

    // The spoken leg (A7's client half): a v375 spoken intention
    // pushes kind 'spoken', estimated, in the v361 title form.
    await page2.evaluate(() => { const d = window.state.dayDescs.find((x) => x.episodeId === "intro:daily-rosary"); tapPlay(d); });
    const spokenPush = await waitState((s) => s.kind === "spoken" && s.playing === true);
    ok(!!spokenPush && spokenPush.estimated === true && spokenPush.title === "Prayer Intention: Daily Rosary"
        && spokenPush.durationS >= 30 && spokenPush.durationS <= 90,
      `B10 spoken push: kind=spoken estimated=true title=${JSON.stringify(spokenPush && spokenPush.title)} durationS=${spokenPush && spokenPush.durationS}`);
    ok(page2Errors.length === 0, `B11 stubbed plugin: no page errors (errors=${JSON.stringify(page2Errors.slice(0, 3))})`);
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v377: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
