// harness-v695.mjs — v695: office rows read the episode's
// natural title for both office sources (Divine Office +
// Sing the Hours), cleaned of exactly the date segment the
// matcher required; backup side gains a stored title
// (migration 0052).
//
// Modeled on harness-v670.mjs (the rendered client from
// source driven in jsdom over John's profile document; the
// server title/write functions extracted standalone, the
// v603 recipe).
//
// Fixtures (Improvement D — production sources, named):
//  - the app D1 ext_resolutions rows for 2026-11-26 read at
//    Plan time (release doc §2.2): both labeled slots standing
//    on Divine Office with a Sing the Hours backup; the six
//    unlabeled office slots present — BEFORE titles verbatim
//    from that read.
//  - the two feeds' verbatim 2026-11-26 episode titles
//    (doc §2.2): Divine Office "November 26th, 2026 – Morning
//    Prayer – Divine Office: Liturgy of the Hours" (and the
//    Evening form; the other six hours in the same form, as
//    the doc's 2026-11-25 examples stand) · Sing the Hours
//    "Divine Office 11.26.26 | Thursday Morning Prayer |
//    Lauds" and "Divine Office 11.26.26 | Thursday Evening
//    Prayer | Vespers".
//  - John's profile document (v589 import, podcastListens
//    stripped as in v603/v611/v614/v666/v670).
//
// Legs (Plan §2.9): (1) server write legs · (2) paint legs
// each side (Praylist row + opened view + Now Playing) ·
// (3) missing-side fallback · (4) title-less fallback ·
// (5) non-office byte-identity · (6) regressions stand in
// their own harnesses (v670 · v690 · v677, run separately).
// Plus: the §2.10 flagged queueLiveDesc seat and the §2.8
// lohOffice676 arm (c) proof on the new title strings.
//
// Run: node app/worker/harness-v695.mjs
import { readFileSync, existsSync } from "node:fs";
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
const drive = (fn) => { try { return fn(); } catch (e) { return undefined; } };

// ---------- fixtures ----------
const Y = 2026, MO = 11, D = 26;
const DO_FEED = {
  "ext-invitatory": "November 26th, 2026 – Invitatory – Divine Office: Liturgy of the Hours",
  "ext-morning-prayer": "November 26th, 2026 – Morning Prayer – Divine Office: Liturgy of the Hours",
  "ext-midmorning-prayer": "November 26th, 2026 – Midmorning Prayer – Divine Office: Liturgy of the Hours",
  "ext-midday-prayer": "November 26th, 2026 – Midday Prayer – Divine Office: Liturgy of the Hours",
  "ext-midafternoon-prayer": "November 26th, 2026 – Midafternoon Prayer – Divine Office: Liturgy of the Hours",
  "ext-office-of-readings": "November 26th, 2026 – Office of Readings – Divine Office: Liturgy of the Hours",
  "ext-evening-prayer": "November 26th, 2026 – Evening Prayer – Divine Office: Liturgy of the Hours",
  "ext-night-prayer": "November 26th, 2026 – Night Prayer – Divine Office: Liturgy of the Hours",
};
const DO_NAT = {
  "ext-invitatory": "Invitatory – Divine Office: Liturgy of the Hours",
  "ext-morning-prayer": "Morning Prayer – Divine Office: Liturgy of the Hours",
  "ext-midmorning-prayer": "Midmorning Prayer – Divine Office: Liturgy of the Hours",
  "ext-midday-prayer": "Midday Prayer – Divine Office: Liturgy of the Hours",
  "ext-midafternoon-prayer": "Midafternoon Prayer – Divine Office: Liturgy of the Hours",
  "ext-office-of-readings": "Office of Readings – Divine Office: Liturgy of the Hours",
  "ext-evening-prayer": "Evening Prayer – Divine Office: Liturgy of the Hours",
  "ext-night-prayer": "Night Prayer – Divine Office: Liturgy of the Hours",
};
const STH_FEED_MP = "Divine Office 11.26.26 | Thursday Morning Prayer | Lauds";
const STH_FEED_EP = "Divine Office 11.26.26 | Thursday Evening Prayer | Vespers";
const STH_NAT_MP = "Divine Office | Thursday Morning Prayer | Lauds";
const STH_NAT_EP = "Divine Office | Thursday Evening Prayer | Vespers";
// BEFORE stored titles (doc §2.2, the 2026-11-26 D1 read).
const BEFORE = {
  "ext-invitatory": "Invitatory", "ext-morning-prayer": "Morning Prayer - Divine Office",
  "ext-midmorning-prayer": "Midmorning Prayer", "ext-midday-prayer": "Midday Prayer",
  "ext-midafternoon-prayer": "Midafternoon Prayer", "ext-office-of-readings": "Office of Readings",
  "ext-evening-prayer": "Evening Prayer - Divine Office", "ext-night-prayer": "Night Prayer",
};
check("F fixtures stand: verbatim feed titles + the BEFORE stored titles from the Plan-time D1 read",
  DO_FEED["ext-morning-prayer"].startsWith("November 26th, 2026 – ") && STH_FEED_MP.includes("11.26.26") && BEFORE["ext-evening-prayer"] === "Evening Prayer - Divine Office");

