#!/usr/bin/env node
// harness-v500 — the v500 gate (doc §2): HOMILY PODCAST FEEDS —
// Sunday Homilies with Fr. Mike Schmitz (Ascension, Fireside)
// and Bishop Barron's Sunday Sermons (Word on Fire, Podbean)
// join Catechesis → Podcasts as registry series of the standing
// RSS kind (the v464 pattern: two defs in POD_RSS_SERIES_LIST,
// no migration, no client change). Server legs run on the
// estate wrangler mold (LOCAL_DEV, the v464 form): the two new
// series' feeds are served through the EXT_FRMIKE_HOMILIES_
// FEED_URL / EXT_BARRON_SERMONS_FEED_URL env seams from the
// REAL captured feeds (fixtures-v500 — the live feeds as
// captured 2026-11-17, Improvement D), and the standing series
// ride their standing small/synthetic fixtures from harness-
// v464 unchanged, so the standing payloads' shapes are proven
// against the same inputs the v464 gate used. Expectations for
// the new series are DERIVED from the captured feeds in this
// harness (first item's GUID/title/duration/pubDate, channel
// art) — never hand-typed from memory. Client legs run the
// real client in Chromium (service workers blocked).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v500 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8996;
const FEEDPORT = 8997;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v500");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v500-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const FIX = path.join(APP, "tests/fixtures-v500");
const FRMIKE_XML = fs.readFileSync(path.join(FIX, "feeds-frmike-2026-11-17.xml"), "utf8");
const BARRON_XML = fs.readFileSync(path.join(FIX, "feeds-barron-2026-11-17.xml"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const chiLabel = (ms) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }).format(new Date(ms));

// ---- expectations derived from the captured feeds -------------
function firstItem(xml) {
  const body = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/.exec(xml)[1];
  const g = /<guid\b[^>]*>([\s\S]*?)<\/guid>/.exec(body);
  const t = /<title>([\s\S]*?)<\/title>/.exec(body);
  const p = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(body);
  const d = /<[A-Za-z0-9_.-]*:?duration>([^<]*)</.exec(body);
  const enc = /<enclosure\b[^>]*?url="([^"]*)"/.exec(body);
  const durS = d ? (d[1].includes(":") ? d[1].split(":").reduce((a, x) => a * 60 + Number(x), 0) : Number(d[1])) : 0;
  return { guid: g ? g[1].trim() : null, title: t ? t[1].trim() : "", pubMs: Date.parse(p[1].trim()), durationS: durS, url: enc ? enc[1] : "" };
}
function channelImage(xml) {
  const head = xml.slice(0, xml.indexOf("<item"));
  const m = /<itunes:image[^>]*href="([^"]*)"/.exec(head) || /<image>[\s\S]*?<url>([^<]*)<\/url>/.exec(head);
  return m ? m[1] : null;
}
const FM = firstItem(FRMIKE_XML), BR = firstItem(BARRON_XML);
const FM_ART = channelImage(FRMIKE_XML), BR_ART = channelImage(BARRON_XML);
const FM_COUNT = (FRMIKE_XML.match(/<item[\s>]/g) || []).length;
const BR_COUNT = (BARRON_XML.match(/<item[\s>]/g) || []).length;

