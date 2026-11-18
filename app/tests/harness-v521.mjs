// harness-v521.mjs — v521 evidence: the Podcasts group's
// series link (John, main chat 2026-11-17 19:50 CT:
// "Make the link to the full podcast not the recent
// episode"). In the Pray tab's Podcasts group (the v515
// Podcasts layer group), each picked series stands by ONE
// card — its current episode — whose acts were the
// episode's alone. The build adds ONE wiring pass in
// wirePrayersView: on the Podcasts block page, a group
// card's body tap (outside its controls — the standing
// [data-openblock] guard) calls goSeries(desc.podSeries),
// the standing cross-tab series act (setTab('podcasts')
// + openPodSeries), landing on the series page exactly
// as Catechesis → Podcasts opens it. The play disc still
// plays the episode.
//   S statics: client.ts differs from the base only by
//     the v521 wiring block (stripping it returns the
//     base byte-for-byte) · index.ts + the Mass sources
//     byte-identical · ui.ts identical outside the pin ·
//     no migration beyond 0038 · the fixtures stand
//   C client (the v510 Chromium mold, stubbed fetch; the
//     stub store carries the LIVE layer shape — salesian
//     podcasts ON [bible-in-a-year, exorcist-files]):
//     the cooked parse + boot clean · the home rows with
//     the Podcasts row last and the profile card
//     COLLAPSED (v517) · the group page's two cards (the
//     live currents) · the series act for bible-in-a-year
//     lands byte-equal to the Catechesis arrival (state +
//     painted page; its index card stands on the Courses
//     side — the index files series by category) · the
//     series act for exorcist-files lands byte-equal to
//     its Catechesis arrival (the Podcasts side's card,
//     the rss form) · the play disc
//   The two arrival-equality legs compare the painted
//     pages in the DOM with exactly two named transients
//     normalized out: the remote art images (img.rowart
//     in the rows, img.coverimg in the page head — each
//     removes itself when the sandbox network refuses
//     the CDN fetch, so whether it stands at capture is
//     network luck, in either arrival) and the download-
//     state icons' style (refreshPodDlStates settles it
//     from the device cache, which the session itself
//     fills as the day set downloads — device state, not
//     the page the act paints). Everything else must
//     match byte-for-byte.
//     still plays the episode (no navigation) · the ⋮
//     opens its menu and does not navigate · the layer
//     OFF stands no Podcasts row · the layer ON with no
//     series picked stands the shell with an empty page ·
//     a Morning block page byte-identical to the base
//     ship's · the v517 editor still opens from the
//     expanded card
// Fixtures (Improvement D), under tests/fixtures-v521/,
// drawn from production on 2026-11-17 after v517
// shipped, through the prayer door: (a) the live day
// payload (GET /api/agent/player/day?date=2026-11-17 —
// salesian by 'standing', the Podcasts layer ON
// [bible-in-a-year, exorcist-files], the Podcasts shell
// standing); (b) the live series index (GET
// /api/agent/podcasts/progress — currents biy:day-318 ·
// ciy:day-2); (c) the two live series payloads for the
// group's own series (progress?series=… — bible-in-a-
// year: 372 entries, current biy:day-318 · exorcist-
// files: kind rss, 50 entries, its current the
// Nov 13, 2026 episode); (d) the live profiles read;
// (e) the standing book fixture
// (tests/fixtures/book-live-2026-11-17.json).
// The base for byte comparisons is the v517 ship tree
// (H521_BASE overrides).
// Run: node app/tests/harness-v521.mjs [--probe] (from
// the worktree root). --probe only prints.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
const BASE = process.env.H521_BASE || path.resolve(ROOT, '../../.worktrees/v517-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v521';
const DAY_LIVE = JSON.parse(readFileSync(FX + '/day-live-2026-11-17.json', 'utf8'));
const PODINDEX = JSON.parse(readFileSync(FX + '/podindex-live-2026-11-17.json', 'utf8'));
const BIY = JSON.parse(readFileSync(FX + '/series-bible-in-a-year-live-2026-11-17.json', 'utf8'));
const EXO = JSON.parse(readFileSync(FX + '/series-exorcist-files-live-2026-11-17.json', 'utf8'));
const PROFILES_LIVE = JSON.parse(readFileSync(FX + '/profiles-live-2026-11-17.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const pp = {}; parts.forEach((x) => { pp[x.type] = x.value; });
const TODAY = pp.year + '-' + pp.month + '-' + pp.day;
const DATE_LABEL = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
const HONOR = "named in honor of the tradition, not the order's own routine";
const BIY_CUR = BIY.currentKey;
const EXO_CUR = EXO.currentKey;

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- S: statics ---------------- */
{
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1].startsWith('0038'), 'S1: no migration beyond 0038 stands', migs[migs.length - 1]);
  // the v521 wiring block: from its comment head to the
  // paintOfflineLine() call that followed it in the base
  const head = C_SRC.indexOf('  // v521: the Podcasts group');
  const tailMark = '  paintOfflineLine();';
  const tail = head >= 0 ? C_SRC.indexOf(tailMark, head) : -1;
  const stripped = (head >= 0 && tail > head) ? C_SRC.slice(0, head) + C_SRC.slice(tail) : null;
  ok(stripped !== null && stripped === C_BASE,
    'S2: client.ts differs from the base only by the v521 series-wiring block (stripping it returns the base byte-for-byte)',
    stripped === null ? 'block not found' : ('len ' + (stripped || '').length + ' vs ' + C_BASE.length));
  ok(C_SRC.includes('goSeries(d.podSeries)') && C_SRC.includes("state.prayersView.block === 'Podcasts'"),
    'S3: the wiring calls the standing goSeries route, scoped to the Podcasts block page');
  ok(I_SRC === I_BASE, 'S4: index.ts byte-identical to the base (client-only release)');
  let massSame = true;
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts']) {
    if (readFileSync(SRC + '/' + f, 'utf8') !== readFileSync(BASE + '/' + f, 'utf8')) massSame = false;
  }
  ok(massSame, 'S5: the Mass sources byte-identical to the base');
  const pinStrip = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/, 'PIN');
  ok(pinStrip(U_SRC) === pinStrip(U_BASE), 'S6: ui.ts identical to the base outside the SW pin');
  const fold = DAY_LIVE.profile || {};
  const podLayer = (fold.layers || []).find((l) => l.key === 'podcasts') || {};
  const idxBiy = (PODINDEX.seriesList || []).find((s) => s.series === 'bible-in-a-year') || {};
  const exoEntry = (EXO.entries || []).find((e) => e.key === EXO_CUR) || null;
  ok(fold.key === 'salesian' && podLayer.on === true && JSON.stringify(podLayer.series) === '["bible-in-a-year","exorcist-files"]'
    && idxBiy.currentKey === BIY_CUR && !!exoEntry && EXO.kind === 'rss'
    && (PROFILES_LIVE.state || {}).standingKey === 'salesian',
    'S7: the fixtures stand in the live shape (the day fold carries the Podcasts layer ON with the two live series; the biy fixture current matches the live index; the exorcist-files fixture is the rss payload whose entries carry its current)',
    JSON.stringify({ fold: fold.key, series: podLayer.series, idxBiy: idxBiy.currentKey, biyCur: BIY_CUR, exoKind: EXO.kind }));
}

