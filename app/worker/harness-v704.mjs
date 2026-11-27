// harness-v704.mjs — v704: the Liturgy popup carries the
// ENTIRE LITURGY of the playing item's day (doc §2.5): the
// v702 popup's body becomes the Worship Mass scroll's
// composition (paintMassScroll's order and renderers),
// composed under the snapshot/swap/synchronous-compose/
// strip/restore shape, minus John's two exclusions — no
// homily-recording element, no custom-editing affordances
// (the Universal Prayer stands read-only).
//
// Chromium (playwright-core) harness, the v702 harness
// mold: the REAL built Worker bundle served locally, the
// API stubbed, real acts, same-tick DOM assertions;
// ORA_WT selects the tree for the fail-on-old run.
//
// Fixtures (Improvement D — production sources named),
// read from the committed files, never re-typed:
//  - fixtures/mass-2026-11-27.json — the real Mass payload
//    for 2026-11-27 (massPayload run at Plan, doc §1.8):
//    inCalendar:true, season 'Ordinary Time', one ferial
//    version whose formulary carries collect +
//    entranceAntiphon.text and NO prefaceText.
//  - fixtures/mass-readings-2026-11-27.json — found:true,
//    4 parts, copyright[1] (the v702 fixture).
//  - fixtures/mass-readings-2026-11-26.json — found:true,
//    parts:[] (the readings honest-empty day; its
//    copyright[] line stands in the file — see N2/R4).
// The Universal Prayer route needs no captured fixture:
// its empty-day answer is {ok:true, date, intentions:[]}
// by construction. The U2 leg's one-intention stub list
// ('For a test intention.') is TEST DATA for the read-only
// paint, labeled as such — it is not a captured fixture.
//
// Legs: F fixture shape + pin · L1 entire liturgy in
// scroll order on the Praylist surface (exactly the three
// §1.2 fetches, no other /api/ fetch, no Universalis
// request) · L2 day-flag honesty (no Gloria, no Creed on
// the ferial fixture; Common Preface fallback) · L3 the
// Virtual Mass surface · X1 homily exclusion by name ·
// X2 editing exclusion by name + no button in the body +
// a body click changes nothing and fetches nothing ·
// U2 a stored Universal intention paints read-only ·
// D1 the date rule (all three fetches carry the title's
// other date) · N1 whole-day honest empty (the one line
// alone) · N2 readings honest empty at its place inside a
// standing liturgy (its .mass-ack absence leg carries the
// Plan's R4 caveat — see doc §3) · S9 state isolation
// (sentinel state.mass reference equality, globals, view,
// iframe untouched; no scroll host IDs anywhere) · M the
// v702 mechanics legs unmodified in substance (drag+clamp
// · slider background-only · persistence · elementFromPoint
// reachability · teardown closes · door absent off the
// Mass surfaces).
//
// Fail-on-old split (base 50542b5, stated per doc §2.5):
// F's pin leg, L1, L2, L3, U2, D1's fetch-set half, N1, N2
// and X1/X2's popup-stands preconditions FAIL on base (the
// base popup paints readings only: no Collect, no Order
// text, no Universal Prayer, and /api/prayer/mass is never
// fetched); S9's popup half fails; M's mechanics legs PASS
// on base where they passed for v702 (standing v702
// behavior).
//
// Run: node app/worker/harness-v704.mjs
//      ORA_WT=/path/to/old-tree node /path/to/harness-v704.mjs
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
const MASS27 = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'mass-2026-11-27.json'), 'utf8'));
const FIX27 = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'mass-readings-2026-11-27.json'), 'utf8'));
const FIX26 = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'mass-readings-2026-11-26.json'), 'utf8'));
const MF = MASS27.versions[0].formulary;
check('F mass fixture: inCalendar:true, season Ordinary Time, one ferial version', MASS27.inCalendar === true && MASS27.season === 'Ordinary Time' && MASS27.versions.length === 1 && MASS27.versions[0].key === 'ferial' && MASS27.versions[0].rank === 'ferial');
check('F mass fixture formulary carries collect + entranceAntiphon.text and NO prefaceText', !!MF.collect && !!(MF.entranceAntiphon && MF.entranceAntiphon.text) && !MF.prefaceText, Object.keys(MF));
check('F 2026-11-27 readings fixture: found:true, 4 parts incl. a Gospel part, non-empty copyright[]', FIX27.found === true && FIX27.parts.length === 4 && FIX27.parts.some((p) => p.key === 'g') && (FIX27.copyright || []).length === 1);
check('F 2026-11-26 readings fixture: found:true with parts:[] (the honest-empty day shape)', FIX26.found === true && Array.isArray(FIX26.parts) && FIX26.parts.length === 0);

