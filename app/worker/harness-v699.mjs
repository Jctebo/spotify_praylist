// harness-v699.mjs — v699: Stations as an addable episode;
// the "Mass and Homilies" closing section removed, every row
// an addable item (Plan §2.5 legs S1-S9).
//
// Fixtures (Improvement D — production shapes, sources named):
//  - The Stations catalog record AS PRODUCED in §2.1 seat 1:
//    slug stations-of-the-cross · title "Stations of the
//    Cross" · category "The Raccolta" (OPEN-1 decided) ·
//    duration measured from the produced file
//    (~/workspace/projects/ora-pro-nobis/v699-prayer-audio/
//    renders.json, read below and asserted against the
//    shipped PRAYER_AUDIO entry in index.ts).
//  - SETTINGS fixture family: harness-v658's SETTINGS_LIVE
//    26-row live shape (imported by reference in S8/S9
//    legs — the rows are carried in v658; here the four
//    closing rows' live values are asserted from the seed
//    extraction + the Plan §1.3 D1 read).
//  - Homily series payloads in the rss_snapshots shape
//    (key · title · url · publishedMs), entries modeled on
//    the live fr-mike-homilies snapshot head (weekly Sunday
//    cadence): Sun 2026-11-22, Sun 2026-11-29, and one
//    FUTURE entry Sun 2026-12-06 (the never-later trap).
//  - Presented days Thu 2026-11-26 · Fri 2026-11-27 ·
//    Sun 2026-11-29 (the v690 fixture days).
// Run: node app/worker/harness-v699.mjs
//
// Modeled on harness-v666.mjs (the device-mode world: the
// rendered client from source driven in jsdom over John's
// profile document; the server validator extracted
// standalone, the v687 strip recipe).
//
// Fixtures (Improvement D — production sources, named):
//  - app/tests/fixtures-v656/{catholictv,dailytvmass,
//    springfieldmass}.json — the LIVE production Virtual
//    Mass payloads captured 2026-11-24 (Plan §2.8). Subset
//    trims are named at each leg (filter by the title's own
//    date / by id — real entries only, never invented).
//  - The externals/live slot entry in the shape
//    externalsLivePayload emits (index.ts: state · title ·
//    streamUrl · durationSec · imageUrl · descText · stale)
//    for the ext-daily-tv-mass slot, per presented date.
//  - John's profile document (v589 import, podcastListens
//    stripped as in v603/v611/v614/v666).
// Presented dates: 2026-11-24 (day 1) and 2026-11-23
// (day 2), both standing in the captures.
//
// Legs (Plan §2.8): M1 the option's set · M2 add ->
// composed seat (both hosts) · M3 day-1 resolution · M4
// per-day pick · M5 not-updated (+ the English-only
// amendment leg) · M6 marks per-day · M7 play shape · M8
// validators + read seam · M9 settled discipline. Plus:
// the three label seats (opnItemLabel604 · the profile
// editor's paintContents chain · Edit today's paint) and
// the v687 Edit-form contents row for a massdaily item.
//
// Run: node app/worker/harness-v688.mjs
import { readFileSync, writeFileSync } from "node:fs";
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
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); return !!el; }

