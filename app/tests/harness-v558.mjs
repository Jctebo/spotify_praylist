// harness-v558.mjs — v558 evidence: Microphone list
// cleanup — one row per real input, friendly names
// (production-defect fix-forward on v557; John's field
// screenshot, main chat, 2026-11-20 15:32 CT: the v557
// list on his Galaxy Z Fold 8 showed SM-F971U1 four
// times). The approved shape is v557's (Q4 A friendly
// names; Plan D4: built-in → "Phone microphone", one row
// per real input) — this fix restores it.
//   Cause (proven in the shipped code): the bridge
//     returns AudioManager's raw input enumeration —
//     the one built-in mic stands as several entries
//     (two of kind "builtin", two of an unmapped kind,
//     all named SM-F971U1) — and the v557 client rendered
//     one row per raw entry.
//   Fix (Plan D1/D2/D3): the dedupe lives in the client
//     as a view rule over the raw list — homilyMicRows()
//     merges every built-in entry (plus an unmapped-kind
//     entry carrying a built-in entry's name) into one
//     "Phone microphone" row; every other entry groups
//     by its bridge key. A row carries every raw key it
//     covers; the stored pick resolves through any of
//     them and migrates in place on list load
//     (homilyMicMigratePick). The bridge, its keys, the
//     steering calls, capture, and the Q5 A fallback are
//     v557's, unchanged — no APK.
//   S statics: the diff against the production base
//     (GitHub main ba08a73 — the v557 ship tree) confined
//     to client.ts + the release document + this
//     harness · index.ts AND ui.ts byte-identical (no
//     style change; the SW pin unmoved) · migrations end
//     at 0042 · the homily + microphone module holds no
//     network call · the v558 seams stand (homilyMicRows
//     grouping · the migrate call on list load · the
//     capture and steering seams v557's).
//   Worlds (Chromium, stubbed fetch, the v551/v557 mold;
//     the fake OraDayBridge is the harness's own fixture
//     carrying ONLY listAudioInputs / applyAudioInput /
//     clearAudioInput + the standing shell methods):
//     W1 "john" world — the bridge returns John's raw
//       list shape (fixture below): the open list renders
//       exactly 3 rows — System default · Phone
//       microphone · Bluetooth microphone — with the
//       built-in and call-quality sub-lines standing,
//       and the Phone row's key is the first built-in
//       entry's key.
//     W2 "named" world — a Bluetooth device whose own
//       product name the bridge returns renders under
//       that name.
//     W3 "john" world + a pick stored against an
//       unmapped-kind merged entry (key t18:SM-F971U1,
//       name SM-F971U1): the Phone row stands current, no
//       "Not connected" row stands, and after the list
//       loads the stored pick reads back migrated to the
//       canonical key + "Phone microphone"; the card row
//       names "Phone microphone".
//     W4 "john" world — steering unchanged: tapping the
//       Phone row stores the canonical key and Record
//       applies it before capture; a Bluetooth pick
//       applies its own key; stop clears the route; the
//       takes land as v551's.
//     W5 "john" world + a pick for an absent Bluetooth
//       device: the "Not connected" row stands, the
//       stored pick is NOT migrated, Record falls back
//       with the Q5 A notice and capture proceeds.
//     W6 bridge-absent world: v551 parity — the row
//       reads System default, no Change act, record →
//       stop lands the take with zero fetches.
// Fixtures (Improvement D): the day payload is the LIVE
// production payload tests/fixtures-v522/day-live-2026-11-17.json
// re-seated exactly as harness-v551/v557 re-seat it; the
// Mass payload + readings feed stand in the v511/v551
// production shape. The device-list fixture is shaped
// from John's field screenshot (the client's view of the
// bridge list: keys, names, kinds — the raw Android
// types behind the two unmapped-kind entries are not
// observable from the client; the fixture carries them
// as two distinct unmapped keys, t18/t16, and the two
// built-in entries share the one key the bridge's
// type+name keying gives them, t25:SM-F971U1).
// Run: node app/tests/harness-v558.mjs [--probe] (from
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
const BASE = 'ba08a73';
const gitShow = (p) => execFileSync('git', ['show', BASE + ':' + p], { cwd: ROOT, encoding: 'utf8' });

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
const JOHN_BT_KEY = 'bt:11:22:33:44:55:66';
const BUILTIN_KEY = 't25:SM-F971U1';
const JOHN_DEVICES = [
  { key: BUILTIN_KEY, name: 'SM-F971U1', kind: 'builtin' },
  { key: BUILTIN_KEY, name: 'SM-F971U1', kind: 'builtin' },
  { key: 't18:SM-F971U1', name: 'SM-F971U1', kind: 'other' },
  { key: 't16:SM-F971U1', name: 'SM-F971U1', kind: 'other' },
  { key: JOHN_BT_KEY, name: 'Bluetooth microphone', kind: 'bluetooth' },
];
const NAMED_DEVICES = [
  { key: BUILTIN_KEY, name: 'SM-F971U1', kind: 'builtin' },
  { key: GLASSES_KEY, name: 'Ray-Ban Meta glasses', kind: 'bluetooth' },
];
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
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'releases/v558-microphone-list-cleanup.md' || p.startsWith('app/tests/harness-v558')),
    'S1a: the tracked diff against the production base is confined to client.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v558') || p === 'releases/v558-microphone-list-cleanup.md'),
    'S1b: the only untracked paths are the harness, its logs, and the release document', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (no server change of any kind)');
  ok(U_SRC === gitShow('app/worker/src/ui.ts'), 'S2b: ui.ts byte-identical to the base (no style change — the merged rows reuse the standing list dress; the SW pin is unmoved)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2c: migration 0042 stands last (no migration)', migs.slice(-2).join(','));
  const modStart = C_SRC.indexOf('v551 homily recording (Q1 C');
  const modEnd = C_SRC.indexOf('function openSlotPicker(', modStart);
  const MOD = C_SRC.slice(modStart, modEnd);
  ok(modStart > 0 && modEnd > modStart && !/api\('|api\("|fetch\(|XMLHttpRequest|method:\s*'PUT'|method:\s*"PUT"|['"]\/api\//.test(MOD),
    'S3: the homily + microphone module issues no network call of any kind (no api(), no fetch, no PUT, no /api/ path — Q1 C stands)');
  const rowsFn = fnBody(C_SRC, 'homilyMicRows') || '';
  ok(rowsFn.includes("d.kind === 'builtin'") && rowsFn.includes('builtinNames[d.name]') && rowsFn.includes("name: 'Phone microphone'") && rowsFn.includes('phone.builtinKey || phone.keys[0]'),
    'S4a: homilyMicRows merges the built-in entries (kind rule + the unmapped-kind name match) into one "Phone microphone" row whose key is the first true built-in entry\u2019s');
  ok((fnBody(C_SRC, 'homilyMicMigratePick') || '').includes('homilyMicPickSave') && (fnBody(C_SRC, 'homilyMicOpenList') || '').includes('homilyMicMigratePick()'),
    'S4b: the stored pick migrates in place on list load (homilyMicMigratePick, called by homilyMicOpenList)');
  ok(MOD.includes("var HOMILY_MIC_KEY = 'opn-homily-mic-v557'") && MOD.includes("rows = [{ key: 'default', name: 'System default'"),
    'S4c: the pick store key is v557\u2019s, unchanged, and System default stands first in the list (Q4 A)');
  const start = fnBody(C_SRC, 'homilyStartRecord') || '';
  ok(start.includes('homilyMicPrepare()') && start.includes('homilyStartCapture()') && (fnBody(C_SRC, 'homilyStartCapture') || '').includes('getUserMedia({ audio: true })'),
    'S4d: the capture path is v551/v557\u2019s, unchanged — prepare before capture, getUserMedia({ audio: true }), no deviceId');
  const prep = fnBody(C_SRC, 'homilyMicPrepare') || '';
  ok(prep.includes('applyAudioInput') && prep.includes('fellBack') && prep.includes('not connected')
    && (fnBody(C_SRC, 'homilyFinishRecord') || '').includes('homilyMicRelease()') && (fnBody(C_SRC, 'homilyAbortRecord') || '').includes('homilyMicRelease()'),
    'S4e: the steering seams are v557\u2019s — apply with the Q5 A fallback notice; release on finish + abort');
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
  const devices = world === 'john' ? JOHN_DEVICES : world === 'named' ? NAMED_DEVICES : [];
  const bridgeStub = world === 'none' ? '' : `
window.Capacitor = { Plugins: { OraDayBridge: {
  setDaySnapshot: function () { return Promise.resolve({}); },
  setStatusBarColor: function () { return Promise.resolve({}); },
  addListener: function () { return Promise.resolve({ remove: function () {} }); },
  listAudioInputs: function () { window.__order.push('listAudioInputs'); return Promise.resolve({ devices: ${JSON.stringify(devices)} }); },
  applyAudioInput: function (args) {
    window.__order.push('applyAudioInput');
    window.__applied.push(args && args.key);
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
window.__applied = [];
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
const PAGES = { john: buildPage('john'), named: buildPage('named'), none: buildPage('none') };
const srv = http.createServer((req, res) => {
  const w = ((req.url || '/').split('?')[0].split('/')[1]) || 'none';
  if (PAGES[w]) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGES[w]); }
  else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + srv.address().port;
const SEED_OTHER_PICK = `try { localStorage.setItem('opn-homily-mic-v557', JSON.stringify({ key: 't18:SM-F971U1', name: 'SM-F971U1' })); } catch (e) {}`;
const SEED_ABSENT_PICK = `try { localStorage.setItem('opn-homily-mic-v557', JSON.stringify({ key: '${GLASSES_KEY}', name: 'Ray-Ban Meta glasses' })); } catch (e) {}`;

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
async function openMicList(page, tag) {
  await page.click('#mass-homily-mic-change');
  await page.waitForSelector('.homily-mic-list', { timeout: 8000 }).catch(() => console.log('note -', tag, 'mic list slow'));
  await sleep(300);
}
async function micItems(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-homily-mic]')).map((b) => ({
    key: b.getAttribute('data-homily-mic'),
    name: (b.querySelector('.homily-mic-item-name') || {}).textContent || '',
    note: (b.querySelector('.meta') || {}).textContent || '',
    on: b.className.includes(' on'),
  })));
}
async function takeReady(page) {
  await page.waitForFunction(() => {
    try { const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); return idx.length === 1 && idx[0].state === 'ready'; } catch (e) { return false; }
  }, null, { timeout: 10000 }).catch(() => console.log('note - take save slow'));
  return page.evaluate(() => { const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); return idx[0] || null; });
}

/* ---------------- W1: John's raw list renders 3 rows ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w1', 'john');
  ok(errs.length === 0, 'W1-0: boot clean in the john world — no page errors', errs.join(' · '));
  await goMass(page, 'w1');
  const row0 = await page.evaluate(() => ({
    name: (document.querySelector('.homily-mic-name') || {}).textContent || null,
    change: !!document.getElementById('mass-homily-mic-change'),
  }));
  ok(row0.name === 'System default' && row0.change,
    'W1a: the record card paints the microphone row at "System default" with a Change act', JSON.stringify(row0));
  await openMicList(page, 'w1');
  const items = await micItems(page);
  ok(items.length === 3 && items[0].key === 'default' && items[0].name.includes('System default') && items[0].on,
    'W1b: the raw list of five entries renders exactly 3 rows — System default first and current', JSON.stringify(items.map((i) => i.name)));
  ok(items.length === 3 && items[1].name === 'Phone microphone' && items[1].note === 'This device\u2019s built-in microphone.' && items[1].key === BUILTIN_KEY,
    'W1c: the four SM-F971U1 entries merge into ONE "Phone microphone" row with the built-in sub-line; its key is the first built-in entry\u2019s', JSON.stringify(items[1] || null));
  ok(items.length === 3 && items[2].name === 'Bluetooth microphone' && items[2].note.includes('Records at call quality') && items[2].key === JOHN_BT_KEY,
    'W1d: the Bluetooth entry stands as its own row with the call-quality note', JSON.stringify(items[2] || null));
  await ctx.close();
}

/* ---------------- W2: a named Bluetooth device renders its name ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w2', 'named');
  await goMass(page, 'w2');
  await openMicList(page, 'w2');
  const items = await micItems(page);
  ok(items.length === 3 && items[1].name === 'Phone microphone' && items[2].name === 'Ray-Ban Meta glasses',
    'W2: a Bluetooth device whose own product name the bridge returns renders under that name; the built-in entry still merges to "Phone microphone"', JSON.stringify(items.map((i) => i.name)));
  await ctx.close();
}

/* ---------------- W3: a pick stored against a merged entry resolves + migrates ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w3', 'john', SEED_OTHER_PICK);
  await goMass(page, 'w3');
  const before = await page.evaluate(() => (document.querySelector('.homily-mic-name') || {}).textContent || null);
  ok(before === 'SM-F971U1', 'W3a: before the list opens, the card row carries the legacy stored name (the pick as v557 left it)', before);
  await openMicList(page, 'w3');
  const items = await micItems(page);
  const phoneRow = items.find((i) => i.name.includes('Phone microphone'));
  ok(!!phoneRow && phoneRow.on && !items.some((i) => i.note === 'Not connected.'),
    'W3b: the pick stored against a merged entry marks the Phone microphone row current — no "Not connected" row stands', JSON.stringify(items.map((i) => [i.name, i.on])));
  const after = await page.evaluate(() => ({
    stored: JSON.parse(localStorage.getItem('opn-homily-mic-v557') || 'null'),
    row: (document.querySelector('.homily-mic-name') || {}).textContent || null,
  }));
  ok(after.stored && after.stored.key === BUILTIN_KEY && after.stored.name === 'Phone microphone' && after.row === 'Phone microphone',
    'W3c: on list load the stored pick migrated in place to the canonical key + "Phone microphone", and the card row names it', JSON.stringify(after));
  await ctx.close();
}

/* ---------------- W4: steering unchanged — phone row, then Bluetooth ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w4', 'john');
  await goMass(page, 'w4');
  await openMicList(page, 'w4');
  await page.click('[data-homily-mic="' + BUILTIN_KEY + '"]');
  await sleep(400);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('opn-homily-mic-v557') || 'null'));
  ok(stored && stored.key === BUILTIN_KEY && stored.name === 'Phone microphone',
    'W4a: tapping the Phone row stores the canonical built-in key under the friendly name', JSON.stringify(stored));
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w4 recording state slow'));
  const during = await page.evaluate(() => ({ order: window.__order.slice(), applied: window.__applied.slice() }));
  ok(during.applied[0] === BUILTIN_KEY && during.order.indexOf('gum') > during.order.indexOf('applyAudioInput'),
    'W4b: Record applies the canonical built-in key BEFORE capture opens (steering unchanged)', JSON.stringify(during));
  await sleep(900);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  const after = await page.evaluate(() => window.__order.slice());
  ok(!!take && take.state === 'ready' && after.includes('clearAudioInput'),
    'W4c: the take lands as v551\u2019s and stop releases the route', take ? take.name : 'no take');
  await ctx.close();
}
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w4bt', 'john');
  await goMass(page, 'w4bt');
  await openMicList(page, 'w4bt');
  await page.click('[data-homily-mic="' + JOHN_BT_KEY + '"]');
  await sleep(400);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w4bt recording state slow'));
  const during = await page.evaluate(() => ({ order: window.__order.slice(), applied: window.__applied.slice() }));
  ok(during.applied[0] === JOHN_BT_KEY && during.order.indexOf('gum') > during.order.indexOf('applyAudioInput'),
    'W4d: a Bluetooth pick applies its own unchanged key before capture', JSON.stringify(during));
  await sleep(900);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready', 'W4e: the Bluetooth-picked take lands', take ? take.name : 'no take');
  await ctx.close();
}

/* ---------------- W5: the picked mic is not there — Q5 A stands ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w5', 'john', SEED_ABSENT_PICK);
  await goMass(page, 'w5');
  const row0 = await page.evaluate(() => (document.querySelector('.homily-mic-name') || {}).textContent || null);
  ok(row0 === 'Ray-Ban Meta glasses', 'W5a: the row names the remembered glasses', row0);
  await openMicList(page, 'w5');
  const items = await micItems(page);
  const absentRow = items.find((i) => i.name.includes('Ray-Ban Meta glasses'));
  ok(!!absentRow && absentRow.note === 'Not connected.',
    'W5b: the absent remembered device stands in the list marked "Not connected"', JSON.stringify(items.map((i) => [i.name, i.note])));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('opn-homily-mic-v557') || 'null'));
  ok(stored && stored.key === GLASSES_KEY,
    'W5c: a pick that matches no row is NOT migrated — it stands exactly as stored', JSON.stringify(stored));
  await page.click('#mass-homily-mic-change');
  await sleep(300);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w5 recording state slow'));
  const during = await page.evaluate(() => ({
    order: window.__order.slice(),
    note: (document.querySelector('.homily-mic-note') || {}).textContent || null,
    recording: !!document.getElementById('mass-homily-stop'),
  }));
  ok(during.note === 'Ray-Ban Meta glasses not connected \u2014 recording from the phone microphone.',
    'W5d: the fallback notice stands on the card before capture (Q5 A)', during.note);
  ok(during.recording && during.order.indexOf('gum') > during.order.indexOf('applyAudioInput'),
    'W5e: capture proceeds from the fallback — never blocked', during.order.join(' · '));
  await sleep(800);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready', 'W5f: the fallback take lands', take ? take.name : 'no take');
  await ctx.close();
}

/* ---------------- W6: no bridge — v551 parity ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w6', 'none');
  ok(errs.length === 0, 'W6-0: boot clean in the bridge-absent world — no page errors', errs.join(' · '));
  await goMass(page, 'w6');
  const row0 = await page.evaluate(() => ({
    name: (document.querySelector('.homily-mic-name') || {}).textContent || null,
    change: !!document.getElementById('mass-homily-mic-change'),
  }));
  ok(row0.name === 'System default' && !row0.change,
    'W6a: without the bridge the row reads "System default" and no Change act stands', JSON.stringify(row0));
  const fetchBefore = await page.evaluate(() => window.__fetchLog.length);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w6 recording state slow'));
  await sleep(1000);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  const fetchAfter = await page.evaluate(() => window.__fetchLog.length);
  ok(!!take && take.state === 'ready', 'W6b: record → stop lands the take exactly as v551\u2019s', take ? take.name : 'no take');
  ok(fetchAfter === fetchBefore, 'W6c: the whole capture issued ZERO network requests (Q1 C)', 'fetches ' + fetchBefore + ' → ' + fetchAfter);
  await ctx.close();
}

await browser.close();
srv.close();
console.log('');
console.log('harness-v558: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); failures.forEach((f) => console.log(' -', f)); }
process.exit(fail ? 1 : 0);
