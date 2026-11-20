// harness-v438 — Tab rename: Podcasts → Formation ·
// Wallpaper → Sacred Art (§1/§2 of the v438 release
// document; John's word 2026-11-15 01:39 CT: "Make this a
// release"). Client-only delta: ui.ts (the two bar label
// literals) + client.ts (25 string sites literal-for-
// literal + ONE new render-layer function blockDisplayName
// at exactly two seats). Legs L1–L5 per Plan §2.4, run in
// headless Chromium on the v388/v417 extraction mold (real
// SHELL_HTML + APP_CSS, fixture state). L6 (the regression
// watch: harness-v410/v413/v434/v437 base vs build) runs
// as shell comparisons beside this harness; its tallies
// stand in §3 of the release document.
//
// L3's CONSTRUCTION (Plan §2.4, stated plainly): the sweep
// reads PAINTED text — the textContent of the view after
// each L2 paint, plus every aria-label standing in it, plus
// the served shell's bar markup. It never reads source:
// identifiers and comments are excluded by construction.
// The allowlist is §1.4's stays list, enumerated by name in
// ALLOW below; each allowlisted phrase is struck from the
// painted text before the no-survivors assertion, and the
// sweep asserts each allowlisted stay is actually PRESENT
// where its surface paints (a stay that vanished would be
// movement, not a pass).
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const ROOT = path.resolve(HERE, '../..');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const BASE_U_SRC = execSync('git show release/v437-ship:app/worker/src/ui.ts', { cwd: ROOT, encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}
function shellOf(u) { return u.slice(u.indexOf('SHELL_HTML = `') + 14, u.indexOf('`;', u.indexOf('SHELL_HTML = `'))); }
function cssOf(u) { return u.slice(u.indexOf('APP_CSS = `') + 11, u.indexOf('`;', u.indexOf('APP_CSS = `'))); }
const APP_CSS = cssOf(U_SRC);
const SHELL = shellOf(U_SRC);
const BASE_SHELL = shellOf(BASE_U_SRC);
const BASE_CSS = cssOf(BASE_U_SRC);

/* ---------------- L1 — shell statics + source statics ---------------- */
{
  const tabs = [...SHELL.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]).join(',');
  ok(tabs === 'prayers,conscience,podcasts,wallpaper',
    'L1: the bar data-tab values are byte-unchanged (prayers,conscience,podcasts,wallpaper) — identifiers stay', tabs);
  ok(SHELL.includes('<span>Formation</span>') && SHELL.includes('<span>Sacred Art</span>')
    && SHELL.includes('<span>Prayers</span>') && SHELL.includes('<span>Conscience</span>'),
    'L1: the served shell bar reads Prayers · Conscience · Formation · Sacred Art');
  ok(!SHELL.includes('<span>Podcasts</span>') && !SHELL.includes('<span>Wallpaper</span>'),
    'L1: neither old label stands in the bar markup');
  const n = (s, sub) => s.split(sub).length - 1;
  ok(n(C_SRC, '<h1 class="screen">Formation</h1>') === 11 && n(C_SRC, '<h1 class="screen">Podcasts</h1>') === 0,
    'L1 (static): the Podcasts h1 set is 11 Formation / 0 Podcasts on this base (Plan §2.0 re-count, F-438-5 re-grep)');
  ok(n(C_SRC, 'Formation did not load.') === 2 && n(C_SRC, 'Podcasts did not load.') === 0,
    'L1 (static): the failure line stands at 2, renamed');
  ok(n(C_SRC, 'aria-label="Back to Formation"') === 2 && n(C_SRC, 'aria-label="Back to Podcasts"') === 0,
    'L1 (static): the back-disc aria-labels stand at 2, renamed (audio + video series pages)');
  ok(n(C_SRC, '<h1 class="screen">Sacred Art</h1>') === 1 && n(C_SRC, '<h2 class="sectionhead">SACRED ART</h2>') === 1
    && n(C_SRC, 'Sacred Art controls live in the Sacred Art tab.') === 1
    && n(C_SRC, 'Sacred Art controls live in the app on your phone.') === 1
    && n(C_SRC, 'Sacred Art is off') === 1 && n(C_SRC, '<div class="setname">Sacred Art</div>') === 3,
    'L1 (static): the 8 Sacred Art string seats stand in client.ts (head · pointer name · pointer line both occurrences · tab h1 · skeleton row · unavailable row · note · off-state)');
  ok(C_SRC.includes("block: 'Podcasts'"),
    'L1 (static): the descriptor block VALUE \'Podcasts\' stands — played state keys on it (§1.4)');
  ok(n(C_SRC, 'function blockDisplayName(block)') === 1 && n(C_SRC, 'blockDisplayName(') === 3
    && C_SRC.includes("esc(blockDisplayName(desc.block))") && C_SRC.includes("blockDisplayName(cur.block)"),
    'L1 (static): blockDisplayName stands once, applied at exactly the two seats (queue meta · Now Playing meta)');
  ok(C_SRC.includes("'Podcasts': 'Formation'") && !/BLOCK_DISPLAY_NAMES = \{[^}]*'(Morning|Midmorning|Midday|Afternoon|Evening|Night|Mass and Homilies|Novenas|The AI Signal)'/.test(C_SRC),
    'L1 (static, F-438-I2): the display map carries exactly one entry — no day block enters it');
  ok(C_SRC.includes('Full page on YouTube') && U_SRC.includes('ora-pro-nobis-v437-1') && !I_SRC.includes('Formation') && !I_SRC.includes('Sacred Art'),
    'L1 (static): v436\'s "Full page on YouTube" act stands untouched; the SW pin stands at ora-pro-nobis-v437-1 (Ship moves it); index.ts carries no new name (client-only)');
}

