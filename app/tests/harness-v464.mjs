#!/usr/bin/env node
// harness-v464 — the v464 gate (Plan §2.7): FORMATION PODCAST
// FEEDS — The Exorcist Files + The Counsel of Trent as registry
// series of a fourth, RSS kind, plus the Formation side toggle
// (Courses · Podcasts · Video & more). Server legs on the
// estate wrangler mold (LOCAL_DEV, the v434 form): both shows'
// feeds are served through the EXT_EXORCIST_FEED_URL /
// EXT_COUNSEL_TRENT_FEED_URL env seams by this harness itself
// (fetch-counted, mode-switched), in the shows' own shapes —
// an ART19-shaped RSS (iTunes season/episode fields, per-item
// GUIDs, long descriptions, 60 items to prove the D4 window)
// and a SoundCloud-shaped RSS (tag:soundcloud GUIDs,
// Podtrac-redirect enclosures, no per-item art, 55 items). The
// audio/video fixtures ride their standing seams in the mold's
// small forms. Migration 0027's snapshot store is asserted
// directly in D1. Client legs run the real client in Chromium
// (service workers blocked, per the mold).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v464 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8996;
const FEEDPORT = 8997;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v464");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v464-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// ---- the Exorcist-shaped RSS fixture (ART19 form) -------------
// 60 GUID items (item 1 = the verified newest episode's form),
// a duplicate of item 5's GUID carrying an older pubDate, one
// GUID-less item (keys on its enclosure URL), and one
// enclosure-less item (skipped at build). Feed order is
// newest-first, as ART19 serves.
const EXF_BASE = Date.parse("Fri, 13 Nov 2026 08:00:00 GMT");
const exfPub = (i) => new Date(EXF_BASE - (i - 1) * 86400000).toUTCString();
function exfItem(i) {
  const nn = String(i).padStart(3, "0");
  const title = i === 1 ? "S3 | Case #24 | Through The Years \u2014 Part 2" : `Case ${100 - i}: Episode Title ${i}`;
  return `<item><title>${title}</title><pubDate>${exfPub(i)}</pubDate>`
    + `<guid isPermaLink="false">exf-guid-${nn}</guid>`
    + `<enclosure url="https://rss.art19.com/episodes/ep-${nn}.mp3" length="40000000" type="audio/mpeg"/>`
    + `<itunes:duration>${i === 1 ? 5046 : 3600}</itunes:duration><itunes:season>3</itunes:season><itunes:episode>${22 - (i % 22)}</itunes:episode>`
    + (i % 3 === 0 ? `<itunes:image href="https://img.example/exf-ep${nn}.jpg"/>` : "")
    + `<description>Episode ${i} description &amp; show notes.</description></item>`;
}
const EXF_ITEMS = [];
for (let i = 1; i <= 60; i++) {
  EXF_ITEMS.push(exfItem(i));
  if (i === 10) EXF_ITEMS.push(`<item><title>Case 95: Episode Title 5 (older dupe)</title><pubDate>${new Date(EXF_BASE - 40 * 86400000).toUTCString()}</pubDate><guid isPermaLink="false">exf-guid-005</guid><enclosure url="https://rss.art19.com/episodes/ep-005-old.mp3" length="39000000" type="audio/mpeg"/><itunes:duration>3500</itunes:duration><description>The older duplicate.</description></item>`);
  if (i === 20) EXF_ITEMS.push(`<item><title>Guidless Episode</title><pubDate>${new Date(EXF_BASE - 19.5 * 86400000).toUTCString()}</pubDate><enclosure url="https://rss.art19.com/episodes/guidless.mp3" length="38000000" type="audio/mpeg"/><itunes:duration>3300</itunes:duration><description>An item with no GUID.</description></item>`);
  if (i === 30) EXF_ITEMS.push(`<item><title>Enclosureless Announcement</title><pubDate>${new Date(EXF_BASE - 29.5 * 86400000).toUTCString()}</pubDate><guid isPermaLink="false">exf-guid-nofile</guid><description>An announcement with no enclosure.</description></item>`);
}
function exfFeed(items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>The Exorcist Files</title>`
    + `<itunes:image href="https://img.example/exf-show.jpg"/><description>Fr. Carlos Martins fixture show.</description>`
    + items.join("\n") + `</channel></rss>`;
}
const EXF_OK = exfFeed(EXF_ITEMS);
// The shifted feed (S4b): five brand-new items ahead of the same
// sixty — the window's tail moves; GUID-keyed marks must stand.
const EXF_NEW = [];
for (let j = 1; j <= 5; j++) {
  EXF_NEW.push(`<item><title>New Episode ${j}</title><pubDate>${new Date(EXF_BASE + (7 - j) * 86400000).toUTCString()}</pubDate><guid isPermaLink="false">exf-guid-new${j}</guid><enclosure url="https://rss.art19.com/episodes/ep-new${j}.mp3" length="41000000" type="audio/mpeg"/><itunes:duration>3700</itunes:duration><description>A newer episode.</description></item>`);
}
const EXF_OK2 = exfFeed([...EXF_NEW, ...EXF_ITEMS]);

// ---- the Counsel-shaped RSS fixture (SoundCloud form) ---------
// 55 items, tag:soundcloud GUIDs, Podtrac-redirect enclosures,
// no per-item art (the channel art is the fallback).
const CT_BASE = Date.parse("Fri, 13 Nov 2026 13:01:04 GMT");
function ctItem(i) {
  const track = 3000 - i;
  const title = i === 1 ? "#1226: FFAF: Answering Protestant Objections" : `#${1227 - i}: Counsel Episode ${i}`;
  return `<item><title>${title}</title><pubDate>${new Date(CT_BASE - (i - 1) * 2 * 86400000).toUTCString()}</pubDate>`
    + `<guid isPermaLink="false">tag:soundcloud,2010:tracks/${track}</guid>`
    + `<enclosure url="https://dts.podtrac.com/redirect.mp3/feeds.soundcloud.com/stream/${track}-trenthornpodcast-episode-${i}.mp3" length="30000000" type="audio/mpeg"/>`
    + `<itunes:duration>${1500 + i}</itunes:duration>`
    + `<description>Counsel episode ${i} description.</description></item>`;
}
const CT_ITEMS = [];
for (let i = 1; i <= 55; i++) CT_ITEMS.push(ctItem(i));
const CT_OK = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>The Counsel of Trent</title>`
  + `<itunes:image href="https://i1.sndcdn.com/avatars-fixture-original.jpg"/><description>Trent Horn fixture show.</description>`
  + CT_ITEMS.join("\n") + `</channel></rss>`;

// ---- the standing small fixtures (audio + video kinds) --------
function rssItem(day, title, file, pub, img) {
  return `<item><title>Day ${day}: ${title}</title><pubDate>${pub}</pubDate>`
    + `<enclosure url="https://audio.example/${file}" length="1000" type="audio/mpeg"/>`
    + (img ? `<itunes:image href="${img}"/>` : "")
    + `<description>${title} description</description></item>`;
}
function rssFeed(showImg, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Fixture</title>`
    + (showImg ? `<itunes:image href="${showImg}"/>` : "") + items.join("\n") + `</channel></rss>`;
}
const CIY_XML = rssFeed("https://img.example/ciy-show.jpg", [
  rssItem(1, "The Creation", "ciy-day1.mp3", "Mon, 05 Jan 2026 12:00:00 GMT", "https://img.example/ciy-day1.jpg"),
  rssItem(2, "The Fall", "ciy-day2.mp3", "Tue, 06 Jan 2026 12:00:00 GMT", "https://img.example/ciy-day2.jpg"),
  rssItem(3, "The Flood", "ciy-day3.mp3", "Wed, 07 Jan 2026 12:00:00 GMT", "https://img.example/ciy-day3.jpg"),
]);
const BIY_XML = rssFeed("https://img.example/biy-show.jpg", [
  rssItem(1, "In the Beginning", "biy-day1.mp3", "Mon, 05 Jan 2026 12:00:00 GMT", null),
  rssItem(2, "The Patriarchs", "biy-day2.mp3", "Tue, 06 Jan 2026 12:00:00 GMT", null),
]);
const RIY_XML = rssFeed("https://img.example/riy-show.jpg", [
  rssItem(1, "The Joyful Mysteries", "riy-day1.mp3", "Mon, 05 Jan 2026 12:00:00 GMT", null),
]);
const YT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<title>CatholicTV</title>
<entry><id>yt:video:vidAlpha111</id><yt:videoId>vidAlpha111</yt:videoId><title>Catholic Mass Today</title><link rel="alternate" href="https://www.youtube.com/watch?v=vidAlpha111"/><published>2026-11-15T14:00:00+00:00</published><media:group><media:thumbnail url="https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg" width="480" height="360"/><media:description>Daily Mass.</media:description></media:group></entry>
</feed>`;

let exfMode = "ok", ctMode = "ok";
let exfFetches = 0, ctFetches = 0;
const feedServer = http.createServer((rq, rs) => {
  const u = rq.url || "";
  if (u.startsWith("/exf.xml")) {
    exfFetches++;
    if (exfMode === "fail") { rs.writeHead(500); rs.end("no"); return; }
    rs.writeHead(200, { "content-type": "application/rss+xml" });
    if (exfMode === "empty") { rs.end(exfFeed([])); return; }
    rs.end(exfMode === "ok2" ? EXF_OK2 : EXF_OK);
    return;
  }
  if (u.startsWith("/counsel.xml")) {
    ctFetches++;
    if (ctMode === "fail") { rs.writeHead(500); rs.end("no"); return; }
    rs.writeHead(200, { "content-type": "application/rss+xml" });
    rs.end(CT_OK);
    return;
  }
  if (u.startsWith("/yt.xml")) { rs.writeHead(200, { "content-type": "application/atom+xml" }); rs.end(YT_XML); return; }
  if (u.startsWith("/ciy.xml")) { rs.writeHead(200, { "content-type": "application/rss+xml" }); rs.end(CIY_XML); return; }
  if (u.startsWith("/biy.xml")) { rs.writeHead(200, { "content-type": "application/rss+xml" }); rs.end(BIY_XML); return; }
  if (u.startsWith("/riy.xml")) { rs.writeHead(200, { "content-type": "application/rss+xml" }); rs.end(RIY_XML); return; }
  rs.writeHead(404); rs.end("no");
});

// ---- wrangler helpers (the estate mold) -----------------------
function wranglerD1(args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function d1q(sql) {
  const out = wranglerD1(["--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results || [];
}
function d1run(sql) { wranglerD1(["--command", sql]); }
function applyMigrations() {
  const dir = path.join(APP, "migrations");
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(dir, f));
  fs.rmSync(PERSIST, { recursive: true, force: true });
  const f = path.join(TMPD, "migs.sql");
  fs.writeFileSync(f, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  wranglerD1(["--file", f]);
}
const procs = [];
function startApp() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`,
    "--var", `EXT_EXORCIST_FEED_URL:http://127.0.0.1:${FEEDPORT}/exf.xml`,
    "--var", `EXT_COUNSEL_TRENT_FEED_URL:http://127.0.0.1:${FEEDPORT}/counsel.xml`,
    "--var", `EXT_YT_CATHOLICTV_FEED_URL:http://127.0.0.1:${FEEDPORT}/yt.xml`,
    "--var", `EXT_CIY_FEED_URL:http://127.0.0.1:${FEEDPORT}/ciy.xml`,
    "--var", `EXT_BIAY_FEED_URL:http://127.0.0.1:${FEEDPORT}/biy.xml`,
    "--var", `EXT_RIY_FEED_URL:http://127.0.0.1:${FEEDPORT}/riy.xml`];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(3000) }); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const req = async (method, p, body, headers = {}) => {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const out = { status: r.status, body: await r.json().catch(() => ({})) };
      if (out.status >= 500 && i < 4) { await sleep(800); continue; }
      return out;
    } catch (e) { lastErr = e; await sleep(800); }
  }
  throw lastErr;
};
const door = (p) => req("GET", "/api/agent/podcasts/progress" + p, undefined, { authorization: `Bearer ${TOKEN}` });
const ageRssSnapshot = (series) => {
  const old = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const rows = d1q(`SELECT payload FROM rss_snapshots WHERE series='${series}'`);
  if (!rows.length) return;
  const p = JSON.parse(rows[0].payload);
  p.builtAt = old;
  d1run(`UPDATE rss_snapshots SET built_at='${old}', payload='${JSON.stringify(p).replace(/'/g, "''")}' WHERE series='${series}'`);
};

