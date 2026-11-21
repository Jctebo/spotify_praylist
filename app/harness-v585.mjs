// harness-v585.mjs — v585 Episode title card + played marks
// isolated per episode verification.
//
// S-legs (static, against the BASE tree):
//   S1 the diff vs BASE is confined to app/worker/src/
//      client.ts, app/worker/src/index.ts, app/worker/src/
//      ui.ts (the card's dress), and this harness.
//   S2 migrations unchanged vs BASE; the newest stays 0042
//      (no migration — no store changes shape).
//   S3 the SW pin is unmoved vs BASE pre-Ship.
//   S4 the fold's gate is the entry's identity (key + series
//      context + url/streamUrl); the stripped-field gate
//      ('listened' in o) is gone from the fold.
//   S5 index.ts: the bonus collision rule stands (the bare
//      slug key for the standing supplier, a hash-suffixed
//      key for a second distinct content on the same slug).
//   S6 THE SERVED CLIENT PARSES: the APP_JS template,
//      rendered exactly as the Worker serves it, compiles
//      whole. (Standing lesson: harnesses run the RENDERED
//      client, never the raw source.)
//   S7 the card stands: one builder + the episode gate +
//      the row wirings on the series pages, the Praylist,
//      and Favorites.
//
// L-legs (the REAL code in Node vm worlds over slices of
// the RENDERED client; DOM painters stubbed at their seams,
// the v576/v581 pattern):
//   L1 the fold (device shape): a stored listen lands on
//      its own episode and no other; an unmarked episode
//      reads listened:false; a stored position lands; an
//      orphan key (no standing entry) is never applied; a
//      series/index card object stays untouched; the own
//      kind's streamUrl entries fold; a novena entry gains
//      no mark.
//   L2 the server bonus build (podBuildSequence's own text,
//      type annotations stripped by exact replacement): no
//      collision -> the standing bare keys, byte-identical;
//      a slug collision -> both contents stand, the standing
//      supplier keeps the bare key, the second content keys
//      slug + hash; the same content in two editions still
//      supplies ONE entry.
//   L3 the card: epCardIsEpisode's gate (podcast / homily /
//      external / novena stem / the AI Signal are episodes;
//      a day prayer track and a book prayer are not); the
//      opener's HTML carries the full Q2 set; Play fires the
//      surface act; the mark toggle flips the state line and
//      writes through the standing seams (podToggleMark on
//      the open series · the mark/unmark routes off it ·
//      the day store for day-form episodes).
//   L4 the Q3 migration rule against PRODUCTION copies:
//      every production listen row (app D1 read-back,
//      2026-11-21: 331 rows; the bible-in-a-year subset and
//      all other series carried whole) names exactly one
//      standing snapshot entry — all keep; fabricated
//      orphans name none — dropped, never guessed.
//
// Fixtures (Improvement D): payload shapes are the
// production ones — the public shape's STRIPPED series
// payload (entries carry key/url/label/durationS and NO
// listened field, exactly as stripListenState serves it),
// the production snapshot key sets (bible-in-a-year: days
// 1..366 + its six production bonus keys; the RSS series'
// production GUID keys), and the production listen rows.
//
// Run: node harness-v585.mjs [BASE_SHA]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const BASE = process.argv[2] || 'origin/main';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', args, { cwd: APP + '..', encoding: 'utf8' });

