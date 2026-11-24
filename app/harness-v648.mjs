// harness-v648.mjs — v648: a labeled slot's settle is
// ATOMIC — title, stream, and image all come from the ONE
// chosen source's record on every path (live settle, cache
// restore, flip re-settle, queue build), and the download
// fetches the CHOSEN source's audio (doc §3).
//
// Legs (doc §3 Gates):
//  L1 (field shape, fail-on-old): choice = Sing the Hours
//      first; cold settle from the payload → record stands
//      title StH · source StH · enclosure castos · audio
//      bytes the StH item · image the StH record's image.
//      The pass-through stub models the SHIPPED choice-blind
//      re-resolution when no src stands (DO answers first):
//      on the base client the same world lands DO bytes
//      under the StH title with DO art — John's row,
//      reproduced (L1-old).
//  L2: choice = Divine Office first → whole DO record,
//      backup the whole StH record (image included), and
//      the day cache the settle writes carries the backup.
//  L3: the flip re-settle swaps title, stream, image
//      together, both directions; a no-change flip is a
//      no-op (no new download).
//  L4: a cached labeled record missing its backup, or with
//      a null image, is pruned AND its audio-cache entry
//      evicted; the slot re-settles whole. A whole cached
//      record restores untouched (no eviction, no
//      re-download).
//  L5: a queue built before a flip: the sounding item
//      finishes as it is (mint guard); the next item
//      re-resolves (queueLiveDesc) to the re-settled record.
//  L6: Evening Prayer mirrors L1–L4 (asserted in each leg).
//  L7 (Worker, real bundle): src=Sing the Hours serves the
//      row's backup_url · src=Divine Office serves the row's
//      stream_url · unmatched src → 404 · no src → standing
//      behavior (feed re-resolution + the v631 fail-soft).
//  L8 (extension): the OFFLINE completeness pass
//      (offlineFetchItemAudio via offlineDownloadItemsCache)
//      names the labeled item's standing source on its
//      pass-through URL the same way: an unsettled labeled
//      slot standing under Sing the Hours lands StH bytes in
//      opn-ext-audio-v1 (on the base tree the choice-blind
//      pass-through lands DO bytes under the StH record —
//      L8-old); a Divine Office-standing labeled item lands
//      DO bytes.
//  W1: the live payload's backup carries imageUrl (0051).
//  W2: the watcher's backup write stands backup_image_url
//      (matched item's image, else the feed channel image).
//  W3: the v634 displacement write carries the displaced
//      fill's image as backup_image_url.
//  L9 (amendment §3.7, title verbatim, fail-on-old): the
//      world's payload carries a backup.title DISTINCT from
//      the composed form ('Morning Prayer - Sing the Hours
//      (Lauds)'); under the StH choice the settled/painted
//      title is exactly that string; on the base tree the
//      same world paints the composed 'Morning Prayer -
//      Sing the Hours' (L9-old).
//  L10 (amendment §3.7, duration, fail-on-old): the world's
//      backup carries durationSec ≠ the entry's (entry 1091,
//      backup 754); under the StH choice the settled
//      record's durationSec is the backup's; under the DO
//      choice it is 1091; on the base tree the StH choice
//      stands 1091 (L10-old).
//  W4: the payload's backup carries durationSec from
//      backup_duration_s (0051 amendment).
//  W5: the watcher's backup write stands backup_duration_s
//      (the matched item's durationS).
//  W6: the v634 displacement write carries the displaced
//      fill's duration_s as backup_duration_s.
//  L11 (§4 addendum F1, fail-on-old): AMD world, StH first,
//      both StH download routes fail → the extDownload
//      backup flip settles the DO record WHOLE (DO title ·
//      stream · source · logo image · durationSec 1091); on
//      the pre-fix v648 client (4d49fcf) the same world
//      settles the StH image + 754 (L11-old, Review probe d).
//  L12 (§4 addendum F2, fail-on-old): a whole cached
//      StH-choice labeled record on a DO-standing day
//      restores UNTOUCHED (no re-download, cached blob
//      byte-identical); mirror leg for a whole cached
//      DO-choice record; on the pre-fix client the StH side
//      re-downloads and the blob is replaced (L12-old,
//      Review probes c/g2).
//
// Fixtures (Improvement D — production sources, named):
//  the REAL 2026-11-24 live payload shape, read firsthand
//  at Plan time (doc §1): both labeled entries whole — DO
//  title/stream/logo image/source + backup {castos
//  streamUrl, source 'Sing the Hours', title}; the backup's
//  imageUrl added in the 0051 payload shape from the StH
//  feed's channel image. Worker fixtures follow
//  harness-v631 (the real 2026-11-23 production rows + the
//  live castos enclosures) and harness-v634 (synthesis
//  displacement posture).
//
// Run: node app/harness-v648.mjs
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 450)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const BASE = git(['rev-parse', '0bd6980']).trim(); // main, pin ora-pro-nobis-v647-1
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const clientOldSrc = git(['show', BASE + ':app/worker/src/client.ts']);
// §4 addendum (F1/F2 fail-on-old): the PRE-FIX v648 tree —
// commit 4d49fcf, the Implement head the Review read (the
// §3.7 choice already carries backup imageUrl/durationSec,
// but the extDownload flip and the courier pointer-confirm
// still stand in their pre-fix shapes).
const clientPreSrc = git(['show', '4d49fcf:app/worker/src/client.ts']);
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- Statics ----------
{
  const mig = existsSync(APP + 'migrations/0051_ext_backup_image.sql') ? readFileSync(APP + 'migrations/0051_ext_backup_image.sql', 'utf8') : '';
  check('S1 migration 0051 stands: ext_resolutions gains backup_image_url', mig.includes('ALTER TABLE ext_resolutions ADD COLUMN backup_image_url TEXT'), mig.slice(0, 120));
  check('S1b migration 0051 (amendment §3.7) stands in the SAME file: ext_resolutions gains backup_duration_s INTEGER', mig.includes('ALTER TABLE ext_resolutions ADD COLUMN backup_duration_s INTEGER'), mig.slice(0, 120));
  check('S2 server: payload backup carries imageUrl from the new column; the backup write + INSERT carry backup_image_url (column last, positional discipline)',
    indexSrc.includes('imageUrl: res.backup_image_url ?? null')
    && indexSrc.includes('SET backup_url=?, backup_source=?, backup_image_url=?')
    && indexSrc.includes('backup_url, backup_source, route, backup_image_url'), {});
  check('S3 server: the pass-through src leg stands (labeled slots only, row serve, unmatched → 404)',
    indexSrc.includes('const src648 = url.searchParams.get("src")')
    && indexSrc.includes('src648 === row648.source') && indexSrc.includes('src648 === row648.backup_source')
    && indexSrc.includes('no episode resolved for that source'), {});
  const choice = grab(clientSrc, 'opnExtChoice628');
  check('S4 client: opnExtChoice628 returns imageUrl on both sides (chosen side its own image, backup side its image)',
    choice.includes('imageUrl: e.backup.imageUrl || null') && choice.includes('imageUrl: e.imageUrl || null, durationSec: e.durationSec } };')
    && choice.includes('backup: null, imageUrl: e.imageUrl || null'), choice.slice(0, 200));
  check('S10 client (amendment §3.7, DELTA 1): opnExtChoice628 takes the backup title VERBATIM — backupTitle is e.backup.title, falling back to the slot\'s BARE title; no composed source-suffixed title stands anywhere in the choice',
    choice.includes('var backupTitle = e.backup.title || slot.title') && !choice.includes("slot.title + ' - '")
    && choice.includes('var backup = { title: backupTitle,'), choice.slice(0, 200));
  check('S11 client+server (amendment §3.7, DELTA 2): the choice returns durationSec on both sides; courier + v638 hook settleMeta take the CHOICE durationSec for labeled slots; writeCache stores the labeled backup durationSec; payload backup carries durationSec from backup_duration_s; backup write + displacement INSERT carry backup_duration_s (column last)',
    choice.includes('durationSec: e.backup.durationSec') && choice.includes('durationSec: e.durationSec, backup: backup')
    && grab(clientSrc, 'resolveExternals').includes('? choice628.durationSec : e.durationSec') && grab(clientSrc, 'resolveExternals').includes('durationSec: choice638.durationSec')
    && grab(clientSrc, 'resolveExternals').includes('durationSec: st.backup.durationSec')
    && indexSrc.includes('durationSec: res.backup_duration_s ?? null')
    && indexSrc.includes('SET backup_url=?, backup_source=?, backup_image_url=?, backup_duration_s=?')
    && indexSrc.includes('backup_image_url, backup_duration_s'), {});
  check('S12 client (§4 addendum F1): the extDownload backup flip takes the BACKUP\'s own imageUrl + durationSec — never the failed first choice\'s fields',
    clientSrc.includes('durationSec: meta.backup.durationSec') && clientSrc.includes('imageUrl: meta.backup.imageUrl || null')
    && !clientSrc.includes('enclosureUrl: meta.backup.streamUrl, durationSec: meta.durationSec'), {});
  check('S13 client (§4 addendum F2): the courier pointer-confirm compares the cached streamUrl against the CHOICE-reordered stream (choice computed before the confirm; no raw-entry confirm stands)',
    grab(clientSrc, 'resolveExternals').includes('c.streamUrl === choice628.streamUrl')
    && !clientSrc.includes('c.streamUrl === e.streamUrl'), {});
  const rex = grab(clientSrc, 'resolveExternals');
  check('S5 client: courier + v638 hook settleMeta pass the CHOICE image for labeled slots; extDownload pass-through carries &src= for labeled slots',
    rex.includes("choice628.imageUrl || null") && rex.includes('imageUrl: choice638.imageUrl || null')
    && rex.includes("'&src=' + encodeURIComponent(meta.source)"), {});
  check('S6 client: writeCache stores the labeled backup whole; the prune extends (source · backup missing · imageUrl null) with audio-cache eviction in the same act',
    rex.includes('rec.slots[slot.slotId].backup = { streamUrl: st.backup.streamUrl')
    && rex.includes('!c637.backup') && rex.includes('!c637.imageUrl')
    && rex.includes("cache648.delete(offlineDayKey(date, sid637))"), {});
  check('S7 client: oraSnapshotTrack native mediaUri for a labeled slot carries the standing source via the pass-through + &src=',
    grab(clientSrc, 'oraSnapshotTrack').includes("'&src=' + encodeURIComponent(st.source)"), {});
  const offFetch = grab(clientSrc, 'offlineFetchItemAudio');
  check('S9 client: offlineFetchItemAudio pass-through carries &src= for the two labeled slots, named from item.source (the item the pass already holds)',
    offFetch.includes("item.id === 'ext-morning-prayer' || item.id === 'ext-evening-prayer'")
    && offFetch.includes("'&src=' + encodeURIComponent(item.source)"), offFetch.slice(0, 300));
}

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const appJsOld = renderJs(clientOldSrc);
const appJsPre = renderJs(clientPreSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S8 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v648:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
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
const HOOK = '\n;window.__opn = { opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, opnSthPrimary628, opnSthFirstSet632, opnExtChoice628, renderPrayersSide, setTab, queueLiveDesc, offlineFetchItemAudio, offlineDownloadItemsCache };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The real 2026-11-24 live payload shape (doc §1): DO
// standing (title/stream/logo/source), StH as the backup
// object — with the backup's imageUrl in the 0051 shape
// (the StH feed's channel image).
const DO_IMG = 'https://do.example/divine-office-logo.jpg';
const STH_IMG = 'https://sth.example/sing-the-hours-channel.jpg';
const DO_MP = 'https://do.example/divine-1124-mp.mp3';
const DO_EP = 'https://do.example/divine-1124-ep.mp3';
const STH_MP = 'https://sth.example/lauds-1124.mp3';
const STH_EP = 'https://sth.example/vespers-1124.mp3';
const LIVE648 = { slots: [
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: DO_MP, durationSec: 754, sizeBytes: 1000000, imageUrl: DO_IMG, source: 'Divine Office', backup: { streamUrl: STH_MP, source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours', imageUrl: STH_IMG } },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: DO_EP, durationSec: 754, sizeBytes: 1000000, imageUrl: DO_IMG, source: 'Divine Office', backup: { streamUrl: STH_EP, source: 'Sing the Hours', title: 'Evening Prayer - Sing the Hours', imageUrl: STH_IMG } },
]};
// L4's evening entry: an StH-filled row shape, as the
// server serves it (the fill write stands source 'Sing
// the Hours', the castos pointer, NO backup object) — the
// courier confirms a whole cached record by pointer.
const LIVE648_L4 = { slots: [
  LIVE648.slots[0],
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Sing the Hours', streamUrl: STH_EP, durationSec: 754, sizeBytes: 1000000, imageUrl: STH_IMG, source: 'Sing the Hours' },
]};
// The amendment world (§3.7): the backup's served title is
// DISTINCT from the composed form (the record's own title,
// with its hour name), the entry's durationSec is the field
// screenshot's 1091 (18:11, the Divine Office entry) and the
// backup's durationSec differs (754).
const LIVE648_AMD = { slots: [
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: DO_MP, durationSec: 1091, sizeBytes: 1000000, imageUrl: DO_IMG, source: 'Divine Office', backup: { streamUrl: STH_MP, source: 'Sing the Hours', title: 'Morning Prayer - Sing the Hours (Lauds)', imageUrl: STH_IMG, durationSec: 754 } },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: DO_EP, durationSec: 1091, sizeBytes: 1000000, imageUrl: DO_IMG, source: 'Divine Office', backup: { streamUrl: STH_EP, source: 'Sing the Hours', title: 'Evening Prayer - Sing the Hours (Vespers)', imageUrl: STH_IMG, durationSec: 754 } },
]};
let LIVE_NOW = LIVE648;
let FETCHLOG = [];
// §4 addendum L11: when set, BOTH Sing the Hours download
// routes fail (the pass-through asked for src=Sing the
// Hours, and the direct castos enclosure) — the AMD world's
// backup flip is the only settle left standing.
let FAIL_STH = false;
function bytesFor(u) {
  if (u.includes('/api/player/externals/audio')) {
    // The pass-through stub: with src, it models the §3.4
    // row serve; WITHOUT src it models the SHIPPED
    // choice-blind re-resolution — Divine Office answers
    // first, whatever the client's choice stands.
    const q = new URL(u, 'https://app.orapronobis.media').searchParams;
    return q.get('src') === 'Sing the Hours' ? 'STH-AUDIO-BYTES' : 'DO-AUDIO-BYTES';
  }
  if (u.startsWith('https://do.example/')) return 'DO-AUDIO-BYTES';
  if (u.startsWith('https://sth.example/')) return 'STH-AUDIO-BYTES';
  return 'X-BYTES';
}
function fetchStub(url) {
  const u = String(url);
  FETCHLOG.push(u);
  if (FAIL_STH && (u.startsWith('https://sth.example/') || (u.includes('/api/player/externals/audio') && u.includes('src=Sing%20the%20Hours')))) {
    return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.resolve(new Blob(['ERR'], { type: 'audio/mpeg' })) });
  }
  let body = {};
  if (u.includes('/api/player/source-settings')) body = { sources: SEED_ROWS, version: 7 };
  else if (u.includes('/api/player/externals/live')) body = LIVE_NOW;
  else if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(''), blob: () => Promise.resolve(new Blob([bytesFor(u)], { type: 'audio/mpeg' })) });
}
function makeFakeCaches() {
  const store = new Map();
  const cache = {
    put: (k, resp) => Promise.resolve(resp.blob()).then((b) => b.text()).then((t) => { store.set(String(k), t); }),
    match: (k) => { const t = store.get(String(k)); return Promise.resolve(t === undefined ? undefined : new Response(t, { headers: { 'Content-Type': 'audio/mpeg' } })); },
    delete: (k) => Promise.resolve(store.delete(String(k))),
    keys: () => Promise.resolve([...store.keys()].map((u) => ({ url: u }))),
  };
  return { open: () => Promise.resolve(cache), delete: () => Promise.resolve(true), _store: store };
}
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  try { w.URL.createObjectURL = () => 'blob:fake-' + Math.random(); w.URL.revokeObjectURL = () => {}; } catch (e) {}
  try { w.Response = Response; w.Blob = Blob; } catch (e) {}
  const fakeCaches = makeFakeCaches();
  try { w.caches = fakeCaches; } catch (e) {}
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return { w, fakeCaches };
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
// The client build's date is the SERVED day's date — the
// v597 production fixture day (2026-11-21), exactly as in
// harness-v638's worlds (the /api/player/day fixture
// governs the build; the live stub answers any date).
const CDATE = '2026-11-21';
const audioKey = (sid) => 'day/' + CDATE + '/' + sid;

