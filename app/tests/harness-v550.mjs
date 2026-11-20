// harness-v550.mjs — v550 evidence: Full Controls on
// Favorites · Reorder by Drag (John's approval, voice call
// 2026-11-20 08:49 CT: Q1 A · Q2 A · Q3 A · Q4 A · Q5 A ·
// run level To Ship). Built to the v550 release document
// §2 (the v547 mold).
//   S statics: the diff against the production base
//     (GitHub main 2577d2b — the v549 ship tree) confined
//     to client.ts + ui.ts (+ the harness and its
//     fixtures) · index.ts / mass*.ts / logo*.ts
//     byte-identical · migrations end at 0042 (NO new
//     migration — Q2 A rides 0041's sort_order) · the SW
//     pin stands at ora-pro-nobis-v549-1 on the build tree
//     (it moves only at Ship) · the v550 functions stand
//   C client (Chromium, stubbed fetch):
//     C1 the Favorites clusters read mark · star · ⋮ per
//       kind (played dot on the episode row, podmark on
//       the podcast rows, the warmed map driving the face)
//     C2 the episode dot marks / unmarks in the day store
//       at the presented date
//     C3 the podcast podmark posts mark then unmark with
//       the series NOT open
//     C4 the snapshot episode's ⋮ mirror menu (Share ·
//       Add to queue); Add to queue forms the waiting queue
//     C5 the podcast ⋮ (series closed) carries Share ·
//       Mark as listened; the mark act posts
//     C6 Read stands on a text-carrying episode row and
//       opens the reader
//   R reorder:
//     R1 the header menu on the Favorites page carries
//       the Favorites group + Reorder; the home and
//       block-page menus do not
//     R2 reorder mode: handles on every row, the bar
//       reads Reorder + Done, no row controls stand
//     R3 a handle drag moves the row; Done PUTs the
//       whole list in the new order and exits the mode
//     R4 entering, dragging, and leaving by Back writes
//       NOTHING — the store order stands
//     R5 a day-built block page carries no handles
//   PROD the production-shaped world: the LIVE starred
//     fixture's three podcast entries render as rows
//   G439 (recorded as-is, NEVER a v550 pass): the
//     standing v439 boot gate at its standing reading
// Fixtures (Improvement D), from production:
//   tests/fixtures-v550/starred-live.json — the LIVE
//     starred read drawn from production D1
//     (starred_tracks, 2026-11-20: daily-gospel-exegesis
//     episode · bible-in-a-year biy:day-321 · biy:day-320)
//   tests/fixtures-v550/listens-live.json — the LIVE
//     podcast_listens rows for those keys (the exegesis
//     entry stands listened, source auto, 2026-11-20)
//   the standing live day fixture tests/fixtures-v522/
//     day-live-2026-11-17.json (the harness seats minimal
//     track records under the production episode ids, the
//     v542/v547 mold; the morning-prayer record also
//     carries hasText/textUrl, fields the production
//     track records carry)
//   the podcast series payload in the v547 harness's
//     shape (the production catechism-in-a-year payload's
//     form: day-1 listened, day-2 unlistened)
// Run: node app/tests/harness-v550.mjs [--probe] (from
// the worktree root). --probe only prints.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const gitShow = (p) => execFileSync('git', ['show', '2577d2b:' + p], { cwd: ROOT, encoding: 'utf8' });
const B_C = gitShow('app/worker/src/client.ts');
const DAY = JSON.parse(readFileSync(APP + '/tests/fixtures-v522/day-live-2026-11-17.json', 'utf8'));
const STARRED_LIVE = JSON.parse(readFileSync(APP + '/tests/fixtures-v550/starred-live.json', 'utf8'));
const LISTENS_LIVE = JSON.parse(readFileSync(APP + '/tests/fixtures-v550/listens-live.json', 'utf8'));
const DAY_TRACKS = {
  Morning: ['ext-invitatory', 'morning-prayer', 'ext-morning-prayer', 'daily-rosary', 'marian-antiphon-angelus'],
  Midday: ['ext-midday-prayer', 'daily-reflection'],
  Evening: ['ext-evening-prayer', 'auxilium-christianorum'],
  Night: ['ext-night-prayer'],
  Novenas: ['novena-clement_i_pope', 'novena-columban_of_luxeuil_abbot', 'novena-st_cecilia'],
  Podcasts: [],
};
const DAYH = JSON.parse(JSON.stringify(DAY));
DAYH.blocks.forEach((b) => {
  b.tracks = (DAY_TRACKS[b.block] || []).map((id) => {
    const t = { episodeId: id, title: id, streamUrl: 'https://example.com/' + id + '.mp3', available: true, durationS: 600 };
    if (id === 'morning-prayer') { t.hasText = true; t.textUrl = 'https://example.com/morning-prayer.txt'; }
    return t;
  });
  b.trackCount = b.tracks.length;
});
const SERIES = {
  ok: true, available: true, series: 'catechism-in-a-year', title: 'Catechism in a Year', showDesc: '', showImageUrl: null,
  currentKey: 'ciy:day-2', listenedCount: 1, total: 2,
  entries: [
    { key: 'ciy:day-1', label: 'Day 1', title: 'In the Beginning', url: 'https://example.com/ciy1.mp3', durationS: 900, listened: true, listenDate: '2026-11-17', positionS: null, descText: '', imageUrl: null },
    { key: 'ciy:day-2', label: 'Day 2', title: 'The Story of Creation', url: 'https://example.com/ciy2.mp3', durationS: 900, listened: false, listenDate: null, positionS: null, descText: '', imageUrl: null },
  ],
};
const SEED_STARRED = [
  { k: 'episode', id: 'morning-prayer', title: 'Morning Prayer', sub: 'Morning', durationS: 600, imageUrl: '', block: 'Morning', url: 'https://example.com/morning-prayer.mp3', date: '2026-11-17' },
  { k: 'podcast', id: 'ciy:day-1', series: 'catechism-in-a-year', title: 'Day 1: In the Beginning', sub: 'Catechism in a Year', durationS: 900, imageUrl: '', block: 'Podcasts', url: 'https://example.com/ciy1.mp3', date: '2026-11-17' },
  { k: 'podcast', id: 'ciy:day-2', series: 'catechism-in-a-year', title: 'Day 2: The Story of Creation', sub: 'Catechism in a Year', durationS: 900, imageUrl: '', block: 'Podcasts', url: 'https://example.com/ciy2.mp3', date: '2026-11-17' },
  { k: 'episode', id: 'past-day-ep', title: 'A Past Day Track', sub: 'Morning', durationS: 300, imageUrl: '', block: 'Morning', url: 'https://example.com/past-day-ep.mp3', date: '2026-11-10' },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + String(extra).slice(0, 220) : ''); }
}
function fnBody(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0; const s = src.indexOf('{', i);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return null;
}

