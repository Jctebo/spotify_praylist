// harness-v507.mjs — v507 evidence: bottom-nav icons
// that render universally (the v504 fix-forward).
// FIELD FAILURE: on John's phone the v504 Catechesis
// icon (the font glyph U+1F56E BOOK, Noto Sans Symbols
// 2) paints the empty missing-glyph rectangle — his
// WebView does not carry that font. v504's ink test
// proved the glyph paints in the harness Chromium,
// which DOES carry the font: it proved the glyph,
// never the phone. That proof gap is the defect's
// cause, and this harness closes it by environment,
// not by assertion.
// THE FIX: both v504 glyphs become DRAWN inline SVG
// icons (Catechesis keeps the open book; Sacred Art
// keeps its design, a cross inside a bold ring), in
// currentColor at the standing 19px slot. SVG paints
// with zero font dependence.
//   S statics: ui.ts differs from the base ship only
//     at the two tabicon lines and the one added CSS
//     sizing rule (pin line excepted); the standing
//     glyphs, labels, order, ids byte-identical; every
//     other worker source byte-identical to the base
//   FP font-poor render (THE leg): a Chromium whose
//     fontconfig REJECTS Noto Sans Symbols and Noto
//     Sans Symbols 2 — the phone's situation. In it:
//     FP1 the two v504 codepoints are pure tofu (ink
//     equal to the missing-glyph control: this
//     environment would have caught v504); FP2 the
//     standing glyphs still paint; FP3 the two drawn
//     icons stand as SVG nodes at the slot and paint
//     real ink (element-screenshot pixel evidence);
//     FP4 five tabs visible, boot clean, tabbar
//     screenshot saved for inspection
//   R normal render: the standing-fonts boot paints
//     five tabs in order — three standing glyphs
//     unchanged, the two SVG icons at their slots —
//     tabbar screenshot saved for inspection
//   P cooked parse + Chromium boot clean (v439 gate)
// Fixtures (Improvement D): the day payload is the
// harness-v494 production-shaped set carried by the
// standing harnesses (a real /api/player/day shape);
// the book stub answers an empty library because the
// tabbar paint never reads it. The BASE tree defaults
// to the v504 ship; the ship run points V507_BASE_WT
// at the v506 ship. Run: node app/tests/harness-v507.mjs
// [--probe] (from the worktree root). --probe only
// prints. Screenshots land in /tmp/v507-tabbar-*.png.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const BASE_WT = process.env.V507_BASE_WT || 'v504-ship';
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
const CSS_RULE = '.tab .tabicon svg { width:19px; height:19px; display:block; }';

