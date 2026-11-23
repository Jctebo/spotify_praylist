// harness-v626.mjs — v626: the Sing the Hours fallback fills
// Morning + Evening Prayer when the Divine Office feed does
// not resolve — INCLUDING a failed read — and every fill (and
// every primary write of the two slots) names its source.
//
// The REAL Worker (esbuild bundle of worker/src/index.ts) is
// driven through its real routes (agent resolve · externals
// live) over a fake D1 carrying the v626 column (migration
// 0049: ext_resolutions.source, the 13th INSERT arg), with
// global fetch stubbed to fixture feeds. Machinery copied
// from harness-v625.mjs (FakeDB extended for source).
//
// Fixtures (Improvement D — provenance): the Divine Office
// and other feed fixtures are v624's production-shaped
// fixtures, reused as-is (see harness-v624.mjs's header).
// The Sing the Hours fixture is built from the LIVE castos
// feed (https://feeds.castos.com/x8g54) captured at Implement,
// 2026-11-23 ~08:57 CT (HTTP 200, 326,358 bytes): its item
// titles stand in the form "Divine Office 11.23.26 | Monday
// Morning Prayer | Lauds" / "Divine Office 11.23.26 | Monday
// Evening Prayer | Vespers" (M.D.YY prefix + Lauds/Vespers
// token, exactly what the standing extMatchSth reads), with
// dates re-based to the run day. ◆ legs fail against the
// v625 (base) code.
//
// Run: node app/worker/harness-v626.mjs
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
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_A = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function md(date) { const [y, m, d] = date.split("-").map(Number); return { y, m, d, full: MONTHS[m - 1], abbr: MONTHS_A[m - 1] }; }
function rfc(date, hour) { const t = md(date); const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()]; return `${wd}, ${String(t.d).padStart(2, "0")} ${t.abbr} ${t.y} ${String(hour || 12).padStart(2, "0")}:00:00 GMT`; }
function doy(date) { const t = md(date); return Math.floor((Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(t.y, 0, 0)) / 86400000); }