// ---------- descriptors (resolveMassDynamic688's shape, as harness-v702) ----------
const MASS_TITLE = 'Catholic Mass Today | Friday November 27, 2026 | CatholicTV Daily Mass';
function massDesc(title) {
  return {
    episodeId: 'yt:VID704', kind: 'video', videoId: 'VID704', vmSeries: 'catholictv',
    title: title || MASS_TITLE, url: null, enclosureUrl: null,
    available: true, block: 'Midday', durationS: 0, imageUrl: null,
    descText: null, dateLabel: '', listened: false,
    source: 'Catholic TV Mass', stale: false, mass688: true, massSeries: 'catholictv',
  };
}
const MASS_DESC_25 = massDesc('Catholic Mass Today | Wednesday November 25, 2026 | CatholicTV Daily Mass');
const SAINTS_DESC = {
  episodeId: 'yt:SAINT1', kind: 'video', videoId: 'SAINT1', vmSeries: 'catholicsaints',
  title: 'Saint of the Day Video', url: null, enclosureUrl: null,
  available: true, block: 'Morning', durationS: 0, imageUrl: null,
  descText: null, dateLabel: '', listened: false, source: 'Catholic Saints & Feasts', stale: false,
};
const AUDIO_DESC = { episodeId: 'audio-1', kind: 'podcast', title: 'Some Audio Track', available: true, block: 'Morning', durationS: 300, url: 'https://example.invalid/a.mp3' };

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v704harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries the v704 release pin ora-pro-nobis-v704-1', /ora-pro-nobis-v704-1/.test(SWJS), 'pin not in served /sw.js');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const extReqs = [];
pg.on('request', (r) => { const u = r.url(); if (u.includes('universalis.com')) extReqs.push(u); });
await pg.addInitScript((payloads) => {
  window.__fetches = [];
  window.__payloads = payloads.readings;
  window.__massFixture = payloads.mass;
  // Leg controls: mass: 'fixture' | 'nocal' · readings:
  // 'bydate' | 'anydate' | 'fix26' · universal: intentions[]
  window.__ctl = { mass: 'fixture', readings: 'bydate', universal: [] };
  const respJson = (obj) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)) });
  window.fetch = (url) => {
    const u = String(url);
    window.__fetches.push(u);
    const dm = /[?&]date=([0-9-]+)/.exec(u);
    const date = dm ? dm[1] : '';
    if (u.includes('/api/prayer/mass-readings')) {
      if (window.__ctl.readings === 'fix26') return respJson(window.__payloads['2026-11-26']);
      if (window.__ctl.readings === 'anydate') return respJson(window.__payloads['2026-11-27']);
      const p = window.__payloads[date];
      return respJson(p || { date, found: false, parts: [], copyright: [] });
    }
    if (u.includes('/api/prayer/mass-universal-prayer')) {
      return respJson({ ok: true, date, intentions: window.__ctl.universal.slice() });
    }
    if (/\/api\/prayer\/mass\?/.test(u)) {
      if (window.__ctl.mass === 'nocal') return respJson({ date, name: date, defaultVersion: null, versions: [], inCalendar: false });
      return respJson(window.__massFixture);
    }
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
    state.mass = null; massFeed = null; massReadings = null; massUsedFallback = false;
    window.__fetches = [];
    window.__ctl = { mass: 'fixture', readings: 'bydate', universal: [] };
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
    if (!p) return { panel: false, date: null, left: -1, top: -1, right: -1, bottom: -1, bodyText: '', acks: [], slider: null, bg: '', panelOpacity: '', bodyOpacity: '', headText: '', headings: [], bodyButtons: -1 };
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
      headings: body ? Array.from(body.querySelectorAll('.mass-h')).map((e) => e.textContent) : [],
      bodyButtons: body ? body.querySelectorAll('button').length : -1,
    };
  });
}
function exclusionState() {
  return pg.evaluate(() => {
    const body = document.querySelector('#litpop702 .litpop702-body');
    if (!body) return { panel: false };
    const n = (sel) => body.querySelectorAll(sel).length;
    return {
      panel: true,
      homilyHost: n('#mass-homily-host'), homilyCard: n('.homily-rec-card'),
      homilyRec: n('#mass-homily-rec'), homilyStop: n('#mass-homily-stop'),
      homilyNoteField: n('#mass-homily-note-field'), homilyNoteSave: n('#mass-homily-note-save'), homilyNoteEdit: n('#mass-homily-note-edit'),
      version: n('[data-version]'), tsize: n('[data-tsize]'), pen: n('[data-pen]'), ep: n('[data-ep]'), lt: n('[data-lt]'),
      rchoice: n('[data-rchoice]'), rset: n('[data-rset]'),
      upEditBtn: n('#mass-universal-edit-btn'), muup: n('[data-muup]'), mudown: n('[data-mudown]'), muremove: n('[data-muremove]'),
      mutext: n('[data-mutext]'), muedsave: n('[data-muedsave]'), muaddpool: n('[data-muaddpool]'), muaddfree: n('[data-muaddfree]'),
      muInput: n('.mu-input'), personalBtns: n('#mass-personal-premass-btn, #mass-personal-before-btn, #mass-personal-after-btn, #mass-personal-aftermass-btn'),
      mpremove: n('[data-mpremove]'), mpup: n('[data-mpup]'), mpdown: n('[data-mpdown]'),
      buttons: body.querySelectorAll('button').length,
      text: body.textContent,
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
function strictlyIncreasing(text, markers) {
  let prev = -1;
  for (const m of markers) {
    const i = text.indexOf(m);
    if (i < 0 || i <= prev) return { ok: false, at: m, idx: i, prev };
    prev = i;
  }
  return { ok: true };
}
const ICEL = 'The English translation of The Roman Missal';

// ---------- L1: entire liturgy, Praylist surface ----------
await resetWorld();
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, massDesc());
await pg.waitForTimeout(200);
await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  window.__frame704 = f; window.__frameSrc704 = f ? f.getAttribute('src') : null;
  window.__fetches = [];
});
const rowsL1 = await openDockMenuRows();
check('L1 the dock ⋯ menu carries "Display Liturgy Text" while a Mass video plays on the Praylist surface', rowsL1.includes('Display Liturgy Text'), rowsL1);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });
extReqs.length = 0; // the Universalis leg measures the popup act's own window, not app-boot traffic
check('L1 tapping "Display Liturgy Text" succeeds', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(500);
let ps = await panelState();
check('L1 the popup stands, date = the title date 2026-11-27, head day line takes the Mass payload name', ps.panel && ps.date === '2026-11-27' && ps.headText.includes('Friday in the 34'), ps.headText);
const fetchesL1 = await pg.evaluate(() => window.__fetches.slice());
const apiFetches = fetchesL1.filter((u) => u.includes('/api/'));
check('L1 exactly the three §1.2 fetches, each date=2026-11-27, and no other /api/ fetch', apiFetches.length === 3
  && apiFetches.filter((u) => /\/api\/prayer\/mass\?date=2026-11-27/.test(u)).length === 1
  && apiFetches.filter((u) => u.includes('/api/prayer/mass-readings?date=2026-11-27')).length === 1
  && apiFetches.filter((u) => u.includes('/api/prayer/mass-universal-prayer?date=2026-11-27')).length === 1, fetchesL1);
check('L1 no Universalis request was issued', extReqs.length === 0, extReqs);
const ORDER_MARKERS = [
  ICEL,
  'Friday in the 34ᵗʰ Week in Ordinary Time',
  'Entrance Antiphon', 'The Lord speaks of peace',
  'And with your spirit',
  'Collect', 'Stir up the will of your faithful',
  'Liturgy of the Word',
  'Revelation 20:1-4, 11—21:2', 'Luke 21:29-33',
  'The Universal Prayer', 'For the Holy Father, Pope Leo XIV.', 'We pray also for the intentions of the Universal Prayer as published locally in this parish', 'No private intentions added for today',
  'Liturgy of the Eucharist', 'Prayer over the Offerings',
  'You are indeed Holy, O Lord',
  'The Lord’s Prayer', 'Our Father, who art in heaven',
  'Communion Antiphon', 'Prayer after Communion', 'Concluding Rites',
  FIX27.copyright[0].slice(0, 60),
];
const ord = strictlyIncreasing(ps.bodyText, ORDER_MARKERS);
check('L1 the entire liturgy paints in the scroll composition order (ICEL → day name → Entrance Antiphon → Order line → Collect → Liturgy of the Word → readings → Universal Prayer → Liturgy of the Eucharist → EP II → Lord\u2019s Prayer → Communion Antiphon → Prayer after Communion → Concluding Rites → ack)', ord.ok, ord);
check('L1 the ICEL notice stands twice (head and tail) and the tail stands after the ack line', ps.bodyText.split(ICEL).length - 1 === 2 && ps.bodyText.lastIndexOf(ICEL) > ps.bodyText.indexOf(FIX27.copyright[0].slice(0, 60)));
check('L1 the readings copyright[] line paints as .mass-ack', ps.acks.length === 1 && ps.acks[0] === FIX27.copyright[0], ps.acks);

// ---------- L2: day-flag honesty on the ferial fixture ----------
check('L2 no Gloria part and no Creed part stands on the ferial fixture day (correct omission)', ps.panel && !ps.headings.includes('Gloria') && !ps.headings.includes('Creed'), ps.headings);
const cp = await pg.evaluate(() => ({ line: MASS_ORDER.commonPreface1[0], body: document.querySelector('#litpop702 .litpop702-body').textContent }));
check('L2 the Preface head stands with the Common Preface fallback text (the fixture carries no prefaceText)', ps.headings.includes('Preface') && cp.body.includes(cp.line), cp.line);

// ---------- X1 / X2: the two exclusions, by name ----------
let xs = await exclusionState();
check('X1 homily exclusion: no #mass-homily-host, no .homily-rec-card, no rec/stop/note elements, no "Record the homily" text', xs.panel && xs.homilyHost === 0 && xs.homilyCard === 0 && xs.homilyRec === 0 && xs.homilyStop === 0 && xs.homilyNoteField === 0 && xs.homilyNoteSave === 0 && xs.homilyNoteEdit === 0 && !xs.text.includes('Record the homily'), xs);
check('X2 editing exclusion: no version/tsize/pen/ep/lt/rchoice/rset controls, no Universal editor, no personal-seat acts', xs.panel && xs.version === 0 && xs.tsize === 0 && xs.pen === 0 && xs.ep === 0 && xs.lt === 0 && xs.rchoice === 0 && xs.rset === 0 && xs.upEditBtn === 0 && xs.muup === 0 && xs.mudown === 0 && xs.muremove === 0 && xs.mutext === 0 && xs.muedsave === 0 && xs.muaddpool === 0 && xs.muaddfree === 0 && xs.muInput === 0 && xs.personalBtns === 0 && xs.mpremove === 0 && xs.mpup === 0 && xs.mpdown === 0, xs);
check('X2 no button element of any kind inside the popup body', xs.panel && xs.buttons === 0, xs.buttons);
const x2before = await pg.evaluate(() => ({ n: window.__fetches.length, text: document.querySelector('#litpop702 .litpop702-body').textContent }));
await pg.evaluate(() => {
  const hs = Array.from(document.querySelectorAll('#litpop702 .litpop702-body .mass-h'));
  const ep = hs.find((e) => e.textContent === 'Eucharistic Prayer') || hs[0];
  if (ep) ep.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await pg.waitForTimeout(120);
const x2after = await pg.evaluate(() => ({ n: window.__fetches.length, text: document.querySelector('#litpop702 .litpop702-body').textContent }));
check('X2 a click inside the body changes nothing and issues no fetch (nothing is wired)', x2before.text === x2after.text && x2before.n === x2after.n, { b: x2before.n, a: x2after.n });

// ---------- U2: a stored Universal intention, read-only ----------
await pg.evaluate(() => {
  closeLiturgyPopup702();
  window.__ctl.universal = ['For a test intention.']; // TEST DATA (harness header) — the read-only paint leg
  window.__fetches = [];
});
check('U2 reopening succeeds with the universal stub restubbed', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(500);
ps = await panelState();
check('U2 the stored intention paints as a .mass-line followed by "Lord, hear our prayer." and the empty line does NOT stand', ps.panel && ps.bodyText.includes('For a test intention.') && ps.bodyText.indexOf('Lord, hear our prayer.', ps.bodyText.indexOf('For a test intention.')) > ps.bodyText.indexOf('For a test intention.') && !ps.bodyText.includes('No private intentions added for today'), ps.bodyText.slice(ps.bodyText.indexOf('The Universal Prayer'), ps.bodyText.indexOf('The Universal Prayer') + 500));
xs = await exclusionState();
check('U2 X2\u2019s editor absences still hold with a stored intention standing', xs.panel && xs.upEditBtn === 0 && xs.muup === 0 && xs.muremove === 0 && xs.muInput === 0 && xs.buttons === 0, xs);
await pg.evaluate(() => { finishVideoHandoff656(false); });

// ---------- D1: the date rule ----------
await resetWorld();
await pg.evaluate(() => { window.__ctl.readings = 'anydate'; });
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, MASS_DESC_25);
await pg.waitForTimeout(200);
await pg.evaluate(() => { window.__fetches = []; });
check('D1 the menu item stands for the Nov 25 Mass video', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(500);
ps = await panelState();
const fetchesD1 = await pg.evaluate(() => window.__fetches.slice());
const apiD1 = fetchesD1.filter((u) => u.includes('/api/'));
check('D1 all three fetches carry date=2026-11-25, none carries 2026-11-27, and the panel date is 2026-11-25', ps.panel && ps.date === '2026-11-25' && apiD1.length === 3 && apiD1.every((u) => u.includes('date=2026-11-25')) && !apiD1.some((u) => u.includes('2026-11-27')), apiD1);
await pg.evaluate(() => { finishVideoHandoff656(false); });

// ---------- N1: whole-day honest empty ----------
await resetWorld();
await pg.evaluate(() => { window.__ctl.mass = 'nocal'; });
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, massDesc());
await pg.waitForTimeout(200);
check('N1 the menu item stands', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(500);
ps = await panelState();
check('N1 the body paints "The day\u2019s Mass could not be loaded." alone — no Collect, no readings citation, no other part', ps.panel && ps.bodyText.trim().replace(/’/g, "'") === "The day's Mass could not be loaded." && !ps.bodyText.includes('Collect') && !ps.bodyText.includes('Luke 21:29-33'), ps.bodyText.slice(0, 200));
await pg.evaluate(() => { finishVideoHandoff656(false); });

// ---------- N2: readings honest empty inside a standing liturgy ----------
await resetWorld();
await pg.evaluate(() => { window.__ctl.readings = 'fix26'; });
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, massDesc());
await pg.waitForTimeout(200);
check('N2 the menu item stands', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(500);
ps = await panelState();
const n2line = ps.bodyText.indexOf('Readings not available for this day.');
check('N2 the readings line stands at the readings place (after "Liturgy of the Word", before "The Universal Prayer") and the rest of the liturgy still stands (Collect · EP II · Prayer after Communion)', ps.panel && n2line > ps.bodyText.indexOf('Liturgy of the Word') && n2line < ps.bodyText.indexOf('The Universal Prayer') && ps.bodyText.includes('Stir up the will of your faithful') && ps.bodyText.includes('You are indeed Holy, O Lord') && ps.bodyText.includes('Prayer after Communion'), ps.bodyText.slice(0, 200));
// R4 (doc §2.7): massAcksHtml reads the swapped massFeed —
// the empty fixture carries a copyright[] line. The leg
// asserts its absence per the v702 N1 discipline; if the
// standing code paints it, §3 records the named deviation.
check('N2 no .mass-ack from the readings fixture stands on the not-available arm (R4 leg)', ps.panel && ps.acks.length === 0, ps.acks);
await pg.evaluate(() => { finishVideoHandoff656(false); });

// ---------- S9: state isolation (the load-bearing leg) ----------
await resetWorld();
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, massDesc());
await pg.waitForTimeout(200);
await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  window.__frame704 = f; window.__frameSrc704 = f ? f.getAttribute('src') : null;
  state.mass = { date: '2020-01-01', payload: { name: 'SENTINEL DAY', versions: [], season: 'Lent' }, version: 'sentinelver', ep: 'IV', penform: 'C', latin: { kyrie: 'la' }, rchoices: { sentinel: 1 }, textSize: 3, dateLabel: 'Jan 1', personal: undefined, personalLang: {}, universal: { date: '2020-01-01', intentions: ['SENTINEL INTENTION'] }, universalOpen: false, universalEditIdx: -1 };
  window.__sentMass = state.mass;
  massFeed = { found: true, sentinelFeed: true, parts: [], copyright: ['SENTINEL COPYRIGHT'] };
  massReadings = { sentinelReadings: true };
  massUsedFallback = true;
  view.insertAdjacentHTML('beforeend', '<div id="sentinel-view704">SENTINEL VIEW</div>');
  window.__fetches = [];
});
check('S9 the menu item stands with sentinel state standing', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(500);
ps = await panelState();
const s9 = await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  const ids = ['mass-readings', 'mass-ep', 'mass-acks', 'mass-universal-section', 'mass-personal-premass', 'mass-epbody'];
  return {
    refEq: state.mass === window.__sentMass,
    version: state.mass && state.mass.version, ep: state.mass && state.mass.ep, penform: state.mass && state.mass.penform,
    universal: state.mass && state.mass.universal && state.mass.universal.intentions,
    feedSentinel: !!(massFeed && massFeed.sentinelFeed), readingsSentinel: !!(massReadings && massReadings.sentinelReadings), fb: massUsedFallback,
    sentinelView: !!document.getElementById('sentinel-view704'),
    frameSame: f === window.__frame704, frameSrc: f && f.getAttribute('src') === window.__frameSrc704,
    hostIds: ids.filter((id) => document.getElementById(id)),
  };
});
check('S9 the popup painted the entire liturgy under sentinel state (Collect stands, sentinel intention does NOT)', ps.panel && ps.bodyText.includes('Stir up the will of your faithful') && !ps.bodyText.includes('SENTINEL INTENTION') && !ps.bodyText.includes('SENTINEL COPYRIGHT'), ps.bodyText.slice(0, 120));
check('S9 state.mass is the identical sentinel object, fields untouched, after the popup paints', s9.refEq && s9.version === 'sentinelver' && s9.ep === 'IV' && s9.penform === 'C' && JSON.stringify(s9.universal) === JSON.stringify(['SENTINEL INTENTION']), s9);
check('S9 massFeed / massReadings / massUsedFallback hold their sentinel values after the paint', s9.feedSentinel && s9.readingsSentinel && s9.fb === true, s9);
check('S9 the sentinel view content and the watch iframe (node + src) stand unchanged', s9.sentinelView && s9.frameSame && s9.frameSrc, s9);
check('S9 no element with a scroll host ID stands anywhere in the document', s9.hostIds.length === 0, s9.hostIds);
await pg.evaluate(() => { finishVideoHandoff656(false); });

