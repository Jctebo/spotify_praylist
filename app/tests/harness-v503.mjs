// harness-v503.mjs — v503 evidence: the fix-forward
// from John's field report on v502 (Ora thread,
// 2026-11-17 14:17 CT, with screenshots): (1) the
// Penitential Act invitation ("Brethren (brothers and
// sisters), let us acknowledge our sins, and so
// prepare ourselves to celebrate the sacred
// mysteries.") stands exactly ONCE in the section —
// in introPre, under the 'Penitential Act*' heading,
// above the toggle; the Form B and Form C slices no
// longer repeat it (Form C's body begins with its
// first invocation). (2) ONE header only: v502's
// added small-caps .mass-h 'Penitential Act' label
// above the toggle is removed. Plus the amendment
// (14:18 CT): (3) Form C's Appendix VI samples block
// loads SEASONALLY — exactly one set stands, the set
// for the season of the day on screen (the payload's
// season): Advent I · Christmas II · Lent III ·
// Easter IV · Ordinary Time VI. Set II is added from
// the same USCCB-published Appendix VI with the same
// verbatim proof as the four standing sets. An
// unmapped season stands no block. The threefold
// example + the asterisk note stand on every Form C
// view.
//   S statics: the drop step + the removed header +
//     the season map + set II standing in client.ts ·
//     mass.ts / mass-order.ts / mass-readings.ts /
//     index.ts byte-identical to the v502 ship ·
//     ui.ts identical outside the pin line
//   (a) fresh open on an Ordinary Time day: one
//     header ('Penitential Act*' .mass-sh), no .mass-h
//     'Penitential Act', the toggle standing with
//     Form A active, the invitation counted once in
//     the whole scroll and standing before the
//     toggle, Form A's body word-equal to its slice,
//     EP II active
//   (b) Form B: the body word-equal to the Form B
//     slice with the invitation pair lifted out; its
//     first line is 'Have mercy on us, O Lord.'; the
//     invitation still counted once in the scroll;
//     call-and-response dress as v502
//   (c) Form C: the example word-equal to the Form C
//     slice with the invitation pair lifted out; its
//     first line is the first invocation; the
//     invitation still counted once; the samples
//     block carries ONLY the Ordinary Time set (VI),
//     line-for-line equal to the capture, the other
//     four sets' tropes absent; the priest's lines
//     italic, the responses bold (computed style);
//     the example in the normal dress; no picker
//   (d) the toggle legs carried from v502: an in-view
//     repaint keeps the standing form; a
//     leave-and-return resets both toggles (Form A +
//     EP II)
//   (s) seasonal boots: an Advent day stands only
//     set I · a Christmas day stands only set II · a
//     null-season day stands no samples block (the
//     example stands whole, the note absent)
//   (k) the rest of the scroll byte-identical to the
//     v502 ship's render of the same fixture day
//     outside the Penitential Act span
//   (g) cooked parse + Chromium boot clean (v439)
// Fixtures (Improvement D): the day + readings
// payloads are the standing production-shaped set the
// v501/v502 harnesses boot, with the payload's season
// set to the canonical season values the server
// sends (mass.ts: the calendar dataset's values are
// the SEASON_PAGES keys — 'Advent' · 'Christmas' ·
// 'Lent' · 'Easter' · 'Ordinary Time'); the form
// expectations are sliced from the production Order
// data (app/worker/src/mass-order.ts, byte-identical
// to the v502 ship per S); the Appendix VI
// expectations are the capture at
// tests/fixtures-v503/appendix-vi.txt (sets I/III/
// IV/VI byte-identical to the v502 capture; set II
// from this run's re-fetch of the same USCCB PDF).
// Run: node app/tests/harness-v503.mjs [--probe]
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
const BASE = path.resolve(process.cwd(), '../../.worktrees/v502-ship/app/worker/src');
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
function visWords(lines, roles) {
  return lines.filter((ln, i) => roles.charAt(i) !== 'r' && roles.charAt(i) !== 'x').join(' ');
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
const FORM_B = dropInv(sliceForm('5. The Priest invites'));
const FORM_C = dropInv(sliceForm('6. The Priest invites'));
const ABS_L = INTRO_MID.slice(0, INTRO_MID.indexOf('Amen.') + 1);
const ABS_R = INTRO_MR.slice(0, INTRO_MID.indexOf('Amen.') + 1);
const FORM_A = { lines: CONF.concat(ABS_L), roles: CONF_R + ABS_R };

/* ---------------- S: statics ---------------- */
{
  ok(C_SRC.includes('function dropInvitation(f)')
    && C_SRC.includes('B: dropInvitation(slice(') && C_SRC.includes('C: dropInvitation(slice('),
    'S1: the invitation-drop step stands in massPenForms and both the B and C slices pass through it');
  ok(!C_SRC.includes('<div class="mass-h">Penitential Act</div>'),
    'S2: the v502-added .mass-h Penitential Act label is gone from client.ts');
  ok(C_SRC.includes('var MASS_PEN_SAMPLE_SEASONS') && C_SRC.includes('payload.season')
    && ["'Advent': 'Advent'", "'Christmas': 'Christmas'", "'Lent': 'Lent'", "'Easter': 'Easter'", "'Ordinary Time': 'Ordinary Time'"].every((s) => C_SRC.includes(s)),
    'S3: the season map stands (the payload season keys to the five set names) and the samples renderer reads the payload season');
  ok(C_SRC.includes("name: 'Christmas'")
    && (APPX_SETS['II'] || []).every((ln) => C_SRC.includes("'" + ln + "'")),
    'S4: the Christmas set (Appendix VI set II) stands in the samples table, every line verbatim from the capture');
  ok(['Advent', 'Lent', 'Easter', 'Ordinary Time'].every((n) => C_SRC.includes("name: '" + n + "'"))
    && Object.keys(SAMPLE_MAP).every((n) => (APPX_SETS[SAMPLE_MAP[n]] || []).length === 9),
    'S5: the four standing sets remain in the table and the capture carries all five riding sets at nine lines each');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'index.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S6-' + f + ': byte-identical to the v502 ship');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pin(U_SRC) === pin(U_BASE), 'S7: ui.ts is byte-identical to the v502 ship outside the pin line');
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
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: null, after: null, afterMass: [] });
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
  '/v503': buildPage(COOKED, APP_CSS, massPayload('Ordinary Time')),
  '/base': buildPage(COOKED_BASE, APP_CSS_BASE, massPayload('Ordinary Time')),
  '/v503-adv': buildPage(COOKED, APP_CSS, massPayload('Advent')),
  '/v503-xmas': buildPage(COOKED, APP_CSS, massPayload('Christmas')),
  '/v503-none': buildPage(COOKED, APP_CSS, massPayload(null)),
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
     adjacent divs together without a separator, which
     undercounts a two-line text (the first run's helper
     defect, corrected in the harness only). */
  const lines = Array.from(document.querySelectorAll('.mass-scroll .mass-line')).map((l) => l.textContent);
  const t = lines.join(' ').replace(/\s+/g, ' ');
  return t.split(inv).length - 1;
}, INV);
const penInfo = (page) => page.evaluate(() => {
  const pen = document.getElementById('mass-penbody');
  const kids = Array.from(pen.children);
  const sIdx = kids.findIndex((k) => k.classList.contains('mass-sh') && k.textContent === 'Sample invocations');
  const before = sIdx >= 0 ? kids.slice(0, sIdx) : kids;
  const after = sIdx >= 0 ? kids.slice(sIdx) : [];
  const exLines = before.filter((k) => k.classList.contains('mass-line'));
  const note = after.find((k) => k.classList.contains('mass-ref'));
  const sets = {}; let cur = null;
  after.forEach((k) => {
    if (k.classList.contains('mass-sh') && k.textContent !== 'Sample invocations') { cur = k.textContent; sets[cur] = []; }
    else if (cur && k.classList.contains('mass-line')) {
      sets[cur].push({ t: k.textContent, italic: getComputedStyle(k).fontStyle === 'italic', people: k.classList.contains('mass-people') });
    }
  });
  return {
    firstLine: exLines.length ? exLines[0].textContent : null,
    exWords: exLines.map((l) => l.textContent).join(' ').replace(/\s+/g, ' ').trim(),
    exDress: exLines.map((l) => ({ t: l.textContent, italic: getComputedStyle(l).fontStyle === 'italic', people: l.classList.contains('mass-people') })),
    text: pen.textContent.replace(/\s+/g, ' ').trim(),
    heads: after.filter((k) => k.classList.contains('mass-sh')).map((k) => k.textContent),
    noteText: note ? note.textContent : null,
    sets,
    controls: pen.querySelectorAll('button, select, input, textarea').length,
  };
});

