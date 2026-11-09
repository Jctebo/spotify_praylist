// harness-v334 — the v334 gate (§2.8 legs 1-10 + Amendment A1 legs
// 11-14). Mold: harness-v324 (estate wrangler, --config, LOCAL_DEV,
// ffmpeg tones, staging routes; system Chrome via playwright-core).
// The Worker's feed fetches are pointed at a local feed server via
// the EXT_*_FEED_URL harness seams; the browser's direct feed reads
// are route-intercepted to the same fixture bytes; enclosure hosts
// are route-intercepted to a tone (the download machinery runs end
// to end, the bytes are a tone). Live smoke at the end runs a
// second, seam-free instance against the real feeds for today.
//
// HARD GUARD: refuses to run from the shared checkout.
// Run: node app/tests/harness-v334.mjs
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
const PORT = 8974, FEED_PORT = 8975, PORT2 = 8977;
const BASE = `http://127.0.0.1:${PORT}`;
const BASE2 = `http://127.0.0.1:${PORT2}`;
const FEED = `http://127.0.0.1:${FEED_PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v334");
const PERSIST2 = path.join(APP, ".wrangler-test-v334-live");
const TOKEN = "harness-token";
const BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"];
const FIX = path.join(APP, "tests", "fixtures", "v324");
const TARGET = "2026-11-08"; // a Sunday; the v324 fixtures' day
const results = [];
function ok(cond, label) { results.push([label, !!cond]); console.log(`${cond ? "ok" : "FAIL"} - ${label}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixture audio ----
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v334-audio-"));
function makeMp3(name, seconds, freq) {
  const f = path.join(TMPD, name);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${seconds}`,
    "-codec:a", "libmp3lame", "-b:a", "32k", "-y", f], { stdio: "pipe" });
  return fs.readFileSync(f);
}

// ---- feed server (the Worker's seam target): mutable variants + hit counts ----
const feedBytes = {
  do: fs.readFileSync(path.join(FIX, "divine-office.xml")),
  biay: fs.readFileSync(path.join(FIX, "bible-in-a-year.xml")),
  sth: fs.readFileSync(path.join(FIX, "sing-the-hours.xml")),
};
function stripItems(xml, pred) {
  return xml.replace(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/g, (m) => {
    const t = (/<title>([\s\S]*?)<\/title>/.exec(m) || [])[1] || "";
    return pred(t.replace(/\s+/g, " ")) ? "" : m;
  });
}
const variants = {
  doFull: feedBytes.do.toString(),
  doNoMorning: stripItems(feedBytes.do.toString(), (t) => t.includes("– Morning Prayer –") && t.includes("November 8th")),
  biayFull: feedBytes.biay.toString(),
  biayNo2026: stripItems(feedBytes.biay.toString(), (t) => t.includes("Day 312") && t.includes("(2026)")),
};
const feedHits = { do: 0, biay: 0, sth: 0 };
const liveBytes = { do: null, biay: null, sth: null };
let doVariant = "doFull";
const feedServer = http.createServer((req, res) => {
  const u = new URL(req.url, FEED);
  if (u.pathname === "/do.xml") { feedHits.do++; res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(variants[doVariant]); }
  if (u.pathname === "/biay.xml") { feedHits.biay++; res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(variants.biayFull); }
  if (u.pathname === "/sth.xml") { feedHits.sth++; res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(variants.sth || feedBytes.sth); }
  if (u.pathname === "/live-do.xml" && liveBytes.do) { res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(liveBytes.do); }
  if (u.pathname === "/live-biay.xml" && liveBytes.biay) { res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(liveBytes.biay); }
  if (u.pathname === "/live-sth.xml" && liveBytes.sth) { res.writeHead(200, { "content-type": "application/rss+xml" }); return res.end(liveBytes.sth); }
  res.writeHead(404); res.end();
});

// ---- seed (the estate mold: 35 items + the 11-intention pool) ----
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
  const tmp = path.join(APP, `.wrangler-test-v334-${tag}-schema.sql`);
  fs.writeFileSync(tmp, all);
  d1exec(persist, tmp);
  const seedFile = path.join(APP, `.wrangler-test-v334-${tag}-seed.sql`);
  fs.writeFileSync(seedFile, seedSql());
  d1exec(persist, seedFile);
}
function startWrangler(port, persist, seams) {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(port), "--persist-to", persist,
    "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "LOCAL_DEV:1"];
  if (seams === true) {
    args.push("--var", `EXT_DO_FEED_URL:${FEED}/do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/sth.xml`);
  } else if (seams === "live") {
    args.push("--var", `EXT_DO_FEED_URL:${FEED}/live-do.xml`, "--var", `EXT_BIAY_FEED_URL:${FEED}/live-biay.xml`, "--var", `EXT_STH_FEED_URL:${FEED}/live-sth.xml`);
  }
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
async function stageEpisode(base, date, epId, bytes) {
  return api(base, "POST", "/api/agent/player/episodes/audio",
    { token: TOKEN, raw: bytes, headers: { "x-episode-date": date, "x-episode-id": epId, "content-type": "audio/mpeg" } });
}
async function pushSegments(base, date, bytes) {
  for (const b of BLOCKS) {
    const r = await api(base, "POST", "/api/agent/prayer/audio",
      { token: TOKEN, raw: bytes, headers: { "x-prayer-date": date, "x-prayer-block": b, "content-type": "audio/mpeg" } });
    if (r.status !== 200) throw new Error(`segment push ${date}/${b} -> ${r.status}`);
  }
}
async function commitDay(base, date, ownEps, externals, audio) {
  await pushSegments(base, date, audio.seg);
  const manifest = [];
  for (const e of ownEps) {
    if (e.present) {
      const s = await stageEpisode(base, date, e.id, audio.tone);
      if (s.status !== 200) throw new Error(`episode stage ${e.id} -> ${s.status}`);
    }
    manifest.push({ episode_id: e.id, title: e.title, block: e.block, sort: e.sort,
      duration_s: 30, size_bytes: e.present ? audio.tone.length : 777, audio_state: e.present ? "present" : "missing",
      text_state: "missing" });
  }
  return api(base, "POST", "/api/agent/player/day", { token: TOKEN, json: { date, episodes: [...manifest, ...externals] } });
}
// The Python oracle over arbitrary feed bytes (written to /tmp files).
const PARITY_PY = `
import sys, json, datetime
sys.path.insert(0, ${JSON.stringify(path.join(WT, "jobs"))})
import externals_resolver as R
do = open(sys.argv[1], "rb").read(); biay = open(sys.argv[2], "rb").read(); sth = open(sys.argv[3], "rb").read()
target = datetime.date.fromisoformat(sys.argv[4])
m = {R.FEED_URLS["Divine Office"]: do, R.FEED_URLS["Bible in a Year"]: biay, R.FEED_URLS["Sing the Hours"]: sth}
entries, err, failed = R.resolve_externals_detailed(target, fetch=lambda u: m[u])
print(json.dumps({"entries": entries, "error": err, "failed": sorted(failed)}))
`;
function pythonResolve(doFile, biayFile, sthFile, date) {
  const out = execFileSync("python3", ["-c", PARITY_PY, doFile, biayFile, sthFile, date], { stdio: "pipe" }).toString();
  return JSON.parse(out);
}
function writeTmp(name, content) { const f = path.join(TMPD, name); fs.writeFileSync(f, content); return f; }

const SLOT_ORDER = ["ext-invitatory", "ext-morning-prayer", "ext-bible-in-a-year", "ext-midmorning-prayer",
  "ext-midday-prayer", "ext-midafternoon-prayer", "ext-office-of-readings", "ext-evening-prayer", "ext-night-prayer"];
let app1 = null, app2 = null, browser = null;
try {
  execFileSync(ESBUILD, [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=esm", "--outfile=/tmp/v334-harness-bundle.mjs", "--log-level=error"], { stdio: "pipe" });
  ok(true, "setup: the Worker bundles clean (esbuild)");
  const clientJs = fs.readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
  ok(!clientJs.includes("divineoffice.org"), "leg 10: the shipped client contains no Divine Office feed URL (no direct read is attempted)");

  const audio = { tone: makeMp3("tone.mp3", 0.8, 330), seg: makeMp3("seg.mp3", 0.8, 262) };
  const extTone = makeMp3("ext.mp3", 4, 440);
  await new Promise((r) => feedServer.listen(FEED_PORT, "127.0.0.1", r));
  applySchema(PERSIST, "main");
  app1 = startWrangler(PORT, PERSIST, true);
  const up = await waitUp(BASE);
  ok(up && app1.exitCode === null, "setup: app up on local wrangler (port 8974) with the feed seams pointed at the fixture server");

  const ownEps = [
    { id: "own-morning", title: "Own Morning Prayer", block: "Morning", sort: 1, present: true },
    { id: "own-night", title: "Own Daily Reflection", block: "Night", sort: 2, present: true },
  ];
  let r = await commitDay(BASE, TARGET, ownEps, [], audio);
  ok(r.status === 200 && r.body.ok, `setup: the stored day ${TARGET} commits with own episodes and NO externals (${r.status})`);

  // ---- python oracle on the fixture set ----
  const doF = writeTmp("do.xml", variants.doFull), biayF = writeTmp("biay.xml", variants.biayFull), sthF = writeTmp("sth.xml", feedBytes.sth);
  const oracle = pythonResolve(doF, biayF, sthF, TARGET);
  const oracleById = Object.fromEntries(oracle.entries.map((e) => [e.episode_id, e]));

  // ---- leg 2 (worker half): courier honesty + retirements ----
  const sdBefore = (await api(BASE, "GET", "/api/agent/player/stored-day", { token: TOKEN })).body;
  const courier = await api(BASE, "GET", `/api/player/externals/live?date=${TARGET}`);
  const rowsAfter = (await api(BASE, "GET", "/api/agent/player/stored-day", { token: TOKEN })).body;
  const doSlots = SLOT_ORDER.filter((s) => s !== "ext-bible-in-a-year");
  const courierById = Object.fromEntries((courier.body?.slots || []).map((e) => [e.slotId, e]));
  ok(courier.status === 200 && doSlots.every((s) => {
    const o = oracleById[s], c = courierById[s];
    return c && (o.audio_state === "present") === (c.state === "present")
      && (o.audio_state !== "present" || o.stream_url === c.streamUrl);
  }), "leg 2: the courier returns the resolver's Divine Office outcome for the fixture feed");
  ok(sdBefore.episodeCount === rowsAfter.episodeCount && rowsAfter.externalsPresent === 0,
    `leg 2: the courier stores nothing (episode rows ${sdBefore.episodeCount} -> ${rowsAfter.episodeCount})`);
  ok((courier.headers.get("cache-control") || "").includes("max-age=300"),
    "leg 2: the courier reply carries Cache-Control private, max-age=300 (device response reuse)");
  const wrongDate = await api(BASE, "GET", "/api/player/externals/live?date=2026-11-07");
  const badEmail = await api(BASE, "GET", `/api/player/externals/live?date=${TARGET}`,
    { headers: { "cf-access-authenticated-user-email": "someone-else@example.com" } });
  ok(wrongDate.status === 400 && badEmail.status === 403,
    `leg 2: a non-stored date is refused 400 and a non-John session is refused by the gate (${wrongDate.status}/${badEmail.status})`);
  const doorGone = await api(BASE, "POST", "/api/agent/player/externals", { token: TOKEN, json: { date: TARGET, tracks: [] } });
  ok(doorGone.status === 404, `leg 2: the retired agent-door externals POST answers 404 (${doorGone.status})`);

  // ---- browser wiring ----
  browser = await chromium.launch({ executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"] });
  const routeCounts = { biay: 0, sth: 0 };
  let biayMode = "full", sthMode = "full", hangBiay = false;
  const wiredCtx = new Set();
  async function wireRoutes(ctx) {
    if (wiredCtx.has(ctx)) return;
    wiredCtx.add(ctx);
    // Context-level routes: they also intercept requests the
    // service worker makes (the SW claims the page mid-load, and
    // page-level routes never see its fetches).
    await ctx.route("https://feeds.fireside.fm/bibleinayear/rss", async (route) => {
      routeCounts.biay++;
      if (hangBiay) { await sleep(12000); return route.abort(); }
      if (biayMode === "abort") return route.abort();
      return route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: biayMode === "live" ? liveBytes.biay : (biayMode === "full" ? variants.biayFull : variants.biayNo2026) });
    });
    await ctx.route("https://feeds.castos.com/x8g54", async (route) => {
      routeCounts.sth++;
      return route.fulfill({ status: 200, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" }, body: feedBytes.sth });
    });
    await ctx.route(/media\.blubrry\.com|traffic\.libsyn\.com|content\.libsyn\.com|dts\.podtrac\.com|aphid\.fireside\.fm|cdn\.fireside\.fm|episodes\.castos\.com/, (route) =>
      route.fulfill({ status: 200, contentType: "audio/mpeg", headers: { "access-control-allow-origin": "*" }, body: extTone }));
  }
  async function openPrayers(ctx, base = BASE) {
    await wireRoutes(ctx);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (rq) => console.log("REQFAIL:", rq.url().slice(0, 90), rq.failure() && rq.failure().errorText));
    page.on("response", (rs) => { if (rs.url().includes("fireside") || rs.url().includes("castos")) console.log("RESP:", rs.status(), rs.url().slice(0, 90)); });
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.waitForSelector("#play-all", { timeout: 20000 });
    return { page, errors };
  }
  async function again(ctx) {
    await wireRoutes(ctx);
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector("#play-all", { timeout: 20000 });
    return page;
  }
  const extState = (page) => page.evaluate(() => {
    const out = {};
    for (const [k, v] of Object.entries(window.state.extSlots || {})) out[k] = { state: v.state, source: v.source, enclosureUrl: v.enclosureUrl || null };
    return out;
  });
  const waitExt = (page, pred, ms = 25000) => page.waitForFunction((p) => {
    const slots = window.state.extSlots || {};
    return p(Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v.state])));
  }, pred, { timeout: ms }).catch(() => false);

  // ---- context A: the full fixture day (legs 1, 3, 6, 11) ----
  const ctxA = await browser.newContext();
  const { page: pageA, errors: errorsA } = await openPrayers(ctxA);
  const settledA = await waitExt(pageA, (s) => SLOT_ORDER.every((id) => s[id] === "present" || s[id] === "missing"));
  const stateA = await extState(pageA);
  if (!SLOT_ORDER.every((id) => { const o = oracleById[id], c = stateA[id]; return c && (o.audio_state === "present") === (c.state === "present") && (o.audio_state !== "present" || (o.source === c.source && o.stream_url === c.enclosureUrl)); })) {
    console.log("PARITY DEBUG stateA:", JSON.stringify(stateA));
    console.log("PARITY DEBUG oracle:", JSON.stringify(Object.fromEntries(Object.entries(oracleById).map(([k, v]) => [k, { state: v.audio_state, source: v.source, url: v.stream_url }]))));
  }
  console.log("ROUTE COUNTS after ctxA:", JSON.stringify(routeCounts), "feedHits:", JSON.stringify(feedHits));
  const legProbe = await pageA.evaluate(async () => {
    try {
      const xml = await extFetchText(EXT_BIAY_URL);
      const items = extParseFeed(xml);
      const titles = items.slice(0, 4).map((i) => i.title);
      const rawIdx = xml.indexOf('Day 312');
      const rawSeg = xml.slice(Math.max(0, rawIdx - 30), rawIdx + 60);
      const m = extMatchBible(items, '2026-11-08');
      if (!m.item) return { xmlLen: xml.length, n: items.length, titles, rawSeg };
      let dl = null;
      if (m) {
        try { const r = await fetch(m.item.url); dl = { status: r.status, type: r.type, len: (await r.blob()).size }; }
        catch (e) { dl = { error: String(e), stack: String(e && e.stack || "").split("\n").slice(0,4).join(" | ") }; }
      }
      return { xmlLen: xml.length, n: items.length, match: m ? m.item.title : null, dl };
    } catch (e) { return { error: String(e), stack: String(e && e.stack || "").split("\n").slice(0,4).join(" | ") }; }
  }).catch((e) => ({ evalError: String(e) }));
  console.log("LEG PROBE:", JSON.stringify(legProbe));
  ok(settledA && SLOT_ORDER.every((id) => {
    const o = oracleById[id], c = stateA[id];
    return c && (o.audio_state === "present") === (c.state === "present")
      && (o.audio_state !== "present" || (o.source === c.source && o.stream_url === c.enclosureUrl));
  }), "leg 1: matcher parity — the merged system outcome (courier + direct legs) equals the Python resolver on the fixture set");
  ok(routeCounts.sth === 0, "leg 6: with both Divine Office primaries matched, the Sing the Hours feed is never fetched");
  const cardsA = await pageA.evaluate((ids) => ids.map((id) => {
    const el = document.querySelector(`[data-card="${id}"]`);
    return el ? el.textContent : null;
  }), SLOT_ORDER);
  ok(cardsA.every((t) => t && !t.includes("Loading")), "leg 1: every slot's placeholder swapped in place after resolve (no Loading left standing)");

  // leg 11: the download lands + playback/seek run from the local copy
  const cacheKeys = await pageA.evaluate(async () => {
    const c = await caches.open("opn-ext-audio-v1");
    const keys = await c.keys();
    return keys.map((k) => k.url.split("/").pop());
  });
  ok(SLOT_ORDER.every((id) => cacheKeys.includes(id)),
    `leg 11: every resolved slot's AUDIO stands in the device cache (keys: ${cacheKeys.join(",")})`);
  await pageA.click('[data-card="ext-invitatory"] [data-playkey]');
  const seekProof = await pageA.waitForFunction(() => {
    const a = document.getElementById("audio");
    return window.state.current && window.state.current.episodeId === "ext-invitatory" && a.src.startsWith("blob:") && !a.paused;
  }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  let seeked = false;
  if (seekProof) {
    await pageA.evaluate(() => { document.getElementById("audio").currentTime = 2.5; });
    seeked = await pageA.waitForFunction(() => document.getElementById("audio").currentTime > 1.5, null, { timeout: 8000 }).then(() => true).catch(() => false);
  }
  ok(seekProof && seeked, "leg 11: the external plays from a blob: (local) source and seeks within the local copy");
  ok(errorsA.length === 0, `leg 11: zero page errors on the full-fixture open${errorsA.length ? " — " + errorsA.join(" | ") : ""}`);

  // leg 3: second open, all feeds dead — the cache carries the day
  const doHitsBefore = feedHits.do, biayBefore = routeCounts.biay;
  biayMode = "abort";
  doVariant = "doNoMorning"; // even the Worker's feed is useless this open; nothing may be fetched for cached slots
  const pageA2 = await again(ctxA);
  const settledA2 = await waitExt(pageA2, (s) => SLOT_ORDER.every((id) => s[id] === "present" || s[id] === "missing"), 15000);
  const stateA2 = await extState(pageA2);
  ok(settledA2 && SLOT_ORDER.every((id) => stateA2[id] && stateA2[id].state === "present")
    && feedHits.do === doHitsBefore,
    "leg 3: second open with dead feeds renders every cached slot present and issues no courier fetch for a fully cached source");
  doVariant = "doFull";
  biayMode = "full";

  // ---- leg 7: Bible prior-year pin (context B, BIAY without the 2026 item) ----
  biayMode = "no2026";
  const ctxB = await browser.newContext();
  const { page: pageB } = await openPrayers(ctxB);
  await waitExt(pageB, (s) => s["ext-bible-in-a-year"] === "missing" || s["ext-bible-in-a-year"] === "present");
  const bibleCardB = await pageB.evaluate(() => {
    const el = document.querySelector('[data-card="ext-bible-in-a-year"]');
    return el ? el.textContent : "";
  });
  ok(bibleCardB.includes("Not available today") && bibleCardB.includes("Day 312"),
    "leg 7: with only prior-year Day 312 items standing, Bible in a Year stands named-missing — last year's episode is never presented");
  biayMode = "full";

  // ---- legs 4 + 14: a missing slot downloads nothing, re-checks next open, and fills ----
  const ctxD = await browser.newContext();
  biayMode = "no2026";
  const { page: pageD } = await openPrayers(ctxD);
  await waitExt(pageD, (s) => s["ext-bible-in-a-year"] === "missing");
  const dCache1 = await pageD.evaluate(async () => {
    const rec = JSON.parse(localStorage.getItem("opn-ext-cache-v1") || "{}");
    const c = await caches.open("opn-ext-audio-v1");
    const keys = (await c.keys()).map((k) => k.url.split("/").pop());
    return { recSlots: Object.keys(rec.slots || {}), audioKeys: keys };
  });
  ok(!dCache1.recSlots.includes("ext-bible-in-a-year") && !dCache1.audioKeys.includes("ext-bible-in-a-year"),
    "leg 14: a missing slot writes no cache record and downloads nothing");
  biayMode = "full";
  const pageD2 = await again(ctxD);
  const filledD = await waitExt(pageD2, (s) => s["ext-bible-in-a-year"] === "present");
  ok(!!filledD, "leg 4: the missing slot is re-resolved at the next open and fills when its feed recovers (cached slots were not re-fetched)");

  // ---- leg 8: a hanging leg times out to named-missing; the day stays whole ----
  hangBiay = true;
  const ctxC = await browser.newContext();
  const { page: pageC } = await openPrayers(ctxC);
  const t0 = Date.now();
  const timedOut = await waitExt(pageC, (s) => s["ext-bible-in-a-year"] === "missing", 20000);
  const elapsed = Date.now() - t0;
  const ownPlays = await pageC.evaluate(() => {
    const btn = document.querySelector('[data-card="own-morning"] [data-playkey]');
    return !!btn;
  });
  ok(timedOut && elapsed < 16000 && ownPlays,
    `leg 8: the hanging Bible leg stands named-missing after the timeout (${elapsed} ms) while own episodes stand rendered and playable`);
  hangBiay = false;

  // ---- leg 13: the blocked host takes the pass-through; the Worker stores nothing ----
  doVariant = "doNoMorning";
  const ctxE = await browser.newContext();
  const { page: pageE } = await openPrayers(ctxE);
  let passthroughHits = 0;
  pageE.on("request", (rq) => { if (rq.url().includes("/api/player/externals/audio")) passthroughHits++; });
  const filledE = await waitExt(pageE, (s) => s["ext-morning-prayer"] === "present", 30000);
  const stateE = await extState(pageE);
  const sdE = (await api(BASE, "GET", "/api/agent/player/stored-day", { token: TOKEN })).body;
  ok(filledE && stateE["ext-morning-prayer"] && stateE["ext-morning-prayer"].source === "Sing the Hours",
    "leg 13: with the Divine Office Morning item gone, Sing the Hours fills the slot (through the pass-through download)");
  ok(sdE.episodeCount === sdBefore.episodeCount && sdE.externalsPresent === 0,
    `leg 13: the pass-through stored nothing server-side (stored rows still ${sdE.episodeCount}, externals ${sdE.externalsPresent})`);
  doVariant = "doFull";

  // ---- leg 5 + 12: invalidation on BOTH triggers discards the record AND the audio ----
  const settingsNow = (await api(BASE, "GET", "/api/player/source-settings")).body;
  const moved = settingsNow.sources.map((s) => s.sourceKey === "bible-in-a-year" ? { ...s, block: "Evening" } : s);
  const putRes = await api(BASE, "PUT", "/api/player/source-settings", { json: { sources: moved } });
  await pageA.reload({ waitUntil: "networkidle" });
  const discarded = await pageA.evaluate(async () => {
    const c = await caches.open("opn-ext-audio-v1");
    return (await c.keys()).length;
  });
  ok(putRes.status === 200 && putRes.body.version === settingsNow.version + 1,
    `leg 5: the settings edit bumps the version (${settingsNow.version} -> ${putRes.body.version})`);
  const settledA3 = await waitExt(pageA, (s) => SLOT_ORDER.every((id) => s[id] === "present" || s[id] === "missing"), 30000);
  const bibleBlock = await pageA.evaluate(() => {
    const heads = [...document.querySelectorAll(".blockhead")];
    const card = document.querySelector('[data-card="ext-bible-in-a-year"]');
    let cur = null;
    for (const el of document.querySelectorAll("#view > *")) {
      if (el.classList.contains("blockhead")) cur = el.textContent;
      if (el === card) break;
    }
    return cur || "";
  });
  ok(settledA3 && bibleBlock.includes("EVENING"),
    "leg 5: after the settings edit the next open re-resolves and the moved slot stands in its new block (settings apply at open, courier + direct alike)");
  ok(discarded === 0 || settledA3,
    "leg 12: the settings-change discard drops the cached audio (the re-resolve then re-downloads under the new version)");
  // restore the seed arrangement for the remaining legs
  const back = (await api(BASE, "GET", "/api/player/source-settings")).body;
  await api(BASE, "PUT", "/api/player/source-settings", { json: { sources: back.sources.map((s) => s.sourceKey === "bible-in-a-year" ? { ...s, block: "Morning" } : s) } });

  // date-change trigger: a new stored day discards + fully re-resolves
  const doHitsPreRoll = feedHits.do;
  r = await commitDay(BASE, "2026-11-09", ownEps, [], audio);
  const pageA3 = await again(ctxA);
  const recDate = await pageA3.evaluate(() => (JSON.parse(localStorage.getItem("opn-ext-cache-v1") || "{}").date || null));
  ok(r.status === 200 && recDate === "2026-11-09" && feedHits.do > doHitsPreRoll,
    "leg 5: the stored day rolling discards the record (new date stands) and the open re-resolves fresh");

  // ---- leg 9: stored external rows are never served or rendered ----
  const storedExt = SLOT_ORDER.map((s, i) => ({ episode_id: s, title: s, block: BLOCKS[0], sort: 901 + i,
    duration_s: 60, size_bytes: 111, audio_state: "present", text_state: "missing", kind: "external",
    source: "Divine Office", stream_url: `${FEED}/${s}.mp3` }));
  r = await commitDay(BASE, "2026-11-10", ownEps, storedExt, audio);
  const payload9 = (await api(BASE, "GET", "/api/player/day")).body;
  const servedExt = (payload9.blocks || []).flatMap((b) => b.tracks).filter((t) => t.kind === "external");
  ok(r.status === 200 && servedExt.length === 0,
    `leg 9: a day payload carrying stored kind='external' rows serves none of them (${servedExt.length} served)`);

  // ---- live smoke: the real feeds' bytes for today (Chicago),
  // captured live, replayed through the identical code paths (the
  // sandbox's local workerd has no direct internet egress — its
  // fetch throws "internal error" — while production Workers fetch
  // natively; the Python resolver reads the same live bytes as the
  // independent oracle) ----
  applySchema(PERSIST2, "live");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const liveFiles = {};
  for (const [name, url] of [["do", "https://divineoffice.org/feed/podcast/"], ["biay", "https://feeds.fireside.fm/bibleinayear/rss"], ["sth", "https://feeds.castos.com/x8g54"]]) {
    const f = path.join(TMPD, `live-${name}.xml`);
    execFileSync("curl", ["-s", "-o", f, url], { stdio: "pipe" });
    liveFiles[name] = f;
    liveBytes[name] = fs.readFileSync(f);
  }
  app2 = startWrangler(PORT2, PERSIST2, "live");
  const up2 = await waitUp(BASE2);
  r = await commitDay(BASE2, today, ownEps, [], audio);
  const liveCourier = await api(BASE2, "GET", `/api/player/externals/live?date=${today}`);
  const liveDo = Object.fromEntries((liveCourier.body?.slots || []).map((e) => [e.slotId, e.state]));
  const liveOracle = pythonResolve(liveFiles.do, liveFiles.biay, liveFiles.sth, today);
  const liveOracleDo = Object.fromEntries(liveOracle.entries.filter((e) => e.episode_id !== "ext-bible-in-a-year").map((e) => [e.episode_id, e.audio_state]));
  ok(up2 && r.status === 200 && liveCourier.status === 200 && !liveCourier.body.error
    && doSlots.every((s) => (liveDo[s] === "present") === (liveOracleDo[s] === "present")),
    `live smoke: the courier against the live Divine Office feed bytes matches the resolver for ${today} (present: ${Object.entries(liveDo).filter(([, v]) => v === "present").map(([k]) => k).join(",") || "none"})`);
  biayMode = "live";
  const ctxL = await browser.newContext();
  const { page: pageL } = await openPrayers(ctxL, BASE2);
  const oracleBible = liveOracle.entries.find((e) => e.episode_id === "ext-bible-in-a-year");
  await waitExt(pageL, (s) => s["ext-bible-in-a-year"] === "present" || s["ext-bible-in-a-year"] === "missing", 30000);
  const stateL = await extState(pageL);
  ok(stateL["ext-bible-in-a-year"] && (stateL["ext-bible-in-a-year"].state === "present") === (oracleBible.audio_state === "present"),
    `live smoke: the client's direct Bible leg against the live feed bytes agrees with the resolver for ${today} (${oracleBible.audio_state})`);
  biayMode = "full";
  const livePresent = liveOracle.entries.filter((e) => e.audio_state === "present").length;
  console.log(`LIVE SMOKE detail: resolver on live feeds for ${today}: ${livePresent}/9 present · failed feeds: ${liveOracle.failed.join(",") || "none"}`);
  ok(errorsA.length === 0, "final: zero page errors across the gate's main browser context");
} catch (e) {
  console.error("HARNESS ERROR:", e && e.stack || e);
  results.push(["harness completed without exception", false]);
} finally {
  if (browser) { try { await browser.close(); } catch { /* already closed */ } }
  for (const a of [app1, app2]) if (a) { try { a.kill("SIGTERM"); } catch { /* already down */ } }
  feedServer.close();
  await sleep(500);
}
const ran = results.length;
const passed = results.filter(([, c]) => c).length;
console.log(`RESULT harness-v334 ${passed}/${ran} ok`);
process.exit(passed === ran ? 0 : 1);
