// harness-v523.mjs — v523 evidence: the Mass tab's
// version picker (.mass-vpicker) stands as ONE ROW of
// scrollable chips (John, Ora thread 2026-11-18 04:11 CT:
// "The day picker in the mass selection should.be one row
// of scrollable chips as it can get cut off long days").
// The standing dress cut the picker off on long days: the
// base .segtoggle clips with overflow:hidden, .mass-seg
// caps the strip at max-width:100%, and the pill buttons
// never shrink or wrap — on a day whose version labels run
// long, the trailing chips stood outside the clipped box,
// unreachable. The fix is ONE CSS touch in ui.ts: the
// picker takes the v497 readings-strip scroll idiom
// (.mass-chips) under its own class — overflow-x auto,
// hidden scrollbar, touch scrolling. Layout only: the
// option set, labels, selection behavior, and defaults
// stand unchanged; client.ts and every other source are
// byte-identical to the base.
//   S statics: client.ts / index.ts / the Mass sources
//     byte-identical to the v522-ship base · ui.ts differs
//     only by the named v523 rule (normalized away + pin
//     normalized -> byte-equal) · no migration past 0038 ·
//     the fixture IS the production calendar entry
//   P premise (the base tree in Chromium): on the
//     2026-11-23 payload the base picker overflows its box
//     with overflow-x hidden — the last chip stands cut
//     off and the strip cannot scroll
//   C client (the v511 Chromium mold, stubbed fetch):
//     cooked parse + boot clean · the long day's picker
//     paints all four production chips · computed style
//     reads overflow-x auto / flex-wrap nowrap · all chips
//     share ONE row · the strip scrolls and the LAST chip
//     scrolls fully into view (none cut off) · the default
//     chip (saint-clementi, the production default) stands
//     active on open · a tap on the ferial chip picks it
//     and repaints that formulary — selection unchanged ·
//     the short day (2026-11-17, two chips) stands at
//     fit-content with no overflow · the sibling toggles
//     stand as on the base
//   G439 (recorded as-is, NEVER a v523 pass): the standing
//     v439 boot gate run on this tree reads its standing
//     13 ok / 2 not-ok (B5 premise-superseded · B3
//     superseded by v492's boot rule)
// Fixtures (Improvement D), under tests/fixtures-v523/,
// extracted verbatim from the production MASS_CALENDAR in
// the v522-ship tree (app/worker/src/mass-calendar.ts) at
// Scope: mass-calendar-2026-11-23.json (the long day —
// four versions, labels totalling 138 chars, default
// saint-clementi) and mass-calendar-2026-11-17.json (the
// short day — two versions, default
// saint-elizabethofhungary). The Mass payloads the harness
// serves are built from those entries in the standing
// server shape (mass.ts resolveMassDay's output); each
// version carries a small stub formulary in the v511
// harness's form — harness dressing only; every picker
// fact (keys, labels, ranks, default) is the production
// entry's own. The day payload is the standing live
// fixture (tests/fixtures-v522/day-live-2026-11-17.json,
// drawn from production through the prayer door after the
// v521 ship).
// The base for byte comparisons is the v522 ship tree
// (H523_BASE overrides).
// Run: node app/tests/harness-v523.mjs [--probe] (from
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
const BASE = process.env.H523_BASE || path.resolve(ROOT, '../../.worktrees/v522-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v523';
const LONG = JSON.parse(readFileSync(FX + '/mass-calendar-2026-11-23.json', 'utf8'));
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
const V523_RULE = [
  '/* v523: the version picker (.mass-vpicker) takes the same',
  '   one-row scroll as the readings chips — its labels run as',
  '   long as the day\'s saints (four versions, 138+ chars on',
  '   the longest days), and the standing .segtoggle clip cut',
  '   the trailing chips off, unreachable. The strip stays',
  '   fit-content on short days; the scroll engages only when',
  '   the day\'s options overflow the row. */',
  '.mass-vpicker { overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -webkit-overflow-scrolling: touch; }',
  '.mass-vpicker::-webkit-scrollbar { display: none; }',
].join('\n');
{
  for (const f of ['client.ts', 'index.ts', 'mass.ts', 'mass-calendar.ts', 'mass-order.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S1-' + f + ': byte-identical to the v522-ship base');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(U_SRC.includes(V523_RULE), 'S2: the v523 rule stands in ui.ts in its named form (comment + the two scroll rules)');
  ok((U_SRC.match(/\.mass-vpicker \{/g) || []).length === 1, 'S3: the .mass-vpicker rule stands exactly once');
  ok(pin(U_SRC.replace(V523_RULE + '\n', '')) === pin(U_BASE),
    'S4: ui.ts with the v523 rule removed is byte-identical to the base outside the pin — the rule is the ONLY change');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1].startsWith('0038'), 'S5: no migration past 0038 stands', migs[migs.length - 1]);
  // The fixture IS the production entry: re-read the
  // calendar from the base source and compare whole.
  const calSrc = readFileSync(BASE + '/mass-calendar.ts', 'utf8');
  const cal = JSON.parse(calSrc.slice(calSrc.indexOf('{', calSrc.indexOf('='))).replace(/;\s*$/, ''));
  const prod = cal['2026-11-23'];
  ok(prod && prod.default === LONG.defaultVersion
    && prod.versions.length === LONG.versions.length
    && prod.versions.every((v, i) => v.key === LONG.versions[i].key && v.label === LONG.versions[i].label && (v.rank ?? null) === LONG.versions[i].rank),
    'S6: the long-day fixture matches the production MASS_CALENDAR entry for 2026-11-23 verbatim (keys, labels, ranks, default)');
  const prodS = cal['2026-11-17'];
  ok(prodS && prodS.default === SHORT.defaultVersion && prodS.versions.length === 2
    && prodS.versions.every((v, i) => v.key === SHORT.versions[i].key && v.label === SHORT.versions[i].label),
    'S7: the short-day fixture matches the production entry for 2026-11-17 verbatim');
  ok(LONG.versions.reduce((n, v) => n + v.label.length, 0) === 138 && LONG.versions.length === 4,
    'S8: the long day carries four versions whose labels total 138 chars (the cut-off premise, in production numbers)');
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
  '/long': buildPage(COOKED, APP_CSS, massPayload(LONG)),
  '/long-base': buildPage(COOKED_BASE, APP_CSS_BASE, massPayload(LONG)),
  '/short': buildPage(COOKED, APP_CSS, massPayload(SHORT)),
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
  await page.waitForSelector('.mass-vpicker', { timeout: 15000 }).catch(() => console.log('note -', tag, 'vpicker slow'));
  await sleep(300);
  return { ctx, page };
}
const picker = (page) => page.evaluate(() => {
  const vp = document.querySelector('.mass-vpicker');
  if (!vp) return null;
  const cs = getComputedStyle(vp);
  const vr = vp.getBoundingClientRect();
  const btns = Array.from(vp.querySelectorAll('button'));
  return {
    overflowX: cs.overflowX, flexWrap: cs.flexWrap,
    clientWidth: vp.clientWidth, scrollWidth: vp.scrollWidth, scrollLeft: vp.scrollLeft,
    height: Math.round(vp.offsetHeight), boxLeft: vr.left, boxRight: vr.right,
    labels: btns.map((b) => b.textContent),
    keys: btns.map((b) => b.getAttribute('data-version')),
    tops: btns.map((b) => Math.round(b.getBoundingClientRect().top)),
    active: (vp.querySelector('button.active') || {}).getAttribute ? vp.querySelector('button.active').getAttribute('data-version') : null,
  };
});

/* ---------------- P: premise on the base ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/long-base', errs, 'base');
  const p = await picker(page);
  ok(!!p, 'P1: the base paints the version picker for the long day');
  if (p) {
    ok(p.scrollWidth > p.clientWidth && p.overflowX === 'hidden',
      'P2: PREMISE — on the base the picker overflows its box while overflow-x reads hidden (the cut-off state)',
      'scrollWidth ' + p.scrollWidth + ' vs clientWidth ' + p.clientWidth + ', overflow-x ' + p.overflowX);
    const after = await page.evaluate(() => {
      // At rest (the state John sees): overflow:hidden clips
      // the tail — the strip offers no user scrolling under
      // that value (a programmatic scrollLeft is the only
      // movement, and the app never performs one).
      const vp = document.querySelector('.mass-vpicker');
      const btns = vp.querySelectorAll('button');
      const first = btns[0].getBoundingClientRect();
      const last = btns[btns.length - 1].getBoundingClientRect();
      const vr = vp.getBoundingClientRect();
      return { scrollLeft: vp.scrollLeft, firstLeft: first.left, firstRight: first.right, lastRight: last.right, boxLeft: vr.left, boxRight: vr.right };
    });
    ok(after.scrollLeft === 0 && after.firstLeft >= after.boxLeft - 1 && after.lastRight > after.boxRight + 1,
      'P3: PREMISE — at rest the base strip clips its tail: the first chip stands in view and the last chip\'s right edge stands past the box edge, cut off with no user scroll to reach it',
      JSON.stringify(after));
  }
  ok(errs.length === 0, 'P4: the base boot carries no page errors', errs.join(' · '));
  await ctx.close();
}

/* ---------------- C: the long day on the build ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/long', errs, 'long');
  ok(errs.length === 0, 'C0: boot clean — no page errors on the long-day page', errs.join(' · '));
  const p = await picker(page);
  ok(!!p, 'C1: the version picker stands at the head of the Mass scroll');
  if (p) {
    ok(JSON.stringify(p.labels) === JSON.stringify(LONG.versions.map((v) => v.label))
      && JSON.stringify(p.keys) === JSON.stringify(LONG.versions.map((v) => v.key)),
      'C2: all four production chips stand, in the calendar\'s order, with the production labels', p.labels.join(' · '));
    ok(p.overflowX === 'auto', 'C3: the picker\'s computed overflow-x reads auto (the v523 scroll stands)', p.overflowX);
    ok(p.flexWrap === 'nowrap', 'C4: the strip never wraps — computed flex-wrap reads nowrap', p.flexWrap);
    ok(new Set(p.tops).size === 1 && p.height <= 40,
      'C5: ONE ROW — every chip shares one offsetTop and the strip stands one chip-row tall',
      'tops ' + JSON.stringify(p.tops) + ', height ' + p.height);
    ok(p.scrollWidth > p.clientWidth, 'C6: the long day overflows the row (the scroll has something to carry)',
      'scrollWidth ' + p.scrollWidth + ' vs clientWidth ' + p.clientWidth);
    ok(p.active === LONG.defaultVersion, 'C7: the default stands as production names it — the saint-clementi chip is active on open', String(p.active));
    const sc = await page.evaluate(async () => {
      const vp = document.querySelector('.mass-vpicker');
      vp.scrollLeft = vp.scrollWidth;
      await new Promise((r) => setTimeout(r, 120));
      const btns = vp.querySelectorAll('button');
      const vr = vp.getBoundingClientRect();
      const first = btns[0].getBoundingClientRect();
      const last = btns[btns.length - 1].getBoundingClientRect();
      return { scrollLeft: vp.scrollLeft, firstRight: first.right, lastLeft: last.left, lastRight: last.right, boxLeft: vr.left, boxRight: vr.right };
    });
    ok(sc.scrollLeft > 0 && sc.lastRight <= sc.boxRight + 1.5 && sc.lastLeft >= sc.boxLeft - 1.5 && sc.firstRight <= sc.boxLeft + 1.5,
      'C8: scrolled to the end, the LAST chip stands fully inside the visible box and the first chip has scrolled out — every option reachable, none cut off',
      JSON.stringify(sc));
    await page.click('.mass-vpicker button[data-version="ferial"]');
    await sleep(400);
    const q = await picker(page);
    const scrollText = await page.evaluate(() => document.querySelector('.mass-scroll').textContent);
    ok(!!q && q.active === 'ferial' && scrollText.includes('Collect of the ferial formulary'),
      'C9: a tap on the ferial chip picks it — active moves and the scroll repaints with that version\'s formulary (selection behavior unchanged)');
    const sibs = await page.evaluate(() => ({
      pen: !!document.querySelector('.mass-pentoggle'), ep: !!document.querySelector('.mass-eptoggle'),
      ltoggle: !!document.querySelector('.mass-ltoggle'),
    }));
    ok(sibs.pen && sibs.ep, 'C10: the sibling Mass toggles (Penitential · Eucharistic Prayer) stand as on the base');
  }
  await ctx.close();
}

/* ---------------- C: the short day on the build ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/short', errs, 'short');
  const p = await picker(page);
  ok(!!p && p.labels.length === 2, 'C11: the short day paints its two-chip picker');
  if (p) {
    ok(p.scrollWidth <= p.clientWidth + 1 && p.active === SHORT.defaultVersion,
      'C12: the short day stands at fit-content — no overflow, no scroll engaged — and opens on the memorial default',
      'scrollWidth ' + p.scrollWidth + ' vs clientWidth ' + p.clientWidth + ', active ' + String(p.active));
    const hug = await page.evaluate(() => {
      const vp = document.querySelector('.mass-vpicker');
      const sc = document.querySelector('.mass-scroll');
      return { vp: vp.offsetWidth, scroll: sc.clientWidth };
    });
    ok(hug.vp < hug.scroll - 8, 'C13: the short-day pill hugs its chips (fit-content), not stretched full-width', JSON.stringify(hug));
  }
  ok(errs.length === 0, 'C14: the short-day boot carries no page errors', errs.join(' · '));
  await ctx.close();
}

/* ---------------- G439: the standing gate, as-is ---------------- */
{
  let out = '';
  try {
    out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const m = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!m && +m[1] === 13 && +m[2] === 2,
    'G439 (recorded as-is, not a v523 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    m ? m[0] : 'no summary line in the gate output');
}

await browser.close();
server.close();
console.log('\nharness-v523: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
