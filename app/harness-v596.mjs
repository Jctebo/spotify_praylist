// harness-v596.mjs — v596 slot picker day-pick: the
// locked-vault gate on openProfileSheet.
//
// THE DEFECT (the v594 Part 1 diagnosis's named sibling):
// the slot picker sheet paints from the ephemeral default
// document the local layer serves on reads while the v578
// vault stands LOCKED, and every row write (the day-pick,
// the standing default, the day rule) throws 423
// vault_locked — the refusal lands on a note line the user
// does not see, so a day-pick tap does nothing.
//
// THE FIX: openProfileSheet's load is wrapped in a named
// startLoad() and the standing gate (profVaultGate594,
// the v594 helper, reused byte-identical) stands at the
// open: while the device vault is locked, the standing
// unlock card stands in the sheet's body and the sheet
// loads only once unlocked. The gate's onClose is the
// sheet's own removal (the named adaptation — the picker
// has no ladder to return to).
//
//  R  REAL-DOM legs (jsdom; run: npm i --no-save jsdom):
//     the harness-v594 recipe — a REAL vault envelope is
//     created through the client's own opnVaultCreate over
//     John's document (the pin-set migration path); a
//     fresh world over that envelope is his cold-start
//     session. R2/R4 FAIL on the pre-fix tree.
//  T  statics: the gate call site in openProfileSheet ·
//     the rendered client parses whole · SW pin unmoved
//     pre-Ship.
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
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---------- T statics ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const sheetStart = clientSrc.indexOf('function openProfileSheet()');
const sheetEnd = clientSrc.indexOf('function openProfileEditor(', sheetStart);
const sheetSrc = clientSrc.slice(sheetStart, sheetEnd);
check('T1 the gate stands at the slot picker: startLoad wrap + profVaultGate594 call with the sheet-removal close',
  sheetSrc.includes('function startLoad()')
  && sheetSrc.includes('if (!profVaultGate594(body, startLoad, function () { sheet.remove(); })) startLoad();')
  && clientSrc.includes('function profVaultGate594(bodyEl, proceed, onClose)')
  && clientSrc.includes('opnUnlockCardHtml()')
  && clientSrc.includes('opnBindUnlockCard(proceed)'));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T2 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
function renderAppJs(src) {
  const tplStart = src.indexOf('= `') + 3;
  const tplEnd = src.indexOf('\n`;', tplStart);
  if (tplStart < 3 || tplEnd < 0) throw new Error('APP_JS template markers');
  return vm.runInContext('`' + src.slice(tplStart, tplEnd) + '`', vm.createContext({}));
}
const appJs = renderAppJs(clientSrc);
const appJsOld = renderAppJs(git(['show', 'main:app/worker/src/client.ts']));
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
const HOOK = '\n;window.__opn = { openProfileSheet: openProfileSheet, opnLocalApi: opnLocalApi, opnMode: opnMode, opnVaultLocked: opnVaultLocked, opnVaultCreate: opnVaultCreate };';
// the shell exactly as the Worker serves it (ui.ts SHELL_HTML,
// the shape placeholder replaced as index.ts replaces it)
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
if (shellStart < 0 || shellEnd < 0) { console.log('not ok - SHELL_HTML template markers'); process.exit(1); }
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeWorld(store, shape, js) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', shape || 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  Object.keys(store).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = (js || appJs) + HOOK;
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
  // R2/R3 — the locked world: the gate stands in the
  // sheet, no pick rows paint, and nothing is written
  // (the stored envelope stands byte-identical).
  {
    const w = makeWorld(envelopeStore);
    await sleep(400);
    const before = w.localStorage.getItem(DATA_KEY);
    w.__opn.openProfileSheet();
    const gateStood = await until(() => !!w.document.getElementById('opn-unlock-go'));
    await sleep(600);
    const rowsPainted = !!w.document.querySelector('[data-profpick]');
    const after = w.localStorage.getItem(DATA_KEY);
    check('R2 locked vault: the slot picker stands the unlock gate, not the pick rows',
      gateStood && !rowsPainted && w.__opn.opnVaultLocked(), { gateStood, rowsPainted });
    check('R3 locked vault: no pick is written — the stored envelope stands byte-identical',
      after === before, { changed: after !== before });
  }
  // R4 — locked world, after the pad unlock: the rows
  // paint and a tap on the Benedictine day-pick row
  // LANDS (the field defect, fixed).
  {
    const w = makeWorld(envelopeStore);
    await sleep(400);
    w.__opn.openProfileSheet();
    const gateStood = await until(() => !!w.document.getElementById('opn-unlock-go'));
    let unlocked = false, rowsUp = false, pick = null, sheetClosed = false;
    if (gateStood) {
      unlocked = await unlockViaPad(w, '3141');
      rowsUp = unlocked && await until(() => !!w.document.querySelector('[data-profpick="benedictine"]'));
      if (rowsUp) {
        click(w, w.document.querySelector('[data-profpick="benedictine"]'));
        sheetClosed = await until(() => !w.document.querySelector('.profsheet'), 5000);
        await sleep(300);
        const r = await profilesPayload(w);
        pick = r && r.effective && r.effective.resolvedBy === 'pick' ? r.effective.key : null;
      }
    }
    check('R4 after the pad unlock, the day-pick rows paint and a tap on Benedictine stands it for today',
      unlocked && rowsUp && sheetClosed && pick === 'benedictine', { unlocked, rowsUp, sheetClosed, pick, stillLocked: w.__opn.opnVaultLocked() });
  }
}

// R5 — the vault-open world: no gate stands, the painted
// rows are byte-identical to the pre-fix client's, and a
// pick lands as before.
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const wNew = makeWorld(store);
  const wOld = makeWorld(store, null, appJsOld);
  await sleep(400);
  wNew.__opn.openProfileSheet();
  wOld.__opn.openProfileSheet();
  const rowsNew = await until(() => !!wNew.document.querySelector('[data-profpick="benedictine"]'));
  const rowsOld = await until(() => !!wOld.document.querySelector('[data-profpick="benedictine"]'));
  const htmlNew = rowsNew ? wNew.document.querySelector('.profbody').innerHTML : '';
  const htmlOld = rowsOld ? wOld.document.querySelector('.profbody').innerHTML : '';
  let pick = null;
  if (rowsNew) {
    click(wNew, wNew.document.querySelector('[data-profpick="benedictine"]'));
    await until(() => !wNew.document.querySelector('.profsheet'), 5000);
    await sleep(300);
    const r = await profilesPayload(wNew);
    pick = r && r.effective && r.effective.resolvedBy === 'pick' ? r.effective.key : null;
  }
  check('R5 vault open: no gate, the sheet paints byte-identical to the pre-fix client, and the pick lands',
    rowsNew && rowsOld && !wNew.document.getElementById('opn-unlock-go') && htmlNew === htmlOld && pick === 'benedictine',
    { rowsNew, rowsOld, sameHtml: htmlNew === htmlOld, pick });
}

// R6 — the server shape: the gate never stands there.
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeWorld(store, 'private');
  await sleep(400);
  w.__opn.openProfileSheet();
  await sleep(800);
  check('R6 server shape: no vault gate stands (the gate is device-only)',
    w.__opn.opnMode() === 'server' && !w.document.getElementById('opn-unlock-go'), { mode: w.__opn.opnMode() });
}

console.log(ok + ' ok, ' + bad + ' not ok');
process.exit(bad ? 1 : 0);
