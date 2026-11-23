// harness-v622.mjs — v622: ONE Touch ID preference for
//  every PIN gate + enrolment onboarding inside PIN setup.
//
//  THE DIRECTION (John, Ora thread, 2026-11-23 00:55 CT):
//  "touch id preference throughout the app and touch id
//  enrollment onboarding as part of setting pin. Conscience
//  still uses pin" — approved all the way to prod 00:56 CT.
//
//  THE NAMED DEFECT: renderPinGate (the Conscience tab
//  gate, the Settings entry gate, the refusal re-stand)
//  carried the PIN pad only — no biometric path at all,
//  while the vault unlock card and the Praylist gate had
//  theirs. And enrolment stood only in Settings, behind
//  four conditions, never offered by the PIN set flow.
//
//  THE FIX (client.ts only, web-only — every bridge call
//  is a standing v606 method):
//   - opnBioPref622: the one preference, stored on the
//     PIN record (readable while locked); absent = on.
//   - renderPinGate: under the preference + an enrolment,
//     the prompt fires FIRST on the gate's stand; success
//     applies the vault key and issues the session token;
//     failure names its code; the pad is the fallback.
//   - opnBindUnlockCard + opnBindLockGate609: the button
//     reveal, the auto-fire, and the enrolment note all
//     read the same preference.
//   - opnBioOffer622: the enrolment offer inside the PIN
//     set sheet and both recovery forms.
//   - fillPinSection: the switch itself.
//
//  Fixtures (Improvement D): John's own exported document
//  (john-personal-data-import-v589.json); the vault is
//  built over it by the client's own /api/pin/set route
//  (opnPinSet + opnVaultCreate — the path that created
//  his), and the bridge stub returns the REAL raw key the
//  client's own create produced, so a biometric unlock
//  decrypts his real document. ◆ legs fail on the base
//  tree (main = the v620 ship, pinned by ref name in T3's
//  pattern: appJsOld is read from `main` BEFORE the merge,
//  the standing harness-v596 recipe).
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
check('T1 the v622 seats stand: the preference helper, the offer, the gate button, the pref reads at the card + Praylist seats',
  clientSrc.includes('function opnBioPref622()')
  && clientSrc.includes('function opnBioOffer622(next)')
  && clientSrc.includes('id="pin-bio"')
  && clientSrc.includes('if (st && st.available && st.enrolled && opnBioPref622()) bio.style.display')
  && clientSrc.includes('if (!opnBioPref622()) return;')
  && clientSrc.includes("if (mode === 'set') opnBioOffer622(")
  && clientSrc.includes('id="pin-bio-pref"'));
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
// fail-on-old base pinned by hash: 3304308 = the v620
// ship (the tree this release branches from). `main`
// moves at this release's own merge, so the ref name
// cannot carry the base (the v620 harness lesson).
const appJsOld = renderAppJs(git(['show', '3304308feedcab3bd539956ec08d5fbef93d81e6:app/worker/src/client.ts']));
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
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const PIN_KEY = 'opn-pin-local-v1';
const PIN = '2468';
const HOOK = '\n;window.__opn = { gatedTabRender: gatedTabRender, renderPinGate: renderPinGate, openPinSetSheet: openPinSetSheet, fillPinSection: fillPinSection, paintMergedContainer: paintMergedContainer, opnLocalApi: opnLocalApi, opnMode: opnMode, opnVaultLocked: opnVaultLocked, opnPinTokenValid: opnPinTokenValid, opnBioPref622: (typeof opnBioPref622 !== "undefined" ? opnBioPref622 : null), opnRawKeyB64: function () { return opnVaultRawKey ? opnB64(opnVaultRawKey) : null; } };';
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(js, store, bridge) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  if (bridge) w.Capacitor = { Plugins: { OraDayBridge: bridge } };
  return w;
}
function bridgeStub(opts) {
  const calls = { unlock: 0, status: 0, enroll: 0, clear: 0 };
  const base = {
    vaultBiometricStatus: () => { calls.status++; return Promise.resolve(typeof opts.status === 'function' ? opts.status() : opts.status); },
    vaultBiometricUnlock: () => { calls.unlock++; return opts.unlock(); },
    vaultBiometricEnroll: () => { calls.enroll++; return opts.enroll ? opts.enroll() : Promise.resolve({}); },
    vaultBiometricClear: () => { calls.clear++; return Promise.resolve({}); },
  };
  const proxy = new Proxy(base, { get: (t, k) => { if (k === 'then') return undefined; return k in t ? t[k] : () => Promise.resolve({}); } });
  return { plugin: proxy, calls };
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function enterGatePin(w, pin) {
  for (const d of pin.split('')) click(w, w.document.querySelector('#pinpad [data-pinkey="' + d + '"]'));
}

// ---------- build his locked world through the client's own pin-set path ----------
let snap = null, rawKeyB64 = null;
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  await w.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: PIN }) }, 'device');
  const made = await until(() => { try { return JSON.parse(w.localStorage.getItem(DATA_KEY)).format === 'orapronobis-personal-data-encrypted'; } catch (e) { return false; } }, 10000);
  rawKeyB64 = w.__opn.opnRawKeyB64();
  check('B0 a real vault + PIN record stand over his document through the client\u2019s own set path', made && !!rawKeyB64 && !!w.localStorage.getItem(PIN_KEY));
  if (made) {
    snap = {};
    for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); snap[k] = w.localStorage.getItem(k); }
  }
  w.close();
}
const snapWith = (fn) => { const s = JSON.parse(JSON.stringify(snap)); if (fn) fn(s); return s; };
const prefOff = (s) => { const r = JSON.parse(s[PIN_KEY]); r.biometricPref = false; s[PIN_KEY] = JSON.stringify(r); };

