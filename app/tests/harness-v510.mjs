// harness-v510.mjs — v510 evidence: the Add-to-Praylist
// slot picker + the landing in today's Praylist list
// (John, Ora thread, 2026-11-17 15:12–15:19 CT: the button
// did not say where the prayer went; it must let him pick
// a slot; the pick must land the prayer INTO today's
// Praylist list itself, standing in the chosen block at
// the chosen position; a View act takes him there).
//   S statics: the v510 invariants in index.ts (the route,
//     the payload fold, the helpers) · the Mass sources
//     byte-identical to the base ship · ui.ts differs from
//     the base only in the .landed rule (pin excepted) ·
//     migration 0037's sqlite proof · the v484 queue-append
//     text retired from client.ts · the fixtures stand
//   P picker: opens on the seven blocks in standing order ·
//     no request on open, step, Back, or cancel · the store
//     byte-unchanged after a backdrop cancel · step 2 names
//     the block's standing items
//   W write: the pick issues exactly one PUT carrying the
//     one addition (block · slug · lang · afterId) · the
//     playback queue is byte-unchanged by the pick · the
//     page then stands landed, naming the block, with View
//   L decisive: a fresh app open — the home Morning count
//     includes the addition · the Morning block page shows
//     the Te Deum card standing directly after the anchor's
//     card, with the Added marker · a tap on its play disc
//     builds the queue headed by the prayer descriptor
//     (kind 'prayer', block Morning) with the block's
//     unplayed remainder after the slot
//   A already-added: the landed state at first paint · the
//     Latin switch paints Add for the unadded language ·
//     the Latin pick lands at Night's end · both stand ·
//     English still reads Morning
//   V view jump: View lands the audio side on the Morning
//     block page, the added card carrying .landed and
//     standing in the viewport
//   F failure: a 500 on the PUT — the sheet stays open with
//     the failure note, nothing is adopted, the store is
//     unchanged, no landed paint
//   N negatives: a non-pilot prayer page byte-identical to
//     the base ship's · the other five pilots carry the act
//     · the prayer-page Play stands (its tap builds the
//     standing one-item queue, the v484 behavior)
// Fixtures (Improvement D): the book is the LIVE payload
// captured through the prayer door on 2026-11-17
// (tests/fixtures/book-live-2026-11-17.json — 9 groups,
// 77 prayers at the ship refresh (post-v508 live book),
// the six pilots carrying the audio fold).
// The day is the LIVE player payload captured through the
// door the same day (tests/fixtures/day-live-2026-11-17
// .json — the seven blocks in standing order, the
// liturgical day, the intro texts), re-dated to the run's
// Chicago today, its Morning block carrying three
// production-shaped own tracks (the door payload carries
// tracks: [] — production resolves items from feeds at
// open; the payload-track build is the standing harness
// simplification, the v505 precedent). The store stub
// mirrors the shipped route: PUT validates the date, the
// block set, and the (slug, lang) audio fold against the
// book fixture, dedupes, replaces the day's list, and
// answers the raw rows; the day answer folds the stored
// rows with book titles + durations, as the server fold
// does. The base for byte comparisons is the v505 ship
// worktree (H510_BASE overrides at ship-compose time).
// Run: node app/tests/harness-v510.mjs [--probe] (from the
// worktree root). --probe only prints.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const MIG37 = readFileSync(APP + '/migrations/0037_prayer_day_additions.sql', 'utf8');
const BASE = process.env.H510_BASE || path.resolve(process.cwd(), '../../.worktrees/v505-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const DAY_RAW = JSON.parse(readFileSync(APP + '/tests/fixtures/day-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PILOTS = ['sub-tuum-praesidium', 'anima-christi', 'te-deum', 'guardian-angel', 'act-of-contrition', 'prayer-for-all-the-faithful-departed'];
const SLOT_BLOCKS = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const pp = {}; parts.forEach((x) => { pp[x.type] = x.value; });
const TODAY = pp.year + '-' + pp.month + '-' + pp.day;
const DATE_LABEL = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
const MORNING_TRACKS = [
  { episodeId: 'morning-prayer', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/morning-prayer.mp3' },
  { episodeId: 'daily-rosary', title: 'Daily Rosary', durationS: 1500, available: true, streamUrl: 'https://audio.example/daily-rosary.mp3' },
  { episodeId: 'marian-antiphon-angelus', title: 'Marian Antiphon', durationS: 180, available: true, streamUrl: 'https://audio.example/marian-antiphon.mp3' },
];
const DAY = Object.assign({}, DAY_RAW, {
  date: TODAY, presentedDay: TODAY, dateLabel: DATE_LABEL,
  blocks: (DAY_RAW.blocks || []).map((b) => b.block === 'Morning' ? Object.assign({}, b, { tracks: MORNING_TRACKS }) : b),
});
delete DAY.additions;

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
const bookRow = (slug) => {
  for (const g of BOOK.groups) for (const p of g.prayers) if (p.slug === slug) return p;
  return null;
};
const BOOK_COUNT = BOOK.groups.reduce((a, g) => a + g.prayers.length, 0);

/* ---------------- S: statics ---------------- */
{
  ok(I_SRC.includes('seg[2] === "day-additions" && request.method === "PUT"')
    && I_SRC.includes('additions: await dayAdditionsFold(env, presented)'),
    'S1: index.ts carries the day-additions PUT route in the player router and the payload fold in playerDayPayload');
  ok(I_SRC.includes("const PRAYER_BLOCKS = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night']")
    || I_SRC.includes('const PRAYER_BLOCKS = ["Novenas", "Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"]'),
    'S2: the standing block order stands in index.ts');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S3-' + f + ': the Mass source stands byte-identical to the base ship');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  const stripLanded = (s) => s.split('\n').filter((l) =>
    !l.includes('.card.landed') && !l.includes("the View jump's landing accent") && !l.includes("prayer's block-page card") && !l.includes('day\'s color) on the card. */')).join('\n');
  ok(pin(stripLanded(U_SRC)) === pin(stripLanded(U_BASE)),
    'S4: ui.ts is byte-identical to the base ship outside the pin line and the one .landed rule');
  ok(U_SRC.includes('.card.landed { border-color:var(--accent); }'),
    'S5: the .landed rule stands in ui.ts (the accent border, the .npq-start treatment)');
  ok(C_SRC.includes('function openSlotPicker(') && C_SRC.includes('function foldDayAdditions(')
    && C_SRC.includes('function dayAdditionCardHtml(') && C_SRC.includes('function appendBlockAdditionCards(')
    && C_SRC.includes('praylistLanding') && C_SRC.includes("api('/api/player/day-additions'")
    && !C_SRC.includes('The append stands in the page queue'),
    'S6: client.ts carries the picker, the fold, the card paint, and the View landing — and the v484 queue-append act is retired whole');
  ok(MIG37.includes('CREATE TABLE IF NOT EXISTS prayer_day_additions') && MIG37.includes('after_id TEXT')
    && MIG37.includes('CREATE INDEX IF NOT EXISTS idx_prayer_day_additions_date ON prayer_day_additions (date, seq)'),
    'S7: migration 0037 carries the table (nullable after_id) and the (date, seq) index');
  ok(BOOK_COUNT === 77 && BOOK.groups.length === 9 && PILOTS.every((s) => { const r = bookRow(s); return r && r.audio && r.audio.en; }),
    'S8: the live-book fixture stands (9 groups, 77 prayers) and every pilot carries its audio fold', 'count ' + BOOK_COUNT);
  ok(Array.isArray(DAY_RAW.blocks) && DAY_RAW.blocks.map((b) => b.block).join(',') === SLOT_BLOCKS.join(','),
    'S9: the live day fixture stands — the seven blocks in standing order');
}

/* ---------------- M: the migration proof ---------------- */
{
  const py = [
    'import sqlite3, sys',
    'mig = open(sys.argv[1]).read()',
    'db = sqlite3.connect(":memory:")',
    'db.executescript(mig)',
    'cols = {r[1]: r for r in db.execute("PRAGMA table_info(prayer_day_additions)").fetchall()}',
    'assert set(cols) == {"id","date","block","slug","lang","after_id","seq","created_at"}, cols.keys()',
    'assert cols["after_id"][3] == 0, "after_id must be nullable (the tail anchor)"',
    'idx = [r[1] for r in db.execute("PRAGMA index_list(prayer_day_additions)").fetchall()]',
    'assert "idx_prayer_day_additions_date" in idx, idx',
    'db.execute("INSERT INTO prayer_day_additions (date, block, slug, lang, after_id, seq) VALUES (?,?,?,?,?,?)", ["2026-11-17","Morning","te-deum","en","daily-rosary",0])',
    'db.execute("INSERT INTO prayer_day_additions (date, block, slug, lang, after_id, seq) VALUES (?,?,?,?,?,?)", ["2026-11-17","Night","te-deum","la",None,1])',
    'rows = db.execute("SELECT block, slug, lang, after_id FROM prayer_day_additions ORDER BY seq").fetchall()',
    'assert rows == [("Morning","te-deum","en","daily-rosary"),("Night","te-deum","la",None)], rows',
    'print("MIGRATION_OK")',
  ].join('\n');
  const tmp = path.join(os.tmpdir(), 'harness-v510-mig.py');
  writeFileSync(tmp, py);
  const f37 = path.join(os.tmpdir(), 'harness-v510-0037.sql');
  writeFileSync(f37, MIG37);
  let migOut = '';
  try { migOut = execFileSync('python3', [tmp, f37], { encoding: 'utf8' }); }
  catch (e) { migOut = 'ERR ' + String(e.stdout || e.message).slice(0, 200); }
  ok(migOut.includes('MIGRATION_OK'),
    'M1: the real 0037 applies clean — the table shape stands, after_id is nullable, the index stands, rows round-trip in seq order',
    migOut.trim().slice(0, 160));
}

/* ---------------- fixtures + pages ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED_BASE = null;
try { COOKED = cook(C_SRC); ok(true, 'P1: the cooked APP_JS parses (the v439 gate)'); }
catch (e) { ok(false, 'P1: the cooked APP_JS parses (the v439 gate)', String(e).slice(0, 160)); }
try { COOKED_BASE = cook(C_BASE); } catch (e) { console.log('note - base cook failed:', String(e).slice(0, 120)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const APP_CSS_BASE = U_BASE.slice(U_BASE.indexOf('APP_CSS = `') + 11, U_BASE.indexOf('`;', U_BASE.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

const MASS_PAYLOAD = {
  ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary',
  defaultVersion: 'elizabeth',
  versions: [{ key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: {
    entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
    collect: 'O God, who made the Memorial of Saint Elizabeth a sign of your care, grant, we pray, that we may follow her example. Through our Lord Jesus Christ, your Son.',
    prayerOverOfferings: 'Accept, O Lord, the offerings we bring in honor of Saint Elizabeth.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
    prayerAfterCommunion: 'Nourished by this sacrament, O Lord, may we imitate Saint Elizabeth in charity.',
  } }],
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me.</p>' },
] };

function buildPage(cooked, css) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.__putLog = [];
var BOOK_STUB = ${JSON.stringify(BOOK)};
var DAY_STUB = ${JSON.stringify(DAY)};
var SLOT_BLOCKS = ${JSON.stringify(SLOT_BLOCKS)};
function daRead() { try { return JSON.parse(localStorage.getItem('da-store-v510') || 'null') || { date: null, rows: [] }; } catch (e) { return { date: null, rows: [] }; } }
function daBookRow(slug) { var hit = null; (BOOK_STUB.groups || []).forEach(function (g) { g.prayers.forEach(function (x) { if (x.slug === slug) hit = x; }); }); return hit; }
function daFold(rows) {
  return rows.map(function (r) {
    var hit = daBookRow(r.slug);
    var a = hit && hit.audio ? hit.audio[r.lang] : null;
    if (!hit || !a) return null;
    return { block: r.block, slug: r.slug, lang: r.lang, afterId: r.afterId === undefined ? null : r.afterId, title: hit.title, durationS: a };
  }).filter(Boolean);
}
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push({ path: p, method: (opts && opts.method) || 'GET' });
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status,
    json: function () { return Promise.resolve(body); },
    blob: function () { return Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })); },
    arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(8)); },
    text: function () { return Promise.resolve(JSON.stringify(body)); } }); };
  if (p.indexOf('/api/player/day-additions') === 0) {
    if (window.__daFailPut) return ans(500, { error: 'boom' });
    let body = {};
    try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
    window.__putLog.push(body);
    if (body.date !== DAY_STUB.date || !Array.isArray(body.additions)) return ans(400, { error: 'bad additions' });
    const seen = {}, rows = [];
    for (const a of body.additions) {
      if (!a || SLOT_BLOCKS.indexOf(a.block) < 0) return ans(400, { error: 'bad block' });
      const hit = daBookRow(a.slug);
      if (!hit || !hit.audio || !hit.audio[a.lang]) return ans(400, { error: 'bad prayer audio' });
      const key = a.slug + '|' + a.lang;
      if (seen[key]) continue;
      seen[key] = 1;
      rows.push({ block: a.block, slug: a.slug, lang: a.lang, afterId: a.afterId === undefined ? null : a.afterId });
    }
    try { localStorage.setItem('da-store-v510', JSON.stringify({ date: body.date, rows: rows })); } catch (e) {}
    return ans(200, { ok: true, date: body.date, additions: rows });
  }
  if (p === '/api/player/day' || p.indexOf('/api/player/day?') === 0) {
    const day = JSON.parse(JSON.stringify(DAY_STUB));
    const st = daRead();
    day.additions = st.date === DAY_STUB.date ? daFold(st.rows) : [];
    return ans(200, day);
  }
  if (p.indexOf('/api/prayer/book/favorites') === 0) {
    if (opts && opts.method === 'PUT') { let b = {}; try { b = JSON.parse(opts.body || '{}'); } catch (e) {} return ans(200, { ok: true, favorites: b.favorites || [] }); }
    return ans(200, { ok: true, favorites: [] });
  }
  if (p === '/api/prayer/book') return ans(200, BOOK_STUB);
  if (p.indexOf('/api/prayer/day?') === 0) return ans(200, { ok: true, liturgicalDay: DAY_STUB.liturgicalDay, blocks: DAY_STUB.blocks });
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(MASS_PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: null, after: null, afterMass: [] });
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

let PAGE = '', PAGE_BASE = '';
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/v510') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  if (u === '/base') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE_BASE); return; }
  res.statusCode = 404; res.end('not found');
});
PAGE = buildPage(COOKED, APP_CSS);
PAGE_BASE = buildPage(COOKED_BASE, APP_CSS_BASE);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(which, errs, tag, initScript) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (initScript) await ctx.addInitScript(initScript);
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
  });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note -', tag, 'openblock slow'));
  await sleep(500);
  return { ctx, page };
}
async function openBookPage(page, slug) {
  /* the side toggle stands on the tab's own pages; from a
     block page the switch goes through switchSide itself */
  const toggled = await page.click('#sidetoggle [data-side="book"]', { timeout: 3000 }).then(() => true).catch(() => false);
  if (!toggled) await page.evaluate(() => { switchSide('prayers', 'book'); });
  await page.waitForSelector('.bookgroup, .bookrow', { timeout: 15000 }).catch(() => console.log('note - book side slow'));
  await sleep(300);
  await page.evaluate((s) => { openPrayerPage(s); }, slug);
  await sleep(400);
}
async function gotoPraylistHome(page) {
  /* a fresh page in a used context boots on the last tab +
     side (v492) — walk it to the Praylist home explicitly */
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await sleep(300);
  const side = await page.click('#sidetoggle [data-side="prayers"]', { timeout: 3000 }).then(() => true).catch(() => false);
  if (!side) await page.evaluate(() => { switchSide('prayers', 'prayers'); });
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - home slow'));
  await sleep(500);
}
const daStore = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('da-store-v510') || 'null'); } catch (e) { return null; }
});

