// harness-v635.mjs — v635: an OFF (or empty) block stands
// at its DAY POSITION in the in-place edit form, greyed
// in place — never at the tail (John, 2026-11-23 12:55 CT:
// "the mid-morning toggle that is empty shows at the
// bottom. It should show in aligned with where it is in
// the day").
//
// The defect: opnEditSetHtml609 painted in two passes —
// pass 1 the blocks present in the composed day
// (orderedBlocks(day)), pass 2 every absent canonical
// block appended at the TAIL. An OFF block is absent
// from day.blocks, so it fell to the tail pass and
// painted after Novenas, out of its day position.
// The fix: the paint list is the pass-1 spine with each
// absent canonical block INSERTED at its canonical day
// position relative to the spine (spine-insert). Paint
// order only — no state, contents, or toggle change.
//
// Legs:
//  1. ◆ Midmorning OFF (absent from day.blocks): the
//     editor group order is the full canonical day order
//     and the Midmorning group carries p609off at
//     position 2 — in BOTH scopes (today + standing;
//     the form paints from the same opnEditSetHtml609).
//  2. An EMPTY but ON block (present in day.blocks, no
//     contents standing) stands at its day position.
//  3. All blocks present: the painted group order equals
//     orderedBlocks(day) order AND the edit-form HTML is
//     byte-identical to the base client's (56c156b).
//  4. Toggling Midmorning off then on (re-fold + repaint
//     after each shape change) never moves it from
//     position 2.
// FAIL-ON-OLD: leg 1's key assertions run against the
//  base client (56c156b, the v632 production tree this
//  release branches from) and must FAIL there — the
//  off groups stand at the tail. Leg 3 passes on both.
//
// Fixtures (Improvement D): every world is built over
//  John's exported document
//  (~/workspace/projects/ora-pro-nobis/john-personal-data-
//  import-v589.json) — his standing profile is The
//  Salesian Way, whose core is [Morning, Midday, Evening,
//  Night] with Novenas on: Midmorning AND Afternoon stand
//  OFF, exactly the shape of his 2026-11-23 recording.
//  The all-present world flips the same document's
//  standing pick to his Benedictine Way profile (core:
//  all six hours, Novenas on). The day payload is the
//  standing production-day fixture shape, folded by the
//  client's own opnFoldDay590.
//
// Run: node app/harness-v635.mjs
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
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BASE = '56c156bf21be047f2835b41180b27dd569fe1f3b';
const clientOldSrc = git(['show', BASE + ':app/worker/src/client.ts']);
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};
check('T1 the spine-insert stands in opnEditSetHtml609 (paint list built from orderedBlocks + canonical insert)',
  grab(clientSrc, 'opnEditSetHtml609').includes('paint635')
  && grab(clientSrc, 'opnEditSetHtml609').includes('CANON635')
  && grab(clientSrc, 'opnEditSetHtml609').includes('splice'));
check('T2 the group paint itself is byte-unchanged vs the base (paint order only)',
  grab(clientSrc, 'opnEditGroupHtml609') === grab(clientOldSrc, 'opnEditGroupHtml609'));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T3 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc) });

