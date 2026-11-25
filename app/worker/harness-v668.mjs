// harness-v668.mjs — v668: the Add ladder scrolls again.
//
// Chromium (playwright-core) harness, modeled on the Plan
// probe ~/workspace/.tools/pwtest/probe-v668-scroll.mjs:
// the REAL built Worker bundle (esbuild from source, the
// v666-shoot recipe) served locally, the API stubbed with
// production-shaped fixtures, the ladder opened through
// the real openAddLadder603('Morning', host) with a host
// stub that captures host.add calls, and real scrolls
// driven by mouse wheel over the list.
//
// Fixtures (Improvement D — production sources, named):
//  - app/tests/fixtures-v603/podcasts-index.json (the
//    captured podcasts index) PLUS the saint entry
//    (harness-v665/v666: kind rss, total 299) and the
//    catholicsaints entry (harness-v663/v666: kind video,
//    total 15) — the two series the capture predates.
//  - app/tests/fixtures-v603/book.json · bible-folded.json
//  - app/tests/fixtures-v614/novenas-catalog.json (229
//    novenas, each with its episodes)
//  - app/tests/fixtures-v656/catholictv.json (the LIVE
//    production Virtual Mass payload)
//  - app/worker/v666-fixtures/production-heads.json (live
//    feed heads captured 2026-11-25, Plan v666 §2.4)
//  - the 299-entry saint payload built on the real head
//    entry's exact shape (probe-v668 recipe).
//
// Legs (Plan §4 a–c, task S1–S6):
//  S1 Podcasts branch scroll + last row opens its node
//  S2 Saint series page (299 episodes) scroll + last
//     episode add lands in the host
//  S3 Ladder head structure (head/panelbody/panelfoot)
//  S4 Videos branch → Virtual Mass node scroll · the
//     Novenas leaf (229 rows) scroll
//  S5 Search narrows in place; focus/text keep; the
//     panelbody still scrolls after the repaint
//  S6 v666 re-stands: a sample add from the Podcasts
//     branch lands · the saint node's Add-daily card
//
// Run: node app/worker/harness-v668.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const APP = path.join(WT, 'app');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixtures (the probe's recipe, verbatim shapes) ----------
const HEADS = JSON.parse(readFileSync(path.join(W, 'v666-fixtures/production-heads.json'), 'utf8'));
const INDEX = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/podcasts-index.json'), 'utf8'));
if (!INDEX.seriesList.some((s) => s.series === 'saint-of-the-day')) INDEX.seriesList.push({ series: 'saint-of-the-day', kind: 'rss', category: 'podcasts', title: 'The Saint of The Day Podcast', available: true, total: 299 });
if (!INDEX.seriesList.some((s) => s.series === 'catholicsaints')) INDEX.seriesList.push({ series: 'catholicsaints', kind: 'video', category: 'podcasts', title: 'Catholic Saints & Feasts', available: true, total: 15 });
const BOOK = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/book.json'), 'utf8'));
const NOVENAS = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v614/novenas-catalog.json'), 'utf8'));
const BIBLE = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/bible-folded.json'), 'utf8'));
const CTV = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v656/catholictv.json'), 'utf8'));
const audioPayload = (series, title, entries) => ({ ok: true, kind: 'rss', series, title, available: true, showImageUrl: null, entries: entries.map((e) => ({ key: e.key, title: e.title, publishedMs: e.publishedMs, url: e.url, durationS: 600, listened: !!e.listened, positionS: 0 })) });
const head = HEADS.saint[0];
const saintEntries = [head];
for (let i = 1; i < 299; i++) saintEntries.push({ key: 'saint:ep-' + i, title: '11/' + String(25 - (i % 24)).padStart(2, '0') + ' - St. Fixture ' + i, publishedMs: (head.publishedMs || 1764000000000) - i * 86400000, url: 'https://example.invalid/s' + i + '.mp3', listened: false });
const PAYLOADS = {
  'saint-of-the-day': audioPayload('saint-of-the-day', 'The Saint of The Day Podcast', saintEntries),
  'daily-gospel-exegesis': audioPayload('daily-gospel-exegesis', 'Daily Gospel Exegesis', HEADS.exegesis),
  'daily-readings': audioPayload('daily-readings', 'USCCB Daily Readings Podcast', HEADS.readings),
  'bible-in-a-year': BIBLE,
  'catholicsaints': { ok: true, kind: 'video', series: 'catholicsaints', title: 'Catholic Saints & Feasts', available: true, marks: true, videos: HEADS.catholicsaints.map((v) => ({ id: v.id, title: v.title, publishedMs: v.publishedMs, url: 'https://www.youtube.com/watch?v=' + v.id, imageUrl: null, descText: null, dateLabel: '', listened: false })) },
  'catholictv': CTV,
  'novenas': NOVENAS,
};
check('F novenas catalog stands at 229 novenas', NOVENAS.novenas.length === 229, NOVENAS.novenas.length);
check('F saint payload stands at 299 entries on the real head shape', saintEntries.length === 299 && saintEntries[0] === head);

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v668harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries the v668 pin', SWJS.includes('ora-pro-nobis-v668-1'), 'pin not in served /sw.js');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.addInitScript(({ INDEX, PAYLOADS, BOOK }) => {
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
  window.fetch = (url) => {
    const u = String(url);
    if (u.includes('/api/prayer/book')) return resp(BOOK);
    const m = u.match(/\/api\/player\/podcasts\?series=([^&]+)/);
    if (m) { const sk = decodeURIComponent(m[1]); if (PAYLOADS[sk]) return resp(PAYLOADS[sk]); return resp({ series: sk, kind: 'rss', entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }); }
    if (u.includes('/api/player/podcasts')) return resp(INDEX);
    return new Promise(() => {});
  };
}, { INDEX, PAYLOADS, BOOK });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