/* ---------------- S: statics ---------------- */
{
  const changed = execFileSync('git', ['diff', '--name-only', '2577d2b'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'app/worker/src/ui.ts' || p.startsWith('app/tests/harness-v550') || p.startsWith('app/tests/fixtures-v550/')),
    'S1a: the tracked diff against the production base is confined to client.ts + ui.ts + the harness and its fixtures', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v550') || p.startsWith('app/tests/fixtures-v550/')),
    'S1b: the only untracked paths are the harness, its logs, and its fixtures', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (client-only release)');
  ok(U_SRC.includes('ora-pro-nobis-v549-1') && !U_SRC.includes('ora-pro-nobis-v550-1'),
    'S2b: the SW pin stands at v549-1 on the build tree (it moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2c: migration 0042 stands last (no new migration — Q2 A)', migs.slice(-2).join(','));
  for (const f of ['mass.ts', 'mass-calendar.ts', 'mass-order.ts', 'mass-readings.ts', 'logo.ts', 'logo512.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === gitShow('app/worker/src/' + f), 'S2d-' + f + ': byte-identical to the production base');
  }
  for (const fn of ['favPodListenedOf', 'favPodWarm', 'favPodToggle', 'favMarkHtml', 'openFavRowMenu', 'enterFavReorder', 'favReorderRowHtml', 'favReorderDone', 'wireFavDrag']) {
    ok(!!fnBody(C_SRC, fn), 'S3-' + fn + ': stands in client.ts');
  }
  ok((fnBody(C_SRC, 'starredRowHtml') || '').includes('data-favmenu') && (fnBody(C_SRC, 'starredRowHtml') || '').includes('favMarkHtml'),
    'S4a: starredRowHtml carries the full cluster (the mark act + the ⋮)');
  ok((fnBody(C_SRC, 'openHeaderMenu') || '').includes("'Reorder'") && (fnBody(C_SRC, 'openHeaderMenu') || '').includes("kind === 'favorites'"),
    'S4b: the header menu carries the Favorites page group with Reorder');
  ok((fnBody(C_SRC, 'favReorderDone') || '').includes('starredSync()') && !(fnBody(C_SRC, 'wireFavDrag') || '').includes('starredSync'),
    'S4c: the save stands at Done alone — the drag writes nothing (Q4 A)');
  for (const fn of ['starredSync', 'starredSet', 'toggleStar', 'starredPlayAll', 'starredAddAll', 'addToQueue', 'openDayRowMenu', 'openPodRowMenu', 'podToggleMark']) {
    ok(fnBody(C_SRC, fn) === fnBody(B_C, fn), 'S5-' + fn + ': byte-identical to the base (the standing machinery is ridden, not edited)');
  }
  ok(U_SRC.includes('.favhandle') && U_SRC.includes('.favreorder-row.dragging'),
    'S6a: ui.ts carries the handle + lifted-row dress');
  ok(JSON.stringify((STARRED_LIVE.starred || []).map((e) => e.k + ':' + e.id)) === JSON.stringify(['podcast:f12a7182-b6fc-4de4-a0b8-e7c2a49c0e3b', 'podcast:biy:day-321', 'podcast:biy:day-320'])
    && LISTENS_LIVE.listens.length === 1 && LISTENS_LIVE.listens[0].series === 'daily-gospel-exegesis' && LISTENS_LIVE.listens[0].source === 'auto',
    'S6b: the fixtures stand — the LIVE starred read (3 podcast entries, production D1 2026-11-20) and the LIVE listens read (the exegesis entry listened, source auto)');
}

/* ---------------- the page mold ---------------- */
let COOKED = null;
try {
  const t = C_SRC.indexOf('APP_JS = `') + 10;
  COOKED = new Function('return `' + C_SRC.slice(t, C_SRC.indexOf('`;', t)) + '`')();
  ok(true, 'P0: the cooked APP_JS parses (the template-literal gate)');
} catch (e) { ok(false, 'P0: the cooked APP_JS parses (the template-literal gate)', String(e).slice(0, 160)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

function buildPage(world) {
  const seedStarred = world === 'main' ? SEED_STARRED : world === 'prod' ? (STARRED_LIVE.starred || []) : [];
  const stub = `
window.__puts = [];
window.__podMarks = [];
window.__starredStore = ${JSON.stringify(seedStarred)};
window.fetch = function (path, opts) {
  var p = String(path);
  function ans(status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); }, text: function () { return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)); } }); }
  if (p.indexOf('/api/prayer/starred') === 0) {
    if (opts && opts.method === 'PUT') {
      var body = JSON.parse(opts.body);
      window.__puts.push(body.starred);
      window.__starredStore = body.starred;
      return ans(200, { ok: true, starred: window.__starredStore });
    }
    return ans(200, { ok: true, starred: window.__starredStore });
  }
  if (p.indexOf('/api/player/podcasts/mark') === 0 || p.indexOf('/api/player/podcasts/unmark') === 0) {
    var mb = JSON.parse(opts.body);
    window.__podMarks.push({ op: p.indexOf('unmark') >= 0 ? 'unmark' : 'mark', series: mb.series, seqKey: mb.seqKey });
    return ans(200, { ok: true });
  }
  if (p.indexOf('/api/prayer/book/favorites') === 0) return ans(200, { ok: true, favorites: [] });
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, { ok: true, groups: [] });
  if (p.indexOf('/api/player/track-draws') === 0) {
    var db = JSON.parse(opts.body); var draws = {};
    (db.keys || []).forEach(function (k) { if (k.indexOf('intro:') !== 0 && k.indexOf('seg:') !== 0) draws[k] = { intentionId: 1, text: 'For the harness intention pool' }; });
    return ans(200, { ok: true, date: db.date, draws: draws });
  }
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAYH)});
  if (p.indexOf('/api/player/source-settings') === 0) return ans(200, { ok: true, version: 1, sources: [] });
  if (p.indexOf('/api/player/podcasts?series=catechism-in-a-year') === 0) return ans(200, ${JSON.stringify(SERIES)});
  if (p.indexOf('/api/player/podcasts?series=') === 0) return ans(200, { ok: true, available: true, series: 'other', kind: 'rss', title: 'Other', entries: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
  return ans(200, { ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
window.HTMLMediaElement.prototype.play = function () { this.__playing = true; this.__ended = false; var el = this; Promise.resolve().then(function () { try { el.dispatchEvent(new Event('play')); } catch (e) {} }); return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () { this.__playing = false; };
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', { configurable: true, get: function () { return !this.__playing; } }); } catch (e) {}
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'ended', { configurable: true, get: function () { return !!this.__ended; } }); } catch (e) {}
`;
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<style>' + APP_CSS + '</style></head>'
    + '<body>' + SHELL
    + '<script>' + stub.replace(/<\/script>/g, '<\\/script>') + '<\/script>'
    + '<script>' + COOKED.replace(/<\/script>/g, '<\\/script>') + '<\/script></body></html>';
}

const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(world, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
  const page = await ctx.newPage();
  const html = buildPage(world);
  const srv = http.createServer((req, res) => {
    if ((req.url || '/').split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); }
    else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/');
  await sleep(300);
  await page.click('[data-tab="prayers"]');
  await page.waitForFunction(() => window.state && state.dayDescs && state.dayDescs.length >= 8, null, { timeout: 25000 }).catch(() => console.log('note -', tag, 'day build slow'));
  await sleep(600);
  return { ctx, page, srv };
}
async function openFavorites(page) {
  await page.click('[data-openblock="__favorites"]');
  await sleep(600);
}
async function menuLabels(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.anchmenu [data-menuitem]')).map((b) => b.textContent.trim()));
}
async function clickMenuItem(page, label) {
  await page.evaluate((l) => {
    const b = Array.from(document.querySelectorAll('.anchmenu [data-menuitem]')).find((x) => x.textContent.trim() === l);
    if (b) b.click();
  }, label);
  await sleep(400);
}
async function dragHandle(page, key, dy) {
  const sel = '[data-favhandle="' + key + '"]';
  const box = await page.locator(sel).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + dy, { steps: 12 });
  await sleep(150);
  await page.mouse.up();
  await sleep(300);
}

/* ---------------- MAIN: controls + reorder ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('main', errs, 'main');
  ok(errs.length === 0, 'MAIN0: boot clean — no page errors', errs.join(' · '));
  await page.waitForFunction(() => window.state && state.starred && state.starred.length === 4, null, { timeout: 15000 }).catch(() => console.log('note - seed settle slow'));
  await openFavorites(page);
  await sleep(500); // the warm read lands and repaints

  /* C1: the clusters */
  const c1 = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#favorites-list [data-card]'));
    const shape = (r) => ({
      card: r.getAttribute('data-card'),
      dot: !!r.querySelector('[data-markplayed]'),
      podmark: r.querySelector('[data-favpodmark]') ? { on: r.querySelector('[data-favpodmark]').classList.contains('on'), glyph: r.querySelector('[data-favpodmark]').textContent.trim() } : null,
      star: !!r.querySelector('[data-trackstar]'),
      menu: !!r.querySelector('[data-favmenu]'),
    });
    return rows.map(shape);
  });
  ok(c1.length === 4
    && c1[0].dot && !c1[0].podmark && c1[0].star && c1[0].menu
    && !c1[1].dot && c1[1].podmark && c1[1].podmark.on && c1[1].podmark.glyph === '✓' && c1[1].star && c1[1].menu
    && !c1[2].dot && c1[2].podmark && !c1[2].podmark.on && c1[2].star && c1[2].menu
    && c1[3].dot && c1[3].star && c1[3].menu,
    'C1 (Q1 A): every Favorites row carries mark · star · ⋮ routed by kind — the played dot on episode rows, the podmark on podcast rows (day-1 listened ✓ from the warmed series read, day-2 open)', JSON.stringify(c1));

  /* C6: Read on the text-carrying episode row */
  const hasRead = await page.evaluate(() => !!document.querySelector('#favorites-list [data-card="episode:morning-prayer"] [data-read]'));
  await page.click('#favorites-list [data-card="episode:morning-prayer"] [data-read]');
  await sleep(600);
  const c6 = await page.evaluate(() => {
    const sh = document.querySelector('.readsheet');
    const body = sh && sh.querySelector('.readtext');
    return { sheet: !!sh, text: body ? body.textContent.trim().length : 0 };
  });
  ok(hasRead && c6.sheet && c6.text > 0, 'C6 (Q1 A): Read stands on the text-carrying favorite and opens the reader with its text', JSON.stringify(c6));
  await page.evaluate(() => { const s = document.querySelector('.readsheet'); if (s) s.remove(); });
  await sleep(200);

  /* C2: the episode dot */
  await page.click('#favorites-list [data-card="episode:morning-prayer"] [data-markplayed]');
  await sleep(300);
  const c2a = await page.evaluate(() => ({
    on: document.querySelector('#favorites-list [data-card="episode:morning-prayer"] [data-markplayed]').classList.contains('on'),
    played: isPlayed('morning-prayer', presentedDateStr(), 'Morning'),
  }));
  ok(c2a.on && c2a.played, 'C2a (Q1 A): the Favorites dot marks the day track played in the standing day store at the presented date', JSON.stringify(c2a));
  await page.click('#favorites-list [data-card="episode:morning-prayer"] [data-markplayed]');
  await sleep(300);
  const c2b = await page.evaluate(() => ({
    on: document.querySelector('#favorites-list [data-card="episode:morning-prayer"] [data-markplayed]').classList.contains('on'),
    played: isPlayed('morning-prayer', presentedDateStr(), 'Morning'),
  }));
  ok(!c2b.on && !c2b.played, 'C2b: a second tap unmarks — the dot is the standing toggle', JSON.stringify(c2b));

  /* C4: the snapshot episode's mirror menu + Add to queue */
  await page.click('#favorites-list [data-card="episode:past-day-ep"] [data-favmenu]');
  await sleep(400);
  const c4labels = await menuLabels(page);
  ok(JSON.stringify(c4labels) === JSON.stringify(['Share', 'Add to queue', 'Open in Spotify']),
    'C4a (Q1 A): the past-day (snapshot-only) episode\'s ⋮ is the mirror menu — Share · Add to queue · Open in Spotify (the standing spotifyUrlFor read, the block fallback included, exactly as openDayRowMenu reads it), no Download that could not be honored', JSON.stringify(c4labels));
  await clickMenuItem(page, 'Add to queue');
  const c4 = await page.evaluate(() => ({ q: state.queue.map((d) => d.episodeId), idx: state.queueIdx, cur: state.current && state.current.episodeId }));
  ok(JSON.stringify(c4.q) === JSON.stringify(['past-day-ep']) && c4.idx === -1 && !c4.cur,
    'C4b: Add to queue from the Favorites row forms the waiting queue — nothing starts', JSON.stringify(c4));
  await page.evaluate(() => { state.queue = []; state.queueIdx = -1; state.queueFrom = null; });

  /* C5: the podcast mirror menu (series closed) + its mark act */
  await page.click('#favorites-list [data-card="podcast:catechism-in-a-year:ciy:day-2"] [data-favmenu]');
  await sleep(400);
  const c5labels = await menuLabels(page);
  ok(c5labels.includes('Share') && c5labels.includes('Mark as listened') && !c5labels.some((l) => l.indexOf('Download') === 0),
    'C5a (Q1 A): the podcast ⋮ with its series closed carries Share · Mark as listened (no Download — its state lives on the series page)', JSON.stringify(c5labels));
  await clickMenuItem(page, 'Mark as listened');
  const c5 = await page.evaluate(() => ({
    marks: window.__podMarks,
    face: (() => { const b = document.querySelector('#favorites-list [data-card="podcast:catechism-in-a-year:ciy:day-2"] [data-favpodmark]'); return b ? { on: b.classList.contains('on'), glyph: b.textContent.trim() } : null; })(),
  }));
  ok(c5.marks.some((m) => m.op === 'mark' && m.series === 'catechism-in-a-year' && m.seqKey === 'ciy:day-2') && c5.face && c5.face.on && c5.face.glyph === '✓',
    'C5b: the menu\'s mark act posts the standing mark route and the row\'s podmark flips in place', JSON.stringify(c5));

  /* C3: the podmark toggle posts mark/unmark with the series closed */
  await page.click('#favorites-list [data-card="podcast:catechism-in-a-year:ciy:day-2"] [data-favpodmark]');
  await sleep(400);
  await page.click('#favorites-list [data-card="podcast:catechism-in-a-year:ciy:day-1"] [data-favpodmark]');
  await sleep(400);
  const c3 = await page.evaluate(() => window.__podMarks);
  ok(c3.some((m) => m.op === 'unmark' && m.seqKey === 'ciy:day-2') && c3.some((m) => m.op === 'unmark' && m.seqKey === 'ciy:day-1'),
    'C3 (Q1 A): the podmark toggles post the standing unmark route for both episodes — the mark lives in the server listens store, routed by kind', JSON.stringify(c3));

  /* R1: the header menu's reach */
  await page.click('#hdr-menu');
  await sleep(400);
  const r1a = await menuLabels(page);
  ok(r1a.includes('Favorites') && r1a.includes('Reorder'),
    'R1a (Q4 A): the top overflow on the Favorites page carries its first page group — Favorites · Reorder', JSON.stringify(r1a));
  await page.evaluate(() => { const c = document.querySelector('.menucatcher'); if (c) c.click(); });
  await sleep(300);
  await page.evaluate(() => goListenHome('__favorites'));
  await sleep(400);
  await page.click('#hdr-menu');
  await sleep(400);
  const r1b = await menuLabels(page);
  await page.evaluate(() => { const c = document.querySelector('.menucatcher'); if (c) c.click(); });
  await sleep(300);
  await page.click('[data-openblock="Morning"]');
  await sleep(500);
  await page.click('#hdr-menu');
  await sleep(400);
  const r1c = await menuLabels(page);
  const r5 = await page.evaluate(() => ({ handles: document.querySelectorAll('[data-favhandle]').length, sortStands: true }));
  ok(!r1b.includes('Reorder') && !r1c.includes('Reorder') && r1c.includes('Sort') && r5.handles === 0,
    'R1b/R5 (Q3 A): Reorder stands on the Favorites page alone — the home menu and a day-built block page\'s menu carry Sort (blocks) and no Reorder; no handles stand on the block page', JSON.stringify({ home: r1b, block: r1c }));
  await page.evaluate(() => { const c = document.querySelector('.menucatcher'); if (c) c.click(); });
  await sleep(300);
  await page.evaluate(() => goListenHome('Morning'));
  await sleep(400);
  await openFavorites(page);

  /* R4: discard — drag, leave by Back, nothing written */
  const putsBefore = await page.evaluate(() => window.__puts.length);
  await page.click('#hdr-menu');
  await sleep(300);
  await clickMenuItem(page, 'Reorder');
  const r2 = await page.evaluate(() => ({
    barTitle: (document.getElementById('hdr2-title') || {}).textContent,
    done: !!document.getElementById('fav-done'),
    rows: document.querySelectorAll('#favorites-list [data-favrow]').length,
    handles: document.querySelectorAll('#favorites-list [data-favhandle]').length,
    controls: document.querySelectorAll('#favorites-list [data-trackstar], #favorites-list [data-favmenu], #favorites-list [data-starplay], #favorites-list [data-favpodmark], #favorites-list [data-markplayed]').length,
  }));
  ok(r2.barTitle === 'Reorder' && r2.done && r2.rows === 4 && r2.handles === 4 && r2.controls === 0,
    'R2 (Q4 A): reorder mode — the bar reads Reorder with Done standing, a ≡ handle on every row, and no other row controls', JSON.stringify(r2));
  await dragHandle(page, 'episode:morning-prayer', 200);
  const domAfterDrag = await page.evaluate(() => Array.from(document.querySelectorAll('#favorites-list [data-favrow]')).map((r) => r.getAttribute('data-favrow')));
  ok(domAfterDrag[0] !== 'episode:morning-prayer' && domAfterDrag.indexOf('episode:morning-prayer') >= 2,
    'R4a (Q4 A): the handle drag moves the row down the list in the DOM', JSON.stringify(domAfterDrag));
  await page.click('#hdrrow2 [data-back="__favorites"]');
  await sleep(500);
  const r4 = await page.evaluate(() => ({
    puts: window.__puts.length,
    order: (state.starred || []).map((e) => e.k + ':' + e.id),
    kind: state.prayersView && state.prayersView.kind,
  }));
  ok(r4.puts === putsBefore && r4.kind === 'home'
    && JSON.stringify(r4.order) === JSON.stringify(['episode:morning-prayer', 'podcast:ciy:day-1', 'podcast:ciy:day-2', 'episode:past-day-ep']),
    'R4b (Q4 A): leaving by Back DISCARDS — no starred PUT fired and the stored order stands untouched', JSON.stringify(r4));

  /* R3: Done saves through the whole-list PUT */
  await openFavorites(page);
  await page.click('#hdr-menu');
  await sleep(300);
  await clickMenuItem(page, 'Reorder');
  await dragHandle(page, 'episode:morning-prayer', 200);
  const dom2 = await page.evaluate(() => Array.from(document.querySelectorAll('#favorites-list [data-favrow]')).map((r) => r.getAttribute('data-favrow')));
  await page.click('#fav-done');
  await sleep(500);
  const r3 = await page.evaluate(() => ({
    barTitle: (document.getElementById('hdr2-title') || {}).textContent,
    lastPut: window.__puts.length ? window.__puts[window.__puts.length - 1].map((e) => starEntryKey(e)) : null,
    order: (state.starred || []).map((e) => starEntryKey(e)),
    menus: document.querySelectorAll('#favorites-list [data-favmenu]').length,
    handles: document.querySelectorAll('#favorites-list [data-favhandle]').length,
  }));
  ok(JSON.stringify(r3.lastPut) === JSON.stringify(dom2) && JSON.stringify(r3.order) === JSON.stringify(dom2)
    && r3.barTitle === 'Favorites' && r3.menus === 4 && r3.handles === 0,
    'R3 (Q2 A + Q4 A): Done saves the dragged order through the standing whole-list PUT (sort_order by array index, no migration) and exits to the full-control rows', JSON.stringify({ dom2, r3 }));
  ok(errs.length === 0, 'MAIN9: the main page carries no page errors after every leg', errs.join(' · '));
  await ctx.close(); srv.close();
}

/* ---------------- PROD: the production-shaped list ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('prod', errs, 'prod');
  await page.waitForFunction(() => window.state && state.starred && state.starred.length === 3, null, { timeout: 15000 }).catch(() => console.log('note - prod settle slow'));
  await openFavorites(page);
  await sleep(500);
  const pr = await page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll('#favorites-list [data-card]')).map((r) => r.getAttribute('data-card')),
    podmarks: document.querySelectorAll('#favorites-list [data-favpodmark]').length,
    menus: document.querySelectorAll('#favorites-list [data-favmenu]').length,
    stars: document.querySelectorAll('#favorites-list [data-trackstar]').length,
  }));
  ok(pr.rows.length === 3 && pr.rows[0] === 'podcast:daily-gospel-exegesis:f12a7182-b6fc-4de4-a0b8-e7c2a49c0e3b' && pr.podmarks === 3 && pr.menus === 3 && pr.stars === 3,
    'PROD1: John\'s LIVE starred list (the production fixture: exegesis + two Bible in a Year episodes) renders with the full control set on every row', JSON.stringify(pr));
  ok(errs.length === 0, 'PROD2: the production-shaped page carries no page errors', errs.join(' · '));
  await ctx.close(); srv.close();
}

/* ---------------- G439: the standing gate, as-is ---------------- */
{
  let out = '';
  try {
    out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const mm = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!mm && +mm[1] === 13 && +mm[2] === 2,
    'G439 (recorded as-is, not a v550 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    mm ? mm[0] : 'no summary line in the gate output');
}

await browser.close();
console.log('\nharness-v550: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
