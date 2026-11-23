// harness-v637.mjs — v637: the Divine Office / Sing the
// Hours choice (v632) gains a SECOND DOOR in the Praylist
// edit form. One preference, two doors — same store
// ('opn-sth-first-v632'), same reader (opnSthPrimary628),
// same writer (opnSthFirstSet632), no forked state.
//
// Legs:
//  1. Edit form under scope 'today' AND 'standing' each
//     carry the choice block with both options; the
//     standing marker follows the store.
//  2. A flip tap in the editor writes the ONE store key,
//     opnSthPrimary628 reads the flipped value,
//     opnExtChoice628 follows it, and the Settings paint
//     reads the same flipped state.
//  3. No store value yet: the form marks Divine Office
//     first (the standing default).
//  4. Regression guards: banner + edit bar byte-identical
//     vs base; a flip leaves opn604 untouched; the words
//     'primary'/'fallback' never paint in the choice block.
//  ◆ legs fail on the base client (56c156b), proven by the
//  old-world companions below and by running this harness
//  on the base tree.
//
// Fixtures (Improvement D): the edit form paints through
// the real paintPrayersView / opnFoldDay590 /
// extRebuildDescs path over the v603/v597 production
// fixtures and John's exported document, exactly as
// harness-v609 builds its worlds; the choice seam fixture
// is harness-v632's both-sources Morning Prayer entry.
//
// Run: node app/harness-v637.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const BASE = '56c156bf21be047f2835b41180b27dd569fe1f3b';
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const clientOldSrc = git(['show', BASE + ':app/worker/src/client.ts']);
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- T statics ----------
check('T1 the new paint stands and paints in the edit set directly under the Pick head',
  clientSrc.includes('function opnSthChoiceHtml637()')
  && grab(clientSrc, 'opnEditSetHtml609').includes('html += opnPickHead609();\n  html += opnSthChoiceHtml637();'));
check('T2 protected functions byte-identical vs base (reader, writer, consumer, banner, edit bar)',
  ['opnSthPrimary628', 'opnSthFirstSet632', 'opnExtChoice628', 'opnBannerHtml604', 'opnEditBarHtml604'].every((n) => grab(clientSrc, n) === grab(clientOldSrc, n) && grab(clientSrc, n) !== ''));
check('T3 the choice paint uses the ONE writer/reader/store only (no new key, no PIN access)',
  grab(clientSrc, 'opnSthChoiceHtml637').includes('opnSthPrimary628()')
  && !clientSrc.includes('opn-sth-first-v637')
  && !grab(clientSrc, 'opnSthChoiceHtml637').includes('opnPin'));
