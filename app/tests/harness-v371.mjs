#!/usr/bin/env node
// harness-v371 — the v371 gate: the own-feed fragment wrapper in
// consumeItem (app/worker/src/client.ts) declares the feed's
// namespaces (xmlns:itunes + xmlns:podcast, the exact URIs the live
// feed root carries), so a document-valid item whose batch uses a
// prefix it does not declare on the item (the 2026-11-11 batch's
// <podcast:transcript>) no longer dies as an unbound-prefix
// parsererror in the client's fragment re-parse and settles
// "missing" while published. Legs: S* static (wrapper text, SW
// pin, diff scope), C* the browser-native leg — the client's
// VERBATIM extParseFeed + DOMParser extracted from the candidate
// source, run in real Chromium against the LIVE feed items (Nov 11
// Morning Prayer + Daily Rosary must throw under the pristine
// wrapper and parse under the fixed one; Nov 10 + Nov 12 Morning
// Prayer controls parse under both), R* the resolver replay —
// consumeItem's decision chain replayed in Chromium with the
// verbatim matcher helpers over the live feed stream for the
// presented day 2026-11-11 (all five fixed families + novenas
// found under the fixed wrapper, zero fixed families under the
// pristine one, stop rule intact). Tallies read from the COMPLETE
// log. No wrangler boot: the defect and its fix live entirely in
// the client's parse path, exercised here at its exact seam.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v371 runs only inside a release worktree"); process.exit(2); }
const require = createRequire("/home/hatch/workspace/.tools/pwtest/package.json");
const { chromium } = require("playwright-core");
const CHROME = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CLIENT = fs.readFileSync(path.join(APP, "worker/src/client.ts"), "utf8");
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const FEED_URL = "https://orapronobis.media/podcast.xml";
const ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd";
const PODCAST_NS = "https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md";

