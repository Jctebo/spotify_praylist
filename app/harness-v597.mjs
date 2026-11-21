// harness-v597.mjs — v597: selected must mean showing.
// One standing-contents function (opnStandingContents597)
// read by the editor paint and standing behind every fold
// resolver's absent-contents branch; course selectors out
// of the contents system (universe · Add pickers · both
// validators · the course fold retired); the readings seat
// admitted only under the posture that can compose it.
//
//  T  statics: the standing function + its consumers ·
//     courses out (universe, validators, read seam, the
//     retired resolver) · server parity statics · the
//     rendered client parses whole · SW pin unmoved.
//  A  THE HEADLINE (jsdom, grown from the audit driver):
//     per way x per ON block over production fixtures
//     (John's v589 document · production source-settings ·
//     the production 2026-11-21 day payload), the editor's
//     painted-ON set == the fold's composed set. Run on
//     the NEW client (0 mismatches required) and on the
//     PRE-FIX client (49 mismatches required — the leg
//     drives the real defect).
//  B  Reset leg: a reset way paints no course anywhere
//     and painted == composed after the reset.
//  C  Seat leg: the Little Way's Morning paints no seat
//     row at all and the fold never attempts the seat
//     fetch; the Salesian Morning paints it ON and it
//     composes.
//  D  Materialized-block regression: an explicit contents
//     entry paints exactly its list and composes exactly
//     its list.
//  E  Validator legs: the client validator drops a course
//     item (and an end-to-end save stores courseless);
//     the server validator (extracted) drops identically
//     over the same battery.
//  F  Server parity: the extracted server fold agrees
//     with the client payload's effective fold per way
//     (key · coreBlocks · contents).
//  G  Equivalence + the no-data-change gate: John's day
//     folds byte-identical old vs new; a materialized
//     day's descriptors differ old vs new by exactly the
//     course tracks; John's profiles section byte-
//     identical through a full editor + fold flow (no
//     save), post-load bytes equal old vs new, zero
//     stored course items, the file on disk untouched.
//
// Fixtures from production only (Improvement D): John's
// import file · app/tests/fixtures-v597 (the production
// source-settings payload + the production day payload).
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

