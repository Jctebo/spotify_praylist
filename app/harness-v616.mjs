// harness-v616.mjs — v616: John's field verdict on v615
//  (2026-11-22 09:24 CT): "The play should be gone and
//  replaced with a play disc" — the Praylist's "Play All"
//  text pill is REMOVED whole (no whole-day control), and
//  each group head's disc is a PLAY DISC: the standing
//  .playbtn.small gold disc carrying the block's own
//  [data-queue] act. A disc tap plays that block (its
//  standing queue, in order) and does NOT fold; a head tap
//  elsewhere still folds. The disc greys through the SAME
//  v615 seam (refreshPlayedChrome / opnCounts615, the
//  var(--muted) "all" fill) exactly at the block's last
//  mark, un-greys on mark removal, and stays tappable
//  greyed. The v615 unplayed counts stand untouched —
//  the H2/H3/H4/H6/H7 legs below are v615's, carried over.
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (the day his phone served).
//  - tests/fixtures-v597/production-source-settings.json —
//    his production source settings (v8, 26 sources).
//  - ~/workspace/projects/ora-pro-nobis/john-personal-data-
//    import-v589.json — his own exported document; the H9
//    vault envelope is built FROM it by the client's own
//    opnVaultCreate (the harness-v612/v609vault recipe).
//  - H6's _occ copies follow harness-v610's world (the
//    duplicated Divine Office hour, ext-morning-prayer).
// The old-client ref is the v615 tree (fe80f32), pinned by
//  commit: the OA legs must FAIL there (the Play All text
//  pill stands with data-queue="__all", and the head disc
//  is a hollow played-dot SPAN — no playbtn, no queue act).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrc = git(['show', 'fe80f32:app/worker/src/client.ts']); // fail-on-old pin: the v615 tree
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const PIN = '2468';

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = renderJs(oldClientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
check('T0b ui.ts carries the v616 play-disc dress (the standing .playbtn.small gold disc in var(--accent) + the v615 grey "all" rule in var(--muted) on the head disc\u2019s ::after)',
  uiSrc.includes(".playbtn.small::after { content:''; position:absolute; z-index:-1; left:7px; top:7px; width:30px; height:30px; border-radius:50%; background:var(--accent); }")
  && uiSrc.includes('.p609sethead .p615disc {') && uiSrc.includes('.p609sethead .p615disc.all::after { background:var(--muted); border-color:var(--muted); }')
  && clientSrc.includes('class="playbtn small p615disc'));
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v616:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opn604: (typeof opn604 !== "undefined" ? opn604 : null), opnLocalApi, opnDoc, opnVaultLocked, opnVaultCreate, opnVaultUnlockWithPin, opnRawKeyB64: function () { return opnVaultRawKey ? opnB64(opnVaultRawKey) : null; }, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, resolveReadingsSeat590, resolveProfileCourses590, markCompleted, writePlayed, isPlayedDesc, refreshPlayedChrome, opnCounts615, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const OLD_HOOK = '\n;window.__opn = { state, opn604: (typeof opn604 !== "undefined" ? opn604 : null), opnLocalApi, opnDoc, opnVaultLocked, opnVaultCreate, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, resolveReadingsSeat590, resolveProfileCourses590, markCompleted, writePlayed, isPlayedDesc, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' };
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js, store, bridge, hook) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + (hook || HOOK);
  w.document.body.appendChild(s);
  if (bridge) w.Capacitor = { Plugins: { OraDayBridge: bridge } };
  return w;
}
function bridgeStub(opts) {
  const calls = { unlock: 0, status: 0 };
  const base = {
    vaultBiometricStatus: () => { calls.status++; return Promise.resolve(opts.status); },
    vaultBiometricUnlock: () => { calls.unlock++; return opts.unlock(); },
    vaultBiometricClear: () => Promise.resolve({}),
    vaultBiometricEnroll: () => Promise.resolve({}),
  };
  const proxy = new Proxy(base, { get: (t, k) => { if (k === 'then') return undefined; return k in t ? t[k] : () => Promise.resolve({}); } });
  return { plugin: proxy, calls };
}
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0('2026-11-21');
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
async function paintRealDay(w, daySrc) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(daySrc || DAY597)));
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
// The expected {total, unplayed} per block run, computed in
// the harness from the descriptor list with the spec's own
// reads (available only; podcast → listened; else the
// occurrence-aware isPlayedDesc on the presented date).
function expectedCounts(O, tracks) {
  let total = 0, unplayed = 0;
  (tracks || []).forEach((t) => {
    if (!t.available) return;
    total++;
    if (t.kind === 'podcast' ? !t.listened : !O.isPlayedDesc(t, DATE)) unplayed++;
  });
  return { total, unplayed };
}
function groupRuns(O, descs) {
  const runs = [];
  (descs || []).forEach((t) => {
    const b = t.block || 'Episodes';
    if (runs.length && runs[runs.length - 1].block === b) runs[runs.length - 1].tracks.push(t);
    else runs.push({ block: b, tracks: [t] });
  });
  return runs.map((r) => ({ block: r.block, tracks: r.tracks, ...expectedCounts(O, r.tracks) }));
}
const headEl = (d, block) => d.querySelector('[data-p609sethead="' + block + '"]');
const countOf = (d, block) => { const el = d.querySelector('[data-p615count="' + block + '"]'); return el ? el.textContent : null; };
const discOf = (d, block) => d.querySelector('[data-p615disc="' + block + '"]');
const markable = (x) => x.available && x.episodeId && x.episodeId.indexOf('intro:') !== 0 && x.kind !== 'podcast' && x.kind !== 'prayer' && x.kind !== 'homily';
// A real-day block whose available tracks ALL complete
// through markCompleted (no podcast/prayer/homily kinds),
// smallest first — the H2/H4 target.
function pickCompletableBlock(O, descs) {
  const runs = groupRuns(O, descs).filter((r) => r.total >= 1 && r.tracks.every((t) => !t.available || markable(t)));
  runs.sort((a, b) => a.total - b.total);
  return runs[0] || null;
}
function writeMark(O, x) {
  O.writePlayed(x.episodeId, DATE, 'marked', x._occ ? (x.block || x._block) : x.block, x._occ || 0);
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
// The block queue the standing [data-queue] act must build
// (the wirePrayersView filter + queueBuild, mirrored from
// the spec's own reads): the block's descriptors (the tail:
// the block-less ones), unplayedOnly, with queueBuild's
// fully-played fallback to the whole block.
function expectedBlockQueue(O, descs, block) {
  const sel = block === 'Episodes' ? (descs || []).filter((x) => !x.block) : (descs || []).filter((x) => x.block === block);
  const un = sel.filter((x) => x.kind === 'podcast' ? !x.listened : !O.isPlayedDesc(x, DATE));
  const built = un.some((x) => x.available) ? un : sel;
  return built.map((x) => x.episodeId);
}

// ---------- H1 ◆ paint: unplayed counts + one disc per head ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const runs = groupRuns(O, descs);
  const heads = [...d.querySelectorAll('[data-p609sethead]')];
  check('H1a ◆ paint: every painted head\u2019s count == the computed UNPLAYED count for its block (not the total)',
    heads.length === runs.length && runs.length >= 3 && runs.every((r) => countOf(d, r.block) === String(r.unplayed)),
    { heads: heads.length, runs: runs.map((r) => ({ b: r.block, u: r.unplayed, t: r.total, got: countOf(d, r.block) })) });
  check('H1b ◆ paint: exactly ONE [data-p615disc] per painted head, seated inside its head',
    heads.every((h) => h.querySelectorAll('[data-p615disc]').length === 1)
    && d.querySelectorAll('[data-p615disc]').length === heads.length,
    { discs: d.querySelectorAll('[data-p615disc]').length, heads: heads.length });
  check('H1c ◆ paint: each head\u2019s disc is a PLAY DISC — a BUTTON in the .playbtn.small gold dress (glyph \u25b6, NOT a played-dot span), carrying its block\u2019s [data-queue] act (the tail: "__episodes"), gold state (no "all") while unplayed > 0',
    runs.every((r) => { const disc = discOf(d, r.block); return disc && disc.tagName === 'BUTTON' && disc.classList.contains('playbtn') && disc.classList.contains('small') && !disc.classList.contains('played-dot') && disc.textContent.trim() === '\u25b6' && disc.getAttribute('data-queue') === (r.block === 'Episodes' ? '__episodes' : r.block); })
    && runs.filter((r) => r.unplayed > 0).every((r) => { const disc = discOf(d, r.block); return disc && !disc.classList.contains('all'); }),
    runs.map((r) => { const disc = discOf(d, r.block); return { b: r.block, tag: disc && disc.tagName, cls: disc && disc.getAttribute('class'), q: disc && disc.getAttribute('data-queue') }; }));
  // N1 rides this same paint.
  const set = d.querySelector('[data-p609set]');
  check('N1 ◆ NO Play All pill anywhere in the painted page: no [data-queue="__all"] element, no .p604exphead row, and no "Play All" text stands in the set',
    !!set && !d.querySelector('[data-queue="__all"]') && !set.querySelector('.p604exphead') && ![...set.querySelectorAll('*')].some((el) => el.children.length === 0 && el.textContent.trim() === 'Play All'),
    { all: !!d.querySelector('[data-queue="__all"]'), row: !!set && !!set.querySelector('.p604exphead') });
  w.close();
}

