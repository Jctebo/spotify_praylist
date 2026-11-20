// harness-v488 — v488: Mass reader controls (resizable text ·
// people bold, priest regular · commentary removed, not
// toggled) + the day-true Order (John's amendment,
// 2026-11-17 00:37 CT).
//
// Fixtures are REAL (Improvement D):
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
//   R   roles data integrity + the standing texts unchanged.
//   S   the named bold/regular sample (EP II and EP I, Latin
//       shown), antiphon, psalm response, GA, closing split.
//   T   the size control: scale classes, names, persistence.
//   C   commentary: named rubric lines absent on every
//       fixture day; every spoken line present.
//   D   day-true: ferial/memorial · Sunday · feast · Advent
//       Sunday; the excluded forms absent; calendar ranks.

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
for (const fn of ['esc', 'massDecodeEntities', 'massCleanLines', 'massCleanText', 'massReadingTextHtml', 'massGaTextHtml', 'massTextHtml', 'massAntiphonHtml', 'massPrayerHtml', 'massLinesHtml', 'massPartHtml', 'massEpHtml', 'massFormulary', 'massReadingsHtml', 'massAcksHtml', 'massDayFlags', 'massPrefs', 'saveMassPrefs', 'paintMassScroll', 'wireMassLatin']) {
  const src = extractFn(COOKED, fn);
  if (!src) { ok(false, 'extract ' + fn, 'not found in cooked APP_JS'); }
  else vm.runInContext(src, ctx);
}
vm.runInContext('var massReadings = null;', ctx);
const run = (code) => vm.runInContext(code, ctx);
const ORDER = run('MASS_ORDER'), ROLES = run('MASS_ROLES'), LATIN = run('MASS_LATIN'), LATIN_ROLES = run('MASS_LATIN_ROLES');

