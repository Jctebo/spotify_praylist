// harness-v603.mjs — v603: Add becomes a ladder.
//  T  statics: the one ladder builder · the flat pickers
//     retired · the validators + read seam re-opened for
//     the four keys (client + server) · the resolver +
//     its call + the placement leg restored · the guard
//     (universe + standing contents offer no courses) ·
//     the rendered client parses whole · SW pin unmoved
//     pre-Ship.
//  E  validator parity (client vs extracted server) over
//     a battery: a standing course key is KEPT on both
//     folds; a foreign course key errors on both.
//  V  VM legs: the read seam passes a standing course
//     and filters a foreign one · save + reload through
//     the real local API keeps a hand-added course ·
//     defaults + Reset carry no courses.
//  R  REAL-DOM legs (jsdom) over production fixtures
//     (John's v589 document · the served prayer book ·
//     the novenas catalog · the podcasts index · the
//     v589 production Bible payload, core-folded): the
//     ladder opens from BOTH editors with the door set /
//     order per block kind · Prayers descend with the
//     served counts · a hand-added course stands, saves,
//     and RESOLVES in the composed day to Day 322 (the
//     next episode by his own progress) · search: head
//     grouped with paths · in-category narrowing ·
//     clearing restores · already-standing marked, its
//     tap writes nothing · an Edit today pick lands in
//     the DRAFT and writes only at Save today · the
//     locked-vault world: the gate stands, no ladder.
//  A  equivalence: the day composed without a
//     hand-added course is byte-identical to the
//     pre-v603 ship (the v601 compose recipe).
// Fixtures from production only (Improvement D): John's
// import file · tests/fixtures-v603/ (book, novenas
// catalog, podcasts index — fetched from the live served
// endpoints 2026-11-21; the Bible payload derived from
// tests/fixtures-v589's production snapshot + listens).
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
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';

