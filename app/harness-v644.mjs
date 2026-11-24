// harness-v644.mjs — v644: share engages the system
//  share sheet in the app + the standard share icon.
//  Defects (John, field report on v640): in the APK the
//  "Share…" row never stood because the Capacitor WebView
//  carries no navigator.share, and #np-share carried the
//  bent-arrow glyph &#10548; instead of a share mark.
//  Fix: a nativeShareTrack(o) helper routes through the
//  standing OraDayBridge plugin's shareTrack method when
//  in-shell and the plugin exposes it (payload identical
//  to the web navigator.share composition: { title,
//  text: title + ' — ' + line, url }); openShareSheet
//  stands its "Share…" row when navigator.share OR the
//  native route stands, tries native first in-shell, and
//  falls back to the sheet's copy path on native
//  throw/reject. #np-share becomes an inline SVG of the
//  standard Material share glyph.
//
// Legs:
//  L1 ◆ APK shape: OraDayBridge stubbed WITH a recording
//     shareTrack, navigator.share ABSENT — the player's
//     share path stands the "Share…" row and clicking it
//     calls the bridge exactly once with title, composed
//     text, and the shareAppUrlFor app link.
//  L2 ◆ Web shapes: navigator.share stubbed → row stands
//     and calls it; absent → no row, copy click paints
//     "Link copied.".
//  L3 ◆ Icon: the painted #np-share content is an SVG
//     whose path d equals the standard Material share
//     path; the transport row no longer contains the
//     &#10548; / U+2934 glyph.
//  L4 ◆ Row menus: a day-row Share act in the APK-shaped
//     world engages the bridge through the same seam.
//  L5 ◆ Old-APK fallback: in-shell plugin WITHOUT
//     shareTrack → no "Share…" row, copy path works
//     exactly as today.
//  L6 ◆ Native failure honesty: a shareTrack that throws
//     synchronously falls back to the copy path in the
//     same sheet ("Link copied."); a shareTrack that
//     rejects reopens the sheet so the copy path stands.
//  ◆ legs fail on the base tree (v640 ship tree): the
//  native route and the SVG do not stand there — the
//  APK-shaped world shows no "Share…" row and the tap
//  lands on copy only (recorded in docs/releases/
//  v644.md §3 by the Implement seat).
//
// Fixtures (Improvement D — production sources, named):
//  - ~/workspace/projects/ora-pro-nobis/john-personal-
//    data-import-v589.json — John's own exported
//    document, seeded as the personal-data store (the
//    harness-v640 recipe; podcastListens deleted).
//  - tests/fixtures-v597/production-day-2026-11-21.json
//    + production-source-settings.json — the production
//    day payload and his production source settings,
//    building the standing world (the harness-v640
//    buildStanding / paintRealDay recipe).
//  - tests/fixtures-v603/book.json · novenas.json ·
//    podcasts-index.json — the fetch-stub bodies (the
//    harness-v640 recipe).
//  - Synthetic day descriptors follow harness-v640's
//    synthTrack shape over that production world; the
//    descriptor shared in L1/L4/L5 is that shape with a
//    production-shaped identity (episodeId + title +
//    durationS standing in state.dayDescs).
//
// Run: node app/harness-v644.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const STD_PATH = 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z';
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- T statics ----------
check('T1 nativeShareTrack stands: probes oraInShell + the plugin shareTrack function and calls it with { title, text: title + \' — \' + line, url }',
  (() => { const b = grab(clientSrc, 'nativeShareTrack'); return !!b && b.includes('oraInShell()') && b.includes('shareTrack') && b.includes('title: o.title') && b.includes("o.title + ' \\u2014 ' + o.line") && b.includes('url: o.url'); })());
check('T2 openShareSheet stands the Share… row on navigator.share OR the native route, and its click tries nativeShareTrack in-shell before the navigator.share path',
  (() => { const b = grab(clientSrc, 'openShareSheet'); return !!b && b.includes('navigator.share ||') && b.includes('nativeShareTrack(o)') && b.indexOf('nativeShareTrack(o)') < b.indexOf('navigator.share({'); })());
