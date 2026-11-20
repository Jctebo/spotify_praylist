// harness-v415 — Now Playing header dimmed (§1/§2): the
// client leg. The diagnosis (§2.2) convicted the phone
// shell's status-bar strip, not this client; the client leg
// is PROOF, not paint (§2.4/§2.7/§2.8):
//   C1 (legs 1, 2) the screenshot pair — Now Playing from
//     the mold's standing current fixture episode under the
//     white theme; S1–S4 pixel-sampled token-exact; the
//     chevron's computed color = --bar-fg. Run this harness
//     in the BASE tree (V415_PAIR_LABEL=before) and in the
//     composed tree (after): the pair must read identical.
//   C2 (leg 3) every inventoried sheet's header zone at
//     full strength (the 12 of §1.3 + FD1; census static
//     below re-derives the inventory from this tree).
//   C3 (leg 5) the theme test — C1's samples under green.
//   C4 (leg 4) a second fixture descriptor through the
//     same sheet; the samples hold.
//   C5 (leg 6) at-source statics — the standing .sheet /
//     .np-hero rules verbatim; no new fill anywhere.
//   C6 (leg 7) playback statics + the overflow's contents.
//   C7 (leg 8) the written intention line stands.
// The Android legs (A1–A3) ride the pinned Actions run on
// release/v415-android (§2.8) — not this harness. Leg 9
// (John's eye) is the field check, never a harness leg.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LABEL = process.env.V415_PAIR_LABEL || 'after';
const OUT = process.env.V415_OUT || '/tmp/v415/evidence';

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}

/* ---------------- statics (C5, C3-static, inventory) ---------------- */
{
  const sheetRule = (U_SRC.match(/\.sheet \{[^}]*\}/) || [''])[0];
  ok(sheetRule === '.sheet { position:fixed; inset:0; z-index:50; background:var(--cream); overflow:auto; padding:14px 14px 40px; }',
    'C5: the shared .sheet construction stands verbatim — flat, token ground, no overlay/scrim/opacity', sheetRule);
  const heroRule = (U_SRC.match(/\.np-hero \{[^}]*\}/) || [''])[0];
  ok(heroRule === '.np-hero { margin:-14px -14px 0; padding:14px 14px 18px; background-color:var(--bar-solid); background:var(--bar-bg); border-bottom:2px solid var(--accent); }',
    'C5: the .np-hero construction stands verbatim — tokens only, no fill laid over it', heroRule);
  ok(U_SRC.includes('[data-lit="white"] { --bar-bg:linear-gradient(135deg, #f3e9cf, #faf5ec); --bar-solid:#f3e9cf;')
    && U_SRC.includes('[data-lit="green"] { --bar-bg:linear-gradient(135deg, #173a22, #1f4d2e); --bar-solid:#173a22;')
    && /--cream:#faf5ec/.test(U_SRC),
    'C3 statics: the standing token values stand (white #f3e9cf · green #173a22 · cream #faf5ec) — read, never redefined');
  ok(U_SRC.includes('ora-pro-nobis-v414-1') && !U_SRC.includes('ora-pro-nobis-v415-1'),
    'statics: the SW pin is untouched at Implement (Ship moves it to v415-1)');
  const census = [...C_SRC.matchAll(/className = 'sheet[^']*'/g)].map((m) => m[0]);
  ok(census.length === 13, 'inventory re-derivation: exactly 13 .sheet constructions stand in the composed tree', census.join(' '));
  const ctors = ['openNowPlaying', 'openQueuePreview', 'openIntentionEditor', 'openPromptsEditor', 'openGuideEditor',
    'openSpeedSheet', 'openSleepSheet', 'openPinSetSheet', 'openSheetMenu', 'openShareSheet', 'openBlockOrderEditor', 'openRead', 'showRecoverySheet'];
  ok(ctors.every((f) => C_SRC.includes('function ' + f)), 'inventory re-derivation: all 13 sheet constructors stand by name');
  ok(C_SRC.includes('id="np-intention"') && C_SRC.includes("'Prayer Intention: '"),
    'C7 statics: the written intention line stands in the Now Playing construction');
  ok(C_SRC.includes('function openPlayerMenu') && C_SRC.includes('function openSheetMenu'),
    'C6 statics: the one player overflow + the sheet-menu component stand');
}

