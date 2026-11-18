// harness-v519.mjs — v519 evidence: the Remove act for
// Praylist additions — the v510 named bound, closed
// (John, main chat 2026-11-17 19:52 CT: he added Te Deum
// and could not take it off; decisions folded in from
// package 46 Part A, Ora thread 2026-11-17 20:09 CT:
// A1 — Remove stands in the overflow menu in BOTH seats,
// the block-page card and the prayer page's landed row,
// never on a card's face · A2 — one tap, no confirm).
//   S statics: client.ts carries the two seats + the act ·
//     index.ts / mass*.ts byte-identical to the base ship ·
//     ui.ts identical outside the pin · the fixtures stand
//   M menu: the added card's title row carries the ⋮; its
//     menu is titled with the prayer and carries exactly
//     one act — Remove from Praylist
//   R removal: one PUT with the whole list minus the one
//     entry (the other addition byte-identical in it) ·
//     the store holds the survivor only · the block page
//     repaints without the card · the count drops by one
//   L landed clears: a fresh open of the prayer page
//     paints the bare Add — no landed state, no View, no ⋮
//   P prayer-page seat: the landed row carries the ⋮; one
//     tap removes in place — the row returns to its Add
//     state and the block page loses the card
//   A re-add: the standing picker lands the same prayer
//     again the same day; both additions stand
//   O others untouched: a base item's played mark set
//     before the removal reads played after it · a queue
//     built after the removal carries no prayer descriptor
//   F failure: a 500 on the PUT adopts nothing — the card
//     and the store stand; the menu reopens with the
//     failure line above the act
//   N negatives: a day with no additions paints
//     byte-identical block pages and prayer pages to base
// Fixtures (Improvement D): the book and the day skeleton
// are the LIVE payloads captured through the prayer door
// on 2026-11-17 (tests/fixtures-v519/book-live-2026-11-17
// .json — 9 groups, 77 prayers, Te Deum + Anima Christi
// carrying their v509/v484 audio folds · day-live-2026-11
// -17.json — the composed Salesian day: the core blocks
// in order with the Novenas layer group after them, the
// liturgical day, the intro texts, the profile fold), the
// day re-dated to the run's Chicago today, its Morning and
// Evening blocks carrying production-shaped tracks (the
// door payload carries tracks: [] — production resolves
// items from feeds at open; the payload-track build is
// the standing harness simplification, the v505/v510
// precedent). The seeded additions are modeled on John's
// real 2026-11-17 addition — Te Deum (en) woven into
// Evening after its first item — plus Anima Christi (en)
// at Morning's tail, the second addition the preservation
// legs stand on. The store stub mirrors the shipped
// route: PUT validates the date, the block set, and the
// (slug, lang) audio fold against the book fixture,
// dedupes, replaces the day's list, and answers the raw
// rows; the day answer folds the stored rows with book
// titles + durations, as the server fold does. The base
// for byte comparisons is the v516 ship worktree
// (H519_BASE overrides at ship-compose time).
// Run: node app/tests/harness-v519.mjs [--probe] (from the
// worktree root). --probe only prints.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = process.env.H519_BASE || path.resolve(process.cwd(), '../../.worktrees/v516-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures-v519/book-live-2026-11-17.json', 'utf8'));
const DAY_RAW = JSON.parse(readFileSync(APP + '/tests/fixtures-v519/day-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const EVENING_TRACKS = [
  { episodeId: 'evening-prayer', title: 'Evening Prayer', durationS: 900, available: true, streamUrl: 'https://audio.example/evening-prayer.mp3' },
  { episodeId: 'examination-of-conscience', title: 'Examination of Conscience', durationS: 420, available: true, streamUrl: 'https://audio.example/examination.mp3' },
  { episodeId: 'marian-antiphon-salve', title: 'Marian Antiphon', durationS: 200, available: true, streamUrl: 'https://audio.example/marian-antiphon-salve.mp3' },
];
const DAY = Object.assign({}, DAY_RAW, {
  date: TODAY, presentedDay: TODAY, dateLabel: DATE_LABEL,
  blocks: (DAY_RAW.blocks || []).map((b) => b.block === 'Morning' ? Object.assign({}, b, { tracks: MORNING_TRACKS })
    : b.block === 'Evening' ? Object.assign({}, b, { tracks: EVENING_TRACKS }) : b),
});
delete DAY.additions;
const SEED_ROWS = [
  { block: 'Evening', slug: 'te-deum', lang: 'en', afterId: 'evening-prayer' },
  { block: 'Morning', slug: 'anima-christi', lang: 'en', afterId: null },
];

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
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(C_SRC.includes('data-addmenu="\' + esc(d.episodeId) + \'"') && C_SRC.includes('prow-cluster')
    && C_SRC.includes('function dayAdditionCardHtml('),
    'S1: the added card paints the overflow cluster (data-addmenu) in its title row');
  ok(C_SRC.includes('function openAdditionMenu(') && C_SRC.includes('function removeDayAddition(')
    && C_SRC.includes('function additionRemoveFail(') && C_SRC.includes("label: 'Remove from Praylist'")
    && C_SRC.includes('Could not remove'),
    'S2: client.ts carries the menu, the Remove act, and the failure reopen');
  ok(C_SRC.includes("id=\"book-addmenu\"") && C_SRC.includes('dayAdditionDesc(st2)'),
    'S3: the prayer page\'s landed row carries its overflow seat (book-addmenu), wired to the same menu');
  ok(C_SRC.includes("scope.querySelectorAll('[data-addmenu]')"),
    'S4: wireRowActs wires the addition overflow beside the row menu');
  ok(I_SRC === I_BASE, 'S5: index.ts stands byte-identical to the base ship — no server change, no migration');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S6-' + f + ': the Mass source stands byte-identical to the base ship');
  }
  ok(pin(U_SRC) === pin(U_BASE), 'S7: ui.ts is byte-identical to the base ship outside the pin line');
  ok(BOOK_COUNT === 77 && BOOK.groups.length === 9
    && bookRow('te-deum').audio.en === 107.4 && bookRow('anima-christi').audio.en === 29.9,
    'S8: the live-book fixture stands (9 groups, 77 prayers) with both seeded prayers\' audio folds', 'count ' + BOOK_COUNT);
  ok(Array.isArray(DAY_RAW.blocks) && DAY_RAW.blocks.map((b) => b.block).join(',') === 'Morning,Midday,Evening,Night,Novenas,Podcasts'
    && DAY_RAW.profile && DAY_RAW.profile.key === 'salesian'
    && DAY_RAW.profile.layers.every((l) => l.on),
    'S9: the live day fixture stands — the composed Salesian day (core in order, then the Novenas and Podcasts layer groups, both on in John\'s live state), the profile fold standing');
}