// ---------- G1 ◆ Conscience gate: biometric FIRST under the preference ----------
if (snap) {
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.resolve({ keyB64: rawKeyB64 }) });
  const w = makeWorld(appJs, snapWith(), plugin);
  await sleep(400);
  let content = 0;
  w.__opn.gatedTabRender('conscience', () => { content++; });
  const fired = await until(() => calls.unlock >= 1, 8000);
  const through = await until(() => content >= 1, 8000);
  check('G1 \u25c6 Conscience gate: the biometric prompt fires FIRST (no PIN tap) and the gate opens — vault unlocked, token standing',
    fired && through && !w.__opn.opnVaultLocked() && w.__opn.opnPinTokenValid(),
    { fired, through, locked: w.__opn.opnVaultLocked(), token: w.__opn.opnPinTokenValid() });
  w.close();
}
// ---------- G1-old ◆ the same world on the base tree: PIN only ----------
if (snap) {
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.resolve({ keyB64: rawKeyB64 }) });
  const w = makeWorld(appJsOld, snapWith(), plugin);
  await sleep(400);
  let content = 0;
  w.__opn.gatedTabRender('conscience', () => { content++; });
  await until(() => !!w.document.getElementById('pin-unlock'), 8000);
  await sleep(1200);
  check('G1-old \u25c6 REPRODUCED on the base tree: no biometric act stands at the gate and no prompt fires (Conscience uses PIN only)',
    !w.document.getElementById('pin-bio') && calls.unlock === 0 && content === 0,
    { bio: !!w.document.getElementById('pin-bio'), unlockCalls: calls.unlock, content });
  w.close();
}
// ---------- G2 preference OFF: PIN only, and the PIN still opens ----------
if (snap) {
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.resolve({ keyB64: rawKeyB64 }) });
  const w = makeWorld(appJs, snapWith(prefOff), plugin);
  await sleep(400);
  let content = 0;
  w.__opn.gatedTabRender('conscience', () => { content++; });
  await until(() => !!w.document.getElementById('pin-unlock'), 8000);
  await sleep(1200);
  const bioHidden = !w.document.getElementById('pin-bio') || w.document.getElementById('pin-bio').style.display === 'none';
  check('G2 preference off: no prompt fires and no biometric act stands at the Conscience gate',
    calls.unlock === 0 && bioHidden && content === 0, { unlockCalls: calls.unlock, bioHidden, content });
  enterGatePin(w, PIN);
  await sleep(150);
  click(w, w.document.getElementById('pin-unlock'));
  const through = await until(() => content >= 1, 8000);
  check('G2b preference off: the PIN opens the gate exactly as before', through && w.__opn.opnPinTokenValid(), { through });
  w.close();
}
// ---------- G3 biometric failure: named, PIN fallback opens ----------
if (snap) {
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.reject(new Error('user-cancelled: 13')) });
  const w = makeWorld(appJs, snapWith(), plugin);
  await sleep(400);
  let content = 0;
  w.__opn.gatedTabRender('conscience', () => { content++; });
  const named = await until(() => { const m = w.document.getElementById('pinmsg'); return !!m && /did not complete/.test(m.textContent) && /13/.test(m.textContent); }, 8000);
  check('G3 \u25c6 a dismissed prompt is NAMED in the gate message (code surfaces) and the gate stays on the pad',
    named && content === 0 && !!w.document.getElementById('pin-unlock'), named ? w.document.getElementById('pinmsg').textContent : null);
  enterGatePin(w, PIN);
  await sleep(150);
  click(w, w.document.getElementById('pin-unlock'));
  const through = await until(() => content >= 1, 8000);
  check('G3b after the failure the PIN fallback opens the gate', through, { through });
  w.close();
}
// ---------- G4 key-invalidated: wrap cleared, re-enrol seat named ----------
if (snap) {
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.reject(new Error('key-invalidated')) });
  const w = makeWorld(appJs, snapWith(), plugin);
  await sleep(400);
  let content = 0;
  w.__opn.gatedTabRender('conscience', () => { content++; });
  const named = await until(() => { const m = w.document.getElementById('pinmsg'); return !!m && /CONFESSION PIN/.test(m.textContent); }, 8000);
  const bioGone = !w.document.getElementById('pin-bio') || w.document.getElementById('pin-bio').style.display === 'none';
  check('G4 \u25c6 key-invalidated: the stale wrap is cleared, the act retires, and the message names the re-enrol seat',
    named && calls.clear >= 1 && bioGone && content === 0,
    { named, clear: calls.clear, bioGone });
  w.close();
}
// ---------- U1 unlock card (the profVaultGate594 seam): the preference governs the button ----------
if (snap) {
  const mk = async (store) => {
    // the unlock REJECTS (a dismissed prompt): the card
    // stands after the failed auto-fire, so the button's
    // standing can be read without racing the repaint an
    // unlock would drive.
    const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.reject(new Error('user-cancelled: 13')) });
    const w = makeWorld(appJs, store, plugin);
    await sleep(400);
    w.__opn.paintMergedContainer('prayers'); // the Praylist lock gate binds the standing unlock card
    await until(() => !!w.document.getElementById('opn-unlock-bio'), 8000);
    await sleep(1200);
    return { w, calls };
  };
  const on = await mk(snapWith());
  const onShown = on.w.document.getElementById('opn-unlock-bio').style.display !== 'none';
  check('U1 preference on (default): the unlock card stands its biometric act', onShown, { display: on.w.document.getElementById('opn-unlock-bio').style.display });
  on.w.close();
  const off = await mk(snapWith(prefOff));
  const offShown = off.w.document.getElementById('opn-unlock-bio').style.display !== 'none';
  check('U1b \u25c6 preference off: the unlock card\u2019s biometric act never stands (PIN only)',
    !offShown && off.calls.unlock === 0, { display: off.w.document.getElementById('opn-unlock-bio').style.display, unlockCalls: off.calls.unlock });
  off.w.close();
}
// ---------- P1 Praylist auto-fire reads the preference ----------
if (snap) {
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.resolve({ keyB64: rawKeyB64 }) });
  const w = makeWorld(appJs, snapWith(prefOff), plugin);
  await sleep(400);
  w.__opn.paintMergedContainer('prayers');
  await until(() => !!w.document.querySelector('[data-p609lock]'), 8000);
  await sleep(1500);
  const note = w.document.querySelector('[data-p609locknote]');
  check('P1 \u25c6 preference off: the Praylist visit does NOT auto-fire and the enrolment note stays down',
    calls.unlock === 0 && (!note || note.style.display === 'none'), { unlockCalls: calls.unlock });
  w.close();
  const on = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.resolve({ keyB64: rawKeyB64 }) });
  const w2 = makeWorld(appJs, snapWith(), on.plugin);
  await sleep(400);
  w2.__opn.paintMergedContainer('prayers');
  const fired = await until(() => on.calls.unlock >= 1, 8000);
  check('P1b preference on (default): the Praylist auto-fire stands as v609 left it', fired, { unlockCalls: on.calls.unlock });
  w2.close();
}
// ---------- S1 enrolment onboarding inside PIN setup ----------
{
  let enrolledNow = false;
  const { plugin, calls } = bridgeStub({
    status: () => ({ available: true, enrolled: enrolledNow }),
    unlock: () => Promise.reject(new Error('no enrolment')),
    enroll: () => { enrolledNow = true; return Promise.resolve({}); },
  });
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin);
  await sleep(400);
  w.__opn.openPinSetSheet('set');
  await sleep(300);
  const d = w.document;
  const type = (prefix, pin) => { for (const dg of pin.split('')) click(w, d.querySelector('#' + prefix + '-pad [data-pinkey="' + dg + '"]')); };
  type('ps1', PIN); type('ps2', PIN);
  await sleep(150);
  click(w, d.getElementById('ps-save'));
  const recStood = await until(() => !!d.getElementById('rec-done'), 10000);
  check('S1 the set flow stands: PIN set, the recovery code shows (the standing order)', recStood, { recStood });
  click(w, d.getElementById('rec-done'));
  const offerStood = await until(() => !!d.querySelector('.biooffer622'), 8000);
  check('S1b \u25c6 after the recovery showing, the flow itself OFFERS fingerprint enrolment (no Settings trip)',
    offerStood && !!d.getElementById('biooffer-go') && !!d.getElementById('biooffer-skip'), { offerStood });
  click(w, d.getElementById('biooffer-go'));
  const enrolled = await until(() => calls.enroll >= 1, 8000);
  await sleep(400);
  const rec = JSON.parse(w.localStorage.getItem(PIN_KEY) || '{}');
  check('S1c \u25c6 accepting enrols through the standing machinery and the PIN record carries the enrolment flag',
    enrolled && rec.biometricEnrolled === true && !d.querySelector('.biooffer622'), { enrollCalls: calls.enroll, flag: rec.biometricEnrolled });
  w.close();
}
// ---------- S2 skipping the offer leaves PIN-only whole ----------
{
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: false }, unlock: () => Promise.reject(new Error('no enrolment')) });
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin);
  await sleep(400);
  w.__opn.openPinSetSheet('set');
  await sleep(300);
  const d = w.document;
  const type = (prefix, pin) => { for (const dg of pin.split('')) click(w, d.querySelector('#' + prefix + '-pad [data-pinkey="' + dg + '"]')); };
  type('ps1', PIN); type('ps2', PIN);
  await sleep(150);
  click(w, d.getElementById('ps-save'));
  await until(() => !!d.getElementById('rec-done'), 10000);
  click(w, d.getElementById('rec-done'));
  await until(() => !!d.querySelector('.biooffer622'), 8000);
  click(w, d.getElementById('biooffer-skip'));
  await sleep(500);
  // PIN-only whole: a fresh gated visit opens by PIN
  let content = 0;
  w.__opn.gatedTabRender('conscience', () => { content++; });
  await until(() => !!w.document.getElementById('pin-unlock'), 8000);
  enterGatePin(w, PIN);
  await sleep(150);
  click(w, w.document.getElementById('pin-unlock'));
  const through = await until(() => content >= 1, 8000);
  check('S2 \u25c6 skipping the offer enrols nothing and PIN-only works whole', calls.enroll === 0 && through, { enrollCalls: calls.enroll, through });
  w.close();
}
// ---------- S3 no offer when already enrolled ----------
{
  const { plugin, calls } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.reject(new Error('unused')) });
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) }, plugin);
  await sleep(400);
  w.__opn.openPinSetSheet('set');
  await sleep(300);
  const d = w.document;
  const type = (prefix, pin) => { for (const dg of pin.split('')) click(w, d.querySelector('#' + prefix + '-pad [data-pinkey="' + dg + '"]')); };
  type('ps1', PIN); type('ps2', PIN);
  await sleep(150);
  click(w, d.getElementById('ps-save'));
  await until(() => !!d.getElementById('rec-done'), 10000);
  click(w, d.getElementById('rec-done'));
  await sleep(1200);
  check('S3 already enrolled: the set flow makes no offer', !d.querySelector('.biooffer622') && calls.enroll === 0, { offer: !!d.querySelector('.biooffer622') });
  w.close();
}
// ---------- W1 the Settings switch flips the one preference ----------
if (snap) {
  const { plugin } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.resolve({ keyB64: rawKeyB64 }) });
  const w = makeWorld(appJs, snapWith(), plugin);
  await sleep(400);
  const host = w.document.createElement('div');
  host.id = 'pin-section';
  w.document.body.appendChild(host);
  w.__opn.fillPinSection();
  const stood = await until(() => !!w.document.getElementById('pin-bio-pref'), 8000);
  const readsOn = stood && /Turn off/.test(w.document.getElementById('pin-bio-pref').textContent) && w.__opn.opnBioPref622() === true;
  check('W1 the Settings switch stands and reads ON by default (his standing state)', stood && readsOn, { stood, readsOn });
  click(w, w.document.getElementById('pin-bio-pref'));
  const flipped = await until(() => { const r = JSON.parse(w.localStorage.getItem(PIN_KEY) || '{}'); return r.biometricPref === false; }, 8000);
  await until(() => { const b = w.document.getElementById('pin-bio-pref'); return !!b && /Turn on/.test(b.textContent); }, 8000);
  check('W1b \u25c6 the switch writes the one preference on the PIN record and every reader sees it off',
    flipped && w.__opn.opnBioPref622() === false, { flipped, pref: w.__opn.opnBioPref622() });
  w.close();
}

console.log('harness-v622:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
