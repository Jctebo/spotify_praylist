// harness-v551.mjs — v551 evidence: Homily recording,
// LOCAL ONLY (John's approval of the REFACTORED package 52,
// Ora Pro Nobis thread, 2026-11-20 12:18 CT — Space approval
// record 39; run level Stop before Ship).
//   Q1 C: local only — no storage-choice UI, no cloud mode,
//     no upload; the recording lives on the device and the
//     save issues NO network call.
//   Q2 A: the record control stands INSIDE the Mass scroll
//     at the homily's place (after the Liturgy of the Word,
//     before the Universal Prayer).
//   Q3 A: the Homilies list is the FOURTH Catechesis side
//     (Courses · Podcasts · Novenas · Homilies), standing
//     once a homily is recorded, absent before.
//   Q4 A: the full track-act set in the list, delete included.
//   Q5 A: auto-named "Homily — <date>", rename in the list.
//   Q6 A: capture built for a whole homily (5 s chunk flush,
//     no length cap).
//   S statics: the diff against the production base (GitHub
//     main e46593bf — the v552 ship tree) confined to
//     client.ts + ui.ts (styles only; the SW pin unmoved) +
//     the release document + this harness · index.ts
//     byte-identical · migrations end at 0042 (no migration
//     — the Plan's call under Q1 C) · the homily module holds
//     no fetch / api() / PUT / '/api/' (the Q1 C negative,
//     statically) · the four playback seams carry their
//     homily branches (queueLiveDesc · markCompleted ·
//     trackKeyOf · oraSnapshotTrack) · starKeyForDesc returns
//     null for the kind (no server star) · the queue snapshot
//     guard covers 'homilies' · the Mass scroll seats the
//     card after the readings, before the Universal Prayer ·
//     the additions fold joins the local homily rows before
//     its empty check.
//   C client (Chromium, stubbed fetch, the v552/v511 mold;
//     capture legs use the harness's own in-page fake media
//     devices — the Plan's named fixture, no production
//     recording exists):
//     C1 the Mass scroll paints the record card after the
//       readings block and before the Universal Prayer
//     C2 before any recording the Catechesis pill reads
//       three sides (no Homilies)
//     C3 record → stop: the take stands in the device-local
//       index under "Homily — <Mass date>" with its chunks in
//       IndexedDB, and the whole capture issued ZERO fetches
//     C4 after one recording the pill reads four sides,
//       Homilies fourth; the list paints the take
//     C5 list acts: star (index flag; no starred PUT) ·
//       played mark (index flag) · rename (index + row) ·
//       Add to queue (the take joins the queue, nothing
//       starts) · Play (current is the take, audio src is a
//       store-minted blob: URL)
//     C6 Add to Praylist: the picker writes the local store
//       only (the write issues no request; the window's only
//       fetches are the day rebuild's standing settles, none
//       naming the take), the take stands woven at the head
//       of the picked block in state.dayDescs, its block-page
//       card stands and plays, Remove takes it out the same
//       way
//     C7 a take left in 'recording' state at boot finalizes
//       as a partial take in the list (seeded world)
//     C8 queue re-resolution: a stale queue entry naming the
//       take re-resolves through queueLiveDesc to a fresh
//       blob URL; after Delete the entry passes over (null),
//       the row, index entry, chunks, and the day's addition
//       are gone, and the Homilies side retires
// Fixtures (Improvement D): the day payload is the LIVE
// production payload tests/fixtures-v522/day-live-2026-11-17.json
// with its date fields re-seated to the run's Chicago today
// (the additions discipline is today-keyed on both sides —
// the picker writes todayChicago(), the fold reads the
// presented date; production presents today) and its tracks
// re-seated minimal under the production episode ids (the
// v542/v547/v550/v552 mold). The Mass payload + readings
// feed stand in the v511 harness's production shape.
// Run: node app/tests/harness-v551.mjs [--probe] (from the
// worktree root). --probe only prints.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = 'a7742f8';
const gitShow = (p) => execFileSync('git', ['show', BASE + ':' + p], { cwd: ROOT, encoding: 'utf8' });
const B_C = gitShow('app/worker/src/client.ts');
const B_U = gitShow('app/worker/src/ui.ts');

