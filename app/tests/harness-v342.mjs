#!/usr/bin/env node
// harness-v342 — v342 PODCAST-STYLE PULL gate (Plan §2.11, 18 legs;
// leg 16, the regression family, runs separately and is tallied in
// §3). Tallies from COMPLETE log files only.
//
//   1  own resolution per block incl. Antiphon ×3 placements
//   2  novenas: canonical ids, feed order, one row's cards
//   3  date discipline: pubDate/stem disagreement → family
//      named-missing; adjacent dates never placed
//   4  intentions intros byte-equal to the v338 payload-built map
//      for the same fixture day; expandDescs pairs + treatment A
//   5  intentions segments shape: resolves by (block, date); no
//      presentation is built
//   6  named-missing: family absent · intro absent (prayer plays
//      panel-free) · intentions feed unreachable (intentions
//      degrade only, the day renders whole)
//   7  downloads via the Worker pass-through against a no-ACAO
//      audio host; playback streams direct before download
//   8  day cache gains own + intentions (present only; missing
//      re-checks next open; a pre-v342 record reads safely)
//   9  invalidation on presentedDay OR settingsVersion change
//  10  settings govern: a disabled family does not resolve; a
//      user block move wins; Antiphon follows enabled rows only
//  11  transcripts: publish-tail-staged text serves byte-identical
//      at the existence-gate route with player_episodes EMPTY;
//      an absent text 404s by name
//  12  payload shell shape: no own tracks, no intros, no
//      storedDay; introTexts rides the shell (privacy decision)
//  13  publish leg: intentions.xml regenerates per §2.2; the
//      7-day window holds; day-8 items AND audio pruned; additive
//      mode's push behavior unchanged (against the pre-v342 build)
//  14  streaming measure against a live-shaped feed (~2,901
//      items): the early stop fires — bytes consumed are a small
//      fraction of the file
//  15  soak rollback drill: the pre-v342 build serves the stored
//      day as before; one heal push restores it; the candidate
//      renders the day whole in both states
//  16  regressions (run separately — see §3)
//  17  served build: client parses, carries the own + intentions
//      resolution and the expansion seam; SW pin
//      ora-pro-nobis-v342-1 with the purge exemption verbatim
//  18  report shapes: the helper in publish mode prints §2.6
//      ruling 7's field exactly; ruling 8's both-dates sentence
//      stands in the sheet fixture this harness carries
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const FORK = path.resolve(APP, "..");
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v342 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/x.js");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8992, PORT2 = 8993, FEED_PORT = 8952, STUB_PORT = 8953, SITE_PORT = 443;
const BASE = `http://127.0.0.1:${PORT}`, BASE2 = `http://127.0.0.1:${PORT2}`, FEED = `http://127.0.0.1:${FEED_PORT}`, STUB = `http://127.0.0.1:${STUB_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v342");
const PERSIST2 = path.join(APP, ".wrangler-test-v342-bed");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v342-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");

let passed = 0, failed = 0; const fails = [];
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`ok - ${name}`); }
  else { failed++; fails.push(name); console.log(`FAIL - ${name}${detail ? " :: " + String(detail).slice(0, 400) : ""}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chicagoParts = (d) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
const isoOf = (p) => `${p.year}-${p.month}-${p.day}`;
const TODAY = isoOf(chicagoParts(new Date()));
// Pure calendar arithmetic — routing a UTC-midnight instant
// through Chicago parts would shift the result a second day.
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

