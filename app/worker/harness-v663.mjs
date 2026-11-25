// harness-v663.mjs — v663: the YouTube channel "Catholic
// Saints & Feasts" stands as a series in Catechesis ›
// Podcasts (index seat §3.2 · marks fold §3.3/§4 · Add
// ladder reach §5 · watch-title generalization §6.3).
//
// Modeled on harness-v662 (the REAL Worker bundle — esbuild
// of worker/src/index.ts — driven through its real routes
// over a fake D1, the served client driven in jsdom) and on
// harness-v656's device-mode world for the ladder legs (the
// rendered client from source, John's profile document,
// production fixtures).
//
// Fixtures (Improvement D — production sources, named):
//  - v663-fixtures/catholicsaints-feed.xml — the REAL
//    channel Atom feed, captured live at Implement
//    (2026-11-25, https://www.youtube.com/feeds/videos.xml
//    ?channel_id=UCHjS4-XMF2KSuil6tzqUG9Q): 15 videos, head
//    "November 25: St. Catherine of Alexandria, Virgin &
//    Martyr" (v9MO_5NAZWQ). Never invented; the legs key on
//    the capture's own head, parsed out of the file.
//  - The Virtual Mass snapshot seed: the videos of
//    app/tests/fixtures-v656/catholictv.json — the LIVE
//    production series payload captured 2026-11-24.
//  - Ladder world: app/tests/fixtures-v603 (book · novenas
//    · podcasts-index · bible-folded), John's profile
//    document (john-personal-data-import-v589.json,
//    podcastListens stripped as in v603/v611/v614), and the
//    podcasts index + series payloads CAPTURED FROM THIS
//    HARNESS'S OWN SERVER LEGS (the real Worker's output
//    over the real feed fixture) — no hand-built payload.
//
// Legs (Plan §7): F feed (live, through the app's own
// fetch+parse route) · S server (def · watcher key · index
// seat/order · VM absence + payload shape · marks fold ·
// mark route · public strip) · C client (index card ·
// series rows · played dress gated on marks · second-video
// identity · watch titles · ENDED mark + repaint · early
// close writes nothing · key gate/title) · L ladder
// (device world: door · node · add lands · dupe greys).
//
// Run: node app/worker/harness-v663.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
let JSDOM, webcrypto;
try { ({ JSDOM } = await import("jsdom")); ({ webcrypto } = await import("node:crypto")); }
catch (e) { ({ JSDOM } = await import(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js"))); ({ webcrypto } = await import("node:crypto")); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const APP = path.resolve(HERE, "..");
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return !!(await fn()); }
function click(w, el) { if (el) el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); return !!el; }

// ---------- the captured REAL feed ----------
const FEED_XML = readFileSync(path.join(HERE, "v663-fixtures", "catholicsaints-feed.xml"), "utf8");
function parseFixture(xml) {
  // The capture's own facts, read with the parser's shapes:
  // entries in feed order (the feed serves newest first).
  const out = [];
  const re = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(xml))) {
    const id = (/<yt:videoId>([^<]*)<\/yt:videoId>/.exec(m[1]) || [])[1];
    const title = (/<title>([^<]*)<\/title>/.exec(m[1]) || [])[1];
    if (id) out.push({ id, title: title.replace(/&amp;/g, "&") });
  }
  return out;
}
const FIX = parseFixture(FEED_XML);
check("fixture: the captured feed carries 15 videos, head + second named", FIX.length === 15 && FIX[0].id === "v9MO_5NAZWQ" && /Catherine of Alexandria/.test(FIX[0].title) && /Andrew Dung Lac/.test(FIX[1].title), FIX.slice(0, 2));

