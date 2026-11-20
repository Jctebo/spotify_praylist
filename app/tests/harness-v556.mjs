// harness-v556.mjs — v556 evidence: blob-sourced playback
// starts resolve — homily playback + AI Signal today's
// entry (production-defect fix-forward, To Ship; John's
// approval, Ora Pro Nobis thread, 2026-11-20 13:25 CT,
// verbatim: "Approve all fix it"; intakes 1057 + 1058).
// The diagnosis (the scope record): on the one-engine
// shell a start must resolve through the native contract;
// both failing surfaces are starts whose playable source
// is a WebView-local blob URL, which the contract cannot
// carry — the homily by oraSnapshotTrack's by-design
// exclusion (v551 P7.4) meeting nativeResolveStart's
// missing homily arm ("Couldn't play — unresolved-start"),
// today's AI Signal entry by podOwnDesc carrying no
// enclosureUrl under the aiSettleSwap blob swap (the
// snapshot fallback synthesis keyed the Range route on
// the composite entry key — not a store id — and 404'd).
//   P1 homily: a homily arm at the head of
//     nativeResolveStart runs the standing elementStartTail
//     in every pair (the route shape was rejected at Plan:
//     under Q1 C Local only the take never leaves the
//     device, and the native engine fetches outside the
//     page — no contract-carried address can exist).
//   P2 AI Signal: podOwnDesc sets enclosureUrl =
//     e.streamUrl (the v475 discipline: enclosureUrl
//     stands first; a minted blob url never crosses).
//   S statics: the diff against the production base
//     (GitHub main 8b4177e — the v551 ship tree) confined
//     to client.ts + the release document + this harness ·
//     index.ts byte-identical · ui.ts byte-identical (the
//     SW pin unmoved on the build tree) · migrations end
//     at 0042 · the homily arm stands in nativeResolveStart
//     running elementStartTail · podOwnDesc carries
//     enclosureUrl from the entry's streamUrl ·
//     oraSnapshotTrack · nativeContractItem ·
//     nativeStartFailed · refuseNativeStart ·
//     homilyDescFor byte-identical to the base (fnBody
//     compare — the fix lands at the two named seats only).
//   C client (Chromium, stubbed fetch, the v551 mold;
//     the one-engine worlds stub the OraDayBridge plugin
//     with the shell's standing capability shape — an
//     oneEngine method, setNativeQueue captured,
//     nativeTransport standing — so oraNativeMode() and
//     oraOneEngineMode() both read true, exactly the
//     APK 1.0.46 pair John field-tested):
//     A1 (one-engine) record a take on the fake devices
//       (the v551 fixture rule — no production recording
//       exists) — the take stands ready on-device
//     A2 (one-engine) Play on the take: the element's src
//       is the store-minted blob: URL, the take is
//       current, NO contract was sent for it, and
//       state.nativeRefusal stands null — no
//       "unresolved-start"
//     B1 (one-engine) the AI Signal series page stands
//       with the swap minted from the seeded device-local
//       copy (Trigger A at the paint)
//     B2 (one-engine) tap today's entry: its descriptor
//       carries the blob url AND enclosureUrl = its
//       streamUrl; the captured contract's start item
//       mediaUri is <origin>/api/player/audio/<today>/
//       the-ai-signal — the store-id Range address, never
//       the composite-key synthesis; no refusal stands
//     B3 (one-engine) tap an older entry (no swap): url
//       and enclosureUrl both read its streamUrl and the
//       contract item is byte-identical to the pre-fix
//       form (origin + streamUrl)
//     B4 (one-engine) a day track start carries its
//       standing contract form (mediaUri = its stream
//       address, kind episode)
//     B5 (one-engine) an RSS podcast start carries its
//       standing contract form (kind podcast, mediaUri =
//       the entry's enclosure url)
//     C1 (browser pair) a homily start plays as it did
//       at v551 (element src is the minted blob: URL)
//     C2 (browser pair, no bridge) today's AI Signal
//       entry with the swap standing still plays the
//       device-local blob through the element (desc.url
//       untouched by the fix)
// Fixtures (Improvement D): the own payload carries the
// exact podOwnEntries shape read from index.ts at the
// base ({key: 'the-ai-signal-<date>', date, label,
// title, streamUrl: '/api/player/audio/<date>/
// the-ai-signal', durationS, sizeBytes}); today's entry
// carries the production record's own values (2026-11-20
// · durationS 495 · sizeBytes 3965605 — the diagnosis
// verified them against the store and the R2 object),
// and the seeded Cache API copy is exactly that many
// bytes, so aiSettleSwap's byte-equality settle passes
// as it does on John's phone. The older entry stands in
// the same shape (its duration/size are the harness's
// own — the leg proves form, not that episode's facts).
// The day payload is the LIVE production payload
// tests/fixtures-v522/day-live-2026-11-17.json re-seated
// to the run's Chicago today with minimal track records
// under the production episode ids (the v551 mold). The
// Mass payload + readings feed stand in the v511 shape.
// Run: node app/tests/harness-v556.mjs [--probe] (from
// the worktree root). --probe only prints.
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
const BASE = '8b4177e';
const gitShow = (p) => execFileSync('git', ['show', BASE + ':' + p], { cwd: ROOT, encoding: 'utf8' });
const B_C = gitShow('app/worker/src/client.ts');
const B_U = gitShow('app/worker/src/ui.ts');

