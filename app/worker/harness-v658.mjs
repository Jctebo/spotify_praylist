// harness-v658.mjs — v658: the two homilies carry their real
// cadence: Sunday, not daily (Plan §4A — the governing text).
//
// The REAL Worker (esbuild bundle of worker/src/index.ts, which
// embeds the client APP_JS) is driven through its real routes
// (externals/audio pass-through · externals/nudge · scheduled ·
// source-settings GET/PUT) over a fake D1, with global fetch
// stubbed. Machinery modeled on harness-v657.mjs.
//
// Legs (Plan §4A.4):
//  H1' the pass-through gate: settings fixture flipped to
//     'sundays' for both homily keys — Wednesday 2026-11-25
//     audio pass-through for ext-fr-mike-homily /
//     ext-barron-sermon -> 404; Sunday 2026-11-29 -> 200
//     serving the fixture episode's stream.
//     FAIL-ON-OLD: the identical Wednesday legs under the base
//     'daily' settings fixture serve 200 for both slots.
//  H2' no-rows + nudge: scheduled passes on the Wednesday and
//     Sunday fixtures write zero ext_resolutions rows for
//     either homily slot. The nudge need set IS observable
//     in-harness (isolated: every other standing slot
//     pre-resolved with fresh feed state, so only the homily
//     rows can flag need): POST externals/nudge on Wednesday
//     under 'sundays' -> ran:false; the same DB flipped back
//     to 'daily' -> ran:true (the homily feeds flag need).
//  H3' records: the built bundle's OPN_SEED_SOURCES reads
//     'sundays' for both homily keys ('daily' still for the
//     control key saint-of-the-day); the real PUT
//     /api/player/source-settings driven with the whole
//     captured table (rows in live payload order, only the two
//     dayRule values flipped) reads back 'sundays' x2, meta
//     version +1 exactly, every other row byte-identical
//     (homily sort_orders 2/3 included).
//
// Fixtures (Improvement D — production sources, named):
//  - SETTINGS_LIVE: the LIVE player_source_settings table,
//    verbatim from the capture at
//    ~/workspace/.scratch/v658/settings.json (26 rows, read
//    2026-11-25; homily rows day_rule 'daily', enabled 1,
//    sort_orders fr-mike 2 / barron 3). Meta version 8, from
//    ~/workspace/.scratch/v658/meta.json.
//  - FRMIKE_ENTRIES / BARRON_ENTRIES: the newest 3 entries of
//    the live rss_snapshots payloads (series fr-mike-homilies
//    · barron-sunday-sermons, built 2026-11-25T06:00:56Z),
//    verbatim from ~/workspace/.scratch/v658/snap.json. The
//    feed fixtures are rebuilt from these entries (pubDate
//    from publishedMs, guid = entry key, enclosure = entry
//    url). DATE-SHIFT, named: the captured episodes were
//    published for Sunday 2026-11-22; per the standing
//    harness pattern they stand as the standing Sunday
//    episodes for the Sunday fixture date 2026-11-29 — the
//    pass-through's latest-by-release-date matcher carries
//    the newest captured entry to both fixture dates.
//  - Wednesday fixture date: 2026-11-25. The pass-through
//    route serves only Chicago today-or-tomorrow, so the
//    harness pins a fake clock (Date) to 12:00 CT on each
//    fixture date in turn.
//  - DO / exegesis / saint / TV Mass / own / course feeds:
//    the standing harness-v657 fixture shapes, present only
//    so the scheduled + forced passes run their full course.
//
// Run: node app/worker/harness-v658.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}

// ---------- fake clock (the pass-through serves today/tomorrow only) ----------
const RealDate = Date;
let fakeNowMs = null;
class HarnessDate extends RealDate {
  constructor(...a) { super(...(a.length ? a : [fakeNowMs ?? RealDate.now()])); }
  static now() { return fakeNowMs ?? RealDate.now(); }
}
globalThis.Date = HarnessDate;
function setClock(iso) { fakeNowMs = RealDate.parse(iso); }
const WED = "2026-11-25", SUN = "2026-11-29";
const WED_NOW = "2026-11-25T18:00:00.000Z"; // 12:00 CST, Wednesday
const SUN_NOW = "2026-11-29T18:00:00.000Z"; // 12:00 CST, Sunday

