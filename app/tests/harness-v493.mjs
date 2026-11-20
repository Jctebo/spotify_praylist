// harness-v493.mjs — v493 evidence: the Mass tab gains a
// Liturgy | Virtual toggle; the Catholic TV Mass stands
// first under Virtual; the CatholicTV series leaves
// Catechesis whole; the Catechesis toggle drops to two
// sides (Courses · Podcasts).
// John's words (Ora thread, 2026-11-17): "First tab is
// liturgy and second tab is virtual and under virtual put
// the Catholic TV mass as the first entry. Will add more" ·
// "Yes. It leaves xatechesis" · "So catechism will now have
// 2 tabs".
// Legs (the real SHELL_HTML + APP_CSS + the whole cooked
// client in Chromium — the v439/v478 mold; fetch stubbed):
//   S   statics — the Virtual entries list (one entry, the
//       Catholic TV Mass, series catholictv) · the Formation
//       index append retired server-side · the two-side
//       Catechesis cfg · ui.ts + the mass sources untouched ·
//       paintMassScroll byte-identical to the v492 ship tree
//       · the v491 Exit player items stand
//   P   cooked parse + Chromium boot clean
//   A   the Mass tab carries the Liturgy | Virtual toggle
//       (connected, one row, row 2), Liturgy on first open,
//       and the Liturgy scroll byte-for-byte the v492 build's
//       rendering of the same fixture day
//   B   side switch swaps in place and back with no state
//       loss (version · EP · Latin · text size · scroll),
//       and the chosen side is remembered across a reopen
//   C   Virtual lists exactly one entry, the Catholic TV
//       Mass, first and only; its tap opens the standing
//       CatholicTV series page under the Mass tab (back
//       destination Mass); a video opens the watch view;
//       the backs return step by step to the Virtual side
//   D   Catechesis: the index carries no CatholicTV trace,
//       the toggle carries exactly Courses · Podcasts (no
//       Video & more segment), Counsel of Trent and The
//       Exorcist Files stand in Podcasts, and a device whose
//       stored side is the retired 'video' opens on Courses
//   E   nav order/labels as the v492 base carries them
//       (Mass · Pray · Conscience · Catechesis · Sacred
//       Art, untouched by v493); the player is untouched
//       (a play/pause cycle runs clean)
// Fixtures stand in the production payload shapes
// (Improvement D): the Mass payload in mass.ts's shape, the
// readings feed in mass-readings.ts's shape, the podcasts
// index/series payloads in index.ts's shapes — the index
// fixture is the POST-v493 shape (no video entry stands).
// Run: node app/tests/harness-v493.mjs   (from the worktree root)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const SHIP = path.resolve(process.cwd(), '../../.worktrees/v492-ship/app/worker/src');
const C492 = readFileSync(SHIP + '/client.ts', 'utf8');
const U492 = readFileSync(SHIP + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- S: statics ---------------- */
{
  const ve = C_SRC.slice(C_SRC.indexOf('var MASS_VIRTUAL_ENTRIES'), C_SRC.indexOf('var massPodReturn'));
  ok((ve.match(/series: '/g) || []).length === 1 && ve.includes("title: 'Catholic TV Mass'") && ve.includes("series: 'catholictv'"),
    'S1: the Virtual entries list carries exactly one entry — the Catholic TV Mass, series catholictv');
  const idx = I_SRC.slice(I_SRC.indexOf('async function podIndexPayload'), I_SRC.indexOf('---- Podcasts VIDEO series'));
  ok(!idx.includes('podVideoIndexEntry(env'), 'S2: podIndexPayload no longer appends any video index entry (Catechesis carries no CatholicTV)');
  ok(I_SRC.includes('const POD_VIDEO_SERIES_LIST'), 'S3: the video series def stands — the series payload route is the Virtual entry target');
  ok(C_SRC.includes("sides: [['courses', 'Courses'], ['podcasts', 'Podcasts']]"), 'S4: the Catechesis toggle cfg carries exactly two sides, Courses · Podcasts');
  ok(C_SRC.includes("sides: [['liturgy', 'Liturgy'], ['virtual', 'Virtual']]"), 'S5: the Mass toggle cfg carries Liturgy · Virtual, Liturgy the default');
  const pinNorm = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pinNorm(U_SRC) === pinNorm(U492), 'S6: ui.ts identical to the v492 ship tree apart from the SW pin line (the v492 nav stands; header + CSS untouched by v493)');
  let same = true;
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts']) {
    if (readFileSync(SRC + '/' + f, 'utf8') !== readFileSync(SHIP + '/' + f, 'utf8')) same = false;
  }
  ok(same, 'S7: mass.ts / mass-order.ts / mass-readings.ts / mass-calendar.ts byte-identical to the v492 ship tree');
  const ps = (s) => s.slice(s.indexOf('function paintMassScroll()'), s.indexOf('function wireMassEp()'));
  ok(ps(C_SRC) === ps(C492), 'S8: paintMassScroll is byte-identical to the v492 ship tree (the Liturgy rendering stands)');
  ok(C_SRC.includes("{ label: 'Exit player', act: function () { exitPlayer(); } }"), 'S9: the v491 Exit player act stands in the menus');
}

/* ---------------- fixtures + pages ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED492 = null;
try { COOKED = cook(C_SRC); ok(true, 'P1: the cooked APP_JS parses (the v439 gate)'); }
catch (e) { ok(false, 'P1: the cooked APP_JS parses (the v439 gate)', String(e).slice(0, 160)); }
try { COOKED492 = cook(C492); } catch (e) { console.log('note - v492 base cook failed:', String(e).slice(0, 120)); }
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
const FORMULARY_A = {
  entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
  collect: 'O God, who made the Memorial of Saint Elizabeth a sign of your care, grant, we pray, that we may follow her example. Through our Lord Jesus Christ, your Son.',
  prayerOverOfferings: 'Accept, O Lord, the offerings we bring in honor of Saint Elizabeth.',
  prefaceText: null, prefaceName: null,
  communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
  prayerAfterCommunion: 'Nourished by this sacrament, O Lord, may we imitate Saint Elizabeth in charity.',
};
const FORMULARY_B = {
  entranceAntiphon: { text: 'The Lord speaks of peace to his people.', ref: 'Ps 85' },
  collect: 'Grant us, Lord our God, that we may honor you with all our mind. Through our Lord Jesus Christ, your Son.',
  prayerOverOfferings: 'Look with favor, O Lord, on the offerings of your people.',
  prefaceText: null, prefaceName: null,
  communionAntiphon: { text: 'Whoever eats this bread will live for ever.', ref: 'Jn 6' },
  prayerAfterCommunion: 'May the working of your mercy, O Lord, guide our hearts.',
};
const MASS_PAYLOAD = {
  ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary',
  defaultVersion: 'elizabeth',
  versions: [
    { key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: FORMULARY_A },
    { key: 'feria', label: 'Tuesday of the 33rd Week', rank: null, formulary: FORMULARY_B },
  ],
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me: Because you are lukewarm, I will spit you out of my mouth.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. (Rev. 3: 21) I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice; who thinks the truth in his heart and slanders not with his tongue.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town. Now a man there named Zacchaeus, who was a chief tax collector and also a wealthy man, was seeking to see who Jesus was.</p>' },
] };
const POD_INDEX = { ok: true, seriesList: [
  { series: 'catechism', title: 'Catechism in a Year', available: true, listenedCount: 5, total: 369, currentKey: 'd6', currentLabel: 'Day 6', showImageUrl: '', category: 'courses' },
  { series: 'bible', title: 'Bible in a Year', available: true, listenedCount: 300, total: 365, currentKey: 'd321', currentLabel: 'Day 321', showImageUrl: '', category: 'courses' },
  { series: 'counsel-of-trent', title: 'Counsel of Trent', kind: 'rss', category: 'podcasts', available: true, listenedCount: 0, total: 12, latestLabel: 'Nov 13', showImageUrl: '' },
  { series: 'exorcist-files', title: 'The Exorcist Files', kind: 'rss', category: 'podcasts', available: true, listenedCount: 0, total: 24, latestLabel: 'Nov 13', showImageUrl: '' },
  { series: 'the-ai-signal', title: 'The AI Signal', kind: 'own', category: 'podcasts', available: true, currentLabel: 'Today', showImageUrl: '/logo.png' },
] };
const POD_VIDEO = { ok: true, kind: 'video', series: 'catholictv', title: 'CatholicTV', available: true, stale: false, builtAt: '2026-11-17T12:00:00Z',
  videos: [
    { id: 'vid001', title: 'Catholic Mass Today | November 17, 2026 | CatholicTV Daily Mass', url: 'https://www.youtube.com/watch?v=vid001', publishedMs: 1763400000000, dateLabel: 'Nov 17, 2026', imageUrl: '', descText: null },
    { id: 'vid002', title: 'CatholicTV News | November 16, 2026', url: 'https://www.youtube.com/watch?v=vid002', publishedMs: 1763313600000, dateLabel: 'Nov 16, 2026', imageUrl: '', descText: null },
  ] };

function buildPage(cooked) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${APP_CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  const p = String(path);
  const method = (opts && opts.method) || 'GET';
  let body = null;
  try { body = opts && opts.body ? JSON.parse(opts.body) : null; } catch (e) {}
  window.__fetchLog.push({ path: p, method: method, body: body });
  if (p.indexOf('/api/player/day') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(DAY)}); } });
  if (p.indexOf('/api/prayer/mass?') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(MASS_PAYLOAD)}); } });
  if (p.indexOf('/api/prayer/mass-readings') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(MASS_FEED)}); } });
  if (p.indexOf('/api/player/podcasts?series=catholictv') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(POD_VIDEO)}); } });
  if (p.indexOf('/api/player/podcasts') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(POD_INDEX)}); } });
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
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

let PAGE = '', PAGE492 = '';
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/v493') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  if (u === '/v492') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE492); return; }
  res.statusCode = 404; res.end('not found');
});
PAGE = buildPage(COOKED);
PAGE492 = buildPage(COOKED492);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(ctx, which, tag, errs) {
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
  });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note -', tag, 'openblock slow'));
  await sleep(500);
  return page;
}
async function openMass(page) {
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note - mass scroll slow'));
  await sleep(700);
}

/* ---------------- A + B + C: the Mass tab ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, '/v493', 'A', errs);
  ok(errs.length === 0, 'P2: Chromium boot clean, no page errors', errs.join(' · '));
  await openMass(page);

  const tg = await page.evaluate(() => {
    const t = document.querySelector('#hdrrow2 #sidetoggle');
    if (!t) return null;
    const btns = Array.from(t.querySelectorAll('button'));
    const rs = btns.map((b) => { const r = b.getBoundingClientRect(); return { y: Math.round(r.top), x: Math.round(r.left), w: Math.round(r.width) }; });
    return { cls: t.className, labels: btns.map((b) => b.textContent), active: btns.map((b) => b.classList.contains('active')),
      title: (document.getElementById('hdr2-title') || {}).textContent, sameRow: rs.length === 2 && Math.abs(rs[0].y - rs[1].y) <= 1,
      adjacent: rs.length === 2 && Math.abs((rs[0].x + rs[0].w) - rs[1].x) <= 3 };
  });
  ok(tg && tg.labels.join('|') === 'Liturgy|Virtual' && tg.active.join() === 'true,false',
    'A1: the Mass tab carries the Liturgy | Virtual toggle, Liturgy active on first open', JSON.stringify(tg));
  ok(tg && tg.cls.includes('segtoggle') && tg.cls.includes('pill') && tg.sameRow && tg.adjacent && tg.title === 'Liturgy',
    'A2: the toggle is the standing connected pill — one row, joined segments, in header row 2', JSON.stringify(tg));
  const secs = await page.evaluate(() => Array.from(document.querySelectorAll('.mass-section')).map((n) => n.textContent));
  ok(secs.join('|') === 'Introductory Rites|Liturgy of the Word|Liturgy of the Eucharist|Communion Rite|Concluding Rites',
    'A3: the Liturgy scroll stands with its five big section titles (v489)', secs.join('|'));

  // (a) byte-for-byte: the same fixture day through the v492 build
  const page492 = await boot(ctx, '/v492', 'A-base', errs);
  await openMass(page492);
  const html493 = await page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const html492 = await page492.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  ok(!!html493 && html493 === html492, 'A4: the Liturgy scroll renders byte-for-byte as the v492 build renders the same day',
    'len493=' + (html493 || '').length + ' len492=' + (html492 || '').length);
  await page492.close();

  // (b) set the scroll's state, switch away and back
  await page.click('[data-version="feria"]');
  await sleep(400);
  await page.click('[data-ep="IV"]');
  await sleep(300);
  await page.click('[data-lt="kyrie:la"]');
  await sleep(300);
  await page.click('[data-tsize="1"]');
  await sleep(400);
  await page.evaluate(() => window.scrollTo(0, 320));
  await sleep(300);
  const before = await page.evaluate(() => ({ v: state.mass.version, ep: state.mass.ep, ky: state.mass.latin.kyrie, ts: state.mass.textSize }));
  ok(before.v === 'feria' && before.ep === 'IV' && before.ky === 'la' && before.ts === 2,
    'B1 precondition: version feria · EP IV · Kyrie Greek · text size Large all stand', JSON.stringify(before));
  await page.click('#sidetoggle [data-side="virtual"]');
  await sleep(600);
  const onVirtual = await page.evaluate(() => ({ title: (document.getElementById('hdr2-title') || {}).textContent,
    entries: Array.from(document.querySelectorAll('[data-massventry]')).map((c) => c.querySelector('h3').textContent),
    scrollGone: !document.querySelector('.mass-scroll') }));
  ok(onVirtual.title === 'Virtual' && onVirtual.scrollGone, 'B2: the switch swaps the side in place — the scroll leaves, the Virtual side stands', JSON.stringify(onVirtual));
  ok(onVirtual.entries.length === 1 && onVirtual.entries[0] === 'Catholic TV Mass',
    'C1: Virtual lists exactly one entry — the Catholic TV Mass, first and only', JSON.stringify(onVirtual.entries));
  await page.click('#sidetoggle [data-side="liturgy"]');
  await sleep(900);
  const after = await page.evaluate(() => ({ v: state.mass.version, ep: state.mass.ep, ky: state.mass.latin.kyrie, ts: state.mass.textSize,
    y: window.scrollY, tsCls: (document.querySelector('.mass-scroll') || { className: '' }).className }));
  ok(after.v === 'feria' && after.ep === 'IV' && after.ky === 'la' && after.ts === 2 && after.tsCls.includes('ts-2'),
    'B3: the scroll returns with its state as left — version, EP, Latin, text size', JSON.stringify(after));
  ok(after.y >= 280, 'B4: the Liturgy side scroll position is restored across the switch', 'y=' + after.y);

  // (b2) the chosen side is remembered across a reopen
  await page.click('#sidetoggle [data-side="virtual"]');
  await sleep(500);
  const stored = await page.evaluate(() => localStorage.getItem('opn-tabside-mass-v493'));
  ok(stored === 'virtual', 'B5: the chosen side is stored on the device (opn-tabside-mass-v493 = virtual)', String(stored));
  await page.reload();
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => {});
  await sleep(500);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await sleep(800);
  const reopened = await page.evaluate(() => ({ title: (document.getElementById('hdr2-title') || {}).textContent,
    entries: document.querySelectorAll('[data-massventry]').length, scroll: !!document.querySelector('.mass-scroll') }));
  ok(reopened.title === 'Virtual' && reopened.entries === 1 && !reopened.scroll,
    'B6: a reopen lands on the remembered side — Virtual, with its entry standing', JSON.stringify(reopened));

  // (c) the entry opens the series, the watch, and the backs return
  await page.click('[data-massventry="catholictv-mass"]');
  await page.waitForSelector('[data-podvideo]', { timeout: 15000 }).catch(() => console.log('note - series slow'));
  await sleep(600);
  const series = await page.evaluate(() => ({ rows: Array.from(document.querySelectorAll('[data-podvideo] h3')).map((n) => n.textContent),
    back: (document.querySelector('#hdrrow2 [data-podback]') || {}).getAttribute ? document.querySelector('#hdrrow2 [data-podback]').getAttribute('aria-label') : null,
    fetched: window.__fetchLog.some((f) => f.path.indexOf('/api/player/podcasts?series=catholictv') === 0) }));
  ok(series.rows.length === 2 && /Catholic Mass Today/.test(series.rows[0]),
    'C2: the entry tap paints the CatholicTV series page — the daily Mass video stands first', JSON.stringify(series.rows));
  ok(series.back === 'Back to Mass' && series.fetched, 'C3: the series page stands under the Mass tab (back destination Mass; the standing series route served it)', JSON.stringify(series));
  await page.click('[data-podvideo="vid001"]');
  await sleep(800);
  const watch = await page.evaluate(() => { const f = document.querySelector('iframe.podwatch-frame'); return f ? f.getAttribute('src') : null; });
  ok(!!watch && watch.includes('youtube.com/embed/vid001'), 'C4: a video row opens the watch view (the standing embed)', String(watch));
  await page.click('#hdrrow2 [data-podwatchback]');
  await sleep(700);
  const backToSeries = await page.evaluate(() => document.querySelectorAll('[data-podvideo]').length);
  ok(backToSeries === 2, 'C5: back from the watch returns to the series page standing under Mass', 'rows=' + backToSeries);
  await page.click('#hdrrow2 [data-podback]');
  await sleep(700);
  const backToVirtual = await page.evaluate(() => ({ title: (document.getElementById('hdr2-title') || {}).textContent,
    entries: document.querySelectorAll('[data-massventry]').length, toggle: !!document.querySelector('#hdrrow2 #sidetoggle') }));
  ok(backToVirtual.title === 'Virtual' && backToVirtual.entries === 1 && backToVirtual.toggle,
    'C6: back from the series page returns to the Virtual side, the toggle standing again', JSON.stringify(backToVirtual));
  ok(errs.length === 0, 'C7: no page errors across the Mass toggle + Virtual flows', errs.join(' · '));
  await ctx.close();
}

/* ---------------- D + E: Catechesis and the untouched rest ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, '/v493', 'D', errs);
  await page.click('#tabbar .tab[data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries]', { timeout: 15000 }).catch(() => console.log('note - index slow'));
  await sleep(700);
  const idx = await page.evaluate(() => {
    const t = document.querySelector('#hdrrow2 #sidetoggle');
    const btns = t ? Array.from(t.querySelectorAll('button')) : [];
    return { labels: btns.map((b) => b.textContent), active: btns.filter((b) => b.classList.contains('active')).map((b) => b.textContent),
      cards: Array.from(document.querySelectorAll('[data-podseries] h3')).map((n) => n.textContent),
      row2: (document.getElementById('hdrrow2') || { textContent: '' }).textContent, viewText: document.getElementById('view').textContent };
  });
  ok(idx.labels.join('|') === 'Courses|Podcasts', 'D1: the Catechesis toggle carries exactly two sides — Courses · Podcasts', idx.labels.join('|'));
  ok(!/Video & more/.test(idx.row2), 'D2: no Video & more segment stands in the toggle', idx.row2.slice(0, 80));
  ok(idx.active.join() === 'Courses' && idx.cards.join('|') === 'Catechism in a Year|Bible in a Year',
    'D3: Courses stands with its series as before', JSON.stringify(idx.cards));
  ok(!/CatholicTV/.test(idx.viewText) && !idx.cards.some((c) => /CatholicTV/.test(c)),
    'D4: no CatholicTV trace stands in Catechesis (no row, no remnant)');
  await page.click('#sidetoggle [data-side="podcasts"]');
  await sleep(700);
  const podCards = await page.evaluate(() => Array.from(document.querySelectorAll('[data-podseries] h3')).map((n) => n.textContent));
  ok(podCards.join('|') === 'Counsel of Trent|The Exorcist Files|The AI Signal',
    'D5: the Podcasts side stands untouched — Counsel of Trent · The Exorcist Files · The AI Signal', podCards.join('|'));

  const nav = await page.evaluate(() => Array.from(document.querySelectorAll('#tabbar .tab')).map((b) => b.getAttribute('data-tab') + ':' + b.textContent.trim()));
  ok(nav.join('|') === 'mass:\u2720Mass|prayers:\u2726Pray|conscience:\u271dConscience|podcasts:\u266bCatechesis|wallpaper:\u25a3Sacred Art',
    'E1: the bottom nav stands as the v492 base carries it — Mass · Pray · Conscience · Catechesis · Sacred Art (order + labels untouched by v493)', nav.join('|'));

  // the player untouched: a day-track play/pause cycle runs clean
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await sleep(800);
  await page.click('[data-openblock="Morning"]');
  await sleep(700);
  await page.click('[data-playkey="9001"]');
  await sleep(800);
  const playing = await page.evaluate(() => ({ cur: state.current && state.current.episodeId, hidden: document.getElementById('dock').classList.contains('hidden') }));
  ok(playing.cur === '9001' && !playing.hidden, 'E2: the player stands — a day track plays and the dock shows', JSON.stringify(playing));
  await page.evaluate(() => { exitPlayer(); });
  await sleep(500);
  const exited = await page.evaluate(() => ({ cur: state.current, hidden: document.getElementById('dock').classList.contains('hidden') }));
  ok(exited.cur === null && exited.hidden, 'E3: the v491 Exit player act stands and clears as shipped', JSON.stringify(exited));
  ok(errs.length === 0, 'E4: no page errors across the Catechesis + player flows', errs.join(' · '));
  await ctx.close();
}

/* ---------------- D6: a device holding the retired side ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, '/v493', 'D6', errs);
  await page.evaluate(() => localStorage.setItem('opn-tabside-podcasts-v464', 'video'));
  await page.click('#tabbar .tab[data-tab="podcasts"]');
  await page.waitForSelector('[data-podseries]', { timeout: 15000 }).catch(() => console.log('note - index slow (retired side)'));
  await sleep(700);
  const landed = await page.evaluate(() => {
    const t = document.querySelector('#hdrrow2 #sidetoggle');
    const btns = t ? Array.from(t.querySelectorAll('button')) : [];
    return { labels: btns.map((b) => b.textContent), active: btns.filter((b) => b.classList.contains('active')).map((b) => b.textContent),
      side: tabSideNow.podcasts, cards: document.querySelectorAll('[data-podseries]').length };
  });
  ok(landed.side === 'courses' && landed.active.join() === 'Courses' && landed.labels.join('|') === 'Courses|Podcasts' && landed.cards === 2,
    'D6: a stored side of video (the retired Video & more) lands on Courses with the two-side toggle standing', JSON.stringify(landed));
  ok(errs.length === 0, 'D7: no page errors on the retired-side landing', errs.join(' · '));
  await ctx.close();
}

await browser.close();
server.close();
console.log('\nharness-v493: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