// ---------- P2 ◆ disc tap plays the block, does not fold ----------
// ---------- P6 ◆ a FOLDED block's disc plays the WHOLE block ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const runs = groupRuns(O, descs);
  const target = runs.find((r) => expectedBlockQueue(O, descs, r.block).length >= 2) || runs[0];
  const other = runs.find((r) => r.block !== (target && target.block) && expectedBlockQueue(O, descs, r.block).length >= 1);
  check('P2a a target block with a multi-track queue + a bystander block stand folded (no cards painted)',
    !!target && !!other && !d.querySelector('[data-p609set] [data-card]'),
    { target: target && target.block, other: other && other.block });
  if (target) {
    const expected = expectedBlockQueue(O, descs, target.block);
    click(w, discOf(d, target.block));
    await sleep(200);
    const queue = (O.state.queue || []).map((t) => t.episodeId);
    check('P2b ◆ disc tap PLAYS THAT BLOCK: state.queue == the block\u2019s standing queue, in order (queueBuild over the block\u2019s descriptors only)',
      JSON.stringify(queue) === JSON.stringify(expected) && queue.length > 0,
      { queue, expected });
    check('P2c ◆ disc tap does NOT fold/unfold: the set still paints heads only (no cards), and the head\u2019s count stands unchanged',
      !d.querySelector('[data-p609set] [data-card]') && countOf(d, target.block) === String(target.unplayed),
      { cards: d.querySelectorAll('[data-p609set] [data-card]').length, count: countOf(d, target.block) });
  }
  if (other) {
    O.state.queue = []; O.state.queueIdx = -1; O.state.current = null;
    const expectedOther = expectedBlockQueue(O, descs, other.block);
    click(w, discOf(d, other.block));
    await sleep(200);
    const queueOther = (O.state.queue || []).map((t) => t.episodeId);
    check('P6 ◆ folded block\u2019s disc plays the WHOLE block: the bystander block stands folded (its tracks paint NO cards) yet its disc queues every track of its standing queue, in order',
      JSON.stringify(queueOther) === JSON.stringify(expectedOther) && expectedOther.length >= 1 && !d.querySelector('[data-p609set] [data-card]'),
      { queueOther, expectedOther });
  }
  w.close();
}

