#!/usr/bin/env node
// harness-v434 — the v434 gate (Plan §2.8): PODCASTS VIDEO SERIES
// — CatholicTV on YouTube. Server legs on the estate wrangler
// mold (LOCAL_DEV): the Atom fixture is served through the
// EXT_YT_CATHOLICTV_FEED_URL env seam by this harness itself
// (fetch-counted, mode-switched), the three audio series ride
// their own standing seams with small RSS fixtures, and
// migration 0023's sibling snapshot store is asserted directly
// in D1. Client legs run the real client in Chromium: the
// YouTube embed and the IFrame API are route-stubbed (the API
// stub captures the events object the client registers, so
// C5's error half is proven at the handler level through the
// client's own registration — F-434-I6's named form). The
// client context blocks service workers: the app's SW fetch
// handler re-fetches cross-origin subresources itself, beyond
// page.route's reach, and the mold's proxy refuses them — the
// SW's own behavior is harness-v429's gate, not this one's.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v434 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8996;
const FEEDPORT = 8997;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v434");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v434-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the YouTube Atom fixture (F-434-I2's faithful shape: the
// feed's documented spelling — yt:videoId, media:group with
// media:thumbnail + media:description, link rel="alternate",
// published — namespaces declared as the live feed declares
// them). Five videos, served OUT of order to prove the sort;
// one entry carries no yt:videoId (skipped); video B carries two
// thumbnails (the largest wins) and a Chicago-crossing published
// instant (Nov 15 04:30 UTC = Nov 14 in Chicago). --------------
const YT_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<link rel="self" href="https://www.youtube.com/feeds/videos.xml?channel_id=UCORAZZmab8apqy2TMHZlZVQ"/>
<id>yt:channel:UCORAZZmab8apqy2TMHZlZVQ</id>
<yt:channelId>UCORAZZmab8apqy2TMHZlZVQ</yt:channelId>
<title>CatholicTV</title>
<link rel="alternate" href="https://www.youtube.com/@catholictv"/>`;
function ytEntry(id, title, published, desc, extraThumbs = "") {
  return `<entry>
<id>yt:video:${id}</id>
<yt:videoId>${id}</yt:videoId>
<yt:channelId>UCORAZZmab8apqy2TMHZlZVQ</yt:channelId>
<title>${title}</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/>
<author><name>CatholicTV</name><uri>https://www.youtube.com/@catholictv</uri></author>
<published>${published}</published>
<updated>${published}</updated>
<media:group>
<media:title>${title}</media:title>
<media:content url="https://www.youtube.com/v/${id}?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
${extraThumbs}<media:thumbnail url="https://i.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/>
<media:description>${desc}</media:description>
</media:group>
</entry>`;
}
const YT_GHOST = `<entry>
<id>yt:video:ghostentry</id>
<yt:channelId>UCORAZZmab8apqy2TMHZlZVQ</yt:channelId>
<title>Ghost Entry Without A Video Id</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=ghostentry"/>
<published>2026-11-15T15:00:00+00:00</published>
</entry>`;
const ytXml = (entries) => YT_HEAD + "\n" + entries.join("\n") + "\n</feed>";
const YT_OK = ytXml([
  ytEntry("vidBravo22", "La Santa Misa | Domingo 33 del Tiempo Ordinario", "2026-11-15T04:30:00+00:00", "La Santa Misa en espa\u00f1ol.", '<media:thumbnail url="https://i.ytimg.com/vi/vidBravo22/default.jpg" width="120" height="90"/>\n'),
  ytEntry("vidAlpha111", "Catholic Mass Today | November 15, 2026 | CatholicTV Daily Mass", "2026-11-15T14:00:00+00:00", "Join us for daily Mass &amp; prayer."),
  YT_GHOST,
  ytEntry("vidCharl333", "Live Adoration of the Blessed Sacrament From the CatholicTV Chapel", "2026-11-13T18:00:00+00:00", "Adoration from the chapel."),
  ytEntry("vidDelta444", "CatholicTV News", "2026-11-12T15:00:00+00:00", "The week\u2019s news."),
  ytEntry("vidEcho5555", "The Rosary | Joyful Mysteries", "2026-11-11T15:00:00+00:00", "Pray the Rosary."),
]);
const YT_OK2 = ytXml([
  ytEntry("vidFoxtrot6", "Catholic Mass Today | November 16, 2026 | CatholicTV Daily Mass", "2026-11-15T16:00:00+00:00", "Monday\u2019s Mass, posted early."),
  ytEntry("vidAlpha111", "Catholic Mass Today | November 15, 2026 | CatholicTV Daily Mass", "2026-11-15T14:00:00+00:00", "Join us for daily Mass &amp; prayer."),
  ytEntry("vidBravo22", "La Santa Misa | Domingo 33 del Tiempo Ordinario", "2026-11-15T04:30:00+00:00", "La Santa Misa en espa\u00f1ol."),
]);

// ---- the audio RSS fixtures (small, standing shape) -----------
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

let ytMode = "ok";
let ytFetches = 0;
const feedServer = http.createServer((rq, rs) => {
  const u = rq.url || "";
  if (u.startsWith("/yt.xml")) {
    ytFetches++;
    if (ytMode === "fail404") { rs.writeHead(404); rs.end("no"); return; }
    if (ytMode === "fail500") { rs.writeHead(500); rs.end("no"); return; }
    rs.writeHead(200, { "content-type": "application/atom+xml" });
    if (ytMode === "garbage") { rs.end("this is not a feed at all"); return; }
    if (ytMode === "empty") { rs.end(ytXml([])); return; }
    rs.end(ytMode === "ok2" ? YT_OK2 : YT_OK);
    return;
  }
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
const ageSnapshot = () => {
  // The staleness read parses builtAt out of the PAYLOAD (the
  // podReadSnapshot discipline), so aging ages both the column
  // and the payload field — exactly the pair the Worker stamps.
  const old = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const rows = d1q("SELECT payload FROM video_snapshots WHERE series='catholictv'");
  if (!rows.length) return;
  const p = JSON.parse(rows[0].payload);
  p.builtAt = old;
  d1run(`UPDATE video_snapshots SET built_at='${old}', payload='${JSON.stringify(p).replace(/'/g, "''")}' WHERE series='catholictv'`);
};