const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const CANON7 = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas'];

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = renderJs(clientOldSrc);
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
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v635:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const HOOK = '\n;window.__opn = { openConfigureLadder593, opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, opnDragOver604, opnMaterialize604, opnTodayItemId594, opnEditSetHtml609, orderedBlocks, opn604: (typeof opn604 !== "undefined" ? opn604 : null) };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function storeOf(doc) { const st = {}; st[DATA_KEY] = JSON.stringify(JSON.parse(JSON.stringify(doc))); return st; }
function johnStore() { return storeOf(JOHN); }
function benedictineStore() {
  const doc = JSON.parse(JSON.stringify(JOHN));
  doc.sections.profiles.standingKey = 'benedictine';
  return storeOf(doc);
}
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function publicDay(date, tracksPerBlock) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: (tracksPerBlock || []).map((t, i) => (b === 'Novenas' && i === 0
      ? { episodeId: '2026-11-21-st-andrew-day-1', title: 'Novena to St Andrew Day 1', state: 'present', available: true, streamUrl: 'https://example.invalid/novena-0.mp3', durationS: 60 }
      : { episodeId: b + '-t' + i, title: t, state: 'present', available: true, streamUrl: 'https://example.invalid/' + b + '-' + i + '.mp3', durationS: 60 })),
    trackCount: (tracksPerBlock || []).length,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function paintHome(w) {
  const O = w.__opn;
  const paint = () => {
    const day = O.opnFoldDay590(publicDay(TODAY, ['x', 'y']));
    O.state.dayPayload = day;
    O.extRebuildDescs(day);
    O.paintPrayersView(day);
    return day;
  };
  const day = paint();
  await sleep(600);
  paint();
  return day;
}
async function enterTopEdit(w, scope) {
  const d = w.document;
  click(w, d.querySelector('[data-p607edit]'));
  const met = await until(() => d.querySelector('.p604q') || d.querySelector('[data-p604erow]'), 9000);
  if (met && d.querySelector('.p604q')) {
    const row = [...d.querySelectorAll('[data-p604scope]')].find((r) => r.getAttribute('data-p604scope') === (scope || 'today'));
    if (row) click(w, row);
    return !!(await until(() => d.querySelector('[data-p604erow]'), 9000));
  }
  if (scope === 'standing' && d.querySelector('[data-p604erow]')) {
    click(w, d.querySelector('[data-p604change]'));
    await until(() => d.querySelector('[data-p604erow]'), 9000);
  }
  return !!d.querySelector('[data-p604erow]');
}
function groupOrder(w) {
  return [...w.document.querySelectorAll('[data-p609set] [data-p604exp]')].map((g) => g.getAttribute('data-p604exp'));
}
function groupEl(w, name) {
  return w.document.querySelector('[data-p609set] [data-p604exp="' + name + '"]');
}

// ---------- Leg 1 ◆ Midmorning OFF — today scope, then standing scope ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const day = await paintHome(w);
  const d = w.document, O = w.__opn;
  const spine = O.orderedBlocks(day).map((b) => b.block);
  check('L1a fixture stands as recorded: the folded day carries NO Midmorning (and no Afternoon) — Salesian core, Novenas on',
    !spine.includes('Midmorning') && !spine.includes('Afternoon') && spine.includes('Novenas'),
    { spine });
  check('L1b today scope entered', await enterTopEdit(w, 'today'));
  const order = groupOrder(w);
  const mid = groupEl(w, 'Midmorning');
  check('L1 ◆ TODAY scope: editor group order is the full canonical day order — Midmorning stands at position 2, greyed (p609off), NOT at the tail',
    JSON.stringify(order) === JSON.stringify(CANON7)
    && !!mid && mid.classList.contains('p609off')
    && order.indexOf('Midmorning') === 1 && order.indexOf('Midmorning') < order.indexOf('Novenas'),
    { order });
  const aft = groupEl(w, 'Afternoon');
  check('L1c ◆ the second off block (Afternoon) also stands in place at position 4, greyed',
    !!aft && aft.classList.contains('p609off') && order.indexOf('Afternoon') === 3, { order });
  // Standing scope: flip through the banner's own button (the v609 entry path).
  click(w, d.querySelector('[data-p604change]'));
  await until(() => d.querySelector('[data-p604erow]') && O.opn604.scope === 'standing', 9000);
  await sleep(300);
  const orderS = groupOrder(w);
  const midS = groupEl(w, 'Midmorning');
  check('L1d ◆ STANDING scope: the same form (same opnEditSetHtml609) paints the same order — Midmorning at position 2, greyed',
    O.opn604.scope === 'standing'
    && JSON.stringify(orderS) === JSON.stringify(CANON7)
    && !!midS && midS.classList.contains('p609off'),
    { scope: O.opn604.scope, orderS });
  w.close();
}
// Fail-on-old companion: the base client paints the off groups at the tail.
{
  const w = makeWorld(oldJs, johnStore());
  await sleep(400);
  await paintHome(w);
  await enterTopEdit(w, 'today');
  const order = groupOrder(w);
  check('L1-old ◆ REPRODUCED on the base client (56c156b): Midmorning stands at the TAIL — after Novenas, out of its day position',
    order.indexOf('Midmorning') > order.indexOf('Novenas') && JSON.stringify(order) !== JSON.stringify(CANON7),
    { order });
  w.close();
}

