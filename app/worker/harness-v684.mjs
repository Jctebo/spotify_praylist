// harness-v684.mjs — v684: Edit-form drag reorder retired;
// UP/DOWN MOVE BUTTONS are the only reorder mechanism in
// the Edit form (Plan §2, release doc v684).
//
// Modeled on harness-v679.mjs: playwright-core Chromium,
// the REAL built Worker bundle (esbuild from source) served
// locally, the API stubbed in-page. The stub's profiles
// store is production-shaped (the opnProfilesPayload shape,
// client.ts opnProfilesPayload): one standing profile
// ('salesian') with STORED contents; its today-edit / save
// PUTs are captured and applied to the stub store, as the
// production routes apply them, and every GET serves a
// fresh JSON copy, as the network does.
//
// Fixtures (Improvement D — production shapes, sources named):
//  - Morning contents (stored-contents item shapes, the
//    opnContentsOf590 / validateProfileContents forms):
//    a labeled-slot office item {kind:'source',
//    key:'ext-morning-prayer', side:'sth'} (the v670
//    segtoggle row), a prayer item, the daily-rosary source
//    item, a second prayer item — 4 rows, >= 3 required.
//  - Midday stands OFF in coreBlocks (the v635 greyed-in-
//    place group) with one stored contents item.
//  - Day payload: the harness-v679 __mkDay shape (blocks in
//    day order Novenas · Morning · Midmorning · Midday ·
//    Afternoon · Evening · Night, presented 2026-11-25).
//
// Legs (Plan §2.4):
//  L1 buttons exist + geometry (390px): every Morning
//     contents row carries up+down [data-p684move] buttons,
//     each box >= 40 wide x 44 tall; first row up disabled,
//     last row down disabled.
//  L2 driven move + persist: tap row 2's up -> DOM order
//     swaps at once; the captured today-edit payload carries
//     the new order; leave + re-enter -> the order stands;
//     the composed list (opnTodayComposedContents594, the
//     list the Praylist paints from) follows.
//  L3 down + boundary: tap row 1's down -> it moves one
//     seat; a driven tap on the disabled last-row down
//     changes nothing.
//  L4 office row: moving the office item keeps its v670
//     segtoggle standing with the picked side active, and
//     the toggle still flips after the move.
//  L5 no drag: data-p604handle count in the form is 0, and
//     a driven pointer drag starting on a row moves
//     nothing (no DOM change, no write). FAILS on the
//     current tree — the fail-on-old evidence.
//  L6 form shape regression: groups stand at day positions
//     (v635), the off group (Midday) stands greyed in place,
//     Remove still removes + writes.
//
// Evidence (printed, not checked — it must read on BOTH
// trees): the measured .p604handle box on the current tree
// and the mid-drag DOM order (the old drag mutates data
// only; nothing moves visually until pointerup).
//
// Run: node app/worker/harness-v684.mjs
//      ORA_WT=/path/to/other-tree node /path/to/harness-v684.mjs
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
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixtures ----------
const MORNING0 = [
  { kind: 'source', key: 'ext-morning-prayer', side: 'sth' },
  { kind: 'prayer', key: 'our-father' },
  { kind: 'source', key: 'daily-rosary' },
  { kind: 'prayer', key: 'hail-mary' },
];
const ID = (it) => it.kind + ':' + it.key;
const MORNING_IDS = MORNING0.map(ID);
check('F fixture: Morning contents stand production-shaped — 4 stored items, the first a labeled-slot office item carrying side',
  MORNING0.length === 4 && MORNING0[0].kind === 'source' && MORNING0[0].key === 'ext-morning-prayer' && MORNING0[0].side === 'sth', MORNING_IDS);

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v684harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
check('F pin (Plan §2 decision 4): the served bundle stands at the pre-v684 pin ora-pro-nobis-v680-1 on the current tree (v684-1 lands at Implement)',
  APPJS.length > 0 && SHELL.length > 0, { appJs: APPJS.length });
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ---------- world ----------
const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 200)));
await pg.addInitScript(({ MORNING0 }) => {
  const CORE = ['Morning', 'Midmorning', 'Afternoon', 'Evening', 'Night']; // Midday OFF (v635 greyed group)
  const freshContents = () => ({
    Morning: JSON.parse(JSON.stringify(MORNING0)),
    Midday: [{ kind: 'prayer', key: 'angelus' }],
    Evening: [{ kind: 'source', key: 'ext-evening-prayer', side: 'sth' }],
    Night: [{ kind: 'prayer', key: 'our-father' }],
  });
  window.__store = { contents: freshContents(), todayLayer: null, caps: [] };
  window.__reset684 = () => { window.__store = { contents: freshContents(), todayLayer: null, caps: [] }; };
  window.__profilesRes = () => {
    const c = JSON.parse(JSON.stringify(window.__store.contents));
    const layers = { novenas: { on: false }, podcasts: { on: false, series: [] } };
    return { ok: true,
      profiles: [{ key: 'salesian', name: 'The Salesian Way', honorLine: '', kind: 'default', coreBlocks: CORE.slice(), layers: JSON.parse(JSON.stringify(layers)), contents: c }],
      state: { standingKey: 'salesian', version: 1 },
      todayEdit: window.__store.todayLayer ? JSON.parse(JSON.stringify(window.__store.todayLayer)) : null,
      effective: { key: 'salesian', name: 'The Salesian Way', honorLine: '', resolvedBy: 'standing', dayKind: 'weekday',
        coreBlocks: CORE.slice(),
        layers: [{ key: 'novenas', on: false }, { key: 'podcasts', on: false, series: [] }],
        contents: JSON.parse(JSON.stringify(c)), version: 1 } };
  };
  window.__mkDay = (date) => ({
    ok: true, date, presentedDay: date, dateLabel: date,
    blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
    additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
    profile: { key: 'salesian', contents: JSON.parse(JSON.stringify(window.__store.contents)) },
  });
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(body))), text: () => Promise.resolve('') });
  window.fetch = (url, opts) => {
    const u = String(url);
    const method = (opts && opts.method) || 'GET';
    if (u.includes('/api/prayer/profiles/today-edit') && method === 'PUT') {
      let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
      window.__store.caps.push({ path: 'today-edit', body: JSON.parse(JSON.stringify(body)) });
      window.__store.todayLayer = body.layer || null;
      return resp(window.__profilesRes());
    }
    if (u.includes('/api/prayer/profiles/save') && method === 'PUT') {
      let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
      window.__store.caps.push({ path: 'save', body: JSON.parse(JSON.stringify(body)) });
      if (body.contents) window.__store.contents = JSON.parse(JSON.stringify(body.contents));
      return resp(window.__profilesRes());
    }
    if (u.includes('/api/prayer/profiles')) return resp(window.__profilesRes());
    if (u.includes('/api/player/day')) return resp(window.__mkDay('2026-11-25'));
    if (u.includes('/api/player/podcasts')) return resp({ ok: true, seriesList: [] });
    if (u.includes('/api/player/track-draws')) return resp({ ok: true, draws: {} });
    return new Promise(() => {});
  };
}, { MORNING0 });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

