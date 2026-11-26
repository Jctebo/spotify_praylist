// harness-v693.mjs — v693: gold dynamic card contrast.
// The shared gold-card class .p666daily pinned a light
// fill (#f6ecd3) and NO text color, so its text borrowed
// the mode tokens: in dark mode the title read #f5f5f5 on
// the pale gold fill (1.08:1, near-invisible — John's
// field screenshot). The fix makes the class own its
// text: color:#2a2620 on the card rule + scoped .sub /
// .meta rules at #6d6353 — literals, NOT var(--ink) /
// var(--muted), so the pairing holds in both modes.
//
// Chromium (playwright-core) harness, on the pattern of
// harness-v669.mjs / harness-v668.mjs: the REAL built
// Worker bundle (esbuild from source) served locally, the
// API stubbed with production-shaped fixtures, the Add
// ladder opened through the real openAddLadder603, mode
// set through the standing device store (opn-mode-v669),
// computed styles measured in a real browser (the proof
// is a cascade claim: specificity + inheritance + the
// mode attribute).
//
// Fixtures (Improvement D — production sources, named):
//  - app/tests/fixtures-v656/catholictv.json — the LIVE
//    production Virtual Mass payload (the screenshot's
//    own series), as harness-v688.
//  - app/tests/fixtures-v603/podcasts-index.json (the
//    captured podcasts index) PLUS the saint entry
//    (harness-v665/v666/v668: kind rss, total 299) and
//    the catholicsaints entry (kind video, total 15).
//  - app/tests/fixtures-v603/book.json · bible-folded.json
//  - app/tests/fixtures-v614/novenas-catalog.json
//  - app/worker/v666-fixtures/production-heads.json (live
//    feed heads captured 2026-11-25) — the saint payload
//    stands on the real head entry's shape (the v668
//    recipe: the real head + generated same-shape rows).
//
// Legs (Plan §2.4):
//  C1 dark Mass card: per-element computed contrast
//     (title/sub/tag) >= 4.5:1 on the computed fill AND
//     the computed colors equal the §2.3 literals.
//  C2 light Mass card: the same assertions, identical
//     readings.
//  C3 the v666 saint "Add daily" card: the same three
//     assertions in dark AND light (the shared class on
//     its second builder).
//  C4 gold signal: fill rgb(246,236,211) + border
//     rgb(168,134,58) in both modes; the card stands at
//     the head of its node.
//  C5 the served CSS carries the amended rule + the two
//     scoped rules; no [data-mode="dark"]-scoped
//     p666daily rule stands.
//  S  390x844 Add-sheet screenshots, dark + light, the
//     gold Mass card standing ->
//     docs/releases/v693-screenshots/.
//
// Run: node app/worker/harness-v693.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const APP = path.join(WT, 'app');
const SHOTS = path.join(WT, 'docs/releases/v693-screenshots');
mkdirSync(SHOTS, { recursive: true });
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}
// WCAG luminance / contrast (the standing harness-v669 math).
function parseColor(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = s.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); if (p.length === 4 && p[3] === 0) return null; return p.slice(0, 3); }
  return null;
}
function lum(rgb) {
  const f = (c) => { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrast(a, b) {
  const ca = parseColor(a), cb = parseColor(b);
  if (!ca || !cb) return 0;
  const la = lum(ca), lb = lum(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const r2 = (n) => Math.round(n * 100) / 100;

// ---------- fixtures ----------
const HEADS = JSON.parse(readFileSync(path.join(W, 'v666-fixtures/production-heads.json'), 'utf8'));
const INDEX = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/podcasts-index.json'), 'utf8'));
if (!INDEX.seriesList.some((s) => s.series === 'saint-of-the-day')) INDEX.seriesList.push({ series: 'saint-of-the-day', kind: 'rss', category: 'podcasts', title: 'The Saint of The Day Podcast', available: true, total: 299 });
if (!INDEX.seriesList.some((s) => s.series === 'catholicsaints')) INDEX.seriesList.push({ series: 'catholicsaints', kind: 'video', category: 'podcasts', title: 'Catholic Saints & Feasts', available: true, total: 15 });
const BOOK = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/book.json'), 'utf8'));
const NOVENAS = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v614/novenas-catalog.json'), 'utf8'));
const BIBLE = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/bible-folded.json'), 'utf8'));
const CTV = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v656/catholictv.json'), 'utf8'));
const audioPayload = (series, title, entries) => ({ ok: true, kind: 'rss', series, title, available: true, showImageUrl: null, entries: entries.map((e) => ({ key: e.key, title: e.title, publishedMs: e.publishedMs, url: e.url, durationS: 600, listened: !!e.listened, positionS: 0 })) });
const head = HEADS.saint[0];
const saintEntries = [head];
for (let i = 1; i < 299; i++) saintEntries.push({ key: 'saint:ep-' + i, title: '11/' + String(25 - (i % 24)).padStart(2, '0') + ' - St. Fixture ' + i, publishedMs: (head.publishedMs || 1764000000000) - i * 86400000, url: 'https://example.invalid/s' + i + '.mp3', listened: false });
const PAYLOADS = {
  'saint-of-the-day': audioPayload('saint-of-the-day', 'The Saint of The Day Podcast', saintEntries),
  'daily-gospel-exegesis': audioPayload('daily-gospel-exegesis', 'Daily Gospel Exegesis', HEADS.exegesis),
  'daily-readings': audioPayload('daily-readings', 'USCCB Daily Readings Podcast', HEADS.readings),
  'bible-in-a-year': BIBLE,
  'catholicsaints': { ok: true, kind: 'video', series: 'catholicsaints', title: 'Catholic Saints & Feasts', available: true, marks: true, videos: HEADS.catholicsaints.map((v) => ({ id: v.id, title: v.title, publishedMs: v.publishedMs, url: 'https://www.youtube.com/watch?v=' + v.id, imageUrl: null, descText: null, dateLabel: '', listened: false })) },
  'catholictv': CTV,
  'novenas': NOVENAS,
};
check('F catholictv production capture stands (the screenshot series payload)', !!CTV && Array.isArray(CTV.videos) && CTV.videos.length > 0, CTV && CTV.videos.length);
check('F saint payload stands at 299 entries on the real head shape', saintEntries.length === 299 && saintEntries[0] === head);

// ---------- build + serve the real bundle ----------
const TMP = execFileSync('mktemp', ['-d', tmpdir() + '/v693harness-XXXXXX'], { encoding: 'utf8' }).trim();
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries the standing v690 pin', SWJS.includes('ora-pro-nobis-v690-1'), 'pin not in served /sw.js');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.addInitScript(({ INDEX, PAYLOADS, BOOK }) => {
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
  window.fetch = (url) => {
    const u = String(url);
    if (u.includes('/api/prayer/book')) return resp(BOOK);
    const m = u.match(/\/api\/player\/podcasts\?series=([^&]+)/);
    if (m) { const sk = decodeURIComponent(m[1]); if (PAYLOADS[sk]) return resp(PAYLOADS[sk]); return resp({ series: sk, kind: 'rss', entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }); }
    if (u.includes('/api/player/podcasts')) return resp(INDEX);
    return new Promise(() => {});
  };
}, { INDEX, PAYLOADS, BOOK });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- ladder driving (the v668 recipe) ----------
async function setMode(mode) {
  await pg.evaluate((m) => { opnModeSet669(m); applyMode669(); }, mode);
  await pg.waitForTimeout(300);
  return pg.evaluate(() => document.documentElement.getAttribute('data-mode'));
}
async function openLadder() {
  await pg.evaluate((seriesList) => {
    const old = document.querySelector('.profaddladder603');
    if (old) old.remove();
    window.__adds693 = [];
    opnLadderSeries603 = seriesList;
    openAddLadder603('Morning', { ids: () => [], add: (it) => { window.__adds693.push(it); }, layers: () => null, groups: () => [], ensure: (cb) => cb() });
  }, INDEX.seriesList);
  await pg.waitForTimeout(500);
}
async function clickDoorByText(re) {
  const handle = await pg.evaluateHandle((reSrc) => {
    const rx = new RegExp(reSrc, 'i');
    const doors = [...document.querySelectorAll('.profaddladder603 [data-p603door]')];
    return doors.find((d) => rx.test(d.textContent)) || null;
  }, re);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await pg.waitForTimeout(450);
  return true;
}
// The gold card probe: computed dress of the unmarked
// .p666daily card standing in the ladder.
function probeCard() {
  return pg.evaluate(() => {
    const cs = (el, prop) => { if (!el) return null; const v = getComputedStyle(el).getPropertyValue(prop); return v === '' ? null : v.trim(); };
    const card = document.querySelector('.profaddladder603 .p666daily[data-p603additem]');
    if (!card) return null;
    const first = document.querySelector('.profaddladder603 [data-p603list] [data-p603additem]');
    const grow = card.querySelector('.grow');
    const sub = card.querySelector('.sub');
    const meta = card.querySelector('.meta');
    return {
      attr: card.getAttribute('data-p603additem'),
      atHead: !!first && first === card,
      fill: cs(card, 'background-color'),
      border: cs(card, 'border-color'),
      titleColor: cs(grow, 'color'),
      subColor: cs(sub, 'color'),
      metaColor: cs(meta, 'color'),
      titleText: grow ? grow.textContent.trim() : null,
      subText: sub ? sub.textContent.trim() : null,
      metaText: meta ? meta.textContent.trim() : null,
    };
  });
}
function cardChecks(tag, p) {
  check(tag + ' the unmarked gold card stands', !!p, p);
  if (!p) return;
  check(tag + ' literal colors: title rgb(42, 38, 32) · sub rgb(109, 99, 83) · tag rgb(109, 99, 83)',
    p.titleColor === 'rgb(42, 38, 32)' && p.subColor === 'rgb(109, 99, 83)' && p.metaColor === 'rgb(109, 99, 83)', p);
  check(tag + ' computed contrast on the gold fill >= 4.5:1 per element (title · sub-line · tag)',
    contrast(p.titleColor, p.fill) >= 4.5 && contrast(p.subColor, p.fill) >= 4.5 && contrast(p.metaColor, p.fill) >= 4.5,
    { title: r2(contrast(p.titleColor, p.fill)), sub: r2(contrast(p.subColor, p.fill)), tag: r2(contrast(p.metaColor, p.fill)), fill: p.fill });
}
function goldChecks(tag, p) {
  check(tag + ' gold signal: fill rgb(246, 236, 211) + border rgb(168, 134, 58), card at the head of its node',
    !!p && p.fill === 'rgb(246, 236, 211)' && p.border === 'rgb(168, 134, 58)' && p.atHead === true, p);
}
async function navToMassNode() {
  await openLadder();
  await clickDoorByText('Videos');
  await clickDoorByText('Virtual Mass');
  await clickDoorByText('Catholic TV Mass');
  await pg.waitForTimeout(600);
}
async function navToSaintNode() {
  await openLadder();
  await clickDoorByText('Catechesis');
  await clickDoorByText('Podcasts');
  await clickDoorByText('Saint of The Day');
  await pg.waitForTimeout(600);
}

// ---------- C1 + C4 (dark) + S dark: the Mass card ----------
const modeDark = await setMode('dark');
check('C1 dark mode stands through the device store ([data-mode="dark"])', modeDark === 'dark', modeDark);
await navToMassNode();
const massDark = await probeCard();
cardChecks('C1 dark Mass card:', massDark);
goldChecks('C4 dark:', massDark);
await pg.evaluate(() => { const pb = document.querySelector('.profaddladder603 .panelbody'); if (pb) pb.scrollTop = 0; window.scrollTo(0, 0); });
await pg.screenshot({ path: SHOTS + '/01-add-sheet-dark.png' });

// ---------- C3 (dark): the v666 saint "Add daily" card ----------
await navToSaintNode();
const saintDark = await probeCard();
check('C3 dark saint card: the card is the v666 daily arm (daily:saint-of-the-day)', !!saintDark && saintDark.attr === 'daily:saint-of-the-day', saintDark && saintDark.attr);
cardChecks('C3 dark saint card:', saintDark);

// ---------- C2 + C4 (light) + S light: the Mass card ----------
const modeLight = await setMode('light');
check('C2 light mode stands (the data-mode attribute absent)', modeLight === null, modeLight);
await navToMassNode();
const massLight = await probeCard();
cardChecks('C2 light Mass card:', massLight);
goldChecks('C4 light:', massLight);
check('C2 the two modes\u2019 readings are identical (the class owns the pairing)',
  !!massDark && !!massLight && massDark.titleColor === massLight.titleColor && massDark.subColor === massLight.subColor
  && massDark.metaColor === massLight.metaColor && massDark.fill === massLight.fill && massDark.border === massLight.border,
  { dark: massDark, light: massLight });
await pg.evaluate(() => { const pb = document.querySelector('.profaddladder603 .panelbody'); if (pb) pb.scrollTop = 0; window.scrollTo(0, 0); });
await pg.screenshot({ path: SHOTS + '/02-add-sheet-light.png' });
check('S screenshots shot: 01-add-sheet-dark.png + 02-add-sheet-light.png (390x844, the gold Mass card standing)', true);

// ---------- C3 (light): the v666 saint "Add daily" card ----------
await navToSaintNode();
const saintLight = await probeCard();
check('C3 light saint card: the card is the v666 daily arm (daily:saint-of-the-day)', !!saintLight && saintLight.attr === 'daily:saint-of-the-day', saintLight && saintLight.attr);
cardChecks('C3 light saint card:', saintLight);

// ---------- C5: the dress is the class's own ----------
{
  const amended = /\.profaddladder603 \.p666daily \{[^}]*background:#f6ecd3;[^}]*color:#2a2620;/.test(CSS);
  const subRule = /\.profaddladder603 \.p666daily \.sub \{ color:#6d6353; \}/.test(CSS);
  const metaRule = /\.profaddladder603 \.p666daily \.meta \{ color:#6d6353; \}/.test(CSS);
  const darkScoped = CSS.split('}').some((chunk) => chunk.includes('p666daily') && chunk.includes('data-mode'));
  check('C5 the served CSS carries the amended .p666daily rule (fill standing + color:#2a2620)', amended);
  check('C5 the served CSS carries the two scoped rules (.sub / .meta at #6d6353)', subRule && metaRule, { subRule, metaRule });
  check('C5 NO [data-mode="dark"]-scoped p666daily rule stands (the pairing is owned by the class)', !darkScoped);
}

await b.close();
server.close();
console.log('harness-v693: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
