// harness-v619.mjs — v619: the contents-order fix-forward
//  (John, 2026-11-22 11:35 CT: "Editing the order does not
//  edit the olay order" / "I moved one up and play order
//  did not stick"). Diagnosis: the stored contents order
//  survives end to end (opn604 drag -> opnWrite604 ->
//  standing contents / today layer -> day.profile.contents)
//  but extRebuildDescs emitted each block in FIXED KIND
//  GROUPS (sources, then courses, then day, then episodes;
//  contents prayers only as tail additions through the
//  fold's weave; the readings seat only at its v549
//  before-rosary anchor), so any drag crossing a kind
//  boundary changed nothing in play order. Fix: with
//  contents standing for a block, ONE PASS over the stored
//  contents list emits every contents-driven descriptor at
//  its item's own position (sources with the v590 gate +
//  v610 occurrence discipline unchanged, course/day/episode
//  legs in place, contents prayers through their addition
//  descriptor with the weave skipping the placed record,
//  the Morning readings seat at its contents position with
//  foldReadingsSeat skipping + its no-rosary guard kept).
//  No contents entry for a block: standing emission
//  byte-for-byte.
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (the day his phone served).
//  - tests/fixtures-v597/production-source-settings.json —
//    his production source settings (v8, 26 sources).
//  - ~/workspace/projects/ora-pro-nobis/john-personal-data-
//    import-v589.json — his own exported document; the
//    vault envelope in these legs is built FROM it by the
//    client's own opnVaultCreate (the harness-v609vault
//    recipe), so the world carries his real document under
//    a real envelope, not a hand-shaped one. His real
//    contents after the standing migrations: Night =
//    [source daily-reflection, source ext-night-prayer,
//    course bible-in-a-year, course exorcist-files],
//    Morning = [source ext-invitatory, source
//    morning-prayer, source ext-usccb-readings (not
//    standing), source ext-morning-prayer, source
//    daily-rosary, source marian-antiphon, seat
//    daily-readings] — the cross-kind mixes the legs move.
//  - tests/fixtures-v603/book.json (the prayer book — the
//    prayer leg adds 'our-father' through the editor's own
//    Add seam: opnMaterialize604 push + opnWrite604, the
//    exact calls the Add ladder's add act makes) ·
//    podcasts-index.json · bible-folded.json (the
//    production Bible in a Year payload, currentKey
//    biy:day-322).
// Editor legs perform John's exact act through the real
//  editor path: enter Edit (scope today by default, the
//  banner's button flips to standing), opnDragOver604 on
//  opn604.lists, opnWrite604 — in BOTH scopes.
// Fail-on-old: the OA legs run the same acts on the base
//  tree (0a6f7e1, pinned by commit) and must NOT carry the
//  moves; the whole harness also fails on a pristine
//  checkout of the base (see docs/releases/v619.md).
// Reversed regression legs (the ONLY ones updated, each
//  with the reversal comment at the leg): harness-v618
//  Q1b/Q1c and harness-v609vault F8b — both encoded the
//  readings seat at the v549 before-rosary anchor; under
//  v619 the seat stands at its contents position.
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
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrc = git(['show', '0a6f7e1:app/worker/src/client.ts']); // fail-on-old pin: the base tree (v618 ship)
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const PIN = '2468';
const DATE = '2026-11-21';
const FM_GUID = '59396eda-6713-4156-8c5b-6d1aaded641b'; // the Fr. Mike feed's real episode key (tests/fixtures-v500/feeds-frmike-2026-11-17.xml, 'The Final Exam: The Second Question', 11/15/26)
const FM_PIN = 'fr-mike-homilies|' + FM_GUID;

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
check('T0b the v619 seats stand in the client: the contents pass (placed619), the weave skip in foldDayAdditions, the one seat construction (readingsSeatDesc549)',
  clientSrc.includes('var placed619 = { adds: {}, seat: false }')
  && clientSrc.includes('function readingsSeatDesc549(seat)')
  && clientSrc.includes('placedAdds619[a.block')
  && clientSrc.includes('seatPlaced619 ? descs : foldReadingsSeat(descs, seat)'));
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v619:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opn604: (typeof opn604 !== "undefined" ? opn604 : null), opnLocalApi, opnDoc, opnVaultLocked, opnVaultCreate, opnVaultUnlockWithPin, opnRawKeyB64: function () { return opnVaultRawKey ? opnB64(opnVaultRawKey) : null; }, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, resolveReadingsSeat590, resolveProfileCourses590, resolveExegesisDay611, resolveProfileEpisodes614, adoptDayAdditions, opnMaterialize604, opnDragOver604, opnWrite604, discQueue618, sectionQueueFrom, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' };
  else if (u.includes('/api/player/podcasts?series=fr-mike-homilies')) body = { series: 'fr-mike-homilies', entries: [{ key: FM_GUID, label: 'Nov 15, 2026', title: 'The Final Exam: The Second Question', url: 'https://example.invalid/fm.mp3', listened: false }], currentKey: FM_GUID };
  else if (u.includes('/api/player/podcasts?series=bible-in-a-year')) body = BIBLE;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { series: sk, entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js, store, opts) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  if (opts && opts.fakeDate) {
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
  return w;
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
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
// The production call order (buildDayFromPayload): fold
// the payload, adopt its additions, resolve seat/courses/
// day/episodes, then the descriptor build.
async function paintRealDay(w, opts) {
  const O = w.__opn;
  const o = opts || {};
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(o.daySrc || DAY597)));
  if (o.contents) day.profile = Object.assign({}, day.profile, { contents: o.contents });
  O.state.dayPayload = day;
  O.adoptDayAdditions(day.presentedDay || day.date, day.additions);
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  if (typeof O.resolveExegesisDay611 === 'function') { O.resolveExegesisDay611(day); await sleep(200); }
  if (typeof O.resolveProfileEpisodes614 === 'function') { O.resolveProfileEpisodes614(day); await sleep(350); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(150);
  return { day, descs };
}
const blockIds = (descs, block) => (descs || []).filter((d) => d.block === block).map((d) => d.episodeId);
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }

