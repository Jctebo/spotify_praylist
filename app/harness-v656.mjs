// harness-v656.mjs — v656: Virtual Mass videos addable to
//  the Praylist (contents kind 'video'), Play B hand-off.
//  The standing vm harness form over the real client.ts
//  (the harness-v654/v614 recipe): production fixtures, real
//  tap paths, composed descriptors from extRebuildDescs —
//  no leg hand-builds a descriptor the production seam
//  would not produce.
//
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v656/catholictv.json · dailytvmass.json
//    · springfieldmass.json — the LIVE
//    /api/player/podcasts?series=<key> payloads captured
//    2026-11-24 from the production route
//    https://app.orapronobis.media (kind 'video', real video
//    ids/titles/dates), captured at Implement time.
//  - tests/fixtures-v597/production-day-2026-11-21.json +
//    production-source-settings.json — the production day
//    payload and John's source settings (the v653/v654
//    recipe), for the composed audio descriptors.
//  - John's profile document
//    (john-personal-data-import-v589.json, podcastListens
//    stripped as in v603/v611/v614).
//  - The YT IFrame API is stubbed: a fake YT.Player capturing
//    the events wiring, firing state changes on demand. The
//    frame's src and the wiring are the real client's.
//
// Legs (Plan §3): (a) ladder + validators · (b) editor round
//  trips · (c) Play B element · (d) marks · (e) no-video
//  regression · (f) native boundary · (g) fail-on-old against
//  the pristine base 88fa1c9 (v655 ship tree).
//
// Run: node app/harness-v656.mjs
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
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const CTV = JSON.parse(readFileSync(APP + 'tests/fixtures-v656/catholictv.json', 'utf8'));
const DTV = JSON.parse(readFileSync(APP + 'tests/fixtures-v656/dailytvmass.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const V1 = CTV.videos[0]; // catholictv newest
const V2 = CTV.videos[1];
const D1 = DTV.videos.find((v) => v.title.includes('Daily TV Mass')) || DTV.videos[3];
const ITEM1 = { kind: 'video', key: 'catholictv|' + V1.id };
const ITEM2 = { kind: 'video', key: 'catholictv|' + V2.id };
const REG = { ['catholictv|' + V1.id]: { title: V1.title, seriesTitle: 'Catholic TV Mass' }, ['catholictv|' + V2.id]: { title: V2.title, seriesTitle: 'Catholic TV Mass' } };

// ---------- statics ----------
check('S1 pin stands at ora-pro-nobis-v656-1', (uiSrc.match(/ora-pro-nobis-v\d+-\d+/) || [])[0] === 'ora-pro-nobis-v656-1');
check('S2 the video seams stand in the client: key predicate, resolver, divert, hand-off acts, truncation, ladder node',
  ['function opnVideoKeyOk656(key)', 'function resolveProfileVideos656(day)', 'function openVideoHandoff656(desc)',
   'function finishVideoHandoff656(fromEnd)', 'function handoffAdvance656(rec)', 'function videoNode656(series)',
   'nativeVideoBoundary656 = descs[i]', "desc.kind === 'video' && desc.available"].every((x) => clientSrc.includes(x)));
check('S3 the server validator carries the video branch with the three standing series',
  indexSrc.includes('kind === "video"') && indexSrc.includes('"catholictv", "dailytvmass", "springfieldmass"'));

// ---------- render ----------
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
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

// ---------- server validator extraction (v603/v614 recipe) ----------
function extractServerFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('server fn not found: ' + name);
  const nl = src.indexOf('\n', start);
  let i = src.lastIndexOf('{', nl);
  let depth = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(start, j + 1);
}
function stripServerValidate(src) {
  let f = extractServerFn(src, 'validateProfileContents');
  const reps = [
    ['function validateProfileContents(contents: unknown, coreBlocks: string[]): { normalized?: Record<string, { kind: string; key?: string }[]> } | { error: string } {', 'function validateProfileContents(contents, coreBlocks) {'],
    ['const out: Record<string, { kind: string; key?: string }[]> = {};', 'const out = {};'],
    ['Object.entries(contents as Record<string, unknown>)', 'Object.entries(contents)'],
    ['const seen = new Set<string>();', 'const seen = new Set();'],
    ['const list: { kind: string; key?: string }[] = [];', 'const list = [];'],
    ['const it = (raw && typeof raw === "object" ? raw : {}) as { kind?: unknown; key?: unknown };', 'const it = (raw && typeof raw === "object" ? raw : {});'],
    ['list.push({ kind: kind as string, key: key as string });', 'list.push({ kind: kind, key: key });'],
  ];
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error('server validate shape moved: ' + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
const serverValidate = new Function(stripServerValidate(indexSrc) + '\nreturn validateProfileContents;')();

// ---------- worlds ----------
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v656:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnLocalApi, opnDoc, opnFoldDay590, opnCheckContents590, opnContentsOf590, opnVideoKeyOk656, opnVideoTitle656, opnItemLabel604, resolveProfileVideos656, resolveProfileCourses590, resolveReadingsSeat590, resolveProfileEpisodes614, extRebuildDescs, paintPrayersView, openProfilesScreen, trackCard, startQueue, advanceQueue, startDesc, playTrack, playNext, addToQueue, resumeCurrent, applyNativeState, nativeContractFor, oraNativeMode, discQueue618, opnTrackUnplayed615, opnCounts615, dayRowMarkItem639, isPlayedDesc, writePlayed, openDayRowMenu, openPlayerMenu, closeWatch, MASS_VIRTUAL_ENTRIES, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, getHandoff656: function () { return videoHandoff656; }, getBoundary656: function () { return nativeVideoBoundary656; }, getPodWatch656: function () { return podWatch; } };';
const OLD_HOOK = '\n;window.__opn = { state, opnFoldDay590, opnCheckContents590, nativeContractFor, MASS_VIRTUAL_ENTRIES, openProfilesScreen, opnLocalApi, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return !!el; }
function type(w, inp, text) { if (inp) { inp.value = text; inp.dispatchEvent(new w.Event('input', { bubbles: true })); } }

function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=catholictv')) body = CTV;
  else if (u.includes('/api/player/podcasts?series=dailytvmass')) body = DTV;
  else if (u.includes('/api/player/podcasts?series=springfieldmass')) body = { ok: true, kind: 'podcast', series: 'springfieldmass', entries: [] }; // a non-video payload: resolves nothing
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' };
  else if (u.includes('/api/player/podcasts?series=bible-in-a-year')) body = BIBLE;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { series: sk, entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js, store, bridge, hook) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  // jsdom's HTMLMediaElement.play() is unimplemented and
  // returns undefined — the client's loadDescAudio calls
  // .catch on it. Stub play/pause on the prototype (the
  // standing harness posture: playback state is driven by
  // dispatched events, not by the element).
  try { w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; w.HTMLMediaElement.prototype.pause = function () {}; } catch (e) {}
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(undefined), keys: () => Promise.resolve([]) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + (hook || HOOK);
  w.document.body.appendChild(s);
  if (bridge) w.Capacitor = { Plugins: { OraDayBridge: bridge } };
  // The YT IFrame API stub: captures the events wiring of
  // every YT.Player the client constructs.
  w.__yt = [];
  w.YT = { Player: function (frame, opts) { w.__yt.push(opts); this.__opts = opts; }, PlayerState: { ENDED: 0 } };
  return w;
}
function johnStore(mut, extra) {
  const doc = JSON.parse(JSON.stringify(JOHN));
  if (mut) mut(doc);
  const st = {}; st[DATA_KEY] = JSON.stringify(doc);
  return Object.assign(st, extra || {});
}
function setSalMorning(doc, items) {
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
  sal.contents = Object.assign({}, sal.contents || {}, { Morning: items });
}
function syntheticDay(date) {
  const blocks = ['Morning', 'Midday', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function fold656(w, date, waitKeys) {
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay(date));
  O.state.dayPayload = day;
  O.state.ownStanding = []; O.state.extStanding = [];
  O.state.ownSlots = {}; O.state.extSlots = {};
  O.resolveProfileVideos656(day);
  if (waitKeys) await until(() => O.state.videoRes656 && waitKeys.every((k) => O.state.videoRes656['Morning:' + k]), 6000).catch(() => false);
  await sleep(200);
  return { day, descs: O.extRebuildDescs(day) || [] };
}
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }
async function openProfiles(w) { w.__opn.openProfilesScreen(null, {}); return until(() => w.document.querySelector('[data-p591add="Morning"]')); }
async function openLadder(w, block) {
  await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="' + (block || 'Morning') + '"]'));
  return until(() => w.document.querySelector('.profaddladder603'));
}
function door(w, val) { return w.document.querySelector('[data-p603door="' + val + '"]'); }
function ladderText(w) { const l = w.document.querySelector('.profaddladder603'); return l ? l.textContent : ''; }
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
// The composed world: the production day folded, with the
// given video items appended to the effective Morning
// contents, resolved through the real resolver, and rebuilt
// through extRebuildDescs — every descriptor under test is
// the composed one.
async function composedWorld(store, bridge, items) {
  const w = makeWorld(appJs, store, bridge);
  await sleep(400);
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  O.state.dayPayload = day;
  if (!day.profile.contents) day.profile.contents = {};
  if (!Array.isArray(day.profile.contents.Morning)) day.profile.contents.Morning = [];
  (items || []).forEach((it) => day.profile.contents.Morning.push(it));
  O.resolveProfileVideos656(day);
  await until(() => O.state.videoRes656 && (items || []).every((it) => O.state.videoRes656['Morning:' + it.key]), 6000).catch(() => false);
  await sleep(150);
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(150);
  return { w, O, day, descs };
}
const ytEnd = (w) => { const p = w.__yt[w.__yt.length - 1]; if (p && p.events && p.events.onStateChange) p.events.onStateChange({ data: 0 }); };
const audioEnd = async (w) => { const a = w.document.getElementById('audio'); if (a) a.dispatchEvent(new w.Event('ended')); await sleep(120); };

