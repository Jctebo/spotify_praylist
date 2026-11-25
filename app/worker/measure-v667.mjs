// measure-v667.mjs — v667: Chromium fit measurements for the
// Now Playing card (the pwtest playwright seat, the standing
// pattern of docs/releases/v664.md §10: the worktree's Worker
// bundle served locally, state driven to the fixture card,
// openNowPlaying() driven as a user drives it).
//
// Fixtures (Plan §2.4, Improvement D — production source
// named): the field card VERBATIM from John's 2026-11-25
// 11:47 CT screenshot — title "Marian Antiphon - Angelus" ·
// meta "Midday" · litday "Memorial of Saint Catherine of
// Alexandria, Virgin and Martyr" · the Desiree intention
// whole (the card paints it prefixed "Intention: ") — plus
// the same card with a one-line intention.
//
// Gate geometries: heights 844/740/667/568 at 390 wide, both
// intentions; the bottom row measured at 360/390/412 wide.
// New tree: assert the Queue button's box inside the
// viewport and the sheet, inner scrollHeight <= clientHeight,
// art square and >= 88px, the row on one line at 360px.
// Fail-on-old: run with OPN_WT=<a scratch worktree at base
// 203c624> — the same script reports the v664 foot door's
// box clipped at 844 with the long intention.
//
// Run: node app/worker/measure-v667.mjs
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

const TMP = mkdtempSync(tmpdir() + "/v667meas-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(WT, "app/worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;
const DB = { prepare: (sql) => { let args = []; const stmt = { bind(...a) { args = a; return stmt; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }; return stmt; }, batch: async () => [] };
const ENV = { DB, AGENT_TOKEN: "measure", LOCAL_DEV: "1" };
const SHELL = await (await WORKER.fetch(new Request("https://app.local/"), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request("https://app.local/app.js"), ENV)).text();
const CSS = await (await WORKER.fetch(new Request("https://app.local/styles.css"), ENV)).text();
console.log("WT:", WT, "| bundle shell/appjs/css:", SHELL.length, APPJS.length, CSS.length, "| has #np-queue-btn in appjs:", APPJS.includes("np-queue-btn"), "| has #np-queue-door in appjs:", APPJS.includes("np-queue-door"));
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
    const rowBox = box(row);
    const tops = members.map((m) => m.top);
    return {
      vh, vw: innerWidth,
      innerBox: inner ? box(inner) : null,
      innerScrollH: inner && inner.scrollHeight, innerClientH: inner && inner.clientHeight,
      fit: inner ? inner.scrollHeight <= inner.clientHeight : null,
      title: (document.querySelector("#np-title") || {}).textContent,
      meta: (document.querySelector("#np-meta") || {}).textContent,
      litday: (document.querySelector("#np-litday") || {}).textContent,
      intentionText: (document.querySelector("#np-track-intention") || {}).textContent,
      intention: box(document.querySelector("#np-track-intention")),
      art: art ? { ...box(art), square: Math.abs(art.getBoundingClientRect().width - art.getBoundingClientRect().height) <= 1, inlineArt: art.style.getPropertyValue("--art") || null } : null,
      queueBtn: box(document.querySelector("#np-queue-btn")),
      door: box(document.querySelector("#np-queue-door")),
      row: rowBox, members,
      rowOneLine: members.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2,
      rowAllInside: !!rowBox && members.every((m) => m.left >= rowBox.left - 1 && m.right <= rowBox.right + 1),
    };
  }, vh);
}

