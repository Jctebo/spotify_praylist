// harness-v543.mjs — v543 evidence: the "Eucharistic
// Prayer" heading stands at the head of the prayer itself
// (John, Ora thread 2026-11-19 06:09 CT: "I think the
// Eucharistic prayer heading is too high").
// The production mechanism, measured on the base tree in
// Chromium before any fix: every .mass-h subheading in the
// scroll stands 18 px above / 6 px below, the Eucharistic
// Prayer heading among them — no margin outlier; every
// .mass-section divider stands in the same posture — no
// divider outlier. The one outlier is paint order in
// massEpHtml: the heading + toggle were emitted at the
// very head of the prayer block, before the Preface
// Dialogue, the Preface, and the Sanctus, so the first
// line of the prayer it names stood over 600 px below it,
// while every other subheading stands 6 px above the
// first line of its body. The fix is inside massEpHtml
// only: for Prayers I-III the approach (dialogue ·
// Preface · Sanctus) paints first and the heading +
// toggle follow, immediately before the prayer's own
// lines; for Prayer IV — whose stored segment carries
// its own dialogue, Preface, and Sanctus inside it and
// is indivisible — the heading + toggle stand at the
// block head as before, above that prayer's own opening.
// Placement only: the toggle's options, default (II on
// open), and repaint stand unchanged; no stored text is
// edited, sliced, or reworded; no CSS changes; no other
// file changes; no migration.
//   S statics: index.ts / mass.ts / mass-calendar.ts /
//     mass-order.ts / mass-readings.ts byte-identical to
//     the v539-ship production base · client.ts identical
//     outside massEpHtml and its v543 comment · ui.ts
//     byte-identical (the pin moves only in the ship
//     tree) · no migration past 0040 · the fixtures ARE
//     the production calendar entry and the standing live
//     day fixture
//   P premise (the base tree in Chromium): the heading
//     stands glued to its toggle at the block head (6 px)
//     AND over 600 px above the first line of the prayer
//     it names, while every other visible subheading
//     stands under 60 px above the next element of its
//     body — paint order, not spacing
//   C client (the v523 Chromium mold, stubbed fetch):
//     cooked parse + boot clean · C1 Prayer II on open:
//     the block paints dialogue · Preface · Sanctus ·
//     heading · toggle · the prayer's lines, the heading
//     immediately above the toggle and the prayer's first
//     line under the toggle at the standing gaps (the
//     heading-to-prayer distance drops under 80 px) ·
//     the toggle offers Prayer I · II · III · IV with II
//     active · C2 a tap on Prayer IV repaints with the
//     heading + toggle at the block head and the epIV
//     segment whole under them; a tap back on Prayer II
//     restores the C1 order · C3 the rest of the scroll
//     stands as on the base — the same section sequence,
//     the same total height, and the content before and
//     after the block at the same offsets
//   G439 (recorded as-is, NEVER a v543 pass): the
//     standing v439 boot gate reads its standing 13 ok /
//     2 not-ok (B5 premise-superseded · B3 superseded by
//     v492's boot rule)
// Fixtures (Improvement D), from production: the
// MASS_CALENDAR entry for 2026-11-17 in the standing
// fixtures-v523 capture (extracted verbatim from the
// production mass-calendar.ts — two versions, default
// saint-elizabethofhungary) and the standing live day
// fixture tests/fixtures-v522/day-live-2026-11-17.json
// (drawn from production through the prayer door after
// the v521 ship). The Mass payload the harness serves is
// built from that entry in the standing server shape
// with the v523 harness's stub formulary (harness
// dressing only); every measured fact — the headings,
// their order, the segments, the toggle — is painted by
// the production code from the tree's real MASS_ORDER
// data (Eucharistic Prayer II's first line, "You are
// indeed Holy, O Lord,", is the stored segment's own).
// The base for byte comparisons and the premise page is
// the production ship tree, release/v539-ship @ 20198f9
// (Worker 0d4d2368, pin ora-pro-nobis-v539-1; H543_BASE
// overrides).
// Run: node app/tests/harness-v543.mjs [--probe] (from
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
const BASE = process.env.H543_BASE || path.resolve(ROOT, '../../.worktrees/v539-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
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
{
  for (const f of ['index.ts', 'mass.ts', 'mass-calendar.ts', 'mass-order.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S1-' + f + ': byte-identical to the v539-ship production base');
  }
  ok(I_SRC === I_BASE, 'S1b: index.ts matches the base read');
  const fnSpan = (src) => {
    const start = src.indexOf('function massEpHtml()');
    const end = src.indexOf('\n}\n', start) + 3;
    return { start, end };
  };
  const bSpan = fnSpan(C_BASE);
  const nSpan = fnSpan(C_SRC);
  const commentStart = C_SRC.lastIndexOf('/* v543:', nSpan.start);
  ok(commentStart > 0 && commentStart < nSpan.start, 'S2: the v543 comment stands directly above massEpHtml in the build');
  const baseRest = C_BASE.slice(0, bSpan.start) + C_BASE.slice(bSpan.end);
  const buildRest = C_SRC.slice(0, commentStart) + C_SRC.slice(nSpan.end);
  ok(buildRest === baseRest, 'S3: client.ts outside massEpHtml and its v543 comment is byte-identical to the base');
  const buildFn = C_SRC.slice(commentStart, nSpan.end);
  ok(buildFn.includes("massPartHtml('sanctus', MASS_ORDER.sanctus, 'Sanctus')\n      + head\n      + massLinesHtml(MASS_ORDER['ep' + ep], MASS_ROLES['ep' + ep])"),
    'S4: for Prayers I-III the heading unit (head) is emitted after the Sanctus part and immediately before the prayer lines');
  ok(buildFn.includes('body = head + massLinesHtml(MASS_ORDER.epIV, MASS_ROLES.epIV)'),
    'S5: for Prayer IV the heading unit stands at the head of the indivisible epIV segment');
  const fnOnly = C_SRC.slice(nSpan.start, nSpan.end);
  ok((fnOnly.match(/Eucharistic Prayer/g) || []).length === 1 && fnOnly.includes("var head = '<div class=\"mass-h\">Eucharistic Prayer</div>'"),
    'S6: the heading text stands exactly once in the function, in the one head unit');
  ok(U_SRC === U_BASE, 'S7: ui.ts byte-identical to the base on the build tree (no CSS change; the pin moves only at Ship)');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1].startsWith('0040'), 'S8: no migration past 0040 stands', migs[migs.length - 1]);
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
const PAYLOAD = {
  ok: true, name: SHORT.name, season: 'Ordinary Time',
  defaultVersion: SHORT.defaultVersion,
  versions: SHORT.versions.map((v) => ({ key: v.key, label: v.label, rank: v.rank, formulary: formulary(v.key) })),
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town.</p>' },
] };

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
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(PAYLOAD)});
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
  '/build': buildPage(COOKED, APP_CSS),
  '/base': buildPage(COOKED_BASE, APP_CSS_BASE),
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
  await page.waitForSelector('#mass-ep .mass-eptoggle', { timeout: 15000 }).catch(() => console.log('note -', tag, 'ep toggle slow'));
  await sleep(300);
  return { ctx, page };
}

