// harness-v530.mjs — v530 evidence: the v525 app leg.
// The corrected 2026-11-18 Daily Rosary reached Spotify
// and the feed but never the app. The trace names three
// stacked app-side breaks (release doc §1): (1) the
// feed matcher (ownFamilyOfStem) requires a fixed-family
// stem to END in -<date>, so the corrected episode's
// stem (daily-rosary-2026-11-18-corrected) can never
// place; (2) a family present in the device day record
// settles present from the record and is never
// re-checked against the feed, so the record written
// before the pull-down goes on serving the defective
// episode; (3) ownFetchAudio restores the audio cache
// cache-first by day key, so the defective MP3
// downloaded on the morning open would override even a
// corrected enclosure. The fix (doc §2): F1 the matcher
// accepts the -corrected edition stem · F2 cached
// families revalidate against the feed at every day
// build (a changed enclosure re-settles and rewrites
// the record; a family absent from a read day block
// settles missing; a failed read changes nothing) ·
// F3 a changed enclosure evicts the stale audio entry
// before the download kick. John's force-refresh
// button was weighed and not built (doc §2).
//   S statics: the three seams stand in the build
//     client and in none of the base · ui.ts and
//     index.ts byte-identical to base (client-only) ·
//     the feed fixture carries the corrected item
//     byte-as-published and no defective 2026-11-18
//     rosary item (it was pulled)
//   C1 fresh resolve (no day record): the corrected
//     episode places — present, the corrected
//     enclosure, the (Corrected) title — and the
//     written day record carries the corrected
//     enclosure
//   C2 the field case: a stale day record (defective
//     enclosure) + a stale audio blob revalidate on
//     open — slot, day record, and audio bytes all
//     land on the corrected episode, while an
//     unchanged family's cached audio stands
//     untouched (keyed eviction, never a blanket
//     purge)
//   C3 feed unreachable at open: the cached day
//     stands exactly as it stood — no missing flip,
//     no record rewrite, no audio change (the offline
//     posture)
//   C4 an ordinary uncorrected day (2026-11-17, the
//     standing v516 fixtures): the build's settle map
//     is identical to the base build's, family by
//     family
//   G439 (recorded as-is, NEVER a v530 pass): the
//     standing v439 boot gate on this tree.
// Fixtures (Improvement D), under tests/fixtures-v530/:
// day-live-2026-11-18.json — the production day
// payload read through the prayer door at Scope on
// 2026-11-18 (Salesian fold, profile v4) ·
// ownfeed-2026-11-18.xml — the production feed's own
// items for the 2026-11-18 block (plus three newer
// items and one closing 2026-11-17 item), extracted
// from the live podcast.xml at Scope, the corrected
// item byte-as-published. The 2026-11-17 legs reuse
// the standing fixtures-v516 set. The base for byte
// comparisons is the v527 ship tree (H530_BASE
// overrides).
// Run: node app/tests/harness-v530.mjs [--probe]
// (from the worktree root). --probe only prints.
import { readFileSync } from 'node:fs';
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
const BASE = process.env.H530_BASE || path.resolve(ROOT, '../../.worktrees/v527-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v530';
const FX16 = APP + '/tests/fixtures-v516';
const DAY18 = JSON.parse(readFileSync(FX + '/day-live-2026-11-18.json', 'utf8'));
const FEED18 = readFileSync(FX + '/ownfeed-2026-11-18.xml', 'utf8');
const DAY17 = JSON.parse(readFileSync(FX16 + '/day-live-2026-11-17.json', 'utf8'));
const FEED17 = readFileSync(FX16 + '/ownfeed-2026-11-17.xml', 'utf8');
const SETTINGS = JSON.parse(readFileSync(FX16 + '/settings-live-2026-11-17.json', 'utf8'));
const PODINDEX = JSON.parse(readFileSync(FX16 + '/podindex-live-2026-11-17.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('NOT-OK -', label, extra ? ':: ' + String(extra).slice(0, 220) : ''); }
}

const CORRECTED_URL = 'https://audio.orapronobis.media/daily-rosary-2026-11-18-corrected.mp3';
const DEFECTIVE_URL = 'https://audio.orapronobis.media/daily-rosary-2026-11-18.mp3';
const ROSARY_KEY = 'day/2026-11-18/daily-rosary';
const MORNING_KEY = 'day/2026-11-18/morning-prayer';
// The fixture's own 2026-11-18 Morning Prayer enclosure
// (read out of the production feed items, never typed —
// per item, so a newer day's same-stem item can never
// leak into the constant).
const item18 = (FEED18.match(/<item[\s\S]*?<\/item>/g) || []).find((it) => it.includes('morning-prayer-elevenlabs-2026-11-18.mp3'));
const MORNING_URL = item18 ? (item18.match(/enclosure url="([^"]+)"/) || [])[1] : null;

/* ---------------- S: statics ---------------- */
if (PROBE) {
  console.log('morning 2026-11-18 enclosure from fixture:', MORNING_URL);
  console.log('feed18 items:', (FEED18.match(/<item/g) || []).length, '| feed17 items:', (FEED17.match(/<item/g) || []).length);
  console.log('day18 profile:', DAY18.profile && DAY18.profile.key, DAY18.profile && DAY18.profile.version, '| settings version:', SETTINGS.version);
} else {
  ok(C_SRC.includes("tail + '-corrected'") && !C_BASE.includes("tail + '-corrected'"),
    'S1: F1 stands in the build matcher (the -corrected edition stem) and not in the base');
  ok(C_SRC.includes('function ownResolveFeed(day, needed, revalidate)') && !C_BASE.includes('revalidate'),
    'S2: F2 stands in the build (ownResolveFeed takes the revalidate set) and not in the base');
  ok(C_SRC.includes('c.delete(dlKey)') && !C_BASE.includes('c.delete(dlKey)'),
    'S3: F3 stands in the build (the changed-enclosure eviction seam) and not in the base');
  ok(U_SRC === U_BASE && I_SRC === I_BASE,
    'S4: ui.ts and index.ts are byte-identical to the base — the change is client-only');
  ok(FEED18.includes('daily-rosary-2026-11-18-corrected::c7e0f2c0') && FEED18.includes(CORRECTED_URL),
    'S5: the feed fixture carries the corrected item byte-as-published (GUID + enclosure)');
  const rosaryItems18 = (FEED18.match(/<item[\s\S]*?<\/item>/g) || []).filter((it) => it.includes('daily-rosary-2026-11-18'));
  ok(rosaryItems18.length === 1 && !FEED18.includes('"' + DEFECTIVE_URL + '"'),
    'S6: exactly one 2026-11-18 rosary item stands in the feed — the defective one was pulled', rosaryItems18.length);
}

/* ---------------- C: the client in Chromium ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED_BASE = null;
try { COOKED = cook(C_SRC); new Function(COOKED); ok(true, 'P0: the build cooked APP_JS parses whole'); }
catch (e) { ok(false, 'P0: the build cooked APP_JS parses whole', String(e).slice(0, 160)); }
try { COOKED_BASE = cook(C_BASE); new Function(COOKED_BASE); } catch (e) { /* base parse is the base's own affair */ }
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const OWN_FEED_URL = 'https://orapronobis.media/podcast.xml';

async function boot(opts) {
  const require2 = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
  const { chromium } = require2('playwright-core');
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.addInitScript(({ dayJson, settingsJson, podindexJson, bookJson, feedText, feedDown, ownFeedUrl }) => {
    window.fetch = function (url, options) {
      const u = String(url);
      const ans = (body, status) => Promise.resolve({ ok: (status || 200) < 400, status: status || 200, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)), blob: () => Promise.resolve(new Blob(['x'])), headers: { get: () => null } });
      try {
        if (u === ownFeedUrl) {
          if (feedDown) return Promise.reject(new Error('offline'));
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(feedText), json: () => Promise.reject(new Error('xml')), headers: { get: () => null } });
        }
        if (u.indexOf('/api/player/feed-audio') >= 0) {
          const target = decodeURIComponent(u.slice(u.indexOf('url=') + 4));
          return Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(new Blob(['FRESH<' + target + '>'])), json: () => Promise.reject(new Error('audio')), text: () => Promise.resolve(''), headers: { get: () => null } });
        }
        if (u.indexOf('/api/player/day') >= 0) return ans(JSON.parse(dayJson));
        if (u.indexOf('/api/player/source-settings') >= 0) return ans(JSON.parse(settingsJson));
        if (u.indexOf('/api/player/podcasts') >= 0) return ans(JSON.parse(podindexJson));
        if (u.indexOf('/api/prayer/book/favorites') >= 0) return ans({ ok: true, favorites: [] });
        if (u.indexOf('/api/prayer/book') >= 0) return ans(JSON.parse(bookJson));
        if (u.indexOf('/api/prayer/mass-personal-prayer') >= 0) return ans({ ok: true, before: null, after: null, afterMass: [], preMass: [] });
        if (u.indexOf('/api/prayer/profiles') >= 0) return ans({ ok: true, profiles: [], state: { standingKey: 'salesian', dayRule: true, version: 1 }, effective: null });
        if (u.indexOf('/api/mass') >= 0) return ans({ ok: true, mass: null });
        return ans({ ok: true });
      } catch (e) { return ans({ ok: false, error: String(e) }, 500); }
    };
    window.__extFetchText = function () { return Promise.reject(new Error('offline')); };
    URL.createObjectURL = function () { return 'blob:fake'; };
    URL.revokeObjectURL = function () {};
    HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function () { el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.load = function () {};
  }, { dayJson: JSON.stringify(opts.day), settingsJson: JSON.stringify(SETTINGS), podindexJson: JSON.stringify(PODINDEX), bookJson: JSON.stringify(BOOK), feedText: opts.feedText, feedDown: !!opts.feedDown, ownFeedUrl: OWN_FEED_URL });
  const appHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>harness-v530</title></head><body data-lit="">\n<audio id="audio"></audio>\n' + SHELL + '\n<script>' + (opts.base ? COOKED_BASE : COOKED) + '</' + 'script></body></html>';
  const seedHtml = opts.seed ? '<!DOCTYPE html><html><head><meta charset="utf-8"><title>seed</title></head><body><script>\n'
    + 'var SEED = ' + JSON.stringify(opts.seed) + ';\n'
    + 'try { localStorage.setItem("opn-ext-cache-v1", JSON.stringify(SEED.rec)); } catch (e) {}\n'
    + 'var puts = Object.keys(SEED.audio || {}).map(function (k) { return caches.open("opn-ext-audio-v1").then(function (c) { return c.put(k, new Response(SEED.audio[k], { headers: { "Content-Type": "audio/mpeg" } })); }); });\n'
    + 'Promise.all(puts).then(function () { document.title = "seeded"; });\n'
    + '</' + 'script></body></html>' : null;
  const server = http.createServer((req, res) => {
    const p = (req.url || '/').split('?')[0];
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(appHtml); return; }
    if (p === '/seed' && seedHtml) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(seedHtml); return; }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  if (opts.seed) {
    await page.goto(origin + '/seed');
    await page.waitForFunction(() => document.title === 'seeded', null, { timeout: 10000 }).catch(() => {});
  }
  await page.goto(origin + '/');
  await page.waitForTimeout(700);
  await page.evaluate(() => { try { setTab('prayers'); } catch (e) {} });
  return { page, browser, server, errs };
}
const slotOf = (page, key) => page.evaluate((k) => {
  const st = state.ownSlots && state.ownSlots[k];
  if (!st) return null;
  return { state: st.state, tracks: (st.tracks || []).map((t) => ({ episodeId: t.episodeId, title: t.title, enclosureUrl: t.enclosureUrl })) };
}, key);
const settleMap = (page) => page.evaluate(() => Object.keys(state.ownSlots || {}).sort().map((k) => {
  const st = state.ownSlots[k];
  return k + '=' + st.state + ':' + (st.tracks || []).map((t) => t.enclosureUrl).join(',');
}).join('\n'));
const recOwn = (page) => page.evaluate(() => {
  try { const r = JSON.parse(localStorage.getItem('opn-ext-cache-v1') || 'null'); return r && r.own ? r.own : null; } catch (e) { return null; }
});
const cacheText = (page, key) => page.evaluate(async (k) => {
  const c = await caches.open('opn-ext-audio-v1');
  const r = await c.match(k);
  return r ? await r.text() : null;
}, key);
const waitSlot = (page, key, pred, ms) => page.waitForFunction((k, p) => {
  const st = state.ownSlots && state.ownSlots[k];
  return !!st && st.state !== 'loading' && (!p || (st.tracks && st.tracks[0] && st.tracks[0].enclosureUrl === p));
}, [key, pred || null], { timeout: ms || 20000 }).catch(() => {});

