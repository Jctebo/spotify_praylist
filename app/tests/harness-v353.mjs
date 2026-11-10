#!/usr/bin/env node
// harness-v353 — the v353 gate. Proves the v353 §2 Plan (UI overhaul B): the
// Listening home (Listen title, Play All row, search pill, the Continue slot,
// block cards in payload order, episodes card), one page per block (gradient
// block-page header anatomy, BYTE-IDENTICAL v343 row shapes, settings-card
// insertion landing on the standing page), the episodes page form, the v355
// restore under the new home (Continue renders EMPTY while a restored queue
// stands), the floating mini-player restyle (ids/handlers untouched), the PIN
// gate seam in new chrome (harness-v356's 73 legs are the proof obligation and
// run in the regression family), Intentions in Library list language with
// standing behavior, Settings rows in list language, NEW in-app search (§2.6,
// presented-day corpus only), and the floors/contrast contract on B's new
// surfaces. Mold = harness-v355 (local wrangler + fixture feeds + HTTPS site
// server on https://orapronobis.media). Ports: app 8993, feed 8953, persist
// .wrangler-test-v353. SW pin ora-pro-nobis-v353-1.
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
const PORT = 8993, FEED_PORT = 8953, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v353");
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
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v353-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
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
    ok(swJs.includes("ora-pro-nobis-v353-1"), "SW pin: the served service worker carries CACHE 'ora-pro-nobis-v353-1'");

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

    // ================= v353 legs (Plan §2.12, L1–L12) =================
    page.on("dialog", (d) => d.accept());
    const qblocks = () => ev(() => window.state.queue.map((d) => d.block));
    const payloadBlocks = await ev(() => (window.state.dayPayload.blocks || []).map((b) => b.block));

    // ---- L1 · home form -------------------------------------------
    const order1 = await ev(() => Array.from(document.querySelectorAll(".blockcard")).map((c) => c.getAttribute("data-openblock")));
    ok(eq(order1.slice(0, 8), payloadBlocks) && order1.length === 9 && order1[8] === "__episodes",
      `L1 home form: block cards stand in payload order, episodes card last (cards=${JSON.stringify(order1)})`);
    const ana1 = await ev(() => {
      const c = document.querySelector('.blockcard[data-openblock="Morning"]');
      if (!c) return null;
      return {
        face: !!c.querySelector(".blockcard-face"), name: c.querySelector(".blockcard-name").textContent,
        bcount: c.querySelector("[data-bcount]").textContent, bprayed: !!c.querySelector("[data-bprayed]"),
        play: c.querySelector(".blockcard-play") && c.querySelector(".blockcard-play").getAttribute("data-queue"),
      };
    });
    ok(ana1 && ana1.face && /MORNING/.test(ana1.name) && /tracks/.test(ana1.bcount) && ana1.bprayed && ana1.play === "Morning",
      "L1: a card carries its gradient face, name, caption + settled count span, heard span, and a block play button");
    await seedPlayed(["daily-rosary"]);
    await ev(() => window.refreshPlayedChrome());
    const cont1 = await ev(() => {
      const slot = document.getElementById("continue-slot");
      const grid = document.querySelector(".blockgrid");
      return { html: slot ? slot.innerHTML : null, seeQueue: !!document.getElementById("continue-queue"),
        before: !!(slot && grid && (slot.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING)) };
    });
    ok(cont1.html && cont1.html.includes("Continue") && cont1.before && cont1.seeQueue,
      "L1: the Continue card stands in its slot BEFORE the block cards when its gate stands (Decision 2 order), See queue door standing");
    await clearPlayed(); await ev(() => window.refreshPlayedChrome());

    // ---- L2 · block page ------------------------------------------
    await api(BASE, "POST", "/api/agent/prayer/liturgical-day", { token: TOKEN, json: { date: TODAY, dayName: "Fixture Memorial", color: "white" } });
    await page.reload({ waitUntil: "domcontentloaded" });
    ok((await waitReady(page)).ready, "L2 setup: re-boot with a liturgical day standing (the gradient head needs a color standing; without one the v352 flat-navy fallback stands)");
    await page.click('.blockcard[data-openblock="Morning"] .blockcard-face');
    const l2 = await ev(() => {
      const head = document.querySelector(".blockpage-head");
      const sp = (window.state.dayPayload.blocks || []).find((b) => b.block === "Morning");
      return {
        headBlock: head && head.getAttribute("data-block"), gradient: head ? getComputedStyle(head).backgroundImage : "",
        title: head && head.querySelector(".blockpage-title").textContent,
        meta: head && head.querySelector(".blockpage-meta").textContent,
        queue: !!head.querySelector('[data-queue="Morning"]'), mark: !!head.querySelector('[data-markblock="Morning"]'),
        spot: !!head.querySelector("a.spot"), spotExpected: !!sp.spotifyUrl,
        rosary: !!document.querySelector('[data-card="daily-rosary"]'),
        invitatory: !!document.querySelector('[data-card="ext-invitatory"]'),
        auxilium: !!document.querySelector('[data-card="auxilium-christianorum"]'),
        viewKind: window.state.prayersView.kind,
      };
    });
    ok(l2.headBlock === "Morning" && /gradient/.test(l2.gradient) && /MORNING/.test(l2.title) && /tracks/.test(l2.meta) && l2.queue && l2.mark && l2.spot === l2.spotExpected,
      `L2 block page: liturgical-gradient header with name, meta (dateLabel · caption · N · heard), Play All, Mark all played, Spotify link iff in payload (debug=${JSON.stringify(l2)})`);
    ok(l2.rosary && l2.invitatory && !l2.auxilium && l2.viewKind === "block",
      "L2: rows are that block's tracks only (payload + settled settings cards; another block's track absent)");
    await page.click('[data-back="Morning"]');
    const back2 = await ev(() => {
      const card = document.querySelector('.blockcard[data-openblock="Morning"]');
      return { home: !!document.querySelector(".blockgrid"), top: card ? card.getBoundingClientRect().top : -999 };
    });
    ok(back2.home && back2.top >= -2 && back2.top < 844, "L2: Back returns home with the returning block's card scrolled into view");

    // ---- L3 · rows intact on the page ------------------------------
    await page.click('.blockcard[data-openblock="Morning"] .blockcard-face');
    const l3 = await ev(() => {
      const row = document.querySelector('.card.intro-row[data-card="daily-rosary"]');
      if (!row) return null;
      const panel = row.querySelector(".intention-panel");
      const txt = row.querySelector(".intention-text");
      const ell = row.querySelector(".ellipsis-btn");
      const prayerBtn = row.querySelector('[data-playkey="daily-rosary"]');
      const pr = panel.getBoundingClientRect(), br = prayerBtn.getBoundingClientRect();
      return {
        h: row.offsetHeight, panelFirst: pr.right <= br.left + 1, panelW: pr.width / row.getBoundingClientRect().width,
        panelPlay: !!row.querySelector('[data-playkey="intro:daily-rosary"]'),
        clamped: txt.scrollHeight > txt.clientHeight + 1, ellStands: ell.classList.contains("stands"),
        dot: !!row.querySelector('[data-markplayed="daily-rosary"]'),
      };
    });
    ok(l3 && Math.abs(l3.h - 136) <= 1 && l3.panelFirst && l3.panelW > 0.2 && l3.panelW < 0.3 && l3.panelPlay,
      `L3: the combined row measures 136px, panel FIRST at ~25% with its own play button (h=${l3 && l3.h}, panelW=${l3 && l3.panelW.toFixed(3)})`);
    ok(l3 && l3.clamped && l3.ellStands && l3.dot,
      "L3: the intention text is capped at two lines and the ellipsis stands because it is clamped; the played dot stands");
    const exp3 = await ev(() => { document.querySelector('.card.intro-row[data-card="daily-rosary"] .ellipsis-btn').click(); return document.querySelector('.card.intro-row[data-card="daily-rosary"]').classList.contains("expanded"); });
    ok(exp3, "L3: the ellipsis expands the row in place");
    await ev(() => document.querySelector('[data-markplayed="daily-rosary"]').click());
    const dotOn = await ev(() => document.querySelector('[data-markplayed="daily-rosary"]').classList.contains("on"));
    await ev(() => document.querySelector('[data-markplayed="daily-rosary"]').click());
    const dotOff = await ev(() => document.querySelector('[data-markplayed="daily-rosary"]').classList.contains("on"));
    ok(dotOn && !dotOff, "L3: the played dot toggles on and off");
    const rd3 = await ev(() => { const b = document.querySelector('[data-card="daily-rosary"] [data-read]'); if (!b) return "no-read"; b.click(); return "clicked"; });
    await sleep(700);
    const sheet3 = await ev(() => !!document.querySelector(".readsheet"));
    await ev(() => { const c = document.querySelector("[data-readclose]"); if (c) c.click(); });
    ok(rd3 === "clicked" && sheet3, "L3: Read opens the reading sheet");
    let unavail3 = "";
    for (const b of payloadBlocks) {
      const r = await ev((blk) => { window.openBlockPage(blk); return !!document.querySelector(".notavail"); }, b);
      if (r) { unavail3 = b; break; }
    }
    ok(!!unavail3, `L3: an unavailable track shows its standing panel-free form (first found on ${unavail3 || "none"})`);
    await ev(() => window.goListenHome());

    // ---- L4 · play paths -------------------------------------------
    await page.reload({ waitUntil: "domcontentloaded" });
    ok((await waitReady(page)).ready, "L4 setup: clean re-boot reaches readiness");
    await ev(() => document.querySelector('.blockcard[data-openblock="Morning"] .blockcard-play').click());
    await sleep(600);
    const s4a = await q(); const qb4a = await qblocks();
    const view4 = await ev(() => window.state.prayersView.kind);
    ok(s4a.q.length > 0 && qb4a.every((b) => b === "Morning") && view4 === "home",
      `L4: the card play button starts the block queue WITHOUT navigating (q=${s4a.q.length} Morning descriptors, view=${view4})`);
    await stopQ();
    await ev(() => window.openBlockPage("Morning"));
    await ev(() => document.querySelector('.blockpage-head [data-queue="Morning"]').click());
    await sleep(600);
    const qb4b = await qblocks();
    ok(qb4b.length > 0 && qb4b.every((b) => b === "Morning"), "L4: the page Play All queues the same block from the page");
    await stopQ();
    await ev(() => window.goListenHome());
    await ev(() => document.getElementById("play-all").click());
    await sleep(600);
    const qb4c = await qblocks();
    ok(qb4c.length > 8 && new Set(qb4c).size > 1, `L4: whole-day Play All unchanged — it spans the blocks (${qb4c.length} descriptors, ${new Set(qb4c).size} blocks)`);
    await stopQ();

    // ---- L5 · tap-a-track (the v351 rule) ---------------------------
    await ev(() => window.openBlockPage("Morning"));
    const tap5 = await tapBtn("marian-antiphon-angelus");
    await sleep(600);
    const s5 = await q();
    ok(tap5 === "ok" && s5.q[0] === "intro:marian-antiphon-angelus" && s5.q[1] === "marian-antiphon-angelus" && !s5.q.includes("daily-rosary"),
      `L5: a mid-block tap queues from that track inclusive, intention intro first, stopping at the block's end (head=${JSON.stringify(s5.q.slice(0, 2))})`);
    ok((await qblocks()).every((b) => b === "Morning"), "L5: the tap queue stays inside the block");
    await stopQ();
    const tap5b = await tapBtn("daily-rosary", "intro:daily-rosary");
    await sleep(600);
    const s5b = await q();
    ok(tap5b === "ok" && s5b.q[0] === "intro:daily-rosary" && s5b.q[1] === "daily-rosary",
      "L5: tapping the intention panel's own play button starts the pair");
    await stopQ();

    // ---- L6 · mini-player -------------------------------------------
    await tapBtn("daily-rosary");
    await sleep(800);
    const l6 = await ev(() => {
      const dock = document.getElementById("dock");
      const tab = document.getElementById("tabbar");
      const dr = dock.getBoundingClientRect(), tr = tab.getBoundingClientRect();
      return {
        hidden: dock.classList.contains("hidden"), left: dr.left, radius: getComputedStyle(dock).borderRadius,
        gap: tr.top - dr.bottom, fill: !!document.getElementById("dock-progress-fill"),
        cur: window.state.current && window.state.current.episodeId,
        ids: ["dock", "dock-title", "dock-meta", "dock-play", "dock-next", "dock-progress-fill"].every((id) => !!document.getElementById(id)),
      };
    });
    ok(!l6.hidden && l6.ids && Math.abs(l6.left - 10) <= 1 && l6.radius === "12px" && Math.abs(l6.gap - 8) <= 2 && l6.fill && (l6.cur === "intro:daily-rosary" || l6.cur === "daily-rosary"),
      `L6 mini-player: the floating dock stands with every standing id, 10px inset, 12px radius, clearing the tab bar by 8px (debug=${JSON.stringify(l6)})`);
    await page.click(".docktext");
    await sleep(400);
    ok(await ev(() => !!document.querySelector(".np-sheet")), "L6: a dock tap (outside play/next) opens Now Playing");
    await ev(() => document.getElementById("np-min").click());
    const pausedBefore = await ev(() => document.getElementById("audio").paused);
    await ev(() => document.getElementById("dock-play").click());
    await sleep(300);
    const pausedAfter = await ev(() => document.getElementById("audio").paused);
    ok(pausedBefore !== pausedAfter, "L6: the dock play button toggles playback; the dock next button stands wired (ids check above)");
    const recNow = await rec();
    ok(recNow && Array.isArray(recNow.ids) && recNow.ids.length > 0, "L6 setup: the app wrote its queue snapshot record during play");
    await page.reload({ waitUntil: "domcontentloaded" });
    const rst6 = await waitRestored(page);
    const l6b = await ev(() => ({
      flag: window.state.restoredQueue, paused: document.getElementById("audio").paused,
      dockHidden: document.getElementById("dock").classList.contains("hidden"),
      slot: document.getElementById("continue-slot") ? document.getElementById("continue-slot").innerHTML : "no-slot",
      title: document.getElementById("dock-title").textContent,
    }));
    ok(rst6 && l6b.flag && l6b.paused && !l6b.dockHidden && l6b.slot === "" && !!l6b.title,
      "L6: after a reload the restored queue stands paused in the mini-player (v355 restore, displayed by the restyle)");
    ok(l6b.slot === "", "L1 (restored rule): while a restored queue stands the Continue slot renders EMPTY — the restored queue wins");
    await wipe();

    // ---- L7 · queue doors -------------------------------------------
    await page.reload({ waitUntil: "domcontentloaded" });
    ok((await waitReady(page)).ready, "L7 setup: clean re-boot reaches readiness");
    await seedPlayed(["daily-rosary"]);
    await ev(() => window.refreshPlayedChrome());
    await ev(() => document.getElementById("continue-queue").click());
    await sleep(500);
    const l7 = await ev(() => ({
      sheet: !!document.querySelector(".np-sheet"),
      rows: document.querySelectorAll("#np-queue [data-npq-index]").length,
      preview: !!window.state.previewQueue,
    }));
    ok(l7.sheet && l7.rows > 0 && l7.preview, `L7: Continue's See queue opens the preview sheet from home (${l7.rows} rows)`);
    await ev(() => document.querySelector('#np-queue [data-npq-index="0"]').click());
    await sleep(600);
    const s7 = await q();
    const previewGone = await ev(() => !window.state.previewQueue);
    ok(s7.q.length > 0 && previewGone, "L7: a preview row tap starts the queue at that row");
    await ev(() => window.openNowPlaying());
    await sleep(400);
    const rows7 = await ev(() => document.querySelectorAll("#np-queue [data-npq-index]").length);
    ok(rows7 === s7.q.length && rows7 > 1, `L7: Now Playing's queue list renders the standing queue (${rows7} rows)`);
    const idxBefore = await ev(() => window.state.queueIdx);
    await ev(() => document.querySelector('#np-queue [data-npq-index="1"]').click());
    await sleep(400);
    const idxAfter = await ev(() => window.state.queueIdx);
    ok(idxBefore === 0 && idxAfter === 1, "L7: a queue-list row tap jumps the queue to that track");
    await stopQ();
    await clearPlayed(); await ev(() => window.refreshPlayedChrome());

    // ---- L9 · gated tabs in the new chrome --------------------------
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
    ok(true, "L9 setup: a PIN stands set through the real Settings flow (recovery code shown once)");
    const reqLog = [];
    page.on("request", (r) => { if (r.url().includes("/api/exam") || r.url().includes("/api/confession")) reqLog.push(r.url()); });
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(600);
    reqLog.length = 0;
    await page.click('[data-tab="examination"]');
    await page.waitForSelector("#pingate-card", { timeout: 15000 });
    ok(reqLog.length === 0, "L9: with a PIN set, the Examination tap paints the gate and issues NO /api/exam/* call while locked");
    const gateIds = await ev(() => ["pindots", "pinpad", "pinmsg", "pin-unlock", "pin-forgot"].every((id) => !!document.getElementById(id)));
    ok(gateIds, "L9: the gate stands in the new chrome with every standing id (the seam is styling only)");
    for (const d of "246810") await page.click(`[data-pinkey='${d}']`);
    await page.click("#pin-unlock");
    await page.waitForSelector(".prompt", { timeout: 15000 });
    const examChrome = await ev(() => !!document.querySelector("h2.sectionhead"));
    ok(examChrome, "L9: the unlock paints the Examination content in the new chrome");
    await page.click('[data-tab="confession"]');
    await page.waitForSelector("text=Act of Contrition", { timeout: 15000 });
    ok(true, "L9: Confession opens on the same unlock — one unlock opens both tabs");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.click('[data-tab="examination"]');
    await page.waitForSelector("#pingate-card", { timeout: 15000 });
    ok(true, "L9: a reload re-locks — the gate stands again (memory-only token)");

    // ---- L10 · Settings ----------------------------------------------
    await page.click("#gearbtn");
    await page.waitForSelector(".liblist .setrow", { timeout: 15000 });
    const l10 = await ev(() => ({
      heads: document.querySelectorAll("h2.sectionhead").length,
      rows: document.querySelectorAll(".liblist .setrow").length,
      pinSection: !!document.getElementById("pin-section"),
      verText: Array.from(document.querySelectorAll(".meta")).map((m) => m.textContent).find((t) => t.indexOf("Settings version") === 0) || "",
    }));
    ok(l10.heads > 0 && l10.rows > 10 && l10.pinSection && /Settings version \d+/.test(l10.verText),
      `L10: Settings rows render in list form inside shared section headers (${l10.rows} rows, ${l10.heads} sections); the PIN section stands at the end`);
    const ver0 = Number((l10.verText.match(/\d+/) || [0])[0]);
    const firstKey = await ev(() => document.querySelector(".liblist .setrow").getAttribute("data-setkey"));
    await ev(() => document.querySelector('.liblist .setrow [data-setact="toggle"]').click());
    await page.waitForSelector(".liblist .setrow", { timeout: 10000 });
    await ev((k) => document.querySelector(`[data-setkey="${k}"] [data-setact="toggle"]`).click(), firstKey);
    await page.waitForSelector(".liblist .setrow", { timeout: 10000 });
    await ev(() => { const b = document.querySelector('.liblist .setrow [data-setact="down"]:not([disabled])'); if (b) b.click(); });
    await page.waitForSelector(".liblist .setrow", { timeout: 10000 });
    await ev(() => document.getElementById("set-save").click());
    await page.waitForFunction((v) => document.body.innerText.includes("Saved — settings version " + (v + 1)), ver0, { timeout: 15000 });
    ok(true, "L10: a toggle + a move + Save round-trips — the settings version increments by the standing save rule and the rows re-read");

    // ---- L8 · Intentions library --------------------------------------
    await page.click('[data-tab="intentions"]');
    await page.waitForSelector(".liblist .librow", { timeout: 15000 });
    const l8 = await ev(() => ({
      rows: document.querySelectorAll(".liblist .librow").length,
      lists: document.querySelectorAll(".liblist").length,
      stats: document.querySelector(".stats").textContent,
    }));
    ok(l8.rows === 11 && l8.lists >= 3 && /High/.test(l8.stats) && /Medium/.test(l8.stats) && /Low/.test(l8.stats),
      `L8 Intentions: the pool renders in Library list language — ${l8.rows} rows in ${l8.lists} group lists, the stats strip standing`);
    await ev(() => document.querySelector('.liblist .librow [data-act="edit"]').click());
    await page.waitForSelector("#ed-text", { timeout: 10000 });
    await page.fill("#ed-text", "Edited fixture intention");
    await ev(() => document.getElementById("ed-save").click());
    await page.waitForFunction(() => document.body.innerText.includes("Edited fixture intention"), null, { timeout: 15000 });
    ok(true, "L8: Edit opens the editor sheet and the save renders the new text in place");
    await ev(() => document.querySelector('.librow [data-act="retire"]').click());
    await page.waitForFunction(() => Array.from(document.querySelectorAll("h2.sectionhead")).some((h) => h.textContent === "RETIRED"), null, { timeout: 15000 });
    const retiredCount = await ev(() => { const lists = document.querySelectorAll(".liblist"); return lists[lists.length - 1].querySelectorAll(".librow").length; });
    ok(retiredCount === 1, "L8: Retire moves the row to the Retired group");
    await ev(() => document.querySelector('[data-act="restore"]').click());
    await page.waitForFunction(() => !document.querySelector('[data-act="restore"]'), null, { timeout: 15000 });
    ok(true, "L8: Restore returns the row to its priority group");
    await page.fill("#new-text", "A brand new fixture intention");
    await ev(() => document.getElementById("new-add").click());
    await page.waitForFunction(() => document.body.innerText.includes("A brand new fixture intention"), null, { timeout: 15000 });
    ok(true, "L8: Add posts a new intention and it renders in its group");
    const beforeDel = await ev(() => document.querySelectorAll(".liblist .librow").length);
    await ev(() => { const r = Array.from(document.querySelectorAll(".librow")).find((x) => x.textContent.includes("A brand new fixture intention")); r.querySelector('[data-act="del"]').click(); });
    await page.waitForFunction((n) => document.querySelectorAll(".liblist .librow").length === n - 1, beforeDel, { timeout: 15000 });
    ok(true, "L8: Delete (confirmed) removes the row — every pool function stands in the list language");

    // ---- L11 · search --------------------------------------------------
    await page.click('[data-tab="prayers"]');
    await page.waitForSelector("#day-search", { timeout: 20000 });
    ok((await waitReady(page)).ready, "L11 setup: the Prayers home stands ready");
    await page.fill("#day-search", "Novenas");
    await sleep(400);
    const s11a = await ev(() => ({
      groups: Array.from(document.querySelectorAll("h2.sectionhead")).map((h) => h.textContent),
      card: !!document.querySelector('.blockcard[data-openblock="Novenas"]'),
      slot: !!document.getElementById("continue-slot"),
    }));
    ok(s11a.groups.includes("BLOCKS") && s11a.card && !s11a.slot,
      "L11 search: a block label paints its card in the Blocks group; the home body is the results paint");
    await page.click('.blockcard[data-openblock="Novenas"] .blockcard-face');
    const s11b = await ev(() => window.state.prayersView);
    ok(s11b.kind === "block" && s11b.block === "Novenas", "L11: opening a block page from a result navigates");
    await ev(() => document.querySelector('[data-back="Novenas"]').click());
    const s11c = await ev(() => ({ q: document.getElementById("day-search").value, card: !!document.querySelector('.blockcard[data-openblock="Novenas"]') }));
    ok(s11c.q === "Novenas" && s11c.card, "L11: coming back returns to home WITH the query standing");
    await page.fill("#day-search", "Daily Rosary");
    await sleep(400);
    const s11d = await ev(() => ({ row: !!document.querySelector('[data-card="daily-rosary"]'), groups: Array.from(document.querySelectorAll("h2.sectionhead")).map((h) => h.textContent), q: window.state.searchQuery, rosaryTitle: ((window.state.dayPayload.blocks || []).find((b) => b.block === "Morning") || {}).tracks ? ((window.state.dayPayload.blocks || []).find((b) => b.block === "Morning").tracks.find((t) => t.episodeId === "daily-rosary") || {}).title : "n/a" }));
    ok(s11d.row && s11d.groups.includes("PRAYERS"), `L11: a track title paints its row in the Prayers group (debug=${JSON.stringify(s11d)})`);
    await ev(() => document.querySelector('[data-card="daily-rosary"] [data-playkey="daily-rosary"]').click());
    await sleep(600);
    const qb11 = await qblocks();
    ok(qb11.length > 0 && qb11.every((b) => b === "Morning"), "L11: a result row tap plays by the v351 rule within its block");
    await stopQ();
    await page.fill("#day-search", "Synthetic intention");
    await sleep(400);
    const s11e = await ev(() => document.querySelectorAll(".card.intro-row").length);
    ok(s11e > 0, `L11: an intention-text word paints the combined rows whose intros carry it (${s11e} rows)`);
    await page.fill("#day-search", "zzzqqq-nothing");
    await sleep(400);
    ok(await ev(() => document.body.innerText.includes("Nothing in today\u2019s prayers matches.")), "L11: a query with no matches paints the one plain line");
    await page.fill("#day-search", readingsTitle(shift(TODAY, 3)));
    await sleep(400);
    ok(await ev(() => document.body.innerText.includes("Nothing in today\u2019s prayers matches.")),
      "L11: a title standing only in a NON-presented fixture day never appears (presented-day corpus only)");
    await page.fill("#day-search", "");
    await sleep(400);
    const s11h = await ev(() => ({ slot: !!document.getElementById("continue-slot"), grid: !!document.querySelector(".blockgrid") }));
    ok(s11h.slot && s11h.grid, "L11: clearing the field restores the standing home paint (Continue + cards) from state, no refetch");

    // ---- L12 · floors + contrast ----------------------------------------
    const l12home = await ev(() => {
      const pick = (sel) => { const el = document.querySelector(sel); return el ? parseFloat(getComputedStyle(el).fontSize) : null; };
      return { body: parseFloat(getComputedStyle(document.body).fontSize), cap: pick(".blockcard-cap"), meta: pick(".blockcard-meta") };
    });
    await page.fill("#day-search", "Daily");
    await sleep(400);
    const headPx = await ev(() => { const el = document.querySelector(".sectionhead"); return el ? parseFloat(getComputedStyle(el).fontSize) : null; });
    await page.fill("#day-search", "");
    await sleep(300);
    const l12a = { body: l12home.body, cap: l12home.cap, meta: l12home.meta, head: headPx };
    ok(l12a.body === 17 && l12a.cap >= 13 && l12a.meta >= 13 && l12a.head === 16,
      `L12: body computes 17px; the new surfaces stand at the floors (cap ${l12a.cap}px, card meta ${l12a.meta}px, section head ${l12a.head}px)`);
    const lum = (hex) => { const c = hex.replace("#", ""); const v = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255).map((x) => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    for (const color of ["white", "red", "green", "violet", "rose"]) {
      const push = await api(BASE, "POST", "/api/agent/prayer/liturgical-day", { token: TOKEN, json: { date: TODAY, dayName: "Fixture " + color, color } });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector(".blockcard", { timeout: 20000 });
      const m = await ev(() => {
        const cs = getComputedStyle(document.documentElement);
        return { lit: document.documentElement.getAttribute("data-lit"), bg: cs.getPropertyValue("--bar-bg"), fg: cs.getPropertyValue("--bar-fg").trim(), sub: cs.getPropertyValue("--bar-sub").trim() };
      });
      const stops = m.bg.match(/#[0-9a-fA-F]{6}/g) || [];
      const ratios = stops.flatMap((s) => [contrast(m.fg, s), contrast(m.sub, s)]);
      const min = ratios.length ? Math.min(...ratios) : 0;
      ok(push.status === 200 && m.lit === color && stops.length >= 2 && min >= 4.5,
        `L12 ${color}: on the home card faces + block header token pairs, --bar-fg/--bar-sub vs both gradient ends >= 4.5:1 (min ${min.toFixed(2)})`);
      if (color === "white") {
        const navy = await ev(() => getComputedStyle(document.querySelector(".blockcard-name")).color);
        ok(navy === "rgb(22, 40, 63)", "L12 white: the face carries navy title text — never white/cream on cream");
      }
    }
    ok(pageErrors.length === 0, `browser: no page errors across the v353 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);

  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v353: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
