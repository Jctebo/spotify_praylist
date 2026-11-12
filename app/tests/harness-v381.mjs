#!/usr/bin/env node
// harness-v381 — the v381 gate (Plan §2.7 legs L1–L9): the
// Podcasts section. The Worker sequence build (edition supply ·
// duplicate collapse · bonus anchoring · Day 366 last · trailer
// excluded), the snapshot's 24h lazy refresh, the progress
// routes (session mark/unmark, first mark stands, agent door
// read-only), the first-unlistened current derivation, the
// auto-mark seam at markCompleted, the tab rendering against a
// pinned progress set, and the no-checklist guard (the Prayers
// tab byte-identical to the pre-v381 build). Fixture posture:
// the estate mold — a local wrangler instance INSIDE this
// worktree with LOCAL_DEV + the EXT_CIY_FEED_URL seam pointed at
// a mutable fixture feed server; fixture feeds are trimmed from
// the real feed's shapes (real title formats, the real Day 19
// pair, the real bonus titles). The pristine instance for L8 is
// the v379 production base worktree (OPN_PRISTINE_APP). Tallies
// read from the COMPLETE log.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v381 runs only inside a release worktree"); process.exit(2); }
const PRISTINE_APP = process.env.OPN_PRISTINE_APP || "/home/hatch/workspace/.worktrees/v379-tts/app";
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8991, PPORT = 8992, FEED_PORT = 8951;
const BASE = `http://127.0.0.1:${PORT}`, PBASE = `http://127.0.0.1:${PPORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v381");
const PPERSIST = path.join(PRISTINE_APP, ".wrangler-test-v381p");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v381-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// ---- fixture feeds (trimmed from the real feed's shapes) -------
function itemXml({ title, pub, dur, guid, url }) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate><guid isPermaLink="false">${guid}</guid>`
    + `<enclosure url="${url}" length="1000000" type="audio/mpeg"/><itunes:duration>${dur}</itunes:duration></item>`;
}
function feedXml(items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>`
    + `<title>The Catechism in a Year (with Fr. Mike Schmitz)</title>` + items.join("") + `</channel></rss>`;
}
const A = (name) => `${FEED}/audio/${name}.mp3`;
// L1: a complete older edition (2024, Days 1-5) + a partial newer
// one (2025, Days 1-3; A2 gains Day 4).
const dayItem = (day, year, extra = {}) => itemXml({
  title: `Day ${day}: Episode ${day}${year >= 2024 && day % 2 === 0 ? ` (${year})` : ""}`,
  pub: extra.pub || `Thu, 0${(day % 9) + 1} Jan ${year} 15:00:00 +0000`,
  dur: extra.dur || "12:00", guid: extra.guid || `guid-${year}-${day}`, url: extra.url || A(`day${day}-${year}`),
});
const FEED_A1_REAL = feedXml([3, 2, 1].map((d) => dayItem(d, 2025)).concat([5, 4, 3, 2, 1].map((d) => dayItem(d, 2024))));
const FEED_A2 = feedXml([4, 3, 2, 1].map((d) => dayItem(d, 2025)).concat([5, 4, 3, 2, 1].map((d) => dayItem(d, 2024))));
// L2: the real 2025 Day 19 pair shape (same pubDate + duration,
// two GUIDs, one title suffixed) + a differing-pubDate pair.
const FEED_B = feedXml([
  dayItem(1, 2025),
  itemXml({ title: "Day 19: Episode 19 (2025)", pub: "Sun, 19 Jan 2025 15:00:00 +0000", dur: "10:32", guid: "guid-2025-19-b", url: A("day19-2025-b") }),
  itemXml({ title: "Day 19: Episode 19", pub: "Sun, 19 Jan 2025 15:00:00 +0000", dur: "10:32", guid: "guid-2025-19-a", url: A("day19-2025-a") }),
  itemXml({ title: "Day 20: Episode 20", pub: "Mon, 20 Jan 2025 15:00:00 +0000", dur: "11:00", guid: "guid-2025-20-old", url: A("day20-2025-old") }),
  itemXml({ title: "Day 20: Episode 20 (2025)", pub: "Tue, 21 Jan 2025 09:00:00 +0000", dur: "11:05", guid: "guid-2025-20-new", url: A("day20-2025-new") }),
]);
// L3: the three real bonus contents + the trailer + Day 366.
const FEED_C = feedXml([
  itemXml({ title: "BONUS: Praying with Bishop Cozzens", pub: "Wed, 31 Dec 2025 15:00:00 +0000", dur: "20:00", guid: "guid-b-cozzens-2025", url: A("bonus-cozzens-2025") }),
  dayItem(365, 2025, { pub: "Wed, 31 Dec 2025 08:00:00 +0000" }),
  itemXml({ title: "BONUS: Catechism in a Year with Jeff Cavins", pub: "Tue, 30 Dec 2025 15:00:00 +0000", dur: "22:00", guid: "guid-b-cavins-2025", url: A("bonus-cavins-2025") }),
  dayItem(364, 2025, { pub: "Tue, 30 Dec 2025 08:00:00 +0000" }),
  dayItem(363, 2025, { pub: "Mon, 29 Dec 2025 15:00:00 +0000" }),
  itemXml({ title: "Day 366: Special Leap Year Message (2024)", pub: "Tue, 31 Dec 2024 15:00:00 +0000", dur: "5:00", guid: "guid-2024-366", url: A("day366-2024") }),
  itemXml({ title: "BONUS: Pray with Fr. Mike", pub: "Tue, 15 Nov 2022 15:00:00 +0000", dur: "15:00", guid: "guid-b-pray-2022", url: A("bonus-pray-2022") }),
  itemXml({ title: "Introducing Catechism in a Year", pub: "Sat, 01 Oct 2022 15:00:00 +0000", dur: "2:00", guid: "guid-trailer", url: A("trailer") }),
]);

let feedBody = FEED_A1_REAL, feedDown = false, feedHits = 0;
const feedServer = http.createServer((req, res) => {
  if (req.url === "/ciy.xml") {
    feedHits++;
    if (feedDown) { res.writeHead(500); res.end("down"); return; }
    res.writeHead(200, { "content-type": "application/rss+xml" }); res.end(feedBody); return;
  }
  if (req.url && req.url.startsWith("/audio/")) { res.writeHead(200, { "content-type": "audio/mpeg" }); res.end(Buffer.alloc(64)); return; }
  res.writeHead(404); res.end("nope");
});

// ---- wrangler helpers (the estate mold) -------------------------
function wranglerD1File(appDir, persist, file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(appDir, "wrangler.toml"), "--persist-to", persist, "--file", file],
    { cwd: appDir, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
}
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
const procs = [];
function startApp(appDir, port, persist) {
  const args = ["dev", "--config", path.join(appDir, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`, "--var", `EXT_CIY_FEED_URL:${FEED}/ciy.xml`];
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
const resetPod = () => applySql(APP, PERSIST, "DELETE FROM podcast_sequences; DELETE FROM podcast_listens;");
const expireSnapshot = () => applySql(APP, PERSIST, `UPDATE podcast_sequences SET built_at = '2000-01-01T00:00:00.000Z', payload = json_set(payload, '$.builtAt', '2000-01-01T00:00:00.000Z');`);

