// harness-v599.mjs — v599: Edit today gains a block
// jump strip (John's pick (a), 2026-11-21 17:56 CT),
// at Edit profiles' jump strip's own compactness
// (John's refinement, 17:57 CT: "more compact like
// edit profiles").
//
//  T  statics: the strip stands in Edit today's frozen
//     zone, built on Edit profiles' jump component
//     whole (profjump593 / profjumbtn593 — ui.ts
//     byte-identical to main, the dress shared by
//     construction, no new CSS) · jump + scrollspy
//     functions stand · the client.ts diff vs main is
//     confined to openEditTodayScreen594 · index.ts
//     byte-identical (the fold untouched) · the
//     rendered client parses whole · SW pin unmoved
//     pre-Ship (or v599's own at Ship).
//  R  REAL-DOM legs (jsdom) over John's document:
//     exactly one strip, one chip per painted block in
//     the screen's order · the chips' computed dress
//     EQUALS Edit profiles' jump strip chips (32px /
//     12px / 4px 9px) · a chip tap scrolls its block
//     into view and the scrollspy lights the block in
//     view (driven with patched geometry — jsdom has
//     no layout) · the strip stands in the frozen zone,
//     outside the scroller · navigation never dirties
//     the draft (jumps + close: no prompt, the stored
//     document byte-identical) · the locked-vault
//     world: the gate stands first, the strip paints
//     only after the pad unlock.
//  Equivalence: T2/T3 confine the change to a
//  paint-only screen function; the composition gates
//  stand in harness-v600 (A/L byte-identical legs)
//  and harness-v601, run as regressions.
// Fixtures from production only (Improvement D):
// John's import file (his profiles document).
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
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
check('T1 the strip is built on Edit profiles\u2019 jump component whole: profjump593 container + profjumbtn593 chips + frozenT.appendChild',
  clientSrc.includes("jumpT.className = 'profjump593';")
  && clientSrc.includes('class="profjumbtn593" data-p599jumpbtn="')
  && clientSrc.includes('frozenT.appendChild(jumpT)')
  && clientSrc.includes('function jumpToT(name)') && clientSrc.includes('function spyUpdateT()')
  && clientSrc.includes('function paintJumpT()'));
{
  const stripPin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  check('T2 ui.ts is byte-identical to main apart from the SW pin — the dress is shared, no new CSS, no copied values',
    stripPin(uiSrc) === stripPin(git(['show', 'main:app/worker/src/ui.ts'])));
}
{
  let confined = true, why = '';
  try {
    const diff = git(['diff', '-U0', 'main', '--', 'app/worker/src/client.ts']);
    const a = clientSrc.indexOf('function openEditTodayScreen594');
    const b = clientSrc.indexOf('\nfunction ', a + 10);
    const span = clientSrc.slice(a, b < 0 ? undefined : b);
    const lineOf = (idx) => clientSrc.slice(0, idx).split('\n').length;
    const lo = lineOf(a), hi = lineOf(a + span.length);
    diff.split('\n').forEach((ln) => {
      const m = ln.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (m) {
        const start = +m[1], len = +(m[2] || 1);
        if (start < lo || start + Math.max(len - 1, 0) > hi) { confined = false; why = ln + ' span ' + lo + '-' + hi; }
      }
    });
    if (!diff.trim()) { confined = false; why = 'no diff'; }
  } catch (e) { confined = false; why = e.message; }
  check('T3 every changed client.ts line falls inside openEditTodayScreen594 (paint-only surface; the draft/save/fold machinery untouched)', confined, why);
}
{
  let idxSame = true;
  try { git(['diff', '--quiet', 'main', '--', 'app/worker/src/index.ts']); } catch (e) { idxSame = false; }
  check('T4 index.ts byte-identical to main — server + fold untouched', idxSame);
}
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T5 SW pin unmoved vs main, or v599\u2019s own pin at Ship',
  pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])) || pinOf(uiSrc) === 'ora-pro-nobis-v599-1',
  { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T6 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- R: real-DOM legs (recipe: harness-v600) ----------
let JSDOM, webcrypto;
try {
  ({ JSDOM } = await import('jsdom'));
  ({ webcrypto } = await import('node:crypto'));
} catch (e) {
  check('R0 jsdom available', false, e.message);
  console.log('harness-v599:', ok, 'ok /', bad, 'not ok');
  process.exit(1);
}
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const HOOK = '\n;window.__opn = { openConfigureLadder593: openConfigureLadder593, openEditTodayScreen594: openEditTodayScreen594, openProfilesScreen: openProfilesScreen, opnLocalApi: opnLocalApi, opnMode: opnMode, opnVaultLocked: opnVaultLocked };';
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
if (shellStart < 0 || shellEnd < 0) { console.log('not ok - SHELL_HTML template markers'); process.exit(1); }
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
// The shell carries no <style> — the app CSS is served
// as its own sheet. Inject APP_CSS as a style element
// so the computed dress can be measured (v598 recipe).
const cssStart = uiSrc.indexOf('export const APP_CSS = `') + 'export const APP_CSS = `'.length;
const cssEnd = uiSrc.indexOf('\n`;', cssStart);
if (cssStart < 'export const APP_CSS = `'.length || cssEnd < 0) { console.log('not ok - APP_CSS template markers'); process.exit(1); }
const APP_CSS = vm.runInContext('`' + uiSrc.slice(cssStart, cssEnd) + '`', vm.createContext({}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function makeDomWorld(store, shape) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', shape || 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  const st = w.document.createElement('style');
  st.textContent = APP_CSS;
  w.document.head.appendChild(st);
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
  while (Date.now() < end) { if (await fn()) return true; await sleep(100); }
  return !!(await fn());
}
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
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
function freshDom() {
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  return makeDomWorld(store);
}
const stripOf = (w) => w.document.querySelector('[data-p599jump]');
const chipsOf = (w) => Array.from(w.document.querySelectorAll('[data-p599jumpbtn]'));
const scrollerOf = (w) => w.document.querySelector('.proftoday594 .panelbody');

// R1-R5: the plain world over John's document.
{
  const w = freshDom();
  await sleep(400);
  w.__opn.openProfilesScreen(null, { ladder: true });
  const profUp = await until(() => !!w.document.querySelector('[data-p593jumpbtn="Night"]'));
  const profChip = w.document.querySelector('[data-p593jumpbtn="Night"]');
  const pcsLive = profChip ? w.getComputedStyle(profChip) : null;
  const pcs = pcsLive ? { minHeight: pcsLive.minHeight, fontSize: pcsLive.fontSize, paddingTop: pcsLive.paddingTop, paddingLeft: pcsLive.paddingLeft } : null;
  check('R1 (reference) Edit profiles\u2019 jump chip computes the jump dress: 32px / 12px / 4px 9px',
    profUp && !!pcs && pcs.minHeight === '32px' && pcs.fontSize === '12px'
    && pcs.paddingTop === '4px' && pcs.paddingLeft === '9px',
    pcs || 'no chip');
  const profSheet = w.document.querySelector('.profplan590');
  if (profSheet) profSheet.remove();

  w.__opn.openEditTodayScreen594(true);
  const up = await until(() => !!w.document.querySelector('[data-p594tblock="Night"]') && chipsOf(w).length > 0);
  const strips = w.document.querySelectorAll('[data-p599jump]');
  const chipNames = chipsOf(w).map((c) => c.getAttribute('data-p599jumpbtn'));
  const anchorNames = [];
  w.document.querySelectorAll('.proftoday594 [data-p594anchor]').forEach((el) => {
    const n = el.getAttribute('data-p594anchor');
    if (anchorNames.indexOf(n) < 0) anchorNames.push(n);
  });
  check('R2 Edit today paints exactly ONE jump strip, one chip per painted block, in the screen\u2019s order',
    up && strips.length === 1 && chipNames.length === 8 && JSON.stringify(chipNames) === JSON.stringify(anchorNames),
    { strips: strips.length, chips: chipNames, anchors: anchorNames });
  const chip0 = chipsOf(w)[0];
  const ccs = chip0 ? w.getComputedStyle(chip0) : null;
  check('R3 the strip\u2019s chips carry the shared component and compute EQUAL to Edit profiles\u2019 jump chips (32px / 12px / 4px 9px)',
    !!chip0 && chip0.classList.contains('profjumbtn593') && !!ccs && !!pcs
    && ccs.minHeight === pcs.minHeight && ccs.fontSize === pcs.fontSize
    && ccs.paddingTop === pcs.paddingTop && ccs.paddingLeft === pcs.paddingLeft
    && ccs.minHeight === '32px' && ccs.fontSize === '12px',
    ccs ? { mh: ccs.minHeight, fs: ccs.fontSize, pt: ccs.paddingTop, pl: ccs.paddingLeft } : 'no chip');
  const strip = stripOf(w), frozen = w.document.querySelector('.proftodayfrozen600'), scroller = scrollerOf(w);
  check('R4 the strip stands in the FROZEN zone: inside .proftodayfrozen600, outside the scroller, the frozen zone standing',
    !!strip && !!frozen && strip.closest('.proftodayfrozen600') === frozen
    && strip.closest('.panelbody') === null && frozen.hidden === false
    && (frozen.compareDocumentPosition(scroller) & 4) !== 0,
    { inFrozen: !!strip && !!strip.closest('.proftodayfrozen600'), inScroller: !!strip && !!strip.closest('.panelbody'), fHidden: frozen && frozen.hidden });

  // R5: tap-scroll + scrollspy, driven with patched
  // geometry (jsdom returns zero rects).
  const anchors = Array.from(w.document.querySelectorAll('.proftoday594 [data-p594anchor]'));
  let OFF = 0;
  anchors.forEach((el, i) => {
    el.getBoundingClientRect = () => ({ top: i * 100 - OFF, bottom: i * 100 - OFF + 40, left: 0, right: 300, width: 300, height: 40 });
  });
  scroller.getBoundingClientRect = () => ({ top: 0, bottom: 600, left: 0, right: 300, width: 300, height: 600 });
  let scrolledTo = null;
  scroller.scrollTo = (opts) => { scrolledTo = opts; scroller.scrollTop = opts.top; };
  const nightChip = chipsOf(w).filter((c) => c.getAttribute('data-p599jumpbtn') === 'Night')[0];
  const nightEl = w.document.querySelector('.proftoday594 [data-p594anchor="Night"]');
  const nightIdx = anchors.indexOf(nightEl);
  scroller.scrollTop = 40;
  click(w, nightChip);
  check('R5 a chip tap scrolls its block into view (jumpTo math over the patched geometry)',
    !!scrolledTo && scrolledTo.top === nightIdx * 100 - 0 + 40 - 2,
    { got: scrolledTo, want: nightIdx * 100 + 38 });
  OFF = 0;
  scroller.dispatchEvent(new w.Event('scroll'));
  let lit = chipsOf(w).filter((c) => c.classList.contains('on')).map((c) => c.getAttribute('data-p599jumpbtn'));
  check('R6 scrollspy lights the block in view at the top (Morning)',
    JSON.stringify(lit) === JSON.stringify([anchors[0].getAttribute('data-p594anchor')]), { lit });
  OFF = 350;
  scroller.dispatchEvent(new w.Event('scroll'));
  const expectIdx = anchors.map((el, i) => i).filter((i) => i * 100 - OFF <= 16).pop();
  lit = chipsOf(w).filter((c) => c.classList.contains('on')).map((c) => c.getAttribute('data-p599jumpbtn'));
  check('R7 scrollspy follows the scroll: the last block at or above the top edge lights',
    JSON.stringify(lit) === JSON.stringify([anchors[expectIdx].getAttribute('data-p594anchor')]),
    { lit, expect: anchors[expectIdx].getAttribute('data-p594anchor') });

  // R8: navigation never dirties the draft.
  const before = w.localStorage.getItem(DATA_KEY);
  click(w, chipsOf(w).filter((c) => c.getAttribute('data-p599jumpbtn') === 'Morning')[0]);
  click(w, chipsOf(w).filter((c) => c.getAttribute('data-p599jumpbtn') === 'Evening')[0]);
  click(w, w.document.querySelector('[data-p594tclose]'));
  await sleep(300);
  check('R8 navigation never dirties: jumps + Close — no prompt, the sheet closed, the stored document byte-identical',
    !w.document.querySelector('.proftoday594') && !w.document.querySelector('.profprompt593')
    && w.localStorage.getItem(DATA_KEY) === before,
    { sheetGone: !w.document.querySelector('.proftoday594'), prompt: !!w.document.querySelector('.profprompt593') });
}

// R9: the locked-vault world — gate first, strip after.
let envelopeStore = null;
{
  const store = {}; store[DATA_KEY] = JSON.stringify(JOHN);
  const w = makeDomWorld(store);
  await sleep(400);
  let made = false;
  try {
    await w.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device');
    made = await until(() => {
      try { return JSON.parse(w.localStorage.getItem(DATA_KEY)).format === 'orapronobis-personal-data-encrypted'; } catch (e) { return false; }
    }, 10000);
  } catch (e) {}
  if (made) {
    envelopeStore = {};
    for (let i = 0; i < w.localStorage.length; i++) {
      const k = w.localStorage.key(i);
      envelopeStore[k] = w.localStorage.getItem(k);
    }
  }
  check('R9a a real vault envelope is created over John\u2019s document through the client\u2019s own pin-set path', made);
}
if (envelopeStore) {
  const w = makeDomWorld(envelopeStore);
  await sleep(400);
  w.__opn.openEditTodayScreen594(true);
  const gateStood = await until(() => !!w.document.getElementById('opn-unlock-go'));
  const frozen = w.document.querySelector('.proftodayfrozen600');
  check('R9 locked vault: the gate stands first and the strip does NOT paint behind it (frozen zone hidden, no chips)',
    gateStood && !!frozen && frozen.hidden === true && chipsOf(w).length === 0,
    { gate: gateStood, fHidden: frozen && frozen.hidden, chips: chipsOf(w).length });
  let painted = false;
  if (gateStood && await unlockViaPad(w, '3141')) {
    painted = await until(() => chipsOf(w).length === 8 && !!w.document.querySelector('[data-p594tblock="Night"]'));
  }
  check('R10 after the pad unlock the screen loads and the strip paints (8 chips)',
    painted && w.document.querySelector('.proftodayfrozen600').hidden === false,
    { painted });
}

console.log('harness-v599:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