/* ---------------- client extraction (v388 mold) ---------------- */
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
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));

const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
<div id="alert"></div><main id="view"></main>
<div id="dock" class="dock hidden"><img id="dock-thumb" class="dockthumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-intentions" class="docknext dockauto" aria-label="Intentions" aria-pressed="true">Intentions On</button><button id="dock-prev" class="docknext" aria-label="Previous track">&#9198;</button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><button id="dock-menu" class="docknext" aria-label="More options">&#8943;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  var method = (opts && opts.method) || 'GET';
  window.__fetchLog.push({ path: String(path), method: method });
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
<script>
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
  storedDay: '2026-11-14', presentedDay: '2026-11-14', dateLabel: 'Saturday, November 14', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: {},
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
  ownStanding: [], extStanding: [], extSlots: {}, ownSlots: {}, daySegments: {}, homeFilter: '', gridDl: {}, aiClaimed: false };
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS) + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:' + PORT + '/');
const ev = (fn, arg) => page.evaluate(fn, arg);

/* ---------------- fixtures ---------------- */
// FD3 fallback subject, named per §2.7: the mold's standing
// current fixture episode — "Invitatory" (episodeId m1,
// Morning), the descriptor the v412/v413 molds play by
// default. The screenshotted "Day 316: Absolute Surrender"
// cannot stand in the fixture world (no Day 316 podcast
// descriptor exists here; the mold never touches the
// production payload).
const EP1 = { episodeId: 'm1', title: 'Invitatory', block: 'Morning', url: 'https://x/m1.mp3', durationS: 300 };
const EP2 = { episodeId: 'n1', title: 'Night Prayer', block: 'Night', url: 'https://x/n1.mp3', durationS: 240 };
await ev(() => {
  window.__day = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14', intentionsLine: '',
    blocks: [
      { block: 'Morning', label: 'Morning Prayers', caption: 'Praylists', tracks: [] },
      { block: 'Night', label: 'Night Prayers', caption: 'Praylists', tracks: [] }
    ],
    episodes: []
  };
  state.dayPayload = window.__day;
  state.dayDescs = [
    { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: 'https://x/m1.mp3', available: true, durationS: 300 },
    { episodeId: 'n1', kind: 'episode', title: 'Night Prayer', block: 'Night', url: 'https://x/n1.mp3', available: true, durationS: 240 }
  ];
});

function openNpWith(ep, color, litName) {
  return ev((a) => {
    document.querySelectorAll('.sheet').forEach((x) => x.remove());
    applyLiturgical({ liturgicalDay: { name: a.litName, color: a.color }, dateLabel: 'Saturday, November 14' });
    state.current = a.ep; state.queue = [a.ep]; state.queueIdx = 0;
    openNowPlaying();
    var hero = document.querySelector('.np-hero');
    var r = hero.getBoundingClientRect();
    return { w: r.width, h: r.height, bottom: r.bottom,
      chev: getComputedStyle(document.getElementById('np-min')).color,
      title: (document.getElementById('np-title') || {}).textContent || '' };
  }, { ep, color, litName });
}

/* pixel sampling: screenshot → in-page canvas read (§2.7) */
async function shootAndSample(points, tag) {
  const buf = await page.screenshot({ type: 'png' });
  writeFileSync(OUT + '/pair-' + LABEL + '-' + tag + '.png', buf);
  const b64 = buf.toString('base64');
  return ev(async (a) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + a.b64; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return a.points.map(([x, y]) => { const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; });
  }, { b64, points });
}
/* CSS linear-gradient(135deg, c1, c2) over a W×H box (§2.7's
   token values for their gradient positions). */
