// harness-v528.mjs — v528 evidence: Intentions on all
// tracks, Part B — the random draw (Scope package 46
// Part B; John's decisions B4–B7 + the coverage
// requirement + the draw-timing field trial, Ora thread
// 2026-11-17 20:09/22:19/22:21 CT; hold lifted "Build it",
// 2026-11-18 10:21 CT). One server store (migration 0040,
// prayer_track_draws — the Plan named 0039, taken by v527;
// the next free number stands, recorded in the release
// document §3) backs a client-settle batch draw
// (POST /api/player/track-draws, INSERT OR IGNORE
// fill-missing, uniform random from the full active pool —
// NOT the H4·M2·L1 block-head rule) and a by-play draw at
// the single startDesc seam for tracks outside the build.
// Surfaces, all from one state.trackDraws map: trackCard's
// line, the prayer page, Now Playing, the series rows.
//   S statics: migration 0040 stands last and carries the
//     table in the Plan's shape · the route + fill stand in
//     index.ts · the retire/delete cleanup stands beside
//     the standing prayer_draws cleanup · the client seams
//     stand (settle at the build + rebuild, ensure at
//     startDesc, the three surface paints)
//   W worker (local wrangler + fixture D1): batch fill —
//     every key returns a draw from the production pool ·
//     a second identical request returns the SAME map
//     (fill-missing, no re-draw) · drawn_via records
//     'build' vs 'play' · by-play persistence (a second
//     play returns the same intention) · intro:/seg: keys
//     draw nothing · independence over a large key set
//     (picks repeat, no key forced unique) · next day —
//     the same key draws under its own date row, no
//     carry-over · retire cleanup (date >= today rows for
//     the retired intention delete; the next request
//     re-fills from the remaining pool) · delete cleanup ·
//     validations refuse and write nothing · pool-empty
//     posture (an empty map returns)
//   C client (Chromium, stubbed fetch with an in-page
//     fill-missing draw store): cooked parse + boot clean ·
//     the build settle sends ONE batch with the built
//     keys (playedKey forms for repeats) · the row line
//     paints on a built-day track before play, and no line
//     paints where no draw stands · Now Playing carries
//     the built track's line at play · the prayer page
//     carries its line after its by-play draw · BY-PLAY —
//     ciy:day-2, absent from the built day, draws at
//     startDesc (single key, via 'play'), stands on Now
//     Playing, and stands on its series row on return · a
//     second play of the same episode asks for no new draw
//     · exclusion — intro:/seg: descriptors ask for nothing
//     · failure posture — the draw route forced to fail:
//     playback starts, no line, no error surface
//   G439 (recorded as-is, NEVER a v528 pass): the standing
//     v439 boot gate run on this tree.
// Fixtures (Improvement D), under tests/fixtures-v528/,
// drawn from production on 2026-11-18 at Implement:
//   F1 day-live-2026-11-18.json — prayer-door GET
//     /api/agent/player/day?date=2026-11-18 (Salesian fold:
//     Morning · Midday · Evening · Night · Novenas ·
//     Podcasts; blocks carry empty tracks by design).
//   F2 podcasts-progress-live.json — prayer-door GET
//     /api/agent/podcasts/progress (seriesList carrying
//     catechism-in-a-year currentKey ciy:day-2 — the
//     out-of-build key the by-play legs exercise — and
//     bible-in-a-year currentKey biy:day-319).
//   F3 intentions-pool-live.json — the production
//     prayer_intentions active pool read through the
//     standing ship driver's D1 read (14 rows: 5 H · 8 M ·
//     1 L).
//   F4 book-live.json — prayer-door GET
//     /api/agent/prayer/book (9 groups / 77 prayers; the
//     prayer-page leg uses anima-christi, audio en 29.9).
//   mass-personal-live.json — John's four seats through
//     the prayer door (the preservation fixture).
// The C-leg series payload is built in the standing
// /api/player/podcasts?series= shape around F2's real
// currentKey ciy:day-2 (the progress read carries no
// entries; the entry shape is the live series payload's).
// The base for byte comparisons is the v532 ship tree
// (H528_BASE overrides).
// Run: node app/tests/harness-v528.mjs [--probe] (from
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
const BASE = process.env.H528_BASE || path.resolve(ROOT, '../../.worktrees/v532-ship/app/worker/src');
const FX = APP + '/tests/fixtures-v528';
const POOL = JSON.parse(readFileSync(FX + '/intentions-pool-live.json', 'utf8'));
const DAY = JSON.parse(readFileSync(FX + '/day-live-2026-11-18.json', 'utf8'));
const PROGRESS = JSON.parse(readFileSync(FX + '/podcasts-progress-live.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(FX + '/book-live.json', 'utf8'));
const SEATS_LIVE = JSON.parse(readFileSync(FX + '/mass-personal-live.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayChicago = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

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
  ok(migs[migs.length - 1] === '0040_prayer_track_draws.sql', 'S1: migration 0040 stands last (the Plan\u2019s 0039 was taken by v527)', migs.slice(-2).join(','));
  const M40 = readFileSync(APP + '/migrations/0040_prayer_track_draws.sql', 'utf8');
  ok(M40.includes('CREATE TABLE IF NOT EXISTS prayer_track_draws') && M40.includes('track_key TEXT NOT NULL')
    && M40.includes('drawn_via TEXT NOT NULL') && M40.includes('PRIMARY KEY (date, track_key)'),
    'S2: 0040 creates prayer_track_draws in the Plan\u2019s shape (date, track_key, intention_id, drawn_via, created_at)');
  ok(I_SRC.includes('async function prayerTrackDraws(') && I_SRC.includes('"track-draws"') && I_SRC.includes('INSERT OR IGNORE INTO prayer_track_draws'),
    'S3: the fill helper and the session track-draws route stand in index.ts');
  ok((I_SRC.match(/DELETE FROM prayer_track_draws/g) || []).length === 2,
    'S4: the retire (date >= today) and delete (all dates) cleanups stand beside the prayer_draws cleanups',
    String((I_SRC.match(/DELETE FROM prayer_track_draws/g) || []).length));
  ok(!I_SRC.slice(I_SRC.indexOf('async function prayerTrackDraws('), I_SRC.indexOf('// v426', I_SRC.indexOf('async function prayerTrackDraws('))).includes('priority === "H" ? 4'),
    'S5: the track fill carries no H/M/L weighting — the pick is uniform (B4)');
  ok(C_SRC.includes('function settleTrackDraws()') && C_SRC.includes('function ensureTrackDraw(desc)') && C_SRC.includes('state.trackDraws'),
    'S6: the client draw state and both seams stand in client.ts');
  ok(C_SRC.includes('ensureTrackDraw(desc); // v528') && C_SRC.includes("post('/api/player/track-draws'"),
    'S7: startDesc carries the by-play seam and the client posts to the one route');
  ok(C_SRC.includes('track-draw-line') && C_SRC.includes("id=\"np-track-intention\"") && C_SRC.includes('id="book-track-intention"'),
    'S8: the row line, the Now Playing line, and the prayer-page line stand in client.ts');
  ok(POOL.length === 14 && POOL.filter((r) => r.priority === 'H').length === 5 && POOL.filter((r) => r.priority === 'M').length === 8 && POOL.filter((r) => r.priority === 'L').length === 1,
    'S9: the pool fixture is the production active pool (14 rows: 5 H · 8 M · 1 L)');
  const ciy = (PROGRESS.seriesList || []).find((r) => r.series === 'catechism-in-a-year');
  ok(!!ciy && ciy.currentKey === 'ciy:day-2', 'S10: the progress fixture carries the by-play key ciy:day-2 as the Catechism current episode');
  ok(JSON.stringify(SEATS_LIVE.before) === '["prayer-before-communion"]' && JSON.stringify(SEATS_LIVE.afterMass) === '["hail-holy-queen"]',
    'S11: the preservation fixture carries John\u2019s live Mass seats as read through the door');
}

/* ---------------- W: the worker round-trip ---------------- */
const WRANGLER = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler';
const PERSIST = path.join(APP, '.wrangler-test-v528');
const WPORT = 8802;
const WBASE = 'http://127.0.0.1:' + WPORT;
const TOKEN = 'harness-v528-token';
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'h528-'));
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
function d1q(sql) {
  const out = wranglerD1(['--json', '--command', sql]);
  const parsed = JSON.parse(out.slice(out.indexOf('[')));
  return parsed[0].results || [];
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
const wdel = async (p) => {
  const r = await fetch(WBASE + p, { method: 'DELETE' });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const TD = '/api/player/track-draws';
const D1 = '2026-11-18', D2 = '2026-11-19';
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
      'W1: the batch fill returns a draw for every built key, each a production pool intention with its text',
      JSON.stringify(r.body).slice(0, 200));
    r = await wpost(TD, { date: D1, keys: BATCH_KEYS, via: 'build' });
    ok(JSON.stringify(r.body.draws) === JSON.stringify(map1),
      'W2: a second identical batch returns the SAME map — fill-missing, no re-draw');
    let rows = d1q(`SELECT track_key, drawn_via FROM prayer_track_draws WHERE date = '${D1}' AND track_key IN (${BATCH_KEYS.map((k) => `'${k}'`).join(',')})`);
    ok(rows.length === BATCH_KEYS.length && rows.every((x) => x.drawn_via === 'build'),
      'W3: the stored rows record drawn_via = build for the batch keys', JSON.stringify(rows).slice(0, 160));

    r = await wpost(TD, { date: D1, keys: ['biy:day-319'], via: 'play' });
    const playId = r.body.draws && r.body.draws['biy:day-319'] && r.body.draws['biy:day-319'].intentionId;
    rows = d1q(`SELECT intention_id, drawn_via FROM prayer_track_draws WHERE date = '${D1}' AND track_key = 'biy:day-319'`);
    ok(r.status === 200 && !!playId && rows.length === 1 && rows[0].drawn_via === 'play' && rows[0].intention_id === playId,
      'W4: a single-key by-play draw lands with drawn_via = play');
    r = await wpost(TD, { date: D1, keys: ['biy:day-319'], via: 'play' });
    ok(r.body.draws && r.body.draws['biy:day-319'] && r.body.draws['biy:day-319'].intentionId === playId,
      'W5: a second play of the same key returns the SAME intention — persistence, not a re-draw');

    r = await wpost(TD, { date: D1, keys: ['intro:morning-prayer', 'seg:Morning'], via: 'build' });
    rows = d1q(`SELECT track_key FROM prayer_track_draws WHERE date = '${D1}' AND (track_key LIKE 'intro:%' OR track_key LIKE 'seg:%')`);
    ok(r.status === 200 && Object.keys(r.body.draws || {}).length === 0 && rows.length === 0,
      'W6: intro:/seg: keys draw nothing and store nothing — the block-head segments stand apart');

    const probeKeys = Array.from({ length: 120 }, (_, i) => 'probe:key-' + i);
    r = await wpost(TD, { date: D1, keys: probeKeys, via: 'build' });
    const picks = Object.values(r.body.draws || {}).map((d) => d.intentionId);
    const freq = {}; picks.forEach((id) => { freq[id] = (freq[id] || 0) + 1; });
    ok(picks.length === 120 && Object.keys(freq).length >= 3 && Math.max(...Object.values(freq)) >= 2,
      'W7: independence — 120 keys draw from the pool with repeats and no key forced unique',
      'distinct=' + Object.keys(freq).length + ' maxFreq=' + Math.max(...Object.values(freq)));

    r = await wpost(TD, { date: D2, keys: ['ciy:day-2'], via: 'build' });
    rows = d1q(`SELECT date FROM prayer_track_draws WHERE track_key = 'ciy:day-2' ORDER BY date`);
    ok(r.status === 200 && r.body.draws && !!r.body.draws['ciy:day-2'] && rows.length === 2 && rows[0].date === D1 && rows[1].date === D2,
      'W8: the next day draws under its own date row — one row per date, no carry-over');

    const badBodies = [
      { date: '18/11/2026', keys: ['x'] },
      { date: D1, keys: 'x' },
      { date: D1, keys: [''] },
      { date: D1, keys: [7] },
      { date: D1, keys: Array.from({ length: 501 }, (_, i) => 'k' + i) },
    ];
    let allRefused = true;
    for (const b of badBodies) { const rr = await wpost(TD, b); if (rr.status !== 400) allRefused = false; }
    rows = d1q(`SELECT track_key FROM prayer_track_draws WHERE track_key = 'x' OR track_key LIKE 'k%'`);
    ok(allRefused && rows.length === 0, 'W9: every validation refuses with a named 400 and writes nothing');

    // Retire cleanup — the retire handler keys on the
    // Chicago today, so this leg draws under today's date.
    const today = todayChicago();
    r = await wpost(TD, { date: today, keys: ['retire-probe-1', 'retire-probe-2', 'retire-probe-3', 'retire-probe-4', 'retire-probe-5', 'retire-probe-6'], via: 'build' });
    const retireDraws = r.body.draws || {};
    const victim = retireDraws['retire-probe-1'] && retireDraws['retire-probe-1'].intentionId;
    const affected = Object.keys(retireDraws).filter((k) => retireDraws[k].intentionId === victim);
    let rs = await wpost('/api/prayer/intentions/' + victim + '/status', { status: 'retired' });
    rows = d1q(`SELECT track_key FROM prayer_track_draws WHERE date >= '${today}' AND intention_id = ${victim}`);
    ok(rs.status === 200 && !!victim && rows.length === 0,
      'W10: retiring an intention deletes its track draws for date >= today', 'victim=' + victim + ' affected=' + affected.join(','));
    r = await wpost(TD, { date: today, keys: affected, via: 'build' });
    ok(affected.every((k) => r.body.draws && r.body.draws[k] && r.body.draws[k].intentionId !== victim),
      'W11: the next request re-fills the affected keys from the remaining pool');

    // Delete cleanup — all dates, as the standing deletion.
    r = await wpost(TD, { date: D1, keys: ['delete-probe'], via: 'build' });
    const delId = r.body.draws && r.body.draws['delete-probe'] && r.body.draws['delete-probe'].intentionId;
    rs = await wdel('/api/prayer/intentions/' + delId);
    rows = d1q(`SELECT track_key FROM prayer_track_draws WHERE intention_id = ${delId}`);
    const poolRow = d1q(`SELECT id FROM prayer_intentions WHERE id = ${delId}`);
    ok(rs.status === 200 && !!delId && rows.length === 0 && poolRow.length === 0,
      'W12: deleting an intention deletes its track draws on all dates, with the pool row');

    d1run('DELETE FROM prayer_intentions');
    r = await wpost(TD, { date: D1, keys: ['empty-probe'], via: 'build' });
    rows = d1q(`SELECT track_key FROM prayer_track_draws WHERE track_key = 'empty-probe'`);
    ok(r.status === 200 && Object.keys(r.body.draws || {}).length === 0 && rows.length === 0,
      'W13: pool-empty posture — an empty map returns and nothing is stored');
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
      // Cold start lands on the Mass tab (the v492 boot
      // rule) — the legs switch to the Pray tab, whose day
      // build is the surface under test.
      await page.waitForFunction(() => window.state && state.tab, null, { timeout: 25000 });
      await page.click('[data-tab="prayers"]');
      await page.waitForFunction(() => window.state && state.dayPayload, null, { timeout: 25000 });
      await page.waitForSelector('[data-openblock]', { timeout: 15000 });
      ok(errors.length === 0, 'C0b: boot clean under the stubbed store (no page errors)', errors.join(' | '));

      // C1 — the build settle: production-shaped descriptors
      // (the trackDesc / ownSlotTrack output shape from the
      // shipped client) stand in state.dayDescs; the settle
      // sends ONE batch with the playedKey forms.
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
      const c1 = await ev(page, () => ({
        calls: window.__drawCalls,
        map: state.trackDraws,
      }));
      const batchKeys = (c1.calls[0] && c1.calls[0].keys) || [];
      ok(c1.calls.length === 1 && c1.calls[0].via === 'build'
        && ['daily-rosary', 'marian-antiphon-angelus|Morning', 'marian-antiphon-angelus|Evening'].every((k) => batchKeys.includes(k))
        && batchKeys.length === 3,
        'C1: the build settle sends ONE batch (via build) with the built keys — repeats in playedKey form, intro:/seg: excluded',
        JSON.stringify(c1.calls).slice(0, 200));
      ok(c1.map && c1.map['daily-rosary'] && c1.map['marian-antiphon-angelus|Morning'] && c1.map['marian-antiphon-angelus|Evening'],
        'C2: the returned map stands in state.trackDraws for every built key');

      // C3 — the row line before play; no line without a draw.
      const c3 = await ev(page, () => {
        var drawn = trackCard({ episodeId: 'daily-rosary', title: 'Daily Rosary', available: true, streamUrl: 'https://example.com/dr.mp3', durationS: 1200, hasText: true, textUrl: '/api/player/text/2026-11-18/daily-rosary', _block: 'Morning' }, 'Morning');
        var undrawn = trackCard({ episodeId: 'daily-reflection', title: 'Daily Reflection', available: true, streamUrl: 'https://example.com/rf.mp3', durationS: 600, hasText: false, _block: 'Morning' }, 'Morning');
        return { drawn: drawn, undrawn: undrawn, text: state.trackDraws['daily-rosary'] };
      });
      ok(c3.drawn.includes('track-draw-line') && c3.drawn.includes('Track intention: ' + c3.text),
        'C3: a built-day track\u2019s row carries its drawn intention line BEFORE play (B6)');
      ok(!c3.undrawn.includes('track-draw-line'),
        'C4: a track with no draw standing carries no line — the map is the only source');

      // C5 — Now Playing for the built track at play.
      await ev(page, () => { playTrack(state.dayDescs[0]); openNowPlaying(); });
      await sleep(300);
      const c5 = await ev(page, () => {
        var el = document.querySelector('#np-track-intention');
        return { text: el ? el.textContent : null, shown: el ? el.style.display !== 'none' : false, expected: state.trackDraws['daily-rosary'] };
      });
      ok(c5.shown && c5.text === 'Track intention: ' + c5.expected,
        'C5: Now Playing carries the built track\u2019s drawn line at play, from the same map');

      // C6 — the prayer page: anima-christi stands in the
      // book fixture (audio en) but not in the built day —
      // its line lands through its own by-play draw.
      await ev(page, (book) => { state.book = { groups: book.groups }; openPrayerPage('anima-christi'); }, BOOK);
      await sleep(200);
      const c6a = await ev(page, () => {
        var el = document.getElementById('book-track-intention');
        return { shown: el ? el.style.display !== 'none' : false };
      });
      await ev(page, () => { window.__drawCalls = []; document.getElementById('book-play').click(); });
      await sleep(500);
      const c6 = await ev(page, () => {
        var el = document.getElementById('book-track-intention');
        return { shown: el ? el.style.display !== 'none' : false, text: el ? el.textContent : null, calls: window.__drawCalls, expected: state.trackDraws['prayer:anima-christi:en'] };
      });
      ok(!c6a.shown && c6.shown && c6.text === 'Track intention: ' + c6.expected
        && c6.calls.length === 1 && c6.calls[0].via === 'play' && c6.calls[0].keys.length === 1 && c6.calls[0].keys[0] === 'prayer:anima-christi:en',
        'C6: the prayer page carries its line after the prayer\u2019s own by-play draw (single key, via play)',
        JSON.stringify(c6).slice(0, 220));

      // C7 — BY-PLAY on ciy:day-2: absent from the built
      // day (the field-trial leg; the key is F2\u2019s real
      // current episode). It draws at startDesc, stands on
      // Now Playing, and stands on its series row on return.
      await ev(page, (series) => { window.__drawCalls = []; state.podcasts = series; paintPodcasts(); playPodFrom('ciy:day-2'); openNowPlaying(); }, SERIES);
      await sleep(400);
      const c7a = await ev(page, () => {
        var el = document.querySelector('#np-track-intention');
        return { calls: window.__drawCalls, np: el ? el.textContent : null, expected: state.trackDraws['ciy:day-2'] };
      });
      ok(c7a.calls.length === 1 && c7a.calls[0].via === 'play' && c7a.calls[0].keys.length === 1 && c7a.calls[0].keys[0] === 'ciy:day-2'
        && c7a.np === 'Track intention: ' + c7a.expected,
        'C7: BY-PLAY — ciy:day-2, reached outside the day build, draws at startDesc (single key, via play) and stands on Now Playing',
        JSON.stringify(c7a).slice(0, 220));
      await ev(page, () => { paintPodcasts(); });
      await sleep(500);
      const c7b = await ev(page, () => {
        var rows = Array.prototype.slice.call(document.querySelectorAll('.track-draw-line')).map((n) => n.textContent);
        return { rows: rows, expected: state.trackDraws['ciy:day-2'] };
      });
      ok(c7b.rows.some((t) => t === 'Track intention: ' + c7b.expected),
        'C8: on return to the series page, the played episode\u2019s row carries its drawn line (the podRowString paint)');
      await ev(page, () => { window.__drawCalls = []; playPodFrom('ciy:day-2'); });
      await sleep(300);
      const c7c = await ev(page, () => ({ calls: window.__drawCalls }));
      ok(c7c.calls.length === 0,
        'C9: a second play of the same episode asks for no new draw — the standing draw is reused');

      // C10 — failure posture: the draw route forced down;
      // playback starts, no line, no error surface.
      await ev(page, () => { window.__drawFail = true; window.__drawCalls = []; playTrack({ episodeId: 'biy:day-319', title: 'Bible in a Year — Day 319', url: 'https://example.com/biy.mp3', available: true, block: 'Podcasts', durationS: 1500 }); openNowPlaying(); });
      await sleep(400);
      const c10 = await ev(page, () => {
        var el = document.querySelector('#np-track-intention');
        return { current: state.current && state.current.episodeId, shown: el ? el.style.display !== 'none' : false, errShown: !!document.querySelector('.toast, .error-banner') };
      });
      ok(c10.current === 'biy:day-319' && !c10.shown && !c10.errShown,
        'C10: a failed draw never blocks playback — the track starts, no line paints, no error surface');
      ok(errors.length === 0, 'C11: no page errors across the client legs', errors.join(' | '));
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
  console.log('note - G439 standing gate on the v528 tree, recorded AS-IS (never a v528 pass): ' + (m ? m[1] + ' ok / ' + m[2] + ' not-ok' : 'unreadable — ' + out.slice(-200)));
}

console.log('harness-v528: ' + pass + ' ok / ' + fail + ' not-ok' + (failures.length ? ' :: ' + failures.join(' ;; ') : ''));
process.exit(PROBE ? 0 : (fail ? 1 : 0));
