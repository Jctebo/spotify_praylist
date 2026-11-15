// harness-v439 — the client boot gate (v439 release document
// §1 Diagnosis + §2: the leg whose absence let v435 ship a
// client that never parses). The defect class: APP_JS is one
// template literal; a backslash pattern inside it (v435's
// isOwnLogoUrl regex, raw `\/`) is eaten by template cooking,
// so the SERVED /app.js carries a SyntaxError and the whole
// client script dies at load — static shell chrome paints,
// no boot, no fetch, no listeners. Every earlier mold missed
// it because they test extracted pieces of the RAW source
// (where the line is valid JS); no gate parsed the cooked
// script whole. This harness works on the COOKED script —
// the exact string index.ts serves at /app.js:
//   P1  the whole cooked APP_JS parses (vm.Script)
//   P2  the v435 defect line stands in its backslash-free
//       spelling in the cooked script; no derailment stands
//   A   isOwnLogoUrl / realArtUrl semantics, evaluated from
//       the COOKED script (v435's art rule, unchanged)
//   B   the boot itself, in headless Chromium: the real
//       SHELL_HTML + APP_CSS + the whole cooked APP_JS and a
//       fixture day — no pageerror, the opn-boot stamp reads
//       complete, the day fetch fires, the Prayers home
//       paints, the gear opens Settings
//   S   (note, not a leg) a census of the corruption class:
//       single-backslash non-escape sequences in the raw
//       APP_JS region — each is a place cooking silently
//       rewrites the served script. Printed with raw line
//       numbers for human ruling; the sites that stand
//       after the v439 fix are named findings in §3, not
//       hidden and not this release's legs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}

/* ---------------- the cooked APP_JS (the served string) ---------------- */
const TPL_A = C_SRC.indexOf('APP_JS = `') + 10;
const TPL_B = C_SRC.indexOf('`;', TPL_A);
const RAW_JS = C_SRC.slice(TPL_A, TPL_B);
let COOKED = null, cookErr = null;
try { COOKED = new Function('return `' + RAW_JS + '`')(); } catch (e) { cookErr = e; }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

/* ---------------- P: whole-script parse ---------------- */
{
  ok(!cookErr, 'P0: the APP_JS template evaluates (cooks) without error', cookErr && cookErr.message);
  let parseErr = null;
  if (COOKED != null) { try { new vm.Script(COOKED); } catch (e) { parseErr = e; } }
  ok(COOKED != null && !parseErr, 'P1: the whole cooked APP_JS parses (vm.Script) — the gate v435 lacked', parseErr && (parseErr.message + ' @ cooked line ' + (parseErr.stack.match(/<anonymous>:(\d+)/) || [])[1]));
  ok(COOKED != null && COOKED.includes('[/][/]') && !COOKED.includes(')?///'),
    'P2: isOwnLogoUrl stands in the cooked script in its backslash-free spelling; the v435 derailment is gone');
}

/* ---------------- A: art semantics from the cooked script ---------------- */
{
  let fn = null, aErr = null;
  if (COOKED != null) {
    try {
      const segTxt = COOKED.slice(COOKED.indexOf('function isOwnLogoUrl'), COOKED.indexOf('function npArtRender'));
      fn = new Function(segTxt + '; return { isOwnLogoUrl: isOwnLogoUrl, realArtUrl: realArtUrl };')();
    } catch (e) { aErr = e; }
  }
  ok(!!fn, 'A0: isOwnLogoUrl + realArtUrl evaluate out of the cooked script', aErr && aErr.message);
  if (fn) {
    const LOGO = 'jctebo.github.io/spotify_praylist/images/logo_ora_pro_nobis.png';
    ok(fn.isOwnLogoUrl('https://' + LOGO) === true, 'A1: the own-feed logo (https, lowercase host) reads as own');
    ok(fn.isOwnLogoUrl('https://JCTEBO.github.io/spotify_praylist/images/logo_ora_pro_nobis.png') === true, 'A2: the own-feed logo (capital host) reads as own');
    ok(fn.isOwnLogoUrl('//' + LOGO) === true, 'A3: the own-feed logo (protocol-relative) reads as own');
    ok(fn.isOwnLogoUrl('/logo.png') === true && fn.isOwnLogoUrl('') === false && fn.isOwnLogoUrl(null) === false, 'A4: /logo.png reads as own; empty and null do not');
    ok(fn.isOwnLogoUrl('https://example.com/art.png') === false, 'A5: outside art does not read as own');
    ok(fn.realArtUrl({ imageUrl: 'https://' + LOGO }) === null && fn.realArtUrl({ imageUrl: 'https://example.com/art.png' }) === 'https://example.com/art.png' && fn.realArtUrl({}) === null,
      'A6: realArtUrl — own logo yields null (the logo branch), real art passes through, no art yields null');
  }
}