// ---------- sources + rendered clients ----------
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
function renderAppJs(src) {
  const t0 = src.indexOf('= `') + 3;
  const t1 = src.indexOf('\n`;', t0);
  return vm.runInContext('`' + src.slice(t0, t1) + '`', vm.createContext({}));
}
const appJs = renderAppJs(clientSrc);
const oldClientSrc = git(['show', '6ccb73c:app/worker/src/client.ts']);
const oldAppJs = renderAppJs(oldClientSrc);
{ let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 the rendered client parses whole', parses, perr); }

// ---------- T statics ----------
check('T1 the standing function stands and the composed reading delegates to it',
  clientSrc.includes('function opnStandingContents597(rec, block)')
  && clientSrc.includes('return opnStandingContents597(rec, block);')
  && clientSrc.includes('opnStandingContents597({ contents: d.contents, layers: d.layers }, block)'));
check('T2 courses out of the universe + validators + read seam (client)',
  !clientSrc.includes("kind: 'course', key: k")
  && clientSrc.includes("if (kind === 'course') return;")
  && clientSrc.includes("it.kind !== 'course'")
  && !clientSrc.includes('function resolveProfileCourses590(')
  && !clientSrc.includes('state.courseRes590'));
check('T3 server parity statics: the validator drops, the course key set retired',
  indexSrc.includes('if (kind === "course") continue;')
  && !indexSrc.includes('const PROFILE_COURSE_KEYS')
  && !indexSrc.includes('"course"].includes(kind)'));
check('T4 the seat posture helper stands and both Add pickers consult it',
  clientSrc.includes('function opnSeatPosture597(layers)')
  && (clientSrc.match(/opnSeatPosture597\(/g) || []).length >= 4);
check('T5 SW pin unmoved pre-Ship (ora-pro-nobis-v598-1)', uiSrc.includes('ora-pro-nobis-v598-1'));

// ---------- fixtures ----------
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const JOHN_FILE_HASH_BEFORE = execFileSync('sha256sum', [process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json'], { encoding: 'utf8' }).split(' ')[0];
const SETTINGS = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const DATA_KEY = 'opn-personal-data-v1';
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { console.log('not ok - jsdom unavailable', e.message); process.exit(1); }

const HOOK_NEW = '\n;window.__opn = { openProfilesScreen, opnLocalApi, opnMode, state, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, opnFoldDay590, resolveReadingsSeat590, profContentsUniverse590, opnStandingContents597, opnCheckContents590, extRebuildDescs, opnContentsOf590 };';
const HOOK_OLD = '\n;window.__opn = { openProfilesScreen, opnLocalApi, opnMode, state, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, opnFoldDay590, resolveProfileCourses590, resolveReadingsSeat590, profContentsUniverse590, extRebuildDescs, opnContentsOf590 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const end = Date.now() + (ms || 8000); while (Date.now() < end) { if (fn()) return true; await sleep(100); } return fn(); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }

function makeWorld(docObj, js, hook) {
  const world = { fetchLog: [] };
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  world.w = w;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = (url) => {
    const u = String(url);
    world.fetchLog.push(u);
    let body = {};
    if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'dr-1', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3' }], currentKey: 'dr-1' };
    else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: 'stub-ep-' + sk, title: 'Day 1', url: 'https://example.invalid/e.mp3' }], currentKey: 'stub-ep-' + sk }; }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  };
  w.localStorage.setItem(DATA_KEY, JSON.stringify(docObj));
  const s = w.document.createElement('script');
  s.textContent = js + hook;
  w.document.body.appendChild(s);
  return world;
}
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0('2026-11-21');
  const prim = {};
  (SETTINGS.sources || []).forEach((s) => {
    if (s.family !== 'external' || !s.slotId) return;
    if (s.role !== 'fallback') prim[s.slotId] = s;
  });
  const standing = [];
  O.EXT_SLOTS.forEach((s) => {
    const row = prim[s.slotId];
    if (!row || row.enabled !== 1 || !O.extDayRulePasses(row.dayRule || 'daily', wd)) return;
    standing.push({ slotId: s.slotId, title: s.title, block: row.block || 'Morning', sortOrder: row.sortOrder, source: s.source || 'Divine Office' });
  });
  O.state.extStanding = standing;
  const own = [];
  (SETTINGS.sources || []).forEach((s) => {
    if (s.family !== 'own' || !O.OWN_ROW_EPISODE[s.sourceKey]) return;
    own.push({ sourceKey: s.sourceKey, episodeId: O.OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled });
  });
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0));
  // seed every standing slot present, so the fold's
  // descriptor read can name what composed
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
  return { own: O.state.ownStanding, ext: standing };
}
function readPainted(w) {
  const out = {};
  w.document.querySelectorAll('.profcontents591').forEach((c) => {
    const block = c.getAttribute('data-p593anchor');
    const rows = [];
    c.querySelectorAll('[data-p591citem]').forEach((b) => {
      rows.push({ id: b.getAttribute('data-p591citem').split('|')[1].replace(/:$/, ''), on: b.classList.contains('on') });
    });
    out[block] = rows;
  });
  return out;
}
async function paintedForWay(world, way) {
  const w = world.w;
  w.__opn.openProfilesScreen(null, { ladder: true });
  await until(() => !!w.document.querySelector('[data-p593chip="' + way + '"]') && !!w.document.querySelector('.profcontents591'), 10000);
  const chip = w.document.querySelector('[data-p593chip="' + way + '"]');
  if (chip) click(w, chip);
  await sleep(500);
  return readPainted(w);
}
async function composedForWay(world, standing) {
  const w = world.w, O = w.__opn;
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY)));
  O.state.dayPayload = day;
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(400); }
  world.fetchLog.length = 0;
  O.resolveReadingsSeat590(day);
  await sleep(400);
  const descs = O.extRebuildDescs(day) || [];
  const srcKeys = {};
  // the novena family's settings row is not a contents
  // item (its descriptors are feed-born episodes; the
  // Novenas contents item is all-novenas, read separately)
  standing.own.forEach((r) => { if (r.sourceKey !== 'novenas') srcKeys[r.sourceKey] = r.block; });
  standing.ext.forEach((s) => { srcKeys[s.slotId] = s.block; });
  const composed = {};
  const push = (block, id) => { (composed[block] = composed[block] || new Set()).add(id); };
  descs.forEach((d) => {
    if (!d) return;
    const blk = d.block || d._block;
    if (!blk) return;
    // a course descriptor (pre-fix code) is known by the
    // stub episode key its series fetch returned
    if (typeof d.episodeId === 'string' && d.episodeId.startsWith('stub-ep-')) { push(blk, 'course:' + d.episodeId.slice(8)); return; }
    if (srcKeys[d.episodeId] === blk) push(blk, 'source:' + d.episodeId);
  });
  (day.additions || []).forEach((a) => { if (a && a.slug) push(a.block, 'prayer:' + a.slug); });
  if (day.readingsSeat) push('Morning', 'seat:daily-readings');
  if (day.blocks.some((b) => b.block === 'Novenas')) push('Novenas', 'all-novenas');
  const seatFetch = world.fetchLog.some((u) => u.includes('series=daily-readings'));
  return { composed, seatFetch, day };
}
function mismatchCount(painted, composed) {
  let n = 0; const detail = [];
  Object.keys(painted).forEach((block) => {
    const onSet = new Set(painted[block].filter((r) => r.on).map((r) => r.id));
    const compSet = composed[block] || new Set();
    onSet.forEach((id) => { if (!compSet.has(id)) { n++; detail.push(block + ' painted-not-composed ' + id); } });
    compSet.forEach((id) => { if (!onSet.has(id)) { n++; detail.push(block + ' composed-not-painted ' + id); } });
  });
  return { n, detail };
}
const WAYS = ['little-way', 'salesian', 'benedictine'];
function docForWay(way) {
  const doc = JSON.parse(JSON.stringify(JOHN));
  doc.sections.profiles.standingKey = way;
  doc.sections.profiles.dayDefaults = {};
  doc.sections.profiles.picks = {};
  return doc;
}

