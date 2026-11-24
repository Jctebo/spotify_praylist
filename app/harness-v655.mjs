// harness-v655.mjs — v655: a COMPOSED office row stood
//  short of every other playable row in two places: its
//  Praylist-home ⋮ menu carried no Details item
//  (epCardIsEpisode keys on kind; the trackDesc seam copies
//  kind only for podcast) and its share line named no side
//  (shareLineFor640's office branch fired only under
//  kind === 'external'). The fix (Plan §2.3/§2.4) widens
//  each consumer with the same guard — the descriptor's own
//  source stands AND opnLabeledSlot650(episodeId) — and
//  completes the episode card's mark toggle: its fall-through
//  writePlayed now carries the descriptor's _occ/_side650
//  stamps, landing on the key the card itself reads.
//
// THE DESCRIPTORS UNDER TEST ARE THE COMPOSED ONES
//  (Improvement D): read out of state.dayDescs by card key
//  after extRebuildDescs, exactly as the shipped row wiring
//  resolves them. No leg hand-builds a descriptor and no leg
//  hand-stamps a kind.
//
// Legs (Plan §2.5):
//  L1 ◆ all four office rows' home ⋮ menus carry Details;
//       activating opens the episode card with THAT side's
//       own title, duration, description text
//  L2 ◆ card marks per side (Morning pair, through the real
//       cards): toggle side A on — side B's card + row state
//       stay unplayed, side A's row dot agrees; toggle back
//       clears A only. L2b: the same through the STAMPED
//       side's card (the §2.3 toggle completion in substance)
//  L3 ◆ each office side's share line via shareTrackSheet
//       names its own source with its own duration (all
//       four); the track-page seat (trackPagePaintDay643,
//       the other shareLineFor640 caller) driven for one side
//       of each slot agrees
//  L4 ◆ fail-on-old: this same harness run against a
//       pristine base checkout — L1 fails all four (no
//       Details), L3 fails all four (the Episode form), and
//       the direct toggle leg below lands the stamped
//       descriptor's write on the BARE key (the sibling's),
//       so its isPlayedDesc read stands false there
//  L5 ◆ byte-identity: menu item lists + share lines for an
//       own built-day episode, an own standard-prayer row, a
//       podcast descriptor, and the non-office external
//       readings row are printed as IDENT lines — identical
//       between branch and pristine base runs (diffed by the
//       driver; the readings row's Episode form is also
//       asserted absolutely — the guard's proof)
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json +
//    production-source-settings.json — the production day
//    payload and John's source settings (the standing
//    harness-v654 recipe).
//  - The office record: the REAL 2026-11-24 live payload
//    shape captured for harness-v650 — standing Divine
//    Office (durationSec Morning 1091 / Evening 880, with
//    its descText) with a whole Sing the Hours backup
//    (Morning 1034 / Evening 869, its own descText) — seeded
//    as the ext resolution state (standing fields + side2
//    promoted from backup), office drop down at 'Both'
//    (opn-office-choice-v650 = 'both'), so extRebuildDescs
//    composes both sides of both slots.
//
// Run: node app/harness-v655.mjs
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
const DAYWORD = 'Nov 21';
const fmtDur = (s) => Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);

