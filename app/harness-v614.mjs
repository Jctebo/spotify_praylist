// harness-v614.mjs — v614: individual podcast episodes
//  addable to the list (kind 'episode'), the Add ladder as
//  the app-layout tree, dynamic heads (Q0), homily pins,
//  novena pins (S3 ingest-at-resolve).
// World recipe: the v609vault recipe — John's real document
//  (john-personal-data-import-v589.json, podcastListens
//  stripped as in v603/v611) in a plain world, and sealed
//  under a real envelope built by the client's own
//  opnVaultCreate for the locked legs (L12).
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v611/dge-payload.json — derived by
//    tests/fixtures-v611/derive-v611.py from the production
//    feed fixture tests/fixtures-v536/feeds-dge-2026-11-18.xml
//    (episodes released Nov 17/16/15 2026).
//  - tests/fixtures-v603/bible-folded.json — the production
//    Bible in a Year payload, core-folded (currentKey
//    biy:day-322); tests/fixtures-v614/bible-finished.json —
//    its finished-course variant, derived by
//    tests/fixtures-v614/derive-finished-course.py.
//  - tests/fixtures-v614/readings-payload.json — captured
//    from the production USCCB Daily Readings feed
//    (feeds.soundcloud.com/users/soundcloud:users:838970026)
//    on 2026-11-22 by tests/fixtures-v614/derive-readings.py;
//    title dates December 23-31, 2026 (the feed publishes
//    ahead; the seat rule matches by title date).
//  - tests/fixtures-v614/novenas-catalog.json — derived from
//    the production own feed https://orapronobis.media/
//    podcast.xml (captured 2026-11-22) by the server's
//    grouping rule, tests/fixtures-v614/derive-novenas.py
//    (fixtures-v603/novenas.json carries no episodes).
//  - tests/fixtures-v603/book.json · podcasts-index.json.
//  - Homily take: an index entry in the exact recording-
//    entry shape the client writes (client.ts homily entry
//    construction, §2.6) with state:'ready' — shape-true;
//    no production take leaves John's device.
//  - Core state: listens/positions written through the
//    client's own opnPodCoreSetListen / opnPodCoreSetPosition.
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
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const DGE = JSON.parse(readFileSync(APP + 'tests/fixtures-v611/dge-payload.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
const BIBLEFIN = JSON.parse(readFileSync(APP + 'tests/fixtures-v614/bible-finished.json', 'utf8'));
const READINGS = JSON.parse(readFileSync(APP + 'tests/fixtures-v614/readings-payload.json', 'utf8'));
const NOVCAT = JSON.parse(readFileSync(APP + 'tests/fixtures-v614/novenas-catalog.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const HOMILY_KEY = 'opn-homilies-v551';
const G18 = '820b4a9a-a14d-40a4-a176-6c3cb6b25e8d';
const R29 = READINGS.entries.find((e) => e.title.includes('December 29, 2026'));
const R28 = READINGS.entries.find((e) => e.title.includes('December 28, 2026'));
const NOV1 = NOVCAT.novenas[0];
const NOV1_EP = NOV1.episodes[0];
const HOMILY_ENTRY = { id: 'h614test', name: 'Homily \u2014 Sunday, November 22, 2026', dateKey: '2026-11-22', dayName: 'Sunday', createdAt: 1795363200000, durationS: 612, sizeBytes: 4896000, mimeType: 'audio/mp4', starred: false, played: false, state: 'ready', chunkCount: 4, partial: false, note: '' };
let BIBLE_PAYLOAD = BIBLE;

// ---------- statics ----------
check('S1 the episode kind stands in both validators + the read seam + the label seat',
  clientSrc.includes("kind === 'episode'") && clientSrc.includes('bad episode ')
  && indexSrc.includes('kind === "episode"') && indexSrc.includes('bad episode ${String(key)}')
  && clientSrc.includes('function opnEpisodeKeyOk614(key)') && clientSrc.includes('function opnEpisodeTitle614(key)')
  && clientSrc.includes("it.kind !== 'episode' || opnEpisodeKeyOk614(it.key)"));
check('S2 the resolver + its fold-pass call + the placement walk stand',
  clientSrc.includes('function resolveProfileEpisodes614(day)') && clientSrc.includes('state.episodeRes614')
  && clientSrc.includes('episode614: true') && clientSrc.includes('resolveProfileEpisodes614(day);')
  && clientSrc.includes("if (it.kind !== 'episode') return;"));
check('S3 the novena ingest-at-resolve (S3) + the homily device seam stand in the resolver',
  clientSrc.includes('homilyDescFor(he, job.block)'));
check('S3b R-1 repair shape: the novenas branch ingests the FULL catalog set (allEps) in one call — the one-episode ingest stands nowhere',
  clientSrc.includes("opnPodCoreIngestSeries(core, 'novenas', 'Novenas', 'novenas', allEps)")
  && !clientSrc.includes("opnPodCoreIngestSeries(core, 'novenas', 'Novenas', 'novenas', [ep])"));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('S4 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S5 served client (rendered APP_JS) parses whole', parses, perr);
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
  ];
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error('server validate shape moved: ' + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
const serverValidate = new Function(stripServerValidate(indexSrc) + '\nreturn validateProfileContents;')();

// ---------- worlds ----------
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v614:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opnLocalApi, opnMode, opnDoc, opnVaultLocked, opnVaultCreate, openProfilesScreen, openEditTodayScreen594, opnCheckContents590, opnContentsOf590, opnStandingContents597, profContentsUniverse590, extRebuildDescs, opnFoldDay590, resolveProfileEpisodes614, opnPodCore, opnPodCoreSetListen, opnPodCoreSetPosition, opnPodCoreImportListens, trackCard, opnDateLabel, EXT_TOKENS };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVCAT;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = READINGS;
  else if (u.includes('/api/player/podcasts?series=daily-gospel-exegesis')) body = DGE;
  else if (u.includes('/api/player/podcasts?series=bible-in-a-year')) body = BIBLE_PAYLOAD;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { series: sk, entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function idbStub614(w, chunks) {
  // Minimal in-memory IndexedDB for the homily stores
  // (jsdom carries none): homilyDb's open/upgrade + the
  // chunks getAll the mint path reads. Seeded chunk rows
  // carry real Blobs, so homilyMint mints a URL exactly as
  // on device (jsdom also lacks URL.createObjectURL).
  const stores = { chunks: chunks || [], takes: [] };
  let blobN = 0;
  w.URL.createObjectURL = () => 'blob:harness-v614/' + (++blobN);
  const fire = (r) => { queueMicrotask(() => { if (r.onupgradeneeded) r.onupgradeneeded(); if (r.onsuccess) r.onsuccess(); }); return r; };
  const db = {
    objectStoreNames: { contains: (n) => Object.prototype.hasOwnProperty.call(stores, n) },
    createObjectStore: (n) => { if (!stores[n]) stores[n] = []; },
    transaction: (store) => ({ objectStore: () => ({ getAll: () => fire({ result: (stores[store] || []).slice(), error: null }), put: () => fire({ result: undefined, error: null }), delete: () => fire({ result: undefined, error: null }) }), oncomplete: null, onerror: null }),
  };
  w.indexedDB = { open: () => fire({ result: db, error: null }) };
  w.IDBKeyRange = { bound: (a, b) => ({ lower: a, upper: b }) };
}
function makeWorld(store, opts) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  if (opts && opts.idbChunks) idbStub614(w, opts.idbChunks.map((c) => ({ id: c.id, seq: c.seq, blob: new w.Blob([new Uint8Array(c.bytes || 16)], { type: 'audio/mp4' }) })));
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(mut, extra) {
  const doc = JSON.parse(JSON.stringify(JOHN));
  if (mut) mut(doc);
  const st = {}; st[DATA_KEY] = JSON.stringify(doc);
  Object.assign(st, extra || {});
  return st;
}
function setSalMorning(doc, items) {
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
  sal.contents = Object.assign({}, sal.contents || {}, { Morning: items });
}
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return !!el; }
function type(w, inp, text) { inp.value = text; inp.dispatchEvent(new w.Event('input', { bubbles: true })); }
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }
async function openProfiles(w) {
  w.__opn.openProfilesScreen(null, {});
  return until(() => w.document.querySelector('[data-p591add="Morning"]'));
}
async function openLadder(w, block) {
  await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="' + (block || 'Morning') + '"]'));
  return until(() => w.document.querySelector('.profaddladder603'));
}
function door(w, val) { return w.document.querySelector('[data-p603door="' + val + '"]'); }
function addRow(w, id) { return w.document.querySelector('[data-p603additem="' + id + '"]'); }
function ladderText(w) { const l = w.document.querySelector('.profaddladder603'); return l ? l.textContent : ''; }
function syntheticDay(date) {
  const blocks = ['Morning', 'Midday', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function fold614(w, date, waitKey) {
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay(date));
  O.state.dayPayload = day;
  O.state.ownStanding = []; O.state.extStanding = [];
  O.state.ownSlots = {}; O.state.extSlots = {};
  O.resolveProfileEpisodes614(day);
  if (waitKey) await until(() => O.state.episodeRes614 && O.state.episodeRes614['Morning:' + waitKey], 6000).catch(() => false);
  await sleep(200);
  return { day, descs: O.extRebuildDescs(day) || [] };
}

// ---------- L13: validator parity + read seam ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const core = ['Morning', 'Midday', 'Evening', 'Night'];
  const EP = { kind: 'episode', key: 'bible-in-a-year|biy:day-1' };
  const battery = [
    { Morning: [EP] },
    { Morning: [{ kind: 'episode', key: 'no-pipe' }] },
    { Morning: [{ kind: 'episode', key: '|ep' }] },
    { Morning: [{ kind: 'episode', key: 'series|' }] },
    { Morning: [{ kind: 'episode' }] },
    { Morning: [EP, EP] },
    { Novenas: [EP] },
  ];
  let agree = true, kept = false;
  for (const item of battery) {
    let cOut, cErr = null;
    try { cOut = O.opnCheckContents590(JSON.parse(JSON.stringify(item)), core); } catch (e) { cErr = String(e && e.message || e); }
    const sOut = serverValidate(JSON.parse(JSON.stringify(item)), core);
    const cNorm = cErr ? { error: cErr } : { normalized: cOut };
    if (JSON.stringify(cNorm) !== JSON.stringify(sOut)) { agree = false; console.log('parity diff:', JSON.stringify(item), 'client:', JSON.stringify(cNorm), 'server:', JSON.stringify(sOut)); }
    if (JSON.stringify(cOut || {}).includes('"episode"')) kept = true;
  }
  check('L13 validator parity: well-formed episode kept on both; malformed keys (no |, empty side, keyless) an error on both; episode in Novenas block an error on both; duplicates deduped on both', agree && kept, { agree, kept });
  const seam = O.opnContentsOf590({ contents: { Morning: [EP, { kind: 'episode', key: 'no-pipe' }, { kind: 'episode', key: 'x|' }, { kind: 'source', key: 'abc' }] } });
  check('L13b the read seam keeps the well-formed episode item and drops the malformed ones',
    !!seam && seam.Morning.length === 2 && seam.Morning[0].kind === 'episode' && seam.Morning[1].kind === 'source', seam);
  w.close();
}

// ---------- L14: no standing episode ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const uni = O.profContentsUniverse590('Morning');
  let epFree = !uni.some((it) => it.kind === 'episode');
  const payload = await profilesPayload(w);
  (payload.profiles || []).forEach((p) => {
    ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas'].forEach((b) => {
      O.opnStandingContents597(p, b).forEach((it) => { if (it.kind === 'episode') epFree = false; });
    });
  });
  const rst = await O.opnLocalApi('/api/prayer/profiles/reset', { method: 'PUT', body: JSON.stringify({ profileKey: 'salesian' }) }, 'device').catch((e) => ({ err: String(e && e.message || e) }));
  const sal = ((rst && rst.profiles) || []).find((p) => p.key === 'salesian');
  check('L14 defaults, Reset, standing contents and the contents universe carry no episode item',
    epFree && !!sal && JSON.stringify(sal.contents || {}).indexOf('"episode"') < 0, rst.err || (sal && sal.contents));
  w.close();
}

