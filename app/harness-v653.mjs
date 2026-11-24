// harness-v653.mjs — v653: Praylist row-menu Play next /
//  Add to queue act on the wrong identity — wireRowActs
//  resolved [data-rowmenu] / [data-rowshare] by BARE
//  episodeId while trackCard stamps the attribute with the
//  row's CARD KEY (descCardKey: episodeId + '#occ' for v610
//  copies + '@side' for the v650 second-painted office
//  side). Stamped rows resolved nothing, the menu never
//  opened, and the acts never fired (John's field report,
//  2026-11-24). The fix resolves by full card key in both
//  handlers; the state.readTracks fallback is keyed by the
//  bare episodeId parsed off the card key (readTracks is
//  keyed by bare episodeId only — payload build +
//  ownRegisterReadTracks — so keyed by the card key itself
//  it could never hit a stamped row).
//
// THE DRIVE IS THE REAL TAP PATH (Plan §2.5): paint the
//  Prayers home through the shipped paint, click the row's
//  [data-rowmenu], click the menu's item, then read
//  state.queue, the painted Queue section (the player
//  sheet / queue preview opened after the act), and the
//  native contract. playNext / addToQueue are NEVER called
//  directly for the L-legs (that is how harness-v645 missed
//  this defect); startQueue stands only as a sounding-queue
//  setup, as in harness-v645 World C.
//
// Legs (Plan §2.5):
//  L1 ◆ second office side (Divine Office under 'Both'):
//       menu opens · Play next inserts at queueIdx+1 in
//       state.queue + painted queue + native contract ·
//       Add to queue appends
//  L2 ◆ the '#1' occurrence copy (Divine Office side):
//       menu opens · its own _occ identity is placed
//  L3 ◆ nothing sounding: Play next on a stamped row plays
//       the tapped track · Add to queue queues it visibly,
//       nothing started
//  L4 ◆ standing families: an own episode row (daily-
//       rosary) + a standard-prayer row (morning-prayer)
//       through the same tap path
//  L5 ◆ section-head ⋮ set acts through the
//       [data-p645secmenu] tap path
//  L6 ◆ the second side's Share carries its own identity
//       (menu Share + the [data-rowshare] handler resolve
//       the Divine Office descriptor — its title + duration
//       stand on the share sheet; the builder leg proves
//       &src= follows the resolved descriptor's source.
//       See the L6a note + doc §3 for the composed-
//       descriptor &src gap, pre-existing and out of scope)
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json +
//    production-source-settings.json — the production day
//    payload and John's source settings (the standing
//    harness-v645 recipe: the composed day via
//    extRebuildDescs over his production settings, his
//    personal-data export seeded as the store).
//  - The office record: the REAL 2026-11-24 live payload
//    shape captured for harness-v650 (Review Probe D at
//    v649) — GET /api/player/externals/live rows for the
//    two labeled slots, standing Divine Office (durationSec
//    Morning 1091 / Evening 880) with a whole Sing the
//    Hours backup (Morning 1034 / Evening 869) — seeded as
//    the ext resolution state (the settled record shape:
//    standing fields + side2 promoted from backup), with
//    the office drop down at 'Both'
//    (opn-office-choice-v650 = 'both').
//  - L2's contents list names the Divine Office Morning
//    Prayer selector (ext-morning-prayer) TWICE in the
//    Morning block (the v610 occurrence shape, as in
//    harness-v650 G8), so the composed day carries a '#1'
//    copy.
//
// Run: node app/harness-v653.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 600)); }
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
const CHOICE_KEY = 'opn-office-choice-v650';

