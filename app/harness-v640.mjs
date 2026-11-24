// harness-v640.mjs — v640: share a track directly from
//  the player, with John's amendment governing — the link
//  in every share is ALWAYS the Ora Pro Nobis app link
//  (https://app.orapronobis.media), never an external
//  episode link, never a Spotify link. One new builder
//  (shareAppUrlFor) composes only the constant app host +
//  the descriptor's identity parameters, classifying per
//  family (prayer → homily standalone → podcast → day →
//  bare app link). Every track-share caller routes
//  through it: shareTrackSheet (day-row menu ·
//  [data-rowshare] · the Favorites mirror · the new
//  player seats), openPodRowMenu's inline call, and
//  openFavRowMenu's podcast-mirror call. The block page's
//  playlist Share + its Open in Spotify item stand
//  untouched (named exceptions). Seats: #np-share at the
//  end of .np-transport (np-tbtn dress, glyph ⤴,
//  aria-label "Share") firing shareTrackSheet(
//  state.current), and Share FIRST in openPlayerMenu.
//  Landing: shareLandingRead() at boot (strict validation
//  · replaceState strips the query) + shareLandingConsume
//  through the standing machinery — never autoplay;
//  unknown/stale → the plain app, no error.
//
// Legs:
//  L1 ◆ paint on all families: for each family standing
//     in the player, Now Playing paints #np-share in the
//     transport row (np-tbtn dress) and openPlayerMenu
//     carries Share first.
//  L2 ◆ payload = title + app link: firing the share for
//     each family captures the navigator.share payload
//     and the copy string — url begins
//     https://app.orapronobis.media/ and carries the
//     family's identity parameters per the §3 table
//     (pod · day + office-hour date/slot · repeated id
//     &b=&o= · prayer · homily standalone vs in-day ·
//     own-series · bare fallback); no spotify URL, no
//     provider/enclosure/stream URL, and no
//     location.origin-built link appears in any payload.
//  L3 ◆ landing: a known identity lands on the track
//     (day → block view + row/card presented; pod → the
//     series entry's card; prayer → the Book page; homily
//     → the entry presented; NO autoplay in any leg); an
//     unknown identity lands on the plain app with no
//     error and the query stripped; a malformed query is
//     refused at the read and stripped.
//  L4 ◆ sheet + copy fallback both stand: with
//     navigator.share present the sheet carries Share… +
//     Copy link and the share fires the payload; with it
//     absent the sheet carries Copy link alone, the copy
//     writes the app link, and the note reads
//     'Link copied.'.
//  L5 ◆ no personal data: every captured payload (share
//     + copy, all families) carries only title, the
//     standing line, and the app link — no intention
//     text, no draw, no position, no played state.
//  ◆ legs fail on the base client (4cad413): run this
//  harness in a detached worktree of that tree and every
//  ◆ leg fails there (recorded in docs/releases/v640.md
//  §4 by the Implement seat).
//
// Fixtures (Improvement D — production sources, named):
//  - ~/workspace/projects/ora-pro-nobis/john-personal-
//    data-import-v589.json — John's own exported
//    document, seeded as the personal-data store (the
//    harness-v639 recipe; podcastListens deleted).
//  - tests/fixtures-v597/production-day-2026-11-21.json
//    + production-source-settings.json — the production
//    day payload and his production source settings,
//    building the standing world (the harness-v639
//    buildStanding / paintRealDay recipe).
//  - tests/fixtures-v620/frmike-payload-live.json — the
//    LIVE served payload for series fr-mike-homilies
//    (fetched from app.orapronobis.media 2026-11-22);
//    entries[0] IS the podcast descriptor's identity
//    (episodeId = seriesKey = its key, podSeries =
//    'fr-mike-homilies', url = its Fireside enclosure).
//  - tests/fixtures-v603/book.json · novenas.json ·
//    podcasts-index.json — the fetch-stub bodies (the
//    harness-v639 recipe); book groups[0] carries the
//    'our-father' prayer the landing leg opens.
//  - The homily seed follows the v551 homily index store
//    shape. General worlds carry the plain entry (id +
//    title + played, the harness-v639 shape); the homily
//    landing world alone carries a full take (name +
//    state 'ready' + dateKey + durationS — the shape
//    homilyListEntries lists) AND pre-seeds the take's
//    minted URL cache entry, because jsdom has no
//    IndexedDB for homilyMint to mint the take blob from
//    (the cache entry is the mint's production product;
//    without it homilySettle re-mints forever).
//  - Synthetic day descriptors follow harness-v639's
//    synthTrack shape over that production world.
//
// Run: node app/harness-v640.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500)); }
}
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- T statics ----------
check('T1 the ONE app-link builder stands and every track-share caller routes through it (shareTrackSheet · openPodRowMenu · openFavRowMenu podcast mirror); no caller keeps an inline external url',
  clientSrc.includes('function shareAppUrlFor(')
  && grab(clientSrc, 'shareTrackSheet').includes('url: shareAppUrlFor(t)')
  && !grab(clientSrc, 'shareTrackSheet').includes('shareUrlFor(t)')
  && grab(clientSrc, 'openPodRowMenu').includes('shareAppUrlFor(')
  && !grab(clientSrc, 'openPodRowMenu').includes('e.url || location.origin')
  && grab(clientSrc, 'openFavRowMenu').includes('url: shareAppUrlFor(desc)'));
