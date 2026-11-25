// harness-v657.mjs — v657: the watcher watches every daily
// Praylist slot, and keeps the feeds fresh.
//
// The REAL Worker (esbuild bundle of worker/src/index.ts) is
// driven through its real routes (scheduled · agent resolve ·
// externals live) over a fake D1, with global fetch stubbed to
// fixture feeds. Modeled on harness-v624.mjs / harness-v628.mjs
// (machinery copied; the fake D1 carries the full v648 column
// set and a video_snapshots store).
//
// Legs (Plan §§2–4):
//  S1 saint pre-release scheduled pass -> 'missing' today +
//     tomorrow (the 06:00Z pass runs before the 08:00Z release).
//  S2 saint post-release UNFORCED scheduled pass -> today
//     'present' with the item's own title/stream/duration.
//     This leg FAILS on the pristine base tree (the 'missing'
//     write stood the feed down for the day) — see §6 of
//     docs/releases/v657.md for the recorded fail-on-old run.
//  S3 saint feed HTTP 500 between S1 and S2 -> nothing written;
//     S2 still lands.
//  S4 exegesis two-act: 'missing' at the midnight-shape pass ->
//     lands on the next pass after its item appears.
//  S5 TV Mass two-act, same shape.
//  S6 Divine Office: act 1 all 8 slots present -> later passes
//     leave every DO row byte-identical (gate c); act 2 (fresh
//     fake D1) one hour left 'missing' after rung 1 -> the next
//     pass's summary shows the divine-office feed FETCHED
//     (not 'stood-down').
//  S7 snapshot freshness per class (rss_snapshots 2 h ·
//     novenas-catalog 2 h · podcast_sequences 24 h ·
//     video_snapshots 2 h): built_at just inside max age ->
//     the pass fetches nothing for it; just past -> rebuilt,
//     built_at advances; zero-yield rebuild -> old snapshot
//     stands, error recorded in ext_feed_state.
//  S8 a pre-seeded past-date 'present' saint row (the Nov 23
//     shape) is never rewritten by any pass (gate d).
//
// Fixtures (Improvement D — production sources, named):
//  - SAINT items '11/23 - Pope St. Clement I' and '11/24 - St.
//    Columbanus': title · pubDate · duration · GUID verbatim
//    from the live feed (feeds.buzzsprout.com/2216056.rss,
//    read 2026-11-25 06:40Z; Plan §2.2 + the v657 Implement
//    live read). Clement's enclosure is the harness-v624
//    captured URL verbatim; Columbanus's enclosure follows the
//    feed's standing Buzzsprout shape (its numeric episode id
//    was not in the rendered capture).
//  - The "today" saint item is SYNTHETIC (named as such): the
//    feed's standing shape — computed MM/DD title prefix for
//    the harness's TODAY, the daily 03:00 -0500 stamp, a
//    Buzzsprout-shape enclosure. The publisher's real today
//    item had not published at fixture time (Plan §4).
//  - DO / exegesis / TV Mass fixtures reuse the standing
//    harness fixture shapes (harness-v624/v628), date-shifted
//    to the computed TODAY/TOMORROW.
//  - S4 act 1 shape, named: the exegesis matcher is
//    latest-by-release-date, so a 'missing' today requires no
//    item released on or before today; the act-1 feed carries
//    only tomorrow's scheduled item (released tomorrow 12:00
//    GMT, the v625 fixture stamp). Act 2 adds the episode FOR
//    today, released yesterday (the standing D-1 attribution).
//  - Video fixtures: Atom documents in the YouTube channel
//    feed's standing shape (yt:videoId · published ·
//    media:thumbnail), the shape ytParseFeed reads.
//
// Run: node app/worker/harness-v657.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
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