// ---- statics ----------------------------------------------------
function statics() {
  ok(fs.existsSync(path.join(APP, "migrations/0027_rss_snapshots.sql")), "S: migration 0027 stands in the tree");
  const mig = fs.readFileSync(path.join(APP, "migrations/0027_rss_snapshots.sql"), "utf8");
  ok(mig.includes("CREATE TABLE IF NOT EXISTS rss_snapshots") && mig.includes("series TEXT PRIMARY KEY") && mig.includes("payload TEXT NOT NULL") && mig.includes("built_at TEXT NOT NULL"),
    "S: 0027 creates rss_snapshots (series PK, payload, built_at) mirroring video_snapshots column for column");
  ok(INDEX.includes('const RSS_EXORCIST_FEED_URL = "https://rss.art19.com/the-exorcist-files"')
    && INDEX.includes('const RSS_COUNSEL_TRENT_FEED_URL = "https://feeds.soundcloud.com/users/soundcloud:users:406683825/sounds.rss"'),
    "S: both feed URLs stand as pinned constants (the Counsel pin from §2.0)");
  ok(INDEX.includes("const RSS_SNAPSHOT_MAX_AGE_MS = 2 * 3600 * 1000") && INDEX.includes("const RSS_WINDOW = 50")
    && INDEX.includes("POD_RSS_SERIES_LIST") && INDEX.includes("function podRssParseFeed") && INDEX.includes("function podRssSequence"),
    "S: the rss kind stands — def list, GUID-aware parse, sequence, the 2h bound, the 50 window");
  ok(CLIENT.includes("function paintPodcastRss") && CLIENT.includes("function switchPodSide") && CLIENT.includes("'opn-tabside-podcasts-v464'"),
    "S: the client carries the rss page, the Formation switch act, and the stored-side key");
}

