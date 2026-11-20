// harness-v511.mjs — v511 evidence: the Form C
// correction (John, Ora Pro Nobis thread, 2026-11-17
// 15:50 CT): "For Form C, I still have two
// invocations. I just want one. seasonal" — under
// Form C, ONE invocation set stands: the seasonal
// Appendix VI set for the viewed day's season. The
// standing threefold example retires from the page.
// This SUPERSEDES John's 2026-11-17 13:54 CT word
// for v502 ("keep the 3-fold example there"); v502
// shipped example + samples together on that word
// and v503 kept both.
//   The build: a paint-time step dropExample cuts
//   the Form C slice at the absolution's standing
//   first line (every line before it — the example's
//   nine rendered lines and the hidden rubrics among
//   them — is cut, lines and roles together), and
//   massPenBodyHtml paints the seasonal samples
//   block FIRST, in the invocation position, with
//   the absolution following it. The samples
//   renderer and its table are untouched (the exact
//   v503 dress: 'Sample invocations' heading · the
//   asterisk note · the season name · priest lines
//   italic, responses bold).
//   THE NAMED FALLBACK (v511 Plan): an unmapped or
//   null season returns '' from the samples block,
//   so Form C paints the absolution alone — no
//   invocation set, no heading, no note; the retired
//   example never returns and no wrong-season set
//   ever stands.
//   S statics: dropExample + the set-first paint
//     order in client.ts · the five sets verbatim
//     from the capture · mass.ts / mass-order.ts /
//     mass-readings.ts / index.ts byte-identical to
//     the base ship · ui.ts identical outside the pin
//   (a) fresh open: one header, the invitation once
//     and before the toggle, Form A whole, EP II
//   (b) Form B: word-equal to its slice, first line
//     'Have mercy on us, O Lord.', the dress stands
//   (c) Form C per season (all five boots): the
//     body's line sequence = the mapped set's nine
//     lines word-equal to the capture, then the
//     absolution's four lines · the example's trope
//     lines absent from the whole scroll · the other
//     four sets' tropes absent · headings + note
//     standing · the dress by computed style · no
//     picker controls
//   (n) null-season boot: Form C = the absolution
//     alone (the named fallback)
//   (d) an in-view repaint keeps Form C; a
//     leave-and-return resets to Form A + EP II
//   (k) the rest of the scroll byte-identical to
//     the base ship's render outside the
//     Penitential Act span
//   (g) cooked parse + Chromium boot clean (v439)
// Fixtures (Improvement D): the day + readings
// payloads are the standing production-shaped set
// the v501–v508 harnesses boot, with the payload's
// season set to the canonical season values the
// server sends; the form expectations are sliced
// from the production Order data
// (app/worker/src/mass-order.ts); the Appendix VI
// expectations are the standing capture at
// tests/fixtures-v503/appendix-vi.txt (proven at
// v502/v503 from the USCCB-published Appendix VI).
// The base tree is read through env H511_BASE
// (default: the v508 ship — the build base; at ship
// compose it points at the v510 ship tree).
// Run: node app/tests/harness-v511.mjs [--probe]
// (from the worktree root). --probe only prints.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const O_SRC = readFileSync(SRC + '/mass-order.ts', 'utf8');
const BASE = process.env.H511_BASE
  ? path.resolve(process.env.H511_BASE)
  : path.resolve(process.cwd(), '../../.worktrees/v508-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const APPX = readFileSync(APP + '/tests/fixtures-v503/appendix-vi.txt', 'utf8');
const APPX_SETS = {};
{
  let cur = null;
  for (const raw of APPX.split('\n')) {
    const ln = raw.trim();
    const m = ln.match(/^SET (I|II|III|IV|V|VI|VII)$/);
    if (m) { cur = m[1]; APPX_SETS[cur] = []; continue; }
    if (cur && ln) APPX_SETS[cur].push(ln);
  }
}
const SAMPLE_MAP = { Advent: 'I', Christmas: 'II', Lent: 'III', Easter: 'IV', 'Ordinary Time': 'VI' };
const INV = 'Brethren (brothers and sisters), let us acknowledge our sins, and so prepare ourselves to celebrate the sacred mysteries.';
const EXAMPLE_TROPES = [
  'You were sent to heal the contrite of heart:',
  'You came to call sinners:',
  'You are seated at the right hand of the Father to intercede for us:',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
const words = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function dataArr(key) {
  const m = O_SRC.match(new RegExp('"' + key + '": \\[([\\s\\S]*?)\\n\\]'));
  return JSON.parse('[' + m[1] + ']');
}
function dataRoles(key) {
  const m = O_SRC.match(new RegExp('"' + key + '": "([A-Za-z]+)"'));
  return m[1];
}
const INTRO_MID = dataArr('introMid'), INTRO_MR = dataRoles('introMid');
const CONF = dataArr('confiteorEn'), CONF_R = dataRoles('confiteorEn');
function visLines(lines, roles) {
  return lines.filter((ln, i) => roles.charAt(i) !== 'r' && roles.charAt(i) !== 'x');
}
function visWords(lines, roles) {
  return visLines(lines, roles).join(' ');
}
function sliceForm(prefix) {
  const b0 = INTRO_MID.findIndex((ln) => ln.indexOf(prefix) === 0);
  let end = INTRO_MID.length - 1;
  for (let i = b0; i < INTRO_MID.length; i++) if (INTRO_MID[i] === 'Amen.') { end = i; break; }
  return { lines: INTRO_MID.slice(b0, end + 1), roles: INTRO_MR.slice(b0, end + 1) };
}
function dropInv(f) {
  const i = f.lines.findIndex((ln) => ln.indexOf('Brethren (brothers and sisters)') === 0);
  if (i < 0) return f;
  return { lines: f.lines.slice(0, i).concat(f.lines.slice(i + 2)), roles: f.roles.slice(0, i) + f.roles.slice(i + 2) };
}
function dropEx(f) {
  const i = f.lines.findIndex((ln) => ln.indexOf('May almighty God have mercy on us,') === 0);
  if (i < 0) return f;
  return { lines: f.lines.slice(i), roles: f.roles.slice(i) };
}
const FORM_B = dropInv(sliceForm('5. The Priest invites'));
const FORM_C_TAIL = dropEx(dropInv(sliceForm('6. The Priest invites')));
const TAIL_VIS = visLines(FORM_C_TAIL.lines, FORM_C_TAIL.roles);
const ABS_L = INTRO_MID.slice(0, INTRO_MID.indexOf('Amen.') + 1);
const ABS_R = INTRO_MR.slice(0, INTRO_MID.indexOf('Amen.') + 1);
const FORM_A = { lines: CONF.concat(ABS_L), roles: CONF_R + ABS_R };

/* ---------------- S: statics ---------------- */
{
  ok(C_SRC.includes('function dropExample(f)')
    && C_SRC.includes('C: dropExample(dropInvitation(slice(')
    && C_SRC.includes("indexOf('May almighty God have mercy on us,') === 0"),
    'S1: the dropExample step stands in massPenForms — the C slice is cut at the absolution\'s standing first line and passes through dropInvitation then dropExample');
  ok(C_SRC.includes("if (key === 'C') return massPenSamplesHtml() + massLinesHtml(f.lines, f.roles);")
    && !C_SRC.includes("if (key === 'C') h += massPenSamplesHtml();"),
    'S2: under Form C the samples block paints FIRST, in the invocation position, and the cut slice follows it — the v503 append order is gone');
  ok(C_SRC.includes('var MASS_PEN_SAMPLE_SEASONS') && C_SRC.includes('payload.season')
    && ["'Advent': 'Advent'", "'Christmas': 'Christmas'", "'Lent': 'Lent'", "'Easter': 'Easter'", "'Ordinary Time': 'Ordinary Time'"].every((s) => C_SRC.includes(s)),
    'S3: the season map stands (the payload season keys to the five set names) and the samples renderer reads the payload season');
  ok(Object.keys(SAMPLE_MAP).every((n) => (APPX_SETS[SAMPLE_MAP[n]] || []).length === 9
    && APPX_SETS[SAMPLE_MAP[n]].every((ln) => C_SRC.includes("'" + ln + "'"))),
    'S4: all five riding sets stand in the samples table, every line verbatim from the Appendix VI capture');
  ok(C_SRC.includes("function massPenSamplesHtml()") && C_SRC.includes("if (!set) return '';"),
    'S5: the samples renderer stands unmodified in shape — an unmapped season returns \'\' (the named fallback\'s mechanism)');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'index.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S6-' + f + ': byte-identical to the base ship');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pin(U_SRC) === pin(U_BASE), 'S7: ui.ts is byte-identical to the base ship outside the pin line');
}

