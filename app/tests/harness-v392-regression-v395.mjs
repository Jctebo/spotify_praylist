#!/usr/bin/env node
// REGRESSION COPY for v395: the SW pin literals are re-pointed
// v392-1 -> v395-1 (the release-scoped pin precedent); all other legs
// and assertions byte-identical to harness-v392.mjs.
// harness-v392 — the v392 gate (Plan §2 harness legs L1–L11):
// OFFLINE FOR THE PLANE — the dated day route, on-device day
// snapshots + the zero-/api/ offline open, the completeness
// pass (today + tomorrow), the podcast automatic set + UNCAPPED
// by-hand downloads with the protected registry, the FIFO mark
// queue, the readiness line, keyed rolling eviction, the
// Settings clear, and the service-worker pin/preservation.
// Mold: harness-v390 — local wrangler (LOCAL_DEV) with the three
// series feed seams on a fixture feed server; the own feed and
// the intentions feed are intercepted at the browser with dated
// fixtures (today + tomorrow). Fixture D1 stands through
// migration 0018 (v392 carries no migration).
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v392 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997, FEED_PORT = 8957;
const BASE = `http://127.0.0.1:${PORT}`, FEED = `http://127.0.0.1:${FEED_PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v392");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v392-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI_TS = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chicagoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const shift = (d, days) => { const p = d.split("-").map(Number); const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days, 12)); const z = (x) => String(x).padStart(2, "0"); return `${dt.getUTCFullYear()}-${z(dt.getUTCMonth() + 1)}-${z(dt.getUTCDate())}`; };
const TODAY = chicagoToday(), TOMORROW = shift(TODAY, 1), YDAY = shift(TODAY, -1), DBY = shift(TODAY, -2);

// ---- fixture feeds ---------------------------------------------
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
  title: `Day ${day}: Episode ${day}`, pub: `Thu, 0${(day % 9) + 1} Jan ${year} 15:00:00 +0000`,
  dur: "12:00", guid: `guid-${prefix}-${year}-${day}`, url: A(`${prefix}-day${day}-${year}`),
});
const FEED_CIY = feedXml("The Catechism in a Year (with Fr. Mike Schmitz)",
  [6, 5, 4, 3, 2, 1].map((d) => dayItem("ciy", d, 2025)).concat([
    itemXml({ title: "BONUS: Pray with Fr. Mike", pub: "Tue, 15 Nov 2022 15:00:00 +0000", dur: "15:00", guid: "guid-b-pray-2022", url: A("bonus-pray-2022") }),
  ]));
const FEED_BIY = feedXml("The Bible in a Year (with Fr. Mike Schmitz)", [4, 3, 2, 1].map((d) => dayItem("biy", d, 2025)));
const FEED_RIY = feedXml("The Rosary in a Year (with Fr. Mark-Mary Ames)", [4, 3, 2, 1].map((d) => dayItem("riy", d, 2025)));
const feedBodies = { "/ciy.xml": FEED_CIY, "/biy.xml": FEED_BIY, "/riy.xml": FEED_RIY };
const feedServer = http.createServer((req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  if (req.url && feedBodies[req.url] !== undefined) { res.writeHead(200, { "content-type": "application/rss+xml" }); res.end(feedBodies[req.url]); return; }
  if (req.url && req.url.startsWith("/audio/")) { res.writeHead(200, { "content-type": "audio/mpeg" }); res.end(Buffer.alloc(64)); return; }
  res.writeHead(404); res.end("nope");
});
// The own (Ora) feed fixture: dated items for today + tomorrow —
// the two families the fixture settings rows enable by default
// in Morning (morning-prayer · daily-rosary stems).
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function ownItem(name, stem, date) {
  const p = date.split("-").map(Number);
  const label = `${MONTHS[p[1] - 1]} ${p[2]}, ${p[0]}`;
  return itemXml({ title: `${name} - ${label}`, pub: new Date(`${date}T12:00:00Z`).toUTCString(), dur: "10:00", guid: `guid-own-${stem}-${date}`, url: A(`${stem}-${date}`) });
}
const OWN_FEED = feedXml("Ora Pro Nobis", [
  ownItem("Morning Prayer", "morning-prayer-elevenlabs", TOMORROW),
  ownItem("Daily Rosary", "daily-rosary", TOMORROW),
  ownItem("Morning Prayer", "morning-prayer-elevenlabs", TODAY),
  ownItem("Daily Rosary", "daily-rosary", TODAY),
]);
const EMPTY_FEED = feedXml("Intentions", []);

// ---- wrangler helpers (the estate mold) -------------------------
function wranglerD1(args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function d1q(sql) {
  const out = wranglerD1(["--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results || [];
}
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
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`,
    "--var", `EXT_CIY_FEED_URL:${FEED}/ciy.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biy.xml`, "--var", `EXT_RIY_FEED_URL:${FEED}/riy.xml`];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const get = async (p, headers = {}) => {
  // Connect-level retry (the v390 close-out mold): the local
  // Wrangler read chain intermittently surfaces connect resets
  // from this sandbox's egress; re-issue the same read on a
  // thrown fetch — assertions on the answered value unchanged.
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(BASE + p, { headers });
      const out = { status: r.status, body: await r.json().catch(() => ({})) };
      // A cold local workerd can 500 the first reads while its
      // own egress fetches reset; the read is idempotent, so
      // re-issue on a 5xx as on a throw — the assertion judges
      // the finally answered value either way.
      if (out.status >= 500 && i < 4) { await new Promise((r2) => setTimeout(r2, 800)); continue; }
      return out;
    }
    catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 800)); }
  }
  throw lastErr;
};
const AGENT = { authorization: `Bearer ${TOKEN}` };