// ---------- P3 ◆ head tap outside the disc still folds ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const runs = groupRuns(O, descs);
  const target = runs[0];
  click(w, headEl(d, target.block)); // the head itself — not the disc
  await sleep(200);
  const cards = d.querySelectorAll('[data-p609set] [data-card]').length;
  check('P3 ◆ head tap outside the disc FOLDS/UNFOLDS as before (v612): tapping the head expands its group — its tracks\u2019 cards paint, and no queue starts',
    !!target && cards === target.tracks.length && !(O.state.queue || []).length,
    { cards, want: target && target.tracks.length, queue: (O.state.queue || []).length });
  w.close();
}

// ---------- H2 ◆ all-played through writePlayed ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const runs = groupRuns(O, descs);
  const target = pickCompletableBlock(O, descs);
  const other = runs.find((r) => r.block !== (target && target.block));
  const otherBefore = other ? countOf(d, other.block) : null;
  check('H2a a completable target block + a bystander block stand in the production day', !!target && !!other, { target: target && target.block });
  if (target && other) {
    target.tracks.filter((t) => t.available).forEach((x) => writeMark(O, x));
    await sleep(60);
    const disc = discOf(d, target.block);
    check('H2b ◆ all-played: after writePlayed marks for EVERY available track of the block, its head count reads 0 and its disc carries "all"',
      countOf(d, target.block) === '0' && !!disc && disc.classList.contains('all'),
      { count: countOf(d, target.block), cls: disc && disc.getAttribute('class') });
    check('H2c ◆ the bystander block\u2019s head is unchanged', countOf(d, other.block) === otherBefore,
      { before: otherBefore, after: countOf(d, other.block) });
  }
  w.close();
}

