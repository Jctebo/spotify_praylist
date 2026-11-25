// harness-v666.mjs — v666: the Add ladder by source + the
// daily dynamic contents kind.
//
// Modeled on harness-v614.mjs / harness-v663.mjs (the
// device-mode world: the rendered client from source driven
// in jsdom over John's profile document, production
// fixtures; the server validator extracted standalone, the
// v603 recipe).
//
// Fixtures (Improvement D — production sources, named):
//  - v666-fixtures/production-heads.json — captured live
//    2026-11-25 ~17:50Z from the REAL feeds (Plan §2.4):
//    saint heads from the v665 capture of
//    feeds.buzzsprout.com/2216056.rss (head "11/25 - St.
//    Catherine of Alexandria") · exegesis heads from
//    anchor.fm/s/1025ef1c/podcast/rss (the 2026-11-24
//    17:00Z release is the fixture day's D-1 episode) ·
//    readings titles from the USCCB SoundCloud feed (the
//    November 25, 2026 title stands verbatim) · BIAY heads
//    from feeds.fireside.fm/bibleinayear/rss ("Day 329: The
//    Ethiopian Eunuch (2026)", published 2026-11-25) · the
//    catholicsaints 15-entry window from the v663 capture
//    of the channel Atom feed (head "November 25: St.
//    Catherine of Alexandria, Virgin & Martyr").
//  - app/tests/fixtures-v603/bible-folded.json — the REAL
//    folded BIAY sequence payload (entries keyed biy:day-N
//    carrying their `day`; Day 329 = "The Ethiopian Eunuch",
//    cross-checked against the live feed head above).
//  - app/tests/fixtures-v603 (book · novenas · podcasts
//    index) + John's profile document (v589 import,
//    podcastListens stripped as in v603/v611/v614). The
//    ladder index = the captured index PLUS the saint entry
//    (harness-v665's server legs: kind rss, category
//    podcasts, total 299) and the catholicsaints entry
//    (harness-v663's: kind video, category podcasts) — the
//    two series the standing capture predates.
//
// Legs (Plan §4): L1 tree · L2 mapping · L3 the option's
// set · L4 resolution (fixture day 2026-11-25) · L5
// not-updated fallback · L6 duplication · L7 once per
// block · L8 validators + read seam · L9 placement + marks.
// Plus: both ladder hosts write a daily pick (profile
// editor save + Edit today draft) · the pin + dress seats.
// Repair (Review §7): R2 legs — the stale paint at the
// Praylist row seat (trackCard), §8 of the release doc.
//
// Run: node app/worker/harness-v666.mjs
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
let JSDOM, webcrypto;
try { ({ JSDOM } = await import("jsdom")); ({ webcrypto } = await import("node:crypto")); }
catch (e) { ({ JSDOM } = await import(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js"))); ({ webcrypto } = await import("node:crypto")); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const APP = path.resolve(HERE, "..");
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); return !!el; }

// ---------- fixtures ----------
const HEADS = JSON.parse(readFileSync(path.join(HERE, "v666-fixtures", "production-heads.json"), "utf8"));
check("F saint head is the Plan §2.4 head", HEADS.saint[0].title === "11/25 - St. Catherine of Alexandria" && HEADS.saint[1].title.startsWith("11/24 -"), HEADS.saint.slice(0, 2).map((e) => e.title));
check("F exegesis carries the 2026-11-24 release (the fixture day's D-1)", HEADS.exegesis.some((e) => e.key === "14dc54f2-736a-45d9-92cb-624b935fbf8d"));
check("F readings carries the November 25, 2026 title verbatim", HEADS.readings.some((e) => e.title === "Daily Mass Reading Podcast for November 25, 2026"));
check("F BIAY live head is Day 329 (2026), the fixture day's day-of-year", HEADS.biayHeads[0].title === "Day 329: The Ethiopian Eunuch (2026)", HEADS.biayHeads[0]);
check("F catholicsaints window: 15 videos, head named", HEADS.catholicsaints.length === 15 && HEADS.catholicsaints[0].id === "v9MO_5NAZWQ" && HEADS.catholicsaints[0].title === "November 25: St. Catherine of Alexandria, Virgin & Martyr");

const BOOK = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "book.json"), "utf8"));
const NOVENAS = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v614", "novenas-catalog.json"), "utf8")); // the v614 catalog capture: every novena carries its episodes (the v603 capture carries none)
const BIBLE = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "bible-folded.json"), "utf8"));
const PODIDX0 = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "podcasts-index.json"), "utf8"));
const INDEX = JSON.parse(JSON.stringify(PODIDX0));
INDEX.seriesList.push({ series: "saint-of-the-day", kind: "rss", category: "podcasts", title: "The Saint of The Day Podcast", available: true, total: 299 });
INDEX.seriesList.push({ series: "catholicsaints", kind: "video", category: "podcasts", title: "Catholic Saints & Feasts", available: true, total: 15 });
const JOHN_FULL = JSON.parse(readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json"), "utf8"));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = "opn-personal-data-v1";

// Series payloads in the server's own shapes, built from
// the captured heads. Mutable: legs swap variants in.
function audioPayload(series, title, entries) {
  return { ok: true, kind: "rss", series, title, available: true, showImageUrl: null, entries: entries.map((e) => ({ key: e.key, title: e.title, publishedMs: e.publishedMs, url: e.url, durationS: 600, listened: !!e.listened, positionS: 0 })) };
}
let SAINT = audioPayload("saint-of-the-day", "The Saint of The Day Podcast", HEADS.saint);
let EXEG = audioPayload("daily-gospel-exegesis", "Daily Gospel Exegesis", HEADS.exegesis);
let READINGS = audioPayload("daily-readings", "USCCB Daily Readings Podcast", HEADS.readings);
let BIAY = JSON.parse(JSON.stringify(BIBLE));
const CTV = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v656", "catholictv.json"), "utf8")); // the LIVE production Virtual Mass payload captured 2026-11-24 (fixtures-v656)
let CS = { ok: true, kind: "video", series: "catholicsaints", title: "Catholic Saints & Feasts", available: true, marks: true, videos: HEADS.catholicsaints.map((v) => ({ id: v.id, title: v.title, publishedMs: v.publishedMs, url: "https://www.youtube.com/watch?v=" + v.id, imageUrl: null, descText: null, dateLabel: "", listened: false })) };

// ---------- the rendered client + shell ----------
const clientSrc = readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
const uiSrc = readFileSync(path.join(APP, "worker", "src", "ui.ts"), "utf8");
const indexSrc = readFileSync(path.join(APP, "worker", "src", "index.ts"), "utf8");
function renderJs(src) { const a = src.indexOf("= `") + 3; const b = src.indexOf("\n`;", a); return vm.runInContext("`" + src.slice(a, b) + "`", vm.createContext({})); }
const appJs = renderJs(clientSrc);
const shellStart = uiSrc.indexOf("<!DOCTYPE html>");
const SHELL = vm.runInContext("`" + uiSrc.slice(shellStart, uiSrc.indexOf("`;", shellStart)) + "`", vm.createContext({}));

// ---------- server validator extraction (v603 recipe) ----------
function extractServerFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("server fn not found: " + name);
  const nl = src.indexOf("\n", start);
  let i = src.lastIndexOf("{", nl);
  let depth = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === "{") depth++; else if (src[j] === "}") { depth--; if (!depth) break; } }
  return src.slice(start, j + 1);
}
function stripServerValidate(src) {
  let f = extractServerFn(src, "validateProfileContents");
  const reps = [
    ['function validateProfileContents(contents: unknown, coreBlocks: string[]): { normalized?: Record<string, { kind: string; key?: string; side?: string }[]> } | { error: string } {', 'function validateProfileContents(contents, coreBlocks) {'],
    ['const out: Record<string, { kind: string; key?: string; side?: string }[]> = {};', 'const out = {};'],
    ['Object.entries(contents as Record<string, unknown>)', 'Object.entries(contents)'],
    ['const seen = new Set<string>();', 'const seen = new Set();'],
    ['const list: { kind: string; key?: string; side?: string }[] = [];', 'const list = [];'],
    ['const it = (raw && typeof raw === "object" ? raw : {}) as { kind?: unknown; key?: unknown; side?: unknown };', 'const it = (raw && typeof raw === "object" ? raw : {});'],
    ['list.push(side670 ? { kind: kind as string, key: key as string, side: side670 } : { kind: kind as string, key: key as string });', 'list.push(side670 ? { kind: kind, key: key, side: side670 } : { kind: kind, key: key });'],
  ];
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error("server validate shape moved: " + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
const stripSide670 = (f) => f.split('let side670: string | undefined;').join('let side670;');
const serverValidate = new Function(stripSide670(stripServerValidate(indexSrc)) + "\nreturn validateProfileContents;")();

// ---------- world ----------
const HOOK = "\n;window.__opn = { state, opnLocalApi, openProfilesScreen, openEditTodayScreen594, openAddLadder603, opnCheckContents590, opnContentsOf590, opnFoldDay590, extRebuildDescs, resolveDailyDynamic666, resolveProfileEpisodes614, opnDailyKeyOk666, OPN_DAILY_SERIES_666, opnPodCoreSetListen, EXT_TOKENS };";
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes("/api/prayer/book")) body = BOOK;
  else if (u.includes("/api/player/podcasts?series=catholicsaints")) body = CS;
  else if (u.includes("/api/player/podcasts?series=catholictv")) body = CTV;
  else if (u.includes("/api/player/podcasts?series=novenas")) body = NOVENAS;
  else if (u.includes("/api/player/podcasts?series=saint-of-the-day")) body = SAINT;
  else if (u.includes("/api/player/podcasts?series=daily-gospel-exegesis")) body = EXEG;
  else if (u.includes("/api/player/podcasts?series=daily-readings")) body = READINGS;
  else if (u.includes("/api/player/podcasts?series=bible-in-a-year")) body = BIAY;
  else if (u.includes("/api/player/podcasts?series=")) { const sk = decodeURIComponent(u.split("series=")[1].split("&")[0] || "x"); body = { series: sk, kind: "rss", entries: [{ key: sk + ":ep-1", label: "Day 1", title: "First", url: "https://example.invalid/e.mp3", listened: false }], currentKey: sk + ":ep-1" }; }
  else if (u.includes("/api/player/podcasts")) body = INDEX;
  else if (u.includes("/api/player/day")) body = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v597", "production-day-2026-11-21.json"), "utf8"));
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
async function fold666(w, date) {
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay(date));
  O.state.dayPayload = day;
  O.state.ownStanding = []; O.state.extStanding = [];
  O.state.ownSlots = {}; O.state.extSlots = {};
  O.resolveDailyDynamic666(day);
  O.resolveProfileEpisodes614(day);
  await sleep(400);
  return { day, descs: O.extRebuildDescs(day) || [] };
}
async function openProfiles(w) { w.__opn.openProfilesScreen(null, {}); return until(() => w.document.querySelector('[data-p591add="Morning"]')); }
async function openLadder(w, block) {
  await openProfiles(w);
  click(w, w.document.querySelector('[data-p591add="' + (block || "Morning") + '"]'));
  return until(() => w.document.querySelector(".profaddladder603"));
}
const door = (w, val) => w.document.querySelector('[data-p603door="' + val + '"]');
const addRow = (w, id) => w.document.querySelector('[data-p603additem="' + id + '"]');
const ladderEl = (w) => w.document.querySelector(".profaddladder603");
const ladderText = (w) => { const l = ladderEl(w); return l ? l.textContent : ""; };
async function navLadder(w, doors) {
  for (const d of doors) { click(w, door(w, d)); await sleep(80); }
}
async function closeLadder(w) { click(w, w.document.querySelector("[data-p603close]")); await sleep(60); }
async function profilesPayload(w) { return w.__opn.opnLocalApi("/api/prayer/profiles", {}, "device"); }

