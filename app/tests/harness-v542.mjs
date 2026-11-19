// harness-v542.mjs — v542 evidence: the player fix in
// three parts (John's order, Ora thread, 2026-11-19
// 06:01 CT + the 06:02 CT amendment). Part 1 — with
// autoplay OFF, selecting a track plays that one track
// only and stops at its end; autoplay ON stands as today.
// The defect, named from the code: tapPlay built the
// block queue without ever reading the autoplay setting,
// and the queue advance at a track's end is
// unconditional — autoplay gated only the chain past a
// queue. Part 2 — a track's overflow menu gains Add to
// queue (day rows + podcast rows): the track appends to
// the current playback queue without interrupting what
// is playing; behind a single play it forms the queue on
// it; with nothing playing it forms a waiting queue and
// starts nothing; the kind bound (a track joins only a
// queue of its own kind) stands. Part 3 — the Now
// Playing overflow gains Clear queue, standing only
// while a queue stands: the queue empties and the
// playing track re-seats as a single play (its end
// follows the standing single-play rule). Native mode:
// the contract is the only queue channel — a mutation
// while the engine plays re-sends it headed at the
// current track at its live position; a mutation while
// the engine stands paused waits as a divergence the
// resume seam carries in.
//   S statics: no new migration · index.ts byte-
//     identical to the production base (v539-ship @
//     20198f9, read from git) · ui.ts identical but for
//     the pin · startDesc and the draw seams byte-
//     identical (the v528/v539 Intention draw rides
//     untouched) · the autoplay store and the explicit
//     queue acts byte-identical · the v542 seams stand
//     (the tapPlay branch, the two acts, the divergence
//     read, Clear queue in the player menu only)
//   C1 premise (the base blob): the production tapPlay
//     never reads autoplayOn — the defect, reproduced
//     from the shipped source
//   C client (Chromium, web mode, the v539 stubbed
//     fetch): autoplay OFF tap = one track + full stop ·
//     autoplay ON tap = the block queue + advance · the
//     toggle branches stand · Add to queue appends
//     without interrupting and is reached in order ·
//     forms on a single play · waits with nothing
//     playing · the kind bound both ways · Clear queue
//     leaves the playing track under the settled rule
//     (OFF: stops alone · ON: the chain, proven against
//     a played-marked queue entry the chain must skip) ·
//     Clear with a paused queue · the menu items stand
//     where the Plan places them · played marks and the
//     by-play Intention draw unchanged
//   N client (Chromium, a fake OraDayBridge standing in
//     the page): autoplay OFF tap = a one-item contract
//     · autoplay ON tap = the queue + tail contract ·
//     Add to queue mid-play re-sends at the live
//     position with the item inside queueEnd · Clear
//     queue re-sends the single-play form · a paused
//     append waits, and the resume carries it in
//   G439 (recorded as-is, NEVER a v542 pass): the
//     standing v439 boot gate run on this tree.
// Fixtures (Improvement D): the v528 fixture set, drawn
// from production 2026-11-18 — F1 day-live-2026-11-18
// .json (the prayer-door day payload) · F3 intentions-
// pool-live.json (the draw legs' pool) · the SERIES
// stub below, drawn from the production catechism-in-
// a-year payload shape, stands as harness-v539's. The
// door payload's block track lists stand empty by
// design (the app resolves them from the feeds at
// runtime); the harness seats the resolved form —
// track rows carrying the production episode ids the
// fixture's own introTexts name, in their production
// blocks and the app's standing Morning order, shaped
// as the payload's own track records (the v539
// precedent) — so the app's own builders
// (extRebuildDescs / trackDesc) produce every
// descriptor the legs exercise. S10 proves every
// seated id stands in the fixture's introTexts.
// Run: node app/tests/harness-v542.mjs [--probe] (from
// the worktree root). --probe only prints.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE_SHA = '20198f91aa66eef11a459a54b30a9cd2fab01bbb';
const gitShow = (p) => execFileSync('git', ['show', BASE_SHA + ':' + p], { cwd: ROOT }).toString();
const B_C = gitShow('app/worker/src/client.ts');
const B_I = gitShow('app/worker/src/index.ts');
const B_U = gitShow('app/worker/src/ui.ts');
const FX = APP + '/tests/fixtures-v528';
const POOL = JSON.parse(readFileSync(FX + '/intentions-pool-live.json', 'utf8'));
const DAY = JSON.parse(readFileSync(FX + '/day-live-2026-11-18.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(FX + '/book-live.json', 'utf8'));
const DAY_TRACKS = {
  Morning: ['ext-invitatory', 'morning-prayer', 'ext-morning-prayer', 'daily-rosary', 'marian-antiphon-angelus'],
  Midday: ['ext-midday-prayer', 'daily-reflection'],
  Evening: ['ext-evening-prayer', 'auxilium-christianorum'],
  Night: ['ext-night-prayer'],
  Novenas: ['novena-clement_i_pope', 'novena-columban_of_luxeuil_abbot', 'novena-st_cecilia'],
  Podcasts: [],
};
const DAYH = JSON.parse(JSON.stringify(DAY));
DAYH.blocks.forEach((b) => {
  b.tracks = (DAY_TRACKS[b.block] || []).map((id) => ({ episodeId: id, title: id, streamUrl: 'https://example.com/' + id + '.mp3', available: true, durationS: 600 }));
  b.trackCount = b.tracks.length;
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + String(extra).slice(0, 220) : ''); }
}
function fnBody(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0; const s = src.indexOf('{', i);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return null;
}

/* ---------------- S: statics ---------------- */
{
  const migs = readdirSync(APP + '/migrations').filter((x) => x.endsWith('.sql')).sort();
  ok(migs[migs.length - 1] === '0040_prayer_track_draws.sql', 'S1: no new migration — 0040 stands last', migs.slice(-2).join(','));
  ok(I_SRC === B_I, 'S2: index.ts byte-identical to the production base — the server is untouched');
  const pinNorm = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pinNorm(U_SRC) === pinNorm(B_U), 'S3: ui.ts identical to the base but for the SW pin line');
  ok(fnBody(C_SRC, 'startDesc') === fnBody(B_C, 'startDesc') && fnBody(C_SRC, 'ensureTrackDraw') === fnBody(B_C, 'ensureTrackDraw')
    && fnBody(C_SRC, 'settleTrackDraws') === fnBody(B_C, 'settleTrackDraws'),
    'S4: startDesc and both draw seams byte-identical to the base — the v528/v539 Intention draw rides untouched');
  ok(fnBody(C_SRC, 'autoplayOn') === fnBody(B_C, 'autoplayOn') && fnBody(C_SRC, 'setAutoplay') === fnBody(B_C, 'setAutoplay')
    && C_SRC.includes("AUTOPLAY_KEY = 'opn-autoplay-v358'") === B_C.includes("AUTOPLAY_KEY = 'opn-autoplay-v358'"),
    'S5: the autoplay store, its read, and its setter are byte-identical — the default stands');
  ok(fnBody(C_SRC, 'playPodFrom') === fnBody(B_C, 'playPodFrom') && fnBody(C_SRC, 'playPodOwnFrom') === fnBody(B_C, 'playPodOwnFrom')
    && fnBody(C_SRC, 'playTrack') === fnBody(B_C, 'playTrack') && fnBody(C_SRC, 'startQueue') === fnBody(B_C, 'startQueue'),
    'S6: the explicit queue acts and the single-play funnel are byte-identical — Part 1 stands at the tap seam only');
  const tap = fnBody(C_SRC, 'tapPlay') || '';
  ok(tap.includes('if (!autoplayOn()) { playTrack(build[0]); return; }') && tap.indexOf('autoplayOn()') < tap.indexOf('startQueue(build, true)'),
    'S7: the tapPlay branch stands — autoplay OFF takes playTrack(build[0]) before the queue build');
  ok(C_SRC.includes('function addToQueue(desc)') && C_SRC.includes('function clearQueue()')
    && C_SRC.includes('function nativeQueueDiverged()') && C_SRC.includes('function nativeResendAtCurrent()') && C_SRC.includes('function nativeSendNow()')
    && (C_SRC.match(/label: 'Add to queue'/g) || []).length === 2 && (C_SRC.match(/label: 'Clear queue'/g) || []).length === 1
    && !(fnBody(C_SRC, 'openDockMenu') || '').includes('Clear queue'),
    'S8: the v542 seams stand — both acts, the divergence read, Add to queue in exactly two menus, Clear queue in the player menu only (the dock menu does not gain it)');
  ok(fnBody(C_SRC, 'resumeCurrent') !== fnBody(B_C, 'resumeCurrent') && (fnBody(C_SRC, 'resumeCurrent') || '').includes('nativeQueueDiverged()'),
    'S9: resumeCurrent carries exactly the divergence branch in its native leg');
  ok(POOL.length === 14 && !!(DAY && DAY.blocks) && JSON.stringify(BOOK.groups.map((g) => g.prayers.length)) === '[24,5,13,9,5,4,7,2,8]'
    && Object.values(DAY_TRACKS).flat().every((id) => Object.prototype.hasOwnProperty.call(DAY.introTexts, id)),
    'S10: the fixtures stand — the production pool (14), the production book (9 groups / 77), and every seated track id stands in the fixture\u2019s own introTexts (production-drawn)');
  const btap = fnBody(B_C, 'tapPlay') || '';
  ok(!btap.includes('autoplayOn'), 'C1 premise: the PRODUCTION tapPlay never reads the autoplay setting — a tap builds the block queue in both states (the defect, from the shipped source)');
}