async function openForm() {
  await pg.evaluate(async () => {
    state.dayPayload = window.__mkDay('2026-11-25');
    state.tab = 'prayers'; state.prayersView = { kind: 'home' };
    opn604.res = null; opn604.lists = {}; opn604.base = {}; opn604.removed = {};
    await opnLoadRes604();
    opn604.scope = 'today'; opn604.scopeSwitched = false;
    opnStartEdit607();
  });
  await pg.waitForTimeout(500);
}
const morningRows = () => pg.evaluate(() => [...document.querySelectorAll('[data-p604exp="Morning"] [data-p604erow]')].map((r) => r.getAttribute('data-p604erow')));
async function tryClick(loc) { try { await loc.click({ timeout: 4000 }); return true; } catch (e) { return false; } }
const capsIds = () => pg.evaluate(() => {
  const caps = window.__store.caps;
  const last = caps[caps.length - 1];
  if (!last) return null;
  const c = last.path === 'today-edit' ? (last.body.layer && last.body.layer.contents) : last.body.contents;
  return c && c.Morning ? c.Morning.map((it) => it.kind + ':' + it.key) : null;
});

// ---------- L1: buttons exist + geometry; handle evidence ----------
await openForm();
const rows0 = await morningRows();
check('setup: the Edit form opens on Morning with the 4 fixture rows standing', JSON.stringify(rows0) === JSON.stringify(MORNING_IDS), rows0);
const l1 = await pg.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-p604exp="Morning"] [data-p604erow]')];
  return rows.map((r, i) => {
    const btns = [...r.querySelectorAll('[data-p684move]')];
    return { i, n: btns.length,
      kinds: btns.map((x) => x.getAttribute('data-p684move').split('|')[2]),
      boxes: btns.map((x) => { const q = x.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height) }; }),
      upDisabled: btns.length ? btns[0].disabled : null, downDisabled: btns.length ? btns[1].disabled : null,
      labels: btns.map((x) => x.getAttribute('aria-label')) };
  });
});
check('L1 every Morning contents row carries exactly two move buttons (up + down, in that order)',
  l1.length === 4 && l1.every((r) => r.n === 2 && r.kinds[0] === 'up' && r.kinds[1] === 'down'), l1.map((r) => r.kinds));