// ---------- L1 ◆: the field shape — StH first, cold settle ----------
{
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJs, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const built = await buildDay(w);
  await until(() => fakeCaches._store.get(audioKey('ext-morning-prayer')) !== undefined, 6000);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  const mpD = descOf(w, 'ext-morning-prayer');
  check('L1 ◆ Morning cold settle, Sing the Hours first: record stands title StH · source StH · enclosure the castos pointer · image the StH record\'s image (never DO art, never null/Ora)',
    built && !!mp && mp.state === 'present' && mp.title === 'Morning Prayer - Sing the Hours' && mp.source === 'Sing the Hours'
    && mp.enclosureUrl === STH_MP && mp.imageUrl === STH_IMG && !!mpD && mpD.title === 'Morning Prayer - Sing the Hours' && mpD.imageUrl === STH_IMG,
    { mp: mp && { title: mp.title, source: mp.source, enclosureUrl: mp.enclosureUrl, imageUrl: mp.imageUrl } });
  check('L1 ◆ the downloaded audio bytes are the Sing the Hours item (the pass-through was asked for src=Sing the Hours and served it)',
    fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES'
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-morning-prayer') && u.includes('src=Sing%20the%20Hours')),
    { bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  check('L6 ◆ Evening mirrors L1: title StH · source StH · castos enclosure · StH image · StH audio bytes',
    !!ep && ep.state === 'present' && ep.title === 'Evening Prayer - Sing the Hours' && ep.source === 'Sing the Hours'
    && ep.enclosureUrl === STH_EP && ep.imageUrl === STH_IMG
    && fakeCaches._store.get(audioKey('ext-evening-prayer')) === 'STH-AUDIO-BYTES',
    { ep: ep && { title: ep.title, source: ep.source, imageUrl: ep.imageUrl }, bytes: fakeCaches._store.get(audioKey('ext-evening-prayer')) });
  w.close();
}
{
  // Fail-on-old: the base client (v647 tree) in the SAME
  // world — its choice carries no image (settle takes the
  // standing entry's DO art) and its pass-through names no
  // source (the stub's shipped re-resolution serves DO).
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJsOld, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const built = await buildDay(w);
  await until(() => fakeCaches._store.get(audioKey('ext-morning-prayer')) !== undefined, 6000);
  await sleep(400);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('L1-old ◆ REPRODUCED on the base client (v647): the StH-titled record stands over DIVINE OFFICE audio bytes with the DIVINE OFFICE logo as its image — John\'s row exactly',
    built && !!mp && mp.state === 'present' && mp.title === 'Morning Prayer - Sing the Hours' && mp.source === 'Sing the Hours'
    && mp.enclosureUrl === STH_MP && mp.imageUrl === DO_IMG
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'DO-AUDIO-BYTES',
    { mp: mp && { title: mp.title, source: mp.source, imageUrl: mp.imageUrl }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')) });
  w.close();
}

// ---------- L2 ◆: Divine Office first — the whole DO record ----------
{
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  let cache = null;
  try { cache = JSON.parse(w.localStorage.getItem(EXT_CACHE_KEY) || 'null'); } catch (e) {}
  const cacheMp = cache && cache.slots && cache.slots['ext-morning-prayer'];
  check('L2 ◆ Morning, Divine Office first: title DO · stream the DO file · image the DO logo · backup the WHOLE StH record (stream + source + title + image)',
    built && !!mp && mp.state === 'present' && mp.title === 'Morning Prayer - Divine Office' && mp.source === 'Divine Office'
    && mp.enclosureUrl === DO_MP && mp.imageUrl === DO_IMG
    && !!mp.backup && mp.backup.streamUrl === STH_MP && mp.backup.source === 'Sing the Hours' && mp.backup.title === 'Morning Prayer - Sing the Hours' && mp.backup.imageUrl === STH_IMG
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'DO-AUDIO-BYTES',
    { mp: mp && { title: mp.title, source: mp.source, imageUrl: mp.imageUrl, backup: mp.backup } });
  check('L2 ◆ the day cache the settle writes (§3.5) carries the labeled backup whole, image included',
    !!cacheMp && cacheMp.source === 'Divine Office' && cacheMp.imageUrl === DO_IMG
    && !!cacheMp.backup && cacheMp.backup.streamUrl === STH_MP && cacheMp.backup.source === 'Sing the Hours' && cacheMp.backup.imageUrl === STH_IMG,
    { cacheMp });
  check('L6 ◆ Evening mirrors L2: whole DO record + whole StH backup',
    !!ep && ep.title === 'Evening Prayer - Divine Office' && ep.enclosureUrl === DO_EP && ep.imageUrl === DO_IMG
    && !!ep.backup && ep.backup.streamUrl === STH_EP && ep.backup.imageUrl === STH_IMG,
    { ep: ep && { title: ep.title, backup: ep.backup } });
  w.close();
}

// ---------- L3 ◆: the flip re-settle swaps the whole record ----------
{
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await buildDay(w);
  await flip(w, 'sth');
  const toSth = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Sing the Hours'; }, 12000);
  await sleep(300);
  const mp1 = slotOf(w, 'ext-morning-prayer'), ep1 = slotOf(w, 'ext-evening-prayer');
  check('L3 ◆ flip to Sing the Hours: title, stream AND image swap together (StH title · castos stream · StH image), backup now the whole DO record',
    toSth && !!mp1 && mp1.title === 'Morning Prayer - Sing the Hours' && mp1.enclosureUrl === STH_MP && mp1.imageUrl === STH_IMG
    && !!mp1.backup && mp1.backup.streamUrl === DO_MP && mp1.backup.imageUrl === DO_IMG
    && !!ep1 && ep1.title === 'Evening Prayer - Sing the Hours' && ep1.enclosureUrl === STH_EP && ep1.imageUrl === STH_IMG,
    { mp1: mp1 && { title: mp1.title, enclosureUrl: mp1.enclosureUrl, imageUrl: mp1.imageUrl, backup: mp1.backup } });
  click(w, w.document.querySelector('[data-p607done]'));
  await sleep(300);
  await flip(w, 'do');
  const back = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Divine Office'; }, 12000);
  await sleep(300);
  const mp2 = slotOf(w, 'ext-morning-prayer');
  check('L3 ◆ flip back: the whole DO record returns together (DO title · DO stream · DO logo)',
    back && !!mp2 && mp2.title === 'Morning Prayer - Divine Office' && mp2.enclosureUrl === DO_MP && mp2.imageUrl === DO_IMG,
    { mp2: mp2 && { title: mp2.title, enclosureUrl: mp2.enclosureUrl, imageUrl: mp2.imageUrl } });
  // No-change flip: the hook re-runs with the standing
  // choice — settleMeta's guard makes it a no-op (no new
  // pass-through / enclosure fetch for the labeled slots).
  const ptBefore = FETCHLOG.filter((u) => u.includes('externals/audio') || u.startsWith('https://do.example/') || u.startsWith('https://sth.example/')).length;
  await w.__opn.state.extResettleLabeled638();
  await sleep(1200);
  const ptAfter = FETCHLOG.filter((u) => u.includes('externals/audio') || u.startsWith('https://do.example/') || u.startsWith('https://sth.example/')).length;
  const mp3 = slotOf(w, 'ext-morning-prayer');
  check('L3 ◆ a no-change re-settle is a no-op: the record stands identical and no labeled download fires',
    !!mp3 && mp3.state === 'present' && mp3.source === 'Divine Office' && mp3.enclosureUrl === DO_MP && ptAfter === ptBefore,
    { ptBefore, ptAfter, mp3: mp3 && { source: mp3.source, enclosureUrl: mp3.enclosureUrl } });
  w.close();
}

// ---------- L4 ◆: the whole-record prune + eviction ----------
// The seeded day cache is the client's OWN written record
// (a first build in the same posture, dumped and mutated —
// the harness-v638 L4 recipe), so every validity field
// (date · settings version · profile fold) stands exactly
// as writeCache wrote it; only the labeled records' shapes
// are mutated into the defective / whole forms under test.
function dumpStore(w) {
  const out = {};
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); out[k] = w.localStorage.getItem(k); }
  return out;
}
async function writtenCacheStore(mutate) {
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  await buildDay(w);
  const store = dumpStore(w);
  w.close();
  const rec = JSON.parse(store[EXT_CACHE_KEY]);
  mutate(rec.slots);
  store[EXT_CACHE_KEY] = JSON.stringify(rec);
  return store;
}
{
  // Morning: source names the choice (StH) but the record
  // carries NO backup and its audio-cache blob is the other
  // source's bytes (the poisoned shape). Evening: whole.
  const store = await writtenCacheStore((slots) => { delete slots['ext-morning-prayer'].backup; });
  LIVE_NOW = LIVE648_L4; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJs, store);
  fakeCaches._store.set(audioKey('ext-morning-prayer'), 'POISONED-DO-BYTES');
  fakeCaches._store.set(audioKey('ext-evening-prayer'), 'CACHED-STH-VESPERS-BYTES');
  await sleep(400);
  const built = await buildDay(w);
  await until(() => fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES', 8000);
  await sleep(400);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  check('L4 ◆ a cached labeled record MISSING ITS BACKUP is pruned + its audio entry evicted: the slot re-settles whole from the live payload and the fresh StH download replaces the poisoned blob',
    built && !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.enclosureUrl === STH_MP && mp.imageUrl === STH_IMG
    && !!mp.backup && mp.backup.streamUrl === DO_MP && mp.backup.imageUrl === DO_IMG
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES',
    { mp: mp && { source: mp.source, imageUrl: mp.imageUrl, backup: mp.backup }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')) });
  check('L4 ◆ a WHOLE cached record restores untouched: no eviction (its blob stands byte-identical), no re-download (no pass-through fetch for the slot)',
    !!ep && ep.state === 'present' && ep.source === 'Sing the Hours' && ep.enclosureUrl === STH_EP && ep.imageUrl === STH_IMG
    && fakeCaches._store.get(audioKey('ext-evening-prayer')) === 'CACHED-STH-VESPERS-BYTES'
    && !FETCHLOG.some((u) => u.includes('externals/audio') && u.includes('slot=ext-evening-prayer')),
    { ep: ep && { source: ep.source, enclosureUrl: ep.enclosureUrl }, bytes: fakeCaches._store.get(audioKey('ext-evening-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  w.close();
}
{
  // Variant: backup whole but imageUrl null → pruned too.
  const store = await writtenCacheStore((slots) => { slots['ext-morning-prayer'].imageUrl = null; });
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJs, store);
  fakeCaches._store.set(audioKey('ext-morning-prayer'), 'POISONED-DO-BYTES');
  await sleep(400);
  const built = await buildDay(w);
  await until(() => fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES', 8000);
  await sleep(300);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('L4 ◆ a cached labeled record with a NULL IMAGE is pruned + evicted likewise: re-settled whole (StH image stands, never the Ora fallback), fresh StH bytes',
    built && !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.imageUrl === STH_IMG
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES',
    { mp: mp && { source: mp.source, imageUrl: mp.imageUrl }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')) });
  w.close();
}

// ---------- L5 ◆: the queue across a flip ----------
{
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  await buildDay(w);
  const O = w.__opn;
  const sounding = descOf(w, 'ext-morning-prayer');
  // The next item's tap-time snapshot stands available:false
  // (its download was still in flight when the queue was
  // built — the v338 posture queueLiveDesc re-resolves).
  const nextSnap = Object.assign({}, descOf(w, 'ext-evening-prayer'), { available: false });
  O.state.current = sounding;
  O.state.queue = [sounding, nextSnap];
  O.state.queueIdx = 0;
  const sndUrl = sounding.url, sndTitle = sounding.title;
  await flip(w, 'sth');
  const settled = await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); const ep = slotOf(w, 'ext-evening-prayer'); return mp && ep && mp.state === 'present' && ep.state === 'present' && mp.source === 'Sing the Hours' && ep.source === 'Sing the Hours'; }, 12000);
  await sleep(300);
  const live = O.queueLiveDesc(nextSnap);
  check('L5 ◆ queue built before the flip: the sounding item finishes as it is (same object, URL, title — the mint guard), and the NEXT item re-resolves at advance to the re-settled record (StH title + StH stream stand together)',
    settled && O.state.current === sounding && O.state.queue[0] === sounding && sounding.url === sndUrl && sounding.title === sndTitle
    && !!live && live !== nextSnap && live.title === 'Evening Prayer - Sing the Hours' && live.available === true,
    { settled, sndTitle, live: live && { title: live.title, available: live.available } });
  w.close();
}

// ---------- L8 ◆: the offline completeness pass names the source ----------
// The items carry the shape the pass builds them in
// (offlineEnumerateToday / offlineTomorrowBuild: kind 'ext'
// · date · id = slotId · enclosureUrl · source standing on
// the item's record · key = offlineDayKey). The slots here
// stand UNSETTLED in the client (no settle has run — the
// cold-pass shape): the fetch must follow the item's own
// standing source, never the Worker's re-resolution.
{
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJs, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const O = w.__opn;
  const sthItem = { kind: 'ext', date: CDATE, id: 'ext-morning-prayer', enclosureUrl: STH_MP, source: 'Sing the Hours', key: audioKey('ext-morning-prayer') };
  const resSth = await O.offlineDownloadItemsCache([sthItem], null);
  check('L8 ◆ offline pass, unsettled Morning slot standing under Sing the Hours: the pass-through fetch carries src=Sing the Hours and the audio cache lands the SING THE HOURS bytes under the slot key',
    !!resSth && resSth.have === 1 && resSth.total === 1
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES'
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-morning-prayer') && u.includes('src=Sing%20the%20Hours')),
    { resSth, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  const doItem = { kind: 'ext', date: CDATE, id: 'ext-evening-prayer', enclosureUrl: DO_EP, source: 'Divine Office', download: 'passthrough', key: audioKey('ext-evening-prayer') };
  const resDo = await O.offlineDownloadItemsCache([doItem], null);
  check('L8 ◆ offline pass, Evening slot standing under Divine Office (pass-through route): the fetch carries src=Divine Office and the audio cache lands the DIVINE OFFICE bytes',
    !!resDo && resDo.have === 1 && resDo.total === 1
    && fakeCaches._store.get(audioKey('ext-evening-prayer')) === 'DO-AUDIO-BYTES'
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-evening-prayer') && u.includes('src=Divine%20Office')),
    { resDo, bytes: fakeCaches._store.get(audioKey('ext-evening-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  w.close();
}
{
  // Fail-on-old: the base client (v647 tree) in the SAME
  // cold-pass shape — its pass-through names no source, so
  // the stub's shipped re-resolution (Divine Office first)
  // lands DO bytes in the audio cache under a record that
  // stands Sing the Hours, where a later restore would play
  // them under the StH record.
  LIVE_NOW = LIVE648; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJsOld, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const O = w.__opn;
  const sthItem = { kind: 'ext', date: CDATE, id: 'ext-morning-prayer', enclosureUrl: STH_MP, source: 'Sing the Hours', key: audioKey('ext-morning-prayer') };
  const resOld = await O.offlineDownloadItemsCache([sthItem], null);
  check('L8-old ◆ REPRODUCED on the base client (v647): the cold offline pass for the StH-standing labeled slot lands DIVINE OFFICE bytes in the audio cache (no src on its pass-through fetch)',
    !!resOld && resOld.have === 1
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'DO-AUDIO-BYTES'
    && FETCHLOG.some((u) => u.includes('/api/player/externals/audio') && u.includes('slot=ext-morning-prayer'))
    && !FETCHLOG.some((u) => u.includes('externals/audio') && u.includes('src=')),
    { resOld, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  w.close();
}

// ---------- L9 ◆ (amendment §3.7): the title is the record's own, verbatim ----------
{
  LIVE_NOW = LIVE648_AMD; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const built = await buildDay(w);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  const mpD = descOf(w, 'ext-morning-prayer');
  check('L9 ◆ Sing the Hours chosen: the settled + painted title is the backup record\'s OWN served title verbatim — \'Morning Prayer - Sing the Hours (Lauds)\', never the composed \'Morning Prayer - Sing the Hours\'; the returned backup carries the standing entry\'s own title',
    built && !!mp && mp.state === 'present' && mp.title === 'Morning Prayer - Sing the Hours (Lauds)' && !!mpD && mpD.title === 'Morning Prayer - Sing the Hours (Lauds)'
    && !!mp.backup && mp.backup.title === 'Morning Prayer - Divine Office'
    && !!ep && ep.title === 'Evening Prayer - Sing the Hours (Vespers)',
    { mp: mp && { title: mp.title, backup: mp.backup }, ep: ep && { title: ep.title } });
  w.close();
}
{
  // Fail-on-old: the base client COMPOSES the backup title
  // client-side (slot.title + ' - ' + source) — in the same
  // world it paints the composed string, not the record's
  // own title.
  LIVE_NOW = LIVE648_AMD; FETCHLOG = [];
  const { w } = makeWorld(appJsOld, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const built = await buildDay(w);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('L9-old ◆ REPRODUCED on the base client (v647): the same world paints the COMPOSED title \'Morning Prayer - Sing the Hours\' — the record\'s own title \'(Lauds)\' never stands',
    built && !!mp && mp.state === 'present' && mp.title === 'Morning Prayer - Sing the Hours' && mp.title !== 'Morning Prayer - Sing the Hours (Lauds)',
    { mp: mp && { title: mp.title } });
  w.close();
}

// ---------- L10 ◆ (amendment §3.7): duration travels with the record ----------
{
  LIVE_NOW = LIVE648_AMD; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const built = await buildDay(w);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('L10 ◆ Sing the Hours chosen: the settled record\'s durationSec is the BACKUP record\'s 754 — not the standing Divine Office entry\'s 1091 (the field screenshot\'s 18:11 under an StH title); the returned backup carries the entry\'s 1091',
    built && !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.durationSec === 754
    && !!mp.backup && mp.backup.durationSec === 1091,
    { mp: mp && { source: mp.source, durationSec: mp.durationSec, backup: mp.backup } });
  w.close();
}
{
  LIVE_NOW = LIVE648_AMD; FETCHLOG = [];
  const { w } = makeWorld(appJs, johnStore({ [STH_KEY]: 'off' }));
  await sleep(400);
  const built = await buildDay(w);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('L10 ◆ Divine Office chosen: the settled record\'s durationSec is the entry\'s own 1091, and the backup carries the Sing the Hours record\'s 754 (the day cache the settle writes stores it with the backup)',
    built && !!mp && mp.state === 'present' && mp.source === 'Divine Office' && mp.durationSec === 1091
    && !!mp.backup && mp.backup.durationSec === 754,
    { mp: mp && { source: mp.source, durationSec: mp.durationSec, backup: mp.backup } });
  let cache = null;
  try { cache = JSON.parse(w.localStorage.getItem(EXT_CACHE_KEY) || 'null'); } catch (e) {}
  const cacheMp = cache && cache.slots && cache.slots['ext-morning-prayer'];
  check('L10 ◆ writeCache stores the labeled backup\'s durationSec with its other fields',
    !!cacheMp && !!cacheMp.backup && cacheMp.backup.durationSec === 754 && cacheMp.durationSec === 1091,
    { cacheMp });
  w.close();
}
{
  // Fail-on-old: the base client's settle always takes the
  // ENTRY's durationSec — under the StH choice the record
  // stands 1091, the Divine Office duration under the Sing
  // the Hours title (John's screenshot exactly).
  LIVE_NOW = LIVE648_AMD; FETCHLOG = [];
  const { w } = makeWorld(appJsOld, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const built = await buildDay(w);
  const mp = slotOf(w, 'ext-morning-prayer');
  check('L10-old ◆ REPRODUCED on the base client (v647): the StH-titled record stands durationSec 1091 — the Divine Office entry\'s duration (18:11) under the Sing the Hours title',
    built && !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.durationSec === 1091,
    { mp: mp && { source: mp.source, durationSec: mp.durationSec } });
  w.close();
}

// ---------- L11 ◆ (§4 addendum F1): the backup flip settles the backup record WHOLE ----------
// AMD world, Sing the Hours first, BOTH StH download routes
// fail → extDownload flips to the backup (Divine Office).
// The flipped settle must carry the DO record whole: its
// title · stream · source · logo image · durationSec 1091.
{
  LIVE_NOW = LIVE648_AMD; FETCHLOG = []; FAIL_STH = true;
  const { w, fakeCaches } = makeWorld(appJs, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const built = await buildDay(w);
  await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Divine Office'; }, 12000);
  await sleep(400);
  FAIL_STH = false;
  const mp = slotOf(w, 'ext-morning-prayer');
  check('L11 ◆ both Sing the Hours routes fail: the backup flip settles the DIVINE OFFICE record WHOLE — DO title · DO stream · DO source · DO logo image · durationSec 1091 (never the failed StH side\'s image/duration)',
    built && !!mp && mp.state === 'present' && mp.title === 'Morning Prayer - Divine Office' && mp.source === 'Divine Office'
    && mp.enclosureUrl === DO_MP && mp.imageUrl === DO_IMG && mp.durationSec === 1091
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'DO-AUDIO-BYTES',
    { mp: mp && { title: mp.title, source: mp.source, enclosureUrl: mp.enclosureUrl, imageUrl: mp.imageUrl, durationSec: mp.durationSec }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')) });
  w.close();
}
{
  // Fail-on-old: the PRE-FIX v648 client (4d49fcf) in the
  // SAME world — its flip builds the retry meta with the
  // FAILED side's imageUrl + durationSec (Review §4 probe
  // d): the DO record settles wearing the StH channel image
  // and the StH duration 754.
  LIVE_NOW = LIVE648_AMD; FETCHLOG = []; FAIL_STH = true;
  const { w } = makeWorld(appJsPre, johnStore({ [STH_KEY]: 'on' }));
  await sleep(400);
  const built = await buildDay(w);
  await until(() => { const mp = slotOf(w, 'ext-morning-prayer'); return mp && mp.state === 'present' && mp.source === 'Divine Office'; }, 12000);
  await sleep(400);
  FAIL_STH = false;
  const mp = slotOf(w, 'ext-morning-prayer');
  check('L11-old ◆ REPRODUCED on the pre-fix v648 client (4d49fcf): the flip settles Divine Office title/stream/source over the FAILED Sing the Hours side\'s image + durationSec 754 — Review probe d exactly',
    built && !!mp && mp.state === 'present' && mp.title === 'Morning Prayer - Divine Office' && mp.source === 'Divine Office'
    && mp.enclosureUrl === DO_MP && mp.imageUrl === STH_IMG && mp.durationSec === 754,
    { mp: mp && { title: mp.title, source: mp.source, enclosureUrl: mp.enclosureUrl, imageUrl: mp.imageUrl, durationSec: mp.durationSec } });
  w.close();
}

// ---------- L12 ◆ (§4 addendum F2): a whole cached choice record on a DO-standing day restores untouched ----------
// The seed cache is the client's OWN written whole record
// (the L4 recipe) under the stated choice; the second open
// stands on the AMD world — the day's row stands DIVINE
// OFFICE, the record that plays is the choice's. The cache
// restore must own the slot: no re-download fires and the
// seeded blob stands byte-identical after the pass.
async function writtenCacheStoreChoice(js, live, sthVal) {
  LIVE_NOW = live; FETCHLOG = []; FAIL_STH = false;
  const { w } = makeWorld(js, johnStore({ [STH_KEY]: sthVal }));
  await sleep(400);
  await buildDay(w);
  const store = dumpStore(w);
  w.close();
  return store;
}
{
  const store = await writtenCacheStoreChoice(appJs, LIVE648_AMD, 'on');
  LIVE_NOW = LIVE648_AMD; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJs, store);
  fakeCaches._store.set(audioKey('ext-morning-prayer'), 'CACHED-STH-LAUDS-BYTES');
  fakeCaches._store.set(audioKey('ext-evening-prayer'), 'CACHED-STH-VESPERS-BYTES');
  await sleep(400);
  const built = await buildDay(w);
  await sleep(800);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  check('L12 ◆ whole cached Sing the Hours-choice records on a DIVINE OFFICE-standing day restore UNTOUCHED: no re-download fires for either labeled slot and both cached blobs stand byte-identical after the pass',
    built && !!mp && mp.state === 'present' && mp.source === 'Sing the Hours' && mp.enclosureUrl === STH_MP && mp.title === 'Morning Prayer - Sing the Hours (Lauds)' && mp.imageUrl === STH_IMG
    && !!ep && ep.state === 'present' && ep.source === 'Sing the Hours' && ep.enclosureUrl === STH_EP
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'CACHED-STH-LAUDS-BYTES'
    && fakeCaches._store.get(audioKey('ext-evening-prayer')) === 'CACHED-STH-VESPERS-BYTES'
    && !FETCHLOG.some((u) => u.includes('externals/audio') && (u.includes('slot=ext-morning-prayer') || u.includes('slot=ext-evening-prayer'))),
    { mp: mp && { source: mp.source, enclosureUrl: mp.enclosureUrl, title: mp.title }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  w.close();
}
{
  // Mirror leg: a whole cached DIVINE OFFICE-choice record
  // on the same DO-standing day also restores untouched.
  const store = await writtenCacheStoreChoice(appJs, LIVE648_AMD, 'off');
  LIVE_NOW = LIVE648_AMD; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJs, store);
  fakeCaches._store.set(audioKey('ext-morning-prayer'), 'CACHED-DO-MP-BYTES');
  fakeCaches._store.set(audioKey('ext-evening-prayer'), 'CACHED-DO-EP-BYTES');
  await sleep(400);
  const built = await buildDay(w);
  await sleep(800);
  const mp = slotOf(w, 'ext-morning-prayer'), ep = slotOf(w, 'ext-evening-prayer');
  check('L12 ◆ mirror: whole cached Divine Office-choice records on the same day restore UNTOUCHED — no re-download, both cached blobs byte-identical',
    built && !!mp && mp.state === 'present' && mp.source === 'Divine Office' && mp.enclosureUrl === DO_MP && mp.imageUrl === DO_IMG && mp.durationSec === 1091
    && !!ep && ep.state === 'present' && ep.source === 'Divine Office' && ep.enclosureUrl === DO_EP
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'CACHED-DO-MP-BYTES'
    && fakeCaches._store.get(audioKey('ext-evening-prayer')) === 'CACHED-DO-EP-BYTES'
    && !FETCHLOG.some((u) => u.includes('externals/audio') && (u.includes('slot=ext-morning-prayer') || u.includes('slot=ext-evening-prayer'))),
    { mp: mp && { source: mp.source, enclosureUrl: mp.enclosureUrl }, bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  w.close();
}
{
  // Fail-on-old: the PRE-FIX v648 client (4d49fcf) in the
  // StH-choice world — its courier pointer-confirm compares
  // the cached castos pointer against the RAW served DO
  // entry, never matches, and a re-download replaces the
  // cached blob (Review §4 probes c/g2).
  const store = await writtenCacheStoreChoice(appJsPre, LIVE648_AMD, 'on');
  LIVE_NOW = LIVE648_AMD; FETCHLOG = [];
  const { w, fakeCaches } = makeWorld(appJsPre, store);
  fakeCaches._store.set(audioKey('ext-morning-prayer'), 'CACHED-STH-LAUDS-BYTES');
  fakeCaches._store.set(audioKey('ext-evening-prayer'), 'CACHED-STH-VESPERS-BYTES');
  await sleep(400);
  const built = await buildDay(w);
  await sleep(800);
  check('L12-old ◆ REPRODUCED on the pre-fix v648 client (4d49fcf): the whole cached StH-choice Morning record on the DO-standing day RE-DOWNLOADS — a pass-through fetch (src=Sing the Hours) fires for the slot and the cached blob is replaced',
    built && fakeCaches._store.get(audioKey('ext-morning-prayer')) !== 'CACHED-STH-LAUDS-BYTES'
    && fakeCaches._store.get(audioKey('ext-morning-prayer')) === 'STH-AUDIO-BYTES'
    && FETCHLOG.some((u) => u.includes('externals/audio') && u.includes('slot=ext-morning-prayer') && u.includes('src=Sing%20the%20Hours')),
    { bytes: fakeCaches._store.get(audioKey('ext-morning-prayer')), pt: FETCHLOG.filter((u) => u.includes('externals/audio')) });
  w.close();
}

// ============================================================
// Worker legs — the real Worker bundle against a fake D1
// (harness-v631/v634 machinery). L7 (the pass-through src
// discipline) + W1–W3 (migration 0051's payload + writes).
// ============================================================
function chicagoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const p = {}; for (const x of parts) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
function shift(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
const WTODAY = chicagoToday();
const WTOMORROW = shift(WTODAY, 1);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_A = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function md(date) { const [y, m, d] = date.split('-').map(Number); return { y, m, d, full: MONTHS[m - 1], abbr: MONTHS_A[m - 1] }; }
function rfc(date, hour) { const t = md(date); const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()]; return `${wd}, ${String(t.d).padStart(2, '0')} ${t.abbr} ${t.y} ${String(hour || 12).padStart(2, '0')}:00:00 GMT`; }
function doy(date) { const t = md(date); return Math.floor((Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(t.y, 0, 0)) / 86400000); }
function itemXml({ title, url, pub, dur, len, guid, img }) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate>${guid ? `<guid>${guid}</guid>` : ''}<enclosure url="${url}" length="${len || 1000000}" type="audio/mpeg"/><itunes:duration>${dur || 600}</itunes:duration>${img ? `<itunes:image href="${img}"/>` : ''}</item>`;
}
function feedXml(channelTitle, items, channelImg) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${channelTitle}</title><itunes:image href="${channelImg || 'https://fixture.local/art.jpg'}"/>${items.join('')}</channel></rss>`;
}
const DO_TOKENS = [['ext-invitatory', 'Invitatory'], ['ext-morning-prayer', 'Morning Prayer'], ['ext-midmorning-prayer', 'Midmorning Prayer'], ['ext-midday-prayer', 'Midday Prayer'], ['ext-midafternoon-prayer', 'Midafternoon Prayer'], ['ext-office-of-readings', 'Office of Readings'], ['ext-evening-prayer', 'Evening Prayer'], ['ext-night-prayer', 'Night Prayer']];
function doFeedFor(dates) {
  const items = [];
  for (const date of dates) {
    const t = md(date);
    for (const [, token] of DO_TOKENS) {
      const title = token === 'Invitatory'
        ? `${t.abbr} ${t.d}, Invitatory for Monday of the 34th week of Ordinary Time`
        : `${t.abbr} ${t.d}, ${token} for ${t.full} ${t.d}, ${t.y}`;
      items.push(itemXml({ title, url: `https://divineoffice.org/audio/${date}-${token.replace(/\s+/g, '-').toLowerCase()}.mp3`, pub: rfc(date, 5), dur: 700, guid: `do-${date}-${token}` }));
    }
  }
  return feedXml('Divine Office', items);
}
const DO_HEALTHY = doFeedFor([WTODAY, WTOMORROW]);
const DO_500 = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n<channel>\n\t<title>Divine Office &#8211; Liturgy of the Hours</title>\n<item><title>November 22nd, 2026 &#8211; This Week</title><error>\n    <code>internal_server_error</code>\n    <data><status>500</status></data>\n</error>`;
const REAL_STH_LAUDS = 'https://episodes.castos.com/5fc9b29bee76f8-62659591/2701356/c1e-v8x5iprkmqtqdzp5-9jjvr68msow-jfzv0u.mp3';
const REAL_STH_VESPERS = 'https://episodes.castos.com/5fc9b29bee76f8-62659591/2701368/c1e-xp35ik8vn5ixk7jv-kpp34x91brrd-9ywwco.mp3';
const STH_ITEM_IMG = 'https://fixture.local/sth-lauds-item.jpg';
const STH_CHANNEL_IMG = 'https://fixture.local/sth-channel.jpg';
function sthFeed() {
  const wd = (date) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.UTC(md(date).y, md(date).m - 1, md(date).d)).getUTCDay()];
  const items = [];
  for (const date of [WTODAY, WTOMORROW]) {
    const t = md(date), pre = `${t.m}.${t.d}.${String(t.y).slice(2)}`;
    items.push(itemXml({ title: `Divine Office ${pre} | ${wd(date)} Morning Prayer | Lauds`, url: date === WTODAY ? REAL_STH_LAUDS : `https://episodes.castos.com/sth/${date}-lauds.mp3`, pub: rfc(date, 6), guid: `sth-${date}-lauds`, img: STH_ITEM_IMG }));
    items.push(itemXml({ title: `Divine Office ${pre} | ${wd(date)} Evening Prayer | Vespers`, url: date === WTODAY ? REAL_STH_VESPERS : `https://episodes.castos.com/sth/${date}-vespers.mp3`, pub: rfc(date, 6), guid: `sth-${date}-vespers` }));
  }
  return feedXml('Sing the Hours', items, STH_CHANNEL_IMG);
}
function saintFeed() {
  const t = md(WTODAY), t2 = md(WTOMORROW);
  return feedXml('The Saint of The Day Podcast', [
    itemXml({ title: `${String(t.m).padStart(2, '0')}/${String(t.d).padStart(2, '0')} - Pope St. Clement I`, url: 'https://www.buzzsprout.com/2216056/episodes/13179882-11-23-pope-st-clement-i.mp3', pub: rfc(WTODAY, 8), guid: 'saint-1' }),
    itemXml({ title: `${String(t2.m).padStart(2, '0')}/${String(t2.d).padStart(2, '0')} - St. Andrew Dung-Lac`, url: 'https://www.buzzsprout.com/2216056/episodes/13179884-saint-tomorrow.mp3', pub: rfc(WTOMORROW, 8), guid: 'saint-tomorrow' }),
  ]);
}
function tvMassFeed() {
  const t = md(WTODAY), t2 = md(WTOMORROW);
  const wd = (date) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.UTC(md(date).y, md(date).m - 1, md(date).d)).getUTCDay()];
  return feedXml('Daily TV Mass', [
    itemXml({ title: `Daily TV Mass ${wd(WTODAY)} ${t.full} ${t.d}, ${t.y}`, url: 'https://www.buzzsprout.com/949645/episodes/20158715-daily-tv-mass.mp3', pub: rfc(WTODAY, 5), guid: 'tvmass-1' }),
    itemXml({ title: `Daily TV Mass ${wd(WTOMORROW)} ${t2.full} ${t2.d}, ${t2.y}`, url: 'https://www.buzzsprout.com/949645/episodes/20158716-tvmass-tomorrow.mp3', pub: rfc(WTOMORROW, 5), guid: 'tvmass-tomorrow' }),
  ]);
}
function dgeFeed() {
  return feedXml('Daily Gospel Exegesis', [
    itemXml({ title: 'Monday of Week 34 in Ordinary Time - Luke 21: 1-4', url: 'https://anchor.fm/s/1025ef1c/podcast/play/22726844/exegesis.mp3', pub: rfc(WTODAY, 0), guid: 'dge-1' }),
    itemXml({ title: 'Tuesday of Week 34 in Ordinary Time - Luke 21: 5-11', url: 'https://anchor.fm/s/1025ef1c/podcast/play/22726845/exegesis-tomorrow.mp3', pub: rfc(WTOMORROW, 0), guid: 'dge-tomorrow' }),
  ]);
}
function bibleFeed() {
  const items = [WTODAY, WTOMORROW].map((date) => {
    const n = Math.min(doy(date), 365), t = md(date);
    return itemXml({ title: `Day ${n}: The Readings for Day ${n} (${t.y})`, url: `https://aphid.fireside.fm/d/bible/day-${n}.mp3`, pub: rfc(date, 6), guid: `biy-${date}` });
  });
  return feedXml('Bible in a Year', items);
}
function genericRssFeed(tag) {
  return feedXml(tag, [1, 2].map((i) => itemXml({ title: `${tag} Episode ${i}`, url: `https://fixture.local/${tag}/${i}.mp3`, pub: rfc(WTODAY, 7), guid: `${tag}-guid-${i}` })));
}
function courseFeed() {
  return feedXml('Course', [1, 2, 3].map((i) => itemXml({ title: `Day ${i}: Lesson ${i} (2026)`, url: `https://fixture.local/course/day-${i}.mp3`, pub: rfc(WTODAY, 7), guid: `course-${i}` })));
}
function ownFeed() {
  return feedXml('Ora Pro Nobis', [
    itemXml({ title: 'Novena to Saint Clement Day 1 - November 23, 2026', url: `https://audio.orapronobis.media/${WTODAY}-novena-day-1.mp3`, pub: rfc(WTODAY, 4), guid: 'own-novena-1' }),
    itemXml({ title: 'Morning Prayer', url: `https://audio.orapronobis.media/${WTODAY}-morning-prayer-elevenlabs.mp3`, pub: rfc(WTODAY, 4), guid: 'own-mp' }),
  ]);
}
// ---------- fake D1 (v631 shape, extended for migration 0051) ----------
const SEED_SOURCES = [];
{
  const add = (key, name, slotId, block, sortOrder, role) => SEED_SOURCES.push({ source_key: key, name, family: 'external', block, day_rule: role === 'fallback' ? 'fallback-only' : 'daily', sort_order: sortOrder, enabled: 1, slot_id: slotId, role: role || 'primary' });
  DO_TOKENS.forEach(([slot], i) => add('do-' + slot, 'Divine Office ' + slot, slot, 'Morning', i + 1));
  add('dge', 'Daily Gospel Exegesis', 'ext-gospel-exegesis', 'Midmorning', 1);
  add('biy', 'Bible in a Year', 'ext-bible-in-a-year', 'Morning', 9);
  add('saint', 'Saint of the Day', 'ext-saint-of-the-day', 'Afternoon', 1);
  add('tvmass', 'Daily TV Mass', 'ext-daily-tv-mass', 'Mass and Homilies', 2);
  add('sth-lauds', 'Sing the Hours Lauds', 'ext-morning-prayer', 'Morning', 3, 'fallback');
  add('sth-vespers', 'Sing the Hours Vespers', 'ext-evening-prayer', 'Evening', 3, 'fallback');
}
class FakeDB {
  constructor() { this.resolutions = new Map(); this.feedState = new Map(); this.rss = new Map(); this.seqs = new Map(); }
  prepare(sql) {
    const db = this;
    let args = [];
    const stmt = {
      bind(...a) { args = a; return stmt; },
      async first() {
        if (sql.includes('player_settings_meta')) return { version: 1 };
        if (sql.includes('FROM ext_feed_state')) return db.feedState.get(args[0]) ?? null;
        if (sql.includes('SELECT * FROM ext_resolutions')) { const r = db.resolutions.get(args[0] + '|' + args[1]); return r ?? null; }
        if (sql.includes('SELECT state FROM ext_resolutions')) { const r = db.resolutions.get(args[0] + '|' + args[1]); return r ? { state: r.state } : null; }
        if (sql.includes('SELECT built_at FROM rss_snapshots')) { const r = db.rss.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes('SELECT built_at FROM podcast_sequences')) { const r = db.seqs.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes('SELECT payload FROM rss_snapshots')) { const r = db.rss.get(args[0]); return r ? { payload: r.payload } : null; }
        if (sql.includes('SELECT payload FROM podcast_sequences')) { const r = db.seqs.get(args[0]); return r ? { payload: r.payload } : null; }
        return null;
      },
      async all() {
        if (sql.includes('player_source_settings')) return { results: SEED_SOURCES };
        if (sql.includes('SELECT slot_id, resolved_at FROM ext_resolutions')) return { results: [...db.resolutions.values()].filter((r) => r.date === args[0]).map((r) => ({ slot_id: r.slot_id, resolved_at: r.resolved_at })) };
        if (sql.includes('SELECT * FROM ext_resolutions')) return { results: [...db.resolutions.values()].filter((r) => r.date === args[0]) };
        return { results: [] };
      },
      async run() {
        if (sql.startsWith('INSERT INTO ext_feed_state')) {
          const key = args[0];
          const cur = db.feedState.get(key) || { feed_key: key, last_success_at: null, last_attempt_at: null, last_error: null, last_stamp: null };
          if (args.length === 4) { cur.last_success_at = args[1]; cur.last_attempt_at = args[2]; cur.last_error = null; cur.last_stamp = args[3]; }
          else { cur.last_attempt_at = args[1]; cur.last_error = args[2]; }
          db.feedState.set(key, cur);
          return {};
        }
        if (sql.startsWith('INSERT INTO ext_resolutions')) {
          const [slot_id, date, state, title, stream_url, duration_s, size_bytes, image_url, desc_text, resolved_at, feed_stamp, episode_date, source, backup_url, backup_source, route, backup_image_url, backup_duration_s] = args;
          db.resolutions.set(date + '|' + slot_id, { slot_id, date, state, title, stream_url, duration_s, size_bytes, image_url, desc_text, resolved_at, feed_stamp, episode_date, source, backup_url: backup_url ?? null, backup_source: backup_source ?? null, route: route ?? null, backup_image_url: backup_image_url ?? null, backup_duration_s: backup_duration_s ?? null });
          return {};
        }
        if (sql.startsWith('UPDATE ext_resolutions SET backup_url')) {
          const r = db.resolutions.get(args[4] + '|' + args[5]);
          if (r) { r.backup_url = args[0]; r.backup_source = args[1]; r.backup_image_url = args[2]; r.backup_duration_s = args[3]; }
          return {};
        }
        if (sql.startsWith('DELETE FROM ext_resolutions')) {
          for (const k of [...db.resolutions.keys()]) if (k.split('|')[0] < args[0]) db.resolutions.delete(k);
          return {};
        }
        if (sql.startsWith('INSERT INTO rss_snapshots')) { db.rss.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        if (sql.startsWith('INSERT INTO podcast_sequences')) { db.seqs.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        return {};
      },
    };
    return stmt;
  }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
}
// ---------- worker bundle + fetch stub ----------
const TMP = mkdtempSync(tmpdir() + '/v648-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(APP, 'worker/src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const FEEDS = new Map();
const hdr = (obj) => ({ get: (n) => (obj[String(n).toLowerCase()] ?? null) });
const SYNTH_VERIFIED = new Set();
const SITE_PAGES = new Map();
const DOW3 = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const dowOf = (date) => DOW3[new Date(Date.UTC(...date.split('-').map(Number).map((v, i) => i === 1 ? v - 1 : v))).getUTCDay()];
function synthMpPsalterName(date) { return `divine-ord-w02-${dowOf(date)}-mp.mp3`; }
function siteDayPage(date) {
  const ymd = date.replace(/-/g, ''), dw = dowOf(date);
  const slugs = [`ord-w34-${dw}-or`, `ord-w02-${dw}-mp`, `ord-w02-${dw}-ep`, `ord-w02-${dw}-dp1-comp`, `ord-w02-${dw}-dp2-current`, `ord-w02-${dw}-dp3-comp`, `ord-${dw}-np-w2-w4`, `ip-ord-w02-w04-${dw}-psalm024`];
  return `<html><body>` + slugs.map((sl) => `<a href="https://divineoffice.org/${sl}/?date=${ymd}">post</a>`).join('') + `</body></html>`;
}
function sitePostPage(file, componentOnly) {
  if (componentOnly) return `<html><body><div class="powerpress_player"><audio><source src="https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/divine-ip-ord-w02-w04-mon.psalm024.mp3"></audio></div></body></html>`;
  return `<html><body><div class="powerpress_player"><audio><source src="https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/${file}"></audio></div></body></html>`;
}
function setSiteHealthy() {
  SITE_PAGES.clear();
  for (const date of [WTODAY, WTOMORROW]) {
    const dw = dowOf(date), base = U('site');
    SITE_PAGES.set(`${base}/?date=${date.replace(/-/g, '')}`, siteDayPage(date));
    SITE_PAGES.set(`${base}/ord-w34-${dw}-or/?date=${date.replace(/-/g, '')}`, sitePostPage(`divine-ord-w34-${dw}-or.mp3`));
    SITE_PAGES.set(`${base}/ord-w02-${dw}-mp/?date=${date.replace(/-/g, '')}`, sitePostPage(`divine-ord-w02-${dw}-mp.mp3`));
    SITE_PAGES.set(`${base}/ord-w02-${dw}-ep/?date=${date.replace(/-/g, '')}`, sitePostPage(null, true));
  }
}
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith(U('synth/'))) {
    const name = u.slice(U('synth/').length);
    const good = SYNTH_VERIFIED.has(name);
    if (opts && opts.method === 'HEAD') {
      if (!good) return { ok: false, status: 404, headers: hdr({}), text: async () => '' };
      return { ok: false, status: 302, headers: hdr({ location: `https://cdn.fixture.local/${name}` }), text: async () => '' };
    }
    if (!good) return { ok: false, status: 404, headers: hdr({}), text: async () => '' };
    return { ok: true, status: 206, headers: hdr({ 'content-type': 'audio/mpeg' }), text: async () => '' };
  }
  if (u.startsWith(U('site/')) || u.startsWith(U('site') + '/')) {
    const page = SITE_PAGES.get(u);
    if (page === undefined) return { ok: false, status: 404, headers: hdr({}), text: async () => 'no page fixture' };
    return { ok: true, status: 200, headers: hdr({ 'content-type': 'text/html' }), text: async () => page };
  }
  if (u.startsWith('https://episodes.castos.com/')) return { ok: true, status: 200, headers: hdr({ 'content-type': 'audio/mpeg' }), body: 'STH-AUDIO-BYTES', text: async () => '' };
  if (u.startsWith('https://divineoffice.org/')) return { ok: true, status: 200, headers: hdr({ 'content-type': 'audio/mpeg' }), body: 'DO-AUDIO-BYTES', text: async () => '' };
  const f = FEEDS.get(u);
  if (!f) return { ok: false, status: 404, headers: hdr({}), text: async () => 'no fixture' };
  const r = typeof f === 'function' ? f() : f;
  return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: hdr({}), text: async () => r.body };
};
const U = (k) => 'https://fixture.local/' + k;
function setFeed(key, body, status) { FEEDS.set(U(key), { status: status ?? 200, body }); }
function setAllHealthy() {
  setFeed('do', DO_HEALTHY); setFeed('dge', dgeFeed()); setFeed('biy', bibleFeed());
  setFeed('saint', saintFeed()); setFeed('tvmass', tvMassFeed()); setFeed('sth', sthFeed());
  setFeed('own', ownFeed()); setFeed('course', courseFeed());
  for (const k of ['exorcist', 'counsel', 'frmike', 'barron', 'usccb-readings']) setFeed(k, genericRssFeed(k));
}
function makeEnv(db) {
  return {
    DB: db, AUDIO: { get: async () => null, put: async () => { throw new Error('R2 put must not happen in v648 path'); } },
    AGENT_TOKEN: 'agent-test', LOCAL_DEV: '1',
    EXT_DO_FEED_URL: U('do'), EXT_DGE_FEED_URL: U('dge'), EXT_BIAY_FEED_URL: U('biy'),
    EXT_SYNTH_BASE_URL: U('synth/'), EXT_DO_SITE_BASE_URL: U('site'),
    EXT_SAINT_FEED_URL: U('saint'), EXT_TVMASS_FEED_URL: U('tvmass'), EXT_STH_FEED_URL: U('sth'),
    OWN_FEED_URL: U('own'),
    EXT_EXORCIST_FEED_URL: U('exorcist'), EXT_COUNSEL_TRENT_FEED_URL: U('counsel'),
    EXT_FRMIKE_HOMILIES_FEED_URL: U('frmike'), EXT_BARRON_SERMONS_FEED_URL: U('barron'),
    EXT_DAILY_READINGS_FEED_URL: U('usccb-readings'), EXT_SUMMA_FEED_URL: U('course'),
    EXT_CIY_FEED_URL: U('course'), EXT_RIY_FEED_URL: U('course'),
  };
}
async function agentResolve(env, body) {
  const res = await WORKER.fetch(new Request('https://app.local/api/agent/externals/resolve', { method: 'POST', headers: { authorization: 'Bearer agent-test', 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }), env);
  return res.json();
}
async function live(env, date) {
  const res = await WORKER.fetch(new Request('https://app.local/api/player/externals/live?date=' + (date || WTODAY)), env);
  return res.json();
}
async function audioReq(env, slot, src) {
  const res = await WORKER.fetch(new Request(`https://app.local/api/player/externals/audio?date=${WTODAY}&slot=${slot}` + (src ? `&src=${encodeURIComponent(src)}` : '')), env);
  return { status: res.status, body: await res.text() };
}
const SEED_AT = `${WTODAY}T12:00:00.000Z`;
function seedRow(db, slotId, over) {
  const row = { slot_id: slotId, date: WTODAY, state: 'present', title: null, stream_url: null, duration_s: 0, size_bytes: 0, image_url: null, desc_text: null, resolved_at: SEED_AT, feed_stamp: null, episode_date: WTODAY, source: null, backup_url: null, backup_source: null, route: null, backup_image_url: null, backup_duration_s: null, ...(over || {}) };
  db.resolutions.set(WTODAY + '|' + slotId, row);
  return row;
}
const W_DO_MP = `https://divineoffice.org/audio/${WTODAY}-morning-prayer.mp3`;
const W_STH_IMG = 'https://fixture.local/sth-row-backup-image.jpg';
function seedLabeledRow(db) {
  seedRow(db, 'ext-morning-prayer', { title: 'Morning Prayer - Divine Office', stream_url: W_DO_MP, source: 'Divine Office', route: 'feed', image_url: 'https://fixture.local/do-logo.jpg', duration_s: 1091, backup_url: REAL_STH_LAUDS, backup_source: 'Sing the Hours', backup_image_url: W_STH_IMG, backup_duration_s: 754 });
  return makeEnv(db);
}

// ---------- W1 ◆: the payload's backup carries its image (0051) ----------
{
  setAllHealthy(); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB();
  const env = seedLabeledRow(db);
  const payload = await live(env, WTODAY);
  const mp = (payload.slots || []).find((e) => e.slotId === 'ext-morning-prayer');
  check('W1 ◆ live payload Morning entry: backup whole in the 0051 shape — streamUrl + source + title + imageUrl from backup_image_url',
    !!mp && !!mp.backup && mp.backup.streamUrl === REAL_STH_LAUDS && mp.backup.source === 'Sing the Hours'
    && mp.backup.title === 'Morning Prayer - Sing the Hours' && mp.backup.imageUrl === W_STH_IMG && mp.imageUrl === 'https://fixture.local/do-logo.jpg',
    mp);
}
// ---------- L7 ◆: the pass-through serves the ASKED source ----------
{
  setAllHealthy(); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB();
  const env = seedLabeledRow(db);
  const sth = await audioReq(env, 'ext-morning-prayer', 'Sing the Hours');
  check('L7 ◆ src=Sing the Hours serves the row\'s backup_url (castos bytes), not the re-resolved Divine Office episode',
    sth.status === 200 && sth.body.includes('STH-AUDIO-BYTES'), sth);
  const dor = await audioReq(env, 'ext-morning-prayer', 'Divine Office');
  check('L7 ◆ src=Divine Office serves the row\'s stream_url (Divine Office bytes)',
    dor.status === 200 && dor.body.includes('DO-AUDIO-BYTES'), dor);
  const bogus = await audioReq(env, 'ext-morning-prayer', 'Some Other Source');
  check('L7 ◆ an unmatched src answers 404 — never a silent serve of the other source',
    bogus.status === 404 && !bogus.body.includes('AUDIO-BYTES'), bogus);
  const plain = await audioReq(env, 'ext-morning-prayer', null);
  check('L7 ◆ no src answers exactly as today: the standing feed re-resolution serves the Divine Office episode',
    plain.status === 200 && plain.body.includes('DO-AUDIO-BYTES'), plain);
}
{
  // No src under a Divine Office outage: the v631 fail-soft
  // (StH fallback) stands byte-identical.
  setAllHealthy(); setFeed('do', DO_500, 500); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB();
  const env = seedLabeledRow(db);
  const plain = await audioReq(env, 'ext-morning-prayer', null);
  check('L7 ◆ no src with the DO feed down: the v631 fail-soft stands — the Sing the Hours fallback serves',
    plain.status === 200 && plain.body.includes('STH-AUDIO-BYTES'), plain);
  const asked = await audioReq(env, 'ext-morning-prayer', 'Divine Office');
  check('L7 ◆ src=Divine Office under the same outage still serves the ROW\'s stream_url (the asked source governs, not the feed state)',
    asked.status === 200 && asked.body.includes('DO-AUDIO-BYTES'), asked);
}
// ---------- W2 ◆: the watcher's backup write stands the backup image ----------
{
  setAllHealthy(); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB();
  seedRow(db, 'ext-morning-prayer', { title: 'Morning Prayer - Divine Office', stream_url: W_DO_MP, source: 'Divine Office', route: 'feed' });
  seedRow(db, 'ext-evening-prayer', { title: 'Evening Prayer - Divine Office', stream_url: `https://divineoffice.org/audio/${WTODAY}-evening-prayer.mp3`, source: 'Divine Office', route: 'feed' });
  const env = makeEnv(db);
  await agentResolve(env);
  const mp = db.resolutions.get(WTODAY + '|ext-morning-prayer');
  const ep = db.resolutions.get(WTODAY + '|ext-evening-prayer');
  check('W2 ◆ backup write (Morning): backup_url stands AND backup_image_url is the MATCHED ITEM\'s image',
    !!mp && mp.backup_url === REAL_STH_LAUDS && mp.backup_source === 'Sing the Hours' && mp.backup_image_url === STH_ITEM_IMG,
    mp && { backup_url: mp.backup_url, backup_image_url: mp.backup_image_url });
  check('W2 ◆ backup write (Evening): the matched item carries no image → backup_image_url falls back to the feed\'s CHANNEL image (the fill write\'s fallback)',
    !!ep && ep.backup_url === REAL_STH_VESPERS && ep.backup_image_url === STH_CHANNEL_IMG,
    ep && { backup_url: ep.backup_url, backup_image_url: ep.backup_image_url });
  const payload = await live(env, WTODAY);
  const mpE = (payload.slots || []).find((e) => e.slotId === 'ext-morning-prayer');
  check('W2 ◆ the payload then serves the written backup image (W1 over a watcher-written row)',
    !!mpE && !!mpE.backup && mpE.backup.imageUrl === STH_ITEM_IMG, mpE && mpE.backup);
}
// ---------- W3 ◆: the v634 displacement write carries the displaced image ----------
{
  setAllHealthy(); setFeed('do', DO_500, 500); setSiteHealthy(); SYNTH_VERIFIED.clear(); SYNTH_VERIFIED.add(synthMpPsalterName(WTODAY));
  const db = new FakeDB();
  const fillImg = 'https://fixture.local/sth-fill-image.jpg';
  const fillUrl = `https://episodes.castos.com/sth/${WTODAY}-lauds.mp3`;
  seedRow(db, 'ext-morning-prayer', { title: 'Morning Prayer - Sing the Hours', source: 'Sing the Hours', stream_url: fillUrl, image_url: fillImg, route: null });
  const env = makeEnv(db);
  await agentResolve(env);
  const row = db.resolutions.get(WTODAY + '|ext-morning-prayer');
  check('W3 ◆ synthesis displacement: the row stands Divine Office with the displaced StH pointer as backup — and the displaced fill\'s image as backup_image_url',
    !!row && row.source === 'Divine Office' && row.route === 'synthesis' && row.backup_url === fillUrl && row.backup_source === 'Sing the Hours' && row.backup_image_url === fillImg,
    row && { source: row.source, route: row.route, backup_url: row.backup_url, backup_image_url: row.backup_image_url });
  const payload = await live(env, WTODAY);
  const mpE = (payload.slots || []).find((e) => e.slotId === 'ext-morning-prayer');
  check('W3 ◆ the payload serves the displaced backup with its image',
    !!mpE && !!mpE.backup && mpE.backup.streamUrl === fillUrl && mpE.backup.imageUrl === fillImg, mpE && mpE.backup);
}

// ---------- W4 ◆ (amendment §3.7): the payload's backup carries its duration (0051) ----------
{
  setAllHealthy(); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB();
  const env = seedLabeledRow(db);
  const payload = await live(env, WTODAY);
  const mp = (payload.slots || []).find((e) => e.slotId === 'ext-morning-prayer');
  check('W4 ◆ live payload Morning entry: backup carries durationSec from backup_duration_s (754) while the entry stands its own durationSec (1091, the field screenshot\'s 18:11)',
    !!mp && mp.durationSec === 1091 && !!mp.backup && mp.backup.durationSec === 754,
    mp && { durationSec: mp.durationSec, backup: mp.backup });
}
// ---------- W5 ◆ (amendment §3.7): the watcher's backup write stands the backup duration ----------
{
  setAllHealthy(); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB();
  seedRow(db, 'ext-morning-prayer', { title: 'Morning Prayer - Divine Office', stream_url: W_DO_MP, source: 'Divine Office', route: 'feed' });
  seedRow(db, 'ext-evening-prayer', { title: 'Evening Prayer - Divine Office', stream_url: `https://divineoffice.org/audio/${WTODAY}-evening-prayer.mp3`, source: 'Divine Office', route: 'feed' });
  const env = makeEnv(db);
  await agentResolve(env);
  const mp = db.resolutions.get(WTODAY + '|ext-morning-prayer');
  const ep = db.resolutions.get(WTODAY + '|ext-evening-prayer');
  check('W5 ◆ backup write (Morning): backup_duration_s is the MATCHED ITEM\'s durationS (600, the fixture feed item\'s itunes:duration)',
    !!mp && mp.backup_url === REAL_STH_LAUDS && mp.backup_duration_s === 600,
    mp && { backup_url: mp.backup_url, backup_duration_s: mp.backup_duration_s });
  check('W5 ◆ backup write (Evening): backup_duration_s likewise stands from its matched item',
    !!ep && ep.backup_url === REAL_STH_VESPERS && ep.backup_duration_s === 600,
    ep && { backup_url: ep.backup_url, backup_duration_s: ep.backup_duration_s });
  const payload = await live(env, WTODAY);
  const mpE = (payload.slots || []).find((e) => e.slotId === 'ext-morning-prayer');
  check('W5 ◆ the payload then serves the written backup duration (W4 over a watcher-written row)',
    !!mpE && !!mpE.backup && mpE.backup.durationSec === 600, mpE && mpE.backup);
}
// ---------- W6 ◆ (amendment §3.7): the v634 displacement write carries the displaced duration ----------
{
  setAllHealthy(); setFeed('do', DO_500, 500); setSiteHealthy(); SYNTH_VERIFIED.clear(); SYNTH_VERIFIED.add(synthMpPsalterName(WTODAY));
  const db = new FakeDB();
  const fillImg = 'https://fixture.local/sth-fill-image.jpg';
  const fillUrl = `https://episodes.castos.com/sth/${WTODAY}-lauds.mp3`;
  seedRow(db, 'ext-morning-prayer', { title: 'Morning Prayer - Sing the Hours', source: 'Sing the Hours', stream_url: fillUrl, image_url: fillImg, route: null, duration_s: 754 });
  const env = makeEnv(db);
  await agentResolve(env);
  const row = db.resolutions.get(WTODAY + '|ext-morning-prayer');
  check('W6 ◆ synthesis displacement: the displaced fill\'s duration_s stands as backup_duration_s alongside its image',
    !!row && row.source === 'Divine Office' && row.route === 'synthesis' && row.backup_url === fillUrl && row.backup_duration_s === 754,
    row && { source: row.source, route: row.route, backup_url: row.backup_url, backup_duration_s: row.backup_duration_s });
  const payload = await live(env, WTODAY);
  const mpE = (payload.slots || []).find((e) => e.slotId === 'ext-morning-prayer');
  check('W6 ◆ the payload serves the displaced backup with its duration',
    !!mpE && !!mpE.backup && mpE.backup.streamUrl === fillUrl && mpE.backup.durationSec === 754, mpE && mpE.backup);
}

console.log('\nharness-v648:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
