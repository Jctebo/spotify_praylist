#!/usr/bin/env node
// harness-v355 — the v355 gate (Plan §2.10 legs L1-L10, with L3/L5/
// L6/L8 re-pointed by Amendment A1): the queue snapshot — one
// device-local record (opn-queue-v355) written at the five §2.2
// triggers, restored at RESTORE-READINESS (A1: Moment 1 boot flag/
// date check before resolveExternals; Moment 2 the restore proper
// when every own row stands settled and the intentions map has
// landed), standing PAUSED at the stored position, Continue
// suppressed while the restored queue stands, the sleep timer
// never persisted. Fixture posture: the standing estate mold
// (v344/v347/v348/v351) — local feed + HTTPS site servers, the
// presented day built by the shipped client from fixture feeds,
// the fixture migration set running the FULL sequence through
// 0015 (the v352 §4 fixture-cap lesson). Scratch wrangler inside
// the worktree, synthetic fixture only, tallies from the
// COMPLETE log.
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v355 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8995, FEED_PORT = 8955, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v355");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v355-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");
const NOVENAS_PLAYLIST = "2hclGC0JlP4tC51uohete6";
const QKEY = "opn-queue-v355";

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

// ---- fixture feeds (the v344/v348 presented-day set) -----------
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

async function wireContext(ctx) {
  await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
  await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
  await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
  await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: BIAY_XML }));
  await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: TONE_16 }));
  // Fixture augmentation (the v351 mold): ONE unblocked podcast
  // episode in the shell payload — the single-play boundary vehicle.
  await ctx.route(BASE + "/api/player/day", async (route) => {
    const resp = await route.fetch();
    const json = await resp.json();
    json.episodes = [{ episodeId: "podcast-ep-1", title: "Fixture Podcast Episode", available: true, streamUrl: `${FEED}/audio/x-daily-rosary-x.mp3`, durationS: 30, kind: "episode" }];
    await route.fulfill({ response: resp, json });
  });
}

// Readiness (A1): the pass stands ready when every own row stands
// settled AND the core descriptors stand available with intros.
async function waitReady(page, timeout = 45000) {
  const t0 = Date.now();
  const r = await page.waitForFunction(() => {
    const st = window.state;
    if (!st || !st.dayPayload || !st.ownStanding || !st.ownStanding.length) return false;
    const ownOk = st.ownStanding.every((row) => { const s = st.ownSlots[row.sourceKey]; return s && (s.state === "present" || s.state === "missing"); });
    if (!ownOk) return false;
    const ds = st.dayDescs || [];
    const need = ["daily-rosary", "morning-prayer", "marian-antiphon-angelus", "auxilium-christianorum", "podcast-ep-1"];
    return need.every((id) => ds.some((x) => x.episodeId === id && x.available)) && ds.some((x) => x.episodeId === "intro:daily-rosary");
  }, null, { timeout }).then(() => true).catch(() => false);
  return { ready: r, ms: Date.now() - t0 };
}
async function waitRestored(page, timeout = 20000) {
  return page.waitForFunction(() => {
    const st = window.state;
    return st && st.restoredQueue === true && st.queue.length > 0 && !!st.current;
  }, null, { timeout }).then(() => true).catch(() => false);
}

