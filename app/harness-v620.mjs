// harness-v620.mjs — v620: the Praylist cannot play a
//  resolved podcast entry (John, via main chat, 2026-11-22
//  13:13/13:17 CT): Fr. Mike Schmitz's "The Final Exam: The
//  Third Question" (Sat Nov 21, 2026), pinned into his Midday
//  block as a v614 kind 'episode' contents item, PLAYS from
//  Catechesis and FAILS from the Praylist.
// Diagnosis (proven by the diagnosis probe on the base tree):
//  the v614 resolver's descriptor is sound (kind 'podcast',
//  url = the Fireside enclosure, available) and Catechesis'
//  podDesc carries that url — but the composed Praylist
//  descriptor passes through expandDescs -> trackDesc, the
//  one seam both descriptor builds emit through, and
//  trackDesc read the URL from t.streamUrl ONLY (the resolver
//  shape carries it as t.url) and dropped kind / podSeries /
//  seriesKey / listened / podPositionS. The Praylist entry
//  stood available with url null: startQueue seated it as
//  current and the audio element's src was the string
//  "null". The same seam starved the v590 course and v611
//  day families (identical resolver shape).
// Fix: trackDesc's url read gains the t.url fallback, and a
//  kind 'podcast' input's identity rides the seam whole
//  (podDesc's field set). No other family's output changes;
//  the Catechesis path is untouched.
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v620/frmike-payload-live.json — the LIVE
//    served payload for series fr-mike-homilies, fetched
//    from app.orapronobis.media 2026-11-22 (snapshot built
//    2026-11-22T19:10:58Z; entries[0] IS the reported
//    episode, key 08b427a0-626e-4feb-8b7c-fcaf7508aa4e).
//  - tests/fixtures-v620/barron-payload-live.json — the
//    LIVE served barron-sunday-sermons payload, same fetch
//    (the second control: a pinned Barron episode).
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (the fold world).
//  - tests/fixtures-v603/bible-folded.json — the production
//    Bible in a Year payload (the course-family leg).
// Fail-on-old: the P legs run on the base tree's client
//  (HEAD = the v619 ship tree) and must fail there — the
//  composed descriptor's url stands null on the old seam.
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
const oldClientSrc = git(['show', '6a0ef37:app/worker/src/client.ts']); // fail-on-old pin: the base tree (v619 ship) — pinned by hash so the OA legs survive the fix's own commit
const FRMIKE = JSON.parse(readFileSync(APP + 'tests/fixtures-v620/frmike-payload-live.json', 'utf8'));
const BARRON = JSON.parse(readFileSync(APP + 'tests/fixtures-v620/barron-payload-live.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const GUID = '08b427a0-626e-4feb-8b7c-fcaf7508aa4e';
const FM_URL = 'https://aphid.fireside.fm/d/1437767933/1b1273a3-3711-4e9f-b187-36a4f8791359/08b427a0-626e-4feb-8b7c-fcaf7508aa4e.mp3';
const BARRON_TOP = BARRON.entries[0];

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
check('T0b the v620 seat stands in trackDesc: the t.url fallback and the kind-podcast identity ride',
  clientSrc.includes('url: t.streamUrl || t.url || null')
  && clientSrc.includes("if (t.kind === 'podcast') {")
  && clientSrc.includes('d.podPositionS = (t.podPositionS > 0)'));
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v620:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, resolveProfileEpisodes614, resolveProfileCourses590, podDesc, startQueue, tapPlay, opnTrackUnplayed615, discQueue618, trackDesc };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=fr-mike-homilies')) body = FRMIKE;
  else if (u.includes('/api/player/podcasts?series=barron-sunday-sermons')) body = BARRON;
  else if (u.includes('/api/player/podcasts?series=bible-in-a-year')) body = BIBLE;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { series: sk, entries: [], currentKey: null }; }
  else if (u.includes('/api/player/day')) body = DAY597;
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
// The world: John's production day fold + his v614 act —
// the Fr. Mike episode pinned into Midday, a Barron episode
// pinned beside it (the second control).
async function buildWorld(js) {
  const w = makeWorld(js);
  await sleep(400);
  const O = w.__opn;
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  day.profile = day.profile || {};
  day.profile.contents = day.profile.contents || {};
  day.profile.contents.Midday = (day.profile.contents.Midday || []).concat([
    { kind: 'episode', key: 'fr-mike-homilies|' + GUID },
    { kind: 'episode', key: 'barron-sunday-sermons|' + BARRON_TOP.key },
  ]);
  O.state.dayPayload = day;
  O.resolveProfileEpisodes614(day);
  O.resolveProfileCourses590(day);
  await sleep(700);
  const descs = O.extRebuildDescs(day) || [];
  return { w, O, day, descs };
}

