// harness-v536.mjs — v536 evidence: Daily Gospel Exegesis
// (Logical Bible Study) joins the app as an RSS podcast
// series and as a Podcasts-layer entry on John's profile.
// Built to the v536 release document §2.
//   S statics: the one registry line stands in
//     POD_RSS_SERIES_LIST with the standing EXT_DGE_FEED_URL
//     seam · the day build's own ext-gospel-exegesis leg is
//     byte-unchanged · client.ts byte-identical to the base
//     ship · ui.ts identical outside the pin · migrations
//     still end at 0039 · the fixtures stand
//   B worker (local wrangler, fixture D1 seeded with the
//     LIVE profile store): B1 a cold series read builds the
//     snapshot from the REAL captured feed — the 522-item
//     feed windows to exactly 50, entries[0] is the captured
//     newest (today's Gospel, Luke 19: 11-28), one fetch ·
//     B2 the Podcasts index carries the new series with its
//     real art + total beside the four standing RSS series
//   L layers (the app's own routes): L1 the layers PUT on
//     salesian adding daily-gospel-exegesis answers 200 and
//     the fold carries all three series, everything else
//     byte-preserved, version +1 · L2 the SAME PUT on the
//     BASE code answers the named 400 (bad series) — the
//     one line is what admits the key · L3 the act lands on
//     a non-standing profile (little-way) and its picked day
//     composes with the series · L4 a profile without the
//     pick (benedictine) never carries it
//   W client (Chromium, the v534 mold; fetch stubbed with
//     payloads CAPTURED FROM THE REAL LOCAL WORKER in the
//     B/L legs): the Pray Podcasts group carries three
//     series entries incl. the new one · Catechesis →
//     Podcasts shows its card with the real channel art ·
//     its series page lists the real episodes, newest
//     standing current · the profile editor's picker lists
//     it (any-profile availability, part 3)
// Fixtures (Improvement D), under tests/fixtures-v536/:
//   (a) feeds-dge-2026-11-18.xml — the LIVE Daily Gospel
//     Exegesis RSS feed captured 2026-11-18 (sha256
//     27adc221b78f30b8db740aab428be27c5f8c13cbc61a8672e01f3
//     e41add8c14f; 522 items; newest = Wednesday of Week 33
//     in Ordinary Time — Luke 19: 11-28, the current day's
//     Gospel); expectations are DERIVED from this capture.
//   (b) profiles-live-2026-11-18.json — the live profiles
//     door read of 2026-11-18 (the three defaults; John's
//     salesian Podcasts layer on [bible-in-a-year,
//     exorcist-files]; state version 4).
//   (c) mass-seats-live-2026-11-18.json — the live Mass
//     personal-prayer seats read (ship-time preservation
//     reference; the walk's stub seat surface).
//   The standing series' feeds ride small synthetic
//   fixtures in the v500 form (their shapes are not what
//   this release proves).
// The base for byte comparisons + the L2 instance is the
// v534 ship tree (H536_BASE overrides).
// Run: node app/tests/harness-v536.mjs [--probe]
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
const BASE_APP = process.env.H536_BASE || path.resolve(ROOT, '../v534-ship/app');
const BASE_SRC = BASE_APP + '/worker/src';
const FX = APP + '/tests/fixtures-v536';
const DGE_XML = readFileSync(FX + '/feeds-dge-2026-11-18.xml', 'utf8');
const PROFILES_LIVE = JSON.parse(readFileSync(FX + '/profiles-live-2026-11-18.json', 'utf8'));
const SEATS_LIVE = JSON.parse(readFileSync(FX + '/mass-seats-live-2026-11-18.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TODAY = '2026-11-18';

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 300) : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 300) : ''); }
}

