// harness-v702.mjs — v702: the Liturgy popup over the Mass
// video — the day's readings (the v697 paint) in a movable,
// transparency-adjustable panel, engaged by the "Display
// Liturgy Text" item in the bottom-docked player bar's ⋯
// menu (openDockMenu; John's directions 2026-11-27 15:24 /
// 15:26 / 15:26 CT, doc §1.1/§1.4 as amended).
//
// Chromium (playwright-core) harness, modeled on
// harness-v697.mjs: the REAL built Worker bundle (esbuild
// from source) served locally, the API stubbed, real acts,
// same-tick DOM assertions; ORA_WT selects the tree for the
// fail-on-old run.
//
// Fixtures (Improvement D — production sources named): the
// two Plan-captured route payloads, read from the committed
// files, never re-typed, never trimmed:
//  - fixtures/mass-readings-2026-11-27.json — found:true,
//    4 parts (Revelation 20:1-4, 11—21:2 · Psalm 84:3, 4,
//    5-6a, 8a · Luke 21:28 · Luke 21:29-33), copyright[1].
//  - fixtures/mass-readings-2026-11-26.json — found:true,
//    parts:[] (the honest-empty day).
// The Mass descriptor is resolveMassDynamic688's literal
// shape (client.ts:21509ff): kind 'video', vmSeries the
// series key, mass688 true, massSeries the key, the video's
// own title carrying its date.
//
// Legs: F fixture shape + pin · O1 Praylist surface (the
// dock ⋯ menu carries "Display Liturgy Text"; tap opens the
// popup over the playing video; one mass-readings fetch for
// the title's date; the v697 paint stands) · O2 Worship
// Virtual Mass surface (same legs through paintPodWatch
// with massPodReturn standing) · O3 no Order-of-Mass text,
// no /api/prayer/mass fetch · D1 drag + in-bounds clamp
// (driven by real mouse pointer events) · S1 slider range /
// default / background-only · P1 persistence across
// close/reopen · V1 driven frame identity + elementFromPoint
// control-reachability with the popup open · N1 honest
// empty from the 2026-11-26 fixture · C1 close on
// teardown/change (finishVideoHandoff656 · closeWatch) ·
// A1 the item does NOT stand for a non-Mass playing item
// (audio · Adoration watch · non-Mass Praylist video).
// Fail-on-old: on the base tree (a8cb317) O1–O3, D1, S1,
// P1, N1, C1 fail (no menu item, no panel); A1 passes; V1's
// frame-identity half passes trivially while its popup half
// fails.
//
// Run: node app/worker/harness-v702.mjs
//      ORA_WT=/path/to/old-tree node /path/to/harness-v702.mjs
//
// v704 RE-POINTS (doc v704 §2.6 — the ONLY changes to this
// harness under v704, recorded in v704 §3): O1's and O2's
// paint assertions are re-pointed to accept the
// entire-liturgy body (the readings citations and the
// .mass-ack line stand inside it, at the readings place
// and the tail); O3 is INVERTED to O3′ (the body now
// carries standing Order text and a /api/prayer/mass
// fetch stands); N1's setup is re-pointed (the stub now
// also serves the mass route from the v704 §1.8 fixture
// and the universal-prayer route empty) and its assertion
// moves to "the line at the readings place, the liturgy
// around it". Every other leg is byte-unmodified.
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- the committed Plan fixtures (verbatim) ----------
const FIX27 = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'mass-readings-2026-11-27.json'), 'utf8'));
const FIX26 = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'mass-readings-2026-11-26.json'), 'utf8'));
const MASS27 = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'mass-2026-11-27.json'), 'utf8')); // v704 §2.6 N1 setup re-point: the mass-route stub body (the v704 §1.8 fixture)
check('F 2026-11-27 fixture: found:true, 4 parts incl. a Gospel part, non-empty copyright[]', FIX27.found === true && FIX27.parts.length === 4 && FIX27.parts.some((p) => p.key === 'g') && (FIX27.copyright || []).length === 1);
check('F 2026-11-27 citations are the captured set (Revelation 20:1-4, 11—21:2 · Psalm 84:3, 4, 5-6a, 8a · Luke 21:28 · Luke 21:29-33)', JSON.stringify(FIX27.parts.map((p) => p.source)) === JSON.stringify(['Revelation 20:1-4, 11—21:2', 'Psalm 84:3, 4, 5-6a, 8a', 'Luke 21:28', 'Luke 21:29-33']), FIX27.parts.map((p) => p.source));
check('F 2026-11-26 fixture: found:true with parts:[] (the honest-empty day shape)', FIX26.found === true && Array.isArray(FIX26.parts) && FIX26.parts.length === 0);

