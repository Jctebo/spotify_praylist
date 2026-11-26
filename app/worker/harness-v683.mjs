// harness-v683.mjs — v683: a resolved DAILY dynamic row
// paints at the END of its block instead of at its
// contents position (John, field report 2026-11-26 00:43 CT).
//
// SKELETON (Plan §2.4): legs 1–2 only — leg 1 is the
// standing-contents control (passes on the unmodified
// tree); leg 2 is the defect leg (a partial today-layer
// entry) and MUST FAIL on the unmodified tree. The full
// leg set (Plan §2.4 legs 3–5) lands at Implement.
// Modeled on harness-v666.mjs (the device-mode world: the
// rendered client from source driven in jsdom over John's
// profile document, production fixtures).
//
// Fixture (Improvement D — production shapes, sources named):
//  - John's real Morning contents (Edit form, Thu 2026-11-26,
//    as reported): source ext-invitatory · daily
//    saint-of-the-day · source morning-prayer (own, "Morning
//    Offering (Extended)") · seat daily-readings · source
//    ext-morning-prayer (side sth, the v670 standing form) ·
//    source daily-rosary (own) · source marian-antiphon (own).
//    Contents item shapes are the stored shapes the v666
//    harness and opnStandingContents597 carry; the seed
//    standings/sortOrders are OPN_SEED_SOURCES (client.ts).
//  - Saint payload: v666-fixtures/production-heads.json
//    `saint` capture (feeds.buzzsprout.com/2216056.rss heads,
//    captured 2026-11-25), served in the server's payload
//    shape as in harness-v666. The fixture day is 2026-11-25
//    (the capture's day; the defect is order, not date).
//  - Readings seat: the production readingsSeat shape
//    (readingsSeatDesc549's input), the November 25, 2026
//    entry from the same capture's `readings` heads.
//
// Run: node app/worker/harness-v683.mjs
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
let JSDOM, webcrypto;
try { ({ JSDOM } = await import("jsdom")); ({ webcrypto } = await import("node:crypto")); }
catch (e) { ({ JSDOM } = await import(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js"))); ({ webcrypto } = await import("node:crypto")); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADS = JSON.parse(readFileSync(path.join(HERE, "v666-fixtures", "production-heads.json"), "utf8"));
const BOOK = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "book.json"), "utf8"));
const JOHN_FULL = JSON.parse(readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json"), "utf8"));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = "opn-personal-data-v1";

function audioPayload(series, title, entries) {
  return { ok: true, kind: "rss", series, title, available: true, showImageUrl: null, entries: entries.map((e) => ({ key: e.key, title: e.title, publishedMs: e.publishedMs, url: e.url, durationS: 600, listened: !!e.listened, positionS: 0 })) };
}
let SAINT = audioPayload("saint-of-the-day", "The Saint of The Day Podcast", HEADS.saint);
let READINGS = audioPayload("daily-readings", "USCCB Daily Readings Podcast", HEADS.readings);
let EXEG = audioPayload("daily-gospel-exegesis", "Daily Gospel Exegesis", HEADS.exegesis);
const BIBLE = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "bible-folded.json"), "utf8"));
let BIAY = JSON.parse(JSON.stringify(BIBLE));
let CS = { ok: true, kind: "video", series: "catholicsaints", title: "Catholic Saints & Feasts", available: true, marks: true, videos: HEADS.catholicsaints.map((v) => ({ id: v.id, title: v.title, publishedMs: v.publishedMs, url: "https://www.youtube.com/watch?v=" + v.id, imageUrl: null, descText: null, dateLabel: "", listened: false })) };

const clientSrc = readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
const uiSrc = readFileSync(path.join(APP, "worker", "src", "ui.ts"), "utf8");
function renderJs(src) { const a = src.indexOf("= `") + 3; const b = src.indexOf("\n`;", a); return vm.runInContext("`" + src.slice(a, b) + "`", vm.createContext({})); }
const appJs = renderJs(clientSrc);
const shellStart = uiSrc.indexOf("<!DOCTYPE html>");
const SHELL = vm.runInContext("`" + uiSrc.slice(shellStart, uiSrc.indexOf("`;", shellStart)) + "`", vm.createContext({}));

