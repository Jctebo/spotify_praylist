// harness-v534 — v534 back-navigation review: proof legs.
//
// THE FIXES UNDER TEST (release doc §2, F1–F4; client.ts only):
//   F1 — a series page entered from Pray homes in the Pray
//        stack (new origin record podOrigin): goSeries from
//        the Prayers tab does not switch tabs; the page's
//        bar names Podcasts and its back (bar + system)
//        returns to the Podcasts group page; the Catechesis
//        homing is untouched.
//   F2 — the first-tap race: openPodSeries claims
//        podLevel 'series' at entry; renderPodcasts' cold
//        index completion paints only while the level is
//        'index' (the guard its return branches always had).
//   F3 — Settings back is dynamic: the origin tab is
//        recorded at renderSettings entry (settingsReturnTab
//        — state.tab becomes 'settings' there); both back
//        acts return to it and the bar names it.
//   F4 — system-back arms for the four dead ends (book
//        page · Settings · Mass-homed series · Mass-homed
//        watch), each running the page's own standing back
//        act; the root arm untouched.
//
// LEGS:
//   S  — statics: only client.ts differs from the v532 ship
//        (ui.ts whole, pin unbumped in the build tree); no
//        new migration; the standing functions byte-equal;
//        the touched functions differ; the new helpers stand.
//   W1 — THE RECORDING'S WALK (Exhibit A), on the build:
//        Pray → Podcasts group → ONE real tap on the series
//        card → the series page stands IN PRAY (tab
//        'prayers', origin recorded, bar '‹ Podcasts') →
//        bar back → the Podcasts group page in Pray. Then
//        again with the system back (handleSystemBack).
//   W1B — the same walk on the BASE build with the index
//        fetch delayed past the series fetch: Exhibit A
//        reproduced — the first tap lands on the Catechesis
//        index (the series overwritten), and the series
//        reached from there is Catechesis-homed.
//   W2 — THE DYNAMIC PROOF: the same series entered from
//        Catechesis returns to Catechesis (bar '‹
//        Catechesis', back → the index stands).
//   W3 — the race leg, cross-tab: goSeries from the Mass
//        tab with the index fetch delayed — on the build
//        the series stands and is never overwritten; on
//        the base the index completion lands last and the
//        series is gone.
//   W4 — the dead ends, each walked on build and base via
//        handleSystemBack(): (a) prayer-book page → book
//        list (base: falls through, page stands); (b)
//        Settings opened from Catechesis → Catechesis
//        (base: falls through, Settings stands; its bar
//        reads the fixed 'Pray'); (c) Mass-homed CatholicTV
//        series → returnToMassVirtual fires (base: falls
//        through); (d) Mass-homed watch view → the series
//        page (base: the watch stands).
//   W5 — Settings on-screen acts: bar back from Catechesis
//        lands on Catechesis; footer back from Pray lands
//        on Pray; the Reset re-entry keeps the recording.
//   W6 — regression: all five tabs switch; a block page
//        and the episodes page keep their standing backs
//        (bar + system); no page errors. (The v531
//        readings chip, Now Playing, and playback are
//        proven untouched by S3's byte-compares — F1–F4
//        change none of their code.)
//   G439 — the standing boot gate, recorded as-is.
//
// FIXTURES: the v522 production captures, reused by
// reference (fixtures-v522: the live day payload
// 2026-11-17 with the Podcasts layer ON, the live
// podcasts index, both series payloads at full size) and
// the v522 book capture; the CatholicTV payload is built
// to the production painter's shape (kind 'video',
// videos[] with id/title/dateLabel/imageUrl — the fields
// paintPodcastVideos reads). The fetch stub gains
// per-route delays so the race legs control which
// completion lands last.

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const APP = ROOT + '/app';
const SRC = APP + '/worker/src';
const BASE = process.env.HARNESS_BASE || (ROOT + '/../v532-ship/app/worker/src');
const FIX522 = APP + '/tests/fixtures-v522';
const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const require = createRequire(APP + '/worker/package.json');
const { chromium } = require('playwright-core');

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('NOT OK -', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra)); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cook(clientPath) {
  const src = fs.readFileSync(clientPath, 'utf8');
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
function extractFn(src, name) {
  const re = new RegExp('function ' + name + '\\(', 'g');
  const m = re.exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index), depth = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(m.index, j + 1);
}