const DO_IMG = 'https://do.example/divine-office-logo.jpg';
const STH_IMG = 'https://sth.example/sing-the-hours-channel.jpg';
const DO_MP = 'https://do.example/divine-1124-mp.mp3';
const DO_EP = 'https://do.example/divine-1124-ep.mp3';
const STH_MP = 'https://sth.example/lauds-1124.mp3';
const STH_EP = 'https://sth.example/vespers-1124.mp3';
const OFFICE = {
  'ext-morning-prayer': { state: 'present', title: 'Morning Prayer - Divine Office', source: 'Divine Office', enclosureUrl: DO_MP, streamUrl: DO_MP, durationSec: 1091, sizeBytes: 1000000, imageUrl: DO_IMG, descText: 'Divine Office morning description 1124.',
    side2: { state: 'present', title: 'Morning Prayer - Sing the Hours', source: 'Sing the Hours', enclosureUrl: STH_MP, streamUrl: STH_MP, durationSec: 1034, sizeBytes: 900000, imageUrl: STH_IMG, descText: 'Sing the Hours lauds description 1124.' } },
  'ext-evening-prayer': { state: 'present', title: 'Evening Prayer - Divine Office', source: 'Divine Office', enclosureUrl: DO_EP, streamUrl: DO_EP, durationSec: 880, sizeBytes: 1000000, imageUrl: DO_IMG, descText: 'Divine Office evening description 1124.',
    side2: { state: 'present', title: 'Evening Prayer - Sing the Hours', source: 'Sing the Hours', enclosureUrl: STH_EP, streamUrl: STH_EP, durationSec: 869, sizeBytes: 900000, imageUrl: STH_IMG, descText: 'Sing the Hours vespers description 1124.' } },
};
// Card key (as the row menu stamps it) · side source ·
// composed title · composed durationS · composed descText.
const SIDES = [
  { key: 'ext-morning-prayer', src: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours', dur: 1034, desc: 'Sing the Hours lauds description 1124.', block: 'Morning' },
  { key: 'ext-morning-prayer@do', src: 'Divine Office', title: 'Morning Prayer - Divine Office', dur: 1091, desc: 'Divine Office morning description 1124.', block: 'Morning' },
  { key: 'ext-evening-prayer', src: 'Sing the Hours', title: 'Evening Prayer - Sing the Hours', dur: 869, desc: 'Sing the Hours vespers description 1124.', block: 'Evening' },
  { key: 'ext-evening-prayer@do', src: 'Divine Office', title: 'Evening Prayer - Divine Office', dur: 880, desc: 'Divine Office evening description 1124.', block: 'Evening' },
];
const officeLine = (s) => DAYWORD + ' · ' + s.src + ' · ' + fmtDur(s.dur);

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
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  const j = src.indexOf('\nfunction ', i + 10);
  return src.slice(i, j < 0 ? i + 6000 : j);
}
check('S1 the fix stands at the three seats: epCardIsEpisode carries the guarded labeled-slot clause after the kind line, epCardTogglePlayed\'s fall-through write carries d._occ/d._side650, shareLineFor640\'s office branch carries the same guard',
  (() => {
    const pred = grab(clientSrc, 'epCardIsEpisode');
    const tog = grab(clientSrc, 'epCardTogglePlayed');
    const line = grab(clientSrc, 'shareLineFor640');
    return pred.includes('if (d.source && opnLabeledSlot650(d.episodeId)) return true;')
      && tog.includes("writePlayed(d.episodeId, presentedDateStr(), on ? 'played' : null, d.block, d._occ || 0, d._side650 || null);")
      && line.includes("if (t.kind === 'external' || (t.source && opnLabeledSlot650(t.episodeId))) return presentedDayWord()");
  })(),
  {});

const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v655:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, descCardKey, isPlayedDesc, epCardIsEpisode, epCardTogglePlayed, shareLineFor640, trackPagePaintDay643, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  try { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true }); } catch (e) {}
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
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
function menuLabels(d) { return [...d.querySelectorAll('.anchmenu [data-menuitem]')].map((x) => x.textContent.trim()); }
function clickMenu(w, d, label) {
  const el = [...d.querySelectorAll('.anchmenu [data-menuitem]')].find((x) => x.textContent.trim() === label);
  return click(w, el);
}
async function openMenu(w, key) {
  const d = w.document;
  click(w, d.querySelector('[data-rowmenu="' + key + '"]'));
  await sleep(220);
  return menuLabels(d);
}
function closeCard(w) {
  const c = w.document.querySelector('.menucatcher');
  if (c) click(w, c);
}
// Open a row's episode card through the real menu → Details.
async function openCard(w, key) {
  const d = w.document;
  const labels = await openMenu(w, key);
  clickMenu(w, d, 'Details');
  await sleep(80);
  return { labels, card: d.querySelector('.epcard') };
}
function cardFacts(card) {
  if (!card) return { title: '', desc: '', state: '', metas: [] };
  const title = card.querySelector('.epcard-title');
  const desc = card.querySelector('.epcard-desc');
  const state = card.querySelector('[data-epstate]');
  const metas = [...card.querySelectorAll('.epcard-body .meta')].map((x) => x.textContent.trim());
  return { title: title ? title.textContent.trim() : '', desc: desc ? desc.textContent.trim() : '', state: state ? state.textContent.trim() : '', metas };
}
// The share sheet's line for a row, through the real menu →
// Share path (shareTrackSheet).
async function tapShareLine(w, key) {
  const d = w.document;
  const labels = await openMenu(w, key);
  clickMenu(w, d, 'Share');
  await sleep(120);
  const sheet = d.querySelector('.sharesheet');
  const meta = sheet ? sheet.querySelector('.card .meta') : null;
  const h3 = sheet ? sheet.querySelector('h3') : null;
  const out = { labels, title: h3 ? h3.textContent.trim() : '', line: meta ? meta.textContent.trim() : '' };
  if (sheet) sheet.remove();
  return out;
}