/* ---------------- fixtures + pages ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED_BASE = null;
try { COOKED = cook(C_SRC); ok(true, 'P0: the cooked APP_JS parses (the v439 gate)'); }
catch (e) { ok(false, 'P0: the cooked APP_JS parses (the v439 gate)', String(e).slice(0, 160)); }
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
function daRead() { try { return JSON.parse(localStorage.getItem('da-store-v519') || 'null') || { date: null, rows: [] }; } catch (e) { return { date: null, rows: [] }; } }
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
    try { localStorage.setItem('da-store-v519', JSON.stringify({ date: body.date, rows: rows })); } catch (e) {}
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
  if (u === '/v519') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
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

async function boot(which, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
async function seedStore(page, rows) {
  await page.evaluate((args) => {
    localStorage.setItem('da-store-v519', JSON.stringify({ date: args.today, rows: args.rows }));
  }, { today: TODAY, rows });
  await page.reload();
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - seed openblock slow'));
  await sleep(500);
}
async function openBookPage(page, slug) {
  const toggled = await page.click('#sidetoggle [data-side="book"]', { timeout: 3000 }).then(() => true).catch(() => false);
  if (!toggled) await page.evaluate(() => { switchSide('prayers', 'book'); });
  await page.waitForSelector('.bookgroup, .bookrow', { timeout: 15000 }).catch(() => console.log('note - book side slow'));
  await sleep(300);
  await page.evaluate((s) => { openPrayerPage(s); }, slug);
  await sleep(400);
}
async function gotoPraylistHome(page) {
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await sleep(300);
  const side = await page.click('#sidetoggle [data-side="prayers"]', { timeout: 3000 }).then(() => true).catch(() => false);
  if (!side) await page.evaluate(() => { switchSide('prayers', 'prayers'); });
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - home slow'));
  await sleep(500);
}
const daStore = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('da-store-v519') || 'null'); } catch (e) { return null; }
});
const menuInfo = (page) => page.evaluate(() => {
  const card = document.querySelector('.menusheet.anchmenu');
  if (!card) return null;
  return {
    title: (card.querySelector('h1') || {}).textContent || '',
    items: Array.from(card.querySelectorAll('[data-menuitem]')).map((b) => b.textContent.trim()),
  };
});

/* ---------------- M + R + O: the block-page seat ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v519', errs, 'M');
  await seedStore(page, SEED_ROWS);
  const countBefore = await page.evaluate(() => {
    const el = document.querySelector('[data-bcount="Evening"]');
    return el ? el.textContent : null;
  });
  ok(countBefore === '4 tracks', 'M0: the home Evening count includes the addition (3 standing + the added prayer)', String(countBefore));
  await page.click('[data-openblock="Evening"]');
  await sleep(600);
  const cardInfo = await page.evaluate(() => {
    const c = document.querySelector('[data-card="prayer:te-deum:en"]');
    if (!c) return null;
    const ids = Array.from(document.querySelectorAll('#view [data-card]')).map((x) => x.getAttribute('data-card'));
    return {
      ids,
      menu: !!c.querySelector('[data-addmenu]'),
      faceRemove: /Remove/.test(c.textContent),
      meta: (c.querySelector('.meta') || {}).textContent || '',
    };
  });
  ok(cardInfo && JSON.stringify(cardInfo.ids) === JSON.stringify(['evening-prayer', 'prayer:te-deum:en', 'examination-of-conscience', 'marian-antiphon-salve']),
    'M1: the Te Deum card stands at its slot (after Evening Prayer) on the Evening page', JSON.stringify(cardInfo && cardInfo.ids));
  ok(cardInfo && cardInfo.menu && !cardInfo.faceRemove && cardInfo.meta.includes('Added to Praylist'),
    'M2: the card carries the overflow button in its title row and NO Remove on its face (A1)', JSON.stringify(cardInfo));
  /* O setup: mark a base item played before the removal */
  await page.click('[data-card="evening-prayer"] [data-markplayed]');
  await sleep(400);
  const dotBefore = await page.evaluate(() => {
    const d = document.querySelector('[data-card="evening-prayer"] [data-markplayed]');
    return d ? d.className : null;
  });
  ok(dotBefore && dotBefore.includes('on'), 'O1: the base Evening item takes its played mark before the removal', String(dotBefore));
  /* the menu */
  await page.click('[data-card="prayer:te-deum:en"] [data-addmenu]');
  await sleep(400);
  const mi = await menuInfo(page);
  ok(mi && mi.items.length === 1 && mi.items[0] === 'Remove from Praylist' && mi.title.includes('Te Deum'),
    'M3: the overflow menu is titled with the prayer and carries exactly one act — Remove from Praylist', JSON.stringify(mi));
  /* the removal: one tap, no confirm (A2) */
  await page.click('.menusheet.anchmenu [data-menuitem="0"]');
  await sleep(700);
  const rInfo = await page.evaluate(() => ({
    puts: window.__putLog.slice(),
    cardGone: !document.querySelector('[data-card="prayer:te-deum:en"]'),
    ids: Array.from(document.querySelectorAll('#view [data-card]')).map((x) => x.getAttribute('data-card')),
    menuGone: !document.querySelector('.menusheet.anchmenu'),
    dot: (document.querySelector('[data-card="evening-prayer"] [data-markplayed]') || {}).className || null,
    descs: (state.dayDescs || []).map((d) => d.episodeId),
  }));
  const stR = await daStore(page);
  ok(rInfo.puts.length === 1 && rInfo.puts[0].date === TODAY
    && JSON.stringify(rInfo.puts[0].additions) === JSON.stringify([{ block: 'Morning', slug: 'anima-christi', lang: 'en', afterId: null }]),
    'R1: the tap issues exactly one PUT — the whole list minus Te Deum, the Morning addition byte-identical in it (afterId included)', JSON.stringify(rInfo.puts));
  ok(stR && stR.date === TODAY && JSON.stringify(stR.rows) === JSON.stringify([{ block: 'Morning', slug: 'anima-christi', lang: 'en', afterId: null }]),
    'R2: the store holds exactly the surviving addition', JSON.stringify(stR));
  ok(rInfo.cardGone && rInfo.menuGone
    && JSON.stringify(rInfo.ids) === JSON.stringify(['evening-prayer', 'examination-of-conscience', 'marian-antiphon-salve']),
    'R3: the block page repaints without the card — the base items stand in their order', JSON.stringify(rInfo.ids));
  ok(!rInfo.descs.includes('prayer:te-deum:en') && rInfo.descs.includes('prayer:anima-christi:en'),
    'R4: the rebuilt day drops the removed descriptor and keeps the surviving addition\'s', JSON.stringify(rInfo.descs));
  ok(rInfo.dot && rInfo.dot.includes('on'),
    'O2: the base item\'s played mark reads played after the removal — marks stand untouched', String(rInfo.dot));
  /* O: a queue built after the removal carries no prayer */
  await page.click('[data-queue="Evening"]');
  await sleep(700);
  const q = await page.evaluate(() => state.queue.map((d) => d.episodeId));
  ok(q.length > 0 && !q.some((id) => id.indexOf('prayer:') === 0),
    'O3: the Evening Play All queue built after the removal contains no prayer descriptor', JSON.stringify(q));
  await page.evaluate(() => { try { pause(); } catch (e) {} });
  /* the count after */
  await gotoPraylistHome(page);
  const countAfter = await page.evaluate(() => {
    const el = document.querySelector('[data-bcount="Evening"]');
    return el ? el.textContent : null;
  });
  ok(countAfter === '3 tracks', 'R5: the home Evening count reads one fewer after the removal', String(countAfter));
  /* the surviving addition stands on its own page */
  await page.click('[data-openblock="Morning"]');
  await sleep(600);
  const morn = await page.evaluate(() => Array.from(document.querySelectorAll('#view [data-card]')).map((x) => x.getAttribute('data-card')));
  ok(morn[morn.length - 1] === 'prayer:anima-christi:en',
    'R6: the surviving Morning addition stands untouched at its tail slot', JSON.stringify(morn));
  ok(errs.length === 0, 'M4: no page errors across the menu, the removal, and the repaints', errs.join(' · '));

  /* ---------------- L + A: landed clears, then re-add ---------------- */
  const page2 = await ctx.newPage();
  await page2.goto(ORIGIN + '/v519');
  await gotoPraylistHome(page2);
  await openBookPage(page2, 'te-deum');
  const lRow = await page2.evaluate(() => ({
    add: !!document.getElementById('book-add'),
    view: !!document.getElementById('book-view'),
    menu: !!document.getElementById('book-addmenu'),
    landed: (document.querySelector('.bookin') || {}).textContent || null,
  }));
  ok(lRow.add && !lRow.view && !lRow.menu && !lRow.landed,
    'L1: after the removal a fresh open of the prayer page paints the bare Add — no landed state, no View, no overflow seat', JSON.stringify(lRow));
  /* A: re-add through the standing picker */
  await page2.click('#book-add');
  await page2.waitForSelector('.sheet.slotpick', { timeout: 10000 }).catch(() => console.log('note - A sheet slow'));
  await sleep(300);
  await page2.click('[data-slotblock="Evening"]');
  await sleep(300);
  await page2.click('[data-slotpos="end"]');
  await sleep(600);
  const aRow = await page2.evaluate(() => ({
    landed: (document.querySelector('.bookin') || {}).textContent || null,
    menu: !!document.getElementById('book-addmenu'),
    puts: window.__putLog.slice(),
  }));
  const stA = await daStore(page2);
  ok(!!aRow.landed && aRow.landed.includes('Evening') && aRow.menu,
    'A1: the re-add lands the same day — the page reads landed naming Evening, with the overflow seat standing', JSON.stringify(aRow));
  ok(stA && stA.rows.length === 2
    && JSON.stringify(stA.rows[0]) === JSON.stringify({ block: 'Morning', slug: 'anima-christi', lang: 'en', afterId: null })
    && JSON.stringify(stA.rows[1]) === JSON.stringify({ block: 'Evening', slug: 'te-deum', lang: 'en', afterId: null }),
    'A2: the store holds both additions — the survivor untouched, Te Deum re-landed at Evening\'s tail anchor', JSON.stringify(stA));
  await gotoPraylistHome(page2);
  await page2.click('[data-openblock="Evening"]');
  await sleep(600);
  const evIds = await page2.evaluate(() => Array.from(document.querySelectorAll('#view [data-card]')).map((x) => x.getAttribute('data-card')));
  ok(evIds[evIds.length - 1] === 'prayer:te-deum:en',
    'A3: the re-added card stands at the Evening tail', JSON.stringify(evIds));
  await ctx.close();
}

