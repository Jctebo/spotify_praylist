#!/usr/bin/env node
// harness-v352 — the v352 gate (Plan §2.9 legs L1-L11): the
// liturgical foundation — migration 0015's prayer_liturgical_days
// table, the door route POST /api/agent/prayer/liturgical-day,
// the liturgicalDay field on both day payloads (each keyed to its
// own date), the brand-bar .litday line + data-lit theme attribute,
// and the --accent/--bar-* token layer with the five color
// treatments. The official-day pin is proven app-side: a private-
// fallback addendum never enters the liturgical record.
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

const APP = process.env.OPN_APP ? path.resolve(process.env.OPN_APP) : path.dirname(fileURLToPath(import.meta.url)) + "/..";
const FORK = path.resolve(APP, "..");
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v352 runs only inside a release worktree"); process.exit(2); }
const PRISTINE_APP = process.env.OPN_PRISTINE_APP || "";
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997, FEED_PORT = 8957, SITE_PORT = 443, PPORT = 8986;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`, PBASE = `http://127.0.0.1:${PPORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v352");
const PPERSIST = "";
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v352-"));
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
  const feedServer2 = feedServer;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v352-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer2.listen(FEED_PORT, r));
    await startSite();

    // ============ candidate app: migrations <=0012 + seed, then
    // 0013 (the novenas move needs the seeded items), then 0015 ==
    const mig13 = migFiles(APP).find((f) => path.basename(f).startsWith("0013"));
    const mig15 = migFiles(APP).find((f) => path.basename(f).startsWith("0015"));
    applyFiles(APP, PERSIST, migFiles(APP, "0012_mass_homilies_block.sql"), seedSql());
    if (mig13) applySql(APP, PERSIST, fs.readFileSync(mig13, "utf8"));
    if (mig15) applySql(APP, PERSIST, fs.readFileSync(mig15, "utf8"));
    ok(!!mig15, "fixture: migration 0015 stands in the tree and applies to the test D1");
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");
    if (!process.env.OPN_APP) {
      const swJs = (await api(BASE, "GET", "/sw.js")).text;
      ok(swJs.includes("ora-pro-nobis-v352-1"), "SW pin: the served service worker carries CACHE 'ora-pro-nobis-v352-1'");
    }

    const lit = (date, dayName, color, token = TOKEN) =>
      api(BASE, "POST", "/api/agent/prayer/liturgical-day", { token, json: { date, dayName, color } });
    const litRows = () => { try { return d1Query(APP, PERSIST, "SELECT date, day_name, color FROM prayer_liturgical_days ORDER BY date"); } catch { return []; } };
    const delLit = (date) => { try { applySql(APP, PERSIST, `DELETE FROM prayer_liturgical_days WHERE date='${date}';`); } catch { /* table absent (pristine) — nothing to delete */ } };

    // ---- L1 · the route -----------------------------------------
    let r = await lit(TODAY, "Memorial of Saint Fixture", "white");
    ok(r.status === 200 && r.body && r.body.ok === true && r.body.date === TODAY,
      `L1 route: a valid POST returns 200 {ok, date} (status=${r.status})`);
    let rows = litRows().filter((x) => x.date === TODAY);
    ok(rows.length === 1 && rows[0].day_name === "Memorial of Saint Fixture" && rows[0].color === "white",
      `L1 store: the row stands in prayer_liturgical_days (rows=${JSON.stringify(rows)})`);
    r = await lit(TODAY, "Feast of Saint Fixture", "red");
    rows = litRows().filter((x) => x.date === TODAY);
    ok(r.status === 200 && rows.length === 1 && rows[0].day_name === "Feast of Saint Fixture" && rows[0].color === "red",
      `L1 upsert: a second POST for the same date overwrites name + color (rows=${JSON.stringify(rows)})`);
    r = await lit(TODAY, "Fixture", "blue");
    ok(r.status === 400, `L1 validation: color 'blue' refused 400 (status=${r.status})`);
    r = await api(BASE, "POST", "/api/agent/prayer/liturgical-day", { token: TOKEN, json: { date: "10/11/2026", dayName: "Fixture", color: "red" } });
    ok(r.status === 400, `L1 validation: a non-ISO date refused 400 (status=${r.status})`);
    r = await lit(TODAY, "", "red");
    ok(r.status === 400, `L1 validation: an empty dayName refused 400 (status=${r.status})`);
    r = await lit(TODAY, "   ", "red");
    ok(r.status === 400, `L1 validation: a whitespace-only dayName refused 400 after trim (status=${r.status})`);
    r = await lit(TODAY, "x".repeat(161), "red");
    ok(r.status === 400, `L1 validation: a dayName over 160 chars refused 400 (status=${r.status})`);
    r = await lit(TODAY, "x".repeat(160), "red");
    ok(r.status === 200, `L1 validation: a dayName of exactly 160 chars stands (status=${r.status})`);
    r = await api(BASE, "POST", "/api/agent/prayer/liturgical-day", { json: { date: TODAY, dayName: "Fixture", color: "red" } });
    ok(r.status === 403, `L1 door: no agent token → 403 (status=${r.status})`);

    // ---- L2 · the payloads ---------------------------------------
    await lit(TODAY, "Memorial of Saint Fixture", "white");
    const pd1 = await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN });
    ok(pd1.body && JSON.stringify(pd1.body.liturgicalDay) === JSON.stringify({ name: "Memorial of Saint Fixture", color: "white" }),
      `L2 player payload: liturgicalDay stands exactly as pushed (got=${JSON.stringify(pd1.body && pd1.body.liturgicalDay)})`);
    const pr1 = await api(BASE, "GET", `/api/prayer/day?date=${TODAY}`);
    ok(pr1.body && JSON.stringify(pr1.body.liturgicalDay) === JSON.stringify({ name: "Memorial of Saint Fixture", color: "white" }),
      `L2 prayer payload: liturgicalDay stands exactly as pushed (got=${JSON.stringify(pr1.body && pr1.body.liturgicalDay)})`);
    delLit(TODAY);
    await lit(TOMORROW, "Memorial of Tomorrow Fixture", "violet");
    const pd2 = await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN });
    const pr2 = await api(BASE, "GET", `/api/prayer/day?date=${TODAY}`);
    ok(pd2.body && pd2.body.liturgicalDay === null && pr2.body && pr2.body.liturgicalDay === null,
      `L2 same-day pin: a record standing ONLY for tomorrow reads null on both of today's payloads — no leak across dates`);
    const pr3 = await api(BASE, "GET", `/api/prayer/day?date=${TOMORROW}`);
    ok(pr3.body && pr3.body.liturgicalDay && pr3.body.liturgicalDay.name === "Memorial of Tomorrow Fixture" && pr3.body.liturgicalDay.color === "violet",
      `L2 own-date keying: the prayer payload for tomorrow carries tomorrow's own record`);

    // ---- L3 · official-day independence (API half) ---------------
    const FERIAL = "Fixtureday of the 99th Week in Ordinary Time";
    const add = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY, addendum: "St. Private Fixture pray for us" } });
    await lit(TODAY, FERIAL, "green");
    const pr4 = await api(BASE, "GET", `/api/prayer/day?date=${TODAY}`);
    ok(add.status === 200 && pr4.body && pr4.body.addendum === "St. Private Fixture pray for us"
      && pr4.body.liturgicalDay && pr4.body.liturgicalDay.name === FERIAL && pr4.body.liturgicalDay.color === "green",
      `L3 independence: one payload carries the private-fallback addendum AND the ferial liturgical name side by side — neither derives from the other in the app`);

    // ---- L10 · payload hygiene (API half) -------------------------
    const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.liturgicalDay; return c; };
    const pdWith = (await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN })).body;
    const prWith = (await api(BASE, "GET", `/api/prayer/day?date=${TODAY}`)).body;
    delLit(TODAY);
    const pdWithout = (await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN })).body;
    const prWithout = (await api(BASE, "GET", `/api/prayer/day?date=${TODAY}`)).body;
    ok(JSON.stringify(strip(pdWith)) === JSON.stringify(strip(pdWithout)) && pdWith.liturgicalDay !== null && pdWithout.liturgicalDay === null,
      "L10 hygiene: player/day with vs without a record is identical except liturgicalDay");
    ok(JSON.stringify(strip(prWith)) === JSON.stringify(strip(prWithout)) && prWith.liturgicalDay !== null && prWithout.liturgicalDay === null,
      "L10 hygiene: prayer/day with vs without a record is identical except liturgicalDay");

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
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const litState = () => ev(() => {
      const el = document.getElementById("litday");
      const cs = getComputedStyle(document.documentElement);
      return {
        text: el ? el.textContent : null,
        attr: document.documentElement.getAttribute("data-lit"),
        barBg: getComputedStyle(document.querySelector(".brandbar")).backgroundColor,
        barImg: getComputedStyle(document.querySelector(".brandbar")).backgroundImage,
      };
    });
    const loadDay = async () => {
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => {
        const ds = (window.state && window.state.dayDescs) || [];
        return ds.some((x) => x.episodeId === "daily-rosary" && x.available);
      }, null, { timeout: 45000 }).catch(() => {});
      await sleep(600);
    };

    // ---- L3 · the header shows the OFFICIAL name (browser half) ---
    await lit(TODAY, FERIAL, "green");
    await loadDay();
    let ls = await litState();
    ok(ls.text === FERIAL && ls.attr === "green",
      `L3 header: with a private-fallback addendum standing, the header shows the FERIAL liturgical name, never the private saint (text=${JSON.stringify(ls.text)}, data-lit=${ls.attr})`);

    // ---- L4 · the fallback ----------------------------------------
    delLit(TODAY);
    await lit(YDAY, "Memorial of Yesterday Fixture", "red");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const ds = (window.state && window.state.dayDescs) || [];
      return ds.some((x) => x.episodeId === "daily-rosary" && x.available);
    }, null, { timeout: 45000 }).catch(() => {});
    await sleep(600);
    ls = await litState();
    const dateLabel = pdWithout.dateLabel;
    ok(ls.text === dateLabel && ls.attr === null && ls.barBg === "rgb(22, 40, 63)" && ls.barImg === "none",
      `L4 fallback: no record for today (yesterday's stands) → the header shows the plain date label, no data-lit, the bar is flat navy (text=${JSON.stringify(ls.text)}, label=${JSON.stringify(dateLabel)}, attr=${ls.attr}, bg=${ls.barBg}, img=${ls.barImg})`);
    delLit(YDAY);

    // ---- L5-L9 · one leg per color --------------------------------
    const THEMES = {
      white: { ends: ["#f3e9cf", "#faf5ec"], solid: "#f3e9cf", fg: "#16283f", sub: "#6d6353", accent: "#a8863a", ink: "#ffffff", gold: true },
      red: { ends: ["#5d1616", "#7d2121"], solid: "#5d1616", fg: "#f6e8d8", sub: "#dfb9a8", accent: "#9e2b25", ink: "#ffffff" },
      green: { ends: ["#173a22", "#1f4d2e"], solid: "#173a22", fg: "#e9d9ae", sub: "#b7cdb9", accent: "#2e7d46", ink: "#ffffff" },
      violet: { ends: ["#2c1e40", "#3d2a56"], solid: "#2c1e40", fg: "#e9d9ae", sub: "#c4b6dd", accent: "#6a4a9e", ink: "#ffffff" },
      rose: { ends: ["#6d3441", "#8a4453"], solid: "#6d3441", fg: "#f9e9e4", sub: "#eed3d7", accent: "#a34a5f", ink: "#ffffff" },
    };
    const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
    const lum = (h) => {
      const n = parseInt(h.slice(1), 16);
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
    };
    const ratio = (a, b) => { const [hi, lo] = lum(a) >= lum(b) ? [a, b] : [b, a]; return (lum(hi) + 0.05) / (lum(lo) + 0.05); };

    for (const color of Object.keys(THEMES)) {
      const T = THEMES[color];
      const name = `Fixture ${color} Day`;
      await lit(TODAY, name, color);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction((c) => document.documentElement.getAttribute("data-lit") === c, color, { timeout: 20000 }).catch(() => {});
      await page.waitForFunction(() => {
        const ds = (window.state && window.state.dayDescs) || [];
        return ds.some((x) => x.episodeId === "daily-rosary" && x.available);
      }, null, { timeout: 45000 }).catch(() => {});
      await sleep(400);
      // paint the dock via a real card tap (the rosary pair)
      await ev(() => {
        const card = document.querySelector('[data-card="daily-rosary"]');
        const btn = card && card.querySelector('[data-playkey="daily-rosary"]');
        if (btn) btn.click();
      });
      await sleep(700);
      const m = await ev(() => {
        const root = getComputedStyle(document.documentElement);
        const pick = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; };
        return {
          attr: document.documentElement.getAttribute("data-lit"),
          text: document.getElementById("litday") ? document.getElementById("litday").textContent : null,
          vAccent: root.getPropertyValue("--accent").trim(),
          vInk: root.getPropertyValue("--accent-ink").trim(),
          vFg: root.getPropertyValue("--bar-fg").trim(),
          vSub: root.getPropertyValue("--bar-sub").trim(),
          vBg: root.getPropertyValue("--bar-bg").trim(),
          playbtnBg: pick("#dock-play", "backgroundColor"),
          fillBg: pick("#dock-progress-fill", "backgroundColor"),
          blockheadBorder: pick(".blockhead", "borderBottomColor"),
          barBgColor: pick(".brandbar", "backgroundColor"),
          barBgImg: pick(".brandbar", "backgroundImage"),
          vSolid: root.getPropertyValue("--bar-solid").trim(),
          tabBgColor: pick(".tabbar", "backgroundColor"),
          tabBgImg: pick(".tabbar", "backgroundImage"),
          dockBgColor: pick(".dock", "backgroundColor"),
          dockBgImg: pick(".dock", "backgroundImage"),
          wordmarkColor: pick(".wordmark", "color"),
          litdayColor: pick(".litday", "color"),
          tabColor: pick(".tab:not(.active)", "color"),
          tabActiveColor: pick(".tab.active", "color"),
          dockHidden: document.getElementById("dock").classList.contains("hidden"),
        };
      });
      const fgR = T.ends.map((e) => ratio(T.fg, e));
      const subR = T.ends.map((e) => ratio(T.sub, e));
      const contrastOk = fgR.every((x) => x >= 4.5) && subR.every((x) => x >= 4.5)
        && (T.gold || (ratio(T.accent, T.ink) >= 4.5 && ratio(T.accent, "#faf5ec") >= 4.5));
      let pass = m.attr === color && m.text === name
        && m.vAccent === T.accent && m.vInk === T.ink && m.vFg === T.fg && m.vSub === T.sub
        && m.vBg.includes(T.ends[0]) && m.vBg.includes(T.ends[1])
        && m.playbtnBg === hexRgb(T.accent) && m.fillBg === hexRgb(T.accent) && m.blockheadBorder === hexRgb(T.accent)
        && m.vSolid === T.solid && m.barBgImg.includes("linear-gradient") && contrastOk;
      let extra = "";
      if (color === "white") {
        const whiteOk = m.wordmarkColor === "rgb(22, 40, 63)" && m.litdayColor === "rgb(22, 40, 63)"
          && m.tabBgImg.includes("linear-gradient") && m.dockBgImg.includes("linear-gradient")
          && m.tabColor === hexRgb(T.sub) && m.tabActiveColor === hexRgb(T.fg) && !m.dockHidden;
        pass = pass && whiteOk;
        extra = ` · white leg: wordmark=${m.wordmarkColor}, litday=${m.litdayColor}, tabbar gradient=${m.tabBgImg.includes("linear-gradient")}, dock gradient=${m.dockBgImg.includes("linear-gradient")}, tab=${m.tabColor}, tabActive=${m.tabActiveColor}, gold pairs REPORTED (brand exception): accent-on-cream=${ratio(T.accent, "#faf5ec").toFixed(2)}, ink-on-accent=${ratio(T.ink, T.accent).toFixed(2)}`;
      }
      ok(pass, `L-${color} theme: data-lit=${m.attr}, header=${JSON.stringify(m.text)}, playbtn=${m.playbtnBg}, dock fill=${m.fillBg} (dock painted=${!m.dockHidden}), blockhead border=${m.blockheadBorder}, bar gradient=${m.barBgImg.includes("linear-gradient")} over solid var=${m.vSolid}; contrast fg=${fgR.map((x) => x.toFixed(2)).join("/")} sub=${subR.map((x) => x.toFixed(2)).join("/")}${T.gold ? "" : ` accent-vs-ink=${ratio(T.accent, T.ink).toFixed(2)} accent-vs-cream=${ratio(T.accent, "#faf5ec").toFixed(2)}`}${extra}`);
      await ev(() => { const a = document.getElementById("audio"); if (a) a.pause(); });
    }

    // ---- L10 · floors (browser half) -------------------------------
    const floors = await ev(() => {
      const el = document.getElementById("litday");
      return {
        body: parseFloat(getComputedStyle(document.body).fontSize),
        litday: el ? parseFloat(getComputedStyle(el).fontSize) : 0,
      };
    });
    ok(floors.body === 17 && floors.litday >= 13,
      `L10 floors: body computed font-size = 17px and #litday >= 13px under a theme (body=${floors.body}, litday=${floors.litday})`);

    // ---- L11 · no-break on the other surfaces ----------------------
    const surfaceCheck = async () => ev(() => new Promise((res) => {
      const out = {};
      const click = (sel) => { const e = document.querySelector(sel); if (e) e.click(); };
      click('[data-tab="examination"]');
      setTimeout(() => {
        out.examination = document.getElementById("view").textContent.includes("examination");
        click('[data-tab="confession"]');
        setTimeout(() => {
          out.confession = document.getElementById("view").textContent.includes("Confession");
          click('[data-tab="intentions"]');
          setTimeout(() => {
            out.intentions = document.getElementById("view").textContent.includes("Intentions");
            click("#gearbtn");
            setTimeout(() => {
              out.settings = document.getElementById("view").textContent.includes("Settings");
              res(out);
            }, 900);
          }, 900);
        }, 900);
      }, 900);
    }));
    await lit(TODAY, "Memorial of Saint Fixture", "white");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-lit") === "white", null, { timeout: 20000 }).catch(() => {});
    await sleep(500);
    const sWhite = await surfaceCheck();
    await lit(TODAY, "Memorial of Saint Fixture", "violet");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-lit") === "violet", null, { timeout: 20000 }).catch(() => {});
    await sleep(500);
    const sViolet = await surfaceCheck();
    ok(sWhite.examination && sWhite.confession && sWhite.intentions && sWhite.settings
      && sViolet.examination && sViolet.confession && sViolet.intentions && sViolet.settings,
      `L11 no-break: Examination, Confession, Intentions, and Settings render their standing forms under a white record, then a violet one (white=${JSON.stringify(sWhite)}, violet=${JSON.stringify(sViolet)})`);

    ok(pageErrors.length === 0, `browser: no page errors across the v352 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v352: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
