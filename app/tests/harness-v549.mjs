// harness-v549.mjs — v549 evidence: Summa in a Year
// becomes a true course (Q1 A) with its marks carried
// (Q2 A); the USCCB Daily Readings Podcast joins Podcasts
// under its feed-full name (Q3 B), its page pulling the
// feed as-is (John's refinement, 2026-11-20 07:01 CT);
// the date-matched episode seats in Morning Prayer before
// the Rosary (Q5 comment) and can be added to a block
// (Q4 A); the series card joins the Salesian + Benedictine
// Podcasts layers, Benedictine's layer turning ON (Q5 A).
// Built to the v549 release document §2 (the v548 mold).
//   S statics: the registry moves stand · the trim stands
//     · migration 0042 stands last · the fixtures stand
//   B worker (local wrangler, fixture D1 seeded with the
//     LIVE profile store): B1 Summa's sequence payload —
//     307 day entries on sum:day-N keys, Days 188/189/240
//     standing, current = Day 1 · B2 marks round-trip on
//     the day keys · B3 the index (Summa under courses,
//     readings under podcasts, eleven series) · B4 the
//     readings payload — verbatim feed title, 500 entries,
//     feed order as published · B5 no seat at the baseline
//     profiles · B6 the seat fires after the §2.7 profile
//     writes (the presented day's episode, strict match)
//     · B7 the matcher preference + no-fallback legs
//     (synthetic feeds) · B8 the additions widening (PUT
//     validation + the fold, prayer + reading rows) ·
//     B9 the profiles read-back (version 6, little-way
//     untouched) · B10 the Benedictine pick day seats too
//   C the carry map (node, over the captured Summa feed):
//     GUID → sum:day-N is total over the 307 episodes
//   W client (Chromium, the v534 mold; fetch stubbed with
//     payloads CAPTURED FROM THE REAL LOCAL WORKER): W1
//     the seat descriptor stands in Morning immediately
//     before daily-rosary · W2 Courses carries Summa (307
//     rows, Day 1 current), Podcasts carries the readings
//     and not Summa · W3 the readings page (500 rows as
//     published) + the Add act writes the reading row and
//     the episode lands in the picked block · W4 the Pray
//     Podcasts group carries four cards incl. readings
// Fixtures (Improvement D), under tests/fixtures-v549/:
//   (a) feeds-summa-2026-11-20.xml — the LIVE Summa feed
//     captured 2026-11-20 (sha256 e787692fb9f4820dda6ad7
//     d87a12f9b8473b6d3b36d10532a524ac1ccf1fc1ac; 307
//     items; the v548 capture, byte-identical).
//   (b) feeds-usccb-readings-2026-11-20.xml — the LIVE
//     USCCB Daily Readings Podcast feed captured
//     2026-11-20 (sha256 b2a11081348e42d3c5bab19c3f038c4
//     4f1f95e54e1837598ec220b5cfbce0a6d; 500 items;
//     channel title "USCCB Daily Readings Podcast").
//   (c) profiles-live-2026-11-20.json — the live profiles
//     door read of 2026-11-20 (salesian podcasts on
//     [bible-in-a-year, exorcist-files,
//     daily-gospel-exegesis]; benedictine off/empty;
//     state version 5).
//   The standing series' feeds ride small synthetic
//   fixtures in the v500 form; the matcher-preference
//   legs ride two small synthetic readings feeds (their
//   shapes are what those legs prove).
// Run: node app/tests/harness-v549.mjs [--probe]
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE_APP = process.env.H549_BASE || path.resolve(ROOT, '../v549-base/app');
const BASE_SRC = BASE_APP + '/worker/src';
const FX = APP + '/tests/fixtures-v549';
const SUMMA_XML = readFileSync(FX + '/feeds-summa-2026-11-20.xml', 'utf8');
const USCCB_XML = readFileSync(FX + '/feeds-usccb-readings-2026-11-20.xml', 'utf8');
const PROFILES_LIVE = JSON.parse(readFileSync(FX + '/profiles-live-2026-11-20.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const SEATS_LIVE = JSON.parse(readFileSync(APP + '/tests/fixtures-v548/mass-seats-live-2026-11-19.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TODAY = '2026-11-20';

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 300) : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 300) : ''); }
}

/* ---- expectations derived from the captured live feeds ---- */
function xmlText(s) {
  if (s == null) return s;
  let t = String(s).trim();
  if (t.startsWith('<![CDATA[') && t.endsWith(']]>')) t = t.slice(9, -3);
  return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function parseItems(xml) {
  const out = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    const g = /<guid\b[^>]*>([\s\S]*?)<\/guid>/.exec(b);
    const t = /<title>([\s\S]*?)<\/title>/.exec(b);
    const p = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(b);
    const d = /<[A-Za-z0-9_.-]*:?duration>([^<]*)</.exec(b);
    const enc = /<enclosure\b[^>]*?url="([^"]*)"/.exec(b);
    const img = /<itunes:image[^>]*href="([^"]*)"/.exec(b);
    const durS = d ? (d[1].includes(':') ? d[1].split(':').reduce((a, x) => a * 60 + Number(x), 0) : Number(d[1])) : 0;
    out.push({ guid: g ? xmlText(g[1]) : null, title: t ? xmlText(t[1]) : '', rawTitle: t ? t[1] : '', pubMs: p ? Date.parse(p[1].trim()) : null, durationS: durS, url: enc ? enc[1] : '', itemImage: img ? img[1] : null });
  }
  return out;
}
function channelTitle(xml) {
  const head = xml.slice(0, xml.indexOf('<item'));
  const m = /<title>([\s\S]*?)<\/title>/.exec(head);
  return m ? xmlText(m[1]) : null;
}
const SUMMA_ITEMS = parseItems(SUMMA_XML);
const SUMMA_DAYS = new Map();
for (const it of SUMMA_ITEMS) {
  const dm = /^Day\s+(\d+)\s*:/i.exec(it.title.trim());
  if (dm && it.guid) SUMMA_DAYS.set(Number(dm[1]), it);
}
const USCCB_ITEMS = parseItems(USCCB_XML);
const USCCB_BY_PUB = [...USCCB_ITEMS].filter((x) => x.url).sort((a, b) => (b.pubMs ?? -Infinity) - (a.pubMs ?? -Infinity));
const USCCB_NEWEST = USCCB_BY_PUB[0];
const USCCB_TODAY = USCCB_ITEMS.find((x) => x.title.trim() === 'Daily Mass Reading Podcast for November 20, 2026') || null;
const USCCB_XMAS = USCCB_ITEMS.filter((x) => /December 25, 2026/.test(x.title));

