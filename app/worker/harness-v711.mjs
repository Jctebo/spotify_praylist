// harness-v711.mjs — v711: the Now Playing buttons stand a
// little bigger. Transport side glyphs 26px -> 30px (padding
// 10px -> 12px), the play disc 58px -> 66px (glyph 21px ->
// 24px), the bottom row 44px -> 50px tall (vertical padding
// 9px -> 12px, font 15px -> 16px, horizontal padding 6px ->
// 5px — the one fit trade), the Share SVG 20x20 -> 24x24.
// The Queue pill carries no rule of its own and inherits the
// row whole. Nothing else moves: five-cell shape, 420px cap,
// seat order, handlers, the fit pass, the 414px budget, the
// 88px floor, the <=660px step.
//
// Modeled on harness-v667 (the rendered client from source,
// driven in jsdom; John's profile document; production
// fixtures). Real-layout growth + fit measurements stand in
// measure-v711.mjs (jsdom has no layout engine).
//
// Fixtures (Improvement D — production sources, named): as
// harness-v667 — fixtures/queue-2026-11-25-v664.json (the
// real 2026-11-25 composed day), tests/fixtures-v603, and
// John's own exported document
// ~/workspace/projects/ora-pro-nobis/john-personal-data-
// import-v589.json seeded as the personal-data store.
//
// Legs (Plan §2.4): A served-CSS size legs (rows 1-8) · B
// markup leg (row 9: the #np-share SVG at 24x24, the row
// byte-identical to base ff5f0ec otherwise; the transport
// markup byte-equal to base) · C seat order (transport five
// ids in order; controls six ids in order, Queue last) · D
// behavior (next advances the queue · the Queue button opens
// the queue sheet · Intentions flips its store · the star
// toggles · play/prev/back10/fwd10/share/menu/read wiring
// stands verbatim) · E untouched (420px cap + cell rule ·
// budget 414 · fitNpArtToSheet667 + 88px floor · <=660px
// step · the Queue pill has no size rule of its own) · pin.
//
// Run: node app/worker/harness-v711.mjs
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
check("fixture: the 2026-11-25 composed day stands (as harness-v667)",
  QUEUE.length === 6 && QUEUE[0].episodeId === "ext-morning-prayer" && QUEUE.some((d) => d.episodeId === "daily-rosary"));

// ---------- A: the size legs (Plan §2.1 rows 1-8) ----------
check("A row 1+2 transport side glyphs: .np-tbtn font-size 30px, padding 12px",
  /\.np-tbtn \{[^}]*font-size:30px[^}]*padding:12px/.test(uiSrc) && !/\.np-tbtn \{[^}]*font-size:26px/.test(uiSrc));
check("A row 3+4 play disc: .np-play 66x66, glyph 24px",
  /\.np-play \{ width:66px; height:66px; font-size:24px; \}/.test(uiSrc));
check("A rows 5-8 bottom row: .np-controls .btn.ghost min-height 50px, padding 12px vertical / 5px horizontal, font-size 16px",
  /\.np-controls \.btn\.ghost \{ min-height:50px; padding:12px 5px; font-size:16px; \}/.test(uiSrc));
check("A the base pill dress stands untouched (the row rule, not the base, carries the growth): button.btn.ghost padding 9px 16px, button.btn min-height 44px / font-size 15px",
  /button\.btn\.ghost \{[^}]*padding:9px 16px/.test(uiSrc) && /button\.btn \{[^}]*font-size:15px[^}]*min-height:44px/.test(uiSrc));