check('T2 the builder composes only the constant app host + identity params — its body names no spotify, no stream/enclosure/url field, no location.origin, and never calls shareUrlFor/spotifyUrlFor',
  (() => { const b = grab(clientSrc, 'shareAppUrlFor'); return !!b && b.includes("'https://app.orapronobis.media'") === false && b.includes('SHARE_APP_BASE640') && !/spotify|streamUrl|enclosureUrl|location\.origin|shareUrlFor|spotifyUrlFor/.test(b); })());
check('T3 the named exceptions stand untouched: the block page\'s playlist Share keeps its spotifyUrl url and its Open in Spotify item is the one remaining such push',
  clientSrc.includes("url: b.spotifyUrl || location.origin + '/'")
  && (clientSrc.match(/label: 'Open in Spotify'/g) || []).length === 1);
check('T4 seats: #np-share stands in openNowPlaying\'s transport row with the np-tbtn dress and fires shareTrackSheet(state.current); Share stands FIRST in openPlayerMenu',
  grab(clientSrc, 'openNowPlaying').includes('id="np-share"')
  && grab(clientSrc, 'openNowPlaying').includes('class="np-tbtn" id="np-share"')
  && grab(clientSrc, 'openNowPlaying').includes('shareTrackSheet(state.current)')
  && grab(clientSrc, 'openPlayerMenu').indexOf("label: 'Share'") > -1
  && grab(clientSrc, 'openPlayerMenu').indexOf("label: 'Share'") < grab(clientSrc, 'openPlayerMenu').indexOf("label: 'Autoplay'"));
check('T5 landing read at boot: shareLandingRead() stands before setTab(bootTab) in the tail, shareLandingConsume() after it, and the read strips the query by replaceState',
  clientSrc.indexOf('shareLandingRead();') > -1
  && clientSrc.indexOf('shareLandingRead();') < clientSrc.lastIndexOf('setTab(bootTab);')
  && clientSrc.indexOf('shareLandingConsume();') > clientSrc.lastIndexOf('setTab(bootTab);')
  && grab(clientSrc, 'shareLandingRead').includes('history.replaceState'));

