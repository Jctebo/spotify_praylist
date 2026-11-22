// harness-v612.mjs — v612: the Praylist groups fold —
//  the v604 fold machinery re-pointed at the v609 group
//  heads. Groups stand collapsed by default; a head tap
//  folds/unfolds that group; Expand all / Collapse all
//  stand again in the header ⋮ menu; Play All queues the
//  whole day regardless of fold; the vault gate and the
//  edit form are untouched by the fold.
// Fixtures (Improvement D — production sources, named):
//  - tests/fixtures-v597/production-day-2026-11-21.json —
//    the production day payload (the day his phone served).
//  - tests/fixtures-v597/production-source-settings.json —
//    his production source settings (v8, 26 sources).
//  - ~/workspace/projects/ora-pro-nobis/john-personal-data-
//    import-v589.json — his own exported document; the
//    F8 vault envelope is built FROM it by the client's
//    own opnVaultCreate.
// The old-client ref is the immutable v609-3 tree
//  (6d3c65e), pinned by commit: OA1-OA3 must FAIL there
//  (all tracks paint, head taps inert, no fold menu items).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrc = git(['show', '6d3c65e:app/worker/src/client.ts']); // fail-on-old pin: the v609-3 tree (the grouped set with NO fold)
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const MODE_KEY = 'opn-praylistmode-v604';
const PIN = '2468';

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = renderJs(oldClientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v612:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { state, opn604: (typeof opn604 !== "undefined" ? opn604 : null), opnLocalApi, opnDoc, opnVaultLocked, opnVaultCreate, opnVaultUnlockWithPin, opnRawKeyB64: function () { return opnVaultRawKey ? opnB64(opnVaultRawKey) : null; }, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, openHeaderMenu, opnExpanded604, opnToggleBlock604, opnPraylistMode604, opnFoldSessionNow: function () { return opnFoldSession604; }, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, resolveReadingsSeat590, resolveProfileCourses590 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' };
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
  const calls = { unlock: 0, status: 0 };
  const base = {
    vaultBiometricStatus: () => { calls.status++; return Promise.resolve(opts.status); },
    vaultBiometricUnlock: () => { calls.unlock++; return opts.unlock(); },
    vaultBiometricClear: () => Promise.resolve({}),
    vaultBiometricEnroll: () => Promise.resolve({}),
  };
  const proxy = new Proxy(base, { get: (t, k) => { if (k === 'then') return undefined; return k in t ? t[k] : () => Promise.resolve({}); } });
  return { plugin: proxy, calls };
}
function click(w, el) { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0('2026-11-21');
  const prim = {};
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'external' && s.slotId && s.role !== 'fallback') prim[s.slotId] = s; });
  const standing = [];
  O.EXT_SLOTS.forEach((s) => {
    const row = prim[s.slotId];
    if (!row || row.enabled !== 1 || !O.extDayRulePasses(row.dayRule || 'daily', wd)) return;
    standing.push({ slotId: s.slotId, title: s.title, block: row.block || 'Morning', sortOrder: row.sortOrder, source: s.source || 'Divine Office' });
  });
  O.state.extStanding = standing;
  const own = [];
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'own' && O.OWN_ROW_EPISODE[s.sourceKey]) own.push({ sourceKey: s.sourceKey, episodeId: O.OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled }); });
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0));
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
}
async function paintRealDay(w) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
// The expected group runs from the descriptor list: one
// head per block-consecutive run + its track count.
function groupRuns(descs) {
  const runs = [];
  (descs || []).forEach((t) => {
    const b = t.block || 'Episodes';
    if (runs.length && runs[runs.length - 1].block === b) runs[runs.length - 1].count++;
    else runs.push({ block: b, count: 1 });
  });
  return runs;
}
// The painted set, walked: heads in order + the card
// count standing under each head.
function paintedGroups(d) {
  const set = d.querySelector('[data-p609set]');
  if (!set) return null;
  const out = [];
  let cur = null;
  [...set.children].forEach((el) => {
    if (el.hasAttribute('data-p609sethead')) { cur = { block: el.getAttribute('data-p609sethead'), cards: 0, mark: (el.querySelector('.p612collmark') || {}).textContent || '', cls: el.getAttribute('class') || '', chevCls: ((el.querySelector('.p612collmark') || {}).getAttribute ? (el.querySelector('.p612collmark').getAttribute('class') || '') : ''), nameTag: (el.querySelector('h2.sectionhead') || {}).tagName || '', meta: (el.querySelector('.meta') || {}).textContent || '' }; out.push(cur); }
    else if (el.hasAttribute('data-card') && cur) cur.cards++;
  });
  return out;
}
const headEl = (d, block) => d.querySelector('[data-p609sethead="' + block + '"]');

