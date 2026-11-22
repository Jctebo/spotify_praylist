// harness-v611.mjs — v611: Daily Gospel Exegesis addable
//  to a day block, resolved by the day.
//  S  statics: the `day` kind named in both validators +
//     the read seam + the three label seats · the ladder's
//     Daily door + rung + head-search group · the resolver
//     + its fold-pass call + the placement leg · the
//     universe guard (no day item offered) · SW pin
//     unmoved vs main pre-Ship · rendered client parses.
//  E  validator parity (client vs extracted server):
//     the standing day key kept on both · a foreign day
//     key an error on both · duplicates deduped on both.
//  V  save + export/restore keeps a hand-added day item;
//     defaults + Reset carry no day item.
//  R  real-DOM legs: the ladder from Edit profiles (the
//     v603 recipe) — the Daily door stands fourth, the
//     rung offers the one entry, a pick writes
//     {kind:'day',key:'daily-gospel-exegesis'} into
//     Morning contents through the host add act +
//     Save; already-standing paints marked and a tap
//     writes nothing. Fold legs over the fixture payload
//     (tests/fixtures-v611/dge-payload.json, DERIVED by
//     tests/fixtures-v611/derive-v611.py from the
//     production feed fixture
//     tests/fixtures-v536/feeds-dge-2026-11-18.xml — the
//     three newest weekday episodes, pubDates Nov 17/16/15
//     2026 17:00 GMT, GUIDs 820b4a9a…/998ee6bc…/45949429…):
//     fold(2026-11-18) resolves GUID 820b4a9a… at its
//     contents position · fold(2026-11-17) resolves
//     998ee6bc… (two dates, two episodes) · fold(2026-11-19)
//     stands NO exegesis descriptor and substitutes none ·
//     the two dates' played keys are distinct per episode.
// Fixtures from production only (Improvement D): John's
// import file · the production DGE feed fixture above ·
// the v603/v597 production fixtures the v603 harness uses.
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
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const DGE = JSON.parse(readFileSync(APP + 'tests/fixtures-v611/dge-payload.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const G18 = '820b4a9a-a14d-40a4-a176-6c3cb6b25e8d';
const G17 = '998ee6bc-bc82-47d0-86b4-6f757a04cae0';
const G16 = '45949429-d4e3-43af-b241-b9a8d30f5d03';
const DAY_ITEM = { kind: 'day', key: 'daily-gospel-exegesis' };

// ---------- S statics ----------
check('S1 the client validator keeps the standing day key and errors on any other day key',
  clientSrc.includes("if (key !== OPN_DAY_KEY_611) throw opnErr(400, 'bad day ' + key);")
  && clientSrc.includes("var OPN_DAY_KEY_611 = 'daily-gospel-exegesis';"));
check('S2 the server validator mirrors the day rule (keeps the standing key, errors on any other)',
  indexSrc.includes('} else if (kind === "day") {')
  && indexSrc.includes('if (key !== "daily-gospel-exegesis") return { error: `bad day ${String(key)}` };'));
check('S3 the read seam passes the standing day item and filters a foreign one',
  clientSrc.includes("it.kind !== 'day' || it.key === OPN_DAY_KEY_611"));
check('S4 labels stand at all three seats (opnItemLabel604 · Edit profiles paintContents disp · Edit today itemLabel)',
  clientSrc.includes("if (it.kind === 'day') return 'Daily Gospel Exegesis';")
  && clientSrc.includes("m.kind === 'day' ? 'Daily Gospel Exegesis'")
  && (clientSrc.match(/'Daily Gospel Exegesis'/g) || []).length >= 4);
check('S5 the ladder: the Daily door stands after Sources, its rung lists the one day item, head search groups it under Daily',
  clientSrc.indexOf("doorHtml('sources'") > 0
  && clientSrc.indexOf("doorHtml('sources'") < clientSrc.indexOf("doorHtml('daily', 'Daily'")
  && clientSrc.includes('function dailyItems()')
  && clientSrc.includes("{ kind: 'day', key: OPN_DAY_KEY_611, label: 'Daily Gospel Exegesis' }")
  && clientSrc.includes("{ head: 'Daily', items: dailyItems().filter(function (it) { return match(it.label); }), path: 'Daily' }")
  && clientSrc.includes("rung === 'daily'"));
{
  const u = clientSrc.slice(clientSrc.indexOf('function profContentsUniverse590'), clientSrc.indexOf('function profVaultGate594'));
  check('S6 GUARD: the contents universe offers no day item (defaults + Reset stay day-free by construction)',
    !u.includes("kind: 'day'") && !u.includes('OPN_DAY_KEY_611'), u.slice(0, 200));
}
check('S7 the resolver stands with its fold-pass call beside the course resolver, and the placement leg stands in extRebuildDescs',
  clientSrc.includes('function resolveExegesisDay611(day)')
  && (clientSrc.match(/resolveExegesisDay611\(day\)/g) || []).length >= 2
  && clientSrc.includes('state.exegesisRes611') && clientSrc.includes('exegesis611: true')
  && clientSrc.includes("if (it.kind !== 'day') return;")
  && clientSrc.includes("api('/api/player/podcasts?series=daily-gospel-exegesis')"));
check('S8 the resolver date rule is exact: Chicago release date == presented date - 1, no latest/nearest fallback in the resolver',
  clientSrc.includes('var want = offlineShiftDate(presented, -1);')
  && clientSrc.includes('ownChicagoDateStr(x.publishedMs) === want'));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('S9 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S10 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

// ---------- server validator extraction (v603 recipe) ----------
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
    // v611 ship: the ['.includes(key as string)', '.includes(key)'] rep is
    // dropped — main's v609 repair 2 generalized the server course rule and
    // the cast no longer stands in validateProfileContents (driver only;
    // assertions untouched).
  ];
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error('server validate shape moved: ' + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
const serverValidate = new Function(stripServerValidate(indexSrc) + '\nreturn validateProfileContents;')();

// ---------- worlds ----------
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v611:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { openProfilesScreen, opnLocalApi, opnMode, state, opnCheckContents590, opnContentsOf590, opnStandingContents597, profContentsUniverse590, extRebuildDescs, opnFoldDay590, opnExportText, opnRestoreFromText, resolveExegesisDay611: (typeof resolveExegesisDay611 !== "undefined" ? resolveExegesisDay611 : null), playedKey };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=daily-gospel-exegesis')) body = DGE;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function makeDomWorld(store) {
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
function johnStore(mut) {
  const doc = JSON.parse(JSON.stringify(JOHN));
  if (mut) mut(doc);
  const st = {}; st[DATA_KEY] = JSON.stringify(doc); return st;
}
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }
function setSalesianMorning(doc, items) {
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
  sal.contents = Object.assign({}, sal.contents || {}, { Morning: items });
}

// ---------- E: validator parity ----------
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const core = ['Morning', 'Midday', 'Evening', 'Night'];
  const battery = [
    { Morning: [DAY_ITEM] },
    { Morning: [{ kind: 'day', key: 'some-other-day' }] },
    { Morning: [DAY_ITEM, DAY_ITEM] },
    { Morning: [{ kind: 'course', key: 'bible-in-a-year' }] },
    { Novenas: [{ kind: 'all-novenas' }] },
  ];
  let agree = true, kept = false;
  for (const item of battery) {
    let cOut, cErr = null;
    try { cOut = O.opnCheckContents590(JSON.parse(JSON.stringify(item)), core); } catch (e) { cErr = String(e && e.message || e); }
    const sOut = serverValidate(JSON.parse(JSON.stringify(item)), core);
    const cNorm = cErr ? { error: cErr } : { normalized: cOut };
    if (JSON.stringify(cNorm) !== JSON.stringify(sOut)) { agree = false; console.log('parity diff:', JSON.stringify(item), 'client:', JSON.stringify(cNorm), 'server:', JSON.stringify(sOut)); }
    if (JSON.stringify(cOut || {}).includes('"day"')) kept = true;
  }
  check('E1 validator parity: client == server over the battery (standing day kept, foreign day an error, duplicates deduped)', agree && kept, { agree, kept });
  const seam = O.opnContentsOf590({ contents: { Morning: [DAY_ITEM, { kind: 'day', key: 'foreign' }, { kind: 'source', key: 'abc' }] } });
  check('E2 the read seam passes the standing day item and filters the foreign one',
    !!seam && seam.Morning.length === 2 && seam.Morning[0].kind === 'day' && seam.Morning[1].kind === 'source', seam);
  w.close();
}

// ---------- V: save + reload + the guard ----------
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const save = await O.opnLocalApi('/api/prayer/profiles/save', { method: 'PUT', body: JSON.stringify({ name: 'Day Probe', basedOn: 'salesian', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: true, series: ['daily-readings'] } }, contents: { Morning: [DAY_ITEM, { kind: 'seat', key: 'daily-readings' }] } }) }, 'device').catch((e) => ({ err: String(e && e.message || e) }));
  const prof = (save.profiles || []).find((p) => p.name === 'Day Probe');
  check('V1 a hand-added day item survives the save (validator + read seam, end to end)',
    !!prof && (prof.contents.Morning || []).some((it) => it.kind === 'day' && it.key === 'daily-gospel-exegesis'), prof && prof.contents);
  const text = await O.opnExportText();
  const w2 = makeDomWorld({});
  await sleep(300);
  await w2.__opn.opnRestoreFromText(text);
  const p2 = await profilesPayload(w2);
  const prof2 = (p2.profiles || []).find((p) => p.name === 'Day Probe');
  check('V2 the day item survives export + restore in a fresh world (reload)',
    !!prof2 && (prof2.contents.Morning || []).some((it) => it.kind === 'day' && it.key === 'daily-gospel-exegesis'), prof2 && prof2.contents);
  w.close(); w2.close();
}
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  let dayless = true;
  const payload = await profilesPayload(w);
  (payload.profiles || []).forEach((p) => {
    ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas'].forEach((b) => {
      O.opnStandingContents597(p, b).forEach((it) => { if (it.kind === 'day') dayless = false; });
    });
  });
  check('V3 GUARD: the standing contents of every standing profile carry no day item (defaults stay day-free)', dayless);
  const rst = await O.opnLocalApi('/api/prayer/profiles/reset', { method: 'PUT', body: JSON.stringify({ profileKey: 'salesian' }) }, 'device').catch((e) => ({ err: String(e && e.message || e) }));
  const sal = ((rst && rst.profiles) || []).find((p) => p.key === 'salesian');
  check('V4 GUARD: Reset restores the designed Salesian Way with no day item anywhere in its contents',
    !!sal && JSON.stringify(sal.contents || {}).indexOf('"day"') < 0, rst.err || (sal && sal.contents));
  w.close();
}