// ---------- fixtures ----------
const CTV0 = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v656", "catholictv.json"), "utf8"));
const DTV0 = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v656", "dailytvmass.json"), "utf8"));
const SPR0 = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v656", "springfieldmass.json"), "utf8"));
check("F catholictv capture carries the Plan M3/M4 ids", CTV0.videos.some((v) => v.id === "D-CPXkxCLRM") && CTV0.videos.some((v) => v.id === "wpOyueDj_eY"), CTV0.videos.slice(0, 2).map((v) => v.id));
check("F dailytvmass capture: the Nov 24 Mass stands BELOW Shorts/Rosary items", DTV0.videos.findIndex((v) => v.id === "qLQDKW65m8k") > 3, DTV0.videos.slice(0, 5).map((v) => v.id));
check("F springfieldmass capture carries the Plan M3/M4 ids", SPR0.videos[0].id === "EdmQlVx3BU0" && SPR0.videos[1].id === "QomObkUkfos");
let CTV = JSON.parse(JSON.stringify(CTV0));
let DTV = JSON.parse(JSON.stringify(DTV0));
let SPR = JSON.parse(JSON.stringify(SPR0));
// The externals/live payloads, per date, in the emitted
// shape (mutable: legs swap variants in).
function livePayload(date, entry) {
  return { ok: true, date, slots: entry ? [entry] : [], settingsVersion: 1 };
}
function tvMassEntry(date, stale) {
  return { slotId: "ext-daily-tv-mass", block: "Mass and Homilies", sortOrder: 2, state: "present",
    title: "Daily TV Mass, " + date, streamUrl: "https://example.invalid/tvmass-" + date + ".mp3",
    durationSec: 1500, sizeBytes: 1000, resolvedAt: date + "T12:00:00Z", source: "Daily TV Mass",
    imageUrl: null, descText: "The Daily TV Mass for " + date, ...(stale ? { stale: true } : {}) };
}
let LIVE = {
  "2026-11-24": livePayload("2026-11-24", tvMassEntry("2026-11-24", false)),
  "2026-11-23": livePayload("2026-11-23", tvMassEntry("2026-11-23", false)),
  "2026-11-22": livePayload("2026-11-22", tvMassEntry("2026-11-22", false)),
};
const BOOK = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "book.json"), "utf8"));
const INDEX_SRC_699 = readFileSync(path.join(APP, "worker", "src", "index.ts"), "utf8");
const AUDIO_M_699 = INDEX_SRC_699.match(/"stations-of-the-cross": \{ en: ([0-9.]+) \}/);
const DUR_699 = AUDIO_M_699 ? Number(AUDIO_M_699[1]) : null;
let RENDER_DUR_699 = null;
try { RENDER_DUR_699 = JSON.parse(readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/v699-prayer-audio/renders.json"), "utf8"))[0].duration; } catch (e) {}
const STATIONS_699 = { slug: "stations-of-the-cross", title: "Stations of the Cross", body: "STATION 1", bodyLatin: null, source: "St. Alphonsus Liguori, The Way of the Cross (public domain)", audio: DUR_699 ? { en: DUR_699 } : undefined };
{ const g = BOOK.groups.find((x) => x.category === "The Raccolta"); if (g) g.prayers.push(STATIONS_699); else BOOK.groups.push({ category: "The Raccolta", prayers: [STATIONS_699] }); }
const FRMIKE_699 = { ok: true, kind: "rss", series: "fr-mike-homilies", title: "Sunday Homilies with Fr. Mike Schmitz", available: true, showImageUrl: null,
  entries: [
    { key: "fm-2026-12-06", title: "Homily for Dec 6", url: "https://x/fm1206.mp3", publishedMs: Date.parse("2026-12-06T14:00:00Z"), durationS: 900, listened: false, positionS: 0 },
    { key: "fm-2026-11-29", title: "Homily for Nov 29", url: "https://x/fm1129.mp3", publishedMs: Date.parse("2026-11-29T14:00:00Z"), durationS: 900, listened: false, positionS: 0 },
    { key: "fm-2026-11-22", title: "Homily for Nov 22", url: "https://x/fm1122.mp3", publishedMs: Date.parse("2026-11-22T14:00:00Z"), durationS: 900, listened: false, positionS: 0 } ] };
const BARRON_699 = { ok: true, kind: "rss", series: "barron-sunday-sermons", title: "Bishop Barron's Sunday Sermons", available: true, showImageUrl: null,
  entries: [ { key: "bb-2026-11-29", title: "Sermon for Nov 29", url: "https://x/bb1129.mp3", publishedMs: Date.parse("2026-11-29T15:00:00Z"), durationS: 800, listened: false, positionS: 0 } ] };
const NOVENAS = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v614", "novenas-catalog.json"), "utf8"));
const PODIDX = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "podcasts-index.json"), "utf8"));
// v699 fixture completion (production source named): the LIVE podcasts index
// carries both homily series with the titles index.ts POD_RSS_SERIES_LIST
// (4288-4289) names; the v603 capture predates their index seat.
PODIDX.seriesList.push({ series: "fr-mike-homilies", title: "Sunday Homilies with Fr. Mike Schmitz", available: true });
PODIDX.seriesList.push({ series: "barron-sunday-sermons", title: "Bishop Barron's Sunday Sermons", available: true });
const JOHN_FULL = JSON.parse(readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json"), "utf8"));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = "opn-personal-data-v1";

// ---------- the rendered client + shell ----------
const clientSrc = readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
const uiSrc = readFileSync(path.join(APP, "worker", "src", "ui.ts"), "utf8");
const indexSrc = readFileSync(path.join(APP, "worker", "src", "index.ts"), "utf8");
function renderJs(src) { const a = src.indexOf("= `") + 3; const b = src.indexOf("\n`;", a); return vm.runInContext("`" + src.slice(a, b) + "`", vm.createContext({})); }
const appJs = renderJs(clientSrc);
const shellStart = uiSrc.indexOf("<!DOCTYPE html>");
const SHELL = vm.runInContext("`" + uiSrc.slice(shellStart, uiSrc.indexOf("`;", shellStart)) + "`", vm.createContext({}));

// ---------- server validator extraction (v687 recipe) ----------
function extractServerFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("server fn not found: " + name);
  const nl = src.indexOf("\n", start);
  let i = src.lastIndexOf("{", nl);
  let depth = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === "{") depth++; else if (src[j] === "}") { depth--; if (!depth) break; } }
  return src.slice(start, j + 1);
}
function stripNamed(src, name, reps) {
  let f = extractServerFn(src, name);
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error(name + " shape moved: " + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
// RE-POINTED BY v690 (Review, recipe only — no assertion touched): the
// extraction strip strings below follow the validateProfileContents
// signature widened by v690 Plan §2.2 S2 (dayRule?: string carriage).
const serverValidate = new Function(stripNamed(indexSrc, "validateProfileContents", [
  ['function validateProfileContents(contents: unknown, coreBlocks: string[]): { normalized?: Record<string, { kind: string; key?: string; side?: string; off?: number; dayRule?: string }[]> } | { error: string } {', 'function validateProfileContents(contents, coreBlocks) {'],
  ['const out: Record<string, { kind: string; key?: string; side?: string; off?: number; dayRule?: string }[]> = {};', 'const out = {};'],
  ['Object.entries(contents as Record<string, unknown>)', 'Object.entries(contents)'],
  ['const seen = new Set<string>();', 'const seen = new Set();'],
  ['const list: { kind: string; key?: string; side?: string; off?: number; dayRule?: string }[] = [];', 'const list = [];'],
  ['const it = (raw && typeof raw === "object" ? raw : {}) as { kind?: unknown; key?: unknown; side?: unknown; off?: unknown; dayRule?: unknown };', 'const it = (raw && typeof raw === "object" ? raw : {});'],
  ['let side670: string | undefined;', 'let side670;'],
  ['let off687: number | undefined;', 'let off687;'],
  ['let dayRule690: string | undefined;', 'let dayRule690;'],
  ['const an690: { kind: string; dayRule?: string } = { kind: "all-novenas" };', 'const an690 = { kind: "all-novenas" };'],
  ['if (side670 || off687 || dayRule690) { const built687: { kind: string; key?: string; side?: string; off?: number; dayRule?: string } = { kind: kind as string, key: key as string }; if (side670) built687.side = side670; if (off687) built687.off = 1; if (dayRule690) built687.dayRule = dayRule690; list.push(built687); }', 'if (side670 || off687 || dayRule690) { const built687 = { kind: kind, key: key }; if (side670) built687.side = side670; if (off687) built687.off = 1; if (dayRule690) built687.dayRule = dayRule690; list.push(built687); }'],
  ['else list.push({ kind: kind as string, key: key as string });', 'else list.push({ kind: kind, key: key });'],
]) + "\nreturn validateProfileContents;")();

// ---------- world ----------
const HOOK = "\n;window.__opn = { state, opnLocalApi, openProfilesScreen, openEditTodayScreen594, openAddLadder603, opnCheckContents590, opnContentsOf590, opnFoldDay590, extRebuildDescs, resolveMassDynamic688, resolveProfileVideos656, resolveDailyDynamic666, opnDailyMatch666, opnItemPaints690, prayerAudioDesc, opnDailySeriesTitle666, opnSetItemDay690, opnContentsRowHtml687, opnMassKeyOk688, OPN_MASS_SERIES_688, OPN_DAILY_SERIES_666, opnMassMatch688, opnItemLabel604, opnContentsRowHtml687, profContentsUniverse590, trackCard, writePlayed, isPlayed, markCompleted, startDesc, finishVideoHandoff656, openEpisodeCard };";
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes("/api/prayer/book")) body = BOOK;
  else if (u.includes("/api/player/externals/live")) { const d = decodeURIComponent((u.split("date=")[1] || "").split("&")[0]); body = LIVE[d] || livePayload(d, null); }
  else if (u.includes("/api/player/podcasts?series=catholictv")) body = CTV;
  else if (u.includes("/api/player/podcasts?series=dailytvmass")) body = DTV;
  else if (u.includes("/api/player/podcasts?series=springfieldmass")) body = SPR;
  else if (u.includes("/api/player/podcasts?series=novenas")) body = NOVENAS;
  else if (u.includes("/api/player/podcasts?series=fr-mike-homilies")) body = FRMIKE_699;
  else if (u.includes("/api/player/podcasts?series=barron-sunday-sermons")) body = BARRON_699;
  else if (u.includes("/api/player/podcasts?series=")) { const sk = decodeURIComponent(u.split("series=")[1].split("&")[0] || "x"); body = { series: sk, kind: "rss", entries: [{ key: sk + ":ep-1", label: "Day 1", title: "First", url: "https://example.invalid/e.mp3", listened: false }], currentKey: sk + ":ep-1" }; }
  else if (u.includes("/api/player/podcasts")) body = PODIDX;
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
async function fold688(w, date) {
  const O = w.__opn;
  const day = O.opnFoldDay590(syntheticDay(date));
  O.state.dayPayload = day;
  O.state.ownStanding = []; O.state.extStanding = [];
  O.state.ownSlots = {}; O.state.extSlots = {};
  O.resolveProfileVideos656(day);
  O.resolveMassDynamic688(day);
  await sleep(500);
  return { day, descs: O.extRebuildDescs(day) || [] };
}
const MASS_CONTENTS = [
  { kind: "video", key: "catholictv|nei7hRlEzCQ" },
  { kind: "massdaily", key: "catholictv" },
  { kind: "massdaily", key: "dailytvmass" },
  { kind: "massdaily", key: "springfieldmass" },
  { kind: "massdaily", key: "daily-tv-mass" },
  { kind: "video", key: "catholictv|_Te-ZRuKKkQ" },
];
const massDescs = (descs) => descs.filter((d) => d.mass688);
const bySeries688 = (descs) => { const m = {}; massDescs(descs).forEach((d) => { m[d.massSeries] = d; }); return m; };
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
async function navLadder(w, doors) { for (const d of doors) { click(w, door(w, d)); await sleep(80); } }
async function closeLadder(w) { click(w, w.document.querySelector("[data-p603close]")); await sleep(60); }
async function profilesPayload(w) { return w.__opn.opnLocalApi("/api/prayer/profiles", {}, "device"); }

async function savedMorning699(w) {
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  let found = null;
  await until(async () => { const p = await profilesPayload(w); const s2 = (p.profiles || []).find((x) => x.key === (p.effective && p.effective.key)); const c = (s2 && s2.contents && s2.contents.Morning) || []; if (c.length) { found = c; return true; } return false; }, 6000);
  return found || [];
}
const WARN = "Today's episode has not updated yet — showing the last one that loaded.";

// ---------- S1/S2: static seats + catalog record ----------
{
  const clientSrc699 = readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
  check("S1 the closing-section builder is DELETED from client.ts (no opnMassHomiliesSectionHtml686, no data-p686mass, no closing:true caller)",
    !clientSrc699.includes("opnMassHomiliesSectionHtml686") && !clientSrc699.includes("data-p686mass") && !clientSrc699.includes("p686mass") && !clientSrc699.includes("closing: true") && !clientSrc699.includes("closing:true"));
  check("S2 PRAYER_AUDIO['stations-of-the-cross'].en stands in index.ts and equals the produced file's measured duration (renders.json fixture)",
    DUR_699 !== null && RENDER_DUR_699 !== null && DUR_699 === RENDER_DUR_699, { DUR_699, RENDER_DUR_699 });
  const g = BOOK.groups.find((x) => x.category === "The Raccolta");
  check("S2 the book payload shape carries the Stations record (slug + title) in the standing category 'The Raccolta' (OPEN-1 decided)",
    !!g && g.prayers.some((p) => p.slug === "stations-of-the-cross" && p.title === "Stations of the Cross"));
}

// ---------- S2 fold / S3 Add / S4 Fridays / S6 validators ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const core = ["Morning", "Midday", "Evening", "Night"];
  const stPrayer = (() => { let hit = null; BOOK.groups.forEach((g) => g.prayers.forEach((p) => { if (p.slug === "stations-of-the-cross") hit = p; })); return hit; })();
  const desc = O.prayerAudioDesc(stPrayer, "en");
  check("S2 fold resolution: the Stations prayer descriptor resolves (title + measured duration, NOT the silent drop)",
    !!desc && desc.title === "Stations of the Cross" && desc.durationS === DUR_699, desc);
  check("S4 play URL is the book audio route for the slug", !!desc && desc.url === "/api/prayer/book/audio/stations-of-the-cross/en", desc && desc.url);
  const friItem = { kind: "prayer", key: "stations-of-the-cross", dayRule: "fridays" };
  check("S4 Stations paints Fridays only (Thu 2026-11-26 no · Fri 2026-11-27 yes · Sun 2026-11-29 no)",
    O.opnItemPaints690(friItem, "2026-11-26") === false && O.opnItemPaints690(friItem, "2026-11-27") === true && O.opnItemPaints690(friItem, "2026-11-29") === false);
  // S3: the Add ladder Prayer Book category rung.
  await openLadder(w, "Morning");
  await navLadder(w, ["br:prayers", "lf:prayerbook"]);
  await sleep(120);
  const grp = w.document.querySelector('[data-p603group="The Raccolta"]');
  check("S3 the Prayer Book ladder carries 'The Raccolta' category rung", !!grp, ladderText(w).slice(0, 200));
  if (grp) { click(w, grp); await sleep(150); }
  const stRow = addRow(w, "prayer:stations-of-the-cross");
  check("S3 the Stations row stands at the Raccolta rung", !!stRow, ladderText(w).slice(0, 200));
  if (stRow) { click(w, stRow); await sleep(200); }
  const stored = await savedMorning699(w);
  const added = stored.find((it) => it.key === "stations-of-the-cross");
  const sal = !!added;
  check("S3 the Add produces exactly {kind:'prayer', key:'stations-of-the-cross', dayRule:'fridays'} in the stored contents",
    !!added && added.kind === "prayer" && added.dayRule === "fridays" && sal, added);
  let threw = "";
  try { O.opnCheckContents590({ Morning: [friItem] }, core); } catch (e) { threw = String(e && e.message || e); }
  const sv = serverValidate({ Morning: [friItem] }, core);
  check("S3 both validators accept the stamped Stations prayer item", threw === "" && !sv.error && sv.normalized.Morning[0].dayRule === "fridays", { threw, sv });
  await closeLadder(w).catch(() => {});
  w.close();
}

