// harness-v516.mjs — v516 evidence: the Catechesis Novenas
// side (the v514 prayer-profiles package, §P6 + §P8; John's
// decision 6). The Catechesis toggle gains a third side —
// Courses · Podcasts · Novenas — listing the presented day's
// active novenas (name · Day n · the day's drawn intention ·
// the played mark) from the day's own resolution
// (state.ownSlots['novenas'] + the payload's introTexts
// draws), independent of the profiles and the Novenas layer
// switch; played marks shared (episode-keyed); the named
// empty state on a novena-less day. Client-only, no
// migration. John approved the chain to Ship (Ora thread,
// 2026-11-17 18:57 CT).
//   S statics: the sides table · the paint branch + the new
//     functions + the settle hooks · the menu derivation ·
//     the server/Mass sources byte-identical to the base
//     ship · ui.ts identical outside the pin · the fixtures
//     stand
//   C client (the v515 Chromium mold, stubbed fetch):
//     C1 the toggle carries exactly three sides in order; a
//       stored 'video' lands on Courses
//     C2 the side lists every active novena with day +
//       intention matching the day payload (feed order)
//     C3 the list stands identical with the Novenas layer
//       off, and under The Little Way and The Benedictine Way
//     C4 marks shared: a mark seeded through the day store
//       reads on the Catechesis row; a tap on the Catechesis
//       dot writes the store the Praylist reads; a row tap
//       plays the episode
//     C5 an episode with no draw paints NO intention line
//     C6 the novena-less day paints the named empty state
//     C7 the Courses and Podcasts paints byte-identical to
//       the base ship's
//     C8 a Catechesis-first open (no day build yet): the
//       empty state stands, the kick resolves, the list
//       replaces it
// Fixtures (Improvement D), under tests/fixtures-v516/,
// drawn from production on 2026-11-17:
//   (a) day-live-2026-11-17.json — the presented day's
//     payload via the prayer door (GET /api/agent/player/
//     day?date=2026-11-17): introTexts with the ten
//     per-episode novena draws; the profile fold salesian
//     with the Novenas layer ON; settings v8.
//   (b) ownfeed-2026-11-17.xml — the own feed's fifteen
//     items for 2026-11-17 (the ten novenas + the day's five
//     fixed-family items), drawn live from https://
//     orapronobis.media/podcast.xml, items whole.
//   (c) settings-live-2026-11-17.json — the live source
//     settings via the door (GET /api/agent/player/
//     settings): v8, 26 rows, the novenas own row enabled.
//   (d) podindex-live-2026-11-17.json — the live series
//     index (drawn live 2026-11-17 for the v515 harness;
//     the index does not change with this release).
//   Variants derived in-harness from (a)/(b) and named as
//   derivations where they are used: the layer-off fold ·
//   The Little Way fold · The Benedictine Way fold · the
//   intention-less day (one introTexts key removed) · the
//   novena-less day (the feed items re-dated to 2026-11-16
//   + the novena draws removed).
// The base for byte comparisons is the v515 ship worktree
// (H516_BASE overrides).
// Run: node app/tests/harness-v516.mjs [--probe] (from the
// worktree root). --probe only prints.
import { readFileSync } from 'node:fs';
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
const BASE = process.env.H516_BASE || path.resolve(ROOT, '../../.worktrees/v515-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v516';
const DAY_LIVE = JSON.parse(readFileSync(FX + '/day-live-2026-11-17.json', 'utf8'));
const SETTINGS_LIVE = JSON.parse(readFileSync(FX + '/settings-live-2026-11-17.json', 'utf8'));
const PODINDEX = JSON.parse(readFileSync(FX + '/podindex-live-2026-11-17.json', 'utf8'));
const FEED_XML = readFileSync(FX + '/ownfeed-2026-11-17.xml', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const DAY = '2026-11-17';
const HONOR = "named in honor of the tradition, not the order's own routine";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* The expected novena list, derived from the fixtures
   themselves: the feed's novena items for the day, in feed
   order — name (title minus the date suffix and the Day
   tail) · Day n · the payload's per-episode draw. */
const EXPECTED = [];
{
  const items = FEED_XML.match(/<item[\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    const url = (it.match(/<enclosure[^>]*url="([^"]+)"/) || [])[1] || '';
    const stem = url.split('/').pop().replace(/\.mp3$/, '');
    if (!stem.startsWith(DAY + '-')) continue;
    const dayAt = stem.lastIndexOf('-day-');
    if (dayAt <= 0) continue;
    const slug = stem.slice(DAY.length + 1, dayAt);
    let title = (it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    title = title.replace(/ - [A-Z][a-z]+ \d{1,2}, \d{4}$/, '');
    const dm = /\s+Day\s+(\d{1,2})\s*$/.exec(title);
    const episodeId = 'novena-' + slug;
    EXPECTED.push({ episodeId, name: dm ? title.slice(0, dm.index) : title, day: dm ? Number(dm[1]) : null, intention: DAY_LIVE.introTexts[episodeId] || null });
  }
}

/* ---------------- S: statics ---------------- */
{
  ok(C_SRC.includes("sides: [['courses', 'Courses'], ['podcasts', 'Podcasts'], ['novenas', 'Novenas']]"),
    'S1: tabSideCfg carries exactly the three sides in order (courses · podcasts · novenas)');
  ok(C_SRC.includes("if (tabSideNow.podcasts === 'novenas') { paintCatechesisNovenas(); return; }")
    && C_SRC.includes('function paintCatechesisNovenas()') && C_SRC.includes('function catechesisNovenasResolve()')
    && C_SRC.includes('function catechesisNovenasSettled()') && C_SRC.includes('function wireCatechesisNovenas()'),
    'S2: the paint branch and the side\'s functions stand (paint · wire · settle hook · the paint-free kick)');
  ok(C_SRC.includes("if (row.sourceKey === 'novenas') catechesisNovenasSettled(); // v516: the Catechesis Novenas side repaints on the settle"),
    'S3: both settle paths (present + missing) carry the Novenas hook', 'count=' + (C_SRC.split('catechesisNovenasSettled(); // v516').length - 1));
  ok(C_SRC.includes("tabSideCfg('podcasts').sides.forEach(function (sd) {")
    && !C_SRC.includes("[['courses', 'Courses'], ['podcasts', 'Podcasts']].forEach"),
    'S4: the Go-to menu\'s other-sides list derives from the sides table (the hard-coded pair is gone)');
  ok(I_SRC === I_BASE, 'S5: index.ts stands byte-identical to the base ship (no server change)');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S6-' + f + ': the Mass source stands byte-identical to the base ship');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pin(U_SRC) === pin(U_BASE), 'S7: ui.ts is byte-identical to the base ship outside the pin line');
  ok(EXPECTED.length === 10 && EXPECTED.every((e) => e.day >= 1 && e.day <= 9 && typeof e.intention === 'string' && e.intention.length > 0),
    'S8: the fixtures stand — ten active novenas in the feed for ' + DAY + ', each with a Day n and a per-episode draw in the payload',
    EXPECTED.map((e) => e.episodeId + ':' + e.day).join(' '));
  const novRow = (SETTINGS_LIVE.sources || []).find((s) => s.sourceKey === 'novenas');
  ok(SETTINGS_LIVE.version === 8 && novRow && novRow.enabled !== false && novRow.block === 'Novenas' && DAY_LIVE.profile && DAY_LIVE.profile.key === 'salesian',
    'S9: the settings fixture stands (v8, the novenas own row enabled at block Novenas); the day fixture carries the salesian fold');
  ok(C_SRC.includes('No novenas are running today') && C_SRC.includes("BS_CH + 's+Day'"),
    'S10: the named empty state stands; the name strip uses the BS_CH construction (no literal-backslash regex in the new code)');
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

const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const SHELL_BASE = U_BASE.slice(U_BASE.indexOf('SHELL_HTML = `') + 14, U_BASE.indexOf('`;', U_BASE.indexOf('SHELL_HTML = `')));
const MASS_PAYLOAD = { ok: true, date: DAY, mass: { name: 'Memorial of Saint Elizabeth of Hungary', rank: 'memorial', season: 'Ordinary Time', color: 'white', readings: [{ label: 'Gospel', cite: 'Lk 19:1-10', text: 'Jesus came to Jericho.' }] } };
const OWN_FEED_URL = 'https://orapronobis.media/podcast.xml';

function foldOf(key, name, coreBlocks, novenasOn, version) {
  return { key, name, honorLine: HONOR, resolvedBy: 'standing', dayKind: 'weekday', coreBlocks: coreBlocks.slice(),
    layers: [{ key: 'novenas', on: novenasOn }, { key: 'podcasts', on: false, series: [] }], version };
}
function dayVariant(foldKey) {
  const day = JSON.parse(JSON.stringify(DAY_LIVE));
  const v = DAY_LIVE.profile ? DAY_LIVE.profile.version : 1;
  if (foldKey === 'layer-off') {
    day.profile = foldOf('salesian', 'The Salesian Way', ['Morning', 'Midday', 'Evening', 'Night'], false, v);
    day.blocks = day.blocks.filter((b) => b.block !== 'Novenas');
    day.blockOrder = day.blockOrder ? day.blockOrder.filter((b) => b !== 'Novenas') : day.blockOrder;
  } else if (foldKey === 'little-way') {
    day.profile = foldOf('little-way', 'The Little Way', ['Morning', 'Night'], false, v);
    day.blocks = day.blocks.filter((b) => ['Morning', 'Night'].includes(b.block));
  } else if (foldKey === 'benedictine') {
    day.profile = foldOf('benedictine', 'The Benedictine Way', ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'], true, v);
  } else if (foldKey === 'intention-less') {
    delete day.introTexts['novena-christ_the_king'];
  } else if (foldKey === 'novena-less') {
    Object.keys(day.introTexts).forEach((k) => { if (k.startsWith('novena-')) delete day.introTexts[k]; });
  }
  return day;
}
const FEED_EMPTY = FEED_XML.split('2026-11-17').join('2026-11-16').split('17 Nov 2026').join('16 Nov 2026');

async function buildPage(appJs, opts) {
  opts = opts || {};
  const require2 = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
  const { chromium } = require2('playwright-core');
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' });
  const ctx = await browser.newContext();
  const seeds = {};
  if (opts.seedPlayed) seeds['opn-played-v344'] = JSON.stringify(opts.seedPlayed);
  if (opts.seedSide) seeds['opn-tabside-podcasts-v464'] = opts.seedSide;
  if (opts.seedLastTab) seeds['opn-lasttab-v492'] = opts.seedLastTab;
  if (Object.keys(seeds).length) {
    await ctx.addInitScript((s) => { try { Object.keys(s).forEach((k) => localStorage.setItem(k, s[k])); } catch (e) {} }, seeds);
  }
  const page = await ctx.newPage();
  const dayAnswer = opts.dayAnswer || DAY_LIVE;
  const feedText = opts.feedText != null ? opts.feedText : FEED_XML;
  const feedDelay = opts.feedDelayMs || 0;
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.addInitScript(({ dayJson, settingsJson, podindexJson, bookJson, massJson, feedText, feedDelay, ownFeedUrl }) => {
    window.fetch = function (url, options) {
      const u = String(url);
      const ans = (body, status) => Promise.resolve({ ok: (status || 200) < 400, status: status || 200, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)), blob: () => Promise.resolve(new Blob(['x'])), headers: { get: () => null } });
      try {
        if (u === ownFeedUrl) {
          const t = feedText;
          if (feedDelay) return new Promise((res) => setTimeout(() => res({ ok: true, status: 200, text: () => Promise.resolve(t), json: () => Promise.reject(new Error('xml')), headers: { get: () => null } }), feedDelay));
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(t), json: () => Promise.reject(new Error('xml')), headers: { get: () => null } });
        }
        if (u.indexOf('/api/player/day') >= 0) return ans(JSON.parse(dayJson));
        if (u.indexOf('/api/player/source-settings') >= 0) return ans(JSON.parse(settingsJson));
        if (u.indexOf('/api/player/podcasts') >= 0) return ans(JSON.parse(podindexJson));
        if (u.indexOf('/api/prayer/book/favorites') >= 0) return ans({ ok: true, favorites: [] });
        if (u.indexOf('/api/prayer/book') >= 0) return ans(JSON.parse(bookJson));
        if (u.indexOf('/api/prayer/mass-personal-prayer') >= 0) return ans({ ok: true, before: null, after: null, afterMass: [], preMass: [] });
        if (u.indexOf('/api/prayer/profiles') >= 0) return ans({ ok: true, profiles: [], state: { standingKey: 'salesian', dayRule: true, version: 1 }, effective: null });
        if (u.indexOf('/api/mass') >= 0) return ans(JSON.parse(massJson));
        return ans({ ok: true });
      } catch (e) { return ans({ ok: false, error: String(e) }, 500); }
    };
    window.__extFetchText = function () { return Promise.reject(new Error('offline')); };
    URL.createObjectURL = function () { return 'blob:fake'; };
    URL.revokeObjectURL = function () {};
    HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function () { el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.load = function () {};
  }, { dayJson: JSON.stringify(dayAnswer), settingsJson: JSON.stringify(SETTINGS_LIVE), podindexJson: JSON.stringify(PODINDEX), bookJson: JSON.stringify(BOOK), massJson: JSON.stringify(MASS_PAYLOAD), feedText, feedDelay, ownFeedUrl: OWN_FEED_URL });
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>harness-v516</title></head><body data-lit="">\n<audio id="audio"></audio>\n' + (opts.baseShell ? SHELL_BASE : SHELL) + '\n<script>' + appJs + '</' + 'script></body></html>';
  const server = http.createServer((req, res) => {
    if ((req.url || '/').split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForTimeout(opts.bootWaitMs || 2200);
  return { page, browser, server, errs };
}
async function buildDayAndOpenNovenas(appJs, opts) {
  const s = await buildPage(appJs, opts);
  await s.page.evaluate(() => { setTab('prayers'); });
  await s.page.waitForFunction(() => state.ownSlots && state.ownSlots['novenas'] && state.ownSlots['novenas'].state !== 'loading', null, { timeout: 20000 }).catch(() => {});
  await s.page.evaluate(() => { setTab('podcasts'); switchPodSide('novenas'); });
  await s.page.waitForFunction(() => document.querySelectorAll('#view [data-novplay]').length > 0 || document.querySelector('#view').textContent.indexOf('No novenas are running today') >= 0, null, { timeout: 20000 }).catch(() => {});
  await s.page.waitForTimeout(400);
  return s;
}
const novenaRows = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#view [data-novplay]')).map((card) => {
  const metas = Array.from(card.querySelectorAll('.meta')).map((m) => m.textContent);
  const dot = card.querySelector('[data-markplayed]');
  return { id: card.getAttribute('data-novplay'), name: (card.querySelector('h3') || {}).textContent || '', heard: ((card.querySelector('h3') || {}).className || '').indexOf('heard') >= 0,
    metas, dot: !!dot, dotOn: !!dot && dot.className.indexOf(' on') >= 0 };
}));
const rowsMatch = (rows, expected) => rows.length === expected.length && rows.every((r, i) =>
  r.id === expected[i].episodeId && r.name === expected[i].name && r.metas.length === 2
  && r.metas[0] === 'Day ' + expected[i].day && r.metas[1] === expected[i].intention && r.dot);

if (!PROBE) {
  /* C1: the toggle — exactly three sides in order; a stored
     'video' lands on Courses */
  {
    const s = await buildPage(APP_JS);
    await s.page.evaluate(() => { setTab('podcasts'); });
    await s.page.waitForTimeout(900);
    const btns = await s.page.evaluate(() => Array.from(document.querySelectorAll('#sidetoggle button')).map((b) => b.getAttribute('data-side') + ':' + b.textContent + (b.className.indexOf('active') >= 0 ? '*' : '')));
    ok(JSON.stringify(btns) === '["courses:Courses*","podcasts:Podcasts","novenas:Novenas"]',
      'C1a: the Catechesis toggle carries exactly three sides in order (Courses · Podcasts · Novenas), Courses active by default', JSON.stringify(btns));
    await s.browser.close(); s.server.close();
    const v = await buildPage(APP_JS, { seedSide: 'video' });
    await v.page.evaluate(() => { setTab('podcasts'); });
    await v.page.waitForTimeout(900);
    const landed = await v.page.evaluate(() => tabSideNow.podcasts);
    const active = await v.page.evaluate(() => { const b = document.querySelector('#sidetoggle button.active'); return b ? b.getAttribute('data-side') : 'none'; });
    ok(landed === 'courses' && active === 'courses',
      'C1b: a stored side of \'video\' is unknown and lands on the default, Courses (no storage migration)', landed + '/' + active);
    await v.browser.close(); v.server.close();
  }
  /* C2: the list — every active novena, day + intention,
     feed order, matching the day payload */
  {
    const s = await buildDayAndOpenNovenas(APP_JS);
    const rows = await novenaRows(s.page);
    ok(rowsMatch(rows, EXPECTED),
      'C2: the Novenas side lists all ten active novenas in feed order — name (title minus Day tail) · Day n · the payload\'s per-episode draw · the played dot on every row',
      JSON.stringify(rows).slice(0, 300));
    ok(s.errs.length === 0, 'C2b: the side paints clean (no page errors)', s.errs.join(' ; '));
    await s.browser.close(); s.server.close();
  }
  /* C3: independence — layer off · The Little Way · The
     Benedictine Way: the identical list */
  {
    for (const variant of ['layer-off', 'little-way', 'benedictine']) {
      const s = await buildDayAndOpenNovenas(APP_JS, { dayAnswer: dayVariant(variant) });
      const rows = await novenaRows(s.page);
      ok(rowsMatch(rows, EXPECTED),
        'C3-' + variant + ': the list stands identical under the ' + variant + ' fold (the side reads the resolution, never the fold)',
        'rows=' + rows.length);
      await s.browser.close(); s.server.close();
    }
  }
  /* C4: marks shared + the row tap plays */
  {
    const target = EXPECTED[4]; // dedication_of_the_basilicas — Day 9
    const seed = {}; seed[target.episodeId] = {}; seed[target.episodeId][DAY] = { source: 'manual', block: 'Novenas' };
    const s = await buildDayAndOpenNovenas(APP_JS, { seedPlayed: seed });
    let rows = await novenaRows(s.page);
    const seeded = rows.find((r) => r.id === target.episodeId);
    ok(seeded && seeded.dotOn && seeded.heard && rows.filter((r) => r.dotOn).length === 1,
      'C4a: a played mark written through the day store (the Praylist\'s write) reads played on the Catechesis row — dot on, title heard; no other row marked',
      JSON.stringify(seeded));
    const other = EXPECTED[1]; // st_cecilia
    await s.page.click('[data-novplay="' + other.episodeId + '"] [data-markplayed]');
    await s.page.waitForTimeout(500);
    const store = await s.page.evaluate((id) => {
      const played = JSON.parse(localStorage.getItem('opn-played-v344') || '{}');
      return { entry: (played[id] || {})['2026-11-17'] || null, viaFn: isPlayed(id, '2026-11-17') };
    }, other.episodeId);
    rows = await novenaRows(s.page);
    const marked = rows.find((r) => r.id === other.episodeId);
    ok(store.entry && store.entry.playedAt && store.viaFn === true && marked && marked.dotOn,
      'C4b: a tap on the Catechesis row\'s dot writes the same episode-keyed store the Praylist reads (the entry stands with its playedAt; isPlayed true; the dot repaints on)',
      JSON.stringify(store));
    const playTarget = EXPECTED[2]; // st_catherine_of_alexandria
    await s.page.click('[data-novplay="' + playTarget.episodeId + '"]');
    await s.page.waitForTimeout(900);
    const cur = await s.page.evaluate(() => state.current ? state.current.episodeId : 'none');
    ok(cur === playTarget.episodeId,
      'C4c: a row tap plays the episode by the standing play path (the shell\'s current is the tapped novena)', cur);
    await s.browser.close(); s.server.close();
  }
  /* C5: an episode with no draw paints NO intention line */
  {
    const s = await buildDayAndOpenNovenas(APP_JS, { dayAnswer: dayVariant('intention-less') });
    const rows = await novenaRows(s.page);
    const ck = rows.find((r) => r.id === 'novena-christ_the_king');
    ok(rows.length === 10 && ck && ck.metas.length === 1 && ck.metas[0] === 'Day 5'
      && rows.filter((r) => r.metas.length === 2).length === 9,
      'C5: the intention-less variant — Christ the King paints its Day line and NO intention line (the v427 rule); the other nine stand unchanged',
      JSON.stringify(ck));
    await s.browser.close(); s.server.close();
  }
  /* C6: the novena-less day — the named empty state */
  {
    const s = await buildDayAndOpenNovenas(APP_JS, { dayAnswer: dayVariant('novena-less'), feedText: FEED_EMPTY });
    const view = await s.page.evaluate(() => document.querySelector('#view').textContent);
    const rowCount = await s.page.evaluate(() => document.querySelectorAll('#view [data-novplay]').length);
    ok(rowCount === 0 && view.indexOf('No novenas are running today') >= 0 && s.errs.length === 0,
      'C6: the novena-less day paints the named empty state and nothing else — no rows, no error', view.trim().slice(0, 80));
    await s.browser.close(); s.server.close();
  }
  /* C7: the standing sides byte-identical to the base */
  {
    const a = await buildPage(APP_JS);
    const b = await buildPage(APP_JS_BASE, { baseShell: true });
    // The series art <img> loads from a remote host and its
    // onerror removal races the capture — the one
    // non-deterministic element in these paints; it is
    // normalized out of both sides before the compare.
    const norm = (h) => h.replace(/<img class="rowart" src="https?:[^>]*>/g, '');
    for (const s of [a, b]) { await s.page.evaluate(() => { setTab('podcasts'); }); await s.page.waitForTimeout(1100); }
    const ca = await a.page.evaluate(() => document.querySelector('#view').innerHTML);
    const cb = await b.page.evaluate(() => document.querySelector('#view').innerHTML);
    ok(norm(ca) === norm(cb), 'C7a: the Courses paint stands byte-identical to the base ship\'s (remote art imgs normalized — their load error races the capture)', 'len ' + ca.length + ' vs ' + cb.length);
    for (const s of [a, b]) { await s.page.evaluate(() => { switchPodSide('podcasts'); }); await s.page.waitForTimeout(700); }
    const pa = await a.page.evaluate(() => document.querySelector('#view').innerHTML);
    const pb = await b.page.evaluate(() => document.querySelector('#view').innerHTML);
    ok(norm(pa) === norm(pb), 'C7b: the Podcasts paint stands byte-identical to the base ship\'s (remote art imgs normalized — their load error races the capture)', 'len ' + pa.length + ' vs ' + pb.length);
    await a.browser.close(); a.server.close(); await b.browser.close(); b.server.close();
  }
  /* C8: the Catechesis-first open — the kick resolves */
  {
    const s = await buildPage(APP_JS, { seedLastTab: 'podcasts', seedSide: 'novenas', feedDelayMs: 1600, bootWaitMs: 1400 });
    const early = await s.page.evaluate(() => document.querySelector('#view').textContent);
    ok(early.indexOf('No novenas are running today') >= 0,
      'C8a: on a Catechesis-first open (no day build has run) the side paints the named empty state while the resolution settles', early.trim().slice(0, 60));
    await s.page.waitForFunction(() => document.querySelectorAll('#view [data-novplay]').length === 10, null, { timeout: 20000 }).catch(() => {});
    const rows = await novenaRows(s.page);
    ok(rowsMatch(rows, EXPECTED),
      'C8b: the kick settles the day\'s resolution and the ten rows replace the empty state — the same list as the Pray-first path', 'rows=' + rows.length);
    ok(s.errs.length === 0, 'C8c: the Catechesis-first open runs clean (no page errors)', s.errs.join(' ; '));
    await s.browser.close(); s.server.close();
  }
}

console.log('\nharness-v516: ' + pass + ' ok, ' + fail + ' not-ok' + (failures.length ? ' — ' + failures.join(' · ') : ''));
process.exit(PROBE ? 0 : (fail ? 1 : 0));