// ---------- fixture feeds ----------
function itemXml({ title, url, pub, dur, len, guid }) {
  return `<item><title>${title}</title><pubDate>${pub}</pubDate>${guid ? `<guid>${guid}</guid>` : ""}<enclosure url="${url}" length="${len || 1000000}" type="audio/mpeg"/><itunes:duration>${dur || 600}</itunes:duration></item>`;
}
function feedXml(channelTitle, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${channelTitle}</title><itunes:image href="https://fixture.local/art.jpg"/>${items.join("")}</channel></rss>`;
}
const DO_TOKENS = [["ext-invitatory", "Invitatory"], ["ext-morning-prayer", "Morning Prayer"], ["ext-midmorning-prayer", "Midmorning Prayer"], ["ext-midday-prayer", "Midday Prayer"], ["ext-midafternoon-prayer", "Midafternoon Prayer"], ["ext-office-of-readings", "Office of Readings"], ["ext-evening-prayer", "Evening Prayer"], ["ext-night-prayer", "Night Prayer"]];
function doFeedFor(dates) {
  const items = [];
  for (const date of dates) {
    const t = md(date);
    for (const [, token] of DO_TOKENS) {
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
const CHALLENGE = `<!DOCTYPE html><html><head><title>One moment, please…</title></head><body><p>Checking your browser before accessing the site.</p></body></html>`;
const DO_TRUNCATED = DO_HEALTHY.slice(0, DO_HEALTHY.indexOf("</item>") - 40); // cut mid-first-item: zero complete items
function saintFeed() {
  const t = md(TODAY), t2 = md(TOMORROW);
  return feedXml("The Saint of The Day Podcast", [
    itemXml({ title: `${String(t.m).padStart(2, "0")}/${String(t.d).padStart(2, "0")} - Pope St. Clement I`, url: "https://www.buzzsprout.com/2216056/episodes/13179882-11-23-pope-st-clement-i.mp3", pub: rfc(TODAY, 8), guid: "9d9407d8-78c2-46d7-a9e1-6440b452e053" }),
    itemXml({ title: `${String(t2.m).padStart(2, "0")}/${String(t2.d).padStart(2, "0")} - St. Andrew Dung-Lac`, url: "https://www.buzzsprout.com/2216056/episodes/13179884-saint-tomorrow.mp3", pub: rfc(TOMORROW, 8), guid: "saint-tomorrow" }),
  ]);
}
function tvMassFeed() {
  const t = md(TODAY), t2 = md(TOMORROW);
  const wd = (date) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(md(date).y, md(date).m - 1, md(date).d)).getUTCDay()];
  return feedXml("Daily TV Mass", [
    itemXml({ title: `Daily TV Mass ${wd(TODAY)} ${t.full} ${t.d}, ${t.y}`, url: "https://www.buzzsprout.com/949645/episodes/20158715-daily-tv-mass-monday-november-23-2026.mp3", pub: rfc(TODAY, 5), guid: "Buzzsprout-20158715" }),
    itemXml({ title: `Daily TV Mass ${wd(TOMORROW)} ${t2.full} ${t2.d}, ${t2.y}`, url: "https://www.buzzsprout.com/949645/episodes/20158716-tvmass-tomorrow.mp3", pub: rfc(TOMORROW, 5), guid: "Buzzsprout-tomorrow" }),
  ]);
}
function dgeFeed() {
  return feedXml("Daily Gospel Exegesis", [
    itemXml({ title: "Monday of Week 34 in Ordinary Time - Luke 21: 1-4", url: "https://anchor.fm/s/1025ef1c/podcast/play/22726844/exegesis.mp3", pub: rfc(TODAY, 0), guid: "2fd6c993-9aa2-4fe3-9723-34a61352d8a6" }),
    itemXml({ title: "Tuesday of Week 34 in Ordinary Time - Luke 21: 5-11", url: "https://anchor.fm/s/1025ef1c/podcast/play/22726845/exegesis-tomorrow.mp3", pub: rfc(TOMORROW, 0), guid: "dge-tomorrow" }),
  ]);
}
function dgeFeedReleased(date) {
  // v625: a single-item exegesis feed whose only item was
  // released (Chicago) on `date` — pub 12:00 GMT = morning
  // Chicago the same day. Built to the standing matcher's
  // shape (extMatchLatestByDate: latest release not after the
  // presented date) with dates relative to the run day.
  return feedXml("Daily Gospel Exegesis", [
    itemXml({ title: "Daily Gospel Exegesis Episode", url: "https://anchor.fm/s/1025ef1c/podcast/play/22726844/exegesis.mp3", pub: rfc(date, 12), guid: "dge-rel-" + date }),
  ]);
}
function dgeFeedHealthy() {
  // v625 S4: a healthy exegesis feed in its morning state —
  // per the v611 attribution the episode FOR today is the one
  // released (Chicago) yesterday; today's release has not
  // posted yet. Two items: released two days ago and yesterday
  // (12:00 GMT = morning Chicago the same day).
  return feedXml("Daily Gospel Exegesis", [
    itemXml({ title: "Daily Gospel Exegesis Episode (older)", url: "https://anchor.fm/s/1025ef1c/podcast/play/22726843/exegesis-older.mp3", pub: rfc(shift(TODAY, -2), 12), guid: "dge-healthy-older" }),
    itemXml({ title: "Daily Gospel Exegesis Episode", url: "https://anchor.fm/s/1025ef1c/podcast/play/22726844/exegesis.mp3", pub: rfc(shift(TODAY, -1), 12), guid: "dge-healthy-today" }),
  ]);
}
function doFeedEveningBefore(dates) {
  // v625 S5: Divine Office items carrying each date's TITLE
  // dates with pubDates the prior evening (23:00 GMT = 17:00
  // CST) — the provider's real evening-before posting shape.
  const items = [];
  for (const date of dates) {
    const t = md(date);
    for (const [, token] of DO_TOKENS) {
      const title = token === "Invitatory"
        ? `${t.abbr} ${t.d}, Invitatory for Monday of the 34th week of Ordinary Time`
        : `${t.abbr} ${t.d}, ${token} for ${t.full} ${t.d}, ${t.y}`;
      items.push(itemXml({ title, url: `https://divineoffice.org/audio/${date}-${token.replace(/\s+/g, "-").toLowerCase()}.mp3`, pub: rfc(shift(date, -1), 23), dur: 700, guid: `do-${date}-${token}` }));
    }
  }
  return feedXml("Divine Office", items);
}
function bibleFeed() {
  const items = [TODAY, TOMORROW].map((date) => {
    const n = Math.min(doy(date), 365), t = md(date);
    return itemXml({ title: `Day ${n}: The Readings for Day ${n} (${t.y})`, url: `https://aphid.fireside.fm/d/bible/day-${n}.mp3`, pub: rfc(date, 6), guid: `biy-${date}` });
  });
  return feedXml("Bible in a Year", items);
}
function sthFeed() {
  // v626: titles in the LIVE castos shape captured 2026-11-23
  // ("Divine Office M.D.YY | <Weekday> Morning Prayer | Lauds"),
  // re-based to the run day; enclosure host episodes.castos.com
  // as the live feed's enclosures stand.
  const wd = (date) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(md(date).y, md(date).m - 1, md(date).d)).getUTCDay()];
  const items = [];
  for (const date of [TODAY, TOMORROW]) {
    const t = md(date), pre = `${t.m}.${t.d}.${String(t.y).slice(2)}`;
    items.push(itemXml({ title: `Divine Office ${pre} | ${wd(date)} Morning Prayer | Lauds`, url: `https://episodes.castos.com/sth/${date}-lauds.mp3`, pub: rfc(date, 6), guid: `sth-${date}-lauds` }));
    items.push(itemXml({ title: `Divine Office ${pre} | ${wd(date)} Evening Prayer | Vespers`, url: `https://episodes.castos.com/sth/${date}-vespers.mp3`, pub: rfc(date, 6), guid: `sth-${date}-vespers` }));
  }
  return feedXml("Sing the Hours", items);
}
function doFeedOmitting(omitTokens) {
  // A healthy Divine Office read whose feed carries every hour
  // EXCEPT the named tokens, for today + tomorrow.
  const items = [];
  for (const date of [TODAY, TOMORROW]) {
    const t = md(date);
    for (const [, token] of DO_TOKENS) {
      if (omitTokens.includes(token)) continue;
      const title = token === "Invitatory"
        ? `${t.abbr} ${t.d}, Invitatory for Monday of the 34th week of Ordinary Time`
        : `${t.abbr} ${t.d}, ${token} for ${t.full} ${t.d}, ${t.y}`;
      items.push(itemXml({ title, url: `https://divineoffice.org/audio/${date}-${token.replace(/\s+/g, "-").toLowerCase()}.mp3`, pub: rfc(date, 5), dur: 700, guid: `do-${date}-${token}` }));
    }
  }
  return feedXml("Divine Office", items);
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
        if (sql.includes("SELECT payload FROM rss_snapshots")) { const r = db.rss.get(args[0]); return r ? { payload: r.payload } : null; }
        if (sql.includes("SELECT payload FROM podcast_sequences")) { const r = db.seqs.get(args[0]); return r ? { payload: r.payload } : null; }
        return null;
      },
      async all() {
        if (sql.includes("player_source_settings")) return { results: SEED_SOURCES };
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
          const [slot_id, date, state, title, stream_url, duration_s, size_bytes, image_url, desc_text, resolved_at, feed_stamp, episode_date, source] = args;
          db.resolutions.set(date + "|" + slot_id, { slot_id, date, state, title, stream_url, duration_s, size_bytes, image_url, desc_text, resolved_at, feed_stamp, episode_date, source });
          return {};
        }
        if (sql.startsWith("DELETE FROM ext_resolutions")) {
          for (const k of [...db.resolutions.keys()]) if (k.split("|")[0] < args[0]) db.resolutions.delete(k);
          return {};
        }
        if (sql.startsWith("INSERT INTO rss_snapshots")) { db.rss.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        if (sql.startsWith("INSERT INTO podcast_sequences")) { db.seqs.set(args[0], { payload: args[1], built_at: args[2] }); return {}; }
        return {};
      },
    };
    return stmt;
  }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
}