// ---------- the vault envelope from John's document ----------
let envelope = null;
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  O.opnDoc();
  await O.opnVaultCreate(PIN, 'RECOVERY-CODE-1');
  envelope = w.localStorage.getItem(DATA_KEY);
  const parsed = JSON.parse(envelope);
  check('V0 the envelope is built from his real document by the client\u2019s own vault create', parsed && parsed.format === 'orapronobis-personal-data-encrypted' && !!parsed.wraps);
  w.close();
}
async function unlockedWorld(js, env) {
  const w = makeWorld(js, { [DATA_KEY]: env || envelope }, { fakeDate: '2026-11-21T18:00:00Z' });
  await sleep(400);
  await w.__opn.opnVaultUnlockWithPin(PIN);
  return w;
}
async function enterEdit(w, scope) {
  const O = w.__opn, d = w.document;
  click(w, d.querySelector('[data-p607edit]'));
  const stood = await until(() => d.querySelector('[data-p604erow]'), 9000);
  if (scope === 'standing') { click(w, d.querySelector('[data-p604change]')); await sleep(400); }
  return stood && O.opn604.scope === scope;
}
// John's drag act, through the editor's own seams: the
// drag mutates opn604.lists, the write lands it at once.
async function dragAndWrite(w, block, dragId, targetId) {
  const O = w.__opn;
  O.opnDragOver604(block, dragId, targetId);
  await O.opnWrite604(block);
  await sleep(1200); // the write's profileRebuild settles; the leg then rebuilds from the stored document itself
}

