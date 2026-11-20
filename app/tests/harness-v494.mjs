// harness-v494.mjs — v494 evidence: the Mass scroll's
// segmented toggle boxes (.segtoggle.pill.mass-seg) size to
// their content (no empty track tail), and the Eucharistic
// Prayer segments read Prayer I | Prayer II | Prayer III |
// Prayer IV (John, 2026-11-17 07:09 + 07:10 CT; the full
// labels supersede v489's short I | II | III | IV).
// Geometry is MEASURED on rendered boxes in Chromium:
//   (a) each toggle box's width equals its segments' combined
//       width within rounding — the Kyrie English | Greek box
//       (John's screenshot case) and the Gloria English |
//       Latin box measure < the line width, no tail
//   (b) the EP box (Prayer N labels) fits and stays one row
//       at base text size AND at ts-3 (largest), at 390px and
//       at the narrow 360px width
//   (c) the version picker fits on a two-version day
//   (d) every toggle still works (language · EP · version)
//   (e) the Mass scroll content is byte-identical to the
//       v493 build rendering, the EP segment labels excepted
//   (f) cooked parse + Chromium boot clean (the v439 gate)
// Fixtures (Improvement D) are the harness-v493 set: the
// Mass payload in mass.ts's shape (a two-version optional-
// memorial day), the readings feed in mass-readings.ts's
// shape. Run: node app/tests/harness-v494.mjs [--probe]
// (from the worktree root). --probe only measures + prints.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = path.resolve(process.cwd(), '../../.worktrees/v493-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- S: statics ---------------- */
{
  const seg = U_SRC.slice(U_SRC.indexOf('.mass-seg {'), U_SRC.indexOf('}', U_SRC.indexOf('.mass-seg {')));
  ok(seg.includes('width: fit-content'), 'S1: the .mass-seg seat rule carries width: fit-content', seg.trim());
  ok(seg.includes('flex-wrap: nowrap') && seg.includes('max-width: 100%'), 'S2: the .mass-seg seat keeps nowrap + max-width 100% (the one-row guard stands)');
  const ep = C_SRC.slice(C_SRC.indexOf('function massEpHtml()'), C_SRC.indexOf('function massFormulary()'));
  ok(ep.includes(">Prayer ' + k"), 'S3: massEpHtml prints the full Prayer N segment labels');
  ok(ep.includes("['I', 'II', 'III', 'IV']") && ep.includes('data-ep="'), 'S4: the EP keys + data-ep values stand unchanged (I · II · III · IV)');
  ok(C_SRC.includes("'<div class=\"mass-h\">Eucharistic Prayer</div>'"), 'S5: the Eucharistic Prayer heading above the box stands unchanged');
  // the ui.ts delta against the v493 ship (production base) is the
  // .mass-seg rule plus the SW CACHE pin line alone
  const strip = (s) => s.replace(/\.mass-seg \{[^}]*\}/, '.mass-seg {}')
    .replace(/var CACHE = "ora-pro-nobis-v[0-9]+-[0-9]+"/, 'var CACHE = "PIN"');
  ok(strip(U_SRC) === strip(U_BASE), 'S6: ui.ts outside the .mass-seg rule + the pin line is byte-identical to the v493 ship');
  // the client.ts delta is the EP label alone
  ok(C_SRC.split("'>Prayer ' + k").join("'>' + k") === C_BASE,
    'S7: client.ts differs from the v493 ship only at the EP label seat');
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
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push({ path: p });
  if (p.indexOf('/api/player/day') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(DAY)}); } });
  if (p.indexOf('/api/prayer/mass?') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(MASS_PAYLOAD)}); } });
  if (p.indexOf('/api/prayer/mass-readings') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(MASS_FEED)}); } });
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
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
  if (u === '/v494') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
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

async function boot(which, width, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
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
  await sleep(700);
  return { ctx, page };
}

const MEASURE = () => {
  const out = {};
  const scroll = document.querySelector('.mass-scroll');
  out.lineW = scroll ? scroll.getBoundingClientRect().width : null;
  function box(sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const kids = Array.from(el.querySelectorAll('button, .mass-csize'));
    const segW = kids.reduce((a, k) => a + k.getBoundingClientRect().width, 0);
    const tops = kids.map((k) => Math.round(k.getBoundingClientRect().top));
    const last = kids[kids.length - 1];
    return { w: r.width, h: r.height, segW, tops, labels: kids.map((k) => k.textContent),
      lastRightGap: last ? (r.right - last.getBoundingClientRect().right) : null };
  }
  out.kyrie = box('#mass-part-kyrie .mass-ltoggle');
  out.gloria = box('#mass-part-sanctus .mass-ltoggle');
  out.ep = box('.mass-eptoggle');
  out.vpicker = box('.mass-vpicker');
  out.stepper = box('.mass-controls .mass-seg');
  return out;
};