// ---------- L8 + L7: validators and the read seam ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const core = ["Morning", "Midday", "Evening", "Night"];
  check("L8 set stands verbatim (OPN_DAILY_SERIES_666)", JSON.stringify(O.OPN_DAILY_SERIES_666) === JSON.stringify(["saint-of-the-day", "daily-gospel-exegesis", "daily-readings", "bible-in-a-year", "catholicsaints"]), O.OPN_DAILY_SERIES_666);
  let threw = "";
  try { O.opnCheckContents590({ Morning: [{ kind: "daily", key: "saint-of-the-day" }] }, core); } catch (e) { threw = String(e && e.message || e); }
  check("L8 client validator admits daily with a set key", threw === "", threw);
  threw = "";
  try { O.opnCheckContents590({ Morning: [{ kind: "daily", key: "exorcist-files" }] }, core); } catch (e) { threw = String(e && e.message || e); }
  check("L8 client validator rejects a non-set daily key ('bad daily')", /bad daily exorcist-files/.test(threw), threw);
  const sv1 = serverValidate({ Morning: [{ kind: "daily", key: "catholicsaints" }] }, core);
  check("L8 server twin admits daily with a set key", !sv1.error && sv1.normalized.Morning.length === 1 && sv1.normalized.Morning[0].kind === "daily", sv1);
  const sv2 = serverValidate({ Morning: [{ kind: "daily", key: "exorcist-files" }] }, core);
  check("L8 server twin rejects a non-set daily key ('bad daily')", !!sv2.error && /bad daily exorcist-files/.test(sv2.error), sv2);
  const seam = O.opnContentsOf590({ contents: { Morning: [{ kind: "daily", key: "daily-readings" }, { kind: "daily", key: "exorcist-files" }] } });
  check("L8 read seam passes a stored daily item through (stands after reload), filters a foreign one", !!seam && seam.Morning.length === 1 && seam.Morning[0].key === "daily-readings", seam);
  // L7
  const ded = O.opnCheckContents590({ Morning: [{ kind: "daily", key: "saint-of-the-day" }, { kind: "daily", key: "saint-of-the-day" }] }, core);
  const dedS = serverValidate({ Morning: [{ kind: "daily", key: "saint-of-the-day" }, { kind: "daily", key: "saint-of-the-day" }] }, core);
  check("L7 a second daily:<same series> in one block is dropped at both validators", ded.Morning.length === 1 && !dedS.error && dedS.normalized.Morning.length === 1, { ded, dedS });
  const coex = O.opnCheckContents590({ Morning: [{ kind: "daily", key: "saint-of-the-day" }, { kind: "episode", key: "saint-of-the-day|" + HEADS.saint[0].key }] }, core);
  const coexS = serverValidate({ Morning: [{ kind: "daily", key: "saint-of-the-day" }, { kind: "episode", key: "saint-of-the-day|" + HEADS.saint[0].key }] }, core);
  check("L7 a fixed episode of the same series coexists with the daily item (both validators)", coex.Morning.length === 2 && !coexS.error && coexS.normalized.Morning.length === 2, { coex, coexS });
  w.close();
}