let browser = null;
try {
  await new Promise((r) => feedServer.listen(FEED_PORT, r));
  applyMigrations();
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV), D1 through 0018");

  // ---------- L1: the dated day route (W1) -----------------------
  const plain = await get("/api/player/day");
  ok(plain.status === 200 && plain.body.presentedDay === TODAY && plain.body.date === TODAY,
    "L1: no ?date answers today's payload in the standing shape");
  const tmr = await get(`/api/player/day?date=${TOMORROW}`);
  ok(tmr.status === 200 && tmr.body.presentedDay === TOMORROW && tmr.body.date === TOMORROW,
    "L1: ?date=tomorrow presents tomorrow throughout the payload");
  const yday = await get(`/api/player/day?date=${YDAY}`);
  ok(yday.status === 400, "L1: ?date=yesterday answers 400");
  const far = await get(`/api/player/day?date=${shift(TODAY, 7)}`);
  ok(far.status === 400, "L1: ?date=+7d answers 400");
  const junk = await get("/api/player/day?date=banana");
  ok(junk.status === 400, "L1: a non-date ?date answers 400");
  const door = await get("/api/agent/player/day", AGENT);
  ok(door.status === 200 && door.body.presentedDay === TODAY, "L1: the agent-door day route is unchanged (today, no override)");

  // ---------- browser legs ---------------------------------------
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  let offlineMode = false, apiAttempts = 0;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (offlineMode) { if (url.includes("/api/")) apiAttempts++; await route.abort(); return; }
    if (url === "https://orapronobis.media/podcast.xml") { await route.fulfill({ status: 200, contentType: "application/rss+xml", body: OWN_FEED }); return; }
    if (url === "https://orapronobis.media/intentions.xml") { await route.fulfill({ status: 200, contentType: "application/rss+xml", body: EMPTY_FEED }); return; }
    // Fixture day (§2): the day's externals resolve LIVE
    // (server-side courier + the app's defaults), but their
    // audio BYTES are fixture bytes — the same fixture posture
    // as the own feed above. This sandbox's browser egress
    // cannot carry the real enclosure hosts; the leg asserts
    // the pass's accounting over the enumerated set, not the
    // provenance of the bytes. RSS documents are never
    // fixtured (only .mp3 enclosure URLs match).
    if (/\.mp3($|\?)/.test(url)) { await route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(64) }); return; }
    await route.continue();
  });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const until = async (fn, timeoutMs, label, arg) => {
    const start = Date.now();
    for (;;) {
      const v = await ev(fn, arg).catch(() => null);
      if (v) return v;
      if (Date.now() - start > timeoutMs) throw new Error("timeout waiting: " + label);
      await sleep(1500);
    }
  };
  const cacheKeys = (store) => ev(async (s) => {
    if (!("caches" in window)) return [];
    try { const c = await caches.open(s); const reqs = await c.keys(); return reqs.map((r) => decodeURIComponent(r.url)); } catch (e) { return []; }
  }, store);
  const audioKeys = async () => (await cacheKeys("opn-ext-audio-v1")).map((u) => u.slice(u.indexOf("://") + 3).split("/").slice(1).join("/"));
  const idx = () => ev(() => { try { return JSON.parse(localStorage.getItem("opn-offline-index-v1") || "null"); } catch (e) { return null; } });

  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.click('[data-tab="prayers"]');
  await page.waitForSelector(".blockcard", { timeout: 30000 });
  ok(true, "online open renders the Listen home (block cards stand)");

  // L2 (write half): the snapshot stands after the online build.
  await until(async (d) => {
    const ks = await (async () => { const c = await caches.open("opn-offline-meta-v1"); return (await c.keys()).map((r) => r.url); })();
    return ks.some((u) => u.includes("day/" + d)) ? true : null;
  }, 60000, "today snapshot", TODAY);
  ok(true, "L2: an online build stands the day snapshot (payload + settings + externals record) in opn-offline-meta-v1");
  const idxA = await idx();
  ok(!!(idxA && idxA.days && idxA.days[TODAY]), "L2: the snapshot index carries today with its settings version");

  // L4: the completeness pass — today + tomorrow reach full.
  const full = await until(async (d) => {
    const i = JSON.parse(localStorage.getItem("opn-offline-index-v1") || "null");
    if (!i || !i.days) return null;
    const t = i.days[d[0]], m = i.days[d[1]];
    return (t && t.total > 0 && t.have === t.total && m && m.total > 0 && m.have === m.total) ? i : null;
  }, 150000, "completeness today+tomorrow", [TODAY, TOMORROW]).catch(() => null);
  ok(!!full, `L4: the completeness pass reaches have == total for today (${full?.days?.[TODAY]?.have}/${full?.days?.[TODAY]?.total}) and tomorrow (${full?.days?.[TOMORROW]?.have}/${full?.days?.[TOMORROW]?.total})`);
  let keys = await audioKeys();
  // The named external is USCCB Readings: the Bible external
  // slot cannot stand — v390's migration 0018 retired its
  // source-settings row when Bible in a Year moved to the
  // Podcasts section, so no build of the current app stands
  // ext-bible-in-a-year. USCCB is a standing courier external
  // and proves the same leg (a courier-resolved external's
  // audio lands under today's day key in the pass).
  ok(keys.some((k) => k === `day/${TODAY}/ext-usccb-readings`), "L4: the standing USCCB external's audio stands under today's day key");
  ok(keys.some((k) => k === `day/${TODAY}/morning-prayer`), "L4: today's own Morning Prayer audio stands under today's day key");
  ok(keys.some((k) => k.startsWith(`day/${TOMORROW}/`)), "L4: tomorrow's set stands under tomorrow's day keys before its day arrives");
  const metaKeys = (await cacheKeys("opn-offline-meta-v1")).join(" ");
  ok(metaKeys.includes("day/" + TOMORROW), "L2: tomorrow's snapshot stands in the meta store (fetched through the dated route)");

  // L6: the podcast automatic set stands; playback resolves cache-first.
  // The pass writes the day entries before its podcast leg;
  // wait for the leg's own accounting before reading the keys.
  await until(async () => {
    const i = JSON.parse(localStorage.getItem("opn-offline-index-v1") || "null");
    return (i && i.pods && i.pods.autoTotal > 0 && i.pods.autoHave === i.pods.autoTotal) ? i : null;
  }, 120000, "podcast automatic set accounting").catch(() => null);
  keys = await audioKeys();
  const podKeys = keys.filter((k) => k.startsWith("pod/"));
  ok(["ciy:day-1", "ciy:day-2", "ciy:day-3"].every((e) => podKeys.some((k) => k === `pod/catechism-in-a-year/${e}`)),
    "L6: the automatic set stands for Catechism — current (Day 1) + the next 2 under pod keys");
  ok(podKeys.length >= 9, `L6: the automatic set stands across all three series (${podKeys.length} episode files)`);
  await page.click('[data-tab="podcasts"]');
  await page.waitForSelector("[data-podseries]", { timeout: 20000 });
  await page.click('[data-podseries="catechism-in-a-year"]');
  await page.waitForSelector("[data-podplay]", { timeout: 20000 });
  await page.click('[data-podplay="ciy:day-1"]');
  const src = await until(async () => { const a = document.getElementById("audio"); return a && a.src ? a.src : null; }, 15000, "podcast audio src");
  ok(typeof src === "string" && src.startsWith("blob:"), "L6: a downloaded podcast episode plays from its cached blob, not the stream");

  // L7: by-hand downloads — uncapped, registry-protected.
  const payload = await ev(async () => { const r = await fetch("/api/player/podcasts?series=catechism-in-a-year"); return r.json(); });
  const autoSet = ["ciy:day-1", "ciy:day-2", "ciy:day-3"];
  const handPicks = payload.entries.map((e) => e.key).filter((k) => !autoSet.includes(k)).slice(0, 4);
  ok(handPicks.length === 4, `L7: four episodes beyond the automatic set stand ready to pick (${handPicks.join(", ")})`);
  for (const k of handPicks) { await page.click(`[data-poddl="${k}"]`); await sleep(400); }
  await until(async () => {
    const m = JSON.parse(localStorage.getItem("opn-pod-manual-v1") || "{}");
    return Object.keys(m).length === 4 ? true : null;
  }, 60000, "four registry entries");
  ok(true, "L7: four by-hand downloads land with four registry entries — no cap leg engages");
  const line1 = await ev(() => offlineLineText());
  ok(line1.includes("+ 4 by hand"), "L9: the readiness line counts the by-hand episodes ('+ 4 by hand')");
  await ev((auto) => offlineEvict(auto), podKeys.concat(autoSet.map((e) => `pod/catechism-in-a-year/${e}`)));
  keys = await audioKeys();
  ok(handPicks.every((k) => keys.some((x) => x === `pod/catechism-in-a-year/${k}`)),
    "L7: rolling eviction spares every registered by-hand key");
  await page.click(`[data-poddl="${handPicks[0]}"]`);
  await until(async () => {
    const m = JSON.parse(localStorage.getItem("opn-pod-manual-v1") || "{}");
    return Object.keys(m).length === 3 ? true : null;
  }, 20000, "registry back to three");
  keys = await audioKeys();
  ok(!keys.some((x) => x === `pod/catechism-in-a-year/${handPicks[0]}`), "L7: removing a hand episode deletes its bytes and its registry entry in one act");
  const line2 = await ev(() => offlineLineText());
  ok(/today\u2019s prayers \d+\/\d+/.test(line2) && line2.includes("podcasts") && line2.includes("+ 3 by hand"),
    "L9: the readiness line reads have/total per set plus the by-hand count, from standing state only");

  // L2/L3: the offline open — snapshot build, zero /api/ calls.
  offlineMode = true;
  await page.reload({ waitUntil: "load" });
  await sleep(1500);
  apiAttempts = 0; // the count that matters is the offline BUILD's: resets after boot settles
  await page.click('[data-tab="prayers"]');
  await page.waitForSelector(".blockcard", { timeout: 30000 });
  await sleep(3000);
  const errText = await ev(() => document.querySelector(".err") ? document.querySelector(".err").textContent : "");
  ok(!errText, "L2: a cold offline open renders the day from the snapshot — no error stands");
  const extStanding = await ev(() => {
    const slots = window.state && window.state.extSlots ? Object.keys(window.state.extSlots) : [];
    const present = slots.filter((k) => window.state.extSlots[k].state === "present");
    return { slots: slots.length, present };
  });
  ok(extStanding.present.length >= 1, `L3: the offline build stands externals from the snapshot record (${extStanding.present.join(", ")})`);
  ok(apiAttempts === 1, `L2: the offline build makes zero /api/ calls beyond the one failed day read that triggered it (attempts: ${apiAttempts})`);
  offlineMode = false;

  // L8: the mark queue — offline mark enqueues; the drain posts
  // FIFO once online; replay leaves exactly one listen row.
  offlineMode = true;
  await ev(() => writePodMarkQuiet("ciy:day-5", "catechism-in-a-year", "auto"));
  await sleep(1500);
  const qLen = await ev(() => JSON.parse(localStorage.getItem("opn-podmark-queue-v1") || "[]").length);
  ok(qLen === 1, "L8: a mark that cannot post offline enqueues instead of vanishing");
  offlineMode = false;
  await page.reload({ waitUntil: "load" });
  await page.click('[data-tab="prayers"]');
  await page.waitForSelector(".blockcard", { timeout: 30000 });
  await until(async () => {
    const q = JSON.parse(localStorage.getItem("opn-podmark-queue-v1") || "[]");
    return q.length === 0 ? true : null;
  }, 30000, "queue drained at open");
  const rows1 = d1q("SELECT COUNT(*) AS c FROM podcast_listens WHERE series='catechism-in-a-year' AND seq_key='ciy:day-5'");
  ok(rows1[0].c === 1, "L8: the drained mark lands as exactly one listen row");
  await ev(() => drainPodMarkQueue());
  await sleep(1500);
  const rows2 = d1q("SELECT COUNT(*) AS c FROM podcast_listens WHERE series='catechism-in-a-year' AND seq_key='ciy:day-5'");
  ok(rows2[0].c === 1, "L8: a second drain is a no-op — replay is safe against the idempotent routes");

  // L5: the rolling window — seeded dates, keyed eviction.
  await ev(async (dates) => {
    const audio = await caches.open("opn-ext-audio-v1");
    const meta = await caches.open("opn-offline-meta-v1");
    for (const d of dates) {
      await audio.put("day/" + d + "/seed-track", new Response(new Blob(["x"], { type: "audio/mpeg" })));
      await meta.put("day/" + d, new Response(JSON.stringify({ date: d }), { headers: { "Content-Type": "application/json" } }));
    }
  }, [DBY, YDAY, TODAY, TOMORROW]);
  await ev(() => offlineEvict(null));
  keys = await audioKeys();
  const metaAfter = (await cacheKeys("opn-offline-meta-v1")).join(" ");
  ok(!keys.some((k) => k.startsWith(`day/${DBY}/`)) && !metaAfter.includes("day/" + DBY),
    "L5: the day before yesterday is evicted from both stores at the open sweep");
  ok(keys.some((k) => k.startsWith(`day/${YDAY}/`)) && keys.some((k) => k.startsWith(`day/${TODAY}/`)) && keys.some((k) => k.startsWith(`day/${TOMORROW}/`)),
    "L5: yesterday + today + tomorrow stand — the rolling two-day window plus its eve");

  // L10: the Settings clear empties the stores; the next online
  // open refills the automatic set.
  await ev(() => offlineClearAll());
  await sleep(1000);
  const afterClear = await audioKeys();
  ok(!afterClear.some((k) => k.startsWith("day/") || k.startsWith("pod/")), "L10: Clear offline downloads empties the audio store's offline keys");
  const metaGone = await ev(async () => { try { const ks = await caches.keys(); return !ks.includes("opn-offline-meta-v1") || (await (await caches.open("opn-offline-meta-v1")).keys()).length === 0; } catch (e) { return false; } });
  ok(metaGone, "L10: Clear offline downloads empties the snapshot store");
  await page.reload({ waitUntil: "load" });
  await page.click('[data-tab="prayers"]');
  await page.waitForSelector(".blockcard", { timeout: 30000 });
  await until(async () => {
    const c = await caches.open("opn-ext-audio-v1");
    const ks = (await c.keys()).map((r) => r.url);
    return ks.some((u) => u.includes("pod/catechism-in-a-year/ciy:day-1")) ? true : null;
  }, 420000, "automatic set refill after clear");
  ok(true, "L10: the next online open refills the automatic set after a clear");

  // L11: the service worker — pin + store preservation.
  const sw = await (await fetch(BASE + "/sw.js")).text();
  ok(sw.includes("ora-pro-nobis-v395-1"), "L11: the served service worker carries the v392 pin");
  ok(sw.includes("opn-ext-audio-v1") && sw.includes("opn-offline-meta-v1") && /filter\(function \(k\) \{ return k !== CACHE && k !== "opn-ext-audio-v1" && k !== "opn-offline-meta-v1"; \}\)/.test(sw),
    "L11: the activate purge preserves BOTH offline stores");
  ok(UI_TS.includes('var CACHE = "ora-pro-nobis-v395-1"'), "L11: ui.ts pin stands at ora-pro-nobis-v395-1");
  ok(CLIENT.includes("opn-offline-meta-v1") && CLIENT.includes("opn-podmark-queue-v1") && CLIENT.includes("opn-pod-manual-v1"),
    "L11: the client carries the snapshot store, the mark queue, and the by-hand registry");
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  procs.forEach((p) => { try { p.kill("SIGKILL"); } catch { /* noop */ } });
  try { feedServer.close(); } catch { /* noop */ }
}
console.log(`# harness-v392: ${n} ok / ${fails} not-ok`);
process.exit(fails ? 1 : 0);
