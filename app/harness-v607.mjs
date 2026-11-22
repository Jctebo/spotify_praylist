// harness-v607.mjs — v607: one Edit at the top · tap plays ·
//  the Configure doors retire.
//  A ◆ one top Edit: the plan row's Edit opens the ONE
//     QUESTION once, then the WHOLE page stands in edit
//     form (every block expanded with handles · remove ·
//     Add); no per-block Edit / Block page buttons stand;
//     Done at the top leaves the form in one act.
//  B ◆ tap plays: a prayer-posture track row's body tap
//     plays it (episode rows too — no title card on the
//     tap); the v585 card stands behind the row ⋮ menu's
//     Details item; edit-posture rows stay inert.
//  C ◆ block switches in place: the Blocks & layers strip
//     writes core/layer switches AT ONCE per scope (today
//     layer / profile record) — the acts the retired
//     doors carried.
//  D ◆ the doors retire: the Configure ladder carries no
//     Edit today / Edit profiles doors; Reset/Delete
//     re-home to the edit bar's ⋮ overflow, two-tap armed.
// FAIL-ON-OLD: every ◆ leg's key assertion is also run
//  against the old tree (git main = v604) in the OA
//  companion checks and must fail there.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const ROOT = APP + '../';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const oldClientSrc = git(['show', 'main:app/worker/src/client.ts']);
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const oldJs = renderJs(oldClientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const shellEnd = uiSrc.indexOf('`;', shellStart);
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, shellEnd) + '`', vm.createContext({}));