const HOOK = "\n;window.__opn = { state, opnLocalApi, opnFoldDay590, extRebuildDescs, resolveDailyDynamic666, resolveProfileEpisodes614, buildDayFromPayload };";
const SETTINGS = { ok: true, version: 1, sources: [
  { family: "external", slotId: "ext-invitatory", block: "Morning", sortOrder: 1, enabled: 1, dayRule: "daily", role: "primary" },
  { family: "external", slotId: "ext-morning-prayer", block: "Morning", sortOrder: 3, enabled: 1, dayRule: "daily", role: "primary" },
  { family: "own", sourceKey: "morning-prayer", block: "Morning", sortOrder: 2, enabled: 1, dayRule: "daily", role: "primary" },
  { family: "own", sourceKey: "daily-rosary", block: "Morning", sortOrder: 4, enabled: 1, dayRule: "daily", role: "primary" },
  { family: "own", sourceKey: "marian-antiphon", block: "Morning", sortOrder: 6, enabled: 1, dayRule: "daily", role: "primary" },
] };
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes("/api/player/source-settings")) body = SETTINGS;
  else if (u.includes("/api/prayer/book")) body = BOOK;
  else if (u.includes("/api/player/podcasts?series=saint-of-the-day")) body = SAINT;
  else if (u.includes("/api/player/podcasts?series=daily-readings")) body = READINGS;
  else if (u.includes("/api/player/podcasts?series=daily-gospel-exegesis")) body = EXEG;
  else if (u.includes("/api/player/podcasts?series=bible-in-a-year")) body = BIAY;
  else if (u.includes("/api/player/podcasts?series=catholicsaints")) body = CS;
  else if (u.includes("/api/player/podcasts?series=")) { const sk = decodeURIComponent(u.split("series=")[1].split("&")[0] || "x"); body = { series: sk, kind: "rss", entries: [], currentKey: null }; }
  else if (u.includes("/api/player/podcasts")) body = { seriesList: [] };
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve("") });
}
function makeWorld(store) {
  const html = SHELL.replace("<!--OPN_SHAPE-->", "public");
  const dom = new JSDOM(html, { url: "https://app.orapronobis.media/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, "standalone", { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, "crypto", { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStub;
  try { w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; w.HTMLMediaElement.prototype.pause = function () {}; } catch (e) {}
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(undefined), keys: () => Promise.resolve([]) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement("script");
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(mut) {
  const doc = JSON.parse(JSON.stringify(JOHN));
  if (mut) mut(doc);
  const st = {}; st[DATA_KEY] = JSON.stringify(doc);
  return st;
}
function setSalMorning(doc, items) {
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === "salesian");
  sal.contents = Object.assign({}, sal.contents || {}, { Morning: items });
}
function syntheticDay(date) {
  const blocks = ["Morning", "Midday", "Evening", "Night"].map((bl) => ({ block: bl, label: bl, caption: "", spotifyUrl: null, tracks: [], trackCount: 0 }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: null, readingsSeat: null, episodes: [] };
}

// John's real Morning contents (see header). The standings
// and slot states below are the production seed shapes
// (OPN_SEED_SOURCES sortOrders; extSlotTrack / ownSlotTrack
// state shapes) standing PRESENT, as they stand on John's
// phone after the externals/own resolves settle.
const JOHN_MORNING = [
  { kind: "source", key: "ext-invitatory" },
  { kind: "daily", key: "saint-of-the-day" },
  { kind: "source", key: "morning-prayer" },
  { kind: "seat", key: "daily-readings" },
  { kind: "source", key: "ext-morning-prayer", side: "sth" },
  { kind: "source", key: "daily-rosary" },
  { kind: "source", key: "marian-antiphon" },
];
function seedStandings(O) {
  O.state.extStanding = [
    { slotId: "ext-invitatory", title: "Invitatory", block: "Morning", sortOrder: 1, source: "Divine Office" },
    { slotId: "ext-morning-prayer", title: "Morning Prayer", block: "Morning", sortOrder: 3, source: "Divine Office" },
  ];
  O.state.ownStanding = [
    { sourceKey: "morning-prayer", episodeId: "morning-prayer", block: "Morning", sortOrder: 2, title: "Morning Offering (Extended)", enabled: 1 },
    { sourceKey: "daily-rosary", episodeId: "daily-rosary", block: "Morning", sortOrder: 4, title: "Daily Rosary", enabled: 1 },
    { sourceKey: "marian-antiphon", episodeId: "marian-antiphon-angelus", block: "Morning", sortOrder: 6, title: "Marian Antiphon — Angelus", enabled: 1 },
  ];
  O.state.extSlots = {
    "ext-invitatory": { state: "present", title: "Invitatory", source: "Divine Office", streamUrl: "https://example.invalid/inv.mp3", enclosureUrl: "https://example.invalid/inv.mp3", durationSec: 300, sizeBytes: 1000, imageUrl: null },
    "ext-morning-prayer": { state: "present", title: "Morning Prayer", source: "Sing the Hours", streamUrl: "https://example.invalid/mp.mp3", enclosureUrl: "https://example.invalid/mp.mp3", durationSec: 900, sizeBytes: 3000, imageUrl: null },
  };
  O.state.ownSlots = {
    "morning-prayer": { state: "present", tracks: [{ episodeId: "morning-prayer", title: "Morning Offering (Extended)", state: "present", enclosureUrl: "https://example.invalid/mo.mp3", durationS: 600, sizeBytes: 2000, imageUrl: null }] },
    "daily-rosary": { state: "present", tracks: [{ episodeId: "daily-rosary", title: "Daily Rosary", state: "present", enclosureUrl: "https://example.invalid/ros.mp3", durationS: 1200, sizeBytes: 4000, imageUrl: null }] },
    "marian-antiphon": { state: "present", tracks: [{ episodeId: "marian-antiphon-angelus", title: "Marian Antiphon — Angelus", state: "present", enclosureUrl: "https://example.invalid/ant.mp3", durationS: 120, sizeBytes: 500, imageUrl: null }] },
  };
}

// ---------- Leg 1: composed order == contents order ----------
{
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, JOHN_MORNING)));
  await sleep(300);
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay("2026-11-25"));
  O.state.dayPayload = day;
  seedStandings(O);
  // The readings seat stands resolved (the production shape
  // resolveReadingsSeat590 writes onto the day).
  const rHit = HEADS.readings.find((e) => e.title === "Daily Mass Reading Podcast for November 25, 2026");
  day.readingsSeat = { series: "daily-readings", seqKey: rHit.key, title: rHit.title, url: rHit.url, durationS: 600, imageUrl: null, listened: false, positionS: null };
  console.log("DIAG folded Morning contents:", JSON.stringify(((day.profile || {}).contents || {}).Morning));
  O.resolveDailyDynamic666(day);
  await sleep(500);
  console.log("DIAG dailyRes666 keys:", JSON.stringify(Object.keys(O.state.dailyRes666 || {})));
  const descs = O.extRebuildDescs(day) || [];
  const morning = descs.filter((d) => d.block === "Morning");
  console.log("DIAG Morning composed order:", JSON.stringify(morning.map((d) => d.episodeId + (d.daily666 ? " [daily]" : ""))));
  const ids = morning.map((d) => d.episodeId);
  const saintId = HEADS.saint[0].key;
  check("L1 the Saint daily row stands SECOND in Morning (its contents position, after the Invitatory)", ids[1] === saintId, { ids, saintId });
  check("L1 Morning order is exactly: invitatory · saint daily · morning offering · morning prayer · readings seat (the v660 splice, immediately before the rosary) · rosary · antiphon",
    JSON.stringify(ids) === JSON.stringify(["ext-invitatory", saintId, "morning-prayer", "ext-morning-prayer", rHit.key, "daily-rosary", "marian-antiphon-angelus"]), ids);
  w.close();
}

