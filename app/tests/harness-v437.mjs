// harness-v437 — Mini player gap + bottom bar excess space
// (§1/§2 of the v437 release document; John's report
// 2026-11-15 01:32 CT: "There is a gap between the prayers
// and the mini player and the bottom bar has too much
// space"). Client-only delta: ui.ts (the in-shell override,
// the flush dock bottom, the measured reserve) + client.ts
// (the boot in-shell class; the rAF-throttled resize
// re-measure). Legs G1–G8 per Plan §2.7, run in headless
// Chromium on the v388/v417 extraction mold (real SHELL_HTML
// + APP_CSS, fixture state), 412px.
//
// THE MOLD'S INSET STAND-IN (§2.5's honest limit, worked
// around — not hidden): desktop Chromium computes
// env(safe-area-inset-bottom) to 0, so the mold cannot stand
// a nonzero inset up from the env() itself. The harness
// therefore appends ONE harness-only rule after the app CSS
// — .tabbar { padding-bottom: 30px; } — a 30px stand-in
// inset (John's phone's measured ≈30px, §1.3). The base
// .tabbar rule and the stand-in share specificity (0,1,0),
// the stand-in later, so on the web branch the stand-in IS
// the bar's padding (the inset's seat); the v437 override
// html.in-shell .tabbar (0,2,1) beats it in-shell. Every
// geometry leg then proves the DELTA and the FLUSH with
// live rects at the stand-in's 30px, which is exactly
// §2.9's table (env = 30): bar 96 → 66 · dock offset
// 104 → 66 · reserve 158 → 128. What the mold still cannot
// prove is that a real device's env() returns the nonzero
// value — that stands as field leg 6 (§2.5/§2.8), recorded
// here as the proof's shape, never rounded into a pass.
//
// THE BOOT SEGMENT runs the shipped lines, not a copy: the
// harness extracts client.ts's own v437 boot block (the
// class add, the throttled listener, the first measureBars)
// and evaluates it in the page after the extracted client
// loads. G1's order proof rides on it: --tabh is read
// immediately after the segment's own measureBars() — had
// the class add stood after that call, --tabh would read
// the uncorrected bar (stack + 30), not the stack.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const SIM_CSS = APP_CSS + '\n/* harness-v437 only: the 30px stand-in inset (see header) */\n.tabbar { padding-bottom: 30px; }\n';

/* ---------------- the boot segment, extracted ---------------- */
const SEG_START = C_SRC.indexOf('/* v437 (§2.1/§2.4)');
const SEG_END = SEG_START < 0 ? -1 : C_SRC.indexOf('\nmeasureBars();', SEG_START);
const BOOT_SEG = (SEG_START < 0 || SEG_END < 0) ? '' : C_SRC.slice(SEG_START, SEG_END + '\nmeasureBars();'.length);

