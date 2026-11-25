// harness-v610.mjs — v610: Divine Office naming + duplicates.
//  N ◆ specific names: the contents universe labels every
//     Divine Office item with its own hour's name (Invitatory ·
//     Morning Prayer · Office of Readings · …) — no item stands
//     under the bare provider name 'Divine Office'.
//  D ◆ duplicates allowed (office-scoped): both contents
//     validators keep a second copy of a Divine Office source
//     selector (and still dedupe everything else); the fold
//     emits one descriptor per contents occurrence, at its
//     contents position, copies stamped as occurrences; each
//     copy carries its own card key, played mark, and draw key;
//     the Add ladder offers a standing office hour again.
// FAIL-ON-OLD: the ◆ legs' key assertions run against the old
//  tree (git main = v609) in the OA companions and must fail.
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
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
// v610 ship: pinned to the v609 repair 2 ship tree (6d3c65e) — the OA
// legs' "old" is the pre-v610 client; the moving main ref outgrew that
// meaning the moment v610 merged. Assertions untouched.
const oldClientSrc = git(['show', '6d3c65e:app/worker/src/client.ts']);
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const SETTINGS = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAYFIX = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

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
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v610:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { openConfigureLadder593, opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, profContentsUniverse590, opnCheckContents590, descMarkKey, descCardKey, trackKeyOf, isPlayedDesc, writePlayed, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, opn604: (typeof opn604 !== "undefined" ? opn604 : null) };';
const OLD_HOOK = HOOK.replace('descMarkKey, descCardKey, ', '').replace('isPlayedDesc, ', '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(JSON.stringify(DAYFIX));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function makeWorld(js, store, hook) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + (hook || HOOK);
  w.document.body.appendChild(s);
  return w;
}
function johnStore() { const st = {}; st[DATA_KEY] = JSON.stringify(JSON.parse(JSON.stringify(JOHN))); return st; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }

// ---------- server validator extraction (v597/v603 recipe) ----------
function extractServerFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('server fn not found: ' + name);
  const nl = src.indexOf('\n', start);
  let i = src.lastIndexOf('{', nl);
  let depth = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(start, j + 1);
}
function stripServerValidate(src) {
  let f = extractServerFn(src, 'validateProfileContents');
  const reps = [
    ['function validateProfileContents(contents: unknown, coreBlocks: string[]): { normalized?: Record<string, { kind: string; key?: string; side?: string }[]> } | { error: string } {', 'function validateProfileContents(contents, coreBlocks) {'],
    ['const out: Record<string, { kind: string; key?: string; side?: string }[]> = {};', 'const out = {};'],
    ['Object.entries(contents as Record<string, unknown>)', 'Object.entries(contents)'],
    ['const seen = new Set<string>();', 'const seen = new Set();'],
    ['const list: { kind: string; key?: string; side?: string }[] = [];', 'const list = [];'],
    ['const it = (raw && typeof raw === "object" ? raw : {}) as { kind?: unknown; key?: unknown; side?: unknown };', 'const it = (raw && typeof raw === "object" ? raw : {});'],
    ['list.push(side670 ? { kind: kind as string, key: key as string, side: side670 } : { kind: kind as string, key: key as string });', 'list.push(side670 ? { kind: kind, key: key, side: side670 } : { kind: kind, key: key });'],
    // v610 ship (merge with v609 repair 2): the '.includes(key as string)'
    // strip anchor stood in the old four-key course check, which repair 2
    // generalized away — the extracted fn carries no such cast now, so
    // there is nothing to strip. Assertions untouched.
  ];
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error('server validate shape moved: ' + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
const stripSide670 = (f) => f.split('let side670: string | undefined;').join('let side670;');
const serverValidate = new Function(stripSide670(stripServerValidate(indexSrc)) + '\nreturn validateProfileContents;')();

// ---------- standings builder (v603 recipe) ----------
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0('2026-11-21');
  const prim = {};
  (SETTINGS.sources || []).forEach((s) => { if (s.family === 'external' && s.slotId && s.role !== 'fallback') prim[s.slotId] = s; });
  const standing = [];
  O.EXT_SLOTS.forEach((s) => { const row = prim[s.slotId]; if (row && row.enabled === 1 && O.extDayRulePasses(row.dayRule || 'daily', wd)) standing.push({ slotId: s.slotId, title: s.title, block: row.block || 'Morning', sortOrder: row.sortOrder, source: s.source || 'Divine Office' }); });
  O.state.extStanding = standing;
  const own = [];
  (SETTINGS.sources || []).forEach((s) => { if (s.family === 'own' && O.OWN_ROW_EPISODE[s.sourceKey]) own.push({ sourceKey: s.sourceKey, episodeId: O.OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled }); });
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0));
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
  return standing;
}
function foldWithContents(w, contents) {
  const O = w.__opn;
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAYFIX)));
  if (contents) day.profile = Object.assign({}, day.profile, { contents });
  O.state.dayPayload = day;
  return O.extRebuildDescs(day) || [];
}
const DO_DUP = [{ kind: 'source', key: 'ext-morning-prayer' }, { kind: 'source', key: 'ext-morning-prayer' }];

