#!/usr/bin/env node
// harness-v368 — the v368 gate (Plan §2.8 legs H1–H10, pairing
// included per John's word 2026-11-10 20:48 CT — the NEW module
// item): migration 0016 under its guards (incl. the production
// collision: a standing Evening ACTIVITY item named 'The AI
// Signal'), the nine-block shell + the §2.2.7 descriptor
// exception, the module proof (exactly one devotion, never
// current, never due), the two-table pairing contract, the door
// route POST /api/agent/player/episode, the client pair + missing
// state + played/queue treatment, and the helper's presented-set
// leg. Fixture posture: the standing estate mold (v349) — local
// feed + HTTPS site servers, the presented day built by the
// shipped client from fixture feeds; candidate + pristine
// (OPN_PRISTINE_APP) + a second candidate instance with NO
// episode registration for the missing-state legs. Scratch
// wrangler instances INSIDE the worktrees, synthetic fixture
// only, tallies read from the COMPLETE log.
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v368 runs only inside a release worktree"); process.exit(2); }
const PRISTINE_APP = process.env.OPN_PRISTINE_APP || "";
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997, FEED_PORT = 8957, SITE_PORT = 443, PPORT = 8987, MPORT = 8998;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`, PBASE = `http://127.0.0.1:${PPORT}`, MBASE = `http://127.0.0.1:${MPORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v368");
const MPERSIST = path.join(APP, ".wrangler-test-v368m");
const PPERSIST = PRISTINE_APP ? path.join(PRISTINE_APP, ".wrangler-test-v368p") : "";
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v368-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");

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
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString("utf8");
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, text, buf, headers: res.headers };
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
// The intro tone stands at 2.5s (not the estate mold's 1.0s):
// the H7 queue reads land ~0.9s after a tap, and a 1.0s intro
// ends + advances the queue before the read — the pair must
// stand intact mid-intro for the snapshot/restore assertions.
const TONE_1 = tone("t1.mp3", 660, 2.5);
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

// ---- seed (the estate mold: 35 items + the intention pool) -----
// Item id 40 is production's standing Evening ACTIVITY named
// 'The AI Signal' ("Listen to today's episode") — the collision
// the kind-scoped 0016 guard answers. The v368 seed adds ONE long
// intention (id 121) so the new item's pre-drawn text overflows
// its row (the H6 ellipsis legs).
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
const LONG_TEXT = "the repose of the soul of a very dear friend of the family who died this spring after a long illness, and for consolation and strength for his widow and for all of their children and grandchildren in their grief";
function seedSql(withLong = false) {
  const lines = [];
  for (const [id, block, name, kind, sort] of ITEMS) {
    lines.push(`INSERT INTO prayer_items (id, block, name, sub, kind, color, opening_prayer, closing_prayer, enabled, sort) VALUES (${id}, '${block}', '${name.replace(/'/g, "''")}', 'synthetic sub', '${kind}', '', 'Synthetic opening.', 'Synthetic closing.', 1, ${sort});`);
  }
  const pool = [];
  for (let i = 1; i <= 3; i++) pool.push([100 + i, `Synthetic intention H${i}`, "H"]);
  for (let i = 1; i <= 7; i++) pool.push([110 + i, `Synthetic intention M${i}`, "M"]);
  pool.push([120, "Synthetic intention L1", "L"]);
  if (withLong) pool.push([121, `For ${LONG_TEXT}`, "M"]);
  for (const [id, text, pr] of pool) lines.push(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES (${id}, '${text.replace(/'/g, "''")}', '${pr}', 'active', '2026-11-01T00:00:00.000Z');`);
  return lines.join("\n");
}
// Production order: items stand before 0013 applies (its item
// UPDATE needs them); the settings version is pinned to the live
// value 4 so 0016's bump reads 4 -> 5 exactly as production's.
function buildPersist(appDir, persist, withLong = false) {
  applyFiles(appDir, persist, migFiles(appDir, "0012_mass_homilies_block.sql"), seedSql(withLong));
  for (const f of ["0013_novenas_block.sql", "0014_confession_pin.sql", "0015_liturgical_days.sql"]) {
    applySql(appDir, persist, fs.readFileSync(path.join(appDir, "migrations", f), "utf8"));
  }
  applySql(appDir, persist, "UPDATE player_settings_meta SET version = 4 WHERE id = 1;");
}

// ---- fixture feeds (the v349 presented-day set) -----------------
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
  "novena-st-anne", "novena-st-rita", "auxilium-christianorum", "daily-reflection", "ext-invitatory", "ext-bible-in-a-year", "ext-gospel-exegesis",
  "the-ai-signal"];
