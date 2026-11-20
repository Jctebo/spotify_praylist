#!/usr/bin/env node
// harness-v390-amendment — the v390 option A amendment gate
// (§2.10, 2026-11-12; John's decision, Ora thread 20:21 CT):
// (a) the Bible seed gains the bonus entries standing before the
// Day 316 entry (seed total 316); (b) the current-episode
// derivation is DAY-FIRST in all three series — current is the
// first unlistened day entry (kind day|special); a bonus becomes
// current only when no unlistened day entry stands. Legs A1–A6
// run on fixtures shaped like the live feeds' proven trouble
// spots (a bonus anchored mid-run before the frontier · two head
// bonuses · a head 'Pray with Fr. Mike' bonus); legs A7 run the
// AMENDED §2.5 seed end-to-end against the LIVE Fireside feeds,
// exactly as §4's Review ran the original — totals, the seed
// count, and the corrected currentKey read-backs are asserted,
// never assumed. Mold: harness-v390 (local wrangler, LOCAL_DEV,
// fixture D1 migrated through 0018). Tallies from the COMPLETE log.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v390-amendment runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997, LPORT = 8998, FEED_PORT = 8957;
const BASE = `http://127.0.0.1:${PORT}`, LBASE = `http://127.0.0.1:${LPORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v390a");
const LPERSIST = path.join(APP, ".wrangler-test-v390a-live");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v390a-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const LIVE = {
  ciy: "https://feeds.fireside.fm/catechisminayear/rss",
  biy: "https://feeds.fireside.fm/bibleinayear/rss",
  riy: "https://feeds.fireside.fm/rosaryinayear/rss",
};

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// ---- fixture feeds: the live trouble shapes at fixture scale ---
function itemXml({ title, pub, dur, guid, url }) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate><guid isPermaLink="false">${guid}</guid>`
    + `<enclosure url="${url}" length="1000000" type="audio/mpeg"/><itunes:duration>${dur}</itunes:duration></item>`;
}
function feedXml(chanTitle, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>`
    + `<title>${chanTitle}</title>` + items.join("") + `</channel></rss>`;
}
const A = (name) => `${FEED}/audio/${name}.mp3`;
const dayItem = (prefix, day, year) => itemXml({
  title: `Day ${day}: Episode ${day}`,
  pub: `Thu, 0${(day % 9) + 1} Jan ${year} 15:00:00 +0000`,
  dur: "12:00", guid: `guid-${prefix}-${year}-${day}`, url: A(`${prefix}-day${day}-${year}`),
});
// Bible-like: Days 1-5 (2025) + ONE bonus published after Day 3
// (Jan 4 18:00, between Day 3's Jan 4 15:00 and Day 4's Jan 5
// 15:00) — it anchors at Day 3 and stands BEFORE the Day 4
// frontier: the live biy:bonus-if-you-feel-like shape, small.
const FEED_BIY_AMD = feedXml("The Bible in a Year (with Fr. Mike Schmitz)", [
  itemXml({ title: "BONUS: Mid Run Encouragement (with Jeff Cavins)", pub: "Sat, 04 Jan 2025 18:00:00 +0000", dur: "18:00", guid: "guid-biy-amd-b-mid", url: A("biy-amd-bonus-mid") }),
  ...[5, 4, 3, 2, 1].map((d) => dayItem("biy", d, 2025)),
]);
// Rosary-like: TWO head bonuses (both published Jan 1 2025, before
// every day) + Days 1-4 — the live Rosary head shape, small.
const FEED_RIY_AMD = feedXml("The Rosary in a Year (with Fr. Mark-Mary Ames)", [
  itemXml({ title: "BONUS: Preparing for the Rosary", pub: "Wed, 01 Jan 2025 09:00:00 +0000", dur: "9:00", guid: "guid-riy-amd-b-prep", url: A("riy-amd-bonus-prep") }),
  itemXml({ title: "BONUS: Introduction to Phase One", pub: "Wed, 01 Jan 2025 18:00:00 +0000", dur: "9:00", guid: "guid-riy-amd-b-p1", url: A("riy-amd-bonus-p1") }),
  ...[4, 3, 2, 1].map((d) => dayItem("riy", d, 2025)),
]);
// Catechism-like: the 'Pray with Fr. Mike' head bonus (2022, the
// shortcut slug 'pray', anchor 0) + Days 1-3 — the live Catechism
// head shape, small.
const FEED_CIY_AMD = feedXml("The Catechism in a Year (with Fr. Mike Schmitz)", [
  itemXml({ title: "BONUS: Pray with Fr. Mike", pub: "Tue, 15 Nov 2022 15:00:00 +0000", dur: "15:00", guid: "guid-ciy-amd-b-pray", url: A("ciy-amd-bonus-pray") }),
  ...[3, 2, 1].map((d) => dayItem("ciy", d, 2025)),
]);
const feedBodies = { "/ciy.xml": FEED_CIY_AMD, "/biy.xml": FEED_BIY_AMD, "/riy.xml": FEED_RIY_AMD };
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
function migFiles(appDir) {
  const dir = path.join(appDir, "migrations");
  return fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(dir, f));
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
function d1x(appDir, persist, sql) {
  try {
    const out = wranglerD1(appDir, persist, ["--json", "--command", sql]);
    const parsed = JSON.parse(out.slice(out.indexOf("[")));
    return { ok: true, changes: parsed[0].meta ? parsed[0].meta.changes : null };
  } catch { return { ok: false, changes: null }; }
}
// The §2.5 seed act (amended form): chunked INSERT OR IGNORE,
// at most 50 rows per statement, source 'seed', the ship date.
function seedInsert(appDir, persist, series, keys) {
  const date = chicagoToday();
  const now = new Date().toISOString();
  let allOk = true;
  for (let i = 0; i < keys.length; i += 50) {
    const chunk = keys.slice(i, i + 50);
    const sql = "INSERT OR IGNORE INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES "
      + chunk.map((k) => `('${series}', '${k}', '${now}', '${date}', 'seed')`).join(", ");
    if (!d1x(appDir, persist, sql).ok) allOk = false;
  }
  return allOk;
}
const seedCount = (appDir, persist, series) =>
  d1q(appDir, persist, `SELECT COUNT(*) AS c FROM podcast_listens WHERE series='${series}' AND source='seed'`)[0].c;
const procs = [];
function startApp(appDir, port, persist, feeds) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`,
    "--var", `EXT_CIY_FEED_URL:${feeds.ciy}`, "--var", `EXT_BIAY_FEED_URL:${feeds.biy}`, "--var", `EXT_RIY_FEED_URL:${feeds.riy}`];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