/* ---- expectations derived from the captured live feed ---- */
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
    out.push({ guid: g ? xmlText(g[1]) : null, title: t ? xmlText(t[1]) : '', pubMs: p ? Date.parse(p[1].trim()) : null, durationS: durS, url: enc ? enc[1] : '', itemImage: img ? img[1] : null });
  }
  return out;
}
function channelImage(xml) {
  const head = xml.slice(0, xml.indexOf('<item'));
  const m = /<itunes:image[^>]*href="([^"]*)"/.exec(head) || /<image>[\s\S]*?<url>([^<]*)<\/url>/.exec(head);
  return m ? m[1] : null;
}
const DGE_ITEMS = parseItems(DGE_XML);
const DGE_SORTED = [...DGE_ITEMS].filter((x) => x.url).sort((a, b) => (b.pubMs ?? -Infinity) - (a.pubMs ?? -Infinity));
const DGE_NEWEST = DGE_SORTED[0];
const DGE_ART = channelImage(DGE_XML);
const DGE_COUNT = DGE_ITEMS.length;

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
  rssItemS('Case 3: Third', 'exf-g3', 'exf3.mp3', 'Wed, 11 Nov 2026 08:00:00 GMT', 3400),
]);
const CT_XML = rssFeedS('The Counsel of Trent', 'https://img.example/ct-show.jpg', [
  rssItemS('#1226: Counsel First', 'ct-g1', 'ct1.mp3', 'Fri, 13 Nov 2026 13:01:04 GMT', 1500),
  rssItemS('#1225: Counsel Second', 'ct-g2', 'ct2.mp3', 'Wed, 11 Nov 2026 13:01:04 GMT', 1501),
]);
const FM_XML = rssFeedS('Sunday Homilies with Fr. Mike Schmitz', 'https://img.example/fm-show.jpg', [
  rssItemS('Homily First', 'fm-g1', 'fm1.mp3', 'Sun, 15 Nov 2026 12:00:00 GMT', 1200),
  rssItemS('Homily Second', 'fm-g2', 'fm2.mp3', 'Sun, 08 Nov 2026 12:00:00 GMT', 1201),
]);
const BR_XML = rssFeedS("Bishop Barron's Sunday Sermons", 'https://img.example/br-show.jpg', [
  rssItemS('Sermon First', 'br-g1', 'br1.mp3', 'Sun, 15 Nov 2026 12:00:00 GMT', 900),
  rssItemS('Sermon Second', 'br-g2', 'br2.mp3', 'Sun, 08 Nov 2026 12:00:00 GMT', 901),
]);
function dayItem(day, title, file, pub) {
  return `<item><title>Day ${day}: ${title}</title><pubDate>${pub}</pubDate>`
    + `<enclosure url="https://audio.example/${file}" length="1000" type="audio/mpeg"/><description>${title} description</description></item>`;
}
const BIY_XML = rssFeedS('Bible in a Year', 'https://img.example/biy-show.jpg', [
  dayItem(1, 'In the Beginning', 'biy-day1.mp3', 'Mon, 05 Jan 2026 12:00:00 GMT'),
  dayItem(2, 'The Patriarchs', 'biy-day2.mp3', 'Tue, 06 Jan 2026 12:00:00 GMT'),
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

let dgeFetches = 0;
const feedServer = http.createServer((rq, rs) => {
  const u = rq.url || '';
  const send = (body, ct) => { rs.writeHead(200, { 'content-type': ct }); rs.end(body); };
  if (u.startsWith('/dge.xml')) { dgeFetches++; return send(DGE_XML, 'application/rss+xml'); }
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
const PORT = 8981, BASEPORT = 8982, FEEDPORT = 8983;
const BASE = 'http://127.0.0.1:' + PORT, BASEAPP_URL = 'http://127.0.0.1:' + BASEPORT;
const PERSIST = path.join(APP, '.wrangler-test-v536');
const BASE_PERSIST = path.join(BASE_APP, '.wrangler-test-v536-base');
const TOKEN = 'harness-v536-token';
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'h536-'));
function d1Fn(appDir, persist) {
  return (args) => execFileSync(WRANGLER, ['d1', 'execute', 'ora-pro-nobis-app', '--local', '--config', path.join(appDir, 'wrangler.toml'), '--persist-to', persist, ...args],
    { cwd: appDir, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } }).toString();
}
const wranglerD1 = d1Fn(APP, PERSIST);
const wranglerD1Base = d1Fn(BASE_APP, BASE_PERSIST);
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
const api = req(BASE), apiBase = req(BASEAPP_URL);
const AGENT = { authorization: 'Bearer ' + TOKEN };
const doorProfiles = (base, date) => (base === BASE ? api : apiBase)('GET', '/api/agent/prayer/profiles' + (date ? '?date=' + date : ''), undefined, AGENT);
const doorDay = (base, date) => (base === BASE ? api : apiBase)('GET', '/api/agent/player/day?date=' + date, undefined, AGENT);
const sessDay = (base, date) => (base === BASE ? api : apiBase)('GET', '/api/player/day?date=' + date);
const byKeyOf = (b) => { const m = {}; (b.profiles || []).forEach((p) => { m[p.key] = p; }); return m; };
const LIVE_SHAPE_SQL = `UPDATE prayer_profiles SET layers = '{"novenas":{"on":1},"podcasts":{"on":1,"series":["bible-in-a-year","exorcist-files"]}}' WHERE key = 'salesian';
UPDATE prayer_profile_state SET version = 4 WHERE id = 1;`;

/* ---------------- S: statics ---------------- */
function statics() {
  ok(I_SRC.includes('{ key: "daily-gospel-exegesis", title: "Daily Gospel Exegesis", feedUrl: (env) => env.EXT_DGE_FEED_URL || EXT_DGE_FEED_URL }'),
    'S1: the registry line stands in POD_RSS_SERIES_LIST (key daily-gospel-exegesis, the standing EXT_DGE_FEED_URL seam)');
  const listAt = I_SRC.indexOf('POD_RSS_SERIES_LIST: PodRssSeriesDef[]');
  const order = ['exorcist-files', 'counsel-of-trent', 'fr-mike-homilies', 'barron-sunday-sermons', 'daily-gospel-exegesis'].map((k) => I_SRC.indexOf(`key: "${k}"`, listAt));
  ok(order.every((x) => x > listAt) && order.every((x, i) => i === 0 || x > order[i - 1]),
    'S2: the registry order is the standing four, then daily-gospel-exegesis appended');
  ok(I_SRC.includes('const EXT_DGE_FEED_URL = "https://anchor.fm/s/1025ef1c/podcast/rss";')
    && I_SRC.includes('EXT_DGE_FEED_URL?: string')
    && (I_SRC.match(/extMatchLatestByDate\(await extFetchFeedItems\(env\.EXT_DGE_FEED_URL \|\| EXT_DGE_FEED_URL\)/g) || []).length === 1
    && I_SRC.includes('"ext-gospel-exegesis": "Midmorning"'),
    'S3: the day build\u2019s own DGE leg stands unchanged (the constant, the Env binding, the Midmorning slot, the date-bounded matcher)');
  const migs = readdirSync(APP + '/migrations').filter((x) => x.endsWith('.sql')).sort();
  ok(migs[migs.length - 1] === '0039_mass_universal_prayer.sql',
    'S4: no new migration — the newest stands at 0039 (the rss_snapshots store of 0027 carries the series)', migs[migs.length - 1]);
  if (existsSync(BASE_SRC)) {
    ok(C_SRC === readFileSync(BASE_SRC + '/client.ts', 'utf8'),
      'S5: client.ts is byte-identical to the base ship (no client change)');
    const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
    ok(pin(U_SRC) === pin(readFileSync(BASE_SRC + '/ui.ts', 'utf8')),
      'S6: ui.ts is identical to the base ship outside the SW pin line');
    let d = '';
    try { execFileSync('diff', ['-U0', BASE_SRC + '/index.ts', SRC + '/index.ts'], { encoding: 'utf8' }); }
    catch (e) { d = (e.stdout || '').toString(); }
    const removed = d.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));
    ok(removed.length === 0, 'S7: index.ts\u2019s diff vs the base is purely additive (0 removed lines)', removed.slice(0, 3));
  } else {
    ok(true, 'S5-S7: base tree absent in this context — diff statics skipped (recorded, not a pass on the legs)');
  }
  const byKey = byKeyOf(PROFILES_LIVE);
  ok(['little-way', 'salesian', 'benedictine'].every((k) => byKey[k] && byKey[k].kind === 'default')
    && byKey['salesian'].layers.podcasts.on === true
    && JSON.stringify(byKey['salesian'].layers.podcasts.series) === '["bible-in-a-year","exorcist-files"]'
    && PROFILES_LIVE.state && PROFILES_LIVE.state.version === 4 && PROFILES_LIVE.state.standingKey === 'salesian',
    'S8: the profiles fixture stands (the live draw: three defaults, salesian podcasts [bible-in-a-year, exorcist-files], state v4)');
  ok(DGE_COUNT === 522 && DGE_NEWEST && DGE_NEWEST.title.includes('Luke 19: 11-28') && DGE_NEWEST.durationS > 0 && !!DGE_ART,
    `S9: the captured live feed stands (522 items; newest "${DGE_NEWEST && DGE_NEWEST.title}" · ${DGE_NEWEST && DGE_NEWEST.durationS}s · channel art present)`,
    { count: DGE_COUNT, newest: DGE_NEWEST && DGE_NEWEST.title, art: DGE_ART });
}

