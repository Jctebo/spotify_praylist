#!/usr/bin/env node
// harness-v426 — the v426 gate (Plan §2.10): INTENTIONS REDRAW,
// BOTH senses. Server legs on the v392 wrangler mold (LOCAL_DEV,
// the deterministic drawRandom hash makes every draw set exactly
// assertable): the whole-day re-draw replaces today's rows
// wholesale, past/future days stand, a forced fill failure
// restores the snapshot row-for-row (F-426-I1), the endpoint's
// drawn count equals the store's row count (F-426-I2), and all
// five mutations auto-redraw inside their own request with
// redrawn: true | false. Client legs run the real app in
// Chromium: the Redraw button in the head (44px floor, .btn
// ghost), the busy state, the failure lines, the add's failure
// branch, the one settle path's place-keeping, the descriptor
// seam's re-stamp rule, and F-426-I4's head-height equality.
// Statics: one settle function, the endpoint inside the johnOnly
// gate with no agent-door route, the §2.8 strings.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v426 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8996;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v426");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v426-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const UI_TS = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const shift = (d, days) => { const p = d.split("-").map(Number); const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days, 12)); const z = (x) => String(x).padStart(2, "0"); return `${dt.getUTCFullYear()}-${z(dt.getUTCMonth() + 1)}-${z(dt.getUTCDate())}`; };
const TODAY = chicagoToday(), TOMORROW = shift(TODAY, 1), YDAY = shift(TODAY, -1);

// ---- the draw, replicated exactly (index.ts drawRandom + the
// weighted pick loop) so expected sets are computable ------------
function drawRandom(date, itemId) {
  const s = `${date}:${itemId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function expectedDraw(date, itemIds, pool) {
  const weights = pool.map((i) => (i.priority === "H" ? 4 : i.priority === "M" ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const out = {};
  for (const itemId of itemIds) {
    let x = drawRandom(date, itemId) * total;
    let pick = pool[pool.length - 1];
    for (let k = 0; k < pool.length; k++) { x -= weights[k]; if (x <= 0) { pick = pool[k]; break; } }
    out[itemId] = pick.id;
  }
  return out;
}
const sameSet = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// ---- wrangler helpers (the estate mold) -------------------------
function wranglerD1(args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function d1q(sql) {
  const out = wranglerD1(["--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results || [];
}
function d1run(sql) { wranglerD1(["--command", sql]); }
function applyMigrations() {
  const dir = path.join(APP, "migrations");
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(dir, f));
  fs.rmSync(PERSIST, { recursive: true, force: true });
  const f = path.join(TMPD, "migs.sql");
  fs.writeFileSync(f, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  wranglerD1(["--file", f]);
}
const procs = [];
function startApp() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`];
  // detached: the finally kill takes the whole group — a
  // SIGKILL on the wrangler wrapper alone leaves its workerd
  // child holding the port, and the next run's fresh server
  // then silently talks to the stale one (run 2's lesson).
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(3000) }); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const req = async (method, p, body, headers = {}) => {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const out = { status: r.status, body: await r.json().catch(() => ({})) };
      if (out.status >= 500 && i < 4 && p !== "/api/prayer/redraw") { await sleep(800); continue; }
      return out;
    } catch (e) { lastErr = e; await sleep(800); }
  }
  throw lastErr;
};
const AGENT = { authorization: `Bearer ${TOKEN}` };
const poolNow = () => d1q("SELECT id, priority FROM prayer_intentions WHERE status='active' ORDER BY CASE priority WHEN 'H' THEN 0 WHEN 'M' THEN 1 ELSE 2 END, id");
const drawsNow = (date) => { const o = {}; for (const r of d1q(`SELECT item_id, intention_id FROM prayer_draws WHERE date='${date}' ORDER BY item_id`)) o[r.item_id] = r.intention_id; return o; };