check('T3 #np-share static: the transport row carries the inline SVG with the standard Material share path and no &#10548; entity stands in client.ts',
  clientSrc.includes('viewBox="0 0 24 24"') && clientSrc.includes('d="' + STD_PATH + '"') && !clientSrc.includes('&#10548;') && !clientSrc.includes('⤴'));

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v644:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, openNowPlaying, openShareSheet: (typeof openShareSheet !== "undefined" ? openShareSheet : null), nativeShareTrack: (typeof nativeShareTrack !== "undefined" ? nativeShareTrack : null), openDayRowMenu: (typeof openDayRowMenu !== "undefined" ? openDayRowMenu : null), shareTrackSheet: (typeof shareTrackSheet !== "undefined" ? shareTrackSheet : null), shareAppUrlFor: (typeof shareAppUrlFor !== "undefined" ? shareAppUrlFor : null), EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(store, url) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: url || 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(null) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(extra) {
  return Object.assign({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-praylistmode-v604': 'expanded' }, extra || {});
}
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0(DATE);
  const prim = {};
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'external' && s.slotId && s.role !== 'fallback') prim[s.slotId] = s; });
  const standing = [];
  O.EXT_SLOTS.forEach((s) => {
    const row = prim[s.slotId];
    if (!row || row.enabled !== 1 || !O.extDayRulePasses(row.dayRule || 'daily', wd)) return;
    standing.push({ slotId: s.slotId, title: s.title, block: row.block || 'Morning', sortOrder: row.sortOrder, source: s.source || 'Divine Office' });
  });
  O.state.extStanding = standing;
  const own = [];
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'own' && O.OWN_ROW_EPISODE[s.sourceKey]) own.push({ sourceKey: s.sourceKey, episodeId: O.OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled }); });
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0));
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
}
async function paintRealDay(w) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
async function paintSynthetic(w, descs) {
  const O = w.__opn;
  await paintRealDay(w);
  O.state.dayDescs = descs;
  O.state.presentedDay = DATE;
  O.paintPrayersView(O.state.dayPayload);
  await sleep(120);
}
function synthTrack(over) {
  return Object.assign({ episodeId: 'synth-1', title: 'Synth track', block: 'Morning', available: true, streamUrl: 'https://example.invalid/s.mp3', durationS: 30 }, over || {});
}
function stubBridge(w, calls, mode) {
  const plugin = {
    setDaySnapshot: () => Promise.resolve({}), setNativeQueue: () => Promise.resolve({}),
    vaultBiometricStatus: () => Promise.resolve({}), oneEngine: () => Promise.resolve({}),
  };
  if (mode !== 'old') {
    plugin.shareTrack = (p) => {
      calls.push(p);
      if (mode === 'throw') throw new Error('share-boom');
      if (mode === 'reject') return Promise.reject(new Error('share-rejected'));
      return Promise.resolve({});
    };
  }
  try { Object.defineProperty(w, 'Capacitor', { value: { Plugins: { OraDayBridge: plugin } }, configurable: true }); } catch (e) { w.Capacitor = { Plugins: { OraDayBridge: plugin } }; }
  return plugin;
}
function stubShare(w, captured) {
  try { Object.defineProperty(w.navigator, 'share', { value: (p) => { captured.push(p); return Promise.resolve(); }, configurable: true }); } catch (e) { w.navigator.share = (p) => { captured.push(p); return Promise.resolve(); }; }
}
function stubClipboard(w, copied) {
  try { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: (s) => { copied.push(s); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
}
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
const TRACK = () => synthTrack({ episodeId: 'v644-1', title: 'V644 Track', durationS: 30 });
const WANT_URL = 'https://app.orapronobis.media/?s=day&date=' + DATE + '&id=v644-1';
const WANT_TEXT = 'V644 Track \u2014 Nov 21 \u00b7 Episode \u00b7 0:30';

// ---------- L1 ◆ APK shape (player path) + L3 ◆ icon ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const calls = [], copied = [];
  stubBridge(w, calls, 'ok');
  stubClipboard(w, copied);
  check('L1 ◆ APK world stands: in-shell bridge with shareTrack, navigator.share absent',
    typeof w.navigator.share === 'undefined' && !!w.Capacitor.Plugins.OraDayBridge.shareTrack, {});
  const t = TRACK();
  await paintSynthetic(w, [t]);

  // L3: the painted icon (the player must stand to paint it).
  O.state.current = t;
  O.openNowPlaying();
  await sleep(60);
  const btn = d.querySelector('#np-share');
  const path = btn && btn.querySelector('svg path');
  check('L3 ◆ #np-share paints an inline SVG (viewBox 0 0 24 24, fill currentColor) whose path d equals the standard Material share path',
    !!btn && !!path && path.getAttribute('d') === STD_PATH
    && btn.querySelector('svg').getAttribute('viewBox') === '0 0 24 24'
    && btn.querySelector('svg').getAttribute('fill') === 'currentColor'
    && btn.getAttribute('aria-label') === 'Share',
    { d: path && path.getAttribute('d') });
  const row = d.querySelector('.np-transport');
  check('L3 ◆ the transport row no longer contains the &#10548; / U+2934 glyph',
    !!row && !row.innerHTML.includes('10548') && !row.textContent.includes('\u2934') && !row.innerHTML.includes('\u2934'), { html: row && row.innerHTML.slice(0, 300) });

  // L1: tap #np-share → sheet → Share… row → bridge once.
  click(w, btn);
  await sleep(60);
  let sheet = d.querySelector('.sharesheet');
  check('L1 ◆ tapping #np-share in the APK world stands the share sheet WITH the "Share…" row (navigator.share absent)',
    !!sheet && !!sheet.querySelector('[data-sharego]'), {});
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(60);
  check('L1 ◆ clicking "Share…" calls the bridge exactly once with { title, text = title + \' — \' + line, url = the shareAppUrlFor app link }',
    calls.length === 1 && calls[0].title === 'V644 Track' && calls[0].text === WANT_TEXT && calls[0].url === WANT_URL
    && Object.keys(calls[0]).sort().join(',') === 'text,title,url',
    { calls });
  check('L1 ◆ the sheet closes after the native call and no copy fallback fired',
    !d.querySelector('.sharesheet') && copied.length === 0, { copied });

  // Direct openShareSheet with a production-shaped descriptor.
  calls.length = 0;
  if (O.openShareSheet) O.openShareSheet({ artHtml: '', title: t.title, line: 'Nov 21 \u00b7 Episode \u00b7 0:30', url: O.shareAppUrlFor(t) });
  await sleep(40);
  sheet = d.querySelector('.sharesheet');
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(40);
  check('L1 ◆ openShareSheet directly (production-shaped descriptor) engages the bridge once with the same payload',
    calls.length === 1 && calls[0].text === WANT_TEXT && calls[0].url === WANT_URL, { calls });
  w.close();
}

// ---------- L2 ◆ web shapes ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const captured = [], copied = [];
  stubClipboard(w, copied);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  stubShare(w, captured);
  if (O.shareTrackSheet) O.shareTrackSheet(t);
  await sleep(60);
  let sheet = d.querySelector('.sharesheet');
  check('L2 ◆ web shape with navigator.share: the "Share…" row stands', !!sheet && !!sheet.querySelector('[data-sharego]'), {});
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(40);
  check('L2 ◆ clicking it calls navigator.share once with the standing payload (byte-identical composition)',
    captured.length === 1 && captured[0].title === 'V644 Track' && captured[0].text === WANT_TEXT && captured[0].url === WANT_URL, { captured });
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const copied = [];
  stubClipboard(w, copied);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  if (O.shareTrackSheet) O.shareTrackSheet(t);
  await sleep(60);
  const sheet = d.querySelector('.sharesheet');
  check('L2 ◆ web shape without navigator.share (and no shell): no "Share…" row, Copy link stands alone',
    !!sheet && !sheet.querySelector('[data-sharego]') && !!sheet.querySelector('[data-sharecopy]'), {});
  click(w, sheet && sheet.querySelector('[data-sharecopy]'));
  await sleep(60);
  const note = sheet && sheet.querySelector('[data-shareline]');
  check('L2 ◆ the copy click writes the app link and paints "Link copied."',
    copied[0] === WANT_URL && !!note && note.textContent === 'Link copied.', { copied, note: note && note.textContent });
  w.close();
}

