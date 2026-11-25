// harness-v670.mjs — v670: office source by Add + a toggle
// in the edit form; the global choice + Both retire whole.
//
// Modeled on harness-v666.mjs (the device-mode world: the
// rendered client from source driven in jsdom over John's
// profile document, production fixtures; the server
// validator extracted standalone, the v603 recipe).
//
// Fixtures (Improvement D — production sources, named):
//  - the ext_resolutions pair shape from harness-v650's
//    LIVE650 fixture (the REAL 2026-11-24 live payload
//    shape): both labeled slots with BOTH sides standing —
//    standing = Divine Office (durationSec Morning 1091 /
//    Evening 880), side2 = Sing the Hours (1034 / 869) —
//    plus a missing-named-side variant day (no backup; a
//    Sing-the-Hours-only record).
//  - John's profile document (v589 import, podcastListens
//    stripped as in v603/v611/v614/v666): the Salesian Way
//    standing pick, NO stored contents on any profile —
//    at legacy choice sth · do · both variants.
//  - app/tests/fixtures-v603 (book · podcasts index).
//
// Legs (Plan §4): (a) No Both anywhere · (b) migration
// exactness · (c) the Add pick · (d) the toggle ·
// (e) retirements read zero · (f) missing-side fallback ·
// V validator parity (server validateProfileContents vs
// client opnCheckContents590, extracted standalone, same
// fixture set, identical outputs) · M the migration's
// non-office stored block survives byte-identical.
// (g) screenshots stand at Review (the release doc §1:
// screenshots of the Add pick + the toggle stand in the
// doc at Review).
//
// harness-v650 tally note (Plan §4): its choice-reading
// legs are RETIRED BY NAME with this release — S2 (the
// drop down at the Edit-form seat) · S3 (the paint-only
// change handler) · S5 (the opnOfficeChoice650 migration
// reader as governing) · G1 (default 'sth' through the
// store) · G2 (setting 'do') · G3 + G10-both (setting
// 'both': two tracks, _side650 identity, per-side marks
// under Both) · G5 (in-session re-paint through the drop
// down) · G6 (paints under every SETTING) · G7 (the
// v650-store migration at first read) · G8 (contents
// duplicate × 'Both') · G9 (engine hand-off under 'both').
// Its PER-SIDE MACHINERY legs stand and must stay green:
// S1 · S4 (extAudioKey650 per-side keys) · G1's record-side
// + per-side-bytes assertions · G4 · G4b · G4c.
//
// Run: node app/worker/harness-v670.mjs
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
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };

// ---------- fixtures ----------
const DO_IMG = "https://do.example/divine-office-logo.jpg";
const STH_IMG = "https://sth.example/sing-the-hours-channel.jpg";
const DO_MP = "https://do.example/divine-1124-mp.mp3";
const DO_EP = "https://do.example/divine-1124-ep.mp3";
const STH_MP = "https://sth.example/lauds-1124.mp3";
const STH_EP = "https://sth.example/vespers-1124.mp3";
// The resolved slot record in state.extSlots shape (the
// v650 record-side shape): standing side whole + side2.
function slotRec(slotId, titleBase, doUrl, sthUrl, doDur, sthDur) {
  return { slotId, state: "present", title: titleBase + " - Divine Office", source: "Divine Office", enclosureUrl: doUrl, streamUrl: doUrl, durationSec: doDur, sizeBytes: 1000000, imageUrl: DO_IMG,
    side2: { state: "present", title: titleBase + " - Sing the Hours", source: "Sing the Hours", enclosureUrl: sthUrl, streamUrl: sthUrl, durationSec: sthDur, sizeBytes: 900000, imageUrl: STH_IMG } };
}
const REC_MP = slotRec("ext-morning-prayer", "Morning Prayer", DO_MP, STH_MP, 1091, 1034);
const REC_EP = slotRec("ext-evening-prayer", "Evening Prayer", DO_EP, STH_EP, 880, 869);
const REC_MP_DO_ONLY = { slotId: "ext-morning-prayer", state: "present", title: "Morning Prayer - Divine Office", source: "Divine Office", enclosureUrl: DO_MP, streamUrl: DO_MP, durationSec: 1091, imageUrl: DO_IMG };
const REC_MP_STH_ONLY = { slotId: "ext-morning-prayer", state: "present", title: "Morning Prayer - Sing the Hours", source: "Sing the Hours", enclosureUrl: STH_MP, streamUrl: STH_MP, durationSec: 1034, imageUrl: STH_IMG };
const LIVE650 = { slots: [
  { slotId: "ext-morning-prayer", state: "present", title: "Morning Prayer - Divine Office", streamUrl: DO_MP, durationSec: 1091, sizeBytes: 1000000, imageUrl: DO_IMG, source: "Divine Office", backup: { streamUrl: STH_MP, source: "Sing the Hours", title: "Morning Prayer - Sing the Hours", imageUrl: STH_IMG, durationSec: 1034 } },
  { slotId: "ext-evening-prayer", state: "present", title: "Evening Prayer - Divine Office", streamUrl: DO_EP, durationSec: 880, sizeBytes: 1000000, imageUrl: DO_IMG, source: "Divine Office", backup: { streamUrl: STH_EP, source: "Sing the Hours", title: "Evening Prayer - Sing the Hours", imageUrl: STH_IMG, durationSec: 869 } },
]};
check("F fixture: the production-shaped pair stands — both labeled slots, both sides, durations 1091/1034 + 880/869",
  REC_MP.side2.durationSec === 1034 && REC_MP.durationSec === 1091 && REC_EP.side2.durationSec === 869 && REC_EP.durationSec === 880);

