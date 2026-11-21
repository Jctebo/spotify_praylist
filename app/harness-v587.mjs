// harness-v587.mjs — v587 Vault unlock screen: the large
// PIN pad stands here too.
//
// Q1 A: the large pad stands on the v578 vault unlock
// screen; the typed PIN field retires there. Q2 A: the pad
// also stands on the PIN set/change forms — one PIN entry
// form everywhere; the recovery-code entry stays typed.
// Presentation/entry only: PIN behavior, the vault
// machinery, and where a PIN is required do not change.
//
// Plan's seam finding (release doc §2): renderPinGate's
// pad binds to fixed global IDs + pinGateCtx, so the
// wiring is a per-instance pad factory (opnPinPadHtml /
// opnPinPadBind) emitting the gate's markup and classes
// under an id prefix; each form's standing submit handler
// reads the pad entry and posts to the SAME route with
// the SAME body and handling. renderPinGate stands
// untouched.
//
// S-legs (static, against BASE): confinement; migrations
// unchanged; SW pin unmoved pre-Ship; index.ts + ui.ts
// byte-identical; the gate slice (renderPinGate through
// submitPinVerify) byte-identical; no diff line touches
// the vault/PIN machinery; no typed PIN field remains;
// the recovery-code inputs stay typed.
// R-legs: the rendered client parses whole; the served
// stylesheet dress stands as v584 built it.
// L-legs (vm worlds over slices of the RENDERED client,
// a fake DOM, the v585 pattern): the unlock card paints
// the pad and no typed field; the pad's entry unlocks
// through the standing verify route; a wrong PIN fails
// with the standing message and clears the entry; the pad
// discipline (dots from 4, cap 8, back key, submit gating);
// the unlock recovery form (code typed, new PIN by pad)
// posts the recover route; the gate recovery form's two
// pads + typed code post the recover route, mismatch
// stands; the set sheet's two pads drive the match
// validation and post the set route, showing the recovery
// sheet once.
//
// Run: node harness-v587.mjs [BASE_SHA]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const BASE = process.argv[2] || '934781fa7f9a9779e0318959c3e15ce9de867eda';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', args, { cwd: APP + '..', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const SRC = APP + 'worker/src/';

