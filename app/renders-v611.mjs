// renders-v611.mjs — v611 Review renders: drive the
// BUILT client (jsdom worlds over the production
// fixtures, the harness-v611 recipes) to the two states
// the Review record names, capture the REAL markup the
// client paints, and rasterize with the app's real CSS
// (APP_CSS) at a phone viewport (the renders-v603
// recipe). Output: ~/workspace/projects/ora-pro-nobis/
// v611-review-renders/
//  01-ladder-daily-rung — the Add ladder's Daily rung
//     from Edit profiles (Morning), its one entry.
//  02-composed-day-exegesis — the composed day for
//     2026-11-18 whose Salesian Morning contents carry
//     the day item: Morning expanded, the day's own
//     exegesis episode (GUID 820b4a9a…, released
//     2026-11-17) standing in the block.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const OUT = process.env.HOME + '/workspace/projects/ora-pro-nobis/v611-review-renders/';
mkdirSync(OUT, { recursive: true });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const DGE = JSON.parse(readFileSync(APP + 'tests/fixtures-v611/dge-payload.json', 'utf8'));
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
const HOOK = '\n;window.__opn = { openProfilesScreen, opnLocalApi, state, opnFoldDay590, resolveExegesisDay611, extRebuildDescs, paintPrayersView };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=daily-gospel-exegesis')) body = DGE;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function makeWorld(mut) {
  const dom = new JSDOM(SHELL.replace('<!--OPN_SHAPE-->', 'public'), { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  const doc = JSON.parse(JSON.stringify(JOHN));
  if (mut) mut(doc);
  w.localStorage.setItem(DATA_KEY, JSON.stringify(doc));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }

const shots = {};
{
  const w = makeWorld();
  await sleep(300);
  w.__opn.openProfilesScreen(null, {});
  await until(() => w.document.querySelector('[data-p591add="Morning"]'));
  click(w, w.document.querySelector('[data-p591add="Morning"]'));
  await until(() => w.document.querySelector('[data-p603door="daily"]'));
  click(w, w.document.querySelector('[data-p603door="daily"]'));
  await sleep(150);
  shots['01-ladder-daily-rung'] = w.document.querySelector('.profaddladder603').outerHTML;
  console.log('captured 01: Daily rung stands =', shots['01-ladder-daily-rung'].includes('Daily Gospel Exegesis'));
  w.close();
}
{
  const w = makeWorld((doc) => {
    const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
    sal.contents = Object.assign({}, sal.contents || {}, { Morning: [{ kind: 'day', key: 'daily-gospel-exegesis' }] });
  });
  await sleep(300);
  const O = w.__opn;
  const blocks = ['Morning', 'Midday', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 }));
  const day = O.opnFoldDay590({ ok: true, date: '2026-11-18', presentedDay: '2026-11-18', dateLabel: 'Wednesday, November 18, 2026', blocks, additions: [], profile: null, readingsSeat: null, episodes: [] });
  O.state.dayPayload = day;
  O.state.ownStanding = []; O.state.extStanding = []; O.state.ownSlots = {}; O.state.extSlots = {};
  O.resolveExegesisDay611(day);
  await until(() => O.state.exegesisRes611 && O.state.exegesisRes611['Morning:daily-gospel-exegesis'], 8000);
  await sleep(200);
  // The composed day: the descriptor set extRebuildDescs
  // settled for Morning, stood as the block's tracks for
  // the paint (the queue the day stands on).
  const descs = O.extRebuildDescs(day) || [];
  const morning = day.blocks.find((x) => x.block === 'Morning');
  morning.tracks = descs.filter((d) => d.block === 'Morning').map((d) => ({ episodeId: d.episodeId, title: d.title, state: 'present', available: d.available, streamUrl: d.url, durationS: d.durationS, imageUrl: d.imageUrl }));
  morning.trackCount = morning.tracks.length;
  O.paintPrayersView(day);
  await sleep(200);
  const openBtn = w.document.querySelector('[data-openblock="Morning"]');
  if (openBtn) { click(w, openBtn); await sleep(150); }
  const view = w.document.getElementById('view');
  shots['02-composed-day-exegesis'] = view ? view.innerHTML : w.document.body.innerHTML;
  console.log('captured 02: exegesis title in view =', shots['02-composed-day-exegesis'].includes('Wednesday of Week 33 in Ordinary Time'));
  w.close();
}

for (const [name, html] of Object.entries(shots)) writeFileSync(OUT + name + '.html', html);

// Rasterize each capture with the real CSS.
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.env.HOME + '/workspace/.tools/pwtest/package.json')('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
for (const [name, frag] of Object.entries(shots)) {
  if (!frag) { console.log('MISSING', name); continue; }
  const page = await browser.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
  const wrap = name.startsWith('01')
    ? '<!DOCTYPE html><html data-theme="light"><head><meta charset="utf-8"><style>' + CSS + '</style><style>body{background:#101418}.profaddladder603{max-height:100dvh}</style></head><body>' + frag + '</body></html>'
    : '<!DOCTYPE html><html data-theme="light"><head><meta charset="utf-8"><style>' + CSS + '</style></head><body><div id="view">' + frag + '</div></body></html>';
  writeFileSync(OUT + name + '-full.html', wrap);
  await page.goto('file://' + OUT + name + '-full.html');
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + name + '.png', fullPage: !name.startsWith('01') });
  await page.close();
  console.log('rendered', name + '.png');
}
await browser.close();
console.log('renders done ->', OUT);
process.exit(0);
