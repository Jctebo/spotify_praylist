// harness-v429 — app-open stability (§1/§2 of the v429
// release document; John's report, Ora thread 2026-11-14
// 21:34 CT). Delta on release/v425-ship @ d57ec06: ui.ts
// SW_JS (the shell set races the network against
// SHELL_TIMEOUT_MS = 3000, stall-anchored; /api/ + the
// non-shell path + install/activate byte-standing) +
// SHELL_HTML (the boot-stamp marker in the head) +
// client.ts (the tail stamp after the register line).
// Legs run on the boot mold (real extracted SHELL_HTML +
// APP_CSS + APP_JS + SW_JS from the build tree, /api/
// stubbed, playwright route control at the server for
// hang/delay/doctored bundles). Legs map to §2.6:
//   S statics (6) · L1 hung fetch (3) · L2 healthy network
//   (2) · L3 slow network (2) · L4 incomplete boot + heal
//   (4) · L5 never twice / never first install (3) ·
//   L6 /api/ stands (1) · L7 the boot suite (2) = 23 legs.
// Construction settlement (§3): the deadline anchors at
// the start of the current stall — the plain per-request
// race measured 6,244 ms in this mold (the document race
// and the bundle race pay out in sequence), outside L1's
// [3000, 5000) bound; the anchored race measures ~3.3 s.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, '..', '..');
const SRC = path.join(WT, 'app', 'worker', 'src');
const BASE = 'd57ec06cdf14d44afaf2a9b3eed10f1b20ce6be9';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE_U = execSync('git show ' + BASE + ':app/worker/src/ui.ts', { cwd: WT, encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}
function lit(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('marker missing: ' + marker);
  const start = i + marker.length;
  const end = src.indexOf('`;', start);
  return eval('`' + src.slice(start, end) + '`');
}
function litRaw(src, marker) {
  const i = src.indexOf(marker);
  const start = i + marker.length;
  const end = src.indexOf('`;', start);
  return src.slice(start, end);
}
const SHELL_RAW = litRaw(U_SRC, 'SHELL_HTML = `');
const SW_RAW = litRaw(U_SRC, 'SW_JS = `');
const APP_RAW = litRaw(C_SRC, 'APP_JS = `');
const BASE_SW_RAW = litRaw(BASE_U, 'SW_JS = `');

/* ---------------- S: statics (6) ---------------- */
{
  const handler = SW_RAW.slice(SW_RAW.indexOf('self.addEventListener("fetch"'));
  ok(handler.includes('SHELL.indexOf(url.pathname)') && handler.includes('Promise.race')
    && (SW_RAW.match(/SHELL_TIMEOUT_MS = 3000/g) || []).length === 1,
    'S1: the fetch handler routes the shell set through the timeout race; SHELL_TIMEOUT_MS = 3000 stands once');
  const apiLine = BASE_SW_RAW.split('\n').find((l) => l.includes('indexOf("/api/")'));
  const rs = BASE_SW_RAW.indexOf('  e.respondWith(');
  const nonShell = BASE_SW_RAW.slice(rs, BASE_SW_RAW.indexOf('\n  );', rs) + 5);
  ok(SW_RAW.includes(apiLine) && SW_RAW.includes(nonShell),
    'S2: the /api/ early return and the non-shell fetch-then-catch stand byte-identical to base');
  const baseSeg = BASE_SW_RAW.slice(BASE_SW_RAW.indexOf('self.addEventListener("install"'), BASE_SW_RAW.indexOf('self.addEventListener("fetch"'));
  const curSeg = SW_RAW.slice(SW_RAW.indexOf('self.addEventListener("install"'), SW_RAW.indexOf('var SHELL_TIMEOUT_MS'));
  ok(baseSeg === curSeg && baseSeg.includes('"opn-ext-audio-v1"') && baseSeg.includes('"opn-offline-meta-v1"'),
    'S3: install + activate stand byte-identical (precache list; the purge spares both standing stores)');
  const metaI = SHELL_RAW.indexOf('name="theme-color"');
  const markI = SHELL_RAW.indexOf("localStorage.getItem('opn-boot')");
  const cssI = SHELL_RAW.indexOf('<link rel="stylesheet"');
  ok(metaI > -1 && markI > metaI && cssI > markI && SHELL_RAW.includes('opn-boot-healed'),
    'S4: SHELL_HTML carries the boot marker after the theme-color meta and before the stylesheet link, naming opn-boot / opn-boot-healed');
  const regI = APP_RAW.indexOf("navigator.serviceWorker.register('/sw.js')");
  const stampI = APP_RAW.indexOf("localStorage.setItem('opn-boot', 'complete')");
  const tail = APP_RAW.slice(APP_RAW.indexOf('\n', stampI) + 1).trim();
  ok(regI > -1 && stampI > regI && APP_RAW.includes("localStorage.removeItem('opn-boot-healed')") && tail === '',
    'S5: the tail stamp stands after the register line as the bundle\u2019s last statement and removes the healed flag');
  const names = execSync('git diff --name-only ' + BASE + ' -- app/worker/src', { cwd: WT, encoding: 'utf8' });
  const diff = execSync('git diff ' + BASE + ' -- app/worker/src', { cwd: WT, encoding: 'utf8' });
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  const cAdded = execSync('git diff ' + BASE + ' -- app/worker/src/client.ts', { cwd: WT, encoding: 'utf8' })
    .split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  ok(U_SRC.includes('ora-pro-nobis-v425-1') && !U_SRC.includes('ora-pro-nobis-v429-1')
    && !names.includes('index.ts') && !/#1DB954|#1ed760/i.test(added)
    && !/playback|intention/i.test(added)
    && cAdded.length > 0 && cAdded.every((l) => l.includes('opn-boot')),
    'S6: limits — the pin stands at ora-pro-nobis-v425-1 in the build tree (Ship moves it); no index.ts delta; no Spotify green; no playback/intention lines touched; the client.ts delta is the stamp only');
}

/* ---------------- the boot mold ---------------- */
const require = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = require('playwright-core');
const PLAIN_JS = lit(C_SRC, 'APP_JS = `');
const MARKED_JS = PLAIN_JS + '\nwindow.__netCopy = "net";\n';
const stampAt = PLAIN_JS.indexOf("localStorage.setItem('opn-boot', 'complete')");
const lineStart = PLAIN_JS.lastIndexOf('\n', stampAt) + 1;
const DOCTORED_JS = PLAIN_JS.slice(0, lineStart) + 'throw new Error("v429-doctored-boot");\n' + PLAIN_JS.slice(lineStart);
const SW_FIXED = lit(U_SRC, 'SW_JS = `');
const SW_429PIN = SW_FIXED.split('ora-pro-nobis-v425-1').join('ora-pro-nobis-v429-1');
const ASSETS = {
  '/': lit(U_SRC, 'SHELL_HTML = `'),
  '/styles.css': lit(U_SRC, 'APP_CSS = `'),
  '/manifest.json': '{"name":"Ora Pro Nobis","short_name":"Ora Pro Nobis"}',
};
const LOGO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const SHELLSET = ['/', '/styles.css', '/app.js', '/logo.png', '/logo-512.png', '/manifest.json'];
let mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p.startsWith('/api/')) {
    if (mode.hangApi) return; // never respond
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return;
  }
  if (mode.hangShell && SHELLSET.includes(p)) return; // never respond
  if (p === '/logo.png' || p === '/logo-512.png') { res.writeHead(200, { 'content-type': 'image/png' }); res.end(LOGO); return; }
  let body;
  if (p === '/app.js') body = mode.bundle;
  else if (p === '/sw.js') body = mode.sw;
  else body = ASSETS[p];
  if (body === undefined) { res.writeHead(404); res.end('nf'); return; }
  const ct = p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'text/html';
  const send = () => { res.writeHead(200, { 'content-type': ct + '; charset=utf-8' }); res.end(body); };
  if (p === '/app.js' && mode.delayApp) setTimeout(send, mode.delayApp); else send();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function newCtx() { return browser.newContext({ viewport: { width: 412, height: 900 } }); }