// ---------- T statics ----------
check('T1 the one ladder builder stands and both Add acts route to it',
  clientSrc.includes('function openAddLadder603(block, host)')
  && (clientSrc.match(/openAddLadder603\(block, \{/g) || []).length === 2);
check('T2 the flat pickers are retired (no flat add-item attributes stand)',
  !clientSrc.includes('data-p591additem') && !clientSrc.includes('data-p594tadditem'));
check('T3 the doors stand in the approved order in the builder (Courses · Prayers · Sources; Novenas alone for its block)',
  clientSrc.indexOf("doorHtml('courses'") > 0
  && clientSrc.indexOf("doorHtml('courses'") < clientSrc.indexOf("doorHtml('prayers'")
  && clientSrc.indexOf("doorHtml('prayers'") < clientSrc.indexOf("doorHtml('sources'")
  && clientSrc.includes("doorHtml('novenas', 'Novenas'"));
check('T4 Q3 stands: already-standing items paint marked and carry no tap attribute',
  clientSrc.includes("'Already in ' + esc(block)") && clientSrc.includes('profadd-on603'));
check('T5 the client validator re-opens for the four keys and errors on any other course key — SUPERSEDED at v609 repair 2: any non-empty series key validates, a keyless course errors',
  clientSrc.includes("var OPN_COURSE_KEYS_603 = ['catechism-in-a-year', 'bible-in-a-year', 'rosary-in-a-year', 'summa-in-a-year']")
  && clientSrc.includes("if (typeof key !== 'string' || !key) throw opnErr(400, 'bad course ' + key);")
  && !clientSrc.includes("if (kind === 'course') return;"));
check('T6 the read seam passes a standing course and filters a foreign one — SUPERSEDED at v609 repair 2: any keyed course passes, a keyless one filters',
  clientSrc.includes("it.kind !== 'course' || (typeof it.key === 'string' && !!it.key)"));
check('T7 the server validator mirrors the rule — v609 repair 2: mirrors the generalized rule (any keyed series kept, keyless an error)',
  indexSrc.includes('if (kind === "course") {')
  && indexSrc.includes('if (typeof key !== "string" || !key) return { error: `bad course ${String(key)}` };')
  && !indexSrc.includes('if (kind === "course") continue;'));
check('T8 the resolver is restored whole: the function, the buildDayFromPayload call, the placement leg',
  clientSrc.includes('function resolveProfileCourses590(day)')
  && (clientSrc.match(/resolveProfileCourses590\(day\)/g) || []).length >= 2
  && clientSrc.includes('state.courseRes590') && clientSrc.includes('course590: true'));
{
  const u = clientSrc.slice(clientSrc.indexOf('function profContentsUniverse590'), clientSrc.indexOf('function profVaultGate594'));
  check('T9 GUARD: the contents universe offers no course selectors (defaults + Reset stay courseless by construction)',
    !u.includes("kind: 'course'") && !u.includes('OPN_COURSE_KEYS_603'), u.slice(0, 200));
}
check('T10 the book groups stand whole beside the flat list (both loaders)',
  (clientSrc.match(/bookGroups = \[\];/g) || []).length >= 2 && clientSrc.includes('g.category'));
const pinOf = (src) => (src.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
check('T11 SW pin unmoved vs main pre-Ship', pinOf(uiSrc) === pinOf(git(['show', 'main:app/worker/src/ui.ts'])), { cand: pinOf(uiSrc), main: pinOf(git(['show', 'main:app/worker/src/ui.ts'])) });
check('T13 Review fix statics: the fold reads kind novena (the contents-order selection + the gate stands the row on a named item)',
  clientSrc.includes('function opnNovenaMetas603(contents, tracks)')
  && clientSrc.includes("return it.kind === 'all-novenas' || it.kind === 'novena';")
  && clientSrc.includes("metas = opnNovenaMetas603(c590, st.tracks)"));

// ---------- render APP_JS ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T12 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

// ---------- server validator extraction (v597 recipe) ----------
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
    ['function validateProfileContents(contents: unknown, coreBlocks: string[]): { normalized?: Record<string, { kind: string; key?: string }[]> } | { error: string } {', 'function validateProfileContents(contents, coreBlocks) {'],
    ['const out: Record<string, { kind: string; key?: string }[]> = {};', 'const out = {};'],
    ['Object.entries(contents as Record<string, unknown>)', 'Object.entries(contents)'],
    ['const seen = new Set<string>();', 'const seen = new Set();'],
    ['const list: { kind: string; key?: string }[] = [];', 'const list = [];'],
    ['const it = (raw && typeof raw === "object" ? raw : {}) as { kind?: unknown; key?: unknown };', 'const it = (raw && typeof raw === "object" ? raw : {});'],
    ['list.push({ kind: kind as string, key: key as string });', 'list.push({ kind: kind, key: key });'],
    // v609 repair 2: the server course check no longer
    // routes through .includes(key as string) (any keyed
    // series validates) — that normalization retires.
  ];
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error('server validate shape moved: ' + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
const serverValidate = new Function(stripServerValidate(indexSrc) + '\nreturn validateProfileContents;')();

// ---------- worlds ----------
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v603:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { openConfigureLadder593, openProfilesScreen, openEditTodayScreen594, opnLocalApi, opnMode, state, opnCheckContents590, opnContentsOf590, opnStandingContents597, profContentsUniverse590, extRebuildDescs, opnFoldDay590, opnExportText, opnRestoreFromText, resolveProfileCourses590, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=bible-in-a-year')) body = BIBLE;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function makeDomWorld(store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore() { const st = {}; st[DATA_KEY] = JSON.stringify(JSON.parse(JSON.stringify(JOHN))); return st; }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function type(w, inp, text) { inp.value = text; inp.dispatchEvent(new w.Event('input', { bubbles: true })); }
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }
function docOf(w) { return JSON.parse(w.localStorage.getItem(DATA_KEY)); }

// ---------- E: validator parity ----------
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const core = ['Morning', 'Midday', 'Evening', 'Night'];
  const battery = [
    { Morning: [{ kind: 'course', key: 'bible-in-a-year' }, { kind: 'source', key: 'abc' }] },
    { Morning: [{ kind: 'course', key: 'not-a-course' }] },
    { Morning: [{ kind: 'course', key: 'summa-in-a-year' }, { kind: 'course', key: 'summa-in-a-year' }] },
    { Novenas: [{ kind: 'all-novenas' }] },
    { Novenas: [{ kind: 'novena', key: 'christ_the_king' }, { kind: 'all-novenas' }] },
  ];
  let agree = true, kept = false;
  for (const item of battery) {
    let cOut, cErr = null;
    try { cOut = O.opnCheckContents590(JSON.parse(JSON.stringify(item)), core); } catch (e) { cErr = String(e && e.message || e); }
    const sOut = serverValidate(JSON.parse(JSON.stringify(item)), core);
    const cNorm = cErr ? { error: cErr } : { normalized: cOut };
    if (JSON.stringify(cNorm) !== JSON.stringify(sOut)) { agree = false; console.log('parity diff:', JSON.stringify(item), 'client:', JSON.stringify(cNorm), 'server:', JSON.stringify(sOut)); }
    if (JSON.stringify(cOut || {}).includes('"course"')) kept = true;
  }
  check('E1 validator parity: client == server over the battery (v609 repair 2: any keyed series kept on both sides, duplicates deduped)', agree && kept, { agree, kept });
  const seam = O.opnContentsOf590({ contents: { Morning: [{ kind: 'course', key: 'bible-in-a-year' }, { kind: 'course', key: 'foreign' }, { kind: 'course' }, { kind: 'source', key: 'abc' }] } });
  check('E2 the read seam passes keyed courses and filters the keyless one (v609 repair 2)',
    !!seam && seam.Morning.length === 3 && seam.Morning[0].kind === 'course' && seam.Morning[1].kind === 'course' && seam.Morning[2].kind === 'source', seam);
  w.close();
}

// ---------- V: save + reload + the guard ----------
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const save = await O.opnLocalApi('/api/prayer/profiles/save', { method: 'PUT', body: JSON.stringify({ name: 'Course Probe', basedOn: 'salesian', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: true, series: ['daily-readings'] } }, contents: { Morning: [{ kind: 'course', key: 'bible-in-a-year' }, { kind: 'seat', key: 'daily-readings' }] } }) }, 'device');
  const prof = (save.profiles || []).find((p) => p.name === 'Course Probe');
  check('V1 a hand-added course survives the save (validator + read seam, end to end)',
    !!prof && JSON.stringify(prof.contents && prof.contents.Morning || []).includes('"course"'), prof && prof.contents);
  const text = await O.opnExportText();
  const w2 = makeDomWorld({});
  await sleep(300);
  await w2.__opn.opnRestoreFromText(text);
  const p2 = await profilesPayload(w2);
  const prof2 = (p2.profiles || []).find((p) => p.name === 'Course Probe');
  check('V2 the course survives export + restore in a fresh world (reload)',
    !!prof2 && JSON.stringify(prof2.contents && prof2.contents.Morning || []).includes('bible-in-a-year'), prof2 && prof2.contents);
  w.close(); w2.close();
}
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  let courseless = true;
  const payload = await profilesPayload(w);
  (payload.profiles || []).forEach((p) => {
    ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Novenas'].forEach((b) => {
      O.opnStandingContents597(p, b).forEach((it) => { if (it.kind === 'course') courseless = false; });
    });
  });
  // v609 repair 2 SUPERSEDES the courseless guard: the
  // designed defaults now carry their podcasts as course
  // ITEMS in Night (the migration) — the guard's new form:
  // courses stand ONLY there (Night, the migrated series),
  // never in any other block's standing contents.
  let coursesScoped = true;
  (payload.profiles || []).forEach((p) => {
    ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Novenas'].forEach((b) => {
      O.opnStandingContents597(p, b).forEach((it) => { if (it.kind === 'course') coursesScoped = false; });
    });
  });
  check('V3 GUARD (v609 repair 2 form): no course stands in any block but Night; the migrated defaults carry theirs in Night alone', coursesScoped && !courseless, { courseless });
  const rst = await O.opnLocalApi('/api/prayer/profiles/reset', { method: 'PUT', body: JSON.stringify({ profileKey: 'salesian' }) }, 'device').catch((e) => ({ err: String(e && e.message || e) }));
  const sal = ((rst && rst.profiles) || []).find((p) => p.key === 'salesian');
  check('V4 GUARD (v609 repair 2 form): Reset restores the designed Salesian Way in the migrated shape — its podcasts stand as course items in Night, its seat in Morning',
    !!sal && ((sal.contents || {}).Night || []).filter((it) => it.kind === 'course').length === 2
    && ((sal.contents || {}).Morning || []).some((it) => it.kind === 'seat' && it.key === 'daily-readings')
    && sal.layers.podcasts.on === false && (sal.layers.podcasts.series || []).length === 0, rst.err || (sal && sal.contents));
  w.close();
}