// ---------- L4 + L9: resolution, placement, marks ----------
{
  const saintEp = { kind: "episode", key: "daily-gospel-exegesis|" + HEADS.exegesis[2].key };
  const w = makeWorld(johnStore((doc) => {
    setSalMorning(doc, [
      saintEp,
      { kind: "daily", key: "saint-of-the-day" },
      { kind: "daily", key: "daily-gospel-exegesis" },
      { kind: "daily", key: "bible-in-a-year" },
      { kind: "daily", key: "catholicsaints" },
      { kind: "episode", key: "daily-gospel-exegesis|" + HEADS.exegesis[3].key },
    ]);
    // The readings daily stands in Evening: Morning's
    // standing contents carry the readings seat, and §2.7
    // suppression would (correctly) resolve nothing there.
    const sal = (doc.sections.profiles.list || []).find((p) => p.key === "salesian");
    sal.contents = Object.assign({}, sal.contents || {}, { Evening: [{ kind: "daily", key: "daily-readings" }] });
  }));
  await sleep(300);
  const O = w.__opn;
  const { descs } = await fold666(w, "2026-11-25");
  const dyn = descs.filter((d) => d.daily666);
  const bySeries = {};
  dyn.forEach((d) => { bySeries[d.dailySeries] = d; });
  check("L4 saint resolves the 11/25 episode", !!bySeries["saint-of-the-day"] && bySeries["saint-of-the-day"].episodeId === HEADS.saint[0].key && bySeries["saint-of-the-day"].title.includes("St. Catherine of Alexandria") && bySeries["saint-of-the-day"].stale === false && bySeries["saint-of-the-day"].source === "The Saint of The Day Podcast", bySeries["saint-of-the-day"]);
  check("L4 exegesis resolves the 2026-11-24-released episode (D-1 rule)", !!bySeries["daily-gospel-exegesis"] && bySeries["daily-gospel-exegesis"].episodeId === "14dc54f2-736a-45d9-92cb-624b935fbf8d", bySeries["daily-gospel-exegesis"] && bySeries["daily-gospel-exegesis"].episodeId);
  check("L4 readings resolves the November 25, 2026 titled episode", !!bySeries["daily-readings"] && bySeries["daily-readings"].title === "Daily Mass Reading Podcast for November 25, 2026", bySeries["daily-readings"] && bySeries["daily-readings"].title);
  check("L4 BIAY resolves the Day 329 entry", !!bySeries["bible-in-a-year"] && bySeries["bible-in-a-year"].episodeId === "biy:day-329" && bySeries["bible-in-a-year"].title.includes("The Ethiopian Eunuch"), bySeries["bible-in-a-year"] && bySeries["bible-in-a-year"].episodeId);
  check("L4 catholicsaints resolves a video descriptor (yt: id, November 25 title)", !!bySeries["catholicsaints"] && bySeries["catholicsaints"].kind === "video" && bySeries["catholicsaints"].episodeId === "yt:v9MO_5NAZWQ" && bySeries["catholicsaints"].title === "November 25: St. Catherine of Alexandria, Virgin & Martyr" && bySeries["catholicsaints"].source === "Catholic Saints & Feasts", bySeries["catholicsaints"]);
  // L9 placement: contents order ep-fixed, daily saint, ..., ep-fixed2
  const ids = descs.map((d) => d.episodeId);
  const iEp1 = ids.indexOf(HEADS.exegesis[2].key), iSaint = ids.indexOf(HEADS.saint[0].key), iEp2 = ids.indexOf(HEADS.exegesis[3].key);
  check("L9 the dynamic descriptor stands at its contents position among siblings", iEp1 >= 0 && iSaint > iEp1 && iEp2 > iSaint, { iEp1, iSaint, iEp2, ids: ids.slice(0, 10) });
  w.close();
}
{
  // L9 marks: two fixture days, two episode keys, per-day
  // listened. The played mark stands in the device core
  // (opnPodCoreSetListen, the standing write) for the
  // 11/25 episode only — the local payload fold carries it
  // onto that entry's listened, as production's does.
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: "daily", key: "saint-of-the-day" }])));
  await sleep(300);
  const O = w.__opn;
  O.opnPodCoreSetListen("saint-of-the-day", HEADS.saint[0].key, true, { listenDate: "2026-11-25" });
  const d1 = await fold666(w, "2026-11-25");
  const s1 = d1.descs.find((d) => d.daily666);
  const m1 = O.state.dailyRes666 && O.state.dailyRes666["Morning:saint-of-the-day"];
  const d2 = await fold666(w, "2026-11-24");
  const s2 = d2.descs.find((d) => d.daily666);
  const m2 = O.state.dailyRes666 && O.state.dailyRes666["Morning:saint-of-the-day"];
  check("L9 two days resolve two different episode keys, each carrying its own payload listened (resolver map; the fold's played seam is the core's, as for every family)", !!s1 && !!s2 && s1.episodeId === HEADS.saint[0].key && s2.episodeId === HEADS.saint[1].key && !!m1 && m1.listened === true && !!m2 && m2.listened === false && m2.stale === false, { s1: s1 && s1.episodeId, m1: m1 && m1.listened, s2: s2 && s2.episodeId, m2: m2 && m2.listened });
  w.close();
}