// ---------- H3 ◆ live drop, folded ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const runs = groupRuns(O, descs);
  const target = runs.find((r) => r.tracks.some(markable) && r.unplayed >= 1) || null;
  check('H3a ◆ folded paint stands (heads only, no cards) over a block with a markable track',
    !!target && !d.querySelector('[data-p609set] [data-card]'), { target: target && target.block });
  if (target) {
    const countElBefore = d.querySelector('[data-p615count="' + target.block + '"]');
    const before = Number(countElBefore.textContent);
    const track = target.tracks.find(markable);
    O.markCompleted(track); // the real completion seam
    await sleep(60);
    const countElAfter = d.querySelector('[data-p615count="' + target.block + '"]');
    check('H3b ◆ live drop, folded: markCompleted drops the FOLDED head\u2019s count by one in place — the SAME DOM node, no repaint',
      countElAfter === countElBefore && Number(countElAfter.textContent) === before - 1,
      { before, after: countElAfter && countElAfter.textContent, sameNode: countElAfter === countElBefore });
  }
  w.close();
}

// ---------- H4 ◆ Play All finish: the disc greys at the last mark ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const target = pickCompletableBlock(O, descs);
  check('H4a a completable target block stands', !!target, { target: target && target.block });
  if (target) {
    const tracks = target.tracks.filter((t) => t.available);
    let notAllBeforeLast = false, allAfter = false, countAfter = null;
    tracks.forEach((x, i) => {
      O.markCompleted(x);
      const disc = discOf(d, target.block);
      if (i === tracks.length - 1) { allAfter = !!disc && disc.classList.contains('all'); countAfter = countOf(d, target.block); }
      else if (disc && !disc.classList.contains('all')) notAllBeforeLast = true;
    });
    await sleep(60);
    check('H4b ◆ the disc greys EXACTLY at the last markCompleted (not-all before it, "all" + count 0 after it)',
      (tracks.length === 1 || notAllBeforeLast) && allAfter && countAfter === '0',
      { n: tracks.length, notAllBeforeLast, allAfter, countAfter });
  }
  w.close();
}

// ---------- synthetic worlds (H5 · H6 · H7 · H10) ----------
async function paintSynthetic(w, descs) {
  const O = w.__opn;
  await paintRealDay(w); // the standing world (doc, fold, view) stands first
  O.state.dayDescs = descs;
  O.state.presentedDay = DATE;
  O.paintPrayersView(O.state.dayPayload);
  await sleep(120);
}
function synthTrack(over) {
  return Object.assign({ episodeId: 'synth-1', title: 'Synth track', block: 'Morning', available: true, streamUrl: 'https://example.invalid/s.mp3', durationS: 30 }, over || {});
}

// ---------- H5 ◆ Episodes tail (chrome) + P7 ◆ its disc plays the tail ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintSynthetic(w, [
    synthTrack({ episodeId: 'synth-m1', block: 'Morning' }),
    synthTrack({ episodeId: 'synth-e1', block: undefined }),
    synthTrack({ episodeId: 'synth-e2', block: undefined }),
  ]);
  const disc = discOf(d, 'Episodes');
  check('H5 ◆ Episodes tail: block-less descriptors paint an \u2018Episodes\u2019 head with the unplayed count (2) + a play disc under the same rules (BUTTON .playbtn.small, data-queue="__episodes", gold state)',
    !!headEl(d, 'Episodes') && countOf(d, 'Episodes') === '2' && !!disc && !disc.classList.contains('all')
    && disc.tagName === 'BUTTON' && disc.classList.contains('playbtn') && disc.getAttribute('data-queue') === '__episodes',
    { count: countOf(d, 'Episodes'), disc: !!disc, q: disc && disc.getAttribute('data-queue') });
  // H10 rides this paint: blocks with no tracks paint no head.
  check('H10 ◆ zero-track: a block with no tracks (Night) paints NO head and NO disc',
    !headEl(d, 'Night') && !discOf(d, 'Night') && !d.querySelector('[data-p615count="Night"]'));
  w.close();
}

