// harness-v654.mjs — v654: a day row's share link for an
//  office side carried NO &src= for either side, so a
//  shared Divine Office link landed on the Sing the Hours
//  track's page. Cause (Plan §2.1): shareAppUrlFor appended
//  &src= only when t.kind === 'external', but the trackDesc
//  seam copies kind onto a composed descriptor only for
//  podcast — a composed office descriptor (what a real day
//  row carries) holds source standing and no kind. The fix
//  (§2.2/§2.4) widens the one condition at the builder seat:
//  t.source stands AND (t.kind === 'external' OR
//  opnLabeledSlot650(id)). Nothing else moves.
//
// THE DESCRIPTORS UNDER TEST ARE THE COMPOSED ONES
//  (Improvement D): read out of state.dayDescs after
//  extRebuildDescs, exactly as the row menu resolves them.
//  No leg hand-builds a descriptor and no leg hand-stamps a
//  kind (that is how v643's office legs and v653's L6c
//  missed this defect — they drove kind-standing shapes).
//
// Legs (Plan §2.5):
//  L1 ◆ through the real tap path (paint Prayers home,
//       click the row's [data-rowmenu], click Share, click
//       Copy link, capture the sheet's URL): all four
//       office shares (Morning/Evening × Sing the
//       Hours/Divine Office) carry &src= of their own side
//  L2 ◆ each L1 URL fed through the landing parse seat
//       (shareLandingRead) + trackPageDaySelect643 over
//       the same composed day selects that side's own
//       descriptor (own title + duration)
//  L3 ◆ every other family byte-identical to the pristine
//       base: an own built-day episode (daily-rosary, day
//       form), an own standard-prayer row (morning-prayer,
//       day form), a non-office external day row (Office
//       of Readings — composed, source standing, id NOT a
//       labeled slot → no &src= added; the guard's proof),
//       a podcast descriptor (the readings seat, pod
//       form), and the homily carve-out standing ahead of
//       the builder in shareTrackSheet (no link built)
//  L4 ◆ fail-on-old: this same harness run against a
//       pristine base checkout — L1 fails all four, L2's
//       Divine Office links select the first-painted
//       (Sing the Hours) descriptor. Recorded in doc §3.
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json +
//    production-source-settings.json — the production day
//    payload and John's source settings (the standing
//    harness-v653 recipe).
//  - The office record: the REAL 2026-11-24 live payload
//    shape captured for harness-v650 — standing Divine
//    Office (durationSec Morning 1091 / Evening 880) with
//    a whole Sing the Hours backup (Morning 1034 / Evening
//    869) — seeded as the ext resolution state (standing
//    fields + side2 promoted from backup), office drop
//    down at 'Both' (opn-office-choice-v650 = 'both').
//
// Run: node app/harness-v654.mjs
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
const BASE = 'https://app.orapronobis.media';

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
// The four office shares: card key (as the row menu stamps
// it) · side source · composed title · composed durationS.
const SIDES = [
  { key: 'ext-morning-prayer', src: 'Sing the Hours', enc: 'Sing%20the%20Hours', title: 'Morning Prayer - Sing the Hours', dur: 1034, block: 'Morning' },
  { key: 'ext-morning-prayer@do', src: 'Divine Office', enc: 'Divine%20Office', title: 'Morning Prayer - Divine Office', dur: 1091, block: 'Morning' },
  { key: 'ext-evening-prayer', src: 'Sing the Hours', enc: 'Sing%20the%20Hours', title: 'Evening Prayer - Sing the Hours', dur: 869, block: 'Evening' },
  { key: 'ext-evening-prayer@do', src: 'Divine Office', enc: 'Divine%20Office', title: 'Evening Prayer - Divine Office', dur: 880, block: 'Evening' },
];
const officeUrl = (s) => BASE + '/?s=day&date=' + DATE + '&id=' + s.key.split('@')[0] + '&src=' + s.enc + '&b=' + s.block + '&o=0';

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
check('S1 the fix stands at the one seat: shareAppUrlFor\'s &src= condition is t.source standing AND (kind external OR opnLabeledSlot650(id)), the value still the descriptor\'s own source through shareEnc640',
  (() => { const b = grab(clientSrc, 'shareAppUrlFor'); return b.includes("if (t.source && (t.kind === 'external' || opnLabeledSlot650(id))) url += '&src=' + shareEnc640(t.source);"); })(),
  {});