const api = async (base, method, p, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  let body;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
  if (opts.raw !== undefined) body = opts.raw;
  const res = await fetch(base + p, { method, headers, body, redirect: "manual" });
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, headers: res.headers };
};
const apiRaw = async (base, p, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(base + p, { method: "GET", headers, redirect: "manual" });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
};
function wranglerD1(appDir, persist, file) {
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
function migFiles(appDir, upto = null) {
  const dir = path.join(appDir, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()
    .filter((f) => !upto || f <= upto)
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
}
function applyMigs(appDir, persist, extraSql = "", upto = null) {
  fs.rmSync(persist, { recursive: true, force: true });
  const parts = migFiles(appDir, upto);
  if (extraSql) parts.push(extraSql);
  const f = path.join(TMPD, `mig-${path.basename(persist)}.sql`);
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1(appDir, persist, f);
}
function tone(name, freq = 440, secs = 1.2) {
  const out = path.join(TMPD, name);
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${secs}`, "-codec:a", "libmp3lame", "-b:a", "32k", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr);
  return fs.readFileSync(out);
}
const procs = [];
function startApp(appDir, port, persist, extraVars = []) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1",
    "--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`,
    "--var", `EXT_DGE_FEED_URL:${FEED}/dge.xml`, "--var", `EXT_SAINT_FEED_URL:${FEED}/saint.xml`,
    "--var", `EXT_USCCB_FEED_URL:${FEED}/usccb.xml`, "--var", `EXT_TVMASS_FEED_URL:${FEED}/tvmass.xml`,
    "--var", `EXT_FRMIKE_FEED_URL:${FEED}/frmike.xml`, "--var", `EXT_BARRON_FEED_URL:${FEED}/barron.xml`, ...extraVars];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}

// ---- seed (the estate mold: items + the 11-intention pool) ----------
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

// ---- external fixture feeds (the v339 set, Worker-courier side) ----
const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Fixture</title>${items}</channel></rss>`;
const xitem = (title, pub, enc, len = 1000) => `<item><title>${title}</title><pubDate>${pub}</pubDate><enclosure url="${enc}" type="audio/mpeg" length="${len}"/></item>`;
const SUNDAY = shift(TODAY, -((wdMon0(TODAY) + 1) % 7));
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
const feedBytes = {
  do: fs.readFileSync(path.join(FIX, "divine-office.xml")),
  biay: fs.readFileSync(path.join(FIX, "bible-in-a-year.xml")),
  sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")),
};
const audioBytes = (name) => Buffer.from(`AUDIO-FIXTURE:${name}:` + "x".repeat(64));
const TONE_MP = tone("own-morning.mp3", 440, 2.0);
const TONE_INTRO_MP = tone("own-intro.mp3", 660, 1.0);

// ---- the podcast + intentions fixture feeds (client side) ---------
// Stems carry the presented date; titles carry the podcast display
// suffix the client must strip. Enclosures stand on the HTTP
// fixture (no ACAO — the download must ride the pass-through).
// pubDates stand at midday UTC — safely the same Chicago calendar
// day (05:00Z would be 11 PM the PREVIOUS Chicago day).
const ownItem = (stem, title, iso, hour = 12) =>
  `<item><title>${title} - ${longDate(iso)}</title><guid isPermaLink="false">${stem}::fixturehash</guid><pubDate>${rfc(iso, hour)}</pubDate><enclosure url="${FEED}/audio/${stem}.mp3" type="audio/mpeg" length="2048"/></item>`;
const OWN_TODAY_ITEMS = [
  ownItem(`morning-prayer-elevenlabs-${TODAY}`, "Morning Prayer", TODAY),
  ownItem(`daily-rosary-${TODAY}`, "Daily Rosary", TODAY),
  ownItem(`marian-antiphon-angelus-${TODAY}`, "Marian Antiphon — Angelus", TODAY),
  ownItem(`${TODAY}-st-fixture-day-3`, "Novena to St. Fixture — Day 3", TODAY),
  ownItem(`${TODAY}-st-jude-day-5`, "Novena to St. Jude — Day 5", TODAY),
  ownItem(`auxilium-christianorum-${TODAY}`, "Auxilium Christianorum", TODAY),
  ownItem(`daily-reflection-${TODAY}`, "Daily Reflection", TODAY),
];
const OWN_YDAY_ITEMS = [
  ownItem(`morning-prayer-elevenlabs-${YDAY}`, "Morning Prayer", YDAY),
  ownItem(`daily-rosary-${YDAY}`, "Daily Rosary", YDAY),
];
const podcastXml = (todayItems, ydayItems = OWN_YDAY_ITEMS, tomorrow = true) =>
  rss((tomorrow ? ownItem(`morning-prayer-elevenlabs-${TOMORROW}`, "Morning Prayer", TOMORROW) : "") + todayItems.join("") + ydayItems.join(""));
const PODCAST_MAIN = podcastXml(OWN_TODAY_ITEMS);
// Leg 3 variant: rosary's pubDate says TODAY but its stem says
// YDAY (disagreement); morning-prayer stands only at TOMORROW/YDAY.
const PODCAST_MISMATCH = podcastXml([
  `<item><title>Daily Rosary - ${longDate(TODAY)}</title><guid isPermaLink="false">daily-rosary-${YDAY}::fixturehash</guid><pubDate>${rfc(TODAY, 12)}</pubDate><enclosure url="${FEED}/audio/daily-rosary-${YDAY}.mp3" type="audio/mpeg" length="2048"/></item>`,
]);
// Leg 6 variant A: auxilium absent from the feed entirely.
const PODCAST_NO_AUX = podcastXml(OWN_TODAY_ITEMS.filter((x) => !x.includes("auxilium")));
// Intentions fixture: GUID-keyed, audio only (descriptions carry
// NO intention text — the privacy decision; the client's texts
// must come from the shell). Distinct enclosure lengths per id.
const INTRO_IDS = ["morning-prayer", "daily-rosary", "marian-antiphon-angelus", "novena-st-fixture", "novena-st-jude",
  "auxilium-christianorum", "daily-reflection", "ext-invitatory", "ext-bible-in-a-year", "ext-gospel-exegesis"];
const TRACK_TITLES = {
  "morning-prayer": "Morning Prayer", "daily-rosary": "Daily Rosary", "marian-antiphon-angelus": "Marian Antiphon — Angelus",
  "novena-st-fixture": "Novena to St. Fixture — Day 3", "novena-st-jude": "Novena to St. Jude — Day 5",
  "auxilium-christianorum": "Auxilium Christianorum", "daily-reflection": "Daily Reflection",
  "ext-invitatory": "Invitatory", "ext-bible-in-a-year": "Bible in a Year", "ext-gospel-exegesis": "Daily Gospel Exegesis",
};
const introItem = (id, len) =>
  `<item><title>Intention — ${TRACK_TITLES[id]}</title><guid isPermaLink="false">intentions-intro-${id}-${TODAY}</guid><pubDate>${rfc(TODAY, 0)}</pubDate><description>Intention audio.</description><enclosure url="${FEED}/audio/intro-${id}.mp3" type="audio/mpeg" length="${len}"/></item>`;
const segmentItem = (block, len) =>
  `<item><title>Intentions — ${block}</title><guid isPermaLink="false">intentions-segment-${block}-${TODAY}</guid><pubDate>${rfc(TODAY, 0)}</pubDate><description>Segment audio.</description><enclosure url="${FEED}/audio/segment-${block}.mp3" type="audio/mpeg" length="${len}"/></item>`;
const INTENTIONS_MAIN = rss(INTRO_IDS.map((id, i) => introItem(id, 4100 + i * 137)).join("") + segmentItem("Morning", 9100));
const INTENTIONS_NO_ROSARY = rss(INTRO_IDS.filter((id) => id !== "daily-rosary").map((id, i) => introItem(id, 4100 + i * 137)).join("") + segmentItem("Morning", 9100));

// ---- HTTP fixture server (Worker env feeds + audio host) -----------
const audioHits = [];
const feedServer = http.createServer((req, res) => {
  const u = new URL(req.url, FEED);
  const cors = { "access-control-allow-origin": "*" };
  const xml = (body) => { res.writeHead(200, { "content-type": "application/rss+xml", ...cors }); return res.end(body); };
  if (u.pathname === "/do.xml") return xml(feedBytes.do);
  if (u.pathname === "/biay.xml") return xml(feedBytes.biay);
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
    // NO CORS header on the audio host (the probed posture).
    audioHits.push(u.pathname);
    const name = u.pathname.slice(7);
    const range = req.headers.range;
    let buf = audioBytes(name);
    if (name === `morning-prayer-elevenlabs-${TODAY}.mp3`) buf = TONE_MP;
    if (name === "intro-morning-prayer.mp3") buf = TONE_INTRO_MP;
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

// ---- HTTPS site (orapronobis.media, host-mapped in the browser) ---
const siteState = { podcast: PODCAST_MAIN, intentions: INTENTIONS_MAIN, big: null, hits: { podcast: 0, intentions: 0 }, bigSent: 0, bigTotal: 0 };
let siteServer = null;
function startSite() {
  const crt = path.join(TMPD, "site.crt"), key = path.join(TMPD, "site.key");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", key, "-out", crt, "-days", "2", "-nodes",
    "-subj", "/CN=orapronobis.media", "-addext", "subjectAltName=DNS:orapronobis.media,DNS:audio.orapronobis.media"], { stdio: "pipe" });
  siteServer = https.createServer({ cert: fs.readFileSync(crt), key: fs.readFileSync(key) }, (req, res) => {
    const u = new URL(req.url, "https://orapronobis.media");
    if (u.pathname === "/podcast.xml") {
      siteState.hits.podcast++;
      if (siteState.big) {
        // Chunked live-shaped feed: the presented block first,
        // then ~2,900 old items dribbled — the early stop must
        // close this long before the tail.
        const { head, chunks } = siteState.big;
        siteState.bigTotal = head.length + chunks.reduce((a, c) => a + c.length, 0);
        res.writeHead(200, { "content-type": "application/rss+xml", "access-control-allow-origin": "*" });
        let sent = Buffer.byteLength(head);
        res.write(head);
        siteState.bigSent = sent;
        let i = 0;
        const timer = setInterval(() => {
          if (res.writableEnded || res.destroyed) { clearInterval(timer); return; }
          if (i >= chunks.length) { clearInterval(timer); res.end("</channel></rss>"); return; }
          const c = chunks[i++];
          try { res.write(c); siteState.bigSent += Buffer.byteLength(c); } catch { clearInterval(timer); }
        }, 25);
        req.on("close", () => clearInterval(timer));
        return;
      }
      res.writeHead(200, { "content-type": "application/rss+xml", "access-control-allow-origin": "*" });
      return res.end(siteState.podcast);
    }
    if (u.pathname === "/intentions.xml") {
      siteState.hits.intentions++;
      if (siteState.intentions == null) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "content-type": "application/rss+xml", "access-control-allow-origin": "*" });
      return res.end(siteState.intentions);
    }
    res.writeHead(404); res.end();
  });
  return new Promise((r) => siteServer.listen(SITE_PORT, r));
}

// ---- publish stub (Cloudflare R2 + GitHub + the live site read) ---
const stubState = {
  r2: new Map(), blobs: new Map(), trees: new Map(), commits: new Map(),
  headSha: "commit-0", treeSeq: 0, blobSeq: 0, commitSeq: 0,
  docs: new Map(), dispatched: 0,
};
function startStub() {
  stubState.docs.set("docs/intentions.xml", rss(
    `<item><title>Intention — Old Keep</title><guid isPermaLink="false">intentions-intro-old-keep-${shift(TODAY, -6)}</guid><pubDate>${rfc(shift(TODAY, -6), 0)}</pubDate><enclosure url="https://audio.orapronobis.media/intentions/${shift(TODAY, -6)}/intro-old-keep.mp3" type="audio/mpeg" length="111"/></item>` +
    `<item><title>Intention — Old Prune</title><guid isPermaLink="false">intentions-intro-old-prune-${shift(TODAY, -7)}</guid><pubDate>${rfc(shift(TODAY, -7), 0)}</pubDate><enclosure url="https://audio.orapronobis.media/intentions/${shift(TODAY, -7)}/intro-old-prune.mp3" type="audio/mpeg" length="112"/></item>`));
  stubState.r2.set(`intentions/${shift(TODAY, -6)}/intro-old-keep.mp3`, Buffer.from("keep"));
  stubState.r2.set(`intentions/${shift(TODAY, -7)}/intro-old-prune.mp3`, Buffer.from("prune"));
  stubState.r2.set(`intentions/${shift(TODAY, -6)}/intro-old-keep.mp3`, Buffer.from("keep"));
  stubState.commits.set("commit-0", { tree: "tree-0" });
  stubState.trees.set("tree-0", []);
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, STUB);
    const send = (code, obj, ctype = "application/json") => {
      const body = Buffer.isBuffer(obj) || typeof obj === "string" ? obj : JSON.stringify(obj);
      res.writeHead(code, { "content-type": ctype }); res.end(body);
    };
    const chunks = [];
    req.on("data", (c) => { chunks.push(c); });
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      const body = buf.toString("utf8");
      const p = u.pathname;
      // Cloudflare R2 emulation
      const mObj = p.match(/^\/accounts\/[^/]+\/r2\/buckets\/orapronobis-audio\/objects\/(.+)$/);
      const mList = p.match(/^\/accounts\/[^/]+\/r2\/buckets\/orapronobis-audio\/objects$/);
      if (mList && req.method === "GET") {
        const prefix = u.searchParams.get("prefix") || "";
        const objects = [...stubState.r2.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key }));
        return send(200, { success: true, errors: [], messages: [], result: { objects, result_info: {} } });
      }
      if (mObj) {
        const key = decodeURIComponent(mObj[1]);
        if (req.method === "PUT") { stubState.r2.set(key, buf); return send(200, { success: true, errors: [], messages: [], result: { key, size: String(buf.length) } }); }
        if (req.method === "DELETE") { stubState.r2.delete(key); return send(200, { success: true, errors: [], messages: [], result: {} }); }
        if (req.method === "GET") { const b = stubState.r2.get(key); if (b) return send(200, b, "application/octet-stream"); return send(404, { success: false }); }
      }
      if (p === "/site/intentions.xml") {
        const doc = stubState.docs.get("docs/intentions.xml");
        if (doc == null) { res.writeHead(404); return res.end("not found"); }
        return send(200, doc, "application/rss+xml");
      }
      // GitHub emulation
      const repo = "/repos/Jctebo/spotify_praylist";
      if (p === `${repo}/git/ref/heads/main` && req.method === "GET") return send(200, { object: { sha: stubState.headSha } });
      const mCommit = p.match(new RegExp(`^${repo.replace(/\//g, "\\/")}/git/commits/(.+)$`));
      if (mCommit && req.method === "GET") { const c = stubState.commits.get(mCommit[1]); return send(200, { tree: { sha: c ? c.tree : "tree-0" } }); }
      if (p === `${repo}/git/blobs` && req.method === "POST") {
        const sha = `blob-${++stubState.blobSeq}`;
        stubState.blobs.set(sha, Buffer.from(JSON.parse(body).content, "base64").toString("utf8"));
        return send(201, { sha });
      }
      if (p === `${repo}/git/trees` && req.method === "POST") {
        const sha = `tree-${++stubState.treeSeq}`;
        stubState.trees.set(sha, JSON.parse(body).tree);
        return send(201, { sha });
      }
      if (p === `${repo}/git/commits` && req.method === "POST") {
        const sha = `commit-${++stubState.commitSeq}`;
        stubState.commits.set(sha, { tree: JSON.parse(body).tree });
        return send(201, { sha });
      }
      if (p === `${repo}/git/refs/heads/main` && req.method === "PATCH") {
        stubState.headSha = JSON.parse(body).sha;
        const commit = stubState.commits.get(stubState.headSha);
        const entries = stubState.trees.get(commit.tree) || [];
        for (const e of entries) if (e.path === "docs/intentions.xml") stubState.docs.set("docs/intentions.xml", stubState.blobs.get(e.sha));
        return send(200, { object: { sha: stubState.headSha } });
      }
      if (p === `${repo}/actions/workflows/deploy_pages.yml/dispatches` && req.method === "POST") { stubState.dispatched++; return send(204, ""); }
      if (p === `${repo}/actions/workflows/deploy_pages.yml/runs` && req.method === "GET") {
        return send(200, { workflow_runs: [{ head_sha: stubState.headSha, status: "completed", conclusion: "success" }] });
      }
      res.writeHead(404); res.end("stub: no route " + p);
    });
  });
  return new Promise((r) => srv.listen(STUB_PORT, r));
}