function watchNavs(page) {
  const box = { n: 0 };
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && f.url().startsWith(base)) box.n++; });
  return box;
}
function watchErrs(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  return errs;
}
async function prime(page) {
  await page.goto(base + '/');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {});
  await sleep(900);
}
async function paintMs(page, timeout) {
  const t0 = Date.now();
  const r = await page.waitForFunction(() => {
    const v = document.getElementById('view');
    return v && v.children.length > 0;
  }, null, { timeout: timeout || 12000 }).then(() => Date.now() - t0).catch(() => -1);
  return r;
}
const stamp = (page) => page.evaluate(() => ({
  boot: localStorage.getItem('opn-boot'),
  healed: localStorage.getItem('opn-boot-healed'),
})).catch(() => ({ boot: 'eval-fail', healed: 'eval-fail' }));

/* ---------------- L1: the hung fetch (3) ---------------- */
let l1Paint = -1;
{
  const ctx = await newCtx();
  const page = await ctx.newPage();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  await prime(page);
  const keys = await page.evaluate(() => caches.keys());
  mode.hangShell = true;
  const page2 = await ctx.newPage();
  const errs2 = watchErrs(page2);
  const t0 = Date.now();
  const pp = paintMs(page2, 14000);
  page2.goto(base + '/').catch(() => {});
  l1Paint = await pp;
  ok(keys.includes('ora-pro-nobis-v425-1') && l1Paint >= 3000 && l1Paint < 5000,
    'L1a: primed cache + hung shell — the open paints from cache inside [3000, 5000) ms from navigation', 'paint=' + l1Paint + ' keys=' + JSON.stringify(keys));
  let alive = false;
  if (l1Paint > 0) {
    const before = await page2.evaluate(() => document.getElementById('view').innerHTML.length);
    await page2.evaluate(() => document.querySelector('[data-tab="podcasts"]').click());
    await sleep(1500);
    const after = await page2.evaluate(() => document.getElementById('view').innerHTML.length);
    alive = after > 0 && after !== before;
  }
  ok(alive, 'L1b: the tab bar answers a tap after the hung-open recovery');
  ok(errs2.length === 0, 'L1c: zero pageerrors through the recovery', errs2.slice(0, 3).join(' | '));
  mode.hangShell = false;
  await ctx.close();
}

