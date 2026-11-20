#!/usr/bin/env node
// harness-v395 — the v395 gate (Plan §2.10 legs P1–P10): Podcasts
// episode position memory — migration 0019 (the sibling table
// podcast_positions), the one new route POST
// /api/player/podcasts/position (validation · snapshot-duration
// clamp · listened-episode no-op · zero-position deletes ·
// upsert), the podPayload positionS field (unlistened only), the
// mark/unmark routes' position delete (D5), the client's save
// driver (15 s movement-gated tick · pause/hide/close event saves
// · skip-away, the ended path never saving), the coalesced
// pending slot opn-podpos-pending-v1 (newest-wins, NOT the mark
// queue's FIFO), resume through the standing pendingResume seam,
// and the row's bottom-edge progress bar inside the uniform
// 76 px row. Mold: harness-v390 — a local wrangler instance
// inside this worktree (LOCAL_DEV) with the three feed seams
// pointed at a fixture feed server; fixture D1 is migrated
// through 0018 first and migration 0019 is applied MID-RUN (its
// before/after read-backs are P5's legs, not setup), because
// Implement builds the migration and Ship applies it. Client
// legs run the extracted units verbatim against stubs (the v381
// mold); the display leg runs the real app in a browser.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v395 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997, FEED_PORT = 8957;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v395");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v395-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI_TS = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// ---- fixture feeds (trimmed from the real feeds' shapes) -------
function itemXml({ title, pub, dur, guid, url }) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate><guid isPermaLink="false">${guid}</guid>`
    + `<enclosure url="${url}" length="1000000" type="audio/mpeg"/><itunes:duration>${dur}</itunes:duration></item>`;
}
function feedXml(chanTitle, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>`
    + `<title>${chanTitle}</title>` + items.join("") + `</channel></rss>`;
}
const A = (name) => `${FEED}/audio/${name}.mp3`;
const dayItem = (prefix, day, year, extra = {}) => itemXml({
  title: `Day ${day}: Episode ${day}${day % 2 === 0 ? ` (${year})` : ""}`,
  pub: extra.pub || `Thu, 0${(day % 9) + 1} Jan ${year} 15:00:00 +0000`,
  dur: extra.dur || "12:00", guid: extra.guid || `guid-${prefix}-${year}-${day}`, url: extra.url || A(`${prefix}-day${day}-${year}`),
});
const ciyDay = (day, year, extra = {}) => itemXml({
  title: `Day ${day}: Episode ${day}${year >= 2024 && day % 2 === 0 ? ` (${year})` : ""}`,
  pub: extra.pub || `Thu, 0${(day % 9) + 1} Jan ${year} 15:00:00 +0000`,
  dur: extra.dur || "12:00", guid: extra.guid || `guid-${year}-${day}`, url: extra.url || A(`day${day}-${year}`),
});
const FEED_CIY = feedXml("The Catechism in a Year (with Fr. Mike Schmitz)",
  [5, 4, 3, 2, 1].map((d) => ciyDay(d, 2025)).concat([5, 4, 3, 2, 1].map((d) => ciyDay(d, 2024))));
const FEED_BIY = feedXml("The Bible in a Year (with Fr. Mike Schmitz)", [
  itemXml({ title: "BONUS: If You Feel Like Giving Up (with Jeff Cavins)", pub: "Mon, 15 Sep 2025 15:00:00 +0000", dur: "18:00", guid: "guid-biy-b-givingup", url: A("biy-bonus-givingup") }),
  itemXml({ title: "BONUS: Bringing the Bible Back to Catholics (with Jeff Cavins)", pub: "Sun, 15 Jun 2025 15:00:00 +0000", dur: "20:00", guid: "guid-biy-b-bringing", url: A("biy-bonus-bringing") }),
  ...[3, 2, 1].map((d) => dayItem("biy", d, 2026)),
  ...[5, 4, 3, 2, 1].map((d) => dayItem("biy", d, 2025)),
]);
// Rosary: Days 1-5; Day 5 carries NO duration (itunes:duration
// 0:00 -> durationS 0) — §1's named no-duration case.
const FEED_RIY = feedXml("The Rosary in a Year (with Fr. Mark-Mary Ames)", [
  dayItem("riy", 5, 2025, { dur: "0:00" }),
  ...[4, 3, 2, 1].map((d) => dayItem("riy", d, 2025)),
]);

