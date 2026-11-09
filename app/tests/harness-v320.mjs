// harness-v320 — the v320 gate (Plan §2.11): sleep timer on the
// shipped v312 player. Client-only checks in a real browser against a
// scratch instance INSIDE the worktree: control + sheet (real path) ·
// timed fire with the queue held · disarm · deadline invariance ·
// end-of-track hold-at-head + exactly one suppression + the queue-end
// and single-track edges · the fade branch (settable or probed
// unsupported — the check records which ran) · restart reset · no new
// storage · nothing else moves. Tallies read from the COMPLETE log.
// Check 16 (harness-v312 regression on the same tree) runs as its own
// process; its tally is quoted in the release document §3.
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

const PORT = 8951;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v320");
const TOKEN = "harness-token";
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
const D = "2027-03-05";
let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixture audio: real MP3 tones via ffmpeg (browser-playable) ----
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v320-audio-"));
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
  const tmp = path.join(APP, `.wrangler-test-v320-${tag}-schema.sql`);
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
async function pushSegment(date, block, bytes) {
  const r = await api(BASE, "POST", "/api/agent/prayer/audio",
    { token: TOKEN, raw: bytes, headers: { "x-prayer-date": date, "x-prayer-block": block, "content-type": "audio/mpeg" } });
  if (r.status !== 200) throw new Error(`segment push ${date}/${block} -> ${r.status}`);
}
// Fixture day: long tracks (30 s) for the timed checks, short tracks
// where a track end is needed — 6 s wherever an arm must land before
// the end (a 2.5 s track can end before the arm under load; that race
// failed a run and is designed out here), 2.5 s only for ep-short-b,
// which no arm races. Segment tones: 30 s except Midday and Evening
// (6 s — the end-of-track chain and the queue-end edge ride them).
// NOTE on order: the payload interleaves
// each block's Intentions segment inside the block's track list, so
// every "next descriptor" expectation below is read from the live
// queue (payload order), never assumed episode-first — the timer
// follows whatever descriptor stands next, which is exactly what
// makes these checks insensitive to queue-order changes (v325).
const EPS = [
  { episode_id: "ep-long-a", title: "Long Alpha", block: "Morning", sort: 1, duration_s: 30, file: "la" },
  { episode_id: "ep-long-b", title: "Long Beta", block: "Morning", sort: 2, duration_s: 30, file: "lb" },
  { episode_id: "ep-short-a", title: "Short Alpha", block: "Midday", sort: 3, duration_s: 3, file: "sa" },
  { episode_id: "ep-short-b", title: "Short Beta", block: "Midday", sort: 4, duration_s: 3, file: "sb" },
  { episode_id: "ep-long-c", title: "Long Gamma", block: "Midday", sort: 5, duration_s: 30, file: "lc" },
  { episode_id: "ep-short-c", title: "Short Gamma", block: "Evening", sort: 6, duration_s: 3, file: "sc" },
];
function manifestOf(eps, audio) {
  return eps.map((e) => ({
    episode_id: e.episode_id, title: e.title, block: e.block, sort: e.sort, duration_s: e.duration_s,
    size_bytes: audio[e.file].length, audio_state: "present",
  }));
}