// ---------- L1 + L2: tree paint, no-add leaves, "Sources" absent ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  check('L1a the ladder opens from Edit profiles', await openLadder(w));
  const rootDoors = [...w.document.querySelectorAll('.profaddladder603 [data-p603door]')].map((e) => e.getAttribute('data-p603door'));
  check('L1 the ladder paints the five branches in app-layout order (Worship · Pray · Catechesis · Conscience · Sacred Art)',
    JSON.stringify(rootDoors) === JSON.stringify(['br:worship', 'br:pray', 'br:catechesis', 'br:conscience', 'br:sacred-art']), rootDoors);
  let allText = ladderText(w);
  click(w, door(w, 'br:conscience')); await sleep(60);
  const consOk = ladderText(w).includes('Nothing to add') && !w.document.querySelector('.profaddladder603 [data-p603additem]');
  allText += ladderText(w);
  click(w, w.document.querySelector('[data-p603back]')); await sleep(60);
  click(w, door(w, 'br:sacred-art')); await sleep(60);
  const artOk = ladderText(w).includes('Nothing to add') && !w.document.querySelector('.profaddladder603 [data-p603additem]');
  allText += ladderText(w);
  click(w, w.document.querySelector('[data-p603back]')); await sleep(60);
  click(w, door(w, 'br:worship')); await sleep(60);
  click(w, door(w, 'lf:adoration')); await sleep(60);
  const adOk = ladderText(w).includes('Nothing to add') && !w.document.querySelector('.profaddladder603 [data-p603additem]');
  allText += ladderText(w);
  click(w, w.document.querySelector('[data-p603back]')); await sleep(60);
  click(w, door(w, 'lf:virtual-mass')); await sleep(60);
  const vmOk = ladderText(w).includes('Nothing to add') && !w.document.querySelector('.profaddladder603 [data-p603additem]');
  allText += ladderText(w);
  check('L1b Conscience, Sacred Art, Adoration and Virtual Mass (S1) paint "Nothing to add" and carry no add acts', consOk && artOk && adOk && vmOk, { consOk, artOk, adOk, vmOk });
  check('L2 the retired word stands nowhere in the ladder rendered output at any rung, and in no client source string',
    !allText.includes('Sources') && !clientSrc.includes('Sources'));
  w.close();
}
{
  // Novenas block: the tree collapses to the Novenas leaf alone (§2.9).
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w, 'Novenas');
  await until(() => w.document.querySelectorAll('.profaddladder603 .bookrow').length > 1, 6000);
  const rows = [...w.document.querySelectorAll('.profaddladder603 .bookrow')];
  check('L1c for the Novenas block the ladder collapses to the Novenas leaf alone (no branch doors; Every active novena first)',
    !w.document.querySelector('.profaddladder603 [data-p603door]') && rows.length > 1 && rows[0].textContent.includes('Every active novena'), rows.length);
  w.close();
}

