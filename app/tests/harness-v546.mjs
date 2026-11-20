// harness-v546.mjs — v546 evidence: Star any track
// (scope package 49 "starred-tracks", John's approval 37,
// run level To Ship; decisions Q1 A · Q2 B · Q3 A · Q4 A —
// Q2/Q3 are John's picks AGAINST the package
// recommendations and are built as chosen).
//   S statics: the diff against the production base
//     (main 030bbc91 — v544 live + the v545 consolidation)
//     confined to client.ts · index.ts · ui.ts (the one
//     .trackstar rule; the pin unmoved on the build tree) ·
//     migration 0041 stands and no migration past it ·
//     mass*.ts / logo*.ts byte-identical · the book
//     favorites server block byte-identical (the 0028
//     routes stand untouched) · the standing queue seams
//     the release does not move (addToQueue ·
//     queueKindIsPod · renderQueueList · chainForward)
//     byte-identical, and renderQueueList carries no star
//   C client (the v542/v544 Chromium mold, stubbed fetch):
//     A the carry-in world: the server's starred list
//       stands empty, the production book favorites stand
//       (3 slugs) — the unified list carries them in as
//       prayer entries, once, in stored order, through
//       the whole-list PUT; the Starred section lists
//       them; the book reads the same stars (one system)
//     B the main world (the server's starred list seeded
//       with a podcast snapshot entry + a past-day episode
//       snapshot entry):
//       T1 a day card's cluster reads dot · star · ⋮; a
//         star tap fills the glyph and the track stands
//         at the Starred section's head; the section
//         stands above the block rows
//       T5 Play all builds the mixed queue in list order
//         across kinds (live day · podcast snapshot ·
//         past-day snapshot), queueFrom 'starred', no
//         queue snapshot written; the ended-walk plays
//         each in turn and STOPS at the list's end with
//         autoplay ON (no day chain)
//       T6 Add all to queue appends the mixed list behind
//         a standing single play of the other kind
//       T9 Now Playing's queue rows carry no star; the
//         control row's star toggles the playing track
//       T3 a podcast row's star fills; the entry stands
//         in the section with its series named
//       T4 a Catechesis Novenas card's star fills and
//         does not start playback; the novena episode
//         stands in the section
//       T8 un-starring from the section removes the
//         entries everywhere; the empty state line stands
//   G439 (recorded as-is, NEVER a v546 pass): the
//     standing v439 boot gate at its standing reading
// Fixtures (Improvement D), from production: the
// standing live day fixture tests/fixtures-v522/
// day-live-2026-11-17.json (drawn from production
// through the prayer door; the harness injects track
// records under the production episode ids standing in
// its introTexts, the v542 mold) · the production book
// and book favorites drawn through the prayer door at
// build time (tests/fixtures-v546/book-live.json —
// 9 groups / 77 prayers · book-favorites-live.json —
// John's standing favorites: prayer-after-communion ·
// prayer-before-mass · grace-after-meals) · the podcast
// series payload in the v542 harness's standing shape.
// T4's novena slot settles through the app's own settle
// seam (ownSettlePresent — the resolver's landing act)
// with a meta under the production novena id
// novena-st_cecilia (standing in the day fixture's
// introTexts): the feed resolution itself is standing
// machinery this release does not touch; the card paint,
// the star seat, and the toggle under test are the
// production code entire.
// Run: node app/tests/harness-v546.mjs [--probe] (from
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
const gitShow = (p) => execFileSync('git', ['show', '030bbc91:' + p], { cwd: ROOT, encoding: 'utf8' });
const B_C = gitShow('app/worker/src/client.ts');
const B_I = gitShow('app/worker/src/index.ts');
const B_U = gitShow('app/worker/src/ui.ts');
const DAY = JSON.parse(readFileSync(APP + '/tests/fixtures-v522/day-live-2026-11-17.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures-v546/book-live.json', 'utf8'));
const FAVS = JSON.parse(readFileSync(APP + '/tests/fixtures-v546/book-favorites-live.json', 'utf8'));
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
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0041_starred_tracks.sql', 'S1a: migration 0041 stands last', migs.slice(-2).join(','));
  const m41 = readFileSync(APP + '/migrations/0041_starred_tracks.sql', 'utf8');
  ok(m41.includes('CREATE TABLE IF NOT EXISTS starred_tracks') && m41.includes('star_key TEXT PRIMARY KEY'),
    'S1b: 0041 creates starred_tracks in the additive mold');
  for (const f of ['mass.ts', 'mass-calendar.ts', 'mass-order.ts', 'mass-readings.ts', 'logo.ts', 'logo512.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === gitShow('app/worker/src/' + f), 'S2-' + f + ': byte-identical to the production base');
  }
  const pinNorm = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pinNorm(U_SRC).split('\n').filter((l) => !l.includes('.trackstar')).join('\n') === pinNorm(B_U)
    && pinNorm(U_SRC).split('\n').filter((l) => l.includes('.trackstar')).length === 1,
    'S3a: ui.ts is the base plus exactly one line — the .trackstar rule');
  ok(U_SRC.includes('ora-pro-nobis-v544-1') && !U_SRC.includes('ora-pro-nobis-v546-1'),
    'S3b: the SW pin stands at v544-1 on the build tree (it moves only at Ship)');
  const seg = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
  ok(seg(I_SRC, 'if (seg[2] === "book" && seg[3] === "favorites" && request.method === "PUT")', 'if (seg[2] === "starred"')
    === seg(B_I, 'if (seg[2] === "book" && seg[3] === "favorites" && request.method === "PUT")', 'if (seg[2] === "mass-personal-prayer"'),
    'S4a: the book favorites PUT block stands byte-identical (the 0028 routes untouched)');
  ok(fnBody(I_SRC, 'bookFavorites') === fnBody(B_I, 'bookFavorites') && fnBody(I_SRC, 'massPersonalPrayers') === fnBody(B_I, 'massPersonalPrayers'),
    'S4b: bookFavorites and the Mass personal-prayer read stand byte-identical (the prayer seats untouched)');
  ok(I_SRC.includes('if (seg[2] === "starred" && !seg[3] && request.method === "PUT")') && I_SRC.includes('if (seg[2] === "prayer" && seg[3] === "starred" && request.method === "GET")'),
    'S4c: the starred session PUT and the door mirror GET stand in index.ts');
  for (const fn of ['addToQueue', 'queueKindIsPod', 'renderQueueList', 'chainForward', 'openPlayerMenu']) {
    ok(fnBody(C_SRC, fn) === fnBody(B_C, fn), 'S5-' + fn + ': byte-identical to the base (a seam this release does not move)');
  }
  ok((fnBody(C_SRC, 'advanceQueue') || '').includes('state.queueFrom = null') && (fnBody(C_SRC, 'playTrack') || '').includes('state.queueFrom = null')
    && (fnBody(C_SRC, 'startQueue') || '').includes('state.queueFrom = null') && (fnBody(C_SRC, 'clearQueue') || '').includes('state.queueFrom = null'),
    'S5d: the provenance clears at every standing queue birth/clear (playTrack · startQueue · advanceQueue\'s exhaustion · clearQueue) — the designed change, each a single line');
  ok(!(fnBody(C_SRC, 'renderQueueList') || '').includes('trackstar'),
    'S5b: renderQueueList carries no star (the package bound: queue rows carry no star)');
  ok((C_SRC.match(/data-trackstar/g) || []).length >= 8 && C_SRC.includes("state.queueFrom !== 'starred'") && C_SRC.includes("queueFrom === 'starred'"),
    'S5c: the star seats and the starred-provenance reads stand in client.ts');
  ok(JSON.stringify(BOOK.groups.map((g) => g.prayers.length)) === '[24,5,13,9,5,4,7,2,8]'
    && JSON.stringify(FAVS.favorites) === JSON.stringify(['prayer-after-communion', 'prayer-before-mass', 'grace-after-meals'])
    && Object.values(DAY_TRACKS).flat().every((id) => Object.prototype.hasOwnProperty.call(DAY.introTexts, id)),
    'S6: the fixtures stand — the production book (9 groups / 77), John\'s production favorites (3 slugs, in stored order), and every seated track id stands in the day fixture\'s own introTexts (production-drawn)');
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
  const stub = `
window.__puts = [];
window.__starredStore = ${JSON.stringify(world === 'main' ? SEED_STARRED : [])};
window.__favs = ${JSON.stringify(world === 'carry' ? FAVS.favorites : [])};
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
  if (p.indexOf('/api/prayer/book/favorites') === 0) return ans(200, { ok: true, favorites: window.__favs });
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

/* ---------------- A: the carry-in world ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('carry', errs, 'carry');
  ok(errs.length === 0, 'A0: boot clean — no page errors on the carry-in page', errs.join(' · '));
  await page.waitForFunction(() => window.state && state.starred && state.starred.length === 3, null, { timeout: 15000 }).catch(() => console.log('note - carry-in slow'));
  const a = await page.evaluate(() => ({
    starred: (state.starred || []).map((e) => ({ k: e.k, id: e.id })),
    puts: window.__puts.map((p) => p.map((e) => e.k + ':' + e.id)),
    sectionRows: Array.from(document.querySelectorAll('#starred-slot [data-staropen]')).map((r) => r.getAttribute('data-staropen')),
    slotBeforeBody: (() => { const s = document.getElementById('starred-slot'); const b = document.getElementById('home-body'); return !!(s && b && (s.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); })(),
  }));
  ok(JSON.stringify(a.starred) === JSON.stringify(FAVS.favorites.map((s) => ({ k: 'prayer', id: s }))),
    'A1 (Q4 A): the empty unified store carries the production book favorites in as prayer entries, in their stored order', JSON.stringify(a.starred));
  ok(a.puts.length >= 1 && JSON.stringify(a.puts[0]) === JSON.stringify(FAVS.favorites.map((s) => 'prayer:' + s)),
    'A2 (Q4 A): the carry-in lands through ONE whole-list PUT of the unified store', JSON.stringify(a.puts));
  ok(JSON.stringify(a.sectionRows) === JSON.stringify(FAVS.favorites) && a.slotBeforeBody,
    'A3 (Q2 B): the Starred section stands at the head of the Praylist side (above the block rows) listing the carried prayers', JSON.stringify(a.sectionRows));
  // One system: the book reads the same stars.
  await page.click('#sidetoggle [data-side="book"]');
  await page.waitForSelector('[data-bookstar]', { timeout: 15000 }).catch(() => console.log('note - book slow'));
  await sleep(400);
  const bk = await page.evaluate(() => {
    const glyph = (slug) => { const b = document.querySelector('[data-bookstar="' + slug + '"]'); return b ? b.textContent : null; };
    return { fav1: glyph('prayer-after-communion'), fav2: glyph('prayer-before-mass'), fav3: glyph('grace-after-meals'), other: glyph('our-father') };
  });
  ok(bk.fav1 === '\u2605' && bk.fav2 === '\u2605' && bk.fav3 === '\u2605' && bk.other === '\u2606',
    'A4 (Q4 A): the book\'s own stars read the unified store — the three carried favorites filled, another prayer open', JSON.stringify(bk));
  // The section's prayer rows take the book's titles once the book stands loaded.
  await page.click('#sidetoggle [data-side="prayers"]');
  await sleep(400);
  const titles = await page.evaluate(() => Array.from(document.querySelectorAll('#starred-slot [data-staropen] h3')).map((h) => h.textContent));
  ok(titles.length === 3 && titles.every((t) => t && t.indexOf('-') === -1),
    'A5: the section\'s prayer rows read the book\'s titles (not slugs) once the book stands loaded', titles.join(' · '));
  ok(errs.length === 0, 'A6: the carry-in page carries no page errors after the side switches', errs.join(' · '));
  await ctx.close(); srv.close();
}

/* ---------------- B: the main world ---------------- */
{
  const errs = [];
  const { ctx, page, srv } = await boot('main', errs, 'main');
  ok(errs.length === 0, 'B0: boot clean — no page errors on the main page', errs.join(' · '));
  await page.waitForFunction(() => window.state && state.starred && state.starred.length === 2, null, { timeout: 15000 }).catch(() => console.log('note - seed settle slow'));
  const home = await page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll('#starred-slot [data-card]')).map((r) => r.getAttribute('data-card')),
    slotBeforeBody: (() => { const s = document.getElementById('starred-slot'); const b = document.getElementById('home-body'); return !!(s && b && (s.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); })(),
    acts: !!document.getElementById('starred-playall') && !!document.getElementById('starred-addall'),
  }));
  ok(JSON.stringify(home.rows) === JSON.stringify(['podcast:catechism-in-a-year:ciy:day-1', 'episode:past-day-ep']) && home.slotBeforeBody && home.acts,
    'B1 (Q2 B): the seeded list stands in the Starred section at the Praylist head, in list order, with Play all + Add all to queue',
    JSON.stringify(home.rows));

  /* T1: the day card's star */
  await page.click('[data-openblock="Morning"]');
  await page.waitForSelector('[data-trackstar="episode:morning-prayer"]', { timeout: 15000 }).catch(() => console.log('note - block page slow'));
  const cluster = await page.evaluate(() => {
    const card = document.querySelector('[data-trackstar="episode:morning-prayer"]').closest('.card');
    const cl = card.querySelector('.prow-cluster');
    return { kids: Array.from(cl.children).map((c) => c.getAttribute('data-trackstar') ? 'star' : (c.getAttribute('data-rowmenu') ? 'menu' : (c.getAttribute('data-markplayed') || c.className))), glyph: card.querySelector('[data-trackstar]').textContent };
  });
  ok(cluster.kids.length === 3 && cluster.kids[1] === 'star' && cluster.kids[2] === 'menu' && cluster.glyph === '\u2606',
    'T1a (Q1 A): the day card\'s cluster reads played dot · star · ⋮, the star open', JSON.stringify(cluster.kids));
  await page.click('[data-trackstar="episode:morning-prayer"]');
  await sleep(400);
  const t1 = await page.evaluate(() => ({
    head: state.starred[0] && state.starred[0].k + ':' + state.starred[0].id,
    glyph: document.querySelector('[data-trackstar="episode:morning-prayer"]').textContent,
    lastPutHead: window.__puts.length ? (window.__puts[window.__puts.length - 1][0] || {}).id : null,
  }));
  ok(t1.head === 'episode:morning-prayer' && t1.glyph === '\u2605' && t1.lastPutHead === 'morning-prayer',
    'T1b (Q1 A/Q4 A): the tap fills the star, the track takes the list\'s head (most recent first), and the whole-list PUT carries it first', JSON.stringify(t1));
  await page.evaluate(() => goListenHome('Morning')); // the block page's standing back act
  await sleep(500);
  const headRow = await page.evaluate(() => { const r = document.querySelector('#starred-slot [data-card]'); return r ? r.getAttribute('data-card') : null; });
  ok(headRow === 'episode:morning-prayer', 'T1c (Q2 B): back home, the Starred section\'s head row is the just-starred track', String(headRow));

  /* T5: Play all — the mixed queue, the ended-walk, the stop at the end */
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
    'T5a (Q3 A): Play all builds the queue in list order ACROSS kinds (live day · podcast snapshot · past-day snapshot), provenance starred, no queue snapshot written',
    JSON.stringify(q));
  const walk = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { document.getElementById('audio').dispatchEvent(new Event('ended')); });
    await sleep(450);
    walk.push(await page.evaluate(() => (state.current ? state.current.episodeId : null)));
  }
  const endState = await page.evaluate(() => ({ cur: state.current, qlen: state.queue.length, from: state.queueFrom }));
  ok(JSON.stringify(walk) === JSON.stringify(['ciy:day-1', 'past-day-ep', null]) && endState.cur === null && endState.qlen === 0,
    'T5b (Q3 A): the ended-walk plays each list track in turn and STOPS at the list\'s end with autoplay ON — the day chain never joins it',
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
  ok(t3.head && t3.head.k === 'podcast' && t3.head.id === 'ciy:day-2' && t3.head.series === 'catechism-in-a-year' && t3.head.sub === 'Catechism in a Year' && t3.glyph === '\u2605',
    'T3 (Q1 A): a podcast row\'s star fills; the entry stands at the list\'s head carrying its series (the key the seq_key alone cannot give)', JSON.stringify(t3));

  /* T6: Add all behind a standing single play of the other kind */
  await page.evaluate(() => setAutoplay(false));
  await page.evaluate(() => { document.querySelector('[data-podplay="ciy:day-2"]').click(); }); // the disc's own listener fires (the thumbnail overlay stalls Playwright's actionability check, not the act)
  await sleep(500);
  const single = await page.evaluate(() => ({ cur: state.current && state.current.episodeId, kind: state.current && state.current.kind, q: state.queue.map((d) => d.episodeId), from: state.queueFrom }));
  ok(single.cur === 'ciy:day-2' && single.kind === 'podcast' && JSON.stringify(single.q) === JSON.stringify(['ciy:day-2']) && single.from === null,
    'T6a: a single podcast play stands alone (autoplay OFF, the v542 single-play rule — the tapped entry only, no series queue, no provenance)', JSON.stringify(single));
  await page.click('[data-tab="prayers"]');
  await sleep(400);
  await page.evaluate(() => { state.prayersView = { kind: 'home' }; paintPrayersView(state.dayPayload); });
  await sleep(400);
  await page.click('#starred-addall');
  await sleep(400);
  const t6 = await page.evaluate(() => ({
    ids: state.queue.map((d) => d.episodeId),
    kinds: state.queue.map((d) => d.kind || 'day'),
    from: state.queueFrom, idx: state.queueIdx,
  }));
  ok(JSON.stringify(t6.ids) === JSON.stringify(['ciy:day-2', 'ciy:day-2', 'morning-prayer', 'ciy:day-1', 'past-day-ep'])
    && t6.kinds[0] === 'podcast' && t6.kinds.slice(1).includes('day') && t6.from === 'starred' && t6.idx === 0,
    'T6b (Q3 A): Add all appends the whole mixed list behind the standing single play — [current, ...list] across kinds, no kind bound', JSON.stringify(t6));

  /* T9: Now Playing — no star in the queue rows; the control row's star toggles */
  await page.evaluate(() => openNowPlaying());
  await page.waitForSelector('#np-star', { timeout: 15000 }).catch(() => console.log('note - NP slow'));
  await sleep(300);
  const np0 = await page.evaluate(() => ({
    queueStars: document.querySelectorAll('#np-queue [data-trackstar]').length,
    npGlyph: document.getElementById('np-star').textContent,
  }));
  ok(np0.queueStars === 0 && np0.npGlyph === '\u2605',
    'T9a (Q1 A + the bound): Now Playing\'s queue rows carry NO star; the control row\'s star reads the playing track\'s standing star (ciy:day-2 stands starred)', JSON.stringify(np0));
  await page.click('#np-star');
  await sleep(400);
  const np1 = await page.evaluate(() => ({
    glyph: document.getElementById('np-star').textContent,
    stillThere: state.starred.some((e) => e.k === 'podcast' && e.id === 'ciy:day-2' && e.series === 'catechism-in-a-year'),
  }));
  ok(np1.glyph === '\u2606' && !np1.stillThere,
    'T9b (Q1 A): the Now Playing star toggles the playing track OFF the list', JSON.stringify(np1));
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
  await page.evaluate(() => switchPodSide('novenas')); // the side toggle's own act (the toggle host stands under the series page's bar at this point in the walk)
  await page.waitForSelector('[data-novplay="novena-st_cecilia"] [data-trackstar]', { timeout: 15000 }).catch(() => console.log('note - novenas side slow'));
  await page.click('[data-novplay="novena-st_cecilia"] [data-trackstar]');
  await sleep(400);
  const t4 = await page.evaluate(() => ({
    has: state.starred.some((e) => e.k === 'episode' && e.id === 'novena-st_cecilia'),
    glyph: document.querySelector('[data-novplay="novena-st_cecilia"] [data-trackstar]').textContent,
    cur: state.current ? state.current.episodeId : null,
  }));
  ok(t4.has && t4.glyph === '\u2605' && t4.cur === before,
    'T4 (Q1 A): the Catechesis Novenas card\'s star fills, the novena episode stands in the list, and the tap does NOT start playback', JSON.stringify(t4));

  /* T8: un-star everything from the section; the empty line stands */
  await page.click('[data-tab="prayers"]');
  await sleep(400);
  await page.evaluate(() => { state.prayersView = { kind: 'home' }; paintPrayersView(state.dayPayload); });
  await sleep(400);
  for (let i = 0; i < 10; i++) {
    const done = await page.evaluate(() => {
      if (!state.starred.length) return true;
      const b = document.querySelector('#starred-slot [data-trackstar]');
      if (b) { b.click(); return false; }
      return true;
    });
    if (done) break;
    await sleep(300);
  }
  await sleep(400);
  const t8 = await page.evaluate(() => ({
    n: state.starred.length,
    empty: (document.getElementById('starred-slot') || {}).textContent.includes('No starred tracks yet'),
    lastPut: window.__puts.length ? window.__puts[window.__puts.length - 1].length : -1,
    cardGlyph: (() => { const b = document.querySelector('[data-trackstar="episode:morning-prayer"]'); return b ? b.textContent : 'n/a (not painted)'; })(),
  }));
  ok(t8.n === 0 && t8.empty && t8.lastPut === 0,
    'T8: un-starring from the section empties the list everywhere — the store, the section\'s empty line, and the final whole-list PUT all read empty', JSON.stringify(t8));
  ok(errs.length === 0, 'B9: the main page carries no page errors after every leg', errs.join(' · '));
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
    'G439 (recorded as-is, not a v546 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    mm ? mm[0] : 'no summary line in the gate output');
}

await browser.close();
console.log('\nharness-v546: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
