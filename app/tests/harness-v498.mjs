// harness-v498.mjs — v498 evidence: the Mass tab's titles
// (John, main chat 2026-11-17 08:47 CT: "First is titled
// Lectionary and Virtual Mass. Mainn Header underneath
// Lectionary shod be called Daily Lectionary").
// The change is labels only (the v438/v492 precedent):
// toggle side 1 Liturgy -> Lectionary, side 2 Virtual ->
// Virtual Mass, and the Lectionary side's main header —
// paintMassScroll's .mass-day heading, which carried the
// day's observance name — reads "Daily Lectionary" with
// the observance name standing as its own line directly
// under it. Side keys ('liturgy'/'virtual'), the store
// key (opn-tabside-mass-v493), routes, and data stand.
// SUBJECT: a tree carrying the v498 build on the v497
// ship lineage. Run from that worktree's root:
//   node app/tests/harness-v498.mjs [--probe]
// Fixtures (Improvement D): the day payload's liturgical
// record and the Mass payload are the live production
// records for 2026-11-17 (Memorial of Saint Elizabeth of
// Hungary, Religious), captured through the app door for
// the v495/v496 harnesses in the standing route shapes;
// the readings feed parts stand in the v490 production
// shape for the same date (Rev 3 · Ps 15 · 1 Jn 4 ·
// Lk 19 — the day's actual USCCB readings).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = path.resolve(process.cwd(), '../../.worktrees/v497-ship/app/worker/src');
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
  ok(C_SRC.includes("sides: [['liturgy', 'Lectionary'], ['virtual', 'Virtual Mass']]"),
    'S1: tabSideCfg(mass) carries the new side titles on the standing keys');
  ok(C_SRC.includes("var TAB_SIDE_MASS_KEY = 'opn-tabside-mass-v493';") && C_SRC.includes("def: 'liturgy'"),
    'S2: the store key and the first-run default stand untouched');
  ok(!C_SRC.includes("['liturgy', 'Liturgy']") && !C_SRC.includes("'Virtual' : 'Liturgy'") && !C_SRC.includes("['virtual', 'Virtual']"),
    'S3: no old side-title literal stands at any seat (cfg · row-2 titles · menu)');
  ok(C_SRC.includes("title = side === 'virtual' ? 'Virtual Mass' : 'Lectionary';")
    && C_SRC.includes("mt.textContent = side === 'virtual' ? 'Virtual Mass' : 'Lectionary';"),
    'S4: both row-2 title seats name the standing side by its new title');
  ok(C_SRC.includes("h += '<div class=\"mass-day\">Daily Lectionary</div>';")
    && C_SRC.includes("h += '<div class=\"mass-dayname\">' + esc(p.name || 'Mass of the Day') + '</div>';"),
    'S5: the scroll head — Daily Lectionary header, the observance name on its own line under it, the standing fallback kept');
  // The whole-file seat proof: reversing the v498 edits
  // reproduces the v497 ship's client.ts byte for byte.
  const rev = (s) => s
    .replace("sides: [['liturgy', 'Lectionary'], ['virtual', 'Virtual Mass']]", "sides: [['liturgy', 'Liturgy'], ['virtual', 'Virtual']]")
    .replace("title = side === 'virtual' ? 'Virtual Mass' : 'Lectionary';", "title = side === 'virtual' ? 'Virtual' : 'Liturgy';")
    .replace("mt.textContent = side === 'virtual' ? 'Virtual Mass' : 'Lectionary';", "mt.textContent = side === 'virtual' ? 'Virtual' : 'Liturgy';")
    .replace("[['liturgy', 'Lectionary'], ['virtual', 'Virtual Mass']].forEach", "[['liturgy', 'Liturgy'], ['virtual', 'Virtual']].forEach")
    .replace("  h += '<div class=\"mass-day\">Daily Lectionary</div>';\n  h += '<div class=\"mass-dayname\">' + esc(p.name || 'Mass of the Day') + '</div>';",
             "  h += '<div class=\"mass-day\">' + esc(p.name || 'Mass of the Day') + '</div>';")
    .replace("/* v493: the Mass tab joins the merged-tab family — two\n   sides, Lectionary (the standing day's-Mass scroll) and\n   Virtual Mass (the entries list), the v410 key pattern\n   with this release's number; first-run default\n   Lectionary. (Side titles renamed by v498; the side keys\n   and this store key are unchanged.) */",
             "/* v493: the Mass tab joins the merged-tab family — two\n   sides, Liturgy (the standing day's-Mass scroll) and\n   Virtual (the entries list), the v410 key pattern with\n   this release's number; first-run default Liturgy. */")
    .replace("  // paints the row-2 home (the side's title + the\n  // Lectionary | Virtual Mass pill) and the side host; the\n  // sides paint through",
             "  // paints the row-2 home (the side's title + the Liturgy |\n  // Virtual pill) and the side host; the sides paint through");
  ok(rev(C_SRC) === C_BASE, 'S6: client.ts differs from the v497 ship only at the v498 seats (labels · titles · menu · scroll head · two comments)');
  const stripDayname = (s) => s
    .replace("/* v498: the day's observance name stands as its own line\n   under the fixed Daily Lectionary header. */\n.mass-dayname { font-size: 16.5px; font-weight: 600; margin: 0 0 2px; }\n", '')
    .replace(".mass-scroll.ts-0 .mass-dayname { font-size: 15px; }\n", '')
    .replace(".mass-scroll.ts-2 .mass-dayname { font-size: 18.5px; }\n", '')
    .replace(".mass-scroll.ts-3 .mass-dayname { font-size: 20.5px; }\n", '');
  const stripPin = (s) => s.replace(/var CACHE = "ora-pro-nobis-v[0-9]+-[0-9]+"/, 'var CACHE = "PIN"');
  ok(stripPin(stripDayname(U_SRC)) === stripPin(U_BASE), 'S7: ui.ts differs from the v497 ship only at the .mass-dayname rules (pin aside)');
  ok(U_SRC.includes('.mass-dayname { font-size: 16.5px; font-weight: 600;'),
    'S8: the .mass-dayname rule stands (a name line between the header and the date)');
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

