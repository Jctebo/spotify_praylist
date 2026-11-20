// harness-v335 — the v335 gate (§2.11 legs 1-7; leg 8 regressions
// run as their own harnesses). Mold: harness-v312 (estate wrangler,
// --config, LOCAL_DEV, ffmpeg tones, staging routes). API-level: the
// standing-segment family is a door + payload contract, no browser
// surface changes (§2.5: no client change).
//
// The legs, in run order (state carries forward by design):
//   1 standing push — 'current' accepted for all six blocks; rows
//     read back (date='current', r2_key segments/current/<Block>.mp3,
//     size = file size); a bad date is refused 400.
//   7 dated regression — a dated push + dated serving still work
//     byte-exact beside the standing family, and the payload reads
//     the STANDING row, not the dated one. (Runs early: later legs'
//     commits retire dated rows by the standing rule.)
//   2 replace in place — a second standing push with different bytes
//     leaves one row, one served body, new size everywhere.
//   3 survives a replace-day commit — standing rows + objects intact
//     across a full episodes commit; the new stored day's payload
//     splices all six Intentions cards FIRST in their blocks, each
//     streamUrl the standing name; segmentsHeld names the six.
//   4 dated rotation intact — the same commit retires the prior
//     day's episode audio + dated segment rows, deletes a dated
//     segment row for a non-stored date, and keeps the new stored
//     date's dated rows (the existing rule, unchanged).
//   5 missing reads missing — one standing row deleted: that block's
//     card stands available:false, streamUrl:null, named in
//     audioMissing in BOTH payloads; segmentAudioUrl null; no
//     'devotional-suite' string anywhere in either payload body or
//     in the Worker source (the SUITE_AUDIO_BASE purge leg).
//   6 refresh on request — the §2.7 procedure's push leg against the
//     stored day with changed bytes: the standing file's bytes
//     change, size read-back matches, still one row per block, the
//     stored-day read-back again names all six blocks.
//   8 regressions — harness-v312 · harness-v325 ·
//     check-v328-consumption · harness-v334, run separately; their
//     tallies stand in their own complete logs.
//
// HARD GUARD: refuses to run from the shared checkout.
// Run: node app/tests/harness-v335.mjs
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const ESBUILD = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_CHECKOUT = "/home/hatch/workspace/projects/spotify_praylist-fork";
if (APP.startsWith(SHARED_CHECKOUT)) { console.error("HARD GUARD: harness WT resolves inside the shared fork checkout — refusing"); process.exit(2); }