// ---------- B: markup (row 9) + byte-stability vs base ff5f0ec ----------
const line = (src, needle) => { const l = src.split("\n").find((x) => x.includes(needle)); return l ? l.trim() : null; };
let baseClient = "", baseUi = "";
try {
  baseClient = execFileSync("git", ["-C", WT, "show", "ff5f0ec:app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  baseUi = execFileSync("git", ["-C", WT, "show", "ff5f0ec:app/worker/src/ui.ts"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
} catch (e) {}
check("B base tree readable at ff5f0ec for the byte-stability gate", !!baseClient && !!baseUi);
check("B row 9: the #np-share SVG stands at 24x24 in the served markup",
  (line(clientSrc, "np-controls") || "").includes('width="24" height="24"'));
check("B the bottom-row markup is byte-identical to base except the share SVG attrs (20 -> 24)",
  !!baseClient && line(clientSrc, "np-controls").replace('width="24" height="24"', 'width="20" height="20"') === line(baseClient, "np-controls"));
check("B the transport markup is byte-equal to base (v711 touches no transport markup)",
  !!baseClient && line(clientSrc, "np-transport") === line(baseClient, "np-transport"));

// ---------- C: seat order (source lines) ----------
const ids = (l) => [...(l || "").matchAll(/id="(np-[^"]+)"/g)].map((m) => m[1]);
check("C transport seat order: back10 · prev · play · next · fwd10",
  JSON.stringify(ids(line(clientSrc, "np-transport"))) === JSON.stringify(["np-back10", "np-prev", "np-play", "np-next", "np-fwd10"]), ids(line(clientSrc, "np-transport")));
check("C bottom-row seat order: intentions · read · star · share · menu · queue (Queue last)",
  JSON.stringify(ids(line(clientSrc, "np-controls"))) === JSON.stringify(["np-intentions", "np-read", "np-star", "np-share", "np-menu", "np-queue-btn"]), ids(line(clientSrc, "np-controls")));

// ---------- E: untouched ----------
check("E the five-cell shape + 420px cap stand: .np-transport max-width:420px, cells flex:1 1 0",
  /\.np-transport \{[^}]*max-width:420px/.test(uiSrc) && /\.np-transport > button \{ flex:1 1 0;/.test(uiSrc));
check("E the 414px budget constant stands", /calc\(100dvh - 414px\)/.test(uiSrc));
check("E the fit pass stands: fitNpArtToSheet667 defined, called at updateNowPlaying's end, 88px floor",
  clientSrc.includes("function fitNpArtToSheet667()") && clientSrc.includes("fitNpArtToSheet667(); // v667 §3.3") && clientSrc.includes("Math.max(88, Math.round(cur - overflow))"));
check("E the <=660px short-viewport step stands", uiSrc.includes("@media (max-height: 660px)"));
check("E row 10: the Queue pill has no size rule of its own (no #np-queue-btn CSS rule — it inherits the row)",
  !/#np-queue-btn\s*\{/.test(uiSrc) && !/\.np-controls[^{]*#np-queue-btn/.test(uiSrc));
check("pin: CACHE stands at ora-pro-nobis-v711-1 (bumped in Implement per the coordinator override)", uiSrc.includes('var CACHE = "ora-pro-nobis-v711-1";'));

// ---------- D: wiring statics (the handlers stand verbatim) ----------
for (const [id, fn] of [["np-play", "transportPlaying"], ["np-prev", "previousWithRule"], ["np-back10", "seekBy(-10)"], ["np-fwd10", "seekBy(10)"], ["np-next", "advanceQueue(1)"], ["np-share", "shareTrackSheet(state.current)"], ["np-menu", "openPlayerMenu(this)"], ["np-intentions", "setIntentions(!intentionsOn())"], ["np-queue-btn", "openQueueSheet()"]]) {
  check("D wiring stands: #" + id + " click -> " + fn,
    clientSrc.includes("querySelector('#" + id + "').addEventListener('click'") && clientSrc.includes(fn));
}
check("D wiring stands: #np-read click -> openRead", clientSrc.includes("querySelector('#np-read').addEventListener('click'") && clientSrc.includes("openRead(t)"));

// ---------- the world (harness-v667 pattern) ----------
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

{
  const w = makeWorld({ [DATA_KEY]: JSON.stringify(JOHN) });
  await sleep(400);
  const O = w.__opn, d = w.document;
  standQueue(w, 0);
  drive(() => O.openNowPlaying());
  await sleep(60);
  const np = d.querySelector(".np-sheet");
  check("C card stands whole with both rows in seat order (DOM)",
    !!np && JSON.stringify([...np.querySelectorAll(".np-transport > button")].map((b) => b.id)) === JSON.stringify(["np-back10", "np-prev", "np-play", "np-next", "np-fwd10"])
    && JSON.stringify([...np.querySelectorAll(".np-controls > button")].map((b) => b.id)) === JSON.stringify(["np-intentions", "np-read", "np-star", "np-share", "np-menu", "np-queue-btn"]));
  check("B the served share SVG in the DOM stands at 24x24",
    !!np && (() => { const s = np.querySelector("#np-share svg"); return !!s && s.getAttribute("width") === "24" && s.getAttribute("height") === "24"; })());
  check("E the Queue pill in the DOM is a plain .btn.ghost member (the row's dress whole, no own class)",
    !!np && (() => { const q = np.querySelector("#np-queue-btn"); return !!q && q.classList.contains("btn") && q.classList.contains("ghost") && q.textContent === "Queue"; })());

  // Behavior: next advances; prev returns (the one rule).
  click(w, d.querySelector("#np-next"));
  await sleep(30);
  check("D #np-next advances the queue (queueIdx 0 -> 1, current follows)", O.state.queueIdx === 1 && O.state.current === O.state.queue[1], O.state.queueIdx);
  click(w, d.querySelector("#np-prev"));
  await sleep(30);
  check("D #np-prev acts under the one rule (no throw, sheet stands, queue intact)", !!d.querySelector(".np-sheet") && O.state.queue.length === 6, O.state.queueIdx);
  // Behavior: transport seeks + play act without throwing.
  click(w, d.querySelector("#np-back10")); click(w, d.querySelector("#np-fwd10")); click(w, d.querySelector("#np-play"));
  await sleep(30);
  check("D #np-back10 / #np-fwd10 / #np-play act without throwing (sheet stands, queue intact)", !!d.querySelector(".np-sheet") && O.state.queue.length === 6);
  // Behavior: intentions toggle flips its store.
  const before = w.localStorage.getItem("opn-intentions-v384");
  click(w, d.querySelector("#np-intentions"));
  await sleep(30);
  check("D #np-intentions flips the intentions store", w.localStorage.getItem("opn-intentions-v384") !== before, { before, after: w.localStorage.getItem("opn-intentions-v384") });
  // Behavior: the star toggles.
  const star0 = d.querySelector("#np-star").textContent;
  click(w, d.querySelector("#np-star"));
  await sleep(30);
  const star1 = (d.querySelector("#np-star") || {}).textContent;
  check("D #np-star toggles the star glyph", star0 !== star1, { star0, star1 });
  // Behavior: the Queue button opens the queue sheet.
  click(w, d.querySelector("#np-queue-btn"));
  await sleep(30);
  check("D #np-queue-btn opens the queue sheet over the standing player", !!d.querySelector(".npq-sheet") && !!d.querySelector(".np-sheet"));
}

console.log(`\nharness-v711: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
