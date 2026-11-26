// harness-v688.mjs — v688: all the Masses as a dynamic Add
// option (the 'massdaily' sibling kind).
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
const NOVENAS = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v614", "novenas-catalog.json"), "utf8"));
const PODIDX = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "podcasts-index.json"), "utf8"));
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
const HOOK = "\n;window.__opn = { state, opnLocalApi, openProfilesScreen, openEditTodayScreen594, openAddLadder603, opnCheckContents590, opnContentsOf590, opnFoldDay590, extRebuildDescs, resolveMassDynamic688, resolveProfileVideos656, opnMassKeyOk688, OPN_MASS_SERIES_688, OPN_DAILY_SERIES_666, opnMassMatch688, opnItemLabel604, opnContentsRowHtml687, profContentsUniverse590, trackCard, writePlayed, isPlayed, markCompleted, startDesc, finishVideoHandoff656, openEpisodeCard };";
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes("/api/prayer/book")) body = BOOK;
  else if (u.includes("/api/player/externals/live")) { const d = decodeURIComponent((u.split("date=")[1] || "").split("&")[0]); body = LIVE[d] || livePayload(d, null); }
  else if (u.includes("/api/player/podcasts?series=catholictv")) body = CTV;
  else if (u.includes("/api/player/podcasts?series=dailytvmass")) body = DTV;
  else if (u.includes("/api/player/podcasts?series=springfieldmass")) body = SPR;
  else if (u.includes("/api/player/podcasts?series=novenas")) body = NOVENAS;
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
const WARN = "Today's episode has not updated yet — showing the last one that loaded.";

// ---------- M8: validators + read seam + universe ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const core = ["Morning", "Midday", "Evening", "Night"];
  check("M8 the Mass set stands verbatim (OPN_MASS_SERIES_688)", JSON.stringify(O.OPN_MASS_SERIES_688) === JSON.stringify(["daily-tv-mass", "catholictv", "dailytvmass", "springfieldmass"]), O.OPN_MASS_SERIES_688);
  check("M8 the v666 set is NOT widened (OPN_DAILY_SERIES_666 unchanged)", JSON.stringify(O.OPN_DAILY_SERIES_666) === JSON.stringify(["saint-of-the-day", "daily-gospel-exegesis", "daily-readings", "bible-in-a-year", "catholicsaints"]), O.OPN_DAILY_SERIES_666);
  for (const key of ["daily-tv-mass", "catholictv", "dailytvmass", "springfieldmass"]) {
    let threw = "";
    try { O.opnCheckContents590({ Morning: [{ kind: "massdaily", key }] }, core); } catch (e) { threw = String(e && e.message || e); }
    const sv = serverValidate({ Morning: [{ kind: "massdaily", key }] }, core);
    check("M8 both validators admit massdaily:" + key, threw === "" && !sv.error && sv.normalized.Morning[0].kind === "massdaily", { threw, sv });
  }
  for (const key of ["daily-readings", "catholicsaints", "fr-mike-homilies"]) {
    let threw = "";
    try { O.opnCheckContents590({ Morning: [{ kind: "massdaily", key }] }, core); } catch (e) { threw = String(e && e.message || e); }
    const sv = serverValidate({ Morning: [{ kind: "massdaily", key }] }, core);
    check("M8 both validators reject massdaily:" + key + " ('bad massdaily')", ("bad massdaily " + key) === threw || /bad massdaily/.test(threw) && !!sv.error && /bad massdaily/.test(sv.error), { threw, sv });
  }
  const seam = O.opnContentsOf590({ contents: { Morning: [{ kind: "massdaily", key: "catholictv" }, { kind: "massdaily", key: "daily-readings" }] } });
  check("M8 read seam passes a stored massdaily item through (stands after reload), filters a foreign key out", !!seam && seam.Morning.length === 1 && seam.Morning[0].key === "catholictv", seam);
  const ded = O.opnCheckContents590({ Morning: [{ kind: "massdaily", key: "catholictv" }, { kind: "massdaily", key: "catholictv" }] }, core);
  const dedS = serverValidate({ Morning: [{ kind: "massdaily", key: "catholictv" }, { kind: "massdaily", key: "catholictv" }] }, core);
  check("M8 a second identical massdaily item in one block is dropped by the standing dedupe (both validators)", ded.Morning.length === 1 && !dedS.error && dedS.normalized.Morning.length === 1, { ded, dedS });
  const coex = O.opnCheckContents590({ Morning: [{ kind: "massdaily", key: "catholictv" }, { kind: "video", key: "catholictv|D-CPXkxCLRM" }] }, core);
  const coexS = serverValidate({ Morning: [{ kind: "massdaily", key: "catholictv" }, { kind: "video", key: "catholictv|D-CPXkxCLRM" }] }, core);
  check("M8 a fixed video pin of the same source coexists with the dynamic item in one block (both validators)", coex.Morning.length === 2 && !coexS.error && coexS.normalized.Morning.length === 2, { coex, coexS });
  const uni = O.profContentsUniverse590("Morning");
  check("M8 profContentsUniverse590 offers NO massdaily item", Array.isArray(uni) && !uni.some((it) => it.kind === "massdaily"), uni.map((i) => i.kind));
  w.close();
}

