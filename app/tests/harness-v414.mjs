// harness-v414 — the Wallpaper tab's Phone and Watch views
// (§1/§2). Client legs run in headless Chromium on the
// v388 extraction mold (harness-v413's page). Legs map to
// §1.10's twelve acceptance legs:
//   L1 toggle + remembered side (FD1) · L2 showing-now ·
//   L3 carousel opens on the showing-now slide (FD3) ·
//   L4 captions (F-414-2/F-414-4) · L5 whole picture ·
//   L6 Watch view (no showing-now, §1.4) · L7 Watch
//   captions · L8 folder buttons (F-414-1) · L9 controls
//   homed, one Sync · L10 the off state (FD5) · L11
//   instructions collapse remembered (FD2) · L12 fit
//   parity · P place-keeping (FD6 freeze · scroll restore ·
//   carousel index) · G the guarded live-state parse (§2.3).
// The native half's proof is FolderOpenDecisionTest in the
// pinned Actions run (§2.11) — not this harness.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}

/* ---------------- statics ---------------- */
{
  const segRule = (U_SRC.match(/\.segtoggle \{[^}]*\}/) || [''])[0];
  ok(/position:sticky/.test(segRule) && /top:var\(--brandh, 54px\)/.test(segRule) && /z-index:25/.test(segRule),
    'FD6 statics: ONE shared sticky rule freezes the segmented toggles under the brand bar', segRule);
  ok(/--brandh/.test(C_SRC) && /brandbar/.test(C_SRC), 'FD6 statics: the client measures --brandh at shell paint');
  ok(C_SRC.includes("opn-tabside-wallpaper-v414") && C_SRC.includes("opn-wallpaper-instructions-v414"),
    'statics: the FD1 toggle key + the FD2 instructions key stand');
  ok(C_SRC.includes('openWallpaperFolder') && C_SRC.includes('wallpaperLiveState') && C_SRC.includes('paintWallpaperTab'),
    'statics: the folder bridge call + the live-state read + the tab paint stand');
  ok(U_SRC.includes('ora-pro-nobis-v413-1') && !U_SRC.includes('ora-pro-nobis-v414-1'),
    'statics: the SW pin is untouched at Implement (Ship moves it)');
  const tabs = [...U_SRC.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]);
  ok(tabs.join(',') === 'prayers,conscience,podcasts,wallpaper', 'statics: the four tabs stand in order', tabs.join(','));
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
  window.__fetchLog.push({ path: String(path), method: (opts && opts.method) || 'GET' });
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
await ev(() => {
  var PATHS = { phone: 'Pictures/Ora Pro Nobis/Phone', watch: 'Pictures/Ora Pro Nobis/Watch' };
  function payload(liveLines, extra) {
    var p = {
      phoneRoot: 'Pictures/Ora Pro Nobis', watchRoot: 'Pictures/Ora Pro Nobis', fitMode: 'fit',
      offeredRoots: ['Pictures/Ora Pro Nobis', 'Pictures/Wallpapers', 'DCIM/Wallpapers', 'Download/Wallpapers'],
      paths: PATHS, notices: [],
      lastSync: { outcome: 'updated', changed: 3, filed: 3, removed: 0, at: 1763131200000 },
      saintStatus: { standing: 'filed', name: 'Saint Margaret of Scotland', cause: '' }
    };
    if (liveLines !== undefined) p.liveWallpaper = liveLines;
    if (extra) for (var k in extra) p[k] = extra[k];
    return p;
  }
  function entry(name, slug, date, variant, kind) {
    return { name: name, slug: slug, date: date, variant: variant, kind: kind, sha256: 'ab12', bytes: 12345 };
  }
  function sideSet(variant) {
    return [
      entry('saint-margaret-of-scotland__2026-11-14.jpg', 'saint-margaret-of-scotland', '2026-11-14', variant, 'saint'),
      entry('the-resurrection__2026-11-14.jpg', 'the-resurrection', '2026-11-14', variant, 'saint'),
      entry('holy-souls-in-purgatory__2026-11.jpg', 'holy-souls-in-purgatory', '2026-11', variant, 'monthly'),
      entry('saint-cecilia__2026-11-13.jpg', 'saint-cecilia', '2026-11-13', variant, 'saint'),
      entry('sacred-heart__2026-10.jpg', 'sacred-heart', '2026-10', variant, 'monthly')
    ];
  }
  window.__wp = {
    payloads: {
      drawn: payload(['Live wallpaper: on \u2014 the-resurrection__2026-11-14.jpg, drawn 9:41 AM; the pictures advance as the screen shows.']),
      nodraw: payload(['Live wallpaper: on \u2014 no pictures stand in the Phone folder yet.']),
      off: payload(['Live wallpaper: not on \u2014 pick Ora Pro Nobis in the system wallpaper picker.']),
      nokey: payload(undefined),
      weird: payload(['Something else entirely'])
    },
    manifest: { ok: true, date: '2026-11-14', month: '2026-11', entries: sideSet('phone').concat(sideSet('watch')) },
    emptyManifest: { ok: true, date: '2026-11-14', month: '2026-11', entries: [] },
    current: 'drawn', manifestMode: 'full',
    writes: [], syncs: 0, pickers: 0, folderCalls: [], folderFails: false
  };
  window.Capacitor = { Plugins: {
    Preferences: { get: function () { return Promise.resolve({ value: null }); }, set: function () { return Promise.resolve(); } },
    OraDayBridge: {
      getWallpaperSettings: function () { return Promise.resolve(window.__wp.payloads[window.__wp.current]); },
      setWallpaperSettings: function (patch) { window.__wp.writes.push(patch); return Promise.resolve(window.__wp.payloads[window.__wp.current]); },
      syncWallpaperNow: function () { window.__wp.syncs++; return Promise.resolve(window.__wp.payloads[window.__wp.current]); },
      openLiveWallpaperPicker: function () { window.__wp.pickers++; return Promise.resolve({}); },
      openWallpaperFolder: function (arg) {
        window.__wp.folderCalls.push(arg);
        if (window.__wp.folderFails) return Promise.reject(new Error('no handler'));
        return Promise.resolve({});
      }
    }
  } };
  window.fetch = function (p) {
    if (String(p).indexOf('/api/wallpaper/manifest') === 0) {
      if (window.__wp.manifestMode === 'fail') return Promise.reject(new Error('boom'));
      var m = window.__wp.manifestMode === 'empty' ? window.__wp.emptyManifest : window.__wp.manifest;
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(m); } });
    }
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
  };
  state.liturgical = { name: 'Saint Margaret of Scotland' };
});