function renderJs(src) {
  const a = src.indexOf('= `') + 3;
  const b = src.indexOf('\n`;', a);
  return vm.runInContext('`' + src.slice(a, b) + '`', vm.createContext({}));
}
const appJs = renderJs(clientSrc);
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('T0 served client (rendered APP_JS) parses whole', parses, perr);
}
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const shellStart = uiSrc.indexOf('<!DOCTYPE html>');
const SHELL = vm.runInContext('`' + uiSrc.slice(shellStart, uiSrc.indexOf('`;', shellStart)) + '`', vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import('jsdom')); ({ webcrypto } = await import('node:crypto')); }
catch (e) {
  try { ({ JSDOM } = await import(process.env.HOME + '/workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')); ({ webcrypto } = await import('node:crypto')); }
  catch (e2) { check('R0 jsdom available', false, e2.message); console.log('harness-v640:', ok, 'ok /', bad, 'not ok'); process.exit(1); }
}
const BOOK = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/book.json', 'utf8'));
const NOVENAS = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/novenas.json', 'utf8'));
const PODIDX = JSON.parse(readFileSync(APP + 'tests/fixtures-v603/podcasts-index.json', 'utf8'));
const FRMIKE = JSON.parse(readFileSync(APP + 'tests/fixtures-v620/frmike-payload-live.json', 'utf8'));
const SETTINGS597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-source-settings.json', 'utf8'));
const DAY597 = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const DATA_KEY = 'opn-personal-data-v1';
const DATE = '2026-11-21';
const FM = FRMIKE.entries[0];
const HOOK = '\n;window.__opn = { state, opnFoldDay590, extRebuildDescs, paintPrayersView, resolveReadingsSeat590, resolveProfileCourses590, openNowPlaying, openPlayerMenu, openPodRowMenu, openFavRowMenu, epCardIsEpisode, bookFind, homilyEntry, homilyUrlCache: (typeof homilyUrlCache !== "undefined" ? homilyUrlCache : null), EXT_SLOTS, OWN_ROW_EPISODE, extDayRulePasses, extWeekdayMon0, shareAppUrlFor: (typeof shareAppUrlFor !== "undefined" ? shareAppUrlFor : null), shareTrackSheet: (typeof shareTrackSheet !== "undefined" ? shareTrackSheet : null), shareLandingRead: (typeof shareLandingRead !== "undefined" ? shareLandingRead : null), shareLandingConsume: (typeof shareLandingConsume !== "undefined" ? shareLandingConsume : null), shareLandingGet: function () { return (typeof shareLanding !== "undefined" ? shareLanding : undefined); }, shareLandingSet: function (v) { try { shareLanding = v; } catch (e) {} } };';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes('/api/prayer/book')) body = BOOK;
  else if (u.includes('/api/player/podcasts?series=novenas')) body = NOVENAS;
  else if (u.includes('/api/player/podcasts?series=fr-mike-homilies')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v620/frmike-payload-live.json', 'utf8'));
  else if (u.includes('/api/player/podcasts?series=')) { const sk = decodeURIComponent(u.split('series=')[1].split('&')[0] || 'x'); body = { entries: [{ key: sk + ':ep-1', label: 'Day 1', title: 'First', url: 'https://example.invalid/e.mp3', listened: false }], currentKey: sk + ':ep-1' }; }
  else if (u.includes('/api/player/podcasts')) body = PODIDX;
  else if (u.includes('/api/player/day')) body = JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8'));
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}
function makeWorld(store, url) {
  const html = SHELL.replace('<!--OPN_SHAPE-->', 'public');
  const dom = new JSDOM(html, { url: url || 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(null) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement('script');
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(extra) {
  return Object.assign({
    [DATA_KEY]: JSON.stringify(JOHN),
    'opn-praylistmode-v604': 'expanded',
    'opn-homilies-v551': JSON.stringify([{ id: 'v640-hom-1', title: 'Recorded homily', played: false }]),
  }, extra || {});
}
function buildStanding(w) {
  const O = w.__opn;
  const wd = O.extWeekdayMon0(DATE);
  const prim = {};
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'external' && s.slotId && s.role !== 'fallback') prim[s.slotId] = s; });
  const standing = [];
  O.EXT_SLOTS.forEach((s) => {
    const row = prim[s.slotId];
    if (!row || row.enabled !== 1 || !O.extDayRulePasses(row.dayRule || 'daily', wd)) return;
    standing.push({ slotId: s.slotId, title: s.title, block: row.block || 'Morning', sortOrder: row.sortOrder, source: s.source || 'Divine Office' });
  });
  O.state.extStanding = standing;
  const own = [];
  (SETTINGS597.sources || []).forEach((s) => { if (s.family === 'own' && O.OWN_ROW_EPISODE[s.sourceKey]) own.push({ sourceKey: s.sourceKey, episodeId: O.OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled }); });
  O.state.ownStanding = own.filter((r) => r.enabled === 1 && r.block).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0));
  O.state.ownSlots = {};
  O.state.ownStanding.forEach((r) => { O.state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.sourceKey, title: r.title || r.sourceKey, state: 'present', streamUrl: 'https://example.invalid/o.mp3', durationS: 30 }] }; });
  O.state.extSlots = {};
  standing.forEach((s) => { O.state.extSlots[s.slotId] = { state: 'present', title: s.title, source: s.source, streamUrl: 'https://example.invalid/e.mp3', durationSec: 30 }; });
}
async function paintRealDay(w) {
  const O = w.__opn;
  buildStanding(w);
  const day = O.opnFoldDay590(JSON.parse(JSON.stringify(DAY597)));
  O.state.dayPayload = day;
  if (typeof O.resolveReadingsSeat590 === 'function') { O.resolveReadingsSeat590(day); await sleep(350); }
  if (typeof O.resolveProfileCourses590 === 'function') { O.resolveProfileCourses590(day); await sleep(450); }
  const descs = O.extRebuildDescs(day) || [];
  O.paintPrayersView(day);
  await sleep(200);
  return { day, descs };
}
async function paintSynthetic(w, descs) {
  const O = w.__opn;
  await paintRealDay(w);
  O.state.dayDescs = descs;
  O.state.presentedDay = DATE;
  O.paintPrayersView(O.state.dayPayload);
  await sleep(120);
}
function synthTrack(over) {
  return Object.assign({ episodeId: 'synth-1', title: 'Synth track', block: 'Morning', available: true, streamUrl: 'https://example.invalid/s.mp3', durationS: 30 }, over || {});
}
function podDesc640() {
  // The composed-descriptor shape over the LIVE Fr. Mike
  // payload entry (fixtures named in the head).
  return synthTrack({ episodeId: FM.key, kind: 'podcast', podSeries: 'fr-mike-homilies', seriesKey: FM.key, listened: false, title: FM.title, url: FM.url, streamUrl: FM.url });
}
function menuLabels(w) { return [...w.document.querySelectorAll('.anchmenu [data-menuitem]')].map((b) => b.textContent.trim()); }
function stubShare(w, captured) {
  try { Object.defineProperty(w.navigator, 'share', { value: (p) => { captured.push(p); return Promise.resolve(); }, configurable: true }); } catch (e) { w.navigator.share = (p) => { captured.push(p); return Promise.resolve(); }; }
}
function stubClipboard(w, copied) {
  try { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: (s) => { copied.push(s); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
}
async function fireShare(w, t, captured, copied) {
  const O = w.__opn;
  if (!O.shareTrackSheet) return null;
  O.shareTrackSheet(t);
  await sleep(60);
  const d = w.document;
  const sheet = d.querySelector('.sharesheet');
  const go = sheet && sheet.querySelector('[data-sharego]');
  if (go) { go.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(40); }
  return sheet;
}
async function fireCopy(w, t, copied) {
  const O = w.__opn;
  if (!O.shareTrackSheet) return null;
  O.shareTrackSheet(t);
  await sleep(60);
  const d = w.document;
  const sheet = d.querySelector('.sharesheet');
  const cp = sheet && sheet.querySelector('[data-sharecopy]');
  if (cp) { cp.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(60); }
  return sheet;
}
const NO_EXTERNAL = (s) => !/spotify|fireside|example\.invalid|blob:/i.test(String(s || ''));

// ---------- L1 ◆ paint on all families + L2 ◆ payloads ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const captured = [], copied = [];
  stubShare(w, captured); stubClipboard(w, copied);
  const pod = podDesc640();
  const ownDay = synthTrack({ episodeId: 'v640-own-1', title: 'Ora Own Episode', durationS: 60, spotifyUrl: 'https://open.spotify.com/episode/v640own', streamUrl: 'https://example.invalid/own.mp3' });
  const office = synthTrack({ episodeId: 'ext-morning-prayer', kind: 'external', title: 'Morning Prayer - Divine Office', source: 'Divine Office', durationS: 1800, streamUrl: 'https://example.invalid/do.mp3' });
  const prayer = synthTrack({ episodeId: 'prayer:morning-offering:en', title: 'Morning Offering', durationS: 45 });
  const homDay = synthTrack({ episodeId: 'homily:v640-hom-1', kind: 'homily', homilyId: 'v640-hom-1', title: 'Recorded Homily In Day', durationS: 90 });
  await paintSynthetic(w, [ownDay, office, prayer, homDay]);

  // L1: the player paints #np-share for each family, and
  // the player menu carries Share first.
  const families = [['podcast episode', pod], ['Ora own day episode', ownDay], ['Divine Office hour', office], ['prayer with audio', prayer], ['recorded homily', homDay]];
  for (const [name, t] of families) {
    O.state.current = t;
    O.openNowPlaying();
    await sleep(60);
    const btn = d.querySelector('#np-share');
    check(`L1 ◆ ${name}: Now Playing paints #np-share at the end of .np-transport with the np-tbtn dress and aria-label Share`,
      !!btn && btn.classList.contains('np-tbtn') && btn.getAttribute('aria-label') === 'Share'
      && !!btn.closest('.np-transport') && btn === btn.closest('.np-transport').lastElementChild,
      { found: !!btn });
    const np = d.querySelector('.np-sheet'); if (np) np.remove();
  }
  O.state.current = ownDay;
  O.openNowPlaying();
  await sleep(60);
  const anchor = d.querySelector('#np-menu') || d.body;
  O.openPlayerMenu(anchor);
  await sleep(80);
  const plabels = menuLabels(w);
  check('L1 ◆ openPlayerMenu carries Share FIRST (before Autoplay)', plabels[0] === 'Share' && plabels.length > 1 && plabels[1].indexOf('Autoplay') === 0, { plabels });

  // The #np-share button itself fires the share for the
  // standing track.
  captured.length = 0;
  const shareBtn = d.querySelector('#np-share');
  if (shareBtn) shareBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(60);
  check('L1 ◆ tapping #np-share opens the share sheet for state.current',
    !!d.querySelector('.sharesheet'), {});

  // L2: per-family payloads through shareTrackSheet.
  const cases = [
    ['podcast episode', pod, `https://app.orapronobis.media/?s=pod&series=fr-mike-homilies&id=${FM.key}`, null],
    ['Ora own day episode (Spotify + stream standing on the descriptor)', ownDay, `https://app.orapronobis.media/?s=day&date=${DATE}&id=v640-own-1`, 'Nov 21'],
    ['Divine Office hour (date + slotId together)', office, `https://app.orapronobis.media/?s=day&date=${DATE}&id=ext-morning-prayer`, 'Divine Office'],
    ['prayer with audio (self-describing id, no date)', prayer, 'https://app.orapronobis.media/?s=prayer&id=prayer:morning-offering:en', null],
    ['recorded homily standing in the day (day form)', homDay, `https://app.orapronobis.media/?s=day&date=${DATE}&id=homily:v640-hom-1`, 'Nov 21'],
  ];
  for (const [name, t, wantUrl, textPart] of cases) {
    captured.length = 0; copied.length = 0;
    await fireShare(w, t, captured, copied);
    const p = captured[0];
    check(`L2 ◆ ${name}: share payload url is the app link with the family's identity params, text names the title${textPart ? ' + ' + textPart : ''}, and no external/Spotify URL appears`,
      !!p && p.url === wantUrl && p.title === (t.title || '') && p.text.indexOf(t.title) === 0
      && (!textPart || p.text.includes(textPart))
      && NO_EXTERNAL(p.url) && NO_EXTERNAL(p.text),
      { p });
    const sheet = await fireCopy(w, t, copied);
    check(`L2 ◆ ${name}: the copy path writes exactly the same app link`,
      copied[0] === wantUrl && NO_EXTERNAL(copied[0]), { copied });
    if (sheet) sheet.remove();
  }
  w.close();
}

// ---------- L2 (continued) ◆ repeated id · homily standalone · own-series · bare fallback ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn;
  const captured = [], copied = [];
  stubShare(w, captured); stubClipboard(w, copied);
  const copy0 = synthTrack({ episodeId: 'ext-morning-prayer', kind: 'external', title: 'Morning Prayer - Divine Office', source: 'Divine Office' });
  const copy1 = synthTrack({ episodeId: 'ext-morning-prayer', kind: 'external', title: 'Morning Prayer - Divine Office', source: 'Divine Office', block: 'Evening', _occ: 1 });
  await paintSynthetic(w, [copy0, copy1]);
  captured.length = 0;
  await fireShare(w, copy1, captured, copied);
  check('L2 ◆ a repeated day id carries &b=<block>&o=<occ> so the receiver lands on the right copy',
    !!captured[0] && captured[0].url === `https://app.orapronobis.media/?s=day&date=${DATE}&id=ext-morning-prayer&b=Evening&o=1`,
    { p: captured[0] });

  const homSolo = synthTrack({ episodeId: 'homily:v640-hom-1', kind: 'homily', homilyId: 'v640-hom-1', title: 'Standalone Homily' });
  O.state.dayDescs = [];
  captured.length = 0;
  await fireShare(w, homSolo, captured, copied);
  check('L2 ◆ a standalone recorded homily shares the homily form (?s=homily&id=<homilyId>)',
    !!captured[0] && captured[0].url === 'https://app.orapronobis.media/?s=homily&id=v640-hom-1', { p: captured[0] });

  O.state.podcasts = { series: 'the-ai-signal', title: 'The AI Signal', entries: [] };
  const ownSeries = { episodeId: 'ai-signal-ep-9', title: 'AI Signal Ep 9', durationS: 30, streamUrl: 'https://example.invalid/ai.mp3' };
  captured.length = 0;
  await fireShare(w, ownSeries, captured, copied);
  check('L2 ◆ an own-feed episode on its series page shares the pod form with the open series',
    !!captured[0] && captured[0].url === 'https://app.orapronobis.media/?s=pod&series=the-ai-signal&id=ai-signal-ep-9', { p: captured[0] });
  O.state.podcasts = null;

  const bare = { title: 'Unclassifiable', durationS: 10 };
  captured.length = 0;
  await fireShare(w, bare, captured, copied);
  check('L2 ◆ an unclassifiable descriptor shares the BARE app link only',
    !!captured[0] && captured[0].url === 'https://app.orapronobis.media/', { p: captured[0] });

  // The row-menu seats route through the builder too:
  // openPodRowMenu on the LIVE Fr. Mike series.
  O.state.podcasts = JSON.parse(JSON.stringify(FRMIKE));
  const anchor = w.document.createElement('button');
  w.document.body.appendChild(anchor);
  O.openPodRowMenu(FM.key, anchor);
  await sleep(80);
  const labels = menuLabels(w);
  const shareItem = [...w.document.querySelectorAll('.anchmenu [data-menuitem]')].find((x) => x.textContent.trim() === 'Share');
  if (shareItem) shareItem.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(60);
  captured.length = 0;
  const podSheetGo = w.document.querySelector('.sharesheet [data-sharego]');
  if (podSheetGo) podSheetGo.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(40);
  check('L2 ◆ openPodRowMenu\'s Share fires the app-link pod payload (never the Fireside enclosure)',
    labels.includes('Share') && !!captured[0] && captured[0].url === `https://app.orapronobis.media/?s=pod&series=fr-mike-homilies&id=${FM.key}` && NO_EXTERNAL(captured[0].url),
    { labels, p: captured[0] });
  w.close();
}

