// harness-v539.mjs — v539 evidence: ONE intention system
// (John's direction, Ora thread, settled reading
// 2026-11-18 21:03 CT: "the only thing going forward will
// be track intentions just simply called intention" —
// reason: "now some things have two intentions"). The
// per-track intention (v528) stands, labeled simply
// "Intention: "; the block-head (paired) draw's DISPLAY
// retires on all three of its surfaces — trackCard's
// "Prayer Intention: " line, Now Playing's #np-intention
// element and paint, and the native face's subtitle read
// (which now reads the track's OWN draw, so the lock
// screen / car display carry the one intention). The v528
// assignment underneath (store, route, fill, seams) is
// untouched; the paired machinery stands in place with no
// painter left. Presentation only — no migration.
//   S statics: no new migration · index.ts byte-identical
//     to the v537-ship base and ui.ts identical but for
//     the pin line · no "Prayer Intention" paint string in
//     any code line · no "Track intention" label anywhere
//     · the #np-intention element and its paint absent ·
//     introForTrack carries no display reader (definition
//     only) · all five label seats read "Intention: " ·
//     the v528 machinery stands (client seams + worker
//     route) · the fixtures stand as drawn from production
//   W worker (local wrangler + fixture D1): the
//     track-draws route round-trip stands unchanged — a
//     batch fill returns a draw for every key from the
//     production pool, and a second identical request
//     returns the SAME map (fill-missing, no re-draw)
//   C client (Chromium, the v528 stubbed fetch with its
//     in-page fill-missing draw store): cooked parse +
//     boot clean · the build settle batch stands as v528
//     left it · THE DUPLICATION LEG — a built-day paired
//     track whose descriptor carries a stamped paired
//     text (marker) paints exactly ONE intention line,
//     the track draw under "Intention: ", and the marker
//     never paints · Now Playing carries no #np-intention
//     element and exactly the one labeled line · the
//     native state payload's subtitle is the track's own
//     draw (empty with the showing toggle OFF) · the
//     prayer page and the by-play series episode carry
//     the one labeled line · toggle OFF paints no line
//   G439 (recorded as-is, NEVER a v539 pass): the standing
//     v439 boot gate run on this tree.
// Fixtures (Improvement D): the v528 fixture set, drawn
// from production 2026-11-18, re-used because this
// release changes no server behavior — F1
// day-live-2026-11-18.json (prayer-door day payload;
// its introTexts carry the real paired draw for
// daily-rosary — the duplication premise) · F2
// podcasts-progress-live.json (ciy:day-2, the by-play
// key) · F3 intentions-pool-live.json (14 active:
// 5 H · 8 M · 1 L) · F4 book-live.json (9 groups / 77
// prayers; anima-christi) · mass-personal-live.json
// (John's seats, the preservation fixture).
// The base for byte comparisons is the v537 ship tree
// (H539_BASE overrides).
// Run: node app/tests/harness-v539.mjs [--probe] (from
// the worktree root). --probe only prints.
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import fs from 'node:fs';
import os from 'node:os';
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
const BASE = process.env.H539_BASE || path.resolve(ROOT, '../../.worktrees/v537-ship/app/worker/src');
const B_I = readFileSync(BASE + '/index.ts', 'utf8');
const B_U = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v528';
const POOL = JSON.parse(readFileSync(FX + '/intentions-pool-live.json', 'utf8'));
const DAY = JSON.parse(readFileSync(FX + '/day-live-2026-11-18.json', 'utf8'));
const PROGRESS = JSON.parse(readFileSync(FX + '/podcasts-progress-live.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(FX + '/book-live.json', 'utf8'));
const SEATS_LIVE = JSON.parse(readFileSync(FX + '/mass-personal-live.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + String(extra).slice(0, 220) : ''); }
}
const poolById = new Map(POOL.map((r) => [r.id, r]));

/* ---------------- S: statics ---------------- */
{
  const migs = readdirSync(APP + '/migrations').filter((x) => x.endsWith('.sql')).sort();
  ok(migs[migs.length - 1] === '0040_prayer_track_draws.sql', 'S1: no new migration — 0040 stands last (presentation only)', migs.slice(-2).join(','));
  ok(I_SRC === B_I, 'S2: index.ts byte-identical to the v537-ship base — the server and the draw route are untouched');
  const pinNorm = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pinNorm(U_SRC) === pinNorm(B_U), 'S3: ui.ts identical to the base but for the SW pin line');
  const codeLines = C_SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  ok(!codeLines.includes('Prayer Intention'), 'S4: no "Prayer Intention" paint string stands in any code line of client.ts');
  ok(!C_SRC.includes('Track intention'), 'S5: no "Track intention" label stands anywhere in client.ts');
  ok(!C_SRC.includes('id="np-intention"') && !C_SRC.includes("querySelector('#np-intention')") && C_SRC.includes('id="np-track-intention"'),
    'S6: the #np-intention element and its paint are absent; #np-track-intention stands');
  ok((C_SRC.match(/introForTrack\(/g) || []).length === 1, 'S7: introForTrack has no display reader left — its definition only',
    String((C_SRC.match(/introForTrack\(/g) || []).length));
  ok(C_SRC.includes('Intention: \' + esc(drawText)') && C_SRC.includes('Intention: \' + esc(state.trackDraws[e.key])')
    && C_SRC.includes("'Intention: ' + tdText") && C_SRC.includes("'Intention: ' + bt") && C_SRC.includes("'Intention: ' + t"),
    'S8: all five label seats read "Intention: " (trackCard · series row · Now Playing · book refresh · prayer page)');
  ok(C_SRC.includes('function settleTrackDraws()') && C_SRC.includes('function ensureTrackDraw(desc)') && C_SRC.includes('function trackKeyOf(t)')
    && C_SRC.includes('trackDrawTextFor(cur)') && C_SRC.includes('trackDrawTextFor(d)')
    && I_SRC.includes('async function prayerTrackDraws(') && I_SRC.includes('"track-draws"'),
    'S9: the v528 machinery stands — client seams, both native subtitle reads of the track draw, the worker route');
  ok(POOL.length === 14 && POOL.filter((r) => r.priority === 'H').length === 5 && POOL.filter((r) => r.priority === 'M').length === 8 && POOL.filter((r) => r.priority === 'L').length === 1,
    'S10: the pool fixture is the production active pool (14 rows: 5 H · 8 M · 1 L)');
  const ciy = (PROGRESS.seriesList || []).find((r) => r.series === 'catechism-in-a-year');
  ok(!!ciy && ciy.currentKey === 'ciy:day-2' && !!(DAY.introTexts && DAY.introTexts['daily-rosary'])
    && JSON.stringify(SEATS_LIVE.before) === '["prayer-before-communion"]' && JSON.stringify(SEATS_LIVE.afterMass) === '["hail-holy-queen"]',
    'S11: the fixtures stand — the by-play key, F1\u2019s real paired draw for daily-rosary (the duplication premise), John\u2019s seats');
}

/* ---------------- W: the worker round-trip ---------------- */
const WRANGLER = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler';
const PERSIST = path.join(APP, '.wrangler-test-v539');
const WPORT = 8803;
const WBASE = 'http://127.0.0.1:' + WPORT;
const TOKEN = 'harness-v539-token';
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'h539-'));
function wranglerD1(args) {
  return execFileSync(WRANGLER, ['d1', 'execute', 'ora-pro-nobis-app', '--local', '--config', path.join(APP, 'wrangler.toml'), '--persist-to', PERSIST, ...args],
    { cwd: APP, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } }).toString();
}
function migFiles() {
  const dir = path.join(APP, 'migrations');
  return readdirSync(dir).filter((x) => x.endsWith('.sql')).sort().map((f) => path.join(dir, f));
}
function applyFiles(files) {
  rmSync(PERSIST, { recursive: true, force: true });
  const f = path.join(TMPD, 'mig-joined.sql');
  fs.writeFileSync(f, files.map((x) => readFileSync(x, 'utf8')).join('\n'));
  wranglerD1(['--file', f]);
}
function d1run(sql) { wranglerD1(['--command', sql]); }
const procs = [];
function startApp() {
  const args = ['dev', '--config', path.join(APP, 'wrangler.toml'), '--local', '--port', String(WPORT), '--persist-to', PERSIST,
    '--var', 'LOCAL_DEV:1', '--var', 'AGENT_TOKEN:' + TOKEN];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  procs.push(child);
  return child;
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(WBASE + '/'); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const wpost = async (p, body) => {
  const r = await fetch(WBASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const TD = '/api/player/track-draws';
const D1 = '2026-11-18';
const BATCH_KEYS = ['morning-prayer', 'daily-rosary', 'marian-antiphon-angelus|Morning', 'ciy:day-2', 'prayer:anima-christi:en', 'ext-invitatory'];

if (!PROBE) {
  try {
    applyFiles(migFiles());
    const esc = (s) => String(s).replace(/'/g, "''");
    d1run('INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES '
      + POOL.map((r) => `(${r.id}, '${esc(r.text)}', '${r.priority}', 'active', '2026-11-18T00:00:00Z')`).join(', '));
    startApp();
    ok(await waitUp(), 'W0: app up on local wrangler (LOCAL_DEV harness mode), D1 through 0040, production pool seeded');

    let r = await wpost(TD, { date: D1, keys: BATCH_KEYS, via: 'build' });
    const map1 = r.body.draws || {};
    ok(r.status === 200 && BATCH_KEYS.every((k) => map1[k] && poolById.has(map1[k].intentionId) && map1[k].text === poolById.get(map1[k].intentionId).text),
      'W1: the batch fill returns a draw for every built key, each a production pool intention with its text — the route stands unchanged',
      JSON.stringify(r.body).slice(0, 200));
    r = await wpost(TD, { date: D1, keys: BATCH_KEYS, via: 'build' });
    ok(JSON.stringify(r.body.draws) === JSON.stringify(map1),
      'W2: a second identical batch returns the SAME map — fill-missing, no re-draw (the assignment underneath is untouched)');
  } catch (e) {
    ok(false, 'W: worker round-trip completed', String(e).slice(0, 220));
  } finally {
    procs.forEach((p) => { try { process.kill(-p.pid, 'SIGKILL'); } catch { try { p.kill('SIGKILL'); } catch { /* gone */ } } });
    rmSync(PERSIST, { recursive: true, force: true });
  }
}

/* ---------------- C: the client in Chromium ---------------- */
const require2 = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = require2('playwright-core');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
let cooked = null;
try {
  const t = C_SRC.indexOf('APP_JS = `') + 10;
  const cookedRaw = new Function('return `' + C_SRC.slice(t, C_SRC.indexOf('`;', t)) + '`')();
  cooked = cookedRaw;
} catch (e) { /* recorded below */ }

const SERIES = {
  ok: true, available: true, series: 'catechism-in-a-year', title: 'Catechism in a Year', showDesc: '', showImageUrl: null,
  currentKey: 'ciy:day-2', listenedCount: 1, total: 2,
  entries: [
    { key: 'ciy:day-1', label: 'Day 1', title: 'In the Beginning', url: 'https://example.com/ciy1.mp3', durationS: 900, listened: true, listenDate: '2026-11-17', positionS: null, descText: '', imageUrl: null },
    { key: 'ciy:day-2', label: 'Day 2', title: 'The Story of Creation', url: 'https://example.com/ciy2.mp3', durationS: 900, listened: false, listenDate: null, positionS: null, descText: '', imageUrl: null },
  ],
};
function buildPage() {
  const stub = `
window.__drawCalls = [];
window.__drawStore = {};
window.__drawFail = false;
window.__pool = ${JSON.stringify(POOL.map((r) => ({ id: r.id, text: r.text })))};
window.__drawHash = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
window.fetch = function (path, opts) {
  var p = String(path);
  function ans(status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); }, text: function () { return Promise.resolve(JSON.stringify(body)); } }); }
  if (p.indexOf('/api/player/track-draws') === 0) {
    if (window.__drawFail) return Promise.reject(new Error('draw route down'));
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
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/player/source-settings') === 0) return ans(200, { ok: true, version: 1, sources: [] });
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, ${JSON.stringify(BOOK)});
  if (p.indexOf('/api/player/podcasts?series=') === 0) return ans(200, ${JSON.stringify(SERIES)});
  return ans(200, { ok: true });
};
window.HTMLMediaElement.prototype.play = function () { this.__playing = true; return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () { this.__playing = false; };
window.__noNative = true;
try { Object.defineProperty(window, 'OraNative', { get: function () { return undefined; } }); } catch (e) {}
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

if (!PROBE) {
  let browser = null;
  let srvRef = null;
  try {
    ok(!!cooked, 'C0: the cooked client script parses (the template-literal law)');
    if (cooked) {
      browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
      const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
      const pageHtml = buildPage();
      srvRef = http.createServer((req, res) => {
        if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(pageHtml); }
        else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); }
      });
      await new Promise((r) => srvRef.listen(0, '127.0.0.1', r));
      await page.goto('http://127.0.0.1:' + srvRef.address().port + '/');
      await page.waitForFunction(() => window.state && state.tab, null, { timeout: 25000 });
      await page.click('[data-tab="prayers"]');
      await page.waitForFunction(() => window.state && state.dayPayload, null, { timeout: 25000 });
      await page.waitForSelector('[data-openblock]', { timeout: 15000 });
      ok(errors.length === 0, 'C0b: boot clean under the stubbed store (no page errors)', errors.join(' | '));

      // C1 — the build settle stands exactly as v528 left
      // it (the assignment underneath is untouched).
      await ev(page, () => {
        window.__drawCalls = [];
        state.dayDescs = [
          { episodeId: 'daily-rosary', title: 'Daily Rosary', url: 'https://example.com/dr.mp3', available: true, block: 'Morning', durationS: 1200 },
          { episodeId: 'marian-antiphon-angelus', title: 'Marian Antiphon', url: 'https://example.com/ma.mp3', available: true, block: 'Morning', durationS: 60 },
          { episodeId: 'marian-antiphon-angelus', title: 'Marian Antiphon', url: 'https://example.com/ma.mp3', available: true, block: 'Evening', durationS: 60 },
          { episodeId: 'intro:morning-prayer', title: 'Intentions', url: '', available: true, block: 'Morning' },
          { episodeId: 'seg:Morning', title: 'Morning', url: '', available: true, block: 'Morning' },
        ];
        refreshRepeatIds();
        settleTrackDraws();
      });
      await sleep(400);
      const c1 = await ev(page, () => ({ calls: window.__drawCalls, map: state.trackDraws }));
      const batchKeys = (c1.calls[0] && c1.calls[0].keys) || [];
      ok(c1.calls.length === 1 && c1.calls[0].via === 'build'
        && ['daily-rosary', 'marian-antiphon-angelus|Morning', 'marian-antiphon-angelus|Evening'].every((k) => batchKeys.includes(k))
        && batchKeys.length === 3 && c1.map && c1.map['daily-rosary'],
        'C1: the build settle batch stands as v528 left it — one batch, playedKey forms, intro:/seg: excluded, the map lands',
        JSON.stringify(c1.calls).slice(0, 200));

      // C2 — THE DUPLICATION LEG: the built track's
      // descriptor carries a stamped paired text (the
      // block-head system's delivery field). The paired
      // read still resolves it (the machinery stands);
      // the card must paint exactly ONE intention line —
      // the track draw, labeled "Intention: " — and the
      // paired text must never paint.
      const c2 = await ev(page, () => {
        state.dayDescs[0].intentionText = 'PAIRED-MARKER-TEXT';
        var premise = introForTrack(state.dayDescs[0]);
        var card = trackCard({ episodeId: 'daily-rosary', title: 'Daily Rosary', available: true, streamUrl: 'https://example.com/dr.mp3', durationS: 1200, hasText: true, textUrl: '/api/player/text/2026-11-18/daily-rosary', _block: 'Morning' }, 'Morning');
        return { premise: premise && premise.text, card: card, draw: state.trackDraws['daily-rosary'],
          lines: (card.match(/intention-text/g) || []).length };
      });
      ok(c2.premise === 'PAIRED-MARKER-TEXT' && c2.lines === 1 && c2.card.includes('Intention: ' + c2.draw)
        && !c2.card.includes('PAIRED-MARKER-TEXT') && !c2.card.includes('Prayer Intention'),
        'C2: a paired built-day track paints exactly ONE intention line — its track draw under "Intention: " — and the block-head text never paints',
        JSON.stringify({ lines: c2.lines, draw: c2.draw }).slice(0, 200));

      // C3 — Now Playing: no #np-intention element stands
      // in the sheet; the one line stands under the label.
      await ev(page, () => { playTrack(state.dayDescs[0]); openNowPlaying(); });
      await sleep(300);
      const c3 = await ev(page, () => {
        var el = document.querySelector('#np-track-intention');
        return { pairedGone: !document.querySelector('#np-intention'), text: el ? el.textContent : null,
          shown: el ? el.style.display !== 'none' : false, expected: state.trackDraws['daily-rosary'] };
      });
      ok(c3.pairedGone && c3.shown && c3.text === 'Intention: ' + c3.expected,
        'C3: Now Playing carries no paired element and exactly the one line — the track draw under "Intention: "');

      // C4 — the native face: the state payload's subtitle
      // is the track's OWN draw (the lock screen / car
      // display carry the one intention), never the paired
      // marker; OFF empties it.
      const c4 = await ev(page, () => {
        var on = nativeStatePayload(false);
        setIntentions(false);
        var off = nativeStatePayload(false);
        setIntentions(true);
        return { onSub: on && on.subtitle, offSub: off && off.subtitle, expected: state.trackDraws['daily-rosary'] };
      });
      ok(c4.onSub === c4.expected && c4.offSub === '',
        'C4: the native subtitle is the playing track\u2019s own draw under the toggle — the one intention on the lock screen / car display',
        JSON.stringify(c4).slice(0, 200));

      // C5 — the prayer page: anima-christi lands its line
      // through its own by-play draw, under the one label.
      await ev(page, (book) => { state.book = { groups: book.groups }; openPrayerPage('anima-christi'); }, BOOK);
      await sleep(200);
      await ev(page, () => { window.__drawCalls = []; document.getElementById('book-play').click(); });
      await sleep(500);
      const c5 = await ev(page, () => {
        var el = document.getElementById('book-track-intention');
        return { shown: el ? el.style.display !== 'none' : false, text: el ? el.textContent : null, expected: state.trackDraws['prayer:anima-christi:en'] };
      });
      ok(c5.shown && c5.text === 'Intention: ' + c5.expected,
        'C5: the prayer page carries its line after its by-play draw, labeled "Intention: "');

      // C6 — BY-PLAY on ciy:day-2: draws at startDesc,
      // stands on Now Playing and on its series row on
      // return — under the one label everywhere.
      await ev(page, (series) => { window.__drawCalls = []; state.podcasts = series; paintPodcasts(); playPodFrom('ciy:day-2'); openNowPlaying(); }, SERIES);
      await sleep(400);
      const c6a = await ev(page, () => {
        var el = document.querySelector('#np-track-intention');
        return { np: el ? el.textContent : null, expected: state.trackDraws['ciy:day-2'], pairedGone: !document.querySelector('#np-intention') };
      });
      ok(c6a.pairedGone && c6a.np === 'Intention: ' + c6a.expected,
        'C6: BY-PLAY — ciy:day-2 outside the build draws at play and stands on Now Playing under "Intention: "',
        JSON.stringify(c6a).slice(0, 200));
      await ev(page, () => { paintPodcasts(); });
      await sleep(500);
      const c6b = await ev(page, () => {
        var rows = Array.prototype.slice.call(document.querySelectorAll('.track-draw-line')).map((n) => n.textContent);
        return { rows: rows, expected: state.trackDraws['ciy:day-2'] };
      });
      ok(c6b.rows.some((t) => t === 'Intention: ' + c6b.expected) && !c6b.rows.some((t) => t.indexOf('Track intention') === 0),
        'C7: on return to the series page, the played episode\u2019s row carries the one line under "Intention: "');

      // C8 — the showing toggle OFF: no intention line
      // paints on the card.
      const c8 = await ev(page, () => {
        setIntentions(false);
        var card = trackCard({ episodeId: 'daily-rosary', title: 'Daily Rosary', available: true, streamUrl: 'https://example.com/dr.mp3', durationS: 1200, hasText: false, _block: 'Morning' }, 'Morning');
        setIntentions(true);
        return { hasLine: card.includes('track-draw-line') };
      });
      ok(!c8.hasLine, 'C8: with the showing toggle OFF, the card paints no intention line — the toggle governs the one system');
      ok(errors.length === 0, 'C9: no page errors across the client legs', errors.join(' | '));
    }
  } catch (e) {
    ok(false, 'C: client legs completed', String(e).slice(0, 220));
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { srvRef.close(); } catch { /* not started */ }
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
  console.log('note - G439 standing gate on the v539 tree, recorded AS-IS (never a v539 pass): ' + (m ? m[1] + ' ok / ' + m[2] + ' not-ok' : 'unreadable — ' + out.slice(-200)));
}

console.log('harness-v539: ' + pass + ' ok / ' + fail + ' not-ok' + (failures.length ? ' :: ' + failures.join(' ;; ') : ''));
process.exit(PROBE ? 0 : (fail ? 1 : 0));