// ---------- L5: the not-updated fallback ----------
{
  const noHead = audioPayload("saint-of-the-day", "The Saint of The Day Podcast", HEADS.saint.slice(1));
  const saveSaint = SAINT; SAINT = noHead;
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: "daily", key: "saint-of-the-day" }])));
  await sleep(300);
  const f1 = await fold666(w, "2026-11-25");
  const st = f1.descs.find((d) => d.daily666);
  check("L5 saint payload without the 11/25 entry: the descriptor is the 11/24 entry, stale:true", !!st && st.episodeId === HEADS.saint[1].key && st.stale === true && st.source === "The Saint of The Day Podcast", st && [st.episodeId, st.stale]);
  SAINT = saveSaint;
  const f2 = await fold666(w, "2026-11-25");
  const st2 = f2.descs.find((d) => d.daily666);
  check("L5 the descriptor settles to the day's own entry when the fixture restores it", !!st2 && st2.episodeId === HEADS.saint[0].key && st2.stale === false, st2 && [st2.episodeId, st2.stale]);
  w.close();
}
{
  // BIAY fallback: the standing folded entries trimmed to
  // day <= 328 (real production entries, a subset) — the
  // presented day 329 has no entry yet.
  const saveBiay = BIAY;
  BIAY = JSON.parse(JSON.stringify(BIBLE));
  BIAY.entries = BIAY.entries.filter((e) => (e.day || 0) <= 328);
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: "daily", key: "bible-in-a-year" }])));
  await sleep(300);
  const f = await fold666(w, "2026-11-25");
  const st = f.descs.find((d) => d.daily666);
  check("L5 BIAY beyond the standing entries: the greatest earlier day entry, stale:true", !!st && st.episodeId === "biy:day-328" && st.stale === true, st && [st.episodeId, st.stale]);
  BIAY = saveBiay;
  w.close();
}