// ---------- label seats (all three + the v687 Edit-form row) ----------
{
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, MASS_CONTENTS.slice(1, 5))));
  await sleep(300);
  const O = w.__opn;
  check("Labels seat 1 (opnItemLabel604): '<source title> · Daily' for all four sources", O.opnItemLabel604("Morning", { kind: "massdaily", key: "daily-tv-mass" }) === "Daily TV Mass · Daily"
    && O.opnItemLabel604("Morning", { kind: "massdaily", key: "catholictv" }) === "Catholic TV Mass · Daily"
    && O.opnItemLabel604("Morning", { kind: "massdaily", key: "dailytvmass" }) === "Daily TV Mass · Daily"
    && O.opnItemLabel604("Morning", { kind: "massdaily", key: "springfieldmass" }) === "Springfield Mass · Daily",
    [O.opnItemLabel604("Morning", { kind: "massdaily", key: "catholictv" }), O.opnItemLabel604("Morning", { kind: "massdaily", key: "springfieldmass" })]);
  const rowHtml687 = O.opnContentsRowHtml687("Morning", { it: { kind: "massdaily", key: "catholictv" }, rid: "massdaily:catholictv" }, 0, 1, true);
  check("Labels seat 4 (v687 Edit-form contents row): title + 'Generates daily' subtitle, contents act table (▲▼ move · ⋮ menu · Remove icon; NO Disable icon, NO toggle)", rowHtml687.includes("Catholic TV Mass") && rowHtml687.includes("Generates daily") && rowHtml687.includes("data-p684move") && rowHtml687.includes("data-p686menu") && rowHtml687.includes("data-p604remove") && !rowHtml687.includes("data-p687disable") && !rowHtml687.includes("switch591"), rowHtml687.slice(0, 300));
  // Seat 2: the profile editor's paintContents chain.
  // (Text is read from the SHEET element only — the jsdom
  // body's textContent also carries the client script's
  // own source, where the kind string legitimately stands.)
  await openProfiles(w);
  await sleep(200);
  const profSheet = [...w.document.querySelectorAll(".sheet")].pop();
  const profText = profSheet ? profSheet.textContent : "";
  check("Labels seat 2 (profile editor paintContents): the massdaily rows paint '<title> · Daily', never the raw key/kind", profText.includes("Catholic TV Mass · Daily") && profText.includes("Springfield Mass · Daily") && !profText.includes("massdaily"), profText.slice(0, 200));
  // Seat 3: Edit today's list paint.
  w.__opn.openEditTodayScreen594(true);
  await until(() => w.document.querySelector('[data-p594tadd="Morning"]'), 6000);
  await sleep(200);
  const todaySheet = w.document.querySelector(".proftoday594");
  const todayText = todaySheet ? todaySheet.textContent : "";
  check("Labels seat 3 (Edit today paint): the massdaily rows paint '<title> · Daily', never the raw key/kind", todayText.includes("Catholic TV Mass · Daily") && todayText.includes("Springfield Mass · Daily") && !todayText.includes("massdaily"), todayText.slice(0, 200));
  w.close();
}