let ok = 0, bad = 0;
const isNew = APPJS.includes("np-queue-btn");
for (const [label, intention] of [["long", LONG_INTENTION], ["one-line", SHORT_INTENTION]]) {
  for (const h of [844, 740, 667, 568]) {
    await pg.setViewportSize({ width: 390, height: h });
    await standCard(intention);
    const m = await measure(h);
    console.log("MEASURE", label, JSON.stringify(m));
    if (isNew) {
      const pass = m.fit && m.queueBtn && m.queueBtn.insideVp && m.queueBtn.bottom <= h + 1 && m.art && m.art.square && m.art.h >= 88 && m.rowOneLine && m.rowAllInside;
      if (pass) ok++; else { bad++; console.log("FAIL", label, h); }
    } else if (label === "long") {
      // The door is clipped when its box runs past the .inner's
      // box (overflow:hidden clips at the inner's foot) — at
      // 390 wide that is whole at 740/667 (the door's top stands
      // below the inner's bottom); at 844 the 72vw art cap
      // leaves 8px of slack at 390 wide, so the 844 leg below
      // runs at 430 wide, where the dvh term binds as priced.
      const clipped = m.door && m.innerBox && m.door.bottom > m.innerBox.bottom + 1;
      console.log("FAIL-ON-OLD door at " + h + "/long/390w:", JSON.stringify(m.door), "innerBox:", JSON.stringify(m.innerBox), "clipped:", !!clipped, "innerScroll/client:", m.innerScrollH, m.innerClientH);
      if (h === 740 || h === 667) { if (clipped) ok++; else { bad++; console.log("FAIL-ON-OLD NOT REPRODUCED at", h); } }
    }
  }
}
if (!isNew) {
  // Fail-on-old at John's screenshot geometry: his shot is
  // 1248x1972 with the artwork at ~197 CSS px — the dvh-bound
  // size at a ~412x667 CSS viewport. At 412x667 the door's
  // box runs past the inner's foot and is clipped there.
  // (At 844 in headless Chromium the base door is NOT
  // clipped at any width 360-430: the 72vw art cap leaves
  // slack and Chromium wraps the intention at 4 lines where
  // the device paints 5 — recorded in v667.md §7.)
  await pg.setViewportSize({ width: 412, height: 667 });
  await standCard(LONG_INTENTION);
  const m = await measure(667);
  const clipped = m.door && m.innerBox && m.door.bottom > m.innerBox.bottom + 1;
  console.log("FAIL-ON-OLD door at 667/long/412w (John's screenshot geometry):", JSON.stringify(m.door), "innerBox:", JSON.stringify(m.innerBox), "clipped:", !!clipped, "innerScroll/client:", m.innerScrollH, m.innerClientH);
  if (clipped) { ok++; console.log("FAIL-ON-OLD CONFIRMED: the door is clipped with the long intention (also whole at 740/667, 390 wide — see the MEASURE lines)"); }
  else { bad++; console.log("FAIL-ON-OLD NOT REPRODUCED at 667/412w"); }
  await pg.setViewportSize({ width: 390, height: 844 });
}
// Row widths (longest Intentions label "Intentions On" stands by default).
await pg.setViewportSize({ width: 390, height: 844 });
for (const wdt of [360, 390, 412]) {
  await pg.setViewportSize({ width: wdt, height: 844 });
  await standCard(LONG_INTENTION);
  const m = await measure(844);
  console.log("ROW", wdt, JSON.stringify({ oneLine: m.rowOneLine, allInside: m.rowAllInside, row: m.row, members: m.members.map((x) => [x.id, x.left, x.right, x.top]) }));
  if (isNew) { if (m.rowOneLine && m.rowAllInside && m.members.length === 6) ok++; else { bad++; console.log("FAIL row", wdt); } }
}
// Screenshots (new tree only, when a dir is named).
if (isNew && SHOT_DIR) {
  mkdirSync(SHOT_DIR, { recursive: true });
  await pg.setViewportSize({ width: 390, height: 844 });
  await standCard(LONG_INTENTION);
  await pg.screenshot({ path: SHOT_DIR + "/01-card-long-intention.png" });
  await pg.click("#np-queue-btn");
  await pg.waitForTimeout(500);
  const sheetInfo = await pg.evaluate(() => { const s = document.querySelector(".npq-sheet"); const inner = s && s.querySelector(".inner"); const r = inner && inner.getBoundingClientRect(); return { stands: !!s, dvh: r && +(r.height / innerHeight * 100).toFixed(1), text: s && s.textContent.replace(/\s+/g, " ").trim().slice(0, 160) }; });
  console.log("SHEET", JSON.stringify(sheetInfo));
  await pg.screenshot({ path: SHOT_DIR + "/02-sheet-open.png" });
  console.log("shots saved to", SHOT_DIR);
}
await b.close(); server.close();
console.log(`measure-v667: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