// ---------- L3 + L4: pin resolves at position with core truth; fixed ----------
{
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [
    { kind: 'episode', key: 'bible-in-a-year|biy:day-6' },
    { kind: 'episode', key: 'bible-in-a-year|biy:day-5' },
  ])));
  await sleep(300);
  const O = w.__opn;
  O.opnPodCoreSetListen('bible-in-a-year', 'biy:day-6', true, { listenDate: '2026-11-21' });
  O.opnPodCoreSetPosition('bible-in-a-year', 'biy:day-5', 123, 900);
  const { descs } = await fold614(w, '2026-11-22', 'bible-in-a-year|biy:day-5');
  const res = O.state.episodeRes614;
  const r6 = res['Morning:bible-in-a-year|biy:day-6'], r5 = res['Morning:bible-in-a-year|biy:day-5'];
  const i6 = descs.findIndex((d) => d.episodeId === 'biy:day-6'), i5 = descs.findIndex((d) => d.episodeId === 'biy:day-5');
  check('L3 episode pins stand as descriptors AT their contents positions, carrying the core store\u2019s played mark and part-played position (Q5)',
    !!r6 && r6.listened === true && !!r5 && r5.listened === false && r5.podPositionS === 123
    && i6 >= 0 && i5 === i6 + 1, { r6: r6 && r6.listened, r5: r5 && r5.podPositionS, i6, i5 });
  // L4: mark the pinned episode listened; rebuild — same episode, now marked.
  O.opnPodCoreSetListen('bible-in-a-year', 'biy:day-5', true, { listenDate: '2026-11-22' });
  const again = await fold614(w, '2026-11-23', 'bible-in-a-year|biy:day-5');
  const r5b = O.state.episodeRes614['Morning:bible-in-a-year|biy:day-5'];
  check('L4 FIXED: after the pinned episode is marked listened, a rebuild stands THE SAME episode (now marked) — it does not advance',
    !!r5b && r5b.episodeId === 'biy:day-5' && r5b.listened === true && again.descs.some((d) => d.episodeId === 'biy:day-5'),
    r5b && (r5b.episodeId + '|' + r5b.listened));
  w.close();
}