// ---------- R: the ladder in the real editors ----------
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
async function openProfiles(w) {
  w.__opn.openProfilesScreen(null, {});
  return until(() => w.document.querySelector('[data-p591add="Morning"]'));
}
function doorsOf(w) { return [...w.document.querySelectorAll('.profaddladder603 [data-p603door]')].map((e) => e.getAttribute('data-p603door')); }
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  check('R1 Edit profiles opens and the Morning Add stands', await openProfiles(w));
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('.profaddladder603'));
  check('R2 the ladder opens from Edit profiles with doors Courses · Prayers · Sources (Novenas absent for a core block)',
    JSON.stringify(doorsOf(w)) === JSON.stringify(['courses', 'prayers', 'sources']), doorsOf(w));
  // Prayers descent
  click(w, w.document.querySelector('[data-p603door="prayers"]'));
  await sleep(50);
  const groups = [...w.document.querySelectorAll('[data-p603group]')];
  const counts = groups.map((g) => { const m = g.querySelector('.meta'); return g.getAttribute('data-p603group') + ':' + (m ? m.textContent.trim() : ''); });
  check('R3 Prayers descend to the served categories with their counts',
    groups.length === 9 && counts.some((c) => c.startsWith('Daily:24')) && counts.some((c) => c.startsWith('Our Lady:9')) && counts.some((c) => c.startsWith('The Raccolta:8')), counts);
  click(w, groups.find((g) => g.getAttribute('data-p603group') === 'Our Lady'));
  await sleep(50);
  const prs = [...w.document.querySelectorAll('[data-p603additem]')];
  check('R4 the Our Lady rung lists its 9 prayers', prs.length === 9 && prs.every((r) => r.getAttribute('data-p603additem').startsWith('prayer:')), prs.length);
  // in-category search narrowing + clearing
  const inp = w.document.querySelector('[data-p603search]');
  type(w, inp, 'Memorare');
  await sleep(50);
  const narrowed = [...w.document.querySelectorAll('[data-p603additem]')];
  check('R5 inside the category the search narrows that rung only (Memorare stands alone)',
    narrowed.length === 1 && narrowed[0].getAttribute('data-p603additem') === 'prayer:memorare', narrowed.map((r) => r.getAttribute('data-p603additem')));
  type(w, w.document.querySelector('[data-p603search]'), '');
  await sleep(50);
  check('R6 clearing the search restores the rung\u2019s full list', w.document.querySelectorAll('[data-p603additem]').length === 9);
  click(w, w.document.querySelector('[data-p603additem="prayer:memorare"]'));
  await until(() => !w.document.querySelector('.profaddladder603'));
  check('R7 a pick returns to the editor (the ladder closes)', !w.document.querySelector('.profaddladder603'));
  w.close();
}
{
  const w = makeDomWorld(johnStore());
  await sleep(300);
  await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="Novenas"]'));
  await until(() => w.document.querySelector('.profaddladder603'));
  check('R8 for the Novenas block the Novenas door stands alone', JSON.stringify(doorsOf(w)) === JSON.stringify(['novenas']), doorsOf(w));
  click(w, w.document.querySelector('[data-p603door="novenas"]'));
  await sleep(80);
  const rows = [...w.document.querySelectorAll('.profaddladder603 .bookrow')];
  check('R9 the Novenas rung: Every active novena first (already standing — painted marked per Q3), then the catalog (247) in served order',
    rows.length === 248 && rows[0].textContent.includes('Every active novena') && rows[0].textContent.includes('Already in Novenas') && !rows[0].hasAttribute('data-p603additem') && rows[1].getAttribute('data-p603additem') === 'novena:14_holy_helpers', rows.length);
  w.close();
}
{
  // Head search across kinds, grouped with paths named.
  const w = makeDomWorld(johnStore());
  await sleep(300);
  await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('[data-p603search]'));
  type(w, w.document.querySelector('[data-p603search]'), 'Memorare');
  await sleep(50);
  const heads = [...w.document.querySelectorAll('.profaddladder603 .sectionhead')].map((e) => e.textContent.trim());
  const mem = w.document.querySelector('[data-p603additem="prayer:memorare"]');
  check('R10 head search groups matches by kind with the rung path named',
    heads.includes('Prayers') && !!mem && mem.textContent.includes('Prayers › Our Lady'), { heads, mem: mem && mem.textContent });
  type(w, w.document.querySelector('[data-p603search]'), 'Bible in a Year');
  await sleep(50);
  const heads2 = [...w.document.querySelectorAll('.profaddladder603 .sectionhead')].map((e) => e.textContent.trim());
  check('R11 head search finds a course under its own kind head',
    heads2.includes('Courses') && !!w.document.querySelector('[data-p603additem="course:bible-in-a-year"]'), heads2);
  w.close();
}
{
  // Already-standing: marked, not tappable, tap writes nothing.
  const w = makeDomWorld(johnStore());
  await sleep(300);
  await openProfiles(w);
  w.__opn.state.ownStanding = [{ sourceKey: 'daily-rosary', block: 'Morning', title: 'The Daily Rosary', sortOrder: 1 }];
  w.__opn.state.extStanding = [];
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('[data-p603door="sources"]'));
  click(w, w.document.querySelector('[data-p603door="sources"]'));
  await sleep(50);
  const row = [...w.document.querySelectorAll('.profaddladder603 .bookrow')].find((r) => r.textContent.includes('The Daily Rosary'));
  const before = w.localStorage.getItem(DATA_KEY);
  check('R12 an already-standing source paints marked "Already in Morning" and carries no tap',
    !!row && row.textContent.includes('Already in Morning') && !row.hasAttribute('data-p603additem'), row && row.textContent);
  if (row) click(w, row);
  await sleep(50);
  check('R13 tapping the marked row writes nothing (the document is byte-identical, the ladder still stands)',
    w.localStorage.getItem(DATA_KEY) === before && !!w.document.querySelector('.profaddladder603'));
  w.close();
}
{
  // A course added by hand in Edit profiles: stands in the
  // draft, saves, and resolves in the composed day.
  const w = makeDomWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  // John's device state: the v589 import restored (the
  // closing field leg of v589) — the core store holds his
  // 331 listens, so the Bible payload's Current pointer
  // stands at Day 322 by his own progress.
  await O.opnRestoreFromText(JSON.stringify(JOHN_FULL));
  await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('[data-p603door="courses"]'));
  click(w, w.document.querySelector('[data-p603door="courses"]'));
  await sleep(80);
  const crows = [...w.document.querySelectorAll('[data-p603additem]')];
  check('R14 the Courses rung lists the four courses by their served titles',
    crows.length === 4 && crows.some((r) => r.textContent.includes('Bible in a Year')) && crows.some((r) => r.textContent.includes('Summa in a Year')), crows.map((r) => r.textContent.trim()));
  click(w, w.document.querySelector('[data-p603additem="course:bible-in-a-year"]'));
  await until(() => !w.document.querySelector('.profaddladder603'));
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  check('R15 after the pick the editor stands dirty with Save live', !!saveBtn && !saveBtn.disabled);
  click(w, saveBtn);
  await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === 'salesian'); return s && JSON.stringify(s.contents && s.contents.Morning || []).includes('bible-in-a-year'); });
  const p = await profilesPayload(w);
  const sal = (p.profiles || []).find((x) => x.key === 'salesian');
  check('R16 the saved profile carries the hand-added course in Morning contents',
    !!sal && (sal.contents.Morning || []).some((it) => it.kind === 'course' && it.key === 'bible-in-a-year'), sal && sal.contents);
  // Resolve in the composed day.
  const DAY = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY)));
  // The resolver's identity guard (state.dayPayload === day)
  // races the world's own boot day-load: re-assert the
  // folded day and re-run the resolver until the entry
  // stands (the resolver is idempotent — it rebuilds
  // state.courseRes590 on each call).
  await until(() => {
    if (O.state.courseRes590 && O.state.courseRes590['Morning:bible-in-a-year']) return true;
    O.state.dayPayload = day;
    O.resolveProfileCourses590(day);
    return false;
  }, 8000);
  const descs = O.extRebuildDescs(day) || [];
  // trackDesc rebuilds each descriptor from named fields,
  // so the placed course track carries no course590 flag —
  // it is identified by its resolved episode id + block.
  const cd = descs.find((d) => d.episodeId === 'biy:day-322' && d.block === 'Morning');
  check('R17 the hand-added course RESOLVES in the composed day to the next episode by his own progress (Day 322)',
    !!cd && cd.title === 'Day 322: The Ascension', cd && { id: cd.episodeId, title: cd.title });
  w.close();
}
{
  // Edit today: the pick lands in the DRAFT; Save today writes.
  const w = makeDomWorld(johnStore());
  await sleep(300);
  w.__opn.openEditTodayScreen594(false);
  await until(() => w.document.querySelector('[data-p594tadd="Morning"]'));
  const before = w.localStorage.getItem(DATA_KEY);
  click(w, w.document.querySelector('[data-p594tadd="Morning"]'));
  await until(() => w.document.querySelector('[data-p603door="courses"]'));
  click(w, w.document.querySelector('[data-p603door="courses"]'));
  await sleep(80);
  click(w, w.document.querySelector('[data-p603additem="course:catechism-in-a-year"]'));
  await until(() => !w.document.querySelector('.profaddladder603'));
  check('R18 an Edit today pick lands in the draft — nothing is written',
    w.localStorage.getItem(DATA_KEY) === before);
  click(w, w.document.querySelector('[data-p600savetoday="1"]'));
  await until(() => { const d = docOf(w); const te = d.sections.profiles.todayEdits && d.sections.profiles.todayEdits[TODAY]; return te && JSON.stringify(te.contents && te.contents.Morning || []).includes('catechism-in-a-year'); });
  const d = docOf(w);
  const te = d.sections.profiles.todayEdits[TODAY];
  check('R19 Save today writes the layer carrying the hand-added course',
    !!te && (te.contents.Morning || []).some((it) => it.kind === 'course' && it.key === 'catechism-in-a-year'), te && te.contents);
  w.close();
}
{
  // Locked vault: the gate stands; no ladder paints.
  let env = null;
  {
    const w = makeDomWorld(johnStore());
    await sleep(300);
    await w.__opn.opnLocalApi('/api/pin/set', { method: 'POST', body: JSON.stringify({ pin: '3141' }) }, 'device');
    env = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); env[k] = w.localStorage.getItem(k); }
    w.close();
  }
  const w = makeDomWorld(env);
  await sleep(300);
  w.__opn.openProfilesScreen(null, {});
  await sleep(600);
  check('R20 locked vault: the unlock gate stands in front of the editor — no Add, no ladder',
    !w.document.querySelector('[data-p591add]') && !w.document.querySelector('.profaddladder603')
    && w.document.body.innerHTML.includes('opn-unlock'), w.document.body.innerHTML.slice(0, 200));
  w.close();
}

