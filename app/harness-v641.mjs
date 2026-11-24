// harness-v641.mjs — v641: the anchored pop-up row menu
//  (openSheetMenu, the ONE shared component) display fix.
//  John's approved decisions (package 93, all A):
//   Q1 width floor viewport-keyed: 232px below vw 600,
//      320px at vw >= 600; vw - 24 cap and right-edge
//      anchor alignment unchanged. (F1)
//   Q2 the Now Playing dock and the tab bar bound the
//      placement: boundTop = (dock standing ? dockTop :
//      tabTop) - 6 replaces vh - 12 in the below -> above
//      -> roomier-side-capped chain; the no-anchor
//      fallback seats its foot at boundTop. (F3)
//   Q3 .anchmenu h1.screen caps at 2 lines with the
//      line-clamp ellipsis; .epcard-title (Details)
//      carries the full title uncapped. (F2)
//   Q4 no caller edits — the shared component reaches
//      every menu (statics + the Favorites mirror leg).
//   Q5 a capped card is marked `capped`, its cap snaps
//      down from measured row offsets to header + full
//      rows + ~half a row (a partial row stands at the
//      foot), and the foot fade clears at the scroll
//      foot via a scroll listener. (F4)
//
// Legs:
//  (a) width 232 at vw 360/412, 320 at vw 604/725; the
//      card's right edge still aligns the anchor's.
//  (b) zero overlap of the dock band and the tab bar at
//      top/mid/low anchor seats in every shape; every
//      act reachable (flip, fit, or card scroll).
//  (c) the 98-char stress header paints <= 2 lines with
//      the clamp applied and the full title still in
//      the header text; the 48-char screenshot title
//      likewise <= 2 lines; Details opens the episode
//      card whose .epcard-title equals the full title.
//  (d) landscape 725x604: the capped card carries the
//      fade state at open with a partial row at its
//      foot; scrolling to the foot brings the last act
//      fully into view and clears the fade.
//  (e) the 7-item Favorites mirror obeys the same
//      bounds at mid and low seats in every shape.
//  Statics: the width rule, the bound read, and the
//  capped wiring stand in openSheetMenu / the .anchmenu
//  dress only; .epcard-title carries no clamp.
//
// Fail-on-old: run this harness in a detached worktree
//  of the base tree (4cad413, pre-fix client/ui) — legs
//  (a)-(e) fail there and leg (b) reproduces F3: at
//  604x725, mid anchor, screenshot title, the card's
//  foot covers the dock by ~70px (recorded in
//  docs/releases/v641.md §4).
//
// Fixtures (Improvement D — production sources, named):
//  the study's recipe (~/workspace/.tools/pwtest/
//  v641-menu-measure5.mjs) verbatim in shape: the
//  branch tree's rendered client + CSS served locally,
//  /api/** stubbed from tests/fixtures-v597 (production
//  day 2026-11-21 + production source settings),
//  tests/fixtures-v603 (book / novenas / podcasts
//  index), the LIVE externals set, and John's exported
//  document (~/workspace/projects/ora-pro-nobis/
//  john-personal-data-import-v589.json) as the
//  personal-data seed. Titles are the study's own: the
//  48-char screenshot title and the 98-char stress
//  title. The dock stands via the app's own updateDock()
//  with a current track — never a hand-placed fake bar.
//  Menus open through the real builders (openDayRowMenu
//  / openSheetMenu) on a real shipped .iconbtn anchor
//  (44x44) seated top / mid (~45% vh) / low.
//
// Run: node app/harness-v641.mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import vm from 'node:vm';

const { chromium } = await import('file://' + process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const APP = new URL('.', import.meta.url).pathname;
const SHOTS = process.env.HOME + '/workspace/projects/ora-pro-nobis/v641-renders';
mkdirSync(SHOTS, { recursive: true });

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 600)); }
}