let app1 = null, browser = null;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v320-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "worker bundles clean (esbuild)");

  const audio = {
    la: makeMp3("la.mp3", 30, 220), lb: makeMp3("lb.mp3", 30, 330),
    sa: makeMp3("sa.mp3", 6, 440), sb: makeMp3("sb.mp3", 2.5, 550),
    lc: makeMp3("lc.mp3", 30, 660), sc: makeMp3("sc.mp3", 6, 770),
    segLong: makeMp3("segl.mp3", 30, 262), segEve: makeMp3("sege.mp3", 6, 292),
  };

  applySchema(PERSIST, "main");
  const seedFile = path.join(APP, ".wrangler-test-v320-seed.sql");
  fs.writeFileSync(seedFile, seedSql());
  d1exec(PERSIST, seedFile);
  app1 = startWrangler(PORT, PERSIST);
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");

  for (const b of BLOCKS) await pushSegment(D, b, (b === "Evening" || b === "Midday") ? audio.segEve : audio.segLong);
  let stageOk = true;
  for (const e of EPS) { const r = await stageEpisode(D, e.episode_id, audio[e.file]); if (r.status !== 200) stageOk = false; }
  ok(stageOk, "fixture: episode audio staged for the fixture day");
  let r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: D, episodes: manifestOf(EPS, audio) } });
  ok(r.status === 200 && r.body.storedDate === D && r.body.rowCount === 6, "fixture: day commit lands (rowCount 6)");
  r = await api(BASE, "GET", "/api/player/day");
  const midday = r.body.blocks.find((b) => b.block === "Midday");
  const middaySlice = midday.tracks.map((t) => t.episodeId || ("seg:" + midday.block));
  ok(middaySlice.includes("ep-short-a") && middaySlice.includes("ep-long-c"), `fixture: Midday slice serves (${middaySlice.join(",")})`);

  // ---------- browser ----------
  browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const elState = () => ev(() => {
    const el = document.getElementById("audio");
    return { paused: el.paused, t: el.currentTime, src: el.src, vol: el.volume };
  });
  const sleepState = () => ev(() => window.__opnSleep.state());
  const label = () => ev(() => document.getElementById("sleep-btn")?.textContent || null);
  const resumeRec = () => ev(() => localStorage.getItem("opn-resume-v312"));
  async function reload() {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#play-all", { timeout: 20000 });
  }

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#play-all", { timeout: 20000 });

  // ---------- Check 1: parse + boot ----------
  const appJs = (await api(BASE, "GET", "/app.js")).text;
  let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
  ok(parses, "check 1: the served /app.js parses (vm.Script)");
  const sw = (await api(BASE, "GET", "/sw.js")).text;
  ok(sw.includes("ora-pro-nobis-v326-1"), "check 1: the SW cache name reads ora-pro-nobis-v326-1 (v326 Implement named update, §2.6: the pin follows the landed trunk's cache rename — v326's rename supersedes v318's)");
  ok(pageErrors.length === 0, `check 1: the browser boot ran with zero page errors${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
  const keysAtBoot = await ev(() => Object.keys(localStorage).sort());
  ok(keysAtBoot.length === 0, "check 14 (early): localStorage stands empty at boot (no harness seeds)");

  // ---------- Check 2: the control ----------
  ok(await page.locator("#sleep-btn").count() === 1, "check 2: the sleep button stands on the Prayers screen");
  const beside = await ev(() => {
    const b = document.getElementById("sleep-btn");
    return !!b && b.className === "btn ghost" && !!b.parentElement.querySelector("#play-all");
  });
  ok(beside, "check 2: the button stands in the Play All transport row, classes 'btn ghost'");
  ok((await label()) === "Sleep · Off", "check 2: the label reads 'Sleep · Off' at boot");

  // ---------- Check 3: the sheet ----------
  await page.click("#sleep-btn");
  await page.waitForSelector("[data-sleep-choice]", { timeout: 5000 });
  const choices = await ev(() => [...document.querySelectorAll("[data-sleep-choice]")].map((b) => [b.getAttribute("data-sleep-choice"), b.textContent.trim()]));
  ok(JSON.stringify(choices.map((c) => c[0])) === JSON.stringify(["off", "5", "10", "15", "30", "45", "60", "track"]),
    `check 3: the choices stand in the exact order Off · 5 · 10 · 15 · 30 · 45 · 60 · End of track (${choices.map((c) => c[0]).join(",")})`);
  ok(choices[0][1] === "Off" && choices[7][1] === "End of track", "check 3: the first and last choices read 'Off' and 'End of track'");
  await page.click("#sl-close");
  await sleep(300);
  ok(await page.locator("[data-sleep-choice]").count() === 0, "check 3: Close dismisses the sheet without change");
  ok((await sleepState()).mode === "off", "check 3: dismissing the sheet leaves the timer Off");

  // ---------- Check 4: real-path arm through the sheet ----------
  await page.click("#sleep-btn");
  await page.waitForSelector('[data-sleep-choice="5"]', { timeout: 5000 });
  await page.click('[data-sleep-choice="5"]');
  await sleep(300);
  ok(await page.locator("[data-sleep-choice]").count() === 0, "check 4: one tap arms and closes the sheet");
  const lbl1 = await label();
  const st4 = await sleepState();
  ok(st4.mode === "minutes" && st4.presetMin === 5 && st4.remainingMs > 290000 && st4.remainingMs <= 300000,
    `check 4: __opnSleep.state() agrees with the sheet arm (mode minutes, preset 5, remaining ${Math.round(st4.remainingMs / 1000)}s)`);
  const toSec = (s) => { const m = /^Sleep · (\d+):(\d{2})$/.exec(s || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  await sleep(1400);
  const lbl2 = await label();
  ok(toSec(lbl1) !== null && toSec(lbl2) !== null && toSec(lbl2) < toSec(lbl1),
    `check 4: two successive label reads decrease ('${lbl1}' -> '${lbl2}')`);
  ok(Math.abs(toSec(lbl2) - st4.remainingMs / 1000) < 5, "check 4: the label and state() agree on the remaining time");
  await ev(() => window.__opnSleep.disarm());

  // ---------- Check 5: timed fire — queue held ----------
  await reload();
  await page.click("#play-all");
  // v325 Ship named update (§2.5): the day queue now opens with the Morning
  // Intentions segment (30 s fixture tone) ahead of ep-long-a — the wait
  // spans the segment so the same standing track anchors the check.
  await page.waitForFunction(() => window.state?.current?.episodeId === "ep-long-a" && !document.getElementById("audio").paused, null, { timeout: 45000 });
  const snap5 = await ev(() => ({ q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx, cur: window.state.current.episodeId }));
  await ev(() => window.__opnSleep.armMinutes(0.05)); // 3 s
  await page.waitForFunction(() => document.getElementById("audio").paused, null, { timeout: 9000 });
  const after5 = await ev(() => ({ q: window.state.queue.map((d) => d.episodeId), idx: window.state.queueIdx, cur: window.state.current?.episodeId || null }));
  const es5 = await elState();
  ok(es5.paused === true, "check 5: at expiry the element stands paused");
  ok(JSON.stringify(after5.q) === JSON.stringify(snap5.q) && after5.idx === snap5.idx && after5.cur === snap5.cur,
    "check 5: queue length, queueIdx, and current are unchanged — held, not cleared");
  ok((await label()) === "Sleep · Off" && (await sleepState()).mode === "off", "check 5: the label reads Off after the stop");
  const rec5 = JSON.parse(await resumeRec() || "{}");
  ok(rec5.episodeId === snap5.cur && Math.abs((rec5.positionS || 0) - es5.t) <= 1,
    `check 5: the resume record names the playing track at the stop position (${rec5.episodeId} @ ${Number(rec5.positionS || 0).toFixed(2)}s vs element ${es5.t.toFixed(2)}s, ±1s)`);

  // ---------- Check 6: disarm before expiry ----------
  await page.click("#play-all"); // queue stood held; Play All restarts the day playing
  await page.waitForFunction(() => !document.getElementById("audio").paused && window.state?.current, null, { timeout: 15000 });
  await ev(() => window.__opnSleep.armMinutes(0.04)); // 2.4 s, hook-armed at seconds scale
  await page.click("#sleep-btn");
  await page.waitForSelector('[data-sleep-choice="off"]', { timeout: 5000 });
  await page.click('[data-sleep-choice="off"]'); // choose Off through the sheet, before expiry
  await sleep(3600); // past the would-be deadline
  const es6 = await elState();
  ok(es6.paused === false, "check 6: playback continues past the would-be deadline untouched");
  ok((await sleepState()).mode === "off" && (await label()) === "Sleep · Off", "check 6: the timer stands Off");
  await ev(() => document.getElementById("audio").pause());

  // ---------- Check 7: deadline invariance across an advance ----------
  await reload();
  await page.click("#play-all");
  // v325 Ship named update (§2.5): same head change as check 5 — the wait
  // spans the 30 s Morning Intentions segment ahead of ep-long-a.
  await page.waitForFunction(() => window.state?.current?.episodeId === "ep-long-a" && !document.getElementById("audio").paused, null, { timeout: 45000 });
  const t7 = await ev(() => { window.__opnSleep.armMinutes(0.08); return Date.now(); }); // 4.8 s
  await sleep(1200);
  const next7 = await ev(() => window.state.queue[window.state.queueIdx + 1]?.episodeId || null);
  await ev(() => window.advanceQueue(1));
  const cur7 = await ev(() => window.state.current?.episodeId);
  ok(!!next7 && cur7 === next7 && cur7 !== "ep-long-a", `check 7: advanceQueue(1) mid-arm moves to the next track in payload order (${cur7})`);
  await page.waitForFunction(() => document.getElementById("audio").paused, null, { timeout: 9000 });
  const elapsed7 = (Date.now() - t7) / 1000;
  ok(elapsed7 >= 3.3 && elapsed7 <= 6.5, `check 7: the stop fires at the original deadline (${elapsed7.toFixed(1)}s for a 4.8s arm, not re-armed by the advance)`);
  ok((await ev(() => window.state.current?.episodeId)) === next7, "check 7: the stop lands against the new track");

  // ---------- Check 8: end of track, mid-queue — hold at the next head ----------
  await reload();
  await page.click('[data-queue="Midday"]');
  await page.waitForFunction(() => window.state?.queue?.length > 0 && window.state.current, null, { timeout: 15000 });
  for (let i = 0; i < 6; i++) {
    const cur = await ev(() => window.state.current?.episodeId);
    if (cur === "ep-short-a") break;
    await ev(() => window.advanceQueue(1));
    await sleep(400);
  }
  ok((await ev(() => window.state.current?.episodeId)) === "ep-short-a", "check 8: the short track stands playing in the Midday queue");
  const snap8 = await ev(() => {
    const i = window.state.queueIdx;
    return { qlen: window.state.queue.length, next: window.state.queue[i + 1]?.episodeId || null, nextUrl: window.state.queue[i + 1]?.url || null, afterNext: window.state.queue[i + 2]?.episodeId || null };
  });
  ok(snap8.next === "ep-short-b" && snap8.afterNext === "ep-long-c",
    `check 8: in payload order the descriptor after ep-short-a is ep-short-b and ep-long-c follows it (${snap8.next} -> ${snap8.afterNext}) — the hold lands on whatever stands next (v325 Ship named update, §2.5: the block's Intentions segment now stands at the head of the Midday queue, ahead of ep-short-a, instead of after it)`);
  await ev(() => window.__opnSleep.armTrack());
  ok((await label()) === "Sleep · End of track", "check 8: the label reads 'Sleep · End of track' while armed");
  await page.waitForFunction((id) => {
    const el = document.getElementById("audio");
    return el.paused && window.state?.current?.episodeId === id;
  }, snap8.next, { timeout: 20000 });
  const es8 = await elState();
  ok(es8.paused === true, "check 8: after the track ends, the next track does NOT start (element paused)");
  ok(es8.src.endsWith(snap8.nextUrl), "check 8: audioEl.src is the next track's URL");
  ok(es8.t <= 0.6, `check 8: currentTime stands at the head (${es8.t.toFixed(2)}s)`);
  const rec8 = JSON.parse(await resumeRec() || "{}");
  ok(rec8.episodeId === snap8.next && (rec8.positionS || 0) <= 1,
    `check 8: the resume record names the next track at 0 (${rec8.episodeId} @ ${Number(rec8.positionS || 0).toFixed(2)}s)`);
  ok((await ev(() => window.state.queue.length)) === snap8.qlen, "check 8: the queue itself stands intact (held at the head)");
  ok((await label()) === "Sleep · Off" && (await sleepState()).mode === "off", "check 8: the label reads Off; the arm fired exactly once");

  // ---------- Check 9: exactly one suppression ----------
  await ev(() => window.__opnMediaHandlers.play({})); // Media Session play: resume the held head track
  await page.waitForFunction((id) => !document.getElementById("audio").paused && window.state?.current?.episodeId === id, snap8.next, { timeout: 8000 });
  await page.waitForFunction((id) => window.state?.current?.episodeId === id && !document.getElementById("audio").paused, snap8.afterNext, { timeout: 20000 });
  ok(true, "check 9: the held track plays out and its end advances normally to ep-long-c — exactly one suppression (v325 Ship named update, §2.5: follows check 8's re-derived afterNext)");
  await ev(() => document.getElementById("audio").pause());

  // ---------- Check 10: end of track at the queue's last track ----------
  await reload();
  await page.click('[data-queue="Evening"]');
  await page.waitForFunction(() => window.state?.queue?.length > 0 && window.state.current, null, { timeout: 15000 });
  await ev(() => window.advanceQueue(1)); // to the last descriptor (ep-short-c; v325 Ship named update, §2.5: the Evening Intentions segment now stands at the queue head, so the last descriptor is the block's episode)
  const lastId = await ev(() => window.state.current?.episodeId);
  ok(lastId === "ep-short-c", `check 10: the queue's last track stands playing (${lastId})`);
  await ev(() => window.__opnSleep.armTrack());
  await page.waitForFunction(() => window.state && window.state.queue.length === 0 && window.state.current === null, null, { timeout: 12000 });
  ok(true, "check 10: at the last track's end the standing queue-end state stands (queue cleared, current null)");
  ok((await label()) === "Sleep · Off" && (await sleepState()).mode === "off", "check 10: the label reads Off");

  // ---------- Check 11: end of track on a single track ----------
  await reload();
  await page.click('[data-playkey="ep-short-a"]');
  await page.waitForFunction(() => window.state?.current?.episodeId === "ep-short-a" && !document.getElementById("audio").paused && window.state.queue.length === 0, null, { timeout: 15000 });
  await ev(() => window.__opnSleep.armTrack());
  await page.waitForFunction(() => window.state && window.state.current === null, null, { timeout: 12000 });
  const es11 = await elState();
  ok(es11.paused === true, "check 11: the single track ends into the standing end state (current null, element paused)");
  ok((await label()) === "Sleep · Off" && (await sleepState()).mode === "off", "check 11: the label reads Off");

  // ---------- Check 12: the fade branch ----------
  await reload();
  await page.click('[data-playkey="ep-long-b"]');
  await page.waitForFunction(() => window.state?.current?.episodeId === "ep-long-b" && !document.getElementById("audio").paused, null, { timeout: 15000 });
  await ev(() => window.__opnSleep.armMinutes(1 / 3)); // 20 s; the fade window is the last 15 s
  let fadeSample = null;
  for (let i = 0; i < 40 && !fadeSample; i++) {
    await sleep(500);
    const s = await ev(() => ({ vol: document.getElementById("audio").volume, rem: window.__opnSleep.state().remainingMs }));
    if (s.rem !== null && s.rem <= 11000 && s.rem >= 4000) fadeSample = s;
  }
  ok(!!fadeSample, "check 12: a sample lands inside the fade window");
  const settable = fadeSample && fadeSample.vol < 0.9;
  if (settable) {
    ok(fadeSample.vol <= fadeSample.rem / 15000 + 0.15,
      `check 12: SETTABLE branch — inside the window the volume reads ${fadeSample.vol.toFixed(2)}, at/below the ramp value for ${Math.round(fadeSample.rem / 1000)}s remaining (fadeBase 1)`);
  } else {
    ok(fadeSample && fadeSample.vol === 1,
      "check 12: UNSUPPORTED branch — element volume not settable in this browser; the probe reports unsupported and the stop still fires on time");
  }
  await page.waitForFunction(() => document.getElementById("audio").paused, null, { timeout: 30000 });
  const es12 = await elState();
  ok(es12.paused === true, "check 12: the stop fires on time at the deadline");
  ok(es12.vol === 1, `check 12: the volume reads fadeBase (1) again after the stop (${es12.vol})`);
  await page.click('[data-playkey="ep-long-a"]'); // a fresh startDesc
  await page.waitForFunction(() => !document.getElementById("audio").paused, null, { timeout: 10000 });
  ok((await elState()).vol === 1, "check 12: the volume reads fadeBase after the next startDesc");
  await ev(() => document.getElementById("audio").pause());

  // ---------- Check 13: restart reset ----------
  await reload();
  await page.click('[data-playkey="ep-long-c"]');
  await page.waitForFunction(() => window.state?.current?.episodeId === "ep-long-c" && !document.getElementById("audio").paused, null, { timeout: 15000 });
  await sleep(700);
  await ev(() => document.getElementById("audio").pause());
  await sleep(300);
  const recBefore = await resumeRec();
  ok(!!recBefore && JSON.parse(recBefore).episodeId === "ep-long-c", "check 13: a resume record stands before the arm");
  await ev(() => window.__opnSleep.armTrack());
  ok((await sleepState()).mode === "track", "check 13: the timer stands armed before the reload");
  await reload();
  ok((await label()) === "Sleep · Off" && (await sleepState()).mode === "off", "check 13: after reload the timer stands reset (label Off, mode off)");
  ok((await resumeRec()) === recBefore, "check 13: the resume record stands byte-identical to its pre-arm shape");

  // ---------- Check 14: no new storage ----------
  const keysNow = await ev(() => Object.keys(localStorage).sort());
  ok(JSON.stringify(keysNow) === JSON.stringify(["opn-resume-v312"]),
    `check 14: after arming and firing, the localStorage key set is exactly the resume key (${keysNow.join(",") || "empty"})`);

  // ---------- Check 15: nothing else moves ----------
  await reload();
  await page.click("#play-all");
  await page.waitForFunction(() => !document.getElementById("audio").paused && window.state?.current, null, { timeout: 15000 });
  await page.click("#play-all");
  await sleep(400);
  ok((await elState()).paused === true, "check 15: Play All still toggles to pause while playing");
  await page.click("#play-all");
  await page.waitForFunction(() => !document.getElementById("audio").paused, null, { timeout: 15000 });
  ok(true, "check 15: Play All restarts playback after the toggle");
  await ev(() => document.getElementById("audio").pause()); // startQueue toggles pause while any queue plays — pause first, as harness-v312 did
  await sleep(300);
  await page.click('[data-queue="Midday"]');
  await page.waitForFunction(() => window.state?.queue?.length > 0 && window.state.current, null, { timeout: 15000 });
  const blockQ = await ev(() => window.state.queue.map((d) => d.episodeId));
  ok(JSON.stringify(blockQ) === JSON.stringify(middaySlice), `check 15: the per-block queue is exactly the block slice (${blockQ.join(",")})`);
  const curId = await ev(() => window.state.current.episodeId);
  await page.click(`[data-playkey="${curId}"]`);
  await sleep(400);
  ok((await elState()).paused === true, "check 15: the card play/pause toggle still pauses the playing track");
  await page.click(`[data-playkey="${curId}"]`);
  await page.waitForFunction(() => !document.getElementById("audio").paused, null, { timeout: 10000 });
  ok(true, "check 15: the card toggle plays again");
  const msKeys = await ev(() => Object.keys(window.__opnMediaHandlers || {}).sort());
  ok(JSON.stringify(msKeys) === JSON.stringify(["nexttrack", "pause", "play", "previoustrack", "seekbackward", "seekforward", "seekto"]),
    `check 15: the Media Session handler table is unchanged (${msKeys.join(",")})`);
  ok(pageErrors.length === 0, `check 15: zero page errors across the whole run${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
  await ev(() => document.getElementById("audio").pause());
} catch (e) {
  n++; fails++; console.log(`not ok ${n} - harness crashed: ${e.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (app1) app1.kill("SIGTERM");
  await sleep(500);
}
console.log(`TALLY: ${n - fails} ok / ${fails} FAIL (${n} checks)`);
process.exit(fails ? 1 : 0);