// ---------- fixtures ----------
const SETTINGS_LIVE = [{"source_key":"auxilium-christianorum","name":"Auxilium Christianorum","family":"own","block":"Afternoon","day_rule":"daily","sort_order":2,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"barron-sermon","name":"Bp. Barron Sunday Sermon","family":"external","block":"Mass and Homilies","day_rule":"daily","sort_order":3,"enabled":1,"slot_id":"ext-barron-sermon","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"daily-gospel-exegesis","name":"Daily Gospel Exegesis","family":"external","block":"Midmorning","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":"ext-gospel-exegesis","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"daily-reflection","name":"Daily Reflection","family":"own","block":"Night","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"daily-rosary","name":"Daily Rosary","family":"own","block":"Morning","day_rule":"daily","sort_order":6,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"daily-tv-mass","name":"Daily TV Mass","family":"external","block":"Mass and Homilies","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":"ext-daily-tv-mass","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"do-evening-prayer","name":"Divine Office — Evening Prayer","family":"external","block":"Evening","day_rule":"daily","sort_order":3,"enabled":1,"slot_id":"ext-evening-prayer","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"do-invitatory","name":"Divine Office — Invitatory","family":"external","block":"Morning","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":"ext-invitatory","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"do-midafternoon-prayer","name":"Divine Office — Midafternoon Prayer","family":"external","block":"Afternoon","day_rule":"daily","sort_order":3,"enabled":1,"slot_id":"ext-midafternoon-prayer","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"do-midday-prayer","name":"Divine Office — Midday Prayer","family":"external","block":"Midday","day_rule":"daily","sort_order":2,"enabled":1,"slot_id":"ext-midday-prayer","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"do-midmorning-prayer","name":"Divine Office — Midmorning Prayer","family":"external","block":"Midmorning","day_rule":"daily","sort_order":2,"enabled":1,"slot_id":"ext-midmorning-prayer","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"do-morning-prayer","name":"Divine Office — Morning Prayer","family":"external","block":"Morning","day_rule":"daily","sort_order":4,"enabled":1,"slot_id":"ext-morning-prayer","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"do-night-prayer","name":"Divine Office — Night Prayer","family":"external","block":"Night","day_rule":"daily","sort_order":2,"enabled":1,"slot_id":"ext-night-prayer","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"do-office-of-readings","name":"Divine Office — Office of Readings","family":"external","block":"Evening","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":"ext-office-of-readings","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"fr-mike-homily","name":"Fr. Mike Sunday Homily","family":"external","block":"Mass and Homilies","day_rule":"daily","sort_order":2,"enabled":1,"slot_id":"ext-fr-mike-homily","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"marian-antiphon","name":"Marian Antiphon — Angelus","family":"own","block":"Morning","day_rule":"daily","sort_order":7,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"marian-antiphon-evening","name":"Marian Antiphon — Angelus","family":"own","block":"Evening","day_rule":"daily","sort_order":2,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"marian-antiphon-midday","name":"Marian Antiphon — Angelus","family":"own","block":"Midday","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"morning-prayer","name":"Morning Prayer","family":"own","block":"Morning","day_rule":"daily","sort_order":2,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"novenas","name":"Novenas","family":"own","block":"Novenas","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"saint-of-the-day","name":"Saint of the Day","family":"external","block":"Afternoon","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":"ext-saint-of-the-day","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"stations-of-the-cross","name":"Stations of the Cross / Lenten Devotion","family":"unplaced","block":"","day_rule":"fridays","sort_order":null,"enabled":0,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"sth-lauds","name":"Sing the Hours — Lauds","family":"external","block":"Morning","day_rule":"fallback-only","sort_order":5,"enabled":1,"slot_id":"ext-morning-prayer","role":"fallback","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"sth-vespers","name":"Sing the Hours — Vespers","family":"external","block":"Evening","day_rule":"fallback-only","sort_order":4,"enabled":1,"slot_id":"ext-evening-prayer","role":"fallback","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"the-ai-signal","name":"The AI Signal","family":"own","block":"The AI Signal","day_rule":"daily","sort_order":1,"enabled":1,"slot_id":null,"role":"primary","updated_at":"2026-11-13T18:17:32.415Z"},{"source_key":"usccb-daily-readings","name":"USCCB Daily Readings","family":"external","block":"Morning","day_rule":"daily","sort_order":3,"enabled":1,"slot_id":"ext-usccb-readings","role":"primary","updated_at":"2026-11-13T18:17:32.415Z"}];
const META_VERSION_LIVE = 8; // ~/workspace/.scratch/v658/meta.json
const FRMIKE_ENTRIES = [{"key":"79afdd5b-0436-4307-b6d5-98834ffa0a86","title":"11/22/26 The Final Exam: The Third Question","url":"https://aphid.fireside.fm/d/1437767933/1b1273a3-3711-4e9f-b187-36a4f8791359/79afdd5b-0436-4307-b6d5-98834ffa0a86.mp3","length":43242879,"publishedMs":1795455900000,"durationS":1763,"imageUrl":"https://cdn.fireside.fm/file/fireside-images-2024/podcasts/images/1/1b1273a3-3711-4e9f-b187-36a4f8791359/episodes/7/79afdd5b-0436-4307-b6d5-98834ffa0a86/cover.jpg?v=0"},{"key":"59396eda-6713-4156-8c5b-6d1aaded641b","title":"11/15/26 The Final Exam: The Second Question","url":"https://aphid.fireside.fm/d/1437767933/1b1273a3-3711-4e9f-b187-36a4f8791359/59396eda-6713-4156-8c5b-6d1aaded641b.mp3","length":47407112,"publishedMs":1794694500000,"durationS":1934,"imageUrl":"https://cdn.fireside.fm/file/fireside-images-2024/podcasts/images/1/1b1273a3-3711-4e9f-b187-36a4f8791359/episodes/5/59396eda-6713-4156-8c5b-6d1aaded641b/cover.jpg?v=0"},{"key":"a96cface-56c2-4fb6-b56d-76a74bf3ae55","title":"11/8/26 The Final Exam: The First Question","url":"https://aphid.fireside.fm/d/1437767933/1b1273a3-3711-4e9f-b187-36a4f8791359/a96cface-56c2-4fb6-b56d-76a74bf3ae55.mp3","length":37277547,"publishedMs":1794240000000,"durationS":1512,"imageUrl":"https://cdn.fireside.fm/file/fireside-images-2024/podcasts/images/1/1b1273a3-3711-4e9f-b187-36a4f8791359/episodes/a/a96cface-56c2-4fb6-b56d-76a74bf3ae55/cover.jpg?v=1"}];
const BARRON_ENTRIES = [{"key":"wordonfire.podbean.com/6cf08ac0-323d-3ead-a50a-4b3ceb0a052f","title":"The King on the Cross","url":"https://mcdn.podbean.com/mf/web/93wuqvapv3b6xkfn/20261113_Feast_of_Christ_the_King_November_22_-_v2_-_Mixed_English_Audio_Master96v0l.mp3","length":35704320,"publishedMs":1795355533000,"durationS":892,"imageUrl":"https://pbcdn1.podbean.com/imglogo/image-logo/1224144/Bishop_Barrons_Sunday_Sermon_Podcast_2022_bssyd8.jpg"},{"key":"wordonfire.podbean.com/c11d6ced-8e84-3e34-97ca-50685123df75","title":"Growth Requires Risk","url":"https://mcdn.podbean.com/mf/web/dhdn32uagd5kvxes/Growth-Requires-Risk.mp3","length":34801920,"publishedMs":1794436313000,"durationS":870,"imageUrl":"https://pbcdn1.podbean.com/imglogo/image-logo/1224144/Bishop_Barrons_Sunday_Sermon_Podcast_2022_bssyd8.jpg"},{"key":"wordonfire.podbean.com/39a6fd05-b45c-3849-b1d5-7ed714857dc7","title":"Wisdom Is Seeking You Out","url":"https://mcdn.podbean.com/mf/web/ky5qgbbm5kj6js8u/20261030_32nd_OT_Nov_8_-_v1_-_Mixed_English_Audio_Master6hu2g.mp3","length":36167040,"publishedMs":1793986253000,"durationS":904,"imageUrl":"https://pbcdn1.podbean.com/imglogo/image-logo/1224144/Bishop_Barrons_Sunday_Sermon_Podcast_2022_bssyd8.jpg"}];
const FRMIKE_TOP = FRMIKE_ENTRIES[0], BARRON_TOP = BARRON_ENTRIES[0];

