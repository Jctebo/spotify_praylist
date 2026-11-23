// harness-v638.mjs — v638: flipping the Morning & Evening
// Prayer source choice in the Praylist edit form re-settles
// the two labeled slots IN THE STANDING SESSION (no app
// restart). The flip handler calls the re-settle hook stood
// on state by resolveExternals (state.extResettleLabeled638);
// the hook refetches the live payload, re-applies
// opnExtChoice628 over the served entries (with backups),
// and hands them to the standing settleMeta.
//
// Legs (doc §2.2):
//  L1: in-session flip to Sing the Hours first → both
//      labeled slots re-settle + repaint under Sing the
//      Hours titles, NO reload / cold start (the /api/player/day
//      fetch count does not move). Fail-on-old: the same
//      sequence on the base tree (366007b) leaves the rows
//      on Divine Office in-session.
//  L2: flip back in-session → Divine Office titles return.
//  L3: re-settle failure mid-flip — (a) the new first
//      choice's routes down → the standing failure flip
//      lands back on the previously standing source,
//      present; (b) BOTH routes down → the prior-record
//      restore guard keeps the standing rows present,
//      never missing / blank.
//  L4: the day cache the re-settle writes reads correctly
//      at the next cold start (new source stands, no
//      double-flip, the v637 prune leaves it).
//  L6: §4.1 PROBE-D fix-forward — per-slot re-settle epoch
//      supersession: (L6) a delayed first flip's download
//      landing after the flip-back settle is dropped whole;
//      (L6b) a superseded chain failing both routes does not
//      settle 'missing' over the newer present row; (L6c)
//      same-source triple flip — the stale first chain is
//      dropped even when its source equals the final choice.
//  L5: flip while a labeled slot sounds (its descriptor
//      stands as state.current and in state.queue) → the
//      sounding descriptor object + its URL stand
//      untouched; the list record takes the new source.
//
// Fixtures (Improvement D): the real served live-payload
// entries for the two labeled slots INCLUDING their backup
// objects, in the v634/v637 served shape (Divine Office
// standing + Sing the Hours backup object — the live
// payload read firsthand 2026-11-23); the day cache in the
// client's own writeCache shape (written by the leg's first
// build, the v637 harness precedent). Worlds are built over
// the v603/v597 production fixtures exactly as
// harness-v637 builds its worlds.
//
// Run: node app/harness-v638.mjs
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
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const BASE = '366007bbff9614a93643d426028ae558459e6572';
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const clientOldSrc = git(['show', BASE + ':app/worker/src/client.ts']);
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- Statics ----------
check('S1 the re-settle hook + prior-record guard stand inside resolveExternals, closing over the pass machinery',
  grab(clientSrc, 'resolveExternals').includes('state.extResettleLabeled638 = function ()')
  && grab(clientSrc, 'resolveExternals').includes('extResettlePrior638')
  && grab(clientSrc, 'resolveExternals').includes("api('/api/player/externals/live?date='")
  && grab(clientSrc, 'resolveExternals').includes('opnExtChoice628(slot, e, slot.source'));
check('S2 the flip handler calls the hook AFTER the store write, guarded for its absence',
  clientSrc.includes("opnSthFirstSet632(btn.getAttribute('data-p637sth') === 'sth'); if (state.extResettleLabeled638) state.extResettleLabeled638(); opnRepaintHome604();"));
check('S3 protected functions byte-identical vs base (choice reader/writer/consumer, choice paint, banner, edit bar)',
  ['opnSthPrimary628', 'opnSthFirstSet632', 'opnExtChoice628', 'opnSthChoiceHtml637', 'opnBannerHtml604', 'opnEditBarHtml604'].every((n) => grab(clientSrc, n) === grab(clientOldSrc, n) && grab(clientSrc, n) !== ''));
check('S4 no new store/cache key, no v638 store key, sounding mint guard stands in resolveExternals',
  !clientSrc.includes('opn-sth-first-v638') && !clientSrc.includes('opn-ext-cache-v638')
  && grab(clientSrc, 'resolveExternals').includes('sounding638'));