// ---------- L4 ◆ day-row menu in the APK world ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const calls = [], copied = [];
  stubBridge(w, calls, 'ok');
  stubClipboard(w, copied);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  const anchor = d.createElement('button');
  d.body.appendChild(anchor);
  if (O.openDayRowMenu) O.openDayRowMenu(t, anchor);
  await sleep(120);
  const shareItem = [...d.querySelectorAll('.anchmenu [data-menuitem]')].find((x) => x.textContent.trim() === 'Share');
  check('L4 ◆ the day-row menu stands its Share act in the APK world', !!shareItem, { labels: [...d.querySelectorAll('.anchmenu [data-menuitem]')].map((x) => x.textContent.trim()) });
  click(w, shareItem);
  await sleep(60);
  const sheet = d.querySelector('.sharesheet');
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(60);
  check('L4 ◆ the day-row Share act engages the bridge through the same seam, once, with the app-link payload',
    calls.length === 1 && calls[0].title === 'V644 Track' && calls[0].text === WANT_TEXT && calls[0].url === WANT_URL, { calls });
  w.close();
}

// ---------- L5 ◆ old-APK fallback ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const calls = [], copied = [];
  stubBridge(w, calls, 'old');
  stubClipboard(w, copied);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  if (O.shareTrackSheet) O.shareTrackSheet(t);
  await sleep(60);
  const sheet = d.querySelector('.sharesheet');
  check('L5 ◆ old APK (in-shell plugin WITHOUT shareTrack, no navigator.share): no "Share…" row, Copy link stands',
    !!sheet && !sheet.querySelector('[data-sharego]') && !!sheet.querySelector('[data-sharecopy]'), {});
  click(w, sheet && sheet.querySelector('[data-sharecopy]'));
  await sleep(60);
  const note = sheet && sheet.querySelector('[data-shareline]');
  check('L5 ◆ the copy path works exactly as today: app link written, note reads "Link copied.", bridge never called',
    copied[0] === WANT_URL && !!note && note.textContent === 'Link copied.' && calls.length === 0, { copied, note: note && note.textContent });
  w.close();
}