// ---------- L9 (fold): a pinned previous readings day stays that day ----------
{
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: 'episode', key: 'daily-readings|' + R28.key }])));
  await sleep(300);
  const a = await fold614(w, '2026-12-29', 'daily-readings|' + R28.key);
  const da = a.descs.filter((d) => d.episodeId === R28.key);
  const b = await fold614(w, '2026-12-30', 'daily-readings|' + R28.key);
  const db = b.descs.filter((d) => d.episodeId === R28.key);
  check('L9b a pinned previous readings day resolves to THAT day\u2019s entry and stays that entry when the presented day advances (fixed, Q3)',
    da.length === 1 && da[0].episodeId === R28.key && db.length === 1 && db[0].episodeId === R28.key,
    { a: da.map((d) => d.episodeId), b: db.map((d) => d.episodeId), want: R28.key });
  w.close();
}

// ---------- Novena pin (S3): resolves alone, core is the truth ----------
{
  const pinKey = 'novenas|' + NOV1_EP.key;
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: 'episode', key: pinKey }])));
  await sleep(300);
  const O = w.__opn;
  const { descs } = await fold614(w, '2026-11-22', pinKey);
  const d = O.state.episodeRes614['Morning:' + pinKey];
  const coreAfter = O.opnPodCore();
  check('L3n a pinned novena episode stands alone in the block (no Day-n machinery), ingested into the core at resolve so Q5 holds in shape',
    !!d && d.episodeId === NOV1_EP.key && d.available === true && descs.some((x) => x.episodeId === NOV1_EP.key)
    && !!(coreAfter.episodes && coreAfter.episodes[pinKey]), d && d.episodeId);
  O.opnPodCoreSetListen('novenas', NOV1_EP.key, true, { listenDate: '2026-11-22' });
  const again = await fold614(w, '2026-11-22', pinKey);
  const d2 = O.state.episodeRes614['Morning:' + pinKey];
  check('L4n playing the novena pin writes novenas|<stem> through the standing mark path — the core mark is the descriptor\u2019s truth on rebuild',
    !!d2 && d2.listened === true && again.descs.some((x) => x.episodeId === NOV1_EP.key), d2 && (d2.episodeId + '|' + d2.listened));
  w.close();
}

// ---------- L5n + L6n: R-1 two-pin — the novena ingest is non-destructive ----------
// Review R-1: the one-episode ingest ([ep]) replaced the
// series' episodeKeys with that one key and pruned every
// other 'novenas|…' listen/position. These legs FAIL on
// the pre-repair resolver and pass on the full-catalog
// ingest. Episode A carries BOTH a listen and a position
// in the core, seeded through the client's own writers
// (SetPosition for the position, ImportListens for the
// listen — ImportListens does not clear positions).
{
  const epA = NOV1_EP, epB = NOV1.episodes[1];
  const pinA = 'novenas|' + epA.key, pinB = 'novenas|' + epB.key;
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: 'episode', key: pinB }])));
  await sleep(300);
  const O = w.__opn;
  O.opnPodCoreSetPosition('novenas', epA.key, 321, 900);
  O.opnPodCoreImportListens([{ series: 'novenas', seqKey: epA.key, listenDate: '2026-11-21', source: 'harness-v614' }]);
  O.opnPodCoreSetPosition('novenas', epB.key, 222, 900);
  const seeded = O.opnPodCore();
  const seedOk = !!seeded.listens[pinA] && !!seeded.positions[pinA] && seeded.positions[pinA].positionS === 321 && !!seeded.positions[pinB];
  const first = await fold614(w, '2026-11-22', pinB);
  const dB = O.state.episodeRes614['Morning:' + pinB];
  const coreAfterB = O.opnPodCore();
  check('L5n R-1: a listen AND a position stand for novena episode A; resolving a pin for episode B leaves both standing, and B resolves with its own truth (its part-played position)',
    seedOk && !!dB && dB.available === true && dB.listened === false && dB.podPositionS === 222
    && !!coreAfterB.listens[pinA] && !!coreAfterB.positions[pinA] && coreAfterB.positions[pinA].positionS === 321
    && !!coreAfterB.positions[pinB] && first.descs.some((x) => x.episodeId === epB.key),
    { seedOk, dB: dB && (dB.listened + '|' + dB.podPositionS), listens: Object.keys(coreAfterB.listens), positions: Object.keys(coreAfterB.positions) });
  // Then resolve A as well, in the same world on the same
  // core: both pins stand, both marks stand.
  const day2 = first.day;
  day2.profile.contents.Morning = [{ kind: 'episode', key: pinA }, { kind: 'episode', key: pinB }];
  O.state.dayPayload = day2;
  O.resolveProfileEpisodes614(day2);
  await until(() => O.state.episodeRes614 && O.state.episodeRes614['Morning:' + pinA] && O.state.episodeRes614['Morning:' + pinB], 6000).catch(() => false);
  await sleep(200);
  const descs2 = O.extRebuildDescs(day2) || [];
  const dA2 = O.state.episodeRes614['Morning:' + pinA];
  const dB2 = O.state.episodeRes614['Morning:' + pinB];
  const coreAfterBoth = O.opnPodCore();
  check('L6n R-1: resolving A as well — both pins stand as descriptors with both marks (A listened, B part-played), and the core still holds A\u2019s listen AND position and B\u2019s position',
    !!dA2 && dA2.listened === true && !!dB2 && dB2.listened === false && dB2.podPositionS === 222
    && descs2.some((x) => x.episodeId === epA.key) && descs2.some((x) => x.episodeId === epB.key)
    && !!coreAfterBoth.listens[pinA] && !!coreAfterBoth.positions[pinA] && coreAfterBoth.positions[pinA].positionS === 321
    && !!coreAfterBoth.positions[pinB],
    { dA2: dA2 && dA2.listened, dB2: dB2 && (dB2.listened + '|' + dB2.podPositionS), listens: Object.keys(coreAfterBoth.listens), positions: Object.keys(coreAfterBoth.positions) });
  w.close();
}

