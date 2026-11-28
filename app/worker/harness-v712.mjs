// harness-v712.mjs — v712 legs (Plan §2.3): the Add-branch door
// lf:stations → daily:stations-of-the-cross must paint the series
// node (gold dynamic card + episode rows), Back must resolve to
// lf:stations, and the search pill must read "Search episodes".
//
// Conventions follow harness-v710.mjs: plain node, check(name, cond)
// tally with ok/bad summary and non-zero exit on any bad, ORA_WT
// override for the fail-on-old run, fixtures named at the head.
// The ladder's functions are closures inside openAddLadder603, so
// the harness slices the contiguous inner-function block (isOn
// through isEpisodeNode614, which carries dailyRow614 … listHtml,
// parentOf614, isEpisodeNode614) and evals it with stubbed seams
// only: host (ids() → [], groups() → []), state (dayPayload /
// novenasCatalog null), api (never reached — pay614 is pre-seeded),
// esc and sectionMark659 and the opn* title/gate functions sliced
// from the same file. rung and query are harness-owned variables,
// set exactly as the wire sets them (rung = the data-p603door value
// the previous paint actually emitted).
//
// Fixture (Improvement D — from production, not invented): the
// stations-of-the-cross series payload in the standing snapshot
// shape (index.ts series def, key "stations-of-the-cross"), its
// entry derived from the real D1 rss_snapshots stations-of-the-cross
// payload: the corrected 2026-11-27 episode — key
// stations-of-the-cross-2026-11-27::97236258… (prefix as recorded
// in v710 §3.3/§4 and v712 §1.2), title "Stations of the Cross -
// November 27, 2026 (corrected)", label "Nov 27, 2026".
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
let ok = 0, bad = 0;
function check(name, cond, extra) { if (cond) { ok++; console.log('ok   ' + name); } else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 300) : '')); } }
const client = readFileSync(path.join(W, 'src/client.ts'), 'utf8');
function sliceFn(src, name) { const i = src.indexOf('function ' + name); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }
function sliceBlock(src, fromName, toName) {
  const a = src.indexOf('function ' + fromName);
  const tail = sliceFn(src, toName);
  const b = src.indexOf('function ' + toName);
  if (a < 0 || b < 0 || !tail) return '';
  return src.slice(a, b) + tail;
}
function sliceVar(src, name) {
  const i = src.indexOf('var ' + name);
  if (i < 0) return '';
  let d = 0, started = false;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '[' || c === '{') { d++; started = true; }
    if (c === ']' || c === '}') { d--; if (started && !d) return src.slice(i, k + 1) + ';'; }
    if (c === ';' && !started) return src.slice(i, k + 1);
  }
  return '';
}

// ---------- fixture (production-derived, named above) ----------
const EP_KEY = 'stations-of-the-cross-2026-11-27::97236258';
const PAYLOAD = {
  ok: true, kind: 'rss', series: 'stations-of-the-cross', title: 'Stations of the Cross', available: true,
  entries: [{
    key: EP_KEY,
    title: 'Stations of the Cross - November 27, 2026 (corrected)',
    label: 'Nov 27, 2026',
    publishedMs: Date.parse('2026-11-27T12:00:00-06:00'),
    url: 'https://example.invalid/stations-2026-11-27.mp3', durationS: 2000, listened: false, positionS: 0,
  }],
};

// ---------- the sliced ladder block + seams ----------
const block = sliceBlock(client, 'isOn', 'isEpisodeNode614');
check('S ladder block sliced (dailyRow614 … listHtml … isEpisodeNode614)', block.includes('function dailyRow614') && block.includes('function listHtml') && block.includes('function parentOf614') && block.includes('function isEpisodeNode614'), block.length);
const preamble = [
  sliceVar(client, 'OPN_DAILY_SERIES_666'),
  sliceVar(client, 'OPN_MASS_SERIES_688'),
  sliceVar(client, 'OPN_COURSE_KEYS_603'),
  sliceVar(client, 'OPN_DAY_KEY_611'),
  sliceVar(client, 'EXT_TOKENS'),
  sliceVar(client, 'MASS_VIRTUAL_ENTRIES'),
  'var opnLadderSeries603 = [{ series: "stations-of-the-cross", title: "Stations of the Cross" }];',
  'var rung = "root"; var query = ""; var block = "Morning"; var officePick670 = null;',
  'var pay614 = { "stations-of-the-cross": ' + JSON.stringify(PAYLOAD) + ' };',
  'var host = { ids: function () { return []; }, groups: function () { return []; } };',
  'var state = { dayPayload: null, novenasCatalog: null, presentedDay: "2026-11-27" };',
  'var api = function () { return Promise.reject(new Error("api must not be reached: pay614 pre-seeded")); };',
  'var document = { body: { contains: function () { return false; } } };',
  'function homilyIndex() { return []; }',
  'function profContentsUniverse590() { return []; }',
  'function opnSeatPosture597() { return false; }',
  'function opnVideoSeriesTitle656(s) { return s; }',
  'function opnVideoRegWrite656() {}',
  sliceFn(client, 'esc'),
  sliceFn(client, 'sectionMark659'),
  sliceFn(client, 'opnDailyKeyOk666'),
  sliceFn(client, 'opnDailySeriesTitle666'),
  sliceFn(client, 'opnMassKeyOk688'),
  sliceFn(client, 'opnMassSeriesTitle688'),
  sliceFn(client, 'opnMassLabel688'),
  sliceFn(client, 'opnDateLabel'),
  sliceFn(client, 'ownChicagoDateStr'),
  sliceFn(client, 'offlineShiftDate'),
  sliceFn(client, 'opnLabeledSlot650'),
  sliceFn(client, 'opnPodCurrentKey'),
  sliceFn(client, 'opnLadderCourseTitle603'),
].join('\n');
const fn = new Function(preamble + '\n' + block + '\nreturn { listHtml, parentOf614, isEpisodeNode614, setRung: function (r) { rung = r; }, getRung: function () { return rung; } };');
const H = fn();

