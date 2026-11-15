#!/usr/bin/env node
// harness-v452 — Intentions, cleaned: Prayers layout,
// hamburger menus, floating add button (John, main chat,
// 2026-11-15 16:07-16:08 CT; approved package 27, record 18:
// D1 B · D2 B · D3 A · D4 A · To Ship). Measured: (1) the
// clean paint — renderIntentions' settled paint is the
// headrow (title + the heading ☰) + the redraw note slot,
// ONE flat list of rows in High → Medium → Low order (the
// API's order within each priority), the Retired section
// at the bottom, the floating add button; the stats strip,
// the "the pool" sub-line, the about paragraph, the Add
// card, and the per-priority section heads are retired
// whole (census 0 in the paint); intentionRow is the clean
// card row — text + the .pri tag + its own ☰, NO drawn-
// history line, NO standing buttons; (2) the menus — both
// open through openSheetMenu anchored at their ☰: the
// heading menu ("Intentions") carries Redraw AND Add
// intention (D3 A, as John chose it); each row's menu
// ("Intention") carries Edit · Retire/Restore · Delete,
// Delete behind the standing openConfirm (proven: no
// DELETE call stands while the confirm stands); every act
// fires the identical endpoint + settleIntentions the
// retired buttons fired; (3) the floating button + the one
// sheet — .intfab (ui.ts, tokens only) seats above the tab
// bar and, under body.dock-on, above the dock (the CSS-form
// proof: the standing dock state simulated on the root);
// openIntentionEditor is ONE form for add (null) and edit
// (an entry), its priority control the three-way segmented
// control in both forms, Medium the add form's default; the
// failure branches stand (a refused add keeps the sheet
// open, the draft intact, the note naming the failure); a
// mutation answered redrawn:false stands the redraw
// failure line in the head's note slot after the settle;
// (4) the skeleton + authored failure paints stand, their
// heads in the new headrow form. Mold: harness-v439/v451's
// whole-client boot (the real SHELL_HTML + APP_CSS + the
// whole COOKED APP_JS, fetch stubbed by path with a
// stateful intentions pool the mutations act on).
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v452 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const CSS = UI.slice(UI.indexOf("APP_CSS = `") + 11, UI.indexOf("`;", UI.indexOf("APP_CSS = `")));
const SHELL = UI.slice(UI.indexOf("SHELL_HTML = `") + 14, UI.indexOf("`;", UI.indexOf("SHELL_HTML = `")));
const BASE = "release/v451-ship";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };

function extractFn(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error("extract: function not found: " + name);
  let i = src.indexOf("{", at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (!depth) return src.slice(at, j + 1); }
  }
  throw new Error("extract: unbalanced: " + name);
}

