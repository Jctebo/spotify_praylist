// renders-v607.mjs — v607 Review renders: drive the
// BUILT client (jsdom world over the production
// fixtures, the harness-v607 recipes) to the states the
// Review record names and capture the REAL markup the
// client paints. Output: HTML captures in
// ~/workspace/projects/ora-pro-nobis/v607-review-renders/
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const OUT = process.env.HOME + '/workspace/projects/ora-pro-nobis/v607-review-renders/';
mkdirSync(OUT, { recursive: true });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

const a = clientSrc.indexOf('= `') + 3, b = clientSrc.indexOf('\n`;', a);
const appJs = vm.runInContext('`' + clientSrc.slice(a, b) + '`', vm.createContext({}));
const ss = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(ss, uiSrc.indexOf('`;', ss)) + '`', vm.createContext({}));
const { JSDOM } = await import('jsdom');
const { webcrypto } = await import('node:crypto');
const HOOK = '\n;window.__opn = { openConfigureLadder593, opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, opn604: (typeof opn604 !== "undefined" ? opn604 : null) };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function makeWorld(store) {
  const dom = new JSDOM(SHELL.replace('<!--OPN_SHAPE-->', 'public'), { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  if (store) w.localStorage.setItem(DATA_KEY, JSON.stringify(store));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function publicDay(date) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({
    block: bl, label: bl, caption: '', spotifyUrl: null,
    tracks: ['One', 'Two'].map((t, i) => ({ episodeId: bl + '-t' + i, title: t, state: 'present', available: true, streamUrl: 'https://example.invalid/' + bl + '-' + i + '.mp3', durationS: 60 })),
    trackCount: 2
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function snap(w, name, note) {
  const view = w.document.getElementById('view');
  writeFileSync(OUT + name, '<!-- v607 Review render: ' + note + ' -->\n' + (view ? view.innerHTML : w.document.body.innerHTML));
  console.log('render', name);
}

const w = makeWorld(JSON.parse(JSON.stringify(JOHN)));
await sleep(400);
const O = w.__opn, d = w.document;
const paint = () => { const day = O.opnFoldDay590(publicDay(TODAY)); O.state.dayPayload = day; O.paintPrayersView(day); };
paint(); await sleep(600); paint();
snap(w, '01-prayer-posture-top-edit.html', 'the Praylist at rest: ONE Edit act at the top (plan row), Pick under its own name, blocks collapsed');
click(w, d.querySelector('[data-openblock="Morning"]'));
await sleep(80);
snap(w, '02-expanded-prayer-posture.html', 'Morning expanded in prayer posture: Play All head, track rows, NO per-block Edit / Block page acts');
O.opn604.scope = 'standing';
click(w, d.querySelector('[data-p607edit]'));
await sleep(300);
snap(w, '03-whole-page-edit-form.html', 'after the ONE top Edit (scope pre-set standing): frozen banner + frozen edit bar (Save New greyed clean, overflow, Done) + shape strip (Blocks & layers switches) + EVERY block expanded in edit form (drag handles, remove, Add)');
O.openConfigureLadder593();
await sleep(150);
snap(w, '04-configure-ladder-after-retire.html', 'the Configure ladder after v607: head + the word line stand; NO Edit today door, NO Edit profiles door');
console.log('renders done ->', OUT);
process.exit(0);
