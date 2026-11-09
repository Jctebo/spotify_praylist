// harness-v324 — the v324 gate, Worker/client leg (Plan §2.11,
// checks 16-26). The resolver leg (checks 1-15) stands in
// app/tests/resolver-leg-v324.py. Infrastructure follows the
// harness-v325 mold exactly (estate wrangler, --config, LOCAL_DEV,
// ffmpeg fixture tones, POST staging routes); the browser is system
// Chrome via puppeteer-core.
//
// External "enclosure" audio is served by a tiny tone server on a
// second port — the app never fetches it server-side; only the
// browser's audio element does, exactly as in production.
//
// HARD GUARD (the estate's): the harness refuses to run from the
// shared checkout — it runs only inside a worktree.
// Run: node app/tests/harness-v324.mjs   (log: tests/v324-gate.log)
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WT = path.resolve(APP, "..");
const SHARED_CHECKOUT = "/home/hatch/workspace/projects/spotify_praylist-fork";
if (APP.startsWith(SHARED_CHECKOUT)) { console.error("HARD GUARD: harness WT resolves inside the shared fork checkout — refusing"); process.exit(2); }
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const ESBUILD = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild";
const PORT = 8961, FEED_PORT = 8962;
const BASE = `http://127.0.0.1:${PORT}`;
const FEED = `http://127.0.0.1:${FEED_PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v324");
const TOKEN = "harness-token";
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
const results = [];
function ok(cond, label) { results.push([label, !!cond]); console.log(`${cond ? "ok" : "FAIL"} - ${label}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixture audio: real MP3 tones via ffmpeg (browser-playable) ----
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v324-audio-"));
function makeMp3(name, seconds, freq) {
  const f = path.join(TMPD, name);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${seconds}`,
    "-codec:a", "libmp3lame", "-b:a", "32k", "-y", f], { stdio: "pipe" });
  return fs.readFileSync(f);
}

// ---- the "feed enclosure" tone server (external audio host) ----
let extTone = null;
const feedServer = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "audio/mpeg", "content-length": extTone.length, "accept-ranges": "bytes" });
  res.end(extTone);
});

// ---- seed (the v305/v312/v325 mold: 35 items + the 11-intention pool) ----
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
function applySchema(persist) {
  fs.rmSync(persist, { recursive: true, force: true });
  const all = fs.readdirSync(path.join(APP, "migrations")).filter((x) => x.endsWith(".sql")).sort()
    .map((f) => fs.readFileSync(path.join(APP, "migrations", f), "utf8")).join("\n");
  const tmp = path.join(APP, ".wrangler-test-v324-schema.sql");
  fs.writeFileSync(tmp, all);
  d1exec(persist, tmp);
}
function startWrangler(port, persist) {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"];
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
async function pushSegments(date, bytes) {
  for (const b of BLOCKS) {
    const r = await api(BASE, "POST", "/api/agent/prayer/audio",
      { token: TOKEN, raw: bytes, headers: { "x-prayer-date": date, "x-prayer-block": b, "content-type": "audio/mpeg" } });
    if (r.status !== 200) throw new Error(`segment push ${date}/${b} -> ${r.status}`);
  }
}

const SLOT_BLOCK = { "ext-invitatory": "Morning", "ext-morning-prayer": "Morning", "ext-bible-in-a-year": "Morning",
  "ext-midmorning-prayer": "Midmorning", "ext-midday-prayer": "Midday", "ext-midafternoon-prayer": "Afternoon",
  "ext-office-of-readings": "Evening", "ext-evening-prayer": "Evening", "ext-night-prayer": "Night" };
const SLOT_SRC = { "ext-invitatory": "Divine Office", "ext-morning-prayer": "Divine Office", "ext-bible-in-a-year": "Bible in a Year",
  "ext-midmorning-prayer": "Divine Office", "ext-midday-prayer": "Divine Office", "ext-midafternoon-prayer": "Divine Office",
  "ext-office-of-readings": "Divine Office", "ext-evening-prayer": "Divine Office", "ext-night-prayer": "Divine Office" };
const SLOT_ORDER = Object.keys(SLOT_BLOCK);
function extEntry(slot, present, title) {
  const i = SLOT_ORDER.indexOf(slot);
  return { episode_id: slot, title: title || slot, block: SLOT_BLOCK[slot], sort: 901 + i,
    duration_s: present ? 180 : 0, size_bytes: present ? 12345 : 0,
    audio_state: present ? "present" : "missing", text_state: "missing",
    kind: "external", source: SLOT_SRC[slot], stream_url: present ? `${FEED}/${slot}.mp3` : "" };
}
function extSet(presentMap, titles = {}) {
  return SLOT_ORDER.map((s) => extEntry(s, !!presentMap[s], titles[s]));
}
const ALL_PRESENT = Object.fromEntries(SLOT_ORDER.map((s) => [s, true]));

async function commitDay(date, ownEps, externals, audio) {
  await pushSegments(date, audio.seg);
  const manifest = [];
  for (const e of ownEps) {
    if (e.present) {
      const s = await stageEpisode(date, e.id, audio.tone);
      if (s.status !== 200) throw new Error(`episode stage ${e.id} -> ${s.status}`);
    }
    manifest.push({ episode_id: e.id, title: e.title, block: e.block, sort: e.sort,
      duration_s: 30, size_bytes: e.present ? audio.tone.length : 777, audio_state: e.present ? "present" : "missing",
      text_state: "missing" });
  }
  return api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date, episodes: [...manifest, ...externals] } });
}
const dayPayload = async () => (await api(BASE, "GET", "/api/player/day")).body;
const storedDay = async () => (await api(BASE, "GET", "/api/agent/player/stored-day", { token: TOKEN })).body;
const blockTracks = (payload, block) => (payload.blocks.find((b) => b.block === block) || { tracks: [] }).tracks;
const keyOf = (t) => (t.intentionsCard ? "card" : t.episodeId);

let app1 = null, browser = null;
try {
  execFileSync(ESBUILD, [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v324-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "setup: the Worker bundles clean (esbuild) — migration 0009's tree compiles");

  const audio = { tone: makeMp3("tone.mp3", 0.8, 330), seg: makeMp3("seg.mp3", 0.8, 262) };
  extTone = makeMp3("ext.mp3", 3, 440);
  await new Promise((r) => feedServer.listen(FEED_PORT, "127.0.0.1", r));
  applySchema(PERSIST);
  const seedFile = path.join(APP, ".wrangler-test-v324-seed.sql");
  fs.writeFileSync(seedFile, seedSql());
  d1exec(PERSIST, seedFile);
  app1 = startWrangler(PORT, PERSIST);
  const up = await waitUp(BASE);
  ok(up && app1.exitCode === null, "setup: app up on local wrangler (port 8961), this instance answering");

  // own-instance proof: the empty stored-day shape, extended by v324
  const empty = await storedDay();
  ok(empty.storedDate === null && empty.episodeCount === 0 && empty.externalsPresent === 0 && empty.externalsMissing === 0,
    "own-instance proof: the empty stored-day shape carries the v324 externals counts at 0");

  // ---------- check 16: 0009 on the post-0008 schema; v312 manifest unchanged ----------
  const F1 = "2026-11-12";
  let r = await commitDay(F1, [{ id: "f1-a", title: "F1 Morning", block: "Morning", sort: 1, present: true }], [], audio);
  ok(r.status === 200 && r.body.ok, `check 16: a v312-shaped manifest (no kind fields) still commits (${r.status})`);
  let p = await dayPayload();
  const f1a = blockTracks(p, "Morning").find((t) => t.episodeId === "f1-a");
  ok(f1a && f1a.kind === "episode", "check 16: the committed row reads back kind 'episode' (the 0009 default)");
  r = await api(BASE, "POST", "/api/agent/player/externals", { token: TOKEN, json: { date: F1, tracks: extSet({}) } });
  ok(r.status === 200 && r.body.ok, `check 16: migration 0009 stands — the externals route writes kind='external' rows (${r.status})`);
  p = await dayPayload();
  ok(blockTracks(p, "Night").some((t) => t.episodeId === "ext-night-prayer" && t.kind === "external"),
    "check 16: the external rows render in the payload with kind 'external'");

  // ---------- check 17: the verification split ----------
  const F2 = "2026-11-13";
  const f2Own = [
    { id: "f2-morning", title: "F2 Morning Prayer", block: "Morning", sort: 1, present: true },
    { id: "f2-mid", title: "F2 Novena", block: "Midmorning", sort: 1, present: true },
  ];
  const f2Ext = extSet({ ...ALL_PRESENT, "ext-bible-in-a-year": false },
    { "ext-bible-in-a-year": "Bible in a Year — Day 314" });
  r = await commitDay(F2, f2Own, f2Ext, audio);
  ok(r.status === 200 && r.body.ok, `check 17: a day whose external rows carry NO staged objects commits (${r.status})`);
  await stageEpisode("2026-11-14", "bad-ep", audio.tone);
  r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: "2026-11-14", episodes: [
    { episode_id: "bad-ep", title: "Bad", block: "Morning", sort: 1, duration_s: 30, size_bytes: 999999, audio_state: "present", text_state: "missing" }] } });
  const sdAfterBad = await storedDay();
  ok(r.status === 409 && sdAfterBad.storedDate === F2,
    `check 17: an own episode claiming a wrong staged size still refuses the whole commit 409, nothing written (${r.status}, stored ${sdAfterBad.storedDate})`);

  // ---------- checks 18/19: payload order + shape ----------
  p = await dayPayload();
  const morningKeys = blockTracks(p, "Morning").map(keyOf);
  ok(JSON.stringify(morningKeys) === JSON.stringify(["card", "f2-morning", "ext-invitatory", "ext-morning-prayer", "ext-bible-in-a-year"]),
    `check 18: Morning order — Intentions card, own episodes, externals in slot order (${morningKeys.join(",")})`);
  const midKeys = blockTracks(p, "Midmorning").map(keyOf);
  ok(JSON.stringify(midKeys) === JSON.stringify(["card", "f2-mid", "ext-midmorning-prayer"]),
    `check 18: Midmorning order — Intentions card, own, external (${midKeys.join(",")})`);
  const inv = blockTracks(p, "Morning").find((t) => t.episodeId === "ext-invitatory");
  const bible = blockTracks(p, "Morning").find((t) => t.episodeId === "ext-bible-in-a-year");
  ok(inv.kind === "external" && inv.source === "Divine Office" && inv.available === true
    && inv.streamUrl === `${FEED}/ext-invitatory.mp3` && inv.hasText === false && inv.textUrl === null,
    "check 19: a present external's payload shape (kind, source, streamUrl = the enclosure URL, hasText false)");
  ok(bible.available === false && bible.streamUrl === null && bible.source === "Bible in a Year" && bible.hasText === false,
    "check 19: a missing external stands unavailable with streamUrl null and its primary source named");

  // ---------- check 23 (first half): stored-day counts ----------
  let sd = await storedDay();
  ok(sd.episodeCount === 11 && sd.externalsPresent === 8 && sd.externalsMissing === 1,
    `check 23: stored-day counts own + 9 (episodes ${sd.episodeCount}, externals ${sd.externalsPresent}/${sd.externalsMissing})`);

  // ---------- check 21 (+ 23 second half): the morning fill-in ----------
  const ownBefore = JSON.stringify(blockTracks(p, "Morning").filter((t) => t.kind === "episode"));
  const segBefore = JSON.stringify(p.blocks.map((b) => [b.block, b.tracks.filter((t) => t.intentionsCard).length]));
  const fill = extSet(ALL_PRESENT, { "ext-bible-in-a-year": "Bible in a Year — Day 314: The Ark" });
  r = await api(BASE, "POST", "/api/agent/player/externals", { token: TOKEN, json: { date: F2, tracks: fill } });
  ok(r.status === 200 && JSON.stringify(r.body.filled) === JSON.stringify(["ext-bible-in-a-year"]),
    `check 21: the externals route fills exactly the missing slot (${r.status}, filled ${JSON.stringify(r.body.filled)})`);
  p = await dayPayload();
  const bibleAfter = blockTracks(p, "Morning").find((t) => t.episodeId === "ext-bible-in-a-year");
  ok(bibleAfter.available === true && bibleAfter.streamUrl === `${FEED}/ext-bible-in-a-year.mp3`,
    "check 21: after the fill-in the slot stands available on its enclosure URL");
  ok(JSON.stringify(blockTracks(p, "Morning").filter((t) => t.kind === "episode")) === ownBefore
    && JSON.stringify(p.blocks.map((b) => [b.block, b.tracks.filter((t) => t.intentionsCard).length])) === segBefore,
    "check 21: own episode rows and the day's segments are untouched by the swap");
  sd = await storedDay();
  ok(sd.episodeCount === 11 && sd.externalsPresent === 9 && sd.externalsMissing === 0,
    `check 23: after the fill-in the counts move by the filled count only (episodes ${sd.episodeCount}, externals ${sd.externalsPresent}/${sd.externalsMissing})`);

  // ---------- check 22: the route's guards ----------
  r = await api(BASE, "POST", "/api/agent/player/externals", { token: TOKEN, json: { date: "2026-11-12", tracks: fill } });
  const guardDate = r.status;
  r = await api(BASE, "POST", "/api/agent/player/externals", { token: TOKEN, json: { date: F2, tracks: fill.slice(0, 8) } });
  const guardSet = r.status;
  const kindLie = fill.map((t) => ({ ...t, kind: "episode" }));
  r = await api(BASE, "POST", "/api/agent/player/externals", { token: TOKEN, json: { date: F2, tracks: kindLie } });
  p = await dayPayload();
  const bibleKind = blockTracks(p, "Morning").find((t) => t.episodeId === "ext-bible-in-a-year").kind;
  ok(guardDate === 409 && guardSet === 400 && r.status === 200 && bibleKind === "external",
    `check 22: guards — wrong date 409, wrong slot set 400, a body's kind field ignored (stored rows stay 'external') (${guardDate}/${guardSet}/${r.status})`);

  // ---------- check 24: one-day retention reaches the external rows ----------
  const F3 = "2026-11-14";
  const f3Own = [
    { id: "f3-morning", title: "F3 Morning Prayer", block: "Morning", sort: 1, present: true },
    { id: "f3-mid", title: "F3 Novena", block: "Midmorning", sort: 1, present: true },
  ];
  const f3Ext = extSet({ ...ALL_PRESENT, "ext-morning-prayer": false });
  r = await commitDay(F3, f3Own, f3Ext, audio);
  sd = await storedDay();
  const pOld = await dayPayload(); // the stored day is the only day served
  const f2AudioRes = await api(BASE, "GET", `/api/player/audio/${F2}/f2-morning`);
  ok(r.status === 200 && sd.storedDate === F3 && pOld.date === F3 && f2AudioRes.status === 404,
    `check 24: the next day's commit retires the prior day entire — external rows included (stored ${sd.storedDate}, served ${pOld.date}, prior-day audio ${f2AudioRes.status})`);

  // ---------- check 20: client render + queue + sleep on externals ----------
  const clientJs = (await api(BASE, "GET", "/app.js")).text;
  let parses = true; try { new vm.Script(clientJs); } catch { parses = false; }
  ok(parses && clientJs.includes("Not available today") && clientJs.includes("Plays here · "),
    "check 20: the served client parses and carries the external render branch");
  browser = await chromium.launch({ executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#play-all", { timeout: 20000 });
  const cards = await page.evaluate(() => {
    const grab = (id) => { const el = document.querySelector(`[data-card="${id}"]`); return el ? el.textContent : null; };
    return { missing: grab("ext-morning-prayer"), present: grab("ext-invitatory") };
  });
  ok(cards.missing && cards.missing.includes("Not available today"),
    "check 20: a missing external's card reads 'Not available today'");
  ok(cards.present && cards.present.includes("Divine Office"),
    "check 20: a present external's card names its source in the meta line");
  await page.click("#play-all");
  await page.waitForFunction(() => window.state && window.state.queue && window.state.queue.length > 0, null, { timeout: 15000 });
  const queueIds = await page.evaluate(() => window.state.queue.map((d) => d.episodeId));
  // The standing queue model (v312 check 6): the queue holds every
  // track in payload order, unavailable ones included — the advance
  // rules skip an unavailable track at reach. The missing external
  // stands in the queue between ext-invitatory and ext-bible-in-a-year,
  // and the advance leg below proves it is passed over.
  const expectedQueue = ["seg:Morning", "f3-morning", "ext-invitatory", "ext-morning-prayer", "ext-bible-in-a-year",
    "seg:Midmorning", "f3-mid", "ext-midmorning-prayer", "seg:Midday", "ext-midday-prayer",
    "seg:Afternoon", "ext-midafternoon-prayer", "seg:Evening", "ext-office-of-readings", "ext-evening-prayer",
    "seg:Night", "ext-night-prayer"];
  ok(JSON.stringify(queueIds) === JSON.stringify(expectedQueue),
    `check 20: Play All's queue holds the externals in payload order, the missing one standing in place (${queueIds.join(",")})`);
  await page.waitForFunction(() => window.state && window.state.current && window.state.current.episodeId === "ext-bible-in-a-year"
    && !document.getElementById("audio").paused, null, { timeout: 45000 });
  ok(true, "check 20: autoplay advanced own → external, passing over the missing external at reach (the enclosure URL plays here)");
  await page.evaluate(() => window.__opnSleep.armMinutes(0.02)); // ~1.2 s
  await page.waitForFunction(() => document.getElementById("audio").paused, null, { timeout: 9000 });
  const heldAt = await page.evaluate(() => window.state.current && window.state.current.episodeId);
  ok(heldAt === "ext-bible-in-a-year",
    `check 20: the sleep stop lands on an external track as on any track (held at ${heldAt})`);
  ok(pageErrors.length === 0, `check 20: zero page errors across the browser leg${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
  await browser.close(); browser = null;

  // ---------- check 25: R2 purity ----------
  let r2Hits = 0;
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else {
        const s = fs.readFileSync(fp, "latin1");
        // an external R2 object would stand under the episode key
        // shape episodes/<date>/ext-… — the stored stream URLs
        // (/<slot>.mp3 on the feed host) are D1 data, not objects.
        if (s.includes(`episodes/${F3}/ext-`) || s.includes(`episodes/${F2}/ext-`)) r2Hits++;
      }
    }
  };
  walk(PERSIST);
  const extAudio = await api(BASE, "GET", `/api/player/audio/${F3}/ext-invitatory`);
  ok(r2Hits === 0 && extAudio.status === 404,
    `check 25: no external-slot object stands anywhere in the store (persist scan hits ${r2Hits}, audio route ${extAudio.status})`);

  // ---------- check 26: read-path purity ----------
  const workerSrc = fs.readFileSync(path.join(APP, "worker", "src", "index.ts"), "utf8");
  const hosts = ["divineoffice.org", "feeds.fireside.fm", "feeds.castos.com", "traffic.libsyn.com", "media.blubrry.com"];
  ok(!hosts.some((h) => workerSrc.includes(h) || clientJs.includes(h)),
    "check 26: no feed host is named in the Worker or the client — payloads build from D1 alone");
} catch (e) {
  console.error("HARNESS ERROR:", e && e.stack || e);
  results.push(["harness completed without exception", false]);
} finally {
  if (browser) { try { await browser.close(); } catch { /* already closed */ } }
  if (app1) { try { app1.kill("SIGTERM"); } catch { /* already down */ } }
  feedServer.close();
  await sleep(500);
}
const ran = results.length;
const passed = results.filter(([, c]) => c).length;
console.log(`RESULT harness-v324-worker ${passed}/${ran} ok`);
process.exit(passed === ran ? 0 : 1);