/* In-page geometry: the EP block's landmarks and the
   heading-to-prayer distance, plus every visible
   subheading's gap to the next element of its body. */
const measure = (page) => page.evaluate(() => {
  const scroll = document.querySelector('.mass-scroll');
  const ep = document.getElementById('mass-ep');
  const head = ep ? (Array.from(ep.querySelectorAll('.mass-h')).find((h) => h.textContent.trim() === 'Eucharistic Prayer') || null) : null;
  const tog = ep ? ep.querySelector('.mass-eptoggle') : null;
  const lines = ep ? Array.from(ep.querySelectorAll('.mass-line')) : [];
  const epIIFirst = lines.find((l) => l.textContent.trim() === 'You are indeed Holy, O Lord,');
  const firstLine = lines[0] || null;
  const R = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, height: Math.round(r.height * 10) / 10 }; };
  const heads = ep ? Array.from(ep.querySelectorAll('.mass-h')).map((h) => ({ text: h.textContent.trim(), top: R(h).top })) : [];
  const out = {
    scrollHeight: scroll.scrollHeight,
    sections: Array.from(scroll.querySelectorAll('.mass-section')).map((s) => s.textContent.trim()),
    head: head ? R(head) : null,
    tog: tog ? R(tog) : null,
    togButtons: tog ? Array.from(tog.querySelectorAll('button')).map((b) => b.textContent.trim() + (b.classList.contains('active') ? '*' : '')) : [],
    epHeads: heads,
    firstLine: firstLine ? { text: firstLine.textContent.trim().slice(0, 40), top: R(firstLine).top } : null,
    epIIFirst: epIIFirst ? { top: R(epIIFirst).top } : null,
  };
  out.headToToggle = (out.head && out.tog) ? Math.round((out.tog.top - out.head.bottom) * 10) / 10 : null;
  out.headToEpII = (out.head && out.epIIFirst) ? Math.round((out.epIIFirst.top - out.head.bottom) * 10) / 10 : null;
  // landmarks in document order inside #mass-ep
  out.order = [];
  if (ep) {
    const walk = Array.from(ep.querySelectorAll('.mass-h, .mass-eptoggle, .mass-line'));
    let lineSeen = false, epSeen = false;
    for (const el of walk) {
      if (el.classList.contains('mass-h')) out.order.push('H:' + el.textContent.trim());
      else if (el.classList.contains('mass-eptoggle')) out.order.push('TOGGLE');
      else if (!epSeen && el.textContent.trim() === 'You are indeed Holy, O Lord,') { out.order.push('EPII-FIRST'); epSeen = true; }
      else if (!lineSeen) { out.order.push('LINE:' + el.textContent.trim().slice(0, 24)); lineSeen = true; }
    }
  }
  // absolute tops of the neighbours (scroll-relative)
  const sTop = scroll.getBoundingClientRect().top;
  const find = (sel, text) => {
    const el = Array.from(scroll.querySelectorAll(sel)).find((e) => e.textContent.trim().indexOf(text) === 0);
    return el ? Math.round((el.getBoundingClientRect().top - sTop) * 10) / 10 : null;
  };
  out.tops = {
    liturgyEucharist: find('.mass-section', 'Liturgy of the Eucharist'),
    prayerOverOfferings: find('.mass-h', 'Prayer over the Offerings'),
    communionRite: find('.mass-section', 'Communion Rite'),
    lordsPrayer: find('.mass-h', 'The Lord'),
  };
  // every visible subheading's gap to the next element
  const all = Array.from(scroll.querySelectorAll('*'));
  out.subGaps = [];
  for (const h of scroll.querySelectorAll('.mass-h')) {
    const r = h.getBoundingClientRect();
    if (r.height === 0) continue;
    let nextTop = null;
    let seen = false;
    for (const o of all) {
      if (o === h) { seen = true; continue; }
      if (!seen || h.contains(o)) continue;
      const or2 = o.getBoundingClientRect();
      if (or2.height === 0 && or2.width === 0) continue;
      if (or2.top >= r.bottom - 0.5) { if (nextTop === null || or2.top < nextTop) nextTop = or2.top; }
    }
    out.subGaps.push({ text: h.textContent.trim().slice(0, 34), gap: nextTop === null ? null : Math.round((nextTop - r.bottom) * 10) / 10 });
  }
  return out;
});

