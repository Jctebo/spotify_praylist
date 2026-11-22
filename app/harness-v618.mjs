// harness-v618.mjs — v618: John's correction on the
//  v616/v617 block play disc (2026-11-22 10:30 CT): "The
//  play disk should only play unplayed prayers" — the
//  Praylist head disc's queue is the block's UNPLAYED
//  tracks only, through the ONE predicate the v615 head
//  count reads (opnTrackUnplayed615: available tracks
//  only; podcast → its listened flag; every other
//  descriptor → the played store on the presented date,
//  occurrence-aware through isPlayedDesc). A fully played
//  block queues NOTHING: its greyed disc stays tappable
//  and a tap is a complete no-op (no queue, no state
//  change) — v616's "a greyed disc replays the block in
//  full" (queueBuild's §2.4 fallback) is superseded FOR
//  THE DISC ONLY; queueBuild stands untouched for its
//  other consumers (Continue · the block pages' Play All).
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (the day his phone
//    served): Morning stands [ext-invitatory ·
//    morning-prayer · ext-morning-prayer · the
//    daily-readings podcast · daily-rosary ·
//    marian-antiphon], Midday stands [marian-antiphon-
//    midday · ext-midday-prayer] — the Q1/Q2/Q3/Q5/Q6
//    blocks are these real tracks, marked through the
//    client's own writePlayed / dayPositions fold.
//  - tests/fixtures-v597/production-source-settings.json —
//    his production source settings (v8, 26 sources).
//  - ~/workspace/projects/ora-pro-nobis/john-personal-data-
//    import-v589.json — his own exported document.
//  - An unavailable track is a slot settled 'missing' in
//    state.extSlots — the production missing-slot state
//    (extSlotTrack reads available from it), never an
//    invented descriptor shape.
//  - The Episodes tail is production-shaped from the day
//    payload's own episodes seam (the v616 P7 recipe).
//  - Q7's occurrence copies are the v610 world
//    (harness-v616's H6 / harness-v610's D2): the Salesian
//    Morning contents naming ext-morning-prayer TWICE, so
//    the fold emits two copies, the second stamped _occ 1.
// Direct start calls are wrapped in drive() (the v617
//  recipe): jsdom's HTMLMediaElement.play() returns
//  undefined, so the client's play().catch throws inside
//  the element tail when a start is invoked from Node
//  rather than from a DOM event; every bookkeeping seat
//  the legs assert runs ahead of that tail.
// The old-client ref is the v617 tree (6bebff3), pinned by
//  commit: the OA legs must FAIL there (queueBuild's
//  fully-played fallback replays the block).
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
const oldClientSrc = git(['show', '6bebff3:app/worker/src/client.ts']); // fail-on-old pin: the v617 tree
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const QUEUE_KEY = 'opn-queue-v355';
const DATE = '2026-11-21';

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
check('T0b the v618 seats stand in the client: opnTrackUnplayed615 (the ONE unplayed predicate), discQueue618 beside queueBuild, and the [data-queue] handler\u2019s p615disc branch',
  clientSrc.includes('function opnTrackUnplayed615(t, d)')
  && clientSrc.includes('function discQueue618(descs)')
  && clientSrc.includes("classList.contains('p615disc')")
  && clientSrc.includes('if (opnTrackUnplayed615(t, d)) unplayed++'));
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v618:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnLocalApi, opnDoc, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, resolveReadingsSeat590, resolveProfileCourses590, markCompleted, writePlayed, isPlayedDesc, refreshPlayedChrome, opnCounts615, opnTrackUnplayed615, discQueue618, startQueue, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const OLD_HOOK = '\n;window.__opn = { state, opnLocalApi, opnDoc, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, resolveReadingsSeat590, resolveProfileCourses590, markCompleted, writePlayed, isPlayedDesc, refreshPlayedChrome, opnCounts615, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };
function fetchStub(url) {
  const u = String(url);
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
function makeWorld(js, store, hook) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + (hook || HOOK);
  w.document.body.appendChild(s);
  return w;
}
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
// paintRealDay (the v616/v617 recipe) + two seams the legs
// need: mutate(w) runs after buildStanding (a slot settled
// 'missing' stands from there), and contents overrides the
// folded day's profile contents (the v610 Q7 world).
async function paintDay618(w, opts) {
  const O = w.__opn;
  const o = opts || {};
  buildStanding(w);
  if (o.mutate) o.mutate(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(o.daySrc || DAY597)));
  if (o.contents) day.profile = Object.assign({}, day.profile, { contents: o.contents });
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
const byId = (descs, id) => (descs || []).find((d) => d.episodeId === id);
const discOf = (d, block) => d.querySelector('[data-p615disc="' + block + '"]');
const countOf = (d, block) => { const el = d.querySelector('[data-p615count="' + block + '"]'); return el ? el.textContent : null; };
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
const queueIds = (O) => (O.state.queue || []).map((t) => t.episodeId);
const missSlot = (slotId, title) => (w) => { w.__opn.state.extSlots[slotId] = { state: 'missing', title, source: 'Divine Office' }; };

// ---------- Q1 ◆ a mixed block: the disc queues the unplayed AVAILABLE tracks only ----------
// Morning stands together: ext-invitatory PLAYED ·
// morning-prayer IN-PROGRESS (a position mark, unplayed) ·
// ext-morning-prayer UNAVAILABLE-and-unplayed (its slot
// settled missing) · the daily-readings podcast UNPLAYED ·
// daily-rosary + marian-antiphon UNPLAYED.
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay618(w, { mutate: missSlot('ext-morning-prayer', 'Morning Prayer') });
  const morning = (O.extRebuildDescs(O.state.dayPayload) || []).filter((x) => x.block === 'Morning');
  const unavail = byId(morning, 'ext-morning-prayer');
  check('Q1a the mixed block stands: Morning rebuilds with ext-morning-prayer UNAVAILABLE (settled missing) beside five available tracks',
    morning.length === 6 && !!unavail && unavail.available === false,
    { morning: morning.map((t) => ({ id: t.episodeId, av: t.available })) });
  O.writePlayed('ext-invitatory', DATE, 'marked', 'Morning', 0);
  O.state.dayPayload.dayPositions = { 'morning-prayer': 222.7 }; // the in-progress mark (the v617 E1 recipe)
  const built = O.discQueue618(morning).map((t) => t.episodeId);
  // v619 REVERSAL (recorded in harness-v619.mjs + docs/releases/v619.md): the readings seat now stands at its CONTENTS position (the tail of Morning's contents list) instead of the v549 before-rosary anchor — Q1b/Q1c expectations updated for that one move; the unplayed/available filtering they test is unchanged.
  check('Q1b the disc\u2019s build through the ONE predicate: unplayed AVAILABLE only, in standing order — the in-progress track stands in it; the played and the unavailable stand out',
    JSON.stringify(built) === JSON.stringify(['morning-prayer', 'daily-rosary', 'marian-antiphon', 'daily-readings:2026-11-21']),
    { built });
  click(w, discOf(d, 'Morning'));
  await sleep(200);
  check('Q1c ◆ disc tap: state.queue == the unplayed AVAILABLE tracks only, in standing order',
    JSON.stringify(queueIds(O)) === JSON.stringify(['morning-prayer', 'daily-rosary', 'marian-antiphon', 'daily-readings:2026-11-21'])
    && !!O.state.current && O.state.current.episodeId === 'morning-prayer',
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId });
  w.close();
}