// ---------- World A: L1 (Details on each office side) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay(w);
  const byKey = (key) => (O.state.dayDescs || []).find((x) => O.descCardKey(x) === key);
  check('A0 setup: the composed day carries all four office descriptors — each with its own source/title/duration/descText, NO kind stamped (the production shape), both sides\' rows painted',
    SIDES.every((s) => { const x = byKey(s.key); return !!x && x.source === s.src && x.title === s.title && x.durationS === s.dur && x.descText === s.desc && x.kind === undefined && !!d.querySelector('[data-rowmenu="' + s.key + '"]'); }),
    { descs: (O.state.dayDescs || []).filter((x) => x.episodeId.includes('morning-prayer') || x.episodeId.includes('evening-prayer')).map((x) => ({ k: O.descCardKey(x), kind: x.kind, src: x.source, desc: x.descText })) });

  for (const s of SIDES) {
    const { labels, card } = await openCard(w, s.key);
    const f = cardFacts(card);
    check('L1 ◆ ' + s.title + ': the home ⋮ menu carries Details and activating it opens the episode card with THAT side\'s own title, duration (' + fmtDur(s.dur) + ') and description text — never the sibling\'s',
      labels.includes('Details') && !!card && f.title === s.title && f.desc === s.desc && f.metas.some((m) => m.includes(fmtDur(s.dur))),
      { labels, facts: f, want: { title: s.title, desc: s.desc, dur: fmtDur(s.dur) } });
    closeCard(w);
    await sleep(40);
  }
  w.close();
}

// ---------- World B: L2 (per-side card marks) + L4 (toggle write key) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay(w);
  const byKey = (key) => (O.state.dayDescs || []).find((x) => O.descCardKey(x) === key);
  const A = SIDES[0], B = SIDES[1]; // Morning: A = first-painted (Sing the Hours), B = stamped (Divine Office, _side650 'do')
  const descA = byKey(A.key), descB = byKey(B.key);

  let r = await openCard(w, A.key);
  check('L2a ◆ side A\'s card opens reading "Not played yet" with neither side marked',
    !!r.card && cardFacts(r.card).state === 'Not played yet' && !O.isPlayedDesc(descA, DATE) && !O.isPlayedDesc(descB, DATE),
    { facts: cardFacts(r.card) });
  click(w, r.card && r.card.querySelector('[data-epmark]'));
  await sleep(60);
  const aOn = cardFacts(r.card).state === 'Played' && O.isPlayedDesc(descA, DATE) && !O.isPlayedDesc(descB, DATE);
  const aDot = d.querySelector('[data-card="' + A.key + '"] [data-markplayed]');
  check('L2b ◆ toggling side A\'s card mark marks side A only: A\'s card reads Played, A\'s store read stands, B\'s store read stays unplayed, A\'s row dot agrees (on)',
    aOn && !!aDot && aDot.classList.contains('on'),
    { state: cardFacts(r.card), a: O.isPlayedDesc(descA, DATE), b: O.isPlayedDesc(descB, DATE), dot: aDot && aDot.className });
  closeCard(w);
  await sleep(40);
  r = await openCard(w, B.key);
  check('L2c ◆ side B\'s card still reads "Not played yet" after side A was marked',
    !!r.card && cardFacts(r.card).state === 'Not played yet', { facts: cardFacts(r.card) });
  closeCard(w);
  await sleep(40);
  r = await openCard(w, A.key);
  click(w, r.card && r.card.querySelector('[data-epmark]'));
  await sleep(60);
  const aDot2 = d.querySelector('[data-card="' + A.key + '"] [data-markplayed]');
  check('L2d ◆ toggling side A back clears side A only: A\'s card + store read + row dot stand unplayed, B still unplayed',
    !!r.card && cardFacts(r.card).state === 'Not played yet' && !O.isPlayedDesc(descA, DATE) && !O.isPlayedDesc(descB, DATE) && !!aDot2 && !aDot2.classList.contains('on'),
    { state: cardFacts(r.card), a: O.isPlayedDesc(descA, DATE), b: O.isPlayedDesc(descB, DATE) });
  closeCard(w);
  await sleep(40);

  // L2b': the stamped side through its own card — the §2.3
  // toggle completion in substance.
  r = await openCard(w, B.key);
  click(w, r.card && r.card.querySelector('[data-epmark]'));
  await sleep(60);
  check('L2e ◆ toggling the STAMPED side B\'s card mark marks side B only: B\'s card reads Played and B\'s store read stands, A stays unplayed',
    !!r.card && cardFacts(r.card).state === 'Played' && O.isPlayedDesc(descB, DATE) && !O.isPlayedDesc(descA, DATE),
    { state: cardFacts(r.card), a: O.isPlayedDesc(descA, DATE), b: O.isPlayedDesc(descB, DATE) });
  click(w, r.card && r.card.querySelector('[data-epmark]'));
  await sleep(60);
  check('L2f ◆ toggling side B back clears side B only',
    !!r.card && cardFacts(r.card).state === 'Not played yet' && !O.isPlayedDesc(descB, DATE) && !O.isPlayedDesc(descA, DATE),
    { state: cardFacts(r.card), a: O.isPlayedDesc(descA, DATE), b: O.isPlayedDesc(descB, DATE) });
  closeCard(w);
  await sleep(40);

  // L4 (direct form): the toggle's fall-through write on a
  // _side650-stamped composed descriptor (Evening pair, still
  // untouched) lands on the stamped key — on the pristine
  // base it lands on the BARE key, so the stamped read
  // stands false and the sibling's read stands true there.
  const E = SIDES[3], Esib = SIDES[2];
  const descE = byKey(E.key), descEsib = byKey(Esib.key);
  O.epCardTogglePlayed({ desc: descE, surface: 'praylist' }, true, () => {});
  check('L4 ◆ the card toggle\'s fall-through write on the _side650-stamped Evening Divine Office descriptor lands on ITS OWN key: the stamped read stands played and the sibling\'s read stays unplayed (on the base both invert — the write lands bare)',
    O.isPlayedDesc(descE, DATE) === true && O.isPlayedDesc(descEsib, DATE) === false,
    { stamped: O.isPlayedDesc(descE, DATE), sibling: O.isPlayedDesc(descEsib, DATE), side: descE && descE._side650 });
  O.epCardTogglePlayed({ desc: descE, surface: 'praylist' }, false, () => {});
  w.close();
}

