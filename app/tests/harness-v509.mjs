// harness-v509.mjs — v509 prayer audio batch 1 (Plan §2.6).
// Mold: harness-v484 (statics + the real client extracted into
// Chromium + fixtures drawn from production), with the P legs
// driven against a stub of v510's day-additions store in the
// shape of harness-v510's stub (the route's own validation and
// fold mirrored at the fetch seam).
// Fixtures: fixtures/book-v509-live.json — the LIVE book payload
// read through the prayer door (Improvement D; refreshed at
// compose to the compose-time book); renders: the v484 pilot
// renders.json (the six pilots) + the v509 renders.json (the
// 26 new batch-1 prayers) — the map must name exactly their
// union, with their measured durations.
// Legs:
//   ST  statics: the PRAYER_AUDIO map names exactly the 32
//       rendered slugs (6 pilot + 26 batch-1) with measured
//       durations · the fold, door-route refusal, session
//       route Range idiom, and the prayer-kind guards stand
//       as v484 left them · the page paints its acts only
//       under the `audio` fold · the fixture census · the
//       SW pin premise of the base under test.
//   F   file standing: every one of the 48 map files stands
//       in its render record with matching byte size.
//   A   descriptor: prayerAudioDesc over the live fixture —
//       every map slug builds its carried languages with the
//       settled shape; English-only rows build no Latin
//       descriptor; a non-map prayer builds none.
//   B   queue + contract (v484's legs, on a batch-1 prayer).
//   C   marks + positions (Q5 A, v484's legs).
//   D   the page: a batch-1 page paints Play + Add; a
//       non-batch, non-pilot page paints neither.
//   P   the v510 slot picker (the amendment leg), on a
//       batch-1 page (Morning Offering): one Add tap opens
//       the picker on the seven blocks and issues no request
//       · a cancelled picker writes nothing · picking a
//       block + an After position issues exactly one whole-
//       list PUT and the page paints the landed state naming
//       the block, with View standing · the landing reads
//       back from the store (a fresh page open paints landed
//       from the day fold; the folded day list stands the
//       prayer at its slot) · View sets the landing seam
//       (praylistLanding + pendingBlock) toward the chosen
//       block. On a pre-v510 base the P legs read not-ok BY
//       PREMISE (the picker is v510's build) and are
//       recorded as-is; on the composed v510+ base they
//       must pass.
// Run: node app/tests/harness-v509.mjs   (from the worktree root)
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';