/* ---------------- fixtures + pages ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED_BASE = null;
try { COOKED = cook(C_SRC); ok(true, 'P1: the cooked APP_JS parses (the v439 gate)'); }
catch (e) { ok(false, 'P1: the cooked APP_JS parses (the v439 gate)', String(e).slice(0, 160)); }
try { COOKED_BASE = cook(C_BASE); } catch (e) { console.log('note - base cook failed:', String(e).slice(0, 120)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const APP_CSS_BASE = U_BASE.slice(U_BASE.indexOf('APP_CSS = `') + 11, U_BASE.indexOf('`;', U_BASE.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

const DAY = {
  ok: true, date: '2026-11-15', presentedDay: '2026-11-15',
  dateLabel: 'Sunday, November 15, 2026',
  liturgicalDay: { name: '33rd Sunday in Ordinary Time', color: 'green' },
  introTexts: {},
  blocks: [{ block: 'Morning', label: 'Morning', tracks: [
    { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
    { episodeId: '9002', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/9002.mp3' },
  ] }],
  episodes: [],
};
const FORMULARY_A = {
  entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
  collect: 'O God, who made the Memorial of Saint Elizabeth a sign of your care, grant, we pray, that we may follow her example. Through our Lord Jesus Christ, your Son.',
  prayerOverOfferings: 'Accept, O Lord, the offerings we bring in honor of Saint Elizabeth.',
  prefaceText: null, prefaceName: null,
  communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
  prayerAfterCommunion: 'Nourished by this sacrament, O Lord, may we imitate Saint Elizabeth in charity.',
};
const FORMULARY_B = {
  entranceAntiphon: { text: 'The Lord speaks of peace to his people.', ref: 'Ps 85' },
  collect: 'Grant us, Lord our God, that we may honor you with all our mind. Through our Lord Jesus Christ, your Son.',
  prayerOverOfferings: 'Look with favor, O Lord, on the offerings of your people.',
  prefaceText: null, prefaceName: null,
  communionAntiphon: { text: 'Whoever eats this bread will live for ever.', ref: 'Jn 6' },
  prayerAfterCommunion: 'May the working of your mercy, O Lord, guide our hearts.',
};
function massPayload(season) {
  return {
    ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season,
    defaultVersion: 'elizabeth',
    versions: [
      { key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: FORMULARY_A },
      { key: 'feria', label: 'Tuesday of the 33rd Week', rank: null, formulary: FORMULARY_B },
    ],
  };
}
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me: Because you are lukewarm, I will spit you out of my mouth.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. (Rev. 3: 21) I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice; who thinks the truth in his heart and slanders not with his tongue.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town. Now a man there named Zacchaeus, who was a chief tax collector and also a wealthy man, was seeking to see who Jesus was.</p>' },
] };

function buildPage(cooked, css, payload) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
var BOOK_STUB = ${JSON.stringify(BOOK)};
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push({ path: p });
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); } }); };
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(payload)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, BOOK_STUB || { ok: true, groups: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
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
  '/v511': buildPage(COOKED, APP_CSS, massPayload('Ordinary Time')),
  '/base': buildPage(COOKED_BASE, APP_CSS_BASE, massPayload('Ordinary Time')),
  '/v511-adv': buildPage(COOKED, APP_CSS, massPayload('Advent')),
  '/v511-xmas': buildPage(COOKED, APP_CSS, massPayload('Christmas')),
  '/v511-lent': buildPage(COOKED, APP_CSS, massPayload('Lent')),
  '/v511-easter': buildPage(COOKED, APP_CSS, massPayload('Easter')),
  '/v511-none': buildPage(COOKED, APP_CSS, massPayload(null)),
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
  await page.waitForSelector('#mass-penbody', { timeout: 15000 }).catch(() => console.log('note -', tag, 'penbody slow'));
  await sleep(800);
  return { ctx, page };
}
const invCount = (page) => page.evaluate((inv) => {
  /* Count the invitation in the scroll's rendered LINE
     elements joined with spaces — raw textContent runs
     adjacent divs together without a separator (the
     v503 harness lesson). */
  const lines = Array.from(document.querySelectorAll('.mass-scroll .mass-line')).map((l) => l.textContent);
  const t = lines.join(' ').replace(/\s+/g, ' ');
  return t.split(inv).length - 1;
}, INV);
const scrollText = (page) => page.evaluate(() => {
  const lines = Array.from(document.querySelectorAll('.mass-scroll .mass-line')).map((l) => l.textContent);
  return lines.join(' ').replace(/\s+/g, ' ');
});
const cInfo = (page) => page.evaluate(() => {
  const pen = document.getElementById('mass-penbody');
  const kids = Array.from(pen.children);
  return {
    heads: kids.filter((k) => k.classList.contains('mass-sh')).map((k) => k.textContent),
    noteText: (kids.find((k) => k.classList.contains('mass-ref')) || {}).textContent || null,
    lines: kids.filter((k) => k.classList.contains('mass-line')).map((k) => ({
      t: k.textContent, italic: getComputedStyle(k).fontStyle === 'italic', people: k.classList.contains('mass-people'),
    })),
    controls: pen.querySelectorAll('button, select, input, textarea').length,
  };
});