/* ---------------- the main flow (Ordinary Time) ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v503', errs, 'main');

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

  /* (c) Form C on an Ordinary Time day: example + only set VI */
  await page.click('[data-pen="C"]');
  await sleep(400);
  const cInfo = await penInfo(page);
  const invC = await invCount(page);
  ok(cInfo.exWords === words(visWords(FORM_C.lines, FORM_C.roles)) && invC === 1,
    'C1: Form C\'s example is word-equal to its production slice with the invitation pair lifted out — and the invitation still occurs exactly once in the scroll',
    cInfo.exWords.slice(0, 120) + ' :: count ' + invC);
  ok(cInfo.firstLine === 'You were sent to heal the contrite of heart:',
    'C2: Form C\'s body begins with its first invocation, \'You were sent to heal the contrite of heart:\'', String(cInfo.firstLine));
  ok(JSON.stringify(cInfo.heads) === JSON.stringify(['Sample invocations', 'Ordinary Time'])
    && cInfo.noteText === '* Different forms will be used.',
    'C3: the samples block stands under the example — its heading, the asterisk note in John\'s words, and ONE season line: Ordinary Time',
    JSON.stringify(cInfo.heads) + ' :: ' + cInfo.noteText);
  {
    const got = (cInfo.sets['Ordinary Time'] || []).map((l) => l.t);
    ok(JSON.stringify(got) === JSON.stringify(APPX_SETS['VI'] || []),
      'C4: the standing set renders line-for-line equal to the Appendix VI capture (Ordinary Time = VI)',
      JSON.stringify(got).slice(0, 160));
    const otherTropes = [APPX_SETS['I'][0], APPX_SETS['II'][0], APPX_SETS['III'][0], APPX_SETS['IV'][0]];
    ok(otherTropes.every((t) => !cInfo.text.includes(t)),
      'C5: the other four sets are absent from the rendered section (Advent · Christmas · Lent · Easter tropes do not stand)',
      otherTropes.join(' | '));
    const ls = cInfo.sets['Ordinary Time'] || [];
    ok(ls.length === 9 && ls.every((l, i) => (i % 3 === 2) ? (l.people && !l.italic) : (!l.people && l.italic)),
      'C6: in the samples the priest\'s words stand in italics and the people\'s responses bold — computed style');
    const trope = cInfo.exDress.find((l) => l.t.indexOf('You were sent to heal') === 0);
    const resps = cInfo.exDress.filter((l) => l.t === 'Lord, have mercy. Or: Kyrie, eleison.');
    const resp = resps[resps.length - 1];
    ok(trope && !trope.italic && resp && resp.people,
      'C7: the example itself keeps the normal dress — its trope lines not italic, its responses bold');
    ok(cInfo.controls === 0, 'C8: no picker controls stand inside Form C — the set stands whole');
  }

  /* (d) in-view repaint keeps the form; a fresh open resets both */
  await page.click('[data-version="feria"]');
  await sleep(500);
  const dView = await page.evaluate(() => ({
    cOn: (document.querySelector('[data-pen="C"]') || {}).className || '',
    isC: (document.getElementById('mass-penbody') || {}).textContent.includes('You came to call sinners:'),
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

/* ---------------- (s) seasonal boots ---------------- */
async function seasonBoot(route, seasonName, numeral, tag) {
  const errs = [];
  const { ctx, page } = await boot(route, errs, tag);
  await page.click('[data-pen="C"]');
  await sleep(400);
  const info = await penInfo(page);
  const inv = await invCount(page);
  const got = (info.sets[seasonName] || []).map((l) => l.t);
  ok(JSON.stringify(info.heads) === JSON.stringify(['Sample invocations', seasonName])
    && info.noteText === '* Different forms will be used.'
    && JSON.stringify(got) === JSON.stringify(APPX_SETS[numeral] || []),
    'S-' + tag + ': on a ' + seasonName + ' day only set ' + numeral + ' stands in the samples block, line-for-line equal to the capture, the asterisk note standing',
    JSON.stringify(info.heads) + ' :: ' + JSON.stringify(got).slice(0, 120));
  const others = Object.keys(SAMPLE_MAP).filter((n) => n !== seasonName)
    .map((n) => APPX_SETS[SAMPLE_MAP[n]][0]);
  ok(others.every((t) => !info.text.includes(t)) && info.firstLine === 'You were sent to heal the contrite of heart:' && inv === 1,
    'S-' + tag + 'b: the other seasons\' tropes are absent, the example begins with its first invocation, and the invitation occurs exactly once',
    others.join(' | '));
  ok(errs.length === 0, 'S-' + tag + 'c: the ' + seasonName + ' boot runs clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}
await seasonBoot('/v503-adv', 'Advent', 'I', 'adv');
await seasonBoot('/v503-xmas', 'Christmas', 'II', 'xmas');
{
  const errs = [];
  const { ctx, page } = await boot('/v503-none', errs, 'none');
  await page.click('[data-pen="C"]');
  await sleep(400);
  const info = await penInfo(page);
  ok(info.heads.length === 0 && info.noteText === null
    && info.exWords === words(visWords(FORM_C.lines, FORM_C.roles)),
    'S-none: a day with no season stands NO samples block — the threefold example stands whole and no asterisk note stands',
    JSON.stringify(info.heads));
  ok(errs.length === 0, 'S-nonec: the null-season boot runs clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

/* ---------------- (k) byte-identity vs the v502 ship ---------------- */
{
  const errs = [];
  const a = await boot('/v503', errs, 'k503');
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
    'K1: the Mass scroll renders byte-identical to the v502 ship outside the Penitential Act span (the Kyrie block compared in its English state)');
  ok(errs.length === 0, 'L2: the byte-identity boots run clean (no page errors)', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v503:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