const BOOK = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "book.json"), "utf8"));
const PODIDX = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "podcasts-index.json"), "utf8"));
const JOHN_FULL = JSON.parse(readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json"), "utf8"));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = "opn-personal-data-v1";
const CHOICE_KEY = "opn-office-choice-v650";
const MIG_KEY = "opn-office-mig-v670";
check("F fixture: John's shape — Salesian standing pick, no stored contents on any profile",
  JOHN.sections.profiles.standingKey === "salesian" && JOHN.sections.profiles.list.every((p) => !p.contents));

// ---------- sources ----------
const clientSrc = readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
const uiSrc = readFileSync(path.join(APP, "worker", "src", "ui.ts"), "utf8");
const indexSrc = readFileSync(path.join(APP, "worker", "src", "index.ts"), "utf8");
function renderJs(src) { const a = src.indexOf("= `") + 3; const b = src.indexOf("\n`;", a); return vm.runInContext("`" + src.slice(a, b) + "`", vm.createContext({})); }
const appJs = renderJs(clientSrc);
const shellStart = uiSrc.indexOf("<!DOCTYPE html>");
const SHELL = vm.runInContext("`" + uiSrc.slice(shellStart, uiSrc.indexOf("`;", shellStart)) + "`", vm.createContext({}));
const SEED_ROWS = (() => {
  const at = appJs.indexOf("var OPN_SEED_SOURCES = ");
  const end = appJs.indexOf("];", at);
  return vm.runInContext("(" + appJs.slice(at + "var OPN_SEED_SOURCES = ".length, end + 1) + ")", vm.createContext({}));
})();

// ---------- server validator extraction (v603 recipe, v670 shape) ----------
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
    ['let side670: string | undefined;', 'let side670;'],
    ['list.push(side670 ? { kind: kind as string, key: key as string, side: side670 } : { kind: kind as string, key: key as string });', 'list.push(side670 ? { kind: kind, key: key, side: side670 } : { kind: kind, key: key });'],
  ];
  for (const [a, b] of reps) { if (!f.includes(a)) throw new Error("server validate shape moved: " + a.slice(0, 60)); f = f.split(a).join(b); }
  return f;
}
let serverValidate = null;
try { serverValidate = new Function(stripServerValidate(indexSrc) + "\nreturn validateProfileContents;")(); } catch (e) { check("V server validator extracts standalone (v670 shape)", false, e.message); }

