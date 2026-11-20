// harness-v326 — the v326 gate (Plan §2.8): the docked player on the
// shipped v318/v320/v325 player. Client-only checks in a real browser
// against a scratch instance INSIDE the worktree: dock absent before
// any load on all four tabs · card play raises the dock with the
// right title/block · dock and card play/pause agree both directions
// · progress advances and resets, and carries no seek · dock next
// follows the queue's skip rule (a missing track is named on its
// card) · the dock persists across all four tabs and is the pause
// control on Examination and Confession · the tap-through jump lands
// on the Prayers card (and is a no-op for chip plays) · queue end
// and a lone track's end clear the dock and restore the 96px pad ·
// the v320 sleep paths hold with the dock present (timed stop holds
// the track; end-of-track hold shows the next track unstarted) ·
// sheets and the Read view cover the dock (z-order) · Intentions
// chip plays raise the dock titled "Intentions" with next disabled ·
// the clearance arithmetic is measured, not constant · the SW name
// reads ora-pro-nobis-v334-1 (v334 Implement named update: the header pin follows the trunk's cache rename) · the served client parses and boots.
// Tallies read from the COMPLETE log. Regression suites (v312/v318/
// v320/v325/v327) run as their own processes; their tallies are
// quoted in the release document §3.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_CHECKOUT = "/home/hatch/workspace/projects/spotify_praylist-fork";
if (APP.startsWith(SHARED_CHECKOUT)) { console.error("HARD GUARD: harness WT resolves inside the shared fork checkout — refusing"); process.exit(2); }

