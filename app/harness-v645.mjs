// harness-v645.mjs — v645: Playback without autoplay.
//  Only the selected scope plays: the autoplay concept
//  (store · Settings row · menu items · native contract
//  field value) retires whole; chainForward retires (the
//  end of a queue and of a single play is a stop); a card
//  tap queues exactly the tapped track; Continue retires;
//  Play next stands in the row / homily / Favorites menus
//  and the player menu; the section-head ⋮ menu carries
//  Play next + Add to queue on the disc's unplayed set.
//
// Legs (§3.10):
//  (1) a card tap queues exactly the tapped track
//  (2) a head disc queues exactly the block's unplayed set
//  (3) queue-end and single-play-end birth no new queue
//      and chain nothing (the ended handler, driven)
//  (4) the native contract == the standing queue exactly,
//      queueEnd == items.length, autoplay === false
//  (5) Play next inserts at queueIdx + 1 and plays next;
//      Play next with nothing standing plays the track
//  (6) Add to queue appends (standing regression)
//  (7) the section ⋮ stands beside the disc, its tap does
//      not fold the head, its acts carry the disc set
//  (8) no Continue card paints; paintContinue /
//      buildContinueQueue / continue-btn at zero
//  (9) no Autoplay row in Settings, no Autoplay item in
//      either menu, autoplayOn / setAutoplay /
//      AUTOPLAY_KEY at zero
//  (10) a re-tap of a partly played track resumes at its
//      mark (v617)
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload; the composed day via
//    state.dayDescs (extRebuildDescs over his production
//    source settings), the harness-v618 paintDay recipe.
//  - tests/fixtures-v597/production-source-settings.json.
//  - tests/fixtures-v603 (book / novenas / podcasts index
//    / bible-folded) — the fetch-stub bodies.
//  - ~/workspace/projects/ora-pro-nobis/john-personal-
//    data-import-v589.json — his own exported document,
//    seeded as the personal-data store (podcastListens
//    deleted, the standing recipe).
// Direct start calls are wrapped in drive() (the v617 /
//  v618 recipe: jsdom's play() tail throws after every
//  bookkeeping seat the legs assert has run).
//
// Run: node app/harness-v645.mjs
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
// ---------- statics: legs (8) + (9), source half ----------
check('S8 paintContinue / buildContinueQueue / continue-btn stand at zero in the client',
  !clientSrc.includes('paintContinue') && !clientSrc.includes('buildContinueQueue') && !clientSrc.includes('continue-btn'));
check('S9 autoplayOn / setAutoplay / AUTOPLAY_KEY / syncAutoplayToggles / chainForward stand at zero in the client',
  !clientSrc.includes('autoplayOn') && !clientSrc.includes('setAutoplay') && !clientSrc.includes('AUTOPLAY_KEY') && !clientSrc.includes('syncAutoplayToggles') && !clientSrc.includes('chainForward'));
check('S9b no Settings Autoplay row / #set-autoplay stands in the client; the PLAYBACK section and its Intentions row stand',
  !clientSrc.includes('set-autoplay') && !clientSrc.includes('<div class="setname">Autoplay</div>')
  && clientSrc.includes('>PLAYBACK</h2>') && clientSrc.includes('id="set-intentions"'));
check('S9c the YouTube embeds\u2019 autoplay=1 parameters stand untouched (named non-members)',
  (clientSrc.match(/autoplay=1/g) || []).length === 2);
check('S4 nativeContractFor sends autoplay: false fixed and queueEnd = items.length',
  clientSrc.includes('autoplay: false') && clientSrc.includes('var queueEnd = items.length;'));