check('S6 §4.1 epoch supersession stands: per-slot epoch map beside the prior map, hook takes the next epoch AFTER the no-change guard, epoch rides settleMeta/extDownload incl. the backup flip, settle checks epoch before the prior guard',
  grab(clientSrc, 'resolveExternals').includes('extResettleEpoch638')
  && grab(clientSrc, 'resolveExternals').includes('epoch638 !== extResettleEpoch638[slot.slotId]')
  && grab(clientSrc, 'resolveExternals').indexOf('epoch638 !== extResettleEpoch638[slot.slotId]') < grab(clientSrc, 'resolveExternals').indexOf('extResettlePrior638[slot.slotId].rec')
  && grab(clientSrc, 'resolveExternals').includes('}, epoch638); // §4.1: the backup flip is the SAME re-settle'));

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const appJsOld = renderJs(clientOldSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S5 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v638:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const STH_KEY = 'opn-sth-first-v632';
const EXT_CACHE_KEY = 'opn-ext-cache-v1';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const SEED_ROWS = (() => {
  const at = appJs.indexOf('var OPN_SEED_SOURCES = ');
  const end = appJs.indexOf('];', at);
  return vm.runInContext('(' + appJs.slice(at + 'var OPN_SEED_SOURCES = '.length, end + 1) + ')', vm.createContext({}));
})();
const HOOK = '\n;window.__opn = { opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, opnSthPrimary628, opnSthFirstSet632, opnExtChoice628, renderPrayersSide, setTab };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The both-sources live payload, as v634/v637 serve the two
// labeled slots (Divine Office standing, Sing the Hours as
// its backup pointer) — fixture from the production shape.
const LIVE638 = { slots: [
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: 'https://do.example/mp.mp3', durationSec: 600, sizeBytes: 1000, source: 'Divine Office', backup: { streamUrl: 'https://sth.example/lauds.mp3', source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours' } },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: 'https://do.example/ep.mp3', durationSec: 600, sizeBytes: 1000, source: 'Divine Office', backup: { streamUrl: 'https://sth.example/vespers.mp3', source: 'Sing the Hours', title: 'Evening Prayer - Sing the Hours' } },
]};
// Per-leg network posture + fetch counters (the cold-start
// proof: a flip must not move the /api/player/day count).
let NET = { failPassthrough: false, failDo: false, failSth: false };
let FETCHN = { day: 0, live: 0 };
function fetchStub(url) {
  const u = String(url);
  if (u.includes('/api/player/externals/audio') && (NET.delayPassthroughMs || (NET.passthroughDelays && NET.passthroughDelays.length))) {
    // §4.1 PROBE-D posture: the Sing the Hours pass-through
    // answers LATE (Review's probe delayed it 2.5 s), so a
    // first flip's download stands in flight across a
    // second flip. NET.passthroughDelays is a per-call
    // queue (one delay per pass-through call, in order) so
    // a leg can give two chains different latencies.
    const fail = NET.failPassthrough;
    const delay = (NET.passthroughDelays && NET.passthroughDelays.length) ? NET.passthroughDelays.shift() : NET.delayPassthroughMs;
    return new Promise((resolve) => setTimeout(() => {
      if (fail) resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.reject(new Error('passthrough down')) });
      else resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.resolve(new Blob(['x'], { type: 'audio/mpeg' })) });
    }, delay));
  }
  if (u.includes('/api/player/externals/audio')) { if (NET.failPassthrough) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.reject(new Error('passthrough down')) }); }
  if (NET.failDo && u.startsWith('https://do.example/')) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.reject(new Error('do down')) });
  if (NET.failSth && u.startsWith('https://sth.example/')) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.reject(new Error('sth down')) });
  let body = {};
  if (u.includes('/api/player/source-settings')) body = { sources: SEED_ROWS, version: 7 };
  else if (u.includes('/api/player/externals/live')) { FETCHN.live++; body = LIVE638; }
  else if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) { FETCHN.day++; body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8')); }
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(''), blob: () => Promise.resolve(new Blob(['x'], { type: 'audio/mpeg' })) });
}
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  try { w.URL.createObjectURL = () => 'blob:fake-' + Math.random(); w.URL.revokeObjectURL = () => {}; } catch (e) {}
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function johnStore(extra) { return Object.assign({ [DATA_KEY]: JSON.stringify(JOHN) }, extra || {}); }
function publicDay(date) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: ['x', 'y'].map((t, i) => ({ episodeId: b + '-t' + i, title: t, state: 'present', available: true, streamUrl: 'https://example.invalid/' + b + '-' + i + '.mp3', durationS: 60 })),
    trackCount: 2,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function paintHome(w) {
  const O = w.__opn;
  const paint = () => {
    const day = O.opnFoldDay590(publicDay(TODAY));
    O.state.dayPayload = day;
    O.extRebuildDescs(day);
    O.paintPrayersView(day);
    return day;
  };
  paint();
  await sleep(600);
  paint();
}
async function enterEdit(w) {
  const d = w.document;
  if (!d.querySelector('[data-p604erow]')) {
    click(w, d.querySelector('[data-p607edit]'));
    const quick = await until(() => d.querySelector('[data-p604erow]'), 4000);
    if (!quick) { await paintHome(w); click(w, d.querySelector('[data-p607edit]')); await until(() => d.querySelector('[data-p604erow]'), 9000); }
  }
  return !!d.querySelector('[data-p604erow]');
}
function slotOf(w, sid) { const O = w.__opn; return O.state.extSlots && O.state.extSlots[sid]; }
function descOf(w, sid) { const O = w.__opn; return (O.state.dayDescs || []).find((d) => d.episodeId === sid) || null; }
async function buildDay(w) {
  const O = w.__opn;
  O.renderPrayersSide();
  const built = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present'; }, 15000);
  await sleep(500);
  return built;
}
async function flip(w, which) {
  const entered = await enterEdit(w);
  if (!entered) return false;
  click(w, w.document.querySelector('[data-p637sth="' + which + '"]'));
  return true;
}
function dumpStore(w) {
  const out = {};
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); out[k] = w.localStorage.getItem(k); }
  return out;
}

