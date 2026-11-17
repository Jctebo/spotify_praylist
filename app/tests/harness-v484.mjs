// harness-v484.mjs — v484 prayer audio, small test (Plan §2.9).
// Mold: harness-v483 (statics + the real client extracted into
// Chromium) + harness-v482 (fixtures drawn from production).
// Fixture: fixtures/book-v484-live.json — the LIVE book payload
// read through the prayer door at Plan time (Improvement D:
// the pilot rows exactly as production serves them; the audio
// fold is applied in the harness from the tree's own
// PRAYER_AUDIO map, exactly as bookPayload applies it).
// Legs:
//   ST  statics: the PRAYER_AUDIO map names exactly the six
//       pilots with the renders' measured durations (checked
//       against renders.json) · bookPayload folds `audio`
//       only from the map · the door route refuses outside
//       the map · the session route 404s outside the map and
//       carries the Range idiom · the client guards stand at
//       markCompleted and the four day-position seats · the
//       page paints its acts only under the `audio` fold ·
//       the SW pin stands untouched on this base.
//   A   descriptor: prayerAudioDesc over the live fixture
//       rows — shape per carried language; the two
//       English-only pilots build no Latin descriptor; a
//       non-pilot builds none at all.
//   B   queue + contract: queueLiveDesc stands the prayer
//       descriptor as itself · nativeContractItem resolves
//       it through the own arm (on-origin mediaUri, logo
//       artUri, needsAuth) · nativeContractFor grows no day
//       chain tail behind a prayer.
//   C   marks + positions (Q5 A): markCompleted writes
//       nothing for a prayer and still writes for a day
//       track · the day-position seams post nothing while a
//       prayer is current and still post for a day track.
//   D   the page: a pilot page paints Play + Add to
//       Praylist; Add appends once (dedupe) in the page's
//       language; a non-pilot page paints neither act.
// Run: node app/tests/harness-v484.mjs   (from the worktree root)
import { readFileSync } from 'node:fs';
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
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-v484-live.json', 'utf8'));
const RENDERS = JSON.parse(readFileSync('/home/hatch/workspace/projects/ora-pro-nobis/v484-prayer-audio/renders.json', 'utf8'));

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
  for (const r of RENDERS) { want[r.slug] = want[r.slug] || {}; want[r.slug][r.lang] = r.durationS; }
  ok(JSON.stringify(Object.keys(MAP).sort()) === JSON.stringify(Object.keys(want).sort()),
    'ST1 statics: PRAYER_AUDIO names exactly the six rendered pilots', Object.keys(MAP).join(','));
  let durOk = true;
  for (const slug of Object.keys(want)) for (const lang of Object.keys(want[slug])) {
    if (!MAP[slug] || MAP[slug][lang] !== want[slug][lang]) durOk = false;
  }
  ok(durOk, 'ST2 statics: every map duration equals the render\u2019s measured duration (renders.json)');
  const bp = I_SRC.slice(I_SRC.indexOf('async function bookPayload'), I_SRC.indexOf('async function bookFavorites'));
  ok(bp.includes('const audio = PRAYER_AUDIO[p.slug];') && bp.includes('if (audio) row.audio = audio;'),
    'ST3 statics: bookPayload folds `audio` onto a row only from the map');
  ok(I_SRC.includes('prayer audio outside the pilot map') && I_SRC.includes('`prayer-audio/${paSlug}.${paLang}.mp3`'),
    'ST4 statics: the door audio route refuses outside the pilot map and lands prayer-audio/<slug>.<lang>.mp3');
  const sess = I_SRC.slice(I_SRC.indexOf('seg[3] === "audio" && request.method === "GET"'), I_SRC.indexOf('seg[3] === "favorites" && request.method === "GET"'));
  ok(sess.includes('no audio for that prayer') && sess.includes('"accept-ranges": "bytes"') && sess.includes('status: 206'),
    'ST5 statics: the session audio route 404s outside the map and serves Range (206 + accept-ranges)');
  const mc = C_SRC.slice(C_SRC.indexOf('function markCompleted'), C_SRC.indexOf('function setMediaSessionFor'));
  ok(mc.includes("if (desc.kind === 'prayer') return;"),
    'ST6 statics: markCompleted returns for the prayer kind — no mark is written');
  const guards = (C_SRC.match(/kind === 'prayer'/g) || []).length + (C_SRC.match(/kind !== 'prayer'/g) || []).length;
  ok(guards >= 5, 'ST7 statics: the prayer guard stands at markCompleted, the three day-position seams, and the ended clear', String(guards));
  const opp = C_SRC.slice(C_SRC.indexOf('function openPrayerPage'), C_SRC.indexOf('function closePrayerPage'));
  ok(opp.includes("(p.audio ? '<div class=\"row bookaudio\">") && opp.includes('id="book-play"') && opp.includes('id="book-add"'),
    'ST8 statics: the prayer page paints Play + Add to Praylist only where the audio fold stands');
  ok(opp.includes('state.queue.some(function (x) { return x.episodeId === d.episodeId; })'),
    'ST9 statics: Add to Praylist dedupes on the descriptor\u2019s episodeId');
  ok(U_SRC.includes('ora-pro-nobis-v481-1'), 'ST10 statics: the SW pin stands at ora-pro-nobis-v481-1 on this base (Ship moves it)');
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

