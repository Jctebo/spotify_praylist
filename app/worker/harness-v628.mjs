// harness-v628.mjs — v628: the Divine Office sourcing ladder
// (1) RSS feed · (2) filename synthesis (verified only) ·
// (3) Sing the Hours fallback under the user preference — the
// watcher stands BOTH pointers for Morning/Evening · (4) site
// scrape, last net — plus the client preference legs.
//
// The REAL Worker (esbuild bundle of worker/src/index.ts) is
// driven through its real routes over a fake D1 carrying the
// v628 columns (migration 0050: backup_url, backup_source,
// route — INSERT args 14-16), with global fetch stubbed to
// fixture feeds/pages. Machinery copied from harness-v626.mjs.
//
// Fixtures (Improvement D — provenance): feed fixtures are
// v624/v626's production-shaped fixtures, reused as-is. The
// synthesis fixture stands on the REAL production-verified
// name for 2026-11-23, divine-ord-w34-mon-or.mp3 (plan §3:
// HEAD 302 -> followed GET 206 audio/mpeg; captured in
// v628-fixtures/): the stub verifies ONLY the cycle-form
// Office-of-Readings name for the run day (the form of that
// real name, derived from the run day's weekday), and no
// other candidate. The scrape fixtures are built from the
// LIVE pages captured at Implement (v628-fixtures/
// post-page-2026-11-23-office-of-readings.html — its episode
// player carries divine-ord-w34-mon-or.mp3; the Morning post
// page carries divine-ord-w02-mon-mp.mp3): the day page
// carries per-hour post links in the live slugs' shape, the
// OR + MP post pages carry episode players, and the EP post
// page carries ONLY a component player (divine-ip- psalm),
// which the rung must refuse. ◆ legs fail against v627 code.
//
// Run: node app/worker/harness-v628.mjs
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
const TMP = mkdtempSync(tmpdir() + "/v628-");
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

