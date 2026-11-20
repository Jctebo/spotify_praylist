#!/usr/bin/env node
// harness-v436 — the v436 gate (Plan §2.6): PODCASTS VIDEO —
// IN-APP FULL-PAGE VIEW. The mold proves the CLIENT's branches
// only; it cannot prove a Custom Tab (Plan §2.6, field-only).
// Legs W1–W7: W1 statics + both paints at runtime · W2 the
// in-shell branch (a stubbed Capacitor.Plugins.Browser records
// its calls) · W3 pause-before-open, asserted on a shared
// order recording · W4 the web branch (no Capacitor global —
// the tap is not intercepted) · W5 the old-shell branch
// (oraInShell() true, Plugins.Browser absent — the tap is not
// intercepted, nothing throws) · W6 a rejected open falls back
// to window.open exactly once · W7 the regression watch in
// harness form (the video page's rows and the watch view stand
// as v434 shipped them; the full v434 suite re-runs on this
// tree separately). Server setup rides the v434 mold: the
// Atom fixture through the EXT_YT_CATHOLICTV_FEED_URL seam,
// small RSS fixtures for the audio series. The client context
// blocks service workers (harness-v434's named reason).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v436 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8998;
const FEEDPORT = 8999;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v436");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v436-"));
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const CHANNEL = "https://www.youtube.com/@catholictv";

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixtures (the v434 mold's shapes) ------------------------
const YT_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<link rel="self" href="https://www.youtube.com/feeds/videos.xml?channel_id=UCORAZZmab8apqy2TMHZlZVQ"/>
<id>yt:channel:UCORAZZmab8apqy2TMHZlZVQ</id>
<yt:channelId>UCORAZZmab8apqy2TMHZlZVQ</yt:channelId>
<title>CatholicTV</title>
<link rel="alternate" href="https://www.youtube.com/@catholictv"/>`;
function ytEntry(id, title, published, desc) {
  return `<entry>
<id>yt:video:${id}</id>
<yt:videoId>${id}</yt:videoId>
<yt:channelId>UCORAZZmab8apqy2TMHZlZVQ</yt:channelId>
<title>${title}</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/>
<author><name>CatholicTV</name><uri>https://www.youtube.com/@catholictv</uri></author>
<published>${published}</published>
<updated>${published}</updated>
<media:group>
<media:title>${title}</media:title>
<media:thumbnail url="https://i.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/>
<media:description>${desc}</media:description>
</media:group>
</entry>`;
}
const ytXml = (entries) => YT_HEAD + "\n" + entries.join("\n") + "\n</feed>";
const YT_OK = ytXml([
  ytEntry("vidAlpha111", "Catholic Mass Today | November 15, 2026 | CatholicTV Daily Mass", "2026-11-15T14:00:00+00:00", "Join us for daily Mass &amp; prayer."),
  ytEntry("vidBravo22", "La Santa Misa | Domingo 33 del Tiempo Ordinario", "2026-11-15T04:30:00+00:00", "La Santa Misa en espa\u00f1ol."),
  ytEntry("vidCharl333", "Live Adoration of the Blessed Sacrament From the CatholicTV Chapel", "2026-11-13T18:00:00+00:00", "Adoration from the chapel."),
]);
function rssItem(day, title, file, pub, img) {
  return `<item><title>Day ${day}: ${title}</title><pubDate>${pub}</pubDate>`
    + `<enclosure url="https://audio.example/${file}" length="1000" type="audio/mpeg"/>`
    + (img ? `<itunes:image href="${img}"/>` : "")
    + `<description>${title} description</description></item>`;
}
function rssFeed(showImg, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Fixture</title>`
    + (showImg ? `<itunes:image href="${showImg}"/>` : "") + items.join("\n") + `</channel></rss>`;
}
const CIY_XML = rssFeed("https://img.example/ciy-show.jpg", [
  rssItem(1, "The Creation", "ciy-day1.mp3", "Mon, 05 Jan 2026 12:00:00 GMT", "https://img.example/ciy-day1.jpg"),
  rssItem(2, "The Fall", "ciy-day2.mp3", "Tue, 06 Jan 2026 12:00:00 GMT", "https://img.example/ciy-day2.jpg"),
  rssItem(3, "The Flood", "ciy-day3.mp3", "Wed, 07 Jan 2026 12:00:00 GMT", "https://img.example/ciy-day3.jpg"),
]);
const BIY_XML = rssFeed("https://img.example/biy-show.jpg", [
  rssItem(1, "In the Beginning", "biy-day1.mp3", "Mon, 05 Jan 2026 12:00:00 GMT", null),
]);
const RIY_XML = rssFeed("https://img.example/riy-show.jpg", [
  rssItem(1, "The Joyful Mysteries", "riy-day1.mp3", "Mon, 05 Jan 2026 12:00:00 GMT", null),
]);