/* ---------------- statics ---------------- */
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", BASE, "--", "app/worker/src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]),
    "S1 the worker-source diff vs the v451-ship base is client.ts + ui.ts only — no index.ts, no migration (got: " + changed.join(", ") + ")");
  const paint = extractFn(CLIENT, "renderIntentions");
  ok(!paint.includes("new-text") && !paint.includes("new-pri") && !paint.includes("new-add") && !paint.includes('class="stats"')
    && !paint.includes("the pool") && !paint.includes('class="about"') && !paint.includes('id="int-redraw"')
    && paint.includes('id="int-menu"') && paint.includes('id="int-fab"') && paint.includes('id="int-redraw-note"'),
    "S2 the retired seats' census in the paint: the Add-card ids, the stats strip, the sub-line, the about paragraph, and the old Redraw button id all read 0 — the headrow (title + ☰), the note slot, and the FAB stand");
  const row = extractFn(CLIENT, "intentionRow");
  ok(!row.includes("drawnCount") && !row.includes("data-act") && !row.includes("btn ghost") && !row.includes("librow")
    && row.includes("data-intmenu") && row.includes('class="pri ') && row.includes('card introw'),
    "S2 the clean row form: no history read, no standing act buttons, no librow — the card row carries the text, the .pri tag, and its ☰ (data-intmenu)");
  const wire = extractFn(CLIENT, "wireIntentions");
  ok(wire.includes("openSheetMenu('Intentions'") && wire.includes("openSheetMenu('Intention'") && wire.includes("runIntentionsRedraw")
    && wire.includes("openConfirm") && !wire.includes("data-act"),
    "S3 both menus open through openSheetMenu (the heading's 'Intentions', the row's 'Intention'); the redraw runner and the standing confirm stand in the wiring; the retired data-act wiring is gone");
  const ed = extractFn(CLIENT, "openIntentionEditor");
  ok(ed.includes("var adding = !it;") && ed.includes("adding ? 'M' : it.priority") && ed.includes("data-pri")
    && ed.includes("'Add to the pool'") && ed.includes("method: 'PATCH'") && ed.includes("post('/api/prayer/intentions'")
    && !ed.includes("<select"),
    "S3 the one sheet: entry-or-null (the add branch defaults Medium), the segmented priority control (data-pri, no <select> stands), the Add act, and both standing calls (POST add · PATCH edit)");
  ok(UI.includes(".intfab {") && UI.includes("body.dock-on .intfab") && UI.includes("background:var(--navy)") && UI.includes("color:var(--gold)"),
    "S4 the .intfab rule stands in ui.ts with its dock-on seat, dressed from the theme tokens (navy ground, the gold +)");
  let bundles = true;
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v452-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  } catch { bundles = false; }
  ok(bundles, "S4 the whole worker bundles clean (esbuild)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v451-1";'),
    "S5 (housekeeping): the SW pin stands at ora-pro-nobis-v451-1 (Ship moves it)");
  const TPL_A = CLIENT.indexOf("APP_JS = `") + 10;
  const RAW_JS = CLIENT.slice(TPL_A, CLIENT.indexOf("`;", TPL_A));
  let cooked = null, parseErr = null;
  try { cooked = new Function("return `" + RAW_JS + "`")(); new vm.Script(cooked); } catch (e) { parseErr = e; }
  ok(cooked != null && !parseErr, "S5 the whole cooked APP_JS parses (vm.Script) — the v439 gate re-run on the new code", parseErr && parseErr.message);
  const VALID = new Set(["'", '"', "`", "$", "\\", "b", "f", "n", "r", "t", "v", "0", "\n"]);
  let census = 0;
  for (let i = 0; i < RAW_JS.length; i++) {
    if (RAW_JS[i] !== "\\") continue;
    const nx = RAW_JS[i + 1];
    if (nx === undefined) break;
    if (nx === "\\") { i++; continue; }
    if (nx === "u" && (/^[0-9a-fA-F]{4}$/.test(RAW_JS.slice(i + 2, i + 6)) || RAW_JS[i + 2] === "{")) { i += 5; continue; }
    if (nx === "x" && /^[0-9a-fA-F]{2}$/.test(RAW_JS.slice(i + 2, i + 4))) { i += 3; continue; }
    if (VALID.has(nx)) { i++; continue; }
    census++; i++;
  }
  ok(census === 0, "S5 the single-backslash census inside APP_JS stands at 0 (the v439/v440 rule)", "census=" + census);
}

/* ---------------- fixtures ---------------- */
const tracks = (base, count, label) => Array.from({ length: count }, (_, i) => ({ episodeId: String(base + i), title: label + " track " + (i + 1), durationS: 240, available: true, streamUrl: "__ORIGIN__/audio/" + (base + i) + ".wav" }));
const DAY = {
  ok: true, date: "2026-11-15", presentedDay: "2026-11-15", dateLabel: "Sunday, November 15, 2026",
  liturgicalDay: { name: "33rd Sunday in Ordinary Time", color: "green" },
  introTexts: {},
  blocks: [
    { block: "Morning", label: "Morning", caption: "", tracks: tracks(9000, 3, "Morning") },
    { block: "Novenas", label: "Novenas", caption: "Parish novena", tracks: tracks(9500, 1, "Novenas") },
  ],
  episodes: [{ episodeId: "9901", title: "Podcast Episode One", durationS: 300, available: true, streamUrl: "__ORIGIN__/audio/9901.wav" }],
};
// The pool stands in a scrambled API order (L · H · M · H ·
// retired M) so the flat H → M → L paint order is the
// paint's own work, never the fixture's accident. Drawn
// history stands on the rows (12, 13, 15) — D2 B says it
// reads nowhere on a row.
const POOL = [
  { id: 11, text: "For the parish pilgrimage", priority: "L", status: "active", drawnCount: 0, lastDrawn: null, created_at: "2026-11-01T00:00:00Z" },
  { id: 12, text: "For my mother, in her illness", priority: "H", status: "active", drawnCount: 3, lastDrawn: "2026-11-14", created_at: "2026-10-20T00:00:00Z" },
  { id: 13, text: "For the team at work", priority: "M", status: "active", drawnCount: 1, lastDrawn: "2026-11-10", created_at: "2026-11-02T00:00:00Z" },
  { id: 14, text: "For a friend discerning", priority: "H", status: "active", drawnCount: 0, lastDrawn: null, created_at: "2026-11-05T00:00:00Z" },
  { id: 15, text: "For the old house intention", priority: "M", status: "retired", drawnCount: 5, lastDrawn: "2026-09-30", created_at: "2026-09-01T00:00:00Z" },
];

