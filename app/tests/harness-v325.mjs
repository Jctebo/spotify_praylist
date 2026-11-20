// harness-v325 — the v325 gate (Plan §2.3): Intentions first in
// every block. Payload head per block (multi-episode + empty
// blocks) · empty shape unchanged · rendered DOM head · whole-day
// queue head = seg:Morning · per-block queue head · not-available
// head behavior · nothing else moves (counts · unblocked · resume).
// Built on the harness-v312 mold: scratch wrangler instances INSIDE
// the worktree, synthetic fixture only, tallies read from the
// COMPLETE log.
//
// Port discipline (the v318 Review lesson): sibling harnesses share
// port numbers and a bare waitUp accepts any answering server. This
// harness uses ports 8941/8942 (v312: 8921-8923, v318: 8931) and
// proves the answering server is its own instance: the spawned
// child must still be alive after boot, the fresh store must read
// the named empty shape, and the fixture commit's read-back must
// name this harness's own episode ids.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_CHECKOUT = "/home/hatch/workspace/projects/spotify_praylist-fork";
if (APP.startsWith(SHARED_CHECKOUT)) { console.error("HARD GUARD: harness WT resolves inside the shared fork checkout — refusing"); process.exit(2); }

const PORT = 8941, FEED_PORT = 8942;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v325");
const TOKEN = "harness-token";
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
const F1 = "2027-04-01", F2 = "2027-04-02";
let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixture audio: real MP3 tones via ffmpeg (browser-playable) ----
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v325-audio-"));
function makeMp3(name, seconds, freq) {
  const f = path.join(TMPD, name);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${seconds}`,
    "-codec:a", "libmp3lame", "-b:a", "32k", "-y", f], { stdio: "pipe" });
  return fs.readFileSync(f);
}

// ---- feed server: started, then made unreachable (the mold) ----
const feedServer = http.createServer((req, res) => { res.writeHead(200, { "content-type": "application/rss+xml" }); res.end("<rss></rss>"); });

// ---- seed (the v305/v312 mold: 35 items + the 11-intention pool) ----
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
  const tmp = path.join(APP, `.wrangler-test-v325-${tag}-schema.sql`);
  fs.writeFileSync(tmp, all);
  d1exec(persist, tmp);
}
function startWrangler(port, persist) {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `FEED_URL:http://127.0.0.1:${FEED_PORT}/feed.xml`, "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"];
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
async function pushSegments(date, bytes, skipBlock) {
  for (const b of BLOCKS) {
    if (b === skipBlock) continue;
    const r = await api(BASE, "POST", "/api/agent/prayer/audio",
      { token: TOKEN, raw: bytes, headers: { "x-prayer-date": date, "x-prayer-block": b, "content-type": "audio/mpeg" } });
    if (r.status !== 200) throw new Error(`segment push ${date}/${b} -> ${r.status}`);
  }
}
// Fixture day F1 (Plan §2.3): episodes in five blocks — Morning is
// the multi-episode block; Midmorning has NO episodes; Afternoon is
// the check-6 leg (segment audio absent, first episode missing).
// One unblocked episode for the check-7 group identity.
const F1_EPS = [
  { episode_id: "fx-a1", title: "Fixture Alpha One", block: "Morning", sort: 1, duration_s: 61, file: "a" },
  { episode_id: "fx-a2", title: "Fixture Alpha Two", block: "Morning", sort: 2, duration_s: 62, file: "b" },
  { episode_id: "fx-c", title: "Fixture Midday", block: "Midday", sort: 1, duration_s: 64, file: "c" },
  { episode_id: "fx-d1", title: "Afternoon Missing", block: "Afternoon", sort: 1, duration_s: 65, file: null },
  { episode_id: "fx-d2", title: "Fixture Afternoon", block: "Afternoon", sort: 2, duration_s: 66, file: "d" },
  { episode_id: "fx-e", title: "Fixture Evening", block: "Evening", sort: 1, duration_s: 67, file: "e" },
  { episode_id: "fx-f", title: "Fixture Night", block: "Night", sort: 1, duration_s: 68, file: "f" },
  { episode_id: "fx-u", title: "Unblocked Extra", block: "unblocked", sort: 1, duration_s: 69, file: "u" },
];
const F2_EPS = [
  { episode_id: "fx2-a", title: "Next Day Alpha", block: "Morning", sort: 1, duration_s: 71, file: "a" },
];
function manifestOf(eps, audio) {
  return eps.map((e) => ({
    episode_id: e.episode_id, title: e.title, block: e.block, sort: e.sort, duration_s: e.duration_s,
    size_bytes: e.file ? audio[e.file].length : 0,
    audio_state: e.file ? "present" : "missing",
  }));
}
const keyOf = (t) => (t.intentionsCard ? "card" : t.episodeId);
const epsOfBlock = (eps, block) => eps.filter((e) => e.block === block).sort((x, y) => x.sort - y.sort).map((e) => e.episode_id);

let app1 = null, browser = null;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v325-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "worker bundles clean (esbuild)");

  const audio = {
    a: makeMp3("a.mp3", 0.8, 220), b: makeMp3("b.mp3", 0.8, 330), c: makeMp3("c.mp3", 0.8, 440),
    d: makeMp3("d.mp3", 0.8, 550), e: makeMp3("e.mp3", 0.8, 660), f: makeMp3("f.mp3", 0.8, 770),
    u: makeMp3("u.mp3", 0.8, 880), seg: makeMp3("seg.mp3", 0.8, 262),
  };

  await new Promise((r) => feedServer.listen(FEED_PORT, "127.0.0.1", r));
  applySchema(PERSIST, "main");
  const seedFile = path.join(APP, ".wrangler-test-v325-seed.sql");
  fs.writeFileSync(seedFile, seedSql());
  d1exec(PERSIST, seedFile);
  app1 = startWrangler(PORT, PERSIST);
  const up = await waitUp(BASE);
  // Instance identity (the v318 lesson): the answering server must
  // be THIS child — alive, on this harness's own port — not a
  // sibling harness's instance that happens to answer first.
  ok(up && app1.exitCode === null, "app up on local wrangler (port 8941) and the answering server is this instance (child alive)");
  await new Promise((r) => feedServer.close(r));

  // ---------- Check 2: the empty shape (before any push) ----------
  let r = await api(BASE, "GET", "/api/player/day");
  const empty = r.body;
  ok(empty.storedDay === null && empty.date === null && (empty.episodes || []).length === 0,
    "check 2: with no stored day the payload is the named empty shape (storedDay null, no episodes)");
  ok(empty.blocks.length === 6 && empty.blocks.every((b) => b.tracks.length === 1 && b.tracks[0].intentionsCard === true && b.tracks[0].available === false && b.trackCount === 1),
    "check 2: every block is [card] exactly as today — one not-available Intentions card, trackCount 1");

  // ---------- Fixture push F1 ----------
  await pushSegments(F1, audio.seg, "Afternoon");
  let stageOk = true;
  for (const e of F1_EPS) if (e.file) { const s = await stageEpisode(F1, e.episode_id, audio[e.file]); if (s.status !== 200 || s.body.size !== audio[e.file].length) stageOk = false; }
  ok(stageOk, "setup: episode audio staging POSTs accepted, sizes read back");
  r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: F1, episodes: manifestOf(F1_EPS, audio) } });
  const perTrackIds = (r.body.perTrack || []).map((t) => t.episode_id).sort();
  ok(r.status === 200 && r.body.storedDate === F1 && r.body.rowCount === 8
    && JSON.stringify(perTrackIds) === JSON.stringify(F1_EPS.map((e) => e.episode_id).sort()),
    "setup: F1 commit lands (rowCount 8) and its read-back names this harness's own fixture ids — the instance is this harness's");

  // ---------- Check 1: payload order ----------
  r = await api(BASE, "GET", "/api/player/day");
  const day = r.body;
  ok(day.storedDay === F1 && day.blocks.length === 6, "check 1: payload names the stored fixture day, six blocks");
  ok(day.blocks.every((b) => b.tracks.length > 0 && b.tracks[0].intentionsCard === true),
    "check 1: every block's tracks[0] is the Intentions card — multi-episode, single-episode, and no-episode blocks alike");
  const morning = day.blocks.find((b) => b.block === "Morning");
  ok(JSON.stringify(morning.tracks.map(keyOf)) === JSON.stringify(["card", "fx-a1", "fx-a2"]),
    "check 1: the multi-episode block reads [card, fx-a1, fx-a2] — episode order after the head is the standing sort order");
  const midmorning = day.blocks.find((b) => b.block === "Midmorning");
  ok(midmorning.tracks.length === 1 && midmorning.tracks[0].intentionsCard === true,
    "check 1: the no-episode block is [card] alone, as before");
  ok(day.blocks.every((b) => JSON.stringify(b.tracks.filter((t) => !t.intentionsCard).map((t) => t.episodeId)) === JSON.stringify(epsOfBlock(F1_EPS, b.block))),
    "check 1: every block's episode order after the head equals the manifest sort order, unchanged");

  // ---------- Check 6 (payload leg): the not-available head ----------
  const afternoon = day.blocks.find((b) => b.block === "Afternoon");
  ok(JSON.stringify(afternoon.tracks.map(keyOf)) === JSON.stringify(["card", "fx-d1", "fx-d2"]),
    "check 6: the segment-absent block reads [card, fx-d1, fx-d2] — the missing first episode stands named in place after the card");
  ok(afternoon.tracks[0].available === false && afternoon.tracks[0].streamUrl === null,
    "check 6: the head card stands not-available (available:false, streamUrl:null) when its segment audio is absent");
  const d1 = afternoon.tracks.find((t) => t.episodeId === "fx-d1");
  ok(!!d1 && d1.available === false && d1.streamUrl === null && d1.title === "Afternoon Missing",
    "check 6: the missing first episode stands named after the card, available:false, streamUrl:null");

  // ---------- Check 7 (payload leg): nothing else moves ----------
  const counts = Object.fromEntries(day.blocks.map((b) => [b.block, b.trackCount]));
  ok(counts.Morning === 3 && counts.Midmorning === 1 && counts.Midday === 2 && counts.Afternoon === 3 && counts.Evening === 2 && counts.Night === 2,
    "check 7: trackCounts equal the pre-fix payload's on the same fixture (manifest episodes per block + the one card)");
  const unb = (day.episodes || []).map((t) => [t.episodeId, t.title, "unblocked", t.durationS]);
  ok(JSON.stringify(unb) === JSON.stringify([["fx-u", "Unblocked Extra", "unblocked", 69]]),
    "check 7: the unblocked group is identical — same episode, same shape, no card created");
  // The pre-fix payload by the retired rule (§1 quotes it verbatim:
  // card at index 1 when the block has episodes, else 0). The fixed
  // payload must differ from it ONLY in the card's position: same
  // track multiset per block, same episode subsequence.
  const onlyCardMoved = day.blocks.every((b) => {
    const post = b.tracks.map(keyOf);
    const eps = post.filter((k) => k !== "card");
    const pre = eps.length ? [eps[0], "card", ...eps.slice(1)] : ["card"];
    return JSON.stringify(post.slice().sort()) === JSON.stringify(pre.slice().sort())
      && JSON.stringify(post.filter((k) => k !== "card")) === JSON.stringify(pre.filter((k) => k !== "card"))
      && post[0] === "card";
  });
  ok(onlyCardMoved, "check 7: against the pre-fix order (the retired splice rule) only the card's position changed — same tracks, same episode order, in every block");

  // ---------- Browser boot ----------
  browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#play-all", { timeout: 20000 });

  // ---------- Check 3: rendered DOM head ----------
  const headMap = await page.evaluate(() => {
    const out = {};
    let block = null;
    document.querySelectorAll("#view > *").forEach((el) => {
      if (el.classList && el.classList.contains("blockhead")) {
        block = el.querySelector("[data-queue]").getAttribute("data-queue");
        if (!(block in out)) out[block] = null;
        return;
      }
      if (block && el.hasAttribute && el.hasAttribute("data-card") && out[block] === null) out[block] = el.getAttribute("data-card");
    });
    return out;
  });
  ok(BLOCKS.every((b) => headMap[b] === `seg:${b}`),
    `check 3: the first card under each block header in the rendered DOM is that block's Intentions card (${BLOCKS.map((b) => `${b}=${headMap[b]}`).join(", ")})`);

  // ---------- Check 4: whole-day queue head ----------
  const expectedQueue = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("[data-card]").forEach((c) => out.push(c.getAttribute("data-card")));
    return out;
  });
  await page.click("#play-all");
  await page.waitForFunction(() => {
    const st = window.state;
    return st && st.queue && st.queue.length > 0 && st.current;
  }, null, { timeout: 15000 });
  const queueIds = await page.evaluate(() => window.state.queue.map((d) => d.episodeId));
  ok(JSON.stringify(queueIds) === JSON.stringify(expectedQueue),
    "check 4: the whole-day queue equals the rendered day order, as before");
  ok(queueIds[0] === "seg:Morning", `check 4: the whole-day queue head is seg:Morning (${queueIds[0]})`);
  const firstCurrent = await page.evaluate(() => window.state.current.episodeId);
  ok(firstCurrent === "seg:Morning", "check 4: the playing track after Play All starts is the Morning Intentions");
  await page.evaluate(() => document.getElementById("audio").pause());

  // ---------- Check 5: per-block queue head ----------
  await page.click('[data-queue="Midday"]');
  await page.waitForFunction(() => window.state && window.state.current && window.state.current.episodeId === "seg:Midday", null, { timeout: 15000 });
  ok(true, "check 5: per-block Play All (Midday) starts playing the block's Intentions segment");
  const midQueue = await page.evaluate(() => window.state.queue.map((d) => d.episodeId));
  ok(JSON.stringify(midQueue) === JSON.stringify(["seg:Midday", "fx-c"]),
    `check 5: the per-block queue is ["seg:Midday", "fx-c"] — the segment heads its block's episodes (${midQueue.join(",")})`);
  await page.evaluate(() => document.getElementById("audio").pause());

  // ---------- Check 6 (browser leg): the queue reaches past the head ----------
  await page.click('[data-queue="Afternoon"]');
  await page.waitForFunction(() => window.state && window.state.current && window.state.current.episodeId === "fx-d2", null, { timeout: 15000 });
  const aftQueue = await page.evaluate(() => window.state.queue.map((d) => d.episodeId));
  ok(JSON.stringify(aftQueue) === JSON.stringify(["seg:Afternoon", "fx-d1", "fx-d2"]),
    `check 6: the Afternoon queue holds the not-available head and the missing episode in place (${aftQueue.join(",")})`);
  const aftIdx = await page.evaluate(() => window.state.queueIdx);
  ok(aftIdx === 2, "check 6: the queue reached past the not-available card and the missing episode to the first available track (fx-d2 playing)");
  await page.evaluate(() => document.getElementById("audio").pause());

  // ---------- Check 7 (browser leg): resume, as in harness-v312 check 9 ----------
  await page.evaluate(() => {
    const el = document.getElementById("audio");
    localStorage.setItem("opn-resume-v312", JSON.stringify({ date: "2027-04-01", episodeId: "fx-c", positionS: el.currentTime || 0.5, savedAt: new Date().toISOString() }));
  });
  const savedPos = await page.evaluate(() => JSON.parse(localStorage.getItem("opn-resume-v312")).positionS);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#play-all", { timeout: 20000 });
  ok(await page.locator("#resume-btn").count() === 1, "check 7: reopening on the same stored day offers Resume, as before");
  await page.click("#resume-btn");
  await page.waitForFunction(() => {
    const el = document.getElementById("audio");
    return el.src.includes("fx-c") && el.readyState >= 1;
  }, null, { timeout: 15000 });
  await sleep(600);
  const resumeState = await page.evaluate(() => {
    const el = document.getElementById("audio");
    return { paused: el.paused, t: el.currentTime };
  });
  ok(resumeState.paused === true, "check 7: the resumed track stands paused — no autoplay on open");
  ok(Math.abs(resumeState.t - savedPos) <= 2, `check 7: the resumed position matches the remembered one (${resumeState.t.toFixed(2)}s vs ${Number(savedPos).toFixed(2)}s, within 2s)`);
  for (const e of F2_EPS) if (e.file) await stageEpisode(F2, e.episode_id, audio[e.file]);
  await pushSegments(F2, audio.seg, null);
  r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: F2, episodes: manifestOf(F2_EPS, audio) } });
  ok(r.status === 200 && r.body.storedDate === F2, "check 7: the next day's push lands (F2) for the resume-retirement leg");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#play-all", { timeout: 20000 });
  ok(await page.locator("#resume-btn").count() === 0, "check 7: after a new day's push, the prior day's position is not offered — resume unchanged");
  ok(pageErrors.length === 0, `check 7: the browser boot ran with zero page errors${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
} catch (e) {
  n++; fails++; console.log(`not ok ${n} - harness crashed: ${e.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (app1) app1.kill("SIGTERM");
  await sleep(500);
}
console.log(`TALLY: ${n - fails} ok / ${fails} FAIL (${n} checks)`);
process.exit(fails ? 1 : 0);
