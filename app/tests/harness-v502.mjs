// harness-v502.mjs — v502 evidence: the Penitential Act
// in its three forms behind a toggle at the head of the
// section (John, Ora thread, 2026-11-17 13:44 CT —
// Form A the Confiteor · Form B the 'Have mercy on us,
// O Lord' dialogue · Form C the invocations with the
// Missal's standing trope set; Form A the default on
// every open) · Eucharistic Prayer II opens the tab
// (the defect close: a pick made during a view no
// longer survives a leave-and-return) · the Greek
// Kyrie in call-and-response dress (13:46 CT — the
// leader's line regular, the people's response bold),
// its text verified as the Missal's Greek.
//   S statics: the toggle + hosts + the open-reset
//     standing in client.ts · the stored Greek lines
//     byte-identical to the v501 ship (no data moved) ·
//     mass.ts / mass-order.ts / mass-readings.ts /
//     index.ts byte-identical to the v501 ship · ui.ts
//     identical outside the pin line · the v486 Missal
//     witness capture carries the Greek Kyrie forms
//   (a) fresh open: Form A stands (Confiteor +
//     absolution; no Form B or C line), the toggle
//     stands at the head of the Penitential Act with
//     Form A active, and EP II stands active with its
//     body
//   (b) a tap on Form B swaps only the Penitential
//     body — the dialogue in its v488 dress, the
//     Confiteor gone, the Kyrie block still follows
//   (c) Form C stands with the Missal trope set, its
//     rendered word stream equal to the Form C slice
//     of the production Order data · the amendment
//     (13:54 CT): under the example, the samples block
//     — four Appendix VI sets (Advent · Lent · Easter ·
//     Ordinary Time) word-equal to the USCCB-published
//     appendix capture, the priest's sample lines in
//     italics and the responses bold (computed style),
//     the asterisk note standing, the example itself in
//     the normal dress, and no picker inside Form C
//   (d) an in-view repaint (the version pick) keeps
//     the standing form; a leave-and-return (a fresh
//     open) returns BOTH toggles to Form A + EP II
//     after both were switched
//   (e) the Greek Kyrie: three V/. R/. dialogue lines,
//     the V/. part regular and the R/. part bold
//     (computed-style proof), the Greek word stream
//     equal to the stored lines and to the witness
//     forms, no Latin word standing
//   (f) the rest of the scroll byte-identical to the
//     v501 ship's render of the same fixture day
//     outside the Penitential Act span (the Kyrie
//     block compared in its English state)
//   (g) cooked parse + Chromium boot clean (v439 gate)
// Fixtures (Improvement D): the Mass day + readings
// fixtures are the harness-v494 production shapes (the
// set the v501 harness boots); the form expectations
// are sliced from the production Order data itself
// (app/worker/src/mass-order.ts, byte-identical to the
// v501 ship per S); the Greek witness is the v486
// capture of the Missal's Ordo Missae page
// (tests/fixtures-v486/src-ordo-latin.htm) that
// gen-mass-order.py drew the Order data from; the
// Appendix VI expectations are the capture of the
// USCCB-published appendix PDF (tests/fixtures-v502/
// appendix-vi.txt, fetched 2026-11-17; witness: the
// USCCB Divine Worship newsletter, Aug-Sept 2010).
// Run:
// node app/tests/harness-v502.mjs [--probe] (from the
// worktree root). --probe only prints.
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
const BASE = path.resolve(process.cwd(), '../../.worktrees/v501-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const WITNESS = readFileSync(APP + '/tests/fixtures-v486/src-ordo-latin.htm', 'utf8');
const APPX = readFileSync(APP + '/tests/fixtures-v502/appendix-vi.txt', 'utf8');
/* The Appendix VI capture, parsed by set numeral:
   the spoken lines of each set in print order. */
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
const SAMPLE_MAP = { Advent: 'I', Lent: 'III', Easter: 'IV', 'Ordinary Time': 'VI' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
const words = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* The production Order data, extracted from
   mass-order.ts exactly as it stands. */
function dataArr(key) {
  const m = O_SRC.match(new RegExp('"' + key + '": \\[([\\s\\S]*?)\\n\\]'));
  return JSON.parse('[' + m[1] + ']');
}
function dataRoles(key) {
  const m = O_SRC.match(new RegExp('"' + key + '": "([A-Za-z]+)"'));
  return m[1];
}
function latinArr(key) {
  const m = O_SRC.match(new RegExp('"' + key + '": \\[([\\s\\S]*?)\\n\\]'));
  return JSON.parse('[' + m[1] + ']');
}
const INTRO_MID = dataArr('introMid'), INTRO_MR = dataRoles('introMid');
const CONF = dataArr('confiteorEn'), CONF_R = dataRoles('confiteorEn');
const GREEK = latinArr('kyrie');
function visWords(lines, roles) {
  return lines.filter((ln, i) => roles.charAt(i) !== 'r' && roles.charAt(i) !== 'x').join(' ');
}
function sliceForm(prefix) {
  const b0 = INTRO_MID.findIndex((ln) => ln.indexOf(prefix) === 0);
  let end = INTRO_MID.length - 1;
  for (let i = b0; i < INTRO_MID.length; i++) if (INTRO_MID[i] === 'Amen.') { end = i; break; }
  return { lines: INTRO_MID.slice(b0, end + 1), roles: INTRO_MR.slice(b0, end + 1) };
}
const FORM_B = sliceForm('5. The Priest invites');
const FORM_C = sliceForm('6. The Priest invites');
const ABS_L = INTRO_MID.slice(0, INTRO_MID.indexOf('Amen.') + 1);
const ABS_R = INTRO_MR.slice(0, INTRO_MID.indexOf('Amen.') + 1);
const FORM_A = { lines: CONF.concat(ABS_L), roles: CONF_R + ABS_R };

/* ---------------- S: statics ---------------- */
{
  ok(C_SRC.includes('mass-pentoggle') && C_SRC.includes('data-pen="') && C_SRC.includes('id="mass-penbody"')
    && C_SRC.includes('function massPenForms()') && C_SRC.includes('function wireMassPen()'),
    'S1: the Penitential toggle, its body host, the form slicer, and the wiring stand in client.ts');
  ok(C_SRC.includes("penform: 'A'") && C_SRC.includes("state.mass.penform = 'A'") && C_SRC.includes("state.mass.ep = 'II'"),
    'S2: state.mass is created with penform A, and paintMassLiturgy resets ep + penform to the defaults at entry');
  const pl = C_SRC.slice(C_SRC.indexOf('function paintMassLiturgy()'), C_SRC.indexOf('function paintMassLiturgy()') + 1400);
  ok(pl.indexOf("state.mass.ep = 'II'") >= 0 && pl.indexOf("state.mass.ep = 'II'") < pl.indexOf('paintMassScroll(); return;'),
    'S3: the reset stands before the standing-state repaint branch in paintMassLiturgy (the open path)');
  ok(C_SRC.includes('function massPartLines(part, lang, enLines)') && C_SRC.includes("'V/. ' + g[i] + ' R/. ' + g[i + 1]")
    && C_SRC.includes("roles: 'ddd'"),
    'S4: the Greek pairing helper stands — the six stored lines paired into V/. R/. dialogue lines with ddd roles');
  const greekOf = (s) => { const m = s.match(/"kyrie": \[([\s\S]*?)\n\]/); return m ? m[1] : null; };
  ok(greekOf(C_SRC) === greekOf(C_BASE) && greekOf(C_SRC) !== null,
    'S5: the stored Greek Kyrie lines in client.ts are byte-identical to the v501 ship (no data moved)');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'index.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S6-' + f + ': byte-identical to the v501 ship');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  const stripIt = (s) => s.replace(/\.mass-it \{ font-style: italic; \}\n/g, '');
  ok(pin(stripIt(U_SRC)) === pin(U_BASE), 'S7: ui.ts is byte-identical to the v501 ship outside the pin line and the one added .mass-it rule (the samples italics)');
  ok(C_SRC.includes('var MASS_PEN_SAMPLES') && C_SRC.includes('function massPenSamplesHtml()')
    && C_SRC.includes('* Different forms will be used.')
    && ['Advent', 'Lent', 'Easter', 'Ordinary Time'].every((n) => C_SRC.includes("name: '" + n + "'")),
    'S9: the Appendix VI samples table, its renderer, and the asterisk note stand in client.ts, the four named sets present');
  ok(WITNESS.includes('Kýrie') && WITNESS.includes('Christe, eléison')
    && GREEK.length === 6 && GREEK.every((ln) => /^(Kýrie|Christe) eléison\.$/.test(ln)),
    'S8: the Missal witness capture carries the Greek Kyrie (Kýrie eléison · Christe eléison), and the six stored lines are those Greek lines — no Latin form',
    GREEK.join(' | '));
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
const MASS_PAYLOAD = {
  ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary',
  defaultVersion: 'elizabeth',
  versions: [
    { key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: FORMULARY_A },
    { key: 'feria', label: 'Tuesday of the 33rd Week', rank: null, formulary: FORMULARY_B },
  ],
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me: Because you are lukewarm, I will spit you out of my mouth.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. (Rev. 3: 21) I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice; who thinks the truth in his heart and slanders not with his tongue.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town. Now a man there named Zacchaeus, who was a chief tax collector and also a wealthy man, was seeking to see who Jesus was.</p>' },
] };

function buildPage(cooked, css) {
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
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(MASS_PAYLOAD)});
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