async function openLadder() {
  await pg.evaluate((seriesList) => {
    const old = document.querySelector('.profaddladder603');
    if (old) old.remove();
    window.__adds668 = [];
    opnLadderSeries603 = seriesList;
    openAddLadder603('Morning', { ids: () => [], add: (it) => { window.__adds668.push(it); }, layers: () => null, groups: () => [], ensure: (cb) => cb() });
  }, INDEX.seriesList);
  await pg.waitForTimeout(500);
}
async function clickDoorByText(re) {
  const handle = await pg.evaluateHandle((reSrc) => {
    const rx = new RegExp(reSrc, 'i');
    const doors = [...document.querySelectorAll('.profaddladder603 [data-p603door]')];
    return doors.find((d) => rx.test(d.textContent)) || null;
  }, re);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await pg.waitForTimeout(450);
  return true;
}
async function clickBack() {
  const el = await pg.$('.profaddladder603 [data-p603back]');
  if (!el) return false;
  await el.click();
  await pg.waitForTimeout(400);
  return true;
}
function pageState() {
  return pg.evaluate(() => {
    const list = document.querySelector('.profaddladder603 [data-p603list]');
    const rows = list ? [...list.querySelectorAll('.bookrow')] : [];
    const pb = document.querySelector('.profaddladder603 .panelbody');
    const last = rows[rows.length - 1];
    const lr = last ? last.getBoundingClientRect() : null;
    return {
      rows: rows.length,
      hasPanelbody: !!pb,
      pbScrollTop: pb ? pb.scrollTop : null,
      pbScrollH: pb ? pb.scrollHeight : null,
      pbClientH: pb ? pb.clientHeight : null,
      lastBottom: lr ? Math.round(lr.bottom) : null,
      lastTop: lr ? Math.round(lr.top) : null,
      lastText: last ? last.textContent.trim().slice(0, 60) : null,
      viewportH: window.innerHeight,
    };
  });
}
// Real scroll drive: wheel over the list until the last
// row stands inside the viewport (or the drive gives up).
async function wheelToLast(maxRounds) {
  const box = await pg.evaluate(() => {
    const list = document.querySelector('.profaddladder603 [data-p603list]');
    const r = list.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(Math.min(r.top + 200, window.innerHeight - 50)) };
  });
  await pg.mouse.move(box.x, box.y);
  let st = await pageState();
  for (let i = 0; i < (maxRounds || 40) && !(st.lastBottom !== null && st.lastBottom <= st.viewportH && st.lastTop >= 0); i++) {
    for (let j = 0; j < 12; j++) { await pg.mouse.wheel(0, 600); await pg.waitForTimeout(40); }
    await pg.waitForTimeout(200);
    st = await pageState();
  }
  return st;
}
async function lastRowHandle() {
  const handle = await pg.evaluateHandle(() => {
    const rows = [...document.querySelectorAll('.profaddladder603 [data-p603list] .bookrow')];
    return rows[rows.length - 1] || null;
  });
  return handle.asElement();
}