// ---- statics (V0 + the §2 constants) ---------------------------
function statics() {
  ok(fs.existsSync(path.join(APP, "migrations/0023_video_snapshots.sql")), "S: migration 0023 stands in the tree");
  const mig = fs.readFileSync(path.join(APP, "migrations/0023_video_snapshots.sql"), "utf8");
  ok(mig.includes("CREATE TABLE IF NOT EXISTS video_snapshots") && mig.includes("series TEXT PRIMARY KEY") && mig.includes("payload TEXT NOT NULL") && mig.includes("built_at TEXT NOT NULL"),
    "S: 0023 creates video_snapshots (series PK, payload, built_at) mirroring podcast_sequences");
  ok(INDEX.includes('const YT_CATHOLICTV_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCORAZZmab8apqy2TMHZlZVQ"'),
    "S: the channel feed URL stands as ONE pinned constant (channel UCORAZZmab8apqy2TMHZlZVQ)");
  ok(INDEX.includes("const VIDEO_SNAPSHOT_MAX_AGE_MS = 2 * 3600 * 1000") && INDEX.includes("const POD_SNAPSHOT_MAX_AGE_MS = 24 * 3600 * 1000"),
    "S: the video staleness bound is its own 2h constant; the audio 24h bound stands untouched");
  ok(INDEX.includes("POD_VIDEO_SERIES_LIST") && INDEX.includes("function ytParseFeed") && INDEX.includes('key: "catholictv"'),
    "S: the sibling video registry, the Atom parser, and the catholictv def stand");
  ok(!/Content-Security-Policy|X-Frame-Options|frame-ancestors|frame-src/.test(INDEX) && !/Content-Security-Policy|X-Frame-Options|frame-ancestors|frame-src/.test(UI),
    "V0 (static): no CSP frame-src/frame-ancestors and no X-Frame-Options stands in the Worker's served-document path");
  ok(CLIENT.includes("function paintPodcastVideos") && CLIENT.includes("function closeWatch") && CLIENT.includes("function podWatchOnError"),
    "S: the client carries the video page, the watch teardown act, and the refusal handler");
  ok(CLIENT.includes("podwatch-frame") && CLIENT.includes("closeWatch(); // v434"),
    "S: the watch frame's class stands in the client, and closeWatch rides the tab switch, the audio choke point, the sheet open, and the series re-entry");
}

