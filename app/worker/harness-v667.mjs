// harness-v667.mjs — v667: the Queue button stands visible
// on the Now Playing card. The v664 foot door retires; a
// plain Queue button stands in the bottom row after the
// menu button and opens the queue sheet; the --art budget
// drops the door's 56px (470 -> 414) and a paint-time fit
// pass (fitNpArtToSheet667) yields the artwork for the
// text's real height.
//
// Modeled on harness-v664 (the rendered client from
// source, driven in jsdom; John's profile document;
// production fixtures). The sheet-act legs carry v664's C
// legs' shape, re-pointed at the new button. The Chromium
// fit measurements stand in measure-v667.mjs (jsdom has no
// layout engine).
//
// Fixtures (Improvement D — production sources, named):
//  - fixtures/queue-2026-11-25-v664.json — the queue is
//    the real 2026-11-25 composed day in extRebuildDescs
//    output shape: the Morning block incl. the Divine
//    Office / Sing the Hours office pair under Both
//    (extPaintTracks650's output), a v656 video row (the
//    head of the REAL captured Catholic Saints & Feasts
//    feed, v663-fixtures/catholicsaints-feed.xml), the
//    Daily Rosary, and the USCCB readings row (v549 seat
//    shape; title as produced, per the v660 record). Its
//    source field names each shape's origin.
//  - tests/fixtures-v603 (book · novenas · podcasts index
//    · bible-folded) — the fetch-stub bodies, as v645.
//  - ~/workspace/projects/ora-pro-nobis/john-personal-
//    data-import-v589.json — his own exported document,
//    seeded as the personal-data store (podcastListens
//    deleted, the standing recipe).
//
// Legs (Plan §4/§5, as far as a harness can): A the
// budget (414 constant · the door priced nowhere · no
// #np-queue-door anywhere in the bundle · the fit-pass
// statics: its call at updateNowPlaying's end + the
// resize hook + the 88px floor) · B the button + sheet
// geometry (the button stands in .np-controls after
// #np-menu · its click opens the sheet at 50dvh, drag to
// 92dvh, short drag settles back, scrim + downward drag
// dismiss, player/playback untouched) · C acts (sounding
// head with no handle/remove · tap jump + snapshot ·
// reorder persists across close/reopen and in the
// snapshot · drag reorder through the handle · remove
// drops exactly one, snapshot + dock asserted ·
// no-op/invalid edits write nothing · empty states
// verbatim incl. "No queue — playing a single prayer." ·
// a v661 completion record drained after a reorder marks
// the track its mediaUri names) · D nothing else moved
// (transport markup byte-equal to base 203c624 · the
// bottom row = base five in order, byte-equal, + Queue
// appended · the preview sheet's renderQueueList branch
// stands).
//
// jsdom carries no layout engine: heights read 0, so the
// fit legs prove the CSS/statics and the drag legs drive
// the sheet's own px geometry (window.innerHeight), which
// is the mount's real input. The row-drag swap loop under
// zero layout moves a dragged row to the list's end —
// asserted as such. Real-layout fit (incl. the row on one
// line at 360px) is measure-v667.mjs.
//
// Run: node app/worker/harness-v667.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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

const clientSrc = readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
const uiSrc = readFileSync(path.join(APP, "worker", "src", "ui.ts"), "utf8");
const FIX = JSON.parse(readFileSync(path.join(HERE, "fixtures", "queue-2026-11-25-v664.json"), "utf8"));
const QUEUE = FIX.queue;
check("fixture: the 2026-11-25 composed day — office pair under Both, video row, readings row, rosary",
  QUEUE.length === 6 && QUEUE[0].episodeId === "ext-morning-prayer" && !QUEUE[0]._side650
  && QUEUE[1].episodeId === "ext-morning-prayer" && QUEUE[1]._side650 === "do"
  && QUEUE[2].kind === "podcast" && QUEUE[2].podSeries === "daily-readings"
  && QUEUE[3].kind === "video" && QUEUE[3].videoId === "v9MO_5NAZWQ"
  && QUEUE.some((d) => d.episodeId === "daily-rosary"), QUEUE.map((d) => d.episodeId));