// ---------- N: the named-novena fix (Review round 2) ----------
// John's word (2026-11-21 19:05 CT): a named novena PLAYS
// its own Day n on each day it runs. The day's resolved
// novenas slot is built from the production catalog
// fixture (tests/fixtures-v603/novenas.json) by the feed's
// own rule: a novena runs from its startDate for `total`
// days and contributes that date's Day n episode — slot
// presence IS the day standing (ownResolveFeed settles
// exactly the feed's per-date novena items). Fixture date
// 2026-11-21 (the production day fixture): nine novenas
// run — christ_the_king stands at Day 9 (start 2026-11-13,
// 9 days), miraculous_medal at Day 4 (start 2026-11-18,
// 6 days); 14_holy_helpers ran 2026-07-30 + 9 days and
// does NOT cover the date.
function novenaSlotFor(dateStr) {
  const tracks = [];
  (NOVENAS.novenas || []).forEach((n) => {
    if (!n.startDate || !n.total) return;
    const off = Math.round((Date.parse(dateStr + 'T12:00:00Z') - Date.parse(n.startDate + 'T12:00:00Z')) / 86400000);
    if (off < 0 || off >= n.total) return;
    tracks.push({ episodeId: 'novena-' + n.slug, title: n.name + ' Day ' + (off + 1), state: 'present', enclosureUrl: 'https://example.invalid/' + dateStr + '-' + n.slug + '-day-' + (off + 1) + '.mp3', streamUrl: null, durationS: 300, sizeBytes: 1000, imageUrl: '/logo.png' });
  });
  return { state: tracks.length ? 'present' : 'missing', tracks };
}
function worldWithNovenas(contents) {
  const st = johnStore();
  const doc = JSON.parse(st[DATA_KEY]);
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
  sal.contents = Object.assign({}, sal.contents || {}, { Novenas: contents });
  st[DATA_KEY] = JSON.stringify(doc);
  return makeDomWorld(st);
}
async function composeNovenas(w) {
  const O = w.__opn;
  const DAY = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY)));
  O.state.dayPayload = day;
  O.state.ownStanding = [{ sourceKey: 'novenas', episodeId: 'novenas', block: 'Novenas', sortOrder: 90, title: 'Novenas', enabled: 1 }];
  O.state.extStanding = [];
  O.state.ownSlots = { novenas: novenaSlotFor('2026-11-21') };
  O.state.extSlots = {};
  const descs = O.extRebuildDescs(day) || [];
  return descs.filter((d) => String(d.episodeId || '').indexOf('novena-') === 0);
}
{
  const slot = novenaSlotFor('2026-11-21');
  check('N0 the fixture slot for 2026-11-21 carries the nine running novenas (catalog window rule) and not 14_holy_helpers',
    slot.tracks.length === 9 && slot.tracks.some((t) => t.episodeId === 'novena-christ_the_king')
    && !slot.tracks.some((t) => t.episodeId === 'novena-14_holy_helpers'), slot.tracks.map((t) => t.episodeId));
}
{
  const w = await worldWithNovenas([{ kind: 'novena', key: 'christ_the_king' }]);
  await sleep(300);
  const nov = await composeNovenas(w);
  check('N1 named ALONE on a running day composes that novena\u2019s own Day n track (christ_the_king, Day 9)',
    nov.length === 1 && nov[0].episodeId === 'novena-christ_the_king' && String(nov[0].title).includes('Day 9'), nov.map((d) => d.episodeId + '|' + d.title));
  w.close();
}
{
  const w = await worldWithNovenas([{ kind: 'novena', key: '14_holy_helpers' }]);
  await sleep(300);
  const O = w.__opn;
  const DAY = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY)));
  O.state.dayPayload = day;
  O.state.ownStanding = [{ sourceKey: 'novenas', episodeId: 'novenas', block: 'Novenas', sortOrder: 90, title: 'Novenas', enabled: 1 }];
  O.state.extStanding = [];
  O.state.ownSlots = { novenas: novenaSlotFor('2026-11-21') };
  O.state.extSlots = {};
  const descs = O.extRebuildDescs(day) || [];
  const nov = descs.filter((d) => String(d.episodeId || '').indexOf('novena-') === 0);
  const placeholder = descs.filter((d) => d.episodeId === 'novenas');
  check('N2 named ALONE outside its run composes empty BY TRUTH — zero tracks, no missing placeholder (reason: 14_holy_helpers\u2019 window 2026-07-30 + 9d does not cover 2026-11-21, so the day\u2019s slot carries no track for it)',
    nov.length === 0 && placeholder.length === 0, { nov: nov.length, placeholder: placeholder.length });
  w.close();
}
{
  const w = await worldWithNovenas([{ kind: 'all-novenas' }, { kind: 'novena', key: 'christ_the_king' }]);
  await sleep(300);
  const nov = await composeNovenas(w);
  const ck = nov.filter((d) => d.episodeId === 'novena-christ_the_king');
  check('N3 named + all-novenas: every running novena stands and the named one stands exactly ONCE (dedupe by episode identity)',
    nov.length === 9 && ck.length === 1, { total: nov.length, ck: ck.length });
  w.close();
}
{
  const w = await worldWithNovenas([{ kind: 'novena', key: 'miraculous_medal' }, { kind: 'novena', key: 'christ_the_king' }]);
  await sleep(300);
  const nov = await composeNovenas(w);
  check('N4 two named novenas stand in CONTENTS order (miraculous_medal before christ_the_king — the reverse of slot order)',
    JSON.stringify(nov.map((d) => d.episodeId)) === JSON.stringify(['novena-miraculous_medal', 'novena-christ_the_king']), nov.map((d) => d.episodeId));
  w.close();
}
{
  // Edit today: the named pick rides the draft into the
  // today layer at Save today; the standing profile is
  // untouched; the saved layer composes for today.
  const w = makeDomWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const profBefore = JSON.stringify(((docOf(w).sections.profiles.list || []).find((p) => p.key === 'salesian') || {}).contents || {});
  w.__opn.openEditTodayScreen594(false);
  await until(() => w.document.querySelector('[data-p594tadd="Novenas"]'));
  click(w, w.document.querySelector('[data-p594tadd="Novenas"]'));
  await until(() => w.document.querySelector('[data-p603door="novenas"]'));
  click(w, w.document.querySelector('[data-p603door="novenas"]'));
  await sleep(120);
  const row = w.document.querySelector('[data-p603additem="novena:miraculous_medal"]');
  check('N5a Edit today: the Novenas rung offers the named novena as a pick', !!row);
  const docBeforePick = w.localStorage.getItem(DATA_KEY);
  if (row) click(w, row);
  await until(() => !w.document.querySelector('.profaddladder603'));
  check('N5b the pick lands in the today DRAFT — nothing is written', w.localStorage.getItem(DATA_KEY) === docBeforePick);
  click(w, w.document.querySelector('[data-p600savetoday="1"]'));
  await until(() => { const d = docOf(w); const te = d.sections.profiles.todayEdits && d.sections.profiles.todayEdits[TODAY]; return te && (te.contents && te.contents.Novenas || []).some((it) => it.kind === 'novena' && it.key === 'miraculous_medal'); });
  const d = docOf(w);
  const te = d.sections.profiles.todayEdits[TODAY];
  const profAfter = JSON.stringify(((d.sections.profiles.list || []).find((p) => p.key === 'salesian') || {}).contents || {});
  check('N5c Save today writes the layer carrying the named novena; the standing profile\u2019s contents are byte-identical (untouched)',
    !!te && profAfter === profBefore, { te: te && te.contents, profSame: profAfter === profBefore });
  const nov = await composeNovenas(w);
  const mm = nov.filter((x) => x.episodeId === 'novena-miraculous_medal');
  check('N5d the saved today layer composes for today: the named novena stands exactly once, at its Day 4',
    mm.length === 1 && String(mm[0].title).includes('Day 4'), nov.map((x) => x.episodeId));
  w.close();
}
{
  // The pre-fix defect, reproduced on the pre-fix tree
  // (b4545c2, the held Review head — pinned by hash so
  // the leg stands after the fix commits on top): named
  // alone on a running day composes EMPTY there.
  const headSrc = git(['show', 'b4545c2:app/worker/src/client.ts']);
  const ha = headSrc.indexOf('= `') + 3, hb = headSrc.indexOf('\n`;', ha);
  const headJs = vm.runInContext('`' + headSrc.slice(ha, hb) + '`', vm.createContext({}));
  const st = johnStore();
  const doc = JSON.parse(st[DATA_KEY]);
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
  sal.contents = Object.assign({}, sal.contents || {}, { Novenas: [{ kind: 'novena', key: 'christ_the_king' }] });
  st[DATA_KEY] = JSON.stringify(doc);
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(st).forEach((k) => w.localStorage.setItem(k, st[k]));
  const s = w.document.createElement('script');
  s.textContent = headJs + HOOK;
  w.document.body.appendChild(s);
  await sleep(300);
  const nov = await composeNovenas(w);
  check('N6 FAIL-ON-PRE-FIX: on the held Review head (b4545c2) the same named-alone world composes ZERO novena tracks (the defect the fix removes)',
    nov.length === 0, nov.map((x) => x.episodeId));
  w.close();
}