// ---- a tiny playable WAV (2 s of silence, 8 kHz 16-bit mono) --
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
  ok(d1q("SELECT name FROM sqlite_master WHERE type='table' AND name='video_snapshots'").length === 1,
    "migration 0023 applies clean — video_snapshots stands");
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV)");

  // ---------- V0 (dynamic): the served document's headers ------
  const docRes = await fetch(BASE + "/");
  ok(docRes.status === 200 && !docRes.headers.get("content-security-policy") && !docRes.headers.get("x-frame-options"),
    "V0: the served app document carries no CSP and no X-Frame-Options — a youtube.com embed is not blocked by the app's own headers");

  // ---------- V1 + V2: cold build, parse, snapshot serve -------
  ytMode = "ok";
  const f0 = ytFetches;
  const p1 = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(p1.status === 200 && p1.body.kind === "video" && p1.body.available === true && p1.body.stale === false,
    "V1/V2: a cold read builds the snapshot and serves the video payload (kind video, available, not stale)");
  ok(ytFetches - f0 === 1, `V2: the cold build fetched the feed exactly once (${ytFetches - f0})`);
  const vids = p1.body.videos || [];
  ok(vids.length === 5, `V1: the parse yields exactly the 5 identified entries — the entry without a yt:videoId is skipped (${vids.length})`);
  ok(JSON.stringify(vids.map((v) => v.id)) === JSON.stringify(["vidAlpha111", "vidBravo22", "vidCharl333", "vidDelta444", "vidEcho5555"]),
    "V1: the videos stand newest-first by publishedMs, regardless of the served order");
  const vA = vids[0], vB = vids[1];
  ok(vA.title === "Catholic Mass Today | November 15, 2026 | CatholicTV Daily Mass" && vA.url === "https://www.youtube.com/watch?v=vidAlpha111"
    && vA.imageUrl === "https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg" && vA.publishedMs === Date.parse("2026-11-15T14:00:00+00:00"),
    "V1: id, title, the rel=alternate watch URL, the thumbnail, and publishedMs parse exactly");
  ok(vB.imageUrl === "https://i.ytimg.com/vi/vidBravo22/hqdefault.jpg",
    "V1: the LARGEST media:thumbnail the group carries wins (480 over 120)");
  ok(vA.descText === "Join us for daily Mass & prayer.",
    "V1: media:description rides the standing extStripDesc discipline (entities decoded, whitespace collapsed, 240-char cap)");
  ok(vA.dateLabel === "Nov 15, 2026" && vB.dateLabel === "Nov 14, 2026" && vids[2].dateLabel === "Nov 13, 2026",
    "V1/§2.5: dateLabel renders the published instant in America/Chicago — Nov 15 04:30 UTC is Nov 14 in Chicago, never the UTC date");
  const snapRow = d1q("SELECT series, built_at FROM video_snapshots");
  ok(snapRow.length === 1 && snapRow[0].series === "catholictv",
    "V2: the snapshot stands stored in migration 0023's table under the series key");
  const p2 = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(ytFetches - f0 === 1 && JSON.stringify(p2.body.videos) === JSON.stringify(vids),
    "V2: a second read inside the 2h bound serves the snapshot with ZERO further fetches");

  // ---------- V5: the index seat --------------------------------
  const idx = await req("GET", "/api/player/podcasts");
  const list = idx.body.seriesList || [];
  ok(list.length === 4 && JSON.stringify(list.map((s) => s.series)) === JSON.stringify(["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year", "catholictv"]),
    "V5: the index lists four series — the three audio in registry order, CatholicTV fourth and last");
  const AUDIO_KEYS = JSON.stringify(["available", "currentKey", "currentLabel", "listenedCount", "series", "showDesc", "showImageUrl", "title", "total"]);
  ok(list.slice(0, 3).every((s) => JSON.stringify(Object.keys(s).sort()) === AUDIO_KEYS && !("kind" in s)),
    "V5/F-434-I4: the audio entries' shape is byte-identical to the base's — the standing field set, no kind field (the video entry alone carries kind)");
  const ciy = list[0];
  ok(ciy.available === true && ciy.listenedCount === 0 && ciy.total === 3 && ciy.currentKey === "ciy:day-1" && ciy.currentLabel === "Day 1" && ciy.showImageUrl === "https://img.example/ciy-show.jpg",
    "V5: the audio entries' values stand as the base derives them from the same fixtures (counts, current, show art)");
  const vent = list[3];
  ok(vent.kind === "video" && vent.available === true && vent.latestLabel === "Nov 15, 2026" && vent.showImageUrl === "https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg" && !("listenedCount" in vent) && !("currentKey" in vent),
    "V5: the video entry carries kind video, latestLabel in §2.5's form, the newest thumbnail as its art — and no audio facts");

  // ---------- V6: the series payload's shape --------------------
  ok(!("entries" in p1.body) && !("currentKey" in p1.body) && !("listenedCount" in p1.body) && !("total" in p1.body) && !("collapses" in p1.body),
    "V6: the video payload carries NO audio fields — no entries, no currentKey, no listens, no totals; no client branch can paint them");
  const unk = await req("GET", "/api/player/podcasts?series=bogus");
  ok(unk.status === 400, "V6: an unknown series key behaves exactly as the base (400)");
  const aud = await req("GET", "/api/player/podcasts?series=catechism-in-a-year");
  ok(aud.status === 200 && Array.isArray(aud.body.entries) && aud.body.entries.length === 3 && aud.body.currentKey === "ciy:day-1",
    "V6: an audio series payload stands in its standing shape beside the video route");

  // ---------- V3: staleness rebuilds on read --------------------
  ytMode = "ok2";
  ageSnapshot();
  const f3 = ytFetches;
  const p3 = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(ytFetches - f3 === 1 && p3.body.videos[0].id === "vidFoxtrot6" && p3.body.videos.length === 3 && p3.body.stale === false,
    "V3: a snapshot older than 2h rebuilds on read and serves the NEW list");
  const freshRow = d1q("SELECT built_at FROM video_snapshots WHERE series='catholictv'");
  ok(freshRow.length === 1 && Date.now() - Date.parse(freshRow[0].built_at) < 120000,
    "V3: the rebuild re-stamps the snapshot's built_at");

  // ---------- V4: a failed rebuild serves the standing list -----
  const standingIds = JSON.stringify(p3.body.videos.map((v) => v.id));
  for (const mode of ["fail404", "fail500", "garbage"]) {
    ytMode = mode;
    ageSnapshot();
    const pm = await req("GET", "/api/player/podcasts?series=catholictv");
    ok(pm.body.available === true && pm.body.stale === true && JSON.stringify((pm.body.videos || []).map((v) => v.id)) === standingIds,
      `V4: feed mode ${mode} with a standing snapshot — the standing list is served with stale: true, never emptied`);
  }
  d1run("DELETE FROM video_snapshots");
  ytMode = "fail404";
  const pNone = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(pNone.body.available === false && (pNone.body.videos || []).length === 0,
    "V4: no snapshot and the feed down — available: false, the series' unavailable surface");
  ytMode = "empty";
  const pEmpty = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(pEmpty.body.available === false,
    "V4/V1: a zero-entry document is a FAILED rebuild (the parse throws), never an emptied list — still unavailable with no snapshot");
  ytMode = "ok";
  const pRec = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(pRec.body.available === true && pRec.body.videos.length === 5,
    "V4: the next good read recovers the series");

  // ---------- client legs (Chromium, the real client) -----------
  ytMode = "ok";
  // Rebuild the snapshot to the ok set for the surfaces.
  d1run("DELETE FROM video_snapshots");
  await req("GET", "/api/player/podcasts?series=catholictv");
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 560 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const YT_API_STUB = `window.YT = { Player: function (el, cfg) { window.__ytEvents = cfg && cfg.events; window.__ytEl = el; } };\nif (typeof window.onYouTubeIframeAPIReady === "function") window.onYouTubeIframeAPIReady();`;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === "https://www.youtube.com/iframe_api") { await route.fulfill({ status: 200, contentType: "application/javascript", body: YT_API_STUB }); return; }
    if (url.startsWith("https://www.youtube.com/embed/")) { await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>embed stub</body></html>" }); return; }
    if (url === "https://orapronobis.media/podcast.xml" || url === "https://orapronobis.media/intentions.xml") {
      await route.fulfill({ status: 200, contentType: "application/rss+xml", body: `<?xml version="1.0"?><rss version="2.0"><channel><title>f</title></channel></rss>` }); return;
    }
    if (/\.mp3($|\?)/.test(url)) { await route.fulfill({ status: 200, contentType: "audio/wav", body: wavBuffer(2) }); return; }
    // Image hosts (YouTube thumbnails, the fixtures' art): the
    // mold's proxy refuses them, and a failed <img> self-removes
    // (the app's standing pattern) — racing the row assertions
    // and churning the layout under the navigation clicks. A 1px
    // PNG stands in, as the real hosts do in production.
    if (url.startsWith("https://i.ytimg.com/") || url.startsWith("https://img.example/") || /\.(?:png|jpe?g|gif|webp)($|\?)/i.test(url)) {
      await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") }); return;
    }
    await route.continue();
  });
  // The navigation taps dispatch the app's own handlers
  // directly (the v427 mold form): Playwright's stability and
  // hit-test waits race the scroll-restore arms and sticky rows
  // on this loaded box, while every assertion below still reads
  // the app's real DOM outcomes.
  const tap = async (sel) => {
    await page.waitForSelector(sel, { timeout: 30000 });
    await page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error("tap: no element " + s); el.click(); }, sel);
  };
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.click('[data-tab="podcasts"]');
  await page.waitForSelector("[data-podseries]", { timeout: 30000 });

  // C1: the index paint.
  const cards = await page.evaluate(() => [...document.querySelectorAll("[data-podseries]")].map((c) => ({
    key: c.getAttribute("data-podseries"),
    title: c.querySelector("h3") ? c.querySelector("h3").textContent : "",
    meta: c.querySelector(".meta") ? c.querySelector(".meta").textContent : "",
    img: c.querySelector("img.rowart") ? c.querySelector("img.rowart").getAttribute("src") : null,
  })));
  ok(cards.length === 4 && cards[3].key === "catholictv" && cards[3].title === "CatholicTV",
    `C1: four cards stand, CatholicTV fourth (${JSON.stringify(cards.map((c) => c.key))})`);
  ok(cards[3].meta === "Video \u00b7 Latest: Nov 15, 2026" && cards[3].img === "https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg",
    `C1: the CatholicTV card shows §2.5's meta form and the newest thumbnail as its art (${JSON.stringify(cards[3].meta)})`);
  ok(cards[0].title === "Catechism in a Year" && cards[0].meta === "0 of 3 listened \u00b7 Current: Day 1",
    `C1: the audio cards paint in their standing form (${JSON.stringify(cards[0].meta)})`);

  // C6 (index half): the standing offline line stands unchanged.
  const idxLine = await page.evaluate(() => { const el = document.getElementById("offline-line-text"); const btn = document.getElementById("pod-offline-btn"); return { text: el ? el.textContent : null, btn: !!btn }; });
  ok(idxLine.btn && /^On this phone:/.test(idxLine.text || ""),
    "C6: the Podcasts index keeps its standing offline line and button, unchanged");

  // C2: the video page's rows.
  await tap('[data-podseries="catholictv"]');
  await page.waitForSelector("[data-podvideo]", { timeout: 30000 });
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-podvideo]")].map((c) => ({
    id: c.getAttribute("data-podvideo"),
    title: c.querySelector("h3") ? c.querySelector("h3").textContent : "",
    meta: c.querySelector(".meta") ? c.querySelector(".meta").textContent : "",
    img: c.querySelector("img.rowart") ? c.querySelector("img.rowart").getAttribute("src") : null,
  })));
  ok(rows.length === 5 && rows[0].id === "vidAlpha111" && rows[1].id === "vidBravo22" && rows[4].id === "vidEcho5555",
    "C2: the video page lists the rows newest-first");
  ok(rows[0].meta === "Nov 15, 2026" && rows[1].meta === "Nov 14, 2026" && rows.every((r) => r.img && r.img.startsWith("https://i.ytimg.com/vi/")),
    "C2: each row carries its date in the meta position and a thumbnail referenced from YouTube's hosts");
  const pageHeadMeta = await page.evaluate(() => { const h = document.querySelector(".podpage-head .meta"); return h ? h.textContent : ""; });
  ok(pageHeadMeta === "Video series \u00b7 Updated Nov 15, 2026",
    `C2: the page head's meta reads §2.5's form (${JSON.stringify(pageHeadMeta)})`);
  const videoSurfaceActs = await page.evaluate(() => ({
    marks: document.querySelectorAll("[data-podmark]").length,
    menus: document.querySelectorAll("[data-podmenu]").length,
    plays: document.querySelectorAll("[data-podplay]").length,
    dl: document.querySelectorAll("[data-poddlstate]").length,
    offlineBtn: !!document.getElementById("pod-offline-btn"),
    currentCard: (document.getElementById("view") || document.body).textContent.includes("Current episode"),
  }));
  ok(videoSurfaceActs.marks === 0 && videoSurfaceActs.menus === 0 && videoSurfaceActs.plays === 0 && videoSurfaceActs.dl === 0 && !videoSurfaceActs.offlineBtn && !videoSurfaceActs.currentCard,
    "C2/C6: no current-episode card, no marks, no \u22ee menu, no play cluster, no download cluster, no offline line stands on the video page");

  // C3: watch open + return at the standing place.
  await page.evaluate(() => window.scrollTo(0, 150));
  await sleep(200);
  const y0 = await page.evaluate(() => window.scrollY);
  ok(y0 > 0, `C3: the series page stands scrolled before the tap (scrollY ${y0})`);
  await tap('[data-podvideo="vidCharl333"]');
  await page.waitForSelector("iframe.podwatch-frame", { timeout: 15000 });
  const frameSrc = await page.evaluate(() => document.querySelector("iframe.podwatch-frame").getAttribute("src"));
  ok(frameSrc === "https://www.youtube.com/embed/vidCharl333?enablejsapi=1&autoplay=1&rel=0",
    `C3: a row tap opens the watch view — the iframe stands at youtube.com/embed/<id> with enablejsapi=1 (${frameSrc})`);
  await tap("[data-podwatchback]");
  await page.waitForSelector("[data-podvideo]", { timeout: 15000 });
  await sleep(400);
  const backState = await page.evaluate(() => ({ frames: document.querySelectorAll("iframe.podwatch-frame").length, y: window.scrollY }));
  ok(backState.frames === 0 && Math.abs(backState.y - y0) <= 2,
    `C3: back destroys the frame and returns to the series page at its standing place (scroll ${backState.y} vs ${y0})`);

  // C5: the refusal fallback (the API stub captured the client's
  // registered events — the error half runs at the handler level
  // through the client's own registration, F-434-I6). The
  // navigation clicks around the watch use force: right after a
  // closeWatch repaint + scroll restore, the sticky back row's
  // box keeps settling under the mold's load and Playwright's
  // stability check times out on a sound element — the acts
  // themselves are the app's own handlers either way.
  await tap('[data-podvideo="vidAlpha111"]');
  await page.waitForSelector("iframe.podwatch-frame", { timeout: 15000 });
  await page.waitForFunction(() => !!window.__ytEvents, null, { timeout: 15000 });
  const actBefore = await page.evaluate(() => { const a = [...document.querySelectorAll("a.btn")].filter((x) => x.textContent.includes("Open in YouTube"))[0]; return a ? a.getAttribute("href") : null; });
  ok(actBefore === "https://www.youtube.com/watch?v=vidAlpha111",
    "C5: the Open in YouTube act stands on a watch view with NO error, its href the video's watch URL");
  await page.evaluate(() => window.__ytEvents.onError({ data: 2 }));
  const afterTransient = await page.evaluate(() => !!document.querySelector("iframe.podwatch-frame"));
  ok(afterTransient, "C5: a transient error code (2) leaves the frame standing");
  await page.evaluate(() => window.__ytEvents.onError({ data: 150 }));
  const refusal = await page.evaluate(() => {
    const line = document.getElementById("podwatch-err");
    return { frames: document.querySelectorAll("iframe.podwatch-frame").length, text: line ? line.textContent : "", shown: line ? line.style.display !== "none" : false };
  });
  ok(refusal.frames === 0 && refusal.shown && refusal.text === "YouTube won\u2019t play this one inside the app \u2014 open it in YouTube instead.",
    `C5: error 150 empties the frame seat and stands the authored line (${JSON.stringify(refusal.text)})`);
  await tap("[data-podwatchback]");
  await page.waitForSelector("[data-podvideo]", { timeout: 15000 });

  // C4: the one-sound pair.
  await tap("[data-podback]");
  await page.waitForSelector("[data-podseries]", { timeout: 30000 });
  await tap('[data-podseries="catechism-in-a-year"]');
  await page.waitForSelector("[data-podplay]", { timeout: 30000 });
  await tap("[data-podplay]");
  await page.waitForFunction(() => { const a = document.getElementById("audio"); return a && !a.paused; }, null, { timeout: 20000 });
  ok(true, "C4: an audio episode stands playing (the forward direction's premise)");
  await page.evaluate(() => { const b = document.querySelector("[data-podback]"); if (b) b.click(); });
  await page.waitForSelector('[data-podseries="catholictv"]', { timeout: 30000 });
  await tap('[data-podseries="catholictv"]');
  await page.waitForSelector("[data-podvideo]", { timeout: 30000 });
  await tap('[data-podvideo="vidAlpha111"]');
  await page.waitForSelector("iframe.podwatch-frame", { timeout: 15000 });
  const silenced = await page.evaluate(() => { const a = document.getElementById("audio"); return a ? a.paused : null; });
  ok(silenced === true, "C4: opening a video silences the audio through the standing pause act — the element reads paused as the frame stands");
  await page.evaluate(() => {
    window.__iframeAtPlay = null;
    const a = document.getElementById("audio");
    const orig = a.play.bind(a);
    a.play = function () { window.__iframeAtPlay = !!document.querySelector("iframe.podwatch-frame"); return orig(); };
  });
  await tap("#dock-play");
  await page.waitForFunction(() => !document.querySelector("iframe.podwatch-frame"), null, { timeout: 15000 });
  const probe = await page.evaluate(() => window.__iframeAtPlay);
  ok(probe === false,
    "C4/F-434-I5: starting audio destroys the frame BEFORE audioEl.play() runs — at the play call, no frame stands (act-level proof)");
  // Tab switch: re-open a watch, then leave the tab.
  await page.waitForSelector("[data-podvideo]", { timeout: 15000 });
  await tap('[data-podvideo="vidBravo22"]');
  await page.waitForSelector("iframe.podwatch-frame", { timeout: 15000 });
  await page.click('[data-tab="prayers"]');
  await sleep(300);
  const afterTab = await page.evaluate(() => document.querySelectorAll("iframe.podwatch-frame").length);
  ok(afterTab === 0, "C4: a tab switch away from Podcasts destroys the frame — the video sounds only while its surface stands open");

  // V7: offline exclusion — the completeness pass's podcast set
  // is invariant to the video series' presence.
  await page.click('[data-tab="podcasts"]');
  // The tab return lands on the video SERIES page (the standing
  // return record's level) — the witness accepts either level;
  // the enumeration below reads the API, not the paint.
  await page.waitForFunction(() => !!document.querySelector("[data-podseries], [data-podvideo]"), null, { timeout: 30000 });
  const autoWith = await page.evaluate(() => offlinePodcastAutoSet().then((items) => JSON.stringify(items.map((i) => i.series + "/" + i.id).sort())));
  const autoParsed = JSON.parse(autoWith);
  ok(autoParsed.length === 6 && autoParsed.every((k) => !k.startsWith("catholictv/")),
    `V7: the offline automatic set holds only the audio series' items (current + next 2 per series) with the video series present (${autoParsed.length} items)`);
  await page.route("**/api/player/podcasts", async (route) => {
    const url = route.request().url();
    if (url.includes("?")) { await route.continue(); return; }
    const resp = await route.fetch();
    const body = await resp.json();
    body.seriesList = (body.seriesList || []).filter((s) => s.kind !== "video");
    await route.fulfill({ response: resp, json: body });
  });
  const autoWithout = await page.evaluate(() => offlinePodcastAutoSet().then((items) => JSON.stringify(items.map((i) => i.series + "/" + i.id).sort())));
  ok(autoWithout === autoWith,
    "V7: the offline pass's podcast set is byte-identical with the video series present and absent from the index");
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  try { feedServer.close(); } catch { /* noop */ }
  procs.forEach((p) => { try { process.kill(-p.pid, "SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch { /* noop */ } } });
}
console.log(`# harness-v434: ${n} ok / ${fails} not-ok`);
process.exit(fails ? 1 : 0);