/* ---------------- L2: healthy network (2) ---------------- */
{
  const ctx = await newCtx();
  mode = { bundle: MARKED_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  const p = paintMs(page);
  await page.goto(base + '/').catch(() => {});
  const ms = await p;
  const nc = await page.evaluate(() => window.__netCopy).catch(() => undefined);
  ok(ms > 0 && nc === 'net', 'L2a: a fresh-profile open paints the network copy (the served marker byte proves which copy painted)', 'ms=' + ms + ' netCopy=' + nc);
  await ctx.close();
}
{
  const ctx = await newCtx();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  await prime(page);
  mode.bundle = MARKED_JS;
  const page2 = await ctx.newPage();
  const p = paintMs(page2);
  await page2.goto(base + '/').catch(() => {});
  const ms = await p;
  const nc = await page2.evaluate(() => window.__netCopy).catch(() => undefined);
  ok(ms > 0 && nc === 'net', 'L2b: a primed profile with a changed bundle on the server paints the FRESH bundle, not the cache', 'ms=' + ms + ' netCopy=' + nc);
  await ctx.close();
}

/* ---------------- L3: slow network (2) ---------------- */
{
  const ctx = await newCtx();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  await prime(page);
  mode = { bundle: MARKED_JS, sw: SW_FIXED, hangShell: false, delayApp: 2000, hangApi: false };
  const page2 = await ctx.newPage();
  const p = paintMs(page2);
  await page2.goto(base + '/').catch(() => {});
  const ms = await p;
  const nc = await page2.evaluate(() => window.__netCopy).catch(() => undefined);
  ok(nc === 'net' && ms >= 1800 && ms < 3400,
    'L3a: /app.js delayed 2,000 ms (inside the bound) — the network copy wins, paint \u2248 delay + pipeline', 'ms=' + ms + ' netCopy=' + nc);
  await ctx.close();
}
{
  const ctx = await newCtx();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  await prime(page);
  mode = { bundle: MARKED_JS, sw: SW_FIXED, hangShell: false, delayApp: 6000, hangApi: false };
  const page2 = await ctx.newPage();
  const t0 = Date.now();
  const p = paintMs(page2, 14000);
  await page2.goto(base + '/').catch(() => {});
  const ms = await p;
  const nc = await page2.evaluate(() => window.__netCopy).catch(() => undefined);
  const cachedPaint = ms > 0 && nc !== 'net' && ms >= 2800 && ms < 5000;
  while (Date.now() - t0 < 7800) await sleep(250);
  const cachedText = await page2.evaluate(async () => {
    const c = await caches.open('ora-pro-nobis-v425-1');
    const r = await c.match('/app.js');
    return r ? await r.text() : '';
  }).catch(() => '');
  mode.delayApp = 0;
  const page3 = await ctx.newPage();
  const p3 = paintMs(page3);
  await page3.goto(base + '/').catch(() => {});
  const ms3 = await p3;
  const nc3 = await page3.evaluate(() => window.__netCopy).catch(() => undefined);
  ok(cachedPaint && cachedText.includes('__netCopy') && ms3 > 0 && nc3 === 'net',
    'L3b: /app.js delayed 6,000 ms (past the bound) — the cache paints inside the bound, the late fetch lands its cache copy, and a re-open paints the fresh copy (background completion proven)',
    'ms=' + ms + ' netCopy=' + nc + ' cacheHasFresh=' + cachedText.includes('__netCopy') + ' reopenMs=' + ms3 + ' reopenNetCopy=' + nc3);
  await ctx.close();
}

/* ---------------- L4: incomplete boot + the heal (4) ---------------- */
let flagAfterHeal = 'unset';
{
  const ctx = await newCtx();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  await prime(page);
  await page.evaluate(async () => {
    const a = await caches.open('opn-ext-audio-v1');
    await a.put('/__seed__', new Response('audio-seed'));
    const m = await caches.open('opn-offline-meta-v1');
    await m.put('/__seed__', new Response('meta-seed'));
    const pin = await caches.open('ora-pro-nobis-v425-1');
    await pin.put('/__v429_marker__', new Response('stale-shell-marker'));
  });
  mode.bundle = DOCTORED_JS;
  const page2 = await ctx.newPage();
  await page2.goto(base + '/').catch(() => {});
  await sleep(1500);
  const st1 = await stamp(page);
  ok(st1.boot === 'started', 'L4a: a doctored bundle throwing before the tail stamp leaves opn-boot at started, never complete', JSON.stringify(st1));
  mode.bundle = PLAIN_JS;
  const page3 = await ctx.newPage();
  const navs = watchNavs(page3);
  await page3.goto(base + '/').catch(() => {});
  await page3.waitForFunction(() => localStorage.getItem('opn-boot') === 'complete' && navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 12000 }).catch(() => {});
  await sleep(800);
  ok(navs.n === 2, 'L4b: the next open performs exactly ONE extra navigation (the heal reload), no more', 'navs=' + navs.n);
  // the re-prime (install precache / fetch puts) settles
  // asynchronously around the heal's own deletes — poll the
  // end state instead of reading one instant
  let healed = { reg: 'unset' };
  for (let i = 0; i < 24; i++) {
    healed = await page3.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const pin = await caches.open('ora-pro-nobis-v425-1');
      const pinKeys = (await pin.keys()).map((r) => new URL(r.url).pathname);
      const a = await caches.open('opn-ext-audio-v1');
      const m = await caches.open('opn-offline-meta-v1');
      return {
        reg: !!reg && !!reg.active,
        pinHasApp: pinKeys.includes('/app.js'),
        pinHasMarker: pinKeys.includes('/__v429_marker__'),
        audioSeed: !!(await a.match('/__seed__')),
        metaSeed: !!(await m.match('/__seed__')),
      };
    }).catch(() => ({ reg: 'eval-fail' }));
    if (healed.reg === true && healed.pinHasApp === true) break;
    await sleep(250);
  }
  ok(healed.reg === true && healed.pinHasApp === true && healed.pinHasMarker === false && healed.audioSeed === true && healed.metaSeed === true,
    'L4c: the heal unregisters the SW and deletes the shell caches while the seeded opn-ext-audio-v1 + opn-offline-meta-v1 entries SURVIVE, and the healed boot re-registers + re-primes',
    JSON.stringify(healed));
  const st2 = await stamp(page3);
  flagAfterHeal = st2.healed;
  const viewLen = await page3.evaluate(() => document.getElementById('view').innerHTML.length).catch(() => -1);
  ok(st2.boot === 'complete' && st2.healed === null && viewLen > 0,
    'L4d: the healed open paints, the stamp ends complete, the healed flag stands cleared', JSON.stringify(st2) + ' viewLen=' + viewLen);
  await ctx.close();
}