// ---------- L6 ◆ native failure honesty ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const calls = [], copied = [];
  stubBridge(w, calls, 'throw');
  stubClipboard(w, copied);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  if (O.shareTrackSheet) O.shareTrackSheet(t);
  await sleep(60);
  let sheet = d.querySelector('.sharesheet');
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(80);
  sheet = d.querySelector('.sharesheet');
  const note = sheet && sheet.querySelector('[data-shareline]');
  check('L6 ◆ a synchronously throwing shareTrack falls back to the copy path in the same sheet: link copied, "Link copied." painted, no dead end',
    !!sheet && copied[0] === WANT_URL && !!note && note.textContent === 'Link copied.', { copied, note: note && note.textContent });
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const calls = [], copied = [];
  stubBridge(w, calls, 'reject');
  stubClipboard(w, copied);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  if (O.shareTrackSheet) O.shareTrackSheet(t);
  await sleep(60);
  let sheet = d.querySelector('.sharesheet');
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(120);
  sheet = d.querySelector('.sharesheet');
  check('L6 ◆ a rejecting shareTrack reopens the sheet so the copy path stands (no dead end)',
    !!sheet && !!sheet.querySelector('[data-sharecopy]') && calls.length === 1, { calls: calls.length, sheet: !!sheet });
  click(w, sheet && sheet.querySelector('[data-sharecopy]'));
  await sleep(60);
  const note = sheet && sheet.querySelector('[data-shareline]');
  check('L6 ◆ after the rejection the copy path completes: app link written, "Link copied." painted',
    copied[0] === WANT_URL && !!note && note.textContent === 'Link copied.', { copied, note: note && note.textContent });
  w.close();
}

console.log('\nharness-v644:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
