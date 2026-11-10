#!/usr/bin/env node
// harness-v350 — the v350 gate: Bible in a Year courier resolution
// (v348 pattern) + the resolve-watchdog false-missing fix.
// Defect (John, 2026-11-10 04:14 CT): Bible in a Year reads
// unavailable though Day 314 stands in the Fireside feed.
// W1: live payload carries the Bible entry (raw item title +
// pick enclosure) and the audio pass-through serves the same
// enclosure's bytes — one pick by construction.
// L1: with the browser's direct Fireside fetch ABORTED, the slot
// still settles present via the courier, the display title is
// built by the standing construction, and the page issues ZERO
// Fireside requests. (Pristine: the direct leg aborts -> missing.)
// L2: with the pick enclosure DRIPPED over ~15 s, the slot never
// reads missing while its download is in flight — it stands
// 'downloading' across the 9 s watchdog mark and settles present
// when the download lands. (Pristine: the watchdog settles it
// named-missing at ~9 s while the download is healthy.)
// L3: prior-year pin (regression) — with no current-year Day N
// item, the slot stands named-missing and never presents the
// prior-year episode.
// L4: cache round-trip — the day-cache record carries the pick
// enclosure and a second open re-settles present from it.
// L5: SW pin ora-pro-nobis-v350-1.
// L6: live smoke — a seam-free-payload instance over the REAL
// live feed bytes (node-fetched) resolves today's Day N present.
// Mold: harness-v348 (estate wrangler, LOCAL_DEV, fixture feeds,
// HTTPS site). Runs only inside a release worktree.
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v350 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const ESBUILD = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild";
const PORT = 8999, FEED_PORT = 8959, PORT2 = 8998, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, BASE2 = `http://127.0.0.1:${PORT2}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v350");
const PERSIST2 = path.join(APP, ".wrangler-test-v350-live");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v350-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chicagoParts = (d) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
const isoOf = (p) => `${p.year}-${p.month}-${p.day}`;
const TODAY = isoOf(chicagoParts(new Date()));
const YEAR = Number(TODAY.slice(0, 4));
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
const DAYN = doyOf(TODAY) > 365 ? 365 : doyOf(TODAY);

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
const apiRaw = async (base, p) => {
  const res = await fetch(base + p, { redirect: "manual" });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
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
function startApp(appDir, port, persist, liveMap) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"];
  if (liveMap) {
    args.push("--var", `EXT_DO_FEED_URL:${FEED}/live-do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/live-biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/live-sth.xml`);
  } else {
    args.push("--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`,
      "--var", `EXT_DGE_FEED_URL:${FEED}/dge.xml`, "--var", `EXT_SAINT_FEED_URL:${FEED}/saint.xml`,
      "--var", `EXT_USCCB_FEED_URL:${FEED}/usccb.xml`, "--var", `EXT_TVMASS_FEED_URL:${FEED}/tvmass.xml`,
      "--var", `EXT_FRMIKE_FEED_URL:${FEED}/frmike.xml`, "--var", `EXT_BARRON_FEED_URL:${FEED}/barron.xml`);
  }
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

// ---- external fixture feeds -------------------------------------
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
  xitem(readingsTitle(shift(TODAY, -1)), rfc(shift(TODAY, -1), 5), `${FEED}/audio/usccb-yday.mp3`));
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
const DGE_XML = rss(
  `<item><title>Fixture Exegesis — After-Day Decoy</title><pubDate>${rfc(TOMORROW, 6)}</pubDate><enclosure url="${FEED}/audio/dge-future.mp3" type="audio/mpeg" length="2000"/></item>` +
  `<item><title>Fixture Exegesis — Presented Day Pick</title><pubDate>${rfc(TODAY, 6)}</pubDate><enclosure url="${FEED}/audio/dge-pick.mp3" type="audio/mpeg" length="4242"/></item>`);
// The Bible fixture: the pick is Day N of the CURRENT year; decoys
// are the prior-year Day N (newer-positioned in feed order but the
// year pin rejects it) and the current-year Day N-1. Modes swap
// the pick's enclosure (fast tone vs the drip endpoint) or remove
// the current-year Day N item entirely (prior).
const BIAY_PICK_TITLE = `Day ${DAYN}: Fixture Reading (${YEAR})`;
const BIAY_FAST_ENC = `${FEED}/audio/biay-today.mp3`;
const BIAY_DRIP_ENC = `${FEED}/drip/biay.mp3`;
const biayXml = (mode) => rss(
  (mode === "prior" ? "" : xitem(BIAY_PICK_TITLE, rfc(TODAY, 6), mode === "drip" ? BIAY_DRIP_ENC : BIAY_FAST_ENC, 30983276)) +
  xitem(`Day ${DAYN}: Fixture Reading (${YEAR - 1})`, rfc(TODAY, 5), `${FEED}/audio/biay-prioryear.mp3`) +
  xitem(`Day ${DAYN - 1}: Fixture Reading (${YEAR})`, rfc(YDAY, 6), `${FEED}/audio/biay-yday.mp3`));