// ---------- Q2 ◆ a fully played block: grey disc, a tap changes NOTHING ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay618(w);
  O.writePlayed('marian-antiphon-midday', DATE, 'marked', 'Midday', 0);
  O.writePlayed('ext-midday-prayer', DATE, 'marked', 'Midday', 0);
  await sleep(60);
  const disc = discOf(d, 'Midday');
  const snapBefore = w.localStorage.getItem(QUEUE_KEY);
  check('Q2a the fully played block\u2019s disc stands grey (class "all", count "0") — the v616 rule, unchanged',
    !!disc && disc.classList.contains('all') && countOf(d, 'Midday') === '0',
    { cls: disc && disc.getAttribute('class'), count: countOf(d, 'Midday') });
  click(w, disc);
  await sleep(200);
  check('Q2b ◆ the greyed disc\u2019s tap plays NOTHING: state.queue empty, no current, no queue snapshot written (no state change)',
    (O.state.queue || []).length === 0 && !O.state.current
    && w.localStorage.getItem(QUEUE_KEY) === snapBefore,
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId, snapBefore, snapAfter: w.localStorage.getItem(QUEUE_KEY) });
  w.close();
}

// ---------- Q3 ◆ a block whose only unplayed track is unavailable: nothing plays ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay618(w, { mutate: missSlot('ext-midday-prayer', 'Midday Prayer') });
  O.writePlayed('marian-antiphon-midday', DATE, 'marked', 'Midday', 0); // the block's one AVAILABLE track stands played
  click(w, discOf(d, 'Midday'));
  await sleep(200);
  check('Q3 ◆ the only unplayed track is unavailable: the tap builds an empty queue — nothing plays (no queue, no current)',
    (O.state.queue || []).length === 0 && !O.state.current,
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId });
  w.close();
}