// ---------- P7 ◆ Episodes tail disc plays the tail's tracks ----------
// The tail's production source: the day payload's episodes
// (extRebuildDescs appends them block-less through
// trackDesc — the paint's and the queue's one source).
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const daySrc = JSON.parse(JSON.stringify(DAY597));
  daySrc.episodes = [
    { episodeId: 'tail-1', title: 'Tail episode one', streamUrl: 'https://example.invalid/t1.mp3', available: true, durationS: 30 },
    { episodeId: 'tail-2', title: 'Tail episode two', streamUrl: 'https://example.invalid/t2.mp3', available: true, durationS: 30 },
  ];
  const { descs } = await paintRealDay(w, daySrc);
  const tail = (descs || []).filter((x) => !x.block);
  const disc = discOf(d, 'Episodes');
  check('P7a the production-shaped tail stands: block-less descriptors paint an Episodes head whose disc carries data-queue="__episodes"',
    tail.length === 2 && !!headEl(d, 'Episodes') && !!disc && disc.getAttribute('data-queue') === '__episodes',
    { tail: tail.map((x) => x.episodeId), disc: !!disc });
  if (disc) {
    click(w, disc);
    await sleep(200);
    const queue = (O.state.queue || []).map((t) => t.episodeId);
    check('P7b ◆ Episodes tail disc PLAYS THE TAIL: state.queue == the tail\u2019s tracks in order, and the tap does not fold (no cards paint)',
      JSON.stringify(queue) === JSON.stringify(['tail-1', 'tail-2']) && !d.querySelector('[data-p609set] [data-card]'),
      { queue });
  }
  w.close();
}

// ---------- P5 ◆ the disc un-greys when a mark is removed ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const only = synthTrack({ episodeId: 'synth-u1', block: 'Morning' });
  await paintSynthetic(w, [only]);
  O.markCompleted(only);
  await sleep(60);
  const greyed = discOf(d, 'Morning');
  const wasGrey = !!greyed && greyed.classList.contains('all') && countOf(d, 'Morning') === '0';
  const tappable = !!greyed && greyed.tagName === 'BUTTON' && !greyed.disabled;
  O.writePlayed(only.episodeId, DATE, null, 'Morning', 0); // the standing un-mark write (wirePlayed's toggle)
  await sleep(60);
  const discAfter = discOf(d, 'Morning');
  check('P5 ◆ un-grey: the disc greys at the block\u2019s only mark and STAYS TAPPABLE (a BUTTON, not disabled); removing the mark through writePlayed un-greys it in place and the count reads 1 again',
    wasGrey && tappable && !!discAfter && !discAfter.classList.contains('all') && countOf(d, 'Morning') === '1',
    { wasGrey, tappable, after: discAfter && discAfter.getAttribute('class'), count: countOf(d, 'Morning') });
  w.close();
}