const ROOT = process.cwd();
const APP = ROOT + '/app';
const CLIENT = APP + '/worker/src/client.ts';
const INDEX = APP + '/worker/src/index.ts';
const UI = APP + '/worker/src/ui.ts';
const C_SRC = readFileSync(CLIENT, 'utf8');
const I_SRC = readFileSync(INDEX, 'utf8');
const U_SRC = readFileSync(UI, 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-v509-live.json', 'utf8'));
const RENDERS484 = JSON.parse(readFileSync('/home/hatch/workspace/projects/ora-pro-nobis/v484-prayer-audio/renders.json', 'utf8'));
const RENDERS509 = JSON.parse(readFileSync('/home/hatch/workspace/projects/ora-pro-nobis/v509-prayer-audio/renders.json', 'utf8'));
const RENDER_DIRS = { v484: '/home/hatch/workspace/projects/ora-pro-nobis/v484-prayer-audio', v509: '/home/hatch/workspace/projects/ora-pro-nobis/v509-prayer-audio' };
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const PIN_PREMISE = process.env.V509_PIN || null; // the base's pin, named by the run

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- the tree's own PRAYER_AUDIO map ---------------- */
let MAP = {};
try {
  const at = I_SRC.indexOf('const PRAYER_AUDIO:');
  const mapSrc = I_SRC.slice(at, I_SRC.indexOf('};', at) + 1);
  MAP = eval('(' + mapSrc.replace(/const PRAYER_AUDIO:[^=]*=/, '').replace(/;$/, '') + ')');
} catch (e) { MAP = {}; }

/* ---------------- statics ---------------- */
{
  const want = {};
  for (const r of RENDERS484.concat(RENDERS509)) { want[r.slug] = want[r.slug] || {}; want[r.slug][r.lang] = r.durationS; }
  ok(JSON.stringify(Object.keys(MAP).sort()) === JSON.stringify(Object.keys(want).sort()),
    'ST1 statics: PRAYER_AUDIO names exactly the 32 rendered slugs (6 pilot + 26 batch-1)', Object.keys(MAP).join(','));
  let durOk = true;
  for (const slug of Object.keys(want)) for (const lang of Object.keys(want[slug])) {
    if (!MAP[slug] || MAP[slug][lang] !== want[slug][lang]) durOk = false;
  }
  ok(durOk, 'ST2 statics: every map duration equals its render\u2019s measured duration (both renders.json)');
  const bp = I_SRC.slice(I_SRC.indexOf('async function bookPayload'), I_SRC.indexOf('async function bookFavorites'));
  ok(bp.includes('const audio = PRAYER_AUDIO[p.slug];') && bp.includes('if (audio) row.audio = audio;'),
    'ST3 statics: bookPayload folds `audio` onto a row only from the map');
  ok(I_SRC.includes('prayer audio outside the pilot map') && I_SRC.includes('`prayer-audio/${paSlug}.${paLang}.mp3`'),
    'ST4 statics: the door audio route refuses outside the map and lands prayer-audio/<slug>.<lang>.mp3');
  const sess = I_SRC.slice(I_SRC.indexOf('seg[3] === "audio" && request.method === "GET"'), I_SRC.indexOf('seg[3] === "favorites" && request.method === "GET"'));
  ok(sess.includes('no audio for that prayer') && sess.includes('"accept-ranges": "bytes"') && sess.includes('status: 206'),
    'ST5 statics: the session audio route 404s outside the map and serves Range (206 + accept-ranges)');
  const mc = C_SRC.slice(C_SRC.indexOf('function markCompleted'), C_SRC.indexOf('function setMediaSessionFor'));
  ok(mc.includes("if (desc.kind === 'prayer') return;"),
    'ST6 statics: markCompleted returns for the prayer kind — no mark is written');
  const guards = (C_SRC.match(/kind === 'prayer'/g) || []).length + (C_SRC.match(/kind !== 'prayer'/g) || []).length;
  ok(guards >= 5, 'ST7 statics: the prayer guard stands at markCompleted, the three day-position seams, and the ended clear', String(guards));
  const opp = C_SRC.slice(C_SRC.indexOf('function openPrayerPage'), C_SRC.indexOf('function closePrayerPage'));
  ok(opp.includes('id="book-play"') && opp.includes('id="book-add"') && opp.includes('p.audio'),
    'ST8 statics: the prayer page paints Play + Add to Praylist only where the audio fold stands');
  const groups = BOOK.groups.map((g) => g.prayers.length);
  ok(BOOK.groups.length === 9 && groups.reduce((a, b) => a + b, 0) === 77,
    'ST9 fixture: the live book stands at 77 prayers in 9 groups (post-v506 census, refreshed at compose)', groups.join('/'));
  if (PIN_PREMISE) ok(U_SRC.includes(PIN_PREMISE), 'ST10 statics: the SW pin stands at ' + PIN_PREMISE + ' on this base (Ship moves it)');
}

/* ---------------- F: file standing ---------------- */
{
  let allOk = true; const missing = [];
  for (const [tag, renders] of [['v484', RENDERS484], ['v509', RENDERS509]]) {
    for (const r of renders) {
      const f = RENDER_DIRS[tag] + '/' + r.file;
      if (!existsSync(f) || statSync(f).size !== r.bytes || r.bytes < 20000) { allOk = false; missing.push(r.file); }
    }
  }
  ok(allOk, 'F1 files: all 48 map files stand in their render records with matching, non-trivial byte sizes', missing.join(','));
}

/* ---------------- client extraction (v412/v483 mold) ---------------- */
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
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));

/* The stub book fold for the day-additions stub store:
   slug -> {title, audio} exactly as the fixture carries it. */
const STUBROWS = {};
for (const g of BOOK.groups) for (const p of g.prayers) STUBROWS[p.slug] = { title: p.title, audio: MAP[p.slug] || null };