// ---- the standing fixtures (harness-v464's, unchanged) --------
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
for (let i = 1; i <= 60; i++) EXF_ITEMS.push(exfItem(i));
const EXF_OK = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>The Exorcist Files</title>`
  + `<itunes:image href="https://img.example/exf-show.jpg"/><description>Fr. Carlos Martins fixture show.</description>`
  + EXF_ITEMS.join("\n") + `</channel></rss>`;
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

let fmFetches = 0, brFetches = 0;
const feedServer = http.createServer((rq, rs) => {
  const u = rq.url || "";
  const send = (body, ct2) => { rs.writeHead(200, { "content-type": ct2 }); rs.end(body); };
  if (u.startsWith("/frmike.xml")) { fmFetches++; return send(FRMIKE_XML, "application/rss+xml"); }
  if (u.startsWith("/barron.xml")) { brFetches++; return send(BARRON_XML, "application/rss+xml"); }
  if (u.startsWith("/exf.xml")) return send(EXF_OK, "application/rss+xml");
  if (u.startsWith("/counsel.xml")) return send(CT_OK, "application/rss+xml");
  if (u.startsWith("/yt.xml")) return send(YT_XML, "application/atom+xml");
  if (u.startsWith("/ciy.xml")) return send(CIY_XML, "application/rss+xml");
  if (u.startsWith("/biy.xml")) return send(BIY_XML, "application/rss+xml");
  if (u.startsWith("/riy.xml")) return send(RIY_XML, "application/rss+xml");
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
    "--var", `EXT_FRMIKE_HOMILIES_FEED_URL:http://127.0.0.1:${FEEDPORT}/frmike.xml`,
    "--var", `EXT_BARRON_SERMONS_FEED_URL:http://127.0.0.1:${FEEDPORT}/barron.xml`,
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