// ---------- S-legs ----------
const changed = git(['diff', '--name-only', BASE, '--', 'app'])
  .split('\n').filter(Boolean).map((p) => p.replace(/^app\//, ''));
const allowed = new Set(['worker/src/client.ts', 'harness-v587.mjs']);
check('S1 diff confined to client.ts + harness-v587.mjs', changed.every((p) => allowed.has(p)), changed);
const migChanged = git(['diff', '--name-only', BASE, '--', 'app/migrations']).trim();
check('S2 migrations unchanged vs BASE', migChanged === '', migChanged);
const uiSrc = readFileSync(SRC + 'ui.ts', 'utf8');
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(['show', BASE + ':app/worker/src/ui.ts']);
check('S3 SW pin unmoved vs BASE pre-Ship', pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const indexDiff = git(['diff', BASE, '--', 'app/worker/src/index.ts']).trim();
check('S4 index.ts byte-identical to BASE (server routes untouched)', indexDiff === '');
const uiDiff = git(['diff', BASE, '--', 'app/worker/src/ui.ts']).trim();
check('S5 ui.ts byte-identical to BASE (the v584 dress already covers the pad)', uiDiff === '');
const clientSrc = readFileSync(SRC + 'client.ts', 'utf8');
const baseClient = git(['show', BASE + ':app/worker/src/client.ts']);
const gateSlice = (s) => s.slice(s.indexOf('function renderPinGate'), s.indexOf('function renderPinRecoveryForm'));
check('S6 the gate slice (renderPinGate..submitPinVerify) is byte-identical to BASE', gateSlice(clientSrc) === gateSlice(baseClient));
const diffLines = git(['diff', BASE, '--', 'app/worker/src/client.ts']).split('\n')
  .filter((l) => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
const machinery = /opnVault|opnPin(?!Pad)|pinHash|recoveryHash|opnPbkdf2/;
check('S7 no diff line touches the vault / PIN machinery', diffLines.every((l) => !machinery.test(l)), diffLines.filter((l) => machinery.test(l)));
check('S8 no typed PIN field remains in the client', !clientSrc.includes('type="password"'), '');
check('S8 the retired field ids are gone', ['opn-unlock-pin', 'opn-rec-pin', 'rec-pin1', 'rec-pin2', 'ps-pin1', 'ps-pin2'].every((id) => !clientSrc.includes('id="' + id + '"')));
check('S9 the recovery-code inputs stay typed text fields',
  clientSrc.includes('<input type="text" id="opn-rec-code"') && clientSrc.includes('<input type="text" id="rec-code"'));
check('S10 the pad factory + the four wirings stand',
  clientSrc.includes('function opnPinPadHtml') && clientSrc.includes('function opnPinPadBind')
  && clientSrc.includes("opnPinPadBind('opn-unlock', 'opn-unlock-go')") && clientSrc.includes("opnPinPadBind('opn-rec', 'opn-rec-go')")
  && clientSrc.includes("opnPinPadBind('rec1')") && clientSrc.includes("opnPinPadBind('rec2')")
  && clientSrc.includes("opnPinPadBind('ps1')") && clientSrc.includes("opnPinPadBind('ps2')"));

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('R1 rendered client (APP_JS) parses whole', parses, perr);
}
// ---------- render APP_CSS exactly as the Worker serves it ----------
const cssStart = uiSrc.indexOf('export const APP_CSS = `') + 'export const APP_CSS = `'.length;
const cssEnd = uiSrc.indexOf('\n`;', cssStart);
const appCss = vm.runInContext('`' + uiSrc.slice(cssStart, cssEnd) + '`', vm.createContext({}));
const rule = (sel) => { const i = appCss.indexOf(sel + ' {'); return i < 0 ? '' : appCss.slice(i, appCss.indexOf('}', i)); };
check('R2 the served dress stands as v584 built it (88px keys, 30px digits, 18px dots)',
  rule('.pinpad button').includes('width:88px') && rule('.pinpad button').includes('font-size:30px') && rule('.pindot').includes('width:18px'), rule('.pinpad button'));

// ---------- a small fake DOM (the v585 pattern) ----------
let activeDoc = null;
function makeDoc() {
  const byId = new Map();
  class El {
    constructor(tag) {
      this.tagName = (tag || 'div').toUpperCase();
      this.children = []; this.listeners = {}; this.attrs = {};
      this.style = {}; this.className = ''; this.textContent = '';
      this.value = ''; this.disabled = false; this._html = ''; this.removed = false;
      const self = this;
      this.classList = {
        add: (c) => { if (!self.classList.contains(c)) self.className = (self.className + ' ' + c).trim(); },
        remove: (c) => { self.className = self.className.split(/\s+/).filter((x) => x && x !== c).join(' '); },
        toggle: (c, on) => { if (on === undefined ? !self.classList.contains(c) : on) self.classList.add(c); else self.classList.remove(c); },
        contains: (c) => self.className.split(/\s+/).includes(c),
      };
    }
    set innerHTML(v) { this._html = String(v); this.children = []; parseInto(this, this._html); }
    get innerHTML() { return this._html; }
    appendChild(c) { this.children.push(c); registerTree(c); return c; }
    remove() { this.removed = true; unregisterTree(this); }
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    click() { (this.listeners.click || []).slice().forEach((fn) => fn({ preventDefault() {} })); }
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'id') byId.set(v, this); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const out = [];
      const walk = (el) => { el.children.forEach((c) => { if (matches(c, sel)) out.push(c); walk(c); }); };
      walk(this);
      return out;
    }
  }
  function matches(el, sel) {
    if (sel.startsWith('#')) return el.attrs.id === sel.slice(1);
    if (sel.startsWith('.')) return el.className.split(/\s+/).includes(sel.slice(1));
    const m = sel.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/);
    if (m) { const v = el.attrs['data-' + m[1]]; return v !== undefined && (m[2] === undefined || v === m[2]); }
    return el.tagName === sel.toUpperCase();
  }
  function registerTree(el) { if (el.attrs.id) byId.set(el.attrs.id, el); el.children.forEach(registerTree); }
  function unregisterTree(el) { if (el.attrs.id && byId.get(el.attrs.id) === el) byId.delete(el.attrs.id); el.children.forEach(unregisterTree); }
  function parseInto(root, html) {
    const stack = [root];
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(html))) {
      if (m[5] !== undefined) { if (m[5].trim()) stack[stack.length - 1].textContent += m[5]; continue; }
      const [, close, tag, attrText, selfClose] = m;
      const t = tag.toLowerCase();
      if (close) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tagName === t.toUpperCase()) { stack.length = i; break; } continue; }
      const el = new El(t);
      const are = /([a-zA-Z-]+)(?:="([^"]*)")?/g;
      let a;
      while ((a = are.exec(attrText || ''))) {
        const [, k, v] = a;
        if (k === 'id') { el.attrs.id = v; byId.set(v, el); }
        else if (k === 'class') el.className = v || '';
        else if (k === 'style') { (v || '').split(';').forEach((d) => { const [pk, pv] = d.split(':'); if (pk && pv) el.style[pk.trim()] = pv.trim(); }); }
        else if (k === 'disabled') el.disabled = true;
        else if (k === 'value') el.value = v || '';
        else el.attrs[k] = v === undefined ? '' : v;
      }
      stack[stack.length - 1].children.push(el);
      if (!selfClose && !['input', 'br', 'img', 'hr'].includes(t)) stack.push(el);
    }
  }
  const doc = {
    body: new El('body'),
    getElementById: (id) => byId.get(id) || null,
    createElement: (tag) => new El(tag),
    querySelector: (sel) => doc.body.querySelector(sel),
    querySelectorAll: (sel) => doc.body.querySelectorAll(sel),
  };
  doc.body.ownerDoc = doc;
  return doc;
}

