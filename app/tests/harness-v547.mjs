// harness-v547.mjs — v547 evidence: Favorites folder
// under Pray — tracks only (John's correction to v546,
// 2026-11-19 22:55 CT: "No. That's not what I was
// thinking. A folder for favores and only tracks in
// there." — run level To Ship, the streamlined path).
//   S statics: the diff against the production base
//     (GitHub main fefa2bdd — v546 live) confined to
//     client.ts (+ the harness and its fixtures) ·
//     index.ts and ui.ts byte-identical (the pin moves
//     only at Ship) · migrations end at 0041 · mass*.ts /
//     logo*.ts byte-identical · the book favorites block
//     restored byte-for-byte in function against the
//     pre-v546 base (030bbc91) · no carry-in, no Starred
//     section, no prayer seam stands in client.ts · the
//     v546 queue machinery (starredPlayAll ·
//     starredAddAll · starredDescFor · saveQueueSnapshot ·
//     addToQueue) byte-identical to the base
//   C client (the v542/v544 Chromium mold, stubbed fetch):
//     SEP the separation world (the server's starred list
//       stands at the production BEFORE read — the three
//       prayer entries the v546 carry-in landed; the book
//       favorites stand at the three production slugs):
//       the store adopts tracks only (the prayer entries
//       never stand in the working copy, never render,
//       never count) · NO PUT to /api/prayer/starred ever
//       fires · the book reads its own three stars · a
//       book star toggles through /api/prayer/book/
//       favorites alone (off, then on — the round-trip),
//       the folder untouched · the folder page opens on
//       its empty line
//     CARRY the carry-in world (starred stands empty, the
//       book favorites stand): the v546 carry-in is DEAD —
//       no starred PUT, the folder reads empty, the book
//       still reads its three
//     MAIN the main world (the starred list seeded with a
//       podcast snapshot entry + a past-day episode
//       snapshot entry):
//       F1 no Starred section stands on the Praylist home;
//         the Favorites folder row stands between the
//         profile card and the block rows, its meta
//         counting tracks only
//       F2 the folder tap opens the Favorites page in the
//         block-page pattern (the bar reads Favorites, its
//         back standing); the list stands in order with
//         Play all + Add all; back returns home
//       T1 a day card's cluster reads dot · star · ⋮; the
//         tap lands the track at the folder list's head
//       T5 Play all on the folder page builds the mixed
//         queue in list order across kinds, provenance
//         starred, no snapshot; the ended-walk STOPS at
//         the list's end with autoplay ON
//       T3 a podcast row's star carries its series
//       T6 Add all on the folder page appends the whole
//         mixed list behind a standing single play
//       T9 Now Playing's queue rows carry no star; the
//         control row's star toggles the playing track
//       T4 a Catechesis Novenas card's star fills and does
//         not start playback
//       F7 un-starring from the folder page empties the
//         store, the page's empty line, and the final PUT
//   G439 (recorded as-is, NEVER a v547 pass): the
//     standing v439 boot gate at its standing reading
// Fixtures (Improvement D), from production: the
// standing live day fixture tests/fixtures-v522/
// day-live-2026-11-17.json (the harness injects track
// records under the production episode ids standing in
// its introTexts, the v542 mold) · the production reads
// drawn through the prayer door at build time into
// tests/fixtures-v547/ (book-live.json — 9 groups / 77
// prayers · book-favorites-live.json — John's standing
// favorites: prayer-after-communion · prayer-before-mass
// · grace-after-meals · starred-live.json — the BEFORE
// read: those same three standing in starred_tracks as
// prayer entries, the v546 carry-in's landing) · the
// podcast series payload in the v542 harness's shape.
// T4's novena slot settles through the app's own settle
// seam (ownSettlePresent) with a meta under the
// production novena id novena-st_cecilia, as in v546.
// Run: node app/tests/harness-v547.mjs [--probe] (from
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
const gitShow = (p) => execFileSync('git', ['show', 'fefa2bdd:' + p], { cwd: ROOT, encoding: 'utf8' });
const gitShowOld = (p) => execFileSync('git', ['show', '030bbc91:' + p], { cwd: ROOT, encoding: 'utf8' });
const B_C = gitShow('app/worker/src/client.ts');
const B_OLD_C = gitShowOld('app/worker/src/client.ts');
const DAY = JSON.parse(readFileSync(APP + '/tests/fixtures-v522/day-live-2026-11-17.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures-v547/book-live.json', 'utf8'));
const FAVS = JSON.parse(readFileSync(APP + '/tests/fixtures-v547/book-favorites-live.json', 'utf8'));
const STARRED_BEFORE = JSON.parse(readFileSync(APP + '/tests/fixtures-v547/starred-live.json', 'utf8'));
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
  b.tracks = (DAY_TRACKS[b.block] || []).map((id) => ({ episodeId: id, title: id, streamUrl: 'https://example.com/' + id + '.mp3', available: true, durationS: 600 }));
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
  { k: 'podcast', id: 'ciy:day-1', series: 'catechism-in-a-year', title: 'Day 1: In the Beginning', sub: 'Catechism in a Year', durationS: 900, imageUrl: '', block: 'Podcasts', url: 'https://example.com/ciy1.mp3', date: '2026-11-17' },
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
  const changed = execFileSync('git', ['diff', '--name-only', 'fefa2bdd'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p.startsWith('app/tests/harness-v547') || p.startsWith('app/tests/fixtures-v547/')),
    'S1a: the tracked diff against the production base is confined to client.ts + the harness and its fixtures', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v547') || p.startsWith('app/tests/fixtures-v547/')),
    'S1b: the only untracked paths are the harness, its logs, and its fixtures', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (no server change — the separation is client + data)');
  ok(U_SRC === gitShow('app/worker/src/ui.ts') && U_SRC.includes('ora-pro-nobis-v546-1') && !U_SRC.includes('ora-pro-nobis-v547-1'),
    'S2b: ui.ts byte-identical to the base — the SW pin stands at v546-1 on the build tree (it moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0041_starred_tracks.sql', 'S2c: migration 0041 stands last (no new migration)', migs.slice(-2).join(','));
  for (const f of ['mass.ts', 'mass-calendar.ts', 'mass-order.ts', 'mass-readings.ts', 'logo.ts', 'logo512.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === gitShow('app/worker/src/' + f), 'S2d-' + f + ': byte-identical to the production base');
  }
  for (const fn of ['bookFavsList', 'bookFavsSet', 'bookFavsSync', 'bookFavsLoad', 'toggleBookFav']) {
    ok(fnBody(C_SRC, fn) === fnBody(B_OLD_C, fn), 'S3-' + fn + ': restored byte-for-byte in function against the pre-v546 base (the book\'s own system on the 0028 routes)');
  }
  ok(!C_SRC.includes('starredCarryDone') && !(fnBody(C_SRC, 'starredLoad') || '').includes('book/favorites'),
    'S4a: the carry-in is gone — no flag, and starredLoad never reads the book favorites');
  ok(!C_SRC.includes('paintStarredSection') && !C_SRC.includes('starred-slot') && !C_SRC.includes('data-staropen') && !C_SRC.includes('Starred</h2>'),
    'S4b: the head section is gone — no section paint, no slot, no prayer-row seam stands in client.ts');
  ok((fnBody(C_SRC, 'toggleStar') || '').includes("entry.k === 'prayer'") && (fnBody(C_SRC, 'starredSet') || '').includes("e.k !== 'prayer'"),
    'S4c: the tracks-only guards stand — toggleStar refuses a prayer entry, starredSet filters at adoption');
  for (const fn of ['starredPlayAll', 'starredAddAll', 'starredDescFor', 'starredPlayableDescs', 'saveQueueSnapshot', 'addToQueue', 'renderQueueList']) {
    ok(fnBody(C_SRC, fn) === fnBody(B_C, fn), 'S5-' + fn + ': byte-identical to the base (the v546 list-playback machinery stands)');
  }
  ok(JSON.stringify(BOOK.groups.map((g) => g.prayers.length)) === '[24,5,13,9,5,4,7,2,8]'
    && JSON.stringify(FAVS.favorites) === JSON.stringify(['prayer-after-communion', 'prayer-before-mass', 'grace-after-meals'])
    && JSON.stringify((STARRED_BEFORE.starred || []).map((e) => e.k + ':' + e.id)) === JSON.stringify(['prayer:prayer-after-communion', 'prayer:prayer-before-mass', 'prayer:grace-after-meals'])
    && Object.values(DAY_TRACKS).flat().every((id) => Object.prototype.hasOwnProperty.call(DAY.introTexts, id)),
    'S6: the fixtures stand — the production book (9 groups / 77), John\'s production favorites (3 slugs), the BEFORE read (the same 3 standing in starred_tracks as prayer entries), and every seated track id in the day fixture\'s introTexts (production-drawn)');
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
  const seedStarred = world === 'main' ? SEED_STARRED : world === 'sep' ? (STARRED_BEFORE.starred || []) : [];
  const seedFavs = world === 'main' ? [] : FAVS.favorites;
  const stub = `
window.__puts = [];
window.__bookPuts = [];
window.__starredStore = ${JSON.stringify(seedStarred)};
window.__favs = ${JSON.stringify(seedFavs)};
window.fetch = function (path, opts) {
  var p = String(path);
  function ans(status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); }, text: function () { return Promise.resolve(JSON.stringify(body)); } }); }
  if (p.indexOf('/api/prayer/starred') === 0) {
    if (opts && opts.method === 'PUT') {
      var body = JSON.parse(opts.body);
      window.__puts.push(body.starred);
      window.__starredStore = body.starred;
      return ans(200, { ok: true, starred: window.__starredStore });
    }
    return ans(200, { ok: true, starred: window.__starredStore });
  }
  if (p.indexOf('/api/prayer/book/favorites') === 0) {
    if (opts && opts.method === 'PUT') {
      var bb = JSON.parse(opts.body);
      window.__bookPuts.push(bb.favorites);
      window.__favs = bb.favorites;
      return ans(200, { ok: true, favorites: window.__favs });
    }
    return ans(200, { ok: true, favorites: window.__favs });
  }
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, ${JSON.stringify(BOOK)});
  if (p.indexOf('/api/player/track-draws') === 0) {
    var db = JSON.parse(opts.body); var draws = {};
    (db.keys || []).forEach(function (k) { if (k.indexOf('intro:') !== 0 && k.indexOf('seg:') !== 0) draws[k] = { intentionId: 1, text: 'For the harness intention pool' }; });
    return ans(200, { ok: true, date: db.date, draws: draws });
  }
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAYH)});
  if (p.indexOf('/api/player/source-settings') === 0) return ans(200, { ok: true, version: 1, sources: [] });
  if (p.indexOf('/api/player/podcasts?series=') === 0) return ans(200, ${JSON.stringify(SERIES)});
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
  await page.click('[data-tab="prayers"]'); // the app cold-opens on Worship; the Praylist day build starts on the tab's open (the v542 boot)
  await page.waitForFunction(() => window.state && state.dayDescs && state.dayDescs.length >= 8, null, { timeout: 25000 }).catch(() => console.log('note -', tag, 'day build slow'));
  await sleep(600);
  return { ctx, page, srv };
}

/* ---------------- SEP: the separation world ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('sep', errs, 'sep');
  ok(errs.length === 0, 'SEP0: boot clean — no page errors on the separation page', errs.join(' · '));
  await sleep(700);
  const s0 = await page.evaluate(() => ({
    starred: (state.starred || []).map((e) => e.k + ':' + e.id),
    puts: window.__puts.length,
    folderMeta: (() => { const r = document.querySelector('[data-openblock="__favorites"] .meta'); return r ? r.textContent : null; })(),
    sectionHeads: Array.from(document.querySelectorAll('h2.sectionhead')).map((h) => h.textContent),
    slotGone: !document.getElementById('starred-slot'),
  }));
  ok(JSON.stringify(s0.starred) === '[]' && s0.puts === 0,
    'SEP1 (tracks only): the BEFORE read\'s three prayer entries never stand in the working copy — adoption filters them — and no starred PUT fires to clean them (the cleanup is the Ship\'s data act, not the client\'s)', JSON.stringify(s0));
  ok(s0.folderMeta === 'No starred tracks yet' && s0.slotGone && !s0.sectionHeads.some((h) => h.includes('Starred')),
    'SEP2 (folder, not a section): the folder row reads its empty line, no #starred-slot stands, and no Starred section head stands on the home', JSON.stringify(s0));
  // The folder page opens on its empty line; no prayer row renders.
  await page.click('[data-openblock="__favorites"]');
  await sleep(500);
  const s1 = await page.evaluate(() => ({
    kind: state.prayersView && state.prayersView.kind,
    cards: document.querySelectorAll('#favorites-list [data-card]').length,
    empty: (document.getElementById('favorites-list') || { textContent: '' }).textContent.includes('No starred tracks yet'),
    barTitle: (document.getElementById('hdr2-title') || {}).textContent,
  }));
  ok(s1.kind === 'favorites' && s1.cards === 0 && s1.empty && s1.barTitle === 'Favorites',
    'SEP3: the folder tap opens the Favorites page (the bar reads Favorites) on its empty line — the three book prayers never render there', JSON.stringify(s1));
  await page.evaluate(() => goListenHome('__favorites'));
  await sleep(400);
  // The book reads its OWN system: the three stars filled.
  await page.click('#sidetoggle [data-side="book"]');
  await page.waitForSelector('[data-bookstar]', { timeout: 15000 }).catch(() => console.log('note - book slow'));
  await sleep(400);
  const glyph = (slug) => page.evaluate((s) => { const b = document.querySelector('[data-bookstar="' + s + '"]'); return b ? b.textContent : null; }, slug);
  const bk = { f1: await glyph('prayer-after-communion'), f2: await glyph('prayer-before-mass'), f3: await glyph('grace-after-meals'), other: await glyph('our-father') };
  ok(bk.f1 === '★' && bk.f2 === '★' && bk.f3 === '★' && bk.other === '☆',
    'SEP4 (the book\'s own system): the book\'s stars read prayer_book_favorites through its own load — the three favorites filled, another prayer open', JSON.stringify(bk));
  // The round-trip: one favorite off, then on — through the book route alone.
  await page.click('[data-bookstar="grace-after-meals"]');
  await sleep(400);
  const off = await page.evaluate(() => ({
    lastBookPut: window.__bookPuts.length ? window.__bookPuts[window.__bookPuts.length - 1] : null,
    glyphOff: (() => { const b = document.querySelector('[data-bookstar="grace-after-meals"]'); return b ? b.textContent : null; })(),
    starredPuts: window.__puts.length,
    starred: (state.starred || []).length,
  }));
  ok(JSON.stringify(off.lastBookPut) === JSON.stringify(['prayer-after-communion', 'prayer-before-mass']) && off.glyphOff === '☆' && off.starredPuts === 0 && off.starred === 0,
    'SEP5 (the separation, book side): un-starring a prayer PUTs the book list alone — the starred store is never written and never holds it', JSON.stringify(off));
  await page.click('[data-bookstar="grace-after-meals"]');
  await sleep(400);
  const on = await page.evaluate(() => ({
    lastBookPut: window.__bookPuts.length ? window.__bookPuts[window.__bookPuts.length - 1] : null,
    glyphOn: (() => { const b = document.querySelector('[data-bookstar="grace-after-meals"]'); return b ? b.textContent : null; })(),
    starredPuts: window.__puts.length,
  }));
  ok(JSON.stringify(on.lastBookPut) === JSON.stringify(FAVS.favorites) && on.glyphOn === '★' && on.starredPuts === 0,
    'SEP6 (the round-trip): re-starring restores the three production slugs through the book route, in order — and the folder\'s store still stands untouched', JSON.stringify(on));
  ok(errs.length === 0, 'SEP7: the separation page carries no page errors after every leg', errs.join(' · '));
  await ctx.close(); srv.close();
}

/* ---------------- CARRY: the carry-in is dead ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('carry', errs, 'carry');
  ok(errs.length === 0, 'CARRY0: boot clean — no page errors on the carry page', errs.join(' · '));
  await sleep(900);
  const c0 = await page.evaluate(() => ({
    puts: window.__puts.map((p) => p.map((e) => e.k + ':' + e.id)),
    starred: (state.starred || []).length,
    folderMeta: (() => { const r = document.querySelector('[data-openblock="__favorites"] .meta'); return r ? r.textContent : null; })(),
  }));
  ok(c0.puts.length === 0 && c0.starred === 0 && c0.folderMeta === 'No starred tracks yet',
    'CARRY1 (v546\'s A-world, inverted): starred stands empty and the book favorites stand — NO carry-in PUT fires, the folder reads empty (the two systems stand apart)', JSON.stringify(c0));
  await page.click('#sidetoggle [data-side="book"]');
  await page.waitForSelector('[data-bookstar]', { timeout: 15000 }).catch(() => console.log('note - book slow'));
  await sleep(400);
  const bk = await page.evaluate(() => {
    const g = (s) => { const b = document.querySelector('[data-bookstar="' + s + '"]'); return b ? b.textContent : null; };
    return { f1: g('prayer-after-communion'), f2: g('prayer-before-mass'), f3: g('grace-after-meals') };
  });
  ok(bk.f1 === '★' && bk.f2 === '★' && bk.f3 === '★',
    'CARRY2: the book still reads its own three favorites on its own route — nothing was carried anywhere', JSON.stringify(bk));
  ok(errs.length === 0, 'CARRY3: the carry page carries no page errors', errs.join(' · '));
  await ctx.close(); srv.close();
}

/* ---------------- MAIN: the folder world ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('main', errs, 'main');
  ok(errs.length === 0, 'MAIN0: boot clean — no page errors on the main page', errs.join(' · '));
  await page.waitForFunction(() => window.state && state.starred && state.starred.length === 2, null, { timeout: 15000 }).catch(() => console.log('note - seed settle slow'));
  const home = await page.evaluate(() => ({
    slotGone: !document.getElementById('starred-slot'),
    sectionHeads: Array.from(document.querySelectorAll('h2.sectionhead')).map((h) => h.textContent),
    folderMeta: (() => { const r = document.querySelector('[data-openblock="__favorites"] .meta'); return r ? r.textContent : null; })(),
    folderBeforeBody: (() => { const f = document.querySelector('[data-openblock="__favorites"]'); const b = document.getElementById('home-body'); return !!(f && b && (f.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); })(),
    folderTitle: (() => { const h = document.querySelector('[data-openblock="__favorites"] h3'); return h ? h.textContent : null; })(),
  }));
  ok(home.slotGone && !home.sectionHeads.some((h) => h.includes('Starred')) && home.folderTitle === 'Favorites' && home.folderMeta.startsWith('2 tracks') && home.folderBeforeBody,
    'F1 (folder, not a section): no Starred section stands on the Praylist home; the Favorites folder row stands between the profile card and the block rows, its meta counting the two seeded TRACKS', JSON.stringify(home));

  /* F2: the folder page */
  await page.click('[data-openblock="__favorites"]');
  await sleep(500);
  const f2 = await page.evaluate(() => ({
    kind: state.prayersView && state.prayersView.kind,
    rows: Array.from(document.querySelectorAll('#favorites-list [data-card]')).map((r) => r.getAttribute('data-card')),
    acts: !!document.getElementById('starred-playall') && !!document.getElementById('starred-addall'),
    barTitle: (document.getElementById('hdr2-title') || {}).textContent,
    backStands: !!document.querySelector('#hdrrow2 [data-back="__favorites"]'),
  }));
  ok(f2.kind === 'favorites' && JSON.stringify(f2.rows) === JSON.stringify(['podcast:catechism-in-a-year:ciy:day-1', 'episode:past-day-ep']) && f2.acts && f2.barTitle === 'Favorites' && f2.backStands,
    'F2: the folder tap opens the Favorites page in the block-page pattern — the bar reads Favorites with its back standing, the list in order, Play all + Add all at its head', JSON.stringify(f2));
  await page.click('#hdrrow2 [data-back="__favorites"]');
  await sleep(500);
  const f2b = await page.evaluate(() => state.prayersView && state.prayersView.kind);
  ok(f2b === 'home', 'F2b: the page\'s back returns to the Listen home', String(f2b));

  /* T1: the day card's star lands in the folder */
  await page.click('[data-openblock="Morning"]');
  await page.waitForSelector('[data-trackstar="episode:morning-prayer"]', { timeout: 15000 }).catch(() => console.log('note - block page slow'));
  const cluster = await page.evaluate(() => {
    const card = document.querySelector('[data-trackstar="episode:morning-prayer"]').closest('.card');
    const cl = card.querySelector('.prow-cluster');
    return { kids: Array.from(cl.children).map((c) => c.getAttribute('data-trackstar') ? 'star' : (c.getAttribute('data-rowmenu') ? 'menu' : (c.getAttribute('data-markplayed') || c.className))), glyph: card.querySelector('[data-trackstar]').textContent };
  });
  ok(cluster.kids.length === 3 && cluster.kids[1] === 'star' && cluster.kids[2] === 'menu' && cluster.glyph === '☆',
    'T1a: the day card\'s cluster reads played dot · star · ⋮, the star open (the v546 seat stands)', JSON.stringify(cluster.kids));
  await page.click('[data-trackstar="episode:morning-prayer"]');
  await sleep(400);
  const t1 = await page.evaluate(() => ({
    head: state.starred[0] && state.starred[0].k + ':' + state.starred[0].id,
    glyph: document.querySelector('[data-trackstar="episode:morning-prayer"]').textContent,
    lastPutHead: window.__puts.length ? (window.__puts[window.__puts.length - 1][0] || {}).id : null,
  }));
  ok(t1.head === 'episode:morning-prayer' && t1.glyph === '★' && t1.lastPutHead === 'morning-prayer',
    'T1b: the tap fills the star, the track takes the list\'s head, and the whole-list PUT carries it first', JSON.stringify(t1));
  await page.evaluate(() => goListenHome('Morning'));
  await sleep(500);
  await page.click('[data-openblock="__favorites"]');
  await sleep(500);
  const headRow = await page.evaluate(() => { const r = document.querySelector('#favorites-list [data-card]'); return r ? r.getAttribute('data-card') : null; });
  ok(headRow === 'episode:morning-prayer', 'T1c: in the folder, the head row is the just-starred track', String(headRow));

  /* T5: Play all on the folder page — the mixed queue, the stop at the end */
  await page.evaluate(() => setAutoplay(true));
  await page.click('#starred-playall');
  await sleep(500);
  const q = await page.evaluate(() => ({
    ids: state.queue.map((d) => d.episodeId),
    kinds: state.queue.map((d) => d.kind || 'day'),
    from: state.queueFrom,
    cur: state.current && state.current.episodeId,
    snap: localStorage.getItem('opn-queue-v355'),
  }));
  ok(JSON.stringify(q.ids) === JSON.stringify(['morning-prayer', 'ciy:day-1', 'past-day-ep'])
    && JSON.stringify(q.kinds) === JSON.stringify(['day', 'podcast', 'day']) && q.from === 'starred' && q.cur === 'morning-prayer' && q.snap === null,
    'T5a (the list plays as a list): Play all on the folder page builds the queue in list order ACROSS kinds, provenance starred, no queue snapshot written',
    JSON.stringify(q));
  const walk = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { document.getElementById('audio').dispatchEvent(new Event('ended')); });
    await sleep(450);
    walk.push(await page.evaluate(() => (state.current ? state.current.episodeId : null)));
  }
  const endState = await page.evaluate(() => ({ cur: state.current, qlen: state.queue.length, from: state.queueFrom }));
  ok(JSON.stringify(walk) === JSON.stringify(['ciy:day-1', 'past-day-ep', null]) && endState.cur === null && endState.qlen === 0,
    'T5b: the ended-walk plays each list track in turn and STOPS at the list\'s end with autoplay ON — the day chain never joins it',
    JSON.stringify(walk));

  /* T3: the podcast row's star */
  await page.click('[data-tab="podcasts"]');
  await sleep(500);
  await page.evaluate(() => openPodSeries('catechism-in-a-year'));
  await page.waitForSelector('[data-trackstar="podcast:catechism-in-a-year:ciy:day-2"]', { timeout: 15000 }).catch(() => console.log('note - series page slow'));
  await page.click('[data-trackstar="podcast:catechism-in-a-year:ciy:day-2"]');
  await sleep(400);
  const t3 = await page.evaluate(() => ({
    head: state.starred[0] && { k: state.starred[0].k, id: state.starred[0].id, series: state.starred[0].series, sub: state.starred[0].sub },
    glyph: document.querySelector('[data-trackstar="podcast:catechism-in-a-year:ciy:day-2"]').textContent,
  }));
  ok(t3.head && t3.head.k === 'podcast' && t3.head.id === 'ciy:day-2' && t3.head.series === 'catechism-in-a-year' && t3.head.sub === 'Catechism in a Year' && t3.glyph === '★',
    'T3: a podcast row\'s star fills; the entry stands at the list\'s head carrying its series', JSON.stringify(t3));

  /* T6: Add all on the folder page behind a standing single play */
  await page.evaluate(() => setAutoplay(false));
  await page.evaluate(() => { document.querySelector('[data-podplay="ciy:day-2"]').click(); });
  await sleep(500);
  const single = await page.evaluate(() => ({ cur: state.current && state.current.episodeId, kind: state.current && state.current.kind, q: state.queue.map((d) => d.episodeId), from: state.queueFrom }));
  ok(single.cur === 'ciy:day-2' && single.kind === 'podcast' && JSON.stringify(single.q) === JSON.stringify(['ciy:day-2']) && single.from === null,
    'T6a: a single podcast play stands alone (autoplay OFF, the v542 single-play rule)', JSON.stringify(single));
  await page.click('[data-tab="prayers"]');
  await sleep(400);
  await page.evaluate(() => { state.prayersView = { kind: 'home' }; paintPrayersView(state.dayPayload); });
  await sleep(400);
  await page.click('[data-openblock="__favorites"]');
  await sleep(500);
  await page.click('#starred-addall');
  await sleep(400);
  const t6 = await page.evaluate(() => ({
    ids: state.queue.map((d) => d.episodeId),
    kinds: state.queue.map((d) => d.kind || 'day'),
    from: state.queueFrom, idx: state.queueIdx,
  }));
  ok(JSON.stringify(t6.ids) === JSON.stringify(['ciy:day-2', 'ciy:day-2', 'morning-prayer', 'ciy:day-1', 'past-day-ep'])
    && t6.kinds[0] === 'podcast' && t6.kinds.slice(1).includes('day') && t6.from === 'starred' && t6.idx === 0,
    'T6b: Add all on the folder page appends the whole mixed list behind the standing single play — [current, ...list] across kinds, no kind bound', JSON.stringify(t6));

  /* T9: Now Playing — no star in the queue rows; the control row's star toggles */
  await page.evaluate(() => openNowPlaying());
  await page.waitForSelector('#np-star', { timeout: 15000 }).catch(() => console.log('note - NP slow'));
  await sleep(300);
  const np0 = await page.evaluate(() => ({
    queueStars: document.querySelectorAll('#np-queue [data-trackstar]').length,
    npGlyph: document.getElementById('np-star').textContent,
  }));
  ok(np0.queueStars === 0 && np0.npGlyph === '★',
    'T9a: Now Playing\'s queue rows carry NO star; the control row\'s star reads the playing track\'s standing star (ciy:day-2 stands starred)', JSON.stringify(np0));
  await page.click('#np-star');
  await sleep(400);
  const np1 = await page.evaluate(() => ({
    glyph: document.getElementById('np-star').textContent,
    stillThere: state.starred.some((e) => e.k === 'podcast' && e.id === 'ciy:day-2' && e.series === 'catechism-in-a-year'),
  }));
  ok(np1.glyph === '☆' && !np1.stillThere,
    'T9b: the Now Playing star toggles the playing track OFF the list', JSON.stringify(np1));
  await page.evaluate(() => { const s = document.querySelector('.np-sheet'); if (s) s.remove(); });

  /* T4: the Catechesis Novenas card's star */
  const before = await page.evaluate(() => (state.current ? state.current.episodeId : null));
  await page.evaluate(() => {
    ownSettlePresent(state.dayPayload, catechesisNovenasRow(), [{
      episodeId: 'novena-st_cecilia', title: 'Novena to St. Cecilia', state: 'present',
      streamUrl: 'https://example.com/novena-st_cecilia.mp3', enclosureUrl: 'https://example.com/novena-st_cecilia.mp3',
      durationS: 600, imageUrl: '',
    }]);
  });
  await page.click('[data-tab="podcasts"]');
  await sleep(400);
  await page.evaluate(() => switchPodSide('novenas'));
  await page.waitForSelector('[data-novplay="novena-st_cecilia"] [data-trackstar]', { timeout: 15000 }).catch(() => console.log('note - novenas side slow'));
  await page.click('[data-novplay="novena-st_cecilia"] [data-trackstar]');
  await sleep(400);
  const t4 = await page.evaluate(() => ({
    has: state.starred.some((e) => e.k === 'episode' && e.id === 'novena-st_cecilia'),
    glyph: document.querySelector('[data-novplay="novena-st_cecilia"] [data-trackstar]').textContent,
    cur: state.current ? state.current.episodeId : null,
  }));
  ok(t4.has && t4.glyph === '★' && t4.cur === before,
    'T4: the Catechesis Novenas card\'s star fills, the novena episode stands in the list, and the tap does NOT start playback', JSON.stringify(t4));

  /* F7: un-star everything from the folder page; the empty line stands */
  await page.click('[data-tab="prayers"]');
  await sleep(400);
  await page.evaluate(() => { state.prayersView = { kind: 'home' }; paintPrayersView(state.dayPayload); });
  await sleep(400);
  await page.click('[data-openblock="__favorites"]');
  await sleep(500);
  for (let i = 0; i < 10; i++) {
    const done = await page.evaluate(() => {
      if (!state.starred.length) return true;
      const b = document.querySelector('#favorites-list [data-trackstar]');
      if (b) { b.click(); return false; }
      return true;
    });
    if (done) break;
    await sleep(300);
  }
  await sleep(400);
  const t8 = await page.evaluate(() => ({
    n: state.starred.length,
    empty: (document.getElementById('favorites-list') || { textContent: '' }).textContent.includes('No starred tracks yet'),
    lastPut: window.__puts.length ? window.__puts[window.__puts.length - 1].length : -1,
  }));
  ok(t8.n === 0 && t8.empty && t8.lastPut === 0,
    'F7: un-starring from the folder page empties the list everywhere — the store, the page\'s empty line, and the final whole-list PUT all read empty', JSON.stringify(t8));
  ok(errs.length === 0, 'MAIN9: the main page carries no page errors after every leg', errs.join(' · '));
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
    'G439 (recorded as-is, not a v547 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    mm ? mm[0] : 'no summary line in the gate output');
}

await browser.close();
console.log('\nharness-v547: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