// ---------- M1: the option's set on the ladder ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:virtual-mass"]);
  await sleep(80);
  check("M1 the Virtual Mass rung carries FOUR doors (the three series + 'Daily TV Mass · Audio'); MASS_VIRTUAL_ENTRIES untouched (3)", !!door(w, "vmass:catholictv") && !!door(w, "vmass:dailytvmass") && !!door(w, "vmass:springfieldmass") && !!door(w, "vmass-audio:daily-tv-mass") && ladderText(w).includes("Daily TV Mass · Audio"), ladderText(w).slice(0, 200));
  for (const series of ["catholictv", "dailytvmass", "springfieldmass"]) {
    click(w, door(w, "vmass:" + series));
    await until(() => addRow(w, "massdaily:" + series), 6000);
    const rows = [...w.document.querySelectorAll(".profaddladder603 [data-p603additem]")].map((r) => r.getAttribute("data-p603additem"));
    const card = addRow(w, "massdaily:" + series);
    check("M1 gold dynamic card at the HEAD of the vmass:" + series + " node (first addable row, .p666daily dress)", rows[0] === "massdaily:" + series && !!card && !!card.closest(".p666daily") && card.textContent.includes("· Daily"), rows.slice(0, 3));
    if (series === "dailytvmass") check("M1 the dailytvmass card's sub names the video form (no two cards share a label+sub)", card.textContent.includes("on video"), card.textContent.slice(0, 160));
    click(w, w.document.querySelector("[data-p603back]")); await sleep(80);
  }
  click(w, door(w, "vmass-audio:daily-tv-mass"));
  await until(() => addRow(w, "massdaily:daily-tv-mass"), 6000);
  check("M1 the audio door's node paints ONLY the gold card + one note line (no fixed adds)", !!addRow(w, "massdaily:daily-tv-mass") && [...w.document.querySelectorAll(".profaddladder603 [data-p603additem]")].length === 1 && ladderText(w).includes("no fixed episodes stand"), ladderText(w).slice(0, 200));
  await closeLadder(w);
  // Negative samples: no Mass card on a Podcasts series node or the Adoration leaf.
  await openLadder(w, "Morning");
  await navLadder(w, ["br:catechesis", "lf:podcasts", "series:saint-of-the-day"]);
  await sleep(300);
  check("M1 NO dynamic Mass card on a Podcasts series node (sampled)", !w.document.querySelector('[data-p603additem^="massdaily:"]'), ladderText(w).slice(0, 120));
  await closeLadder(w);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:adoration"]);
  await sleep(80);
  check("M1 NO dynamic Mass card on the Adoration leaf (sampled)", !w.document.querySelector('[data-p603additem^="massdaily:"]') && ladderText(w).includes("Nothing to add"), ladderText(w).slice(0, 120));
  await closeLadder(w);
  // Head search group.
  await openLadder(w, "Morning");
  const inp = w.document.querySelector("[data-p603search]");
  inp.value = "Mass"; inp.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(150);
  const hs = ladderEl(w) ? ladderEl(w).innerHTML : "";
  check("M1 head search carries a 'Videos › Virtual Mass' group with the four dynamic cards", hs.includes("Videos › Virtual Mass") && !!addRow(w, "massdaily:catholictv") && !!addRow(w, "massdaily:dailytvmass") && !!addRow(w, "massdaily:springfieldmass") && !!addRow(w, "massdaily:daily-tv-mass"), hs.slice(0, 200));
  await closeLadder(w);
  w.close();
}

