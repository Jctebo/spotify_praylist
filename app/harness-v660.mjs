// harness-v660.mjs — v660: the USCCB readings row missing
//  from the Praylist (production display defect, fix-
//  forward). Two seams (docs/releases/v660.md §2/§3):
//   §3.1 PLACE — the readings seat's composed place is its
//     v549 place (immediately before the Morning Daily
//     Rosary), NOT its selector's position in the stored
//     Morning contents: extRebuildDescs' contents pass no
//     longer stands the seat (placed619.seat never set),
//     so foldDayAdditions runs foldReadingsSeat on both
//     exits. No Rosary standing → no seat (the v549 rule).
//   §3.2 PAINT — resolveReadingsSeat590's settle repaints
//     like its sibling resolvers (extRebuildDescs + if
//     (state.dayPayload) paintPrayersView), so the row's
//     paint is a property of the seat's own settle, not
//     the track-draws side effect.
//   §3.4 LEG 2 — no title code change: the own morning
//     prayer's title must pull through from the podcast
//     episode's produced title via the real ownResolveFeed
//     (L4 is the deciding test).
//
// Legs:
//  L1 (fail-on-old) — place + paint: the seat's fetch is
//     gated last; the seat's draw key is pre-drawn in
//     state.trackDraws before the settle (the draws leg
//     then asks nothing for it and its side-effect repaint
//     never fires). After the gate releases, with NO
//     harness-driven paint: the seat card stands in the
//     painted home, and the painted Morning order reads
//     ext-invitatory · morning-prayer · ext-morning-prayer
//     · daily-readings · daily-rosary ·
//     marian-antiphon-angelus. On the old tree the card is
//     absent (no repaint follows the settle) and the
//     composed seat stands at the tail.
//  L2 — paint set == queue set: the painted Morning cards'
//     keys == the Morning disc queue's keys (discQueue618
//     over a fresh rebuild), identical order.
//  L3 — nothing else moves: Morning + Night descriptor
//     lists diffed old-vs-new (old = git-pinned base
//     8c62190): on a seat day only the seat's position
//     changes; on a no-seat day (contents without the
//     selector) the lists are identical.
//  L4 (Leg 2) — the pull-through, end to end: the real
//     ownResolveFeed (driven by the real build) over
//     fixture feed XML in the production item shape
//     (title "<Name> - <Month D, YYYY>", dated enclosure
//     stem): "Morning Offering (Extended) - November 26,
//     2026" lands exactly "Morning Offering (Extended)" on
//     the descriptor AND the painted row; a second fixture
//     with a different produced name lands that name the
//     same way. Assertions read the expected name FROM the
//     fixture title, never a hardcoded literal.
//  L5 — Rosary-less day: a Morning with no Daily Rosary
//     descriptor standing composes NO seat; the rest of
//     the list is untouched.
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (payload block tracks
//    EMPTY: substance enters via profile contents +
//    settings rows, the field shape).
//  - tests/fixtures-v597/production-source-settings.json —
//    his production source settings (26 sources).
//  - tests/fixtures-v603 (book / novenas / podcasts index /
//    bible-folded).
//  - ~/workspace/projects/ora-pro-nobis/john-personal-data-
//    import-v589.json — his own exported document; the
//    vault envelope is built FROM it by the client's own
//    opnVaultCreate (the v619/v642 pattern).
//  - the daily-readings snapshot entry in its REAL shape
//    ({key 'daily-readings:<date>', title "Daily Mass
//    Reading Podcast for <Month D, YYYY>", url, listened}
//    — title-keyed, NO date fields).
//  - own feed XML in the real item shape (modeled on
//    tests/fixtures-v530/ownfeed-2026-11-18.xml: title ·
//    guid · pubDate · enclosure with the dated stem).
//  - the externals/live payload in the v650 production
//    shape (both office sides whole, incl. backup).
// The day build is the real buildDayFromPayload through
// opnScrubDayPayload (the api() entry's own fold). For L4
// the v597 payload is re-dated to 2026-11-26 — the first
// production day whose morning episode carries the
// "Morning Offering (Extended)" title (v636) — with the
// seat entry + feed items dated the same day, all in
// their production shapes.
//
// Fail-on-old: OPN660_CLIENT=/tmp/v660-base-client.ts
//  (a pristine copy of client.ts from 8c62190) node
//  app/harness-v660.mjs — L1 (and L2/L3's seat-day legs)
//  fail there.
//
// Run: node app/harness-v660.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 600)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(process.env.OPN660_CLIENT || (APP + 'worker/src/client.ts'), 'utf8');
const oldClientSrc = git(['show', '8c62190:app/worker/src/client.ts']); // L3's old tree: the pinned base (v658 ship)
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
const PIN = '2468';
const DATE = '2026-11-21';
const SEAT_KEY = 'daily-readings:' + DATE;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function humanDate(iso) { const p = iso.split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0]; }
function seatEntry(iso) {
  // The real snapshot entry shape: title-keyed, NO date fields.
  return { key: 'daily-readings:' + iso, title: 'Daily Mass Reading Podcast for ' + humanDate(iso), url: 'https://example.invalid/dr.mp3', listened: false };
}
// The externals/live payload in the v650 production shape.
const DO_MP = 'https://do.example/divine-1124-mp.mp3', DO_EP = 'https://do.example/divine-1124-ep.mp3';
const STH_MP = 'https://sth.example/lauds-1124.mp3', STH_EP = 'https://sth.example/vespers-1124.mp3';
const LIVE = { slots: [
  { slotId: 'ext-invitatory', state: 'present', title: 'Invitatory - Divine Office', streamUrl: 'https://do.example/inv.mp3', durationSec: 300, sizeBytes: 1000, source: 'Divine Office', imageUrl: 'https://do.example/logo.jpg' },
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: DO_MP, durationSec: 1091, sizeBytes: 1000000, imageUrl: 'https://do.example/logo.jpg', source: 'Divine Office', backup: { streamUrl: STH_MP, source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours', imageUrl: 'https://sth.example/logo.jpg', durationSec: 1034 } },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: DO_EP, durationSec: 880, sizeBytes: 1000000, imageUrl: 'https://do.example/logo.jpg', source: 'Divine Office', backup: { streamUrl: STH_EP, source: 'Sing the Hours', title: 'Evening Prayer - Sing the Hours', imageUrl: 'https://sth.example/logo.jpg', durationSec: 869 } },
  { slotId: 'ext-office-of-readings', state: 'present', title: 'Office of Readings - Divine Office', streamUrl: 'https://do.example/oor.mp3', durationSec: 900, sizeBytes: 1000, source: 'Divine Office', imageUrl: 'https://do.example/logo.jpg' },
]};
// Own feed XML in the real item shape (fixtures-v530's
// ownfeed shape): title "<Name> - <Month D, YYYY>", the
// dated enclosure stem, a midnight-Chicago pubDate.
const PUBDOW = { '2026-11-21': 'Sat, 21 Nov 2026', '2026-11-26': 'Thu, 26 Nov 2026' };
function feedXml(iso, morningTitle) {
  const items = [
    { title: morningTitle, stem: 'morning-prayer-elevenlabs-' + iso },
    { title: 'Daily Rosary - ' + humanDate(iso), stem: 'daily-rosary-' + iso },
    { title: 'Marian Antiphon - ' + humanDate(iso), stem: 'marian-antiphon-angelus-' + iso },
    { title: 'Daily Reflection - ' + humanDate(iso), stem: 'daily-reflection-' + iso },
  ];
  const its = items.map((it) => '<item><title>' + it.title + '</title><guid isPermaLink="false">' + it.stem + '</guid>'
    + '<pubDate>' + PUBDOW[iso] + ' 00:00:00 -0600</pubDate>'
    + '<enclosure url="https://audio.orapronobis.media/' + it.stem + '.mp3" length="100000" type="audio/mpeg" /></item>').join('');
  return '<?xml version="1.0" encoding="utf-8"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0"><channel><title>Ora Pro Nobis</title>' + its + '</channel></rss>';
}
function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = renderJs(oldClientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v660:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnDoc, opnVaultCreate, opnVaultUnlockWithPin, opnScrubDayPayload, buildDayFromPayload, extRebuildDescs, paintPrayersView, discQueue618, descCardKey, trackKeyOf, resolveReadingsSeat590 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }

// Per-world fetch state: the seat gate + the day/feed
// fixtures this world serves.
let seatGate = null, seatRelease = null;
let worldDate = DATE, worldFeed = feedXml(DATE, 'Morning Prayer - ' + humanDate(DATE));
function routeFetch(u) {
  const respond = (body) => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : ''),
    blob: () => Promise.resolve(new Blob([new Uint8Array(2048)], { type: 'audio/mpeg' })),
  });
  if (u.includes('orapronobis.media/podcast.xml')) return respond(worldFeed);
  if (u.includes('intentions.xml')) return respond('<?xml version="1.0"?><rss><channel></channel></rss>');
  if (u.includes('/api/player/source-settings')) return respond({ sources: SETTINGS597.sources, version: SETTINGS597.version });
  if (u.includes('/api/player/track-draws')) return respond({ ok: false }); // no draws answer: the side-effect repaint never fires
  if (u.includes('/api/player/podcasts')) {
    if (u.includes('series=novenas')) return respond(NOVENAS);
    if (u.includes('series=daily-readings')) {
      const body = { entries: [seatEntry(worldDate)], currentKey: 'daily-readings:' + worldDate };
      if (seatGate) return seatGate.then(() => respond(body));
      return respond(body);
    }
    if (u.includes('series=bible-in-a-year')) return respond(BIBLE);
    if (u.includes('series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); return respond({ entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }); }
    return respond(PODIDX);
  }
  if (u.includes('/api/prayer/book')) return respond(BOOK);
  if (u.includes('/api/player/externals/live')) return respond(LIVE);
  if (u.includes('/api/player/externals/audio')) return respond('');
  if (u.includes('/api/player/day')) return respond(JSON.parse(JSON.stringify(DAY597)));
  return respond({});
}
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  const RealDate = w.Date;
  const fixed = new RealDate('2026-11-21T18:00:00Z').getTime();
  w.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  try { w.URL.createObjectURL = () => 'blob:fake-' + Math.random(); w.URL.revokeObjectURL = () => {}; } catch (e) {}
  try { w.Response = Response; w.Blob = Blob; } catch (e) {}
  try { w.caches = { open: () => Promise.resolve({ put: () => Promise.resolve(), match: () => Promise.resolve(undefined), delete: () => Promise.resolve(true), keys: () => Promise.resolve([]) }), delete: () => Promise.resolve(true) }; } catch (e) {}
  w.fetch = (url) => routeFetch(String(url));
  const fullStore = { 'opn-praylistmode-v604': 'expanded', 'opn-praylistmode-v612-reset': '1', ...(store || {}) };
  Object.keys(fullStore).forEach((k) => w.localStorage.setItem(k, fullStore[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
// The vault envelope from John's document (the client's
// own opnVaultCreate, the v619/v642 pattern).
let envelope = null;
{
  const w0 = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O0 = w0.__opn;
  O0.opnDoc();
  await O0.opnVaultCreate(PIN, 'RECOVERY-CODE-1');
  envelope = w0.localStorage.getItem(DATA_KEY);
  check('V0 the envelope is built from his real document by the client\u2019s own vault create',
    !!envelope && JSON.parse(envelope).format === 'orapronobis-personal-data-encrypted');
  w0.close();
}
async function unlockedWorld(js) {
  const w = makeWorld(js, { [DATA_KEY]: envelope });
  await sleep(400);
  await w.__opn.opnVaultUnlockWithPin(PIN);
  return w;
}
// The real build: buildDayFromPayload through
// opnScrubDayPayload. opts.contentsMorning replaces the
// folded Morning contents (fixture shaping, the v619
// paintRealDay contents pattern); opts.iso re-dates the
// payload (L4's production shape for 2026-11-26).
async function buildRealDay(w, opts) {
  const O = w.__opn;
  const o = opts || {};
  worldDate = o.iso || DATE;
  worldFeed = feedXml(worldDate, o.morningTitle || ('Morning Prayer - ' + humanDate(worldDate)));
  const payload = JSON.parse(JSON.stringify(DAY597));
  if (o.iso) { payload.date = o.iso; payload.presentedDay = o.iso; }
  const day = O.opnScrubDayPayload(payload);
  if (o.contentsMorning) day.profile = Object.assign({}, day.profile, { contents: Object.assign({}, day.profile.contents, { Morning: o.contentsMorning }) });
  O.state.tab = 'prayers';
  O.buildDayFromPayload(day, null);
  return day;
}
const blockIds = (descs, block) => (descs || []).filter((d) => d.block === block).map((d) => d.episodeId);
function paintedBlock(w, block) {
  const out = []; let inB = false;
  w.document.querySelectorAll('[data-p609set] [data-p609sethead], [data-p609set] [data-card]').forEach((el) => {
    if (el.hasAttribute('data-p609sethead')) inB = el.getAttribute('data-p609sethead') === block;
    else if (inB) out.push(el.getAttribute('data-card'));
  });
  return out;
}
function paintedCard(w, key) {
  return w.document.querySelector('[data-p609set] [data-card="' + key + '"]');
}
const EXPECTED_MORNING = ['ext-invitatory', 'morning-prayer', 'ext-morning-prayer', SEAT_KEY, 'daily-rosary', 'marian-antiphon-angelus'];

// ---------- L1 ◆ place + paint (fail-on-old) ----------
let l1Day = null;
{
  const w = await unlockedWorld(appJs);
  const O = w.__opn;
  seatGate = new Promise((r) => { seatRelease = r; });
  const day = await buildRealDay(w);
  l1Day = day;
  const settled = await until(() => (O.state.dayDescs || []).length >= 10 && !O.state.dayPending642, 15000);
  await sleep(800);
  check('L1 setup: the build settles whole WITHOUT the seat (its fetch gated last)',
    settled && !day.readingsSeat && !(O.state.dayDescs || []).some((d) => d.readingsSeat),
    { descs: (O.state.dayDescs || []).length, seat: !!day.readingsSeat });
  check('L1 setup: no seat card stands in the painted home before the settle',
    !paintedCard(w, SEAT_KEY), paintedBlock(w, 'Morning'));
  // The seat's draw key pre-drawn: the draws leg asks
  // nothing for it, so its side-effect repaint never fires.
  const drawKey = O.trackKeyOf({ episodeId: SEAT_KEY, block: 'Morning', kind: 'podcast' });
  O.state.trackDraws = O.state.trackDraws || {};
  O.state.trackDraws[drawKey] = 'Predrawn intention';
  seatRelease(); seatGate = null;
  const painted = await until(() => !!paintedCard(w, SEAT_KEY), 9000);
  await sleep(300);
  check('L1 \u25c6 PAINT: after the seat\u2019s own settle, with NO harness-driven paint, the seat card stands in the painted home',
    painted, paintedBlock(w, 'Morning'));
  check('L1 \u25c6 PLACE: the painted Morning order is Invitatory \u00b7 Morning Prayer \u00b7 Morning Prayer - Sing the Hours \u00b7 USCCB readings \u00b7 Daily Rosary \u00b7 Marian Antiphon',
    JSON.stringify(paintedBlock(w, 'Morning')) === JSON.stringify(EXPECTED_MORNING), paintedBlock(w, 'Morning'));
  // ---------- L2 ◆ paint set == queue set ----------
  const fresh = O.extRebuildDescs(day) || [];
  const queueKeys = O.discQueue618(fresh.filter((d) => d.block === 'Morning')).map((d) => O.descCardKey(d));
  check('L2 \u25c6 the painted Morning cards\u2019 keys == the Morning disc queue\u2019s keys (discQueue618 over a fresh rebuild), identical order',
    JSON.stringify(paintedBlock(w, 'Morning')) === JSON.stringify(queueKeys),
    { painted: paintedBlock(w, 'Morning'), queue: queueKeys });
  w.close();
}

// ---------- L3 ◆ nothing else moves (old-vs-new) ----------
async function listsFor(js, opts) {
  const w = await unlockedWorld(js);
  const O = w.__opn;
  const day = await buildRealDay(w, opts);
  const settled = await until(() => (O.state.dayDescs || []).length >= 10 && !O.state.dayPending642 && !!day.readingsSeat === !(opts && opts.noSeat), 15000);
  await sleep(600);
  const descs = O.state.dayDescs || [];
  const out = { morning: blockIds(descs, 'Morning'), night: blockIds(descs, 'Night'), settled };
  w.close();
  return out;
}
{
  const newSeat = await listsFor(appJs);
  const oldSeat = await listsFor(oldJs);
  const strip = (l) => l.filter((id) => id !== SEAT_KEY);
  check('L3 \u25c6 seat day, old-vs-new: only the seat\u2019s position changes (Morning lists equal once the seat is removed; Night identical)',
    newSeat.settled && oldSeat.settled
    && JSON.stringify(strip(newSeat.morning)) === JSON.stringify(strip(oldSeat.morning))
    && JSON.stringify(newSeat.night) === JSON.stringify(oldSeat.night),
    { newM: newSeat.morning, oldM: oldSeat.morning, newN: newSeat.night, oldN: oldSeat.night });
  check('L3b the seat\u2019s move itself: old stands it at the Morning tail, new stands it immediately before daily-rosary',
    oldSeat.morning[oldSeat.morning.length - 1] === SEAT_KEY
    && newSeat.morning.indexOf(SEAT_KEY) === newSeat.morning.indexOf('daily-rosary') - 1 && newSeat.morning.indexOf(SEAT_KEY) > 0,
    { oldM: oldSeat.morning, newM: newSeat.morning });
  // No-seat day: the folded Morning contents without the selector.
  const probeW = await unlockedWorld(appJs);
  const probeDay = probeW.__opn.opnScrubDayPayload(JSON.parse(JSON.stringify(DAY597)));
  const contentsNoSeat = (probeDay.profile.contents.Morning || []).filter((it) => !(it.kind === 'seat' && it.key === 'daily-readings'));
  probeW.close();
  const newNo = await listsFor(appJs, { contentsMorning: contentsNoSeat, noSeat: true });
  const oldNo = await listsFor(oldJs, { contentsMorning: contentsNoSeat, noSeat: true });
  check('L3c \u25c6 no-seat day: the Morning + Night descriptor lists are identical old-vs-new, and no seat stands',
    newNo.settled && oldNo.settled
    && JSON.stringify(newNo.morning) === JSON.stringify(oldNo.morning)
    && JSON.stringify(newNo.night) === JSON.stringify(oldNo.night)
    && !newNo.morning.includes(SEAT_KEY),
    { newM: newNo.morning, oldM: oldNo.morning });
}

// ---------- L4 ◆ Leg 2: the title pull-through, end to end ----------
async function legTitle(feedTitle) {
  const w = await unlockedWorld(appJs);
  const O = w.__opn;
  const day = await buildRealDay(w, { iso: '2026-11-26', morningTitle: feedTitle });
  const settled = await until(() => {
    const d = (O.state.dayDescs || []).find((x) => x.episodeId === 'morning-prayer');
    return d && d.available && !O.state.dayPending642;
  }, 15000);
  await sleep(600);
  const desc = (O.state.dayDescs || []).find((x) => x.episodeId === 'morning-prayer');
  const card = paintedCard(w, 'morning-prayer');
  const rowTitle = card && card.querySelector('h3') ? card.querySelector('h3').textContent : null;
  const out = { settled, descTitle: desc ? desc.title : null, rowTitle };
  w.close();
  return out;
}
{
  const expectedFrom = (t) => t.slice(0, t.lastIndexOf(' - ')); // the fixture's own produced name, read off the fixture title
  const t1 = 'Morning Offering (Extended) - November 26, 2026';
  const r1 = await legTitle(t1);
  check('L4 \u25c6 the real ownResolveFeed over the production-shaped feed: the episode\u2019s produced name lands exactly on the morning-prayer descriptor AND the painted row',
    r1.settled && r1.descTitle === expectedFrom(t1) && r1.rowTitle === expectedFrom(t1), r1);
  const t2 = 'Morning Prayer (Live Recording) - November 26, 2026';
  const r2 = await legTitle(t2);
  check('L4b \u25c6 a differently-titled fixture episode lands ITS different name the same way (no constant in the path)',
    r2.settled && r2.descTitle === expectedFrom(t2) && r2.rowTitle === expectedFrom(t2) && expectedFrom(t2) !== expectedFrom(t1), r2);
}

// ---------- L5 ◆ Rosary-less day: no seat ----------
{
  const probeW = await unlockedWorld(appJs);
  const probeDay = probeW.__opn.opnScrubDayPayload(JSON.parse(JSON.stringify(DAY597)));
  const contentsNoRosary = (probeDay.profile.contents.Morning || []).filter((it) => !(it.kind === 'source' && it.key === 'daily-rosary'));
  probeW.close();
  const r = await listsFor(appJs, { contentsMorning: contentsNoRosary });
  check('L5 \u25c6 a Morning with no Daily Rosary descriptor standing composes NO seat, and the rest of the list is untouched',
    r.settled && !r.morning.includes(SEAT_KEY) && !r.morning.includes('daily-rosary')
    && JSON.stringify(r.morning) === JSON.stringify(EXPECTED_MORNING.filter((id) => id !== SEAT_KEY && id !== 'daily-rosary')),
    r.morning);
}

console.log('harness-v660:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