// ---------- E1 ◆ STANDING scope: course above source (Night) ----------
async function legStandingCourse(js) {
  const w = await unlockedWorld(js);
  const O = w.__opn;
  await paintRealDay(w);
  const stood = await enterEdit(w, 'standing');
  const listBefore = (O.opnMaterialize604('Night') || []).map((it) => it.kind + ':' + it.key);
  await dragAndWrite(w, 'Night', 'course:bible-in-a-year', 'source:daily-reflection');
  const { descs } = await paintRealDay(w);
  const night = blockIds(descs, 'Night');
  const disc = O.discQueue618((descs || []).filter((d) => d.block === 'Night')).map((d) => d.episodeId);
  const sect = (O.sectionQueueFrom(descs, 'ext-night-prayer') || []).map((d) => d.episodeId);
  w.close();
  return { stood, listBefore, night, disc, sect };
}
{
  const r = await legStandingCourse(appJs);
  check('E1a the editor stands (standing scope) over his real Night list [source, source, course, course]',
    r.stood && JSON.stringify(r.listBefore) === JSON.stringify(['source:daily-reflection', 'source:ext-night-prayer', 'course:bible-in-a-year', 'course:exorcist-files']), r.listBefore);
  check('E1b \u25c6 STANDING drag, course above source: the composed Night play order CARRIES the move (course first)',
    JSON.stringify(r.night) === JSON.stringify(['biy:day-1', 'daily-reflection', 'ext-night-prayer', 'exorcist-files:ep-1']), r.night);
  check('E1c \u25c6 the block disc queue carries the move too (discQueue618 over the rebuilt descs, same order)',
    JSON.stringify(r.disc) === JSON.stringify(r.night), r.disc);
  check('E1d \u25c6 a tap queue from mid-block carries it too (sectionQueueFrom from ext-night-prayer: itself, then the exorcist course)',
    JSON.stringify(r.sect) === JSON.stringify(['ext-night-prayer', 'exorcist-files:ep-1']), r.sect);
}

// ---------- E2 ◆ TODAY scope: course above source (Night, the other course) ----------
{
  const w = await unlockedWorld(appJs);
  const O = w.__opn;
  await paintRealDay(w);
  const stood = await enterEdit(w, 'today');
  check('E2a the editor stands on TODAY scope (the entry default)', stood && O.opn604.scope === 'today');
  await dragAndWrite(w, 'Night', 'course:exorcist-files', 'source:ext-night-prayer');
  const { descs } = await paintRealDay(w);
  const night = blockIds(descs, 'Night');
  check('E2b \u25c6 TODAY drag, course above source: the composed Night play order CARRIES the move',
    JSON.stringify(night) === JSON.stringify(['daily-reflection', 'exorcist-files:ep-1', 'ext-night-prayer', 'biy:day-1']), night);
  const layer = (O.opnDoc().sections.profiles.todayEdits || {})[DATE];
  const layerNight = layer && layer.contents && layer.contents.Night ? layer.contents.Night.map((it) => it.kind + ':' + it.key) : null;
  check('E2c the today write landed in the today layer, carrying the moved Night order verbatim',
    JSON.stringify(layerNight) === JSON.stringify(['source:daily-reflection', 'course:exorcist-files', 'source:ext-night-prayer', 'course:bible-in-a-year']), layerNight);
  w.close();
}

// ---------- E3 ◆ STANDING scope: a prayer moved above a source (Night) ----------
{
  const w = await unlockedWorld(appJs);
  const O = w.__opn;
  await paintRealDay(w);
  await enterEdit(w, 'standing');
  // The Add ladder's own add act (opnMaterialize604 push +
  // opnWrite604): the book prayer 'our-father' joins Night.
  O.opnMaterialize604('Night').push({ kind: 'prayer', key: 'our-father' });
  await O.opnWrite604('Night');
  await sleep(1200);
  await dragAndWrite(w, 'Night', 'prayer:our-father', 'source:ext-night-prayer');
  const { descs } = await paintRealDay(w);
  const night = blockIds(descs, 'Night');
  const count = night.filter((id) => id === 'prayer:our-father:en').length;
  check('E3 \u25c6 STANDING: a contents prayer dragged above a source stands AT its contents position in play order (not the block tail), and stands exactly once',
    JSON.stringify(night) === JSON.stringify(['daily-reflection', 'prayer:our-father:en', 'ext-night-prayer', 'biy:day-1', 'exorcist-files:ep-1']) && count === 1,
    { night, count });
  w.close();
}

// ---------- E4 ◆ TODAY scope: the readings seat dragged to the head (Morning) ----------
{
  const w = await unlockedWorld(appJs);
  const O = w.__opn;
  const before = await paintRealDay(w);
  const morningBefore = blockIds(before.descs, 'Morning');
  await enterEdit(w, 'today');
  await dragAndWrite(w, 'Morning', 'seat:daily-readings', 'source:ext-invitatory');
  const { descs } = await paintRealDay(w);
  const morning = blockIds(descs, 'Morning');
  const seatCount = (descs || []).filter((d) => d.readingsSeat).length;
  check('E4a before the drag, the seat stands at its stored contents position (the tail of Morning\u2019s contents list)',
    morningBefore[morningBefore.length - 1] === 'daily-readings:2026-11-21', morningBefore);
  check('E4b \u25c6 TODAY drag, seat to the head: the seat stands FIRST in Morning at its dragged contents position, exactly once in the day',
    morning[0] === 'daily-readings:2026-11-21' && seatCount === 1
    && JSON.stringify(morning) === JSON.stringify(['daily-readings:2026-11-21', 'ext-invitatory', 'morning-prayer', 'ext-morning-prayer', 'daily-rosary', 'marian-antiphon']),
    { morning, seatCount });
  w.close();
}