check('L1 every move button box is >= 40px wide x >= 44px tall at 390px phone width',
  l1.length === 4 && l1.every((r) => r.n === 2 && r.boxes.every((q) => q.w >= 40 && q.h >= 44)), l1.map((r) => r.boxes));
check('L1 aria labels stand: "Move up" / "Move down" on every button',
  l1.every((r) => r.labels[0] === 'Move up' && r.labels[1] === 'Move down'), l1.map((r) => r.labels));
check('L1 boundary shape: first row up DISABLED, last row down DISABLED, inner buttons enabled',
  l1.length === 4 && l1[0].upDisabled === true && l1[3].downDisabled === true && l1[0].downDisabled === false && l1[3].upDisabled === false,
  l1.map((r) => ({ up: r.upDisabled, down: r.downDisabled })));
const handleBox = await pg.evaluate(() => {
  const h = document.querySelector('[data-p604exp="Morning"] [data-p604handle]');
  if (!h) return null;
  const q = h.getBoundingClientRect();
  return { w: Math.round(q.width * 10) / 10, h: Math.round(q.height * 10) / 10 };
});
console.log('EVIDENCE old .p604handle box (first Morning row): ' + JSON.stringify(handleBox));

// ---------- L5: no drag (evidence drive first, then the checks) ----------
{
  const before = await morningRows();
  const hb = await pg.locator('[data-p604exp="Morning"] [data-p604handle]').first().boundingBox().catch(() => null);
  const row1 = await pg.locator('[data-p604exp="Morning"] [data-p604erow]').nth(0).boundingBox().catch(() => null);
  const row2 = await pg.locator('[data-p604exp="Morning"] [data-p604erow]').nth(1).boundingBox().catch(() => null);
  let midOrder = null, afterOrder = null, capsBefore = 0, capsAfter = 0;
  capsBefore = await pg.evaluate(() => window.__store.caps.length);
  if (hb && row2) {
    const cx = hb.x + hb.width / 2, cy = hb.y + hb.height / 2;
    await pg.mouse.move(cx, cy);
    await pg.mouse.down();
    await pg.mouse.move(cx, row2.y + row2.height / 2, { steps: 12 });
    await pg.waitForTimeout(250);
    midOrder = await morningRows();
    await pg.mouse.up();
    await pg.waitForTimeout(600);
  } else if (row1 && row2) {
    // R1 (v684 Repair): no handle stands post-fix — drive the drag
    // from a ROW's box: pointerdown on the row body of a Morning
    // contents row, pointermove to the next row's center, pointerup.
    const cx = row1.x + row1.width / 2, cy = row1.y + row1.height / 2;
    await pg.mouse.move(cx, cy);
    await pg.mouse.down();
    await pg.mouse.move(cx, row2.y + row2.height / 2, { steps: 12 });
    await pg.waitForTimeout(250);
    midOrder = await morningRows();
    await pg.mouse.up();
    await pg.waitForTimeout(600);
  }
  afterOrder = await morningRows();
  capsAfter = await pg.evaluate(() => window.__store.caps.length);
  console.log('EVIDENCE mid-drag DOM order (old drag: data moves, DOM does not): ' + JSON.stringify(midOrder));
  console.log('EVIDENCE after pointerup DOM order: ' + JSON.stringify(afterOrder) + ' · writes during drag: ' + (capsAfter - capsBefore));
  const handleCount = await pg.evaluate(() => document.querySelectorAll('.p609edit [data-p604handle]').length);
  check('L5 data-p604handle count in the Edit form is 0', handleCount === 0, { handleCount });
  check('L5 a driven pointer drag starting on a row moves nothing (DOM order unchanged, no write)',
    JSON.stringify(afterOrder) === JSON.stringify(before) && capsAfter === capsBefore, { before, afterOrder, writes: capsAfter - capsBefore });
}