let n = 0, fails = 0;
const ok = (cond, name) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}`); };

// ---- verbatim extraction from the candidate source -------------
function extractFn(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error("extract: function not found: " + name);
  let i = src.indexOf("{", at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (!depth) return src.slice(at, j + 1); }
  }
  throw new Error("extract: unbalanced: " + name);
}
function extractVar(src, name) {
  const at = src.indexOf(`var ${name} = {`);
  if (at < 0) throw new Error("extract: var not found: " + name);
  const end = src.indexOf("};", at);
  return src.slice(at, end + 2);
}
// The wrapper literal consumeItem hands extParseFeed, split around
// the item xml: returns [prefix, suffix] exactly as written.
function extractWrapper(src) {
  const m = src.match(/extParseFeed\('((?:[^'\\]|\\.)*)' \+ xml \+ '((?:[^'\\]|\\.)*)'\)/);
  if (!m) throw new Error("extract: consumeItem wrapper call not found");
  const unq = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  return [unq(m[1]), unq(m[2])];
}
const PRISTINE_CLIENT = execFileSync("git", ["-C", WT, "show", "muse-draft-week:app/worker/src/client.ts"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

const NEW_WRAP = extractWrapper(CLIENT);
const OLD_WRAP = extractWrapper(PRISTINE_CLIENT);
const PAGE_SRC = [
  extractFn(CLIENT, "extWs"), extractFn(CLIENT, "extParseDuration"), extractFn(CLIENT, "extParseFeed"),
  extractVar(CLIENT, "OWN_STEM_TO_ID"),
  extractFn(CLIENT, "ownChicagoDateStr"), extractFn(CLIENT, "ownStemOf"), extractFn(CLIENT, "ownDateInStem"),
  extractFn(CLIENT, "ownFamilyOfStem"), extractFn(CLIENT, "ownFeedTitle"),
].join("\n");

// ---- live feed ---------------------------------------------------
const feedText = execFileSync("curl", ["-sS", "--max-time", "60", FEED_URL], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
// The client's own fragment split (the res.text() fallback path):
// parts on '</item>', fragment = from lastIndexOf('<item') + '</item>'.
function fragments(text) {
  const parts = text.split("</item>");
  const out = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const at = parts[i].lastIndexOf("<item");
    if (at >= 0) out.push(parts[i].slice(at) + "</item>");
  }
  return out;
}
const FRAGS = fragments(feedText);
const fragByTitle = (t) => FRAGS.find((f) => f.includes(`<title>${t}</title>`)) || null;
const fragByEnclosure = (stem) => FRAGS.find((f) => f.includes(`/${stem}.mp3`)) || null;
const MP11 = fragByTitle("Morning Prayer - November 11, 2026");
// The Rosary's feed title carries its mysteries/Gospel form
// ("Daily Rosary - <Mysteries> - ... - November 11, 2026"), so
// its fragment is located by the enclosure stem the matcher keys on.
const ROS11 = fragByEnclosure("daily-rosary-2026-11-11");
const MP10 = fragByTitle("Morning Prayer - November 10, 2026");
const MP12 = fragByTitle("Morning Prayer - November 12, 2026");

// ---- in-page replay of consumeItem's decision chain --------------
const REPLAY_SRC = `
window.__parseOne = function (pre, post, frag) {
  try {
    var items = extParseFeed(pre + frag + post);
    return { threw: false, items: items };
  } catch (e) { return { threw: true, items: [] }; }
};
window.__replay = function (pre, post, frags, date) {
  var needed = { 'morning-prayer': 1, 'daily-rosary': 1, 'marian-antiphon-angelus': 1, 'auxilium-christianorum': 1, 'daily-reflection': 1, 'novenas': 1 };
  var found = {}, seenPresent = false, stopped = false;
  for (var k = 0; k < frags.length; k++) {
    var items = [];
    try { items = extParseFeed(pre + frags[k] + post); } catch (e) { continue; }
    var it = items[0];
    if (!it || !it.url) continue;
    var pubDate = ownChicagoDateStr(it.pubMs);
    if (!pubDate) continue;
    if (pubDate < date) { if (seenPresent) { stopped = true; break; } continue; }
    if (pubDate !== date) continue;
    var stem = ownStemOf(it.url);
    if (ownDateInStem(stem) !== date) continue;
    seenPresent = true;
    var fam = ownFamilyOfStem(stem);
    if (!fam || !needed[fam.family]) continue;
    (found[fam.family] = found[fam.family] || []).push({ episodeId: fam.episodeId, title: ownFeedTitle(it.title), url: it.url, pubDate: pubDate });
    if (fam.family !== 'novenas') delete needed[fam.family];
  }
  return { found: found, seenPresent: seenPresent, stopped: stopped };
};`;

(async () => {
  // S* static legs
  ok(NEW_WRAP[0].includes(`xmlns:itunes="${ITUNES_NS}"`), "S1 fixed wrapper declares xmlns:itunes with the feed's exact URI");
  ok(NEW_WRAP[0].includes(`xmlns:podcast="${PODCAST_NS}"`), "S2 fixed wrapper declares xmlns:podcast with the feed's exact URI");
  ok(!OLD_WRAP[0].includes("xmlns:"), "S3 pristine wrapper declares no namespaces (the defect, verbatim from trunk)");
  ok(UI.includes('var CACHE = "ora-pro-nobis-v371-1";'), "S4 SW pin bumped to ora-pro-nobis-v371-1");
  const changed = execFileSync("git", ["-C", WT, "diff", "--name-only", "muse-draft-week"], { encoding: "utf8" }).trim().split("\n").filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify(["app/worker/src/client.ts", "app/worker/src/ui.ts"]), "S5 diff scope: only client.ts + ui.ts changed vs trunk");

  // Feed legs
  ok(feedText.length > 1000000 && FRAGS.length > 2000, `S6 live feed fetched (${FRAGS.length} item fragments)`);
  ok(!!MP11 && MP11.includes("<podcast:transcript"), "S7 live Nov 11 Morning Prayer fragment carries <podcast:transcript> without item-level xmlns:podcast");
  ok(!!ROS11 && !!MP10 && !!MP12, "S8 live fragments located: Nov 11 Rosary + Nov 10/Nov 12 Morning Prayer controls");

  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.evaluate((src) => { (0, eval)(src); }, PAGE_SRC + "\n" + REPLAY_SRC);
  const parse = (wrap, frag) => page.evaluate(([pre, post, f]) => window.__parseOne(pre, post, f), [wrap[0], wrap[1], frag]);
  const replay = (wrap, date) => page.evaluate(([pre, post, fs2, d]) => window.__replay(pre, post, fs2, d), [wrap[0], wrap[1], FRAGS, date]);

  // C* browser-native legs
  const c1 = await parse(OLD_WRAP, MP11);
  ok(c1.threw === true, "C1 PRISTINE wrapper: Nov 11 Morning Prayer fragment THROWS 'feed parse failed' in Chromium");
  const c2 = await parse(OLD_WRAP, ROS11);
  ok(c2.threw === true, "C2 PRISTINE wrapper: Nov 11 Daily Rosary fragment THROWS in Chromium");
  const c3 = await parse(NEW_WRAP, MP11);
  ok(c3.threw === false && c3.items.length === 1 && c3.items[0].url.endsWith("morning-prayer-elevenlabs-2026-11-11.mp3"), "C3 FIXED wrapper: Nov 11 Morning Prayer parses, enclosure = morning-prayer-elevenlabs-2026-11-11.mp3");
  const c4 = await parse(NEW_WRAP, ROS11);
  ok(c4.threw === false && c4.items.length === 1 && c4.items[0].url.endsWith("daily-rosary-2026-11-11.mp3"), "C4 FIXED wrapper: Nov 11 Daily Rosary parses, enclosure = daily-rosary-2026-11-11.mp3");
  const c5 = await parse(OLD_WRAP, MP10);
  ok(c5.threw === false && c5.items.length === 1, "C5 control: Nov 10 Morning Prayer parses under the PRISTINE wrapper");
  const c6 = await parse(OLD_WRAP, MP12);
  ok(c6.threw === false && c6.items.length === 1, "C6 control: Nov 12 Morning Prayer parses under the PRISTINE wrapper");
  const c7 = await parse(NEW_WRAP, MP10);
  ok(c7.threw === false && c7.items.length === 1, "C7 control: Nov 10 Morning Prayer parses under the FIXED wrapper");
  const c8 = await parse(NEW_WRAP, MP12);
  ok(c8.threw === false && c8.items.length === 1, "C8 control: Nov 12 Morning Prayer parses under the FIXED wrapper");

  // R* resolver replay legs (consumeItem's chain, presented day)
  const r1 = await replay(NEW_WRAP, "2026-11-11");
  const FAMS = ["morning-prayer", "daily-rosary", "marian-antiphon-angelus", "auxilium-christianorum", "daily-reflection"];
  ok(FAMS.every((f) => (r1.found[f] || []).length >= 1), "R1 FIXED replay 2026-11-11: all five fixed families found (morning-prayer, daily-rosary, marian-antiphon-angelus, auxilium-christianorum, daily-reflection)");
  ok((r1.found["novenas"] || []).length >= 1, `R2 FIXED replay 2026-11-11: novenas found (${(r1.found["novenas"] || []).length} items)`);
  ok(r1.stopped === true && Object.values(r1.found).flat().every((m) => m.pubDate === "2026-11-11"), "R3 FIXED replay: stop rule fired at the first pre-day item after the block; every found item is dated 2026-11-11");
  const r2 = await replay(OLD_WRAP, "2026-11-11");
  ok(FAMS.every((f) => !(f in r2.found)), "R4 PRISTINE replay 2026-11-11: ZERO fixed families found (the production failure, replayed)");
  const r3 = await replay(NEW_WRAP, "2026-11-10");
  ok((r3.found["morning-prayer"] || []).length === 1, "R5 FIXED replay control day 2026-11-10: morning-prayer found");
  const r4 = await replay(NEW_WRAP, "2026-11-12");
  ok((r4.found["morning-prayer"] || []).length === 1, "R6 FIXED replay control day 2026-11-12: morning-prayer found");

  await browser.close();
  console.log(`# harness-v371: ${n - fails}/${n} passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