// ---------- (a) validators + read seam ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(300);
  const O = w.__opn;
  const core = ['Morning', 'Midday', 'Evening', 'Night'];
  const battery = [
    { Morning: [ITEM1] },
    { Morning: [{ kind: 'video', key: 'hulu|abc123' }] },
    { Morning: [{ kind: 'video', key: 'no-pipe' }] },
    { Morning: [{ kind: 'video', key: 'catholictv|' }] },
    { Morning: [{ kind: 'video' }] },
    { Morning: [ITEM1, ITEM1] },
    { Novenas: [ITEM1] },
    { Midday: [{ kind: 'video', key: 'springfieldmass|EdmQlVx3BU0' }] },
  ];
  let agree = true, kept = false;
  for (const item of battery) {
    let cOut, cErr = null;
    try { cOut = O.opnCheckContents590(JSON.parse(JSON.stringify(item)), core); } catch (e) { cErr = String(e && e.message || e); }
    const sOut = serverValidate(JSON.parse(JSON.stringify(item)), core);
    const cNorm = cErr ? { error: cErr.replace(/^\d+ /, '') } : { normalized: cOut };
    const sNorm = sOut.error ? { error: sOut.error } : sOut;
    if (JSON.stringify(cNorm) !== JSON.stringify(sNorm)) { agree = false; console.log('parity diff:', JSON.stringify(item), 'client:', JSON.stringify(cNorm), 'server:', JSON.stringify(sNorm)); }
    if (JSON.stringify(cOut || {}).includes('"video"')) kept = true;
  }
  check('(a1) validator parity: a video item is kept in a core block on BOTH validators; a foreign series, a malformed key and a keyless item are errors on both; a video in the Novenas block is an error on both; a duplicate dedupes away on both', agree && kept, { agree, kept });
  const seam = O.opnContentsOf590({ contents: { Morning: [ITEM1, { kind: 'video', key: 'hulu|x1' }, { kind: 'video', key: 'no-pipe' }, { kind: 'source', key: 'abc' }] } });
  check('(a2) the read seam passes a well-formed video item and filters foreign/malformed ones',
    !!seam && seam.Morning.length === 2 && seam.Morning[0].kind === 'video' && seam.Morning[1].kind === 'source', seam);
  check('(a3) opnVideoKeyOk656: the three standing series pass; a foreign series and malformed keys fail',
    O.opnVideoKeyOk656('catholictv|x') && O.opnVideoKeyOk656('dailytvmass|x') && O.opnVideoKeyOk656('springfieldmass|x')
    && !O.opnVideoKeyOk656('hulu|x') && !O.opnVideoKeyOk656('catholictv|') && !O.opnVideoKeyOk656('nope'));
  w.close();
}

