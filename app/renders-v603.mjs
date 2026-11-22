// renders-v603.mjs — v603 Review renders: drive the
// BUILT client (jsdom worlds over the production
// fixtures, the harness-v603 recipes) to each ladder
// rung, take the REAL ladder sheet markup the client
// paints, and rasterize it in headless Chromium with
// the app's real CSS (APP_CSS) at a phone viewport.
// Output: ~/workspace/projects/ora-pro-nobis/
// v603-review-renders/rung-N-*.png
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const OUT = process.env.HOME + '/workspace/projects/ora-pro-nobis/v603-review-renders/';
mkdirSync(OUT, { recursive: true });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const BIBLE = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/bible-folded.json', 'utf8'));
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
const HOOK = '\n;window.__opn = { openProfilesScreen, opnLocalApi, state };';
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
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function type(w, inp, text) { inp.value = text; inp.dispatchEvent(new w.Event('input', { bubbles: true })); }
async function openProfiles(w) { w.__opn.openProfilesScreen(null, {}); await until(() => w.document.querySelector('[data-p591add="Morning"]')); }
async function ladderTo(w, block, steps) {
  click(w, w.document.querySelector('[data-p591add="' + block + '"]'));
  await until(() => w.document.querySelector('.profaddladder603'));
  for (const st of steps) {
    if (st.door) { click(w, w.document.querySelector('[data-p603door="' + st.door + '"]')); await sleep(150); }
    if (st.group) { click(w, [...w.document.querySelectorAll('[data-p603group]')].find((g) => g.getAttribute('data-p603group') === st.group)); await sleep(150); }
    if (st.search) { type(w, w.document.querySelector('[data-p603search]'), st.search); await sleep(150); }
    if (st.waitText) await until(() => w.document.querySelector('.profaddladder603').textContent.includes(st.waitText), 6000);
  }
  return w.document.querySelector('.profaddladder603').outerHTML;
}

const shots = {};
{
  const w = makeWorld(); await sleep(300); await openProfiles(w);
  shots['rung-1-doors.png'] = await ladderTo(w, 'Morning', []);
  w.close();
}
{
  const w = makeWorld(); await sleep(300); await openProfiles(w);
  shots['rung-2-doors-novenas.png'] = await ladderTo(w, 'Novenas', []);
  w.close();
}
{
  const w = makeWorld(); await sleep(300); await openProfiles(w);
  shots['rung-3-prayers-categories.png'] = await ladderTo(w, 'Morning', [{ door: 'prayers' }]);
  w.close();
}
{
  const w = makeWorld(); await sleep(300); await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('.profaddladder603'));
  click(w, w.document.querySelector('[data-p603door="prayers"]'));
  await sleep(150);
  click(w, [...w.document.querySelectorAll('[data-p603group]')].find((g) => g.getAttribute('data-p603group') === 'Our Lady'));
  await sleep(150);
  shots['rung-4-category-prayers.png'] = w.document.querySelector('.profaddladder603').outerHTML;
  type(w, w.document.querySelector('[data-p603search]'), 'Memorare');
  await sleep(150);
  shots['rung-7-category-search.png'] = w.document.querySelector('.profaddladder603').outerHTML;
  w.close();
}
{
  const w = makeWorld(); await sleep(300); await openProfiles(w);
  shots['rung-5-courses.png'] = await ladderTo(w, 'Morning', [{ door: 'courses' }, { waitText: 'Bible in a Year' }]);
  w.close();
}
{
  const w = makeWorld(); await sleep(300); await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('[data-p603search]'));
  type(w, w.document.querySelector('[data-p603search]'), 'Rosary');
  await until(() => w.document.querySelector('.profaddladder603').textContent.includes('Courses'), 6000);
  await sleep(150);
  shots['rung-6-head-search.png'] = w.document.querySelector('.profaddladder603').outerHTML;
  w.close();
}
{
  const w = makeWorld(); await sleep(300); await openProfiles(w);
  w.__opn.state.ownStanding = [{ sourceKey: 'daily-rosary', block: 'Morning', title: 'The Daily Rosary', sortOrder: 1 }];
  w.__opn.state.extStanding = [];
  shots['rung-8-already-standing.png'] = await ladderTo(w, 'Morning', [{ door: 'sources' }]);
  w.close();
}

// Rasterize each captured sheet with the real CSS.
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.env.HOME + '/workspace/.tools/pwtest/package.json')('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
for (const [name, sheetHtml] of Object.entries(shots)) {
  if (!sheetHtml) { console.log('MISSING', name); continue; }
  const page = await browser.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
  const html = '<!DOCTYPE html><html data-theme="light"><head><meta charset="utf-8"><style>' + CSS + '</style><style>body{background:#101418}.profaddladder603{max-height:100dvh}</style></head><body>' + sheetHtml + '</body></html>';
  const tmp = OUT + name.replace('.png', '.html');
  writeFileSync(tmp, html);
  await page.goto('file://' + tmp);
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + name });
  await page.close();
  console.log('rendered', name);
}
await browser.close();
