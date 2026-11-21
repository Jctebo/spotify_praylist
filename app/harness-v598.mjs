// harness-v598.mjs — v598: Edit today's chips take the
// compact chip design of Edit profiles.
//
//  T  statics: ONE compact chip rule for the whole
//     Configure family naming .proftoday594 (no per-screen
//     chip re-declaration left) · Edit today's row in the
//     one compact row rule · client.ts byte-identical to
//     main (behavior untouched) · the base chip dress
//     stands for non-Configure uses · the rendered client
//     parses whole · SW pin (unmoved, or v598's own).
//  A  equivalence (the gate): the composition is
//     byte-identical to the pre-v598 ship (A1 Salesian
//     weekday · A2 Sunday), in the vm world of
//     harness-v594p2.
//  R  REAL-DOM legs (jsdom): John's document — Edit
//     today's rendered chips vs Edit profiles' rendered
//     chips: same classes, equal computed min-height /
//     padding / font-size / font-family · exactly one
//     chips row on Edit today · in a LOCKED-VAULT world
//     (a real envelope through the client's own pin-set
//     path): gate → pad unlock → a block switch lands a
//     layer → the pick warning stands → the pick tap
//     lands the pick and clears the layer, and the chips
//     measure compact in that world too.
// Fixtures from production only (Improvement D): John's
// import file (his profiles document).
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
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });

// ---------- T statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const UNIFIED = '.profplan590 .chip591, .profpop591 .chip591, .proffrozen593 .chip591, .profmapscreen593 .chip591, .proftoday594 .chip591 { padding:5px 11px; min-height:38px; }';
check('T1 ONE compact chip rule names every Configure wrapper incl. .proftoday594, with the editor\u2019s values (5px 11px / 38px)',
  uiSrc.includes(UNIFIED));