// ---------- resolver + placement (feeds legs b/c/d) ----------
{
  const w = makeWorld(appJs, johnStore((doc) => setSalMorning(doc, [ITEM1, { kind: 'video', key: 'dailytvmass|' + D1.id }, { kind: 'video', key: 'catholictv|rotted656' }, { kind: 'video', key: 'springfieldmass|EdmQlVx3BU0' }])));
  await sleep(300);
  const O = w.__opn;
  const { descs } = await fold656(w, DATE, ['catholictv|' + V1.id, 'dailytvmass|' + D1.id, 'catholictv|rotted656']);
  const vids = descs.filter((d) => d.kind === 'video');
  const found = vids.find((d) => d.videoId === V1.id);
  check('(r1) the resolver stands composed descriptors at their contents positions: found videos carry episodeId yt:<id>, kind video, url null, available true, the payload title/image/dateLabel, video656',
    vids.length === 3 && !!found && found.episodeId === 'yt:' + V1.id && found.url === null && found.available === true
    && found.title === V1.title && found.imageUrl === V1.imageUrl && found.dateLabel === V1.dateLabel && found.video656 === true && found._block === 'Morning',
    vids.map((d) => d.episodeId + '|' + d.available));
  const miss = vids.find((d) => d.videoId === 'rotted656');
  check('(r2) MISS: a rotted video stands available:false with the registry fallback title (series title + Video) — never silently gone',
    !!miss && miss.available === false && miss.episodeId === 'yt:rotted656' && miss.title === 'Catholic TV Mass \u00b7 Video', miss && miss.title);
  check('(r3) a non-video payload resolves NOTHING for its series (the springfieldmass item stands unresolved, no descriptor)',
    !O.state.videoRes656['Morning:springfieldmass|EdmQlVx3BU0'] && !vids.some((d) => d.vmSeries === 'springfieldmass'));
  const reg = JSON.parse(w.localStorage.getItem('opn-video-reg-v656') || '{}');
  check('(r4) the resolver writes the title registry for EVERY video in the fetched payloads, and opnVideoTitle656 reads the real title back',
    Object.keys(reg).filter((k) => k.indexOf('catholictv|') === 0).length === CTV.videos.length
    && Object.keys(reg).filter((k) => k.indexOf('dailytvmass|') === 0).length === DTV.videos.length
    && O.opnVideoTitle656('catholictv|' + V1.id) === V1.title);
  const card = O.trackCard(Object.assign({}, found));
  const missCard = O.trackCard(Object.assign({}, miss));
  check('(r5) the Praylist row paints a video whole: Video · <series title> meta, its thumbnail, no Intention line; the miss card reads Not available',
    card.includes('Video \u00b7 Catholic TV Mass') && card.includes(V1.imageUrl) && !card.includes('Intention:') && missCard.includes('Not available'), card.slice(0, 200));
  w.close();
}

