// harness-v305 — the v305 gate: pool CRUD + draw rules · contract
// fixture diff · audio intentions end to end · player mapping ·
// examination → confession flow · Access refusals · no-checklist
// sweep · parse+boot pin. Follows the house harness pattern
// (harness-v302): wrangler dev + local D1/R2 persisted INSIDE the
// worktree, per-suite test dates, tallies read from the COMPLETE
// log. Synthetic test data only — the intentions are invented; the
// 35 devotion items are seeded with their real names/blocks/kinds
// (functional labels the player mapping resolves against) and
// synthetic text fields.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
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

const PORT = 8911, FEED_PORT = 8912, LOCKED_PORT = 8913;
const BASE = `http://127.0.0.1:${PORT}`;
const LOCKED = `http://127.0.0.1:${LOCKED_PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v305");
const PERSIST_LOCKED = path.join(APP, ".wrangler-test-v305-locked");
const TOKEN = "harness-token";
let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chicagoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const p = {}; for (const x of parts) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
const TODAY = chicagoToday();
const FEED_DATE = "2026-11-08";
const FUTURE = "2027-02-01";

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

// ---- synthetic feed (the frozen feed's shape, invented episodes) ----
const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Ora Pro Nobis (harness)</title>
${[["Morning Prayer", "morning-prayer"], ["Daily Gospel", "daily-gospel"], ["Saint of the Day", "saint-of-the-day"], ["Unmapped Extra", "unmapped-extra"]]
  .map(([t, s]) => `<item><title>${t} - November 8, 2026</title><pubDate>Sat, 08 Nov 2026 06:00:00 -0600</pubDate><enclosure url="http://127.0.0.1:${FEED_PORT}/audio/${s}.mp3" type="audio/mpeg"/></item>`).join("\n")}
</channel></rss>`;
const feedServer = http.createServer((req, res) => {
  if (req.url === "/feed.xml") { res.writeHead(200, { "content-type": "application/rss+xml" }); res.end(FEED_XML); }
  else { res.writeHead(404); res.end(); }
});

// ---- seed -------------------------------------------------------------
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
  for (const f of fs.readdirSync(path.join(APP, "migrations")).filter((x) => x.endsWith(".sql")).sort()) {
    d1exec(persist, path.join(APP, "migrations", f));
  }
}
function startWrangler(port, persist, locked) {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `FEED_URL:http://127.0.0.1:${FEED_PORT}/feed.xml`, "--var", `AGENT_TOKEN:${TOKEN}`];
  if (!locked) args.push("--var", "LOCAL_DEV:1");
  const child = spawn(WRANGLER, args, { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", () => {});
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(base + "/"); if (r.status) return true; } catch { /* not up */ }
    await sleep(1000);
  }
  return false;
}
function compareShape(fixture, actual, at, extras) {
  if (typeof fixture === "string") return typeof actual === fixture;
  if (Array.isArray(fixture)) {
    if (!Array.isArray(actual)) return false;
    if (!fixture.length) return true;
    return actual.every((el) => compareShape(fixture[0], el, at + "[]", extras));
  }
  if (fixture && typeof fixture === "object") {
    if (!actual || typeof actual !== "object") return false;
    for (const k of Object.keys(actual)) if (!(k in fixture)) extras.add(`${at}.${k}`);
    return Object.keys(fixture).every((k) => k in actual && compareShape(fixture[k], actual[k], `${at}.${k}`, extras));
  }
  return true;
}