/* ---------------- S: statics ---------------- */
{
  const a = pin(U_SRC).split('\n'), b = pin(U_BASE).split('\n');
  ok(a.filter((l) => l === CSS_RULE).length === 1,
    'S1: the one added CSS rule stands exactly once (.tab .tabicon svg sizing)');
  const stripped = a.filter((l) => l !== CSS_RULE);
  ok(stripped.length === b.length, 'S2: ui.ts line count equals the base ship once the added rule is set aside',
    stripped.length + ' vs ' + b.length);
  const diff = [];
  for (let i = 0; i < b.length; i++) if (stripped[i] !== b[i]) diff.push(i);
  const dLines = diff.map((i) => ({ old: b[i], neu: stripped[i] }));
  ok(diff.length === 2
    && dLines.some((d) => d.old.includes('data-tab="podcasts"') && d.old.includes('&#128366;') && d.neu.includes('<svg') && d.neu.includes('aria-hidden="true"') && !d.neu.includes('&#128366;'))
    && dLines.some((d) => d.old.includes('data-tab="wallpaper"') && d.old.includes('&#128320;') && d.neu.includes('<svg') && d.neu.includes('<circle') && !d.neu.includes('&#128320;')),
    'S3: exactly two lines differ from the base ship — the podcasts tabicon (the U+1F56E entity becomes the drawn open-book SVG) and the wallpaper tabicon (the U+1F540 entity becomes the drawn circled-cross SVG)',
    JSON.stringify(diff));
  const tabLine = (src, id) => (src.split('\n').find((l) => l.includes('data-tab="' + id + '"')) || '');
  const iconOf = (line) => { const m = line.match(/<span class="tabicon">([\s\S]*?)<\/span><span>/); return m ? m[1] : null; };
  const ids = ['mass', 'prayers', 'conscience', 'podcasts', 'wallpaper'];
  const labels = ['Mass', 'Pray', 'Conscience', 'Catechesis', 'Sacred Art'];
  ok(ids.every((id, i) => tabLine(U_SRC, id).includes('<span>' + labels[i] + '</span>')),
    'S4: the five tabs stand in order with their standing labels');
  ok(['mass', 'prayers', 'conscience'].every((id) => iconOf(tabLine(U_SRC, id)) === iconOf(tabLine(U_BASE, id)))
    && iconOf(tabLine(U_BASE, 'mass')) === '&#10016;' && iconOf(tabLine(U_BASE, 'prayers')) === '&#10022;'
    && iconOf(tabLine(U_BASE, 'conscience')) === '&#10013;',
    'S5: the three standing tabicons are byte-identical to the base ship (Mass U+2720 · Pray U+2726 · Conscience U+271D)');
  ok(!U_SRC.includes('&#128366;') && !U_SRC.includes('&#128320;'),
    'S6: neither v504 extended-font entity survives anywhere in ui.ts');
  for (const f of ['client.ts', 'index.ts', 'logo.ts', 'logo512.ts', 'mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S7-' + f + ': byte-identical to the base ship');
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
  if ((req.url || '/').split('?')[0] === '/v507') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const EXE = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

const FONTPOOR_CONF = path.join(os.tmpdir(), 'harness-v507-fontpoor.conf');
writeFileSync(FONTPOOR_CONF, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <rejectfont><pattern><patelt name="family"><string>Noto Sans Symbols2</string></patelt></pattern></rejectfont>
  <rejectfont><pattern><patelt name="family"><string>Noto Sans Symbols</string></patelt></pattern></rejectfont>
</fontconfig>
`);

async function boot(browser, tag) {
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
  });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + '/v507');
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note -', tag, 'openblock slow'));
  await sleep(600);
  return { ctx, page, errs };
}
const barInfo = (page) => page.evaluate(() => {
  const tabs = Array.from(document.querySelectorAll('#tabbar .tab'));
  const icon = (t) => t.querySelector('.tabicon');
  const svgRect = (t) => { const s = icon(t).querySelector('svg'); if (!s) return null; const r = s.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    count: tabs.length,
    ids: tabs.map((t) => t.getAttribute('data-tab')),
    labels: tabs.map((t) => (t.querySelector('.tabpill span:last-child') || {}).textContent || null),
    glyphs: tabs.slice(0, 3).map((t) => icon(t).textContent),
    svgCount: tabs.map((t) => icon(t).querySelectorAll('svg').length),
    rects: tabs.map(svgRect),
    visible: tabs.map((t) => { const r = t.getBoundingClientRect(); return r.width > 0 && r.height > 0; }),
  };
});

/* ---------------- R: normal-fonts render ---------------- */
{
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const { ctx, page, errs } = await boot(browser, 'normal');
  const bar = await barInfo(page);
  ok(bar.count === 5 && JSON.stringify(bar.ids) === JSON.stringify(['mass', 'prayers', 'conscience', 'podcasts', 'wallpaper'])
    && JSON.stringify(bar.labels) === JSON.stringify(['Mass', 'Pray', 'Conscience', 'Catechesis', 'Sacred Art'])
    && bar.visible.every(Boolean),
    'R1: the tabbar paints five visible tabs in standing order with standing labels', JSON.stringify(bar));
  ok(JSON.stringify(bar.glyphs) === JSON.stringify(['\u2720', '\u2726', '\u271D'])
    && JSON.stringify(bar.svgCount) === JSON.stringify([0, 0, 0, 1, 1]),
    'R2: the three standing tabicons carry their glyphs unchanged; Catechesis and Sacred Art each hold exactly one inline SVG and no text glyph',
    JSON.stringify(bar));
  ok(bar.rects[3] && bar.rects[4] && Math.abs(bar.rects[3].w - 19) <= 2 && Math.abs(bar.rects[3].h - 19) <= 2
    && Math.abs(bar.rects[4].w - 19) <= 2 && Math.abs(bar.rects[4].h - 19) <= 2,
    'R3: both drawn icons stand at the standing 19px slot', JSON.stringify(bar.rects));
  const barEl = await page.$('#tabbar');
  await barEl.screenshot({ path: '/tmp/v507-tabbar-normal.png' });
  ok(errs.length === 0, 'L1: Chromium boot clean, normal fonts (no page errors)', errs.join(' ; '));
  await ctx.close();
  await browser.close();
}

/* ---------------- FP: the font-poor render (the leg) ---------------- */
{
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'], env: { ...process.env, FONTCONFIG_FILE: FONTPOOR_CONF } });
  const { ctx, page, errs } = await boot(browser, 'fontpoor');
  const ink = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 100; cv.height = 100;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const fam = getComputedStyle(document.querySelector('#tabbar .tab')).fontFamily;
    const draw = (ch) => {
      cx.clearRect(0, 0, 100, 100);
      cx.font = '60px ' + fam;
      cx.fillStyle = '#000'; cx.textBaseline = 'middle'; cx.textAlign = 'center';
      cx.fillText(ch, 50, 55);
      const d = cx.getImageData(0, 0, 100, 100).data;
      let n = 0; const px = [];
      for (let i = 3; i < d.length; i += 4) { const on = d[i] > 40 ? 1 : 0; px.push(on); if (on) n++; }
      return { n, px };
    };
    const diff = (x, y) => { let n = 0; for (let i = 0; i < x.px.length; i++) if (x.px[i] !== y.px[i]) n++; return n; };
    const book = draw('\u{1F56E}'), cross = draw('\u{1F540}'), tofu = draw('\uE000'), standing = draw('\u2720');
    return { bookInk: book.n, crossInk: cross.n, tofuInk: tofu.n, standingInk: standing.n,
             bookVsTofu: diff(book, tofu), crossVsTofu: diff(cross, tofu), standingVsTofu: diff(standing, tofu) };
  });
  ok(ink.bookVsTofu < 150 && ink.crossVsTofu < 150,
    'FP1: in this environment the v504 codepoints are pure tofu (U+1F56E differs from the missing-glyph control by ' + ink.bookVsTofu + ' px, U+1F540 by ' + ink.crossVsTofu + ' px) — this is the environment that would have caught v504',
    JSON.stringify(ink));
  ok(ink.standingVsTofu > 500,
    'FP2: the standing glyphs still paint in the font-poor environment (U+2720 differs from the control by ' + ink.standingVsTofu + ' px)',
    JSON.stringify(ink));

  const bar = await barInfo(page);
  ok(bar.count === 5 && bar.visible.every(Boolean) && JSON.stringify(bar.svgCount) === JSON.stringify([0, 0, 0, 1, 1])
    && bar.rects[3] && bar.rects[4] && Math.abs(bar.rects[3].w - 19) <= 2 && Math.abs(bar.rects[4].w - 19) <= 2,
    'FP3: font-poor, the tabbar still paints five visible tabs; both drawn icons stand as SVG nodes at the 19px slot',
    JSON.stringify(bar));

  const iconInk = async (tabId) => {
    const el = await page.$('#tabbar .tab[data-tab="' + tabId + '"] .tabicon svg');
    const buf = await el.screenshot();
    return page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      const bg = [d[0], d[1], d[2]];
      let n = 0; const px = [];
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
        const on = d[i + 3] > 40 && dist > 60 ? 1 : 0; px.push(on); if (on) n++;
      }
      return { n, px, w: cv.width, h: cv.height };
    }, buf.toString('base64'));
  };
  const bookInk = await iconInk('podcasts');
  const crossInk = await iconInk('wallpaper');
  let crossDiff = 0;
  { const n = Math.min(bookInk.px.length, crossInk.px.length); for (let i = 0; i < n; i++) if (bookInk.px[i] !== crossInk.px[i]) crossDiff++; }
  ok(bookInk.n > 300,
    'FP4: the drawn open book PAINTS in the font-poor environment (screenshot ink ' + bookInk.n + ' px in its ' + bookInk.w + 'x' + bookInk.h + ' slot — an unpainted or font-bound icon reads ~0)',
    JSON.stringify({ n: bookInk.n, w: bookInk.w, h: bookInk.h }));
  ok(crossInk.n > 300 && crossDiff > 200,
    'FP5: the drawn circled cross PAINTS in the font-poor environment (screenshot ink ' + crossInk.n + ' px; differs from the book icon by ' + crossDiff + ' px — two distinct drawn icons, not one repeated mark)',
    JSON.stringify({ n: crossInk.n, diff: crossDiff }));
  const barEl = await page.$('#tabbar');
  await barEl.screenshot({ path: '/tmp/v507-tabbar-fontpoor.png' });
  ok(errs.length === 0, 'L2: Chromium boot clean, font-poor (no page errors)', errs.join(' ; '));
  await ctx.close();
  await browser.close();
}

server.close();
if (!PROBE) {
  console.log('harness-v507:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
