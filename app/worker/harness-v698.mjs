// harness-v698.mjs — v698: web Benedictine prayer list
// only (Plan §2.5). The two <p class="sub"> introduction
// paragraphs (honor line + descriptive paragraph) are
// removed from opnWebBenedictineHtml692; the title, the
// card wrapper, and the full prayer list stand.
//
// Fixtures (Improvement D — production shapes): reused
// from harness-v692's own worlds — its SEED source-
// settings fixture (the production seed shape feeding
// opnStandingContents597), its __mkDay692 day payload,
// its plain-tab web page (no shell, no installed PWA →
// opnMode() === 'web'), and its installed-PWA device
// page. No hand-built Benedictine record: the shape is
// opnStarterRecord692('benedictine', …) over the real
// seed + the real mig609 transform, as production paints.
//
// Byte-identity legs (O1/N2): when V698_BASE_WT names a
// pre-change tree, that tree's bundle is built and
// served beside the current one and the extracted
// strings are compared byte for byte. Without it, O1/N2
// fall back to their structural assertions and print
// BYTE lines for an external diff. With ORA_WT set the
// whole harness runs against that tree (fail-on-old).
//
// Run: node app/worker/harness-v698.mjs
//  or: V698_BASE_WT=<base tree> node app/worker/harness-v698.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const BASE_WT = process.env.V698_BASE_WT ? path.resolve(process.env.V698_BASE_WT) : null;
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
const legBad = {};
function check(leg, name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + leg + ' ' + name); }
  else { bad++; legBad[leg] = (legBad[leg] || 0) + 1; console.log('FAIL ' + leg + ' ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
check('F', 'today (America/Chicago) stands for the fixtures', /^\d{4}-\d{2}-\d{2}$/.test(TODAY), TODAY);

const clientSrc = readFileSync(path.join(W, 'src/client.ts'), 'utf8');
const seedMatch = clientSrc.match(/var OPN_SEED_SOURCES = (\[[\s\S]*?\]);/);
const SEED = JSON.parse(seedMatch[1]);
check('F', 'fixture: the seed extracted from this tree carries exactly 26 source rows', SEED.length === 26, SEED.length);

// ---------- build + serve a real bundle for a tree ----------
async function buildServe(wt) {
  const wdir = path.join(wt, 'app/worker');
  const tmp = mkdtempSync(tmpdir() + '/v698harness-');
  execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
    [path.join(wdir, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + tmp + '/index.cjs'], { stdio: 'pipe' });
  const mod = await import(tmp + '/index.cjs');
  const worker = mod.default?.default || mod.default;
  const env = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
  const shell0 = await (await worker.fetch(new Request('https://app.local/'), env)).text();
  const shell = shell0.replace('window.__OPN_SHAPE__="private"', 'window.__OPN_SHAPE__="public"');
  const appjs = await (await worker.fetch(new Request('https://app.local/app.js'), env)).text();
  const css = await (await worker.fetch(new Request('https://app.local/styles.css'), env)).text();
  const mk = (sh) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(appjs); }
      if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(css); }
      res.writeHead(200, { 'content-type': 'text/html' }); res.end(sh);
    });
    return server;
  };
  const pub = mk(shell); await new Promise((r) => pub.listen(0, '127.0.0.1', r));
  const priv = mk(shell0); await new Promise((r) => priv.listen(0, '127.0.0.1', r));
  return { pub, priv, pubPort: pub.address().port, privPort: priv.address().port, shell };
}

const main = await buildServe(WT);
check('F', 'the public shell shape stands for the mode legs', main.shell.includes('window.__OPN_SHAPE__="public"'));
const base = BASE_WT ? await buildServe(BASE_WT) : null;

// ---------- page factory (harness-v692 worlds) ----------
const b = await chromium.launch({ executablePath: EXE });
async function newPage(port, device) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 200)));
  await pg.addInitScript(({ SEED, TODAY, device }) => {
    if (device) {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q) => String(q).includes('standalone')
        ? { matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }
        : mm(q);
    }
    const clone = (x) => JSON.parse(JSON.stringify(x));
    window.__mkDay692 = (date) => ({
      ok: true, date, presentedDay: date, dateLabel: date,
      blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
      additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
    });
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(clone(body)), text: () => Promise.resolve('') });
    window.fetch = (url) => {
      const u = String(url);
      if (u.includes('/api/player/day')) { const m = /date=([0-9-]+)/.exec(u); return resp(window.__mkDay692(m ? m[1] : TODAY)); }
      if (u.includes('/api/player/source-settings')) return resp({ ok: true, version: 1, sources: clone(SEED) });
      if (u.includes('/api/prayer/book')) return resp({ ok: true, groups: [] });
      if (u.includes('/api/player/podcasts')) return resp({ ok: true, seriesList: [] });
      if (u.includes('/api/player/track-draws')) return resp({ ok: true, draws: {} });
      return new Promise(() => {});
    };
  }, { SEED, TODAY, device });
  await pg.goto('http://127.0.0.1:' + port + '/');
  await pg.waitForTimeout(1600);
  return pg;
}

const extractCards = () => OPN_SEED_PROFILES.map((s) => opnStarterCardHtml692(s, s.key === 'salesian', 'data-p692starter')).join('');
const extractNative = () => {
  const offer = opnStarterOfferHtml692();
  opnOpenStarterPick692({ title: 'Add', includeEmpty: true, onPick: () => {} });
  const sh = document.querySelector('.p692pick');
  const pick = sh ? sh.innerHTML : '';
  if (sh) sh.remove();
  return offer + '\n@@PICK@@\n' + pick;
};