/* ---------------- L5: never twice, never first install (3) ---------------- */
let flagAfterL5 = 'unset';
{
  const ctx = await newCtx();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  await prime(page);
  mode.bundle = DOCTORED_JS;
  const page2 = await ctx.newPage();
  await page2.goto(base + '/').catch(() => {});
  await sleep(1200);
  // the heal fires on this open, but the healed boot is doctored too
  const page3 = await ctx.newPage();
  const navs3 = watchNavs(page3);
  await page3.goto(base + '/').catch(() => {});
  await sleep(2500);
  const stMid = await stamp(page3);
  mode.bundle = PLAIN_JS;
  const page4 = await ctx.newPage();
  const navs4 = watchNavs(page4);
  await page4.goto(base + '/').catch(() => {});
  await page4.waitForFunction(() => localStorage.getItem('opn-boot') === 'complete', null, { timeout: 12000 }).catch(() => {});
  await sleep(600);
  const regStands = await page4.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg && !!reg.active;
  }).catch(() => false);
  const stEnd = await stamp(page4);
  flagAfterL5 = stEnd.healed;
  ok(navs3.n === 2 && stMid.boot === 'started' && stMid.healed === '1' && navs4.n === 1 && regStands && stEnd.boot === 'complete',
    'L5a: after a heal whose own boot also fails, the following open performs NO heal (plain navigation count; registrations stand)',
    'healNavs=' + navs3.n + ' mid=' + JSON.stringify(stMid) + ' nextNavs=' + navs4.n + ' reg=' + regStands + ' end=' + JSON.stringify(stEnd));
  await ctx.close();
}
{
  const ctx = await newCtx();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  const navs = watchNavs(page);
  await page.goto(base + '/').catch(() => {});
  await page.waitForFunction(() => localStorage.getItem('opn-boot') === 'complete', null, { timeout: 12000 }).catch(() => {});
  await sleep(500);
  const st = await stamp(page);
  ok(navs.n === 1 && st.boot === 'complete',
    'L5b: a fresh profile (no keys) performs no heal navigation and completes its stamp', 'navs=' + navs.n + ' ' + JSON.stringify(st));
  await ctx.close();
}
ok(flagAfterHeal === null && flagAfterL5 === null,
  'L5c: at rest after any completed boot, opn-boot-healed stands absent (re-armed)',
  'afterHeal=' + flagAfterHeal + ' afterL5=' + flagAfterL5);