// ---------- A: painted == composed, per way ----------
async function runA(js, hook) {
  const per = {};
  let total = 0;
  for (const way of WAYS) {
    const world = makeWorld(docForWay(way), js, hook);
    await sleep(600);
    const standing = buildStanding(world.w);
    const painted = await paintedForWay(world, way);
    const { composed } = await composedForWay(world, standing);
    const m = mismatchCount(painted, composed);
    per[way] = m;
    total += m.n;
    world.w.close();
  }
  return { per, total };
}
const aNew = await runA(appJs, HOOK_NEW);
check('A1 NEW client: painted == composed for every way (0 mismatches)', aNew.total === 0, aNew.per);
const aOld = await runA(oldAppJs, HOOK_OLD);
check('A2 PRE-FIX client: the same legs count the audit\u2019s 49 mismatches (the defect, driven)', aOld.total === 49, { total: aOld.total, per: Object.fromEntries(Object.entries(aOld.per).map(([k, v]) => [k, v.n])) });

// ---------- B: Reset leg ----------
{
  const world = makeWorld(docForWay('salesian'), appJs, HOOK_NEW);
  await sleep(600);
  const standing = buildStanding(world.w);
  const O = world.w.__opn;
  const r = await O.opnLocalApi('/api/prayer/profiles/reset', { method: 'PUT', body: JSON.stringify({ profileKey: 'salesian' }) }, 'device').catch((e) => ({ err: String(e) }));
  const prof = (r.profiles || []).find((p) => p.key === 'salesian');
  check('B1 reset restores the designed default with NO contents (courseless by construction)', !!prof && !prof.contents, r.err || (prof && Object.keys(prof)));
  const painted = await paintedForWay(world, 'salesian');
  const { composed } = await composedForWay(world, standing);
  const courseRows = Object.values(painted).flat().filter((x) => x.id.startsWith('course:'));
  check('B2 after reset the editor paints no course row in any block', courseRows.length === 0, courseRows);
  check('B3 after reset painted == composed', mismatchCount(painted, composed).n === 0, mismatchCount(painted, composed));
  world.w.close();
}

