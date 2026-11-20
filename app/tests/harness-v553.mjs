// harness-v553.mjs — v553 evidence: Favorites rows paint
// the Intention line — v539 fix-forward (production-defect
// fix-forward, To Ship, streamlined path; John's field
// report, Ora Pro Nobis thread, 2026-11-20 09:58 CT).
//   S statics: the diff against the production base
//     (GitHub main 4aed9b8 — the v550 ship tree) confined
//     to client.ts + the release document (+ the harness)
//     · index.ts byte-identical · ui.ts byte-identical on
//     the build tree (the SW pin moves only at Ship) ·
//     migrations end at 0042 (no new migration) ·
//     starredRowHtml carries the intention paint through
//     the standing trackDrawTextFor seam + intentionsOn();
//     the reorder-row builder carries none; the standing
//     machinery (trackDrawTextFor · starredDescFor ·
//     trackCard · settleTrackDraws) is byte-identical.
//   C client (Chromium, stubbed fetch, the v550 mold):
//     C1 a starred DAY track with a settled draw paints
//       "Intention: <its draw>"
//     C2 a starred PODCAST track with a settled draw
//       paints "Intention: <its draw>" (its own text —
//       the per-track rule)
//     C3 a starred track with NO settled draw paints
//       no line (podcast day-2 and the past-day snapshot)
//     C4 the Settings Intentions toggle OFF hides every
//       Favorites line; back ON restores them (the
//       standing setIntentions repaint)
// Settled draws in C: the day track's draw settles at the
// day build through the standing track-draws stub (then
// the harness overwrites the map entry with a distinct
// text, so the leg proves the row paints the map's own
// settled text); the podcast track's draw is seated in
// state.trackDraws directly — the standing map a play
// draw settles into — because the paint, not the settle
// machinery, is the surface under test (the settle
// machinery stands byte-identical, S5).
// Fixtures (Improvement D), from production, standing
// from the v550 harness: tests/fixtures-v550/
// starred-live.json (the LIVE starred read, production
// D1, 2026-11-20) and the live day fixture
// tests/fixtures-v522/day-live-2026-11-17.json (the
// harness seats minimal track records under the
// production episode ids, the v542/v547/v550 mold).
// Run: node app/tests/harness-v553.mjs [--probe] (from
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
const gitShow = (p) => execFileSync('git', ['show', '4aed9b8:' + p], { cwd: ROOT, encoding: 'utf8' });
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
  const changed = execFileSync('git', ['diff', '--name-only', '4aed9b8'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'releases/v553-favorites-intention-line.md' || p.startsWith('app/tests/harness-v553')),
    'S1a: the tracked diff against the production base is confined to client.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v553')),
    'S1b: the only untracked paths are the harness and its logs', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (client-only release)');
  ok(U_SRC === gitShow('app/worker/src/ui.ts'), 'S2b: ui.ts byte-identical to the base on the build tree (the SW pin moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2c: migration 0042 stands last (no new migration)', migs.slice(-2).join(','));
  const srh = fnBody(C_SRC, 'starredRowHtml') || '';
  ok(srh.includes('trackDrawTextFor') && srh.includes('Intention: ') && srh.includes('intentionsOn()') && srh.includes('track-draw-line'),
    'S3: starredRowHtml paints the Intention line through the standing seam, under the toggle');
  ok(!((fnBody(C_SRC, 'favReorderRowHtml') || '').includes('Intention')),
    'S4: the reorder-mode row builder carries no intention paint (unchanged surface)');
  for (const fn of ['trackDrawTextFor', 'trackKeyOf', 'settleTrackDraws', 'requestTrackDraws', 'starredDescFor', 'trackCard', 'paintFavoritesPage', 'favReorderRowHtml']) {
    ok(fnBody(C_SRC, fn) === fnBody(B_C, fn), 'S5-' + fn + ': byte-identical to the base (the standing machinery is ridden, not edited)');
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


/* ---------------- MAIN: the Favorites intention line ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('main', errs, 'main');
  ok(errs.length === 0, 'MAIN0: boot clean \u2014 no page errors', errs.join(' \u00b7 '));
  await page.waitForFunction(() => window.state && state.starred && state.starred.length === 4, null, { timeout: 15000 }).catch(() => console.log('note - seed settle slow'));
  // Seat the settled draws (see the header): distinct texts per track.
  await page.evaluate(() => {
    state.trackDrawsDate = presentedDateStr();
    if (!state.trackDraws) state.trackDraws = {};
    state.trackDraws['morning-prayer'] = 'For the day-track intention';
    state.trackDraws['ciy:day-1'] = 'For the podcast intention';
  });
  await openFavorites(page);
  await sleep(500);
  const rows = await page.evaluate(() => {
    const grab = (card) => {
      const r = document.querySelector('#favorites-list [data-card="' + card + '"]');
      if (!r) return null;
      const line = r.querySelector('.track-draw-line');
      return line ? line.textContent : null;
    };
    return {
      day: grab('episode:morning-prayer'),
      pod1: grab('podcast:catechism-in-a-year:ciy:day-1'),
      pod2: grab('podcast:catechism-in-a-year:ciy:day-2'),
      past: grab('episode:past-day-ep'),
    };
  });
  ok(rows.day === 'Intention: For the day-track intention',
    'C1: the starred DAY track paints its settled draw as "Intention: <text>" on the Favorites row', JSON.stringify(rows));
  ok(rows.pod1 === 'Intention: For the podcast intention',
    'C2: the starred PODCAST track paints its own settled draw \u2014 the per-track rule, not a shared line', JSON.stringify(rows));
  ok(rows.pod2 === null && rows.past === null,
    'C3: a starred track with no settled draw paints no line (podcast day-2; the past-day snapshot track)', JSON.stringify(rows));
  await page.evaluate(() => setIntentions(false));
  await sleep(400);
  const off = await page.evaluate(() => document.querySelectorAll('#favorites-list .track-draw-line').length);
  ok(off === 0, 'C4a: the Settings Intentions toggle OFF hides every Favorites intention line', String(off));
  await page.evaluate(() => setIntentions(true));
  await sleep(400);
  const on = await page.evaluate(() => document.querySelectorAll('#favorites-list .track-draw-line').length);
  ok(on === 2, 'C4b: the toggle back ON restores the two settled lines', String(on));
  ok(errs.length === 0, 'MAIN9: the page carries no page errors after every leg', errs.join(' \u00b7 '));
  await ctx.close(); srv.close();
}

await browser.close();
console.log('\nharness-v553: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' \u00b7 ')); process.exit(1); }