// ---------- F1 ◆ collapsed by default ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const { descs } = await paintRealDay(w);
  const d = w.document;
  const runs = groupRuns(descs);
  const painted = paintedGroups(d);
  check('F1 ◆ collapsed by default: every group head stands (fold order), ZERO track cards paint, every marker reads ▸',
    !!painted && JSON.stringify(painted.map((g) => g.block)) === JSON.stringify(runs.map((r) => r.block))
    && painted.every((g) => g.cards === 0) && painted.every((g) => g.mark === '\u25b8') && runs.length >= 3,
    { painted, runs: runs.map((r) => r.block) });
  w.close();
}

// ---------- F2/F3/F4 ◆ head taps ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const { descs } = await paintRealDay(w);
  const d = w.document;
  const runs = groupRuns(descs);
  const g0 = runs[0], g1 = runs[1], g2 = runs[2];
  click(w, headEl(d, g0.block));
  await sleep(120);
  let painted = paintedGroups(d);
  const byBlock = {}; painted.forEach((g) => { byBlock[g.block] = g; });
  check('F2 ◆ tap head expands THAT group only: its track cards stand, its marker flips to ▾, every other group stays head-only',
    byBlock[g0.block].cards === g0.count && byBlock[g0.block].mark === '\u25be'
    && painted.filter((g) => g.block !== g0.block).every((g) => g.cards === 0),
    { g0: byBlock[g0.block], others: painted.filter((g) => g.block !== g0.block).map((g) => g.cards) });
  click(w, headEl(d, g1.block));
  await sleep(120);
  click(w, headEl(d, g0.block));
  await sleep(120);
  painted = paintedGroups(d);
  const byBlock2 = {}; painted.forEach((g) => { byBlock2[g.block] = g; });
  check('F3+F4 ◆ tap again collapses; groups are independent: the second group stands expanded while the first re-collapses',
    byBlock2[g0.block].cards === 0 && byBlock2[g0.block].mark === '\u25b8' && byBlock2[g1.block].cards === g1.count,
    { g0: byBlock2[g0.block], g1: byBlock2[g1.block], g2: byBlock2[g2.block] });
  w.close();
}

