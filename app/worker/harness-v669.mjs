// harness-v669.mjs — v669: dark mode. The Dark pick paints
// the whole interior dark with light text and the
// liturgical accents standing; Follow the phone follows
// the system; Light is byte-identical to the shipped
// build.
//
// Chromium (playwright-core) harness, modeled on
// harness-v668.mjs: the REAL built Worker bundle (esbuild
// from source) served locally, the API stubbed with
// production-shaped fixtures, surfaces painted through the
// client's own paint functions, computed styles measured.
//
// Fixtures (Improvement D — production sources, named):
//  - app/worker/fixtures/queue-2026-11-25-v664.json — the
//    queue is the real 2026-11-25 composed day in
//    extRebuildDescs output shape (the harness-v664
//    fixture); it stands as the day's descriptors + queue.
//  - the day payload stands in harness-v666-shoot's shape
//    (blocks of pt() tracks over the same composed day),
//    carrying liturgicalDay { name, color: 'green' } in the
//    production shape (index.ts liturgicalDayFor: the
//    day_name/color row verbatim) — a green ferial day, so
//    data-lit="green" lands by the payload's own discipline
//    through applyLiturgical, the production seam. The red
//    day is applied through the same seam (applyLiturgical
//    with a red liturgicalDay record), never a synthetic
//    palette page.
//  - app/tests/fixtures-v603 (book · podcasts index) +
//    production-heads.json payloads, as harness-v668.
//  - the source-settings stub row stands in the server's
//    own response shape (index.ts source-settings: the
//    mapped row fields verbatim).
//
// Legs (Plan §4): F fixture + bundle stands · S the
// DISPLAY control (first section · three picks · tap
// writes + applies + repaints in place) · A dark paint
// measured on the §2.4 checklist · B light byte-identical
// (the same probe set on the base tree 21fa13b, served
// from the pristine checkout named by V671_BASE_WT,
// default /tmp/v671-base) · C accents under green + red ·
// D follow the phone (Chromium color-scheme emulation) ·
// E persistence (reload · day change) · P screenshots
// (light/dark pairs → docs/releases/v671-screenshots/) ·
// G regressions (harness-v668/-v667/-v666 run green on
// this tree, as child processes).
//
// Run: node app/worker/harness-v669.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const APP = path.join(WT, 'app');
const BASE_WT = process.env.V671_BASE_WT || '/tmp/v671-base';
const SHOTS = path.join(WT, 'docs/releases/v671-screenshots');
mkdirSync(SHOTS, { recursive: true });
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}
// WCAG luminance / contrast over computed rgb() strings or #hex.
function parseColor(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = s.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); if (p.length === 4 && p[3] === 0) return null; return p.slice(0, 3); }
  return null;
}
function lum(rgb) {
  const f = (c) => { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrast(a, b) {
  const ca = parseColor(a), cb = parseColor(b);
  if (!ca || !cb) return 0;
  const la = lum(ca), lb = lum(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const lumOf = (s) => { const c = parseColor(s); return c ? lum(c) : 1; };

// ---------- fixtures ----------
const QUEUE = JSON.parse(readFileSync(path.join(W, 'fixtures/queue-2026-11-25-v664.json'), 'utf8')).queue;
const HEADS = JSON.parse(readFileSync(path.join(W, 'v666-fixtures/production-heads.json'), 'utf8'));
const INDEX = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/podcasts-index.json'), 'utf8'));
if (!INDEX.seriesList.some((s) => s.series === 'saint-of-the-day')) INDEX.seriesList.push({ series: 'saint-of-the-day', kind: 'rss', category: 'podcasts', title: 'The Saint of The Day Podcast', available: true, total: 299 });
if (!INDEX.seriesList.some((s) => s.series === 'catholicsaints')) INDEX.seriesList.push({ series: 'catholicsaints', kind: 'video', category: 'podcasts', title: 'Catholic Saints & Feasts', available: true, total: 15 });
const BOOK = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/book.json'), 'utf8'));
const NOVENAS = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v614/novenas-catalog.json'), 'utf8'));
const BIBLE = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/bible-folded.json'), 'utf8'));
const CTV = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v656/catholictv.json'), 'utf8'));
const audioPayload = (series, title, entries) => ({ ok: true, kind: 'rss', series, title, available: true, showImageUrl: null, entries: entries.map((e) => ({ key: e.key, title: e.title, publishedMs: e.publishedMs, url: e.url, durationS: 600, listened: !!e.listened, positionS: 0 })) });
const PAYLOADS = {
  'saint-of-the-day': audioPayload('saint-of-the-day', 'The Saint of The Day Podcast', HEADS.saint),
  'daily-gospel-exegesis': audioPayload('daily-gospel-exegesis', 'Daily Gospel Exegesis', HEADS.exegesis),
  'daily-readings': audioPayload('daily-readings', 'USCCB Daily Readings Podcast', HEADS.readings),
  'bible-in-a-year': BIBLE,
  'catholicsaints': { ok: true, kind: 'video', series: 'catholicsaints', title: 'Catholic Saints & Feasts', available: true, marks: true, videos: HEADS.catholicsaints.map((v) => ({ id: v.id, title: v.title, publishedMs: v.publishedMs, url: 'https://www.youtube.com/watch?v=' + v.id, imageUrl: null, descText: null, dateLabel: '', listened: false })) },
  'catholictv': CTV,
  'novenas': NOVENAS,
};
const SETTINGS = { ok: true, version: 1, sources: [{ sourceKey: 'daily-rosary', name: 'Daily Rosary', family: 'own', block: 'Morning', dayRule: 'daily', sortOrder: 4, enabled: 1, slotId: null, role: 'primary' }] };
const DATE = '2026-11-25';
check('F fixture: the 2026-11-25 composed day stands (6 queue descriptors, office pair under Both, readings + rosary)',
  QUEUE.length === 6 && QUEUE[1]._side650 === 'do' && QUEUE[2].podSeries === 'daily-readings' && QUEUE.some((d) => d.episodeId === 'daily-rosary'), QUEUE.map((d) => d.episodeId));

// ---------- build + serve one tree ----------
async function buildServe(wt) {
  const tmp = execFileSync('mktemp', ['-d', tmpdir() + '/v669harness-XXXXXX'], { encoding: 'utf8' }).trim();
  execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
    [path.join(wt, 'app/worker/src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + tmp + '/index.cjs'], { stdio: 'pipe' });
  const _mod = await import(tmp + '/index.cjs');
  const WORKER = _mod.default?.default || _mod.default;
  const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
  const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
  const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
  const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
  const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
    if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, server, APPJS, SWJS };
}
const main = await buildServe(WT);
check('F the served service worker carries the v670 pin', main.SWJS.includes('ora-pro-nobis-v670-1'), 'pin not in served /sw.js');
check('F the served bundle carries the mode store + attribute', main.APPJS.includes('opn-mode-v669') && main.APPJS.includes('data-mode') && main.APPJS.includes('prefers-color-scheme'), 'mode machinery missing from /app.js');
let base = null;
try { base = await buildServe(BASE_WT); } catch (e) { check('B base tree builds from the pristine checkout at ' + BASE_WT, false, String(e).slice(0, 200)); }
check('B base tree stands at ' + BASE_WT + ' (21fa13b) for the byte-identical leg', !!base && base.SWJS.includes('ora-pro-nobis-v669-1'), base && 'base pin differs');

const b = await chromium.launch({ executablePath: EXE });
async function makePage(port, scheme) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme || 'light' });
  const pg = await ctx.newPage();
  await pg.addInitScript(({ INDEX, PAYLOADS, BOOK, SETTINGS, DATE }) => {
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
    const GREENDAY = { ok: true, date: DATE, presentedDay: DATE, dateLabel: 'Tuesday, November 25, 2026', liturgicalDay: { name: 'Weekday of Ordinary Time', color: 'green' }, blocks: [], dayPositions: {} };
    window.fetch = (url) => {
      const u = String(url);
      if (u.includes('/api/prayer/book')) return resp(BOOK);
      if (u.includes('/api/player/source-settings')) return resp(SETTINGS);
      if (u.includes('/api/prayer/day') || u.includes('/api/player/day')) return resp(GREENDAY);
      const m = u.match(/\/api\/player\/podcasts\?series=([^&]+)/);
      if (m) { const sk = decodeURIComponent(m[1]); if (PAYLOADS[sk]) return resp(PAYLOADS[sk]); return resp({ series: sk, kind: 'rss', entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }); }
      if (u.includes('/api/player/podcasts')) return resp(INDEX);
      return new Promise(() => {});
    };
  }, { INDEX, PAYLOADS, BOOK, SETTINGS, DATE });
  await pg.goto('http://127.0.0.1:' + port + '/');
  await pg.waitForTimeout(1500);
  return pg;
}
// Paint the composed day through the production seams
// (applyLiturgical from the payload record, then the
// standing Praylist paint — harness-v666-shoot's recipe).
async function standDay(pg, color) {
  await pg.evaluate(({ QUEUE, DATE, color }) => {
    const pt = (d) => ({ episodeId: d.episodeId, title: d.title, available: true, streamUrl: 'https://fixture.local/' + d.episodeId + '.mp3', durationS: d.durationS || 600 });
    const DAY = { date: DATE, presentedDay: DATE, profile: null,
      liturgicalDay: { name: color === 'red' ? 'Saint Cecilia, Virgin and Martyr' : 'Weekday of Ordinary Time', color },
      blocks: [
        { block: 'Morning', label: 'Morning', tracks: QUEUE.map(pt) },
        { block: 'Midday', label: 'Midday', tracks: [] },
        { block: 'Evening', label: 'Evening', tracks: [] },
        { block: 'Night', label: 'Night', tracks: [] },
        { block: 'Podcasts', label: 'Podcasts', tracks: [] },
      ], episodes: [] };
    state.tab = 'prayers';
    state.dayPayload = DAY;
    state.presentedDay = DATE;
    state.dayDescs = JSON.parse(JSON.stringify(QUEUE));
    state.starred = []; state.bookFavs = [];
    state.prayersView = { kind: 'home' };
    applyLiturgical(DAY);
    paintPrayersView(DAY);
  }, { QUEUE, DATE, color });
  await pg.waitForTimeout(500);
}
async function standQueue(pg) {
  await pg.evaluate(({ QUEUE, DATE }) => {
    const q = JSON.parse(JSON.stringify(QUEUE));
    state.presentedDay = DATE;
    state.dayPayload = { presentedDay: DATE, date: DATE, dayPositions: {} };
    state.dayDescs = q;
    state.extSlots = { 'ext-morning-prayer': { source: 'Sing the Hours', state: 'present', title: 'Morning Prayer', streamUrl: 'https://example.invalid/sth-morning.mp3', durationSec: 1034 } };
    state.extStanding = [{ slotId: 'ext-morning-prayer', title: 'Morning Prayer', block: 'Morning' }];
    refreshRepeatIds();
    state.queue = q;
    state.queueIdx = 0;
    state.current = q[0];
    state.pendingStart = null;
    openNowPlaying();
  }, { QUEUE, DATE });
  await pg.waitForTimeout(400);
}
// The computed-style probe set (one shape, every leg).
function probePage(pg) {
  return pg.evaluate(() => {
    const cs = (el, prop) => { if (!el) return null; const v = getComputedStyle(el).getPropertyValue(prop); return v === '' ? null : v.trim(); };
    const root = getComputedStyle(document.documentElement);
    const props = {};
    ['--cream', '--card', '--card-2', '--ink', '--muted', '--line', '--navy', '--accent', '--accent-text', '--bar-solid', '--gold-text'].forEach((k) => { props[k] = root.getPropertyValue(k).trim(); });
    const card = document.querySelector('.card');
    const meta = document.querySelector('.card .meta, .meta');
    const play = document.querySelector('.playbtn');
    return {
      props,
      mode: document.documentElement.getAttribute('data-mode'),
      lit: document.documentElement.getAttribute('data-lit'),
      bodyBg: cs(document.body, 'background-color'), bodyColor: cs(document.body, 'color'),
      cardBg: cs(card, 'background-color'), cardColor: cs(card, 'color'),
      metaColor: cs(meta, 'color'),
      tabbarBg: cs(document.querySelector('.tabbar'), 'background-color'),
      brandBg: cs(document.querySelector('.brandbar'), 'background-color'),
      playbtnBg: cs(play, 'background-color'),
    };
  });
}
async function probeSurfaces(pg) {
  // Settings seats + the ladder input + a production .entry,
  // painted on the standing page (either tree).
  await pg.evaluate(() => { renderSettings(); });
  await pg.waitForFunction(() => !!document.querySelector('[data-setkey] .mvbtn'), null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(300);
  const set = await pg.evaluate(() => {
    const cs = (el, prop) => { if (!el) return null; const v = getComputedStyle(el).getPropertyValue(prop); return v === '' ? null : v.trim(); };
    const host = document.createElement('div');
    host.innerHTML = entryHtml({ text: 'A fixture entry for the mode probe.', created_at: '2026-11-25T08:00:00', id: 1 });
    document.body.appendChild(host);
    const entry = host.querySelector('.entry');
    const out = {
      liblistBg: cs(document.querySelector('.liblist'), 'background-color'),
      setnameColor: cs(document.querySelector('.setrow .setname'), 'color'),
      mvbtnBg: cs(document.querySelector('[data-setkey] .mvbtn'), 'background-color'),
      selectBg: cs(document.querySelector('[data-setkey] select'), 'background-color'),
      entryBg: cs(entry, 'background-color'), entryColor: cs(entry, 'color'),
    };
    host.remove();
    return out;
  });
  // The form-input seat: the intention editor's text input
  // (a standing input[type=text] under the form rule — the
  // ladder's search input is transparent by design over its
  // .searchpill ground, so it cannot carry this seat).
  const inp = await pg.evaluate(() => {
    openIntentionEditor(null);
    const el = document.querySelector('#ed-text');
    const bg = el ? getComputedStyle(el).getPropertyValue('background-color').trim() : null;
    const sh = el ? el.closest('.sheet') : null;
    if (sh) sh.remove();
    return bg;
  });
  return { ...set, inputBg: inp };
}

// ---------- S: the DISPLAY control ----------
const pg = await makePage(main.port);
await standDay(pg, 'green');
await pg.evaluate(() => { renderSettings(); });
await pg.waitForFunction(() => !!document.querySelector('#set-mode669'), null, { timeout: 8000 });
{
  const s = await pg.evaluate(() => {
    const heads = [...document.querySelectorAll('.sectionhead')].map((h) => h.textContent.trim());
    const seg = document.querySelector('#set-mode669');
    const btns = seg ? [...seg.querySelectorAll('button')].map((x) => ({ label: x.textContent.trim(), pick: x.getAttribute('data-mode669'), active: x.classList.contains('active') })) : [];
    const row = seg ? seg.closest('.setrow') : null;
    return { heads: heads.slice(0, 2), btns, name: row ? row.querySelector('.setname').textContent.trim() : null, meta: row ? row.querySelector('.meta').textContent.trim() : null, mode: document.documentElement.getAttribute('data-mode') };
  });
  check('S DISPLAY stands FIRST in Settings (above PRAYER PLAN)', s.heads[0] === 'DISPLAY' && s.heads[1] === 'PRAYER PLAN', s.heads);
  check('S the row stands: name "Dark mode" + the standing meta line', s.name === 'Dark mode' && s.meta === 'The app\u2019s interior in dark tones. The day\u2019s liturgical color still stands in the accents.', { name: s.name, meta: s.meta });
  check('S the segtoggle carries Light · Dark · Follow the phone, Light active at the default, no data-mode standing',
    s.btns.length === 3 && s.btns[0].label === 'Light' && s.btns[1].label === 'Dark' && s.btns[2].label === 'Follow the phone'
    && s.btns[0].active && !s.btns[1].active && !s.btns[2].active && s.mode === null, s.btns);
  await pg.click('#set-mode669 [data-mode669="dark"]');
  await pg.waitForTimeout(400);
  const after = await pg.evaluate(() => ({
    store: (() => { try { return localStorage.getItem('opn-mode-v669'); } catch (e) { return null; } })(),
    mode: document.documentElement.getAttribute('data-mode'),
    active: (document.querySelector('#set-mode669 [data-mode669="dark"]') || {}).className || '',
    bodyBg: getComputedStyle(document.body).getPropertyValue('background-color').trim(),
  }));
  check('S a Dark tap writes the store, sets data-mode at once, and re-paints Settings with Dark active (no reload)',
    after.store === 'dark' && after.mode === 'dark' && /active/.test(after.active) && after.bodyBg === 'rgb(16, 16, 16)', after);
  await pg.click('#set-mode669 [data-mode669="light"]');
  await pg.waitForTimeout(400);
  const back = await pg.evaluate(() => ({ store: localStorage.getItem('opn-mode-v669'), mode: document.documentElement.getAttribute('data-mode') }));
  check('S a Light tap writes the store and removes the attribute at once', back.store === 'light' && back.mode === null, back);
}

// ---------- A: dark paint, measured (green day) ----------
await pg.evaluate(() => { opnModeSet669('dark'); applyMode669(); });
await standDay(pg, 'green');
{
  const p = await probePage(pg);
  check('A data-mode stands dark on the green day; the dark tokens compute to the §3.3 values',
    p.mode === 'dark' && p.props['--cream'] === '#101010' && p.props['--card'] === '#1c1c1c' && p.props['--card-2'] === '#0a0a0a'
    && p.props['--ink'] === '#f5f5f5' && p.props['--muted'] === '#a8a8a8' && p.props['--line'] === '#333333' && p.props['--navy'] === '#d4d4d4', p.props);
  check('A Praylist: body ground luminance < 0.05, body text >= 4.5:1 on it', lumOf(p.bodyBg) < 0.05 && contrast(p.bodyColor, p.bodyBg) >= 4.5, { bg: p.bodyBg, lum: lumOf(p.bodyBg), cr: contrast(p.bodyColor, p.bodyBg) });
  check('A Praylist: a section card ground luminance < 0.05, card text >= 4.5:1, muted meta >= 4.5:1',
    lumOf(p.cardBg) < 0.05 && contrast(p.cardColor, p.cardBg) >= 4.5 && contrast(p.metaColor, p.cardBg) >= 4.5,
    { bg: p.cardBg, cr: contrast(p.cardColor, p.cardBg), metaCr: contrast(p.metaColor, p.cardBg) });
  // Catechesis (the podcasts index paints its own cards;
  // driven through setTab, the production entry — the
  // paint guards on the standing tab).
  await pg.evaluate(() => { setTab('podcasts'); });
  await pg.waitForFunction(() => !!document.querySelector('.card'), null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(600);
  const c = await pg.evaluate(() => {
    const card = document.querySelector('.card');
    if (!card) return null;
    const cs = (el, prop) => getComputedStyle(el).getPropertyValue(prop).trim();
    const txt = card.querySelector('h3, .setname, .meta, div');
    return { bg: cs(card, 'background-color'), color: cs(txt || card, 'color') };
  });
  check('A Catechesis: a list card ground luminance < 0.05 with its text >= 4.5:1', !!c && lumOf(c.bg) < 0.05 && contrast(c.color, c.bg) >= 4.5, c);
  await standDay(pg, 'green');
  const s = await probeSurfaces(pg);
  check('A Settings: the liblist ground is the dark card value, the setname text >= 4.5:1 on it',
    s.liblistBg === 'rgb(28, 28, 28)' && contrast(s.setnameColor, s.liblistBg) >= 4.5, s);
  check('A hardcode seats measure var(--card) dark, not white: .mvbtn · select · a form input (the editor\u2019s) · .entry',
    s.mvbtnBg === 'rgb(28, 28, 28)' && s.selectBg === 'rgb(28, 28, 28)' && s.inputBg === 'rgb(28, 28, 28)' && s.entryBg === 'rgb(28, 28, 28)',
    { mvbtn: s.mvbtnBg, select: s.selectBg, input: s.inputBg, entry: s.entryBg });
  check('A the .entry text >= 4.5:1 on its dark ground', contrast(s.entryColor, s.entryBg) >= 4.5, { color: s.entryColor, cr: contrast(s.entryColor, s.entryBg) });
  // The DISPLAY segtoggle's active seat in dark.
  const seg = await pg.evaluate(() => {
    const segEl = document.querySelector('#set-mode669');
    const act = segEl ? segEl.querySelector('button.active') : null;
    return segEl && act ? { segBg: getComputedStyle(segEl).getPropertyValue('background-color').trim(), actColor: getComputedStyle(act).getPropertyValue('color').trim() } : null;
  });
  check('A Settings: the segtoggle ground is the dark card value; its active seat (lifted navy) >= 4.5:1 on it',
    !!seg && seg.segBg === 'rgb(28, 28, 28)' && contrast(seg.actColor, seg.segBg) >= 4.5, seg);
  // A sheet + a pop-up menu.
  const sheet = await pg.evaluate(() => {
    openSpeedSheet();
    const inner = document.querySelector('.speedsheet .inner');
    const h = inner ? inner.querySelector('h1') : null;
    const out = inner ? { bg: getComputedStyle(inner).getPropertyValue('background-color').trim(), hColor: h ? getComputedStyle(h).getPropertyValue('color').trim() : null } : null;
    const sh = document.querySelector('.speedsheet'); if (sh) sh.remove();
    return out;
  });
  check('A a sheet: .inner ground is the dark card value, its head text >= 4.5:1', !!sheet && sheet.bg === 'rgb(28, 28, 28)' && contrast(sheet.hColor, sheet.bg) >= 4.5, sheet);
  const menu = await pg.evaluate(() => {
    openSheetMenu('Probe menu', [{ label: 'Alpha item', act: function () {} }], null);
    const card = document.querySelector('.anchmenu');
    const item = card ? card.querySelector('[data-menuitem]') : null;
    const out = card ? { bg: getComputedStyle(card).getPropertyValue('background-color').trim(), color: item ? getComputedStyle(item).getPropertyValue('color').trim() : null } : null;
    document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove());
    return out;
  });
  check('A a pop-up menu: the openSheetMenu card ground luminance < 0.05, its item text >= 4.5:1', !!menu && lumOf(menu.bg) < 0.05 && contrast(menu.color, menu.bg) >= 4.5, menu);
  // The player body + a queue-sheet row.
  await standQueue(pg);
  const np = await pg.evaluate(() => {
    // The player card's body ground stands on .np-sheet
    // itself (background:var(--cream); its .inner is
    // transparent by dress) — a bottom-row ghost button
    // carries the body text seat.
    const sheet = document.querySelector('.np-sheet');
    const ghost = document.querySelector('.np-sheet .np-controls .btn.ghost');
    return sheet ? { bg: getComputedStyle(sheet).getPropertyValue('background-color').trim(), textColor: ghost ? getComputedStyle(ghost).getPropertyValue('color').trim() : null } : null;
  });
  check('A the player: the card body ground (the .np-sheet --cream seat) luminance < 0.05, its body text >= 4.5:1 on it', !!np && lumOf(np.bg) < 0.05 && contrast(np.textColor, np.bg) >= 4.5, np);
  await pg.click('#np-queue-btn');
  await pg.waitForTimeout(400);
  const qr = await pg.evaluate(() => {
    const row = document.querySelector('[data-npq-row]');
    const inner = document.querySelector('.npq-sheet .inner');
    return row && inner ? { rowColor: getComputedStyle(row).getPropertyValue('color').trim(), ground: getComputedStyle(inner).getPropertyValue('background-color').trim() } : null;
  });
  check('A the queue sheet: a row\u2019s text >= 4.5:1 on the sheet ground (ground luminance < 0.05)', !!qr && lumOf(qr.ground) < 0.05 && contrast(qr.rowColor, qr.ground) >= 4.5, qr);
  await pg.evaluate(() => { document.querySelectorAll('.sheet').forEach((n) => n.remove()); });
}

// ---------- C: accents under green + red ----------
for (const [color, wantText] of [['green', '#82cc97'], ['red', '#e58f87']]) {
  await pg.evaluate(() => { opnModeSet669('light'); applyMode669(); });
  await standDay(pg, color);
  const light = await probePage(pg);
  await pg.evaluate(() => { opnModeSet669('dark'); applyMode669(); });
  const dark = await probePage(pg);
  check('C ' + color + ': --accent, --bar-solid, the tabbar ground and a .playbtn ground are EQUAL light vs dark',
    light.props['--accent'] === dark.props['--accent'] && light.props['--bar-solid'] === dark.props['--bar-solid']
    && light.tabbarBg === dark.tabbarBg && light.playbtnBg === dark.playbtnBg,
    { accent: [light.props['--accent'], dark.props['--accent']], bar: [light.props['--bar-solid'], dark.props['--bar-solid']], tab: [light.tabbarBg, dark.tabbarBg], play: [light.playbtnBg, dark.playbtnBg] });
  check('C ' + color + ': the dark --accent-text computes to the §3.3 lifted value, >= 4.5:1 on --card and on --cream',
    dark.props['--accent-text'] === wantText && contrast(dark.props['--accent-text'], dark.props['--card']) >= 4.5 && contrast(dark.props['--accent-text'], dark.props['--cream']) >= 4.5,
    { got: dark.props['--accent-text'], want: wantText, onCard: contrast(dark.props['--accent-text'], dark.props['--card']), onCream: contrast(dark.props['--accent-text'], dark.props['--cream']) });
}

// ---------- B: light byte-identical (base 21fa13b vs v671, no data-mode) ----------
if (base) {
  const bp = await makePage(base.port);
  await standDay(bp, 'green');
  const bProbe = await probePage(bp);
  const bSurf = await probeSurfaces(bp);
  const mp = await makePage(main.port);
  await standDay(mp, 'green');
  const mProbe = await probePage(mp);
  const mSurf = await probeSurfaces(mp);
  const diffs = [];
  for (const k of Object.keys(bProbe.props)) if (bProbe.props[k] !== mProbe.props[k]) diffs.push('prop ' + k + ': ' + bProbe.props[k] + ' != ' + mProbe.props[k]);
  for (const k of ['bodyBg', 'bodyColor', 'cardBg', 'cardColor', 'metaColor', 'tabbarBg', 'brandBg', 'playbtnBg']) if (bProbe[k] !== mProbe[k]) diffs.push(k + ': ' + bProbe[k] + ' != ' + mProbe[k]);
  for (const k of Object.keys(bSurf)) if (bSurf[k] !== mSurf[k]) diffs.push('surface ' + k + ': ' + bSurf[k] + ' != ' + mSurf[k]);
  check('B LIGHT BYTE-IDENTICAL: every probed computed value on the v671 tree (no data-mode) equals the base tree 21fa13b', diffs.length === 0 && mProbe.mode === null, diffs);
  check('B the three #fff hardcodes still measure white in light on the v671 tree (.mvbtn · select · form input · .entry)',
    mSurf.mvbtnBg === 'rgb(255, 255, 255)' && mSurf.selectBg === 'rgb(255, 255, 255)' && mSurf.inputBg === 'rgb(255, 255, 255)' && mSurf.entryBg === 'rgb(255, 255, 255)', mSurf);
  await bp.context().close(); await mp.context().close();
}

// ---------- D: follow the phone ----------
{
  const dp = await makePage(main.port, 'dark');
  await dp.evaluate(() => { opnModeSet669('system'); applyMode669(); });
  await dp.waitForTimeout(200);
  let st = await probePage(dp);
  check('D Follow the phone under emulated dark paints dark', st.mode === 'dark' && st.bodyBg === 'rgb(16, 16, 16)', { mode: st.mode, bg: st.bodyBg });
  await dp.emulateMedia({ colorScheme: 'light' });
  await dp.waitForTimeout(400);
  st = await probePage(dp);
  check('D flipping the emulation to light live flips the paint light (the pick stands at system)', st.mode === null && st.bodyBg === 'rgb(250, 245, 236)', { mode: st.mode, bg: st.bodyBg });
  await dp.emulateMedia({ colorScheme: 'dark' });
  await dp.waitForTimeout(400);
  st = await probePage(dp);
  check('D flipping back to dark live flips the paint dark again', st.mode === 'dark', st.mode);
  await dp.emulateMedia({ colorScheme: 'light' });
  await dp.evaluate(() => { opnModeSet669('dark'); applyMode669(); });
  st = await probePage(dp);
  check('D explicit Dark under emulated light stays dark', st.mode === 'dark', st.mode);
  await dp.emulateMedia({ colorScheme: 'dark' });
  await dp.evaluate(() => { opnModeSet669('light'); applyMode669(); });
  st = await probePage(dp);
  check('D explicit Light under emulated dark stays light', st.mode === null, st.mode);
  await dp.context().close();
}

// ---------- E: persistence ----------
{
  const ep = await makePage(main.port);
  await ep.evaluate(() => { opnModeSet669('dark'); applyMode669(); });
  await ep.reload();
  await ep.waitForTimeout(1500);
  let st = await probePage(ep);
  check('E Dark pick -> reload -> dark stands (attribute + paint, from the boot pass)', st.mode === 'dark' && st.bodyBg === 'rgb(16, 16, 16)', { mode: st.mode, bg: st.bodyBg });
  await standDay(ep, 'red');
  st = await probePage(ep);
  check('E a day change to red rolls the accent, the mode stands', st.lit === 'red' && st.mode === 'dark' && st.props['--accent'] === '#9e2b25' && st.props['--accent-text'] === '#e58f87',
    { lit: st.lit, mode: st.mode, accent: st.props['--accent'], accentText: st.props['--accent-text'] });
  await ep.context().close();
}

// ---------- P: screenshots (light/dark pairs) ----------
{
  const sp = await makePage(main.port);
  await standDay(sp, 'green');
  await sp.evaluate(() => window.scrollTo(0, 0));
  await sp.screenshot({ path: SHOTS + '/01-praylist-light.png' });
  await standQueue(sp);
  await sp.screenshot({ path: SHOTS + '/03-player-light.png' });
  await sp.evaluate(() => { document.querySelectorAll('.sheet').forEach((n) => n.remove()); renderSettings(); });
  await sp.waitForFunction(() => !!document.querySelector('#set-mode669'), null, { timeout: 8000 });
  await sp.evaluate(() => window.scrollTo(0, 0));
  await sp.screenshot({ path: SHOTS + '/05-settings-light.png' });
  await sp.click('#set-mode669 [data-mode669="dark"]');
  await sp.waitForTimeout(500);
  await sp.evaluate(() => window.scrollTo(0, 0));
  await sp.screenshot({ path: SHOTS + '/06-settings-dark.png' });
  await standDay(sp, 'green');
  await sp.evaluate(() => window.scrollTo(0, 0));
  await sp.screenshot({ path: SHOTS + '/02-praylist-dark.png' });
  await standQueue(sp);
  await sp.screenshot({ path: SHOTS + '/04-player-dark.png' });
  check('P screenshots shot: 01/02 praylist, 03/04 player, 05/06 settings (DISPLAY standing) light/dark pairs', true);
  await sp.context().close();
}

await pg.context().close();
await b.close();
main.server.close();
if (base) base.server.close();

// ---------- G: regressions on this tree ----------
for (const h of ['harness-v668.mjs', 'harness-v667.mjs', 'harness-v666.mjs']) {
  let out = '', code = 0;
  try { out = execFileSync('node', [path.join(W, h)], { encoding: 'utf8', stdio: 'pipe', timeout: 600000 }); }
  catch (e) { code = e.status || 1; out = String(e.stdout || '') + String(e.stderr || ''); }
  const tail = out.trim().split('\n').filter((l) => /ok|not-ok/.test(l)).pop() || out.trim().split('\n').pop();
  check('G regression ' + h + ' runs green on the v671 tree', code === 0, tail);
  console.log('     ' + h + ' -> ' + tail);
}

console.log('harness-v669: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