// ---------- E5 ◆ episode above course (Night, composition over his contents shape) ----------
{
  const w = await unlockedWorld(appJs);
  const O = w.__opn;
  const contents = { Night: [
    { kind: 'episode', key: 'bible-in-a-year|biy:day-2' },
    { kind: 'course', key: 'exorcist-files' },
    { kind: 'source', key: 'daily-reflection' },
    { kind: 'source', key: 'ext-night-prayer' },
    { kind: 'course', key: 'bible-in-a-year' },
  ] };
  const { descs } = await paintRealDay(w, { contents });
  const night = blockIds(descs, 'Night');
  check('E5 \u25c6 episode above course above source: the pinned episode stands at its contents position, ahead of the course and the sources',
    JSON.stringify(night) === JSON.stringify(['biy:day-2', 'exorcist-files:ep-1', 'daily-reflection', 'ext-night-prayer', 'biy:day-1']), night);
  w.close();
}

// ---------- G1 ◆ guard: a same-kind move still sticks ----------
{
  const w = await unlockedWorld(appJs);
  const contents = { Morning: [
    { kind: 'source', key: 'marian-antiphon' }, { kind: 'source', key: 'daily-rosary' },
    { kind: 'source', key: 'morning-prayer' }, { kind: 'source', key: 'ext-invitatory' },
    { kind: 'source', key: 'ext-morning-prayer' },
  ] };
  const { descs } = await paintRealDay(w, { contents });
  check('G1 guard: a same-kind (source above source) reorder composes in contents order, as before',
    JSON.stringify(blockIds(descs, 'Morning')) === JSON.stringify(['marian-antiphon', 'daily-rosary', 'morning-prayer', 'ext-invitatory', 'ext-morning-prayer']),
    blockIds(descs, 'Morning'));
  w.close();
}

// ---------- G2 ◆ guard: a block with NO contents entry composes as before ----------
{
  const w = await unlockedWorld(appJs);
  const { descs } = await paintRealDay(w, { contents: {} });
  check('G2 guard: no contents entry for Midday \u2014 the standing merged sortOrder emission stands ([marian-antiphon-midday, ext-midday-prayer])',
    JSON.stringify(blockIds(descs, 'Midday')) === JSON.stringify(['marian-antiphon-midday', 'ext-midday-prayer']),
    blockIds(descs, 'Midday'));
  w.close();
}

// ---------- G3 ◆ guard: a hand-added per-day prayer (not in contents) keeps its anchor weave ----------
{
  const w = await unlockedWorld(appJs);
  const daySrc = JSON.parse(JSON.stringify(DAY597));
  daySrc.additions = [{ block: 'Night', slug: 'hail-mary', lang: 'en', afterId: 'daily-reflection', kind: 'prayer', ref: null }];
  const { descs } = await paintRealDay(w, { daySrc });
  const night = blockIds(descs, 'Night');
  check('G3 guard: a per-day addition naming no contents prayer weaves at its anchor (directly after daily-reflection), exactly once',
    night.filter((id) => id === 'prayer:hail-mary:en').length === 1
    && night.indexOf('prayer:hail-mary:en') === night.indexOf('daily-reflection') + 1,
    night);
  w.close();
}

// ---------- G4 ◆ guard: v610 duplicate office hours at their two contents positions ----------
{
  const w = await unlockedWorld(appJs);
  const contents = { Morning: [
    { kind: 'source', key: 'ext-morning-prayer' }, { kind: 'source', key: 'ext-invitatory' }, { kind: 'source', key: 'ext-morning-prayer' },
  ] };
  const { descs } = await paintRealDay(w, { contents });
  const copies = (descs || []).filter((d) => d.block === 'Morning');
  check('G4 guard: the duplicated hour emits two copies at its two contents positions, the second stamped _occ 1',
    copies.length === 3 && copies[0].episodeId === 'ext-morning-prayer' && !copies[0]._occ
    && copies[1].episodeId === 'ext-invitatory' && copies[2].episodeId === 'ext-morning-prayer' && copies[2]._occ === 1,
    copies.map((d) => ({ id: d.episodeId, occ: d._occ || 0 })));
  w.close();
}