async function paint(current, manifestMode, clearLs) {
  await ev((a) => {
    if (a.clearLs) localStorage.clear();
    window.__wp.current = a.current;
    window.__wp.manifestMode = a.manifestMode;
    state.tab = 'wallpaper';
    renderWallpaper();
  }, { current, manifestMode: manifestMode || 'full', clearLs: !!clearLs });
  await sleep(150);
}

/* ---------------- L1: the toggle + remembered side (FD1) ---------------- */
{
  await paint('drawn', 'full', true);
  const r = await ev(() => ({
    toggle: !!document.getElementById('sidetoggle'),
    labels: [...document.querySelectorAll('#sidetoggle [data-side]')].map((b) => b.textContent),
    active: (document.querySelector('#sidetoggle [data-side].active') || {}).getAttribute ? document.querySelector('#sidetoggle [data-side].active').getAttribute('data-side') : null,
    side: tabSideNow.wallpaper,
    hostClass: document.getElementById('set-wallpaper').className
  }));
  ok(r.toggle && r.labels.join('|') === 'Phone|Watch' && r.active === 'phone' && r.side === 'phone',
    'L1/FD1: the tab opens on the Phone | Watch toggle, Phone first and active on first run', JSON.stringify(r));
  ok(r.hostClass === '', 'L1/§2.6: the views paint outside the liblist wrapper (the sticky cage is gone)', r.hostClass);
  await page.click('#sidetoggle [data-side="watch"]');
  await sleep(150);
  const w = await ev(() => ({
    stored: localStorage.getItem('opn-tabside-wallpaper-v414'),
    instr: !!document.getElementById('wp-instr'),
    side: tabSideNow.wallpaper
  }));
  ok(w.stored === 'watch' && w.instr && w.side === 'watch', 'L1/FD1: switching to Watch writes the remembered side', JSON.stringify(w));
  await paint('drawn', 'full', false);
  const back = await ev(() => ({ instr: !!document.getElementById('wp-instr'), side: tabSideNow.wallpaper }));
  ok(back.instr && back.side === 'watch', 'L1/FD1: re-entering the tab restores the remembered Watch side', JSON.stringify(back));
  await page.click('#sidetoggle [data-side="phone"]');
  await sleep(150);
}