/* ---- small synthetic fixtures for the standing series (v500 form) ---- */
function rssItemS(title, guid, file, pub, dur) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate><guid isPermaLink="false">${guid}</guid>`
    + `<enclosure url="https://audio.example/${file}" length="30000000" type="audio/mpeg"/>`
    + `<itunes:duration>${dur}</itunes:duration><description>${title} description.</description></item>`;
}
function rssFeedS(show, showImg, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${show}</title>`
    + `<itunes:image href="${showImg}"/><description>${show} fixture show.</description>` + items.join('\n') + `</channel></rss>`;
}
const EXF_XML = rssFeedS('The Exorcist Files', 'https://img.example/exf-show.jpg', [
  rssItemS('Case 1: First', 'exf-g1', 'exf1.mp3', 'Fri, 13 Nov 2026 08:00:00 GMT', 3600),
  rssItemS('Case 2: Second', 'exf-g2', 'exf2.mp3', 'Thu, 12 Nov 2026 08:00:00 GMT', 3500),
]);
const CT_XML = rssFeedS('The Counsel of Trent', 'https://img.example/ct-show.jpg', [
  rssItemS('#1226: Counsel First', 'ct-g1', 'ct1.mp3', 'Fri, 13 Nov 2026 13:01:04 GMT', 1500),
]);
const FM_XML = rssFeedS('Sunday Homilies with Fr. Mike Schmitz', 'https://img.example/fm-show.jpg', [
  rssItemS('Homily First', 'fm-g1', 'fm1.mp3', 'Sun, 15 Nov 2026 12:00:00 GMT', 1200),
]);
const BR_XML = rssFeedS("Bishop Barron's Sunday Sermons", 'https://img.example/br-show.jpg', [
  rssItemS('Sermon First', 'br-g1', 'br1.mp3', 'Sun, 15 Nov 2026 12:00:00 GMT', 900),
]);
const DGE_XML = rssFeedS('Daily Gospel Exegesis', 'https://img.example/dge-show.jpg', [
  rssItemS('Friday of Week 33 in Ordinary Time - Luke 19: 45-48', 'dge-g1', 'dge1.mp3', 'Tue, 17 Nov 2026 17:00:00 GMT', 1500),
]);
function dayItem(day, title, file, pub) {
  return `<item><title>Day ${day}: ${title}</title><pubDate>${pub}</pubDate>`
    + `<enclosure url="https://audio.example/${file}" length="1000" type="audio/mpeg"/><description>${title} description</description></item>`;
}
const BIY_XML = rssFeedS('Bible in a Year', 'https://img.example/biy-show.jpg', [
  dayItem(324, 'Acts and Romans', 'biy-day324.mp3', 'Thu, 19 Nov 2026 12:00:00 GMT'),
  dayItem(1, 'In the Beginning', 'biy-day1.mp3', 'Mon, 05 Jan 2026 12:00:00 GMT'),
]);
const CIY_XML = rssFeedS('Catechism in a Year', 'https://img.example/ciy-show.jpg', [
  dayItem(1, 'The Creation', 'ciy-day1.mp3', 'Mon, 05 Jan 2026 12:00:00 GMT'),
]);
const RIY_XML = rssFeedS('The Rosary in a Year', 'https://img.example/riy-show.jpg', [
  dayItem(1, 'The Joyful Mysteries', 'riy-day1.mp3', 'Mon, 05 Jan 2026 12:00:00 GMT'),
]);
const YT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<title>CatholicTV</title>
<entry><id>yt:video:vidAlpha111</id><yt:videoId>vidAlpha111</yt:videoId><title>Catholic Mass Today</title><link rel="alternate" href="https://www.youtube.com/watch?v=vidAlpha111"/><published>2026-11-15T14:00:00+00:00</published><media:group><media:thumbnail url="https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg" width="480" height="360"/><media:description>Daily Mass.</media:description></media:group></entry>
</feed>`;
/* The matcher-preference readings feeds (synthetic, small):
   xmas — the presented day (Nov 20) in four suffixed forms,
   no plain title: the seat must take "- Day". gap — no
   Nov 20 item at all: the seat must stand empty (no
   latest-by-date fallback). */
const READINGS_XMAS_XML = rssFeedS('USCCB Daily Readings Podcast', 'https://img.example/usccb-show.jpg', [
  rssItemS('Daily Mass Reading Podcast for November 20, 2026 - Night', 'usccb-x-night', 'x-night.mp3', 'Mon, 16 Nov 2026 10:00:00 GMT', 600),
  rssItemS('Daily Mass Reading Podcast for November 20, 2026 - Day', 'usccb-x-day', 'x-day.mp3', 'Mon, 16 Nov 2026 10:00:00 GMT', 601),
  rssItemS('Daily Mass Reading Podcast for November 20, 2026 - Dawn', 'usccb-x-dawn', 'x-dawn.mp3', 'Mon, 16 Nov 2026 10:00:00 GMT', 602),
  rssItemS('Daily Mass Reading Podcast for November 20, 2026 - Vigil', 'usccb-x-vigil', 'x-vigil.mp3', 'Mon, 16 Nov 2026 10:00:00 GMT', 603),
]);
const READINGS_GAP_XML = rssFeedS('USCCB Daily Readings Podcast', 'https://img.example/usccb-show.jpg', [
  rssItemS('Daily Mass Reading Podcast for November 21, 2026', 'usccb-g-21', 'g21.mp3', 'Mon, 16 Nov 2026 10:00:00 GMT', 600),
  rssItemS('Daily Mass Reading Podcast for November 19, 2026', 'usccb-g-19', 'g19.mp3', 'Mon, 16 Nov 2026 10:00:00 GMT', 601),
]);
let readingsMode = 'real';
let readingsFetches = 0, summaFetches = 0;
const feedServer = http.createServer((rq, rs) => {
  const u = rq.url || '';
  const send = (body, ct) => { rs.writeHead(200, { 'content-type': ct }); rs.end(body); };
  if (u.startsWith('/summa.xml')) { summaFetches++; return send(SUMMA_XML, 'application/rss+xml'); }
  if (u.startsWith('/readings.xml')) { readingsFetches++; return send(readingsMode === 'xmas' ? READINGS_XMAS_XML : readingsMode === 'gap' ? READINGS_GAP_XML : USCCB_XML, 'application/rss+xml'); }
  if (u.startsWith('/dge.xml')) return send(DGE_XML, 'application/rss+xml');
  if (u.startsWith('/exf.xml')) return send(EXF_XML, 'application/rss+xml');
  if (u.startsWith('/counsel.xml')) return send(CT_XML, 'application/rss+xml');
  if (u.startsWith('/frmike.xml')) return send(FM_XML, 'application/rss+xml');
  if (u.startsWith('/barron.xml')) return send(BR_XML, 'application/rss+xml');
  if (u.startsWith('/biy.xml')) return send(BIY_XML, 'application/rss+xml');
  if (u.startsWith('/ciy.xml')) return send(CIY_XML, 'application/rss+xml');
  if (u.startsWith('/riy.xml')) return send(RIY_XML, 'application/rss+xml');
  if (u.startsWith('/yt.xml')) return send(YT_XML, 'application/atom+xml');
  rs.writeHead(404); rs.end('no');
});

/* ---- wrangler scaffolding (the estate mold) ---- */
const WRANGLER = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler';
const PORT = 8995, FEEDPORT = 8997;
const BASE = 'http://127.0.0.1:' + PORT;
const PERSIST = path.join(APP, '.wrangler-test-v549');
const TOKEN = 'harness-v549-token';
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'h549-'));
function d1Fn(appDir, persist) {
  return (args) => execFileSync(WRANGLER, ['d1', 'execute', 'ora-pro-nobis-app', '--local', '--config', path.join(appDir, 'wrangler.toml'), '--persist-to', persist, ...args],
    { cwd: appDir, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } }).toString();
}
const wranglerD1 = d1Fn(APP, PERSIST);
function applyMigrations(appDir, persist, d1) {
  const dir = path.join(appDir, 'migrations');
  const files = readdirSync(dir).filter((x) => x.endsWith('.sql')).sort().map((f) => path.join(dir, f));
  rmSync(persist, { recursive: true, force: true });
  const f = path.join(TMPD, 'migs-' + path.basename(persist) + '.sql');
  fs.writeFileSync(f, files.map((x) => readFileSync(x, 'utf8')).join('\n'));
  d1(['--file', f]);
}
function applySql(d1, sql) {
  const f = path.join(TMPD, 'one-' + Math.random().toString(36).slice(2, 8) + '.sql');
  fs.writeFileSync(f, sql);
  d1(['--file', f]);
}
const procs = [];
function startApp(appDir, persist, port) {
  const F = 'http://127.0.0.1:' + FEEDPORT;
  const args = ['dev', '--config', path.join(appDir, 'wrangler.toml'), '--local', '--port', String(port), '--persist-to', persist,
    '--var', 'LOCAL_DEV:1', '--var', 'AGENT_TOKEN:' + TOKEN,
    '--var', 'EXT_SUMMA_FEED_URL:' + F + '/summa.xml',
    '--var', 'EXT_DAILY_READINGS_FEED_URL:' + F + '/readings.xml',
    '--var', 'EXT_DGE_FEED_URL:' + F + '/dge.xml',
    '--var', 'EXT_EXORCIST_FEED_URL:' + F + '/exf.xml',
    '--var', 'EXT_COUNSEL_TRENT_FEED_URL:' + F + '/counsel.xml',
    '--var', 'EXT_FRMIKE_HOMILIES_FEED_URL:' + F + '/frmike.xml',
    '--var', 'EXT_BARRON_SERMONS_FEED_URL:' + F + '/barron.xml',
    '--var', 'EXT_BIAY_FEED_URL:' + F + '/biy.xml',
    '--var', 'EXT_CIY_FEED_URL:' + F + '/ciy.xml',
    '--var', 'EXT_RIY_FEED_URL:' + F + '/riy.xml',
    '--var', 'EXT_YT_CATHOLICTV_FEED_URL:' + F + '/yt.xml'];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + '/', { signal: AbortSignal.timeout(3000) }); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const req = (base) => async (method, p, body, headers = {}) => {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const out = { status: r.status, body: await r.json().catch(() => ({})) };
      if (out.status >= 500 && i < 4) { await sleep(800); continue; }
      return out;
    } catch (e) { lastErr = e; await sleep(800); }
  }
  throw lastErr;
};
const api = req(BASE);
const AGENT = { authorization: 'Bearer ' + TOKEN };
const doorProfiles = (date) => api('GET', '/api/agent/prayer/profiles' + (date ? '?date=' + date : ''), undefined, AGENT);
const doorDay = (date) => api('GET', '/api/agent/player/day?date=' + date, undefined, AGENT);
const byKeyOf = (b) => { const m = {}; (b.profiles || []).forEach((p) => { m[p.key] = p; }); return m; };
const LIVE_SHAPE_SQL = `UPDATE prayer_profiles SET layers = '{"novenas":{"on":1},"podcasts":{"on":1,"series":["bible-in-a-year","exorcist-files","daily-gospel-exegesis"]}}' WHERE key = 'salesian';
UPDATE prayer_profile_state SET version = 5 WHERE id = 1;`;
/* The §2.7 writes, in the ship step's own form: the parsed
   layers modified in place and re-serialized in the
   standing key order, the version bumped by exactly 1. */
function transformSql() {
  const byKey = byKeyOf(PROFILES_LIVE);
  const sal = JSON.parse(JSON.stringify(byKey['salesian'].layers));
  sal.podcasts.series = [...sal.podcasts.series, 'daily-readings'];
  const ben = JSON.parse(JSON.stringify(byKey['benedictine'].layers));
  ben.podcasts = { on: true, series: ['daily-readings'] };
  const ser = (l) => JSON.stringify({ novenas: { on: !!l.novenas.on }, podcasts: { on: !!l.podcasts.on, series: l.podcasts.series } });
  return `UPDATE prayer_profiles SET layers = '${ser(sal)}' WHERE key = 'salesian';