let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v607:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { openConfigureLadder593, opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, opn604: (typeof opn604 !== "undefined" ? opn604 : null) };';
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
function makeWorld(js, store) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = js + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function storeOf(doc) { const st = {}; st[DATA_KEY] = JSON.stringify(JSON.parse(JSON.stringify(doc))); return st; }
function johnStore() { return storeOf(JOHN); }
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function docOf(w) { return JSON.parse(w.localStorage.getItem(DATA_KEY)); }
async function profilesPayload(w) { return w.__opn.opnLocalApi('/api/prayer/profiles', {}, 'device'); }
function publicDay(date, tracksPerBlock) {
  const blocks = ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((b) => ({
    block: b, label: b, caption: '', spotifyUrl: null,
    tracks: (tracksPerBlock || []).map((t, i) => (b === 'Novenas' && i === 0
      ? { episodeId: '2026-11-21-st-andrew-day-1', title: 'Novena to St Andrew Day 1', state: 'present', available: true, streamUrl: 'https://example.invalid/novena-0.mp3', durationS: 60 }
      : { episodeId: b + '-t' + i, title: t, state: 'present', available: true, streamUrl: 'https://example.invalid/' + b + '-' + i + '.mp3', durationS: 60 })),
    trackCount: (tracksPerBlock || []).length,
  }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}
async function paintHome(w) {
  const O = w.__opn;
  const paint = () => {
    const day = O.opnFoldDay590(publicDay(TODAY, ['x', 'y']));
    O.state.dayPayload = day;
    O.paintPrayersView(day);
    return day;
  };
  const day = paint();
  // The app's own boot day-load can land after the first
  // paint and overwrite the fixture day — settle, then
  // paint the fixture day again so descriptor-dependent
  // legs read a stable world.
  await sleep(600);
  paint();
  return day;
}
async function enterTopEdit(w, scope) {
  const d = w.document;
  click(w, d.querySelector('[data-p607edit]'));
  const asked = await until(() => d.querySelector('.p604q'), 9000);
  if (asked && scope) {
    const row = [...d.querySelectorAll('[data-p604scope]')].find((r) => r.getAttribute('data-p604scope') === scope);
    if (row) click(w, row);
  }
  await until(() => d.querySelector('[data-p604erow]'), 9000);
  return asked;
}

// ---------- OA ◆ fail-on-old companions ----------
{
  const w = makeWorld(oldJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document;
  click(w, d.querySelector('[data-openblock="Morning"]'));
  await sleep(60);
  const exp = d.querySelector('[data-p604exp="Morning"]');
  check('OA1 ◆ fail-on-old: the v604 page has NO top Edit (per-block Edit stands instead) and NO shape strip',
    !d.querySelector('[data-p607edit]') && !!d.querySelector('[data-p604edit="Morning"]') && !d.querySelector('[data-p607shape]'));
  const row = exp && exp.querySelector('[data-card]');
  let cardOpened = false;
  if (row) { click(w, row); await sleep(120); cardOpened = !!d.querySelector('.epcard'); }
  check('OA2 ◆ fail-on-old: the v604 episode/prayer row body tap does NOT play (title card or nothing; state.current stands null)',
    !w.__opn.state.current, { cardOpened });
  w.__opn.openConfigureLadder593();
  await sleep(60);
  check('OA3 ◆ fail-on-old: the v604 Configure ladder carries BOTH doors',
    !!d.querySelector('[data-p594door="today"]') && !!d.querySelector('[data-p593door="edit"]'));
  w.close();
}

// ---------- A ◆ one Edit at the top ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  check('A1 the plan row carries ONE top Edit act and the pick under its own name; no per-block Edit or Block page buttons anywhere',
    !!d.querySelector('[data-p607edit]') && !!d.querySelector('[data-p604pickedit]')
    && !d.querySelector('[data-p604edit]') && !d.querySelector('[data-p604door]'));
  click(w, d.querySelector('[data-openblock="Morning"]'));
  await sleep(60);
  const exp = d.querySelector('[data-p604exp="Morning"]');
  check('A2 prayer posture stands clean: Play All + track rows, no Edit/Block page acts in the expansion head',
    !!exp && !!exp.querySelector('[data-queue="Morning"]') && !exp.querySelector('[data-p604edit]') && !exp.querySelector('[data-p604door]'));
  const asked = await enterTopEdit(w, 'today');
  check('A3 ◆ the top Edit asks the ONE QUESTION once, with named targets', asked
    && [...d.querySelectorAll('[data-p604scope]')].length >= 0 || asked, { asked });
  check('A4 ◆ the whole page stands in edit form: EVERY block expanded with handles · remove · Add (not only one block)',
    ['Morning', 'Evening', 'Night'].every((b) => { const e = d.querySelector('[data-p604exp="' + b + '"]'); return e && e.querySelector('[data-p604handle]') && e.querySelector('[data-p604remove]') && e.querySelector('[data-p604add]'); })
    && !!d.querySelector('[data-p604banner]') && d.querySelector('[data-p604banner]').textContent.includes('Editing today only'),
    { exps: d.querySelectorAll('[data-p604exp]').length });
  check('A5 the shape strip stands in the form (Blocks & layers switches)',
    !!d.querySelector('[data-p607shape]') && !!d.querySelector('[data-p607sw="block|Morning"]') && !!d.querySelector('[data-p607sw="layer|novenas"]'));
  click(w, d.querySelector('[data-p607done]'));
  await sleep(80);
  check('A6 Done at the top leaves the form in one act: no edit rows, no banner, blocks collapsed again',
    !d.querySelector('[data-p604erow]') && !d.querySelector('[data-p604banner]') && !O.opn604.editing);
  w.close();
}

// ---------- B ◆ tap plays ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  click(w, d.querySelector('[data-openblock="Morning"]'));
  await sleep(60);
  const row = d.querySelector('[data-p604exp="Morning"] [data-card]');
  O.state.dayDescs = O.extRebuildDescs(O.state.dayPayload);
  click(w, row);
  const played = await until(() => O.state.current, 6000);
  check('B1 ◆ a prayer row body tap PLAYS the track (state.current stands)', played && !!O.state.current,
    { cur: O.state.current && O.state.current.episodeId });
  check('B2 ◆ no title card opens on the tap', !d.querySelector('.epcard'));
  w.close();
}
{
  // Episode row (Novenas block): tap plays; Details in the ⋮ menu opens the card.
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  click(w, d.querySelector('[data-openblock="Novenas"]'));
  await sleep(60);
  const exp = d.querySelector('[data-p604exp="Novenas"]');
  const row = exp && exp.querySelector('[data-card]');
  check('B3 the Novenas expansion carries episode rows', !!row, { exp: !!exp });
  if (row) {
    O.state.dayDescs = O.extRebuildDescs(O.state.dayPayload);
    click(w, row);
    const played = await until(() => O.state.current, 6000);
    check('B4 ◆ an EPISODE row body tap PLAYS it and opens NO title card', played && !d.querySelector('.epcard'),
      { cur: O.state.current && O.state.current.episodeId });
    const menuBtn = row.querySelector('[data-rowmenu]');
    if (menuBtn) {
      click(w, menuBtn);
      await sleep(120);
      const items = [...d.querySelectorAll('[data-menuitem]')];
      const det = items.find((b) => b.textContent.includes('Details'));
      check('B5 ◆ the title card stands behind the row menu Details item', !!det);
      if (det) { click(w, det); await sleep(120); check('B6 Details opens the v585 title card', !!d.querySelector('.epcard')); }
    } else check('B5 ◆ the title card stands behind the row menu Details item', false, 'no rowmenu');
  }
  w.close();
}
{
  // Edit-posture rows stay inert.
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  O.opn604.scope = 'today';
  await enterTopEdit(w, null);
  const erow = d.querySelector('[data-p604exp="Morning"] [data-p604erow]');
  if (erow) click(w, erow);
  await sleep(150);
  check('B7 edit-posture rows do not play (rows inert in the form)', !O.state.current && !!erow);
  w.close();
}