// ---------- the drive: the REAL navigation ----------
// Each next rung is taken from the data-p603door value the
// previous paint actually emitted (never a hand-typed rung).
function doorValue(html, want) {
  const re = /data-p603door="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) if (m[1] === want) return m[1];
  return null;
}
function allDoors(html) { return [...html.matchAll(/data-p603door="([^"]+)"/g)].map((m) => m[1]); }

// Step 1: root → br:catechesis
H.setRung('root');
const p1 = H.listHtml();
const d1 = doorValue(p1, 'br:catechesis');
check('N1 root paint carries the br:catechesis door; taken from the paint', d1 === 'br:catechesis', allDoors(p1));

// Step 2: br:catechesis → lf:stations
H.setRung(d1);
const p2 = H.listHtml();
const d2 = doorValue(p2, 'lf:stations');
check('N2 br:catechesis paint carries the lf:stations door; taken from the paint', d2 === 'lf:stations', allDoors(p2));

// Step 3: lf:stations → its one door
H.setRung(d2);
const p3 = H.listHtml();
const doors3 = allDoors(p3);
const d3 = doors3.length === 1 ? doors3[0] : null;
check('N3 lf:stations paint carries exactly one door, daily:stations-of-the-cross', doors3.length === 1 && d3 === 'daily:stations-of-the-cross', doors3);
check('N3b the Fridays door label stands as v710 shipped it', p3.includes('Stations of the Cross · Fridays'), p3.slice(0, 200));

// Step 4: the node paint under test
H.setRung(d3);
const p4 = H.listHtml();
check('N4 the daily: node paint is non-empty (the defect leg: old tree returns "")', p4 !== '' && p4.length > 0, p4.slice(0, 120));
check('N4a gold dynamic card paints: p666daily + data-p603additem="daily:stations-of-the-cross"', p4.includes('p666daily') && p4.includes('data-p603additem="daily:stations-of-the-cross"'), p4.slice(0, 300));
check('N4b gold card label reads "Stations of the Cross · Daily"', p4.includes('Stations of the Cross · Daily'), p4.slice(0, 300));
check('N4c the Nov 27 corrected episode row paints (episode add id + corrected title)', p4.includes('data-p603additem="episode:stations-of-the-cross|stations-of-the-cross-2026-11-27::') && p4.includes('Stations of the Cross - November 27, 2026 (corrected)'), p4.slice(0, 400));

// Back chain
check('B1 parentOf614(daily:stations-of-the-cross) === lf:stations', H.parentOf614('daily:stations-of-the-cross') === 'lf:stations', H.parentOf614('daily:stations-of-the-cross'));
check('B2 parentOf614(lf:stations) === br:catechesis (full Back chain home)', H.parentOf614('lf:stations') === 'br:catechesis', H.parentOf614('lf:stations'));

// Search pill at the daily: rung
check('P1 isEpisodeNode614() is true at the daily: rung (pill reads "Search episodes")', H.getRung() === 'daily:stations-of-the-cross' && H.isEpisodeNode614() === true);

// Fridays stamp condition, parsed exactly as the Add handler parses it
const goldId = (p4.match(/data-p603additem="(daily:[^"]+)"/) || [])[1] || '';
const kp = goldId.split(':');
const itemKey = kp.slice(1).join(':');
check('T1 stamp condition: gold card add id parses to kp[0]==="daily" && key==="stations-of-the-cross"', kp[0] === 'daily' && itemKey === 'stations-of-the-cross', goldId);
check('T2 source: the B4 fridays stamp line stands unmoved', client.includes("if (kp[0] === 'daily' && itemA.key === 'stations-of-the-cross') itemA.dayRule = 'fridays';"));

console.log(`\nharness-v712: ${ok} ok / ${bad} bad`);
process.exit(bad ? 1 : 0);