const BOOK = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "book.json"), "utf8"));
const PODIDX = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "podcasts-index.json"), "utf8"));
const JOHN_FULL = JSON.parse(readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json"), "utf8"));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = "opn-personal-data-v1";

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

// ---------- server extraction (v603 recipe) ----------
function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("fn not found: " + name);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (!depth) return src.slice(start, i + 1); } }
  throw new Error("unbalanced: " + name);
}
function extractConst(src, marker, endMark) {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error("const not found: " + marker);
  const end = src.indexOf(endMark, at);
  return src.slice(at, end + endMark.length);
}
let nat = null, titleForDO = null, resWrite = null, backupWrite = null, natErr = "";
try {
  const months = extractConst(indexSrc, "const EXT_MONTHS_FULL =", "];");
  const natSrc = extractFn(indexSrc, "extNaturalTitle695").replace(
    "function extNaturalTitle695(rawTitle: string | null | undefined, y: number, mo: number, d: number): string | null",
    "function extNaturalTitle695(rawTitle, y, mo, d)");
  if (natSrc.includes(": string")) throw new Error("extNaturalTitle695 signature strip failed");
  nat = new Function(months + "\n" + natSrc + "\nreturn extNaturalTitle695;")();
  // The DO leg's titleFor arrow, extracted from its call site.
  const doAt = indexSrc.indexOf('"divine-office"');
  const tfAt = indexSrc.indexOf("(slotId, it, y, mo, d) => {\n      const t = EXT_DO_SLOTS.find", doAt);
  let depth = 0, i = indexSrc.indexOf("{", tfAt);
  for (; i < indexSrc.length; i++) { if (indexSrc[i] === "{") depth++; else if (indexSrc[i] === "}") { depth--; if (!depth) break; } }
  const tfSrc = indexSrc.slice(tfAt, i + 1);
  const doSlots = extractConst(indexSrc, "const EXT_DO_SLOTS:", "];").replace(": { slotId: string; title: string; tokenKey: string }[]", "");
  const labeled = extractConst(indexSrc, "const EXT_LABELED_SLOTS =", "]);") + ";";
  titleForDO = new Function(months + "\n" + natSrc + "\n" + doSlots + "\n" + labeled + "\nreturn (" + tfSrc + ");")();
  const nowStub = "function nowISO() { return '2026-11-26T12:00:00.000Z'; }";
  let rw = extractFn(indexSrc, "extResolutionWrite");
  const rwSigEnd = rw.indexOf("): Promise<void>");
  if (rwSigEnd < 0) throw new Error("extResolutionWrite signature shape moved");
  rw = "async function extResolutionWrite(env, date, slotId, it, title, imageFallback, stamp, episodeDate, source, backupUrl, backupSource, route, backupImageUrl, backupDurationS, backupTitle)" + rw.slice(rwSigEnd + "): Promise<void>".length);
  if (rw.includes("Promise<void>")) throw new Error("extResolutionWrite signature strip failed");
  resWrite = new Function(nowStub + "\n" + rw + "\nreturn extResolutionWrite;")();
  let bw = extractFn(indexSrc, "extResolutionBackupWrite");
  const bwSigEnd = bw.indexOf("): Promise<void>");
  if (bwSigEnd < 0) throw new Error("extResolutionBackupWrite signature shape moved");
  bw = "async function extResolutionBackupWrite(env, date, slotId, backupUrl, backupSource, backupImageUrl, backupDurationS, backupTitle)" + bw.slice(bwSigEnd + "): Promise<void>".length);
  if (bw.includes("Promise<void>")) throw new Error("extResolutionBackupWrite signature strip failed");
  backupWrite = new Function(bw + "\nreturn extResolutionBackupWrite;")();
} catch (e) { natErr = String(e.message || e); }
check("S extraction: extNaturalTitle695 + the DO titleFor + both write functions extract standalone (v603 recipe)", !!nat && !!titleForDO && !!resWrite && !!backupWrite, natErr);

