// harness-v634.mjs — v634: Divine Office rungs 2 (filename
// synthesis) and 4 (site scrape) treat a Sing the Hours fill
// on the two labeled slots (ext-morning-prayer /
// ext-evening-prayer) as unresolved: they run their standing
// candidate / scrape loops past a present StH row and, on a
// verified Divine Office pointer, write the DO row with the
// displaced StH pointer as backup_url / backup_source
// ("Sing the Hours"), so both sources stand on the labeled
// row and the device preference (opnExtChoice628) decides.
// Displacement is one-way and labeled-only: a Divine Office
// row is never displaced, and non-labeled present rows skip
// exactly as before.
//
// The REAL Worker (esbuild bundle of worker/src/index.ts) is
// driven through its real routes over a fake D1, with global
// fetch stubbed to fixture feeds/pages. Machinery copied from
// harness-v633.mjs (FakeDB, fetch stub, feed/site fixtures,
// agentResolve/live drivers).
//
// Fixtures (Improvement D — provenance): feed fixtures are
// v624/v626's production-shaped fixtures, reused as-is (via
// harness-v628/v633). Rows are pre-seeded directly into
// FakeDB (db.resolutions.set) for TODAY with resolved_at an
// earlier same-day timestamp (12:00Z). The StH pointers are
// the harness sthFeed() fixture URLs for TODAY (lauds /
// vespers). The synthesis fixture verifies ONLY the
// psalter-form Morning name for TODAY,
// divine-ord-w02-<dow>-mp.mp3 (the real 302-verified name;
// candidates are tried cycle-form first — left unverified).
// The scrape fixture (v633 setSite shape) carries a REAL
// episode file on the Evening post page,
// divine-ord-w02-<dow>-ep2.mp3. All legs run the DO feed at
// DO_500 so rung 1 writes nothing. ◆ legs fail against
// pre-v634 code (L1, L2, L3).
//
// Legs:
//  L1 ◆ Morning StH-filled -> synthesis displaces: DO row,
//       route 'synthesis', StH pointer as backup; live
//       payload entry carries source + backup
//  L2 ◆ preference seam on L1's payload entry via the REAL
//       opnSthPrimary628 + opnExtChoice628 from client.ts
//  L3 ◆ Evening StH-filled, no synthesis -> scrape
//       displaces: DO row, route 'scrape', StH backup
//  L4   Morning DO-standing is never displaced (byte-
//       identical with backup; without backup only the
//       standing backupNeeds backup write lands)
//  L5   Non-labeled present row (Office of Readings via
//       synthesis) is byte-identical — rung 2 does not
//       rewrite it even when its candidate verifies
//
// Run: node app/worker/harness-v634.mjs
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
          const [slot_id, date, state, title, stream_url, duration_s, size_bytes, image_url, desc_text, resolved_at, feed_stamp, episode_date, source, backup_url, backup_source, route] = args;
          db.resolutions.set(date + "|" + slot_id, { slot_id, date, state, title, stream_url, duration_s, size_bytes, image_url, desc_text, resolved_at, feed_stamp, episode_date, source, backup_url: backup_url ?? null, backup_source: backup_source ?? null, route: route ?? null });
          return {};
        }
        if (sql.startsWith("UPDATE ext_resolutions SET backup_url")) {
          const r = db.resolutions.get(args[2] + "|" + args[3]);
          if (r) { r.backup_url = args[0]; r.backup_source = args[1]; }
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
const TMP = mkdtempSync(tmpdir() + "/v634-");
execFileSync(process.env.HOME + "/workspace/.tools/wrangler-env/node_modules/.bin/esbuild",
  [path.join(APP, "worker/src/index.ts"), "--bundle", "--format=cjs", "--platform=node", "--outfile=" + TMP + "/index.cjs"], { stdio: "pipe" });
const _mod = await import(TMP + "/index.cjs");
const WORKER = _mod.default?.default || _mod.default;

const FEEDS = new Map(); // url -> {status, body} | () => {status, body}
const FETCH_COUNT = new Map();
const hdr = (obj) => ({ get: (n) => (obj[String(n).toLowerCase()] ?? null) });
// v628 fixtures: synthesis verification + site pages.
const SYNTH_VERIFIED = new Set(); // file names the Libsyn stub verifies
const SITE_PAGES = new Map(); // full url -> html (or "CHALLENGE")
const DOW3 = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const dowOf = (date) => DOW3[new Date(Date.UTC(...date.split("-").map(Number).map((v, i) => i === 1 ? v - 1 : v))).getUTCDay()];
function synthOrName(date) { return `divine-ord-w34-${dowOf(date)}-or.mp3`; } // the run day's cycle-form OR name — the form of the real verified divine-ord-w34-mon-or.mp3
function synthIpName(date) { return `divine-ord-w34-${dowOf(date)}-ip.mp3`; } // the run day's cycle-form Invitatory name
function synthMpPsalterName(date) { return `divine-ord-w02-${dowOf(date)}-mp.mp3`; } // the run day's psalter-form Morning name (the real 302-verified name)
const STH_LAUDS = (date) => `https://episodes.castos.com/sth/${date}-lauds.mp3`;
const STH_VESPERS = (date) => `https://episodes.castos.com/sth/${date}-vespers.mp3`;
const SEED_AT = `${TODAY}T12:00:00.000Z`; // earlier same-day (Chicago) timestamp
function seedRow(db, slotId, over) {
  const row = { slot_id: slotId, date: TODAY, state: "present", title: null, stream_url: null, duration_s: 0, size_bytes: 0, image_url: null, desc_text: null, resolved_at: SEED_AT, feed_stamp: null, episode_date: TODAY, source: null, backup_url: null, backup_source: null, route: null, ...(over || {}) };
  db.resolutions.set(TODAY + "|" + slotId, row);
  return row;
}
function setSite634() {
  SITE_PAGES.clear();
  for (const date of [TODAY, TOMORROW]) {
    const dw = dowOf(date), base = U("site");
    SITE_PAGES.set(`${base}/?date=${date.replace(/-/g, "")}`, siteDayPage(date));
    SITE_PAGES.set(`${base}/ip-ord-w02-w04-${dw}-psalm024/?date=${date.replace(/-/g, "")}`, sitePostPage(null, true));
    SITE_PAGES.set(`${base}/ord-w34-${dw}-or/?date=${date.replace(/-/g, "")}`, sitePostPage(`divine-ord-w34-${dw}-or.mp3`));
    SITE_PAGES.set(`${base}/ord-w02-${dw}-mp/?date=${date.replace(/-/g, "")}`, sitePostPage(`divine-ord-w02-${dw}-mp.mp3`));
    SITE_PAGES.set(`${base}/ord-w02-${dw}-ep/?date=${date.replace(/-/g, "")}`, sitePostPage(`divine-ord-w02-${dw}-ep2.mp3`)); // REAL episode file — v634 L3
  }
}
const IP_POST_PAGE = readFileSync(path.join(HERE, "v633-fixtures/post-page-2026-11-23-invitatory.html"), "utf8");
function setSite633(ipBody) {
  SITE_PAGES.clear();
  for (const date of [TODAY, TOMORROW]) {
    const dw = dowOf(date), base = U("site");
    SITE_PAGES.set(`${base}/?date=${date.replace(/-/g, "")}`, siteDayPage(date));
    SITE_PAGES.set(`${base}/ip-ord-w02-w04-${dw}-psalm024/?date=${date.replace(/-/g, "")}`, ipBody);
    SITE_PAGES.set(`${base}/ord-w34-${dw}-or/?date=${date.replace(/-/g, "")}`, sitePostPage(`divine-ord-w34-${dw}-or.mp3`));
    SITE_PAGES.set(`${base}/ord-w02-${dw}-mp/?date=${date.replace(/-/g, "")}`, sitePostPage(`divine-ord-w02-${dw}-mp.mp3`));
    SITE_PAGES.set(`${base}/ord-w02-${dw}-ep/?date=${date.replace(/-/g, "")}`, sitePostPage(null, true)); // component only — must be refused for EP
  }
}
function siteDayPage(date) {
  const ymd = date.replace(/-/g, ""), dw = dowOf(date);
  const slugs = [`ord-w34-${dw}-or`, `ord-w02-${dw}-mp`, `ord-w02-${dw}-ep`, `ord-w02-${dw}-dp1-comp`, `ord-w02-${dw}-dp2-current`, `ord-w02-${dw}-dp3-comp`, `ord-${dw}-np-w2-w4`, `ip-ord-w02-w04-${dw}-psalm024`];
  return `<html><body>` + slugs.map((sl) => `<a href="https://divineoffice.org/${sl}/?date=${ymd}">post</a>`).join("") + `</body></html>`;
}
function sitePostPage(file, componentOnly) {
  if (componentOnly) return `<html><body><div class="powerpress_player"><audio><source src="https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/divine-ip-ord-w02-w04-mon.psalm024.mp3"></audio></div></body></html>`;
  return `<html><body><div class="powerpress_player"><audio><source src="https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/${file}"></audio></div></body></html>`;
}
function setSiteHealthy() {
  SITE_PAGES.clear();
  for (const date of [TODAY, TOMORROW]) {
    const dw = dowOf(date), base = U("site");
    SITE_PAGES.set(`${base}/?date=${date.replace(/-/g, "")}`, siteDayPage(date));
    SITE_PAGES.set(`${base}/ord-w34-${dw}-or/?date=${date.replace(/-/g, "")}`, sitePostPage(`divine-ord-w34-${dw}-or.mp3`));
    SITE_PAGES.set(`${base}/ord-w02-${dw}-mp/?date=${date.replace(/-/g, "")}`, sitePostPage(`divine-ord-w02-${dw}-mp.mp3`));
    SITE_PAGES.set(`${base}/ord-w02-${dw}-ep/?date=${date.replace(/-/g, "")}`, sitePostPage(null, true)); // component only — must be refused
  }
}
const CHALLENGE_HTML = `<!DOCTYPE html><html><head><title>One moment, please…</title></head><body><p>Checking your browser before accessing the site.</p></body></html>`;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  FETCH_COUNT.set(u, (FETCH_COUNT.get(u) || 0) + 1);
  if (u.startsWith(U("synth/"))) {
    const name = u.slice(U("synth/").length);
    const good = SYNTH_VERIFIED.has(name);
    if (opts && opts.method === "HEAD") {
      if (!good) return { ok: false, status: 404, headers: hdr({}), text: async () => "" };
      return { ok: false, status: 302, headers: hdr({ location: `https://cdn.fixture.local/${name}` }), text: async () => "" };
    }
    if (!good) return { ok: false, status: 404, headers: hdr({}), text: async () => "" };
    return { ok: true, status: 206, headers: hdr({ "content-type": "audio/mpeg" }), text: async () => "" };
  }
  if (u.startsWith(U("site/")) || u.startsWith(U("site") + "/")) {
    const page = SITE_PAGES.get(u);
    if (page === undefined) return { ok: false, status: 404, headers: hdr({}), text: async () => "no page fixture" };
    return { ok: true, status: 200, headers: hdr({ "content-type": "text/html" }), text: async () => page };
  }
  const f = FEEDS.get(u);
  if (!f) return { ok: false, status: 404, headers: hdr({}), text: async () => "no fixture" };
  const r = typeof f === "function" ? f() : f;
  return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: hdr({}), text: async () => r.body };
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
    EXT_SYNTH_BASE_URL: U("synth/"), EXT_DO_SITE_BASE_URL: U("site"),
    EXT_SAINT_FEED_URL: U("saint"), EXT_TVMASS_FEED_URL: U("tvmass"), EXT_STH_FEED_URL: U("sth"),
    OWN_FEED_URL: U("own"),
    EXT_EXORCIST_FEED_URL: U("exorcist"), EXT_COUNSEL_TRENT_FEED_URL: U("counsel"),
    EXT_FRMIKE_HOMILIES_FEED_URL: U("frmike"), EXT_BARRON_SERMONS_FEED_URL: U("barron"),
    EXT_DAILY_READINGS_FEED_URL: U("usccb-readings"), EXT_SUMMA_FEED_URL: U("course"),
    EXT_CIY_FEED_URL: U("course"), EXT_RIY_FEED_URL: U("course"),
  };
}
const count = (key) => FETCH_COUNT.get(U(key)) || 0;
const countPrefix = (p) => [...FETCH_COUNT.entries()].filter(([u]) => u.startsWith(U(p))).reduce((a, [, n]) => a + n, 0);
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