// ---------- World C: L3 (share lines, both seats) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn;
  const { day } = await paintDay(w);
  const byKey = (key) => (O.state.dayDescs || []).find((x) => O.descCardKey(x) === key);
  for (const s of SIDES) {
    const r = await tapShareLine(w, s.key);
    check('L3 ◆ ' + s.title + ': the share sheet\'s line (real menu → Share path) reads "' + officeLine(s) + '" — its own source with its own duration',
      r.title === s.title && r.line === officeLine(s),
      { line: r.line, want: officeLine(s), sheetTitle: r.title });
  }
  // The track-page seat (trackPagePaintDay643 — the other
  // shareLineFor640 caller) for one side of each slot.
  for (const s of [SIDES[1], SIDES[2]]) {
    O.trackPagePaintDay643({ s: 'day', date: DATE, id: s.key.split('@')[0] }, byKey(s.key));
    await sleep(60);
    const pg = w.document.querySelector('#track-page-643 p.sub');
    check('L3p ◆ the track-page seat agrees for ' + s.title + ': its standing line reads "' + officeLine(s) + '"',
      !!pg && pg.textContent.trim() === officeLine(s),
      { line: pg && pg.textContent.trim(), want: officeLine(s) });
    O.paintPrayersView(day);
    await sleep(120);
  }
  w.close();
}

// ---------- World D: L5 (byte-identity prints + the guard's proof) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn;
  await paintDay(w);
  const byKey = (key) => (O.state.dayDescs || []).find((x) => O.descCardKey(x) === key);
  const fams = [
    { name: 'own-episode', key: 'daily-rosary' },
    { name: 'own-prayer', key: 'morning-prayer' },
    { name: 'podcast', key: 'daily-readings:2026-11-21' },
    { name: 'ext-readings', key: 'ext-office-of-readings' },
  ];
  for (const f of fams) {
    const r = await tapShareLine(w, f.key);
    console.log('IDENT ' + f.name + ' menu=' + JSON.stringify(r.labels) + ' line=' + JSON.stringify(r.line));
    if (f.name === 'ext-readings') {
      check('L5 ◆ the non-office external readings row (composed, source standing, id NOT a labeled slot) keeps the in-day Episode form — no office form taken, the guard holds',
        r.line === DAYWORD + ' · Episode · ' + fmtDur(30),
        { line: r.line, want: DAYWORD + ' · Episode · ' + fmtDur(30) });
    }
  }
  check('S2 the readings descriptor itself: composed, source standing, no kind, not a labeled slot',
    (() => { const x = byKey('ext-office-of-readings'); return !!x && !!x.source && x.kind === undefined; })(),
    {});
  w.close();
}

console.log('\nharness-v655:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
