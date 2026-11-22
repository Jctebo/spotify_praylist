// harness-v609vault.mjs — v609 REPAIR 2: the vault-locked
//  cold open, fingerprint-first unlock, groups back in the
//  set, the scope question retired, and podcasts as
//  contents items (the Podcasts layer retires).
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (the day his phone served).
//  - tests/fixtures-v597/production-source-settings.json —
//    his production source settings (v8, 26 sources).
//  - ~/workspace/projects/ora-pro-nobis/john-personal-data-
//    import-v589.json — his own exported document (the
//    closest-to-live store state; the vault envelope in
//    these legs is built FROM it by the client's own
//    opnVaultCreate, so the locked world carries his real
//    document under a real envelope, not a hand-shaped one).
// The old tree (git main = the v609-2 build) must FAIL the
//  L legs (the reproduction); the fixed tree passes all.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrc = git(['show', 'bfb0e85:app/worker/src/client.ts']); // fail-on-old pin: the v609 REPAIR-1 ship (the build this repair fixes) — pinned 2026-11-21 so the reproduction legs survive this merge
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const PIN = '2468';

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = renderJs(oldClientSrc);
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v609vault:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opn604: (typeof opn604 !== "undefined" ? opn604 : null), opnLocalApi, opnMode, opnDoc, opnVaultLocked, opnVaultCreate, opnVaultUnlockWithPin, opnRawKeyB64: function () { return opnVaultRawKey ? opnB64(opnVaultRawKey) : null; }, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, renderPrayersSide, resolveReadingsSeat590, resolveProfileCourses590, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' };
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js, store, bridge, opts) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  if (opts && opts.fakeDate) {
    // Pin the world clock: today-layer writes for the
    // fixture day prune as PAST once the real calendar
    // rolls past it (opnPruneTodayEdits594 — correct
    // production behavior); the F6 world lives on the
    // fixture day.
    const RealDate = w.Date;
    const fixed = new RealDate(opts.fakeDate).getTime();
    w.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
  }
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  if (bridge) w.Capacitor = { Plugins: { OraDayBridge: bridge } };
  return w;
}
function bridgeStub(opts) {
  const calls = { unlock: 0, status: 0 };
  const base = {
    vaultBiometricStatus: () => { calls.status++; return Promise.resolve(opts.status); },
    vaultBiometricUnlock: () => { calls.unlock++; return opts.unlock(); },
    vaultBiometricClear: () => Promise.resolve({}),
    vaultBiometricEnroll: () => Promise.resolve({}),
  };
  const proxy = new Proxy(base, { get: (t, k) => { if (k === 'then') return undefined; return k in t ? t[k] : () => Promise.resolve({}); } });
  return { plugin: proxy, calls };
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0('2026-11-21');
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
async function paintRealDay(w, mutate) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  if (mutate) mutate(day);
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }

// ---------- build the vault envelope from John's document ----------
let envelope = null, rawKeyB64 = null;
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  O.opnDoc();
  await O.opnVaultCreate(PIN, 'RECOVERY-CODE-1');
  envelope = w.localStorage.getItem(DATA_KEY);
  rawKeyB64 = O.opnRawKeyB64();
  const parsed = JSON.parse(envelope);
  check('V0 the envelope is built from his real document by the client\u2019s own vault create', parsed && parsed.format === 'orapronobis-personal-data-encrypted' && !!parsed.wraps && !!rawKeyB64);
  w.close();
}
const lockedStore = () => ({ [DATA_KEY]: envelope });

// ---------- L ◆ REPRODUCTION on the shipped (v609-2) tree ----------
{
  const w = makeWorld(oldJs, lockedStore());
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  await sleep(1800);
  const d = w.document;
  check('L1 \u25c6 REPRODUCED: locked cold open — the vault stands locked over his real envelope', O.opnVaultLocked() === true);
  check('L2 \u25c6 REPRODUCED: the set paints ZERO track rows and NO lock prompt stands (his screenshot)',
    d.querySelectorAll('[data-p609set] [data-card]').length === 0 && !d.querySelector('[data-p609lock]') && !d.querySelector('.opn-unlock'),
    { cards: d.querySelectorAll('[data-p609set] [data-card]').length, set: !!d.querySelector('[data-p609set]') });
  const res = await profilesPayload(w);
  check('L3 the fold under lock reads the EPHEMERAL DEFAULT document (seed profiles, no contents)',
    !!res && !!res.effective && res.effective.key === 'salesian' && !res.effective.contents,
    res && res.effective ? { key: res.effective.key, contents: !!res.effective.contents } : null);
  w.close();
}