check('T2 no per-screen compact chip re-declaration remains (the compact dress is stated once)',
  (uiSrc.match(/\.chip591 \{ padding:5px 11px; min-height:38px; \}/g) || []).length === 1
  && !uiSrc.includes('.proffrozen593 .chip591 {') && !uiSrc.includes('.profmapscreen593 .chip591 {'),
  { count: (uiSrc.match(/\.chip591 \{ padding:5px 11px/g) || []).length });
check('T3 Edit today\u2019s chips row stands in the one compact row rule',
  uiSrc.includes('.profmapscreen593 .profchips591, .proftoday594 .profchips591 { margin:0 0 8px; padding-bottom:2px; }'));
let clientUntouched = true;
try { git(['diff', '--quiet', 'main', '--', 'app/worker/src/client.ts']); } catch (e) { clientUntouched = false; }
check('T4 client.ts is byte-identical to main — behavior untouched, presentation only', clientUntouched);
check('T5 the base chip dress stands untouched for any non-Configure use (44px form)',
  uiSrc.includes('.chip591 { flex:0 0 auto; font-family:var(--sans); font-size:14px; padding:7px 14px; min-height:44px;'));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T6 SW pin unmoved vs main, or v598\u2019s own pin at Ship',
  pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])) || pinOf(uiSrc) === 'ora-pro-nobis-v598-1',
  { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T7 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- vm world (harness-v594p2 pattern) ----------
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const FIXTURE_UNIVERSE = `
this.profContentsUniverse590 = function (block) {
  if (block === 'Novenas') return [{ kind: 'all-novenas', key: '', label: 'Every active novena' }];
  var items = [
    { kind: 'source', key: 'src-' + block.toLowerCase() + '-a', label: block + ' source A' },
    { kind: 'source', key: 'src-' + block.toLowerCase() + '-b', label: block + ' source B' }
  ];
  if (block === 'Morning') items.push({ kind: 'seat', key: 'daily-readings', label: 'The day\\u2019s readings' });
  ['catechism-in-a-year', 'bible-in-a-year', 'rosary-in-a-year', 'summa-in-a-year'].forEach(function (k) { items.push({ kind: 'course', key: k, label: 'Course — ' + k }); });
  return items;
};`;
function makeWorld(store, today) {
  const world = {
    console, URLSearchParams, Promise, Date, JSON, Object, Array, String, Number, Math, Set, Map, Error, RegExp, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent, Intl,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
  vm.createContext(world);
  const opnSlice = slice('var OPN_PLAYBACK_KEY', '/* ---- local per-track intention draws');
  const seedSlice = slice('var OPN_SEED_PROFILES', 'function opnLocalApi');
  const localSlice = slice('function opnLocalApi', 'function api(path, opts)');
  const restoreSlice = slice('function opnCountsOf', 'function opnHasSnapshot');
  vm.runInContext("var OPN_DATA_KEY = 'opn-personal-data-v1';\nthis.todayChicago = function () { return '" + today + "'; };\n" + opnSlice + '\n' + seedSlice + '\n' + localSlice + '\n' + restoreSlice + '\n' + FIXTURE_UNIVERSE + '\n;this.__local = opnLocalApi; this.__scrub = opnScrubDayPayload; this.__payload = opnProfilesPayload; this.__export = opnExportText; this.__restore = opnRestoreFromText; this.__div = opnTodayDivergence594; this.__doc = opnDoc;', world);
  vm.runInContext("this.window = { __OPN_SHAPE__: 'public' }; this.oraInShell = function () { return true; };", world);
  return world;
}
function johnStore() {
  const doc = JSON.parse(JSON.stringify(JOHN));
  const store = {};
  store[DATA_KEY] = JSON.stringify(doc);
  return store;
}
function publicDay(date, tracksPerBlock) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: (tracksPerBlock || []).map((t, i) => ({ episodeId: b + '-t' + i, title: t })),
    trackCount: (tracksPerBlock || []).length,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
const compOf = (day) => day.blocks.map((b) => b.block + '|' + (b.tracks || []).map((t) => t.episodeId).join(',')).join(' ; ');

// ---------- A: equivalence (the gate) ----------
{
  const w = makeWorld(johnStore(), '2026-11-21');
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-21', ['x', 'y']))));
  const ref = ['Morning', 'Midday', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : 'x,y'.split(',').map((t, i) => b + '-t' + i).join(','))).join(' ; ');
  check('A1 no layer: Salesian weekday composition byte-identical to the pre-v598 ship',
    compOf(out) === ref && out.profile.key === 'salesian' && !out.profile.todayEdits, { got: compOf(out) });
}
{
  const w = makeWorld(johnStore(), '2026-11-22');
  const out = w.__scrub(JSON.parse(JSON.stringify(publicDay('2026-11-22', ['x']))));
  const ref = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas', 'Podcasts']
    .map((b) => b + '|' + (b === 'Podcasts' ? '' : b + '-t0')).join(' ; ');
  check('A2 no layer: Sunday composition byte-identical to the pre-v598 ship',
    compOf(out) === ref && out.profile.key === 'benedictine' && !out.profile.todayEdits, { got: compOf(out) });
}

// ---------- R: real-DOM legs ----------
let JSDOM, webcrypto;
try {
  ({ JSDOM } = await import('jsdom'));
  ({ webcrypto } = await import('node:crypto'));
} catch (e) {
  check('R0 jsdom available (npm i --no-save jsdom)', false, e.message);
  console.log('harness-v598:', ok, 'ok /', bad, 'not ok');
  process.exit(1);
}
const HOOK = '\n;window.__opn = { openConfigureLadder593: openConfigureLadder593, openEditTodayScreen594: openEditTodayScreen594, openProfilesScreen: openProfilesScreen, opnLocalApi: opnLocalApi, opnMode: opnMode, opnVaultLocked: opnVaultLocked, opnVaultCreate: opnVaultCreate, profPlanRowHtml: profPlanRowHtml };';
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
if (shellStart < 0 || shellEnd < 0) { console.log('not ok - SHELL_HTML template markers'); process.exit(1); }
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
// The shell carries no <style> — the app CSS is served as
// its own sheet. Inject APP_CSS as a style element so the
// world computes the dress exactly as the served page
// composes it (without it jsdom measures no cascade).
const cssStart = uiSrc.indexOf('export const APP_CSS = `') + 'export const APP_CSS = `'.length;
const cssEnd = uiSrc.indexOf('\n`;', cssStart);
if (cssStart < 'export const APP_CSS = `'.length || cssEnd < 0) { console.log('not ok - APP_CSS template markers'); process.exit(1); }
const APP_CSS = vm.runInContext('`' + uiSrc.slice(cssStart, cssEnd) + '`', vm.createContext({}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function makeDomWorld(store, shape) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', shape || 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  const st = w.document.createElement('style');
  st.textContent = APP_CSS;
  w.document.head.appendChild(st);
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  Object.keys(store).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
async function until(fn, ms) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) { if (await fn()) return true; await sleep(100); }
  return !!(await fn());
}
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
async function unlockViaPad(w, pin) {
  for (const d of pin.split('')) {
    const b = w.document.querySelector('#opn-unlock-pad [data-pinkey="' + d + '"]');
    if (!b) return false;
    click(w, b);
  }
  await sleep(60);
  const go = w.document.getElementById('opn-unlock-go');
  if (!go || go.disabled) return false;
  click(w, go);
  return true;
}
async function profilesPayload(w) {
  return w.__opn.opnLocalApi('/api/prayer/profiles', {}, w.__opn.opnMode());
}
function chipMeasure(w, el) {
  const cs = w.getComputedStyle(el);
  return {
    cls: el.getAttribute('class'),
    minHeight: cs.minHeight,
    padT: cs.paddingTop, padR: cs.paddingRight, padB: cs.paddingBottom, padL: cs.paddingLeft,
    fontSize: cs.fontSize, fontFamily: cs.fontFamily,
  };
}
const sameMeasure = (a, b) => a && b && a.cls.replace(' on', '') === b.cls.replace(' on', '')
  && a.minHeight === b.minHeight && a.padT === b.padT && a.padR === b.padR && a.padB === b.padB && a.padL === b.padL
  && a.fontSize === b.fontSize && a.fontFamily === b.fontFamily;

// R1-R2: the plain world — chip equality across the two
// Edit screens + one chips row on Edit today.
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeDomWorld(store);
  await sleep(400);
  w.__opn.openProfilesScreen(null, { ladder: true });
  const edUp = await until(() => !!w.document.querySelector('[data-p593chip="benedictine"]'));
  const edChip = edUp ? chipMeasure(w, w.document.querySelector('[data-p593chip="benedictine"]')) : null;
  w.__opn.openEditTodayScreen594(true);
  const tdUp = await until(() => !!w.document.querySelector('[data-p594tchip="benedictine"]'));
  const tdChip = tdUp ? chipMeasure(w, w.document.querySelector('[data-p594tchip="benedictine"]')) : null;
  check('R1 Edit today\u2019s rendered chips equal Edit profiles\u2019 rendered chips: same classes, computed min-height 38px, padding 5px/11px, same typography',
    !!edChip && !!tdChip && sameMeasure(edChip, tdChip) && tdChip.minHeight === '38px' && tdChip.padT === '5px' && tdChip.padR === '11px' && tdChip.fontSize === '14px',
    { ed: edChip, td: tdChip });
  const rows = w.document.querySelectorAll('.proftoday594 .profchips591');
  check('R2 exactly one chips row stands on Edit today, inside the today sheet, in the one-row scrollable posture',
    rows.length === 1 && rows[0].closest('.proftoday594') !== null
    && w.getComputedStyle(rows[0]).flexWrap === 'nowrap' && w.getComputedStyle(rows[0]).overflowX === 'auto',
    { rows: rows.length });
}

