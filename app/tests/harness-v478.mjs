// harness-v478.mjs — v478 §2 evidence: the mini player stands on
// every tab. The defect (John, 2026-11-16 15:48 CT): the docked
// mini player "seems to be gated inside the section (formation)
// or audio" — census (§1) found the #dock element already
// shell-level (one element in SHELL_HTML, fixed at the foot,
// setTab never touches it); the gate is its STATE FEED at a page
// (re)birth: state.current re-stands only through the two
// queue-snapshot restores, and the podcast restore's only seats
// were its series page's (openPodSeries · the session-return
// re-read · nativeResolveStart's load), while applyNativeState
// adopts a current only through this session's contract descs.
// Legs (the real SHELL_HTML + APP_CSS + the whole cooked client
// in Chromium — the v439 mold; a fake Capacitor bridge for the
// native legs; one shared context per cold-page flow so the
// snapshot record persists across pages as across WebView
// reloads):
//   S   statics — one dock element · the boot fetch's route ·
//       the seeding's guards and both call seats
//   N   nothing loaded — no dock on any tab, either engine
//   P1  podcast in-session (native) — stands on every tab ·
//       pause + resume from a foreign tab (Conscience)
//   P2  day in-session (native) — stands into Formation
//   C1  podcast cold page (native) — THE GATE LEG: the dock
//       stands at boot without the series page opening
//   C2  advance tracking — a native advance moves the dock
//   C1w podcast cold page (web engine) — the same gate, no shell
//   C3  day cold page (native) — the standing boot stand, held
// Run: node app/tests/harness-v478.mjs   (from the worktree root)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- statics ---------------- */
{
  ok((U_SRC.match(/id="dock"/g) || []).length === 1 && !/id=\\?"dock/.test(C_SRC),
    'S1: exactly one #dock element stands (SHELL_HTML); client.ts builds no second dock');
  const bq = C_SRC.slice(C_SRC.indexOf('function bootQueueSnapshot'), C_SRC.indexOf('function tryStandPodcastRestore'));
  ok(bq.includes("api('/api/player/podcasts?series=' + encodeURIComponent(rec.series))") && bq.includes('tryStandPodcastRestore();'),
    'S2: the boot stand fetches the record series through the standing route and runs the standing restore');
  const seed = C_SRC.slice(C_SRC.indexOf('function seedNativeDescsFromRestore'), C_SRC.indexOf('function tryStandPodcastRestore'));
  ok(seed.includes('if (!oraNativeMode()) return;') && seed.includes('if (nativeContractDescs.length) return;')
    && seed.includes('nativeContractDescs = state.queue.slice();'),
    'S3: the seeding stands behind the native-mode + empty guards');
  const tpr = C_SRC.slice(C_SRC.indexOf('function tryStandPodcastRestore'), C_SRC.indexOf('/* ---------------- Played state'));
  const srq = C_SRC.slice(C_SRC.indexOf('function standRestoredQueue'), C_SRC.indexOf('audioEl.addEventListener(\'loadedmetadata\''));
  ok(tpr.includes('seedNativeDescsFromRestore();') && srq.includes('seedNativeDescsFromRestore();'),
    'S4: both restores carry the seeding call');
}

/* ---------------- fixtures + page ---------------- */
const TPL_A = C_SRC.indexOf('APP_JS = `') + 10;
const COOKED = new Function('return `' + C_SRC.slice(TPL_A, C_SRC.indexOf('`;', TPL_A)) + '`')();
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