// ---------- R2 (repair, Review §7 R2): the stale paint at the
// Praylist row seat (trackCard) ----------
// L5 proves the descriptors; these legs prove the ROW PAINT
// gate (d) failed on: a stale daily descriptor's card carries
// the v625 warning line, a daily audio card names its series
// in the meta, and a non-daily card is untouched.
const WARN666 = "Today's episode has not updated yet — showing the last one that loaded.";
{
  // The stale fixtures: the L5 saint shape (the payload
  // without its 11/25 head) and the catholicsaints payload
  // in the same shape (its 15-entry window without the
  // November 25 head) — both fall back stale on 2026-11-25.
  const noHead = audioPayload("saint-of-the-day", "The Saint of The Day Podcast", HEADS.saint.slice(1));
  const saveSaint = SAINT; SAINT = noHead;
  const saveCs = CS; CS = Object.assign({}, CS, { videos: CS.videos.slice(1) });
  const fixedEp = { kind: "episode", key: "daily-gospel-exegesis|" + HEADS.exegesis[2].key };
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [
    fixedEp,
    { kind: "daily", key: "saint-of-the-day" },
    { kind: "daily", key: "catholicsaints" },
  ])));
  await sleep(300);
  const f1 = await fold666(w, "2026-11-25");
  const stA = f1.descs.find((d) => d.daily666 && d.dailySeries === "saint-of-the-day");
  const stV = f1.descs.find((d) => d.daily666 && d.dailySeries === "catholicsaints");
  check("R2 stale daily video descriptor stands (kind video, stale:true, the November 24 fallback)", !!stV && stV.kind === "video" && stV.stale === true && stV.episodeId === "yt:" + HEADS.catholicsaints[1].id, stV && [stV.episodeId, stV.stale]);
  const htmlA = stA ? w.trackCard(stA) : "";
  check("R2 stale daily AUDIO card: the ext-stale-warn element + the exact v625 warning text stand on the row", htmlA.includes("<div class='meta ext-stale-warn'>") && htmlA.includes(WARN666), htmlA.slice(0, 400));
  check("R2 stale daily AUDIO card: the series name stands in the meta (the source fold segment)", htmlA.includes("· The Saint of The Day Podcast") && htmlA.indexOf("metarow") >= 0 && htmlA.indexOf("ext-stale-warn") > htmlA.indexOf("metarow"), htmlA.slice(0, 400));
  const htmlV = stV ? w.trackCard(stV) : "";
  check("R2 stale daily VIDEO card: the ext-stale-warn element + the exact v625 warning text stand on the row", htmlV.includes("<div class='meta ext-stale-warn'>") && htmlV.includes(WARN666), htmlV.slice(0, 400));
  // The plain (non-daily) podcast row in the same fold: the
  // repair must not touch its paint.
  const plain = f1.descs.find((d) => !d.daily666 && d.kind === "podcast");
  const htmlP = plain ? w.trackCard(plain) : "";
  check("R2 plain (non-daily) podcast card unchanged: no ext-stale-warn, no source segment in the meta", !!plain && !htmlP.includes("ext-stale-warn") && !htmlP.includes("· Daily Gospel Exegesis"), htmlP.slice(0, 400));
  // Settle the saint payload back: the day's own entry,
  // stale:false — the series name stands, no warning.
  SAINT = saveSaint; CS = saveCs;
  const f2 = await fold666(w, "2026-11-25");
  const okA = f2.descs.find((d) => d.daily666 && d.dailySeries === "saint-of-the-day");
  const htmlS = okA ? w.trackCard(okA) : "";
  check("R2 non-stale daily audio card: the series name stands in the meta and NO warning stands", !!okA && okA.stale === false && htmlS.includes("· The Saint of The Day Podcast") && !htmlS.includes("ext-stale-warn"), htmlS.slice(0, 400));
  w.close();
}

// ---------- L6: duplication ----------
{
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [
    { kind: "source", key: "ext-saint-of-the-day" }, { kind: "daily", key: "saint-of-the-day" },
    { kind: "seat", key: "daily-readings" }, { kind: "daily", key: "daily-readings" },
    { kind: "day", key: "daily-gospel-exegesis" }, { kind: "daily", key: "daily-gospel-exegesis" },
  ])));
  await sleep(300);
  const O = w.__opn;
  const { descs } = await fold666(w, "2026-11-25");
  check("L6 seat twins win: no daily descriptor resolves for saint/readings/exegesis in a twin-carrying block", !descs.some((d) => d.daily666) && !!O.state.dailyRes666 && Object.keys(O.state.dailyRes666).length === 0, descs.filter((d) => d.daily666).map((d) => d.dailySeries));
  w.close();
}
{
  // The ladder twin paint, through the standing host seam
  // with a twin-carrying ids() (the seam both real hosts
  // implement).
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  O.openAddLadder603("Morning", {
    ids: () => ["source:ext-saint-of-the-day"],
    add: () => {},
    layers: () => null,
    groups: () => [],
    ensure: (cb) => cb(),
  });
  await until(() => ladderEl(w));
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:saint-of-the-day"]);
  await until(() => ladderText(w).includes("Daily"), 6000);
  const row = [...w.document.querySelectorAll(".profaddladder603 .p666daily")][0];
  check("L6 the ladder's Add daily row for a seat-carrying block paints marked, not tappable, naming the standing seat", !!row && row.classList.contains("profadd-on603") && !row.hasAttribute("data-p603additem") && row.textContent.includes("already stands in this block"), row && row.textContent.slice(0, 160));
  w.close();
}