/* ---------------- the worker legs ---------------- */
let captured = null;
async function workerLegs() {
  await new Promise((r) => feedServer.listen(FEEDPORT, '127.0.0.1', r));
  for (const p of [PORT, BASEPORT]) { try { execFileSync('fuser', ['-k', p + '/tcp'], { stdio: 'ignore' }); } catch { /* free */ } }
  applyMigrations(APP, PERSIST, wranglerD1);
  startApp(APP, PERSIST, PORT);
  ok(await waitUp(BASE), 'W0: build app up on local wrangler (LOCAL_DEV), D1 through 0039');
  applySql(wranglerD1, LIVE_SHAPE_SQL);
  {
    const prof = (await doorProfiles(BASE)).body;
    ok(JSON.stringify(prof.profiles) === JSON.stringify(PROFILES_LIVE.profiles)
      && JSON.stringify(prof.state) === JSON.stringify(PROFILES_LIVE.state),
      'W1: the seeded local store matches the live profiles shape byte-for-byte', prof.state);
  }
  /* B1 — the cold series build from the real feed */
  let dgePayload = null;
  {
    const f0 = dgeFetches; const t0 = Date.now();
    const r = await api('GET', '/api/player/podcasts?series=daily-gospel-exegesis');
    const ms = Date.now() - t0;
    dgePayload = r.body;
    const e0 = (r.body.entries || [])[0] || {};
    ok(r.status === 200 && r.body.kind === 'rss' && r.body.available === true && r.body.stale === false,
      'B1: a cold read builds the Daily Gospel Exegesis snapshot from the real feed (kind rss, available, not stale)', { status: r.status, ms });
    ok(dgeFetches - f0 === 1, `B1: the cold build fetched the feed exactly once (${dgeFetches - f0}) in ${ms} ms (the 3.1 MB / 522-item parse, timed and named)`);
    ok(r.body.total === 50 && (r.body.entries || []).length === 50,
      `B1: the ${DGE_COUNT}-item feed stores exactly the latest 50 (total ${r.body.total})`);
    ok(e0.title === DGE_NEWEST.title && e0.durationS === DGE_NEWEST.durationS && r.body.currentKey === e0.key,
      'B1: entries[0] is the captured newest — today\u2019s Gospel exegesis — with its real duration, standing as current',
      { title: e0.title, durationS: e0.durationS });
    ok(r.body.showImageUrl === DGE_ART && e0.imageUrl === DGE_NEWEST.itemImage,
      'B1: the series art is the feed\u2019s real channel art; the newest entry carries its own real episode art from the feed', { show: r.body.showImageUrl, entry: e0.imageUrl });
    const r2 = await api('GET', '/api/player/podcasts?series=daily-gospel-exegesis');
    ok(dgeFetches - f0 === 1 && r2.body.available === true,
      'B1: a second read serves the standing snapshot (no refetch inside the 2 h window)');
  }
  /* B2 — the index */
  let indexPayload = null;
  {
    const r = await api('GET', '/api/player/podcasts');
    indexPayload = r.body;
    const list = r.body.seriesList || [];
    const bySeries = {}; list.forEach((s) => { bySeries[s.series] = s; });
    const dge = bySeries['daily-gospel-exegesis'] || {};
    ok(dge.kind === 'rss' && dge.available === true && dge.total === 50 && dge.showImageUrl === DGE_ART && !!dge.latestLabel,
      'B2: the Podcasts index carries Daily Gospel Exegesis (kind rss, available, total 50, real art, latest label standing)', dge);
    ok(['exorcist-files', 'counsel-of-trent', 'fr-mike-homilies', 'barron-sunday-sermons'].every((k) => bySeries[k] && bySeries[k].kind === 'rss' && bySeries[k].available === true),
      'B2: the four standing RSS series stand unchanged beside it');
    ok(list.filter((s) => s.kind === 'rss').length === 5, 'B2: the index carries exactly five RSS series (the standing four + the new one)');
  }
  /* L1 — John's layer act through the app's own route */
  let version = 4;
  {
    const before = (await doorProfiles(BASE)).body;
    const r = await api('PUT', '/api/prayer/profiles/layers', { profileKey: 'salesian', layers: { novenas: { on: true }, podcasts: { on: true, series: ['bible-in-a-year', 'exorcist-files', 'daily-gospel-exegesis'] } } });
    version++;
    const bk = byKeyOf(r.body);
    ok(r.status === 200 && JSON.stringify(bk['salesian'].layers.podcasts.series) === '["bible-in-a-year","exorcist-files","daily-gospel-exegesis"]'
      && bk['salesian'].layers.podcasts.on === true && bk['salesian'].layers.novenas.on === true
      && r.body.state && r.body.state.version === version,
      'L1: the layers PUT on salesian answers 200 — the series appended after John\u2019s picks, novenas on, the route\u2019s own version bump (+1)', r.body.state);
    ok(JSON.stringify(bk['little-way']) === JSON.stringify(byKeyOf(before)['little-way'])
      && JSON.stringify(bk['benedictine']) === JSON.stringify(byKeyOf(before)['benedictine'])
      && JSON.stringify(bk['salesian'].coreBlocks) === JSON.stringify(byKeyOf(before)['salesian'].coreBlocks)
      && JSON.stringify(bk['salesian'].name) === JSON.stringify(byKeyOf(before)['salesian'].name),
      'L1: every other profile and field stands byte-preserved through the act');
    const day = (await doorDay(BASE, TODAY)).body;
    const podLayer = (day.profile.layers || []).find((l) => l.key === 'podcasts') || {};
    ok(day.profile.key === 'salesian' && day.profile.resolvedBy === 'standing'
      && JSON.stringify(podLayer.series) === '["bible-in-a-year","exorcist-files","daily-gospel-exegesis"]'
      && (day.blocks || []).some((b) => b.block === 'Podcasts'),
      'L1: the day fold carries the three series in order and the Podcasts group stands in the day', podLayer);
  }
  /* L3 — any profile: the same act on the little way + a picked day */
  {
    const r = await api('PUT', '/api/prayer/profiles/layers', { profileKey: 'little-way', layers: { novenas: { on: true }, podcasts: { on: true, series: ['daily-gospel-exegesis'] } } });
    version++;
    ok(r.status === 200 && r.body.state && r.body.state.version === version
      && JSON.stringify(byKeyOf(r.body)['little-way'].layers.podcasts.series) === '["daily-gospel-exegesis"]',
      'L3: the layers act lands on a non-standing profile (little-way, only this series) — 200, version +1', r.body.state);
    const pick = await api('PUT', '/api/prayer/profiles/day-pick', { date: '2026-11-19', profileKey: 'little-way' });
    version++;
    const day = (await sessDay(BASE, '2026-11-19')).body;
    const podLayer = ((day.profile || {}).layers || []).find((l) => l.key === 'podcasts') || {};
    ok(pick.status === 200 && day.profile && day.profile.key === 'little-way' && day.profile.resolvedBy === 'pick'
      && JSON.stringify(podLayer.series) === '["daily-gospel-exegesis"]'
      && (day.blocks || []).some((b) => b.block === 'Podcasts'),
      'L3: a day picked to that profile composes with the series in its Podcasts layer', podLayer);
  }
  /* L4 — a profile without the pick never carries it */
  {
    const prof = (await doorProfiles(BASE, '2026-11-22')).body;
    const bk = byKeyOf(prof);
    const fold = prof.resolved || prof.fold || null;
    ok(JSON.stringify(bk['benedictine']) === JSON.stringify(byKeyOf(PROFILES_LIVE)['benedictine']),
      'L4: the benedictine profile stands byte-identical to the live draw after every act (no pick, no series)');
    const eff = (await doorProfiles(BASE, '2026-11-22')).body.effective || {};
    const podLayer = (eff.layers || []).find((l) => l.key === 'podcasts') || {};
    ok(eff.key === 'benedictine' && eff.resolvedBy === 'rule' && podLayer.on === false
      && JSON.stringify(podLayer.series || []) === '[]',
      'L4: the benedictine fold for a Sunday (by rule, the profiles read\u2019s effective fold) carries its Podcasts layer off and no trace of the series', { eff: eff.key, podLayer });
  }
  /* captures for the client walk — real worker payloads */
  {
    const dayR = await api('GET', '/api/player/day?date=' + TODAY);
    const biyR = await api('GET', '/api/player/podcasts?series=bible-in-a-year');
    const exfR = await api('GET', '/api/player/podcasts?series=exorcist-files');
    const profsR = await api('GET', '/api/prayer/profiles');
    captured = { day: dayR.body, index: indexPayload, dge: dgePayload, biy: biyR.body, exf: exfR.body, profs: profsR.body };
    ok(dayR.status === 200 && dayR.body && dayR.body.profile && indexPayload && dgePayload && biyR.body && biyR.body.available !== undefined && exfR.body && profsR.body,
      'W-capture: the walk\u2019s payloads are the real local worker\u2019s (day · index · the three series · profiles)',
      { day: dayR.status, biy: biyR.status, exf: exfR.status, profs: profsR.status });
  }
}