/* ---------------- fixtures ---------------- */
const DAY_LIVE = JSON.parse(fs.readFileSync(FIX522 + '/day-live-2026-11-17.json', 'utf8'));
const INDEX = JSON.parse(fs.readFileSync(FIX522 + '/podindex-live-2026-11-17.json', 'utf8'));
const BIY = JSON.parse(fs.readFileSync(FIX522 + '/series-bible-in-a-year-live-2026-11-17.json', 'utf8'));
const EXF = JSON.parse(fs.readFileSync(FIX522 + '/series-exorcist-files-live-2026-11-17.json', 'utf8'));
const BOOK = JSON.parse(fs.readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const CATHOLICTV = {
  key: 'catholictv', kind: 'video', title: 'CatholicTV', available: true,
  videos: [
    { id: 'vid-2026-11-17', title: 'Catholic Mass — November 17, 2026', dateLabel: 'Nov 17, 2026', imageUrl: '' },
    { id: 'vid-2026-11-16', title: 'Catholic Mass — November 16, 2026', dateLabel: 'Nov 16, 2026', imageUrl: '' },
  ],
};
const BIY_EPS = ((BIY.tracks || BIY.episodes || [])).length;

/* ---------------- S: statics ---------------- */
{
  const rd = (p) => fs.readFileSync(p, 'utf8');
  const build = rd(SRC + '/client.ts'), base = rd(BASE + '/client.ts');
  check('S1 client.ts differs from the v532 ship (the fix stands)', build !== base);
  for (const f of ['index.ts', 'mass.ts', 'mass-calendar.ts', 'mass-order.ts', 'mass-readings.ts', 'ui.ts']) {
    check('S1 ' + f + ' byte-identical to the v532 ship', rd(SRC + '/' + f) === rd(BASE + '/' + f));
  }
  const mig = (d) => fs.readdirSync(d).filter((f) => f.endsWith('.sql')).sort();
  check('S2 no new migration (0039 last in both trees)',
    JSON.stringify(mig(APP + '/migrations')) === JSON.stringify(mig(ROOT + '/../v532-ship/app/migrations')));
  const STANDING = ['closePrayerPage', 'openPrayerPage', 'goListenHome', 'openBlockPage', 'paintBlockPage',
    'paintEpisodesPage', 'paintMassReadings', 'massReadingsHtml', 'wireMassChips', 'closeWatch', 'openNowPlaying',
    'renderPrayerBook', 'paintPrayersView', 'switchPodSide', 'openMassVirtualSeries', 'returnToMassVirtual',
    'goSide', 'capturePlace', 'paintRow2Bar', 'startDesc', 'npDuration', 'openPodWatch', 'paintPodWatch'];
  for (const fn of STANDING) {
    check('S3 standing function byte-identical: ' + fn, extractFn(build, fn) === extractFn(base, fn));
  }
  const TOUCHED = ['setTab', 'renderPodcasts', 'paintPodcastsIndex', 'goPodcastsIndex', 'openPodSeries',
    'goSeries', 'renderSettings', 'paintSettings', 'handleSystemBack', 'paintPodcasts', 'paintPodcastRss',
    'paintPodOwnSeries', 'paintPodcastVideos', 'wirePodBack', 'resolveProfilePodcasts'];
  for (const fn of TOUCHED) {
    const a = extractFn(build, fn), b = extractFn(base, fn);
    check('S4 touched function differs from base: ' + fn, !!a && !!b && a !== b);
  }
  check('S5 new helpers stand in the build, absent in the base',
    !!extractFn(build, 'podSeriesDest') && !!extractFn(build, 'returnToPrayPodcastsGroup')
    && !extractFn(base, 'podSeriesDest') && !extractFn(base, 'returnToPrayPodcastsGroup'));
  check('S5 the origin records stand (podOrigin · settingsReturnTab)',
    /var podOrigin = null;/.test(build) && /var settingsReturnTab = 'prayers';/.test(build)
    && !/var podOrigin/.test(base) && !/settingsReturnTab/.test(base));
  const ovB = extractFn(base, 'handleSystemBack'), ovN = extractFn(build, 'handleSystemBack');
  const armText = (s) => { const i = s.indexOf('var overlay'); const j = s.indexOf('\n  }\n', i); return s.slice(i, j + 4); };
  check('S6 the overlay arm text stands unchanged at the head of the dispatch',
    ovN.indexOf('var overlay') > -1 && armText(ovN) === armText(ovB));
  check('S6 the root arm stands unchanged (exitApp fall-through)',
    ovN.slice(ovN.indexOf('// 4. Root')) === ovB.slice(ovB.indexOf('// 4. Root'))
    && (build.match(/exitApp\(\)/g) || []).length === (base.match(/exitApp\(\)/g) || []).length);
}

/* ---------------- page builder ---------------- */
// The page is the production shell itself (ui.ts SHELL_HTML,
// a plain template), served over a local origin with the
// cooked client as the EXTERNAL /app.js — the production
// shape. (Inlining the current client into setContent
// breaks the document parser's script-data state; the boot
// also touches the shell's own elements — the audio
// element, the dock, #hdrrow2 — so a hand-made skeleton
// does not boot it either.)
import http from 'node:http';
function cookShell(uiPath) {
  const src = fs.readFileSync(uiPath, 'utf8');
  const t = src.indexOf('SHELL_HTML = `') + 14;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
const server = http.createServer((req, res) => {
  const u = String(req.url || '');
  const js = (body, type) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
  if (u === '/app-build.js') return js(APP_JS, 'text/javascript');
  if (u === '/app-base.js') return js(APP_JS_BASE, 'text/javascript');
  if (u === '/shell-build') return js(SHELL.replace('<script src="/app.js"></script>', '<script src="/app-build.js"></script>'), 'text/html');
  if (u === '/shell-base') return js(SHELL_BASE.replace('<script src="/app.js"></script>', '<script src="/app-base.js"></script>'), 'text/html');
  if (u === '/styles.css') return js('', 'text/css');
  res.writeHead(404); res.end('nf');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
function buildPage(browser, opts) {
  const base = opts.js === APP_JS_BASE;
  return (async () => {
    const page = await browser.newPage();
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.addInitScript((o) => {
      window.__errs = [];
      window.addEventListener('error', (e) => { window.__errs.push(String(e.message || e.error || e)); });
      try { localStorage.clear(); } catch (e) {}
      const day = JSON.parse(o.dayLiveJson);
      const ans = (obj, status) => Promise.resolve({ ok: status === undefined, status: status || 200, json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)) });
      const json = (obj) => ({ ok: true, status: 200, json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)) });
      const profiles = { ok: true, version: 4, standingKey: 'salesian', picks: {},
        profiles: [
          { key: 'little-way', name: 'The Little Way', builtin: 1, honor: '', blocks: [], layers: { novenas: false, podcasts: false }, podSeries: [] },
          { key: 'salesian', name: 'The Salesian Way', builtin: 1, honor: '', blocks: ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'], layers: { novenas: true, podcasts: true }, podSeries: ['bible-in-a-year', 'exorcist-files'] },
          { key: 'benedictine', name: 'The Benedictine Way', builtin: 1, honor: '', blocks: [], layers: { novenas: true, podcasts: false }, podSeries: [] },
        ] };
      window.fetch = (url, fopts) => {
        const u = String(url);
        if (u.indexOf('/api/player/day') > -1) return ans(JSON.parse(JSON.stringify(day)));
        if (u.indexOf('/api/prayer/profiles') > -1) return ans(profiles);
        if (u.indexOf('/api/player/podcasts?series=bible-in-a-year') > -1) return ans(JSON.parse(o.biyJson));
        if (u.indexOf('/api/player/podcasts?series=exorcist-files') > -1) return ans(JSON.parse(o.exfJson));
        if (u.indexOf('/api/player/podcasts?series=catholictv') > -1) return ans(JSON.parse(o.catholictvJson));
        if (u.endsWith('/api/player/podcasts')) {
          if (o.delayIndexMs) return new Promise((res) => setTimeout(() => res(json(JSON.parse(o.indexJson))), o.delayIndexMs));
          return ans(JSON.parse(o.indexJson));
        }
        if (u.indexOf('/api/prayer/book') > -1 && u.indexOf('favorites') === -1) return ans(JSON.parse(o.bookJson));
        if (u.indexOf('/api/prayer/mass-personal-prayer') > -1) return ans({ ok: true, before: [], after: [], afterMass: [], preMass: [] });
        return ans({ ok: true });
      };
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      HTMLMediaElement.prototype.pause = function () {};
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get() { return 600; }, configurable: true });
    }, { dayLiveJson: JSON.stringify(DAY_LIVE), indexJson: JSON.stringify(INDEX), biyJson: JSON.stringify(BIY),
         exfJson: JSON.stringify(EXF), bookJson: JSON.stringify(BOOK), catholictvJson: JSON.stringify(CATHOLICTV),
         delayIndexMs: opts.delayIndexMs || 0 });
    await page.route('**/*', (route) => {
      if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
    });
    await page.goto(ORIGIN + (base ? '/shell-base' : '/shell-build'), { waitUntil: 'load', timeout: 30000 });
    // Boot-settled means the side table stands (capturePlace
    // reads it on any tab switch) and the tab bar is painted.
    await page.waitForFunction(() => typeof tabSideNow !== 'undefined' && !!tabSideNow && document.querySelectorAll('#tabbar .tab').length >= 5, null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.evaluate(() => { if (typeof setTab === 'function') setTab('prayers'); });
    await page.waitForTimeout(900);
    return page;
  })();
}
const errs = (page) => page.evaluate(() => window.__errs || []);