let ytMode = "ok";
const feedServer = http.createServer((rq, rs) => {
  const u = rq.url || "";
  if (u.startsWith("/yt.xml")) {
    if (ytMode === "fail404") { rs.writeHead(404); rs.end("no"); return; }
    rs.writeHead(200, { "content-type": "application/atom+xml" }); rs.end(YT_OK); return;
  }
  if (u.startsWith("/ciy.xml")) { rs.writeHead(200, { "content-type": "application/rss+xml" }); rs.end(CIY_XML); return; }
  if (u.startsWith("/biy.xml")) { rs.writeHead(200, { "content-type": "application/rss+xml" }); rs.end(BIY_XML); return; }
  if (u.startsWith("/riy.xml")) { rs.writeHead(200, { "content-type": "application/rss+xml" }); rs.end(RIY_XML); return; }
  rs.writeHead(404); rs.end("no");
});

// ---- wrangler helpers (the estate mold) -----------------------
function wranglerD1(args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
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
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`,
    "--var", `EXT_YT_CATHOLICTV_FEED_URL:http://127.0.0.1:${FEEDPORT}/yt.xml`,
    "--var", `EXT_CIY_FEED_URL:http://127.0.0.1:${FEEDPORT}/ciy.xml`,
    "--var", `EXT_BIAY_FEED_URL:http://127.0.0.1:${FEEDPORT}/biy.xml`,
    "--var", `EXT_RIY_FEED_URL:http://127.0.0.1:${FEEDPORT}/riy.xml`];
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
      if (out.status >= 500 && i < 4) { await sleep(800); continue; }
      return out;
    } catch (e) { lastErr = e; await sleep(800); }
  }
  throw lastErr;
};

// ---- W1 statics -------------------------------------------------
function statics() {
  ok(CLIENT.includes('var YT_CHANNEL_URL = "https://www.youtube.com/@catholictv";'),
    "W1 (static): the channel URL stands as ONE client constant of the video kind");
  ok(CLIENT.includes(`'<p><a class="btn ghost" data-podfullpage href="' + YT_CHANNEL_URL + '" target="_blank" rel="noopener">Full page on YouTube</a></p>'`),
    "W1 (static): the act is a ghost-button anchor — href the channel constant, target _blank, rel noopener, label 'Full page on YouTube'");
  ok((CLIENT.match(/html \+= podFullPageActHtml\(\);/g) || []).length === 2,
    "W1 (static): the act is emitted in BOTH paints of paintPodcastVideos (available + unavailable)");
  ok(CLIENT.includes("if (!cap || !cap.Plugins || !cap.Plugins.Browser) return;"),
    "W1 (static): the guard reads Capacitor.Plugins.Browser in exactly the OraDayBridge guard's shape");
  ok(CLIENT.includes("cap.Plugins.Browser.open({ url: YT_CHANNEL_URL, toolbarColor: '#16283f' })"),
    "W1 (static): the open call carries the channel constant and the app's navy toolbarColor #16283f");
  ok(CLIENT.includes(`html += '<p><a class="btn ghost" href="' + esc(v.url) + '" target="_blank" rel="noopener">Open in YouTube</a></p>';`),
    "W1 (static): v434's watch-view 'Open in YouTube' line stands byte-identical to the base (F-436-2)");
}