/* ---------------- L2/L3/L4: showing-now + carousel + captions ---------------- */
{
  const r = await ev(() => {
    var sh = document.getElementById('wp-showing');
    var img = document.getElementById('wpcar-img-phone');
    var dots = [...document.querySelectorAll('#wp-carousel-phone [data-car-dot]')];
    return {
      shImg: sh ? (sh.querySelector('img') || {}).getAttribute('src') : null,
      shText: sh ? sh.textContent : '',
      title: (document.getElementById('wpcar-title-phone') || {}).textContent || '',
      from: (document.getElementById('wpcar-from-phone') || {}).textContent || '',
      imgSrc: img ? img.getAttribute('src') : null,
      dotCount: dots.length,
      dotOn: dots.findIndex((d) => d.classList.contains('on'))
    };
  });
  ok(r.shImg === '/api/wallpaper/file/phone/the-resurrection__2026-11-14.jpg' && /The Resurrection/.test(r.shText) && /On your home and lock screens now/.test(r.shText),
    'L2: showing-now renders the drawn picture (thumbnail + humanized name + the status line)', JSON.stringify(r));
  ok(r.dotCount === 3 && r.dotOn === 1 && r.title === 'The Resurrection' && /the-resurrection__2026-11-14\.jpg/.test(r.imgSrc || ''),
    'L3/FD3: the Phone carousel opens on the showing-now slide; the set is today\u2019s three, manifest order (distractors excluded)', JSON.stringify(r));
  const caps = await ev(() => {
    var out = [];
    [0, 1, 2].forEach(function (i) {
      setWallpaperCarousel('phone', i);
      out.push({
        title: document.getElementById('wpcar-title-phone').textContent,
        from: document.getElementById('wpcar-from-phone').textContent
      });
    });
    return out;
  });
  ok(caps[0].title === 'Saint Margaret of Scotland' && caps[0].from === 'From: Saint Margaret of Scotland',
    'L4/F-414-4: the saint slide captions the title + the day\u2019s liturgical name', JSON.stringify(caps[0]));
  ok(caps[1].title === 'The Resurrection' && caps[1].from === '',
    'L4/F-414-2: the companion daily stands title-only (no observance named in the manifest)', JSON.stringify(caps[1]));
  ok(caps[2].title === 'Holy Souls In Purgatory' && caps[2].from === 'From: November\u2019s devotion',
    'L4: the monthly slide captions "<Month>\u2019s devotion"', JSON.stringify(caps[2]));
  /* L5: the whole picture, never cropped — measured. */
  const m = await ev(() => {
    var img = document.getElementById('wpcar-img-phone');
    var stage = document.querySelector('.wpcar-stage');
    var shImg = document.querySelector('#wp-showing img');
    return {
      fit: getComputedStyle(img).objectFit,
      stageH: stage.offsetHeight,
      shFit: shImg ? getComputedStyle(shImg).objectFit : null
    };
  });
  ok(m.fit === 'contain' && m.stageH === 320 && m.shFit === 'contain',
    'L5: the carousel + the showing-now thumbnail render object-fit: contain in the fixed slide area', JSON.stringify(m));
}