/* ---------------- walks ---------------- */
const APP_JS = cook(SRC + '/client.ts');
const APP_JS_BASE = cook(BASE + '/client.ts');
const SHELL = cookShell(SRC + '/ui.ts');
const SHELL_BASE = cookShell(BASE + '/ui.ts');
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const hdr2Back = (page) => page.evaluate(() => {
  const b = document.querySelector('#hdrrow2 [data-podback], #hdrrow2 [data-settingsback]');
  return b ? b.textContent.trim() : null;
});
const viewText = (page) => page.evaluate(() => (document.getElementById('view') || {}).textContent || '');

/* W1 — the recording's walk, on the build */
{
  const page = await buildPage(browser, { js: APP_JS });
  await page.click('[data-openblock="Podcasts"]');
  await page.waitForTimeout(500);
  let st = await page.evaluate(() => ({ cards: document.querySelectorAll('[data-daypodseries]').length, kind: state.prayersView && state.prayersView.kind, block: state.prayersView && state.prayersView.block }));
  check('W1 the Podcasts group page stands in Pray (2 series entries)', st.cards === 2 && st.block === 'Podcasts', st);
  await page.click('[data-daypodseries="bible-in-a-year"]'); // ONE tap — the recording's tap
  await page.waitForTimeout(900);
  st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel, origin: podOrigin, rows: document.querySelectorAll('[data-podplay]').length, title: (document.getElementById('hdr2-title') || {}).textContent || '' }));
  const back1 = await hdr2Back(page);
  check('W1 ONE tap lands on the series page IN PRAY (no tab switch, origin recorded)',
    st.tab === 'prayers' && st.origin === 'prayers', st);
  check('W1 the series page stands (level series, episode rows painted, the series\u2019 own title on the bar)',
    st.lvl === 'series' && st.rows > 0 && st.title === 'Bible in a Year', st);
  check('W1 the bar names the true home: \u2039Podcasts', back1 === '\u2039Podcasts', back1);
  check('W1 no page errors on the walk', (await errs(page)).length === 0, await errs(page));
  await page.click('#hdrrow2 [data-podback]');
  await page.waitForTimeout(500);
  st = await page.evaluate(() => ({ tab: state.tab, origin: podOrigin, cards: document.querySelectorAll('[data-daypodseries]').length, block: state.prayersView && state.prayersView.block }));
  check('W1 bar back returns to the Podcasts group page IN PRAY (not Catechesis)',
    st.tab === 'prayers' && st.cards === 2 && st.origin === null && st.block === 'Podcasts', st);
  // the same return by the system back
  await page.click('[data-daypodseries="exorcist-files"]');
  await page.waitForTimeout(900);
  st = await page.evaluate(() => ({ tab: state.tab, origin: podOrigin }));
  check('W1 the second series also homes in Pray on one tap', st.tab === 'prayers' && st.origin === 'prayers', st);
  await page.evaluate(() => handleSystemBack());
  await page.waitForTimeout(500);
  st = await page.evaluate(() => ({ tab: state.tab, origin: podOrigin, cards: document.querySelectorAll('[data-daypodseries]').length }));
  check('W1 system back from the Pray-homed series returns to the group page',
    st.tab === 'prayers' && st.cards === 2 && st.origin === null, st);
  await page.close();
}