/* ---------------- client extraction (v388/v417 mold) ---------------- */
function scanDecls(src) {
  const out = []; const lines = src.split('\n'); let li = 0;
  while (li < lines.length) {
    const line = lines[li];
    let m = line.match(/^function ([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { out.push({ kind: 'fn', name: m[1], startLine: li }); li++; continue; }
    m = line.match(/^var ([A-Za-z_$][\w$]*)\s*=/);
    if (m) { out.push({ kind: 'var', name: m[1], startLine: li }); li++; continue; }
    li++;
  }
  return { out, lines };
}
function countBraces(s) { let n = 0; for (const ch of s) { if (ch === '{') n++; else if (ch === '}') n--; } return n; }
function unit(lines, startLine, kind) {
  if (kind === 'var') {
    let depth = 0, started = false; const buf = [];
    for (let i = startLine; i < lines.length; i++) {
      buf.push(lines[i]);
      for (const ch of lines[i]) { if (ch === '{' || ch === '[' || ch === '(') { depth++; started = true; } else if (ch === '}' || ch === ']' || ch === ')') depth--; }
      if (started && depth <= 0 && /;\s*$/.test(lines[i])) break;
      if (!started && /;\s*$/.test(lines[i])) break;
    }
    return buf.join('\n');
  }
  let depth = 0, opened = false; const buf = [];
  for (let i = startLine; i < lines.length; i++) {
    buf.push(lines[i]); depth += countBraces(lines[i]); if (lines[i].includes('{')) opened = true;
    if (opened && depth <= 0) break;
  }
  return buf.join('\n');
}
const EXCLUDE = new Set(['refreshPlayedChrome', 'extFetchText']);
const { out: decls, lines } = scanDecls(C_SRC);
const pieces = [], dropped = [];
for (const d of decls) {
  if (d.name === 'state') continue;
  if (EXCLUDE.has(d.name)) continue;
  const u = unit(lines, d.startLine, d.kind);
  try { if (d.kind === 'fn') new Function('return (' + u + ')'); else new Function(u); pieces.push(u); }
  catch (e) { dropped.push(d.name); }
}
console.log('note - extraction dropped:', dropped.join(', ') || 'none');

function pageHtml(css, shell) {
  const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
SHELLHERE
<script>
window.__fetchMode = 'hang';
window.fetch = function (path, opts) {
  if (window.__fetchMode === 'fail') return Promise.reject(new Error('offline'));
  if (window.__fetchMode === 'hang') return new Promise(function () {});
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
function refreshPlayedChrome() {}
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
</` + `script>
<script>
var state = { tab: 'prayers', examMode: 'quick', examCat: null, deepIdx: 0, block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
  storedDay: '2026-11-15', presentedDay: '2026-11-15', dateLabel: 'Sunday, November 15', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: {},
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
  ownStanding: [], extStanding: [], extSlots: {}, ownSlots: {}, daySegments: {}, homeFilter: '', gridDl: {}, aiClaimed: false };
</` + `script>`;
  return head.replace('CSSHERE', () => css).replace('SHELLHERE', () => shell)
    + '<script>\n' + pieces.join('\n') + '\n</' + 'script></body></html>';
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
let currentHtml = '';
const server = http.createServer((req, res) => {
  const p = (req.url || '/').split('?')[0];
  if (p === '/logo.png') { res.setHeader('Content-Type', 'image/png'); res.end(PNG); return; }
  if (p === '/') { res.setHeader('Content-Type', 'text/html'); res.end(currentHtml); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function openPage(width) {
  currentHtml = pageHtml(APP_CSS, SHELL);
  const pg = await browser.newPage({ viewport: { width: width || 412, height: 915 } });
  pg.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
  await pg.goto(ORIGIN + '/');
  return pg;
}
// Painted-text collector for L2/L3: view text + aria-labels.
const painted = (pg) => pg.evaluate(() => {
  const v = document.getElementById('view');
  const labels = [...v.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
  const h1s = [...v.querySelectorAll('h1.screen')].map((e) => e.textContent);
  return { text: v.textContent || '', labels, h1s, html: v.innerHTML };
});

/* ---- L3 allowlist: §1.4's stays, enumerated by name ---- */
const ALLOW = [
  'Own podcast',                              // the Settings source-family label
  'which podcast plays in which block',       // the Settings source-mapping explanation
  'Live wallpaper', 'live wallpaper',         // the phone's feature language
  'Phone folder', 'Watch folder',             // the folder language
  'CatholicTV', 'Catechism in a Year', 'Bible in a Year', 'The Rosary in a Year' // providers' own names
];
function survivors(p) {
  let t = (p.text + '\n' + p.labels.join('\n')).replace(/podcasts \d+\/\d+/g, ''); // the offline count noun + its counts
  for (const a of ALLOW) t = t.split(a).join('');
  const hits = [];
  for (const w of ['Podcasts', 'Wallpaper', 'wallpaper', 'podcasts']) if (t.includes(w)) hits.push(w);
  return hits;
}

/* ================= L2 + L3 + L5 — the paints page ================= */
const page = await openPage(412);
const surfaces = {};
{
  const boot = await page.evaluate(() => typeof renderPodcasts === 'function' && typeof paintPodcasts === 'function'
    && typeof paintPodcastVideos === 'function' && typeof paintPodWatch === 'function'
    && typeof renderWallpaper === 'function' && typeof paintSettings === 'function'
    && typeof blockDisplayName === 'function' && typeof openNowPlaying === 'function');
  ok(boot, 'boot: the extracted client stands (all v438 paint seats + blockDisplayName present)');

  /* ---- Formation index: skeleton ---- */
  await page.evaluate(() => { state.tab = 'podcasts'; state.podcastsReturn = null; window.__fetchMode = 'hang'; renderPodcasts(); });
  surfaces.indexSkel = await painted(page);
  ok(surfaces.indexSkel.h1s[0] === 'Formation', 'L2: the Formation index skeleton head reads Formation', JSON.stringify(surfaces.indexSkel.h1s));

  /* ---- Formation index: error paint ---- */
  await page.evaluate(() => { window.__fetchMode = 'fail'; renderPodcasts(); });
  await sleep(150);
  surfaces.indexErr = await painted(page);
  ok(surfaces.indexErr.text.includes('Formation did not load.') && surfaces.indexErr.h1s[0] === 'Formation',
    'L2: the index error paint reads "Formation did not load." under a Formation head');

  /* ---- Formation index: loaded ---- */
  await page.evaluate(() => {
    window.__fetchMode = 'ok';
    state.podcastsIndex = { seriesList: [
      { series: 'catechism-in-a-year', title: 'Catechism in a Year', available: true, listenedCount: 3, total: 10, currentLabel: 'Day 4', showImageUrl: null },
      { series: 'catholictv', kind: 'video', title: 'CatholicTV', available: true, latestLabel: 'Nov 14, 2026', showImageUrl: null }
    ] };
    paintPodcastsIndex();
  });
  surfaces.index = await painted(page);
  ok(surfaces.index.h1s[0] === 'Formation' && surfaces.index.text.includes('Catechism in a Year') && surfaces.index.text.includes('CatholicTV'),
    'L2: the loaded index head reads Formation; the providers\' own series names stand');
  ok(/podcasts \d+\/\d+/.test(surfaces.index.text),
    'L3 (stay present): the offline line\'s "podcasts" count noun stands on the index card — the ruled exception (§1.4/F-438-2)');

  /* ---- audio series: skeleton + loaded ---- */
  await page.evaluate(() => { state.podcasts = null; paintPodcasts(); });
  surfaces.seriesSkel = await painted(page);
  ok(surfaces.seriesSkel.h1s[0] === 'Formation', 'L2: the audio series skeleton head reads Formation');
  await page.evaluate(() => {
    state.podcasts = { series: 'catechism-in-a-year', kind: 'audio', title: 'Catechism in a Year', available: true,
      entries: [{ key: 'e1', label: 'Day 1', title: 'In the Beginning', url: 'https://example.com/a.mp3', durationS: 600, listened: false, positionS: 0, imageUrl: null, descText: null }],
      currentKey: 'e1', listenedCount: 0, total: 1, showImageUrl: null, showDesc: null };
    paintPodcasts();
  });
  surfaces.series = await painted(page);
  ok(surfaces.series.h1s[0] === 'Formation' && surfaces.series.labels.includes('Back to Formation'),
    'L2: the audio series page head reads Formation; its back disc aria-label reads "Back to Formation"', JSON.stringify(surfaces.series.labels));

  /* ---- video series: skeleton + loaded ---- */
  await page.evaluate(() => { state.podcasts = { kind: 'audio' }; paintPodcastVideos(); });
  surfaces.videoSkel = await painted(page);
  ok(surfaces.videoSkel.h1s[0] === 'Formation', 'L2: the video series skeleton head reads Formation');
  await page.evaluate(() => {
    state.podcasts = { kind: 'video', series: 'catholictv', title: 'CatholicTV', available: true,
      videos: [{ id: 'v1', title: 'La Santa Misa', dateLabel: 'Nov 14, 2026', imageUrl: null }] };
    paintPodcastVideos();
  });
  surfaces.video = await painted(page);
  ok(surfaces.video.h1s[0] === 'Formation' && surfaces.video.labels.includes('Back to Formation')
    && surfaces.video.text.includes('Full page on YouTube'),
    'L2: the video series page head reads Formation; its back disc reads "Back to Formation"; v436\'s "Full page on YouTube" act stands untouched');

  /* ---- watch view ---- */
  await page.evaluate(() => { podWatch = { video: { id: 'v1', title: 'La Santa Misa', videoId: 'abc', dateLabel: 'Nov 14, 2026' }, scroll: 0 }; paintPodWatch(); });
  surfaces.watch = await painted(page);
  ok(surfaces.watch.h1s[0] === 'Formation' && surfaces.watch.labels.includes('Back to CatholicTV'),
    'L2: the watch view head reads Formation; its back act names the provider (CatholicTV — a stay)', JSON.stringify(surfaces.watch.labels));

  /* ---- Sacred Art: skeleton + web/unavailable paint ---- */
  await page.evaluate(() => { renderWallpaper(); });
  await sleep(100);
  surfaces.artSkel = await painted(page);
  ok(surfaces.artSkel.h1s[0] === 'Sacred Art' && surfaces.artSkel.text.includes('Sacred Art'),
    'L2: the Sacred Art tab head reads Sacred Art (skeleton paint)');
  ok(surfaces.artSkel.text.includes('Sacred Art controls live in the app on your phone.'),
    'L2: the web/unavailable paint\'s note reads "Sacred Art controls live in the app on your phone."');

  /* ---- Sacred Art: off state ---- */
  await page.evaluate(() => {
    const v = document.getElementById('view');
    v.innerHTML = '<div id="wp-off-host"></div>';
    paintWallpaperOff(document.getElementById('wp-off-host'));
  });
  surfaces.artOff = await painted(page);
  ok(surfaces.artOff.text.includes('Sacred Art is off') && surfaces.artOff.text.includes('The Ora Pro Nobis live wallpaper puts today'),
    'L2: the off-state heading reads "Sacred Art is off"; the body sentence under it keeps the feature language (a stay)', surfaces.artOff.text.slice(0, 160));

  /* ---- Settings ---- */
  await page.evaluate(() => {
    settingsRows = [{ sourceKey: 'own-feed', family: 'own', name: 'Ora Pro Nobis podcast', enabled: true, block: 'Morning', role: 'primary' }];
    paintSettings();
  });
  surfaces.settings = await painted(page);
  ok(surfaces.settings.text.includes('SACRED ART') && surfaces.settings.text.includes('Sacred Art controls live in the Sacred Art tab.'),
    'L2 (F-438-I4): the Settings pointer section heads SACRED ART and its line reads in full "Sacred Art controls live in the Sacred Art tab." — both occurrences moved');
  ok(surfaces.settings.text.includes('Own podcast') && surfaces.settings.text.includes('which podcast plays in which block'),
    'L3 (stays present): Settings keeps "Own podcast" and "which podcast plays in which block" word-for-word');

  /* ---- L3: the no-survivors sweep over every painted surface ---- */
  for (const [name, p] of Object.entries(surfaces)) {
    const hits = survivors(p);
    ok(hits.length === 0, 'L3: no survivors on the ' + name + ' surface (allowlist struck)', hits.join(','));
  }
  const barText = await page.evaluate(() => document.getElementById('tabbar').textContent);
  ok(!/Podcasts|Wallpaper/.test(barText) && barText.includes('Formation') && barText.includes('Sacred Art'),
    'L3: no survivors in the served bar; the new labels stand');

  /* ---- L5: the block-display seats ---- */
  const l5 = await page.evaluate(() => {
    const out = {};
    out.map = [blockDisplayName('Podcasts'), blockDisplayName('Morning'), blockDisplayName(''), blockDisplayName(undefined)];
    const e = { key: 'e1', label: 'Day 1', title: 'In the Beginning', url: 'https://example.com/a.mp3', durationS: 600, listened: false, positionS: 0, imageUrl: null, descText: null };
    state.podcasts = { series: 'catechism-in-a-year', showImageUrl: null };
    const desc = podDesc(e);
    out.descBlock = desc.block;
    state.current = desc; state.queue = [desc]; state.queueIdx = 0;
    openNowPlaying();
    const sheet = document.querySelector('.np-sheet');
    out.npMeta = sheet ? sheet.querySelector('#np-meta').textContent : null;
    const qrow = sheet ? sheet.querySelector('#np-queue .npq-row, #np-queue .card, #np-queue > div') : null;
    out.queueText = sheet ? sheet.querySelector('#np-queue').textContent : null;
    // The block keys a mark only for a REPEATED id (playedKey,
    // v360 §2.2) — stand the descriptor as a repeat, the case
    // where the block term is load-bearing, and prove the key
    // is the raw value.
    state.dayDescs = [desc, Object.assign({}, desc, { title: 'Repeat occurrence' })];
    refreshRepeatIds();
    out.isRepeat = !!state.repeatIds[desc.episodeId];
    writePlayed(desc.episodeId, '2026-11-15', 'played', desc.block);
    out.playedRaw = isPlayed(desc.episodeId, '2026-11-15', 'Podcasts');
    out.playedDisplay = isPlayed(desc.episodeId, '2026-11-15', 'Formation');
    return out;
  });
  ok(l5.map[0] === 'Formation' && l5.map[1] === 'Morning' && l5.map[2] === '' && l5.map[3] === undefined,
    'L5: blockDisplayName maps Podcasts→Formation and returns every other value (incl. empty/undefined) as-is', JSON.stringify(l5.map));
  ok(l5.descBlock === 'Podcasts',
    'L5: the descriptor\'s block value in state still reads \'Podcasts\' — the value never moved');
  ok(l5.npMeta && l5.npMeta.indexOf('Formation') === 0,
    'L5: the Now Playing meta names the block "Formation"', l5.npMeta);
  ok(l5.queueText && l5.queueText.includes('Formation') && !l5.queueText.includes('Podcasts'),
    'L5: the queue row meta names the block "Formation"', (l5.queueText || '').slice(0, 120));
  ok(l5.isRepeat === true && l5.playedRaw === true && l5.playedDisplay === false,
    'L5: for a repeated id (where the block keys the mark), a mark written under the raw value \'Podcasts\' reads played under \'Podcasts\' and NOT under \'Formation\' — marks key on the value and cannot move');
}
await page.close();

/* ================= L4 — width legs, build vs base ================= */
async function barGeom(css, shell, width) {
  currentHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body data-lit="">' + shell + '</body></html>';
  const pg = await browser.newPage({ viewport: { width, height: 915 } });
  await pg.goto(ORIGIN + '/');
  const g = await pg.evaluate(() => {
    const bar = document.getElementById('tabbar');
    const out = { barH: bar.offsetHeight, labels: [] };
    bar.querySelectorAll('.tab').forEach((tab) => {
      const pill = tab.querySelector('.tabpill');
      const spans = pill.querySelectorAll('span');
      const label = spans[spans.length - 1];
      const cs = getComputedStyle(pill);
      const contentW = pill.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      out.labels.push({ text: label.textContent, scrollW: label.scrollWidth, contentW, labelH: label.offsetHeight });
    });
    return out;
  });
  await pg.close();
  return g;
}
for (const w of [360, 412]) {
  const b = await barGeom(APP_CSS, SHELL, w);
  const base = await barGeom(BASE_CSS, BASE_SHELL, w);
  ok(b.barH === base.barH,
    'L4 @' + w + 'px: the build bar height equals the base tree\'s bar height (the single-line height)', 'build ' + b.barH + ' vs base ' + base.barH);
  const bad = b.labels.filter((l) => l.scrollW > l.contentW);
  ok(bad.length === 0,
    'L4 @' + w + 'px: every renamed label fits its pill (scrollWidth ≤ pill content width) — no wrap, no shrink taken', JSON.stringify(b.labels));
  const ren = b.labels.filter((l) => l.text === 'Formation' || l.text === 'Sacred Art');
  ok(ren.length === 2 && ren.every((l) => l.scrollW <= l.contentW),
    'L4 @' + w + 'px: Formation and Sacred Art each stand on one line inside their pills', JSON.stringify(ren));
}

await browser.close();
server.close();
console.log(`\nharness-v438: ${pass} ok / ${fail} not-ok`);
if (failures.length) { console.log('failures:\n - ' + failures.join('\n - ')); process.exit(1); }