/* ---------------- L2: the base instance refuses the key ---------------- */
async function baseLeg() {
  applyMigrations(BASE_APP, BASE_PERSIST, wranglerD1Base);
  startApp(BASE_APP, BASE_PERSIST, BASEPORT);
  ok(await waitUp(BASEAPP_URL), 'L2: base app up (the v534 ship code, its own D1)');
  applySql(wranglerD1Base, LIVE_SHAPE_SQL);
  const r = await apiBase('PUT', '/api/prayer/profiles/layers', { profileKey: 'salesian', layers: { novenas: { on: true }, podcasts: { on: true, series: ['bible-in-a-year', 'exorcist-files', 'daily-gospel-exegesis'] } } });
  ok(r.status === 400 && String(r.body.error || '').includes('bad series daily-gospel-exegesis'),
    'L2: on the BASE code the same layers PUT answers the named 400 — bad series daily-gospel-exegesis (the registry line is what admits the key)', r.body);
  const prof = (await doorProfiles(BASEAPP_URL)).body;
  ok(JSON.stringify(byKeyOf(prof)['salesian'].layers.podcasts.series) === '["bible-in-a-year","exorcist-files"]' && prof.state.version === 4,
    'L2: the refused act wrote nothing (the store stands at the live shape, version 4)');
  const r2 = await apiBase('GET', '/api/player/podcasts?series=daily-gospel-exegesis');
  ok((r2.status === 400 && /daily-gospel-exegesis|unknown series/i.test(String((r2.body && r2.body.error) || '')))
    || (r2.body && r2.body.available === false),
    'L2: on the base code the series itself does not stand (the series read refuses it by name)', { status: r2.status, body: r2.body });
}