/* ---------------- P: premise on the base ---------------- */
let baseM = null;
{
  const errs = [];
  const { ctx, page } = await boot('/base', errs, 'base');
  baseM = await measure(page);
  console.log('note - base measured: headToToggle ' + baseM.headToToggle + ' px · headToEpII ' + baseM.headToEpII + ' px');
  ok(!!baseM.head && !!baseM.tog, 'P1: the base paints the Eucharistic Prayer heading and its toggle');
  if (baseM.head) {
    ok(baseM.headToToggle === 6, 'P2: PREMISE — on the base the heading stands glued to its toggle (6 px) at the block head', 'headToToggle ' + baseM.headToToggle);
    ok(baseM.headToEpII !== null && baseM.headToEpII > 600,
      'P3: PREMISE — on the base the first line of the prayer the heading names stands over 600 px below it (the heading stands too high)',
      'headToEpII ' + baseM.headToEpII);
    const others = baseM.subGaps.filter((g) => g.text !== 'Eucharistic Prayer');
    ok(others.length >= 8 && others.every((g) => g.gap !== null && g.gap < 60),
      'P4: PREMISE — every other visible subheading stands under 60 px above the next element of its body (the EP heading is the only one separated from its body)',
      JSON.stringify(others.filter((g) => g.gap === null || g.gap >= 60)));
    const oi = baseM.order.indexOf('H:Eucharistic Prayer');
    ok(oi === 0 && baseM.order[1] === 'TOGGLE',
      'P5: PREMISE — on the base the heading + toggle stand FIRST inside the prayer block, before the dialogue, Preface, and Sanctus',
      JSON.stringify(baseM.order.slice(0, 5)));
  }
  ok(errs.length === 0, 'P6: the base boot carries no page errors', errs.join(' · '));
  await ctx.close();
}