// The production-shaped office records (see header): the
// settled ext resolution state for the two labeled slots —
// standing Divine Office + side2 = the Sing the Hours
// backup, each side whole (own enclosure · stream · image
// · durationSec).
const DO_IMG = 'https://do.example/divine-office-logo.jpg';
const STH_IMG = 'https://sth.example/sing-the-hours-channel.jpg';
const DO_MP = 'https://do.example/divine-1124-mp.mp3';
const DO_EP = 'https://do.example/divine-1124-ep.mp3';
const STH_MP = 'https://sth.example/lauds-1124.mp3';
const STH_EP = 'https://sth.example/vespers-1124.mp3';
const OFFICE = {
  'ext-morning-prayer': { state: 'present', title: 'Morning Prayer - Divine Office', source: 'Divine Office', enclosureUrl: DO_MP, streamUrl: DO_MP, durationSec: 1091, sizeBytes: 1000000, imageUrl: DO_IMG,
    side2: { state: 'present', title: 'Morning Prayer - Sing the Hours', source: 'Sing the Hours', enclosureUrl: STH_MP, streamUrl: STH_MP, durationSec: 1034, sizeBytes: 900000, imageUrl: STH_IMG } },
  'ext-evening-prayer': { state: 'present', title: 'Evening Prayer - Divine Office', source: 'Divine Office', enclosureUrl: DO_EP, streamUrl: DO_EP, durationSec: 880, sizeBytes: 1000000, imageUrl: DO_IMG,
    side2: { state: 'present', title: 'Evening Prayer - Sing the Hours', source: 'Sing the Hours', enclosureUrl: STH_EP, streamUrl: STH_EP, durationSec: 869, sizeBytes: 900000, imageUrl: STH_IMG } },
};

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
check('S1 wireRowActs resolves [data-rowmenu] and [data-rowshare] by full card key (descCardKey), the readTracks fallback keyed by the bare episodeId parsed off the key',
  (clientSrc.match(/descCardKey\(x\) === key/g) || []).length >= 2
  && (clientSrc.match(/state\.readTracks\[String\(key \|\| ''\)\.split\(\/\[#@\]\/\)\[0\]\]/g) || []).length >= 2,
  { cardKeyReads: (clientSrc.match(/descCardKey\(x\) === key/g) || []).length });
check('S2 the [data-addmenu] handler stands unchanged (bare-episodeId read; its emission seats at 13683/13699/14869 stamp esc(d.episodeId) — addition descriptors carry no occ/side stamps)',
  clientSrc.includes("var t = (state.dayDescs || []).filter(function (x) { return x.episodeId === key; })[0];\n      if (t) openAdditionMenu(t, b);")
  && (clientSrc.match(/data-addmenu=\\?"' \+ esc\(d\.episodeId\)/g) || []).length >= 3,
  { addmenuEmissions: (clientSrc.match(/data-addmenu/g) || []).length });

const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v653:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, descCardKey, discQueue618, startQueue, nativeContractFor, openNowPlaying, openQueuePreview, wireRowActs, shareAppUrlFor, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
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
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(undefined), keys: () => Promise.resolve([]) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(extra) {
  return Object.assign({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-praylistmode-v604': 'expanded', 'opn-praylistmode-v612-reset': '1', [CHOICE_KEY]: 'both' }, extra || {});
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
  standing.forEach((s) => {
    if (OFFICE[s.slotId]) { O.state.extSlots[s.slotId] = JSON.parse(JSON.stringify(OFFICE[s.slotId])); return; }
    O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 };
  });
}
async function paintDay(w, mutateDay) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  if (mutateDay) mutateDay(day);
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
const byId = (descs, id) => (descs || []).find((d) => d.episodeId === id);
const byKey = (O, key) => (O.state.dayDescs || []).find((d) => O.descCardKey(d) === key);
const queueKeys = (O) => (O.state.queue || []).map((t) => O.descCardKey(t));
const queueTitles = (O) => (O.state.queue || []).map((t) => t.title);
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
function menuLabels(d) { return [...d.querySelectorAll('.anchmenu [data-menuitem]')].map((x) => x.textContent.trim()); }
function clickMenu(w, d, label) {
  const el = [...d.querySelectorAll('.anchmenu [data-menuitem]')].find((x) => x.textContent.trim() === label);
  return click(w, el);
}
async function tapRowMenu(w, key) {
  const d = w.document;
  const btn = d.querySelector('[data-rowmenu="' + key + '"]');
  const clicked = click(w, btn);
  await sleep(180);
  return { btn, clicked, labels: menuLabels(d) };
}
async function paintedQueueTitles(w, O) {
  drive(() => O.openNowPlaying());
  await sleep(120);
  const d = w.document;
  return [...d.querySelectorAll('#np-queue .npq-title')].map((x) => x.textContent.trim());
}

// ---------- World A: L1 (second office side) + L6 (Share) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay(w);
  const sth = byKey(O, 'ext-morning-prayer');
  const doSide = byKey(O, 'ext-morning-prayer@do');
  check('A0 setup: under Both, Morning Prayer paints two sides — Sing the Hours first (standing identity), Divine Office second (_side650=\'do\', card key ext-morning-prayer@do) — and both rows stand in the painted home',
    !!sth && sth.source === 'Sing the Hours' && !sth._side650
    && !!doSide && doSide.source === 'Divine Office' && doSide._side650 === 'do'
    && !!d.querySelector('[data-rowmenu="ext-morning-prayer@do"]') && !!d.querySelector('[data-rowmenu="ext-morning-prayer"]'),
    { descs: descs.filter((x) => x.episodeId === 'ext-morning-prayer').map((x) => O.descCardKey(x)) });

  const a = byId(descs, 'morning-prayer'), b = byId(descs, 'daily-rosary'), c = byId(descs, 'marian-antiphon');
  drive(() => O.startQueue([a, b, c]));
  await sleep(120);
  check('A1 setup: queue [morning-prayer, daily-rosary, marian-antiphon] sounds at index 0',
    JSON.stringify(queueKeys(O)) === JSON.stringify(['morning-prayer', 'daily-rosary', 'marian-antiphon']) && O.state.queueIdx === 0 && !!O.state.current,
    { queue: queueKeys(O), idx: O.state.queueIdx });

  // L1a: the menu opens on the stamped row
  const m1 = await tapRowMenu(w, 'ext-morning-prayer@do');
  check('L1a ◆ the second office side\u2019s ⋮ menu OPENS (Share · Play next · Add to queue stand)',
    m1.clicked && m1.labels.includes('Share') && m1.labels.includes('Play next') && m1.labels.includes('Add to queue'),
    { labels: m1.labels });

  // L1b: Play next inserts at queueIdx + 1 — state, paint, contract
  clickMenu(w, d, 'Play next');
  await sleep(120);
  const wantKeys = ['morning-prayer', 'ext-morning-prayer@do', 'daily-rosary', 'marian-antiphon'];
  check('L1b ◆ Play next inserts the Divine Office descriptor at queueIdx + 1 in state.queue (its own @do identity, source Divine Office)',
    JSON.stringify(queueKeys(O)) === JSON.stringify(wantKeys) && O.state.queue[1].source === 'Divine Office' && O.state.queue[1]._side650 === 'do',
    { queue: queueKeys(O) });
  const painted = await paintedQueueTitles(w, O);
  check('L1c ◆ the painted Queue section (player sheet opened after the act) carries the same order as state.queue',
    JSON.stringify(painted) === JSON.stringify(queueTitles(O)) && painted[1] === 'Morning Prayer - Divine Office',
    { painted, queue: queueTitles(O) });
  const built = drive(() => O.nativeContractFor(O.state.current));
  check('L1d ◆ the native contract carries the same order: items\u2019 titles == queue titles, queueEnd == items.length',
    !!built && JSON.stringify(built.contract.items.map((i) => i.title)) === JSON.stringify(queueTitles(O))
    && built.contract.queueEnd === built.contract.items.length && built.contract.items.length === wantKeys.length,
    built && { items: built.contract.items.map((i) => i.title), queueEnd: built.contract.queueEnd });
  const sheet = d.querySelector('.np-sheet'); if (sheet) sheet.remove();

  // L1e: Add to queue appends the same stamped identity at the end
  const m2 = await tapRowMenu(w, 'ext-morning-prayer@do');
  clickMenu(w, d, 'Add to queue');
  await sleep(120);
  check('L1e ◆ Add to queue appends the Divine Office descriptor at the queue\u2019s end (menu reopened through the tap path)',
    m2.labels.includes('Add to queue') && JSON.stringify(queueKeys(O)) === JSON.stringify(wantKeys.concat(['ext-morning-prayer@do'])),
    { queue: queueKeys(O), labels: m2.labels });

  // L6a: Share from the second side's own menu carries its
  // own identity — the sheet stands for the DIVINE OFFICE
  // descriptor (its own title + its own 18:11 duration in
  // the line), never the first side's. NOTE (recorded in
  // doc §3): the share LINK itself carries no &src= for
  // EITHER side through this tap path — shareAppUrlFor's
  // &src branch requires kind === 'external' and the
  // trackDesc seam copies kind only for podcast, so the
  // branch never fires for a composed day descriptor; that
  // is a pre-existing seam/builder gap on the base tree,
  // outside the §2.4 fix scope. L6c proves the builder
  // honors the resolved descriptor's own source when the
  // kind stands (the v643 shape).
  const m3 = await tapRowMenu(w, 'ext-morning-prayer@do');
  clickMenu(w, d, 'Share');
  await sleep(120);
  const sheetTitle = d.querySelector('.sharesheet h3') ? d.querySelector('.sharesheet h3').textContent.trim() : '';
  const sheetLine = d.querySelector('.sharesheet .meta') ? d.querySelector('.sharesheet .meta').textContent.trim() : '';
  check('L6a ◆ the second side\u2019s Share (its row menu) opens the share sheet for ITS OWN descriptor: title \u2018Morning Prayer - Divine Office\u2019 and its own duration 18:11 in the line — not the first side\u2019s title or 17:14',
    m3.labels.includes('Share') && sheetTitle === 'Morning Prayer - Divine Office' && sheetLine.includes('18:11') && !sheetLine.includes('17:14'),
    { sheetTitle, sheetLine });
  const shSheet = d.querySelector('.sharesheet'); if (shSheet) shSheet.remove();

  // L6b: the [data-rowshare] handler on the stamped key
  const host = d.createElement('div');
  host.innerHTML = '<button data-rowshare="ext-morning-prayer@do">share</button>';
  d.body.appendChild(host);
  O.wireRowActs(host);
  click(w, host.querySelector('[data-rowshare]'));
  await sleep(120);
  const sheetTitle2 = d.querySelector('.sharesheet h3') ? d.querySelector('.sharesheet h3').textContent.trim() : '';
  const sheetLine2 = d.querySelector('.sharesheet .meta') ? d.querySelector('.sharesheet .meta').textContent.trim() : '';
  check('L6b ◆ the [data-rowshare] handler resolves the stamped key the same way: the share sheet stands for the Divine Office descriptor (its title + 18:11), not the first side\u2019s',
    sheetTitle2 === 'Morning Prayer - Divine Office' && sheetLine2.includes('18:11') && !sheetLine2.includes('17:14'),
    { sheetTitle2, sheetLine2 });
  const shSheet2 = d.querySelector('.sharesheet'); if (shSheet2) shSheet2.remove();

  // L6c: builder leg (direct, labeled — not a tap-path
  // leg): with the kind standing (the v643 descriptor
  // shape), shareAppUrlFor names each side's OWN source in
  // &src= — the identity follows the RESOLVED descriptor's
  // source, so the card-key resolution in wireRowActs is
  // the link that decides which side's &src= a share
  // carries wherever the kind stands.
  const doUrl = drive(() => O.shareAppUrlFor(Object.assign({}, doSide, { kind: 'external' })));
  const sthUrl = drive(() => O.shareAppUrlFor(Object.assign({}, sth, { kind: 'external' })));
  check('L6c ◆ builder: shareAppUrlFor on the resolved Divine Office descriptor carries &src=Divine Office; on the Sing the Hours descriptor &src=Sing the Hours — identity follows the resolved descriptor\u2019s own source',
    !!doUrl && doUrl.includes('&src=Divine%20Office') && !!sthUrl && sthUrl.includes('&src=Sing%20the%20Hours'),
    { doUrl, sthUrl });
  w.close();
}

// ---------- World B: L2 (the '#1' occurrence copy) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay(w, (day) => {
    day.profile = { contents: { Morning: [{ kind: 'source', key: 'ext-morning-prayer' }, { kind: 'source', key: 'ext-morning-prayer' }] } };
  });
  const copy = byKey(O, 'ext-morning-prayer#1@do');
  const mpKeys = (O.state.dayDescs || []).filter((x) => x.episodeId === 'ext-morning-prayer').map((x) => O.descCardKey(x));
  check('B0 setup: the contents list naming ext-morning-prayer twice composes four office tracks; the #1 Divine Office copy stands with card key ext-morning-prayer#1@do (_occ=1, _side650=\'do\') and its row paints',
    JSON.stringify(mpKeys) === JSON.stringify(['ext-morning-prayer', 'ext-morning-prayer@do', 'ext-morning-prayer#1', 'ext-morning-prayer#1@do'])
    && !!copy && copy._occ === 1 && copy._side650 === 'do' && copy.source === 'Divine Office'
    && !!d.querySelector('[data-rowmenu="ext-morning-prayer#1@do"]'),
    { mpKeys });

  const mid = byId(descs, 'ext-midday-prayer'), eve = byId(descs, 'ext-evening-prayer');
  drive(() => O.startQueue([mid, eve]));
  await sleep(120);
  const m = await tapRowMenu(w, 'ext-morning-prayer#1@do');
  check('L2a ◆ the #1 copy\u2019s ⋮ menu OPENS through the tap path',
    m.clicked && m.labels.includes('Play next') && m.labels.includes('Add to queue'), { labels: m.labels });
  clickMenu(w, d, 'Play next');
  await sleep(120);
  check('L2b ◆ Play next places THE COPY at queueIdx + 1 — the queue entry carries _occ=1 and _side650=\'do\' (its own identity, not the first copy\u2019s)',
    O.state.queueIdx === 0 && O.state.queue.length === 3 && O.descCardKey(O.state.queue[1]) === 'ext-morning-prayer#1@do'
    && O.state.queue[1]._occ === 1 && O.state.queue[1]._side650 === 'do',
    { queue: queueKeys(O) });
  const m2 = await tapRowMenu(w, 'ext-morning-prayer#1@do');
  clickMenu(w, d, 'Add to queue');
  await sleep(120);
  check('L2c ◆ Add to queue appends THE COPY at the end, same identity',
    m2.labels.includes('Add to queue') && O.descCardKey(O.state.queue[O.state.queue.length - 1]) === 'ext-morning-prayer#1@do',
    { queue: queueKeys(O) });
  w.close();
}

// ---------- World C: L3 (nothing sounding) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay(w);
  check('C0 setup: nothing stands — no queue, no current',
    (O.state.queue || []).length === 0 && !O.state.current, { queue: queueKeys(O) });
  const m = await tapRowMenu(w, 'ext-morning-prayer@do');
  clickMenu(w, d, 'Play next');
  await sleep(150);
  check('L3a ◆ Play next on a stamped row with nothing sounding PLAYS THE TAPPED TRACK: current is the Divine Office side (episodeId + source + @do identity)',
    m.labels.includes('Play next') && !!O.state.current && O.state.current.episodeId === 'ext-morning-prayer'
    && O.state.current.source === 'Divine Office' && O.state.current._side650 === 'do',
    { current: O.state.current && { id: O.state.current.episodeId, source: O.state.current.source, side: O.state.current._side650 } });
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay(w);
  const m = await tapRowMenu(w, 'ext-morning-prayer@do');
  clickMenu(w, d, 'Add to queue');
  await sleep(120);
  check('L3b ◆ Add to queue on a stamped row with nothing sounding queues it — state.queue holds the @do descriptor, queueIdx -1, NOTHING started (no current)',
    m.labels.includes('Add to queue') && JSON.stringify(queueKeys(O)) === JSON.stringify(['ext-morning-prayer@do'])
    && O.state.queueIdx === -1 && !O.state.current,
    { queue: queueKeys(O), idx: O.state.queueIdx, current: !!O.state.current });
  drive(() => O.openQueuePreview());
  await sleep(100);
  const titles = [...d.querySelectorAll('#np-queue .npq-title')].map((x) => x.textContent.trim());
  check('L3c ◆ the queued track is VISIBLE in the painted Queue section (queue preview opened after the act)',
    JSON.stringify(titles) === JSON.stringify(['Morning Prayer - Divine Office']), { titles });
  w.close();
}

// ---------- World D: L4 (standing families through the tap path) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay(w);
  const mid = byId(descs, 'ext-midday-prayer'), eve = byId(descs, 'ext-evening-prayer'), night = byId(descs, 'ext-night-prayer');
  drive(() => O.startQueue([mid, eve, night]));
  await sleep(120);
  check('D0 setup: queue [ext-midday-prayer, ext-evening-prayer, ext-night-prayer] sounds at index 0',
    JSON.stringify(queueKeys(O)) === JSON.stringify(['ext-midday-prayer', 'ext-evening-prayer', 'ext-night-prayer']) && O.state.queueIdx === 0,
    { queue: queueKeys(O) });

  const m1 = await tapRowMenu(w, 'daily-rosary');
  clickMenu(w, d, 'Play next');
  await sleep(120);
  check('L4a ◆ own episode row (daily-rosary) through the tap path: menu opens, Play next inserts it at queueIdx + 1',
    m1.labels.includes('Play next') && JSON.stringify(queueKeys(O)) === JSON.stringify(['ext-midday-prayer', 'daily-rosary', 'ext-evening-prayer', 'ext-night-prayer']),
    { queue: queueKeys(O), labels: m1.labels });
  const m2 = await tapRowMenu(w, 'morning-prayer');
  clickMenu(w, d, 'Add to queue');
  await sleep(120);
  check('L4b ◆ standard-prayer row (morning-prayer, the own-standing prayer) through the tap path: menu opens, Add to queue appends it at the end',
    m2.labels.includes('Add to queue') && JSON.stringify(queueKeys(O)) === JSON.stringify(['ext-midday-prayer', 'daily-rosary', 'ext-evening-prayer', 'ext-night-prayer', 'morning-prayer']),
    { queue: queueKeys(O), labels: m2.labels });
  w.close();
}

// ---------- World E: L5 (section-head ⋮ through its tap path) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintDay(w);
  const midday = byId(descs, 'ext-midday-prayer');
  drive(() => O.startQueue([midday]));
  await sleep(120);
  const morning = (O.state.dayDescs || []).filter((t) => t.block === 'Morning');
  const discSet = O.discQueue618(morning).map((t) => O.descCardKey(t));
  const head = d.querySelector('[data-p609sethead="Morning"]');
  const secBtn = head && head.querySelector('[data-p645secmenu="Morning"]');
  check('E0 setup: the Morning section-head ⋮ stands and the disc set is non-trivial',
    !!secBtn && discSet.length >= 3, { found: !!secBtn, discSet });
  click(w, secBtn);
  await sleep(100);
  const labels = menuLabels(d);
  clickMenu(w, d, 'Add to queue');
  await sleep(120);
  check('L5a ◆ section-head ⋮ menu (exactly Play next + Add to queue): Add to queue appends the disc set whole, in order, behind the standing queue',
    JSON.stringify(labels) === JSON.stringify(['Play next', 'Add to queue'])
    && JSON.stringify(queueKeys(O)) === JSON.stringify(['ext-midday-prayer'].concat(discSet)),
    { queue: queueKeys(O), discSet, labels });
  click(w, secBtn);
  await sleep(100);
  clickMenu(w, d, 'Play next');
  await sleep(120);
  check('L5b ◆ the section-head menu\u2019s Play next inserts the disc set whole at queueIdx + 1, in order',
    JSON.stringify(queueKeys(O)) === JSON.stringify(['ext-midday-prayer'].concat(discSet, discSet)),
    { queue: queueKeys(O), discSet });
  w.close();
}

console.log('\nharness-v653:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