// ---------- OA ◆ fail-on-old companions (old = v609 on main) ----------
{
  const w = makeWorld(oldJs, johnStore(), OLD_HOOK);
  await sleep(400);
  const O = w.__opn;
  buildStanding(w);
  const uni = O.profContentsUniverse590('Morning');
  check('OA1 ◆ fail-on-old: the v609 universe labels every office item "Divine Office"',
    uni.filter((x) => x.kind === 'source' && String(x.key).startsWith('ext-')).every((x) => x.label === 'Divine Office'),
    uni.map((x) => x.label));
  let kept = -1;
  try { kept = O.opnCheckContents590({ Morning: JSON.parse(JSON.stringify(DO_DUP)) }, ['Morning']).Morning.length; } catch (e) {}
  check('OA2 ◆ fail-on-old: the v609 validator DROPS the duplicate office selector', kept === 1, { kept });
  const descs = foldWithContents(w, { Morning: [{ kind: 'source', key: 'ext-morning-prayer' }, { kind: 'source', key: 'ext-invitatory' }, { kind: 'source', key: 'ext-morning-prayer' }] });
  const mps = descs.filter((x) => x.episodeId === 'ext-morning-prayer');
  check('OA3 ◆ fail-on-old: the v609 fold emits ONE Morning Prayer however many copies stand', mps.length === 1, { n: mps.length });
  w.close();
}

// ---------- N ◆ specific names ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const O = w.__opn;
  buildStanding(w);
  const mUni = O.profContentsUniverse590('Morning');
  const eUni = O.profContentsUniverse590('Evening');
  const extLabels = mUni.concat(eUni).filter((x) => x.kind === 'source' && String(x.key).startsWith('ext-')).map((x) => x.label);
  check('N1 ◆ the universe labels each office item with its SPECIFIC name; none reads bare "Divine Office"',
    extLabels.includes('Invitatory') && extLabels.includes('Morning Prayer') && extLabels.includes('Office of Readings') && extLabels.includes('Evening Prayer')
    && !extLabels.includes('Divine Office'), extLabels);
  const descs = foldWithContents(w, null);
  const extTitles = descs.filter((x) => /^ext-/.test(x.episodeId || '')).map((x) => x.title);
  check('N2 ◆ the folded day carries the specific hour titles (≥6 distinct), none the bare provider name',
    new Set(extTitles).size >= 6 && !extTitles.includes('Divine Office'), extTitles);
  w.close();
}

// ---------- D1 ◆ the validators ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const O = w.__opn;
  const cDup = O.opnCheckContents590({ Morning: JSON.parse(JSON.stringify(DO_DUP)) }, ['Morning']);
  check('D1a ◆ the client validator KEEPS both copies of a Divine Office selector', cDup.Morning.length === 2, cDup.Morning);
  const sDup = serverValidate({ Morning: JSON.parse(JSON.stringify(DO_DUP)) }, ['Morning']);
  check('D1b ◆ the server validator KEEPS both copies (parity)', !sDup.error && sDup.normalized.Morning.length === 2, sDup);
  const cOwn = O.opnCheckContents590({ Morning: [{ kind: 'source', key: 'daily-rosary' }, { kind: 'source', key: 'daily-rosary' }] }, ['Morning']);
  const sOwn = serverValidate({ Morning: [{ kind: 'source', key: 'daily-rosary' }, { kind: 'source', key: 'daily-rosary' }] }, ['Morning']);
  check('D1c ◆ the scoped rule\'s other leg: a duplicate OWN source still dedupes in both validators',
    cOwn.Morning.length === 1 && !sOwn.error && sOwn.normalized.Morning.length === 1, { c: cOwn.Morning.length, s: sOwn.normalized && sOwn.normalized.Morning.length });
  const cPr = O.opnCheckContents590({ Morning: [{ kind: 'prayer', key: 'angelus' }, { kind: 'prayer', key: 'angelus' }] }, ['Morning']);
  check('D1d ◆ a duplicate PRAYER still dedupes (the widening stops at the office)', cPr.Morning.length === 1, cPr.Morning);
  w.close();
}