const DAY = {
  ok: true, date: '2026-11-15', presentedDay: '2026-11-15',
  dateLabel: 'Sunday, November 15, 2026',
  liturgicalDay: { name: '33rd Sunday in Ordinary Time', color: 'green' },
  introTexts: {},
  blocks: [{ block: 'Morning', label: 'Morning', tracks: [
    { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
    { episodeId: '9002', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/9002.mp3' },
  ] }],
  episodes: [],
};
const POD_INDEX = { ok: true, seriesList: [
  { series: 'catechism', title: 'Catechism in a Year', kind: 'spotify', category: 'podcasts', available: true, listenedCount: 0, total: 2, currentLabel: 'Day 1', showImageUrl: '' },
]};
const POD_SERIES = { ok: true, series: 'catechism', title: 'Catechism in a Year', available: true,
  currentKey: 'ep1', listenedCount: 0, total: 2, showImageUrl: '', showDesc: '',
  entries: [
    { key: 'ep1', label: 'Day 1', title: 'In the Beginning', url: 'https://audio.example/ep1.mp3', durationS: 900, listened: false, positionS: 0, kind: 'day' },
    { key: 'ep2', label: 'Day 2', title: 'The Creation', url: 'https://audio.example/ep2.mp3', durationS: 900, listened: false, positionS: 0, kind: 'day' },
  ] };

const FAKE_PLUGIN = `
window.__contracts = []; window.__transports = []; window.__listeners = {};
window.Capacitor = { Plugins: { OraDayBridge: new Proxy({
  oneEngine: true,
  setNativeQueue: function (a) { try { window.__contracts.push(JSON.parse(a.queue)); } catch (e) {} return Promise.resolve({}); },
  nativeTransport: function (c) { try { window.__transports.push(JSON.parse(c.command)); } catch (e) { window.__transports.push(c); } return Promise.resolve({}); },
  setPlaybackState: function () { return Promise.resolve({}); },
  addListener: function (name, fn) { window.__listeners[name] = fn; return Promise.resolve({ remove: function () {} }); },
  takeNativeCompletions: function () { return Promise.resolve({ records: [] }); },
}, { get: function (t, k) { if (k in t) return t[k]; return function () { return Promise.resolve({}); }; } }) } };
`;

function buildPage(native) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${APP_CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
${native ? FAKE_PLUGIN : ''}
window.fetch = function (path, opts) {
  const p = String(path);
  if (p.indexOf('/api/player/day') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(DAY)}); } });
  if (p.indexOf('/api/player/podcasts?series=') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(POD_SERIES)}); } });
  if (p.indexOf('/api/player/podcasts') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(POD_INDEX)}); } });
  if (p.indexOf('/api/player/feed-audio') === 0) return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function(){ el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
HTMLMediaElement.prototype.load = function () {};
</` + `script>
<script>
${COOKED}
</` + `script>
</body></html>`;
}

let PAGE_NATIVE = '', PAGE_WEB = '';
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/n') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE_NATIVE); return; }
  if (u === '/w') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE_WEB); return; }
  res.statusCode = 404; res.end('not found');
});
PAGE_NATIVE = buildPage(true);
PAGE_WEB = buildPage(false);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function dockState(page) {
  return page.evaluate(() => {
    const d = document.getElementById('dock');
    return { n: document.querySelectorAll('#dock').length,
      hidden: d ? d.classList.contains('hidden') : null,
      title: d ? (document.getElementById('dock-title') || {}).textContent : null,
      tab: window.state ? state.tab : '?',
      current: window.state && state.current ? state.current.title : null };
  });
}
async function publish(page, trackId, queueIndex, playing) {
  await page.evaluate(([tid, qi, pl]) => {
    const fn = window.__listeners && window.__listeners['nativeState'];
    if (fn) fn({ state: JSON.stringify({ engine: 'native', playing: pl, positionS: 5, durationS: 900, rate: 1, trackId: tid, queueIndex: qi, ts: Date.now() }) });
  }, [trackId, queueIndex, playing]);
}
async function boot(ctx, mode, tag) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)));
  await page.goto(ORIGIN + (mode === 'native' ? '/n' : '/w'));
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note -', tag, 'openblock slow'));
  await sleep(500);
  return page;
}
async function waitDock(page, wantVisible, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await dockState(page);
    if (wantVisible ? !s.hidden : s.hidden) return s;
    await sleep(300);
  }
  return dockState(page);
}
async function startPodcast(page) {
  await page.click('#tabbar .tab[data-tab="podcasts"]');
  await sleep(800);
  await page.evaluate(() => { if (typeof switchPodSide === 'function') switchPodSide('podcasts'); });
  await sleep(600);
  await page.click('[data-podseries="catechism"]');
  await sleep(800);
  await page.click('[data-podplay="ep1"]');
  await sleep(900);
}

/* ---------------- N: nothing loaded ---------------- */
for (const mode of ['native', 'web']) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, mode, 'N-' + mode);
  let allHidden = true, oneDock = true;
  for (const tab of ['prayers', 'podcasts', 'conscience', 'wallpaper']) {
    await page.click('#tabbar .tab[data-tab="' + tab + '"]');
    await sleep(700);
    const s = await dockState(page);
    if (!s.hidden) allHidden = false;
    if (s.n !== 1) oneDock = false;
  }
  ok(allHidden, 'N (' + mode + '): nothing loaded — no dock on any tab');
  ok(oneDock, 'N (' + mode + '): exactly one #dock in the DOM throughout');
  await ctx.close();
}

/* ---------------- P1 + P2: in-session (native) ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, 'native', 'P1');
  await startPodcast(page);
  let s = await dockState(page);
  ok(!s.hidden && s.title.indexOf('In the Beginning') >= 0, 'P1: podcast start — the dock stands in Formation, naming the episode', JSON.stringify(s));
  for (const tab of ['conscience', 'wallpaper', 'prayers']) {
    await page.click('#tabbar .tab[data-tab="' + tab + '"]');
    await sleep(800);
    s = await dockState(page);
    ok(!s.hidden && s.n === 1 && s.title.indexOf('In the Beginning') >= 0, 'P1: the dock stands on tab=' + tab, JSON.stringify(s));
  }
  // pause + resume from a foreign tab (Conscience)
  await page.click('#tabbar .tab[data-tab="conscience"]');
  await sleep(800);
  await publish(page, 'ep1', 0, true);
  await sleep(300);
  await page.click('#dock-play');
  await sleep(500);
  let cmds = await page.evaluate(() => window.__transports.map((c) => c && c.command));
  ok(cmds.includes('pause'), 'P1: dock play on Conscience pauses the engine (transport: pause)', cmds.join(','));
  await publish(page, 'ep1', 0, false);
  await sleep(300);
  await page.click('#dock-play');
  await sleep(500);
  cmds = await page.evaluate(() => window.__transports.map((c) => c && c.command));
  ok(cmds.filter((c) => c === 'play').length >= 1, 'P1: dock play on Conscience resumes the engine (transport: play)', cmds.join(','));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, 'native', 'P2');
  await page.click('[data-openblock="Morning"]');
  await sleep(700);
  await page.click('[data-playkey="9001"]');
  await sleep(900);
  await page.click('#tabbar .tab[data-tab="podcasts"]');
  await sleep(800);
  const s = await dockState(page);
  ok(!s.hidden && s.title === 'Invitatory', 'P2: day start on Praylist — the dock stands into Formation', JSON.stringify(s));
  await ctx.close();
}

/* ---------------- C1 + C2: podcast cold page (native) — the gate ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const p1 = await boot(ctx, 'native', 'C1-p1');
  await startPodcast(p1);
  const rec = await p1.evaluate(() => localStorage.getItem('opn-queue-v355'));
  ok(!!rec && rec.includes('"form":"podcast"'), 'C1 precondition: the podcast snapshot record stands', String(rec).slice(0, 120));
  await p1.close();

  const p2 = await boot(ctx, 'native', 'C1-p2');
  await publish(p2, 'ep1', 0, true); // the service re-delivers its standing state
  let s = await waitDock(p2, true, 9000);
  ok(!s.hidden && s.title.indexOf('In the Beginning') >= 0,
    'C1: cold page — the dock stands at boot WITHOUT the series page opening', JSON.stringify(s));
  for (const tab of ['podcasts', 'conscience', 'wallpaper', 'prayers']) {
    await p2.click('#tabbar .tab[data-tab="' + tab + '"]');
    await sleep(800);
    s = await dockState(p2);
    ok(!s.hidden && s.n === 1, 'C1: the boot stand persists on tab=' + tab + ' (one dock)', JSON.stringify(s));
  }
  await publish(p2, 'ep2', 1, true); // the engine advances
  await sleep(600);
  s = await dockState(p2);
  ok(s.title.indexOf('The Creation') >= 0 && s.current && s.current.indexOf('The Creation') >= 0,
    'C2: a native advance after the boot stand moves the dock (the seeding tracks)', JSON.stringify(s));
  await ctx.close();
}

/* ---------------- C1w: podcast cold page (web engine) ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const p1 = await boot(ctx, 'web', 'C1w-p1');
  await startPodcast(p1);
  const rec = await p1.evaluate(() => localStorage.getItem('opn-queue-v355'));
  ok(!!rec && rec.includes('"form":"podcast"'), 'C1w precondition: the podcast snapshot record stands (web)', String(rec).slice(0, 120));
  await p1.close();
  const p2 = await boot(ctx, 'web', 'C1w-p2');
  const s = await waitDock(p2, true, 9000);
  ok(!s.hidden && s.title.indexOf('In the Beginning') >= 0,
    'C1w: cold page, web engine — the dock stands at boot without the series page', JSON.stringify(s));
  await ctx.close();
}

/* ---------------- C3: day cold page (native) — the standing stand ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const p3 = await boot(ctx, 'native', 'C3-p3');
  await p3.click('[data-openblock="Morning"]');
  await sleep(700);
  await p3.click('[data-playkey="9001"]');
  await sleep(900);
  await p3.close();
  const p4 = await boot(ctx, 'native', 'C3-p4');
  await publish(p4, '9001', 0, false);
  const s = await waitDock(p4, true, 9000);
  ok(!s.hidden && s.title === 'Invitatory', 'C3: day cold page — the dock stands at boot (standing behavior held)', JSON.stringify(s));
  await p4.click('#tabbar .tab[data-tab="conscience"]');
  await sleep(800);
  const s2 = await dockState(p4);
  ok(!s2.hidden, 'C3: the day boot stand persists onto Conscience', JSON.stringify(s2));
  await ctx.close();
}

await browser.close();
server.close();
console.log('\nharness-v478: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