// ---------- A: equivalence (no hand-added course) ----------
function buildStanding(w) {
  const O = w.__opn;
  const SETTINGS = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
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
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
}
async function composeWith(js, isBase) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  w.localStorage.setItem(DATA_KEY, JSON.stringify(JSON.parse(JSON.stringify(JOHN))));
  const s = w.document.createElement('script');
  s.textContent = js + (isBase ? HOOK.replace('resolveProfileCourses590, ', '') : HOOK);
  w.document.body.appendChild(s);
  await sleep(300);
  const O = w.__opn;
  buildStanding(w);
  const DAY = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY)));
  O.state.dayPayload = day;
  if (O.resolveProfileCourses590) O.resolveProfileCourses590(day);
  await sleep(500);
  const descs = O.extRebuildDescs(day) || [];
  const out = JSON.stringify(descs);
  w.close();
  return out;
}
{
  const baseSrc = git(['show', 'bfb0e85:app/worker/src/client.ts']); // A1 base pin: the v609 repair-1 build (pre-repair-2) — pinned 2026-11-21 so the equivalence survives the repair-2 merge
  const ba = baseSrc.indexOf('= `') + 3, bb = baseSrc.indexOf('\n`;', ba);
  const baseJs = vm.runInContext('`' + baseSrc.slice(ba, bb) + '`', vm.createContext({}));
  const a = await composeWith(appJs, false);
  const b = await composeWith(baseJs, true);
  // v609 repair 2 re-base: the composition differs from
  // the pre-repair build ONLY by the two migrated course
  // tracks (the series landing as Night items) — every
  // other descriptor byte-identical, in order.
  const aDescs = JSON.parse(a);
  const bDescs = JSON.parse(b);
  const bIds = bDescs.map((t) => t.episodeId);
  const aKept = aDescs.filter((t) => bIds.includes(t.episodeId));
  const aNew = aDescs.filter((t) => !bIds.includes(t.episodeId));
  check('A1 equivalence (v609 repair 2 form): the composed day is byte-identical to the base build but for the two migrated course tracks',
    JSON.stringify(aKept) === b && aNew.length === 2 && aNew.every((t) => /biy|exorcist/.test(t.episodeId)),
    { newLen: a.length, baseLen: b.length, added: aNew.map((t) => t.episodeId) });
}

console.log('harness-v603:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
