// harness-v652.mjs — v652: player layout — Share moves
//  to the bottom row; transport controls align.
//  Change (docs/releases/v652.md §§1-2): #np-share leaves
//  the .np-transport row and stands in .np-controls
//  between #np-star and #np-menu, dressed btn ghost, same
//  id / aria-label / Material glyph SVG byte-identical;
//  the #np-share wiring (by id, shareTrackSheet(
//  state.current)) does not move. .np-transport's five
//  remaining controls stand in five equal flex cells
//  (flex:1 1 0, centered content), row max-width:420px,
//  margin:16px auto 20px, the fixed gap:26px retired.
//
// Legs:
//  L1 ◆ Seats: painted sheet .np-transport holds exactly
//     np-back10, np-prev, np-play, np-next, np-fwd10 in
//     order and no #np-share; .np-controls holds
//     #np-share between #np-star and #np-menu.
//  L2 ◆ Alignment: served CSS carries the equal-cell
//     rule (flex:1 1 0 cells, max-width:420px, auto side
//     margins, no 26px gap on .np-transport) and no
//     >=600px media rule overrides .np-transport.
//  L3 ◆ Share from the new seat: APK-shaped world
//     (bridge stub, navigator.share absent) — clicking
//     bottom-row #np-share calls the bridge once with
//     the standing payload; web world — navigator.share
//     called; neither — copy path paints "Link copied."
//  L4 ◆ Neighbors: Intentions toggle flips state/label;
//     star toggles; #np-menu opens the player menu with
//     Share first.
//  ◆ L1/L2 fail on the base tree (2f207ce): Share stands
//  in transport there and the CSS carries gap:26px.
//
// Fixtures (Improvement D — production sources, named):
//  Same production fixtures as harness-v644 (John's
//  exported personal-data document v589 with
//  podcastListens deleted; tests/fixtures-v597
//  production day + source settings; tests/fixtures-v603
//  book / novenas / podcasts-index fetch bodies).
//  Synthetic day descriptors follow harness-v640's
//  synthTrack shape over that production world.
//
// Run: node app/harness-v652.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const STD_PATH = 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z';
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrcEarly = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
check('T1 #np-share wiring stands by id, unmoved: sheet.querySelector(\'#np-share\') -> shareTrackSheet(state.current)',
  clientSrc.includes("sheet.querySelector('#np-share').addEventListener('click', function () { if (state.current) shareTrackSheet(state.current); });"));