/* ---------------- C: the client legs ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
const APP_JS = cook(C_SRC);
const APP_JS_BASE = cook(C_BASE);
try { new Function(APP_JS); ok(true, 'C0: the cooked APP_JS parses whole'); }
catch (e) { ok(false, 'C0: the cooked APP_JS parses whole', String(e).slice(0, 120)); }

const TRACKS = {
  Morning: [{ episodeId: 'morning-prayer', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/morning.mp3' },
            { episodeId: 'daily-rosary', title: 'The Holy Rosary', durationS: 1500, available: true, streamUrl: 'https://audio.example/rosary.mp3' }],
  Midday: [{ episodeId: 'midday-prayer', title: 'Midday Prayer', durationS: 480, available: true, streamUrl: 'https://audio.example/midday.mp3' }],
  Evening: [{ episodeId: 'evening-prayer', title: 'Evening Prayer', durationS: 660, available: true, streamUrl: 'https://audio.example/evening.mp3' }],
  Night: [{ episodeId: 'night-prayer', title: 'Night Prayer', durationS: 420, available: true, streamUrl: 'https://audio.example/night.mp3' }],
  Novenas: [{ episodeId: 'novena-st_catherine_of_alexandria', title: 'Traditional Novena to St Catherine of Alexandria Day 2', durationS: 248, available: true, streamUrl: 'https://audio.example/novena-cat.mp3' },
            { episodeId: 'novena-st_monica', title: 'Traditional Novena to St Monica Day 4', durationS: 260, available: true, streamUrl: 'https://audio.example/novena-mon.mp3' }],
};
const CAPTIONS = { Novenas: "the day's novenas", Morning: 'morning prayer and devotions', Midday: 'the Angelus and midday prayer', Evening: 'evening prayer', Night: 'night prayer and an examination' };
function mkBlockStub(name, layer) {
  const b = { block: name, label: name, caption: CAPTIONS[name] || '', spotifyUrl: null, tracks: TRACKS[name] || [], trackCount: (TRACKS[name] || []).length };
  if (layer) b.layer = layer;
  return b;
}
function foldOf(p, resolvedBy, version) {
  return { key: p.key, name: p.name, honorLine: p.honorLine, resolvedBy: resolvedBy, dayKind: 'weekday',
    coreBlocks: p.coreBlocks.slice(),
    layers: [{ key: 'novenas', on: p.layers.novenas.on }, { key: 'podcasts', on: p.layers.podcasts.on, series: p.layers.podcasts.series.slice() }],
    version: version };
}
function freshStore() {
  // the LIVE shape (fixture (d)): salesian standing, its
  // Podcasts layer ON with John's two series
  return {
    profiles: [
      { key: 'little-way', name: 'The Little Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Night'], layers: { novenas: { on: false }, podcasts: { on: false, series: [] } } },
      { key: 'salesian', name: 'The Salesian Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: true, series: ['bible-in-a-year', 'exorcist-files'] } } },
      { key: 'benedictine', name: 'The Benedictine Way', honorLine: HONOR, kind: 'default', coreBlocks: ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: false, series: [] } } },
    ],
    state: { standingKey: 'salesian', dayRule: true, version: 4 },
    pick: null,
  };
}
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const SHELL_BASE = U_BASE.slice(U_BASE.indexOf('SHELL_HTML = `') + 14, U_BASE.indexOf('`;', U_BASE.indexOf('SHELL_HTML = `')));
const MASS_PAYLOAD = { ok: true, date: TODAY, mass: { name: 'Tuesday of week 33 in Ordinary Time', rank: 'ferial', season: 'Ordinary Time', color: 'green', readings: [{ label: 'First Reading', cite: '2 Mc 6:18-31', text: 'Eleazar, one of the foremost scribes.' }, { label: 'Gospel', cite: 'Lk 19:1-10', text: 'Jesus came to Jericho.' }] } };

async function buildPage(appJs, opts) {
  opts = opts || {};
  const require2 = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
  const { chromium } = require2('playwright-core');
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' });
  const page = await browser.newPage();
  const store = opts.store || freshStore();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.addInitScript(({ bookJson, massJson, biyJson, exoJson, podindexJson }) => {
    window.__store = null;
    window.fetch = function (url, options) {
      const u = String(url);
      const ans = (body, status) => Promise.resolve({ ok: (status || 200) < 400, status: status || 200, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)), blob: () => Promise.resolve(new Blob(['x'])), headers: { get: () => null } });
      try {
        const method = (options && options.method) || 'GET';
        if (method === 'PUT' && u.indexOf('/api/prayer/profiles/') >= 0) {
          const body = JSON.parse((options && options.body) || '{}');
          const st = window.__store;
          if (u.indexOf('/day-pick') >= 0) { st.pick = body.profileKey || null; st.state.version++; }
          if (u.indexOf('/layers') >= 0) { const p = st.profiles.find((x) => x.key === body.profileKey); if (p) p.layers = body.layers; st.state.version++; }
          if (u.indexOf('/state') >= 0) { if (body.standingKey) st.state.standingKey = body.standingKey; if (typeof body.dayRule === 'boolean') st.state.dayRule = body.dayRule; st.state.version++; }
          return ans(window.__profilesAnswer());
        }
        if (u.indexOf('/api/prayer/profiles') >= 0) return ans(window.__profilesAnswer());
        if (u.indexOf('/api/player/day') >= 0) return ans(window.__dayFor());
        if (u.indexOf('/api/player/source-settings') >= 0) return ans({ ok: true, version: 8, sources: [] });
        if (u.indexOf('/api/player/podcasts?series=bible-in-a-year') >= 0) return ans(JSON.parse(biyJson));
        if (u.indexOf('/api/player/podcasts?series=exorcist-files') >= 0) return ans(JSON.parse(exoJson));
        if (u.indexOf('/api/player/podcasts') >= 0) return ans(JSON.parse(podindexJson));
        if (u.indexOf('/api/prayer/book/favorites') >= 0) return ans({ ok: true, favorites: [] });
        if (u.indexOf('/api/prayer/book') >= 0) return ans(JSON.parse(bookJson));
        if (u.indexOf('/api/prayer/mass-personal-prayer') >= 0) return ans({ ok: true, before: null, after: null, afterMass: [], preMass: [] });
        if (u.indexOf('/api/mass/readings') >= 0 || u.indexOf('/api/mass') >= 0) return ans(JSON.parse(massJson));
        return ans({ ok: true });
      } catch (e) { return ans({ ok: false, error: String(e) }, 500); }
    };
    window.__extFetchText = function () { return Promise.reject(new Error('offline')); };
    URL.createObjectURL = function () { return 'blob:fake'; };
    URL.revokeObjectURL = function () {};
    HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function () { el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.load = function () {};
  }, { bookJson: JSON.stringify(BOOK), massJson: JSON.stringify(MASS_PAYLOAD), biyJson: JSON.stringify(BIY), exoJson: JSON.stringify(EXO), podindexJson: JSON.stringify(PODINDEX) });
  await page.addInitScript(({ storeJson, foldOfSrc, mkBlockStubSrc, tracksJson, captionsJson, todayStr, dateLabel }) => {
    const TRACKS = JSON.parse(tracksJson); const CAPTIONS = JSON.parse(captionsJson);
    const mkBlockStub = eval('(' + mkBlockStubSrc + ')');
    const foldOf = eval('(' + foldOfSrc + ')');
    window.__store = JSON.parse(storeJson);
    window.__dayFor = function () {
      const st = window.__store;
      const eff = st.pick ? st.profiles.find((p) => p.key === st.pick) : st.profiles.find((p) => p.key === st.state.standingKey);
      const fold = foldOf(eff, st.pick ? 'pick' : 'standing', st.state.version);
      const blocks = eff.coreBlocks.map((b) => mkBlockStub(b));
      if (eff.layers.novenas.on) blocks.push(mkBlockStub('Novenas', 'novenas'));
      if (eff.layers.podcasts.on) blocks.push({ block: 'Podcasts', label: 'Podcasts', caption: 'the podcasts you added', spotifyUrl: null, tracks: [], trackCount: 0, layer: 'podcasts' });
      return { ok: true, date: todayStr, dateLabel: dateLabel, presentedDay: todayStr, version: 8, introTexts: {}, blocks: blocks, dayPositions: {}, blockOrder: null, additions: [], profile: fold };
    };
    window.__profilesAnswer = function () {
      const st = window.__store;
      return { ok: true, profiles: JSON.parse(JSON.stringify(st.profiles)), state: { standingKey: st.state.standingKey, dayRule: st.state.dayRule, version: st.state.version }, effective: window.__dayFor().profile };
    };
  }, { storeJson: JSON.stringify(store), foldOfSrc: foldOf.toString(), mkBlockStubSrc: mkBlockStub.toString(), tracksJson: JSON.stringify(TRACKS), captionsJson: JSON.stringify(CAPTIONS), todayStr: TODAY, dateLabel: DATE_LABEL });
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>harness-v521</title></head><body data-lit="">\n<audio id="audio"></audio>\n' + (opts.baseShell ? SHELL_BASE : SHELL) + '\n<script>' + appJs + '</' + 'script></body></html>';
  const server = http.createServer((req, res) => {
    if ((req.url || '/').split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForTimeout(2600);
  await page.evaluate(() => { setTab('prayers'); });
  await page.waitForTimeout(1500);
  return { page, browser, server, errs, store };
}
const homeRows = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#view [data-openblock]')).map((el) => el.getAttribute('data-openblock')));
const pageHtmlNormalized = (page) => page.evaluate(() => {
  const host = document.createElement('div');
  host.innerHTML = document.querySelector('#view').innerHTML;
  host.querySelectorAll('img.rowart, img.coverimg').forEach((im) => im.remove());
  host.querySelectorAll('[data-poddlstate]').forEach((el) => el.removeAttribute('style'));
  return host.innerHTML;
});
const diffHint = (a, b) => {
  if (a === b) return 'equal';
  let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  return 'DIFF at ' + i + ' len ' + a.length + ' vs ' + b.length + ' :: ' + JSON.stringify(a.slice(Math.max(0, i - 60), i + 120)) + ' || ' + JSON.stringify(b.slice(Math.max(0, i - 60), i + 120));
};
async function waitFor(page, fn, arg, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 9000)) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(200);
  }
  return false;
}

if (!PROBE) {
  /* C1–C2: the fold day paints; the group page carries the two live currents */
  let main;
  {
    main = await buildPage(APP_JS);
    const { page, errs } = main;
    const rows = await homeRows(page);
    ok(JSON.stringify(rows) === '["Morning","Midday","Evening","Night","Novenas","Podcasts"]',
      'C1: the home paints the fold rows — the Salesian core, Novenas, the Podcasts group last', JSON.stringify(rows));
    const cardState = await page.evaluate(() => {
      const c = document.querySelector('.profcard');
      return c ? { expand: !!c.querySelector('[data-profexpand]'), change: !!c.querySelector('[data-profchange]') } : null;
    });
    ok(cardState && cardState.expand === true && cardState.change === false,
      'C2: the profile card stands COLLAPSED at the home (v517 untouched — the Edit act stands, the body acts do not)', JSON.stringify(cardState));
    await page.evaluate(() => { openBlockPage('Podcasts'); });
    await page.waitForTimeout(700);
    const cards = await page.evaluate(() => Array.from(document.querySelectorAll('#view [data-card]')).map((el) => el.getAttribute('data-card')));
    ok(JSON.stringify(cards) === JSON.stringify([BIY_CUR, EXO_CUR]),
      'C3: the Podcasts group page shows the two series\' current-episode cards, in layer order', JSON.stringify(cards));
    ok(errs.length === 0, 'C4: the page boots clean on the fold day (no page errors)', errs.join(' ; '));
  }
  /* C5: the Catechesis arrival is the reference; the group arrival must equal it */
  {
    const { page } = main;
    // bible-in-a-year files under the Courses side (the
    // index paints the standing side's category only)
    await page.evaluate(() => { setTab('podcasts'); switchPodSide('courses'); });
    const idxReady = await waitFor(page, (k) => !!document.querySelector('[data-podseries="' + k + '"]'), 'bible-in-a-year');
    ok(idxReady, 'C5a: the Catechesis Courses index stands with the bible-in-a-year series card');
    await page.click('[data-podseries="bible-in-a-year"]');
    const arrived = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'bible-in-a-year' && podLevel === 'series');
    await page.waitForTimeout(500);
    const refState = await page.evaluate(() => ({ tab: state.tab, series: state.podcasts && state.podcasts.series, level: podLevel }));
    const ref = { ...refState, html: await pageHtmlNormalized(page) };
    ok(arrived && ref.series === 'bible-in-a-year' && ref.level === 'series',
      'C5b: the Catechesis arrival stands on the bible-in-a-year series page (the reference state)', JSON.stringify({ tab: ref.tab, series: ref.series, level: ref.level }));
    // back to the Pray tab, into the group, and tap the card body
    await page.evaluate(() => { setTab('prayers'); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { openBlockPage('Podcasts'); });
    await page.waitForTimeout(700);
    await page.click('[data-card="' + BIY_CUR + '"] h3');
    const arrived2 = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'bible-in-a-year' && podLevel === 'series');
    await page.waitForTimeout(500);
    const gotState = await page.evaluate(() => ({ tab: state.tab, series: state.podcasts && state.podcasts.series, level: podLevel }));
    const got = { ...gotState, html: await pageHtmlNormalized(page) };
    ok(arrived2 && got.tab === ref.tab && got.series === ref.series && got.level === ref.level && got.html === ref.html,
      'C5c: a tap on the group card\'s body lands on the series surface — the same state and the same painted page the Catechesis open produces (the two named transients normalized)',
      'tab ' + got.tab + ' series ' + got.series + ' level ' + got.level + ' html ' + diffHint(got.html, ref.html));
  }
  /* C6: the exorcist-files card — the same equality, in the rss form */
  {
    const { page } = main;
    await page.evaluate(() => { switchPodSide('podcasts'); });
    const idxReady = await waitFor(page, (k) => !!document.querySelector('[data-podseries="' + k + '"]'), 'exorcist-files');
    ok(idxReady, 'C6a: the Catechesis Podcasts index stands with the exorcist-files series card');
    await page.click('[data-podseries="exorcist-files"]');
    const arrived = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'exorcist-files' && podLevel === 'series');
    await page.waitForTimeout(500);
    const refState = await page.evaluate(() => ({ tab: state.tab, series: state.podcasts && state.podcasts.series, kind: state.podcasts && state.podcasts.kind, level: podLevel }));
    const ref = { ...refState, html: await pageHtmlNormalized(page) };
    ok(arrived && ref.series === 'exorcist-files' && ref.kind === 'rss',
      'C6b: the Catechesis arrival stands on the exorcist-files series page in the rss form (the reference state)', JSON.stringify({ series: ref.series, kind: ref.kind, level: ref.level }));
    await page.evaluate(() => { setTab('prayers'); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { openBlockPage('Podcasts'); });
    await page.waitForTimeout(700);
    await page.click('[data-card="' + EXO_CUR + '"] h3');
    const arrived2 = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'exorcist-files' && podLevel === 'series');
    await page.waitForTimeout(500);
    const gotState = await page.evaluate(() => ({ tab: state.tab, series: state.podcasts && state.podcasts.series, kind: state.podcasts && state.podcasts.kind, level: podLevel }));
    const got = { ...gotState, html: await pageHtmlNormalized(page) };
    ok(arrived2 && got.tab === ref.tab && got.series === ref.series && got.kind === 'rss' && got.level === ref.level && got.html === ref.html,
      'C6c: a tap on the exorcist-files group card lands on its series surface — the same state and the same painted rss page the Catechesis open produces (the two named transients normalized)',
      'tab ' + got.tab + ' series ' + got.series + ' kind ' + got.kind + ' level ' + got.level + ' html ' + diffHint(got.html, ref.html));
    await main.browser.close(); main.server.close();
  }
  /* C7–C8: the episode acts stand — the play disc plays, the ⋮ does not navigate */
  {
    const s = await buildPage(APP_JS);
    await s.page.evaluate(() => { openBlockPage('Podcasts'); });
    await s.page.waitForTimeout(700);
    await s.page.click('[data-card="' + BIY_CUR + '"] [data-rowmenu]');
    await s.page.waitForTimeout(900);
    const menu = await s.page.evaluate(() => {
      const sh = document.querySelector('.anchmenu');
      return { sheet: !!sh, share: sh ? sh.textContent.indexOf('Share') >= 0 : false, tab: state.tab, seriesLoaded: !!(state.podcasts && state.podcasts.series) };
    });
    ok(menu.sheet && menu.share && menu.tab === 'prayers' && !menu.seriesLoaded,
      'C7: a tap on the card\'s ⋮ opens the episode\'s menu (the anchored card) and does not navigate', JSON.stringify(menu));
    await s.page.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });
    await s.page.click('[data-card="' + BIY_CUR + '"] [data-playkey]');
    const played = await waitFor(s.page, (k) => !!state.current && state.current.episodeId === k, BIY_CUR);
    const after = await s.page.evaluate(() => ({ tab: state.tab, cur: state.current && state.current.episodeId, seriesLoaded: !!(state.podcasts && state.podcasts.series) }));
    ok(played && after.tab === 'prayers' && !after.seriesLoaded,
      'C8: the play disc on the group card still plays the episode — the current names it, the tab stays on Prayers, no series opens', JSON.stringify(after));
    ok(s.errs.length === 0, 'C9: no page errors across the episode-act legs', s.errs.join(' ; '));
    await s.browser.close(); s.server.close();
  }
  /* C10–C11: the layer postures stand as v515 left them */
  {
    const offStore = freshStore();
    offStore.profiles.find((p) => p.key === 'salesian').layers.podcasts = { on: false, series: [] };
    const a = await buildPage(APP_JS, { store: offStore });
    const rowsOff = await homeRows(a.page);
    ok(JSON.stringify(rowsOff) === '["Morning","Midday","Evening","Night","Novenas"]',
      'C10: the Podcasts layer OFF — no Podcasts group stands on the home (v515 behavior unchanged)', JSON.stringify(rowsOff));
    await a.browser.close(); a.server.close();
    const emptyStore = freshStore();
    emptyStore.profiles.find((p) => p.key === 'salesian').layers.podcasts = { on: true, series: [] };
    const b = await buildPage(APP_JS, { store: emptyStore });
    const rowsEmpty = await homeRows(b.page);
    await b.page.evaluate(() => { openBlockPage('Podcasts'); });
    await b.page.waitForTimeout(600);
    const nCards = await b.page.evaluate(() => document.querySelectorAll('#view [data-card]').length);
    ok(JSON.stringify(rowsEmpty) === '["Morning","Midday","Evening","Night","Novenas","Podcasts"]' && nCards === 0,
      'C11: the layer ON with no series picked — the shell stands as today and its page carries no cards (no series act can stand)', JSON.stringify(rowsEmpty) + ' cards=' + nCards);
    await b.browser.close(); b.server.close();
  }
  /* C12: a core block page is byte-identical to the base ship's */
  {
    const a = await buildPage(APP_JS);
    const b = await buildPage(APP_JS_BASE, { baseShell: true });
    await a.page.evaluate(() => { openBlockPage('Morning'); });
    await b.page.evaluate(() => { openBlockPage('Morning'); });
    await a.page.waitForTimeout(500); await b.page.waitForTimeout(500);
    const ha = await a.page.evaluate(() => document.querySelector('#view').innerHTML);
    const hb = await b.page.evaluate(() => document.querySelector('#view').innerHTML);
    ok(ha === hb, 'C12: a core block page (Morning) paints byte-identical to the base ship\'s', 'len ' + ha.length + ' vs ' + hb.length);
    await a.browser.close(); a.server.close(); await b.browser.close(); b.server.close();
  }
  /* C13: the v517 editor still opens from the expanded card */
  {
    const s = await buildPage(APP_JS);
    await s.page.click('[data-profexpand]');
    await s.page.waitForTimeout(500);
    await s.page.click('[data-profcustomize]');
    await s.page.waitForTimeout(900);
    const ed = await s.page.evaluate(() => {
      const sh = document.querySelector('.sheet');
      return sh ? sh.textContent : '';
    });
    ok(ed.indexOf('Save as new') >= 0 && ed.indexOf('named profiles cannot be changed') >= 0,
      'C13: the v517 profile editor still opens from the expanded card (copy mode on the standing default)', ed.slice(0, 120));
    await s.browser.close(); s.server.close();
  }
}

console.log('\nharness-v521: ' + pass + ' ok, ' + fail + ' not-ok' + (failures.length ? ' — ' + failures.join(' · ') : ''));
process.exit(PROBE ? 0 : (fail ? 1 : 0));