const todayCT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const todayLong = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dLabel = (ds) => { const [y, m, d] = ds.split('-').map(Number); return MON[m - 1] + ' ' + d + ', ' + y; };
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
const OWN = {
  ok: true, kind: 'own', series: 'the-ai-signal', title: 'The AI Signal', available: true,
  currentKey: 'the-ai-signal-' + todayCT, currentLabel: dLabel(todayCT), showImageUrl: '/logo.png', showDesc: null,
  entries: [
    { key: 'the-ai-signal-' + todayCT, date: todayCT, label: dLabel(todayCT), title: 'The AI Signal — ' + todayCT, streamUrl: '/api/player/audio/' + todayCT + '/the-ai-signal', durationS: 495, sizeBytes: 3965605 },
    { key: 'the-ai-signal-2026-11-19', date: '2026-11-19', label: 'Nov 19, 2026', title: 'The AI Signal — 2026-11-19', streamUrl: '/api/player/audio/2026-11-19/the-ai-signal', durationS: 480, sizeBytes: 3900000 },
  ],
};
const RSS = {
  ok: true, kind: 'rss', series: 'rosary-in-a-year', title: 'The Rosary in a Year', available: true,
  showImageUrl: null, showDesc: null,
  entries: [
    { key: 'riy:day-1', label: 'Day 1', title: 'Introduction', url: 'https://example.com/riy-day1.mp3', durationS: 900, listened: false, positionS: 0, imageUrl: null, descText: null },
  ],
};
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
  ok(changed.every((p) => p === 'app/worker/src/client.ts' || p === 'releases/v556-blob-start-resolve.md' || p.startsWith('app/tests/harness-v556')),
    'S1a: the tracked diff against the production base is confined to client.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v556') || p === 'releases/v556-blob-start-resolve.md'),
    'S1b: the only untracked paths are the harness, its logs, and the release document', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (no server change of any kind)');
  ok(U_SRC === B_U, 'S2b: ui.ts byte-identical to the base (the SW pin moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2c: migration 0042 stands last (no migration)', migs.slice(-2).join(','));
  const pinOf = (s) => { const m = s.match(/ora-pro-nobis-v\d+-\d+/); return m ? m[0] : null; };
  ok(pinOf(U_SRC) === 'ora-pro-nobis-v551-1', 'S2d: the SW pin on the build tree still reads ora-pro-nobis-v551-1', pinOf(U_SRC));
  const nrs = fnBody(C_SRC, 'nativeResolveStart') || '';
  const iHom = nrs.indexOf("desc.kind === 'homily'");
  ok(iHom > 0 && iHom < nrs.indexOf("desc.kind === 'podcast'") && nrs.includes('elementStartTail(desc)'),
    'S3: nativeResolveStart carries the homily arm at its head, running the standing elementStartTail (P1)');
  ok((fnBody(C_SRC, 'podOwnDesc') || '').includes('enclosureUrl: e.streamUrl'),
    'S4: podOwnDesc sets enclosureUrl from the entry streamUrl (P2)');
  ok(fnBody(C_SRC, 'oraSnapshotTrack') === fnBody(B_C, 'oraSnapshotTrack')
    && fnBody(C_SRC, 'nativeContractItem') === fnBody(B_C, 'nativeContractItem')
    && fnBody(C_SRC, 'nativeStartFailed') === fnBody(B_C, 'nativeStartFailed')
    && fnBody(C_SRC, 'refuseNativeStart') === fnBody(B_C, 'refuseNativeStart')
    && fnBody(C_SRC, 'homilyDescFor') === fnBody(B_C, 'homilyDescFor')
    && fnBody(C_SRC, 'elementStartTail') === fnBody(B_C, 'elementStartTail'),
    'S5: the standing machinery is byte-identical — oraSnapshotTrack · nativeContractItem · nativeStartFailed · refuseNativeStart · homilyDescFor · elementStartTail (the fix lands at the two named seats only)');
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