// ---------- (a) the ladder ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(300);
  await openLadder(w);
  click(w, door(w, 'br:worship')); await sleep(60);
  click(w, door(w, 'lf:virtual-mass')); await sleep(60);
  const leafTxt = ladderText(w);
  check('(a4) S1 retires: Worship \u203a Virtual Mass paints the three series doors (Catholic TV Mass \u00b7 Daily TV Mass \u00b7 Springfield Mass), NOT "Nothing to add"',
    !!door(w, 'vmass:catholictv') && !!door(w, 'vmass:dailytvmass') && !!door(w, 'vmass:springfieldmass') && !leafTxt.includes('Nothing to add'), leafTxt.slice(0, 160));
  click(w, door(w, 'vmass:catholictv'));
  await until(() => w.document.querySelector('[data-p603additem="video:catholictv|' + V1.id + '"]'), 6000);
  const rows = [...w.document.querySelectorAll('.profaddladder603 [data-p603additem]')];
  const inp = w.document.querySelector('[data-p603search]');
  check('(a5) a series node lists its videos by name in payload order through the standing rows; the search pill reads Search videos on a vmass node',
    rows.length === CTV.videos.length && rows[0].getAttribute('data-p603additem') === 'video:catholictv|' + V1.id && !!inp && inp.getAttribute('placeholder') === 'Search videos',
    { n: rows.length, ph: inp && inp.getAttribute('placeholder') });
  click(w, rows[0]);
  await until(() => !w.document.querySelector('.profaddladder603'), 3000);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  const landed = await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === 'salesian'); return s && ((s.contents && s.contents.Morning) || []).some((it) => it.kind === 'video' && it.key === 'catholictv|' + V1.id); }, 6000);
  check('(a6) a pick writes {kind:video, key:<series>|<id>} into the block\u2019s contents through the host (the profile save lands it)', landed);
  await openLadder(w);
  click(w, door(w, 'br:worship')); await sleep(60);
  click(w, door(w, 'lf:virtual-mass')); await sleep(60);
  click(w, door(w, 'vmass:catholictv'));
  await until(() => ladderText(w).includes('Already in Morning'), 6000);
  const stood = [...w.document.querySelectorAll('.profaddladder603 .bookrow')].find((r) => r.textContent.includes(V1.title));
  check('(a7) dupes A: the standing video paints Already in Morning and is not tappable (no add item on its row)',
    !!stood && !stood.hasAttribute('data-p603additem') && stood.textContent.includes('Already in Morning'), stood && stood.textContent.slice(0, 120));
  const inpRoot = w.document.querySelector('[data-p603search]');
  click(w, w.document.querySelector('[data-p603back]')); await sleep(60);
  click(w, w.document.querySelector('[data-p603back]')); await sleep(60);
  click(w, w.document.querySelector('[data-p603back]')); await sleep(60);
  type(w, w.document.querySelector('[data-p603search]'), 'Catholic Mass Today');
  await sleep(150);
  check('(a8) head search carries NO video group: a video title fragment offers no video add row',
    ![...w.document.querySelectorAll('.profaddladder603 [data-p603additem]')].some((r) => (r.getAttribute('data-p603additem') || '').indexOf('video:') === 0),
    ladderText(w).slice(0, 160));
  w.close();
}