// ---------- A: fit (Plan §5a) ----------
const budgetM = /calc\(100dvh - (\d+)px\)/.exec(uiSrc);
const BUDGET = budgetM ? Number(budgetM[1]) : 0;
check("A budget: the --art var stands with the v667 budget constant (414px — the retired door's 56 out of 470)", BUDGET === 414, BUDGET);
check("A the door is priced nowhere: no 470 budget, no door line in the --art comment stack",
  !uiSrc.includes("100dvh - 470px") && !/· door\s+56/.test(uiSrc));
check("A no #np-queue-door anywhere in the bundle: no markup, no wire, no CSS rule",
  !clientSrc.includes("np-queue-door") && !uiSrc.includes("#np-queue-door") && !/button\.npq-door\s*\{/.test(uiSrc) && !/\.npq-chev\s*\{/.test(uiSrc));
check("A renderQueueDoor retired: no definition, no call",
  !clientSrc.includes("function renderQueueDoor") && !clientSrc.includes("renderQueueDoor();"));
check("A the fit pass stands: fitNpArtToSheet667 defined, called at updateNowPlaying's end, resize hook, 88px floor, inline --art",
  clientSrc.includes("function fitNpArtToSheet667()")
  && clientSrc.includes("fitNpArtToSheet667(); // v667 §3.3")
  && clientSrc.includes("window.addEventListener('resize'")
  && clientSrc.includes("Math.max(88, Math.round(cur - overflow))")
  && clientSrc.includes("art.style.setProperty('--art', next + 'px')"));
check("A the row stands one line by dress: .np-controls nowrap + the v667 compression (gap 4px, ghost pills 6px horizontal)",
  /\.np-controls \{[^}]*flex-wrap:nowrap[^}]*gap:4px/.test(uiSrc) && /\.np-controls \.btn\.ghost \{ padding-left:6px; padding-right:6px; \}/.test(uiSrc));
check("A the card no longer scrolls: .sheet.np-sheet overflow hidden, .inner a full-height flex column",
  /\.sheet\.np-sheet \{[^}]*overflow:hidden/.test(uiSrc) && /\.sheet\.np-sheet \.inner \{[^}]*display:flex[^}]*height:100%/.test(uiSrc));