// ---------- H6 ◆ occurrence copies (harness-v610's world) ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const copy0 = synthTrack({ episodeId: 'ext-morning-prayer', title: 'Morning Prayer' });
  const copy1 = synthTrack({ episodeId: 'ext-morning-prayer', title: 'Morning Prayer', _occ: 1 });
  O.state.repeatIds = { 'ext-morning-prayer': true }; // the fold's own stamp (refreshRepeatIds over 2 copies)
  await paintSynthetic(w, [copy0, copy1]);
  const before = countOf(d, 'Morning');
  O.markCompleted(copy0);
  await sleep(60);
  const mid = countOf(d, 'Morning');
  const discMid = discOf(d, 'Morning');
  const discMidCls = discMid ? discMid.getAttribute('class') : '';
  const discMidAll = !!discMid && discMid.classList.contains('all'); // classList, not substring: "small" contains "all"
  O.markCompleted(copy1);
  await sleep(60);
  const discEnd = discOf(d, 'Morning');
  check('H6 ◆ occurrence copies: the two _occ copies count SEPARATELY (head reads 2); marking one copy drops the count by one and the disc does NOT grey; marking BOTH greys it',
    before === '2' && mid === '1' && !!discMidCls && !discMidAll
    && countOf(d, 'Morning') === '0' && !!discEnd && discEnd.classList.contains('all'),
    { before, mid, end: countOf(d, 'Morning'), discMidCls, discEndCls: discEnd && discEnd.getAttribute('class') });
  w.close();
}

// ---------- H7 ◆ podcast ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const pod = synthTrack({ episodeId: 'ser615:ep-1', kind: 'podcast', seriesKey: 'ser615:ep-1', podSeries: 'ser615', block: 'Morning', listened: false, title: 'Pod episode' });
  const plain = synthTrack({ episodeId: 'synth-p1', block: 'Morning' });
  await paintSynthetic(w, [pod, plain]);
  const before = countOf(d, 'Morning');
  // The real completion seam: the ended handler calls
  // markCompleted(state.current) — the playing descriptor
  // IS the dayDescs object (the queue builds from it), so
  // podSyncQueueListened flips this same copy's flag.
  O.state.current = pod;
  O.state.queue = [pod, plain];
  O.markCompleted(pod);
  await sleep(60);
  const after = countOf(d, 'Morning');
  check('H7 ◆ podcast: a podcast descriptor (listened=false) counts as unplayed (head reads 2); after markCompleted → writePodMarkQuiet its dayDescs copy\u2019s listened flag FLIPS (podSyncQueueListened over the current/queue copies) and the head count drops to 1 in the same act',
    before === '2' && pod.listened === true && after === '1',
    { before, after, listened: pod.listened });
  w.close();
}

// ---------- H9 ◆ vault locked ----------
let envelope = null;
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  O.opnDoc();
  await O.opnVaultCreate(PIN, 'RECOVERY-CODE-1');
  envelope = w.localStorage.getItem(DATA_KEY);
  check('H9a the envelope is built from his real document by the client\u2019s own vault create', !!envelope);
  w.close();
}
{
  const { plugin } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.reject(new Error('user-cancelled: 13')) });
  const w = makeWorld(appJs, { [DATA_KEY]: envelope }, plugin);
  await sleep(400);
  const O = w.__opn, d = w.document;
  O.paintMergedContainer('prayers');
  await sleep(1800);
  check('H9b ◆ vault locked: the GATE stands and the painted home carries NO [data-p615disc], NO [data-p615count] and NO Play All act (no head state is read or written while locked)',
    O.opnVaultLocked() === true && !!d.querySelector('[data-p609lock]')
    && !d.querySelector('[data-p615disc]') && !d.querySelector('[data-p615count]') && !d.querySelector('[data-queue="__all"]'),
    { locked: O.opnVaultLocked(), gate: !!d.querySelector('[data-p609lock]') });
  w.close();
}

// ---------- OA ◆ fail-on-old (the v615 tree, fe80f32) ----------
{
  const w = makeWorld(oldJs, { [DATA_KEY]: JSON.stringify(JOHN) }, null, OLD_HOOK);
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const runs = groupRuns(O, descs);
  const target = runs[0];
  const disc = discOf(d, target.block);
  const pill = d.querySelector('[data-p609set] [data-queue="__all"]');
  check('OA ◆ fail-on-old: on the v615 client the v616 legs FAIL — the Play All text pill STANDS (btn ghost, data-queue="__all"), and the head disc is a hollow played-dot SPAN (no playbtn, no [data-queue] act of its own)',
    !!pill && pill.textContent.trim() === 'Play All' && !!disc && disc.tagName === 'SPAN'
    && disc.classList.contains('played-dot') && !disc.classList.contains('playbtn') && !disc.getAttribute('data-queue'),
    { pill: !!pill, tag: disc && disc.tagName, cls: disc && disc.getAttribute('class') });
  w.close();
}

console.log('harness-v616:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