// ---------- L10: rotted key ----------
{
  const pin = { kind: 'episode', key: 'bible-in-a-year|biy:day-9999' };
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [pin])));
  await sleep(300);
  const O = w.__opn;
  const { descs } = await fold614(w, '2026-11-22', 'bible-in-a-year|biy:day-9999');
  const rd = O.state.episodeRes614['Morning:bible-in-a-year|biy:day-9999'];
  const dd = descs.find((x) => x.episodeId === 'biy:day-9999');
  const cardHtml = dd ? O.trackCard(Object.assign({}, dd)) : '';
  check('L10 a rotted key stands as an available:false "Not available" card in the composed day (never silently gone)',
    !!rd && rd.available === false && !!dd && dd.available === false && cardHtml.includes('Not available'),
    { rd: rd && rd.available, dd: dd && dd.available, card: cardHtml.slice(0, 120) });
  // Editor remove act writes the contents without it.
  await openProfiles(w);
  const rm = [...w.document.querySelectorAll('[data-p591cremove]')].find((b) => b.getAttribute('data-p591cremove').includes('biy:day-9999'));
  check('L10b the editor paints the rotted pin with its remove act', !!rm);
  if (rm) click(w, rm);
  await sleep(80);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  const landed = await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === 'salesian'); return s && !((s.contents && s.contents.Morning) || []).some((it) => it.kind === 'episode'); }, 6000);
  check('L10c the editor\u2019s remove act writes the contents without the rotted pin (validators accept the removal)', landed);
  w.close();
}

// ---------- L11: homily pin ----------
{
  const pin = { kind: 'episode', key: 'homily|' + HOMILY_ENTRY.id };
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [pin]), { [HOMILY_KEY]: JSON.stringify([HOMILY_ENTRY]) }), { idbChunks: [{ id: HOMILY_ENTRY.id, seq: 0, bytes: 4096 }] });
  await sleep(300);
  const a = await fold614(w, '2026-11-22', 'homily|' + HOMILY_ENTRY.id);
  const da = a.descs.filter((d) => d.episodeId === 'homily:' + HOMILY_ENTRY.id);
  check('L11a with the take standing in the device index, the homily pin resolves available on-device',
    da.length === 1 && da[0].kind === 'homily' && da[0].available === true && da[0].episodeId === 'homily:' + HOMILY_ENTRY.id, da.map((d) => d.episodeId + '|' + d.available));
  w.close();
  const w2 = makeWorld(johnStore((doc) => setSalMorning(doc, [pin])));
  await sleep(300);
  const b = await fold614(w2, '2026-11-22', 'homily|' + HOMILY_ENTRY.id);
  const db = b.descs.filter((d) => d.episodeId === 'homily:' + HOMILY_ENTRY.id);
  check('L11b the SAME document cold-opened with an empty homily index stands the "Not available" card instead (Q2 A)',
    db.length === 1 && db[0].kind === 'homily' && db[0].available === false, db.map((d) => d.episodeId + '|' + d.available));
  w2.close();
}