// ---------- (b) editor round trips ----------
{
  const store = johnStore((doc) => setSalMorning(doc, [ITEM1, ITEM2]), { 'opn-video-reg-v656': JSON.stringify(REG) });
  const w = makeWorld(appJs, store);
  await sleep(300);
  const O = w.__opn;
  check('(b1) the editor label seat reads the registry title (opnItemLabel604 \u2192 opnVideoTitle656), with the series fallback before the registry has seen a video',
    O.opnItemLabel604('Morning', ITEM1) === V1.title && O.opnVideoTitle656('dailytvmass| unseen1') === 'Daily TV Mass \u00b7 Video');
  const rt = O.opnCheckContents590({ Morning: [ITEM1, ITEM2] }, ['Morning', 'Midday', 'Evening', 'Night']);
  check('(b2) a save through opnCheckContents590 round-trips byte-equal',
    JSON.stringify(rt) === JSON.stringify({ Morning: [ITEM1, ITEM2] }), rt);
  await openProfiles(w);
  const rowsTxt = [...w.document.querySelectorAll('[data-p591cremove]')].map((b) => b.getAttribute('data-p591cremove'));
  const edText = w.document.body.textContent;
  check('(b3) the item stands in the profile editor\u2019s contents at its position with its registry label and its remove act',
    rowsTxt.some((x) => x.includes('video:catholictv|' + V1.id)) && edText.includes(V1.title), rowsTxt.slice(0, 4));
  const down = [...w.document.querySelectorAll('[data-p591cdown]')].find((b) => (b.getAttribute('data-p591cdown') || '').includes(V1.id));
  if (down) click(w, down);
  await sleep(80);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  const moved = await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === 'salesian'); const m = (s && s.contents && s.contents.Morning) || []; return m.length >= 2 && m[0].key === ITEM2.key && m[1].key === ITEM1.key; }, 6000);
  check('(b4) the standing move act reorders the video items and the save lands the new order', moved);
  w.close();
}