const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v654:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, descCardKey, shareAppUrlFor, shareLandingRead, trackPageDaySelect643, shareLandingGet: function () { return (typeof shareLanding !== "undefined" ? shareLanding : undefined); }, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COPIED = new Map();
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
  const copied = [];
  COPIED.set(w, copied);
  try { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: (t) => { copied.push(String(t)); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
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
// The real tap path to a row's share URL: row ⋮ → Share →
// the sheet's Copy link (clipboard stub captures the URL
// the sheet was built with).
async function tapShareUrl(w, key) {
  const d = w.document, copied = COPIED.get(w);
  const before = copied.length;
  const btn = d.querySelector('[data-rowmenu="' + key + '"]');
  click(w, btn);
  await sleep(180);
  const labels = menuLabels(d);
  clickMenu(w, d, 'Share');
  await sleep(120);
  const sheet = d.querySelector('.sharesheet');
  const title = sheet && sheet.querySelector('h3') ? sheet.querySelector('h3').textContent.trim() : '';
  click(w, sheet && sheet.querySelector('[data-sharecopy]'));
  await sleep(80);
  const url = copied.length > before ? copied[copied.length - 1] : null;
  if (sheet) sheet.remove();
  return { labels, title, url };
}

// ---------- World A: L1 (tap-path URLs) + L2 (landings) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintDay(w);
  const byKey = (key) => (O.state.dayDescs || []).find((x) => O.descCardKey(x) === key);
  check('A0 setup: the composed day carries all four office descriptors — each with its own source/title/duration, NO kind stamped (the production shape), both sides\' rows painted',
    SIDES.every((s) => { const x = byKey(s.key); return !!x && x.source === s.src && x.title === s.title && x.durationS === s.dur && x.kind === undefined && !!d.querySelector('[data-rowmenu="' + s.key + '"]'); }),
    { descs: (O.state.dayDescs || []).filter((x) => x.episodeId.indexOf('ext-') === 0 && (x.episodeId.includes('morning-prayer') || x.episodeId.includes('evening-prayer'))).map((x) => ({ k: O.descCardKey(x), kind: x.kind, src: x.source })) });

  const captured = {};
  for (const s of SIDES) {
    const r = await tapShareUrl(w, s.key);
    captured[s.key] = r.url;
    check('L1 ◆ ' + s.title + ': the day row\'s share link (real tap path) is the day form carrying ITS OWN &src=' + s.enc,
      r.labels.includes('Share') && r.title === s.title && r.url === officeUrl(s),
      { url: r.url, want: officeUrl(s), sheetTitle: r.title, labels: r.labels });
  }
  for (const s of SIDES) {
    const url = captured[s.key];
    let L = null, sel = null, perr = '';
    try {
      w.history.pushState(null, '', url.slice(BASE.length));
      O.shareLandingRead();
      L = O.shareLandingGet();
      if (L) sel = O.trackPageDaySelect643(L);
    } catch (e) { perr = e.message; }
    check('L2 ◆ the ' + s.src + ' ' + s.block + ' link LANDS on its own page: the landing parse stands (src carried) and the day selection returns that side\'s own descriptor (title + duration ' + s.dur + '), never the sibling\'s',
      !!L && L.src === s.src && !!sel && sel !== 'discard' && sel.title === s.title && sel.durationS === s.dur && (sel.source || '') === s.src,
      { L, sel: sel && { title: sel.title, dur: sel.durationS, src: sel.source }, perr });
  }
  w.close();
}

// ---------- World B: L3 (every other family byte-identical) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn;
  await paintDay(w);
  const r1 = await tapShareUrl(w, 'daily-rosary');
  check('L3a ◆ own built-day episode (daily-rosary) share URL byte-identical to the base: the plain day form, no &src=',
    r1.url === BASE + '/?s=day&date=' + DATE + '&id=daily-rosary', { url: r1.url });
  const r2 = await tapShareUrl(w, 'morning-prayer');
  check('L3b ◆ own standard-prayer row (morning-prayer) share URL byte-identical to the base: the plain day form, no &src=',
    r2.url === BASE + '/?s=day&date=' + DATE + '&id=morning-prayer', { url: r2.url });
  const r3 = await tapShareUrl(w, 'ext-office-of-readings');
  check('L3c ◆ non-office external day row (Office of Readings — composed, source \'Divine Office\' standing, id NOT a labeled slot) share URL byte-identical to the base: NO &src= added — the labeled-slot guard holds',
    r3.url === BASE + '/?s=day&date=' + DATE + '&id=ext-office-of-readings', { url: r3.url });
  const r4 = await tapShareUrl(w, 'daily-readings:2026-11-21');
  check('L3d ◆ podcast descriptor (the readings seat, composed kind podcast) share URL byte-identical to the base: the pod form stands',
    r4.url === BASE + '/?s=pod&series=daily-readings&id=daily-readings:2026-11-21', { url: r4.url, labels: r4.labels });
  check('L3e ◆ the homily carve-out stands: shareTrackSheet still routes a homily descriptor to the attachment share ahead of the link builder (no link is built for a homily)',
    (() => { const b = grab(clientSrc, 'shareTrackSheet'); const iH = b.indexOf('homilyShareSheet643(t)'); const iB = b.indexOf('shareAppUrlFor(t)'); return iH >= 0 && iB > iH; })(),
    {});
  w.close();
}

console.log('\nharness-v654:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