/* ---------------- shared client scaffolding ---------------- */
const require2 = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = require2('playwright-core');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
let cooked = null;
try {
  const t = C_SRC.indexOf('APP_JS = `') + 10;
  cooked = new Function('return `' + C_SRC.slice(t, C_SRC.indexOf('`;', t)) + '`')();
} catch (e) { /* recorded below */ }

const SERIES = {
  ok: true, available: true, series: 'catechism-in-a-year', title: 'Catechism in a Year', showDesc: '', showImageUrl: null,
  currentKey: 'ciy:day-2', listenedCount: 1, total: 2,
  entries: [
    { key: 'ciy:day-1', label: 'Day 1', title: 'In the Beginning', url: 'https://example.com/ciy1.mp3', durationS: 900, listened: true, listenDate: '2026-11-17', positionS: null, descText: '', imageUrl: null },
    { key: 'ciy:day-2', label: 'Day 2', title: 'The Story of Creation', url: 'https://example.com/ciy2.mp3', durationS: 900, listened: false, listenDate: null, positionS: null, descText: '', imageUrl: null },
  ],
};
function buildPage(native) {
  const stub = `
window.__drawCalls = [];
window.__drawStore = {};
window.__pool = ${JSON.stringify(POOL.map((r) => ({ id: r.id, text: r.text })))};
window.__drawHash = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
window.fetch = function (path, opts) {
  var p = String(path);
  function ans(status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); }, text: function () { return Promise.resolve(JSON.stringify(body)); } }); }
  if (p.indexOf('/api/player/track-draws') === 0) {
    var body = JSON.parse(opts.body);
    window.__drawCalls.push({ keys: body.keys.slice(), via: body.via, date: body.date });
    var draws = {};
    body.keys.forEach(function (k) {
      if (k.indexOf('intro:') === 0 || k.indexOf('seg:') === 0) return;
      if (!window.__drawStore[k]) { var row = window.__pool[Math.floor(window.__drawHash(body.date + ':' + k) * window.__pool.length)]; window.__drawStore[k] = { intentionId: row.id, text: row.text }; }
      draws[k] = window.__drawStore[k];
    });
    return ans(200, { ok: true, date: body.date, draws: draws });
  }
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAYH)});
  if (p.indexOf('/api/player/source-settings') === 0) return ans(200, { ok: true, version: 1, sources: [] });
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, ${JSON.stringify(BOOK)});
  if (p.indexOf('/api/player/podcasts?series=') === 0) return ans(200, ${JSON.stringify(SERIES)});
  return ans(200, { ok: true });
};
window.HTMLMediaElement.prototype.play = function () { this.__playing = true; this.__ended = false; var el = this; Promise.resolve().then(function () { try { el.dispatchEvent(new Event('play')); } catch (e) {} }); return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () { this.__playing = false; };
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', { configurable: true, get: function () { return !this.__playing; } }); } catch (e) {}
try { Object.defineProperty(window.HTMLMediaElement.prototype, 'ended', { configurable: true, get: function () { return !!this.__ended; } }); } catch (e) {}
${native ? `
window.__contracts = [];
window.__commands = [];
window.__listeners = {};
window.Capacitor = { Plugins: { OraDayBridge: new Proxy({}, { get: function (t, prop) {
  if (prop === 'setNativeQueue') return function (arg) { window.__contracts.push(JSON.parse(arg.queue)); return Promise.resolve({ ok: true }); };
  if (prop === 'nativeTransport') return function (arg) { window.__commands.push(JSON.parse(arg.command)); return Promise.resolve({ ok: true }); };
  if (prop === 'addListener') return function (name, cb) { window.__listeners[name] = cb; return Promise.resolve({ remove: function () {} }); };
  return function () { return Promise.resolve({}); };
} }) } };
window.__fireNative = function (obj) { var cb = window.__listeners['nativeState']; if (cb) cb({ state: JSON.stringify(obj) }); };
` : `
window.__noNative = true;
try { Object.defineProperty(window, 'OraNative', { get: function () { return undefined; } }); } catch (e) {}
`}
`;
  const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<style>' + U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `'))) + '</style></head>'
    + '<body>' + SHELL
    + '<script>' + stub.replace(/<\/script>/g, '<\\/script>') + '<\/script>'
    + '<script>' + cooked.replace(/<\/script>/g, '<\\/script>') + '<\/script></body></html>';
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
async function bootPage(browser, native) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  const html = buildPage(native);
  const srv = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); }
    else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  await page.goto('http://127.0.0.1:' + srv.address().port + '/');
  await page.waitForFunction(() => window.state && state.tab, null, { timeout: 25000 });
  await page.click('[data-tab="prayers"]');
  await page.waitForFunction(() => window.state && state.dayPayload, null, { timeout: 25000 });
  await page.waitForSelector('[data-openblock]', { timeout: 15000 });
  await page.waitForFunction(() => window.state && state.dayDescs && state.dayDescs.length >= 8, null, { timeout: 25000 });
  return { page, errors, srv };
}
// In-page helpers shared by the legs (plain functions the
// evaluate calls compose).
const HELPERS = `
window.__leg = {
  reset: function () {
    try { audioEl.pause(); } catch (e) {}
    state.queue = []; state.queueIdx = -1; state.current = null; state.pendingStart = null;
    Object.keys(localStorage).filter(function (k) { return k.indexOf('played') >= 0 || k.indexOf('queue') >= 0; }).forEach(function (k) { localStorage.removeItem(k); });
  },
  blockTracks: function (block) {
    return (state.dayDescs || []).filter(function (d) { return d.block === block && d.available && d.url; });
  },
  richBlock: function () {
    var counts = {};
    (state.dayDescs || []).forEach(function (d) { if (d.available && d.url && d.block) counts[d.block] = (counts[d.block] || 0) + 1; });
    var best = null, bn = 0;
    Object.keys(counts).forEach(function (b) { if (counts[b] > bn) { bn = counts[b]; best = b; } });
    return best;
  },
  otherBlockTrack: function (notBlock, notIds) {
    return (state.dayDescs || []).filter(function (d) { return d.block !== notBlock && d.available && d.url && notIds.indexOf(d.episodeId) < 0; })[0] || null;
  },
  ended: function () { audioEl.__ended = true; audioEl.dispatchEvent(new Event('ended')); },
  playAll: function (block) {
    // The standing Play All expression (the [data-queue]
    // wiring): the block's descriptors through queueBuild.
    startQueue(queueBuild(extRebuildDescs(state.dayPayload).filter(function (d) { return d.block === block; })));
  },
  sheetLabels: function () {
    var root = document.querySelector('.anchmenu');
    if (!root) return [];
    return Array.prototype.slice.call(root.querySelectorAll('button.menurow .grow')).map(function (b) { return b.textContent.trim(); });
  },
  closeMenus: function () { document.querySelectorAll('.anchmenu, .menucatcher').forEach(function (n) { n.remove(); }); }
};
`;