// ---------- statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const grabFn = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};
const osm = grabFn(clientSrc, 'openSheetMenu');
check('S1 width floor is viewport-keyed inside openSheetMenu (vw >= 600 ? 320 : 232)',
  osm.includes('vw >= 600 ? 320 : 232'));
check('S2 placement bound is read from the live tabbar/dock rects inside openSheetMenu',
  osm.includes("getElementById('tabbar')") && osm.includes("getElementById('dock')") && osm.includes('boundTop'));
check('S3 capped wiring stands in openSheetMenu (capped class + scroll listener) and the .anchmenu dress',
  osm.includes("classList.add('capped')") && osm.includes("addEventListener('scroll'") && uiSrc.includes('.anchmenu.capped'));
const h1Rule = (uiSrc.match(/\.anchmenu h1\.screen \{[^}]*\}/) || [''])[0];
check('S4 .anchmenu h1.screen carries the 2-line clamp', h1Rule.includes('-webkit-line-clamp:2') && h1Rule.includes('overflow:hidden'), h1Rule);
const epRule = (uiSrc.match(/\.epcard-title \{[^}]*\}/) || [''])[0];
check('S5 .epcard-title carries NO clamp (Details keeps the full title)', !epRule.includes('line-clamp'), epRule);

// ---------- serve the branch tree's rendered client ----------
function renderTemplate(src, marker) { const a = src.indexOf(marker) + marker.length; const b = src.indexOf('\n`;', a); return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({})); }
const appJs = renderTemplate(clientSrc, 'export const APP_JS = `');
const appCss = renderTemplate(uiSrc, 'export const APP_CSS = `');
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
mkdirSync('/tmp/v641harness', { recursive: true });
writeFileSync('/tmp/v641harness/index.html', html);
writeFileSync('/tmp/v641harness/app.js', appJs);
writeFileSync('/tmp/v641harness/styles.css', appCss);
const server = createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.setHeader('content-type', 'text/javascript'); res.end(appJs); }
  else if (req.url.startsWith('/styles.css')) { res.setHeader('content-type', 'text/css'); res.end(appCss); }
  else { res.setHeader('content-type', 'text/html'); res.end(html); }
});
await new Promise((r) => server.listen(8951, r));

const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const DAY = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const SETTINGS = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const LIVE = { slots: [
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer - Divine Office', streamUrl: 'https://do.example/mp.mp3', durationSec: 600, sizeBytes: 1000, source: 'Divine Office' },
  { slotId: 'ext-evening-prayer', state: 'present', title: 'Evening Prayer - Divine Office', streamUrl: 'https://do.example/ep.mp3', durationSec: 600, sizeBytes: 1000, source: 'Divine Office' },
  { slotId: 'ext-office-of-readings', state: 'present', title: 'Office of Readings - Divine Office', streamUrl: 'https://do.example/oor.mp3', durationSec: 900, sizeBytes: 1000, source: 'Divine Office' },
]};
const SHOT_TITLE = 'Daily Mass Reading Podcast for November 23, 2026';
const STRESS_TITLE = 'Bible in a Year: Day 327 \u2014 The Kingdom of God Is at Hand and the Destruction of Jerusalem Foretold';
const DAY_ITEMS = ['Share', 'Add to queue', 'Download', 'Mark as read', 'Details'];
const FAV_ITEMS = ['Share', 'Add to queue', 'Download', 'Mark as read', 'Move to Morning', 'Move to Podcasts', 'Move to Family'];
check('S6 fixture titles are the study lengths (48 / 98 chars)', SHOT_TITLE.length === 48 && STRESS_TITLE.length >= 95, { shot: SHOT_TITLE.length, stress: STRESS_TITLE.length });