// ---------- L3 ◆ landing ----------
{
  // Day landing on a real folded descriptor.
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const { descs } = await paintRealDay(w);
  const target = descs.filter((x) => x.episodeId && (x.block || x._block))[0];
  O.shareLandingSet({ s: 'day', date: DATE, id: target.episodeId, b: target.block || target._block, o: target._occ || 0 });
  if (O.shareLandingConsume) O.shareLandingConsume();
  await sleep(4000); // the tab switch's day build + external settle lands the landing (the consume poll attempts it as the descriptors settle)
  check('L3 ◆ a day share link lands on the track: the block view stands, its row is landed or its episode card stands presented, and NOTHING autoplays (state.current stands null)',
    !!target && O.state.prayersView && O.state.prayersView.kind === 'block'
    && (!!d.querySelector('[data-card="' + target.episodeId + '"].landed') || !!d.querySelector('.epcard'))
    && O.state.current === null,
    { target: target && target.episodeId, view: O.state.prayersView });
  w.close();
}
{
  // Pod landing.
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  O.shareLandingSet({ s: 'pod', series: 'fr-mike-homilies', id: FM.key });
  if (O.shareLandingConsume) O.shareLandingConsume();
  await sleep(900);
  check('L3 ◆ a pod share link lands on the series entry: its episode card stands presented (or its row is landed), and NOTHING autoplays',
    (!!d.querySelector('.epcard') || !!d.querySelector('[data-podrow="' + FM.key + '"].landed')) && O.state.current === null,
    { epcard: !!d.querySelector('.epcard') });
  w.close();
}
{
  // Prayer landing.
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  O.shareLandingSet({ s: 'prayer', id: 'prayer:our-father:en' });
  if (O.shareLandingConsume) O.shareLandingConsume();
  await sleep(1500);
  const bp = d.querySelector('#book-page');
  check('L3 ◆ a prayer share link lands on the Book page for that prayer, and NOTHING autoplays',
    !!bp && bp.textContent.includes('Our Father') && O.state.current === null,
    { bp: !!bp });
  w.close();
}
{
  // Homily landing (the full take seed + its minted URL
  // cache entry — see the fixture note in the head).
  const w = makeWorld(johnStore({ 'opn-homilies-v551': JSON.stringify([{ id: 'v640-hom-1', name: 'Recorded homily', state: 'ready', played: false, dateKey: '2026-11-15', dayName: 'Sunday', durationS: 600, createdAt: '2026-11-15T12:00:00.000Z' }]) }));
  await sleep(400);
  const O = w.__opn, d = w.document;
  if (O.homilyUrlCache) O.homilyUrlCache['v640-hom-1'] = { blob: null, url: 'blob:v640-hom-1' };
  O.shareLandingSet({ s: 'homily', id: 'v640-hom-1' });
  if (O.shareLandingConsume) O.shareLandingConsume();
  await sleep(300);
  check('L3 ◆ a homily share link lands on the Homilies surface with that entry presented (landed), and NOTHING autoplays',
    !!d.querySelector('[data-homilymenu="v640-hom-1"]') && O.state.current === null,
    { found: !!d.querySelector('[data-homilymenu="v640-hom-1"]') });
  w.close();
}
{
  // Unknown identity + malformed query.
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  await paintSynthetic(w, [synthTrack({ episodeId: 'v640-known-1', title: 'Known' })]);
  O.shareLandingSet({ s: 'day', date: DATE, id: 'no-such-id-640' });
  if (O.shareLandingConsume) O.shareLandingConsume();
  await sleep(4200); // the consume poll's bound discards the stale identity
  check('L3 ◆ an unknown day identity is discarded: the landing clears, the plain app stands (home view, no episode card, no share sheet, no error), NOTHING autoplays',
    O.shareLandingGet() === null && O.state.prayersView && O.state.prayersView.kind === 'home'
    && !d.querySelector('.epcard') && !d.querySelector('.sharesheet') && O.state.current === null,
    { view: O.state.prayersView, landing: O.shareLandingGet() });
  w.close();

  const w2 = makeWorld(johnStore(), 'https://app.orapronobis.media/?s=day&date=21-11-2026&id=x');
  await sleep(400);
  check('L3 ◆ a malformed share query is refused at the boot read (no landing stashed) and the query is stripped from the URL',
    w2.__opn.shareLandingGet() == null && w2.location.search === '',
    { landing: w2.__opn.shareLandingGet(), search: w2.location.search });
  w2.close();

  const w3 = makeWorld(johnStore(), 'https://app.orapronobis.media/?s=prayer&id=prayer:our-father:en');
  await sleep(400);
  check('L3 ◆ a valid share query is stripped from the URL at the boot read (replaceState)',
    w3.location.search === '', { search: w3.location.search });
  w3.close();
}