const PAIRING = {
  "morning-prayer": "Morning Prayer", "daily-rosary": "Daily Rosary",
  "marian-antiphon-angelus": "Morning Marian Antiphon", "auxilium-christianorum": "Auxilium Christianorum",
  "daily-reflection": "Daily Reflection", "novena-st-fixture": "Novenas", "novena-st-jude": "Novenas",
  "ext-invitatory": "Invitatory", "ext-bible-in-a-year": "Bible in a Year", "ext-gospel-exegesis": "Daily Gospel Exegesis",
};
const OWN_ROWS = ["morning-prayer", "daily-rosary", "marian-antiphon", "marian-antiphon-midday", "marian-antiphon-evening", "novenas", "auxilium-christianorum", "daily-reflection"];

async function main() {
  await new Promise((r) => feedServer.listen(FEED_PORT, r));
  await startSite();
  await startStub();

  // ================= MAIN instance (the candidate) =================
  applyMigs(APP, PERSIST, seedSql());
  startApp(APP, PORT, PERSIST);
  check("setup: candidate app boots", await waitUp(BASE));
  const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
  check("setup: the day's draw stands", draw.status === 200, `status=${draw.status}`);
  const prayerDay = (await api(BASE, "GET", `/api/agent/prayer/day?date=${TODAY}`, { token: TOKEN })).body;
  const drawText = {};
  for (const b of prayerDay.blocks || []) for (const d of b.devotions || []) drawText[d.name] = (d.intentions || [])[0] ? d.intentions[0].text : "";
  check("setup: every paired item drew an intention", Object.values(PAIRING).every((n) => !!drawText[n]), JSON.stringify(Object.keys(drawText)));

  // ================= LEG 12 — the payload shell ====================
  const shell = (await api(BASE, "GET", "/api/player/day")).body;
  check("12 shell shape: no own tracks in any block, no intros join, no storedDay",
    (shell.blocks || []).length === 7 && (shell.blocks || []).every((b) => (b.tracks || []).length === 0 && b.trackCount === 0) &&
    !("intros" in shell) && !("storedDay" in shell) && !("episodes" in shell),
    JSON.stringify(Object.keys(shell)));
  check("12 shell carries presentedDay + settings version + the introTexts map (privacy: texts ride the shell, not the feed)",
    shell.presentedDay === TODAY && shell.date === TODAY && typeof shell.version === "number" &&
    shell.introTexts && shell.introTexts["morning-prayer"] === drawText["Morning Prayer"] &&
    shell.introTexts["novenas"] === drawText["Novenas"] &&
    shell.introTexts["ext-bible-in-a-year"] === drawText["Bible in a Year"],
    JSON.stringify(Object.keys(shell.introTexts || {})));
  const peCount = d1q(APP, PERSIST, "SELECT COUNT(*) AS n FROM player_episodes;")[0].n;
  check("12 the shell answered with player_episodes EMPTY (no stored day exists in this instance)", peCount === 0, `rows=${peCount}`);

  // ================= LEG 17 — served build =========================
  const appJs = (await apiRaw(BASE, "/app.js")).buf.toString("utf8");
  const swJs = (await apiRaw(BASE, "/sw.js")).buf.toString("utf8");
  let servedParses = true;
  try { new Function(appJs.replace(/import[^;]+;/g, "")); } catch { servedParses = false; }
  check("17 served build parses and carries the own + intentions resolution through the standing seam",
    servedParses && appJs.includes("OWN_ROW_EPISODE") && appJs.includes("ownResolveFeed") && appJs.includes("ownBuildIntentions") && appJs.includes("expandDescs") && appJs.includes("INTRO_FEED_URL"),
    `parses=${servedParses}`);
  check("17 SW pin ora-pro-nobis-v342-1 with the opn-ext-audio-v1 purge exemption verbatim",
    swJs.includes('var CACHE = "ora-pro-nobis-v342-1";') && swJs.includes('k !== CACHE && k !== "opn-ext-audio-v1"'));

  // ================= browser legs ==================================
  const browserEnv = { ...process.env };
  for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
  const browser = await chromium.launch({
    executablePath: CHROME,
    env: browserEnv,
    args: ["--no-sandbox", "--ignore-certificate-errors", "--no-proxy-server",
      "--host-resolver-rules=MAP orapronobis.media 127.0.0.1, MAP audio.orapronobis.media 127.0.0.1"],
  });
  const wireExtRoutes = async (ctx) => {
    await ctx.route("https://feeds.buzzsprout.com/949645.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: TVMASS_XML }));
    await ctx.route("https://anchor.fm/s/1025ef1c/podcast/rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: DGE_XML }));
    await ctx.route("https://feeds.buzzsprout.com/2216056.rss", (route) => route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: SAINT_XML }));
  };
  const waitOwnSettled = (page, timeout = 45000) => page.waitForFunction(() => {
    const s = window.state && window.state.ownSlots;
    if (!s || !Object.keys(s).length) return false;
    return Object.values(s).every((st) => st.state !== "loading");
  }, null, { timeout }).catch(() => {});

  // ---- Legs 1/2/4/5: the main open --------------------------------
  const ctx = await browser.newContext();
  await wireExtRoutes(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page);
  const ownView = await page.evaluate(() => {
    const slots = {};
    for (const [k, st] of Object.entries(window.state.ownSlots || {})) slots[k] = { state: st.state, tracks: (st.tracks || []).map((t) => t.episodeId) };
    const cards = {};
    document.querySelectorAll("[data-card]").forEach((el) => { const id = el.getAttribute("data-card"); cards[id] = (cards[id] || 0) + 1; });
    const blockOf = {};
    let cur = null;
    document.querySelectorAll(".blockhead, [data-card]").forEach((el) => {
      if (el.classList.contains("blockhead")) cur = el.querySelector("h2").textContent.trim();
      else { const id = el.getAttribute("data-card"); if (!(id in blockOf)) blockOf[id] = cur; }
    });
    return { slots, cards, blockOf, descs: (window.state.dayDescs || []).map((d) => ({ id: d.episodeId, block: d.block, avail: d.available })) };
  });
  check("1 own resolution: every standing family resolved present from the feed",
    OWN_ROWS.every((k) => ownView.slots[k] && ownView.slots[k].state === "present"), JSON.stringify(ownView.slots));
  check("1 Antiphon ×3: one feed item stands as a card in Morning, Midday, and Evening",
    ownView.cards["marian-antiphon-angelus"] === 3, JSON.stringify(ownView.cards));
  check("1 placement by settings block: rosary in Morning, auxilium in Afternoon, reflection in Night",
    ownView.blockOf["daily-rosary"] === "MORNING" && ownView.blockOf["auxilium-christianorum"] === "AFTERNOON" && ownView.blockOf["daily-reflection"] === "NIGHT",
    JSON.stringify(ownView.blockOf));
  check("2 novenas: both canonical ids stand, in feed order, inside Midmorning's descriptor run",
    (() => {
      const ids = ownView.descs.filter((d) => d.block === "Midmorning" && d.id.startsWith("novena-")).map((d) => d.id);
      return JSON.stringify(ids) === JSON.stringify(["novena-st-fixture", "novena-st-jude"]);
    })(), JSON.stringify(ownView.descs.filter((d) => d.block === "Midmorning").map((d) => d.id)));
  // Leg 4: the client-built intros map, byte-equal to what v338's
  // payload join produced for the same fixture day.
  const expectedIntros = {};
  INTRO_IDS.forEach((id, i) => {
    expectedIntros[id] = { title: `Intention — ${TRACK_TITLES[id]}`, text: drawText[PAIRING[id]], streamUrl: `${FEED}/audio/intro-${id}.mp3`, sizeBytes: 4100 + i * 137 };
  });
  const actualIntros = await page.evaluate(() => window.state.dayPayload.intros);
  check("4 the client-built intros map is byte-equal to the v338 payload-built map for the same day",
    JSON.stringify(actualIntros) === JSON.stringify(expectedIntros),
    `actual=${JSON.stringify(actualIntros).slice(0, 300)} expected=${JSON.stringify(expectedIntros).slice(0, 300)}`);
  const descIds = ownView.descs.map((d) => d.id);
  check("4 expandDescs pairs: each present track's intro descriptor stands immediately before it",
    ["morning-prayer", "daily-rosary", "novena-st-fixture", "daily-reflection"].every((id) => {
      const at = descIds.indexOf(id);
      return at > 0 && descIds[at - 1] === `intro:${id}`;
    }), JSON.stringify(descIds.slice(0, 14)));
  const panelInfo = await page.evaluate(() => {
    const card = document.querySelector('[data-card="morning-prayer"]');
    if (!card) return null;
    const panel = card.querySelector(".intention-panel");
    const row = card.querySelector(".row");
    return {
      combined: card.classList.contains("intro-row"), panelFirst: !!panel && !!row && row.firstElementChild === panel,
      panelPct: panel && row ? Math.round((panel.getBoundingClientRect().width / row.getBoundingClientRect().width) * 100) : -1,
      ownBtn: !!card.querySelector('[data-playkey="intro:morning-prayer"]'),
    };
  });
  check("4 treatment A stands on a feed-resolved own row (panel first ~25%, its own play control)",
    !!panelInfo && panelInfo.combined && panelInfo.panelFirst && panelInfo.ownBtn && panelInfo.panelPct >= 18 && panelInfo.panelPct <= 34,
    JSON.stringify(panelInfo));
  const segState = await page.evaluate(() => ({
    segs: window.state.daySegments || {},
    segDesc: (window.state.dayDescs || []).some((d) => String(d.episodeId).startsWith("segment")),
    segCard: !!document.querySelector('[data-card^="segment"], [data-card="Intentions — Morning"]'),
  }));
  check("5 intentions segments resolve by (block, presented date) into state — and no presentation is built",
    segState.segs.Morning && segState.segs.Morning.streamUrl === `${FEED}/audio/segment-Morning.mp3` && !segState.segDesc && !segState.segCard,
    JSON.stringify(segState));

  // ---- Leg 7: downloads through the pass-through ------------------
  const ctx7 = await browser.newContext();
  await wireExtRoutes(ctx7);
  await ctx7.route(/127\.0\.0\.1:8952\/audio\//, (route) => route.abort());
  const page7 = await ctx7.newPage();
  await page7.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page7);
  // End-state poll (Node-side; an async waitForFunction predicate
  // with interval polling resolves on the Promise itself). The
  // downloads land when every slot has settled and the morning
  // track's descriptor has swapped to its blob URL.
  for (let i = 0; i < 60; i++) {
    const st = await page7.evaluate(() => {
      const d = (window.state.dayDescs || []).find((x) => x.episodeId === "morning-prayer");
      const extBusy = Object.values(window.state.extSlots || {}).some((s) => s.state === "loading" || s.state === "downloading");
      return { blob: !!(d && String(d.streamUrl || "").startsWith("blob:")), extBusy };
    }).catch(() => ({ blob: false, extBusy: true }));
    if (st.blob && !st.extBusy) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const cacheKeys7 = await page7.evaluate(async () => {
    const c = await caches.open("opn-ext-audio-v1");
    return (await c.keys()).map((r) => new URL(r.url).pathname.slice(1));
  }).catch(() => []);
  const introState7 = await page7.evaluate(() => {
    const d = window.state.dayPayload && window.state.dayPayload.intros && window.state.dayPayload.intros["morning-prayer"];
    return d ? String(d.streamUrl || "").slice(0, 60) : "NO-INTRO-IN-MAP";
  }).catch(() => "EVAL-ERR");
  check("7 downloads land via the Worker pass-through (browser-direct audio was aborted; the device cache still gains track + intro)",
    cacheKeys7.includes("morning-prayer") && cacheKeys7.includes("intro/morning-prayer"), JSON.stringify(cacheKeys7.slice(0, 60)) + " introUrl=" + introState7);
  const seekProof = await page7.evaluate(async () => {
    const d = (window.state.dayDescs || []).find((x) => x.episodeId === "morning-prayer");
    if (!d) return { ok: false, why: "no desc" };
    const wasBlob = String(d.url || "").startsWith("blob:");
    window.playTrack(d);
    await new Promise((r) => setTimeout(r, 800));
    const a = document.getElementById("audio");
    if (!a) return { ok: false, why: "no audio el", wasBlob };
    try { a.currentTime = 1.0; } catch (e) { return { ok: false, why: "seek threw", wasBlob }; }
    await new Promise((r) => setTimeout(r, 300));
    return { ok: a.currentTime > 0.5, t: a.currentTime, wasBlob, seekable: a.seekable && a.seekable.length ? a.seekable.end(0) : 0 };
  }).catch((e) => ({ ok: false, why: String(e).slice(0, 120) }));
  check("7 the downloaded copy plays and seeks on the device (blob URL after download)",
    seekProof.ok && seekProof.wasBlob, JSON.stringify(seekProof));
  await page7.close(); await ctx7.close();
  const ctx7b = await browser.newContext();
  await wireExtRoutes(ctx7b);
  const page7b = await ctx7b.newPage();
  const hitsBefore = audioHits.filter((h) => h === `/audio/morning-prayer-elevenlabs-${TODAY}.mp3`).length;
  await page7b.goto(BASE + "/", { waitUntil: "load" });
  await page7b.waitForFunction(() => {
    const s = window.state.ownSlots;
    return s && s["morning-prayer"] && s["morning-prayer"].state === "present";
  }, null, { timeout: 45000 }).catch(() => {});
  const directProof = await page7b.evaluate(() => {
    const d = (window.state.dayDescs || []).find((x) => x.episodeId === "morning-prayer");
    return d ? { url: d.url } : null;
  });
  check("7 playback streams direct: at settle the descriptor's URL is the enclosure itself (download swaps in later)",
    !!directProof && directProof.url === `${FEED}/audio/morning-prayer-elevenlabs-${TODAY}.mp3`, JSON.stringify(directProof));
  await page7b.close(); await ctx7b.close();

  // ---- Leg 8: the day cache gains own + intentions -----------------
  const recAfter = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("opn-ext-cache-v1")); } catch { return null; } });
  check("8 cache record: own section carries present families with enclosure URLs; intentions section carries the built map (no texts)",
    !!recAfter && recAfter.own && recAfter.own["morning-prayer"] && recAfter.own["morning-prayer"].enclosureUrl === `${FEED}/audio/morning-prayer-elevenlabs-${TODAY}.mp3` &&
    recAfter.own.novenas && recAfter.own.novenas.items.length === 2 &&
    recAfter.intentions && recAfter.intentions.intros["morning-prayer"] && recAfter.intentions.intros["morning-prayer"].streamUrl === `${FEED}/audio/intro-morning-prayer.mp3` &&
    !JSON.stringify(recAfter.intentions).includes("Synthetic intention"),
    JSON.stringify(recAfter && Object.keys(recAfter)));
  const podcastHitsBeforeReload = siteState.hits.podcast;
  await page.reload({ waitUntil: "load" });
  await waitOwnSettled(page);
  const reloadState = await page.evaluate(() => ({
    mp: window.state.ownSlots["morning-prayer"].state,
    intros: Object.keys(window.state.dayPayload.intros || {}).length,
  }));
  check("8 second open restores own + intentions from the day cache (no podcast re-fetch)",
    reloadState.mp === "present" && reloadState.intros === INTRO_IDS.length && siteState.hits.podcast === podcastHitsBeforeReload,
    `hits ${podcastHitsBeforeReload} -> ${siteState.hits.podcast}; ${JSON.stringify(reloadState)}`);
  await page.close(); await ctx.close();
  // A pre-v342 record: valid envelope, no own/intentions sections.
  const shellNow = (await api(BASE, "GET", "/api/player/day")).body;
  const ctx8 = await browser.newContext();
  await wireExtRoutes(ctx8);
  await ctx8.addInitScript((args) => {
    try {
      localStorage.setItem("opn-ext-cache-v1", JSON.stringify({ date: args.date, settingsVersion: args.version, savedAt: new Date().toISOString(), slots: {} }));
    } catch (e) {}
  }, { date: TODAY, version: shellNow.version });
  const page8 = await ctx8.newPage();
  const hitsBeforePre = siteState.hits.podcast;
  await page8.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page8);
  let preState = null;
  for (let i = 0; i < 15; i++) {
    preState = await page8.evaluate(() => ({
      mp: window.state.ownSlots["morning-prayer"] && window.state.ownSlots["morning-prayer"].state,
      rec: (() => { try { return JSON.parse(localStorage.getItem("opn-ext-cache-v1")); } catch { return null; } })(),
    })).catch(() => null);
    if (preState && preState.rec && preState.rec.own && preState.rec.intentions) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check("8 a pre-v342 cache record reads as sections-empty: no crash, families resolve fresh, sections are gained",
    preState.mp === "present" && siteState.hits.podcast > hitsBeforePre && !!preState.rec.own && !!preState.rec.intentions,
    JSON.stringify({ mp: preState.mp, hits: `${hitsBeforePre}->${siteState.hits.podcast}` }));
  await page8.close(); await ctx8.close();

  // ---- Leg 9: invalidation on settingsVersion change ---------------
  const curSettings = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
  const putRows = curSettings.sources.map((x) => ({ sourceKey: x.sourceKey, block: x.block, dayRule: x.dayRule, enabled: x.enabled }));
  const putResp = await api(BASE, "PUT", "/api/player/source-settings", { json: { sources: putRows } });
  const shellV2 = (await api(BASE, "GET", "/api/player/day")).body;
  check("setup: the settings PUT bumps the version", putResp.status === 200 && shellV2.version === curSettings.version + 1,
    `v${curSettings.version} -> v${shellV2.version}`);
  const ctx9 = await browser.newContext();
  await wireExtRoutes(ctx9);
  await ctx9.addInitScript((args) => {
    try {
      localStorage.setItem("opn-ext-cache-v1", JSON.stringify({ date: args.date, settingsVersion: args.version, savedAt: new Date().toISOString(), slots: {}, own: { "morning-prayer": { episodeId: "morning-prayer", title: "STALE", enclosureUrl: "https://stale.invalid/x.mp3", durationSec: 1, sizeBytes: 1 } }, intentions: { intros: {}, segments: {} } }));
    } catch (e) {}
  }, { date: TODAY, version: curSettings.version });
  const page9 = await ctx9.newPage();
  const hitsBefore9 = siteState.hits.podcast;
  await page9.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page9);
  const state9 = await page9.evaluate(() => ({
    title: (window.state.ownSlots["morning-prayer"].tracks || []).map((t) => t.title)[0],
    rec: (() => { try { return JSON.parse(localStorage.getItem("opn-ext-cache-v1")); } catch { return null; } })(),
  }));
  check("9 a settingsVersion change invalidates the record whole: the stale own entry never stands; families re-resolve",
    state9.title === "Morning Prayer" && siteState.hits.podcast > hitsBefore9 && state9.rec.settingsVersion === curSettings.version + 1,
    JSON.stringify({ title: state9.title, v: state9.rec && state9.rec.settingsVersion }));
  await page9.close(); await ctx9.close();

  // ---- Leg 3: date discipline --------------------------------------
  siteState.podcast = PODCAST_MISMATCH;
  const ctx3 = await browser.newContext();
  await wireExtRoutes(ctx3);
  const page3 = await ctx3.newPage();
  await page3.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page3);
  const state3 = await page3.evaluate(() => ({
    mp: window.state.ownSlots["morning-prayer"].state, rosary: window.state.ownSlots["daily-rosary"].state,
    rosaryCard: (() => { const c = document.querySelector('[data-card="daily-rosary"]'); return c ? c.textContent.slice(0, 140) : ""; })(),
  }));
  check("3 date discipline: a pubDate/stem disagreement names the family missing; an adjacent-date-only family is never placed",
    state3.mp === "missing" && state3.rosary === "missing" && state3.rosaryCard.includes("Daily Rosary") && state3.rosaryCard.includes("Not available in the app yet"),
    JSON.stringify(state3));
  await page3.close(); await ctx3.close();

  // ---- Leg 6: named-missing shapes ---------------------------------
  siteState.podcast = PODCAST_NO_AUX;
  siteState.intentions = INTENTIONS_MAIN;
  const ctx6 = await browser.newContext();
  await wireExtRoutes(ctx6);
  const page6 = await ctx6.newPage();
  await page6.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page6);
  const state6a = await page6.evaluate(() => window.state.ownSlots["auxilium-christianorum"].state);
  check("6 a family absent from the feed stands named-missing (its settings title on the card)",
    state6a === "missing", state6a);
  await page6.close(); await ctx6.close();
  siteState.podcast = PODCAST_MAIN;
  siteState.intentions = INTENTIONS_NO_ROSARY;
  const ctx6b = await browser.newContext();
  await wireExtRoutes(ctx6b);
  const page6b = await ctx6b.newPage();
  await page6b.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page6b);
  const state6b = await page6b.evaluate(() => {
    const card = document.querySelector('[data-card="daily-rosary"]');
    return {
      slot: window.state.ownSlots["daily-rosary"].state,
      hasPanel: !!card && !!card.querySelector(".intention-panel"),
      introInMap: "daily-rosary" in (window.state.dayPayload.intros || {}),
    };
  });
  check("6 an absent intro leaves the prayer standing panel-free (no placeholder, the prayer plays)",
    state6b.slot === "present" && !state6b.hasPanel && !state6b.introInMap, JSON.stringify(state6b));
  await page6b.close(); await ctx6b.close();
  siteState.intentions = null; // the intentions feed 404s
  const ctx6c = await browser.newContext();
  await wireExtRoutes(ctx6c);
  const page6c = await ctx6c.newPage();
  await page6c.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page6c);
  const state6c = await page6c.evaluate(() => ({
    heads: document.querySelectorAll(".blockhead").length,
    mp: window.state.ownSlots["morning-prayer"].state,
    intros: Object.keys(window.state.dayPayload.intros || {}).length,
  }));
  check("6 an unreachable intentions feed degrades INTENTIONS ONLY: the day renders whole, own episodes present, no panels",
    state6c.heads === 7 && state6c.mp === "present" && state6c.intros === 0, JSON.stringify(state6c));
  await page6c.close(); await ctx6c.close();
  siteState.intentions = INTENTIONS_MAIN;

  // ---- Leg 10: settings govern --------------------------------------
  const settingsNow = (await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN })).body;
  const rows10 = settingsNow.sources.map((x) => ({ sourceKey: x.sourceKey, block: x.block, dayRule: x.dayRule, enabled: x.enabled }));
  const moved = rows10.map((r) => {
    if (r.sourceKey === "daily-rosary") return { ...r, enabled: 0 };
    if (r.sourceKey === "auxilium-christianorum") return { ...r, block: "Night" };
    if (r.sourceKey === "marian-antiphon-midday") return { ...r, enabled: 0 };
    return r;
  });
  await api(BASE, "PUT", "/api/player/source-settings", { json: { sources: moved } });
  const ctx10 = await browser.newContext();
  await wireExtRoutes(ctx10);
  const page10 = await ctx10.newPage();
  await page10.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page10);
  const state10 = await page10.evaluate(() => {
    const cards = {};
    document.querySelectorAll("[data-card]").forEach((el) => { const id = el.getAttribute("data-card"); cards[id] = (cards[id] || 0) + 1; });
    let cur = null; const blockOf = {};
    document.querySelectorAll(".blockhead, [data-card]").forEach((el) => {
      if (el.classList.contains("blockhead")) cur = el.querySelector("h2").textContent.trim();
      else { const id = el.getAttribute("data-card"); if (!(id in blockOf)) blockOf[id] = cur; }
    });
    return { hasRosaryRow: "daily-rosary" in (window.state.ownSlots || {}), cards, blockOf };
  });
  check("10 settings govern: a disabled family does not resolve; a user block move wins; Antiphon follows its enabled rows only (2 of 3)",
    !state10.hasRosaryRow && state10.blockOf["auxilium-christianorum"] === "NIGHT" && state10.cards["marian-antiphon-angelus"] === 2,
    JSON.stringify({ rosary: state10.hasRosaryRow, aux: state10.blockOf["auxilium-christianorum"], antiphon: state10.cards["marian-antiphon-angelus"] }));
  await page10.close(); await ctx10.close();
  await api(BASE, "PUT", "/api/player/source-settings", { json: { sources: rows10 } });

  // ---- Leg 14: the streaming measure --------------------------------
  const oldItems = [];
  for (let i = 1; i <= 2894; i++) oldItems.push(ownItem(`daily-rosary-${shift(YDAY, -i)}`, "Daily Rosary", shift(YDAY, -i), 4));
  const bigHead = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Ora Pro Nobis</title>` +
    ownItem(`morning-prayer-elevenlabs-${TOMORROW}`, "Morning Prayer", TOMORROW) + OWN_TODAY_ITEMS.join("") + OWN_YDAY_ITEMS[0];
  const bigChunks = [];
  let chunkBuf = "";
  for (const it of oldItems) { chunkBuf += it; if (chunkBuf.length > 65536) { bigChunks.push(chunkBuf); chunkBuf = ""; } }
  if (chunkBuf) bigChunks.push(chunkBuf);
  siteState.big = { head: bigHead, chunks: bigChunks };
  siteState.podcast = PODCAST_MAIN;
  const ctx14 = await browser.newContext();
  await wireExtRoutes(ctx14);
  const page14 = await ctx14.newPage();
  await page14.goto(BASE + "/", { waitUntil: "load" });
  await waitOwnSettled(page14);
  await sleep(1500);
  const bytesUsed = await page14.evaluate(() => window.__opnV342.ownFeedBytes());
  const mpState14 = await page14.evaluate(() => window.state.ownSlots["morning-prayer"].state);
  check("14 streaming measure: against a ~2,901-item feed the early stop fires — bytes consumed are a small fraction of the file, and the day still resolves",
    mpState14 === "present" && bytesUsed > 0 && bytesUsed < siteState.bigTotal / 3 && siteState.bigSent < siteState.bigTotal / 2,
    `clientBytes=${bytesUsed} serverSent=${siteState.bigSent} total=${siteState.bigTotal}`);
  await page14.close(); await ctx14.close();
  siteState.big = null;
  await browser.close();

  // ---- Leg 11: transcripts through the publish tail -----------------
  const textDriver = spawnSync("python3", [path.join(APP, "tests", "app-text-leg-v342.py"), String(PORT), PERSIST, TODAY],
    { cwd: FORK, encoding: "utf8", timeout: 240000 });
  check("11 publish-tail app-text staging runs (one withheld script named, not staged)",
    textDriver.status === 0 && /APP-TEXT-LEG OK/.test(textDriver.stdout), (textDriver.stdout + textDriver.stderr).slice(-300));
  const textServe = await apiRaw(BASE, `/api/player/text/${TODAY}/morning-prayer`);
  check("11 the staged text serves byte-identical at the existence-gate route with player_episodes EMPTY",
    textServe.status === 200 && textServe.buf.toString("utf8") === "Fixture script for morning prayer.\n" && peCount === 0,
    `status=${textServe.status} body=${JSON.stringify(textServe.buf.toString("utf8").slice(0, 60))}`);
  const textAbsent = await api(BASE, "GET", `/api/player/text/${TODAY}/daily-rosary`);
  check("11 an absent text answers the standing named 404",
    textAbsent.status === 404 && String(textAbsent.body && textAbsent.body.error || "").includes("episode text not available in the app yet"),
    `status=${textAbsent.status} ${JSON.stringify(textAbsent.body).slice(0, 120)}`);

  // ---- Legs 13/18 + 15: the pre-v342 bed ----------------------------
  let PRISTINE_FORK = path.join(path.dirname(FORK), "v342-pristine");
  if (!fs.existsSync(path.join(PRISTINE_FORK, "app", "wrangler.toml"))) {
    const baseCommit = execFileSync("git", ["-C", FORK, "merge-base", "HEAD", "muse-draft-week"], { encoding: "utf8" }).trim();
    execFileSync("git", ["-C", FORK, "worktree", "add", PRISTINE_FORK, baseCommit], { stdio: "pipe" });
  }
  const PRISTINE_APP = path.join(PRISTINE_FORK, "app");
  applyMigs(PRISTINE_APP, PERSIST2, seedSql());
  startApp(PRISTINE_APP, PORT2, PERSIST2);
  check("setup: pre-v342 bed boots", await waitUp(BASE2));
  await api(BASE2, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
  const MANIFEST = [
    ["morning-prayer", "Morning Prayer", 440], ["daily-rosary", "Daily Rosary", 450],
    ["marian-antiphon-angelus", "Marian Antiphon — Angelus", 460],
    ["novena-st-fixture", "Novena to St. Fixture", 470], ["novena-st-jude", "Novena to St. Jude", 480],
    ["novena-st-rita", "Novena to St. Rita", 490], ["auxilium-christianorum", "Auxilium Christianorum", 500],
    ["daily-reflection", "Daily Reflection", 510],
  ];
  const rundir = path.join(TMPD, "rundir-v342-bed");
  fs.mkdirSync(path.join(rundir, "out"), { recursive: true });
  for (const [key, , freq] of MANIFEST) {
    fs.writeFileSync(path.join(rundir, "out", `${key}.mp3`), tone(`bed-${key}.mp3`, freq, 1));
    fs.writeFileSync(path.join(rundir, "out", `script-${key}.txt`), `Fixture script for ${key}.`);
    fs.writeFileSync(path.join(rundir, `script-${key}.txt`), `Fixture script for ${key}.`);
  }
  fs.writeFileSync(path.join(rundir, "report.json"), JSON.stringify({
    date: TODAY,
    episodes: Object.fromEntries(MANIFEST.map(([key, title]) => [key, { title, file: `${key}.mp3`, duration_s: 60, status: "built" }])),
  }));
  const pushBed = spawnSync("python3", [path.join(PRISTINE_APP, "tests", "push-leg-v339.py"), String(PORT2), path.join(rundir, "report.json"), path.join(rundir, "out")],
    { cwd: PRISTINE_FORK, encoding: "utf8", timeout: 240000 });
  check("15 rollback bed: the pre-v342 build accepts the heal push (stored-day commit)",
    pushBed.status === 0, (pushBed.stdout + pushBed.stderr).slice(-200));
  const bedDay = (await api(BASE2, "GET", "/api/player/day")).body;
  check("15 rollback bed: stored-day serving answers as before the flip (storedDay stands, tracks ride the payload)",
    bedDay.storedDay === TODAY && (bedDay.blocks || []).some((b) => (b.tracks || []).some((t) => t.episodeId === "morning-prayer")),
    `storedDay=${bedDay.storedDay}`);

  // Leg 13: the candidate helper in ADDITIVE mode against the bed.
  const ttsStub = path.join(TMPD, "tts-stub.py");
  fs.writeFileSync(ttsStub, `#!/usr/bin/env python3