/* ---------------- P: the prayer-page seat ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v519', errs, 'P');
  await seedStore(page, SEED_ROWS);
  await openBookPage(page, 'te-deum');
  const pRow = await page.evaluate(() => ({
    landed: (document.querySelector('.bookin') || {}).textContent || null,
    view: !!document.getElementById('book-view'),
    menu: !!document.getElementById('book-addmenu'),
  }));
  ok(!!pRow.landed && pRow.landed.includes('Evening') && pRow.view && pRow.menu,
    'P1: the landed row carries the overflow seat beside the landed state and View', JSON.stringify(pRow));
  await page.click('#book-addmenu');
  await sleep(400);
  const mi = await menuInfo(page);
  ok(mi && mi.items.length === 1 && mi.items[0] === 'Remove from Praylist',
    'P2: the prayer-page overflow carries the same one act — Remove from Praylist', JSON.stringify(mi));
  await page.click('.menusheet.anchmenu [data-menuitem="0"]');
  await sleep(700);
  const pAfter = await page.evaluate(() => ({
    add: !!document.getElementById('book-add'),
    view: !!document.getElementById('book-view'),
    menu: !!document.getElementById('book-addmenu'),
    landed: (document.querySelector('.bookin') || {}).textContent || null,
    puts: window.__putLog.slice(),
  }));
  const stP = await daStore(page);
  ok(pAfter.add && !pAfter.view && !pAfter.menu && !pAfter.landed
    && pAfter.puts.length === 1 && JSON.stringify(pAfter.puts[0].additions) === JSON.stringify([{ block: 'Morning', slug: 'anima-christi', lang: 'en', afterId: null }]),
    'P3: one tap removes in place — the row returns to its Add state, the PUT carries the list minus Te Deum', JSON.stringify(pAfter));
  ok(stP && stP.rows.length === 1 && stP.rows[0].slug === 'anima-christi',
    'P4: the store holds only the surviving addition after the prayer-page removal', JSON.stringify(stP));
  await gotoPraylistHome(page);
  await page.click('[data-openblock="Evening"]');
  await sleep(600);
  const gone = await page.evaluate(() => !document.querySelector('[data-card="prayer:te-deum:en"]'));
  ok(gone, 'P5: the block page shows no Te Deum card after the prayer-page removal — one list, both surfaces true');
  ok(errs.length === 0, 'P6: no page errors across the prayer-page seat', errs.join(' · '));
  await ctx.close();
}

/* ---------------- F: the failed removal ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v519', errs, 'F');
  await seedStore(page, SEED_ROWS);
  await page.evaluate(() => { window.__daFailPut = true; });
  await page.click('[data-openblock="Evening"]');
  await sleep(600);
  await page.click('[data-card="prayer:te-deum:en"] [data-addmenu]');
  await sleep(400);
  await page.click('.menusheet.anchmenu [data-menuitem="0"]');
  await sleep(700);
  const fInfo = await page.evaluate(() => {
    const card = document.querySelector('.menusheet.anchmenu');
    return {
      cardStands: !!document.querySelector('[data-card="prayer:te-deum:en"]'),
      menuItems: card ? Array.from(card.querySelectorAll('[data-menuitem]')).map((b) => b.textContent.trim()) : null,
      descs: (state.dayDescs || []).map((d) => d.episodeId),
    };
  });
  const stF = await daStore(page);
  ok(fInfo.cardStands && fInfo.menuItems && fInfo.menuItems.length === 2
    && fInfo.menuItems[0].includes('Could not remove') && fInfo.menuItems[1] === 'Remove from Praylist',
    'F1: a failed removal reopens the menu with the failure line above the act — the card stands', JSON.stringify(fInfo.menuItems));
  ok(stF && JSON.stringify(stF.rows) === JSON.stringify(SEED_ROWS) && fInfo.descs.includes('prayer:te-deum:en'),
    'F2: nothing is adopted on failure — the store is byte-unchanged and the day still carries the descriptor', JSON.stringify(stF));
  await ctx.close();
}

/* ---------------- N: negatives (no additions — byte-identical) ---------------- */
{
  const errs = [];
  const b = await boot('/v519', errs, 'N');
  const base = await boot('/base', errs, 'N-base');
  await b.page.click('[data-openblock="Evening"]');
  await base.page.click('[data-openblock="Evening"]');
  await sleep(600);
  const evB = await b.page.evaluate(() => document.getElementById('view').innerHTML);
  const evBase = await base.page.evaluate(() => document.getElementById('view').innerHTML);
  ok(evB === evBase, 'N1: with no additions standing, the Evening block page is byte-identical to the base ship\'s');
  await openBookPage(b.page, 'te-deum');
  await openBookPage(base.page, 'te-deum');
  const np = await b.page.evaluate(() => document.getElementById('book-page').outerHTML);
  const npBase = await base.page.evaluate(() => document.getElementById('book-page').outerHTML);
  ok(np === npBase, 'N2: with the prayer not standing, its page is byte-identical to the base ship\'s — no overflow seat paints');
  ok(errs.length === 0, 'N3: no page errors across the negatives', errs.join(' · '));
  await b.ctx.close();
  await base.ctx.close();
}

await browser.close();
server.close();
console.log(`\n# harness-v519: ${pass} passed / ${fail} failed`);
if (failures.length) { console.log('# failing:', failures.join(' · ')); process.exit(1); }