// ---------- L4 ◆ sheet + copy fallback · L5 ◆ no personal data ----------
{
  const w = makeWorld(johnStore());
  await sleep(400);
  const O = w.__opn, d = w.document;
  const copied = [];
  stubClipboard(w, copied);
  const t = synthTrack({ episodeId: 'v640-l4-1', title: 'Fallback Track', durationS: 30, intentionText: 'SECRET-INTENTION-640', trackDraw: 'SECRET-DRAW-640', positionS: 4242, played: true });
  await paintSynthetic(w, [t]);

  // No navigator.share in this world (jsdom default):
  // Copy link alone stands.
  if (O.shareTrackSheet) O.shareTrackSheet(t);
  await sleep(60);
  let sheet = d.querySelector('.sharesheet');
  check('L4 ◆ with no navigator.share the sheet carries Copy link ALONE (no Share… row)',
    !!sheet && !!sheet.querySelector('[data-sharecopy]') && !sheet.querySelector('[data-sharego]'),
    {});
  copied.length = 0;
  if (sheet) { sheet.querySelector('[data-sharecopy]').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(60); }
  const note = sheet && sheet.querySelector('[data-shareline]');
  check('L4 ◆ the copy writes the app link and the note reads \'Link copied.\'',
    copied[0] === `https://app.orapronobis.media/?s=day&date=${DATE}&id=v640-l4-1` && !!note && note.textContent === 'Link copied.',
    { copied, note: note && note.textContent });
  if (sheet) sheet.remove();

  // With navigator.share: both rows stand and the share
  // fires the payload.
  const captured = [];
  stubShare(w, captured);
  if (O.shareTrackSheet) O.shareTrackSheet(t);
  await sleep(60);
  sheet = d.querySelector('.sharesheet');
  check('L4 ◆ with navigator.share the sheet carries Share… + Copy link',
    !!sheet && !!sheet.querySelector('[data-sharego]') && !!sheet.querySelector('[data-sharecopy]'), {});
  if (sheet && sheet.querySelector('[data-sharego]')) { sheet.querySelector('[data-sharego]').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(40); }
  const p = captured[0];
  check('L5 ◆ the payload carries ONLY title, text (title + standing line) and the app-link url — no intention text, no draw, no position, no played state',
    !!p && Object.keys(p).sort().join(',') === 'text,title,url'
    && p.text === p.title + ' \u2014 Nov 21 \u00b7 Episode \u00b7 0:30'
    && !/SECRET|4242|intention/i.test(JSON.stringify(p)),
    { p });
  check('L5 ◆ the copy string is the app link only (no personal data rides it)',
    copied.length >= 1 && copied.every((s) => s.indexOf('https://app.orapronobis.media/') === 0 && !/SECRET|4242/.test(s)),
    { copied });
  w.close();
}