/* ---------------- L + W: the pick, the write, the decisive re-open ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v510', errs, 'L');
  const countBefore = await page.evaluate(() => {
    const el = document.querySelector('[data-bcount="Morning"]');
    return el ? el.textContent : null;
  });
  const queueBefore = await page.evaluate(() => JSON.stringify(state.queue));
  await openBookPage(page, 'te-deum');
  const row0 = await page.evaluate(() => ({
    add: !!document.getElementById('book-add'),
    view: !!document.getElementById('book-view'),
    landed: (document.querySelector('.bookin') || {}).textContent || null,
    play: !!document.getElementById('book-play'),
  }));
  ok(row0.add && !row0.view && !row0.landed && row0.play,
    'L1: before the tap the Te Deum page stands as today — Play + a bare Add to Praylist, no landed state', JSON.stringify(row0));

  /* the pick: Add → Morning → After Daily Rosary */
  await page.click('#book-add');
  await page.waitForSelector('.sheet.slotpick', { timeout: 10000 }).catch(() => console.log('note - L sheet slow'));
  await sleep(300);
  const step1 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-slotblock]')).map((r) => r.getAttribute('data-slotblock')));
  ok(JSON.stringify(step1) === JSON.stringify(SLOT_BLOCKS),
    'L2: the picker opens on the seven blocks in standing order', JSON.stringify(step1));
  await page.click('[data-slotblock="Morning"]');
  await sleep(300);
  const step2 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-slotpos]')).map((r) => ({ v: r.getAttribute('data-slotpos'), t: r.textContent })));
  ok(step2.length === 5 && step2[0].v === '' && step2[1].v === 'morning-prayer' && step2[2].v === 'daily-rosary'
    && step2[3].v === 'marian-antiphon-angelus' && step2[4].v === 'end'
    && step2[2].t.includes('After Daily Rosary'),
    'L3: step 2 names the position choices — the start, one After row per standing Morning item, the end', JSON.stringify(step2));
  await page.click('[data-slotpos="daily-rosary"]');
  await sleep(600);
  const wInfo = await page.evaluate(() => ({
    puts: window.__putLog.slice(),
    sheetGone: !document.querySelector('.sheet.slotpick'),
    landed: (document.querySelector('.bookin') || {}).textContent || null,
    view: !!document.getElementById('book-view'),
    add: !!document.getElementById('book-add'),
    queue: JSON.stringify(state.queue),
  }));
  const st1 = await daStore(page);
  ok(wInfo.puts.length === 1 && wInfo.puts[0].date === TODAY
    && JSON.stringify(wInfo.puts[0].additions) === JSON.stringify([{ block: 'Morning', slug: 'te-deum', lang: 'en', afterId: 'daily-rosary' }]),
    'W1: the pick issues exactly one PUT carrying the one addition (Morning · te-deum · en · after daily-rosary)', JSON.stringify(wInfo.puts));
  ok(st1 && st1.date === TODAY && JSON.stringify(st1.rows) === JSON.stringify([{ block: 'Morning', slug: 'te-deum', lang: 'en', afterId: 'daily-rosary' }]),
    'W2: the store holds exactly the picked addition, once', JSON.stringify(st1));
  ok(wInfo.queue === queueBefore,
    'W3: the playback queue is byte-unchanged by the pick — the day list, not the queue, took the prayer');
  ok(wInfo.sheetGone && wInfo.view && !wInfo.add && (wInfo.landed || '').includes('Morning') && (wInfo.landed || '').includes('Praylist'),
    'W4: after the pick the page stands landed — "In today\'s Praylist ✓ — Morning" with the View act, no bare Add', JSON.stringify(wInfo));

  /* the decisive re-open: a fresh page in the same context
     (the store stands in localStorage, as the server store
     stands across devices) */
  const page2 = await ctx.newPage();
  await page2.goto(ORIGIN + '/v510');
  await gotoPraylistHome(page2);
  const home2 = await page2.evaluate(() => {
    const el = document.querySelector('[data-bcount="Morning"]');
    return el ? el.textContent : null;
  });
  ok(countBefore === '3 tracks' && home2 === '4 tracks',
    'L4: on a fresh open the home Morning count includes the addition (3 standing + the added prayer)', countBefore + ' -> ' + home2);
  await page2.click('[data-openblock="Morning"]');
  await sleep(600);
  const cards = await page2.evaluate(() => Array.from(document.querySelectorAll('#view [data-card]')).map((c) => ({
    id: c.getAttribute('data-card'),
    cls: c.className,
    meta: (c.querySelector('.meta') || {}).textContent || '',
  })));
  const ids = cards.map((c) => c.id);
  const tIdx = ids.indexOf('prayer:te-deum:en');
  ok(JSON.stringify(ids) === JSON.stringify(['morning-prayer', 'daily-rosary', 'prayer:te-deum:en', 'marian-antiphon-angelus']),
    'L5: the Morning block page shows the Te Deum card standing directly after the Daily Rosary card, at its slot', JSON.stringify(ids));
  ok(tIdx >= 0 && cards[tIdx].cls.includes('addition') && cards[tIdx].meta.includes('Added to Praylist'),
    'L6: the standing card carries the addition dress and the "Added to Praylist" marker', JSON.stringify(cards[tIdx]));
  await page2.click('[data-card="prayer:te-deum:en"] [data-playkey]');
  await sleep(700);
  const q = await page2.evaluate(() => state.queue.map((d) => ({ id: d.episodeId, kind: d.kind, block: d.block })));
  ok(q.length === 2 && q[0].id === 'prayer:te-deum:en' && q[0].kind === 'prayer' && q[0].block === 'Morning'
    && q[1].id === 'marian-antiphon-angelus',
    'L7: a tap on the card\'s play disc builds the queue headed by the prayer (kind prayer, block Morning) with the block\'s unplayed remainder after the slot', JSON.stringify(q));

  /* V: the View jump, from the landed prayer page */
  await openBookPage(page2, 'te-deum');
  const rowV = await page2.evaluate(() => ({
    landed: (document.querySelector('.bookin') || {}).textContent || null,
    view: !!document.getElementById('book-view'),
  }));
  ok(!!rowV.landed && rowV.landed.includes('Morning') && rowV.view,
    'V1: after the re-open the prayer page itself stands landed, naming Morning, with View', JSON.stringify(rowV));
  await page2.click('#book-view');
  await sleep(900);
  const vInfo = await page2.evaluate(() => {
    const card = document.querySelector('[data-card="prayer:te-deum:en"]');
    const r = card ? card.getBoundingClientRect() : null;
    return {
      kind: state.prayersView && state.prayersView.kind,
      block: state.prayersView && state.prayersView.block,
      landed: card ? card.classList.contains('landed') : false,
      inView: r ? (r.top >= 0 && r.bottom <= window.innerHeight) : false,
    };
  });
  ok(vInfo.kind === 'block' && vInfo.block === 'Morning' && vInfo.landed && vInfo.inView,
    'V2: View lands the audio side on the Morning block page — the added card carries .landed and stands in the viewport', JSON.stringify(vInfo));
  ok(errs.length === 0, 'L8: no page errors across the pick, the re-open, and the jump', errs.join(' · '));
  await ctx.close();
}