// ---------- M ◆ THE VIDEO CASE (John, 2026-11-22 11:44 CT): the Midday pin ----------
// His today layer carries Midday = [episode pin (Fr. Mike
// homilies), source ext-midday-prayer, source
// marian-antiphon-midday] — the editor's open order in the
// video. The loss seam, grounded by probe on the base tree
// (both constructions — pin in the today layer, pin in the
// standing contents): the storage round trip is INTACT —
// opnCheckContents590 (client) and validateProfileContents
// (server, index.ts) both carry kind 'episode' since v614,
// opnCheckTodayLayer594 routes through the client check,
// opnWrite604 writes the list verbatim, opnApplyToday-
// Layer594 merges it verbatim, and the rebuilt day's
// todayEdits + effective contents still carry the pin.
// The drop is COMPOSITIONAL: on the base tree the pin
// stands only at the fixed episode-group tail of the
// block, never at its saved contents position — and it
// stands nowhere at all in any rebuild whose episode
// resolver leg does not settle (resolveProfileEpisodes614
// resolves nothing on a failed series fetch, no miss card
// stands), which is the video's total disappearance. The
// legs below assert the FULL final order equals the
// editor's saved order — all three items, in place.
const MIDDAY_OPEN = [
  { kind: 'episode', key: FM_PIN },
  { kind: 'source', key: 'ext-midday-prayer' },
  { kind: 'source', key: 'marian-antiphon-midday' },
];
async function envelopeFrom(doc) {
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(doc) });
  await sleep(400);
  const O = w.__opn;
  O.opnDoc();
  await O.opnVaultCreate(PIN, 'RECOVERY-CODE-1');
  const env = w.localStorage.getItem(DATA_KEY);
  w.close();
  return env;
}
const johnWithTodayPin = () => {
  const doc = JSON.parse(JSON.stringify(JOHN));
  doc.sections.profiles.todayEdits = { [DATE]: { baseProfileKey: 'salesian', contents: { Midday: JSON.parse(JSON.stringify(MIDDAY_OPEN)) } } };
  return doc;
};
const johnWithStandingPin = () => {
  const doc = JSON.parse(JSON.stringify(JOHN));
  const sal = doc.sections.profiles.list.find((p) => p.key === 'salesian');
  sal.contents = { Midday: JSON.parse(JSON.stringify(MIDDAY_OPEN)) };
  return doc;
};
let envTodayPin = null, envStandingPin = null;
{
  envTodayPin = await envelopeFrom(johnWithTodayPin());
  envStandingPin = await envelopeFrom(johnWithStandingPin());
  check('M0 the Midday envelopes build from his real document (today-layer pin · standing pin) by the client\u2019s own vault create',
    !!envTodayPin && !!envStandingPin && envTodayPin !== envStandingPin);
}
// M1 ◆ moved: the episode pin dragged from the head to the middle of Midday
{
  const w = await unlockedWorld(appJs, envTodayPin);
  const O = w.__opn;
  await paintRealDay(w);
  const stood = await enterEdit(w, 'today');
  const openList = (O.opnMaterialize604('Midday') || []).map((it) => it.kind + ':' + it.key);
  check('M1a the editor opens on TODAY over the video\u2019s Midday list [episode pin, Midday Prayer, Marian Antiphon]',
    stood && JSON.stringify(openList) === JSON.stringify(['episode:' + FM_PIN, 'source:ext-midday-prayer', 'source:marian-antiphon-midday']), openList);
  await dragAndWrite(w, 'Midday', 'episode:' + FM_PIN, 'source:ext-midday-prayer');
  const { descs } = await paintRealDay(w);
  const midday = blockIds(descs, 'Midday');
  const disc = O.discQueue618((descs || []).filter((x) => x.block === 'Midday')).map((x) => x.episodeId);
  check('M1b \u25c6 MOVED round trip: the composed Midday carries ALL THREE in the editor\u2019s saved order [Midday Prayer, the pin, Marian Antiphon] \u2014 nothing lost',
    JSON.stringify(midday) === JSON.stringify(['ext-midday-prayer', FM_GUID, 'marian-antiphon-midday']), midday);
  check('M1c \u25c6 the Midday disc queue order matches the composed order',
    JSON.stringify(disc) === JSON.stringify(midday), disc);
  w.close();
}
// M2 ◆ unmoved control: open, write the unmoved list, Done — all three stand in the open order
{
  const w = await unlockedWorld(appJs, envTodayPin);
  const O = w.__opn;
  await paintRealDay(w);
  await enterEdit(w, 'today');
  await O.opnWrite604('Midday'); // the write of the unmoved materialized lists (a no-move round trip)
  await sleep(1200);
  const { descs } = await paintRealDay(w);
  const midday = blockIds(descs, 'Midday');
  check('M2 \u25c6 UNMOVED control: the composed Midday carries ALL THREE in the open order [the pin, Midday Prayer, Marian Antiphon] \u2014 the pin is not lost and not moved to the tail',
    JSON.stringify(midday) === JSON.stringify([FM_GUID, 'ext-midday-prayer', 'marian-antiphon-midday']), midday);
  w.close();
}
// M3 ◆ standing scope, same case: the pin in the standing contents, dragged to the middle
{
  const w = await unlockedWorld(appJs, envStandingPin);
  const O = w.__opn;
  await paintRealDay(w);
  await enterEdit(w, 'standing');
  await dragAndWrite(w, 'Midday', 'episode:' + FM_PIN, 'source:ext-midday-prayer');
  const { descs } = await paintRealDay(w);
  const midday = blockIds(descs, 'Midday');
  check('M3 \u25c6 STANDING scope shows the same seam and the same fix: the composed Midday carries ALL THREE in the saved order',
    JSON.stringify(midday) === JSON.stringify(['ext-midday-prayer', FM_GUID, 'marian-antiphon-midday']), midday);
  w.close();
}