/* W1B — the same walk on the BASE build: Exhibit A reproduced */
{
  const page = await buildPage(browser, { js: APP_JS_BASE, delayIndexMs: 1500 });
  await page.click('[data-openblock="Podcasts"]');
  await page.waitForTimeout(500);
  await page.click('[data-daypodseries="bible-in-a-year"]');
  await page.waitForTimeout(2400); // the delayed index completion lands last
  let st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel }));
  check('W1B BASE REPRODUCES Exhibit A frame 2: the first tap leaves Pray and the series does NOT stand (the Catechesis index owns the view)',
    st.tab === 'podcasts' && st.lvl === 'index', st);
  await page.click('[data-podseries="bible-in-a-year"]');
  await page.waitForTimeout(900);
  st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel }));
  const backB = await hdr2Back(page);
  check('W1B BASE frame 3: the series reached from there is Catechesis-homed',
    st.tab === 'podcasts' && st.lvl === 'series' && backB === '\u2039Catechesis', { st, backB });
  await page.click('#hdrrow2 [data-podback]');
  await page.waitForTimeout(2400); // the base re-fetches the index cold, and the stub's delay rides it too
  st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel, cards: document.querySelectorAll('[data-podseries]').length }));
  check('W1B BASE frame 4: back returns to Catechesis, never to Pray',
    st.tab === 'podcasts' && st.lvl === 'index' && st.cards > 0, st);
  await page.close();
}

