// harness-v318 — the v318 APP-HALF gate (Plan T10): migration 0008 +
// text staging/commit verify · payload hasText/textUrl per row · the
// text route serves the exact script bytes · replace-day leaves no
// prior-day text (rows, texts/ objects, stored-day counts) · a
// missing text is named in the payload shape and counted in
// stored-day · the push helper's T1-rule text resolution + the
// report field's texts clause against a live scratch instance · the
// Read view renders the full text in the browser boot at the font
// floor, play/pause from the view drives the same audio element.
// Scratch wrangler instance INSIDE the worktree, synthetic fixture
// only, tallies read from the COMPLETE log. harness-v312 re-runs
// whole as the regression (separate log).
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
const REPO = path.resolve(APP, "..");
const SHARED_CHECKOUT = "/home/hatch/workspace/projects/spotify_praylist-fork";
if (APP.startsWith(SHARED_CHECKOUT)) { console.error("HARD GUARD: harness WT resolves inside the shared fork checkout — refusing"); process.exit(2); }

const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v318");
const TOKEN = "harness-token";
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
const D1 = "2027-04-01", D2 = "2027-04-02", D3 = "2027-04-03";
let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TEXT_A = "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.\nAlpha prayer synthetic text stands here, word for word.\nA second line of the fixture prayer.";
const TEXT_U = "Unblocked extra synthetic text, kept short and exact.";
const TEXT_D2 = "Day two synthetic text for the replace-day proof.";
const TEXT_HELPER = "Helper-pushed synthetic text, clean of production markup.\nIt stands in the app store exactly as written.";

// ---- fixture audio: real MP3 tones via ffmpeg (browser-playable) ----
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v318-audio-"));
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
  const tmp = path.join(APP, `.wrangler-test-v318-${tag}-schema.sql`);
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
  let parsed = null; try { parsed = JSON.parse(text); } catch { /* text/html */ }
  return { status: res.status, body: parsed, text, headers: res.headers };
}
const stageAudio = (date, epId, bytes) => api(BASE, "POST", "/api/agent/player/episodes/audio",
  { token: TOKEN, raw: bytes, headers: { "x-episode-date": date, "x-episode-id": epId, "content-type": "audio/mpeg" } });
const stageText = (date, epId, text) => api(BASE, "POST", "/api/agent/player/episodes/text",
  { token: TOKEN, raw: Buffer.from(text, "utf8"), headers: { "x-episode-date": date, "x-episode-id": epId, "content-type": "text/plain; charset=utf-8" } });