// ---------- F5 ◆ Expand all / Collapse all (the ⋮ menu acts) ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const { descs } = await paintRealDay(w);
  const O = w.__opn, d = w.document;
  const runs = groupRuns(descs);
  // A session tap first: Expand all must CLEAR it.
  click(w, headEl(d, runs[0].block));
  await sleep(120);
  O.state.tab = 'prayers';
  O.openHeaderMenu();
  await sleep(80);
  const items = [...d.querySelectorAll('[data-menuitem]')];
  const expItem = items.find((b) => b.textContent.includes('Expand all'));
  const colItem0 = items.find((b) => b.textContent.includes('Collapse all'));
  check('F5a the fold items stand again in the header ⋮ menu (Expand all · Collapse all)', !!expItem && !!colItem0);
  if (expItem) click(w, expItem);
  await sleep(150);
  let painted = paintedGroups(d);
  check('F5b Expand all: stored mode written "expanded", session map CLEARED, every group paints its tracks',
    w.localStorage.getItem(MODE_KEY) === 'expanded' && Object.keys(O.opnFoldSessionNow()).length === 0
    && !!painted && painted.every((g, i) => g.cards === runs[i].count),
    { mode: w.localStorage.getItem(MODE_KEY), session: O.opnFoldSessionNow(), painted: painted && painted.map((g) => g.cards), runs: runs.map((r) => r.count) });
  O.state.tab = 'prayers';
  O.openHeaderMenu();
  await sleep(80);
  const colItem = [...d.querySelectorAll('[data-menuitem]')].find((b) => b.textContent.includes('Collapse all'));
  if (colItem) click(w, colItem);
  await sleep(150);
  painted = paintedGroups(d);
  check('F5c Collapse all: stored mode written "collapsed", session map cleared, every group head-only',
    w.localStorage.getItem(MODE_KEY) === 'collapsed' && Object.keys(O.opnFoldSessionNow()).length === 0
    && !!painted && painted.every((g) => g.cards === 0),
    { mode: w.localStorage.getItem(MODE_KEY), painted: painted && painted.map((g) => g.cards) });
  w.close();
}

// ---------- F6 ◆ mode persists, taps do not ----------
{
  // The reset flag stands in this store: a device that
  // already ran the v612 build (its one-time reset is
  // spent — F11/F12 below leg the reset itself).
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN), [MODE_KEY]: 'expanded', 'opn-praylistmode-v612-reset': '1' });
  await sleep(400);
  const { descs } = await paintRealDay(w);
  const runs = groupRuns(descs);
  const painted = paintedGroups(w.document);
  check('F6a stored mode "expanded" + fresh session: every group expanded at first paint',
    !!painted && painted.every((g, i) => g.cards === runs[i].count), { painted: painted && painted.map((g) => g.cards) });
  w.close();
}
{
  // World A: stored 'collapsed', a session tap expands
  // one group. World B: a FRESH world over world A's
  // localStorage (the mode key persists; the session map
  // is per-load memory and does not) — collapsed again.
  const wA = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN), [MODE_KEY]: 'collapsed' });
  await sleep(400);
  const { descs } = await paintRealDay(wA);
  const runs = groupRuns(descs);
  click(wA, headEl(wA.document, runs[0].block));
  await sleep(120);
  const storeB = {};
  for (let i = 0; i < wA.localStorage.length; i++) { const k = wA.localStorage.key(i); storeB[k] = wA.localStorage.getItem(k); }
  const tappedStood = paintedGroups(wA.document)[0].cards === runs[0].count;
  wA.close();
  const wB = makeWorld(appJs, storeB);
  await sleep(400);
  await paintRealDay(wB);
  const paintedB = paintedGroups(wB.document);
  check('F6b session taps do not persist: the tap stood in its session; a fresh open over the same store derives collapsed from the stored mode',
    tappedStood && storeB[MODE_KEY] === 'collapsed' && !!paintedB && paintedB.every((g) => g.cards === 0),
    { mode: storeB[MODE_KEY], paintedB: paintedB && paintedB.map((g) => g.cards) });
  wB.close();
}

// ---------- F7 ◆ Play All: the fold gates paint only ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  click(w, d.querySelector('[data-queue="__all"]'));
  await sleep(200);
  const queueCollapsed = (O.state.queue || []).map((t) => t.episodeId);
  O.state.queue = []; O.state.queueIdx = -1; O.state.current = null;
  // Expand all through the menu act, then Play All again.
  O.state.tab = 'prayers';
  O.openHeaderMenu();
  await sleep(80);
  const expItem = [...d.querySelectorAll('[data-menuitem]')].find((b) => b.textContent.includes('Expand all'));
  if (expItem) click(w, expItem);
  await sleep(150);
  click(w, d.querySelector('[data-queue="__all"]'));
  await sleep(200);
  const queueExpanded = (O.state.queue || []).map((t) => t.episodeId);
  check('F7 ◆ Play All with every group collapsed queues the WHOLE day, identical (count + order) to the all-expanded queue',
    queueCollapsed.length > 0 && JSON.stringify(queueCollapsed) === JSON.stringify(queueExpanded),
    { collapsed: queueCollapsed.length, expanded: queueExpanded.length, descs: descs.length });
  w.close();
}