const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
<div id="alert"></div><main id="view"></main>
<div id="dock" class="dock hidden"><img class="dockthumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-autoplay" class="docknext dockauto" aria-label="Autoplay">Autoplay On</button><button id="dock-intentions" class="docknext dockauto" aria-label="Intentions" aria-pressed="true">Intentions On</button><button id="dock-prev" class="docknext" aria-label="Previous track">&#9198;</button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><button id="dock-rate" class="docknext dockauto" aria-label="Playback speed">1&times;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
<div id="cards"></div>
<div id="rows"></div>
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  window.__fetchLog.push({ path: String(path) });
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
function refreshPlayedChrome() {}
window.__urlN = 0; window.__revoked = [];
URL.createObjectURL = function () { return 'blob:fake-' + (++window.__urlN); };
URL.revokeObjectURL = function (u) { window.__revoked.push(u); };
</` + `script>
<script>
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null, pendingStart: null,
  storedDay: '2026-11-16', presentedDay: '2026-11-16', dateLabel: 'Monday, November 16', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: null,
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  extSlots: {}, extStanding: [], rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0, book: null, bookFavs: [] };
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
const PILOTS = Object.keys(MAP);

/* ---------------- A: the descriptor ---------------- */
{
  const r = await page.evaluate((pilots) => {
    const out = {};
    const find = (slug) => { let hit = null; state.book.groups.forEach((g) => g.prayers.forEach((p) => { if (p.slug === slug) hit = p; })); return hit; };
    out.descs = {};
    for (const slug of pilots) {
      const p = find(slug);
      out.descs[slug] = { en: prayerAudioDesc(p, 'en'), la: prayerAudioDesc(p, 'la') };
    }
    out.nonPilot = { en: prayerAudioDesc(find('our-father'), 'en'), la: prayerAudioDesc(find('our-father'), 'la') };
    return out;
  }, PILOTS);
  let shape = true;
  for (const slug of PILOTS) {
    const en = r.descs[slug].en;
    if (!en || en.episodeId !== 'prayer:' + slug + ':en' || en.kind !== 'prayer' || en.url !== '/api/prayer/book/audio/' + slug + '/en'
      || en.imageUrl !== '/logo.png' || en.available !== true || !(en.durationS > 0)) shape = false;
    const hasLa = MAP[slug].la !== undefined;
    const la = r.descs[slug].la;
    if (hasLa) { if (!la || la.episodeId !== 'prayer:' + slug + ':la' || !/ \(Latin\)$/.test(la.title)) shape = false; }
    else if (la !== null) shape = false;
  }
  ok(shape, 'A1 descriptor: every pilot builds its carried languages with the settled shape; English-only pilots build no Latin descriptor', JSON.stringify(r.descs['act-of-contrition']));
  ok(r.nonPilot.en === null && r.nonPilot.la === null, 'A2 descriptor: a non-pilot prayer builds no descriptor in either language');
}

/* ---------------- B: queue + native contract ---------------- */
{
  const r = await page.evaluate(() => {
    const find = (slug) => { let hit = null; state.book.groups.forEach((g) => g.prayers.forEach((p) => { if (p.slug === slug) hit = p; })); return hit; };
    const out = { origin: location.origin };
    const step = (name, fn) => { try { out[name] = fn(); } catch (e) { out[name] = 'THREW: ' + String(e && e.message || e); } };
    const d = prayerAudioDesc(find('sub-tuum-praesidium'), 'la');
    out.desc = d;
    step('liveSame', () => queueLiveDesc(d) === d);
    step('item', () => nativeContractItem(d));
    step('contract', () => { state.queue = [d]; state.queueIdx = 0; const c = nativeContractFor(d); state.queue = []; state.queueIdx = -1; return c ? { n: c.contract.items.length, form: c.contract.form } : null; });
    out.n = out.contract && out.contract.n !== undefined ? out.contract.n : -1;
    out.form = out.contract ? out.contract.form : null;
    return out;
  });
  ok(r.liveSame, 'B1 queue: queueLiveDesc stands the prayer descriptor as itself');
  ok(r.item && r.item.kind === 'episode' && r.item.mediaUri === r.origin + '/api/prayer/book/audio/sub-tuum-praesidium/la' && r.item.needsAuth === true,
    'B2 contract: nativeContractItem resolves the prayer through the own arm — on-origin mediaUri, needsAuth', JSON.stringify(r.item));
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
    // day positions: a fake element the seams can read
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
    openPrayerPage('sub-tuum-praesidium');
    const pilot = { play: !!document.getElementById('book-play'), add: !!document.getElementById('book-add') };
    const ab = document.getElementById('book-add');
    if (ab) { ab.click(); ab.click(); }
    const q = state.queue.map((d) => d.episodeId);
    openPrayerPage('our-father');
    const nonPilot = { play: !!document.getElementById('book-play'), add: !!document.getElementById('book-add') };
    return { pilot, q, nonPilot };
  });
  ok(r.pilot.play && r.pilot.add, 'D1 page: a pilot prayer page paints Play + Add to Praylist');
  ok(JSON.stringify(r.q) === JSON.stringify(['prayer:sub-tuum-praesidium:en']), 'D2 page: Add appends the page-language prayer once — the second tap dedupes', JSON.stringify(r.q));
  ok(!r.nonPilot.play && !r.nonPilot.add, 'D3 page: a non-pilot prayer page paints neither act — unchanged');
}

await browser.close();
server.close();
console.log(`\n# harness-v484: ${pass} passed / ${fail} failed`);
if (failures.length) { console.log('# failing:', failures.join(' · ')); process.exit(1); }
