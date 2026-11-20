// harness-v508.mjs — v508 evidence: the prayer book's
// call-and-response line breaks (the review's fix).
// THE REVIEW (release doc §2, from the LIVE book read
// through the prayer door): 8 prayers carry call-and-
// response units that run together inside one block —
// 13 body / body_latin fields, 69 seams. THE FIX:
// migration 0036 re-breaks exactly those fields at
// their seams (the words do not change), and the book
// page paints line by line with the response dress on
// R.-initial lines (the v488 rule).
//   S statics: 0036 carries exactly the 13 UPDATEs and
//     nothing else touching prayer_book; client.ts
//     differs from the base ship only in the book-body
//     paint (the bookBodyHtml helper + the two paint
//     lines); ui.ts differs only in the .bookresp rule
//     (pin excepted); index.ts and the Mass sources
//     byte-identical to the base
//   M the migration proof (python3 sqlite3): the real
//     chain 0026+0029+0030+0032+0033+0034+0035 builds
//     the book; the real 0036 applies; the 13 fields
//     read back byte-equal to the fixed table; every
//     other row byte-identical; counts 77 / 9 groups
//   U units: each fixed field's unit lines count the
//     Plan's units (per block where the Plan names a
//     block: Regina rubric + 4 · Rosary closing 5 ·
//     Litany first block 9)
//   W words: each fixed field with breaks stripped is
//     word-stream-identical to its pre-fix text; Grace
//     After Meals equals John's AFTER example line for
//     line
//   R render (Chromium): the book page for Grace After
//     Meals and The Angelus shows every unit on its own
//     line; every R.-initial line's computed weight is
//     bold, every V.-initial and plain line's regular;
//     the Latin toggle repaints under the same rule; a
//     clean prayer (Pange Lingua) renders text identical
//     to its stored text
//   P cooked parse + Chromium boot clean (v439 gate)
// Fixtures (Improvement D): fixtures-v508/book-live-
// 2026-11-17.json is the LIVE book payload captured
// through the prayer door at Implement (77 prayers, 9
// groups — the then-live book, v506's two rows in);
// fixtures-v508/fixed-texts.json is the fixed-text
// table the seam splitter generated from that payload.
// The render stub serves the post-0036 book (the live
// fixture with the 13 fixed fields standing in).
// The BASE tree defaults to the v507 ship; the ship
// run points V508_BASE_WT at the then-live ship.
// Run: node app/tests/harness-v508.mjs [--probe]
// (from the worktree root).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const BASE_WT = process.env.V508_BASE_WT || 'v507-ship';
const BASE = path.resolve(process.cwd(), '../../.worktrees/' + BASE_WT + '/app/worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const MIG36 = readFileSync(APP + '/migrations/0036_prayer_book_call_response.sql', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures-v508/book-live-2026-11-17.json', 'utf8'));
const FIXED = JSON.parse(readFileSync(APP + '/tests/fixtures-v508/fixed-texts.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
const ws = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const bookRow = (slug) => {
  let hit = null;
  (BOOK.groups || []).forEach((g) => (g.prayers || []).forEach((p) => { if (p.slug === slug) hit = { p, category: g.category }; }));
  return hit;
};
const nonblank = (t) => String(t).split('\n').filter((l) => l.trim()).length;
const blocksOf = (t) => String(t).split(/\n\s*\n/).map((b) => b.split('\n').filter((l) => l.trim()));

/* The 13 affected fields (slug, field) — the Plan's table. */
const AFFECTED = [
  ['angelus', 'body'], ['angelus', 'bodyLatin'],
  ['regina-caeli', 'body'], ['regina-caeli', 'bodyLatin'],
  ['hail-holy-queen', 'body'], ['hail-holy-queen', 'bodyLatin'],
  ['sub-tuum-praesidium', 'body'], ['sub-tuum-praesidium', 'bodyLatin'],
  ['the-rosary-prayers', 'body'], ['the-rosary-prayers', 'bodyLatin'],
  ['grace-before-meals', 'body'],
  ['grace-after-meals', 'body'],
  ['litany-of-loreto', 'body'],
];
/* Nonblank line counts after the fix (the generator's audit). */
const UNITS = {
  'angelus|body': 12, 'angelus|bodyLatin': 12,
  'regina-caeli|body': 5, 'regina-caeli|bodyLatin': 5,
  'hail-holy-queen|body': 5, 'hail-holy-queen|bodyLatin': 5,
  'sub-tuum-praesidium|body': 5, 'sub-tuum-praesidium|bodyLatin': 5,
  'the-rosary-prayers|body': 9, 'the-rosary-prayers|bodyLatin': 9,
  'grace-before-meals|body': 2, 'grace-after-meals|body': 8,
  'litany-of-loreto|body': 66,
};
const JOHN_AFTER = [
  'We give Thee thanks, almighty God, for all Thy benefits, Who livest and reignest world without end.',
  'R. Amen.',
  'Vouchsafe, O Lord, to reward with eternal life all those who do us good for Thy name\'s sake.',
  'R. Amen.',
  'V. Let us bless the Lord.',
  'R. Thanks be to God.',
  'V. May the souls of the faithful departed, through the mercy of God, rest in peace.',
  'R. Amen.',
];

/* ---------------- S: statics ---------------- */
{
  const ups = MIG36.split('\n').filter((l) => l.startsWith('UPDATE prayer_book SET '));
  ok(ups.length === 13, 'S1: migration 0036 carries exactly 13 UPDATE statements', String(ups.length));
  const pairs = [...MIG36.matchAll(/UPDATE prayer_book SET (body|body_latin) = '(?:[^']|'')*' WHERE slug = '([^']+)';/g)]
    .map((m) => m[2] + '|' + (m[1] === 'body' ? 'body' : 'bodyLatin'));
  ok(JSON.stringify([...pairs].sort()) === JSON.stringify(AFFECTED.map(([s, f]) => s + '|' + f).sort()),
    'S2: the 13 UPDATEs are exactly the Plan\'s fields (8 slugs; body + body_latin per the findings table)',
    pairs.join(','));
  ok(!/^(INSERT|DELETE|DROP|ALTER|CREATE)\b/m.test(MIG36) && !MIG36.includes('mass_personal_prayer'),
    'S3: 0036 carries no other DDL/DML and does not touch the Mass seats\' table');

  const HELPER = [
    '/* v508: the book body paints line by line. A line that',
    '   begins with a response marker (R. or the responsory',
    '   sign) carries the .bookresp dress (the v488 rule: the',
    '   people\'s responses bold); versicles and every other',
    '   line stand regular. Blank lines stand as blank lines,',
    '   so the text\'s standing block structure is preserved. */',
    'function bookBodyHtml(text) {',
    '  return String(text == null ? \'\' : text).split(\'\\\\n\').map(function (ln) {',
    '    if (!ln.trim()) return \'<div><br></div>\';',
    '    var resp = ln.indexOf(\'R. \') === 0 || ln.indexOf(\'\\\\u211f. \') === 0 || ln === \'R.\' || ln === \'\\\\u211f.\';',
    '    return \'<div\' + (resp ? \' class="bookresp"\' : \'\') + \'>\' + esc(ln) + \'</div>\';',
    '  }).join(\'\');',
    '}',
  ];
  const cLines = C_SRC.split('\n');
  const hAt = cLines.findIndex((l) => l === HELPER[0]);
  ok(hAt >= 0 && HELPER.every((l, i) => cLines[hAt + i] === l),
    'S4: client.ts carries the bookBodyHtml helper exactly as built (one helper, the response test on R. / the responsory sign)');
  const stripped = [...cLines.slice(0, hAt), ...cLines.slice(hAt + HELPER.length)];
  const bLines = C_BASE.split('\n');
  ok(stripped.length === bLines.length, 'S5: client.ts line count equals the base ship once the helper is set aside',
    stripped.length + ' vs ' + bLines.length);
  const diff = [];
  for (let i = 0; i < bLines.length; i++) if (stripped[i] !== bLines[i]) diff.push(i);
  const dOld = diff.map((i) => bLines[i]);
  const dNew = diff.map((i) => stripped[i]);
  ok(diff.length === 2
    && dOld.some((l) => l.includes('id="book-body"') && l.includes('esc(p.body)'))
    && dNew.some((l) => l.includes('id="book-body"') && l.includes('bookBodyHtml(p.body)'))
    && dOld.some((l) => l.includes('body.textContent = la ? p.bodyLatin : p.body'))
    && dNew.some((l) => l.includes('body.innerHTML = bookBodyHtml(la ? p.bodyLatin : p.body)')),
    'S6: exactly two client.ts lines differ from the base ship — the book-body paint and the language-toggle repaint, both through bookBodyHtml',
    JSON.stringify(diff));

  const a = pin(U_SRC).split('\n'), b = pin(U_BASE).split('\n');
  ok(a.filter((l) => l === '.bookresp { font-weight:700; }').length === 1,
    'S7: the .bookresp rule stands exactly once in ui.ts');
  const uStripped = a.filter((l) => l !== '.bookresp { font-weight:700; }');
  ok(uStripped.length === b.length && uStripped.every((l, i) => l === b[i]),
    'S8: ui.ts is byte-identical to the base ship (pin aside) once the .bookresp rule is set aside');
  for (const f of ['index.ts', 'mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts', 'logo.ts', 'logo512.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S9-' + f + ': byte-identical to the base ship');
  }
}

/* ---------------- U: units ---------------- */
{
  ok(Object.keys(FIXED).length === 13, 'U0: the fixed-text table carries exactly the 13 fields', String(Object.keys(FIXED).length));
  for (const [slug, f] of AFFECTED) {
    const key = slug + '|' + f;
    ok(nonblank(FIXED[key]) === UNITS[key],
      'U-' + key + ': the fixed text stands at the Plan\'s unit count (' + UNITS[key] + ' nonblank lines)',
      'got ' + nonblank(FIXED[key] || ''));
  }
  const reg = blocksOf(FIXED['regina-caeli|body']);
  ok(reg.length === 2 && reg[0].length === 1 && reg[1].length === 4,
    'U-regina-block: Regina Caeli body — the rubric line stands above, the prayer block stands at 4 units',
    JSON.stringify(reg.map((b) => b.length)));
  const ros = blocksOf(FIXED['the-rosary-prayers|body']);
  ok(ros[ros.length - 1].length === 5,
    'U-rosary-block: the Rosary Prayers\' closing Salve Regina block stands at 5 units (the prose blocks stand)',
    JSON.stringify(ros.map((b) => b.length)));
  const lit = blocksOf(FIXED['litany-of-loreto|body']);
  ok(lit[0].length === 9,
    'U-litany-block: the Litany of Loreto\'s first block (the Kyrie preamble) stands at 9 units, the Latin witness\' count',
    JSON.stringify(lit.map((b) => b.length).slice(0, 3)));
}

/* ---------------- W: words ---------------- */
{
  for (const [slug, f] of AFFECTED) {
    const key = slug + '|' + f;
    const before = bookRow(slug).p[f];
    ok(ws(before) === ws(FIXED[key]),
      'W-' + key + ': the fixed text with breaks stripped is word-stream-identical to the pre-fix text');
  }
  const gam = FIXED['grace-after-meals|body'].split('\n');
  ok(JSON.stringify(gam) === JSON.stringify(JOHN_AFTER),
    'W-grace-after-meals: the fixed text equals John\'s AFTER example line for line',
    JSON.stringify(gam));
}

/* ---------------- M: the migration proof ---------------- */
{
  const py = [
    'import sqlite3, sys, json',
    'def rd(p): return open(p).read()',
    'db = sqlite3.connect(":memory:")',
    'for f in sys.argv[1:8]: db.executescript(rd(f))',
    'snap = {r[0]: (r[1], r[2]) for r in db.execute("SELECT slug, body, body_latin FROM prayer_book")}',
    'db.executescript(rd(sys.argv[8]))',
    'fixed = json.load(open(sys.argv[9]))',
    'after = {r[0]: (r[1], r[2]) for r in db.execute("SELECT slug, body, body_latin FROM prayer_book")}',
    'assert set(after) == set(snap), "row set changed"',
    'col = {"body": 0, "bodyLatin": 1}',
    'for key, text in fixed.items():',
    '    slug, f = key.split("|")',
    '    assert after[slug][col[f]] == text, ("fixed field mismatch", key)',
    'for slug, (b, bl) in snap.items():',
    '    for f, i in col.items():',
    '        if slug + "|" + f not in fixed:',
    '            assert after[slug][i] == (b, bl)[i], ("untouched field changed", slug, f)',
    'n = db.execute("SELECT COUNT(*) FROM prayer_book").fetchone()[0]',
    'g = db.execute("SELECT COUNT(DISTINCT category) FROM prayer_book").fetchone()[0]',
    'assert n == 77 and g == 9, (n, g)',
    'print("MIGRATION_OK")',
  ].join('\n');
  const tmp = path.join(os.tmpdir(), 'harness-v508-mig.py');
  writeFileSync(tmp, py);
  const names = ['0026_prayer_book.sql', '0029_prayer_book_additions.sql', '0030_raccolta_prayer_source.sql',
    '0032_mass_personal_prayer.sql', '0033_mass_personal_prayer_seats.sql', '0034_post_mass_list_seed.sql',
    '0035_premass_seat_and_book_rows.sql', '0036_prayer_book_call_response.sql'];
  let migOut = '';
  try {
    migOut = execFileSync('python3', [tmp, ...names.map((n) => APP + '/migrations/' + n),
      APP + '/tests/fixtures-v508/fixed-texts.json'], { encoding: 'utf8' });
  } catch (e) { migOut = 'ERR ' + String((e.stdout || '') + (e.stderr || e.message)).slice(0, 240); }
  ok(migOut.includes('MIGRATION_OK'),
    'M1: the real chain (0026+0029+0030+0032+0033+0034+0035) builds the book; the real 0036 applies — the 13 fields read back byte-equal to the fixed table, every other field of every row byte-identical, the book at 77 prayers in 9 groups',
    migOut.trim().slice(0, 200));
}

/* ---------------- fixtures + page ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null;
try { COOKED = cook(C_SRC); ok(true, 'P1: the cooked APP_JS parses (the v439 gate)'); }
catch (e) { ok(false, 'P1: the cooked APP_JS parses (the v439 gate)', String(e).slice(0, 160)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

/* The post-0036 book: the live fixture with the 13 fixed fields standing in. */
const BOOK_AFTER = JSON.parse(JSON.stringify(BOOK));
for (const g of BOOK_AFTER.groups) for (const p of g.prayers) {
  for (const f of ['body', 'bodyLatin']) {
    const k = p.slug + '|' + f;
    if (FIXED[k]) p[f] = FIXED[k];
  }
}
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
function buildPage(cooked, css) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.fetch = function (path, opts) {
  const p = String(path);
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); } }); };
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
  if (p.indexOf('/api/prayer/book/favorites') === 0) return ans(200, { ok: true, favorites: [] });
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, ${JSON.stringify(BOOK_AFTER)});
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
const PAGE = buildPage(COOKED, APP_CSS);
const server = http.createServer((req, res) => {
  if ((req.url || '/').split('?')[0] === '/v508') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const EXE = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

const lineInfo = (page) => page.evaluate(() => {
  const host = document.getElementById('book-body');
  if (!host) return null;
  return Array.from(host.children).map((d) => ({
    text: d.textContent,
    weight: getComputedStyle(d).fontWeight,
    cls: d.getAttribute('class') || '',
  }));
});

/* ---------------- R: render ---------------- */
{
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
  });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note - pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + '/v508');
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - openblock slow'));
  await sleep(500);
  await page.evaluate(() => { goSide('prayers', 'book'); });
  await page.waitForSelector('[data-bookrow="grace-after-meals"]', { timeout: 15000 }).catch(() => console.log('note - book rows slow'));
  await sleep(300);

  await page.click('[data-bookrow="grace-after-meals"]');
  await page.waitForSelector('#book-body', { timeout: 10000 }).catch(() => console.log('note - book page slow'));
  await sleep(300);
  const gam = await lineInfo(page);
  ok(gam && gam.length === 8 && JSON.stringify(gam.map((l) => l.text)) === JSON.stringify(JOHN_AFTER),
    'R1: Grace After Meals renders with each of its 8 units on its own line, the texts exactly John\'s AFTER lines',
    gam ? JSON.stringify(gam.map((l) => l.text)) : 'no #book-body');
  ok(gam && gam.every((l) => (l.text.startsWith('R. ') || l.text === 'R.')
      ? (l.weight === '700' || l.weight === 'bold') && l.cls === 'bookresp'
      : !(l.weight === '700' || l.weight === 'bold') && l.cls === ''),
    'R2: on the Grace After Meals page every R.-initial line computes bold under .bookresp; the opening unit and the V. lines compute regular',
    gam ? JSON.stringify(gam.map((l) => [l.text.slice(0, 12), l.weight, l.cls])) : 'no lines');

  await page.evaluate(() => { openPrayerPage('angelus'); });
  await sleep(300);
  const ang = await lineInfo(page);
  const angFixed = FIXED['angelus|body'].split('\n');
  ok(ang && JSON.stringify(ang.map((l) => l.text)) === JSON.stringify(angFixed),
    'R3: The Angelus renders its 12 units on their own lines, exactly the fixed text',
    ang ? 'lines ' + ang.length : 'no lines');
  ok(ang && ang.every((l) => (l.text.startsWith('R. ') || l.text === 'R.')
      ? (l.weight === '700' || l.weight === 'bold')
      : !(l.weight === '700' || l.weight === 'bold')),
    'R4: on The Angelus page the R. lines compute bold; the V. lines and the unmarked units (Hail, Mary, etc. · the collect) compute regular',
    ang ? JSON.stringify(ang.map((l) => [l.text.slice(0, 14), l.weight])) : 'no lines');

  await page.click('#book-lang [data-lang="la"]');
  await sleep(300);
  const angLa = await lineInfo(page);
  const angLaFixed = FIXED['angelus|bodyLatin'].split('\n');
  ok(angLa && JSON.stringify(angLa.map((l) => l.text)) === JSON.stringify(angLaFixed)
    && angLa.every((l) => (l.text.startsWith('R. ') || l.text === 'R.')
      ? (l.weight === '700' || l.weight === 'bold')
      : !(l.weight === '700' || l.weight === 'bold')),
    'R5: the Latin toggle repaints The Angelus under the same rule — 12 Latin units on their own lines, R. lines bold, the rest regular',
    angLa ? 'lines ' + angLa.length : 'no lines');

  await page.evaluate(() => { openPrayerPage('pange-lingua'); });
  await sleep(300);
  const pange = await lineInfo(page);
  const pangeStored = bookRow('pange-lingua').p.body.split('\n');
  ok(pange && JSON.stringify(pange.map((l) => l.text)) === JSON.stringify(pangeStored),
    'R6: a clean prayer (Pange Lingua) renders text identical to its stored text — every stored line stands as its own line element, byte for byte, untouched by the fix',
    pange ? 'rendered ' + pange.length + ' line elements vs stored ' + pangeStored.length + ' lines' : 'no #book-body');

  ok(errs.length === 0, 'P2: Chromium boot clean through the book pages (no page errors)', errs.join(' ; '));
  await ctx.close();
  await browser.close();
}

server.close();
if (!PROBE) {
  console.log('harness-v508:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
