// harness-v527.mjs — v527 evidence: Universal Prayer
// intentions in the Mass tab (Scope package 45, approval
// record 32 — John, Ora thread 2026-11-17 20:04 CT).
// A new section stands in the Mass scroll between the
// Liturgy of the Word and the Liturgy of the Eucharist,
// headed "The Universal Prayer" with the smaller line
// "Prayer of the Faithful" under it, in the FIXED order:
// an intention for the Pope · the referencing sentence
// pinned in the package ("We pray also for the
// intentions of the Universal Prayer as published
// locally in this parish" — the app points to the
// parish-published Universal Prayer and does not carry
// it) · John's private intentions for the day, each
// exactly as written, each followed by "Lord, hear our
// prayer." in bold, under a brief invitation. An empty
// day still stands the section with the line "No
// private intentions added for today" (John's override).
// The list is stored per date (migration 0039), edited
// through ONE editor standing in two hosts — its own
// block inside the Pre-Mass Prayers section, and at the
// Universal Prayer point — with pool-pick adds (a copy;
// the pool never changes), free-text adds, inline edit,
// remove, and re-order, all riding a whole-list PUT.
//   S statics: migration 0039 stands last and carries
//     the table · the routes and helpers stand in
//     index.ts · the section paints at the seam in
//     source order · the pinned sentence byte-present ·
//     the standing seat paint byte-identical to base
//   W worker (local wrangler + fixture D1): the session
//     GET on an unstored date reads empty · the PUT
//     stores whole and the GET re-reads · a second PUT
//     replaces, never appends · another date reads
//     empty (no carry-forward) · every validation
//     refuses and writes nothing · the door GET mirrors
//     the stored list · the migrated seats read their
//     seed shape (0039 touches nothing standing)
//   C client (the v511/v523 Chromium mold, stubbed
//     fetch): cooked parse + boot clean · the section
//     order and the fixed in-section order, the pinned
//     sentence byte-exact, the responses bold · the
//     empty day's override line · the Pre-Mass block
//     inside the section · pool add copies a fixture
//     pool text and the PUT carries the whole list ·
//     free-text add at the point · inline edit (the
//     pool never written) · remove · re-order · both
//     hosts agree after each act · a failed PUT leaves
//     the list as it stood · the seats paint John's
//     live picks from the preservation fixture · a late
//     seat repaint never wipes the intentions block
//   G439 (recorded as-is, NEVER a v527 pass): the
//     standing v439 boot gate on this tree.
// Fixtures (Improvement D), under tests/fixtures-v527/,
// drawn from production at Scope on 2026-11-18:
// intentions-pool-live.json — the ACTIVE intentions
// pool read from production D1 through the standing
// ship driver's d1 read (14 rows: 5 H · 8 M · 1 L;
// id 18 is the Sam Shorter intention inserted
// 2026-11-17) · mass-personal-live.json — John's four
// seats read through the prayer door (before
// [prayer-before-communion] · after
// [prayer-after-communion] · afterMass [hail-holy-queen]
// · preMass the seed four). The Mass scroll paints
// against the standing live fixtures (the v522 day, the
// v523 short-day calendar entry, the live book).
// The base for byte comparisons is the v523 ship tree
// (H527_BASE overrides).
// Run: node app/tests/harness-v527.mjs [--probe] (from
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
const BASE = process.env.H527_BASE || path.resolve(ROOT, '../../.worktrees/v523-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v527';
const POOL = JSON.parse(readFileSync(FX + '/intentions-pool-live.json', 'utf8'));
const SEATS_LIVE = JSON.parse(readFileSync(FX + '/mass-personal-live.json', 'utf8'));
const DAY = JSON.parse(readFileSync(APP + '/tests/fixtures-v522/day-live-2026-11-17.json', 'utf8'));
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const SHORT = JSON.parse(readFileSync(APP + '/tests/fixtures-v523/mass-calendar-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('NOT-OK -', label, extra ? ':: ' + String(extra).slice(0, 220) : ''); }
}
const poolText = (id) => (POOL.find((r) => r.id === id) || {}).text || '';
const T_A = poolText(2);   // the marriage intention (production pool)
const T_B = poolText(18);  // the Sam Shorter intention (production pool)
const T_C = poolText(3);   // the perseverance intention (production pool)

/* ---------------- S: statics ---------------- */
if (PROBE) {
  console.log('pool rows:', POOL.length, '| T_A/T_B/T_C set:', !!T_A, !!T_B, !!T_C);
  console.log('migrations tail:', readdirSync(APP + '/migrations').filter((x) => x.endsWith('.sql')).sort().slice(-3).join(', '));
} else {
  const migs = readdirSync(APP + '/migrations').filter((x) => x.endsWith('.sql')).sort();
  ok(migs[migs.length - 1] === '0039_mass_universal_prayer.sql', 'S1: migration 0039 stands last, none past it', migs.slice(-2).join(','));
  const M39 = readFileSync(APP + '/migrations/0039_mass_universal_prayer.sql', 'utf8');
  ok(M39.includes('CREATE TABLE IF NOT EXISTS mass_universal_prayer') && M39.includes('date TEXT PRIMARY KEY'),
    'S2: 0039 creates mass_universal_prayer keyed by date');
  ok(!M39.includes('mass_personal_prayer ('), 'S3: 0039 does not touch the mass_personal_prayer store');
  ok(I_SRC.includes('async function massUniversalIntentions(') && I_SRC.includes('async function massUniversalWrite('),
    'S4: the store helpers stand in index.ts');
  ok((I_SRC.match(/mass-universal-prayer/g) || []).length >= 3,
    'S5: the session GET/PUT pair and the door GET stand in index.ts', (I_SRC.match(/mass-universal-prayer/g) || []).length);
  const seamWord = C_SRC.indexOf('massLinesHtml(MASS_ORDER.creedOutro');
  const seamUp = C_SRC.indexOf("'<div id=\"mass-universal-section\">'");
  const seamEuch = C_SRC.indexOf("massSectionHtml('Liturgy of the Eucharist')");
  ok(seamWord > 0 && seamUp > seamWord && seamEuch > seamUp,
    'S6: the section paints at the seam — after the Word tail, before the Liturgy of the Eucharist header');
  ok(C_SRC.includes('We pray also for the intentions of the Universal Prayer as published locally in this parish'),
    'S7: the referencing sentence stands byte-exact as pinned in the package');
  ok(C_SRC.includes('No private intentions added for today') && C_SRC.includes('Prayer of the Faithful') && C_SRC.includes('The Universal Prayer'),
    'S8: the override line, the subline, and the heading stand in client.ts');
  ok(!C_BASE.includes('massUniversal'), 'S9: the base carries no v527 code (the diff premise)');
  const fnExtract = (src) => { const a = src.indexOf('function massPersonalListHtml('); const b = src.indexOf('function massPersonalLangHtml(', a); return src.slice(a, b); };
  ok(fnExtract(C_SRC) === fnExtract(C_BASE), 'S10: the standing seat list paint is byte-identical to the base');
  const UI_BLOCK = [
    '/* v527: the Universal Prayer section — the smaller line',
    '   under its heading, the bold response after each',
    '   intercession, and the intentions editor\'s rows (the',
    '   free-text and inline-edit inputs ride one rule). */',
    '.mass-up-sub { font-size: 14px; opacity: .7; margin: -4px 0 8px; }',
    '.mass-up-response { font-weight: 700; }',
    '.mass-panel .mass-line[data-mutext] { cursor: pointer; }',
    '.mu-addrow { display: flex; gap: 8px; align-items: center; margin: 8px 0 4px; }',
    '.mu-input { flex: 1; min-width: 0; font: inherit; font-size: 16px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: inherit; }',
    '.mu-poolrow { white-space: normal; text-align: left; height: auto; }',
  ].join('\n');
  ok(U_SRC.replace(UI_BLOCK, '@@V527@@') !== U_SRC && U_SRC.replace(UI_BLOCK, '').replace('\n', '') === U_BASE || U_SRC.replace(UI_BLOCK + '\n', '') === U_BASE,
    'S11: ui.ts differs from the base only by the v527 CSS block (the pin bump rides the ship compose)');
  ok(POOL.length === 14 && POOL.some((r) => r.id === 18) && POOL.every((r) => r.status === 'active'),
    'S12: the pool fixture is the production active pool (14 rows, id 18 stands)');
  ok(JSON.stringify(SEATS_LIVE.before) === '["prayer-before-communion"]'
    && JSON.stringify(SEATS_LIVE.after) === '["prayer-after-communion"]'
    && JSON.stringify(SEATS_LIVE.afterMass) === '["hail-holy-queen"]'
    && SEATS_LIVE.preMass.length === 4,
    'S13: the preservation fixture carries John\'s live seats as read through the door at Scope');
}

/* ---------------- W: the worker round-trip ---------------- */
const WRANGLER = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler';
const PERSIST = path.join(APP, '.wrangler-test-v527');
const WPORT = 8801;
const WBASE = 'http://127.0.0.1:' + WPORT;
const TOKEN = 'harness-v527-token';
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'h527-'));
function wranglerD1(args) {
  return execFileSync(WRANGLER, ['d1', 'execute', 'ora-pro-nobis-app', '--local', '--config', path.join(APP, 'wrangler.toml'), '--persist-to', PERSIST, ...args],
    { cwd: APP, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } }).toString();
}
function wranglerD1File(file) { return wranglerD1(['--file', file]); }
function migFiles() {
  const dir = path.join(APP, 'migrations');
  return readdirSync(dir).filter((x) => x.endsWith('.sql')).sort().map((f) => path.join(dir, f));
}
function applyFiles(files) {
  rmSync(PERSIST, { recursive: true, force: true });
  const f = path.join(TMPD, 'mig-joined.sql');
  fs.writeFileSync(f, files.map((x) => readFileSync(x, 'utf8')).join('\n'));
  wranglerD1File(f);
}
function d1q(sql) {
  const out = wranglerD1(['--json', '--command', sql]);
  const parsed = JSON.parse(out.slice(out.indexOf('[')));
  return parsed[0].results || [];
}
const procs = [];
function startApp() {
  const args = ['dev', '--config', path.join(APP, 'wrangler.toml'), '--local', '--port', String(WPORT), '--persist-to', PERSIST,
    '--var', 'LOCAL_DEV:1', '--var', 'AGENT_TOKEN:' + TOKEN];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  procs.push(child);
  return child;
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(WBASE + '/'); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const AGENT = { authorization: 'Bearer ' + TOKEN };
const wget = async (p, headers) => { const r = await fetch(WBASE + p, { headers: headers || {} }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const wput = async (p, body) => {
  const r = await fetch(WBASE + p, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const UP = '/api/prayer/mass-universal-prayer';
const D1 = '2026-11-18', D2 = '2026-11-19';

if (!PROBE) {
  try {
    applyFiles(migFiles());
    startApp();
    ok(await waitUp(), 'W0: app up on local wrangler (LOCAL_DEV harness mode), D1 through 0039');
    const seats = await wget('/api/prayer/mass-personal-prayer');
    ok(seats.status === 200 && JSON.stringify(seats.body.preMass) === JSON.stringify(SEATS_LIVE.preMass)
      && Array.isArray(seats.body.afterMass) && seats.body.afterMass.length === 7
      && Array.isArray(seats.body.before) && seats.body.before.length === 0,
      'W1: the migrated seats read their seed shape — 0039 touches nothing standing', JSON.stringify(seats.body).slice(0, 160));
    let r = await wget(UP + '?date=' + D1);
    ok(r.status === 200 && Array.isArray(r.body.intentions) && r.body.intentions.length === 0,
      'W2: the session GET on an unstored date reads an empty list');
    r = await wput(UP, { date: D1, intentions: [T_A, T_B] });
    ok(r.status === 200 && JSON.stringify(r.body.intentions) === JSON.stringify([T_A, T_B]),
      'W3: the PUT stores the list whole and answers it', JSON.stringify(r.body).slice(0, 160));
    r = await wget(UP + '?date=' + D1);
    ok(JSON.stringify(r.body.intentions) === JSON.stringify([T_A, T_B]), 'W4: the GET re-reads the stored list');
    r = await wget('/api/agent/prayer/mass-universal-prayer?date=' + D1, AGENT);
    ok(r.status === 200 && JSON.stringify(r.body.intentions) === JSON.stringify([T_A, T_B]),
      'W5: the door GET mirrors the stored list');
    r = await wput(UP, { date: D1, intentions: [T_C] });
    ok(r.status === 200 && JSON.stringify(r.body.intentions) === JSON.stringify([T_C]),
      'W6: a second PUT replaces the list, never appends');
    r = await wget(UP + '?date=' + D2);
    ok(r.status === 200 && r.body.intentions.length === 0,
      'W7: another date reads empty — no carry-forward');
    const bad = [
      [{ date: '18/11/2026', intentions: [] }, 'a bad date'],
      [{ date: D1, intentions: 'x' }, 'a non-array list'],
      [{ date: D1, intentions: [''] }, 'an empty item'],
      [{ date: D1, intentions: ['   '] }, 'a whitespace-only item'],
      [{ date: D1, intentions: [7] }, 'a non-string item'],
      [{ date: D1, intentions: Array.from({ length: 51 }, () => 'x') }, '51 items'],
      [{ date: D1, intentions: ['x'.repeat(1001)] }, 'a 1001-char item'],
    ];
    let allRefused = true;
    for (const [body] of bad) { const rr = await wput(UP, body); if (rr.status !== 400) allRefused = false; }
    ok(allRefused, 'W8: every validation refuses with a named 400');
    r = await wget(UP + '?date=' + D1);
    ok(JSON.stringify(r.body.intentions) === JSON.stringify([T_C]),
      'W9: the refusals wrote nothing — the stored list stands');
    r = await wget(UP);
    ok(r.status === 400, 'W10: the GET without a date refuses');
    r = await wget('/api/agent/prayer/mass-universal-prayer?date=nope', AGENT);
    ok(r.status === 400, 'W11: the door GET with a bad date refuses');
    const rows = d1q("SELECT intentions FROM mass_universal_prayer WHERE date = '" + D1 + "'");
    ok(rows.length === 1 && rows[0].intentions === JSON.stringify([T_C]),
      'W12: the stored row is the date\'s whole list as JSON', JSON.stringify(rows).slice(0, 120));
  } catch (e) {
    ok(false, 'W: worker round-trip completed', String(e).slice(0, 220));
  } finally {
    procs.forEach((p) => { try { p.kill('SIGKILL'); } catch { /* gone */ } });
    rmSync(PERSIST, { recursive: true, force: true });
  }
}

/* ---------------- C: the client in Chromium ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null;
try { COOKED = cook(C_SRC); ok(true, 'P0: the cooked APP_JS parses (the template-literal gate)'); }
catch (e) { ok(false, 'P0: the cooked APP_JS parses (the template-literal gate)', String(e).slice(0, 160)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

function formulary(key) {
  return {
    entranceAntiphon: { text: 'Antiphon for ' + key + '.', ref: 'Ps 1' },
    collect: 'Collect of the ' + key + ' formulary, granted for this harness day.',
    prayerOverOfferings: 'Offerings of the ' + key + ' formulary.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Communion antiphon for ' + key + '.', ref: 'Mt 5' },
    prayerAfterCommunion: 'After Communion of the ' + key + ' formulary.',
  };
}
function massPayload(entry) {
  return {
    ok: true, name: entry.name, season: 'Ordinary Time',
    defaultVersion: entry.defaultVersion,
    versions: entry.versions.map((v) => ({ key: v.key, label: v.label, rank: v.rank, formulary: formulary(v.key) })),
  };
}
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town.</p>' },
] };
const POOL_SESSION = POOL.map((r) => ({ id: r.id, text: r.text, priority: r.priority, status: r.status }));
const SENTENCE = 'We pray also for the intentions of the Universal Prayer as published locally in this parish';
const FREE_TEXT = 'For the parish staff, that God bless their work.';
const EDIT_TEXT = 'For the institution of marriage, edited for today.';

function buildPage(list) {
  return `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>${APP_CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.__up = { list: ${JSON.stringify(list)}, fail: false, puts: [] };
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push({ path: p, method: (opts && opts.method) || 'GET' });
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); } }); };
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(massPayload(SHORT))});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, ${JSON.stringify(BOOK)});
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return new Promise(function (res) { setTimeout(function () { res({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(SEATS_LIVE)}); } }); }, 700); });
  if (p.indexOf('/api/prayer/mass-universal-prayer') === 0) {
    if (opts && opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      window.__up.puts.push(body);
      if (window.__up.fail) return ans(500, { error: 'stub failure' });
      window.__up.list = body.intentions;
      return ans(200, { ok: true, date: body.date, intentions: window.__up.list });
    }
    return ans(200, { ok: true, date: '', intentions: window.__up.list });
  }
  if (p.indexOf('/api/prayer/intentions') === 0) return ans(200, { ok: true, intentions: ${JSON.stringify(POOL_SESSION)} });
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
${COOKED}
</` + `script>
</body></html>`;
}

if (!PROBE && COOKED) {
  const PAGES = { '/day': buildPage([T_A, T_C]), '/empty': buildPage([]) };
  const server = http.createServer((req, res) => {
    const u = (req.url || '/').split('?')[0];
    if (PAGES[u]) { res.setHeader('Content-Type', 'text/html'); res.end(PAGES[u]); return; }
    res.statusCode = 404; res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ORIGIN = 'http://127.0.0.1:' + server.address().port;
  const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
  const { chromium } = requirePw('playwright-core');
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
  const errs = [];
  async function boot(which) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await ctx.route('**/*', (route) => {
      if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
    });
    page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note - pageerror:', String(e).slice(0, 140)); });
    await page.goto(ORIGIN + which);
    await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - openblock slow'));
    await sleep(400);
    await page.click('#tabbar .tab[data-tab="mass"]');
    await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note - mass scroll slow'));
    await page.waitForSelector('#mass-universal-section', { timeout: 15000 }).catch(() => console.log('note - universal section slow'));
    await sleep(1400); // both loads settle — the personal read is the delayed one (700 ms)
    return { ctx, page };
  }
  const secOrder = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.mass-scroll .mass-section')).map((e) => e.textContent.trim()));
  const upInfo = (page) => page.evaluate(() => {
    const s = document.getElementById('mass-universal-section');
    if (!s) return null;
    const resp = Array.from(s.querySelectorAll('.mass-up-response'));
    return {
      text: s.innerText,
      responses: resp.length,
      firstWeight: resp.length ? getComputedStyle(resp[0]).fontWeight : null,
      subline: (s.querySelector('.mass-up-sub') || {}).textContent || null,
    };
  });
  const rows = (page, sel) => page.evaluate((q) => Array.from(document.querySelectorAll(q + ' [data-mutext]')).map((e) => e.textContent), sel);
  const lastPut = (page) => page.evaluate(() => window.__up.puts.length ? window.__up.puts[window.__up.puts.length - 1] : null);

  try {
    const { page } = await boot('/day');
    const order = await secOrder(page);
    const wi = order.indexOf('Liturgy of the Word'), ui = order.indexOf('The Universal Prayer'), ei = order.indexOf('Liturgy of the Eucharist');
    ok(wi >= 0 && ui === wi + 1 && ei === ui + 1,
      'C1: the section stands between the Liturgy of the Word and the Liturgy of the Eucharist', order.join(' · '));
    const info = await upInfo(page);
    ok(info && info.subline === 'Prayer of the Faithful', 'C2: the smaller line "Prayer of the Faithful" stands under the heading');
    const pPope = info.text.indexOf('For the Holy Father, Pope Leo XIV.');
    const pSent = info.text.indexOf(SENTENCE);
    const pA = info.text.indexOf(T_A);
    ok(pPope >= 0 && pSent > pPope && pA > pSent,
      'C3: the fixed order stands — Pope intention, then the pinned sentence byte-exact, then the day\'s intentions');
    ok(info.responses === 3 && Number(info.firstWeight) >= 700,
      'C4: each intercession is followed by the response, in bold (Pope + 2 intentions = 3)', JSON.stringify({ n: info.responses, w: info.firstWeight }));
    // The Pre-Mass block (inside the section; expand it).
    await page.click('#mass-premass-head');
    await sleep(300);
    const preHead = await page.evaluate(() => {
      const h = document.getElementById('mass-universal-premass');
      return h ? h.textContent.slice(0, 80) : '';
    });
    ok(preHead.includes('Intentions for the Universal Prayer'),
      'C5: the intentions block stands inside the Pre-Mass Prayers section under its own heading', preHead.replace(/\n/g, ' '));
    ok(JSON.stringify(await rows(page, '#mass-universal-premass')) === JSON.stringify([T_A, T_C]),
      'C6: the editor rows carry the day\'s list — and the late seat repaint never wiped the block (Plan §2.4 guard)');
    const scrollText = await page.evaluate(() => document.querySelector('.mass-scroll').textContent);
    ok(scrollText.includes('Private Pre-Communion Prayer') && scrollText.includes('Private Post-Communion Prayer')
      && scrollText.includes('Hail, Holy Queen') && scrollText.includes('Prayer of St. Ambrose before Mass'),
      'C7: the four personal-prayer seats paint John\'s live picks from the preservation fixture');
    // Pool add (from the Pre-Mass host).
    await page.click('#mass-universal-premass [data-muaddpool]');
    await page.waitForSelector('.musheet .mu-poolrow', { timeout: 8000 });
    const poolCount = await page.evaluate(() => document.querySelectorAll('.musheet .mu-poolrow').length);
    ok(poolCount === 14, 'C8: the pool sheet lists the whole active pool (14, the production fixture)', poolCount);
    await page.click('.musheet .mu-poolrow:has-text("For Sam Shorter")');
    await sleep(500);
    let lp = await lastPut(page);
    ok(lp && JSON.stringify(lp.intentions) === JSON.stringify([T_A, T_C, T_B]),
      'C9: the pool pick copies in — the PUT carries the whole list with the copy appended', lp ? JSON.stringify(lp.intentions).slice(0, 120) : 'no put');
    ok((await upInfo(page)).text.includes(T_B) && JSON.stringify(await rows(page, '#mass-universal-premass')) === JSON.stringify([T_A, T_C, T_B]),
      'C10: both hosts carry the new list after the pool add');
    // Free-text add at the Universal Prayer point.
    await page.click('#mass-universal-edit-btn');
    await sleep(300);
    await page.fill('#mass-universal-point .mu-free', FREE_TEXT);
    await page.click('#mass-universal-point [data-muaddfree]');
    await sleep(500);
    lp = await lastPut(page);
    ok(lp && lp.intentions[lp.intentions.length - 1] === FREE_TEXT && lp.intentions.length === 4,
      'C11: the free-text add at the point writes the same list', lp ? JSON.stringify(lp.intentions).slice(0, 120) : 'no put');
    ok(JSON.stringify(await rows(page, '#mass-universal-premass')) === JSON.stringify([T_A, T_C, T_B, FREE_TEXT]),
      'C12: the Pre-Mass host agrees after the point edit — one list, two hosts');
    // Inline edit of the first row (Pre-Mass host).
    await page.click('#mass-universal-premass [data-mutext="0"]');
    await page.waitForSelector('#mass-universal-premass .mu-edit', { timeout: 8000 });
    await page.fill('#mass-universal-premass .mu-edit', EDIT_TEXT);
    await page.click('#mass-universal-premass [data-muedsave]');
    await sleep(500);
    lp = await lastPut(page);
    ok(lp && lp.intentions[0] === EDIT_TEXT && lp.intentions.length === 4,
      'C13: the inline edit writes the edited copy for the day', lp ? JSON.stringify(lp.intentions).slice(0, 120) : 'no put');
    const poolWrites = await page.evaluate(() => window.__fetchLog.filter((f) => f.path.indexOf('/api/prayer/intentions') === 0 && f.method !== 'GET').length);
    ok(poolWrites === 0, 'C14: the pool itself is never written');
    // Re-order (Pre-Mass host): move the edited row down.
    await page.click('#mass-universal-premass [data-mudown="0"]');
    await sleep(500);
    lp = await lastPut(page);
    ok(lp && lp.intentions[0] === T_C && lp.intentions[1] === EDIT_TEXT,
      'C15: the re-order writes the swapped list whole', lp ? JSON.stringify(lp.intentions).slice(0, 120) : 'no put');
    // Remove (at the point host).
    await page.click('#mass-universal-point [data-muremove="3"]');
    await sleep(500);
    lp = await lastPut(page);
    ok(lp && lp.intentions.length === 3 && !lp.intentions.includes(FREE_TEXT),
      'C16: the remove at the point writes the list without the row', lp ? JSON.stringify(lp.intentions).slice(0, 120) : 'no put');
    // Failed PUT leaves the list as it stood.
    await page.evaluate(() => { window.__up.fail = true; });
    await page.click('#mass-universal-premass [data-muremove="0"]');
    await sleep(600);
    await page.evaluate(() => { window.__up.fail = false; });
    ok(JSON.stringify(await rows(page, '#mass-universal-premass')) === JSON.stringify([T_C, EDIT_TEXT, T_B]),
      'C17: a failed PUT adopts nothing — the list stands as it was in both hosts');
    ok(errs.length === 0, 'C18: no page errors on the day page', errs.join(' | ').slice(0, 160));
    // The empty day.
    const e = await boot('/empty');
    const einfo = await upInfo(e.page);
    ok(einfo && einfo.text.includes('No private intentions added for today') && einfo.text.includes(SENTENCE)
      && einfo.text.includes('For the Holy Father, Pope Leo XIV.') && einfo.responses === 1,
      'C19: the empty day still stands the section whole — Pope, sentence, and the override line');
    const eorder = await secOrder(e.page);
    ok(eorder.indexOf('The Universal Prayer') === eorder.indexOf('Liturgy of the Word') + 1,
      'C20: the empty day\'s section stands at the same seam');
  } catch (e2) {
    ok(false, 'C: client legs completed', String(e2).slice(0, 220));
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
}

/* ---------------- G439: the standing gate, as-is ---------------- */
if (!PROBE) {
  let out = '';
  try {
    out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const m = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!m && m[1] === '13' && m[2] === '2',
    'G439 (recorded as-is, not a v527 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    m ? m[0] : out.slice(-160));
}

console.log('harness-v527: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); failures.forEach((f) => console.log(' -', f)); }
process.exit(fail ? 1 : 0);
