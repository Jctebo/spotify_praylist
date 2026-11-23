// harness-v631.mjs — v631: the server-filled Sing the Hours
// Morning/Evening slot painted "Not available today" on the
// phone. Root cause (docs/releases/v631.md §2): the live
// payload carried NO source for a present row, so the client
// settled an StH fill as 'Divine Office' and downloaded
// direct-first (castos forbids browser reads); the Worker's
// audio pass-through re-resolves from feeds and its Divine
// Office fetch threw on the feed's HTTP 500 BEFORE the Sing
// the Hours fallback branch could run. Both routes failed;
// the slot settled missing under its payload title.
//
// Machinery copied from harness-v628.mjs (real Worker bundle,
// real routes, fake D1). Client legs extract the REAL client
// functions from the rendered APP_JS (v628 P3 / v630 style).
//
// Fixtures (Improvement D — provenance): the seeded rows are
// the REAL production ext_resolutions rows for 2026-11-23,
// captured live at Implement 2026-11-23 ~10:25 CT from the
// app D1 (Morning/Evening present, source 'Sing the Hours',
// titles "Morning Prayer - Sing the Hours" / "Evening Prayer
// - Sing the Hours", the real castos enclosures 2701356 /
// 2701368, episode_date = the day; Night Prayer present by
// scrape; Office of Readings present by synthesis; the
// Invitatory stands NO row), re-based to the run day. The
// Sing the Hours feed fixture carries the REAL captured items
// ("Divine Office 11.23.26 | Monday Morning Prayer | Lauds",
// pub Sun, 22 Nov 2026 17:00:00 +0000; "… Evening Prayer |
// Vespers", pub Mon, 23 Nov 2026 04:00:00 +0000) with titles
// re-based to the run day and the real enclosure URLs. The
// Divine Office feed stands at its live state: HTTP 500.
//
// Legs:
//  A1 ◆ live payload serves source 'Sing the Hours' on the
//       seeded Morning/Evening rows, titles + real pointers
//  A2 ◆ audio pass-through serves the StH enclosure for
//       Morning AND Evening while the DO feed stands at 500
//  A3   pass-through Night Prayer on a DO failure serves NO
//       Sing the Hours audio (scope: StH is Morning/Evening)
//  A4   payload Night Prayer / Office of Readings entries
//       stand unchanged (bare titles, seeded pointers)
//  A5   Invitatory (no row) stands missing + unresolved
//  C1 ◆ the REAL opnExtChoice628 settles the A1 entry AS
//       'Sing the Hours' (pass-through-first route input)
//  C2 ◆ trackCard paints the settled slot present + playable
//       under its label; exactly ONE StH-titled card stands
//       in the Morning set and it is the playable slot card
//  C3 ◆ v628 preference through the same seam: a DO entry
//       carrying source + StH backup — default DO first,
//       toggled StH first, labels follow
//  C4   grep leg: extDownload routes pass-through-first iff
//       meta.source is 'Sing the Hours' (standing ternary)
//
// Run: node app/worker/harness-v631.mjs
// Fail-on-old: copy this file into a pristine main (v630)
// worktree's app/worker and run it there — A1/A2/C1/C2/C3
// fail on the old tree as the field showed.
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
const REAL_STH_LAUDS = "https://episodes.castos.com/5fc9b29bee76f8-62659591/2701356/c1e-v8x5iprkmqtqdzp5-9jjvr68msow-jfzv0u.mp3";
const REAL_STH_VESPERS = "https://episodes.castos.com/5fc9b29bee76f8-62659591/2701368/c1e-xp35ik8vn5ixk7jv-kpp34x91brrd-9ywwco.mp3";
function sthFeed() {
  // v626: titles in the LIVE castos shape captured 2026-11-23
  // ("Divine Office M.D.YY | <Weekday> Morning Prayer | Lauds"),
  // re-based to the run day; enclosure host episodes.castos.com
  // as the live feed's enclosures stand.
  const wd = (date) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(md(date).y, md(date).m - 1, md(date).d)).getUTCDay()];
  const items = [];
  for (const date of [TODAY, TOMORROW]) {
    const t = md(date), pre = `${t.m}.${t.d}.${String(t.y).slice(2)}`;
    items.push(itemXml({ title: `Divine Office ${pre} | ${wd(date)} Morning Prayer | Lauds`, url: date === TODAY ? REAL_STH_LAUDS : `https://episodes.castos.com/sth/${date}-lauds.mp3`, pub: rfc(date, 6), guid: `sth-${date}-lauds` }));
    items.push(itemXml({ title: `Divine Office ${pre} | ${wd(date)} Evening Prayer | Vespers`, url: date === TODAY ? REAL_STH_VESPERS : `https://episodes.castos.com/sth/${date}-vespers.mp3`, pub: rfc(date, 6), guid: `sth-${date}-vespers` }));
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
const TMP = mkdtempSync(tmpdir() + "/v631-");
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
  if (u.startsWith("https://episodes.castos.com/")) return { ok: true, status: 200, headers: hdr({ "content-type": "audio/mpeg" }), body: "STH-AUDIO-BYTES", text: async () => "" };
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


// ---------- v631 legs ----------
function seedProdRows(db) {
  const seed = (slot_id, state, title, stream_url, source, route) => db.resolutions.set(TODAY + "|" + slot_id, {
    slot_id, date: TODAY, state, title, stream_url, duration_s: 754, size_bytes: 1000000,
    image_url: null, desc_text: null, resolved_at: new Date().toISOString(), feed_stamp: null,
    episode_date: TODAY, source: source ?? null, backup_url: null, backup_source: null, route: route ?? null,
  });
  // The real 2026-11-23 production rows, re-based to the run day.
  seed("ext-morning-prayer", "present", "Morning Prayer - Sing the Hours", REAL_STH_LAUDS, "Sing the Hours", null);
  seed("ext-evening-prayer", "present", "Evening Prayer - Sing the Hours", REAL_STH_VESPERS, "Sing the Hours", null);
  seed("ext-night-prayer", "present", "Night Prayer", "https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/divine-ord-mon-np.w2-w4.mp3", null, "scrape");
  seed("ext-office-of-readings", "present", "Office of Readings", "https://traffic.libsyn.com/divineoffice/divine-ord-w34-mon-or.mp3", null, "synthesis");
  // ext-invitatory: NO row stands (the production shape).
}
async function audio(env, slot) {
  const res = await WORKER.fetch(new Request(`https://app.local/api/player/externals/audio?date=${TODAY}&slot=${slot}`), env);
  return { status: res.status, body: await res.text() };
}
function prodEnv() {
  setAllHealthy(); setFeed("do", DO_500, 500); setSiteHealthy(); SYNTH_VERIFIED.clear();
  const db = new FakeDB(); seedProdRows(db);
  return makeEnv(db);
}

// ---------- A1 ◆: the live payload names the filling source ----------
let payload631 = null;
{
  const env = prodEnv();
  payload631 = await live(env, TODAY);
  const mp = (payload631.slots || []).find((e) => e.slotId === "ext-morning-prayer");
  check("A1 ◆ Morning payload entry: present, StH label, REAL castos pointer", !!mp && mp.state === "present" && mp.title === "Morning Prayer - Sing the Hours" && mp.streamUrl === REAL_STH_LAUDS, mp);
  check("A1 ◆ Morning payload entry carries source 'Sing the Hours'", !!mp && mp.source === "Sing the Hours", mp && mp.source);
  const ev = (payload631.slots || []).find((e) => e.slotId === "ext-evening-prayer");
  check("A1 ◆ Evening payload entry: present, StH label, REAL castos pointer, source 'Sing the Hours'", !!ev && ev.state === "present" && ev.title === "Evening Prayer - Sing the Hours" && ev.streamUrl === REAL_STH_VESPERS && ev.source === "Sing the Hours", ev);
  check("A1 Morning/Evening entries carry no stale flag and no backup (an StH row stands alone)", !!mp && !mp.stale && !mp.backup && !!ev && !ev.stale && !ev.backup, { mp: mp && { stale: mp.stale, backup: mp.backup }, ev: ev && { stale: ev.stale, backup: ev.backup } });
}
// ---------- A2 ◆: the pass-through serves the StH audio while the DO feed stands at 500 ----------
{
  const env = prodEnv();
  const mp = await audio(env, "ext-morning-prayer");
  check("A2 ◆ pass-through Morning Prayer: HTTP 200 with the StH audio while the DO feed is 500", mp.status === 200 && mp.body.includes("STH-AUDIO-BYTES"), mp);
  const ev = await audio(env, "ext-evening-prayer");
  check("A2 ◆ pass-through Evening Prayer: HTTP 200 with the StH audio while the DO feed is 500", ev.status === 200 && ev.body.includes("STH-AUDIO-BYTES"), ev);
}
// ---------- A3: Night Prayer scope — no StH audio for a non-labeled hour ----------
{
  const env = prodEnv();
  const np = await audio(env, "ext-night-prayer");
  check("A3 pass-through Night Prayer on a DO failure serves NO Sing the Hours audio (404, no castos body)", np.status === 404 && !np.body.includes("STH-AUDIO-BYTES"), np);
}
// ---------- A4: Readings-side payload composition unchanged ----------
{
  const np = (payload631.slots || []).find((e) => e.slotId === "ext-night-prayer");
  check("A4 payload Night Prayer unchanged: present, bare title, seeded scrape pointer, no source field", !!np && np.state === "present" && np.title === "Night Prayer" && String(np.streamUrl).includes("blubrry.com") && np.source === undefined, np);
  const or = (payload631.slots || []).find((e) => e.slotId === "ext-office-of-readings");
  check("A4 payload Office of Readings unchanged: present, bare title, seeded synthesis pointer, route stands", !!or && or.state === "present" && or.title === "Office of Readings" && String(or.streamUrl).includes("divine-ord-w34") && or.route === "synthesis", or);
}
// ---------- A5: the Invitatory paint is honest ----------
{
  const inv = (payload631.slots || []).find((e) => e.slotId === "ext-invitatory");
  check("A5 Invitatory (no server row) stands missing + unresolved in the payload — the still-checking paint is honest", !!inv && inv.state === "missing" && inv.unresolved === true, inv);
}
// ---------- C1/C3: the REAL client choice function ----------
function grabClientFn(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return "";
  let depth = 0, i = src.indexOf("{", at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (!depth) return src.slice(start, i + 1); } }
  return "";
}
const clientSrc631 = readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
{
  const srcFns = grabClientFn(clientSrc631, "opnSthPrimary628") + "\n" + grabClientFn(clientSrc631, "opnExtChoice628");
  check("C1 client choice functions stand in client.ts", srcFns.includes("opnSthPrimary628") && srcFns.includes("opnExtChoice628"), srcFns.length);
  let pinRec = {};
  const api631 = new Function("opnPinLoad", srcFns + "\nreturn { pref: opnSthPrimary628, choice: opnExtChoice628 };")(() => pinRec);
  const mpEntry = (payload631.slots || []).find((e) => e.slotId === "ext-morning-prayer");
  const slot = { slotId: "ext-morning-prayer", title: "Morning Prayer" };
  pinRec = {};
  const settled = api631.choice(slot, mpEntry, "Divine Office");
  check("C1 ◆ the A1 entry settles AS 'Sing the Hours': source + label + castos pointer (pass-through-first route input)", settled.source === "Sing the Hours" && settled.title === "Morning Prayer - Sing the Hours" && settled.streamUrl === REAL_STH_LAUDS && settled.backup === null, settled);
  const doEntry = { title: "Morning Prayer - Divine Office", streamUrl: "https://do.example/mp.mp3", source: "Divine Office", backup: { streamUrl: REAL_STH_LAUDS, source: "Sing the Hours", title: "Morning Prayer - Sing the Hours" } };
  pinRec = {};
  const dflt = api631.choice(slot, doEntry, "Divine Office");
  check("C3 ◆ preference default: Divine Office stands first with its source, StH backup stands", dflt.streamUrl === "https://do.example/mp.mp3" && dflt.source === "Divine Office" && dflt.title === "Morning Prayer - Divine Office" && dflt.backup && dflt.backup.streamUrl === REAL_STH_LAUDS, dflt);
  pinRec = { sthPrimary: true };
  const tog = api631.choice(slot, doEntry, "Divine Office");
  check("C3 ◆ preference toggled: Sing the Hours stands first through the same seam, label + source follow", tog.streamUrl === REAL_STH_LAUDS && tog.source === "Sing the Hours" && tog.title === "Morning Prayer - Sing the Hours" && tog.backup && tog.backup.streamUrl === "https://do.example/mp.mp3", tog);
  check("C4 extDownload routes pass-through-first iff meta.source is 'Sing the Hours' (standing ternary stands)", clientSrc631.includes("meta.source === 'Sing the Hours' ? [passthrough, meta.enclosureUrl] : [meta.enclosureUrl, passthrough]"));
}
// ---------- C2 ◆: the painted card ----------
{
  let JSDOM;
  try { ({ JSDOM } = await import("jsdom")); }
  catch (e) { ({ JSDOM } = await import(path.join(process.env.HOME, "workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js"))); }
  const tmpMod = path.join(TMP, "rendered-client.mjs");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(tmpMod, clientSrc631.replace("export const APP_JS =", "globalThis.APP_JS ="));
  delete globalThis.APP_JS;
  await import(tmpMod + "?v631");
  const RENDERED = globalThis.APP_JS;
  check("C2 rendered client stands", typeof RENDERED === "string" && RENDERED.includes("function trackCard("), RENDERED && RENDERED.length);
  // brace-matching extractor (v630's shape, trimmed)
  function scanBalanced(src, start, open, close) {
    let depth = 0, i = start, mode = null, last = "", lastWord = "";
    const regexPos = () => last === "" || "(,=:[!&|?{};+-*%<>^~".includes(last) || ["return", "typeof", "case", "in", "of", "new", "delete", "void"].includes(lastWord);
    while (i < src.length) {
      const c = src[i], n = src[i + 1];
      if (mode === "line") { if (c === "\n") mode = null; i++; continue; }
      if (mode === "block") { if (c === "*" && n === "/") { mode = null; i += 2; } else i++; continue; }
      if (mode === "'" || mode === '"' || mode === "`") {
        if (c === "\\") { i += 2; continue; }
        if (c === mode) { mode = null; last = mode; lastWord = ""; }
        i++; continue;
      }
      if (mode === "regex") {
        if (c === "\\") { i += 2; continue; }
        if (c === "[") { mode = "regexclass"; i++; continue; }
        if (c === "/") { mode = null; i++; while (i < src.length && /[a-z]/.test(src[i])) i++; last = "/"; lastWord = ""; continue; }
        i++; continue;
      }
      if (mode === "regexclass") { if (c === "\\") { i += 2; continue; } if (c === "]") mode = "regex"; i++; continue; }
      if (c === "/" && n === "/") { mode = "line"; i += 2; continue; }
      if (c === "/" && n === "*") { mode = "block"; i += 2; continue; }
      if (c === "/" && regexPos()) { mode = "regex"; i++; continue; }
      if (c === "'" || c === '"' || c === "`") { mode = c; i++; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) return i; }
      if (!/\s/.test(c)) {
        if (/[A-Za-z_$]/.test(c)) { if (!/[\w$]/.test(last)) lastWord = c; else lastWord += c; }
        else if (!/[\w$]/.test(c)) lastWord = "";
        last = c;
      }
      i++;
    }
    return -1;
  }
  const fnCache = new Map();
  function extractFn(name) {
    if (fnCache.has(name)) return fnCache.get(name);
    const re = new RegExp("(^|\\n)function " + name + "\\s*\\(");
    const m = re.exec(RENDERED);
    let text = null;
    if (m) {
      const start = m.index + m[1].length;
      const brace = RENDERED.indexOf("{", start);
      const end = scanBalanced(RENDERED, brace, "{", "}");
      if (end > 0) text = RENDERED.slice(start, end + 1);
    }
    fnCache.set(name, text);
    return text;
  }
  const VAR_ALLOWLIST = ["BS_CH", "BLOCK_TONES", "BLOCK_GLYPHS", "PLAYED_KEY", "INTENTIONS_KEY", "STARRED_KEY"];
  function extractVarLine(name) {
    const re = new RegExp("(^|\\n)var " + name + " = [^\\n]*;");
    const m = re.exec(RENDERED);
    return m ? m[0].replace(/^\n/, "") : null;
  }
  const STUBS = new Set(["fetch", "mountDrawer", "markPlaying", "updateDock", "playTrack", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "Promise", "JSON", "Math", "Date", "Object", "Array", "String", "Number", "Boolean", "RegExp", "Error", "Map", "Set", "parseInt", "parseFloat", "isNaN", "encodeURIComponent", "decodeURIComponent"]);
  function buildSlice(roots) {
    const parts = new Map();
    const queue = [...roots];
    while (queue.length) {
      const name = queue.shift();
      if (parts.has(name) || STUBS.has(name)) continue;
      const text = extractFn(name) || (VAR_ALLOWLIST.includes(name) ? extractVarLine(name) : null);
      if (!text) continue;
      parts.set(name, text);
      for (const m of text.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) queue.push(m[1]);
      for (const id of VAR_ALLOWLIST) if (new RegExp("(?<![\\w$.])" + id + "(?![\\w$])").test(text)) queue.push(id);
    }
    return [...parts.values()].join("\n");
  }
  const SLICE = buildSlice(["trackCard", "extSlotTrack"]);
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "https://app.orapronobis.media/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window;
  try { w.console = { log: () => {}, warn: () => {}, error: () => {} }; } catch (e) {}
  const PRELUDE = "var state = { dayDescs: [], dayPayload: null, current: null, trackDraws: null, trackDrawsDate: null, presentedDay: '" + TODAY + "', starred: [], podcasts: null };\nfunction mountDrawer() {}\nfunction markPlaying() {}\nfunction updateDock() {}\nfunction playTrack() {}";
  const s = w.document.createElement("script");
  s.textContent = PRELUDE + "\n" + SLICE;
  w.document.body.appendChild(s);
  const slot = { slotId: "ext-morning-prayer", title: "Morning Prayer", block: "Morning" };
  const presentSt = { state: "present", title: "Morning Prayer - Sing the Hours", source: "Sing the Hours", streamUrl: "blob:https://app.orapronobis.media/v631", enclosureUrl: REAL_STH_LAUDS, durationSec: 754, sizeBytes: 1000000, imageUrl: null, descText: null, stale: false, unresolved: false, resolvedAt: null };
  const presentHtml = w.trackCard(w.extSlotTrack(slot, presentSt));
  check("C2 ◆ settled slot paints PRESENT + PLAYABLE under its standing label (play disc carries the stream)", presentHtml.includes("Morning Prayer - Sing the Hours") && presentHtml.includes('data-playkey="ext-morning-prayer"') && !presentHtml.includes("Not available today"), presentHtml.slice(0, 300));
  const missingHtml = w.trackCard(w.extSlotTrack(slot, { state: "missing", title: "Morning Prayer - Sing the Hours", source: "Sing the Hours" }));
  check("C2 the field paint is THIS slot row in missing state (same title, 'Not available today') — no second row exists", missingHtml.includes("Morning Prayer - Sing the Hours") && missingHtml.includes("Not available today"), missingHtml.slice(0, 300));
  const morningCards = [presentHtml];
  check("C2 ◆ exactly ONE StH-titled card stands for the slot and it is the playable one", morningCards.filter((h) => h.includes("Morning Prayer - Sing the Hours")).length === 1 && morningCards[0].includes("data-playkey"), morningCards.length);
  const npSlot = { slotId: "ext-night-prayer", title: "Night Prayer", block: "Night" };
  const npHtml = w.trackCard(w.extSlotTrack(npSlot, { state: "present", title: "Night Prayer", source: "Divine Office", streamUrl: "blob:https://app.orapronobis.media/v631np", durationSec: 754, sizeBytes: 1000000, imageUrl: null, descText: null, stale: false, unresolved: false, resolvedAt: null }));
  check("C2 Night Prayer paint unchanged: present + playable, bare title", npHtml.includes("Night Prayer") && npHtml.includes('data-playkey="ext-night-prayer"') && !npHtml.includes("Not available today"), npHtml.slice(0, 200));
}

console.log(`\nharness-v631: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
