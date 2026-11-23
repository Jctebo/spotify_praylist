// harness-v623.mjs — v623: the web "Set a PIN" dead end.
//
//  THE DEFECT (live first-visit web test, 2026-11-23
//  07:16–07:20 CT, production pin ora-pro-nobis-v622-1,
//  fresh browser profile): Settings offered "Set a PIN";
//  the sheet opened, the test PIN was entered in both
//  pads, and the Set PIN button did nothing across five
//  clicks — no confirmation, no recovery code; after a
//  reload Settings still read "No PIN is set."
//
//  THE DIAGNOSIS (code-grounded): three shapes exist
//  (v567/v578) — the native shell, the installed PWA
//  (standalone display: a device), and the plain browser
//  tab (no personal data; personal surfaces POINT to the
//  app — the Conscience pattern, opnPointerHtml). The
//  Settings PIN section never read the mode: in a tab,
//  fetchPinState answers from opnPinLoad(), which hard-
//  returns null on web, so the section always read "No
//  PIN is set" and always offered the live set button;
//  the sheet's save posts /api/pin/set, which the local
//  layer's web-write refusal (opnLocalApi) rejects with
//  403 before the PIN route is reached. The set can
//  never complete in a tab — the flow is a dead end by
//  construction. In the device shapes (shell + standalone
//  PWA) the same path is the standing, working set flow.
//
//  THE FIX (client.ts only, two seams at the one door):
//   - fillPinSection: on web, the CONFESSION PIN section
//     stands as the pointer card — no Set/Change/Enter
//     button is painted in a tab.
//   - openPinSetSheet (the ONE door to the flow, three
//     call sites): on web the sheet stands as the pointer
//     — the named refusal — with no pads and no save.
//  Device shapes are byte-untouched on this path.
//
//  Worlds (the client's REAL mode detection, driven as
//  the shapes drive it): TAB = no shell bridge, no
//  standalone signal -> opnMode() 'web'. PWA = the
//  standalone signal stands (navigator.standalone, the
//  iOS form; and matchMedia display-mode: standalone,
//  the Chrome form), no bridge -> 'device'. NATIVE =
//  the Capacitor bridge stands -> 'device'.
//  ◆ legs fail on the base tree (3b6d317, the v622 ship,
//  pinned by hash — `main` moves at this release's own
//  merge).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---------- T statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
check('T1 the v623 seats stand: the section pointer branch + the sheet pointer guard',
  clientSrc.includes("if (opnMode() === 'web') {\n      host2.innerHTML = html + opnPointerHtml();")
  && clientSrc.includes("sheet.innerHTML = '<div class=\"inner\"><div class=\"row\"><h1 class=\"screen grow\">' + (mode === 'set' ? 'Set a PIN' : 'Change PIN') + '</h1></div>' + opnPointerHtml() + '</div>';"));