// ---------- L2: driven move + persist + re-entry + composed ----------
await pg.evaluate(() => window.__reset684());
await openForm();
{
  const rid2 = MORNING_IDS[1];
  const tapped2 = await tryClick(pg.locator('[data-p684move="Morning|' + rid2 + '|up"]'));
  await pg.waitForTimeout(700);
  if (!tapped2) check('L2 the row 2 up button stands to be tapped', false, { rid2 });
  const want = [MORNING_IDS[1], MORNING_IDS[0], MORNING_IDS[2], MORNING_IDS[3]];
  const dom = await morningRows();
  check('L2 driven tap on row 2 up: the DOM order swaps at once', JSON.stringify(dom) === JSON.stringify(want), dom);
  const cap = await capsIds();
  check('L2 the captured save payload (today-edit) carries the new Morning contents order', JSON.stringify(cap) === JSON.stringify(want), cap);
  await pg.evaluate(() => { opnExitEdit607(); });
  await pg.waitForTimeout(300);
  await openForm();
  const dom2 = await morningRows();
  check('L2 leave + re-enter the form: the new order stands', JSON.stringify(dom2) === JSON.stringify(want), dom2);
  const composed = await pg.evaluate(() => {
    const eff = opn604.res.effective;
    const lay = opn604.res.todayEdit;
    const comp = lay ? opnApplyTodayLayer594(eff, lay) : eff;
    return comp && comp.contents && comp.contents.Morning ? comp.contents.Morning.map((it) => it.kind + ':' + it.key) : null;
  });
  check('L2 the composed Praylist list follows the new order (the today layer applied over the standing contents)',
    JSON.stringify(composed) === JSON.stringify(want), { composed });
}

// ---------- L3: down + boundary ----------
await pg.evaluate(() => window.__reset684());
await openForm();
{
  const rid1 = MORNING_IDS[0];
  const tapped3 = await tryClick(pg.locator('[data-p684move="Morning|' + rid1 + '|down"]'));
  await pg.waitForTimeout(700);
  if (!tapped3) check('L3 the row 1 down button stands to be tapped', false, { rid1 });
  const want = [MORNING_IDS[1], MORNING_IDS[0], MORNING_IDS[2], MORNING_IDS[3]];
  const dom = await morningRows();
  check('L3 driven tap on row 1 down: it moves exactly one seat', JSON.stringify(dom) === JSON.stringify(want), dom);
  const lastRid = want[3];
  const capsN = await pg.evaluate(() => window.__store.caps.length);
  // R2 (v684 Repair): scroll the disabled button into view and use a
  // locator click (the L6 pattern) so the tap lands on the disabled
  // button itself, not the fixed bottom tab bar that intercepts a
  // raw bounding-box click at the unscrolled position.
  const disLoc = pg.locator('[data-p684move="Morning|' + lastRid + '|down"]');
  await disLoc.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => null);
  await pg.waitForTimeout(300);
  await disLoc.click({ force: true, timeout: 4000 }).catch(() => null);
  await pg.waitForTimeout(500);
  const dom2 = await morningRows();
  const capsN2 = await pg.evaluate(() => window.__store.caps.length);
  check('L3 a driven tap on the DISABLED last-row down button changes nothing (order + no new write)',
    JSON.stringify(dom2) === JSON.stringify(want) && capsN2 === capsN, { dom2, writes: capsN2 - capsN });
}