// ---------- R: the ladder from Edit profiles ----------
async function openProfiles(w) {
  w.__opn.openProfilesScreen(null, {});
  return until(() => w.document.querySelector('[data-p591add="Morning"]'));
}
function doorsOf(w) { return [...w.document.querySelectorAll('.profaddladder603 [data-p603door]')].map((e) => e.getAttribute('data-p603door')); }
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  check('R1 Edit profiles opens and the Morning Add stands', await openProfiles(w));
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('.profaddladder603'));
  check('R2 the ladder opens from Edit profiles with the Daily door standing FOURTH (Courses · Prayers · Sources · Daily)',
    JSON.stringify(doorsOf(w)) === JSON.stringify(['courses', 'prayers', 'sources', 'daily']), doorsOf(w));
  const doorD = w.document.querySelector('[data-p603door="daily"]');
  if (doorD) click(w, doorD);
  await sleep(80);
  const row = w.document.querySelector('[data-p603additem="day:daily-gospel-exegesis"]');
  check('R3 the Daily rung offers the one entry, Daily Gospel Exegesis',
    !!row && row.textContent.includes('Daily Gospel Exegesis'), row && row.textContent);
  if (row) click(w, row);
  await until(() => !w.document.querySelector('.profaddladder603'), 3000);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  check('R4 after the pick the editor stands dirty with Save live (the host add act took the item)', !!saveBtn && !saveBtn.disabled);
  if (saveBtn) click(w, saveBtn);
  await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === 'salesian'); return s && ((s.contents && s.contents.Morning) || []).some((it) => it.kind === 'day' && it.key === 'daily-gospel-exegesis'); });
  const p = await profilesPayload(w);
  const sal = (p.profiles || []).find((x) => x.key === 'salesian');
  check('R5 the saved profile carries {kind:day, key:daily-gospel-exegesis} in Morning contents',
    !!sal && ((sal.contents && sal.contents.Morning) || []).some((it) => it.kind === 'day' && it.key === 'daily-gospel-exegesis'), sal && sal.contents);
  w.close();
}
{
  // Already-standing: marked, not tappable, tap writes nothing.
  const w = makeDomWorld(johnStore((doc) => setSalesianMorning(doc, [DAY_ITEM])));
  await sleep(300);
  await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('[data-p603door="daily"]'), 3000);
  const doorD2 = w.document.querySelector('[data-p603door="daily"]');
  if (doorD2) click(w, doorD2);
  await sleep(80);
  const row = [...w.document.querySelectorAll('.profaddladder603 .bookrow')].find((r) => r.textContent.includes('Daily Gospel Exegesis'));
  const before = w.localStorage.getItem(DATA_KEY);
  check('R6 an already-standing day item paints marked "Already in Morning" and carries no tap',
    !!row && row.textContent.includes('Already in Morning') && !row.hasAttribute('data-p603additem'), row && row.textContent);
  if (row) click(w, row);
  await sleep(50);
  check('R7 tapping the marked row writes nothing (the document is byte-identical, the ladder still stands)',
    w.localStorage.getItem(DATA_KEY) === before && !!w.document.querySelector('.profaddladder603'));
  w.close();
}