// ---------- slices of the rendered client ----------
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}
function makeWorld() {
  const doc = makeDoc();
  activeDoc = doc;
  const view = doc.createElement('div');
  doc.body.appendChild(view);
  const world = {
    console, document: doc, view,
    setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0, clearTimeout: () => {},
    __posts: [], __recoverySheets: [], __rerenders: 0, __gateRenders: 0, __settingsRenders: 0,
    __responder: () => Promise.resolve({ token: 'tok-1', recoveryCode: 'CODE-1' }),
  };
  vm.createContext(world);
  const prelude = `
    var pinToken = null; var pinStateCache = null;
    function post(p, b) { __posts.push([p, b]); return __responder(p, b); }
    function opnVaultPeek() { return null; }
    function opnBiometricStatus() { return Promise.resolve({ available: false, enrolled: false }); }
    function opnBiometricUnlock() { return Promise.reject(new Error('no')); }
    function opnPasskeyUnlock() { return Promise.reject(new Error('no')); }
    function showRecoverySheet(code, onDone) { __recoverySheets.push(code); if (onDone) onDone(); }
    function mountDrawer() {}
    function clearPinWait() {}
    function renderPinGate() {}
    function renderSettings() {}
  `;
  const parts = [
    prelude,
    slice('function opnPinPadHtml', 'function opnDefaultDoc'),
    slice('function renderPinRecoveryForm', 'function showRecoverySheet'),
    slice('function openPinSetSheet', 'function settingsRebuildOrder'),
    `;this.__x = { opnUnlockCardHtml, opnBindUnlockCard, renderPinRecoveryForm, openPinSetSheet,
       token: () => pinToken, posts: __posts, recoverySheets: __recoverySheets };`,
  ];
  vm.runInContext(parts.join('\n'), world);
  world.__view = view;
  return world;
}
const tick = async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); };
function tapPad(world, prefix, digits) {
  const pad = world.document.getElementById(prefix + '-pad');
  if (!pad) return false;
  const btns = pad.querySelectorAll('[data-pinkey]');
  for (const d of digits) {
    const b = btns.find((x) => x.getAttribute('data-pinkey') === d);
    if (!b) return false;
    b.click();
  }
  return true;
}
const dotsOn = (world, prefix) => {
  const dots = world.document.getElementById(prefix + '-dots');
  return dots ? (dots.innerHTML.match(/pindot on/g) || []).length : -1;
};