/* ---------------- P: picker mechanics + cancel ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v510', errs, 'P');
  await openBookPage(page, 'te-deum');
  await page.click('#book-add');
  await page.waitForSelector('.sheet.slotpick', { timeout: 10000 }).catch(() => console.log('note - P sheet slow'));
  await sleep(300);
  await page.click('[data-slotblock="Night"]');
  await sleep(300);
  const back = await page.evaluate(() => !!document.querySelector('[data-slotback]'));
  ok(back, 'P1: step 2 carries the Back row');
  await page.click('[data-slotback]');
  await sleep(300);
  const step1Again = await page.evaluate(() => document.querySelectorAll('[data-slotblock]').length);
  ok(step1Again === 7, 'P2: Back returns to the seven blocks', String(step1Again));
  const putsBefore = await page.evaluate(() => window.__putLog.length);
  const storeBefore = await page.evaluate(() => localStorage.getItem('da-store-v510'));
  /* backdrop tap: the sheet element's own corner (outside .inner) */
  await page.mouse.click(8, 8);
  await sleep(400);
  const pInfo = await page.evaluate(() => ({
    sheetGone: !document.querySelector('.sheet.slotpick'),
    puts: window.__putLog.length,
    store: localStorage.getItem('da-store-v510'),
    add: !!document.getElementById('book-add'),
  }));
  ok(pInfo.sheetGone && pInfo.puts === putsBefore && pInfo.store === storeBefore && pInfo.add,
    'P3: a cancelled picker writes nothing — no PUT, the store byte-unchanged, the page back at the bare Add', JSON.stringify(pInfo));
  ok(errs.length === 0, 'P4: no page errors across the picker mechanics', errs.join(' · '));
  await ctx.close();
}