function settingsWith(dayRule) {
  return SETTINGS_LIVE.map((r) => (r.source_key === "fr-mike-homily" || r.source_key === "barron-sermon") ? { ...r, day_rule: dayRule } : { ...r });
}
function feedFromEntries(channelTitle, entries) {
  const items = entries.map((e) => `<item><title>${e.title}</title><pubDate>${new RealDate(e.publishedMs).toUTCString()}</pubDate><guid>${e.key}</guid><enclosure url="${e.url}" length="${e.length}" type="audio/mpeg"/><itunes:duration>${e.durationS}</itunes:duration></item>`);
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${channelTitle}</title>${items.join("")}</channel></rss>`;
}
// Standing-shape filler feeds (harness-v657 shapes), so the
// scheduled / forced passes run their full course.
function itemXml({ title, url, pub, dur, len, guid }) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate>${guid ? `<guid>${guid}</guid>` : ""}<enclosure url="${url}" length="${len || 1000000}" type="audio/mpeg"/><itunes:duration>${dur || 600}</itunes:duration></item>`;
}
function feedXml(channelTitle, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${channelTitle}</title><itunes:image href="https://fixture.local/art.jpg"/>${items.join("")}</channel></rss>`;
}
function genericRssFeed(tag) {
  return feedXml(tag, [1, 2].map((i) => itemXml({ title: `${tag} Episode ${i}`, url: `https://fixture.local/${tag}/${i}.mp3`, pub: "Sun, 22 Nov 2026 07:00:00 GMT", guid: `${tag}-guid-${i}` })));
}