check("A the short-viewport step stands: @media (max-height: 660px) with hero/seek/transport compression + 2-line clamps",
  uiSrc.includes("@media (max-height: 660px)") && /@media \(max-height: 660px\) \{[\s\S]*?-webkit-line-clamp:2/.test(uiSrc));
const artAt = (h) => Math.max(88, Math.min(Math.min(0.72 * 390, h - BUDGET), 340));
{
  const hs = [844, 740, 667, 568];
  check("A fit arithmetic: art + the fixed stack fits the viewport at 844/740/667/568",
    hs.every((h) => artAt(h) + BUDGET <= h), hs.map((h) => [h, artAt(h)]));
  check("A the artwork shrinks as the height drops (72vw binds at 390 wide: 280.8 · 280.8 · 253 · 154 floor-ward at 568)",
    artAt(844) === 280.8 && artAt(740) === 280.8 && artAt(667) === 253 && artAt(568) === 154,
    hs.map((h) => artAt(h)));
}
check("A pin: CACHE stands at ora-pro-nobis-v669-1 (its one seat — the pin value re-pointed at v669, per the standing practice)", uiSrc.includes('var CACHE = "ora-pro-nobis-v669-1";'));

// ---------- D statics: byte-stable transport + bottom row ----------
{
  let baseSrc = "";
  try { baseSrc = execFileSync("git", ["-C", WT, "show", "203c624:app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }); } catch (e) {}
  const line = (src, needle) => { const l = src.split("\n").find((x) => x.includes(needle)); return l ? l.trim() : null; };
  check("D base tree readable at 203c624 for the byte-stability gate", !!baseSrc);
  check("D transport markup byte-equal to base", !!baseSrc && line(baseSrc, "np-transport") === line(clientSrc, "np-transport"));
  const btnChunks = (l) => (l ? l.split("<button").slice(1).map((c) => "<button" + c.split("</button>")[0] + "</button>") : []);
  const baseBtns = btnChunks(line(baseSrc, "np-controls")), newBtns = btnChunks(line(clientSrc, "np-controls"));
  check("D bottom row = base five in order, byte-equal, + Queue appended after #np-menu",
    baseBtns.length === 5 && newBtns.length === 6
    && baseBtns.every((b, i) => newBtns[i] === b)
    && newBtns[5] === '<button type="button" class="btn ghost" id="np-queue-btn">Queue</button>',
    newBtns.map((b) => (b.match(/id="([^"]+)"/) || [])[1]));
  check("D mountDrawer untouched (the queue sheet carries its own mount)",
    clientSrc.includes("function mountQueueSheet664(sheet)") && !clientSrc.includes("npq-sheet')\n  mountDrawer"));
}

// ---------- the world ----------
function renderJs(src) {
  const a = src.indexOf("= `") + 3;
  const b = src.indexOf("\n`;", a);
  return vm.runInContext("`" + src.slice(a, b) + "`", vm.createContext({}));
}
const appJs = renderJs(clientSrc);
const shellStart = uiSrc.indexOf("<!DOCTYPE html>");
const SHELL = vm.runInContext("`" + uiSrc.slice(shellStart, uiSrc.indexOf("`;", shellStart)) + "`", vm.createContext({}));
let JSDOM, webcrypto;
try { ({ JSDOM } = await import("jsdom")); ({ webcrypto } = await import("node:crypto")); }
catch (e) { ({ JSDOM } = await import(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js"))); ({ webcrypto } = await import("node:crypto")); }
const BOOK = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "book.json"), "utf8"));
const NOVENAS = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "novenas.json"), "utf8"));
const PODIDX = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "podcasts-index.json"), "utf8"));
const BIBLE = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "bible-folded.json"), "utf8"));
const JOHN_FULL = JSON.parse(readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json"), "utf8"));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = "opn-personal-data-v1";
const DATE = "2026-11-25";
const HOOK = "\n;window.__opn = { state, openNowPlaying, openQueueSheet, openQueuePreview, renderQueueList, queueReorder664, queueRemove664, jumpQueueTo, drainNativeCompletions, oraSnapshotTrack, isPlayedDesc, refreshRepeatIds, readQueueSnapshot };";
function fetchStub(url) {
  const u = String(url);
  let body = {};
  if (u.includes("/api/prayer/book")) body = BOOK;
  else if (u.includes("/api/player/podcasts?series=novenas")) body = NOVENAS;
  else if (u.includes("/api/player/podcasts?series=bible-in-a-year")) body = BIBLE;
  else if (u.includes("/api/player/podcasts?series=")) { const sk = decodeURIComponent(u.split("series=")[1].split("&")[0] || "x"); body = { series: sk, entries: [{ key: sk + ":ep-1", label: "Day 1", title: "First", url: "https://example.invalid/e.mp3", listened: false }], currentKey: sk + ":ep-1" }; }
  else if (u.includes("/api/player/podcasts")) body = PODIDX;
  else if (u.includes("/api/player/day")) body = { ok: true, date: DATE, presentedDay: DATE, dateLabel: "Tuesday, November 25, 2026", blocks: [], dayPositions: {} };
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
  w.scrollTo = () => {};
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement("script");
  s.textContent = appJs + HOOK;
  w.document.body.appendChild(s);
  return w;
}
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); return !!el; }
function pev(w, el, type, y) { if (el) el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y })); return !!el; }
function standQueue(w, idx) {
  const O = w.__opn;
  const q = JSON.parse(JSON.stringify(QUEUE));
  O.state.presentedDay = DATE;
  O.state.dayPayload = { presentedDay: DATE, date: DATE, dayPositions: {} };
  O.state.dayDescs = q;
  O.state.extSlots = { "ext-morning-prayer": { source: "Sing the Hours", state: "present", title: "Morning Prayer", streamUrl: "https://example.invalid/sth-morning.mp3", durationSec: 1034 } };
  O.state.extStanding = [{ slotId: "ext-morning-prayer", title: "Morning Prayer", block: "Morning" }];
  O.refreshRepeatIds();
  O.state.queue = q;
  O.state.queueIdx = idx;
  O.state.current = q[idx];
  O.state.pendingStart = null;
  return q;
}
const qids = (O) => (O.state.queue || []).map((d) => d.episodeId + (d._side650 ? "@" + d._side650 : ""));
const snap = (w) => { try { return JSON.parse(w.localStorage.getItem("opn-queue-v355") || "null"); } catch (e) { return null; } };

