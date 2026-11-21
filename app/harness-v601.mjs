// harness-v601.mjs — v601: the Praylist reads 0 tracks.
// Part 2's Edit today materializes a block's contents
// from profContentsUniverse590, which reads the day-build
// standings (state.ownStanding / extStanding). Opened
// cold, the universe holds no source items; the first
// contents act snapshots that list into the today layer,
// and the v590 contents gate in extRebuildDescs then
// filters every source row out of the block — the day
// composes empty and the layer persists the damage.
//
//  T  statics: the standings-ensure helper stands and
//     both Configure loads call it · the fold guard
//     stands in opnApplyTodayLayer594 · the rendered
//     client parses whole.
//  A  THE LEG (jsdom, production fixtures: John's v589
//     document · production source-settings · the
//     production 2026-11-21 day payload): a today layer
//     whose contents were materialized from the
//     UNBUILT-standings universe (the field shape),
//     written through the real today-edit route.
//     PRE-FIX client: the poisoned blocks compose 0.
//     FIXED client: every poisoned block composes
//     exactly its unpoisoned count, Morning > 0.
//  B  Equivalence: no layer — old vs new composed
//     descriptors byte-identical.
//  C  No overreach: a layer entry naming ONE source
//     applies verbatim on the fixed client (the guard
//     restores only sourceless entries).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 600)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
function renderAppJs(src) {
  const t0 = src.indexOf('= `') + 3;
  const t1 = src.indexOf('\n`;', t0);
  return vm.runInContext('`' + src.slice(t0, t1) + '`', vm.createContext({}));
}
const appJs = renderAppJs(clientSrc);
const oldAppJs = renderAppJs(git(['show', '0f2d8a0:app/worker/src/client.ts']));
{ let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 the rendered client parses whole', parses, perr); }
check('T1 the standings-ensure helper stands and both Configure loads call it',
  clientSrc.includes('function opnEnsureStandings601()')
  && (clientSrc.match(/opnEnsureStandings601\(\)\.then/g) || []).length === 2);
check('T2 the fold guard stands in opnApplyTodayLayer594',
  clientSrc.includes('v601 guard') && clientSrc.includes('namesSource'));

const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const SETTINGS = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const DATA_KEY = 'opn-personal-data-v1';
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { console.log('not ok - jsdom unavailable', e.message); process.exit(1); }

const HOOK = '\n;window.__opn = { opnLocalApi, state, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, opnFoldDay590, resolveReadingsSeat590, opnStandingContents597, extRebuildDescs };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeWorld(js) {
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
  w.localStorage.setItem(DATA_KEY, JSON.stringify(JSON.parse(JSON.stringify(JOHN))));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
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
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
}
async function compose(w) {
  const O = w.__opn;
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY)));
  O.state.dayPayload = day;
  O.resolveReadingsSeat590(day);
  await sleep(400);
  const descs = O.extRebuildDescs(day) || [];
  const counts = {};
  descs.forEach((d) => { if (d && d.block) counts[d.block] = (counts[d.block] || 0) + 1; });
  (day.additions || []).forEach((a) => { if (a && a.block) counts[a.block] = (counts[a.block] || 0) + 1; });
  return { counts, descs };
}
const CORE = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
function poisonLayer(w) {
  // The field shape: Edit today opened cold — standings
  // unbuilt — and the first contents act on each block
  // snapshots the incomplete universe into the layer.
  const O = w.__opn;
  const rec = JOHN.sections.profiles.list.filter((p) => p.key === 'salesian')[0];
  const contents = {};
  (rec.coreBlocks || []).concat(['Novenas']).forEach((b) => {
    contents[b] = O.opnStandingContents597(rec, b).map((it) => it.key ? { kind: it.kind, key: it.key } : { kind: it.kind });
  });
  return { baseProfileKey: 'salesian', contents };
}
async function writeLayer(w, layer) {
  await w.__opn.opnLocalApi('/api/prayer/profiles/today-edit', { method: 'PUT', body: JSON.stringify({ date: '2026-11-21', layer }) }, 'device');
}