/* W2 — the dynamic proof: the same page from Catechesis */
{
  const page = await buildPage(browser, { js: APP_JS });
  await page.evaluate(() => setTab('podcasts'));
  await page.waitForTimeout(900);
  await page.click('[data-podseries="bible-in-a-year"]');
  await page.waitForTimeout(900);
  let st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel, origin: podOrigin }));
  const back2 = await hdr2Back(page);
  check('W2 the same series from Catechesis stands Catechesis-homed (no Pray origin)',
    st.tab === 'podcasts' && st.lvl === 'series' && st.origin === null && back2 === '\u2039Catechesis', { st, back2 });
  await page.click('#hdrrow2 [data-podback]');
  await page.waitForTimeout(700);
  st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel, cards: document.querySelectorAll('[data-podseries]').length }));
  check('W2 back returns to the Catechesis index (same page, two origins, two returns)',
    st.tab === 'podcasts' && st.lvl === 'index' && st.cards > 0, st);
  await page.close();
}

/* W3 — the race, cross-tab, build vs base */
for (const [tag, js, want] of [['W3 build', APP_JS, 'series'], ['W3 base', APP_JS_BASE, 'index']]) {
  const page = await buildPage(browser, { js, delayIndexMs: 1500 });
  await page.evaluate(() => { setTab('mass'); goSeries('bible-in-a-year'); });
  await page.waitForTimeout(500);
  let st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel }));
  check(tag + ': the series paints first', st.tab === 'podcasts' && st.lvl === 'series', st);
  await page.waitForTimeout(2000); // the delayed index completion lands
  st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel }));
  check(tag + (want === 'series'
    ? ': after the index completion lands, the series STILL stands (F2 guard)'
    : ': BASE — the index completion lands last and overwrites the series (the race, reproduced)'),
    st.lvl === want, st);
  await page.close();
}

/* W4a — dead end: the prayer-book page */
for (const [tag, js, fixed] of [['W4a build', APP_JS, true], ['W4a base', APP_JS_BASE, false]]) {
  const page = await buildPage(browser, { js });
  await page.evaluate(() => goSide('prayers', 'book'));
  await page.waitForTimeout(900);
  let st = await page.evaluate(() => ({ kind: state.prayersView && state.prayersView.kind, rows: document.querySelectorAll('[data-bookrow]').length }));
  check(tag + ': the book list stands', st.kind === 'book' && st.rows > 0, st);
  await page.click('[data-bookrow]');
  await page.waitForTimeout(700);
  st = await page.evaluate(() => ({ kind: state.prayersView && state.prayersView.kind, back: !!document.querySelector('[data-bookback]') }));
  check(tag + ': the prayer page stands', st.kind === 'bookpage' && st.back, st);
  await page.evaluate(() => handleSystemBack());
  await page.waitForTimeout(500);
  st = await page.evaluate(() => ({ kind: state.prayersView && state.prayersView.kind, rows: document.querySelectorAll('[data-bookrow]').length }));
  check(tag + (fixed
    ? ': system back runs closePrayerPage — the book list stands'
    : ': BASE — no arm matches the bookpage kind; the press falls through (the app would close) and the page stands'),
    fixed ? (st.kind === 'book' && st.rows > 0) : (st.kind === 'bookpage'), st);
  await page.close();
}