// ---------- client validator extraction (standalone, its EXT_TOKENS dep) ----------
function grabClientFn(src, name) {
  const at = src.indexOf("function " + name + "(");
  if (at < 0) return "";
  let depth = 0, i = src.indexOf("{", at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (!depth) return src.slice(start, i + 1); } }
  return "";
}
let clientValidate = null;
try {
  const extTok = (() => { const at = appJs.indexOf("var EXT_TOKENS = {"); const end = appJs.indexOf("};", at); return appJs.slice(at, end + 2); })();
  const opnErr = "function opnErr(status, message) { var e = new Error(message); e.status = status; return e; }";
  const dayKey = "var OPN_DAY_KEY_611 = 'daily-gospel-exegesis'; function opnDailyKeyOk666(k) { return ['saint-of-the-day','daily-gospel-exegesis','daily-readings','bible-in-a-year','catholicsaints'].indexOf(k) >= 0; } function opnEpisodeKeyOk614(key) { if (typeof key !== 'string') return false; var i = key.indexOf('|'); return i > 0 && i < key.length - 1; } var MASS_VIRTUAL_ENTRIES = [{series:'catholictv'},{series:'dailytvmass'},{series:'springfieldmass'}]; function opnPodcastsVideoSeries663(s) { return null; } function opnVideoKeyOk656(key) { if (!opnEpisodeKeyOk614(key)) return false; var series = key.slice(0, key.indexOf('|')); return MASS_VIRTUAL_ENTRIES.some(function (e) { return e.series === series; }); }";
  clientValidate = new Function(extTok + "\n" + opnErr + "\n" + dayKey + "\n" + grabClientFn(appJs, "opnCheckContents590") + "\nreturn opnCheckContents590;")();
} catch (e) { check("V client validator extracts standalone", false, e.message); }

// ---------- world ----------
const HOOK = "\n;window.__opn = { state, opn604, opnLocalApi, opnLoadRes604, opnEnsureStandings601, opnOfficeMig670: (typeof opnOfficeMig670 === 'function') ? opnOfficeMig670 : null, opnCheckContents590, extRebuildDescs, extPaintSide670: (typeof extPaintSide670 === 'function') ? extPaintSide670 : null, extPaintTracks650, extAudioKey650, opnStandingContents597, opnItemLabel604, opnEditGroupHtml609, opnFlipSide670: (typeof opnFlipSide670 === 'function') ? opnFlipSide670 : null, openAddLadder603, opnMaterialize604, nativeContractItem, descCardKey };";
let LIVE_NOW = LIVE650;
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes("/api/prayer/book")) body = BOOK;
  else if (u.includes("/api/player/source-settings")) body = { sources: SEED_ROWS, version: 7 };
  else if (u.includes("/api/player/externals/live")) body = LIVE_NOW;
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
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(undefined), put: () => Promise.resolve(), delete: () => Promise.resolve(true), keys: () => Promise.resolve([]) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement("script");
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function johnStore(mut, extra) {
  const doc = JSON.parse(JSON.stringify(JOHN));
  if (mut) mut(doc);
  const st = {}; st[DATA_KEY] = JSON.stringify(doc);
  return Object.assign(st, extra || {});
}
function dumpStore(w) { const out = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); out[k] = w.localStorage.getItem(k); } return out; }
async function profilesPayload(w) { return w.__opn.opnLocalApi("/api/prayer/profiles", {}, "device"); }
function standSlots(w) {
  const O = w.__opn;
  O.state.ownStanding = [];
  O.state.extStanding = [
    { slotId: "ext-morning-prayer", title: "Morning Prayer", block: "Morning", sortOrder: 1 },
    { slotId: "ext-evening-prayer", title: "Evening Prayer", block: "Evening", sortOrder: 1 },
  ];
  O.state.ownSlots = {};
  O.state.extSlots = { "ext-morning-prayer": JSON.parse(JSON.stringify(REC_MP)), "ext-evening-prayer": JSON.parse(JSON.stringify(REC_EP)) };
}
function syntheticDay(date, contents) {
  const blocks = ["Morning", "Midday", "Evening", "Night"].map((bl) => ({ block: bl, label: bl, caption: "", tracks: [], trackCount: 0 }));
  return { ok: true, date, presentedDay: date, dateLabel: date, blocks, additions: [], profile: contents ? { contents } : null, readingsSeat: null, episodes: [] };
}
const DATE = "2026-11-25";
function morningDescs(w, contents) {
  const O = w.__opn;
  const day = syntheticDay(DATE, contents);
  const descs = O.extRebuildDescs(day) || O.state.dayDescs || [];
  return descs.filter((d) => d.episodeId === "ext-morning-prayer");
}