/* ---------------- L9/L12: the controls block, homed whole ---------------- */
{
  const r = await ev(() => {
    var v = document.getElementById('view');
    var fit = document.getElementById('set-wp-fit');
    return {
      syncButtons: v.querySelectorAll('#set-wp-sync').length,
      syncAllText: (v.textContent.match(/Sync all/g) || []).length,
      liveBtn: !!document.getElementById('set-wp-live'),
      liveLine: /Live wallpaper: on \u2014 the-resurrection/.test(v.textContent),
      fitRow: /Picture fit/.test(v.textContent),
      fitValue: fit ? fit.value : null,
      fitOptions: fit ? [...fit.options].map((o) => o.textContent) : [],
      fitCaption: /The whole picture shows, title and all/.test(v.textContent),
      phoneRow: /Phone folder/.test(v.textContent) && /Pictures\/Ora Pro Nobis\/Phone/.test(v.textContent),
      watchRow: /Watch folder/.test(v.textContent) && /Pictures\/Ora Pro Nobis\/Watch/.test(v.textContent),
      lastSync: /Synced /.test(v.textContent),
      saintLine: /Today\u2019s saint: Saint Margaret of Scotland \u2014 on your phone\./.test(v.textContent)
    };
  });
  ok(r.syncButtons === 1 && r.syncAllText === 1, 'L9: exactly ONE Sync button stands on the tab (SYNC ALL)', JSON.stringify(r));
  ok(r.liveBtn && r.liveLine && r.fitRow && r.phoneRow && r.watchRow && r.lastSync && r.saintLine,
    'L9/§2.6: every standing control is homed on the Phone view \u2014 live lines + picker row, fit row, both folder rows, Sync row + lastSync line, saint line; none dropped', JSON.stringify(r));
  ok(r.fitValue === 'fit' && r.fitOptions.join('|') === 'Fit the whole picture|Fill the screen' && r.fitCaption,
    'L12: Picture fit stands as it stood \u2014 Fit selected, both choices, the standing caption', JSON.stringify(r));
}

/* ---------------- L8: the folder buttons (F-414-1) ---------------- */
{
  await ev(() => { window.__wp.folderCalls = []; window.__wp.folderFails = false; });
  await page.click('#wp-open-phone');
  await sleep(50);
  const c1 = await ev(() => window.__wp.folderCalls);
  ok(c1.length === 1 && c1[0].variant === 'phone', 'L8: Open phone folder fires the bridge with the phone variant', JSON.stringify(c1));
  await ev(() => { window.__wp.folderFails = true; });
  await page.click('#wp-open-phone');
  await sleep(50);
  const note = await ev(() => (document.getElementById('wp-folder-note-phone') || {}).textContent || '');
  ok(note === 'That did not open. The folder is at Pictures/Ora Pro Nobis/Phone.',
    'L8/F-414-1: a failed open answers in place with the folder path \u2014 never a dead button', note);
  await ev(() => { window.__wp.folderFails = false; });
}