// ---------- the real Worker bundle ----------
const TMP = mkdtempSync(tmpdir() + "/v663-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(WT, "app/worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;

// ---------- fake D1 ----------
const SEED_SETTINGS = [
  { source_key: "the-ai-signal", name: "The AI Signal", family: "own", block: "", day_rule: "daily", sort_order: 99, enabled: 1, slot_id: null, role: "" },
];
class FakeDB {
  constructor() { this.video = new Map(); this.listens = new Map(); this.feedState = new Map(); }
  prepare(sql) {
    const db = this;
    let args = [];
    const stmt = {
      bind(...a) { args = a; return stmt; },
      async first() {
        if (sql.includes("player_settings_meta")) return { version: 1 };
        if (sql.includes("FROM ext_feed_state")) return db.feedState.get(args[0]) ?? null;
        if (sql.includes("SELECT built_at FROM video_snapshots")) { const r = db.video.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes("SELECT payload FROM video_snapshots")) { const r = db.video.get(args[0]); return r ? { payload: r.payload } : null; }
        if (sql.includes("podcast_listens") && sql.includes("seq_key=?")) return db.listens.has(args[0] + "|" + args[1]) ? { seq_key: args[1] } : null;
        return null;
      },
      async all() {
        if (sql.includes("player_source_settings")) return { results: SEED_SETTINGS };
        if (sql.includes("FROM podcast_listens")) {
          const rows = [];
          for (const [k, v] of db.listens) { const i = k.indexOf("|"); if (k.slice(0, i) === args[0]) rows.push({ seq_key: k.slice(i + 1), listened_at: v.listened_at, listen_date: v.listen_date, source: v.source }); }
          return { results: rows };
        }
        return { results: [] };
      },
      async run() {
        if (sql.startsWith("INSERT INTO video_snapshots")) { db.video.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        if (sql.startsWith("INSERT OR IGNORE INTO podcast_listens")) { const k = args[0] + "|" + args[1]; if (!db.listens.has(k)) db.listens.set(k, { listened_at: args[2], listen_date: args[3], source: args[4] }); return {}; }
        if (sql.startsWith("DELETE FROM podcast_listens")) { db.listens.delete(args[0] + "|" + args[1]); return {}; }
        if (sql.startsWith("INSERT INTO ext_feed_state")) {
          const key = args[0];
          const cur = db.feedState.get(key) || { feed_key: key, last_success_at: null, last_attempt_at: null, last_error: null, last_stamp: null };
          if (args.length === 4) { cur.last_success_at = args[1]; cur.last_attempt_at = args[2]; cur.last_error = null; cur.last_stamp = args[3]; }
          else { cur.last_attempt_at = args[1]; cur.last_error = args[2]; }
          db.feedState.set(key, cur);
          return {};
        }
        return {};
      },
    };
    return stmt;
  }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
}

// ---------- fetch: the fixture feed stands, all else 404 ----------
const REAL_FETCH = globalThis.fetch;
const FEED_FIXTURE_URL = "https://fixture.local/yt-catholicsaints";
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u === FEED_FIXTURE_URL) return { ok: true, status: 200, headers: { get: () => null }, text: async () => FEED_XML };
  return { ok: false, status: 404, headers: { get: () => null }, text: async () => "no fixture" };
};
function makeEnv(db, extra) {
  return Object.assign({
    DB: db, AGENT_TOKEN: "t", LOCAL_DEV: "1",
    AUDIO: { get: async () => null, put: async () => {} },
    EXT_YT_CATHOLICSAINTS_FEED_URL: FEED_FIXTURE_URL,
  }, extra || {});
}
async function get(env, p, pub) {
  const res = await WORKER.fetch(new Request("https://app.local" + p, pub ? { headers: { "x-opn-host-probe": "public" } } : undefined), env);
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function post(env, p, body) {
  const res = await WORKER.fetch(new Request("https://app.local" + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ---------- F: the live feed through the app's own route ----------
// No EXT override: the Worker's own fetch (the real global
// fetch, restored for this leg) reads the channel's live
// feed and ytParseFeed parses it. The harness's own direct
// read of the same feed is the cross-check.
{
  globalThis.fetch = REAL_FETCH;
  const directRes = await REAL_FETCH("https://www.youtube.com/feeds/videos.xml?channel_id=UCHjS4-XMF2KSuil6tzqUG9Q", { headers: { "user-agent": "ora-pro-nobis-externals-resolver/1.0" } });
  const directXml = await directRes.text();
  const direct = parseFixture(directXml);
  const db = new FakeDB();
  const env = makeEnv(db); delete env.EXT_YT_CATHOLICSAINTS_FEED_URL;
  const r = await get(env, "/api/player/podcasts?series=catholicsaints");
  globalThis.fetch = async (url) => { const u = String(url); if (u === FEED_FIXTURE_URL) return { ok: true, status: 200, headers: { get: () => null }, text: async () => FEED_XML }; return { ok: false, status: 404, headers: { get: () => null }, text: async () => "no fixture" }; };
  const vids = (r.body && r.body.videos) || [];
  check("F live feed via the app's route: >= 10 videos, newest first", r.status === 200 && vids.length >= 10, { status: r.status, n: vids.length });
  check("F live head = the channel's newest (title + id, cross-checked against the direct read)", vids.length > 0 && direct.length > 0 && vids[0].id === direct[0].id && vids[0].title === direct[0].title, { route: vids[0] && [vids[0].id, vids[0].title], direct: direct[0] });
  check("F live second = the next newest", vids.length > 1 && direct.length > 1 && vids[1].id === direct[1].id && vids[1].title === direct[1].title, { route: vids[1] && vids[1].id, direct: direct[1] && direct[1].id });
  console.log("# live head: " + (vids[0] ? vids[0].id + " · " + vids[0].title : "(none)"));
}

// ---------- S: server legs over the captured fixture ----------
const db = new FakeDB();
// The Virtual Mass snapshot seed: the production payload's
// videos (fixtures-v656), standing fresh.
const CTV = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v656", "catholictv.json"), "utf8"));
db.video.set("catholictv", { payload: JSON.stringify({ videos: CTV.videos, builtAt: new Date().toISOString() }), builtAt: new Date().toISOString() });
const env = makeEnv(db);
const seriesRes = await get(env, "/api/player/podcasts?series=catholicsaints");
const SERIES = seriesRes.body;
check("S def stands: the series route answers kind video, series catholicsaints, the channel title", seriesRes.status === 200 && SERIES && SERIES.kind === "video" && SERIES.series === "catholicsaints" && SERIES.title === "Catholic Saints & Feasts" && SERIES.available === true, { status: seriesRes.status, title: SERIES && SERIES.title });
check("S payload lists the capture's videos newest first with the channel's titles", !!SERIES && SERIES.videos.length === FIX.length && SERIES.videos.every((v, i) => v.id === FIX[i].id && v.title === FIX[i].title), SERIES && SERIES.videos.slice(0, 2).map((v) => v.id));
check("S payload carries marks:true and a listened boolean on every video (all false before any mark)", !!SERIES && SERIES.marks === true && SERIES.videos.every((v) => v.listened === false));
const vmRes = await get(env, "/api/player/podcasts?series=catholictv");
const VM = vmRes.body;
check("S Virtual Mass payload shape unchanged: no marks key, no listened field on any video", !!VM && !("marks" in VM) && VM.videos.every((v) => !("listened" in v)), VM && Object.keys(VM));
const indexRes = await get(env, "/api/player/podcasts");
const INDEX = indexRes.body;
{
  const list = (INDEX && INDEX.seriesList) || [];
  const videoEntries = list.filter((s) => s.kind === "video");
  const csIdx = list.findIndex((s) => s.series === "catholicsaints");
  const ownIdx = list.findIndex((s) => s.series === "the-ai-signal");
  const rssIdxs = list.map((s, i) => (s.kind === "rss" ? i : -1)).filter((i) => i >= 0);
  check("S index carries exactly one video-kind entry: catholicsaints, category podcasts", videoEntries.length === 1 && csIdx >= 0 && list[csIdx].category === "podcasts" && list[csIdx].title === "Catholic Saints & Feasts", videoEntries.map((s) => s.series));
  check("S index seat: after every RSS entry, before the own entry (own last)", csIdx >= 0 && rssIdxs.length > 0 && rssIdxs.every((i) => i < csIdx) && ownIdx === list.length - 1 && csIdx < ownIdx, { csIdx, ownIdx, n: list.length });
  check("S the three Virtual Mass defs stand in NO index entry", !list.some((s) => ["catholictv", "dailytvmass", "springfieldmass"].includes(s.series)), list.map((s) => s.series));
  check("S index entry facts from the standing builder: available, latestLabel = head's date label, showImageUrl = head's thumbnail", csIdx >= 0 && list[csIdx].available === true && list[csIdx].latestLabel === SERIES.videos[0].dateLabel && list[csIdx].showImageUrl === SERIES.videos[0].imageUrl, list[csIdx]);
}
// The mark route + the fold (the reload guarantee).
{
  const bad = await post(env, "/api/player/podcasts/mark", { series: "catholicsaints", seqKey: "yt:no-such-video", source: "auto" });
  check("S mark route refuses an unknown video id (400)", bad.status === 400, bad.status);
  const vmMark = await post(env, "/api/player/podcasts/mark", { series: "catholictv", seqKey: "yt:" + CTV.videos[0].id, source: "auto" });
  check("S mark route refuses a Virtual Mass series (no marks discipline stands)", vmMark.status === 400, vmMark.status);
  const good = await post(env, "/api/player/podcasts/mark", { series: "catholicsaints", seqKey: "yt:" + FIX[1].id, source: "auto" });
  check("S mark route accepts (catholicsaints, yt:<id>) source auto", good.status === 200 && good.body && good.body.ok === true, { status: good.status });
  const after = await get(env, "/api/player/podcasts?series=catholicsaints");
  check("S fold after the mark: the marked video reads listened, every other video unlistened (the mark stands on a fresh payload read = after reload)", !!after.body && after.body.videos.every((v, i) => v.listened === (i === 1)), after.body && after.body.videos.slice(0, 3).map((v) => v.listened));
  const pub = await get(env, "/api/player/podcasts?series=catholicsaints", true);
  check("S public payload strips the marks marker and every listened field", !!pub.body && !("marks" in pub.body) && pub.body.videos.every((v) => !("listened" in v)), pub.body && Object.keys(pub.body));
}
// The watcher covers the new feed key.
{
  const res = await WORKER.fetch(new Request("https://app.local/api/agent/externals/resolve", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ forceFeedKeys: ["video:catholicsaints"] }) }), env);
  const body = await res.json().catch(() => null);
  const entry = body && (body.results || []).find((x) => x.feed === "video:catholicsaints");
  check("S watcher: a forced pass covers feed key video:catholicsaints and records success in ext_feed_state", !!entry && entry.ok === true && !!db.feedState.get("video:catholicsaints") && !!db.feedState.get("video:catholicsaints").last_success_at, entry);
}

// ---------- C: client legs (the served client, jsdom) ----------
const STUB_ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: "t", LOCAL_DEV: "1" };
const SHELL = await (await WORKER.fetch(new Request("https://app.local/"), STUB_ENV)).text();
const APPJS = await (await WORKER.fetch(new Request("https://app.local/app.js"), STUB_ENV)).text();
check("C served client carries the v663 seams", APPJS.includes("markPodVideoEnded663") && APPJS.includes("PODCASTS_VIDEO_SERIES663") && APPJS.includes("catholicsaints"));