// ---------- L5: dedupe in the ladder + v610 exception ----------
{
  const pin = { kind: 'episode', key: 'bible-in-a-year|biy:day-3' };
  const office = { kind: 'source', key: 'ext-morning-prayer' };
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [pin, office])));
  await sleep(300);
  await openLadder(w);
  click(w, door(w, 'br:catechesis')); await sleep(50);
  click(w, door(w, 'lf:podcasts')); await sleep(50);
  click(w, door(w, 'series:bible-in-a-year'));
  await until(() => addRow(w, 'episode:bible-in-a-year|biy:day-1') || [...w.document.querySelectorAll('.profaddladder603 .bookrow')].some((r) => r.textContent.includes('Already in Morning')), 6000);
  const marked = [...w.document.querySelectorAll('.profaddladder603 .bookrow')].find((r) => r.textContent.includes('Day 3') && r.textContent.includes('Already in Morning'));
  check('L5a a second add of the same episode is refused in the ladder: the row paints "Already in Morning", not tappable',
    !!marked && !marked.hasAttribute('data-p603additem'), marked && marked.textContent.slice(0, 120));
  click(w, w.document.querySelector('[data-p603back]')); await sleep(50);
  click(w, w.document.querySelector('[data-p603back]')); await sleep(50);
  click(w, w.document.querySelector('[data-p603back]')); await sleep(50);
  click(w, door(w, 'br:pray')); await sleep(50);
  click(w, door(w, 'lf:office')); await sleep(80);
  const offRow = addRow(w, 'source:ext-morning-prayer');
  check('L5b v610 exception stands in the same run: a doubled Divine Office hour still stands addable (its row stays tappable)',
    !!offRow, ladderText(w).slice(0, 200));
  // The block's own rows stand under Pray › Ora Pro Nobis:
  // a standing own source reads "Already in", not tappable
  // (the v610 D4c behavior, at its tree home).
  click(w, w.document.querySelector('[data-p603back]')); await sleep(50);
  click(w, door(w, 'lf:own')); await sleep(80);
  const ownRows = [...w.document.querySelectorAll('.profaddladder603 .bookrow')];
  const ownIds = ownRows.map((r) => r.getAttribute('data-p603additem'));
  check('L5d the block\u2019s own source rows stand under Pray \u203a Ora Pro Nobis, addable (any playable audio accessible from Add; the "Already in" marking rule for a standing own row is the standing isOn rule, proven at L5a/L9)',
    ownRows.length >= 3 && ownIds.includes('source:daily-rosary') && ownIds.includes('source:morning-prayer'), ownIds);
  const O = w.__opn;
  let kept2 = null;
  try { kept2 = O.opnCheckContents590({ Morning: [office, office] }, ['Morning']); } catch (e) {}
  check('L5c the validator keeps two copies of the office hour in one block (v610 dedupe exception untouched)',
    !!kept2 && kept2.Morning.length === 2, kept2);
  w.close();
}

// ---------- L6 + L7: exegesis node, head + gap ----------
async function openExegesisNode(w, presented) {
  const O = w.__opn;
  O.state.dayPayload = { presentedDay: presented, date: presented };
  O.state.presentedDay = presented;
  await openLadder(w);
  click(w, door(w, 'br:catechesis')); await sleep(50);
  click(w, door(w, 'lf:podcasts')); await sleep(50);
  click(w, door(w, 'series:daily-gospel-exegesis'));
  return until(() => ladderText(w).includes('No episode released for today') || !!addRow(w, 'day:daily-gospel-exegesis'), 6000);
}
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openExegesisNode(w, '2026-11-18');
  const head = addRow(w, 'day:daily-gospel-exegesis');
  const below18 = addRow(w, 'episode:daily-gospel-exegesis|' + G18);
  const below17 = [...w.document.querySelectorAll('.profaddladder603 [data-p603additem]')].some((r) => r.getAttribute('data-p603additem').startsWith('episode:daily-gospel-exegesis|') && r.getAttribute('data-p603additem') !== 'episode:daily-gospel-exegesis|' + G18);
  check('L6 exegesis node: the head carries the presented date label + the resolved episode\u2019s title; the resolved episode does NOT stand below the head; an earlier episode below is pinnable',
    !!head && head.textContent.includes('Wednesday, November 18, 2026') && head.textContent.includes('Wednesday of Week 33 in Ordinary Time') && !below18 && below17,
    head && head.textContent.slice(0, 160));
  w.close();
  const w2 = makeWorld(johnStore());
  await sleep(300);
  await openExegesisNode(w2, '2026-11-19');
  const pins = [...w2.document.querySelectorAll('.profaddladder603 [data-p603additem]')].filter((r) => r.getAttribute('data-p603additem').startsWith('episode:daily-gospel-exegesis|'));
  check('L7 GAP DAY: the head reads "No episode released for today", carries no add act, adds nothing; the feed below stands whole (all 3 episodes pinnable)',
    ladderText(w2).includes('No episode released for today') && !addRow(w2, 'day:daily-gospel-exegesis') && pins.length === 3,
    { pins: pins.length, txt: ladderText(w2).slice(0, 160) });
  w2.close();
}

// ---------- L8: course node, head + finished ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  // The fixture's production fold: the first 322 entries
  // listened, currentKey biy:day-322 (its listenedCount).
  // (By position, not by the entries' listened flags — the
  // shared fixture object is re-folded by earlier worlds.)
  w.__opn.opnPodCoreImportListens(BIBLE.entries.slice(0, 322).map((e) => ({ series: 'bible-in-a-year', seqKey: e.key, listenDate: '2026-11-21', source: 'harness-v614' })));
  await openLadder(w);
  click(w, door(w, 'br:catechesis')); await sleep(50);
  click(w, door(w, 'lf:courses')); await sleep(50);
  click(w, door(w, 'course:bible-in-a-year'));
  await until(() => addRow(w, 'course:bible-in-a-year'), 6000);
  const head = addRow(w, 'course:bible-in-a-year');
  const belowCur = addRow(w, 'episode:bible-in-a-year|biy:day-322');
  const belowOther = addRow(w, 'episode:bible-in-a-year|biy:day-1');
  check('L8 course node: the head is the next episode in the resolver\u2019s label form ("Next episode" + Day 322 label/title) and adds the course item; the next episode does not repeat below the head',
    !!head && head.textContent.includes('Next episode') && head.textContent.includes('Day 322') && !belowCur && !!belowOther,
    head && head.textContent.slice(0, 160));
  w.close();
  BIBLE_PAYLOAD = BIBLEFIN;
  const w2 = makeWorld(johnStore());
  await sleep(300);
  const O2 = w2.__opn;
  O2.opnPodCoreImportListens(BIBLEFIN.entries.map((e) => ({ series: 'bible-in-a-year', seqKey: e.key, listenDate: '2026-11-21', source: 'harness-v614' })));
  await openLadder(w2);
  click(w2, door(w2, 'br:catechesis')); await sleep(50);
  click(w2, door(w2, 'lf:courses')); await sleep(50);
  click(w2, door(w2, 'course:bible-in-a-year'));
  await until(() => ladderText(w2).includes('Course complete'), 6000);
  check('L8b the finished course\u2019s head reads "Course complete \u2014 no next episode" with no add act; episodes below stand pinnable',
    ladderText(w2).includes('Course complete \u2014 no next episode') && !addRow(w2, 'course:bible-in-a-year') && !!addRow(w2, 'episode:bible-in-a-year|biy:day-1'),
    ladderText(w2).slice(0, 160));
  w2.close();
  BIBLE_PAYLOAD = BIBLE;
}