// ---------- L3: Virtual Mass surface ----------
await resetWorld();
await pg.evaluate(() => {
  massPodReturn = true;
  state.podcasts = { title: 'CatholicTV', series: 'catholictv' };
  state.tab = 'prayers';
  openPodWatch({ id: 'VID704', title: 'Catholic Mass Today | Friday November 27, 2026 | CatholicTV Daily Mass', dateLabel: 'Friday, November 27, 2026' });
});
await pg.waitForTimeout(200);
await pg.evaluate(() => { window.__fetches = []; });
const rowsL3 = await openDockMenuRows();
check('L3 the dock ⋯ menu carries "Display Liturgy Text" while the Worship Virtual Mass watch stands', rowsL3.includes('Display Liturgy Text'), rowsL3);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });
check('L3 tapping "Display Liturgy Text" opens the popup over the Virtual Mass video', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(500);
ps = await panelState();
const fetchesL3 = await pg.evaluate(() => window.__fetches.slice());
const apiL3 = fetchesL3.filter((u) => u.includes('/api/'));
check('L3 the entire liturgy paints on the Virtual Mass surface (Collect · readings citation · Universal Prayer standing parts · EP II line) via the same three fetches for the title\u2019s date', ps.panel && ps.date === '2026-11-27' && ps.bodyText.includes('Stir up the will of your faithful') && ps.bodyText.includes('Luke 21:29-33') && ps.bodyText.includes('For the Holy Father, Pope Leo XIV.') && ps.bodyText.includes('You are indeed Holy, O Lord') && apiL3.length === 3 && apiL3.every((u) => u.includes('date=2026-11-27')), { date: ps.date, apiL3 });
const c1StoodL3 = ps.panel;
await pg.evaluate(() => { closeWatch(); });
await pg.waitForTimeout(60);
ps = await panelState();
check('M closeWatch removes the popup with its video (v702 C1)', c1StoodL3 && !ps.panel);

// ---------- M: v702 mechanics, unmodified in substance ----------
await resetWorld();
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, massDesc());
await pg.waitForTimeout(200);
await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  window.__frame704 = f; window.__frameSrc704 = f ? f.getAttribute('src') : null;
  window.__fetches = [];
});
check('M tapping "Display Liturgy Text" succeeds (v702 O1 door)', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(500);
const v1a = await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  return { same: f === window.__frame704, srcSame: f && f.getAttribute('src') === window.__frameSrc704, handoffTitle: videoHandoff656 && videoHandoff656.desc.title };
});
check('M the frame element + src stand unchanged with the popup open; the hand-off record stands (v702 V1)', v1a.same && v1a.srcSame && v1a.handoffTitle === MASS_TITLE, v1a);
const before = await panelState();
await dragHead(0, 150);
let after = await panelState();
check('M a head drag moves the panel by the drag delta (v702 D1)', after.panel && Math.abs(after.top - (before.top + 150)) <= 1 && Math.abs(after.left - before.left) <= 1, { before: [before.left, before.top], after: [after.left, after.top] });
await dragHead(3000, 3000);
after = await panelState();
check('M an oversize drag ends clamped — panel fully inside the viewport (v702 D1)', after.panel && after.left >= 0 && after.top >= 0 && after.right <= 390.5 && after.bottom <= 844.5, after);
await dragHead(-3000, -3000);
after = await panelState();
check('M an oversize drag the other way clamps to the top-left corner (v702 D1)', after.panel && Math.abs(after.left) <= 1 && Math.abs(after.top) <= 1, after);
await dragHead(3000, 3000);
const v1b = await pg.evaluate(() => {
  const f = document.querySelector('iframe.podwatch-frame');
  if (!f) return { hit: 'no-frame' };
  const r = f.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { hit: el === f ? 'frame' : (el ? el.className + '/' + el.tagName : 'none'), same: f === window.__frame704 };
});
check('M with the popup open and parked in a corner, elementFromPoint at the frame center returns the iframe itself (v702 V1)', v1b.hit === 'frame' && v1b.same, v1b);
ps = await panelState();
check('M the default alpha 0.88 is applied on first open (v702 S1)', ps.bg.includes('88%'), ps.bg);
await setSlider('0.35');
ps = await panelState();
check('M at 0.35 the panel inline background carries 35% (v702 S1)', ps.bg.includes('35%'), ps.bg);
await setSlider('1');
ps = await panelState();
check('M at 1.00 the panel inline background carries 100% (v702 S1)', ps.bg.includes('100%'), ps.bg);
check('M background-only: no opacity is ever set on the panel or the body (v702 S1)', ps.panel && ps.panelOpacity === '' && ps.bodyOpacity === '', ps);
await setSlider('0.5');
const pBefore = await panelState();
await pg.evaluate(() => { const c = document.querySelector('[data-litpop702-close]'); if (c) c.click(); });
await pg.waitForTimeout(60);
ps = await panelState();
const stored = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('opn-litpop-v702') || 'null'); } catch (e) { return null; } });
check('M the Close button removes the panel (v702 P1)', pBefore.panel && !ps.panel);
check('M localStorage opn-litpop-v702 carries {x, y, alpha:0.5} from the drag + slider (v702 P1)', !!stored && stored.alpha === 0.5 && Math.abs(stored.x - pBefore.left) <= 1 && Math.abs(stored.y - pBefore.top) <= 1, stored);
check('M reopening via "Display Liturgy Text" succeeds (v702 P1)', await tapDockMenuItem('Display Liturgy Text'));
await pg.waitForTimeout(400);
ps = await panelState();
check('M the reopened panel stands at the stored position (within 1px) with slider 0.5 and a 50% background (v702 P1)', ps.panel && Math.abs(ps.left - pBefore.left) <= 1 && Math.abs(ps.top - pBefore.top) <= 1 && ps.slider === '0.5' && ps.bg.includes('50%'), ps);
const c1Stood = ps.panel;
await pg.evaluate(() => { finishVideoHandoff656(false); });
await pg.waitForTimeout(60);
ps = await panelState();
check('M finishVideoHandoff656 removes the popup with its video (v702 C1)', c1Stood && !ps.panel);