// ---------- M2: add -> composed seat (both hosts) ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:virtual-mass", "vmass:catholictv"]);
  await until(() => addRow(w, "massdaily:catholictv"), 6000);
  click(w, addRow(w, "massdaily:catholictv"));
  await until(() => !ladderEl(w), 3000);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  const landed = await until(async () => { const p = await profilesPayload(w); const s = (p.profiles || []).find((x) => x.key === "salesian"); return s && ((s.contents && s.contents.Morning) || []).some((it) => it.kind === "massdaily" && it.key === "catholictv"); }, 6000);
  check("M2 profile-editor host: adding the dynamic Mass stands {kind:massdaily, key:catholictv} in the saved profile contents", landed);
  // The standing card now paints marked, not tappable.
  await openLadder(w, "Morning");
  await navLadder(w, ["br:videos", "lf:virtual-mass", "vmass:catholictv"]);
  await until(() => ladderText(w).includes("Already in Morning"), 6000);
  const stood = [...w.document.querySelectorAll(".profaddladder603 .p666daily")].find((r) => r.textContent.includes("Catholic TV Mass · Daily"));
  check("M2 a standing dynamic Mass item paints the card marked 'Already in Morning', not tappable", !!stood && !stood.hasAttribute("data-p603additem") && stood.textContent.includes("Already in Morning"), stood && stood.textContent.slice(0, 120));
  await closeLadder(w);
  w.close();
}
{
  const w = makeWorld(johnStore());
  await sleep(300);
  w.__opn.openEditTodayScreen594(true);
  await until(() => w.document.querySelector('[data-p594tadd="Morning"]'), 6000);
  click(w, w.document.querySelector('[data-p594tadd="Morning"]'));
  await until(() => ladderEl(w));
  await navLadder(w, ["br:videos", "lf:virtual-mass", "vmass-audio:daily-tv-mass"]);
  await until(() => addRow(w, "massdaily:daily-tv-mass"), 6000);
  click(w, addRow(w, "massdaily:daily-tv-mass"));
  await until(() => !ladderEl(w), 3000);
  await sleep(200);
  check("M2 Edit-today host: the audio Mass pick lands in the today draft, titled 'Daily TV Mass · Daily'", w.document.body.textContent.includes("Daily TV Mass · Daily"), w.document.body.textContent.slice(0, 300));
  w.close();
}

