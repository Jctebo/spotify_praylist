// harness-v504.mjs — v504 evidence: bottom-nav icon fit
// (John, Ora Pro Nobis thread, 2026-11-17 14:22 CT:
// "Also Catechesis and Sacred Art have icons that don't
// fit. Please update."). Two glyph swaps in the tabbar
// (app/worker/src/ui.ts SHELL_HTML), nothing else:
//   Catechesis  &#9835;  (U+266B beamed notes, the old
//     Formation glyph) -> &#128366; (U+1F56E BOOK, Noto
//     Sans Symbols 2 — a monochrome open book)
//   Sacred Art  &#9635;  (U+25A3 plain frame) ->
//     &#128320; (U+1F540 CIRCLED CROSS POMMEE, Noto Sans
//     Symbols 2 — a cross set inside a bold ring: the
//     sacred mark carried inside its frame)
//   S statics: ui.ts differs from the base ship only at
//     the two tabicon lines (pin line excepted); the
//     five tabs' ids, order, labels and the three
//     standing glyphs are byte-identical; every other
//     worker source is byte-identical to the base ship
//   R render: a Chromium boot paints the tabbar — five
//     tabs in order, the two new glyphs standing in
//     their tabicons, the three standing glyphs
//     unchanged; a canvas ink test proves each new
//     glyph really renders (its ink differs from a
//     missing-glyph private-use control — a tofu box
//     fails)
//   P cooked parse + Chromium boot clean (the v439 gate)
// Fixtures (Improvement D): the day payload is the
// harness-v494 production-shaped set carried by
// harness-v501 (a real /api/player/day shape); the book
// stub answers an empty library because the tabbar
// paint never reads it. The BASE tree defaults to the
// v502 ship; the ship run points V504_BASE_WT at the
// v503 ship. Run: node app/tests/harness-v504.mjs
// [--probe] (from the worktree root). --probe only
// prints.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const BASE_WT = process.env.V504_BASE_WT || 'v502-ship';
const BASE = path.resolve(process.cwd(), '../../.worktrees/' + BASE_WT + '/app/worker/src');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');

/* ---------------- S: statics ---------------- */
{
  const a = pin(U_SRC).split('\n'), b = pin(U_BASE).split('\n');
  ok(a.length === b.length, 'S1: ui.ts line count equals the base ship', a.length + ' vs ' + b.length);
  const diff = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  const dLines = diff.map((i) => ({ old: b[i], neu: a[i] }));
  ok(diff.length === 2
    && dLines.some((d) => d.old.includes('data-tab="podcasts"') && d.old.includes('&#9835;') && d.neu.includes('&#128366;') && !d.neu.includes('&#9835;'))
    && dLines.some((d) => d.old.includes('data-tab="wallpaper"') && d.old.includes('&#9635;') && d.neu.includes('&#128320;') && !d.neu.includes('&#9635;')),
    'S2: exactly two lines differ from the base ship — the podcasts tabicon (&#9835; -> &#128366;) and the wallpaper tabicon (&#9635; -> &#128320;)',
    JSON.stringify(diff));
  const tabs = [...U_SRC.matchAll(/<button data-tab="([a-z]+)" class="tab"><span class="tabpill"><span class="tabicon">([^<]+)<\/span><span>([^<]+)<\/span>/g)]
    .map((m) => ({ id: m[1], icon: m[2], label: m[3] }));
  ok(JSON.stringify(tabs.map((t) => t.id)) === JSON.stringify(['mass', 'prayers', 'conscience', 'podcasts', 'wallpaper'])
    && JSON.stringify(tabs.map((t) => t.label)) === JSON.stringify(['Mass', 'Pray', 'Conscience', 'Catechesis', 'Sacred Art'])
    && JSON.stringify(tabs.map((t) => t.icon)) === JSON.stringify(['&#10016;', '&#10022;', '&#10013;', '&#128366;', '&#128320;']),
    'S3: five tabs in standing order with standing labels; the three standing glyphs unchanged; the two new entities in place',
    JSON.stringify(tabs));
  for (const f of ['client.ts', 'index.ts', 'logo.ts', 'logo512.ts', 'mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S4-' + f + ': byte-identical to the base ship');
  }
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
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: null, after: null, afterMass: [] });
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, { ok: true, groups: [] });
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
  if ((req.url || '/').split('?')[0] === '/v504') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

/* ---------------- R: the tabbar render ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
  });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note - pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + '/v504');
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - openblock slow'));
  await sleep(600);

  const bar = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('#tabbar .tab'));
    return {
      count: tabs.length,
      ids: tabs.map((t) => t.getAttribute('data-tab')),
      labels: tabs.map((t) => (t.querySelector('.tabpill span:last-child') || {}).textContent || null),
      icons: tabs.map((t) => (t.querySelector('.tabicon') || {}).textContent || null),
      visible: tabs.map((t) => { const r = t.getBoundingClientRect(); return r.width > 0 && r.height > 0; }),
    };
  });
  ok(bar.count === 5 && JSON.stringify(bar.ids) === JSON.stringify(['mass', 'prayers', 'conscience', 'podcasts', 'wallpaper'])
    && JSON.stringify(bar.labels) === JSON.stringify(['Mass', 'Pray', 'Conscience', 'Catechesis', 'Sacred Art'])
    && bar.visible.every(Boolean),
    'R1: the tabbar paints five visible tabs in standing order with standing labels', JSON.stringify(bar));
  ok(JSON.stringify(bar.icons) === JSON.stringify(['\u2720', '\u2726', '\u271D', '\u{1F56E}', '\u{1F540}']),
    'R2: the tabicons carry the three standing glyphs unchanged and the two new glyphs (open book U+1F56E · circled cross pommee U+1F540)',
    JSON.stringify(bar.icons));

  const ink = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 100; cv.height = 100;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const draw = (ch) => {
      cx.clearRect(0, 0, 100, 100);
      cx.font = '60px ' + getComputedStyle(document.querySelector('#tabbar .tab')).fontFamily;
      cx.fillStyle = '#000'; cx.textBaseline = 'middle'; cx.textAlign = 'center';
      cx.fillText(ch, 50, 55);
      const d = cx.getImageData(0, 0, 100, 100).data;
      let n = 0; const px = [];
      for (let i = 3; i < d.length; i += 4) { const on = d[i] > 40 ? 1 : 0; px.push(on); if (on) n++; }
      return { n, px };
    };
    const book = draw('\u{1F56E}'), cross = draw('\u{1F540}'), tofu = draw('\uE000');
    const diff = (x, y) => { let n = 0; for (let i = 0; i < x.px.length; i++) if (x.px[i] !== y.px[i]) n++; return n; };
    return { bookInk: book.n, crossInk: cross.n, tofuInk: tofu.n, bookVsTofu: diff(book, tofu), crossVsTofu: diff(cross, tofu), bookVsCross: diff(book, cross) };
  });
  ok(ink.bookInk > 400 && ink.bookVsTofu > 500,
    'R3: the open book really renders (ink ' + ink.bookInk + ', differs from the missing-glyph control by ' + ink.bookVsTofu + ' px — a tofu box would match the control)',
    JSON.stringify(ink));
  ok(ink.crossInk > 400 && ink.crossVsTofu > 500 && ink.bookVsCross > 500,
    'R4: the circled cross really renders (ink ' + ink.crossInk + ', differs from the control by ' + ink.crossVsTofu + ' px and from the book by ' + ink.bookVsCross + ' px)',
    JSON.stringify(ink));
  ok(errs.length === 0, 'L1: Chromium boot clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v504:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