// ---------- C: seat legs ----------
{
  const lw = makeWorld(docForWay('little-way'), appJs, HOOK_NEW);
  await sleep(600);
  const stL = buildStanding(lw.w);
  const paintedL = await paintedForWay(lw, 'little-way');
  const morningL = (paintedL.Morning || []);
  check('C1 Little Way Morning paints NO seat row at all (posture cannot compose it)', !morningL.some((r) => r.id === 'seat:daily-readings'), morningL.map((r) => r.id));
  const compL = await composedForWay(lw, stL);
  check('C2 Little Way fold never attempts the seat fetch and no seat composes', compL.seatFetch === false && !(compL.composed.Morning || new Set()).has('seat:daily-readings'));
  lw.w.close();
  const sa = makeWorld(docForWay('salesian'), appJs, HOOK_NEW);
  await sleep(600);
  const stS = buildStanding(sa.w);
  const paintedS = await paintedForWay(sa, 'salesian');
  const seatRow = (paintedS.Morning || []).find((r) => r.id === 'seat:daily-readings');
  const compS = await composedForWay(sa, stS);
  check('C3 Salesian Morning paints the seat ON and it composes', !!seatRow && seatRow.on && compS.seatFetch === true && (compS.composed.Morning || new Set()).has('seat:daily-readings'));
  sa.w.close();
}

// ---------- D: materialized-block regression ----------
{
  const doc = docForWay('salesian');
  // the first standing Morning source comes from the same
  // build the world runs; take it from the settings-driven
  // standing set computed in a probe world
  const probe = makeWorld(docForWay('salesian'), appJs, HOOK_NEW);
  await sleep(400);
  const pst = buildStanding(probe.w);
  const morningSrc = (pst.own.find((r) => r.block === 'Morning') || pst.ext.find((r) => r.block === 'Morning'));
  const srcKey = morningSrc.sourceKey || morningSrc.slotId;
  probe.w.close();
  const explicit = [{ kind: 'source', key: srcKey }, { kind: 'seat', key: 'daily-readings' }, { kind: 'prayer', key: 'morning-offering' }];
  doc.sections.profiles.list.forEach((p) => { if (p.key === 'salesian') p.contents = { Morning: JSON.parse(JSON.stringify(explicit)) }; });
  const world = makeWorld(doc, appJs, HOOK_NEW);
  await sleep(600);
  const standing = buildStanding(world.w);
  const painted = await paintedForWay(world, 'salesian');
  const onIds = (painted.Morning || []).filter((r) => r.on).map((r) => r.id).sort();
  const { composed } = await composedForWay(world, standing);
  const compIds = [...(composed.Morning || new Set())].sort();
  const want = explicit.map((it) => it.kind + ':' + it.key).sort();
  check('D1 a materialized block paints exactly its entry ON', JSON.stringify(onIds) === JSON.stringify(want), { onIds, want });
  check('D2 a materialized block composes exactly its entry', JSON.stringify(compIds) === JSON.stringify(want), { compIds, want });
  world.w.close();
}