const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
<div id="alert"></div><main id="view"></main>
<div id="dock" class="dock hidden"><img class="dockthumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-autoplay" class="docknext dockauto" aria-label="Autoplay">Autoplay On</button><button id="dock-intentions" class="docknext dockauto" aria-label="Intentions" aria-pressed="true">Intentions On</button><button id="dock-prev" class="docknext" aria-label="Previous track">&#9198;</button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><button id="dock-rate" class="docknext dockauto" aria-label="Playback speed">1&times;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
<div id="cards"></div>
<div id="rows"></div>
<script>
window.__fetchLog = [];
window.__putLog = [];
window.__daStore = { date: '${TODAY}', rows: [] };
var STUBROWS = ${JSON.stringify(STUBROWS)};
var STUB_BLOCKS = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
function daFold(rows) {
  return rows.map(function (r) {
    var hit = STUBROWS[r.slug];
    var a = hit && hit.audio ? hit.audio[r.lang] : null;
    if (!hit || !a) return null;
    return { block: r.block, slug: r.slug, lang: r.lang, afterId: r.afterId === undefined ? null : r.afterId, title: hit.title, durationS: a };
  }).filter(Boolean);
}
window.fetch = function (path, opts) {
  var p = String(path);
  window.__fetchLog.push({ path: p, method: (opts && opts.method) || 'GET' });
  var ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status,
    json: function () { return Promise.resolve(body); },
    text: function () { return Promise.resolve(JSON.stringify(body)); } }); };
  if (p.indexOf('/api/player/day-additions') === 0) {
    var body = {};
    try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
    window.__putLog.push(body);
    if (body.date !== '${TODAY}' || !Array.isArray(body.additions)) return ans(400, { error: 'bad additions' });
    var seen = {}, rows = [];
    for (var i = 0; i < body.additions.length; i++) {
      var a = body.additions[i];
      if (!a || STUB_BLOCKS.indexOf(a.block) < 0) return ans(400, { error: 'bad block' });
      var hit = STUBROWS[a.slug];
      if (!hit || !hit.audio || !hit.audio[a.lang]) return ans(400, { error: 'bad prayer audio' });
      var key = a.slug + '|' + a.lang;
      if (seen[key]) continue;
      seen[key] = 1;
      rows.push({ block: a.block, slug: a.slug, lang: a.lang, afterId: a.afterId === undefined ? null : a.afterId });
    }
    window.__daStore = { date: body.date, rows: rows };
    return ans(200, { ok: true, date: body.date, additions: rows });
  }
  if (p === '/api/player/day' || p.indexOf('/api/player/day?') === 0) {
    return ans(200, { ok: true, presentedDay: '${TODAY}', date: '${TODAY}', additions: daFold(window.__daStore.rows), blocks: [], tracks: [] });
  }
  return ans(200, { ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
function refreshPlayedChrome() {}
window.__urlN = 0; window.__revoked = [];
URL.createObjectURL = function () { return 'blob:fake-' + (++window.__urlN); };
URL.revokeObjectURL = function (u) { window.__revoked.push(u); };
</` + `script>
<script>
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null, pendingStart: null,
  storedDay: '${TODAY}', presentedDay: '${TODAY}', dateLabel: 'Today', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: null,
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  extSlots: {}, extStanding: [], rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0, book: null, bookFavs: [],
  dayAdditions: [], dayAdditionsDate: null, pendingBlock: null };
try { localStorage.setItem('opn-intentions-v384', 'off'); } catch (e) {}
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS) + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
await page.goto(ORIGIN + '/');

/* The live fixture with the fold applied from the tree's map —
   the exact rows the client will hold once the fold ships. */
const folded = JSON.parse(JSON.stringify(BOOK));
for (const g of folded.groups) for (const p of g.prayers) if (MAP[p.slug]) p.audio = MAP[p.slug];
await page.evaluate((b) => { state.book = b; }, folded);
const MAPSLUGS = Object.keys(MAP);
const NONMAP = (() => { let hit = null; BOOK.groups.forEach((g) => g.prayers.forEach((p) => { if (!hit && !MAP[p.slug]) hit = p.slug; })); return hit; })();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- A: the descriptor ---------------- */
{
  const r = await page.evaluate(({ slugs, nonmap }) => {
    const find = (slug) => { let hit = null; state.book.groups.forEach((g) => g.prayers.forEach((p) => { if (p.slug === slug) hit = p; })); return hit; };
    const out = { descs: {} };
    for (const slug of slugs) {
      const p = find(slug);
      out.descs[slug] = { en: prayerAudioDesc(p, 'en'), la: prayerAudioDesc(p, 'la') };
    }
    out.nonMap = { en: prayerAudioDesc(find(nonmap), 'en'), la: prayerAudioDesc(find(nonmap), 'la') };
    return out;
  }, { slugs: MAPSLUGS, nonmap: NONMAP });
  let shape = true;
  for (const slug of MAPSLUGS) {
    const en = r.descs[slug].en;
    if (!en || en.episodeId !== 'prayer:' + slug + ':en' || en.kind !== 'prayer' || en.url !== '/api/prayer/book/audio/' + slug + '/en'
      || en.imageUrl !== '/logo.png' || en.available !== true || !(en.durationS > 0)) shape = false;
    const hasLa = MAP[slug].la !== undefined;
    const la = r.descs[slug].la;
    if (hasLa) { if (!la || la.episodeId !== 'prayer:' + slug + ':la' || !/ \(Latin\)$/.test(la.title)) shape = false; }
    else if (la !== null) shape = false;
  }
  ok(shape, 'A1 descriptor: every one of the 32 map prayers builds its carried languages with the settled shape; English-only rows build no Latin descriptor');
  ok(r.nonMap.en === null && r.nonMap.la === null, 'A2 descriptor: a non-map prayer (' + NONMAP + ') builds no descriptor in either language');
}