let PAGE = '', PAGE_BASE = '';
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/v502') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  if (u === '/base') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE_BASE); return; }
  res.statusCode = 404; res.end('not found');
});
PAGE = buildPage(COOKED, APP_CSS);
PAGE_BASE = buildPage(COOKED_BASE, APP_CSS_BASE);
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
  if (which === '/v502') await page.waitForSelector('#mass-penbody', { timeout: 15000 }).catch(() => console.log('note -', tag, 'penbody slow'));
  await sleep(800);
  return { ctx, page };
}

/* ---------------- the main flow ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v502', errs, 'main');

  /* (a) fresh open: Form A + EP II */
  const aInfo = await page.evaluate(() => {
    const pen = document.getElementById('mass-penbody');
    const tog = document.querySelector('.mass-pentoggle');
    const head = Array.from(document.querySelectorAll('.mass-h')).find((hh) => hh.textContent === 'Penitential Act');
    const penLines = Array.from(pen.querySelectorAll('.mass-line')).map((l) => ({
      t: l.textContent, bold: l.classList.contains('mass-people'),
    }));
    return {
      toggleAfterHead: !!(head && tog && head.nextElementSibling === tog),
      btns: Array.from(tog.querySelectorAll('button')).map((b) => ({ t: b.textContent, on: b.classList.contains('active') })),
      penText: pen.textContent.replace(/\s+/g, ' ').trim(),
      penWords: penLines.map((l) => l.t).join(' ').replace(/\s+/g, ' ').trim(),
      amenBold: penLines.length ? penLines[penLines.length - 1] : null,
      epOn: (document.querySelector('[data-ep="II"]') || {}).className || '',
      epBody: (document.getElementById('mass-epbody') || {}).textContent || '',
      kyrieFollows: !!document.getElementById('mass-part-kyrie'),
    };
  });
  ok(aInfo.toggleAfterHead && aInfo.btns.length === 3
    && aInfo.btns[0].t === 'Form A' && aInfo.btns[1].t === 'Form B' && aInfo.btns[2].t === 'Form C'
    && aInfo.btns[0].on && !aInfo.btns[1].on && !aInfo.btns[2].on,
    'A1: the toggle stands immediately after the Penitential Act heading — Form A · Form B · Form C on one row, Form A active at open',
    JSON.stringify(aInfo.btns));
  ok(aInfo.penWords === words(visWords(FORM_A.lines, FORM_A.roles))
    && !aInfo.penText.includes('Have mercy on us, O Lord') && !aInfo.penText.includes('You were sent to heal'),
    'A2: at open the Penitential body is Form A whole (the Confiteor + the absolution, word-equal to the production data slice); no Form B or C line stands',
    aInfo.penWords.slice(0, 120));
  ok(aInfo.amenBold && aInfo.amenBold.t === 'Amen.' && aInfo.amenBold.bold === true,
    'A3: Form A closes with the absolution — the people\'s Amen stands bold (the v488 dress)');
  ok(aInfo.epOn.includes('active') && aInfo.epBody.includes('Make holy, therefore, these gifts')
    && aInfo.kyrieFollows,
    'A4: at open the EP toggle stands on Prayer II with the EP II body, and the Kyrie block follows the Penitential Act');

  /* (b) Form B */
  await page.click('[data-pen="B"]');
  await sleep(400);
  const bInfo = await page.evaluate(() => {
    const pen = document.getElementById('mass-penbody');
    const lines = Array.from(pen.querySelectorAll('.mass-line')).map((l) => ({
      t: l.textContent, bold: l.classList.contains('mass-people'),
    }));
    const find = (t) => lines.find((l) => l.t === t) || null;
    return {
      words: lines.map((l) => l.t).join(' ').replace(/\s+/g, ' ').trim(),
      mercy: find('Have mercy on us, O Lord.'),
      sinned: find('For we have sinned against you.'),
      showus: find('Show us, O Lord, your mercy.'),
      grant: find('And grant us your salvation.'),
      confiteor: pen.textContent.includes('I confess to almighty God'),
      kyrieFollows: !!document.getElementById('mass-part-kyrie'),
      collectAfter: Array.from(document.querySelectorAll('.mass-h')).some((hh) => hh.textContent === 'Collect'),
      bOn: (document.querySelector('[data-pen="B"]') || {}).className || '',
    };
  });
  ok(bInfo.words === words(visWords(FORM_B.lines, FORM_B.roles)) && !bInfo.confiteor && bInfo.bOn.includes('active'),
    'B1: a tap on Form B swaps only the Penitential body — Form B whole, word-equal to its production slice, the Confiteor gone',
    bInfo.words.slice(0, 120));
  ok(bInfo.mercy && bInfo.mercy.bold === false && bInfo.sinned && bInfo.sinned.bold === true
    && bInfo.showus && bInfo.showus.bold === false && bInfo.grant && bInfo.grant.bold === true,
    'B2: Form B stands as call and response — the priest\'s lines regular, the people\'s bold');
  ok(bInfo.kyrieFollows && bInfo.collectAfter,
    'B3: the Kyrie block still follows the form and the scroll stands whole below it');

  /* (c) Form C: the example, then the samples block */
  await page.click('[data-pen="C"]');
  await sleep(400);
  const cInfo = await page.evaluate(() => {
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
      exWords: exLines.map((l) => l.textContent).join(' ').replace(/\s+/g, ' ').trim(),
      exDress: exLines.map((l) => ({ t: l.textContent, italic: getComputedStyle(l).fontStyle === 'italic', people: l.classList.contains('mass-people') })),
      text: pen.textContent,
      heads: after.filter((k) => k.classList.contains('mass-sh')).map((k) => k.textContent),
      noteText: note ? note.textContent : null,
      sets,
      controls: pen.querySelectorAll('button, select, input, textarea').length,
    };
  });
  ok(cInfo.exWords === words(visWords(FORM_C.lines, FORM_C.roles))
    && cInfo.text.includes('You were sent to heal the contrite of heart:')
    && cInfo.text.includes('You came to call sinners:')
    && cInfo.text.includes('You are seated at the right hand of the Father to intercede for us:'),
    'C1: Form C\'s example stands with the Missal trope set, its rendered word stream equal to the Form C slice of the production data',
    cInfo.exWords.slice(0, 120));
  ok(JSON.stringify(cInfo.heads) === JSON.stringify(['Sample invocations', 'Advent', 'Lent', 'Easter', 'Ordinary Time'])
    && cInfo.noteText === '* Different forms will be used.',
    'C2: the samples block stands under the example — its heading, the asterisk note in John\'s words, and the four named sets in order',
    JSON.stringify(cInfo.heads) + ' :: ' + cInfo.noteText);
  ok(Object.keys(SAMPLE_MAP).every((name) => {
    const got = (cInfo.sets[name] || []).map((l) => l.t);
    return JSON.stringify(got) === JSON.stringify(APPX_SETS[SAMPLE_MAP[name]] || []);
  }), 'C3: each sample set renders line-for-line equal to the Appendix VI capture (Advent=I · Lent=III · Easter=IV · Ordinary Time=VI)',
    JSON.stringify(Object.fromEntries(Object.entries(cInfo.sets).map(([k, v]) => [k, v.length]))));
  ok(Object.keys(SAMPLE_MAP).every((name) => {
    const ls = cInfo.sets[name] || [];
    return ls.length === 9 && ls.every((l, i) => (i % 3 === 2) ? (l.people && !l.italic) : (!l.people && l.italic));
  }), 'C4: in the samples the priest\'s words stand in italics and the people\'s responses bold — computed style, every set');
  {
    const trope = cInfo.exDress.find((l) => l.t.indexOf('You were sent to heal') === 0);
    const resps = cInfo.exDress.filter((l) => l.t === 'Lord, have mercy. Or: Kyrie, eleison.');
    const resp = resps[resps.length - 1];
    ok(trope && !trope.italic && resp && resp.people,
      'C5: the example itself keeps the normal dress — its trope lines not italic, its responses bold');
  }
  ok(cInfo.controls === 0,
    'C6: no picker controls stand inside Form C — the sets stand whole');

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
  const dSwitched = await page.evaluate(() => ({
    ivOn: (document.querySelector('[data-ep="IV"]') || {}).className || '',
    cOn: (document.querySelector('[data-pen="C"]') || {}).className || '',
  }));
  ok(dSwitched.ivOn.includes('active') && dSwitched.cOn.includes('active'),
    'D2: both toggles switched in view (EP IV · Form C) — the state the re-open must not carry');
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await sleep(600);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('#mass-penbody', { timeout: 15000 }).catch(() => console.log('note - reopen penbody slow'));
  await sleep(800);
  const dOpen = await page.evaluate(() => ({
    aOn: (document.querySelector('[data-pen="A"]') || {}).className || '',
    iiOn: (document.querySelector('[data-ep="II"]') || {}).className || '',
    isA: (document.getElementById('mass-penbody') || {}).textContent.includes('I confess to almighty God'),
    epII: (document.getElementById('mass-epbody') || {}).textContent.includes('Make holy, therefore, these gifts'),
  }));
  ok(dOpen.aOn.includes('active') && dOpen.isA && dOpen.iiOn.includes('active') && dOpen.epII,
    'D3: a fresh open (leave the tab, return) stands on Form A + EP II — the switched picks did not carry',
    JSON.stringify(dOpen));

  /* (e) the Greek Kyrie */
  await page.click('#mass-part-kyrie [data-lt="kyrie:la"]');
  await sleep(400);
  const eInfo = await page.evaluate(() => {
    const body = document.querySelector('#mass-part-kyrie .mass-partbody');
    const lines = Array.from(body.querySelectorAll('.mass-line')).map((l) => {
      const span = l.querySelector('span.mass-people');
      return {
        whole: l.textContent,
        divBold: l.classList.contains('mass-people'),
        span: span ? span.textContent : null,
        divWeight: getComputedStyle(l).fontWeight,
        spanWeight: span ? getComputedStyle(span).fontWeight : null,
      };
    });
    return { lines, text: body.textContent };
  });
  const expectDlg = [0, 2, 4].map((i) => 'V/. ' + GREEK[i] + ' R/. ' + GREEK[i + 1]);
  ok(eInfo.lines.length === 3 && eInfo.lines.every((l, i) => l.whole === expectDlg[i] && l.span === 'R/. ' + GREEK[2 * i + 1]),
    'E1: the Greek Kyrie renders as the three V/. R/. dialogue lines, the Greek words equal to the stored Missal lines in order',
    JSON.stringify(eInfo.lines.map((l) => l.whole)));
  ok(eInfo.lines.every((l) => !l.divBold && Number(l.divWeight) <= 400 && Number(l.spanWeight) >= 600),
    'E2: call and response in computed style — the leader\'s line regular, the people\'s response bold, alternating like the English',
    JSON.stringify(eInfo.lines.map((l) => [l.divWeight, l.spanWeight])));
  ok(!/Domine|miserere/i.test(eInfo.text),
    'E3: no Latin form stands in the Kyrie seat (no Domine, no miserere)');
  await page.click('#mass-part-kyrie [data-lt="kyrie:en"]');
  await sleep(400);
  ok(errs.length === 0, 'L1: Chromium boot + the whole flow clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

/* ---------------- (f) byte-identity vs the v501 ship ---------------- */
{
  const errs = [];
  const a = await boot('/v502', errs, 'k502');
  const b = await boot('/base', errs, 'kBase');
  const stripPen = (html) => {
    if (!html) return html;
    const i0 = html.indexOf('<div class="mass-h">Penitential Act</div>');
    const i1 = html.indexOf('<div class="mass-h">Kyrie</div>');
    if (i0 < 0 || i1 < 0 || i1 < i0) return 'STRIP-FAIL';
    return html.slice(0, i0) + html.slice(i1);
  };
  const hNew = await a.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const hBase = await b.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  ok(hNew && hBase && stripPen(hNew) !== 'STRIP-FAIL' && stripPen(hNew) === stripPen(hBase),
    'K1: the Mass scroll renders byte-identical to the v501 ship outside the Penitential Act span (the Kyrie block compared in its English state)');
  ok(errs.length === 0, 'L2: the byte-identity boots run clean (no page errors)', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v502:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