const TRACK_TITLES = {
  "morning-prayer": "Morning Prayer", "daily-rosary": "Daily Rosary", "marian-antiphon-angelus": "Marian Antiphon — Angelus",
  "novena-st-fixture": "Novena to St. Fixture", "novena-st-jude": "Novena to St. Jude — Day 5",
  "novena-st-anne": "Novena to St. Anne — Day 1", "novena-st-rita": "Novena to St. Rita — Day 3",
  "auxilium-christianorum": "Auxilium Christianorum", "daily-reflection": "Daily Reflection",
  "ext-invitatory": "Invitatory", "ext-bible-in-a-year": "Bible in a Year", "ext-gospel-exegesis": "Daily Gospel Exegesis",
  "the-ai-signal": "The AI Signal",
};
const introItem = (id, len) =>
  `<item><title>Intention — ${TRACK_TITLES[id]}</title><guid isPermaLink="false">intentions-intro-${id}-${TODAY}</guid><pubDate>${rfc(TODAY, 0)}</pubDate><description>Intention audio.</description><enclosure url="${FEED}/audio/intro-${id}.mp3" type="audio/mpeg" length="${len}"/></item>`;
const segmentItem = (block, len) =>
  `<item><title>Intentions — ${block}</title><guid isPermaLink="false">intentions-segment-${block}-${TODAY}</guid><pubDate>${rfc(TODAY, 0)}</pubDate><description>Segment audio.</description><enclosure url="${FEED}/audio/segment-${block}.mp3" type="audio/mpeg" length="${len}"/></item>`;
