// harness-v552.mjs — v552 evidence: Favorites page —
// Play all moves to the header bar; Add all to queue
// moves to the top overflow menu (John's approval, Ora
// Pro Nobis thread, 2026-11-20 11:57 CT — scope package
// 53, Q1–Q5 all A, run level To Ship, streamlined path).
//   S statics: the diff against the production base
//     (GitHub main 5d7e31b — the v554 ship tree) confined
//     to client.ts + the release document (+ the harness)
//     · index.ts byte-identical · ui.ts byte-identical on
//     the build tree (the SW pin moves only at Ship) ·
//     migrations end at 0042 (no new migration) ·
//     paintFavoritesPage carries the .playbtn.small disc
//     in the bar's right slot under the standing
//     starred-playall id and no in-page acts row ·
//     openHeaderMenu seats 'Add all to queue' above the
//     unedited Reorder push · the acts and the standing
//     machinery (starredPlayAll · starredAddAll ·
//     starredPlayableDescs · starredRowHtml ·
//     favReorderRowHtml · hdrBarHtml · paintPrayersBar)
//     are byte-identical.
//   C client (Chromium, stubbed fetch, the v550 mold):
//     C1 non-empty list: the bar's right slot carries the
//       ▶ disc (aria-label "Play all of Favorites"); the
//       in-page button row is gone from the list
//     C2 the header menu's Favorites group reads
//       Favorites · Add all to queue · Reorder
//     C3 the menu's Add all item runs the act: the whole
//       list joins the queue in list order, queueFrom
//       'starred', nothing starts
//     C4 a disc tap runs Play all: the queue stands in
//       list order under 'starred' provenance and the
//       first track is current
//     C5 Reorder still enters reorder mode from the same
//       menu (bar reads Reorder, a handle on every row)
//     C6 empty list: no disc in the bar, and the menu's
//       Favorites group carries neither act item
// Fixtures (Improvement D), from production, standing
// from the v550 harness: tests/fixtures-v550/
// starred-live.json (the LIVE starred read, production
// D1, 2026-11-20) and the live day fixture
// tests/fixtures-v522/day-live-2026-11-17.json (the
// harness seats minimal track records under the
// production episode ids, the v542/v547/v550 mold).
// Run: node app/tests/harness-v552.mjs [--probe] (from
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
const BASE = '5d7e31b';
const gitShow = (p) => execFileSync('git', ['show', BASE + ':' + p], { cwd: ROOT, encoding: 'utf8' });
const B_C = gitShow('app/worker/src/client.ts');
const DAY = JSON.parse(readFileSync(APP + '/tests/fixtures-v522/day-live-2026-11-17.json', 'utf8'));
const STARRED_LIVE = JSON.parse(readFileSync(APP + '/tests/fixtures-v550/starred-live.json', 'utf8'));
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
const LIST_IDS = ['morning-prayer', 'ciy:day-1', 'ciy:day-2', 'past-day-ep'];
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
  const changed = execFileSync('git', ['diff', '--name-only', BASE], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'releases/v552-favorites-header-controls.md' || p.startsWith('app/tests/harness-v552')),
    'S1a: the tracked diff against the production base is confined to client.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v552') || p === 'releases/v552-favorites-header-controls.md'),
    'S1b: the only untracked paths are the harness, its logs, and the release document', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (client-only release)');
  ok(U_SRC === gitShow('app/worker/src/ui.ts'), 'S2b: ui.ts byte-identical to the base on the build tree (the SW pin moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2c: migration 0042 stands last (no new migration)', migs.slice(-2).join(','));
  const pfp = fnBody(C_SRC, 'paintFavoritesPage') || '';
  ok(pfp.includes('playbtn small') && pfp.includes('id="starred-playall"') && pfp.includes('aria-label="Play all of Favorites"') && pfp.includes('rightHtml'),
    'S3a: paintFavoritesPage seats the .playbtn.small disc in the bar right slot under the standing id, in the block pages form');
  ok(!pfp.includes('starred-addall') && !pfp.includes('>Play all</button>') && !pfp.includes('>Add all to queue</button>'),
    'S3b: the in-page acts row is gone from paintFavoritesPage whole (no ghost buttons, no addall wiring)');
  const ohm = fnBody(C_SRC, 'openHeaderMenu') || '';
  const addIdx = ohm.indexOf("'Add all to queue'");
  const reIdx = ohm.indexOf("'Reorder'");
  ok(addIdx > 0 && reIdx > addIdx && ohm.includes('starredAddAll'),
    'S4a: openHeaderMenu seats Add all to queue (the starredAddAll act) ABOVE Reorder in the Favorites group');
  ok(ohm.includes("if (!favReorder && favoritesList().length >= 2) items.push({ label: 'Reorder', act: function () { enterFavReorder(); } });"),
    'S4b: the Reorder push stands unedited (Q3 A — its v550 seat unchanged)');
  for (const fn of ['starredPlayAll', 'starredAddAll', 'starredPlayableDescs', 'starredRowHtml', 'favReorderRowHtml', 'hdrBarHtml', 'paintPrayersBar', 'enterFavReorder']) {
    ok(fnBody(C_SRC, fn) === fnBody(B_C, fn), 'S5-' + fn + ': byte-identical to the base (the acts and machinery are ridden, not edited)');
  }
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