// ---------- (c) Play B, element engine ----------
{
  const { w, O, descs } = await composedWorld(johnStore(), null, [ITEM1]);
  const a1 = descs.find((d) => d.episodeId === 'morning-prayer');
  const a2 = descs.find((d) => d.episodeId === 'daily-rosary');
  const vid = descs.find((d) => d.kind === 'video');
  check('(c0) setup: the composed day carries the audio tracks and the resolved video descriptor in Morning',
    !!a1 && !!a2 && !!vid && vid.available === true, { a1: !!a1, a2: !!a2, vid: !!vid });
  drive(() => O.startQueue([a1, vid, a2]));
  await sleep(100);
  check('(c1) the block plays its first audio track (no hand-off yet)', !!O.state.current && O.state.current.episodeId === 'morning-prayer' && !O.getHandoff656());
  await audioEnd(w);
  const frame = w.document.querySelector('iframe.podwatch-frame');
  check('(c2) \u25c6 audio 1 ends \u2192 the hand-off watch stands: frame src is the video\u2019s embed URL, podWatch + videoHandoff656 set, the element paused, current is the video',
    !!O.getHandoff656() && !!O.getPodWatch656() && !!frame && frame.getAttribute('src') === 'https://www.youtube.com/embed/' + V1.id + '?enablejsapi=1&autoplay=1&rel=0'
    && !!O.state.current && O.state.current.kind === 'video' && w.document.getElementById('audio').paused === true,
    { src: frame && frame.getAttribute('src'), handoff: !!O.getHandoff656() });
  ytEnd(w);
  await sleep(150);
  check('(c3) \u25c6 ENDED \u2192 the video\u2019s played mark stands in the day store, the watch is torn down, and audio 2 starts',
    O.isPlayedDesc(vid, DATE) === true && !O.getHandoff656() && !w.document.querySelector('iframe.podwatch-frame')
    && !!O.state.current && O.state.current.episodeId === 'daily-rosary',
    { marked: O.isPlayedDesc(vid, DATE), current: O.state.current && O.state.current.episodeId });
  w.close();
}
{
  // Early close: the back act finishes without a mark.
  const { w, O, descs } = await composedWorld(johnStore(), null, [ITEM1]);
  const a1 = descs.find((d) => d.episodeId === 'morning-prayer');
  const a2 = descs.find((d) => d.episodeId === 'daily-rosary');
  const vid = descs.find((d) => d.kind === 'video');
  drive(() => O.startQueue([a1, vid, a2]));
  await sleep(100);
  await audioEnd(w);
  const back = w.document.querySelector('[data-vwatchback656]');
  check('(c4) the hand-off watch\u2019s back act stands in the row-2 bar (dest Praylist)', !!back && !!O.getHandoff656());
  click(w, back);
  await sleep(150);
  check('(c5) \u25c6 early close \u2192 NO mark, and the block\u2019s audio resumes after the video',
    O.isPlayedDesc(vid, DATE) === false && !!O.state.current && O.state.current.episodeId === 'daily-rosary',
    { marked: O.isPlayedDesc(vid, DATE), current: O.state.current && O.state.current.episodeId });
  w.close();
}
{
  // Video first / video last / two videos / miss / single play.
  const { w, O, descs } = await composedWorld(johnStore(), null, [ITEM1, ITEM2, { kind: 'video', key: 'catholictv|rotted656' }]);
  const a1 = descs.find((d) => d.episodeId === 'morning-prayer');
  const vids = descs.filter((d) => d.kind === 'video');
  const v1 = vids.find((d) => d.videoId === V1.id), v2 = vids.find((d) => d.videoId === V2.id), miss = vids.find((d) => d.videoId === 'rotted656');
  drive(() => O.startQueue([v1, a1]));
  await sleep(120);
  check('(c6) video FIRST: the birth scan diverts at index 0 — the video opens with nothing played', !!O.getHandoff656() && O.state.current === v1 || (!!O.getHandoff656() && !!O.state.current && O.state.current.videoId === V1.id), { cur: O.state.current && O.state.current.episodeId });
  ytEnd(w); await sleep(150);
  check('(c7) finish advances into the block\u2019s audio', !!O.state.current && O.state.current.episodeId === 'morning-prayer');
  // two videos chain
  drive(() => O.startQueue([v1, v2, a1]));
  await sleep(120);
  const h1 = !!O.getHandoff656();
  ytEnd(w); await sleep(150);
  const h2 = !!O.getHandoff656() && !!O.state.current && O.state.current.videoId === V2.id;
  ytEnd(w); await sleep(150);
  check('(c8) TWO videos: the hand-off chains hand-off to hand-off, each marking on its own ENDED, then the audio starts',
    h1 && h2 && O.isPlayedDesc(v1, DATE) && O.isPlayedDesc(v2, DATE) && !!O.state.current && O.state.current.episodeId === 'morning-prayer',
    { h1, h2, cur: O.state.current && O.state.current.episodeId });
  // video last: terminal stop
  drive(() => O.startQueue([a1, v1]));
  await sleep(100);
  await audioEnd(w);
  const hLast = !!O.getHandoff656();
  ytEnd(w); await sleep(150);
  check('(c9) video LAST: finish runs the terminal stop — queue emptied, current null',
    hLast && O.state.queue.length === 0 && O.state.current === null, { hLast, q: O.state.queue.length, cur: O.state.current });
  // miss passed over
  drive(() => O.startQueue([a1, miss, descs.find((d) => d.episodeId === 'daily-rosary')]));
  await sleep(100);
  await audioEnd(w);
  check('(c10) a MISS video in the set is passed over — the audio never stops for it, no hand-off stands',
    !O.getHandoff656() && !!O.state.current && O.state.current.episodeId === 'daily-rosary', { cur: O.state.current && O.state.current.episodeId });
  // single play
  drive(() => O.playTrack(v1));
  await sleep(120);
  const hSingle = !!O.getHandoff656();
  ytEnd(w); await sleep(150);
  check('(c11) single play: a row tap plays the video alone; on ENDED it marks and stops (nothing follows)',
    hSingle && O.state.current === null && O.state.queue.length === 0, { hSingle, cur: O.state.current });
  w.close();
}
{
  // Abandonment: closeWatch kills the record, no mark, no resume.
  const { w, O, descs } = await composedWorld(johnStore(), null, [ITEM1]);
  const a1 = descs.find((d) => d.episodeId === 'morning-prayer');
  const a2 = descs.find((d) => d.episodeId === 'daily-rosary');
  const vid = descs.find((d) => d.kind === 'video');
  drive(() => O.startQueue([a1, vid, a2]));
  await sleep(100);
  await audioEnd(w);
  const stood = !!O.getHandoff656();
  drive(() => O.closeWatch());
  await sleep(100);
  check('(c12) abandonment (a closeWatch seat): the record dies, no mark, no resume — the queue and its index stand untouched, current keeps the video paused',
    stood && !O.getHandoff656() && O.isPlayedDesc(vid, DATE) === false && O.state.queue.length === 3 && O.state.queueIdx === 1
    && !!O.state.current && O.state.current.kind === 'video', { stood, q: O.state.queue.length, qi: O.state.queueIdx });
  drive(() => O.resumeCurrent());
  await sleep(100);
  check('(c13) resume of a video current re-opens the hand-off watch (the §2.4.6 divert, before closeWatch)',
    !!O.getHandoff656() && !!w.document.querySelector('iframe.podwatch-frame'), { h: !!O.getHandoff656() });
  w.close();
}