// ---------- Leg 1b: the FULL build (buildDayFromPayload,
// every resolver + the settings leg racing as in production) ----------
{
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, JOHN_MORNING)));
  await sleep(300);
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay("2026-11-25"));
  O.buildDayFromPayload(day, null);
  await sleep(2500);
  const descs = O.state.dayDescs || [];
  const morning = descs.filter((d) => d.block === "Morning");
  console.log("DIAG full-build Morning dayDescs order:", JSON.stringify(morning.map((d) => d.episodeId + (d.daily666 ? " [daily]" : ""))));
  console.log("DIAG full-build composed642 == dayDescs:", O.state.composed642 === O.state.dayDescs, " guard:", O.state.rebuildGuard642, " pending:", O.state.dayPending642);
  const ids = morning.map((d) => d.episodeId);
  check("L1b full build: the Saint daily row stands SECOND in Morning", ids[1] === HEADS.saint[0].key, ids);
  w.close();
}

// ---------- Leg 2 (THE DEFECT LEG): a PARTIAL today-layer
// entry for the presented date (a hand-shaped Edit-today
// entry carrying only the daily item) under the standing
// fixture. Must FAIL on the unmodified tree: the v601
// restore in opnApplyTodayLayer594 prepends the standing
// source/seat items ahead of the entry's items, so the
// daily row paints at the block tail. ----------
{
  const w = makeWorld(johnStore((doc) => {
    setSalMorning(doc, JOHN_MORNING);
    doc.sections.profiles.todayEdits = { "2026-11-25": { baseProfileKey: "salesian", contents: { Morning: [{ kind: "daily", key: "saint-of-the-day" }] } } };
  }));
  await sleep(300);
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay("2026-11-25"));
  O.state.dayPayload = day;
  seedStandings(O);
  const rHit = HEADS.readings.find((e) => e.title === "Daily Mass Reading Podcast for November 25, 2026");
  day.readingsSeat = { series: "daily-readings", seqKey: rHit.key, title: rHit.title, url: rHit.url, durationS: 600, imageUrl: null, listened: false, positionS: null };
  console.log("DIAG today-layer folded Morning contents:", JSON.stringify(((day.profile || {}).contents || {}).Morning));
  O.resolveDailyDynamic666(day);
  await sleep(500);
  const descs = O.extRebuildDescs(day) || [];
  const morning = descs.filter((d) => d.block === "Morning");
  console.log("DIAG today-layer Morning composed order:", JSON.stringify(morning.map((d) => d.episodeId + (d.daily666 ? " [daily]" : ""))));
  const ids = morning.map((d) => d.episodeId);
  check("L2 today-layer fixture: the Saint daily row stands SECOND (its standing contents position)", ids[1] === HEADS.saint[0].key, ids);
  check("L2 today-layer fixture: Morning order is exactly the standing order (invitatory · saint daily · morning offering · morning prayer · readings seat · rosary · antiphon), no duplication, no drop",
    JSON.stringify(ids) === JSON.stringify(["ext-invitatory", HEADS.saint[0].key, "morning-prayer", "ext-morning-prayer", rHit.key, "daily-rosary", "marian-antiphon-angelus"]), ids);
  w.close();
}