/* ---------------- G7/G8 statics + segment statics ---------------- */
{
  ok(BOOT_SEG.length > 0 && BOOT_SEG.indexOf("classList.add('in-shell')") > -1
    && BOOT_SEG.indexOf("classList.add('in-shell')") < BOOT_SEG.indexOf('measureBars();')
    && BOOT_SEG.includes("addEventListener('resize'") && BOOT_SEG.includes('requestAnimationFrame')
    && BOOT_SEG.includes('if (oraInShell())'),
    'S (G1/G6): the boot segment stands in client.ts — the guarded in-shell class add BEFORE the first measureBars(), the rAF-throttled resize listener between them');
  ok(!C_SRC.includes("addEventListener('resize', measureBars)"),
    'S (G6): the unthrottled resize form (standing since v326) is retired — no direct resize→measureBars registration stands');
  ok(U_SRC.includes('html.in-shell .tabbar { padding-bottom: 0; }') && (U_SRC.match(/in-shell/g) || []).length === 1,
    'G8 (static): the in-shell override stands exactly once in ui.ts, unconditional — no media query, no inset-size condition keys on it');
  ok(U_SRC.includes('padding-bottom: env(safe-area-inset-bottom); border-top:1px solid rgba(250,245,236,.25); box-shadow:0 -4px 14px rgba(42,38,32,.14); }'),
    'G2 (static): the base .tabbar rule keeps padding-bottom: env(safe-area-inset-bottom) byte-unchanged — the web branch is the base rule itself');
  const dockRule = U_SRC.slice(U_SRC.indexOf('.dock {'), U_SRC.indexOf('}', U_SRC.indexOf('.dock {')));
  ok(dockRule.includes('bottom: var(--tabh, 0px);') && !dockRule.includes('+ 8px') && !U_SRC.includes('bottom: calc(var(--tabh, 0px) + 8px)'),
    'G3 (static): the dock bottom reads var(--tabh, 0px) exactly — the + 8px survives nowhere');
  ok(U_SRC.includes('body.dock-on .view { padding-bottom: calc(var(--tabh, 0px) + var(--dockh, 60px)); }') && !U_SRC.includes('calc(96px + var(--dockh'),
    'G4 (static): the reserve reads calc(var(--tabh, 0px) + var(--dockh, 60px)) — the hardcoded 96px bar allowance is retired');
  ok(U_SRC.includes('.sheet.np-sheet { background:var(--cream); display:block; overflow:auto; padding:14px 14px 40px; animation:none; }'),
    'G7: the Now Playing sheet padding declaration stands byte-identical (14px 14px 40px — it keys off nothing in this change set)');
  ok(U_SRC.includes('.view { padding: 14px 12px 96px;'),
    'G7: the .view standing 96px bottom pad stands byte-identical (the dock-absent form, §2.3)');
  const tabs = [...SHELL.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]).join(',');
  ok(tabs === 'prayers,conscience,podcasts,wallpaper'
    && SHELL.includes('<span>Prayers</span>') && SHELL.includes('<span>Conscience</span>')
    && SHELL.includes('<span>Podcasts</span>') && SHELL.includes('<span>Wallpaper</span>'),
    'G7: tab order and labels stand (Prayers · Conscience · Podcasts · Wallpaper)');
  ok(U_SRC.includes("added height is absorbed by the standing --tabh\n   measurement (the dock seats on the measured value)"),
    'G7: the v419 G18 comment stands byte-identical — its premise (the standing --tabh measurement governs) survives: the measurement still governs, the measured value is now the true one');
  ok(U_SRC.includes('ora-pro-nobis-v435-1') && !I_SRC.includes('in-shell'),
    'S (housekeeping): the SW pin stands at ora-pro-nobis-v435-1 (Ship moves it); no index.ts delta (client-only)');
}