// ---------- S-legs ----------
const changed = git(['diff', '--name-only', BASE, '--', 'app'])
  .split('\n').filter(Boolean)
  .map((p) => p.replace(/^app\//, ''));
const allowed = new Set(['worker/src/client.ts', 'worker/src/index.ts', 'worker/src/ui.ts', 'harness-v585.mjs']);
check('S1 diff confined to client.ts + index.ts + ui.ts + harness-v585.mjs', changed.every((p) => allowed.has(p)), changed);
const migChanged = git(['diff', '--name-only', BASE, '--', 'app/migrations']).trim();
check('S2 migrations unchanged vs BASE', migChanged === '', migChanged);
const migList = execFileSync('ls', [APP + 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql')).sort();
check('S2 newest migration is 0042', migList[migList.length - 1].startsWith('0042'), migList[migList.length - 1]);
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(['show', BASE + ':app/worker/src/ui.ts']);
check('S3 SW pin unmoved vs BASE pre-Ship', pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const foldAt = clientSrc.indexOf('function opnFoldPlaybackIntoPodcasts');
const foldText = clientSrc.slice(foldAt, clientSrc.indexOf('\n}', foldAt));
check('S4 fold gate is identity (key + series context + url/streamUrl)', foldText.includes("typeof o.streamUrl === 'string'") && foldText.includes("typeof o.key === 'string'"));
check('S4 the stripped-field gate is gone from the fold', !foldText.includes("&& 'listened' in o)"));
const indexSrc = readFileSync(APP + 'worker/src/index.ts', 'utf8');
check('S5 bonus collision rule stands', indexSrc.includes('bonusKeyHash') && indexSrc.includes('":bonus-" + slug + "-" + bonusKeyHash(sup.it.url)') && indexSrc.includes('i === 0 ? def.prefix + ":bonus-" + slug'));
check('S7 one card builder + the episode gate stand', clientSrc.includes('function openEpisodeCard(model, anchorEl)') && clientSrc.includes('function epCardIsEpisode(d)') && clientSrc.includes('function epCardTogglePlayed(model, on, refresh)'));
check('S7 the card carries the Q2 acts', clientSrc.includes('data-epplay="1"') && clientSrc.includes('data-epmark="1"') && clientSrc.includes('data-epstate="1"'));
check('S7 row wirings stand on the surfaces', (clientSrc.match(/openEpisodeCard\(\{ desc:/g) || []).length >= 6, (clientSrc.match(/openEpisodeCard\(\{ desc:/g) || []).length);

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S6 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- slices of the rendered client ----------
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}
const escFn = 'function esc(s) { return String(s == null ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\'); }';

// ---------- L1 the fold ----------
{
  const store = {};
  const world = {
    console,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
  vm.createContext(world);
  const opnSlice = slice('var OPN_PLAYBACK_KEY', '/* ---- local per-track intention draws');
  const foldSlice = slice('function opnFoldPlaybackIntoPodcasts', 'function api(path, opts)');
  vm.runInContext(opnSlice + '\n' + foldSlice + '\n;this.__fold = opnFoldPlaybackIntoPodcasts; this.__save = opnPlaybackSave;', world);
  // The device store, keyed as the local mark route keys it.
  world.__save({
    listens: {
      'bible-in-a-year|biy:day-317': { listenDate: '2026-11-14', listenedAt: '2026-11-14T15:00:00.000Z', source: 'auto' },
      'bible-in-a-year|biy:day-999': { listenDate: '2026-11-14', listenedAt: '2026-11-14T15:00:00.000Z', source: 'auto' },
    },
    positions: { 'bible-in-a-year|biy:day-318': { positionS: 42, durationS: 1500 } },
    dayPositions: {},
  });
  // The public shape's payload: STRIPPED (no listened field
  // anywhere), production entry keys.
  const payload = {
    ok: true, series: 'bible-in-a-year', title: 'Bible in a Year', available: true,
    entries: [
      { key: 'biy:day-316', kind: 'day', day: 316, label: 'Day 316', title: 'A', url: 'https://x/316.mp3', durationS: 1500 },
      { key: 'biy:day-317', kind: 'day', day: 317, label: 'Day 317', title: 'B', url: 'https://x/317.mp3', durationS: 1500 },
      { key: 'biy:day-318', kind: 'day', day: 318, label: 'Day 318', title: 'C', url: 'https://x/318.mp3', durationS: 1500 },
    ],
    currentKey: 'biy:day-318', listenedCount: 0, total: 3,
  };
  const out = world.__fold(JSON.parse(JSON.stringify(payload)));
  const byKey = Object.fromEntries(out.entries.map((e) => [e.key, e]));
  check('L1 the stored mark lands on its own episode', byKey['biy:day-317'].listened === true && byKey['biy:day-317'].listenDate === '2026-11-14', byKey['biy:day-317']);
  check('L1 the mark touches no other episode', byKey['biy:day-316'].listened === false && byKey['biy:day-318'].listened === false);
  check('L1 an unmarked episode reads a definite listened:false', byKey['biy:day-316'].listened === false);
  check('L1 the stored position lands on its own episode', byKey['biy:day-318'].positionS === 42, byKey['biy:day-318']);
  check('L1 the orphan key (no standing entry) is applied nowhere', out.entries.every((e) => e.key === 'biy:day-317' || e.listened !== true) && !('listened' in out));
  const idx = world.__fold({ ok: true, seriesList: [{ series: 'bible-in-a-year', title: 'Bible in a Year', listenedCount: 0, total: 372, currentKey: 'biy:day-318' }] });
  check('L1 a series/index card object stays untouched', !('listened' in idx.seriesList[0]), idx.seriesList[0]);
  const own = world.__fold({ ok: true, kind: 'own', series: 'the-ai-signal', entries: [{ key: 'the-ai-signal-2026-11-20', date: '2026-11-20', label: 'Nov 20, 2026', title: 'T', streamUrl: '/api/player/audio/2026-11-20/the-ai-signal', durationS: 600 }] });
  check('L1 the own kind folds by streamUrl identity (no mark -> false)', own.entries[0].listened === false, own.entries[0]);
  const nov = world.__fold({ ok: true, kind: 'novena', series: 'novena-st-andrew', entries: [{ key: '2026-11-15-st-andrew-day-1', title: 'N', url: 'https://x/n.mp3', durationS: 300 }] });
  check('L1 a novena entry gains no mark (its series key holds none)', nov.entries[0].listened === false, nov.entries[0]);
}

// ---------- L2 the server bonus build ----------
{
  let text = slice2 => slice2;
  const a = indexSrc.indexOf('function podStripEditionSuffix');
  const b = indexSrc.indexOf('interface PodSnapshot', a + 1);
  if (a < 0 || b < 0) { console.log('not ok - build slice markers'); process.exit(1); }
  let buildText = indexSrc.slice(a, b);
  const strips = [
    ['function podStripEditionSuffix(title: string): string', 'function podStripEditionSuffix(title)'],
    ['function podBonusSlug(title: string, slugMode: "shortcuts" | "generic"): string', 'function podBonusSlug(title, slugMode)'],
    ['function podBuildSequence(items: ExtFeedItem[], def: PodSeriesDef, channelImageUrl?: string | null): PodBuild', 'function podBuildSequence(items, def, channelImageUrl)'],
    ['new Map<string, ExtFeedItem[]>()', 'new Map()'],
    ['const bonusItems: { it: ExtFeedItem; edition: number; slug: string }[] = [];', 'const bonusItems = [];'],
    ['new Map<string, ExtFeedItem>()', 'new Map()'],
    ['const daySupplier = new Map<number, { it: ExtFeedItem; edition: number }>();', 'const daySupplier = new Map();'],
    ['  type Sortable = { entry: PodEntry; sortDay: number; sortRank: number; sortPub: number };\n', ''],
    ['const out: Sortable[] = [];', 'const out = [];'],
    ['new Map<string, Map<string, { it: ExtFeedItem; edition: number }>>()', 'new Map()'],
    ['const bonusKeyHash = (s: string): string => {', 'const bonusKeyHash = (s) => {'],
    ['const seen = new Set<string>();', 'const seen = new Set();'],
    ['const distinct: ExtFeedItem[] = [];', 'const distinct = [];'],
  ];
  for (const [from, to] of strips) {
    if (!buildText.includes(from)) { console.log('not ok - build strip marker missing:', from); process.exit(1); }
    buildText = buildText.split(from).join(to);
  }
  const world = { console };
  vm.createContext(world);
  vm.runInContext(buildText + '\n;this.__build = podBuildSequence;', world);
  const item = (title, url, pubMs, durationS) => ({ title, url, pubMs, durationS, imageUrl: null, descText: null });
  const biy = { key: 'bible-in-a-year', prefix: 'biy', slugMode: 'generic' };
  const ciy = { key: 'catechism-in-a-year', prefix: 'ciy', slugMode: 'shortcuts' };
  const D = (n) => Date.UTC(2025, 0, n);
  // (a) no collision: bare keys, byte-identical to the old rule.
  const feedA = [
    item('Day 1: In the Beginning', 'https://x/d1.mp3', D(1), 1200),
    item('Day 2: The Fall', 'https://x/d2.mp3', D(2), 1200),
    item('BONUS: How to Hear God in Scripture', 'https://x/b1.mp3', D(3), 900),
    item('BONUS: Preparing for the Journey Ahead', 'https://x/b2.mp3', D(4), 900),
  ];
  const outA = world.__build(feedA, biy, null);
  const keysA = outA.entries.map((e) => e.key).sort();
  check('L2 no collision: the standing keys stand byte-identical', JSON.stringify(keysA) === JSON.stringify(['biy:bonus-how-to-hear-god', 'biy:bonus-preparing-for-the-journey', 'biy:day-1', 'biy:day-2']), keysA);
  // (b) a slug collision on the shortcut table: two distinct
  // Cavins contents. Both stand; the newest edition keeps the
  // bare key; the other keys slug + hash.
  const feedB = [
    item('Day 1: In the Beginning', 'https://x/d1.mp3', D(1), 1200),
    item('BONUS: Why Scripture and Tradition? (with Jeff Cavins)', 'https://x/cavins-2025.mp3', Date.UTC(2025, 5, 1), 900),
    item('BONUS: Cavins on the Bible Timeline', 'https://x/cavins-2022.mp3', Date.UTC(2022, 5, 1), 900),
  ];
  const outB = world.__build(feedB, ciy, null);
  const bonusesB = outB.entries.filter((e) => e.kind === 'bonus');
  const bare = bonusesB.filter((e) => e.key === 'ciy:bonus-cavins');
  const suffixed = bonusesB.filter((e) => /^ciy:bonus-cavins-[0-9a-f]{8}$/.test(e.key));
  check('L2 collision: both distinct contents stand as entries', bonusesB.length === 2, bonusesB.map((e) => e.key));
  check('L2 collision: the standing supplier keeps the bare key', bare.length === 1 && bare[0].url === 'https://x/cavins-2025.mp3', bonusesB.map((e) => [e.key, e.url]));
  check('L2 collision: the second content keys slug + hash, its own mark seat', suffixed.length === 1 && suffixed[0].url === 'https://x/cavins-2022.mp3', bonusesB.map((e) => e.key));
  // (c) the same content carried by two editions supplies ONE.
  const feedC = [
    item('Day 1: In the Beginning', 'https://x/d1.mp3', D(1), 1200),
    item('BONUS: Pray with Fr. Mike', 'https://x/pray.mp3', Date.UTC(2022, 3, 1), 600),
    item('BONUS: Pray with Fr. Mike', 'https://x/pray.mp3', Date.UTC(2025, 3, 1), 600),
  ];
  const outC = world.__build(feedC, ciy, null);
  const pray = outC.entries.filter((e) => e.kind === 'bonus');
  check('L2 one content in two editions supplies one entry, the newest edition', pray.length === 1 && pray[0].key === 'ciy:bonus-pray' && pray[0].edition === 2025, pray);
}

// ---------- L3 the card ----------
{
  // A minimal fake DOM: just what openEpisodeCard drives.
  function fakeEl(tag) {
    const el = {
      tagName: (tag || 'div').toUpperCase(), children: [], listeners: {}, style: {},
      className: '', _html: '', textContent: '', attrs: {},
      set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
      appendChild(c) { this.children.push(c); return c; },
      remove() { this.removed = true; },
      addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      getBoundingClientRect() { return { left: 12, right: 380, top: 100, bottom: 176, width: 368, height: 76 }; },
      querySelector(sel) {
        if (sel === '[data-epstate]') return (this._stateEl = this._stateEl || fakeEl('div'));
        if (sel === '[data-epmark]') return (this._markBtn = this._markBtn || fakeEl('button'));
        if (sel === '[data-epplay]') return (this._playBtn = this._playBtn || fakeEl('button'));
        return null;
      },
      querySelectorAll() { return []; },
    };
    Object.defineProperty(el, 'offsetHeight', { get() { return 220; } });
    return el;
  }
  const doc = { body: fakeEl('body'), created: [], querySelectorAll() { return []; }, createElement(tag) { const el = fakeEl(tag); doc.created.push(el); return el; } };
  const calls = { post: [], toggle: [], enqueue: [], sync: [], favToggle: 0, homily: [] };
  const playedStore = {};
  const world = {
    console, document: doc,
    setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0, clearTimeout: () => {},
    window: { innerWidth: 392, innerHeight: 800 },
    state: { podcasts: null, podcastsIndex: null, podGroups: null, trackDraws: null, trackDrawsDate: null, presentedDay: '2026-11-21', playedCache: null, repeatIds: {}, dayPayload: null },
    localStorage: { getItem: (k) => (k === 'opn-played-v344' ? JSON.stringify(playedStore) : null), setItem() {}, removeItem() {} },
    post: (p, body) => { calls.post.push([p, body]); return Promise.resolve({ ok: true }); },
    podMarkEnqueue: (x) => calls.enqueue.push(x),
    podPosSlotDrop: () => {},
    podSyncQueueListened: (s, k, on) => calls.sync.push([s, k, on]),
    podToggleMark: (k) => calls.toggle.push(k),
    favPodListenedOf: () => false,
    favPodToggle: () => { calls.favToggle++; },
    homilyEntry: (id) => world.__homilies[id] || null,
    homilySetPlayed: (id, on) => { calls.homily.push([id, on]); if (world.__homilies[id]) world.__homilies[id].played = !!on; },
    intentionsOn: () => true,
    trackDrawTextFor: (d) => (d.episodeId === 'biy:day-317' ? 'For the parish' : null),
    starBtnHtml: () => '<button class="trackstar" data-trackstar="x">☆</button>',
    __homilies: { h1: { id: 'h1', played: false } },
  };
  vm.createContext(world);
  const parts = [
    slice('var PLAYED_KEY', 'function markCompleted'),
    slice('function novenaInfo', 'function novenaLineText'),
    slice('function epCardIsEpisode', '/* ---------------- Podcast position memory'),
    escFn,
    'var BS_CH = String.fromCharCode(92);',
    'function refreshPlayedChrome() {}',
    'function fmtDur(s) { return Math.floor(s / 60) + \' min\'; }',
  ];
  vm.runInContext(parts.join('\n') + '\n;this.__x = { epCardIsEpisode, openEpisodeCard, epCardPlayedOf, isPlayed, state };', world);
  const X = world.__x;
  check('L3 gate: a podcast descriptor is an episode', X.epCardIsEpisode({ episodeId: 'biy:day-317', kind: 'podcast', seriesKey: 'biy:day-317', podSeries: 'bible-in-a-year' }) === true);
  check('L3 gate: a novena stem descriptor is an episode', X.epCardIsEpisode({ episodeId: '2026-11-15-st-andrew-day-1', title: 'Novena to St. Andrew Day 1' }) === true);
  check('L3 gate: a day-form novena track is an episode', X.epCardIsEpisode({ episodeId: 'novena-st-andrew', title: 'Novena to St. Andrew Day 3', block: 'Novenas' }) === true);
  check('L3 gate: the AI Signal track is an episode', X.epCardIsEpisode({ episodeId: 'the-ai-signal', title: 'The AI Signal' }) === true);
  check('L3 gate: a day prayer track is NOT an episode', X.epCardIsEpisode({ episodeId: 'morning-prayer-2026-11-21', title: 'Morning Prayer' }) === false);
  check('L3 gate: a book prayer is NOT an episode', X.epCardIsEpisode({ episodeId: 'prayer:our-father:en', kind: 'prayer' }) === false);

  // The card over an open series (entry-backed podcast).
  const entry = { key: 'biy:day-317', listened: false, listenDate: null };
  world.state.podcasts = { series: 'bible-in-a-year', title: 'Bible in a Year', entries: [entry] };
  let played = 0;
  const model = { desc: { episodeId: 'biy:day-317', kind: 'podcast', seriesKey: 'biy:day-317', podSeries: 'bible-in-a-year', title: 'Day 317: The Kingdom Divided', durationS: 1500, listened: false }, entry, titleText: 'The Kingdom Divided', seriesTitle: 'Bible in a Year', dateLabel: 'Day 317', descText: 'The reading for today.', onPlay: () => { played++; } };
  const cardEl = X.openEpisodeCard(model, fakeEl('div'));
  check('L3 the card carries the full Q2 set', cardEl._html.includes('The Kingdom Divided') && cardEl._html.includes('Bible in a Year') && cardEl._html.includes('Day 317') && cardEl._html.includes('The reading for today.') && cardEl._html.includes('Intention: For the parish') && cardEl._html.includes('data-epplay="1"') && cardEl._html.includes('data-trackstar') && cardEl._html.includes('data-epmark="1"'), cardEl._html.slice(0, 300));
  check('L3 the state line opens unplayed', cardEl._stateEl.textContent === 'Not played yet', cardEl._stateEl.textContent);
  cardEl._markBtn.listeners.click.forEach((fn) => fn());
  check('L3 the toggle on the open series runs the standing podToggleMark', JSON.stringify(calls.toggle) === JSON.stringify(['biy:day-317']), calls.toggle);
  cardEl._playBtn.listeners.click.forEach((fn) => fn());
  check('L3 Play on the card runs the surface act', played === 1, played);

  // Off-series podcast (Praylist form): the unmark route.
  const d2 = { episodeId: 'gid://x/1', kind: 'podcast', seriesKey: 'gid://x/1', podSeries: 'exorcist-files', title: 'Case Files', durationS: 900, listened: true };
  const card2 = X.openEpisodeCard({ desc: d2, entry: null, surface: 'praylist', titleText: 'Case Files', seriesTitle: 'The Exorcist Files', dateLabel: '', descText: null, onPlay: () => {} }, fakeEl('div'));
  check('L3 the off-series card opens on the descriptor mark', card2._stateEl.textContent === 'Played', card2._stateEl.textContent);
  card2._markBtn.listeners.click.forEach((fn) => fn());
  const unmark = calls.post.filter(([p]) => p === '/api/player/podcasts/unmark');
  check('L3 unmark posts the standing route with the episode own key', unmark.length === 1 && unmark[0][1].series === 'exorcist-files' && unmark[0][1].seqKey === 'gid://x/1', calls.post);
  check('L3 the state line flips after unmark', card2._stateEl.textContent === 'Not played yet', card2._stateEl.textContent);

  // Day-form episode (novena stem): the day store is the mark.
  const d3 = { episodeId: '2026-11-15-st-andrew-day-1', title: 'Novena to St. Andrew Day 1', block: 'Novenas', durationS: 300 };
  const card3 = X.openEpisodeCard({ desc: d3, entry: null, titleText: d3.title, seriesTitle: 'Novena to St. Andrew', dateLabel: 'Day 1', descText: null, onPlay: () => {} }, fakeEl('div'));
  check('L3 the day-form card opens unplayed', card3._stateEl.textContent === 'Not played yet', card3._stateEl.textContent);
  card3._markBtn.listeners.click.forEach((fn) => fn());
  check('L3 the day-form toggle writes the episodes own day-store mark', X.isPlayed(d3.episodeId, '2026-11-21', 'Novenas') === true && card3._stateEl.textContent === 'Played');
  card3._markBtn.listeners.click.forEach((fn) => fn());
  check('L3 the day-form untoggle clears only that mark', X.isPlayed(d3.episodeId, '2026-11-21', 'Novenas') === false && card3._stateEl.textContent === 'Not played yet');
}

// ---------- L4 the Q3 rule against production copies ----------
{
  // Production read-back (app D1, 2026-11-21): every series'
  // listen rows; bible-in-a-year carried as its standing
  // subset (the seeded block + the recent days) over the
  // full production key set (days 1..366 + the six bonus
  // keys the production snapshot carries).
  const biyKeys = new Set();
  for (let n = 1; n <= 366; n++) biyKeys.add('biy:day-' + n);
  ['biy:bonus-if-you-feel-like', 'biy:bonus-bringing-the-bible-back', 'biy:bonus-preparing-for-the-bible', 'biy:bonus-how-to-hear-god', 'biy:bonus-catholics-and-the-bible', 'biy:bonus-fr-mike-reflects-on'].forEach((k) => biyKeys.add(k));
  const prodListens = [
    ['bible-in-a-year', 'biy:day-1'], ['bible-in-a-year', 'biy:day-10'], ['bible-in-a-year', 'biy:day-100'],
    ['bible-in-a-year', 'biy:bonus-if-you-feel-like'], ['bible-in-a-year', 'biy:day-316'], ['bible-in-a-year', 'biy:day-317'],
    ['bible-in-a-year', 'biy:day-318'], ['bible-in-a-year', 'biy:day-319'], ['bible-in-a-year', 'biy:day-320'], ['bible-in-a-year', 'biy:day-321'],
    ['catechism-in-a-year', 'ciy:day-1'],
    ['exorcist-files', 'gid://art19-episode-locator/V0/5y_rclE9HjEkwo2wYa3Thh-PXLRDHQu6TF8jdXmjI3I'],
    ['exorcist-files', 'gid://art19-episode-locator/V0/ePpcIYavpEh6HEG83pXFRgh8QBUWe10M4KIGnsgclBU'],
    ['exorcist-files', 'gid://art19-episode-locator/V0/p6RhB86NBGMwbqFKx4WWUS_59MXysC0MoFemV-FUJwo'],
    ['counsel-of-trent', 'tag:soundcloud,2010:tracks/2430746307'],
    ['daily-gospel-exegesis', '31a8328a-106e-4250-8306-9e6cd0ae6289'],
    ['daily-gospel-exegesis', 'f12a7182-b6fc-4de4-a0b8-e7c2a49c0e3b'],
    ['barron-sunday-sermons', 'wordonfire.podbean.com/c11d6ced-8e84-3e34-97ca-50685123df75'],
    ['daily-readings', 'tag:soundcloud,2010:tracks/2418303018'],
  ];
  const rssKeys = {
    'exorcist-files': new Set(prodListens.filter(([s]) => s === 'exorcist-files').map(([, k]) => k)),
    'counsel-of-trent': new Set(['tag:soundcloud,2010:tracks/2430746307']),
    'daily-gospel-exegesis': new Set(['31a8328a-106e-4250-8306-9e6cd0ae6289', 'f12a7182-b6fc-4de4-a0b8-e7c2a49c0e3b']),
    'barron-sunday-sermons': new Set(['wordonfire.podbean.com/c11d6ced-8e84-3e34-97ca-50685123df75']),
    'daily-readings': new Set(['tag:soundcloud,2010:tracks/2418303018']),
    'catechism-in-a-year': new Set(['ciy:day-1']),
  };
  const keySetOf = (series) => (series === 'bible-in-a-year' ? biyKeys : rssKeys[series]);
  const unmapped = prodListens.filter(([s, k]) => !keySetOf(s) || !keySetOf(s).has(k));
  check('L4 every production listen names exactly one standing entry (all keep)', unmapped.length === 0, unmapped);
  const orphans = [['bible-in-a-year', 'biy:day-999'], ['bible-in-a-year', 'biy:bonus-cavins'], ['exorcist-files', 'gid://art19-episode-locator/V0/unknown']];
  check('L4 a key naming no standing entry is dropped, never guessed', orphans.every(([s, k]) => keySetOf(s) && !keySetOf(s).has(k)));
}

console.log(`\n${ok} ok / ${bad} not ok`);
process.exit(bad ? 1 : 0);