// ---------- M/A1: the item does not stand off the Mass surfaces ----------
await resetWorld();
await pg.evaluate((d) => { state.current = d; updateDock(); }, AUDIO_DESC);
let rowsA = await openDockMenuRows();
check('M no "Display Liturgy Text" item while an audio track is the playing item (v702 A1)', !rowsA.includes('Display Liturgy Text'), rowsA);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });
await resetWorld();
await pg.evaluate((d) => { state.queue = [d]; state.queueIdx = 0; openVideoHandoff656(d); }, SAINTS_DESC);
await pg.waitForTimeout(200);
rowsA = await openDockMenuRows();
check('M no "Display Liturgy Text" item for a non-Mass Praylist video (Catholic Saints) (v702 A1)', !rowsA.includes('Display Liturgy Text'), rowsA);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); finishVideoHandoff656(false); });
await resetWorld();
await pg.evaluate(() => {
  adorationWatch = { video: 'LIVE704', title: 'Perpetual Adoration', meta: 'Chapel' };
  paintMassAdorationWatch();
});
await pg.waitForTimeout(100);
rowsA = await openDockMenuRows();
check('M no "Display Liturgy Text" item while the Adoration watch stands (v702 A1)', !rowsA.includes('Display Liturgy Text'), rowsA);
await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });

console.log('\nharness-v704: ' + ok + ' ok, ' + bad + ' bad');
await b.close();
server.close();
process.exit(bad ? 1 : 0);