let app1 = null, browser = null;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v318-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "worker bundles clean (esbuild)");

  const audio = { a: makeMp3("a.mp3", 6, 220), b: makeMp3("b.mp3", 6, 330), u: makeMp3("u.mp3", 6, 880) };

  applySchema(PERSIST, "main");
  const seedFile = path.join(APP, ".wrangler-test-v318-seed.sql");
  fs.writeFileSync(seedFile, seedSql());
  d1exec(PERSIST, seedFile);
  app1 = startWrangler(PORT, PERSIST);
  ok(await waitUp(BASE), "app up on local wrangler (LOCAL_DEV harness mode, schema incl. migration 0008)");

  // ---------- Staging + the wrong-size abort ----------
  let r = await stageText(D1, "ep-a", TEXT_A);
  ok(r.status === 200 && r.body.size === Buffer.byteLength(TEXT_A), "text staging POST accepted, size read back");
  r = await api(BASE, "POST", "/api/agent/player/episodes/text",
    { token: TOKEN, raw: Buffer.from("x"), headers: { "x-episode-date": "April 1", "x-episode-id": "ep-a" } });
  ok(r.status === 400, "text staging refuses a bad X-Episode-Date (400)");
  await stageAudio(D1, "ep-a", audio.a); await stageAudio(D1, "ep-m", audio.b); await stageAudio(D1, "ep-u", audio.u);
  await stageText(D1, "ep-u", TEXT_U);
  const manifestWrong = [
    { episode_id: "ep-a", title: "Alpha Prayer", block: "Morning", sort: 1, duration_s: 61, size_bytes: audio.a.length, audio_state: "present", text_state: "present", text_size_bytes: Buffer.byteLength(TEXT_A) + 5 },
    { episode_id: "ep-m", title: "Missing Text Track", block: "Midmorning", sort: 2, duration_s: 62, size_bytes: audio.b.length, audio_state: "present", text_state: "missing", text_size_bytes: 0 },
    { episode_id: "ep-u", title: "Unblocked Extra", block: "unblocked", sort: 3, duration_s: 63, size_bytes: audio.u.length, audio_state: "present", text_state: "present", text_size_bytes: Buffer.byteLength(TEXT_U) },
  ];
  r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: D1, episodes: manifestWrong } });
  ok(r.status === 409 && String(r.body.error || "").includes("ep-a") && String(r.body.error || "").includes("text"),
    "a wrong-size staged text aborts the commit 409 naming the track, in the named text shape");
  r = await api(BASE, "GET", "/api/agent/player/stored-day", { token: TOKEN });
  ok(r.body.storedDate === null && r.body.episodeCount === 0, "the aborted commit wrote nothing — no stored day stands");

  // ---------- The correct commit ----------
  const manifest = manifestWrong.map((e) => e.episode_id === "ep-a" ? { ...e, text_size_bytes: Buffer.byteLength(TEXT_A) } : e);
  r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: D1, episodes: manifest } });
  ok(r.status === 200 && r.body.storedDate === D1 && r.body.rowCount === 3, "commit returns storedDate = D1, rowCount 3");
  const perText = Object.fromEntries((r.body.perTrack || []).map((t) => [t.episode_id, t.text]));
  ok(perText["ep-a"] === "verified" && perText["ep-m"] === "missing" && perText["ep-u"] === "verified",
    "commit read-back perTrack text: verified / missing / verified exactly as the manifest");
  r = await api(BASE, "GET", "/api/agent/player/stored-day", { token: TOKEN });
  ok(r.body.textsPresent === 2 && r.body.textsMissing === 1 && r.body.tracksPresent === 3 && r.body.tracksMissing === 0,
    "stored-day counts texts beside tracks — 2 texts present / 1 missing, 3 tracks present");

  // ---------- Payload shape ----------
  r = await api(BASE, "GET", "/api/player/day");
  const flat = {};
  for (const b of r.body.blocks) for (const t of b.tracks) if (!t.intentionsCard) flat[t.episodeId] = t;
  for (const t of r.body.episodes) flat[t.episodeId] = t;
  ok(flat["ep-a"].hasText === true && flat["ep-a"].textUrl === `/api/player/text/${D1}/ep-a`,
    "payload: a text-carrying track carries hasText:true and its exact textUrl");
  ok(flat["ep-m"].hasText === false && flat["ep-m"].textUrl === null && flat["ep-m"].title === "Missing Text Track",
    "payload: the text-missing track stands named in its block, hasText:false, textUrl:null");
  ok(flat["ep-u"].hasText === true && flat["ep-u"].textUrl === `/api/player/text/${D1}/ep-u`,
    "payload: the unblocked track carries its text fields like any other");

  // ---------- The text route ----------
  const tr = await fetch(`${BASE}/api/player/text/${D1}/ep-a`);
  const trBody = await tr.text();
  ok(tr.status === 200 && trBody === TEXT_A && (tr.headers.get("content-type") || "").startsWith("text/plain"),
    "the text route serves the exact script bytes as text/plain");
  r = await api(BASE, "GET", `/api/player/text/${D1}/ep-m`);
  ok(r.status === 404, "the text route 404s a text-missing row by name");
  r = await api(BASE, "GET", `/api/player/text/${D1}/no-such-ep`);
  ok(r.status === 404, "the text route 404s an unknown episode");

  // ---------- Replace-day leaves no prior-day text ----------
  await stageAudio(D2, "d2-a", audio.a); await stageText(D2, "d2-a", TEXT_D2);
  r = await api(BASE, "POST", "/api/agent/player/day", { token: TOKEN, json: { date: D2, episodes: [
    { episode_id: "d2-a", title: "Day Two Alpha", block: "Morning", sort: 1, duration_s: 71, size_bytes: audio.a.length, audio_state: "present", text_state: "present", text_size_bytes: Buffer.byteLength(TEXT_D2) },
  ] } });
  ok(r.status === 200 && r.body.storedDate === D2, "the D2 replace-day commit lands");
  r = await api(BASE, "GET", `/api/player/text/${D1}/ep-a`);
  ok(r.status === 404, "replace-day: the prior day's text is gone with its row (404)");
  r = await api(BASE, "GET", `/api/player/text/${D2}/d2-a`);
  ok(r.status === 200 && r.text === TEXT_D2, "replace-day: the new day's text serves exactly");
  r = await api(BASE, "GET", "/api/agent/player/stored-day", { token: TOKEN });
  ok(r.body.storedDate === D2 && r.body.textsPresent === 1 && r.body.textsMissing === 0 && r.body.episodeCount === 1,
    "replace-day: stored-day shows one date only, texts 1 / 0");

  // ---------- The push helper end to end (T8) ----------
  const rundir = fs.mkdtempSync(path.join(os.tmpdir(), "v318-helper-"));
  fs.writeFileSync(path.join(rundir, "morning-prayer.mp3"), audio.a);
  fs.writeFileSync(path.join(rundir, "daily-rosary.mp3"), audio.b);
  fs.writeFileSync(path.join(rundir, "script-morning-prayer.txt"), TEXT_HELPER);
  fs.writeFileSync(path.join(rundir, "script-daily-rosary.txt"), "Daily Rosary synthetic text [production note: withheld by the guard].");
  fs.writeFileSync(path.join(rundir, "report.json"), JSON.stringify({
    date: D3, rundir,
    episodes: {
      "morning-prayer": { title: "Morning Prayer - April 3, 2027", file: "morning-prayer.mp3", duration_s: 61, status: "built" },
      "daily-rosary": { title: "Daily Rosary - April 3, 2027", file: "daily-rosary.mp3", duration_s: 62, status: "built" },
      "lost-ep": { title: "Lost Episode - April 3, 2027", file: "lost-ep.mp3", duration_s: 63, status: "missing" },
    },
  }));
  const driver = path.join(APP, ".wrangler-test-v318-helper-driver.py");
  fs.writeFileSync(driver, `
import importlib.util, json, sys, urllib.request
BASE = "${BASE}"
TOKEN = "${TOKEN}"
def local_call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")
spec = importlib.util.spec_from_file_location("push_helper", r"${path.join(REPO, "jobs/push_episodes_to_app.py")}")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
helper.door.BASE = BASE
helper.door.call = local_call
def _headers(extra):
    out = ["-H", "Authorization: Bearer " + TOKEN]
    for k, v in extra.items():
        out += ["-H", f"{k}: {v}"]
    return out
helper.door._headers = _headers
sys.argv = ["push_episodes_to_app.py", "--report", r"${path.join(rundir, "report.json")}"]
rc = helper.main()
assert rc == 0, f"helper exit {rc}"
status, stored = local_call("GET", "/api/agent/player/stored-day")
assert stored["storedDate"] == "${D3}" and stored["episodeCount"] == 3, stored
assert stored["textsPresent"] == 1 and stored["textsMissing"] == 2, stored
assert stored["tracksPresent"] == 2 and stored["tracksMissing"] == 1, stored
print("HELPER-V318: PASS")
`);
  const helperOut = execFileSync("python3", [driver], { cwd: APP, encoding: "utf8" });
  ok(helperOut.includes("· texts 1 / 2"), "helper: the App push field carries the texts clause (1 present / 2 missing)");
  ok(helperOut.includes("HELPER-V318: PASS"), "helper: clean script staged, guard script + scriptless episode named missing, stored-day counts agree");

  // ---------- The browser boot: the Read view ----------
  browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#play-all", { timeout: 20000 });
  const readBtns = await page.locator("[data-read]").count();
  ok(readBtns === 1 && await page.locator('[data-read="morning-prayer"]').count() === 1,
    "browser: exactly one Read control stands — on the text-carrying card");
  const rosaryCard = await page.locator('[data-card="daily-rosary"]').innerText().catch(() => "");
  ok(!rosaryCard.includes("Read") && rosaryCard.includes("Not available in the app yet"),
    "browser: the guard-missing card carries no Read control; the not-available line stands in its place");
  const lostCard = await page.locator('[data-card="lost-ep"]').innerText().catch(() => "");
  ok(lostCard.includes("Lost Episode") && lostCard.includes("Not available in the app yet"),
    "browser: the audio+text-missing card stands named with the not-available line");
  await page.click('[data-read="morning-prayer"]');
  await page.waitForSelector(".readsheet .readtext", { timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.querySelector(".readsheet .readtext");
    return el && el.textContent.length > 40;
  }, null, { timeout: 15000 });
  const readText = await page.locator(".readsheet .readtext").innerText();
  ok(readText === TEXT_HELPER, "browser: the Read view renders the episode's full text, exactly");
  const readSize = await page.evaluate(() => Number(getComputedStyle(document.querySelector(".readsheet .readtext")).fontSize.replace("px", "")));
  ok(readSize === 17, `browser: the reading view's body text stands at 17px (the font floor) — got ${readSize}px`);
  // Play/pause from the view drives the same shell audio element.
  await page.click(".readsheet [data-playkey]");
  await page.waitForFunction(() => {
    const el = document.getElementById("audio");
    return window.state && window.state.current && window.state.current.episodeId === "morning-prayer" && !el.paused;
  }, null, { timeout: 15000 });
  ok(true, "browser: play from the Read view starts the same track on the shell audio element");
  await page.click(".readsheet [data-playkey]");
  await page.waitForFunction(() => document.getElementById("audio").paused, null, { timeout: 15000 });
  ok(true, "browser: pause from the Read view pauses that same element");
  await page.click(".readsheet [data-readclose]");
  await page.waitForSelector(".readsheet", { state: "detached", timeout: 10000 });
  const afterClose = await page.evaluate(() => window.state.current ? window.state.current.episodeId : null);
  ok(afterClose === "morning-prayer", "browser: closing the Read view leaves playback state standing (no stop, no reset)");
  const appJs = (await api(BASE, "GET", "/app.js")).text;
  let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
  ok(parses, "the served /app.js parses (vm.Script)");
  const sw = (await api(BASE, "GET", "/sw.js")).text;
  ok(sw.includes("ora-pro-nobis-v318-1"), "the SW cache name reads ora-pro-nobis-v318-1 (the T9 bump)");
  ok(pageErrors.length === 0, `the browser boot ran with zero page errors${pageErrors.length ? " — " + pageErrors.join(" | ") : ""}`);
} catch (e) {
  n++; fails++; console.log(`not ok ${n} - harness crashed: ${e.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (app1) app1.kill("SIGTERM");
  await sleep(500);
}
console.log(`TALLY: ${n - fails} ok / ${fails} FAIL (${n} checks)`);
process.exit(fails ? 1 : 0);