// ---------- R: fold legs over the fixture payload ----------
function syntheticDay(date) {
  const blocks = ['Morning', 'Midday', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function foldExegesis(w, date) {
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay(date));
  O.state.dayPayload = day;
  O.state.ownStanding = []; O.state.extStanding = [];
  O.state.ownSlots = {}; O.state.extSlots = {};
  if (typeof O.resolveExegesisDay611 !== 'function') return [];
  O.resolveExegesisDay611(day);
  await until(() => O.state.exegesisRes611 && O.state.exegesisRes611['Morning:daily-gospel-exegesis'], 6000).catch(() => false);
  await sleep(150);
  const descs = O.extRebuildDescs(day) || [];
  return descs.filter((d) => d.podSeries === 'daily-gospel-exegesis' || [G18, G17, G16].includes(d.episodeId));
}
{
  const w = makeDomWorld(johnStore((doc) => setSalesianMorning(doc, [DAY_ITEM])));
  await sleep(300);
  const ex18 = await foldExegesis(w, '2026-11-18');
  check('R8 fold(2026-11-18) resolves the Nov-17-released episode (GUID 820b4a9a…) in Morning, under its OWN title',
    ex18.length === 1 && ex18[0].episodeId === G18 && ex18[0].block === 'Morning'
    && ex18[0].title === 'Wednesday of Week 33 in Ordinary Time - Luke 19: 11-28', ex18.map((d) => d.episodeId + '|' + d.title));
  const ex17 = await foldExegesis(w, '2026-11-17');
  check('R9 fold(2026-11-17) resolves the Nov-16-released episode (GUID 998ee6bc…) — two dates, two episodes',
    ex17.length === 1 && ex17[0].episodeId === G17 && ex17[0].title === 'Tuesday of Week 33 in Ordinary Time - Luke 19: 1-10', ex17.map((d) => d.episodeId + '|' + d.title));
  const O = w.__opn;
  check('R10 played-mark leg: the two dates\u2019 descriptors carry distinct episodeIds and distinct playedKey(episodeId, block) values',
    ex18[0] && ex17[0] && ex18[0].episodeId !== ex17[0].episodeId
    && O.playedKey(ex18[0].episodeId, 'Morning') !== O.playedKey(ex17[0].episodeId, 'Morning')
    && String(O.playedKey(ex18[0].episodeId, 'Morning')).includes(G18), { a: ex18[0] && ex18[0].episodeId, b: ex17[0] && ex17[0].episodeId });
  const ex19 = await foldExegesis(w, '2026-11-19');
  check('R11 GAP: fold(2026-11-19) (no Nov-18 release in the fixture) stands NO exegesis descriptor and substitutes none',
    ex19.length === 0, ex19.map((d) => d.episodeId));
  w.close();
}
{
  // Contents position: the day item stands in Morning
  // contents between two source items; the resolved
  // track lands in Morning at the contents-walk leg —
  // after the block's source rows, exactly where course
  // tracks stand (the placement the plan names). The
  // source rows resolve through the standing own-slot
  // machinery (v603 compose recipe).
  const w = makeDomWorld(johnStore((doc) => setSalesianMorning(doc, [
    { kind: 'source', key: 'daily-rosary' }, DAY_ITEM, { kind: 'source', key: 'morning-prayer' }
  ])));
  await sleep(300);
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay('2026-11-18'));
  O.state.dayPayload = day;
  O.state.ownStanding = [
    { sourceKey: 'daily-rosary', episodeId: 'daily-rosary', block: 'Morning', sortOrder: 1, title: 'The Daily Rosary', enabled: 1 },
    { sourceKey: 'morning-prayer', episodeId: 'morning-prayer', block: 'Morning', sortOrder: 2, title: 'Morning Prayer', enabled: 1 }
  ];
  O.state.extStanding = [];
  O.state.ownSlots = {
    'daily-rosary': { state: 'present', tracks: [{ episodeId: 'daily-rosary', title: 'The Daily Rosary', state: 'present', streamUrl: 'https://example.invalid/r.mp3', durationS: 30 }] },
    'morning-prayer': { state: 'present', tracks: [{ episodeId: 'morning-prayer', title: 'Morning Prayer', state: 'present', streamUrl: 'https://example.invalid/m.mp3', durationS: 30 }] }
  };
  O.state.extSlots = {};
  if (typeof O.resolveExegesisDay611 === 'function') O.resolveExegesisDay611(day);
  await until(() => O.state.exegesisRes611 && O.state.exegesisRes611['Morning:daily-gospel-exegesis'], 6000).catch(() => false);
  await sleep(150);
  const descs = (O.extRebuildDescs(day) || []).filter((d) => d.block === 'Morning');
  const ids = descs.map((d) => d.episodeId);
  // The contents-walk leg (course + day) stands after the
  // block's settings/source rows — exactly where course
  // tracks stand; within the block the exegesis stands
  // in Morning, after both source rows, at its leg.
  check('R12 the resolved exegesis stands AT its contents position (the contents-walk leg in Morning, after the block\u2019s source rows — where course tracks stand)',
    ids.indexOf('daily-rosary') >= 0 && ids.indexOf('morning-prayer') > ids.indexOf('daily-rosary') && ids.indexOf(G18) === ids.length - 1 && ids.indexOf(G18) > ids.indexOf('morning-prayer'), ids);
  w.close();
}

console.log('harness-v611:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