// ---------- Legs 3–5 (Implement, Plan §2.2) ----------
const itemIds = (list) => (list || []).map((it) => it.kind + ":" + (it.key || ""));
function setSalBlock(doc, block, items) {
  const sal = (doc.sections.profiles.list || []).find((p) => p.key === "salesian");
  sal.contents = Object.assign({}, sal.contents || {}, { [block]: items });
}
function todayMorning(doc, items) {
  doc.sections.profiles.todayEdits = { "2026-11-25": { baseProfileKey: "salesian", contents: { Morning: items } } };
}
async function foldAndCompose(w, seedFn) {
  await sleep(300);
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay("2026-11-25"));
  O.state.dayPayload = day;
  seedStandings(O);
  if (seedFn) seedFn(O);
  O.resolveDailyDynamic666(day);
  if (O.resolveProfileEpisodes614) O.resolveProfileEpisodes614(day);
  await sleep(500);
  const descs = O.extRebuildDescs(day) || [];
  return { O, day, descs, folded: ((day.profile || {}).contents || {}).Morning || [], foldedBlock: (b) => ((day.profile || {}).contents || {})[b] || [] };
}
function todayBlock(doc, block, items) {
  doc.sections.profiles.todayEdits = { "2026-11-25": { baseProfileKey: "salesian", contents: { [block]: items } } };
}

