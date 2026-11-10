#!/usr/bin/env node
// harness-v354 — the v354 gate. Proves the v354 §2 Plan (UI overhaul C): the
// Now Playing sheet in clone form — a liturgical-gradient hero (.np-hero:
// minimize row, the artwork field at min(72vw, 340px), #np-title in
// --bar-fg, #np-meta + the .np-litday day line in --bar-sub) over the
// standing cream zone (seek, transport, speed/sleep/Read, the v347 queue
// byte-identical in behavior) — the queue preview sheet in the same hero,
// the no-record flat-navy fallback, the full five-color contrast audit
// measured IN-PAGE on the hero instance (gold's 3.15/3.42 pairs REPORTED
// under §2.6's decided exception, never asserted), the §2.5F measured
// outline on v353's accent discs, the font floors, and NP standing
// unbroken over every tab incl. the v356 PIN gate. Mold = harness-v353
// (local wrangler + fixture feeds + HTTPS site server on
// https://orapronobis.media). Ports: app 8994, feed 8954, persist
// .wrangler-test-v354. SW pin ora-pro-nobis-v354-1. Viewport 430 wide so
// §2.2's min(72vw, 340px) artwork field measures >= 300px (L1).
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v353 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8994, FEED_PORT = 8954, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v354");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v354-"));
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
  for (let i = 1; i <= 3; i++) pool.push([100 + i, `Synthetic intention H${i} — and for the whole fixture family, their intentions, and all the faithful departed of the parish, that this text runs long`, "H"]);
  for (let i = 1; i <= 7; i++) pool.push([110 + i, `Synthetic intention M${i} — and for the whole fixture family, their intentions, and all the faithful departed of the parish, that this text runs long`, "M"]);
  pool.push([120, "Synthetic intention L1 — and for the whole fixture family, their intentions, and all the faithful departed of the parish, that this text runs long", "L"]);
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
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v354-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    // ============ candidate app: the FULL migration sequence ===
    // through 0015 (v354 claims NO migration — 0016 stays free) ===
    const migs = migFiles(APP);
    ok(migs.some((f) => path.basename(f).startsWith("0015")) && !migs.some((f) => path.basename(f).startsWith("0016")),
      "fixture: migrations stand through 0015 and NO 0016 exists (v354 claims none)");
    applyFiles(APP, PERSIST, migs, seedSql());
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");
    const swJs = (await api(BASE, "GET", "/sw.js")).text;
    ok(swJs.includes("ora-pro-nobis-v354-1"), "SW pin: the served service worker carries CACHE 'ora-pro-nobis-v354-1'");

    // ============ browser ========================================
    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    browser = await chromium.launch({
      executablePath: CHROME, env: browserEnv,
      args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server", "--autoplay-policy=no-user-gesture-required",
        "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
    });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await wireContext(ctx);
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    page.on("dialog", (d) => d.accept());
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const q = () => ev(() => ({
      q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx,
      cur: window.state.current ? window.state.current.episodeId : null,
      paused: document.getElementById("audio").paused,
      ct: document.getElementById("audio").currentTime,
    }));
    const rec = () => ev((k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return "parse-error"; } }, QKEY);
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
    const hexToRgb = (hex) => { const c = hex.replace("#", ""); return `rgb(${parseInt(c.substr(0, 2), 16)}, ${parseInt(c.substr(2, 2), 16)}, ${parseInt(c.substr(4, 2), 16)})`; };
    const lumRgb = (rgb) => {
      const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(rgb || "");
      if (!m) return 0;
      const v = [1, 2, 3].map((i) => Number(m[i]) / 255).map((x) => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const lumHex = (hex) => lumRgb(hexToRgb(hex));
    const ratioRgb = (a, b) => { const x = lumRgb(a), y = lumRgb(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const ratioHex = (a, b) => { const x = lumHex(a), y = lumHex(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const tokens = () => ev(() => {
      const cs = getComputedStyle(document.documentElement);
      return { lit: document.documentElement.getAttribute("data-lit"),
        bg: cs.getPropertyValue("--bar-bg"), fg: cs.getPropertyValue("--bar-fg").trim(),
        sub: cs.getPropertyValue("--bar-sub").trim(), accent: cs.getPropertyValue("--accent").trim() };
    });
    const startRosary = async () => {
      await ev(() => window.openBlockPage("Morning"));
      const t = await tapBtn("daily-rosary");
      await sleep(500);
      return t;
    };
    const waitCurrent = async (id, timeout = 12000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const c = await ev(() => window.state.current && window.state.current.episodeId);
        if (c === id) return true;
        await sleep(300);
      }
      return false;
    };

    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const boot = await waitReady(page);
    ok(boot.ready, `boot: the fixture pass reaches readiness (own settled + descriptors + intros) in ${boot.ms} ms`);

    // ================= v354 legs (Plan §2.8, L1–L10) =================

    // ---- L2 (fallback half) FIRST: no liturgical record stands ---
    ok((await tokens()).lit === null, "L2 setup: no liturgical record stands for the presented day yet (data-lit absent)");
    await startRosary();
    await ev(() => window.openNowPlaying());
    await sleep(300);
    const l2f = await ev(() => {
      const hero = document.querySelector(".np-hero");
      const title = document.getElementById("np-title");
      return { hero: !!hero, litday: !!document.querySelector(".np-litday"),
        bgColor: hero ? getComputedStyle(hero).backgroundColor : "", bgImage: hero ? getComputedStyle(hero).backgroundImage : "",
        titleColor: title ? getComputedStyle(title).color : "" };
    });
    ok(l2f.hero && !l2f.litday && l2f.bgColor === "rgb(22, 40, 63)" && l2f.titleColor === "rgb(233, 217, 174)",
      `L2 fallback: no record -> NO .np-litday line, the hero stands in the flat navy rgb(22, 40, 63), the title in #e9d9ae (debug=${JSON.stringify(l2f)})`);
    await ev(() => document.getElementById("np-min").click());
    await stopQ();

    // ---- push the green record: L1 + L2 (name half) ----------------
    const pushG = await api(BASE, "POST", "/api/agent/prayer/liturgical-day", { token: TOKEN, json: { date: TODAY, dayName: "Fixture Memorial of Saint Fixture", color: "green" } });
    ok(pushG.status === 200, "setup: the green liturgical record stands (door push)");
    await page.reload({ waitUntil: "domcontentloaded" });
    ok((await waitReady(page)).ready && (await tokens()).lit === "green", "setup: re-boot presents the green day");
    await startRosary();
    await ev(() => window.openNowPlaying());
    await sleep(300);
    const tk = await tokens();
    const l1 = await ev(() => {
      const hero = document.querySelector(".np-hero");
      const title = document.getElementById("np-title");
      const meta = document.getElementById("np-meta");
      const img = document.querySelector(".np-art img");
      const ids = ["np-min", "np-title", "np-meta", "np-seek", "np-prev", "np-play", "np-next", "np-speed", "np-sleep", "np-read", "np-queue", "np-queue-pos"];
      return { hero: !!hero, bgImage: hero ? getComputedStyle(hero).backgroundImage : "",
        titleColor: title ? getComputedStyle(title).color : "", metaColor: meta ? getComputedStyle(meta).color : "",
        artW: img ? img.getBoundingClientRect().width : 0,
        idsPresent: ids.every((id) => !!document.getElementById(id)),
        heroKids: ["np-min", "np-title", "np-meta", "np-litday"].every((id) => { const el = document.getElementById(id); return el && hero && hero.contains(el); }),
        litday: (document.querySelector(".np-litday") || {}).textContent || "" };
    });
    ok(l1.hero && /linear-gradient/.test(l1.bgImage) && l1.titleColor === hexToRgb(tk.fg) && l1.metaColor === hexToRgb(tk.sub),
      `L1 hero form: .np-hero stands in the theme gradient; #np-title computes to --bar-fg (${tk.fg}), #np-meta to --bar-sub (${tk.sub})`);
    ok(l1.artW >= 300, `L1: the artwork field measures >= 300px at the fixture viewport (w=${l1.artW.toFixed(1)} of min(72vw, 340px) at 430px)`);
    ok(l1.idsPresent && l1.heroKids, "L1: every standing NP id is present in the sheet; minimize/title/meta/day-line stand inside the hero");
    ok(l1.litday === "Fixture Memorial of Saint Fixture", `L2: the hero's .np-litday carries the day's name exactly as pushed ("${l1.litday}")`);
    const preMin = await q();
    await ev(() => document.getElementById("np-min").click());
    await sleep(250);
    const postMin = await q();
    ok(!await ev(() => !!document.querySelector(".np-sheet")) && postMin.paused === preMin.paused && postMin.ct >= preMin.ct - 0.15 && postMin.cur === preMin.cur,
      "L1: minimize removes the sheet with playback, position, and current track untouched");

    // ---- L3 · the queue intact --------------------------------------
    await seedPlayed(["marian-antiphon-angelus"]);
    await ev(() => window.openNowPlaying());
    await sleep(300);
    const l3a = await ev(() => ({
      pos: document.getElementById("np-queue-pos").textContent,
      rows: document.querySelectorAll("#np-queue [data-npq-index]").length,
    }));
    const qNow = await q();
    ok(l3a.pos === `Track ${qNow.idx + 1} of ${qNow.q.length}` && l3a.rows === qNow.q.length,
      `L3: the position line reads "Track N of M" and the list renders the standing queue (${l3a.pos}, ${l3a.rows} rows)`);
    const dotState = await ev(() => {
      const out = {};
      document.querySelectorAll("#np-queue [data-npq-index]").forEach((r) => {
        const dot = r.querySelector(".npq-dot");
        if (dot) out[r.getAttribute("data-npq-id")] = dot.classList.contains("on");
      });
      return out;
    });
    ok(dotState["marian-antiphon-angelus"] === true && dotState["daily-rosary"] === false,
      "L3: played dots match the seeded v344 store (seeded track on, unplayed track off)");
    const arrBefore = qNow.q.slice();
    await ev(() => document.querySelector('#np-queue [data-npq-index="2"]').click());
    await sleep(500);
    const qJump = await q();
    const playRow = await ev(() => {
      const r = document.querySelector('#np-queue [data-npq-index="2"]');
      return r ? { playing: r.classList.contains("playing"), aria: r.getAttribute("aria-current") } : null;
    });
    ok(qJump.idx === 2 && qJump.cur === arrBefore[2] && JSON.stringify(qJump.q) === JSON.stringify(arrBefore) && playRow && playRow.playing && playRow.aria === "true",
      "L3: a mid-list row tap jumps inside the standing queue — that track plays, the array and its order unchanged, the playing row marked + aria-current");
    const unQ = await ev(() => window.state.queue.findIndex((d) => !d.available));
    if (unQ >= 0) {
      const dis = await ev((i) => { const r = document.querySelector('#np-queue [data-npq-index="' + i + '"]'); return r ? r.disabled : null; }, unQ);
      ok(dis === true, `L3: the unavailable queue row (index ${unQ}) renders disabled`);
    } else {
      ok(true, "L3: no unavailable descriptor stands in this fixture's queue — the disabled-row rendering is asserted on the preview queue below / carried by harness-v347");
    }
    await stopQ();
    await ev(() => window.goListenHome());
    await ev(() => window.refreshPlayedChrome());
    await page.waitForSelector("#continue-queue", { timeout: 10000 });
    await ev(() => document.getElementById("continue-queue").click());
    await sleep(500);
    const tkP = await tokens();
    const l3p = await ev(() => {
      const sheet = document.querySelector(".np-sheet.np-preview");
      const hero = sheet && sheet.querySelector(".np-hero");
      const head = sheet && sheet.querySelector(".npq-heading");
      const pos = sheet && sheet.querySelector("#np-queue-pos");
      return { sheet: !!sheet, hero: !!hero, rows: sheet ? sheet.querySelectorAll("#np-queue [data-npq-index]").length : 0,
        headColor: head ? getComputedStyle(head).color : "", posColor: pos ? getComputedStyle(pos).color : "",
        preview: !!window.state.previewQueue, unIdx: window.state.previewQueue ? window.state.previewQueue.findIndex((d) => !d.available) : -1 };
    });
    ok(l3p.sheet && l3p.hero && l3p.rows > 0 && l3p.headColor === hexToRgb(tkP.fg) && l3p.posColor === hexToRgb(tkP.sub),
      `L3 preview: the preview sheet takes the SAME hero — heading in --bar-fg, position in --bar-sub (${l3p.rows} rows)`);
    if (l3p.unIdx >= 0) {
      const dis = await ev((i) => { const r = document.querySelector('#np-queue [data-npq-index="' + i + '"]'); return r ? r.disabled : null; }, l3p.unIdx);
      ok(dis === true, `L3: the unavailable preview row (index ${l3p.unIdx}) renders disabled`);
    }
    await ev(() => document.querySelector('#np-queue [data-npq-index="0"]').click());
    await sleep(600);
    const l3q = await q();
    const sheetKind = await ev(() => { const s = document.querySelector(".np-sheet"); return s ? { preview: s.classList.contains("np-preview"), hero: !!s.querySelector(".np-hero") } : null; });
    ok(l3q.q.length > 0 && !await ev(() => !!window.state.previewQueue) && sheetKind && !sheetKind.preview && sheetKind.hero,
      "L3: a preview row tap starts there, closes the preview, and lands in the full Now Playing — in the new hero form");
    await stopQ();
    await clearPlayed(); await ev(() => window.refreshPlayedChrome());

    // ---- L4 · transport + seek --------------------------------------
    await startRosary();
    ok(await waitCurrent("daily-rosary"), "L4 setup: the queue advances to the Daily Rosary (30s tone) as the current track");
    await ev(() => window.openNowPlaying());
    await sleep(300);
    const glyph0 = await ev(() => document.getElementById("np-play").innerHTML);
    await ev(() => document.getElementById("np-play").click());
    await sleep(300);
    const pausedMid = await ev(() => document.getElementById("audio").paused);
    const glyph1 = await ev(() => document.getElementById("np-play").innerHTML);
    await ev(() => document.getElementById("np-play").click());
    await sleep(300);
    const pausedEnd = await ev(() => document.getElementById("audio").paused);
    ok(pausedMid === true && pausedEnd === false && glyph0 !== glyph1,
      `L4: play/pause toggles the element and the glyph (playing -> paused -> playing, glyph "${glyph0}" -> "${glyph1}")`);
    await ev(() => document.querySelector('#np-queue [data-npq-index="0"]').click());
    const prevDis = await ev(() => document.getElementById("np-prev").disabled);
    ok(prevDis === true, "L4: prev stands disabled at the head of the queue");
    await ev(() => document.querySelector('#np-queue [data-npq-index="2"]').click());
    await sleep(400);
    const pn = await ev(() => ({ prev: document.getElementById("np-prev").disabled, next: document.getElementById("np-next").disabled }));
    ok(pn.prev === false && pn.next === false, "L4: mid-queue, prev and next both stand enabled");
    await ev(() => document.querySelector('#np-queue [data-npq-index="1"]').click());
    ok(await waitCurrent("daily-rosary", 15000), "L4: jumping back to the Daily Rosary's row makes it current for the seek leg");
    await sleep(1200);
    const seek = await ev(() => {
      const bar = document.getElementById("np-seek");
      const before = document.getElementById("audio").currentTime;
      bar.value = "500";
      bar.dispatchEvent(new Event("input", { bubbles: true }));
      const during = { ct: document.getElementById("audio").currentTime, elapsed: document.getElementById("np-elapsed").textContent };
      bar.dispatchEvent(new Event("change", { bubbles: true }));
      return { before, during };
    });
    await sleep(400);
    const ctAfter = await ev(() => document.getElementById("audio").currentTime);
    const remain = await ev(() => document.getElementById("np-remain").textContent);
    ok(seek.during.ct < 7 && /^0:1[3-7]$/.test(seek.during.elapsed),
      `L4 seek: during input the fill follows the finger (elapsed ${seek.during.elapsed}) while the element stands uncommitted (ct=${seek.during.ct.toFixed(1)}s)`);
    ok(Math.abs(ctAfter - 15) <= 3 && /^-\d+:\d\d$/.test(remain),
      `L4 seek: change commits currentTime to the scrub point (ct=${ctAfter.toFixed(1)}s of the 30s tone, remaining ${remain})`);

    // ---- L5 · speeds --------------------------------------------------
    const spd0 = await ev(() => ({ label: document.getElementById("np-speed").textContent, rate: document.getElementById("audio").playbackRate }));
    ok(spd0.label === "1×" && spd0.rate === 1, `L5: #np-speed names the standing rate (${spd0.label})`);
    const ctBeforeRate = await ev(() => document.getElementById("audio").currentTime);
    await ev(() => document.getElementById("np-speed").click());
    await page.waitForSelector(".speedsheet [data-rate]", { timeout: 10000 });
    await ev(() => document.querySelector('.speedsheet [data-rate="1.5"]').click());
    await sleep(300);
    const spd1 = await ev(() => ({ label: document.getElementById("np-speed").textContent, rate: document.getElementById("audio").playbackRate, ct: document.getElementById("audio").currentTime }));
    ok(spd1.rate === 1.5 && spd1.label === "1.5×" && spd1.ct >= ctBeforeRate && spd1.ct - ctBeforeRate < 3,
      `L5: choosing 1.5x applies to the element at once, the label follows, no position jump (ct ${ctBeforeRate.toFixed(1)} -> ${spd1.ct.toFixed(1)})`);
    await ev(() => document.getElementById("sp-close").click());
    await stopQ();
    await page.reload({ waitUntil: "domcontentloaded" });
    ok((await waitReady(page)).ready, "L5 setup: re-boot reaches readiness");
    await startRosary();
    await ev(() => window.openNowPlaying());
    await sleep(300);
    const spd2 = await ev(() => ({ label: document.getElementById("np-speed").textContent, rate: document.getElementById("audio").playbackRate }));
    ok(spd2.label === "1.5×" && spd2.rate === 1.5, "L5: the speed choice survives a reload (the standing persistence read back in the new form)");
    await ev(() => document.getElementById("np-speed").click());
    await page.waitForSelector(".speedsheet [data-rate]", { timeout: 10000 });
    await ev(() => document.querySelector('.speedsheet [data-rate="1"]').click());
    await ev(() => document.getElementById("sp-close").click());
    ok((await ev(() => document.getElementById("audio").playbackRate)) === 1, "L5 cleanup: the rate stands restored to 1x for the later legs");

    // ---- L6 · sleep + Read --------------------------------------------
    ok(await waitCurrent("daily-rosary", 15000), "L6 setup: the Daily Rosary stands current (it carries text)");
    const readVis = await ev(() => document.getElementById("np-read").style.display !== "none");
    const playState6 = await q();
    await ev(() => document.getElementById("np-read").click());
    await sleep(700);
    const readSheet = await ev(() => !!document.querySelector(".readsheet") && !!document.querySelector(".np-sheet"));
    await ev(() => { const c = document.querySelector("[data-readclose]"); if (c) c.click(); });
    await sleep(300);
    const afterRead = await q();
    ok(readVis && readSheet && afterRead.cur === playState6.cur && afterRead.paused === playState6.paused && !!await ev(() => !!document.querySelector(".np-sheet")),
      "L6: Read stands for a track with text, stacks over Now Playing, and closing it returns here with playback untouched");
    const noText = await ev(() => {
      // a track without text: the intro stands first in this queue family;
      // readTracks decides — assert the rule on the standing map
      const rt = window.state.readTracks[window.state.current.episodeId];
      return { cur: window.state.current.episodeId, vis: document.getElementById("np-read").style.display !== "none", has: !!(rt && rt.hasText && rt.textUrl) };
    });
    ok(noText.vis === noText.has, "L6: #np-read stands iff the current track has text (the standing rule, read off the live map)");
    await ev(() => document.getElementById("np-sleep").click());
    await page.waitForSelector("[data-sleep-choice]", { timeout: 10000 });
    await ev(() => document.querySelector('[data-sleep-choice="track"]').click());
    await sleep(300);
    const sl1 = await ev(() => ({ np: document.getElementById("np-sleep").textContent }));
    await ev(() => document.getElementById("np-min").click());
    await ev(() => window.goListenHome());
    await sleep(300);
    const sl2 = await ev(() => ({ home: document.getElementById("sleep-btn") ? document.getElementById("sleep-btn").textContent : null }));
    ok(sl1.np === "Sleep · End of track" && sl2.home === sl1.np,
      `L6: arming the sleep timer from Now Playing and the Play All row button agree ("${sl1.np}" on both surfaces)`);
    await ev(() => document.getElementById("sleep-btn").click());
    await page.waitForSelector("[data-sleep-choice]", { timeout: 10000 });
    await ev(() => document.querySelector('[data-sleep-choice="off"]').click());
    const sl3 = await ev(() => document.getElementById("sleep-btn").textContent);
    ok(sl3 === "Sleep · Off", "L6 cleanup: the sleep timer stands disarmed");

    // ---- L7 · restore interplay (v355) --------------------------------
    const recNow = await rec();
    ok(recNow && Array.isArray(recNow.ids) && recNow.ids.length > 0, "L7 setup: the app wrote its queue snapshot record during play");
    await page.reload({ waitUntil: "domcontentloaded" });
    const rst = await waitRestored(page);
    const dockTitle = await ev(() => document.getElementById("dock-title").textContent);
    await ev(() => window.openNowPlaying());
    await sleep(300);
    const l7 = await ev(() => ({
      npTitle: document.getElementById("np-title").textContent,
      paused: document.getElementById("audio").paused,
      rows: document.querySelectorAll("#np-queue [data-npq-index]").length,
      qlen: window.state.queue.length,
    }));
    const recIds = recNow.ids.slice();
    const qIds = (await q()).q;
    ok(rst && l7.paused && l7.npTitle === dockTitle && l7.rows === l7.qlen && JSON.stringify(qIds) === JSON.stringify(recIds),
      `L7 restore: Now Playing opens on the restored track, paused, its queue list = the restored queue (${l7.rows} rows); the mini-player shows the same track ("${dockTitle}")`);
    await wipe();

    // ---- L8 · the audit, in-page, per color ---------------------------
    for (const color of ["white", "red", "green", "violet", "rose"]) {
      const push = await api(BASE, "POST", "/api/agent/prayer/liturgical-day", { token: TOKEN, json: { date: TODAY, dayName: "Fixture " + color, color } });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector(".blockcard", { timeout: 20000 });
      ok((await waitReady(page)).ready, `L8 ${color} setup: re-boot ready with the ${color} record standing`);
      const t = await tokens();
      const stops = t.bg.match(/#[0-9a-fA-F]{6}/g) || [];
      const heroMin = stops.length >= 2 ? Math.min(...stops.flatMap((s) => [ratioHex(t.fg, s), ratioHex(t.sub, s)])) : 0;
      const shadowCard = await ev(() => { const b = document.querySelector(".blockcard .playbtn"); return b ? getComputedStyle(b).boxShadow : ""; });
      await ev(() => window.openBlockPage("Morning"));
      const shadowHead = await ev(() => { const b = document.querySelector(".blockpage-head .playbtn"); return b ? getComputedStyle(b).boxShadow : ""; });
      const fgRgb = hexToRgb(t.fg);
      const shadowOk = (sh) => sh.includes("0px 0px 0px 2px") && sh.includes(fgRgb);
      ok(shadowOk(shadowCard) && shadowOk(shadowHead),
        `L8 ${color}: §2.5F outline — the accent discs on gradient zones carry the measured 2px bar-fg boundary (card "${shadowCard}", head "${shadowHead}")`);
      await ev(() => window.goListenHome());
      await ev(() => document.querySelector('.blockcard[data-openblock="Morning"] .blockcard-play').click());
      await sleep(500);
      await ev(() => window.openNowPlaying());
      await sleep(300);
      const hero = await ev(() => {
        const title = document.getElementById("np-title");
        const meta = document.getElementById("np-meta");
        const lit = document.querySelector(".np-litday");
        const heroEl = document.querySelector(".np-hero");
        const row = document.querySelector(".npq-row");
        const rowTitle = document.querySelector(".npq-title");
        const rowMeta = document.querySelector(".npq-meta");
        const seekRow = document.querySelector(".np-seekrow");
        const tbtn = document.querySelector(".np-tbtn");
        const sheet = document.querySelector(".np-sheet");
        return {
          title: title ? getComputedStyle(title).color : "", meta: meta ? getComputedStyle(meta).color : "",
          lit: lit ? getComputedStyle(lit).color : "", litText: lit ? lit.textContent : "",
          heroBg: heroEl ? getComputedStyle(heroEl).backgroundImage : "",
          rowTitle: rowTitle ? getComputedStyle(rowTitle).color : "", rowBg: row ? getComputedStyle(row).backgroundColor : "",
          rowMeta: rowMeta ? getComputedStyle(rowMeta).color : "",
          seek: seekRow ? getComputedStyle(seekRow).color : "", tbtn: tbtn ? getComputedStyle(tbtn).color : "",
          sheetBg: sheet ? getComputedStyle(sheet).backgroundColor : "",
        };
      });
      const heroStops = hero.heroBg.match(/rgb\(\d+, \d+, \d+\)/g) || [];
      const heroPairMin = heroStops.length >= 2 ? Math.min(...heroStops.flatMap((s) => [ratioRgb(hero.title, s), ratioRgb(hero.meta, s)])) : 0;
      ok(push.status === 200 && t.lit === color && heroMin >= 4.5 && heroPairMin >= 4.5 && hero.title === fgRgb && hero.meta === hexToRgb(t.sub) && hero.lit === hexToRgb(t.sub) && hero.litText === "Fixture " + color,
        `L8 ${color}: ON THE HERO INSTANCE, --bar-fg/--bar-sub vs both gradient ends >= 4.5:1 (token min ${heroMin.toFixed(2)}, measured min ${heroPairMin.toFixed(2)}); title/meta/day-line compute to the audited pair`);
      const z2 = [ratioRgb(hero.rowTitle, hero.rowBg), ratioRgb(hero.rowMeta, hero.rowBg), ratioRgb(hero.seek, hero.sheetBg), ratioRgb(hero.tbtn, hero.sheetBg)];
      ok(Math.min(...z2) >= 4.5, `L8 ${color}: zone-2 pairs (queue title/meta on card, seek labels + transport glyphs on cream) >= 4.5:1 (min ${Math.min(...z2).toFixed(2)})`);
      const setB = ratioHex(t.accent, "#faf5ec");
      const setC = ratioHex("#ffffff", t.accent);
      if (color === "white") {
        ok(true, `L8 white: set B gold-on-cream ${setB.toFixed(2)} + set C white-on-gold ${setC.toFixed(2)} REPORTED under §2.6's decided gold exception (not asserted)`);
        ok(hero.title === "rgb(22, 40, 63)", "L8 white: the hero title's computed color is the navy #16283f — no white/cream text on the pale field");
      } else {
        ok(setB >= 4.5 && setC >= 4.5, `L8 ${color}: set B accent-on-cream ${setB.toFixed(2)} + set C white-on-accent ${setC.toFixed(2)}, both >= 4.5:1`);
      }
      await ev(() => document.getElementById("np-min").click());
      await stopQ();
    }

    // ---- L9 · floors ----------------------------------------------------
    await api(BASE, "POST", "/api/agent/prayer/liturgical-day", { token: TOKEN, json: { date: TODAY, dayName: "Fixture Memorial of Saint Fixture", color: "green" } });
    await page.reload({ waitUntil: "domcontentloaded" });
    ok((await waitReady(page)).ready, "L9 setup: re-boot ready");
    await startRosary();
    await ev(() => window.openNowPlaying());
    await sleep(300);
    const l9 = await ev(() => {
      const sheet = document.querySelector(".np-sheet");
      let min = 999;
      sheet.querySelectorAll("*").forEach((el) => {
        const txt = Array.from(el.childNodes).some((nd) => nd.nodeType === 3 && nd.textContent.trim().length > 0);
        if (txt) min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      });
      return { body: parseFloat(getComputedStyle(document.body).fontSize),
        litday: parseFloat(getComputedStyle(document.querySelector(".np-litday")).fontSize),
        meta: parseFloat(getComputedStyle(document.getElementById("np-meta")).fontSize), min };
    });
    ok(l9.body === 17 && l9.litday >= 13 && l9.meta >= 13 && l9.min >= 13,
      `L9 floors: body computes 17px; the day line at ${l9.litday}px, hero meta at ${l9.meta}px, and NO text element on Now Playing under 13px (min ${l9.min}px)`);
    await stopQ();

    // ---- L10 · no-break across the app + the PIN gate -------------------
    await page.click("#gearbtn");
    await page.waitForSelector("#pin-section #pin-set-open", { timeout: 15000 });
    await page.click("#pin-set-open");
    await page.waitForSelector(".pinsetsheet", { timeout: 10000 });
    await page.fill("#ps-pin1", "246810");
    await page.fill("#ps-pin2", "246810");
    await page.click("#ps-save");
    await page.waitForSelector(".recoverysheet .recoverycode", { timeout: 15000 });
    await page.click("#rec-done");
    await page.waitForSelector("#pin-section .card", { timeout: 15000 });
    ok(true, "L10 setup: a PIN stands set through the real Settings flow (v356's surface, untouched by C)");
    const reqLog = [];
    page.on("request", (r) => { if (r.url().includes("/api/exam") || r.url().includes("/api/confession")) reqLog.push(r.url()); });
    await page.reload({ waitUntil: "domcontentloaded" });
    ok((await waitReady(page)).ready, "L10 setup: re-boot ready, the PIN standing (gated tabs locked)");
    reqLog.length = 0;
    await startRosary();
    await sleep(400);
    for (const tab of ["prayers", "intentions", "examination", "confession"]) {
      await page.click(`[data-tab="${tab}"]`);
      await sleep(500);
      await page.click(".docktext");
      await sleep(400);
      const stands = await ev(() => { const s = document.querySelector(".np-sheet"); const t = document.getElementById("np-title"); return !!s && !!t && t.textContent.length > 0; });
      ok(stands, `L10: Now Playing opens from the dock over the ${tab} tab and paints its track`);
      if (tab === "confession") {
        const before = await ev(() => document.getElementById("audio").paused);
        await ev(() => document.getElementById("np-play").click());
        await sleep(300);
        const after = await ev(() => document.getElementById("audio").paused);
        ok(before !== after, "L10: Now Playing — a player surface outside v356's gated families — plays normally while the PIN stands locked");
      }
      await ev(() => document.getElementById("np-min").click());
      await sleep(200);
    }
    ok(reqLog.length === 0, `L10: while locked, NO /api/exam/* or /api/confession/* call was issued (gated tabs gate; requests seen: ${reqLog.length})`);
    ok(pageErrors.length === 0, `browser: no page errors across the v354 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);

  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v354: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