// ---------- V: validator parity ----------
{
  const core = ["Morning", "Midday", "Evening", "Night"];
  const cases = [
    { Morning: [{ kind: "source", key: "ext-morning-prayer", side: "do" }] },
    { Morning: [{ kind: "source", key: "ext-morning-prayer", side: "sth" }] },
    { Evening: [{ kind: "source", key: "ext-evening-prayer", side: "both" }] },
    { Evening: [{ kind: "source", key: "ext-evening-prayer" }] },
    { Morning: [{ kind: "source", key: "ext-morning-prayer", side: "bogus" }] },
    { Morning: [{ kind: "source", key: "daily-rosary", side: "do" }] },
    { Morning: [{ kind: "source", key: "ext-invitatory", side: "do" }] },
    { Morning: [{ kind: "prayer", key: "our-father" }, { kind: "seat", key: "daily-readings" }] },
    { Morning: [{ kind: "source", key: "ext-morning-prayer", side: "do" }, { kind: "source", key: "ext-morning-prayer", side: "sth" }] },
    { Morning: [{ kind: "source", key: "daily-rosary" }, { kind: "source", key: "daily-rosary" }] },
    { Morning: [{ kind: "daily", key: "daily-readings" }, { kind: "course", key: "bible-in-a-year" }, { kind: "day", key: "daily-gospel-exegesis" }] },
    { Morning: [{ kind: "seat", key: "bogus" }] },
    { Morning: [{ kind: "daily", key: "bogus" }] },
    { Novenas: [{ kind: "all-novenas" }, { kind: "novena", key: "st-jude" }] },
  ];
  let parity = !!serverValidate && !!clientValidate, detail = "";
  if (parity) {
    for (const c of cases) {
      let sv, cv;
      try { const r = serverValidate(JSON.parse(JSON.stringify(c)), core); sv = r.error ? { error: r.error } : r.normalized; } catch (e) { sv = { threw: String(e.message || e) }; }
      try { cv = clientValidate(JSON.parse(JSON.stringify(c)), core); if (cv === undefined) cv = null; } catch (e) { cv = { error: String(e.message || e) }; }
      // Error WORDING differs by design across the mirror
      // (server err() strings vs client opnErr messages) —
      // parity is: both accept with identical normalized
      // output, or both reject.
      const sOk = sv && !sv.error && !sv.threw, cOk = cv && !cv.error;
      if (sOk !== cOk) { parity = false; detail = "accept/reject split on " + JSON.stringify(c); break; }
      if (sOk && JSON.stringify(sv) !== JSON.stringify(cv)) { parity = false; detail = "normalized split on " + JSON.stringify(c) + " :: " + JSON.stringify(sv) + " vs " + JSON.stringify(cv); break; }
    }
  }
  check("V validator parity: server + client mirrors agree on the whole fixture set (accept/reject + identical normalized output)", parity, detail);
  if (serverValidate) {
    const r1 = serverValidate({ Morning: [{ kind: "source", key: "ext-morning-prayer", side: "do" }] }, core);
    const r2 = serverValidate({ Morning: [{ kind: "source", key: "ext-morning-prayer", side: "both" }] }, core);
    const r3 = serverValidate({ Morning: [{ kind: "source", key: "daily-rosary", side: "do" }] }, core);
    check("V the side branch itself: 'do' preserved · 'both' normalizes to 'sth' · a side on a non-labeled source is dropped byte-identically",
      r1.normalized.Morning[0].side === "do" && r2.normalized.Morning[0].side === "sth" && !("side" in r3.normalized.Morning[0]), { r1, r2, r3 });
  }
}