// ---- a tiny playable WAV ---------------------------------------
function wavBuffer(seconds) {
  const rate = 8000, len = rate * seconds;
  const buf = Buffer.alloc(44 + len * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + len * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(len * 2, 40);
  return buf;
}

let browser = null;
try {
  statics();
  await new Promise((r) => feedServer.listen(FEEDPORT, "127.0.0.1", r));
  try { execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stood on the port */ }
  for (let i = 0; i < 20; i++) {
    try { await fetch(BASE + "/", { signal: AbortSignal.timeout(1000) }); await sleep(500); }
    catch { break; }
    if (i === 19) throw new Error("port 8996 never freed — a stale server stands");
  }
  applyMigrations();
  ok(d1q("SELECT name FROM sqlite_master WHERE type='table' AND name='rss_snapshots'").length === 1,
    "migration 0027 applies clean — rss_snapshots stands");
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV)");

  // ---------- S1: the Exorcist build — parse, GUID keys, window --
  const f0 = exfFetches;
  const exf = await req("GET", "/api/player/podcasts?series=exorcist-files");
  ok(exf.status === 200 && exf.body.kind === "rss" && exf.body.available === true && exf.body.stale === false,
    "S1: a cold read builds the Exorcist snapshot and serves the rss payload (kind rss, available, not stale)");
  ok(exfFetches - f0 === 1, `S1: the cold build fetched the feed exactly once (${exfFetches - f0})`);
  const ee = exf.body.entries || [];
  ok(ee.length === 50 && exf.body.total === 50, `S2: the 60-item feed stores exactly the latest 50 (total ${exf.body.total})`);
  ok(ee[0].key === "exf-guid-001" && ee[0].title === "S3 | Case #24 | Through The Years \u2014 Part 2" && ee[0].durationS === 5046,
    "S1: entries stand newest-first — entries[0] is the newest episode, its fields parsed (title, iTunes duration)");
  ok(ee[0].label === "Nov 13, 2026" && ee[1].label === "Nov 12, 2026",
    "S1: entry labels are Chicago date labels derived at payload build (videoDateLabel's discipline)");
  ok(ee.filter((e) => e.key === "exf-guid-005").length === 1 && ee.find((e) => e.key === "exf-guid-005").url === "https://rss.art19.com/episodes/ep-005.mp3",
    "S1: a duplicate GUID collapses to its NEWEST occurrence (the older dupe's URL never stands)");
  const gl = ee.find((e) => e.key === "https://rss.art19.com/episodes/guidless.mp3");
  ok(!!gl && gl.title === "Guidless Episode", "S1: a GUID-less item keys on its enclosure URL");
  ok(!ee.some((e) => e.key === "exf-guid-nofile"), "S1: an enclosure-less item is skipped at build (unplayable)");
  ok(new Set(ee.map((e) => e.key)).size === ee.length, "S1: every stored key is unique");
  ok(exf.body.currentKey === "exf-guid-001" && exf.body.currentLabel === "Nov 13, 2026" && exf.body.listenedCount === 0
    && exf.body.showImageUrl === "https://img.example/exf-show.jpg" && exf.body.showDesc === "Fr. Carlos Martins fixture show.",
    "S1: current is the latest episode; the channel art + description ride the payload");
  ok(ee[0].imageUrl === "https://img.example/exf-show.jpg" && ee[2].imageUrl === "https://img.example/exf-ep003.jpg",
    "S1: per-entry art falls back to the channel art; an item's own art wins where the feed carries it");
  const exfRow = d1q("SELECT payload FROM rss_snapshots WHERE series='exorcist-files'");
  const exfSnap = exfRow.length ? JSON.parse(exfRow[0].payload) : null;
  ok(!!exfSnap && exfSnap.entries.length === 50 && exfSnap.entries[0].key === "exf-guid-001",
    "S2: the D1 rss_snapshots row itself holds the 50-entry window, newest first — asserted on the store, not only the payload");

  // ---------- S2: the Counsel build ------------------------------
  const ct = await req("GET", "/api/player/podcasts?series=counsel-of-trent");
  const ce = ct.body.entries || [];
  ok(ct.status === 200 && ct.body.kind === "rss" && ct.body.available === true && ce.length === 50,
    `S2: the Counsel build serves its window (55 served items -> 50 stored; got ${ce.length})`);
  ok(ce[0].key === "tag:soundcloud,2010:tracks/2999" && ce[0].title === "#1226: FFAF: Answering Protestant Objections" && ce[0].label === "Nov 13, 2026",
    "S2: SoundCloud-form GUIDs key the entries; entries[0] is the verified newest episode");
  ok(ce[0].url === "https://dts.podtrac.com/redirect.mp3/feeds.soundcloud.com/stream/2999-trenthornpodcast-episode-1.mp3",
    "S2: the Podtrac-redirect enclosure stands as served");
  ok(ce.every((e) => e.imageUrl === "https://i1.sndcdn.com/avatars-fixture-original.jpg"),
    "S2: with no per-item art, every entry falls back to the channel art");

  // ---------- S3: snapshot discipline ----------------------------
  const c0 = ctFetches;
  await req("GET", "/api/player/podcasts?series=counsel-of-trent");
  ok(ctFetches - c0 === 0, "S3: a fresh snapshot serves with ZERO further fetches");
  ageRssSnapshot("counsel-of-trent");
  const ctRe = await req("GET", "/api/player/podcasts?series=counsel-of-trent");
  ok(ctFetches - c0 === 1 && ctRe.body.stale === false && ctRe.body.available === true,
    "S3: a snapshot past the 2h bound rebuilds on read (one fetch) and serves fresh");
  ctMode = "fail";
  ageRssSnapshot("counsel-of-trent");
  const ctStale = await req("GET", "/api/player/podcasts?series=counsel-of-trent");
  ok(ctStale.body.available === true && ctStale.body.stale === true && (ctStale.body.entries || []).length === 50,
    "S3: a failed rebuild serves the standing snapshot with stale: true, never emptied");
  d1run("DELETE FROM rss_snapshots WHERE series='counsel-of-trent'");
  const ctNone = await req("GET", "/api/player/podcasts?series=counsel-of-trent");
  ok(ctNone.body.available === false && (ctNone.body.entries || []).length === 0,
    "S3: no snapshot and the feed down — available: false, the series' unavailable surface");
  const exfUnaff = await req("GET", "/api/player/podcasts?series=exorcist-files");
  ok(exfUnaff.body.available === true && (exfUnaff.body.entries || []).length === 50,
    "S3: the other RSS series' payload is unaffected by the outage");
  ctMode = "ok";
  const ctRec = await req("GET", "/api/player/podcasts?series=counsel-of-trent");
  ok(ctRec.body.available === true && ctRec.body.stale === false, "S3: the next good read recovers the series");

  // ---------- S6: the index map + the payload-shape regression ---
  const idx = await req("GET", "/api/player/podcasts");
  const list = idx.body.seriesList || [];
  ok(JSON.stringify(list.map((s) => s.series)) === JSON.stringify(["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year", "catholictv", "exorcist-files", "counsel-of-trent", "the-ai-signal"]),
    `S6: the index construction order stands — audio -> video -> rss -> own (${JSON.stringify(list.map((s) => s.series))})`);
  ok(JSON.stringify(list.map((s) => s.category)) === JSON.stringify(["courses", "courses", "courses", "video", "podcasts", "podcasts", "podcasts"]),
    "S6: the category map stands whole — the AI Signal files under Podcasts (F-464-2)");
  const podOrder = list.filter((s) => s.category === "podcasts").map((s) => s.series);
  ok(JSON.stringify(podOrder) === JSON.stringify(["exorcist-files", "counsel-of-trent", "the-ai-signal"]),
    "S6: within Podcasts the order is fixed registry order with the AI Signal last");
  const exfIdx = list.find((s) => s.series === "exorcist-files");
  ok(exfIdx.kind === "rss" && exfIdx.available === true && exfIdx.listenedCount === 0 && exfIdx.total === 50 && exfIdx.latestLabel === "Nov 13, 2026" && exfIdx.showImageUrl === "https://img.example/exf-show.jpg",
    "S6: the rss index entry carries kind, counts, latestLabel, and the channel art");
  const AUDIO_KEYS = JSON.stringify(["available", "category", "currentKey", "currentLabel", "listenedCount", "series", "showDesc", "showImageUrl", "title", "total"]);
  ok(list.slice(0, 3).every((s) => JSON.stringify(Object.keys(s).sort()) === AUDIO_KEYS && !("kind" in s)),
    "Regression: the audio index entries' shape is the base's field set plus the ONE additive category field, no kind field");
  const audP = await req("GET", "/api/player/podcasts?series=catechism-in-a-year");
  ok(JSON.stringify(Object.keys(audP.body).sort()) === JSON.stringify(["available", "builtAt", "collapses", "currentKey", "entries", "listenedCount", "ok", "series", "showDesc", "showImageUrl", "stale", "title", "total"]),
    "Regression: the audio series payload's shape is byte-identical to the base's (key set)");
  const vidP = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(JSON.stringify(Object.keys(vidP.body).sort()) === JSON.stringify(["available", "builtAt", "kind", "ok", "series", "stale", "title", "videos"]),
    "Regression: the video series payload's shape is byte-identical to the base's (key set)");
  const ownP = await req("GET", "/api/player/podcasts?series=the-ai-signal");
  ok(JSON.stringify(Object.keys(ownP.body).sort()) === JSON.stringify(["available", "currentKey", "currentLabel", "entries", "kind", "ok", "series", "showDesc", "showImageUrl", "title"]),
    "Regression: the own series payload's shape is byte-identical to the base's (key set)");

  // ---------- S4: marks + positions on the standing stores -------
  const m1 = await req("POST", "/api/player/podcasts/mark", { series: "exorcist-files", seqKey: "exf-guid-002", source: "manual" });
  ok(m1.status === 200, "S4: a hand mark on an RSS GUID answers ok");
  const exfM = await req("GET", "/api/player/podcasts?series=exorcist-files");
  const e2 = exfM.body.entries.find((e) => e.key === "exf-guid-002");
  ok(e2.listened === true && e2.listenDate === chicagoToday() && exfM.body.listenedCount === 1 && exfM.body.currentKey === "exf-guid-001",
    "S4: the mark shows in the payload (listened, Chicago listenDate, count) and current NEVER moves off the latest episode");
  const pos1 = await req("POST", "/api/player/podcasts/position", { series: "exorcist-files", seqKey: "exf-guid-003", positionS: 999999, durationS: 999999 });
  const posRow = d1q("SELECT position_s FROM podcast_positions WHERE series='exorcist-files' AND seq_key='exf-guid-003'");
  ok(pos1.status === 200 && posRow.length === 1 && posRow[0].position_s === 3600,
    "S4: a position save clamps to the SNAPSHOT entry's own durationS (3600), asserted in D1");
  const exfPos = await req("GET", "/api/player/podcasts?series=exorcist-files");
  ok(exfPos.body.entries.find((e) => e.key === "exf-guid-003").positionS === 3600,
    "S4: the saved position surfaces in the payload for the unlistened entry");
  await req("POST", "/api/player/podcasts/position", { series: "exorcist-files", seqKey: "exf-guid-004", positionS: 120, durationS: 3600 });
  await req("POST", "/api/player/podcasts/mark", { series: "exorcist-files", seqKey: "exf-guid-004", source: "auto" });
  ok(d1q("SELECT seq_key FROM podcast_positions WHERE series='exorcist-files' AND seq_key='exf-guid-004'").length === 0
    && d1q("SELECT seq_key FROM podcast_listens WHERE series='exorcist-files' AND seq_key='exf-guid-004'").length === 1,
    "S4: the mark route clears the episode's position row in the same act (the standing D5 clearing)");
  const posOnListened = await req("POST", "/api/player/podcasts/position", { series: "exorcist-files", seqKey: "exf-guid-004", positionS: 55, durationS: 3600 });
  ok(posOnListened.status === 200 && d1q("SELECT seq_key FROM podcast_positions WHERE series='exorcist-files' AND seq_key='exf-guid-004'").length === 0,
    "S4: a position save on a LISTENED episode is the standing no-op ok — nothing is stored");
  await req("POST", "/api/player/podcasts/unmark", { series: "exorcist-files", seqKey: "exf-guid-004" });
  await req("POST", "/api/player/podcasts/unmark", { series: "exorcist-files", seqKey: "exf-guid-002" });
  ok(d1q("SELECT seq_key FROM podcast_listens WHERE series='exorcist-files'").length === 0,
    "S4: unmark wipes the listen rows whole (asserted in D1)");

  // ---------- S4b: the window shift -------------------------------
  await req("POST", "/api/player/podcasts/mark", { series: "exorcist-files", seqKey: "exf-guid-010", source: "manual" });
  await req("POST", "/api/player/podcasts/mark", { series: "exorcist-files", seqKey: "exf-guid-049", source: "manual" });
  exfMode = "ok2";
  ageRssSnapshot("exorcist-files");
  const exfShift = await req("GET", "/api/player/podcasts?series=exorcist-files");
  const sh = exfShift.body.entries || [];
  ok(sh.length === 50 && sh[0].key === "exf-guid-new1" && !sh.some((e) => e.key === "exf-guid-049"),
    "S4b: the shifted feed rebuilds the window — five new episodes stand at the head and exf-guid-049 has fallen out");
  ok(sh.find((e) => e.key === "exf-guid-010").listened === true && exfShift.body.listenedCount === 1,
    "S4b: the mark on a GUID that remains in the window still stands (GUID-keyed, not position-keyed)");
  ok(d1q("SELECT seq_key FROM podcast_listens WHERE series='exorcist-files' AND seq_key='exf-guid-049'").length === 1,
    "S4b: the fallen-off GUID's listen row stands harmless in D1");
  const unm49 = await req("POST", "/api/player/podcasts/unmark", { series: "exorcist-files", seqKey: "exf-guid-049" });
  ok(unm49.status === 200 && d1q("SELECT seq_key FROM podcast_listens WHERE series='exorcist-files' AND seq_key='exf-guid-049'").length === 0,
    "S4b: the fallen-off GUID's unmark still lands (unmark validates no snapshot)");
  exfMode = "ok";

  // ---------- S5: route validation + the door mirror -------------
  ok((await req("POST", "/api/player/podcasts/mark", { series: "bogus", seqKey: "exf-guid-002", source: "manual" })).status === 400,
    "S5: a mark with an unknown series answers 400");
  ok((await req("POST", "/api/player/podcasts/mark", { series: "exorcist-files", seqKey: "exf-guid-999", source: "manual" })).status === 400,
    "S5: a mark with a seqKey outside the series' snapshot answers 400");
  ok((await req("POST", "/api/player/podcasts/mark", { series: "counsel-of-trent", seqKey: "exf-guid-002", source: "manual" })).status === 400,
    "S5: a mark validates the seqKey against THAT series' snapshot (an Exorcist GUID is unknown to Counsel)");
  ok((await req("POST", "/api/player/podcasts/mark", { series: "exorcist-files", seqKey: "exf-guid-002", source: "seed" })).status === 400,
    "S5: the source whitelist stands (seed never passes the mark route)");
  ok((await req("POST", "/api/player/podcasts/position", { series: "exorcist-files", seqKey: "nope", positionS: 5, durationS: 5 })).status === 400,
    "S5: a position with an unknown seqKey answers 400");
  ok((await req("GET", "/api/player/podcasts?series=bogus")).status === 400,
    "S5: an unknown ?series answers 400, exactly as the base");
  const doorExf = await door("?series=exorcist-files");
  ok(doorExf.status === 200 && doorExf.body.kind === "rss"
    && JSON.stringify((doorExf.body.entries || []).map((e) => e.key)) === JSON.stringify(sh.map((e) => e.key)),
    "S5: the door progress read mirrors the RSS series payload (same builder, same entry keys)");
  const doorIdx = await door("");
  ok(doorIdx.status === 200 && (doorIdx.body.seriesList || []).length === 7,
    "S5: the door index mirrors the session index (seven series)");
  ok((await door("?series=bogus")).status === 400, "S5: the door read answers 400 on an unknown series, as the session read does");

  // ---------- C1–C6: the client in Chromium ----------------------
  // State at this point: the Exorcist window is the SHIFTED one
  // (entries[0] = exf-guid-new1, "New Episode 1", Nov 19 2026);
  // the standing mark is exf-guid-010 (listenedCount 1); the
  // Counsel window is its original 50 (listenedCount 0).
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  let dayInFlight = 0;
  page.on("request", (r) => { if (r.url().includes("/api/player/day")) dayInFlight++; });
  page.on("response", (r) => { if (r.url().includes("/api/player/day")) dayInFlight--; });
  page.on("requestfailed", (r) => { if (r.url().includes("/api/player/day")) dayInFlight--; });
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await page.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.includes("/ep-new1.mp3")) return route.fulfill({ status: 200, contentType: "audio/wav", body: wavBuffer(2) });
    if (u.includes("feeds.soundcloud.com/stream/2999-")) return route.fulfill({ status: 200, contentType: "audio/wav", body: wavBuffer(30) });
    if (u.endsWith(".mp3")) return route.fulfill({ status: 200, contentType: "audio/wav", body: wavBuffer(60) });
    if (/ytimg|img\.example|sndcdn/.test(u)) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (u.includes("orapronobis.media")) {
      if (u.includes("/externals/feeds/")) return route.fulfill({ status: 200, contentType: "application/rss+xml", body: `<?xml version="1.0"?><rss version="2.0"><channel><title>Ext</title></channel></rss>` });
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    }
    return route.continue();
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-tab]", { timeout: 20000 });
  const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel);
  // The boot's day fetch paints the Prayers home into #view
  // whenever it lands (the standing v353 fetch-path paint);
  // in this environment the day build is slow and can land
  // in more than one wave, so every fresh load waits for the
  // paint (#play-all stands only on the painted home) AND
  // for the day endpoint to stand quiet before navigating —
  // otherwise a late paint stomps the series page mid-leg.
  const tapPodTab = async () => {
    await page.waitForSelector("#play-all", { timeout: 30000 });
    let quiet = 0;
    while (quiet < 5) { if (dayInFlight <= 0) quiet++; else quiet = 0; await sleep(300); }
    await click('[data-tab="podcasts"]');
    await page.waitForSelector("[data-podseries]", { timeout: 20000 });
  };
  const cardKeys = () => page.evaluate(() => [...document.querySelectorAll("[data-podseries]")].map((b) => b.getAttribute("data-podseries")));
  const cardMeta = (k) => page.evaluate((kk) => { const b = document.querySelector(`[data-podseries="${kk}"]`); return b ? (b.querySelector(".meta") || {}).textContent || "" : null; }, k);

  // ---- C1: the toggle round-trip --------------------------------
  await tapPodTab();
  const pill = await page.evaluate(() => {
    const t = document.querySelector("#hdrrow2 #sidetoggle");
    if (!t) return null;
    return {
      sides: [...t.querySelectorAll("button")].map((b) => b.getAttribute("data-side")),
      labels: [...t.querySelectorAll("button")].map((b) => b.textContent),
      active: (t.querySelector("button.active") || {}).getAttribute ? t.querySelector("button.active").getAttribute("data-side") : null,
    };
  });
  ok(!!pill && JSON.stringify(pill.sides) === JSON.stringify(["courses", "podcasts", "video"]) && JSON.stringify(pill.labels) === JSON.stringify(["Courses", "Podcasts", "More"]),
    "C1: the Formation pill stands in header row 2 with three sides — Courses · Podcasts · More (the pill short label)");
  ok(pill.active === "courses", "C1: Courses is the default side on a first run");
  ok(JSON.stringify(await cardKeys()) === JSON.stringify(["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year"]),
    "C1: the Courses side paints exactly its category's three series");
  await click('#sidetoggle button[data-side="podcasts"]');
  await page.waitForFunction(() => document.querySelectorAll("[data-podseries]").length === 3, null, { timeout: 10000 });
  ok(JSON.stringify(await cardKeys()) === JSON.stringify(["exorcist-files", "counsel-of-trent", "the-ai-signal"]),
    "C1: the Podcasts side paints Exorcist, Counsel, and the AI Signal in registry order");
  ok((await cardMeta("exorcist-files")) === "1 of 50 listened \u00b7 Latest: Nov 19, 2026",
    `C1: the Exorcist card meta reads "<count> of <total> listened · Latest: <label>" (got "${await cardMeta("exorcist-files")}")`);
  ok((await cardMeta("counsel-of-trent")) === "0 of 50 listened \u00b7 Latest: Nov 13, 2026",
    "C1: the Counsel card meta reads in the same form");
  ok((await cardMeta("the-ai-signal")) === "This series is unavailable right now. Try again later.",
    "C1: the AI Signal card still carries its standing (own-kind) unavailable line on the Podcasts side");
  ok((await page.evaluate(() => localStorage.getItem("opn-tabside-podcasts-v464"))) === "podcasts",
    "C1: the standing side is stored under opn-tabside-podcasts-v464");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-tab]", { timeout: 20000 });
  await tapPodTab();
  const afterReload = await page.evaluate(() => {
    const t = document.querySelector("#sidetoggle");
    return t ? (t.querySelector("button.active") || {}).getAttribute("data-side") : null;
  });
  ok(afterReload === "podcasts" && (await cardKeys())[0] === "exorcist-files",
    "C1: the stored side survives a reload — Formation reopens on Podcasts");

  // ---- C4: the header menu's standing group ----------------------
  const openMenu = async () => { await click("#hdr-menu"); await page.waitForSelector(".anchmenu", { timeout: 10000 }); };
  const menuShape = () => page.evaluate(() => [...document.querySelectorAll(".anchmenu > *")].map((el) => ({
    head: el.classList.contains("menuhead"),
    label: (el.querySelector(".grow") || el).textContent,
    state: (el.querySelector("[data-menustate]") || {}).textContent || "",
  })));
  await openMenu();
  const mIdx = await menuShape();
  const grpStart = mIdx.map((r, i) => (r.head ? i : -1)).filter((i) => i >= 0).pop();
  const tail = mIdx.slice(grpStart + 1);
  const secAt = tail.findIndex((r) => ["Praylist", "Prayers", "Conscience", "Formation", "Sacred Art", "Settings"].includes(r.label));
  const grp = (secAt >= 0 ? tail.slice(0, secAt) : tail).map((r) => `${r.label}${r.state ? "|" + r.state : ""}`);
  ok(JSON.stringify(grp) === JSON.stringify(["The Exorcist Files", "The Counsel of Trent", "The AI Signal", "Courses|\u203a", "Video & more|\u203a"]),
    `C4: on the Podcasts side the standing group is that side's series in full, then the other two sides under FULL names (got ${JSON.stringify(grp)})`);
  ok(!mIdx.some((r) => r.label === "Catechism in a Year"), "C4: no other side's series stands in the standing group");
  await page.evaluate(() => { const rows = [...document.querySelectorAll(".anchmenu .menurow")]; const r = rows.find((x) => x.textContent.includes("Courses")); if (r) r.click(); });
  await page.waitForFunction(() => (document.querySelector("#sidetoggle button.active") || {}).getAttribute("data-side") === "courses", null, { timeout: 10000 });
  ok(JSON.stringify(await cardKeys()) === JSON.stringify(["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year"]),
    "C4: tapping the Courses side entry switches the side and repaints the index");
  await click('#sidetoggle button[data-side="podcasts"]');
  await page.waitForFunction(() => (document.querySelector("[data-podseries]") || {}).getAttribute("data-podseries") === "exorcist-files", null, { timeout: 15000 });

  // ---- C2: the RSS series page -----------------------------------
  await click('[data-podseries="exorcist-files"]');
  await page.waitForSelector("[data-podrow]", { timeout: 20000 });
  const pageShape = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-podrow]")];
    const head = (document.querySelector(".podpage-head .meta") || {}).textContent || "";
    return {
      count: rows.length,
      firstTitle: (rows[0].querySelector(".titlerow h3") || {}).textContent || "",
      firstMeta: (rows[0].querySelector(".meta") || {}).textContent || "",
      secondMeta: (rows[1].querySelector(".meta") || {}).textContent || "",
      head,
      markedIdx: rows.findIndex((r) => r.querySelector(".podmark") && r.querySelector(".podmark").classList.contains("on")),
      dlSpans: document.querySelectorAll("[data-poddlstate]").length,
    };
  });
  ok(pageShape.count === 50, `C2: the Exorcist page paints all fifty rows, no collapse (got ${pageShape.count})`);
  ok(pageShape.firstTitle === "New Episode 1" && pageShape.firstMeta.startsWith("Latest episode \u00b7 Nov 19, 2026"),
    `C2: rows stand newest-first; the current row's meta leads "Latest episode · " (got "${pageShape.firstMeta}")`);
  ok(pageShape.secondMeta.includes("Nov 18, 2026"), "C2: a non-current row's meta leads with its date label");
  ok(pageShape.head.includes("1 of 50 listened") && pageShape.head.includes("Latest: Nov 19, 2026"),
    `C2: the page head reads in the standing form — count + total duration + latest label (got "${pageShape.head}")`);
  ok(pageShape.markedIdx === 14, `C2: the standing GUID mark (exf-guid-010, window position 15 after the shift) paints its check (row index ${pageShape.markedIdx})`);
  ok(pageShape.dlSpans === 0, "C2: no download state stands anywhere on an RSS page (streaming only)");
  // The row menu for RSS: Share + the mark toggle, no Download.
  await page.evaluate(() => { const b = document.querySelectorAll("[data-podrow]")[2].querySelector("[data-podmenu]"); if (b) b.click(); });
  await page.waitForSelector(".anchmenu", { timeout: 10000 });
  const rowMenu = await page.evaluate(() => [...document.querySelectorAll(".anchmenu .menurow")].map((r) => r.textContent));
  ok(rowMenu.some((t) => t.includes("Share")) && rowMenu.some((t) => t.includes("Mark as listened")) && !rowMenu.some((t) => t.includes("Download")),
    `C2: the RSS row menu carries Share + the mark toggle and NO Download item (got ${JSON.stringify(rowMenu)})`);
  await page.evaluate(() => { const c = document.querySelector(".menucatcher"); if (c) c.click(); });
  // Play the newest episode; the player takes it with the §2.4 title.
  await page.evaluate(() => { const d = document.querySelectorAll("[data-podrow]")[0].querySelector("[data-podplay]"); if (d) d.click(); });
  await page.waitForFunction(() => window.state && state.current && state.current.title === "Nov 19, 2026: New Episode 1" && !document.getElementById("audio").paused, null, { timeout: 20000 });
  ok((await page.evaluate(() => state.current.title)) === "Nov 19, 2026: New Episode 1",
    "C2: a disc tap starts the queue; the player title is \"<date label>: <episode title>\"");
  // Play to the end (2s fixture media): the completion seam auto-marks.
  let autoRow = [];
  for (let i = 0; i < 40 && !autoRow.length; i++) { autoRow = d1q("SELECT source FROM podcast_listens WHERE series='exorcist-files' AND seq_key='exf-guid-new1'"); if (!autoRow.length) await sleep(500); }
  ok(autoRow.length === 1 && autoRow[0].source === "auto", "C2: playing the episode to its end auto-marks it (source auto) in the standing store");
  const exfAfter = await req("GET", "/api/player/podcasts?series=exorcist-files");
  ok(exfAfter.body.currentKey === "exf-guid-new1" && exfAfter.body.listenedCount === 2,
    "C2: after the auto-mark the payload's current is STILL the latest episode (never mark-derived)");
  await page.evaluate(() => { const a = document.getElementById("audio"); if (a) a.pause(); });
  // Hand mark / unmark round-trip on row 3 (exf-guid-new3).
  const backToIndex = async () => { await click("[data-podback]"); await page.waitForSelector("[data-podseries]", { timeout: 20000 }); };
  await backToIndex();
  await click('[data-podseries="exorcist-files"]');
  await page.waitForSelector("[data-podrow]", { timeout: 20000 });
  await page.evaluate(() => { const m = document.querySelectorAll("[data-podrow]")[2].querySelector("[data-podmark]"); if (m) m.click(); });
  await page.waitForFunction(() => document.querySelectorAll("[data-podrow]")[2].querySelector(".podmark").classList.contains("on"), null, { timeout: 10000 });
  ok(d1q("SELECT source FROM podcast_listens WHERE series='exorcist-files' AND seq_key='exf-guid-new3'").length === 1,
    "C2: a hand tap on the row's check marks the episode in the store and the repainted row carries the check");
  await page.evaluate(() => { const m = document.querySelectorAll("[data-podrow]")[2].querySelector("[data-podmark]"); if (m) m.click(); });
  await page.waitForFunction(() => !document.querySelectorAll("[data-podrow]")[2].querySelector(".podmark").classList.contains("on"), null, { timeout: 10000 });
  ok(d1q("SELECT seq_key FROM podcast_listens WHERE series='exorcist-files' AND seq_key='exf-guid-new3'").length === 0,
    "C2: a second tap unmarks — the row and the store both clear");

  // ---- C4b: Here on the open series ------------------------------
  await openMenu();
  const mSeries = await menuShape();
  const hereRow = mSeries.find((r) => r.label === "The Exorcist Files");
  ok(!!hereRow && hereRow.state === "Here", "C4: the open series carries Here in the standing group");
  await page.evaluate(() => { const c = document.querySelector(".menucatcher"); if (c) c.click(); });

  // ---- C3: positions on the Counsel page --------------------------
  await backToIndex();
  await click('[data-podseries="counsel-of-trent"]');
  await page.waitForSelector("[data-podrow]", { timeout: 20000 });
  const ctHead = await page.evaluate(() => (document.querySelector(".podpage-head .meta") || {}).textContent || "");
  ok(ctHead.includes("0 of 50 listened") && ctHead.includes("Latest: Nov 13, 2026"),
    `C3: the Counsel page head reads in the standing form (got "${ctHead}")`);
  await page.evaluate(() => { const d = document.querySelectorAll("[data-podrow]")[0].querySelector("[data-podplay]"); if (d) d.click(); });
  await page.waitForFunction(() => window.state && state.current && state.current.title === "Nov 13, 2026: #1226: FFAF: Answering Protestant Objections" && !document.getElementById("audio").paused, null, { timeout: 20000 });
  ok((await page.evaluate(() => state.current.title)) === "Nov 13, 2026: #1226: FFAF: Answering Protestant Objections",
    "C3: the Counsel queue starts with the same title form");
  await page.waitForFunction(() => document.getElementById("audio").currentTime >= 6, null, { timeout: 20000 });
  await page.evaluate(() => { document.getElementById("audio").pause(); });
  let posSaved = [];
  for (let i = 0; i < 20 && !posSaved.length; i++) { posSaved = d1q("SELECT position_s FROM podcast_positions WHERE series='counsel-of-trent' AND seq_key='tag:soundcloud,2010:tracks/2999'"); if (!posSaved.length) await sleep(500); }
  ok(posSaved.length === 1 && posSaved[0].position_s >= 5,
    `C3: a pause mid-episode saves the position to the server store under the feed GUID (got ${JSON.stringify(posSaved)})`);
  await backToIndex();
  await click('[data-podseries="counsel-of-trent"]');
  await page.waitForSelector("[data-podrow]", { timeout: 20000 });
  ok(await page.evaluate(() => !!document.querySelectorAll("[data-podrow]")[0].querySelector(".podbar")),
    "C3: reopening the page, the partway row carries its progress bar");
  await page.evaluate(() => { const d = document.querySelectorAll("[data-podrow]")[0].querySelector("[data-podplay]"); if (d) d.click(); });
  let resumed = false;
  // Settle window = the C3 block's own 20s discipline (leg-87 investigation, 2026-11-16): the assertion
  // rides the loadedmetadata seek chain, whose latency is the environment's; a 3s budget measured that
  // latency, not the resume value — every sibling media wait in this harness stands at 20s.
  try { await page.waitForFunction(() => document.getElementById("audio").currentTime >= 4.5, null, { timeout: 20000 }); resumed = true; } catch { resumed = false; }
  ok(resumed, "C3: resuming the episode starts at the saved second (the position rides the payload into the descriptor)");
  await page.evaluate(() => { const a = document.getElementById("audio"); if (a) a.pause(); });

  // ---- C5: the unavailable state ---------------------------------
  ctMode = "fail";
  d1run("DELETE FROM rss_snapshots WHERE series='counsel-of-trent'");
  await backToIndex();
  ok((await cardMeta("counsel-of-trent")) === "This series is unavailable right now. Try again later.",
    "C5: with the feed down and no snapshot, the Counsel card carries the unavailable line");
  ok(((await cardMeta("exorcist-files")) || "").includes("listened"), "C5: the Exorcist card is unaffected by the Counsel outage");
  await click('[data-podseries="counsel-of-trent"]');
  await page.waitForSelector(".card", { timeout: 20000 });
  const unavail = await page.evaluate(() => document.body.textContent.includes("This series is unavailable right now. Try again later."));
  ok(unavail, "C5: the unavailable series page carries the standing unavailable card");
  ctMode = "ok";

  // ---- C6: the width legs -----------------------------------------
  for (const w of [360, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-tab]", { timeout: 20000 });
    await tapPodTab();
    const geo = await page.evaluate(() => {
      const row = document.getElementById("hdrrow2");
      const pillEl = document.getElementById("sidetoggle");
      const rr = row.getBoundingClientRect(), pr = pillEl.getBoundingClientRect();
      return { scrollW: row.scrollWidth, clientW: row.clientWidth, pillIn: pr.left >= rr.left - 1 && pr.right <= rr.right + 1 };
    });
    ok(geo.scrollW <= geo.clientW + 1 && geo.pillIn,
      `C6: at ${w}px header row 2 does not overflow and the pill stands fully inside the row (scroll ${geo.scrollW} vs client ${geo.clientW})`);
  }
  await ctx.close();
} catch (e) {
  fails++;
  console.log("not ok - harness error: " + (e && e.message ? e.message : String(e)));
} finally {
  try { if (browser) await browser.close(); } catch { /* already down */ }
  feedServer.close();
  for (const p of procs) { try { process.kill(-p.pid, "SIGKILL"); } catch { /* already gone */ } }
  await sleep(1000);
  try { execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stands */ }
  try { execFileSync("fuser", ["-k", `${FEEDPORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stands */ }
  fs.rmSync(PERSIST, { recursive: true, force: true });
  fs.rmSync(TMPD, { recursive: true, force: true });
}
console.log(`# harness-v464: ${n - fails}/${n} ok`);
process.exit(fails ? 1 : 0);
