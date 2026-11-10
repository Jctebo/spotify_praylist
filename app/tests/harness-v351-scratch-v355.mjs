#!/usr/bin/env node
// harness-v351 — the v351 gate (Plan §2.9 legs L1-L10): the card
// tap auto-queues the tapped block's unplayed remainder behind
// the tapped pair (intention intro first); the same-unit pause
// survives at pair granularity; a different-prayer tap replaces;
// the unblocked podcast group and the Read sheet keep playTrack;
// the standing seams (Play All, block play, queue-row jump,
// Continue + preview, the v346 resume seam) stand untouched.
// Fixture posture: the standing estate mold (v344/v347/v348) —
// local feed + HTTPS site servers, the presented day built by the
// shipped client from fixture feeds; two app instances (candidate
// + optional pristine via OPN_PRISTINE_APP) for the settings
// comparison. Scratch wrangler instances INSIDE the worktrees,
// synthetic fixture only, tallies read from the COMPLETE log.
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v351 runs only inside a release worktree"); process.exit(2); }
const PRISTINE_APP = process.env.OPN_PRISTINE_APP || "";
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8996, FEED_PORT = 8956, SITE_PORT = 443, PPORT = 8986;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`, PBASE = `http://127.0.0.1:${PPORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v351");
const PPERSIST = "";
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v351-"));
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
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v351-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    // ============ candidate app (v349 boot order: items seed ====
    // after migrations <= 0012, migration 0013 applies last) =====
    // SCRATCH (v355 regression run): the fixture-cap raise per the
    // v352 §4 lesson — the stock harness caps migrations at 0013,
    // which starves the v352 prayer_liturgical_days query; this
    // copy applies the FULL sequence through 0015.
    applyFiles(APP, PERSIST, migFiles(APP), seedSql());
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");
    const swJs = (await api(BASE, "GET", "/sw.js")).text;
    ok(swJs.includes("ora-pro-nobis-v351-1"), "SW pin: the served service worker carries CACHE 'ora-pro-nobis-v351-1'");

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
    // Fixture augmentation (§2.7's boundary needs a block-'' card):
    // the shell payload gains ONE unblocked podcast episode. Since
    // v342 the payload carries no episodes in production, so the
    // group renders only when the field stands — the fixture
    // stands it, and the boundary code path is exercised for real.
    await ctx.route(BASE + "/api/player/day", async (route) => {
      const resp = await route.fetch();
      const json = await resp.json();
      json.episodes = [{ episodeId: "podcast-ep-1", title: "Fixture Podcast Episode", available: true, streamUrl: `${FEED}/audio/x-daily-rosary-x.mp3`, durationS: 30, kind: "episode" }];
      await route.fulfill({ response: resp, json });
    });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const ds = (window.state && window.state.dayDescs) || [];
      const need = ["daily-rosary", "morning-prayer", "novena-st-anne", "novena-st-rita", "auxilium-christianorum", "ext-invitatory", "podcast-ep-1"];
      return need.every((id) => ds.some((x) => x.episodeId === id && x.available))
        && ds.some((x) => x.episodeId === "intro:daily-rosary");
    }, null, { timeout: 45000 }).catch(() => {});
    await sleep(800);

    const ev = (fn, arg) => page.evaluate(fn, arg);
    const q = () => ev(() => ({
      q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
      cur: window.state.current ? window.state.current.episodeId : null,
      paused: document.getElementById("audio").paused,
    }));
    const expectedFor = (id) => ev((x) => (typeof window.sectionQueueFrom === "function")
      ? window.sectionQueueFrom(window.extRebuildDescs(window.state.dayPayload), x).map((d) => d.episodeId) : null, id);
    const seedPlayed = (ids) => ev((list) => {
      const map = {}; const t = window.state.presentedDay;
      list.forEach((id) => { map[id] = { [t]: { playedAt: new Date().toISOString(), via: "played" } }; });
      localStorage.setItem("opn-played-v344", JSON.stringify(map));
      window.state.playedCache = null;
    }, ids);
    const clearPlayed = () => ev(() => { localStorage.removeItem("opn-played-v344"); window.state.playedCache = null; });
    const stopQ = () => ev(() => {
      const a = document.getElementById("audio"); if (a) a.pause();
      window.state.queue = []; window.state.queueIdx = -1;
      document.querySelectorAll(".np-sheet, .readsheet").forEach((s) => s.remove());
    });
    const tapBtn = (cardId, key) => ev(({ c, k }) => {
      const card = document.querySelector('[data-card="' + c + '"]');
      if (!card) return "no-card";
      const btn = card.querySelector('[data-playkey="' + k + '"]');
      if (!btn) return "no-btn";
      btn.click(); return "ok";
    }, { c: cardId, k: key || cardId });
    const blockOf = () => ev(() => { const m = {}; (window.state.dayDescs || []).forEach((d) => { (m[d.block] = m[d.block] || new Set()).add(d.episodeId); }); const o = {}; Object.keys(m).forEach((k) => { o[k] = [...m[k]]; }); return o; });
    const rows = () => ev(() => Array.from(document.querySelectorAll(".npq-row")).map((r) => r.getAttribute("data-npq-id")));
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // ---- L1 · mid-block tap builds [pair, ...unplayed rest] -----
    await clearPlayed(); await stopQ();
    const t1 = await tapBtn("daily-rosary");
    await sleep(500);
    const s1 = await q(); const e1 = await expectedFor("daily-rosary"); const b1 = await blockOf();
    await ev(() => window.openNowPlaying());
    await sleep(200);
    const r1 = await rows();
    ok(t1 === "ok" && !!e1 && eq(s1.q, e1) && s1.q[0] === "intro:daily-rosary" && s1.q[1] === "daily-rosary"
      && s1.q.every((id) => (b1.Morning || []).includes(id)) && eq(r1, s1.q)
      && (s1.cur === "intro:daily-rosary" || s1.cur === "daily-rosary") && s1.paused === false,
      `L1 card tap mid-block: queue = [intro, prayer, ...the block's unplayed remainder in order], every entry Morning, the Now Playing list renders the same array, playback stands at the pair (tap=${t1}, q=${JSON.stringify(s1.q)}, rows=${JSON.stringify(r1)}, cur=${s1.cur}, paused=${s1.paused})`);

    // ---- L2 · played later prayers + their intros excluded ------
    await seedPlayed(["ext-bible-in-a-year", "marian-antiphon-angelus"]); await stopQ();
    const t2 = await tapBtn("morning-prayer");
    await sleep(500);
    const s2 = await q(); const e2 = await expectedFor("morning-prayer");
    ok(t2 === "ok" && !!e2 && eq(s2.q, e2) && s2.q[0] === "intro:morning-prayer" && s2.q[1] === "morning-prayer"
      && !s2.q.includes("ext-bible-in-a-year") && !s2.q.includes("intro:ext-bible-in-a-year")
      && !s2.q.includes("marian-antiphon-angelus") && !s2.q.includes("intro:marian-antiphon-angelus")
      && s2.q.includes("daily-rosary") && s2.q.includes("intro:daily-rosary"),
      `L2 filter: two later prayers marked played are absent from the tail AND their intros are absent with them; the unplayed rosary pair between them stands (tap=${t2}, q=${JSON.stringify(s2.q)})`);

    // ---- L3 · the tapped prayer itself played still heads -------
    await seedPlayed(["daily-rosary"]); await stopQ();
    const t3 = await tapBtn("daily-rosary");
    await sleep(500);
    const s3 = await q(); const e3 = await expectedFor("daily-rosary");
    ok(t3 === "ok" && !!e3 && eq(s3.q, e3) && s3.q[0] === "intro:daily-rosary" && s3.q[1] === "daily-rosary"
      && (s3.cur === "intro:daily-rosary" || s3.cur === "daily-rosary") && s3.paused === false,
      `L3 head unfiltered: the tapped prayer stands played in the store and still heads the queue with its intro, and plays (tap=${t3}, q=${JSON.stringify(s3.q)}, cur=${s3.cur})`);

    // ---- L4 · all-played remainder: the unit alone, then stop ---
    const morningOthers = await ev(() => [...new Set((window.state.dayDescs || [])
      .filter((d) => d.block === "Morning" && d.kind !== "intention" && d.episodeId !== "ext-invitatory")
      .map((d) => d.episodeId))]);
    await seedPlayed(morningOthers); await stopQ();
    const t4 = await tapBtn("ext-invitatory");
    await sleep(500);
    const s4 = await q(); const e4 = await expectedFor("ext-invitatory");
    ok(t4 === "ok" && !!e4 && eq(s4.q, e4) && eq(s4.q, ["intro:ext-invitatory", "ext-invitatory"]),
      `L4a no fallback: every later Morning prayer played — the tap builds the tapped unit ALONE, no full-block replay (tap=${t4}, q=${JSON.stringify(s4.q)}, seeded=${JSON.stringify(morningOthers)})`);
    await sleep(4000);
    const s4b = await q();
    ok(s4b.q.length === 0 && s4b.cur === null,
      `L4b stop at block end: the lone unit ends and playback stops — queue empty, no current, nothing chains onward (q=${JSON.stringify(s4b.q)}, cur=${s4b.cur})`);

    // ---- L5 · a different block's tap replaces the playing queue
    await clearPlayed(); await stopQ();
    await ev(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "auxilium-christianorum");
      window.startQueue([d]);
    });
    await sleep(600);
    const s5pre = await q();
    const t5 = await tapBtn("daily-rosary");
    await sleep(500);
    const s5 = await q(); const e5 = await expectedFor("daily-rosary");
    ok(s5pre.cur === "auxilium-christianorum" && s5pre.paused === false && t5 === "ok" && !!e5 && eq(s5.q, e5)
      && (s5.cur === "intro:daily-rosary" || s5.cur === "daily-rosary") && s5.paused === false && !s5.q.includes("auxilium-christianorum"),
      `L5 replace (decision 3): with the Afternoon queue playing, a Morning card tap replaces it — the tapped unit starts, NOT left paused, the old queue gone (pre cur=${s5pre.cur}, tap=${t5}, q=${JSON.stringify(s5.q)}, cur=${s5.cur}, paused=${s5.paused})`);

    // ---- L6 · the same-unit pause survives, at pair granularity -
    const s6pre = await q();
    const t6a = await tapBtn("daily-rosary");
    await sleep(300);
    const s6a = await q();
    const ct1 = await ev(() => document.getElementById("audio").currentTime);
    await sleep(400);
    const ct2 = await ev(() => document.getElementById("audio").currentTime);
    ok(t6a === "ok" && s6a.paused === true && eq(s6a.q, s6pre.q) && s6a.cur === s6pre.cur && Math.abs(ct2 - ct1) < 0.05,
      `L6a own-card pause: tapping the playing prayer's own card pauses (position frozen at ${ct1.toFixed(2)}s across 400 ms — a restart would advance it), queue and current untouched (tap=${t6a}, paused=${s6a.paused}, cur=${s6a.cur})`);
    await ev(() => document.getElementById("dock-play").click());
    await sleep(300);
    const s6r = await q();
    const t6b = await (async () => {
      // wait until the prayer itself (not its intro) is current
      for (let i = 0; i < 40; i++) { const s = await q(); if (s.cur === "daily-rosary") break; await sleep(100); }
      return tapBtn("daily-rosary", "intro:daily-rosary");
    })();
    await sleep(300);
    const s6b = await q();
    ok(s6r.paused === false && eq(s6r.q, s6pre.q) && t6b === "ok" && s6b.paused === true && eq(s6b.q, s6pre.q) && s6b.cur === "daily-rosary",
      `L6b panel pause + dock resume: the dock resumes the paused queue intact; while the PRAYER plays, the panel button (intro key) pauses the same unit (resumed paused=${s6r.paused}, panel tap=${t6b}, paused=${s6b.paused}, cur=${s6b.cur})`);
    await stopQ();
    const s6c = await ev(() => new Promise((resolve) => {
      const card = document.querySelector('[data-card="morning-prayer"]');
      const btn = card && card.querySelector('[data-playkey="morning-prayer"]');
      if (!btn) return resolve({ err: "no-btn" });
      btn.click();
      const t0 = Date.now();
      const iv = setInterval(() => {
        const cur = window.state.current && window.state.current.episodeId;
        if (cur === "intro:morning-prayer") {
          clearInterval(iv);
          btn.click();
          setTimeout(() => resolve({ cur: window.state.current && window.state.current.episodeId, paused: document.getElementById("audio").paused, q: window.state.queue.map((d) => d.episodeId) }), 250);
        } else if (Date.now() - t0 > 2500) { clearInterval(iv); resolve({ err: "intro-window-missed", cur }); }
      }, 25);
    }));
    const e6c = await expectedFor("morning-prayer");
    ok(!s6c.err && s6c.paused === true && s6c.cur === "intro:morning-prayer" && !!e6c && eq(s6c.q, e6c),
      `L6c intro-window pause: while the INTRO plays, the prayer card tap pauses the same unit — the intro stands current, paused, queue the unit's build (res=${JSON.stringify(s6c)})`);

    // ---- L7 · the panel button builds what the card tap builds --
    await clearPlayed(); await stopQ();
    const t7a = await tapBtn("auxilium-christianorum");
    await sleep(400);
    const s7a = await q();
    await stopQ();
    const t7b = await tapBtn("auxilium-christianorum", "intro:auxilium-christianorum");
    await sleep(400);
    const s7b = await q(); const e7 = await expectedFor("auxilium-christianorum");
    ok(t7a === "ok" && t7b === "ok" && !!e7 && eq(s7a.q, e7) && eq(s7b.q, e7)
      && s7b.q[0] === "intro:auxilium-christianorum" && s7b.q[1] === "auxilium-christianorum",
      `L7 panel = card (decision 5): the intention panel's small play button builds the identical queue to the card tap — pair first, remainder behind (card q=${JSON.stringify(s7a.q)}, panel q=${JSON.stringify(s7b.q)})`);

    // ---- L8 · the Novenas block: same rule, same played store ---
    await seedPlayed(["novena-st-jude", "novena-st-rita"]); await stopQ();
    const t8 = await tapBtn("novena-st-anne");
    await sleep(400);
    const s8 = await q(); const e8 = await expectedFor("novena-st-anne"); const b8 = await blockOf();
    ok(t8 === "ok" && !!e8 && eq(s8.q, e8) && eq(s8.q, ["intro:novena-st-anne", "novena-st-anne"])
      && s8.q.every((id) => (b8.Novenas || []).includes(id)),
      `L8 Novenas: a mid-block novena tap queues the Novenas remainder only — the earlier played novena is not queued, the later PLAYED novena is skipped by the same isPlayed store, no Midmorning entry stands (tap=${t8}, q=${JSON.stringify(s8.q)})`);

    // ---- L9 · boundaries -----------------------------------------
    await clearPlayed(); await stopQ();
    const t9a = await tapBtn("podcast-ep-1");
    await sleep(400);
    const s9a = await q();
    ok(t9a === "ok" && s9a.q.length === 0 && s9a.cur === "podcast-ep-1" && s9a.paused === false,
      `L9a podcast boundary: the unblocked (block '') card plays SINGLE — no queue builds (tap=${t9a}, q=${JSON.stringify(s9a.q)}, cur=${s9a.cur}, paused=${s9a.paused})`);
    await stopQ();
    const t9b = await ev(() => {
      const b = document.querySelector('[data-read="morning-prayer"]');
      if (!b) return "no-btn"; b.click(); return "ok";
    });
    await sleep(500);
    const sheet9 = await ev(() => !!document.querySelector(".readsheet"));
    const t9c = await ev(() => {
      const b = document.querySelector('.readsheet [data-playkey="morning-prayer"]');
      if (!b) return "no-btn"; b.click(); return "ok";
    });
    await sleep(400);
    const s9b = await q();
    ok(t9b === "ok" && sheet9 && t9c === "ok" && s9b.q.length === 0 && s9b.cur === "morning-prayer",
      `L9b Read boundary: the Read sheet's own play button still single-plays through playTrack — no queue builds (open=${t9b}, sheet=${sheet9}, play=${t9c}, q=${JSON.stringify(s9b.q)}, cur=${s9b.cur})`);
    await stopQ();
    const miss = await ev(() => {
      const d = (window.state.dayDescs || []).find((x) => !x.available);
      if (!d) return null;
      const before = { q: window.state.queue.map((y) => y.episodeId), cur: window.state.current ? window.state.current.episodeId : null };
      // The guard under test is tapPlay's own early return (§2.1(2)).
      // On the pristine tree the dispatch does not exist — nothing
      // is called and the state comparison is the whole evidence.
      const absent = typeof window.tapPlay !== "function";
      if (!absent) window.tapPlay(d);
      const after = { q: window.state.queue.map((y) => y.episodeId), cur: window.state.current ? window.state.current.episodeId : null };
      return { id: d.episodeId, same: JSON.stringify(before) === JSON.stringify(after), absent };
    });
    ok(!!miss && miss.same === true,
      `L9c unavailable guard: a tap resolved to an unavailable prayer (${miss && miss.id}) no-ops — queue and current stand exactly as before (found=${JSON.stringify(miss)})`);

    // ---- L10 · untouched pins ------------------------------------
    await clearPlayed(); await stopQ();
    await ev(() => { try { localStorage.removeItem("opn-resume-v312"); } catch (e) {} });
    await ev(() => document.getElementById("play-all").click());
    await sleep(500);
    const s10a = await q();
    const fullDay = await ev(() => window.extRebuildDescs(window.state.dayPayload).map((d) => d.episodeId));
    await ev(() => document.getElementById("play-all").click());
    await sleep(300);
    const s10a2 = await q();
    ok(eq(s10a.q, fullDay) && s10a.paused === false && s10a2.paused === true && eq(s10a2.q, fullDay),
      `L10a Play All pin: builds the whole-day list and its mid-playback tap still pause-toggles with the queue untouched (n=${s10a.q.length}, paused after 2nd tap=${s10a2.paused})`);
    await stopQ();
    await ev(() => document.querySelector('[data-queue="Morning"]').click());
    await sleep(500);
    const s10b = await q();
    const expBlock = await ev(() => window.queueBuild(window.extRebuildDescs(window.state.dayPayload).filter((d) => d.block === "Morning")).map((d) => d.episodeId));
    await ev(() => document.querySelector('[data-queue="Morning"]').click());
    await sleep(300);
    const s10b2 = await q();
    ok(eq(s10b.q, expBlock) && s10b.paused === false && s10b2.paused === true && eq(s10b2.q, expBlock),
      `L10b block play pin: the Morning block button still builds queueBuild's block list and pause-toggles on the second tap (q=${JSON.stringify(s10b.q)})`);
    await ev(() => window.openNowPlaying());
    await sleep(200);
    const refBefore = await ev(() => { window.__q351 = window.state.queue; return true; });
    await ev(() => { const r = document.querySelector('[data-npq-index="1"]'); if (r) r.click(); });
    await sleep(400);
    const s10c = await q();
    const refSame = await ev(() => window.state.queue === window.__q351);
    ok(refBefore && refSame && s10c.idx === 1 && eq(s10c.q, expBlock),
      `L10c jump pin: a Now Playing queue-row tap jumps (idx=${s10c.idx}) without rebuilding — the queue array is the identical object (same=${refSame})`);
    await stopQ();
    await seedPlayed(["morning-prayer", "daily-rosary"]);
    const expCont = await ev(() => { window.paintContinue(); return window.buildContinueQueue().build.map((d) => d.episodeId); });
    const contCard = await ev(() => !!document.getElementById("continue-btn") && !!document.getElementById("continue-queue"));
    await ev(() => document.getElementById("continue-queue").click());
    await sleep(300);
    const prevRows = await rows();
    const prevIdle = await q();
    const tapIdx = Math.min(1, prevRows.length - 1);
    await ev((i) => { const r = document.querySelector('[data-npq-index="' + i + '"]'); if (r) r.click(); }, tapIdx);
    await sleep(400);
    const s10d = await q();
    ok(contCard && eq(prevRows, expCont) && prevIdle.q.length === 0 && eq(s10d.q, expCont.slice(tapIdx)) && s10d.paused === false,
      `L10d Continue + preview pin: the card stands with its See queue door; the preview lists buildContinueQueue's build and starts nothing; tapping preview row ${tapIdx} starts the build sliced there (preview=${JSON.stringify(prevRows)}, started=${JSON.stringify(s10d.q)})`);
    await stopQ();
    await sleep(250);
    // The standing Continue handler carries a live resume record
    // (start AT the resume track, its intro dropped) — L10d's own
    // playback wrote one. Clear it and repaint so the button's
    // whole-build path is the behavior under test.
    const expCont2 = await ev(() => {
      try { localStorage.removeItem("opn-resume-v312"); } catch (e) {}
      window.paintContinue();
      return window.buildContinueQueue().build.map((d) => d.episodeId);
    });
    await ev(() => document.getElementById("continue-btn").click());
    await sleep(400);
    const s10d2 = await q();
    ok(eq(s10d2.q, expCont2),
      `L10d2 Continue pin: with no resume record standing, the Continue button starts buildContinueQueue's build whole (q=${JSON.stringify(s10d2.q)})`);
    await ev(() => document.getElementById("audio").pause());
    await sleep(200);
    const s10ePre = await q();
    await ev(() => window.__opnMediaHandlers.play());
    await sleep(400);
    const s10e = await q();
    ok(s10ePre.paused === true && s10e.paused === false && eq(s10e.q, expCont2) && s10e.cur === s10ePre.cur,
      `L10e media pin (v346 seam): with a queue standing paused, the media-session play handler resumes through resumeCurrent — queue and current intact (cur=${s10e.cur}, paused=${s10e.paused})`);

    ok(pageErrors.length === 0, `browser: no page errors across the v351 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v351: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
