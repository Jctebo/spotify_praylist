// harness-v561.mjs — v561 evidence: Homily note anytime
// (John's direction, Ora thread, 2026-11-20 17:09 CT:
// "Oh I see. I need the note there and capable before
// during and after recording. And a note can be taken
// with no recording"; approved 2026-11-20 17:38 CT,
// package 57: Q1 A · Q2 A · Q3 A · Q4 A · Q5 A · Q6 A ·
// Q7 B · To Ship. Approval comment, a build requirement:
// "Clicking save will.close.out the note and stop
// recording of recording is not finished".)
//   The shape (Plan D1–D8): the note box stands at the
//     record card BEFORE, DURING, and AFTER recording —
//     one live box over the homily entry's one note field
//     (the target: the recording entry · the just-saved
//     entry · today's standing entry · else a draft that
//     lives in homilyDraftNote until seated). A note typed
//     before recording IS the take's note (Q2 A). Save
//     closes out the note and, while a recording runs,
//     stops it — the take saves normally with the note
//     attached (D4). A note can stand with NO recording:
//     a note-only entry (index state 'note', D1) lives in
//     the same on-device index with NO IndexedDB take,
//     created from the record card's draft Save and from
//     the Homilies list's Add a note act (Q3 A); its row
//     is name + date + the 'Note only' tag, the note in
//     full, no play disc, no played mark, the star
//     standing, menu Rename · Edit note · Delete (Q4 A);
//     it can later gain a recording on the same entry
//     (Q5 A · D5), and it alone stands the Homilies side
//     up (Q6 A). Local only (v551 Q1 C) stands: no server
//     row, no fetch, no upload. Web-only: no migration,
//     no APK.
//   S statics: the diff against the production base
//     (GitHub main 415a5ed — the v560 ship head) confined
//     to client.ts + ui.ts + the release document + this
//     harness · index.ts byte-identical · the ui.ts diff
//     is pure added lines (the .homily-note-tag rule +
//     its comment) with the SW pin unmoved (it moves only
//     at Ship) · migrations end at 0042 · client.ts is
//     byte-identical to the base OUTSIDE the homily
//     module span · the homily module holds no network
//     call · the fenced functions stand byte-identical
//     (the finish paths, the settle, the descriptor, the
//     delete, the row dress) · the v561 seams stand as
//     planned (both entry literals seed the draft · both
//     start paths carry reusedNote · both failure paths
//     revert a reused entry · the finalization clause ·
//     Save writes the note before it stops the take).
//   Worlds (Chromium, stubbed fetch, the v551/v559/v560
//     mold; the fake OraDayBridge is the harness's own
//     fixture):
//     W1 native: the box stands at rest before any entry
//       (the draft seat); typing then pressing Record
//       seeds the take's note (Q2 A); during recording the
//       note stands and Edit note reopens the box; Save
//       note mid-recording STOPS the recording and the
//       take lands ready WITH the note (the approval
//       comment); zero fetches for the note flow.
//     W2 native: Save at rest with no recording seats a
//       note-only entry — index state 'note', NO IndexedDB
//       take; the Homilies side stands on it alone (Q6 A);
//       its row dress is Q4 A's (tag · note in full · no
//       play · no played mark · star works); its menu is
//       Rename · Edit note · Delete only; clearing its
//       note in the list editor removes the entry.
//     W3 native: with today's note-only entry standing,
//       Record lands the take on the SAME entry id —
//       state ready, note preserved, chunks under the
//       same id (Q5 A) — and the row becomes a normal
//       playable homily row.
//     W4 bridge-absent (WebView): the draft seeds the
//       WebView take's note; Save during a WebView
//       recording stops it and the take lands with the
//       note; the Homilies Add a note act seats a
//       note-only entry dated today (Q3 A, second seat);
//       zero network throughout.
//     W5 regression: the v560 seats stand (the card's box
//       for the just-saved take; the list's note dress on
//       ready rows; the full ready-row menu); a native
//       start failure removes a FRESH entry as before,
//       while a failed start on a REUSED note entry
//       reverts it to 'note' with its note intact (D5).
//   The note's look on John's phone is a field leg,
//     not a harness claim.
// Fixtures (Improvement D): the day payload is the
// LIVE production payload
// tests/fixtures-v522/day-live-2026-11-17.json
// re-seated exactly as harness-v559/v560 re-seat it;
// the Mass payload + readings feed stand in the
// v511/v551 production shape; the note texts are the
// approved package 57 mockups' own note, verbatim
// ("On gratitude — the widow's mite. Ask Pam about the
// food drive."); homily entries stand in the shipped
// code's own entry shape (the homilyStartNative /
// homilyStartCapture literals at GitHub main 415a5ed).
// Run: node app/tests/harness-v561.mjs [--probe]
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
const BASE = '415a5ed';
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
  ok(changed.length > 0 && changed.every((p) => p === 'app/worker/src/client.ts' || p === 'app/worker/src/ui.ts' || p === 'releases/v561-homily-note-anytime.md' || p.startsWith('app/tests/harness-v561')),
    'S1a: the tracked diff against the production base is confined to client.ts + ui.ts + the release document + the harness', changed.join(','));
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  ok(untracked.every((p) => p.startsWith('app/tests/harness-v561') || p === 'releases/v561-homily-note-anytime.md'),
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
    'S2b: the ui.ts diff is pure added lines — the .homily-note-tag rule and its comment (no line removed or changed)', uiAdded.slice(0, 3).join(' | '));
  ok(U_SRC.includes('var CACHE = "ora-pro-nobis-v560-1";'), 'S2c: the SW pin still reads v560-1 on the build tree (it moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1] === '0042_day_additions_kind.sql', 'S2d: migration 0042 stands last (no migration)', migs.slice(-2).join(','));
  const bModStart = B_C.indexOf('v551 homily recording (Q1 C');
  const bModEnd = B_C.indexOf('function openSlotPicker(', bModStart);
  const modStart = C_SRC.indexOf('v551 homily recording (Q1 C');
  const modEnd = C_SRC.indexOf('function openSlotPicker(', modStart);
  ok(modStart > 0 && modEnd > modStart && C_SRC.slice(0, modStart) === B_C.slice(0, bModStart) && C_SRC.slice(modEnd) === B_C.slice(bModEnd),
    'S3a: client.ts is byte-identical to the base outside the homily module span — every change is confined to the homily module');
  const MOD = C_SRC.slice(modStart, modEnd);
  ok(!/api\('|api\("|fetch\(|XMLHttpRequest|method:\s*'PUT'|method:\s*"PUT"|['"]\/api\//.test(MOD),
    'S3b: the homily + microphone + native + note module issues no network call of any kind (Q1 C stands)');
  ['homilySetNote', 'homilyNoteOf', 'homilyMicPrepare', 'homilyMicRelease', 'homilyMimePick', 'homilyNativePull', 'homilyTickTimer',
   'homilyFinishNative', 'homilyFinishRecord', 'homilySettle', 'homilyDescFor', 'homilyLiveDesc', 'homilyDelete', 'homilyRowHtml', 'homilyNoteRowHtml',
   'homilySetPlayed', 'homilySetStarred', 'homilyEntrySave', 'homilyMint', 'homilyTakeBlob'].forEach((fn) => {
    ok(fnBody(C_SRC, fn) !== null && fnBody(C_SRC, fn) === fnBody(B_C, fn),
      'S4a: ' + fn + ' is byte-identical to the base (fenced by Plan D8)');
  });
  const seedLits = (C_SRC.match(/note: homilyDraftNoteText\(\)/g) || []).length;
  ok(seedLits === 2, 'S4b: both capture paths open a fresh entry with the card draft as its note (D3 seed — native + WebView literals)', 'count=' + seedLits);
  const reuseFlags = (C_SRC.match(/reusedNote: wasNote/g) || []).length;
  ok(reuseFlags === 2, 'S4c: both start paths mark a reused note entry on homilyRec (D5)', 'count=' + reuseFlags);
  const save = fnBody(C_SRC, 'homilyCardNoteSave') || '';
  ok(save.indexOf('homilySetNote(homilyRec.id, text)') >= 0 && save.indexOf('homilyStopRecord()') > save.indexOf('homilySetNote(homilyRec.id, text)'),
    'S4d: Save writes the note to the recording entry FIRST, then stops the recording (D4 — the approval comment)');
  const card = fnBody(C_SRC, 'massHomilyCardInner') || '';
  ok((card.match(/homilyNoteCardHtml\(\)/g) || []).length === 2,
    'S4e: the note box seats in BOTH card branches — at rest and while recording (Q1 A)');
  const idx = fnBody(C_SRC, 'homilyIndex') || '';
  ok(idx.includes("e.state = 'note'") && idx.includes('homilyNoteOf(e)'),
    'S4f: the finalization clause reverts a chunkless recording entry carrying a note to state note (D5)');
  const create = fnBody(C_SRC, 'homilyNoteOnlyCreate') || '';
  ok(create.includes("state: 'note'") && !create.includes('homilyIdbPut') && !create.includes('homilyDb'),
    'S4g: a note-only entry is created in the index only — state note, no IndexedDB write of any kind (D1)');
  const list = fnBody(C_SRC, 'homilyListEntries') || '';
  const play = fnBody(C_SRC, 'homilyPlayFromList') || '';
  ok(list.includes("e.state === 'note'") && play.includes("e.state === 'ready'"),
    'S4h: the list admits note entries while the play queue stays takes-only (D1 · D7)');
  const noteRow = fnBody(C_SRC, 'homilyNoteOnlyRowHtml') || '';
  ok(noteRow.includes('homily-note-tag') && noteRow.includes('Note only') && noteRow.includes('data-homilystar') && noteRow.includes('data-homilymenu')
    && !noteRow.includes('data-homilyplay') && !noteRow.includes('data-homilymark'),
    'S4i: the note-only row dress — tag, star, menu; no play disc, no played mark (Q4 A)');
  const menu = fnBody(C_SRC, 'openHomilyMenu') || '';
  ok(menu.indexOf("e.state === 'note'") >= 0 && menu.indexOf("e.state === 'note'") < menu.indexOf("'Play'"),
    'S4j: the menu branches on state note BEFORE the Play item — a note entry never offers Play, queue, or Praylist (Q4 A)');
  const settle = fnBody(C_SRC, 'homilySettle') || '';
  ok(settle.includes("e.state === 'ready'"), 'S4k: the settle still mints ready entries only — a note entry never gets a blob URL (D1)');
  const target = fnBody(C_SRC, 'homilyCardNoteTarget') || '';
  ok(target.includes('homilyRec') && target.includes('homilyNoteCardId') && target.includes("e.state === 'note'"),
    'S4l: the card note target resolves recording entry, then the seated entry, then today\u2019s standing entry (D2)');
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

async function indexAll(page) {
  return page.evaluate(() => { try { return JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]'); } catch (e) { return null; } });
}
async function entryOf(page, id) {
  return page.evaluate((x) => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    return idx.find((y) => y.id === x) || null;
  }, id);
}
async function idbTakeRows(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const out = { takes: -1, chunks: -1 };
    let req;
    try { req = indexedDB.open('opn-homilies', 1); } catch (e) { resolve(out); return; }
    req.onsuccess = () => {
      try {
        // The app opens its DB lazily (homilyDb runs at the
        // first take operation): a world that never recorded
        // may have no stores at all — that IS zero rows.
        if (!req.result.objectStoreNames.contains('takes')) { resolve({ takes: 0, chunks: 0 }); return; }
        const tx = req.result.transaction(['takes', 'chunks'], 'readonly');
        const c1 = tx.objectStore('takes').count();
        const c2 = tx.objectStore('chunks').count();
        c1.onsuccess = () => { out.takes = c1.result; };
        c2.onsuccess = () => { out.chunks = c2.result; };
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => resolve(out);
      } catch (e) { resolve(out); }
    };
    req.onerror = () => resolve(out);
  }));
}
async function waitEntryState(page, id, want, tag) {
  await page.waitForFunction((x) => {
    try {
      const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
      const e = idx.find((y) => y.id === x.id);
      return !!e && e.state === x.want;
    } catch (err) { return false; }
  }, { id, want }, { timeout: 15000 }).catch(() => console.log('note -', tag, 'entry state slow'));
  return entryOf(page, id);
}