// ---------- L1: the in-session flip (no cold start) ----------
{
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  const base = { mp: slotOf(w, 'ext-morning-prayer'), ep: slotOf(w, 'ext-evening-prayer'), descs: (w.__opn.state.dayDescs || []).length, dayFetches: FETCHN.day, liveFetches: FETCHN.live };
  const flipped = await flip(w, 'sth');
  const settled = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); const ep = slotOf(w, 'ext-evening-prayer'); return mp && ep && mp.state === 'present' && ep.state === 'present' && mp.source === 'Sing the Hours' && ep.source === 'Sing the Hours'; }, 12000);
  await sleep(300);
  const mpD = descOf(w, 'ext-morning-prayer'), epD = descOf(w, 'ext-evening-prayer');
  check('L1 ◆ in-session flip to Sing the Hours first: both labeled slots re-settle in the standing session — no reload, no cold start (day fetch count unmoved, the courier refetch fired)',
    built && flipped && settled && base.mp.source === 'Divine Office' && base.ep.source === 'Divine Office'
    && FETCHN.day === base.dayFetches && FETCHN.live > base.liveFetches,
    { built, flipped, settled, dayFetches: FETCHN.day, baseDay: base.dayFetches, mp: slotOf(w, 'ext-morning-prayer') });
  check('L1b ◆ the rebuilt descriptors carry the Sing the Hours titles and stand available, descriptor count whole',
    !!mpD && !!epD && mpD.title === 'Morning Prayer - Sing the Hours' && epD.title === 'Evening Prayer - Sing the Hours'
    && mpD.available === true && epD.available === true && (w.__opn.state.dayDescs || []).length === base.descs,
    { mpD: mpD && mpD.title, epD: epD && epD.title, descs: (w.__opn.state.dayDescs || []).length, base: base.descs });
  click(w, w.document.querySelector('[data-p607done]'));
  await sleep(600);
  // The home paint is a block list; the labeled rows paint
  // on their block pages — stand the Morning block view
  // (the openBlockPage posture) and read the card, then
  // the Evening block view and read its card. Paints only:
  // no rebuild, no refetch.
  const O1 = w.__opn;
  O1.state.prayersView = { kind: 'block', block: 'Morning' };
  O1.paintPrayersView(O1.state.dayPayload);
  await sleep(400);
  const mpCard = w.document.querySelector('[data-card="ext-morning-prayer"]');
  const mpCardTxt = mpCard ? mpCard.textContent : '';
  O1.state.prayersView = { kind: 'block', block: 'Evening' };
  O1.paintPrayersView(O1.state.dayPayload);
  await sleep(400);
  const epCard = w.document.querySelector('[data-card="ext-evening-prayer"]');
  const epCardTxt = epCard ? epCard.textContent : '';
  check('L1c ◆ after Done the painted Praylist rows (Morning + Evening block pages) stand under the Sing the Hours titles in the same session',
    mpCardTxt.includes('Morning Prayer - Sing the Hours') && epCardTxt.includes('Evening Prayer - Sing the Hours'),
    { mpCardTxt: mpCardTxt.slice(0, 80), epCardTxt: epCardTxt.slice(0, 80) });
  w.close();
}
{
  // Fail-on-old: the base tree has no hook — the flip writes
  // the store and repaints the form only; the standing rows
  // stay on Divine Office in-session (John's field report).
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const w = makeWorld(appJsOld, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  const flipped = await flip(w, 'sth');
  await sleep(3000);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  const mpD = descOf(w, 'ext-morning-prayer');
  check('L1-old ◆ REPRODUCED on the base client (366007b): the in-session flip leaves both labeled slots standing on Divine Office — only a restart takes it',
    built && flipped && w.localStorage.getItem(STH_KEY) === 'on'
    && mp && mp.state === 'present' && mp.source === 'Divine Office'
    && ep && ep.source === 'Divine Office' && mpD && mpD.title === 'Morning Prayer - Divine Office',
    { mp: mp && mp.source, ep: ep && ep.source, title: mpD && mpD.title });
  w.close();
}

// ---------- L2: flip back in-session ----------
{
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await buildDay(w);
  await flip(w, 'sth');
  const toSth = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Sing the Hours'; }, 12000);
  click(w, w.document.querySelector('[data-p607done]'));
  await sleep(300);
  await flip(w, 'do');
  const back = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); const ep = slotOf(w, 'ext-evening-prayer'); return mp && ep && mp.state === 'present' && ep.state === 'present' && mp.source === 'Divine Office' && ep.source === 'Divine Office'; }, 12000);
  await sleep(300);
  const mpD = descOf(w, 'ext-morning-prayer');
  check('L2 ◆ flip back in-session: the Divine Office titles return, same session, store back to \'off\'',
    toSth && back && w.localStorage.getItem(STH_KEY) === 'off' && !!mpD && mpD.title === 'Morning Prayer - Divine Office' && mpD.available === true,
    { toSth, back, key: w.localStorage.getItem(STH_KEY), title: mpD && mpD.title });
  w.close();
}