/* The full Form C leg set for one season boot: the
   mapped set stands alone, in the invocation
   position, followed by the absolution; the example
   and the other seasons stand nowhere. */
async function checkFormC(page, seasonName, numeral, tag) {
  const info = await cInfo(page);
  const inv = await invCount(page);
  const stext = await scrollText(page);
  const setLines = APPX_SETS[numeral] || [];
  const gotSet = info.lines.slice(0, 9).map((l) => l.t);
  const gotTail = info.lines.slice(9).map((l) => l.t);
  ok(JSON.stringify(info.heads) === JSON.stringify(['Sample invocations', seasonName])
    && info.noteText === '* Different forms will be used.',
    'C-' + tag + '1: the samples block stands at the head of Form C — its heading, the asterisk note in John\'s words, and ONE season line: ' + seasonName,
    JSON.stringify(info.heads) + ' :: ' + info.noteText);
  ok(JSON.stringify(gotSet) === JSON.stringify(setLines),
    'C-' + tag + '2: the standing invocation set is the ' + seasonName + ' set (' + numeral + '), line-for-line equal to the Appendix VI capture',
    JSON.stringify(gotSet).slice(0, 160));
  ok(JSON.stringify(gotTail) === JSON.stringify(TAIL_VIS) && info.lines.length === 13,
    'C-' + tag + '3: the absolution follows the set — the body\'s remaining lines are exactly the absolution\'s four (May almighty God… Amen.), thirteen lines in all',
    JSON.stringify(gotTail).slice(0, 140) + ' :: n=' + info.lines.length);
  ok(EXAMPLE_TROPES.every((t) => !stext.includes(t)),
    'C-' + tag + '4: the retired example stands NOWHERE in the rendered scroll (none of its three trope lines)',
    EXAMPLE_TROPES.join(' | '));
  const otherTropes = Object.keys(SAMPLE_MAP).filter((n) => n !== seasonName)
    .flatMap((n) => { const s = APPX_SETS[SAMPLE_MAP[n]]; return [s[0], s[3], s[6]]; });
  ok(otherTropes.every((t) => !info.lines.some((l) => l.t === t)),
    'C-' + tag + '5: the other four seasons\' tropes are absent from Form C — exactly one set stands',
    otherTropes.join(' | '));
  const ls = info.lines;
  ok(ls.slice(0, 9).every((l, i) => (i % 3 === 2) ? (l.people && !l.italic) : (!l.people && l.italic))
    && ls.slice(9, 12).every((l) => !l.people && !l.italic)
    && ls.length === 13 && ls[12].people && !ls[12].italic,
    'C-' + tag + '6: the dress stands — in the set the priest\'s words italic and the responses bold; the absolution regular, its Amen bold (computed style)');
  ok(info.controls === 0 && inv === 1,
    'C-' + tag + '7: no picker controls stand inside Form C, and the invitation still occurs exactly once in the scroll',
    'controls ' + info.controls + ' :: inv ' + inv);
}