/* ---------------- W1: native world — the box before, during, after; Save stops the take ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w1', 'native');
  ok(errs.length === 0, 'W1-0: boot clean in the native world — no page errors', errs.join(' · '));
  await goMass(page, 'w1');
  const rest0 = await page.evaluate(() => ({
    field: !!document.getElementById('mass-homily-note-field'),
    save: !!document.getElementById('mass-homily-note-save'),
    entries: JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]').length,
  }));
  ok(rest0.field && rest0.save && rest0.entries === 0, 'W1a: at rest before any entry exists, the note box STANDS at the record card (the draft seat — Q1 A)', JSON.stringify(rest0));
  const fetchBefore = await page.evaluate(() => window.__fetchLog.length);
  await page.fill('#mass-homily-note-field', NOTE_A);
  await sleep(300);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w1 recording state slow'));
  await sleep(600);
  const during = await page.evaluate(() => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    return {
      state: idx.length === 1 ? idx[0].state : 'n=' + idx.length,
      note: idx.length === 1 ? idx[0].note : null,
      text: (document.querySelector('#mass-homily-host .homily-note-text') || {}).textContent || '',
      edit: !!document.getElementById('mass-homily-note-edit'),
    };
  });
  ok(during.state === 'recording' && during.note === NOTE_A && during.text === NOTE_A && during.edit,
    'W1b: the note typed before recording IS the recording entry\u2019s note, standing on the card during the take (Q2 A · Q1 A)', JSON.stringify(during));
  await page.click('#mass-homily-note-edit');
  await sleep(400);
  const prefill = await page.evaluate(() => (document.getElementById('mass-homily-note-field') || {}).value || '');
  ok(prefill === NOTE_A, 'W1c: Edit note during recording reopens the box prefilled — the box is editable during the take', prefill);
  await page.fill('#mass-homily-note-field', NOTE_A2);
  await sleep(300);
  await page.click('#mass-homily-note-save');
  const idxAfterSave = await indexAll(page);
  const take = idxAfterSave && idxAfterSave.length === 1 ? await waitEntryState(page, idxAfterSave[0].id, 'ready', 'w1') : null;
  ok(!!take && take.state === 'ready', 'W1d: Save during recording STOPS the recording — the take lands ready (the approval comment)', take ? take.name : 'no take');
  ok(!!take && take.note === NOTE_A2, 'W1e: the take saves WITH the note as edited at Save — one note, attached (Q2 A)', take ? JSON.stringify(take.note) : 'no take');
  const order = await page.evaluate(() => window.__order.slice());
  ok(order.includes('stopNativeRecording'), 'W1f: the stop went through the standing native stop path', order.join(','));
  const cardAfter = await page.evaluate(() => ({
    stop: !!document.getElementById('mass-homily-stop'),
    rec: !!document.getElementById('mass-homily-rec'),
    text: (document.querySelector('#mass-homily-host .homily-note-text') || {}).textContent || '',
  }));
  ok(!cardAfter.stop && cardAfter.rec && cardAfter.text === NOTE_A2,
    'W1g: after the Save-stop the card is at rest and shows the note in full — the note is closed out', JSON.stringify(cardAfter));
  const fetchAfter = await page.evaluate(() => window.__fetchLog.length);
  ok(fetchAfter === fetchBefore, 'W1h: the whole note flow issued ZERO network requests (Local only — Q1 C)', 'fetches ' + fetchBefore + ' → ' + fetchAfter);
  await ctx.close();
}

/* ---------------- W2: native world — a note with no recording ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w2', 'native');
  ok(errs.length === 0, 'W2-0: boot clean in the native world — no page errors', errs.join(' · '));
  await goMass(page, 'w2');
  await page.fill('#mass-homily-note-field', NOTE_A2);
  await sleep(300);
  await page.click('#mass-homily-note-save');
  await sleep(600);
  const idx = await indexAll(page);
  const ne = idx && idx.length === 1 ? idx[0] : null;
  ok(!!ne && ne.state === 'note' && ne.note === NOTE_A2, 'W2a: Save at rest with no recording seats a note-only entry in the on-device index (Q3 A — the card seat)', ne ? ne.state + ' · ' + JSON.stringify(ne.note) : 'no entry');
  ok(!!ne && ne.dateKey === todayCT && ne.chunkCount === 0 && ne.durationS === 0, 'W2b: the note-only entry is dated today and carries no audio measures', ne ? ne.dateKey : 'no entry');
  const idb = await idbTakeRows(page);
  ok(idb.takes === 0 && idb.chunks === 0, 'W2c: NO IndexedDB take or chunk stands behind the note-only entry — words only (D1)', JSON.stringify(idb));
  const cardDress = await page.evaluate(() => ({
    text: (document.querySelector('#mass-homily-host .homily-note-text') || {}).textContent || '',
    edit: !!document.getElementById('mass-homily-note-edit'),
    field: !!document.getElementById('mass-homily-note-field'),
  }));
  ok(cardDress.text === NOTE_A2 && cardDress.edit && !cardDress.field, 'W2d: the card closes out to the note in full with an Edit note act', JSON.stringify(cardDress));
  await goHomilies(page);
  const row = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    if (!r) return null;
    return {
      tag: (r.querySelector('.homily-note-tag') || {}).textContent || null,
      text: (r.querySelector('.homily-note-text') || {}).textContent || null,
      play: !!r.querySelector('[data-homilyplay]'),
      mark: !!r.querySelector('[data-homilymark]'),
      star: !!r.querySelector('[data-homilystar]'),
      menu: !!r.querySelector('[data-homilymenu]'),
    };
  }, ne.id);
  ok(!!row && row.tag === 'Note only' && row.text === NOTE_A2 && !row.play && !row.mark && row.star && row.menu,
    'W2e: the Homilies side stands on the note-only entry alone (Q6 A) and its row is Q4 A\u2019s dress — tag, note in full, star, menu; no play disc, no played mark', JSON.stringify(row));
  await page.click('[data-homilystar="' + ne.id + '"]');
  await sleep(400);
  const starred = await entryOf(page, ne.id);
  ok(!!starred && starred.starred === true, 'W2f: the star stands on a note-only entry', starred ? String(starred.starred) : 'no entry');
  await page.click('[data-homilymenu="' + ne.id + '"]');
  await sleep(400);
  const labels = await menuLabels560(page);
  ok(labels.length === 3 && labels.includes('Rename') && labels.includes('Edit note') && labels.includes('Delete'),
    'W2g: the note-only menu is Rename · Edit note · Delete only — no Play, no queue, no Praylist (Q4 A)', labels.join(' · '));
  await clickMenuItem560(page, 'Edit note');
  await page.waitForSelector('#homily-note-field', { timeout: 8000 }).catch(() => console.log('note - w2 editor slow'));
  const prefill = await page.evaluate(() => (document.getElementById('homily-note-field') || {}).value || '');
  ok(prefill === NOTE_A2, 'W2h: the list editor opens prefilled with the standing note (one note)', prefill);
  await page.fill('#homily-note-field', '');
  await page.click('[data-note-save]');
  await sleep(600);
  const idxGone = await indexAll(page);
  ok(!!idxGone && idxGone.length === 0, 'W2i: clearing a note-only entry\u2019s note removes the entry — no audio and no note is nothing (D4)', 'n=' + (idxGone ? idxGone.length : 'null'));
  await ctx.close();
}

/* ---------------- W3: native world — a note-only entry gains its recording ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w3', 'native');
  ok(errs.length === 0, 'W3-0: boot clean in the native world — no page errors', errs.join(' · '));
  await goMass(page, 'w3');
  await page.fill('#mass-homily-note-field', NOTE_A);
  await sleep(300);
  await page.click('#mass-homily-note-save');
  await sleep(600);
  const idx0 = await indexAll(page);
  const ne = idx0 && idx0.length === 1 ? idx0[0] : null;
  ok(!!ne && ne.state === 'note', 'W3a: the note-only entry stands before the recording', ne ? ne.id : 'no entry');
  await page.click('#mass-homily-rec');
  const recEntry = ne ? await waitEntryState(page, ne.id, 'recording', 'w3') : null;
  const idxRec = await indexAll(page);
  ok(!!recEntry && !!idxRec && idxRec.length === 1 && recEntry.note === NOTE_A,
    'W3b: Record moves THE SAME entry to recording — no second entry, the note rides (Q5 A)', recEntry ? recEntry.id + ' · ' + JSON.stringify(recEntry.note) : 'no entry');
  await sleep(800);
  await page.click('#mass-homily-stop');
  const take = ne ? await waitEntryState(page, ne.id, 'ready', 'w3') : null;
  ok(!!take && take.state === 'ready' && take.note === NOTE_A && (take.chunkCount || 0) > 0,
    'W3c: the take lands on the same entry — ready, chunks counted, note preserved', take ? take.id + ' · chunks=' + take.chunkCount : 'no take');
  const idb = await idbTakeRows(page);
  ok(idb.takes === 1 && idb.chunks > 0, 'W3d: the audio stands in IndexedDB under the same entry id', JSON.stringify(idb));
  await goHomilies(page);
  const row = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    if (!r) return null;
    return { play: !!r.querySelector('[data-homilyplay]'), mark: !!r.querySelector('[data-homilymark]'), tag: !!r.querySelector('.homily-note-tag'), text: (r.querySelector('.homily-note-text') || {}).textContent || null };
  }, ne.id);
  ok(!!row && row.play && row.mark && !row.tag && row.text === NOTE_A,
    'W3e: the row is now a normal homily row — play disc and played mark stand, the Note only tag is gone, the note stands in full', JSON.stringify(row));
  await ctx.close();
}

/* ---------------- W4: no bridge — the WebView path + the list creation seat ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w4', 'none');
  ok(errs.length === 0, 'W4-0: boot clean in the bridge-absent world — no page errors', errs.join(' · '));
  await goMass(page, 'w4');
  const fetchBefore = await page.evaluate(() => window.__fetchLog.length);
  await page.fill('#mass-homily-note-field', NOTE_A);
  await sleep(300);
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w4 recording state slow'));
  await sleep(600);
  const during = await page.evaluate(() => {
    const idx = JSON.parse(localStorage.getItem('opn-homilies-v551') || '[]');
    return { state: idx.length === 1 ? idx[0].state : 'n=' + idx.length, note: idx.length === 1 ? idx[0].note : null, edit: !!document.getElementById('mass-homily-note-edit') };
  });
  ok(during.state === 'recording' && during.note === NOTE_A && during.edit,
    'W4a: the WebView take opens with the card draft as its note, standing during the take (Q2 A on the second capture path)', JSON.stringify(during));
  await page.click('#mass-homily-note-edit');
  await sleep(400);
  await page.fill('#mass-homily-note-field', NOTE_A2);
  await sleep(300);
  await page.click('#mass-homily-note-save');
  const idx1 = await indexAll(page);
  const take = idx1 && idx1.length === 1 ? await waitEntryState(page, idx1[0].id, 'ready', 'w4') : null;
  ok(!!take && take.note === NOTE_A2, 'W4b: Save during a WebView recording stops it and the take lands WITH the note (the approval comment, second path)', take ? JSON.stringify(take.note) : 'no take');
  const fetchMid = await page.evaluate(() => window.__fetchLog.length);
  ok(fetchMid === fetchBefore, 'W4e: capture + note on the WebView path issued ZERO network requests (Q1 C)', 'fetches ' + fetchBefore + ' → ' + fetchMid);
  await goHomilies(page);
  await sleep(800);
  const fetchList0 = await page.evaluate(() => window.__fetchLog.length);
  const headAct = await page.evaluate(() => { const b = document.getElementById('homilies-add-note'); return b ? b.textContent.trim() : null; });
  ok(headAct === '\uFF0B Add a note', 'W4c: the Homilies side heads with its own Add a note act (Q3 A — the list seat)', String(headAct));
  await page.click('#homilies-add-note');
  await page.waitForSelector('#homily-note-field', { timeout: 8000 }).catch(() => console.log('note - w4 editor slow'));
  await page.fill('#homily-note-field', NOTE_B);
  await page.click('[data-note-save]');
  await sleep(600);
  const idx2 = await indexAll(page);
  const noteEntries = (idx2 || []).filter((e) => e.state === 'note');
  ok(!!idx2 && idx2.length === 2 && noteEntries.length === 1 && noteEntries[0].note === NOTE_B && noteEntries[0].dateKey === todayCT,
    'W4d: the list act seats a note-only entry dated today beside the take', JSON.stringify((idx2 || []).map((e) => e.state)));
  const fetchAfter = await page.evaluate(() => window.__fetchLog.length);
  ok(fetchAfter === fetchList0, 'W4f: the list-seat note-only creation issued ZERO network requests (Q1 C)', 'fetches ' + fetchList0 + ' → ' + fetchAfter);
  await ctx.close();
}

/* ---------------- W5: regression — the v560 seats + the failure reverts ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w5', 'native');
  ok(errs.length === 0, 'W5-0: boot clean in the native world — no page errors', errs.join(' · '));
  await goMass(page, 'w5');
  await page.click('#mass-homily-rec');
  await page.waitForSelector('#mass-homily-stop', { timeout: 10000 }).catch(() => console.log('note - w5 recording state slow'));
  await sleep(900);
  await page.click('#mass-homily-stop');
  const take = await takeReady(page);
  ok(!!take && take.state === 'ready' && take.note === '', 'W5a: a take with no pre-note lands with an empty note, as v560\u2019s did', take ? take.name : 'no take');
  await page.waitForSelector('#mass-homily-note-field', { timeout: 8000 }).catch(() => console.log('note - w5 note box slow'));
  await page.fill('#mass-homily-note-field', NOTE_B);
  await page.click('#mass-homily-note-save');
  await sleep(500);
  const saved = await entryNote(page, take.id);
  const cardText = await page.evaluate(() => (document.querySelector('#mass-homily-host .homily-note-text') || {}).textContent || '');
  ok(saved === NOTE_B && cardText === NOTE_B, 'W5b: the v560 card seat stands — the box for the just-saved take saves the note and folds to the note in full', JSON.stringify(saved));
  await goHomilies(page);
  const row = await page.evaluate((id) => {
    const r = document.querySelector('[data-homilyid="' + id + '"]');
    return r ? (r.querySelector('.homily-note-text') || {}).textContent || null : null;
  }, take.id);
  ok(row === NOTE_B, 'W5c: the list shows the same note in full under the ready entry (v560 Q4 A stands)', row);
  await page.click('[data-homilymenu="' + take.id + '"]');
  await sleep(400);
  const labels = await menuLabels560(page);
  ok(['Play', 'Add to queue', 'Add to Praylist', 'Rename', 'Edit note', 'Delete'].every((l) => labels.includes(l)),
    'W5d: the ready row\u2019s menu keeps its full act set', labels.join(' · '));
  await clickMenuItem560(page, 'Delete');
  await page.waitForSelector('[data-cfgo]', { timeout: 8000 }).catch(() => console.log('note - w5 confirm slow'));
  await page.click('[data-cfgo]');
  await sleep(700);
  const idxGone = await indexAll(page);
  ok(!!idxGone && idxGone.length === 0, 'W5e: Delete still removes the take and its note with it', 'n=' + (idxGone ? idxGone.length : 'null'));
  await ctx.close();
}
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w5f', 'nativefail');
  await goMass(page, 'w5f');
  await page.click('#mass-homily-rec');
  await sleep(1200);
  const idx = await indexAll(page);
  const savedLine = await page.evaluate(() => (document.querySelector('#mass-homily-host') || {}).textContent || '');
  ok(!!idx && idx.length === 0 && savedLine.includes('Microphone not available'),
    'W5f: a native start failure on a FRESH entry removes it, exactly as v559\u2019s path did', 'n=' + (idx ? idx.length : 'null'));
  await ctx.close();
}
{
  const errs = [];
  const { ctx, page } = await boot(errs, 'w5r', 'nativefail');
  await goMass(page, 'w5r');
  await page.fill('#mass-homily-note-field', NOTE_A);
  await sleep(300);
  await page.click('#mass-homily-note-save');
  await sleep(600);
  const idx0 = await indexAll(page);
  ok(!!idx0 && idx0.length === 1 && idx0[0].state === 'note', 'W5g: the note-only entry stands before the doomed recording', idx0 ? idx0[0].state : 'no entry');
  await page.click('#mass-homily-rec');
  await sleep(1200);
  const idx1 = await indexAll(page);
  ok(!!idx1 && idx1.length === 1 && idx1[0].state === 'note' && idx1[0].note === NOTE_A,
    'W5h: a failed start on the REUSED entry hands it back to note-only — the note survives (D5)', idx1 && idx1[0] ? idx1[0].state + ' · ' + JSON.stringify(idx1[0].note) : 'no entry');
  await ctx.close();
}

await browser.close();
srv.close();
console.log('');
console.log('harness-v561: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); failures.forEach((f) => console.log(' -', f)); }
process.exit(fail ? 1 : 0);