/* ---------------- C: the client in Chromium (web) ---------------- */
if (!PROBE) {
  let browser = null;
  try {
    ok(!!cooked, 'C0: the cooked client script parses (the template-literal law)');
    if (cooked) {
      browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
      const { page, errors, srv } = await bootPage(browser, false);
      await ev(page, (src) => { eval(src); }, HELPERS);
      ok(errors.length === 0, 'C0b: boot clean under the stubbed store (no page errors)', errors.join(' | '));

      // C2 — autoplay OFF + block tap: exactly one track,
      // and its end is a full stop.
      const c2 = await ev(page, () => {
        __leg.reset(); setAutoplay(false);
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        var d = ts[0];
        tapPlay(d);
        var afterTap = { cur: state.current && state.current.episodeId, q: state.queue.length, want: d.episodeId, block: b, n: ts.length };
        __leg.ended();
        return { afterTap: afterTap, afterEnd: { cur: state.current && state.current.episodeId, q: state.queue.length } };
      });
      ok(c2.afterTap.n >= 2 && c2.afterTap.cur === c2.afterTap.want && c2.afterTap.q === 0,
        'C2a: autoplay OFF + block tap — the tapped track stands alone (no queue built)', JSON.stringify(c2.afterTap));
      ok(c2.afterEnd.cur === null && c2.afterEnd.q === 0,
        'C2b: its end is a full stop — no advance, no chain (autoplay OFF)', JSON.stringify(c2.afterEnd));

      // C3 — autoplay ON + block tap: the block queue
      // stands as today and the end advances within it.
      const c3 = await ev(page, () => {
        __leg.reset(); setAutoplay(true);
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        tapPlay(ts[0]);
        var q1 = state.queue.map(function (d) { return d.episodeId; });
        var cur1 = state.current && state.current.episodeId;
        __leg.ended();
        return { q: q1, cur1: cur1, cur2: state.current && state.current.episodeId, idx: state.queueIdx, first: ts[0].episodeId };
      });
      ok(c3.q.length >= 2 && c3.cur1 === c3.first && c3.q[0] === c3.first && c3.cur2 === c3.q[1] && c3.idx === 1,
        'C3: autoplay ON + block tap — the block queue builds as today and the end advances within it', JSON.stringify(c3).slice(0, 200));

      // C4 — the toggle branches stand in both states:
      // tap the playing current pauses; tap it again resumes.
      await sleep(300);
      const c4a = await ev(page, () => { var cur = state.current; tapPlay(cur); return { paused: !transportPlaying() }; });
      await sleep(200);
      const c4b = await ev(page, () => { var cur = state.current; tapPlay(cur); return { resumed: transportPlaying() }; });
      ok(c4a.paused && c4b.resumed, 'C4: the toggle branches stand — tap the playing current pauses, tap again resumes', JSON.stringify(c4a) + ' ' + JSON.stringify(c4b));

      // C5 — Add to queue with a queue playing: appended
      // last, the playing track untouched, reached in order.
      const c5 = await ev(page, () => {
        var before = { cur: state.current && state.current.episodeId, q: state.queue.map(function (d) { return d.episodeId; }) };
        var x = __leg.otherBlockTrack(state.current.block, before.q);
        addToQueue(x);
        var mid = { cur: state.current && state.current.episodeId, q: state.queue.map(function (d) { return d.episodeId; }), x: x && x.episodeId };
        var guard = 0;
        while (state.current && state.current.episodeId !== x.episodeId && guard < 12) { __leg.ended(); guard++; }
        return { before: before, mid: mid, reached: state.current && state.current.episodeId };
      });
      ok(c5.mid.x && c5.mid.cur === c5.before.cur && c5.mid.q.length === c5.before.q.length + 1 && c5.mid.q[c5.mid.q.length - 1] === c5.mid.x,
        'C5a: Add to queue appends at the end of the standing queue — the playing track and its place untouched', JSON.stringify(c5.mid).slice(0, 200));
      ok(c5.reached === c5.mid.x, 'C5b: the queue reaches the appended track in order at the ends before it', JSON.stringify(c5.reached));

      // C6 — Add to queue behind a single play forms the
      // queue on it; the single's end starts the appended.
      const c6 = await ev(page, () => {
        __leg.reset(); setAutoplay(true);
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        playTrack(ts[0]);
        var y = __leg.otherBlockTrack(b, [ts[0].episodeId]);
        addToQueue(y);
        var formed = state.queue.map(function (d) { return d.episodeId; });
        var idx = state.queueIdx;
        __leg.ended();
        return { formed: formed, idx: idx, y: y && y.episodeId, s: ts[0].episodeId, cur: state.current && state.current.episodeId };
      });
      ok(c6.formed.length === 2 && c6.formed[0] === c6.s && c6.formed[1] === c6.y && c6.idx === 0 && c6.cur === c6.y,
        'C6: Add to queue behind a single play forms [current, appended] — the current\u2019s end starts the appended track', JSON.stringify(c6).slice(0, 200));

      // C7 — Add to queue with nothing playing: a waiting
      // queue of the one track; nothing starts.
      const c7 = await ev(page, () => {
        __leg.reset();
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        addToQueue(ts[1] || ts[0]);
        return { q: state.queue.map(function (d) { return d.episodeId; }), idx: state.queueIdx, cur: state.current && state.current.episodeId, want: (ts[1] || ts[0]).episodeId };
      });
      ok(c7.q.length === 1 && c7.q[0] === c7.want && c7.idx === -1 && c7.cur === null,
        'C7: Add to queue with nothing playing forms the waiting one-track queue and starts nothing', JSON.stringify(c7));

      // C8 — the kind bound, both ways.
      const c8 = await ev(page, (series) => {
        __leg.reset(); setAutoplay(true);
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        tapPlay(ts[0]);
        var dayQ = state.queue.map(function (d) { return d.episodeId; });
        state.podcasts = series;
        var pd = podDesc(series.entries[1]);
        addToQueue(pd);
        var afterPod = state.queue.map(function (d) { return d.episodeId; });
        __leg.reset();
        playPodFrom('ciy:day-2');
        var podQ = state.queue.map(function (d) { return d.episodeId; });
        var dd = __leg.blockTracks(__leg.richBlock())[0];
        addToQueue(dd);
        var afterDay = state.queue.map(function (d) { return d.episodeId; });
        return { dayQ: dayQ, afterPod: afterPod, podQ: podQ, afterDay: afterDay };
      }, SERIES);
      ok(JSON.stringify(c8.afterPod) === JSON.stringify(c8.dayQ) && c8.podQ.length >= 1 && JSON.stringify(c8.afterDay) === JSON.stringify(c8.podQ),
        'C8: the kind bound — a podcast descriptor does not join a day queue, and a day track does not join a podcast queue', JSON.stringify(c8).slice(0, 200));

      // C9 — Clear queue, autoplay OFF: the playing track
      // finishes alone.
      const c9 = await ev(page, () => {
        __leg.reset(); setAutoplay(false);
        var b = __leg.richBlock();
        __leg.playAll(b);
        var standing = { cur: state.current && state.current.episodeId, q: state.queue.length };
        clearQueue();
        var cleared = { q: state.queue.length, cur: state.current && state.current.episodeId, playing: transportPlaying() };
        __leg.ended();
        return { standing: standing, cleared: cleared, afterEnd: state.current && state.current.episodeId };
      });
      ok(c9.standing.q >= 2 && c9.cleared.q === 0 && c9.cleared.cur === c9.standing.cur && c9.cleared.playing,
        'C9a: Clear queue empties the queue — the playing track stands, uninterrupted', JSON.stringify(c9));
      ok(c9.afterEnd === null, 'C9b: under autoplay OFF the cleared-from track finishes alone and playback stops', JSON.stringify(c9.afterEnd));

      // C10 — Clear queue, autoplay ON: the current's end
      // follows the single-play chain. Proven against the
      // surviving-queue read: the queue's second entry is
      // marked played first — a queue advance would play
      // it anyway (played gates builds, not advances);
      // the chain skips it.
      const c10 = await ev(page, () => {
        __leg.reset(); setAutoplay(true);
        var b = __leg.richBlock();
        __leg.playAll(b);
        var clearedIds = state.queue.map(function (d) { return d.episodeId; });
        var second = state.queue[1];
        markCompleted(second);
        clearQueue();
        var emptied = state.queue.length;
        __leg.ended();
        return { second: second && second.episodeId, clearedIds: clearedIds, emptied: emptied, cur: state.current && state.current.episodeId };
      });
      ok(c10.emptied === 0 && c10.cur !== null && c10.cur !== c10.second && c10.clearedIds.indexOf(c10.cur) < 0,
        'C10: Clear queue under autoplay ON — the queue empties and the end follows the single-play chain (it lands outside the cleared queue; the played-marked cleared entry is skipped, never advanced into)', JSON.stringify(c10));

      // C11 — Clear queue with a paused queue standing.
      const c11 = await ev(page, () => {
        __leg.reset(); setAutoplay(true);
        var b = __leg.richBlock();
        __leg.playAll(b);
        pauseTransport();
        var cur = state.current && state.current.episodeId;
        clearQueue();
        return { q: state.queue.length, cur: state.current && state.current.episodeId, want: cur, playing: transportPlaying() };
      });
      ok(c11.q === 0 && c11.cur === c11.want && !c11.playing,
        'C11: Clear queue with a paused queue standing empties it — the current stands paused as a single', JSON.stringify(c11));

      // C12 — the menu items stand where the Plan places
      // them.
      const c12a1 = await ev(page, () => {
        __leg.reset();
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        openDayRowMenu(ts[0], null);
        return { b: b };
      });
      await sleep(500);
      const c12 = await ev(page, (b) => {
        var dayLabels = __leg.sheetLabels(); __leg.closeMenus();
        __leg.playAll(b);
        openPlayerMenu(null);
        var withQ = __leg.sheetLabels(); __leg.closeMenus();
        clearQueue();
        openPlayerMenu(null);
        var noQ = __leg.sheetLabels(); __leg.closeMenus();
        return { dayLabels: dayLabels, withQ: withQ, noQ: noQ };
      }, c12a1.b);
      ok(c12.dayLabels[0] === 'Share' && c12.dayLabels[1] === 'Add to queue',
        'C12a: the day-row overflow carries Add to queue after Share', JSON.stringify(c12.dayLabels));
      ok(c12.withQ.indexOf('Clear queue') === c12.withQ.length - 2 && c12.withQ[c12.withQ.length - 1] === 'Exit player' && c12.noQ.indexOf('Clear queue') < 0,
        'C12b: the Now Playing overflow carries Clear queue exactly while a queue stands — Exit player stands last', JSON.stringify(c12.withQ) + ' // ' + JSON.stringify(c12.noQ));

      // C13 — played marks and the by-play Intention draw
      // unchanged.
      const c13 = await ev(page, (series) => {
        __leg.reset(); setAutoplay(false);
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        var t = ts[0];
        playTrack(t);
        __leg.ended();
        var marked = isPlayed(t.episodeId, presentedDateStr(), t.block);
        window.__drawCalls = [];
        state.podcasts = series;
        playTrack(podDesc(series.entries[0]));
        var playDraw = window.__drawCalls.filter(function (c) { return c.via === 'play' && c.keys.indexOf('ciy:day-1') >= 0; });
        return { marked: marked, playDraw: playDraw.length };
      }, SERIES);
      ok(c13.marked === true, 'C13a: the played mark stands at the single play\u2019s end, as today (episode-level)', JSON.stringify(c13));
      await sleep(500);
      const c13b = await ev(page, () => ({ drawn: state.trackDraws['ciy:day-1'] || null }));
      ok(c13.playDraw >= 1 && !!c13b.drawn, 'C13b: the by-play Intention draw fires at the startDesc seam for an out-of-build track and lands in the map, as today', JSON.stringify(c13) + ' ' + JSON.stringify(c13b));
      ok(errors.length === 0, 'C14: no page errors across the web legs', errors.join(' | '));
      try { srv.close(); } catch { /* not started */ }
    }
  } catch (e) {
    ok(false, 'C: client legs completed', String(e).slice(0, 220));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/* ---------------- N: the client in Chromium (native) ---------------- */
if (!PROBE) {
  let browser = null;
  try {
    if (cooked) {
      browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
      const b1 = await bootPage(browser, true);
      const page = b1.page;
      await ev(page, (src) => { eval(src); }, HELPERS);
      ok(b1.errors.length === 0, 'N0: native-mode boot clean under the fake bridge (no page errors)', b1.errors.join(' | '));

      // N1 — autoplay OFF + tap: a one-item contract.
      const n1 = await ev(page, () => {
        __leg.reset(); setAutoplay(false);
        window.__contracts = [];
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        tapPlay(ts[0]);
        var c = window.__contracts[window.__contracts.length - 1] || null;
        return { c: c && { n: c.items.length, qe: c.queueEnd, ap: c.autoplay, id: c.items[0] && c.items[0].id }, want: ts[0].episodeId, sent: window.__contracts.length };
      });
      ok(n1.sent >= 1 && n1.c && n1.c.n === 1 && n1.c.qe === 1 && n1.c.ap === false && n1.c.id === n1.want,
        'N1: autoplay OFF + tap — the contract carries exactly the tapped track (queueEnd 1, autoplay false, no tail)', JSON.stringify(n1));

      // N2 — autoplay ON + tap: the queue + tail contract.
      const n2 = await ev(page, () => {
        __leg.reset(); setAutoplay(true);
        window.__contracts = [];
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        tapPlay(ts[0]);
        var c = window.__contracts[window.__contracts.length - 1] || null;
        return { c: c && { n: c.items.length, qe: c.queueEnd, ap: c.autoplay }, qlen: state.queue.length };
      });
      ok(n2.c && n2.qlen >= 2 && n2.c.qe === n2.qlen && n2.c.n >= n2.c.qe && n2.c.ap === true,
        'N2: autoplay ON + tap — the contract carries the block queue inside queueEnd (the chain tail past it)', JSON.stringify(n2));

      // N3 — Add to queue mid-play: the contract re-sends
      // headed at the playing track at its live position,
      // the appended item last inside the widened queueEnd.
      const n3 = await ev(page, () => {
        var cur = state.current;
        window.__fireNative({ engine: 'native', playing: true, positionS: 42, durationS: 600, trackId: cur.episodeId, queueIndex: state.queueIdx, ts: 1000 });
        var before = window.__contracts.length;
        var x = __leg.otherBlockTrack(cur.block, state.queue.map(function (d) { return d.episodeId; }));
        addToQueue(x);
        var c = window.__contracts[window.__contracts.length - 1] || null;
        return { sent: window.__contracts.length - before, c: c && { qe: c.queueEnd, si: c.startIndex, sp: c.startPositionS, last: c.items[c.queueEnd - 1] && c.items[c.queueEnd - 1].id },
          x: x && x.episodeId, qlast: state.queue[state.queue.length - 1].episodeId, cur: state.current && state.current.episodeId, wantCur: cur.episodeId };
      });
      ok(n3.sent === 1 && n3.c && n3.c.sp === 42 && n3.c.last === n3.x && n3.qlast === n3.x && n3.cur === n3.wantCur,
        'N3: Add to queue mid-play — one contract re-send at the live position (42s), the appended item last inside the widened queueEnd, the playing track unchanged', JSON.stringify(n3).slice(0, 220));

      // N4 — Clear queue mid-play: the single-play form
      // re-sends; the engine's stop then clears the client.
      const n4 = await ev(page, () => {
        window.__fireNative({ engine: 'native', playing: true, positionS: 50, durationS: 600, trackId: state.current.episodeId, queueIndex: 0, ts: 2000 });
        var before = window.__contracts.length;
        var curId = state.current.episodeId;
        clearQueue();
        var c = window.__contracts[window.__contracts.length - 1] || null;
        var mid = { sent: window.__contracts.length - before, q: state.queue.length, c: c && { qe: c.queueEnd, id: c.items[0] && c.items[0].id }, curId: curId };
        window.__fireNative({ engine: 'native', stopped: true, ts: 3000 });
        mid.afterStop = state.current && state.current.episodeId;
        return mid;
      });
      ok(n4.sent === 1 && n4.q === 0 && n4.c && n4.c.qe === 1 && n4.c.id === n4.curId && n4.afterStop === null,
        'N4: Clear queue mid-play — the single-play contract re-sends (queueEnd 1, the current alone) and the queue reads empty', JSON.stringify(n4));
      ok(b1.errors.length === 0, 'N4b: no page errors across the native legs (page 1)', b1.errors.join(' | '));
      try { b1.srv.close(); } catch { /* not started */ }

      // N5 — a paused append waits as a divergence; the
      // resume carries it into the engine.
      const b2 = await bootPage(browser, true);
      const page2 = b2.page;
      await ev(page2, (src) => { eval(src); }, HELPERS);
      const n5 = await ev(page2, () => {
        __leg.reset(); setAutoplay(true);
        var b = __leg.richBlock(); var ts = __leg.blockTracks(b);
        tapPlay(ts[0]);
        var cur = state.current;
        window.__fireNative({ engine: 'native', playing: false, positionS: 42, durationS: 600, trackId: cur.episodeId, queueIndex: state.queueIdx, ts: 1000 });
        var base = window.__contracts.length;
        var x = __leg.otherBlockTrack(cur.block, state.queue.map(function (d) { return d.episodeId; }));
        addToQueue(x);
        var afterAppend = { sent: window.__contracts.length - base, q: state.queue.length, diverged: nativeQueueDiverged() };
        resumeCurrent();
        var c = window.__contracts[window.__contracts.length - 1] || null;
        return { afterAppend: afterAppend, sentTotal: window.__contracts.length - base,
          c: c && { qe: c.queueEnd, sp: c.startPositionS, last: c.items[c.queueEnd - 1] && c.items[c.queueEnd - 1].id }, x: x && x.episodeId };
      });
      ok(n5.afterAppend.sent === 0 && n5.afterAppend.diverged === true,
        'N5a: Add to queue while the engine stands paused sends NO contract (a send is a play=true load) — the append waits as a divergence', JSON.stringify(n5.afterAppend));
      ok(n5.sentTotal === 1 && n5.c && n5.c.sp === 42 && n5.c.last === n5.x,
        'N5b: the resume carries the waiting append in — a contract re-send at the standing position with the item inside queueEnd', JSON.stringify(n5).slice(0, 220));
      ok(b2.errors.length === 0, 'N5c: no page errors across the native legs (page 2)', b2.errors.join(' | '));
      try { b2.srv.close(); } catch { /* not started */ }
    }
  } catch (e) {
    ok(false, 'N: native legs completed', String(e).slice(0, 220));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/* ---------------- G439: the standing gate, as-is ---------------- */
{
  const g = spawn('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, stdio: 'pipe' });
  let out = '';
  g.stdout.on('data', (d) => { out += d; });
  g.stderr.on('data', (d) => { out += d; });
  await new Promise((r) => g.on('close', r));
  const m = out.match(/(\d+) ok \/ (\d+) not-ok/);
  console.log('note - G439 standing gate on the v542 tree, recorded AS-IS (never a v542 pass): ' + (m ? m[1] + ' ok / ' + m[2] + ' not-ok' : 'unreadable — ' + out.slice(-200)));
}

console.log('harness-v542: ' + pass + ' ok / ' + fail + ' not-ok' + (failures.length ? ' :: ' + failures.join(' ;; ') : ''));
process.exit(PROBE ? 0 : (fail ? 1 : 0));