function gradAt(W, H, x, y, c1, c2) {
  const th = 135 * Math.PI / 180, dx = Math.sin(th), dy = -Math.cos(th);
  const L = Math.abs(W * Math.sin(th)) + Math.abs(H * Math.cos(th));
  const sx = W / 2 - dx * L / 2, sy = H / 2 - dy * L / 2;
  let t = ((x - sx) * dx + (y - sy) * dy) / L; t = Math.max(0, Math.min(1, t));
  return c1.map((v, i) => Math.round(v + t * (c2[i] - v)));
}
const close = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const spreadOk = (s, e) => Math.abs((s[0] - s[2]) - (e[0] - e[2])) <= 5;
const WHITE = [[243, 233, 208], [250, 245, 236]];
const GREEN = [[23, 58, 34], [31, 77, 46]];
const CREAM = [250, 245, 236], NAVY = 'rgb(22, 40, 63)';

function heroLegs(label, samples, hero, stops) {
  const pts = [[20, 4], [20, 30], [20, 100]];
  pts.forEach(([x, y], i) => {
    const exp = gradAt(hero.w, hero.h, x, y, stops[0], stops[1]);
    ok(close(samples[i], exp, 4) && spreadOk(samples[i], exp),
      label + ' S' + (i + 1) + ' (' + x + ',' + y + ') = the token gradient at its position, no grey admixture',
      'got ' + samples[i] + ' expected ~' + exp);
  });
}