/* ---------------- B: queue + native contract ---------------- */
{
  const r = await page.evaluate(() => {
    const find = (slug) => { let hit = null; state.book.groups.forEach((g) => g.prayers.forEach((p) => { if (p.slug === slug) hit = p; })); return hit; };
    const out = { origin: location.origin };
    const step = (name, fn) => { try { out[name] = fn(); } catch (e) { out[name] = 'THREW: ' + String(e && e.message || e); } };
    const d = prayerAudioDesc(find('our-father'), 'la');
    out.desc = d;
    step('liveSame', () => queueLiveDesc(d) === d);
    step('item', () => nativeContractItem(d));
    step('contract', () => { state.queue = [d]; state.queueIdx = 0; const c = nativeContractFor(d); state.queue = []; state.queueIdx = -1; return c ? { n: c.contract.items.length, form: c.contract.form } : null; });
    out.n = out.contract && out.contract.n !== undefined ? out.contract.n : -1;
    out.form = out.contract ? out.contract.form : null;
    return out;
  });
  ok(r.liveSame, 'B1 queue: queueLiveDesc stands the batch-1 prayer descriptor as itself');
  ok(r.item && r.item.kind === 'episode' && r.item.mediaUri === r.origin + '/api/prayer/book/audio/our-father/la' && r.item.needsAuth === true,
    'B2 contract: nativeContractItem resolves the batch-1 prayer through the own arm — on-origin mediaUri, needsAuth', JSON.stringify(r.item));
  ok(r.item && r.item.artUri === r.origin + '/logo.png', 'B3 contract: the prayer\u2019s contract artUri is the Ora logo on the origin', JSON.stringify(r.item && r.item.artUri));
  ok(r.n === 1 && r.form === 'day', 'B4 contract: a prayer queue\u2019s contract holds exactly the prayer — no day chain tail grows behind it', JSON.stringify({ n: r.n, form: r.form }));
}

/* ---------------- C: marks + positions ---------------- */
{
  const r = await page.evaluate(() => {
    const find = (slug) => { let hit = null; state.book.groups.forEach((g) => g.prayers.forEach((p) => { if (p.slug === slug) hit = p; })); return hit; };
    const pd = prayerAudioDesc(find('guardian-angel'), 'en');
    const before = localStorage.getItem('opn-played-v344');
    markCompleted(pd);
    const afterPrayer = localStorage.getItem('opn-played-v344');
    const dayDesc = { episodeId: 'morning-prayer', kind: 'episode', block: 'Morning', title: 'Morning Prayer', available: true };
    markCompleted(dayDesc);
    const afterDay = localStorage.getItem('opn-played-v344');
    const realEl = audioEl;
    audioEl = { paused: false, ended: false, currentTime: 30, duration: 100 };
    state.current = pd;
    window.__fetchLog.length = 0;
    dayPositionTick(); dayPositionSaveCurrent(); dayPositionSkipAway({ episodeId: 'other' });
    const prayerPosts = window.__fetchLog.filter((f) => f.path.includes('day-position')).length;
    const dayCur = { episodeId: 'morning-prayer', kind: 'episode', block: 'Morning', durationS: 100 };
    state.current = dayCur;
    window.__fetchLog.length = 0;
    dayPositionSaveCurrent();
    const dayPosts = window.__fetchLog.filter((f) => f.path.includes('day-position')).length;
    audioEl = realEl; state.current = null;
    return { before, afterPrayer, afterDay, prayerPosts, dayPosts };
  });
  ok(r.afterPrayer === r.before, 'C1 marks: markCompleted writes no played record for a prayer', JSON.stringify(r.afterPrayer));
  ok(r.afterDay !== r.afterPrayer && (r.afterDay || '').includes('morning-prayer'), 'C2 marks: markCompleted still writes the played record for a day track');
  ok(r.prayerPosts === 0, 'C3 positions: the day-position seams post nothing while a prayer is current', String(r.prayerPosts));
  ok(r.dayPosts === 1, 'C4 positions: the same seams still post for a day track — the guard is kind-scoped', String(r.dayPosts));
}