// ---------- L3: no-blank under failure ----------
{
  // (a) The new first choice's routes down (pass-through +
  // the Sing the Hours host): the re-settle's backup IS the
  // previously standing source — the failure flip lands
  // back on Divine Office, present.
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  const baseDescs = (w.__opn.state.dayDescs || []).length;
  NET = { failPassthrough: true, failDo: false, failSth: true };
  await flip(w, 'sth');
  await sleep(4000);
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  const mpD = descOf(w, 'ext-morning-prayer');
  check('L3a ◆ re-settle with the new first choice\'s routes down: standing rows stay whole — present on the previously standing source (Divine Office), never missing, descriptor count whole',
    built && mp && mp.state === 'present' && mp.source === 'Divine Office'
    && ep && ep.state === 'present' && ep.source === 'Divine Office'
    && !!mpD && mpD.available === true && (w.__opn.state.dayDescs || []).length === baseDescs,
    { mp: mp && { state: mp.state, source: mp.source }, ep: ep && { state: ep.state, source: ep.source } });
  w.close();
}
{
  // (b) BOTH routes down for both sources: the prior-record
  // restore guard keeps the standing present rows — the
  // re-settle must not settle missing over them.
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  const baseDescs = (w.__opn.state.dayDescs || []).length;
  NET = { failPassthrough: true, failDo: true, failSth: true };
  await flip(w, 'sth');
  await sleep(5000);
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  const mpD = descOf(w, 'ext-morning-prayer');
  check('L3b ◆ both-routes failure during the flip re-settle: the prior-record restore guard stands — slots stay PRESENT on Divine Office, never missing/blank',
    built && mp && mp.state === 'present' && mp.source === 'Divine Office'
    && ep && ep.state === 'present' && ep.source === 'Divine Office'
    && !!mpD && mpD.available === true && (w.__opn.state.dayDescs || []).length === baseDescs,
    { mp: mp && { state: mp.state, source: mp.source }, ep: ep && { state: ep.state, source: ep.source } });
  w.close();
}