/* ---------------- C: the build ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/build', errs, 'build');
  ok(errs.length === 0, 'C0: boot clean — no page errors on the build page', errs.join(' · '));
  const m = await measure(page);
  console.log('note - build measured: headToToggle ' + m.headToToggle + ' px · headToEpII ' + m.headToEpII + ' px');
  ok(!!m.head && !!m.tog, 'C1a: the build paints the Eucharistic Prayer heading and its toggle');
  if (m.head) {
    const oi = m.order.indexOf('H:Eucharistic Prayer');
    ok(m.order[0] && m.order[0].indexOf('LINE:The Lord be with you') === 0 && m.firstLine && m.firstLine.text.indexOf('The Lord be with you') === 0,
      'C1b: the block opens with the Preface Dialogue (its first line stands first)', JSON.stringify(m.order.slice(0, 3)));
    ok(m.order.indexOf('H:Preface') > -1 && m.order.indexOf('H:Sanctus') > m.order.indexOf('H:Preface') && oi > m.order.indexOf('H:Sanctus'),
      'C1c: the order inside the block reads Preface · Sanctus · Eucharistic Prayer heading', JSON.stringify(m.order));
    ok(m.order[oi + 1] === 'TOGGLE' && m.order[oi + 2] === 'EPII-FIRST',
      'C1d: the toggle stands directly under the heading and the prayer\'s first line directly under the toggle', JSON.stringify(m.order.slice(oi, oi + 3)));
    ok(m.headToToggle === 6, 'C1e: the heading stands immediately above its toggle at the standing 6 px gap', 'headToToggle ' + m.headToToggle);
    ok(m.headToEpII !== null && m.headToEpII < 80,
      'C1f: the heading now stands at the prayer\'s natural head — the first line of Eucharistic Prayer II stands under 80 px below it (base: over 600)',
      'headToEpII ' + m.headToEpII);
    ok(JSON.stringify(m.togButtons) === JSON.stringify(['Prayer I', 'Prayer II*', 'Prayer III', 'Prayer IV']),
      'C1g: the toggle offers Prayer I · II · III · IV with II active on open (options and default unchanged)', m.togButtons.join(' · '));
  }
  /* C2: Prayer IV and back */
  await page.click('.mass-eptoggle button[data-ep="IV"]');
  await sleep(400);
  const m4 = await measure(page);
  ok(!!m4.head && m4.order[0] === 'H:Eucharistic Prayer' && m4.order[1] === 'TOGGLE',
    'C2a: on Prayer IV the heading + toggle stand at the block head (the epIV segment is indivisible)', JSON.stringify(m4.order.slice(0, 3)));
  ok(!!m4.firstLine && m4.togButtons[3] === 'Prayer IV*',
    'C2b: Prayer IV stands active and its segment paints whole under the heading unit', JSON.stringify(m4.togButtons));
  await page.click('.mass-eptoggle button[data-ep="II"]');
  await sleep(400);
  const m2 = await measure(page);
  const oi2 = m2.order.indexOf('H:Eucharistic Prayer');
  ok(m2.order[oi2 + 1] === 'TOGGLE' && m2.order[oi2 + 2] === 'EPII-FIRST' && m2.headToEpII !== null && m2.headToEpII < 80,
    'C2c: a tap back on Prayer II restores the heading at the prayer\'s head', 'headToEpII ' + m2.headToEpII);
  /* C3: the rest of the scroll */
  if (baseM) {
    ok(JSON.stringify(m.sections) === JSON.stringify(baseM.sections),
      'C3a: the section sequence stands as on the base', m.sections.join(' · '));
    ok(Math.abs(m.scrollHeight - baseM.scrollHeight) <= 2,
      'C3b: the scroll\'s total height matches the base (the same content, reordered inside one block only)',
      'build ' + m.scrollHeight + ' vs base ' + baseM.scrollHeight);
    ok(m.tops.prayerOverOfferings === baseM.tops.prayerOverOfferings && m.tops.liturgyEucharist === baseM.tops.liturgyEucharist,
      'C3c: the content before the block (the Liturgy of the Eucharist divider, the Prayer over the Offerings) stands at the same offsets as the base',
      JSON.stringify(m.tops) + ' vs ' + JSON.stringify(baseM.tops));
    ok(m.tops.communionRite === baseM.tops.communionRite && m.tops.lordsPrayer === baseM.tops.lordsPrayer,
      'C3d: the content after the block (the Communion Rite divider, The Lord\'s Prayer) stands at the same offsets as the base',
      JSON.stringify(m.tops) + ' vs ' + JSON.stringify(baseM.tops));
  }
  ok(errs.length === 0, 'C4: the build page carries no page errors after the toggle taps', errs.join(' · '));
  await ctx.close();
}

/* ---------------- G439: the standing gate, as-is ---------------- */
{
  let out = '';
  try {
    out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const mm = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!mm && +mm[1] === 13 && +mm[2] === 2,
    'G439 (recorded as-is, not a v543 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    mm ? mm[0] : 'no summary line in the gate output');
}

await browser.close();
server.close();
console.log('\nharness-v543: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
