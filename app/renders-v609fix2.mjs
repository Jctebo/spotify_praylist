// renders-v609fix2.mjs — v609 REPAIR 2 Review renders:
// the locked gate and the grouped set, driven on the
// same worlds as harness-v609vault (his real document
// under a real vault envelope built by the client's own
// opnVaultCreate; production day + production settings).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const OUT = process.env.HOME + '/workspace/projects/ora-pro-nobis/v609-fix2-renders/';
mkdirSync(OUT, { recursive: true });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const PIN = '2468';

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));
const { JSDOM } = await import('jsdom');
const { webcrypto } = await import('node:crypto');
const HOOK = '\n;window.__opn = { state, opn604: (typeof opn604 !== "undefined" ? opn604 : null), opnLocalApi, opnMode, opnDoc, opnVaultLocked, opnVaultCreate, opnRawKeyB64: function () { return opnVaultRawKey ? opnB64(opnVaultRawKey) : null; }, opnFoldDay590, extRebuildDescs, paintPrayersView, paintMergedContainer, resolveReadingsSeat590, resolveProfileCourses590, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0 };';
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
function makeWorld(store, bridge) {
  const dom = new JSDOM(SHELL.replace('<!--OPN_SHAPE-->', 'public'), { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  if (bridge) w.Capacitor = { Plugins: { OraDayBridge: bridge } };
  return w;
}
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
  O.resolveReadingsSeat590(day); await sleep(350);
  O.resolveProfileCourses590(day); await sleep(450);
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return descs;
}
function snap(w, name, note) {
  const view = w.document.querySelector('#view') || w.document.body;
  writeFileSync(OUT + name, '<!-- v609 REPAIR 2 render: ' + note + ' -->\n' + view.innerHTML);
  console.log('wrote', name);
}

// envelope from his real document
let envelope = null, rawKeyB64 = null;
{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn;
  O.opnDoc();
  await O.opnVaultCreate(PIN, 'RECOVERY-CODE-1');
  envelope = w.localStorage.getItem(DATA_KEY);
  rawKeyB64 = O.opnRawKeyB64();
  w.close();
}
// 01 — the locked gate (no bridge: the PIN pad stands)
{
  const w = makeWorld({ [DATA_KEY]: envelope });
  await sleep(400);
  w.__opn.paintMergedContainer('prayers');
  await sleep(1800);
  snap(w, '01-locked-gate.html', 'cold open with the vault LOCKED over his real envelope: the Praylist body stands the unlock GATE (the large PIN pad card) in place of the set — never an empty day; on his phone the enrolled fingerprint prompt fires over this on the visit');
  w.close();
}
// 02 — after fingerprint unlock: the grouped set, in place
{
  const base = {
    vaultBiometricStatus: () => Promise.resolve({ available: true, enrolled: true }),
    vaultBiometricUnlock: () => Promise.resolve({ keyB64: rawKeyB64 }),
    vaultBiometricClear: () => Promise.resolve({}),
    vaultBiometricEnroll: () => Promise.resolve({}),
  };
  const bridge = new Proxy(base, { get: (t, k) => { if (k === 'then') return undefined; return k in t ? t[k] : () => Promise.resolve({}); } });
  const w = makeWorld({ [DATA_KEY]: envelope }, bridge);
  await sleep(400);
  const O = w.__opn;
  O.paintMergedContainer('prayers');
  await sleep(2500);
  const descs = await paintRealDay(w);
  snap(w, '02-grouped-set.html', 'after the fingerprint unlock (no tab switch): the set stands GROUPED BY BLOCK — a quiet head over each block, tracks under their group in day order, ONE Edit at the top, Play All over the whole day (' + descs.length + ' descriptors)');
  // 03 — the edit form opens directly on TODAY scope
  const d = w.document;
  const editBtn = d.querySelector('[data-p607edit]');
  editBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const end = Date.now() + 9000;
  while (Date.now() < end && !d.querySelector('[data-p604erow]')) await sleep(100);
  snap(w, '03-edit-form-today.html', 'Edit opens the form DIRECTLY (no scope question): the banner reads Editing today only and its own button (Edit standing instead) is the scope control; the Podcasts group stands nowhere — the migrated series stand as Night contents rows');
  w.close();
}
console.log('renders done ->', OUT);