// ---------- F1 ◆ the locked paint stands the gate ----------
{
  const w = makeWorld(appJs, lockedStore());
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  await sleep(1800);
  const d = w.document;
  check('F1 \u25c6 locked Praylist: the LOCK GATE stands (unlock card), the empty set and its Play All do not',
    !!d.querySelector('[data-p609lock]') && !!d.querySelector('.opn-unlock') && !d.querySelector('[data-p609set]'),
    { lock: !!d.querySelector('[data-p609lock]'), set: !!d.querySelector('[data-p609set]') });
  w.close();
}

// ---------- F2 ◆ fingerprint FIRST: enrolled visit fires, unlock paints in place ----------
{
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.resolve({ keyB64: rawKeyB64 }) });
  const w = makeWorld(appJs, lockedStore(), plugin);
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  const fired = await until(() => calls.unlock >= 1, 6000);
  check('F2 \u25c6 the biometric prompt FIRES on the visit (no tap, no PIN first)', fired && calls.unlock === 1, { unlockCalls: calls.unlock });
  const unlocked = await until(() => !O.opnVaultLocked(), 6000);
  check('F2b the vault unlocks from the fingerprint (his real document decrypts)', unlocked);
  await sleep(600);
  const { descs } = await paintRealDay(w);
  const d = w.document;
  check('F2c after unlock the set stands IN PLACE (no tab switch was driven): gate gone, rows painted',
    !d.querySelector('[data-p609lock]') && d.querySelectorAll('[data-p609set] [data-card]').length >= 8,
    { cards: d.querySelectorAll('[data-p609set] [data-card]').length, descs: descs.length });
  w.close();
}

// ---------- F3 ◆ dismissal leaves the pad, no re-fire ----------
{
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.reject(new Error('user-cancelled: 13')) });
  const w = makeWorld(appJs, lockedStore(), plugin);
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  await until(() => calls.unlock >= 1, 6000);
  await sleep(700);
  const d = w.document;
  const note = d.querySelector('[data-p609locknote]');
  check('F3 \u25c6 dismissal: the PIN pad stands and the failure is NAMED on the gate (code surfaces, v606 discipline)',
    !!d.querySelector('#opn-unlock-go') && !!note && note.style.display !== 'none' && /did not complete/.test(note.textContent) && /13/.test(note.textContent),
    note ? note.textContent : null);
  O.paintPrayersView(O.state.dayPayload);
  await sleep(700);
  check('F3b a repaint of the locked page does NOT re-fire the prompt (once per visit)', calls.unlock === 1, { unlockCalls: calls.unlock });
  w.close();
}

// ---------- F4 ◆ not enrolled: pad + the enrolment line ----------
{
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: false }, unlock: () => Promise.reject(new Error('must not fire')) });
  const w = makeWorld(appJs, lockedStore(), plugin);
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  await sleep(1800);
  const d = w.document;
  const note = d.querySelector('[data-p609locknote]');
  check('F4 \u25c6 not enrolled: no prompt fires; the pad stands and the enrolment seat is named (Settings \u2192 CONFESSION PIN)',
    calls.unlock === 0 && !!d.querySelector('#opn-unlock-go') && !!note && note.style.display !== 'none' && /CONFESSION PIN/.test(note.textContent),
    note ? note.textContent : null);
  w.close();
}