/* ---------------- client extraction (v388/v417 mold) ---------------- */
function scanDecls(src) {
  const out = []; const lines = src.split('\n'); let li = 0;
  while (li < lines.length) {
    const line = lines[li];
    let m = line.match(/^function ([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { out.push({ kind: 'fn', name: m[1], startLine: li }); li++; continue; }
    m = line.match(/^var ([A-Za-z_$][\w$]*)\s*=/);
    if (m) { out.push({ kind: 'var', name: m[1], startLine: li }); li++; continue; }
    li++;
  }
  return { out, lines };
}
function countBraces(s) { let n = 0; for (const ch of s) { if (ch === '{') n++; else if (ch === '}') n--; } return n; }
function unit(lines, startLine, kind) {
  if (kind === 'var') {
    let depth = 0, started = false; const buf = [];
    for (let i = startLine; i < lines.length; i++) {
      buf.push(lines[i]);
      for (const ch of lines[i]) { if (ch === '{' || ch === '[' || ch === '(') { depth++; started = true; } else if (ch === '}' || ch === ']' || ch === ')') depth--; }
      if (started && depth <= 0 && /;\s*$/.test(lines[i])) break;
      if (!started && /;\s*$/.test(lines[i])) break;
    }
    return buf.join('\n');
  }
  let depth = 0, opened = false; const buf = [];
  for (let i = startLine; i < lines.length; i++) {
    buf.push(lines[i]); depth += countBraces(lines[i]); if (lines[i].includes('{')) opened = true;
    if (opened && depth <= 0) break;
  }
  return buf.join('\n');
}
const EXCLUDE = new Set(['refreshPlayedChrome', 'extFetchText']);
const { out: decls, lines } = scanDecls(C_SRC);
const pieces = [], dropped = [];
for (const d of decls) {
  if (d.name === 'state') continue;
  if (EXCLUDE.has(d.name)) continue;
  const u = unit(lines, d.startLine, d.kind);
  try { if (d.kind === 'fn') new Function('return (' + u + ')'); else new Function(u); pieces.push(u); }
  catch (e) { dropped.push(d.name); }
}
console.log('note - extraction dropped:', dropped.join(', ') || 'none');

const BRIDGE_STUB = `<script>
window.Capacitor = { Plugins: {
  OraDayBridge: {
    setDaySnapshot: function () { return Promise.resolve(); },
    setPlaybackState: function () { return Promise.resolve(); },
    addListener: function () { return Promise.resolve({ remove: function () {} }); },
    armSleepDeadline: function () { return Promise.resolve(); },
    clearSleepDeadline: function () { return Promise.resolve(); },
    getWallpaperSettings: function () { return {}; },
    setWallpaperSettings: function () { return {}; }
  },
  App: { addListener: function () { return Promise.resolve({ remove: function () {} }); } }
} };
</` + `script>`;

function pageHtml(css, stub) {
  const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
SHELLHERE
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  window.__fetchLog.push({ path: String(path), method: (opts && opts.method) || 'GET' });
  if (String(path).indexOf('/api/player/feed-audio') === 0) {
    return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  }
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
function refreshPlayedChrome() {}
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
</` + `script>
STUBHERE
<script>
var state = { tab: 'prayers', examMode: 'quick', examCat: null, deepIdx: 0, block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
  storedDay: '2026-11-15', presentedDay: '2026-11-15', dateLabel: 'Sunday, November 15', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: {},
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
  ownStanding: [], extStanding: [], extSlots: {}, ownSlots: {}, daySegments: {}, homeFilter: '', gridDl: {}, aiClaimed: false };
</` + `script>`;
  return head.replace('CSSHERE', () => css).replace('SHELLHERE', () => SHELL).replace('STUBHERE', () => stub || '')
    + '<script>\n' + pieces.join('\n') + '\n</' + 'script></body></html>';
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
let currentHtml = '';
const server = http.createServer((req, res) => {
  const p = (req.url || '/').split('?')[0];
  if (p === '/logo.png') { res.setHeader('Content-Type', 'image/png'); res.end(PNG); return; }
  if (p === '/') { res.setHeader('Content-Type', 'text/html'); res.end(currentHtml); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function openPage(css, stub) {
  currentHtml = pageHtml(css, stub);
  const pg = await browser.newPage({ viewport: { width: 412, height: 915 } });
  pg.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
  await pg.goto(ORIGIN + '/');
  return pg;
}
const bootSeg = (pg) => pg.evaluate((seg) => { (0, eval)(seg); }, BOOT_SEG);
const geom = (pg) => pg.evaluate(() => {
  const tb = document.getElementById('tabbar');
  const tab = tb.querySelector('.tab');
  const dk = document.getElementById('dock');
  const vw = document.getElementById('view');
  const cs = getComputedStyle(tb);
  return {
    inShell: document.documentElement.classList.contains('in-shell'),
    tabhVar: document.documentElement.style.getPropertyValue('--tabh'),
    dockhVar: document.documentElement.style.getPropertyValue('--dockh'),
    barH: tb.offsetHeight, tabH: tab.offsetHeight, padB: cs.paddingBottom,
    dockH: dk.offsetHeight, dockTop: dk.getBoundingClientRect().top, dockBottom: dk.getBoundingClientRect().bottom,
    barTop: tb.getBoundingClientRect().top, viewPadB: getComputedStyle(vw).paddingBottom,
    dockOn: document.body.classList.contains('dock-on'), dockHidden: dk.classList.contains('hidden')
  };
});

/* ================= PAGE A — in-shell, stand-in inset ================= */
const pageA = await openPage(SIM_CSS, BRIDGE_STUB);
{
  const pre = await pageA.evaluate(() => ({
    fn: typeof measureBars === 'function' && typeof oraInShell === 'function' && oraInShell() === true,
    tabhVar: document.documentElement.style.getPropertyValue('--tabh'),
    inShell: document.documentElement.classList.contains('in-shell')
  }));
  ok(pre.fn && pre.tabhVar === '' && !pre.inShell,
    'boot: the extracted client stands; before the boot segment runs, no measure has landed and no class stands (the segment is the first measure)');
  await pageA.evaluate(() => {
    window.__mbCount = 0;
    const orig = measureBars;
    measureBars = function () { window.__mbCount++; return orig(); };
  });
  await bootSeg(pageA);
  const g = await geom(pageA);
  const stack = g.tabH + 1; // the tab segment + the bar's 1px top border
  ok(g.inShell, 'G1: the bridge stub stands → the boot adds in-shell to <html>', JSON.stringify(g));
  ok(g.padB === '0px',
    'G1: in-shell, the bar\u2019s computed padding-bottom is 0px — the override takes the stand-in inset out', JSON.stringify(g));
  ok(g.barH === stack,
    'G1 (F-437-I5): the in-shell bar stands at the design stack — tab segment + border; the mold\u2019s measured stack is recorded in §3', JSON.stringify({ barH: g.barH, stack }));
  ok(g.tabhVar === stack + 'px',
    'G1 (order, F-437-I2): --tabh read immediately after the boot segment equals the CORRECTED bar — the class add stood before the segment\u2019s measureBars(); after it, --tabh would read stack + 30', JSON.stringify(g));

  /* ---- a track stands: G3 flush + G4 reserve ---- */
  await pageA.evaluate(() => {
    state.current = { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300, imageUrl: '/logo.png' };
    state.queue = [state.current]; state.queueIdx = 0;
    updateDock();
  });
  const g3 = await geom(pageA);
  ok(!g3.dockHidden && g3.dockOn && Math.abs(g3.dockBottom - g3.barTop) <= 0.5,
    'G3: with a track standing, the dock\u2019s bottom rect meets the bar\u2019s top rect (±0.5px) — the strip is closed, live rects', JSON.stringify(g3));
  ok(g3.dockhVar === g3.dockH + 'px' && g3.tabhVar === g3.barH + 'px',
    'G3: --tabh and --dockh read back as the elements\u2019 own measured heights', JSON.stringify(g3));
  const reserveExpect = parseInt(g3.tabhVar, 10) + parseInt(g3.dockhVar, 10);
  ok(g3.viewPadB === reserveExpect + 'px',
    'G4: under dock-on, the view\u2019s computed padding-bottom equals --tabh + --dockh exactly (the measured footprint)', JSON.stringify({ viewPadB: g3.viewPadB, reserveExpect }));
  const g4 = await pageA.evaluate(async () => {
    const vw = document.getElementById('view');
    const spacer = document.createElement('div'); spacer.style.height = '2000px'; vw.appendChild(spacer);
    const card = document.createElement('div'); card.className = 'card'; card.textContent = 'Last prayer'; vw.appendChild(card);
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const dk = document.getElementById('dock');
    return { gap: dk.getBoundingClientRect().top - card.getBoundingClientRect().bottom, scrollY: window.scrollY };
  });
  ok(Math.abs(g4.gap - 10) <= 0.5 && g4.scrollY > 0,
    'G4: at scroll end the last card\u2019s bottom edge stands exactly its own 10px margin above the dock\u2019s top edge — no overlap, no dead band beyond the margin', JSON.stringify(g4));
  await pageA.screenshot({ path: path.join(APP, 'tests/harness-v437-dock.png') });

  /* ---- G6: the throttled resize re-measure ---- */
  const g6 = await pageA.evaluate(async () => {
    window.__mbCount = 0;
    document.documentElement.style.setProperty('--tabh', '1px'); // corrupt the standing value
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));
    return { count: window.__mbCount, tabhVar: document.documentElement.style.getPropertyValue('--tabh'), barH: document.getElementById('tabbar').offsetHeight };
  });
  ok(g6.count === 1 && g6.tabhVar === g6.barH + 'px',
    'G6: a burst of three resizes lands ONE rAF-throttled measureBars(), and --tabh re-reads the bar\u2019s current height (the F-437-4 staleness path is closed)', JSON.stringify(g6));

  /* ---- G5: dock absent ---- */
  await pageA.evaluate(() => { state.current = null; state.queue = []; state.queueIdx = -1; updateDock(); });
  const g5 = await geom(pageA);
  ok(!g5.dockOn && g5.dockHidden && g5.viewPadB === '96px',
    'G5: no track → dock-on absent, the reserve rule does not apply, the view\u2019s standing 96px pad is what stands', JSON.stringify(g5));
}
await pageA.close();

/* ================= PAGE B — web, stand-in inset ================= */
const pageB = await openPage(SIM_CSS, '');
{
  await bootSeg(pageB);
  const g = await geom(pageB);
  const stack = g.tabH + 1;
  ok(!g.inShell, 'G2: no bridge → no in-shell class stands', JSON.stringify(g));
  ok(g.padB === '30px' && g.barH === stack + 30 && g.tabhVar === (stack + 30) + 'px',
    'G2: on the web the override is inert — the bar keeps the stand-in inset in full (computed padding 30px; --tabh measures the bar WITH it, §2.9\u2019s web column)', JSON.stringify({ padB: g.padB, barH: g.barH, stack }));
  const cssom = await pageB.evaluate(() => {
    const out = { tabbarDecl: null, overrideDecl: null };
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        // first .tabbar rule wins: it is the app's own rule —
        // the harness stand-in rule stands after it in the sheet
        if (r.selectorText === '.tabbar' && out.tabbarDecl === null) out.tabbarDecl = r.style.paddingBottom;
        if (r.selectorText === 'html.in-shell .tabbar') out.overrideDecl = r.style.paddingBottom;
      }
    }
    return out;
  });
  ok(cssom.tabbarDecl === 'env(safe-area-inset-bottom)' && cssom.overrideDecl === '0px',
    'G2 (CSSOM): the served stylesheet\u2019s .tabbar declaration still reads env(safe-area-inset-bottom), and the override rule stands beside it at 0px', JSON.stringify(cssom));
}
await pageB.close();

/* ================= PAGE C — web, plain CSS: the mold limit ================= */
const pageC = await openPage(APP_CSS, '');
{
  await bootSeg(pageC);
  const g = await geom(pageC);
  ok(!g.inShell && g.padB === '0px',
    'G2 (the mold limit, §2.5 — recorded, not rounded): desktop Chromium computes env(safe-area-inset-bottom) to 0, so the mold proves the declaration + the gate, not a nonzero web value; the nonzero web value is field leg 6', JSON.stringify(g));
}
await pageC.close();

await browser.close();
server.close();
console.log(`\nharness-v437: ${pass} ok / ${fail} not-ok`);
if (failures.length) { console.log('failures:\n - ' + failures.join('\n - ')); process.exit(1); }
