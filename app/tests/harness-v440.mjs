// harness-v440 — the backslash-cooking cleanup gate (v440
// release document §§1–2). The defect class: APP_JS is one
// template literal; a single backslash before a non-escape
// character is eaten by template cooking, so a regex written
// in the raw source reaches the served script bent
// (\d -> d, \. -> .). v439 fixed the one boot-killing line
// and its census named 14 remaining sites on four lines;
// v440 re-spells those four lines backslash-free with
// character classes ([0-9] for \d, [.] for \.) so the COOKED
// script carries exactly the intended semantics. This
// harness works on the COOKED script — the exact string
// index.ts serves at /app.js:
//   P   the whole cooked APP_JS parses (vm.Script)
//   C   the census: single-backslash non-escape sequences
//       inside APP_JS — must count 0 on the fixed tree
//   R   regex-level proof: the intended patterns (written
//       here as genuine regex literals) and the fixed
//       patterns (character classes) agree on every string
//       in the battery, including the bent forms' literals
//   F   function-level proof: the four functions, evaluated
//       out of the COOKED script, return the expected value
//       on every case AND agree with reference copies that
//       carry the intended regexes verbatim
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const APP = path.resolve(process.cwd(), 'app');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------- the cooked APP_JS (the served string) ---------------- */
const TPL_A = C_SRC.indexOf('APP_JS = `') + 10;
const TPL_B = C_SRC.indexOf('`;', TPL_A);
const RAW_JS = C_SRC.slice(TPL_A, TPL_B);
let COOKED = null, cookErr = null;
try { COOKED = new Function('return `' + RAW_JS + '`')(); } catch (e) { cookErr = e; }

/* ---------------- P: whole-script parse ---------------- */
{
  ok(!cookErr, 'P0: the APP_JS template evaluates (cooks) without error', cookErr && cookErr.message);
  let parseErr = null;
  if (COOKED != null) { try { new vm.Script(COOKED); } catch (e) { parseErr = e; } }
  ok(COOKED != null && !parseErr, 'P1: the whole cooked APP_JS parses (vm.Script)', parseErr && parseErr.message);
}

/* ---------------- C: the census must print 0 ---------------- */
{
  const sites = [];
  let line = 1 + C_SRC.slice(0, TPL_A).split('\n').length - 1;
  const VALID = new Set(['\'', '"', '`', '$', '\\', 'b', 'f', 'n', 'r', 't', 'v', '0', '\n']);
  for (let i = 0; i < RAW_JS.length; i++) {
    const ch = RAW_JS[i];
    if (ch === '\n') { line++; continue; }
    if (ch !== '\\') continue;
    const nx = RAW_JS[i + 1];
    if (nx === undefined) break;
    if (nx === '\\') { i++; continue; }
    if (nx === 'u' && (/^[0-9a-fA-F]{4}$/.test(RAW_JS.slice(i + 2, i + 6)) || RAW_JS[i + 2] === '{')) { i += 5; continue; }
    if (nx === 'x' && /^[0-9a-fA-F]{2}$/.test(RAW_JS.slice(i + 2, i + 4))) { i += 3; continue; }
    if (VALID.has(nx)) { i++; continue; }
    sites.push('raw client.ts:' + line + '  \\' + nx);
    i++;
  }
  console.log('note - C census: single-backslash non-escape sequences inside APP_JS: ' + sites.length + (sites.length ? ' — ' + sites.join(' · ') : ''));
  ok(sites.length === 0, 'C1: the census counts 0 on the fixed tree (the class is gone from APP_JS)', sites.join(' · '));
}