// ---------- OA ◆ fail-on-old (the base tree, 0a6f7e1) ----------
{
  const r = await legStandingCourse(oldJs);
  check('OA1 \u25c6 fail-on-old: on the base client the E1 standing drag does NOT carry \u2014 Night composes in kind groups (sources, then courses) despite the stored move',
    JSON.stringify(r.night) === JSON.stringify(['daily-reflection', 'ext-night-prayer', 'biy:day-1', 'exorcist-files:ep-1']),
    r.night);
}
{
  const w = await unlockedWorld(oldJs);
  const O = w.__opn;
  await paintRealDay(w);
  await enterEdit(w, 'standing');
  O.opnMaterialize604('Night').push({ kind: 'prayer', key: 'our-father' });
  await O.opnWrite604('Night');
  await sleep(1200);
  await dragAndWrite(w, 'Night', 'prayer:our-father', 'source:ext-night-prayer');
  const { descs } = await paintRealDay(w);
  const night = blockIds(descs, 'Night');
  check('OA2 \u25c6 fail-on-old: on the base client the E3 prayer drag does NOT carry \u2014 the contents prayer lands at the block TAIL through the additions weave',
    JSON.stringify(night) === JSON.stringify(['daily-reflection', 'ext-night-prayer', 'biy:day-1', 'exorcist-files:ep-1', 'prayer:our-father:en']),
    night);
  w.close();
}
{
  const w = await unlockedWorld(oldJs, envTodayPin);
  const O = w.__opn;
  await paintRealDay(w);
  await enterEdit(w, 'today');
  await dragAndWrite(w, 'Midday', 'episode:' + FM_PIN, 'source:ext-midday-prayer');
  const { descs } = await paintRealDay(w);
  const midday = blockIds(descs, 'Midday');
  check('OA3 \u25c6 fail-on-old: on the base client the M1 Midday move does NOT carry \u2014 the pin falls to the fixed episode-group TAIL ([Midday Prayer, Marian Antiphon, pin]) instead of its saved middle position',
    JSON.stringify(midday) === JSON.stringify(['ext-midday-prayer', 'marian-antiphon-midday', FM_GUID]),
    midday);
  w.close();
}

console.log('harness-v619:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