const todayCT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const todayLong = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
const DAY = JSON.parse(readFileSync(APP + '/tests/fixtures-v522/day-live-2026-11-17.json', 'utf8'));
const DAY_TRACKS = {
  Morning: ['ext-invitatory', 'morning-prayer', 'ext-morning-prayer', 'daily-rosary', 'marian-antiphon-angelus'],
  Midday: ['ext-midday-prayer', 'daily-reflection'],
  Evening: ['ext-evening-prayer', 'auxilium-christianorum'],
  Night: ['ext-night-prayer'],
  Novenas: ['novena-clement_i_pope', 'novena-columban_of_luxeuil_abbot', 'novena-st_cecilia'],
  Podcasts: [],
};
const DAYH = JSON.parse(JSON.stringify(DAY));
DAYH.date = todayCT; DAYH.presentedDay = todayCT; DAYH.dateLabel = todayLong;
DAYH.blocks.forEach((b) => {
  b.tracks = (DAY_TRACKS[b.block] || []).map((id) => {
    const t = { episodeId: id, title: id, streamUrl: 'https://example.com/' + id + '.mp3', available: true, durationS: 600 };
    if (id === 'morning-prayer') { t.hasText = true; t.textUrl = 'https://example.com/morning-prayer.txt'; }
    return t;
  });
  b.trackCount = b.tracks.length;
});
const MASS = {
  ok: true, name: 'Friday of the 33rd Week in Ordinary Time', season: 'Ordinary Time',
  defaultVersion: 'feria',
  versions: [{ key: 'feria', label: 'Friday of the 33rd Week', rank: null, formulary: {
    entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
    collect: 'Grant us, Lord our God, that we may honor you with all our mind. Through our Lord Jesus Christ, your Son.',
    prayerOverOfferings: 'Look with favor, O Lord, on the offerings of your people.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Whoever eats this bread will live for ever.', ref: 'Jn 6' },
    prayerAfterCommunion: 'May the working of your mercy, O Lord, guide our hearts.',
  } }],
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15', html: '<p>R. I will seat the victor beside me on my throne.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:45-48', html: '<p>Jesus entered the temple area and proceeded to drive out those who were selling things.</p>' },
] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + String(extra).slice(0, 220) : ''); }
}
function fnBody(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0; const s = src.indexOf('{', i);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return null;
}