/* ---------------- R: roles data integrity ---------------- */
{
  const segs = Object.keys(ORDER);
  ok(segs.every((k) => typeof ROLES[k] === 'string' && ROLES[k].length === ORDER[k].length),
    'R1 every Order segment carries a roles string of equal length');
  ok(segs.every((k) => /^[Pprhdx]+$/.test(ROLES[k])), 'R2 role codes are only P p r h d x');
  ok(Object.keys(LATIN).every((k) => LATIN_ROLES[k] === 'P'.repeat(LATIN[k].length)),
    'R3 every Latin part carries an all-people roles string of equal length');
  const base = execFileSync('git', ['-C', ROOT, 'show', 'release/v487-ship:app/worker/src/client.ts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const bA = base.indexOf('APP_JS = `') + 10, bB = base.lastIndexOf('`;');
  const BASE_COOKED = new Function('return `' + base.slice(bA, bB) + '`')();
  const bd0 = BASE_COOKED.indexOf('var MASS_ORDER = '), bd1 = BASE_COOKED.indexOf('/*__/MASS_DATA__*/');
  const bctx = { console };
  vm.createContext(bctx);
  vm.runInContext(BASE_COOKED.slice(bd0, bd1), bctx);
  ok(JSON.stringify(ORDER) === JSON.stringify(bctx.MASS_ORDER), 'R4 MASS_ORDER texts byte-identical to the v487 ship tree (annotation only, no re-cut)');
  ok(JSON.stringify(LATIN) === JSON.stringify(bctx.MASS_LATIN), 'R5 MASS_LATIN texts byte-identical to the v487 ship tree');
}

/* ---------------- real day payloads (mass.ts) ---------------- */
const TMP = fs.mkdtempSync('/tmp/v488-harness-');
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
const scrollText = (html) => html.replace(/<\/div>/g, '\n').replace(/<[^>]*>/g, '');

/* ---------------- D: the calendar + the day rule ---------------- */
{
  const strip = (src) => JSON.parse(src.slice(src.indexOf('= {') + 2).replace(/;\s*$/, ''));
  const stripRank = (data) => JSON.parse(JSON.stringify(data, (k, v) => (k === 'rank' ? undefined : v)));
  const calNew = strip(fs.readFileSync(SRC + '/mass-calendar.ts', 'utf8'));
  const calOld = strip(execFileSync('git', ['-C', ROOT, 'show', 'release/v487-ship:app/worker/src/mass-calendar.ts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  ok(JSON.stringify(stripRank(calNew)) === JSON.stringify(stripRank(calOld)),
    'D1 the regenerated calendar: every standing version byte-identical apart from the added rank');
  const ranks = new Set();
  let allRanked = true;
  for (const e of Object.values(calNew)) for (const v of e.versions) { ranks.add(v.rank); if (!v.rank) allRanked = false; }
  ok(allRanked && [...ranks].every((r) => ['S', 'F', 'M', 'm', 's', 'Sunday', 'ferial'].includes(r)),
    'D2 every version carries a rank from the calendar classification', [...ranks].join(','));
  const defRank = (d) => { const p = payloads[d]; const v = p.versions.find((x) => x.key === p.defaultVersion); return v && v.rank; };
  ok(defRank('2026-11-17') === 'M' && payloads['2026-11-17'].season === 'Ordinary Time', 'D3 Tue 2026-11-17: the memorial version carries rank M, the day season Ordinary Time');
  ok(defRank('2026-11-22') === 'Sunday', 'D4 Sun 2026-11-22: rank Sunday');
  ok(defRank('2026-11-30') === 'F', 'D5 Mon 2026-11-30: the feast of Saint Andrew carries rank F');
  ok(defRank('2026-11-29') === 'Sunday' && payloads['2026-11-29'].season === 'Advent', 'D6 Sun 2026-11-29: rank Sunday, season Advent');

  const tue = renderDay('2026-11-17', readingsToday);
  ok(!tue.includes('Glory to God in the highest') && !tue.includes('I believe in one God'),
    'D7 ferial/memorial day: the scroll carries NO Gloria and NO Creed');
  ok(tue.includes('mass-controls'), 'D8 the size controls stand on the weekday scroll too');
  const sun = renderDay('2026-11-22', readingsSunday);
  ok(sun.includes('Glory to God in the highest') && sun.includes('I believe in one God'),
    'D9 Sunday: the scroll carries the Gloria and the Creed');
  const feast = renderDay('2026-11-30', readingsToday);
  ok(feast.includes('Glory to God in the highest') && !feast.includes('I believe in one God'),
    'D10 feast (Saint Andrew): the Gloria stands, the Creed does not');
  const adv = renderDay('2026-11-29', readingsSunday);
  ok(!adv.includes('Glory to God in the highest') && adv.includes('I believe in one God'),
    'D11 First Sunday of Advent: NO Gloria, the Creed stands');
  const sunEp1 = renderDay('2026-11-22', readingsSunday, { ep: 'I' });
  for (const [label, html] of [['Tue', tue], ['Sun', sun], ['feast', feast], ['Advent Sun', adv], ['Sun EP I', sunEp1]]) {
    ok(!html.includes('Creator of heaven and earth,'), 'D12-' + label + ' the Apostles\u2019 Creed text stands on no day');
    ok(!html.includes('V/. Kyrie, eleison. R/. Kyrie, eleison.'), 'D13-' + label + ' the Greek Kyrie alternative lines do not duplicate the Kyrie');
    ok(!html.includes('Remember your servant N.,'), 'D14-' + label + ' the Masses-for-the-Dead addition does not stand');
    ok(!html.includes('Blessed be the name of the Lord.'), 'D15-' + label + ' the Pontifical blessing block does not stand');
  }
  ok(!sunEp1.includes('On Pentecost Sunday'), 'D16 EP I stands without its seasonal proper-form titles');
  ok(sunEp1.includes('In communion with those whose memory we venerate,'), 'D17 EP I keeps the standard Communicantes');
}

/* ---------------- S: the named sample ---------------- */
{
  const sun = renderDay('2026-11-22', readingsSunday);
  const f22 = payloads['2026-11-22'].versions[0].formulary;
  const collectLine = String(f22.collect).split('\n')[0];
  ok(sun.includes('<div class="mass-line">' + collectLine + '</div>'), 'S1 the Collect renders regular (priest)', collectLine);
  ok(f22.prefaceText && sun.includes('<div class="mass-line">' + String(f22.prefaceText).split('\n')[0] + '</div>'), 'S2 a Preface line renders regular (priest)');
  ok(sun.includes('<div class="mass-line mass-people">And with your spirit.</div>'), 'S3 "And with your spirit" renders bold (people)');
  ok(sun.includes('<div class="mass-line mass-people">Holy, Holy, Holy Lord God of hosts.</div>'), 'S4 the Sanctus renders bold (people)');
  ok(sun.includes('<div class="mass-line">You are indeed Holy, O Lord,</div>'), 'S5 an EP II line renders regular (priest)');
  ok(sun.includes('<div class="mass-line mass-people">Thanks be to God.</div>'), 'S6 "Thanks be to God" after a reading renders bold (people)');
  ok(sun.includes('<div class="mass-line mass-people">Our Father, who art in heaven,</div>'), 'S7 the Pater Noster renders bold (people)');
  const antLine = String(f22.entranceAntiphon.text).split('\n')[0];
  ok(sun.includes('<div class="mass-line mass-people">' + antLine + '</div>'), 'S8 the Entrance Antiphon renders bold (the people\u2019s chant)', antLine);
  ok(sun.includes('<div class="mass-line mass-people">The Lord is my shepherd; there is nothing I shall want.</div>'), 'S9 the psalm response renders bold (people)');
  ok(sun.includes('<div class="mass-line">The word of the Lord.</div>'), 'S10 "The word of the Lord." renders regular (proclaimed)');
  ok(sun.includes('<div class="mass-line mass-people">Alleluia, alleluia!</div>'), 'S11 the Gospel Acclamation refrain renders bold (people)');
  ok(sun.includes('<div class="mass-line">Blessings on him who comes in the name of the Lord!</div>'), 'S12 the Gospel Acclamation verse renders regular (proclaimed)');
  const sun1 = renderDay('2026-11-22', readingsSunday, { ep: 'I' });
  ok(sun1.includes('<div class="mass-line">To you, therefore, most merciful Father,</div>'), 'S13 an EP I line renders regular (priest) with EP I standing');
  ok(sun1.includes('<div class="mass-line mass-people">And with your spirit.</div>'), 'S14 the sample holds with EP I standing (dialogue response bold)');
  const glo = run('massPartHtml("gloria", MASS_ORDER.gloriaEn, "Gloria")');
  ok(glo.includes('<div class="mass-line mass-people">Glory to God in the highest,</div>'), 'S15 the Gloria (English) renders bold (people)');
  ctx.state.mass.latin = { gloria: 'la', sanctus: 'la' };
  const gloLa = run('massPartHtml("gloria", MASS_ORDER.gloriaEn, "Gloria")');
  ok(gloLa.includes('mass-people') && gloLa.includes(LATIN.gloria[0]), 'S16 the Gloria in Latin renders bold by the same roles', LATIN.gloria[0]);
  const sanLa = run('massPartHtml("sanctus", MASS_ORDER.sanctus, "Sanctus")');
  ok(sanLa.includes('mass-people') && sanLa.includes(LATIN.sanctus[0]), 'S17 the Sanctus in Latin renders bold by the same roles', LATIN.sanctus[0]);
  ctx.state.mass.latin = {};
  const kyr = run('massPartHtml("kyrie", MASS_ORDER.kyrieEn, "Kyrie")');
  ok(kyr.includes('V/. Lord, have mercy. <span class="mass-people">R/. Lord, have mercy.</span>'), 'S18 the Kyrie dialogue line: the V/. part regular, the R/. part bold');
}

/* ---------------- T: the size control ---------------- */
{
  for (let s = 0; s <= 3; s++) {
    const html = renderDay('2026-11-22', readingsSunday, { textSize: s });
    ok(html.startsWith('<div class="mass-scroll ts-' + s + '">'), 'T' + (s + 1) + 'a size ' + s + ' puts its scale class on the scroll');
    ok(html.includes('<span class="mass-csize">' + ['Small', 'Medium', 'Large', 'Extra large'][s] + '</span>'), 'T' + (s + 1) + 'b the controls row names the size');
  }
  const t0 = renderDay('2026-11-22', readingsSunday, { textSize: 0 });
  ok(t0.includes('data-tsize="-1" disabled'), 'T5 the stepper stops at Small (A\u2212 disabled)');
  const t3 = renderDay('2026-11-22', readingsSunday, { textSize: 3 });
  ok(t3.includes('data-tsize="1" disabled'), 'T6 the stepper stops at Extra large (A+ disabled)');
  ok(run('massPrefs().size') === 1, 'T7 with nothing stored, the size defaults to Medium');
  lsStore['opn-mass-prefs-v488'] = '{"size":3}';
  ok(run('massPrefs().size') === 3, 'T8 a stored size is read back on open');
  ctx.state.mass.textSize = 2;
  run('saveMassPrefs()');
  ok(lsStore['opn-mass-prefs-v488'] === '{"size":2}', 'T9 a size change is written to the store');
  delete lsStore['opn-mass-prefs-v488'];
  ok(U_SRC.includes('.mass-people { font-weight: 700; }'), 'T10 ui.ts: the people class is bold');
  ok(U_SRC.includes('.mass-scroll.ts-0 .mass-line { font-size: 15px; }') && U_SRC.includes('.mass-scroll.ts-2 .mass-line { font-size: 18.5px; }') && U_SRC.includes('.mass-scroll.ts-3 .mass-line { font-size: 21px; }'),
    'T11 ui.ts: the scale classes step the scroll text (15 / 18.5 / 21 around the standing 16.5)');
}

/* ---------------- C: no commentary, spoken whole ---------------- */
{
  const NAMED_RUBRICS = ['The people reply:', '21. When all this has been done', 'He joins his hands.', '104. Then he says:', '88. Holding his hands extended over the offerings, he says:', 'A brief pause for silence follows.'];
  const days = [['Tue', '2026-11-17', readingsToday, {}], ['Sun', '2026-11-22', readingsSunday, {}], ['Sun EP I', '2026-11-22', readingsSunday, { ep: 'I' }], ['Sun EP IV', '2026-11-22', readingsSunday, { ep: 'IV' }]];
  for (const [label, date, readings, opts] of days) {
    const html = renderDay(date, readings, opts);
    for (const r of NAMED_RUBRICS) ok(!html.includes(r), 'C-' + label + ' rubric absent: ' + r.slice(0, 44));
    ok(!html.includes('mass-rubric'), 'C-' + label + ' no rubric-styled line stands in the scroll');
    ok(html.includes('data-version') || (payloads[date].versions.length <= 1), 'C-' + label + ' the version picker stands where the day carries versions');
    ok(html.includes('data-tsize'), 'C-' + label + ' the size control stands');
  }
  // Every spoken line of the standing segments is present in
  // the Sunday EP II scroll (the parts that stand that day).
  const sun = renderDay('2026-11-22', readingsSunday);
  const text = scrollText(sun);
  const f22 = payloads['2026-11-22'].versions[0].formulary;
  const standingSegs = ['introPre', 'confiteorEn', 'introMid', 'kyrieEn', 'introPost', 'gloriaEn', 'introTail', 'creedEn', 'creedOutro', 'offertory', 'prefaceDialogue', 'sanctus', 'epII', 'communionPre', 'paterEn', 'communionMid', 'agnusEn', 'communionPost', 'concluding'];
  if (!f22.prefaceText) standingSegs.push('commonPreface1');
  let missing = [];
  for (const seg of standingSegs) {
    ORDER[seg].forEach((ln, i) => {
      const role = ROLES[seg].charAt(i);
      if (role === 'r' || role === 'x') return;
      if (role === 'd') {
        const cut = ln.indexOf('R/.');
        if (!text.includes(ln.slice(0, cut).trim()) || !text.includes(ln.slice(cut).trim())) missing.push(seg + ':' + i);
      } else if (!text.includes(ln)) missing.push(seg + ':' + i + ' ' + ln.slice(0, 40));
    });
  }
  ok(missing.length === 0, 'C-spoken every spoken line (P/p/d/h) of the standing segments stands in the Sunday scroll', missing.slice(0, 4).join(' | '));
}

console.log('\nharness-v488: ' + pass + ' ok, ' + fail + ' not ok');
process.exit(fail ? 1 : 0);
