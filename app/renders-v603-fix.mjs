// renders-v603-fix.mjs — v603 Review round 2 (the
// named-novena fix): re-render novenas-4-composed.png
// from the FIXED client's own fold (opnFoldDay590 +
// extRebuildDescs, the harness-v603 N recipe) over the
// production fixtures. Two postures side by side for
// Sat Nov 21, 2026: (A) a named novena ALONE in the
// block's contents — before the fix this composed
// EMPTY; (B) the ladder-written shape, all-novenas +
// the named novena — the named stands exactly once.
// The day's novenas slot is built from the production
// catalog fixture by the feed's window rule (startDate
// + total days; Day n = offset + 1): nine novenas run
// on 2026-11-21, christ_the_king at Day 9. The picture
// paints the fold's output (track titles) in the app's
// own CSS card dress, rasterized in headless Chromium.
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
const HOOK = '\n;window.__opn = { opnFoldDay590, extRebuildDescs, state };';
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
async function compose(contents) {
  const doc = JSON.parse(JSON.stringify(JOHN));
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === 'salesian');
  sal.contents = Object.assign({}, sal.contents || {}, { Novenas: contents });
  const dom = new JSDOM(SHELL.replace('<!--OPN_SHAPE-->', 'public'), { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  w.localStorage.setItem(DATA_KEY, JSON.stringify(doc));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
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
  const out = descs.filter((d) => String(d.episodeId || '').indexOf('novena-') === 0).map((d) => ({ id: d.episodeId, title: d.title }));
  w.close();
  return out;
}
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function postureHtml(label, contentsLine, tracks) {
  let h = '<div class="card" style="flex:1;min-width:0"><div class="titlerow"><h3>' + esc(label) + '</h3></div>'
    + '<div class="meta">' + esc(contentsLine) + '</div><div style="height:8px"></div>';
  tracks.forEach((t) => { h += '<div class="row" style="padding:6px 0;border-top:1px solid var(--line,#2a2f36)"><div class="grow"><div>' + esc(t.title) + '</div></div></div>'; });
  if (!tracks.length) h += '<div class="meta">No tracks — the block composes empty.</div>';
  h += '<div class="meta" style="margin-top:8px">' + tracks.length + ' track' + (tracks.length === 1 ? '' : 's') + '</div></div>';
  return h;
}
const A = await compose([{ kind: 'novena', key: 'christ_the_king' }]);
const B = await compose([{ kind: 'all-novenas' }, { kind: 'novena', key: 'christ_the_king' }]);
console.log('posture A (named alone):', A.length, A.map((t) => t.id).join(','));
console.log('posture B (both standing):', B.length, B.map((t) => t.id).join(','));
const ckB = B.filter((t) => t.id === 'novena-christ_the_king').length;
const sheet = '<div style="padding:14px"><div class="card"><div class="titlerow"><h3>The Novenas block, composed — Sat Nov 21, 2026</h3></div>'
  + '<div class="meta">The fixed fold\u2019s own output (opnFoldDay590 + extRebuildDescs) over the production fixtures. The day\u2019s slot carries the nine novenas running that day.</div></div>'
  + '<div style="height:10px"></div><div style="display:flex;gap:12px;align-items:flex-start">'
  + postureHtml('A — a named novena ALONE', 'Contents: Novena to Christ the King only (\u201cEvery active novena\u201d off). Before the fix: empty.', A)
  + postureHtml('B — BOTH standing', 'Contents: Every active novena + Novena to Christ the King. The named novena stands ' + ckB + ' time' + (ckB === 1 ? '' : 's') + ' — no duplicate.', B)
  + '</div></div>';

import { createRequire } from 'node:module';
const { chromium } = createRequire(process.env.HOME + '/workspace/.tools/pwtest/package.json')('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
const html = '<!DOCTYPE html><html data-theme="light"><head><meta charset="utf-8"><style>' + CSS + '</style><style>html,body{height:auto;background:#101418}</style></head><body>' + sheet + '</body></html>';
writeFileSync(OUT + 'novenas-4-composed.html', html);
await page.goto('file://' + OUT + 'novenas-4-composed.html');
await page.waitForTimeout(250);
await page.screenshot({ path: OUT + 'novenas-4-composed.png', fullPage: true });
await page.close();
await browser.close();
console.log('rendered novenas-4-composed.png');