async function main() {
  let browser = null;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v355-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    // ============ candidate app: the FULL migration sequence ===
    // through 0015 (§2.10's fixture set), seed after ==============
    const migs = migFiles(APP);
    ok(migs.some((f) => path.basename(f).startsWith("0015")), "fixture: migration 0015 stands in the tree (the fixture set runs through it)");
    applyFiles(APP, PERSIST, migs, seedSql());
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");
    const swJs = (await api(BASE, "GET", "/sw.js")).text;
    ok(swJs.includes("ora-pro-nobis-v355-1"), "SW pin: the served service worker carries CACHE 'ora-pro-nobis-v355-1'");

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
    const q = () => ev(() => ({
      q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
      cur: window.state.current ? window.state.current.episodeId : null,
      paused: document.getElementById("audio").paused,
      flag: window.state.restoredQueue, sleep: window.state.sleep.mode,
      ct: document.getElementById("audio").currentTime,
      dockHidden: document.getElementById("dock").classList.contains("hidden"),
    }));
    const rec = () => ev((k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return "parse-error"; } }, QKEY);
    const setRec = (r) => ev((x) => localStorage.setItem("opn-queue-v355", JSON.stringify(x)), r);
    const seedPlayed = (ids) => ev((list) => {
      const map = {}; const t = window.state.presentedDay;
      list.forEach((id) => { map[id] = { [t]: { playedAt: new Date().toISOString(), via: "played" } }; });
      localStorage.setItem("opn-played-v344", JSON.stringify(map));
      window.state.playedCache = null;
    }, ids);
    const clearPlayed = () => ev(() => { localStorage.removeItem("opn-played-v344"); window.state.playedCache = null; });
    const stopQ = () => ev(() => {
      const a = document.getElementById("audio"); if (a) a.pause();
      window.state.queue = []; window.state.queueIdx = -1; window.state.current = null;
      document.querySelectorAll(".np-sheet, .readsheet").forEach((s) => s.remove());
    });
    const wipe = async () => {
      await stopQ();
      await ev(() => { localStorage.removeItem("opn-queue-v355"); localStorage.removeItem("opn-resume-v312"); });
      await clearPlayed();
    };
    const tapBtn = (cardId, key) => ev(({ c, k }) => {
      const card = document.querySelector('[data-card="' + c + '"]');
      if (!card) return "no-card";
      const btn = card.querySelector('[data-playkey="' + k + '"]');
      if (!btn) return "no-btn";
      btn.click(); return "ok";
    }, { c: cardId, k: key || cardId });

    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const boot = await waitReady(page);
    ok(boot.ready, `boot: the fixture pass reaches readiness (own settled + descriptors + intros) in ${boot.ms} ms`);

    // ---- L10 · no-record boot is today's boot --------------------
    const s10 = await q();
    const slot10 = await ev(() => document.getElementById("continue-slot").innerHTML);
    ok(s10.q.length === 0 && s10.cur === null && s10.dockHidden === true && s10.flag === false && slot10 === "" && (await rec()) === null,
      `L10 no-record boot: no queue, no current, dock hidden, flag down, Continue slot empty under its standing gate, no record written (q=${JSON.stringify(s10.q)}, cur=${s10.cur})`);

    // ---- L1 · write-on-build --------------------------------------
    await ev(() => document.getElementById("play-all").click());
    await sleep(500);
    const s1 = await q(); const r1 = await rec();
    ok(!!r1 && r1.v === 1 && r1.date === TODAY && eq(r1.ids, s1.q) && r1.idx === s1.idx && r1.currentId === s1.cur && s1.q.length > 5,
      `L1a Play All writes: the record's ids/idx/currentId match the standing queue exactly, v=1, dated the presented day (n=${s1.q.length}, cur=${s1.cur})`);
    await wipe();
    const t1 = await tapBtn("daily-rosary");
    await sleep(500);
    const s1b = await q(); const r1b = await rec();
    ok(t1 === "ok" && !!r1b && eq(r1b.ids, s1b.q) && r1b.idx === s1b.idx && r1b.currentId === s1b.cur && s1b.q[0] === "intro:daily-rosary",
      `L1b card-tap writes: the v351 tap's queue is snapshotted at birth, pair first (tap=${t1}, q=${JSON.stringify(s1b.q)})`);

    // ---- L2 · write-on-move ---------------------------------------
    await wipe();
    await ev(() => document.getElementById("play-all").click());
    await sleep(500);
    await ev(() => document.getElementById("dock-next").click());
    await sleep(400);
    const s2a = await q(); const r2a = await rec();
    ok(!!r2a && r2a.idx === s2a.idx && r2a.currentId === s2a.cur && eq(r2a.ids, s2a.q),
      `L2a advance follows: dock-next moves the record's idx/currentId with the queue (idx=${s2a.idx}, cur=${s2a.cur})`);
    await ev(() => window.openNowPlaying());
    await sleep(250);
    await ev(() => { const r = document.querySelector('[data-npq-index="2"]'); if (r) r.click(); });
    await sleep(400);
    const s2b = await q(); const r2b = await rec();
    ok(s2b.idx === 2 && !!r2b && r2b.idx === 2 && r2b.currentId === s2b.cur && eq(r2b.ids, s2b.q),
      `L2b jump follows: a queue-row jump to index 2 rewrites the record at the new index (cur=${s2b.cur})`);
    await ev(() => { document.querySelectorAll(".np-sheet").forEach((s) => s.remove()); });
    // pause writes the live position — a single-track queue on the
    // 30-second rosary tone for a stable seek target.
    await wipe();
    await ev(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "daily-rosary");
      window.startQueue([d]);
    });
    await sleep(600);
    await ev(() => { const a = document.getElementById("audio"); a.currentTime = 5.2; });
    await sleep(350);
    await ev(() => document.getElementById("dock-play").click()); // pause (queue stands -> the dock's pause path)
    await sleep(300);
    const r2c = await rec();
    ok(!!r2c && r2c.currentId === "daily-rosary" && Math.abs((r2c.positionS || 0) - 5.2) < 1.0,
      `L2c pause writes position: the record stands at the paused position (positionS=${r2c && r2c.positionS}, seeked 5.2)`);
    await ev(() => document.getElementById("dock-play").click()); // resume through the queue-preserving seam
    await sleep(6800);
    const r2d = await rec();
    ok(!!r2d && (r2d.positionS || 0) > 3.5,
      `L2d throttle writes: ~7 s of uninterrupted play refreshes the stored position past the 5 s tick (positionS=${r2d && r2d.positionS})`);
    await ev(() => document.getElementById("audio").pause());
    await sleep(200);

    // ---- L9 · the timer is never in the record; off after restore -
    const r9 = await rec();
    const keys9 = r9 ? Object.keys(r9).sort() : [];
    await ev(() => document.getElementById("sleep-btn").click());
    await sleep(300);
    await ev(() => { const b = document.querySelector('[data-sleep-choice="track"]'); if (b) b.click(); });
    await sleep(250);
    const s9a = await q();
    ok(!!r9 && eq(keys9, ["currentId", "date", "ids", "idx", "positionS", "savedAt", "v"]) && s9a.sleep === "track",
      `L9a schema: the record carries exactly the seven §2.1 fields — no timer field of any name (keys=${JSON.stringify(keys9)}); the timer arms against the standing queue (mode=${s9a.sleep})`);
    await page.reload({ waitUntil: "domcontentloaded" });
    const ok9 = await waitRestored(page);
    await waitReady(page);
    const s9b = await q();
    ok(ok9 && s9b.sleep === "off" && s9b.cur === "daily-rosary" && s9b.paused === true,
      `L9b timer off (decision 7): after a discard + restore the sleep state is OFF though it stood armed at the snapshot (mode=${s9b.sleep}, cur=${s9b.cur})`);
    await wipe();

    // ---- L3 · discard survival (drives to READINESS, per A1(d)) ---
    // Vehicle: the Marian Antiphon tap — the block's LAST entry, so
    // the queue is own-family only ([intro, antiphon]): both
    // descriptors stand at readiness BY A1's definition (own
    // settled + intros landed), which makes the restored-order
    // assertion exact. (An ext slot mid-download at readiness
    // stands in the queue without its intro — the live-queue rule —
    // so a mixed-family record cannot promise byte-equality here.)
    await clearPlayed();
    const t3 = await tapBtn("marian-antiphon-angelus");
    await sleep(600);
    await ev(() => document.getElementById("dock-next").click()); // past the 1 s intro, onto the antiphon
    await sleep(500);
    await ev(() => { const a = document.getElementById("audio"); a.currentTime = 12.0; });
    await sleep(350);
    await ev(() => document.getElementById("dock-play").click()); // pause — trigger 3 writes the leave-taking record
    await sleep(300);
    const r3 = await rec(); const s3pre = await q();
    ok(t3 === "ok" && !!r3 && s3pre.cur === "marian-antiphon-angelus" && Math.abs((r3.positionS || 0) - 12.0) < 1.5,
      `L3 setup: the leave-taking record stands on the antiphon at ~12 s (positionS=${r3 && r3.positionS}, ids=${r3 && r3.ids.length})`);
    await page.reload({ waitUntil: "domcontentloaded" });
    const ok3 = await waitRestored(page);
    await waitReady(page);
    await sleep(700);
    const s3 = await q();
    ok(ok3 && eq(s3.q, r3.ids) && s3.cur === r3.currentId && s3.idx === r3.idx && s3.paused === true
      && s3.dockHidden === false && Math.abs(s3.ct - (r3.positionS || 0)) < 1.5,
      `L3 discard survival: a full reload restores the queue in stored order, PAUSED, dock standing, at the stored position (cur=${s3.cur}, ct=${s3.ct.toFixed(2)} vs ${r3 && r3.positionS}, paused=${s3.paused})`);
    await wipe();

    // ---- L4 · position clamp: never consume the restored track ----
    // Planted-record legs boot a FRESH page (the L6a pattern): a
    // same-page reload fires pagehide on the old page first, whose
    // snapshot write — its queue wiped by the harness — would
    // remove the planted record before Moment 1 could read it.
    // That removal is the product working (§2.5); the fresh-page
    // boot isolates the boot path under test.
    const qOf = (pg) => () => pg.evaluate(() => ({
      q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
      cur: window.state.current ? window.state.current.episodeId : null,
      paused: document.getElementById("audio").paused,
      flag: window.state.restoredQueue, ct: document.getElementById("audio").currentTime,
    }));
    const plantAndBoot = async (record) => {
      if (record) await setRec(record);
      const pg = await ctx.newPage();
      await pg.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      return pg;
    };
    const page4 = await plantAndBoot({ v: 1, date: TODAY, ids: ["intro:daily-rosary", "daily-rosary", "marian-antiphon-angelus"], idx: 1, currentId: "daily-rosary", positionS: 9999, savedAt: new Date().toISOString() });
    const ok4 = await waitRestored(page4);
    await sleep(900);
    const s4a = await qOf(page4)();
    await sleep(1600);
    const s4b = await qOf(page4)();
    const played4 = await page4.evaluate((t) => { try { const m = JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); return !!(m["daily-rosary"] && m["daily-rosary"][t]); } catch (e) { return "err"; } }, TODAY);
    ok(ok4 && s4a.cur === "daily-rosary" && s4a.idx === 1 && s4a.paused === true && s4a.ct >= 27.5 && s4a.ct < 29.95
      && s4b.cur === "daily-rosary" && s4b.idx === 1 && played4 === false,
      `L4 clamp: a stored position past the end stands clamped one second short (ct=${s4a.ct.toFixed(2)} of a 30 s tone) — no 'ended', no advance, no played mark across 1.6 s (cur=${s4b.cur}, marked=${played4})`);
    await page4.close();
    await wipe();

    // ---- L5 · yesterday's record dies at boot (Moment 1) ----------
    // Fresh-page boot (as L4): on this page nothing but Moment 1
    // can remove the record, so the removal is Moment 1's own.
    await seedPlayed(["morning-prayer"]);
    const page5 = await plantAndBoot({ v: 1, date: YDAY, ids: ["daily-rosary"], idx: 0, currentId: "daily-rosary", positionS: 3, savedAt: new Date().toISOString() });
    await waitReady(page5);
    await sleep(400);
    const s5 = await qOf(page5)();
    const r5 = await page5.evaluate((k) => localStorage.getItem(k), QKEY);
    const cont5 = await page5.evaluate(() => !!document.getElementById("continue-btn"));
    ok(r5 === null && s5.q.length === 0 && s5.flag === false && cont5 === true,
      `L5 yesterday discard: the stale-day record is removed at boot and never restores; Continue paints under its standing rules (record=${JSON.stringify(r5)}, flag=${s5.flag}, card=${cont5})`);
    await page5.close();
    await wipe();

    // ---- L6 · Continue suppression from the first paint + return --
    await seedPlayed(["morning-prayer"]);
    await setRec({ v: 1, date: TODAY, ids: ["intro:daily-reflection", "daily-reflection"], idx: 0, currentId: "intro:daily-reflection", positionS: 0, savedAt: new Date().toISOString() });
    const page2 = await ctx.newPage();
    await page2.addInitScript(() => {
      window.__contSeen = false;
      const watch = () => {
        new MutationObserver(() => { if (document.getElementById("continue-btn")) window.__contSeen = true; })
          .observe(document.documentElement, { childList: true, subtree: true });
      };
      if (document.documentElement) watch(); else document.addEventListener("DOMContentLoaded", watch);
    });
    const p2ev = (fn, arg) => page2.evaluate(fn, arg);
    await page2.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const ok6 = await page2.waitForFunction(() => {
      const st = window.state;
      return st && st.restoredQueue === true && st.queue.length > 0 && !!st.current;
    }, null, { timeout: 20000 }).then(() => true).catch(() => false);
    await sleep(600);
    const seen6 = await p2ev(() => window.__contSeen);
    const slot6 = await p2ev(() => document.getElementById("continue-slot").innerHTML);
    const q6 = await p2ev(() => window.state.queue.map((d) => d.episodeId));
    ok(ok6 && seen6 === false && slot6 === "" && eq(q6, ["intro:daily-reflection", "daily-reflection"]),
      `L6a suppression: with a same-day record standing, the Continue card NEVER paints — not even transiently (MutationObserver across the whole pass) — though the played store would raise it (seen=${seen6}, slot=${JSON.stringify(slot6)}, q=${JSON.stringify(q6)})`);
    await p2ev(() => document.getElementById("dock-play").click()); // one tap resumes the restored queue
    const drained6 = await page2.waitForFunction(() => {
      const st = window.state;
      return st && st.queue.length === 0 && !st.current;
    }, null, { timeout: 25000 }).then(() => true).catch(() => false);
    await sleep(500);
    const r6 = await p2ev((k) => localStorage.getItem(k), QKEY);
    const flag6 = await p2ev(() => window.state.restoredQueue);
    const cont6 = await p2ev(() => !!document.getElementById("continue-btn"));
    ok(drained6 && r6 === null && flag6 === false && cont6 === true,
      `L6b return: the restored queue plays out to its end — the record is removed, the flag drops, and the Continue card returns (drained=${drained6}, record=${JSON.stringify(r6)}, card=${cont6})`);
    await page2.close();
    await wipe();

    // ---- L7 · a different start retires the old record ------------
    const t7a = await tapBtn("daily-rosary");
    await sleep(500);
    const r7a = await rec(); const s7a = await q();
    const t7b = await tapBtn("auxilium-christianorum");
    await sleep(500);
    const r7b = await rec(); const s7b = await q();
    ok(t7a === "ok" && t7b === "ok" && !!r7a && !!r7b && eq(r7a.ids, s7a.q) && eq(r7b.ids, s7b.q) && !eq(r7b.ids, r7a.ids)
      && s7b.q.every((id) => id !== "daily-rosary"),
      `L7a replace: a different block's tap retires the old record — the stored ids are the NEW queue's, never a merge (old n=${r7a && r7a.ids.length}, new q=${JSON.stringify(s7b.q)})`);
    const t7c = await tapBtn("podcast-ep-1");
    await sleep(450);
    const r7c = await rec(); const s7c = await q();
    ok(t7c === "ok" && r7c === null && s7c.q.length === 0 && s7c.cur === "podcast-ep-1",
      `L7b single play: the unblocked card's playTrack leaves NO record — the v312 record's path owns a lone track (record=${JSON.stringify(r7c)}, cur=${s7c.cur})`);
    await wipe();

    // ---- L8 · missing tracks (drives to READINESS, per A1(d)) -----
    const page8a = await plantAndBoot({ v: 1, date: TODAY, ids: ["intro:daily-rosary", "daily-rosary", "bogus-gone-id", "marian-antiphon-angelus"], idx: 1, currentId: "daily-rosary", positionS: 2, savedAt: new Date().toISOString() });
    const ok8a = await waitRestored(page8a);
    await sleep(700);
    const s8a = await qOf(page8a)();
    ok(ok8a && eq(s8a.q, ["intro:daily-rosary", "daily-rosary", "marian-antiphon-angelus"]) && s8a.cur === "daily-rosary" && Math.abs(s8a.ct - 2) < 1.5,
      `L8a dropped id: an id absent from the readiness rebuild drops out, order preserved, the stored current stands at its position (q=${JSON.stringify(s8a.q)}, ct=${s8a.ct.toFixed(2)})`);
    await page8a.close();
    await wipe();
    const page8b = await plantAndBoot({ v: 1, date: TODAY, ids: ["bogus-current", "daily-rosary", "marian-antiphon-angelus"], idx: 0, currentId: "bogus-current", positionS: 9, savedAt: new Date().toISOString() });
    const ok8b = await waitRestored(page8b);
    await sleep(500);
    const s8b = await qOf(page8b)();
    ok(ok8b && eq(s8b.q, ["daily-rosary", "marian-antiphon-angelus"]) && s8b.cur === "daily-rosary" && s8b.idx === 0 && s8b.ct < 1.5 && s8b.paused === true,
      `L8b dropped current: the following survivor stands current at position 0 — the dropped track's 9 s never lands on it (cur=${s8b.cur}, ct=${s8b.ct.toFixed(2)})`);
    await page8b.close();
    await wipe();
    await seedPlayed(["morning-prayer"]);
    const page8c = await plantAndBoot({ v: 1, date: TODAY, ids: ["bogus-1", "bogus-2"], idx: 0, currentId: "bogus-1", positionS: 0, savedAt: new Date().toISOString() });
    await waitReady(page8c);
    await sleep(400);
    const s8c = await qOf(page8c)();
    const r8c = await page8c.evaluate((k) => localStorage.getItem(k), QKEY);
    const cont8 = await page8c.evaluate(() => !!document.getElementById("continue-btn"));
    ok(r8c === null && s8c.q.length === 0 && s8c.flag === false && cont8 === true,
      `L8c all dropped: nothing survives — the record is removed and Continue governs, as if no snapshot had stood (record=${JSON.stringify(r8c)}, card=${cont8})`);
    await page8c.close();
    await wipe();

    // ---- L8d · an unavailable CURRENT keeps its place (ctx B) -----
    // Vehicle: the Bible slot held in 'downloading' across
    // readiness — its enclosure fetch never answers.
    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await wireContext(ctxB);
    await ctxB.route(FEED + "/audio/biay-today.mp3", () => new Promise(() => {}));
    const pageB = await ctxB.newPage();
    const bEv = (fn, arg) => pageB.evaluate(fn, arg);
    await pageB.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await waitReady(pageB);
    await bEv((r) => localStorage.setItem("opn-queue-v355", JSON.stringify(r)),
      { v: 1, date: TODAY, ids: ["ext-bible-in-a-year", "marian-antiphon-angelus"], idx: 0, currentId: "ext-bible-in-a-year", positionS: 7, savedAt: new Date().toISOString() });
    // Fresh-page boot (as L4): a reload of pageB would pagehide it
    // and its empty-queue snapshot write would remove the record.
    const pageB2 = await ctxB.newPage();
    await pageB2.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const ok8d = await pageB2.waitForFunction(() => {
      const st = window.state;
      return st && st.restoredQueue === true && st.queue.length > 0 && !!st.current;
    }, null, { timeout: 20000 }).then(() => true).catch(() => false);
    await sleep(600);
    const s8d = await pageB2.evaluate(() => ({
      q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
      cur: window.state.current ? window.state.current.episodeId : null,
      paused: document.getElementById("audio").paused, ct: document.getElementById("audio").currentTime,
      biayState: window.state.extSlots["ext-bible-in-a-year"] && window.state.extSlots["ext-bible-in-a-year"].state,
    }));
    ok(ok8d && eq(s8d.q, ["ext-bible-in-a-year", "marian-antiphon-angelus"]) && s8d.idx === 1 && s8d.cur === "marian-antiphon-angelus"
      && s8d.paused === true && s8d.ct < 1.5,
      `L8d unavailable current: the still-downloading slot KEEPS its queue place (never dropped at restore) while the current stands on the first available survivor at 0 (slot state=${s8d.biayState}, q=${JSON.stringify(s8d.q)}, idx=${s8d.idx}, cur=${s8d.cur})`);
    await ctxB.close();

    ok(pageErrors.length === 0, `browser: no page errors across the v355 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v355: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