// ---------- L9 (DOM): readings node ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  O.state.dayPayload = { presentedDay: '2026-12-29', date: '2026-12-29' };
  O.state.presentedDay = '2026-12-29';
  await openLadder(w);
  click(w, door(w, 'br:worship')); await sleep(50);
  click(w, door(w, 'lf:lectionary'));
  await until(() => ladderText(w).includes('Tuesday, December 29, 2026'), 6000);
  const head = [...w.document.querySelectorAll('.profaddladder603 .bookrow')].find((r) => r.textContent.includes('Tuesday, December 29, 2026'));
  const below29 = addRow(w, 'episode:daily-readings|' + R29.key);
  const below28 = addRow(w, 'episode:daily-readings|' + R28.key);
  check('L9 readings node: the head is the seat item under today\u2019s date label (Tuesday, December 29, 2026) with the resolved entry\u2019s title under it (already standing in Morning — painted marked); previous days stand below under their own dates; today\u2019s entry does not repeat below',
    !!head && head.textContent.includes('Daily Mass Reading Podcast for December 29, 2026') && head.textContent.includes('Already in Morning') && !below29 && !!below28 && below28.textContent.includes('December 28, 2026'),
    head && head.textContent.slice(0, 160));
  w.close();
}

// ---------- L15: search ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w);
  await until(() => opnLadderReady(w), 6000).catch(() => false);
  function opnLadderReady(w2) { return !!w2.document.querySelector('[data-p603search]'); }
  const inp = w.document.querySelector('[data-p603search]');
  type(w, inp, 'Bible');
  await sleep(120);
  const heads = [...w.document.querySelectorAll('.profaddladder603 .sectionhead')].map((h) => h.textContent);
  const rowsTxt = ladderText(w);
  check('L15a head search groups matches by tree path with the path named (Catechesis \u203a Courses stands as a group head; the Bible course row stands under it)',
    heads.some((h) => h.includes('Catechesis \u203a Courses')) && rowsTxt.includes('Bible in a Year'), heads);
  type(w, w.document.querySelector('[data-p603search]'), 'Luke 19');
  await sleep(120);
  check('L15b episode titles appear in NO head-search result (a DGE episode title fragment matches nothing addable)',
    ladderText(w).includes('Nothing addable matches'), ladderText(w).slice(0, 160));
  type(w, w.document.querySelector('[data-p603search]'), '');
  await sleep(80);
  click(w, door(w, 'br:catechesis')); await sleep(50);
  click(w, door(w, 'lf:podcasts')); await sleep(50);
  click(w, door(w, 'series:bible-in-a-year'));
  await until(() => addRow(w, 'episode:bible-in-a-year|biy:day-1'), 6000);
  const inp2 = w.document.querySelector('[data-p603search]');
  const fullCount = w.document.querySelectorAll('.profaddladder603 [data-p603additem]').length;
  type(w, inp2, 'In the Beginning');
  await sleep(120);
  const narrowed = [...w.document.querySelectorAll('.profaddladder603 [data-p603additem]')];
  check('L15c inside a series node, "Search episodes" narrows that node\u2019s list only (the Day 1 title stands alone)',
    inp2.getAttribute('placeholder') === 'Search episodes' && narrowed.length === 1 && narrowed[0].getAttribute('data-p603additem') === 'episode:bible-in-a-year|biy:day-1',
    { ph: inp2.getAttribute('placeholder'), n: narrowed.length, full: fullCount });
  type(w, w.document.querySelector('[data-p603search]'), '');
  await sleep(120);
  check('L15d clearing restores the node\u2019s full list', w.document.querySelectorAll('.profaddladder603 [data-p603additem]').length === fullCount, { full: fullCount });
  w.close();
}