// ---------- E: validator legs (client + server extraction) ----------
function extractServerFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('server fn not found: ' + name);
  // the body brace is NOT the first '{' (the TS return type
  // carries braces of its own): one-line signatures end
  // with it on the signature line; profileFoldOf's spans
  // lines and ends at the '\n} {' line.
  let i;
  if (name === 'profileFoldOf') { const k = src.indexOf('\n} {', start); if (k < 0) throw new Error('fold sig shape moved'); i = k + 3; }
  else { const nl = src.indexOf('\n', start); i = src.lastIndexOf('{', nl); if (i < start) throw new Error('sig shape moved: ' + name); }
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
  ];
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error('server validate shape moved: ' + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
const serverValidate = new Function(stripServerValidate(indexSrc) + '\nreturn validateProfileContents;')();
{
  const world = makeWorld(docForWay('salesian'), appJs, HOOK_NEW);
  await sleep(400);
  const O = world.w.__opn;
  const battery = [
    { Morning: [{ kind: 'course', key: 'catechism-in-a-year' }, { kind: 'source', key: 'abc' }] },
    { Morning: [{ kind: 'course', key: 'not-a-course' }, { kind: 'seat', key: 'daily-readings' }] },
    { Morning: [{ kind: 'source', key: 'abc' }, { kind: 'source', key: 'abc' }] },
    { Novenas: [{ kind: 'all-novenas' }] },
  ];
  const core = ['Morning', 'Midday', 'Evening', 'Night'];
  let agree = true, dropped = true;
  for (const item of battery) {
    let cOut, cErr = null;
    try { cOut = O.opnCheckContents590(JSON.parse(JSON.stringify(item)), core); } catch (e) { cErr = String(e && e.message || e); }
    const sOut = serverValidate(JSON.parse(JSON.stringify(item)), core);
    const cNorm = cErr ? { error: cErr } : { normalized: cOut };
    if (JSON.stringify(cNorm) !== JSON.stringify(sOut)) agree = false;
    const flat = JSON.stringify(cOut || sOut.normalized || {});
    if (flat.includes('course')) dropped = false;
  }
  check('E1 a contents list carrying a course key: the item drops at validation on BOTH folds (client == server over the battery)', agree && dropped, { agree, dropped });
  // end-to-end: a save carrying a course stores courseless
  const save = await O.opnLocalApi('/api/prayer/profiles/save', { method: 'PUT', body: JSON.stringify({ name: 'Validator Probe', basedOn: 'salesian', coreBlocks: ['Morning', 'Midday', 'Evening', 'Night'], layers: { novenas: { on: true }, podcasts: { on: true, series: ['daily-readings'] } }, contents: { Morning: [{ kind: 'course', key: 'bible-in-a-year' }, { kind: 'seat', key: 'daily-readings' }] } }) }, 'device').catch((e) => ({ err: String(e && e.message || e) }));
  const savedProf = (save.profiles || []).find((p) => p.name === 'Validator Probe');
  check('E2 end-to-end save: stored contents carry no course item', !!savedProf && JSON.stringify(savedProf.contents || {}).indexOf('course') < 0, save.err || (savedProf && savedProf.contents));
  world.w.close();
}

// ---------- F: server fold parity ----------
function stripServerFold(src) {
  // profileDayKind reads the Mass calendar (not extracted);
  // for the fixture date 2026-11-21 (a Saturday memorial)
  // the real function returns 'weekday', and dayKind moves
  // none of the compared fields (key · coreBlocks · contents).
  const dayKind = 'function profileDayKind(date) { return "weekday"; }';
  let resolve = extractServerFn(src, 'profileResolve');
  resolve = resolve.replace('function profileResolve(store: PrayerProfileStore, date: string): { profile: PrayerProfile; resolvedBy: "pick" | "day-default" | "standing"; dayKind: "sunday" | "solemnity" | "weekday" } {', 'function profileResolve(store, date) {');
  resolve = resolve.replace('(k: string | undefined)', '(k)');
  let diverges = extractServerFn(src, 'todayLayerDiverges594');
  diverges = diverges.replace(/function todayLayerDiverges594\(profile: PrayerProfile, layer: TodayLayer\): boolean \{/, 'function todayLayerDiverges594(profile, layer) {');
  let fold = extractServerFn(src, 'profileFoldOf');
  fold = fold.replace(/function profileFoldOf\(store: PrayerProfileStore, date: string\): \{[\s\S]*?\n\} \{/, 'function profileFoldOf(store, date) {');
  fold = fold.replace(/const fold: \{[\s\S]*?\n  \} = \{/, 'const fold = {');
  fold = fold.split(' as Record<string, { kind: string; key?: string }[]>').join('');
  fold = fold.split(' as { kind: string; key?: string }[]').join('');
  fold = fold.split('const merged: Record<string, { kind: string; key?: string }[]> = ').join('const merged = ');
  return dayKind + '\n' + resolve + '\n' + diverges + '\n' + fold + '\nreturn profileFoldOf;';
}
{
  const serverFoldOf = new Function(stripServerFold(indexSrc) + '')();
  let parity = true; const det = [];
  for (const way of WAYS) {
    const doc = docForWay(way);
    const store = {
      profiles: doc.sections.profiles.list.map((p) => ({ key: p.key, name: p.name, honorLine: p.honorLine, kind: p.kind, coreBlocks: p.coreBlocks, layers: p.layers, ...(p.contents ? { contents: p.contents } : {}) })),
      standingKey: way, dayRule: false, dayDefaults: {}, picks: {}, version: doc.sections.profiles.version || 1, todayEdits: {},
    };
    const sf = serverFoldOf(store, '2026-11-21');
    const world = makeWorld(doc, appJs, HOOK_NEW);
    await sleep(500);
    const r = await world.w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device');
    const cf = r.effective;
    const same = sf.key === way && JSON.stringify(sf.coreBlocks) === JSON.stringify(cf.coreBlocks) && JSON.stringify(sf.contents) === JSON.stringify(cf.contents);
    if (!same) { parity = false; det.push({ way, sf: { key: sf.key, contents: sf.contents }, cf: { key: cf.key, contents: cf.contents } }); }
    world.w.close();
  }
  check('F1 server fold == client fold per way (key · coreBlocks · contents)', parity, det);
}

// ---------- G: equivalence + the no-data-change gate ----------
{
  async function foldedJson(js, hook, doc) {
    const world = makeWorld(doc, js, hook);
    await sleep(500);
    buildStanding(world.w);
    const day = world.w.__opn.opnFoldDay590(JSON.parse(JSON.stringify(DAY)));
    const bytes = JSON.stringify(day);
    const profilesBytes = world.w.localStorage.getItem(DATA_KEY);
    world.w.close();
    return { bytes, profilesBytes };
  }
  const gOld = await foldedJson(oldAppJs, HOOK_OLD, JSON.parse(JSON.stringify(JOHN)));
  const gNew = await foldedJson(appJs, HOOK_NEW, JSON.parse(JSON.stringify(JOHN)));
  check('G1 John\u2019s day folds byte-identical old vs new (no layer, no contents — the standing day)', gOld.bytes === gNew.bytes);
  // a materialized day: old vs new descriptors differ by
  // exactly the course tracks, nothing else
  async function descIds(js, hook) {
    const doc = docForWay('salesian');
    const probe = makeWorld(docForWay('salesian'), js, hook);
    await sleep(400);
    const pst = buildStanding(probe.w);
    const mSrc = (pst.own.find((r) => r.block === 'Morning') || pst.ext.find((r) => r.block === 'Morning'));
    const srcKey = mSrc.sourceKey || mSrc.slotId;
    probe.w.close();
    doc.sections.profiles.list.forEach((p) => { if (p.key === 'salesian') p.contents = { Morning: [{ kind: 'source', key: srcKey }, { kind: 'course', key: 'catechism-in-a-year' }, { kind: 'seat', key: 'daily-readings' }] }; });
    const world = makeWorld(doc, js, hook);
    await sleep(500);
    const standing = buildStanding(world.w);
    const { day } = await composedForWay(world, standing);
    const descs = world.w.__opn.extRebuildDescs(day) || [];
    const ids = descs.map((d) => (d.block || d._block) + '|' + (typeof d.episodeId === 'string' && d.episodeId.startsWith('stub-ep-') ? 'course:' + d.episodeId.slice(8) : d.episodeId)).sort();
    world.w.close();
    return ids;
  }
  const idsOld = await descIds(oldAppJs, HOOK_OLD);
  const idsNew = await descIds(appJs, HOOK_NEW);
  const onlyOld = idsOld.filter((x) => !idsNew.includes(x));
  const onlyNew = idsNew.filter((x) => !idsOld.includes(x));
  check('G6 a materialized day\u2019s descriptors differ old vs new by exactly the course tracks', onlyNew.length === 0 && onlyOld.length > 0 && onlyOld.every((x) => x.includes('course:')), { onlyOld, onlyNew });
  const profOld = JSON.parse(gOld.profilesBytes).sections.profiles;
  const profNew = JSON.parse(gNew.profilesBytes).sections.profiles;
  check('G2 post-load profiles bytes equal old vs new (migration behavior unmoved)', JSON.stringify(profOld) === JSON.stringify(profNew));
  // full flow on the new code: paint every way + fold, no save
  const world = makeWorld(JSON.parse(JSON.stringify(JOHN)), appJs, HOOK_NEW);
  await sleep(600);
  const before = world.w.localStorage.getItem(DATA_KEY);
  buildStanding(world.w);
  for (const way of WAYS) { await paintedForWay(world, way); }
  const { composed } = await composedForWay(world, buildStanding(world.w));
  const after = world.w.localStorage.getItem(DATA_KEY);
  check('G3 NO DATA CHANGE: John\u2019s stored document byte-identical through a full editor + fold flow (no save act)', before === after);
  const storedCourses = (JSON.parse(after).sections.profiles.list || []).reduce((n, p) => n + JSON.stringify(p.contents || {}).split('course').length - 1, 0);
  check('G4 zero stored course items in John\u2019s profiles, re-confirmed on the shipped code\u2019s own read', storedCourses === 0, storedCourses);
  world.w.close();
  const hashAfter = execFileSync('sha256sum', [process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json'], { encoding: 'utf8' }).split(' ')[0];
  check('G5 the import file on disk is untouched by the harness flow', hashAfter === JOHN_FILE_HASH_BEFORE);
}

console.log('\n' + ok + ' ok / ' + bad + ' not ok');
process.exit(bad ? 1 : 0);
