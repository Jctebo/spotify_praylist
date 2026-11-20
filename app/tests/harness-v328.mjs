#!/usr/bin/env node
// harness-v328 — v328 source-mapping settings, the eight §2.5 legs:
//   1 seed: a fresh D1 (migrations 0001-0010) carries EXACTLY the
//     23 §2.1 rows, every field, plus meta version 1.
//   2 door auth: no token 403 · wrong token 403 · door token 200
//     {version: 1, sources: 23} equal to the seed fixture.
//   3 session parity: session GET body identical to the door GET.
//   4 PUT validation + version: bad block 400 · bad dayRule 400 ·
//     unknown key 400 · missing row 400 — nothing written, version
//     unmoved; a rename attempt is ignored (names server-owned); a
//     lawful edit (Bible in a Year -> Evening) answers {ok,
//     version: 2} and both blocks' sort_order read back gapless.
//   5 reorder: swapping two Morning rows in the sent array swaps
//     their sort_order on read-back; no Intentions-card row exists
//     or can be created (A1.2a).
//   6 commit acceptance (the §2.2 structural fix): a replace-day
//     commit carrying ext-bible-in-a-year in Evening answers 200
//     (under the v324 pin it 400'd — v328 is what makes a lawful
//     Settings edit shippable); the externals-route swap answers
//     200 too; an unknown external id still 400s; block "bogus"
//     still 400s.
//   7 parse + boot: the served /app.js parses; the shell boots; the
//     served / carries the gear; renderSettings against the
//     instance's own data renders 23 rows in the seed's sections
//     and order.
//   8 the served /sw.js names ora-pro-nobis-v334-1 (v334 Implement named update — v328's own check expected its own name; the pin follows the trunk's rename).
// Runs against THIS worktree's app only (own wrangler dev + own
// miniflare state under /tmp). The shared checkout is never a
// wrangler cwd.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const APP = path.resolve(process.cwd(), "app");
if (APP === "/home/hatch/workspace/projects/spotify_praylist-fork/app") {
  console.error("REFUSING to run against the shared checkout — run from the release worktree");
  process.exit(2);
}
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 8978;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "harness-token";
const ADMIN = { "x-test-actor": "admin" };
const DOOR = { authorization: `Bearer ${TOKEN}` };
const STATE = mkdtempSync(path.join(tmpdir(), "opn-v328-"));
const SEED = JSON.parse(readFileSync(path.join(APP, "tests/fixtures/v328/settings-seed.json"), "utf8"));

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`ok ${pass + fail} - ${name}`); }
  else { fail++; console.log(`FAIL ${pass + fail} - ${name} ${extra}`); }
};
const sqlQuote = (v) => (v === null || v === undefined) ? "NULL" : (typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
function d1exec(sql) {
  const toml = path.join(APP, "wrangler.toml");
  const out = execFileSync(path.join(APP, "../node_modules/.bin/wrangler"),
    ["d1", "execute", "DB", "--local", "--config", toml, "--persist-to", STATE, "--json", "--command", sql],
    { cwd: APP, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(out.slice(out.indexOf("[")));
}
function applySchema() {
  // The mold (harness-v324/v333): concatenate every migration in
  // order and apply the whole file to the scratch D1.
  const all = readdirSync(path.join(APP, "migrations")).filter((x) => x.endsWith(".sql")).sort()
    .map((f) => readFileSync(path.join(APP, "migrations", f), "utf8")).join("\n");
  const tmp = path.join(APP, ".wrangler-test-v328-schema.sql");
  writeFileSync(tmp, all);
  execFileSync(path.join(APP, "../node_modules/.bin/wrangler"),
    ["d1", "execute", "DB", "--local", "--config", path.join(APP, "wrangler.toml"), "--persist-to", STATE, "--file", tmp],
    { cwd: APP, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
async function req(method, p, { headers = {}, body } = {}) {
  const r = await fetch(BASE + p, { method, headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { /* keep raw */ }
  return { status: r.status, body: parsed, text };
}
const keyed = (sources) => Object.fromEntries(sources.map((s) => [s.sourceKey, s]));
const sameRow = (a, b) => ["sourceKey", "name", "family", "block", "dayRule", "sortOrder", "enabled", "slotId", "role"]
  .every((f) => (a[f] ?? null) === (b[f] ?? null));

let proc;
try {
  // Port-collision guard (the estate's recurring orphan class): if
  // anything already answers on the port, it is NOT this run's
  // server — its D1 is some other run's state and every HTTP leg
  // would silently test the wrong instance. Refuse loudly instead.
  const portBusy = await fetch(BASE + "/", { signal: AbortSignal.timeout(2000) }).then(() => true).catch(() => false);
  if (portBusy) throw new Error(`port ${PORT} already answers — an orphaned wrangler holds it; kill it before running this harness`);
  applySchema(); // the scratch D1 stands before the server boots
  const wrangler = path.join(APP, "../node_modules/.bin/wrangler");
  proc = spawn(wrangler, ["dev", "--local", "--config", path.join(APP, "wrangler.toml"),
    "--port", String(PORT), "--persist-to", STATE, "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"],
    { cwd: APP, env: { ...process.env, CLOUDFLARE_API_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  // The server's own log is evidence: keep it (a silent drain cost
  // this harness its first diagnosis).
  const wlog = createWriteStream("/tmp/harness-v328-wrangler.log");
  proc.stdout.on("data", (d) => wlog.write(d));
  proc.stderr.on("data", (d) => wlog.write(d));
  // This Worker has no /health route (it 404s by design); the
  // estate's waitUp polls / and accepts any HTTP answer.
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    try { const r = await fetch(BASE + "/"); up = !!r.status; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  if (!up) throw new Error("wrangler dev never became healthy");

  // ---------- leg 1: the seed, field by field ----------
  // The schema (applied above, before boot) is the migrations' own
  // product, concatenated in order — the estate mold: 0010's seed
  // must stand exactly as §2.1 pins it.
  ok("leg1: migrations 0001-0010 applied clean to a fresh D1 (before boot)", true);
  const rows = d1exec("SELECT source_key, name, family, block, day_rule, sort_order, enabled, slot_id, role FROM player_source_settings")[0].results;
  ok("leg1: exactly 23 seed rows", rows.length === 23, `got ${rows.length}`);
  const seedByKey = keyed(SEED.sources);
  const fieldEq = rows.every((r) => {
    const s = seedByKey[r.source_key];
    return s && s.name === r.name && s.family === r.family && s.block === r.block && s.dayRule === r.day_rule
      && s.sortOrder === r.sort_order && s.enabled === r.enabled && s.slotId === r.slot_id && s.role === r.role;
  });
  ok("leg1: every seed row equal to §2.1 on every field", fieldEq);
  const meta = d1exec("SELECT version FROM player_settings_meta WHERE id=1")[0].results;
  ok("leg1: meta version stands at 1 (the untouched seed)", meta.length === 1 && meta[0].version === 1, JSON.stringify(meta));

  // ---------- leg 2: door auth + payload ----------
  const noTok = await req("GET", "/api/agent/player/settings");
  ok("leg2: door read without a token -> 403", noTok.status === 403, `${noTok.status}`);
  const badTok = await req("GET", "/api/agent/player/settings", { headers: { authorization: "Bearer wrong" } });
  ok("leg2: door read with a wrong token -> 403", badTok.status === 403, `${badTok.status}`);
  const doorGet = await req("GET", "/api/agent/player/settings", { headers: DOOR });
  ok("leg2: door read -> 200 {version: 1, sources: 23}",
    doorGet.status === 200 && doorGet.body?.version === 1 && doorGet.body?.sources?.length === 23,
    `${doorGet.status} ${doorGet.text.slice(0, 120)}`);
  const doorByKey = keyed(doorGet.body?.sources ?? []);
  ok("leg2: door payload equals the seed fixture on every field",
    Object.keys(doorByKey).length === 23 && Object.values(doorByKey).every((r) => sameRow(r, seedByKey[r.sourceKey])));
  const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
  const rank = (b) => (b === "" ? 6 : BLOCKS.indexOf(b));
  const ordered = (doorGet.body?.sources ?? []).every((s, i, a) => i === 0 || (() => {
    const p = a[i - 1];
    return rank(p.block) < rank(s.block)
      || (rank(p.block) === rank(s.block) && ((p.sortOrder ?? 1e9) < (s.sortOrder ?? 1e9)
        || ((p.sortOrder ?? 1e9) === (s.sortOrder ?? 1e9) && p.name <= s.name)));
  })());
  ok("leg2: payload order = block order, then sort_order, then name", ordered);

  // ---------- leg 3: session parity ----------
  const sessGet = await req("GET", "/api/player/source-settings");
  ok("leg3: session GET body identical to the door GET",
    sessGet.status === 200 && JSON.stringify(sessGet.body) === JSON.stringify(doorGet.body),
    `${sessGet.status}`);

  // ---------- leg 4: PUT validation + version ----------
  const asPutRows = (sources) => sources.map((s) => ({ sourceKey: s.sourceKey, block: s.block, dayRule: s.dayRule, enabled: s.enabled }));
  const base = asPutRows(doorGet.body.sources);
  const badBlock = base.map((r) => ({ ...r })); badBlock[0].block = "Bogus";
  const r1 = await req("PUT", "/api/player/source-settings", { body: { sources: badBlock } });
  ok("leg4: bad block -> 400, naming the fault", r1.status === 400 && /bad block/.test(r1.body?.error ?? ""), `${r1.status} ${r1.text.slice(0, 100)}`);
  const badRule = base.map((r) => ({ ...r })); badRule[0].dayRule = "monthly";
  const r2 = await req("PUT", "/api/player/source-settings", { body: { sources: badRule } });
  ok("leg4: bad dayRule -> 400", r2.status === 400 && /bad dayRule/.test(r2.body?.error ?? ""), `${r2.status}`);
  const badKey = base.map((r) => ({ ...r })); badKey[0].sourceKey = "not-a-source";
  const r3 = await req("PUT", "/api/player/source-settings", { body: { sources: badKey } });
  ok("leg4: unknown sourceKey -> 400", r3.status === 400 && /unknown sourceKey/.test(r3.body?.error ?? ""), `${r3.status}`);
  const r4 = await req("PUT", "/api/player/source-settings", { body: { sources: base.slice(1) } });
  ok("leg4: a missing row -> 400 (the set must be exact)", r4.status === 400, `${r4.status}`);
  const afterBad = await req("GET", "/api/agent/player/settings", { headers: DOOR });
  ok("leg4: refused PUTs wrote nothing — version still 1, rows still the seed",
    afterBad.body?.version === 1 && Object.values(keyed(afterBad.body.sources)).every((r) => sameRow(r, seedByKey[r.sourceKey])));
  const move = base.map((r) => (r.sourceKey === "bible-in-a-year" ? { ...r, block: "Evening" } : { ...r }));
  const r5 = await req("PUT", "/api/player/source-settings", { body: { sources: move } });
  ok("leg4: a lawful edit answers {ok, version: 2}", r5.status === 200 && r5.body?.ok === true && r5.body?.version === 2,
    `${r5.status} ${r5.text.slice(0, 100)}`);
  const gapless = (sources, block) => {
    const ns = sources.filter((s) => s.block === block && s.enabled === 1).map((s) => s.sortOrder).sort((a, b) => a - b);
    return ns.every((n, i) => n === i + 1);
  };
  const afterMove = await req("GET", "/api/agent/player/settings", { headers: DOOR });
  const moved = keyed(afterMove.body.sources)["bible-in-a-year"];
  ok("leg4: Bible in a Year stands in Evening; Morning and Evening sort_order both gapless",
    moved.block === "Evening" && gapless(afterMove.body.sources, "Morning") && gapless(afterMove.body.sources, "Evening"),
    JSON.stringify(moved));
  const rename = asPutRows(afterMove.body.sources).map((r) =>
    (r.sourceKey === "bible-in-a-year" ? { ...r, name: "Renamed By Hand", family: "own", slotId: null, role: "fallback" } : r));
  const r6 = await req("PUT", "/api/player/source-settings", { body: { sources: rename } });
  const afterRename = await req("GET", "/api/agent/player/settings", { headers: DOOR });
  const renamed = keyed(afterRename.body.sources)["bible-in-a-year"];
  ok("leg4: name/family/slotId/role are server-owned — a rename attempt changes none of them",
    r6.status === 200 && renamed.name === "Bible in a Year" && renamed.family === "external"
    && renamed.slotId === "ext-bible-in-a-year" && renamed.role === "primary",
    JSON.stringify(renamed));

  // ---------- leg 5: reorder + the intentions exclusion ----------
  const cur = await req("GET", "/api/agent/player/settings", { headers: DOOR });
  const swapRows = asPutRows(cur.body.sources);
  const iMp = swapRows.findIndex((r) => r.sourceKey === "morning-prayer");
  const iDr = swapRows.findIndex((r) => r.sourceKey === "daily-rosary");
  [swapRows[iMp], swapRows[iDr]] = [swapRows[iDr], swapRows[iMp]];
  const r7 = await req("PUT", "/api/player/source-settings", { body: { sources: swapRows } });
  const afterSwap = await req("GET", "/api/agent/player/settings", { headers: DOOR });
  const byKey5 = keyed(afterSwap.body.sources);
  ok("leg5: reordering the sent array reorders the read-back (Rosary 1, Morning Prayer 2)",
    r7.status === 200 && byKey5["daily-rosary"].sortOrder === 1 && byKey5["morning-prayer"].sortOrder === 2,
    `rosary=${byKey5["daily-rosary"]?.sortOrder} mp=${byKey5["morning-prayer"]?.sortOrder}`);
  ok("leg5: no Intentions-card row exists in the settings",
    !Object.keys(byKey5).some((k) => /intention/i.test(k)) && !Object.values(byKey5).some((s) => /intention/i.test(s.name)));
  const withIntentions = [...swapRows, { sourceKey: "intentions-card", block: "Morning", dayRule: "daily", enabled: 1 }];
  const r8 = await req("PUT", "/api/player/source-settings", { body: { sources: withIntentions } });
  ok("leg5: an Intentions row cannot be created (unknown sourceKey -> 400)", r8.status === 400, `${r8.status}`);

  // ---------- leg 6: commit acceptance (the §2.2 fix) ----------
  const ownMissing = { episode_id: "morning-prayer", title: "Morning Prayer", block: "Morning", sort: 100100, duration_s: 0, size_bytes: 0, audio_state: "missing", text_state: "missing" };
  const extInEvening = { episode_id: "ext-bible-in-a-year", title: "Bible in a Year", block: "Evening", sort: 500300, duration_s: 0, size_bytes: 0, audio_state: "missing", kind: "external", source: "Bible in a Year", stream_url: "" };
  const c1 = await req("POST", "/api/agent/player/day", { headers: DOOR, body: { date: "2026-11-09", episodes: [ownMissing, extInEvening] } });
  ok("leg6: replace-day commit with the external in Evening -> 200 (the lawful edit no longer 400s)",
    c1.status === 200 && c1.body?.ok === true, `${c1.status} ${c1.text.slice(0, 140)}`);
  // The swap is 9-for-9 by design (the route replaces the day's
  // external set atomically): send all nine, with Bible in a Year
  // carrying Morning — the block the settings edit moved it FROM.
  const nine = [
    ["ext-invitatory", "Morning"], ["ext-morning-prayer", "Morning"], ["ext-bible-in-a-year", "Morning"],
    ["ext-midmorning-prayer", "Midmorning"], ["ext-midday-prayer", "Midday"], ["ext-midafternoon-prayer", "Afternoon"],
    ["ext-office-of-readings", "Evening"], ["ext-evening-prayer", "Evening"], ["ext-night-prayer", "Night"],
  ].map(([id, block], i) => ({ episode_id: id, title: id, block, sort: 900 + i + 1, duration_s: 0, size_bytes: 0, audio_state: "missing", source: "Divine Office", stream_url: "" }));
  const swap = await req("POST", "/api/agent/player/externals", { headers: DOOR, body: { date: "2026-11-09", tracks: nine } });
  ok("leg6: externals-route block swap -> 200", swap.status === 200 && swap.body?.ok === true, `${swap.status} ${swap.text.slice(0, 120)}`);
  const c2 = await req("POST", "/api/agent/player/day", { headers: DOOR, body: { date: "2026-11-09", episodes: [{ ...extInEvening, episode_id: "ext-nope" }] } });
  ok("leg6: an unknown external id still -> 400", c2.status === 400, `${c2.status}`);
  const c3 = await req("POST", "/api/agent/player/day", { headers: DOOR, body: { date: "2026-11-09", episodes: [{ ...extInEvening, block: "bogus" }] } });
  ok("leg6: block 'bogus' still -> 400", c3.status === 400, `${c3.status}`);

  // ---------- leg 7: parse + boot + the screen renders ----------
  const appJs = await (await fetch(BASE + "/app.js")).text();
  let parses = true; try { new vm.Script(appJs); } catch { parses = false; }
  ok("leg7: the served /app.js parses", parses);
  const shell = await (await fetch(BASE + "/")).text();
  ok("leg7: the served shell carries the brand-bar gear", shell.includes('id="gearbtn"'));
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector("#gearbtn", { timeout: 20000 });
    await page.click("#gearbtn");
    await page.waitForSelector(".setrow", { timeout: 20000 });
    const rendered = await page.evaluate(() => ({
      rows: document.querySelectorAll(".setrow").length,
      sections: [...document.querySelectorAll(".blockhead h2")].map((h) => h.textContent),
      firstRows: [...document.querySelectorAll(".setrow .setname")].slice(0, 4).map((n) => n.textContent),
      h1: document.querySelector("h1")?.textContent ?? "",
      antiphonNote: [...document.querySelectorAll(".setrow .meta")].some((m) => m.textContent.includes("One antiphon episode is produced each day")),
    }));
    ok("leg7: renderSettings renders all 23 rows", rendered.rows === 23, `rows=${rendered.rows}`);
    ok("leg7: sections stand in the standing order with the seed's first rows, and the Antiphon flag shows",
      rendered.h1 === "Settings"
      && rendered.sections.join("|") === "MORNING|MIDMORNING|MIDDAY|AFTERNOON|EVENING|NIGHT|OFF"
      && rendered.firstRows.join("|") === "Daily Rosary|Morning Prayer|Marian Antiphon — Angelus|Divine Office — Invitatory"
      && rendered.antiphonNote,
      JSON.stringify(rendered));
  } finally { await browser.close(); }

  // ---------- leg 8: the service worker name ----------
  const sw = await (await fetch(BASE + "/sw.js")).text();
  ok("leg8: the served /sw.js names ora-pro-nobis-v334-1", sw.includes("ora-pro-nobis-v334-1"));
} finally {
  // Kill the whole process GROUP: wrangler's workerd grandchildren
  // survive a plain proc.kill and hold the port as orphans.
  if (proc) { try { process.kill(-proc.pid, "SIGKILL"); } catch { proc.kill("SIGKILL"); } }
}
console.log(`harness-v328: ${pass} ok / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