/* ---------------- S: statics ---------------- */
{
  const changed = execFileSync('git', ['diff', '--name-only', BASE], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'app/worker/src/ui.ts' || p === 'releases/v551-homily-recording.md' || p.startsWith('app/tests/harness-v551')),
    'S1a: the tracked diff against the production base is confined to client.ts + ui.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v551') || p === 'releases/v551-homily-recording.md'),
    'S1b: the only untracked paths are the harness, its logs, and the release document', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (no server change of any kind)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2b: migration 0042 stands last (no migration — the Plan call under Q1 C)', migs.slice(-2).join(','));
  const pinOf = (s) => { const m = s.match(/ora-pro-nobis-v\d+-\d+/); return m ? m[0] : null; };
  ok(pinOf(U_SRC) === pinOf(B_U), 'S2c: the SW pin in ui.ts is unmoved on the build tree (the pin moves only at Ship)', pinOf(U_SRC) + ' vs ' + pinOf(B_U));
  const uiDiff = execFileSync('git', ['diff', BASE, '--', 'app/worker/src/ui.ts'], { cwd: ROOT, encoding: 'utf8' });
  const uiAdded = uiDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim());
  ok(uiAdded.length > 0 && uiAdded.some((l) => l.includes('.homily-disc')) && uiAdded.every((l) => !/function|=>|addEventListener|var |const /.test(l)),
    'S2d: the ui.ts diff is style rules only (the record card + rename input dress)', uiAdded.slice(0, 3).join(' | '));
  const modStart = C_SRC.indexOf('v551 homily recording (Q1 C');
  const modEnd = C_SRC.indexOf('function openSlotPicker(', modStart);
  const MOD = C_SRC.slice(modStart, modEnd);
  ok(modStart > 0 && modEnd > modStart && !/api\('|api\("|fetch\(|XMLHttpRequest|method:\s*'PUT'|method:\s*"PUT"|['"]\/api\//.test(MOD),
    'S3: the homily module issues no network call of any kind (no api(), no fetch, no PUT, no /api/ path — Q1 C)');
  ok(MOD.includes("indexedDB.open(HOMILY_DB_NAME, 1)") && MOD.includes("'opn-homilies-v551'") && MOD.includes("'opn-homily-add-v551'"),
    'S4a: the store stands as planned — IndexedDB opn-homilies + the localStorage index + the local additions store');
  ok(MOD.includes('recorder.start(5000)') && !/setTimeout\([^)]*stop|maxDuration|sizeLimit/.test(fnBody(C_SRC, 'homilyStartRecord') || ''),
    'S4b: capture flushes in 5 s chunks with no length or size cap (Q6 A — built for a whole homily)');
  const pms = fnBody(C_SRC, 'paintMassScroll') || '';
  const iRead = pms.indexOf('massReadingsHtml()');
  const iCard = pms.indexOf('massHomilyCardHtml()');
  const iUniv = pms.indexOf('mass-universal-section');
  ok(iRead > 0 && iCard > iRead && iUniv > iCard,
    'S5: paintMassScroll seats the record card after the readings block and before the Universal Prayer section (Q2 A)');
  const tsc = fnBody(C_SRC, 'tabSideCfg') || '';
  ok(tsc.includes("podSides.push(['homilies', 'Homilies'])") && tsc.includes('homilyIndexHas()'),
    'S6a: the fourth Catechesis side stands only when a recording stands (Q3 A)');
  ok((fnBody(C_SRC, 'paintPodcastsIndex') || '').includes("tabSideNow.podcasts === 'homilies'") && (fnBody(C_SRC, 'paintPodcastsIndex') || '').includes('paintCatechesisHomilies()'),
    'S6b: paintPodcastsIndex dispatches the homilies side to its own paint');
  ok((fnBody(C_SRC, 'queueLiveDesc') || '').includes("d.kind === 'homily'") && (fnBody(C_SRC, 'queueLiveDesc') || '').includes('homilyLiveDesc(d)'),
    'S7a: queueLiveDesc re-resolves a homily against the device-local store (P7.1)');
  ok((fnBody(C_SRC, 'markCompleted') || '').includes("desc.kind === 'homily'") && (fnBody(C_SRC, 'markCompleted') || '').includes('homilySetPlayed'),
    'S7b: markCompleted writes a homily completion to the index flag only (P7.2)');
  ok((fnBody(C_SRC, 'trackKeyOf') || '').includes("t.kind === 'homily'"),
    'S7c: trackKeyOf returns null for a homily — no intention draw (P7.3)');
  ok((fnBody(C_SRC, 'oraSnapshotTrack') || '').includes("d.kind === 'homily'"),
    'S7d: oraSnapshotTrack excludes homilies from the native snapshot (P7.4)');
  ok((fnBody(C_SRC, 'starKeyForDesc') || '').includes("desc.kind === 'homily'"),
    'S8a: starKeyForDesc returns null for a homily — the server starred store never sees one (P8)');
  ok((fnBody(C_SRC, 'saveQueueSnapshot') || '').includes("state.queueFrom === 'homilies'"),
    'S8b: a homily-born queue is session-only, never snapshotted (the starred guard extended)');
  const fold = fnBody(C_SRC, 'foldDayAdditions') || '';
  ok(fold.indexOf('homilyAdditionsFor(dateStr)') > 0 && fold.indexOf('homilyAdditionsFor(dateStr)') < fold.indexOf('Object.keys(byBlock).length'),
    'S9a: the additions fold joins the local homily rows BEFORE its empty check (P10)');
  ok((fnBody(C_SRC, 'dayAdditionDesc') || '').includes("a.kind === 'homily'") && (fnBody(C_SRC, 'openAdditionMenu') || '').includes('removeHomilyAddition'),
    'S9b: the homily addition branch stands in dayAdditionDesc and its removal is local (P10)');
  const menu = fnBody(C_SRC, 'openHomilyMenu') || '';
  ok(['Play', 'Add to queue', 'Add to Praylist', 'Mark played', 'Rename', 'Delete'].every((l) => menu.includes("'" + l + "'") || menu.includes(l)),
    'S10: the Homilies row menu carries the full act set — Play · Add to queue · Add to Praylist · Mark played · Rename · Delete (Q4 A)');
}