check('T2 pin literal stands at ora-pro-nobis-v652-1', uiSrcEarly.includes('ora-pro-nobis-v652-1'));

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v644:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, openNowPlaying, openShareSheet: (typeof openShareSheet !== "undefined" ? openShareSheet : null), nativeShareTrack: (typeof nativeShareTrack !== "undefined" ? nativeShareTrack : null), openDayRowMenu: (typeof openDayRowMenu !== "undefined" ? openDayRowMenu : null), shareTrackSheet: (typeof shareTrackSheet !== "undefined" ? shareTrackSheet : null), shareAppUrlFor: (typeof shareAppUrlFor !== "undefined" ? shareAppUrlFor : null), EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(store, url) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: url || 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(null) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(extra) {
  return Object.assign({ [DATA_KEY]: JSON.stringify(JOHN), 'opn-praylistmode-v604': 'expanded' }, extra || {});
}
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0(DATE);
  const prim = {};
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'external' && s.slotId && s.role !== 'fallback') prim[s.slotId] = s; });
  const standing = [];
  O.EXT_SLOTS.forEach((s) => {
    const row = prim[s.slotId];
    if (!row || row.enabled !== 1 || !O.extDayRulePasses(row.dayRule || 'daily', wd)) return;
    standing.push({ slotId: s.slotId, title: s.title, block: row.block || 'Morning', sortOrder: row.sortOrder, source: s.source || 'Divine Office' });
  });
  O.state.extStanding = standing;
  const own = [];
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'own' && O.OWN_ROW_EPISODE[s.sourceKey]) own.push({ sourceKey: s.sourceKey, episodeId: O.OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled }); });
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0));
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
}
async function paintRealDay(w) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
async function paintSynthetic(w, descs) {
  const O = w.__opn;
  await paintRealDay(w);
  O.state.dayDescs = descs;
  O.state.presentedDay = DATE;
  O.paintPrayersView(O.state.dayPayload);
  await sleep(120);
}
function synthTrack(over) {
  return Object.assign({ episodeId: 'synth-1', title: 'Synth track', block: 'Morning', available: true, streamUrl: 'https://example.invalid/s.mp3', durationS: 30 }, over || {});
}
function stubBridge(w, calls, mode) {
  const plugin = {
    setDaySnapshot: () => Promise.resolve({}), setNativeQueue: () => Promise.resolve({}),
    vaultBiometricStatus: () => Promise.resolve({}), oneEngine: () => Promise.resolve({}),
  };
  if (mode !== 'old') {
    plugin.shareTrack = (p) => {
      calls.push(p);
      if (mode === 'throw') throw new Error('share-boom');
      if (mode === 'reject') return Promise.reject(new Error('share-rejected'));
      return Promise.resolve({});
    };
  }
  try { Object.defineProperty(w, 'Capacitor', { value: { Plugins: { OraDayBridge: plugin } }, configurable: true }); } catch (e) { w.Capacitor = { Plugins: { OraDayBridge: plugin } }; }
  return plugin;
}
function stubShare(w, captured) {
  try { Object.defineProperty(w.navigator, 'share', { value: (p) => { captured.push(p); return Promise.resolve(); }, configurable: true }); } catch (e) { w.navigator.share = (p) => { captured.push(p); return Promise.resolve(); }; }
}
function stubClipboard(w, copied) {
  try { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: (s) => { copied.push(s); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
}
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
const TRACK = () => synthTrack({ episodeId: 'v652-1', title: 'V652 Track', durationS: 30 });
const WANT_URL = 'https://app.orapronobis.media/?s=day&date=' + DATE + '&id=v652-1';
const WANT_TEXT = 'V652 Track \u2014 Nov 21 \u00b7 Episode \u00b7 0:30';


// ---------- L1 ◆ Seats + L4 ◆ Neighbors (one painted sheet) ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const t = TRACK();
  await paintSynthetic(w, [t]);
  O.state.current = t;
  O.openNowPlaying();
  await sleep(60);
  const transport = d.querySelector('.np-transport');
  const controls = d.querySelector('.np-controls');
  const tIds = transport ? [...transport.querySelectorAll('button')].map((b) => b.id) : [];
  const cIds = controls ? [...controls.querySelectorAll('button')].map((b) => b.id) : [];
  check('L1 ◆ .np-transport holds exactly np-back10, np-prev, np-play, np-next, np-fwd10 in order and no #np-share',
    JSON.stringify(tIds) === JSON.stringify(['np-back10', 'np-prev', 'np-play', 'np-next', 'np-fwd10']) && !transport.querySelector('#np-share'),
    { tIds });
  check('L1 ◆ .np-controls holds np-intentions, np-read, np-star, np-share, np-menu in order (#np-share between #np-star and #np-menu)',
    JSON.stringify(cIds) === JSON.stringify(['np-intentions', 'np-read', 'np-star', 'np-share', 'np-menu']),
    { cIds });
  const btn = d.querySelector('#np-share');
  const path = btn && btn.querySelector('svg path');
  check('L1 ◆ the moved #np-share keeps id, aria-label="Share", the btn ghost dress, and the Material glyph SVG byte-identical (path d + viewBox + fill)',
    !!btn && btn.getAttribute('aria-label') === 'Share' && btn.classList.contains('btn') && btn.classList.contains('ghost')
    && !btn.classList.contains('np-tbtn') && !!path && path.getAttribute('d') === STD_PATH
    && btn.querySelector('svg').getAttribute('viewBox') === '0 0 24 24'
    && btn.querySelector('svg').getAttribute('fill') === 'currentColor',
    { cls: btn && btn.className, d: path && path.getAttribute('d') });

  // L4: Intentions toggle flips state/label.
  const intBtn = d.querySelector('#np-intentions');
  const beforeLabel = intBtn && intBtn.textContent;
  click(w, intBtn);
  await sleep(80);
  const intBtn2 = d.querySelector('#np-intentions');
  check('L4 ◆ Intentions toggle flips state/label (On -> Off, store reads off)',
    beforeLabel === 'Intentions On' && !!intBtn2 && intBtn2.textContent === 'Intentions Off'
    && w.localStorage.getItem('opn-intentions-v384') === 'off',
    { beforeLabel, after: intBtn2 && intBtn2.textContent, store: w.localStorage.getItem('opn-intentions-v384') });
  click(w, intBtn2);
  await sleep(80);

  // L4: star toggles the playing track's star.
  const starBtn = d.querySelector('#np-star');
  const glyphBefore = starBtn && starBtn.textContent;
  click(w, starBtn);
  await sleep(80);
  const starBtn2 = d.querySelector('#np-star');
  check('L4 ◆ star toggles the playing track (glyph ☆ -> ★, starred store holds the track)',
    glyphBefore === '☆' && !!starBtn2 && starBtn2.textContent === '★'
    && ((O.state.starred || []).length === 1),
    { glyphBefore, after: starBtn2 && starBtn2.textContent, starred: (O.state.starred || []).length });

  // L4: #np-menu opens the player menu with Share first.
  click(w, d.querySelector('#np-menu'));
  await sleep(80);
  const items = [...d.querySelectorAll('.anchmenu [data-menuitem]')];
  const firstLabel = items.length ? (items[0].querySelector('.grow') || items[0]).textContent.trim() : null;
  check('L4 ◆ #np-menu opens the player menu with Share standing first',
    items.length >= 3 && firstLabel === 'Share',
    { firstLabel, labels: items.map((x) => x.textContent.trim()) });
  w.close();
}

// ---------- L2 ◆ Alignment (served CSS) ----------
{
  const css = uiSrcEarly;
  const rowRule = (css.match(/\.np-transport \{[^}]*\}/) || [''])[0];
  const cellRule = (css.match(/\.np-transport > button \{[^}]*\}/) || [''])[0];
  check('L2 ◆ .np-transport row carries max-width:420px and margin:16px auto 20px (auto side margins), and no gap:26px stands on it',
    rowRule.includes('max-width:420px') && rowRule.includes('margin:16px auto 20px') && !rowRule.includes('gap:26px') && !css.includes('.np-transport { display:flex; align-items:center; justify-content:center; gap:26px;'),
    { rowRule });
  check('L2 ◆ every direct button child of .np-transport stands in an equal cell: flex:1 1 0 with display:flex; align-items:center; justify-content:center',
    cellRule.includes('flex:1 1 0') && cellRule.includes('display:flex') && cellRule.includes('align-items:center') && cellRule.includes('justify-content:center'),
    { cellRule });
  check('L2 ◆ .np-play keeps its 58px rule and the :active rule still names .np-tbtn (classes not renamed)',
    /\.np-play \{ width:58px; height:58px;/.test(css) && css.includes('.np-tbtn:active'),
    {});
  // No >=600px media block overrides .np-transport.
  let mediaOverride = false;
  let at = 0;
  while ((at = css.indexOf('@media', at)) >= 0) {
    const open = css.indexOf('{', at);
    const prelude = css.slice(at, open);
    let depth = 0, i = open;
    for (; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') { depth--; if (!depth) break; } }
    const m = prelude.match(/min-width:\s*(\d+)px/);
    if (m && Number(m[1]) >= 600 && css.slice(open, i).includes('.np-transport')) mediaOverride = true;
    at = i + 1;
  }
  check('L2 ◆ no >=600px media rule overrides .np-transport (alignment holds at phone and wide widths)',
    !mediaOverride, {});
}

// ---------- L3 ◆ Share from the new seat: APK world ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const calls = [], copied = [];
  stubBridge(w, calls, 'ok');
  stubClipboard(w, copied);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  O.state.current = t;
  O.openNowPlaying();
  await sleep(60);
  const btn = d.querySelector('.np-controls #np-share');
  check('L3 ◆ APK world: bottom-row #np-share stands, bridge with shareTrack stands, navigator.share absent',
    !!btn && typeof w.navigator.share === 'undefined' && !!w.Capacitor.Plugins.OraDayBridge.shareTrack, {});
  click(w, btn);
  await sleep(60);
  const sheet = d.querySelector('.sharesheet');
  check('L3 ◆ clicking bottom-row #np-share stands the share sheet WITH the "Share…" row',
    !!sheet && !!sheet.querySelector('[data-sharego]'), {});
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(60);
  check('L3 ◆ the bridge is called exactly once with the standing payload (title, composed text, shareAppUrlFor app link)',
    calls.length === 1 && calls[0].title === 'V652 Track' && calls[0].text === WANT_TEXT && calls[0].url === WANT_URL
    && Object.keys(calls[0]).sort().join(',') === 'text,title,url',
    { calls });
  w.close();
}