// ---------- Leg 3: each of the five daily series at a
// mid-block seat, partial-entry shape ----------
{
  const readingsKey = HEADS.readings.find((e) => e.title === "Daily Mass Reading Podcast for November 25, 2026").key;
  const EXPECT = {
    "saint-of-the-day": HEADS.saint[0].key,
    "daily-gospel-exegesis": "14dc54f2-736a-45d9-92cb-624b935fbf8d",
    "bible-in-a-year": "biy:day-329",
    "catholicsaints": "yt:v9MO_5NAZWQ",
  };
  for (const series of Object.keys(EXPECT)) {
    // Standing: John's Morning with the daily item at
    // index 1 (mid-block).
    const standing = JOHN_MORNING.map((it) => (it.kind === "daily" ? { kind: "daily", key: series } : it));
    const w = makeWorld(johnStore((doc) => { setSalBlock(doc, "Morning", standing); todayMorning(doc, [{ kind: "daily", key: series }]); }));
    const { descs, folded } = await foldAndCompose(w);
    check("L3 " + series + ": folded contents == standing contents exactly (partial entry, mid-block seat)",
      JSON.stringify(itemIds(folded)) === JSON.stringify(itemIds(standing)), itemIds(folded));
    const morning = descs.filter((d) => d.block === "Morning");
    const ids = morning.map((d) => d.episodeId);
    check("L3 " + series + ": resolved row stands SECOND in the composed Morning (its standing index), exactly once",
      ids[1] === EXPECT[series] && ids.filter((x) => x === EXPECT[series]).length === 1, ids);
    w.close();
  }
  // daily-readings stands in Evening, as in harness-v666:
  // in Morning the readings seat stands in the same block
  // and the v666 §2.7 suppression (resolveDailyDynamic666)
  // resolves no daily-readings row beside its seat.
  {
    const standingE = [{ kind: "source", key: "ext-invitatory" }, { kind: "daily", key: "daily-readings" }, { kind: "source", key: "morning-prayer" }];
    const w = makeWorld(johnStore((doc) => { setSalBlock(doc, "Evening", standingE); todayBlock(doc, "Evening", [{ kind: "daily", key: "daily-readings" }]); }));
    const r = await foldAndCompose(w, (O) => {
      O.state.extStanding.forEach((s) => { s.block = "Evening"; });
      O.state.ownStanding.forEach((s) => { s.block = "Evening"; });
    });
    check("L3 daily-readings: folded Evening contents == standing contents exactly (partial entry, mid-block seat)",
      JSON.stringify(itemIds(r.foldedBlock("Evening"))) === JSON.stringify(itemIds(standingE)), itemIds(r.foldedBlock("Evening")));
    const eIds = r.descs.filter((d) => d.block === "Evening").map((d) => d.episodeId);
    check("L3 daily-readings: resolved row stands SECOND in the composed Evening (its standing index), exactly once",
      eIds[1] === readingsKey && eIds.filter((x) => x === readingsKey).length === 1, eIds);
    w.close();
  }
}

// ---------- Leg 4: daily item FIRST / LAST / today-only add ----------
{
  // (a) daily stands FIRST
  const standingA = [{ kind: "daily", key: "saint-of-the-day" }, { kind: "source", key: "ext-invitatory" }, { kind: "source", key: "morning-prayer" }];
  const w = makeWorld(johnStore((doc) => { setSalBlock(doc, "Morning", standingA); todayMorning(doc, [{ kind: "daily", key: "saint-of-the-day" }]); }));
  const a = await foldAndCompose(w);
  const aIds = a.descs.filter((d) => d.block === "Morning").map((d) => d.episodeId);
  // Folded expectation carries one extra tail item: the
  // readings seat, appended to Morning by the standing
  // profile migration (opnMigrateProfileRecord609) because
  // the fixture profile's Podcasts layer carries
  // daily-readings — pre-existing fold behavior, upstream
  // of the today layer; the merge seats it at its standing
  // (last) index.
  check("L4a daily FIRST: folded contents == standing contents + the migration's readings seat at the tail", JSON.stringify(itemIds(a.folded)) === JSON.stringify(itemIds(standingA).concat(["seat:daily-readings"])), itemIds(a.folded));
  check("L4a daily FIRST: composed row stands first, exactly once, no drop", aIds[0] === HEADS.saint[0].key && aIds.length === 3 && aIds.filter((x) => x === HEADS.saint[0].key).length === 1, aIds);
  w.close();
}
{
  // (b) daily stands LAST
  const standingB = [{ kind: "source", key: "ext-invitatory" }, { kind: "source", key: "morning-prayer" }, { kind: "daily", key: "saint-of-the-day" }];
  const w = makeWorld(johnStore((doc) => { setSalBlock(doc, "Morning", standingB); todayMorning(doc, [{ kind: "daily", key: "saint-of-the-day" }]); }));
  const b = await foldAndCompose(w);
  const bIds = b.descs.filter((d) => d.block === "Morning").map((d) => d.episodeId);
  check("L4b daily LAST: folded contents == standing contents + the migration's readings seat at the tail (the merge invents no move)", JSON.stringify(itemIds(b.folded)) === JSON.stringify(itemIds(standingB).concat(["seat:daily-readings"])), itemIds(b.folded));
  check("L4b daily LAST: composed row stands last, exactly once, no drop", bIds[bIds.length - 1] === HEADS.saint[0].key && bIds.length === 3 && bIds.filter((x) => x === HEADS.saint[0].key).length === 1, bIds);
  w.close();
}
{
  // (c) a today-only entry item (an episode pin with no
  // standing index) amid the restored sources: it keeps
  // its entry-relative seat — anchored after the Saint
  // daily item that precedes it in the entry; restored
  // items never cross it from behind; nothing drops.
  const epItem = { kind: "episode", key: "daily-gospel-exegesis|" + HEADS.exegesis[3].key };
  const w = makeWorld(johnStore((doc) => { setSalMorning(doc, JOHN_MORNING); todayMorning(doc, [{ kind: "daily", key: "saint-of-the-day" }, epItem]); }));
  const c = await foldAndCompose(w);
  check("L4c today-only episode pin: folded order is invitatory · saint daily · episode pin · morning offering · readings seat · morning prayer · rosary · antiphon (pin anchored after the daily item, restored sources behind it stay behind)",
    JSON.stringify(itemIds(c.folded)) === JSON.stringify(["source:ext-invitatory", "daily:saint-of-the-day", itemIds([epItem])[0], "source:morning-prayer", "seat:daily-readings", "source:ext-morning-prayer", "source:daily-rosary", "source:marian-antiphon"]), itemIds(c.folded));
  check("L4c today-only episode pin: no duplication, no drop (8 items)", c.folded.length === 8 && new Set(itemIds(c.folded)).size === 8, itemIds(c.folded));
  w.close();
}