// ---- verbatim extraction (client legs) --------------------------
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
  applyFiles(APP, PERSIST, migFiles(APP));
  startApp(APP, PORT, PERSIST);
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");

  // ---------- L1 — edition supply --------------------------------
  feedBody = FEED_A1_REAL; resetPod();
  let r = await get(BASE, "/api/player/podcasts");
  let es = r.body.entries || [];
  ok(r.body.available === true && es.map((e) => e.key).join(",") === "ciy:day-1,ciy:day-2,ciy:day-3,ciy:day-4,ciy:day-5",
    "L1 sequence: Days 1-5 in order with stable keys");
  ok(es[0].url === A("day1-2025") && es[2].url === A("day3-2025") && es[3].url === A("day4-2024") && es[4].url === A("day5-2024"),
    "L1 edition supply: Days 1-3 play the 2025 recordings; Days 4-5 (past the newer edition's reach) fall back to 2024");
  await post(BASE, "/api/player/podcasts/mark", { series: "catechism-in-a-year", seqKey: "ciy:day-5", source: "manual" });
  feedBody = FEED_A2; expireSnapshot();
  r = await get(BASE, "/api/player/podcasts");
  es = r.body.entries || [];
  const d4 = es.find((e) => e.key === "ciy:day-4"), d5 = es.find((e) => e.key === "ciy:day-5");
  ok(d4 && d4.url === A("day4-2025") && es.map((e) => e.key).join(",") === "ciy:day-1,ciy:day-2,ciy:day-3,ciy:day-4,ciy:day-5",
    "L1 rebuild: the newer edition gaining Day 4 changes only that day's supplier — order and keys exact");
  ok(d5 && d5.listened === true, "L1 rebuild: a rebuild never touches marks (Day 5 stays listened)");

  // ---------- L2 — duplicate collapse -----------------------------
  feedBody = FEED_B; resetPod();
  r = await get(BASE, "/api/player/podcasts");
  es = r.body.entries || [];
  const d19 = es.filter((e) => e.key === "ciy:day-19"), d20 = es.find((e) => e.key === "ciy:day-20");
  ok(d19.length === 1 && r.body.collapses >= 1, "L2 duplicate collapse: the Day 19 (pubDate+duration) pair collapses to one row, counted in the build record");
  ok(d19.length === 1 && (d19[0].url === A("day19-2025-a") || d19[0].url === A("day19-2025-b")), "L2: the collapsed row carries one of the pair's recordings");
  ok(d20 && d20.url === A("day20-2025-new"), "L2: a same-(edition, day) pair with differing pubDate — the later pubDate supplies (correction repost supersedes)");

  // ---------- L3 — bonus anchoring + special ----------------------
  feedBody = FEED_C; resetPod();
  r = await get(BASE, "/api/player/podcasts");
  es = r.body.entries || [];
  ok(es.map((e) => e.key).join(",") === "ciy:bonus-pray,ciy:day-363,ciy:day-364,ciy:bonus-cavins,ciy:day-365,ciy:bonus-cozzens,ciy:day-366",
    "L3 anchors: Pray at the head · Cavins after Day 364 · Cozzens after Day 365 · Day 366 last");
  ok(!es.some((e) => e.url === A("trailer")), "L3: the 'Introducing…' trailer stands outside the sequence");
  const sp = es[es.length - 1];
  ok(sp && sp.key === "ciy:day-366" && sp.kind === "special" && sp.label === "Day 366 — Special", "L3: Day 366 carries the special kind and label");

  // ---------- L4 — progress read/write ----------------------------
  const m1 = await post(BASE, "/api/player/podcasts/mark", { series: "catechism-in-a-year", seqKey: "ciy:day-364", source: "manual" });
  ok(m1.status === 200, "L4: session mark answers 200");
  r = await get(BASE, "/api/player/podcasts");
  const e364a = (r.body.entries || []).find((e) => e.key === "ciy:day-364");
  ok(e364a && e364a.listened === true && e364a.source === "manual" && e364a.listenDate === chicagoToday(),
    "L4: the read shows listened + today's Chicago date + source manual (the row is the history record)");
  const firstAt = e364a && e364a.listenedAt;
  await sleep(1100);
  await post(BASE, "/api/player/podcasts/mark", { series: "catechism-in-a-year", seqKey: "ciy:day-364", source: "auto" });
  r = await get(BASE, "/api/agent/podcasts/progress", AGENT);
  const e364b = (r.body.entries || []).find((e) => e.key === "ciy:day-364");
  ok(e364b && e364b.source === "manual" && e364b.listenedAt === firstAt, "L4: re-mark preserves the first mark's date and source (idempotent); the agent-door read mirrors the state");
  const badWrite = await post(BASE, "/api/agent/podcasts/mark", { series: "catechism-in-a-year", seqKey: "ciy:day-364", source: "manual" }, AGENT);
  ok(badWrite.status === 404, "L4: no agent write route exists (the door refuses the mark POST)");
  const u1 = await post(BASE, "/api/player/podcasts/unmark", { series: "catechism-in-a-year", seqKey: "ciy:day-364" });
  r = await get(BASE, "/api/player/podcasts");
  const e364c = (r.body.entries || []).find((e) => e.key === "ciy:day-364");
  ok(u1.status === 200 && e364c && e364c.listened === false && e364c.listenDate === null, "L4: unmark deletes the row — the entry reads unlistened with no date");
  const badKey = await post(BASE, "/api/player/podcasts/mark", { series: "catechism-in-a-year", seqKey: "ciy:day-999", source: "manual" });
  ok(badKey.status === 400, "L4: a mark for a key outside the sequence is refused 400");

  // ---------- L5 — current derivation ------------------------------
  feedBody = FEED_A1_REAL; resetPod();
  const mark = (k) => post(BASE, "/api/player/podcasts/mark", { series: "catechism-in-a-year", seqKey: k, source: "manual" });
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.currentKey === "ciy:day-1", "L5: empty progress → current is Day 1");
  await mark("ciy:day-1"); await mark("ciy:day-2"); await mark("ciy:day-3");
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.currentKey === "ciy:day-4", "L5: contiguous marks 1-3 → current is Day 4");
  await post(BASE, "/api/player/podcasts/unmark", { series: "catechism-in-a-year", seqKey: "ciy:day-3" });
  await mark("ciy:day-4");
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.currentKey === "ciy:day-3", "L5: marks {1,2,4} → current is Day 3 (the gap is never skipped)");
  await mark("ciy:day-3"); await mark("ciy:day-5");
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.currentKey === null && r.body.listenedCount === r.body.total, "L5: all marked → complete, no current");
  await post(BASE, "/api/player/podcasts/unmark", { series: "catechism-in-a-year", seqKey: "ciy:day-1" });
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.currentKey === "ciy:day-1", "L5: unmarking Day 1 moves current back to Day 1 (derived, never stored)");

  // ---------- L6 — auto-mark seam ----------------------------------
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("about:blank");
  const seam = await page.evaluate(({ mc, wpm }) => {
    const calls = { played: [], post: [] };
    const state = { podcasts: null };
    const presentedDateStr = () => "2026-11-12";
    const writePlayed = (...a) => calls.played.push(a);
    const post = (...a) => { calls.post.push(a); return Promise.resolve({}); };
    const todayChicago = () => "2026-11-12";
    eval(mc); eval(wpm);
    markCompleted({ kind: "podcast", seriesKey: "ciy:day-3", episodeId: "ciy:day-3" });
    const afterSeries = JSON.parse(JSON.stringify(calls));
    calls.played = []; calls.post = [];
    markCompleted({ kind: "external", episodeId: "ext-x", block: "Morning" });
    const afterDay = JSON.parse(JSON.stringify(calls));
    calls.played = []; calls.post = [];
    markCompleted({ kind: "intention", episodeId: "intro:y" });
    markCompleted({ kind: "prayer", episodeId: "intro:z" });
    const afterIntro = JSON.parse(JSON.stringify(calls));
    return { afterSeries, afterDay, afterIntro };
  }, { mc: extractFn(CLIENT, "markCompleted"), wpm: extractFn(CLIENT, "writePodMarkQuiet") });
  ok(seam.afterSeries.post.length === 1 && seam.afterSeries.post[0][0] === "/api/player/podcasts/mark"
    && seam.afterSeries.post[0][1].seqKey === "ciy:day-3" && seam.afterSeries.post[0][1].source === "auto"
    && seam.afterSeries.played.length === 0,
    "L6: a series descriptor reaching the seam writes source 'auto' through the mark route — and no day-played record");
  ok(seam.afterDay.played.length === 1 && seam.afterDay.post.length === 0, "L6: a non-series descriptor writes its played record and nothing to the podcasts store");
  ok(seam.afterIntro.played.length === 0 && seam.afterIntro.post.length === 0, "L6: intention + intro descriptors never mark (the standing rule, carried)");
  const mcCalls = (CLIENT.match(/markCompleted\(/g) || []).length;
  const endedAt = CLIENT.indexOf("audioEl.addEventListener('ended'");
  ok(mcCalls === 2 && CLIENT.indexOf("markCompleted(state.current)", endedAt) > endedAt,
    "L6: markCompleted's only call site stands in the ended handler — pausing, skipping, or stopping near the end cannot mark");

  // ---------- L7 — tab rendering, pinned state ---------------------
  feedBody = FEED_C; resetPod();
  await post(BASE, "/api/player/podcasts/mark", { series: "catechism-in-a-year", seqKey: "ciy:bonus-pray", source: "manual" });
  await post(BASE, "/api/player/podcasts/mark", { series: "catechism-in-a-year", seqKey: "ciy:day-363", source: "manual" });
  const page2 = await browser.newPage();
  await page2.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("#tabbar .tab[data-tab='podcasts']", { timeout: 20000 });
  const tabOrder = await page2.$$eval("#tabbar .tab", (bs) => bs.map((b) => b.getAttribute("data-tab")));
  ok(tabOrder.join(",") === "prayers,podcasts,intentions,examination,confession",
    "L7: the fifth tab stands in order — Prayers · Podcasts · Intentions · Examination · Confession");
  await page2.click("#tabbar .tab[data-tab='podcasts']");
  await page2.waitForSelector("[data-podrow='ciy:day-366']", { timeout: 20000 });
  const viewText = await page2.$eval("#view", (el) => el.innerText);
  ok(viewText.includes("2 of 7 listened"), "L7: the series card counts the pinned set exactly (2 of 7)");
  ok(viewText.includes("Current episode") && viewText.includes("Episode 364"), "L7: the current-episode card presents Day 364 — the first unlistened entry after the pinned marks");
  const rowCheck = await page2.$$eval("[data-podrow]", (rows) => rows.map((row) => ({
    key: row.getAttribute("data-podrow"),
    marked: !!row.querySelector(".podmark.on"),
    date: row.querySelector(".podmark-date") ? row.querySelector(".podmark-date").textContent : null,
  })));
  const byKey = Object.fromEntries(rowCheck.map((x) => [x.key, x]));
  ok(byKey["ciy:bonus-pray"].marked && byKey["ciy:bonus-pray"].date === chicagoToday()
    && byKey["ciy:day-363"].marked && byKey["ciy:day-363"].date === chicagoToday(),
    "L7: checks + listen dates stand on the marked rows, with today's date");
  ok(["ciy:day-364", "ciy:bonus-cavins", "ciy:day-365", "ciy:bonus-cozzens", "ciy:day-366"].every((k) => byKey[k] && !byKey[k].marked && byKey[k].date === null),
    "L7: unmarked rows carry no check and no date");

  // ---------- L8 — no-checklist guard (pristine compare) -----------
  applyFiles(PRISTINE_APP, PPERSIST, migFiles(PRISTINE_APP));
  startApp(PRISTINE_APP, PPORT, PPERSIST);
  ok(await waitUp(PBASE), "L8: pristine (pre-v381) app up");
  const renderPrayersTab = async (base) => {
    const p = await browser.newPage();
    await p.goto(base + "/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector("#tabbar .tab[data-tab='prayers']", { timeout: 20000 });
    await p.click("#tabbar .tab[data-tab='prayers']");
    await p.waitForTimeout(2500);
    const html = await p.$eval("#view", (el) => el.innerHTML);
    await p.close();
    return html;
  };
  const candPrayers = await renderPrayersTab(BASE);
  const prisPrayers = await renderPrayersTab(PBASE);
  ok(candPrayers.length > 200, "L8: the candidate Prayers view renders (non-trivial length)");
  ok(candPrayers === prisPrayers, "L8: the Prayers tab rendered from the same fixture day is byte-identical to the pre-v381 build — no podcasts state appears in it");

  // ---------- L9 — snapshot staleness -------------------------------
  feedBody = FEED_C;
  r = await get(BASE, "/api/player/podcasts");
  const builtAt0 = r.body.builtAt, hits0 = feedHits;
  feedDown = true;
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.available === true && r.body.builtAt === builtAt0 && feedHits === hits0,
    "L9: a fresh snapshot serves with no feed fetch (the feed is down and unconsulted)");
  expireSnapshot();
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.available === true && r.body.stale === true && r.body.builtAt === "2000-01-01T00:00:00.000Z",
    "L9: feed failure + a stale snapshot serves the stale snapshot with its built_at");
  applySql(APP, PERSIST, "DELETE FROM podcast_sequences;");
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.available === false && (r.body.entries || []).length === 0,
    "L9: feed failure + no snapshot → the series-unavailable surface");
  const dayR = await get(BASE, "/api/player/day");
  ok(dayR.status === 200, "L9: nothing else errors — the day route still answers while the series is unavailable");
  feedDown = false;
  r = await get(BASE, "/api/player/podcasts");
  ok(r.body.available === true && r.body.stale === false, "L9: the feed's return rebuilds and the series stands available again");
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* noop */ } }
  try { feedServer.close(); } catch { /* noop */ }
  await sleep(500);
}
console.log(`# harness-v381: ${n - fails}/${n} legs ok`);
process.exit(fails ? 1 : 0);