// ---------- (1) server write legs ----------
if (nat) {
  check("1 cleaning, Divine Office form: the leading date segment strips, the remainder stands verbatim (all 8 slots)",
    Object.keys(DO_FEED).every((k) => nat(DO_FEED[k], Y, MO, D) === DO_NAT[k]),
    Object.keys(DO_FEED).map((k) => nat(DO_FEED[k], Y, MO, D)));
  check("1 cleaning, Sing the Hours form: the M.D.YY token strips with its orphaned separator (both verbatim strings)",
    nat(STH_FEED_MP, Y, MO, D) === STH_NAT_MP && nat(STH_FEED_EP, Y, MO, D) === STH_NAT_EP,
    [nat(STH_FEED_MP, Y, MO, D), nat(STH_FEED_EP, Y, MO, D)]);
  check("1 cleaning edges: a non-matching title returns raw trimmed · empty/absent → null",
    nat("  Some Other Title  ", Y, MO, D) === "Some Other Title" && nat("", Y, MO, D) === null && nat(null, Y, MO, D) === null && nat("November 26th, 2026 – ", Y, MO, D) === null, {});
}
if (titleForDO) {
  const mkIt = (t) => ({ title: t, url: "https://do.example/x.mp3", length: 1, pubMs: null, durationS: 60, imageUrl: null, descText: null });
  check("1 DO leg (extracted titleFor): a present match stores the cleaned natural title for all 8 office slots",
    Object.keys(DO_FEED).every((k) => titleForDO(k, mkIt(DO_FEED[k]), Y, MO, D) === DO_NAT[k]),
    Object.keys(DO_FEED).map((k) => titleForDO(k, mkIt(DO_FEED[k]), Y, MO, D)));
  check("1 DO leg fallbacks (§2.5): a missing row keeps the bare slot title · a title-less present match on a labeled slot keeps the v626 composed form",
    titleForDO("ext-morning-prayer", null, Y, MO, D) === "Morning Prayer" && titleForDO("ext-invitatory", null, Y, MO, D) === "Invitatory"
    && titleForDO("ext-morning-prayer", mkIt(""), Y, MO, D) === "Morning Prayer - Divine Office" && titleForDO("ext-invitatory", mkIt(""), Y, MO, D) === "Invitatory", {});
}
function fakeDb() {
  const cap = [];
  return { cap, prepare(sql) { return { bind(...args) { const rec = { sql, args }; cap.push(rec); return { run: async () => ({}) }; } }; } };
}
if (resWrite) {
  const db = fakeDb();
  const it = { title: DO_FEED["ext-morning-prayer"], url: "https://do.example/mp.mp3", length: 10, pubMs: null, durationS: 1091, imageUrl: null, descText: null };
  await resWrite({ DB: db }, "2026-11-26", "ext-morning-prayer", it, DO_NAT["ext-morning-prayer"], null, null, "2026-11-26", "Divine Office", "https://sth.example/lauds.mp3", "Sing the Hours", "synthesis", null, 1034, STH_NAT_MP);
  const c = db.cap[0];
  check("1 extResolutionWrite (extracted, fake D1): INSERT + ON CONFLICT carry backup_title; the displaced fill's stored title rides as its value (the synthesis/scrape carriage)",
    !!c && c.sql.includes("backup_title") && c.sql.includes("backup_title = excluded.backup_title") && c.args[c.args.length - 1] === STH_NAT_MP && c.args[3] === DO_NAT["ext-morning-prayer"], c && c.args);
}
if (backupWrite) {
  const db = fakeDb();
  await backupWrite({ DB: db }, "2026-11-26", "ext-morning-prayer", "https://sth.example/lauds.mp3", "Sing the Hours", null, 1034, STH_NAT_MP);
  const c = db.cap[0];
  check("1 extResolutionBackupWrite (extracted, fake D1): the UPDATE sets backup_title from the matched StH item's cleaned natural title",
    !!c && c.sql.includes("backup_title=?") && c.args.includes(STH_NAT_MP), c && c.args);
}
check("1 StH fill + backup call sites (source seats): the fill stores extNaturalTitle695 ?? the composed form · the backup call passes extNaturalTitle695 · the courier path carries the same rule · the payload serves res.backup_title ?? the composed legacy form",
  indexSrc.includes("extNaturalTitle695(it.title, y, mo, d) ?? `${slotTitle} - Sing the Hours`")
  && indexSrc.includes('it.durationS ?? null, extNaturalTitle695(it.title, y, mo, d))')
  && indexSrc.includes('const title = extNaturalTitle695(it.title, y, mo, d) ?? (EXT_LABELED_SLOTS.has(slot.slotId)')
  && indexSrc.includes('title: res.backup_title ?? `${sd.title} - ${res.backup_source ?? ""}`'), {});