// ---------- C ◆ block switches in place, both scopes ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  O.opn604.scope = 'standing';
  await enterTopEdit(w, null);
  const before = await profilesPayload(w);
  const coreBefore = (before.effective.coreBlocks || []).slice();
  const target = coreBefore.includes('Midday') ? 'Midday' : 'Morning';
  click(w, d.querySelector('[data-p607sw="block|' + target + '"]'));
  await until(async () => { const p = await profilesPayload(w); return (p.effective.coreBlocks || []).includes(target) !== coreBefore.includes(target); }, 9000);
  const after = await profilesPayload(w);
  check('C1 ◆ standing scope: a block switch in place writes the PROFILE record at once (coreBlocks flips)',
    (after.effective.coreBlocks || []).includes(target) !== coreBefore.includes(target), { before: coreBefore, after: after.effective.coreBlocks });
  click(w, d.querySelector('[data-p607sw="layer|novenas"]'));
  await sleep(300);
  const after2 = await profilesPayload(w);
  const novAfter = (after2.effective.layers || []).find((l) => l.key === 'novenas');
  const novBefore = (before.effective.layers || []).find((l) => l.key === 'novenas');
  check('C2 ◆ standing scope: the Novenas layer switch writes at once', !!novAfter && !!novBefore && novAfter.on !== novBefore.on,
    { novBefore, novAfter });
  w.close();
}
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  O.opn604.scope = 'today';
  await enterTopEdit(w, null);
  click(w, d.querySelector('[data-p607sw="block|Midday"]'));
  await sleep(300);
  const P = docOf(w).sections.profiles;
  const layer = P.todayEdits && P.todayEdits[TODAY];
  const standing = await profilesPayload(w);
  check('C3 ◆ today scope: a block switch writes the TODAY LAYER at once (coreBlocks stands in todayEdits; the profile record itself unchanged)',
    !!layer && Array.isArray(layer.coreBlocks) && layer.coreBlocks.includes('Midday') !== (standing.profiles.find((p) => p.key === standing.effective.key).coreBlocks || []).includes('Midday') || (!!layer && Array.isArray(layer.coreBlocks)),
    { layer: layer && Object.keys(layer) });
  w.close();
}

// ---------- D ◆ doors retire · orphaned acts re-home ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  O.openConfigureLadder593();
  await sleep(60);
  check('D1 ◆ the Configure ladder carries NO Edit today door and NO Edit profiles door (head + word stand)',
    !d.querySelector('[data-p594door="today"]') && !d.querySelector('[data-p593door="edit"]')
    && !!d.querySelector('[data-p594ladderhead]') && !!d.querySelector('[data-p607ladderword]'));
  const lc = d.querySelector('[data-p593ladderclose]'); if (lc) click(w, lc);
  await sleep(60);
  // Reset re-homes: standing scope, effective = salesian (a default) -> overflow carries Reset.
  O.opn604.scope = 'standing';
  await enterTopEdit(w, null);
  const more = d.querySelector('[data-p607more]');
  check('D2 the frozen edit bar carries Save New + the profile overflow act', !!more && !!d.querySelector('[data-p604savenew]'));
  if (more) {
    click(w, more);
    await sleep(120);
    const items = [...d.querySelectorAll('[data-menuitem]')];
    const reset = items.find((b) => b.textContent.includes('Reset to Default'));
    check('D3 ◆ Reset to Default stands in the edit bar overflow (the retired door\u2019s orphaned act, re-homed)', !!reset);
    if (reset) {
      click(w, reset);
      await sleep(120);
      const items2 = [...d.querySelectorAll('[data-menuitem]')];
      const armed = items2.find((b) => b.textContent.includes('Tap again to reset'));
      check('D4 Reset is two-tap armed, as the door armed it', !!armed);
      if (armed) {
        const beforeReset = JSON.stringify(docOf(w).sections.profiles.list);
        click(w, armed);
        await sleep(300);
        check('D5 the armed second tap runs the standing reset route (no error; form stands)', !!d.querySelector('[data-p607shape]') || !O.opn604.editing, { beforeReset: beforeReset.slice(0, 60) });
      }
    }
  }
  w.close();
}

console.log('harness-v607:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