/* ---------------- MAIN: the two seat moves ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('main', errs, 'main');
  ok(errs.length === 0, 'MAIN0: boot clean \u2014 no page errors', errs.join(' \u00b7 '));
  await page.waitForFunction(() => window.state && state.starred && state.starred.length === 4, null, { timeout: 15000 }).catch(() => console.log('note - seed settle slow'));
  await openFavorites(page);

  const c1 = await page.evaluate(() => {
    const bar = document.getElementById('hdrrow2');
    const disc = bar ? bar.querySelector('.hdr2-right .playbtn.small') : null;
    const list = document.getElementById('favorites-list');
    return {
      disc: !!disc,
      discId: disc ? disc.id : null,
      discLabel: disc ? disc.getAttribute('aria-label') : null,
      discInBar: !!(disc && bar.contains(disc)),
      inListPlay: !!(list && list.querySelector('#starred-playall')),
      inListAdd: !!(list && list.querySelector('#starred-addall')),
      ghostRow: !!(list && Array.from(list.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Play all' || b.textContent.trim() === 'Add all to queue')),
      rows: list ? list.querySelectorAll('[data-card]').length : 0,
    };
  });
  ok(c1.disc && c1.discInBar && c1.discId === 'starred-playall' && c1.discLabel === 'Play all of Favorites' && c1.rows === 4,
    'C1a (Q1 A): the bar right slot carries the \u25b6 disc (.playbtn.small, aria-label "Play all of Favorites") on a non-empty list', JSON.stringify(c1));
  ok(!c1.inListPlay && !c1.inListAdd && !c1.ghostRow,
    'C1b: the in-page button row is gone \u2014 neither act stands inside the list', JSON.stringify(c1));

  await page.click('#hdr-menu');
  await sleep(400);
  const labels = await menuLabels(page);
  const fi = labels.indexOf('Favorites'), ai = labels.indexOf('Add all to queue'), ri = labels.indexOf('Reorder');
  ok(fi >= 0 && ai === fi + 1 && ri === ai + 1,
    'C2 (Q2 A \u00b7 Q3 A): the header menu Favorites group reads Favorites \u00b7 Add all to queue \u00b7 Reorder \u2014 Add all above Reorder', JSON.stringify(labels));

  await clickMenuItem(page, 'Add all to queue');
  const c3 = await page.evaluate(() => ({ q: state.queue.map((d) => d.episodeId), idx: state.queueIdx, from: state.queueFrom, cur: state.current && state.current.episodeId }));
  ok(JSON.stringify(c3.q) === JSON.stringify(LIST_IDS) && c3.idx === -1 && !c3.cur && c3.from === 'starred',
    'C3: the menu Add all item runs the act \u2014 the whole list joins as a waiting queue in list order, starred provenance, nothing starts', JSON.stringify(c3));
  await page.evaluate(() => { state.queue = []; state.queueIdx = -1; state.queueFrom = null; });

  await page.click('#hdrrow2 #starred-playall');
  await sleep(500);
  const c4 = await page.evaluate(() => ({ q: state.queue.map((d) => d.episodeId), from: state.queueFrom, cur: state.current && state.current.episodeId }));
  ok(JSON.stringify(c4.q) === JSON.stringify(LIST_IDS) && c4.from === 'starred' && c4.cur === 'morning-prayer',
    'C4: a disc tap runs Play all \u2014 the queue stands in list order under starred provenance, the first track current', JSON.stringify(c4));

  await page.click('#hdr-menu');
  await sleep(400);
  await clickMenuItem(page, 'Reorder');
  const c5 = await page.evaluate(() => ({
    title: (document.getElementById('hdr2-title') || {}).textContent,
    handles: document.querySelectorAll('#favorites-list [data-favhandle]').length,
    done: !!document.getElementById('fav-done'),
  }));
  ok(c5.title === 'Reorder' && c5.handles === 4 && c5.done,
    'C5 (Q3 A): Reorder still enters reorder mode from the same menu \u2014 bar reads Reorder, Done stands, a handle on every row', JSON.stringify(c5));
  await page.click('#fav-done');
  await sleep(400);
  ok(errs.length === 0, 'MAIN9: the page carries no page errors after every leg', errs.join(' \u00b7 '));
  await ctx.close(); srv.close();
}

/* ---------------- EMPTY: no disc, no menu acts ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('empty', errs, 'empty');
  await page.waitForFunction(() => window.state && Array.isArray(state.starred), null, { timeout: 15000 }).catch(() => console.log('note - empty settle slow'));
  await openFavorites(page);
  const c6 = await page.evaluate(() => {
    const bar = document.getElementById('hdrrow2');
    return {
      disc: !!(bar && bar.querySelector('.playbtn.small')),
      title: (document.getElementById('hdr2-title') || {}).textContent,
      emptyCard: (document.getElementById('favorites-list') || { textContent: '' }).textContent.includes('No starred tracks yet'),
    };
  });
  ok(c6.title === 'Favorites' && !c6.disc && c6.emptyCard,
    'C6a (Q4 A): an empty list paints the Favorites page with NO disc in the bar', JSON.stringify(c6));
  await page.click('#hdr-menu');
  await sleep(400);
  const labels = await menuLabels(page);
  ok(labels.includes('Favorites') && !labels.includes('Add all to queue') && !labels.includes('Reorder'),
    'C6b: on the empty list the menu Favorites group carries neither act item (no dead items)', JSON.stringify(labels));
  ok(errs.length === 0, 'EMPTY9: the page carries no page errors', errs.join(' \u00b7 '));
  await ctx.close(); srv.close();
}

await browser.close();
console.log('\nharness-v552: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' \u00b7 ')); process.exit(1); }
