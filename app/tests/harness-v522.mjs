// harness-v522.mjs — v522 evidence: in the day's
// Podcasts group, the entry that stands is THE PODCAST
// itself (John, Ora thread 2026-11-17 22:16 CT: "I want
// the entire podcast linked into the day not just the
// latest episode"; confirmed 22:26 CT: what shows is the
// podcast — the series entry, not its latest episode
// standing as a track — and the click goes through to
// the podcast itself). The group page paints ONE SERIES
// CARD per picked series from the payloads the group
// build already fetches and now retains
// (state.podGroups.payloads), in the Catechesis index
// card's form (art · title · the kind's meta line); the
// card's tap rides v521's standing goSeries route to the
// series page exactly as Catechesis → Podcasts produces
// it, where all episodes stand and play. NO Podcasts
// episode stands in the day build: podDayDesc retires,
// the fold contributes nothing for the shell, and the
// group's counts read the standing podcasts (the home
// row "N podcasts", the page meta "N podcasts · M
// episodes"). The first build under the 22:16 read (an
// in-place expansion, commit 8743c57) was reverted whole
// (90c918e) and replaced by this shape (83074bb); this
// harness replaces the expansion harness whole.
//   S statics: client.ts differs from the base only by
//     the named v522 regions (each named region,
//     normalized back to its base text, returns the base
//     byte-for-byte) · index.ts + the Mass sources
//     byte-identical · ui.ts identical outside the pin ·
//     no migration beyond 0038 · the fixtures stand
//   C client (the v510 Chromium mold, stubbed fetch; the
//     stub store carries the LIVE layer shape — salesian
//     podcasts ON [bible-in-a-year, exorcist-files]):
//     the cooked parse + boot clean · the home rows with
//     the Podcasts row last, its count reading "2
//     podcasts", and the profile card COLLAPSED (v517) ·
//     the group page's two series entries with their
//     standing metas, the page meta "2 podcasts · 422
//     episodes", and no episode furniture · the day build
//     carries no Podcasts-group episode · a tap on each
//     series entry lands byte-equal to its Catechesis
//     arrival (state + painted page; the two named
//     transients normalized — the remote art images and
//     the download-state icons' style, as v521) with the
//     full set standing (372 · 50 rows) · on the arrived
//     series page a non-current episode plays · the
//     layer OFF stands no Podcasts row · the layer ON
//     with no series picked stands the shell with no
//     series entries · a Morning block page byte-
//     identical to the base ship's · the v517 editor
//     still opens from the expanded card
// Fixtures (Improvement D), under tests/fixtures-v522/,
// drawn from production on 2026-11-17 after v521
// shipped, through the prayer door: (a) the live day
// payload (GET /api/agent/player/day?date=2026-11-17 —
// salesian by 'standing', the Podcasts layer ON
// [bible-in-a-year, exorcist-files], the Podcasts shell
// standing); (b) the live series index (GET
// /api/agent/podcasts/progress — currents biy:day-318 ·
// ciy:day-2); (c) the two live series payloads for the
// group's own series (progress?series=… — bible-in-a-
// year: 372 entries, current biy:day-318 at index 318,
// 318 listened, every entry carrying a URL ·
// exorcist-files: kind rss, 50 entries, current at
// index 0, 2 listened, every entry carrying a URL);
// (d) the live profiles read; (e) the standing book
// fixture (tests/fixtures/book-live-2026-11-17.json).
// The base for byte comparisons is the v521 ship tree
// (H522_BASE overrides).
// Run: node app/tests/harness-v522.mjs [--probe] (from
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
const BASE = process.env.H522_BASE || path.resolve(ROOT, '../../.worktrees/v521-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v522';
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
const BIY_CUR_IDX = BIY.entries.findIndex((e) => e.key === BIY.currentKey);
const BIY_COLLAPSED = BIY.entries.filter((e, ix) => e.listened && ix < BIY_CUR_IDX).length;
const BIY_PAINTED = BIY.entries.length - BIY_COLLAPSED;
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
  // The v522 regions: each build region, replaced by its
  // base counterpart, must return the base byte-for-byte —
  // the build touched nothing outside the named regions.
  const region = (src, startAnchor, endAnchor) => {
    const i = src.indexOf(startAnchor);
    if (i < 0) return null;
    const j = src.indexOf(endAnchor, i);
    if (j < 0) return null;
    return src.slice(i, j);
  };
  const regions = [
    ['the resolver block (podGroupFacts + the payload-retaining resolver; podDayDesc and the deletion junction ride this slice)',
      region(C_SRC, 'function podGroupFacts()', 'function extRebuildDescs(day) {'),
      region(C_BASE, 'function podDayDesc(series, payload) {', 'function extRebuildDescs(day) {')],
    ['the fold segment (the shell folds nothing)',
      region(C_SRC, '    // v522: the Podcasts layer shell folds NOTHING', '    // v342/v348: the block'),
      region(C_BASE, '    // v515 §2: the Podcasts layer shell emits the profile', '    // v342/v348: the block')],
    ['the group page append (the series cards)',
      region(C_SRC, 'function appendBlockPodcastCards', '\nfunction paintBlockPage'),
      region(C_BASE, 'function appendBlockPodcastCards', '\nfunction paintBlockPage')],
    ['the click-through wiring (the Podcasts block section)',
      region(C_SRC, "  // v522: the Podcasts group's click-through", '  paintOfflineLine();'),
      region(C_BASE, "  // v521: the Podcasts group's series act", '  paintOfflineLine();')],
    ['the bcount read (the standing podcasts counted)',
      region(C_SRC, "    // v522: the Podcasts group's count reads the podcasts", '  });\n  // v413'),
      region(C_BASE, "    el.textContent = (counts[b] || 0) + ' tracks';", '  });\n  // v413')],
    ['the bmeta read (the page meta names what stands)',
      region(C_SRC, '    var blk2 = (day.blocks || [])', "    el.textContent = (counts[b] || 0) + ' episodes'"),
      region(C_BASE, "    el.textContent = (counts[b] || 0) + ' episodes'", "    el.textContent = (counts[b] || 0) + ' episodes'")],
  ];
  let norm = C_SRC, normOk = true, normWhy = '';
  for (const [name, buildText, baseText] of regions) {
    if (buildText === null || baseText === null) { normOk = false; normWhy = 'region not found: ' + name; break; }
    if (!norm.includes(buildText)) { normOk = false; normWhy = 'build region not found verbatim: ' + name; break; }
    norm = norm.replace(buildText, baseText);
  }
  if (normOk && norm !== C_BASE) {
    normOk = false;
    let i = 0; while (i < Math.min(norm.length, C_BASE.length) && norm[i] === C_BASE[i]) i++;
    normWhy = 'normalized text differs from the base at ' + i + ' :: ' + JSON.stringify(norm.slice(Math.max(0, i - 50), i + 90)) + ' || ' + JSON.stringify(C_BASE.slice(Math.max(0, i - 50), i + 90));
  }
  ok(normOk, 'S2: client.ts differs from the base only by the named v522 regions (normalizing them returns the base byte-for-byte)', normWhy);
  ok(C_SRC.includes('data-daypodseries') && C_SRC.includes('function podGroupFacts()') && C_SRC.includes('state.podGroups.payloads[k] = payload')
    && !C_SRC.includes('function podDayDesc(') && !C_SRC.includes('podGroups.descs'),
    'S3: the build stands — the series-card emission, the facts helper, and the payload retention read in client.ts; podDayDesc and the descs fold are gone');
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
    && BIY.entries.length === 372 && EXO.entries.length === 50
    && BIY.entries.filter((e) => e.listened).length === 318 && EXO.entries.filter((e) => e.listened).length === 2
    && BIY.entries.every((e) => !!e.url) && EXO.entries.every((e) => !!e.url)
    && (PROFILES_LIVE.state || {}).standingKey === 'salesian',
    'S7: the fixtures stand in the live shape (the day fold carries the Podcasts layer ON with the two live series; both payloads carry their full live entry sets, currents, listened flags, and URLs)',
    JSON.stringify({ fold: fold.key, series: podLayer.series, idxBiy: idxBiy.currentKey, biyCur: BIY_CUR, biyN: BIY.entries.length, exoN: EXO.entries.length }));
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
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>harness-v522</title></head><body data-lit="">\n<audio id="audio"></audio>\n' + (opts.baseShell ? SHELL_BASE : SHELL) + '\n<script>' + appJs + '</' + 'script></body></html>';
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
  /* C1–C6: the fold day paints; the group page carries the two series entries; no Podcasts episode stands in the day build */
  {
    const main = await buildPage(APP_JS);
    const { page, errs } = main;
    const rows = await homeRows(page);
    ok(JSON.stringify(rows) === '["Morning","Midday","Evening","Night","Novenas","Podcasts"]',
      'C1: the home paints the fold rows — the Salesian core, Novenas, the Podcasts group last', JSON.stringify(rows));
    const counted = await waitFor(page, () => { const el = document.querySelector('[data-bcount="Podcasts"]'); return !!el && el.textContent === '2 podcasts'; }, null, 12000);
    ok(counted, 'C2: the Podcasts row\'s count line reads "2 podcasts" once the payloads settle (the count reads the standing podcasts, not day tracks)');
    const cardState = await page.evaluate(() => {
      const c = document.querySelector('.profcard');
      return c ? { expand: !!c.querySelector('[data-profexpand]'), change: !!c.querySelector('[data-profchange]') } : null;
    });
    ok(cardState && cardState.expand === true && cardState.change === false,
      'C3: the profile card stands COLLAPSED at the home (v517 untouched — the Edit act stands, the body acts do not)', JSON.stringify(cardState));
    await page.evaluate(() => { openBlockPage('Podcasts'); });
    await page.waitForTimeout(700);
    const grp = await page.evaluate(() => ({
      series: Array.from(document.querySelectorAll('#view [data-daypodseries]')).map((el) => el.getAttribute('data-daypodseries')),
      titles: Array.from(document.querySelectorAll('#view [data-daypodseries] h3')).map((el) => el.textContent),
      metas: Array.from(document.querySelectorAll('#view [data-daypodseries] .meta')).map((el) => el.textContent),
      pageMeta: (document.querySelector('[data-bmeta="Podcasts"]') || {}).textContent || '',
      cards: document.querySelectorAll('#view [data-card]').length,
      discs: document.querySelectorAll('#view [data-playkey]').length,
      dots: document.querySelectorAll('#view [data-poddot]').length,
    }));
    ok(JSON.stringify(grp.series) === '["bible-in-a-year","exorcist-files"]'
      && JSON.stringify(grp.titles) === '["Bible in a Year","The Exorcist Files"]'
      && grp.metas[0] === '318 of 372 listened · Current: Day 318'
      && grp.metas[1] === '2 of 50 listened · Latest: Nov 13, 2026'
      && grp.pageMeta === '2 podcasts · 422 episodes'
      && grp.cards === 0 && grp.discs === 0 && grp.dots === 0,
      'C4: the group page shows ONE SERIES ENTRY per added podcast in layer order — the podcast itself (its title, its standing meta), the page meta naming "2 podcasts · 422 episodes" — and NO episode card, play disc, or played dot stands on the page',
      JSON.stringify(grp));
    const dayBuild = await page.evaluate(() => {
      const rebuilt = extRebuildDescs(state.dayPayload);
      const tally = (ds) => ({ pod: ds.filter((d) => d.kind === 'podcast').length, biy: ds.filter((d) => String(d.episodeId).indexOf('biy:') === 0).length, gid: ds.filter((d) => String(d.episodeId).indexOf('gid://') === 0).length });
      return { day: tally(state.dayDescs), rebuilt: tally(rebuilt) };
    });
    ok(dayBuild.day.pod === 0 && dayBuild.day.biy === 0 && dayBuild.day.gid === 0 && dayBuild.rebuilt.pod === 0 && dayBuild.rebuilt.biy === 0 && dayBuild.rebuilt.gid === 0,
      'C5: NO Podcasts-group episode stands in the day build — state.dayDescs and a fresh fold carry no podcast-kind descriptor and no group episode key (the day\'s queues and snapshot hold none)', JSON.stringify(dayBuild));
    ok(errs.length === 0, 'C6: the page boots clean on the fold day (no page errors)', errs.join(' ; '));
    await main.browser.close(); main.server.close();
  }
  /* C7: the BIY series entry's tap lands byte-equal to the Catechesis arrival, the full set standing */
  {
    const s = await buildPage(APP_JS);
    const { page } = s;
    await page.evaluate(() => { setTab('podcasts'); switchPodSide('courses'); });
    const idxReady = await waitFor(page, (k) => !!document.querySelector('[data-podseries="' + k + '"]'), 'bible-in-a-year');
    ok(idxReady, 'C7a: the Catechesis Courses index stands with the bible-in-a-year series card');
    await page.click('[data-podseries="bible-in-a-year"]');
    const arrived = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'bible-in-a-year' && podLevel === 'series');
    await page.waitForTimeout(500);
    const refState = await page.evaluate(() => ({ tab: state.tab, series: state.podcasts && state.podcasts.series, level: podLevel, rows: document.querySelectorAll('#view [data-podrow]').length, head: (document.querySelector('.podpage-head .meta') || {}).textContent || '', disc: (document.querySelector('[data-podcollapse] .grow') || {}).textContent || '' }));
    const ref = { ...refState, html: await pageHtmlNormalized(page) };
    ok(arrived && ref.series === 'bible-in-a-year' && ref.level === 'series' && ref.rows === BIY_PAINTED && ref.head.indexOf('of 372 listened') >= 0 && ref.disc === BIY_COLLAPSED + ' earlier episodes listened',
      'C7b: the Catechesis arrival stands on the bible-in-a-year series page — its head names the FULL set (318 of 372 listened), the listened earlier episodes folded behind the standing disclosure (' + BIY_COLLAPSED + '), the standing window painted (' + BIY_PAINTED + ' rows — the reference state)', JSON.stringify({ tab: ref.tab, series: ref.series, level: ref.level, rows: ref.rows, head: ref.head, disc: ref.disc }));
    await page.evaluate(() => { setTab('prayers'); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { openBlockPage('Podcasts'); });
    await page.waitForTimeout(700);
    await page.click('[data-daypodseries="bible-in-a-year"]');
    const arrived2 = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'bible-in-a-year' && podLevel === 'series');
    await page.waitForTimeout(500);
    const gotState = await page.evaluate(() => ({ tab: state.tab, series: state.podcasts && state.podcasts.series, level: podLevel, rows: document.querySelectorAll('#view [data-podrow]').length }));
    const got = { ...gotState, html: await pageHtmlNormalized(page) };
    ok(arrived2 && got.tab === ref.tab && got.series === ref.series && got.level === ref.level && got.rows === BIY_PAINTED && got.html === ref.html,
      'C7c: a tap on the day\'s bible-in-a-year series entry goes through to the podcast itself — the same state and painted series page the Catechesis open produces (the two named transients normalized)',
      'tab ' + got.tab + ' series ' + got.series + ' level ' + got.level + ' rows ' + got.rows + ' html ' + diffHint(got.html, ref.html));
    await page.click('[data-podcollapse]');
    const fullSet = await waitFor(page, (n) => document.querySelectorAll('#view [data-podrow]').length === n, 372, 12000);
    ok(fullSet, 'C7d: on the arrived page the standing disclosure opens the folded earlier episodes — the ENTIRE podcast stands reachable (372 episode rows)');
    await s.browser.close(); s.server.close();
  }
  /* C8–C9: playing happens from the series page */
  {
    const s = await buildPage(APP_JS);
    const { page } = s;
    await page.evaluate(() => { openBlockPage('Podcasts'); });
    await page.waitForTimeout(700);
    await page.click('[data-daypodseries="bible-in-a-year"]');
    const arrived = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'bible-in-a-year' && podLevel === 'series');
    await page.click('[data-podrow="biy:day-319"] [data-podplay]');
    const played = await waitFor(page, (k) => !!state.current && state.current.episodeId === k, 'biy:day-319', 12000);
    const after = await page.evaluate(() => ({ tab: state.tab, cur: state.current && state.current.episodeId }));
    ok(arrived && played && after.tab === 'podcasts' && after.cur === 'biy:day-319',
      'C8: on the arrived series page a NON-CURRENT episode plays (biy:day-319) — playing happens from the podcast itself, not from the day', JSON.stringify(after));
    ok(s.errs.length === 0, 'C9: no page errors across the click-through + play legs', s.errs.join(' ; '));
    await s.browser.close(); s.server.close();
  }
  /* C10: the exorcist-files entry — the same equality, in the rss form */
  {
    const s = await buildPage(APP_JS);
    const { page } = s;
    await page.evaluate(() => { setTab('podcasts'); switchPodSide('podcasts'); });
    const idxReady = await waitFor(page, (k) => !!document.querySelector('[data-podseries="' + k + '"]'), 'exorcist-files');
    ok(idxReady, 'C10a: the Catechesis Podcasts index stands with the exorcist-files series card');
    await page.click('[data-podseries="exorcist-files"]');
    const arrived = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'exorcist-files' && podLevel === 'series');
    await page.waitForTimeout(500);
    const refState = await page.evaluate(() => ({ tab: state.tab, series: state.podcasts && state.podcasts.series, kind: state.podcasts && state.podcasts.kind, level: podLevel, rows: document.querySelectorAll('#view [data-podrow]').length }));
    const ref = { ...refState, html: await pageHtmlNormalized(page) };
    ok(arrived && ref.series === 'exorcist-files' && ref.kind === 'rss' && ref.rows === 50,
      'C10b: the Catechesis arrival stands on the exorcist-files series page in the rss form with its full set (50 rows — the reference state)', JSON.stringify({ series: ref.series, kind: ref.kind, level: ref.level, rows: ref.rows }));
    await page.evaluate(() => { setTab('prayers'); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { openBlockPage('Podcasts'); });
    await page.waitForTimeout(700);
    await page.click('[data-daypodseries="exorcist-files"]');
    const arrived2 = await waitFor(page, () => state.tab === 'podcasts' && state.podcasts && state.podcasts.series === 'exorcist-files' && podLevel === 'series');
    await page.waitForTimeout(500);
    const gotState = await page.evaluate(() => ({ tab: state.tab, series: state.podcasts && state.podcasts.series, kind: state.podcasts && state.podcasts.kind, level: podLevel, rows: document.querySelectorAll('#view [data-podrow]').length }));
    const got = { ...gotState, html: await pageHtmlNormalized(page) };
    ok(arrived2 && got.tab === ref.tab && got.series === ref.series && got.kind === 'rss' && got.level === ref.level && got.rows === 50 && got.html === ref.html,
      'C10c: a tap on the day\'s exorcist-files series entry goes through to the podcast itself — the same state and painted rss page the Catechesis open produces, the full set standing (the two named transients normalized)',
      'tab ' + got.tab + ' series ' + got.series + ' kind ' + got.kind + ' level ' + got.level + ' rows ' + got.rows + ' html ' + diffHint(got.html, ref.html));
    await s.browser.close(); s.server.close();
  }
  /* C11–C12: the layer postures stand as v515 left them */
  {
    const offStore = freshStore();
    offStore.profiles.find((p) => p.key === 'salesian').layers.podcasts = { on: false, series: [] };
    const a = await buildPage(APP_JS, { store: offStore });
    const rowsOff = await homeRows(a.page);
    ok(JSON.stringify(rowsOff) === '["Morning","Midday","Evening","Night","Novenas"]',
      'C11: the Podcasts layer OFF — no Podcasts group stands on the home (v515 behavior unchanged)', JSON.stringify(rowsOff));
    await a.browser.close(); a.server.close();
    const emptyStore = freshStore();
    emptyStore.profiles.find((p) => p.key === 'salesian').layers.podcasts = { on: true, series: [] };
    const bb = await buildPage(APP_JS, { store: emptyStore });
    const rowsEmpty = await homeRows(bb.page);
    await bb.page.evaluate(() => { openBlockPage('Podcasts'); });
    await bb.page.waitForTimeout(600);
    const nSeries = await bb.page.evaluate(() => document.querySelectorAll('#view [data-daypodseries]').length);
    ok(JSON.stringify(rowsEmpty) === '["Morning","Midday","Evening","Night","Novenas","Podcasts"]' && nSeries === 0,
      'C12: the layer ON with no series picked — the shell stands as today and its page carries no series entries', JSON.stringify(rowsEmpty) + ' series=' + nSeries);
    await bb.browser.close(); bb.server.close();
  }
  /* C13: a core block page is byte-identical to the base ship's */
  {
    const a = await buildPage(APP_JS);
    const b = await buildPage(APP_JS_BASE, { baseShell: true });
    await a.page.evaluate(() => { openBlockPage('Morning'); });
    await b.page.evaluate(() => { openBlockPage('Morning'); });
    await a.page.waitForTimeout(500); await b.page.waitForTimeout(500);
    const ha = await a.page.evaluate(() => document.querySelector('#view').innerHTML);
    const hb = await b.page.evaluate(() => document.querySelector('#view').innerHTML);
    ok(ha === hb, 'C13: a core block page (Morning) paints byte-identical to the base ship\'s', 'len ' + ha.length + ' vs ' + hb.length);
    await a.browser.close(); a.server.close(); await b.browser.close(); b.server.close();
  }
  /* C14: the v517 editor still opens from the expanded card */
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
      'C14: the v517 profile editor still opens from the expanded card (copy mode on the standing default)', ed.slice(0, 120));
    await s.browser.close(); s.server.close();
  }
}

console.log('\nharness-v522: ' + pass + ' ok, ' + fail + ' not-ok' + (failures.length ? ' — ' + failures.join(' · ') : ''));
process.exit(PROBE ? 0 : (fail ? 1 : 0));