// ---------- L1 the unlock card ----------
{
  const w = makeWorld();
  const html = w.__x.opnUnlockCardHtml();
  check('L1 the unlock card paints the pad (dots + pinpad, opn-unlock prefix)',
    html.includes('id="opn-unlock-pad"') && html.includes('id="opn-unlock-dots"') && html.includes('data-pinkey="back"'), html.slice(0, 200));
  check('L1 the unlock card carries NO typed PIN field', !html.includes('type="password"') && !html.includes('opn-unlock-pin'));
  check('L1 the recovery code stays a typed text field on the card', html.includes('<input type="text" id="opn-rec-code"'));
  check('L1 the recovery new PIN takes a pad too (opn-rec prefix)', html.includes('id="opn-rec-pad"') && !html.includes('opn-rec-pin"'));
  w.__view.innerHTML = html;
  w.__x.opnBindUnlockCard(() => { w.__rerenders++; });
  const go = w.document.getElementById('opn-unlock-go');
  check('L1 the Unlock button stands disabled under 4 digits (the gate discipline)', go.disabled === true);
  check('L1 tapping the pad fills the entry (dots paint)', tapPad(w, 'opn-unlock', '246') && dotsOn(w, 'opn-unlock') === 3 && go.disabled === true);
  tapPad(w, 'opn-unlock', '8');
  check('L1 at 4 digits the dots stand 4 on and Unlock enables', dotsOn(w, 'opn-unlock') === 4 && go.disabled === false);
  go.click();
  await tick();
  check('L1 the entry unlocks through the standing verify route (body carries the entered PIN)',
    JSON.stringify(w.__x.posts) === JSON.stringify([['/api/pin/verify', { pin: '2468' }]]), w.__x.posts);
  check('L1 a successful unlock takes the token and re-renders the surface', w.__x.token() === 'tok-1' && w.__rerenders === 1);
}
// ---------- L2 a wrong PIN on the unlock pad ----------
{
  const w = makeWorld();
  w.__responder = () => Promise.reject({ status: 401, data: { attemptsRemaining: 3 }, message: 'Wrong PIN' });
  w.__view.innerHTML = w.__x.opnUnlockCardHtml();
  w.__x.opnBindUnlockCard(() => { w.__rerenders++; });
  tapPad(w, 'opn-unlock', '9999');
  w.document.getElementById('opn-unlock-go').click();
  await tick();
  const msg = w.document.getElementById('opn-unlock-msg');
  check('L2 a wrong PIN fails with the standing message', msg.textContent === 'Wrong PIN — 3 attempts before a short wait', msg.textContent);
  check('L2 a wrong PIN clears the pad entry (dots stand empty, Unlock disabled again)',
    dotsOn(w, 'opn-unlock') === 0 && w.document.getElementById('opn-unlock-go').disabled === true);
  check('L2 no re-render and no token on a wrong PIN', w.__rerenders === 0 && w.__x.token() === null);
}
// ---------- L3 the pad discipline ----------
{
  const w = makeWorld();
  w.__view.innerHTML = w.__x.opnUnlockCardHtml();
  w.__x.opnBindUnlockCard(() => {});
  tapPad(w, 'opn-unlock', '123456789012');
  check('L3 the entry caps at 8 digits', dotsOn(w, 'opn-unlock') === 8, dotsOn(w, 'opn-unlock'));
  tapPad(w, 'opn-unlock', ['back']);
  check('L3 the back key removes the last digit', dotsOn(w, 'opn-unlock') === 7);
  w.document.getElementById('opn-unlock-go').click();
  await tick();
  check('L3 the capped entry is what the verify route receives',
    JSON.stringify(w.__x.posts) === JSON.stringify([['/api/pin/verify', { pin: '1234567' }]]), w.__x.posts);
}
// ---------- L4 the unlock recovery form ----------
{
  const w = makeWorld();
  w.__view.innerHTML = w.__x.opnUnlockCardHtml();
  w.__x.opnBindUnlockCard(() => { w.__rerenders++; });
  w.document.getElementById('opn-unlock-rec-open').click();
  check('L4 the recovery form opens on its standing toggle', w.document.getElementById('opn-unlock-rec').style.display === '');
  w.document.getElementById('opn-rec-code').value = 'ABCD-1234';
  tapPad(w, 'opn-rec', '1357');
  w.document.getElementById('opn-rec-go').click();
  await tick();
  check('L4 the recovery posts code (typed) + new PIN (pad) to the standing recover route',
    JSON.stringify(w.__x.posts) === JSON.stringify([['/api/pin/recover', { code: 'ABCD-1234', newPin: '1357' }]]), w.__x.posts);
  check('L4 a successful recovery shows the fresh code once', JSON.stringify(w.__x.recoverySheets) === JSON.stringify(['CODE-1']));
}
// ---------- L5 the gate recovery form ----------
{
  const w = makeWorld();
  w.__x.renderPinRecoveryForm('conscience', () => {});
  check('L5 the gate recovery form paints two pads and keeps the code typed',
    !!w.document.getElementById('rec1-pad') && !!w.document.getElementById('rec2-pad')
    && w.document.getElementById('rec-code').tagName === 'INPUT' && !w.__view.innerHTML.includes('type="password"'));
  w.document.getElementById('rec-code').value = 'WXYZ-9876';
  tapPad(w, 'rec1', '2468');
  tapPad(w, 'rec2', '2469');
  w.document.getElementById('rec-go').click();
  await tick();
  check('L5 mismatched pad entries stand on the standing match message, nothing posts',
    w.document.getElementById('rec-msg').textContent === 'The two entries do not match' && w.__x.posts.length === 0,
    w.document.getElementById('rec-msg').textContent);
  tapPad(w, 'rec2', ['back']);
  tapPad(w, 'rec2', '8');
  w.document.getElementById('rec-go').click();
  await tick();
  check('L5 matched pads post code + new PIN to the recover route',
    JSON.stringify(w.__x.posts) === JSON.stringify([['/api/pin/recover', { code: 'WXYZ-9876', newPin: '2468' }]]), w.__x.posts);
  check('L5 a successful gate recovery shows the fresh code once', JSON.stringify(w.__x.recoverySheets) === JSON.stringify(['CODE-1']));
}
// ---------- L6 the PIN set sheet ----------
{
  const w = makeWorld();
  w.__x.openPinSetSheet('set');
  const sheet = w.document.querySelector('.pinsetsheet');
  check('L6 the set sheet stands with two pads and no typed field',
    !!sheet && !!w.document.getElementById('ps1-pad') && !!w.document.getElementById('ps2-pad') && !sheet.innerHTML.includes('type="password"'));
  tapPad(w, 'ps1', '1357');
  tapPad(w, 'ps2', '1358');
  sheet.querySelector('#ps-save').click();
  await tick();
  check('L6 mismatched entries stand on the standing match message, nothing posts',
    sheet.querySelector('#ps-msg').textContent === 'The two entries do not match' && w.__x.posts.length === 0,
    sheet.querySelector('#ps-msg').textContent);
  tapPad(w, 'ps2', ['back']);
  tapPad(w, 'ps2', '7');
  sheet.querySelector('#ps-save').click();
  await tick();
  check('L6 matched pads post the new PIN to the standing set route',
    JSON.stringify(w.__x.posts) === JSON.stringify([['/api/pin/set', { pin: '1357' }]]), w.__x.posts);
  check('L6 a successful set shows the recovery code once and takes the token',
    JSON.stringify(w.__x.recoverySheets) === JSON.stringify(['CODE-1']) && w.__x.token() === 'tok-1');
}

console.log(`\n${ok} ok / ${bad} not ok`);
process.exit(bad ? 1 : 0);