const MEASURE = () => {
  const card = document.querySelector('.anchmenu');
  if (!card) return { open: false };
  const r = card.getBoundingClientRect();
  const head = card.querySelector('h1.screen');
  const hr = head ? head.getBoundingClientRect() : null;
  const lh = head ? (parseFloat(getComputedStyle(head).lineHeight) || 14.4) : 14.4;
  const rows = [...card.querySelectorAll('[data-menuitem]')].map((btn) => {
    const br = btn.getBoundingClientRect();
    return { label: btn.textContent.trim(), top: br.top, bottom: br.bottom, height: br.height,
      fullyIn: br.top >= r.top - 0.5 && br.bottom <= r.bottom + 0.5,
      cutByFoot: br.top < r.bottom - 0.5 && br.bottom > r.bottom + 0.5 };
  });
  const dock = document.getElementById('dock');
  const dockR = dock && !dock.classList.contains('hidden') ? dock.getBoundingClientRect() : null;
  const tabR = document.getElementById('tabbar').getBoundingClientRect();
  const anchor = document.getElementById('v641anchor');
  const ar = anchor ? anchor.getBoundingClientRect() : null;
  const hcs = head ? getComputedStyle(head) : null;
  return {
    open: true,
    card: { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom, right: r.right },
    anchorRight: ar ? ar.right : null,
    capped: card.classList.contains('capped'), atfoot: card.classList.contains('atfoot'),
    maxHeightStyle: card.style.maxHeight || '', scrollHeight: card.scrollHeight, clientHeight: card.clientHeight,
    needsScroll: card.scrollHeight > card.clientHeight + 1,
    header: hr ? { height: hr.height, lines: Math.round(hr.height / lh), text: head.textContent, clamp: hcs.webkitLineClamp } : null,
    rows,
    dockTop: dockR ? dockR.top : null, tabTop: tabR.top,
    overlapDock: dockR ? Math.max(0, Math.round(r.bottom - dockR.top)) : 0,
    overlapTab: Math.max(0, Math.round(r.bottom - tabR.top)),
  };
};
const REACH = async () => {
  const card = document.querySelector('.anchmenu');
  if (!card) return { ok: false, per: [] };
  const rows = [...card.querySelectorAll('[data-menuitem]')];
  const per = [];
  for (const row of rows) {
    card.scrollTop = Math.max(0, row.offsetTop + row.offsetHeight - card.clientHeight + 8);
    await new Promise((res) => setTimeout(res, 40));
    const cr = card.getBoundingClientRect(), br = row.getBoundingClientRect();
    per.push(br.top >= cr.top - 2 && br.bottom <= cr.bottom + 2);
  }
  card.scrollTop = 0;
  await new Promise((res) => setTimeout(res, 40));
  return { ok: per.every(Boolean), per };
};
const CLOSE = () => document.querySelectorAll('.anchmenu,.menucatcher').forEach((x) => x.remove());