let app1 = null, app2 = null, browser = null;
try {
  // Build integrity: the Worker bundles.
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile", "/tmp/v305-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "worker bundles clean (esbuild)");

  await new Promise((r) => feedServer.listen(FEED_PORT, "127.0.0.1", r));
  applySchema(PERSIST);
  const seedFile = path.join(APP, ".wrangler-test-v305-seed.sql");
  fs.writeFileSync(seedFile, seedSql());
  d1exec(PERSIST, seedFile);
  applySchema(PERSIST_LOCKED);
  app1 = startWrangler(PORT, PERSIST, false);
  app2 = startWrangler(LOCKED_PORT, PERSIST_LOCKED, true);
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode)");
  ok(await waitUp(LOCKED), "locked instance up (no LOCAL_DEV)");

  // ---------- Intentions pool: CRUD + draw rules ----------
  let r = await api(BASE, "GET", "/api/prayer/intentions");
  ok(r.status === 200 && r.body.intentions.length === 11 && r.body.intentions.every((i) => i.status === "active"), "pool lists the 11 synthetic active intentions");
  const split = { H: 0, M: 0, L: 0 }; for (const i of r.body.intentions) split[i.priority]++;
  ok(split.H === 3 && split.M === 7 && split.L === 1, "pool split is 3 High / 7 Medium / 1 Low");

  r = await api(BASE, "GET", `/api/prayer/day?date=${TODAY}`);
  const drawsToday0 = r.body.blocks.reduce((a, b) => a + b.devotions.filter((d) => d.intentions.length).length, 0);
  ok(drawsToday0 === 35, "today's draw fills all 35 items");
  r = await api(BASE, "POST", "/api/prayer/intentions", { json: { text: "Synthetic intention NEW", priority: "H" } });
  ok(r.status === 201 && !!r.body.id, "add intention returns 201 + id");
  const newId = r.body.id;
  r = await api(BASE, "GET", `/api/prayer/day?date=${TODAY}`);
  const drawnIdsToday = new Set(); for (const b of r.body.blocks) for (const d of b.devotions) for (const x of d.intentions) drawnIdsToday.add(x.id);
  ok(r.body.devotionCount === 35 && !drawnIdsToday.has(newId), "adding an intention does NOT touch today's draws (v58 rule)");

  // Agent contract + addendum.
  r = await api(BASE, "POST", "/api/agent/prayer/day", { token: TOKEN, json: { date: FUTURE, addendum: "Synthetic addendum text" } });
  ok(r.status === 200 && r.body.draws === 35, "agent day POST draws 35 and accepts the addendum");
  r = await api(BASE, "GET", `/api/agent/prayer/day?date=${FUTURE}`, { token: TOKEN });
  ok(r.status === 200 && r.body.addendum === "Synthetic addendum text", "agent day GET returns the addendum");

  // Determinism under LOCAL_DEV (fill-missing persistence).
  const mapOf = (p) => JSON.stringify(p.blocks.flatMap((b) => b.devotions.map((d) => [d.id, d.intentions[0]?.id ?? null])));
  const m1 = mapOf(r.body);
  r = await api(BASE, "GET", `/api/agent/prayer/day?date=${FUTURE}`, { token: TOKEN });
  ok(mapOf(r.body) === m1, "re-reading a drawn date returns the identical persisted draw");

  // Weighted distribution across 30 dates (deterministic seeds).
  const counts = new Map();
  for (let d = 1; d <= 30; d++) {
    const date = `2027-01-${String(d).padStart(2, "0")}`;
    const rr = await api(BASE, "GET", `/api/agent/prayer/day?date=${date}`, { token: TOKEN });
    for (const b of rr.body.blocks) for (const dv of b.devotions) for (const x of dv.intentions) counts.set(x.id, (counts.get(x.id) ?? 0) + 1);
  }
  const poolNow = (await api(BASE, "GET", "/api/prayer/intentions")).body.intentions.filter((i) => i.status === "active");
  const avg = (pr) => { const g = poolNow.filter((i) => i.priority === pr); return g.reduce((a, i) => a + (counts.get(i.id) ?? 0), 0) / g.length; };
  ok(avg("H") > avg("M") && avg("M") > avg("L"), `weighted draw ordering holds (H avg ${avg("H").toFixed(1)} > M avg ${avg("M").toFixed(1)} > L avg ${avg("L").toFixed(1)} over 30 dates)`);

  // Edit / retire / delete.
  r = await api(BASE, "PATCH", `/api/prayer/intentions/${newId}`, { json: { priority: "L" } });
  ok(r.status === 200, "edit priority succeeds");
  r = await api(BASE, "POST", `/api/prayer/intentions/${newId}/status`, { json: { status: "retired" } });
  ok(r.status === 200, "retire succeeds");
  r = await api(BASE, "GET", `/api/prayer/day?date=${TODAY}`);
  ok(r.body.blocks.every((b) => b.devotions.every((d) => d.intentions.every((x) => x.id !== newId))), "retired intention is out of today's draw");
  const drawnAfterRetire = r.body.blocks.reduce((a, b) => a + b.devotions.filter((d) => d.intentions.length).length, 0);
  ok(drawnAfterRetire === 35, "retire refills today's draw back to 35");
  r = await api(BASE, "DELETE", `/api/prayer/intentions/${newId}`);
  ok(r.status === 200, "delete succeeds");
  r = await api(BASE, "GET", "/api/prayer/intentions");
  ok(r.body.intentions.length === 11, "pool back to 11 after delete");
  const hist = r.body.intentions.find((i) => i.id === 101);
  ok(hist && hist.drawnCount > 0 && !!hist.lastDrawn, "draw history rides the list (drawnCount + lastDrawn)");

  // ---------- Contract fixture diff ----------
  const fixture = JSON.parse(fs.readFileSync(path.join(APP, "tests/fixture-day-shape.json"), "utf8"));
  r = await api(BASE, "GET", `/api/prayer/day?date=${FUTURE}`);
  const extras = new Set();
  const shapeOk = compareShape(fixture, r.body, "$", extras);
  ok(shapeOk, "day payload matches the captured board contract shape");
  ok([...extras].every((e) => e === "$.audioMissing" || e === "$.blocks[].audio"), `payload additions are exactly the Plan's audio record (extras: ${[...extras].join(", ") || "none"})`);

  // ---------- Audio intentions ----------
  r = await api(BASE, "POST", "/api/agent/prayer/audio", { raw: Buffer.alloc(64, 1), headers: { "x-prayer-date": FUTURE, "x-prayer-block": "Morning", "content-type": "audio/mpeg" } });
  ok(r.status === 403, "audio push without the agent token is refused");
  const mp3 = Buffer.alloc(2048, 7);
  r = await api(BASE, "POST", "/api/agent/prayer/audio", { token: TOKEN, raw: mp3, headers: { "x-prayer-date": FUTURE, "x-prayer-block": "Morning", "content-type": "audio/mpeg", "x-file-name": "prayer-morning.mp3" } });
  ok(r.status === 200 && r.body.size === 2048, "audio push stores the segment (200, size read back)");
  r = await api(BASE, "POST", "/api/agent/prayer/audio", { token: TOKEN, raw: mp3, headers: { "x-prayer-date": FUTURE, "x-prayer-block": "Bogus", "content-type": "audio/mpeg" } });
  ok(r.status === 400, "audio push with a bad block is refused (400)");
  const served = await fetch(`${BASE}/api/prayer/audio/${FUTURE}/Morning`);
  const servedBytes = Buffer.from(await served.arrayBuffer());
  ok(served.status === 200 && servedBytes.length === 2048 && (served.headers.get("content-type") || "").includes("audio"), "segment serves John-side at the app audio route");
  r = await api(BASE, "GET", `/api/prayer/day?date=${FUTURE}`);
  const morning = r.body.blocks.find((b) => b.block === "Morning");
  ok(morning.audio.available === true && morning.segmentAudioUrl === `/api/prayer/audio/${FUTURE}/Morning`, "day payload points Morning's segment at the app route");
  ok(r.body.audioMissing.length === 5 && !r.body.audioMissing.includes("Morning") && r.body.audioMissing.includes("Night"), "audioMissing names the five missing blocks");
  r = await api(BASE, "GET", `/api/prayer/audio/${FUTURE}/Night`);
  ok(r.status === 404, "a missing block's segment 404s (the client shows the not-available line)");

  // ---------- Player ----------
  r = await api(BASE, "GET", `/api/player/day?date=${FEED_DATE}`);
  const pMorning = r.body.blocks.find((b) => b.block === "Morning");
  const mpTrack = pMorning.tracks.find((t) => t.title === "Morning Prayer" && !t.intentionsCard);
  ok(mpTrack && mpTrack.available && mpTrack.streamUrl.includes("/audio/morning-prayer.mp3"), "player resolves Morning Prayer to the day's feed episode");
  ok(r.body.episodes.some((e) => e.title === "Unmapped Extra"), "unmapped feed episodes stay reachable at the head of Prayers");
  const iCard = pMorning.tracks.find((t) => t.intentionsCard);
  ok(iCard && iCard.spotifyUrl === null, "Intentions card never carries a Spotify link");
  r = await api(BASE, "GET", `/api/player/day?date=${FUTURE}`);
  const fMorning = r.body.blocks.find((b) => b.block === "Morning");
  const fCard = fMorning.tracks.find((t) => t.intentionsCard);
  ok(fCard && fCard.available === true && fCard.streamUrl === `/api/prayer/audio/${FUTURE}/Morning`, "player Intentions card plays the pushed segment");
  const gospelTrack = fMorning.tracks.find((t) => t.title === "Daily Gospel Exegesis");
  ok(gospelTrack && gospelTrack.available === false && !!gospelTrack.spotifyUrl, "a track with no file stands not-available WITH its playlist link");
  r = await api(BASE, "GET", "/api/player/sources");
  ok(r.body.sources.length === 7, "player_sources holds the six block routes + the mapped episode row");
  const routeRow = r.body.sources.find((s) => s.block === "Morning" && s.source_kind === "playlist");
  ok(routeRow.spotify_url === "https://open.spotify.com/playlist/0sy9eBsySKuCppI0PxXRJN", "Morning Praylist URL seeded verbatim from the job sheet");
  const rssRow = r.body.sources.find((s) => s.source_kind === "rss");
  r = await api(BASE, "PUT", "/api/player/sources", { json: { sources: [{ id: rssRow.id, block: "Morning", title: "Unmapped Extra", source_kind: "rss", rss_url: "", spotify_url: "", sort: 1 }] } });
  ok(r.status === 200, "mapping edit through the session API succeeds");
  r = await api(BASE, "GET", `/api/player/day?date=${FEED_DATE}`);
  ok(!r.body.episodes.some((e) => e.title === "Unmapped Extra") && r.body.blocks.find((b) => b.block === "Morning").tracks.some((t) => t.title === "Unmapped Extra" && t.available), "the mapping is data: the episode moves into Morning with no code change");
  await api(BASE, "PUT", "/api/player/sources", { json: { sources: [{ id: rssRow.id, block: "Morning", title: "Morning Prayer", source_kind: "rss", rss_url: "", spotify_url: "", sort: 1 }] } });

  // ---------- Examination → Confession ----------
  r = await api(BASE, "GET", "/api/exam/today");
  ok(r.status === 200 && r.body.run.state === "open" && r.body.prompts.length === 23, "examination opens tonight's run with the 23 seeded Lasance prompts");
  ok(r.body.categories.includes("Commandment VI and IX"), "Lasance's combined VI-and-IX examination stands as one category");
  ok(r.body.prompts.some((p) => p.text.includes("daily examination of conscience")), "seed text is Lasance's own wording (public domain, cited)");
  const runId = r.body.run.id;
  const ivPrompt = r.body.prompts.find((p) => p.category === "Commandment IV");
  r = await api(BASE, "POST", "/api/exam/entries", { json: { runId, promptId: ivPrompt.id, text: "Synthetic entry one" } });
  ok(r.status === 201, "tied entry saves against its prompt");
  r = await api(BASE, "POST", "/api/exam/entries", { json: { runId, category: "Anything else", text: "Synthetic entry two" } });
  ok(r.status === 201, "free entry saves");
  r = await api(BASE, "GET", "/api/confession");
  ok(r.body.prep.length === 2 && r.body.prep.find((g) => g.category === "Commandment IV")?.entries.length === 1, "entries flow to Confession grouped by category");
  ok(r.body.elapsed.includes("No confession recorded"), "elapsed line stands before any recorded confession");
  ok(r.body.guide.length === 5, "confession guide carries the five seeded steps");
  r = await api(BASE, "POST", "/api/confession/made", { json: { date: TODAY, note: "Synthetic parish" } });
  ok(r.status === 200 && r.body.entriesClosed === 2, "Confession made closes the open entries onto the record");
  r = await api(BASE, "GET", "/api/confession");
  ok(r.body.prep.length === 0 && r.body.elapsed.includes("today") && r.body.history[0].entryCount === 2, "preparation clears; history keeps the count");
  r = await api(BASE, "POST", "/api/confession/penance", { json: { text: "Synthetic penance text" } });
  ok(r.status === 200, "penance records against the confession");
  r = await api(BASE, "POST", "/api/confession/penance/done");
  ok(r.status === 200, "penance completion records");
  r = await api(BASE, "GET", "/api/confession");
  ok(r.body.penance.text === "Synthetic penance text" && !!r.body.penance.done_at, "penance card shows the text and its completion");
  r = await api(BASE, "POST", `/api/exam/runs/${runId}/close`);
  ok(r.status === 200, "the night's examination closes");
  r = await api(BASE, "POST", "/api/exam/entries", { json: { runId, category: "Anything else", text: "too late" } });
  ok(r.status === 409, "a closed run refuses new entries");
  const prompt0 = (await api(BASE, "GET", "/api/exam/today")).body.prompts[0];
  r = await api(BASE, "PUT", "/api/exam/prompts", { json: { prompts: [{ id: prompt0.id, text: "Synthetic edited prompt" }] } });
  const afterEdit = (await api(BASE, "GET", "/api/exam/today")).body.prompts.find((p) => p.id === prompt0.id);
  ok(r.status === 200 && afterEdit.text === "Synthetic edited prompt", "prompts are editable data (Plan: edit the seed, never the code)");
  await api(BASE, "PUT", "/api/exam/prompts", { json: { prompts: [{ id: prompt0.id, text: prompt0.text }] } });

  // ---------- Access refusals (locked instance, production shape) ----------
  r = await api(LOCKED, "GET", "/");
  ok(r.status === 403, "no Access identity → the shell itself is refused (403)");
  r = await api(LOCKED, "GET", "/api/prayer/intentions", { headers: { "cf-access-authenticated-user-email": "pamela@thibeaux.com" } });
  ok(r.status === 403, "Pam's identity is refused — there is no Pam path");
  r = await api(LOCKED, "GET", "/api/confession", { headers: { "cf-access-authenticated-user-email": "someone-else@example.com" } });
  ok(r.status === 403, "any non-John identity is refused");
  r = await api(LOCKED, "GET", "/", { headers: { "cf-access-authenticated-user-email": "john.thibeaux@gmail.com" } });
  ok(r.status === 200 && r.text.includes("ORA PRO NOBIS"), "John's gmail identity is admitted");
  r = await api(LOCKED, "GET", `/api/agent/prayer/day?date=${FUTURE}`, { token: "wrong-token" });
  ok(r.status === 403, "a wrong agent token is refused");

  // ---------- No-checklist sweep + shell shape ----------
  const appJs = (await api(BASE, "GET", "/app.js")).text;
  const shell = (await api(BASE, "GET", "/")).text;
  ok(!/type="checkbox"|complete-block|complete all|prayer_completions|mark (all|complete)/i.test(appJs), "no checklist machinery anywhere in the served client (Amendment 8)");
  ok(["prayers", "intentions", "examination", "confession"].every((t) => shell.includes(`data-tab="${t}"`)), "the shell carries exactly the four tabs (Amendment 9)");
  ok(shell.includes("ORA PRO NOBIS") && shell.includes("/logo.png"), "brand bar with the podcast logo stands on the shell");
  let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
  ok(parses, "served /app.js parses (vm.Script)");

  // ---------- Parse + boot pin (headless Chromium) ----------
  browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector(".prayer-item", { timeout: 15000 });
  ok(await page.locator(".brand-name").innerText().then((t) => t.includes("ORA PRO NOBIS")), "boot: brand bar renders");
  ok(await page.locator(".prayer-item").count().then((c) => c >= 11), "boot: Intentions pool renders its rows");
  await page.click('[data-tab="prayers"]');
  await page.waitForSelector(".block-head", { timeout: 15000 });
  const blockHeads = await page.locator(".block-head").allInnerTexts();
  ok(blockHeads.some((t) => t.includes("MORNING")) && blockHeads.length === 6, "boot: player renders all six blocks");
  ok(await page.locator(".track.intentions-card").count().then((c) => c === 6), "boot: every block carries its Intentions card");
  await page.click('[data-tab="examination"]');
  await page.waitForSelector(".prompt", { timeout: 15000 });
  ok(await page.locator(".chip").count().then((c) => c >= 10), "boot: examination renders its category chips");
  await page.click('[data-tab="confession"]');
  await page.waitForSelector(".step", { timeout: 15000 });
  ok(await page.locator(".step").count().then((c) => c === 5), "boot: confession renders the five guide steps");
  ok(pageErrors.length === 0, `boot: zero page errors${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
} catch (e) {
  n++; fails++; console.log(`not ok ${n} - harness crashed: ${e.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const c of [app1, app2]) if (c) c.kill("SIGTERM");
  feedServer.close();
  await sleep(500);
}
console.log(`TALLY: ${n - fails} ok / ${fails} FAIL (${n} checks)`);
process.exit(fails ? 1 : 0);