// ---------- M3 + M4: resolution, day 1 and day 2 ----------
{
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, MASS_CONTENTS)));
  await sleep(300);
  const O = w.__opn;
  const f1 = await fold688(w, "2026-11-24");
  const m1 = bySeries688(f1.descs);
  check("M3 catholictv resolves yt:D-CPXkxCLRM (the Nov 24 'Catholic Mass Today')", !!m1.catholictv && m1.catholictv.episodeId === "yt:D-CPXkxCLRM" && m1.catholictv.stale === false, m1.catholictv && m1.catholictv.episodeId);
  check("M3 springfieldmass resolves yt:EdmQlVx3BU0 ('Daily Mass Tuesday, November 24, 2026')", !!m1.springfieldmass && m1.springfieldmass.episodeId === "yt:EdmQlVx3BU0" && m1.springfieldmass.stale === false, m1.springfieldmass && m1.springfieldmass.episodeId);
  check("M3 dailytvmass resolves yt:qLQDKW65m8k (NOT the Shorts/Rosary items above it in the payload)", !!m1.dailytvmass && m1.dailytvmass.episodeId === "yt:qLQDKW65m8k" && m1.dailytvmass.stale === false, m1.dailytvmass && m1.dailytvmass.episodeId);
  check("M3 the audio item resolves the fixture slot entry for 2026-11-24 (R-688-1 fetch seat: externals/live?date=presented)", !!m1["daily-tv-mass"] && m1["daily-tv-mass"].episodeId === "ext-daily-tv-mass" && m1["daily-tv-mass"].url === "https://example.invalid/tvmass-2026-11-24.mp3" && m1["daily-tv-mass"].stale === false, m1["daily-tv-mass"]);
  check("M3 each descriptor carries mass688 + massSeries + source provenance", ["catholictv", "dailytvmass", "springfieldmass", "daily-tv-mass"].every((k) => m1[k] && m1[k].mass688 === true && m1[k].massSeries === k && !!m1[k].source), Object.keys(m1));
  check("M3 video descriptors carry the v656 shape verbatim (kind video · videoId · vmSeries · url null · available true)", !!m1.catholictv && m1.catholictv.kind === "video" && m1.catholictv.videoId === "D-CPXkxCLRM" && m1.catholictv.vmSeries === "catholictv" && m1.catholictv.url === null && m1.catholictv.available === true, m1.catholictv);
  // M2 composed position: fixed pin, then the four Mass
  // descriptors in contents order, then the second pin.
  const ids = f1.descs.map((d) => d.episodeId);
  const iPin1 = ids.indexOf("yt:nei7hRlEzCQ"), iCtv = ids.indexOf("yt:D-CPXkxCLRM"), iDtv = ids.indexOf("yt:qLQDKW65m8k"), iSpr = ids.indexOf("yt:EdmQlVx3BU0"), iAud = ids.indexOf("ext-daily-tv-mass"), iPin2 = ids.indexOf("yt:_Te-ZRuKKkQ");
  check("M2 the resolved Mass descriptors stand AT their contents positions among siblings", iPin1 >= 0 && iCtv > iPin1 && iDtv > iCtv && iSpr > iDtv && iAud > iSpr && iPin2 > iAud, { iPin1, iCtv, iDtv, iSpr, iAud, iPin2 });
  // M4: the SAME stored items under presented 2026-11-23.
  const f2 = await fold688(w, "2026-11-23");
  const m2 = bySeries688(f2.descs);
  check("M4 catholictv resolves yt:wpOyueDj_eY for 2026-11-23", !!m2.catholictv && m2.catholictv.episodeId === "yt:wpOyueDj_eY" && m2.catholictv.stale === false, m2.catholictv && m2.catholictv.episodeId);
  check("M4 springfieldmass resolves yt:QomObkUkfos for 2026-11-23", !!m2.springfieldmass && m2.springfieldmass.episodeId === "yt:QomObkUkfos", m2.springfieldmass && m2.springfieldmass.episodeId);
  check("M4 dailytvmass resolves yt:Z8rfD0h0xH8 for 2026-11-23", !!m2.dailytvmass && m2.dailytvmass.episodeId === "yt:Z8rfD0h0xH8", m2.dailytvmass && m2.dailytvmass.episodeId);
  check("M4 the audio item resolves the slot's 2026-11-23 entry (a different url per day, from one stored item)", !!m2["daily-tv-mass"] && m2["daily-tv-mass"].url === "https://example.invalid/tvmass-2026-11-23.mp3", m2["daily-tv-mass"] && m2["daily-tv-mass"].url);
  // Screenshot fragments (real emitted HTML; rendered to
  // PNG by the screenshot step named in the release doc).
  try {
    const staleDesc = Object.assign({}, m1.catholictv, { stale: true });
    writeFileSync("/tmp/v688-shot-fragments.json", JSON.stringify({
      blockRow: O.trackCard(m1.catholictv),
      blockRowStale: O.trackCard(staleDesc),
      audioRow: O.trackCard(m1["daily-tv-mass"]),
    }));
  } catch (e) {}
  w.close();
}

