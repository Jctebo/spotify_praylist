// measure-v711.mjs — v711: Chromium computed-layout
// measurements for the bigger Now Playing buttons (the
// pwtest playwright seat, modeled on measure-v667.mjs: the
// worktree's Worker bundle served locally, state driven to
// the fixture card, openNowPlaying() driven as a user
// drives it).
//
// Fixtures (Plan §2.4, Improvement D — production source
// named, as measure-v667): the field card VERBATIM from
// John's 2026-11-25 11:47 CT screenshot — title "Marian
// Antiphon - Angelus" · meta "Midday" · litday "Memorial of
// Saint Catherine of Alexandria, Virgin and Martyr" · the
// Desiree intention whole — plus the same card with a
// one-line intention.
//
// Legs (Plan §2.4): (a) computed-box growth at 390x844 —
// transport row height >= base 64 + 6, each side control
// taller than its base box (back10/fwd10 50 · prev/next 64),
// play box height = 66, bottom-row members all 50px tall
// (the Queue pill included — it inherits the row); (b) the
// one-page fit at the standing cases — 390 x 844/740/667/568
// x both intentions: inner scrollHeight <= clientHeight,
// artwork square and >= 88px, the Queue button inside the
// sheet, the bottom row one line; (c) the row one line at
// 360/390/412 wide with all six members inside; (d)
// fail-on-old: run with OPN_WT=<a scratch worktree at base
// ff5f0ec> — the same script reads the OLD sizes there
// (transport row 64, controls 44, play 58) and the growth
// legs fail on that tree.
//
// Run: node app/worker/measure-v711.mjs
// Env: OPN_WT (worktree root; default this repo),
//      OPN_SHOT_DIR (screenshot dir; screenshots only when set)
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(process.env.HOME + "/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.OPN_WT || path.resolve(HERE, "..", "..");
const SHOT_DIR = process.env.OPN_SHOT_DIR || "";
const JOHN_FULL = JSON.parse(readFileSync(process.env.HOME + "/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json", "utf8"));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL)); delete JOHN.podcastListens;

const LONG_INTENTION = "For Desiree, that God heal every wound from past broken relationships, bless her co-parenting of Levi with Roy, and lead their whole family to peace in Him. Saint Rita, pray for them.";
const SHORT_INTENTION = "For Desiree. Saint Rita, pray for them.";
const CARD = { available: true, block: "Midday", durationS: 420, episodeId: "marian-antiphon-angelus", imageUrl: null, kind: "episode", source: "", title: "Marian Antiphon - Angelus", url: "https://example.invalid/angelus.mp3" };
const LITDAY = "Memorial of Saint Catherine of Alexandria, Virgin and Martyr";
const DATE = "2026-11-25";
// Base boxes measured at ff5f0ec (Plan §1.2/§1.3, Chromium).
const BASE = { transportRowH: 64, back10H: 50, prevH: 64, nextH: 64, fwd10H: 50, playH: 58, controlsH: 44 };