/* ---------------- D: the prayer page ---------------- */
{
  const r = await page.evaluate(() => {
    view = document.getElementById('view');
    state.queue = []; state.queueIdx = -1; state.current = null;
    openPrayerPage('our-father');
    return { play: !!document.getElementById('book-play'), add: !!document.getElementById('book-add') };
  });
  ok(r.play && r.add, 'D1 page: a batch-1 prayer page (Our Father) paints Play + Add to Praylist');
  const r2 = await page.evaluate((nonmap) => {
    openPrayerPage(nonmap);
    return { play: !!document.getElementById('book-play'), add: !!document.getElementById('book-add') };
  }, NONMAP);
  ok(!r2.play && !r2.add, 'D2 page: a non-batch, non-pilot prayer page (' + NONMAP + ') paints neither act — unchanged');
}

/* ---------------- P: the v510 slot picker (amendment leg) ---------------- */
{
  const hasPicker = C_SRC.includes('function openSlotPicker');
  if (!hasPicker) {
    ok(false, 'P1 picker: one Add tap on a batch-1 page opens the slot picker on the seven blocks, no request issued (PREMISE: the picker is v510\u2019s build, absent from this base)');
    ok(false, 'P2 picker: a cancelled picker writes nothing (PREMISE)');
    ok(false, 'P3 picker: the pick issues exactly one whole-list PUT and the page paints the landed state naming the block, View standing (PREMISE)');
    ok(false, 'P4 read-back: the landing reads back from the store — a fresh open paints landed from the day fold and the folded day list stands the prayer at its slot (PREMISE)');
    ok(false, 'P5 view: View sets the landing seam toward the chosen block (PREMISE)');
  } else {
    /* a built day for the position step: two standing
       Morning items, the payload dated today */
    await page.evaluate((today) => {
      view = document.getElementById('view');
      state.dayDescs = [
        { episodeId: 'day-m1', kind: 'episode', block: 'Morning', title: 'Morning Item One', available: true },
        { episodeId: 'day-m2', kind: 'episode', block: 'Morning', title: 'Morning Item Two', available: true },
      ];
      state.dayPayload = { presentedDay: today, date: today };
      state.dayAdditions = []; state.dayAdditionsDate = today;
      window.__daStore = { date: today, rows: [] };
      window.__putLog.length = 0;
      state.queue = []; state.queueIdx = -1; state.current = null;
      openPrayerPage('morning-offering');
    }, TODAY);
    await sleep(300);
    const p1 = await page.evaluate(() => {
      const add = document.getElementById('book-add');
      const putsBefore = window.__putLog.length;
      if (add) add.click();
      const sheet = document.querySelector('.slotpick');
      const blocks = sheet ? Array.from(sheet.querySelectorAll('[data-slotblock]')).map((r) => r.getAttribute('data-slotblock')) : [];
      return { addStood: !!add, sheet: !!sheet, blocks, puts: window.__putLog.length - putsBefore };
    });
    ok(p1.addStood && p1.sheet && JSON.stringify(p1.blocks) === JSON.stringify(['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night']) && p1.puts === 0,
      'P1 picker: one Add tap on a batch-1 page opens the slot picker on the seven blocks in standing order, no request issued', JSON.stringify(p1));
    const p2 = await page.evaluate(() => {
      const sheet = document.querySelector('.slotpick');
      if (sheet) sheet.click(); // the backdrop seam: a click on the sheet itself dismisses
      return { gone: !document.querySelector('.slotpick'), puts: window.__putLog.length,
        rows: window.__daStore.rows.length, queue: state.queue.length };
    });
    ok(p2.gone && p2.puts === 0 && p2.rows === 0 && p2.queue === 0,
      'P2 picker: a cancelled picker writes nothing — no PUT, the store stands empty, the queue untouched', JSON.stringify(p2));
    const p3 = await page.evaluate(async () => {
      openPrayerPage('morning-offering');
      await new Promise((r) => setTimeout(r, 250));
      document.getElementById('book-add').click();
      const sheet = document.querySelector('.slotpick');
      sheet.querySelector('[data-slotblock="Morning"]').click();
      const pos = Array.from(sheet.querySelectorAll('[data-slotpos]')).map((r) => r.getAttribute('data-slotpos'));
      sheet.querySelector('[data-slotpos="day-m1"]').click();
      await new Promise((r) => setTimeout(r, 350));
      const row = document.getElementById('book-audio-row');
      return { pos, puts: window.__putLog.slice(), sheetGone: !document.querySelector('.slotpick'),
        landed: row ? (row.textContent || '') : '', viewBtn: !!document.getElementById('book-view'),
        addBtn: !!document.getElementById('book-add'), queue: state.queue.length,
        store: JSON.parse(JSON.stringify(window.__daStore.rows)) };
    });
    ok(JSON.stringify(p3.pos) === JSON.stringify(['', 'day-m1', 'day-m2', 'end']),
      'P3a picker: the position step names the start, an After row per standing Morning item, and the end', JSON.stringify(p3.pos));
    ok(p3.puts.length === 1 && p3.puts[0].date === TODAY && JSON.stringify(p3.puts[0].additions) === JSON.stringify([{ block: 'Morning', slug: 'morning-offering', lang: 'en', afterId: 'day-m1' }]),
      'P3b pick: exactly one whole-list PUT lands Morning Offering in Morning after the first standing item', JSON.stringify(p3.puts));
    ok(p3.sheetGone && /In today\u2019s Praylist/.test(p3.landed) && /Morning/.test(p3.landed) && p3.viewBtn && !p3.addBtn && p3.queue === 0,
      'P3c landed: the sheet closes, the page paints the landed state naming Morning with View standing and no Add, the queue untouched', p3.landed);
    ok(p3.store.length === 1 && p3.store[0].slug === 'morning-offering' && p3.store[0].afterId === 'day-m1',
      'P3d store: the day-additions store holds the one addition at its slot', JSON.stringify(p3.store));
    const p4 = await page.evaluate(async () => {
      /* a fresh open: clear the adopted state; the page's
         own day read must re-adopt from the store fold */
      state.dayAdditions = []; state.dayAdditionsDate = null;
      openPrayerPage('morning-offering');
      await new Promise((r) => setTimeout(r, 400));
      const row = document.getElementById('book-audio-row');
      const base = [
        { episodeId: 'day-m1', kind: 'episode', block: 'Morning', title: 'Morning Item One', available: true },
        { episodeId: 'day-m2', kind: 'episode', block: 'Morning', title: 'Morning Item Two', available: true },
      ];
      const foldedList = foldDayAdditions(base.slice()).map((d) => d.episodeId);
      return { landed: row ? (row.textContent || '') : '', foldedList,
        adopted: JSON.parse(JSON.stringify(state.dayAdditions || [])) };
    });
    ok(/In today\u2019s Praylist/.test(p4.landed) && /Morning/.test(p4.landed) && p4.adopted.length === 1,
      'P4a read-back: a fresh open of the prayer page paints the landed state from the store fold, not from local state', p4.landed);
    ok(JSON.stringify(p4.foldedList) === JSON.stringify(['day-m1', 'prayer:morning-offering:en', 'day-m2']),
      'P4b landing in the list: the folded day list stands the prayer directly after its anchor, at its chosen slot', JSON.stringify(p4.foldedList));
    const p5 = await page.evaluate(() => {
      const orig = switchSide;
      let ssArgs = null;
      switchSide = function () { ssArgs = Array.from(arguments); };
      const vb = document.getElementById('book-view');
      if (vb) vb.click();
      const landing = praylistLanding ? { block: praylistLanding.block, episodeId: praylistLanding.episodeId } : null;
      const pending = state.pendingBlock;
      switchSide = orig;
      return { landing, pending, ssArgs };
    });
    ok(p5.landing && p5.landing.block === 'Morning' && p5.landing.episodeId === 'prayer:morning-offering:en' && p5.pending === 'Morning',
      'P5 view: View sets the landing seam — praylistLanding + pendingBlock name the chosen block and the prayer', JSON.stringify(p5));
  }
}

await browser.close();
server.close();
console.log(`\n# harness-v509: ${pass} passed / ${fail} failed`);
if (failures.length) { console.log('# failing:', failures.join(' · ')); process.exit(1); }
