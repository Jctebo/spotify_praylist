// harness-v609.mjs — v609: merge everything into one set.
//  M ◆ the merged set: the Praylist home paints ONE
//     continuous list of the day's tracks in fold order —
//     no block header cards, no expansions, no dividers,
//     no per-block marks; the fold option retires (its
//     menu acts stand nowhere); ONE Play All at the set's
//     head queues the whole day in fold order; a tap on a
//     track plays it (v607's rule stands).
//  E ◆ the edit form over the set: exactly ONE edit
//     entry on the page, at the top (the plan row); the
//     form's rows are CONDENSED (title · drag · remove —
//     no Intention line, no duration); drags reorder
//     within their block's run and a cross-boundary
//     target is inert; the today-edits mark stands on
//     the plan row only; Done leaves the form in one act.
// FAIL-ON-OLD: the ◆ legs' key assertions are also run
//  against the old tree (git main = v607) in the OA
//  companions and must fail there.
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
catch (e) { check('R0 jsdom available', false, e.message); console.log('harness-v609:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
const HOOK = '\n;window.__opn = { openConfigureLadder593, opnLocalApi, opnMode, state, opnFoldDay590, paintPrayersView, extRebuildDescs, profPlanRowHtml, opnDragOver604, opnMaterialize604, opnTodayItemId594, opn604: (typeof opn604 !== "undefined" ? opn604 : null) };';
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

// ---------- OA ◆ fail-on-old companions (old = v607 on main) ----------
{
  const w = makeWorld(oldJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document;
  check('OA1 ◆ fail-on-old: the v607 page has NO merged set — block rows stand instead',
    !d.querySelector('[data-p609set]') && !!d.querySelector('[data-openblock="Morning"]'));
  check('OA2 ◆ fail-on-old: the v607 client carries NO __all queue branch and NO condensed row class',
    !oldClientSrc.includes("'__all'") && !oldClientSrc.includes('p609erow'));
  const asked = await enterTopEdit(w, 'today');
  check('OA3 ◆ fail-on-old: the v607 edit form paints per-block expansions, NOT the merged edit set',
    asked && !d.querySelector('[data-p609set]') && !!d.querySelector('[data-p604exp="Morning"]'));
  w.close();
}

// ---------- M ◆ the merged set ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  const day = await paintHome(w);
  const d = w.document, O = w.__opn;
  const body = d.querySelector('#home-body');
  const set = d.querySelector('[data-p609set]');
  check('M1 ◆ ONE set stands on the home; NO block rows, NO block cards, NO per-block marks inside it — the set\u2019s children are ONLY the Play All head + track rows',
    !!set && !!body && body.contains(set)
    && !body.querySelector('[data-openblock]') && !body.querySelector('.blockrow')
    && !body.querySelector('[data-p604todaymark]')
    && [...set.children].every((c) => c.classList.contains('p604exphead') || c.hasAttribute('data-card')),
    { openblocks: body ? body.querySelectorAll('[data-openblock]').length : -1, kids: set ? [...set.children].map((c) => c.className).slice(0, 4) : [] });
  const descs = O.extRebuildDescs(day);
  const painted = [...set.querySelectorAll('[data-card]')].map((r) => r.getAttribute('data-card'));
  const expected = descs.map((x) => x.episodeId).filter(Boolean);
  check('M2 ◆ the set paints the day\u2019s tracks in FOLD ORDER (painted data-card sequence == extRebuildDescs order)',
    painted.length > 0 && JSON.stringify(painted) === JSON.stringify(expected),
    { painted: painted.slice(0, 6), expected: expected.slice(0, 6), pn: painted.length, en: expected.length });
  check('M3 ◆ the fold acts stand NOWHERE in the client (no Praylist Expand all / Collapse all wiring; the Favorites fold acts are untouched)',
    !appJs.includes("opnSetPraylistMode604('expanded')") && !appJs.includes("opnSetPraylistMode604('collapsed')") && appJs.includes('favExpandAll'));
  const allBtn = set.querySelector('[data-queue="__all"]');
  check('M4 ◆ ONE Play All stands at the set\u2019s head; no per-block queue buttons stand in the set',
    !!allBtn && set.querySelectorAll('[data-queue]').length === 1);
  if (allBtn) {
    click(w, allBtn);
    const queued = await until(() => O.state.queue && O.state.queue.length === descs.length, 6000);
    const qIds = (O.state.queue || []).map((x) => x.episodeId);
    check('M5 ◆ Play All queues the WHOLE day in fold order (state.queue == the composed sequence)',
      queued && JSON.stringify(qIds) === JSON.stringify(expected), { qn: qIds.length, en: expected.length });
  }
  const row = set.querySelector('[data-card]');
  if (row) {
    O.state.dayDescs = O.extRebuildDescs(O.state.dayPayload);
    click(w, row);
    const played = await until(() => O.state.current, 6000);
    check('M6 ◆ a tap on a track in the set PLAYS it (v607\u2019s rule stands)', played && !!O.state.current,
      { cur: O.state.current && O.state.current.episodeId });
  }
  w.close();
}

// ---------- E ◆ one Edit at the top · the condensed form ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  const edits = [...d.querySelectorAll('[data-p607edit]')];
  const set = d.querySelector('[data-p609set]');
  check('E1 ◆ exactly ONE edit entry stands on the page, in the plan row, BEFORE the set; no per-block edit entries anywhere',
    edits.length === 1 && !!edits[0].closest('.profplanrow') && !!set
    && (edits[0].compareDocumentPosition(set) & w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    && !d.querySelector('[data-p604edit]') && !d.querySelector('[data-p604door]'),
    { n: edits.length });
  check('E2 the plan-row Pick stands at the top under its own name (the switch is NOT inside the edit screen)',
    !!d.querySelector('[data-p604pickedit]'));
  const asked = await enterTopEdit(w, 'today');
  check('E3 ◆ the top Edit asks the ONE QUESTION once and the scope banner stands (the form\u2019s only head furniture besides the bar — NO switches section at the top)',
    asked && !!d.querySelector('[data-p604banner]') && d.querySelector('[data-p604banner]').textContent.includes('Editing today only')
    && !!d.querySelector('[data-p604bar]') && !d.querySelector('[data-p609set] [data-p604pickedit]')
    && !d.querySelector('[data-p607shape]'));
  const eset = d.querySelector('[data-p609set].p609edit');
  const groups = [...d.querySelectorAll('[data-p609set] [data-p604exp]')];
  check('E4 ◆ the edit form paints the merged EDIT SET: groups under group heads (name + toggle), no block cards, no section headings',
    !!eset && groups.length === 8 && groups.every((g) => { const h = g.querySelector('[data-p609ghead]'); return h && h.querySelector('[data-p607sw]') && !g.querySelector('.blockrow') && !g.querySelector('h1,h2,h3'); }),
    { groups: groups.length });
  const erows = [...d.querySelectorAll('[data-p604erow]')];
  check('E5 ◆ edit rows are CONDENSED: every row carries the compact class; the set\u2019s text carries NO Intention line',
    erows.length > 0 && erows.every((r) => r.classList.contains('p609erow'))
    && !(eset && eset.textContent.includes('Intention:')),
    { rows: erows.length });
  // Drag legs against the store: within-run reorder + cross-boundary inert.
  const idOf = (it) => O.opnTodayItemId594(it);
  const mList = O.opnMaterialize604('Morning');
  const nList = O.opnMaterialize604('Night');
  if (mList.length >= 2 && nList.length >= 1) {
    const before = mList.map(idOf);
    O.opnDragOver604('Morning', before[1], before[0]);
    const after = O.opnMaterialize604('Morning').map(idOf);
    check('E6 ◆ a drag WITHIN a block\u2019s run reorders its contents (the store list moves)',
      after[0] === before[1] && after[1] === before[0], { before: before.slice(0, 3), after: after.slice(0, 3) });
    const mBefore2 = O.opnMaterialize604('Morning').map(idOf);
    const nBefore = O.opnMaterialize604('Night').map(idOf);
    O.opnDragOver604('Morning', mBefore2[0], nBefore[0]);
    check('E7 ◆ a drag ACROSS a former block boundary is INERT (no move writes between blocks\u2019 contents)',
      JSON.stringify(O.opnMaterialize604('Morning').map(idOf)) === JSON.stringify(mBefore2)
      && JSON.stringify(O.opnMaterialize604('Night').map(idOf)) === JSON.stringify(nBefore));
  } else check('E6/E7 drag legs: fixture lists stand', false, { m: mList.length, n: nList.length });
  click(w, d.querySelector('[data-p607done]'));
  await sleep(80);
  check('E8 Done at the top leaves the form in one act: no edit rows, no banner, the merged set stands',
    !O.opn604.editing && !d.querySelector('[data-p604erow]') && !d.querySelector('[data-p604banner]') && !!d.querySelector('[data-p609set]'));
  w.close();
}

// ---------- G ◆ group toggles · off groups show · no top section ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  O.opn604.scope = 'today';
  await enterTopEdit(w, null);
  const sws = [...d.querySelectorAll('[data-p607sw]')];
  check('G1 \u25c6 NO switches section stands at the form\u2019s top: no strip stands, and every switch stands inside a GROUP (block/layer switches at the group heads; the series switches inside the Podcasts group \u2014 their named seat)',
    !d.querySelector('[data-p607shape]') && sws.length > 0 && sws.every((s) => !!s.closest('.p609group'))
    && sws.filter((s) => !((s.getAttribute('data-p607sw') || '').startsWith('series|'))).every((s) => !!s.closest('[data-p609ghead]')),
    { sws: sws.length });
  const heads = [...d.querySelectorAll('[data-p609ghead]')];
  const offHead = heads.find((h) => { const s = h.querySelector('[data-p607sw]'); return s && s.getAttribute('aria-checked') === 'false' && (s.getAttribute('data-p607sw') || '').startsWith('block|'); });
  check('G2 ◆ a toggled-OFF group SHOWS in the form: its head stands with the toggle off, the group is marked off, and its rows + Add stand in full',
    !!offHead && offHead.closest('.p609group').classList.contains('p609off')
    && !!offHead.closest('.p609group').querySelector('[data-p604add]'),
    { heads: heads.map((h) => h.getAttribute('data-p609ghead')) });
  if (offHead) {
    const offBlock = offHead.getAttribute('data-p609ghead');
    // G5 first (while the group is still off): remove an item inside the
    // off group, then flip it on — the edit must persist to its contents.
    const rm = offHead.closest('.p609group').querySelector('[data-p604remove]');
    let removedId = null;
    if (rm) { removedId = rm.getAttribute('data-p604remove').split('|')[1]; click(w, rm); await sleep(250); }
    const head2 = d.querySelector('[data-p609ghead="' + offBlock + '"]');
    click(w, (head2 || offHead).querySelector('[data-p607sw]'));
    const flipped = await until(async () => { const p = await profilesPayload(w); const layer = p.todayEdit; return layer && Array.isArray(layer.coreBlocks) && layer.coreBlocks.includes(offBlock); }, 9000);
    check('G3 ◆ flipping the group ON in the form writes at once (the today layer\u2019s coreBlocks gains the block)',
      flipped, { offBlock });
    click(w, d.querySelector('[data-p607done]'));
    await sleep(80);
    await paintHome(w);
    const set = d.querySelector('[data-p609set]');
    check('G4 ◆ the flipped-on group\u2019s tracks LAND in the prayer set at once (its episode rows stand in the one list)',
      !!set && !!set.querySelector('[data-card^="' + offBlock + '-t"]'), { offBlock });
    // Re-enter: the removal made while the group was off persisted.
    await enterTopEdit(w, null);
    const grp = d.querySelector('[data-p604exp="' + offBlock + '"]');
    const stillGone = removedId && grp && ![...grp.querySelectorAll('[data-p604erow]')].some((r) => r.getAttribute('data-p604erow') === removedId);
    check('G5 ◆ an edit made inside the OFF group PERSISTS to its contents (the removed item stays removed after the flip + re-entry)',
      !!stillGone, { removedId, rows: grp ? grp.querySelectorAll('[data-p604erow]').length : -1 });
  }
  w.close();
}

// ---------- E9 ◆ the today mark's seat ----------
{
  const w = makeWorld(appJs, johnStore());
  await sleep(400);
  await paintHome(w);
  const d = w.document, O = w.__opn;
  const html = O.profPlanRowHtml({ profile: { name: 'Test Way', todayEdits: true }, date: TODAY });
  check('E9 ◆ the today-edits mark stands on the PLAN ROW line; no per-block mark stands anywhere on the page',
    html.includes('today has its own edits') && !d.querySelector('[data-p604todaymark]'));
  w.close();
}

// ---------- P: podcasts \u2014 in by the ladder, out by the ordinary remove (John, 22:35\u201322:37 CT) ----------
// Fixture note: the harness day fixture carries no Podcasts
// standings, so the P world seeds the production-shaped
// extStanding row (the exact shape profContentsUniverse590
// reads: block \u00b7 slotId \u00b7 source) \u2014 on John's real day the
// build produces this row from his standing series.
{
  const w = makeWorld(appJs, johnStore());
  await paintHome(w);
  const O = w.__opn;
  O.state.ownStanding = [];
  O.state.extStanding = [{ block: 'Podcasts', slotId: 'bible-in-a-year', source: 'Bible in a Year' }];
  check('P0 standing scope for the podcast leg', await enterTopEdit(w, 'standing'));
  const group = () => [...w.document.querySelectorAll('.p609group')].find((g) => g.querySelector('[data-p607sw="layer|podcasts"]'));
  const rows = () => [...group().querySelectorAll('[data-p604erow]')];
  const contents = async () => { const d = docOf(w); const prof = (d.profiles || []).find((x) => x.id === (d.standingPick || d.pick || d.currentPick)) || (d.profiles || [])[0]; return (prof && prof.contents && prof.contents['Podcasts']) || []; };
  check('P1 \u25c6 the Podcasts group stands in the form with its toggle + Add button (items enter by the ladder \u2014 no standing catalog)',
    !!group() && !!group().querySelector('[data-p604add="Podcasts"]'));
  check('P1b \u25c6 the series switches stand inside the Podcasts group (their seat after the strip retired)',
    await until(() => group() && group().querySelectorAll('[data-p607sw^="series|"]').length > 0, 6000),
    group() ? group().querySelectorAll('[data-p607sw^="series|"]').length : 'no group');
  check('P2 \u25c6 the standing podcast source stands in the group as an ordinary item', rows().length === 1 && rows()[0].getAttribute('data-p604erow') === 'source:bible-in-a-year', rows().map((r) => r.getAttribute('data-p604erow')));
  const victimId = 'source:bible-in-a-year';
  click(w, rows()[0].querySelector('[data-p604remove]'));
  await sleep(150);
  check('P3 \u25c6 a podcast item REMOVES through the ordinary remove act, like any other track', !rows().some((r) => r.getAttribute('data-p604erow') === victimId));
  check('P4 \u25c6 the removal persists to the Podcasts contents', !(await contents()).includes(victimId), await contents());
  // In-session: the ladder's ids() read the form-open
  // resolution (standing v604 host behavior, untouched by
  // v609) \u2014 the just-removed source still paints marked.
  // (Re-seed: the write cycle rebuilt the standings from
  // the fixture day; the production build re-produces the
  // row on every cycle.)
  O.state.extStanding = [{ block: 'Podcasts', slotId: 'bible-in-a-year', source: 'Bible in a Year' }];
  click(w, group().querySelector('[data-p604add="Podcasts"]'));
  await until(() => w.document.querySelector('.profaddladder603'));
  click(w, w.document.querySelector('[data-p603door="sources"]'));
  await sleep(150);
  const marked = [...w.document.querySelectorAll('.profaddladder603 .bookrow')].find((r) => r.textContent.includes('Bible in a Year'));
  check('P5 \u25c6 in-session the ladder paints the removed source marked \u201cAlready in Podcasts\u201d (the standing v604 host reads the form-open resolution \u2014 named, not a v609 change)',
    !!marked && !marked.hasAttribute('data-p603additem'), marked && marked.textContent.replace(/\s+/g, ' ').slice(0, 80));
  click(w, w.document.querySelector('[data-p603close]'));
  await sleep(100);
  // Re-entry recomputes the resolution from the written doc:
  // the removal stands, and the ladder now offers the source.
  click(w, w.document.querySelector('[data-p607done]'));
  await until(() => !w.document.querySelector('[data-p604erow]'));
  // The write cycle rebuilt the standings from the fixture
  // day again; the production build re-produces the row \u2014
  // re-seed it, as the real build would stand it.
  O.state.extStanding = [{ block: 'Podcasts', slotId: 'bible-in-a-year', source: 'Bible in a Year' }];
  await enterTopEdit(w, 'standing');
  check('P5b re-entry into the standing form (the form stands again)', !!group());
  check('P6a \u25c6 after re-entry the removed podcast stands absent from the group (the removal persisted)', rows().length === 0, rows().length);
  O.state.extStanding = [{ block: 'Podcasts', slotId: 'bible-in-a-year', source: 'Bible in a Year' }];
  click(w, group().querySelector('[data-p604add="Podcasts"]'));
  await until(() => w.document.querySelector('.profaddladder603'));
  const doors2 = [...w.document.querySelectorAll('.profaddladder603 [data-p603door]')].map((e) => e.getAttribute('data-p603door'));
  check('P6 \u25c6 after re-entry the Podcasts Add ladder opens with its Sources door standing (the entry point for podcast adds)',
    doors2.includes('sources'), doors2);
  // NAMED GAP (build log): the ladder re-offer of a source
  // removed in an earlier session is not legged here \u2014 the
  // harness fixture's standings rebuilds (the synthetic day
  // carries no podcast episodes) make the offer state
  // unverifiable in this world. The add route itself is the
  // standing v603 ladder + v604 host, untouched by v609;
  // the remove route is legged above (P3/P6a). Field leg
  // for John: add a podcast through the ladder.
  w.close();
}

console.log('harness-v609:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