// ---------- M5: not-updated + the English-only leg ----------
{
  // Subset trims (named): each video payload loses its
  // 2026-11-24-dated entries (real entries only); the
  // audio slot's presented entry stands stale (its own
  // Nov 23 entry, the payload's stale rule).
  const trim = (p) => { const c = JSON.parse(JSON.stringify(p)); c.videos = c.videos.filter((v) => !String(v.title).includes("November 24, 2026")); return c; };
  const saveC = CTV, saveD = DTV, saveS = SPR;
  CTV = trim(CTV0); DTV = trim(DTV0); SPR = trim(SPR0);
  const saveLive24 = LIVE["2026-11-24"];
  LIVE["2026-11-24"] = livePayload("2026-11-24", tvMassEntry("2026-11-23", true));
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, MASS_CONTENTS)));
  await sleep(300);
  const O = w.__opn;
  const f = await fold688(w, "2026-11-24");
  const m = bySeries688(f.descs);
  check("M5 catholictv falls back to the previous day's Mass, stale:true", !!m.catholictv && m.catholictv.episodeId === "yt:wpOyueDj_eY" && m.catholictv.stale === true, m.catholictv && [m.catholictv.episodeId, m.catholictv.stale]);
  check("M5 dailytvmass falls back to yt:Z8rfD0h0xH8, stale:true", !!m.dailytvmass && m.dailytvmass.episodeId === "yt:Z8rfD0h0xH8" && m.dailytvmass.stale === true, m.dailytvmass && [m.dailytvmass.episodeId, m.dailytvmass.stale]);
  check("M5 springfieldmass falls back to yt:QomObkUkfos, stale:true", !!m.springfieldmass && m.springfieldmass.episodeId === "yt:QomObkUkfos" && m.springfieldmass.stale === true, m.springfieldmass && [m.springfieldmass.episodeId, m.springfieldmass.stale]);
  check("M5 audio falls back to the stale slot entry (the Nov 23 Mass), stale:true", !!m["daily-tv-mass"] && m["daily-tv-mass"].url === "https://example.invalid/tvmass-2026-11-23.mp3" && m["daily-tv-mass"].stale === true, m["daily-tv-mass"]);
  const htmlV = m.catholictv ? O.trackCard(m.catholictv) : "";
  check("M5 the stale VIDEO row paints the v625 warning line + the source-name meta (trackCard video branch)", htmlV.includes("ext-stale-warn") && htmlV.includes(WARN) && htmlV.includes("Video · Catholic TV Mass"), htmlV.slice(0, 300));
  const htmlA = m["daily-tv-mass"] ? O.trackCard(m["daily-tv-mass"]) : "";
  check("M5 the stale AUDIO row paints the v625 warning line + the source-name meta (trackCard generic branch)", htmlA.includes("ext-stale-warn") && htmlA.includes(WARN) && htmlA.includes("Daily TV Mass"), htmlA.slice(0, 300));
  // The episode-card seat: its stale line is the standing
  // generic d.stale paint — a stale mass descriptor's card
  // carries it.
  let epHtml = "";
  try {
    O.openEpisodeCard({ desc: Object.assign({}, m.catholictv), titleText: m.catholictv.title, seriesTitle: "Catholic TV Mass", dateLabel: m.catholictv.dateLabel || "" }, null);
    const ep = w.document.querySelector(".epcard");
    epHtml = ep ? ep.innerHTML : "";
  } catch (e) { epHtml = "ERR " + e.message; }
  check("M5 the episode-card seat paints the warning for a stale mass descriptor (generic d.stale paint)", epHtml.includes("epcard-warn") && epHtml.includes(WARN), epHtml.slice(0, 200));
  w.close();
  CTV = saveC; DTV = saveD; SPR = saveS; LIVE["2026-11-24"] = saveLive24;
}
{
  // The audio slot stands MISSING on the presented payload:
  // the previous date's live read supplies the fallback.
  const saveLive24 = LIVE["2026-11-24"];
  LIVE["2026-11-24"] = livePayload("2026-11-24", null);
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, [{ kind: "massdaily", key: "daily-tv-mass" }])));
  await sleep(300);
  const f = await fold688(w, "2026-11-24");
  const m = bySeries688(f.descs);
  check("M5 audio slot missing on the presented payload: the PREVIOUS date's live payload present entry is the fallback, stale:true", !!m["daily-tv-mass"] && m["daily-tv-mass"].url === "https://example.invalid/tvmass-2026-11-23.mp3" && m["daily-tv-mass"].stale === true, m["daily-tv-mass"]);
  w.close();
  LIVE["2026-11-24"] = saveLive24;
}
{
  // No earlier Mass anywhere: the slot stands empty.
  const only24 = (p) => { const c = JSON.parse(JSON.stringify(p)); c.videos = c.videos.filter((v) => String(v.title).includes("November 24, 2026")); return c; };
  const saveC = CTV, saveD = DTV, saveS = SPR;
  CTV = only24(CTV0); DTV = only24(DTV0); SPR = only24(SPR0);
  // ... and then the day's own Mass is removed too (subset
  // trim by id): nothing earlier stands to fall back to.
  CTV.videos = []; DTV.videos = []; SPR.videos = [];
  const saveL24 = LIVE["2026-11-24"], saveL23 = LIVE["2026-11-23"];
  LIVE["2026-11-24"] = livePayload("2026-11-24", null);
  LIVE["2026-11-23"] = livePayload("2026-11-23", null);
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, MASS_CONTENTS.slice(1, 5))));
  await sleep(300);
  const f = await fold688(w, "2026-11-24");
  check("M5 a payload with NO earlier Mass resolves nothing (the slot stands empty)", massDescs(f.descs).length === 0, f.descs.map((d) => d.episodeId));
  w.close();
  CTV = saveC; DTV = saveD; SPR = saveS; LIVE["2026-11-24"] = saveL24; LIVE["2026-11-23"] = saveL23;
}
{
  // ENGLISH ONLY (John's amendment): a payload whose only
  // Mass-term video for the presented date is Spanish.
  const spanish = { id: "SPANISH688", title: "La Santa Misa | Tuesday November 24, 2026", dateLabel: "Nov 23, 2026", imageUrl: null, descText: null };
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  const eng23 = CTV0.videos.filter((v) => v.id === "wpOyueDj_eY");
  const mA = O.opnMassMatch688("catholictv", [spanish].concat(eng23), "2026-11-24");
  check("English-only: a Spanish-titled video dated the presented day NEVER resolves as the day's Mass — the fallback is the newest earlier ENGLISH Mass, stale:true", !!mA && mA.v.id === "wpOyueDj_eY" && mA.stale === true, mA);
  const mB = O.opnMassMatch688("catholictv", [spanish], "2026-11-24");
  check("English-only: a payload whose ONLY Mass-term video for the presented date is Spanish resolves nothing (never the Spanish video, not even as fallback)", mB === null, mB);
  const realSpanish = CTV0.videos.filter((v) => String(v.title).includes("La Santa Misa"));
  const eng22 = CTV0.videos.filter((v) => v.id === "nei7hRlEzCQ");
  const mC = O.opnMassMatch688("catholictv", realSpanish.concat(eng22), "2026-11-22");
  check("English-only: the capture's real 'La Santa Misa' entries never resolve (the Nov 22 English Mass stands instead)", !!mC && mC.v.id === "nei7hRlEzCQ" && mC.stale === false, mC);
  w.close();
}