/* W4b + W5 — dead end / wrong parent: Settings */
{
  const page = await buildPage(browser, { js: APP_JS });
  await page.evaluate(() => setTab('podcasts'));
  await page.waitForTimeout(900);
  await page.evaluate(() => renderSettings());
  await page.waitForTimeout(700);
  let st = await page.evaluate(() => ({ tab: state.tab, ret: settingsReturnTab }));
  const backS = await hdr2Back(page);
  check('W5 Settings opened from Catechesis records Catechesis and names it on the bar',
    st.tab === 'settings' && st.ret === 'podcasts' && backS === '\u2039Catechesis', { st, backS });
  await page.evaluate(() => renderSettings()); // the Reset act's re-entry
  await page.waitForTimeout(700);
  st = await page.evaluate(() => ({ ret: settingsReturnTab }));
  check('W5 the Reset re-entry keeps the first recording', st.ret === 'podcasts', st);
  await page.evaluate(() => handleSystemBack());
  await page.waitForTimeout(700);
  st = await page.evaluate(() => ({ tab: state.tab }));
  check('W4b system back from Settings returns to Catechesis (the dead end is closed)',
    st.tab === 'podcasts', st);
  check('W4b/W5 no page errors', (await errs(page)).length === 0, await errs(page));
  await page.close();
}
{
  const page = await buildPage(browser, { js: APP_JS_BASE });
  await page.evaluate(() => setTab('podcasts'));
  await page.waitForTimeout(900);
  await page.evaluate(() => renderSettings());
  await page.waitForTimeout(700);
  const backS = await hdr2Back(page);
  await page.evaluate(() => handleSystemBack());
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ tab: state.tab }));
  check('W4b BASE — Settings\u2019 bar reads the fixed \u2039Pray from Catechesis, and the system back falls through (Settings stands; the app would close)',
    backS === '\u2039Pray' && st.tab === 'settings', { backS, st });
  await page.close();
}
{
  const page = await buildPage(browser, { js: APP_JS });
  await page.evaluate(() => setTab('podcasts'));
  await page.waitForTimeout(900);
  await page.evaluate(() => renderSettings());
  await page.waitForSelector('#set-back', { timeout: 8000 });
  await page.click('#hdrrow2 [data-settingsback]');
  await page.waitForTimeout(700);
  let st = await page.evaluate(() => ({ tab: state.tab }));
  check('W5 the Settings BAR back from Catechesis lands on Catechesis', st.tab === 'podcasts', st);
  await page.close();
  const page2 = await buildPage(browser, { js: APP_JS });
  await page2.evaluate(() => renderSettings());
  await page2.waitForSelector('#set-back', { timeout: 8000 });
  const backP = await hdr2Back(page2);
  await page2.click('#set-back');
  await page2.waitForTimeout(700);
  st = await page2.evaluate(() => ({ tab: state.tab }));
  check('W5 Settings from Pray: the bar reads \u2039Pray and the footer Back lands on Pray (the standing behavior, byte-for-byte in effect)',
    backP === '\u2039Pray' && st.tab === 'prayers', { backP, st });
  await page2.close();
}