// ---------- F5 ◆ groups back in the set ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const { descs } = await paintRealDay(w);
  const d = w.document;
  const set = d.querySelector('[data-p609set]');
  const pairs = [];
  let head = null;
  [...set.children].forEach((el) => {
    if (el.hasAttribute('data-p609sethead')) head = el.getAttribute('data-p609sethead');
    else if (el.hasAttribute('data-card')) pairs.push({ head, title: el.textContent.replace(/\s+/g, ' ').trim() });
  });
  const expectedHeads = [];
  descs.forEach((t) => { const b = t.block || 'Episodes'; if (expectedHeads[expectedHeads.length - 1] !== b) expectedHeads.push(b); });
  const actualHeads = [...set.querySelectorAll('[data-p609sethead]')].map((h) => h.getAttribute('data-p609sethead'));
  check('F5 \u25c6 the set paints GROUPED: one quiet head per block run, in fold order', JSON.stringify(actualHeads) === JSON.stringify(expectedHeads), { actualHeads, expectedHeads });
  check('F5b every track stands under its own block\u2019s head',
    pairs.length === descs.length && descs.every((t, i) => pairs[i] && pairs[i].head === (t.block || 'Episodes') && pairs[i].title.includes((t.title || '').slice(0, 18))),
    { pairs: pairs.length, descs: descs.length });
  check('F5c the group heads carry NO acts; exactly ONE Edit stands at the page top',
    set.querySelectorAll('[data-p609sethead] button').length === 0 && d.querySelectorAll('[data-p607edit]').length === 1);
  w.close();
}

// ---------- F6 ◆ the question retires: Edit opens on TODAY, the banner flips scope ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, null, { fakeDate: '2026-11-21T18:00:00Z' });
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  const d = w.document;
  click(w, d.querySelector('[data-p607edit]'));
  const formStood = await until(() => d.querySelector('[data-p604erow]'), 9000);
  check('F6 \u25c6 Edit opens the form DIRECTLY — no question sheet stands between', formStood && !d.querySelector('.p604q'), { sheet: !!d.querySelector('.p604q') });
  const banner = d.querySelector('[data-p604banner]');
  check('F6b entry lands on TODAY scope, every entry (the banner reads today; opn604.scope is today)',
    !!banner && /Editing today only/.test(banner.textContent) && O.opn604.scope === 'today', banner ? banner.textContent.slice(0, 80) : null);
  // The write's record is the STORED document (the
  // payload's todayEdit read is keyed to todayChicago —
  // after a midnight rollover it reads a different date
  // than the fixture day; the stored layer is the truth).
  const storedDoc = () => JSON.parse(w.localStorage.getItem(DATA_KEY));
  const storedBefore = (storedDoc().sections.profiles.list.find((p) => p.key === 'salesian') || {}).coreBlocks || [];
  const sw = d.querySelector('[data-p607sw="block|Midday"]');
  click(w, sw);
  await sleep(600);
  const docAfter = storedDoc();
  const todayLayer = (docAfter.sections.profiles.todayEdits || {})['2026-11-21'];
  const storedAfter = (docAfter.sections.profiles.list.find((p) => p.key === 'salesian') || {}).coreBlocks || [];
  check('F6c a write under TODAY scope lands in the today layer; the standing profile is untouched',
    !!todayLayer && Array.isArray(todayLayer.coreBlocks) && !todayLayer.coreBlocks.includes('Midday') && JSON.stringify(storedAfter) === JSON.stringify(storedBefore),
    { todayLayer: !!todayLayer, storedSame: JSON.stringify(storedAfter) === JSON.stringify(storedBefore) });
  click(w, d.querySelector('[data-p604change]'));
  await sleep(400);
  const banner2 = d.querySelector('[data-p604banner]');
  check('F6d the banner\u2019s own button flips scope to STANDING in place (no sheet)', !!banner2 && /Editing standing/.test(banner2.textContent) && O.opn604.scope === 'standing' && !d.querySelector('.p604q'));
  const laySw = d.querySelector('[data-p607sw="layer|novenas"]');
  click(w, laySw);
  await sleep(600);
  const salStanding = storedDoc().sections.profiles.list.find((p) => p.key === 'salesian') || {};
  check('F6e a write under STANDING scope lands in the profile (the Novenas layer flip persists)',
    !!salStanding.layers && salStanding.layers.novenas && salStanding.layers.novenas.on === false, salStanding.layers);
  click(w, d.querySelector('[data-p607done]'));
  await sleep(300);
  click(w, d.querySelector('[data-p607edit]'));
  await until(() => d.querySelector('[data-p604erow]'), 9000);
  const banner3 = d.querySelector('[data-p604banner]');
  check('F6f leaving and re-entering RESETS to today (no remembered scope)', !!banner3 && /Editing today only/.test(banner3.textContent) && O.opn604.scope === 'today');
  w.close();
}