// ---------- WEB legs ----------
const pgw = await newPage(main.pubPort, false);
check('W1', 'web mode stands in a plain tab', await pgw.evaluate(() => opnMode()) === 'web');
await pgw.evaluate(() => opnEnsureStandings601());
const html = await pgw.evaluate(() => opnWebBenedictineHtml692());
const blocks = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
check('W1', 'the list stands complete: wrapper marker + every block <h4> + >=6 <li>',
  !!html && html.includes('data-p692webben="1"') && blocks.every((bl) => html.includes('<h4>' + bl + '</h4>')) && (html.match(/<li>/g) || []).length >= 6, (html || '').slice(0, 300));
check('W1', 'the Morning block carries the readings seat', !!html && html.includes('readings'), (html || '').slice(0, 400));
check('W1', 'the Novenas arm stands with its list', !!html && html.includes('<h4>Novenas</h4>') && html.indexOf('<h4>Novenas</h4>') > html.indexOf('<h4>Night</h4>'), (html || '').slice(-300));
check('W2', 'no introduction: descriptive sentence absent, honor-line text absent, no <p class="sub"> in the card',
  !!html && !html.includes('A complete day of prayer, shown in full') && !html.includes('named in honor of the tradition') && !html.includes('<p class="sub">'), (html || '').slice(0, 300));
check('W2', 'the first <h4> follows the title directly; the Way name stands (OPEN-1)',
  !!html && html.includes('<h3>The Benedictine Way</h3>') && html.split('</h3>')[1].startsWith('<h4>'), (html || '').slice(0, 200));
{
  const home = await pgw.evaluate(({ TODAY }) => {
    state.dayPayload = window.__mkDay692(TODAY);
    state.prayersView = { kind: 'home' };
    paintPrayersView(state.dayPayload);
    return document.body.innerHTML;
  }, { TODAY });
  check('W3', 'the painted web home carries the list (marker + block names)',
    home.includes('data-p692webben="1"') && blocks.every((bl) => home.includes('<h4>' + bl + '</h4>')), home.slice(0, 200));
  check('W3', 'the painted web home carries NEITHER introduction text NOR the starter offer',
    !home.includes('A complete day of prayer, shown in full') && !home.includes('named in honor of the tradition') && !home.includes('data-p692offer'));
  check('W3', 'nothing is stored and no pick is offered on web',
    await pgw.evaluate(() => localStorage.getItem('opn-personal-data-v1')) === null && !home.includes('data-p692pick') && !home.includes('data-p692starter'));
}

// ---------- O1: other Ways' starter cards ----------
const cards = await pgw.evaluate(extractCards);
console.log('BYTE O1 ' + JSON.stringify(cards));
check('O1', 'all three starter cards carry name, blocks, time, guidance, honor line, becoming-yours',
  ['The Little Way', 'The Salesian Way', 'The Benedictine Way'].every((n) => cards.includes(n))
  && (cards.match(/named in honor of the tradition/g) || []).length === 3
  && (cards.match(/Becomes your own profile/g) || []).length === 3
  && cards.includes('Two anchors in the day') && cards.includes('Every hour of the day'), cards.slice(0, 300));
if (base) {
  const pgwb = await newPage(base.pubPort, false);
  const baseCards = await pgwb.evaluate(extractCards);
  check('O1', 'starter cards byte-identical vs base tree', cards === baseCards, { cur: cards.length, base: baseCards.length });
  await pgwb.close();
} else {
  check('O1', 'byte-identity vs base: no V698_BASE_WT given — BYTE line printed for external diff (structural leg above stands)', true);
}

// ---------- N1/N2: device + server ----------
const pgd = await newPage(main.pubPort, true);
check('N1', 'device mode stands through the installed-PWA seam', await pgd.evaluate(() => opnMode()) === 'device');
check('N1', 'the function returns \'\' in device mode', await pgd.evaluate(() => opnWebBenedictineHtml692()) === '');
{
  const devHome = await pgd.evaluate(({ TODAY }) => {
    state.dayPayload = window.__mkDay692(TODAY);
    state.prayersView = { kind: 'home' };
    paintPrayersView(state.dayPayload);
    return document.body.innerHTML;
  }, { TODAY });
  check('N1', 'a device-mode paint carries no web card', !devHome.includes('p692webben'));
}
const pgs = await newPage(main.privPort, false);
check('N1', 'server mode stands on the private shell; the function returns \'\' there',
  await pgs.evaluate(() => opnMode()) === 'server' && await pgs.evaluate(() => opnWebBenedictineHtml692()) === '');
await pgs.close();

const native = await pgd.evaluate(extractNative);
console.log('BYTE N2 ' + JSON.stringify(native));
check('N2', 'the native starter offer + pick carry names, honor lines, guidance, Salesian Start here',
  native.includes('data-p692offer') && (native.match(/named in honor of the tradition/g) || []).length >= 3
  && native.includes('Start here') && native.includes('Becomes your own profile'), native.slice(0, 300));
if (base) {
  const pgdb = await newPage(base.pubPort, true);
  const baseNative = await pgdb.evaluate(extractNative);
  check('N2', 'native starter offer + pick byte-identical vs base tree', native === baseNative, { cur: native.length, base: baseNative.length });
  await pgdb.close();
} else {
  check('N2', 'byte-identity vs base: no V698_BASE_WT given — BYTE line printed for external diff (structural leg above stands)', true);
}

await pgw.close(); await pgd.close();
await b.close();
main.pub.close(); main.priv.close();
if (base) { base.pub.close(); base.priv.close(); }
for (const leg of ['W1', 'W2', 'W3', 'O1', 'N1', 'N2']) console.log('LEG ' + leg + ': ' + (legBad[leg] ? 'FAIL (' + legBad[leg] + ')' : 'pass'));
console.log('\nharness-v698: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