const LIT_WHITE = { name: 'Memorial of Saint Elizabeth of Hungary, Religious', color: 'white' };
function dayPayload() {
  return {
    ok: true, date: '2026-11-17', presentedDay: '2026-11-17',
    dateLabel: 'Tuesday, November 17, 2026',
    liturgicalDay: LIT_WHITE,
    introTexts: {},
    blocks: [{ block: 'Morning', label: 'Morning', tracks: [
      { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
      { episodeId: '9002', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/9002.mp3' },
    ] }],
    episodes: [],
  };
}
const MASS_PAYLOAD = {
  ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary',
  defaultVersion: 'elizabeth',
  versions: [{ key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: {
    entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
    collect: 'O God, who made the Memorial of Saint Elizabeth a sign of your care, grant, we pray, that we may follow her example. Through our Lord Jesus Christ, your Son.',
    prayerOverOfferings: 'Accept, O Lord, the offerings we bring in honor of Saint Elizabeth.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
    prayerAfterCommunion: 'Nourished by this sacrament, O Lord, may we imitate Saint Elizabeth in charity.',
  } }],
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. I will seat the victor beside me on my throne.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town.</p>' },
] };

function buildPage(cooked, css) {
  const DAY = dayPayload();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.__bridge = [];
window.Capacitor = { Plugins: { OraDayBridge: {
  setStatusBarColor: function (o) { window.__bridge.push({ m: 'setStatusBarColor', color: o && o.color }); return Promise.resolve({}); },
  setDaySnapshot: function () { return Promise.resolve({}); },
} } };
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push(p);
  const J = (v) => Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(v); } });
  if (p.indexOf('/api/player/day') === 0) return J(${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/day') === 0) return J(${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return J(${JSON.stringify(MASS_PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return J(${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/player/podcasts') === 0) return J({ ok: true, seriesList: [] });
  if (p.indexOf('/api/exam/today') === 0) return J({ ok: true, run: null, categories: [], prompts: [], focusCategory: null });
  return J({ ok: true });
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

const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  const map = { '/v498': buildPage(COOKED, APP_CSS), '/base': buildPage(COOKED_BASE, APP_CSS_BASE) };
  if (map[u]) { res.setHeader('Content-Type', 'text/html'); res.end(map[u]); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(which, preset, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (preset) await ctx.addInitScript((kv) => { for (const k in kv) { try { localStorage.setItem(k, kv[k]); } catch (e) {} } }, preset);
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => { if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort(); });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await sleep(1600);
  return { ctx, page };
}

const MASS_READ = () => {
  const tog = document.getElementById('sidetoggle');
  const btns = tog ? Array.from(tog.querySelectorAll('[data-side]')) : [];
  const day = document.querySelector('.mass-day');
  const dayname = document.querySelector('.mass-dayname');
  const date = document.querySelector('.mass-date');
  let order = null;
  if (day && dayname && date) {
    const pos = (el) => { let n = 0; let x = el; while (x.previousElementSibling) { x = x.previousElementSibling; n++; } return n; };
    order = [['day', day], ['dayname', dayname], ['date', date]]
      .sort((a, b) => pos(a[1]) - pos(b[1])).map((x) => x[0]).join('>');
  }
  const entry = document.querySelector('[data-massventry] h3');
  return {
    tab: (document.querySelector('#tabbar .tab.active') || {}).getAttribute ? document.querySelector('#tabbar .tab.active').getAttribute('data-tab') : null,
    title: (document.getElementById('hdr2-title') || {}).textContent || null,
    btns: btns.map((b) => ({ side: b.getAttribute('data-side'), text: b.textContent.trim(), active: b.classList.contains('active'), top: b.getBoundingClientRect().top })),
    day: day ? day.textContent : null,
    dayname: dayname ? dayname.textContent : null,
    date: date ? date.textContent : null,
    order: order,
    hasScroll: !!document.querySelector('.mass-scroll'),
    entryTitle: entry ? entry.textContent : null,
  };
};