/* ---------------- S: corruption-class census (note) ---------------- */
{
  const sites = [];
  let line = 1 + C_SRC.slice(0, TPL_A).split('\n').length - 1;
  const VALID = new Set(['\'', '"', '`', '$', '\\', 'b', 'f', 'n', 'r', 't', 'v', '0', '\n']);
  for (let i = 0; i < RAW_JS.length; i++) {
    const ch = RAW_JS[i];
    if (ch === '\n') { line++; continue; }
    if (ch !== '\\') continue;
    const nx = RAW_JS[i + 1];
    if (nx === undefined) break;
    if (nx === '\\') { i++; continue; }
    if (nx === 'u' && (/^[0-9a-fA-F]{4}$/.test(RAW_JS.slice(i + 2, i + 6)) || RAW_JS[i + 2] === '{')) { i += 5; continue; }
    if (nx === 'x' && /^[0-9a-fA-F]{2}$/.test(RAW_JS.slice(i + 2, i + 4))) { i += 3; continue; }
    if (VALID.has(nx)) { i++; continue; }
    const ls = RAW_JS.lastIndexOf('\n', i) + 1;
    let le = RAW_JS.indexOf('\n', i); if (le < 0) le = RAW_JS.length;
    sites.push('raw client.ts:' + line + '  \\' + nx + '  ' + RAW_JS.slice(ls, le).trim().slice(0, 110));
    i++;
  }
  console.log('note - S census: single-backslash non-escape sequences inside APP_JS (cooking rewrites each): ' + sites.length);
  for (const s of sites) console.log('note -   ' + s);
}

/* ---------------- B: the boot, whole script, Chromium ---------------- */
const DAY = {
  ok: true, date: '2026-11-15', presentedDay: '2026-11-15',
  dateLabel: 'Sunday, November 15, 2026',
  liturgicalDay: { name: '33rd Sunday in Ordinary Time', color: 'green' },
  introTexts: {},
  blocks: [{ block: 'Morning', label: 'Morning', tracks: [
    { episodeId: 9001, title: 'Invitatory', durationS: 240 },
    { episodeId: 9002, title: 'Morning Prayer', durationS: 720 },
  ] }],
  episodes: [],
};
{
  if (COOKED == null) {
    ok(false, 'B1: boot — skipped, the template did not cook');
  } else {
    const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${APP_CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  window.__fetchLog.push(String(path));
  if (String(path).indexOf('/api/player/day') === 0) {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(DAY)}); } });
  }
  if (String(path).indexOf('/api/player/feed-audio') === 0) {
    return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  }
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
</` + `script>
<script>
${COOKED}
</` + `script>
</body></html>`;
    const server = http.createServer((req, res) => {
      if ((req.url || '/').split('?')[0] === '/') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
      res.statusCode = 404; res.end('not found');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const ORIGIN = 'http://127.0.0.1:' + server.address().port;
    const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
    const { chromium } = requirePw('playwright-core');
    const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(ORIGIN + '/');
    await sleep(2500);
    const boot = await page.evaluate(() => {
      let stamp = null; try { stamp = localStorage.getItem('opn-boot'); } catch (e) {}
      const view = document.getElementById('view');
      return { stamp, fetchLog: window.__fetchLog || [], viewLen: view ? view.innerHTML.length : -1,
               viewText: view ? view.textContent.slice(0, 200) : '' };
    });
    ok(pageErrors.length === 0, 'B1: boot — no pageerror on load', pageErrors.join(' | '));
    ok(boot.stamp === 'complete', 'B2: boot — the opn-boot stamp reads complete (the synchronous tail ran)', 'stamp=' + boot.stamp);
    ok(boot.fetchLog.some((p) => p.indexOf('/api/player/day') === 0), 'B3: boot — the day fetch fires', boot.fetchLog.join(', '));
    ok(boot.viewLen > 500, 'B4: boot — the Prayers home paints content into #view', 'viewLen=' + boot.viewLen);
    let gearOk = false, gearErr = null;
    try {
      await page.click('#gearbtn', { timeout: 3000 });
      await sleep(600);
      gearOk = await page.evaluate(() => {
        const view = document.getElementById('view');
        return !!document.querySelector('#view .sheet, #view [data-sheet], body .sheet') ||
          (view && view.textContent.includes('Settings'));
      });
    } catch (e) { gearErr = e; }
    ok(gearOk, 'B5: boot — the gear responds and Settings paints', gearErr && gearErr.message);
    await browser.close();
    server.close();
  }
}

console.log('\nharness-v439: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
