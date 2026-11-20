// harness-v489 — v489: Mass section titles (big titles
// between the major sections) + toggle boxes in the
// connected header-pill design, one row each (John,
// 2026-11-17 05:36-05:40 CT). Presentation only: no text
// changes against the v488 ship tree.
//
// Fixtures are REAL (Improvement D), on the v488 pattern:
//   - the Order + roles datasets are generated from the
//     proven source pages standing in fixtures-v486 (the
//     same pages production's data was cut from);
//   - the readings are the real decoded Universalis payloads
//     in fixtures-v487 (today + Sunday 2026-11-22);
//   - the day payloads come from the REAL massPayload
//     (mass.ts, esbuild-bundled) over the fixture Missal
//     pages, on the build tree's own calendar dataset.
//
// Legs:
//   P   the cooked APP_JS parses (the v439 gate) + tab order.
//   R   roles data integrity + the standing texts unchanged
//       against the v488 ship tree.
//   N   the five big section titles: once each, in order, at
//       the named placements, on a memorial weekday and a
//       Sunday; the .mass-section dress and its size steps.
//   G   every toggle box is one connected segtoggle-pill
//       group; the EP labels are the short forms; the CSS
//       carries the one-row (nowrap) guarantee and the
//       legacy wrap rules are gone.
//   F   function preserved: Latin swap/restore byte-equal,
//       the EP toggle renders I-IV with II on open.
//   S/T/C/D  the v488 legs carried over: the bold sample,
//       the size stepper + persistence, no commentary, the
//       day-true Order.

import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = ROOT + '/app/worker/src';
const FIX6 = ROOT + '/app/tests/fixtures-v486';
const FIX7 = ROOT + '/app/tests/fixtures-v487';
const C_SRC = fs.readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = fs.readFileSync(SRC + '/ui.ts', 'utf8');

let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('not ok -', name, detail ? ':: ' + String(detail).slice(0, 260) : ''); }
}

/* ---------------- P: the cooked APP_JS ---------------- */
const TPL_A = C_SRC.indexOf('APP_JS = `') + 10;
const TPL_B = C_SRC.lastIndexOf('`;');
let COOKED = null, cookErr = null;
try { COOKED = new Function('return `' + C_SRC.slice(TPL_A, TPL_B) + '`')(); }
catch (e) { cookErr = e; }
ok(!cookErr && typeof COOKED === 'string', 'P1 the APP_JS template cooks without error', cookErr && cookErr.message);
let parseErr = null;
if (COOKED) { try { new vm.Script(COOKED); } catch (e) { parseErr = e; } }
ok(!parseErr, 'P2 the whole cooked APP_JS parses (vm.Script) — the v439 gate', parseErr && parseErr.message);
{
  const nav = U_SRC.slice(U_SRC.indexOf('<nav class="tabbar"'), U_SRC.indexOf('</nav>'));
  const order = ['data-tab="prayers"', 'data-tab="mass"', 'data-tab="conscience"', 'data-tab="podcasts"', 'data-tab="wallpaper"']
    .map((s) => nav.indexOf(s));
  ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), 'P3 the tab bar stands unchanged (Mass second)', order.join(','));
}

/* ---------------- the real client, in a vm ---------------- */
function extractFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  return '';
}
const lsStore = {};
const ctx = {
  console, document: { head: { appendChild: () => {} }, createElement: () => ({}), getElementById: () => null },
  window: {}, state: { tab: 'mass', mass: null }, view: { innerHTML: '', querySelectorAll: () => [] },
  localStorage: { getItem: (k) => (k in lsStore ? lsStore[k] : null), setItem: (k, v) => { lsStore[k] = String(v); } },
};
ctx.window = ctx;
vm.createContext(ctx);
{
  const d0 = COOKED.indexOf('var MASS_ORDER = '), d1 = COOKED.indexOf('/*__/MASS_DATA__*/');
  vm.runInContext(COOKED.slice(d0, d1), ctx);
  for (const v of ['MASS_NAMED_ENTITIES', 'MASS_ICEL_NOTICE', 'MASS_READINGS_ACK_1', 'MASS_READINGS_ACK_2', 'MASS_SIZE_NAMES', 'MASS_PREFS_KEY']) {
    const at = COOKED.indexOf('var ' + v);
    if (at >= 0) vm.runInContext(COOKED.slice(at, COOKED.indexOf(';', at) + 1), ctx);
  }
}
for (const fn of ['esc', 'massDecodeEntities', 'massCleanLines', 'massCleanText', 'massReadingTextHtml', 'massGaTextHtml', 'massTextHtml', 'massAntiphonHtml', 'massPrayerHtml', 'massLinesHtml', 'massPartHtml', 'massEpHtml', 'massFormulary', 'massReadingsHtml', 'massAcksHtml', 'massDayFlags', 'massPrefs', 'saveMassPrefs', 'massSectionHtml', 'paintMassScroll', 'wireMassLatin']) {
  const src = extractFn(COOKED, fn);
  if (!src) { ok(false, 'extract ' + fn, 'not found in cooked APP_JS'); }
  else vm.runInContext(src, ctx);
}
vm.runInContext('var massReadings = null;', ctx);
const run = (code) => vm.runInContext(code, ctx);
const ORDER = run('MASS_ORDER'), ROLES = run('MASS_ROLES'), LATIN = run('MASS_LATIN'), LATIN_ROLES = run('MASS_LATIN_ROLES');