/* ---------------- A: already-added + the Latin pick ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v510', errs, 'A');
  /* seed the stub store through the page, then reload so
     the boot's own day build folds the standing row */
  await page.evaluate((today) => {
    localStorage.setItem('da-store-v510', JSON.stringify({ date: today, rows: [{ block: 'Morning', slug: 'te-deum', lang: 'en', afterId: 'daily-rosary' }] }));
  }, TODAY);
  await page.reload();
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - A openblock slow'));
  await sleep(500);
  await openBookPage(page, 'te-deum');
  const a0 = await page.evaluate(() => ({
    landed: (document.querySelector('.bookin') || {}).textContent || null,
    view: !!document.getElementById('book-view'),
    add: !!document.getElementById('book-add'),
  }));
  ok(!!a0.landed && a0.landed.includes('Morning') && a0.view && !a0.add,
    'A1: with the prayer already standing, the page opens landed — naming Morning, View standing, no Add act', JSON.stringify(a0));
  /* the Latin switch: Latin does not stand yet */
  await page.click('.langswitch [data-lang="la"]');
  await sleep(400);
  const a1 = await page.evaluate(() => ({
    add: !!document.getElementById('book-add'),
    landed: (document.querySelector('.bookin') || {}).textContent || null,
  }));
  ok(a1.add && !a1.landed, 'A2: the Latin switch paints the Add act — the landed state is per-language', JSON.stringify(a1));
  await page.click('#book-add');
  await page.waitForSelector('.sheet.slotpick', { timeout: 10000 }).catch(() => console.log('note - A sheet slow'));
  await sleep(300);
  await page.click('[data-slotblock="Night"]');
  await sleep(300);
  await page.click('[data-slotpos="end"]');
  await sleep(600);
  const a2 = await page.evaluate(() => ({
    landed: (document.querySelector('.bookin') || {}).textContent || null,
    puts: window.__putLog.slice(),
  }));
  const stA = await daStore(page);
  ok(!!a2.landed && a2.landed.includes('Night'),
    'A3: the Latin pick lands — the row now reads landed, naming Night', JSON.stringify(a2));
  ok(stA && stA.rows.length === 2
    && JSON.stringify(stA.rows[0]) === JSON.stringify({ block: 'Morning', slug: 'te-deum', lang: 'en', afterId: 'daily-rosary' })
    && JSON.stringify(stA.rows[1]) === JSON.stringify({ block: 'Night', slug: 'te-deum', lang: 'la', afterId: null }),
    'A4: the store holds both standings exactly once — the English Morning row untouched, the Latin Night row at the tail anchor', JSON.stringify(stA));
  await page.click('.langswitch [data-lang="en"]');
  await sleep(400);
  const a3 = await page.evaluate(() => (document.querySelector('.bookin') || {}).textContent || null);
  ok(!!a3 && a3.includes('Morning'), 'A5: back on English the landed state still reads Morning', String(a3));
  ok(errs.length === 0, 'A6: no page errors across the already-added flow', errs.join(' · '));
  await ctx.close();
}