/* ---------------- the page mold ---------------- */
let COOKED = null;
try {
  const t = C_SRC.indexOf('APP_JS = `') + 10;
  COOKED = new Function('return `' + C_SRC.slice(t, C_SRC.indexOf('`;', t)) + '`')();
  ok(true, 'P0: the cooked APP_JS parses (the template-literal gate)');
} catch (e) { ok(false, 'P0: the cooked APP_JS parses (the template-literal gate)', String(e).slice(0, 160)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

function buildPage() {
  const stub = `
window.__fetchLog = [];
window.__puts = [];
window.__starredStore = [];
window.fetch = function (path, opts) {
  var p = String(path);
  var logEntry = { path: p, method: (opts && opts.method) || 'GET' };
  if (p.indexOf('/api/player/track-draws') === 0 && opts && opts.body) { try { logEntry.keys = JSON.parse(opts.body).keys || []; } catch (e) {} }
  window.__fetchLog.push(logEntry);
  function ans(status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); }, text: function () { return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)); } }); }
  if (p.indexOf('/api/prayer/starred') === 0) {
    if (opts && opts.method === 'PUT') { var body = JSON.parse(opts.body); window.__puts.push(body.starred); window.__starredStore = body.starred; return ans(200, { ok: true, starred: window.__starredStore }); }
    return ans(200, { ok: true, starred: window.__starredStore });
  }
  if (p.indexOf('/api/player/podcasts/mark') === 0 || p.indexOf('/api/player/podcasts/unmark') === 0) return ans(200, { ok: true });
  if (p.indexOf('/api/prayer/book/favorites') === 0) return ans(200, { ok: true, favorites: [] });
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, { ok: true, groups: [] });
  if (p.indexOf('/api/player/track-draws') === 0) {
    var db = JSON.parse(opts.body); var draws = {};
    (db.keys || []).forEach(function (k) { if (k.indexOf('intro:') !== 0 && k.indexOf('seg:') !== 0) draws[k] = { intentionId: 1, text: 'For the harness intention pool' }; });
    return ans(200, { ok: true, date: db.date, draws: draws });
  }
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAYH)});
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(MASS)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/player/source-settings') === 0) return ans(200, { ok: true, version: 1, sources: [] });
  if (p.indexOf('/api/player/podcasts?series=') === 0) return ans(200, { ok: true, available: true, series: 'other', kind: 'rss', title: 'Other', entries: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
  return ans(200, { ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
window.HTMLMediaElement.prototype.play = function () { this.__playing = true; this.__ended = false; var el = this; Promise.resolve().then(function () { try { el.dispatchEvent(new Event('play')); } catch (e) {} }); return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () { this.__playing = false; };
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', { configurable: true, get: function () { return !this.__playing; } }); } catch (e) {}
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'ended', { configurable: true, get: function () { return !!this.__ended; } }); } catch (e) {}
/* The Plan's capture fixture: the harness's own in-page fake
   media devices (no production recording exists to fixture).
   A spec-shaped MediaRecorder: start(timeslice) emits a
   chunk per slice; stop() emits the final chunk, then stop. */
try {
  var fakeStream = { getTracks: function () { return [{ stop: function () {} }]; } };
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = function () { return Promise.resolve(fakeStream); };
  window.MediaRecorder = function (stream, opts) { this.mimeType = (opts && opts.mimeType) || 'audio/webm'; this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; };
  window.MediaRecorder.isTypeSupported = function (t) { return String(t).indexOf('audio/webm') === 0; };
  window.MediaRecorder.prototype.start = function (timeslice) { this.state = 'recording'; var self = this; this.__iv = setInterval(function () { if (self.ondataavailable) self.ondataavailable({ data: new Blob(['fake-audio-chunk'], { type: self.mimeType }) }); }, Math.max(50, Math.min(timeslice || 5000, 200))); };
  window.MediaRecorder.prototype.stop = function () { if (this.state === 'inactive') return; this.state = 'inactive'; clearInterval(this.__iv); if (this.ondataavailable) this.ondataavailable({ data: new Blob(['fake-audio-final'], { type: this.mimeType }) }); if (this.onstop) this.onstop(); };
} catch (e) {}
`;
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<style>' + APP_CSS + '</style></head>'
    + '<body>' + SHELL
    + '<script>' + stub.replace(/<\/script>/g, '<\\/script>') + '<\/script>'
    + '<script>' + COOKED.replace(/<\/script>/g, '<\\/script>') + '<\/script></body></html>';
}

const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const PAGE_HTML = buildPage();
const srv = http.createServer((req, res) => {
  if ((req.url || '/').split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE_HTML); }
  else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + srv.address().port;

async function boot(errs, tag, seed) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
  if (seed) await ctx.addInitScript(seed);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + '/');
  await sleep(300);
  await page.click('[data-tab="prayers"]');
  await page.waitForFunction(() => window.state && state.dayDescs && state.dayDescs.length >= 8, null, { timeout: 25000 }).catch(() => console.log('note -', tag, 'day build slow'));
  await sleep(600);
  return { ctx, page };
}
async function pillLabels(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#sidetoggle [data-side]')).map((b) => b.textContent.trim()));
}
async function clickSide(page, side) {
  await page.evaluate((s) => { const b = document.querySelector('#sidetoggle [data-side="' + s + '"]'); if (b) b.click(); }, side);
  await sleep(500);
}
async function menuLabels(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.anchmenu [data-menuitem]')).map((b) => b.textContent.trim()));
}
async function clickMenuItem(page, label) {
  await page.evaluate((l) => {
    const b = Array.from(document.querySelectorAll('.anchmenu [data-menuitem]')).find((x) => x.textContent.trim() === l);
    if (b) b.click();
  }, label);
  await sleep(400);
}

/* ---------------- MAIN world: C1–C6, C8 ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'main');
  ok(errs.length === 0, 'MAIN0: boot clean — no page errors', errs.join(' · '));

  // C2: no recording yet — the pill reads three sides.
  await page.click('[data-tab="podcasts"]');
  await sleep(600);
  const pill0 = await pillLabels(page);
  ok(JSON.stringify(pill0) === JSON.stringify(['Courses', 'Podcasts', 'Novenas']),
    'C2: before any recording the Catechesis pill reads three sides — no Homilies side stands', pill0.join(' · '));

  // C1: the record card's seat in the Mass scroll.
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note - mass scroll slow'));
  await page.waitForSelector('#mass-homily-rec', { timeout: 15000 }).catch(() => console.log('note - record card slow'));
  await page.waitForSelector('#mass-universal-section', { timeout: 15000 }).catch(() => console.log('note - universal section slow'));
  await sleep(800);
  const seat = await page.evaluate(() => {
    const r = document.getElementById('mass-readings');
    const h = document.getElementById('mass-homily-host');
    const u = document.getElementById('mass-universal-section');
    if (!r || !h || !u) return { found: false };
    const F = Node.DOCUMENT_POSITION_FOLLOWING;
    return { found: true, afterReadings: !!(r.compareDocumentPosition(h) & F), beforeUniversal: !!(h.compareDocumentPosition(u) & F), inScroll: !!h.closest('.mass-scroll') };
  });
  ok(seat.found && seat.afterReadings && seat.beforeUniversal && seat.inScroll,
    'C1: the record card stands in the Mass scroll after the readings block and before the Universal Prayer section (Q2 A)', JSON.stringify(seat));

  // C3: record → stop — on-device save, auto-name, zero fetches.
  const fetchBefore = await page.evaluate(() => window.__fetchLog.length);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - recording state slow'));
  const recState = await page.evaluate(() => !!document.getElementById('mass-homily-stop'));
  ok(recState, 'C3a: the card stands in its recording state after the record tap (mockup M2)');
  await sleep(1300);
  await page.click('#mass-homily-stop');
  await page.waitForFunction(() => {
    try { const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); return idx.length === 1 && idx[0].state === 'ready'; } catch (e) { return false; }
  }, null, { timeout: 10000 }).catch(() => console.log('note - take save slow'));
  const take = await page.evaluate(async () => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    const e = idx[0] || {};
    const chunks = e.id ? await homilyChunks(e.id) : [];
    return { name: e.name, expected: 'Homily \u2014 ' + homilyLongDate(state.mass.date), state: e.state, chunkCount: e.chunkCount, idbChunks: chunks.length, sizeBytes: e.sizeBytes, id: e.id, starred: e.starred, played: e.played };
  });
  ok(take.state === 'ready' && take.name === take.expected,
    'C3b: the take saves on-device under the auto-name "Homily — <Mass date>" (Q5 A)', take.name + ' vs ' + take.expected);
  ok(take.chunkCount >= 1 && take.idbChunks >= 1 && take.sizeBytes > 0,
    'C3c: the take audio stands in IndexedDB chunks on the device', 'chunks ' + take.chunkCount + '/' + take.idbChunks + ' · bytes ' + take.sizeBytes);
  const fetchAfter = await page.evaluate(() => window.__fetchLog.length);
  ok(fetchAfter === fetchBefore, 'C3d: the whole capture + save issued ZERO network requests (Q1 C)', 'fetches ' + fetchBefore + ' → ' + fetchAfter);
  const HID = take.id;

  // C4: the fourth side stands; the list paints the take.
  await page.click('[data-tab="podcasts"]');
  await sleep(600);
  const pill1 = await pillLabels(page);
  ok(JSON.stringify(pill1) === JSON.stringify(['Courses', 'Podcasts', 'Novenas', 'Homilies']),
    'C4a: after one recording the pill reads four sides — Homilies fourth (Q3 A)', pill1.join(' · '));
  await clickSide(page, 'homilies');
  const row = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    return r ? { title: (r.querySelector('.ttl') || {}).textContent || '', meta: (r.querySelector('.meta') || {}).textContent || '' } : null;
  }, HID);
  ok(!!row && row.title === take.name, 'C4b: the Homilies list paints the take under its name', row ? row.title : 'no row');

  // C5: the list acts.
  await page.click('[data-homilystar="' + HID + '"]');
  await sleep(300);
  const star = await page.evaluate((id) => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    return { starred: (idx[0] || {}).starred, puts: window.__puts.length };
  }, HID);
  ok(star.starred === true && star.puts === 0, 'C5a: the row star sets the device-local flag and issues NO starred PUT (P8)', JSON.stringify(star));
  await page.click('[data-homilymark="' + HID + '"]');
  await sleep(300);
  const mark = await page.evaluate(() => (JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]')[0] || {}).played);
  ok(mark === true, 'C5b: the row played mark sets the device-local flag (P7.2)');
  await page.click('[data-homilymenu="' + HID + '"]');
  await sleep(400);
  const labels = await menuLabels(page);
  ok(['Play', 'Add to queue', 'Add to Praylist', 'Mark unplayed', 'Rename', 'Delete'].every((l) => labels.includes(l)),
    'C5c: the row menu carries the full act set (Q4 A)', labels.join(' · '));
  await clickMenuItem(page, 'Rename');
  await page.waitForSelector('#homily-rename-field', { timeout: 8000 }).catch(() => console.log('note - rename sheet slow'));
  await page.evaluate(() => { const f = document.getElementById('homily-rename-field'); if (f) f.value = 'Homily — Renamed by harness'; });
  await page.click('[data-ren-save]');
  await sleep(400);
  const renamed = await page.evaluate((id) => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    const r = document.querySelector('[data-homilyid="' + id + '"] .ttl');
    return { index: (idx[0] || {}).name, row: r ? r.textContent : null };
  }, HID);
  ok(renamed.index === 'Homily — Renamed by harness' && renamed.row === 'Homily — Renamed by harness',
    'C5d: Rename rewrites the take name in the index and on the row (Q5 A)', renamed.index);
  await page.click('[data-homilymenu="' + HID + '"]');
  await sleep(400);
  await clickMenuItem(page, 'Add to queue');
  await sleep(700);
  const queued = await page.evaluate((id) => ({ q: state.queue.map((d) => d.episodeId), current: state.current ? state.current.episodeId : null }), HID);
  ok(queued.q.includes('homily:' + HID) && queued.current !== 'homily:' + HID,
    'C5e: Add to queue appends the take to the standing queue and starts nothing', queued.q.join(','));
  await page.click('[data-homilyplay="' + HID + '"]');
  await sleep(900);
  const playing = await page.evaluate(() => ({ current: state.current ? state.current.episodeId : null, src: (window.audioEl && audioEl.src) || '', from: state.queueFrom }));
  ok(playing.current === 'homily:' + HID && playing.src.indexOf('blob:') === 0 && playing.from === 'homilies',
    'C5f: Play from the list makes the take current, playing from a store-minted blob: URL, queue provenance homilies', JSON.stringify(playing));

  // C6: Add to Praylist — local write only, woven card, local Remove.
  await page.evaluate(() => { if (window.audioEl) audioEl.pause(); });
  await page.click('[data-homilymenu="' + HID + '"]');
  await sleep(400);
  const fetchP0 = await page.evaluate(() => window.__fetchLog.length);
  await clickMenuItem(page, 'Add to Praylist');
  await page.waitForSelector('[data-slotblock]', { timeout: 8000 }).catch(() => console.log('note - picker slow'));
  await page.click('[data-slotblock="Morning"]');
  await sleep(400);
  await page.click('[data-slotpos=""]');
  await sleep(600);
  const added = await page.evaluate((id) => {
    const rows = JSON.parse(localStorage.getItem('opn-homily-add-v551') || '[]');
    const morning = (state.dayDescs || []).filter((d) => d.block === 'Morning');
    return { rows: rows, firstMorning: morning.length ? morning[0].episodeId : null, woven: morning.some((d) => d.episodeId === 'homily:' + id && d.dayAddition) };
  }, HID);
  ok(added.rows.length === 1 && added.rows[0].block === 'Morning' && added.rows[0].homilyId === HID && added.rows[0].afterId === '',
    'C6a: the picker wrote ONE device-local addition row (block + anchor), nothing else', JSON.stringify(added.rows));
  ok(added.woven && added.firstMorning === 'homily:' + HID,
    'C6b: the take stands woven at the head of the Morning block in the folded day');
  const fetchP1 = await page.evaluate(() => window.__fetchLog.length);
  const deltaC = await page.evaluate((n) => window.__fetchLog.slice(n), fetchP0);
  ok(deltaC.every((f) => (f.method === 'GET' && f.path.indexOf('/api/prayer/starred') === 0) || (f.path.indexOf('/api/player/track-draws') === 0 && !(f.keys || []).some((k) => k.indexOf('homily:') === 0))),
    'C6c: the Add to Praylist write itself issued NO request — the only fetches in the window are the day rebuild\u2019s standing settles (starred GET · track-draws for day keys, no homily key among them) (Q1 C)', JSON.stringify(deltaC));
  await page.click('[data-tab="prayers"]');
  await sleep(500);
  await page.click('[data-openblock="Morning"]');
  await sleep(700);
  const card = await page.evaluate((id) => !!document.querySelector('[data-card="homily:' + id + '"]'), HID);
  ok(card, 'C6d: the take card stands on the Morning block page at its woven place');
  const fetchP2 = await page.evaluate(() => window.__fetchLog.length);
  await page.evaluate((id) => { const b = document.querySelector('[data-card="homily:' + id + '"] [data-addmenu]'); if (b) b.click(); }, HID);
  await sleep(400);
  await clickMenuItem(page, 'Remove from Praylist');
  await sleep(600);
  const removed = await page.evaluate((id) => ({
    rows: JSON.parse(localStorage.getItem('opn-homily-add-v551') || '[]').length,
    card: !!document.querySelector('[data-card="homily:' + id + '"]'),
    woven: (state.dayDescs || []).some((d) => d.episodeId === 'homily:' + id),
  }), HID);
  const fetchP3 = await page.evaluate(() => window.__fetchLog.length);
  const deltaR = await page.evaluate((n) => window.__fetchLog.slice(n), fetchP2);
  ok(removed.rows === 0 && !removed.card && !removed.woven && deltaR.every((f) => (f.method === 'GET' && f.path.indexOf('/api/prayer/starred') === 0) || (f.path.indexOf('/api/player/track-draws') === 0 && !(f.keys || []).some((k) => k.indexOf('homily:') === 0))),
    'C6e: Remove takes the take out of the day — local store, card, and fold — and the removal write itself issued NO request (only the rebuild\u2019s standing settles ran)', JSON.stringify(removed) + ' · ' + JSON.stringify(deltaR));

  // C8: queue re-resolution, then Delete retires everything.
  const reres = await page.evaluate(async (id) => {
    const stale = { episodeId: 'homily:' + id, kind: 'homily', homilyId: id, block: 'Homilies', url: 'blob:stale', available: true, title: 'stale' };
    homilyUrlCache = {};
    const cold = queueLiveDesc(stale);
    await new Promise((r) => setTimeout(r, 700));
    const live = queueLiveDesc(stale);
    return { cold: cold, url: live ? live.url : null, title: live ? live.title : null };
  }, HID);
  ok(!!reres.url && reres.url.indexOf('blob:') === 0 && reres.url !== 'blob:stale' && reres.title === 'Homily — Renamed by harness',
    'C8a: a stale queue entry re-resolves through queueLiveDesc to a fresh store-minted blob URL once the settle stands (the cold call kicks the mint and passes over, the externals discipline) (P7.1)', String(reres.url).slice(0, 40));
  await page.click('[data-tab="podcasts"]');
  await sleep(500);
  await clickSide(page, 'homilies');
  await page.click('[data-homilymenu="' + HID + '"]');
  await sleep(400);
  await clickMenuItem(page, 'Delete');
  await page.waitForSelector('[data-cfgo]', { timeout: 8000 }).catch(() => console.log('note - confirm slow'));
  await page.click('[data-cfgo]');
  await sleep(700);
  const gone = await page.evaluate(async (id) => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    const chunks = await homilyChunks(id);
    const stale = { episodeId: 'homily:' + id, kind: 'homily', homilyId: id, block: 'Homilies', url: 'blob:stale', available: true };
    return { idx: idx.length, chunks: chunks.length, live: queueLiveDesc(stale), row: !!document.querySelector('[data-homilyid="' + id + '"]') };
  }, HID);
  ok(gone.idx === 0 && gone.chunks === 0 && gone.live === null && !gone.row,
    'C8b: Delete removes the row, the index entry, and the IndexedDB chunks; a queue entry naming it passes over (null)', JSON.stringify({ idx: gone.idx, chunks: gone.chunks, live: gone.live }));
  const pill2 = await pillLabels(page);
  ok(JSON.stringify(pill2) === JSON.stringify(['Courses', 'Podcasts', 'Novenas']),
    'C8c: with the list emptied the Homilies side retires — the pill reads three sides again', pill2.join(' · '));
  ok(errs.length === 0, 'MAIN1: no page errors across the whole main world', errs.join(' · '));
  await ctx.close();
}

/* ---------------- PARTIAL world: C7 ---------------- */
{
  const errs = [];
  const seed = () => {
    localStorage.setItem('opn-homilies-v551', JSON.stringify([{
      id: 'hpartial1', name: 'Homily \u2014 Wednesday, November 18, 2026', dateKey: '2026-11-18', dayName: '',
      createdAt: '2026-11-18T13:00:00.000Z', durationS: 754, sizeBytes: 123456, mimeType: 'audio/webm',
      starred: false, played: false, state: 'recording', chunkCount: 3, partial: false,
    }]));
  };
  const { ctx, page } = await boot(errs, 'partial', seed);
  await page.click('[data-tab="podcasts"]');
  await sleep(600);
  const pill = await pillLabels(page);
  ok(pill.includes('Homilies'), 'C7a: a take left mid-recording still stands the Homilies side at boot', pill.join(' · '));
  await clickSide(page, 'homilies');
  const prow = await page.evaluate(() => {
    const r = document.querySelector('[data-homilyid="hpartial1"]');
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    return { row: !!r, meta: r ? (r.querySelector('.meta') || {}).textContent || '' : '', state: (idx[0] || {}).state, partial: (idx[0] || {}).partial };
  });
  ok(prow.row && prow.state === 'ready' && prow.partial === true && prow.meta.includes('partial take'),
    'C7b: the interrupted take finalizes at boot as a partial take and stands in the list (P4)', JSON.stringify(prow));
  ok(errs.length === 0, 'C7c: no page errors in the partial world', errs.join(' · '));
  await ctx.close();
}

console.log('---');
console.log('harness-v551: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); failures.forEach((f) => console.log('  - ' + f)); }
srv.close();
await browser.close();
process.exit(fail ? 1 : 0);