function staleSeed() {
  return {
    rec: {
      date: '2026-11-18', settingsVersion: SETTINGS.version, savedAt: '2026-11-18T12:05:00.000Z', slots: {},
      profileKey: 'salesian', profileVersion: DAY18.profile.version,
      own: {
        'daily-rosary': { episodeId: 'daily-rosary', title: "Daily Rosary - Glorious Mysteries - Today's Gospel, Luke 19:11-28", enclosureUrl: DEFECTIVE_URL, durationSec: 1500, sizeBytes: 20000000, imageUrl: '/logo.png' },
        'morning-prayer': { episodeId: 'morning-prayer', title: 'Morning Prayer', enclosureUrl: MORNING_URL, durationSec: 900, sizeBytes: 10000000, imageUrl: '/logo.png' },
      },
    },
    audio: { [ROSARY_KEY]: 'STALE-DEFECTIVE-AUDIO', [MORNING_KEY]: 'CACHED-MORNING-AUDIO' },
  };
}

if (!PROBE && COOKED) {
  // ---- C1: fresh resolve places the corrected episode ----
  {
    const s = await boot({ day: DAY18, feedText: FEED18 });
    try {
      await waitSlot(s.page, 'daily-rosary', CORRECTED_URL);
      await sleep(1200);
      const rosary = await slotOf(s.page, 'daily-rosary');
      ok(rosary && rosary.state === 'present' && rosary.tracks[0] && rosary.tracks[0].enclosureUrl === CORRECTED_URL,
        'C1a: a fresh resolve places the corrected episode (present, the corrected enclosure)', JSON.stringify(rosary).slice(0, 180));
      ok(rosary && rosary.tracks[0] && rosary.tracks[0].title.includes('(Corrected)'),
        'C1b: the placed track is the corrected edition (its title carries the edition)', rosary && rosary.tracks[0] && rosary.tracks[0].title);
      const morning = await slotOf(s.page, 'morning-prayer');
      ok(morning && morning.state === 'present' && morning.tracks[0] && morning.tracks[0].enclosureUrl === MORNING_URL,
        'C1c: the day\'s other fixed families place as they stand (Morning Prayer from the same feed)');
      const novenas = await slotOf(s.page, 'novenas');
      ok(novenas && novenas.state === 'present' && novenas.tracks.length >= 8,
        'C1d: the novenas family places whole from the same block', novenas && novenas.tracks.length);
      const own = await recOwn(s.page);
      ok(own && own['daily-rosary'] && own['daily-rosary'].enclosureUrl === CORRECTED_URL,
        'C1e: the written day record carries the corrected enclosure');
    } finally { await s.browser.close(); s.server.close(); }
  }
  // ---- C2: the field case — stale record + stale audio revalidate ----
  {
    const s = await boot({ day: DAY18, feedText: FEED18, seed: staleSeed() });
    try {
      await waitSlot(s.page, 'daily-rosary', CORRECTED_URL);
      await sleep(1500);
      const rosary = await slotOf(s.page, 'daily-rosary');
      ok(rosary && rosary.state === 'present' && rosary.tracks[0] && rosary.tracks[0].enclosureUrl === CORRECTED_URL,
        'C2a: the stale-seeded rosary revalidates to the corrected episode on open', JSON.stringify(rosary).slice(0, 180));
      const own = await recOwn(s.page);
      ok(own && own['daily-rosary'] && own['daily-rosary'].enclosureUrl === CORRECTED_URL,
        'C2b: the day record is rewritten — the defective enclosure no longer stands in it');
      const rosaryAudio = await cacheText(s.page, ROSARY_KEY);
      ok(rosaryAudio === 'FRESH<' + CORRECTED_URL + '>',
        'C2c: the stale audio is evicted and the corrected bytes land under the rosary key', String(rosaryAudio).slice(0, 90));
      const morningAudio = await cacheText(s.page, MORNING_KEY);
      ok(morningAudio === 'CACHED-MORNING-AUDIO',
        'C2d: an unchanged family\'s cached audio stands untouched (keyed eviction, never a blanket purge)', String(morningAudio).slice(0, 60));
      const morning = await slotOf(s.page, 'morning-prayer');
      ok(morning && morning.state === 'present' && morning.tracks[0] && morning.tracks[0].enclosureUrl === MORNING_URL,
        'C2e: the unchanged family confirms in silence (same enclosure, no re-settle churn)');
    } finally { await s.browser.close(); s.server.close(); }
  }
  // ---- C3: feed unreachable — the cached day stands ----
  {
    const s = await boot({ day: DAY18, feedText: FEED18, feedDown: true, seed: staleSeed() });
    try {
      await sleep(4500);
      const rosary = await slotOf(s.page, 'daily-rosary');
      ok(rosary && rosary.state === 'present' && rosary.tracks[0] && rosary.tracks[0].enclosureUrl === DEFECTIVE_URL,
        'C3a: with the feed down the cached rosary stands as it stood (no missing flip, no half-fix)', JSON.stringify(rosary).slice(0, 160));
      const own = await recOwn(s.page);
      ok(own && own['daily-rosary'] && own['daily-rosary'].enclosureUrl === DEFECTIVE_URL,
        'C3b: the day record is not rewritten by a failed read');
      const rosaryAudio = await cacheText(s.page, ROSARY_KEY);
      ok(rosaryAudio === 'STALE-DEFECTIVE-AUDIO',
        'C3c: the audio cache is untouched by a failed read');
    } finally { await s.browser.close(); s.server.close(); }
  }
  // ---- C4: an ordinary day — build settles identical to base ----
  {
    const a = await boot({ day: DAY17, feedText: FEED17 });
    let mapBuild = null;
    try {
      await waitSlot(a.page, 'daily-rosary', null);
      await sleep(1200);
      mapBuild = await settleMap(a.page);
    } finally { await a.browser.close(); a.server.close(); }
    const b = await boot({ day: DAY17, feedText: FEED17, base: true });
    let mapBase = null;
    try {
      await waitSlot(b.page, 'daily-rosary', null);
      await sleep(1200);
      mapBase = await settleMap(b.page);
    } finally { await b.browser.close(); b.server.close(); }
    ok(!!mapBuild && mapBuild === mapBase && mapBuild.includes('daily-rosary=present'),
      'C4: on an ordinary uncorrected day the build\'s settle map is identical to the base build\'s',
      'build:\n' + String(mapBuild).slice(0, 200) + '\nbase:\n' + String(mapBase).slice(0, 200));
  }
}

/* ---------------- G439: the standing gate, as-is ---------------- */
if (!PROBE) {
  let out = '';
  try { out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const m = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!m && m[1] === '13' && m[2] === '2',
    'G439 (recorded as-is, not a v530 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    m ? m[0] : out.slice(-200));
}

console.log('harness-v530: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) console.log('failures: ' + failures.join(' · '));
process.exit(fail ? 1 : 0);