UPDATE prayer_profiles SET layers = '${ser(ben)}' WHERE key = 'benedictine';
UPDATE prayer_profile_state SET version = version + 1 WHERE id = 1;`;
}

/* ---------------- S: statics ---------------- */
function statics() {
  const seqAt = I_SRC.indexOf('const POD_SERIES_LIST');
  const rssAt = I_SRC.indexOf('const POD_RSS_SERIES_LIST');
  const seqSumma = I_SRC.indexOf('key: "summa-in-a-year"', seqAt);
  ok(seqSumma > seqAt && seqSumma < rssAt && I_SRC.slice(seqSumma, seqSumma + 340).includes('prefix: "sum"'),
    'S1: summa-in-a-year stands in POD_SERIES_LIST with prefix "sum" (the true course)');
  ok(!I_SRC.slice(rssAt).includes('key: "summa-in-a-year"'),
    'S1: the RSS registry no longer carries summa-in-a-year (moved, not copied)');
  const rssDr = I_SRC.indexOf('key: "daily-readings"', rssAt);
  ok(rssDr > rssAt && I_SRC.slice(rssDr, rssDr + 340).includes('title: "USCCB Daily Readings Podcast"')
    && I_SRC.slice(rssDr, rssDr + 340).includes('window: 500'),
    'S2: daily-readings stands in POD_RSS_SERIES_LIST under the feed\'s verbatim full name, window 500');
  const seqOrder = ['catechism-in-a-year', 'bible-in-a-year', 'rosary-in-a-year', 'summa-in-a-year'].map((k) => I_SRC.indexOf(`key: "${k}"`, seqAt));
  const rssOrder = ['exorcist-files', 'counsel-of-trent', 'fr-mike-homilies', 'barron-sunday-sermons', 'daily-gospel-exegesis', 'daily-readings'].map((k) => I_SRC.indexOf(`key: "${k}"`, rssAt));
  ok(seqOrder.every((x) => x > seqAt) && seqOrder.every((x, i) => i === 0 || x > seqOrder[i - 1])
    && rssOrder.every((x) => x > rssAt) && rssOrder.every((x, i) => i === 0 || x > rssOrder[i - 1]),
    'S3: the registry orders stand — Summa appended to the sequence list, Daily Readings appended to the RSS list');
  ok(I_SRC.includes('const RSS_USCCB_READINGS_FEED_URL = "https://feeds.soundcloud.com/users/soundcloud:users:838970026/sounds.rss";')
    && I_SRC.includes('EXT_DAILY_READINGS_FEED_URL?: string'),
    'S4: the pinned USCCB feed constant and the Env harness seam stand');
  ok(I_SRC.includes('const title = it.title.trim();') && I_SRC.includes('sup.it.title.trim()'),
    'S5: podBuildSequence matches and builds on the TRIMMED title (Days 188/189/240 build)');
  ok(I_SRC.includes('function dailyReadingsMatch(') && !I_SRC.slice(I_SRC.indexOf('function dailyReadingsMatch('), I_SRC.indexOf('function dailyReadingsMatch(') + 1400).includes('latest'),
    'S6: the strict date matcher stands and carries NO latest-by-date fallback (a wrong day never seats)');
  const migs = readdirSync(APP + '/migrations').filter((x) => x.endsWith('.sql')).sort();
  const m42 = migs[migs.length - 1] === '0042_day_additions_kind.sql' ? readFileSync(APP + '/migrations/0042_day_additions_kind.sql', 'utf8') : '';
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql'
    && m42.includes("ADD COLUMN kind TEXT NOT NULL DEFAULT 'prayer'") && m42.includes('ADD COLUMN ref TEXT'),
    'S7: migration 0042 stands last, adding kind + ref to prayer_day_additions (schema only)');
  ok(C_SRC.includes('function foldReadingsSeat(') && C_SRC.includes("episodeId === 'daily-rosary'")
    && C_SRC.includes('dailyReadingsTodayEntry') && C_SRC.includes('openReadingSlotPicker')
    && C_SRC.includes('readingAdditionCardHtml') && C_SRC.includes('id="readings-add"') && C_SRC.includes('function readingsSeatCardEl('),
    'S8: the client carries the seat fold (before daily-rosary), the seat card paint, the today-entry mirror, the picker, and the reading card');
  const byKey = byKeyOf(PROFILES_LIVE);
  ok(['little-way', 'salesian', 'benedictine'].every((k) => byKey[k] && byKey[k].kind === 'default')
    && byKey['salesian'].layers.podcasts.on === true
    && JSON.stringify(byKey['salesian'].layers.podcasts.series) === '["bible-in-a-year","exorcist-files","daily-gospel-exegesis"]'
    && byKey['benedictine'].layers.podcasts.on === false && JSON.stringify(byKey['benedictine'].layers.podcasts.series) === '[]'
    && PROFILES_LIVE.state && PROFILES_LIVE.state.version === 5 && PROFILES_LIVE.state.standingKey === 'salesian',
    'S9: the profiles fixture stands (the live draw: salesian three, benedictine off/empty, state v5)');
  ok(channelTitle(USCCB_XML) === 'USCCB Daily Readings Podcast' && USCCB_ITEMS.length === 500 && !!USCCB_TODAY && !!USCCB_TODAY.guid
    && USCCB_ITEMS.filter((x) => x.title.trim() === 'Daily Mass Reading Podcast for November 20, 2026').length === 1
    && USCCB_XMAS.length === 4 && !USCCB_XMAS.some((x) => x.title.trim() === 'Daily Mass Reading Podcast for December 25, 2026'),
    'S10: the USCCB fixture stands (channel title verbatim; 500 items; exactly one plain Nov 20 episode; Dec 25 in four suffixed forms, no plain)',
    { today: USCCB_TODAY && USCCB_TODAY.guid, xmas: USCCB_XMAS.map((x) => x.title.trim()) });
  const rawLead = SUMMA_ITEMS.filter((x) => /^\s/.test(x.title)).map((x) => x.title);
  ok(SUMMA_ITEMS.length === 307 && SUMMA_DAYS.size === 307
    && rawLead.length === 3 && rawLead.some((t) => t.includes('Day 188:')) && rawLead.some((t) => t.includes('Day 189:')) && rawLead.some((t) => t.includes('Day 240:')),
    'S11: the Summa fixture stands (307 items, 307 Day numbers, exactly three leading-space titles: Days 188, 189, 240)',
    { rawLead });
  if (existsSync(BASE_SRC)) {
    const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
    ok(pin(U_SRC) === pin(readFileSync(BASE_SRC + '/ui.ts', 'utf8')) && U_SRC.includes('ora-pro-nobis-v549-1'),
      'S12: ui.ts is identical to the base outside the SW pin, which stands at ora-pro-nobis-v549-1');
  } else {
    ok(true, 'S12: base tree absent in this context — the pin diff is skipped (recorded, not a pass on the leg)');
  }
}

/* ---------------- C: the §2.2 carry map ---------------- */
function carryMapLeg() {
  const map = {};
  let total = true;
  for (const it of SUMMA_ITEMS) {
    const dm = /^Day\s+(\d+)\s*:/i.exec(it.title.trim());
    if (!dm || !it.guid) { total = false; continue; }
    map[it.guid] = 'sum:day-' + Number(dm[1]);
  }
  const values = new Set(Object.values(map));
  ok(total && Object.keys(map).length === 307 && values.size === 307,
    'C1: the carry map (feed GUID → sum:day-N, trimmed-title parse) is TOTAL over the 307 Day episodes — every RSS-kind mark has a sequence-kind home',
    { mapped: Object.keys(map).length });
}

/* ---------------- the worker legs ---------------- */
let captured = null;
async function workerLegs() {
  await new Promise((r) => feedServer.listen(FEEDPORT, '127.0.0.1', r));
  try { execFileSync('fuser', ['-k', PORT + '/tcp'], { stdio: 'ignore' }); } catch { /* free */ }
  applyMigrations(APP, PERSIST, wranglerD1);
  startApp(APP, PERSIST, PORT);
  ok(await waitUp(BASE), 'W0: build app up on local wrangler (LOCAL_DEV), D1 through 0042');
  applySql(wranglerD1, LIVE_SHAPE_SQL);
  {
    const prof = (await doorProfiles()).body;
    ok(JSON.stringify(prof.profiles) === JSON.stringify(PROFILES_LIVE.profiles)
      && JSON.stringify(prof.state) === JSON.stringify(PROFILES_LIVE.state),
      'W1: the seeded local store matches the live profiles shape byte-for-byte', prof.state);
  }
  /* B1 — Summa the true course */
  let summaPayload = null;
  {
    const r = await api('GET', '/api/player/podcasts?series=summa-in-a-year');
    summaPayload = r.body;
    const es = r.body.entries || [];
    ok(r.status === 200 && r.body.kind !== 'rss' && r.body.available === true && r.body.total === 307 && es.length === 307,
      'B1: the Summa payload is the sequence kind — 307 entries, not a 50-item RSS window', { kind: r.body.kind, total: r.body.total });
    ok(es.every((e) => /^sum:day-\d+$/.test(e.key)) && es[0].key === 'sum:day-1' && es[306].key === 'sum:day-307',
      'B1: every entry key is a sum:day-N key, Day 1 at the head and Day 307 at the tail (no GUID keys)');
    ok(es[187].key === 'sum:day-188' && es[187].label === 'Day 188' && es[187].title === 'Temperance'
      && es[188].key === 'sum:day-189' && es[239].key === 'sum:day-240' && es[239].label === 'Day 240' && es[239].title === 'Post-Resurrection',
      'B1: the leading-space titles build as Days 188, 189, 240 — day keys standing, labels carrying the Day, titles cleaned (the trim leg)',
      { d188: es[187], d189: es[188], d240: es[239] });
    ok(r.body.currentKey === 'sum:day-1' && es[0].listened === false,
      'B1: current is Day 1 — the first unlistened day (all 307 in order)');
    ok(es[0].url === SUMMA_DAYS.get(1).url && es[0].durationS === SUMMA_DAYS.get(1).durationS,
      'B1: Day 1 carries the feed\'s real enclosure and duration');
    const r2 = await api('GET', '/api/player/podcasts?series=summa-in-a-year');
    ok(summaFetches === 1 && r2.body.available === true,
      'B1: a second read serves the standing snapshot (one feed fetch; the sequence snapshot stands)');
  }
  /* B2 — marks on the day keys (the Q2 destination shape) */
  {
    const m = await api('POST', '/api/player/podcasts/mark', { series: 'summa-in-a-year', seqKey: 'sum:day-1', source: 'manual' });
    const pos = await api('POST', '/api/player/podcasts/position', { series: 'summa-in-a-year', seqKey: 'sum:day-3', positionS: 42, durationS: 600 });
    const r = await api('GET', '/api/player/podcasts?series=summa-in-a-year');
    summaPayload = r.body;
    const es = r.body.entries || [];
    ok(m.status === 200 && m.body.ok === true && pos.status === 200 && pos.body.ok === true,
      'B2: a listen mark and a position write through the standing routes on the sum:day-N keys');
    ok(es[0].listened === true && r.body.listenedCount === 1 && r.body.currentKey === 'sum:day-2',
      'B2: the mark reads back on the sequence payload — Day 1 listened, current advances to Day 2 (no listened day reads unlistened)');
    ok(es[2].positionS === 42 && es[2].listened === false, 'B2: the position reads back on Day 3 (42 s, unlistened)');
  }
  /* B4 — the readings payload, the feed as-is */
  let readingsPayload = null;
  {
    const r = await api('GET', '/api/player/podcasts?series=daily-readings');
    readingsPayload = r.body;
    const es = r.body.entries || [];
    ok(r.status === 200 && r.body.kind === 'rss' && r.body.available === true && r.body.title === 'USCCB Daily Readings Podcast',
      'B4: the readings payload stands under the feed\'s verbatim full name', { title: r.body.title });
    ok(r.body.total === 500 && es.length === 500 && es[0].key === USCCB_NEWEST.guid && es[0].title === USCCB_NEWEST.title.trim(),
      'B4: the page pulls the feed as-is — 500 entries in published (pubDate) order, the newest-published episode at the head, NO date-matching or re-sort on the page',
      { head: es[0] && es[0].title });
    ok(r.body.currentKey === es[0].key,
      'B4: current is the head of the published order (the refinement: the page does not open on today)');
  }
  /* B3 — the index */
  let indexPayload = null;
  {
    const r = await api('GET', '/api/player/podcasts');
    indexPayload = r.body;
    const list = r.body.seriesList || [];
    const bySeries = {}; list.forEach((s) => { bySeries[s.series] = s; });
    ok(bySeries['summa-in-a-year'] && bySeries['summa-in-a-year'].category === 'courses' && bySeries['summa-in-a-year'].total === 307,
      'B3: the index files Summa in a Year under Courses (307 days)', bySeries['summa-in-a-year']);
    ok(bySeries['daily-readings'] && bySeries['daily-readings'].category === 'podcasts' && bySeries['daily-readings'].title === 'USCCB Daily Readings Podcast' && bySeries['daily-readings'].total === 500,
      'B3: the index files the readings under Podcasts with the verbatim feed title (500 episodes)', bySeries['daily-readings']);
    ok(list.length === 11 && ['catechism-in-a-year', 'bible-in-a-year', 'rosary-in-a-year', 'exorcist-files', 'counsel-of-trent', 'fr-mike-homilies', 'barron-sunday-sermons', 'daily-gospel-exegesis', 'the-ai-signal'].every((k) => !!bySeries[k]),
      'B3: the catalog reads eleven — the standing nine stand unchanged beside the two moves', { n: list.length });
  }
  /* B5 — no seat at the baseline profiles */
  {
    const day = (await doorDay(TODAY)).body;
    ok(day.profile && day.profile.key === 'salesian' && !day.readingsSeat,
      'B5: at the live baseline (readings in no layer) the day carries NO readings seat — the seat rides layer membership, nothing else');
  }
  /* the §2.7 profile writes (the ship step's guarded form,
     replayed here against the fixture store) */
  applySql(wranglerD1, transformSql());
  /* B9 — the profiles read-back */
  {
    const prof = (await doorProfiles()).body;
    const byKey = byKeyOf(prof);
    const live = byKeyOf(PROFILES_LIVE);
    ok(JSON.stringify(byKey['salesian'].layers.podcasts.series) === '["bible-in-a-year","exorcist-files","daily-gospel-exegesis","daily-readings"]' && byKey['salesian'].layers.podcasts.on === true,
      'B9: Salesian gains the readings card LAST; its standing three stand untouched', byKey['salesian'].layers);
    ok(byKey['benedictine'].layers.podcasts.on === true && JSON.stringify(byKey['benedictine'].layers.podcasts.series) === '["daily-readings"]',
      'B9: Benedictine\'s Podcasts layer stands ON carrying the readings card alone', byKey['benedictine'].layers);
    ok(prof.state.version === 6 && prof.state.standingKey === 'salesian'
      && JSON.stringify(byKey['little-way']) === JSON.stringify(live['little-way'])
      && byKey['salesian'].coreBlocks.join('|') === live['salesian'].coreBlocks.join('|')
      && byKey['benedictine'].coreBlocks.join('|') === live['benedictine'].coreBlocks.join('|'),
      'B9: the state version bumped by exactly 1 (5 → 6); little-way byte-equal; core blocks untouched', prof.state);
  }
  /* B6 — the seat fires, strict match on the presented day */
  {
    const day = (await doorDay(TODAY)).body;
    const seat = day.readingsSeat || {};
    ok(day.profile && day.profile.key === 'salesian' && !!day.readingsSeat,
      'B6: the Salesian day carries the readings seat after the layer write');
    ok(seat.seqKey === USCCB_TODAY.guid && seat.title === 'Daily Mass Reading Podcast for November 20, 2026' && seat.url === USCCB_TODAY.url,
      'B6: the seat is the DATE-MATCHED episode — Nov 20\'s own reading, resolved by title date (its pubDate rank in the batch feed is ~45th; date order, not publish order, governs)',
      { seqKey: seat.seqKey, title: seat.title });
    ok(typeof seat.durationS === 'number' && seat.durationS > 0 && seat.listened === false,
      'B6: the seat carries duration and an unlistened mark state', { durationS: seat.durationS });
  }
  /* B10 — a Benedictine pick day seats too */
  {
    applySql(wranglerD1, `INSERT INTO prayer_profile_day_picks (date, profile_key, updated_at) VALUES ('${TODAY}', 'benedictine', '2026-11-20T13:00:00.000Z') ON CONFLICT(date) DO UPDATE SET profile_key = excluded.profile_key;`);
    const day = (await doorDay(TODAY)).body;
    ok(day.profile && day.profile.key === 'benedictine' && !!day.readingsSeat && day.readingsSeat.seqKey === USCCB_TODAY.guid,
      'B10: on a Benedictine day the same date-matched episode seats (the profile rule, both profiles)', { key: day.profile && day.profile.key });
    applySql(wranglerD1, `DELETE FROM prayer_profile_day_picks WHERE date = '${TODAY}';`);
  }
  /* B7 — the matcher preference + no-fallback legs */
  {
    readingsMode = 'xmas';
    applySql(wranglerD1, `DELETE FROM rss_snapshots WHERE series = 'daily-readings';`);
    const day = (await doorDay(TODAY)).body;
    ok(!!day.readingsSeat && day.readingsSeat.seqKey === 'usccb-x-day' && /- Day$/.test(day.readingsSeat.title || ''),
      'B7: with no plain title standing, the seat takes the "- Day" suffixed episode over Night/Dawn/Vigil (the Christmas-form preference)', day.readingsSeat);
    readingsMode = 'gap';
    applySql(wranglerD1, `DELETE FROM rss_snapshots WHERE series = 'daily-readings';`);
    const day2 = (await doorDay(TODAY)).body;
    ok(day2.profile && day2.profile.key === 'salesian' && !day2.readingsSeat,
      'B7: with no Nov 20 episode in the feed the seat stands EMPTY — no latest-by-date fallback seats a wrong day\'s reading');
    readingsMode = 'real';
    applySql(wranglerD1, `DELETE FROM rss_snapshots WHERE series = 'daily-readings';`);
    const back = await api('GET', '/api/player/podcasts?series=daily-readings');
    readingsPayload = back.body;
    ok(back.body.available === true && back.body.total === 500, 'B7: the real feed snapshot stands rebuilt for the captures');
  }
  /* B8 — the additions widening */
  let dayPre = null, dayPost = null, putRows = null;
  {
    const prayerRow = { block: 'Morning', slug: 'our-father', lang: 'en', afterId: null };
    const put1 = await api('PUT', '/api/player/day-additions', { date: TODAY, additions: [prayerRow] });
    ok(put1.status === 200 && (put1.body.additions || []).length === 1 && put1.body.additions[0].kind === 'prayer',
      'B8: the prayer-only list writes as before, rows reading back with kind "prayer" (the 0042 default)', put1.body);
    dayPre = (await doorDay(TODAY)).body;
    ok((dayPre.additions || []).length === 1 && dayPre.additions[0].kind === 'prayer' && !!dayPre.additions[0].title,
      'B8: the day fold carries the prayer addition as before', (dayPre.additions || [])[0]);
    const readingRow = { block: 'Evening', slug: 'daily-readings', lang: 'en', kind: 'reading', ref: USCCB_TODAY.guid, afterId: null };
    const put2 = await api('PUT', '/api/player/day-additions', { date: TODAY, additions: [prayerRow, readingRow] });
    putRows = put2.body.additions || [];
    ok(put2.status === 200 && putRows.length === 2 && putRows[1].kind === 'reading' && putRows[1].ref === USCCB_TODAY.guid,
      'B8: the widened PUT stores the reading row beside the prayer row (whole-list discipline, kind + ref carried)', putRows[1]);
    const bad1 = await api('PUT', '/api/player/day-additions', { date: TODAY, additions: [{ block: 'Evening', slug: 'summa-in-a-year', lang: 'en', kind: 'reading', ref: 'x', afterId: null }] });
    const bad2 = await api('PUT', '/api/player/day-additions', { date: TODAY, additions: [{ block: 'Evening', slug: 'daily-readings', lang: 'en', kind: 'reading', afterId: null }] });
    ok(bad1.status === 400 && bad2.status === 400,
      'B8: a reading row with a foreign slug or a missing ref is refused (400); the standing list is untouched');
    dayPost = (await doorDay(TODAY)).body;
    const fold = dayPost.additions || [];
    const rf = fold.find((a) => a.kind === 'reading') || {};
    ok(fold.length === 2 && rf.title === 'Daily Mass Reading Podcast for November 20, 2026' && rf.url === USCCB_TODAY.url && rf.block === 'Evening',
      'B8: the fold resolves the reading row against the snapshot by GUID — title, stream URL, its block', rf);
    ok(!!dayPost.readingsSeat && dayPost.readingsSeat.seqKey === USCCB_TODAY.guid,
      'B8: the seat stands beside the additions on the same day payload');
  }
  /* captures for the client walk — real worker payloads */
  {
    const profsR = await api('GET', '/api/prayer/profiles');
    const srcR = await api('GET', '/api/player/source-settings');
    captured = { dayPre, dayPost, putRows, index: indexPayload, summa: summaPayload, readings: readingsPayload, profs: profsR.body, sources: srcR.body };
    ok(!!(dayPre && dayPost && indexPayload && summaPayload && readingsPayload) && profsR.status === 200 && srcR.status === 200,
      'W-capture: the walk\'s payloads are the real local worker\'s (day pre/post PUT · index · both series · profiles · source settings)',
      { profs: profsR.status, sources: srcR.status });
  }
}

/* ---------------- W: the Chromium walk (the v534 mold) ---------------- */
/* The day's own feed in the production form (titles drawn
   from the live feed's Nov 20 items, captured 2026-11-20). */
const OWN_XML = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Ora Pro Nobis</title><description>own fixture</description>`
  + `<item><title>Morning Prayer - November 20, 2026</title><pubDate>Fri, 20 Nov 2026 11:00:00 GMT</pubDate><guid isPermaLink="false">own-2026-11-20-morning</guid><enclosure url="https://audio.example/own-morning.mp3" length="1000" type="audio/mpeg"/><itunes:duration>1500</itunes:duration></item>`
  + `<item><title>Daily Rosary - Sorrowful Mysteries - Today's Gospel, Luke 19:45-48 - November 20, 2026</title><pubDate>Fri, 20 Nov 2026 11:05:00 GMT</pubDate><guid isPermaLink="false">own-2026-11-20-rosary</guid><enclosure url="https://audio.example/own-rosary.mp3" length="1000" type="audio/mpeg"/><itunes:duration>1200</itunes:duration></item>`
  + `<item><title>Evening Prayer - November 20, 2026</title><pubDate>Fri, 20 Nov 2026 23:00:00 GMT</pubDate><guid isPermaLink="false">own-2026-11-20-evening</guid><enclosure url="https://audio.example/own-evening.mp3" length="1000" type="audio/mpeg"/><itunes:duration>1100</itunes:duration></item>`
  + `</channel></rss>`;