// ---------- F7 ◆ the migration: layer series land as contents items ----------
const EXPECTED_MORNING = [
  { kind: 'source', key: 'ext-invitatory' }, { kind: 'source', key: 'morning-prayer' },
  { kind: 'source', key: 'ext-usccb-readings' }, { kind: 'source', key: 'ext-morning-prayer' },
  { kind: 'source', key: 'daily-rosary' }, { kind: 'source', key: 'marian-antiphon' },
  { kind: 'seat', key: 'daily-readings' },
];
const EXPECTED_NIGHT = [
  { kind: 'source', key: 'daily-reflection' }, { kind: 'source', key: 'ext-night-prayer' },
  { kind: 'course', key: 'bible-in-a-year' }, { kind: 'course', key: 'exorcist-files' },
];
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const res = await profilesPayload(w);
  const byKey = {};
  res.profiles.forEach((p) => { byKey[p.key] = p; });
  const sal = byKey.salesian, ben = byKey.benedictine, lit = byKey['little-way'];
  check('F7 \u25c6 the Podcasts layer retires on his profiles (no series, switch off)',
    !!sal && sal.layers.podcasts.on === false && (sal.layers.podcasts.series || []).length === 0
    && ben.layers.podcasts.on === false && (ben.layers.podcasts.series || []).length === 0);
  check('F7b Salesian Morning contents = the standing list + the readings seat as an item',
    JSON.stringify((sal.contents || {}).Morning) === JSON.stringify(EXPECTED_MORNING), (sal.contents || {}).Morning);
  check('F7c Salesian Night contents = the standing list + the two series as course items',
    JSON.stringify((sal.contents || {}).Night) === JSON.stringify(EXPECTED_NIGHT), (sal.contents || {}).Night);
  check('F7d untouched ground: Salesian Midmorning carries no contents entry; Benedictine Night none; Little Way none at all',
    !!sal && !('Midmorning' in (sal.contents || {})) && !!ben && !('Night' in (ben.contents || {})) && !!lit && !lit.contents);
  check('F7e Benedictine Morning gains the seat list; its other ground stands',
    JSON.stringify((ben.contents || {}).Morning) === JSON.stringify(EXPECTED_MORNING), (ben.contents || {}).Morning);
  const stored = JSON.parse(w.localStorage.getItem(DATA_KEY));
  check('F7f the migration persists (mig609 flag on the stored document)', stored.sections.profiles.mig609 === true);
  const rst = await w.__opn.opnLocalApi('/api/prayer/profiles/reset', { method: 'PUT', body: JSON.stringify({ profileKey: 'salesian' }) }, 'device');
  const salR = (rst.profiles || []).find((p) => p.key === 'salesian') || {};
  check('F7g Reset restores the designed Salesian Way IN THE MIGRATED SHAPE (seat in Morning, courses in Night, layer empty)',
    JSON.stringify((salR.contents || {}).Morning) === JSON.stringify(EXPECTED_MORNING)
    && JSON.stringify((salR.contents || {}).Night) === JSON.stringify(EXPECTED_NIGHT)
    && salR.layers.podcasts.on === false && (salR.layers.podcasts.series || []).length === 0, salR.contents);
  w.close();
}

