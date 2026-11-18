// harness-v532.mjs — v532 evidence: the priest's quiet
// (low-voice) prayers in the Mass tab's Order of Mass stand
// in ITALICS, each preceded by the marker "(priest says
// quietly)" (John, Ora thread 2026-11-18 08:40 CT; the
// marker BEFORE the italicized text per his amendment of
// 08:41 CT). The census stands in the release document,
// section 2: eight prayers whose own rubric lines in the
// Missal text the app serves direct a low voice — the
// offertory bread prayer (§23), the water-and-wine mingling
// (§24), the offertory wine prayer (§25), With humble
// spirit (§26), the Lavabo (§28), the Communion mingling
// (§129), and the two alternative preparations before
// Communion (§131). The build adds ONE role code — q — to
// MASS_ROLES at exactly the census indices (mass-order.ts
// is the record; the client copy is refreshed by the
// standing splice), ONE renderer branch in massLinesHtml
// (a q line renders .mass-line.mass-quiet; the first line
// of an unbroken q run is preceded by one
// .mass-quiet-note marker div), and the CSS in ui.ts
// (.mass-quiet italic, riding on .mass-line so the
// text-size scale applies; .mass-quiet-note in the rubric
// register, joining the ts scale beside .mass-rubric).
// No word of the Mass text changes.
//   S statics: index.ts / mass.ts / mass-calendar.ts /
//     mass-readings.ts byte-identical to the v530-ship
//     base · mass-order.ts differs only by the three role
//     strings + the legend naming q (normalized away ->
//     byte-equal) · client.ts differs only by the same
//     spliced data + the massLinesHtml comment/q branch
//     (both normalized away -> byte-equal) · ui.ts differs
//     only by the v532 CSS block + the three ts scale
//     lines + the pin (normalized -> byte-equal) · no
//     migration past 0039
//   R record: the client's MASS_ORDER / MASS_ROLES parse
//     out of the shipped client and equal the mass-order.ts
//     record exactly; every section's roles length equals
//     its lines length; the q census in the data is exactly
//     the document's eight prayers (36 lines)
//   C client (Chromium, stubbed fetch, production-shaped
//     day): cooked parse + boot clean · C1-C8 each census
//     prayer — every line carries .mass-quiet, exactly one
//     marker with the exact text "(priest says quietly)"
//     stands immediately BEFORE its first line, and the
//     run ends where the census ends · totals: exactly 8
//     markers and 36 quiet lines in the whole scroll · the
//     computed style of a quiet line is italic, the
//     marker's is upright regular · N1 §132 "Behold the
//     Lamb of God" (its rubric says aloud) and §126's peace
//     prayer render regular, unmarked · N2 the people's
//     "Blessed be God for ever." still renders bold,
//     unmarked · W the scroll's rendered text sequence
//     (marker divs aside) is word-for-word the base
//     build's — no word altered, added, or dropped
//   G439 (recorded as-is, NEVER a v532 pass): the standing
//     v439 boot gate run on this tree reads its standing
//     13 ok / 2 not-ok (B5 premise-superseded · B3
//     superseded by v492's boot rule)
// Fixtures (Improvement D): the day payload is the
// standing live fixture (tests/fixtures-v522/
// day-live-2026-11-17.json, drawn from production through
// the prayer door after the v521 ship); the Mass payload
// is built from the production MASS_CALENDAR entry for
// 2026-11-17 (tests/fixtures-v523/
// mass-calendar-2026-11-17.json, extracted verbatim from
// production mass-calendar.ts at v523's Scope) in the
// standing server shape, with the v511/v523 harness stub
// formulary — harness dressing only; the Order of Mass
// text the census judges is the app's own shipped
// MASS_ORDER, read out of the built client itself.
// The base for byte comparisons is the v530 ship tree
// (H532_BASE overrides).
// Run: node app/tests/harness-v532.mjs [--probe] (from
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
const O_SRC = readFileSync(SRC + '/mass-order.ts', 'utf8');
const BASE = process.env.H532_BASE || path.resolve(ROOT, '../../.worktrees/v530-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const O_BASE = readFileSync(BASE + '/mass-order.ts', 'utf8');
const FX = APP + '/tests/fixtures-v523';
const SHORT = JSON.parse(readFileSync(FX + '/mass-calendar-2026-11-17.json', 'utf8'));
const DAY = JSON.parse(readFileSync(APP + '/tests/fixtures-v522/day-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- S: statics ---------------- */
const ROLE_PAIRS = [
  ['hrrrppppprrPrppprppppprrPrpppprrppr', 'hrrrqqqqqrrPrqqqrqqqqqrrPrqqqqrrqqr'],
  ['rppppppprrPPPrppppppprprPrprPrprrpppr', 'rppppppprrPPPrppppppprprPrprPrprrqqqr'],
  ['rrpppppppprpppppprppprPPPP', 'rrqqqqqqqqrqqqqqqrppprPPPP'],
];
const LEGEND_OLD = 'document, section 2, Control 4 audit). The rubric';
const LEGEND_NEW = 'document, section 2, Control 4 audit) · q the priest\'s\n// quiet (low-voice) words (v532: rendered italic, with a\n// "(priest says quietly)" marker before each prayer — the\n// census stands in the v532 release document, section 2).\n// The rubric';
function denormRoles(s) {
  let out = s;
  for (const [o, n] of ROLE_PAIRS) out = out.split(n).join(o);
  return out.split(LEGEND_NEW).join(LEGEND_OLD);
}
{
  for (const f of ['index.ts', 'mass.ts', 'mass-calendar.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S1-' + f + ': byte-identical to the v530-ship base');
  }
  ok(denormRoles(O_SRC) === O_BASE,
    'S2: mass-order.ts differs from the base only by the three census role strings and the legend naming q');
  // client.ts: normalize the spliced data the same way, then
  // swap the whole v488 comment + massLinesHtml segment for
  // the base's (the only hand-written client change).
  const segOf = (s) => {
    const a = s.indexOf('/* v488: role-aware line rendering.');
    const b = s.indexOf('/* v487: the Universalis readings payload');
    return [a, b];
  };
  const [ba, bb] = segOf(C_BASE);
  const [na, nb] = segOf(C_SRC);
  ok(ba > 0 && na > 0 && bb > ba && nb > na, 'S3-pre: the massLinesHtml segment stands in both trees');
  const clientNorm = denormRoles(C_SRC.slice(0, na) + C_BASE.slice(ba, bb) + C_SRC.slice(nb));
  ok(clientNorm === C_BASE,
    'S3: client.ts differs from the base only by the spliced census data and the massLinesHtml q branch');
  ok(C_SRC.includes("if (role === 'q')") && C_SRC.includes('mass-quiet-note">(priest says quietly)</div>'),
    'S4: the q branch and the exact marker text stand in the build client');
  const V532_CSS = [
    '/* v532: the priest\'s quiet (low-voice) words stand italic',
    '   (riding on .mass-line, so the text-size scale applies in',
    '   step); the "(priest says quietly)" marker before each',
    '   such prayer stands in the rubric register — the',
    '   .mass-rubric values, upright and regular weight. */',
    '.mass-quiet { font-style: italic; }',
    '.mass-quiet-note { font-size: 13px; line-height: 1.45; opacity: .62; margin: 3px 0; }',
  ].join('\n');
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  let uNorm = U_SRC.split(V532_CSS + '\n').join('');
  uNorm = uNorm
    .split('.mass-scroll.ts-0 .mass-rubric, .mass-scroll.ts-0 .mass-quiet-note { font-size: 12px; }').join('.mass-scroll.ts-0 .mass-rubric { font-size: 12px; }')
    .split('.mass-scroll.ts-2 .mass-rubric, .mass-scroll.ts-2 .mass-quiet-note { font-size: 14.5px; }').join('.mass-scroll.ts-2 .mass-rubric { font-size: 14.5px; }')
    .split('.mass-scroll.ts-3 .mass-rubric, .mass-scroll.ts-3 .mass-quiet-note { font-size: 16.5px; }').join('.mass-scroll.ts-3 .mass-rubric { font-size: 16.5px; }');
  ok(U_SRC.includes(V532_CSS), 'S5: the v532 CSS block stands in ui.ts in its named form');
  ok(pin(uNorm) === pin(U_BASE),
    'S6: ui.ts with the v532 CSS and the pin normalized is byte-identical to the base — the dress is the ONLY change');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1].startsWith('0039'), 'S7: no migration past 0039 stands', migs[migs.length - 1]);
}

/* ---------------- R: the record ---------------- */
function dataOf(src, worker) {
  const a = src.indexOf(worker ? 'export const MASS_ORDER' : 'var MASS_ORDER = {');
  const b = src.indexOf(worker ? 'export const MASS_LATIN_ROLES' : 'var MASS_LATIN_ROLES = {');
  const seg = src.slice(a, src.indexOf('};', b) + 2)
    .split('export const ').join('var ')
    .replace(/: Record<string, string\[\]>/g, '').replace(/: Record<string, string>/g, '');
  const fn = new Function(seg + '\nreturn { MASS_ORDER, MASS_ROLES };');
  return fn();
}
const CENSUS = [
  { seg: 'offertory', at: [4, 8], lines: ['Blessed are you, Lord God of all creation,', 'for through your goodness we have received', 'the bread we offer you:', 'fruit of the earth and work of human hands,', 'it will become for us the bread of life.'] },
  { seg: 'offertory', at: [13, 15], lines: ['By the mystery of this water and wine', 'may we come to share in the divinity of Christ', 'who humbled himself to share in our humanity.'] },
  { seg: 'offertory', at: [17, 21], lines: ['Blessed are you, Lord God of all creation,', 'for through your goodness we have received', 'the wine we offer you:', 'fruit of the vine and work of human hands', 'it will become our spiritual drink.'] },
  { seg: 'offertory', at: [26, 29], lines: ['With humble spirit and contrite heart', 'may we be accepted by you, O Lord,', 'and may our sacrifice in your sight this day', 'be pleasing to you, Lord God.'] },
  { seg: 'offertory', at: [32, 33], lines: ['Wash me, O Lord, from my iniquity', 'and cleanse me from my sin.'] },
  { seg: 'communionMid', at: [33, 35], lines: ['May this mingling of the Body and Blood', 'of our Lord Jesus Christ', 'bring eternal life to us who receive it.'] },
  { seg: 'communionPost', at: [2, 9], lines: ['Lord Jesus Christ, Son of the living God,', 'who by the will of the Father', 'and the work of the Holy Spirit,', 'through your Death gave life to the world;', 'free me by this, your most holy Body and Blood,', 'from all my sins and from every evil;', 'keep me always faithful to your commandments,', 'and never let me be parted from you.'] },
  { seg: 'communionPost', at: [11, 16], lines: ['May the receiving of your Body and Blood,', 'Lord Jesus Christ,', 'not bring me to judgment and condemnation,', 'but through your loving mercy', 'be for me protection in mind and body,', 'and a healing remedy.'] },
];
{
  const dc = dataOf(C_SRC, false);
  const dw = dataOf(O_SRC, true);
  ok(JSON.stringify(dc.MASS_ORDER) === JSON.stringify(dw.MASS_ORDER) && JSON.stringify(dc.MASS_ROLES) === JSON.stringify(dw.MASS_ROLES),
    'R1: the client\'s spliced MASS_ORDER + MASS_ROLES equal the mass-order.ts record exactly');
  const misaligned = Object.keys(dc.MASS_ORDER).filter((k) => dc.MASS_ROLES[k].length !== dc.MASS_ORDER[k].length);
  ok(misaligned.length === 0, 'R2: every section\'s roles length equals its lines length', misaligned.join(','));
  let censusOk = true; let qTotal = 0;
  for (const k of Object.keys(dc.MASS_ROLES)) qTotal += (dc.MASS_ROLES[k].match(/q/g) || []).length;
  for (const c of CENSUS) {
    const lines = dc.MASS_ORDER[c.seg]; const roles = dc.MASS_ROLES[c.seg];
    for (let i = c.at[0]; i <= c.at[1]; i++) {
      if (roles.charAt(i) !== 'q' || lines[i] !== c.lines[i - c.at[0]]) censusOk = false;
    }
    if (roles.charAt(c.at[0] - 1) === 'q' || roles.charAt(c.at[1] + 1) === 'q') censusOk = false;
  }
  ok(censusOk && qTotal === 36, 'R3: the data carries q at exactly the census indices — eight prayers, 36 lines, runs bounded', 'qTotal=' + qTotal);
}

/* ---------------- fixtures + pages ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED_BASE = null;
try { COOKED = cook(C_SRC); ok(true, 'P0: the cooked APP_JS parses (the template-literal gate)'); }
catch (e) { ok(false, 'P0: the cooked APP_JS parses (the template-literal gate)', String(e).slice(0, 160)); }
try { COOKED_BASE = cook(C_BASE); } catch (e) { console.log('note - base cook failed:', String(e).slice(0, 120)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const APP_CSS_BASE = U_BASE.slice(U_BASE.indexOf('APP_CSS = `') + 11, U_BASE.indexOf('`;', U_BASE.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

function formulary(key) {
  return {
    entranceAntiphon: { text: 'Antiphon for ' + key + '.', ref: 'Ps 1' },
    collect: 'Collect of the ' + key + ' formulary, granted for this harness day.',
    prayerOverOfferings: 'Offerings of the ' + key + ' formulary.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Communion antiphon for ' + key + '.', ref: 'Mt 5' },
    prayerAfterCommunion: 'After Communion of the ' + key + ' formulary.',
  };
}
function massPayload(entry) {
  return {
    ok: true, name: entry.name, season: 'Ordinary Time',
    defaultVersion: entry.defaultVersion,
    versions: entry.versions.map((v) => ({ key: v.key, label: v.label, rank: v.rank, formulary: formulary(v.key) })),
  };
}
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town.</p>' },
] };

function buildPage(cooked, css, payload) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push({ path: p });
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); } }); };
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(payload)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, { ok: true, groups: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
  if (p.indexOf('/api/prayer/mass-universal-prayer') === 0) return ans(200, { ok: true, intentions: [] });
  return ans(200, { ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function(){ el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
HTMLMediaElement.prototype.load = function () {};
</` + `script>
<script>
${cooked}
</` + `script>
</body></html>`;
}

const PAGES = {
  '/day': buildPage(COOKED, APP_CSS, massPayload(SHORT)),
  '/day-base': buildPage(COOKED_BASE, APP_CSS_BASE, massPayload(SHORT)),
};
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (PAGES[u]) { res.setHeader('Content-Type', 'text/html'); res.end(PAGES[u]); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(which, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
  });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note -', tag, 'openblock slow'));
  await sleep(400);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note -', tag, 'mass scroll slow'));
  await page.waitForFunction(() => {
    const els = document.querySelectorAll('.mass-scroll .mass-line');
    for (const el of els) if (el.textContent === 'Wash me, O Lord, from my iniquity') return true;
    return false;
  }, null, { timeout: 15000 }).catch(() => console.log('note -', tag, 'offertory slow'));
  await sleep(300);
  return { ctx, page };
}
const dump = (page) => page.evaluate(() => {
  const els = document.querySelectorAll('.mass-scroll .mass-line, .mass-scroll .mass-quiet-note, .mass-scroll .mass-sh');
  return Array.from(els).map((el) => ({ cls: el.className, text: el.textContent }));
});
const NAMES = ['§23 bread', '§24 water and wine', '§25 wine', '§26 humble spirit', '§28 Lavabo', '§129 mingling', '§131 first form', '§131 second form'];
{
  const errs = [];
  const { ctx, page } = await boot('/day', errs, 'build');
  const d = await dump(page);
  // occurrence tracking for the duplicated bread/wine first line
  const seen = {};
  for (let ci = 0; ci < CENSUS.length; ci++) {
    const c = CENSUS[ci];
    const first = c.lines[0];
    const occ = seen[first] || 0; seen[first] = occ + 1;
    let at = -1; let n = -1;
    for (let i = 0; i < d.length; i++) {
      if (d[i].text === first && d[i].cls.indexOf('mass-line') >= 0) { n++; if (n === occ) { at = i; break; } }
    }
    let good = at > 0;
    let why = good ? '' : 'first line not found';
    if (good) {
      const prev = d[at - 1];
      if (!(prev.cls.indexOf('mass-quiet-note') >= 0 && prev.text === '(priest says quietly)')) { good = false; why = 'no marker immediately before: ' + JSON.stringify(prev); }
      for (let j = 0; j < c.lines.length; j++) {
        const el = d[at + j];
        if (!el || el.text !== c.lines[j] || el.cls.indexOf('mass-quiet') < 0) { good = false; why = 'line ' + j + ' wrong: ' + JSON.stringify(el); break; }
      }
      if (good) {
        const after = d[at + c.lines.length];
        if (after && after.cls.indexOf('mass-quiet') >= 0 && after.cls.indexOf('mass-quiet-note') < 0) { good = false; why = 'run overruns into: ' + JSON.stringify(after); }
      }
    }
    ok(good, 'C' + (ci + 1) + ': ' + NAMES[ci] + ' — every line italic (mass-quiet), one "(priest says quietly)" marker immediately before', why);
  }
  const notes = d.filter((x) => x.cls.indexOf('mass-quiet-note') >= 0);
  const quiets = d.filter((x) => x.cls.indexOf('mass-quiet') >= 0 && x.cls.indexOf('mass-quiet-note') < 0);
  ok(notes.length === 8 && notes.every((x) => x.text === '(priest says quietly)'),
    'C9: exactly 8 markers stand in the whole scroll, each with the exact text', 'notes=' + notes.length);
  ok(quiets.length === 36, 'C10: exactly 36 quiet lines stand in the whole scroll', 'quiets=' + quiets.length);
  const styles = await page.evaluate(() => {
    const q = document.querySelector('.mass-scroll .mass-quiet');
    const note = document.querySelector('.mass-scroll .mass-quiet-note');
    const plain = document.querySelector('.mass-scroll .mass-line:not(.mass-quiet):not(.mass-people)');
    const cs = (el) => el ? { fs: getComputedStyle(el).fontStyle, fw: getComputedStyle(el).fontWeight } : null;
    return { q: cs(q), note: cs(note), plain: cs(plain) };
  });
  ok(styles.q && styles.q.fs === 'italic', 'C11: a quiet line computes font-style italic', JSON.stringify(styles.q));
  ok(styles.note && styles.note.fs === 'normal' && (styles.note.fw === '400' || styles.note.fw === 'normal'),
    'C12: the marker computes upright and regular weight (the rubric register)', JSON.stringify(styles.note));
  ok(styles.plain && styles.plain.fs === 'normal', 'C13: an ordinary priest line computes upright — the italic is the quiet dress only', JSON.stringify(styles.plain));
  const findLine = (text) => d.findIndex((x) => x.text === text && x.cls.indexOf('mass-line') >= 0);
  const behold = findLine('Behold the Lamb of God,');
  ok(behold > 0 && d[behold].cls.indexOf('mass-quiet') < 0 && d[behold - 1].cls.indexOf('mass-quiet-note') < 0,
    'N1a: §132 "Behold the Lamb of God" (rubric: says aloud) renders regular, unmarked', behold >= 0 ? d[behold].cls : 'missing');
  const peace = findLine('Lord Jesus Christ,');
  ok(peace > 0 && d[peace].cls.indexOf('mass-quiet') < 0 && d[peace - 1].cls.indexOf('mass-quiet-note') < 0,
    'N1b: §126\'s peace prayer (rubric: says aloud) renders regular, unmarked', peace >= 0 ? d[peace].cls : 'missing');
  const blessed = findLine('Blessed be God for ever.');
  ok(blessed > 0 && d[blessed].cls.indexOf('mass-people') >= 0 && d[blessed].cls.indexOf('mass-quiet') < 0 && d[blessed - 1].cls.indexOf('mass-quiet-note') < 0,
    'N2: the people\'s "Blessed be God for ever." still renders bold, unmarked', blessed >= 0 ? d[blessed].cls : 'missing');
  // W: word identity against the base build
  const errsB = [];
  const base = await boot('/day-base', errsB, 'base');
  const db = await dump(base.page);
  const textsBuild = d.filter((x) => x.cls.indexOf('mass-quiet-note') < 0).map((x) => x.text);
  const textsBase = db.map((x) => x.text);
  ok(JSON.stringify(textsBuild) === JSON.stringify(textsBase),
    'W1: the scroll\'s rendered text sequence (markers aside) is word-for-word the base build\'s — no word altered, added, or dropped',
    'build=' + textsBuild.length + ' base=' + textsBase.length);
  ok(db.every((x) => x.cls.indexOf('mass-quiet') < 0), 'W2: the base build carries no quiet dress (the premise)');
  ok(errs.length === 0, 'C14: no page errors on the build boot', errs.join(' | ').slice(0, 160));
  await ctx.close(); await base.ctx.close();
}

/* ---------------- G439: recorded as-is ---------------- */
{
  let out = '';
  try { out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const m = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!m && m[1] === '13' && m[2] === '2',
    'G439 (recorded as-is, not a v532 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    m ? m[0] : out.slice(-200));
}

await browser.close();
server.close();
console.log('harness-v532: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) console.log('failures: ' + failures.join(' · '));
process.exit(fail ? 1 : 0);