async function makeWorldA() {
  const dom = new JSDOM(SHELL, { url: "https://app.orapronobis.media/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window;
  const calls = [];
  w.fetch = (url, opts) => {
    const u = String(url);
    if (u.includes("/api/player/podcasts/mark")) { calls.push({ url: u, body: opts && opts.body ? JSON.parse(opts.body) : null }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve("") }); }
    return new Promise(() => {}); // boot fetches never settle
  };
  w.__calls = calls;
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.scrollTo = () => {};
  try { Object.defineProperty(w, "crypto", { value: webcrypto }); } catch (e) {}
  // The YT IFrame API stub: captures the events wiring of
  // every YT.Player the client constructs (v656's posture).
  w.__yt = [];
  w.YT = { Player: function (frame, opts) { w.__yt.push(opts); }, PlayerState: { ENDED: 0 } };
  const s = w.document.createElement("script");
  s.textContent = APPJS;
  w.document.body.appendChild(s);
  await sleep(250);
  return w;
}
const ytEnd = (w) => { const p = w.__yt[w.__yt.length - 1]; if (p && p.events && p.events.onStateChange) p.events.onStateChange({ data: 0 }); };

// C index + series paint + gate functions (one world).
{
  const w = await makeWorldA();
  w.state.tab = "podcasts";
  w.state.podcastsIndex = INDEX;
  w.eval("tabSideNow.podcasts = 'podcasts';");
  w.paintPodcastsIndex();
  const card = w.document.querySelector('[data-podseries="catholicsaints"]');
  check("C Podcasts side paints the series card with the video meta form (Video · Latest: …)", !!card && /Video \u00b7 Latest:/.test(card.textContent) && card.textContent.includes("Catholic Saints & Feasts"), card && card.textContent.slice(0, 160));
  check("C no Virtual Mass card stands on the Podcasts side", !w.document.querySelector('[data-podseries="catholictv"]'));
  // The gate + title widenings (§5.3), as globals.
  check("C opnVideoKeyOk656 passes catholicsaints, still refuses a foreign series", w.opnVideoKeyOk656("catholicsaints|" + FIX[0].id) === true && w.opnVideoKeyOk656("hulu|x") === false && w.opnVideoKeyOk656("catholictv|x") === true);
  check("C opnVideoSeriesTitle656 names the series from the named list", w.opnVideoSeriesTitle656("catholicsaints") === "Catholic Saints & Feasts" && w.opnVideoSeriesTitle656("catholictv") === "Catholic TV Mass");
  const seam = w.opnContentsOf590({ contents: { Morning: [{ kind: "video", key: "catholicsaints|" + FIX[0].id }, { kind: "video", key: "hulu|x" }] } });
  check("C the contents read seam keeps a saints video item and filters the foreign one", !!seam && seam.Morning.length === 1 && seam.Morning[0].key === "catholicsaints|" + FIX[0].id, seam);
  w.close();
}
// C series rows + played dress gating.
{
  const w = await makeWorldA();
  w.state.tab = "podcasts";
  const plain = JSON.parse(JSON.stringify(SERIES));
  plain.videos.forEach((v) => { v.listened = false; });
  w.state.podcasts = plain;
  w.paintPodcastVideos();
  const rows = [...w.document.querySelectorAll("[data-podvideo]")];
  check("C series page lists the capture's videos newest first with the channel's titles", rows.length === FIX.length && rows.every((r, i) => r.getAttribute("data-podvideo") === FIX[i].id && r.textContent.includes(FIX[i].title)), rows.slice(0, 2).map((r) => r.getAttribute("data-podvideo")));
  check("C unmarked payload: no played dress stands", !w.document.querySelector("[data-podvideoplayed]") && !w.document.querySelector(".podmark"));
  const marked = JSON.parse(JSON.stringify(SERIES));
  marked.videos.forEach((v, i) => { v.listened = i === 0; });
  w.state.podcasts = marked;
  w.paintPodcastVideos();
  const prow = w.document.querySelector('[data-podvideo="' + FIX[0].id + '"]');
  check("C marks payload: the listened row carries the played dress (data attr + .podmark.on check), the others do not", !!prow && prow.getAttribute("data-podvideoplayed") === "1" && !!prow.querySelector(".podmark.on") && !w.document.querySelector('[data-podvideo="' + FIX[1].id + '"][data-podvideoplayed]'));
  // The Virtual Mass page: same paint, no marker in its
  // payload — byte-level dress regression.
  w.state.podcasts = VM;
  w.paintPodcastVideos();
  const vmRows = [...w.document.querySelectorAll("[data-podvideo]")];
  check("C Virtual Mass series page renders its rows with NO played dress (payload carries no marks)", vmRows.length === VM.videos.length && !w.document.querySelector("[data-podvideoplayed]") && !w.document.querySelector(".podmark"), vmRows.length);
  w.close();
}
// C watch: second-video identity, generalized titles,
// ENDED mark + repaint; early close writes nothing.
{
  const w = await makeWorldA();
  w.state.tab = "podcasts";
  const plain = JSON.parse(JSON.stringify(SERIES));
  plain.videos.forEach((v) => { v.listened = false; });
  w.state.podcasts = plain;
  w.paintPodcastVideos();
  click(w, w.document.querySelector('[data-podvideo="' + FIX[1].id + '"]'));
  await sleep(30);
  const frame = w.document.querySelector("iframe.podwatch-frame");
  check("C tapping the SECOND video opens THAT video's embed (identity per video)", !!frame && frame.getAttribute("src").includes("/embed/" + FIX[1].id), frame && frame.getAttribute("src"));
  const backBtn = w.document.querySelector("[data-podwatchback]");
  check("C watch back bar + meta name the standing series (Catholic Saints & Feasts), not a hardcoded CatholicTV", !!backBtn && backBtn.getAttribute("aria-label") === "Back to Catholic Saints & Feasts" && (w.document.getElementById("view").textContent.includes("\u00b7 Catholic Saints & Feasts")), backBtn && backBtn.getAttribute("aria-label"));
  ytEnd(w);
  await sleep(30);
  check("C ENDED writes the listen via the standing mark route, keyed (catholicsaints, yt:<id2>), source auto", w.__calls.length === 1 && w.__calls[0].body && w.__calls[0].body.series === "catholicsaints" && w.__calls[0].body.seqKey === "yt:" + FIX[1].id && w.__calls[0].body.source === "auto", w.__calls);
  check("C the mark folds into the standing payload in the same act", plain.videos[1].listened === true && plain.videos[0].listened === false);
  w.closeWatch();
  await sleep(30);
  const row2 = w.document.querySelector('[data-podvideo="' + FIX[1].id + '"]');
  check("C on return the series page repaints with the watched row marked", !!row2 && row2.getAttribute("data-podvideoplayed") === "1" && !!row2.querySelector(".podmark.on"));
  w.close();
}
{
  const w = await makeWorldA();
  w.state.tab = "podcasts";
  const plain = JSON.parse(JSON.stringify(SERIES));
  plain.videos.forEach((v) => { v.listened = false; });
  w.state.podcasts = plain;
  w.paintPodcastVideos();
  click(w, w.document.querySelector('[data-podvideo="' + FIX[0].id + '"]'));
  await sleep(30);
  w.closeWatch(); // early close: no ENDED ever fired
  await sleep(30);
  const row1 = w.document.querySelector('[data-podvideo="' + FIX[0].id + '"]');
  check("C early close writes nothing: no mark call, the row stands unmarked", w.__calls.length === 0 && !!row1 && !row1.hasAttribute("data-podvideoplayed"), w.__calls);
  w.close();
}
// C CatholicTV's own watch renders identically (§6.3).
{
  const w = await makeWorldA();
  w.state.tab = "mass";
  w.state.podcasts = VM;
  w.paintPodcastVideos();
  click(w, w.document.querySelector('[data-podvideo="' + CTV.videos[0].id + '"]'));
  await sleep(30);
  const bar = w.document.getElementById("hdrrow2");
  const meta = w.document.getElementById("view").querySelector(".meta");
  check("C CatholicTV watch: back dest + meta read CatholicTV exactly as before", !!bar && bar.textContent.includes("CatholicTV") && !!meta && meta.textContent.trim().endsWith("\u00b7 CatholicTV"), { bar: bar && bar.textContent.slice(0, 80), meta: meta && meta.textContent });
  ytEnd(w);
  await sleep(30);
  check("C CatholicTV ENDED writes nothing (no marks marker on its payload)", w.__calls.length === 0, w.__calls);
  w.close();
}

// ---------- L: ladder legs (device world, harness-v656's
// recipe: the rendered client from source, John's profile
// document, production fixtures; the podcasts index + the
// saints series payload are this harness's own server-leg
// captures, above) ----------
const clientSrc = readFileSync(path.join(APP, "worker", "src", "client.ts"), "utf8");
const uiSrc = readFileSync(path.join(APP, "worker", "src", "ui.ts"), "utf8");
function renderJs(src) {
  const a = src.indexOf("= `") + 3;
  const b = src.indexOf("\n`;", a);
  return vm.runInContext("`" + src.slice(a, b) + "`", vm.createContext({}));
}
const appJsL = renderJs(clientSrc);
const shellStart = uiSrc.indexOf("<!DOCTYPE html>");
const SHELL_L = vm.runInContext("`" + uiSrc.slice(shellStart, uiSrc.indexOf("`;", shellStart)) + "`", vm.createContext({}));
const BOOK = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "book.json"), "utf8"));
const NOVENAS = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "novenas.json"), "utf8"));
const BIBLE = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v603", "bible-folded.json"), "utf8"));
const DAY597 = JSON.parse(readFileSync(path.join(APP, "tests", "fixtures-v597", "production-day-2026-11-21.json"), "utf8"));
const JOHN_FULL = JSON.parse(readFileSync(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json"), "utf8"));
const JOHN = JSON.parse(JSON.stringify(JOHN_FULL));
delete JOHN.podcastListens;
const DATA_KEY = "opn-personal-data-v1";
const SERIES_PLAIN = JSON.parse(JSON.stringify(SERIES));
SERIES_PLAIN.videos.forEach((v) => { v.listened = false; });

function fetchStubL(url) {
  const u = String(url);
  let body = {};
  if (u.includes("/api/prayer/book")) body = BOOK;
  else if (u.includes("/api/player/podcasts?series=catholicsaints")) body = SERIES_PLAIN;
  else if (u.includes("/api/player/podcasts?series=novenas")) body = NOVENAS;
  else if (u.includes("/api/player/podcasts?series=bible-in-a-year")) body = BIBLE;
  else if (u.includes("/api/player/podcasts?series=")) { const sk = decodeURIComponent(u.split("series=")[1].split("&")[0] || "x"); body = { series: sk, entries: [{ key: sk + ":ep-1", label: "Day 1", title: "First", url: "https://example.invalid/e.mp3", listened: false }], currentKey: sk + ":ep-1" }; }
  else if (u.includes("/api/player/podcasts")) body = INDEX;
  else if (u.includes("/api/player/day")) body = DAY597;
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve("") });
}
const HOOK_L = "\n;window.__opn = { state, opnLocalApi, openProfilesScreen };";
function makeWorldL(store) {
  const html = SHELL_L.replace("<!--OPN_SHAPE-->", "public");
  const dom = new JSDOM(html, { url: "https://app.orapronobis.media/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w.navigator, "standalone", { value: true, configurable: true }); } catch (e) {}
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, "crypto", { value: webcrypto }); } catch (e) {} }
  w.fetch = fetchStubL;
  try { w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; w.HTMLMediaElement.prototype.pause = function () {}; } catch (e) {}
  try { w.caches = { open: () => Promise.resolve({ match: () => Promise.resolve(undefined), keys: () => Promise.resolve([]) }) }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const s = w.document.createElement("script");
  s.textContent = appJsL + HOOK_L;
  w.document.body.appendChild(s);
  w.__yt = [];
  w.YT = { Player: function (frame, opts) { w.__yt.push(opts); }, PlayerState: { ENDED: 0 } };
  return w;
}
function johnStore() { const st = {}; st[DATA_KEY] = JSON.stringify(JSON.parse(JSON.stringify(JOHN))); return st; }
async function openProfilesL(w) { w.__opn.openProfilesScreen(null, {}); return until(() => w.document.querySelector('[data-p591add="Morning"]')); }
async function openLadderL(w) { await openProfilesL(w); click(w, w.document.querySelector('[data-p591add="Morning"]')); return until(() => w.document.querySelector(".profaddladder603")); }
const doorL = (w, val) => w.document.querySelector('[data-p603door="' + val + '"]');
const ladderTextL = (w) => { const l = w.document.querySelector(".profaddladder603"); return l ? l.textContent : ""; };
async function profilesPayloadL(w) { return w.__opn.opnLocalApi("/api/prayer/profiles", {}, "device"); }