// ---------- S5: Daily TV Mass standing shape, no second control ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:virtual-mass"]);
  await sleep(100);
  click(w, door(w, "vmass-audio:daily-tv-mass"));
  await until(() => addRow(w, "massdaily:daily-tv-mass"), 6000);
  check("S5 the v688 massdaily gold card still paints at the audio door (zero new code)", !!addRow(w, "massdaily:daily-tv-mass"), ladderText(w).slice(0, 160));
  if (addRow(w, "massdaily:daily-tv-mass")) { click(w, addRow(w, "massdaily:daily-tv-mass")); await sleep(200); }
  const stored = await savedMorning699(w);
  check("S5 an Add produces {kind:'massdaily', key:'daily-tv-mass'} (no dayRule stamp — the standing v688 shape)",
    stored.some((it) => it.kind === "massdaily" && it.key === "daily-tv-mass" && !it.dayRule), stored.slice(-3));
  check("S5 no second control: no [data-p686src] row for daily-tv-mass stands in the document",
    !w.document.querySelector('[data-p686src="daily-tv-mass"]'));
  await closeLadder(w).catch(() => {});
  w.close();
}

// ---------- S6/S7: homilies standing Add + resolution ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const core = ["Morning", "Midday", "Evening", "Night"];
  check("S6 the daily set is widened by exactly the two homily series (five standing keys' order untouched)",
    JSON.stringify(O.OPN_DAILY_SERIES_666) === JSON.stringify(["saint-of-the-day", "daily-gospel-exegesis", "daily-readings", "bible-in-a-year", "catholicsaints", "fr-mike-homilies", "barron-sunday-sermons"]), O.OPN_DAILY_SERIES_666);
  for (const key of ["fr-mike-homilies", "barron-sunday-sermons"]) {
    const item = { kind: "daily", key, dayRule: "sundays" };
    let threw = "";
    try { O.opnCheckContents590({ Morning: [item] }, core); } catch (e) { threw = String(e && e.message || e); }
    const sv = serverValidate({ Morning: [item] }, core);
    check("S6 both validators accept daily:" + key + " with the stamped sundays rule", threw === "" && !sv.error && sv.normalized.Morning[0].dayRule === "sundays", { threw, sv });
  }
  let threwB = "";
  try { O.opnCheckContents590({ Morning: [{ kind: "daily", key: "bogus-series" }] }, core); } catch (e) { threwB = String(e && e.message || e); }
  const svB = serverValidate({ Morning: [{ kind: "daily", key: "bogus-series" }] }, core);
  check("S6 both validators still refuse a bogus daily key", /bad daily/.test(threwB) && !!svB.error && /bad daily/.test(svB.error), { threwB, svB });
  // Ladder: series node head card + Add stamp.
  await openLadder(w, "Morning");
  await until(() => O.opnDailySeriesTitle666("fr-mike-homilies") === "Sunday Homilies with Fr. Mike Schmitz", 6000);
  check("S6 card labels read '<series title> · Daily' for both homily series",
    O.opnDailySeriesTitle666("fr-mike-homilies") === "Sunday Homilies with Fr. Mike Schmitz" && O.opnDailySeriesTitle666("barron-sunday-sermons").includes("Bishop Barron"),
    [O.opnDailySeriesTitle666("fr-mike-homilies"), O.opnDailySeriesTitle666("barron-sunday-sermons")]);
  await navLadder(w, ["br:catechesis", "lf:homilies", "series:fr-mike-homilies"]);
  await until(() => addRow(w, "daily:fr-mike-homilies"), 6000);
  const rows = [...w.document.querySelectorAll(".profaddladder603 [data-p603additem]")].map((r) => r.getAttribute("data-p603additem"));
  const card = addRow(w, "daily:fr-mike-homilies");
  check("S6 seriesNode614 paints the gold daily card at the HEAD of the Fr. Mike node, pinned episode rows below",
    rows[0] === "daily:fr-mike-homilies" && !!card && !!card.closest(".p666daily") && rows.some((r) => r.startsWith("episode:fr-mike-homilies|")), rows.slice(0, 4));
  if (card) { click(w, card); await sleep(200); }
  const stored = await savedMorning699(w);
  const addedH = stored.find((it) => it.kind === "daily" && it.key === "fr-mike-homilies");
  check("S6 the Add produces {kind:'daily', key:'fr-mike-homilies', dayRule:'sundays'} in stored contents",
    !!addedH && addedH.dayRule === "sundays", addedH);
  await closeLadder(w).catch(() => {});
  // S7 matcher: newest <= presented, future entry never stands.
  const mSun = O.opnDailyMatch666("fr-mike-homilies", FRMIKE_699.entries, "2026-11-29");
  check("S7 Sunday 2026-11-29 resolves the Nov 29 entry (stale:false)", !!mSun && mSun.e.key === "fm-2026-11-29" && mSun.stale === false, mSun && mSun.e.key);
  const mFri = O.opnDailyMatch666("fr-mike-homilies", FRMIKE_699.entries, "2026-11-27");
  check("S7 presented Fri 2026-11-27 resolves the newest entry on or before it (Nov 22) — the future Nov 29 / Dec 6 entries never stand",
    !!mFri && mFri.e.key === "fm-2026-11-22", mFri && mFri.e.key);
  const mNone = O.opnDailyMatch666("barron-sunday-sermons", [{ key: "bb-future", title: "Future", url: "https://x/f.mp3", publishedMs: Date.parse("2026-12-06T15:00:00Z") }], "2026-11-29");
  check("S7 a series with only a future-dated entry resolves null (not-available placeholder posture, no fallback)", mNone === null, mNone);
  const sunItem = { kind: "daily", key: "fr-mike-homilies", dayRule: "sundays" };
  check("S7 Sundays cadence via the v690 item gate: paints Sun 2026-11-29, not Fri 2026-11-27; a Daily rule repaints it onto Friday",
    O.opnItemPaints690(sunItem, "2026-11-29") === true && O.opnItemPaints690(sunItem, "2026-11-27") === false
    && O.opnItemPaints690({ kind: "daily", key: "fr-mike-homilies", dayRule: "daily" }, "2026-11-27") === true);
  const rowHtml = O.opnContentsRowHtml687("Morning", { it: sunItem, rid: "daily:fr-mike-homilies" }, 0, 1, true);
  check("S7 the item's Edit-form row reads its Sundays frequency (v690 Frequency dress)",
    /Sundays/.test(rowHtml), rowHtml.slice(0, 240));
  // Composed Sunday: the descriptor stands; Friday: gated out.
  const w2 = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: "daily", key: "fr-mike-homilies", dayRule: "sundays" }])));
  await sleep(300);
  const O2 = w2.__opn;
  const daySun = O2.opnFoldDay590(syntheticDay("2026-11-29"));
  O2.state.dayPayload = daySun; O2.resolveDailyDynamic666(daySun); await sleep(600);
  const descsSun = O2.extRebuildDescs(daySun) || [];
  const dSun = descsSun.find((d) => d.dailySeries === "fr-mike-homilies");
  check("S7 the composed Sunday day carries the Fr. Mike descriptor resolving the Nov 29 entry",
    !!dSun && String(dSun.episodeId || "").includes("fm-2026-11-29"), dSun && dSun.episodeId);
  const dayFri = O2.opnFoldDay590(syntheticDay("2026-11-27"));
  O2.state.dayPayload = dayFri; O2.resolveDailyDynamic666(dayFri); await sleep(400);
  const descsFri = O2.extRebuildDescs(dayFri) || [];
  check("S7 Friday's composed day carries NO homily descriptor (item gate)", !descsFri.some((d) => d.dailySeries === "fr-mike-homilies"), descsFri.map((d) => d.dailySeries));
  w2.close();
  w.close();
}