// ---------- L4: cache truth at the next cold start ----------
{
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await buildDay(w);
  await flip(w, 'sth');
  const settled = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Sing the Hours'; }, 12000);
  await sleep(400);
  let cache = null;
  try { cache = JSON.parse(w.localStorage.getItem(EXT_CACHE_KEY) || 'null'); } catch (e) {}
  const cacheMp = cache && cache.slots && cache.slots['ext-morning-prayer'];
  const cacheEp = cache && cache.slots && cache.slots['ext-evening-prayer'];
  check('L4a ◆ the day cache the re-settle writes (standing writeCache) carries the new standing source + its enclosure for both labeled slots',
    settled && !!cacheMp && cacheMp.state === 'present' && cacheMp.source === 'Sing the Hours' && cacheMp.streamUrl === 'https://sth.example/lauds.mp3'
    && !!cacheEp && cacheEp.source === 'Sing the Hours' && cacheEp.streamUrl === 'https://sth.example/vespers.mp3',
    { cacheMp, cacheEp });
  const store = dumpStore(w);
  w.close();
  // Cold start: a fresh world over the same store.
  const w2 = makeWorld(appJs, store);
  await sleep(400);
  const built2 = await buildDay(w2);
  await sleep(400);
  const mp2 = slotOf(w2, 'ext-morning-prayer'), ep2 = slotOf(w2, 'ext-evening-prayer');
  const mpD2 = descOf(w2, 'ext-morning-prayer');
  check('L4b ◆ next cold start reads the re-settled cache correctly: Sing the Hours stands, no double-flip, the v637 prune leaves the record',
    built2 && mp2 && mp2.state === 'present' && mp2.source === 'Sing the Hours'
    && ep2 && ep2.source === 'Sing the Hours' && !!mpD2 && mpD2.title === 'Morning Prayer - Sing the Hours',
    { mp2: mp2 && { state: mp2.state, source: mp2.source }, title: mpD2 && mpD2.title });
  w2.close();
}

// ---------- L5: flip while a labeled slot sounds ----------
{
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await buildDay(w);
  const O = w.__opn;
  const sounding = descOf(w, 'ext-morning-prayer');
  // The sounding stand-in: the slot's descriptor stands as
  // state.current and as the built queue's entry — the two
  // seats §2.1.4 names.
  O.state.current = sounding;
  O.state.queue = [sounding];
  O.state.queueIdx = 0;
  const sndUrl = sounding.url, sndTitle = sounding.title;
  await flip(w, 'sth');
  const settled = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Sing the Hours'; }, 12000);
  await sleep(300);
  const mpD = descOf(w, 'ext-morning-prayer');
  check('L5 ◆ flip while Morning Prayer sounds: the sounding descriptor (state.current / queue entry) stands untouched — same object, same URL, same title — while the slot record + rebuilt list descriptor take the new source',
    settled && O.state.current === sounding && O.state.queue[0] === sounding
    && sounding.url === sndUrl && sounding.title === sndTitle && sndTitle === 'Morning Prayer - Divine Office'
    && !!mpD && mpD !== sounding && mpD.title === 'Morning Prayer - Sing the Hours',
    { settled, curSame: O.state.current === sounding, url: sounding.url, sndUrl, listTitle: mpD && mpD.title });
  w.close();
}