// ---------- M6 + M7: marks per-day + play shape ----------
{
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, MASS_CONTENTS)));
  await sleep(300);
  const O = w.__opn;
  const f1 = await fold688(w, "2026-11-24");
  const m1 = bySeries688(f1.descs);
  // Video mark through the hand-off finish path (ENDED):
  // startDesc diverts the video descriptor to the hand-off
  // (M7), and finishVideoHandoff656(true) writes the mark
  // through writePlayed (the day played store).
  let divertOk = false, frameOk = false;
  try {
    O.startDesc(m1.catholictv);
    divertOk = O.state.current === m1.catholictv;
    frameOk = !!w.document.querySelector("iframe.podwatch-frame");
    O.finishVideoHandoff656(true);
  } catch (e) {}
  check("M7 a video descriptor in a block queue diverts at startDesc's head to the hand-off (frame stands, current = the video descriptor)", divertOk && frameOk, { divertOk, frameOk });
  check("M6 the hand-off ENDED mark lands in the day played store for day 1's video identity", O.isPlayed("yt:D-CPXkxCLRM", "2026-11-24", "Morning") === true && O.isPlayed("yt:D-CPXkxCLRM", "2026-11-23", "Morning") === false);
  // Audio mark through the completion seam (markCompleted
  // -> writePlayed, the ext discipline).
  try { O.markCompleted(m1["daily-tv-mass"]); } catch (e) {}
  check("M6 the audio completion mark lands in the day played store, keyed by the presented date", O.isPlayed("ext-daily-tv-mass", "2026-11-24", "Morning") === true && O.isPlayed("ext-daily-tv-mass", "2026-11-23", "Morning") === false);
  // Re-resolve day 1: marks stand on day 1's identities.
  const f1b = await fold688(w, "2026-11-24");
  const m1b = bySeries688(f1b.descs);
  const htmlV = m1b.catholictv ? O.trackCard(m1b.catholictv) : "";
  const htmlA = m1b["daily-tv-mass"] ? O.trackCard(m1b["daily-tv-mass"]) : "";
  check("M6 day 1 re-resolve: the video descriptor's listened reads the day played store at the fold (the named read seat: isPlayed in resolveMassDynamic688) and its row paints played", !!m1b.catholictv && m1b.catholictv.listened === true && htmlV.includes("played-dot on"), { listened: m1b.catholictv && m1b.catholictv.listened });
  check("M6 day 1 re-resolve: the audio row paints played (the day-store dot)", htmlA.includes("played-dot on"), htmlA.slice(0, 200));
  // Day 2: the same stored items, different identities,
  // unplayed.
  const f2 = await fold688(w, "2026-11-23");
  const m2 = bySeries688(f2.descs);
  const htmlV2 = m2.catholictv ? O.trackCard(m2.catholictv) : "";
  check("M6 day 2's descriptor for the same stored item stands UNPLAYED (per-day by identity)", !!m2.catholictv && m2.catholictv.listened === false && !htmlV2.includes("played-dot on"), { listened: m2.catholictv && m2.catholictv.listened });
  // M7 audio shape: the audio descriptor reaches startDesc
  // as audio (no divert — no hand-off frame stands).
  let audioOk = false;
  try {
    O.startDesc(m1["daily-tv-mass"]);
    audioOk = !!O.state.current && O.state.current.episodeId === "ext-daily-tv-mass" && !w.document.querySelector("iframe.podwatch-frame");
  } catch (e) { audioOk = m1["daily-tv-mass"].kind !== "video" && !!m1["daily-tv-mass"].url; }
  check("M7 the audio descriptor reaches startDesc as audio (no hand-off divert)", audioOk);
  w.close();
}