// ---------- (e) retirements + pin (static, served-bundle seats) ----------
{
  check("E pin: ui.ts CACHE is ora-pro-nobis-v672-1 at its one seat", uiSrc.includes('var CACHE = "ora-pro-nobis-v672-1";') && (uiSrc.match(/ora-pro-nobis-v672-1/g) || []).length === 1);
  check("E retirements read zero in the served client: no drop down (opnOfficeChoiceHtml650 / data-p650office), no extPaintSides650, no governing reader/writer (opnOfficeChoice650 / opnOfficeChoiceSet650 / opnSthFirstSet632 as functions), no singItems614, no lf:sing rung",
    !appJs.includes("function opnOfficeChoiceHtml650(") && !appJs.includes("data-p650office") && !appJs.includes("function extPaintSides650(")
    && !appJs.includes("function opnOfficeChoice650(") && !appJs.includes("function opnOfficeChoiceSet650(") && !appJs.includes("function opnSthFirstSet632(")
    && !appJs.includes("singItems614") && !appJs.includes("rung === 'lf:sing'") && !appJs.includes("['lf:sing'"), {});
  // (the string 'lf:sing' may stand in comments/history only — §3.5's gate reads code seats)
  check("E the Source mapping table stands without the choice label: the fallback rows carry their own standing names",
    clientSrc.includes("if (row.role === 'fallback') return base;") && !clientSrc.includes("Morning & Evening choice: ' +"), {});
  check("E the reader stands only at its migration seat: opnOfficeChoiceLegacy670 is called by opnOfficeMig670 and nothing else",
    (appJs.match(/= opnOfficeChoiceLegacy670\(\)/g) || []).length === 1 && appJs.includes("function opnOfficeMig670("), {});
}

// ---------- (a)+(f) paint: one track, the item's side, fallback ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  check("A paint machinery stands: extPaintSide670 + the one-track extPaintTracks650", typeof O.extPaintSide670 === "function");
  if (O.extPaintSide670) {
    const slot = { slotId: "ext-morning-prayer", block: "Morning" };
    const tSth = O.extPaintTracks650(slot, JSON.parse(JSON.stringify(REC_MP)), "sth");
    const tDo = O.extPaintTracks650(slot, JSON.parse(JSON.stringify(REC_MP)), "do");
    check("(a) one item paints ONE track: 'sth' paints the Sing the Hours descriptor whole (title · source · duration 1034), standing identity, no _side650",
      tSth.length === 1 && tSth[0].source === "Sing the Hours" && tSth[0].title === "Morning Prayer - Sing the Hours" && tSth[0].durationS === 1034 && !("_side650" in tSth[0]), tSth.map((d) => ({ source: d.source, side: d._side650 })));
    check("(a) 'do' paints ONE Divine Office track (duration 1091), no _side650", tDo.length === 1 && tDo[0].source === "Divine Office" && tDo[0].durationS === 1091 && !("_side650" in tDo[0]), tDo.map((d) => d.source));
    check("(f) missing-side fallback: the named side missing paints the OTHER side alone, its descriptor carrying its own source/title — both directions",
      O.extPaintSide670(JSON.parse(JSON.stringify(REC_MP_DO_ONLY)), "sth").source === "Divine Office"
      && O.extPaintSide670(JSON.parse(JSON.stringify(REC_MP_STH_ONLY)), "do").source === "Sing the Hours"
      && O.extPaintSide670({ state: "missing" }, "sth") === null, {});
    check("(f) per-side machinery untouched: extAudioKey650 still keys a labeled side 'slot~tag', the bare key for unlabeled",
      O.extAudioKey650(DATE, "ext-morning-prayer", "Sing the Hours") === "day/" + DATE + "/ext-morning-prayer~sth"
      && O.extAudioKey650(DATE, "ext-morning-prayer", "Divine Office") === "day/" + DATE + "/ext-morning-prayer~do"
      && O.extAudioKey650(DATE, "daily-rosary", "x") === "day/" + DATE + "/daily-rosary", {});
  }
  // Through the day build: the item in contents names the side.
  standSlots(w);
  const dSth = morningDescs(w, { Morning: [{ kind: "source", key: "ext-morning-prayer", side: "sth" }] });
  const dDo = morningDescs(w, { Morning: [{ kind: "source", key: "ext-morning-prayer", side: "do" }] });
  const dUn = morningDescs(w, { Morning: [{ kind: "source", key: "ext-morning-prayer" }] });
  const dStand = morningDescs(w, null);
  check("(a) through extRebuildDescs: a sth item paints 1 StH track · a do item 1 DO track · an un-stamped item reads 'sth' · the standing (no-contents) emission paints the universe-stamped sth track",
    dSth.length === 1 && dSth[0].source === "Sing the Hours" && dDo.length === 1 && dDo[0].source === "Divine Office"
    && dUn.length === 1 && dUn[0].source === "Sing the Hours" && dStand.length === 1 && dStand[0].source === "Sing the Hours",
    { sth: dSth.map((d) => d.source), do: dDo.map((d) => d.source), un: dUn.map((d) => d.source), stand: dStand.map((d) => d.source) });
  const dDup = morningDescs(w, { Morning: [{ kind: "source", key: "ext-morning-prayer", side: "sth" }, { kind: "source", key: "ext-morning-prayer", side: "do" }] });
  check("(a) a hand-stored duplicate paints PER ITEM, each its own side (the v610 behavior, named not changed): 2 tracks, StH then DO, distinct card keys, neither carrying _side650",
    dDup.length === 2 && dDup[0].source === "Sing the Hours" && dDup[1].source === "Divine Office"
    && O.descCardKey(dDup[0]) !== O.descCardKey(dDup[1]) && !("_side650" in dDup[0]) && !("_side650" in dDup[1]),
    { n: dDup.length, keys: dDup.map((d) => O.descCardKey(d)) });
  w.close();
}