const bridgeMethods = [...new Set([...clientSrc.matchAll(/vaultBiometric[A-Za-z]+/g)].map((m) => m[0]))].sort();
check('T2 no new bridge method: the client calls exactly the standing v606 four',
  JSON.stringify(bridgeMethods) === JSON.stringify(['vaultBiometricClear', 'vaultBiometricEnroll', 'vaultBiometricStatus', 'vaultBiometricUnlock']),
  bridgeMethods);
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T3 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
function renderAppJs(src) {
  const tplStart = src.indexOf('= `') + 3;
  const tplEnd = src.indexOf('\n`;', tplStart);
  if (tplStart < 3 || tplEnd < 0) throw new Error('APP_JS template markers');
  return vm.runInContext('`' + src.slice(tplStart, tplEnd) + '`', vm.createContext({}));
}
const appJs = renderAppJs(clientSrc);
const appJsOld = renderAppJs(git(['show', '3b6d3176489c545fdbf534391daaecd495c859dc:app/worker/src/client.ts']));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T4 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- worlds ----------
let JSDOM, webcrypto;
try {
  ({ JSDOM } = await import('jsdom'));
  ({ webcrypto } = await import('node:crypto'));
} catch (e) {
  check('R0 jsdom available', false, e.message);
  console.log(ok + ' ok, ' + bad + ' not ok');
  process.exit(1);
}
const DATA_KEY = 'opn-personal-data-v1';
const PIN_KEY = 'opn-pin-local-v1';
const TEST_PIN = '246810';
const HOOK = '\n;window.__opn = { opnMode: opnMode, opnInstalledPwa: opnInstalledPwa, opnLocalApi: opnLocalApi, fillPinSection: fillPinSection, openPinSetSheet: openPinSetSheet, gatedTabRender: gatedTabRender, opnPinTokenValid: opnPinTokenValid, opnVaultLocked: opnVaultLocked };';
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub() { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') }); }
// shape: 'tab' | 'pwa-ios' | 'pwa-mm' | 'native'
function makeWorld(js, store, shape, bridge) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  if (shape === 'pwa-ios') { try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {} }
  w.matchMedia = (q) => ({ matches: shape === 'pwa-mm' && /display-mode:\s*standalone/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  if (bridge) w.Capacitor = { Plugins: { OraDayBridge: bridge } };
  return w;
}
function bridgeStub() {
  const base = {
    vaultBiometricStatus: () => Promise.resolve({ available: true, enrolled: true }),
    vaultBiometricUnlock: () => Promise.reject(new Error('not-used-in-v623')),
    vaultBiometricEnroll: () => Promise.resolve({}),
    vaultBiometricClear: () => Promise.resolve({}),
  };
  return new Proxy(base, { get: (t, k) => { if (k === 'then') return undefined; return k in t ? t[k] : () => Promise.resolve({}); } });
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function enterPad(w, prefix, pin) {
  for (const d of pin.split('')) click(w, w.document.querySelector('#' + prefix + '-pad [data-pinkey="' + d + '"]'));
}
function pinHost(w) {
  // the Settings view paints this host in the real tab
  // flow; the harness stands it directly (the v622 recipe).
  if (!w.document.getElementById('pin-section')) {
    const host = w.document.createElement('div');
    host.id = 'pin-section';
    w.document.body.appendChild(host);
  }
}
function snapOf(w) {
  const s = {};
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); s[k] = w.localStorage.getItem(k); }
  return s;
}
// Drive the standing UI set flow: Settings section ->
// sheet -> both pads -> save -> the recovery sheet.
async function uiSetFlow(w) {
  pinHost(w);
  w.__opn.fillPinSection();
  const offered = await until(() => !!w.document.getElementById('pin-set-open'), 8000);
  if (!offered) return { offered: false };
  click(w, w.document.getElementById('pin-set-open'));
  const sheetUp = await until(() => !!w.document.getElementById('ps-save'), 8000);
  if (!sheetUp) return { offered: true, sheetUp: false };
  enterPad(w, 'ps1', TEST_PIN);
  enterPad(w, 'ps2', TEST_PIN);
  click(w, w.document.getElementById('ps-save'));
  const recovered = await until(() => !!w.document.querySelector('.recoverysheet'), 12000);
  return { offered: true, sheetUp: true, recovered };
}

// ---------- W-old ◆ the tab dead end, reproduced on the base tree ----------
{
  const w = makeWorld(appJsOld, {}, 'tab');
  await sleep(400);
  check('W-old mode: the base tree reads the tab shape as web', w.__opn.opnMode() === 'web', w.__opn.opnMode());
  const r = await uiSetFlow(w);
  await sleep(600);
  const msgEl = w.document.getElementById('ps-msg');
  const st = await w.__opn.opnLocalApi('/api/pin/state', { method: 'GET' }, 'web').catch(() => null);
  check('W-old ◆ REPRODUCED on the base tree: the tab is offered a live set flow and it dead-ends — no recovery sheet, no PIN record, state still reads not-set',
    r.offered === true && r.sheetUp === true && !r.recovered && !w.localStorage.getItem(PIN_KEY) && !!st && st.pinSet === false,
    { flow: r, msg: msgEl ? msgEl.textContent : null, pinKey: !!w.localStorage.getItem(PIN_KEY), st });
  w.close();
}

// ---------- W1 the tab now points: no live PIN button stands ----------
{
  const w = makeWorld(appJs, {}, 'tab');
  await sleep(400);
  check('W1 mode: the tab shape reads web', w.__opn.opnMode() === 'web', w.__opn.opnMode());
  pinHost(w);
  w.__opn.fillPinSection();
  const pointed = await until(() => { const h = w.document.getElementById('pin-section'); return !!h && !!h.querySelector('.opn-pointer'); }, 8000);
  const h = w.document.getElementById('pin-section');
  check('W1 the CONFESSION PIN section stands as the pointer card in a tab — no Set / Change / Enter button is painted',
    pointed && !w.document.getElementById('pin-set-open') && !w.document.getElementById('pin-change-open') && !w.document.getElementById('pin-enter-open'),
    h ? h.innerHTML.slice(0, 300) : null);
  w.close();
}

// ---------- W2 the sheet door itself refuses by name in a tab ----------
{
  const w = makeWorld(appJs, {}, 'tab');
  await sleep(400);
  w.__opn.openPinSetSheet('set');
  await sleep(300);
  const sheet = w.document.querySelector('.pinsetsheet');
  check('W2 ◆ openPinSetSheet in a tab stands as the pointer — no pads, no save button (fail-on-old: the base sheet paints both)',
    !!sheet && !!sheet.querySelector('.opn-pointer') && !w.document.getElementById('ps-save') && !w.document.getElementById('ps1-pad'),
    sheet ? sheet.innerHTML.slice(0, 300) : null);
  w.close();
}

// ---------- P0/P1 the installed PWA (iOS standalone form): the set completes ----------
let pwaSnap = null;
{
  const w = makeWorld(appJs, {}, 'pwa-ios');
  await sleep(400);
  check('P0 the installed PWA (navigator.standalone) counts as a device', w.__opn.opnInstalledPwa() === true && w.__opn.opnMode() === 'device', { mode: w.__opn.opnMode() });
  const r = await uiSetFlow(w);
  const codeEl = w.document.getElementById('rec-code-text');
  const env = (() => { try { return JSON.parse(w.localStorage.getItem(DATA_KEY)); } catch (e) { return null; } })();
  check('P1 the PWA set flow completes end to end: recovery code shown once, PIN record stored, the vault envelope stands',
    r.offered === true && r.recovered === true && !!codeEl && codeEl.textContent.trim().length >= 8 && !!w.localStorage.getItem(PIN_KEY) && !!env && env.format === 'orapronobis-personal-data-encrypted',
    { flow: r, code: codeEl ? codeEl.textContent : null, pinKey: !!w.localStorage.getItem(PIN_KEY), envFormat: env && env.format });
  if (r.recovered) { click(w, w.document.getElementById('rec-done')); await sleep(400); pwaSnap = snapOf(w); }
  w.close();
}

// ---------- P2 the PWA set persists: a fresh session gates and the PIN opens it ----------
if (pwaSnap) {
  const w = makeWorld(appJs, pwaSnap, 'pwa-ios');
  await sleep(400);
  const st = await w.__opn.opnLocalApi('/api/pin/state', { method: 'GET' }, 'device');
  pinHost(w);
  w.__opn.fillPinSection();
  const enterOffered = await until(() => !!w.document.getElementById('pin-enter-open'), 8000);
  check('P2 the PWA PIN persists across sessions: state reads set and Settings offers Enter PIN (not a fresh set) in a new world',
    !!st && st.pinSet === true && enterOffered,
    { st, enterOffered });
  w.close();
} else {
  check('P2 the PWA PIN persists across sessions', false, 'no snapshot from P1');
}
// ---------- P2b the gate opens with the PWA-set PIN ----------
if (pwaSnap) {
  const w = makeWorld(appJs, pwaSnap, 'pwa-ios');
  await sleep(400);
  let content = 0;
  w.__opn.gatedTabRender('conscience', () => { content++; });
  const gateUp = await until(() => !!w.document.getElementById('pin-unlock'), 8000);
  if (gateUp) {
    for (const d of TEST_PIN.split('')) click(w, w.document.querySelector('#pinpad [data-pinkey="' + d + '"]'));
    await sleep(150);
    click(w, w.document.getElementById('pin-unlock'));
  }
  const through = await until(() => content >= 1, 10000);
  check('P2b the Conscience gate opens with the PIN set in the PWA shape — token standing, vault unlocked',
    gateUp && through && w.__opn.opnPinTokenValid() && !w.__opn.opnVaultLocked(),
    { gateUp, through, token: w.__opn.opnPinTokenValid(), locked: w.__opn.opnVaultLocked() });
  w.close();
}

// ---------- P3 the installed PWA (Chrome display-mode form): detection + set ----------
{
  const w = makeWorld(appJs, {}, 'pwa-mm');
  await sleep(400);
  const det = w.__opn.opnInstalledPwa() === true && w.__opn.opnMode() === 'device';
  const res = await w.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: TEST_PIN }) }, w.__opn.opnMode()).catch((e) => ({ err: e.message }));
  const st = await w.__opn.opnLocalApi('/api/pin/state', { method: 'GET' }, 'device').catch(() => null);
  check('P3 the Chrome standalone form reads as a device and the set route completes (recovery code + stored record)',
    det && !!res && typeof res.recoveryCode === 'string' && !!w.localStorage.getItem(PIN_KEY) && !!st && st.pinSet === true,
    { det, res: res && (res.err || 'ok'), st });
  w.close();
}

// ---------- N1 the native shell shape: the set flow is unchanged ----------
{
  const w = makeWorld(appJs, {}, 'native', bridgeStub());
  await sleep(400);
  check('N1 mode: the shell shape reads device', w.__opn.opnMode() === 'device', w.__opn.opnMode());
  const r = await uiSetFlow(w);
  const env = (() => { try { return JSON.parse(w.localStorage.getItem(DATA_KEY)); } catch (e) { return null; } })();
  check('N1 the native set flow completes exactly as before: recovery sheet, PIN record, vault envelope',
    r.offered === true && r.recovered === true && !!w.localStorage.getItem(PIN_KEY) && !!env && env.format === 'orapronobis-personal-data-encrypted',
    { flow: r, pinKey: !!w.localStorage.getItem(PIN_KEY), envFormat: env && env.format });
  w.close();
}

console.log(ok + ' ok, ' + bad + ' not ok');
process.exit(bad ? 1 : 0);