const PORT = 8981;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v335");
const TOKEN = "harness-token";
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
const D1 = "2027-03-01", D2 = "2027-03-02", D3 = "2027-03-03";
let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixture audio: real MP3 tones via ffmpeg ----
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v335-audio-"));
function makeMp3(name, seconds, freq) {
  const f = path.join(TMPD, name);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${seconds}`,
    "-codec:a", "libmp3lame", "-b:a", "32k", "-y", f], { stdio: "pipe" });
  return fs.readFileSync(f);
}

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
function d1exec(file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, "--file", file],
    { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: "pipe" });
}
function d1query(sql) {
  const out = execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, "--command", sql, "--json"],
    { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: "pipe" }).toString();
  const parsed = JSON.parse(out);
  return parsed[0].results;
}
function applySchema() {
  fs.rmSync(PERSIST, { recursive: true, force: true });
  const all = fs.readdirSync(path.join(APP, "migrations")).filter((x) => x.endsWith(".sql")).sort()
    .map((f) => fs.readFileSync(path.join(APP, "migrations", f), "utf8")).join("\n");
  const tmp = path.join(APP, ".wrangler-test-v335-schema.sql");
  fs.writeFileSync(tmp, all);
  d1exec(tmp);
  const seedFile = path.join(APP, ".wrangler-test-v335-seed.sql");
  fs.writeFileSync(seedFile, seedSql());
  d1exec(seedFile);
}
function startWrangler() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"];
  const child = spawn(WRANGLER, args, { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", () => {});
  return child;
}
async function waitUp() {
  for (let i = 0; i < 150; i++) { try { const r = await fetch(BASE + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
async function api(method, p, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  let body;
  if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
  if (opts.raw !== undefined) body = opts.raw;
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(BASE + p, { method, headers, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let parsed = null; try { parsed = JSON.parse(buf.toString()); } catch { /* bytes/html */ }
  return { status: res.status, body: parsed, buf, text: buf.toString() };
}
async function pushSegment(date, block, bytes) {
  return api("POST", "/api/agent/prayer/audio",
    { token: TOKEN, raw: bytes, headers: { "x-prayer-date": date, "x-prayer-block": block, "content-type": "audio/mpeg" } });
}
async function stageEpisode(date, epId, bytes) {
  return api("POST", "/api/agent/player/episodes/audio",
    { token: TOKEN, raw: bytes, headers: { "x-episode-date": date, "x-episode-id": epId, "content-type": "audio/mpeg" } });
}
const D1_EPS = [
  { episode_id: "ep-a", title: "Alpha Prayer", block: "Morning", sort: 1, duration_s: 61, file: "a" },
  { episode_id: "ep-b", title: "Beta Gospel", block: "Morning", sort: 2, duration_s: 62, file: "b" },
  { episode_id: "ep-c", title: "Gamma Novena", block: "Midday", sort: 3, duration_s: 63, file: "c" },
];
const D2_EPS = [
  { episode_id: "d2-a", title: "Day Two Alpha", block: "Morning", sort: 1, duration_s: 71, file: "a" },
  { episode_id: "d2-b", title: "Day Two Beta", block: "Midday", sort: 2, duration_s: 72, file: "b" },
];
function manifestOf(eps, audio) {
  return eps.map((e) => ({
    episode_id: e.episode_id, title: e.title, block: e.block, sort: e.sort, duration_s: e.duration_s,
    size_bytes: audio[e.file].length, audio_state: "present",
  }));
}

let app1 = null;
try {
  execFileSync(ESBUILD, [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v335-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "worker bundles clean (esbuild)");

  const audio = {
    a: makeMp3("a.mp3", 0.8, 220), b: makeMp3("b.mp3", 0.8, 330), c: makeMp3("c.mp3", 0.8, 440),
    seg: makeMp3("seg.mp3", 0.8, 262), seg2: makeMp3("seg2.mp3", 1.4, 294), dated: makeMp3("dated.mp3", 1.1, 523),
    seg3: makeMp3("seg3.mp3", 1.7, 349),
  };

  applySchema();
  app1 = startWrangler();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV harness mode)");

  // A stored day stands first (the player payload needs one).
  for (const e of D1_EPS) await stageEpisode(D1, e.episode_id, audio[e.file]);
  let r = await api("POST", "/api/agent/player/day", { token: TOKEN, json: { date: D1, episodes: manifestOf(D1_EPS, audio) } });
  ok(r.status === 200 && r.body.storedDate === D1, "setup: D1 episodes commit lands (stored day D1)");

  // ---------- Leg 1: standing push ----------
  let pushOk = true;
  for (const b of BLOCKS) { const pr = await pushSegment("current", b, audio.seg); if (pr.status !== 200 || pr.body.size !== audio.seg.length) pushOk = false; }
  ok(pushOk, "leg 1: push_audio('current', block) -> 200 for all six blocks, sizes read back");
  const rows = d1query("SELECT date, block, r2_key, size_bytes FROM prayer_audio WHERE date='current' ORDER BY block");
  ok(rows.length === 6 && rows.every((x) => x.r2_key === `segments/current/${x.block}.mp3` && x.size_bytes === audio.seg.length),
    "leg 1: exactly six standing rows, r2_key segments/current/<Block>.mp3, size_bytes = file size");
  let serveOk = true;
  for (const b of BLOCKS) { const gr = await api("GET", `/api/prayer/audio/current/${b}`); if (gr.status !== 200 || !gr.buf.equals(audio.seg)) serveOk = false; }
  ok(serveOk, "leg 1: the standing name /api/prayer/audio/current/<Block> serves the pushed bytes for all six blocks");
  r = await api("GET", "/api/agent/player/stored-day", { token: TOKEN });
  ok(JSON.stringify((r.body.segmentBlocks || []).slice().sort()) === JSON.stringify(BLOCKS.slice().sort()),
    "leg 1: stored-day read-back segmentBlocks names all six standing blocks");
  r = await pushSegment("tomorrow", "Morning", audio.seg);
  ok(r.status === 400, "leg 1: a non-date, non-'current' X-Prayer-Date is still refused 400");

  // ---------- Leg 7: dated regression (before any commit retires it) ----------
  r = await pushSegment(D1, "Midday", audio.dated);
  ok(r.status === 200 && r.body.size === audio.dated.length, "leg 7: a dated push still lands beside the standing family");
  r = await api("GET", `/api/prayer/audio/${D1}/Midday`);
  ok(r.status === 200 && r.buf.equals(audio.dated), "leg 7: dated serving returns the dated bytes byte-exact");
  r = await api("GET", `/api/agent/prayer/day?date=${D1}`, { token: TOKEN });
  const midday = (r.body.blocks || []).find((b) => b.block === "Midday");
  ok(!!midday && midday.audio.sizeBytes === audio.seg.length && midday.segmentAudioUrl === "/api/prayer/audio/current/Midday",
    "leg 7: the prayer payload reads the STANDING row (size + standing name), not the dated row standing beside it");

  // ---------- Leg 2: replace in place ----------
  r = await pushSegment("current", "Morning", audio.seg2);
  ok(r.status === 200 && r.body.size === audio.seg2.length, "leg 2: second standing push of Morning accepted with the new size");
  const mrows = d1query("SELECT block, size_bytes FROM prayer_audio WHERE date='current' AND block='Morning'");
  ok(mrows.length === 1 && mrows[0].size_bytes === audio.seg2.length, "leg 2: still exactly one standing Morning row, at the new size");
  r = await api("GET", "/api/prayer/audio/current/Morning");
  ok(r.status === 200 && r.buf.equals(audio.seg2), "leg 2: the standing name serves the NEW bytes (replaced in place)");
  r = await api("GET", `/api/agent/prayer/day?date=${D1}`, { token: TOKEN });
  const morning = (r.body.blocks || []).find((b) => b.block === "Morning");
  ok(!!morning && morning.audio.sizeBytes === audio.seg2.length && morning.audio.available === true,
    "leg 2: the payload's audio.sizeBytes follows the replacement");

  // ---------- Legs 3+4: a replace-day commit ----------
  // A dated segment row for a non-stored date (D3) and one for the
  // incoming stored date (D2) stand before the D2 commit.
  await pushSegment(D3, "Evening", audio.dated);
  await pushSegment(D2, "Evening", audio.dated);
  for (const e of D2_EPS) await stageEpisode(D2, e.episode_id, audio[e.file]);
  r = await api("POST", "/api/agent/player/day", { token: TOKEN, json: { date: D2, episodes: manifestOf(D2_EPS, audio) } });
  ok(r.status === 200 && r.body.storedDate === D2, "leg 3: the D2 replace-day commit lands");
  ok(JSON.stringify((r.body.segmentsHeld || []).slice().sort()) === JSON.stringify(BLOCKS.slice().sort()),
    "leg 3: the commit reply's segmentsHeld names all six standing blocks");
  const rowsAfter = d1query("SELECT block, size_bytes FROM prayer_audio WHERE date='current' ORDER BY block");
  ok(rowsAfter.length === 6 && rowsAfter.find((x) => x.block === "Morning").size_bytes === audio.seg2.length,
    "leg 3: all six standing rows survive the commit, sizes untouched");
  r = await api("GET", "/api/prayer/audio/current/Evening");
  ok(r.status === 200 && r.buf.equals(audio.seg), "leg 3: standing objects survive the sweep (Evening serves its bytes after the commit)");
  r = await api("GET", "/api/player/day");
  const cardsOk = (r.body.blocks || []).every((b) => {
    const card = b.tracks[0];
    return card && card.intentionsCard === true && card.available === true && card.streamUrl === `/api/prayer/audio/current/${encodeURIComponent(b.block)}`;
  });
  ok(r.body.storedDay === D2 && cardsOk, "leg 3: the new stored day's payload splices all six Intentions cards FIRST in their blocks, each streamUrl the standing name (v325 order intact)");
  ok(Array.isArray(r.body.audioMissing) && r.body.audioMissing.length === 0, "leg 3: audioMissing is empty with the standing family complete");
  r = await api("GET", `/api/player/audio/${D1}/ep-a`);
  ok(r.status === 404, "leg 4: the prior day's episode audio is retired by the commit (404)");
  r = await api("GET", `/api/prayer/audio/${D1}/Midday`);
  ok(r.status === 404, "leg 4: the prior stored date's dated segment row is deleted by the commit (404)");
  const d3rows = d1query(`SELECT block FROM prayer_audio WHERE date='${D3}'`);
  ok(d3rows.length === 0, "leg 4: a dated segment row for a non-stored date is deleted by the same commit");
  const d2rows = d1query(`SELECT block FROM prayer_audio WHERE date='${D2}'`);
  ok(d2rows.length === 1 && d2rows[0].block === "Evening", "leg 4: the new stored date's dated segment row follows the existing rule (kept)");

  // ---------- Leg 5: missing reads missing ----------
  const delFile = path.join(APP, ".wrangler-test-v335-del.sql");
  fs.writeFileSync(delFile, "DELETE FROM prayer_audio WHERE date='current' AND block='Night';");
  d1exec(delFile);
  r = await api("GET", "/api/player/day");
  const nightBlock = (r.body.blocks || []).find((b) => b.block === "Night");
  const nightCard = nightBlock && nightBlock.tracks[0];
  ok(!!nightCard && nightCard.intentionsCard === true && nightCard.available === false && nightCard.streamUrl === null,
    "leg 5: the player payload's Night card stands available:false, streamUrl:null");
  ok((r.body.audioMissing || []).includes("Night") && r.body.audioMissing.length === 1,
    "leg 5: audioMissing names exactly the missing block in the player payload");
  const playerText = r.text;
  r = await api("GET", `/api/agent/prayer/day?date=${D2}`, { token: TOKEN });
  const nightPrayer = (r.body.blocks || []).find((b) => b.block === "Night");
  ok(!!nightPrayer && nightPrayer.audio.available === false && nightPrayer.audio.url === null && nightPrayer.audio.sizeBytes === null && nightPrayer.segmentAudioUrl === null,
    "leg 5: the prayer payload reads the missing segment plainly (available:false, url null, segmentAudioUrl null — no fallback)");
  ok(!playerText.includes("devotional-suite") && !r.text.includes("devotional-suite"),
    "leg 5: no 'devotional-suite' string appears anywhere in either payload body");
  const workerSrc = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
  ok(!workerSrc.includes("SUITE_AUDIO_BASE") && !workerSrc.includes("devotional-suite"),
    "leg 5: the Worker source carries no SUITE_AUDIO_BASE and no Suite URL (purge leg)");
  r = await api("GET", "/api/prayer/audio/current/Night");
  ok(r.status === 404, "leg 5: the standing serving route 404s for the missing block");

  // ---------- Leg 6: refresh on request ----------
  r = await pushSegment("current", "Night", audio.seg3);
  ok(r.status === 200 && r.body.size === audio.seg3.length, "leg 6: the on-request refresh push lands for the missing block with changed bytes");
  const nrows = d1query("SELECT block, size_bytes FROM prayer_audio WHERE date='current' ORDER BY block");
  ok(nrows.length === 6 && nrows.find((x) => x.block === "Night").size_bytes === audio.seg3.length,
    "leg 6: still exactly one standing row per block; Night stands at the refreshed size");
  r = await api("GET", "/api/prayer/audio/current/Night");
  ok(r.status === 200 && r.buf.equals(audio.seg3), "leg 6: the standing name serves the refreshed bytes");
  r = await api("GET", "/api/agent/player/stored-day", { token: TOKEN });
  ok(JSON.stringify((r.body.segmentBlocks || []).slice().sort()) === JSON.stringify(BLOCKS.slice().sort()),
    "leg 6: the stored-day read-back again names all six blocks after the refresh (the §2.7 verify)");
} catch (e) {
  fails++;
  console.log(`not ok - harness error: ${e && e.message ? e.message : e}`);
} finally {
  if (app1) app1.kill("SIGTERM");
  await sleep(500);
  console.log(`RESULT: ${n - fails} ok / ${fails} FAIL`);
  process.exit(fails ? 1 : 0);
}