// ---------- A: the poisoned layer, old vs new ----------
async function poisonedRun(js) {
  const world = makeWorld(js);
  await sleep(600);
  const layer = poisonLayer(world.w); // standings NOT built — the cold open
  await writeLayer(world.w, layer);
  buildStanding(world.w);
  const { counts } = await compose(world.w);
  world.w.close();
  return counts;
}
async function cleanRun(js) {
  const world = makeWorld(js);
  await sleep(600);
  buildStanding(world.w);
  const out = await compose(world.w);
  world.w.close();
  return out;
}
const SALESIAN_CORE = JOHN.sections.profiles.list.filter((p) => p.key === 'salesian')[0].coreBlocks;
const poisonOld = await poisonedRun(oldAppJs);
const coreSumOld = SALESIAN_CORE.reduce((n, b) => n + (poisonOld[b] || 0), 0);
check('A1 PRE-FIX: the poisoned layer composes the standing blocks empty (the break)', coreSumOld === 0, poisonOld);
const cleanNew = await cleanRun(appJs);
const poisonNew = await poisonedRun(appJs);
check('A2 FIXED: the same poisoned layer composes every standing block at its clean count',
  SALESIAN_CORE.concat(['Novenas']).every((b) => (poisonNew[b] || 0) === (cleanNew.counts[b] || 0)) && (poisonNew.Morning || 0) > 0,
  { poisoned: poisonNew, clean: cleanNew.counts });

// ---------- B: equivalence, no layer ----------
const cleanOld = await cleanRun(oldAppJs);
check('B1 no layer: composed descriptors byte-identical old vs new',
  JSON.stringify(cleanOld.descs) === JSON.stringify(cleanNew.descs),
  { old: cleanOld.counts, new: cleanNew.counts });

// ---------- C: a deliberate partial gate stands ----------
{
  const world = makeWorld(appJs);
  await sleep(600);
  buildStanding(world.w);
  const O = world.w.__opn;
  const rec = JOHN.sections.profiles.list.filter((p) => p.key === 'salesian')[0];
  const morningSources = O.opnStandingContents597(rec, 'Morning').filter((it) => it.kind === 'source');
  const only = morningSources[0];
  await writeLayer(world.w, { baseProfileKey: 'salesian', contents: { Morning: [{ kind: 'source', key: only.key }] } });
  const { counts, descs } = await compose(world.w);
  const onlyCount = descs.filter((d) => d && d.block === 'Morning' && d.episodeId === only.key).length;
  check('C1 FIXED: an entry naming one source gates Morning to exactly that source (no overreach)',
    (counts.Morning || 0) === onlyCount && onlyCount > 0 && (counts.Morning || 0) < (cleanNew.counts.Morning || 0),
    { morning: counts.Morning, onlyCount, cleanMorning: cleanNew.counts.Morning, key: only.key });
  world.w.close();
}

// ---------- C2: a prayer-only entry stands verbatim ----------
{
  const world = makeWorld(appJs);
  await sleep(600);
  buildStanding(world.w);
  const O = world.w.__opn;
  await writeLayer(world.w, { baseProfileKey: 'salesian', contents: { Morning: [{ kind: 'prayer', key: 'the-angelus' }] } });
  const { counts } = await compose(world.w);
  check('C2 FIXED: a prayer-only entry is deliberate (Part 2 semantics) — Morning composes the prayer alone, no source tracks',
    (counts.Morning || 0) === 1, counts);
  world.w.close();
}

console.log('counts pre-fix poisoned:', JSON.stringify(poisonOld));
console.log('counts fixed poisoned:  ', JSON.stringify(poisonNew));
console.log('counts fixed clean:     ', JSON.stringify(cleanNew.counts));
console.log('harness-v601: ' + ok + ' ok / ' + bad + ' not ok');
process.exit(bad ? 1 : 0);