// ---------- L6: §4.1 PROBE-D — the double-flip supersession ----------
{
  // Review's probe, as a standing leg: the Sing the Hours
  // pass-through is delayed 2.5 s. Flip to Sing the Hours →
  // both slots stand 'downloading' (re-settle in flight).
  // Flip back to Divine Office → the second re-settle
  // settles both slots present on Divine Office. The FIRST
  // flip's download then lands — a stale-epoch completion
  // that must be dropped whole: slots, descriptors and the
  // day cache stay on Divine Office, the store's source.
  NET = { failPassthrough: false, failDo: false, failSth: false, delayPassthroughMs: 2500 };
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  await flip(w, 'sth');
  const inFlight = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'downloading' && mp.source === 'Sing the Hours'; }, 8000);
  await flip(w, 'do');
  const newer = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); const ep = slotOf(w, 'ext-evening-prayer'); return mp && ep && mp.state === 'present' && ep.state === 'present' && mp.source === 'Divine Office' && ep.source === 'Divine Office'; }, 12000);
  await sleep(4500); // the first flip's delayed download lands inside this window
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  const mpD = descOf(w, 'ext-morning-prayer');
  let cache = null;
  try { cache = JSON.parse(w.localStorage.getItem(EXT_CACHE_KEY) || 'null'); } catch (e) {}
  const cacheMp = cache && cache.slots && cache.slots['ext-morning-prayer'];
  check('L6 ◆ PROBE-D double-flip: the superseded Sing the Hours download lands AFTER the flip-back settle and is dropped whole — both slots + descriptors stand present on Divine Office (the store\'s source), and the day cache carries Divine Office, no late settle moves them',
    built && inFlight && newer
    && mp && mp.state === 'present' && mp.source === 'Divine Office' && mp.enclosureUrl === 'https://do.example/mp.mp3'
    && ep && ep.state === 'present' && ep.source === 'Divine Office'
    && !!mpD && mpD.title === 'Morning Prayer - Divine Office' && mpD.available === true
    && w.localStorage.getItem(STH_KEY) === 'off'
    && !!cacheMp && cacheMp.source === 'Divine Office' && cacheMp.streamUrl === 'https://do.example/mp.mp3',
    { inFlight, newer, mp: mp && { state: mp.state, source: mp.source }, ep: ep && { state: ep.state, source: ep.source }, cacheMp });
  w.close();
}
{
  // The stale-'missing' twin: the superseded chain's routes
  // BOTH fail after the newer settle lands (the newer
  // present settle has already discharged the prior-record
  // guard, so on the pre-fix tree the stale 'missing'
  // settle blanks the standing row). Posture: the delayed
  // pass-through fails at 2.5 s, the Sing the Hours host
  // fails at once; once the flip-back settle stands, the
  // Divine Office host is cut too, so the stale chain's
  // v628 backup flip (to Divine Office) fails both of its
  // routes as well — its terminal outcome is 'missing'.
  NET = { failPassthrough: true, failDo: false, failSth: true, delayPassthroughMs: 2500 };
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  await flip(w, 'sth');
  const inFlight = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'downloading' && mp.source === 'Sing the Hours'; }, 8000);
  await flip(w, 'do');
  const newer = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); const ep = slotOf(w, 'ext-evening-prayer'); return mp && ep && mp.state === 'present' && ep.state === 'present' && mp.source === 'Divine Office' && ep.source === 'Divine Office'; }, 12000);
  NET.failDo = true; // the stale chain's backup flip now fails both routes too
  await sleep(7000); // the stale chain reaches its 'missing' outcome inside this window
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  const mpD = descOf(w, 'ext-morning-prayer');
  check('L6b ◆ stale-missing twin: the superseded chain fails both routes (incl. its backup flip) after the newer settle — it does NOT settle missing over the newer present row; both slots stand present on Divine Office',
    built && inFlight && newer
    && mp && mp.state === 'present' && mp.source === 'Divine Office'
    && ep && ep.state === 'present' && ep.source === 'Divine Office'
    && !!mpD && mpD.available === true,
    { inFlight, newer, mp: mp && { state: mp.state, source: mp.source }, ep: ep && { state: ep.state, source: ep.source } });
  w.close();
}
{
  // Same-source interleaving (§4.1): flip to Sing the Hours
  // (chain 1), flip back to Divine Office (chain 2 settles),
  // flip to Sing the Hours AGAIN (chain 3). The store's
  // final source IS Sing the Hours — but chain 1 is stale
  // (epoch 1 != current epoch 3), so its late present must
  // NOT stand; only chain 3 may settle the slot. The chains
  // are made distinguishable: per-call pass-through delays
  // (chain 1: 2.5 s per slot, chain 3: 6 s per slot) and,
  // before the third flip, the served Sing the Hours backup
  // pointers move to -v2 enclosures, so chain 3's record
  // carries lauds-v2.mp3 while chain 1's carries lauds.mp3.
  // Proof shape: across the whole window after chain 1
  // lands, the slot NEVER stands present on chain 1's
  // enclosure; the final present + cache carry chain 3's.
  NET = { failPassthrough: false, failDo: false, failSth: false, passthroughDelays: [2500, 2500, 6000, 6000] };
  const w = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  await flip(w, 'sth');
  const inFlight = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'downloading' && mp.source === 'Sing the Hours'; }, 8000);
  await flip(w, 'do');
  const newer = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Divine Office'; }, 12000);
  const origMpBackup = LIVE638.slots[0].backup.streamUrl, origEpBackup = LIVE638.slots[1].backup.streamUrl;
  LIVE638.slots[0].backup.streamUrl = 'https://sth.example/lauds-v2.mp3';
  LIVE638.slots[1].backup.streamUrl = 'https://sth.example/vespers-v2.mp3';
  await flip(w, 'sth');
  const third = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'downloading' && mp.enclosureUrl === 'https://sth.example/lauds-v2.mp3'; }, 8000);
  // Chain 1 lands ~2.5 s after its start (inside this 4 s
  // watch); chain 3 cannot land for ~6 s. Any standing
  // present on chain 1's enclosure in the window is a
  // stale settle standing.
  let staleStood = false;
  const watchEnd = Date.now() + 4000;
  while (Date.now() < watchEnd) {
    const mpw = slotOf(w, 'ext-morning-prayer');
    if (mpw && mpw.state === 'present' && mpw.enclosureUrl === 'https://sth.example/lauds.mp3') staleStood = true;
    await sleep(50);
  }
  const settled = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); const ep = slotOf(w, 'ext-evening-prayer'); return mp && ep && mp.state === 'present' && ep.state === 'present' && mp.enclosureUrl === 'https://sth.example/lauds-v2.mp3' && ep.enclosureUrl === 'https://sth.example/vespers-v2.mp3'; }, 15000);
  await sleep(400);
  LIVE638.slots[0].backup.streamUrl = origMpBackup;
  LIVE638.slots[1].backup.streamUrl = origEpBackup;
  NET = { failPassthrough: false, failDo: false, failSth: false };
  const mp = slotOf(w, 'ext-morning-prayer');
  const mpD = descOf(w, 'ext-morning-prayer');
  let cache = null;
  try { cache = JSON.parse(w.localStorage.getItem(EXT_CACHE_KEY) || 'null'); } catch (e) {}
  const cacheMp = cache && cache.slots && cache.slots['ext-morning-prayer'];
  check('L6c ◆ same-source triple flip (StH → DO → StH): the first StH chain is stale and dropped even though its source equals the final store choice — it never stands present on its own enclosure after landing, and the CURRENT (third) chain settles the slot present on Sing the Hours; final state + cache match the store (\'on\')',
    built && inFlight && newer && third && !staleStood
    && settled && mp && mp.state === 'present' && mp.source === 'Sing the Hours'
    && !!mpD && mpD.title === 'Morning Prayer - Sing the Hours'
    && w.localStorage.getItem(STH_KEY) === 'on'
    && !!cacheMp && cacheMp.source === 'Sing the Hours' && cacheMp.streamUrl === 'https://sth.example/lauds-v2.mp3',
    { inFlight, newer, third, staleStood, settled, mp: mp && { state: mp.state, source: mp.source, enclosureUrl: mp.enclosureUrl }, cacheMp });
  w.close();
}

console.log('\nharness-v638:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
