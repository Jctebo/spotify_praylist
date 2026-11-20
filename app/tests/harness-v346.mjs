#!/usr/bin/env node
// harness-v346 — the v346 gate (Plan §2.7): media-session focus.
// Candidate A playbackState at the nine seams · Candidate B
// re-assert on pause + visibility return over the single
// module-level handler table · Candidate C (R1) the
// queue/position-preserving resumeCurrent() seam behind the
// media-session play handler · the 512 artwork rider (true size,
// IHDR-decoded) · SW pin ora-pro-nobis-v346 + /logo-512.png shell.
// The harness proves the DECLARATIONS; the arbitration outcome is
// John's phone check (§2.9) and no leg here claims it.
// Fixture posture: the standing estate mold (v344) — local feed +
// HTTPS site servers, the presented day built client-side from the
// fixture feeds, queues driven from the live state.dayDescs.
// Scratch wrangler instance INSIDE the worktree, synthetic fixture
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v346 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8998, FEED_PORT = 8958, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v346");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v346-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
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
function wranglerD1(appDir, persist, file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"), "--persist-to", persist, "--file", file],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
}
function applyMigs(appDir, persist, extraSql = "") {
  fs.rmSync(persist, { recursive: true, force: true });
  const dir = path.join(appDir, "migrations");
  const parts = fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
  if (extraSql) parts.push(extraSql);
  const f = path.join(TMPD, `mig-${path.basename(persist)}.sql`);
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1(appDir, persist, f);
}
function tone(name, freq = 440, secs = 1.6) {
  const out = path.join(TMPD, name);
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${secs}`, "-codec:a", "libmp3lame", "-b:a", "32k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr);
  return fs.readFileSync(out);
}
// Tone lengths by audio filename: 30 s where a leg seeks/pauses
// mid-track; 3 s where a leg needs a natural end; intros 1 s.
const TONE_30 = tone("t30.mp3", 330, 30);
const TONE_3 = tone("t3.mp3", 550, 3);
const TONE_1 = tone("t1.mp3", 660, 1.0);
const TONE_16 = tone("t16.mp3", 440, 1.6);
function toneFor(name) {
  if (name.startsWith("intro-")) return TONE_1;
  if (name.includes("daily-reflection") || name.includes("st-anne")) return TONE_3;
  if (name.includes("daily-rosary") || name.includes("morning-prayer-elevenlabs") || name.includes("st-jude") || name.includes("auxilium") || name.includes("marian-antiphon")) return TONE_30;
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

// ---- external fixture feeds (the v344 presented-day set) --------
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
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v346-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    applyMigs(APP, PERSIST, seedSql());
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");

    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    var browser = await chromium.launch({
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
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const ds = window.state && window.state.dayDescs || [];
      const need = ["daily-rosary", "morning-prayer", "novena-st-jude", "daily-reflection", "auxilium-christianorum", "novena-st-anne"];
      return need.every((id) => ds.some((x) => x.episodeId === id && x.available));
    }, null, { timeout: 45000 });
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const descOf = (id) => ev((x) => { const d = (window.state.dayDescs || []).find((y) => y.episodeId === x); return d ? { episodeId: d.episodeId, title: d.title } : null; }, id);
    const QA = await descOf("daily-rosary"), QB = await descOf("morning-prayer"), QC = await descOf("novena-st-jude");
    ok(!!QA && !!QB && !!QC, `fixture: the presented day builds with the leg tracks available (qa=${QA && QA.title}, qb=${QB && QB.title}, qc=${QC && QC.title})`);
    const msState = () => ev(() => ({
      ps: navigator.mediaSession ? navigator.mediaSession.playbackState : null,
      title: navigator.mediaSession && navigator.mediaSession.metadata ? navigator.mediaSession.metadata.title : null,
      paused: document.getElementById("audio").paused,
      cur: window.state.current ? window.state.current.episodeId : null,
    }));
    const startQ = (ids) => ev((list) => {
      const byId = {}; window.state.dayDescs.forEach((d) => { byId[d.episodeId] = d; });
      window.startQueue(list.map((i) => byId[i]));
    }, ids);

    // ---- L1 · Boot truth ----
    const l1 = await ev(() => {
      window.__t346Table = window.__opnMediaHandlers || null;
      window.__t346Pos = 0;
      if (navigator.mediaSession && navigator.mediaSession.setPositionState) {
        const orig = navigator.mediaSession.setPositionState.bind(navigator.mediaSession);
        navigator.mediaSession.setPositionState = (s) => { window.__t346Pos++; return orig(s); };
      }
      const h = window.__opnMediaHandlers || {};
      return {
        ps: navigator.mediaSession ? navigator.mediaSession.playbackState : null,
        handlers: ["play", "pause", "previoustrack", "nexttrack", "seekto", "seekforward", "seekbackward"].filter((a) => typeof h[a] === "function"),
      };
    });
    ok(l1.ps === "none" && l1.handlers.length === 7,
      `L1 boot truth: playbackState 'none' with nothing current; all 7 action handlers stand (${l1.ps}, ${l1.handlers.join(",")})`);

    // ---- L2 · Start ----
    await page.click('[data-playkey="daily-rosary"]');
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "daily-rosary" && !document.getElementById("audio").paused, null, { timeout: 20000 });
    const l2 = await ev(() => ({
      ps: navigator.mediaSession.playbackState,
      title: navigator.mediaSession.metadata.title,
      artist: navigator.mediaSession.metadata.artist,
    }));
    ok(l2.ps === "playing" && l2.title === QA.title && l2.artist === "Ora Pro Nobis",
      `L2 start: playbackState 'playing'; metadata title/artist stand (${l2.ps}, ${l2.title}, ${l2.artist})`);

    // ---- L10 · Artwork shape + true size ----
    const l10meta = await ev(() => {
      const aw = navigator.mediaSession.metadata.artwork || [];
      return aw.map((a) => ({ src: a.src, sizes: a.sizes, type: a.type }));
    });
    const logoRes = await fetch(`${BASE}/logo-512.png`);
    const logoBuf = Buffer.from(await logoRes.arrayBuffer());
    const ihdrW = logoBuf.length > 24 ? logoBuf.readUInt32BE(16) : 0;
    const ihdrH = logoBuf.length > 24 ? logoBuf.readUInt32BE(20) : 0;
    const awOk = l10meta.length === 2
      && l10meta[0].src.endsWith("/logo.png") && l10meta[0].sizes === "288x288" && l10meta[0].type === "image/png"
      && l10meta[1].src.endsWith("/logo-512.png") && l10meta[1].sizes === "512x512" && l10meta[1].type === "image/png";
    ok(awOk && logoRes.status === 200 && (logoRes.headers.get("content-type") || "").includes("image/png") && ihdrW === 512 && ihdrH === 512,
      `L10 artwork: metadata = 288 entry unchanged + 512 entry added; GET /logo-512.png 200 image/png, IHDR decodes ${ihdrW}x${ihdrH} (${JSON.stringify(l10meta.map((a) => a.sizes))})`);

    // ---- L11 · Position state kept ----
    const posBefore = await ev(() => window.__t346Pos);
    const seeked = await ev(async () => {
      window.__opnMediaHandlers.seekto({ seekTime: 5 });
      await new Promise((r2) => setTimeout(r2, 400));
      return document.getElementById("audio").currentTime;
    });
    await sleep(1300);
    const posAfter = await ev(() => window.__t346Pos);
    ok(seeked > 3 && posAfter > posBefore,
      `L11 position state kept: seekto through the handler table moves currentTime (${seeked.toFixed(2)}s); setPositionState keeps firing on timeupdate (${posBefore} -> ${posAfter})`);

    // ---- L3 · Pause declaration + re-assert ----
    await ev(() => document.getElementById("audio").pause());
    await sleep(400);
    const l3 = await ev(() => ({
      ps: navigator.mediaSession.playbackState,
      title: navigator.mediaSession.metadata.title,
      same: window.__t346Table === window.__opnMediaHandlers,
    }));
    ok(l3.ps === "paused" && l3.title === QA.title && l3.same === true,
      `L3 pause: playbackState 'paused'; metadata still names the current track; handler-table identity unchanged (${l3.ps}, ${l3.title}, same=${l3.same})`);

    // ---- L6 · Handler pause symmetry ----
    await ev(() => document.getElementById("audio").play());
    await page.waitForFunction(() => !document.getElementById("audio").paused, null, { timeout: 10000 });
    await ev(() => window.__opnMediaHandlers.pause());
    await sleep(400);
    const l6 = await ev(() => {
      let rec = null; try { rec = JSON.parse(localStorage.getItem("opn-resume-v312") || "null"); } catch { /* none */ }
      return { ps: navigator.mediaSession.playbackState, paused: document.getElementById("audio").paused, recId: rec ? rec.episodeId : null };
    });
    ok(l6.paused === true && l6.ps === "paused" && l6.recId === "daily-rosary",
      `L6 handler pause symmetry: element paused, playbackState 'paused', resume record stands for the current episode (${l6.ps}, rec=${l6.recId})`);

    // ---- L4 · Handler resume (the defect leg) ----
    await startQ(["daily-rosary", "morning-prayer", "novena-st-jude"]);
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "daily-rosary" && !document.getElementById("audio").paused, null, { timeout: 20000 });
    await ev(() => { document.getElementById("audio").currentTime = 8; });
    await sleep(500);
    await ev(() => document.getElementById("audio").pause());
    await sleep(400);
    const snap4 = await ev(() => ({
      q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
      t: document.getElementById("audio").currentTime,
    }));
    await ev(() => window.__opnMediaHandlers.play());
    await sleep(700);
    const l4 = await ev(() => ({
      cur: window.state.current ? window.state.current.episodeId : null,
      q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
      t: document.getElementById("audio").currentTime,
      ps: navigator.mediaSession.playbackState,
      title: navigator.mediaSession.metadata.title,
      paused: document.getElementById("audio").paused,
    }));
    ok(l4.cur === "daily-rosary" && JSON.stringify(l4.q) === JSON.stringify(snap4.q) && l4.idx === snap4.idx
      && l4.t > 4 && Math.abs(l4.t - snap4.t) < 3 && l4.ps === "playing" && l4.paused === false && l4.title === QA.title,
      `L4 handler resume: same episode resumes, queue + queueIdx byte-identical, position kept (${snap4.t.toFixed(2)}s -> ${l4.t.toFixed(2)}s), playbackState 'playing', metadata stands (q=${l4.q.join(",")}, idx=${l4.idx})`);
    await ev(() => document.getElementById("audio").pause());
    await sleep(300);

    // ---- L7 · Visibility re-assert ----
    const l7 = await ev(async () => {
      navigator.mediaSession.metadata = new MediaMetadata({ title: "ZZZ Corrupted", artist: "X" });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r2) => setTimeout(r2, 200));
      const afterHidden = navigator.mediaSession.metadata.title;
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r2) => setTimeout(r2, 300));
      return {
        afterHidden,
        title: navigator.mediaSession.metadata.title,
        ps: navigator.mediaSession.playbackState,
        same: window.__t346Table === window.__opnMediaHandlers,
      };
    });
    ok(l7.afterHidden === "ZZZ Corrupted" && l7.title === QA.title && l7.ps === "paused" && l7.same === true,
      `L7 visibility re-assert: hidden return does not re-file; visible return re-files metadata for the current track, playbackState 'paused', handler identity unchanged (hidden=${l7.afterHidden}, visible=${l7.title})`);

    // ---- L9 · Sleep hold ----
    await startQ(["daily-reflection", "auxilium-christianorum"]);
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "daily-reflection", null, { timeout: 20000 });
    await ev(() => window.__opnSleep.armTrack());
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "auxilium-christianorum", null, { timeout: 20000 });
    await sleep(500);
    const l9 = await msState();
    const l9q = await ev(() => ({ len: window.state.queue.length, idx: window.state.queueIdx, sleepMode: window.__opnSleep.state().mode }));
    ok(l9.cur === "auxilium-christianorum" && l9.paused === true && l9.ps === "paused" && l9q.len === 2 && l9q.idx === 1,
      `L9 sleep hold: the held next track stands current, element paused, playbackState 'paused' (not none/playing), queue held (cur=${l9.cur}, ps=${l9.ps}, qlen=${l9q.len}, idx=${l9q.idx}, sleep=${l9q.sleepMode})`);

    // ---- L8 · End transitions ----
    await startQ(["daily-reflection", "auxilium-christianorum"]);
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "daily-reflection" && !document.getElementById("audio").paused, null, { timeout: 20000 });
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "auxilium-christianorum", null, { timeout: 20000 });
    await sleep(400);
    const l8a = await msState();
    await ev(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "novena-st-anne");
      window.playTrack(d);
    });
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "novena-st-anne", null, { timeout: 20000 });
    await page.waitForFunction(() => window.state.current === null, null, { timeout: 20000 });
    await sleep(400);
    const l8b = await msState();
    ok(l8a.cur === "auxilium-christianorum" && l8a.ps === "playing" && l8b.cur === null && l8b.ps === "none",
      `L8 end transitions: queue advance at a track end -> next track current with 'playing' (${l8a.cur}/${l8a.ps}); single-track natural end -> current null with 'none' (${l8b.cur}/${l8b.ps})`);

    // ---- L5 · Handler play with nothing current ----
    await startQ(["novena-st-anne"]);
    await page.waitForFunction(() => window.state.current && window.state.current.episodeId === "novena-st-anne", null, { timeout: 20000 });
    await page.waitForFunction(() => window.state.current === null, null, { timeout: 20000 });
    await sleep(300);
    const srcBefore = await ev(() => document.getElementById("audio").src);
    let threw = false;
    try { await ev(() => window.__opnMediaHandlers.play()); } catch { threw = true; }
    await sleep(500);
    const l5 = await ev(() => ({
      ps: navigator.mediaSession.playbackState,
      paused: document.getElementById("audio").paused,
      src: document.getElementById("audio").src,
      cur: window.state.current ? window.state.current.episodeId : null,
    }));
    ok(!threw && l5.paused === true && l5.src === srcBefore && l5.ps === "none" && l5.cur === null,
      `L5 handler play with nothing current: defined no-op — element stays paused, src unchanged, playbackState 'none', no throw (ps=${l5.ps})`);

    // ---- L12 · SW pin + shell ----
    const sw = (await api(BASE, "GET", "/sw.js")).text;
    ok(sw.includes("ora-pro-nobis-v346") && sw.includes("/logo-512.png"),
      "L12 SW pin + shell: the served service worker carries CACHE 'ora-pro-nobis-v346' and its SHELL includes /logo-512.png");

    ok(pageErrors.length === 0, `evidence: the browser run completed with zero page errors${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
    await browser.close().catch(() => {});
  } catch (e) {
    n++; fails++; console.log(`not ok ${n} - harness crashed: ${e.message}`);
  } finally {
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
    try { feedServer.close(); } catch { /* noop */ }
    try { if (siteServer) siteServer.close(); } catch { /* noop */ }
    await sleep(500);
  }
  console.log(`TALLY: ${n - fails} ok / ${fails} FAIL (${n} checks)`);
  process.exit(fails ? 1 : 0);
}

main();