const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v645:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, writePlayed, refreshPlayedChrome, discQueue618, startQueue, tapPlay, playNext, addToQueue, playNextSet, addToQueueSet, nativeContractFor, openPlayerMenu, openDockMenu, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
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
function makeWorld(store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
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
const byId = (descs, id) => (descs || []).find((d) => d.episodeId === id);
const queueIds = (O) => (O.state.queue || []).map((t) => t.episodeId);
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
function menuLabels(d) { return [...d.querySelectorAll('.anchmenu [data-menuitem]')].map((x) => x.textContent.trim()); }
function clickMenu(w, d, label) {
  const el = [...d.querySelectorAll('.anchmenu [data-menuitem]')].find((x) => x.textContent.trim() === label);
  return click(w, el);
}
function fireEnded(w) {
  const audio = w.document.getElementById('audio');
  audio.dispatchEvent(new w.Event('ended'));
}

// ---------- World A: legs (1) (2) (10) (8-behavior) ----------
{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-praylistmode-v604': 'expanded', 'opn-praylistmode-v612-reset': '1' });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay(w);
  check('A0 setup: the composed production day paints (state.dayDescs standing)', descs.length >= 8 && (O.state.dayDescs || []).length >= 8, { descs: descs.length });

  // (2) head disc queues exactly the block's unplayed set
  O.writePlayed('ext-invitatory', DATE, 'marked', 'Morning', 0);
  const morning = (O.state.dayDescs || []).filter((x) => x.block === 'Morning');
  const discSet = O.discQueue618(morning).map((t) => t.episodeId);
  click(w, d.querySelector('[data-p615disc="Morning"]'));
  await sleep(200);
  check('L2 ◆ head disc queues exactly the block\u2019s unplayed set (discQueue618\u2019s set, in order)',
    discSet.length >= 3 && JSON.stringify(queueIds(O)) === JSON.stringify(discSet),
    { queue: queueIds(O), discSet });

  // (1) card tap queues exactly the tapped track
  O.state.queue = []; O.state.queueIdx = -1; O.state.current = null; O.state.pendingStart = null;
  const rosary = byId(O.state.dayDescs, 'daily-rosary');
  drive(() => O.tapPlay(rosary));
  await sleep(120);
  check('L1 ◆ card tap: the tapped track alone plays — no queue stands, the block remainder never enters',
    !!O.state.current && O.state.current.episodeId === 'daily-rosary' && (O.state.queue || []).length === 0,
    { current: O.state.current && O.state.current.episodeId, queue: queueIds(O) });

  // (10) re-tap of a partly played track resumes at its mark
  O.state.current = null; O.state.pendingStart = null;
  O.state.dayPayload.dayPositions = { 'morning-prayer': 222.7 };
  const mp = byId(O.state.dayDescs, 'morning-prayer');
  drive(() => O.tapPlay(mp));
  await sleep(120);
  check('L10 ◆ re-tap of a partly played track resumes at its mark: pendingResume seats at floor(222.7) = 222, as a single play',
    !!O.state.current && O.state.current.episodeId === 'morning-prayer'
    && !!O.state.pendingResume && O.state.pendingResume.episodeId === 'morning-prayer' && O.state.pendingResume.positionS === 222
    && (O.state.queue || []).length === 0,
    { current: O.state.current && O.state.current.episodeId, pendingResume: O.state.pendingResume, queue: queueIds(O) });

  // (8) behavior: no Continue card paints on a partly played day
  drive(() => O.refreshPlayedChrome());
  await sleep(80);
  check('L8 ◆ no Continue card paints: no #continue-btn and no #continue-slot card stands after a played-state refresh',
    !d.getElementById('continue-btn') && !d.querySelector('#continue-slot .card'),
    { btn: !!d.getElementById('continue-btn') });
  w.close();
}

// ---------- World B: legs (3) (4) ----------
{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay(w);
  const a = byId(descs, 'morning-prayer'), b = byId(descs, 'daily-rosary'), c = byId(descs, 'marian-antiphon');

  // (4) native contract == standing queue exactly
  O.state.queue = [a, b]; O.state.queueIdx = 0; O.state.current = a;
  const built = drive(() => O.nativeContractFor(a));
  check('L4 ◆ native contract carries exactly the standing queue: items == queue ids, queueEnd == items.length, autoplay === false',
    !!built && JSON.stringify(built.contract.items.map((i) => i.id)) === JSON.stringify(['morning-prayer', 'daily-rosary'])
    && built.contract.queueEnd === built.contract.items.length && built.contract.items.length === 2
    && built.contract.autoplay === false,
    built && { items: built.contract.items.map((i) => i.id), queueEnd: built.contract.queueEnd, autoplay: built.contract.autoplay });

  // (3a) queue-end: the last track ends — no new queue is born
  O.state.queue = [a, b]; O.state.queueIdx = 1; O.state.current = b;
  fireEnded(w);
  await sleep(120);
  check('L3a ◆ at the queue\u2019s last end, no new queue is born and nothing chains: queue empty, no current',
    (O.state.queue || []).length === 0 && !O.state.current,
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId });

  // (3b) single-play end: no chain from the ended track
  O.state.queue = []; O.state.queueIdx = -1; O.state.current = a; O.state.pendingStart = null;
  fireEnded(w);
  await sleep(120);
  check('L3b ◆ at a single play\u2019s end, nothing chains: queue stays empty, current clears (the stop)',
    (O.state.queue || []).length === 0 && !O.state.current,
    { queue: queueIds(O), current: O.state.current && O.state.current.episodeId });
  w.close();
}