/* ---------------- L6: /api/ stands (1) ---------------- */
{
  const ctx = await newCtx();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  await prime(page);
  mode.hangApi = true;
  const probe = await page.evaluate(async () => {
    window.__apiSettled = false;
    fetch('/api/player/day').then(() => { window.__apiSettled = 'resolved'; }, () => { window.__apiSettled = 'rejected'; });
    return true;
  }).catch(() => false);
  await sleep(4000);
  const settled = await page.evaluate(() => window.__apiSettled).catch(() => 'eval-fail');
  const apiCached = await page.evaluate(async () => {
    const names = await caches.keys();
    for (const n of names) {
      const c = await caches.open(n);
      const ks = (await c.keys()).map((r) => r.url);
      if (ks.some((u) => u.includes('/api/'))) return true;
    }
    return false;
  }).catch(() => 'eval-fail');
  mode.hangApi = false;
  ok(probe === true && settled === false && apiCached === false,
    'L6: a hung /api/ request is never answered from cache and creates no cache entry', 'settled=' + settled + ' apiCached=' + apiCached);
  await ctx.close();
}

/* ---------------- L7: the boot suite (2) ---------------- */
{
  const ctx = await newCtx();
  mode = { bundle: PLAIN_JS, sw: SW_FIXED, hangShell: false, delayApp: 0, hangApi: false };
  const page = await ctx.newPage();
  const errs = watchErrs(page);
  const navs = watchNavs(page);
  const p = paintMs(page);
  await page.goto(base + '/').catch(() => {});
  const ms1 = await p;
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {});
  await sleep(800);
  const navsBefore = navs.n;
  mode.sw = SW_429PIN;
  const pr = paintMs(page, 12000);
  await page.reload().catch(() => {});
  const ms2 = await pr;
  // the update cycle (install the v429-pin SW, precache, purge
  // the old pin cache) settles asynchronously after the reload
  let keys = [];
  for (let i = 0; i < 40; i++) {
    keys = await page.evaluate(() => caches.keys()).catch(() => []);
    if (keys.includes('ora-pro-nobis-v429-1') && !keys.includes('ora-pro-nobis-v425-1')) break;
    await sleep(300);
  }
  ok(ms1 > 0 && ms2 > 0 && navs.n - navsBefore === 1 && errs.length === 0
    && keys.includes('ora-pro-nobis-v429-1') && !keys.includes('ora-pro-nobis-v425-1'),
    'L7a: the boot suite on the fixed build — fresh boot, then the pin-flip reload (the v429 pin served over the primed v425 profile): exactly one navigation, paints, zero errors',
    'ms1=' + ms1 + ' ms2=' + ms2 + ' flipNavs=' + (navs.n - navsBefore) + ' errs=' + errs.length + ' keys=' + JSON.stringify(keys));
  const page2 = await ctx.newPage();
  const errs2 = watchErrs(page2);
  const p2 = paintMs(page2);
  await page2.goto(base + '/').catch(() => {});
  const ms3 = await p2;
  let alive = false;
  if (ms3 > 0) {
    const before = await page2.evaluate(() => document.getElementById('view').innerHTML.length);
    await page2.evaluate(() => document.querySelector('[data-tab="podcasts"]').click());
    await sleep(1500);
    const after = await page2.evaluate(() => document.getElementById('view').innerHTML.length);
    alive = after > 0 && after !== before;
  }
  ok(ms3 > 0 && alive && errs2.length === 0,
    'L7b: a cold open under the new pin paints with a live tab bar', 'ms=' + ms3 + ' alive=' + alive + ' errs=' + errs2.length);
  await ctx.close();
}

await browser.close();
server.close();
console.log('harness-v429: ' + pass + '/' + (pass + fail) + (failures.length ? ' — FAILURES: ' + failures.join(' ;; ') : ''));
process.exit(fail ? 1 : 0);