// ---------- (c) the Add pick (the production ladder, a stub host) ----------
{
  const w = makeWorld(johnStore());
  await sleep(300);
  const O = w.__opn;
  standSlots(w);
  async function ladderWorld(ids) {
    const added = [];
    const host = { ids: () => ids.slice(), add: (it) => added.push(it), layers: () => null, groups: () => [], ensure: (cb) => cb() };
    O.openAddLadder603("Morning", host);
    await sleep(150);
    click(w, w.document.querySelector('[data-p603door="br:prayers"]')); await sleep(80);
    click(w, w.document.querySelector('[data-p603door="lf:office"]')); await sleep(80);
    return added;
  }
  const added = await ladderWorld([]);
  const pickRow = w.document.querySelector('[data-p670pick="ext-morning-prayer"]');
  check("(c) the lf:office rung paints the labeled rows as PICK rows (data-p670pick), the Liturgy of the Hours door's sub names the pick",
    !!pickRow && w.document.querySelector(".profaddladder603").textContent.includes("Morning Prayer"), {});
  click(w, pickRow); await sleep(120);
  const sideRows = [...w.document.querySelectorAll('[data-p670side]')];
  check("(c) a tap expands the source pick IN THE SAME RUNG: exactly two rows (Divine Office · Sing the Hours), each carrying data-p603additem + its side + a sub naming what it adds — NO BOTH row",
    sideRows.length === 2 && sideRows.every((r) => r.getAttribute("data-p603additem") === "source:ext-morning-prayer")
    && sideRows[0].getAttribute("data-p670side") === "do" && sideRows[1].getAttribute("data-p670side") === "sth"
    && sideRows[0].textContent.includes("Divine Office") && sideRows[0].textContent.includes("Adds Morning Prayer")
    && sideRows[1].textContent.includes("Sing the Hours") && !sideRows.some((r) => /Both/.test(r.textContent)), sideRows.map((r) => r.textContent.trim().slice(0, 60)));
  click(w, sideRows[1]); await sleep(120);
  check("(c) tapping Sing the Hours adds {kind:'source', key:'ext-morning-prayer', side:'sth'} through the standing add handler and closes the sheet",
    added.length === 1 && JSON.stringify(added[0]) === JSON.stringify({ kind: "source", key: "ext-morning-prayer", side: "sth" }) && !w.document.querySelector(".profaddladder603"), added);
  const added2 = await ladderWorld([]);
  click(w, w.document.querySelector('[data-p670pick="ext-morning-prayer"]')); await sleep(120);
  click(w, w.document.querySelector('[data-p670side="do"]')); await sleep(120);
  check("(c) tapping Divine Office adds the same item with side:'do'", added2.length === 1 && added2[0].side === "do", added2);
  await ladderWorld(["source:ext-morning-prayer"]);
  const marked = w.document.querySelector('[data-p670pick="ext-morning-prayer"]');
  const officeText = w.document.querySelector(".profaddladder603").textContent;
  check("(c) an hour already standing in the block paints marked + not tappable (no pick row stands for it; 'Already in Morning' reads)",
    !marked && officeText.includes("Already in Morning"), {});
  w.close();
}