/* ---------------- L6/L7/L11: the Watch view ---------------- */
{
  await paint('drawn', 'full', true);
  await page.click('#sidetoggle [data-side="watch"]');
  await sleep(150);
  const r = await ev(() => {
    var v = document.getElementById('view');
    var img = document.getElementById('wpcar-img-watch');
    return {
      showing: !!document.getElementById('wp-showing'),
      statusLine: /On your home and lock screens now/.test(v.textContent),
      instr: !!document.getElementById('wp-instr'),
      instrText: (document.getElementById('wp-instr') || { textContent: '' }).textContent,
      hideBtn: !!document.getElementById('wp-instr-hide'),
      sync: !!document.getElementById('set-wp-sync'),
      fit: !!document.getElementById('set-wp-fit'),
      openWatch: !!document.getElementById('wp-open-watch'),
      openPhone: !!document.getElementById('wp-open-phone'),
      imgSrc: img ? img.getAttribute('src') : null,
      head: /Today\u2019s artwork \u2014 watch/.test(v.textContent),
      capTitle: (document.getElementById('wpcar-title-watch') || {}).textContent || '',
      capFrom: (document.getElementById('wpcar-from-watch') || {}).textContent || ''
    };
  });
  ok(!r.showing && !r.statusLine, 'L6/§1.4: NO showing-now stands anywhere on the Watch view (John\u2019s clause)', JSON.stringify(r));
  ok(r.instr && r.hideBtn && /image source to the Ora Pro Nobis watch folder/.test(r.instrText) && /top third dark and empty/.test(r.instrText)
    && /advances through the folder itself/.test(r.instrText) && /SYNC ALL runs on the phone/.test(r.instrText),
    'L6/§1.6: the instructions block stands at the top with the four points + Hide', JSON.stringify(r.instrText).slice(0, 200));
  ok(r.head && /\/api\/wallpaper\/file\/watch\//.test(r.imgSrc || '') && r.openWatch && !r.openPhone && !r.sync && !r.fit,
    'L6/§1.8: the Watch view is instructions + its own carousel + Open watch folder \u2014 no controls block', JSON.stringify(r));
  ok(r.capTitle === 'Saint Margaret of Scotland' && r.capFrom === 'From: Saint Margaret of Scotland',
    'L7: the Watch carousel opens at slide 0 with the same truthful captions', JSON.stringify(r));
  /* L11: the collapse, remembered. */
  await page.click('#wp-instr-hide');
  await sleep(50);
  const c = await ev(() => ({
    stored: localStorage.getItem('opn-wallpaper-instructions-v414'),
    bar: /Watch setup instructions/.test((document.getElementById('wp-instr') || { textContent: '' }).textContent),
    showBtn: !!document.getElementById('wp-instr-show'),
    fourPoints: /image source to the Ora Pro Nobis watch folder/.test(document.getElementById('view').textContent)
  }));
  ok(c.stored === 'hidden' && c.bar && c.showBtn && !c.fourPoints,
    'L11/FD2: Hide collapses the block to the one-line bar and writes the remembered state', JSON.stringify(c));
  await page.click('#sidetoggle [data-side="phone"]');
  await sleep(120);
  await page.click('#sidetoggle [data-side="watch"]');
  await sleep(150);
  const still = await ev(() => !!document.getElementById('wp-instr-show'));
  ok(still, 'L11/FD2: the collapsed state survives leaving and returning to the Watch view');
  await page.click('#wp-instr-show');
  await sleep(50);
  const shown = await ev(() => ({
    stored: localStorage.getItem('opn-wallpaper-instructions-v414'),
    hideBtn: !!document.getElementById('wp-instr-hide')
  }));
  ok(shown.stored === 'shown' && shown.hideBtn, 'L11/FD2: Show instructions restores the block and the state', JSON.stringify(shown));
}

/* ---------------- L10: the off state (FD5) ---------------- */
{
  await paint('off', 'full', true);
  const r = await ev(() => {
    var v = document.getElementById('view');
    return {
      title: /Wallpaper is off/.test(v.textContent),
      lines: /puts today\u2019s pictures on your home and lock screens/.test(v.textContent)
        && /changes as the day goes, all by itself/.test(v.textContent)
        && /SYNC ALL keeps the pictures coming/.test(v.textContent),
      turnOn: !!document.getElementById('wp-turn-on'),
      toggle: !!document.getElementById('sidetoggle'),
      carousel: !!document.querySelector('.wpcar'),
      sync: !!document.getElementById('set-wp-sync')
    };
  });
  ok(r.title && r.lines && r.turnOn && !r.toggle && !r.carousel && !r.sync,
    'L10/FD5: wallpaper off paints ONLY the quick intro + Turn on \u2014 no view UI (§1.7)', JSON.stringify(r));
  await page.click('#wp-turn-on');
  await sleep(50);
  const p = await ev(() => window.__wp.pickers);
  ok(p === 1, 'L10: Turn on fires the standing live-wallpaper picker', 'pickers=' + p);
}