/* ---------------- R: regex-level equivalence ----------------
   The intended patterns (genuine regex literals in this file)
   vs the fixed patterns (character classes). \d is defined
   as [0-9] and \. matches exactly the character [.] matches;
   the battery proves it match-for-match, including strings
   the BENT cooked forms would have treated wrongly. */
{
  const isoIn = /^(\d{4})-(\d{2})-(\d{2})/, isoFx = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/;
  const isoCases = ['2026-11-14', '2026-01-05', '2026-03-08', 'dddd-dd-dd', '2026-1-4', 'x2026-11-14', '2026-11-14 extra', ''];
  ok(isoCases.every((s) => eq(isoIn.exec(s), isoFx.exec(s))), 'R1: ISO-date pattern — intended \\d form and fixed [0-9] form agree on ' + isoCases.length + ' strings');

  const wpIn = /([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*__\d{4}-\d{2}(?:-\d{2})?\.jpg)/;
  const wpFx = /([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*__[0-9]{4}-[0-9]{2}(?:-[0-9]{2})?[.]jpg)/;
  const wpCases = [
    'Live wallpaper: on — saint-margaret-of-scotland__2026-11-16.jpg',
    'holy-souls-in-purgatory__2026-11.jpg',
    'a__2026-11-16.jpg',
    'name__2026-11-16Xjpg',
    'name__2026-111-16.jpg',
    'name__2026-11-166.jpg',
    'name__dddd-dd-dd.jpg',
    'no wallpaper name here',
  ];
  ok(wpCases.every((s) => eq(s.match(wpIn), s.match(wpFx))), 'R2: wallpaper-match pattern — intended and fixed forms agree on ' + wpCases.length + ' strings (incl. the Xjpg dot discriminator)');

  const stIn = /__\d{4}-\d{2}(-\d{2})?\.jpg$/, stFx = /__[0-9]{4}-[0-9]{2}(-[0-9]{2})?[.]jpg$/;
  const stCases = ['saint-x__2026-11-16.jpg', 'holy-souls__2026-11.jpg', 'name__2026-11-16Xjpg', 'name__2026-11-166.jpg', 'plain-name'];
  ok(stCases.every((s) => s.replace(stIn, '') === s.replace(stFx, '')), 'R3: title-strip pattern — intended and fixed forms strip identically on ' + stCases.length + ' strings');
}

/* ---------------- reference implementations (intended regexes verbatim) ---------------- */
const REF_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function refShortDayLabel(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return REF_MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]);
}
function refWallpaperLiveState(s) {
  var lines = s && s.liveWallpaper;
  if (!lines || !lines.length) return { active: true, drawnName: null };
  var line = String(lines[0]);
  if (line.indexOf('Live wallpaper: not on') === 0) return { active: false, drawnName: null };
  if (line.indexOf('Live wallpaper: on') === 0) {
    var m = line.match(/([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*__\d{4}-\d{2}(?:-\d{2})?\.jpg)/);
    return { active: true, drawnName: m ? m[1] : null };
  }
  return { active: true, drawnName: null };
}
function refWallpaperTitle(slug) {
  var words = String(slug || '').split('-').filter(function (w) { return !!w; });
  return words.map(function (w, i) {
    if (i > 0 && (w === 'of' || w === 'the' || w === 'and')) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
function refWallpaperTitleFromName(name) {
  return refWallpaperTitle(String(name || '').replace(/__\d{4}-\d{2}(-\d{2})?\.jpg$/, ''));
}
function refShortHomeDate(day) {
  var ds = day && day.date;
  if (ds) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ds));
    if (m) {
      var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
      return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(dt);
    }
  }
  return (day && day.dateLabel) || 'the day&rsquo;s prayers';
}

/* ---------------- F: the four functions out of the COOKED script ---------------- */
function extract(from, to, tail) {
  const a = COOKED.indexOf(from), b = COOKED.indexOf(to, a + 1);
  if (a < 0 || b < 0) return null;
  try { return new Function(COOKED.slice(a, b) + tail)(); } catch (e) { return { __err: e }; }
}
let F = null, fErr = null;
if (COOKED != null) {
  const g1 = extract('var MONTHS_SHORT', 'function presentedDayWord', '; return { shortDayLabel: shortDayLabel };');
  const g2 = extract('function wallpaperLiveState', 'var wpPayload', '; return { wallpaperLiveState: wallpaperLiveState };');
  const g3 = extract('function wallpaperTitle(', 'function wallpaperShowingHtml', '; return { wallpaperTitleFromName: wallpaperTitleFromName };');
  const g4 = extract('function shortHomeDate', 'function paintListenHome', '; return { shortHomeDate: shortHomeDate };');
  const bad = [g1, g2, g3, g4].find((g) => !g || g.__err);
  if (bad) fErr = bad.__err || new Error('an extraction came back empty');
  else F = { shortDayLabel: g1.shortDayLabel, wallpaperLiveState: g2.wallpaperLiveState, wallpaperTitleFromName: g3.wallpaperTitleFromName, shortHomeDate: g4.shortHomeDate };
}
ok(!!F, 'F0: the four functions evaluate out of the cooked script', fErr && fErr.message);

if (F) {
  /* F1 — shortDayLabel (client.ts:234) */
  const dl = [
    ['2026-11-14', 'Nov 14'], ['2026-01-05', 'Jan 5'], ['2026-12-25', 'Dec 25'],
    ['2026-03-08', 'Mar 8'], ['2026-11-14T00:00:00', 'Nov 14'],
    ['Nov 14', 'Nov 14'], ['Sunday, November 15, 2026', 'Sunday, November 15, 2026'],
    ['', ''], [null, ''],
  ];
  ok(dl.every(([i, want]) => F.shortDayLabel(i) === want && F.shortDayLabel(i) === refShortDayLabel(i)),
    'F1: shortDayLabel — ISO days shorten, rendered forms pass through, on ' + dl.length + ' cases (expected values + intended-regex reference)');

  /* F2 — wallpaperLiveState (client.ts:3524) */
  const ls = [
    [{ liveWallpaper: ['Live wallpaper: on — saint-margaret-of-scotland__2026-11-16.jpg'] }, { active: true, drawnName: 'saint-margaret-of-scotland__2026-11-16.jpg' }],
    [{ liveWallpaper: ['Live wallpaper: on — holy-souls-in-purgatory__2026-11.jpg'] }, { active: true, drawnName: 'holy-souls-in-purgatory__2026-11.jpg' }],
    [{ liveWallpaper: ['Live wallpaper: not on'] }, { active: false, drawnName: null }],
    [{ liveWallpaper: ['Live wallpaper: on — no pictures stand in the Phone folder yet.'] }, { active: true, drawnName: null }],
    [{ liveWallpaper: ['Live wallpaper: on — some-saint__2026-11-16Xjpg'] }, { active: true, drawnName: null }],
    [{ liveWallpaper: [] }, { active: true, drawnName: null }],
    [{}, { active: true, drawnName: null }],
  ];
  ok(ls.every(([i, want]) => eq(F.wallpaperLiveState(i), want) && eq(F.wallpaperLiveState(i), refWallpaperLiveState(i))),
    'F2: wallpaperLiveState — daily + monthly drawn names parse, off form reads off, unmatched lines keep the guarded posture, on ' + ls.length + ' cases');

  /* F3 — wallpaperTitleFromName (client.ts:3601) */
  const tn = [
    ['saint-margaret-of-scotland__2026-11-16.jpg', 'Saint Margaret of Scotland'],
    ['holy-souls-in-purgatory__2026-11.jpg', 'Holy Souls In Purgatory'],
    ['the-blessed-virgin-mary__2026-11-16.jpg', 'The Blessed Virgin Mary'],
    ['saint-john-of-the-cross__2026-12-14.jpg', 'Saint John of the Cross'],
    ['ordinary-day', 'Ordinary Day'],
    ['', ''],
  ];
  ok(tn.every(([i, want]) => F.wallpaperTitleFromName(i) === want && F.wallpaperTitleFromName(i) === refWallpaperTitleFromName(i)),
    'F3: wallpaperTitleFromName — the date suffix strips (daily + monthly forms) and the title humanizes, on ' + tn.length + ' cases');

  /* F4 — shortHomeDate (client.ts:8003), incl. the 2026 DST pair */
  const hd = [
    [{ date: '2026-11-14', dateLabel: 'Saturday, November 14, 2026' }, 'Sat, Nov 14, 2026'],
    [{ date: '2026-11-15' }, 'Sun, Nov 15, 2026'],
    [{ date: '2026-03-08' }, 'Sun, Mar 8, 2026'],
    [{ date: '2026-11-01' }, 'Sun, Nov 1, 2026'],
    [{ dateLabel: 'Sunday, November 15, 2026' }, 'Sunday, November 15, 2026'],
    [{ date: 'not-a-date', dateLabel: 'Fallback Label' }, 'Fallback Label'],
    [{}, 'the day&rsquo;s prayers'],
  ];
  ok(hd.every(([i, want]) => F.shortHomeDate(i) === want && F.shortHomeDate(i) === refShortHomeDate(i)),
    'F4: shortHomeDate — the short form derives (incl. DST days 2026-03-08 + 2026-11-01), fallbacks stand, on ' + hd.length + ' cases');
}

console.log('\nharness-v440: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
