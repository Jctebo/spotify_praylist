// harness-v594.mjs — v594 chip tap fix (the locked-vault
// gate on the Configure surfaces).
//
// THE DEFECT (proven by reproduction before the fix): in the
// device shape with the v578 vault LOCKED (a fresh session —
// the Configure path carries no unlock step), the local layer
// serves the ephemeral default document on reads and refuses
// every personal WRITE with 423 vault_locked. v593's chip tap
// is a write (the day-pick): it never landed, and its only
// trace was the raw 'vault_locked' string on the note line at
// the scroll's bottom — the tap read as dead. harness-v593
// passed because its legs were source statics + opnLocalApi
// driven directly in a vm world seeded with a PLAIN document
// (no envelope -> never locked) and no DOM at all.
//
// THE FIX: profVaultGate594 stands the standing unlock card
// (v587) in the body of openProfilesScreen and
// openDayMappingScreen593 while the device vault is locked;
// the surface loads only once unlocked.
//
//  R  REAL-DOM legs (jsdom; run: npm i --no-save jsdom):
//     the rendered client boots in a device world; a REAL
//     vault envelope is created through the client's own
//     opnVaultCreate over John's document; a fresh world over
//     that envelope is his cold-start session. The legs drive
//     the painted DOM: gate stands -> PIN pad unlock -> the
//     painted chip is clicked (button + child-span targets)
//     -> the switch lands. R1 FAILS on the pre-fix tree.
//  T  statics: the gate + both call sites · the rendered
//     client parses whole · SW pin unmoved pre-Ship.
// Fixtures from production only (Improvement D): John's
// import file (his profiles document).
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
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });

// ---------- T statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
check('T1 the vault gate stands in the client and both Configure surfaces call it before loading',
  clientSrc.includes('function profVaultGate594(bodyEl, proceed, onClose)')
  && clientSrc.includes("if (!profVaultGate594(body, startLoad,")
  && clientSrc.includes('if (!profVaultGate594(body, loadMap, closeScreen)) loadMap();')
  && clientSrc.includes('opnUnlockCardHtml()')
  && clientSrc.includes('opnBindUnlockCard(proceed)'));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T2 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T3 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- R: real-DOM legs ----------
let JSDOM, webcrypto;
try {
  ({ JSDOM } = await import('jsdom'));
  ({ webcrypto } = await import('node:crypto'));
} catch (e) {
  check('R0 jsdom available (npm i --no-save jsdom)', false, e.message);
  console.log(ok + ' ok, ' + bad + ' not ok');
  process.exit(1);
}
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const HOOK = '\n;window.__opn = { openProfilesScreen: openProfilesScreen, openDayMappingScreen593: openDayMappingScreen593, opnLocalApi: opnLocalApi, opnMode: opnMode, opnVaultLocked: opnVaultLocked, opnVaultCreate: opnVaultCreate };';
// the shell exactly as the Worker serves it (ui.ts SHELL_HTML,
// the shape placeholder replaced as index.ts replaces it)
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
if (shellStart < 0 || shellEnd < 0) { console.log('not ok - SHELL_HTML template markers'); process.exit(1); }
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayCT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function makeWorld(store, shape) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', shape || 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  Object.keys(store).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
async function until(fn, ms) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) { if (fn()) return true; await sleep(100); }
  return fn();
}
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
async function unlockViaPad(w, pin) {
  for (const d of pin.split('')) {
    const b = w.document.querySelector('#opn-unlock-pad [data-pinkey="' + d + '"]');
    if (!b) return false;
    click(w, b);
  }
  await sleep(60);
  const go = w.document.getElementById('opn-unlock-go');
  if (!go || go.disabled) return false;
  click(w, go);
  return true;
}
async function profilesPayload(w) {
  return w.__opn.opnLocalApi('/api/prayer/profiles', {}, w.__opn.opnMode());
}

// Build a REAL vault envelope through the client's own
// production migration path over John's document: the local
// /api/pin/set route (opnPinSet + opnVaultCreate in one
// action, PIN 3141) — the same path that created John's
// vault. The cold-start store snapshots the WHOLE
// localStorage (the PIN record rides its own key).
let envelopeStore = null;
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeWorld(store);
  await sleep(400);
  let made = false;
  try {
    await w.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device');
    made = await until(() => {
      try { return JSON.parse(w.localStorage.getItem(DATA_KEY)).format === 'orapronobis-personal-data-encrypted'; } catch (e) { return false; }
    }, 10000);
  } catch (e) {}
  check('R1 a real vault envelope is created over John\'s document through the client\'s own pin-set migration path', made);
  if (made) {
    envelopeStore = {};
    for (let i = 0; i < w.localStorage.length; i++) {
      const k = w.localStorage.key(i);
      envelopeStore[k] = w.localStorage.getItem(k);
    }
  }
}