const PORT = 8971;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v326");
const TOKEN = "harness-token";
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
const D = "2027-03-05";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixture audio: real MP3 tones via ffmpeg (browser-playable) ----
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v326-audio-"));
function makeMp3(name, seconds, freq) {
  const f = path.join(TMPD, name);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${seconds}`,
    "-codec:a", "libmp3lame", "-b:a", "32k", "-y", f], { stdio: "pipe" });
  return fs.readFileSync(f);
}

// ---- seed (the v312 mold: 35 items + the 11-intention pool) ----
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
function d1exec(persist, file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", persist, "--file", file],
    { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: "pipe" });
}
function applySchema(persist, tag) {
  fs.rmSync(persist, { recursive: true, force: true });
  const all = fs.readdirSync(path.join(APP, "migrations")).filter((x) => x.endsWith(".sql")).sort()
    .map((f) => fs.readFileSync(path.join(APP, "migrations", f), "utf8")).join("\n");
  const tmp = path.join(APP, `.wrangler-test-v326-${tag}-schema.sql`);
  fs.writeFileSync(tmp, all);
  d1exec(persist, tmp);
}
function startWrangler(port, persist) {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", "FEED_URL:http://127.0.0.1:8939/feed.xml", "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"];
  const child = spawn(WRANGLER, args, { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", () => {});
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 150; i++) { try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
async function api(base, method, p, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  let body;
  if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
  if (opts.raw !== undefined) body = opts.raw;
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(base + p, { method, headers, body });
  const text = await res.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, body: parsed, text, headers: res.headers };
}
async function stageEpisode(date, epId, bytes) {
  return api(BASE, "POST", "/api/agent/player/episodes/audio",
    { token: TOKEN, raw: bytes, headers: { "x-episode-date": date, "x-episode-id": epId, "content-type": "audio/mpeg" } });
}
async function stageText(date, epId, text) {
  return api(BASE, "POST", "/api/agent/player/episodes/text",
    { token: TOKEN, raw: Buffer.from(text, "utf8"), headers: { "x-episode-date": date, "x-episode-id": epId, "content-type": "text/plain; charset=utf-8" } });
}
async function pushSegment(date, block, bytes) {
  const r = await api(BASE, "POST", "/api/agent/prayer/audio",
    { token: TOKEN, raw: bytes, headers: { "x-prayer-date": date, "x-prayer-block": block, "content-type": "audio/mpeg" } });
  if (r.status !== 200) throw new Error(`segment push ${date}/${block} -> ${r.status}`);
}
// Fixture day: Morning carries a present / missing / present run for
// the skip check and a text-carrying track for the Read check; Midday
// carries a 6 s track (an arm must be able to land before its end —
// the v320 race lesson) ahead of a 30 s track for the end-of-track
// hold; Night is two 3 s legs for the queue-end clear. Segment tones:
// 30 s for Morning/Midday, 3 s for Night.
const EPS = [
  { episode_id: "ep-alpha", title: "Alpha Long", block: "Morning", sort: 1, duration_s: 30, file: "la", text: true },
  { episode_id: "ep-missing", title: "Missing Middle", block: "Morning", sort: 2, duration_s: 30, missing: true },
  { episode_id: "ep-beta", title: "Beta Long", block: "Morning", sort: 3, duration_s: 30, file: "lb" },
  { episode_id: "ep-mid-a", title: "Midday Short", block: "Midday", sort: 1, duration_s: 6, file: "m6" },
  { episode_id: "ep-mid-b", title: "Midday Long", block: "Midday", sort: 2, duration_s: 30, file: "m30" },
  { episode_id: "ep-night", title: "Night Short", block: "Night", sort: 1, duration_s: 3, file: "n3" },
];
const TEXT_ALPHA = "Alpha Long — the episode's full text, staged by the harness for the Read-view check.\nSecond line of the alpha text.";
function manifestOf(eps, audio) {
  return eps.map((e) => ({
    episode_id: e.episode_id, title: e.title, block: e.block, sort: e.sort, duration_s: e.duration_s,
    size_bytes: e.missing ? 0 : audio[e.file].length, audio_state: e.missing ? "missing" : "present",
    text_state: e.text ? "present" : "missing", text_size_bytes: e.text ? Buffer.byteLength(TEXT_ALPHA) : 0,
  }));
}

let app1 = null, browser = null;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v326-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "worker bundles clean (esbuild)");

  const audio = {
    la: makeMp3("la.mp3", 30, 220), lb: makeMp3("lb.mp3", 30, 330),
    m6: makeMp3("m6.mp3", 6, 440), m30: makeMp3("m30.mp3", 30, 660), n3: makeMp3("n3.mp3", 3, 550),
    seg30: makeMp3("seg30.mp3", 30, 262), seg3: makeMp3("seg3.mp3", 3, 292),
  };

  // Gate identity: the port must be free before this run spawns its
  // own wrangler — a foreign answer is structurally impossible.
  let portFree = false;
  try { await fetch(BASE + "/", { signal: AbortSignal.timeout(800) }); } catch { portFree = true; }
  ok(portFree, "gate identity: port 8971 is free before spawn (no foreign instance answers)");

  applySchema(PERSIST, "main");
  const seedFile = path.join(APP, ".wrangler-test-v326-seed.sql");
  fs.writeFileSync(seedFile, seedSql());
  d1exec(PERSIST, seedFile);
  app1 = startWrangler(PORT, PERSIST);
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");

  for (const b of ["Morning", "Midday"]) await pushSegment(D, b, audio.seg30);
  await pushSegment(D, "Night", audio.seg3);
  let stageOk = true;
  for (const e of EPS) { if (e.missing) continue; const r = await stageEpisode(D, e.episode_id, audio[e.file]); if (r.status !== 200) stageOk = false; }
  ok(stageOk, "fixture: episode audio staged for the fixture day");
  const tr = await stageText(D, "ep-alpha", TEXT_ALPHA);
  ok(tr.status === 200 && tr.body.size === Buffer.byteLength(TEXT_ALPHA), "fixture: ep-alpha's text staged");
  let r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: D, episodes: manifestOf(EPS, audio) } });
  ok(r.status === 200 && r.body.storedDate === D && r.body.rowCount === 6, "fixture: day commit lands (rowCount 6)");
  // The Intentions-tab chip bar reads the real today — pushed AFTER
  // the day commit on purpose: the commit prunes every other date's
  // segment rows (the one-stored-day sweep), so a today segment
  // pushed before it would be deleted by the commit itself.
  await pushSegment(TODAY, "Morning", audio.seg30);
  r = await api(BASE, "GET", "/api/player/day");
  const morning = r.body.blocks.find((b) => b.block === "Morning");
  const mSlice = morning.tracks.map((t) => t.episodeId || ("seg:" + morning.block));
  ok(JSON.stringify(mSlice) === JSON.stringify(["seg:Morning", "ep-alpha", "ep-missing", "ep-beta"]),
    `fixture: Morning slice serves Intentions-first (${mSlice.join(",")})`);

  // ---------- browser ----------
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  let pageErrors = 0;
  page.on("pageerror", (e) => { pageErrors++; console.log("pageerror:", String(e).slice(0, 200)); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const ff = async (fn, timeout = 20000) => { try { await page.waitForFunction(fn, null, { timeout }); return true; } catch { return false; } };
  const cur = () => ev(() => window.state.current && window.state.current.episodeId);
  const paused = () => ev(() => document.getElementById("audio").paused);
  const dockVisible = () => ev(() => !document.getElementById("dock").classList.contains("hidden"));
  const dockTitle = () => ev(() => document.getElementById("dock-title").textContent);
  const dockGlyph = () => ev(() => document.getElementById("dock-play").textContent);
  const fillPct = () => ev(() => parseFloat(document.getElementById("dock-progress-fill").style.width) || 0);
  const viewPad = () => ev(() => parseFloat(getComputedStyle(document.getElementById("view")).paddingBottom));
  const reset = async () => {
    await ev(() => { try { document.getElementById("audio").pause(); } catch (e) {} localStorage.clear(); });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#play-all", { timeout: 20000 });
  };

  // check 20/21 groundwork: served files before any navigation.
  const swText = await (await fetch(BASE + "/sw.js")).text();
  ok(swText.includes("ora-pro-nobis-v334-1"), "check 20: the served /sw.js reads ora-pro-nobis-v334-1 (v334's bump, named update — the pin follows the landed trunk's cache rename)");
  const appJs = await (await fetch(BASE + "/app.js")).text();
  let parses = true; try { new vm.Script(appJs); } catch { parses = false; }

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#play-all", { timeout: 20000 });
  const cardCount = await ev(() => document.querySelectorAll("[data-card]").length);
  ok(cardCount > 10, `seeded day rendered (${cardCount} cards)`);

  // ---- check 1: dock absent pre-load on all four tabs, pad exactly 96px ----
  for (const tab of ["prayers", "intentions", "examination", "confession"]) {
    await page.click(`[data-tab="${tab}"]`);
    await sleep(700);
    ok(!(await dockVisible()) && (await viewPad()) === 96 && (await cur()) === null,
      `check 1: ${tab} tab — no dock before any load, .view pad exactly 96px`);
  }
  await page.click('[data-tab="prayers"]');
  await page.waitForSelector("#play-all", { timeout: 20000 });
  ok(parses && (await ev(() => document.querySelectorAll("#dock").length)) === 1 && pageErrors === 0,
    "check 21: served /app.js parses (vm.Script), exactly one #dock stands in the booted shell, zero page errors");

  // ---- checks 2/3/4: card play raises the dock; agreement both directions ----
  await page.click('[data-playkey="ep-alpha"]');
  ok(await ff(() => window.state.current && window.state.current.episodeId === "ep-alpha" && !document.getElementById("audio").paused),
    "check 2 setup: ep-alpha plays from its card");
  ok((await dockVisible()) && (await dockTitle()) === "Alpha Long" && (await ev(() => document.getElementById("dock-meta").textContent)) === "Morning",
    "check 2: dock appears with title 'Alpha Long' and the block name 'Morning' as meta");
  ok((await dockVisible()) && Math.abs((await viewPad()) - (96 + (await ev(() => document.getElementById("dock").offsetHeight)))) < 1.5
    && Math.abs((await ev(() => window.innerHeight - document.getElementById("dock").getBoundingClientRect().bottom)) - (await ev(() => document.getElementById("tabbar").offsetHeight))) < 1.5,
    "check 19: standing clearance — pad = 96px + measured dock height, dock bottom edge sits exactly on the measured tab bar height");
  await page.click("#dock-play");
  ok(await ff(() => document.getElementById("audio").paused), "check 3: dock pause actually pauses the element");
  ok((await dockGlyph()) === "▶" && (await ev(() => document.querySelector('[data-playkey="ep-alpha"]').classList.contains("playing"))),
    "check 3: dock shows the paused glyph while the card keeps its playing (current-track) mark");
  await page.click('[data-playkey="ep-alpha"]');
  ok(await ff(() => !document.getElementById("audio").paused), "check 4: card play resumes");
  ok((await dockGlyph()) === "❙❙", "check 4: dock glyph follows the card back to the playing mark (the app's own &#10073; pair, identical to the cards')");
  await page.click('[data-playkey="ep-alpha"]');
  ok((await ff(() => document.getElementById("audio").paused)) && (await dockGlyph()) === "▶",
    "check 4: card pause reflects in the dock (agreement both directions)");

  // ---- checks 8/9: progress advances, resets on switch, never seeks ----
  await reset();
  await page.click('[data-playkey="ep-beta"]');
  ok(await ff(() => window.state.current && window.state.current.episodeId === "ep-beta" && !document.getElementById("audio").paused), "check 8 setup: ep-beta playing");
  await sleep(1200); const p1 = await fillPct();
  await sleep(1500); const p2 = await fillPct();
  ok(p1 > 0.5 && p2 > p1, `check 8: progress fill advances on a 30 s track (${p1.toFixed(1)}% -> ${p2.toFixed(1)}%)`);
  const tBefore = await ev(() => document.getElementById("audio").currentTime);
  await page.click(".dockprogress", { position: { x: 2, y: 1 } });
  await sleep(400);
  const tAfter = await ev(() => document.getElementById("audio").currentTime);
  ok(tAfter >= tBefore && tAfter - tBefore < 1.6, `check 9: clicking the progress line does not seek (${tBefore.toFixed(1)}s -> ${tAfter.toFixed(1)}s)`);
  await page.click('[data-playkey="ep-alpha"]');
  ok(await ff(() => window.state.current && window.state.current.episodeId === "ep-alpha"), "check 8: track switch lands ep-alpha");
  await sleep(150);
  ok((await fillPct()) < 2, `check 8: progress resets to ~0 on the track switch (${(await fillPct()).toFixed(1)}%)`);

  // ---- check 5: dock next follows the queue's skip rule ----
  await reset();
  await page.click('[data-queue="Morning"]');
  ok(await ff(() => window.state.current && window.state.current.episodeId === "seg:Morning" && !document.getElementById("audio").paused),
    "check 5 setup: Morning block queue plays from the Intentions card");
  await page.click("#dock-next");
  ok(await ff(() => window.state.current && window.state.current.episodeId === "ep-alpha"), "check 5: dock next advances to ep-alpha");
  await page.click("#dock-next");
  ok(await ff(() => window.state.current && window.state.current.episodeId === "ep-beta") && (await dockTitle()) === "Beta Long",
    "check 5: dock next skips the missing track and lands ep-beta");
  ok((await ev(() => (document.querySelector('[data-card="ep-missing"]').style.outline || "") !== "")), "check 5: the skipped track is named on its own card (inline outline set)");

  // ---- checks 6/7: persistence on all tabs; dock as the pause control ----
  for (const tab of ["intentions", "examination", "confession", "prayers"]) {
    await page.click(`[data-tab="${tab}"]`);
    await sleep(500);
    ok((await dockVisible()) && !(await paused()), `check 6: dock persists on the ${tab} tab while playing`);
  }
  await page.click('[data-tab="examination"]');
  await sleep(500);
  await page.click("#dock-play");
  ok((await ff(() => document.getElementById("audio").paused)) && (await dockVisible()),
    "check 7: Examination carries the dock alone and its play/pause pauses the track");
  await page.click('[data-tab="confession"]');
  await sleep(500);
  await page.click("#dock-play");
  ok(await ff(() => !document.getElementById("audio").paused), "check 7: Confession carries the dock alone and its play/pause resumes the track");

  // ---- check 17: body tap jumps to the playing card ----
  await page.click("#dock");
  ok(await ff(() => window.state.tab === "prayers", 5000), "check 17: dock body tap moves to the Prayers tab");
  ok(await ff(() => {
    const c = document.querySelector('[data-card="ep-beta"]');
    if (!c) return false;
    const r = c.getBoundingClientRect();
    return r.top >= -4 && r.bottom <= window.innerHeight + 4;
  }, 5000), "check 17: the playing track's card stands inside the viewport after the jump");

  // ---- check 10: a queue run-out clears the dock and restores the pad ----
  await reset();
  await page.click('[data-queue="Night"]');
  ok(await ff(() => window.state.current && window.state.current.episodeId === "seg:Night", 10000), "check 10 setup: Night queue starts on its Intentions card");
  ok(await ff(() => document.getElementById("dock").classList.contains("hidden") && window.state.current === null, 30000),
    "check 10: when the Night queue runs out the dock hides and current clears");
  ok((await viewPad()) === 96 && !(await ev(() => document.body.classList.contains("dock-on"))),
    "check 10: .view pad returns to exactly 96px with the dock gone");

  // ---- check 11: a lone track's end clears the dock ----
  await page.click('[data-playkey="ep-mid-a"]');
  ok((await ff(() => window.state.current && window.state.current.episodeId === "ep-mid-a")) && (await dockVisible()),
    "check 11 setup: lone ep-mid-a raises the dock");
  ok(await ff(() => document.getElementById("dock").classList.contains("hidden"), 20000),
    "check 11: the lone track's end hides the dock");

  // ---- check 12: sleep timed stop holds the track, dock shows it paused ----
  await reset();
  await page.click("#play-all");
  ok(await ff(() => window.state.current && !document.getElementById("audio").paused), "check 12 setup: Play All is running");
  await ev(() => window.__opnSleep.armMinutes(0.05));
  ok(await ff(() => document.getElementById("audio").paused && window.state.current !== null, 12000),
    "check 12: the timed sleep stop fires and the held track stands");
  const heldId = await cur();
  const f1 = await fillPct(); await sleep(800); const f2 = await fillPct();
  ok((await dockVisible()) && (await dockGlyph()) === "▶" && f1 > 0 && Math.abs(f2 - f1) < 0.05,
    `check 12: dock shows the held track (${heldId}) paused, mid-progress and static (${f1.toFixed(1)}%)`);
  await ev(() => window.__opnSleep.disarm());

  // ---- check 13: sleep end-of-track hold shows the next track unstarted ----
  await reset();
  await page.click('[data-queue="Midday"]');
  ok(await ff(() => window.state.current && window.state.current.episodeId === "seg:Midday" && !document.getElementById("audio").paused),
    "check 13 setup: Midday queue plays its Intentions card");
  await page.click("#dock-next");
  ok(await ff(() => window.state.current && window.state.current.episodeId === "ep-mid-a" && !document.getElementById("audio").paused),
    "check 13 setup: dock next lands ep-mid-a playing");
  await ev(() => window.__opnSleep.armTrack());
  ok(await ff(() => window.state.current && window.state.current.episodeId === "ep-mid-b" && document.getElementById("audio").paused, 20000),
    "check 13: at the track's end the hold loads the next track unstarted");
  ok((await dockVisible()) && (await dockTitle()) === "Midday Long" && (await dockGlyph()) === "▶" && (await fillPct()) === 0,
    "check 13: dock shows the held next track paused at progress 0");

  // ---- checks 14/15: sheets and the Read view cover the dock ----
  await reset();
  await page.click('[data-playkey="ep-alpha"]');
  ok(await ff(() => window.state.current && window.state.current.episodeId === "ep-alpha"), "check 14 setup: ep-alpha loaded");
  await page.click("#sleep-btn");
  await page.waitForSelector(".sheet", { timeout: 8000 });
  const z14 = await ev(() => {
    const sh = document.querySelector(".sheet"); const dk = document.getElementById("dock");
    const r = dk.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { sheetZ: getComputedStyle(sh).zIndex, dockZ: getComputedStyle(dk).zIndex, hitInSheet: !!(hit && hit.closest(".sheet")) };
  });
  ok(z14.sheetZ === "50" && z14.dockZ === "40" && z14.hitInSheet,
    `check 14: the sleep sheet (z ${z14.sheetZ}) covers the dock (z ${z14.dockZ}) — the point at the dock's center hits the sheet`);
  await page.click("#sl-close");
  await page.click('[data-read="ep-alpha"]');
  await page.waitForSelector(".readsheet", { timeout: 8000 });
  const z15 = await ev(() => {
    const sh = document.querySelector(".readsheet"); const dk = document.getElementById("dock");
    return { sheetZ: getComputedStyle(sh).zIndex, dockZ: getComputedStyle(dk).zIndex };
  });
  ok(z15.sheetZ === "50" && z15.dockZ === "40", "check 15: the Read view covers the dock too (z 50 over 40)");
  const wasPaused = await paused();
  await page.click('.readsheet [data-playkey="ep-alpha"]');
  const flipped = await page.waitForFunction((want) => document.getElementById("audio").paused === want, !wasPaused, { timeout: 8000 }).then(() => true).catch(() => false);
  ok(flipped && (await cur()) === "ep-alpha",
    "check 15: the Read view's own play button drives the same track (play state flips, current unchanged)");
  await page.click("[data-readclose]");
  await sleep(400);
  ok((await dockVisible()) && (await dockTitle()) === "Alpha Long",
    "check 15: closing the Read view leaves the dock standing with the current track");

  // ---- checks 16/18: Intentions chip play; jump no-op during a chip play ----
  await reset();
  await page.click('[data-tab="intentions"]');
  await page.waitForSelector("[data-play]", { timeout: 20000 });
  await page.click("[data-play]");
  ok(await ff(() => window.state.current && String(window.state.current.episodeId).startsWith("url:") && !document.getElementById("audio").paused),
    "check 16 setup: an Intentions chip play is running");
  ok((await dockVisible()) && (await dockTitle()) === "Intentions"
    && (await ev(() => document.getElementById("dock-next").disabled)) === true
    && (await ev(() => document.getElementById("dock-meta").textContent)) === (await ev(() => window.state.dateLabel)),
    "check 16: chip play raises the dock titled 'Intentions', next disabled, meta falls back to the day label");
  await page.click("#dock-play");
  ok(await ff(() => document.getElementById("audio").paused), "check 16: the dock's play/pause pauses the chip play");
  await page.click("#dock-play");
  ok(await ff(() => !document.getElementById("audio").paused), "check 16: and resumes it (restart through the standing path)");
  await ev(() => window.scrollTo(0, 150));
  const yBefore = await ev(() => window.scrollY);
  await page.click("#dock");
  await sleep(700);
  ok((await ev(() => window.state.tab)) === "intentions" && Math.abs((await ev(() => window.scrollY)) - yBefore) < 3,
    "check 18: a dock body tap during a chip play is a no-op — tab and scroll unchanged");

  ok(pageErrors === 0, `zero page errors across the whole run (${pageErrors})`);
} catch (e) {
  fails++; console.log("HARNESS ERROR:", e && e.message ? e.message : e);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (app1) app1.kill();
  console.log(`# harness-v326: ${n} checks, ${fails} FAIL`);
  process.exit(fails ? 1 : 0);
}