// ---------- L1/L2/L3: the ladder tree, mapping, set ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w, "Morning");
  const rootDoors = [...w.document.querySelectorAll("[data-p603door]")].map((d) => d.getAttribute("data-p603door"));
  check("L1 root branches exactly Catechesis · Prayers · Videos", JSON.stringify(rootDoors) === JSON.stringify(["br:catechesis", "br:prayers", "br:videos"]), rootDoors);
  check("L1 door rows carry the v666 mark tile + gold chevron dress", !!w.document.querySelector(".profaddladder603 .p666door .p666mark svg") && !!w.document.querySelector(".profaddladder603 .p666chev"));
  // head search re-path
  const inp = w.document.querySelector("[data-p603search]");
  inp.value = "readings"; inp.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(120);
  const hs = ladderEl(w) ? ladderEl(w).innerHTML : "";
  check("L1 head search groups re-pathed (no Worship/Pray branch stands anywhere)", hs.includes("Catechesis › Podcasts") && hs.includes("series:daily-readings") && !hs.includes("Worship ›") && !hs.includes("Pray ›") && !ladderText(w).includes("Conscience"), hs.slice(0, 200));
  w.__opn.state.extStanding = [{ slotId: "ext-morning-prayer", block: "Morning", title: "Morning Prayer", source: "Divine Office" }]; // the office search group reads the standings (the retired Sing group was a constant list)
  inp.value = "morning prayer"; inp.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(120);
  const hs2 = ladderEl(w) ? ladderEl(w).innerHTML : "";
  check("L1 head search: the office group stands under Prayers › Liturgy of the Hours, its standing Morning row marked (the Sing the Hours group is RETIRED, v670 §3.3)", hs2.includes("Prayers › Liturgy of the Hours") && hs2.includes("Already in Morning") && !hs2.includes("Prayers › Sing the Hours"), hs2.slice(0, 200));
  await closeLadder(w);
  // L2 mapping walks
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:daily-readings"]);
  await until(() => [...w.document.querySelectorAll(".profaddladder603 .bookrow")].some((r) => r.textContent.includes("Daily Mass Reading Podcast for November 25, 2026")), 6000);
  const rdRows = [...w.document.querySelectorAll(".profaddladder603 .bookrow")];
  const seatOk = rdRows.some((r) => r.classList.contains("profadd-on603") && !r.classList.contains("p666daily") && r.textContent.includes("Already in Morning")); // v670 re-point: the seat row's own marks (the title clause read the presented day, re-seated by the migration's completion rebuild against this world's day stub)
  const rdOk = rdRows.some((r) => r.classList.contains("p666daily") && r.classList.contains("profadd-on603") && r.textContent.includes("already stand"));
  check("L2 seat item stands at the readings node head (its date label + the day's readings title); the daily row stands twin-marked (Morning's standing contents carry the seat, §2.7)", seatOk && rdOk, { seatOk, rdOk, text: ladderText(w).slice(0, 200) });
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:saint-of-the-day"]);
  await until(() => addRow(w, "daily:saint-of-the-day"), 6000);
  check("L3 Add daily stands on the saint node (gold card)", !!addRow(w, "daily:saint-of-the-day") && !!w.document.querySelector(".profaddladder603 .p666daily"));
  await closeLadder(w);
  {
    // The slot item's home block is Afternoon (its standing
    // ext row): with that standing in state, the saint node
    // head carries the slot item above its episodes.
    const O2 = w.__opn;
    O2.state.extStanding = [{ slotId: "ext-saint-of-the-day", block: "Afternoon", title: "Saint of the Day", source: "Good Catholic" }];
    O2.openAddLadder603("Afternoon", { ids: () => [], add: () => {}, layers: () => null, groups: () => [], ensure: (cb) => cb() });
    await until(() => ladderEl(w));
    await navLadder(w, ["br:catechesis", "lf:podcasts", "series:saint-of-the-day"]);
    await until(() => addRow(w, "source:ext-saint-of-the-day"), 6000);
    const saintHtml = ladderEl(w) ? ladderEl(w).innerHTML : "";
    check("L2 slot item stands at the saint node head (above its episodes)", !!addRow(w, "source:ext-saint-of-the-day") && saintHtml.indexOf("source:ext-saint-of-the-day") < saintHtml.indexOf("episode:saint-of-the-day|"), saintHtml.slice(0, 200));
    await closeLadder(w);
    O2.state.extStanding = [];
  }
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:daily-gospel-exegesis"]);
  await until(() => addRow(w, "day:daily-gospel-exegesis"), 6000);
  check("L2 day item stands at the exegesis head · L3 Add daily stands there too", !!addRow(w, "day:daily-gospel-exegesis") && !!addRow(w, "daily:daily-gospel-exegesis"));
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:bible-in-a-year"]);
  await until(() => addRow(w, "daily:bible-in-a-year"), 6000);
  check("L3 Add daily stands on the BIAY Podcasts series node", !!addRow(w, "daily:bible-in-a-year"));
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:courses", "course:bible-in-a-year"]);
  await until(() => addRow(w, "course:bible-in-a-year"), 6000);
  check("L2 course next-episode stands · L3 the Courses node carries NO daily row (one home per act)", !!addRow(w, "course:bible-in-a-year") && !addRow(w, "daily:bible-in-a-year") && !w.document.querySelector(".profaddladder603 .p666daily"));
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:catholicsaints"]);
  await until(() => addRow(w, "daily:catholicsaints"), 6000);
  check("L3 Add daily stands at the catholicsaints video node head", !!addRow(w, "daily:catholicsaints") && !!addRow(w, "video:catholicsaints|v9MO_5NAZWQ"));
  {
    const ids = [...w.document.querySelectorAll(".profaddladder603 [data-p603additem]")].map((r) => r.getAttribute("data-p603additem"));
    check("L3 the catholicsaints node's rows: the daily row at the head, then the 15 captured videos in payload order (the v663 L substance under the new head)", ids.length === 16 && ids[0] === "daily:catholicsaints" && ids.slice(1).every((id, i) => id === "video:catholicsaints|" + HEADS.catholicsaints[i].id), ids.slice(0, 3));
  }
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:exorcist-files"]);
  await until(() => ladderText(w).includes("First") || ladderText(w).includes("No episodes"), 6000);
  check("L3 no Add daily on a weekly series (exorcist-files)", !w.document.querySelector(".profaddladder603 .p666daily") && !addRow(w, "daily:exorcist-files"), ladderText(w).slice(0, 120));
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:virtual-mass", "vmass:catholictv"]);
  await until(() => addRow(w, "video:catholictv|" + CTV.videos[0].id), 6000);
  {
    const ids = [...w.document.querySelectorAll(".profaddladder603 [data-p603additem]")].map((r) => r.getAttribute("data-p603additem"));
    check("L2 Virtual Mass video node stands under Videos, its videos in payload order (the v656 a5 substance) · L3 it carries NO daily row", ids.length === CTV.videos.length && ids.every((id, i) => id === "video:catholictv|" + CTV.videos[i].id) && !w.document.querySelector(".profaddladder603 .p666daily"), ids.slice(0, 3));
  }
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:adoration"]);
  await sleep(80);
  check("L2 the Adoration no-add leaf stands under Videos", ladderText(w).includes("Nothing to add"), ladderText(w).slice(0, 120));
  await closeLadder(w);
  {
    const O3 = w.__opn;
    O3.state.extStanding = ["ext-invitatory", "ext-morning-prayer", "ext-midmorning-prayer", "ext-midday-prayer", "ext-midafternoon-prayer", "ext-office-of-readings", "ext-evening-prayer", "ext-night-prayer"].map((k) => ({ slotId: k, block: "Morning", title: k, source: "Divine Office" }));
    O3.openAddLadder603("Morning", { ids: () => [], add: () => {}, layers: () => null, groups: () => [], ensure: (cb) => cb() });
    await until(() => ladderEl(w));
    await navLadder(w, ["br:prayers", "lf:office"]);
    await sleep(80);
    check("L2 Divine Office items stand under Prayers (v670: the labeled rows stand as pick rows, data-p670pick)", !!w.document.querySelector('[data-p670pick="ext-morning-prayer"]') && !!addRow(w, "source:ext-invitatory"), ladderText(w).slice(0, 120));
    await closeLadder(w);
    // v614 L5b substance under the new tree: a Divine
    // Office hour already standing stays ADDABLE (the v610
    // exception in isOn) at its Prayers home.
    O3.openAddLadder603("Morning", { ids: () => ["source:ext-morning-prayer"], add: () => {}, layers: () => null, groups: () => [], ensure: (cb) => cb() });
    await until(() => ladderEl(w));
    await navLadder(w, ["br:prayers", "lf:office"]);
    await sleep(80);
    check("L2 the v610 exception's home stands for the NON-labeled hours: ext-invitatory (not standing in this host) paints as a plain add row beside the labeled pick rows", !!addRow(w, "source:ext-invitatory"), ladderText(w).slice(0, 120));
    check("L2 v670 supersedes the exception for labeled slots: the standing Morning Prayer row is the marked pick row, not an add row", !addRow(w, "source:ext-morning-prayer") && ladderText(w).includes("Already in Morning"), ladderText(w).slice(0, 120));
    await closeLadder(w);
    // v614 L5d substance: the block's own source rows stand
    // addable under Prayers › Ora Pro Nobis.
    O3.state.ownStanding = [{ sourceKey: "daily-rosary", block: "Morning", title: "Daily Rosary" }];
    O3.openAddLadder603("Morning", { ids: () => [], add: () => {}, layers: () => null, groups: () => [], ensure: (cb) => cb() });
    await until(() => ladderEl(w));
    await navLadder(w, ["br:prayers", "lf:own"]);
    await sleep(80);
    check("L2 the block's own source rows stand addable under Prayers › Ora Pro Nobis (the v614 L5d substance)", !!addRow(w, "source:daily-rosary"), ladderText(w).slice(0, 120));
    await closeLadder(w);
    O3.state.extStanding = [];
    O3.state.ownStanding = [];
  }
  await openLadder(w, "Morning");
  await navLadder(w, ["br:prayers"]);
  await sleep(80);
  check("L2 the Sing the Hours door is RETIRED (v670 §3.3): no lf:sing door stands under Prayers; the Liturgy of the Hours door's sub names the pick", !door(w, "lf:sing") && ladderText(w).includes("Morning & Evening Prayer — pick the reading"), ladderText(w).slice(0, 120));
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:prayers", "lf:prayerbook"]);
  await sleep(80);
  const grp = w.document.querySelector("[data-p603group]");
  check("L2 Prayer Book groups stand under Prayers", !!grp, ladderText(w).slice(0, 120));
  if (grp) { click(w, grp); await sleep(80); check("L2 a Prayer Book group opens prayer rows", [...w.document.querySelectorAll("[data-p603additem]")].some((r) => r.getAttribute("data-p603additem").startsWith("prayer:")), ladderText(w).slice(0, 120)); }
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:prayers", "lf:own"]);
  await sleep(80);
  check("L2 Ora Pro Nobis (the block's own source rows) stands under Prayers", ladderText(w).length > 0, ladderText(w).slice(0, 120));
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:homilies"]);
  await sleep(80);
  check("L2 Homilies doors stand (Fr. Mike · Barron · My recorded homilies)", !!door(w, "series:fr-mike-homilies") && !!door(w, "series:barron-sunday-sermons") && !!door(w, "lf:myhomilies"), ladderText(w).slice(0, 160));
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:novenas"]);
  await until(() => (NOVENAS.novenas || []).length && door(w, "novena:" + NOVENAS.novenas[0].slug), 6000);
  const nvDoor = (NOVENAS.novenas || [])[0] && door(w, "novena:" + NOVENAS.novenas[0].slug);
  check("L2 novena doors stand under Catechesis", !!nvDoor, ladderText(w).slice(0, 120));
  if (nvDoor) { click(w, nvDoor); await sleep(150); check("L2 a novena node opens episode rows", [...w.document.querySelectorAll("[data-p603additem]")].some((r) => r.getAttribute("data-p603additem").startsWith("episode:novenas|")), ladderText(w).slice(0, 120)); }
  await closeLadder(w);
  // Novenas collapse unchanged
  await openLadder(w, "Novenas");
  check("L1 the Novenas block collapse stands (items, no source doors)", !!addRow(w, "all-novenas:") === false && ladderText(w).includes("Every active novena") && !door(w, "br:catechesis"), ladderText(w).slice(0, 160));
  await closeLadder(w);
  w.close();
}