// ---------- descriptors (resolveMassDynamic688's shape) ----------
const MASS_TITLE = 'Catholic Mass Today | Friday November 27, 2026 | CatholicTV Daily Mass';
function massDesc(title) {
  return {
    episodeId: 'yt:VID702', kind: 'video', videoId: 'VID702', vmSeries: 'catholictv',
    title: title || MASS_TITLE, url: null, enclosureUrl: null,
    available: true, block: 'Midday', durationS: 0, imageUrl: null,
    descText: null, dateLabel: '', listened: false,
    source: 'Catholic TV Mass', stale: false, mass688: true, massSeries: 'catholictv',
  };
}
const MASS_DESC_26 = massDesc('Catholic Mass Today | Thursday November 26, 2026 | CatholicTV Daily Mass');
const SAINTS_DESC = {
  episodeId: 'yt:SAINT1', kind: 'video', videoId: 'SAINT1', vmSeries: 'catholicsaints',
  title: 'Saint of the Day Video', url: null, enclosureUrl: null,
  available: true, block: 'Morning', durationS: 0, imageUrl: null,
  descText: null, dateLabel: '', listened: false, source: 'Catholic Saints & Feasts', stale: false,
};
const AUDIO_DESC = { episodeId: 'audio-1', kind: 'podcast', title: 'Some Audio Track', available: true, block: 'Morning', durationS: 300, url: 'https://example.invalid/a.mp3' };

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v702harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries the v702 release pin ora-pro-nobis-v702-1', /ora-pro-nobis-v702-1/.test(SWJS), 'pin not in served /sw.js');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.addInitScript((payloads) => {
  window.__fetches = [];
  window.__payloads = payloads.readings;
  window.__massFixture = payloads.mass;
  const respJson = (obj) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)) });
  window.fetch = (url) => {
    const u = String(url);
    window.__fetches.push(u);
    if (u.includes('/api/prayer/mass-readings')) {
      const m = /[?&]date=([0-9-]+)/.exec(u);
      const p = m ? window.__payloads[m[1]] : null;
      return respJson(p || { date: m ? m[1] : '', found: false, parts: [], copyright: [] });
    }
    // v704 §2.6 setup re-point: under v704 the popup also
    // fetches the Mass payload and the Universal Prayer
    // intentions; the stub serves both (the §1.8 fixture;
    // the route's empty-day answer by construction).
    if (u.includes('/api/prayer/mass-universal-prayer')) {
      const m2 = /[?&]date=([0-9-]+)/.exec(u);
      return respJson({ ok: true, date: m2 ? m2[1] : '', intentions: [] });
    }
    if (/\/api\/prayer\/mass\?/.test(u)) return respJson(window.__massFixture);
    return new Promise(() => {});
  };
}, { readings: { '2026-11-27': FIX27, '2026-11-26': FIX26 }, mass: MASS27 });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- drivers ----------
async function resetWorld() {
  await pg.evaluate(() => {
    if (typeof closeLiturgyPopup702 === 'function') closeLiturgyPopup702();
    document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove());
    videoHandoff656 = null; podWatch = null; podWatchPlayer = null;
    massPodReturn = false; adorationWatch = null; podLevel = 'series';
    state.current = null; state.queue = []; state.queueIdx = -1;
    window.__fetches = [];
    try { localStorage.removeItem('opn-litpop-v702'); } catch (e) {}
  });
}
async function openDockMenuRows() {
  return pg.evaluate(() => {
    openDockMenu();
    return Array.from(document.querySelectorAll('.anchmenu .menurow')).map((r) => r.textContent.trim());
  });
}
async function tapDockMenuItem(label) {
  return pg.evaluate((label) => {
    openDockMenu();
    const row = Array.from(document.querySelectorAll('.anchmenu .menurow')).find((r) => r.textContent.trim() === label);
    if (!row) return false;
    row.click();
    return true;
  }, label);
}
function panelState() {
  return pg.evaluate(() => {
    const p = document.getElementById('litpop702');
    if (!p) return { panel: false, date: null, left: -1, top: -1, right: -1, bottom: -1, width: 0, height: 0, bodyText: '', acks: [], slider: null, bg: '', panelOpacity: '', bodyOpacity: '', headText: '' };
    const body = p.querySelector('.litpop702-body');
    const slider = p.querySelector('#litpop702-alpha');
    const r = p.getBoundingClientRect();
    return {
      panel: true, date: p.getAttribute('data-litpop702-date'),
      left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
      bodyText: body ? body.textContent : '',
      acks: body ? Array.from(body.querySelectorAll('.mass-ack')).map((e) => e.textContent) : [],
      slider: slider ? slider.value : null,
      bg: p.style.background || '', panelOpacity: p.style.opacity || '', bodyOpacity: body ? (body.style.opacity || '') : null,
      headText: (p.querySelector('.litpop702-head') || {}).textContent || '',
    };
  });
}
async function setSlider(v) {
  await pg.evaluate((v) => {
    const s = document.querySelector('#litpop702-alpha');
    if (!s) return;
    s.value = v; s.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
}
async function dragHead(dx, dy) {
  const box = await pg.evaluate(() => {
    const h = document.querySelector('.litpop702-head');
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!box) return false;
  await pg.mouse.move(box.x, box.y);
  await pg.mouse.down();
  await pg.mouse.move(box.x + dx, box.y + dy, { steps: 12 });
  await pg.mouse.up();
  await pg.waitForTimeout(60);
  return true;
}

// ---------- O1: Praylist surface ----------
await resetWorld();
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, massDesc());
await pg.waitForTimeout(200);
await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  window.__frame702 = f; window.__frameSrc702 = f ? f.getAttribute('src') : null;
  window.__fetches = [];
});
const rowsO1 = await openDockMenuRows();
check('O1 the dock ⋯ menu carries "Display Liturgy Text" while a Mass video plays on the Praylist surface', rowsO1.includes('Display Liturgy Text'), rowsO1);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });
check('O1 tapping "Display Liturgy Text" in the dock ⋯ menu succeeds', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(400);
let ps = await panelState();
check('O1 the popup stands over the playing video (panel in body, date = the title date 2026-11-27)', ps.panel && ps.date === '2026-11-27', ps);
check('O1 the panel head reads "Liturgy"', ps.panel && ps.headText.includes('Liturgy'), ps.headText);
const fetchesO1 = await pg.evaluate(() => window.__fetches.slice());
const mrFetches = fetchesO1.filter((u) => u.includes('/api/prayer/mass-readings'));
check('O1 exactly one mass-readings fetch, for date=2026-11-27', mrFetches.length === 1 && mrFetches[0].includes('date=2026-11-27'), fetchesO1);
// O1 paint assertions re-pointed per v704 §2.6: the
// citations, the Gospel word-string, and the .mass-ack
// line now stand INSIDE the entire-liturgy body (at the
// readings place and the tail); the assertions' substance
// (presence, from the fixture) is unchanged.
check('O1 the body paints the fixture citations (Revelation 20:1-4, 11—21:2 · Luke 21:29-33)', ps.bodyText.includes('Revelation 20:1-4, 11—21:2') && ps.bodyText.includes('Luke 21:29-33'), ps.bodyText.slice(0, 200));
check('O1 the body paints a Gospel word-string from the fixture ("Consider the fig tree")', ps.bodyText.includes('Consider the fig tree'), ps.bodyText.slice(0, 300));
check('O1 the copyright[] line paints as .mass-ack at the foot', ps.acks.length === 1 && ps.acks[0] === FIX27.copyright[0], ps.acks);
// O3′ (v704 §2.6 INVERSION of v702's O3, cited here per
// that section — never silently edited): v702's O3 asserted
// a readings-only body; under v704 the body is the entire
// liturgy, so both halves stand inverted.
check('O3′ the painted body carries standing Order-of-Mass fixed text ("And with your spirit" present — v704 inversion of O3)', ps.panel && ps.bodyText.includes('And with your spirit'));
check('O3′ a /api/prayer/mass fetch was issued for date=2026-11-27, plus the universal-prayer fetch (v704 inversion of O3)', ps.panel && fetchesO1.some((u) => /\/api\/prayer\/mass\?date=2026-11-27/.test(u)) && fetchesO1.some((u) => u.includes('/api/prayer/mass-universal-prayer?date=2026-11-27')), fetchesO1);

// ---------- V1 (identity half) ----------
const v1a = await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  return { same: f === window.__frame702, srcSame: f && f.getAttribute('src') === window.__frameSrc702, handoffTitle: videoHandoff656 && videoHandoff656.desc.title };
});
check('V1 the frame element + src stand unchanged with the popup open; the hand-off record stands', v1a.same && v1a.srcSame && v1a.handoffTitle === MASS_TITLE, v1a);