// ---------- Q4 ◆ the Episodes tail disc filters the same way ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const daySrc = JSON.parse(JSON.stringify(DAY597));
  daySrc.episodes = [
    { episodeId: 'tail-1', title: 'Tail episode one', streamUrl: 'https://example.invalid/t1.mp3', available: true, durationS: 30 },
    { episodeId: 'tail-2', title: 'Tail episode two', streamUrl: 'https://example.invalid/t2.mp3', available: true, durationS: 30 },
    { episodeId: 'tail-3', title: 'Tail episode three', streamUrl: 'https://example.invalid/t3.mp3', available: true, durationS: 30 },
  ];
  const { descs } = await paintDay618(w, { daySrc });
  const tail = (descs || []).filter((x) => !x.block);
  O.writePlayed('tail-1', DATE, 'marked', '', 0);
  click(w, discOf(d, 'Episodes'));
  await sleep(200);
  check('Q4a ◆ the Episodes tail disc: the played tail track stands OUT of its queue — the unplayed tail plays in order',
    tail.length === 3 && JSON.stringify(queueIds(O)) === JSON.stringify(['tail-2', 'tail-3']),
    { tail: tail.map((t) => t.episodeId), queue: queueIds(O) });
  O.writePlayed('tail-2', DATE, 'marked', '', 0);
  O.writePlayed('tail-3', DATE, 'marked', '', 0);
  O.state.queue = []; O.state.queueIdx = -1; O.state.current = null;
  const snapBefore = w.localStorage.getItem(QUEUE_KEY);
  click(w, discOf(d, 'Episodes'));
  await sleep(200);
  check('Q4b ◆ a fully played tail queues NOTHING on tap (no queue, no current, no snapshot written)',
    (O.state.queue || []).length === 0 && !O.state.current && w.localStorage.getItem(QUEUE_KEY) === snapBefore,
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId });
  w.close();
}

// ---------- Q5 ◆ resume stands: the filtered queue's in-progress head resumes at its mark ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay618(w);
  O.writePlayed('ext-invitatory', DATE, 'marked', 'Morning', 0); // played: the filter drops it, morning-prayer heads the build
  O.state.dayPayload.dayPositions = { 'morning-prayer': 222.7 };
  click(w, discOf(d, 'Morning'));
  await sleep(120);
  check('Q5 ◆ the filtered queue\u2019s head is the in-progress track and its start carries its mark through the standing v617 seam: pendingResume seats at floor(222.7) = 222 for morning-prayer',
    queueIds(O)[0] === 'morning-prayer' && !!O.state.current && O.state.current.episodeId === 'morning-prayer'
    && !!O.state.pendingResume && O.state.pendingResume.episodeId === 'morning-prayer' && O.state.pendingResume.positionS === 222,
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId, pendingResume: O.state.pendingResume });
  w.close();
}

