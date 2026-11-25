// harness-v665.mjs — v665: The Saint of The Day Podcast
// stands as a series in Catechesis › Podcasts and in the
// Add ladder's Podcasts branch (the ladder enumerates the
// same Podcasts index payload, Plan §2.3).
//
// The REAL Worker bundle (esbuild of worker/src/index.ts)
// is driven through its real routes over a fake D1, with
// global fetch stubbed to the captured fixture feed.
// Modeled on harness-v663.mjs / harness-v657.mjs.
//
// Fixture (Improvement D — production source, named):
//  - ~/workspace/projects/ora-pro-nobis/v665-evidence/
//    buzzsprout-2216056-live-2026-11-25.xml — the REAL
//    feed, captured live at Plan 2026-11-25T17:33Z from
//    feeds.buzzsprout.com/2216056.rss: 299 items, head
//    "11/25 - St. Catherine of Alexandria", every item
//    GUID-keyed with an enclosure. Never invented.
//
// Legs (Plan §4):
//  F fixture facts (299 items · head · GUIDs · enclosures)
//  D def (stands in POD_RSS_SERIES_LIST between
//    daily-readings and ora-pro-nobis · title verbatim ·
//    window 500 · feedUrl reads the EXT_SAINT_FEED_URL
//    Env binding / constant — the same binding the
//    ext-saint-of-the-day slot resolver reads)
//  S series route over the fixture (real parser/build:
//    299 entries under window 500 · head title · every
//    entry GUID-keyed · available, kind rss)
//  B binding (no Env override -> the constant feed
//    address serves the same payload)
//  I index route (the saint entry stands, category
//    podcasts, total 299, between daily-readings and
//    ora-pro-nobis in payload order; standing entries
//    keep their seats — 14 entries total, was 13)
//
// Fail-on-old: on the base tree (def absent) the D, S, B
// and I legs fail — the series route answers no saint
// payload and the index carries 13 entries.
//
// Run: node app/worker/harness-v665.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const SRC = readFileSync(path.join(WT, "app/worker/src/index.ts"), "utf8");
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}

// ---------- F: the captured REAL feed ----------
const FEED_XML = readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/v665-evidence/buzzsprout-2216056-live-2026-11-25.xml"), "utf8");
function parseFixture(xml) {
  const out = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const guid = ((/<guid\b[^>]*>([\s\S]*?)<\/guid>/.exec(m[1]) || [])[1] || "").trim();
    const title = ((/<title>([\s\S]*?)<\/title>/.exec(m[1]) || [])[1] || "");
    const enc = /<enclosure\b/.test(m[1]);
    out.push({ guid, title, enc });
  }
  return out;
}
const FIX = parseFixture(FEED_XML);
check("F fixture: 299 items, head named, every item GUID + enclosure", FIX.length === 299 && FIX[0].title === "11/25 - St. Catherine of Alexandria" && FIX.every((x) => x.guid && x.enc) && new Set(FIX.map((x) => x.guid)).size === 299, FIX.slice(0, 1));

// ---------- D: the def, in source order ----------
{
  const listStart = SRC.indexOf("const POD_RSS_SERIES_LIST");
  const listEnd = SRC.indexOf("];", listStart);
  const list = SRC.slice(listStart, listEnd);
  const iDaily = list.indexOf('key: "daily-readings"');
  const iSaint = list.indexOf('key: "saint-of-the-day"');
  const iOpn = list.indexOf('key: "ora-pro-nobis"');
  check("D def stands in POD_RSS_SERIES_LIST between daily-readings and ora-pro-nobis", iDaily >= 0 && iSaint > iDaily && iOpn > iSaint, { iDaily, iSaint, iOpn });
  const saintLine = (list.slice(Math.max(0, iSaint - 20)).match(/\{ key: "saint-of-the-day"[^}]*\}/) || [])[0] || "";
  check("D def line: title verbatim from the feed channel, window 500", saintLine.includes('title: "The Saint of The Day Podcast"') && saintLine.includes("window: 500"), saintLine);
  check("D def line: feedUrl resolves to the EXT_SAINT_FEED_URL binding/constant (the slot resolver's own feed)", saintLine.includes("(env) => env.EXT_SAINT_FEED_URL || EXT_SAINT_FEED_URL"), saintLine);
}