// ---------- L6 ◆ FIX pass: wrong-copy + partial-consumption legs ----------
// Every leg in this section must FAIL on the pre-fix tree
// (231e4ee) and pass on the fixed tree.
{
  const copies640 = () => [
    synthTrack({ episodeId: 'ext-morning-prayer', kind: 'external', title: 'Morning Prayer - Divine Office', source: 'Divine Office', block: 'Morning', _occ: 0 }),
    synthTrack({ episodeId: 'ext-morning-prayer', kind: 'external', title: 'Morning Prayer - Divine Office', source: 'Divine Office', block: 'Evening', _occ: 1 }),
  ];
  async function landingAttempt(landing) {
    const w = makeWorld(johnStore());
    await sleep(400);
    const O = w.__opn, d = w.document;
    await paintSynthetic(w, copies640());
    O.state.tab = 'prayers'; // land directly on the synthetic copies (a tab switch would rebuild the day from the payload and lose them)
    O.shareLandingSet(landing);
    if (O.shareLandingConsume) O.shareLandingConsume();
    await sleep(1600);
    return { w, O, d };
  }
  {
    const { w, O, d } = await landingAttempt({ s: 'day', date: DATE, id: 'ext-morning-prayer', o: 5 });
    check('L6 ◆ wrong-occurrence landing (o=5, beyond the copies) presents NOTHING: landing discarded, plain app (home view, no episode card), no autoplay',
      O.shareLandingGet() === null && O.state.prayersView && O.state.prayersView.kind === 'home'
      && !d.querySelector('.epcard') && O.state.current === null,
      { view: O.state.prayersView, landing: O.shareLandingGet() });
    w.close();
  }
  {
    const { w, O, d } = await landingAttempt({ s: 'day', date: DATE, id: 'ext-morning-prayer', b: 'Evening', o: 0 });
    check('L6 ◆ mismatched b+o pair (b=Evening&o=0; copies are Morning/occ0 + Evening/occ1) presents NOTHING: no single descriptor matches both, landing discarded to the plain app',
      O.shareLandingGet() === null && O.state.prayersView && O.state.prayersView.kind === 'home'
      && !d.querySelector('.epcard') && O.state.current === null,
      { view: O.state.prayersView, landing: O.shareLandingGet() });
    w.close();
  }
  {
    const { w, O, d } = await landingAttempt({ s: 'day', date: DATE, id: 'ext-morning-prayer', b: 'Evening', o: 1 });
    check('L6 ◆ correct b+o pair (b=Evening&o=1) still lands on the EXACT copy: Evening block view stands, its row is landed or its card presented, no autoplay (regression control)',
      O.state.prayersView && O.state.prayersView.kind === 'block' && O.state.prayersView.block === 'Evening'
      && (!!d.querySelector('[data-card="ext-morning-prayer"].landed') || !!d.querySelector('.epcard'))
      && O.state.current === null,
      { view: O.state.prayersView });
    w.close();
  }
  // Read-refusal legs: boot worlds carrying the bad query.
  const refuseCases = [
    ['malformed b (charset violation)', 'https://app.orapronobis.media/?s=day&date=' + DATE + '&id=ext-morning-prayer&b=Bad!Block&o=0'],
    ['malformed o (not digits)', 'https://app.orapronobis.media/?s=day&date=' + DATE + '&id=ext-morning-prayer&o=1x'],
    ['oversized id (200 chars, cap 128)', 'https://app.orapronobis.media/?s=day&date=' + DATE + '&id=' + 'a'.repeat(200)],
    ['impossible date (2026-13-45)', 'https://app.orapronobis.media/?s=day&date=2026-13-45&id=ext-morning-prayer'],
  ];
  for (const [name, url] of refuseCases) {
    const w = makeWorld(johnStore(), url);
    // Checked IMMEDIATELY (no sleep): the boot read is
    // synchronous, and a landing wrongly stashed on id
    // alone would be consumed/cleared by the boot poll
    // within a few hundred ms, masking the partial
    // consumption this leg proves.
    check(`L6 ◆ ${name}: the WHOLE landing is refused at the read (no landing stashed on id alone) and the query is stripped`,
      w.__opn.shareLandingGet() == null && w.location.search === '',
      { landing: w.__opn.shareLandingGet(), search: w.location.search });
    w.close();
  }
}

console.log('\nharness-v640:', ok, 'ok /', bad, 'not ok');
process.exit(bad ? 1 : 0);