function buildPage(oneEngine) {
  const bridge = oneEngine ? `
window.__contracts = [];
window.Capacitor = { Plugins: { OraDayBridge: {
  oneEngine: function () { return true; },
  setNativeQueue: function (a) { try { window.__contracts.push(JSON.parse(a.queue)); } catch (e) {} return Promise.resolve({}); },
  nativeTransport: function () { return Promise.resolve({}); },
  setDaySnapshot: function () { return Promise.resolve({}); },
  setPlaybackState: function () { return Promise.resolve({}); },
  addListener: function () { return Promise.resolve({ remove: function () {} }); },
  getWallpaperSettings: function () { return Promise.resolve({}); },
  setWallpaperSettings: function () { return Promise.resolve({}); },
  setStatusBarColor: function () { return Promise.resolve({}); }
} } };
` : '';
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
  if (p.indexOf('/api/player/podcasts?series=the-ai-signal') === 0) return ans(200, ${JSON.stringify(OWN)});
  if (p.indexOf('/api/player/podcasts?series=rosary-in-a-year') === 0) return ans(200, ${JSON.stringify(RSS)});
  if (p.indexOf('/api/player/podcasts?series=') === 0) return ans(200, { ok: true, available: true, series: 'other', kind: 'rss', title: 'Other', entries: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
  return ans(200, { ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
window.HTMLMediaElement.prototype.play = function () { this.__playing = true; this.__ended = false; var el = this; Promise.resolve().then(function () { try { el.dispatchEvent(new Event('play')); } catch (e) {} }); return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () { this.__playing = false; };
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', { configurable: true, get: function () { return !this.__playing; } }); } catch (e) {}
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'ended', { configurable: true, get: function () { return !!this.__ended; } }); } catch (e) {}
try {
  var fakeStream = { getTracks: function () { return [{ stop: function () {} }]; } };
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = function () { return Promise.resolve(fakeStream); };
  window.MediaRecorder = function (stream, opts) { this.mimeType = (opts && opts.mimeType) || 'audio/webm'; this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; };
  window.MediaRecorder.isTypeSupported = function (t) { return String(t).indexOf('audio/webm') === 0; };
  window.MediaRecorder.prototype.start = function (timeslice) { this.state = 'recording'; var self = this; this.__iv = setInterval(function () { if (self.ondataavailable) self.ondataavailable({ data: new Blob(['fake-audio-chunk'], { type: self.mimeType }) }); }, Math.max(50, Math.min(timeslice || 5000, 200))); };
  window.MediaRecorder.prototype.stop = function () { if (this.state === 'inactive') return; this.state = 'inactive'; clearInterval(this.__iv); if (this.ondataavailable) this.ondataavailable({ data: new Blob(['fake-audio-final'], { type: self.mimeType }) }); if (this.onstop) this.onstop(); };
} catch (e) {}
` + bridge;
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
const srv = http.createServer((req, res) => {
  const oneEngine = (req.url || '').includes('engine=1');
  const html = buildPage(oneEngine);
  if ((req.url || '/').split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); }
  else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + srv.address().port;

async function boot(errs, tag, oneEngine) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + '/?engine=' + (oneEngine ? '1' : '0'));
  await sleep(300);
  await page.click('[data-tab="prayers"]');
  await page.waitForFunction(() => window.state && state.dayDescs && state.dayDescs.length >= 8, null, { timeout: 25000 }).catch(() => console.log('note -', tag, 'day build slow'));
  await sleep(600);
  return { ctx, page };
}
async function clickSide(page, side) {
  await page.evaluate((s) => { const b = document.querySelector('#sidetoggle [data-side="' + s + '"]'); if (b) b.click(); }, side);
  await sleep(500);
}
async function recordTake(page) {
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('#mass-homily-rec', { timeout: 15000 }).catch(() => console.log('note - record card slow'));
  await sleep(500);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - recording state slow'));
  await sleep(1300);
  await page.click('#mass-homily-stop');
  await page.waitForFunction(() => {
    try { const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); return idx.length === 1 && idx[0].state === 'ready'; } catch (e) { return false; }
  }, null, { timeout: 10000 }).catch(() => console.log('note - take save slow'));
  return page.evaluate(() => { const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); return (idx[0] || {}).id || null; });
}
async function seedAiCopy(page) {
  await page.evaluate(async (n) => {
    const c = await caches.open('opn-ext-audio-v1');
    await c.put('day/' + new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) + '/the-ai-signal',
      new Response(new Blob([new Uint8Array(n)], { type: 'audio/mpeg' }), { headers: { 'content-type': 'audio/mpeg' } }));
  }, 3965605);
}
async function openOwnSeries(page) {
  await page.click('[data-tab="podcasts"]');
  await sleep(500);
  await page.evaluate(() => openPodSeries('the-ai-signal'));
  await page.waitForSelector('[data-ownplay]', { timeout: 15000 }).catch(() => console.log('note - own series page slow'));
  await sleep(1500);
}

/* ---------------- World A (one-engine): the homily legs ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'A', true);
  ok(errs.length === 0, 'A0: one-engine boot clean — no page errors', errs.join(' · '));
  const modes = await page.evaluate(() => ({ native: oraNativeMode(), one: oraOneEngineMode() }));
  ok(modes.native && modes.one, 'A0b: the world reads as the one-engine pair (oraNativeMode + oraOneEngine both true)', JSON.stringify(modes));

  const HID = await recordTake(page);
  ok(!!HID, 'A1: a take records on the fake devices and stands ready on-device', String(HID));

  await page.click('[data-tab="podcasts"]');
  await sleep(600);
  await clickSide(page, 'homilies');
  await page.waitForSelector('[data-homilyplay="' + HID + '"]', { timeout: 10000 }).catch(() => console.log('note - homilies list slow'));
  await page.click('[data-homilyplay="' + HID + '"]');
  await sleep(900);
  const played = await page.evaluate(() => ({
    current: state.current ? state.current.episodeId : null,
    src: (window.audioEl && audioEl.src) || '',
    refusal: state.nativeRefusal,
    contracts: (window.__contracts || []).length,
  }));
  ok(played.current === 'homily:' + HID && played.src.indexOf('blob:') === 0,
    'A2a: Play on the take in the one-engine pair makes it current, playing from the store-minted blob: URL (P1)', JSON.stringify(played).slice(0, 160));
  ok(played.refusal === null && played.contracts === 0,
    'A2b: no refusal stands and no contract carried the take — the "unresolved-start" failure is gone', JSON.stringify({ refusal: played.refusal, contracts: played.contracts }));
  ok(errs.length === 0, 'A3: no page errors across the one-engine homily world', errs.join(' · '));
  await ctx.close();
}

/* ---------------- World B (one-engine): the AI Signal + unchanged-start legs ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'B', true);
  ok(errs.length === 0, 'B0: one-engine boot clean — no page errors', errs.join(' · '));
  await seedAiCopy(page);
  await openOwnSeries(page);
  const swap = await page.evaluate((k) => {
    const o = ownBlobOwners['day/' + k + '/the-ai-signal'];
    return { minted: !!(o && o.blobUrl), isBlob: !!(o && o.blobUrl && o.blobUrl.indexOf('blob:') === 0) };
  }, todayCT);
  ok(swap.minted && swap.isBlob, 'B1: the device-local copy stands swapped in at the series paint (Trigger A mint reads the seeded cache copy)', JSON.stringify(swap));

  const todayKey = 'the-ai-signal-' + todayCT;
  const descToday = await page.evaluate((k) => {
    const e = state.podcasts.entries.find((x) => x.key === k);
    const d = podOwnDesc(e);
    return { url: d.url, enclosureUrl: d.enclosureUrl, streamUrl: e.streamUrl };
  }, todayKey);
  ok(descToday.url.indexOf('blob:') === 0 && descToday.enclosureUrl === descToday.streamUrl,
    'B2a: today\'s descriptor carries the blob url for the page AND enclosureUrl = its streamUrl for the contract (P2)', JSON.stringify(descToday).slice(0, 180));
  await page.click('[data-ownplay="' + todayKey + '"]');
  await sleep(900);
  const c2 = await page.evaluate(() => {
    const cs = window.__contracts || [];
    const last = cs[cs.length - 1] || null;
    return { n: cs.length, first: last && last.items ? last.items[0] : null, refusal: state.nativeRefusal, current: state.current ? state.current.episodeId : null };
  });
  ok(!!c2.first && c2.first.mediaUri === ORIGIN + '/api/player/audio/' + todayCT + '/the-ai-signal' && c2.current === todayKey && c2.refusal === null,
    'B2b: the contract start item carries the store-id Range address — the tap resolves and no refusal stands', JSON.stringify(c2.first).slice(0, 200));

  const olderKey = 'the-ai-signal-2026-11-19';
  const descOld = await page.evaluate((k) => {
    const e = state.podcasts.entries.find((x) => x.key === k);
    const d = podOwnDesc(e);
    return { url: d.url, enclosureUrl: d.enclosureUrl, streamUrl: e.streamUrl };
  }, olderKey);
  ok(descOld.url === descOld.streamUrl && descOld.enclosureUrl === descOld.streamUrl,
    'B3a: an older entry (no swap) reads url = enclosureUrl = its streamUrl, exactly the pre-fix descriptor addresses', JSON.stringify(descOld).slice(0, 180));
  await page.click('[data-ownplay="' + olderKey + '"]');
  await sleep(900);
  const c3 = await page.evaluate(() => {
    const cs = window.__contracts || [];
    const last = cs[cs.length - 1] || null;
    return { first: last && last.items ? last.items[0] : null };
  });
  ok(!!c3.first && c3.first.mediaUri === ORIGIN + '/api/player/audio/2026-11-19/the-ai-signal',
    'B3b: the older entry\'s contract item is byte-identical to the pre-fix form (origin + streamUrl)', JSON.stringify(c3.first).slice(0, 200));

  const c4 = await page.evaluate(() => {
    const before = (window.__contracts || []).length;
    const d = state.dayDescs.find((x) => x.episodeId === 'daily-rosary');
    state.queue = []; state.queueIdx = -1; state.queueFrom = null; // playTrack's single-play discipline: a fresh play clears the standing queue before the funnel
    startDesc(d);
    const cs = window.__contracts || [];
    const last = cs[cs.length - 1] || null;
    return { sent: cs.length > before, form: last ? last.form : null, first: last && last.items ? last.items[0] : null };
  });
  ok(c4.sent && !!c4.first && c4.first.mediaUri === 'https://example.com/daily-rosary.mp3' && c4.first.kind === 'episode',
    'B4: a day track start carries its standing contract form — unchanged by the fix', JSON.stringify(c4.first).slice(0, 200));

  await page.evaluate(() => openPodSeries('rosary-in-a-year'));
  await sleep(1200);
  const c5 = await page.evaluate(() => {
    const before = (window.__contracts || []).length;
    const e = state.podcasts.entries[0];
    state.queue = []; state.queueIdx = -1; state.queueFrom = null; // as B4: the single-play discipline
    startDesc(podDesc(e));
    const cs = window.__contracts || [];
    const last = cs[cs.length - 1] || null;
    return { sent: cs.length > before, form: last ? last.form : null, first: last && last.items ? last.items[0] : null };
  });
  ok(c5.sent && c5.form === 'podcast' && !!c5.first && c5.first.kind === 'podcast' && c5.first.mediaUri === 'https://example.com/riy-day1.mp3',
    'B5: an RSS podcast start carries its standing contract form — unchanged by the fix', JSON.stringify(c5.first).slice(0, 200));
  ok(errs.length === 0, 'B6: no page errors across the one-engine AI Signal world', errs.join(' · '));
  await ctx.close();
}

/* ---------------- World C (browser pair): the element path stands ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'C', false);
  ok(errs.length === 0, 'C0: browser-pair boot clean — no page errors', errs.join(' · '));
  const HID = await recordTake(page);
  await page.click('[data-tab="podcasts"]');
  await sleep(600);
  await clickSide(page, 'homilies');
  await page.waitForSelector('[data-homilyplay="' + HID + '"]', { timeout: 10000 }).catch(() => console.log('note - homilies list slow'));
  await page.click('[data-homilyplay="' + HID + '"]');
  await sleep(900);
  const c1w = await page.evaluate(() => ({ current: state.current ? state.current.episodeId : null, src: (window.audioEl && audioEl.src) || '' }));
  ok(!!HID && c1w.current === 'homily:' + HID && c1w.src.indexOf('blob:') === 0,
    'C1: in the browser pair a homily start plays as it did at v551 (element src is the store-minted blob: URL)', JSON.stringify(c1w).slice(0, 160));

  await seedAiCopy(page);
  await openOwnSeries(page);
  const todayKey = 'the-ai-signal-' + todayCT;
  await page.waitForFunction((k) => { const o = ownBlobOwners['day/' + k + '/the-ai-signal']; return !!(o && o.blobUrl); }, todayCT, { timeout: 10000 }).catch(() => console.log('note - swap mint slow'));
  await page.click('[data-ownplay="' + todayKey + '"]');
  await sleep(900);
  const c2 = await page.evaluate(() => ({ current: state.current ? state.current.episodeId : null, src: (window.audioEl && audioEl.src) || '' }));
  ok(c2.current === todayKey && c2.src.indexOf('blob:') === 0,
    'C2: in the browser pair today\'s entry still plays the device-local blob through the element — desc.url untouched by the fix', JSON.stringify(c2).slice(0, 160));
  ok(errs.length === 0, 'C3: no page errors across the browser-pair world', errs.join(' · '));
  await ctx.close();
}

console.log('---');
console.log('harness-v556: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); failures.forEach((f) => console.log('  - ' + f)); }
srv.close();
await browser.close();
process.exit(fail ? 1 : 0);
