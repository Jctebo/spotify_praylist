// renders-v612.mjs — v612 Review renders: drive the
// BUILT client (jsdom worlds over the production
// fixtures, the harness-v612 recipes) to the three
// states the Review record names, capture the REAL
// markup the client paints, and rasterize with the
// app's real CSS (APP_CSS) at a phone viewport (the
// renders-v603 recipe). Output: ~/workspace/projects/
// ora-pro-nobis/v612-review-renders/
//  01-collapsed-set — the production day, every group
//     collapsed: quiet heads + ▸ markers, no tracks.
//  02-one-group-expanded — the first group head tapped:
//     its tracks stand under it, the rest head-only.
//  03-expand-all — the ⋮ menu's Expand all act: every
//     group paints its tracks, markers read ▾.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const OUT = process.env.HOME + '/workspace/projects/ora-pro-nobis/v612-review-renders/';
mkdirSync(OUT, { recursive: true });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';

const a = clientSrc.indexOf('= `') + 3, b = clientSrc.indexOf('\n`;', a);
const appJs = vm.runInContext('`' + clientSrc.slice(a, b) + '`', vm.createContext({}));
const ss = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(ss, uiSrc.indexOf('`;', ss)) + '`', vm.createContext({}));
const cs = uiSrc.indexOf('export const APP_CSS = `') + 'export const APP_CSS = `'.length;
const CSS = vm.runInContext('`' + uiSrc.slice(cs, uiSrc.indexOf('\n`;', cs)) + '`', vm.createContext({}));

const { JSDOM } = await import('jsdom');
const { webcrypto } = await import('node:crypto');
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, openHeaderMenu, EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, resolveReadingsSeat590, resolveProfileCourses590 };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=daily-readings')) body = { entries: [{ key: 'daily-readings:2026-11-21', label: '', title: 'Daily Mass Reading Podcast for November 21, 2026', url: 'https://example.invalid/dr.mp3', listened: false }], currentKey: 'daily-readings:2026-11-21' };
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld() {
  const dom = new JSDOM(SHELL.replace('<!--OPN_SHAPE-->', 'public'), { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
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
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
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
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((x, c) => (x.sortOrder || 0) - (c.sortOrder || 0));
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
  O.paintPrayersView(day);
  await sleep(200);
  return day;
}
const homeHtml = (w) => { const v = w.document.getElementById('view'); return v ? v.innerHTML : w.document.body.innerHTML; };

const shots = {};
{
  const w = makeWorld();
  await sleep(400);
  await paintRealDay(w);
  shots['01-collapsed-set'] = homeHtml(w);
  console.log('captured 01: heads =', (shots['01-collapsed-set'].match(/data-p609sethead/g) || []).length, '· cards =', (shots['01-collapsed-set'].match(/data-card/g) || []).length);
  const firstHead = w.document.querySelector('[data-p609sethead]');
  click(w, firstHead);
  await sleep(150);
  shots['02-one-group-expanded'] = homeHtml(w);
  console.log('captured 02: cards =', (shots['02-one-group-expanded'].match(/data-card/g) || []).length);
  const O = w.__opn, d = w.document;
  O.state.tab = 'prayers';
  O.openHeaderMenu();
  await sleep(80);
  const expItem = [...d.querySelectorAll('[data-menuitem]')].find((x) => x.textContent.includes('Expand all'));
  if (expItem) click(w, expItem);
  await sleep(150);
  shots['03-expand-all'] = homeHtml(w);
  console.log('captured 03: cards =', (shots['03-expand-all'].match(/data-card/g) || []).length, '· mode =', w.localStorage.getItem('opn-praylistmode-v604'));
  w.close();
}
for (const [name, html] of Object.entries(shots)) writeFileSync(OUT + name + '.html', html);

import { createRequire } from 'node:module';
const { chromium } = createRequire(process.env.HOME + '/workspace/.tools/pwtest/package.json')('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
for (const [name, frag] of Object.entries(shots)) {
  if (!frag) { console.log('MISSING', name); continue; }
  const page = await browser.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
  const wrap = '<!DOCTYPE html><html data-theme="light"><head><meta charset="utf-8"><style>' + CSS + '</style></head><body><div id="view">' + frag + '</div></body></html>';
  writeFileSync(OUT + name + '-full.html', wrap);
  await page.goto('file://' + OUT + name + '-full.html');
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
  await page.close();
  console.log('rendered', name + '.png');
}
await browser.close();
console.log('renders done ->', OUT);
process.exit(0);