// ---------- both hosts write a daily pick ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:saint-of-the-day"]);
  await until(() => addRow(w, "daily:saint-of-the-day"), 6000);
  click(w, addRow(w, "daily:saint-of-the-day"));
  await until(() => !ladderEl(w), 3000);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  const landed = await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === "salesian"); return s && ((s.contents && s.contents.Morning) || []).some((it) => it.kind === "daily" && it.key === "saint-of-the-day"); }, 6000);
  check("H profile-editor host: adding Daily stands {kind:daily, key:saint-of-the-day} in the saved profile contents", landed);
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(300);
  w.__opn.openEditTodayScreen594(true);
  const addBtn = await until(() => w.document.querySelector('[data-p594tadd="Morning"]'), 6000);
  check("H Edit today opens with its Morning Add act", !!addBtn);
  click(w, w.document.querySelector('[data-p594tadd="Morning"]'));
  await until(() => ladderEl(w));
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:bible-in-a-year"]);
  await until(() => addRow(w, "daily:bible-in-a-year"), 6000);
  click(w, addRow(w, "daily:bible-in-a-year"));
  await until(() => !ladderEl(w), 3000);
  await sleep(200);
  check("H Edit-today host: the daily pick lands in the today draft, titled '<series> · Daily'", w.document.body.textContent.includes("Bible in a Year · Daily"), w.document.body.textContent.slice(0, 300));
  w.close();
}