// ---------- L16: both scopes ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w);
  click(w, door(w, 'br:catechesis')); await sleep(50);
  click(w, door(w, 'lf:podcasts')); await sleep(50);
  click(w, door(w, 'series:bible-in-a-year'));
  await until(() => addRow(w, 'episode:bible-in-a-year|biy:day-3'), 6000);
  click(w, addRow(w, 'episode:bible-in-a-year|biy:day-3'));
  await until(() => !w.document.querySelector('.profaddladder603'), 3000);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  const landed = await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === 'salesian'); return s && ((s.contents && s.contents.Morning) || []).some((it) => it.kind === 'episode' && it.key === 'bible-in-a-year|biy:day-3'); }, 6000);
  check('L16a a pick through the standing profile-editor host lands in the profile (same tree builder, the host\u2019s own add act)', landed);
  w.close();
  const w2 = makeWorld(johnStore());
  await sleep(300);
  w2.__opn.openEditTodayScreen594(true);
  const addUp = await until(() => w2.document.querySelector('[data-p594tadd="Morning"]'), 6000);
  check('L16b Edit today opens with its Morning Add act', addUp);
  if (addUp) click(w2, w2.document.querySelector('[data-p594tadd="Morning"]'));
  await until(() => w2.document.querySelector('.profaddladder603'), 6000);
  click(w2, door(w2, 'br:catechesis')); await sleep(50);
  click(w2, door(w2, 'lf:podcasts')); await sleep(50);
  click(w2, door(w2, 'series:bible-in-a-year'));
  await until(() => addRow(w2, 'episode:bible-in-a-year|biy:day-4'), 6000);
  click(w2, addRow(w2, 'episode:bible-in-a-year|biy:day-4'));
  await until(() => !w2.document.querySelector('.profaddladder603'), 3000);
  const saveT = w2.document.querySelector('[data-p600savetoday]');
  if (saveT) click(w2, saveT);
  const landedT = await until(async () => { const p = await profilesPayload(w2); return p.todayEdit && p.todayEdit.contents && ((p.todayEdit.contents.Morning) || []).some((it) => it.kind === 'episode' && it.key === 'bible-in-a-year|biy:day-4'); }, 6000);
  check('L16c a pick through the Edit-today host lands in today\u2019s draft and Save today writes it (the same tree builder)', landedT);
  w2.close();
}

// ---------- L17: Prayer Book descent (the v603 R3-R7 behaviors, tree home) ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w);
  click(w, door(w, 'br:pray')); await sleep(50);
  click(w, door(w, 'lf:prayerbook')); await sleep(80);
  const groups = [...w.document.querySelectorAll('[data-p603group]')];
  const counts = groups.map((g) => g.getAttribute('data-p603group') + ':' + (g.querySelector('.meta') ? g.querySelector('.meta').textContent.trim() : ''));
  check('L17a Pray \u203a Prayer Book descends to the served categories with their counts (the v603 prayer rung, at its tree home)',
    groups.length === 9 && counts.some((c) => c.startsWith('Daily:24')) && counts.some((c) => c.startsWith('Our Lady:9')) && counts.some((c) => c.startsWith('The Raccolta:8')), counts);
  click(w, groups.find((g) => g.getAttribute('data-p603group') === 'Our Lady'));
  await sleep(80);
  const prs = [...w.document.querySelectorAll('[data-p603additem]')];
  const inp = w.document.querySelector('[data-p603search]');
  type(w, inp, 'Memorare');
  await sleep(80);
  const narrowed = [...w.document.querySelectorAll('[data-p603additem]')];
  check('L17b the Our Lady category lists its 9 prayers; in-category search narrows that rung only (Memorare stands alone)',
    prs.length === 9 && prs.every((r) => r.getAttribute('data-p603additem').startsWith('prayer:'))
    && narrowed.length === 1 && narrowed[0].getAttribute('data-p603additem') === 'prayer:memorare',
    { prs: prs.length, narrowed: narrowed.map((r) => r.getAttribute('data-p603additem')) });
  click(w, narrowed[0]);
  await until(() => !w.document.querySelector('.profaddladder603'), 3000);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  check('L17c a prayer pick returns to the editor, which stands dirty with Save live (the host add act took the item)',
    !!saveBtn && !saveBtn.disabled);
  w.close();
}

// ---------- L12: vault gate in front of both editor hosts ----------
{
  const w0 = makeWorld(johnStore());
  await sleep(400);
  const O0 = w0.__opn;
  O0.opnDoc();
  await O0.opnVaultCreate('2468', 'RECOVERY-CODE-614');
  const store = {};
  for (let i = 0; i < w0.localStorage.length; i++) { const k = w0.localStorage.key(i); store[k] = w0.localStorage.getItem(k); }
  const envelope = store[DATA_KEY];
  check('L12a the vault envelope is built from John\u2019s real document by the client\u2019s own opnVaultCreate',
    !!envelope && JSON.parse(envelope).format === 'orapronobis-personal-data-encrypted');
  w0.close();
  const wA = makeWorld(store);
  await sleep(400);
  wA.__opn.openProfilesScreen(null, {});
  const gateA = await until(() => !!wA.document.getElementById('opn-unlock-go'), 6000);
  check('L12b locked vault: an Add attempt from the profile-editor host stands behind profVaultGate594 (unlock card stands, no ladder, no contents write)',
    gateA && wA.__opn.opnVaultLocked() === true && !wA.document.querySelector('.profaddladder603') && wA.localStorage.getItem(DATA_KEY) === envelope);
  wA.close();
  const wB = makeWorld(store);
  await sleep(400);
  wB.__opn.openEditTodayScreen594(true);
  const gateB = await until(() => !!wB.document.getElementById('opn-unlock-go'), 6000);
  check('L12c locked vault: an Add attempt from the Edit-today host stands behind the same gate (no silent 423 dead write)',
    gateB && wB.__opn.opnVaultLocked() === true && !wB.document.querySelector('.profaddladder603') && wB.localStorage.getItem(DATA_KEY) === envelope);
  wB.close();
}

console.log('harness-v614:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