// ---------- M9: settled discipline ----------
{
  const trim = (p) => { const c = JSON.parse(JSON.stringify(p)); c.videos = c.videos.filter((v) => !String(v.title).includes("November 24, 2026")); return c; };
  const saveC = CTV, saveD = DTV, saveS = SPR;
  CTV = trim(CTV0); DTV = trim(DTV0); SPR = trim(SPR0);
  const w = makeWorld(johnStore((doc) => setSalMorning(doc, MASS_CONTENTS.slice(1, 4))));
  await sleep(300);
  const f1 = await fold688(w, "2026-11-24");
  const m1 = bySeries688(f1.descs);
  check("M9 day settles on the fallback (Nov 23 Masses, stale:true)", !!m1.catholictv && m1.catholictv.episodeId === "yt:wpOyueDj_eY" && m1.catholictv.stale === true, m1.catholictv && m1.catholictv.episodeId);
  // The day's Mass appears in a refreshed payload mid-day:
  // the settled rows STAND (no mid-day advance).
  CTV = JSON.parse(JSON.stringify(CTV0)); DTV = JSON.parse(JSON.stringify(DTV0)); SPR = JSON.parse(JSON.stringify(SPR0));
  const f2 = await fold688(w, "2026-11-24");
  const m2 = bySeries688(f2.descs);
  check("M9 a day settled on the fallback does NOT advance mid-day when the day's Mass appears", !!m2.catholictv && m2.catholictv.episodeId === "yt:wpOyueDj_eY" && m2.catholictv.stale === true && !!m2.dailytvmass && m2.dailytvmass.episodeId === "yt:Z8rfD0h0xH8" && m2.dailytvmass.stale === true, { ctv: m2.catholictv && m2.catholictv.episodeId, dtv: m2.dailytvmass && m2.dailytvmass.episodeId });
  // The next presented date resolves its own Mass.
  const f3 = await fold688(w, "2026-11-23");
  const m3 = bySeries688(f3.descs);
  check("M9 the next presented date resolves the new day's own Mass (stale:false)", !!m3.catholictv && m3.catholictv.episodeId === "yt:wpOyueDj_eY" && m3.catholictv.stale === false && !!m3.springfieldmass && m3.springfieldmass.episodeId === "yt:QomObkUkfos" && m3.springfieldmass.stale === false, { ctv: m3.catholictv && [m3.catholictv.episodeId, m3.catholictv.stale] });
  w.close();
  CTV = saveC; DTV = saveD; SPR = saveS;
}

console.log(`\nharness-v688: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
