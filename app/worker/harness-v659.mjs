// harness-v659.mjs — v659: the Praylist's uniform section
// cards (accordion · drawn marks · Favorites card last ·
// block pages retired).
//
// Modeled on harness-v657 (the REAL Worker bundle, esbuild
// of worker/src/index.ts, driven through its real routes —
// here "/" for the shell and "/app.js" for the client — over
// a stub env) and harness-v606 (the served client driven in
// jsdom). Global fetch in the page is stubbed to a hanging
// promise: the boot's fetches never settle, so no boot paint
// can land over the fixtures; every paint below is driven
// through the client's own functions on fixture state.
//
// Fixtures (Improvement D — production-shaped, named): the
// descriptor set follows the standing composed-list shapes
// the production seams emit — extSlotTrack's external form
// (the v650 two-track office pair: one slot, two painting
// sides, the second carrying _side650 'sth' per
// extPaintTracks650), own-episode descriptors with a stamped
// occurrence copy (_occ, v610), a podcast descriptor in the
// podDesc form (block 'Podcasts'), a v656 video descriptor
// (kind 'video', vmSeries 'catholictv' per the 19674
// emission), block-less episode descriptors for the tail,
// and starred entries in the store's standing shapes
// (episode / podcast kinds + folder definitions, one custom
// folder empty per v613).
//
// Legs (Plan §4.1): C1 cards paint · C2 accordion · C3 head
// controls · C4 rows in the expansion · C5 landings · C6
// Favorites card + page byte-identity · C7 state discipline
// · C8 regressions (the v642 loading paint + the Edit form).
//
// Run: node app/worker/harness-v659.mjs
// Fail-on-old: OPN_BASE_REF=<git ref of the pristine base>
//   node app/worker/harness-v659.mjs  (C1/C2 must fail: the
//   base client paints no .p659card)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
let JSDOM;
try { ({ JSDOM } = await import("jsdom")); }
catch (e) { ({ JSDOM } = await import(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js"))); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 300) : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- dates ----------
function chicagoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const p = {}; for (const x of parts) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
const DATE = chicagoToday();

// ---------- the real Worker bundle + served shell/client ----------
const TMP = mkdtempSync(tmpdir() + "/v659-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(WT, "app/worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: "t", LOCAL_DEV: "1" };
const SHELL = await (await WORKER.fetch(new Request("https://app.local/"), ENV)).text();
let APPJS = await (await WORKER.fetch(new Request("https://app.local/app.js"), ENV)).text();
// Fail-on-old: OPN_BASE_REF=<git ref> renders the client
// from that ref's pristine client.ts instead of the served
// bundle (the shell stands). C1/C2 must fail there.
if (process.env.OPN_BASE_REF) {
  const baseClient = execFileSync("git", ["-C", WT, "show", process.env.OPN_BASE_REF + ":app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const tmpMod = path.join(TMP, "failonold-client.mjs");
  writeFileSync(tmpMod, baseClient.replace("export const APP_JS =", "globalThis.APP_JS ="));
  await import(tmpMod);
  APPJS = globalThis.APP_JS;
  console.log("fail-on-old mode: client from ref " + process.env.OPN_BASE_REF);
}
check("served client carries the v659 card paint", APPJS.includes("p659card"));

// ---------- fixtures ----------
function desc(o) { return Object.assign({ available: true, durationS: 600, streamUrl: "https://fixture.local/x.mp3", url: "https://fixture.local/x.mp3" }, o); }
function fixtureDescs() {
  return [
    // Morning: the v650 two-track office pair (one slot, two
    // painting sides) + an own prayer and its stamped
    // occurrence copy (v610).
    desc({ episodeId: "ext-morning-prayer", kind: "external", title: "Morning Prayer", block: "Morning", source: "Divine Office", durationS: 1500, streamUrl: "https://fixture.local/do-mp.mp3", url: "https://fixture.local/do-mp.mp3" }),
    desc({ episodeId: "ext-morning-prayer", kind: "external", title: "Morning Prayer", block: "Morning", source: "Sing the Hours", _side650: "sth", durationS: 1400, streamUrl: "https://fixture.local/sth-mp.mp3", url: "https://fixture.local/sth-mp.mp3" }),
    desc({ episodeId: "own-morning-offering", kind: "episode", title: "Morning Offering (Extended)", block: "Morning", durationS: 420 }),
    desc({ episodeId: "own-morning-offering", kind: "episode", title: "Morning Offering (Extended)", block: "Morning", _occ: 1, durationS: 420 }),
    // Midday: one played + one unplayed (the disc's unplayed
    // discipline, C3).
    desc({ episodeId: "midday-angelus", kind: "episode", title: "Angelus", block: "Midday", durationS: 180 }),
    desc({ episodeId: "midday-litany", kind: "episode", title: "Litany of the Saints", block: "Midday", durationS: 700 }),
    // Evening: an external + the v656 video row.
    desc({ episodeId: "ext-evening-prayer", kind: "external", title: "Evening Prayer", block: "Evening", source: "Divine Office", durationS: 1300 }),
    desc({ episodeId: "yt:vid659", kind: "video", videoId: "vid659", vmSeries: "catholictv", title: "Daily TV Mass (Video)", block: "Evening", durationS: 0, imageUrl: "https://i.ytimg.com/vi/vid659/hqdefault.jpg", streamUrl: "", url: "" }),
    // Night: one own episode.
    desc({ episodeId: "own-night-prayer", kind: "episode", title: "Night Prayer", block: "Night", durationS: 500 }),
    // Podcasts: one podcast descriptor (podDesc form).
    desc({ episodeId: "biy-ep-1", kind: "podcast", podSeries: "bible-in-a-year", seriesKey: "biy-1", title: "Day 1: In the Beginning", block: "Podcasts", listened: false, durationS: 1200 }),
    // The block-less Episodes tail.
    desc({ episodeId: "ep-tail-1", kind: "episode", title: "From Today's Podcast — Part 1", durationS: 900 }),
    desc({ episodeId: "ep-tail-2", kind: "episode", title: "From Today's Podcast — Part 2", durationS: 800 }),
  ];
}
function fixtureDay() {
  // The payload fold in its production shape: each block's
  // own tracks stand in day.blocks (the queue builds
  // recompose from these through extRebuildDescs — the
  // [data-queue] handler's standing read), and the
  // block-less tail stands in day.episodes. The external
  // office pair and the occurrence copy enter the composed
  // list through the settings/contents seams in production;
  // here they stand in the composed fixture directly (the
  // paint's source), exactly as those seams emit them.
  const pt = (episodeId, title, durationS) => ({ episodeId, title, available: true, streamUrl: "https://fixture.local/" + episodeId + ".mp3", durationS });
  return {
    date: DATE, presentedDay: DATE, profile: null,
    blocks: [
      { block: "Morning", label: "Morning", tracks: [pt("own-morning-offering", "Morning Offering (Extended)", 420)] },
      { block: "Midday", label: "Midday", tracks: [pt("midday-angelus", "Angelus", 180), pt("midday-litany", "Litany of the Saints", 700)] },
      { block: "Evening", label: "Evening", tracks: [pt("ext-evening-prayer", "Evening Prayer", 1300)] },
      { block: "Night", label: "Night", tracks: [pt("own-night-prayer", "Night Prayer", 500)] },
      { block: "Podcasts", label: "Podcasts", tracks: [] },
    ],
    episodes: [pt("ep-tail-1", "From Today's Podcast — Part 1", 900), pt("ep-tail-2", "From Today's Podcast — Part 2", 800)],
  };
}
function fixtureStarred() {
  return [
    { k: "episode", id: "fav-ep-1", title: "Starred Morning Episode", block: "Morning", durationS: 300, date: DATE, url: "https://fixture.local/fav1.mp3" },
    { k: "podcast", id: "fav-pod-1", series: "bible-in-a-year", title: "Starred Podcast Episode", durationS: 600, date: DATE, url: "https://fixture.local/fav2.mp3" },
    { k: "folder", id: "custom-1", title: "My Folder" },
    { k: "episode", id: "fav-ep-2", title: "Custom Folder Episode", block: "Evening", folder: "custom-1", durationS: 200, date: DATE, url: "https://fixture.local/fav3.mp3" },
    { k: "folder", id: "custom-empty", title: "Empty Folder" },
  ];
}

// ---------- world ----------
async function makeWorld(appJs, opts) {
  opts = opts || {};
  const dom = new JSDOM(SHELL, { url: "https://app.orapronobis.media/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = () => new Promise(() => {}); // boot fetches never settle
  // jsdom's media elements cannot play: stub the transport
  // surface (the queue/start machinery under test is the
  // client's own state, not the element).
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = function () { this.__scrolled659 = true; };
  try { Object.defineProperty(w, "crypto", { value: (await import("node:crypto")).webcrypto }); } catch (e) {}
  w.localStorage.setItem("opn-praylistmode-v612-reset", "1");
  w.localStorage.setItem("opn-praylistmode-v604", opts.mode || "collapsed");
  const s = w.document.createElement("script");
  s.textContent = appJs;
  w.document.body.appendChild(s);
  await sleep(250);
  // Fixture state, in the client's own slots.
  w.state.tab = "prayers";
  w.state.dayPayload = fixtureDay();
  w.state.presentedDay = DATE;
  w.state.dayDescs = fixtureDescs();
  w.state.starred = fixtureStarred();
  w.state.bookFavs = [];
  w.state.repeatIds = { "own-morning-offering": true, "ext-morning-prayer": true };
  w.state.playedCache = { "midday-angelus": { [DATE]: "played" } };
  w.state.prayersView = { kind: "home" };
  w.opnFoldSession604 = {};
  return w;
}
function click(w, el) { el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); }
const cards = (w) => [...w.document.querySelectorAll("[data-p659card]")];
const cardOf = (w, b) => w.document.querySelector('[data-p659card="' + b + '"]');
const headOf = (w, b) => w.document.querySelector('[data-p609sethead="' + b + '"]');
const toggleOf = (w, b) => { const h = headOf(w, b); const t = h && h.querySelector(".p659toggle"); return t ? t.textContent : null; };

// ---------- C1 + C7 first-paint + C2 + C4 (one world) ----------
{
  const w = await makeWorld(APPJS);
  w.paintPrayersView(w.state.dayPayload);
  const order = cards(w).map((c) => c.getAttribute("data-p659card"));
  check("C1 one .p659card per run, in day order, Favorites last", JSON.stringify(order) === JSON.stringify(["Morning", "Midday", "Evening", "Night", "Podcasts", "Episodes", "__favorites"]), order);
  const headOk = ["Morning", "Midday", "Evening", "Night", "Podcasts", "Episodes"].every((b) => {
    const h = headOf(w, b); if (!h) return false;
    return !!h.querySelector(".blockcover.sm svg.p659mark")
      && !!h.querySelector("h2.sectionhead")
      && !!h.querySelector('[data-p615disc="' + b + '"]')
      && !!h.querySelector('[data-p645secmenu="' + b + '"]')
      && !!h.querySelector('[data-p615count="' + b + '"]')
      && h.querySelector(".p659toggle").textContent === "+";
  });
  check("C1 every section head carries tile+mark · name · disc · ⋮ · live count · toggle '+'", headOk);
  check("C1 distinct drawn marks per section (Morning ≠ Midday ≠ Night)", (() => {
    const m = (b) => { const h = headOf(w, b); const s = h && h.querySelector("svg.p659mark"); return s ? s.innerHTML : null; };
    return !!m("Morning") && m("Morning") !== m("Midday") && m("Midday") !== m("Night") && m("Morning") !== m("Night");
  })());
  check("C1 no v612 chevron span stands", !w.document.querySelector(".p612collmark"));
  check("C7 first paint under stored 'collapsed': no card open", cards(w).every((c) => !c.querySelector(".p659body")) && !w.opnExpanded604("Morning"));

  // C2: the accordion.
  click(w, headOf(w, "Morning"));
  await sleep(30);
  check("C2 head tap opens that card (toggle '−', rows stand)", w.opnExpanded604("Morning") && toggleOf(w, "Morning") === "\u2212" && !!cardOf(w, "Morning").querySelector(".p659body"));
  check("C4 the office pair paints both tracks whole in the expansion", (() => {
    const body = cardOf(w, "Morning").querySelector(".p659body");
    return !!body.querySelector('[data-card="ext-morning-prayer"]') && !!body.querySelector('[data-card="ext-morning-prayer@sth"]');
  })());
  check("C4 the stamped occurrence copy stands as its own row", !!cardOf(w, "Morning").querySelector('[data-card="own-morning-offering#1"]'));
  click(w, headOf(w, "Evening"));
  await sleep(30);
  check("C2 opening a second card closes the first (accordion)", !w.opnExpanded604("Morning") && w.opnExpanded604("Evening") && toggleOf(w, "Morning") === "+" && toggleOf(w, "Evening") === "\u2212");
  check("C4 the video row stands in the expansion with its handoff meta", (() => {
    const v = cardOf(w, "Evening").querySelector('[data-card="yt:vid659"]');
    return !!v && /Video · Catholic TV Mass/.test(v.textContent);
  })());
  click(w, headOf(w, "Evening"));
  await sleep(30);
  check("C2 a second tap on the open card closes it (none open)", !w.opnExpanded604("Evening") && cards(w).every((c) => !c.querySelector(".p659body")));

  // C4: a stamped row's ⋮ opens (v653) and Mark as read
  // lands per side/occurrence (v639/v650).
  click(w, headOf(w, "Morning"));
  await sleep(30);
  const sthRow = cardOf(w, "Morning").querySelector('[data-card="ext-morning-prayer@sth"]');
  click(w, sthRow.querySelector("[data-rowmenu]"));
  await sleep(80);
  const rowMenu = [...w.document.querySelectorAll(".anchmenu .menurow")].map((r) => r.textContent.trim());
  check("C4 a stamped row's ⋮ menu opens with Mark as read (v653/v639)", rowMenu.includes("Mark as read"), rowMenu);
  const markRow = [...w.document.querySelectorAll(".anchmenu .menurow")].filter((r) => r.textContent.trim() === "Mark as read")[0];
  click(w, markRow);
  await sleep(50);
  const pm = w.state.playedCache || {};
  check("C4 Mark as read lands on the STH side's own key only (v650)", !!(pm["ext-morning-prayer|Morning@sth"] && pm["ext-morning-prayer|Morning@sth"][DATE]) && !pm["ext-morning-prayer|Morning"], Object.keys(pm));
  const occRow = cardOf(w, "Morning").querySelector('[data-card="own-morning-offering#1"]');
  click(w, occRow.querySelector("[data-rowmenu]"));
  await sleep(80);
  const markRow2 = [...w.document.querySelectorAll(".anchmenu .menurow")].filter((r) => r.textContent.trim() === "Mark as read")[0];
  click(w, markRow2);
  await sleep(50);
  check("C4 Mark as read lands on the occurrence copy's own key (v610)", !!((w.state.playedCache || {})["own-morning-offering|Morning#1"] || {})[DATE], Object.keys(w.state.playedCache || {}));
}

// ---------- C3 head controls (its own world: the disc's
// queue build recomposes state.dayDescs from the payload
// through extRebuildDescs, the production read) ----------
{
  const w = await makeWorld(APPJS);
  w.paintPrayersView(w.state.dayPayload);
  // The disc builds the unplayed set (Midday: angelus
  // played → only the litany queues); a disc tap never folds.
  click(w, w.document.querySelector('[data-p615disc="Midday"]'));
  await sleep(80);
  check("C3 disc tap builds the block's UNPLAYED set only", JSON.stringify((w.state.queue || []).map((d) => d.episodeId)) === JSON.stringify(["midday-litany"]), (w.state.queue || []).map((d) => d.episodeId));
  check("C3 a disc tap never folds the card", !w.opnExpanded604("Midday") && toggleOf(w, "Midday") === "+");
  // The section ⋮ offers exactly Play next · Add to queue.
  click(w, w.document.querySelector('[data-p645secmenu="Midday"]'));
  await sleep(50);
  const menuLabels = [...w.document.querySelectorAll(".anchmenu .menurow")].map((r) => r.textContent.trim());
  check("C3 section ⋮ menu offers exactly Play next · Add to queue", JSON.stringify(menuLabels) === JSON.stringify(["Play next", "Add to queue"]), menuLabels);
  check("C3 a ⋮ tap never folds the card", !w.opnExpanded604("Midday"));
  // Add to queue lands the unplayed set in the queue.
  w.state.queue = []; w.state.queueIdx = -1; w.state.current = null;
  const addRow = [...w.document.querySelectorAll(".anchmenu .menurow")].filter((r) => r.textContent.trim() === "Add to queue")[0];
  click(w, addRow);
  await sleep(50);
  check("C3 Add to queue lands the unplayed set in the player's queue", (w.state.queue || []).some((d) => d.episodeId === "midday-litany") && !(w.state.queue || []).some((d) => d.episodeId === "midday-angelus"), (w.state.queue || []).map((d) => d.episodeId));
  // Play next on a fresh queue starts the set (the v645 rule).
  w.state.queue = []; w.state.queueIdx = -1; w.state.current = null;
  click(w, w.document.querySelector('[data-p645secmenu="Midday"]'));
  await sleep(30);
  const pnRow = [...w.document.querySelectorAll(".anchmenu .menurow")].filter((r) => r.textContent.trim() === "Play next")[0];
  click(w, pnRow);
  await sleep(80);
  check("C3 Play next lands the unplayed set in the player's queue", (w.state.queue || []).some((d) => d.episodeId === "midday-litany"), (w.state.queue || []).map((d) => d.episodeId));
}

// ---------- C2 favorites participation + C6 (one world) ----------
{
  const w = await makeWorld(APPJS);
  w.paintPrayersView(w.state.dayPayload);
  const slot = w.document.getElementById("favorites-folder-slot");
  const homeBody = w.document.getElementById("home-body");
  check("C6 the Favorites card stands LAST (slot below #home-body, before the offline line)", !!slot && !!homeBody && (homeBody.compareDocumentPosition(slot) & 4) !== 0 && slot.nextElementSibling && /offline-line-text/.test(slot.nextElementSibling.innerHTML || "") || (slot.compareDocumentPosition(w.document.getElementById("offline-line-text")) & 4) !== 0);
  const fav = cardOf(w, "__favorites");
  check("C6 closed Favorites card: gold ★ tile · name · meta · toggle, NO disc/⋮", !!fav
    && !!fav.querySelector(".blockcover.tone-gold.sm")
    && fav.querySelector("h2.sectionhead").textContent === "Favorites"
    && /3 tracks/.test(fav.querySelector(".meta").textContent)
    && fav.querySelector(".p659toggle").textContent === "+"
    && !fav.querySelector("[data-p615disc]") && !fav.querySelector("[data-p645secmenu]"), fav && fav.innerHTML.slice(0, 200));
  // Accordion both ways with Favorites.
  click(w, headOf(w, "Morning"));
  await sleep(30);
  click(w, fav.querySelector("[data-p659favhead]"));
  await sleep(30);
  check("C2 opening Favorites closes the open section", w.opnExpanded604("__favorites") && !w.opnExpanded604("Morning"));
  const favBody = cardOf(w, "__favorites").querySelector(".p659body");
  check("C6 open Favorites body carries the folder sections (standing folders stand)", !!favBody
    && !!favBody.querySelector('[data-favfolder="praylist"]')
    && !!favBody.querySelector('[data-favfolder="catechesis"]')
    && !!favBody.querySelector('[data-favfolder="custom-1"]'), favBody && favBody.innerHTML.slice(0, 200));
  check("C6 the empty folder stands hidden in the expansion (v613)", !!favBody && !favBody.querySelector('[data-favfolder="custom-empty"]'));
  click(w, headOf(w, "Night"));
  await sleep(30);
  check("C2 opening a section closes Favorites", w.opnExpanded604("Night") && !w.opnExpanded604("__favorites"));
}

// ---------- C6 second half: the Favorites PAGE byte-identity ----------
{
  let baseJs = null;
  try {
    const baseClient = execFileSync("git", ["-C", WT, "show", "8c62190:app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    const tmpMod = path.join(TMP, "base-client.mjs");
    writeFileSync(tmpMod, baseClient.replace("export const APP_JS =", "globalThis.APP_JS ="));
    await import(tmpMod);
    baseJs = globalThis.APP_JS;
  } catch (e) { /* recorded below */ }
  if (!baseJs) check("C6 base client obtainable for the byte-identity leg", false, "git show failed");
  else {
    const paintFavPage = async (js) => {
      const w = await makeWorld(js);
      w.state.prayersView = { kind: "favorites" };
      w.paintPrayersView(w.state.dayPayload);
      await sleep(30);
      return w.document.getElementById("view").innerHTML + "||" + (w.document.getElementById("hdrrow2") || {}).innerHTML;
    };
    const a = await paintFavPage(APPJS);
    const b = await paintFavPage(baseJs);
    check("C6 paintFavoritesPage's own paint is byte-identical to the base tree's", a === b, a === b ? undefined : { newLen: a.length, baseLen: b.length });
  }
}

// ---------- C5 landings ----------
{
  const w = await makeWorld(APPJS);
  w.paintPrayersView(w.state.dayPayload);
  w.goBlock("Evening");
  await sleep(30);
  check("C5 goBlock lands on the home with the named card expanded + scrolled", w.state.prayersView.kind === "home" && w.opnExpanded604("Evening") && !w.opnExpanded604("Morning") && !!cardOf(w, "Evening").__scrolled659, w.state.prayersView);
  // The pendingBlock consumer + praylistLanding seam, run
  // with the day build's own statements (extracted verbatim
  // from the served client).
  w.opnFoldSession604 = {};
  w.paintPrayersView(w.state.dayPayload);
  w.state.pendingBlock = "Morning";
  const consumer = APPJS.match(/if \(state\.pendingBlock\) \{[^}]*\}/);
  check("C5 the pendingBlock consumer stands in the served client", !!consumer);
  if (consumer) w.eval(consumer[0]);
  await sleep(30);
  check("C5 the pendingBlock seam lands on the expanded card", w.opnExpanded604("Morning") && w.state.prayersView.kind === "home");
  w.eval("praylistLanding = { block: 'Morning', episodeId: 'own-morning-offering' };");
  const landing = APPJS.match(/if \(praylistLanding\) \{[\s\S]*?\n    \}/);
  if (landing) w.eval(landing[0]);
  await sleep(30);
  const landedRow = w.document.querySelector('[data-card="own-morning-offering"]');
  check("C5 praylistLanding accents + scrolls the target row in the expanded card", !!landedRow && landedRow.classList.contains("landed") && !!landedRow.__scrolled659);
  // Podcasts return: with a Podcasts run standing.
  w.returnToPrayPodcastsGroup();
  await sleep(30);
  check("C5 the Podcasts return lands on the Podcasts card", w.state.prayersView.kind === "home" && w.opnExpanded604("Podcasts") && !w.opnExpanded604("Morning"));
  // '__episodes' through the standing [data-openblock] fall-through act.
  w.openBlockPage("__episodes");
  await sleep(30);
  check("C5 '__episodes' lands on the Episodes card", w.opnExpanded604("Episodes") && w.state.prayersView.kind === "home");
  check("C5 no route set prayersView.kind === 'block'", w.state.prayersView.kind !== "block");
  // The Podcasts door act on the expansion's rows: a
  // series-door row (the appendBlockPodcastCards emission)
  // standing in the Podcasts card keeps its goSeries act.
  // (The layer resolver stands retired since v609 — the
  // door has no live producer; the leg proves the wiring on
  // the expansion, §6 names this.)
  w.opnOpenOnly659("Podcasts");
  w.paintPrayersView(w.state.dayPayload);
  const podBody = cardOf(w, "Podcasts").querySelector(".p659body");
  const door = w.document.createElement("div");
  door.innerHTML = '<div class="card" data-daypodseries="bible-in-a-year"><div class="row"><div class="grow"><h3>Bible in a Year</h3></div></div></div>';
  podBody.appendChild(door.firstChild);
  w.wirePrayersView(w.state.dayPayload);
  let seriesAsked = null;
  w.eval("window.__origGoSeries659 = goSeries;");
  click(w, podBody.querySelector("[data-daypodseries]"));
  await sleep(30);
  seriesAsked = w.podOrigin;
  check("C5 a series-door row in the Podcasts expansion keeps its goSeries act", seriesAsked === "prayers" || (w.state.podcasts && w.state.podcasts.series === "bible-in-a-year"), { podOrigin: seriesAsked });
}

// ---------- C7 state discipline ----------
{
  const w = await makeWorld(APPJS, { mode: "expanded" });
  w.paintPrayersView(w.state.dayPayload);
  check("C7 first paint under stored 'expanded': exactly the FIRST card open", w.opnExpanded604("Morning") && !w.opnExpanded604("Midday") && cards(w).filter((c) => c.querySelector(".p659body")).length === 1);
  // The menu: no Expand all; Collapse all stands and closes all.
  w.openHeaderMenu();
  await sleep(30);
  const labels = [...w.document.querySelectorAll(".anchmenu .menurow")].map((r) => r.textContent.trim());
  check("C7 the universal menu no longer offers Expand all; Collapse all stands", !labels.includes("Expand all") && labels.includes("Collapse all"), labels);
  const hereRow = [...w.document.querySelectorAll(".anchmenu .menurow")].filter((r) => /Morning/.test(r.textContent))[0];
  check("C7 the menu 'Here' reads on the open card's block", !!hereRow && /Here/.test(hereRow.textContent), hereRow && hereRow.textContent);
  const collapseRow = [...w.document.querySelectorAll(".anchmenu .menurow")].filter((r) => r.textContent.trim() === "Collapse all")[0];
  click(w, collapseRow);
  await sleep(30);
  check("C7 Collapse all closes every card", cards(w).every((c) => !c.querySelector(".p659body")));
  // Day change: the open card survives by name.
  click(w, headOf(w, "Evening"));
  await sleep(30);
  const day2 = fixtureDay(); day2.date = DATE; day2.presentedDay = DATE;
  w.state.dayPayload = day2;
  w.paintPrayersView(day2);
  check("C7 the open card survives a day change by name", w.opnExpanded604("Evening") && !!cardOf(w, "Evening").querySelector(".p659body"));
  // Vault-locked: the gate stands, no cards in the home body.
  const w2 = await makeWorld(APPJS);
  w2.eval("opnVaultLocked = function () { return true; };");
  w2.paintPrayersView(w2.state.dayPayload);
  const hb = w2.document.getElementById("home-body");
  check("C7 the vault-locked home paints the gate and no section cards", !!hb && !hb.querySelector("[data-p659card]") && hb.innerHTML.length > 0 && !hb.querySelector(".p609set"), hb && hb.innerHTML.slice(0, 120));
}

// ---------- C8 paint-level regressions ----------
{
  const w = await makeWorld(APPJS);
  w.state.dayPending642 = true;
  w.paintPrayersView(w.state.dayPayload);
  const hb8 = w.document.getElementById("home-body");
  check("C8 the v642 loading paint stands while the day is pending (in the home body, no section cards there)", !!hb8 && !!hb8.querySelector("[data-p642loading]") && !hb8.querySelector("[data-p659card]"));
  w.state.dayPending642 = false;
  // The Edit form: its groups paint expanded and card-free.
  w.opn604.res = { profiles: [{ key: "salesian", name: "The Salesian Way", contents: { Morning: [{ kind: "source", key: "morning-prayer" }] } }], effective: { key: "salesian", name: "The Salesian Way" }, state: { standingKey: "salesian" }, todayEdit: null };
  w.opn604.editing = true;
  let editHtml = "";
  try { editHtml = w.opnSetHtml609(w.state.dayPayload); } catch (e) { editHtml = "THREW: " + e.message; }
  check("C8 the Edit form paints (opnSetHtml609 routes to the edit form while editing)", !/^THREW/.test(editHtml) && editHtml.length > 0, editHtml.slice(0, 160));
  check("C8 the Edit form's groups stand card-free (no .p659card)", !/p659card/.test(editHtml));
  check("C8 opnExpanded604's editing read stands (all blocks expanded)", w.opnExpanded604("Morning") === true && w.opnExpanded604("Night") === true);
}

console.log(`\nharness-v659: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