// ---------- D2/D3 ◆ the fold, the marks, the draws ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const O = w.__opn;
  buildStanding(w);
  const descs = foldWithContents(w, { Morning: [{ kind: 'source', key: 'ext-morning-prayer' }, { kind: 'source', key: 'ext-invitatory' }, { kind: 'source', key: 'ext-morning-prayer' }] });
  const morn = descs.filter((x) => x.block === 'Morning' && /^ext-/.test(x.episodeId || ''));
  check('D2 ◆ the fold emits BOTH copies at their contents positions (Morning Prayer · Invitatory · Morning Prayer)',
    morn.length === 3 && morn[0].title === 'Morning Prayer' && morn[1].title === 'Invitatory' && morn[2].title === 'Morning Prayer',
    morn.map((x) => x.title));
  const copies = descs.filter((x) => x.episodeId === 'ext-morning-prayer');
  check('D2b ◆ the copies are distinct tracks: occurrence stamps + card keys differ',
    copies.length === 2 && !copies[0]._occ && copies[1]._occ === 1 && O.descCardKey(copies[0]) !== O.descCardKey(copies[1]),
    copies.map((x) => ({ occ: x._occ || 0, ck: O.descCardKey(x) })));
  check('D3a ◆ each copy draws its OWN intention key', O.trackKeyOf(copies[0]) !== O.trackKeyOf(copies[1]),
    { a: O.trackKeyOf(copies[0]), b: O.trackKeyOf(copies[1]) });
  const date = '2026-11-21';
  O.writePlayed(copies[1].episodeId, date, 'marked', copies[1].block, copies[1]._occ || 0);
  check('D3b ◆ each copy carries its OWN played mark (marking copy 2 leaves copy 1 unplayed)',
    O.isPlayedDesc(copies[1], date) === true && O.isPlayedDesc(copies[0], date) === false,
    { c1: O.isPlayedDesc(copies[0], date), c2: O.isPlayedDesc(copies[1], date) });
  w.close();
}

// ---------- D4 ◆ the Add ladder offers a standing hour again ----------
function publicDay(date) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: [{ episodeId: b + '-t0', title: b + ' track', state: 'present', available: true, streamUrl: 'https://example.invalid/' + b + '.mp3', durationS: 60 }],
    trackCount: 1,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function paintHome(w) {
  const O = w.__opn;
  const paint = () => {
    const day = O.opnFoldDay590(publicDay(TODAY));
    O.state.dayPayload = day;
    O.paintPrayersView(day);
    return day;
  };
  const day = paint();
  await sleep(600);
  paint();
  return day;
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  click(w, d.querySelector('[data-p607edit]'));
  const asked = await until(() => d.querySelector('.p604q'), 9000);
  if (asked) {
    const row = [...d.querySelectorAll('[data-p604scope]')].find((r) => r.getAttribute('data-p604scope') === 'today');
    if (row) click(w, row);
  }
  await until(() => d.querySelector('[data-p604erow]'), 9000);
  const morningGroup = d.querySelector('[data-p609ghead="Morning"]');
  const groupEl = morningGroup ? morningGroup.closest('.p609group') : null;
  const addBtn = groupEl ? groupEl.querySelector('[data-p604add]') : null;
  check('D4a the Morning group stands in the form with its Add act', !!addBtn);
  if (addBtn) {
    click(w, addBtn);
    await until(() => d.querySelector('[data-p603door="sources"]'), 9000);
    const door = d.querySelector('[data-p603door="sources"]');
    if (door) click(w, door);
    await until(() => [...d.querySelectorAll('[data-p603additem]')].length > 0 || d.querySelector('.profadd-on603'), 9000);
    const rows = [...d.querySelectorAll('.profaddladder603 .bookrow')];
    const mpRows = rows.filter((r) => r.textContent.includes('Morning Prayer'));
    const mpRow = mpRows.find((r) => r.hasAttribute('data-p603additem'));
    const rosaryRow = rows.find((r) => r.textContent.includes('Daily Rosary'));
    check('D4b ◆ the standing office Morning Prayer stands TAPPABLE in the Sources rung under its specific name (a second "Morning Prayer" row beside the own one; not "Already in", not "Divine Office")',
      mpRows.length === 2 && !!mpRow && !mpRow.textContent.includes('Divine Office'),
      mpRows.map((r) => r.textContent.slice(0, 40)));
    check('D4c ◆ a standing OWN source still reads "Already in" and is not tappable',
      !!rosaryRow && !rosaryRow.hasAttribute('data-p603additem') && rosaryRow.textContent.includes('Already in'),
      rosaryRow ? rosaryRow.textContent.slice(0, 80) : 'no row');
    if (mpRow && mpRow.hasAttribute('data-p603additem')) {
      click(w, mpRow);
      const two = await until(async () => {
        const res = await profilesPayload(w);
        const c = res && res.todayEdit && res.todayEdit.contents && res.todayEdit.contents.Morning;
        return !!c && c.filter((x) => x.kind === 'source' && x.key === 'ext-morning-prayer').length === 2;
      }, 9000);
      check('D4d ◆ the pick lands: the today layer\'s Morning contents carry Morning Prayer TWICE (the write kept the duplicate)', two);
    } else check('D4d ◆ the pick lands: the today layer\'s Morning contents carry Morning Prayer TWICE', false, 'row not tappable');
  }
  w.close();
}

console.log('harness-v610:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