// ---- statics ----------------------------------------------------
function statics() {
  ok(INDEX.includes('const RSS_FRMIKE_HOMILIES_FEED_URL = "https://feeds.fireside.fm/fathermikehomilies/rss"')
    && INDEX.includes('const RSS_BARRON_SERMONS_FEED_URL = "https://feed.podbean.com/wordonfire/feed.xml"'),
    "S: both homily feed URLs stand as pinned constants (the §2 proofs)");
  ok(INDEX.includes('{ key: "fr-mike-homilies", title: "Sunday Homilies with Fr. Mike Schmitz"')
    && INDEX.includes('{ key: "barron-sunday-sermons", title: "Bishop Barron\'s Sunday Sermons"'),
    "S: both series stand as defs in POD_RSS_SERIES_LIST");
  const listAt = INDEX.indexOf("POD_RSS_SERIES_LIST: PodRssSeriesDef[]");
  const order = ["exorcist-files", "counsel-of-trent", "fr-mike-homilies", "barron-sunday-sermons"].map((k) => INDEX.indexOf(`key: "${k}"`, listAt));
  ok(order.every((x) => x > listAt) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3],
    "S: the def order is the standing pair, then Fr. Mike, then Barron (registry order)");
  ok(INDEX.includes("EXT_FRMIKE_HOMILIES_FEED_URL?: string") && INDEX.includes("EXT_BARRON_SERMONS_FEED_URL?: string"),
    "S: both env seams stand in the Env shape (the standing seam form)");
  const migs = fs.readdirSync(path.join(APP, "migrations")).filter((x) => x.endsWith(".sql")).sort();
  ok(migs[migs.length - 1].startsWith("0032") && fs.existsSync(path.join(APP, "migrations/0027_rss_snapshots.sql")),
    `S: no new migration — 0027's series-keyed store carries the new series (newest migration ${migs[migs.length - 1]})`);
  // The source-diff discipline: against the v499-ship base tree
  // (the sibling worktree — present in both the build and the
  // composed ship contexts), ONLY index.ts moves among worker
  // sources; client.ts is byte-identical; ui.ts differs only in
  // the CACHE pin line (identical on the build tree, the pin
  // bump on the ship tree). index.ts's removed lines against
  // the base are the two seats the edit extends.
  const BASE_SRC = path.join(WT, "..", "v499-ship", "app/worker/src");
  if (fs.existsSync(BASE_SRC)) {
    const baseIndex = fs.readFileSync(path.join(BASE_SRC, "index.ts"), "utf8");
    const baseClient = fs.readFileSync(path.join(BASE_SRC, "client.ts"), "utf8");
    const baseUi = fs.readFileSync(path.join(BASE_SRC, "ui.ts"), "utf8");
    const uiNorm = (s) => s.replace(/var CACHE = "[^"]*";/, 'var CACHE = "PIN";');
    ok(fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8") === baseClient,
      "S: client.ts is byte-identical to the v499 ship (no client change)");
    ok(uiNorm(fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8")) === uiNorm(baseUi),
      "S: ui.ts is identical to the v499 ship outside the SW pin line");
    let d = "";
    try { d = execFileSync("diff", ["-U0", path.join(BASE_SRC, "index.ts"), path.join(APP, "worker/src/index.ts")], { encoding: "utf8" }).toString(); }
    catch (e) { d = (e.stdout || "").toString(); }
    const removed = d.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).map((l) => l.slice(1).trim());
    ok(removed.length === 0,
      `S: index.ts's diff vs the base is PURELY ADDITIVE (0 removed lines — the edit extends lists, it rewrites nothing)`);
    ok(baseIndex.length < INDEX.length, "S: index.ts only grows against the base (the change is additive)");
  } else {
    ok(true, "S: v499-ship base tree absent in this context — diff statics skipped (recorded, not a pass on the legs)");
  }
  ok(CLIENT.includes("function paintPodcastRss"), "S: the client paints the rss kind generically (no client change stands)");
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
  ok(FM.title.length > 0 && FM.guid && FM.durationS > 0 && FM_ART && BR.title.length > 0 && BR.guid && BR_ART,
    `S: the captured fixtures parse to expectations (Fr. Mike newest "${FM.title}" · ${FM.durationS}s · Barron newest "${BR.title}")`);
  ok(FM_COUNT > 50 && BR_COUNT > 50, `S: both captured feeds exceed the 50 window (Fr. Mike ${FM_COUNT} items · Barron ${BR_COUNT} items)`);
  await new Promise((r) => feedServer.listen(FEEDPORT, "127.0.0.1", r));
  try { execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stood on the port */ }
  for (let i = 0; i < 20; i++) {
    try { await fetch(BASE + "/", { signal: AbortSignal.timeout(1000) }); await sleep(500); }
    catch { break; }
    if (i === 19) throw new Error("port 8996 never freed — a stale server stands");
  }
  applyMigrations();
  ok(d1q("SELECT name FROM sqlite_master WHERE type='table' AND name='rss_snapshots'").length === 1,
    "migrations apply clean — rss_snapshots stands (0027, no new migration)");
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV)");

  // ---------- B1: the Fr. Mike build from the real feed ---------
  const f0 = fmFetches;
  const fm = await req("GET", "/api/player/podcasts?series=fr-mike-homilies");
  ok(fm.status === 200 && fm.body.kind === "rss" && fm.body.available === true && fm.body.stale === false,
    "B1: a cold read builds the Fr. Mike snapshot from the real feed (kind rss, available, not stale)");
  ok(fmFetches - f0 === 1, `B1: the cold build fetched the feed exactly once (${fmFetches - f0})`);
  const fe = fm.body.entries || [];
  ok(fe.length === 50 && fm.body.total === 50, `B1: the ${FM_COUNT}-item feed stores exactly the latest 50 (total ${fm.body.total})`);
  ok(fe[0].key === FM.guid && fe[0].title === FM.title && fe[0].durationS === FM.durationS && fe[0].url === FM.url,
    `B1: entries[0] is the feed's newest episode — "${FM.title}" (GUID key, parsed duration ${FM.durationS}s)`);
  ok(fe[0].label === chiLabel(FM.pubMs) && fm.body.currentKey === FM.guid && fm.body.currentLabel === chiLabel(FM.pubMs),
    `B1: current is the latest episode; its label is the Chicago date label (${chiLabel(FM.pubMs)})`);
  ok(fm.body.showImageUrl === FM_ART && fe[0].imageUrl,
    "B1: the payload carries the feed's own channel art (referenced, not re-hosted)");
  ok(fe.every((e, i) => i === 0 || (fe[i - 1].publishedMs ?? -Infinity) >= (e.publishedMs ?? -Infinity)) && new Set(fe.map((e) => e.key)).size === fe.length,
    "B1: entries stand newest-first with unique GUID keys");
  const fmRow = d1q("SELECT payload FROM rss_snapshots WHERE series='fr-mike-homilies'");
  const fmSnap = fmRow.length ? JSON.parse(fmRow[0].payload) : null;
  ok(!!fmSnap && fmSnap.entries.length === 50 && fmSnap.entries[0].key === FM.guid,
    "B1: the D1 rss_snapshots row for fr-mike-homilies holds the 50-entry window — asserted on the store");

  // ---------- B2: the Barron build from the real feed -----------
  const b0 = brFetches;
  const br = await req("GET", "/api/player/podcasts?series=barron-sunday-sermons");
  const be = br.body.entries || [];
  ok(br.status === 200 && br.body.kind === "rss" && br.body.available === true && brFetches - b0 === 1,
    "B2: a cold read builds the Barron snapshot from the real feed (one fetch, kind rss, available)");
  ok(be.length === 50 && be[0].key === BR.guid && be[0].title === BR.title && be[0].durationS === BR.durationS,
    `B2: entries[0] is the feed's newest sermon — "${BR.title}" (${chiLabel(BR.pubMs)}, ${BR.durationS}s)`);
  ok(br.body.showImageUrl === BR_ART && br.body.currentKey === BR.guid && br.body.currentLabel === chiLabel(BR.pubMs),
    "B2: the payload carries Word on Fire's own channel art; current is the newest sermon");
  ok(d1q("SELECT payload FROM rss_snapshots WHERE series='barron-sunday-sermons'").length === 1,
    "B2: the D1 rss_snapshots row for barron-sunday-sermons stands");

  // ---------- B3: marks + positions on the new series -----------
  const fmKey2 = fe[1].key, fmKey3 = fe[2].key;
  const m1 = await req("POST", "/api/player/podcasts/mark", { series: "fr-mike-homilies", seqKey: fmKey2, source: "manual" });
  ok(m1.status === 200, "B3: a hand mark on a Fr. Mike GUID answers ok");
  const fmM = await req("GET", "/api/player/podcasts?series=fr-mike-homilies");
  const marked = fmM.body.entries.find((e) => e.key === fmKey2);
  ok(marked.listened === true && marked.listenDate === chicagoToday() && fmM.body.listenedCount === 1 && fmM.body.currentKey === FM.guid,
    "B3: the mark shows in the payload (listened, Chicago listenDate, count 1) and current NEVER moves off the newest episode");
  const dur3 = fe[2].durationS;
  const pos1 = await req("POST", "/api/player/podcasts/position", { series: "fr-mike-homilies", seqKey: fmKey3, positionS: 999999, durationS: 999999 });
  const posRow = d1q(`SELECT position_s FROM podcast_positions WHERE series='fr-mike-homilies' AND seq_key='${fmKey3.replace(/'/g, "''")}'`);
  ok(pos1.status === 200 && posRow.length === 1 && posRow[0].position_s === dur3,
    `B3: a position save clamps to the snapshot entry's own durationS (${dur3}), asserted in D1`);
  await req("POST", "/api/player/podcasts/unmark", { series: "fr-mike-homilies", seqKey: fmKey2 });
  ok(d1q("SELECT seq_key FROM podcast_listens WHERE series='fr-mike-homilies'").length === 0,
    "B3: unmark wipes the listen row whole (asserted in D1)");

  // ---------- B4: the index map ---------------------------------
  const idx = await req("GET", "/api/player/podcasts");
  const list = idx.body.seriesList || [];
  ok(JSON.stringify(list.map((s) => s.series)) === JSON.stringify(["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year", "exorcist-files", "counsel-of-trent", "fr-mike-homilies", "barron-sunday-sermons", "the-ai-signal"]),
    `B4: the index construction order stands with the two new series appended in registry order (${JSON.stringify(list.map((s) => s.series))})`);
  ok(JSON.stringify(list.map((s) => s.category)) === JSON.stringify(["courses", "courses", "courses", "podcasts", "podcasts", "podcasts", "podcasts", "podcasts"]),
    "B4: the category map — the new series file under Podcasts");
  const fmIdx = list.find((s) => s.series === "fr-mike-homilies");
  const brIdx = list.find((s) => s.series === "barron-sunday-sermons");
  ok(fmIdx.kind === "rss" && fmIdx.available === true && fmIdx.total === 50 && fmIdx.latestLabel === chiLabel(FM.pubMs) && fmIdx.showImageUrl === FM_ART,
    "B4: the Fr. Mike index entry carries kind rss, total 50, the newest label, and the feed's channel art");
  ok(brIdx.kind === "rss" && brIdx.available === true && brIdx.total === 50 && brIdx.latestLabel === chiLabel(BR.pubMs) && brIdx.showImageUrl === BR_ART,
    "B4: the Barron index entry carries kind rss, total 50, the newest label, and the feed's channel art");

  // ---------- B5: the standing series, unmoved ------------------
  const exf = await req("GET", "/api/player/podcasts?series=exorcist-files");
  ok(exf.body.available === true && (exf.body.entries || []).length === 50 && exf.body.entries[0].key === "exf-guid-001",
    "B5: the standing Exorcist series builds as it did at v464 (same fixture, same window, same head)");
  const AUDIO_KEYS = JSON.stringify(["available", "builtAt", "collapses", "currentKey", "entries", "listenedCount", "ok", "series", "showDesc", "showImageUrl", "stale", "title", "total"]);
  const audP = await req("GET", "/api/player/podcasts?series=catechism-in-a-year");
  ok(JSON.stringify(Object.keys(audP.body).sort()) === AUDIO_KEYS,
    "B5: the audio series payload's shape is byte-identical to the base's (key set)");
  const vidP = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(JSON.stringify(Object.keys(vidP.body).sort()) === JSON.stringify(["available", "builtAt", "kind", "ok", "series", "stale", "title", "videos"]),
    "B5: the video series payload's shape is byte-identical to the base's (key set)");
  const ownP = await req("GET", "/api/player/podcasts?series=the-ai-signal");
  ok(JSON.stringify(Object.keys(ownP.body).sort()) === JSON.stringify(["available", "currentKey", "currentLabel", "entries", "kind", "ok", "series", "showDesc", "showImageUrl", "title"]),
    "B5: the own series payload's shape is byte-identical to the base's (key set)");
  ok((await req("GET", "/api/player/podcasts?series=bogus")).status === 400,
    "B5: an unknown ?series answers 400, exactly as the base");

  // ---------- B6: the door mirror --------------------------------
  const doorFm = await door("?series=fr-mike-homilies");
  ok(doorFm.status === 200 && doorFm.body.kind === "rss"
    && JSON.stringify((doorFm.body.entries || []).map((e) => e.key)) === JSON.stringify(fe.map((e) => e.key)),
    "B6: the door progress read mirrors the Fr. Mike payload (same builder, same entry keys)");
  const doorIdx = await door("");
  ok(doorIdx.status === 200 && (doorIdx.body.seriesList || []).length === 8,
    "B6: the door index mirrors the session index (eight series)");

  // ---------- C: the client in Chromium --------------------------
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e && e.message ? e.message : e)));
  let apiInFlight = 0;
  page.on("request", (r) => { if (r.url().includes("/api/")) apiInFlight++; });
  page.on("response", (r) => { if (r.url().includes("/api/")) apiInFlight--; });
  page.on("requestfailed", (r) => { if (r.url().includes("/api/")) apiInFlight--; });
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await page.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.includes("aphid.fireside.fm")) return route.fulfill({ status: 200, contentType: "audio/wav", body: wavBuffer(2) });
    if (u.includes("mcdn.podbean.com")) return route.fulfill({ status: 200, contentType: "audio/wav", body: wavBuffer(30) });
    if (u.endsWith(".mp3")) return route.fulfill({ status: 200, contentType: "audio/wav", body: wavBuffer(60) });
    if (/ytimg|img\.example|sndcdn|fireside\.fm|pbcdn1\.podbean\.com/.test(u)) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (u.includes("orapronobis.media")) {
      if (u.includes("/externals/feeds/")) return route.fulfill({ status: 200, contentType: "application/rss+xml", body: `<?xml version="1.0"?><rss version="2.0"><channel><title>Ext</title></channel></rss>` });
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    }
    return route.continue();
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-tab]", { timeout: 20000 });
  const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel);
  // A cold boot opens on Mass (the v492 opening rule), so no
  // Pray-home paint stands to wait on; the discipline is the
  // v464 one in this tree's form — wait for the boot's API
  // traffic to stand quiet before navigating, so no late paint
  // stomps the series page mid-leg. The wait is BOUNDED (the
  // Improvement E stuck clock): a serve-time fetch in the mold
  // can hold a request open for minutes, and waiting on it
  // forever is the failure this bound exists to prevent — at
  // the bound the harness proceeds; the client's paints are
  // tab-guarded, and the legs below re-wait on their own
  // selectors.
  const tapPodTab = async () => {
    let quiet = 0, waited = 0;
    while (quiet < 5 && waited < 200) { if (apiInFlight <= 0) quiet++; else quiet = 0; await sleep(300); waited++; }
    await click('[data-tab="podcasts"]');
    await page.waitForSelector("[data-podseries]", { timeout: 20000 });
  };
  const cardKeys = () => page.evaluate(() => [...document.querySelectorAll("[data-podseries]")].map((b) => b.getAttribute("data-podseries")));
  const cardMeta = (k) => page.evaluate((kk) => { const b = document.querySelector(`[data-podseries="${kk}"]`); return b ? (b.querySelector(".meta") || {}).textContent || "" : null; }, k);
  const backToIndex = async () => { await click("[data-podback]"); await page.waitForSelector("[data-podseries]", { timeout: 20000 }); };

  await tapPodTab();
  ok(JSON.stringify(await cardKeys()) === JSON.stringify(["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year"]),
    "C1: the Courses side paints exactly its three standing series (the new series do not leak onto Courses)");
  await click('#sidetoggle button[data-side="podcasts"]');
  await page.waitForFunction(() => document.querySelectorAll("[data-podseries]").length === 5, null, { timeout: 15000 });
  ok(JSON.stringify(await cardKeys()) === JSON.stringify(["exorcist-files", "counsel-of-trent", "fr-mike-homilies", "barron-sunday-sermons", "the-ai-signal"]),
    "C1: the Podcasts side paints the standing pair, then Fr. Mike, then Barron, then the AI Signal");
  ok((await cardMeta("fr-mike-homilies")) === `0 of 50 listened \u00b7 Latest: ${chiLabel(FM.pubMs)}`,
    `C1: the Fr. Mike card meta reads in the standing form (got "${await cardMeta("fr-mike-homilies")}")`);
  ok((await cardMeta("barron-sunday-sermons")) === `0 of 50 listened \u00b7 Latest: ${chiLabel(BR.pubMs)}`,
    `C1: the Barron card meta reads in the standing form (got "${await cardMeta("barron-sunday-sermons")}")`);

  // ---- C2: the Fr. Mike series page + play-to-end auto-mark ----
  await click('[data-podseries="fr-mike-homilies"]');
  await page.waitForSelector("[data-podrow]", { timeout: 20000 });
  const fmPage = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-podrow]")];
    return {
      count: rows.length,
      firstTitle: (rows[0].querySelector(".titlerow h3") || {}).textContent || "",
      head: (document.querySelector(".podpage-head .meta") || {}).textContent || "",
    };
  });
  ok(fmPage.count === 50 && fmPage.firstTitle === FM.title,
    `C2: the Fr. Mike page paints all fifty rows, newest first ("${fmPage.firstTitle}")`);
  ok(fmPage.head.includes("0 of 50 listened") && fmPage.head.includes(`Latest: ${chiLabel(FM.pubMs)}`),
    `C2: the page head reads in the standing form (got "${fmPage.head}")`);
  await page.evaluate(() => { const d = document.querySelectorAll("[data-podrow]")[0].querySelector("[data-podplay]"); if (d) d.click(); });
  await page.waitForFunction((t) => window.state && state.current && state.current.title === t && !document.getElementById("audio").paused,
    `${chiLabel(FM.pubMs)}: ${FM.title}`, { timeout: 20000 });
  ok(true, "C2: a disc tap starts the standing queue with the \"<date label>: <episode title>\" form");
  let autoRow = [];
  for (let i = 0; i < 40 && !autoRow.length; i++) { autoRow = d1q(`SELECT source FROM podcast_listens WHERE series='fr-mike-homilies' AND seq_key='${FM.guid}'`); if (!autoRow.length) await sleep(500); }
  ok(autoRow.length === 1 && autoRow[0].source === "auto",
    "C2: playing the homily to its end auto-marks it (source auto) in the standing store, under the feed GUID");
  const fmAfter = await req("GET", "/api/player/podcasts?series=fr-mike-homilies");
  ok(fmAfter.body.currentKey === FM.guid && fmAfter.body.listenedCount === 1,
    "C2: after the auto-mark, current is STILL the newest episode (never mark-derived)");
  await page.evaluate(() => { const a = document.getElementById("audio"); if (a) a.pause(); });

  // ---- C3: the Barron page + the position save ------------------
  await backToIndex();
  await click('[data-podseries="barron-sunday-sermons"]');
  await page.waitForSelector("[data-podrow]", { timeout: 20000 });
  const brHead = await page.evaluate(() => (document.querySelector(".podpage-head .meta") || {}).textContent || "");
  ok(brHead.includes("0 of 50 listened") && brHead.includes(`Latest: ${chiLabel(BR.pubMs)}`),
    `C3: the Barron page head reads in the standing form (got "${brHead}")`);
  await page.evaluate(() => { const d = document.querySelectorAll("[data-podrow]")[0].querySelector("[data-podplay]"); if (d) d.click(); });
  await page.waitForFunction((t) => window.state && state.current && state.current.title === t && !document.getElementById("audio").paused,
    `${chiLabel(BR.pubMs)}: ${BR.title}`, { timeout: 20000 });
  await page.waitForFunction(() => document.getElementById("audio").currentTime >= 6, null, { timeout: 20000 });
  await page.evaluate(() => { document.getElementById("audio").pause(); });
  let posSaved = [];
  for (let i = 0; i < 20 && !posSaved.length; i++) { posSaved = d1q(`SELECT position_s FROM podcast_positions WHERE series='barron-sunday-sermons' AND seq_key='${BR.guid}'`); if (!posSaved.length) await sleep(500); }
  ok(posSaved.length === 1 && posSaved[0].position_s >= 5,
    `C3: a pause mid-sermon saves the position to the server store under the feed GUID (got ${JSON.stringify(posSaved)})`);
  await backToIndex();
  await click('[data-podseries="barron-sunday-sermons"]');
  await page.waitForSelector("[data-podrow]", { timeout: 20000 });
  ok(await page.evaluate(() => !!document.querySelectorAll("[data-podrow]")[0].querySelector(".podbar")),
    "C3: reopening the page, the partway row carries its progress bar");

  ok(pageErrors.length === 0, `C4: no page errors across the client legs (the cooked script parses and boots clean)${pageErrors.length ? " — " + pageErrors[0] : ""}`);
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
console.log(`# harness-v500: ${n - fails}/${n} ok`);
process.exit(fails ? 1 : 0);
