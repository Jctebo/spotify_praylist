#!/usr/bin/env node
// harness-v454 — Door mirror for the own series kind (§§1–2
// of the v454 release document; John, Ora thread, 2026-11-15
// 17:49 CT, approved To Ship). v451 shipped The AI Signal as
// a third series kind, 'own' (podOwnSeriesDef /
// podOwnPayload); the session read GET /api/player/podcasts
// resolves it, but the agent door's progress read
// GET /api/agent/podcasts/progress never received the own
// seat — the v434 mirror carried the video kind across and
// the own kind arrived later. The door therefore answered
// 400 "unknown series" for ?series=the-ai-signal, the one
// blind spot in its podcasts surface. The fix (the whole
// build): two statements + a comment in the door block of
// index.ts, between the video seat and the audio def
// lookup —
//   const doorOwnDef = podOwnSeriesDef(doorSeries);
//   if (doorOwnDef) return json(await podOwnPayload(env, doorOwnDef));
// mirroring the session route's resolution order exactly.
// index.ts only; no client change; no migration.
//
// VEHICLE (per §2): the estate wrangler LOCAL_DEV mold
// (harness-v434/v445/v453) — the REAL worker over HTTP
// against a fixture D1 built from the migration files,
// carrying player_episodes rows for the-ai-signal across
// three dates (today 'present', yesterday 'present', an
// older date NOT 'present') plus the standing podcast
// fixtures: fresh podcast_sequences snapshots for the three
// audio series and a fresh video_snapshots snapshot for
// catholictv, so the audio/video reads serve their standing
// shapes with no external fetch. The door reads carry the
// harness AGENT_TOKEN as a Bearer header; the session reads
// ride LOCAL_DEV exactly as the standing harnesses do.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v454 runs only inside a release worktree"); process.exit(2); }
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const ESBUILD = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild";
const PORT = 8999;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const PERSIST = path.join(APP, ".wrangler-test-v454");
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "opn-v454-"));
const INDEX = fs.readFileSync(path.join(APP, "worker/src/index.ts"), "utf8");
const SHIPBASE = "release/v456-ship";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const YDAY = new Date(Date.parse(TODAY + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
const OLDER = new Date(Date.parse(TODAY + "T12:00:00Z") - 3 * 86400000).toISOString().slice(0, 10);
const NOWISO = new Date().toISOString();

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === "object") {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (JSON.stringify(ka) !== JSON.stringify(kb)) return false;
    return ka.every((k) => deepEq(a[k], b[k]));
  }
  return false;
}

// ---- ST: statics -------------------------------------------------
{
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", SHIPBASE, "--", "app/worker/src", "app/migrations"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/index.ts"]),
    "ST1 the diff vs the v456-ship base is index.ts only — no client change, no migration (got: " + changed.join(", ") + ")");
  const doorAt = INDEX.indexOf('seg[2] === "podcasts" && seg[3] === "progress"');
  const doorSeg = INDEX.slice(doorAt, doorAt + 2400);
  const vAt = doorSeg.indexOf("const doorVideoDef = podVideoSeriesDef(doorSeries);");
  const oAt = doorSeg.indexOf("const doorOwnDef = podOwnSeriesDef(doorSeries);");
  const oRet = doorSeg.indexOf("if (doorOwnDef) return json(await podOwnPayload(env, doorOwnDef));");
  const aAt = doorSeg.indexOf("const doorDef = podSeriesDef(doorSeries);");
  ok(vAt >= 0 && oAt > vAt && oRet > oAt && aAt > oRet,
    "ST2 the own seat stands in the door block between the video seat and the audio def lookup, in the §2 form (two statements)");
  ok((INDEX.match(/podOwnSeriesDef\(doorSeries\)/g) || []).length === 1,
    "ST3 the door consults podOwnSeriesDef exactly once — the one new seat, nowhere else");
  let bundles = true;
  try { execFileSync(ESBUILD, [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v454-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" }); }
  catch { bundles = false; }
  ok(bundles, "ST4 the whole worker bundles clean (esbuild)");
}

// ---- wrangler helpers (the estate mold, harness-v434/v445/v453) --
function wranglerD1(persist, args) {
  return execFileSync(WRANGLER, ["d1", "execute", "ora-pro-nobis-app", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", persist, ...args],
    { cwd: APP, stdio: "pipe", env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } }).toString();
}
function applyFiles(persist, files) {
  fs.rmSync(persist, { recursive: true, force: true });
  const f = path.join(TMPD, "migs-" + path.basename(persist) + ".sql");
  fs.writeFileSync(f, files.map((x) => fs.readFileSync(x, "utf8")).join("\n"));
  wranglerD1(persist, ["--file", f]);
}
function applySql(persist, sql, tag) {
  const f = path.join(TMPD, "seed-" + tag + ".sql");
  fs.writeFileSync(f, sql);
  wranglerD1(persist, ["--file", f]);
}
const migDir = path.join(APP, "migrations");
const allMigs = fs.readdirSync(migDir).filter((x) => x.endsWith(".sql")).sort().map((f) => path.join(migDir, f));
const procs = [];
function startApp() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(3000) }); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const reqRaw = async (p, headers = {}) => {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(BASE + p, { method: "GET", headers });
      const out = { status: r.status, body: await r.json().catch(() => ({})) };
      if (out.status >= 500 && i < 4) { await sleep(800); continue; }
      return out;
    } catch (e) { lastErr = e; await sleep(800); }
  }
  throw lastErr;
};
const door = (p) => reqRaw(p, { authorization: `Bearer ${TOKEN}` });
const sess = (p) => reqRaw(p);