// ---------- F8 ◆ vault-locked cold open ----------
let envelope = null, rawKeyB64 = null;
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  O.opnDoc();
  await O.opnVaultCreate(PIN, 'RECOVERY-CODE-1');
  envelope = w.localStorage.getItem(DATA_KEY);
  rawKeyB64 = O.opnRawKeyB64();
  check('F8a the envelope is built from his real document by the client\u2019s own vault create', !!envelope && !!rawKeyB64);
  w.close();
}
{
  // The fingerprint prompt is DISMISSED in this world,
  // so the vault stands locked across the F8b reads (a
  // resolving bridge would unlock mid-leg — the v609vault
  // F2/F3 split). F8c then unlocks by the PIN route.
  const { plugin } = bridgeStub({ status: { available: true, enrolled: true }, unlock: () => Promise.reject(new Error('user-cancelled: 13')) });
  const w = makeWorld(appJs, { [DATA_KEY]: envelope }, plugin);
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  await sleep(1800);
  const d = w.document;
  check('F8b ◆ locked cold open: the GATE stands, no set paints, and NO fold state is read or written (mode key absent, session map empty)',
    O.opnVaultLocked() === true && !!d.querySelector('[data-p609lock]') && !d.querySelector('[data-p609set]')
    && w.localStorage.getItem(MODE_KEY) === null && Object.keys(O.opnFoldSessionNow()).length === 0,
    { set: !!d.querySelector('[data-p609set]'), mode: w.localStorage.getItem(MODE_KEY) });
  // Unlock by the vault's own PIN path (opnVaultUnlock-
  // WithPin — the /api/pin/verify route reads a different
  // PIN store and 409s against a vault-only envelope).
  let unlockErr = '';
  try { await O.opnVaultUnlockWithPin(PIN); } catch (e) { unlockErr = String((e && e.message) || e); }
  const unlocked = !unlockErr && !O.opnVaultLocked();
  const { descs } = unlocked ? await paintRealDay(w) : { descs: [] };
  const painted = paintedGroups(d);
  check('F8c after unlock the repaint paints the set folded per the standing mode (collapsed default: heads stand, zero cards)',
    unlocked && !!painted && painted.length === groupRuns(descs).length && painted.every((g) => g.cards === 0),
    { unlocked, painted: painted && painted.map((g) => g.cards) });
  w.close();
}

// ---------- F9 ◆ the edit form ignores the fold ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN), [MODE_KEY]: 'collapsed' });
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintRealDay(w);
  click(w, headEl(d, 'Morning')); // a session fold state stands, too
  await sleep(120);
  click(w, d.querySelector('[data-p607edit]'));
  const formStood = await until(() => d.querySelector('[data-p604erow]'), 9000);
  const groupsWithRows = new Set([...d.querySelectorAll('[data-p604erow]')].map((r) => { const g = r.closest('[data-p604exp]'); return g ? g.getAttribute('data-p604exp') : null; }));
  check('F9 ◆ edit form untouched: with stored mode "collapsed" (and a session tap standing), the form paints rows in full across its groups',
    formStood && groupsWithRows.size >= 3 && !d.querySelector('[data-p609set]:not(.p609edit) [data-card]'),
    { groups: [...groupsWithRows] });
  w.close();
}