// ---------- L1 ◆: Morning StH-filled -> rung 2 synthesis displaces, StH pointer stands as backup; live payload carries both ----------
let entryL1 = null;
{
  setAllHealthy(); setFeed("do", DO_500, 500); // StH feed healthy (standing setAllHealthy)
  SITE_PAGES.clear(); SYNTH_VERIFIED.clear(); SYNTH_VERIFIED.add(synthMpPsalterName(TODAY));
  const db = new FakeDB(); const env = makeEnv(db);
  seedRow(db, "ext-morning-prayer", { title: "Morning Prayer - Sing the Hours", source: "Sing the Hours", stream_url: STH_LAUDS(TODAY), route: null, episode_date: TODAY });
  await agentResolve(env);
  const row = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("L1 ◆ Morning row: present · Divine Office · synthesis", !!row && row.state === "present" && row.source === "Divine Office" && row.route === "synthesis", row);
  check("L1 ◆ stream_url is the verified psalter-form synthesis URL", !!row && row.stream_url === U("synth/") + synthMpPsalterName(TODAY), row && row.stream_url);
  check("L1 ◆ backup is the displaced StH pointer", !!row && row.backup_url === STH_LAUDS(TODAY) && row.backup_source === "Sing the Hours", row && { backup_url: row.backup_url, backup_source: row.backup_source });
  check("L1 ◆ title + episode_date", !!row && row.title === "Morning Prayer - Divine Office" && row.episode_date === TODAY, row && { title: row.title, episode_date: row.episode_date });
  const payload = await live(env, TODAY);
  entryL1 = (payload.slots || []).find((e) => e.slotId === "ext-morning-prayer");
  check("L1 ◆ live payload entry: source Divine Office + backup {StH URL, Sing the Hours}", !!entryL1 && entryL1.source === "Divine Office" && !!entryL1.backup && entryL1.backup.streamUrl === STH_LAUDS(TODAY) && entryL1.backup.source === "Sing the Hours", entryL1);
}
// ---------- L2 ◆: preference seam on L1's payload entry (REAL client functions, harness-v631 grabClientFn pattern) ----------
function grabClientFn(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return "";
  let depth = 0, i = src.indexOf("{", at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (!depth) return src.slice(start, i + 1); } }
  return "";
}
{
  const clientSrc = readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
  const srcFns = grabClientFn(clientSrc, "opnSthPrimary628") + "\n" + grabClientFn(clientSrc, "opnExtChoice628");
  check("L2 client choice functions stand in client.ts", srcFns.includes("opnSthPrimary628") && srcFns.includes("opnExtChoice628"), srcFns.length);
  let pinRec = {};
  const api = new Function("opnPinLoad", srcFns + "\nreturn { pref: opnSthPrimary628, choice: opnExtChoice628 };")(() => pinRec);
  const slot = { slotId: "ext-morning-prayer", title: "Morning Prayer" };
  check("L2 ◆ L1 entry stands for the seam", !!entryL1 && !!entryL1.backup, entryL1);
  pinRec = {};
  const dflt = api.choice(slot, entryL1, "Divine Office");
  check("L2 ◆ no sthPrimary: choice settles on the Divine Office pointer, StH stands as its backup", !!entryL1 && dflt.streamUrl === entryL1.streamUrl && dflt.source === "Divine Office" && dflt.title === "Morning Prayer - Divine Office" && !!dflt.backup && dflt.backup.streamUrl === STH_LAUDS(TODAY) && dflt.backup.source === "Sing the Hours", dflt);
  pinRec = { sthPrimary: true };
  const tog = api.choice(slot, entryL1, "Divine Office");
  check("L2 ◆ sthPrimary:true: choice settles on the Sing the Hours pointer, Divine Office stands as its backup", !!entryL1 && tog.streamUrl === STH_LAUDS(TODAY) && tog.source === "Sing the Hours" && tog.title === "Morning Prayer - Sing the Hours" && !!tog.backup && tog.backup.streamUrl === entryL1.streamUrl && tog.backup.source === "Divine Office", tog);
}
// ---------- L3 ◆: Evening StH-filled, no synthesis candidate verifies -> rung 4 scrape displaces, StH pointer stands as backup ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500);
  setSite634(); SYNTH_VERIFIED.clear(); // empty — no ep (or any) candidate verifies
  const db = new FakeDB(); const env = makeEnv(db);
  seedRow(db, "ext-evening-prayer", { title: "Evening Prayer - Sing the Hours", source: "Sing the Hours", stream_url: STH_VESPERS(TODAY), route: null, episode_date: TODAY });
  await agentResolve(env);
  const row = db.resolutions.get(TODAY + "|ext-evening-prayer");
  check("L3 ◆ Evening row: Divine Office · scrape · ep2 file", !!row && row.source === "Divine Office" && row.route === "scrape" && (row.stream_url || "").endsWith(`divine-ord-w02-${dowOf(TODAY)}-ep2.mp3`), row);
  check("L3 ◆ backup is the displaced StH vespers pointer", !!row && row.backup_url === STH_VESPERS(TODAY) && row.backup_source === "Sing the Hours", row && { backup_url: row.backup_url, backup_source: row.backup_source });
  check("L3 ◆ title is 'Evening Prayer - Divine Office'", !!row && row.title === "Evening Prayer - Divine Office", row && { title: row.title });
}
// ---------- L4: Divine Office-standing Morning is never displaced ----------
{
  // sub-case 1: backup already stands -> byte-identical
  setAllHealthy(); setFeed("do", DO_500, 500); SITE_PAGES.clear(); SYNTH_VERIFIED.clear(); SYNTH_VERIFIED.add(synthMpPsalterName(TODAY));
  const db = new FakeDB(); const env = makeEnv(db);
  const doUrl = `https://divineoffice.org/audio/${TODAY}-morning-prayer.mp3`;
  seedRow(db, "ext-morning-prayer", { title: "Morning Prayer - Divine Office", source: "Divine Office", stream_url: doUrl, route: "feed", backup_url: STH_LAUDS(TODAY), backup_source: "Sing the Hours", episode_date: TODAY });
  const before = JSON.stringify(db.resolutions.get(TODAY + "|ext-morning-prayer"));
  await agentResolve(env);
  const after = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("L4 DO-standing row with backup is byte-identical after the pass", JSON.stringify(after) === before, after);
}
{
  // sub-case 2: no backup -> primary fields unchanged; backup gains the StH pointer via standing backupNeeds
  setAllHealthy(); setFeed("do", DO_500, 500); SITE_PAGES.clear(); SYNTH_VERIFIED.clear(); SYNTH_VERIFIED.add(synthMpPsalterName(TODAY));
  const db = new FakeDB(); const env = makeEnv(db);
  const doUrl = `https://divineoffice.org/audio/${TODAY}-morning-prayer.mp3`;
  seedRow(db, "ext-morning-prayer", { title: "Morning Prayer - Divine Office", source: "Divine Office", stream_url: doUrl, route: "feed", backup_url: null, backup_source: null, episode_date: TODAY });
  const before = { ...(db.resolutions.get(TODAY + "|ext-morning-prayer")) };
  await agentResolve(env);
  const after = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("L4 DO-standing row without backup: primary fields unchanged", !!after && after.stream_url === before.stream_url && after.title === before.title && after.source === before.source && after.route === before.route && after.episode_date === before.episode_date, after);
  check("L4 DO-standing row without backup: backup becomes the StH pointer (standing backupNeeds only)", !!after && after.backup_url === STH_LAUDS(TODAY) && after.backup_source === "Sing the Hours", after && { backup_url: after.backup_url, backup_source: after.backup_source });
}
// ---------- L5: non-labeled present row (Office of Readings via synthesis) — rung 2 must not rewrite it ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500); SITE_PAGES.clear();
  SYNTH_VERIFIED.clear(); SYNTH_VERIFIED.add(synthOrName(TODAY));
  const db = new FakeDB(); const env = makeEnv(db);
  seedRow(db, "ext-office-of-readings", { title: "Office of Readings", source: null, stream_url: U("synth/") + synthOrName(TODAY), route: "synthesis", episode_date: TODAY });
  const before = JSON.stringify(db.resolutions.get(TODAY + "|ext-office-of-readings"));
  await agentResolve(env);
  const after = db.resolutions.get(TODAY + "|ext-office-of-readings");
  check("L5 non-labeled present OR row is byte-identical after the pass", JSON.stringify(after) === before, after);
}

console.log(`\nharness-v634: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
