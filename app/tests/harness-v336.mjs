// harness-v336 — v336 player speeds + full-screen Now Playing,
// proven against a local wrangler dev seeded exactly like
// production: migrations applied, the Intentions pool + standing
// draw seeded, one stored day committed through the agent door
// (own episodes + staged text), standing segments at 'current'
// (the v335 shape), and externals resolved CLIENT-SIDE at open
// (the v334 shape: fixture feeds through playwright routes for
// the browser's direct reads, the EXT_*_FEED_URL seams for the
// Worker's courier).
//
// The 14 legs of Plan §2.9: speed default/boot · persistence +
// corrupt fallback · mid-track change + rate held across
// own→external→segment crossings + position-state rate · speed
// sheet chips · dock tap opens NP (buttons excluded, no dockjump
// anywhere) · minimize view-only · seek own playing+paused ·
// seek downloaded external · seek segment · prev/next skip +
// disabled states · sleep shared state both directions · Read
// presence/absence + stacking · Intentions chip play + queue-end
// auto-close · served build parses + SW pin + purge exemption.
//
// HARD GUARD: refuses to run if APP resolves inside the shared
// fork checkout (the tree the nightly jobs read).

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (APP === "/home/hatch/workspace/projects/spotify_praylist-fork/app") {
  console.error("REFUSING: APP resolves inside the shared fork checkout");
  process.exit(2);
}
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8986, FEED_PORT = 8946;
const BASE = `http://127.0.0.1:${PORT}`;
const FEED = `http://127.0.0.1:${FEED_PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v336");
const TOKEN = "harness-token";
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
const FIX = path.join(APP, "tests", "fixtures", "v324");
const TARGET = "2026-11-08"; // a Sunday; the v324 fixtures' day
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const TEXT_ALPHA = "Alpha reading text.\n\nThe Lord is my shepherd; I shall not want.";
const results = [];
function ok(cond, label) { results.push([label, !!cond]); console.log(`${cond ? "ok" : "FAIL"} - ${label}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixture audio ----
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v336-audio-"));
function makeMp3(name, seconds, freq) {
  const f = path.join(TMPD, name);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${seconds}`,
    "-codec:a", "libmp3lame", "-b:a", "32k", "-y", f], { stdio: "pipe" });
  return fs.readFileSync(f);
}

// ---- feed server (the Worker's seam target): the v324 fixtures ----
const feedBytes = {
  do: fs.readFileSync(path.join(FIX, "divine-office.xml")),
  biay: fs.readFileSync(path.join(FIX, "bible-in-a-year.xml")),
  sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")),
};
const feedServer = http.createServer((req, res) => {
  const u = new URL(req.url, FEED);
  if (u.pathname === "/do.xml") { res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(feedBytes.do); }
  if (u.pathname === "/biay.xml") { res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(feedBytes.biay); }
  if (u.pathname === "/sth.xml") { res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(feedBytes.sth); }
  res.writeHead(404); res.end();
});

// ---- seed (the estate mold: 35 items + the 11-intention pool) ----
const ITEMS = [
  [1, "Morning", "Invitatory", "prayer", 3], [2, "Morning", "Morning Prayer", "prayer", 4],
  [3, "Morning", "Morning Prayer (Liturgy of the Hours)", "prayer", 5], [4, "Morning", "Daily Rosary", "prayer", 6],
  [5, "Morning", "Bible in a Year", "prayer", 7], [6, "Morning", "Morning Marian Antiphon", "prayer", 8],
  [8, "Midmorning", "Midmorning (Terce)", "prayer", 5], [9, "Midmorning", "Daily Gospel Exegesis", "prayer", 3],
  [10, "Midday", "Midday Prayer", "prayer", 4], [11, "Midmorning", "Novenas", "prayer", 4],
  [12, "Midday", "Midday Marian Antiphon", "prayer", 3], [14, "Afternoon", "None (Liturgy of the Hours)", "prayer", 7],
  [15, "Afternoon", "Saint of the Day", "prayer", 5], [16, "Afternoon", "Auxilium Christianorum", "prayer", 6],
  [17, "Evening", "Office of Readings", "prayer", 2], [20, "Evening", "Vespers", "prayer", 3],
  [21, "Night", "Compline", "prayer", 2], [23, "Morning", "Workout", "activity", 1],
  [24, "Morning", "Shower", "activity", 2], [25, "Midmorning", "Morning task", "activity", 1],
  [26, "Midmorning", "Socializing", "activity", 2], [27, "Midday", "Midday task", "activity", 1],
  [28, "Midday", "Socializing", "activity", 2], [29, "Morning", "Mass", "prayer", 9],
  [30, "Afternoon", "Afternoon task", "activity", 1], [31, "Afternoon", "Socializing", "activity", 2],
  [32, "Afternoon", "Additional spiritual prayer", "prayer", 3], [33, "Evening", "Evening task", "activity", 1],
  [34, "Evening", "Family quality time", "activity", 4], [35, "Evening", "Muse Feed", "activity", 5],
  [38, "Night", "Sleep", "activity", 3], [39, "Evening", "Next day prep", "activity", 6],
  [40, "Evening", "The AI Signal", "activity", 7], [41, "Night", "Daily Reflection", "prayer", 1],
  [42, "Afternoon", "Afternoon Marian Antiphon", "prayer", 4],
];
function seedSql() {
  const lines = [];
  for (const [id, block, name, kind, sort] of ITEMS) {
    lines.push(`INSERT INTO prayer_items (id, block, name, sub, kind, color, opening_prayer, closing_prayer, enabled, sort) VALUES (${id}, '${block}', '${name.replace(/'/g, "''")}', 'synthetic sub', '${kind}', '', 'Synthetic opening.', 'Synthetic closing.', 1, ${sort});`);
  }
  const pool = [];
  for (let i = 1; i <= 3; i++) pool.push([100 + i, `Synthetic intention H${i}`, "H"]);
  for (let i = 1; i <= 7; i++) pool.push([110 + i, `Synthetic intention M${i}`, "M"]);
  pool.push([120, "Synthetic intention L1", "L"]);
  for (const [id, text, pr] of pool) lines.push(`INSERT INTO prayer_intentions (id, text, priority, status, created_at) VALUES (${id}, '${text}', '${pr}', 'active', '2026-11-01T00:00:00.000Z');`);
  return lines.join("\n");
}
function wranglerD1(file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, "--file", file],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
}
function applySchemaAndSeed() {
  fs.rmSync(PERSIST, { recursive: true, force: true });
  const migDir = path.join(APP, "migrations");
  const parts = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => fs.readFileSync(path.join(migDir, f), "utf8"));
  parts.push(seedSql());
  const f = path.join(TMPD, "schema.sql");
  fs.writeFileSync(f, parts.join("\n"));
  wranglerD1(f);
}
function api(base, method, p, opts = {}) {
  return fetch(base + p, {
    method,
    headers: {
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.json ? { "content-type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
    body: opts.raw !== undefined ? opts.raw : (opts.json ? JSON.stringify(opts.json) : undefined),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const pushAudio = (date, id, bytes) => api(BASE, "POST", "/api/agent/player/episodes/audio",
  { token: TOKEN, raw: bytes, headers: { "x-episode-date": date, "x-episode-id": id, "content-type": "audio/mpeg" } });
const pushSegment = (date, block, bytes) => api(BASE, "POST", "/api/agent/prayer/audio",
  { token: TOKEN, raw: bytes, headers: { "x-prayer-date": date, "x-prayer-block": block, "content-type": "audio/mpeg" } });
const stageText = (date, epId, text) => api(BASE, "POST", "/api/agent/player/episodes/text",
  { token: TOKEN, raw: Buffer.from(text, "utf8"), headers: { "x-episode-date": date, "x-episode-id": epId, "content-type": "text/plain; charset=utf-8" } });
function startApp() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1",
    "--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`];
  const proc = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  proc.stdout.on("data", () => {}); proc.stderr.on("data", () => {});
  return proc;
}
async function waitUp(base, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(base + "/"); if (r.status) return true; } catch (e) {}
    await sleep(1000);
  }
  throw new Error("app did not come up: " + base);
}
async function commitDay(audio) {
  for (const b of BLOCKS) {
    const r = await pushSegment("current", b, audio.seg);
    if (r.status !== 200) throw new Error(`standing segment push ${b} -> ${r.status}`);
  }
  for (const [id, bytes] of [["ep-alpha", audio.own], ["ep-beta", audio.own], ["ep-night", audio.own]]) {
    const r = await pushAudio(TARGET, id, bytes);
    if (r.status !== 200) throw new Error(`audio push ${id} -> ${r.status}`);
  }
  const t = await stageText(TARGET, "ep-alpha", TEXT_ALPHA);
  if (t.status !== 200) throw new Error(`text stage ep-alpha -> ${t.status}`);
  const tracks = [
    { episode_id: "ep-alpha", title: "Alpha Long", block: "Morning", sort: 1, duration_s: 60, size_bytes: audio.own.length, audio_state: "present", text_state: "present", text_size_bytes: Buffer.byteLength(TEXT_ALPHA) },
    { episode_id: "ep-missing", title: "Missing Track", block: "Morning", sort: 2, duration_s: 60, size_bytes: 0, audio_state: "missing" },
    { episode_id: "ep-beta", title: "Beta Long", block: "Midday", sort: 1, duration_s: 60, size_bytes: audio.own.length, audio_state: "present" },
    { episode_id: "ep-night", title: "Night Long", block: "Night", sort: 1, duration_s: 60, size_bytes: audio.own.length, audio_state: "present" },
  ];
  const r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: TARGET, episodes: tracks } });
  if (r.status !== 200 || !r.body.ok) throw new Error(`day commit -> ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  // The Intentions-tab chip bar reads the real today — pushed AFTER
  // the stored-day commit, which sweeps other dates' dated rows.
  const s = await pushSegment(TODAY, "Morning", audio.segLong);
  if (s.status !== 200) throw new Error(`today segment push -> ${s.status}`);
}

// ---- browser helpers ----
async function wireRoutes(ctx, extTone) {
  await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", (route) =>
    route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: feedBytes.biay }));
  await ctx.route("https://feeds.castos.com/x8g54", (route) =>
    route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: feedBytes.sth }));
  await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: extTone }));
}
async function openApp(browser, extTone, withPosStub) {
  const ctx = await browser.newContext();
  if (withPosStub) {
    await ctx.addInitScript(() => {
      window.__posCalls = [];
      try {
        const orig = navigator.mediaSession.setPositionState.bind(navigator.mediaSession);
        navigator.mediaSession.setPositionState = (s) => { window.__posCalls.push({ duration: s && s.duration, playbackRate: s && s.playbackRate, position: s && s.position }); try { orig(s); } catch (e) {} };
      } catch (e) {}
    });
  }
  await wireRoutes(ctx, extTone);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#play-all", { timeout: 20000 });
  return { ctx, page, errors };
}
const ev = (page, fn) => page.evaluate(fn);
const ff = async (page, fn, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn).catch(() => false)) return true; await sleep(150); }
  return false;
};
const npOpen = (page) => page.evaluate(() => !!document.querySelector(".np-sheet"));
const openNp = async (page) => { await page.click("#dock-title"); return ff(page, () => !!document.querySelector(".np-sheet"), 4000); };
const closeNp = async (page) => { await page.click("#np-min"); await sleep(200); };
async function scrub(page, perMille) {
  await page.evaluate((v) => {
    const bar = document.getElementById("np-seek");
    bar.value = String(v);
    bar.dispatchEvent(new Event("input", { bubbles: true }));
    bar.dispatchEvent(new Event("change", { bubbles: true }));
  }, perMille);
  await sleep(350);
}
const waitBiay = (page) => ff(page, () => window.state.extSlots && window.state.extSlots["ext-bible-in-a-year"] && window.state.extSlots["ext-bible-in-a-year"].state === "present", 40000);

let app = null, browser = null;
try {
  const audio = {
    own: makeMp3("own.mp3", 60, 330),
    ext: makeMp3("ext.mp3", 60, 440),
    seg: makeMp3("seg.mp3", 30, 262),
    segLong: makeMp3("seglong.mp3", 30, 262),
  };
  applySchemaAndSeed();
  await new Promise((r) => feedServer.listen(FEED_PORT, "127.0.0.1", r));
  app = startApp();
  await waitUp(BASE);
  await commitDay(audio);
  const payload0 = await api(BASE, "GET", "/api/player/day");
  ok(payload0.status === 200 && payload0.body.storedDay === TARGET, `setup: stored day ${TARGET} committed through the agent door`);

  // ============ leg 14 (served half): build parses, SW pin, purge exemption ====
  const appJs = await (await fetch(BASE + "/app.js")).text();
  let parses = true; try { new vm.Script(appJs); } catch (e) { parses = false; }
  const swJs = await (await fetch(BASE + "/sw.js")).text();
  ok(parses && appJs.includes("opn-speed-v336") && appJs.includes("np-sheet") && !appJs.includes("dockjump") && !appJs.includes("dockJump"),
    "leg 14: served /app.js parses, carries the speed key + Now Playing, and no dock-jump remnant anywhere");
  ok(swJs.includes('var CACHE = "ora-pro-nobis-v336-1";') && swJs.includes('k !== "opn-ext-audio-v1"'),
    "leg 14: served SW carries CACHE = ora-pro-nobis-v336-1 AND the opn-ext-audio-v1 purge exemption verbatim");

  browser = await chromium.launch({ executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"] });

  // ============ context A: legs 1, 4, 2 (boot / sheet / persistence) ====
  {
    const { page, errors } = await openApp(browser, audio.ext, false);
    ok((await ev(page, () => window.state.rate)) === 1 && (await ev(page, () => document.getElementById("audio").playbackRate)) === 1,
      "leg 1: fresh profile boots at rate 1 (state + element, before any play)");
    await page.click('[data-playkey="ep-alpha"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-alpha" && !document.getElementById("audio").paused),
      "leg 1 setup: ep-alpha plays from its card");
    ok(await openNp(page), "leg 1: the dock tap opens Now Playing");
    ok((await ev(page, () => document.getElementById("np-speed").textContent)) === "1×"
      && (await ev(page, () => document.getElementById("np-title").textContent)) === "Alpha Long",
      "leg 1: NP speed button reads '1×' at the default, title is the track's");
    // leg 4: the sheet's chips — exact set, labels, active marking, sheet stands
    await page.click("#np-speed");
    ok(await ff(page, () => !!document.querySelector(".speedsheet"), 3000), "leg 4: the speed sheet opens from Now Playing");
    const chips = await ev(page, () => Array.from(document.querySelectorAll(".speedsheet [data-rate]")).map((b) => b.textContent));
    ok(JSON.stringify(chips) === JSON.stringify(["0.5×", "0.75×", "1×", "1.25×", "1.5×", "1.75×", "2×"]),
      `leg 4: chips are exactly the seven rates in ladder order (${chips.join(" ")})`);
    ok(await ev(page, () => document.querySelector(".speedsheet [data-rate].active").getAttribute("data-rate")) === "1",
      "leg 4: the current rate's chip (1×) carries the active mark");
    await page.click('.speedsheet [data-rate="1.75"]');
    await sleep(250);
    ok((await ev(page, () => document.getElementById("audio").playbackRate)) === 1.75
      && (await ev(page, () => localStorage.getItem("opn-speed-v336"))) === "1.75"
      && (await ev(page, () => document.querySelector(".speedsheet [data-rate].active").getAttribute("data-rate"))) === "1.75"
      && (await ev(page, () => !!document.querySelector(".speedsheet"))),
      "leg 4: choosing 1.75× applies it, persists it, re-marks the chip — and the sheet stays standing");
    await page.click("#sp-close");
    ok(await ff(page, () => !document.querySelector(".speedsheet"), 3000), "leg 4: the sheet closes on its Close button");
    // leg 2: persistence across reload + corrupt fallback
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#play-all", { timeout: 20000 });
    ok((await ev(page, () => window.state.rate)) === 1.75 && (await ev(page, () => document.getElementById("audio").playbackRate)) === 1.75
      && (await ev(page, () => window.state.current)) === null,
      "leg 2: after reload the stored 1.75 is the boot rate — applied with nothing playing");
    await ev(page, () => localStorage.setItem("opn-speed-v336", "banana"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#play-all", { timeout: 20000 });
    ok((await ev(page, () => window.state.rate)) === 1 && (await ev(page, () => document.getElementById("audio").playbackRate)) === 1,
      "leg 2: a corrupt stored value falls back to 1 rather than wedging the player");
    ok(errors.length === 0, `context A: zero page errors (${errors.length})`);
  }

  // ============ context B: legs 7, 3, 6, 5, 10, 11, 12 ====
  {
    const { page, errors } = await openApp(browser, audio.ext, true);
    ok(await waitBiay(page), "context B setup: Bible in a Year settled present (client-side, at open)");
    await page.click('[data-playkey="ep-alpha"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-alpha" && !document.getElementById("audio").paused),
      "context B setup: ep-alpha playing");
    ok(await openNp(page), "context B setup: Now Playing open");
    // leg 7: seek an own episode, playing then paused
    ok(await ff(page, () => isFinite(document.getElementById("audio").duration) && document.getElementById("audio").duration > 0),
      "leg 7 setup: the own episode's duration is known");
    await scrub(page, 500);
    let st = await ev(page, () => ({ ct: document.getElementById("audio").currentTime, dur: document.getElementById("audio").duration,
      el: document.getElementById("np-elapsed").textContent, rem: document.getElementById("np-remain").textContent, paused: document.getElementById("audio").paused }));
    ok(Math.abs(st.ct - st.dur / 2) <= 1.5 && !st.paused && /^\d+:\d{2}$/.test(st.el) && st.rem.startsWith("-"),
      `leg 7: seek to the middle of a PLAYING own episode lands (${st.ct.toFixed(1)} of ${st.dur.toFixed(1)}), labels ${st.el} / ${st.rem}`);
    await page.click("#np-play");
    ok(await ff(page, () => document.getElementById("audio").paused), "leg 7 setup: paused from Now Playing");
    await scrub(page, 250);
    st = await ev(page, () => ({ ct: document.getElementById("audio").currentTime, dur: document.getElementById("audio").duration, paused: document.getElementById("audio").paused }));
    ok(Math.abs(st.ct - st.dur / 4) <= 1.5 && st.paused,
      `leg 7: seek to a quarter of a PAUSED own episode lands (${st.ct.toFixed(1)} of ${st.dur.toFixed(1)}) and stands paused`);
    // leg 3: mid-track change + crossings + position state
    await page.click("#np-play");
    ok(await ff(page, () => !document.getElementById("audio").paused), "leg 3 setup: playing again");
    await sleep(2500); // let the position run well past zero so the continuity sample is meaningful
    const tBefore = await ev(page, () => document.getElementById("audio").currentTime);
    await page.click("#np-speed");
    await ff(page, () => !!document.querySelector(".speedsheet"), 3000);
    await page.click('.speedsheet [data-rate="1.25"]');
    await sleep(700);
    const tAfter = await ev(page, () => document.getElementById("audio").currentTime);
    const posRate = await ev(page, () => { const c = window.__posCalls || []; return c.length ? c[c.length - 1].playbackRate : null; });
    ok((await ev(page, () => document.getElementById("audio").playbackRate)) === 1.25 && tAfter > tBefore && tAfter - tBefore < 2.5,
      `leg 3: mid-track change to 1.25× — same track playing, position continuous (${tBefore.toFixed(1)} -> ${tAfter.toFixed(1)})`);
    ok(posRate === 1.25, `leg 3: the Media Session position state reports playbackRate 1.25 (saw ${posRate})`);
    await page.click("#sp-close");
    await ev(page, () => {
      const d = (id) => window.state.dayDescs.find((x) => x.episodeId === id);
      window.startQueue([d("ep-alpha"), d("ext-bible-in-a-year"), d("seg:Midday")]);
    });
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-alpha"), "leg 3: the crossing queue starts on the own episode");
    ok(await npOpen(page) || await openNp(page), "leg 3: Now Playing stands for the crossings");
    await page.click("#np-next");
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ext-bible-in-a-year" && !document.getElementById("audio").paused),
      "leg 3: next crosses own -> downloaded external");
    ok((await ev(page, () => document.getElementById("audio").playbackRate)) === 1.25 && (await ev(page, () => window.state.rate)) === 1.25,
      "leg 3: the rate survives the own -> external crossing (startDesc re-asserts it)");
    await page.click("#np-next");
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "seg:Midday" && !document.getElementById("audio").paused),
      "leg 3: next crosses external -> Intentions segment");
    ok((await ev(page, () => document.getElementById("audio").playbackRate)) === 1.25,
      "leg 3: the rate survives the external -> segment crossing");
    // leg 6: minimize is view-only
    await ev(page, () => window.__opnSleep.armTrack());
    const sleepBefore = await ev(page, () => JSON.stringify(window.__opnSleep.state()));
    const minBefore = await ev(page, () => ({ paused: document.getElementById("audio").paused, ct: document.getElementById("audio").currentTime }));
    await page.click("#np-min");
    await sleep(600);
    const minAfter = await ev(page, () => ({ paused: document.getElementById("audio").paused, ct: document.getElementById("audio").currentTime, sheet: !!document.querySelector(".np-sheet") }));
    ok(!minAfter.sheet && minAfter.paused === minBefore.paused && minAfter.ct >= minBefore.ct && minAfter.ct - minBefore.ct < 2.5
      && (await ev(page, () => JSON.stringify(window.__opnSleep.state()))) === sleepBefore,
      "leg 6: minimize removes only the sheet — playback, position, and the armed sleep state are untouched");
    await ev(page, () => window.__opnSleep.disarm());
    // leg 5: the dock tap (tab untouched, buttons excluded, no dockjump)
    await page.click('[data-tab="intentions"]');
    await sleep(600);
    ok(await openNp(page), "leg 5: the dock tap opens Now Playing from another tab");
    ok((await ev(page, () => window.state.tab)) === "intentions" && (await ev(page, () => document.querySelectorAll(".dockjump").length)) === 0,
      "leg 5: the tab does NOT switch (the v326 jump is retired) and no dockjump mark exists anywhere");
    await closeNp(page);
    await page.click("#dock-next");
    ok(await ff(page, () => window.state.current === null) && !(await npOpen(page)),
      "leg 5: #dock-next advances only — no sheet opens (the crossings queue ends, the dock clears)");
    await page.click('[data-tab="prayers"]');
    await page.waitForSelector('[data-playkey="ep-alpha"]', { timeout: 10000 });
    await page.click('[data-playkey="ep-alpha"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-alpha" && !document.getElementById("audio").paused),
      "leg 5 setup: ep-alpha playing again");
    await page.click("#dock-play");
    ok(await ff(page, () => document.getElementById("audio").paused) && !(await npOpen(page)),
      "leg 5: #dock-play toggles pause only — no sheet opens");
    await page.click("#dock-play");
    ok(await ff(page, () => !document.getElementById("audio").paused) && !(await npOpen(page)),
      "leg 5: #dock-play resumes — still no sheet");
    // leg 10: prev/next skip rule + disabled states
    await ev(page, () => {
      const d = (id) => window.state.dayDescs.find((x) => x.episodeId === id);
      window.startQueue([d("ep-alpha"), d("ep-missing"), d("ep-beta")]);
    });
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-alpha"), "leg 10 setup: the skip queue starts on ep-alpha");
    ok(await openNp(page), "leg 10: Now Playing open");
    let dis = await ev(page, () => ({ prev: document.getElementById("np-prev").disabled, next: document.getElementById("np-next").disabled }));
    ok(dis.prev === true && dis.next === false, "leg 10: at the queue's head, Previous is disabled and Next is enabled");
    await page.click("#np-next");
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-beta"),
      "leg 10: Next skips the unavailable middle track and lands ep-beta");
    await page.click("#np-prev");
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-alpha"),
      "leg 10: Previous returns to ep-alpha");
    await ev(page, () => window.__opnMediaHandlers.nexttrack());
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-beta"),
      "leg 10: the Media Session nexttrack handler lands the same skip (one advance rule)");
    await closeNp(page); // the sheet covers the screen — minimize before touching a card
    await page.click('[data-playkey="ep-night"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-night" && window.state.queue.length === 0),
      "leg 10 setup: a single-track card play (queue empty)");
    ok(await openNp(page), "leg 10: Now Playing opens in full for the single-track play");
    dis = await ev(page, () => ({ prev: document.getElementById("np-prev").disabled, next: document.getElementById("np-next").disabled }));
    ok(dis.prev === true && dis.next === true, "leg 10: with no queue, both Previous and Next are disabled — the surface still opens in full");
    // leg 11: sleep — one state, two surfaces
    await page.click("#np-sleep");
    ok(await ff(page, () => !!document.querySelector("[data-sleep-choice]"), 3000), "leg 11: Now Playing's sleep button opens the shared sleep sheet");
    await page.click('[data-sleep-choice="15"]');
    ok(await ff(page, () => window.__opnSleep.state().mode === "minutes"), "leg 11: arming 15 minutes from Now Playing sets the one sleep state");
    await closeNp(page);
    await page.click('[data-tab="prayers"]');
    await sleep(800);
    ok(await openNp(page), "leg 11: Now Playing reopens over the Prayers view");
    let labels = null;
    for (let i = 0; i < 4 && !labels; i++) {
      const pair = await ev(page, () => ({ np: document.getElementById("np-sleep").textContent, row: document.getElementById("sleep-btn").textContent }));
      if (pair.np === pair.row) labels = pair; else await sleep(300);
    }
    ok(!!labels && labels.np.startsWith("Sleep · "), `leg 11: both surfaces read the same armed label (${labels ? labels.np : "mismatch"})`);
    await closeNp(page);
    await page.click("#sleep-btn");
    await ff(page, () => !!document.querySelector("[data-sleep-choice]"), 3000);
    await page.click('[data-sleep-choice="off"]');
    ok(await ff(page, () => window.__opnSleep.state().mode === "off"), "leg 11: disarming from the Play All row clears the one state");
    ok(await openNp(page), "leg 11: Now Playing reopens");
    ok((await ev(page, () => document.getElementById("np-sleep").textContent)) === "Sleep · Off",
      "leg 11: Now Playing's label follows the row's disarm (Sleep · Off)");
    await page.click("#np-sleep");
    await ff(page, () => !!document.querySelector("[data-sleep-choice]"), 3000);
    await page.click('[data-sleep-choice="track"]');
    ok(await ff(page, () => window.__opnSleep.state().mode === "track"), "leg 11: end-of-track armed from Now Playing");
    await ev(page, () => { const a = document.getElementById("audio"); a.currentTime = Math.max(0, a.duration - 0.3); });
    ok(await ff(page, () => window.__opnSleep.state().mode === "off" && window.state.current === null, 8000),
      "leg 11: the track's end fires the sleep stop (state disarmed, playback cleared)");
    ok(!(await npOpen(page)), "leg 11: Now Playing removes itself when the current track clears");
    // leg 12: Read — presence, absence, stacking
    await page.click('[data-playkey="ep-alpha"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ep-alpha"), "leg 12 setup: ep-alpha (with text) current");
    ok(await npOpen(page) || await openNp(page), "leg 12: Now Playing open");
    ok((await ev(page, () => document.getElementById("np-read").style.display)) !== "none",
      "leg 12: Read stands on Now Playing for a track with text");
    const readBefore = await ev(page, () => ({ paused: document.getElementById("audio").paused, id: window.state.current.episodeId }));
    await page.click("#np-read");
    ok(await ff(page, () => !!document.querySelector(".readsheet"), 4000)
      && (await ev(page, () => !!document.querySelector(".np-sheet"))),
      "leg 12: Read stacks OVER Now Playing (both sheets stand)");
    await page.click("[data-readclose]");
    await sleep(300);
    const readAfter = await ev(page, () => ({ paused: document.getElementById("audio").paused, id: window.state.current && window.state.current.episodeId, np: !!document.querySelector(".np-sheet"), read: !!document.querySelector(".readsheet") }));
    ok(readAfter.np && !readAfter.read && readAfter.paused === readBefore.paused && readAfter.id === readBefore.id,
      "leg 12: closing Read returns to Now Playing with playback untouched");
    await closeNp(page);
    await page.click('[data-playkey="ext-bible-in-a-year"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ext-bible-in-a-year"), "leg 12 setup: the external is current");
    ok(await openNp(page), "leg 12: Now Playing reopens on the external");
    ok((await ev(page, () => document.getElementById("np-read").style.display)) === "none",
      "leg 12: Read is absent for an external track");
    await closeNp(page);
    await page.click('[data-playkey="seg:Midday"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "seg:Midday"), "leg 12 setup: the segment is current");
    ok(await openNp(page), "leg 12: Now Playing reopens on the segment");
    ok((await ev(page, () => document.getElementById("np-read").style.display)) === "none",
      "leg 12: Read is absent for an Intentions segment");
    ok(errors.length === 0, `context B: zero page errors (${errors.length})`);
  }

  // ============ context C: legs 8, 9 (seek external / segment) ====
  {
    const { page, errors } = await openApp(browser, audio.ext, false);
    ok(await waitBiay(page), "leg 8 setup: Bible in a Year settled present");
    await page.click('[data-playkey="ext-bible-in-a-year"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "ext-bible-in-a-year" && !document.getElementById("audio").paused),
      "leg 8 setup: the downloaded external plays (blob-local)");
    ok(await openNp(page), "leg 8: Now Playing open");
    ok(await ff(page, () => isFinite(document.getElementById("audio").duration) && document.getElementById("audio").duration > 0),
      "leg 8 setup: the external's duration is known");
    await scrub(page, 500);
    const st8 = await ev(page, () => ({ ct: document.getElementById("audio").currentTime, dur: document.getElementById("audio").duration }));
    ok(Math.abs(st8.ct - st8.dur / 2) <= 1.5,
      `leg 8: seek to the middle of the downloaded external lands (${st8.ct.toFixed(1)} of ${st8.dur.toFixed(1)}) — blob-local seeking is exact`);
    await closeNp(page); // the sheet covers the screen — minimize before touching a card
    await page.click('[data-playkey="seg:Midday"]');
    ok(await ff(page, () => window.state.current && window.state.current.episodeId === "seg:Midday" && !document.getElementById("audio").paused),
      "leg 9 setup: the Midday Intentions segment plays");
    ok(await openNp(page), "leg 9: Now Playing opens on the segment");
    ok(await ff(page, () => { const a = document.getElementById("audio"); return isFinite(a.duration) && a.duration > 0 && a.buffered.length > 0 && a.buffered.end(0) > 4; }, 10000),
      "leg 9 setup: the segment's duration is known and its body is buffering in");
    await scrub(page, 300);
    const st9 = await ev(page, () => ({ ct: document.getElementById("audio").currentTime, dur: document.getElementById("audio").duration }));
    ok(Math.abs(st9.ct - st9.dur * 0.3) <= 1.5,
      `leg 9: an in-buffer scrub of the segment lands (${st9.ct.toFixed(1)} of ${st9.dur.toFixed(1)}) over the full-body route`);
    ok(errors.length === 0, `context C: zero page errors (${errors.length})`);
  }

  // ============ context D: leg 13 (Intentions chip play) ====
  {
    const { page, errors } = await openApp(browser, audio.ext, false);
    await page.click('[data-tab="intentions"]');
    await page.waitForSelector("[data-play]", { timeout: 20000 });
    await page.click("[data-play]");
    ok(await ff(page, () => window.state.current && String(window.state.current.episodeId).startsWith("url:") && !document.getElementById("audio").paused),
      "leg 13 setup: an Intentions chip play is running");
    ok(await openNp(page), "leg 13: the dock tap opens Now Playing for a chip play");
    const chip = await ev(page, () => ({ title: document.getElementById("np-title").textContent,
      prev: document.getElementById("np-prev").disabled, next: document.getElementById("np-next").disabled,
      read: document.getElementById("np-read").style.display, speed: document.getElementById("np-speed").textContent,
      sleepLbl: document.getElementById("np-sleep").textContent }));
    ok(chip.title === "Intentions" && chip.prev && chip.next && chip.read === "none" && chip.speed.endsWith("×") && chip.sleepLbl.startsWith("Sleep ·"),
      `leg 13: NP for a chip play — titled 'Intentions', prev/next disabled, Read absent, speed (${chip.speed}) and sleep (${chip.sleepLbl}) live`);
    ok(await ff(page, () => isFinite(document.getElementById("audio").duration) && document.getElementById("audio").duration > 0, 8000),
      "leg 13 setup: the chip play's duration is known");
    await ev(page, () => { const a = document.getElementById("audio"); a.currentTime = Math.max(0, a.duration - 0.3); });
    ok(await ff(page, () => window.state.current === null, 10000), "leg 13: the chip play ends");
    ok(await ff(page, () => !document.querySelector(".np-sheet"), 4000),
      "leg 13: Now Playing removes itself at the queue's end (visibility derived from state.current)");
    ok(errors.length === 0, `context D: zero page errors (${errors.length})`);
  }
} catch (e) {
  console.log("HARNESS ERROR:", e && e.message ? e.message : e);
  results.push(["harness completed without error", false]);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (app) app.kill();
  feedServer.close();
}
const passed = results.filter(([, p]) => p).length;
console.log(`\nharness-v336: ${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