// ---------- (d) marks, counts, disc, menus ----------
{
  const { w, O, descs } = await composedWorld(johnStore(), null, [ITEM1]);
  const a1 = descs.find((d) => d.episodeId === 'morning-prayer');
  const vid = descs.find((d) => d.kind === 'video');
  const item = O.dayRowMarkItem639(vid);
  check('(d1) dayRowMarkItem639 stands for a video descriptor through its standing else-branch: label Mark as read while unmarked', !!item && item.label === 'Mark as read', item && item.label);
  if (item) drive(() => item.act());
  await sleep(60);
  const item2 = O.dayRowMarkItem639(vid);
  check('(d2) the mark act writes the day store under the video\u2019s own key; the item re-reads Mark as unread',
    O.isPlayedDesc(vid, DATE) === true && !!item2 && item2.label === 'Mark as unread');
  check('(d3) opnTrackUnplayed615 + opnCounts615 count the video in its block and read its mark; discQueue618 excludes a marked video and includes an unmarked one',
    O.opnTrackUnplayed615(vid, DATE) === false && O.opnCounts615([vid, a1]).total === 2 && O.opnCounts615([vid, a1]).unplayed === 1
    && O.discQueue618([vid, a1]).length === 0 + (O.opnTrackUnplayed615(a1, DATE) ? 1 : 0) && !O.discQueue618([vid, a1]).includes(vid));
  if (item2) drive(() => item2.act());
  await sleep(60);
  check('(d4) unmarking stands too: the video reads unplayed again and the disc includes it',
    O.isPlayedDesc(vid, DATE) === false && O.discQueue618([vid]).length === 1);
  drive(() => O.openDayRowMenu(vid, null));
  await sleep(200);
  const labels = [...w.document.querySelectorAll('.anchmenu [data-menuitem]')].map((x) => x.textContent.trim());
  check('(d5) \u25c6 the day-row menu for kind video carries Play next \u00b7 Add to queue \u00b7 Mark as read — and NOT Share / Download / Details',
    labels.includes('Play next') && labels.includes('Add to queue') && labels.includes('Mark as read')
    && !labels.includes('Share') && !labels.includes('Download') && !labels.includes('Details'), labels);
  O.state.current = vid;
  drive(() => O.openPlayerMenu(null));
  await sleep(200);
  const plabels = [...w.document.querySelectorAll('.anchmenu [data-menuitem]')].map((x) => x.textContent.trim());
  check('(d6) the player menu\u2019s Share item does not stand while the current is a video', !plabels.includes('Share'), plabels);
  // queue acts admit a video by identity
  O.state.current = null; O.state.queue = []; O.state.queueIdx = -1;
  drive(() => O.addToQueue(vid));
  check('(d7) Add to queue admits an available video (url null) by identity: a waiting queue of the one video stands, nothing starts',
    O.state.queue.length === 1 && O.state.queue[0] === vid && O.state.current === null, { q: O.state.queue.length });
  drive(() => O.playNext(vid));
  await sleep(60);
  check('(d8) Play next admits the video by identity (the queue holds it after the current position)', O.state.queue.some((d) => d.kind === 'video'));
  w.close();
}

// ---------- (e) no-video regression ----------
{
  const { w, O, descs } = await composedWorld(johnStore(), null, []);
  const a1 = descs.find((d) => d.episodeId === 'morning-prayer');
  const a2 = descs.find((d) => d.episodeId === 'daily-rosary');
  drive(() => O.startQueue([a1, a2]));
  await sleep(100);
  const first = !!O.state.current && O.state.current.episodeId === 'morning-prayer';
  await audioEnd(w);
  const second = !!O.state.current && O.state.current.episodeId === 'daily-rosary';
  await audioEnd(w);
  check('(e1) a block with no videos plays exactly as today: track 1 \u2192 track 2 \u2192 the terminal clear, no hand-off ever stands',
    first && second && O.state.queue.length === 0 && O.state.current === null && !O.getHandoff656(), { first, second });
  w.close();
}