// ---------- L4: the office row ----------
await pg.evaluate(() => window.__reset684());
await openForm();
{
  const officeRid = MORNING_IDS[0];
  const tapped4 = await tryClick(pg.locator('[data-p684move="Morning|' + officeRid + '|down"]'));
  await pg.waitForTimeout(700);
  if (!tapped4) check('L4 the office row down button stands to be tapped', false, { officeRid });
  const st = await pg.evaluate((rid) => {
    const row = document.querySelector('[data-p604exp="Morning"] [data-p604erow="' + CSS.escape(rid) + '"]');
    if (!row) return null;
    const tog = row.querySelector('[data-p670toggle]');
    const act = row.querySelector('[data-p670side].active');
    return { idx: [...document.querySelectorAll('[data-p604exp="Morning"] [data-p604erow]')].indexOf(row),
      tog: !!tog, active: act ? act.getAttribute('data-p670side') : null };
  }, officeRid);
  check('L4 the office item moved one seat and its segtoggle stands with the picked side (sth) active',
    !!st && st.idx === 1 && st.tog === true && st.active === 'sth', st);
  await pg.evaluate((rid) => {
    const row = document.querySelector('[data-p604exp="Morning"] [data-p604erow="' + CSS.escape(rid) + '"]');
    const btn = row && row.querySelector('[data-p670side="do"]');
    if (btn) btn.click();
  }, officeRid);
  await pg.waitForTimeout(700);
  const st2 = await pg.evaluate((rid) => {
    const row = document.querySelector('[data-p604exp="Morning"] [data-p604erow="' + CSS.escape(rid) + '"]');
    const act = row && row.querySelector('[data-p670side].active');
    const cap = window.__store.caps[window.__store.caps.length - 1];
    const c = cap ? (cap.path === 'today-edit' ? (cap.body.layer && cap.body.layer.contents) : cap.body.contents) : null;
    const item = c && c.Morning ? c.Morning.filter((it) => it.key === 'ext-morning-prayer')[0] : null;
    return { active: act ? act.getAttribute('data-p670side') : null, savedSide: item ? item.side : null };
  }, officeRid);
  check('L4 the toggle still flips after the move: side do active in the row and side do in the saved payload',
    !!st2 && st2.active === 'do' && st2.savedSide === 'do', st2);
}

// ---------- L6: form shape regression ----------
await pg.evaluate(() => window.__reset684());
await openForm();
{
  const groups = await pg.evaluate(() => [...document.querySelectorAll('.p609edit [data-p604exp]')].map((g) => ({ block: g.getAttribute('data-p604exp'), off: g.classList.contains('p609off') })));
  const wantOrder = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
  check('L6 groups stand at day positions (v635): group order is the day order',
    JSON.stringify(groups.map((g) => g.block)) === JSON.stringify(wantOrder), groups.map((g) => g.block));
  check('L6 the off group (Midday) stands greyed IN PLACE (p609off at its day position, not the tail)',
    groups.length === 7 && groups[3].block === 'Midday' && groups[3].off === true && groups[1].off === false, groups);
  const lastRid = MORNING_IDS[3];
  await pg.locator('[data-p604remove="Morning|' + lastRid + '"]').click();
  await pg.waitForTimeout(700);
  const dom = await morningRows();
  const cap = await capsIds();
  check('L6 Remove still removes + writes: the row leaves the form and the saved Morning contents',
    JSON.stringify(dom) === JSON.stringify(MORNING_IDS.slice(0, 3)) && !!cap && !cap.includes(lastRid), { dom, cap });
}

await b.close();
server.close();
console.log('\nharness-v684: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