// ---------- Leg 5: regressions (verbatim path + v666 key legs) ----------
{
  // Verbatim path: an entry naming a source applies
  // verbatim — no restore, no merge (deliberate gating).
  const w = makeWorld(johnStore((doc) => { setSalMorning(doc, JOHN_MORNING); todayMorning(doc, [{ kind: "source", key: "daily-rosary" }]); }));
  await sleep(300);
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay("2026-11-25"));
  const folded = ((day.profile || {}).contents || {}).Morning || [];
  check("L5 verbatim: a today entry naming a source applies byte-verbatim (no restore, no merge)",
    JSON.stringify(folded) === JSON.stringify([{ kind: "source", key: "daily-rosary" }]), folded);
  w.close();
}
{
  // v666 L4/L9 drawn: saint resolution + placement among
  // fixed-episode siblings (standing contents, no today entry).
  const items = [
    { kind: "episode", key: "daily-gospel-exegesis|" + HEADS.exegesis[2].key },
    { kind: "daily", key: "saint-of-the-day" },
    { kind: "episode", key: "daily-gospel-exegesis|" + HEADS.exegesis[3].key },
  ];
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, items)));
  const { descs } = await foldAndCompose(w);
  const ids = descs.map((d) => d.episodeId);
  const saint = descs.find((d) => d.daily666);
  check("L5 (v666 L4) saint resolves the 11/25 episode, not stale", !!saint && saint.episodeId === HEADS.saint[0].key && saint.stale === false, saint && [saint.episodeId, saint.stale]);
  check("L5 (v666 L9) the daily descriptor stands at its contents position among siblings", ids.indexOf(HEADS.exegesis[2].key) >= 0 && ids.indexOf(HEADS.saint[0].key) > ids.indexOf(HEADS.exegesis[2].key) && ids.indexOf(HEADS.exegesis[3].key) > ids.indexOf(HEADS.saint[0].key), ids);
  w.close();
}
{
  // v666 L5 drawn: the NOT-UPDATED fallback stands.
  const saveSaint = SAINT; SAINT = audioPayload("saint-of-the-day", "The Saint of The Day Podcast", HEADS.saint.slice(1));
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: "daily", key: "saint-of-the-day" }])));
  const { descs } = await foldAndCompose(w);
  const st = descs.find((d) => d.daily666);
  check("L5 (v666 L5) saint payload without the 11/25 entry: descriptor is the 11/24 entry, stale:true", !!st && st.episodeId === HEADS.saint[1].key && st.stale === true, st && [st.episodeId, st.stale]);
  SAINT = saveSaint;
  w.close();
}

console.log(`\nharness-v683: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
