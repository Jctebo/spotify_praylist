// harness-v559.mjs — v559 evidence: Native homily
// recording (John's order, main chat, 2026-11-20
// 15:43 CT, verbatim: "Build native recording" — on
// his field verdict that under the v557 pick,
// recordings sound the same: the shell steered the
// communication route and the WebView's getUserMedia
// capture does not follow it).
//   The shape (Plan D1–D8): where the shell offers
//     native recording, the shell records the take —
//     the chosen input is the recorder's own preferred
//     device — and at stop the page pulls the finished
//     M4A across the bridge in 256 KB slices into the
//     SAME IndexedDB chunk store v551 writes, so the
//     Homilies list, playback, and acts work unchanged.
//     Local only (v551 Q1 C). A failed native start
//     starts NO take — never a silent WebView
//     substitute in the shell (D8). Old-shell and
//     browser worlds keep the v557/v551 paths whole.
//   S statics: the diff against the production base
//     (GitHub main f9461fe — the v558 ship tree)
//     confined to client.ts + the release document +
//     this harness · index.ts AND ui.ts byte-identical
//     (no server change, no style change, the SW pin
//     unmoved) · migrations end at 0042 · the homily +
//     microphone + native module holds no network
//     call · the WebView capture functions stand
//     byte-identical to the base (homilyStartCapture ·
//     homilyFinishRecord · homilyAbortRecord ·
//     homilyMicPrepare · homilyMicRelease ·
//     homilyMimePick) · the native seams stand as
//     planned (the branch at homilyStartRecord · the
//     stop branch · start carries the pick key · the
//     pull writes chunk rows · no getUserMedia anywhere
//     in the native path).
//   Worlds (Chromium, stubbed fetch, the v551 mold;
//     the fake OraDayBridge is the harness's own
//     fixture — no production shell runs here):
//     N1 native world, glasses picked: Record calls
//       startNativeRecording with the glasses key;
//       getUserMedia and applyAudioInput are NEVER
//       called; the recording dress names the glasses;
//       Stop → stopNativeRecording → the pull runs to
//       EOF → the take lands (audio/mp4 · 600,000
//       bytes · 3 chunk rows), discardNativeTake
//       stands; the Homilies side paints the take and
//       a playback start resolves it as a homily.
//     N2 native world, phone picked: start carries
//       the built-in canonical key; the take lands.
//     N3 native world, start answers fellBack: the
//       Q5 A notice stands verbatim on the card and
//       the take lands from the default.
//     N4 native world, start answers started:false:
//       no take stands, no getUserMedia call stands
//       (no silent downgrade), the unavailable note
//       stands on the card.
//     N5 old-shell world (bridge without native
//       methods): the v557 path stands —
//       applyAudioInput before getUserMedia, stop
//       calls clearAudioInput, the take lands.
//     N6 bridge-absent world: v551 parity — the row
//       reads System default, record → stop lands the
//       take with zero fetches.
//   Native capture quality itself is NOT a harness
//     claim — it is the first field leg (John's phone
//     + glasses), as the Plan records.
// Fixtures (Improvement D): the day payload is the
// LIVE production payload
// tests/fixtures-v522/day-live-2026-11-17.json
// re-seated exactly as harness-v551.mjs re-seats it;
// the Mass payload + readings feed stand in the
// v511/v551 production shape; the native take bytes
// are the harness's own deterministic fixture (no
// production native recording exists to fixture).
// Run: node app/tests/harness-v559.mjs [--probe]
// (from the worktree root). --probe only prints.
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
const BASE = 'd370639';
const gitShow = (p) => execFileSync('git', ['show', BASE + ':' + p], { cwd: ROOT, encoding: 'utf8' });
const B_C = gitShow('app/worker/src/client.ts');

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
const GLASSES_KEY = 'bt:AA:BB:CC:DD:EE:FF';
const PHONE_KEY = 't15:SM-F971U1';
const NATIVE_TOTAL = 600000;
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
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'releases/v559-native-homily-recording.md' || p.startsWith('app/tests/harness-v559')),
    'S1a: the tracked diff against the production base is confined to client.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v559') || p === 'releases/v559-native-homily-recording.md'),
    'S1b: the only untracked paths are the harness, its logs, and the release document', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (no server change of any kind)');
  ok(U_SRC === gitShow('app/worker/src/ui.ts'), 'S2b: ui.ts byte-identical to the base (no style change; the SW pin unmoved — it moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2c: migration 0042 stands last (no migration)', migs.slice(-2).join(','));
  const modStart = C_SRC.indexOf('v551 homily recording (Q1 C');
  const modEnd = C_SRC.indexOf('function openSlotPicker(', modStart);
  const MOD = C_SRC.slice(modStart, modEnd);
  ok(modStart > 0 && modEnd > modStart && !/api\('|api\("|fetch\(|XMLHttpRequest|method:\s*'PUT'|method:\s*"PUT"|['"]\/api\//.test(MOD),
    'S3: the homily + microphone + native module issues no network call of any kind (no api(), no fetch, no PUT, no /api/ path — Q1 C stands)');
  const start = fnBody(C_SRC, 'homilyStartRecord') || '';
  ok(start.includes('homilyNativeBridge()') && start.includes('homilyStartNative()')
    && start.indexOf('homilyStartNative()') < start.indexOf('homilyMicPrepare()')
    && start.includes('homilyMicPrepare()') && start.includes('homilyStartCapture()'),
    'S4a: homilyStartRecord branches to the native path first; the v557 prepare → capture flow stands under it (Plan D6)');
  ['homilyStartCapture', 'homilyFinishRecord', 'homilyAbortRecord', 'homilyMicPrepare', 'homilyMicRelease', 'homilyMimePick'].forEach((fn) => {
    ok(fnBody(C_SRC, fn) !== null && fnBody(C_SRC, fn) === fnBody(B_C, fn),
      'S4b: ' + fn + ' is byte-identical to the base (the WebView capture path is untouched)');
  });
  const stop = fnBody(C_SRC, 'homilyStopRecord') || '';
  ok(stop.includes('homilyStopNative()') && stop.includes('homilyRec.recorder'),
    'S4c: homilyStopRecord branches native takes to the bridge stop; the WebView stop arm stands');
  const startN = fnBody(C_SRC, 'homilyStartNative') || '';
  ok(startN.includes("startNativeRecording({ key: pick ? pick.key : 'default' })") && startN.includes("mimeType: 'audio/mp4'") && startN.includes("state: 'recording'"),
    'S4d: the native start carries the remembered pick key (or default) and opens the standing entry shape as an audio/mp4 recording (Plan D5/D6)');
  ok(!startN.includes('homilyStartCapture') && !startN.includes('getUserMedia') && !startN.includes('homilyMicPrepare'),
    'S4e: the native start never touches the WebView capture or the steering prepare (no silent downgrade — Plan D8)');
  const failed = fnBody(C_SRC, 'homilyNativeStartFailed') || '';
  ok(failed.includes('Microphone not available on this device.') && failed.includes('homilyEntryRemove'),
    'S4f: a failed native start removes the entry and shows the unavailable note (Plan D8)');
  const pull = fnBody(C_SRC, 'homilyNativePull') || '';
  ok(pull.includes('readNativeTakeChunk') && pull.includes("homilyIdbPut('chunks'") && pull.includes('discardNativeTake'),
    'S4g: the pull reads bridge slices into the standing chunk store and discards the shell copy at EOF (Plan D4)');
  const stopN = fnBody(C_SRC, 'homilyStopNative') || '';
  ok(stopN.includes('stopNativeRecording') && stopN.includes('homilyNativePull') && stopN.includes('homilyFinishNative'),
    'S4h: the native stop runs stop → pull → finish in that order (Plan D5)');
  const finN = fnBody(C_SRC, 'homilyFinishNative') || '';
  ok(finN.includes("entry.state = 'ready'") && finN.includes('homilyMint') && finN.includes('On this device only.'),
    'S4i: the native finish lands the take ready, mints it, and paints v551\u2019s saved note');
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

const RAW_DEVICES = [
  { key: 't15:SM-F971U1', name: 'SM-F971U1', kind: 'builtin' },
  { key: 't7:SM-F971U1', name: 'SM-F971U1', kind: 'other' },
  { key: 't16:SM-F971U1', name: 'SM-F971U1', kind: 'builtin' },
  { key: 't8:SM-F971U1', name: 'SM-F971U1', kind: 'other' },
  { key: GLASSES_KEY, name: 'Ray-Ban Meta glasses', kind: 'bluetooth' },
];
function buildPage(world) {
  const native = world === 'native' || world === 'nativefb' || world === 'nativefail';
  const devices = world === 'oldshell'
    ? [{ key: PHONE_KEY, name: 'Phone microphone', kind: 'builtin' }, { key: GLASSES_KEY, name: 'Ray-Ban Meta glasses', kind: 'bluetooth' }]
    : RAW_DEVICES;
  const nativeStub = !native ? '' : `
  startNativeRecording: function (args) {
    window.__order.push('startNativeRecording');
    window.__nativeKey = args && args.key;
    ${world === 'nativefail'
      ? "return Promise.resolve({ started: false, reason: 'permission' });"
      : world === 'nativefb'
        ? "return Promise.resolve({ started: true, name: 'Phone microphone', fellBack: true, mimeType: 'audio/mp4' });"
        : `var nm = 'System default';
    if (window.__nativeKey === '${GLASSES_KEY}') nm = 'Ray-Ban Meta glasses';
    else if (window.__nativeKey === '${PHONE_KEY}') nm = 'Phone microphone';
    return Promise.resolve({ started: true, name: nm, fellBack: false, mimeType: 'audio/mp4' });`}
  },
  stopNativeRecording: function () { window.__order.push('stopNativeRecording'); return Promise.resolve({ sizeBytes: ${NATIVE_TOTAL}, durationMs: 61000, mimeType: 'audio/mp4' }); },
  readNativeTakeChunk: function (args) {
    window.__order.push('readChunk');
    var off = (args && args.offset) || 0, len = Math.min((args && args.length) || 262144, ${NATIVE_TOTAL} - off);
    if (len <= 0) return Promise.resolve({ data: '', eof: true, sizeBytes: ${NATIVE_TOTAL} });
    var bin = '';
    for (var i = 0; i < len; i += 8192) {
      var part = '';
      var n = Math.min(8192, len - i);
      for (var j = 0; j < n; j++) part += String.fromCharCode((off + i + j) % 251);
      bin += part;
    }
    return Promise.resolve({ data: btoa(bin), eof: off + len >= ${NATIVE_TOTAL}, sizeBytes: ${NATIVE_TOTAL} });
  },
  discardNativeTake: function () { window.__order.push('discardNativeTake'); return Promise.resolve({}); },
  cancelNativeRecording: function () { window.__order.push('cancelNativeRecording'); return Promise.resolve({}); },
`;
  const bridgeStub = world === 'none' ? '' : `
window.Capacitor = { Plugins: { OraDayBridge: {
  setDaySnapshot: function () { return Promise.resolve({}); },
  setStatusBarColor: function () { return Promise.resolve({}); },
  addListener: function () { return Promise.resolve({ remove: function () {} }); },
  listAudioInputs: function () { window.__order.push('listAudioInputs'); return Promise.resolve({ devices: ${JSON.stringify(devices)} }); },
  applyAudioInput: function (args) {
    window.__order.push('applyAudioInput');
    var d = null;
    ${JSON.stringify(devices)}.forEach(function (x) { if (x.key === (args && args.key)) d = x; });
    if (d) return Promise.resolve({ applied: true, name: d.name, fellBack: false });
    if (args && args.key === 'default') return Promise.resolve({ applied: true, name: 'System default', fellBack: false });
    return Promise.resolve({ applied: false, name: 'Phone microphone', fellBack: true });
  },
  clearAudioInput: function () { window.__order.push('clearAudioInput'); return Promise.resolve({}); },
${nativeStub}} } };
`;
  const stub = `
window.__fetchLog = [];
window.__order = [];
window.__nativeKey = null;
window.fetch = function (path, opts) {
  var p = String(path);
  window.__fetchLog.push({ path: p, method: (opts && opts.method) || 'GET' });
  function ans(status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); }, text: function () { return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)); } }); }
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
  if (p.indexOf('/api/prayer/book/favorites') === 0) return ans(200, { ok: true, favorites: [] });
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, { ok: true, groups: [] });
  return ans(200, { ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
window.HTMLMediaElement.prototype.play = function () { this.__playing = true; this.__ended = false; var el = this; Promise.resolve().then(function () { try { el.dispatchEvent(new Event('play')); } catch (e) {} }); return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () { this.__playing = false; };
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', { configurable: true, get: function () { return !this.__playing; } }); } catch (e) {}
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'ended', { configurable: true, get: function () { return !!this.__ended; } }); } catch (e) {}
${bridgeStub}
try {
  var fakeStream = { getTracks: function () { return [{ stop: function () {} }]; } };
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = function () { window.__order.push('gum'); return Promise.resolve(fakeStream); };
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
const PAGES = { native: buildPage('native'), nativefb: buildPage('nativefb'), nativefail: buildPage('nativefail'), oldshell: buildPage('oldshell'), none: buildPage('none') };
const srv = http.createServer((req, res) => {
  const w = ((req.url || '/').split('?')[0].split('/')[1]) || 'none';
  if (PAGES[w]) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGES[w]); }
  else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + srv.address().port;
const SEED_GLASSES = `try { localStorage.setItem('opn-homily-mic-v557', JSON.stringify({ key: '${GLASSES_KEY}', name: 'Ray-Ban Meta glasses' })); } catch (e) {}`;
const SEED_PHONE = `try { localStorage.setItem('opn-homily-mic-v557', JSON.stringify({ key: '${PHONE_KEY}', name: 'Phone microphone' })); } catch (e) {}`;

async function boot(errs, tag, world, seed) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
  if (seed) await ctx.addInitScript(seed);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + '/' + world);
  await sleep(300);
  await page.click('[data-tab="prayers"]');
  await page.waitForFunction(() => window.state && state.dayDescs && state.dayDescs.length >= 8, null, { timeout: 25000 }).catch(() => console.log('note -', tag, 'day build slow'));
  await sleep(600);
  return { ctx, page };
}
async function goMass(page, tag) {
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('#mass-homily-rec', { timeout: 15000 }).catch(() => console.log('note -', tag, 'record card slow'));
  await sleep(500);
}
async function takeReady(page) {
  await page.waitForFunction(() => {
    try { const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); return idx.length === 1 && idx[0].state === 'ready'; } catch (e) { return false; }
  }, null, { timeout: 15000 }).catch(() => console.log('note - take save slow'));
  return page.evaluate(() => { const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); return idx[0] || null; });
}

/* ---------------- N1: native world, glasses picked ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'n1', 'native', SEED_GLASSES);
  ok(errs.length === 0, 'N1-0: boot clean in the native world — no page errors', errs.join(' · '));
  await goMass(page, 'n1');
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - n1 recording state slow'));
  await sleep(600);
  const during = await page.evaluate(() => ({
    order: window.__order.slice(),
    key: window.__nativeKey,
    timer: (document.getElementById('mass-homily-timer') || {}).textContent || '',
  }));
  ok(during.order.includes('startNativeRecording') && during.key === GLASSES_KEY && !during.order.includes('gum') && !during.order.includes('applyAudioInput'),
    'N1a: Record calls startNativeRecording with the glasses key; getUserMedia and applyAudioInput are never called (Plan D5/D6)', during.order.join(' · ') + ' key=' + during.key);
  ok(during.timer.includes('Microphone: Ray-Ban Meta glasses'),
    'N1b: the recording dress names the microphone in use', during.timer);
  await sleep(900);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready' && take.mimeType === 'audio/mp4' && take.sizeBytes === NATIVE_TOTAL && take.chunkCount === 3,
    'N1c: the take lands in the standing store — ready, audio/mp4, 600,000 bytes in 3 chunk rows', take ? JSON.stringify({ m: take.mimeType, b: take.sizeBytes, c: take.chunkCount }) : 'no take');
  const after = await page.evaluate(async (id) => {
    const chunks = await homilyChunks(id);
    const blob = await homilyTakeBlob(id);
    return { order: window.__order.slice(), idbChunks: chunks.length, blobSize: blob ? blob.size : -1, blobType: blob ? blob.type : '' };
  }, take ? take.id : '');
  ok(after.order.includes('stopNativeRecording') && after.order.includes('discardNativeTake') && after.idbChunks === 3 && after.blobSize === NATIVE_TOTAL && after.blobType === 'audio/mp4',
    'N1d: stop → pull → discard stands in order; the stored chunks assemble into the full M4A blob', after.order.join(' · ') + ' blob=' + after.blobSize + '/' + after.blobType);
  await page.click('[data-tab="podcasts"]');
  await sleep(700);
  const pill = await page.evaluate(() => Array.from(document.querySelectorAll('#sidetoggle [data-side]')).map((b) => b.textContent.trim()));
  ok(pill.includes('Homilies'), 'N1e: the Homilies side stands in Catechesis after the native take', pill.join(' · '));
  await page.evaluate(() => { const b = document.querySelector('#sidetoggle [data-side="homilies"]'); if (b) b.click(); });
  await sleep(500);
  const row = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    return r ? (r.querySelector('.ttl') || {}).textContent || '' : null;
  }, take ? take.id : '');
  ok(!!row && row === take.name, 'N1f: the Homilies list paints the native take under its name', row);
  await page.click('[data-homilyplay="' + take.id + '"]');
  await sleep(900);
  const cur = await page.evaluate(() => window.state && state.current ? { kind: state.current.kind, hid: state.current.homilyId } : null);
  ok(!!cur && cur.kind === 'homily' && cur.hid === take.id,
    'N1g: a playback start resolves the native take as a homily (the standing v556 arm)', JSON.stringify(cur));
  await ctx.close();
}

/* ---------------- N2: native world, phone picked ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'n2', 'native', SEED_PHONE);
  await goMass(page, 'n2');
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - n2 recording state slow'));
  await sleep(500);
  const during = await page.evaluate(() => ({ key: window.__nativeKey, order: window.__order.slice() }));
  ok(during.key === PHONE_KEY && !during.order.includes('gum'),
    'N2a: start carries the built-in canonical key (v558\u2019s migrated pick key passes through whole)', 'key=' + during.key);
  await sleep(700);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready' && take.mimeType === 'audio/mp4',
    'N2b: the phone-mic native take lands', take ? take.name : 'no take');
  await ctx.close();
}

/* ---------------- N3: the Q5 A fallback on the native path ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'n3', 'nativefb', SEED_GLASSES);
  await goMass(page, 'n3');
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - n3 recording state slow'));
  await sleep(500);
  const note = await page.evaluate(() => (document.querySelector('.homily-mic-note') || {}).textContent || null);
  ok(note === 'Ray-Ban Meta glasses not connected \u2014 recording from the phone microphone.',
    'N3a: the fallback notice stands on the card in v557\u2019s words (Q5 A)', note);
  await sleep(700);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready', 'N3b: the fallback take lands from the default device — never blocked', take ? take.name : 'no take');
  await ctx.close();
}

/* ---------------- N4: native start failure — no downgrade ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'n4', 'nativefail', SEED_GLASSES);
  await goMass(page, 'n4');
  await page.click('#mass-homily-rec');
  await sleep(1500);
  const after = await page.evaluate(() => ({
    order: window.__order.slice(),
    recording: !!document.getElementById('mass-homily-stop'),
    idx: JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]').length,
    host: (document.getElementById('mass-homily-host') || {}).textContent || '',
  }));
  ok(!after.recording && after.idx === 0 && after.host.includes('Microphone not available on this device.'),
    'N4a: a failed native start stands no take and shows the unavailable note (Plan D8)', JSON.stringify({ rec: after.recording, idx: after.idx }));
  ok(after.order.includes('startNativeRecording') && !after.order.includes('gum'),
    'N4b: getUserMedia was never called — no silent WebView substitute in the shell', after.order.join(' · '));
  await ctx.close();
}

/* ---------------- N5: old shell — the v557 path stands ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'n5', 'oldshell', SEED_GLASSES);
  await goMass(page, 'n5');
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - n5 recording state slow'));
  const during = await page.evaluate(() => window.__order.slice());
  ok(during.indexOf('applyAudioInput') >= 0 && during.indexOf('gum') > during.indexOf('applyAudioInput') && !during.includes('startNativeRecording'),
    'N5a: without native methods the v557 path stands — applyAudioInput before getUserMedia', during.join(' · '));
  await sleep(900);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  const after = await page.evaluate(() => window.__order.slice());
  ok(!!take && take.state === 'ready' && after.includes('clearAudioInput'),
    'N5b: the old-shell take lands exactly as v557\u2019s, route released at stop', take ? take.name : 'no take');
  await ctx.close();
}

/* ---------------- N6: no bridge — v551 parity ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'n6', 'none');
  ok(errs.length === 0, 'N6-0: boot clean in the bridge-absent world — no page errors', errs.join(' · '));
  await goMass(page, 'n6');
  const row0 = await page.evaluate(() => ({
    name: (document.querySelector('.homily-mic-name') || {}).textContent || null,
    change: !!document.getElementById('mass-homily-mic-change'),
  }));
  ok(row0.name === 'System default' && !row0.change,
    'N6a: without the bridge the row reads "System default" and no Change act stands', JSON.stringify(row0));
  const fetchBefore = await page.evaluate(() => window.__fetchLog.length);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - n6 recording state slow'));
  await sleep(1000);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  const fetchAfter = await page.evaluate(() => window.__fetchLog.length);
  ok(!!take && take.state === 'ready', 'N6b: record → stop lands the take exactly as v551\u2019s', take ? take.name : 'no take');
  ok(fetchAfter === fetchBefore, 'N6c: the whole capture issued ZERO network requests (Q1 C)', 'fetches ' + fetchBefore + ' → ' + fetchAfter);
  await ctx.close();
}

await browser.close();
srv.close();
console.log('');
console.log('harness-v559: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); failures.forEach((f) => console.log(' -', f)); }
process.exit(fail ? 1 : 0);