/* -------- (a)+(b) fresh boot: the toggle, the title, the header -------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v498', null, errs, 'ab');
  await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note - ab: scroll slow'));
  const r = await page.evaluate(MASS_READ);
  console.log('FRESH BOOT:', JSON.stringify(r));
  ok(r.tab === 'mass', 'A0: a cold boot opens on Mass (the v492 rule stands)', r.tab);
  ok(r.btns.length === 2 && r.btns[0].text === 'Lectionary' && r.btns[1].text === 'Virtual Mass',
    'A1: the Mass toggle reads Lectionary | Virtual Mass, in that order', JSON.stringify(r.btns.map((b) => b.text)));
  ok(r.btns[0].side === 'liturgy' && r.btns[1].side === 'virtual' && r.btns[0].active && !r.btns[1].active,
    'A2: the side keys stand (liturgy · virtual) and Lectionary stands active on first open');
  ok(Math.abs(r.btns[0].top - r.btns[1].top) < 2, 'A3: the toggle stands on one row', r.btns[0].top + ' vs ' + r.btns[1].top);
  ok(r.title === 'Lectionary', 'A4: the row-2 title names the standing side — Lectionary', String(r.title));
  ok(r.day === 'Daily Lectionary', 'B1: the Lectionary side main header reads Daily Lectionary', String(r.day));
  ok(r.dayname === LIT_WHITE.name, 'B2: the day observance name stands on the Lectionary side', String(r.dayname));
  ok(r.order === 'day>dayname>date' && !!r.date,
    'B3: the name stands as its own line directly under the header, the date line under it', String(r.order) + ' / ' + String(r.date));
  ok(errs.length === 0, 'B4: no page errors on the fresh boot', errs.join(' ; '));

  /* -------- (c) switch to Virtual Mass and back -------- */
  await page.click('#sidetoggle [data-side="virtual"]');
  await sleep(700);
  const v = await page.evaluate(MASS_READ);
  console.log('VIRTUAL SIDE:', JSON.stringify(v));
  ok(v.title === 'Virtual Mass', 'C1: the row-2 title follows the switch — Virtual Mass', String(v.title));
  ok(!v.hasScroll && v.entryTitle === 'Catholic TV Mass',
    'C2: the Virtual Mass side opens its standing content — the entries list, Catholic TV Mass first', String(v.entryTitle));
  ok(v.btns[1].active && !v.btns[0].active, 'C3: the toggle marks Virtual Mass active');
  await page.click('#sidetoggle [data-side="liturgy"]');
  await sleep(700);
  const back = await page.evaluate(MASS_READ);
  ok(back.hasScroll && back.title === 'Lectionary' && back.day === 'Daily Lectionary' && back.dayname === LIT_WHITE.name,
    'C4: the switch back returns the Lectionary side whole — title, header, name, scroll');
  ok(errs.length === 0, 'C5: no page errors across the side switches', errs.join(' ; '));
  await ctx.close();
}

/* -------- (c2) a stored second-side value lands on Virtual Mass -------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v498', { 'opn-lasttab-v492': 'mass', 'opn-tabside-mass-v493': 'virtual' }, errs, 'c2');
  const r = await page.evaluate(MASS_READ);
  console.log('STORED VIRTUAL:', JSON.stringify(r));
  ok(r.tab === 'mass' && r.title === 'Virtual Mass' && r.entryTitle === 'Catholic TV Mass' && r.btns[1].active,
    'C6: a stored virtual side value lands on the side now titled Virtual Mass (the store key stands)', String(r.title));
  ok(errs.length === 0, 'C7: no page errors on the stored-side boot', errs.join(' ; '));
  await ctx.close();
}

/* -------- (d) the scroll outside the header seat is the base's -------- */
{
  const errs = [];
  const a = await boot('/v498', null, errs, 'd-new');
  await a.page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note - d: new scroll slow'));
  const b = await boot('/base', null, errs, 'd-base');
  await b.page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note - d: base scroll slow'));
  const hNew = await a.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const hBase = await b.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const tail = (h) => h.slice(h.indexOf('<div class="mass-date">'));
  ok(hNew && hBase && tail(hNew) === tail(hBase),
    'D1: from the date line down, the Mass scroll renders byte-identical to the v497 ship (readings · propers · sections · chip seats untouched)');
  const head = (h) => h.slice(0, h.indexOf('<div class="mass-date">'));
  ok(head(hBase).includes('<div class="mass-day">' + LIT_WHITE.name + '</div>') && !head(hBase).includes('Daily Lectionary'),
    'D2: the base head carries the observance name in .mass-day (the seat as read at Scope)');
  ok(head(hNew).includes('<div class="mass-day">Daily Lectionary</div>') && head(hNew).includes('<div class="mass-dayname">' + LIT_WHITE.name + '</div>'),
    'D3: the new head — Daily Lectionary in .mass-day, the same name standing in .mass-dayname');
  const notice = (h) => h.slice(0, h.indexOf('<div class="mass-day">'));
  ok(notice(hNew) === notice(hBase), 'D4: the scroll above the header (the ICEL notice seat) is byte-identical');
  ok(errs.length === 0, 'D5: no page errors in the identity legs', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v498:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