if (envelopeStore) {
  // R2 — the editor in the cold-start locked world: the gate
  // stands, the unlock proceeds, the painted chip switches.
  {
    const w = makeWorld(envelopeStore);
    await sleep(400);
    w.__opn.openProfilesScreen(null, { ladder: true });
    const gateStood = await until(() => !!w.document.getElementById('opn-unlock-go'));
    check('R2 locked vault: the editor stands the unlock gate, not the editor', gateStood
      && !w.document.querySelector('[data-p593chip]'), { gate: gateStood });
    let unlocked = false, switched = false, pick = null, headTxt = '';
    if (gateStood) {
      unlocked = await unlockViaPad(w, '3141');
      const chipsUp = unlocked && await until(() => !!w.document.querySelector('[data-p593chip="benedictine"]'));
      if (chipsUp) {
        click(w, w.document.querySelector('[data-p593chip="benedictine"]'));
        switched = await until(() => {
          const h = w.document.querySelector('[data-p591head]');
          return h && /Benedictine/.test(h.textContent);
        }, 5000);
        // the payload carries no picks map; the day-pick
        // reads back as effective resolvedBy 'pick'
        const r = await profilesPayload(w);
        pick = r && r.effective && r.effective.resolvedBy === 'pick' ? r.effective.key : null;
        const h = w.document.querySelector('[data-p591head]');
        headTxt = h ? h.textContent : '';
      }
    }
    const unlockMsg = (() => { const m = w.document.getElementById('opn-unlock-msg'); return m ? m.textContent : '(no msg el)'; })();
    check('R3 after the pad unlock, a tap on the painted Benedictine chip stands it for today (the field defect, fixed)',
      unlocked && switched && pick === 'benedictine', { unlocked, switched, pick, headTxt, unlockMsg, stillLocked: w.__opn.opnVaultLocked() });
  }
  // R5 — the Day mapping screen under the same lock.
  {
    const w = makeWorld(envelopeStore);
    await sleep(400);
    w.__opn.openDayMappingScreen593(true);
    const gateStood = await until(() => !!w.document.getElementById('opn-unlock-go'));
    let assigned = null;
    if (gateStood && await unlockViaPad(w, '3141')) {
      const tue = await until(() => w.document.querySelector('[data-p593mapday="tue"]'));
      if (tue) {
        click(w, w.document.querySelector('[data-p593mapday="tue"]'));
        const chipUp = await until(() => w.document.querySelector('[data-p593mapchip="benedictine"]'));
        if (chipUp) {
          click(w, w.document.querySelector('[data-p593mapchip="benedictine"]'));
          await sleep(150);
          const st = w.document.querySelector('[data-p593stand]');
          if (st) {
            click(w, st);
            await sleep(600);
            const r = await profilesPayload(w);
            assigned = r && r.state && r.state.dayDefaults ? r.state.dayDefaults.tue : null;
          }
        }
      }
    }
    check('R5 locked vault: the Day mapping screen gates, unlocks, and a Stand writes at once', gateStood && assigned === 'benedictine', { gateStood, assigned });
  }
}

// R6 — the plain (unlocked) control: no gate, the tap switches.
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeWorld(store);
  await sleep(400);
  w.__opn.openProfilesScreen(null, { ladder: true });
  const chipsUp = await until(() => !!w.document.querySelector('[data-p593chip="benedictine"]'));
  let switched = false;
  if (chipsUp) {
    click(w, w.document.querySelector('[data-p593chip="benedictine"]'));
    switched = await until(() => {
      const h = w.document.querySelector('[data-p591head]');
      return h && /Benedictine/.test(h.textContent);
    }, 5000);
  }
  check('R6 unlocked control: no gate stands and the chip tap switches as before',
    chipsUp && !w.document.getElementById('opn-unlock-go') && switched, { chipsUp, switched });
}

// R7 — the server shape: the gate never stands there.
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeWorld(store, 'private');
  await sleep(400);
  w.__opn.openProfilesScreen(null, { ladder: true });
  await sleep(800);
  check('R7 server shape: no vault gate stands (the gate is device-only)',
    w.__opn.opnMode() === 'server' && !w.document.getElementById('opn-unlock-go'), { mode: w.__opn.opnMode() });
}

console.log(ok + ' ok, ' + bad + ' not ok');
process.exit(bad ? 1 : 0);