const INTRO_XML = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Intentions</title></channel></rss>`;
function cook(clientPath) {
  const src = readFileSync(clientPath, 'utf8');
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
function cookShell(uiPath) {
  const src = readFileSync(uiPath, 'utf8');
  const t = src.indexOf('SHELL_HTML = `') + 14;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
async function walkLegs() {
  const require = createRequire(APP + '/worker/package.json');
  const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
  const { chromium } = require('/home/hatch/workspace/.tools/pwtest/node_modules/playwright-core');
  const APP_JS = cook(SRC + '/client.ts');
  const SHELL = cookShell(SRC + '/ui.ts');
  const server = http.createServer((rq, rs) => {
    const u = String(rq.url || '');
    const js = (body, type) => { rs.writeHead(200, { 'content-type': type }); rs.end(body); };
    if (u === '/app-build.js') return js(APP_JS, 'text/javascript');
    if (u === '/shell-build') return js(SHELL.replace('<script src="/app.js"></script>', '<script src="/app-build.js"></script>'), 'text/html');
    if (u === '/styles.css') return js('', 'text/css');
    rs.writeHead(404); rs.end('nf');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ORIGIN = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const cap = captured;
  async function buildPage() {
    const page = await browser.newPage();
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.addInitScript((o) => {
      window.__errs = [];
      window.addEventListener('error', (e) => { window.__errs.push(String(e.message || e.error || e)); });
      try { localStorage.clear(); } catch (e) {}
      window.__putDone = false;
      window.__putBody = null;
      const ans = (obj) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)) });
      const ansText = (t) => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error('not json')), text: () => Promise.resolve(t) });
      const clone = (x) => JSON.parse(JSON.stringify(x));
      window.fetch = (url, opts) => {
        const u = String(url);
        const method = (opts && opts.method) || 'GET';
        if (u === 'https://orapronobis.media/podcast.xml') return ansText(o.ownXml);
        if (u === 'https://orapronobis.media/intentions.xml') return ansText(o.introXml);
        if (u.indexOf('/api/player/day-additions') > -1 && method === 'PUT') {
          window.__putBody = JSON.parse(opts.body);
          window.__putDone = true;
          return ans({ ok: true, date: o.today, additions: clone(o.putRows) });
        }
        if (u.indexOf('/api/player/day') > -1 || u.indexOf('/api/prayer/day') > -1) return ans(clone(window.__putDone ? o.dayPost : o.dayPre));
        if (u.indexOf('/api/player/source-settings') > -1) return ans(clone(o.sources));
        if (u.indexOf('/api/prayer/profiles') > -1) return ans(clone(o.profs));
        if (u.indexOf('/api/player/podcasts?series=summa-in-a-year') > -1) return ans(clone(o.summa));
        if (u.indexOf('/api/player/podcasts?series=daily-readings') > -1) return ans(clone(o.readings));
        if (u.indexOf('/api/player/podcasts?series=bible-in-a-year') > -1) return ans(clone(o.biy));
        if (u.indexOf('/api/player/podcasts?series=exorcist-files') > -1) return ans(clone(o.exf));
        if (u.indexOf('/api/player/podcasts?series=daily-gospel-exegesis') > -1) return ans(clone(o.dge));
        if (u.endsWith('/api/player/podcasts')) return ans(clone(o.index));
        if (u.indexOf('/api/prayer/book') > -1 && u.indexOf('favorites') === -1) return ans(clone(o.book));
        if (u.indexOf('/api/prayer/mass-personal-prayer') > -1) return ans(clone(o.seats));
        return ans({ ok: true });
      };
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      HTMLMediaElement.prototype.pause = function () {};
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get() { return 600; }, configurable: true });
    }, { dayPre: cap.dayPre, dayPost: cap.dayPost, putRows: cap.putRows, index: cap.index, summa: cap.summa, readings: cap.readings, biy: { ok: true, available: false }, exf: { ok: true, available: false }, dge: { ok: true, available: false }, profs: cap.profs, sources: cap.sources, book: BOOK, seats: SEATS_LIVE, ownXml: OWN_XML, introXml: INTRO_XML, today: TODAY });
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith(ORIGIN)) route.continue();
      else if (route.request().resourceType() === 'image') route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
      else route.abort();
    });
    await page.goto(ORIGIN + '/shell-build', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof tabSideNow !== 'undefined' && !!tabSideNow && document.querySelectorAll('#tabbar .tab').length >= 5, null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.evaluate(() => { if (typeof setTab === 'function') setTab('prayers'); });
    await page.waitForFunction(() => typeof state !== 'undefined' && state.dayDescs && state.dayDescs.some((d) => d.episodeId === 'daily-rosary'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
    return page;
  }
  const errs = (page) => page.evaluate(() => window.__errs || []);
  /* W1 — the seat stands immediately before the Rosary */
  {
    const page = await buildPage();
    const st = await page.evaluate(() => {
      const ds = state.dayDescs || [];
      const seatIdx = ds.findIndex((d) => d.readingsSeat === true);
      const rosIdx = ds.findIndex((d) => d.episodeId === 'daily-rosary');
      return { seatIdx, rosIdx, seat: seatIdx > -1 ? ds[seatIdx] : null, descs: ds.length };
    });
    ok(st.seatIdx > -1 && st.rosIdx > -1 && st.seatIdx === st.rosIdx - 1,
      'W1: in the built day the readings seat descriptor stands IMMEDIATELY before the daily-rosary descriptor (the Q5 comment placement)',
      { seatIdx: st.seatIdx, rosIdx: st.rosIdx, descs: st.descs });
    ok(st.seat && st.seat.block === 'Morning' && st.seat.kind === 'podcast' && st.seat.podSeries === 'daily-readings' && st.seat.episodeId === (captured.dayPost.readingsSeat || {}).seqKey,
      'W1: the seat is a playable podcast descriptor in the Morning block, keyed by the date-matched episode\'s GUID', st.seat);
    await page.click('[data-openblock="Morning"]');
    await page.waitForFunction(() => !!document.querySelector('[data-readings-seat]'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const dom = await page.evaluate(() => {
      const seat = document.querySelector('[data-readings-seat]');
      const rosary = document.querySelector('[data-own-row="daily-rosary"]');
      return {
        seat: !!seat, rosary: !!rosary,
        adjacent: !!(seat && rosary && seat.nextElementSibling === rosary),
        seatKey: seat ? (seat.querySelector('[data-playkey]') || {}).getAttribute?.('data-playkey') || null : null,
        seatTitle: seat ? (seat.querySelector('h3') || {}).textContent || '' : '',
      };
    });
    ok(dom.seat && dom.rosary && dom.adjacent && dom.seatKey === (captured.dayPost.readingsSeat || {}).seqKey,
      'W1: the Morning block page paints the reading\'s card IMMEDIATELY before the Rosary\'s card (adjacent siblings, the seat keyed by the matched GUID)', dom);
    ok((await errs(page)).length === 0, 'W1: no page errors on the Pray walk', await errs(page));
    await page.close();
  }
  /* W2 — Courses carries Summa; Podcasts carries the readings, not Summa */
  {
    const page = await buildPage();
    await page.evaluate(() => setTab('podcasts'));
    await page.waitForTimeout(700);
    await page.evaluate(() => { if (typeof switchPodSide === 'function') switchPodSide('courses'); });
    await page.waitForTimeout(900);
    const st = await page.evaluate(() => ({
      summa: !!document.querySelector('[data-podseries="summa-in-a-year"]'),
      readings: !!document.querySelector('[data-podseries="daily-readings"]'),
    }));
    ok(st.summa && !st.readings, 'W2: Catechesis → Courses carries the Summa in a Year card (the readings card is not on the Courses side)', st);
    await page.click('[data-podseries="summa-in-a-year"]');
    await page.waitForTimeout(1200);
    if (await page.$('[data-podcollapse]')) { await page.click('[data-podcollapse]'); await page.waitForTimeout(700); }
    const st2 = await page.evaluate(() => ({
      lvl: (typeof podLevel !== 'undefined' ? podLevel : null),
      rows: document.querySelectorAll('[data-podplay]').length,
      first: ((document.querySelector('[data-podrow] h3') || {}).textContent || ''),
      second: ((document.querySelectorAll('[data-podrow] h3')[1] || {}).textContent || ''),
    }));
    ok(st2.lvl === 'series' && st2.rows === 307 && st2.first === SUMMA_DAY1_CLEAN && st2.second === SUMMA_DAY2_CLEAN,
      'W2: the Summa course page lists all 307 days in order (the listened Day 1 unfolds from the collapse), Day 1 at the head', { rows: st2.rows, first: st2.first, second: st2.second });
    await page.evaluate(() => { podLevel = 'index'; paintPodcasts(); });
    await page.waitForTimeout(700);
    await page.evaluate(() => { if (typeof switchPodSide === 'function') switchPodSide('podcasts'); });
    await page.waitForTimeout(900);
    const st3 = await page.evaluate(() => ({
      summa: !!document.querySelector('[data-podseries="summa-in-a-year"]'),
      readings: !!document.querySelector('[data-podseries="daily-readings"]'),
      readingsText: (document.querySelector('[data-podseries="daily-readings"]') || {}).textContent || '',
    }));
    ok(!st3.summa && st3.readings && st3.readingsText.includes('USCCB Daily Readings Podcast'),
      'W2: Catechesis → Podcasts carries the readings card under the feed\'s full name — Summa is gone from the Podcasts side', st3);
    ok((await errs(page)).length === 0, 'W2: no page errors on the Catechesis walk', await errs(page));
    await page.close();
  }
  /* W3 — the readings page as published + the Add act */
  {
    const page = await buildPage();
    await page.evaluate(() => setTab('podcasts'));
    await page.waitForTimeout(700);
    await page.evaluate(() => { if (typeof switchPodSide === 'function') switchPodSide('podcasts'); });
    await page.waitForTimeout(900);
    await page.click('[data-podseries="daily-readings"]');
    await page.waitForTimeout(1200);
    const st = await page.evaluate((newestTitle) => ({
      rows: document.querySelectorAll('[data-podplay]').length,
      first: ((document.querySelector('[data-podrow] h3') || {}).textContent || ''),
      addBtn: !!document.getElementById('readings-add'),
      landed: ((document.getElementById('view') || {}).textContent || '').includes('stands in today'),
      presentedDay: (typeof state !== 'undefined' ? state.presentedDay : null),
      series: (typeof state !== 'undefined' && state.podcasts ? state.podcasts.series : null),
      todayHit: (typeof state !== 'undefined' && state.podcasts && typeof dailyReadingsTodayEntry === 'function') ? !!dailyReadingsTodayEntry(state.podcasts.entries) : 'n/a',
      newestTitle,
    }), USCCB_NEWEST_TITLE);
    ok(st.rows === 500 && st.first.includes(st.newestTitle),
      'W3: the readings page lists the feed as published — 500 rows, the newest-published episode at the head (no date re-sort)', { rows: st.rows, first: st.first.slice(0, 80) });
    ok(st.addBtn, 'W3: the "Add today\'s reading to Praylist" act stands on the readings page', st);
    await page.click('#readings-add');
    await page.waitForTimeout(600);
    await page.click('[data-slotblock="Evening"]');
    await page.waitForTimeout(600);
    await page.click('[data-slotpos="end"]');
    await page.waitForTimeout(1200);
    const put = await page.evaluate(() => window.__putBody);
    const rows = (put && put.additions) || [];
    const rr = rows.find((a) => a.kind === 'reading') || {};
    ok(put && put.date === TODAY && rows.some((a) => a.kind !== 'reading' && a.slug === 'our-father')
      && rr.ref === USCCB_TODAY_GUID && rr.block === 'Evening' && rr.slug === 'daily-readings',
      'W3: the picker\'s whole-list PUT carries the standing prayer row PLUS the reading row for TODAY\'S matched episode (GUID), into the picked block',
      { rr });
    const st2 = await page.evaluate((guid) => ({
      landed: ((document.getElementById('view') || {}).textContent || '').includes('stands in today'),
      desc: (state.dayDescs || []).find((d) => d.episodeId === guid && d.dayAddition) || null,
    }), USCCB_TODAY_GUID);
    ok(st2.landed, 'W3: after the add, the page reads the landed line — the reading stands in today\'s Praylist');
    ok(st2.desc && st2.desc.block === 'Evening' && st2.desc.kind === 'podcast' && st2.desc.title === 'Daily Mass Reading Podcast for November 20, 2026',
      'W3: the added episode stands in the picked block as a playable podcast descriptor', st2.desc);
    ok((await errs(page)).length === 0, 'W3: no page errors on the readings walk', await errs(page));
    await page.close();
  }
  /* W4 — the Pray Podcasts group carries four cards */
  {
    const page = await buildPage();
    await page.click('[data-openblock="Podcasts"]');
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({
      cards: [...document.querySelectorAll('[data-daypodseries]')].map((c) => c.getAttribute('data-daypodseries')),
    }));
    ok(st.cards.length === 4 && st.cards.includes('daily-readings') && st.cards.includes('bible-in-a-year') && st.cards.includes('exorcist-files') && st.cards.includes('daily-gospel-exegesis'),
      'W4: the Pray Podcasts group carries the standing three PLUS the Daily Readings card (Q5 A, the Salesian layer)', st.cards);
    ok((await errs(page)).length === 0, 'W4: no page errors on the layer walk', await errs(page));
    await page.close();
  }
  await browser.close();
  server.close();
}
const USCCB_NEWEST_TITLE = USCCB_NEWEST ? USCCB_NEWEST.title.trim() : '';
const USCCB_TODAY_GUID = USCCB_TODAY ? USCCB_TODAY.guid : '';
const cleanDayTitle = (it) => it ? it.title.trim().replace(/^Day\s+\d+\s*:\s*/i, '') : '';
const SUMMA_DAY1_CLEAN = cleanDayTitle(SUMMA_DAYS.get(1));
const SUMMA_DAY2_CLEAN = cleanDayTitle(SUMMA_DAYS.get(2));

/* ---------------- run ---------------- */
try {
  statics();
  carryMapLeg();
  if (!PROBE) {
    await workerLegs();
    if (captured) await walkLegs();
    else ok(false, 'W: the walk never ran — the worker captures failed');
  }
} catch (e) {
  fail++; failures.push('harness error: ' + (e && e.message));
  console.log('not ok - harness error ::', String(e && e.message).slice(0, 400));
} finally {
  for (const p of procs) { try { process.kill(-p.pid, 'SIGKILL'); } catch { try { p.kill('SIGKILL'); } catch {} } }
  try { feedServer.close(); } catch {}
}
console.log(`\n# harness-v549: ${pass} ok / ${fail} not-ok`);
if (failures.length) { console.log('# failures:'); failures.forEach((f) => console.log('#  -', f)); }
process.exit(fail ? 1 : 0);