const SHAPES = [
  { name: 'unfolded-604x725', viewport: { width: 604, height: 725 }, wantWidth: 320 },
  { name: 'cover-360x840', viewport: { width: 360, height: 840 }, wantWidth: 232 },
  { name: 'phone-412x915', viewport: { width: 412, height: 915 }, wantWidth: 232 },
  { name: 'landscape-725x604', viewport: { width: 725, height: 604 }, wantWidth: 320 },
];
const b = await chromium.launch({ executablePath: EXE });
for (const shape of SHAPES) {
  const pg = await b.newPage({ viewport: shape.viewport });
  await pg.addInitScript((john) => {
    try { Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
    try { localStorage.setItem('opn-personal-data-v1', JSON.stringify(john)); localStorage.setItem('opn-praylistmode-v604', 'expanded'); } catch (e) {}
  }, JOHN);
  await pg.route('**/api/**', (route) => {
    const u = route.request().url();
    let body = {};
    if (u.includes('/api/player/source-settings')) body = { sources: SETTINGS.sources, version: 7 };
    else if (u.includes('/api/player/externals/live')) body = LIVE;
    else if (u.includes('/api/player/externals/audio')) return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(2048, 7) });
    else if (u.includes('/api/prayer/book')) body = BOOK;
    else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
    else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
    else if (u.includes('/api/player/podcasts')) body = PODIDX;
    else if (u.includes('/api/player/day')) body = JSON.parse(JSON.stringify(DAY));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await pg.route('https://do.example/**', (r) => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(2048, 7) }));
  await pg.goto('http://127.0.0.1:8951/index.html');
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => { try { setTab('prayers'); } catch (e) {} });
  await pg.waitForTimeout(4500);
  const stood = await pg.evaluate(() => {
    const t = (state.dayDescs || []).find((d) => d && d.available && d.episodeId);
    if (t) { state.current = t; updateDock(); }
    const a = document.createElement('button');
    a.id = 'v641anchor'; a.className = 'iconbtn'; a.textContent = '\u22ee'; a.setAttribute('aria-label', 'More options');
    a.style.cssText = 'position:fixed;right:12px;z-index:60;';
    document.body.appendChild(a);
    const dock = document.getElementById('dock');
    return { track: !!t, dockStands: !!dock && !dock.classList.contains('hidden') && dock.getBoundingClientRect().height > 0 };
  });
  check(shape.name + ' setup: a current track stands and the dock stands via updateDock()', stood.track && stood.dockStands, stood);
  const place = (frac) => pg.evaluate((f) => { document.getElementById('v641anchor').style.top = Math.round(window.innerHeight * f) + 'px'; }, frac);
  const placeLow = () => pg.evaluate(() => { document.getElementById('v641anchor').style.top = (window.innerHeight - 140) + 'px'; });
  const openReal = () => pg.evaluate(() => {
    const t = (state.dayDescs || []).find((d) => d && d.available && d.episodeId);
    const a = document.getElementById('v641anchor');
    if (t && a) openDayRowMenu(t, a, [{ label: 'Details', act: function () {} }]);
  });
  const openSet = (title, labels) => pg.evaluate(([tt, ls]) => {
    const a = document.getElementById('v641anchor');
    openSheetMenu(tt, ls.map((label) => ({ label, act: function () {} })), a);
  }, [title, labels]);

  // ---- leg (b): real day-row menu at top / mid / low seats ----
  const seats = [['top', () => place(0.08)], ['mid', () => place(0.45)], ['low', placeLow]];
  for (const [seatName, seatFn] of seats) {
    await seatFn(); await openReal(); await pg.waitForTimeout(500);
    const m = await pg.evaluate(MEASURE);
    check(shape.name + ' (b) ' + seatName + ' seat: zero dock/tab overlap', m.open && m.overlapDock === 0 && m.overlapTab === 0, m);
    const reach = await pg.evaluate(REACH);
    check(shape.name + ' (b) ' + seatName + ' seat: every act reachable', reach.ok, reach);
    if (seatName === 'mid') {
      check(shape.name + ' (a) card width = ' + shape.wantWidth + 'px', Math.round(m.card.width) === shape.wantWidth, m.card);
      check(shape.name + ' (a) card right edge aligns the anchor right edge (12px margins)', Math.abs(m.card.right - m.anchorRight) <= 1.5 && m.card.left >= 11.5, { card: m.card, anchorRight: m.anchorRight });
      if (shape.name === 'unfolded-604x725') await pg.screenshot({ path: SHOTS + '/unfolded-604x725-mid-clear-of-dock.png' });
    }
    await pg.evaluate(CLOSE);
  }
  // ---- leg (c): stress + screenshot headers at mid ----
  await place(0.45); await openSet(STRESS_TITLE, DAY_ITEMS); await pg.waitForTimeout(400);
  let m = await pg.evaluate(MEASURE);
  check(shape.name + ' (c) 98-char header <= 2 lines, clamp applied, full title in header text',
    m.open && m.header.lines <= 2 && m.header.clamp === '2' && m.header.text === STRESS_TITLE, m.header);
  check(shape.name + ' (c/b) stress menu: zero dock/tab overlap', m.overlapDock === 0 && m.overlapTab === 0, m);
  await pg.evaluate(CLOSE);
  await place(0.45); await openSet(SHOT_TITLE, DAY_ITEMS); await pg.waitForTimeout(400);
  m = await pg.evaluate(MEASURE);
  check(shape.name + ' (c) 48-char screenshot header <= 2 lines', m.open && m.header.lines <= 2, m.header);
  await pg.evaluate(CLOSE);
  // ---- leg (c): Details carries the full title ----
  await place(0.45);
  await pg.evaluate((tt) => {
    const a = document.getElementById('v641anchor');
    const t = (state.dayDescs || []).find((d) => d && d.available && d.episodeId);
    openSheetMenu(tt, [{ label: 'Details', act: function () { openEpisodeCard({ desc: t, titleText: tt }, a); } }], a);
  }, STRESS_TITLE);
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { const btn = document.querySelector('.anchmenu [data-menuitem="0"]'); if (btn) btn.click(); });
  await pg.waitForTimeout(500);
  const det = await pg.evaluate(() => {
    const el = document.querySelector('.epcard-title');
    if (!el) return { found: false };
    return { found: true, text: el.textContent, clamp: getComputedStyle(el).webkitLineClamp };
  });
  check(shape.name + ' (c) Details .epcard-title carries the full uncapped title', det.found && det.text === STRESS_TITLE && det.clamp !== '2', det);
  await pg.evaluate(CLOSE);
  // ---- leg (e): Favorites mirror, 7 items, mid + low ----
  for (const [seatName, seatFn] of [['mid', () => place(0.45)], ['low', placeLow]]) {
    await seatFn(); await openSet(SHOT_TITLE, FAV_ITEMS); await pg.waitForTimeout(400);
    m = await pg.evaluate(MEASURE);
    check(shape.name + ' (e) mirror ' + seatName + ': width ' + shape.wantWidth + ', zero overlap, header <= 2 lines',
      m.open && Math.round(m.card.width) === shape.wantWidth && m.overlapDock === 0 && m.overlapTab === 0 && m.header.lines <= 2, m);
    if (m.needsScroll) check(shape.name + ' (e) mirror ' + seatName + ': capped card carries the fade state', m.capped && !m.atfoot, m);
    const reach = await pg.evaluate(REACH);
    check(shape.name + ' (e) mirror ' + seatName + ': every act reachable', reach.ok, reach);
    await pg.evaluate(CLOSE);
  }
  // ---- leg (d): capped card sign in the landscape shape ----
  if (shape.name === 'landscape-725x604') {
    await place(0.45); await openSet(STRESS_TITLE, DAY_ITEMS); await pg.waitForTimeout(400);
    m = await pg.evaluate(MEASURE);
    check('landscape (d) capped card: scrolls internally, fade state at open, partial row at the foot',
      m.open && m.needsScroll && m.capped && !m.atfoot && m.rows.some((r) => r.cutByFoot), m);
    await pg.screenshot({ path: SHOTS + '/landscape-725x604-capped-fade-partial.png' });
    await pg.evaluate(() => { const c = document.querySelector('.anchmenu'); c.scrollTop = c.scrollHeight; });
    await pg.waitForTimeout(300);
    m = await pg.evaluate(MEASURE);
    const last = m.rows[m.rows.length - 1];
    check('landscape (d) at the scroll foot: last act fully in view and the fade cleared',
      m.atfoot && !!last && last.fullyIn, { atfoot: m.atfoot, last });
    await pg.evaluate(CLOSE);
  }
  await pg.close();
}
await b.close();
server.close();
console.log('\n' + (bad ? 'FAIL' : 'PASS') + ' harness-v641: ' + ok + ' ok, ' + bad + ' not ok');
process.exit(bad ? 1 : 0);