// ---------- S3 ladder head structure + doors ----------
await openLadder();
{
  const s = await pg.evaluate(() => {
    const inner = document.querySelector('.profaddladder603 .inner');
    const kids = inner ? [...inner.children].map((c) => c.className) : [];
    const doors = [...document.querySelectorAll('.profaddladder603 [data-p603door]')].map((d) => d.textContent);
    return { kids, doors };
  });
  check('S3 .inner children stand head / panelbody / panelfoot in order', s.kids.length === 3 && /row/.test(s.kids[0]) && s.kids[1] === 'panelbody' && /panelfoot/.test(s.kids[2]), s.kids);
  check('S3 ladder head paints its 3 doors (Catechesis · Prayers · Videos)', s.doors.length === 3 && /Catechesis/.test(s.doors[0]) && /Prayers/.test(s.doors[1]) && /Videos/.test(s.doors[2]), s.doors.map((d) => d.slice(0, 30)));
}

// ---------- S1 Podcasts branch ----------
check('S1 Catechesis door opens', await clickDoorByText('Catechesis'));
check('S1 Podcasts door opens', await clickDoorByText('Podcasts'));
{
  const before = await pageState();
  check('S1 Podcasts branch stands in a panelbody with the full standing series list', before.hasPanelbody && before.rows === INDEX.seriesList.length, { rows: before.rows, want: INDEX.seriesList.length });
  const after = await wheelToLast();
  check('S1 wheel drive moves the panelbody scrollTop > 0', after.pbScrollTop > 0, after.pbScrollTop);
  check('S1 the LAST series row reaches the viewport', after.lastBottom !== null && after.lastBottom <= after.viewportH && after.lastTop >= 0, after);
  const last = await lastRowHandle();
  await last.click();
  await pg.waitForTimeout(700);
  const node = await pageState();
  check('S1 a tap on the last row opens its node (a new rung paints)', node.rows !== before.rows || node.lastText !== after.lastText, { nodeRows: node.rows, nodeLast: node.lastText });
}

// ---------- S2 Saint series page, 299 episodes ----------
await openLadder();
await clickDoorByText('Catechesis');
await clickDoorByText('Podcasts');
check('S2 Saint series door opens', await clickDoorByText('Saint of The Day'));
await pg.waitForTimeout(600);
{
  const before = await pageState();
  check('S2 saint node paints the 299-episode list (+ its head rows)', before.hasPanelbody && before.rows >= 299, before.rows);
  const after = await wheelToLast(80);
  check('S2 wheel drive moves the panelbody scrollTop > 0', after.pbScrollTop > 0, after.pbScrollTop);
  check('S2 the last episode row reaches the viewport', after.lastBottom !== null && after.lastBottom <= after.viewportH && after.lastTop >= 0, { bottom: after.lastBottom, top: after.lastTop });
  const last = await lastRowHandle();
  await last.click();
  await pg.waitForTimeout(400);
  const adds = await pg.evaluate(() => window.__adds668);
  const wantKey = 'saint-of-the-day|saint:ep-298';
  check('S2 tapping the last episode calls host.add with that episode (kind episode, key ' + wantKey + ')', adds.length === 1 && adds[0].kind === 'episode' && adds[0].key === wantKey, adds);
}

