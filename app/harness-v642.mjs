// harness-v642.mjs — v642: the Praylist set vanishes on a
//  tab return (fix-forward). The payload fold in
//  buildDayFromPayload must never paint an empty set over
//  a composed day: the composed list extRebuildDescs builds
//  is the paint source of record, keyed by presented date;
//  with no composed list standing, the set's place carries
//  a plain loading state until the first rebuild paints;
//  a genuinely empty day still settles to its true empty
//  paint; the vault-locked gate discipline (v609 repair 2)
//  stands byte-for-byte in behavior.
//
// Legs:
//  L1 round trip (FAIL-ON-OLD): the day is composed through
//     the real resolution builders (the v609vault
//     paintRealDay pattern: real standings + real
//     extRebuildDescs) and paints whole; a tab return is
//     then simulated in the field's timing shape — the day
//     fetch answers at once, the settings + podcast
//     (resolution) legs are DEFERRED behind a gate. The
//     return's first home paint must carry the standing
//     composed set (never the empty set); the gate then
//     opens, the deferred legs complete, and the settled
//     paint is the full set.
//  L2 cold open: no composed list stands — the set's place
//     carries the loading state, not the empty set, until
//     the first rebuild paints the real set.
//  L3 locked return: the vault locked — the unlock gate
//     substitutes, and a standing composed set never paints
//     over it (v609vault discipline).
//  L4 true empty day: a day with no composed set settles
//     to its true empty paint — no perpetual loading.
//
// Fail-on-old: OPN642_CLIENT=/tmp/v642-base-client.ts
//  (a pristine copy of client.ts from 91e9179) node
//  app/harness-v642.mjs — L1 (and L2/L4's loading legs)
//  fail there: the return's first paint is the empty set
//  of John's recording.
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (payload block tracks
//    EMPTY: the composed substance enters via profile
//    contents + settings rows, exactly the field shape).
//  - tests/fixtures-v597/production-source-settings.json —
//    his production source settings (26 sources).
//  - tests/fixtures-v603 (book / novenas / podcasts index).
//  - ~/workspace/projects/ora-pro-nobis/john-personal-data-
//    import-v589.json — his own exported document, the
//    personal-data seed (the vault envelope in L3 is built
//    FROM it by the client's own opnVaultCreate).
//  - the LIVE externals set shape from harness-v641 (the
//    production resolver's present slots for the day).
//
// Run: node app/harness-v642.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 600)); }
}
const clientSrc = readFileSync(process.env.OPN642_CLIENT || (APP + 'worker/src/client.ts'), 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const PIN = '2468';
const LIVE = { slots: [
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: 'https://do.example/mp.mp3', durationSec: 600, sizeBytes: 1000, source: 'Divine Office' },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: 'https://do.example/ep.mp3', durationSec: 600, sizeBytes: 1000, source: 'Divine Office' },
  { slotId: 'ext-office-of-readings', state: 'present', title: 'Office of Readings - Divine Office', streamUrl: 'https://do.example/oor.mp3', durationSec: 900, sizeBytes: 1000, source: 'Divine Office' },
]};

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v642:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opn604: (typeof opn604 !== "undefined" ? opn604 : null), opnLocalApi, opnMode, opnDoc, opnVaultLocked, opnVaultCreate, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, renderPrayersSide, buildDayFromPayload, setTab, resolveReadingsSeat590, resolveProfileCourses590, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }

// ---------- the deferred-resolution gate ----------
// While the gate is closed, the settings read and every
// podcast fetch (the resolution legs) hang unresolved —
// the field's timing shape on a slow return. The day
// fetch itself always answers at once.
let gateClosed = false;
const gateWaiters = [];
function gated(make) {
  if (!gateClosed) return make();
  return new Promise((res) => gateWaiters.push(() => res(make())));
}
function openGate() { gateClosed = false; gateWaiters.splice(0).forEach((f) => f()); }
function closeGate() { gateClosed = true; }