/* ---------------- the main flow (Ordinary Time) ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v511', errs, 'main');

  /* (a) fresh open: one header, invitation once, Form A + EP II */
  const aInfo = await page.evaluate(() => {
    const scroll = document.querySelector('.mass-scroll');
    const tog = document.querySelector('.mass-pentoggle');
    const pen = document.getElementById('mass-penbody');
    const html = scroll.innerHTML;
    return {
      shHeads: Array.from(scroll.querySelectorAll('.mass-sh')).filter((hh) => hh.textContent === 'Penitential Act*').length,
      mhHeads: Array.from(scroll.querySelectorAll('.mass-h')).filter((hh) => hh.textContent === 'Penitential Act').length,
      btns: Array.from(tog.querySelectorAll('button')).map((b) => ({ t: b.textContent, on: b.classList.contains('active') })),
      invBeforeToggle: html.indexOf('Brethren (brothers and sisters)') >= 0
        && html.indexOf('Brethren (brothers and sisters)') < html.indexOf('mass-pentoggle'),
      penHasInv: pen.textContent.includes('Brethren (brothers and sisters)'),
      penWords: Array.from(pen.querySelectorAll('.mass-line')).map((l) => l.textContent).join(' ').replace(/\s+/g, ' ').trim(),
      epOn: (document.querySelector('[data-ep="II"]') || {}).className || '',
      epBody: (document.getElementById('mass-epbody') || {}).textContent || '',
      kyrieFollows: !!document.getElementById('mass-part-kyrie'),
    };
  });
  ok(aInfo.shHeads === 1 && aInfo.mhHeads === 0,
    'A1: ONE header only — the standing .mass-sh \'Penitential Act*\' stands once and no .mass-h \'Penitential Act\' label stands anywhere in the scroll',
    JSON.stringify({ sh: aInfo.shHeads, mh: aInfo.mhHeads }));
  ok(aInfo.btns.length === 3 && aInfo.btns[0].t === 'Form A' && aInfo.btns[1].t === 'Form B' && aInfo.btns[2].t === 'Form C'
    && aInfo.btns[0].on && !aInfo.btns[1].on && !aInfo.btns[2].on,
    'A2: the toggle stands with Form A · Form B · Form C on one row, Form A active at open', JSON.stringify(aInfo.btns));
  const invA = await invCount(page);
  ok(invA === 1 && aInfo.invBeforeToggle && !aInfo.penHasInv,
    'A3: the invitation occurs exactly once in the rendered scroll, standing before the toggle, and Form A\'s body does not carry it',
    'count ' + invA);
  ok(aInfo.penWords === words(visWords(FORM_A.lines, FORM_A.roles)),
    'A4: at open the Penitential body is Form A whole (the Confiteor + the absolution, word-equal to the production data slice)',
    aInfo.penWords.slice(0, 120));
  ok(aInfo.epOn.includes('active') && aInfo.epBody.includes('Make holy, therefore, these gifts') && aInfo.kyrieFollows,
    'A5: at open the EP toggle stands on Prayer II with the EP II body, and the Kyrie block follows the Penitential Act');

  /* (b) Form B: invitation dropped, dialogue intact */
  await page.click('[data-pen="B"]');
  await sleep(400);
  const bInfo = await page.evaluate(() => {
    const pen = document.getElementById('mass-penbody');
    const lines = Array.from(pen.querySelectorAll('.mass-line')).map((l) => ({
      t: l.textContent, bold: l.classList.contains('mass-people'),
    }));
    const find = (t) => lines.find((l) => l.t === t) || null;
    return {
      first: lines.length ? lines[0].t : null,
      words: lines.map((l) => l.t).join(' ').replace(/\s+/g, ' ').trim(),
      mercy: find('Have mercy on us, O Lord.'),
      sinned: find('For we have sinned against you.'),
      showus: find('Show us, O Lord, your mercy.'),
      grant: find('And grant us your salvation.'),
      penHasInv: pen.textContent.includes('Brethren (brothers and sisters)'),
      bOn: (document.querySelector('[data-pen="B"]') || {}).className || '',
    };
  });
  const invB = await invCount(page);
  ok(bInfo.words === words(visWords(FORM_B.lines, FORM_B.roles)) && !bInfo.penHasInv && invB === 1 && bInfo.bOn.includes('active'),
    'B1: Form B\'s body is word-equal to its production slice with the invitation pair lifted out — and the invitation still occurs exactly once in the scroll',
    bInfo.words.slice(0, 120) + ' :: count ' + invB);
  ok(bInfo.first === 'Have mercy on us, O Lord.',
    'B2: Form B\'s body begins with its first spoken line, \'Have mercy on us, O Lord.\'', String(bInfo.first));
  ok(bInfo.mercy && bInfo.mercy.bold === false && bInfo.sinned && bInfo.sinned.bold === true
    && bInfo.showus && bInfo.showus.bold === false && bInfo.grant && bInfo.grant.bold === true,
    'B3: Form B stands as call and response — the priest\'s lines regular, the people\'s bold');

  /* (c) Form C on an Ordinary Time day: the seasonal set alone */
  await page.click('[data-pen="C"]');
  await sleep(400);
  await checkFormC(page, 'Ordinary Time', 'VI', 'ot');

  /* (d) in-view repaint keeps the form; a fresh open resets both */
  await page.click('[data-version="feria"]');
  await sleep(500);
  const dView = await page.evaluate(() => ({
    cOn: (document.querySelector('[data-pen="C"]') || {}).className || '',
    isC: (document.getElementById('mass-penbody') || {}).textContent.includes('Lord Jesus, you have shown us the way to the Father:'),
  }));
  ok(dView.cOn.includes('active') && dView.isC,
    'D1: an in-view repaint (the version pick) keeps the standing form — the pick lives for the standing view');
  await page.click('[data-ep="IV"]');
  await sleep(400);
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await sleep(600);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('#mass-penbody', { timeout: 15000 }).catch(() => console.log('note - reopen penbody slow'));
  await sleep(800);
  const dOpen = await page.evaluate(() => ({
    aOn: (document.querySelector('[data-pen="A"]') || {}).className || '',
    iiOn: (document.querySelector('[data-ep="II"]') || {}).className || '',
    isA: (document.getElementById('mass-penbody') || {}).textContent.includes('I confess to almighty God'),
  }));
  ok(dOpen.aOn.includes('active') && dOpen.isA && dOpen.iiOn.includes('active'),
    'D2: a fresh open (leave the tab, return) stands on Form A + EP II — the switched picks did not carry',
    JSON.stringify(dOpen));
  ok(errs.length === 0, 'L1: Chromium boot + the whole flow clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

/* ---------------- (s) the other season boots ---------------- */
async function seasonBoot(route, seasonName, numeral, tag) {
  const errs = [];
  const { ctx, page } = await boot(route, errs, tag);
  await page.click('[data-pen="C"]');
  await sleep(400);
  await checkFormC(page, seasonName, numeral, tag);
  ok(errs.length === 0, 'S-' + tag + ': the ' + seasonName + ' boot runs clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}
await seasonBoot('/v511-adv', 'Advent', 'I', 'adv');
await seasonBoot('/v511-xmas', 'Christmas', 'II', 'xmas');
await seasonBoot('/v511-lent', 'Lent', 'III', 'lent');
await seasonBoot('/v511-easter', 'Easter', 'IV', 'easter');

/* ---------------- (n) the null-season boot: the named fallback ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v511-none', errs, 'none');
  await page.click('[data-pen="C"]');
  await sleep(400);
  const info = await cInfo(page);
  const gotLines = info.lines.map((l) => l.t);
  ok(JSON.stringify(gotLines) === JSON.stringify(TAIL_VIS),
    'N1: a day with no season paints Form C as the absolution ALONE — the four absolution lines and nothing else (the named fallback)',
    JSON.stringify(gotLines).slice(0, 160));
  ok(info.heads.length === 0 && info.noteText === null,
    'N2: no samples heading and no asterisk note stands on the null-season day',
    JSON.stringify(info.heads));
  const allTropes = EXAMPLE_TROPES.concat(
    Object.keys(SAMPLE_MAP).flatMap((n) => { const s = APPX_SETS[SAMPLE_MAP[n]]; return [s[0], s[3], s[6]]; }));
  ok(allTropes.every((t) => !info.lines.some((l) => l.t === t)),
    'N3: no trope line stands — neither the retired example nor any season\'s set returns as a fallback',
    allTropes.join(' | '));
  ok(errs.length === 0, 'N4: the null-season boot runs clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

/* ---------------- (k) byte-identity vs the base ship ---------------- */
{
  const errs = [];
  const a = await boot('/v511', errs, 'k511');
  const b = await boot('/base', errs, 'kBase');
  const stripPen = (html) => {
    if (!html) return html;
    const iH = html.indexOf('<div class="mass-h">Penitential Act</div>');
    const iT = html.indexOf('<div class="segtoggle pill mass-seg mass-pentoggle">');
    const i0 = iH >= 0 ? iH : iT;
    const i1 = html.indexOf('<div class="mass-h">Kyrie</div>');
    if (i0 < 0 || i1 < 0 || i1 < i0) return 'STRIP-FAIL';
    return html.slice(0, i0) + html.slice(i1);
  };
  const hNew = await a.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const hBase = await b.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  ok(hNew && hBase && stripPen(hNew) !== 'STRIP-FAIL' && stripPen(hNew) === stripPen(hBase),
    'K1: the Mass scroll renders byte-identical to the base ship outside the Penitential Act span (the Kyrie block compared in its English state)');
  ok(errs.length === 0, 'L2: the byte-identity boots run clean (no page errors)', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v511:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