// ---------- Leg 2: an EMPTY but ON block stands at its day position ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  await enterTopEdit(w, 'today');
  // Midday stands ON in the Salesian core and present in
  // day.blocks; empty its materialized contents, then
  // repaint the form through the standing paint path.
  O.opn604.lists['Midday'] = [];
  O.paintPrayersView(O.state.dayPayload);
  await sleep(200);
  const order = groupOrder(w);
  const midday = groupEl(w, 'Midday');
  check('L2 ◆ EMPTY but ON: Midday stands at position 3 (not greyed, not at the tail), carrying the empty note',
    JSON.stringify(order) === JSON.stringify(CANON7)
    && !!midday && !midday.classList.contains('p609off')
    && order.indexOf('Midday') === 2
    && midday.textContent.includes('Nothing stands in this block.'),
    { order, middayOff: midday && midday.className });
  w.close();
}

// ---------- Leg 3: all blocks present — order + byte-identical paint ----------
async function allPresentEditHtml(js) {
  const w = makeWorld(js, benedictineStore());
  await sleep(400);
  const day = await paintHome(w);
  const O = w.__opn;
  await enterTopEdit(w, 'today');
  const out = {
    w,
    spine: O.orderedBlocks(day).map((b) => b.block),
    order: groupOrder(w),
    html: O.opnEditSetHtml609(O.state.dayPayload),
  };
  return out;
}
{
  const a = await allPresentEditHtml(appJs);
  check('L3 ◆ ALL PRESENT: painted group order == orderedBlocks(day) order == the canonical day order',
    JSON.stringify(a.order) === JSON.stringify(a.spine) && JSON.stringify(a.order) === JSON.stringify(CANON7),
    { order: a.order, spine: a.spine });
  const b = await allPresentEditHtml(oldJs);
  check('L3b ◆ ALL PRESENT: the edit-form HTML is BYTE-IDENTICAL to the base client\u2019s paint',
    a.html === b.html, { newLen: a.html.length, oldLen: b.html.length, oldOrder: b.order });
  a.w.close(); b.w.close();
}

// ---------- Leg 4: toggle Midmorning off then on — position 2 never moves ----------
{
  const w = makeWorld(appJs, benedictineStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  await enterTopEdit(w, 'today');
  const startOrder = groupOrder(w);
  const startMid = groupEl(w, 'Midmorning');
  check('L4a Benedictine world stands: Midmorning ON at position 2',
    JSON.stringify(startOrder) === JSON.stringify(CANON7) && !!startMid && !startMid.classList.contains('p609off'),
    { startOrder });
  const swOf = () => d.querySelector('[data-p609ghead="Midmorning"] [data-p607sw]');
  click(w, swOf());
  const offWrote = await until(() => O.opn604.shape && !O.opn604.shape.core.includes('Midmorning'), 9000);
  await paintHome(w); // re-fold under the new shape: Midmorning leaves day.blocks
  const offOrder = groupOrder(w);
  const offMid = groupEl(w, 'Midmorning');
  check('L4 ◆ toggled OFF + re-folded: Midmorning still stands at position 2, greyed in place',
    offWrote && JSON.stringify(offOrder) === JSON.stringify(CANON7)
    && !!offMid && offMid.classList.contains('p609off') && offOrder.indexOf('Midmorning') === 1,
    { offWrote, offOrder });
  click(w, swOf());
  const onWrote = await until(() => O.opn604.shape && O.opn604.shape.core.includes('Midmorning'), 9000);
  await paintHome(w);
  const onOrder = groupOrder(w);
  const onMid = groupEl(w, 'Midmorning');
  check('L4b ◆ toggled back ON + re-folded: Midmorning still stands at position 2, no longer greyed',
    onWrote && JSON.stringify(onOrder) === JSON.stringify(CANON7)
    && !!onMid && !onMid.classList.contains('p609off') && onOrder.indexOf('Midmorning') === 1,
    { onWrote, onOrder });
  w.close();
}

console.log('\nharness-v635:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