function routeFetch(u) {
  const respond = (body) => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : ''),
    blob: () => Promise.resolve(new Blob([new Uint8Array(2048)], { type: 'audio/mpeg' })),
  });
  if (u.includes('/api/player/source-settings')) return respond({ sources: SETTINGS597.sources, version: SETTINGS597.version });
  if (u.includes('/api/player/podcasts')) {
    if (u.includes('series=novenas')) return respond(NOVENAS);
    if (u.includes('series=daily-readings')) return respond({ entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' });
    if (u.includes('series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); return respond({ entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }); }
    return respond(PODIDX);
  }
  if (u.includes('/api/prayer/book')) return respond(BOOK);
  if (u.includes('/api/player/externals/live')) return respond(LIVE);
  if (u.includes('/api/player/externals/audio')) return respond('');
  if (u.includes('/api/player/day')) return respond(JSON.parse(JSON.stringify(DAY597)));
  return respond({});
}
function fetchStub(url) {
  const u = String(url);
  // The field's timing shape: the DAY fetch answers at
  // once; every resolution leg behind it (courier, feeds,
  // audio downloads, podcast reads) hangs while the gate
  // is closed. (The settings read is a personal path in
  // the public build — answered by the local layer, never
  // a fetch; the pass's network legs are what stand slow
  // in the field.)
  if (gateClosed && !u.includes('/api/player/day')) return gated(() => routeFetch(u));
  return routeFetch(u);
}
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  // The field shape of John's recording: the Praylist
  // groups stand EXPANDED (his standing Expand-all choice;
  // the v612 one-time reset flag already stands, so the
  // mode read keeps 'expanded').
  const fullStore = { 'opn-praylistmode-v604': 'expanded', 'opn-praylistmode-v612-reset': '1', ...(store || {}) };
  Object.keys(fullStore).forEach((k) => w.localStorage.setItem(k, fullStore[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
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
const cards = (w) => w.document.querySelectorAll('[data-p609set] [data-card]').length;
const loading = (w) => !!w.document.querySelector('[data-p642loading]');
// Record every home paint shape, in order, while a leg
// runs — the first paint and the never-empty property are
// judged over the whole window, not one endpoint sample
// (the build's paints land inside one microtask cascade;
// the observer's callbacks interleave with it).
function recordPaints(w) {
  const paints = [];
  const snap = () => ({ cards: cards(w), loading: loading(w), set: !!w.document.querySelector('[data-p609set]'), lock: !!w.document.querySelector('[data-p609lock]') });
  const obs = new w.MutationObserver(() => { const s = snap(); const last = paints[paints.length - 1]; if (!last || JSON.stringify(last) !== JSON.stringify(s)) paints.push(s); });
  obs.observe(w.document.getElementById('view'), { childList: true, subtree: true });
  return { paints, stop: () => obs.disconnect() };
}
const firstHomePaint = (paints) => paints.find((p) => p.set || p.loading || p.lock);
const emptyPaint = (paints) => paints.some((p) => p.set && p.cards === 0 && !p.loading && !p.lock);

// ---------- L1 ◆ the round trip (fail-on-old) ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  const { descs } = await paintRealDay(w);
  const whole = cards(w);
  check('L1 setup: the composed day paints whole through the real rebuild (extRebuildDescs)', whole >= 8 && descs.length >= 8, { cards: whole, descs: descs.length });
  // The tab return, in the field's timing shape: the day
  // fetch answers, the resolution legs hang.
  O.state.tab = 'prayers';
  closeGate();
  const rec = recordPaints(w);
  O.renderPrayersSide();
  await sleep(700);
  rec.stop();
  const first = firstHomePaint(rec.paints);
  check('L1 ◆ ROUND TRIP: the return\u2019s FIRST home paint carries the standing composed set — never the empty set',
    !!first && first.cards === whole && first.cards >= 8, { first, whole, paints: rec.paints.slice(0, 6) });
  check('L1b no paint in the whole return window is the recording\u2019s frame (an empty set with no loading state)',
    !emptyPaint(rec.paints), rec.paints.slice(0, 8));
  openGate();
  const settled = await until(() => (O.state.dayDescs || []).length >= 8 && !loading(w) && !O.state.dayPending642, 15000);
  await sleep(500);
  O.paintPrayersView(O.state.dayPayload); // one standing repaint, as any later settle / navigation paints
  await sleep(200);
  check('L1c after the deferred legs complete, the settled paint is the full set',
    settled && cards(w) === (O.state.dayDescs || []).length && cards(w) >= 8, { cards: cards(w), descs: (O.state.dayDescs || []).length });
  w.close();
}

// ---------- L2 ◆ cold open: loading, never the empty set ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  closeGate();
  const rec = recordPaints(w);
  O.setTab('prayers'); // the real tab entry: setTab -> renderPrayers -> paintMergedContainer -> renderPrayersSide
  await sleep(900);
  rec.stop();
  const first = firstHomePaint(rec.paints);
  check('L2 ◆ COLD OPEN: no composed list stands — the set\u2019s place carries the loading state at the first home paint, not the empty set',
    !!first && first.loading && first.cards === 0 && first.set,
    { first, paints: rec.paints.slice(0, 6) });
  check('L2a no paint in the cold-open window is an empty set without the loading state', !emptyPaint(rec.paints), rec.paints.slice(0, 8));
  openGate();
  const settled = await until(() => (O.state.dayDescs || []).length >= 8 && !loading(w), 15000);
  await sleep(500);
  O.paintPrayersView(O.state.dayPayload);
  await sleep(200);
  check('L2b the first rebuild paints the real set and the loading state clears', settled && cards(w) >= 8 && !loading(w), { cards: cards(w), loading: loading(w) });
  w.close();
}

// ---------- L3 ◆ locked return: the gate substitutes ----------
{
  // Build the vault envelope from John's document, as in
  // harness-v609vault (the client's own opnVaultCreate).
  let envelope = null;
  {
    const w0 = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
    await sleep(400);
    const O0 = w0.__opn;
    O0.opnDoc();
    await O0.opnVaultCreate(PIN, 'RECOVERY-CODE-1');
    envelope = w0.localStorage.getItem(DATA_KEY);
    check('L3 setup: the envelope is built from his real document by the client\u2019s own vault create', !!envelope && JSON.parse(envelope).format === 'orapronobis-personal-data-encrypted');
    w0.close();
  }
  const w = makeWorld(appJs, { [DATA_KEY]: envelope });
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  await sleep(1800);
  const d = w.document;
  check('L3 ◆ LOCKED RETURN: the unlock gate stands; no set and no loading state paints',
    O.opnVaultLocked() === true && !!d.querySelector('[data-p609lock]') && !d.querySelector('[data-p609set]') && !loading(w),
    { lock: !!d.querySelector('[data-p609lock]'), set: !!d.querySelector('[data-p609set]') });
  // A standing composed set must never paint over the gate:
  // seed one directly and repaint the home.
  O.state.composed642 = [{ episodeId: 'seed-1', title: 'Seed', block: 'Morning', available: true }];
  O.state.composedDate642 = '2026-11-21';
  O.state.dayDescs = O.state.composed642;
  if (O.state.dayPayload) O.paintPrayersView(O.state.dayPayload);
  await sleep(300);
  check('L3b with a composed set standing in state, the locked home still paints the GATE alone',
    !!d.querySelector('[data-p609lock]') && !d.querySelector('[data-p609set]') && cards(w) === 0,
    { lock: !!d.querySelector('[data-p609lock]'), set: !!d.querySelector('[data-p609set]'), cards: cards(w) });
  w.close();
}

// ---------- L4 ◆ true empty day settles to its true empty paint ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  // The leg's subject is the SETTLE property, driven
  // directly: a pending build stands for a day whose
  // resolution re-seeds EMPTY standings (no payload tracks,
  // no settings rows, no contents) — its composed set is
  // genuinely empty. (Driven by hand because the real
  // settings pass would stand the Morning slots up: under
  // John's settings no real day is composed-empty, which
  // is exactly why the empty case needs its own drive.)
  O.state.tab = 'prayers'; // the Pray tab's context
  const emptyDay = { presentedDay: '2026-11-22', date: '2026-11-22', dateLabel: '', blocks: [{ block: 'Morning', tracks: [] }], episodes: [], profile: null, readingsSeat: null, additions: [] };
  O.state.dayPayload = emptyDay;
  O.state.prayersView = { kind: 'home' };
  O.state.composed642 = null; O.state.composedDate642 = null;
  O.state.dayDescs = [];
  O.state.dayPending642 = true; // buildDayFromPayload's pending outcome for a day with no composed list standing
  const rec = recordPaints(w);
  O.paintPrayersView(emptyDay);
  await sleep(200);
  rec.stop();
  const first = firstHomePaint(rec.paints);
  check('L4 ◆ before the settle, the empty day\u2019s paint carries the loading state (not a premature empty paint)',
    !!first && first.loading && first.cards === 0, { first, paints: rec.paints.slice(0, 6) });
  O.state.extStanding = []; O.state.ownStanding = []; O.state.extSlots = {}; O.state.ownSlots = {};
  O.state.rebuildGuard642 = false; // buildWithSettings' entry, by hand: the resolution pass has re-seeded (empty) standings
  const descs = O.extRebuildDescs(emptyDay) || [];
  await sleep(150);
  check('L4b ◆ a genuinely empty day settles to its TRUE empty paint — the set stands empty, no loading stands forever',
    descs.length === 0 && !!w.document.querySelector('[data-p609set]') && cards(w) === 0 && !loading(w),
    { descs: descs.length, set: !!w.document.querySelector('[data-p609set]'), loading: loading(w), cardIds: [...w.document.querySelectorAll('[data-p609set] [data-card]')].map((e) => e.getAttribute('data-card')) });
  openGate();
  w.close();
}

console.log('harness-v642:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
