// harness-v560.mjs — v560 evidence: Homily note box
// (John's direction, Ora thread, 2026-11-20 15:54 CT:
// "Also maybe add a brief note box underneath the
// recording in case I want to jot something down. Note
// stored in honiles as a non audio file"; approved
// 2026-11-20 16:06 CT, package 56: Q1 C · Q2 A ·
// Q3 A · Q4 A · Q5 A · Q6 A · Q7 B · To Ship).
//   The shape (Plan D1–D6): the note is one brief
//     plain-text field on the homily's own device-local
//     index entry (opn-homilies-v551), written only
//     through homilyEntrySave — the save step the
//     played mark and the star already use. Local only
//     (v551 Q1 C): no server row, no fetch, no upload.
//     Two seats, one note (Q1 C): the box at the record
//     card after the take (never during recording —
//     Q6 A), and the Homilies list, where a standing
//     note shows in full under its entry (Q4 A) and an
//     entry with no note carries one quiet "Add a
//     note" act (Q5 A). Editing rides the rename-sheet
//     pattern. Deleting a homily takes its note with
//     it. Web-only: no migration, no APK.
//   S statics: the diff against the production base
//     (GitHub main 6d538dd — the v559 ship tree +
//     doc closeout) confined to client.ts + ui.ts +
//     the release document + this harness · index.ts
//     byte-identical · the ui.ts diff is pure added
//     .homily-note rules with the SW pin unmoved (it
//     moves only at Ship) · migrations end at 0042 ·
//     the homily module holds no network call · the
//     fenced WebView functions stand byte-identical
//     (homilyAbortRecord · homilyMicPrepare ·
//     homilyMicRelease · homilyMimePick) · the note
//     seams stand as planned (entry literals open
//     note:'' · both finishes seat the card's note ·
//     homilyDescFor carries no note field).
//   Worlds (Chromium, stubbed fetch, the v551/v559
//     mold; the fake OraDayBridge is the harness's own
//     fixture):
//     W1 native world: no box at rest before a take;
//       no box while recording (Q6 A); the take lands
//       → the box stands at the card (M3 dress) → Save
//       note writes the entry's note in localStorage
//       with ZERO fetches; the card then shows the note
//       in full and Edit note reopens the box prefilled;
//       the Homilies list shows the same note in full
//       under the entry (Q4 A).
//     W2 native world, the list seat: a ready entry
//       with no note shows "＋ Add a note" and no box
//       (Q5 A); the editor saves the note; the ⋮ menu
//       reads Edit note and reopens the editor
//       prefilled (one note — Q2 A); clearing the box
//       returns the Add act; Delete removes the entry
//       and its note with it.
//     W3 bridge-absent world: the WebView take lands
//       and the card seats the box exactly as the
//       native world's — the card seat does not depend
//       on the capture path; capture + note issue ZERO
//       network requests (Q1 C).
//   The note's look on John's phone is a field leg,
//     not a harness claim.
// Fixtures (Improvement D): the day payload is the
// LIVE production payload
// tests/fixtures-v522/day-live-2026-11-17.json
// re-seated exactly as harness-v559.mjs re-seats it;
// the Mass payload + readings feed stand in the
// v511/v551 production shape; the note texts are the
// approved package 56 mockup M1's own note, verbatim
// ("On gratitude — the widow's mite." / "Ask Pam
// about the food drive."); homily entries stand in
// the shipped code's own entry shape (the
// homilyStartNative / homilyStartCapture literals at
// GitHub main 6d538dd).
// Run: node app/tests/harness-v560.mjs [--probe]
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
const BASE = '6d538dd';
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
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'app/worker/src/ui.ts' || p === 'releases/v560-homily-note-box.md' || p.startsWith('app/tests/harness-v560')),
    'S1a: the tracked diff against the production base is confined to client.ts + ui.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v560') || p === 'releases/v560-homily-note-box.md'),
    'S1b: the only untracked paths are the harness, its logs, and the release document', untracked.join(','));
  ok(I_SRC === gitShow('app/worker/src/index.ts'), 'S2a: index.ts byte-identical to the base (no server change of any kind)');
  const uiDiff = execFileSync('git', ['diff', BASE, '--', 'app/worker/src/ui.ts'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
  const uiRemoved = uiDiff.filter((l) => l.startsWith('-') && !l.startsWith('---'));
  const uiAdded = uiDiff.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  let inComment = false;
  const uiAddedOk = uiAdded.every((l) => {
    if (l.includes('.homily-note')) return true;
    if (inComment) { if (/\*\//.test(l)) inComment = false; return true; }
    if (/^\s*\/\*/.test(l)) { if (!/\*\//.test(l)) inComment = true; return true; }
    return l.trim() === '';
  });
  ok(uiRemoved.length === 0 && uiAdded.length > 0 && uiAddedOk,
    'S2b: the ui.ts diff is pure added .homily-note style rules (no line removed or changed)', uiAdded.slice(0, 3).join(' | '));
  ok(U_SRC.includes('var CACHE = "ora-pro-nobis-v559-1";'), 'S2c: the SW pin still reads v559-1 on the build tree (it moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2d: migration 0042 stands last (no migration)', migs.slice(-2).join(','));
  const modStart = C_SRC.indexOf('v551 homily recording (Q1 C');
  const modEnd = C_SRC.indexOf('function openSlotPicker(', modStart);
  const MOD = C_SRC.slice(modStart, modEnd);
  ok(modStart > 0 && modEnd > modStart && !/api\('|api\("|fetch\(|XMLHttpRequest|method:\s*'PUT'|method:\s*"PUT"|['"]\/api\//.test(MOD),
    'S3: the homily + microphone + native + note module issues no network call of any kind (Q1 C stands)');
  const setNote = fnBody(C_SRC, 'homilySetNote') || '';
  ok(setNote.includes('homilyEntrySave(e)') && setNote.includes('.trim()') && setNote.includes('e.note ='),
    'S4a: homilySetNote writes the trimmed text to the entry note field through homilyEntrySave (Plan D1/D2)');
  const noteOf = fnBody(C_SRC, 'homilyNoteOf') || '';
  ok(noteOf.includes("typeof e.note === 'string'") && noteOf.includes("''"),
    'S4b: homilyNoteOf reads a pre-v560 entry (no note field) as empty (Plan D1)');
  const noteLits = (C_SRC.match(/partial: false, note: ''/g) || []).length;
  ok(noteLits === 2, 'S4c: both capture paths open the entry with note:\'\' (native + WebView literals)', 'count=' + noteLits);
  const finN = fnBody(C_SRC, 'homilyFinishNative') || '';
  const finR = fnBody(C_SRC, 'homilyFinishRecord') || '';
  ok(finN.includes('homilyNoteCardId = entry.id') && finR.includes('homilyNoteCardId = entry.id'),
    'S4d: both finish paths seat the record card note box on the just-saved entry (Plan D3)');
  const start = fnBody(C_SRC, 'homilyStartRecord') || '';
  ok(start.includes('homilyNoteCardId = \'\';') || start.includes('homilyNoteCardId = "";'),
    'S4e: a new recording start clears the card note seat');
  const card = fnBody(C_SRC, 'massHomilyCardInner') || '';
  const iRec = card.indexOf('if (homilyRec)');
  const iRest = card.indexOf('mass-homily-rec');
  ok(iRec >= 0 && iRest > iRec && !card.slice(iRec, iRest).includes('homilyNoteCardHtml') && (card.match(/homilyNoteCardHtml\(\)/g) || []).length === 1,
    'S4f: the note box seats only in the card rest branch — the recording state carries no box (Q6 A)');
  const row = fnBody(C_SRC, 'homilyRowHtml') || '';
  ok(row.includes('homilyNoteRowHtml(e)'), 'S4g: the Homilies row paints its note block (Plan D4)');
  const rowNote = fnBody(C_SRC, 'homilyNoteRowHtml') || '';
  ok(rowNote.includes('homily-note-text') && rowNote.includes('Add a note') && rowNote.includes('data-homilynote'),
    'S4h: the row note dress — the note in full when standing, the Add a note act when empty (Q4 A · Q5 A)');
  const menu = fnBody(C_SRC, 'openHomilyMenu') || '';
  ok(menu.includes("'Edit note'") && menu.includes("'Add note'") && menu.includes('openHomilyNoteEditor(e)'),
    'S4i: the row menu carries the note act — Edit note, or Add note while empty (Plan D4)');
  const editor = fnBody(C_SRC, 'openHomilyNoteEditor') || '';
  ok(editor.includes('<textarea') && editor.includes('homilySetNote(e.id') && editor.includes('data-note-save'),
    'S4j: the note editor is a sheet with a multi-line box saving through homilySetNote (Q3 A, the rename-sheet pattern)');
  const desc = fnBody(C_SRC, 'homilyDescFor') || '';
  ok(desc !== '' && !desc.includes('note'), 'S4k: the descriptor carries no note field — the note never enters playback or the queue (Plan D6)');
  ['homilyAbortRecord', 'homilyMicPrepare', 'homilyMicRelease', 'homilyMimePick'].forEach((fn) => {
    ok(fnBody(C_SRC, fn) !== null && fnBody(C_SRC, fn) === fnBody(B_C, fn),
      'S4l: ' + fn + ' is byte-identical to the base (fenced by Plan D6)');
  });
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

const NOTE_A = 'On gratitude \u2014 the widow\u2019s mite.';
const NOTE_A2 = 'On gratitude \u2014 the widow\u2019s mite. Ask Pam about the food drive.';
const NOTE_B = 'Ask Pam about the food drive.';
async function menuLabels560(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.anchmenu [data-menuitem]')).map((b) => b.textContent.trim()));
}
async function clickMenuItem560(page, label) {
  await page.evaluate((l) => {
    const b = Array.from(document.querySelectorAll('.anchmenu [data-menuitem]')).find((x) => x.textContent.trim() === l);
    if (b) b.click();
  }, label);
  await sleep(400);
}
async function goHomilies(page) {
  await page.click('[data-tab="podcasts"]');
  await sleep(700);
  await page.evaluate(() => { const b = document.querySelector('#sidetoggle [data-side="homilies"]'); if (b) b.click(); });
  await sleep(600);
}
async function entryNote(page, id) {
  return page.evaluate((x) => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    const e = idx.find((y) => y.id === x);
    return e ? (typeof e.note === 'string' ? e.note : null) : undefined;
  }, id);
}

/* ---------------- W1: native world — the record-card seat ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w1', 'native');
  ok(errs.length === 0, 'W1-0: boot clean in the native world — no page errors', errs.join(' · '));
  await goMass(page, 'w1');
  const rest0 = await page.evaluate(() => ({
    field: !!document.getElementById('mass-homily-note-field'),
    block: !!document.querySelector('#mass-homily-host .homily-note'),
  }));
  ok(!rest0.field && !rest0.block, 'W1a: at rest before any take, no note box stands at the record card', JSON.stringify(rest0));
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w1 recording state slow'));
  await sleep(500);
  const during = await page.evaluate(() => ({
    field: !!document.getElementById('mass-homily-note-field'),
    block: !!document.querySelector('#mass-homily-host .homily-note'),
  }));
  ok(!during.field && !during.block, 'W1b: while recording, NO note box stands on the card (Q6 A)', JSON.stringify(during));
  await sleep(700);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready', 'W1c: the native take lands', take ? take.name : 'no take');
  await page.waitForSelector('#mass-homily-note-field', { timeout: 8000 }).catch(() => console.log('note - w1 note box slow'));
  const seated = await page.evaluate(() => ({
    field: !!document.getElementById('mass-homily-note-field'),
    save: !!document.getElementById('mass-homily-note-save'),
    label: (document.querySelector('#mass-homily-host .homily-note-label') || {}).textContent || '',
  }));
  ok(seated.field && seated.save && seated.label === 'Note', 'W1d: after the take the box stands at the card in the M3 dress — Note label, box, Save note (Q1 C · Q6 A)', JSON.stringify(seated));
  const fetchBefore = await page.evaluate(() => window.__fetchLog.length);
  await page.fill('#mass-homily-note-field', NOTE_A);
  await page.click('#mass-homily-note-save');
  await sleep(500);
  const savedNote = await entryNote(page, take.id);
  ok(savedNote === NOTE_A, 'W1e: Save note writes the text to the entry note field in the on-device index', JSON.stringify(savedNote));
  const cardAfter = await page.evaluate(() => ({
    text: (document.querySelector('#mass-homily-host .homily-note-text') || {}).textContent || '',
    edit: !!document.getElementById('mass-homily-note-edit'),
    field: !!document.getElementById('mass-homily-note-field'),
  }));
  ok(cardAfter.text === NOTE_A && cardAfter.edit && !cardAfter.field,
    'W1f: the card then shows the note in full with an Edit note act — the box folds away', JSON.stringify(cardAfter));
  const fetchAfter = await page.evaluate(() => window.__fetchLog.length);
  ok(fetchAfter === fetchBefore, 'W1g: the whole note flow issued ZERO network requests (Local only — Q1 C)', 'fetches ' + fetchBefore + ' → ' + fetchAfter);
  await page.click('#mass-homily-note-edit');
  await sleep(400);
  const prefill = await page.evaluate(() => (document.getElementById('mass-homily-note-field') || {}).value || '');
  ok(prefill === NOTE_A, 'W1h: Edit note reopens the box prefilled with the standing note (one note, two seats)', prefill);
  await page.fill('#mass-homily-note-field', NOTE_A2);
  await page.click('#mass-homily-note-save');
  await sleep(500);
  const saved2 = await entryNote(page, take.id);
  ok(saved2 === NOTE_A2, 'W1i: the edited note replaces the old — still one note per homily (Q2 A)', JSON.stringify(saved2));
  await goHomilies(page);
  const rowText = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    return r ? (r.querySelector('.homily-note-text') || {}).textContent || null : null;
  }, take.id);
  ok(rowText === NOTE_A2, 'W1j: the Homilies list shows the same note in full under the entry (Q4 A)', rowText);
  await ctx.close();
}

/* ---------------- W2: native world — the list seat ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w2', 'native');
  await goMass(page, 'w2');
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w2 recording state slow'));
  await sleep(900);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready', 'W2a: the take lands (its entry opens with an empty note)', take ? take.name : 'no take');
  const opened = await entryNote(page, take.id);
  ok(opened === '', 'W2b: a new entry carries note:\'\' — the empty state', JSON.stringify(opened));
  await goHomilies(page);
  const row0 = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    if (!r) return null;
    const add = r.querySelector('[data-homilynote]');
    return { add: add ? add.textContent.trim() : null, text: (r.querySelector('.homily-note-text') || {}).textContent || null, box: !!r.querySelector('textarea') };
  }, take.id);
  ok(!!row0 && row0.add === '\uFF0B Add a note' && !row0.text && !row0.box,
    'W2c: an entry with no note shows one quiet Add a note act — no empty box, no note text (Q5 A)', JSON.stringify(row0));
  await page.click('[data-homilynote="' + take.id + '"]');
  await page.waitForSelector('#homily-note-field', { timeout: 8000 }).catch(() => console.log('note - w2 editor slow'));
  await page.fill('#homily-note-field', NOTE_B);
  await page.click('[data-note-save]');
  await sleep(600);
  const savedB = await entryNote(page, take.id);
  const row1 = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    return r ? (r.querySelector('.homily-note-text') || {}).textContent || null : null;
  }, take.id);
  ok(savedB === NOTE_B && row1 === NOTE_B, 'W2d: the editor saves the note; the row shows it in full (Q1 C · Q4 A)', JSON.stringify({ saved: savedB, row: row1 }));
  await page.click('[data-homilymenu="' + take.id + '"]');
  await sleep(400);
  const labels = await menuLabels560(page);
  ok(labels.includes('Edit note'), 'W2e: with a note standing, the row menu carries Edit note', labels.join(' · '));
  await clickMenuItem560(page, 'Edit note');
  await page.waitForSelector('#homily-note-field', { timeout: 8000 }).catch(() => console.log('note - w2 editor reopen slow'));
  const prefill = await page.evaluate(() => (document.getElementById('homily-note-field') || {}).value || '');
  ok(prefill === NOTE_B, 'W2f: the editor reopens prefilled with the standing note (one note — Q2 A)', prefill);
  await page.fill('#homily-note-field', '');
  await page.click('[data-note-save]');
  await sleep(600);
  const cleared = await entryNote(page, take.id);
  const row2 = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    if (!r) return null;
    const add = r.querySelector('[data-homilynote]');
    return { add: add ? add.textContent.trim() : null, text: (r.querySelector('.homily-note-text') || {}).textContent || null };
  }, take.id);
  ok(cleared === '' && !!row2 && row2.add === '\uFF0B Add a note' && !row2.text,
    'W2g: clearing the box empties the note and the Add a note act returns', JSON.stringify({ cleared, row: row2 }));
  await page.click('[data-homilynote="' + take.id + '"]');
  await page.waitForSelector('#homily-note-field', { timeout: 8000 }).catch(() => console.log('note - w2 editor slow 2'));
  await page.fill('#homily-note-field', NOTE_B);
  await page.click('[data-note-save]');
  await sleep(600);
  await page.click('[data-homilymenu="' + take.id + '"]');
  await sleep(400);
  await clickMenuItem560(page, 'Delete');
  await page.waitForSelector('[data-cfgo]', { timeout: 8000 }).catch(() => console.log('note - w2 confirm slow'));
  await page.click('[data-cfgo]');
  await sleep(700);
  const gone = await page.evaluate((id) => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    return { n: idx.length, row: !!document.querySelector('[data-homilyid="' + id + '"]') };
  }, take.id);
  ok(gone.n === 0 && !gone.row, 'W2h: Delete removes the homily — its note goes with it (the entry is the note\u2019s only home)', JSON.stringify(gone));
  await ctx.close();
}

/* ---------------- W3: no bridge — the WebView take seats the box too ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w3', 'none');
  ok(errs.length === 0, 'W3-0: boot clean in the bridge-absent world — no page errors', errs.join(' · '));
  await goMass(page, 'w3');
  const fetchBefore = await page.evaluate(() => window.__fetchLog.length);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w3 recording state slow'));
  await sleep(1000);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready', 'W3a: the WebView take lands exactly as v551\u2019s', take ? take.name : 'no take');
  await page.waitForSelector('#mass-homily-note-field', { timeout: 8000 }).catch(() => console.log('note - w3 note box slow'));
  const seated = await page.evaluate(() => !!document.getElementById('mass-homily-note-field') && !!document.getElementById('mass-homily-note-save'));
  ok(seated, 'W3b: the card seats the note box after a WebView take — the seat does not depend on the capture path (Plan D3)');
  await page.fill('#mass-homily-note-field', NOTE_B);
  await page.click('#mass-homily-note-save');
  await sleep(500);
  const saved = await entryNote(page, take.id);
  ok(saved === NOTE_B, 'W3c: the note saves from the WebView world too', JSON.stringify(saved));
  const fetchAfter = await page.evaluate(() => window.__fetchLog.length);
  ok(fetchAfter === fetchBefore, 'W3d: capture + note issued ZERO network requests (Q1 C)', 'fetches ' + fetchBefore + ' → ' + fetchAfter);
  await ctx.close();
}

await browser.close();
srv.close();
console.log('');
console.log('harness-v560: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); failures.forEach((f) => console.log(' -', f)); }
process.exit(fail ? 1 : 0);