const feedBodies = { "/ciy.xml": FEED_CIY, "/biy.xml": FEED_BIY, "/riy.xml": FEED_RIY };
const feedServer = http.createServer((req, res) => {
  if (req.url && feedBodies[req.url] !== undefined) {
    res.writeHead(200, { "content-type": "application/rss+xml" }); res.end(feedBodies[req.url]); return;
  }
  if (req.url && req.url.startsWith("/audio/")) { res.writeHead(200, { "content-type": "audio/mpeg" }); res.end(Buffer.alloc(64)); return; }
  res.writeHead(404); res.end("nope");
});

// ---- wrangler helpers (the estate mold) -------------------------
function wranglerD1(appDir, persist, args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"), "--persist-to", persist, ...args],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function wranglerD1File(appDir, persist, file) { wranglerD1(appDir, persist, ["--file", file]); }
function migFiles(appDir, through) {
  const dir = path.join(appDir, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()
    .filter((f) => !through || f <= through).map((f) => path.join(dir, f));
}
function applyFiles(appDir, persist, files) {
  fs.rmSync(persist, { recursive: true, force: true });
  const f = path.join(TMPD, `mig-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  wranglerD1File(appDir, persist, f);
}
function applySql(appDir, persist, sql) {
  const f = path.join(TMPD, `one-${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(f, sql);
  wranglerD1File(appDir, persist, f);
}
function d1q(appDir, persist, sql) {
  const out = wranglerD1(appDir, persist, ["--json", "--command", sql]);
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[0].results || [];
}
const listensDigest = (appDir, persist) => {
  const rows = d1q(appDir, persist, "SELECT series||'|'||seq_key||'|'||listened_at||'|'||listen_date||'|'||source AS line FROM podcast_listens ORDER BY series, seq_key");
  const schema = d1q(appDir, persist, "SELECT sql FROM sqlite_master WHERE type='table' AND name='podcast_listens'")[0].sql;
  return { count: rows.length, hash: crypto.createHash("sha256").update(rows.map((r) => r.line).join("\n")).digest("hex"), schema };
};
const posRows = (appDir, persist) => d1q(appDir, persist, "SELECT series, seq_key, position_s, duration_s FROM podcast_positions ORDER BY series, seq_key");
const procs = [];
function startApp(appDir, port, persist) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`,
    "--var", `EXT_CIY_FEED_URL:${FEED}/ciy.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biy.xml`, "--var", `EXT_RIY_FEED_URL:${FEED}/riy.xml`];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const get = async (base, p, headers = {}) => { const r = await fetch(base + p, { headers }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const post = async (base, p, jsonBody, headers = {}) => {
  const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(jsonBody || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const AGENT = { authorization: `Bearer ${TOKEN}` };
const posPost = (series, seqKey, positionS, durationS) => post(BASE, "/api/player/podcasts/position", { series, seqKey, positionS, durationS });
const seriesRead = (k) => get(BASE, `/api/player/podcasts?series=${k}`);
const entryOf = (payload, key) => (payload.entries || []).find((e) => e.key === key);

// ---- verbatim extraction (client legs, the v381 mold) -----------
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

let browser = null;
try {
  await new Promise((r) => feedServer.listen(FEED_PORT, r));

  // ============ Stage A — fixture D1 through 0018 ================
  applyFiles(APP, PERSIST, migFiles(APP, "0018_podcasts_seed_and_bible_out_of_morning.sql"));
  startApp(APP, PORT, PERSIST);
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode), D1 through 0018");

  // Standing progress: the fixture-scale Bible seed (days 1-3,
  // source 'seed' — production's 316 stands at this shape) and one
  // manual Catechism mark.
  const shipDate = chicagoToday();
  applySql(APP, PERSIST, `INSERT OR IGNORE INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES
    ('bible-in-a-year', 'biy:day-1', '2026-11-12T18:00:00.000Z', '${shipDate}', 'seed'),
    ('bible-in-a-year', 'biy:day-2', '2026-11-12T18:00:00.000Z', '${shipDate}', 'seed'),
    ('bible-in-a-year', 'biy:day-3', '2026-11-12T18:00:00.000Z', '${shipDate}', 'seed'),
    ('catechism-in-a-year', 'ciy:day-1', '2026-11-12T15:00:00.000Z', '2026-11-12', 'manual');`);
  const digestBefore = listensDigest(APP, PERSIST);
  ok(digestBefore.count === 4, "fixture progress stands: 3 seeded Bible rows + 1 manual Catechism mark");
  const tablesBefore = d1q(APP, PERSIST, "SELECT name FROM sqlite_master WHERE type='table' AND name='podcast_positions'");
  ok(tablesBefore.length === 0, "P5: before 0019, no podcast_positions table stands");

  // ============ Stage B — P5, migration 0019 =====================
  const mig19 = migFiles(APP).find((f) => f.includes("0019_"));
  ok(!!mig19, "P5: migration 0019 file stands in the migrations dir");
  wranglerD1File(APP, PERSIST, mig19);
  const cols = d1q(APP, PERSIST, "PRAGMA table_info(podcast_positions)");
  ok(cols.map((c) => c.name).join(",") === "series,seq_key,position_s,duration_s,updated_at"
    && cols.filter((c) => c.pk > 0).map((c) => c.name).join(",") === "series,seq_key",
    "P5: 0019 creates podcast_positions with the pinned columns and the (series, seq_key) primary key");
  const digestAfter = listensDigest(APP, PERSIST);
  ok(digestAfter.count === digestBefore.count && digestAfter.hash === digestBefore.hash && digestAfter.schema === digestBefore.schema,
    "P5: podcast_listens schema and rows are byte-identical after 0019 applies on the 0018 tree");

  // ============ Stage C — P3 baseline, then positions ============
  const idx0 = await get(BASE, "/api/player/podcasts");
  const base = {};
  for (const s of ["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year"]) {
    const p = await seriesRead(s);
    base[s] = { listenedCount: p.body.listenedCount, currentKey: p.body.currentKey };
  }
  ok(base["bible-in-a-year"].listenedCount === 3 && base["bible-in-a-year"].currentKey === "biy:day-4",
    "P3: baseline — the fixture-seeded Bible stands at 3 listened, current Day 4 (production's 316/372 shape at fixture scale)");
  await posPost("catechism-in-a-year", "ciy:day-2", 300, 720);
  await posPost("bible-in-a-year", "biy:day-4", 300, 720);
  await posPost("rosary-in-a-year", "riy:day-1", 60, 720);
  ok(posRows(APP, PERSIST).length === 3, "positions stand on three unlistened entries across the three series");
  const idx1 = await get(BASE, "/api/player/podcasts");
  const idxKeys = Object.keys((idx1.body.seriesList || [])[0] || {}).sort().join(",");
  ok(idxKeys === "available,currentKey,currentLabel,listenedCount,series,title,total",
    "P3: the series index payload shape is byte-unchanged — positions never reach the cards");
  let invariant = true;
  for (const s of ["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year"]) {
    const p = await seriesRead(s);
    if (p.body.listenedCount !== base[s].listenedCount || p.body.currentKey !== base[s].currentKey) invariant = false;
  }
  ok(invariant, "P3: with positions standing on unlistened entries, listenedCount and currentKey are identical to the no-positions payload in every series — the option-A derivation untouched");

  // ============ Stage D — P1, route validation ===================
  const badSeries = await posPost("nope", "ciy:day-2", 10, 720);
  ok(badSeries.status === 400, "P1: an unknown series on the position route answers 400");
  const badKey = await posPost("catechism-in-a-year", "ciy:day-99", 10, 720);
  ok(badKey.status === 400, "P1: an unknown seqKey answers 400");
  const wrongSeries = await posPost("rosary-in-a-year", "ciy:day-2", 10, 720);
  ok(wrongSeries.status === 400, "P1: the seqKey validates against THAT series' snapshot (a Catechism key under Rosary is refused 400)");
  const clamp = await posPost("catechism-in-a-year", "ciy:day-3", 99999, 720);
  const clampRow = posRows(APP, PERSIST).find((r) => r.seq_key === "ciy:day-3");
  ok(clamp.status === 200 && clampRow && clampRow.position_s === 720 && clampRow.duration_s === 720,
    "P1: a position past the snapshot's duration clamps to it (99999 -> 720, the snapshot's own duration stored — the client's claim is never trusted)");
  const overListened = await posPost("catechism-in-a-year", "ciy:day-1", 100, 720);
  ok(overListened.status === 200 && !posRows(APP, PERSIST).some((r) => r.seq_key === "ciy:day-1"),
    "P1: a save over a listened episode stores nothing and still answers ok — no resurrection over a finished episode");
  const zeroDel = await posPost("catechism-in-a-year", "ciy:day-3", 0, 720);
  ok(zeroDel.status === 200 && !posRows(APP, PERSIST).some((r) => r.seq_key === "ciy:day-3"),
    "P1: a zero-position save deletes the standing row instead of storing a zero row");
  const doorPos = await post(BASE, "/api/agent/podcasts/position", { series: "catechism-in-a-year", seqKey: "ciy:day-2", positionS: 5, durationS: 720 }, AGENT);
  ok(doorPos.status === 404, "P1: no agent-door position surface exists (the door refuses the POST)");
  const riy5 = entryOf((await seriesRead("rosary-in-a-year")).body, "riy:day-5");
  ok(riy5 && riy5.durationS === 0, "fixture: riy:day-5 carries no duration (the no-duration case stands in the fixture)");
  const noDur = await posPost("rosary-in-a-year", "riy:day-5", 100, 0);
  const noDurRow = posRows(APP, PERSIST).find((r) => r.seq_key === "riy:day-5");
  ok(noDur.status === 200 && noDurRow && noDurRow.position_s === 100,
    "P1: an entry with no standing duration still saves its position as sent (§1's named case — resume lands on the saved second)");

  // ============ Stage E — P2, the payload field ==================
  const ciyP = (await seriesRead("catechism-in-a-year")).body;
  ok(entryOf(ciyP, "ciy:day-2").positionS === 300, "P2: a partway unlistened entry carries its positionS");
  ok(entryOf(ciyP, "ciy:day-1").positionS === null, "P2: a listened entry carries no position (null — the fold reads positions only for unlistened entries)");
  ok(entryOf(ciyP, "ciy:day-4").positionS === null, "P2: an untouched entry carries null");
  const riyP = (await seriesRead("rosary-in-a-year")).body;
  ok(entryOf(riyP, "riy:day-5").positionS === 100 && entryOf(riyP, "riy:day-5").durationS === 0,
    "P2: the no-duration partway entry carries its positionS in the payload (its row will render no bar — P8)");

  // ============ Stage F — P4, clearing through the routes ========
  const mark = (series, k, source) => post(BASE, "/api/player/podcasts/mark", { series, seqKey: k, source });
  const unmark = (series, k) => post(BASE, "/api/player/podcasts/unmark", { series, seqKey: k });
  const mAuto = await mark("catechism-in-a-year", "ciy:day-2", "auto");
  ok(mAuto.status === 200 && !posRows(APP, PERSIST).some((r) => r.seq_key === "ciy:day-2"),
    "P4: POST mark (source auto — the ended path's own call) deletes the position row in the same act");
  const ciyP2 = (await seriesRead("catechism-in-a-year")).body;
  ok(entryOf(ciyP2, "ciy:day-2").listened === true && entryOf(ciyP2, "ciy:day-2").positionS === null,
    "P4: the auto-marked entry reads listened with no position standing over it");
  await posPost("catechism-in-a-year", "ciy:day-4", 100, 720);
  const mMan = await mark("catechism-in-a-year", "ciy:day-4", "manual");
  ok(mMan.status === 200 && !posRows(APP, PERSIST).some((r) => r.seq_key === "ciy:day-4"),
    "P4: POST mark (source manual) deletes the position row in the same act");
  await posPost("bible-in-a-year", "biy:day-5", 100, 720);
  const um = await unmark("bible-in-a-year", "biy:day-5");
  ok(um.status === 200 && !posRows(APP, PERSIST).some((r) => r.seq_key === "biy:day-5"),
    "P4: POST unmark deletes the position row — the episode's whole progress record is wiped");

  // ============ Stage G — client legs (extraction) ===============
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(FEED + "/ciy.xml", { waitUntil: "domcontentloaded" });
  const FN = {};
  for (const nm of ["podPosSlotRead", "podPosSlotWrite", "podPosSlotSet", "podPosSlotDrop", "writePodPositionQuiet",
    "podPositionTick", "podPositionSaveCurrent", "podPositionSkipAway", "drainPodPositions",
    "podDesc", "playPodFrom", "startDesc", "queueStartPos", "podCurrentKey"]) {
    FN[nm] = extractFn(CLIENT, nm);
  }
  const client = await page.evaluate(async (F) => {
    const posts = [];
    let postMode = "ok";
    const store = {};
    const localStorageShim = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
    const state = { podcasts: null, current: null, pendingResume: null, queue: [], queueIdx: -1, rate: 1, lastStartAt: 0, restoredQueue: false };
    // The client module's own vars the extracted units read
    // (declared here so the eval scope carries them).
    var PODPOS_KEY = "opn-podpos-pending-v1";
    var podPosSentKey = null, podPosSentVal = -1, podPosDraining = false;
    const audioEl = { currentTime: 0, duration: 720, paused: false, ended: false };
    const post = (path, body) => {
      posts.push({ path, body: JSON.parse(JSON.stringify(body)) });
      return postMode === "ok" ? Promise.resolve({ ok: true }) : Promise.reject(new Error("offline"));
    };
    const localStorage = localStorageShim;
    const fadeRestore = () => {}, setMediaSessionFor = () => {}, setPlaybackState = () => {},
      markPlaying = () => {}, updateDock = () => {}, saveQueueSnapshot = () => {},
      offlinePodKey = () => "pod:key", loadDescAudio = () => {}, todayChicago = () => "2026-11-13";
    let startQueueDescs = null;
    const startQueue = (descs) => { startQueueDescs = descs; };
    eval(F.podPosSlotRead); eval(F.podPosSlotWrite); eval(F.podPosSlotSet); eval(F.podPosSlotDrop);
    eval(F.writePodPositionQuiet); eval(F.podPositionTick); eval(F.podPositionSaveCurrent);
    eval(F.podPositionSkipAway); eval(F.drainPodPositions);
    eval(F.podDesc); eval(F.playPodFrom); eval(F.startDesc); eval(F.queueStartPos); eval(F.podCurrentKey);
    const flush = () => new Promise((r) => setTimeout(r, 30));
    const out = {};
    const podPayload = { series: "catechism-in-a-year", entries: [
      { key: "ciy:day-1", kind: "day", label: "Day 1", title: "Episode 1", url: "http://x/1.mp3", durationS: 720, listened: true, positionS: null },
      { key: "ciy:day-2", kind: "day", label: "Day 2", title: "Episode 2", url: "http://x/2.mp3", durationS: 720, listened: false, positionS: 300 },
      { key: "ciy:day-3", kind: "day", label: "Day 3", title: "Episode 3", url: "http://x/3.mp3", durationS: 720, listened: false, positionS: null },
      { key: "ciy:day-5", kind: "day", label: "Day 5", title: "Episode 5", url: "http://x/5.mp3", durationS: 720, listened: false, positionS: 690 },
    ], listenedCount: 1, currentKey: "ciy:day-2" };
    state.podcasts = podPayload;

    // ---- P7: descriptors + the resume seam ----------------------
    playPodFrom("ciy:day-2");
    out.p7descs = startQueueDescs.map((d) => ({ id: d.episodeId, pos: d.podPositionS }));
    const d2 = startQueueDescs[0], d3 = startQueueDescs[1], d5 = startQueueDescs[2];
    startDesc(d2);
    out.p7resumeTapped = { pending: state.pendingResume, startPos: queueStartPos(d2) };
    startDesc(d5);
    out.p7resumeLater = { pending: state.pendingResume, startPos: queueStartPos(d5), markPosts: posts.filter((p) => p.path.includes("/mark")).length, day5Listened: podPayload.entries[3].listened };
    startDesc(d3);
    out.p7untouched = { pending: state.pendingResume, startPos: queueStartPos(d3) };
    const d1 = podDesc(podPayload.entries[0]);
    startDesc(d1);
    out.p7listened = { descPos: d1.podPositionS, startPos: queueStartPos(d1) };
    posts.length = 0;

    // ---- P6: the save driver ------------------------------------
    const cur2 = { episodeId: "ciy:day-2", kind: "podcast", seriesKey: "ciy:day-2", podSeries: "catechism-in-a-year", durationS: 720, url: "http://x/2.mp3", available: true };
    state.current = cur2; state.pendingResume = null;
    podPosSentKey = null; podPosSentVal = -1;
    audioEl.paused = false; audioEl.ended = false; audioEl.duration = 720; audioEl.currentTime = 100;
    podPositionTick(); await flush();
    out.p6firstTick = posts.map((p) => p.body);
    posts.length = 0;
    podPositionTick(); await flush();
    audioEl.currentTime = 103; podPositionTick(); await flush();
    out.p6smallMove = posts.length;
    audioEl.currentTime = 106; podPositionTick(); await flush();
    out.p6bigMove = posts.map((p) => p.body);
    posts.length = 0;
    audioEl.paused = true; audioEl.currentTime = 400; podPositionTick(); await flush();
    out.p6pausedTick = posts.length;
    podPositionSaveCurrent(); await flush();
    out.p6pauseSave = posts.map((p) => p.body);
    posts.length = 0;
    audioEl.ended = true; podPositionSaveCurrent(); await flush();
    out.p6endedSave = posts.length;
    audioEl.ended = false; audioEl.currentTime = 720; podPositionSaveCurrent(); await flush();
    out.p6exactEndSave = posts.length;
    audioEl.currentTime = 42;
    podPositionSkipAway({ episodeId: "ciy:day-3" }); await flush();
    out.p6skipAway = posts.map((p) => p.body);
    posts.length = 0;
    podPositionSkipAway({ episodeId: "ciy:day-2" }); await flush();
    out.p6skipSame = posts.length;
    audioEl.ended = true; podPositionSkipAway({ episodeId: "ciy:day-3" }); await flush();
    out.p6skipEnded = posts.length;
    audioEl.ended = false;

    // ---- P9: coalescing + the drain ------------------------------
    postMode = "fail";
    writePodPositionQuiet("catechism-in-a-year", "ciy:day-2", 50, 720); await flush();
    writePodPositionQuiet("catechism-in-a-year", "ciy:day-2", 80, 720); await flush();
    writePodPositionQuiet("catechism-in-a-year", "ciy:day-4", 30, 720); await flush();
    out.p9slot = JSON.parse(JSON.stringify(podPosSlotRead()));
    posts.length = 0;
    postMode = "ok";
    drainPodPositions(); await flush(); await flush();
    out.p9drain = { posts: posts.map((p) => p.body), slotAfter: JSON.parse(JSON.stringify(podPosSlotRead())) };
    posts.length = 0;

    // ---- P10: downloaded-episode parity --------------------------
    const dl = { episodeId: "ciy:day-2", kind: "podcast", seriesKey: "ciy:day-2", podSeries: "catechism-in-a-year", durationS: 720, url: "blob:http://127.0.0.1/dl-blob", available: true };
    const st = { episodeId: "ciy:day-2", kind: "podcast", seriesKey: "ciy:day-2", podSeries: "catechism-in-a-year", durationS: 720, url: "http://x/2.mp3", available: true };
    state.current = dl; podPosSentKey = null; podPosSentVal = -1;
    audioEl.paused = false; audioEl.ended = false; audioEl.currentTime = 222;
    podPositionTick(); await flush();
    const blobBody = posts.map((p) => p.body); posts.length = 0;
    state.current = st; podPosSentKey = null; podPosSentVal = -1;
    podPositionTick(); await flush();
    out.p10 = { blob: blobBody, stream: posts.map((p) => p.body) };
    return out;
  }, FN);
  ok(client.p7descs.length === 3 && client.p7descs[0].pos === 300 && client.p7descs[1].pos === null && client.p7descs[2].pos === 690,
    "P7: playPodFrom's descriptors carry each entry's saved position (partway 300 · untouched null · near-end 690)");
  ok(client.p7resumeTapped.pending && client.p7resumeTapped.pending.positionS === 300 && client.p7resumeTapped.startPos === 300,
    "P7: the tapped partway entry starts at its position through the seam (pendingResume set, queueStartPos returns it)");
  ok(client.p7resumeLater.pending && client.p7resumeLater.pending.positionS === 690 && client.p7resumeLater.startPos === 690
    && client.p7resumeLater.markPosts === 0 && client.p7resumeLater.day5Listened === false,
    "P7: a partway entry reached later in the queue resumes at its OWN position — and a >=95% position (690/720) resumes partway, never marked (no percentage test anywhere)");
  ok(client.p7untouched.startPos === 0 && client.p7listened.descPos === null && client.p7listened.startPos === 0,
    "P7: an untouched entry and a listened entry both start at 0 through the same path");
  ok(client.p6firstTick.length === 1 && client.p6firstTick[0].positionS === 100 && client.p6firstTick[0].series === "catechism-in-a-year" && client.p6firstTick[0].seqKey === "ciy:day-2",
    "P6: the tick fires a save for the current podcast track at its position");
  ok(client.p6smallMove === 0 && client.p6bigMove.length === 1 && client.p6bigMove[0].positionS === 106,
    "P6: the tick writes only on >= 5 s of movement since the last sent value (103 holds, 106 fires)");
  ok(client.p6pausedTick === 0 && client.p6pauseSave.length === 1 && client.p6pauseSave[0].positionS === 400,
    "P6: no tick writes while paused; the pause event save writes once, at the paused position");
  ok(client.p6endedSave === 0 && client.p6exactEndSave === 0,
    "P6: the ended path never saves — and a save at the element's exact end is suppressed (the mark's moment is never raced)");
  ok(client.p6skipAway.length === 1 && client.p6skipAway[0].seqKey === "ciy:day-2" && client.p6skipAway[0].positionS === 42,
    "P6: skip-away writes the OUTGOING track's position in the moment of leaving");
  ok(client.p6skipSame === 0 && client.p6skipEnded === 0,
    "P6: skip-away never fires for a same-episode restart or across an ended track");
  const slotKeys = Object.keys(client.p9slot).sort();
  ok(slotKeys.join(",") === "catechism-in-a-year/ciy:day-2,catechism-in-a-year/ciy:day-4"
    && client.p9slot["catechism-in-a-year/ciy:day-2"].positionS === 80,
    "P9: two failed saves for one episode leave exactly ONE pending value — the newest (50 superseded by 80); a second episode's failed save stands independently in the same slot");
  ok(client.p9drain.posts.length === 2
    && client.p9drain.posts.some((b) => b.seqKey === "ciy:day-2" && b.positionS === 80)
    && client.p9drain.posts.some((b) => b.seqKey === "ciy:day-4" && b.positionS === 30)
    && Object.keys(client.p9drain.slotAfter).length === 0,
    "P9: the drain at open sends each pending entry once — the newest only — and the slot stands empty after");
  ok(JSON.stringify(client.p10.blob) === JSON.stringify(client.p10.stream) && client.p10.blob.length === 1 && client.p10.blob[0].positionS === 222,
    "P10: a downloaded (cache-first/blob-URL) episode's save is byte-identical in shape and value to a streamed episode's — parity by construction");

  // ============ Stage H — P8, the display (real app) ==============
  // Positions for the display: ciy:day-3 at exactly half (360/720);
  // ciy:day-2 was auto-marked in Stage F (no position stands).
  await posPost("catechism-in-a-year", "ciy:day-3", 360, 720);
  const page2 = await browser.newPage();
  await page2.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("#tabbar .tab[data-tab='podcasts']", { timeout: 20000 });
  await page2.click("#tabbar .tab[data-tab='podcasts']");
  await page2.waitForSelector("[data-podseries='catechism-in-a-year']", { timeout: 20000 });
  await page2.click("[data-podseries='catechism-in-a-year']");
  await page2.waitForSelector("[data-podrow='ciy:day-3']", { timeout: 20000 });
  const disp = await page2.evaluate(() => {
    const row = (k) => document.querySelector(`[data-podrow='${k}']`);
    const r3 = row("ciy:day-3"), r4 = row("ciy:day-5"), r1 = row("ciy:day-1");
    const bar = r3 ? r3.querySelector(".podbar") : null;
    const fill = bar ? bar.querySelector("i") : null;
    const rr = r3.getBoundingClientRect(), br = bar ? bar.getBoundingClientRect() : null;
    const chip = (r) => { const b = r.querySelector("[data-podmark]"); return b ? b.outerHTML : null; };
    return {
      barWidth: fill ? fill.style.width : null,
      rowH: r3.offsetHeight,
      barInside: !!(bar && br.bottom <= rr.bottom + 0.6 && br.top >= rr.top),
      untouchedBar: r4 ? !!r4.querySelector(".podbar") : null,
      listenedBar: r1 ? !!r1.querySelector(".podbar") : null,
      // The chip markup modulo the row's own key (the
      // data-podmark attribute carries it by design).
      chipPartway: chip(r3) ? chip(r3).replace("ciy:day-3", "KEY") : null,
      chipUntouched: chip(r4) ? chip(r4).replace("ciy:day-5", "KEY") : null,
      currentCardBar: !!document.querySelector(".card:not(.trow) .podbar"),
    };
  });
  ok(disp.barWidth === "50%", "P8: a partway row renders the bar at position / duration width (360/720 = 50%)");
  ok(disp.rowH === 76 && disp.barInside, "P8: the bar stands inside the uniform 76 px row — no height gained");
  ok(disp.untouchedBar === false && disp.listenedBar === false, "P8: an untouched row and a listened row render no bar");
  ok(disp.chipPartway === disp.chipUntouched && disp.chipPartway !== null, "P8: the mark chip on a partway row is byte-unchanged from an untouched row's");
  ok(disp.currentCardBar === false, "P8: the Current-episode card's face is unchanged (no bar stands on it)");
  await page2.click("[data-podback]");
  await page2.waitForSelector("[data-podseries='rosary-in-a-year']", { timeout: 20000 });
  await page2.click("[data-podseries='rosary-in-a-year']");
  await page2.waitForSelector("[data-podrow='riy:day-5']", { timeout: 20000 });
  const noDurBar = await page2.$eval("[data-podrow='riy:day-5']", (el) => !!el.querySelector(".podbar"));
  ok(noDurBar === false, "P8: a partway entry with no duration renders no bar (the fraction cannot render — the honest row is a plain row)");

  // ============ Statics ==========================================
  ok(UI_TS.includes('var CACHE = "ora-pro-nobis-v395-1";'), "statics: the SW pin advances to ora-pro-nobis-v395-1 in ui.ts");
  let bundleOk = true, bundleErr = "";
  try {
    execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
      [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/dev/null"], { stdio: "pipe" });
  } catch (e) { bundleOk = false; bundleErr = String(e.stderr || e.message).slice(0, 400); }
  ok(bundleOk, "statics: the candidate Worker bundles clean (esbuild over index.ts)", bundleErr);
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
  try { feedServer.close(); } catch { /* noop */ }
  await sleep(500);
}
console.log(`# harness-v395: ${n - fails}/${n} legs ok`);
process.exit(fails ? 1 : 0);