// ---- a tiny playable WAV (2 s of silence, 8 kHz 16-bit mono) --
function wavBuffer(seconds) {
  const rate = 8000, len = rate * seconds;
  const buf = Buffer.alloc(44 + len * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + len * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(len * 2, 40);
  return buf;
}

// The bridge stub: every OraDayBridge method the client calls,
// each guarded in the client and each a resolved promise here.
const BRIDGE_STUB = `window.Capacitor = { Plugins: {
  OraDayBridge: {
    setDaySnapshot: function () { return Promise.resolve(); },
    setPlaybackState: function () { return Promise.resolve(); },
    addListener: function () { return Promise.resolve({ remove: function () {} }); },
    armSleepDeadline: function () { return Promise.resolve(); },
    clearSleepDeadline: function () { return Promise.resolve(); },
    getWallpaperSettings: function () { return {}; },
    setWallpaperSettings: function () { return {}; }
  },
  App: { addListener: function () { return Promise.resolve({ remove: function () {} }); } }
} };`;

let browser = null;
try {
  statics();
  await new Promise((r) => feedServer.listen(FEEDPORT, "127.0.0.1", r));
  try { execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" }); } catch { /* nothing stood on the port */ }
  for (let i = 0; i < 20; i++) {
    try { await fetch(BASE + "/", { signal: AbortSignal.timeout(1000) }); await sleep(500); }
    catch { break; }
    if (i === 19) throw new Error("port 8998 never freed — a stale server stands");
  }
  applyMigrations();
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV)");

  // Build the video snapshot for the available paint.
  const p1 = await req("GET", "/api/player/podcasts?series=catholictv");
  ok(p1.status === 200 && p1.body.kind === "video" && p1.body.available === true,
    "setup: the video series payload stands available for the client legs");

  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 560 }, serviceWorkers: "block" });
  // A popup to the channel page (the W4/W5 branches' native
  // default) loads a stub, never the network.
  await ctx.route(CHANNEL, async (route) => { await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>channel stub</body></html>" }); });
  const page = await ctx.newPage();
  // Popups (the W4/W5 branches' native defaults) close at
  // once; the main page is not a popup.
  ctx.on("page", (pg) => { if (pg !== page) pg.close().catch(() => {}); });
  const YT_API_STUB = `window.YT = { Player: function (el, cfg) { window.__ytEvents = cfg && cfg.events; window.__ytEl = el; } };\nif (typeof window.onYouTubeIframeAPIReady === "function") window.onYouTubeIframeAPIReady();`;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === "https://www.youtube.com/iframe_api") { await route.fulfill({ status: 200, contentType: "application/javascript", body: YT_API_STUB }); return; }
    if (url.startsWith("https://www.youtube.com/embed/")) { await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>embed stub</body></html>" }); return; }
    if (url === "https://orapronobis.media/podcast.xml" || url === "https://orapronobis.media/intentions.xml") {
      await route.fulfill({ status: 200, contentType: "application/rss+xml", body: `<?xml version="1.0"?><rss version="2.0"><channel><title>f</title></channel></rss>` }); return;
    }
    if (/\.mp3($|\?)/.test(url)) { await route.fulfill({ status: 200, contentType: "audio/wav", body: wavBuffer(2) }); return; }
    if (url.startsWith("https://i.ytimg.com/") || url.startsWith("https://img.example/") || /\.(?:png|jpe?g|gif|webp)($|\?)/i.test(url)) {
      await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") }); return;
    }
    await route.continue();
  });
  // Navigation taps dispatch the app's own handlers directly
  // (the v427/v434 mold form); act taps dispatch a cancelable
  // click event so the interception (defaultPrevented) reads
  // exactly.
  const tap = async (sel) => {
    // Navigation taps retry the wait+dispatch pair: on this
    // loaded box a repaint can land between the selector wait
    // and the dispatch, or a paint can settle late (the mold
    // race v434's harness names). The retries move no
    // assertion — every leg still reads the app's real DOM.
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await page.waitForSelector(sel, { timeout: 30000 });
        await page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error("tap: no element " + s); el.click(); }, sel);
        return;
      } catch (e) { lastErr = e; await sleep(700); }
    }
    throw lastErr;
  };
  const actTap = async () => page.evaluate(() => {
    const el = document.querySelector("[data-podfullpage]");
    if (!el) throw new Error("actTap: no act stands");
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return { defaultPrevented: ev.defaultPrevented };
  });

  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.click('[data-tab="podcasts"]');
  await page.waitForSelector("[data-podseries]", { timeout: 30000 });
  await tap('[data-podseries="catholictv"]');
  await page.waitForSelector("[data-podvideo]", { timeout: 30000 });

  // ---------- W1 (runtime): the available paint -----------------
  const actInfo = await page.evaluate(() => {
    const a = document.querySelector("[data-podfullpage]");
    const head = document.querySelector(".podpage-head");
    const firstCard = document.querySelector("[data-podvideo]");
    const F = Node.DOCUMENT_POSITION_FOLLOWING;
    return {
      stands: !!a,
      href: a ? a.getAttribute("href") : null,
      target: a ? a.getAttribute("target") : null,
      rel: a ? a.getAttribute("rel") : null,
      cls: a ? a.getAttribute("class") : null,
      text: a ? a.textContent : null,
      afterHead: !!(a && head && (head.compareDocumentPosition(a) & F)),
      beforeFirstCard: !!(a && firstCard && (a.compareDocumentPosition(firstCard) & F)),
    };
  });
  ok(actInfo.stands && actInfo.href === CHANNEL && actInfo.target === "_blank" && actInfo.rel === "noopener"
    && actInfo.cls === "btn ghost" && actInfo.text === "Full page on YouTube",
    `W1: the act stands in the available paint in its ruled form (${JSON.stringify(actInfo)})`);
  ok(actInfo.afterHead && actInfo.beforeFirstCard,
    "W1: the act's seat is directly under the .podpage-head block, before the first video card");

  // ---------- W4: the web branch ---------------------------------
  const noCap = await page.evaluate(() => typeof window.Capacitor === "undefined");
  const w4 = await actTap();
  ok(noCap && w4.defaultPrevented === false,
    "W4: no Capacitor global (the web) — the tap is NOT intercepted; the anchor's native new-tab default stands");

  // ---------- W5: the old-shell branch ---------------------------
  await page.evaluate(BRIDGE_STUB);
  const inShell = await page.evaluate(() => oraInShell());
  const w5 = await actTap();
  ok(inShell === true && w5.defaultPrevented === false,
    "W5: oraInShell() true with Plugins.Browser absent (the 1.0.35 shell) — the tap is NOT intercepted, nothing throws, the anchor's default stands");

  // ---------- W2: the in-shell branch ----------------------------
  await page.evaluate(() => {
    window.__browserCalls = [];
    window.Capacitor.Plugins.Browser = { open: function (opts) { window.__browserCalls.push(opts); return Promise.resolve(); } };
  });
  const w2 = await actTap();
  const w2calls = await page.evaluate(() => window.__browserCalls);
  ok(w2.defaultPrevented === true && w2calls.length === 1 && w2calls[0].url === CHANNEL && w2calls[0].toolbarColor === "#16283f",
    `W2: in-shell, the tap preventDefaults and Browser.open fires exactly once with the channel URL and the navy toolbar (${JSON.stringify(w2calls)})`);

  // ---------- W6: a rejected open --------------------------------
  await page.evaluate(() => {
    window.__browserCalls = [];
    window.__windowOpenCalls = [];
    window.open = function (u, t) { window.__windowOpenCalls.push([u, t]); return null; };
    window.Capacitor.Plugins.Browser = { open: function (opts) { window.__browserCalls.push(opts); return Promise.reject(new Error("no Custom Tab provider")); } };
  });
  const w6 = await actTap();
  await sleep(400);
  const w6opens = await page.evaluate(() => window.__windowOpenCalls);
  ok(w6.defaultPrevented === true && w6opens.length === 1 && w6opens[0][0] === CHANNEL && w6opens[0][1] === "_blank",
    `W6: a rejected open falls back to window.open(channel, '_blank') exactly once (${JSON.stringify(w6opens)})`);

  // ---------- W3: pause-before-open -------------------------------
  await page.evaluate(() => {
    window.__order = [];
    window.Capacitor.Plugins.Browser = { open: function () { window.__order.push("open"); return Promise.resolve(); } };
  });
  await tap("[data-podback]");
  await page.waitForSelector("[data-podseries]", { timeout: 30000 });
  await tap('[data-podseries="catechism-in-a-year"]');
  await page.waitForSelector("[data-podplay]", { timeout: 30000 });
  await tap("[data-podplay]");
  await page.waitForFunction(() => { const a = document.getElementById("audio"); return a && !a.paused; }, null, { timeout: 20000 });
  ok(true, "W3: an audio episode stands playing (the pause-order premise)");
  await tap("[data-podback]");
  await page.waitForSelector('[data-podseries="catholictv"]', { timeout: 30000 });
  await tap('[data-podseries="catholictv"]');
  await page.waitForSelector("[data-podvideo]", { timeout: 30000 });
  const stillPlaying = await page.evaluate(() => { const a = document.getElementById("audio"); return a && !a.paused; });
  ok(stillPlaying === true, "W3: the audio still sounds on the video series page (navigation alone does not pause)");
  await page.evaluate(() => {
    const a = document.getElementById("audio");
    const origPause = a.pause.bind(a);
    a.pause = function () { window.__order.push("pause"); return origPause(); };
  });
  const w3 = await actTap();
  const order1 = await page.evaluate(() => ({ order: window.__order, paused: document.getElementById("audio").paused }));
  ok(w3.defaultPrevented === true && JSON.stringify(order1.order) === JSON.stringify(["pause", "open"]) && order1.paused === true,
    `W3: with audio sounding, the pause act runs BEFORE Browser.open — order ${JSON.stringify(order1.order)}, the element reads paused`);
  await page.evaluate(() => { window.__order = []; });
  await actTap();
  const order2 = await page.evaluate(() => window.__order);
  ok(JSON.stringify(order2) === JSON.stringify(["open"]),
    `W3: with audio already paused, no pause call stands and open still fires — order ${JSON.stringify(order2)}`);

  // ---------- W7: the standing surfaces stand ---------------------
  await tap('[data-podvideo="vidAlpha111"]');
  await page.waitForSelector("iframe.podwatch-frame", { timeout: 15000 });
  const watch = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a.btn")].filter((x) => x.textContent.includes("Open in YouTube"))[0];
    return { src: document.querySelector("iframe.podwatch-frame").getAttribute("src"), act: a ? a.getAttribute("href") : null };
  });
  ok(watch.src === "https://www.youtube.com/embed/vidAlpha111?enablejsapi=1&autoplay=1&rel=0" && watch.act === "https://www.youtube.com/watch?v=vidAlpha111",
    "W7: the watch view stands as v434 shipped it — the embed at its paint, the standing 'Open in YouTube' act external with the watch URL");
  await tap("[data-podwatchback]");
  await page.waitForSelector("[data-podvideo]", { timeout: 15000 });
  ok(true, "W7: the watch's back act returns to the series page, rows standing");

  // ---------- W1 (runtime): the unavailable paint ------------------
  ytMode = "fail404";
  d1run("DELETE FROM video_snapshots");
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.click('[data-tab="podcasts"]');
  await page.waitForSelector("[data-podseries]", { timeout: 30000 });
  await tap('[data-podseries="catholictv"]');
  await page.waitForFunction(() => {
    const v = document.getElementById("view") || document.body;
    return v.textContent.includes("This series is unavailable right now.");
  }, null, { timeout: 30000 });
  const unavail = await page.evaluate(() => {
    const a = document.querySelector("[data-podfullpage]");
    const card = [...document.querySelectorAll(".card")].filter((c) => c.textContent.includes("unavailable"))[0];
    const F = Node.DOCUMENT_POSITION_FOLLOWING;
    return { stands: !!a, href: a ? a.getAttribute("href") : null, text: a ? a.textContent : null, afterCard: !!(a && card && (card.compareDocumentPosition(a) & F)) };
  });
  ok(unavail.stands && unavail.href === CHANNEL && unavail.text === "Full page on YouTube" && unavail.afterCard,
    `W1: the act stands in the UNAVAILABLE paint too, directly under the unavailable card (${JSON.stringify(unavail)})`);
  await page.evaluate(BRIDGE_STUB);
  await page.evaluate(() => {
    window.__browserCalls = [];
    window.Capacitor.Plugins.Browser = { open: function (opts) { window.__browserCalls.push(opts); return Promise.resolve(); } };
  });
  const w1u = await actTap();
  const w1ucalls = await page.evaluate(() => window.__browserCalls);
  ok(w1u.defaultPrevented === true && w1ucalls.length === 1 && w1ucalls[0].url === CHANNEL,
    "W1: the unavailable paint's act is wired — in-shell it opens the channel page through the same handler");
} catch (e) {
  fails++;
  console.log("HARNESS ERROR: " + (e && e.stack || e));
} finally {
  try { if (browser) await browser.close(); } catch { /* noop */ }
  try { feedServer.close(); } catch { /* noop */ }
  procs.forEach((p) => { try { process.kill(-p.pid, "SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch { /* noop */ } } });
}
console.log(`# harness-v436: ${n} ok / ${fails} not-ok`);
process.exit(fails ? 1 : 0);
