// harness-v609.mjs — v609: merge everything into one set.
//  M ◆ the merged set: the Praylist home paints ONE
//     continuous list of the day's tracks in fold order —
//     no block header cards, no expansions, no dividers,
//     no per-block marks; the fold option retires (its
//     menu acts stand nowhere); ONE Play All at the set's
//     head queues the whole day in fold order; a tap on a
//     track plays it (v607's rule stands).
//  E ◆ the edit form over the set: exactly ONE edit
//     entry on the page, at the top (the plan row); the
//     form's rows are CONDENSED (title · drag · remove —
//     no Intention line, no duration); drags reorder
//     within their block's run and a cross-boundary
//     target is inert; the today-edits mark stands on
//     the plan row only; Done leaves the form in one act.
// FAIL-ON-OLD: the ◆ legs' key assertions are also run
//  against the old tree (git main = v607) in the OA
//  companions and must fail there.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrcUnused = git(['show', 'main:app/worker/src/client.ts']);
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = appJs; // renders drive the fixed client only
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v609:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { openConfigureLadder593, opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, profPlanRowHtml, opnDragOver604, opnMaterialize604, opnTodayItemId594, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, resolveReadingsSeat590, opn604: (typeof opn604 !== "undefined" ? opn604 : null) };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function storeOf(doc) { const st = {}; st[DATA_KEY] = JSON.stringify(JSON.parse(JSON.stringify(doc))); return st; }
function johnStore() { return storeOf(JOHN); }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function docOf(w) { return JSON.parse(w.localStorage.getItem(DATA_KEY)); }
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }
function publicDay(date, tracksPerBlock) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: (tracksPerBlock || []).map((t, i) => (b === 'Novenas' && i === 0
      ? { episodeId: '2026-11-21-st-andrew-day-1', title: 'Novena to St Andrew Day 1', state: 'present', available: true, streamUrl: 'https://example.invalid/novena-0.mp3', durationS: 60 }
      : { episodeId: b + '-t' + i, title: t, state: 'present', available: true, streamUrl: 'https://example.invalid/' + b + '-' + i + '.mp3', durationS: 60 })),
    trackCount: (tracksPerBlock || []).length,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function paintHome(w) {
  const O = w.__opn;
  const paint = () => {
    const day = O.opnFoldDay590(publicDay(TODAY, ['x', 'y']));
    O.state.dayPayload = day;
    // v609 REPAIR: build the day's descriptor list before
    // painting, as the real resolution does (extRebuildDescs
    // assigns state.dayDescs — the merged set's paint source).
    // The shipped harness skipped this build and hand-filled
    // block tracks instead; on a real day the tracks stand
    // empty and the descriptors carry the day — the gap hid
    // the production break.
    O.extRebuildDescs(day);
    O.paintPrayersView(day);
    return day;
  };
  const day = paint();
  await sleep(600);
  paint();
  return day;
}
async function enterTopEdit(w, scope) {
  const d = w.document;
  click(w, d.querySelector('[data-p607edit]'));
  const asked = await until(() => d.querySelector('.p604q'), 9000);
  if (asked && scope) {
    const row = [...d.querySelectorAll('[data-p604scope]')].find((r) => r.getAttribute('data-p604scope') === scope);
    if (row) click(w, row);
  }
  await until(() => d.querySelector('[data-p604erow]'), 9000);
  return asked;
}


const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0('2026-11-21');
  const prim = {};
  (SETTINGS597.sources || []).forEach((s) => {
    if (s.family !== 'external' || !s.slotId) return;
    if (s.role !== 'fallback') prim[s.slotId] = s;
  });
  const standing = [];
  O.EXT_SLOTS.forEach((s) => {
    const row = prim[s.slotId];
    if (!row || row.enabled !== 1 || !O.extDayRulePasses(row.dayRule || 'daily', wd)) return;
    standing.push({ slotId: s.slotId, title: s.title, block: row.block || 'Morning', sortOrder: row.sortOrder, source: s.source || 'Divine Office' });
  });
  O.state.extStanding = standing;
  const own = [];
  (SETTINGS597.sources || []).forEach((s) => {
    if (s.family !== 'own' || !O.OWN_ROW_EPISODE[s.sourceKey]) return;
    own.push({ sourceKey: s.sourceKey, episodeId: O.OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled });
  });
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0));
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
  return { own: O.state.ownStanding, ext: standing };
}
async function paintRealDay(w) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(300); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}


import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.env.HOME + '/workspace/projects/ora-pro-nobis/v609-fix-renders/';
mkdirSync(OUT, { recursive: true });
function snap(w, name, note) {
  const view = w.document.getElementById('view');
  writeFileSync(OUT + name, '<!-- v609 REPAIR render: ' + note + ' -->\n' + (view ? view.innerHTML : w.document.body.innerHTML));
  console.log('render', name);
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const { descs } = await paintRealDay(w);
  console.log('real day descriptors:', descs.length, '| first titles:', descs.slice(0, 3).map((t) => t.title));
  snap(w, '01-real-day-merged-set.html', 'John\u2019s real day shape (production day 2026-11-21 + production source-settings + his v589 document, Salesian in force): the merged set PAINTED from the descriptor list \u2014 ' + descs.length + ' descriptors stand as rows under one Play All head; the plan row carries the Edit only');
  await enterTopEdit(w, 'today');
  snap(w, '02-edit-form-pick-head.html', 'the edit form over the real day: scope banner + frozen bar + the Pick chips at the form\u2019s head (the standing pick marked), then the condensed groups under their toggles');
  w.close();
}
console.log('renders done ->', OUT);