// ---------- World C: legs (5) (6) ----------
{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay(w);
  const a = byId(descs, 'morning-prayer'), b = byId(descs, 'daily-rosary'), c = byId(descs, 'marian-antiphon');
  const x = byId(descs, 'ext-midday-prayer'), y = byId(descs, 'ext-evening-prayer');

  drive(() => O.startQueue([a, b, c]));
  await sleep(100);
  check('C0 setup: queue [morning-prayer, daily-rosary, marian-antiphon] stands at index 0',
    JSON.stringify(queueIds(O)) === JSON.stringify(['morning-prayer', 'daily-rosary', 'marian-antiphon']) && O.state.queueIdx === 0,
    { queue: queueIds(O), idx: O.state.queueIdx });

  // (5) Play next inserts at queueIdx + 1 …
  drive(() => O.playNext(x));
  await sleep(60);
  check('L5 ◆ Play next inserts the track at queueIdx + 1',
    JSON.stringify(queueIds(O)) === JSON.stringify(['morning-prayer', 'ext-midday-prayer', 'daily-rosary', 'marian-antiphon']),
    { queue: queueIds(O) });
  // … and plays next (the standing queue advance reaches it)
  fireEnded(w);
  await sleep(100);
  check('L5b ◆ the inserted track plays next: the queue advance at the current track\u2019s end lands on it',
    !!O.state.current && O.state.current.episodeId === 'ext-midday-prayer' && O.state.queueIdx === 1,
    { current: O.state.current && O.state.current.episodeId, idx: O.state.queueIdx });

  // (6) Add to queue appends at the end
  drive(() => O.addToQueue(y));
  await sleep(60);
  check('L6 ◆ Add to queue appends at the queue\u2019s end without disturbing the standing order',
    JSON.stringify(queueIds(O)) === JSON.stringify(['morning-prayer', 'ext-midday-prayer', 'daily-rosary', 'marian-antiphon', 'ext-evening-prayer']),
    { queue: queueIds(O) });

  // (5c) Play next with nothing standing plays the track
  O.state.queue = []; O.state.queueIdx = -1; O.state.current = null; O.state.pendingStart = null;
  drive(() => O.playNext(x));
  await sleep(100);
  check('L5c ◆ Play next with nothing standing plays the track (never a silent waiting queue)',
    !!O.state.current && O.state.current.episodeId === 'ext-midday-prayer' && (O.state.queue || []).length === 0,
    { current: O.state.current && O.state.current.episodeId, queue: queueIds(O) });
  w.close();
}

// ---------- World D: legs (7) (9-menus) ----------
{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-praylistmode-v604': 'expanded', 'opn-praylistmode-v612-reset': '1' });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay(w);
  const head = d.querySelector('[data-p609sethead="Morning"]');
  const disc = head && head.querySelector('[data-p615disc="Morning"]');
  const secBtn = head && head.querySelector('[data-p645secmenu="Morning"]');
  check('L7a ◆ the section-head ⋮ stands in the head row after the disc and before the count span',
    !!secBtn && !!disc && !!head.querySelector('[data-p615count="Morning"]')
    && (disc.compareDocumentPosition(secBtn) & w.Node.DOCUMENT_POSITION_FOLLOWING)
    && (secBtn.compareDocumentPosition(head.querySelector('[data-p615count="Morning"]')) & w.Node.DOCUMENT_POSITION_FOLLOWING)
    && secBtn.textContent === '\u22ee' && secBtn.getAttribute('aria-label') === 'More for Morning',
    { found: !!secBtn });

  const midday = byId(descs, 'ext-midday-prayer');
  drive(() => O.startQueue([midday]));
  await sleep(100);
  const morning = (O.state.dayDescs || []).filter((t) => t.block === 'Morning');
  const discSet = O.discQueue618(morning).map((t) => t.episodeId);
  const cardsBefore = d.querySelectorAll('[data-p609set] [data-card]').length;
  click(w, secBtn);
  await sleep(80);
  check('L7b ◆ the ⋮ tap does not fold the head (the painted cards stand unchanged) and opens a menu of exactly Play next + Add to queue',
    d.querySelectorAll('[data-p609set] [data-card]').length === cardsBefore
    && JSON.stringify(menuLabels(d)) === JSON.stringify(['Play next', 'Add to queue']),
    { cardsBefore, cardsAfter: d.querySelectorAll('[data-p609set] [data-card]').length, labels: menuLabels(d) });

  clickMenu(w, d, 'Add to queue');
  await sleep(80);
  check('L7c ◆ the menu\u2019s Add to queue appends the disc set whole, in order, behind the standing queue',
    JSON.stringify(queueIds(O)) === JSON.stringify(['ext-midday-prayer'].concat(discSet)),
    { queue: queueIds(O), discSet });

  click(w, secBtn);
  await sleep(80);
  clickMenu(w, d, 'Play next');
  await sleep(80);
  check('L7d ◆ the menu\u2019s Play next inserts the disc set whole at queueIdx + 1, in order',
    JSON.stringify(queueIds(O)) === JSON.stringify(['ext-midday-prayer'].concat(discSet, discSet)),
    { queue: queueIds(O), discSet });

  // (9) menus: player menu carries Play next + Add (after
  // Share) and no Autoplay; the dock menu gains neither
  // Play next nor Add and carries no Autoplay.
  const anchor = d.createElement('button'); d.body.appendChild(anchor);
  drive(() => O.openPlayerMenu(anchor));
  await sleep(60);
  const pLabels = menuLabels(d);
  check('L9a ◆ player menu: no Autoplay item; Play next + Add to queue stand immediately after Share for the current track',
    !pLabels.includes('Autoplay') && pLabels[0] === 'Share' && pLabels[1] === 'Play next' && pLabels[2] === 'Add to queue',
    { pLabels });
  drive(() => O.openDockMenu(anchor));
  await sleep(60);
  const dLabels = menuLabels(d);
  check('L9b ◆ dock menu: no Autoplay item, and neither Play next nor Add to queue stands there',
    !dLabels.includes('Autoplay') && !dLabels.includes('Play next') && !dLabels.includes('Add to queue'),
    { dLabels });
  w.close();
}

console.log('\nharness-v645:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