const { w, O, descs } = await buildWorld(appJs);
const fmDesc = descs.filter((d) => d.episodeId === GUID)[0] || {};
check('P1 the composed Praylist descriptor for the pinned episode carries the playable resolution: url = the Fireside enclosure, kind podcast, podSeries/seriesKey standing, available',
  fmDesc.url === FM_URL && fmDesc.kind === 'podcast' && fmDesc.podSeries === 'fr-mike-homilies' && fmDesc.seriesKey === GUID && fmDesc.available === true && fmDesc.block === 'Midday',
  { url: fmDesc.url, kind: fmDesc.kind, podSeries: fmDesc.podSeries, available: fmDesc.available });
const barronDesc = descs.filter((d) => d.episodeId === BARRON_TOP.key)[0] || {};
check('P2 the Barron control pin composes playable too: url = its served enclosure, kind podcast',
  barronDesc.url === BARRON_TOP.url && barronDesc.kind === 'podcast' && barronDesc.podSeries === 'barron-sunday-sermons',
  { url: barronDesc.url, want: BARRON_TOP.url, kind: barronDesc.kind });
const courseDesc = descs.filter((d) => String(d.episodeId).indexOf('biy:') === 0)[0] || {};
check('P3 the course family (same resolver shape, same seam) composes playable: url standing, kind podcast',
  !!courseDesc.url && courseDesc.kind === 'podcast',
  { url: courseDesc.url, kind: courseDesc.kind, episodeId: courseDesc.episodeId });
// Play from the Praylist: a tap on the composed descriptor
// seats it as current and loads the audio element with the
// enclosure URL — never the string "null".
drive(() => O.startQueue([fmDesc], true));
await sleep(250);
const audio = w.document.querySelector('audio');
check('P4 a Praylist start of the pinned episode loads the audio element with the enclosure URL',
  !!audio && audio.getAttribute('src') === FM_URL && !!O.state.current && O.state.current.episodeId === GUID && O.state.current.kind === 'podcast',
  { src: audio && audio.getAttribute('src'), cur: O.state.current && O.state.current.episodeId });
// The played discipline: the descriptor reads its SERIES
// listen (v515), so the v615 unplayed predicate answers
// from the listened flag the resolver copied.
check('P5 the unplayed predicate reads the episode descriptor through its podcast listen discipline',
  O.opnTrackUnplayed615(fmDesc, '2026-11-22') === !fmDesc.listened,
  { listened: fmDesc.listened });
// Catechesis control: podDesc is untouched and already
// carried the URL on both trees.
O.state.podcasts = JSON.parse(JSON.stringify(FRMIKE));
const catDesc = O.podDesc(FRMIKE.entries[0]);
check('P6 Catechesis control: podDesc for the same episode carries the same URL (path untouched)',
  catDesc.url === FM_URL && catDesc.kind === 'podcast', { url: catDesc.url });
// A standing prayer descriptor keeps its pre-v620 shape:
// no podcast identity is stamped onto another family, and
// its URL still comes from its own streamUrl seat.
const prayerDesc = O.trackDesc({ episodeId: 'morning-prayer', title: 'Morning Prayer', streamUrl: 'https://example.invalid/mp.mp3', enclosureUrl: null, available: true, _block: 'Morning', source: 'Divine Office', durationS: 60 }, null);
check('P7 another family keeps its shape through the seam: no kind podcast stamped, its own url seat standing',
  prayerDesc.kind === undefined && prayerDesc.url === 'https://example.invalid/mp.mp3' && prayerDesc.block === 'Morning',
  { episodeId: prayerDesc.episodeId, kind: prayerDesc.kind, url: prayerDesc.url });

// ---- fail-on-old: the same world on the base tree ----
const old = await buildWorld(oldJs);
const oldFm = old.descs.filter((d) => d.episodeId === GUID)[0] || {};
check('OA1 fail-on-old: on the v619 seam the composed descriptor stands url null with no kind (the defect)',
  oldFm.url === null && oldFm.kind === undefined && oldFm.available === true,
  { url: oldFm.url, kind: oldFm.kind, available: oldFm.available });
drive(() => old.O.startQueue([oldFm], true));
await sleep(250);
const oldAudio = old.w.document.querySelector('audio');
check('OA2 fail-on-old: a Praylist start on the old seam loads the audio element with the string "null"',
  !!oldAudio && oldAudio.getAttribute('src') === 'null',
  { src: oldAudio && oldAudio.getAttribute('src') });
const oldBarron = old.descs.filter((d) => d.episodeId === BARRON_TOP.key)[0] || {};
check('OA3 fail-on-old: the Barron control pin is equally starved on the old seam',
  oldBarron.url === null && oldBarron.kind === undefined, { url: oldBarron.url });

console.log('harness-v620:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