// ---------- L3 ◆ Share from the new seat: web world ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const captured = [], copied = [];
  stubClipboard(w, copied);
  stubShare(w, captured);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  O.state.current = t;
  O.openNowPlaying();
  await sleep(60);
  click(w, d.querySelector('.np-controls #np-share'));
  await sleep(60);
  const sheet = d.querySelector('.sharesheet');
  check('L3 ◆ web world: clicking bottom-row #np-share stands the share sheet WITH the "Share…" row',
    !!sheet && !!sheet.querySelector('[data-sharego]'), {});
  click(w, sheet && sheet.querySelector('[data-sharego]'));
  await sleep(60);
  check('L3 ◆ navigator.share is called exactly once with the standing payload',
    captured.length === 1 && captured[0].title === 'V652 Track' && captured[0].text === WANT_TEXT && captured[0].url === WANT_URL,
    { captured });
  w.close();
}

// ---------- L3 ◆ Share from the new seat: neither world ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const copied = [];
  stubClipboard(w, copied);
  const t = TRACK();
  await paintSynthetic(w, [t]);
  O.state.current = t;
  O.openNowPlaying();
  await sleep(60);
  click(w, d.querySelector('.np-controls #np-share'));
  await sleep(60);
  const sheet = d.querySelector('.sharesheet');
  check('L3 ◆ neither world: no "Share…" row, Copy link stands',
    !!sheet && !sheet.querySelector('[data-sharego]') && !!sheet.querySelector('[data-sharecopy]'), {});
  click(w, sheet && sheet.querySelector('[data-sharecopy]'));
  await sleep(60);
  const note = sheet && sheet.querySelector('[data-shareline]');
  check('L3 ◆ the copy path writes the app link and paints "Link copied."',
    copied[0] === WANT_URL && !!note && note.textContent === 'Link copied.',
    { copied, note: note && note.textContent });
  w.close();
}

console.log('\nharness-v652:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