// ---- fixture seed --------------------------------------------------
function audioSnap(series, label) {
  const entries = [1, 2].map((d) => ({
    key: `${series}-day-${d}`, kind: "day", day: d, label: `Day ${d}`, title: `${label} Day ${d}`,
    url: `https://example.invalid/${series}/${d}.mp3`, durationS: 1500 + d, edition: 2026, imageUrl: null, descText: null,
  }));
  return { entries, collapses: 0, builtAt: NOWISO, showImageUrl: null, showDesc: null };
}
const AUDIO = [
  ["catechism-in-a-year", "Catechism in a Year"],
  ["bible-in-a-year", "Bible in a Year"],
  ["rosary-in-a-year", "Rosary in a Year"],
];
{
  applyFiles(PERSIST, allMigs);
  const ownRows = [
    [TODAY, "AI Signal — Today Fixture", 612, 1234567, "present"],
    [YDAY, "AI Signal — Yesterday Fixture", 590, 1200000, "present"],
    [OLDER, "AI Signal — Older Not Present", 601, 1210000, "missing"],
  ].map(([d, t, dur, sz, st]) =>
    `INSERT INTO player_episodes (date, episode_id, title, block, sort, duration_s, r2_key, size_bytes, audio_state, pushed_at) VALUES ('${d}', 'the-ai-signal', '${t}', 'Podcasts', 1, ${dur}, 'ai-signal/${d}.m4a', ${sz}, '${st}', '${NOWISO}');`
  ).join("\n");
  applySql(PERSIST, ownRows, "own");
  const seqSql = AUDIO.map(([key, label]) => {
    const payload = JSON.stringify(audioSnap(key, label)).replace(/'/g, "''");
    return `INSERT INTO podcast_sequences (series, payload, built_at) VALUES ('${key}', '${payload}', '${NOWISO}');`;
  }).join("\n");
  applySql(PERSIST, seqSql, "seq");
  const vidSnap = {
    videos: [0, 1].map((i) => ({
      id: `vid${i + 1}`, title: `CatholicTV Fixture Mass ${i + 1}`, url: `https://example.invalid/watch/vid${i + 1}`,
      publishedMs: Date.parse(TODAY + "T12:00:00Z") - i * 86400000, imageUrl: null, descText: null,
    })),
    builtAt: NOWISO,
  };
  applySql(PERSIST, `INSERT INTO video_snapshots (series, payload, built_at) VALUES ('catholictv', '${JSON.stringify(vidSnap).replace(/'/g, "''")}', '${NOWISO}');`, "vid");
}

// ---- SV: server legs ----------------------------------------------
try {
  startApp();
  ok(await waitUp(), "SV0 the real worker boots over the fixture DB (wrangler LOCAL_DEV mold)");

  const own = await door("/api/agent/podcasts/progress?series=the-ai-signal");
  ok(own.status === 200 && own.body && own.body.ok === true && own.body.kind === "own" && own.body.series === "the-ai-signal" && own.body.title === "The AI Signal" && own.body.available === true,
    "SV1 the door own read answers 200 with the own payload (kind 'own', The AI Signal, available)", `status ${own.status} body ${JSON.stringify(own.body).slice(0, 200)}`);
  const ents = (own.body && own.body.entries) || [];
  ok(ents.length === 2 && ents[0].date === TODAY && ents[1].date === YDAY &&
     ents[0].key === `the-ai-signal-${TODAY}` && ents[0].streamUrl === `/api/player/audio/${TODAY}/the-ai-signal` &&
     ents[0].durationS === 612 && ents[0].sizeBytes === 1234567,
    "SV2 the entries stand newest-first with only the 'present' rows (the older 'missing' row does not stand), in the standing entry shape",
    JSON.stringify(ents).slice(0, 250));
  ok(own.body.currentKey === `the-ai-signal-${TODAY}` && own.body.currentLabel === "AI Signal — Today Fixture" &&
     own.body.showImageUrl === "/logo.png" && own.body.showDesc === null,
    "SV3 currentKey is today's entry (derived at read), currentLabel its title, the show image is the app logo");

  const ownSess = await sess("/api/player/podcasts?series=the-ai-signal");
  ok(ownSess.status === 200 && deepEq(own.body, ownSess.body),
    "SV4 THE MIRROR PROOF: the door payload deep-equals the session route's payload for the same fixture state");

  const idx = await door("/api/agent/podcasts/progress");
  const list = (idx.body && idx.body.seriesList) || [];
  ok(idx.status === 200 && list.length === 5 &&
     list.map((s) => s.series).join(",") === "catechism-in-a-year,bible-in-a-year,rosary-in-a-year,catholictv,the-ai-signal" &&
     list[4].kind === "own",
    "SV5 the door index read is unchanged: five entries in registry order, the own entry last with kind 'own'",
    `status ${idx.status} list ${JSON.stringify(list.map((s) => s.series))}`);
  const idxSess = await sess("/api/player/podcasts");
  ok(idxSess.status === 200 && deepEq(idx.body, idxSess.body),
    "SV6 the door index deep-equals the session index for the same fixture state");

  for (const [key] of AUDIO) {
    const d = await door(`/api/agent/podcasts/progress?series=${key}`);
    const s = await sess(`/api/player/podcasts?series=${key}`);
    ok(d.status === 200 && d.body.available === true && (d.body.entries || []).length === 2 && s.status === 200 && deepEq(d.body, s.body),
      `SV7 the door audio read ?series=${key} is unchanged (200, its standing shape, door ≡ session)`, `door ${d.status} sess ${s.status}`);
  }

  const vid = await door("/api/agent/podcasts/progress?series=catholictv");
  const vidSess = await sess("/api/player/podcasts?series=catholictv");
  ok(vid.status === 200 && vid.body.kind === "video" && vid.body.available === true && (vid.body.videos || []).length === 2 && vidSess.status === 200 && deepEq(vid.body, vidSess.body),
    "SV8 the door video read ?series=catholictv is unchanged (200, kind 'video', door ≡ session)", `door ${vid.status} sess ${vidSess.status}`);

  const unk = await door("/api/agent/podcasts/progress?series=no-such-series");
  ok(unk.status === 400 && unk.body && unk.body.error === "unknown series",
    "SV9 an unknown series through the door still answers 400 \"unknown series\"", `status ${unk.status}`);

  const gated = await reqRaw("/api/agent/podcasts/progress?series=the-ai-signal");
  ok(gated.status === 403,
    "SV10 the door stays token-gated: the own read without the agent token answers 403", `status ${gated.status}`);
} finally {
  for (const c of procs) { try { process.kill(-c.pid, "SIGKILL"); } catch { try { c.kill("SIGKILL"); } catch {} } }
}

console.log(`# harness-v454: ${n - fails}/${n} ok`);
process.exit(fails ? 1 : 0);