const TMP = mkdtempSync(tmpdir() + "/v711meas-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(WT, "app/worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;
const DB = { prepare: (sql) => { let args = []; const stmt = { bind(...a) { args = a; return stmt; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }; return stmt; }, batch: async () => [] };
const ENV = { DB, AGENT_TOKEN: "measure", LOCAL_DEV: "1" };
const SHELL = await (await WORKER.fetch(new Request("https://app.local/"), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request("https://app.local/app.js"), ENV)).text();
const CSS = await (await WORKER.fetch(new Request("https://app.local/styles.css"), ENV)).text();
const isNew = /\.np-controls \.btn\.ghost \{ min-height:50px/.test(CSS) && /\.np-play \{ width:66px/.test(CSS);
console.log("WT:", WT, "| new sizes served:", isNew, "| css has .np-tbtn 30px:", /\.np-tbtn \{[^}]*font-size:30px/.test(CSS));
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/app.js")) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(APPJS); }
  if (req.url.startsWith("/styles.css")) { res.writeHead(200, { "content-type": "text/css" }); return res.end(CSS); }
  res.writeHead(200, { "content-type": "text/html" }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.addInitScript((john) => {
  try { localStorage.setItem("opn-personal-data-v1", JSON.stringify(john)); } catch (e) {}
  window.fetch = () => new Promise(() => {}); // freeze boot network; drive state directly (v663/v664 pattern)
}, JOHN);
await pg.goto("http://127.0.0.1:" + PORT + "/");
await pg.waitForTimeout(1000);

async function standCard(intention) {
  await pg.evaluate(({ card, litday, intention, date }) => {
    const d = JSON.parse(JSON.stringify(card));
    state.presentedDay = date;
    state.dayPayload = { presentedDay: date, date: date, dayPositions: {} };
    state.dateLabel = "Tuesday, November 25, 2026";
    state.liturgical = { name: litday };
    state.dayDescs = [d];
    state.queue = [d]; state.queueIdx = 0; state.current = d; state.pendingStart = null;
    state.trackDraws = {}; state.trackDrawsDate = date; state.trackDrawsPending = {};
    const k = trackKeyOf(d);
    if (k) state.trackDraws[k] = intention;
    openNowPlaying();
  }, { card: CARD, litday: LITDAY, intention, date: DATE });
  await pg.waitForTimeout(400);
}
async function measure(vh) {
  return pg.evaluate((vh) => {
    const sheet = document.querySelector(".np-sheet");
    const inner = sheet && sheet.querySelector(".inner");
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), insideVp: r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= innerWidth + 1 }; };
    const art = document.querySelector("#np-art");
    const row = document.querySelector(".np-controls");
    const members = row ? [...row.querySelectorAll(":scope > button")].map((m) => ({ id: m.id, ...box(m) })) : [];
    const trow = document.querySelector(".np-transport");
    const tmembers = trow ? [...trow.querySelectorAll(":scope > button")].map((m) => ({ id: m.id, ...box(m) })) : [];
    const rowBox = box(row);
    const tops = members.map((m) => m.top);
    return {
      vh, vw: innerWidth,
      innerBox: inner ? box(inner) : null,
      innerScrollH: inner && inner.scrollHeight, innerClientH: inner && inner.clientHeight,
      fit: inner ? inner.scrollHeight <= inner.clientHeight : null,
      art: art ? { ...box(art), square: Math.abs(art.getBoundingClientRect().width - art.getBoundingClientRect().height) <= 1, inlineArt: art.style.getPropertyValue("--art") || null } : null,
      queueBtn: box(document.querySelector("#np-queue-btn")),
      transport: box(trow), tmembers,
      play: box(document.querySelector("#np-play")),
      row: rowBox, members,
      rowOneLine: members.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2,
      rowAllInside: !!rowBox && members.every((m) => m.left >= rowBox.left - 1 && m.right <= rowBox.right + 1),
    };
  }, vh);
}

let ok = 0, bad = 0;
let art667Long = null;
// (a) growth boxes at 390x844, long intention.
await pg.setViewportSize({ width: 390, height: 844 });
await standCard(LONG_INTENTION);
{
  const m = await measure(844);
  const tm = Object.fromEntries(m.tmembers.map((x) => [x.id, x]));
  console.log("GROWTH", JSON.stringify({ transport: m.transport, tmembers: m.tmembers.map((x) => [x.id, x.w, x.h]), play: m.play, members: m.members.map((x) => [x.id, x.w, x.h]) }));
  if (isNew) {
    const legs = [
      ["transport row height >= base 64 + 6", m.transport && m.transport.h >= BASE.transportRowH + 6],
      ["back10 taller than base 50", tm["np-back10"] && tm["np-back10"].h > BASE.back10H],
      ["prev taller than base 64", tm["np-prev"] && tm["np-prev"].h > BASE.prevH],
      ["next taller than base 64", tm["np-next"] && tm["np-next"].h > BASE.nextH],
      ["fwd10 taller than base 50", tm["np-fwd10"] && tm["np-fwd10"].h > BASE.fwd10H],
      ["play box height = 66", m.play && m.play.h === 66],
      ["bottom-row members all 50px tall (Queue pill included)", m.members.length === 6 && m.members.every((x) => x.h === 50)],
    ];
    for (const [name, pass] of legs) { if (pass) { ok++; console.log("ok   growth:", name); } else { bad++; console.log("FAIL growth:", name); } }
  } else {
    const oldRead = m.transport && m.transport.h === BASE.transportRowH && m.play && m.play.h === BASE.playH && m.members.length === 6 && m.members.every((x) => x.h === BASE.controlsH);
    console.log("FAIL-ON-OLD sizes at base:", JSON.stringify({ transportRowH: m.transport && m.transport.h, playH: m.play && m.play.h, memberHs: m.members.map((x) => x.h) }));
    if (oldRead) { ok++; console.log("FAIL-ON-OLD CONFIRMED: the base tree reads the old sizes (transport 64 · play 58 · controls 44) — the growth legs fail there"); }
    else { bad++; console.log("FAIL-ON-OLD NOT REPRODUCED: base sizes differ from the Plan §1 measurement"); }
  }
}
// (b) the fit leg at the standing cases.
for (const [label, intention] of [["long", LONG_INTENTION], ["one-line", SHORT_INTENTION]]) {
  for (const h of [844, 740, 667, 568]) {
    await pg.setViewportSize({ width: 390, height: h });
    await standCard(intention);
    const m = await measure(h);
    console.log("MEASURE", label, JSON.stringify({ h, fit: m.fit, scroll: m.innerScrollH, client: m.innerClientH, art: m.art && m.art.h, artInline: m.art && m.art.inlineArt, queueBtn: m.queueBtn && [m.queueBtn.top, m.queueBtn.bottom], rowOneLine: m.rowOneLine }));
    if (label === "long" && h === 667) art667Long = m.art && m.art.h;
    if (isNew) {
      const pass = m.fit && m.queueBtn && m.queueBtn.insideVp && m.queueBtn.bottom <= h + 1 && m.art && m.art.square && m.art.h >= 88 && m.rowOneLine && m.rowAllInside;
      if (pass) { ok++; console.log("ok   fit:", label, h); } else { bad++; console.log("FAIL fit:", label, h); }
    }
  }
}
console.log("ART-667-LONG:", art667Long, "px (88px floor; Plan §2.3 predicted ~194)");
// (c) the row one line at 360/390/412 wide.
await pg.setViewportSize({ width: 390, height: 844 });
for (const wdt of [360, 390, 412]) {
  await pg.setViewportSize({ width: wdt, height: 844 });
  await standCard(LONG_INTENTION);
  const m = await measure(844);
  console.log("ROW", wdt, JSON.stringify({ oneLine: m.rowOneLine, allInside: m.rowAllInside, row: m.row, members: m.members.map((x) => [x.id, x.left, x.right, x.top, x.h]) }));
  if (isNew) { if (m.rowOneLine && m.rowAllInside && m.members.length === 6) { ok++; console.log("ok   row one line at", wdt); } else { bad++; console.log("FAIL row", wdt); } }
}
// Screenshots (new tree only, when a dir is named).
if (isNew && SHOT_DIR) {
  mkdirSync(SHOT_DIR, { recursive: true });
  await pg.setViewportSize({ width: 390, height: 844 });
  await standCard(LONG_INTENTION);
  await pg.screenshot({ path: SHOT_DIR + "/01-card-long-intention.png" });
  console.log("shots saved to", SHOT_DIR);
}
await b.close(); server.close();
console.log(`measure-v711: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