// ---------- D1: drag + clamp (driven) ----------
const before = await panelState();
await dragHead(0, 150);
let after = await panelState();
check('D1 a head drag moves the panel by the drag delta (top +150, left unchanged)', after.panel && Math.abs(after.top - (before.top + 150)) <= 1 && Math.abs(after.left - before.left) <= 1, { before: [before.left, before.top], after: [after.left, after.top] });
await dragHead(3000, 3000);
after = await panelState();
check('D1 an oversize drag ends clamped — panel fully inside the viewport on all four sides', after.panel && after.left >= 0 && after.top >= 0 && after.right <= 390.5 && after.bottom <= 844.5, after);
await dragHead(-3000, -3000);
after = await panelState();
check('D1 an oversize drag the other way clamps to the top-left corner (0,0)', after.panel && Math.abs(after.left) <= 1 && Math.abs(after.top) <= 1, after);

// ---------- V1 (reachability half, driven) ----------
await dragHead(3000, 3000); // park the popup at the bottom-right corner
const v1b = await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  if (!f) return { hit: 'no-frame' };
  const r = f.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { hit: el === f ? 'frame' : (el ? el.className + '/' + el.tagName : 'none'), same: f === window.__frame702 };
});
check('V1 with the popup open and parked in a corner, elementFromPoint at the frame center returns the iframe itself', v1b.hit === 'frame' && v1b.same, v1b);