// ---------- worker bundle + fetch stub ----------
const TMP = mkdtempSync(tmpdir() + "/v626-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;

const FEEDS = new Map(); // url -> {status, body} | () => {status, body}
const FETCH_COUNT = new Map();
globalThis.fetch = async (url) => {
  const u = String(url);
  FETCH_COUNT.set(u, (FETCH_COUNT.get(u) || 0) + 1);
  const f = FEEDS.get(u);
  if (!f) return { ok: false, status: 404, text: async () => "no fixture" };
  const r = typeof f === "function" ? f() : f;
  return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.body };
};
const U = (k) => "https://fixture.local/" + k;
function setFeed(key, body, status) { FEEDS.set(U(key), { status: status ?? 200, body }); }
function setAllHealthy() {
  setFeed("do", DO_HEALTHY); setFeed("dge", dgeFeed()); setFeed("biy", bibleFeed());
  setFeed("saint", saintFeed()); setFeed("tvmass", tvMassFeed()); setFeed("sth", sthFeed());
  setFeed("own", ownFeed()); setFeed("course", courseFeed());
  for (const k of ["exorcist", "counsel", "frmike", "barron", "usccb-readings"]) setFeed(k, genericRssFeed(k));
}
function makeEnv(db) {
  return {
    DB: db, AUDIO: { get: async () => null, put: async () => { throw new Error("R2 put must not happen in v624 path"); } },
    AGENT_TOKEN: "agent-test", LOCAL_DEV: "1",
    EXT_DO_FEED_URL: U("do"), EXT_DGE_FEED_URL: U("dge"), EXT_BIAY_FEED_URL: U("biy"),
    EXT_SAINT_FEED_URL: U("saint"), EXT_TVMASS_FEED_URL: U("tvmass"), EXT_STH_FEED_URL: U("sth"),
    OWN_FEED_URL: U("own"),
    EXT_EXORCIST_FEED_URL: U("exorcist"), EXT_COUNSEL_TRENT_FEED_URL: U("counsel"),
    EXT_FRMIKE_HOMILIES_FEED_URL: U("frmike"), EXT_BARRON_SERMONS_FEED_URL: U("barron"),
    EXT_DAILY_READINGS_FEED_URL: U("usccb-readings"), EXT_SUMMA_FEED_URL: U("course"),
    EXT_CIY_FEED_URL: U("course"), EXT_RIY_FEED_URL: U("course"),
  };
}
const count = (key) => FETCH_COUNT.get(U(key)) || 0;
async function agentResolve(env, body) {
  const res = await WORKER.fetch(new Request("https://app.local/api/agent/externals/resolve", { method: "POST", headers: { authorization: "Bearer agent-test", "content-type": "application/json" }, body: JSON.stringify(body || {}) }), env);
  return res.json();
}
async function live(env, date) {
  const res = await WORKER.fetch(new Request("https://app.local/api/player/externals/live?date=" + (date || TODAY)), env);
  return res.json();
}
async function nudge(env) {
  const res = await WORKER.fetch(new Request("https://app.local/api/player/externals/nudge", { method: "POST" }), env);
  return res.json();
}
const summaryOf = (r, feed) => (r.results || []).find((x) => x.feed === feed);