// ---------- S1 ◆: feed healthy -> synthesis + scrape never fetch ----------
{
  setAllHealthy(); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB(); const env = makeEnv(db);
  const synthBefore = countPrefix("synth/"), siteBefore = countPrefix("site");
  const r = await agentResolve(env);
  check("S1 ◆ healthy feed: synthesis rung never fetches", countPrefix("synth/") === synthBefore, { before: synthBefore, after: countPrefix("synth/") });
  check("S1 ◆ healthy feed: scrape rung never fetches", countPrefix("site") === siteBefore, { before: siteBefore, after: countPrefix("site") });
  const sum = summaryOf(r, "divine-office-synthesis");
  check("S1 synthesis summary stands skipped (no-unresolved-slots)", !!sum && sum.skipped === "no-unresolved-slots", sum);
  const or = db.resolutions.get(TODAY + "|ext-office-of-readings");
  check("S1 OR row carries route 'feed'", !!or && or.route === "feed" && or.source === null, or && { route: or.route });
}
// ---------- S2 ◆: DO feed fails -> synthesis stands today's verified OR name ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500); setSiteHealthy();
  SYNTH_VERIFIED.clear(); SYNTH_VERIFIED.add(synthOrName(TODAY)); SYNTH_VERIFIED.add(synthOrName(TOMORROW));
  const db = new FakeDB(); const env = makeEnv(db);
  await agentResolve(env);
  const row = db.resolutions.get(TODAY + "|ext-office-of-readings");
  check("S2 ◆ synthesis stands the OR slot present on a failed feed", !!row && row.state === "present", row);
  check("S2 ◆ the stood pointer is the verified cycle name (the real divine-ord-w34-mon-or.mp3 form)", !!row && row.stream_url === U("synth/") + synthOrName(TODAY), row && row.stream_url);
  check("S2 ◆ synthesis row is a Divine Office row: route 'synthesis', bare hour title (unlabeled slot)", !!row && row.route === "synthesis" && row.title === "Office of Readings", row && { route: row.route, title: row.title });
  check("S2 ◆ synthesis attempt recorded in feed state (never silent)", !!db.feedState.get("divine-office-synthesis") && db.feedState.get("divine-office-synthesis").last_attempt_at !== null, db.feedState.get("divine-office-synthesis"));
  const payload = await live(env, TODAY);
  const entry = (payload.slots || []).find((e) => e.slotId === "ext-office-of-readings");
  check("S2 ◆ live payload serves the synthesis pointer with its route flag", !!entry && entry.state === "present" && entry.streamUrl === row.stream_url && entry.route === "synthesis", entry);
}
// ---------- S3 ◆: an unverified candidate never stands ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB(); const env = makeEnv(db);
  await agentResolve(env);
  check("S3 ◆ Night Prayer: no verified candidate + no scrape yield -> NO row stands", !db.resolutions.has(TODAY + "|ext-night-prayer"));
  const synthRows = [...db.resolutions.values()].filter((r) => r.route === "synthesis");
  check("S3 ◆ zero synthesis rows stand when nothing verifies", synthRows.length === 0, synthRows.map((r) => r.slot_id));
}
// ---------- S4 ◆: a synthesis fill does not stand the feed down; a later feed success overwrites it ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500); setSiteHealthy();
  SYNTH_VERIFIED.clear(); SYNTH_VERIFIED.add(synthOrName(TODAY)); SYNTH_VERIFIED.add(synthOrName(TOMORROW));
  const db = new FakeDB(); const env = makeEnv(db);
  await agentResolve(env);
  const fill = db.resolutions.get(TODAY + "|ext-office-of-readings");
  check("S4 synthesis fill stands after pass 1", !!fill && fill.route === "synthesis", fill && fill.route);
  const doAfter1 = count("do");
  setFeed("do", DO_HEALTHY);
  await agentResolve(env);
  check("S4 ◆ the DO feed is re-fetched after a synthesis fill (no stand-down)", count("do") === doAfter1 + 1, { before: doAfter1, after: count("do") });
  const row = db.resolutions.get(TODAY + "|ext-office-of-readings");
  check("S4 ◆ the feed success overwrites the fill wholesale (feed pointer + route 'feed')", !!row && row.stream_url === `https://divineoffice.org/audio/${TODAY}-office-of-readings.mp3` && row.route === "feed", row && { url: row.stream_url, route: row.route });
}
// ---------- P1 ◆ (server): both pointers stand for Morning/Evening; no other hour gains one ----------
{
  setAllHealthy(); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB(); const env = makeEnv(db);
  await agentResolve(env);
  const mp = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("P1 ◆ Morning stands on Divine Office WITH the Sing the Hours backup pointer alongside", !!mp && mp.source === "Divine Office" && mp.backup_url === `https://episodes.castos.com/sth/${TODAY}-lauds.mp3` && mp.backup_source === "Sing the Hours", mp && { source: mp.source, backup: mp.backup_url });
  const ev = db.resolutions.get(TODAY + "|ext-evening-prayer");
  check("P1 ◆ Evening stands the same pair (Vespers backup)", !!ev && ev.source === "Divine Office" && ev.backup_url === `https://episodes.castos.com/sth/${TODAY}-vespers.mp3`, ev && ev.backup_url);
  const np = db.resolutions.get(TODAY + "|ext-night-prayer");
  check("P1 ◆ Night Prayer gains NO second pointer", !!np && !np.backup_url, np && np.backup_url);
  const payload = await live(env, TODAY);
  const entry = (payload.slots || []).find((e) => e.slotId === "ext-morning-prayer");
  check("P1 ◆ live payload carries backup {streamUrl, source} for Morning", !!entry && entry.backup && entry.backup.streamUrl === mp.backup_url && entry.backup.source === "Sing the Hours", entry && entry.backup);
  const entryNp = (payload.slots || []).find((e) => e.slotId === "ext-night-prayer");
  check("P1 ◆ live payload carries NO backup for Night Prayer", !!entryNp && !entryNp.backup, entryNp);
}
// ---------- P2 ◆ (server): an StH-standing slot is flipped by a later DO success, and the backup then stands ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB(); const env = makeEnv(db);
  await agentResolve(env);
  const fill = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("P2 [v634: reversed by name] the same pass's scrape rung resolves past the fill — Morning stands on Divine Office (route scrape) with the StH backup alongside while the feed is down", !!fill && fill.source === "Divine Office" && fill.route === "scrape" && fill.backup_url === `https://episodes.castos.com/sth/${TODAY}-lauds.mp3` && fill.backup_source === "Sing the Hours", fill && { source: fill.source, route: fill.route, backup: fill.backup_url });
  setFeed("do", DO_HEALTHY);
  await agentResolve(env);
  const row = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("P2 ◆ late DO success flips the slot to Divine Office AND the StH backup stands alongside", !!row && row.source === "Divine Office" && row.title === "Morning Prayer - Divine Office" && row.backup_url === `https://episodes.castos.com/sth/${TODAY}-lauds.mp3`, row && { source: row.source, backup: row.backup_url });
}
// ---------- S5 ◆: scrape fills from the per-hour post page; a component player is refused; synthesis outranks scrape ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500); setFeed("sth", EMPTY_FEED, 200); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB(); const env = makeEnv(db);
  await agentResolve(env);
  const or = db.resolutions.get(TODAY + "|ext-office-of-readings");
  check("S5 ◆ scrape stands OR from its OWN post page (episode pointer, route 'scrape')", !!or && or.state === "present" && /divine-ord-w34-.*-or\.mp3$/.test(or.stream_url || "") && or.route === "scrape", or && { url: or.stream_url, route: or.route });
  const ev = db.resolutions.get(TODAY + "|ext-evening-prayer");
  check("S5 ◆ Evening's post page carries ONLY a component player -> refused, NO row stands", !ev, ev);
  const mp = db.resolutions.get(TODAY + "|ext-morning-prayer");
  check("S5 ◆ Morning stands by scrape with the Divine Office label", !!mp && mp.title === "Morning Prayer - Divine Office" && mp.source === "Divine Office" && mp.route === "scrape", mp && { title: mp.title, route: mp.route });
}
// ---------- S6 ◆: a Cloudflare challenge day page writes nothing ----------
{
  setAllHealthy(); setFeed("do", DO_500, 500); setFeed("sth", EMPTY_FEED, 200); SYNTH_VERIFIED.clear();
  SITE_PAGES.clear();
  for (const date of [TODAY, TOMORROW]) SITE_PAGES.set(`${U("site")}/?date=${date.replace(/-/g, "")}`, CHALLENGE_HTML);
  const db = new FakeDB(); const env = makeEnv(db);
  await agentResolve(env);
  const scrapeRows = [...db.resolutions.values()].filter((r) => r.route === "scrape");
  check("S6 ◆ challenge page = failed read: zero scrape rows written", scrapeRows.length === 0, scrapeRows.length);
  check("S6 ◆ OR stands no row at all under feed failure + challenge", !db.resolutions.has(TODAY + "|ext-office-of-readings"));
}
// ---------- P3 ◆ (client): the preference choice, from the REAL client functions ----------
{
  const { readFileSync } = await import("node:fs");
  const clientSrc = readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
  const grab = (name) => {
    const at = clientSrc.indexOf(`function ${name}(`);
    if (at < 0) return "";
    let depth = 0, i = clientSrc.indexOf("{", at);
    const start = at;
    for (; i < clientSrc.length; i++) { if (clientSrc[i] === "{") depth++; else if (clientSrc[i] === "}") { depth--; if (!depth) return clientSrc.slice(start, i + 1); } }
    return "";
  };
  const srcFns = grab("opnSthPrimary628") + "\n" + grab("opnExtChoice628");
  check("P3 client preference functions stand in client.ts", srcFns.includes("opnSthPrimary628") && srcFns.includes("opnExtChoice628"), srcFns.length);
  let pinRec = {};
  const factory = new Function("opnPinLoad", srcFns + "\nreturn { pref: opnSthPrimary628, choice: opnExtChoice628 };");
  const api628 = factory(() => pinRec);
  const slot = { slotId: "ext-morning-prayer", title: "Morning Prayer" };
  const entry = { title: "Morning Prayer - Divine Office", streamUrl: "https://do.example/mp.mp3", backup: { streamUrl: "https://sth.example/lauds.mp3", source: "Sing the Hours" } };
  pinRec = {};
  const dflt = api628.choice(slot, entry, "Divine Office");
  check("P3 ◆ default: Divine Office stands first, Sing the Hours is the backup, label follows", dflt.streamUrl === "https://do.example/mp.mp3" && dflt.title === "Morning Prayer - Divine Office" && dflt.backup && dflt.backup.streamUrl === "https://sth.example/lauds.mp3" && dflt.backup.title === "Morning Prayer - Sing the Hours", dflt);
  pinRec = { sthPrimary: true };
  const tog = api628.choice(slot, entry, "Divine Office");
  check("P3 ◆ toggled: Sing the Hours stands first, its label leads, Divine Office is the backup", tog.streamUrl === "https://sth.example/lauds.mp3" && tog.title === "Morning Prayer - Sing the Hours" && tog.source === "Sing the Hours" && tog.backup && tog.backup.streamUrl === "https://do.example/mp.mp3", tog);
  const npSlot = { slotId: "ext-night-prayer", title: "Night Prayer" };
  const npChoice = api628.choice(npSlot, { title: "Night Prayer", streamUrl: "https://do.example/np.mp3", backup: { streamUrl: "https://sth.example/x.mp3", source: "Sing the Hours" } }, "Divine Office");
  check("P3 ◆ the toggle touches Morning/Evening ONLY: Night Prayer never re-orders", npChoice.streamUrl === "https://do.example/np.mp3" && npChoice.backup === null, npChoice);
  const clientFull = clientSrc;
  check("P3 [v632: reversed by name] the Settings toggle RETIRES from the PIN section — the choice stands in its own MORNING & EVENING PRAYER section, written to the new store (opn-sth-first-v632 via opnSthFirstSet632); the flip substance is re-proven in harness-v632 legs 1-2", !clientFull.includes('id="pin-sth-pref"') && clientFull.includes("opn-sth-first-v632") && clientFull.includes("function opnSthFirstSet632("));
  check("P3 ◆ download failure flips to the backup (extDownload retries meta.backup once)", clientFull.includes("if (meta.backup && meta.backup.streamUrl)"));
}

console.log(`\nharness-v628: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);