// ---------- S1: slider ----------
// The default alpha (0.88, §2.2 prefs) is asserted on the
// APPLIED background — the Plan's own S1 measure. The
// slider element itself cannot rest at 0.88: the step
// grid is min-anchored (0.35 + n·0.05 = …, 0.85, 0.90, …),
// so the control snaps to the nearest step, 0.90; the
// first input writes a stepped value. Named in §3.
ps = await panelState();
check('S1 the default alpha 0.88 is applied on first open (panel background carries 88%)', ps.bg.includes('88%'), ps.bg);
await setSlider('0.35');
ps = await panelState();
check('S1 at 0.35 the panel inline background carries 35%', ps.bg.includes('35%'), ps.bg);
await setSlider('1');
ps = await panelState();
check('S1 at 1.00 the panel inline background carries 100%', ps.bg.includes('100%'), ps.bg);
check('S1 background-only: no opacity is ever set on the panel or the body', ps.panel && ps.panelOpacity === '' && ps.bodyOpacity === '', ps);

// ---------- P1: persistence ----------
await setSlider('0.5');
const pBefore = await panelState();
await pg.evaluate(() => { const c = document.querySelector('[data-litpop702-close]'); if (c) c.click(); });
await pg.waitForTimeout(60);
ps = await panelState();
const stored = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('opn-litpop-v702') || 'null'); } catch (e) { return null; } });
check('P1 the Close button removes the panel', pBefore.panel && !ps.panel);
check('P1 localStorage opn-litpop-v702 carries {x, y, alpha:0.5} from the drag + slider', !!stored && stored.alpha === 0.5 && Math.abs(stored.x - pBefore.left) <= 1 && Math.abs(stored.y - pBefore.top) <= 1, stored);
check('P1 reopening via "Display Liturgy Text" succeeds', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(300);
ps = await panelState();
check('P1 the reopened panel stands at the stored position (within 1px) with slider 0.5 and a 50% background', ps.panel && Math.abs(ps.left - pBefore.left) <= 1 && Math.abs(ps.top - pBefore.top) <= 1 && ps.slider === '0.5' && ps.bg.includes('50%'), ps);

// ---------- C1 (Praylist teardown) ----------
const c1Stood = (await panelState()).panel;
await pg.evaluate(() => { finishVideoHandoff656(false); });
await pg.waitForTimeout(60);
ps = await panelState();
check('C1 finishVideoHandoff656 removes the popup with its video', c1Stood && !ps.panel);

// ---------- O2: Worship Virtual Mass surface ----------
await resetWorld();
await pg.evaluate(() => {
  massPodReturn = true;
  state.podcasts = { title: 'CatholicTV', series: 'catholictv' };
  state.tab = 'prayers'; // closeWatch's repaint branches stay out of this leg; the popup close at its head is the act under test
  openPodWatch({ id: 'VID702', title: 'Catholic Mass Today | Friday November 27, 2026 | CatholicTV Daily Mass', dateLabel: 'Friday, November 27, 2026' });
});
await pg.waitForTimeout(200);
await pg.evaluate(() => { window.__fetches = []; });
const rowsO2 = await openDockMenuRows();
check('O2 the dock ⋯ menu carries "Display Liturgy Text" while the Worship Virtual Mass watch stands', rowsO2.includes('Display Liturgy Text'), rowsO2);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });
check('O2 tapping "Display Liturgy Text" opens the popup over the Virtual Mass video', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(400);
ps = await panelState();
const fetchesO2 = await pg.evaluate(() => window.__fetches.slice());
// O2 paint assertions re-pointed per v704 §2.6, same
// shape as O1: the citation stands inside the
// entire-liturgy body on this surface too.
check('O2 the popup paints for 2026-11-27 with the fixture citations, via one mass-readings fetch', ps.panel && ps.date === '2026-11-27' && ps.bodyText.includes('Luke 21:29-33') && fetchesO2.filter((u) => u.includes('/api/prayer/mass-readings') && u.includes('date=2026-11-27')).length === 1, { ps: ps.date, fetchesO2 });
// ---------- C1 (Virtual Mass teardown) ----------
const c1StoodB = (await panelState()).panel;
await pg.evaluate(() => { closeWatch(); });
await pg.waitForTimeout(60);
ps = await panelState();
check('C1 closeWatch removes the popup with its video', c1StoodB && !ps.panel);

// ---------- N1: honest empty (2026-11-26 fixture) ----------
await resetWorld();
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, MASS_DESC_26);
await pg.waitForTimeout(200);
check('N1 the menu item stands for the Nov 26 Mass video', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(400);
ps = await panelState();
// N1 assertion re-pointed per v704 §2.6: the line stands
// AT THE READINGS PLACE with the liturgy around it (the
// "alone in the body" form was the readings-only
// prescription). N1's discipline is unmodified: no
// citation, no other day's readings text.
check('N1 the body paints "Readings not available for this day." at the readings place (after "Liturgy of the Word", before "The Universal Prayer"), the liturgy around it — no citation, no Nov 27 readings text', ps.panel && ps.bodyText.indexOf('Readings not available for this day.') > ps.bodyText.indexOf('Liturgy of the Word') && ps.bodyText.indexOf('Readings not available for this day.') < ps.bodyText.indexOf('The Universal Prayer') && ps.bodyText.includes('Stir up the will of your faithful') && !ps.bodyText.includes('Luke 21:29-33') && !ps.bodyText.includes('Revelation 20:1-4'), ps.bodyText.slice(0, 200));
await pg.evaluate(() => { finishVideoHandoff656(false); });

// ---------- A1: the item does not stand off the Mass surfaces ----------
await resetWorld();
await pg.evaluate((d) => { state.current = d; updateDock(); }, AUDIO_DESC);
let rowsA = await openDockMenuRows();
check('A1 no "Display Liturgy Text" item while an audio track is the playing item', !rowsA.includes('Display Liturgy Text'), rowsA);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });

await resetWorld();
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, SAINTS_DESC);
await pg.waitForTimeout(200);
rowsA = await openDockMenuRows();
check('A1 no "Display Liturgy Text" item for a non-Mass Praylist video (Catholic Saints)', !rowsA.includes('Display Liturgy Text'), rowsA);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); finishVideoHandoff656(false); });

await resetWorld();
await pg.evaluate(() => {
  adorationWatch = { video: 'LIVE702', title: 'Perpetual Adoration', meta: 'Chapel' };
  paintMassAdorationWatch();
});
await pg.waitForTimeout(100);
rowsA = await openDockMenuRows();
check('A1 no "Display Liturgy Text" item while the Adoration watch stands', !rowsA.includes('Display Liturgy Text'), rowsA);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });

console.log('\nharness-v702: ' + ok + ' ok, ' + bad + ' bad');
await b.close();
server.close();
process.exit(bad ? 1 : 0);