// ---------- F1 ◆: DO read FAILS (500) + StH carries today's Lauds -> Morning stands the StH fill, labeled ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500);
  const db = new FakeDB();
  const env = makeEnv(db);
  await agentResolve(env);
  const row = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("F1 ◆ DO failed read: Morning stands present from the StH fill", !!row && row.state === "present", row);
  check("F1 ◆ Morning pointer is the StH Lauds enclosure", !!row && row.stream_url === `https://episodes.castos.com/sth/${TODAY}-lauds.mp3`, row && row.stream_url);
  check("F1 ◆ Morning title names the source: 'Morning Prayer - Sing the Hours'", !!row && row.title === "Morning Prayer - Sing the Hours", row && row.title);
  check("F1 ◆ Morning source stamps 'Sing the Hours'", !!row && row.source === "Sing the Hours", row && row.source);
  const payload = await live(env, TODAY);
  const entry = (payload.slots || []).find((e) => e.slotId === "ext-morning-prayer");
  check("F1 ◆ live payload serves the labeled StH title", !!entry && entry.state === "present" && entry.title === "Morning Prayer - Sing the Hours", entry);
}
// ---------- F2 ◆: same for Evening / Vespers ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500);
  const db = new FakeDB();
  const env = makeEnv(db);
  await agentResolve(env);
  const row = db.resolutions.get(TODAY + "|ext-evening-prayer");
  check("F2 ◆ DO failed read: Evening stands present from the StH fill (Vespers pointer)", !!row && row.state === "present" && row.stream_url === `https://episodes.castos.com/sth/${TODAY}-vespers.mp3`, row);
  check("F2 ◆ Evening title + source name Sing the Hours", !!row && row.title === "Evening Prayer - Sing the Hours" && row.source === "Sing the Hours", row && { title: row.title, source: row.source });
}
// ---------- F3 ◆: DO successful read, Morning no match -> fill stands, labeled (standing behavior, new label) ----------
{
  setAllHealthy(); setFeed("do", doFeedOmitting(["Morning Prayer"]));
  const db = new FakeDB();
  const env = makeEnv(db);
  const r = await agentResolve(env);
  const row = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("F3 ◆ DO healthy, Morning unmatched: StH fill stands present", !!row && row.state === "present" && /episodes\.castos\.com/.test(row.stream_url || ""), row);
  check("F3 ◆ fill carries the Sing the Hours title + source", !!row && row.title === "Morning Prayer - Sing the Hours" && row.source === "Sing the Hours", row && { title: row.title, source: row.source });
  const sum = summaryOf(r, "sing-the-hours");
  check("F3 sing-the-hours summary reports the fills", !!sum && sum.ok === true && sum.slotsWritten >= 2, sum);
  const ev = db.resolutions.get(TODAY + "|ext-evening-prayer");
  check("F3 Evening resolved from the primary carries the Divine Office label", !!ev && ev.state === "present" && ev.title === "Evening Prayer - Divine Office" && ev.source === "Divine Office", ev && { title: ev.title, source: ev.source });
}
// ---------- F4 ◆: while a fallback stands the DO feed does NOT stand down; a late DO post flips pointer + label ----------
{
  setAllHealthy(); setFeed("do", doFeedOmitting(["Morning Prayer"]));
  const db = new FakeDB();
  const env = makeEnv(db);
  await agentResolve(env);
  const fill = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("F4 fallback stands after pass 1 (StH pointer + label)", !!fill && fill.source === "Sing the Hours" && /castos\.com/.test(fill.stream_url || ""), fill);
  const doAfter1 = count("do");
  setFeed("do", DO_HEALTHY); // the primary posts late: Morning now stands in the DO feed
  await agentResolve(env);
  check("F4 ◆ DO feed is re-fetched while the fallback stands (no stand-down)", count("do") === doAfter1 + 1, { before: doAfter1, after: count("do") });
  const row = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("F4 ◆ row flips to the DO pointer + 'Morning Prayer - Divine Office' + source 'Divine Office'",
    !!row && row.state === "present" && row.stream_url === `https://divineoffice.org/audio/${TODAY}-morning-prayer.mp3` && row.title === "Morning Prayer - Divine Office" && row.source === "Divine Office", row);
}
// ---------- F5: Night Prayer unresolved under a DO failure -> NO fallback; a non-office slot never falls back ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500);
  const db = new FakeDB();
  const env = makeEnv(db);
  await agentResolve(env);
  check("F5 Night Prayer stands NO row under a DO failure (expressly out of the order)", !db.resolutions.has(TODAY + "|ext-night-prayer"));
  check("F5 Invitatory (non-fallback office slot) stands NO row", !db.resolutions.has(TODAY + "|ext-invitatory"));
  const sthRows = [...db.resolutions.values()].filter((r) => r.source === "Sing the Hours").map((r) => r.slot_id).sort();
  check("F5 the only StH-filled slots are Morning + Evening", JSON.stringify(sthRows) === JSON.stringify(["ext-evening-prayer", "ext-evening-prayer", "ext-morning-prayer", "ext-morning-prayer"]), sthRows);
}
// ---------- F6 ◆: today's fallback carries NO stale flag; a primary row carries the DO label and no stale ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500);
  const db = new FakeDB();
  const env = makeEnv(db);
  await agentResolve(env);
  const payload = await live(env, TODAY);
  const entry = (payload.slots || []).find((e) => e.slotId === "ext-morning-prayer");
  check("F6 ◆ today's StH fallback carries NO stale flag in the live payload", !!entry && entry.state === "present" && !entry.stale, entry);
  setAllHealthy();
  const db2 = new FakeDB();
  const env2 = makeEnv(db2);
  await agentResolve(env2);
  const payload2 = await live(env2, TODAY);
  const entry2 = (payload2.slots || []).find((e) => e.slotId === "ext-morning-prayer");
  check("F6 ◆ primary-present Morning carries 'Morning Prayer - Divine Office' and NO stale", !!entry2 && entry2.state === "present" && entry2.title === "Morning Prayer - Divine Office" && !entry2.stale, entry2);
}
// ---------- F7: no slot needs a fill -> the StH feed is never fetched ----------
{
  setAllHealthy();
  const db = new FakeDB();
  const env = makeEnv(db);
  const before = count("sth");
  await agentResolve(env);
  check("F7 both slots primary-present: the StH feed is NEVER fetched", count("sth") === before, { before, after: count("sth") });
  const r2 = await agentResolve(env);
  const sum = summaryOf(r2, "sing-the-hours");
  check("F7 second pass still fetches no StH (summary: no-fill-needed)", count("sth") === before && !!sum && sum.skipped === "no-fill-needed", sum);
}
// ---------- F8: a primary-present row is never overwritten by a fill; a fallback row's episode_date = its row date ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500);
  const db = new FakeDB();
  const seedRow = { slot_id: "ext-morning-prayer", date: TODAY, state: "present", title: "Morning Prayer - Divine Office", stream_url: "https://divineoffice.org/audio/last-good.mp3", duration_s: 700, size_bytes: 1000, image_url: null, desc_text: null, resolved_at: new Date().toISOString(), feed_stamp: null, episode_date: TODAY, source: "Divine Office" };
  db.resolutions.set(TODAY + "|ext-morning-prayer", { ...seedRow });
  const env = makeEnv(db);
  await agentResolve(env);
  const row = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("F8 primary-present row stands byte-identical after the fill pass (never overwritten)", !!row && row.stream_url === seedRow.stream_url && row.resolved_at === seedRow.resolved_at && row.source === "Divine Office", row);
  const fb = db.resolutions.get(TODAY + "|ext-evening-prayer");
  check("F8 the Evening fallback DID fill in the same pass", !!fb && fb.state === "present" && fb.source === "Sing the Hours", fb);
  check("F8 fallback row's episode_date = its row date (today)", !!fb && fb.episode_date === TODAY, fb && fb.episode_date);
  const fbT = db.resolutions.get(TOMORROW + "|ext-morning-prayer");
  check("F8 tomorrow's fallback row's episode_date = tomorrow (its row date)", !!fbT && fbT.episode_date === TOMORROW && fbT.source === "Sing the Hours", fbT && fbT.episode_date);
  // client retirement proof: the StH fallback firing block is gone from client.ts
  const clientSrc = readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
  check("F8 client StH fallback firing block retired (no client fetch of EXT_STH_URL settles a slot)", !clientSrc.includes("extFetchText(EXT_STH_URL)"));
  check("F8 shared helpers left standing (extMatchSth + EXT_STH_URL still defined in client)", clientSrc.includes("function extMatchSth(") && clientSrc.includes("var EXT_STH_URL ="));
}

console.log(`\nharness-v626: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
