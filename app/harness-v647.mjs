// harness-v647.mjs — v647: a new build takes hold
//  without an app restart. Detection reads the served
//  pin from the SW script text; adoption fires exactly
//  one reload per pin, only at a safe moment (player
//  fully idle, no PIN/vault gate, no edit form, no
//  sheet/menu), and paints nothing.
//
// Legs (doc S3.7):
//  (1) session on pin N, N+1 served -> detection names N+1
//  (2) idle + ungated -> exactly one reload; the new
//      session stands on N+1 and the record clears
//  (3) a record already naming the target -> zero
//      reloads across repeated checks
//  (4) playback sounding -> no reload; a queue standing
//      paused -> no reload; after stop + idle -> fires
//  (5) vault gate standing -> no reload; edit form open
//      -> no reload; after both clear -> fires
//  (6) a reload landing back on pin N -> the old build
//      boots fully (the day paints), no second reload,
//      no error surface
//  (7) the adoption path paints nothing (paint
//      assertions) + a grep leg over the adoption seam
//      for user-facing strings / paint calls
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (leg 6's day paint, the
//    harness-v645 paintDay recipe).
//  - tests/fixtures-v597/production-source-settings.json.
//  - tests/fixtures-v603 (book / novenas / podcasts index
//    / bible-folded) — the fetch-stub bodies.
//  - ~/workspace/projects/ora-pro-nobis/john-personal-
//    data-import-v589.json — his own exported document,
//    seeded as the personal-data store (podcastListens
//    deleted, the standing recipe).
// The SW seam is stubbed at the client's own surfaces:
//  the /sw.js fetch (a mutable served pin), the
//  registration object (update() counted), and
//  location.reload — jsdom's reload is non-writable and
//  non-configurable, so reloads are counted through the
//  VirtualConsole navigation error jsdom emits for each
//  one (verified: one error per reload call).
// Direct start calls are wrapped in drive() (the v617 /
//  v618 recipe).
//
// Run: node app/harness-v647.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const PIN_N = 'ora-pro-nobis-v645-1';
const PIN_N1 = 'ora-pro-nobis-v646-1';
let SERVED = PIN_N;

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
// ---------- statics: leg (7), source half ----------
{
  const seamStart = clientSrc.indexOf('/* v647:');
  const seamEnd = clientSrc.indexOf("localStorage.setItem('opn-boot'", seamStart);
  const seam = seamStart >= 0 && seamEnd > seamStart ? clientSrc.slice(seamStart, seamEnd) : '';
  check('S7a the v647 adoption seam stands at the boot tail beside the SW registration',
    seam.length > 0 && seam.includes("navigator.serviceWorker.register('/sw.js')") && seam.includes("fetch('/sw.js', { cache: 'no-store' })"),
    { seamStart, seamEnd });
  check('S7b grep leg: the adoption seam carries no paint / user-facing string machinery (no innerHTML, no textContent writes, no alert, no class or element creation)',
    seam.length > 0 && !seam.includes('innerHTML') && !seam.includes('textContent') && !seam.includes('alert(')
    && !seam.includes('createElement') && !seam.includes('className') && !seam.includes('appendChild'),
    {});
  check('S7c the seam never reads or writes the v429 boot-stamp keys (opn-boot / opn-boot-healed stand outside the seam only)',
    seam.length > 0 && !seam.includes("'opn-boot'") && !seam.includes('opn-boot-healed'), {});
  check('S7d the SW source stands untouched in shape: ui.ts still carries the standing pin and skipWaiting + clients.claim',
    uiSrc.includes('var CACHE = "ora-pro-nobis-v645-1";') && uiSrc.includes('skipWaiting()') && uiSrc.includes('clients.claim()'), {});
}

const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, VirtualConsole, webcrypto;
try { ({ JSDOM, VirtualConsole } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v647:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opn604, audioEl, extRebuildDescs, opnFoldDay590, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0,'
  + ' opn647: (typeof opnCheck647 === "function") ? { check: opnCheck647, tryAdopt: opnTryAdopt647, safe: opnSafe647, runPin: function () { return opnRunPin647; }, pend: function () { return opnPend647; }, rec: opnAdoptRec647 }'
  + ' : { check: function () {}, tryAdopt: function () {}, safe: function () { return null; }, runPin: function () { return null; }, pend: function () { return null; }, rec: function () { return null; } } };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };
function fetchStub(url) {
  const u = String(url);
  if (u.includes('/sw.js')) {
    const body = 'var CACHE = "' + SERVED + '";\n';
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve(body) });
  }
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' };
  else if (u.includes('/api/player/podcasts?series=bible-in-a-year')) body = BIBLE;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { series: sk, entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(store) {
  const vc = new VirtualConsole();
  const counter = { reloads: 0, updates: 0 };
  vc.on('jsdomError', (e) => { if (/navigation/.test(e.message)) counter.reloads++; });
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  const fakeReg = { update: function () { counter.updates++; return Promise.resolve(); } };
  try { Object.defineProperty(w.navigator, 'serviceWorker', { value: { register: function () { return Promise.resolve(fakeReg); } }, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return { w, counter };
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
async function paintDay(w) {
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

// ---------- World A: legs (1) (2) (7-behavior) ----------
{
  SERVED = PIN_N;
  const { w, counter } = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(500);
  const O = w.__opn, A = O.opn647, d = w.document;
  check('A0 setup: the boot read names the running pin N (the served pin at boot)',
    A.runPin() === PIN_N && counter.reloads === 0, { runPin: A.runPin(), reloads: counter.reloads });

  // (1) detection, held by a standing sheet so adoption waits
  const sheet = d.createElement('div'); sheet.className = 'sheet'; d.body.appendChild(sheet);
  SERVED = PIN_N1;
  drive(() => A.check());
  await sleep(150);
  check('L1 ◆ a session on pin N with pin N+1 served detects the new build: the pending adoption names N+1 and registration.update() ran',
    A.pend() === PIN_N1 && counter.updates >= 1 && counter.reloads === 0,
    { pend: A.pend(), updates: counter.updates, reloads: counter.reloads });

  // (2) + (7) the sheet clears: exactly one reload, and the
  // adoption act paints nothing on its way out
  const childrenBefore = d.body.children.length;
  const nodesBefore = d.querySelectorAll('*').length;
  sheet.remove();
  drive(() => A.tryAdopt());
  await sleep(80);
  check('L2a ◆ idle + ungated: exactly one adoption reload fires, and the record was written for N+1 before it',
    counter.reloads === 1 && A.rec() === PIN_N1, { reloads: counter.reloads, rec: A.rec() });
  check('L7a ◆ the adoption path paints nothing: no node is added or removed across the fire and no surface stands after it',
    d.body.children.length === childrenBefore - 1 && d.querySelectorAll('*').length === nodesBefore - 1
    && !d.querySelector('.sheet, .pingate, .opn-unlock, .anchmenu'),
    { childrenBefore, childrenAfter: d.body.children.length, nodesBefore, nodesAfter: d.querySelectorAll('*').length });
  drive(() => A.tryAdopt());
  drive(() => A.check());
  await sleep(120);
  check('L2b ◆ no second fire in the same session after the adoption (repeated try + check)',
    counter.reloads === 1, { reloads: counter.reloads });
  w.close();

  // (2, second half) the post-reload session: served N+1,
  // the record standing from the firing session
  SERVED = PIN_N1;
  const w2 = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-adopt-v647': JSON.stringify({ target: PIN_N1 }) }).w;
  await sleep(500);
  const A2 = w2.__opn.opn647;
  check('L2c ◆ the new session stands on N+1 (its boot read names N+1) and the adoption record clears',
    A2.runPin() === PIN_N1 && A2.rec() === null, { runPin: A2.runPin(), rec: A2.rec() });
  w2.close();
}

// ---------- World B: leg (3) ----------
{
  SERVED = PIN_N;
  const { w, counter } = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-adopt-v647': JSON.stringify({ target: PIN_N1 }) });
  await sleep(500);
  const A = w.__opn.opn647;
  SERVED = PIN_N1;
  for (let i = 0; i < 3; i++) { drive(() => A.check()); await sleep(120); drive(() => A.tryAdopt()); }
  await sleep(120);
  check('L3 ◆ never twice for one pin: a record already naming the served target fires zero reloads across repeated checks',
    counter.reloads === 0 && A.rec() === PIN_N1, { reloads: counter.reloads, rec: A.rec() });
  w.close();
}

// ---------- World C: leg (4) ----------
{
  SERVED = PIN_N;
  const { w, counter } = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(500);
  const O = w.__opn, A = O.opn647;
  const track = { episodeId: 'morning-prayer', title: 'Morning Prayer', url: 'https://example.invalid/m.mp3' };
  SERVED = PIN_N1;
  // sounding: the element reads un-paused (the standing
  // transportPlaying read), a current stands
  O.state.current = track;
  try { Object.defineProperty(O.audioEl, 'paused', { value: false, configurable: true }); } catch (e) {}
  if (O.audioEl.paused) O.state.pendingStart = track; // fallback: the pending-start half of transportEngaged
  drive(() => A.check());
  await sleep(150);
  check('L4a ◆ playback sounding: detection stands pending but no adoption fires',
    A.pend() === PIN_N1 && counter.reloads === 0 && A.safe() === false,
    { pend: A.pend(), reloads: counter.reloads, safe: A.safe() });
  // stopped sounding, but a queue stands paused (call (a))
  try { Object.defineProperty(O.audioEl, 'paused', { value: true, configurable: true }); } catch (e) {}
  O.state.pendingStart = null;
  O.state.queue = [track]; O.state.queueIdx = 0;
  drive(() => A.tryAdopt());
  await sleep(80);
  check('L4b ◆ a queue standing paused blocks adoption (the idle bar, not merely not-sounding)',
    counter.reloads === 0 && A.safe() === false, { reloads: counter.reloads, safe: A.safe() });
  // stop + idle: the queue and current clear — adoption fires
  O.state.queue = []; O.state.queueIdx = -1; O.state.current = null;
  drive(() => A.tryAdopt());
  await sleep(80);
  check('L4c ◆ after stop + idle, adoption fires at the next safe-moment check: exactly one reload',
    counter.reloads === 1 && A.rec() === PIN_N1, { reloads: counter.reloads, rec: A.rec() });
  w.close();
}

// ---------- World D: leg (5) ----------
{
  SERVED = PIN_N;
  const { w, counter } = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(500);
  const O = w.__opn, A = O.opn647, d = w.document;
  SERVED = PIN_N1;
  // the v609 lock gate paint (its own marker + unlock card)
  const gate = d.createElement('div');
  gate.setAttribute('data-p609lock', '1');
  gate.innerHTML = '<div class="card opn-unlock"></div>';
  d.body.appendChild(gate);
  drive(() => A.check());
  await sleep(150);
  check('L5a ◆ the vault gate standing: detection pends, no adoption fires',
    A.pend() === PIN_N1 && counter.reloads === 0 && A.safe() === false,
    { pend: A.pend(), reloads: counter.reloads });
  // the gate clears; the in-place edit form opens
  gate.remove();
  O.opn604.editing = true;
  const edit = d.createElement('div'); edit.className = 'p609set p609edit'; d.body.appendChild(edit);
  drive(() => A.tryAdopt());
  await sleep(80);
  check('L5b ◆ the edit form open: no adoption fires',
    counter.reloads === 0 && A.safe() === false, { reloads: counter.reloads, safe: A.safe() });
  // both clear — adoption fires; a renderPinGate paint
  // (#pingate-card) also blocks, checked before the fire
  edit.remove(); O.opn604.editing = false;
  const pin = d.createElement('div'); pin.className = 'card pingate'; pin.id = 'pingate-card'; d.body.appendChild(pin);
  drive(() => A.tryAdopt());
  await sleep(60);
  const blockedByPinGate = counter.reloads === 0 && A.safe() === false;
  pin.remove();
  drive(() => A.tryAdopt());
  await sleep(80);
  check('L5c ◆ a renderPinGate paint blocks too; after every gate clears, adoption fires exactly once',
    blockedByPinGate && counter.reloads === 1 && A.rec() === PIN_N1,
    { blockedByPinGate, reloads: counter.reloads, rec: A.rec() });
  w.close();
}

// ---------- World E: leg (6) ----------
{
  SERVED = PIN_N;
  const { w, counter } = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-adopt-v647': JSON.stringify({ target: PIN_N1 }), 'opn-praylistmode-v604': 'expanded', 'opn-praylistmode-v612-reset': '1' });
  await sleep(500);
  const O = w.__opn, A = O.opn647, d = w.document;
  const { descs } = await paintDay(w);
  check('L6a ◆ a reload landing back on pin N leaves the old build running fully: the production day paints, no error surface stands',
    A.runPin() === PIN_N && descs.length >= 8 && (O.state.dayDescs || []).length >= 8
    && !d.querySelector('.sheet') && !!d.querySelector('[data-p609set]') && d.querySelectorAll('[data-p609set] [data-card]').length > 0,
    { runPin: A.runPin(), descs: descs.length, set: !!d.querySelector('[data-p609set]'), cards: d.querySelectorAll('[data-p609set] [data-card]').length });
  SERVED = PIN_N1;
  for (let i = 0; i < 3; i++) { drive(() => A.check()); await sleep(120); drive(() => A.tryAdopt()); }
  await sleep(120);
  check('L6b ◆ the standing record blocks any second automatic reload for that pin, however many checks run',
    counter.reloads === 0 && A.pend() === PIN_N1 && A.rec() === PIN_N1,
    { reloads: counter.reloads, pend: A.pend(), rec: A.rec() });
  w.close();
}

// ---------- World F: repair leg (a) — the PIN recovery form ----------
// Fixture: renderPinRecoveryForm's own paint, verbatim in
// shape (client.ts ~4294): a plain .card (no .pingate, no
// #pingate-card) holding the typed #rec-code field, the
// rec1/rec2 opnPinPadHtml pads, #rec-msg, and the #rec-go /
// #rec-back controls. On the ca6294f client no opnSafe647
// marker covers it, so this leg fails there.
function pinPadHtml647(prefix) {
  return '<div class="pindots" id="' + prefix + '-dots"></div>'
    + '<div class="pinpad" id="' + prefix + '-pad">'
    + ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(function (dg) { return '<button data-pinkey="' + dg + '">' + dg + '</button>'; }).join('')
    + '<span class="pinblank"></span><button data-pinkey="0">0</button><button data-pinkey="back" aria-label="Delete last digit">&#9003;</button></div>';
}
const RECOVERY_FORM_HTML = '<div class="card"><h3>Use your recovery code</h3>'
  + '<p class="meta">Enter the code shown when the PIN was set, and choose a new PIN. Your examination and confession content is kept.</p>'
  + '<label class="f">Recovery code</label><input type="text" id="rec-code" autocomplete="off" style="text-transform:uppercase">'
  + '<label class="f">New PIN (4-8 digits)</label>' + pinPadHtml647('rec1')
  + '<label class="f">New PIN again</label>' + pinPadHtml647('rec2')
  + '<p class="pinmsg" id="rec-msg"></p>'
  + '<div class="row"><button class="btn gold" id="rec-go">Set new PIN</button><button class="btn ghost" id="rec-back">Back</button></div></div>';
{
  SERVED = PIN_N;
  const { w, counter } = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(500);
  const A = w.__opn.opn647, d = w.document;
  const form = d.createElement('div');
  form.innerHTML = RECOVERY_FORM_HTML;
  d.body.appendChild(form);
  const codeEl = d.getElementById('rec-code');
  if (codeEl) codeEl.value = 'ABCD-1234';
  SERVED = PIN_N1;
  drive(() => A.check());
  await sleep(150);
  drive(() => A.tryAdopt());
  await sleep(80);
  check('L8a ◆ repair: the PIN recovery form standing (real paint, typed code in #rec-code) reads not-safe and zero reloads fire while it stands',
    A.pend() === PIN_N1 && A.safe() === false && counter.reloads === 0,
    { pend: A.pend(), safe: A.safe(), reloads: counter.reloads });
  form.remove();
  drive(() => A.tryAdopt());
  await sleep(80);
  check('L8b ◆ repair: after the recovery form clears, adoption fires exactly once',
    counter.reloads === 1 && A.rec() === PIN_N1, { reloads: counter.reloads, rec: A.rec() });
  w.close();
}

// ---------- World G: repair leg (b) — the record write throws ----------
{
  SERVED = PIN_N;
  const { w, counter } = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(500);
  const A = w.__opn.opn647, d = w.document;
  const sheet = d.createElement('div'); sheet.className = 'sheet'; d.body.appendChild(sheet);
  SERVED = PIN_N1;
  drive(() => A.check());
  await sleep(150);
  // storage fails at the fire moment, for the adoption key only
  // (installed inside the page context — a Node-side property
  // on the jsdom Storage object is not seen by page code)
  drive(() => w.eval("window.__opnSetOrig647 = window.Storage.prototype.setItem;"
    + " window.Storage.prototype.setItem = function (k, v) { if (k === 'opn-adopt-v647') { window.__opnSetThrew647 = true; throw new Error('storage unavailable'); } return window.__opnSetOrig647.call(this, k, v); };"));
  sheet.remove();
  drive(() => A.tryAdopt());
  await sleep(80);
  const threw = !!w.__opnSetThrew647;
  check('L9a ◆ repair: the opn-adopt-v647 write throwing at the fire moment fires zero reloads and no record stands',
    threw && counter.reloads === 0 && A.rec() === null,
    { threw, reloads: counter.reloads, rec: A.rec() });
  // storage works again: a later attempt may retry and fire once
  drive(() => w.eval("if (window.__opnSetOrig647) window.Storage.prototype.setItem = window.__opnSetOrig647;"));
  drive(() => A.tryAdopt());
  await sleep(80);
  check('L9b ◆ repair: when storage works again, the still-pending adoption retries and fires exactly once',
    counter.reloads === 1 && A.rec() === PIN_N1, { reloads: counter.reloads, rec: A.rec() });
  w.close();
}

console.log('\nharness-v647:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