// ---------- S4 Videos branch → Virtual Mass node · Novenas leaf ----------
await openLadder();
check('S4 Videos door opens', await clickDoorByText('Videos'));
{
  const br = await pageState();
  check('S4 Videos branch paints its 2 doors in a panelbody', br.hasPanelbody && br.rows === 2, br.rows);
}
check('S4 Virtual Mass door opens', await clickDoorByText('Virtual Mass'));
check('S4 Catholic TV Mass door opens', await clickDoorByText('Catholic TV Mass'));
await pg.waitForTimeout(600);
{
  const before = await pageState();
  check('S4 Virtual Mass node paints the catholictv videos', before.hasPanelbody && before.rows === CTV.videos.length, { rows: before.rows, want: CTV.videos.length });
  const after = await wheelToLast();
  check('S4 wheel drive moves the panelbody scrollTop > 0 on the video node', after.pbScrollTop > 0, after.pbScrollTop);
  check('S4 the last video row reaches the viewport', after.lastBottom !== null && after.lastBottom <= after.viewportH && after.lastTop >= 0, after);
}
await openLadder();
await clickDoorByText('Catechesis');
check('S4 Novenas door opens', await clickDoorByText('Novenas'));
await pg.waitForTimeout(700);
{
  const before = await pageState();
  check('S4 Novenas leaf paints its 229 rows in a panelbody', before.hasPanelbody && before.rows === 229, before.rows);
  const after = await wheelToLast(80);
  check('S4 wheel drive moves the panelbody scrollTop > 0 on the Novenas leaf', after.pbScrollTop > 0, after.pbScrollTop);
  check('S4 the last novena row reaches the viewport', after.lastBottom !== null && after.lastBottom <= after.viewportH && after.lastTop >= 0, { bottom: after.lastBottom, top: after.lastTop });
}

// ---------- S5 Search narrows in place ----------
await openLadder();
await clickDoorByText('Catechesis');
await clickDoorByText('Podcasts');
{
  const before = await pageState();
  const inp = await pg.$('.profaddladder603 [data-p603search]');
  await inp.click();
  await pg.keyboard.type('e');
  await pg.waitForTimeout(500);
  const mid = await pg.evaluate(() => {
    const i = document.querySelector('.profaddladder603 [data-p603search]');
    return { value: i ? i.value : null, focused: !!i && document.activeElement === i, rows: document.querySelectorAll('.profaddladder603 [data-p603list] .bookrow').length };
  });
  check('S5 typing in the search pill repaints the list in place (rows narrow)', mid.rows < before.rows && mid.rows > 5, { before: before.rows, after: mid.rows });
  check('S5 the search input keeps focus + text after the repaint', mid.focused && mid.value === 'e', mid);
  const after = await wheelToLast();
  check('S5 the panelbody still scrolls after the search repaint', after.pbScrollTop > 0 && after.lastBottom !== null && after.lastBottom <= after.viewportH, { scrollTop: after.pbScrollTop, bottom: after.lastBottom });
}

// ---------- S6 v666 re-stands ----------
await openLadder();
await clickDoorByText('Catechesis');
await clickDoorByText('Podcasts');
check('S6 Bible in a Year door opens from the Podcasts branch', await clickDoorByText('Bible in a Year'));
await pg.waitForTimeout(600);
{
  const firstAdd = await pg.$('.profaddladder603 [data-p603list] [data-p603additem]');
  check('S6 an addable row stands on the series node', !!firstAdd);
  if (firstAdd) { await firstAdd.click(); await pg.waitForTimeout(300); }
  const adds = await pg.evaluate(() => window.__adds668);
  check('S6 a sample add from the Podcasts branch lands through host.add', adds.length === 1 && !!adds[0].kind, adds);
}
await openLadder();
await clickDoorByText('Catechesis');
await clickDoorByText('Podcasts');
await clickDoorByText('Saint of The Day');
await pg.waitForTimeout(600);
{
  const daily = await pg.evaluate(() => {
    const el = document.querySelector('.profaddladder603 .p666daily');
    return el ? { attr: el.getAttribute('data-p603additem'), text: el.textContent.slice(0, 80) } : null;
  });
  check('S6 the saint node\u2019s Add-daily card stands (gate d shape: .p666daily, daily:saint-of-the-day)', !!daily && daily.attr === 'daily:saint-of-the-day', daily);
}

await b.close();
server.close();
console.log('harness-v668: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