// ---------- World 1: the card, the button, the sheet, the acts ----------
{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const q = standQueue(w, 0);
  drive(() => O.openNowPlaying());
  await sleep(60);
  const np = d.querySelector(".np-sheet");
  check("A card stands whole: grab · artwork · title · intention · seek · transport (5) · bottom row (6) all in the sheet, no inline queue, no door",
    !!np && !!np.querySelector(".np-grab") && !!np.querySelector("#np-art") && !!np.querySelector("#np-title")
    && !!np.querySelector("#np-track-intention") && !!np.querySelector("#np-seek")
    && np.querySelectorAll(".np-transport > button").length === 5
    && np.querySelectorAll(".np-controls > button").length === 6
    && !np.querySelector("#np-queue-door") && !np.querySelector("#np-queue"),
    np && np.innerHTML.slice(0, 200));
  check("B the Queue button stands in .np-controls after #np-menu: a plain .btn.ghost pill labeled Queue, no pos line rides it",
    !!np && (() => { const btns = [...np.querySelectorAll(".np-controls > button")]; const q = btns[5];
      return !!q && q.id === "np-queue-btn" && btns[4].id === "np-menu" && q.textContent === "Queue"
        && q.classList.contains("btn") && q.classList.contains("ghost") && !q.querySelector("#np-queue-pos"); })());

  // Open at half.
  click(w, d.querySelector("#np-queue-btn"));
  await sleep(30);
  const qs = d.querySelector(".npq-sheet");
  const inner = qs && qs.querySelector(".inner");
  const vh = w.innerHeight;
  check("B the Queue button opens the queue sheet at 50dvh (\u00b12dvh) over the standing player",
    !!qs && !!inner && Math.abs(parseInt(inner.style.height, 10) - Math.round(vh * 0.5)) <= Math.round(vh * 0.02)
    && !!d.querySelector(".np-sheet") && !qs.classList.contains("np-sheet"),
    inner && inner.style.height + " / vh " + vh);
  check("C the sounding track heads the sheet, marked playing, with NO handle and NO remove",
    !!qs.querySelector("[data-npq-head]") && qs.querySelector("[data-npq-head]").classList.contains("playing")
    && !qs.querySelector("[data-npq-head] [data-npq-handle]") && !qs.querySelector("[data-npq-head] [data-npq-remove]")
    && qs.querySelector("[data-npq-head]").textContent.includes("Morning Prayer"));
  check("C coming rows only: 5 rows after queueIdx, each carrying its absolute index, handle + remove at 44px dress",
    qs.querySelectorAll("[data-npq-row]").length === 5
    && [...qs.querySelectorAll("[data-npq-row]")].every((r, i) => Number(r.getAttribute("data-npq-row")) === i + 1)
    && !!qs.querySelector('[data-npq-handle="1"]') && !!qs.querySelector('[data-npq-remove="5"]'));

  // Drag to full.
  const grab = qs.querySelector(".grabstrip");
  pev(w, grab, "pointerdown", 400); pev(w, d, "pointermove", 100); pev(w, d, "pointerup", 100);
  check("B drag past the midpoint snaps full: height = 92dvh",
    parseInt(inner.style.height, 10) === Math.round(vh * 0.92), inner.style.height);
  // Short drag from full settles to half (below midpoint).
  pev(w, grab, "pointerdown", 100); pev(w, d, "pointermove", 300); pev(w, d, "pointerup", 300);
  check("B a drag ending below the midpoint settles back to half",
    parseInt(inner.style.height, 10) === Math.round(vh * 0.5), inner.style.height);
  // Grab tap does nothing.
  click(w, grab);
  check("B a grab tap changes nothing: the sheet stands at half",
    !!d.querySelector(".npq-sheet") && parseInt(inner.style.height, 10) === Math.round(vh * 0.5));
  // Scrim dismiss leaves player + playback untouched.
  const beforeIds = qids(O), beforeIdx = O.state.queueIdx, beforeCur = O.state.current && O.state.current.episodeId;
  click(w, qs);
  await sleep(20);
  check("B scrim tap dismisses; player sheet, queue, index and current stand untouched",
    !d.querySelector(".npq-sheet") && !!d.querySelector(".np-sheet")
    && JSON.stringify(qids(O)) === JSON.stringify(beforeIds) && O.state.queueIdx === beforeIdx
    && (O.state.current && O.state.current.episodeId) === beforeCur);
  // Downward drag from half dismisses.
  click(w, d.querySelector("#np-queue-btn"));
  await sleep(20);
  const qs2 = d.querySelector(".npq-sheet");
  const grab2 = qs2.querySelector(".grabstrip");
  pev(w, grab2, "pointerdown", 400); pev(w, d, "pointermove", 400 + Math.round(vh * 0.2)); pev(w, d, "pointerup", 400 + Math.round(vh * 0.2));
  check("B a downward drag \u226525% of the panel from half dismisses; reopening starts at half",
    !d.querySelector(".npq-sheet"));
  click(w, d.querySelector("#np-queue-btn"));
  await sleep(20);
  const qs3 = d.querySelector(".npq-sheet");
  check("B reopening always starts at half", !!qs3 && parseInt(qs3.querySelector(".inner").style.height, 10) === Math.round(vh * 0.5));

  // Tap-to-play jumps.
  click(w, qs3.querySelector('[data-npq-index="2"]'));
  await sleep(60);
  check("C tap-to-play jumps: queueIdx 2, current = the readings row, snapshot idx + currentId follow",
    O.state.queueIdx === 2 && O.state.current.episodeId === "daily-readings:2026-11-25"
    && !!snap(w) && snap(w).idx === 2 && snap(w).currentId === "daily-readings:2026-11-25",
    { idx: O.state.queueIdx, snap: snap(w) && [snap(w).idx, snap(w).currentId] });

  // Reorder (function leg): coming range [3,4,5] -> [5,3,4].
  drive(() => O.queueReorder664([5, 3, 4]));
  await sleep(30);
  check("C reorder commits within the coming range only: queueIdx + played rows unmoved, snapshot carries the new order",
    O.state.queueIdx === 2 && JSON.stringify(qids(O)) === JSON.stringify([QUEUE[0], QUEUE[1], QUEUE[2], QUEUE[5], QUEUE[3], QUEUE[4]].map((x) => x.episodeId + (x._side650 ? "@" + x._side650 : "")))
    && !!snap(w) && JSON.stringify(snap(w).ids) === JSON.stringify(O.state.queue.map((x) => x.episodeId)),
    qids(O));
  // Reorder persists across close + reopen.
  qs3.remove();
  click(w, d.querySelector("#np-queue-btn"));
  await sleep(20);
  const qs4 = d.querySelector(".npq-sheet");
  const rowTitles = [...qs4.querySelectorAll("[data-npq-row] .npq-title")].map((t) => t.textContent);
  check("C the reorder stands after close + reopen (paint order = the new queue order)",
    JSON.stringify(rowTitles) === JSON.stringify([QUEUE[5].title, QUEUE[3].title, QUEUE[4].title]), rowTitles);

  // Drag reorder through the handle (zero-layout jsdom: a
  // downward drag carries the row to the list's end).
  const handle = qs4.querySelector('[data-npq-handle="3"]');
  pev(w, handle, "pointerdown", 100); pev(w, handle, "pointermove", 300); pev(w, handle, "pointerup", 300);
  await sleep(30);
  check("C drag reorder via the handle commits: the dragged row lands last among the coming rows, snapshot follows",
    O.state.queue[5].episodeId === QUEUE[5].episodeId && !!snap(w) && snap(w).ids[5] === QUEUE[5].episodeId,
    qids(O));

  // No-op + invalid edits write nothing.
  const snapBefore = w.localStorage.getItem("opn-queue-v355");
  drive(() => O.queueReorder664([3, 4, 5]));
  drive(() => O.queueRemove664(O.state.queueIdx));
  drive(() => O.queueRemove664(0));
  check("C a no-op reorder and sounding/played removes write nothing (snapshot byte-stable)",
    w.localStorage.getItem("opn-queue-v355") === snapBefore && O.state.queue.length === 6);

  // Remove drops exactly one row.
  const dockBefore = d.getElementById("dock-title") && d.getElementById("dock-title").textContent;
  click(w, qs4.querySelector('[data-npq-remove="4"]'));
  await sleep(30);
  check("C remove drops exactly that one row (abs 4 = the rosary, after the drag's new order): queue 5 long, snapshot ids match, the dock still names the sounding track",
    O.state.queue.length === 5 && !O.state.queue.some((x) => x.episodeId === QUEUE[4].episodeId)
    && !!snap(w) && JSON.stringify(snap(w).ids) === JSON.stringify(O.state.queue.map((x) => x.episodeId))
    && d.getElementById("dock-title").textContent === dockBefore,
    { q: qids(O), dock: d.getElementById("dock-title").textContent });

  // v661 drain after the edits: a completion record for the
  // Divine Office side marks THAT track (mediaUri-named).
  const doDesc = O.state.queue.find((x) => x._side650 === "do");
  const sthDesc = O.state.queue.find((x) => x.episodeId === "ext-morning-prayer" && !x._side650);
  const uri = drive(() => O.oraSnapshotTrack(doDesc, DATE)).mediaUri;
  w.Capacitor = { Plugins: { OraDayBridge: { takeNativeCompletions: () => Promise.resolve({ records: [{ episodeId: "ext-morning-prayer", date: DATE, block: "Morning", queueIndex: O.state.queue.indexOf(doDesc), mediaUri: uri }] }) } } };
  drive(() => O.drainNativeCompletions());
  await sleep(60);
  check("C a v661 completion record drained after the reorder marks the track its mediaUri names (DO side marked, StH side not)",
    O.isPlayedDesc(doDesc, DATE) === true && O.isPlayedDesc(sthDesc, DATE) === false,
    { uri });
  w.close();
}

