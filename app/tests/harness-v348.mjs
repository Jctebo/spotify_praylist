#!/usr/bin/env node
// harness-v348 — the v348 gate (Plan §2.5): merged cross-family
// sort (cards + queue), Worker-courier exegesis resolution, and
// the same-route passthrough download retry.
// L1-L10: Midmorning card order · Midmorning queue order ·
// present+playable pick · courier provenance + pass-through
// parity · zero Anchor requests from the page · failure-injected
// first download route still settles present · named-missing
// honesty · other blocks unchanged · cache round-trip · SW pin.
// Fixture posture: the standing estate mold (v344/v347) — local
// feed + HTTPS site servers, the presented day built client-side
// from the fixture feeds. The Anchor (dge) fixture is GENERATED
// production-shaped: 520 items, >= 3,168,254 bytes, with a
// no-enclosure later decoy and an after-day enclosed decoy.
// Scratch wrangler instance INSIDE the worktree, synthetic
// fixture only, tallies read from the COMPLETE log.
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v348 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997, FEED_PORT = 8957, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v348");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v348-"));
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
const TONE_PICK = tone("pick.mp3", 880, 2.0);
function toneFor(name) {
  if (name === "dge-pick.mp3") return TONE_PICK;
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
const feedBytes = { sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")) };

// ---- the GENERATED production-shaped Anchor (exegesis) fixture --
// 520 items, >= 3,168,254 bytes (the Step-1 measured production
// size). Exactly one pick: latest pubDate NOT after the presented
// day WITH an enclosure. Decoys: a LATER same-day item with NO
// enclosure (must be skipped) and an AFTER-day item WITH an
// enclosure (must be skipped). The rest are older enclosed items.
const PICK_TITLE = "Fixture Exegesis — Presented Day Pick";
const PICK_URL = `${FEED}/audio/dge-pick.mp3`;
function genDgeXml() {
  const pad = (s) => `<description>${"Fixture episode notes. ".repeat(s)}</description>`;
  const items = [];
  items.push(`<item><title>Fixture Exegesis — After-Day Decoy</title><pubDate>${rfc(TOMORROW, 6)}</pubDate><enclosure url="${FEED}/audio/dge-future.mp3" type="audio/mpeg" length="2000"/></item>`);
  items.push(`<item><title>Fixture Exegesis — No-Enclosure Decoy</title><pubDate>${rfc(TODAY, 7)}</pubDate></item>`);
  items.push(`<item><title>${PICK_TITLE}</title><pubDate>${rfc(TODAY, 6)}</pubDate>${pad(20)}<enclosure url="${PICK_URL}" type="audio/mpeg" length="4242"/></item>`);
  for (let i = 0; i < 517; i++) {
    const day = shift(TODAY, -1 - (i % 300));
    items.push(`<item><title>Fixture Exegesis — Archive ${i}</title><pubDate>${rfc(day, 6)}</pubDate>${pad(24)}<enclosure url="${FEED}/audio/dge-old-${i}.mp3" type="audio/mpeg" length="3000"/></item>`);
  }
  let xml = rss(items.join(""));
  // Pad the channel description until the byte floor stands.
  const floor = 3168254;
  if (Buffer.byteLength(xml) < floor) {
    const extra = floor - Buffer.byteLength(xml) + 64;
    xml = xml.replace("<title>Fixture</title>", `<title>Fixture</title><description>${"p".repeat(extra)}</description>`);
  }
  return xml;
}
const DGE_XML = genDgeXml();
const DGE_EMPTY_XML = rss(
  `<item><title>Fixture Exegesis — After-Day Only</title><pubDate>${rfc(TOMORROW, 6)}</pubDate><enclosure url="${FEED}/audio/dge-future.mp3" type="audio/mpeg" length="2000"/></item>` +
  `<item><title>Fixture Exegesis — No-Enclosure Today</title><pubDate>${rfc(TODAY, 7)}</pubDate></item>` +
  `<item><title>Fixture Exegesis — No-Enclosure Older</title><pubDate>${rfc(YDAY, 6)}</pubDate></item>`);
const dgeState = { mode: "main" };

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
  if (u.pathname === "/dge.xml") return xml(dgeState.mode === "empty" ? DGE_EMPTY_XML : DGE_XML);
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
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v348-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");
    const dgeBytes = Buffer.byteLength(DGE_XML);
    const dgeItems = (DGE_XML.match(/<item>/g) || []).length;
    ok(dgeItems === 520 && dgeBytes >= 3168254,
      `fixture: the generated Anchor feed is production-shaped (items=${dgeItems}, bytes=${dgeBytes}, floor=3168254)`);

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

    // ---- L4 (Worker half, node-side): live payload + parity -----
    const live = await api(BASE, "GET", `/api/player/externals/live?date=${TODAY}`);
    const liveEntry = live.body && Array.isArray(live.body.slots)
      ? live.body.slots.find((e) => e.slotId === "ext-gospel-exegesis") : null;
    const pt = await apiRaw(BASE, `/api/player/externals/audio?date=${TODAY}&slot=ext-gospel-exegesis`);
    ok(live.status === 200 && !!liveEntry && liveEntry.state === "present"
      && liveEntry.streamUrl === PICK_URL && liveEntry.title === PICK_TITLE
      && pt.status === 200 && pt.buf.equals(TONE_PICK),
      `L4 courier provenance: the live payload carries the exegesis entry present with the ITEM title and the pick enclosure, and the pass-through pick is the same enclosure by bytes (live=${JSON.stringify(liveEntry)}, ptStatus=${pt.status}, ptBytesMatch=${pt.buf.equals(TONE_PICK)})`);

    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    browser = await chromium.launch({
      executablePath: CHROME, env: browserEnv,
      args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server", "--autoplay-policy=no-user-gesture-required",
        "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
    });
    const wireContext = async (onExegesisAudio) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
      await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
      await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
      await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: BIAY_XML }));
      await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: TONE_16 }));
      if (onExegesisAudio) {
        await ctx.route(/\/api\/player\/externals\/audio/, async (route) => {
          const u = route.request().url();
          if (u.includes("slot=ext-gospel-exegesis")) return onExegesisAudio(route);
          return route.continue();
        });
      }
      return ctx;
    };
    const settled = async (page, want) => {
      for (let i = 0; i < 75; i++) {
        const done = await page.evaluate((w) => {
          const s = window.state && window.state.extSlots;
          const o = window.state && window.state.ownSlots;
          if (!s || !o) return false;
          const ex = s["ext-gospel-exegesis"];
          const mm = s["ext-midmorning-prayer"];
          const nov = o["novenas"];
          return !!ex && ex.state === w && !!mm && (mm.state === "present" || mm.state === "missing")
            && !!nov && nov.state === "present";
        }, want).catch(() => false);
        if (done) return true;
        await sleep(1000);
      }
      return false;
    };
    const blockCards = (page, blockName) => page.evaluate((bn) => {
      const heads = [...document.querySelectorAll(".blockhead")];
      const head = heads.find((h) => (h.querySelector("h2") || {}).textContent === bn.toUpperCase());
      if (!head) return [];
      const out = [];
      let el = head.nextElementSibling;
      while (el && !el.classList.contains("blockhead")) {
        if (el.dataset && el.dataset.card) out.push(el.dataset.card);
        el = el.nextElementSibling;
      }
      return out;
    }, blockName);
    const blockDescs = (page, blockName) => page.evaluate((bn) =>
      (window.state.dayDescs || []).filter((d) => d.block === bn).map((d) => d.episodeId), blockName);

    // ================= MAIN OPEN — L1/L2/L3/L5/L8 =================
    const ctxA = await wireContext(null);
    const pageA = await ctxA.newPage();
    const anchorReqs = [];
    const ptReqsA = [];
    pageA.on("request", (r) => {
      if (r.url().includes("anchor.fm")) anchorReqs.push(r.url());
      if (r.url().includes("/api/player/externals/audio") && r.url().includes("slot=ext-gospel-exegesis")) ptReqsA.push(r.url());
    });
    const pageErrors = [];
    pageA.on("pageerror", (e) => pageErrors.push(String(e)));
    await pageA.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    ok(await settled(pageA, "present"), "browser: main open settles the exegesis present (courier path)");
    // intros land asynchronously; wait for the Midmorning intro pair
    await pageA.waitForFunction(() => (window.state.dayDescs || []).some((d) => d.episodeId === "intro:novena-st-jude"), null, { timeout: 30000 }).catch(() => {});
    await sleep(500);

    const midCards = await blockCards(pageA, "Midmorning");
    const EXP_MID_CARDS = ["ext-gospel-exegesis", "novena-st-jude", "novena-st-anne", "ext-midmorning-prayer"];
    ok(JSON.stringify(midCards) === JSON.stringify(EXP_MID_CARDS),
      `L1 Midmorning card order: exegesis FIRST among settings rows, then the Novenas run, then Terce (cards=${JSON.stringify(midCards)})`);

    const midDescs = await blockDescs(pageA, "Midmorning");
    const hasExIntro = midDescs.includes("intro:ext-gospel-exegesis");
    const EXP_MID_DESCS = hasExIntro
      ? ["intro:ext-gospel-exegesis", "ext-gospel-exegesis", "intro:novena-st-jude", "novena-st-jude", "intro:novena-st-anne", "novena-st-anne", "ext-midmorning-prayer"]
      : ["ext-gospel-exegesis", "intro:novena-st-jude", "novena-st-jude", "intro:novena-st-anne", "novena-st-anne", "ext-midmorning-prayer"];
    const introRule = midDescs.every((id, i) => !id.startsWith("intro:") || midDescs[i + 1] === id.slice(6));
    ok(JSON.stringify(midDescs) === JSON.stringify(EXP_MID_DESCS) && introRule,
      `L2 Midmorning queue order: descriptors stand in the L1 order, each intro immediately before its own available prayer, none before an unavailable one (descs=${JSON.stringify(midDescs)}, exIntro=${hasExIntro})`);

    const exState = await pageA.evaluate(() => {
      const st = window.state.extSlots["ext-gospel-exegesis"];
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "ext-gospel-exegesis");
      const card = document.querySelector('[data-card="ext-gospel-exegesis"]');
      return { state: st && st.state, title: st && st.title, enc: st && st.enclosureUrl,
        descAvail: d ? d.available : null, descUrl: d ? !!d.url : null,
        playBtn: card ? !!card.querySelector("[data-playkey]") : false };
    });
    ok(exState.state === "present" && exState.enc === PICK_URL && exState.title === PICK_TITLE
      && exState.descAvail === true && exState.descUrl === true && exState.playBtn === true,
      `L3 exegesis present+playable: the production-shaped fixture's pick (both decoys rejected) settles present with its enclosure and ITEM title, an available descriptor with a URL, and a play button on its card (${JSON.stringify(exState)})`);

    ok(anchorReqs.length === 0,
      `L5 zero Anchor requests: the page issued no request to anchor.fm at open — the on-device resolution leg is gone (anchorReqs=${anchorReqs.length}; pass-through requests counted separately=${ptReqsA.length})`);

    // ---- L8 · other blocks (merged sort follows settings) -------
    const EXP_CARDS = {
      "Morning": ["ext-invitatory", "morning-prayer", "ext-morning-prayer", "daily-rosary", "ext-bible-in-a-year", "marian-antiphon-angelus"],
      "Midday": ["marian-antiphon-angelus", "ext-midday-prayer"],
      "Afternoon": ["ext-saint-of-the-day", "auxilium-christianorum", "ext-midafternoon-prayer"],
      "Evening": ["ext-office-of-readings", "marian-antiphon-angelus", "ext-evening-prayer"],
      "Night": ["daily-reflection", "ext-night-prayer"],
      "Mass and Homilies": ["ext-usccb-readings", "ext-daily-tv-mass", "ext-fr-mike-homily", "ext-barron-sermon"],
    };
    const EXP_DESCS = {
      "Morning": ["intro:ext-invitatory", "ext-invitatory", "intro:morning-prayer", "morning-prayer", "ext-morning-prayer", "intro:daily-rosary", "daily-rosary", "intro:ext-bible-in-a-year", "ext-bible-in-a-year", "intro:marian-antiphon-angelus", "marian-antiphon-angelus"],
      "Midday": ["intro:marian-antiphon-angelus", "marian-antiphon-angelus", "ext-midday-prayer"],
      "Afternoon": ["ext-saint-of-the-day", "intro:auxilium-christianorum", "auxilium-christianorum", "ext-midafternoon-prayer"],
      "Evening": ["ext-office-of-readings", "intro:marian-antiphon-angelus", "marian-antiphon-angelus", "ext-evening-prayer"],
      "Night": ["intro:daily-reflection", "daily-reflection", "ext-night-prayer"],
      "Mass and Homilies": ["ext-usccb-readings", "ext-daily-tv-mass", "ext-fr-mike-homily", "ext-barron-sermon"],
    };
    const l8detail = [];
    let l8ok = true;
    for (const b of Object.keys(EXP_CARDS)) {
      const c = await blockCards(pageA, b);
      const d = await blockDescs(pageA, b);
      const cok = JSON.stringify(c) === JSON.stringify(EXP_CARDS[b]);
      const dok = JSON.stringify(d) === JSON.stringify(EXP_DESCS[b]);
      if (!cok || !dok) l8ok = false;
      l8detail.push(`${b}: cards=${JSON.stringify(c)}${cok ? "" : " EXPECTED " + JSON.stringify(EXP_CARDS[b])} descs=${JSON.stringify(d)}${dok ? "" : " EXPECTED " + JSON.stringify(EXP_DESCS[b])}`);
    }
    ok(l8ok, `L8 other blocks unchanged: every other block's card AND descriptor lists equal the settings-order lists for the same fixture seed — Morning interleaves by settings too, proving the merge is global, not a Midmorning special case (${l8detail.join(" | ")})`);

    // ---- L9 · cache round-trip ----------------------------------
    const rec1 = await pageA.evaluate(() => JSON.parse(localStorage.getItem("opn-ext-cache-v1") || "null"));
    await pageA.reload({ waitUntil: "domcontentloaded" });
    const resettled = await settled(pageA, "present");
    const exAfter = await pageA.evaluate(() => {
      const st = window.state.extSlots["ext-gospel-exegesis"];
      return { state: st && st.state, enc: st && st.enclosureUrl };
    });
    ok(!!rec1 && rec1.slots && rec1.slots["ext-gospel-exegesis"]
      && rec1.slots["ext-gospel-exegesis"].streamUrl === PICK_URL
      && resettled && exAfter.state === "present" && exAfter.enc === PICK_URL,
      `L9 cache round-trip: the day-cache record carries the pick's enclosure (not a pass-through URL) and a second open re-settles the exegesis present from the record (rec=${rec1 && rec1.slots && rec1.slots["ext-gospel-exegesis"] && rec1.slots["ext-gospel-exegesis"].streamUrl}, after=${JSON.stringify(exAfter)})`);
    await ctxA.close().catch(() => {});

    // ---- L6 · download retry (first pass-through injected 500) --
    let ptCount6 = 0;
    const ctxB = await wireContext(async (route) => {
      ptCount6++;
      if (ptCount6 === 1) return route.fulfill({ status: 500, body: "injected failure" });
      return route.continue();
    });
    const pageB = await ctxB.newPage();
    const ptReqsB = [];
    pageB.on("request", (r) => {
      if (r.url().includes("/api/player/externals/audio") && r.url().includes("slot=ext-gospel-exegesis")) ptReqsB.push(r.url());
    });
    await pageB.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const settled6 = await settled(pageB, "present");
    await sleep(500);
    ok(settled6 && ptReqsB.length === 2,
      `L6 download retry: with the FIRST exegesis pass-through request failure-injected (500), the slot still settles present+playable through exactly one same-route retry (attempts=${ptReqsB.length}, settled=${settled6})`);
    await ctxB.close().catch(() => {});

    // ---- L7 · named-missing honesty ------------------------------
    dgeState.mode = "empty";
    const ctxC = await wireContext(null);
    const pageC = await ctxC.newPage();
    await pageC.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const settled7 = await settled(pageC, "missing");
    await pageC.waitForFunction(() => (window.state.dayDescs || []).some((d) => d.episodeId === "intro:novena-st-jude"), null, { timeout: 30000 }).catch(() => {});
    await sleep(500);
    const midCards7 = await blockCards(pageC, "Midmorning");
    const midDescs7 = await blockDescs(pageC, "Midmorning");
    const cardText7 = await pageC.evaluate(() => {
      const c = document.querySelector('[data-card="ext-gospel-exegesis"]');
      return c ? c.textContent : "";
    });
    const EXP_MID7_DESCS = ["ext-gospel-exegesis", "intro:novena-st-jude", "novena-st-jude", "intro:novena-st-anne", "novena-st-anne", "ext-midmorning-prayer"];
    ok(settled7 && JSON.stringify(midCards7) === JSON.stringify(EXP_MID_CARDS)
      && JSON.stringify(midDescs7) === JSON.stringify(EXP_MID7_DESCS)
      && cardText7.includes("Daily Gospel Exegesis"),
      `L7 named-missing honesty: with no enclosed on/before-day item in the feed, the slot settles missing, stands FIRST among Midmorning's settings rows as the named card/descriptor (no intro before it), and no other Midmorning entry moves (cards=${JSON.stringify(midCards7)}, descs=${JSON.stringify(midDescs7)}, cardText=${cardText7.slice(0, 80)})`);
    dgeState.mode = "main";
    await ctxC.close().catch(() => {});

    // ---- L10 · SW pin --------------------------------------------
    const sw = (await api(BASE, "GET", "/sw.js")).text;
    ok(sw.includes("ora-pro-nobis-v348-1") && !sw.includes("ora-pro-nobis-v347-1"),
      "L10 SW pin: the served service worker carries CACHE 'ora-pro-nobis-v348-1' and no 'ora-pro-nobis-v347-1'");

    ok(pageErrors.length === 0, `evidence: the main-open browser run completed with zero page errors${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
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