/* ---------------- F: the failed save ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v510', errs, 'F');
  await page.evaluate(() => { window.__daFailPut = true; });
  await openBookPage(page, 'te-deum');
  await page.click('#book-add');
  await page.waitForSelector('.sheet.slotpick', { timeout: 10000 }).catch(() => console.log('note - F sheet slow'));
  await sleep(300);
  await page.click('[data-slotblock="Morning"]');
  await sleep(300);
  await page.click('[data-slotpos="end"]');
  await sleep(600);
  const fInfo = await page.evaluate(() => ({
    sheetOpen: !!document.querySelector('.sheet.slotpick'),
    note: (document.getElementById('slot-note') || {}).textContent || '',
    store: localStorage.getItem('da-store-v510'),
  }));
  ok(fInfo.sheetOpen && fInfo.note.includes('Could not save') && !fInfo.store,
    'F1: a failed save leaves the sheet open with the failure note and writes nothing', JSON.stringify(fInfo));
  await page.mouse.click(8, 8);
  await sleep(400);
  const f2 = await page.evaluate(() => ({
    add: !!document.getElementById('book-add'),
    landed: (document.querySelector('.bookin') || {}).textContent || null,
  }));
  ok(f2.add && !f2.landed, 'F2: after the failed pick the page stands at the bare Add — no landed paint from a failed write', JSON.stringify(f2));
  await ctx.close();
}

/* ---------------- N: negatives ---------------- */
{
  const errs = [];
  const b = await boot('/v510', errs, 'N');
  const base = await boot('/base', errs, 'N-base');
  await openBookPage(b.page, 'our-father');
  await openBookPage(base.page, 'our-father');
  const np = await b.page.evaluate(() => document.getElementById('book-page').outerHTML);
  const npBase = await base.page.evaluate(() => document.getElementById('book-page').outerHTML);
  ok(np === npBase, 'N1: a non-pilot prayer page is byte-identical to the base ship\'s page');
  const others = ['sub-tuum-praesidium', 'anima-christi', 'guardian-angel', 'act-of-contrition', 'prayer-for-all-the-faithful-departed'];
  let allCarry = true;
  for (const s of others) {
    await b.page.evaluate((x) => { openPrayerPage(x); }, s);
    await sleep(250);
    const has = await b.page.evaluate(() => !!document.getElementById('book-add') && !!document.getElementById('book-play'));
    if (!has) allCarry = false;
  }
  ok(allCarry, 'N2: the other five pilot pages all carry Play + Add to Praylist');
  const playState = async (pg) => {
    await pg.evaluate(() => { openPrayerPage('guardian-angel'); });
    await sleep(300);
    await pg.click('#book-play');
    await sleep(600);
    return pg.evaluate(() => ({
      current: state.current ? state.current.episodeId : null,
      kind: state.current ? state.current.kind : null,
      queueLen: state.queue.length,
    }));
  };
  const psBuild = await playState(b.page);
  const psBase = await playState(base.page);
  ok(psBuild.current === 'prayer:guardian-angel:en' && psBuild.kind === 'prayer'
    && JSON.stringify(psBuild) === JSON.stringify(psBase),
    'N3: the prayer-page Play is unchanged from the base — its tap starts the prayer as the current track, the same state on both trees', JSON.stringify(psBuild) + ' vs ' + JSON.stringify(psBase));
  ok(errs.length === 0, 'N4: no page errors across the negatives', errs.join(' · '));
  await b.ctx.close();
  await base.ctx.close();
}

await browser.close();
server.close();
console.log(`\n# harness-v510: ${pass} passed / ${fail} failed`);
if (failures.length) { console.log('# failing:', failures.join(' · ')); process.exit(1); }