// ---------- the real Worker bundle ----------
const TMP = mkdtempSync(tmpdir() + "/v665-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(WT, "app/worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;

// ---------- fake D1 ----------
const SEED_SETTINGS = [
  { source_key: "the-ai-signal", name: "The AI Signal", family: "own", block: "", day_rule: "daily", sort_order: 99, enabled: 1, slot_id: null, role: "" },
];
class FakeDB {
  constructor() { this.rss = new Map(); this.listens = new Map(); }
  prepare(sql) {
    const db = this;
    let args = [];
    const stmt = {
      bind(...a) { args = a; return stmt; },
      async first() {
        if (sql.includes("player_settings_meta")) return { version: 1 };
        if (sql.includes("SELECT payload FROM rss_snapshots")) { const r = db.rss.get(args[0]); return r ? { payload: r.payload } : null; }
        if (sql.includes("SELECT built_at FROM rss_snapshots")) { const r = db.rss.get(args[0]); return r ? { built_at: r.built_at } : null; }
        return null;
      },
      async all() {
        if (sql.includes("player_source_settings")) return { results: SEED_SETTINGS };
        if (sql.includes("FROM podcast_listens")) return { results: [...db.listens.values()].filter((v) => v.series === args[0]).map((v) => ({ seq_key: v.seq_key, listened_at: v.listened_at, listen_date: v.listen_date, source: v.source })) };
        return { results: [] };
      },
      async run() {
        if (sql.startsWith("INSERT INTO rss_snapshots")) { db.rss.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        return {};
      },
    };
    return stmt;
  }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
}

// ---------- fetch: the fixture feed stands, all else 404 ----------
const FIXTURE_URL = "https://fixture.local/saint";
const CONSTANT_URL = "https://feeds.buzzsprout.com/2216056.rss";
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u === FIXTURE_URL || u === CONSTANT_URL) return { ok: true, status: 200, headers: { get: () => null }, text: async () => FEED_XML };
  return { ok: false, status: 404, headers: { get: () => null }, text: async () => "no fixture" };
};
function makeEnv(db, extra) {
  return Object.assign({ DB: db, AGENT_TOKEN: "t", LOCAL_DEV: "1", AUDIO: { get: async () => null, put: async () => {} }, EXT_SAINT_FEED_URL: FIXTURE_URL }, extra || {});
}
async function get(env, p) {
  const res = await WORKER.fetch(new Request("https://app.local" + p), env);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ---------- S: the series route over the fixture ----------
const db = new FakeDB();
const env = makeEnv(db);
const seriesRes = await get(env, "/api/player/podcasts?series=saint-of-the-day");
const S = seriesRes.body;
check("S series route: kind rss, series saint-of-the-day, title verbatim, available", seriesRes.status === 200 && !!S && S.kind === "rss" && S.series === "saint-of-the-day" && S.title === "The Saint of The Day Podcast" && S.available === true, { status: seriesRes.status, title: S && S.title, available: S && S.available });
const S_ENTRIES = (S && S.entries) || [];
check("S real parser/build under window 500 yields all 299 entries", S_ENTRIES.length === 299 && !!S && S.total === 299, { n: S_ENTRIES.length, total: S && S.total });
check("S head entry title is the feed's head, titled as the feed titles it", S_ENTRIES.length > 0 && S_ENTRIES[0].title === "11/25 - St. Catherine of Alexandria", S_ENTRIES[0] && S_ENTRIES[0].title);
{
  const fixGuids = new Set(FIX.map((x) => x.guid));
  check("S every entry GUID-keyed (key = a feed GUID, all 299 distinct)", S_ENTRIES.length === 299 && S_ENTRIES.every((e) => fixGuids.has(e.key)) && new Set(S_ENTRIES.map((e) => e.key)).size === 299, S_ENTRIES.slice(0, 2).map((e) => e.key));
  check("S entries newest first (head pubMs >= second pubMs)", S_ENTRIES.length > 1 && (S_ENTRIES[0].publishedMs ?? 0) >= (S_ENTRIES[1].publishedMs ?? 0));
}

// ---------- B: the constant fallback ----------
{
  const db2 = new FakeDB();
  const env2 = makeEnv(db2); delete env2.EXT_SAINT_FEED_URL;
  const r2 = await get(env2, "/api/player/podcasts?series=saint-of-the-day");
  check("B no Env override: the def reads the EXT_SAINT_FEED_URL constant and serves 299", r2.status === 200 && !!r2.body && r2.body.available === true && ((r2.body.entries || []).length === 299), { status: r2.status, n: r2.body && r2.body.entries && r2.body.entries.length });
}

// ---------- I: the index route (the ladder's own payload) ----------
{
  const indexRes = await get(env, "/api/player/podcasts");
  const list = (indexRes.body && indexRes.body.seriesList) || [];
  const saintIdx = list.findIndex((s) => s.series === "saint-of-the-day");
  const dailyIdx = list.findIndex((s) => s.series === "daily-readings");
  const opnIdx = list.findIndex((s) => s.series === "ora-pro-nobis");
  check("I index carries the saint entry: kind rss, category podcasts, title verbatim, total 299, available", saintIdx >= 0 && list[saintIdx].kind === "rss" && list[saintIdx].category === "podcasts" && list[saintIdx].title === "The Saint of The Day Podcast" && list[saintIdx].total === 299 && list[saintIdx].available === true, list[saintIdx]);
  check("I index seat: saint between daily-readings and ora-pro-nobis; 14 entries total (13 standing + 1)", saintIdx > dailyIdx && saintIdx < opnIdx && dailyIdx >= 0 && opnIdx >= 0 && list.length === 14, { saintIdx, dailyIdx, opnIdx, n: list.length, keys: list.map((s) => s.series) });
}

console.log(`\nharness-v665: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