/* ---------------- W: the Chromium walk (the v534 mold) ---------------- */
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
      const ans = (obj) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)) });
      const clone = (x) => JSON.parse(JSON.stringify(x));
      window.fetch = (url) => {
        const u = String(url);
        if (u.indexOf('/api/player/day') > -1 || u.indexOf('/api/prayer/day') > -1) return ans(clone(o.day));
        if (u.indexOf('/api/prayer/profiles') > -1) return ans(clone(o.profs));
        if (u.indexOf('/api/player/podcasts?series=daily-gospel-exegesis') > -1) return ans(clone(o.dge));
        if (u.indexOf('/api/player/podcasts?series=bible-in-a-year') > -1) return ans(clone(o.biy));
        if (u.indexOf('/api/player/podcasts?series=exorcist-files') > -1) return ans(clone(o.exf));
        if (u.endsWith('/api/player/podcasts')) return ans(clone(o.index));
        if (u.indexOf('/api/prayer/book') > -1 && u.indexOf('favorites') === -1) return ans(clone(o.book));
        if (u.indexOf('/api/prayer/mass-personal-prayer') > -1) return ans(clone(o.seats));
        return ans({ ok: true });
      };
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      HTMLMediaElement.prototype.pause = function () {};
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get() { return 600; }, configurable: true });
    }, { day: cap.day, index: cap.index, dge: cap.dge, biy: cap.biy, exf: cap.exf, profs: cap.profs, book: BOOK, seats: SEATS_LIVE });
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
    await page.waitForTimeout(900);
    return page;
  }
  const errs = (page) => page.evaluate(() => window.__errs || []);
  /* W1 — the Pray Podcasts group carries the new series entry */
  {
    const page = await buildPage();
    await page.click('[data-openblock="Podcasts"]');
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({
      cards: [...document.querySelectorAll('[data-daypodseries]')].map((c) => c.getAttribute('data-daypodseries')),
      text: (document.getElementById('view') || {}).textContent || '',
    }));
    ok(st.cards.length === 3 && st.cards.includes('daily-gospel-exegesis'),
      'W1: the Pray Podcasts group carries three series entries, incl. daily-gospel-exegesis (the v522 series-entry form)', st.cards);
    ok(/3 podcasts/.test(st.text), 'W1: the group counts read the standing podcasts ("3 podcasts")', st.text.slice(0, 120));
    /* W3 — from the group, the series page stands in Pray */
    await page.click('[data-daypodseries="daily-gospel-exegesis"]');
    await page.waitForTimeout(900);
    const st3 = await page.evaluate(() => ({
      tab: state.tab, lvl: (typeof podLevel !== 'undefined' ? podLevel : null),
      rows: document.querySelectorAll('[data-podplay]').length,
      text: (document.getElementById('view') || {}).textContent || '',
    }));
    ok(st3.tab === 'prayers' && st3.rows > 0 && st3.text.includes('Luke 19: 11-28'),
      'W3: one tap from the Pray group stands the Daily Gospel Exegesis series page in Pray, its real episodes listed (newest = today\u2019s Gospel)', { tab: st3.tab, rows: st3.rows });
    ok((await errs(page)).length === 0, 'W3: no page errors on the Pray walk', await errs(page));
    await page.close();
  }
  /* W2 — Catechesis → Podcasts: the card, its art, the series page */
  {
    const page = await buildPage();
    await page.evaluate(() => setTab('podcasts'));
    await page.waitForTimeout(700);
    await page.evaluate(() => { if (typeof switchPodSide === 'function') switchPodSide('podcasts'); });
    await page.waitForTimeout(900);
    const st = await page.evaluate((art) => {
      const card = document.querySelector('[data-podseries="daily-gospel-exegesis"]');
      const img = card ? card.querySelector('img.rowart') : null;
      return { found: !!card, img: img ? (img.getAttribute('src') || '') : null, art };
    }, DGE_ART);
    ok(st.found && st.img === DGE_ART,
      'W2: Catechesis → Podcasts shows the Daily Gospel Exegesis card with the feed\u2019s real channel art', st);
    await page.click('[data-podseries="daily-gospel-exegesis"]');
    await page.waitForTimeout(900);
    const st2 = await page.evaluate(() => ({
      lvl: (typeof podLevel !== 'undefined' ? podLevel : null),
      rows: document.querySelectorAll('[data-podplay]').length,
      first: ((document.querySelector('[data-podplay]') || {}).textContent || ''),
      text: (document.getElementById('view') || {}).textContent || '',
    }));
    ok(st2.lvl === 'series' && st2.rows === 50 && st2.text.includes('Luke 19: 11-28'),
      'W2: its series page lists the window\u2019s 50 real episodes, the newest (today\u2019s Gospel) standing at the head', { rows: st2.rows });
    ok((await errs(page)).length === 0, 'W2: no page errors on the Catechesis walk', await errs(page));
    await page.close();
  }
  /* W4 — the layer pickers list it (any profile) */
  {
    const page = await buildPage();
    await page.evaluate(() => openPodcastPicker());
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => {
      const row = document.querySelector('.podpick [data-podseries="daily-gospel-exegesis"]');
      const chk = row ? row.querySelector('[data-podcheck]') : null;
      return { found: !!row, check: chk ? chk.textContent : null, text: row ? row.textContent.trim().slice(0, 80) : null };
    });
    ok(st.found && /Daily Gospel Exegesis/.test(st.text || '') && st.check === '\u2713',
      'W4: the Podcasts-layer picker ("Choose podcasts") lists Daily Gospel Exegesis, checked on John\u2019s effective profile after the act', st);
    await page.click('[data-poddone]');
    await page.waitForTimeout(400);
    await page.evaluate(() => openProfileEditor('little-way'));
    await page.waitForTimeout(1200);
    const st2 = await page.evaluate(() => {
      const row = document.querySelector('.profedit [data-edseries="daily-gospel-exegesis"]');
      return { found: !!row, text: row ? row.textContent.trim().slice(0, 80) : null };
    });
    ok(st2.found && /Daily Gospel Exegesis/.test(st2.text || ''),
      'W4: the profile editor\u2019s series list carries it on a non-standing profile too (addable on any profile)', st2);
    ok((await errs(page)).length === 0, 'W4: no page errors in the pickers', await errs(page));
    await page.close();
  }
  await browser.close();
  server.close();
}

/* ---------------- run ---------------- */
try {
  statics();
  if (!PROBE) {
    await workerLegs();
    await baseLeg();
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
console.log(`\n# harness-v536: ${pass} ok / ${fail} not-ok`);
if (failures.length) { console.log('# failures:'); failures.forEach((f) => console.log('#  -', f)); }
process.exit(fail ? 1 : 0);