/* ---------------- C1: the pair, white (legs 1, 2) ---------------- */
let pairWhite = null;
{
  const hero = await openNpWith(EP1, 'white', 'Memorial of the Blessed Virgin Mary');
  await sleep(120);
  const pts = [[20, 4], [20, 30], [20, 100], [20, Math.round(hero.bottom) + 28]];
  const s = await shootAndSample(pts, 'white');
  pairWhite = { hero, samples: s };
  heroLegs('C1/' + LABEL + ' white', s, hero, WHITE);
  ok(close(s[0], WHITE[0], 4), 'C1: S1 stands within rounding of --bar-solid #f3e9cf (the screenshot day\u2019s theme)', 'got ' + s[0]);
  ok(close(s[3], CREAM, 3), 'C1: S4 below the band = the sheet ground --cream #faf5ec exactly', 'got ' + s[3]);
  ok(hero.chev === NAVY && hero.title === 'Invitatory',
    'C1/C2-hdr: the collapse chevron computes to --bar-fg at full strength; the sheet stands on the fixture episode', hero.chev + ' / ' + hero.title);
  writeFileSync(OUT + '/pair-' + LABEL + '-white.json', JSON.stringify(pairWhite, null, 1));
  if (LABEL === 'after') {
    const beforePath = OUT + '/pair-before-white.json';
    ok(existsSync(beforePath), 'C1 pair: the BEFORE render stands on record');
    if (existsSync(beforePath)) {
      const b = JSON.parse(readFileSync(beforePath, 'utf8'));
      const same = b.samples.every((bs, i) => close(bs, s[i], 1));
      ok(same, 'C1 pair: BEFORE and AFTER read pixel-identical (the client delta is pin-only — nothing painted, nothing regressed)',
        'before ' + JSON.stringify(b.samples) + ' after ' + JSON.stringify(s));
    }
  }
  /* C6 behavioral, on this same sheet */
  const c6 = await ev(() => ({
    menu: !!document.getElementById('np-menu'), intentions: !!document.getElementById('np-intentions'),
    transport: ['np-play', 'np-prev', 'np-next'].map((id) => !!document.getElementById(id)).join(','),
    retired: ['np-autoplay', 'np-sleep', 'np-speed'].map((id) => !document.getElementById(id)).join(',')
  }));
  ok(c6.menu && c6.intentions && c6.transport === 'true,true,true' && c6.retired === 'true,true,true',
    'C6: Now Playing stands as v413 left it — ⋮ entrance + intentions toggle + transport; the retired controls stay retired', JSON.stringify(c6));
  await ev(() => { openPlayerMenu(); });
  await sleep(80);
  const menu = await ev(() => [...document.querySelectorAll('.menusheet .menurow')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
  ok(menu.length === 3 && /^Autoplay/.test(menu[0]) && /^Sleep timer/.test(menu[1]) && /^Playback speed/.test(menu[2]),
    'C6: the player overflow still holds exactly Autoplay · Sleep timer · Playback speed', menu.join(' | '));
  await ev(() => document.querySelectorAll('.sheet').forEach((x) => x.remove()));
  /* C7 behavioral: the written line on the playing screen */
  await ev((ep) => {
    state.current = Object.assign({}, ep, { intentionText: 'For my family' });
    state.queue = [state.current]; state.queueIdx = 0;
    openNowPlaying();
  }, EP1);
  await sleep(60);
  const c7 = await ev(() => { var el = document.getElementById('np-intention'); return { text: el ? el.textContent : '', shown: el ? el.style.display !== 'none' : false }; });
  ok(c7.shown && c7.text === 'Prayer Intention: For my family',
    'C7: the written intention line stands on the playing screen (written only — no spoken path in this release)', JSON.stringify(c7));
  await ev(() => document.querySelectorAll('.sheet').forEach((x) => x.remove()));
}

/* ---------------- C4: a second descriptor (leg 4) ---------------- */
{
  const hero = await openNpWith(EP2, 'white', 'Memorial of the Blessed Virgin Mary');
  await sleep(120);
  const s = await shootAndSample([[20, 4], [20, 30], [20, 100]], 'ep2');
  heroLegs('C4 white/ep2', s, hero, WHITE);
  ok(hero.title === 'Night Prayer', 'C4: the after-state is not episode-bound — the second descriptor renders the same token-exact header zone', hero.title);
  await ev(() => document.querySelectorAll('.sheet').forEach((x) => x.remove()));
}

/* ---------------- C3: the theme test, green (leg 5) ---------------- */
{
  const hero = await openNpWith(EP1, 'green', 'Saturday of the 32nd Week in Ordinary Time');
  await sleep(120);
  const s = await shootAndSample([[20, 4], [20, 30], [20, 100]], 'green');
  heroLegs('C3/' + LABEL + ' green', s, hero, GREEN);
  ok(close(s[0], GREEN[0], 4), 'C3: under green, S1 stands within rounding of green\u2019s --bar-solid #173a22 — the zone follows the theme, no fixed color', 'got ' + s[0]);
  ok(hero.chev === 'rgb(233, 217, 174)', 'C3: the chevron computes to green\u2019s --bar-fg #e9d9ae', hero.chev);
  writeFileSync(OUT + '/pair-' + LABEL + '-green.json', JSON.stringify({ hero, samples: s }, null, 1));
  await ev(() => document.querySelectorAll('.sheet').forEach((x) => x.remove()));
}

/* ---------------- C2: the inventory, sheet by sheet (leg 3) ---------------- */
{
  // Form 1 second carrier: the queue preview (same .np-hero).
  const hero = await ev(() => {
    applyLiturgical({ liturgicalDay: { name: 'Memorial of the Blessed Virgin Mary', color: 'white' }, dateLabel: 'Saturday, November 14' });
    state.current = { episodeId: 'm1', title: 'Invitatory', block: 'Morning', url: 'https://x/m1.mp3', durationS: 300 };
    state.queue = [state.current]; state.queueIdx = 0; state.previewQueue = null;
    openQueuePreview();
    var h = document.querySelector('.np-preview .np-hero');
    var r = h.getBoundingClientRect();
    return { w: r.width, h: r.height, stood: !!h, chev: getComputedStyle(document.querySelector('.np-preview #np-min')).color };
  });
  await sleep(100);
  const qs = await shootAndSample([[20, 4]], 'preview');
  const qExp = gradAt(hero.w, hero.h, 20, 4, WHITE[0], WHITE[1]);
  ok(hero.stood && close(qs[0], qExp, 4) && spreadOk(qs[0], qExp),
    'C2: queue preview (Form 1) — hero top samples token-exact under white', 'got ' + qs[0] + ' expected ~' + qExp);
  ok(hero.chev === NAVY, 'C2: queue preview — the collapse chevron computes to --bar-fg', hero.chev);
  await ev(() => document.querySelectorAll('.sheet').forEach((x) => x.remove()));

  // Form 2: the header-row sheets. Each opens on the sheet's
  // own cream ground; the header zone = the h1.screen title +
  // the ghost Close/Done, both in --navy at full strength.
  // Direct dispatch: the extracted constructors are page
  // globals; call them by name with fixture arguments
  // prepared on window.
  await ev(() => {
    window.__fx = {
      intention: { id: 1, text: 'For my family', priority: 'M', status: 'active', created_at: '2026-11-01', drawnCount: 0 },
      prompts: [{ id: 1, category: 'First Commandment', text: 'Have I prayed?' }],
      guide: [{ step_no: 1, title: 'Preparation', body: 'Examine.' }],
      share: { title: 'Invitatory', line: 'Morning', url: 'https://x/m1.mp3', artHtml: '' },
      read: { episodeId: 'm1', title: 'Invitatory', textUrl: '/api/player/feed-audio?m1', hasText: true }
    };
  });
  const form2b = [
    ['intention editor', 'openIntentionEditor(window.__fx.intention)', 'Intention'],
    ['examination prompts editor', 'openPromptsEditor(window.__fx.prompts)', 'Examination prompts'],
    ['confession guide editor', 'openGuideEditor(window.__fx.guide)', 'Confession guide'],
    ['playback speed sheet', 'openSpeedSheet()', null],
    ['sleep timer sheet', 'openSleepSheet()', null],
    ['PIN set sheet', "openPinSetSheet('set')", 'Set a PIN'],
    ['sheet menu (via the player overflow)', 'openPlayerMenu()', null],
    ['share sheet', 'openShareSheet(window.__fx.share)', 'Share'],
    ['playlist order editor', 'openBlockOrderEditor()', 'Playlist order'],
    ['Read sheet', 'openRead(window.__fx.read)', 'Invitatory']
  ];
  for (const [name, callSrc, title] of form2b) {
    const r = await ev((src) => {
      document.querySelectorAll('.sheet').forEach((x) => x.remove());
      let err = '';
      try { (0, eval)(src); } catch (e) { err = String(e).slice(0, 160); }
      var sheet = document.querySelector('.sheet');
      var h1 = sheet ? sheet.querySelector('h1.screen') : null;
      var ghost = null;
      if (sheet) { var btns = sheet.querySelectorAll('.row .btn.ghost, [data-shareclose], [data-readclose]'); ghost = btns.length ? getComputedStyle(btns[0]).color : null; }
      return { err, stood: !!sheet, cls: sheet ? sheet.className : '', h1: h1 ? h1.textContent : '', h1Color: h1 ? getComputedStyle(h1).color : '', ghost };
    }, callSrc);
    await sleep(60);
    let ground = null;
    if (r.stood) { const px = await shootAndSample([[200, 4]], 'c2'); ground = px[0]; }
    ok(r.stood && !r.err, 'C2: ' + name + ' stands in the mold', r.err || r.cls);
    if (r.stood) {
      ok(ground && close(ground, CREAM, 2), 'C2: ' + name + ' — the header zone\u2019s ground samples --cream at full strength (no dim fill)', 'got ' + ground);
      if (title) ok(r.h1 === title && r.h1Color === NAVY, 'C2: ' + name + ' — its title stands in --navy at full strength', r.h1 + ' / ' + r.h1Color);
      if (r.ghost) ok(r.ghost === NAVY, 'C2: ' + name + ' — the ghost Close/Done computes to --navy at full strength', r.ghost);
    }
    await ev(() => document.querySelectorAll('.sheet').forEach((x) => x.remove()));
  }
}

console.log('---');
console.log('harness-v415 (' + LABEL + '): ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
