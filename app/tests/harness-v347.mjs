#!/usr/bin/env node
// harness-v347 — the v347 gate (Plan §2.9): visible queue.
// L1-L12: list order, playing marker, played dots, in-place dot,
// tap-to-jump, resume follow, Continue remaining + fallback,
// See queue preview, late-settle, play-button guard, states, pin.
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
const PORT = 8997, FEED_PORT = 8957, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v347");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v347-"));
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
    await page.waitForFunction(() => (window.state.dayDescs || []).some((x) => x.episodeId === "intro:daily-rosary"), null, { timeout: 45000 });
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

    const rows = () => ev(() => Array.from(document.querySelectorAll(".npq-row")).map((r) => ({
      idx: Number(r.getAttribute("data-npq-index")), id: r.getAttribute("data-npq-id"),
      playing: r.classList.contains("playing"), start: r.classList.contains("npq-start"),
      disabled: r.disabled, hasDot: !!r.querySelector(".npq-dot"),
      dotOn: r.querySelector(".npq-dot") ? r.querySelector(".npq-dot").classList.contains("on") : null,
      text: r.textContent,
    })));
    const qstate = () => ev(() => ({
      q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
      cur: window.state.current ? window.state.current.episodeId : null,
      paused: document.getElementById("audio").paused,
      src: document.getElementById("audio").src,
      pos: document.querySelector("#np-queue-pos") ? document.querySelector("#np-queue-pos").textContent : null,
    }));
    const seedPlayed = (ids, wrongDateOnly = []) => ev(({ ids, wrongDateOnly, today }) => {
      const map = {};
      ids.forEach((id) => { map[id] = { [today]: { playedAt: new Date().toISOString(), via: "played" } }; });
      wrongDateOnly.forEach((id) => { map[id] = { "2000-01-01": { playedAt: new Date().toISOString(), via: "played" } }; });
      localStorage.setItem("opn-played-v344", JSON.stringify(map));
      window.state.playedCache = null;
    }, { ids, wrongDateOnly, today: TODAY });
    const clearPlayed = () => ev(() => { localStorage.removeItem("opn-played-v344"); window.state.playedCache = null; });

    // ---- L1 · List order = queue order ----
    const Q1 = ["intro:daily-rosary", "daily-rosary", "intro:morning-prayer", "morning-prayer", "novena-st-jude"];
    await ev((list) => {
      const byId = {}; window.state.dayDescs.forEach((d) => { byId[d.episodeId] = d; });
      window.startQueue(list.map((i) => byId[i]));
      document.getElementById("audio").pause();
      window.openNowPlaying();
    }, Q1);
    await sleep(300);
    const l1rows = await rows(); const l1q = await qstate();
    ok(JSON.stringify(l1rows.map((r) => r.id)) === JSON.stringify(Q1) && JSON.stringify(l1q.q) === JSON.stringify(Q1)
      && l1rows[0].text.includes("Intention") && l1q.pos === "Track 1 of 5",
      `L1 list order: rows equal the standing queue order exactly, intros at spliced positions (rows=${l1rows.map((r) => r.id).join(",")}; pos=${l1q.pos})`);

    // ---- L2 · Playing marker moves at advance ----
    const l2a = await rows();
    await ev(() => { window.advanceQueue(1); document.getElementById("audio").pause(); });
    await sleep(200);
    const l2rows = await rows(); const l2q = await qstate();
    ok(l2a.find((r) => r.playing) && l2a.find((r) => r.playing).idx === 0
      && l2q.idx === 1 && l2rows.find((r) => r.playing) && l2rows.find((r) => r.playing).idx === 1 && l2rows.find((r) => r.playing).id === l2q.cur,
      `L2 playing marker: marked row = queueIdx + current at open (0), and moves to the new index in the same sync at advance (idx=${l2q.idx}, cur=${l2q.cur})`);

    // ---- L3 · Played dots ----
    await seedPlayed(["daily-rosary"], ["novena-st-jude"]);
    await ev(() => window.renderQueueList());
    const l3rows = await rows();
    const byId3 = Object.fromEntries(l3rows.map((r) => [r.id, r]));
    ok(byId3["daily-rosary"].hasDot && byId3["daily-rosary"].dotOn === true
      && byId3["morning-prayer"].hasDot && byId3["morning-prayer"].dotOn === false
      && byId3["novena-st-jude"].dotOn === false
      && byId3["intro:daily-rosary"].hasDot === false && byId3["intro:morning-prayer"].hasDot === false,
      `L3 played dots: presented-date seeding fills only that prayer's dot; a different-date seed does not fill; intro rows carry no dot element (rosary=${byId3["daily-rosary"].dotOn}, jude=${byId3["novena-st-jude"].dotOn})`);

    // ---- L4 · Dot lands in place at track end ----
    await clearPlayed();
    await ev(() => {
      const byId = {}; window.state.dayDescs.forEach((d) => { byId[d.episodeId] = d; });
      window.startQueue([byId["novena-st-jude"], byId["auxilium-christianorum"]]);
      window.openNowPlaying();
      window.__sheet347 = document.querySelector(".np-sheet");
    });
    await sleep(200);
    await ev(() => { document.getElementById("audio").dispatchEvent(new Event("ended")); document.getElementById("audio").pause(); });
    await sleep(300);
    const l4rows = await rows();
    const l4same = await ev(() => document.querySelector(".np-sheet") === window.__sheet347);
    const l4q = await qstate();
    ok(l4same && l4q.cur === "auxilium-christianorum" && l4rows[0].dotOn === true && l4rows[1].playing,
      `L4 dot in place: ended with the list open fills the finished row's dot, the marker advances, and the sheet node is not rebuilt (same=${l4same}, cur=${l4q.cur})`);

    // ---- L5 · Tap-to-jump preserves the queue ----
    const Q5 = ["daily-rosary", "morning-prayer", "novena-st-jude", "auxilium-christianorum", "novena-st-anne"];
    await ev((list) => {
      const byId = {}; window.state.dayDescs.forEach((d) => { byId[d.episodeId] = d; });
      window.__pt347 = 0; const orig = window.playTrack;
      window.playTrack = function (d) { window.__pt347++; return orig(d); };
      window.startQueue(list.map((i) => byId[i]));
      document.getElementById("audio").pause();
      window.openNowPlaying();
    }, Q5);
    await sleep(200);
    await page.click('[data-npq-index="3"]');
    await sleep(300);
    await ev(() => document.getElementById("audio").pause());
    const l5a = await qstate(); const ptA = await ev(() => window.__pt347);
    await page.click('[data-npq-index="1"]');
    await sleep(300);
    await ev(() => document.getElementById("audio").pause());
    const l5b = await qstate();
    const l5c = await ev(() => {
      const fake = { episodeId: "fake-unavailable-347", title: "Fake Missing", url: null, available: false, block: "Morning", source: "", durationS: 0 };
      window.state.queue.splice(2, 0, fake);
      window.renderQueueList();
      const before = { idx: window.state.queueIdx, cur: window.state.current.episodeId };
      window.jumpQueueTo(2);
      return { before, idx: window.state.queueIdx, cur: window.state.current.episodeId, rowDisabled: document.querySelector('[data-npq-index="2"]').disabled };
    });
    ok(JSON.stringify(l5a.q) === JSON.stringify(Q5) && l5a.idx === 3 && l5a.cur === "auxilium-christianorum" && ptA === 0
      && JSON.stringify(l5b.q) === JSON.stringify(Q5) && l5b.idx === 1 && l5b.cur === "morning-prayer"
      && l5c.idx === l5c.before.idx && l5c.cur === l5c.before.cur && l5c.rowDisabled === true,
      `L5 tap-to-jump: forward and back taps move queueIdx, queue order/length unchanged, playTrack not called (pt=${ptA}); an unavailable row stands disabled and jumpQueueTo leaves the index unmoved (idx=${l5a.idx}->${l5b.idx})`);

    // ---- L6 · Resume record follows a jump ----
    await ev(() => { window.state.queue = window.state.queue.filter((d) => d.episodeId !== "fake-unavailable-347"); window.openNowPlaying(); });
    await page.click('[data-npq-index="3"]');
    await sleep(300);
    await ev(() => document.getElementById("audio").pause());
    await sleep(200);
    const l6rec = await ev(() => { try { return JSON.parse(localStorage.getItem("opn-resume-v312") || "null"); } catch { return null; } });
    ok(l6rec && l6rec.episodeId === "auxilium-christianorum",
      `L6 resume follows jump: after the jump to row 3, the pause-path saveResume writes the jumped-to episode (rec=${l6rec && l6rec.episodeId})`);

    // ---- L7 · Continue plays remaining only + full-replay fallback ----
    await seedPlayed(["daily-rosary", "morning-prayer"]);
    const exp7 = await ev(() => {
      window.state.playedCache = null;
      const exp = window.queueBuild(window.extRebuildDescs(window.state.dayPayload)).map((d) => d.episodeId);
      window.paintContinue();
      return exp;
    });
    await ev(() => { const sh = document.querySelector('.np-sheet'); if (sh) sh.remove(); });
    await page.click("#continue-btn");
    await sleep(300);
    await ev(() => document.getElementById("audio").pause());
    const l7q = await qstate();
    await ev(() => window.openNowPlaying());
    const l7rows = await rows();
    const remainingOk = JSON.stringify(l7q.q) === JSON.stringify(exp7)
      && !l7q.q.includes("daily-rosary") && !l7q.q.includes("intro:daily-rosary")
      && !l7q.q.includes("morning-prayer") && !l7q.q.includes("intro:morning-prayer")
      && JSON.stringify(l7rows.map((r) => r.id)) === JSON.stringify(l7q.q);
    // fully-played fallback
    const allIds = await ev(() => {
      const ids = [...new Set(window.state.dayDescs.filter((d) => d.kind !== "intention" && d.available).map((d) => d.episodeId))];
      const map = {}; const t = window.state.presentedDay;
      ids.forEach((id) => { map[id] = { [t]: { playedAt: new Date().toISOString(), via: "played" } }; });
      localStorage.setItem("opn-played-v344", JSON.stringify(map));
      window.state.playedCache = null;
      window.paintContinue();
      return { ids, card: !!document.getElementById("continue-btn"), full: window.extRebuildDescs(window.state.dayPayload).map((d) => d.episodeId) };
    });
    await ev(() => { const sh = document.querySelector('.np-sheet'); if (sh) sh.remove(); });
    await page.click("#play-all");
    await sleep(300);
    await ev(() => { document.getElementById("audio").pause(); window.openNowPlaying(); });
    const l7bq = await qstate(); const l7brows = await rows();
    const prayerRows = l7brows.filter((r) => !r.id.startsWith("intro:") && allIds.ids.includes(r.id));
    ok(remainingOk && !allIds.card && JSON.stringify(l7bq.q) === JSON.stringify(allIds.full) && prayerRows.length > 0 && prayerRows.every((r) => r.dotOn === true),
      `L7 Continue remaining: started queue = the filtered build (played prayers + intros absent) and the list shows that same array; fully-played day stands no Continue card and Play All's queue stands in full with every prayer dot filled (remaining=${l7q.q.length}, full=${l7bq.q.length}, remainingOk=${remainingOk}, card=${allIds.card}, fullEq=${JSON.stringify(l7bq.q) === JSON.stringify(allIds.full)}, dots=${prayerRows.length}/${prayerRows.filter((r) => r.dotOn).length})`);
    await clearPlayed();
    await ev(() => { try { localStorage.removeItem("opn-resume-v312"); } catch {} window.paintContinue(); });

    // ---- L8 · See queue door / preview ----
    await seedPlayed(["daily-rosary", "morning-prayer"]);
    const exp8 = await ev(() => {
      window.state.playedCache = null;
      const full = window.state.dayDescs.filter((d) => d.kind !== "intention" && d.available);
      const t = window.state.presentedDay;
      const firstUn = full.find((d) => { try { return !window.isPlayed(d.episodeId, t); } catch { return true; } });
      // first unplayed by the standing day order (dayDescs order)
      let firstId = null;
      for (const d of window.state.dayDescs) { if (d.kind === "intention" || !d.available) continue; const m = JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); if (!(m[d.episodeId] && m[d.episodeId][t])) { firstId = d.episodeId; break; } }
      localStorage.setItem("opn-resume-v312", JSON.stringify({ date: window.state.storedDay, episodeId: firstId, positionS: 12, savedAt: new Date().toISOString() }));
      const res = window.buildContinueQueue();
      window.paintContinue();
      return { build: res.build.map((d) => d.episodeId), carryIdx: res.carryIdx, firstId };
    });
    const before8 = await qstate();
    ok(!!(await page.$("#continue-queue")), "L8a See queue door: the Continue card carries #continue-queue");
    await ev(() => { const sh = document.querySelector('.np-sheet'); if (sh) sh.remove(); });
    await page.click("#continue-queue");
    await sleep(300);
    const prevRows = await rows();
    const afterOpen8 = await ev(() => ({ q: window.state.queue.map((d) => d.episodeId), cur: window.state.current ? window.state.current.episodeId : null, src: document.getElementById("audio").src, preview: (window.state.previewQueue || []).map((d) => d.episodeId) }));
    const carryRow = prevRows[exp8.carryIdx];
    const openOk = JSON.stringify(afterOpen8.preview) === JSON.stringify(exp8.build)
      && JSON.stringify(prevRows.map((r) => r.id)) === JSON.stringify(exp8.build)
      && carryRow && carryRow.start && carryRow.text.includes("Starts here");
    // close without a tap: nothing changes
    await page.click("#np-min");
    await sleep(200);
    const afterClose8 = await qstate();
    const closeOk = JSON.stringify(afterClose8.q) === JSON.stringify(afterOpen8.q) && afterClose8.cur === afterOpen8.cur;
    // reopen and tap a row
    await ev(() => { const sh = document.querySelector('.np-sheet'); if (sh) sh.remove(); });
    await page.click("#continue-queue");
    await sleep(300);
    const tapIdx = Math.min(exp8.carryIdx + 1, exp8.build.length - 1);
    await page.click(`[data-npq-index="${tapIdx}"]`);
    await sleep(400);
    await ev(() => document.getElementById("audio").pause());
    const l8q = await qstate();
    const liveSheet = await ev(() => { const sh = document.querySelector(".np-sheet"); return { stands: !!sh, preview: sh ? sh.classList.contains("np-preview") : null, pq: window.state.previewQueue }; });
    ok(openOk && closeOk && JSON.stringify(l8q.q) === JSON.stringify(exp8.build.slice(tapIdx)) && liveSheet.stands && liveSheet.preview === false && liveSheet.pq === null,
      `L8 See queue preview: door starts nothing, preview lists the remaining build with the carry row marked Starts here (carryIdx=${exp8.carryIdx}, first=${exp8.firstId}); closing without a tap leaves queue/current untouched; tapping preview row ${tapIdx} starts the build sliced there and the live sheet replaces the preview (q=${l8q.q.length})`);
    await ev(() => { try { localStorage.removeItem("opn-resume-v312"); } catch {} });

    // ---- L9 · Late-settling external ----
    const l9 = await ev(async () => {
      const byId = {}; window.state.dayDescs.forEach((d) => { byId[d.episodeId] = d; });
      const fake = { episodeId: "ext-bible-in-a-year", title: "Bible in a Year", url: null, available: false, block: "Morning", source: "Bible in a Year", durationS: 0 };
      window.startQueue([byId["daily-rosary"], fake]);
      document.getElementById("audio").pause();
      window.openNowPlaying();
      const beforeTitle = document.querySelector('[data-npq-index="1"]') ? document.querySelector('[data-npq-index="1"]').textContent : "";
      // the settle repaint's own steps: slot stands present, descriptors rebuild, Continue repaints
      window.state.extSlots["ext-bible-in-a-year"] = { state: "present", title: "Day 999: Settled Fixture", streamUrl: "http://127.0.0.1:8957/audio/daily-rosary-settled.mp3", enclosureUrl: "http://127.0.0.1:8957/audio/daily-rosary-settled.mp3", durationSec: 60, sizeBytes: 1000, source: "Bible in a Year" };
      window.extRebuildDescs(window.state.dayPayload);
      window.paintContinue();
      window.advanceQueue(1);
      document.getElementById("audio").pause();
      await new Promise((r2) => setTimeout(r2, 200));
      const row = document.querySelector('[data-npq-index="1"]');
      return { beforeTitle, rowText: row ? row.textContent : "", cur: window.state.current ? window.state.current.episodeId : null, curTitle: window.state.current ? window.state.current.title : "", q1: window.state.queue[1] ? window.state.queue[1].title : "" };
    });
    ok(l9.cur === "ext-bible-in-a-year" && l9.rowText.includes("Settled Fixture") && l9.q1.includes("Settled Fixture"),
      `L9 late settle: a queue built with the slot pre-settle/unavailable plays the live descriptor at advance via queueLiveDesc, and its row then reflects the settled title (before=${l9.beforeTitle.slice(0, 40)}; after=${l9.rowText.slice(0, 60)})`);

    // ---- L10 · Play-button guard ----
    const l10before = await qstate();
    await ev(() => { const sh = document.querySelector('.np-sheet'); if (sh) sh.remove(); });
    await page.click("#dock-play");
    await sleep(400);
    const l10a = await qstate();
    await ev(() => window.openNowPlaying());
    await page.click("#np-play"); // playing -> pause via the guard
    await sleep(300);
    const l10b = await qstate();
    await page.click("#np-play"); // paused -> resumeCurrent via the guard
    await sleep(400);
    const l10c = await qstate();
    await ev(() => document.getElementById("audio").pause());
    const guardOk = JSON.stringify(l10a.q) === JSON.stringify(l10before.q) && l10a.idx === l10before.idx && l10a.src === l10before.src && l10a.paused === false
      && JSON.stringify(l10b.q) === JSON.stringify(l10before.q) && l10b.paused === true
      && JSON.stringify(l10c.q) === JSON.stringify(l10before.q) && l10c.idx === l10before.idx && l10c.paused === false;
    const noQueue = await ev(() => {
      const d = window.state.dayDescs.find((x) => x.episodeId === "morning-prayer");
      window.playTrack(d);
      document.getElementById("audio").pause();
      return { q: window.state.queue.length, cur: window.state.current.episodeId };
    });
    await ev(() => { const sh = document.querySelector('.np-sheet'); if (sh) sh.remove(); });
    await page.click("#dock-play");
    await sleep(400);
    const l10d = await qstate();
    await ev(() => document.getElementById("audio").pause());
    ok(guardOk && noQueue.q === 0 && l10d.cur === "morning-prayer" && l10d.paused === false && l10d.q.length === 0,
      `L10 play-button guard: with a queue standing, #dock-play/#np-play resume/pause without clearing the queue or reloading src (idx=${l10before.idx} kept); with no queue, the standing playTrack behavior stands (cur=${l10d.cur})`);

    // ---- L11 · States ----
    const single = await ev(() => {
      window.openNowPlaying();
      const box = document.querySelector("#np-queue");
      return { text: box ? box.textContent : "", rows: document.querySelectorAll(".npq-row").length, q: window.state.queue.length };
    });
    await ev(() => {
      const byId = {}; window.state.dayDescs.forEach((d) => { byId[d.episodeId] = d; });
      window.startQueue([byId["novena-st-anne"]]);
    });
    await page.waitForFunction(() => window.state.current === null, null, { timeout: 20000 });
    await sleep(300);
    const endedSheet = await ev(() => !!document.querySelector(".np-sheet"));
    await clearPlayed();
    const noCard = await ev(() => { try { localStorage.removeItem("opn-resume-v312"); } catch {} window.paintContinue(); return { door: !!document.getElementById("continue-queue"), card: !!document.getElementById("continue-btn") }; });
    ok(single.q === 0 && single.rows === 0 && single.text.includes("No queue")
      && endedSheet === false && noCard.door === false && noCard.card === false,
      `L11 states: single play shows the single-prayer line with zero rows; a queue played to its end removes the sheet (no stale rows); the See queue door is absent when the Continue card is absent (single="${single.text.trim().slice(0, 50)}", singleQ=${single.q}, singleRows=${single.rows}, endedSheet=${endedSheet}, door=${noCard.door}, card=${noCard.card})`);

    // ---- L12 · SW pin + shell ----
    const sw = (await api(BASE, "GET", "/sw.js")).text;
    ok(sw.includes("ora-pro-nobis-v347-1") && sw.includes("/logo-512.png"),
      "L12 SW pin + shell: the served service worker carries CACHE 'ora-pro-nobis-v347-1' and its SHELL still includes /logo-512.png");

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