/* W4c/W4d — dead ends: the Mass-homed series page and watch view */
for (const [tag, js, fixed] of [['W4c build', APP_JS, true], ['W4c base', APP_JS_BASE, false]]) {
  const page = await buildPage(browser, { js });
  await page.evaluate(() => { setTab('mass'); openMassVirtualSeries({ series: 'catholictv' }); });
  await page.waitForTimeout(1000);
  let st = await page.evaluate(() => ({ tab: state.tab, lvl: podLevel, mpr: massPodReturn, vids: document.querySelectorAll('[data-podvideo]').length }));
  const backM = await hdr2Back(page);
  check(tag + ': the CatholicTV series page stands Mass-homed (its on-screen back already names Mass)',
    st.tab === 'mass' && st.lvl === 'series' && st.mpr === true && st.vids === 2 && backM === '\u2039Mass', { st, backM });
  await page.evaluate(() => { try { handleSystemBack(); } catch (e) { window.__sbErr = String(e); } });
  await page.waitForTimeout(600);
  st = await page.evaluate(() => ({ mpr: massPodReturn }));
  check(tag + (fixed
    ? ': system back runs returnToMassVirtual (the Mass hosting ends)'
    : ': BASE — no arm matches under Mass; the press falls through (the app would close) and the hosting stands'),
    fixed ? (st.mpr === false) : (st.mpr === true), st);
  await page.close();
}
for (const [tag, js, fixed] of [['W4d build', APP_JS, true], ['W4d base', APP_JS_BASE, false]]) {
  const page = await buildPage(browser, { js });
  await page.evaluate(() => { setTab('mass'); openMassVirtualSeries({ series: 'catholictv' }); });
  await page.waitForTimeout(1000);
  await page.click('[data-podvideo]');
  await page.waitForTimeout(800);
  let st = await page.evaluate(() => ({ lvl: podLevel }));
  check(tag + ': the watch view stands over the Mass-homed series page', st.lvl === 'watch', st);
  await page.evaluate(() => { try { handleSystemBack(); } catch (e) { window.__sbErr = String(e); } });
  await page.waitForTimeout(600);
  st = await page.evaluate(() => ({ lvl: podLevel, vids: document.querySelectorAll('[data-podvideo]').length }));
  check(tag + (fixed
    ? ': system back runs closeWatch — the series page stands again'
    : ': BASE — no arm matches the watch under Mass; the press falls through and the watch stands'),
    fixed ? (st.lvl === 'series' && st.vids === 2) : (st.lvl === 'watch'), st);
  await page.close();
}

/* W6 — regression: tabs, block page, episodes page */
{
  const page = await buildPage(browser, { js: APP_JS });
  let allOk = true; const seen = [];
  for (const t of ['mass', 'conscience', 'podcasts', 'wallpaper', 'prayers']) {
    await page.evaluate((tt) => setTab(tt), t);
    await page.waitForTimeout(600);
    const cur = await page.evaluate(() => state.tab);
    seen.push(t + ':' + cur);
    if (cur !== t) allOk = false;
  }
  check('W6 all five tabs switch and stand', allOk, seen);
  await page.evaluate(() => openBlockPage('Morning'));
  await page.waitForTimeout(600);
  let st = await page.evaluate(() => ({ kind: state.prayersView && state.prayersView.kind, back: !!document.querySelector('#view [data-back], #hdr-row2 [data-back]') || !!document.querySelector('[data-back]') }));
  check('W6 a block page stands with its back', st.kind === 'block', st);
  await page.evaluate(() => handleSystemBack());
  await page.waitForTimeout(500);
  st = await page.evaluate(() => ({ kind: state.prayersView && state.prayersView.kind }));
  check('W6 the block page\u2019s system back still lands on the Pray home (the standing block arm)', st.kind === 'home', st);
  await page.evaluate(() => openBlockPage('__episodes'));
  await page.waitForTimeout(600);
  st = await page.evaluate(() => ({ kind: state.prayersView && state.prayersView.kind, block: state.prayersView && state.prayersView.block }));
  check('W6 the episodes page stands as its block view', st.kind === 'block' && st.block === '__episodes', st);
  await page.evaluate(() => handleSystemBack());
  await page.waitForTimeout(500);
  st = await page.evaluate(() => ({ kind: state.prayersView && state.prayersView.kind }));
  check('W6 the episodes page\u2019s system back still lands on the Pray home', st.kind === 'home', st);
  check('W6 no page errors across the regression walk', (await errs(page)).length === 0, await errs(page));
  await page.close();
}
await browser.close();
server.close();

/* ---------------- G439: recorded as-is ---------------- */
{
  let out = '';
  try { out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const m = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  check('G439 (recorded as-is, not a v534 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    !!m && m[1] === '13' && m[2] === '2', m ? m[0] : out.slice(-300));
}

console.log('harness-v534: ' + ok + ' ok / ' + bad + ' not-ok');
process.exit(bad ? 1 : 0);