// R3: the locked-vault world — gate → unlock → layer →
// warning → pick tap lands + clears; chips compact here.
let envelopeStore = null;
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeDomWorld(store);
  await sleep(400);
  let made = false;
  try {
    await w.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device');
    made = await until(() => {
      try { return JSON.parse(w.localStorage.getItem(DATA_KEY)).format === 'orapronobis-personal-data-encrypted'; } catch (e) { return false; }
    }, 10000);
  } catch (e) {}
  check('R3a a real vault envelope is created over John\u2019s document through the client\u2019s own pin-set path', made);
  if (made) {
    envelopeStore = {};
    for (let i = 0; i < w.localStorage.length; i++) {
      const k = w.localStorage.key(i);
      envelopeStore[k] = w.localStorage.getItem(k);
    }
  }
}
if (envelopeStore) {
  const w = makeDomWorld(envelopeStore);
  await sleep(400);
  w.__opn.openEditTodayScreen594(true);
  const gateStood = await until(() => !!w.document.getElementById('opn-unlock-go'));
  check('R3b locked vault: Edit today stands the unlock gate first, not the editor',
    gateStood && !w.document.querySelector('[data-p594tchip]'), { gate: gateStood });
  let flowOk = false, warnStood = false, picked = null, compactHere = null;
  if (gateStood && await unlockViaPad(w, '3141')) {
    const up = await until(() => !!w.document.querySelector('[data-p594tblock="Night"]'));
    if (up) {
      const tdChip = chipMeasure(w, w.document.querySelector('[data-p594tchip="benedictine"]'));
      compactHere = tdChip.minHeight === '38px' && tdChip.padT === '5px' && tdChip.padR === '11px';
      click(w, w.document.querySelector('[data-p594tblock="Night"]'));
      const layered = await until(async () => {
        const r = await profilesPayload(w);
        return !!(r.todayEdit && r.todayEdit.coreBlocks.indexOf('Night') < 0);
      }, 6000);
      if (layered) {
        warnStood = await until(() => !!w.document.querySelector('[data-p594tpickwarn]'), 4000);
        click(w, w.document.querySelector('[data-p594tchip="benedictine"]'));
        flowOk = await until(async () => {
          const r = await profilesPayload(w);
          picked = r.effective && r.effective.resolvedBy === 'pick' ? r.effective.key : null;
          return r.todayEdit === null && picked === 'benedictine';
        }, 6000);
      }
    }
  }
  check('R3c after the pad unlock: a block switch lands a layer, the clearing warning stands, and the pick tap lands the pick and clears the layer',
    flowOk && warnStood && picked === 'benedictine', { flowOk, warnStood, picked });
  check('R3d Edit today\u2019s chips measure compact in the locked-vault world too',
    compactHere === true, { compactHere });
}

console.log('harness-v598:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