/* ---------------- R: data integrity + texts unchanged ---------------- */
{
  const segs = Object.keys(ORDER);
  ok(segs.every((k) => typeof ROLES[k] === 'string' && ROLES[k].length === ORDER[k].length),
    'R1 every Order segment carries a roles string of equal length');
  ok(segs.every((k) => /^[Pprhdx]+$/.test(ROLES[k])), 'R2 role codes are only P p r h d x');
  ok(Object.keys(LATIN).every((k) => LATIN_ROLES[k] === 'P'.repeat(LATIN[k].length)),
    'R3 every Latin part carries an all-people roles string of equal length');
  const base = execFileSync('git', ['-C', ROOT, 'show', 'release/v488-ship:app/worker/src/client.ts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const bA = base.indexOf('APP_JS = `') + 10, bB = base.lastIndexOf('`;');
  const BASE_COOKED = new Function('return `' + base.slice(bA, bB) + '`')();
  const bd0 = BASE_COOKED.indexOf('var MASS_ORDER = '), bd1 = BASE_COOKED.indexOf('/*__/MASS_DATA__*/');
  const bctx = { console };
  vm.createContext(bctx);
  vm.runInContext(BASE_COOKED.slice(bd0, bd1), bctx);
  ok(JSON.stringify(ORDER) === JSON.stringify(bctx.MASS_ORDER), 'R4 MASS_ORDER texts byte-identical to the v488 ship tree (presentation only)');
  ok(JSON.stringify(LATIN) === JSON.stringify(bctx.MASS_LATIN), 'R5 MASS_LATIN texts byte-identical to the v488 ship tree');
  const strip = (src) => src.slice(src.indexOf('= {') + 2).replace(/;\s*$/, '');
  ok(strip(fs.readFileSync(SRC + '/mass-calendar.ts', 'utf8')) === strip(execFileSync('git', ['-C', ROOT, 'show', 'release/v488-ship:app/worker/src/mass-calendar.ts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })),
    'R6 the calendar dataset is byte-identical to the v488 ship tree');
}

/* ---------------- real day payloads (mass.ts) ---------------- */
const TMP = fs.mkdtempSync('/tmp/v489-harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [SRC + '/mass.ts', '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/mass.cjs'], { stdio: 'pipe' });
const MASS = await import(TMP + '/mass.cjs');
const { massPayload, SEASON_PAGES } = MASS.default ?? MASS;
const pageCache = {
  [SEASON_PAGES['Ordinary Time']]: fs.readFileSync(FIX6 + '/src-ordinary-time.htm', 'utf8'),
  [SEASON_PAGES['Advent']]: fs.readFileSync(FIX6 + '/adventmass.htm', 'utf8'),
  [SEASON_PAGES['Christmas']]: fs.readFileSync(FIX6 + '/christmasmass.htm', 'utf8'),
  [SEASON_PAGES['Lent']]: fs.readFileSync(FIX6 + '/lentmass.htm', 'utf8'),
  [SEASON_PAGES['Easter']]: fs.readFileSync(FIX6 + '/eastermass.htm', 'utf8'),
  'http://www.liturgies.net/Liturgies/Catholic/roman_missal/roman_missal_commons.htm': fs.readFileSync(FIX6 + '/src-commons.htm', 'utf8'),
  'https://www.liturgies.net/saints/elizabethofhungary/readings.htm': fs.readFileSync(FIX6 + '/src-saint-elizabethofhungary.htm', 'utf8'),
};
globalThis.fetch = async (url) => {
  const body = pageCache[url];
  if (body == null) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => body };
};
const noDbEnv = { DB: { prepare: () => { throw new Error('no db in harness'); } } };

const payloads = {};
for (const d of ['2026-11-17', '2026-11-22', '2026-11-29', '2026-11-30']) {
  payloads[d] = await massPayload(noDbEnv, d);
}
const readingsToday = JSON.parse(fs.readFileSync(FIX7 + '/payload-20261117.json', 'utf8'));
const readingsSunday = JSON.parse(fs.readFileSync(FIX7 + '/payload-20261122.json', 'utf8'));

function renderDay(date, readings, opts) {
  const p = payloads[date];
  run('massReadings = ' + JSON.stringify(readings));
  ctx.state.mass = { date, payload: p, version: (opts && opts.version) || p.defaultVersion, ep: (opts && opts.ep) || 'II', latin: (opts && opts.latin) || {}, textSize: (opts && typeof opts.textSize === 'number') ? opts.textSize : 1, dateLabel: date };
  run('paintMassScroll()');
  return ctx.view.innerHTML;
}
const SECTIONS = ['Introductory Rites', 'Liturgy of the Word', 'Liturgy of the Eucharist', 'Communion Rite', 'Concluding Rites'];
const secIdx = (html, name) => html.indexOf('<div class="mass-section">' + name + '</div>');

/* ---------------- N: the big section titles ---------------- */
{
  for (const [label, date, readings] of [['Tue', '2026-11-17', readingsToday], ['Sun', '2026-11-22', readingsSunday]]) {
    const html = renderDay(date, readings);
    ok((html.match(/<div class="mass-section">/g) || []).length === 5, 'N-' + label + ' exactly five big section titles render');
    const idx = SECTIONS.map((s) => secIdx(html, s));
    ok(idx.every((v) => v >= 0), 'N-' + label + ' all five titles stand: ' + SECTIONS.join(' · '));
    ok(idx.every((v, i) => i === 0 || v > idx[i - 1]), 'N-' + label + ' the titles stand in the named order');
    ok(idx[0] < html.indexOf('<div class="mass-h">Entrance Antiphon</div>'), 'N-' + label + ' Introductory Rites stands before the Entrance Antiphon');
    ok(idx[1] > html.indexOf('<div class="mass-h">Collect</div>') && idx[1] < html.indexOf('<div class="mass-h">First Reading</div>'),
      'N-' + label + ' Liturgy of the Word stands after the Collect, before the First Reading');
    ok(idx[2] > html.indexOf('<div class="mass-h">Gospel</div>') && idx[2] < html.indexOf('Blessed are you, Lord God of all creation,'),
      'N-' + label + ' Liturgy of the Eucharist stands after the readings, before the offertory\u2019s first spoken line');
    ok(idx[3] > html.indexOf('<div class="mass-h">Prayer over the Offerings</div>') && idx[3] < html.indexOf('we dare to say:'),
      'N-' + label + ' Communion Rite stands before the Communion movement\u2019s first line (\u201cwe dare to say:\u201d)');
    const conclLine = ORDER.concluding.find((ln, i) => 'Pp'.includes(ROLES.concluding.charAt(i)));
    ok(idx[4] > html.indexOf('<div class="mass-h">Prayer after Communion</div>') && html.indexOf(conclLine, idx[4]) > idx[4],
      'N-' + label + ' Concluding Rites stands after Prayer after Communion, before the concluding segment\u2019s first spoken line');
  }
  const sun = renderDay('2026-11-22', readingsSunday);
  ok(secIdx(sun, 'Liturgy of the Eucharist') > sun.indexOf('I believe in one God'),
    'N-Sun Liturgy of the Eucharist stands after the Creed on a Sunday (the offertory follows the Creed outro)');
  const base = U_SRC.match(/\.mass-section \{[^}]*font-size: ([\d.]+)px/);
  const hBase = U_SRC.match(/\.mass-h \{[^}]*font-size: ([\d.]+)px/);
  ok(base && parseFloat(base[1]) === 22, 'N-css .mass-section stands at 22px at the base size', base && base[1]);
  ok(base && hBase && parseFloat(base[1]) > parseFloat(hBase[1]), 'N-css the big title is larger than the .mass-h heading at the base size');
  for (const [cls, sec, h] of [['ts-0', 20, 12], ['ts-2', 24.5, 14.5], ['ts-3', 28, 16.5]]) {
    const m = U_SRC.match(new RegExp('\\.mass-scroll\\.' + cls + ' \\.mass-section \\{ font-size: ([\\d.]+)px; \\}'));
    ok(m && parseFloat(m[1]) === sec && sec > h, 'N-css ' + cls + ' steps the big title to ' + sec + 'px (above .mass-h at ' + h + 'px)', m && m[1]);
  }
}

/* ---------------- G: the toggle boxes ---------------- */
{
  const tue = renderDay('2026-11-17', readingsToday);
  const sun = renderDay('2026-11-22', readingsSunday);
  for (const [label, html, date, ltCount] of [['Tue', tue, '2026-11-17', 3], ['Sun', sun, '2026-11-22', 4]]) {
    ok(html.includes('<span class="segtoggle pill mass-seg"><button data-tsize="-1"'), 'G-' + label + ' the text-size control is one connected pill group');
    if ((payloads[date].versions || []).length > 1) {
      ok(html.includes('<div class="segtoggle pill mass-seg mass-vpicker">'), 'G-' + label + ' the version picker is one connected pill group');
    } else {
      ok(!html.includes('data-version'), 'G-' + label + ' no version picker stands on a single-version day (as v488)');
    }
    ok((html.match(/segtoggle pill mass-seg mass-ltoggle/g) || []).length === ltCount,
      'G-' + label + ' each standing Latin toggle is one connected pill group (' + ltCount + ' parts)', String((html.match(/mass-ltoggle/g) || []).length));
    ok(html.includes('<div class="mass-h">Eucharistic Prayer</div>'), 'G-' + label + ' the Eucharistic Prayer label stands as the part heading');
    const epAt = html.indexOf('segtoggle pill mass-seg mass-eptoggle');
    const epGroup = epAt >= 0 ? html.slice(epAt, html.indexOf('</div>', epAt)) : '';
    ok(epAt >= 0 && ['>I</button>', '>II</button>', '>III</button>', '>IV</button>'].every((s) => epGroup.includes(s)),
      'G-' + label + ' the EP toggle is one connected pill group with the short labels I · II · III · IV');
    ok(!html.includes('Eucharistic Prayer I') && !html.includes('>Eucharistic Prayer II<') && !html.includes('Eucharistic Prayer III') && !html.includes('Eucharistic Prayer IV'),
      'G-' + label + ' no long-form EP button label stands anywhere');
    ok(!html.includes('mass-picker') && !html.includes('mass-eplabel'), 'G-' + label + ' no legacy toggle container stands in the scroll');
  }
  const segRule = (U_SRC.match(/\.mass-seg \{[^}]*\}/) || [''])[0];
  ok(segRule.includes('flex-wrap: nowrap'), 'G-css .mass-seg carries the one-row guarantee (flex-wrap: nowrap)', segRule);
  ok(/\.segtoggle\.pill\.mass-seg button \{[^}]*white-space: nowrap/.test(U_SRC), 'G-css the Mass pill buttons never wrap their labels (white-space: nowrap)');
  ok(!U_SRC.includes('.mass-picker { display: flex; flex-wrap: wrap') && !U_SRC.includes('.mass-eptoggle { display: flex'),
    'G-css the legacy wrapping toggle rules are retired');
  ok(/\.mass-controls \{[^}]*flex-wrap: nowrap/.test(U_SRC), 'G-css the controls row itself never wraps');
}

/* ---------------- F: function preserved ---------------- */
{
  renderDay('2026-11-22', readingsSunday);
  for (const part of ['gloria', 'agnus']) {
    const enKey = { gloria: 'gloriaEn', agnus: 'agnusEn' }[part];
    ctx.state.mass.latin = {};
    const en1 = run('massPartHtml(' + JSON.stringify(part) + ', MASS_ORDER.' + enKey + ', "X")');
    ctx.state.mass.latin = { [part]: 'la' };
    const la = run('massPartHtml(' + JSON.stringify(part) + ', MASS_ORDER.' + enKey + ', "X")');
    ok(la !== en1 && la.includes(LATIN[part][0]), 'F-' + part + ' the Latin toggle swaps the part to its Latin text');
    ctx.state.mass.latin = {};
    const en2 = run('massPartHtml(' + JSON.stringify(part) + ', MASS_ORDER.' + enKey + ', "X")');
    ok(en2 === en1, 'F-' + part + ' the Latin toggle restores the English byte-equal');
  }
  ctx.state.mass.latin = {};
  for (const k of ['I', 'II', 'III', 'IV']) {
    ctx.state.mass.ep = k;
    const segName = k === 'IV' ? 'epIV' : 'ep' + k;
    const line = ORDER[segName].find((ln, i) => 'Pp'.includes(ROLES[segName].charAt(i)) && ln.length > 12);
    const html = run('massEpHtml()');
    ok(html.includes(line), 'F-EP ' + k + ' renders in place (its own text stands)', line && line.slice(0, 44));
  }
  const sun = renderDay('2026-11-22', readingsSunday);
  ok(sun.includes('<button data-ep="II" class="active">II</button>'), 'F-EP II stands active on open (the standing default)');
  ctx.state.mass.ep = 'II';
}

/* ---------------- S: the bold sample (v488 carried) ---------------- */
{
  const sun = renderDay('2026-11-22', readingsSunday);
  const f22 = payloads['2026-11-22'].versions[0].formulary;
  const collectLine = String(f22.collect).split('\n')[0];
  ok(sun.includes('<div class="mass-line">' + collectLine + '</div>'), 'S1 the Collect renders regular (priest)');
  ok(sun.includes('<div class="mass-line mass-people">And with your spirit.</div>'), 'S2 "And with your spirit" renders bold (people)');
  ok(sun.includes('<div class="mass-line mass-people">Holy, Holy, Holy Lord God of hosts.</div>'), 'S3 the Sanctus renders bold (people)');
  ok(sun.includes('<div class="mass-line">You are indeed Holy, O Lord,</div>'), 'S4 an EP II line renders regular (priest)');
  ok(sun.includes('<div class="mass-line mass-people">Thanks be to God.</div>'), 'S5 "Thanks be to God" after a reading renders bold (people)');
  ok(sun.includes('<div class="mass-line mass-people">Our Father, who art in heaven,</div>'), 'S6 the Pater Noster renders bold (people)');
}

/* ---------------- T: the size control (v488 carried) ---------------- */
{
  for (let s = 0; s <= 3; s++) {
    const html = renderDay('2026-11-22', readingsSunday, { textSize: s });
    ok(html.startsWith('<div class="mass-scroll ts-' + s + '">'), 'T' + (s + 1) + 'a size ' + s + ' puts its scale class on the scroll');
    ok(html.includes('<span class="mass-csize">' + ['Small', 'Medium', 'Large', 'Extra large'][s] + '</span>'), 'T' + (s + 1) + 'b the controls row names the size');
  }
  ok(renderDay('2026-11-22', readingsSunday, { textSize: 0 }).includes('data-tsize="-1" disabled'), 'T5 the stepper stops at Small');
  ok(renderDay('2026-11-22', readingsSunday, { textSize: 3 }).includes('data-tsize="1" disabled'), 'T6 the stepper stops at Extra large');
  ok(run('massPrefs().size') === 1, 'T7 with nothing stored, the size defaults to Medium');
  lsStore['opn-mass-prefs-v488'] = '{"size":3}';
  ok(run('massPrefs().size') === 3, 'T8 a stored size is read back on open');
  ctx.state.mass.textSize = 2;
  run('saveMassPrefs()');
  ok(lsStore['opn-mass-prefs-v488'] === '{"size":2}', 'T9 a size change is written to the store');
  delete lsStore['opn-mass-prefs-v488'];
}

/* ---------------- C + D: no commentary, day-true (v488 carried) ---------------- */
{
  const NAMED_RUBRICS = ['The people reply:', '21. When all this has been done', 'He joins his hands.', '104. Then he says:', 'A brief pause for silence follows.'];
  for (const [label, date, readings] of [['Tue', '2026-11-17', readingsToday], ['Sun', '2026-11-22', readingsSunday]]) {
    const html = renderDay(date, readings);
    for (const r of NAMED_RUBRICS) ok(!html.includes(r), 'C-' + label + ' rubric absent: ' + r.slice(0, 40));
    ok(!html.includes('mass-rubric'), 'C-' + label + ' no rubric-styled line stands in the scroll');
  }
  const tue = renderDay('2026-11-17', readingsToday);
  ok(!tue.includes('Glory to God in the highest') && !tue.includes('I believe in one God'),
    'D1 memorial weekday: the scroll carries NO Gloria and NO Creed');
  const sun = renderDay('2026-11-22', readingsSunday);
  ok(sun.includes('Glory to God in the highest') && sun.includes('I believe in one God'),
    'D2 Sunday: the scroll carries the Gloria and the Creed');
  const feast = renderDay('2026-11-30', readingsToday);
  ok(feast.includes('Glory to God in the highest') && !feast.includes('I believe in one God'),
    'D3 feast (Saint Andrew): the Gloria stands, the Creed does not');
  const adv = renderDay('2026-11-29', readingsSunday);
  ok(!adv.includes('Glory to God in the highest') && adv.includes('I believe in one God'),
    'D4 First Sunday of Advent: NO Gloria, the Creed stands');
}

console.log('\nharness-v489: ' + pass + ' ok, ' + fail + ' not ok');
process.exit(fail ? 1 : 0);