// ---------- World 2: empty states ----------
{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const q = standQueue(w, 0);
  O.state.queue = []; O.state.queueIdx = -1; O.state.current = q[0];
  drive(() => O.openNowPlaying());
  await sleep(40);
  check("C single play: the Queue button stands in the row (and no door stands anywhere)",
    !!d.querySelector("#np-queue-btn") && !d.querySelector("#np-queue-door"));
  click(w, d.querySelector("#np-queue-btn"));
  await sleep(20);
  const qs = d.querySelector(".npq-sheet");
  check("C no queue: head row + the verbatim line 'No queue \u2014 playing a single prayer.'",
    !!qs && !!qs.querySelector("[data-npq-head]") && qs.textContent.includes("No queue \u2014 playing a single prayer.") && !qs.querySelector("[data-npq-row]"));
  qs.remove();
  O.state.queue = [q[0], q[4]]; O.state.queueIdx = 1; O.state.current = q[4];
  drive(() => O.openNowPlaying());
  await sleep(40);
  click(w, d.querySelector("#np-queue-btn"));
  await sleep(20);
  const qs2 = d.querySelector(".npq-sheet");
  check("C queue exhausted: head row + 'Nothing up next.' and no coming rows",
    !!qs2 && qs2.textContent.includes("Nothing up next.") && !qs2.querySelector("[data-npq-row]"));
  w.close();
}

// ---------- World 3: the preview branch stands (Plan §3.5) ----------
{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  const q = standQueue(w, 0);
  O.state.previewQueue = q.slice(); O.state.queuePreviewIdx = 0;
  drive(() => O.openQueuePreview());
  await sleep(40);
  const pv = d.querySelector(".np-preview");
  check("D the preview sheet still paints its #np-queue through renderQueueList (6 rows, '6 items remaining')",
    !!pv && pv.querySelectorAll("[data-npq-index]").length === 6
    && (pv.querySelector("#np-queue-pos") || {}).textContent === "6 items remaining",
    pv && pv.querySelectorAll("[data-npq-index]").length);
  w.close();
}

console.log(`\nharness-v667: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