// ---------- dates (Chicago, like the Worker's) ----------
function chicagoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const p = {}; for (const x of parts) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
function shift(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
const TODAY = chicagoToday();
const TOMORROW = shift(TODAY, 1);
const YESTERDAY = shift(TODAY, -1);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_A = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function md(date) { const [y, m, d] = date.split("-").map(Number); return { y, m, d, full: MONTHS[m - 1], abbr: MONTHS_A[m - 1] }; }
function rfc(date, hour) { const t = md(date); const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()]; return `${wd}, ${String(t.d).padStart(2, "0")} ${t.abbr} ${t.y} ${String(hour || 12).padStart(2, "0")}:00:00 GMT`; }
function doy(date) { const t = md(date); return Math.floor((Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(t.y, 0, 0)) / 86400000); }
const mmdd = (date) => { const t = md(date); return `${String(t.m).padStart(2, "0")}/${String(t.d).padStart(2, "0")}`; };
// The saint feed's standing daily stamp: 03:00 -0500 on the item's own date.
function saintStamp(date) { const t = md(date); const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()]; return `${wd}, ${String(t.d).padStart(2, "0")} ${t.abbr} ${t.y} 03:00:00 -0500`; }

// ---------- fixture feeds ----------
function itemXml({ title, url, pub, dur, len, guid }) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate>${guid ? `<guid>${guid}</guid>` : ""}<enclosure url="${url}" length="${len || 1000000}" type="audio/mpeg"/><itunes:duration>${dur || 600}</itunes:duration></item>`;
}
function feedXml(channelTitle, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${channelTitle}</title><itunes:image href="https://fixture.local/art.jpg"/>${items.join("")}</channel></rss>`;
}
const DO_TOKENS = [["ext-invitatory", "Invitatory"], ["ext-morning-prayer", "Morning Prayer"], ["ext-midmorning-prayer", "Midmorning Prayer"], ["ext-midday-prayer", "Midday Prayer"], ["ext-midafternoon-prayer", "Midafternoon Prayer"], ["ext-office-of-readings", "Office of Readings"], ["ext-evening-prayer", "Evening Prayer"], ["ext-night-prayer", "Night Prayer"]];
function doFeedFor(dates, omitTokens) {
  const items = [];
  for (const date of dates) {
    const t = md(date);
    for (const [, token] of DO_TOKENS) {
      if (omitTokens && omitTokens.includes(token)) continue;
      const title = token === "Invitatory"
        ? `${t.abbr} ${t.d}, Invitatory for Monday of the 34th week of Ordinary Time`
        : `${t.abbr} ${t.d}, ${token} for ${t.full} ${t.d}, ${t.y}`;
      items.push(itemXml({ title, url: `https://divineoffice.org/audio/${date}-${token.replace(/\s+/g, "-").toLowerCase()}.mp3`, pub: rfc(date, 5), dur: 700, guid: `do-${date}-${token}` }));
    }
  }
  return feedXml("Divine Office", items);
}
const DO_HEALTHY = doFeedFor([TODAY, TOMORROW]);
const DO_500 = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n<channel>\n\t<title>Divine Office &#8211; Liturgy of the Hours of the Roman Catholic Church (Breviary)</title>\n<item><title>November 22nd, 2026 &#8211; This Week</title><error>\n    <code>internal_server_error</code>\n    <title><![CDATA[WordPress &rsaquo; Error]]></title>\n    <message><![CDATA[&lt;p&gt;There has been a critical error on this website.&lt;/p&gt;]]></message>\n    <data><status>500</status></data>\n</error>`;
// Saint items captured verbatim from the live feed (title ·
// pubDate · duration · GUID; see header). Clement's enclosure
// is harness-v624's captured URL.
const SAINT_CLEMENT = { title: "11/23 - Pope St. Clement I", url: "https://www.buzzsprout.com/2216056/episodes/13179882-11-23-pope-st-clement-i.mp3", pub: "Mon, 23 Nov 2026 03:00:00 -0500", dur: 1022, guid: "9d9407d8-78c2-46d7-a9e1-6440b452e053" };
const SAINT_COLUMBANUS = { title: "11/24 - St. Columbanus", url: "https://www.buzzsprout.com/2216056/episodes/18002147-11-24-st-columbanus.mp3", pub: "Tue, 24 Nov 2026 03:00:00 -0500", dur: 1272, guid: "0e035504-b8a2-4a58-a6e1-2d60da50b409" };
// SYNTHETIC today item (named per the standing honesty rule):
// the feed's standing shape for the harness's computed TODAY.
const SAINT_TODAY_SYNTHETIC = { title: `${mmdd(TODAY)} - St. Synthetic of the Harness`, url: "https://www.buzzsprout.com/2216056/episodes/18009999-synthetic-today.mp3", pub: saintStamp(TODAY), dur: 900, guid: "synthetic-today" };
function saintFeedPreRelease() {
  // The feed as the 06:00Z pass reads it: newest item is the
  // last real daily release; today's item has not published.
  return feedXml("The Saint of The Day Podcast", [itemXml(SAINT_COLUMBANUS), itemXml(SAINT_CLEMENT)]);
}
function saintFeedPostRelease() {
  return feedXml("The Saint of The Day Podcast", [itemXml(SAINT_TODAY_SYNTHETIC), itemXml(SAINT_COLUMBANUS), itemXml(SAINT_CLEMENT)]);
}
function tvMassFeedFor(dates) {
  const wd = (date) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(md(date).y, md(date).m - 1, md(date).d)).getUTCDay()];
  return feedXml("Daily TV Mass", dates.map((date) => {
    const t = md(date);
    return itemXml({ title: `Daily TV Mass ${wd(date)} ${t.full} ${t.d}, ${t.y}`, url: `https://www.buzzsprout.com/949645/episodes/20158-${date}.mp3`, pub: rfc(date, 5), dur: 1500, guid: `tvmass-${date}` });
  }));
}
function dgeFeedItems(items) { return feedXml("Daily Gospel Exegesis", items); }
function dgeItem(date, tag) {
  return itemXml({ title: `Daily Gospel Exegesis Episode (${tag})`, url: `https://anchor.fm/s/1025ef1c/podcast/play/22726844/exegesis-${tag}.mp3`, pub: rfc(date, 12), guid: `dge-${tag}` });
}
function bibleFeed() {
  const items = [TODAY, TOMORROW].map((date) => {
    const n = Math.min(doy(date), 365), t = md(date);
    return itemXml({ title: `Day ${n}: The Readings for Day ${n} (${t.y})`, url: `https://aphid.fireside.fm/d/bible/day-${n}.mp3`, pub: rfc(date, 6), guid: `biy-${date}` });
  });
  return feedXml("Bible in a Year", items);
}
function sthFeed() {
  const wd = (date) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(md(date).y, md(date).m - 1, md(date).d)).getUTCDay()];
  const items = [];
  for (const date of [TODAY, TOMORROW]) {
    const t = md(date), pre = `${t.m}.${t.d}.${String(t.y).slice(2)}`;
    items.push(itemXml({ title: `Divine Office ${pre} | ${wd(date)} Morning Prayer | Lauds`, url: `https://episodes.castos.com/sth/${date}-lauds.mp3`, pub: rfc(date, 6), guid: `sth-${date}-lauds` }));
    items.push(itemXml({ title: `Divine Office ${pre} | ${wd(date)} Evening Prayer | Vespers`, url: `https://episodes.castos.com/sth/${date}-vespers.mp3`, pub: rfc(date, 6), guid: `sth-${date}-vespers` }));
  }
  return feedXml("Sing the Hours", items);
}
function genericRssFeed(tag) {
  return feedXml(tag, [1, 2].map((i) => itemXml({ title: `${tag} Episode ${i}`, url: `https://fixture.local/${tag}/${i}.mp3`, pub: rfc(TODAY, 7), guid: `${tag}-guid-${i}` })));
}
function courseFeed() {
  return feedXml("Course", [1, 2, 3].map((i) => itemXml({ title: `Day ${i}: Lesson ${i} (2026)`, url: `https://fixture.local/course/day-${i}.mp3`, pub: rfc(TODAY, 7), guid: `course-${i}` })));
}
function ownFeed() {
  const items = [itemXml({ title: "Novena to Saint Clement Day 1 - November 23, 2026", url: `https://audio.orapronobis.media/${TODAY}-novena-to-saint-clement-day-1.mp3`, pub: rfc(TODAY, 4), guid: "own-novena-1" })];
  items.push(itemXml({ title: "Morning Prayer", url: `https://audio.orapronobis.media/${TODAY}-morning-prayer-elevenlabs.mp3`, pub: rfc(TODAY, 4), guid: "own-mp" }));
  return feedXml("Ora Pro Nobis", items);
}
function ytFeed(tag) {
  const pub = new Date(Date.now() - 3600 * 1000).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom"><title>${tag}</title><entry><id>yt:video:vid-${tag}-1</id><yt:videoId>vid-${tag}-1</yt:videoId><title>${tag} Video 1</title><link rel="alternate" href="https://www.youtube.com/watch?v=vid-${tag}-1"/><published>${pub}</published><media:group><media:thumbnail url="https://i.ytimg.com/vi/vid-${tag}-1/hqdefault.jpg" width="480" height="360"/><media:description>${tag} description</media:description></media:group></entry></feed>`;
}
const YT_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Empty</title></feed>`;
const EMPTY_FEED = feedXml("Empty", []);

// ---------- fake D1 ----------
const SEED_SOURCES = [];
{
  const add = (key, name, slotId, block, sortOrder, role) => SEED_SOURCES.push({ source_key: key, name, family: "external", block, day_rule: role === "fallback" ? "fallback-only" : "daily", sort_order: sortOrder, enabled: 1, slot_id: slotId, role: role || "primary" });
  DO_TOKENS.forEach(([slot], i) => add("do-" + slot, "Divine Office " + slot, slot, "Morning", i + 1));
  add("dge", "Daily Gospel Exegesis", "ext-gospel-exegesis", "Midmorning", 1);
  add("biy", "Bible in a Year", "ext-bible-in-a-year", "Morning", 9);
  add("saint", "Saint of the Day", "ext-saint-of-the-day", "Afternoon", 1);
  add("tvmass", "Daily TV Mass", "ext-daily-tv-mass", "Mass and Homilies", 2);
  add("sth-lauds", "Sing the Hours Lauds", "ext-morning-prayer", "Morning", 3, "fallback");
  add("sth-vespers", "Sing the Hours Vespers", "ext-evening-prayer", "Evening", 3, "fallback");
}
class FakeDB {
  constructor() {
    this.resolutions = new Map(); // date|slot -> row
    this.feedState = new Map();
    this.rss = new Map(); // series -> {payload, built_at}
    this.seqs = new Map();
    this.video = new Map();
  }
  prepare(sql) {
    const db = this;
    let args = [];
    const stmt = {
      bind(...a) { args = a; return stmt; },
      async first() {
        if (sql.includes("player_settings_meta")) return { version: 1 };
        if (sql.includes("FROM ext_feed_state")) return db.feedState.get(args[0]) ?? null;
        if (sql.includes("SELECT state FROM ext_resolutions")) { const r = db.resolutions.get(args[0] + "|" + args[1]); return r ? { state: r.state } : null; }
        if (sql.includes("SELECT built_at FROM rss_snapshots")) { const r = db.rss.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes("SELECT built_at FROM podcast_sequences")) { const r = db.seqs.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes("SELECT built_at FROM video_snapshots")) { const r = db.video.get(args[0]); return r ? { built_at: r.built_at } : null; }
        if (sql.includes("SELECT payload FROM rss_snapshots")) { const r = db.rss.get(args[0]); return r ? { payload: r.payload } : null; }
        if (sql.includes("SELECT payload FROM podcast_sequences")) { const r = db.seqs.get(args[0]); return r ? { payload: r.payload } : null; }
        if (sql.includes("SELECT payload FROM video_snapshots")) { const r = db.video.get(args[0]); return r ? { payload: r.payload } : null; }
        return null;
      },
      async all() {
        if (sql.includes("player_source_settings")) return { results: SEED_SOURCES };
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
        return {};
      },
    };
    return stmt;
  }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
}

// ---------- worker bundle + fetch stub ----------
const TMP = mkdtempSync(tmpdir() + "/v657-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;

const FEEDS = new Map(); // url -> {status, body} | () => {status, body}
const FETCH_COUNT = new Map();
const hdr = (obj) => ({ get: (n) => (obj[String(n).toLowerCase()] ?? null) });
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  FETCH_COUNT.set(u, (FETCH_COUNT.get(u) || 0) + 1);
  // Synthesis HEAD/GET probes and site pages carry no fixture:
  // every candidate misses, every page 404s (the DO ladder's
  // rungs 2/4 write nothing, as on a healthy-feed day).
  if (opts && opts.method === "HEAD") return { ok: false, status: 404, headers: hdr({}), text: async () => "" };
  const f = FEEDS.get(u);
  if (!f) return { ok: false, status: 404, headers: hdr({}), text: async () => "no fixture" };
  const r = typeof f === "function" ? f() : f;
  return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: hdr({}), text: async () => r.body };
};
const U = (k) => "https://fixture.local/" + k;
function setFeed(key, body, status) { FEEDS.set(U(key), { status: status ?? 200, body }); }
function setAllHealthy() {
  setFeed("do", DO_HEALTHY); setFeed("dge", dgeFeedItems([dgeItem(YESTERDAY, "for-today"), dgeItem(TODAY, "for-tomorrow")]));
  setFeed("biy", bibleFeed());
  setFeed("saint", saintFeedPostRelease()); setFeed("tvmass", tvMassFeedFor([TODAY, TOMORROW])); setFeed("sth", sthFeed());
  setFeed("own", ownFeed()); setFeed("course", courseFeed());
  for (const k of ["exorcist", "counsel", "frmike", "barron", "usccb-readings"]) setFeed(k, genericRssFeed(k));
  for (const k of ["yt-catholictv", "yt-dailytvmass", "yt-springfieldmass"]) setFeed(k, ytFeed(k));
}
function makeEnv(db) {
  return {
    DB: db, AUDIO: { get: async () => null, put: async () => { throw new Error("R2 put must not happen in v657 path"); } },
    AGENT_TOKEN: "agent-test", LOCAL_DEV: "1",
    EXT_DO_FEED_URL: U("do"), EXT_DGE_FEED_URL: U("dge"), EXT_BIAY_FEED_URL: U("biy"),
    EXT_SAINT_FEED_URL: U("saint"), EXT_TVMASS_FEED_URL: U("tvmass"), EXT_STH_FEED_URL: U("sth"),
    OWN_FEED_URL: U("own"),
    EXT_EXORCIST_FEED_URL: U("exorcist"), EXT_COUNSEL_TRENT_FEED_URL: U("counsel"),
    EXT_FRMIKE_HOMILIES_FEED_URL: U("frmike"), EXT_BARRON_SERMONS_FEED_URL: U("barron"),
    EXT_DAILY_READINGS_FEED_URL: U("usccb-readings"), EXT_SUMMA_FEED_URL: U("course"),
    EXT_CIY_FEED_URL: U("course"), EXT_RIY_FEED_URL: U("course"),
    EXT_YT_CATHOLICTV_FEED_URL: U("yt-catholictv"), EXT_YT_DAILYTV_FEED_URL: U("yt-dailytvmass"),
    EXT_YT_SPRINGFIELD_FEED_URL: U("yt-springfieldmass"),
    EXT_SYNTH_BASE_URL: U("synth/"), EXT_DO_SITE_BASE_URL: U("site"),
  };
}
const count = (key) => FETCH_COUNT.get(U(key)) || 0;
async function agentResolve(env, body) {
  const res = await WORKER.fetch(new Request("https://app.local/api/agent/externals/resolve", { method: "POST", headers: { authorization: "Bearer agent-test", "content-type": "application/json" }, body: JSON.stringify(body || {}) }), env);
  return res.json();
}
async function scheduledPass(env) {
  let waited = null;
  await WORKER.scheduled({}, env, { waitUntil: (p) => { waited = p; } });
  if (waited) return waited; // the pass summary array
  return null;
}
const summaryOf = (r, feed) => (r || []).find((x) => x.feed === feed);
const rowOf = (db, date, slot) => db.resolutions.get(date + "|" + slot);

// ---------- S1 + S3 + S2: the saint day, in the field's order ----------
{
  setAllHealthy();
  const db = new FakeDB();
  const env = makeEnv(db);
  // S8's seed rides this DB too: the Nov 23-shape past row.
  const pastDate = shift(TODAY, -2);
  const pastRow = { slot_id: "ext-saint-of-the-day", date: pastDate, state: "present", title: "11/23 - Pope St. Clement I", stream_url: SAINT_CLEMENT.url, duration_s: 1022, size_bytes: 1000000, image_url: null, desc_text: null, resolved_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(), feed_stamp: "2026-11-23T08:00:00.000Z", episode_date: pastDate, source: null, backup_url: null, backup_source: null, route: null, backup_image_url: null, backup_duration_s: null };
  db.resolutions.set(pastDate + "|ext-saint-of-the-day", { ...pastRow });

  // S1: pre-release feed, unforced scheduled pass (the 06:00Z shape).
  setFeed("saint", saintFeedPreRelease());
  const saintBefore = count("saint");
  await scheduledPass(env);
  const s1Today = rowOf(db, TODAY, "ext-saint-of-the-day");
  const s1Tmr = rowOf(db, TOMORROW, "ext-saint-of-the-day");
  // v665: the intended count is exactly 2 — the pass reads the saint feed
  // once for the ext-saint-of-the-day slot resolver and once for the new
  // rss:saint-of-the-day snapshot (the series def joins the watcher by
  // construction; the snapshot is missing on this first pass, so it builds).
  check("S1 pre-release scheduled pass fetched the saint feed exactly twice (ext-saint-of-the-day slot + rss:saint-of-the-day snapshot)", count("saint") === saintBefore + 2, count("saint") - saintBefore);
  check("S1 saint 'missing' for today after the pre-release pass", !!s1Today && s1Today.state === "missing", s1Today);
  check("S1 saint 'missing' for tomorrow after the pre-release pass", !!s1Tmr && s1Tmr.state === "missing", s1Tmr);

  // S3: the feed 500s on the next pass — nothing is written.
  setFeed("saint", DO_500, 500);
  const frozen = JSON.stringify(rowOf(db, TODAY, "ext-saint-of-the-day"));
  const r3 = await agentResolve(env);
  const sum3 = summaryOf(r3.results, "saint-of-the-day");
  check("S3 saint feed HTTP 500 is a failed read in the summary", !!sum3 && sum3.ok === false, sum3);
  check("S3 the failed read wrote nothing (today's row byte-identical)", JSON.stringify(rowOf(db, TODAY, "ext-saint-of-the-day")) === frozen);
  const fst3 = db.feedState.get("saint-of-the-day");
  check("S3 feed state records the error", !!fst3 && !!fst3.last_error, fst3);

  // S2: the publisher's item appears; the next UNFORCED
  // scheduled pass lands it — the pre-release 'missing' must
  // not stand the feed down.
  setFeed("saint", saintFeedPostRelease());
  const saintBefore2 = count("saint");
  await scheduledPass(env);
  const s2 = rowOf(db, TODAY, "ext-saint-of-the-day");
  check("S2 post-release scheduled pass re-fetched the saint feed (not stood down by 'missing')", count("saint") === saintBefore2 + 1, count("saint") - saintBefore2);
  check("S2 saint 'present' for today after the release", !!s2 && s2.state === "present", s2);
  check("S2 the row carries the item's own title", !!s2 && s2.title === SAINT_TODAY_SYNTHETIC.title, s2 && s2.title);
  check("S2 the row carries the item's own stream", !!s2 && s2.stream_url === SAINT_TODAY_SYNTHETIC.url, s2 && s2.stream_url);
  check("S2 the row carries the item's own duration", !!s2 && s2.duration_s === SAINT_TODAY_SYNTHETIC.dur, s2 && s2.duration_s);

  // S8: the past-date row survived every pass above untouched.
  check("S8 past-date 'present' saint row never rewritten", JSON.stringify(rowOf(db, pastDate, "ext-saint-of-the-day")) === JSON.stringify(pastRow), rowOf(db, pastDate, "ext-saint-of-the-day"));
}

// ---------- S4: exegesis two-act ----------
{
  setAllHealthy();
  const db = new FakeDB();
  const env = makeEnv(db);
  // Act 1 (midnight shape): only tomorrow's scheduled item
  // stands in the feed; today's episode (due yesterday) has
  // not posted — no item released on or before today.
  setFeed("dge", dgeFeedItems([dgeItem(TOMORROW, "for-tomorrow")]));
  await scheduledPass(env);
  const a1 = rowOf(db, TODAY, "ext-gospel-exegesis");
  check("S4 act 1: exegesis 'missing' for today at the midnight-shape pass", !!a1 && a1.state === "missing", a1);
  // Act 2: the episode FOR today appears (released yesterday,
  // the standing D-1 attribution); the next scheduled pass lands it.
  setFeed("dge", dgeFeedItems([dgeItem(TOMORROW, "for-tomorrow"), dgeItem(YESTERDAY, "for-today")]));
  const dgeBefore = count("dge");
  await scheduledPass(env);
  const a2 = rowOf(db, TODAY, "ext-gospel-exegesis");
  check("S4 act 2: the feed was re-fetched despite the 'missing' row", count("dge") === dgeBefore + 1, count("dge") - dgeBefore);
  check("S4 act 2: exegesis 'present' for today with the landed item", !!a2 && a2.state === "present" && /for-today/.test(a2.stream_url || ""), a2);
}

// ---------- S5: TV Mass two-act ----------
{
  setAllHealthy();
  const db = new FakeDB();
  const env = makeEnv(db);
  setFeed("tvmass", tvMassFeedFor([YESTERDAY])); // yesterday's Mass only: a healthy read, no match today
  await scheduledPass(env);
  const a1 = rowOf(db, TODAY, "ext-daily-tv-mass");
  check("S5 act 1: TV Mass 'missing' for today", !!a1 && a1.state === "missing", a1);
  setFeed("tvmass", tvMassFeedFor([TODAY, TOMORROW]));
  const tvBefore = count("tvmass");
  await scheduledPass(env);
  const a2 = rowOf(db, TODAY, "ext-daily-tv-mass");
  check("S5 act 2: the feed was re-fetched despite the 'missing' row", count("tvmass") === tvBefore + 1, count("tvmass") - tvBefore);
  check("S5 act 2: TV Mass 'present' for today with today's item", !!a2 && a2.state === "present" && (a2.stream_url || "").includes(TODAY), a2);
}

// ---------- S6: Divine Office ----------
{
  // Act 1: a fully-resolved day stands byte-identical under
  // later passes (gate c).
  setAllHealthy();
  const db = new FakeDB();
  const env = makeEnv(db);
  await agentResolve(env);
  const snap1 = new Map([...db.resolutions.entries()].filter(([k]) => DO_TOKENS.some(([slot]) => k.endsWith("|" + slot))).map(([k, v]) => [k, JSON.stringify(v)]));
  check("S6 act 1 setup: all 16 DO rows (today + tomorrow) present", snap1.size === 16 && [...snap1.values()].every((s) => JSON.parse(s).state === "present"), snap1.size);
  const doBefore = count("do");
  await scheduledPass(env);
  await scheduledPass(env);
  const snap2 = new Map([...db.resolutions.entries()].filter(([k]) => DO_TOKENS.some(([slot]) => k.endsWith("|" + slot))).map(([k, v]) => [k, JSON.stringify(v)]));
  check("S6 act 1: later passes do not re-fetch a fully-present DO feed", count("do") === doBefore, count("do") - doBefore);
  check("S6 act 1: every DO row byte-identical across later passes", snap1.size === snap2.size && [...snap1.entries()].every(([k, v]) => snap2.get(k) === v));
}
{
  // Act 2: one hour left 'missing' after rung 1 — the next
  // pass FETCHES the DO feed instead of standing down.
  setAllHealthy();
  setFeed("do", doFeedFor([TODAY, TOMORROW], ["Midday Prayer"]));
  const db = new FakeDB();
  const env = makeEnv(db);
  await agentResolve(env);
  const miss = rowOf(db, TODAY, "ext-midday-prayer");
  check("S6 act 2 setup: Midday Prayer stands 'missing' after rung 1", !!miss && miss.state === "missing", miss);
  const doBefore = count("do");
  const r = await agentResolve(env);
  const sum = summaryOf(r.results, "divine-office");
  check("S6 act 2: next pass FETCHES the divine-office feed (not 'stood-down')", !!sum && sum.skipped !== "stood-down" && count("do") === doBefore + 1, { sum, fetched: count("do") - doBefore });
}

// ---------- S7: snapshot freshness per class ----------
const RSS_AGE = 2 * 3600 * 1000, POD_AGE = 24 * 3600 * 1000, VIDEO_AGE = 2 * 3600 * 1000;
const RSS_KEYS = ["exorcist-files", "counsel-of-trent", "fr-mike-homilies", "barron-sunday-sermons", "daily-gospel-exegesis", "daily-readings", "ora-pro-nobis"];
const SEQ_KEYS = ["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year", "summa-in-a-year"];
const VIDEO_KEYS = ["catholictv", "dailytvmass", "springfieldmass"];
function seedAllSnapshotsFresh(db) {
  const now = new Date().toISOString();
  for (const k of RSS_KEYS) db.rss.set(k, { payload: JSON.stringify({ entries: [{ key: "seed-" + k }], builtAt: now, showImageUrl: null, showDesc: null }), built_at: now });
  db.rss.set("novenas-catalog", { payload: JSON.stringify({ builtAt: now, novenas: [{ key: "seed-novena" }] }), built_at: now });
  for (const k of SEQ_KEYS) db.seqs.set(k, { payload: JSON.stringify({ entries: [{ key: "seed-" + k }], collapses: 0, builtAt: now, showImageUrl: null, showDesc: null }), built_at: now });
  for (const k of VIDEO_KEYS) db.video.set(k, { payload: JSON.stringify({ videos: [{ id: "seed-" + k, title: "seed", url: "https://www.youtube.com/watch?v=seed", publishedMs: 1, imageUrl: null, descText: null }], builtAt: now }), built_at: now });
}
async function s7Class(label, store, key, feedUrlKey, feedStateKey, maxAge, zeroFeed) {
  setAllHealthy();
  const db = new FakeDB();
  const env = makeEnv(db);
  seedAllSnapshotsFresh(db);
  const inside = new Date(Date.now() - (maxAge - 60 * 1000)).toISOString();
  store(db).set(key, { payload: store(db).get(key).payload, built_at: inside });
  const beforeCount = count(feedUrlKey);
  await agentResolve(env);
  check(`S7 ${label}: built_at inside max age -> the pass fetches nothing for it`, count(feedUrlKey) === beforeCount && store(db).get(key).built_at === inside, { fetches: count(feedUrlKey) - beforeCount, built_at: store(db).get(key).built_at });
  const past = new Date(Date.now() - (maxAge + 60 * 1000)).toISOString();
  store(db).set(key, { payload: store(db).get(key).payload, built_at: past });
  await agentResolve(env);
  const rebuilt = store(db).get(key);
  check(`S7 ${label}: built_at past max age -> rebuilt, built_at advances`, count(feedUrlKey) > beforeCount && rebuilt.built_at > past && !rebuilt.payload.includes("seed-"), { fetches: count(feedUrlKey) - beforeCount, built_at: rebuilt.built_at });
  // Zero-yield rebuild: the old snapshot stands, error recorded.
  const standingPayload = rebuilt.payload;
  store(db).set(key, { payload: standingPayload, built_at: past });
  zeroFeed();
  const r = await agentResolve(env);
  const sum = summaryOf(r.results, feedStateKey);
  const fst = db.feedState.get(feedStateKey);
  check(`S7 ${label}: zero-yield rebuild leaves the old snapshot standing`, store(db).get(key).payload === standingPayload && store(db).get(key).built_at === past, store(db).get(key).built_at);
  check(`S7 ${label}: zero-yield rebuild records the error in ext_feed_state`, !!sum && sum.ok === false && !!fst && !!fst.last_error, { sum, fst });
}
await s7Class("rss_snapshots", (db) => db.rss, "exorcist-files", "exorcist", "rss:exorcist-files", RSS_AGE, () => setFeed("exorcist", EMPTY_FEED));
await s7Class("novenas-catalog", (db) => db.rss, "novenas-catalog", "own", "novenas-catalog", RSS_AGE, () => setFeed("own", EMPTY_FEED));
await s7Class("podcast_sequences", (db) => db.seqs, "catechism-in-a-year", "course", "course:catechism-in-a-year", POD_AGE, () => setFeed("course", EMPTY_FEED));
await s7Class("video_snapshots", (db) => db.video, "catholictv", "yt-catholictv", "video:catholictv", VIDEO_AGE, () => setFeed("yt-catholictv", YT_EMPTY));

console.log(`\nharness-v657: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