// getRetry: the harness-v390 close-out precedent — the sandbox
// egress proxy intermittently resets a fetch while the Worker
// fans out (here: the live-feed builds); retry CONNECT-LEVEL
// failures only, then judge the response by the unchanged
// assertions.
const getRetry = async (base, p, headers = {}) => {
  let lastErr = null;
  for (let i = 0; i < 12; i++) {
    try { const r = await fetch(base + p, { headers }); return { status: r.status, body: await r.json().catch(() => ({})) }; }
    catch (e) { lastErr = e; await sleep(3000); }
  }
  throw lastErr;
};
const get = async (base, p, headers = {}) => { const r = await fetch(base + p, { headers }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const post = async (base, p, jsonBody, headers = {}) => {
  const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(jsonBody || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const AGENT = { authorization: `Bearer ${TOKEN}` };
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

  // ============ Fixture instance — D1 through 0018 ==============
  applyFiles(APP, PERSIST, migFiles(APP));
  startApp(APP, PORT, PERSIST, { ciy: `${FEED}/ciy.xml`, biy: `${FEED}/biy.xml`, riy: `${FEED}/riy.xml` });
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV), D1 through 0018 (the amended seed's store)");

  const seriesRead = (base, k) => get(base, `/api/player/podcasts?series=${k}`);
  const keysOf = (p) => (p.body.entries || []).map((e) => e.key);

  // ============ A1 — the fixture sequences carry the shapes =====
  const biyP = await seriesRead(BASE, "bible-in-a-year");
  ok(keysOf(biyP).join(",") === "biy:day-1,biy:day-2,biy:day-3,biy:bonus-mid-run-encouragement-with,biy:day-4,biy:day-5",
    "A1: the Bible fixture's bonus anchors after Day 3 — it stands BEFORE the Day 4 frontier (the live if-you-feel-like shape)");
  const riyP = await seriesRead(BASE, "rosary-in-a-year");
  ok(keysOf(riyP).join(",") === "riy:bonus-preparing-for-the-rosary,riy:bonus-introduction-to-phase-one,riy:day-1,riy:day-2,riy:day-3,riy:day-4",
    "A1: the Rosary fixture's two bonuses stand at the sequence head, before Day 1 (the live head shape)");
  const ciyP = await seriesRead(BASE, "catechism-in-a-year");
  ok(keysOf(ciyP).join(",") === "ciy:bonus-pray,ciy:day-1,ciy:day-2,ciy:day-3",
    "A1: the Catechism fixture opens its LIST with the 'Pray with Fr. Mike' bonus, then Day 1 (the live head shape)");

  // ============ A2 — empty-store derivations are day-first =======
  ok(biyP.body.currentKey === "biy:day-1", "A2: empty Bible derives current Day 1");
  ok(riyP.body.currentKey === "riy:day-1"
    && riyP.body.entries[0].listened === false && riyP.body.entries[1].listened === false,
    "A2: empty Rosary derives current riy:day-1 — the two head bonuses stand unlistened and do NOT become current (§2.10b; John's word: Day 1, not started)");
  ok(ciyP.body.currentKey === "ciy:day-1" && ciyP.body.entries[0].key === "ciy:bonus-pray" && ciyP.body.entries[0].listened === false,
    "A2: empty Catechism derives current ciy:day-1 — the head bonus still opens the list and stands playable/markable, but no longer derives as current (§2.10c — the stated change from v381)");
  const idx = await get(BASE, "/api/player/podcasts");
  const idxBy = Object.fromEntries((idx.body.seriesList || []).map((s) => [s.series, s]));
  ok(idxBy["rosary-in-a-year"].currentLabel === "Day 1" && idxBy["catechism-in-a-year"].currentLabel === "Day 1"
    && idxBy["bible-in-a-year"].currentLabel === "Day 1",
    "A2: the series index paints the same day-first currents (one derivation, both surfaces)");

  // ============ A3 — the RULE alone carries the Bible frontier ===
  // Seed ONLY the days (the pre-amendment §2.5 set): the unlistened
  // mid bonus stands before Day 4, yet current must be Day 4.
  ok(seedInsert(APP, PERSIST, "bible-in-a-year", ["biy:day-1", "biy:day-2", "biy:day-3"]),
    "A3: the days-only seed inserts (the pre-amendment set, for contrast)");
  let p = await seriesRead(BASE, "bible-in-a-year");
  const midBonus = (p.body.entries || []).find((e) => e.key === "biy:bonus-mid-run-encouragement-with");
  ok(p.body.currentKey === "biy:day-4" && midBonus && midBonus.listened === false,
    "A3: with days 1-3 seeded and the mid bonus UNLISTENED before the frontier, current is biy:day-4 — the day-first rule alone carries it");
  applySql(APP, PERSIST, "DELETE FROM podcast_listens WHERE series='bible-in-a-year';");

  // ============ A4 — the AMENDED seed (§2.10a) at fixture scale ==
  // The amended formula over the built payload: day entries 1-3
  // (the fixture's 315) PLUS every bonus standing before the
  // frontier entry (the fixture's Day 316 = Day 4).
  p = await seriesRead(BASE, "bible-in-a-year");
  const frontierAt = (p.body.entries || []).findIndex((e) => e.key === "biy:day-4");
  const seedKeys = (p.body.entries || []).filter((e, i) =>
    (e.kind !== "bonus" && e.day !== null && e.day <= 3) || (e.kind === "bonus" && i < frontierAt)).map((e) => e.key);
  ok(seedKeys.join(",") === "biy:day-1,biy:day-2,biy:day-3,biy:bonus-mid-run-encouragement-with",
    "A4: the amended seed set = days 1-3 + the one bonus standing before the frontier (the formula §2.10a fixes for Ship)");
  ok(seedInsert(APP, PERSIST, "bible-in-a-year", seedKeys) && seedCount(APP, PERSIST, "bible-in-a-year") === 4,
    "A4: the amended seed inserts its 4 rows (fixture scale of 316), all source 'seed' by read-back");
  p = await seriesRead(BASE, "bible-in-a-year");
  ok(p.body.listenedCount === 4 && p.body.currentKey === "biy:day-4",
    "A4: post-seed Bible reads 4 listened · current biy:day-4 (fixture scale of 316 · biy:day-316)");
  ok(seedInsert(APP, PERSIST, "bible-in-a-year", seedKeys) && seedCount(APP, PERSIST, "bible-in-a-year") === 4,
    "A4: the amended seed re-run inserts 0 (INSERT OR IGNORE — the count stands)");

  // ============ A5 — gaps, and the bonus fallback ================
  const markS = (series, k) => post(BASE, "/api/player/podcasts/mark", { series, seqKey: k, source: "manual" });
  await markS("catechism-in-a-year", "ciy:day-1");
  p = await seriesRead(BASE, "catechism-in-a-year");
  ok(p.body.currentKey === "ciy:day-2", "A5: Catechism Day 1 marked → current is Day 2 (the unlistened head bonus is skipped while days remain)");
  await markS("catechism-in-a-year", "ciy:day-2"); await markS("catechism-in-a-year", "ciy:day-3");
  p = await seriesRead(BASE, "catechism-in-a-year");
  ok(p.body.currentKey === "ciy:bonus-pray",
    "A5: with every day listened, current falls back to the first unlistened bonus — a bonus is current ONLY when no unlistened day stands");
  await markS("catechism-in-a-year", "ciy:bonus-pray");
  p = await seriesRead(BASE, "catechism-in-a-year");
  ok(p.body.currentKey === null, "A5: a fully listened series derives current null (complete — the standing terminal state)");
  await markS("rosary-in-a-year", "riy:day-1"); await markS("rosary-in-a-year", "riy:day-2"); await markS("rosary-in-a-year", "riy:day-4");
  p = await seriesRead(BASE, "rosary-in-a-year");
  ok(p.body.currentKey === "riy:day-3", "A5: Rosary marks {1,2,4} → current is Day 3 (the gap is never skipped, head bonuses aside)");

  // ============ A6 — the client mirror (podCurrentKey) ===========
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("about:blank");
  const mirror = await page.evaluate(({ pk, wpm, ptm, pp }) => {
    const E = (key, kind, listened) => ({ key, kind, listened: !!listened, label: "Day", title: "T", durationS: 60 });
    eval(pk);
    const unit = {
      headBonus: podCurrentKey([E("x:bonus-a", "bonus"), E("x:day-1", "day")]),
      gapBonus: podCurrentKey([E("x:day-1", "day", 1), E("x:bonus-a", "bonus"), E("x:day-2", "day")]),
      fallback: podCurrentKey([E("x:day-1", "day", 1), E("x:bonus-a", "bonus")]),
      specialIsDay: podCurrentKey([E("x:bonus-a", "bonus"), E("x:day-366", "special")]),
      complete: podCurrentKey([E("x:day-1", "day", 1), E("x:bonus-a", "bonus", 1)]),
    };
    // Site 1 — writePodMarkQuiet's in-memory recompute: entries
    // [day-1, mid bonus, day-2]; marking day-1 must derive day-2,
    // NOT the bonus the old first-unlistened rule would name.
    const calls = [];
    const post = (...a) => { calls.push(a); return Promise.resolve({}); };
    const todayChicago = () => "2026-11-12";
    const state = { podcasts: { series: "bible-in-a-year", listenedCount: 0, currentKey: "biy:day-1",
      entries: [E("biy:day-1", "day"), E("biy:bonus-mid", "bonus"), E("biy:day-2", "day")] }, tab: "intentions" };
    eval(wpm);
    writePodMarkQuiet("biy:day-1", "bible-in-a-year", "auto");
    const site1 = state.podcasts.currentKey;
    // Site 2 — podToggleMark's recompute, same shape. The real
    // function repaints through paintPodcasts against a live
    // document; the stub document answers its three calls
    // (innerHTML set · two querySelectorAll → [] · the scroll
    // querySelector → null) so the recompute runs as shipped.
    const res2 = { series: "bible-in-a-year", title: "Bible in a Year", available: true, total: 3, listenedCount: 0, currentKey: "biy:day-1",
      entries: [E("biy:day-1", "day"), E("biy:bonus-mid", "bonus"), E("biy:day-2", "day")] };
    state.podcasts = res2; state.tab = "podcasts";
    const view = { innerHTML: "", querySelectorAll: () => [], querySelector: () => null };
    const esc = (s) => String(s);
    const fmtDur = () => "";
    const wirePodBack = () => {};
    eval(pp); eval(ptm);
    podToggleMark("biy:day-1");
    // The evaluate's own promise chain does not reliably flush
    // podToggleMark's .then before the outer await resolves (the
    // v390 L6 mold runs its seam synchronously) — capture the
    // result onto window and let the Node side poll for it.
    window.__toggleResult = null;
    setTimeout(() => { window.__toggleResult = { currentKey: res2.currentKey, listenedCount: res2.listenedCount }; }, 300);
    return { unit, site1 };
  }, { pk: extractFn(CLIENT, "podCurrentKey"), wpm: extractFn(CLIENT, "writePodMarkQuiet"), ptm: extractFn(CLIENT, "podToggleMark"), pp: extractFn(CLIENT, "paintPodcasts") });
  ok(mirror.unit.headBonus === "x:day-1" && mirror.unit.gapBonus === "x:day-2" && mirror.unit.fallback === "x:bonus-a"
    && mirror.unit.specialIsDay === "x:day-366" && mirror.unit.complete === null,
    "A6: podCurrentKey unit cases — head bonus skipped · gap bonus skipped · bonus fallback when no day stands · the Day 366 special counts as a day · complete derives null");
  ok(mirror.site1 === "biy:day-2", "A6: writePodMarkQuiet's in-memory recompute is day-first (marking Day 1 derives Day 2, not the mid bonus)");
  let toggleRes = null;
  for (let i = 0; i < 40 && !toggleRes; i++) { toggleRes = await page.evaluate(() => window.__toggleResult); if (!toggleRes) await sleep(250); }
  ok(!!toggleRes && toggleRes.currentKey === "biy:day-2" && toggleRes.listenedCount === 1,
    "A6: podToggleMark's recompute is day-first (the second client site mirrors the Worker)");

  // ============ A7 — LIVE: the amended §2.5, end-to-end ==========
  applyFiles(APP, LPERSIST, migFiles(APP));
  startApp(APP, LPORT, LPERSIST, LIVE);
  ok(await waitUp(LBASE), "A7: live instance up (real Fireside feeds through the standing seams, empty store)");
  const liveBiy = await getRetry(LBASE, "/api/player/podcasts?series=bible-in-a-year");
  ok(liveBiy.body.available === true && liveBiy.body.total === 372,
    "A7: the LIVE Bible sequence builds at total 372 (§2.2/§4 confirmed at this seating)");
  const liveEntries = liveBiy.body.entries || [];
  const day316At = liveEntries.findIndex((e) => e.key === "biy:day-316");
  const preFrontierBonuses = liveEntries.filter((e, i) => e.kind === "bonus" && i < day316At).map((e) => e.key);
  ok(day316At > 0 && preFrontierBonuses.join(",") === "biy:bonus-if-you-feel-like",
    "A7: exactly ONE bonus stands before Day 316 on the live sequence — biy:bonus-if-you-feel-like (§4's proof, re-derived)");
  const liveSeedKeys = liveEntries.filter((e, i) =>
    (e.kind !== "bonus" && e.day !== null && e.day >= 1 && e.day <= 315) || (e.kind === "bonus" && i < day316At)).map((e) => e.key);
  ok(liveSeedKeys.length === 316, "A7: the amended seed set over the live sequence is exactly 316 keys (Days 1-315 + the one pre-frontier bonus)");
  ok(seedInsert(APP, LPERSIST, "bible-in-a-year", liveSeedKeys) && seedCount(APP, LPERSIST, "bible-in-a-year") === 316,
    "A7: the amended seed inserts 316 rows against the live-built snapshot (chunked ≤50, source 'seed')");
  const doorBiy = await getRetry(LBASE, "/api/agent/podcasts/progress?series=bible-in-a-year", AGENT);
  ok(doorBiy.body.listenedCount === 316 && doorBiy.body.total === 372 && doorBiy.body.currentKey === "biy:day-316",
    "A7: POST-SEED READ-BACK (corrected, §2.10d) — Bible stands at 316 of 372 listened · currentKey biy:day-316");
  ok(seedInsert(APP, LPERSIST, "bible-in-a-year", liveSeedKeys) && seedCount(APP, LPERSIST, "bible-in-a-year") === 316,
    "A7: the amended seed re-run inserts 0 (the count stands at 316)");
  const liveRiy = await getRetry(LBASE, "/api/player/podcasts?series=rosary-in-a-year");
  ok(liveRiy.body.available === true && liveRiy.body.total === 371
    && liveRiy.body.entries[0].key === "riy:bonus-preparing-for-the-rosary" && liveRiy.body.entries[1].key === "riy:bonus-introduction-to-phase-one"
    && liveRiy.body.listenedCount === 0 && liveRiy.body.currentKey === "riy:day-1",
    "A7: LIVE Rosary — total 371 · two head bonuses stand first, unlistened · currentKey riy:day-1 from the empty store (the corrected read-back, §2.10d)");
  const liveCiy = await getRetry(LBASE, "/api/player/podcasts?series=catechism-in-a-year");
  ok(liveCiy.body.available === true && liveCiy.body.entries[0].key === "ciy:bonus-pray" && liveCiy.body.entries[1].key === "ciy:day-1"
    && liveCiy.body.entries[0].listened === false && liveCiy.body.currentKey === "ciy:day-1",
    "A7: LIVE Catechism — the 'Pray with Fr. Mike' bonus opens the list unlistened, and the amended derivation names ciy:day-1 as current (§2.10c proven on the live sequence)");
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
  try { feedServer.close(); } catch { /* noop */ }
  await sleep(500);
}
console.log(`# harness-v390-amendment: ${n - fails}/${n} legs ok`);
process.exit(fails ? 1 : 0);