{
  // The v656 a6/a7 substance at the new home: a Virtual
  // Mass pick writes through the profile-editor host, and
  // the standing video then paints marked, not tappable.
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:virtual-mass", "vmass:catholictv"]);
  await until(() => addRow(w, "video:catholictv|" + CTV.videos[0].id), 6000);
  click(w, addRow(w, "video:catholictv|" + CTV.videos[0].id));
  await until(() => !ladderEl(w), 3000);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  const landed = await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === "salesian"); return s && ((s.contents && s.contents.Morning) || []).some((it) => it.kind === "video" && it.key === "catholictv|" + CTV.videos[0].id); }, 6000);
  check("H a Virtual Mass pick writes {kind:video, key:catholictv|<id>} through the host at its Videos home (the v656 a6 substance)", landed);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:virtual-mass", "vmass:catholictv"]);
  await until(() => ladderText(w).includes("Already in Morning"), 6000);
  const stoodRow = [...w.document.querySelectorAll(".profaddladder603 .bookrow")].find((r) => r.textContent.includes(CTV.videos[0].title));
  check("H the standing video paints 'Already in Morning' and is not tappable (the v656 a7 substance)", !!stoodRow && !stoodRow.hasAttribute("data-p603additem") && stoodRow.textContent.includes("Already in Morning"), stoodRow && stoodRow.textContent.slice(0, 120));
  w.close();
}

// ---------- pin + dress seats ----------
check("P pin: ui.ts CACHE is ora-pro-nobis-v672-1 at its one seat", uiSrc.includes('var CACHE = "ora-pro-nobis-v672-1"') && (uiSrc.match(/ora-pro-nobis-v672-1/g) || []).length === 1);
check("P dress: the scoped ladder rules stand (mark tile · gold chevron · gold-tinted daily card · sheet-head)", uiSrc.includes(".profaddladder603 .p666mark") && uiSrc.includes(".profaddladder603 .p666chev") && uiSrc.includes(".profaddladder603 .p666daily") && uiSrc.includes(".profaddladder603 .searchpill"));

console.log(`\nharness-v666: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
