// spike-v312 (Plan E2a) — the stop-condition test, run FIRST in
// Implement: push one synthetic ~20 MB MP3 through the new door route
// (POST /api/agent/player/episodes/audio) against a scratch instance,
// commit a one-episode day, and read the audio back through the ranged
// session GET. If a ~20 MB body cannot pass the door/R2 pattern, the
// release STOPS and returns to Scope (Scope §1 stop condition) — this
// script's failure is that signal. Synthetic bytes only.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_CHECKOUT = "/home/hatch/workspace/projects/spotify_praylist-fork";
if (APP.startsWith(SHARED_CHECKOUT)) { console.error("HARD GUARD: spike WT resolves inside the shared fork checkout — refusing"); process.exit(2); }
const PORT = 8921;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v312-spike");
const TOKEN = "harness-token";
const SIZE = 20 * 1024 * 1024; // 20 MiB — above the Daily Rosary's ~19.9 MB
const DATE = "2027-03-01", EP = "spike-rosary";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, name) => { if (!c) fails++; console.log(`${c ? "ok" : "not ok"} - ${name}`); };

function d1exec(file) {
  execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, "--file", file],
    { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: "pipe" });
}
fs.rmSync(PERSIST, { recursive: true, force: true });
const all = fs.readdirSync(path.join(APP, "migrations")).filter((x) => x.endsWith(".sql")).sort()
  .map((f) => fs.readFileSync(path.join(APP, "migrations", f), "utf8")).join("\n");
const tmp = path.join(APP, ".wrangler-test-v312-spike-schema.sql");
fs.writeFileSync(tmp, all);
d1exec(tmp);

const child = spawn(WRANGLER, ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
  "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"],
  { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"] });
child.stderr.on("data", () => {});
try {
  let up = false;
  for (let i = 0; i < 150 && !up; i++) { try { const r = await fetch(BASE + "/"); up = !!r.status; } catch { await sleep(1000); } }
  ok(up, "scratch app up");

  const body = Buffer.alloc(SIZE);
  for (let i = 0; i < SIZE; i++) body[i] = i % 251;
  const t0 = Date.now();
  const post = await fetch(`${BASE}/api/agent/player/episodes/audio`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "x-episode-date": DATE, "x-episode-id": EP, "content-type": "audio/mpeg" },
    body,
  });
  const pj = await post.json().catch(() => ({}));
  ok(post.status === 200 && pj.size === SIZE, `20 MiB staging POST accepted through the door pattern (status ${post.status}, size read back ${pj.size}, ${Date.now() - t0} ms)`);

  const commit = await fetch(`${BASE}/api/agent/player/day`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ date: DATE, episodes: [{ episode_id: EP, title: "Spike Rosary", block: "Morning", sort: 1, duration_s: 1400, size_bytes: SIZE, audio_state: "present" }] }),
  });
  const cj = await commit.json().catch(() => ({}));
  ok(commit.status === 200 && cj.storedDate === DATE && cj.rowCount === 1 && cj.perTrack?.[0]?.audio === "verified",
    `commit verifies the staged 20 MiB object (status ${commit.status}, storedDate ${cj.storedDate})`);

  const ranged = await fetch(`${BASE}/api/player/audio/${DATE}/${EP}`, { headers: { range: "bytes=1000000-1000999" } });
  const slice = Buffer.from(await ranged.arrayBuffer());
  let sliceOk = slice.length === 1000;
  for (let i = 0; i < slice.length && sliceOk; i++) sliceOk = slice[i] === (1000000 + i) % 251;
  ok(ranged.status === 206 && (ranged.headers.get("content-range") || "") === `bytes 1000000-1000999/${SIZE}` && sliceOk,
    `ranged read-back exact (status ${ranged.status}, content-range ${ranged.headers.get("content-range")}, bytes verified)`);

  const full = await fetch(`${BASE}/api/player/audio/${DATE}/${EP}`, { method: "GET", headers: { range: `bytes=${SIZE - 10}-` } });
  ok(full.status === 206 && (full.headers.get("content-range") || "") === `bytes ${SIZE - 10}-${SIZE - 1}/${SIZE}`,
    "tail range reads to the exact end of the 20 MiB object");
} catch (e) {
  fails++; console.log(`not ok - spike crashed: ${e.message}`);
} finally {
  child.kill("SIGTERM");
  await sleep(500);
}
console.log(fails ? `SPIKE RESULT: FAIL (${fails}) — STOP CONDITION TRIPPED` : "SPIKE RESULT: PASS — ~20 MB passes the door pattern; the stop condition does not trip");
process.exit(fails ? 1 : 0);