// ---------- (f) native boundary ----------
function nativeBridge() {
  const cap = { queues: [], transports: [] };
  const plugin = {
    setNativeQueue: (arg) => { cap.queues.push(JSON.parse(arg.queue)); return Promise.resolve({}); },
    nativeTransport: (arg) => { cap.transports.push(JSON.parse(arg.command)); return Promise.resolve({}); },
    addListener: () => Promise.resolve({ remove: () => {} }),
    takeNativeCompletions: () => Promise.resolve({ records: [] }),
  };
  return { plugin, cap };
}
{
  const { plugin, cap } = nativeBridge();
  const { w, O, descs } = await composedWorld(johnStore(), plugin, [ITEM1]);
  const a1 = descs.find((d) => d.episodeId === 'morning-prayer');
  const a2 = descs.find((d) => d.episodeId === 'daily-rosary');
  const vid = descs.find((d) => d.kind === 'video');
  check('(f0) the native world stands (oraNativeMode reads the bridge stub)', drive(() => O.oraNativeMode()) === true);
  O.state.queue = [a1, vid, a2]; O.state.queueIdx = 0; O.state.current = a1;
  const built = drive(() => O.nativeContractFor(a1));
  check('(f1) \u25c6 nativeContractFor truncates at the first video at-or-after the start: the items end at the pre-video audio and nativeVideoBoundary656 names the video',
    !!built && built.contract.items.length === 1 && built.contract.items[0].id === 'morning-prayer'
    && !!O.getBoundary656() && O.getBoundary656().episodeId === vid.episodeId,
    { items: built && built.contract.items.map((i) => i.id), boundary: O.getBoundary656() && O.getBoundary656().episodeId });
  let ts = Date.now();
  drive(() => O.applyNativeState(JSON.stringify({ engine: 'native', stopped: true, ts: ++ts })));
  await sleep(120);
  check('(f2) \u25c6 the stopped publish with the boundary standing runs the hand-off instead of the terminal clear: queue seated at the video, current is the video, the watch stands',
    !!O.getHandoff656() && O.state.queueIdx === 1 && !!O.state.current && O.state.current.kind === 'video' && !!w.document.querySelector('iframe.podwatch-frame'),
    { qi: O.state.queueIdx, cur: O.state.current && O.state.current.episodeId });
  ytEnd(w);
  await sleep(200);
  const last = cap.queues[cap.queues.length - 1];
  check('(f3) after the video, finish\u2019s advance sends the NEXT contract carrying the post-video audio',
    !!last && last.items.some((i) => i.id === 'daily-rosary') && !!O.state.current && O.state.current.episodeId === 'daily-rosary',
    { last: last && last.items.map((i) => i.id), cur: O.state.current && O.state.current.episodeId });
  w.close();
}
{
  const { plugin } = nativeBridge();
  const { w, O, descs } = await composedWorld(johnStore(), plugin, []);
  const a1 = descs.find((d) => d.episodeId === 'morning-prayer');
  O.state.queue = [a1]; O.state.queueIdx = 0; O.state.current = a1;
  let ts = Date.now();
  drive(() => O.applyNativeState(JSON.stringify({ engine: 'native', stopped: true, ts: ++ts })));
  await sleep(100);
  check('(f4) a stopped publish with NO boundary runs the standing terminal clear (queue emptied, current null)',
    O.state.queue.length === 0 && O.state.current === null && !O.getHandoff656(), { q: O.state.queue.length });
  w.close();
}

// ---------- (g) fail-on-old: the pristine base 88fa1c9 ----------
{
  const oldClient = git(['show', '88fa1c9:app/worker/src/client.ts']);
  const oldJs = renderJs(oldClient);
  const w = makeWorld(oldJs, johnStore(), null, OLD_HOOK);
  await sleep(300);
  const O = w.__opn;
  let threw = false;
  try { O.opnCheckContents590({ Morning: [ITEM1] }, ['Morning', 'Midday', 'Evening', 'Night']); } catch (e) { threw = true; }
  check('(g1) fail-on-old: on the base tree the video item fails validation (bad contents kind)', threw);
  await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('.profaddladder603'), 6000).catch(() => false);
  click(w, door(w, 'br:worship')); await sleep(60);
  click(w, door(w, 'lf:virtual-mass')); await sleep(60);
  check('(g2) fail-on-old: on the base tree the Virtual Mass leaf paints "Nothing to add" (S1 standing) and no vmass door stands',
    ladderText(w).includes('Nothing to add') && !door(w, 'vmass:catholictv'), ladderText(w).slice(0, 120));
  check('(g3) fail-on-old: on the base tree no hand-off machinery exists (no resolveProfileVideos656 / openVideoHandoff656 in the source)',
    !oldClient.includes('function resolveProfileVideos656') && !oldClient.includes('function openVideoHandoff656') && !oldClient.includes('nativeVideoBoundary656'));
  w.close();
}

console.log('\nharness-v656:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