{
  const w = makeWorldL(johnStore());
  await sleep(400);
  await openLadderL(w);
  click(w, doorL(w, "br:catechesis")); await sleep(60);
  click(w, doorL(w, "lf:podcasts")); await sleep(60);
  const doorEl = doorL(w, "series:catholicsaints");
  check("L the Podcasts branch shows the Catholic Saints & Feasts door (from the index entry, no ladder-list change)", !!doorEl && doorEl.textContent.includes("Catholic Saints & Feasts"), ladderTextL(w).slice(0, 200));
  click(w, doorEl);
  const stood = await until(() => w.document.querySelector('[data-p603additem="video:catholicsaints|' + FIX[0].id + '"]'), 6000);
  const rows = [...w.document.querySelectorAll(".profaddladder603 [data-p603additem]")];
  check("L the series: node renders videoNode656 for the video payload: one addable row per video, payload order, channel titles", stood && rows.length === FIX.length && rows[0].getAttribute("data-p603additem") === "video:catholicsaints|" + FIX[0].id && rows[1].getAttribute("data-p603additem") === "video:catholicsaints|" + FIX[1].id && ladderTextL(w).includes(FIX[0].title), { n: rows.length });
  click(w, rows[0]);
  await until(() => !w.document.querySelector(".profaddladder603"), 3000);
  const saveBtn = w.document.querySelector('[data-p593save="profile"]');
  if (saveBtn) click(w, saveBtn);
  const landed = await until(async () => { const p = await profilesPayloadL(w); const s = (p.profiles || []).find((x) => x.key === "salesian"); return s && ((s.contents && s.contents.Morning) || []).some((it) => it.kind === "video" && it.key === "catholicsaints|" + FIX[0].id); }, 6000);
  check("L adding the head video stands {kind:video, key:catholicsaints|<id>} in the block's contents (the key gate passes it)", landed);
  await openLadderL(w);
  click(w, doorL(w, "br:catechesis")); await sleep(60);
  click(w, doorL(w, "lf:podcasts")); await sleep(60);
  click(w, doorL(w, "series:catholicsaints"));
  await until(() => ladderTextL(w).includes("Already in Morning"), 6000);
  const stoodRow = [...w.document.querySelectorAll(".profaddladder603 .bookrow")].find((r) => r.textContent.includes(FIX[0].title));
  check("L dupes: the standing video paints 'Already in Morning' and is not tappable", !!stoodRow && !stoodRow.hasAttribute("data-p603additem") && stoodRow.textContent.includes("Already in Morning"), stoodRow && stoodRow.textContent.slice(0, 120));
  w.close();
}

console.log(`\nharness-v663: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