// ---------- Q6 ◆ the pause toggle stands ----------
// A queue sounding (startQueue driven, then the element
// transport standing PLAYING — audio.paused shadowed false,
// the transportPlaying seam's own read), then ANOTHER
// block's disc tap with a non-empty build: the transport
// pauses and no new queue replaces the sounding one.
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay618(w);
  const head = byId(descs, 'morning-prayer');
  drive(() => O.startQueue([head]));
  await sleep(80);
  const audio = w.document.getElementById('audio');
  try { Object.defineProperty(audio, 'paused', { value: false, configurable: true }); } catch (e) {}
  let pauses = 0;
  audio.pause = () => { pauses++; };
  check('Q6a the sounding queue stands: queue [morning-prayer], current set, transport reading playing',
    JSON.stringify(queueIds(O)) === JSON.stringify(['morning-prayer']) && !!O.state.current && audio.paused === false,
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId, paused: audio.paused });
  click(w, discOf(d, 'Evening')); // Evening stands fully unplayed — its disc build is non-empty
  await sleep(200);
  check('Q6b ◆ the pause toggle stands: the tap PAUSES the transport (one pause call) and no new queue replaces the sounding one',
    pauses === 1 && JSON.stringify(queueIds(O)) === JSON.stringify(['morning-prayer'])
    && !!O.state.current && O.state.current.episodeId === 'morning-prayer',
    { pauses, queue: queueIds(O), current: O.state.current && O.state.current.episodeId });
  w.close();
}

// ---------- Q7 ◆ occurrence copies (the v610 world) ----------
// The Salesian Morning contents name ext-morning-prayer
// twice around ext-invitatory: the fold emits copy 0 and
// copy 1 (_occ 1). Copy 0 marked played alone — the disc
// queues copy 1 alone, under its occurrence identity.
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const contents = { Morning: [{ kind: 'source', key: 'ext-morning-prayer' }, { kind: 'source', key: 'ext-invitatory' }, { kind: 'source', key: 'ext-morning-prayer' }] };
  const { descs } = await paintDay618(w, { contents });
  const copies = (descs || []).filter((x) => x.episodeId === 'ext-morning-prayer' && x.block === 'Morning');
  check('Q7a the v610 world stands: two copies of the one hour stand in Morning, the second stamped _occ 1',
    copies.length === 2 && !copies[0]._occ && copies[1]._occ === 1,
    copies.map((x) => ({ occ: x._occ || 0 })));
  O.writePlayed('ext-morning-prayer', DATE, 'marked', 'Morning', 0); // copy 0's mark only (occurrence key #0)
  click(w, discOf(d, 'Morning'));
  await sleep(200);
  const queued = (O.state.queue || []).filter((t) => t.episodeId === 'ext-morning-prayer');
  check('Q7b ◆ disc tap queues copy 1 ALONE under its occurrence identity (not copy 0, not both)',
    queued.length === 1 && queued[0]._occ === 1,
    { queue: (O.state.queue || []).map((t) => ({ id: t.episodeId, occ: t._occ || 0 })) });
  w.close();
}

// ---------- OA ◆ fail-on-old (the v617 tree, 6bebff3) ----------
{
  const w = makeWorld(oldJs, { [DATA_KEY]: JSON.stringify(JOHN) }, OLD_HOOK);
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay618(w);
  O.writePlayed('marian-antiphon-midday', DATE, 'marked', 'Midday', 0);
  O.writePlayed('ext-midday-prayer', DATE, 'marked', 'Midday', 0);
  click(w, discOf(d, 'Midday'));
  await sleep(200);
  check('OA1 ◆ fail-on-old: on the v617 client Q2 FAILS — the fully played block\u2019s disc REPLAYS the block in full (queueBuild\u2019s §2.4 fallback), where v618 queues nothing',
    JSON.stringify(queueIds(O)) === JSON.stringify(['marian-antiphon-midday', 'ext-midday-prayer']),
    { queue: queueIds(O) });
  w.close();
}
{
  const w = makeWorld(oldJs, { [DATA_KEY]: JSON.stringify(JOHN) }, OLD_HOOK);
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay618(w, { mutate: missSlot('ext-midday-prayer', 'Midday Prayer') });
  O.writePlayed('marian-antiphon-midday', DATE, 'marked', 'Midday', 0);
  click(w, discOf(d, 'Midday'));
  await sleep(200);
  check('OA2 ◆ fail-on-old: on the v617 client Q3 FAILS — the fallback hands the whole block over and the PLAYED track starts, where v618 plays nothing',
    queueIds(O).length > 0 && !!O.state.current && O.state.current.episodeId === 'marian-antiphon-midday',
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId });
  w.close();
}

console.log('harness-v618:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
