// harness-v557.mjs — v557 evidence: Microphone control
// for homily recording (John's approval, Ora Pro Nobis
// thread, 2026-11-20 14:44 CT — package 55; run level
// To Ship).
//   Q1 A: native routing behind the in-app picker — the
//     OraDayBridge plugin lists the system's audio inputs
//     and steers the communication route at record start;
//     the WebView capture (getUserMedia · MediaRecorder ·
//     IndexedDB) is v551's, unchanged.
//   Q2 A: the control stands on the homily record card
//     only (Mass scroll, the homily's place).
//   Q3 A: the pick is remembered on the device.
//   Q4 A: friendly names; "System default" first; a
//     Bluetooth entry carries "Records at call quality."
//   Q5 A: a picked mic that is not there falls back to
//     the system route WITH a notice on the card before
//     capture starts — never blocked, never silent.
//   Q6 A: homily recording only.
//   S statics: the diff against the production base
//     (GitHub main 7739c33 — the v555 ship tree) confined
//     to client.ts + ui.ts (styles only; the SW pin
//     unmoved) + the release document + this harness ·
//     index.ts byte-identical · migrations end at 0042 ·
//     the homily + microphone module holds no network
//     call (the v551 Q1 C negative, extended) · the mic
//     seams stand as planned (prepare before capture ·
//     release on finish + abort · the row on the card ·
//     System default first in the list).
//   Worlds (Chromium, stubbed fetch, the v551 mold; the
//     fake OraDayBridge is the harness's own fixture — no
//     production shell runs here; the bridge carries ONLY
//     the six methods named below, never oneEngine, so
//     the client reads it as the pre-oneEngine shell):
//     W1 bridge world: the card paints the microphone row
//       at "System default"; Change opens the list in
//       M2 order (System default first · friendly names ·
//       the Bluetooth call-quality note); picking the
//       glasses stores opn-homily-mic-v557 and the row
//       names them; a repaint still names them (Q3 A).
//     W2 bridge world, glasses picked: applyAudioInput
//       stands BEFORE getUserMedia in the call order; the
//       recording card names "Microphone: Ray-Ban Meta
//       glasses"; stop calls clearAudioInput and the take
//       lands exactly as v551's.
//     W3 missing-device world: the remembered glasses are
//       absent from the bridge list — the list shows them
//       "Not connected"; Record falls back and the notice
//       stands on the card before capture; capture
//       proceeds from the phone microphone.
//     W4 bridge-absent world: no Capacitor — the row
//       reads System default, no Change act stands,
//       record → stop lands the take with zero fetches
//       (v551 parity).
//     W5 bridge world, System default picked: no
//       applyAudioInput call stands against the bridge;
//       capture proceeds and the recording card names
//       "Microphone: System default".
// Fixtures (Improvement D): the day payload is the LIVE
// production payload tests/fixtures-v522/day-live-2026-11-17.json
// re-seated exactly as harness-v551.mjs re-seats it (the
// production episode ids, the run's Chicago today); the
// Mass payload + readings feed stand in the v511/v551
// production shape. The capture fixture is the harness's
// own in-page fake media devices (no production
// recording exists to fixture), as in v551.
// Run: node app/tests/harness-v557.mjs [--probe] (from the
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
const BASE = '7739c33';
const gitShow = (p) => execFileSync('git', ['show', BASE + ':' + p], { cwd: ROOT, encoding: 'utf8' });
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
const GLASSES_KEY = 'bt:AA:BB:CC:DD:EE:FF';
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
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'app/worker/src/ui.ts' || p === 'releases/v557-microphone-control.md' || p.startsWith('app/tests/harness-v557')),
    'S1a: the tracked diff against the production base is confined to client.ts + ui.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v557') || p === 'releases/v557-microphone-control.md'),
    'S1b: the only untracked paths are the harness, its logs, and the release document', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (no server change of any kind)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2b: migration 0042 stands last (no migration)', migs.slice(-2).join(','));
  const pinOf = (s) => { const m = s.match(/ora-pro-nobis-v\d+-\d+/); return m ? m[0] : null; };
  ok(pinOf(U_SRC) === pinOf(B_U), 'S2c: the SW pin in ui.ts is unmoved on the build tree (the pin moves only at Ship)', pinOf(U_SRC) + ' vs ' + pinOf(B_U));
  const uiDiff = execFileSync('git', ['diff', BASE, '--', 'app/worker/src/ui.ts'], { cwd: ROOT, encoding: 'utf8' });
  const uiAdded = uiDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim());
  ok(uiAdded.length > 0 && uiAdded.some((l) => l.includes('.homily-mic-row')) && uiAdded.every((l) => !/function|=>|addEventListener|var |const /.test(l)),
    'S2d: the ui.ts diff is style rules only (the microphone row + list dress)', uiAdded.slice(0, 3).join(' | '));
  const modStart = C_SRC.indexOf('v551 homily recording (Q1 C');
  const modEnd = C_SRC.indexOf('function openSlotPicker(', modStart);
  const MOD = C_SRC.slice(modStart, modEnd);
  ok(modStart > 0 && modEnd > modStart && !/api\('|api\("|fetch\(|XMLHttpRequest|method:\s*'PUT'|method:\s*"PUT"|['"]\/api\//.test(MOD),
    'S3: the homily + microphone module issues no network call of any kind (no api(), no fetch, no PUT, no /api/ path — Q1 C stands)');
  ok(MOD.includes("var HOMILY_MIC_KEY = 'opn-homily-mic-v557'") && MOD.includes("rows = [{ key: 'default', name: 'System default'"),
    'S4a: the pick store stands as planned (opn-homily-mic-v557) and System default stands first in the list (Q4 A)');
  const start = fnBody(C_SRC, 'homilyStartRecord') || '';
  ok(start.includes('homilyMicPrepare()') && start.includes('homilyStartCapture()') && !start.includes('getUserMedia({ audio: true })'),
    'S4b: homilyStartRecord prepares the route first; the capture call stands in homilyStartCapture (Plan D5)');
  ok((fnBody(C_SRC, 'homilyStartCapture') || '').includes('getUserMedia({ audio: true })'),
    'S4c: the capture call itself is v551\u2019s, unchanged — getUserMedia({ audio: true }), no deviceId');
  const prep = fnBody(C_SRC, 'homilyMicPrepare') || '';
  ok(prep.includes('applyAudioInput') && prep.includes('fellBack') && prep.includes('not connected'),
    'S4d: homilyMicPrepare applies the pick through the bridge and composes the Q5 A fallback notice');
  ok((fnBody(C_SRC, 'homilyFinishRecord') || '').includes('homilyMicRelease()') && (fnBody(C_SRC, 'homilyAbortRecord') || '').includes('homilyMicRelease()'),
    'S4e: the route is released on both the finish and abort paths (Plan D2)');
  ok((fnBody(C_SRC, 'massHomilyCardInner') || '').includes('homilyMicRowHtml()'),
    'S4f: the record card carries the microphone row (Q2 A)');
  ok((fnBody(C_SRC, 'homilyMicKindNote') || '').includes('Records at call quality'),
    'S4g: a Bluetooth entry carries the call-quality note (Q4 A)');
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

function buildPage(world) {
  const devices = world === 'bridge'
    ? [{ key: 't15:builtin', name: 'Phone microphone', kind: 'builtin' }, { key: GLASSES_KEY, name: 'Ray-Ban Meta glasses', kind: 'bluetooth' }]
    : [{ key: 't15:builtin', name: 'Phone microphone', kind: 'builtin' }];
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
} } };
`;
  const stub = `