/* ---------------- geometry at 390px ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v494', 390, errs, 'g390');
  const m = await page.evaluate(MEASURE);
  console.log('MEASURE 390:', JSON.stringify(m));
  const fit = (b) => b && Math.abs(b.w - (b.segW + 4)) <= 3 && b.lastRightGap !== null && b.lastRightGap <= 5;
  ok(fit(m.kyrie) && m.kyrie.w < m.lineW * 0.75, 'A1: the Kyrie English | Greek box fits its segments — no tail (John\'s screenshot case)', JSON.stringify(m.kyrie) + ' line ' + m.lineW);
  ok(fit(m.gloria), 'A2: the Sanctus English | Latin box fits its segments', JSON.stringify(m.gloria));
  ok(fit(m.ep) && m.ep.labels.join('|') === 'Prayer I|Prayer II|Prayer III|Prayer IV', 'B1: the EP box fits its Prayer N segments', JSON.stringify(m.ep));
  ok(m.ep && new Set(m.ep.tops).size === 1, 'B2: the EP box stands one row at base text size (390px)', JSON.stringify(m.ep && m.ep.tops));
  ok(fit(m.vpicker), 'C1: the version picker box fits its segments on a two-version day', JSON.stringify(m.vpicker));
  ok(m.stepper && Math.abs(m.stepper.w - (m.stepper.segW + 4)) <= 3, 'C2: the text-size stepper still fits its content (unchanged)', JSON.stringify(m.stepper));
  ok(errs.length === 0, 'F1: Chromium boot + Mass render clean at 390px (no page errors)', errs.join(' ; '));

  /* -------- (d) toggles still work -------- */
  const kyBefore = await page.evaluate(() => document.querySelector('#mass-part-kyrie .mass-partbody').textContent);
  await page.click('#mass-part-kyrie [data-lt="kyrie:la"]');
  await sleep(400);
  const kyAfter = await page.evaluate(() => ({ t: document.querySelector('#mass-part-kyrie .mass-partbody').textContent, act: document.querySelector('#mass-part-kyrie [data-lt="kyrie:la"]').className }));
  ok(kyAfter.t !== kyBefore && kyAfter.act.includes('active'), 'D1: the Kyrie language toggle still switches English -> Greek and repaints the part');
  const epBefore = await page.evaluate(() => document.querySelector('#mass-epbody').textContent.slice(0, 120));
  await page.click('.mass-eptoggle [data-ep="IV"]');
  await sleep(400);
  const epAfter = await page.evaluate(() => ({ t: document.querySelector('#mass-epbody').textContent.slice(0, 120), ep: state.mass.ep, act: document.querySelector('.mass-eptoggle [data-ep="IV"]').className }));
  ok(epAfter.ep === 'IV' && epAfter.t !== epBefore && epAfter.act.includes('active'), 'D2: the EP toggle still switches (Prayer II -> Prayer IV) and repaints the EP body');
  const colBefore = await page.evaluate(() => document.querySelector('.mass-scroll').textContent.includes('sign of your care'));
  await page.click('.mass-vpicker [data-version="feria"]');
  await sleep(400);
  const colAfter = await page.evaluate(() => ({ feria: document.querySelector('.mass-scroll').textContent.includes('honor you with all our mind'), v: state.mass.version }));
  ok(colBefore && colAfter.feria && colAfter.v === 'feria', 'D3: the version picker still switches the formulary');
  await ctx.close();
}

/* ---------------- (e) byte-identity vs the v493 ship ---------------- */
{
  const errs = [];
  const a = await boot('/v494', 390, errs, 'e494');
  const b = await boot('/base', 390, errs, 'eBase');
  const norm = (html) => html ? html.replace(/>Prayer (I|II|III|IV)</g, '>$1<') : html;
  const hNew = await a.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const hBase = await b.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  ok(hNew && hBase && norm(hNew) === hBase, 'E1: the Mass scroll renders byte-identical to the v493 ship, the EP segment labels excepted');
  await a.ctx.close(); await b.ctx.close();
}

/* ---------------- (b) narrow 360px, base + largest size ---------------- */
for (const size of ['base', 'ts3']) {
  const errs = [];
  const { ctx, page } = await boot('/v494', 360, errs, 'n360-' + size);
  if (size === 'ts3') {
    await page.click('.mass-controls [data-tsize="1"]'); await sleep(350);
    await page.click('.mass-controls [data-tsize="1"]'); await sleep(350);
  }
  const m = await page.evaluate(MEASURE);
  console.log('MEASURE 360 ' + size + ':', JSON.stringify(m));
  const oneRow = m.ep && new Set(m.ep.tops).size === 1;
  const noClip = m.ep && Math.abs(m.ep.w - (m.ep.segW + 4)) <= 3 && m.ep.lastRightGap <= 5 && m.ep.w <= m.lineW + 1;
  ok(oneRow && noClip, 'B3-' + size + ': the EP box (Prayer N labels) holds one row, unclipped, at 360px / ' + size, JSON.stringify(m.ep) + ' line ' + m.lineW);
  ok(m.kyrie && Math.abs(m.kyrie.w - (m.kyrie.segW + 4)) <= 3, 'B4-' + size + ': the Kyrie box still fits at 360px / ' + size, JSON.stringify(m.kyrie));
  await ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v494:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