// ---------- F10 ◆ the head dress = the Favorites head dress ----------
{
  const w = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const { descs } = await paintRealDay(w);
  const runs = groupRuns(descs);
  const painted = paintedGroups(w.document);
  check('F10 ◆ head dress mirrors the Favorites folder head: favfolder-head row · favfolder-chev marker · the name as h2.sectionhead · the group count as the meta',
    !!painted && painted.every((g, i) => g.cls.includes('favfolder-head') && g.chevCls.includes('favfolder-chev') && g.nameTag === 'H2' && g.meta === String(runs[i].count)),
    painted && painted.map((g) => ({ cls: g.cls, chev: g.chevCls, tag: g.nameTag, meta: g.meta })));
  w.close();
}

// ---------- F11/F12 ◆ the one-time mode reset (approved) ----------
{
  // A v604-era device: stored mode 'expanded', NO reset
  // flag. First open on the v612 build must stand
  // collapsed, the mode rewritten, the flag written.
  const wA = makeWorld(appJs, { [DATA_KEY]: JSON.stringify(JOHN), [MODE_KEY]: 'expanded' });
  await sleep(400);
  await paintRealDay(wA);
  const paintedA = paintedGroups(wA.document);
  check('F11 ◆ first run of the v612 build: a stored "expanded" is reset ONCE — the set stands collapsed, the mode key reads "collapsed", the reset flag stands',
    !!paintedA && paintedA.every((g) => g.cards === 0)
    && wA.localStorage.getItem(MODE_KEY) === 'collapsed' && wA.localStorage.getItem('opn-praylistmode-v612-reset') === '1',
    { mode: wA.localStorage.getItem(MODE_KEY), flag: wA.localStorage.getItem('opn-praylistmode-v612-reset'), cards: paintedA && paintedA.map((g) => g.cards) });
  const storeB = {};
  for (let i = 0; i < wA.localStorage.length; i++) { const k = wA.localStorage.key(i); storeB[k] = wA.localStorage.getItem(k); }
  wA.close();
  // His later choice: Expand all writes 'expanded' AFTER
  // the reset. A second open honors it — no second reset.
  storeB[MODE_KEY] = 'expanded';
  const wB = makeWorld(appJs, storeB);
  await sleep(400);
  const { descs } = await paintRealDay(wB);
  const runs = groupRuns(descs);
  const paintedB = paintedGroups(wB.document);
  check('F12 ◆ the reset fires once only: a later "expanded" choice stands untouched on the next open (every group expanded, mode still "expanded")',
    !!paintedB && paintedB.every((g, i) => g.cards === runs[i].count) && wB.localStorage.getItem(MODE_KEY) === 'expanded',
    { mode: wB.localStorage.getItem(MODE_KEY), cards: paintedB && paintedB.map((g) => g.cards) });
  wB.close();
}

// ---------- OA ◆ fail-on-old (the v609-3 tree, 6d3c65e) ----------
{
  const w = makeWorld(oldJs, { [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const painted = paintedGroups(d);
  check('OA1 ◆ fail-on-old: F1 on the v609-3 client — ALL tracks paint (no fold exists)',
    !!painted && painted.reduce((n, g) => n + g.cards, 0) === descs.length && descs.length > 0,
    { cards: painted && painted.reduce((n, g) => n + g.cards, 0), descs: descs.length });
  const runs = groupRuns(descs);
  click(w, headEl(d, runs[0].block));
  await sleep(120);
  const painted2 = paintedGroups(d);
  check('OA2 ◆ fail-on-old: F2 on the v609-3 client — a head tap is INERT (the paint stands unchanged)',
    !!painted2 && painted2.reduce((n, g) => n + g.cards, 0) === descs.length,
    { cards: painted2 && painted2.reduce((n, g) => n + g.cards, 0) });
  O.state.tab = 'prayers';
  O.openHeaderMenu();
  await sleep(80);
  const items = [...d.querySelectorAll('[data-menuitem]')];
  check('OA3 ◆ fail-on-old: F5 on the v609-3 client — NO Expand all / Collapse all items stand in the menu',
    !items.some((b) => b.textContent.includes('Expand all')) && !items.some((b) => b.textContent.includes('Collapse all')));
  w.close();
}

console.log('harness-v612:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