const TPL_A2 = CLIENT.indexOf("APP_JS = `") + 10;
const COOKED = new Function("return `" + CLIENT.slice(TPL_A2, CLIENT.indexOf("`;", TPL_A2)) + "`")();
function makePage(fix) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__calls = [];
window.__stub = ${JSON.stringify(fix.STUB || {})};
var FIX = ${JSON.stringify(fix)};
var POOL = JSON.parse(JSON.stringify(FIX.POOL));
window.fetch = function (path, opts) {
  var p = String(path);
  var J = function (obj) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(obj))); } }); };
  if (p.indexOf('/api/prayer/intentions') === 0) {
    var m = (opts && opts.method) || 'GET';
    window.__calls.push(m + ' ' + p + (opts && opts.body ? ' ' + opts.body : ''));
    var parts = p.split('/');
    if (m === 'GET') { if (window.__stub.failLoad) return Promise.reject(new Error('load refused')); return J({ intentions: POOL }); }
    if (m === 'POST' && parts.length === 4) {
      if (window.__stub.failAdd) return Promise.reject(new Error('add refused'));
      var body = JSON.parse(opts.body);
      POOL.push({ id: 99, text: body.text, priority: body.priority, status: 'active', drawnCount: 0, lastDrawn: null, created_at: '2026-11-15T00:00:00Z' });
      return J({ ok: true, redrawn: !window.__stub.redrawnFalse });
    }
    var id = Number(parts[4]);
    var row = POOL.filter(function (x) { return x.id === id; })[0];
    if (m === 'POST' && parts[5] === 'status') { if (row) row.status = JSON.parse(opts.body).status; return J({ ok: true, redrawn: !window.__stub.redrawnFalse }); }
    if (m === 'PATCH') { if (window.__stub.failSave) return Promise.reject(new Error('save refused')); var b2 = JSON.parse(opts.body); if (row) { row.text = b2.text; row.priority = b2.priority; } return J({ ok: true, redrawn: true }); }
    if (m === 'DELETE') { POOL = POOL.filter(function (x) { return x.id !== id; }); return J({ ok: true, redrawn: true }); }
    return J({ ok: true });
  }
  if (p === '/api/prayer/redraw') { window.__calls.push('POST ' + p); if (window.__stub.failRedraw) return Promise.reject(new Error('redraw refused')); return J({ ok: true }); }
  if (p.indexOf('/api/prayer/day') === 0) return J(FIX.DAY);
  if (p.indexOf('/api/player/day') === 0) return J(FIX.DAY);
  if (p.indexOf('/api/player/podcasts') === 0) return J({ seriesList: [] });
  if (p.indexOf('/api/player/source-settings') === 0) return J({ sources: [], version: 3 });
  if (p.indexOf('/api/pin/state') === 0) return J({ pinSet: true, retryAfterSeconds: 0 });
  if (p.indexOf('/api/player/feed-audio') === 0) return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  return J({ ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
</` + `script>
<script>
${COOKED}
</` + `script>
</body></html>`;
}

const PAGES = {
  "/": makePage({ DAY, POOL }),
  "/fail": makePage({ DAY, POOL, STUB: { failLoad: true } }),
};
let pageHtml = "";
const server = http.createServer((req, res) => {
  const p = (req.url || "/").split("?")[0];
  if (PAGES[p]) { res.setHeader("Content-Type", "text/html"); res.end(PAGES[p].split("__ORIGIN__").join(pageHtml)); return; }
  res.statusCode = 404; res.end("not found");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;
pageHtml = ORIGIN;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  const ev = (fn) => page.evaluate(fn);
  const until = async (fn, timeout) => { try { await page.waitForFunction(fn, null, { timeout: timeout || 6000 }); return true; } catch { return false; } };

  await page.goto(ORIGIN + "/");
  await page.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await sleep(400);
  ok(await ev(`!document.getElementById('int-fab')`),
    "P0 the floating add button stands NOWHERE on the Prayers side — it is the Intentions paint's alone");

  /* ---- the clean paint ---- */
  await ev(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await page.waitForSelector('#int-fab', { timeout: 6000 });
  await sleep(300);
  const paint = await ev(`(function(){
    var host = document.getElementById('sidehost');
    var rows = Array.prototype.slice.call(host.querySelectorAll('.introw'));
    var retHead = Array.prototype.slice.call(host.querySelectorAll('.sectionhead')).filter(function (h) { return h.textContent.trim() === 'RETIRED'; })[0];
    return {
      headTitle: (host.querySelector('.headrow h1') || {}).textContent || null,
      headMenu: !!host.querySelector('.headrow #int-menu'),
      order: rows.map(function (r) { return Number(r.querySelector('[data-intmenu]').getAttribute('data-intmenu')); }),
      tags: rows.map(function (r) { var t = r.querySelector('.pri'); return t ? t.className + ':' + t.textContent.trim() : null; }),
      rowText: rows.map(function (r) { return r.textContent; }),
      anyAct: !!host.querySelector('[data-act]'),
      anyMeta: rows.some(function (r) { return !!r.querySelector('.meta'); }),
      retAfter: retHead ? rows.every(function (r, i) { return i < 4 || (retHead.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING); }) : false,
      retMuted: rows.length === 5 ? (rows[4].querySelector('.grow div').getAttribute('style') || '') : '',
      stats: !!host.querySelector('.stats'), about: !!host.querySelector('.about'),
      addCard: !!document.getElementById('new-text'), oldRedraw: !!document.getElementById('int-redraw'),
      hostText: host.textContent
    };
  })()`);
  ok(paint.headTitle === "Intentions" && paint.headMenu,
    "P1 the head reads in the new form: the headrow carries the title and the heading ☰ at its right", JSON.stringify({ t: paint.headTitle, m: paint.headMenu }));
  ok(JSON.stringify(paint.order) === JSON.stringify([12, 14, 13, 11, 15])
    && JSON.stringify(paint.tags) === JSON.stringify(["pri H:High", "pri H:High", "pri M:Medium", "pri L:Low", "pri M:Medium"]),
    "P2 ONE flat list in High → Medium → Low order (the API's order within each priority — the fixture stood L·H·M·H), each row carrying its .pri tag; the retired row stands last", JSON.stringify({ order: paint.order, tags: paint.tags }));
  ok(!paint.anyAct && !paint.anyMeta && paint.rowText.every(function (t) { return !/drawn/i.test(t); }),
    "P3 a row carries text + tag + ☰ and NOTHING else — no standing act buttons (no [data-act] in the paint), no meta line, no drawn-history text anywhere on a row (D2 B)", JSON.stringify(paint.rowText.map((t) => t.slice(0, 40))));
  ok(paint.retAfter && paint.retMuted.includes("--muted"),
    "P4 the Retired section stands at the bottom under its quiet head, its row in the same form with muted text", JSON.stringify({ after: paint.retAfter, style: paint.retMuted }));
  ok(!paint.stats && !paint.about && !paint.addCard && !paint.oldRedraw && !paint.hostText.includes("the pool") && !paint.hostText.includes("Your intentions live only"),
    "P5 the retired chrome stands nowhere: no stats strip, no about paragraph, no Add card, no standing Redraw button, no 'the pool' sub-line (D4 A)");

  /* ---- the FAB seat ---- */
  const fabGeo = await ev(`(function(){
    var fab = document.getElementById('int-fab').getBoundingClientRect();
    var tab = document.getElementById('tabbar').getBoundingClientRect();
    return { gap: Math.round(window.innerHeight - fab.bottom - tab.height), right: Math.round(window.innerWidth - fab.right), w: Math.round(fab.width), h: Math.round(fab.height) };
  })()`);
  ok(fabGeo.w === 56 && fabGeo.h === 56 && Math.abs(fabGeo.gap - 14) <= 2 && Math.abs(fabGeo.right - 12) <= 2,
    "P6 the FAB is the 56px disc, seated 14px above the tab bar with its right edge at the content edge (12px)", JSON.stringify(fabGeo));
  const fabDock = await ev(`(function(){
    document.documentElement.style.setProperty('--dockh', '64px');
    document.body.classList.add('dock-on');
    var fab = document.getElementById('int-fab').getBoundingClientRect();
    var tab = document.getElementById('tabbar').getBoundingClientRect();
    var gap = Math.round(window.innerHeight - fab.bottom - tab.height);
    document.body.classList.remove('dock-on');
    return gap;
  })()`);
  ok(Math.abs(fabDock - (64 + 14)) <= 2,
    "P7 under the standing dock state (body.dock-on, --dockh set as the dock seats it) the FAB clears the dock too: its gap above the tab bar grows by the dock's height + the margin", "gap=" + fabDock);

  /* ---- the heading menu (D3 A) ---- */
  await ev(`document.getElementById('int-menu').click()`);
  await page.waitForSelector('.anchmenu', { timeout: 4000 });
  const headMenu = await ev(`(function(){
    var card = document.querySelector('.anchmenu');
    return { title: (card.querySelector('h1') || {}).textContent || null,
      labels: Array.prototype.slice.call(card.querySelectorAll('[data-menuitem]')).map(function (b) { return b.textContent.trim(); }) };
  })()`);
  ok(headMenu.title === "Intentions" && JSON.stringify(headMenu.labels) === JSON.stringify(["Redraw", "Add intention"]),
    "M1 the heading ☰ opens the anchored menu titled 'Intentions' carrying Redraw AND Add intention (D3 A, as John chose it)", JSON.stringify(headMenu));
  await ev(`document.querySelector('.anchmenu [data-menuitem="0"]').click()`);
  const m2a = await until(`window.__calls.some(function (c) { return c === 'POST /api/prayer/redraw'; })`);
  const m2b = await until(`!document.querySelector('.anchmenu') && !!document.getElementById('int-fab')`);
  await sleep(300);
  ok(m2a && m2b, "M2 the menu's Redraw fires the standing redraw POST and the side settles (the menu closed before the act, the paint stands fresh)");
  await ev(`window.__stub.failRedraw = true; document.getElementById('int-menu').click()`);
  await page.waitForSelector('.anchmenu', { timeout: 4000 });
  await ev(`document.querySelector('.anchmenu [data-menuitem="0"]').click()`);
  await until(`(document.getElementById('int-redraw-note') || {}).textContent.includes('Redraw did not run')`);
  const redrawFail = await ev(`({ note: (document.getElementById('int-redraw-note') || {}).textContent || '', btn: (function(){ var b = document.getElementById('int-menu'); return b ? { t: b.textContent, dis: b.disabled } : null; })() })`);
  ok(redrawFail.note.includes("Redraw did not run") && redrawFail.btn && redrawFail.btn.t === "\u2630" && !redrawFail.btn.dis,
    "M3 a refused redraw stands the failure line in the head's note slot and the heading ☰ is restored (its glyph back, enabled) — the busy seat unwound", JSON.stringify(redrawFail));
  await ev(`window.__stub.failRedraw = false`);

  /* ---- the row menus ---- */
  await ev(`document.querySelector('[data-intmenu="12"]').click()`);
  await page.waitForSelector('.anchmenu', { timeout: 4000 });
  const rowMenu = await ev(`(function(){
    var card = document.querySelector('.anchmenu');
    return { title: (card.querySelector('h1') || {}).textContent || null,
      labels: Array.prototype.slice.call(card.querySelectorAll('[data-menuitem]')).map(function (b) { return b.textContent.trim(); }) };
  })()`);
  ok(rowMenu.title === "Intention" && JSON.stringify(rowMenu.labels) === JSON.stringify(["Edit", "Retire", "Delete"]),
    "M4 a row's ☰ opens its anchored menu titled 'Intention' carrying Edit · Retire · Delete", JSON.stringify(rowMenu));
  await ev(`document.querySelector('.anchmenu [data-menuitem="1"]').click()`);
  const m5a = await until(`window.__calls.some(function (c) { return c.indexOf('POST /api/prayer/intentions/12/status') === 0; })`);
  const m5b = await until(`(function(){ var b = document.querySelector('[data-intmenu="12"]'); if (!b) return false; var head = Array.prototype.slice.call(document.querySelectorAll('.sectionhead')).filter(function (h) { return h.textContent.trim() === 'RETIRED'; })[0]; return head && (head.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); })()`);
  ok(m5a && m5b, "M5 Retire fires the standing status POST and settles — the row now stands under the RETIRED head");
  await ev(`document.querySelector('[data-intmenu="12"]').click()`);
  await page.waitForSelector('.anchmenu', { timeout: 4000 });
  const retMenu = await ev(`Array.prototype.slice.call(document.querySelectorAll('.anchmenu [data-menuitem]')).map(function (b) { return b.textContent.trim(); })`);
  ok(JSON.stringify(retMenu) === JSON.stringify(["Edit", "Restore", "Delete"]),
    "M6 a retired row's menu reads Restore in Retire's seat", JSON.stringify(retMenu));
  await ev(`document.querySelector('.anchmenu [data-menuitem="1"]').click()`);
  const m7a = await until(`window.__calls.filter(function (c) { return c.indexOf('POST /api/prayer/intentions/12/status') === 0; }).length >= 2`);
  const m7b = await until(`(function(){ var b = document.querySelector('[data-intmenu="12"]'); var head = Array.prototype.slice.call(document.querySelectorAll('.sectionhead')).filter(function (h) { return h.textContent.trim() === 'RETIRED'; })[0]; return b && head && (head.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING); })()`);
  ok(m7a && m7b, "M7 Restore fires the status POST again and settles — the row stands back in the flat list above the RETIRED head");

  /* ---- Delete: the confirm stands before any DELETE ---- */
  await ev(`window.__calls.length = 0; document.querySelector('[data-intmenu="13"]').click()`);
  await page.waitForSelector('.anchmenu', { timeout: 4000 });
  await ev(`document.querySelector('.anchmenu [data-menuitem="2"]').click()`);
  await page.waitForSelector('.sheet [data-cfgo]', { timeout: 4000 });
  const confirmState = await ev(`({ line: (document.querySelector('.sheet .confirmline') || document.querySelector('.sheet')).textContent.includes('Delete this intention and all its draws?'),
    deletes: window.__calls.filter(function (c) { return c.indexOf('DELETE') === 0; }).length,
    rowStands: !!document.querySelector('[data-intmenu="13"]') })`);
  ok(confirmState.line && confirmState.deletes === 0 && confirmState.rowStands,
    "M8 Delete opens the standing confirm FIRST — its line stands, NO DELETE call has fired, and the row still stands", JSON.stringify(confirmState));
  await ev(`document.querySelector('.sheet [data-cfgo]').click()`);
  const m9a = await until(`window.__calls.some(function (c) { return c === 'DELETE /api/prayer/intentions/13'; })`);
  const m9b = await until(`!document.querySelector('[data-intmenu="13"]')`);
  ok(m9a && m9b, "M9 the confirm's commit fires the DELETE and settles — the row leaves the paint");

  /* ---- the one sheet: the add form (FAB door + menu door) ---- */
  await ev(`document.getElementById('int-fab').click()`);
  await page.waitForSelector('.sheet #ed-text', { timeout: 4000 });
  const addForm = await ev(`(function(){
    var sheet = document.querySelector('.sheet');
    var segs = Array.prototype.slice.call(sheet.querySelectorAll('#ed-pri [data-pri]'));
    return { text: sheet.querySelector('#ed-text').value,
      active: segs.filter(function (b) { return b.classList.contains('active'); }).map(function (b) { return b.getAttribute('data-pri'); }),
      save: sheet.querySelector('#ed-save').textContent.trim(),
      note: sheet.textContent.includes('Adding an intention redraws today'),
      facts: sheet.textContent.includes('Status:') };
  })()`);
  ok(addForm.text === "" && JSON.stringify(addForm.active) === JSON.stringify(["M"]) && addForm.save === "Add to the pool" && addForm.note && !addForm.facts,
    "A1 the FAB opens the add sheet: empty text, the segmented priority control with Medium standing (the form's default), the 'Add to the pool' act, and the standing redraw note line — no facts line (that is the edit form's)", JSON.stringify(addForm));
  await ev(`(function(){
    var t = document.querySelector('.sheet #ed-text'); t.value = 'For the new intention'; t.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.sheet #ed-pri [data-pri="H"]').click();
    document.querySelector('.sheet #ed-save').click();
  })()`);
  const a2a = await until(`window.__calls.some(function (c) { return c.indexOf('POST /api/prayer/intentions {') === 0 && c.includes('"priority":"H"'); })`);
  const a2b = await until(`!document.querySelector('.sheet') && Array.prototype.slice.call(document.querySelectorAll('.introw')).some(function (r) { return r.textContent.includes('For the new intention'); })`);
  const added = await ev(`(function(){
    var rows = Array.prototype.slice.call(document.querySelectorAll('.introw'));
    var r = rows.filter(function (x) { return x.textContent.includes('For the new intention'); })[0];
    return { stands: !!r, tag: r ? r.querySelector('.pri').className : null, first: rows.length ? rows[0].textContent.includes('For the new intention') : false };
  })()`);
  ok(a2a && a2b && added.stands && added.tag === "pri H" && added.first,
    "A2 the add POSTs with the segment's priority (H, chosen in the sheet) and settles — the sheet closed and the new row stands at the head of the flat list with its High tag", JSON.stringify({ post: a2a, settled: a2b, added }));
  await ev(`window.__stub.failAdd = true; document.getElementById('int-menu').click()`);
  await page.waitForSelector('.anchmenu', { timeout: 4000 });
  await ev(`document.querySelector('.anchmenu [data-menuitem="1"]').click()`);
  await page.waitForSelector('.sheet #ed-text', { timeout: 4000 });
  await ev(`(function(){
    var t = document.querySelector('.sheet #ed-text'); t.value = 'For the refused one'; t.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.sheet #ed-save').click();
  })()`);
  await until(`(document.querySelector('.sheet #ed-note') || {}).textContent.includes('That did not add')`);
  const addFail = await ev(`(function(){
    var sheet = document.querySelector('.sheet');
    return { stands: !!sheet, draft: sheet ? sheet.querySelector('#ed-text').value : null,
      note: sheet ? sheet.querySelector('#ed-note').textContent : null,
      enabled: sheet ? !sheet.querySelector('#ed-save').disabled : false };
  })()`);
  ok(addFail.stands && addFail.draft === "For the refused one" && addFail.enabled,
    "A3 the add failure branch stands as built: a refused POST leaves the sheet open, the draft intact, the button re-enabled, and the note naming the failure ('That did not add…') — and the menu's Add intention door opened this same sheet", JSON.stringify(addFail));
  await ev(`window.__stub.failAdd = false`);
  await page.mouse.click(20, 20); // the drawer's scrim tap dismisses
  await until(`!document.querySelector('.sheet')`);

  /* ---- the one sheet: the edit form ---- */
  await ev(`document.querySelector('[data-intmenu="14"]').click()`);
  await page.waitForSelector('.anchmenu', { timeout: 4000 });
  await ev(`document.querySelector('.anchmenu [data-menuitem="0"]').click()`);
  await page.waitForSelector('.sheet #ed-text', { timeout: 4000 });
  const editForm = await ev(`(function(){
    var sheet = document.querySelector('.sheet');
    var segs = Array.prototype.slice.call(sheet.querySelectorAll('#ed-pri [data-pri]'));
    return { text: sheet.querySelector('#ed-text').value,
      active: segs.filter(function (b) { return b.classList.contains('active'); }).map(function (b) { return b.getAttribute('data-pri'); }),
      save: sheet.querySelector('#ed-save').textContent.trim(),
      facts: sheet.textContent.includes('Status: active') && sheet.textContent.includes('Drawn 0 times') && sheet.textContent.includes('Created: 2026-11-05') };
  })()`);
  ok(editForm.text === "For a friend discerning" && JSON.stringify(editForm.active) === JSON.stringify(["H"]) && editForm.save === "Save" && editForm.facts,
    "A4 the row menu's Edit opens the SAME sheet as the edit form: the text prefilled, its own priority (H) standing on the segment, the facts line (status · created · drawn) where D2 B seats the history", JSON.stringify(editForm));
  await ev(`(function(){
    document.querySelector('.sheet #ed-pri [data-pri="L"]').click();
    document.querySelector('.sheet #ed-save').click();
  })()`);
  const a5a = await until(`window.__calls.some(function (c) { return c.indexOf('PATCH /api/prayer/intentions/14') === 0 && c.includes('"priority":"L"'); })`);
  const a5b = await until(`(function(){ var b = document.querySelector('[data-intmenu="14"]'); var r = b && b.closest('.introw'); return r && r.querySelector('.pri').className === 'pri L'; })()`);
  ok(a5a && a5b, "A5 Save PATCHes with the segment's new priority and settles — the row's tag now reads Low");

  /* ---- the settle leg: redrawn:false stands the line ---- */
  await ev(`window.__stub.redrawnFalse = true; document.querySelector('[data-intmenu="11"]').click()`);
  await page.waitForSelector('.anchmenu', { timeout: 4000 });
  await ev(`document.querySelector('.anchmenu [data-menuitem="1"]').click()`);
  const r1 = await until(`(document.getElementById('int-redraw-note') || {}).textContent.includes('Redraw did not run')`);
  ok(r1, "R1 a mutation answered redrawn:false settles and stands the redraw failure line in the head's note slot (the v426 settle contract, unmoved)");
  await ev(`window.__stub.redrawnFalse = false`);

  /* ---- the failure paint + Retry ---- */
  const pageF = await browser.newPage({ viewport: { width: 412, height: 915 } });
  pageF.on("pageerror", (e) => pageErrors.push("fail: " + String(e)));
  await pageF.goto(ORIGIN + "/fail");
  await pageF.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await pageF.evaluate(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await pageF.waitForSelector('#int-retry', { timeout: 6000 });
  const failPaint = await pageF.evaluate(`(function(){
    var host = document.getElementById('sidehost');
    return { err: host.textContent.includes('Intentions did not load.'), headrow: !!host.querySelector('.headrow h1'), fab: !!document.getElementById('int-fab') };
  })()`);
  ok(failPaint.err && failPaint.headrow && !failPaint.fab,
    "F1 the authored failure paint stands with its head in the new headrow form and its Ghost Retry — and no FAB stands on a failed paint", JSON.stringify(failPaint));
  await pageF.evaluate(`window.__stub.failLoad = false; document.getElementById('int-retry').click()`);
  let f2 = true;
  try { await pageF.waitForSelector('#int-fab', { timeout: 6000 }); } catch { f2 = false; }
  ok(f2, "F2 Retry repaints the side whole — the clean paint stands (rows + the FAB)");

  /* ---- 360px geometry ---- */
  const page2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  page2.on("pageerror", (e) => pageErrors.push("360: " + String(e)));
  await page2.goto(ORIGIN + "/");
  await page2.waitForSelector('[data-openblock="Morning"]', { timeout: 8000 });
  await page2.evaluate(`document.querySelector('#sidetoggle [data-side="intentions"]').click()`);
  await page2.waitForSelector('#int-fab', { timeout: 6000 });
  const geo = await page2.evaluate(`(function(){
    var rows = Array.prototype.slice.call(document.querySelectorAll('.introw'));
    var fab = document.getElementById('int-fab').getBoundingClientRect();
    return { scrollW: document.documentElement.scrollWidth, rows: rows.length,
      fabIn: fab.right <= window.innerWidth && fab.bottom <= window.innerHeight && fab.left >= 0 };
  })()`);
  ok(geo.scrollW <= 362 && geo.rows === 5 && geo.fabIn,
    "G360 at 360px the clean paint stands: its five rows, the FAB inside the viewport, no new horizontal overflow", JSON.stringify(geo));

  ok(pageErrors.length === 0, "browser: zero page errors across every leg" + (pageErrors.length ? " — " + pageErrors.join(" | ") : ""));
} finally {
  await browser.close();
  server.close();
}

console.log(`# harness-v452: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
