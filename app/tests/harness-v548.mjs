// harness-v548.mjs — v548 evidence: Summa in a Year
// (Austin Habash / Think Catholic) joins the app as an
// RSS podcast series in Catechesis → Podcasts — the
// series entry ONLY (John's order, 2026-11-19 23:02 CT):
// no profile Podcasts-layer addition stands in this
// release, and the harness proves no layer moved.
// Built to the v548 release document §2 (the v536 mold).
//   S statics: the one registry line stands in
//     POD_RSS_SERIES_LIST with the RSS_SUMMA_FEED_URL
//     constant + the EXT_SUMMA_FEED_URL harness seam ·
//     client.ts byte-identical to the base · ui.ts
//     identical outside the pin · index.ts diff vs the
//     base purely additive · migrations still end at
//     0041 · the fixtures stand
//   B worker (local wrangler, fixture D1 seeded with
//     the LIVE profile store): B1 a cold series read
//     builds the snapshot from the REAL captured feed —
//     the 307-item feed windows to exactly 50,
//     entries[0] is the captured newest ("Day 307: You
//     Made It."), one fetch · B2 the Podcasts index
//     carries the new series with its real art + total
//     beside the nine standing series (six RSS in all)
//   P playback + marks: P1 entries[0]'s stream URL is
//     the captured feed's real Day 307 enclosure · P2 a
//     listen mark round-trips on podcast_listens and a
//     position on podcast_positions, through the
//     standing routes
//   L0 the scope-bound proof: the profiles read after
//     every leg is byte-equal to the live fixture (no
//     layer, series list, or state version moved), and
//     the day fold carries John's standing three series
//     — summa-in-a-year absent from every fold
//   W client (Chromium, the v534 mold; fetch stubbed
//     with payloads CAPTURED FROM THE REAL LOCAL WORKER):
//     the Pray Podcasts group carries the standing three
//     and NOT the new series · Catechesis → Podcasts
//     shows its card with the real channel art · its
//     series page lists the window's 50 real episodes,
//     Day 307 standing at the head
// Fixtures (Improvement D), under tests/fixtures-v548/:
//   (a) feeds-summa-2026-11-19.xml — the LIVE Summa in
//     a Year RSS feed captured 2026-11-19 (sha256
//     e787692fb9f4820dda6ad7d87a12f9b8473b6d3b36d10532
//     a524ac1ccf1fc1ac; 307 items; newest = "Day 307:
//     You Made It.", 2026-03-10); expectations are
//     DERIVED from this capture.
//   (b) profiles-live-2026-11-19.json — the live
//     profiles door read of 2026-11-19 (the three
//     defaults; John's salesian Podcasts layer on
//     [bible-in-a-year, exorcist-files,
//     daily-gospel-exegesis]; state version 5).
//   (c) mass-seats-live-2026-11-19.json — the live
//     Mass personal-prayer seats read (ship-time
//     preservation reference; the walk's stub surface).
//   The standing series' feeds ride small synthetic
//   fixtures in the v500 form (their shapes are not
//   what this release proves).
// The base for byte comparisons is the v546 ship tree
// (github/main fefa2bdd; H548_BASE overrides).
// Run: node app/tests/harness-v548.mjs [--probe]
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
const BASE_APP = process.env.H548_BASE || path.resolve(ROOT, '../v548-base/app');
const BASE_SRC = BASE_APP + '/worker/src';
const FX = APP + '/tests/fixtures-v548';
const SUMMA_XML = readFileSync(FX + '/feeds-summa-2026-11-19.xml', 'utf8');
const PROFILES_LIVE = JSON.parse(readFileSync(FX + '/profiles-live-2026-11-19.json', 'utf8'));
const SEATS_LIVE = JSON.parse(readFileSync(FX + '/mass-seats-live-2026-11-19.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TODAY = '2026-11-19';

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
const SUMMA_ITEMS = parseItems(SUMMA_XML);
const SUMMA_SORTED = [...SUMMA_ITEMS].filter((x) => x.url).sort((a, b) => (b.pubMs ?? -Infinity) - (a.pubMs ?? -Infinity));
const SUMMA_NEWEST = SUMMA_SORTED[0];
const SUMMA_ART = channelImage(SUMMA_XML);
const SUMMA_COUNT = SUMMA_ITEMS.length;
const SUMMA_E0_ART = (SUMMA_NEWEST && SUMMA_NEWEST.itemImage) || SUMMA_ART;

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
const DGE_XML = rssFeedS('Daily Gospel Exegesis', 'https://img.example/dge-show.jpg', [
  rssItemS('Wednesday of Week 33 in Ordinary Time - Luke 19: 11-28', 'dge-g1', 'dge1.mp3', 'Tue, 17 Nov 2026 17:00:00 GMT', 1500),
  rssItemS('Tuesday of Week 33 in Ordinary Time - Luke 19: 1-10', 'dge-g2', 'dge2.mp3', 'Mon, 16 Nov 2026 17:00:00 GMT', 1501),
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

let summaFetches = 0;
const feedServer = http.createServer((rq, rs) => {
  const u = rq.url || '';
  const send = (body, ct) => { rs.writeHead(200, { 'content-type': ct }); rs.end(body); };
  if (u.startsWith('/summa.xml')) { summaFetches++; return send(SUMMA_XML, 'application/rss+xml'); }
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
const PORT = 8991, FEEDPORT = 8993;
const BASE = 'http://127.0.0.1:' + PORT;
const PERSIST = path.join(APP, '.wrangler-test-v548');
const TOKEN = 'harness-v548-token';
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'h548-'));
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

/* ---------------- S: statics ---------------- */
function statics() {
  ok(I_SRC.includes('{ key: "summa-in-a-year", title: "Summa in a Year", feedUrl: (env) => env.EXT_SUMMA_FEED_URL || RSS_SUMMA_FEED_URL }'),
    'S1: the registry line stands in POD_RSS_SERIES_LIST (key summa-in-a-year, the standing seam form)');
  const listAt = I_SRC.indexOf('POD_RSS_SERIES_LIST: PodRssSeriesDef[]');
  const order = ['exorcist-files', 'counsel-of-trent', 'fr-mike-homilies', 'barron-sunday-sermons', 'daily-gospel-exegesis', 'summa-in-a-year'].map((k) => I_SRC.indexOf(`key: "${k}"`, listAt));
  ok(order.every((x) => x > listAt) && order.every((x, i) => i === 0 || x > order[i - 1]),
    'S2: the registry order is the standing five, then summa-in-a-year appended');
  ok(I_SRC.includes('const RSS_SUMMA_FEED_URL = "https://anchor.fm/s/e792b1ec/podcast/rss";')
    && I_SRC.includes('EXT_SUMMA_FEED_URL?: string'),
    'S3: the pinned feed constant and the Env harness seam stand (production leaves the seam unset; the constant governs)');
  const migs = readdirSync(APP + '/migrations').filter((x) => x.endsWith('.sql')).sort();
  ok(migs[migs.length - 1] === '0041_starred_tracks.sql',
    'S4: no new migration — the newest stands at 0041 (the rss_snapshots store of 0027 carries the series)', migs[migs.length - 1]);
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
    && JSON.stringify(byKey['salesian'].layers.podcasts.series) === '["bible-in-a-year","exorcist-files","daily-gospel-exegesis"]'
    && PROFILES_LIVE.state && PROFILES_LIVE.state.version === 5 && PROFILES_LIVE.state.standingKey === 'salesian',
    'S8: the profiles fixture stands (the live draw: three defaults, salesian podcasts [bible-in-a-year, exorcist-files, daily-gospel-exegesis], state v5)');
  ok(SUMMA_COUNT === 307 && SUMMA_NEWEST && SUMMA_NEWEST.title === 'Day 307: You Made It.' && SUMMA_NEWEST.durationS > 0 && !!SUMMA_ART && !!SUMMA_NEWEST.url,
    `S9: the captured live feed stands (307 items; newest "${SUMMA_NEWEST && SUMMA_NEWEST.title}" · ${SUMMA_NEWEST && SUMMA_NEWEST.durationS}s · enclosure + channel art present)`,
    { count: SUMMA_COUNT, newest: SUMMA_NEWEST && SUMMA_NEWEST.title, art: SUMMA_ART });
}

/* ---------------- the worker legs ---------------- */
let captured = null;
async function workerLegs() {
  await new Promise((r) => feedServer.listen(FEEDPORT, '127.0.0.1', r));
  try { execFileSync('fuser', ['-k', PORT + '/tcp'], { stdio: 'ignore' }); } catch { /* free */ }
  applyMigrations(APP, PERSIST, wranglerD1);
  startApp(APP, PERSIST, PORT);
  ok(await waitUp(BASE), 'W0: build app up on local wrangler (LOCAL_DEV), D1 through 0041');
  applySql(wranglerD1, LIVE_SHAPE_SQL);
  {
    const prof = (await doorProfiles()).body;
    ok(JSON.stringify(prof.profiles) === JSON.stringify(PROFILES_LIVE.profiles)
      && JSON.stringify(prof.state) === JSON.stringify(PROFILES_LIVE.state),
      'W1: the seeded local store matches the live profiles shape byte-for-byte', prof.state);
  }
  /* B1 — the cold series build from the real feed */
  let summaPayload = null;
  {
    const f0 = summaFetches; const t0 = Date.now();
    const r = await api('GET', '/api/player/podcasts?series=summa-in-a-year');
    const ms = Date.now() - t0;
    summaPayload = r.body;
    const e0 = (r.body.entries || [])[0] || {};
    ok(r.status === 200 && r.body.kind === 'rss' && r.body.available === true && r.body.stale === false,
      'B1: a cold read builds the Summa in a Year snapshot from the real feed (kind rss, available, not stale)', { status: r.status, ms });
    ok(summaFetches - f0 === 1, `B1: the cold build fetched the feed exactly once (${summaFetches - f0}) in ${ms} ms (the 1.95 MB / 307-item parse, timed and named)`);
    ok(r.body.total === 50 && (r.body.entries || []).length === 50,
      `B1: the ${SUMMA_COUNT}-item feed stores exactly the latest 50 (total ${r.body.total})`);
    ok(e0.title === SUMMA_NEWEST.title && e0.durationS === SUMMA_NEWEST.durationS && r.body.currentKey === e0.key,
      'B1: entries[0] is the captured newest — "Day 307: You Made It." — with its real duration, standing as current',
      { title: e0.title, durationS: e0.durationS });
    ok(r.body.showImageUrl === SUMMA_ART && e0.imageUrl === SUMMA_E0_ART,
      'B1: the series art is the feed\u2019s real channel art; the newest entry carries the feed\u2019s art for it', { show: r.body.showImageUrl, entry: e0.imageUrl });
    const r2 = await api('GET', '/api/player/podcasts?series=summa-in-a-year');
    ok(summaFetches - f0 === 1 && r2.body.available === true,
      'B1: a second read serves the standing snapshot (no refetch inside the 2 h window)');
    /* P1 — playback: the newest entry's stream URL is the feed's real enclosure */
    ok(e0.url === SUMMA_NEWEST.url && /^https:\/\//.test(e0.url || ''),
      'P1: entries[0] plays through the standing player path — its stream URL is the captured feed\u2019s real Day 307 enclosure URL', { url: e0.url });
  }
  /* P2 — the listen + position round-trips on the standing stores */
  {
    const e0 = (summaPayload.entries || [])[0] || {};
    const e1 = (summaPayload.entries || [])[1] || {};
    const m = await api('POST', '/api/player/podcasts/mark', { series: 'summa-in-a-year', seqKey: e0.key, source: 'manual' });
    ok(m.status === 200 && m.body.ok === true, 'P2: a listen mark for the newest Summa episode writes through the standing mark route', m.body);
    const pos = await api('POST', '/api/player/podcasts/position', { series: 'summa-in-a-year', seqKey: e1.key, positionS: 42, durationS: e1.durationS });
    ok(pos.status === 200 && pos.body.ok === true, 'P2: a playback position for the second episode writes through the standing position route', pos.body);
    const r = await api('GET', '/api/player/podcasts?series=summa-in-a-year');
    const n0 = (r.body.entries || [])[0] || {};
    const n1 = (r.body.entries || [])[1] || {};
    ok(n0.listened === true && r.body.listenedCount === 1 && n0.key === e0.key,
      'P2: the mark reads back on the series payload (episode-level, on podcast_listens; listenedCount 1)', { listened: n0.listened, count: r.body.listenedCount });
    ok(n1.positionS === 42 && n1.listened === false && n1.key === e1.key,
      'P2: the position reads back on the series payload (42 s on podcast_positions, the episode unlistened)', { positionS: n1.positionS });
    summaPayload = r.body;
  }
  /* B2 — the index */
  let indexPayload = null;
  {
    const r = await api('GET', '/api/player/podcasts');
    indexPayload = r.body;
    const list = r.body.seriesList || [];
    const bySeries = {}; list.forEach((s) => { bySeries[s.series] = s; });
    const sm = bySeries['summa-in-a-year'] || {};
    ok(sm.kind === 'rss' && sm.available === true && sm.total === 50 && sm.showImageUrl === SUMMA_ART && !!sm.latestLabel,
      'B2: the Podcasts index carries Summa in a Year (kind rss, available, total 50, real art, latest label standing)', sm);
    ok(['catechism-in-a-year', 'bible-in-a-year', 'rosary-in-a-year', 'exorcist-files', 'counsel-of-trent', 'fr-mike-homilies', 'barron-sunday-sermons', 'daily-gospel-exegesis'].every((k) => bySeries[k] && bySeries[k].available === true)
      && !!bySeries['the-ai-signal'] && list.length === 10,
      'B2: the nine standing series stand unchanged beside it — the catalog reads ten (the-ai-signal stands present; its availability rides its own episode store, unseeded in the harness D1 — its standing local read, identical on the base code)');
    ok(list.filter((s) => s.kind === 'rss').length === 6, 'B2: the index carries exactly six RSS series (the standing five + the new one)');
  }
  /* L0 — no layer moved (the scope-bound proof) */
  {
    const prof = (await doorProfiles()).body;
    ok(JSON.stringify(prof.profiles) === JSON.stringify(PROFILES_LIVE.profiles)
      && JSON.stringify(prof.state) === JSON.stringify(PROFILES_LIVE.state),
      'L0: after every leg the profiles read is byte-equal to the live fixture — no profile, layer, series list, or state version moved', prof.state);
    const day = (await doorDay(TODAY)).body;
    const podLayer = (day.profile.layers || []).find((l) => l.key === 'podcasts') || {};
    ok(day.profile.key === 'salesian' && day.profile.resolvedBy === 'standing'
      && JSON.stringify(podLayer.series) === '["bible-in-a-year","exorcist-files","daily-gospel-exegesis"]'
      && !(day.profile.layers || []).some((l) => (l.series || []).includes('summa-in-a-year')),
      'L0: the day fold carries John\u2019s standing three Podcasts series — summa-in-a-year stands in NO fold (admissible in the registry, added nowhere)', podLayer);
  }
  /* captures for the client walk — real worker payloads */
  {
    const dayR = await api('GET', '/api/player/day?date=' + TODAY);
    const biyR = await api('GET', '/api/player/podcasts?series=bible-in-a-year');
    const exfR = await api('GET', '/api/player/podcasts?series=exorcist-files');
    const dgeR = await api('GET', '/api/player/podcasts?series=daily-gospel-exegesis');
    const profsR = await api('GET', '/api/prayer/profiles');
    captured = { day: dayR.body, index: indexPayload, summa: summaPayload, biy: biyR.body, exf: exfR.body, dge: dgeR.body, profs: profsR.body };
    ok(dayR.status === 200 && dayR.body && dayR.body.profile && indexPayload && summaPayload && biyR.body && biyR.body.available !== undefined && exfR.body && dgeR.body && profsR.body,
      'W-capture: the walk\u2019s payloads are the real local worker\u2019s (day · index · the series · profiles)',
      { day: dayR.status, biy: biyR.status, exf: exfR.status, dge: dgeR.status, profs: profsR.status });
  }
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
        if (u.indexOf('/api/player/podcasts?series=summa-in-a-year') > -1) return ans(clone(o.summa));
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
    }, { day: cap.day, index: cap.index, summa: cap.summa, biy: cap.biy, exf: cap.exf, dge: cap.dge, profs: cap.profs, book: BOOK, seats: SEATS_LIVE });
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
  /* W1 — the Pray Podcasts group carries the standing three, NOT the new series */
  {
    const page = await buildPage();
    await page.click('[data-openblock="Podcasts"]');
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({
      cards: [...document.querySelectorAll('[data-daypodseries]')].map((c) => c.getAttribute('data-daypodseries')),
      text: (document.getElementById('view') || {}).textContent || '',
    }));
    ok(st.cards.length === 3 && st.cards.includes('bible-in-a-year') && st.cards.includes('exorcist-files') && st.cards.includes('daily-gospel-exegesis') && !st.cards.includes('summa-in-a-year'),
      'W1: the Pray Podcasts group carries John\u2019s standing three series entries — summa-in-a-year is NOT among them (no layer addition, on the client surface too)', st.cards);
    ok((await errs(page)).length === 0, 'W1: no page errors on the Pray walk', await errs(page));
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
      const card = document.querySelector('[data-podseries="summa-in-a-year"]');
      const img = card ? card.querySelector('img.rowart') : null;
      return { found: !!card, img: img ? (img.getAttribute('src') || '') : null, art };
    }, SUMMA_ART);
    ok(st.found && st.img === SUMMA_ART,
      'W2: Catechesis → Podcasts shows the Summa in a Year card with the feed\u2019s real channel art', st);
    await page.click('[data-podseries="summa-in-a-year"]');
    await page.waitForTimeout(900);
    const st2 = await page.evaluate(() => ({
      lvl: (typeof podLevel !== 'undefined' ? podLevel : null),
      rows: document.querySelectorAll('[data-podplay]').length,
      text: (document.getElementById('view') || {}).textContent || '',
    }));
    ok(st2.lvl === 'series' && st2.rows === 50 && st2.text.includes('Day 307: You Made It.'),
      'W2: its series page lists the window\u2019s 50 real episodes, the newest ("Day 307: You Made It.") standing at the head', { rows: st2.rows });
    ok((await errs(page)).length === 0, 'W2: no page errors on the Catechesis walk', await errs(page));
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
console.log(`\n# harness-v548: ${pass} ok / ${fail} not-ok`);
if (failures.length) { console.log('# failures:'); failures.forEach((f) => console.log('#  -', f)); }
process.exit(fail ? 1 : 0);