check('T5 the Settings door is REMOVED (no section paint, no set-sth-first ids anywhere) and the cache prune stands in resolveExternals',
  !clientSrc.includes('set-sth-first-do') && !clientSrc.includes('set-sth-first-sth')
  && grab(clientSrc, 'resolveExternals').includes('wantFirst637')
  && grab(clientSrc, 'resolveExternals').includes("delete rec.slots[sid637]"));

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const appJsOld = renderJs(clientOldSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T4 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v637:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const STH_KEY = 'opn-sth-first-v632';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const SEED_ROWS = (() => {
  const at = appJs.indexOf('var OPN_SEED_SOURCES = ');
  const end = appJs.indexOf('];', at);
  return vm.runInContext('(' + appJs.slice(at + 'var OPN_SEED_SOURCES = '.length, end + 1) + ')', vm.createContext({}));
})();
const HOOK = '\n;window.__opn = { opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, opnSthPrimary628, opnSthFirstSet632, opnExtChoice628, opnSthChoiceHtml637: (typeof opnSthChoiceHtml637 !== "undefined" ? opnSthChoiceHtml637 : null), opnBannerHtml604, opnEditBarHtml604, paintSettings, renderPrayersSide, setTab, opn604: (typeof opn604 !== "undefined" ? opn604 : null), setRows637: function (r) { settingsRows = r; settingsVersion = 7; } };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The both-sources live payload, as v634 serves the two
// labeled slots (Divine Office standing, Sing the Hours
// as its backup pointer).
const LIVE637 = { slots: [
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: 'https://do.example/mp.mp3', durationSec: 600, sizeBytes: 1000, source: 'Divine Office', backup: { streamUrl: 'https://sth.example/lauds.mp3', source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours' } },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: 'https://do.example/ep.mp3', durationSec: 600, sizeBytes: 1000, source: 'Divine Office', backup: { streamUrl: 'https://sth.example/vespers.mp3', source: 'Sing the Hours', title: 'Evening Prayer - Sing the Hours' } },
]};
// Per-leg network posture for the L5 return builds.
let NET637 = { failDo: false, failPassthrough: false };
function fetchStub(url) {
  const u = String(url);
  if (NET637.failPassthrough && u.includes('/api/player/externals/audio')) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.reject(new Error('passthrough down')) });
  if (NET637.failDo && u.startsWith('https://do.example/')) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.reject(new Error('do down')) });
  let body = {};
  if (u.includes('/api/player/source-settings')) body = { sources: SEED_ROWS, version: 7 };
  else if (u.includes('/api/player/externals/live')) body = LIVE637;
  else if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(''), blob: () => Promise.resolve(new Blob(['x'], { type: 'audio/mpeg' })) });
}
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  try { w.URL.createObjectURL = () => 'blob:fake-' + Math.random(); w.URL.revokeObjectURL = () => {}; } catch (e) {}
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function johnStore(extra) { return Object.assign({ [DATA_KEY]: JSON.stringify(JOHN) }, extra || {}); }
function publicDay(date) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: ['x', 'y'].map((t, i) => ({ episodeId: b + '-t' + i, title: t, state: 'present', available: true, streamUrl: 'https://example.invalid/' + b + '-' + i + '.mp3', durationS: 60 })),
    trackCount: 2,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function paintHome(w) {
  const O = w.__opn;
  const paint = () => {
    const day = O.opnFoldDay590(publicDay(TODAY));
    O.state.dayPayload = day;
    O.extRebuildDescs(day);
    O.paintPrayersView(day);
    return day;
  };
  paint();
  await sleep(600);
  paint();
}
async function enterEdit(w, scope) {
  const d = w.document;
  click(w, d.querySelector('[data-p607edit]'));
  const met = await until(() => d.querySelector('[data-p604erow]'), 9000);
  if (scope === 'standing' && d.querySelector('[data-p604erow]')) {
    click(w, d.querySelector('[data-p604change]'));
    await until(() => d.querySelector('[data-p604banner]') && d.querySelector('[data-p604banner]').textContent.includes('Editing standing'), 9000);
  }
  return met;
}
function choiceBlock(w) { return w.document.querySelector('[data-p637sthchoice]'); }
function rowByName(root, name) {
  return [...root.querySelectorAll('.setrow')].find((el) => (el.querySelector('.setname') || {}).textContent === name) || null;
}
function choiceState(w) {
  const blk = choiceBlock(w);
  if (!blk) return null;
  const doRow = rowByName(blk, 'Divine Office first');
  const sthRow = rowByName(blk, 'Sing the Hours first');
  return {
    blk,
    bothVisible: !!doRow && !!sthRow,
    doStanding: !!doRow && /Standing/.test(doRow.textContent) && !doRow.querySelector('button'),
    sthStanding: !!sthRow && /Standing/.test(sthRow.textContent) && !sthRow.querySelector('button'),
    doBtn: blk.querySelector('[data-p637sth="do"]'),
    sthBtn: blk.querySelector('[data-p637sth="sth"]'),
    lead: blk.textContent.includes('Which reading of the office plays first for Morning Prayer and Evening Prayer:'),
    underPick: !!w.document.querySelector('[data-p609pickhead]') && (w.document.querySelector('[data-p609pickhead]').compareDocumentPosition(blk) & w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  };
}

// ---------- Leg 1 + 3: both scopes, marker follows store; fresh default ----------
for (const scope of ['today', 'standing']) {
  for (const [val, label] of [['off', 'Divine Office'], ['on', 'Sing the Hours']]) {
    const w = makeWorld(appJs, johnStore({ [STH_KEY]: val }));
    await sleep(400);
    await paintHome(w);
    const entered = await enterEdit(w, scope);
    const cs = choiceState(w);
    check(`L1 ◆ scope '${scope}', store '${val}': choice block stands under the Pick head, both options visible, ${label} first marked Standing`,
      entered && !!cs && cs.bothVisible && cs.lead && cs.underPick
      && (val === 'off' ? (cs.doStanding && !!cs.sthBtn) : (cs.sthStanding && !!cs.doBtn)),
      cs ? { both: cs.bothVisible, doS: cs.doStanding, sthS: cs.sthStanding } : null);
    w.close();
  }
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  await enterEdit(w, 'today');
  const cs = choiceState(w);
  check('L3 ◆ fresh localStorage (no store value, no PIN record): the form marks Divine Office first, the standing default',
    !!cs && cs.doStanding && !!cs.sthBtn && w.localStorage.getItem(STH_KEY) === 'off',
    { key: w.localStorage.getItem(STH_KEY) });
  w.close();
}
{
  const w = makeWorld(appJsOld, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await paintHome(w);
  await enterEdit(w, 'today');
  check('L1-old ◆ REPRODUCED on the base client: no choice block stands in the edit form at all',
    !choiceBlock(w) && !w.__opn.opnSthChoiceHtml637);
  w.close();
}

// ---------- Leg 2 + 4: the flip — one store, both doors; opn604 untouched ----------
{
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await paintHome(w);
  await enterEdit(w, 'today');
  const O = w.__opn;
  const snap604 = () => JSON.stringify({ scope: O.opn604.scope, lists: O.opn604.lists, base: O.opn604.base, removed: O.opn604.removed, wrote: O.opn604.wrote });
  const before604 = snap604();
  const slot = { slotId: 'ext-morning-prayer', title: 'Morning Prayer' };
  const entry = { title: 'Morning Prayer - Divine Office', streamUrl: 'https://do.example/mp.mp3', source: 'Divine Office', backup: { streamUrl: 'https://sth.example/lauds.mp3', source: 'Sing the Hours' } };
  const beforeChoice = O.opnExtChoice628(slot, entry, 'Divine Office');
  click(w, w.document.querySelector('[data-p637sth="sth"]'));
  const moved = await until(() => { const cs = choiceState(w); return cs && cs.sthStanding; }, 8000);
  const afterChoice = O.opnExtChoice628(slot, entry, 'Divine Office');
  check('L2 ◆ flip tap in the editor: marker moves in the repaint, the ONE key stands \'on\', the helper reads true, the choice seam settles Sing the Hours first',
    moved && w.localStorage.getItem(STH_KEY) === 'on' && O.opnSthPrimary628() === true
    && beforeChoice.streamUrl === 'https://do.example/mp.mp3'
    && afterChoice.streamUrl === 'https://sth.example/lauds.mp3' && afterChoice.source === 'Sing the Hours'
    && afterChoice.backup && afterChoice.backup.streamUrl === 'https://do.example/mp.mp3',
    { moved, key: w.localStorage.getItem(STH_KEY), after: afterChoice.streamUrl });
  check('L4a ◆ the flip leaves opn604 untouched (scope, lists, base, removed, wrote byte-identical)',
    snap604() === before604, { before: before604.slice(0, 120), after: snap604().slice(0, 120) });
  // (2a) The Settings door is GONE; the Source mapping
  // labels still follow the editor flip.
  O.setRows637(SEED_ROWS);
  O.paintSettings();
  await sleep(300);
  const bodyHtml = w.document.body.innerHTML;
  const laudsRow = w.document.querySelector('[data-setkey="sth-lauds"]');
  const laudsLabel = laudsRow ? laudsRow.querySelector('.meta').textContent : null;
  check('L2b ◆ (2a) Settings paint carries NO Morning & Evening choice section and NO set-sth-first ids, while the Source mapping Sing the Hours label follows the editor flip (\'stands first\')',
    !w.document.getElementById('set-sth-first-do') && !w.document.getElementById('set-sth-first-sth')
    && ![...w.document.querySelectorAll('h2.sectionhead')].some((h) => h.textContent.includes('MORNING & EVENING PRAYER'))
    && laudsLabel === 'Morning & Evening choice: stands first',
    { laudsLabel, bodyHas: bodyHtml.includes('set-sth-first') });
  // Flip back through the editor door.
  await paintHome(w);
  // paintHome re-paints the non-edit home; re-enter the form.
  if (!choiceBlock(w)) await enterEdit(w, 'today');
  click(w, w.document.querySelector('[data-p637sth="do"]'));
  const back = await until(() => { const cs = choiceState(w); return cs && cs.doStanding; }, 8000);
  check('L2c ◆ tapping Divine Office Put first in the editor restores \'off\' and the default seam order',
    back && w.localStorage.getItem(STH_KEY) === 'off' && O.opnSthPrimary628() === false
    && O.opnExtChoice628(slot, entry, 'Divine Office').streamUrl === 'https://do.example/mp.mp3',
    { back, key: w.localStorage.getItem(STH_KEY) });
  w.close();
}

// ---------- Leg 4: banner / edit bar painted outputs identical; wording ----------
{
  const wn = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await paintHome(wn);
  await enterEdit(wn, 'today');
  const wo = makeWorld(appJsOld, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await paintHome(wo);
  await enterEdit(wo, 'today');
  const bannerN = wn.__opn.opnBannerHtml604(), bannerO = wo.__opn.opnBannerHtml604();
  const barN = wn.__opn.opnEditBarHtml604(), barO = wo.__opn.opnEditBarHtml604();
  check('L4b ◆ banner and edit bar outputs byte-identical with the choice present vs the base client',
    bannerN !== '' && bannerN === bannerO && barN !== '' && barN === barO,
    { bannerN: bannerN.slice(0, 80), bannerO: bannerO.slice(0, 80) });
  const blk = choiceBlock(wn);
  check('L4c ◆ the choice block carries neither \'primary\' nor \'fallback\' (case-insensitive)',
    !!blk && !/primary/i.test(blk.innerHTML) && !/fallback/i.test(blk.innerHTML));
  wn.close(); wo.close();
}

// ---------- Leg 5 (2b): the blank-feed defect ----------
// Full day-build sequence over the production day fixture
// + the v634 both-sources live payload: build (the day
// cache writes itself, Morning/Evening standing on Divine
// Office, no backup in the record — the writeCache shape),
// flip the choice, return to the Praylist, re-build.
async function blankSequence(js, flipInEditor, net) {
  const w = makeWorld(js, johnStore());
  await sleep(400);
  const O = w.__opn;
  O.renderPrayersSide();
  const built = await until(() => { const mp = O.state.extSlots && O.state.extSlots['ext-morning-prayer']; return mp && mp.state === 'present'; }, 15000);
  await sleep(500);
  const baseline = { descs: (O.state.dayDescs || []).length, mpSource: O.state.extSlots['ext-morning-prayer'] && O.state.extSlots['ext-morning-prayer'].source, cache: w.localStorage.getItem('opn-ext-cache-v1') };
  if (flipInEditor) {
    await paintHome(w);
    await enterEdit(w, 'today');
    click(w, w.document.querySelector('[data-p637sth="sth"]'));
    await until(() => w.localStorage.getItem(STH_KEY) === 'on', 5000);
    click(w, w.document.querySelector('[data-p607done]'));
    await sleep(200);
  } else {
    O.opnSthFirstSet632(true);
  }
  NET637 = net || { failDo: false, failPassthrough: false };
  O.setTab('prayers');
  const settled = await until(() => { const mp = O.state.extSlots && O.state.extSlots['ext-morning-prayer']; return mp && (mp.state === 'present' || mp.state === 'missing'); }, 20000);
  await sleep(500);
  NET637 = { failDo: false, failPassthrough: false };
  const out = {
    built, settled, baseline,
    descs: (O.state.dayDescs || []).length,
    mp: O.state.extSlots['ext-morning-prayer'] ? { state: O.state.extSlots['ext-morning-prayer'].state, source: O.state.extSlots['ext-morning-prayer'].source } : null,
    ep: O.state.extSlots['ext-evening-prayer'] ? { state: O.state.extSlots['ext-evening-prayer'].state, source: O.state.extSlots['ext-evening-prayer'].source } : null,
    mpDesc: (O.state.dayDescs || []).find((d) => d.episodeId === 'ext-morning-prayer') || null,
  };
  w.close();
  return out;
}
{
  const r = await blankSequence(appJs, true, null);
  check('L5a ◆ (2b) flip in the editor + return: the composed day stands WHOLE — same descriptor count, Morning & Evening re-settled in place on Sing the Hours',
    r.built && r.settled && r.baseline.mpSource === 'Divine Office' && r.descs === r.baseline.descs && r.descs > 0
    && r.mp && r.mp.state === 'present' && r.mp.source === 'Sing the Hours'
    && r.ep && r.ep.state === 'present' && r.ep.source === 'Sing the Hours',
    { baseline: r.baseline.descs, descs: r.descs, mp: r.mp, ep: r.ep });
  const ro = await blankSequence(appJsOld, false, null);
  check('L5a-old ◆ REPRODUCED on the base client: after the flip the return build leaves Morning & Evening on the OLD choice (the day cache owns the slots; the preference never re-settles them)',
    ro.built && ro.settled && ro.mp && ro.mp.source === 'Divine Office' && ro.ep && ro.ep.source === 'Divine Office',
    { mp: ro.mp, ep: ro.ep });
}
{
  const r = await blankSequence(appJs, true, { failDo: true, failPassthrough: true });
  check('L5b ◆ (2b) the field blank, return build with the old choice\'s routes down: on this build Morning Prayer still stands PRESENT, re-settled on Sing the Hours through its own route, the day whole',
    r.built && r.settled && r.descs === r.baseline.descs
    && r.mp && r.mp.state === 'present' && r.mp.source === 'Sing the Hours'
    && r.mpDesc && r.mpDesc.available === true,
    { descs: r.descs, baseline: r.baseline.descs, mp: r.mp });
  const ro = await blankSequence(appJsOld, false, { failDo: true, failPassthrough: true });
  check('L5b-old ◆ REPRODUCED on the base client: the cache-owned restore carries NO backup — with its routes down the slot settles MISSING (the blanked hour)',
    ro.built && ro.settled && ro.mp && ro.mp.state === 'missing',
    { mp: ro.mp, descs: ro.descs, baseline: ro.baseline.descs });
}

console.log('\nharness-v637:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