import os, sys
args = sys.argv[1:]
out = args[args.index("--output") + 1]
text = sys.stdin.read()
with open(out, "wb") as f:
    f.write(b"STUBMP3:" + text.encode("utf-8")[:120])
`);
  fs.chmodSync(ttsStub, 0o755);
  const segFile = path.join(TMPD, "segments-v342.json");
  const segObj = {};
  for (const b of ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"]) segObj[b] = `Segment text for ${b}.`;
  fs.writeFileSync(segFile, JSON.stringify(segObj));
  const helperEnv = {
    ...process.env, OPN_APP_BASE: BASE2, OPN_APP_TOKEN: TOKEN, OPN_TTS_CMD: ttsStub,
    OPN_SEGMENTS_FILE: segFile, OPN_RETRY_DELAY_S: "0", OPN_PUB_POLL_S: "1",
    OPN_PUB_CF_BASE: `${STUB}/`, OPN_PUB_GH_BASE: STUB, OPN_PUB_SITE_BASE: `${STUB}/site`, OPN_PUB_AUDIO_BASE: "https://audio.orapronobis.media",
  };
  // The CF base seam is a prefix: the helper appends /accounts/...
  helperEnv.OPN_PUB_CF_BASE = STUB;
  // Async spawn (never spawnSync): the stub servers live in THIS
  // process — a blocking spawn would freeze them mid-publish.
  const runHelper = () => new Promise((resolve) => {
    const child = spawn("python3", [path.join(FORK, "jobs", "compose_app_audio.py"), "--date", TODAY, "--publish"],
      { cwd: FORK, env: helperEnv });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code) => resolve({ status: code, stdout: out, stderr: err }));
  });
  const h1 = await runHelper();
  const h1Out = h1.stdout + h1.stderr;
  const segField = h1Out.split("\n").find((l) => l.startsWith("Segments (v337):")) || "";
  const v342Field = h1Out.split("\n").find((l) => l.startsWith("Intentions feed (v342):")) || "";
  check("13 additive run exits 0 with the push half standing (Segments field: intros standing, none missing)",
    h1.status === 0 && segField.includes("standing") && segField.includes("intros 23/23"), `status=${h1.status} field=${segField} :: ${h1Out.slice(-200)}`);
  const bedIntros = (await api(BASE2, "GET", "/api/agent/prayer/intros", { token: TOKEN })).body;
  check("13 additive mode's push behavior unchanged: the intros stand at 'current' in the pre-v342 app (23 rows)",
    (bedIntros.intros || []).length === 23, `rows=${(bedIntros.intros || []).length}`);
  check("18 the helper in publish mode prints ruling 7's field exactly (segments clause on a dual-compose night)",
    v342Field === `Intentions feed (v342): published — intros 23/23 for presented ${TODAY} · segments 6/6 · missing: none`, v342Field);
  const feedXml = stubState.docs.get("docs/intentions.xml") || "";
  const todayIntroItems = (feedXml.match(new RegExp(`intentions-intro-[^"]*-${TODAY}`, "g")) || []).length;
  const todaySegItems = (feedXml.match(new RegExp(`intentions-segment-[^"]*-${TODAY}`, "g")) || []).length;
  check("13 the regenerated intentions.xml carries today's 23 intros + 6 segments, GUID-keyed, audio only (no drawn text anywhere)",
    todayIntroItems === 23 && todaySegItems === 6 && !feedXml.includes("Synthetic intention"),
    `intros=${todayIntroItems} segs=${todaySegItems}`);
  check("13 the 7-day window holds in the feed: day-6 item kept, day-7 item pruned",
    feedXml.includes(`intentions-intro-old-keep-${shift(TODAY, -6)}`) && !feedXml.includes("old-prune"), "");
  const r2Keys = [...stubState.r2.keys()];
  check("13 audio published + pruned in the same step: today's files stand, day-7 audio deleted, day-6 audio kept",
    r2Keys.filter((k) => k.startsWith(`intentions/${TODAY}/intro-`)).length === 23 &&
    r2Keys.filter((k) => k.startsWith(`intentions/${TODAY}/segment-`)).length === 6 &&
    !stubState.r2.has(`intentions/${shift(TODAY, -7)}/intro-old-prune.mp3`) &&
    stubState.r2.has(`intentions/${shift(TODAY, -6)}/intro-old-keep.mp3`),
    `today intros=${r2Keys.filter((k) => k.startsWith(`intentions/${TODAY}/intro-`)).length}`);
  const h2 = await runHelper();
  const feedXml2 = stubState.docs.get("docs/intentions.xml") || "";
  const todayIntroItems2 = (feedXml2.match(new RegExp(`intentions-intro-[^"]*-${TODAY}`, "g")) || []).length;
  check("13 a second publish regenerates rather than duplicates (idempotent by GUID)",
    h2.status === 0 && todayIntroItems2 === 23, `status=${h2.status} items=${todayIntroItems2}`);
  const sheetFixture = fs.readFileSync(path.join(APP, "tests", "fixtures", "v342", "nightly-sheet-step4d.txt"), "utf8");
  check("18 ruling 8's both-dates sentence stands verbatim in the sheet fixture the harness carries, with ruling 7's field shape",
    sheetFixture.includes("This run publishes episodes for <TARGET> and intentions for the consumption date <RUN_DATE>; every date in this step's fields is the consumption date.") &&
    sheetFixture.includes("Intentions feed (v342): published — intros <n>/<m> for presented <date>"),
    "");
  // Flip back: the candidate renders the day whole (its own open
  // was proven above; the bed's stored day still stands beside it).
  const candShell = (await api(BASE, "GET", "/api/player/day")).body;
  const retiredPost = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: TODAY } });
  const retiredIntroAudio = await api(BASE, "GET", "/api/player/intro-audio/morning-prayer");
  check("15 flip-back state: the candidate's shell answers while the bed's stored day stands; the retired push/serving routes are gone from the candidate",
    candShell.presentedDay === TODAY && bedDay.storedDay === TODAY && retiredPost.status === 404 && retiredIntroAudio.status === 404,
    `post=${retiredPost.status} introAudio=${retiredIntroAudio.status}`);

  console.log("\nleg 16 (regressions v339 · v338 · v337 · v335 · v334) runs separately — tallies in §3.");
  // ---- teardown -----------------------------------------------------
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* already gone */ } }
  try { feedServer.close(); } catch { /* noop */ }
  try { siteServer.close(); } catch { /* noop */ }
  console.log(`\nharness-v342: ${passed} passed, ${failed} failed`);
  if (fails.length) console.log("failures: " + fails.join(" · "));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("harness-v342 crashed:", e); for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } } process.exit(2); });