/* ---------------- G: the guarded live-state parse (§2.3) ---------------- */
{
  await paint('nokey', 'full', true);
  const g1 = await ev(() => ({ toggle: !!document.getElementById('sidetoggle'), off: /Wallpaper is off/.test(document.getElementById('view').textContent) }));
  ok(g1.toggle && !g1.off, 'G1: an absent liveWallpaper key renders the views \u2014 never a false off state', JSON.stringify(g1));
  await paint('weird', 'full', true);
  const g2 = await ev(() => ({ toggle: !!document.getElementById('sidetoggle'), off: /Wallpaper is off/.test(document.getElementById('view').textContent) }));
  ok(g2.toggle && !g2.off, 'G2: an unrecognized live line renders the views \u2014 never a false off state', JSON.stringify(g2));
  await paint('nodraw', 'full', true);
  const g3 = await ev(() => {
    var sh = document.getElementById('wp-showing');
    return {
      img: sh ? (sh.querySelector('img') || {}).getAttribute('src') : null,
      text: sh ? sh.textContent : ''
    };
  });
  ok(g3.img === '/api/wallpaper/file/phone/saint-margaret-of-scotland__2026-11-14.jpg' && /Saint Margaret of Scotland/.test(g3.text) && /On your home and lock screens now/.test(g3.text),
    'G3/FD4: no draw yet \u2192 showing-now falls back to today\u2019s first phone picture', JSON.stringify(g3));
  await paint('nodraw', 'empty', true);
  const g4 = await ev(() => {
    var v = document.getElementById('view');
    return {
      phoneLine: /No pictures for today yet \u2014 SYNC ALL brings them\./.test(v.textContent),
      showingLine: /No pictures stand in the Phone folder yet\./.test(v.textContent)
    };
  });
  ok(g4.phoneLine && g4.showingLine, 'G4/FD4: an empty set names itself on the carousel area and the showing-now row \u2014 no thumbnail, never blank', JSON.stringify(g4));
  await page.click('#sidetoggle [data-side="watch"]');
  await sleep(150);
  const g4w = await ev(() => /No watch pictures for today yet\./.test(document.getElementById('view').textContent));
  ok(g4w, 'G4: the Watch empty set carries its own line');
  await paint('drawn', 'fail', true);
  const g5 = await ev(() => /Today\u2019s pictures could not be loaded \u2014 reopen the tab to try again\./.test(document.getElementById('view').textContent));
  ok(g5, 'G5/§2.8: a failed manifest load names itself on the carousel area, distinct from an empty set');
}

/* ---------------- P: place-keeping ---------------- */
{
  /* P1: the sticky freeze, measured on the live toggle. */
  await paint('drawn', 'full', true);
  const f = await ev(() => {
    var t = document.getElementById('sidetoggle');
    var cs = getComputedStyle(t);
    return { pos: cs.position, top: cs.top, z: cs.zIndex, btnH: t.querySelector('button').offsetHeight };
  });
  ok(f.pos === 'sticky' && f.z === '25' && f.btnH >= 44,
    'P1/FD6: the toggle computes position: sticky above the scrolling content, its buttons at the 44px floor', JSON.stringify(f));
  const boxes = await ev(() => {
    var a = document.querySelector('.wpcar-arrow');
    var d = document.querySelector('.wpcar-dot');
    return { aw: a.offsetWidth, ah: a.offsetHeight, dw: d.offsetWidth, dh: d.offsetHeight };
  });
  ok(boxes.aw === 44 && boxes.ah === 44 && boxes.dw === 44 && boxes.dh === 44,
    'P2: every new carousel control measures 44px (the v411 floor)', JSON.stringify(boxes));
  /* P3: scroll restore rides the wallpaper screen key. */
  const key = await ev(() => placeScreenKey());
  ok(key === 'wallpaper:phone', 'P3/§2.8: the place key extends to the Wallpaper tab per side', key);
  await ev(() => { document.getElementById('view').style.minHeight = '2400px'; window.scrollTo(0, 150); });
  await sleep(30);
  await ev(() => { capturePlace(); });
  const saved = await ev(() => placeScroll['wallpaper:phone']);
  await ev(() => { window.scrollTo(0, 0); armPlaceRestore('wallpaper:phone'); });
  await sleep(400);
  const y = await ev(() => window.scrollY);
  ok(saved === 150 && y === 150, 'P3: the Wallpaper tab\u2019s scroll restores through the standing place machinery', 'saved=' + saved + ' y=' + y);
  await ev(() => { document.getElementById('view').style.minHeight = ''; window.scrollTo(0, 0); });
  /* P4: the carousel index survives a standing repaint. */
  await ev(() => { setWallpaperCarousel('phone', 2); });
  await ev(() => { paintWallpaperControls(window.__wp.payloads.drawn); });
  await sleep(150);
  const t4 = await ev(() => (document.getElementById('wpcar-title-phone') || {}).textContent || '');
  ok(t4 === 'Holy Souls In Purgatory', 'P4/§2.4: a write/sync repaint restores the slide John was viewing', t4);
}

console.log('---');
console.log('harness-v414: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
