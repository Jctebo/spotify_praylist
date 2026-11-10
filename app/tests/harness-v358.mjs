#!/usr/bin/env node
// harness-v358 — the v351 gate (Plan §2.9 legs L1-L10): the card
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v358 runs only inside a release worktree"); process.exit(2); }
const PRISTINE_APP = process.env.OPN_PRISTINE_APP || "";
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8993, FEED_PORT = 8953, SITE_PORT = 443, PPORT = 8983;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`, PBASE = `http://127.0.0.1:${PPORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v358");
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
    applyFiles(APP, PERSIST, migFiles(APP), seedSql());
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");
    const swJs = (await api(BASE, "GET", "/sw.js")).text;
    ok(swJs.includes("ora-pro-nobis-v358-1"), "SW pin: the served service worker carries CACHE 'ora-pro-nobis-v351-1'");

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


    // ================= v358 REPRODUCTION LEGS =================
    // Drive REAL track ends: seek to (duration - 0.12) and let the
    // element fire its own 'ended'; record the current sequence.
    const driveEnds = async (maxTracks) => {
      const seenSeq = [];
      let lastCur = null, stallPolls = 0;
      for (let step = 0; step < maxTracks; step++) {
        // wait for a playing current with finite duration
        let ready = false;
        for (let p = 0; p < 120; p++) {
          const st = await ev(() => {
            const a = document.getElementById("audio");
            return { cur: window.state.current ? window.state.current.episodeId : null,
              paused: a.paused, dur: a.duration, rs: a.readyState, ns: a.networkState,
              err: a.error ? a.error.code : null, qlen: window.state.queue.length, idx: window.state.queueIdx };
          });
          if (st.cur !== lastCur) { seenSeq.push(st.cur); lastCur = st.cur; }
          if (st.cur && !st.paused && isFinite(st.dur) && st.dur > 0) { ready = true; break; }
          if (st.cur && st.paused && p > 110) break; // standing paused on a current past the download-wait bound = stall signature
          if (!st.cur && p > 6) break;
          await sleep(250);
        }
        const snap = await ev(() => {
          const a = document.getElementById("audio");
          return { cur: window.state.current ? window.state.current.episodeId : null,
            curKind: window.state.current ? window.state.current.kind : null,
            curUrl: window.state.current ? String(window.state.current.url || "").slice(0, 60) : null,
            curAvail: window.state.current ? window.state.current.available : null,
            paused: a.paused, dur: a.duration, rs: a.readyState, ns: a.networkState,
            err: a.error ? a.error.code : null,
            q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
            ext: Object.fromEntries(Object.entries(window.state.extSlots || {}).map(([k, v]) => [k, v.state])),
            own: Object.fromEntries(Object.entries(window.state.ownSlots || {}).map(([k, v]) => [k, v.state])) };
        });
        if (!ready) return { seq: seenSeq, stall: snap };
        await ev(() => { const a = document.getElementById("audio"); try { a.currentTime = Math.max(0, a.duration - 0.12); } catch (e) {} });
        await sleep(450);
      }
      return { seq: seenSeq, stall: null };
    };
    const dbg = await ev(() => ({ descs: (window.state.dayDescs || []).length, payload: !!window.state.dayPayload, tab: window.state.tab, bodyHasPlayAll: !!document.getElementById("play-all"), cards: document.querySelectorAll("[data-card]").length, extKeys: Object.keys(window.state.extSlots || {}).length, ownKeys: Object.keys(window.state.ownSlots || {}).length }));
    console.log("DBG:", JSON.stringify(dbg));
    // ---- R1 · Play All (whole day): advance across pair boundaries ----
    await clearPlayed(); await stopQ();
    await ev(() => { const b = document.getElementById("play-all"); if (b) b.click(); return !!b; });
    await sleep(600);
    const r1 = await driveEnds(8);
    console.log("R1 seq:", JSON.stringify(r1.seq));
    if (r1.stall) console.log("R1 stall:", JSON.stringify(r1.stall));
    ok(!r1.stall && r1.seq.length >= 5, `R1 Play All advances across >=2 pair boundaries (seq=${JSON.stringify(r1.seq)}, stall=${JSON.stringify(r1.stall && { cur: r1.stall.cur, paused: r1.stall.paused, rs: r1.stall.rs, ns: r1.stall.ns, err: r1.stall.err, idx: r1.stall.idx, qlen: r1.stall.q.length })})`);

    // ---- R2' · REPRO: Morning block play tapped while the rosary
    // download is still in flight — the queue snapshots the raw
    // enclosure URL for the rosary pair; advance must still play it.
    await clearPlayed(); await stopQ();
    const t2 = await ev(() => {
      const b = document.querySelector('[data-queue="Morning"]');
      if (!b) return "no-btn";
      b.click(); return "ok";
    });
    await sleep(600);
    const r2 = await driveEnds(10);
    console.log("R2' blockplay:", t2, "seq:", JSON.stringify(r2.seq));
    if (r2.stall) console.log("R2' stall:", JSON.stringify(r2.stall));
    ok(!r2.stall && r2.seq.includes("daily-rosary"), `R2' advance reaches the rosary pair whose download was in flight at queue build (seq=${JSON.stringify(r2.seq)}, stall=${JSON.stringify(r2.stall && { cur: r2.stall.cur, paused: r2.stall.paused, rs: r2.stall.rs, ns: r2.stall.ns, err: r2.stall.err, idx: r2.stall.idx, qlen: r2.stall.q.length })})`);

    // ================= v358 FEATURE GATE LEGS =================
    const autoState = () => ev(() => ({ on: window.autoplayOn(), stored: localStorage.getItem("opn-autoplay-v358"),
      dock: (document.getElementById("dock-autoplay") || {}).textContent || null }));

    // ---- A1 · default ON on a fresh store ----
    const a1 = await autoState();
    ok(a1.on === true, `A1 autoplay reads ON (stored=${JSON.stringify(a1.stored)}, dock=${JSON.stringify(a1.dock)})`);

    // ---- A2 · autoplay ON: a block queue chains into the next block ----
    await clearPlayed(); await stopQ();
    await ev(() => { localStorage.removeItem("opn-autoplay-v358"); });
    const tA2 = await ev(() => { const b = document.querySelector('[data-queue="Morning"]'); if (!b) return "no-btn"; b.click(); return "ok"; });
    await sleep(600);
    const rA2 = await driveEnds(14);
    console.log("A2 seq:", JSON.stringify(rA2.seq));
    ok(tA2 === "ok" && rA2.seq.some((x) => x === "ext-gospel-exegesis" || x === "intro:ext-gospel-exegesis"),
      `A2 block queue chains past the block end into Midmorning (seq=${JSON.stringify(rA2.seq)})`);
    await stopQ();

    // ---- A3 · toggle OFF (dock) restores the block-end stop ----
    const tA3a = await ev(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "daily-reflection");
      if (!d) return "no-desc"; window.playTrack(d); return "ok";
    });
    await sleep(500);
    const tA3b = await ev(() => { const b = document.getElementById("dock-autoplay"); if (!b) return "no-btn"; b.click(); return "ok"; });
    const a3 = await autoState();
    ok(tA3a === "ok" && tA3b === "ok" && a3.on === false && a3.stored === "off" && /Off/.test(a3.dock || ""),
      `A3 dock toggle turns autoplay OFF and the label follows (on=${a3.on}, stored=${JSON.stringify(a3.stored)}, dock=${JSON.stringify(a3.dock)})`);
    await clearPlayed(); await stopQ();
    const tA3c = await ev(() => { const b = document.querySelector('[data-queue="Morning"]'); if (!b) return "no-btn"; b.click(); return "ok"; });
    await sleep(600);
    const rA3 = await driveEnds(13);
    console.log("A3 seq:", JSON.stringify(rA3.seq), "stop:", JSON.stringify(rA3.stall && { cur: rA3.stall.cur, qlen: rA3.stall.q.length }));
    ok(tA3c === "ok" && !rA3.seq.some((x) => x === "ext-gospel-exegesis" || x === "intro:ext-gospel-exegesis")
      && !!rA3.stall && rA3.stall.cur === null && rA3.stall.q.length === 0,
      `A3 with autoplay OFF the block queue stops at the block end (seq=${JSON.stringify(rA3.seq)})`);

    // ---- A4 · the OFF state persists across a reload; Settings flips it back ----
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (window.state.dayDescs || []).length > 10, null, { timeout: 45000 }).catch(() => {});
    await sleep(800);
    const a4 = await autoState();
    ok(a4.on === false, `A4 autoplay OFF persists across reload (on=${a4.on})`);
    const tA4 = await ev(() => { window.renderSettings(); return "ok"; });
    await sleep(1200);
    const tA4b = await ev(() => { const b = document.getElementById("set-autoplay"); if (!b) return "no-btn"; b.click(); return "ok"; });
    const a4b = await autoState();
    ok(tA4 === "ok" && tA4b === "ok" && a4b.on === true && a4b.stored === "on",
      `A4 Settings toggle turns autoplay back ON (on=${a4b.on}, stored=${JSON.stringify(a4b.stored)})`);
    await ev(() => window.setTab("prayers")); await sleep(800);

    // ---- A5 · single play chains; Now Playing carries the toggle ----
    await clearPlayed(); await stopQ();
    await page.waitForFunction(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "ext-office-of-readings");
      return !!d && d.available;
    }, null, { timeout: 45000 }).catch(() => {});
    const tA5 = await ev(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "ext-office-of-readings");
      if (!d) return "no-desc"; window.playTrack(d); window.__tA5 = "played"; return "ok";
    });
    await sleep(600);
    const dbgA5 = await ev(() => { const d = (window.state.dayDescs || []).find((x) => x.episodeId === "auxilium-christianorum"); const a = document.getElementById("audio");
      return { tA5: window.__tA5, avail: d ? d.available : null, url: d ? String(d.url || "").slice(0, 40) : null, cur: window.state.current ? window.state.current.episodeId : null, paused: a.paused, err: a.error ? a.error.code : null }; });
    console.log("A5 dbg:", JSON.stringify(dbgA5));
    const npHas = await ev(() => { window.openNowPlaying(); const b = document.getElementById("np-autoplay"); return b ? b.textContent : null; });
    const rA5 = await driveEnds(3);
    console.log("A5 seq:", JSON.stringify(rA5.seq), "np toggle:", JSON.stringify(npHas));
    const postA5 = await ev(() => { const a = document.getElementById("audio");
      return { cur: window.state.current ? window.state.current.episodeId : null, paused: a.paused, err: a.error ? a.error.code : null,
        q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
        played: localStorage.getItem("opn-played-v344") }; });
    console.log("A5 post:", JSON.stringify(postA5));
    const postA5b = await ev(() => { const d = (window.state.dayDescs || []).find((x) => x.episodeId === "auxilium-christianorum");
      const st = window.state.ownSlots["auxilium-christianorum"];
      return { freshUrl: d ? String(d.url || "").slice(0, 40) : null,
        slotState: st ? st.state : null, slotUrl: st && st.tracks && st.tracks[0] ? String(st.tracks[0].streamUrl || "").slice(0, 40) : null,
        dlKeys: Object.keys(window.state.ownAudioDl || {}), errWait: [window.state.errWaitKey, window.state.errWaitN] }; });
    console.log("A5 post2:", JSON.stringify(postA5b));
    ok(tA5 === "ok" && !!npHas && /On/.test(npHas) && rA5.seq.some((x) => x === "marian-antiphon-angelus" || x === "intro:marian-antiphon-angelus"),
      `A5 single play (Office of Readings) chains into the Evening Antiphon pair and Now Playing carries the toggle (seq=${JSON.stringify(rA5.seq)}, np=${JSON.stringify(npHas)})`);
    await stopQ();

    ok(pageErrors.length === 0, `browser: no page errors across the v351 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v358: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
