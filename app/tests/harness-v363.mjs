// harness-v363 — the v363 gate (Plan §2.7): the uniform 76px
// row height. Every track row — own, external, intention
// (collapsed), unavailable, placeholder — measures exactly
// 76px at 360px and 640px; the no-clip guard (scrollHeight <=
// clientHeight + descendant-rect containment) replaces trust
// (the v343 lesson: its uniform 136px was overflowed by the
// novena meta standing 144px, caught only by the tallest
// fixture). Fixtures F1-F9 stand at TALLEST content and are
// rendered by the served client's OWN emit functions
// (trackCard / intentionRowCard / the placeholder cards /
// renderQueueList) inside the live app, so the real CSS and
// the real composition rules measure. F1 = novena long-title
// + full meta (span before duration, §2.4) + Read + Spotify —
// the cluster's worst case (Plan concern 1: 4px of computed
// slack; check 2 is the proof, and a real overflow returns
// the release to Plan, never a quiet padding change).
// Checks are numbered as Plan §2.7 numbers them (1-13).
// Fixture posture: the standing estate mold (v343/v360/v361)
// — local feed + HTTPS site servers, the presented day built
// by the shipped client from fixture feeds, the draw
// re-pointed to calibrated intention texts, the fixture
// migration set running the FULL sequence through 0015
// (v363 carries NO migration; 0016 stays unclaimed).
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
const PORT = 8997, FEED_PORT = 8957, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v363");
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
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v363-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    // ============ candidate app: FULL migrations through 0015 ====
    const migs = migFiles(APP);
    ok(migs.some((f) => path.basename(f).startsWith("0015")) && !migs.some((f) => path.basename(f).startsWith("0016")),
      "fixture: the migration set runs through 0015 and NO 0016 stands (v363 carries no migration)");
    applyFiles(APP, PERSIST, migs, seedSql());
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    for (const [itemId, intentionId] of Object.entries(REPOINT)) {
      d1q(APP, PERSIST, `UPDATE prayer_draws SET intention_id = ${intentionId} WHERE date = '${TODAY}' AND item_id = ${itemId};`);
    }
    for (const p of procs.splice(0)) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
    for (let i = 0; i < 15; i++) { try { await fetch(BASE + "/"); } catch { break; } await sleep(1000); }
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "setup: candidate app re-boots after the draw re-point");

    // ============ served build ===================================
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "served build: the served /app.js parses (vm.Script)");
    const uiCss = (await api(BASE, "GET", "/styles.css")).text;
    ok(uiCss.includes(".card.trow") && uiCss.includes("height:76px") && uiCss.includes(".trow-tail") && !uiCss.includes(".notavail {"),
      "served build: the served stylesheet carries .card.trow at 76px + .trow-tail, and the .notavail rule is retired");
    const swJs = (await api(BASE, "GET", "/sw.js")).text;
    ok(swJs.includes('var CACHE = "ora-pro-nobis-v363-1";') && swJs.includes('k !== CACHE && k !== "opn-ext-audio-v1"'),
      "check 13: the served service worker carries the new pin ora-pro-nobis-v363-1 with the opn-ext-audio-v1 purge exemption verbatim");

    // ============ browser (360px first — the phone width) ========
    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    browser = await chromium.launch({
      executablePath: CHROME, env: browserEnv,
      args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server", "--autoplay-policy=no-user-gesture-required",
        "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
    });
    const ctx = await browser.newContext({ viewport: { width: 360, height: 844 } });
    await wireContext(ctx);
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const stopQ = () => ev(() => {
      const a = document.getElementById("audio"); if (a) a.pause();
      window.state.queue = []; window.state.queueIdx = -1; window.state.current = null; window.state.previewQueue = null;
      document.querySelectorAll(".np-sheet, .readsheet").forEach((s) => s.remove());
    });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const boot = await waitReady(page);
    ok(boot.ready, `boot: the fixture pass reaches readiness (own settled + descriptors + intros) in ${boot.ms} ms`);
    await waitExtSettled(page);

    // ============ fixtures F1-F7, rendered by the client's own ===
    // emit functions inside the live view (real CSS, real
    // composition), at TALLEST content.
    const fxIds = await ev((args) => {
      const { feed, today, tLong, tShort } = args;
      const view = document.getElementById("view");
      const fx = document.createElement("div");
      fx.id = "fx363";
      const F1 = { episodeId: "novena-st-jude", title: "Novena to Saint Jude Thaddeus, Patron Saint of Hopeless and Despaired Causes — Day 5", available: true, streamUrl: feed + "/audio/f1.mp3", durationS: 754, spotifyUrl: "https://open.spotify.com/episode/fixture1", hasText: true, textUrl: "/api/player/text/" + today + "/novena-st-jude", _block: "Novenas" };
      const F2 = { episodeId: "ext-fx-long", kind: "external", title: "A Very Long External Episode Title That Certainly Wraps To A Second Line At Phone Width", available: true, streamUrl: feed + "/audio/f2.mp3", source: "Fixture Source", durationS: 1830, _block: "Morning" };
      const F4 = { episodeId: "fx-own-notext", title: "Fixture Prayer Without Text", available: true, streamUrl: feed + "/audio/f4.mp3", durationS: 245, spotifyUrl: "https://open.spotify.com/episode/fixture4", hasText: false, textUrl: null, _block: "Morning" };
      const F5 = { episodeId: "fx-own-unavail", title: "Fixture Prayer Unavailable Today", available: false, durationS: 372, spotifyUrl: "https://open.spotify.com/episode/fixture5", hasText: true, textUrl: "/api/player/text/" + today + "/fx-own-unavail", _block: "Morning" };
      const F6 = { episodeId: "ext-fx-unavail", kind: "external", title: "Fixture External Unavailable", available: false, durationS: 599, _block: "Morning" };
      window.state.readTracks = window.state.readTracks || {};
      window.state.readTracks["novena-st-jude"] = F1;
      window.state.readTracks["fx-own-unavail"] = F5;
      fx.innerHTML = [
        window.trackCard(F1),
        window.trackCard(F2),
        window.intentionRowCard({ episodeId: "fx-prayer-long", title: "Fixture Prayer of the Long Intention" }, { text: tLong, title: "Fixture" }),
        window.intentionRowCard({ episodeId: "fx-prayer-short", title: "Fixture Prayer of the Short Intention" }, { text: tShort, title: "Fixture" }),
        window.trackCard(F4),
        window.trackCard(F5),
        window.trackCard(F6),
        window.ownPlaceholderCard({ episodeId: "fx-ph-own", title: "Fixture Own Loading" }),
        window.extPlaceholderCard({ slotId: "ext-fx-ph", title: "Fixture External Loading" }),
        window.extDownloadingCard({ slotId: "ext-fx-dl", title: "Fixture External Downloading" }),
      ].join("");
      view.appendChild(fx);
      fx.querySelectorAll(".card.intention-row").forEach((c) => window.armEllipsis(c));
      window.wireExpand(fx);
      window.wirePrayersView(window.state.dayPayload);
      return Array.from(fx.querySelectorAll("[data-card]")).map((c) => c.getAttribute("data-card"));
    }, { feed: FEED, today: TODAY, tLong: T_LONG, tShort: T_SHORT });
    // 11 cards, not 10: trackCard(F1) ALSO prepends its intro
    // row — the real fixture day carries an intro descriptor
    // for novena-st-jude, so F1 stands as a pair (its intro
    // card measures 76 like every other, checks 1/2 read it).
    ok(fxIds.length === 11 && fxIds[0] === "intro:novena-st-jude", `fixtures: F1-F7 stand rendered by the client's own emit functions — F1 as a pair with its real intro row (cards=${JSON.stringify(fxIds)})`);

    const measureFx = () => ev(() => Array.from(document.querySelectorAll("#fx363 [data-card]")).map((c) => {
      const cr = c.getBoundingClientRect();
      let contained = true, worst = "";
      c.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height === 0 && r.width === 0) return;
        if (r.top < cr.top - 1 || r.bottom > cr.bottom + 1 || r.left < cr.left - 1 || r.right > cr.right + 1) {
          // horizontal overflow inside a nowrap ellipsis line is
          // the DESIGNED clip (the text box itself is clipped by
          // the .meta/h3 box) — only vertical escape and escape
          // past the card's own frame count as a clip failure.
          const cs = getComputedStyle(el);
          if (r.top < cr.top - 1 || r.bottom > cr.bottom + 1) { contained = false; worst = el.className + " v:" + Math.round(r.top - cr.top) + "/" + Math.round(r.bottom - cr.bottom); }
          if ((r.left < cr.left - 1 || r.right > cr.right + 1) && cs.whiteSpace !== "nowrap") { contained = false; worst = el.className + " h"; }
        }
      });
      return { id: c.getAttribute("data-card"), h: c.offsetHeight, sh: c.scrollHeight, ch: c.clientHeight, contained, worst };
    }));

    // ---- checks 1 + 2 at 360px -----------------------------------
    const m360 = await measureFx();
    ok(m360.length === 11 && m360.every((m) => m.h === 76),
      `check 1 (360px): every F1-F7 list card measures exactly 76px (=${JSON.stringify(m360.map((m) => m.id + ":" + m.h))})`);
    ok(m360.every((m) => m.sh <= m.ch && m.contained),
      `check 2 (360px): no-clip guard — every fixture card scrollHeight <= clientHeight and no descendant escapes the card's frame vertically (=${JSON.stringify(m360.map((m) => m.id + ":" + m.sh + "<=" + m.ch + ":" + m.contained + m.worst))})`);

    // ---- check 3: ellipsis computed style + one-line title -------
    const c3 = await ev(() => {
      const card = document.querySelector('#fx363 [data-card="ext-fx-long"]');
      const h3 = card.querySelector("h3"), meta = card.querySelector(".meta");
      const hs = getComputedStyle(h3), ms = getComputedStyle(meta);
      return { hWs: hs.whiteSpace, hTe: hs.textOverflow, mWs: ms.whiteSpace, mTe: ms.textOverflow, hH: h3.offsetHeight, hSW: h3.scrollWidth, hCW: h3.clientWidth };
    });
    ok(c3.hWs === "nowrap" && c3.hTe === "ellipsis" && c3.mWs === "nowrap" && c3.mTe === "ellipsis" && c3.hH <= 26 && c3.hSW > c3.hCW,
      `check 3: titles and metas carry nowrap + ellipsis and F2's long title renders on ONE line with the ellipsis engaged (=${JSON.stringify(c3)})`);

    // ---- check 4: the novena span under the reorder --------------
    const c4 = await ev(() => {
      const card = document.querySelector('#fx363 [data-card="novena-st-jude"]');
      const span = card.querySelector("[data-novline]");
      const meta = card.querySelector(".meta");
      if (!span || !meta) return { missing: true };
      const sr = span.getBoundingClientRect(), mr = meta.getBoundingClientRect(), cr = card.getBoundingClientRect();
      return { missing: false, spanLeft: Math.round(sr.left), spanRight: Math.round(sr.right), metaLeft: Math.round(mr.left), metaRight: Math.round(mr.right),
        visible: Math.round(Math.min(sr.right, mr.right) - sr.left), metaText: meta.textContent, contentRight: Math.round(cr.right - 15) };
    });
    ok(!c4.missing && c4.spanLeft >= c4.metaLeft - 1 && c4.spanLeft < c4.metaRight && c4.visible >= 30 && c4.metaText.indexOf("Day 5 of 9") < c4.metaText.indexOf("12:34"),
      `check 4 (360px): F1's novena span stands BEFORE the duration and renders visibly inside the meta box — the pinned line is NOT the clipped tail (span=${c4.spanLeft}..${c4.spanRight}, meta=${c4.metaLeft}..${c4.metaRight}, visible=${c4.visible}px, meta=${JSON.stringify(c4.metaText)})`);

    // ---- check 5: intention arming at the one-line clamp ---------
    const c5 = await ev(() => {
      const long = document.querySelector('#fx363 [data-card="intro:fx-prayer-long"]');
      const short = document.querySelector('#fx363 [data-card="intro:fx-prayer-short"]');
      const lb = long.querySelector(".ellipsis-btn"), sb = short.querySelector(".ellipsis-btn");
      const lt = long.querySelector(".intention-text");
      return { longH: long.offsetHeight, shortH: short.offsetHeight, longStands: lb.classList.contains("stands"), shortStands: sb.classList.contains("stands"),
        btnBox: [lb.offsetWidth, lb.offsetHeight], txtSH: lt.scrollHeight, txtCH: lt.clientHeight, btnParent: lb.parentElement.className };
    });
    ok(c5.longH === 76 && c5.shortH === 76 && c5.longStands === true && c5.shortStands === false && JSON.stringify(c5.btnBox) === "[30,44]" && c5.btnParent === "row",
      `check 5: collapsed intention rows measure 76px; the ⋯ (a 30x44 flex child of the .row, not of .grow) stands for the long text and does NOT stand for the short one-line text (=${JSON.stringify(c5)})`);

    // ---- check 7: Read wiring from the tail ----------------------
    const c7a = await ev(() => {
      const f1 = document.querySelector('#fx363 [data-card="novena-st-jude"] [data-read]');
      const f5 = document.querySelector('#fx363 [data-card="fx-own-unavail"] [data-read]');
      return { f1: !!f1 && f1.getAttribute("data-read"), f1Tail: !!f1 && !!f1.closest(".trow-tail"), f5: !!f5 && f5.getAttribute("data-read"), f5Tail: !!f5 && !!f5.closest(".trow-tail") };
    });
    await ev(() => { const b = document.querySelector('#fx363 [data-card="novena-st-jude"] [data-read]'); if (b) b.click(); });
    await sleep(400);
    const c7b = await ev(() => !!document.querySelector(".readsheet"));
    ok(c7a.f1 === "novena-st-jude" && c7a.f1Tail && c7a.f5 === "fx-own-unavail" && c7a.f5Tail && c7b,
      `check 7: F1 and F5 carry the Read button in the .trow-tail with data-read intact, and a click on F1's opens the Read sheet (=${JSON.stringify(c7a)}, sheet=${c7b})`);
    await ev(() => { const b = document.querySelector("[data-readclose]"); if (b) b.click(); });

    // ---- check 8: Spotify wiring in the tail ---------------------
    const c8 = await ev(() => {
      const grab = (id) => { const a = document.querySelector('#fx363 [data-card="' + id + '"] .trow-tail a.spot'); return a ? { href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel"), inGrow: !!a.closest(".grow") } : null; };
      return { f1: grab("novena-st-jude"), f4: grab("fx-own-notext"), f5: grab("fx-own-unavail") };
    });
    ok(!!c8.f1 && !!c8.f4 && !!c8.f5 && [c8.f1, c8.f4, c8.f5].every((a) => a.target === "_blank" && a.rel === "noopener" && a.href.startsWith("https://open.spotify.com/episode/") && !a.inGrow),
      `check 8: the F1/F4/F5 Spotify links stand in the tail (never in .grow) with href, target and rel intact (=${JSON.stringify(c8)})`);

    // ---- check 9: the fold ---------------------------------------
    const c9 = await ev(() => {
      const meta = (id) => { const m = document.querySelector('#fx363 [data-card="' + id + '"] .meta'); return m ? m.textContent : ""; };
      return { f4: meta("fx-own-notext"), f5: meta("fx-own-unavail"), f6: meta("ext-fx-unavail"), notavail: document.querySelectorAll("#fx363 .notavail").length };
    });
    ok(c9.f4.endsWith("Not available in the app yet") && c9.f5.endsWith("Not available in the app yet") && c9.f6.endsWith("Not available today") && c9.notavail === 0,
      `check 9: 'Not available in the app yet' reads inside F4's and F5's meta lines, 'Not available today' inside F6's, and NO .notavail element exists in any rendered row (=${JSON.stringify(c9)})`);

    // ---- check 6: the expansion round trip ------------------------
    await ev(() => { const b = document.querySelector('#fx363 [data-card="intro:fx-prayer-long"] .ellipsis-btn'); if (b) b.click(); });
    await sleep(250);
    const c6a = await ev(() => {
      const long = document.querySelector('#fx363 [data-card="intro:fx-prayer-long"]');
      const short = document.querySelector('#fx363 [data-card="intro:fx-prayer-short"]');
      const txt = long.querySelector(".intention-text");
      return { h: long.offsetHeight, expanded: long.classList.contains("expanded"), txtSH: txt.scrollHeight, txtCH: txt.clientHeight, shortH: short.offsetHeight, shortExpanded: short.classList.contains("expanded") };
    });
    await ev(() => { const b = document.querySelector('#fx363 [data-card="intro:fx-prayer-long"] .ellipsis-btn'); if (b) b.click(); });
    await sleep(250);
    const c6b = await ev(() => { const long = document.querySelector('#fx363 [data-card="intro:fx-prayer-long"]'); return { h: long.offsetHeight, expanded: long.classList.contains("expanded") }; });
    ok(c6a.h > 76 && c6a.expanded && c6a.txtSH === c6a.txtCH && c6a.shortH === 76 && !c6a.shortExpanded && c6b.h === 76 && !c6b.expanded,
      `check 6: expanding F3-long grows the row past 76px with the full text rendered (h=${c6a.h}, text ${c6a.txtSH}==${c6a.txtCH}); the second intention row is untouched at 76px; collapsing returns the row to EXACTLY 76px (=${JSON.stringify(c6b)})`);

    // ---- checks 1 + 2 + 4 re-measured at 640px --------------------
    await page.setViewportSize({ width: 640, height: 844 });
    await sleep(300);
    const m640 = await measureFx();
    const c4b = await ev(() => {
      const card = document.querySelector('#fx363 [data-card="novena-st-jude"]');
      const span = card.querySelector("[data-novline]"); const meta = card.querySelector(".meta");
      const sr = span.getBoundingClientRect(), mr = meta.getBoundingClientRect();
      return { spanRight: Math.round(sr.right), metaRight: Math.round(mr.right), fullMeta: meta.textContent };
    });
    ok(m640.length === 11 && m640.every((m) => m.h === 76) && m640.every((m) => m.sh <= m.ch && m.contained),
      `check 1+2 (640px): every F1-F7 card still measures exactly 76px with the no-clip guard green at the wide width (=${JSON.stringify(m640.map((m) => m.id + ":" + m.h + ":" + m.sh + "<=" + m.ch))})`);
    ok(c4b.spanRight <= c4b.metaRight + 1 && c4b.fullMeta.includes("12:34"),
      `check 4 (640px): at the wide width F1's full novena span AND the duration stand inside the meta — nothing clips (spanRight=${c4b.spanRight}, metaRight=${c4b.metaRight})`);
    await page.setViewportSize({ width: 360, height: 844 });
    await sleep(300);

    // ---- check 10: queue rows --------------------------------------
    const c10 = await ev(() => {
      const ds = window.state.dayDescs || [];
      const prayer = ds.find((x) => x.episodeId === "daily-rosary");
      const intro = ds.find((x) => x.episodeId === "intro:daily-rosary");
      const mp = ds.find((x) => x.episodeId === "morning-prayer");
      const longRow = { ...mp, title: "A Very Long Queue Title That Wraps Beyond One Line At Phone Width For Certain" };
      const unavail = { ...prayer, episodeId: "fx-queue-unavail", title: "Fixture Queue Unavailable", available: false };
      window.state.previewQueue = [intro, longRow, unavail];
      window.state.queuePreviewIdx = 1;
      window.openQueuePreview();
      const rows = Array.from(document.querySelectorAll(".npq-row")).map((r) => ({
        h: r.offsetHeight, sh: r.scrollHeight, ch: r.clientHeight,
        meta: (r.querySelector(".npq-meta") || {}).textContent || "",
        start: r.classList.contains("npq-start"), disabled: r.disabled, title: (r.querySelector(".npq-title") || {}).textContent || "",
      }));
      return rows;
    });
    await sleep(200);
    ok(c10.length === 3 && c10.every((r) => r.h === 76 && r.sh <= r.ch) && c10[1].start && c10[1].meta.includes("Starts here") && c10[2].disabled === true,
      `check 10: every queue row measures exactly 76px with the no-clip guard green; the preview start row's meta contains 'Starts here' inside the 76px; the unavailable queue row stands disabled (=${JSON.stringify(c10)})`);
    await stopQ();

    // ---- integration: real block pages measure 76 (check 1, live) -
    await ev(() => { const fx = document.getElementById("fx363"); if (fx) fx.remove(); window.openBlockPage("Morning"); });
    await sleep(500);
    const realMorning = await ev(() => Array.from(document.querySelectorAll("#view .card.trow")).map((c) => c.offsetHeight));
    await ev(() => window.openBlockPage("Novenas"));
    await sleep(500);
    const realNovenas = await ev(() => Array.from(document.querySelectorAll("#view .card.trow")).map((c) => c.offsetHeight));
    ok(realMorning.length >= 5 && realMorning.every((h) => h === 76) && realNovenas.length >= 2 && realNovenas.every((h) => h === 76),
      `check 1 (live pages): every standing .card.trow on the real Morning page (${realMorning.length} cards) and Novenas page (${realNovenas.length} cards) measures exactly 76px (morning=${JSON.stringify(realMorning)}, novenas=${JSON.stringify(realNovenas)})`);

    // ---- check 11: played state ------------------------------------
    await ev(() => window.openBlockPage("Morning"));
    await sleep(400);
    const c11a = await ev(() => { const c = document.querySelector('[data-card="daily-rosary"]'); return { h: c.offsetHeight, on: !!c.querySelector(".played-dot.on") }; });
    await ev(() => { window.writePlayedQuiet("daily-rosary", window.state.presentedDay, "played", "Morning"); window.refreshPlayedChrome(); });
    await sleep(200);
    const c11b = await ev(() => {
      const c = document.querySelector('[data-card="daily-rosary"]');
      const dot = c.querySelector(".played-dot");
      const h3 = c.querySelector("h3");
      const pb = c.querySelector("[data-playkey]");
      const keys = Array.from(document.querySelectorAll("#fx363 [data-playkey], #view [data-card] [data-playkey]")).length;
      return { h: c.offsetHeight, on: !!c.querySelector(".played-dot.on"), dotStands: !!dot, heard: h3.classList.contains("heard"), key: pb ? pb.getAttribute("data-playkey") : null, keys };
    });
    ok(c11a.h === 76 && c11b.h === 76 && c11b.on && c11b.dotStands && c11b.heard && c11b.key === "daily-rosary",
      `check 11: the played dot stands .on with the heard title class after a mark, the row measures 76px before AND after the toggle, and data-playkey wiring is intact (before=${JSON.stringify(c11a)}, after=${JSON.stringify(c11b)})`);

    // ---- check 12: the trow scope guard ----------------------------
    // The v360 L7 order (v361 L10's mold): stand on the Listen
    // home FIRST, then write the mark — refreshPlayedChrome
    // re-paints the Continue card in place on the standing
    // home. (The rosary mark from check 11 already stands;
    // the write is idempotent.)
    await ev(() => window.goListenHome());
    await sleep(500);
    await ev(() => { window.writePlayedQuiet("daily-rosary", window.state.presentedDay, "played", "Morning"); window.refreshPlayedChrome(); });
    await sleep(400);
    const c12a = await ev(() => {
      const slot = document.getElementById("continue-slot");
      const card = slot ? slot.querySelector(".card") : null;
      return card ? { h: card.offsetHeight, trow: card.classList.contains("trow"), title: card.querySelector("h3") ? card.querySelector("h3").textContent : "" } : { missing: true };
    });
    await ev(() => { const g = document.getElementById("gearbtn"); if (g) g.click(); });
    await sleep(500);
    const c12b = await ev(() => {
      const cards = Array.from(document.querySelectorAll("#view .card"));
      const pin = cards.find((c) => c.querySelector("#pin-set-open, #pin-change-open, #pin-enter-open")) || null;
      return { total: cards.length, trowCount: cards.filter((c) => c.classList.contains("trow")).length,
        pin: pin ? { h: pin.offsetHeight, trow: pin.classList.contains("trow") } : null };
    });
    ok(!!c12a && !c12a.missing && c12a.title === "Continue" && !c12a.trow && c12a.h !== 76 && !!c12b.pin && !c12b.pin.trow && c12b.pin.h !== 76 && c12b.trowCount === 0,
      `check 12: non-row cards keep their NATURAL heights — the Continue card (${JSON.stringify(c12a)}) and a Settings PIN card (${JSON.stringify(c12b.pin)}) measure NOT 76px and carry no .trow; no card on the Settings view carries .trow at all (settingsCards=${c12b.total})`);

    ok(pageErrors.length === 0, `browser: no page errors across the v363 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);
    await page.close(); await ctx.close();
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v363: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