check("1 migration 0052 stands: ALTER TABLE ext_resolutions ADD COLUMN backup_title TEXT",
  existsSync(path.join(APP, "migrations", "0052_ext_backup_title.sql"))
  && readFileSync(path.join(APP, "migrations", "0052_ext_backup_title.sql"), "utf8").includes("ALTER TABLE ext_resolutions ADD COLUMN backup_title TEXT;"), {});
check("1 matchers untouched + helper call sites are exactly the prescribed seats (definition + DO titleFor + courier + StH fill + backup write)",
  (indexSrc.match(/extNaturalTitle695/g) || []).length === 5
  && indexSrc.includes("function extMatchDivineOffice(items: ExtFeedItem[], y: number, mo: number, d: number): Map<string, ExtFeedItem>")
  && indexSrc.includes("function extMatchSth(items: ExtFeedItem[], y: number, mo: number, d: number, token: string): ExtFeedItem | null"), (indexSrc.match(/extNaturalTitle695/g) || []).length);

// ---------- client world ----------
const HOOK = "\n;window.__opn = { state, extPaintTracks650, extPaintSide670, trackCard, trackDesc, trackPagePaintDay643, openNowPlaying, queueLiveDesc, lohOffice676 };";
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes("/api/prayer/book")) body = BOOK;
  else if (u.includes("/api/player/source-settings")) body = { sources: SEED_ROWS, version: 7 };
  else if (u.includes("/api/player/externals/live")) body = { slots: [] };
  else if (u.includes("/api/player/podcasts?series=")) { const sk = decodeURIComponent(u.split("series=")[1].split("&")[0] || "x"); body = { series: sk, kind: "rss", entries: [], currentKey: null }; }
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
const DO_IMG = "https://do.example/divine-office-logo.jpg";
const STH_IMG = "https://sth.example/sing-the-hours-channel.jpg";
function recAfter(slotId, doTitle, sthTitle, doUrl, sthUrl) {
  return { slotId, state: "present", title: doTitle, source: "Divine Office", enclosureUrl: doUrl, streamUrl: doUrl, durationSec: 1091, sizeBytes: 1000000, imageUrl: DO_IMG,
    side2: { state: "present", title: sthTitle, source: "Sing the Hours", enclosureUrl: sthUrl, streamUrl: sthUrl, durationSec: 1034, sizeBytes: 900000, imageUrl: STH_IMG } };
}
const REC_MP = recAfter("ext-morning-prayer", DO_NAT["ext-morning-prayer"], STH_NAT_MP, "https://do.example/mp.mp3", "https://sth.example/lauds.mp3");
const REC_EP = recAfter("ext-evening-prayer", DO_NAT["ext-evening-prayer"], STH_NAT_EP, "https://do.example/ep.mp3", "https://sth.example/vespers.mp3");
const REC_INV = { slotId: "ext-invitatory", state: "present", title: DO_NAT["ext-invitatory"], source: null, enclosureUrl: "https://do.example/inv.mp3", streamUrl: "https://do.example/inv.mp3", durationSec: 300, sizeBytes: 500000, imageUrl: DO_IMG };
const SLOT_MP = { slotId: "ext-morning-prayer", title: "Morning Prayer", block: "Morning", sortOrder: 1 };
const SLOT_EP = { slotId: "ext-evening-prayer", title: "Evening Prayer", block: "Evening", sortOrder: 1 };
const SLOT_INV = { slotId: "ext-invitatory", title: "Invitatory", block: "Morning", sortOrder: 0 };

