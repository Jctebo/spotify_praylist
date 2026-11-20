#!/usr/bin/env node
// harness-v360 — the v360 gate (Plan §2.6 legs L1-L13): repeat-aware
// occurrence keying at the v344 played seam. The day build computes
// the REPEAT SET from state.dayDescs; playedKey(episodeId, block)
// returns episodeId|block only for repeat-set ids, bare id
// otherwise. L2+L3 are John's acceptance test verbatim (mark the
// Morning Antiphon -> Midday/Evening stay unplayed; complete the
// Midday Antiphon -> Morning/Evening independent), written
// data-driven over the repeat set. Changeover A: no store bump, the
// bare Antiphon entry is never read again. Snapshot v2: blocks[]
// parallel to ids[] + currentBlock, pair restore, v1 fallback.
// Fixture posture: the standing estate mold (v344/v347/v348/v351/
// v355) — local feed + HTTPS site servers, the presented day built
// by the shipped client from fixture feeds, the fixture migration
// set running the FULL sequence through 0015. Scratch wrangler
// inside the worktree, synthetic fixture only, tallies from the
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v360 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8995, FEED_PORT = 8955, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v360");
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
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v360-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
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
    ok(swJs.includes("ora-pro-nobis-v360-1"), "SW pin: the served service worker carries CACHE 'ora-pro-nobis-v360-1'");

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

    // ---- v360 helpers -------------------------------------------
    const played = () => ev(() => { try { return JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); } catch (e) { return "err"; } });
    const playedToday = async () => { const m = await played(); if (!m || m === "err") return m; const o = {}; for (const k of Object.keys(m)) if (m[k] && m[k][TODAY]) o[k] = m[k][TODAY].via || true; return o; };
    const antBlocks = () => ev(() => (window.state.dayDescs || []).filter((x) => x.episodeId === "marian-antiphon-angelus").map((x) => x.block).sort());
    const countsOf = (b) => ev((blk) => window.blockPlayedCounts(blk), b);
    const pageDots = () => ev(() => Array.from(document.querySelectorAll('[data-card="marian-antiphon-angelus"] [data-markplayed]')).map((b) => ({ on: b.classList.contains("on"), block: b.getAttribute("data-playedblock") })));
    const clickAntDot = () => ev(() => { const b = document.querySelector('[data-card="marian-antiphon-angelus"] [data-markplayed]'); if (!b) return "no-dot"; b.click(); return "ok"; });
    const contText = () => ev(() => { const s = document.getElementById("continue-slot"); return s ? s.textContent : ""; });
    const ANT = "marian-antiphon-angelus";
    // Planted-record boots use a FRESH page (the v355 L4 pattern):
    // a same-page reload fires pagehide on the old page first,
    // whose snapshot write would remove the planted record before
    // Moment 1 could read it.
    const plantAndBoot = async (record) => {
      if (record) await setRec(record);
      const pg = await ctx.newPage();
      await pg.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      return pg;
    };

    // ---- L1 · enumeration: the repeat set is the Antiphon alone --
    const repKeys = await ev(() => Object.keys(window.state.repeatIds || {}).sort());
    const computed = await ev(() => {
      const c = {};
      (window.state.dayDescs || []).forEach((x) => { if (x.kind === "intention" || !x.episodeId) return; c[x.episodeId] = (c[x.episodeId] || 0) + 1; });
      return Object.keys(c).filter((id) => c[id] > 1).sort();
    });
    const blocks1 = await antBlocks();
    ok(eq(repKeys, [ANT]) && eq(computed, [ANT]) && eq(blocks1, ["Evening", "Midday", "Morning"]),
      `L1 enumeration: state.repeatIds is exactly {marian-antiphon-angelus} and matches the descriptor-count computation; the Antiphon stands in Evening/Midday/Morning (repeatIds=${JSON.stringify(repKeys)}, computed=${JSON.stringify(computed)}, blocks=${JSON.stringify(blocks1)})`);
    const novenaFree = await ev(() => Object.keys(window.state.repeatIds || {}).every((id) => !id.startsWith("novena-") && !id.startsWith("ext-")));
    ok(novenaFree, "L1b guard: no novena id and no external slot id stands in the repeat set");

    // ---- L2 · JOHN'S ACCEPTANCE part 1: mark the Morning Antiphon -
    await wipe();
    const base2 = { Morning: await countsOf("Morning"), Midday: await countsOf("Midday"), Evening: await countsOf("Evening") };
    await ev(() => window.openBlockPage("Morning"));
    await sleep(300);
    const dotsM = await pageDots();
    const click2 = await clickAntDot();
    await sleep(300);
    const store2 = await playedToday();
    const after2 = { Morning: await countsOf("Morning"), Midday: await countsOf("Midday"), Evening: await countsOf("Evening") };
    ok(click2 === "ok" && dotsM.length >= 1 && dotsM.every((d) => d.block === "Morning")
      && !!store2[ANT + "|Morning"] && !(ANT in store2) && !(ANT + "|Midday" in store2) && !(ANT + "|Evening" in store2)
      && after2.Morning.played === base2.Morning.played + 1 && after2.Midday.played === base2.Midday.played && after2.Evening.played === base2.Evening.played,
      `L2 acceptance 1: toggling the Morning Antiphon's dot writes ONLY the Morning occurrence key (click=${click2}, dots=${JSON.stringify(dotsM)}, store=${JSON.stringify(Object.keys(store2 || {}))}, counts M ${base2.Morning.played}->${after2.Morning.played} / Md ${base2.Midday.played}->${after2.Midday.played} / E ${base2.Evening.played}->${after2.Evening.played})`);
    await ev(() => window.openBlockPage("Midday"));
    await sleep(250);
    const dotsMd2 = await pageDots();
    await ev(() => window.openBlockPage("Evening"));
    await sleep(250);
    const dotsE2 = await pageDots();
    ok(dotsMd2.length >= 1 && dotsMd2.every((d) => d.block === "Midday" && d.on === false)
      && dotsE2.length >= 1 && dotsE2.every((d) => d.block === "Evening" && d.on === false),
      `L2b acceptance 1 (chrome): the Midday and Evening Antiphon dots read UNPLAYED after the Morning mark (Midday=${JSON.stringify(dotsMd2)}, Evening=${JSON.stringify(dotsE2)})`);

    // ---- L3 · JOHN'S ACCEPTANCE part 2: complete the Midday one ---
    const endRes = await ev((ant) => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === ant && x.block === "Midday");
      if (!d) return "no-desc";
      window.state.current = d;
      document.getElementById("audio").dispatchEvent(new Event("ended"));
      return "ok";
    }, ANT);
    await sleep(300);
    const store3 = await playedToday();
    ok(endRes === "ok" && !!store3[ANT + "|Midday"] && !!store3[ANT + "|Morning"] && !(ANT + "|Evening" in store3) && !(ANT in store3),
      `L3 acceptance 2: completing the Midday Antiphon through the real 'ended' path marks ONLY the Midday occurrence; Morning's mark stands as L2 left it; Evening remains unplayed (store=${JSON.stringify(Object.keys(store3 || {}))})`);
    // data-driven over the repeat set: every repeated id keys independently per block
    const genRes = await ev((today) => {
      const out = {};
      const ids = Object.keys(window.state.repeatIds || {});
      for (const id of ids) {
        const blks = [...new Set((window.state.dayDescs || []).filter((x) => x.episodeId === id && x.kind !== "intention").map((x) => x.block))];
        for (const b of blks) {
          window.writePlayedQuiet(id, today, "marked", b);
          out[id + "@" + b] = blks.every((o) => window.isPlayed(id, today, o) === (o === b) || !!JSON.parse(localStorage.getItem("opn-played-v344") || "{}")[id + "|" + o]);
          window.writePlayedQuiet(id, today, null, b);
        }
      }
      return out;
    }, TODAY);
    ok(Object.values(genRes).every(Boolean) && Object.keys(genRes).length >= 3,
      `L3b general rule: for every id in the repeat set, a mark in one block never reads as played in another (checked=${JSON.stringify(genRes)})`);
    // restore the L2+L3 end state for L4: Morning + Midday marked
    await ev(([ant, today]) => { window.writePlayed(ant, today, "marked", "Morning"); window.writePlayed(ant, today, "played", "Midday"); }, [ANT, TODAY]);

    // ---- L4 · toggle independence --------------------------------
    await ev(() => window.openBlockPage("Midday"));
    await sleep(250);
    const click4 = await clickAntDot();
    await sleep(250);
    const store4 = await playedToday();
    ok(click4 === "ok" && !(ANT + "|Midday" in store4) && !!store4[ANT + "|Morning"],
      `L4 toggle independence: toggling the Midday dot OFF removes only the Midday occurrence; Morning's mark stands (store=${JSON.stringify(Object.keys(store4 || {}))})`);

    // ---- L5 · mark-all isolation ----------------------------------
    await wipe();
    await ev(() => window.openBlockPage("Morning"));
    await sleep(250);
    await ev(() => { const b = document.querySelector('[data-markblock="Morning"]'); if (b) b.click(); return !!b; });
    await sleep(300);
    const store5 = await playedToday();
    const c5 = await countsOf("Morning");
    ok(!!store5[ANT + "|Morning"] && !(ANT + "|Midday" in store5) && !(ANT + "|Evening" in store5) && c5.total > 0 && c5.played === c5.total,
      `L5 mark-all isolation: Mark-all in Morning marks the whole Morning block INCLUDING its Antiphon occurrence — and no other block's Antiphon (counts=${JSON.stringify(c5)}, antKeys=${JSON.stringify(Object.keys(store5 || {}).filter((k) => k.includes("antiphon")))})`);

    // ---- L6 · filter + auto-queue ---------------------------------
    await wipe();
    await ev(([ant, today]) => { window.writePlayedQuiet(ant, today, "played", "Morning"); }, [ANT, TODAY]);
    const filt = await ev((ant) => {
      const sec = (b) => (window.state.dayDescs || []).filter((x) => x.block === b);
      const morn = window.unplayedOnly(sec("Morning")).map((x) => x.episodeId);
      const mid = window.unplayedOnly(sec("Midday")).map((x) => x.episodeId);
      const ai = mid.indexOf(ant);
      return { mornHas: morn.includes(ant), midHas: ai >= 0, introPaired: ai > 0 && mid[ai - 1] === "intro:" + ant };
    }, ANT);
    ok(filt.mornHas === false && filt.midHas === true && filt.introPaired === true,
      `L6 filter: with Morning's Antiphon played, the Morning unplayed-only build drops it while Midday's build keeps Midday's Antiphon WITH its intention intro paired (=${JSON.stringify(filt)})`);
    await ev(() => window.openBlockPage("Midday"));
    await sleep(250);
    const tap6 = await tapBtn(ANT);
    await sleep(500);
    const q6 = await q();
    ok(tap6 === "ok" && q6.q.length >= 2 && q6.q[0] === "intro:" + ANT && q6.q[1] === ANT && q6.cur === "intro:" + ANT,
      `L6b auto-queue (v351): tapping Midday's Antiphon card builds the pair first — intro, then the Midday occurrence (tap=${tap6}, q=${JSON.stringify(q6.q.slice(0, 3))})`);
    await wipe();

    // ---- L7 · Continue counts occurrences separately ---------------
    await wipe();
    await ev(() => window.goListenHome("Midday")); // the Continue card stands on the Listen home view
    await sleep(250);
    const totals7 = await ev(() => (window.state.dayDescs || []).filter((x) => x.kind !== "intention" && x.available).length);
    await ev(([ant, today]) => {
      (window.state.dayDescs || []).forEach((x) => {
        if (x.kind === "intention" || !x.available) return;
        if (x.episodeId === ant && (x.block === "Midday" || x.block === "Evening")) return;
        window.writePlayedQuiet(x.episodeId, today, "played", x.block);
      });
      window.refreshPlayedChrome();
    }, [ANT, TODAY]);
    await sleep(300);
    const cont7a = await contText();
    await ev(([ant, today]) => { window.writePlayed(ant, today, "played", "Midday"); }, [ANT, TODAY]);
    await sleep(300);
    const cont7b = await contText();
    ok(cont7a.includes("Midday") && cont7a.includes("Marian Antiphon") && cont7a.includes(`${totals7 - 2} of ${totals7} heard`)
      && cont7b.includes("Evening") && cont7b.includes("Marian Antiphon") && cont7b.includes(`${totals7 - 1} of ${totals7} heard`),
      `L7 Continue: with only the Midday+Evening Antiphons unplayed, Continue names Midday's occurrence and counts ${totals7 - 2}/${totals7}; marking Midday moves it to Evening's occurrence at ${totals7 - 1}/${totals7} — each occurrence counted separately (a=${JSON.stringify(cont7a.slice(0, 120))}, b=${JSON.stringify(cont7b.slice(0, 120))})`);
    await wipe();

    // ---- L8 · queue dots per occurrence ----------------------------
    await wipe();
    await ev(([ant, today]) => { window.writePlayedQuiet(ant, today, "played", "Morning"); }, [ANT, TODAY]);
    const q8build = await ev((ant) => {
      const ds = window.state.dayDescs || [];
      const m = ds.find((x) => x.episodeId === ant && x.block === "Morning");
      const e = ds.find((x) => x.episodeId === ant && x.block === "Evening");
      if (!m || !e) return "missing";
      window.startQueue([m, e]);
      return "ok";
    }, ANT);
    await sleep(400);
    await ev(() => window.openNowPlaying());
    await sleep(300);
    const rows8 = await ev(() => Array.from(document.querySelectorAll(".npq-row")).map((r) => ({
      id: r.getAttribute("data-npq-id"), meta: r.textContent, on: !!r.querySelector(".npq-dot.on"),
    })).filter((r) => r.id === "marian-antiphon-angelus"));
    ok(q8build === "ok" && rows8.length === 2 && rows8.some((r) => r.meta.includes("Morning") && r.on === true) && rows8.some((r) => r.meta.includes("Evening") && r.on === false),
      `L8 queue dots: a queue holding two Antiphon occurrences paints each row's dot from its OWN occurrence (Morning on, Evening off) (rows=${JSON.stringify(rows8.map((r) => ({ on: r.on, meta: r.meta.slice(0, 40) })))} )`);
    await ev(() => { document.querySelectorAll(".np-sheet").forEach((s) => s.remove()); });
    await wipe();

    // ---- L9 · snapshot v2 round-trip -------------------------------
    const q9build = await ev((ant) => {
      const ds = window.state.dayDescs || [];
      const m = ds.find((x) => x.episodeId === ant && x.block === "Morning");
      const e = ds.find((x) => x.episodeId === ant && x.block === "Evening");
      if (!m || !e) return "missing";
      window.startQueue([m, e]);
      return "ok";
    }, ANT);
    await sleep(400);
    const r9 = await rec();
    ok(q9build === "ok" && !!r9 && r9.v === 2 && eq(r9.ids, [ANT, ANT]) && eq(r9.blocks, ["Morning", "Evening"]) && r9.currentId === ANT && r9.currentBlock === "Morning",
      `L9a snapshot v2 save: the record carries v=2, blocks parallel to ids, currentBlock (rec=${JSON.stringify(r9 && { v: r9.v, ids: r9.ids, blocks: r9.blocks, currentBlock: r9.currentBlock })})`);
    const page9 = await ctx.newPage();
    await page9.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const ok9 = await waitRestored(page9);
    await waitReady(page9);
    await sleep(400);
    const restored9 = await page9.evaluate(() => (window.state.queue || []).map((d) => d.block));
    const credit9 = await page9.evaluate((ant) => {
      const e = (window.state.queue || []).find((x) => x.episodeId === ant && x.block === "Evening");
      if (!e) return "no-evening";
      window.markCompleted(e);
      return "ok";
    }, ANT);
    await sleep(200);
    const store9 = await page9.evaluate(() => { try { return JSON.parse(localStorage.getItem("opn-played-v344") || "{}"); } catch (e) { return {}; } });
    ok(ok9 && eq(restored9, ["Morning", "Evening"]) && credit9 === "ok" && !!(store9[ANT + "|Evening"] && store9[ANT + "|Evening"][TODAY]) && !(store9[ANT + "|Morning"] && store9[ANT + "|Morning"][TODAY]),
      `L9 snapshot v2 round-trip: the two occurrences restore to their OWN dayparts, and completing the restored Evening entry credits Evening only (restored=${JSON.stringify(restored9)}, credit=${credit9})`);
    await page9.close();
    await wipe();

    // ---- L10 · snapshot v1 fallback --------------------------------
    const page10 = await plantAndBoot({ v: 1, date: TODAY, ids: [ANT, ANT], idx: 0, currentId: ANT, positionS: 0, savedAt: new Date().toISOString() });
    const ok10 = await waitRestored(page10);
    await waitReady(page10);
    await sleep(400);
    const restored10 = await page10.evaluate(() => (window.state.queue || []).map((d) => d.block));
    await page10.evaluate(() => window.saveQueueSnapshot());
    const rec10 = await page10.evaluate(() => { try { return JSON.parse(localStorage.getItem("opn-queue-v355") || "null"); } catch (e) { return null; } });
    ok(ok10 && eq(restored10, ["Morning", "Morning"]) && !!rec10 && rec10.v === 2 && eq(rec10.blocks, ["Morning", "Morning"]) && rec10.currentBlock === "Morning",
      `L10 v1 fallback: an ids-only record restores first-match (both occurrences collapse to Morning's descriptor, the approved price) and the next save rewrites it as v2 (restored=${JSON.stringify(restored10)}, rec=${JSON.stringify(rec10 && { v: rec10.v, blocks: rec10.blocks, currentBlock: rec10.currentBlock })})`);
    await page10.close();
    await wipe();

    // ---- L11 · changeover A ----------------------------------------
    await ev(([ant, today, yday]) => {
      const map = {};
      map[ant] = { [today]: { playedAt: new Date().toISOString(), via: "played" } };
      map["daily-rosary"] = { [today]: { playedAt: new Date().toISOString(), via: "played" } };
      map["novena-st-jude"] = { [yday]: { playedAt: new Date().toISOString(), via: "played" }, [today]: { playedAt: new Date().toISOString(), via: "played" } };
      localStorage.setItem("opn-played-v344", JSON.stringify(map));
      window.state.playedCache = null;
    }, [ANT, TODAY, YDAY]);
    const ch11 = await ev(([ant, today]) => ({
      morn: window.isPlayed(ant, today, "Morning"), mid: window.isPlayed(ant, today, "Midday"), eve: window.isPlayed(ant, today, "Evening"),
      rosary: window.isPlayed("daily-rosary", today, "Morning"),
    }), [ANT, TODAY]);
    ok(ch11.morn === false && ch11.mid === false && ch11.eve === false && ch11.rosary === true,
      `L11 changeover A: a pre-seeded BARE Antiphon mark for today reads UNPLAYED at all three occurrences under the new build — the old entry is simply never read — while a pre-seeded singleton mark (daily-rosary) reads exactly as before (=${JSON.stringify(ch11)})`);

    // ---- L12 · novena guard ----------------------------------------
    const nov12a = await ev(() => window.novenaInfo("novena-st-jude", "Novena to St. Jude — Day 5"));
    const novMark = await ev(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "novena-st-jude");
      if (!d) return "no-desc";
      window.markCompleted(d);
      return "ok";
    });
    await sleep(200);
    const store12 = await played();
    const nov12b = await ev(() => window.novenaInfo("novena-st-jude", "Novena to St. Jude — Day 5"));
    ok(!!nov12a && nov12a.n === 5 && nov12a.m === 2 && novMark === "ok" && !!store12["novena-st-jude"] && !Object.keys(store12 || {}).some((k) => k.startsWith("novena-st-jude|")) && !!nov12b && nov12b.m === 2,
      `L12 novena guard: novenaInfo counts the two seeded dates under the BARE canonical id before and after (m=${nov12a && nov12a.m} -> ${nov12b && nov12b.m}); completing a novena day writes the bare key only — no occurrence key ever stands for a novena id (keys=${JSON.stringify(Object.keys(store12 || {}).filter((k) => k.includes("novena")))})`);

    // ---- L13 · singleton stability ---------------------------------
    await wipe();
    const mark13 = await ev(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "morning-prayer");
      if (!d) return "no-desc";
      window.markCompleted(d);
      window.writePlayed("daily-rosary", window.state.presentedDay, "marked", "Morning");
      return "ok";
    });
    await sleep(200);
    const store13 = await played();
    const keys13 = Object.keys(store13 || {}).sort();
    ok(mark13 === "ok" && eq(keys13, ["daily-rosary", "morning-prayer"]) && keys13.every((k) => !k.includes("|")),
      `L13 singleton stability: marking Morning Prayer (and the Daily Rosary WITH a block in hand) writes the BARE canonical keys — no occurrence suffix stands anywhere for a non-repeated id (keys=${JSON.stringify(keys13)})`);
    await wipe();

    ok(pageErrors.length === 0, `browser: no page errors across the v360 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v360: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