const intentionsXml = (ids) => rss(ids.map((id, i) => introItem(id, 4100 + i * 137)).join("") + segmentItem("Morning", 9100));
const INTENTIONS_MAIN = intentionsXml(INTRO_IDS);

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
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v368-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    const mig16 = migFiles(APP).find((f) => path.basename(f).startsWith("0016"));
    ok(!!mig16, "H1 migration: 0016 file present in this tree");
    const mig16Sql = fs.readFileSync(mig16, "utf8");

    // ============ H1 · migration labs (D1, no server) ============
    {
      const labA = path.join(APP, ".wrangler-test-v368-labA");
      buildPersist(APP, labA);
      const rows0 = d1Query(APP, labA, "SELECT COUNT(*) AS c FROM player_source_settings")[0].c;
      const items0 = d1Query(APP, labA, "SELECT COUNT(*) AS c FROM prayer_items")[0].c;
      const ver0 = d1Query(APP, labA, "SELECT version FROM player_settings_meta WHERE id=1")[0].version;
      applySql(APP, labA, mig16Sql);
      const sRow = d1Query(APP, labA, "SELECT * FROM player_source_settings WHERE source_key='the-ai-signal'")[0];
      ok(rows0 === 26 && !!sRow && sRow.name === "The AI Signal" && sRow.family === "own" && sRow.block === "The AI Signal"
        && sRow.day_rule === "daily" && sRow.sort_order === 1 && sRow.enabled === 1 && sRow.slot_id === null && sRow.role === "primary",
        `H1a settings row: 26 rows stand pre-0016; the INSERT plants 'the-ai-signal' exactly as §2.1.1 (rows0=${rows0}, row=${JSON.stringify(sRow)})`);
      const iRow = d1Query(APP, labA, "SELECT * FROM prayer_items WHERE block='The AI Signal' AND kind='prayer'")[0];
      const actRow = d1Query(APP, labA, "SELECT * FROM prayer_items WHERE id=40")[0];
      const items1 = d1Query(APP, labA, "SELECT COUNT(*) AS c FROM prayer_items")[0].c;
      ok(items0 === 35 && items1 === 36 && !!iRow && iRow.name === "The AI Signal" && iRow.color === "gold" && iRow.enabled === 1 && iRow.sort === 1
        && !!actRow && actRow.block === "Evening" && actRow.kind === "activity",
        `H1b draw item: 35 -> 36 items DESPITE the standing same-name Evening activity (the kind-scoped guard fires); the new item stands as §2.1.2; the activity is untouched (items=${items0}->${items1}, item=${JSON.stringify(iRow)}, activity=${JSON.stringify(actRow && { block: actRow.block, kind: actRow.kind })})`);
      const ver1 = d1Query(APP, labA, "SELECT version FROM player_settings_meta WHERE id=1")[0].version;
      ok(ver0 === 4 && ver1 === 5, `H1c meta: version ${ver0} -> ${ver1} (the relative increment, exactly +1)`);
      applySql(APP, labA, mig16Sql);
      const rows2 = d1Query(APP, labA, "SELECT COUNT(*) AS c FROM player_source_settings")[0].c;
      const items2 = d1Query(APP, labA, "SELECT COUNT(*) AS c FROM prayer_items")[0].c;
      ok(rows2 === 27 && items2 === 36,
        `H1d second application: both guarded INSERTs match zero rows (settings=${rows2}, items=${items2}); the meta increment is the standing unconditional form`);
      fs.rmSync(labA, { recursive: true, force: true });

      const labB = path.join(APP, ".wrangler-test-v368-labB");
      buildPersist(APP, labB);
      applySql(APP, labB, "INSERT INTO player_source_settings (source_key, name, family, block, day_rule, sort_order, enabled, slot_id, role, updated_at) VALUES ('the-ai-signal', 'The AI Signal', 'own', 'Evening', 'daily', 5, 1, NULL, 'primary', '2026-11-01T00:00:00.000Z');");
      applySql(APP, labB, mig16Sql);
      const heldB = d1Query(APP, labB, "SELECT block, sort_order FROM player_source_settings WHERE source_key='the-ai-signal'")[0];
      const cntB = d1Query(APP, labB, "SELECT COUNT(*) AS c FROM player_source_settings WHERE source_key='the-ai-signal'")[0].c;
      const itemB = d1Query(APP, labB, "SELECT COUNT(*) AS c FROM prayer_items WHERE block='The AI Signal' AND kind='prayer'")[0].c;
      ok(!!heldB && heldB.block === "Evening" && heldB.sort_order === 5 && cntB === 1 && itemB === 1,
        `H1e held override (settings): John's own pre-existing 'the-ai-signal' row stands untouched and unduplicated (row=${JSON.stringify(heldB)}); the draw item still plants (count=${itemB})`);
      fs.rmSync(labB, { recursive: true, force: true });

      const labC = path.join(APP, ".wrangler-test-v368-labC");
      buildPersist(APP, labC);
      applySql(APP, labC, "INSERT INTO prayer_items (block, name, sub, kind, color, opening_prayer, closing_prayer, enabled, sort) VALUES ('Evening', 'The AI Signal', '', 'prayer', 'gold', '', '', 1, 9);");
      applySql(APP, labC, mig16Sql);
      const prayC = d1Query(APP, labC, "SELECT block FROM prayer_items WHERE name='The AI Signal' AND kind='prayer'");
      const setC = d1Query(APP, labC, "SELECT COUNT(*) AS c FROM player_source_settings WHERE source_key='the-ai-signal'")[0].c;
      ok(prayC.length === 1 && prayC[0].block === "Evening" && setC === 1,
        `H1f held override (item): a same-name PRAYER item of John's own blocks the INSERT and stands alone (rows=${JSON.stringify(prayC)}); the settings row still plants (count=${setC})`);
      fs.rmSync(labC, { recursive: true, force: true });
    }

    // ============ candidate app ==================================
    buildPersist(APP, PERSIST, true);
    applySql(APP, PERSIST, mig16Sql);
    const newItem = d1Query(APP, PERSIST, "SELECT id FROM prayer_items WHERE block='The AI Signal' AND kind='prayer'")[0];
    applySql(APP, PERSIST, `INSERT INTO prayer_draws (date, item_id, intention_id) VALUES ('${TODAY}', ${newItem.id}, 121);`);
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");

    // ---- H2 · shell ---------------------------------------------
    const shell = await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN });
    const sBlocks = (shell.body && shell.body.blocks) || [];
    const sNames = sBlocks.map((b) => b.block);
    const aiShell = sBlocks.find((b) => b.block === "The AI Signal");
    ok(JSON.stringify(sNames) === JSON.stringify(["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night", "Mass and Homilies", "Novenas", "The AI Signal"])
      && !!aiShell && aiShell.caption === "the day's episode" && !aiShell.spotifyUrl && aiShell.label === "The AI Signal" && shell.body.version === 5,
      `H2 shell: 9 blocks, The AI Signal LAST; caption "the day's episode"; NO Spotify route; label falls back to the block name; version reads the bumped 5 (blocks=${JSON.stringify(sNames)}, version=${shell.body && shell.body.version})`);

    // ---- H3 (absent half) ---------------------------------------
    ok(!!aiShell && Array.isArray(aiShell.tracks) && aiShell.tracks.length === 0 && aiShell.trackCount === 0,
      `H3a descriptor absent: no registration stands — the block's tracks [] and trackCount 0 (trackCount=${aiShell && aiShell.trackCount})`);

    // ---- H4 · module proof ---------------------------------------
    const mod = await api(BASE, "GET", `/api/agent/prayer/day?date=${TODAY}`, { token: TOKEN });
    const mBlocks = (mod.body && mod.body.blocks) || [];
    const aiMod = mBlocks[mBlocks.length - 1];
    const aiDevs = (aiMod && aiMod.devotions) || [];
    const aiDrawn = aiDevs.length === 1 && aiDevs[0].intentions && aiDevs[0].intentions[0] ? aiDevs[0].intentions[0].text : null;
    const evMod = mBlocks.find((b) => b.block === "Evening");
    const actDev = (evMod && evMod.devotions || []).find((d) => d.name === "The AI Signal");
    ok(!!aiMod && aiMod.block === "The AI Signal" && aiDevs.length === 1 && aiDevs[0].name === "The AI Signal" && aiDevs[0].kind === "prayer"
      && aiDrawn === `For ${LONG_TEXT}` && mod.body.devotionCount === 36 && mod.body.prayerCount === 22 && mod.body.activityCount === 14
      && !!actDev && actDev.kind === "activity",
      `H4a module: the payload's LAST block is 'The AI Signal' with exactly ONE devotion (the new prayer item) carrying its pre-drawn long intention; counts 36 devotions / 22 prayers / 14 activities; the Evening activity of the same name stands apart (drawn=${JSON.stringify((aiDrawn || "").slice(0, 30))}, counts=${mod.body.devotionCount}/${mod.body.prayerCount}/${mod.body.activityCount})`);
    ok(!!aiMod && aiMod.due === false && mod.body.currentBlock !== "The AI Signal",
      `H4b module: due=false for The AI Signal at the live hour ${chicagoHour()}; currentBlock reads ${JSON.stringify(mod.body.currentBlock)}, never The AI Signal`);
    const src = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
    const blocksM = src.match(/const PRAYER_BLOCKS = \[([^\]]+)\]/);
    const srcBlocks = blocksM ? [...blocksM[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    const startM = src.match(/const PRAYER_BLOCK_START[^=]*= \{([\s\S]*?)\};/);
    const srcStarts = {};
    if (startM) for (const m of startM[1].matchAll(/"?([\w ]+)"?: (\d+)/g)) srcStarts[m[1].trim()] = Number(m[2]);
    const derive = (blocks, starts, hour) => blocks.reduce((cur, b) => { const s = starts[b] ?? 0; const cs = starts[cur] ?? 0; return hour >= s && s > cs ? b : cur; }, "Morning");
    const eight = srcBlocks.filter((b) => b !== "The AI Signal");
    let neverAi = srcStarts["The AI Signal"] === 24;
    for (let h = 0; h < 24; h++) {
      if (derive(srcBlocks, srcStarts, h) === "The AI Signal") neverAi = false;
      if (derive(srcBlocks, srcStarts, h) !== derive(eight, srcStarts, h)) neverAi = false;
    }
    ok(neverAi && /WHEN 'The AI Signal' THEN 8/.test(src),
      `H4c derivation: BLOCK_START['The AI Signal']=24 in source; the shipped max-start derivation at every hour 0-23 never returns The AI Signal and equals the eight-block derivation at every hour (starts=${JSON.stringify(srcStarts)})`);
    const caseSql = (src.match(/SELECT \* FROM prayer_items ORDER BY CASE block[^"]*/) || [""])[0];
    const ordered = caseSql ? d1Query(APP, PERSIST, caseSql.replace(/;?\s*$/, "")) : [];
    const lastNov = ordered.map((r, i) => [r, i]).filter(([r]) => r.block === "Novenas").pop();
    const aiIdx = ordered.findIndex((r) => r.block === "The AI Signal" && r.kind === "prayer");
    ok(!!caseSql && aiIdx > (lastNov ? lastNov[1] : -1) && aiIdx === ordered.length - 1,
      `H4d item order: under the shipped CASE (…WHEN 'The AI Signal' THEN 8), the new item sorts after every Novenas item and LAST overall (index=${aiIdx} of ${ordered.length})`);

    // ---- H5 · pairing contract -----------------------------------
    const helperSrc = fs.readFileSync(path.join(FORK, "jobs", "compose_app_audio.py"), "utf8");
    const wPair = (src.match(/"the-ai-signal": "([^"]+)"/) || [])[1];
    const hPair = (helperSrc.match(/"the-ai-signal": "([^"]+)"/) || [])[1];
    const introTexts = (shell.body && shell.body.introTexts) || {};
    ok(wPair === "The AI Signal" && hPair === "The AI Signal" && introTexts["the-ai-signal"] === `For ${LONG_TEXT}`,
      `H5 pairing contract: Worker INTRO_PAIRING['the-ai-signal'] === helper SLOT_PAIRING['the-ai-signal'] === 'The AI Signal'; the shell introTexts carries 'the-ai-signal' with the NEW item's drawn text — the name-keyed map takes the LAST block's item, not the Evening activity's (worker=${wPair}, helper=${hPair}, text=${JSON.stringify((introTexts["the-ai-signal"] || "").slice(0, 30))})`);

    // ---- settings comparison vs pristine -------------------------
    const candSet = await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN });
    const candRows = ((candSet.body && candSet.body.sources) || []);
    const candAi = candRows.find((r) => r.sourceKey === "the-ai-signal");
    ok(appJs.includes("'The AI Signal'") && !!candAi && candAi.block === "The AI Signal" && candAi.family === "own" && candSet.body.version === 5,
      `settings surface: the served client carries The AI Signal in its settings block lists; the door settings read shows the row under its own block, version 5 (row=${JSON.stringify(candAi)})`);
    if (PRISTINE_APP) {
      applyFiles(PRISTINE_APP, PPERSIST, migFiles(PRISTINE_APP), seedSql());
      startApp(PRISTINE_APP, PPORT, PPERSIST);
      ok(await waitUp(PBASE), "pristine app up for the settings/shell comparison");
      const prSet = await api(PBASE, "GET", "/api/agent/player/settings", { token: TOKEN });
      const prRows = ((prSet.body && prSet.body.sources) || []);
      const strip = (rows) => rows.filter((r) => r.sourceKey !== "the-ai-signal").map((r) => JSON.stringify(r)).sort();
      const prShell = await api(PBASE, "GET", "/api/agent/player/day", { token: TOKEN });
      ok(JSON.stringify(strip(candRows)) === JSON.stringify(strip(prRows)) && candSet.body.version === prSet.body.version + 1
        && sNames.length === ((prShell.body.blocks || []).length + 1),
        `settings comparison: every settings row except 'the-ai-signal' is identical candidate vs pristine; version stands exactly +1 (candidate=${candSet.body.version}, pristine=${prSet.body.version}); the shell carries exactly one more block`);
    } else {
      ok(false, "settings comparison: OPN_PRISTINE_APP not set — comparison not run");
    }

    // ---- H9 · the door route --------------------------------------
    const epHeaders = (over = {}) => ({ "content-type": "audio/mpeg", "x-episode-id": "the-ai-signal", "x-episode-date": TODAY, "x-episode-title": "The AI Signal", "x-duration-s": "388", ...over });
    const noTok = await api(BASE, "POST", "/api/agent/player/episode", { raw: TONE_3, headers: epHeaders() });
    ok(noTok.status === 403, `H9a door: no agent token -> 403 (status=${noTok.status})`);
    const wrongId = await api(BASE, "POST", "/api/agent/player/episode", { token: TOKEN, raw: TONE_3, headers: epHeaders({ "x-episode-id": "morning-prayer" }) });
    ok(wrongId.status === 400, `H9b door: a wrong X-Episode-Id -> 400, the route registers exactly one episode kind (status=${wrongId.status})`);
    const badDate = await api(BASE, "POST", "/api/agent/player/episode", { token: TOKEN, raw: TONE_3, headers: epHeaders({ "x-episode-date": "10/11/2026" }) });
    const noTitle = await api(BASE, "POST", "/api/agent/player/episode", { token: TOKEN, raw: TONE_3, headers: epHeaders({ "x-episode-title": "" }) });
    const badDur = await api(BASE, "POST", "/api/agent/player/episode", { token: TOKEN, raw: TONE_3, headers: epHeaders({ "x-duration-s": "abc" }) });
    ok(badDate.status === 400 && noTitle.status === 400 && badDur.status === 400,
      `H9c door: malformed date / empty title / non-numeric duration each -> 400 (statuses=${badDate.status}/${noTitle.status}/${badDur.status})`);
    const happy = await api(BASE, "POST", "/api/agent/player/episode", { token: TOKEN, raw: TONE_3, headers: epHeaders() });
    ok(happy.status === 200 && happy.body && happy.body.ok === true && happy.body.sizeBytes === TONE_3.length && happy.body.date === TODAY,
      `H9d door happy path: 200 with {ok, sizeBytes = the body's byte length} (status=${happy.status}, sizeBytes=${happy.body && happy.body.sizeBytes}, tone=${TONE_3.length})`);
    const row1 = d1Query(APP, PERSIST, `SELECT * FROM player_episodes WHERE date='${TODAY}' AND episode_id='the-ai-signal'`)[0];
    ok(!!row1 && row1.audio_state === "present" && row1.size_bytes === TONE_3.length && row1.r2_key === `episodes/${TODAY}/the-ai-signal.mp3`
      && row1.title === "The AI Signal" && row1.block === "The AI Signal" && Number(row1.duration_s) === 388,
      `H9e door read-back: the row stands present with the spec'd r2_key, size, title, block, duration (row=${JSON.stringify(row1)})`);
    const happy2 = await api(BASE, "POST", "/api/agent/player/episode", { token: TOKEN, raw: TONE_30, headers: epHeaders({ "x-duration-s": "30" }) });
    const rows2 = d1Query(APP, PERSIST, `SELECT * FROM player_episodes WHERE date='${TODAY}' AND episode_id='the-ai-signal'`);
    ok(happy2.status === 200 && rows2.length === 1 && rows2[0].size_bytes === TONE_30.length,
      `H9f door re-POST: the same date replaces whole — one row stands, size updated (rows=${rows2.length}, size=${rows2[0] && rows2[0].size_bytes})`);
    const audioGet = await api(BASE, "GET", `/api/player/audio/${TODAY}/the-ai-signal`);
    ok(audioGet.status === 200 && audioGet.buf.equals(TONE_30),
      `H9g audio route: GET serves the uploaded bytes exactly (status=${audioGet.status}, bytes=${audioGet.buf.length})`);
    const ranged = await api(BASE, "GET", `/api/player/audio/${TODAY}/the-ai-signal`, { headers: { range: "bytes=0-99" } });
    ok(ranged.status === 206 && ranged.headers.get("content-range") === `bytes 0-99/${TONE_30.length}` && ranged.buf.length === 100,
      `H9h audio route: a Range request answers 206 with a correct Content-Range (status=${ranged.status}, range=${ranged.headers.get("content-range")})`);
    const pastPost = await api(BASE, "POST", "/api/agent/player/episode", { token: TOKEN, raw: TONE_3, headers: epHeaders({ "x-episode-date": YDAY, "x-duration-s": "3" }) });
    ok(pastPost.status === 200, `H9i door: a past-dated registration (the Ship smoke shape) lands 200 and stands inert (status=${pastPost.status})`);

    // ---- H3 (present half) ----------------------------------------
    const shell2 = await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN });
    const aiShell2 = (shell2.body.blocks || []).find((b) => b.block === "The AI Signal");
    const desc = aiShell2 && aiShell2.tracks && aiShell2.tracks[0];
    ok(!!desc && desc.episodeId === "the-ai-signal" && desc.title === "The AI Signal" && desc.kind === "episode"
      && desc.streamUrl === `/api/player/audio/${TODAY}/the-ai-signal` && Number(desc.durationS) === 30 && desc.sizeBytes === TONE_30.length && aiShell2.trackCount === 1,
      `H3b descriptor present: the presented day's registration fills the block with the §2.2.7 descriptor + trackCount 1 — keyed to the PRESENTED day (yesterday's registration never presents) (desc=${JSON.stringify(desc)})`);
    applySql(APP, PERSIST, `UPDATE player_episodes SET audio_state='missing' WHERE date='${TODAY}' AND episode_id='the-ai-signal'`);
    const shell3 = await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN });
    const aiShell3 = (shell3.body.blocks || []).find((b) => b.block === "The AI Signal");
    ok(!!aiShell3 && aiShell3.tracks.length === 0 && aiShell3.trackCount === 0,
      `H3c descriptor gate: a row standing NOT 'present' fills nothing — tracks [] + trackCount 0`);
    applySql(APP, PERSIST, `UPDATE player_episodes SET audio_state='present' WHERE date='${TODAY}' AND episode_id='the-ai-signal'`);

    // ---- H10 · the helper leg --------------------------------------
    const pyOut = execFileSync("python3", ["-c", `
import sys; sys.path.insert(0, ${JSON.stringify(path.join(FORK, "jobs"))})
import compose_app_audio as c
print(c.pairing_for('the-ai-signal'))
print(c.APP_PRESENTED)
print(c.SLOT_PAIRING.get('the-ai-signal'))
`], { encoding: "utf8" }).trim().split("\n");
    ok(pyOut[0] === "The AI Signal" && pyOut[1] === "['the-ai-signal']" && pyOut[2] === "The AI Signal"
      && /presented \+ APP_PRESENTED/.test(helperSrc) && /titles\["the-ai-signal"\] = "The AI Signal"/.test(helperSrc)
      && helperSrc.includes("intentions-intro-{episode_id}-{date}"),
      `H10 generation: pairing_for('the-ai-signal') = 'The AI Signal'; APP_PRESENTED = ['the-ai-signal'] is appended to the presented set before eligibility with the report title set; publish_intentions' guid form yields intentions-intro-the-ai-signal-<date> with audio only (py=${JSON.stringify(pyOut)})`);

    // ============ browser legs ===================================
    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    browser = await chromium.launch({
      executablePath: CHROME, env: browserEnv,
      args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server", "--autoplay-policy=no-user-gesture-required",
        "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
    });
    const mkCtx = async (width) => {
      const ctx = await browser.newContext({ viewport: { width, height: 844 } });
      await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
      await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
      await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
      await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: BIAY_XML }));
      await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: TONE_16 }));
      return ctx;
    };

    // ---- H7 (missing half) · the unregistered instance ------------
    buildPersist(APP, MPERSIST, true);
    applySql(APP, MPERSIST, mig16Sql);
    const mItem = d1Query(APP, MPERSIST, "SELECT id FROM prayer_items WHERE block='The AI Signal' AND kind='prayer'")[0];
    applySql(APP, MPERSIST, `INSERT INTO prayer_draws (date, item_id, intention_id) VALUES ('${TODAY}', ${mItem.id}, 121);`);
    startApp(APP, MPORT, MPERSIST);
    ok(await waitUp(MBASE), "missing-state instance up (0016 applied, NO episode registration)");
    await api(MBASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    {
      const ctx = await mkCtx(360);
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      await page.goto(MBASE + "/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => (window.state.dayDescs || []).some((d) => d.episodeId === "the-ai-signal"), null, { timeout: 45000 }).catch(() => {});
      await sleep(600);
      await page.evaluate(() => window.openBlockPage("The AI Signal"));
      await sleep(600);
      const m = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("[data-card]")].map((el) => ({ id: el.getAttribute("data-card"), h: Math.round(el.getBoundingClientRect().height), meta: (el.querySelector(".meta") || {}).textContent || "", title: (el.querySelector("h3") || {}).textContent || "" }));
        const descs = (window.state.dayDescs || []).filter((d) => d.block === "The AI Signal").map((d) => d.episodeId);
        return { cards, descs };
      });
      ok(m.cards.length === 1 && m.cards[0].id === "the-ai-signal" && m.cards[0].title === "The AI Signal"
        && m.cards[0].meta.includes("Not available") && m.cards[0].h === 76
        && JSON.stringify(m.descs) === JSON.stringify(["the-ai-signal"]) && errs.length === 0,
        `H7a missing state: no registration — the episode row stands named-missing ('Not available' folded into its meta), exactly 76px, and NO intention row stands (no track, no pair); the block's descriptors carry the missing episode alone (cards=${JSON.stringify(m.cards)}, descs=${JSON.stringify(m.descs)}, errors=${errs.length})`);
      await ctx.close();
    }

    // ---- H6 + H7 (present half) · the registered instance ---------
    {
      const ctx = await mkCtx(360);
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => (window.state.dayDescs || []).some((d) => d.episodeId === "intro:the-ai-signal"), null, { timeout: 45000 }).catch(() => {});
      await sleep(600);
      await page.evaluate(() => window.openBlockPage("The AI Signal"));
      await sleep(800);
      const read = () => page.evaluate(() => {
        const cards = [...document.querySelectorAll("[data-card]")].map((el) => ({
          id: el.getAttribute("data-card"), h: Math.round(el.getBoundingClientRect().height * 10) / 10,
          title: (el.querySelector("h3") || {}).textContent || "",
        }));
        const it = document.querySelector(".intention-row .intention-text");
        return { cards, itH: it ? Math.round(it.getBoundingClientRect().height) : null, itScroll: it ? it.scrollHeight : null };
      });
      const r360 = await read();
      ok(JSON.stringify(r360.cards.map((c) => c.id)) === JSON.stringify(["intro:the-ai-signal", "the-ai-signal"])
        && r360.cards[0].title === "Prayer Intention: The AI Signal" && r360.cards[1].title === "The AI Signal"
        && r360.cards.every((c) => c.h === 76),
        `H6a pair form @360px: the block page renders [intention row, episode row] in that order; titles exactly "Prayer Intention: The AI Signal" / "The AI Signal"; both rows exactly 76px (cards=${JSON.stringify(r360.cards)})`);
      ok(r360.itH !== null && r360.itH <= 24 && r360.itScroll > r360.itH,
        `H6b clamp: the intention text stands clamped to ONE line at rest (rendered=${r360.itH}px, full=${r360.itScroll}px — the long drawn text overflows, so the ellipsis arms)`);
      await page.setViewportSize({ width: 640, height: 844 });
      await sleep(400);
      const r640 = await read();
      ok(r640.cards.length === 2 && r640.cards.every((c) => c.h === 76),
        `H6c pair form @640px: both rows still exactly 76px (cards=${JSON.stringify(r640.cards)})`);
      await page.setViewportSize({ width: 360, height: 844 });
      await page.evaluate(() => { const b = document.querySelector('.intention-row [data-expand="the-ai-signal"]'); if (b) b.click(); });
      await sleep(500);
      const rExp = await read();
      ok((rExp.cards[0] || {}).h > 76 && (rExp.cards[1] || {}).h === 76,
        `H6d expand: tapping the ellipsis grows ONLY the intention row (to ${(rExp.cards[0] || {}).h}px); the episode row holds exactly 76px`);
      await page.evaluate(() => { const b = document.querySelector('.intention-row [data-expand="the-ai-signal"]'); if (b) b.click(); });
      await sleep(500);
      const rCol = await read();
      ok((rCol.cards[0] || {}).h === 76 && (rCol.cards[1] || {}).h === 76,
        `H6e collapse: the intention row returns to exactly 76px (cards=${JSON.stringify(rCol.cards)})`);
      // pair selection: the intention row's own play button
      await page.evaluate(() => { const b = document.querySelector('[data-playkey="intro:the-ai-signal"]'); if (b) b.click(); });
      await sleep(900);
      const qPair = await page.evaluate(() => (window.state.queue || []).map((d) => d.episodeId));
      ok(JSON.stringify(qPair) === JSON.stringify(["intro:the-ai-signal", "the-ai-signal"]),
        `H6f pair play: the intention row's play button selects the pair, intro first (queue=${JSON.stringify(qPair)})`);
      await page.evaluate(() => { if (window.state) { window.state.queue = []; } const s = document.querySelector("[data-stop], .np-stop"); if (s) s.click(); });
      await sleep(300);
      // block Play All
      await page.evaluate(() => { const b = document.querySelector('[data-queue="The AI Signal"]'); if (b) b.click(); });
      await sleep(900);
      const qAll = await page.evaluate(() => (window.state.queue || []).map((d) => d.episodeId));
      ok(JSON.stringify(qAll) === JSON.stringify(["intro:the-ai-signal", "the-ai-signal"]),
        `H7b Play All: the block's Play All builds exactly [intro, episode] — the block's end is the queue's end (queue=${JSON.stringify(qAll)})`);
      // snapshot round-trip: the standing v355 record carries the pair
      const snap = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("opn-queue-v355") || "null"); } catch (e) { return null; } });
      ok(!!snap && JSON.stringify(snap.ids) === JSON.stringify(["intro:the-ai-signal", "the-ai-signal"]) && snap.date === TODAY,
        `H7c snapshot: the v355 record carries the pair as ordinary descriptors under today's date (snap=${JSON.stringify(snap && snap.ids)})`);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => (window.state.dayDescs || []).some((d) => d.episodeId === "the-ai-signal"), null, { timeout: 45000 }).catch(() => {});
      await sleep(1200);
      const restored = await page.evaluate(() => ({ q: (window.state.queue || []).map((d) => d.episodeId), cur: window.state.current ? window.state.current.episodeId : null, paused: window.state.restoredQueue === true || !!(window.state.current && document.querySelector(".dock, #dock")) }));
      ok(JSON.stringify(restored.q) === JSON.stringify(["intro:the-ai-signal", "the-ai-signal"]) && restored.cur === "intro:the-ai-signal",
        `H7d restore: after reload the queue restores as the pair, standing at its head (queue=${JSON.stringify(restored.q)}, current=${restored.cur})`);
      await page.evaluate(() => { if (window.state) { window.state.queue = []; window.state.current = null; } });
      ok(errs.length === 0, `browser: no page errors across the present-instance legs (errors=${JSON.stringify(errs.slice(0, 3))})`);
      await ctx.close();
    }

    // ---- H7 (played half) · a fresh context, short tone ------------
    await api(BASE, "POST", "/api/agent/player/episode", { token: TOKEN, raw: TONE_3, headers: epHeaders({ "x-duration-s": "3" }) });
    {
      const ctx = await mkCtx(360);
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => (window.state.dayDescs || []).some((d) => d.episodeId === "the-ai-signal" && d.available), null, { timeout: 45000 }).catch(() => {});
      await sleep(500);
      await page.evaluate(() => window.openBlockPage("The AI Signal"));
      await sleep(600);
      await page.evaluate(() => { const b = document.querySelector('[data-playkey="the-ai-signal"]'); if (b) b.click(); });
      let played = null;
      for (let i = 0; i < 24 && !played; i++) {
        await sleep(1000);
        played = await page.evaluate((today) => {
          const m = JSON.parse(localStorage.getItem("opn-played-v344") || "{}");
          return (m["the-ai-signal"] && m["the-ai-signal"][today]) ? m : null;
        }, TODAY).catch(() => null);
      }
      const dot = await page.evaluate(() => { const d = document.querySelector('[data-card="the-ai-signal"] .played-dot'); return d ? d.className : null; });
      ok(!!played && typeof dot === "string" && dot.includes("on"),
        `H7e played state: playing the pair through marks the episode played under the bare id keyed to the PRESENTED day (opn-played-v344['the-ai-signal']['${TODAY}']); the card's played dot stands ON (dot=${JSON.stringify(dot)}, errors=${errs.length})`);
      await ctx.close();
    }
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v368: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