// ---------- F8 ◆ composition: before/after track-for-track + no layer channel ----------
{
  const wOld = makeWorld(oldJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const oldRes = await paintRealDay(wOld);
  const oldIds = oldRes.descs.map((t) => t.episodeId);
  wOld.close();
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  await sleep(1500);
  check('F8 \u25c6 the layer auto-build no longer runs in the day build (state.podGroups stands empty)',
    !O.state.podGroups || !(O.state.podGroups.series || []).length, O.state.podGroups && O.state.podGroups.series);
  const { descs } = await paintRealDay(w);
  const newIds = descs.map((t) => t.episodeId);
  const kept = newIds.filter((id) => id !== 'bible-in-a-year:ep-1' && id !== 'exorcist-files:ep-1');
  // v619 REVERSAL (recorded in harness-v619.mjs + docs/releases/v619.md): the readings seat now stands at its CONTENTS position (the tail of Morning's contents list) instead of the v549 before-rosary anchor, so the track-for-track comparison below reads both lists seat-free; F8c still asserts the seat itself stands in Morning.
  const keptNoSeat = kept.filter((id) => id !== 'daily-readings:2026-11-21');
  const oldNoSeat = oldIds.filter((id) => id !== 'daily-readings:2026-11-21');
  check('F8b track-for-track: every pre-migration track stands in order; the two series land as course items at the tail of Night',
    JSON.stringify(keptNoSeat) === JSON.stringify(oldNoSeat) && newIds.includes('bible-in-a-year:ep-1') && newIds.includes('exorcist-files:ep-1'),
    { old: oldIds.length, new: newIds.length });
  const seat = descs.find((t) => t.podSeries === 'daily-readings');
  check('F8c the readings seat stands from its CONTENTS entry (Morning), as before', !!seat && seat.block === 'Morning', seat && seat.block);
  w.close();
}

// ---------- F9 ◆ contents-empty composes zero podcast tracks ----------
{
  // The post-migration state with every podcast entry
  // removed by hand: layer off and empty (mig609 stands
  // applied), Morning/Night contents carry their standing
  // lists WITHOUT the seat and WITHOUT the courses. The
  // catalog and the settings stand full — if any side
  // channel (layer, series machinery, standing contents)
  // still composed podcasts, a track would stand here.
  const variant = JSON.parse(JSON.stringify(JOHN));
  const sal = variant.sections.profiles.list.find((p) => p.key === 'salesian');
  sal.layers.podcasts = { on: false, series: [] };
  sal.contents = {
    Morning: EXPECTED_MORNING.filter((it) => it.kind !== 'seat'),
    Night: EXPECTED_NIGHT.filter((it) => it.kind !== 'course'),
  };
  variant.sections.profiles.mig609 = true;
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(variant) });
  await sleep(400);
  // The production fixture's payload carries the SERVER-
  // composed readingsSeat (that day's server fold) — strip
  // it here so the leg measures the CLIENT's composition
  // alone: with no contents seat entry, no seat may stand.
  const { descs } = await paintRealDay(w, (day) => { delete day.readingsSeat; });
  const pods = descs.filter((t) => t.kind === 'podcast' || t.podSeries || t.course590);
  check('F9 \u25c6 contents carry NO podcast entries (layer retired) = ZERO podcast tracks (no side channel)', pods.length === 0, pods.map((t) => t.episodeId));
  w.close();
}

// ---------- F10 ◆ a podcast removes like a prayer, and the removal persists ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, null, { fakeDate: '2026-11-21T18:00:00Z' });
  await sleep(400);
  const O = w.__opn;
  await paintRealDay(w);
  const d = w.document;
  click(w, d.querySelector('[data-p607edit]'));
  await until(() => d.querySelector('[data-p604erow]'), 9000);
  click(w, d.querySelector('[data-p604change]')); // to standing scope
  await sleep(400);
  const row = d.querySelector('[data-p604erow="course:bible-in-a-year"]');
  check('F10 the migrated course stands as an ordinary edit row in Night', !!row);
  if (row) click(w, row.querySelector('[data-p604remove]'));
  await sleep(600);
  const res = await profilesPayload(w);
  const sal = res.profiles.find((p) => p.key === 'salesian') || {};
  const night = (sal.contents || {}).Night || [];
  check('F10b the remove writes the same contents removal as a prayer\u2019s (the course entry is gone; the rest of Night stands)',
    !night.some((it) => it.kind === 'course' && it.key === 'bible-in-a-year')
    && night.some((it) => it.kind === 'course' && it.key === 'exorcist-files')
    && night.some((it) => it.kind === 'source' && it.key === 'daily-reflection'), night);
  check('F10c no Podcasts toggle renders anywhere in the form', !d.querySelector('[data-p607sw="layer|podcasts"]') && ![...d.querySelectorAll('[data-p607sw]')].some((b) => (b.getAttribute('data-p607sw') || '').indexOf('series|') === 0));
  w.close();
}

console.log('harness-v609vault:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