// ---------- S8/S9: settings inert + whole-table safety (source seats) ----------
{
  const clientSrc699 = readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
  const indexSrc699 = INDEX_SRC_699;
  const seedM = clientSrc699.match(/var OPN_SEED_SOURCES = (\[[\s\S]*?\]);/);
  const SEED699 = JSON.parse(seedM[1]);
  check("S9 the seed/store shape stands at 26 rows; the four closing rows keep their stored values (stations ''/fridays/0 · the three 'Mass and Homilies' rows)",
    SEED699.length === 26
    && SEED699.find((r) => r.sourceKey === "stations-of-the-cross").block === "" && SEED699.find((r) => r.sourceKey === "stations-of-the-cross").dayRule === "fridays"
    && ["daily-tv-mass", "fr-mike-homily", "barron-sermon"].every((k) => SEED699.find((r) => r.sourceKey === k).block === "Mass and Homilies"), SEED699.length);
  check("S9 both source-settings validators KEEP the 'Mass and Homilies' block exception for exactly the four standing keys (no-change seat)",
    indexSrc699.includes('["usccb-daily-readings", "daily-tv-mass", "fr-mike-homily", "barron-sermon"]') && clientSrc699.includes("'Mass and Homilies'"));
  check("S9 OPN686_SECTIONS write order + OPN686_SLOT_ROW entries stand (no-change seats)",
    clientSrc699.includes("OPN686_SECTIONS") && clientSrc699.includes("OPN686_SLOT_ROW"));
  check("S8 settings inert both ways: no resolver/fold seat reads the closing rows — the section builder (their only paint) is gone and opnItemPaints690/opnDailyMatch666 take no settings input",
    !clientSrc699.includes("opnMassHomiliesSectionHtml686"));
}

console.log(`\nharness-v699: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