const biayState = { mode: "fast" };
const feedBytes = { sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")) };
const liveBytes = { do: null, biay: null, sth: null };

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
// NOTE (production parity, deliberate): /audio/ and /drip/ carry
// Access-Control-Allow-Origin: * — the production enclosure
// chains (podtrac -> fireside) send it at every hop, and the
// client's download routes are probed against that posture.
const feedServer = http.createServer((req, res) => {
  const u = new URL(req.url, FEED);
  const cors = { "access-control-allow-origin": "*" };
  const xml = (body) => { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(body); };
  if (u.pathname === "/do.xml") return xml(DO_XML);
  if (u.pathname === "/biay.xml") return xml(biayXml(biayState.mode));
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
  if (u.pathname === "/live-do.xml" && liveBytes.do) return xml(liveBytes.do);
  if (u.pathname === "/live-biay.xml" && liveBytes.biay) return xml(liveBytes.biay);
  if (u.pathname === "/live-sth.xml" && liveBytes.sth) return xml(liveBytes.sth);
  if (u.pathname === "/drip/biay.mp3") {
    // ~15 s drip of the 30 s tone: 4 KB every 500 ms.
    const buf = TONE_30;
    res.writeHead(200, { "content-type": "audio/mpeg", "content-length": String(buf.length), ...cors });
    let off = 0;
    const timer = setInterval(() => {
      const chunk = buf.subarray(off, off + 4096);
      off += chunk.length;
      if (chunk.length === 0 || off >= buf.length) { clearInterval(timer); res.end(chunk.length ? chunk : undefined); return; }
      res.write(chunk);
    }, 500);
    req.on("close", () => clearInterval(timer));
    return;
  }
  if (u.pathname.startsWith("/audio/")) {
    const name = u.pathname.slice(7);
    const buf = toneFor(name);
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (m) {
        const start = Number(m[1]); const end = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
        res.writeHead(206, { "content-type": "audio/mpeg", "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": String(end - start + 1), ...cors });
        return res.end(buf.subarray(start, end + 1));
      }
    }
    res.writeHead(200, { "content-type": "audio/mpeg", "accept-ranges": "bytes", "content-length": String(buf.length), ...cors });
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

// Node-side oracle for the live smoke: the standing matcher over
// arbitrary feed bytes (Day N + enclosure + current year; newest
// pubDate wins) — the same rule the Worker and client ports run.
function nodeMatchBible(xmlText, iso) {
  const [y, mo, d] = iso.split("-").map(Number);
  const doy = Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  const nn = doy > 365 ? 365 : doy;
  const pat = new RegExp(`\\bDay\\s*0*${nn}\\b`, "i");
  let best = null;
  for (const m of xmlText.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const title = ((/<title>([\s\S]*?)<\/title>/.exec(body) || [])[1] || "").replace(/\s+/g, " ").trim();
    const encM = /<enclosure\b([^>]*?)\/?>/.exec(body);
    const url = encM ? ((/url="([^"]*)"/.exec(encM[1]) || [])[1] || "") : "";
    if (!url || !pat.test(title)) continue;
    const years = title.match(/\b(20\d{2})\b/g);
    const pubM = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(body);
    const pubMs = pubM ? Date.parse(pubM[1].trim()) : null;
    const year = years ? Math.max(...years.map(Number)) : (pubMs != null && Number.isFinite(pubMs) ? new Date(pubMs).getUTCFullYear() : null);
    if (year !== y) continue;
    if (!best || (pubMs ?? -Infinity) > (best.pubMs ?? -Infinity)) best = { title, url, pubMs };
  }
  return best;
}

async function main() {
  let browser = null;
  try {
    execFileSync(ESBUILD, [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v350-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "setup: the Worker bundles clean (esbuild)");
    const clientJs = fs.readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
    ok(!clientJs.includes("feeds.fireside.fm"), "setup: the shipped client contains no Fireside feed URL (no on-device Bible feed read stands)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    applyMigs(APP, PERSIST, seedSql());
    startApp(APP, PORT, PERSIST, false);
    ok(await waitUp(BASE), "setup: app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `setup: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "setup: the served /app.js parses (vm.Script)");

    // ---- W1 · courier provenance + pass-through parity ----------
    const live = await api(BASE, "GET", `/api/player/externals/live?date=${TODAY}`);
    const bibleEntry = live.body && Array.isArray(live.body.slots)
      ? live.body.slots.find((e) => e.slotId === "ext-bible-in-a-year") : null;
    const pt = await apiRaw(BASE, `/api/player/externals/audio?date=${TODAY}&slot=ext-bible-in-a-year`);
    ok(live.status === 200 && !!bibleEntry && bibleEntry.state === "present"
      && bibleEntry.streamUrl === BIAY_FAST_ENC && bibleEntry.title === BIAY_PICK_TITLE
      && pt.status === 200 && pt.buf.equals(TONE_16),
      `W1 courier provenance: the live payload carries the Bible entry present with the RAW item title and the pick enclosure, and the pass-through serves the same enclosure's bytes (entry=${JSON.stringify(bibleEntry)}, ptStatus=${pt.status}, ptBytesMatch=${pt.buf.equals(TONE_16)})`);

    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    browser = await chromium.launch({
      executablePath: CHROME, env: browserEnv,
      args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server", "--autoplay-policy=no-user-gesture-required",
        "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
    });
    // biayBrowser: 'serve' fulfills the browser's direct Fireside
    // read with the current fixture mode; 'abort' fails it (the
    // L1 failure injection). firesideReqs counts browser requests.
    const browserState = { biay: "serve" };
    const firesideReqs = { count: 0 };
    const wireContext = async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
      await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
      await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
      await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => {
        firesideReqs.count++;
        if (browserState.biay === "abort") return route.abort();
        if (browserState.biay === "live") return route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: liveBytes.biay });
        return route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: biayXml(biayState.mode) });
      });
      await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: TONE_16 }));
      return ctx;
    };
    const bibleState = (page) => page.evaluate(() => {
      const st = (window.state && window.state.extSlots || {})["ext-bible-in-a-year"];
      const card = document.querySelector('[data-card="ext-bible-in-a-year"]');
      return { state: st ? st.state : null, title: st ? st.title : null, enc: st ? (st.enclosureUrl || null) : null,
        cardText: card ? card.textContent : "" };
    }).catch(() => ({ state: null, title: null, enc: null, cardText: "" }));
    const waitBible = async (page, want, ms = 45000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const s = await bibleState(page);
        if (s.state === want) return s;
        await sleep(400);
      }
      return bibleState(page);
    };

    // ---- L1 · courier resolution under direct-leg failure -------
    browserState.biay = "abort";
    firesideReqs.count = 0;
    const ctxA = await wireContext();
    const pageA = await ctxA.newPage();
    const errorsA = [];
    pageA.on("pageerror", (e) => errorsA.push(String(e)));
    await pageA.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const l1 = await waitBible(pageA, "present");
    ok(l1.state === "present" && l1.enc === BIAY_FAST_ENC
      && l1.title === `Bible in a Year — Day ${DAYN}: Fixture Reading`
      && firesideReqs.count === 0,
      `L1 courier resolution: with the browser's direct Fireside fetch aborted, the Bible slot settles present from the Worker payload with the constructed display title and the pick enclosure, and the page issued ZERO Fireside requests (state=${l1.state}, title=${JSON.stringify(l1.title)}, enc=${l1.enc}, firesideReqs=${firesideReqs.count})`);

    // ---- L4 · cache round-trip (same context, second open) ------
    const rec1 = await pageA.evaluate(() => JSON.parse(localStorage.getItem("opn-ext-cache-v1") || "null"));
    await pageA.reload({ waitUntil: "domcontentloaded" });
    const l4 = await waitBible(pageA, "present");
    ok(!!rec1 && rec1.slots && rec1.slots["ext-bible-in-a-year"]
      && rec1.slots["ext-bible-in-a-year"].streamUrl === BIAY_FAST_ENC
      && l4.state === "present" && l4.enc === BIAY_FAST_ENC,
      `L4 cache round-trip: the day-cache record carries the pick enclosure (not a pass-through URL) and a second open re-settles the Bible slot present from it (rec=${rec1 && rec1.slots && rec1.slots["ext-bible-in-a-year"] && rec1.slots["ext-bible-in-a-year"].streamUrl}, after=${JSON.stringify({ state: l4.state, enc: l4.enc })})`);
    await ctxA.close().catch(() => {});

    // ---- L2 · watchdog: a slow download is not a missing slot ---
    biayState.mode = "drip";
    browserState.biay = "serve";
    const ctxB = await wireContext();
    const pageB = await ctxB.newPage();
    await pageB.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const timeline = [];
    const t0 = Date.now();
    let finalB = null;
    while (Date.now() - t0 < 45000) {
      const s = await bibleState(pageB);
      const el = Math.round(Date.now() - t0);
      if (!timeline.length || timeline[timeline.length - 1].state !== s.state) timeline.push({ at: el, state: s.state });
      if (s.state === "present") { finalB = s; break; }
      await sleep(300);
    }
    const at11 = timeline.filter((x) => x.at <= 11500).pop();
    const sawMissing = timeline.some((x) => x.state === "missing");
    ok(!!finalB && !sawMissing && !!at11 && at11.state === "downloading",
      `L2 watchdog: with the pick enclosure dripped over ~15 s, the Bible slot stands 'downloading' across the 9 s watchdog mark and settles present when the download lands — it never reads missing in flight (timeline=${JSON.stringify(timeline)})`);
    biayState.mode = "fast";
    await ctxB.close().catch(() => {});

    // ---- L3 · prior-year pin (regression) ------------------------
    biayState.mode = "prior";
    const ctxC = await wireContext();
    const pageC = await ctxC.newPage();
    await pageC.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const l3 = await waitBible(pageC, "missing");
    ok(l3.state === "missing" && l3.title === `Bible in a Year — Day ${DAYN}`
      && l3.cardText.includes("Not available today") && !l3.cardText.includes(`(${YEAR - 1})`),
      `L3 prior-year pin: with no current-year Day ${DAYN} item standing, the slot stands named-missing for Day ${DAYN} and last year's episode is never presented (state=${l3.state}, title=${JSON.stringify(l3.title)}, card=${l3.cardText.slice(0, 90)})`);
    biayState.mode = "fast";
    await ctxC.close().catch(() => {});

    // ---- L5 · SW pin ---------------------------------------------
    const sw = (await api(BASE, "GET", "/sw.js")).text;
    ok(sw.includes("ora-pro-nobis-v350-1") && !sw.includes("ora-pro-nobis-v348-1"),
      "L5 SW pin: the served service worker carries CACHE 'ora-pro-nobis-v350-1' and no 'ora-pro-nobis-v348-1'");
    ok(errorsA.length === 0, `evidence: the L1 browser run completed with zero page errors${errorsA.length ? " — " + errorsA.join(" | ") : ""}`);

    // ---- L6 · live smoke over the real feed bytes ----------------
    try {
      const fetchLive = async (url) => {
        const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (harness-v350 live smoke)" } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      };
      liveBytes.biay = await fetchLive("https://feeds.fireside.fm/bibleinayear/rss");
      liveBytes.do = await fetchLive("https://divineoffice.org/feed/podcast/");
      liveBytes.sth = await fetchLive("https://feeds.castos.com/x8g54");
      const expect = nodeMatchBible(liveBytes.biay, TODAY);
      ok(!!expect, `L6 live smoke setup: the node oracle finds today's Day ${DAYN} in the live Fireside bytes (${expect && expect.title})`);
      if (expect) {
        applyMigs(APP, PERSIST2, seedSql());
        startApp(APP, PORT2, PERSIST2, true);
        ok(await waitUp(BASE2), "L6 live smoke: the second instance is up over the live feed bytes");
        await api(BASE2, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
        browserState.biay = "live";
        const ctxL = await wireContext();
        const pageL = await ctxL.newPage();
        await pageL.goto(BASE2 + "/", { waitUntil: "domcontentloaded" });
        const l6 = await waitBible(pageL, "present", 60000);
        const wantTitle = expect.title.startsWith("Day")
          ? `Bible in a Year — Day ${DAYN}: ` + expect.title.slice(expect.title.indexOf(":") + 1).trim().replace(/\s*\((?:19|20)\d{2}\)\s*$/, "")
          : expect.title;
        ok(l6.state === "present" && l6.enc === expect.url && l6.title === wantTitle,
          `L6 live smoke: against the REAL live feed bytes the Bible slot resolves present for ${TODAY} with the Day ${DAYN} pick (state=${l6.state}, title=${JSON.stringify(l6.title)}, enc=${l6.enc})`);
        await ctxL.close().catch(() => {});
      }
    } catch (e) {
      ok(false, `L6 live smoke: the live feed fetch or run failed (${e.message})`);
    }
  } catch (e) {
    n++; fails++; console.log(`not ok ${n} - harness crashed: ${e.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
    try { feedServer.close(); } catch { /* noop */ }
    try { if (siteServer) siteServer.close(); } catch { /* noop */ }
    await sleep(500);
  }
  console.log(`TALLY: ${n - fails} ok / ${fails} FAIL (${n} checks)`);
  process.exit(fails ? 1 : 0);
}

main();