// ---- statics -----------------------------------------------------
function statics() {
  const settleCalls = CLIENT.split("\n").filter((l) => l.includes("settleIntentions(") && !l.includes("function settleIntentions(")).length;
  ok((CLIENT.match(/function settleIntentions\(/g) || []).length === 1 && settleCalls >= 6,
    `S: one settle function exists and the mutation sites + the button call it (${settleCalls} call sites)`);
  ok((CLIENT.match(/armPlaceRestore\('prayers:intentions'\)/g) || []).length === 1,
    "S: the standing triple survives in exactly one place — inside the settle function (no hand-copied triple remains)");
  ok(CLIENT.includes('id="int-redraw"') && CLIENT.includes(">Redraw</button>") && CLIENT.includes("Redrawing"),
    "S: the Redraw button stands in the full paint's head with its busy label");
  ok(CLIENT.includes("Redraw did not run") && CLIENT.includes("the standing draw stands. Try again."),
    "S: the redraw failure line stands verbatim in the client");
  ok(CLIENT.includes("That did not add. Your text is still here"),
    "S: the add failure line stands verbatim in the client");
  ok(!CLIENT.includes("first enters a draw at the next nightly fill") && CLIENT.includes("Adding an intention redraws today"),
    "S: the retired Add-card string is absent and its §2.8 replacement stands");
  ok(CLIENT.includes("this screen tends the pool, and its redraw stages the day."),
    "S: the about line's corrected closing clause stands (the Plan-added companion)");
  const fnStart = INDEX.indexOf("async function prayerRedrawForDate");
  const fnBody = INDEX.slice(fnStart, INDEX.indexOf("// v426 §2.4", fnStart));
  ok(fnStart > 0 && fnBody.includes("DELETE FROM prayer_draws WHERE date=?") && fnBody.includes("INSERT OR IGNORE INTO prayer_draws") && fnBody.includes("prayerDrawForDate(env, date)"),
    "S: prayerRedrawForDate carries the snapshot / delete-today-only / same-fill / batch-restore construction");
  const agentBlock = INDEX.slice(INDEX.indexOf('seg[1] === "agent"'), INDEX.indexOf("unknown agent route"));
  ok(!agentBlock.includes('"redraw"') && INDEX.indexOf('seg[2] === "redraw"') > INDEX.indexOf("johnOnly(request, env)"),
    "S: the redraw route stands inside the johnOnly-gated session block; the agent door carries no redraw route");
  ok(UI_TS.includes('var CACHE = "ora-pro-nobis-v430-1"'), "S: the SW pin stands at ora-pro-nobis-v430-1 — unmoved at Implement (Ship moves it)");
}

let browser = null;
try {
  statics();
  try { execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stood on the port */ }
  await sleep(1000);
  applyMigrations();
  // Fixture pool: 1 H · 2 M · 3 L · 4 M active, 5 H retired.
  d1run("DELETE FROM prayer_intentions; DELETE FROM prayer_draws;");
  d1run(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES
    (1,'For Alpha','H','active','2026-11-01T00:00:00Z'),(2,'For Beta','M','active','2026-11-01T00:00:00Z'),
    (3,'For Gamma','L','active','2026-11-01T00:00:00Z'),(4,'For Delta','M','active','2026-11-01T00:00:00Z'),
    (5,'For Retired','H','retired','2026-11-01T00:00:00Z')`);
  // Fixture items: production's item rows arrive by the board
  // port, not by migration (the migrations seed only the AI
  // Signal item) — the mold seeds eight standing-shape items
  // across the blocks so the weighted draw sets are non-trivial.
  d1run(`INSERT INTO prayer_items (id, block, name, sub, kind, color, opening_prayer, closing_prayer, enabled, sort) VALUES
    (101,'Morning','Fixture Morning Prayer','','prayer','gold','','',1,1),
    (102,'Morning','Fixture Rosary','','prayer','gold','','',1,2),
    (103,'Midmorning','Fixture Novena','','prayer','gold','','',1,1),
    (104,'Midday','Fixture Angelus','','prayer','gold','','',1,1),
    (105,'Afternoon','Fixture Chaplet','','prayer','gold','','',1,1),
    (106,'Evening','Fixture Evening Prayer','','prayer','gold','','',1,1),
    (107,'Night','Fixture Night Prayer','','prayer','gold','','',1,1),
    (108,'Mass and Homilies','Fixture Mass','','prayer','gold','','',1,1)`);
  const items = d1q("SELECT id FROM prayer_items WHERE enabled=1 ORDER BY id").map((r) => r.id);
  ok(items.length >= 5, `fixture: ${items.length} enabled prayer items stand`);
  for (const it of items) {
    d1run(`INSERT INTO prayer_draws (date, item_id, intention_id) VALUES ('${YDAY}', ${it}, 2), ('${TOMORROW}', ${it}, 3)`);
  }
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV)");

  // ---------- server legs ----------------------------------------
  const day = await req("GET", `/api/prayer/day?date=${TODAY}`);
  ok(day.status === 200, "L0: the day payload answers (materializes today's draw)");
  ok(sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "L0: today's materialized draw equals the deterministic expected set");

  // S1 + F-426-I2: corrupt today's rows, redraw, exact set returns;
  // the endpoint's drawn equals the store's row count.
  d1run(`UPDATE prayer_draws SET intention_id=2 WHERE date='${TODAY}'`);
  const yBefore = drawsNow(YDAY), tBefore = drawsNow(TOMORROW);
  const rd = await req("POST", "/api/prayer/redraw");
  const cnt = d1q(`SELECT COUNT(*) AS n FROM prayer_draws WHERE date='${TODAY}'`)[0].n;
  ok(rd.status === 200 && rd.body.ok === true && rd.body.date === TODAY, "S1: POST /api/prayer/redraw answers ok with today's date");
  ok(rd.body.drawn === cnt && cnt === items.length, `F-426-I2: the endpoint's drawn (${rd.body.drawn}) equals the store's row count (${cnt}) = the enabled-item count`);
  ok(sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "S1: a redraw replaces today's rows wholesale — the post-redraw set equals the expected set for the seeded pool");
  ok(sameSet(drawsNow(YDAY), yBefore) && sameSet(drawsNow(TOMORROW), tBefore),
    "S2/S3: past-day and future-day rows stand byte-identical after a redraw");

  // S6: no prior draws — the redraw is the plain fill.
  d1run(`DELETE FROM prayer_draws WHERE date='${TODAY}'`);
  const rd2 = await req("POST", "/api/prayer/redraw");
  ok(rd2.status === 200 && sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "S6: a redraw with no prior draws is the plain fill (the expected set stands)");

  // S4 + F-426-I1: force the fill to throw (prayer_items renamed
  // away) — the endpoint answers in the error shape and the
  // snapshot is restored row for row by the one batch.
  const snapSet = drawsNow(TODAY);
  d1run("ALTER TABLE prayer_items RENAME TO prayer_items_hold");
  const rdFail = await req("POST", "/api/prayer/redraw");
  d1run("ALTER TABLE prayer_items_hold RENAME TO prayer_items");
  ok(rdFail.status === 500 && typeof rdFail.body.error === "string",
    "S4: a forced fill failure answers 500 in the standing error shape");
  ok(sameSet(drawsNow(TODAY), snapSet),
    "F-426-I1: the batch snapshot-restore is proven in the mold — the standing draw stands row for row after a failed re-run");

  // S5: empty pool — today stands draw-less, no error.
  d1run("UPDATE prayer_intentions SET status='retired'");
  d1run(`DELETE FROM prayer_draws WHERE date='${TODAY}'`);
  const rd3 = await req("POST", "/api/prayer/redraw");
  ok(rd3.status === 200 && rd3.body.drawn === 0 && Object.keys(drawsNow(TODAY)).length === 0,
    "S5: an empty pool redraws to a draw-less today with no error");
  d1run("UPDATE prayer_intentions SET status='active' WHERE id IN (1,2,3,4)");
  await req("POST", "/api/prayer/redraw");

  // A1: ADD auto-redraws over the widened pool.
  const add = await req("POST", "/api/prayer/intentions", { text: "For Epsilon", priority: "H" });
  const epsId = add.body.id;
  ok(add.status === 201 && add.body.redrawn === true && Number.isInteger(epsId),
    "A1: the add answers 201 + id with redrawn: true");
  ok(sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "A1: today's draw re-ran over the widened pool (the post-add set equals the expected set)");

  // A2: RETIRE — the wider removal deletion stands (tomorrow's
  // row for the retired intention goes), then the redraw re-seats
  // today from the narrowed pool.
  if (Number.isInteger(epsId)) d1run(`UPDATE prayer_draws SET intention_id=${epsId} WHERE date='${TOMORROW}' AND item_id=${items[0]}`);
  const ret = await req("POST", `/api/prayer/intentions/${epsId}/status`, { status: "retired" });
  ok(ret.status === 200 && ret.body.redrawn === true, "A2: retire answers with redrawn: true");
  ok(!Object.values(drawsNow(TODAY)).includes(epsId) && sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "A2: the retired intention leaves today's draws; the set equals the expected set over the narrowed pool");
  ok(d1q(`SELECT COUNT(*) AS n FROM prayer_draws WHERE date>='${TODAY}' AND intention_id=${epsId}`)[0].n === 0,
    "A2/F-426-I3: retire's standing wider deletion (date >= today) ran before the redraw — no row for the retired intention stands today or tomorrow");

  // A3: RESTORE re-seats eligibility — the draw re-runs.
  const res = await req("POST", `/api/prayer/intentions/${epsId}/status`, { status: "active" });
  ok(res.status === 200 && res.body.redrawn === true && sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "A3: restore answers with redrawn: true and today's draw re-ran over the restored pool");

  // A4: EDIT (priority is a draw input) re-runs the draw.
  const ed = await req("PATCH", "/api/prayer/intentions/3", { priority: "H" });
  ok(ed.status === 200 && ed.body.redrawn === true && sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "A4: a priority edit answers with redrawn: true and the draw re-ran under the new weights");

  // A5: DELETE removes the intention from today's draws (and all
  // dates, its standing removal semantics).
  const del = await req("DELETE", `/api/prayer/intentions/${epsId}`);
  ok(del.status === 200 && del.body.redrawn === true, "A5: delete answers with redrawn: true");
  ok(d1q(`SELECT COUNT(*) AS n FROM prayer_draws WHERE intention_id=${epsId}`)[0].n === 0
    && sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "A5: the deleted intention stands in no draw on any date; today's set equals the expected set");

  // A6: a forced redraw failure leaves the mutation standing with
  // redrawn: false, and today's draw stands restored.
  const preA6 = drawsNow(TODAY);
  d1run("ALTER TABLE prayer_items RENAME TO prayer_items_hold");
  const addF = await req("POST", "/api/prayer/intentions", { text: "For Zeta", priority: "L" });
  d1run("ALTER TABLE prayer_items_hold RENAME TO prayer_items");
  ok(addF.status === 201 && addF.body.redrawn === false,
    "A6: a forced redraw failure leaves the add standing (201) with redrawn: false");
  const poolAfter = await req("GET", "/api/prayer/intentions");
  ok((poolAfter.body.intentions || []).some((i) => i.text === "For Zeta"),
    "A6: the added intention stands in the pool after its failed redraw");
  ok(sameSet(drawsNow(TODAY), preA6), "A6: today's draw stands restored row for row after the failed auto-redraw");
  d1run("DELETE FROM prayer_intentions WHERE text='For Zeta'");

  // The door cannot trigger a redraw; its standing read stands.
  const doorTry = await req("POST", "/api/agent/prayer/redraw", {}, AGENT);
  ok(doorTry.status === 404, "S: the agent door cannot trigger a redraw (404, no route)");
  const doorDay = await req("GET", "/api/agent/prayer/day", undefined, AGENT);
  ok(doorDay.status === 200, "S: the door's standing day read is untouched");

  // ---------- client legs (the real app) --------------------------
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  let mode = "normal";
  await page.route("**/*", async (route) => {
    const r = route.request();
    const url = r.url();
    if (url === "https://orapronobis.media/podcast.xml" || url === "https://orapronobis.media/intentions.xml") {
      await route.fulfill({ status: 200, contentType: "application/rss+xml", body: `<?xml version="1.0"?><rss version="2.0"><channel><title>f</title></channel></rss>` });
      return;
    }
    if (/\.mp3($|\?)/.test(url)) { await route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(64) }); return; }
    const isRedraw = url.endsWith("/api/prayer/redraw") && r.method() === "POST";
    const isAdd = url.endsWith("/api/prayer/intentions") && r.method() === "POST";
    const isPoolGet = url.endsWith("/api/prayer/intentions") && r.method() === "GET";
    if (isRedraw && mode === "fail-redraw") { await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "redraw failed — the standing draw stands" }) }); return; }
    if (isAdd && mode === "fail-add") { await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "text required" }) }); return; }
    if ((isRedraw && mode === "hold-redraw") || (isAdd && mode === "hold-add") || (isPoolGet && mode === "hold-pool")) {
      const resp = await route.fetch();
      await sleep(1600);
      await route.fulfill({ response: resp });
      return;
    }
    await route.continue();
  });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.click('[data-tab="prayers"]');
  await page.waitForSelector(".blockcard", { timeout: 30000 });
  await page.click('#sidetoggle [data-side="intentions"]');
  await page.waitForSelector("#int-redraw", { timeout: 30000 });

  // C1: the button stands in the full paint's head.
  const btn = await ev(() => { const b = document.getElementById("int-redraw"); return b ? { text: b.textContent, h: b.offsetHeight, ghost: b.classList.contains("btn") && b.classList.contains("ghost"), note: !!document.getElementById("int-redraw-note") } : null; });
  ok(!!btn && btn.text === "Redraw" && btn.ghost && btn.h >= 44 && btn.note,
    `C1: the Redraw button stands in the head — .btn ghost dress, ${btn && btn.h}px tall (44px floor), the note slot beside it`);

  // C2 / F-426-I4: skeleton head vs full-paint head — no jump.
  mode = "hold-pool";
  await page.click('#sidetoggle [data-side="prayers"]');
  await sleep(300);
  await page.click('#sidetoggle [data-side="intentions"]');
  // Poll presence + measure atomically: the skeleton stands
  // only for the held fetch's window, and a visibility wait
  // races it (run 5's lesson).
  let skelH = -1;
  for (let i = 0; i < 40 && skelH < 0; i++) {
    skelH = await ev(() => {
      const h1 = document.querySelector("#view h1.screen");
      const sk = document.querySelector("#view [data-skeleton]");
      return h1 && sk ? sk.getBoundingClientRect().top - h1.getBoundingClientRect().top : -1;
    });
    if (skelH < 0) await sleep(250);
  }
  mode = "normal";
  await page.waitForSelector("#int-redraw", { timeout: 30000 });
  const fullH = await ev(() => {
    const row = document.getElementById("int-redraw").closest(".row");
    const stats = document.querySelector(".stats");
    return row && stats ? stats.getBoundingClientRect().top - row.getBoundingClientRect().top : -1;
  });
  ok(skelH > 0 && fullH > 0 && Math.abs(fullH - skelH) <= 1,
    `F-426-I4: the skeleton head (${skelH}px) and the full paint's head row (${fullH}px) measure the same height — the paint landing does not jump`);

  // C3: a tap shows the busy state, then repaints; the re-run
  // lands the expected set after a SQL corruption.
  d1run(`UPDATE prayer_draws SET intention_id=2 WHERE date='${TODAY}'`);
  await sleep(1000);
  mode = "hold-redraw";
  await page.click("#int-redraw");
  await sleep(500);
  const busy = await ev(() => { const b = document.getElementById("int-redraw"); return b ? { dis: b.disabled, text: b.textContent } : null; });
  ok(!!busy && busy.dis === true && busy.text === "Redrawing…",
    "C3: a tap disables the button and its label reads Redrawing… while the POST is in flight");
  mode = "normal";
  await page.waitForFunction(() => { const b = document.getElementById("int-redraw"); return b && !b.disabled && b.textContent === "Redraw"; }, null, { timeout: 60000 });
  ok(sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "C3: the button's re-run landed — today's set equals the expected set after the corruption");
  const noteAfter = await ev(() => document.getElementById("int-redraw-note").textContent);
  ok(noteAfter === "", "C3: a successful tap reports nothing verbal — the note slot stands empty, the repainted view is the report");

  // C4: a failed tap stands the failure line; the paint stands.
  const stripBefore = await ev(() => document.querySelector(".stats").textContent);
  mode = "fail-redraw";
  await page.click("#int-redraw");
  await page.waitForFunction(() => document.getElementById("int-redraw-note").textContent.length > 0, null, { timeout: 15000 });
  const failLine = await ev(() => document.getElementById("int-redraw-note").textContent);
  const stripAfter = await ev(() => document.querySelector(".stats").textContent);
  mode = "normal";
  ok(failLine === "Redraw did not run — the standing draw stands. Try again." && stripBefore === stripAfter,
    "C4: a failed tap stands the settled failure line and does not repaint — the standing paint stands");

  // C5: the Add button disables in flight; a refused add stands
  // the draft and names the failure.
  mode = "hold-add";
  await page.fill("#new-text", "For Held");
  const heldClick = page.click("#new-add");
  await sleep(500);
  const addBusy = await ev(() => document.getElementById("new-add").disabled);
  ok(addBusy === true, "C5: the Add button disables while its POST is in flight");
  await heldClick;
  await page.waitForFunction(() => { const t = document.getElementById("new-text"); return t && t.value === ""; }, null, { timeout: 60000 });
  mode = "fail-add";
  await page.fill("#new-text", "For Refused");
  await page.click("#new-add");
  await page.waitForFunction(() => document.getElementById("fn-new-text").textContent.includes("That did not add"), null, { timeout: 15000 });
  const refused = await ev(() => ({ note: document.getElementById("fn-new-text").textContent, draft: document.getElementById("new-text").value, dis: document.getElementById("new-add").disabled }));
  mode = "normal";
  ok(refused.note === "That did not add. Your text is still here — try again." && refused.draft === "For Refused" && refused.dis === false,
    "C5: a refused add names the failure in the field note, the draft stands untouched, and the button re-enables");

  // C6: a settled add repaints through the one path — the new
  // intention stands in its group, the draft drops.
  await page.fill("#new-text", "For Theta");
  await page.click("#new-add");
  await page.waitForFunction(() => document.body.textContent.includes("For Theta") && document.getElementById("new-text").value === "", null, { timeout: 60000 });
  ok(sameSet(drawsNow(TODAY), expectedDraw(TODAY, items, poolNow())),
    "C6: a settled add stands in the view, its draft dropped, and the server auto-redrew (today's set equals the expected set over the widened pool)");

  // C7: place-keeping on a settle — a long list, a scrolled
  // retire, the place restored by the one path.
  const fillerIds = [];
  for (let i = 0; i < 12; i++) {
    const r = await req("POST", "/api/prayer/intentions", { text: `For Filler ${i}`, priority: "L" });
    fillerIds.push(r.body.id);
  }
  await page.click('#sidetoggle [data-side="prayers"]');
  await sleep(300);
  await page.click('#sidetoggle [data-side="intentions"]');
  await page.waitForSelector("#int-redraw", { timeout: 30000 });
  await sleep(800);
  const targetId = fillerIds[fillerIds.length - 1];
  await ev((id) => {
    window.scrollTo(0, 700);
    const b = document.querySelector(`[data-act="retire"][data-id="${id}"]`);
    if (b) b.click();
  }, targetId);
  await page.waitForFunction((id) => {
    const sec = [...document.querySelectorAll(".sectionhead")].some((h) => h.textContent.includes("RETIRED"));
    return sec && window.scrollY > 0;
  }, targetId, { timeout: 30000 });
  const place = await ev(() => window.scrollY);
  ok(Math.abs(place - 700) <= 30, `C7: a mutation settle through the one path restores the view's place (scroll ${place} vs the captured 700)`);

  // C8: the descriptor seam — a built descriptor keeps its line;
  // a fresh build re-stamps from the new payload (§2.7).
  const seam = await ev(() => {
    const t = { episodeId: "x1", title: "X", available: true, _block: "Morning" };
    const dayA = { intros: { x1: { text: "Intention Alpha" } } };
    const dayB = { intros: { x1: { text: "Intention Beta" } } };
    const dA = trackDesc(t, dayA);
    const dB = trackDesc(t, dayB);
    return { a: dA.intentionText, b: dB.intentionText, aAfter: dA.intentionText };
  });
  ok(seam.a === "Intention Alpha" && seam.b === "Intention Beta" && seam.aAfter === "Intention Alpha",
    "C8: the playing descriptor's line stands unchanged once built; the next build re-stamps from the fresh payload — a redraw never mutates live playback");
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  procs.forEach((p) => { try { process.kill(-p.pid, "SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch { /* noop */ } } });
}
console.log(`# harness-v426: ${n} ok / ${fails} not-ok`);
process.exit(fails ? 1 : 0);