const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
await sleep(300);
const O = w.__opn;
check("C client machinery stands in the rendered client: extPaintTracks650 · trackCard · trackPagePaintDay643 · openNowPlaying · queueLiveDesc · lohOffice676",
  !!O && typeof O.extPaintTracks650 === "function" && typeof O.trackCard === "function" && typeof O.trackPagePaintDay643 === "function" && typeof O.openNowPlaying === "function" && typeof O.queueLiveDesc === "function" && typeof O.lohOffice676 === "function", {});

function paintSurfaces(slot, rec, side) {
  const t = O.extPaintTracks650(slot, JSON.parse(JSON.stringify(rec)), side)[0];
  if (!t) return null;
  const desc = O.trackDesc(t, null);
  const rowHtml = drive(() => O.trackCard(desc)) || "";
  drive(() => O.trackPagePaintDay643({ date: "2026-11-26" }, desc));
  const opened = drive(() => w.document.querySelector("#track-page-643 h1") && w.document.querySelector("#track-page-643 h1").textContent) || "";
  O.state.current = desc;
  drive(() => O.openNowPlaying());
  const np = drive(() => w.document.querySelector("#np-title") && w.document.querySelector("#np-title").textContent) || "";
  const sheet = w.document.querySelector(".np-sheet"); if (sheet) sheet.remove();
  return { desc, rowHtml, opened, np };
}
// ---------- (2) paint legs, each side ----------
{
  const mpDo = paintSurfaces(SLOT_MP, REC_MP, "do");
  check("2 Morning, side do: Praylist row + opened view + Now Playing all read the DO natural title",
    !!mpDo && mpDo.desc.title === DO_NAT["ext-morning-prayer"] && mpDo.rowHtml.includes(DO_NAT["ext-morning-prayer"]) && mpDo.opened === DO_NAT["ext-morning-prayer"] && mpDo.np === DO_NAT["ext-morning-prayer"],
    mpDo && { desc: mpDo.desc.title, opened: mpDo.opened, np: mpDo.np, rowHas: mpDo.rowHtml.includes(DO_NAT["ext-morning-prayer"]) });
  const mpSth = paintSurfaces(SLOT_MP, REC_MP, "sth");
  check("2 Morning, side sth: Praylist row + opened view + Now Playing all read the StH natural title",
    !!mpSth && mpSth.desc.title === STH_NAT_MP && mpSth.rowHtml.includes(STH_NAT_MP) && mpSth.opened === STH_NAT_MP && mpSth.np === STH_NAT_MP,
    mpSth && { desc: mpSth.desc.title, opened: mpSth.opened, np: mpSth.np, rowHas: mpSth.rowHtml.includes(STH_NAT_MP) });
  const epDo = paintSurfaces(SLOT_EP, REC_EP, "do");
  const epSth = paintSurfaces(SLOT_EP, REC_EP, "sth");
  check("2 Evening pair: side do reads the DO natural title · side sth reads the StH natural title (descriptor + opened + Now Playing)",
    !!epDo && !!epSth && epDo.desc.title === DO_NAT["ext-evening-prayer"] && epDo.opened === DO_NAT["ext-evening-prayer"] && epDo.np === DO_NAT["ext-evening-prayer"]
    && epSth.desc.title === STH_NAT_EP && epSth.opened === STH_NAT_EP && epSth.np === STH_NAT_EP,
    { epDo: epDo && epDo.desc.title, epSth: epSth && epSth.desc.title });
  const inv = paintSurfaces(SLOT_INV, REC_INV, "do");
  check("2 unlabeled slot (ext-invitatory) paints its DO natural title on all three surfaces",
    !!inv && inv.desc.title === DO_NAT["ext-invitatory"] && inv.rowHtml.includes(DO_NAT["ext-invitatory"]) && inv.opened === DO_NAT["ext-invitatory"] && inv.np === DO_NAT["ext-invitatory"],
    inv && { desc: inv.desc.title, opened: inv.opened, np: inv.np });
}
// ---------- (3) missing-side fallback ----------
{
  const sthOnly = { slotId: "ext-morning-prayer", state: "present", title: STH_NAT_MP, source: "Sing the Hours", enclosureUrl: "https://sth.example/lauds.mp3", streamUrl: "https://sth.example/lauds.mp3", durationSec: 1034, imageUrl: STH_IMG };
  const t = O.extPaintTracks650(SLOT_MP, JSON.parse(JSON.stringify(sthOnly)), "do");
  check("3 missing-side fallback: a Morning record with only the StH side standing, item named do → the row paints the StH natural title (title follows the painted side)",
    t.length === 1 && t[0].title === STH_NAT_MP && t[0].source === "Sing the Hours", t.map((x) => x.title));
}
// ---------- (4) title-less fallback ----------
{
  const synth = { slotId: "ext-morning-prayer", state: "present", title: "Morning Prayer", source: "Divine Office", enclosureUrl: "https://do.example/mp.mp3", streamUrl: "https://do.example/mp.mp3", durationSec: 1091, imageUrl: DO_IMG };
  const t = O.extPaintTracks650(SLOT_MP, JSON.parse(JSON.stringify(synth)), "do");
  check("4 title-less fallback: a synthesis-shaped record (no natural title exists) paints the standing seed name · a legacy backup entry shape keeps the composed form at the settle seat (e.backup.title || slot.title stands in source)",
    t.length === 1 && t[0].title === "Morning Prayer" && clientSrc.includes("title: e.backup.title || slot.title") && indexSrc.includes("title: res.title ?? sd.title"), t.map((x) => x.title));
}
// ---------- §2.10 flagged seat: queueLiveDesc ----------
{
  O.state.extSlots = { "ext-morning-prayer": JSON.parse(JSON.stringify(REC_MP)) };
  O.state.extStanding = [SLOT_MP];
  O.state.dayPayload = { date: "2026-11-26", blocks: [] };
  const sthDesc = O.trackDesc(O.extPaintTracks650(SLOT_MP, JSON.parse(JSON.stringify(REC_MP)), "sth")[0], null);
  const frozenSth = Object.assign({}, sthDesc, { available: false });
  const liveSth = drive(() => O.queueLiveDesc(frozenSth));
  const doDesc = O.trackDesc(O.extPaintTracks650(SLOT_MP, JSON.parse(JSON.stringify(REC_MP)), "do")[0], null);
  const liveDo = drive(() => O.queueLiveDesc(Object.assign({}, doDesc, { available: false })));
  check("Q queueLiveDesc rebuild (the §2.10 flagged seat, FIXED): a frozen-unavailable side2-painted descriptor rebuilds under its OWN side's natural title + source + URL — never the standing side's",
    !!liveSth && liveSth.title === STH_NAT_MP && liveSth.source === "Sing the Hours" && liveSth.url === "https://sth.example/lauds.mp3" && liveSth.available === true,
    liveSth && { title: liveSth.title, source: liveSth.source, url: liveSth.url });
  check("Q queueLiveDesc rebuild, standing side: a frozen DO descriptor rebuilds under the DO natural title",
    !!liveDo && liveDo.title === DO_NAT["ext-morning-prayer"] && liveDo.source === "Divine Office", liveDo && { title: liveDo.title, source: liveDo.source });
}
// ---------- §2.8 lohOffice676 arm (c) on the new strings ----------
{
  check("R lohOffice676 arm (c) fires on BOTH feeds' cleaned natural titles (no episodeId/slotId — title + source only): the hour name stands in every form",
    O.lohOffice676({ source: "Divine Office", title: DO_NAT["ext-morning-prayer"] }) === true
    && O.lohOffice676({ source: "Sing the Hours", title: STH_NAT_MP }) === true
    && O.lohOffice676({ source: "Divine Office", title: DO_NAT["ext-evening-prayer"] }) === true
    && O.lohOffice676({ source: "Sing the Hours", title: STH_NAT_EP }) === true
    && O.lohOffice676({ source: "Divine Office", title: "Some Unrelated Title" }) === false, {});
}
// ---------- (5) non-office byte-identity ----------
{
  const nonOffice = [
    { episodeId: "ext-daily-tv-mass", title: "Daily TV Mass Thursday November 26, 2026", source: "Daily TV Mass", available: true, streamUrl: "https://x.example/tv.mp3", _block: "Morning" },
    { episodeId: "ext-gospel-exegesis", title: "Thursday of Week 34 in Ordinary Time - Luke 21: 20-28", source: "Daily Gospel Exegesis", available: true, streamUrl: "https://x.example/ex.mp3", _block: "Morning" },
    { episodeId: "ext-saint-of-the-day", title: "11/26 - St. John Berchmans", source: "Saint of the Day", available: true, streamUrl: "https://x.example/st.mp3", _block: "Morning" },
    { episodeId: "ext-bible-in-a-year", title: "Day 330: The Ark of the Covenant", source: "Bible in a Year", available: true, streamUrl: "https://x.example/b.mp3", _block: "Morning" },
    { episodeId: "daily-rosary", title: "The Holy Rosary", source: "", available: true, streamUrl: "https://x.example/r.mp3", _block: "Morning" },
  ];
  const outs = nonOffice.map((t) => O.trackDesc(JSON.parse(JSON.stringify(t)), null));
  check("5 non-office byte-identity: own · exegesis · Saint · Bible · TV Mass descriptors pass the trackDesc seam with titles byte-identical (the cleaning helper stands at no non-office seat)",
    outs.every((d, i) => d.title === nonOffice[i].title), outs.map((d) => d.title));
}
// ---------- pin ----------
check("P pin: ui.ts CACHE is ora-pro-nobis-v695-1 at its one seat, no v694 pin remains",
  uiSrc.includes('var CACHE = "ora-pro-nobis-v695-1";') && (uiSrc.match(/ora-pro-nobis-v695-1/g) || []).length === 1 && !uiSrc.includes("ora-pro-nobis-v694-1"), {});

console.log("\nharness-v695: " + ok + " ok, " + bad + " bad");
process.exit(bad ? 1 : 0);
