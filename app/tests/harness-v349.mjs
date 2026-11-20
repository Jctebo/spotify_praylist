#!/usr/bin/env node
// harness-v349 — the v349 gate (Plan §2.6 legs 4-11; legs 1-3 are
// the bundle/playlist proofs executed live at Implement and cited
// in §3): the Novenas block, LAST, on the player side AND the
// prayer-module side; migration 0013 under its override guard;
// the max-start current-block derivation; played-state survival.
// Fixture posture: the standing estate mold (v344/v347/v348) —
// local feed + HTTPS site servers, the presented day built by the
// shipped client from fixture feeds; two app instances (candidate
// + optional pristine via OPN_PRISTINE_APP) for the settings
// comparison. Scratch wrangler instances INSIDE the worktrees,
// synthetic fixture only, tallies read from the COMPLETE log.
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
if (!FORK.includes(".worktrees")) { console.error("HARD GUARD: harness-v349 runs only inside a release worktree"); process.exit(2); }
const PRISTINE_APP = process.env.OPN_PRISTINE_APP || "";
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8996, FEED_PORT = 8956, SITE_PORT = 443, PPORT = 8986;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`, PBASE = `http://127.0.0.1:${PPORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v349");
const PPERSIST = PRISTINE_APP ? path.join(PRISTINE_APP, ".wrangler-test-v349p") : "";
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v349-"));
const FIX = path.join(APP, "tests", "fixtures", "v324");
const NOVENAS_PLAYLIST = "2hclGC0JlP4tC51uohete6";

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chicagoParts = (d) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
const isoOf = (p) => `${p.year}-${p.month}-${p.day}`;
const TODAY = isoOf(chicagoParts(new Date()));
const chicagoHour = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hourCycle: "h23" }).format(new Date())) % 24;
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
function d1Query(appDir, persist, sql) {
  const out = execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"), "--persist-to", persist, "--command", sql, "--json"],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
  const arr = JSON.parse(out.slice(out.indexOf("[")));
  return (arr[0] && arr[0].results) || [];
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
function applySql(appDir, persist, sql) {
  const f = path.join(TMPD, `one-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, sql);
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

// ---- fixture feeds (the v344/v348 presented-day set, + a third novena) ---
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

async function main() {
  let browser = null;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v349-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
    ok(true, "worker bundles clean (esbuild)");

    await new Promise((r) => feedServer.listen(FEED_PORT, r));
    await startSite();

    // ============ LEG 8 · migration 0013 labs (D1, no server) ====
    const mig13 = migFiles(APP).find((f) => path.basename(f).startsWith("0013"));
    const pre13 = migFiles(APP, "0012_mass_homilies_block.sql");
    if (!mig13) {
      ok(false, "L8 migration legs: 0013 file absent in this tree (pristine posture)");
    } else {
      const labA = path.join(APP, ".wrangler-test-v349-labA");
      applyFiles(APP, labA, pre13, seedSql());
      const meta0 = d1Query(APP, labA, "SELECT version FROM player_settings_meta WHERE id=1")[0].version;
      applySql(APP, labA, fs.readFileSync(mig13, "utf8"));
      const sRow = d1Query(APP, labA, "SELECT block, sort_order FROM player_source_settings WHERE source_key='novenas'")[0];
      ok(sRow && sRow.block === "Novenas" && sRow.sort_order === 1,
        `L8a migration: the standing 'novenas' settings row moves to block Novenas at sort 1 (row=${JSON.stringify(sRow)})`);
      const iRow = d1Query(APP, labA, "SELECT block FROM prayer_items WHERE name='Novenas'")[0];
      ok(iRow && iRow.block === "Novenas",
        `L8c migration: the prayer_items 'Novenas' row moves to block Novenas (row=${JSON.stringify(iRow)})`);
      const meta1 = d1Query(APP, labA, "SELECT version FROM player_settings_meta WHERE id=1")[0].version;
      ok(meta1 === meta0 + 1,
        `L8e migration: settings meta version increments by exactly 1 (${meta0} -> ${meta1})`);
      applySql(APP, labA, fs.readFileSync(mig13, "utf8"));
      const sRow2 = d1Query(APP, labA, "SELECT block, sort_order FROM player_source_settings WHERE source_key='novenas'")[0];
      const iRow2 = d1Query(APP, labA, "SELECT block FROM prayer_items WHERE name='Novenas'")[0];
      ok(sRow2 && sRow2.block === "Novenas" && sRow2.sort_order === 1 && iRow2 && iRow2.block === "Novenas",
        `L8d migration: a second application matches zero guarded rows — both rows stand unchanged (settings=${JSON.stringify(sRow2)}, item=${JSON.stringify(iRow2)})`);
      fs.rmSync(labA, { recursive: true, force: true });

      const labB = path.join(APP, ".wrangler-test-v349-labB");
      applyFiles(APP, labB, pre13, seedSql());
      applySql(APP, labB, "UPDATE player_source_settings SET block='Evening', sort_order=5 WHERE source_key='novenas';");
      applySql(APP, labB, fs.readFileSync(mig13, "utf8"));
      const held = d1Query(APP, labB, "SELECT block, sort_order FROM player_source_settings WHERE source_key='novenas'")[0];
      const itemB = d1Query(APP, labB, "SELECT block FROM prayer_items WHERE name='Novenas'")[0];
      ok(held && held.block === "Evening" && held.sort_order === 5 && itemB && itemB.block === "Novenas",
        `L8b migration: a user-moved settings row FAILS the guard and stands untouched — the held override (row=${JSON.stringify(held)}); the module item still moves (${JSON.stringify(itemB)})`);
      fs.rmSync(labB, { recursive: true, force: true });
    }

    // ============ candidate app ==================================
    // Production ordering: prayer_items stand in the D1 long
    // before 0013 applies, so the fixture seeds items after
    // migrations <= 0012 and applies 0013 last (the labs above
    // use the same order).
    applyFiles(APP, PERSIST, migFiles(APP, "0012_mass_homilies_block.sql"), seedSql());
    if (mig13) applySql(APP, PERSIST, fs.readFileSync(mig13, "utf8"));
    startApp(APP, PORT, PERSIST);
    ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
    const draw = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: TODAY } });
    ok(draw.status === 200, `fixture: the presented day's draw stands (status=${draw.status})`);
    const appJs = (await api(BASE, "GET", "/app.js")).text;
    let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
    ok(parses, "fixture: the served /app.js parses (vm.Script)");

    // ---- LEG 4 · player shell ----------------------------------
    const shell = await api(BASE, "GET", "/api/agent/player/day", { token: TOKEN });
    const sBlocks = (shell.body && shell.body.blocks) || [];
    const sNames = sBlocks.map((b) => b.block);
    const novShell = sBlocks.find((b) => b.block === "Novenas");
    const midShell = sBlocks.find((b) => b.block === "Midmorning");
    ok(JSON.stringify(sNames) === JSON.stringify(["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night", "Mass and Homilies", "Novenas"])
      && !!novShell && novShell.caption === "the day's novenas"
      && novShell.spotifyUrl === `https://open.spotify.com/playlist/${NOVENAS_PLAYLIST}`,
      `L4 player shell: block list ends [..., Night, Mass and Homilies, Novenas]; Novenas caption + Praylist URL stand (blocks=${JSON.stringify(sNames)}, caption=${novShell && novShell.caption}, url=${novShell && novShell.spotifyUrl})`);
    // (the shell payload carries no track lists by design — the
    // client builds them at open; track placement is proven by
    // the L9 browser legs below.)

    // ---- LEG 5+6 · module payload + introTexts ------------------
    const mod = await api(BASE, "GET", `/api/agent/prayer/day?date=${TODAY}`, { token: TOKEN });
    const mBlocks = (mod.body && mod.body.blocks) || [];
    const mNames = mBlocks.map((b) => b.block);
    const novMod = mBlocks.find((b) => b.block === "Novenas");
    const midMod = mBlocks.find((b) => b.block === "Midmorning");
    const novDevs = (novMod && novMod.devotions) || [];
    const novDrawn = novDevs.length === 1 && novDevs[0].intentions && novDevs[0].intentions.length === 1 ? novDevs[0].intentions[0].text : null;
    ok(mNames[mNames.length - 1] === "Novenas" && novDevs.length === 1 && novDevs[0].name === "Novenas" && !!novDrawn
      && !(midMod.devotions || []).some((d) => d.name === "Novenas") && mod.body.devotionCount === 35,
      `L5 module payload: Novenas block stands LAST with the single Novenas item and a drawn intention; Midmorning's module block no longer carries it; the day still draws 35 items (blocks=${JSON.stringify(mNames)}, drawn=${JSON.stringify(novDrawn)}, count=${mod.body.devotionCount})`);
    const introTexts = (shell.body && shell.body.introTexts) || {};
    ok(typeof introTexts.novenas === "string" && introTexts.novenas.length > 0 && introTexts.novenas === novDrawn,
      `L6 intros: the shell introTexts map carries the "novenas" key with the Novenas item's drawn text, keyed by ITEM (introTexts.novenas=${JSON.stringify(introTexts.novenas)}, drawn=${JSON.stringify(novDrawn)})`);

    // ---- LEG 11 · segment dry leg -------------------------------
    const frames = { Morning: "as this morning begins", Midmorning: "in the middle of the morning's work", Midday: "at midday", Afternoon: "in the afternoon", Evening: "as evening comes", Night: "at night", "Mass and Homilies": "as we go to Mass today", Novenas: "in the day's novenas" };
    const scripts = {};
    for (const b of mBlocks) {
      const sents = (b.devotions || []).map((d) => `For ${d.name}, the intention is ${(d.intentions && d.intentions[0] && d.intentions[0].text) || "—"}.`);
      scripts[b.block] = `Lord God, ${frames[b.block] || ""}, we bring before You the intentions for each part of it. ${sents.join(" ")} Through Christ our Lord. Amen.`;
    }
    ok(Object.keys(scripts).length === 8 && scripts.Novenas.includes("For Novenas, the intention is") && !scripts.Midmorning.includes("Novenas"),
      `L11 segment dry leg: the step-7b composition form over the eight-block module payload yields eight scripts; the Novenas script draws only from the Novenas block; the Midmorning script contains no novena sentence (scripts=${Object.keys(scripts).join(",")})`);

    // ---- LEG 7 · derivation + due -------------------------------
    const src = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
    const blocksM = src.match(/const PRAYER_BLOCKS = \[([^\]]+)\]/);
    const srcBlocks = blocksM ? [...blocksM[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    const startM = src.match(/const PRAYER_BLOCK_START[^=]*= \{([\s\S]*?)\};/);
    const srcStarts = {};
    if (startM) for (const m of startM[1].matchAll(/"?([\w ]+)"?: (\d+)/g)) srcStarts[m[1].trim()] = Number(m[2]);
    const oldDerive = (blocks, starts, hour) => blocks.reduce((cur, b) => (hour >= (starts[b] ?? 0) ? b : cur), "Morning");
    const newDerive = (blocks, starts, hour) => blocks.reduce((cur, b) => { const s = starts[b] ?? 0; const cs = starts[cur] ?? 0; return hour >= s && s > cs ? b : cur; }, "Morning");
    const seven = srcBlocks.filter((b) => b !== "Novenas");
    let same7 = srcBlocks.length === 8;
    for (let h = 0; h < 24; h++) if (oldDerive(seven, srcStarts, h) !== newDerive(seven, srcStarts, h)) same7 = false;
    const eight = srcBlocks;
    const at = (h) => newDerive(eight, srcStarts, h);
    const eightOk = [9, 10, 11].every((h) => at(h) === "Midmorning") && [21, 22, 23].every((h) => at(h) === "Night")
      && Array.from({ length: 24 }, (_, h) => at(h)).every((b) => b !== "Novenas" && b !== "Mass and Homilies");
    const srcHasNewForm = /s > cs/.test(src) || /start > /.test(src);
    ok(same7 && eightOk && srcStarts.Novenas === 9 && srcHasNewForm,
      `L7 derivation: on the seven-block constants the max-start derivation equals the old list-order reduce at every hour 0-23; on the eight-block list it returns Midmorning 09-11 and Night 21-23, never Novenas or Mass and Homilies; BLOCK_START[Novenas]=9 in source; the shipped source carries the max-start form (starts=${JSON.stringify(srcStarts)})`);
    const hourNow = chicagoHour();
    ok(!!novMod && novMod.due === (hourNow >= 9) && (mBlocks.find((b) => b.block === "Mass and Homilies") || {}).due === false,
      `L7 due: at the live Chicago hour ${hourNow}, the module payload reads Novenas due=${novMod && novMod.due} (start 9) and Mass and Homilies due=false (start 24), exactly as before`);

    // ---- LEG 10 · settings surface vs pristine ------------------
    const candSet = await api(BASE, "GET", "/api/agent/player/settings", { token: TOKEN });
    const candRows = ((candSet.body && candSet.body.sources) || []);
    const candNov = candRows.find((r) => r.sourceKey === "novenas");
    ok(appJs.includes("'Novenas'") && !!candNov && candNov.block === "Novenas",
      `L10 settings surface: the served client carries Novenas in its settings block lists; the door settings read shows the novenas row under block Novenas (row=${JSON.stringify(candNov)})`);
    if (PRISTINE_APP) {
      applyFiles(PRISTINE_APP, PPERSIST, migFiles(PRISTINE_APP), seedSql());
      startApp(PRISTINE_APP, PPORT, PPERSIST);
      ok(await waitUp(PBASE), "pristine app up for the settings comparison");
      const prSet = await api(PBASE, "GET", "/api/agent/player/settings", { token: TOKEN });
      const prRows = ((prSet.body && prSet.body.sources) || []);
      const strip = (rows) => rows.filter((r) => r.sourceKey !== "novenas").map((r) => JSON.stringify(r)).sort();
      const othersSame = JSON.stringify(strip(candRows)) === JSON.stringify(strip(prRows));
      const prShell = await api(PBASE, "GET", "/api/agent/player/day", { token: TOKEN });
      ok(othersSame && candSet.body.version === prSet.body.version + 1 && shell.body.version === prShell.body.version + 1,
        `L10 settings comparison: every settings row except 'novenas' is identical candidate vs pristine; the settings version stands exactly +1 (candidate=${candSet.body.version}, pristine=${prSet.body.version})`);
    } else {
      ok(false, "L10 settings comparison: OPN_PRISTINE_APP not set — comparison not run");
    }

    // ---- LEG 9 · browser: blocks, played state, queues ----------
    const browserEnv = { ...process.env };
    for (const k of Object.keys(browserEnv)) if (/proxy/i.test(k)) delete browserEnv[k];
    browser = await chromium.launch({
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
    // played marks for two of the three fixture novenas, set pre-load
    await page.addInitScript((today) => {
      const map = { "novena-st-jude": {}, "novena-st-anne": {} };
      map["novena-st-jude"][today] = true; map["novena-st-anne"][today] = true;
      localStorage.setItem("opn-played-v344", JSON.stringify(map));
    }, TODAY);
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (window.state.dayDescs || []).some((d) => d.episodeId === "novena-st-rita"), null, { timeout: 45000 }).catch(() => {});
    await sleep(500);
    const dom = await page.evaluate(() => {
      const heads = [...document.querySelectorAll(".blockhead")].map((h) => ((h.querySelector("h2") || {}).textContent || ""));
      const cards = (bn) => {
        const head = [...document.querySelectorAll(".blockhead")].find((h) => (h.querySelector("h2") || {}).textContent === bn.toUpperCase());
        if (!head) return [];
        const out = []; let el = head.nextElementSibling;
        while (el && !el.classList.contains("blockhead")) { if (el.dataset && el.dataset.card) out.push(el.dataset.card); el = el.nextElementSibling; }
        return out;
      };
      const descs = (bn) => (window.state.dayDescs || []).filter((d) => d.block === bn).map((d) => d.episodeId);
      return { heads, novCards: cards("Novenas"), midCards: cards("Midmorning"), novDescs: descs("Novenas"), midDescs: descs("Midmorning") };
    });
    const novDescOk = ["novena-st-jude", "novena-st-anne", "novena-st-rita"].every((id) => dom.novDescs.includes(id))
      && dom.novDescs.every((id, i) => !id.startsWith("intro:") || dom.novDescs[i + 1] === id.slice(6));
    ok(dom.heads[dom.heads.length - 1] === "NOVENAS"
      && JSON.stringify(dom.novCards) === JSON.stringify(["novena-st-jude", "novena-st-anne", "novena-st-rita"])
      && JSON.stringify(dom.midCards) === JSON.stringify(["ext-gospel-exegesis", "ext-midmorning-prayer"])
      && !dom.midDescs.some((id) => id.includes("novena")) && novDescOk,
      `L9 browser blocks: the Novenas block renders LAST with its three novena cards and intro-paired descriptors; Midmorning renders Exegesis then Terce with no novena anywhere (heads=${JSON.stringify(dom.heads)}, novCards=${JSON.stringify(dom.novCards)}, midCards=${JSON.stringify(dom.midCards)}, novDescs=${JSON.stringify(dom.novDescs)}, errors=${pageErrors.length})`);
    // played marks survive: the client's own played read honors the
    // pre-set marks for the (unchanged) novena track ids
    const playedRead = await page.evaluate((today) => {
      const m = JSON.parse(localStorage.getItem("opn-played-v344") || "{}");
      const cache = window.state && window.state.playedCache;
      return { lsJude: !!(m["novena-st-jude"] && m["novena-st-jude"][today]), lsAnne: !!(m["novena-st-anne"] && m["novena-st-anne"][today]), cache: cache ? JSON.stringify(cache).slice(0, 200) : null };
    }, TODAY);
    // Novenas block play: queue = the unplayed remainder only
    const q1 = await page.evaluate(() => {
      const btn = document.querySelector('[data-queue="Novenas"]');
      if (btn) { btn.click(); return true; }
      return false;
    }).catch(() => false);
    await sleep(1200);
    const queueNov = await page.evaluate(() => (window.state.queue || []).map((d) => d.episodeId || d.id)).catch(() => []);
    ok(playedRead.lsJude && playedRead.lsAnne && JSON.stringify(queueNov) === JSON.stringify(["intro:novena-st-rita", "novena-st-rita"]),
      `L9 played + queue: pre-change opn-played-v344 marks for novena-st-jude/st-anne (track ids unchanged) still read as played; the Novenas block's own v347 queue builds ONLY the unplayed remainder — the two played novenas are skipped, intro paired (queue=${JSON.stringify(queueNov)}, q1=${JSON.stringify(q1)})`);
    await page.evaluate(() => { const b = document.querySelector("[data-stop], .np-stop"); if (b) b.click(); if (window.state) window.state.queue = []; }).catch(() => {});
    const midBtn = await page.evaluate(() => {
      const btn = document.querySelector('[data-queue="Midmorning"]');
      if (btn) { btn.click(); return true; }
      return false;
    }).catch(() => false);
    await sleep(1200);
    const queueMid = await page.evaluate(() => (window.state.queue || []).map((d) => d.episodeId || d.id)).catch(() => []);
    ok(midBtn && queueMid.length > 0 && !queueMid.some((id) => String(id).includes("novena")),
      `L9 Midmorning queue: the Midmorning block builds its queue with NO novena entries (queue=${JSON.stringify(queueMid)})`);

    ok(pageErrors.length === 0, `browser: no page errors across the v349 legs (errors=${JSON.stringify(pageErrors.slice(0, 3))})`);
  } catch (e) {
    ok(false, `harness exception: ${e && e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* gone */ } }
    if (siteServer) siteServer.close();
    feedServer.close();
    console.log(`# harness-v349: ${n - fails}/${n} ok`);
    process.exit(fails ? 1 : 0);
  }
}
main();