window.__fetchLog = [];
window.__order = [];
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
const PAGES = { bridge: buildPage('bridge'), missing: buildPage('missing'), none: buildPage('none') };
const srv = http.createServer((req, res) => {
  const w = ((req.url || '/').split('?')[0].split('/')[1]) || 'none';
  if (PAGES[w]) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGES[w]); }
  else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + srv.address().port;
const SEED_PICK = `try { localStorage.setItem('opn-homily-mic-v557', JSON.stringify({ key: '${GLASSES_KEY}', name: 'Ray-Ban Meta glasses' })); } catch (e) {}`;

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
  }, null, { timeout: 10000 }).catch(() => console.log('note - take save slow'));
  return page.evaluate(() => { const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); return idx[0] || null; });
}

/* ---------------- W1: the list + the remembered pick ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w1', 'bridge');
  ok(errs.length === 0, 'W1-0: boot clean in the bridge world — no page errors', errs.join(' · '));
  await goMass(page, 'w1');
  const row0 = await page.evaluate(() => {
    const n = document.querySelector('.homily-mic-name');
    return { name: n ? n.textContent : null, change: !!document.getElementById('mass-homily-mic-change') };
  });
  ok(row0.name === 'System default' && row0.change,
    'W1a: the record card paints the microphone row at "System default" with a Change act (Q2 A)', JSON.stringify(row0));
  await page.click('#mass-homily-mic-change');
  await page.waitForSelector('.homily-mic-list', { timeout: 8000 }).catch(() => console.log('note - w1 list slow'));
  const items = await page.evaluate(() => Array.from(document.querySelectorAll('[data-homily-mic]')).map((b) => ({
    key: b.getAttribute('data-homily-mic'),
    name: (b.querySelector('.homily-mic-item-name') || {}).textContent || '',
    note: (b.querySelector('.meta') || {}).textContent || '',
  })));
  ok(items.length === 3 && items[0].key === 'default' && items[1].name === 'Phone microphone' && items[2].name === 'Ray-Ban Meta glasses',
    'W1b: the list stands in M2 order — System default first, then the phone mic, then the glasses (Q4 A)', JSON.stringify(items.map((i) => i.name)));
  ok(items.length === 3 && items[2].note.includes('Records at call quality'),
    'W1c: the Bluetooth entry carries the call-quality note (Q4 A)', items.length === 3 ? items[2].note : 'no third item');
  await page.click('[data-homily-mic="' + GLASSES_KEY + '"]');
  await sleep(400);
  const picked = await page.evaluate(() => ({
    stored: JSON.parse(localStorage.getItem('opn-homily-mic-v557') || 'null'),
    row: (document.querySelector('.homily-mic-name') || {}).textContent || null,
    listOpen: !!document.querySelector('.homily-mic-list'),
  }));
  ok(picked.stored && picked.stored.key === GLASSES_KEY && picked.stored.name === 'Ray-Ban Meta glasses' && picked.row === 'Ray-Ban Meta glasses' && !picked.listOpen,
    'W1d: picking the glasses stores the pick and the row names them; the list closes', JSON.stringify(picked));
  await page.evaluate(() => paintMassHomilyCard());
  await sleep(300);
  const row1 = await page.evaluate(() => (document.querySelector('.homily-mic-name') || {}).textContent || null);
  ok(row1 === 'Ray-Ban Meta glasses', 'W1e: a repaint still names the glasses — the pick is remembered (Q3 A)', row1);
  await ctx.close();
}

/* ---------------- W2: steering order + the mic in use ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w2', 'bridge', SEED_PICK);
  await goMass(page, 'w2');
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w2 recording state slow'));
  const during = await page.evaluate(() => ({
    order: window.__order.slice(),
    timer: (document.getElementById('mass-homily-timer') || {}).textContent || '',
  }));
  ok(during.order.indexOf('applyAudioInput') >= 0 && during.order.indexOf('gum') > during.order.indexOf('applyAudioInput'),
    'W2a: applyAudioInput stands BEFORE getUserMedia in the call order (Plan D5)', during.order.join(' · '));
  ok(during.timer.includes('Microphone: Ray-Ban Meta glasses'),
    'W2b: the recording card names the microphone in use (M3)', during.timer);
  await sleep(1200);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  const after = await page.evaluate(() => window.__order.slice());
  ok(!!take && take.state === 'ready', 'W2c: the take lands on-device exactly as v551\u2019s', take ? take.name : 'no take');
  ok(after.includes('clearAudioInput'), 'W2d: stop releases the route — clearAudioInput called (Plan D2)', after.join(' · '));
  await ctx.close();
}

/* ---------------- W5: the System default pick steers nothing ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w5', 'bridge');
  await goMass(page, 'w5');
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w5 recording state slow'));
  const during = await page.evaluate(() => ({
    order: window.__order.slice(),
    timer: (document.getElementById('mass-homily-timer') || {}).textContent || '',
  }));
  ok(!during.order.includes('applyAudioInput') && during.order.includes('gum'),
    'W5a: with System default picked, no steering call stands against the bridge and capture proceeds', during.order.join(' · '));
  ok(during.timer.includes('Microphone: System default'),
    'W5b: the recording card names "Microphone: System default"', during.timer);
  await sleep(800);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready', 'W5c: the take lands', take ? take.name : 'no take');
  await ctx.close();
}

/* ---------------- W3: the picked mic is not there ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w3', 'missing', SEED_PICK);
  await goMass(page, 'w3');
  const row0 = await page.evaluate(() => (document.querySelector('.homily-mic-name') || {}).textContent || null);
  ok(row0 === 'Ray-Ban Meta glasses', 'W3a: the row names the remembered glasses', row0);
  await page.click('#mass-homily-mic-change');
  await page.waitForSelector('.homily-mic-list', { timeout: 8000 }).catch(() => console.log('note - w3 list slow'));
  const items = await page.evaluate(() => Array.from(document.querySelectorAll('[data-homily-mic]')).map((b) => ({
    name: (b.querySelector('.homily-mic-item-name') || {}).textContent || '',
    note: (b.querySelector('.meta') || {}).textContent || '',
  })));
  const glassesRow = items.find((i) => i.name.includes('Ray-Ban Meta glasses'));
  ok(!!glassesRow && glassesRow.note === 'Not connected.',
    'W3b: the absent remembered device stands in the list marked "Not connected" (M2 dress)', JSON.stringify(items));
  await page.click('#mass-homily-mic-change');
  await sleep(300);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w3 recording state slow'));
  const during = await page.evaluate(() => ({
    order: window.__order.slice(),
    note: (document.querySelector('.homily-mic-note') || {}).textContent || null,
    recording: !!document.getElementById('mass-homily-stop'),
  }));
  ok(during.note === 'Ray-Ban Meta glasses not connected \u2014 recording from the phone microphone.',
    'W3c: the fallback notice stands on the card before capture (Q5 A, M3 words)', during.note);
  ok(during.recording && during.order.indexOf('gum') > during.order.indexOf('applyAudioInput'),
    'W3d: capture proceeds from the fallback — never blocked', during.order.join(' · '));
  await sleep(800);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready', 'W3e: the fallback take lands', take ? take.name : 'no take');
  await ctx.close();
}

/* ---------------- W4: no bridge — v551 parity ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w4', 'none');
  ok(errs.length === 0, 'W4-0: boot clean in the bridge-absent world — no page errors', errs.join(' · '));
  await goMass(page, 'w4');
  const row0 = await page.evaluate(() => ({
    name: (document.querySelector('.homily-mic-name') || {}).textContent || null,
    change: !!document.getElementById('mass-homily-mic-change'),
  }));
  ok(row0.name === 'System default' && !row0.change,
    'W4a: without the bridge the row reads "System default" and no Change act stands', JSON.stringify(row0));
  const fetchBefore = await page.evaluate(() => window.__fetchLog.length);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w4 recording state slow'));
  await sleep(1000);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  const fetchAfter = await page.evaluate(() => window.__fetchLog.length);
  ok(!!take && take.state === 'ready', 'W4b: record → stop lands the take exactly as v551\u2019s', take ? take.name : 'no take');
  ok(fetchAfter === fetchBefore, 'W4c: the whole capture issued ZERO network requests (Q1 C)', 'fetches ' + fetchBefore + ' → ' + fetchAfter);
  await ctx.close();
}

await browser.close();
srv.close();
console.log('');
console.log('harness-v557: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); failures.forEach((f) => console.log(' -', f)); }
process.exit(fail ? 1 : 0);