// ---------- fake D1 (harness-v657 machinery + the settings store) ----------
class FakeDB {
  constructor(settingsRows, metaVersion) {
    this.resolutions = new Map(); // date|slot -> row
    this.feedState = new Map();
    this.rss = new Map();
    this.seqs = new Map();
    this.video = new Map();
    this.settings = settingsRows.map((r) => ({ ...r }));
    this.metaVersion = metaVersion;
  }
  prepare(sql) {
    const db = this;
    let args = [];
    const stmt = {
      bind(...a) { args = a; return stmt; },
      async first() {
        if (sql.includes("player_settings_meta")) return { version: db.metaVersion };
        if (sql.includes("FROM ext_feed_state")) return db.feedState.get(args[0]) ?? null;
        if (sql.includes("SELECT state FROM ext_resolutions")) { const r = db.resolutions.get(args[0] + "|" + args[1]); return r ? { state: r.state } : null; }
        if (sql.includes("SELECT * FROM ext_resolutions")) { return db.resolutions.get(args[0] + "|" + args[1]) ?? null; }
        if (sql.includes("SELECT built_at FROM rss_snapshots")) { const r = db.rss.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes("SELECT built_at FROM podcast_sequences")) { const r = db.seqs.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes("SELECT built_at FROM video_snapshots")) { const r = db.video.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes("SELECT payload FROM rss_snapshots")) { const r = db.rss.get(args[0]); return r ? { payload: r.payload } : null; }
        if (sql.includes("SELECT payload FROM podcast_sequences")) { const r = db.seqs.get(args[0]); return r ? { payload: r.payload } : null; }
        if (sql.includes("SELECT payload FROM video_snapshots")) { const r = db.video.get(args[0]); return r ? { payload: r.payload } : null; }
        return null;
      },
      async all() {
        if (sql.includes("SELECT source_key FROM player_source_settings")) return { results: db.settings.map((r) => ({ source_key: r.source_key })) };
        if (sql.includes("player_source_settings")) return { results: db.settings };
        if (sql.includes("SELECT slot_id, state, resolved_at FROM ext_resolutions")) return { results: [...db.resolutions.values()].filter((r) => r.date === args[0]).map((r) => ({ slot_id: r.slot_id, state: r.state, resolved_at: r.resolved_at })) };
        if (sql.includes("SELECT slot_id, resolved_at FROM ext_resolutions")) return { results: [...db.resolutions.values()].filter((r) => r.date === args[0]).map((r) => ({ slot_id: r.slot_id, resolved_at: r.resolved_at })) };
        if (sql.includes("SELECT * FROM ext_resolutions")) return { results: [...db.resolutions.values()].filter((r) => r.date === args[0]) };
        return { results: [] };
      },
      async run() {
        if (sql.startsWith("INSERT INTO ext_feed_state")) {
          const key = args[0];
          const cur = db.feedState.get(key) || { feed_key: key, last_success_at: null, last_attempt_at: null, last_error: null, last_stamp: null };
          if (args.length === 4) { cur.last_success_at = args[1]; cur.last_attempt_at = args[2]; cur.last_error = null; cur.last_stamp = args[3]; }
          else { cur.last_attempt_at = args[1]; cur.last_error = args[2]; }
          db.feedState.set(key, cur);
          return {};
        }
        if (sql.startsWith("INSERT INTO ext_resolutions")) {
          const [slot_id, date, state, title, stream_url, duration_s, size_bytes, image_url, desc_text, resolved_at, feed_stamp, episode_date, source, backup_url, backup_source, route, backup_image_url, backup_duration_s] = args;
          db.resolutions.set(date + "|" + slot_id, { slot_id, date, state, title, stream_url, duration_s, size_bytes, image_url, desc_text, resolved_at, feed_stamp, episode_date: episode_date ?? null, source: source ?? null, backup_url: backup_url ?? null, backup_source: backup_source ?? null, route: route ?? null, backup_image_url: backup_image_url ?? null, backup_duration_s: backup_duration_s ?? null });
          return {};
        }
        if (sql.startsWith("UPDATE ext_resolutions SET backup_url")) {
          const r = db.resolutions.get(args[4] + "|" + args[5]);
          if (r) { r.backup_url = args[0]; r.backup_source = args[1]; r.backup_image_url = args[2]; r.backup_duration_s = args[3]; }
          return {};
        }
        if (sql.startsWith("DELETE FROM ext_resolutions")) {
          for (const k of [...db.resolutions.keys()]) if (k.split("|")[0] < args[0]) db.resolutions.delete(k);
          return {};
        }
        if (sql.startsWith("INSERT INTO rss_snapshots")) { db.rss.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        if (sql.startsWith("INSERT INTO podcast_sequences")) { db.seqs.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        if (sql.startsWith("INSERT INTO video_snapshots")) { db.video.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        if (sql.startsWith("UPDATE player_source_settings")) {
          const [block, day_rule, enabled, sort_order, updated_at, key] = args;
          const row = db.settings.find((r) => r.source_key === key);
          if (row) { row.block = block; row.day_rule = day_rule; row.enabled = enabled; row.sort_order = sort_order; row.updated_at = updated_at; }
          return {};
        }
        if (sql.startsWith("UPDATE player_settings_meta")) { db.metaVersion += 1; return {}; }
        return {};
      },
    };
    return stmt;
  }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
}

// ---------- worker bundle + fetch stub ----------
const TMP = mkdtempSync(tmpdir() + "/v658-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const BUNDLE_TEXT = readFileSync(TMP + "/index.cjs", "utf8");
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;

const FEEDS = new Map();
const FETCHED = [];
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  FETCHED.push(u);
  if (opts && opts.method === "HEAD") return new Response("", { status: 404 });
  const f = FEEDS.get(u);
  if (f) return new Response(f.body, { status: f.status, headers: { "content-type": "application/rss+xml" } });
  if (u === FRMIKE_TOP.url || u === BARRON_TOP.url) return new Response("AUDIOBYTES:" + u, { status: 200, headers: { "content-type": "audio/mpeg" } });
  return new Response("no fixture", { status: 404 });
};
const U = (k) => "https://fixture.local/" + k;
function setFeed(key, body, status) { FEEDS.set(U(key), { status: status ?? 200, body }); }
function setAllHealthy() {
  setFeed("frmike-feed", feedFromEntries("Sunday Homilies with Fr. Mike Schmitz", FRMIKE_ENTRIES));
  setFeed("barron-feed", feedFromEntries("Bishop Barron's Sunday Sermons", BARRON_ENTRIES));
  for (const k of ["do", "dge", "biy", "saint", "tvmass", "sth", "own", "course", "exorcist", "counsel", "usccb-readings", "yt-catholictv", "yt-dailytvmass", "yt-springfieldmass"]) setFeed(k, genericRssFeed(k));
}
function makeEnv(db) {
  return {
    DB: db, AUDIO: { get: async () => null, put: async () => { throw new Error("R2 put must not happen in v658 path"); } },
    AGENT_TOKEN: "agent-test", LOCAL_DEV: "1",
    EXT_DO_FEED_URL: U("do"), EXT_DGE_FEED_URL: U("dge"), EXT_BIAY_FEED_URL: U("biy"),
    EXT_SAINT_FEED_URL: U("saint"), EXT_TVMASS_FEED_URL: U("tvmass"), EXT_STH_FEED_URL: U("sth"),
    OWN_FEED_URL: U("own"),
    EXT_EXORCIST_FEED_URL: U("exorcist"), EXT_COUNSEL_TRENT_FEED_URL: U("counsel"),
    EXT_FRMIKE_FEED_URL: U("frmike-feed"), EXT_BARRON_FEED_URL: U("barron-feed"),
    EXT_FRMIKE_HOMILIES_FEED_URL: U("frmike-feed"), EXT_BARRON_SERMONS_FEED_URL: U("barron-feed"),
    EXT_DAILY_READINGS_FEED_URL: U("usccb-readings"), EXT_SUMMA_FEED_URL: U("course"),
    EXT_CIY_FEED_URL: U("course"), EXT_RIY_FEED_URL: U("course"),
    EXT_YT_CATHOLICTV_FEED_URL: U("yt-catholictv"), EXT_YT_DAILYTV_FEED_URL: U("yt-dailytvmass"),
    EXT_YT_SPRINGFIELD_FEED_URL: U("yt-springfieldmass"),
    EXT_SYNTH_BASE_URL: U("synth/"), EXT_DO_SITE_BASE_URL: U("site"),
  };
}
async function audioGet(env, date, slot) {
  const res = await WORKER.fetch(new Request(`https://app.local/api/player/externals/audio?date=${date}&slot=${slot}`), env);
  return { status: res.status, body: await res.text() };
}
async function scheduledPass(env) {
  let waited = null;
  await WORKER.scheduled({}, env, { waitUntil: (p) => { waited = p; } });
  if (waited) await waited;
}
async function nudge(env) {
  const res = await WORKER.fetch(new Request("https://app.local/api/player/externals/nudge", { method: "POST" }), env);
  return res.json();
}
async function settingsGet(env) {
  const res = await WORKER.fetch(new Request("https://app.local/api/player/source-settings"), env);
  return res.json();
}
const homilyRows = (db) => [...db.resolutions.values()].filter((r) => r.slot_id === "ext-fr-mike-homily" || r.slot_id === "ext-barron-sermon");

// ---------- H1': the pass-through gate ----------
{
  setAllHealthy();
  setClock(WED_NOW);
  const db = new FakeDB(settingsWith("sundays"), META_VERSION_LIVE);
  const env = makeEnv(db);
  const fmWed = await audioGet(env, WED, "ext-fr-mike-homily");
  check("H1' Wednesday under 'sundays': fr-mike pass-through -> 404", fmWed.status === 404, fmWed);
  const baWed = await audioGet(env, WED, "ext-barron-sermon");
  check("H1' Wednesday under 'sundays': barron pass-through -> 404", baWed.status === 404, baWed);
  setClock(SUN_NOW);
  const fmSun = await audioGet(env, SUN, "ext-fr-mike-homily");
  check("H1' Sunday under 'sundays': fr-mike pass-through -> 200", fmSun.status === 200, fmSun.status);
  check("H1' Sunday fr-mike serves the fixture episode's stream (" + FRMIKE_TOP.title + ")", fmSun.body === "AUDIOBYTES:" + FRMIKE_TOP.url, fmSun.body.slice(0, 120));
  const baSun = await audioGet(env, SUN, "ext-barron-sermon");
  check("H1' Sunday under 'sundays': barron pass-through -> 200", baSun.status === 200, baSun.status);
  check("H1' Sunday barron serves the fixture episode's stream (" + BARRON_TOP.title + ")", baSun.body === "AUDIOBYTES:" + BARRON_TOP.url, baSun.body.slice(0, 120));
}
{
  // FAIL-ON-OLD: the base 'daily' settings fixture — Wednesday serves.
  setAllHealthy();
  setClock(WED_NOW);
  const db = new FakeDB(settingsWith("daily"), META_VERSION_LIVE);
  const env = makeEnv(db);
  const fmWed = await audioGet(env, WED, "ext-fr-mike-homily");
  check("H1' FAIL-ON-OLD Wednesday under 'daily': fr-mike pass-through -> 200", fmWed.status === 200 && fmWed.body === "AUDIOBYTES:" + FRMIKE_TOP.url, fmWed.status);
  const baWed = await audioGet(env, WED, "ext-barron-sermon");
  check("H1' FAIL-ON-OLD Wednesday under 'daily': barron pass-through -> 200", baWed.status === 200 && baWed.body === "AUDIOBYTES:" + BARRON_TOP.url, baWed.status);
}

// ---------- H2': no rows + the nudge need test ----------
{
  setAllHealthy();
  const db = new FakeDB(settingsWith("sundays"), META_VERSION_LIVE);
  const env = makeEnv(db);
  setClock(WED_NOW);
  await scheduledPass(env);
  setClock(SUN_NOW);
  await scheduledPass(env);
  check("H2' zero ext_resolutions rows for either homily slot after Wednesday + Sunday passes", homilyRows(db).length === 0, homilyRows(db));
}
{
  // The need set, isolated: every other standing external
  // primary slot pre-resolved for Wednesday with fresh feed
  // state — only the two homily rows can flag need.
  setAllHealthy();
  setClock(WED_NOW);
  const db = new FakeDB(settingsWith("sundays"), META_VERSION_LIVE);
  const env = makeEnv(db);
  const standing = SETTINGS_LIVE.filter((r) => r.family === "external" && r.slot_id && r.role !== "fallback" && r.enabled === 1 && r.source_key !== "fr-mike-homily" && r.source_key !== "barron-sermon");
  for (const r of standing) db.resolutions.set(WED + "|" + r.slot_id, { slot_id: r.slot_id, date: WED, state: "present", title: "seeded", stream_url: "https://fixture.local/seed.mp3", duration_s: 60, size_bytes: 1, image_url: null, desc_text: null, resolved_at: WED_NOW, feed_stamp: null, episode_date: WED, source: null, backup_url: null, backup_source: null, route: null, backup_image_url: null, backup_duration_s: null });
  for (const k of ["divine-office", "daily-gospel-exegesis", "saint-of-the-day", "daily-tv-mass"]) db.feedState.set(k, { feed_key: k, last_success_at: WED_NOW, last_attempt_at: WED_NOW, last_error: null, last_stamp: null });
  const n1 = await nudge(env);
  check("H2' nudge on Wednesday under 'sundays': homily feeds NOT need-flagged (ran:false, need empty)", n1.ok === true && n1.ran === false, n1);
  for (const r of db.settings) if (r.source_key === "fr-mike-homily" || r.source_key === "barron-sermon") r.day_rule = "daily";
  const n2 = await nudge(env);
  check("H2' FAIL-ON-OLD nudge on Wednesday under 'daily': the homily feeds flag need (ran:true)", n2.ok === true && n2.ran === true, n2);
  check("H2' the forced pass still wrote zero ext_resolutions rows for either homily slot", homilyRows(db).length === 0, homilyRows(db));
}

// ---------- H3': records — the seed + the settings PUT ----------
{
  const seedRule = (key) => {
    const at = BUNDLE_TEXT.indexOf(`"sourceKey": "${key}"`);
    if (at < 0) return null;
    const m = BUNDLE_TEXT.slice(at, at + 400).match(/"dayRule": "([a-z-]+)"/);
    return m ? m[1] : null;
  };
  check("H3' built bundle seed: fr-mike-homily dayRule 'sundays'", seedRule("fr-mike-homily") === "sundays", seedRule("fr-mike-homily"));
  check("H3' built bundle seed: barron-sermon dayRule 'sundays'", seedRule("barron-sermon") === "sundays", seedRule("barron-sermon"));
  check("H3' built bundle seed: control saint-of-the-day dayRule still 'daily'", seedRule("saint-of-the-day") === "daily", seedRule("saint-of-the-day"));
}
{
  setClock(WED_NOW);
  const db = new FakeDB(settingsWith("daily"), META_VERSION_LIVE);
  const env = makeEnv(db);
  const before = await settingsGet(env);
  check("H3' pre-PUT payload carries the captured table (26 rows, version 8, homily 'daily')",
    before.version === META_VERSION_LIVE && before.sources.length === 26 &&
    before.sources.find((s) => s.sourceKey === "fr-mike-homily")?.dayRule === "daily" &&
    before.sources.find((s) => s.sourceKey === "barron-sermon")?.dayRule === "daily",
    { version: before.version, rows: before.sources.length });
  const body = { sources: before.sources.map((s) => ({ sourceKey: s.sourceKey, block: s.block, dayRule: (s.sourceKey === "fr-mike-homily" || s.sourceKey === "barron-sermon") ? "sundays" : s.dayRule, enabled: s.enabled })) };
  const putRes = await WORKER.fetch(new Request("https://app.local/api/player/source-settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env);
  const putJson = await putRes.json();
  check("H3' PUT accepted, version advanced by exactly one (8 -> 9)", putRes.status === 200 && putJson.ok === true && putJson.version === META_VERSION_LIVE + 1, putJson);
  const after = await settingsGet(env);
  check("H3' read-back version is 9", after.version === META_VERSION_LIVE + 1, after.version);
  const changed = [], drifted = [];
  for (const b of before.sources) {
    const a = after.sources.find((s) => s.sourceKey === b.sourceKey);
    if (!a) { drifted.push(b.sourceKey + ":missing"); continue; }
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const bb = { ...b }, aa = { ...a };
    if (b.sourceKey === "fr-mike-homily" || b.sourceKey === "barron-sermon") {
      delete bb.dayRule; delete aa.dayRule;
      if (JSON.stringify(aa) === JSON.stringify(bb) && a.dayRule === "sundays") changed.push(b.sourceKey); else drifted.push(b.sourceKey + ":shape");
    } else drifted.push(b.sourceKey);
  }
  check("H3' read-back 'sundays' x2 and ONLY the two dayRule values changed", changed.length === 2 && drifted.length === 0, { changed, drifted });
  const fm = after.sources.find((s) => s.sourceKey === "fr-mike-homily");
  const ba = after.sources.find((s) => s.sourceKey === "barron-sermon");
  check("H3' homily sort_orders stand at 2 (fr-mike) / 3 (barron) after the PUT", fm?.sortOrder === 2 && ba?.sortOrder === 3, { fm: fm?.sortOrder, ba: ba?.sortOrder });
}

console.log(`\nharness-v658: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