// ---------- (b)+(d)+M migration and the toggle ----------
async function migWorld(choice, mut) {
  const extra = {}; if (choice !== null) extra[CHOICE_KEY] = choice;
  const w = makeWorld(johnStore(mut, extra));
  await sleep(300);
  const O = w.__opn;
  const before = await profilesPayload(w);
  drive(() => O.opnEnsureStandings601());
  const migged = await until(() => w.localStorage.getItem(MIG_KEY) === "1", 12000);
  await sleep(300);
  const after = await profilesPayload(w);
  return { w, O, before, after, migged };
}
function officeItem(payload, profKey, block) {
  const p = (payload.profiles || []).find((x) => x.key === profKey);
  const list = (p && p.contents && p.contents[block]) || [];
  return list.find((it) => it.kind === "source" && (it.key === "ext-morning-prayer" || it.key === "ext-evening-prayer")) || null;
}
{
  // (b) sth: paint identical before/after; contents stand stamped.
  const { w, O, before, after, migged } = await migWorld("sth");
  check("(b) migration runs at the seam: done flag set, legacy key removed", migged && w.localStorage.getItem(CHOICE_KEY) === null, { migged, legacy: w.localStorage.getItem(CHOICE_KEY) });
  const sal = officeItem(after, "salesian", "Morning");
  const salE = officeItem(after, "salesian", "Evening");
  check("(b) sth fixture: EVERY profile's labeled items migrate to side:'sth' (Salesian Morning + Evening named; the defaults in the same payload too)",
    !!sal && sal.side === "sth" && !!salE && salE.side === "sth" && !!officeItem(after, "little-way", "Morning") && officeItem(after, "little-way", "Morning").side === "sth"
    && !!officeItem(after, "benedictine", "Evening") && officeItem(after, "benedictine", "Evening").side === "sth", { sal, salE });
  standSlots(w);
  const salRecB = (before.profiles || []).find((x) => x.key === "salesian");
  const preList = O.opnStandingContents597(salRecB, "Morning");
  const dPre = morningDescs(w, { Morning: preList });
  const salRecA = (after.profiles || []).find((x) => x.key === "salesian");
  const dPost = morningDescs(w, { Morning: salRecA.contents.Morning });
  const shape = (ds) => ds.map((d) => d.episodeId + "|" + d.source + "|" + d.title).join(";");
  check("(b) the sth fixture paints the IDENTICAL descriptor set (slot · side source · title) the day before and the day after migration",
    dPre.length === 1 && shape(dPre) === shape(dPost), { pre: shape(dPre), post: shape(dPost) });
  // The migrated contents stand in the Edit form with the toggle.
  await O.opnLoadRes604();
  O.opn604.lists = {}; O.opn604.base = {};
  const html = drive(() => O.opnEditGroupHtml609("Morning")) || "";
  check("(b)+(d) the migrated Morning block stands in the Edit form: the office row carries drag handle · Remove · the segtoggle with Sing the Hours active, and its label names the side",
    html.includes('data-p670toggle="Morning|source:ext-morning-prayer"') && html.includes('data-p670side="sth" class="active"') && html.includes("Morning Prayer \u00b7 Sing the Hours") && html.includes("Remove") && html.includes("data-p604handle"), html.slice(0, 300));
  // (d) the toggle flip, end to end.
  const flip = drive(() => O.opnFlipSide670("Morning", "source:ext-morning-prayer", "do"));
  await (flip || Promise.resolve()); await sleep(400);
  const afterFlip = await profilesPayload(w);
  const flipped = officeItem(afterFlip, "salesian", "Morning");
  check("(d) flipping Morning's item to Divine Office persists through the standing save: the stored item carries side:'do'",
    !!flipped && flipped.side === "do", flipped);
  check("(d) the flipped item's label reads 'Morning Prayer · Divine Office'", O.opnItemLabel604("Morning", flipped) === "Morning Prayer \u00b7 Divine Office", O.opnItemLabel604("Morning", flipped));
  standSlots(w);
  const dFlip = morningDescs(w, { Morning: (afterFlip.profiles.find((x) => x.key === "salesian").contents || {}).Morning });
  const contract = dFlip.length ? drive(() => O.nativeContractItem(dFlip[0])) : null;
  check("(d) the flipped side paints end to end: the DO episode (title · duration 1091) and the engine hand-off carries &src=Divine Office",
    dFlip.length === 1 && dFlip[0].source === "Divine Office" && dFlip[0].title === "Morning Prayer - Divine Office" && dFlip[0].durationS === 1091
    && !!contract && contract.mediaUri.includes("&src=Divine%20Office"), { d: dFlip.map((x) => x.source), uri: contract && contract.mediaUri });
  const store2 = dumpStore(w); w.close();
  const w2 = makeWorld(store2); await sleep(300);
  const reloadPayload = await profilesPayload(w2);
  check("(d) the flip persists through reload: a fresh world over the same store reads side:'do' standing",
    (officeItem(reloadPayload, "salesian", "Morning") || {}).side === "do", officeItem(reloadPayload, "salesian", "Morning"));
  w2.close();
}
{
  // (b) do + both variants.
  const dWorld = await migWorld("do");
  check("(b) the do fixture migrates to side:'do' items", (officeItem(dWorld.after, "salesian", "Morning") || {}).side === "do", officeItem(dWorld.after, "salesian", "Morning"));
  dWorld.w.close();
  const bWorld = await migWorld("both");
  check("(a)+(b) a 'both' fixture migrates to the SINGLE sth item: one office item per hour per block, side:'sth', no pair anywhere",
    (officeItem(bWorld.after, "salesian", "Morning") || {}).side === "sth"
    && (bWorld.after.profiles.find((x) => x.key === "salesian").contents.Morning.filter((it) => it.key === "ext-morning-prayer").length === 1), officeItem(bWorld.after, "salesian", "Morning"));
  bWorld.w.close();
}
{
  // M + collapse: a stored non-office block survives
  // byte-identical; duplicate labeled copies collapse.
  const mut = (doc) => {
    const ben = doc.sections.profiles.list.find((p) => p.key === "benedictine");
    ben.contents = { Night: [{ kind: "source", key: "daily-rosary" }, { kind: "prayer", key: "our-father" }] };
    const lit = doc.sections.profiles.list.find((p) => p.key === "little-way");
    lit.contents = { Morning: [{ kind: "source", key: "ext-morning-prayer" }, { kind: "source", key: "ext-morning-prayer" }, { kind: "source", key: "daily-rosary" }] };
  };
  const { w, before, after, migged } = await migWorld("do", mut);
  const benB = (before.profiles.find((x) => x.key === "benedictine").contents || {}).Night;
  const benA = (after.profiles.find((x) => x.key === "benedictine").contents || {}).Night;
  check("M a non-office stored block survives the migration BYTE-IDENTICAL (the full contents carry, never a partial object)",
    migged && JSON.stringify(benB) === JSON.stringify(benA), { before: benB, after: benA });
  const litM = (after.profiles.find((x) => x.key === "little-way").contents || {}).Morning || [];
  check("(b) duplicate copies of the same labeled slot in a block collapse to the first, stamped with the migrated side; every other item passes through in order",
    litM.length === 2 && litM[0].key === "ext-morning-prayer" && litM[0].side === "do" && litM[1].key === "daily-rosary", litM);
  w.close();
}

console.log("\nharness-v670: " + ok + " ok, " + bad + " bad");
process.exit(bad ? 1 : 0);
