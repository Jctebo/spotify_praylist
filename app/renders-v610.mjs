// renders-v610.mjs — v610 Review renders: drive the BUILT
// client (jsdom world over the production fixtures, the
// harness-v610 recipes) to the states the Review record
// names and capture the REAL markup the client paints.
// Output: HTML captures in
// ~/workspace/projects/ora-pro-nobis/v610-review-renders/
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const OUT = process.env.HOME + '/workspace/projects/ora-pro-nobis/v610-review-renders/';
mkdirSync(OUT, { recursive: true });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const SETTINGS = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAYFIX = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';

const a = clientSrc.indexOf('= `') + 3, b = clientSrc.indexOf('\n`;', a);
const appJs = vm.runInContext('`' + clientSrc.slice(a, b) + '`', vm.createContext({}));
const ss = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(ss, uiSrc.indexOf('`;', ss)) + '`', vm.createContext({}));
const { JSDOM } = await import('jsdom');
const { webcrypto } = await import('node:crypto');
const HOOK = '\n;window.__opn = { opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
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
function makeWorld() {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  w.localStorage.setItem(DATA_KEY, JSON.stringify(JSON.parse(JSON.stringify(JOHN))));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
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
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((x, c) => (x.sortOrder || 0) - (c.sortOrder || 0));
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
}
const wrap = (title, bodyHtml) => '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title></head><body><h1>' + title + '</h1>' + bodyHtml + '</body></html>';

// 01 — the day's external tracks: specific hour names, none generic.
{
  const w = makeWorld();
  await sleep(400);
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAYFIX)));
  O.state.dayPayload = day;
  const descs = O.extRebuildDescs(day) || [];
  const ext = descs.filter((x) => /^ext-/.test(x.episodeId || ''));
  const rows = ext.map((x) => '<div class="render-row"><strong>' + x.title + '</strong> <span>(' + x.episodeId + ' · ' + x.block + ')</span></div>').join('');
  writeFileSync(OUT + '01-specific-office-names.html', wrap('v610 render 01 — the day\'s Divine Office tracks carry their specific names',
    '<p>Folded from the production day fixture (2026-11-21) with the production source settings. Every external track titles from its own hour; no row reads "Divine Office".</p>' + rows));
  console.log('01:', ext.length, 'external tracks, titles:', [...new Set(ext.map((x) => x.title))].join(' · '));
  w.close();
}
// 02 — a duplicated hour standing twice in one block's list.
{
  const w = makeWorld();
  await sleep(400);
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAYFIX)));
  day.profile = Object.assign({}, day.profile, { contents: { Morning: [{ kind: 'source', key: 'ext-morning-prayer' }, { kind: 'source', key: 'ext-invitatory' }, { kind: 'source', key: 'ext-morning-prayer' }] } });
  O.state.dayPayload = day;
  const descs = O.extRebuildDescs(day) || [];
  const morn = descs.filter((x) => x.block === 'Morning' && /^ext-/.test(x.episodeId || ''));
  const rows = morn.map((x) => '<div class="render-row"><strong>' + x.title + '</strong> <span>(episodeId ' + x.episodeId + (x._occ ? ' · occurrence ' + x._occ : '') + ')</span></div>').join('');
  writeFileSync(OUT + '02-duplicated-hour-twice.html', wrap('v610 render 02 — Morning Prayer stands twice in the Morning list',
    '<p>Contents for Morning: Morning Prayer · Invitatory · Morning Prayer. The fold emits both copies at their contents positions; the second copy is occurrence-stamped (its own card key, played mark, and intention draw).</p>' + rows));
  console.log('02:', morn.map((x) => x.title + (x._occ ? '#' + x._occ : '')).join(' · '));
  w.close();
}
console.log('renders-v610 written to', OUT);
