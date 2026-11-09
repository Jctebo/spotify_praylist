// harness-v327 — the v327 gate (Plan §2.2): the standing push helper,
// unmodified, pushes the REAL 2026-11-08 manifest (17 episodes, 12 with
// underscore novena ids) into a local instance seeded with the v312
// mold (35 items + 11-intention pool). Pass = every episode commits,
// stored-day reads back the date and the manifest's counts, and the
// stored episode ids are exactly the manifest's ids. Scratch wrangler
// instance INSIDE this worktree; tallies read from the COMPLETE log.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_CHECKOUT = "/home/hatch/workspace/projects/spotify_praylist-fork";
if (APP.startsWith(SHARED_CHECKOUT)) { console.error("HARD GUARD: harness WT resolves inside the shared fork checkout — refusing"); process.exit(2); }
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8943;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v327");
const TOKEN = "harness-token";
const REPORT = "/home/hatch/workspace/ora-runner-runs/2026-11-08/report.json";
const RUNDIR = "/home/hatch/workspace/ora-runner-runs/2026-11-08/out";
let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- seed (the v312/v305 mold: 35 items + the 11-intention pool) ----
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
function d1exec(file, command) {
  const args = ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", PERSIST, "--json"];
  if (command) args.push("--command", command); else args.push("--file", file);
  const out = execFileSync(WRANGLER, args, { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: "pipe" });
  return JSON.parse(out.toString());
}
async function waitUp() {
  for (let i = 0; i < 150; i++) { try { const r = await fetch(BASE + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}

let app = null;
try {
  execFileSync("/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
    [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v327-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "worker bundles clean (esbuild)");

  fs.rmSync(PERSIST, { recursive: true, force: true });
  const all = fs.readdirSync(path.join(APP, "migrations")).filter((x) => x.endsWith(".sql")).sort()
    .map((f) => fs.readFileSync(path.join(APP, "migrations", f), "utf8")).join("\n");
  const schemaFile = path.join(APP, ".wrangler-test-v327-schema.sql");
  fs.writeFileSync(schemaFile, all);
  d1exec(schemaFile);
  const seedFile = path.join(APP, ".wrangler-test-v327-seed.sql");
  fs.writeFileSync(seedFile, seedSql());
  d1exec(seedFile);
  ok(true, "schema + v312-mold seed applied to scratch D1");

  app = spawn(WRANGLER, ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"],
    { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"] });
  app.stderr.on("data", () => {});
  ok(await waitUp(), "app up on local wrangler (port 8943)");

  const manifest = JSON.parse(fs.readFileSync(REPORT, "utf8"));
  const manifestIds = Object.keys(manifest.episodes).sort();
  const underscoreIds = manifestIds.filter((i) => i.includes("_"));
  ok(manifestIds.length === 17 && underscoreIds.length === 12,
    `real manifest: 17 episodes, 12 underscore ids (found ${manifestIds.length}/${underscoreIds.length})`);

  let pushOut = "", pushCode = 0;
  try {
    pushOut = execFileSync("python3", [path.join(APP, "tests/push-leg-v327.py"), String(PORT), REPORT, RUNDIR],
      { cwd: APP, stdio: "pipe", timeout: 600000 }).toString();
  } catch (e) { pushCode = e.status ?? 1; pushOut = (e.stdout || "").toString() + (e.stderr || "").toString(); }
  console.log("--- push helper output ---\n" + pushOut.trim() + "\n--------------------------");
  ok(pushCode === 0, "push helper exits 0 (staging + replace-day commit accepted)");
  const field = pushOut.trim().split("\n").find((l) => l.startsWith("App push (v312):")) || "";
  ok(field.includes("episodes 17 (17 present / 0 missing)") && field.includes("stored date after push 2026-11-08"),
    "App push field: 17 episodes, 17 present / 0 missing, stored date 2026-11-08");

  const rows = d1exec(null, "SELECT episode_id, audio_state FROM player_episodes ORDER BY sort")[0].results;
  const storedIds = rows.map((r) => r.episode_id).sort();
  ok(JSON.stringify(storedIds) === JSON.stringify(manifestIds),
    "stored episode ids are exactly the manifest's 17 ids");
  ok(rows.every((r) => r.audio_state === "present"), "every stored episode reads audio_state present");
  ok(underscoreIds.every((i) => storedIds.includes(i)), "all 12 underscore novena ids stored");

  const sd = await (await fetch(BASE + "/api/agent/player/stored-day", { headers: { authorization: `Bearer ${TOKEN}` } })).json();
  ok(sd.storedDate === "2026-11-08" && sd.episodeCount === 17 && sd.tracksPresent === 17 && sd.tracksMissing === 0,
    `stored-day read-back: date 2026-11-08, 17 episodes, 17 present / 0 missing (got ${JSON.stringify(sd)})`);
} catch (e) {
  fails++; console.log("not ok - harness error: " + (e && e.message ? e.message : e));
} finally {
  if (app) app.kill("SIGTERM");
  fs.rmSync(PERSIST, { recursive: true, force: true });
}
console.log(`RESULT: ${n} ok / ${fails} FAIL`);
process.exit(fails ? 1 : 0);
