// harness-v627.mjs — v627: the " · Not available in the app
// yet" fold is REMOVED from playable rows (John's word,
// 2026-11-23 09:00 CT: "Let's just get rid of the text not
// available at all" — removal, not the registered rename).
//
// Client legs, modeled on harness-v606.mjs's world-building
// (the RENDERED client — the APP_JS template evaluated whole —
// is sliced by a brace-matching closure extractor: trackCard,
// openRead and every client function they call are pulled
// from the rendered source and driven in jsdom). Server legs
// of the v625/v626 pattern do not apply — v627 touches no
// server code.
//
// Fixtures (Improvement D — provenance): the descriptor
// shapes are the production day-build shape, modeled on the
// two rows from John's 2026-11-23 screenshot: own
// episode-file rows with artwork + duration, one carrying NO
// text and one carrying text. The novena fixture carries the
// standing production title form ("Novena to Saint Clement
// Day 1", the v626 own-feed fixture's item).
//
// Legs:
//  L1 ◆ available episode-file row, NO text, with duration
//       -> painted meta is exactly "Plays here · episode
//       file · <dur>", contains NEITHER "Not available in
//       the app yet" NOR "Text not available", and no Read
//       control stands (noText still keys it)
//  L2   available row WITH text -> meta unchanged from base,
//       Read control stands, neither phrase present
//  L3   genuinely-unavailable own card -> meta still reads
//       "Not available in the app yet" (kept verbatim)
//  L4 ◆ openRead with a failing text fetch -> the read body
//       reads "The episode's text could not be loaded." and
//       NOT the struck phrase (the REAL openRead is driven;
//       its fetch is stubbed to reject, its promise chain is
//       awaited, and the painted sheet body is read back)
//  L5   novena row composition unchanged: the §2.7 span
//       stands BEFORE the duration, and no not-available
//       segment stands with or without text
//
// Run: node app/worker/harness-v627.mjs
// Fail-on-old: OPN_CLIENT=<v626 base client.ts> node \
//   app/worker/harness-v627.mjs   (L1 + L4 must fail)

import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); }
catch (e) {
  ({ JSDOM } = await import(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js")));
}

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) { if (fn()) return true; await sleep(25); }
  return fn();
}

// ---- the rendered client ----
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const clientPath = process.env.OPN_CLIENT || path.join(ROOT, "app/worker/src/client.ts");
const clientSrc = readFileSync(clientPath, "utf8");
const tmpMod = path.join(os.tmpdir(), "v627-rendered-client.mjs");
writeFileSync(tmpMod, clientSrc.replace("export const APP_JS =", "globalThis.APP_JS ="));
await import(tmpMod);
const RENDERED = globalThis.APP_JS;

// ---- closure extractor over the rendered source ----
// Pull `function name(...) {...}` by brace matching (string-
// and comment-aware), plus simple top-level `var/const NAME =
// ...;` statements, closing over every identifier the pulled
// code references that the rendered source defines.
const STUBS = new Set(["fetch", "mountDrawer", "markPlaying", "updateDock", "playTrack", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "Promise", "JSON", "Math", "Date", "Object", "Array", "String", "Number", "Boolean", "RegExp", "Error", "Map", "Set", "parseInt", "parseFloat", "isNaN", "encodeURIComponent", "decodeURIComponent"]);
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
// Line-anchored extraction from the rendered source, cached
// per name. Functions come out by brace matching; the few
// value constants the closure needs are single-line top-level
// var statements, pulled whole-line from an allowlist.
const fnCache = new Map();
function extractFn(name) {
  if (fnCache.has(name)) return fnCache.get(name);
  const re = new RegExp("(^|\\n)function " + name.replace(/\$/g, "\\$") + "\\s*\\(");
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
function buildSlice(roots) {
  const parts = new Map();
  const queue = [...roots];
  while (queue.length) {
    const name = queue.shift();
    if (parts.has(name) || STUBS.has(name)) continue;
    const text = extractFn(name) || (VAR_ALLOWLIST.includes(name) ? extractVarLine(name) : null);
    if (!text) continue; // a global the prelude supplies, or a builtin
    parts.set(name, text);
    for (const m of text.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) queue.push(m[1]);
    for (const id of VAR_ALLOWLIST) if (new RegExp("(?<![\\w$.])" + id + "(?![\\w$])").test(text)) queue.push(id);
  }
  // syntax-validate each chunk on its own so a bad pull names itself
  for (const [name, text] of parts) {
    try { new Function(text); }
    catch (e) { throw new Error("slice chunk '" + name + "' does not parse: " + e.message); }
  }
  return [...parts.values()].join("\n");
}
const SLICE = buildSlice(["trackCard", "openRead"]);
if (!SLICE.includes("function trackCard(") || !SLICE.includes("function openRead(")) {
  console.log("FAIL slice extraction missed trackCard/openRead");
  process.exit(1);
}

const PRELUDE = [
  "var state = { dayDescs: [], dayPayload: null, current: null, trackDraws: null, trackDrawsDate: null, presentedDay: '2026-11-23', starred: [], podcasts: null };",
  "function mountDrawer() {}",
  "function markPlaying() {}",
  "function updateDock() {}",
  "function playTrack() {}",
  "function fetch(u) { return window.__opnFetch(u); }",
].join("\n");

function makeWorld(fetchImpl) {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "https://app.orapronobis.media/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window;
  try { w.console = { log: () => {}, warn: () => {}, error: () => {} }; } catch (e) {}
  w.__opnFetch = fetchImpl || (() => Promise.reject(new Error("no fetch in this world")));
  const s = w.document.createElement("script");
  s.textContent = PRELUDE + "\n" + SLICE;
  w.document.body.appendChild(s);
  return w;
}

// The painted meta text of a card's HTML string: the available
// branch wraps it in <div class="meta metarow"><span>…</span>;
// the unavailable own card carries <div class="meta">…</div>.
function metaOf(html) {
  // the available branch's meta span is followed by the
  // metaTrail's dl-ico span — anchor on that, since the
  // novena §2.7 span nests its own </span> inside the meta
  const a = /<div class="meta[^"]*"><span>([\s\S]*?)<\/span><span class="dl-ico"/.exec(html);
  if (a) return a[1];
  const a2 = /<div class="meta[^"]*"><span>([\s\S]*?)<\/span>/.exec(html);
  if (a2) return a2[1];
  const b = /<div class="meta">([\s\S]*?)<\/div>/.exec(html);
  return b ? b[1] : null;
}
const STRUCK = "Not available in the app yet";
const RENAMED = "Text not available";

// Production-shaped own episode-file descriptors (the two
// screenshot rows): artwork + duration stand on both.
const ROW_NO_TEXT = {
  episodeId: "2026-11-23:morning-prayer", kind: "episode",
  title: "Morning Prayer", block: "Morning", _block: "Morning",
  available: true, hasText: false, textUrl: null,
  durationS: 754, imageUrl: "https://fixture.local/art/morning.jpg",
  streamUrl: "https://audio.orapronobis.media/2026-11-23-morning-prayer.mp3",
};
const ROW_WITH_TEXT = {
  ...ROW_NO_TEXT,
  episodeId: "2026-11-23:office-of-readings",
  title: "Office of Readings",
  hasText: true, textUrl: "https://fixture.local/text/office-of-readings.txt",
  durationS: 1092,
};
const DUR1 = "12:34"; // fmtDur(754)
const DUR2 = "18:12"; // fmtDur(1092)

// ---------------- L1 ◆: available, no text ----------------
{
  const w = makeWorld();
  const html = w.trackCard({ ...ROW_NO_TEXT });
  const meta = metaOf(html);
  check("L1 ◆ meta is exactly 'Plays here · episode file · " + DUR1 + "'", meta === "Plays here · episode file · " + DUR1, meta);
  check("L1 ◆ meta contains NEITHER the struck phrase NOR the rename", !!meta && !meta.includes(STRUCK) && !meta.includes(RENAMED), meta);
  check("L1 no Read control stands on the no-text row (noText still keys it)", !/data-read=/.test(html));
  check("L1 the card still stands available (play disc present)", html.includes("data-playkey="));
}

// ---------------- L2: available, with text ----------------
{
  const w = makeWorld();
  const html = w.trackCard({ ...ROW_WITH_TEXT });
  const meta = metaOf(html);
  check("L2 meta unchanged from base: 'Plays here · episode file · " + DUR2 + "'", meta === "Plays here · episode file · " + DUR2, meta);
  check("L2 neither phrase present", !!meta && !meta.includes(STRUCK) && !meta.includes(RENAMED), meta);
  check("L2 Read control stands", /data-read=/.test(html));
}

// ---------------- L3: genuinely-unavailable own card ----------------
{
  const w = makeWorld();
  const html = w.trackCard({ ...ROW_NO_TEXT, available: false });
  const meta = metaOf(html);
  check("L3 unavailable meta still reads verbatim '" + DUR1 + " · " + STRUCK + "'", meta === DUR1 + " · " + STRUCK, meta);
}

// ---------------- L4 ◆: openRead, failing text fetch ----------------
{
  const w = makeWorld(() => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("nope") }));
  w.openRead({ ...ROW_WITH_TEXT });
  const painted = await until(() => {
    const b = w.document.querySelector(".readsheet .readtext");
    return b && b.textContent !== "" && !b.querySelector(".skelbar");
  });
  const body = w.document.querySelector(".readsheet .readtext");
  check("L4 ◆ read body paints after the failed fetch", !!painted, body && body.textContent);
  check("L4 ◆ body reads \"The episode's text could not be loaded.\"", !!body && body.textContent === "The episode's text could not be loaded.", body && body.textContent);
  check("L4 ◆ body does NOT read the struck phrase", !!body && !body.textContent.includes(STRUCK), body && body.textContent);
}

// ---------------- L5: novena composition ----------------
{
  const w = makeWorld();
  const base = {
    episodeId: "novena-to-saint-clement-day-1", kind: "episode",
    title: "Novena to Saint Clement Day 1", block: "Novenas", _block: "Novenas",
    available: true, durationS: 754, imageUrl: "https://fixture.local/art/novena.jpg",
    streamUrl: "https://audio.orapronobis.media/2026-11-23-novena-to-saint-clement-day-1.mp3",
  };
  for (const [label, t] of [["no text", { ...base, hasText: false, textUrl: null }], ["with text", { ...base, hasText: true, textUrl: "https://fixture.local/text/novena.txt" }]]) {
    const html = w.trackCard(t);
    const meta = metaOf(html);
    const spanAt = meta ? meta.indexOf('data-novline=') : -1;
    const durAt = meta ? meta.indexOf(DUR1) : -1;
    check("L5 novena (" + label + "): §2.7 span stands in the meta", spanAt >= 0, meta);
    check("L5 novena (" + label + "): span stands BEFORE the duration", spanAt >= 0 && durAt > spanAt, meta);
    check("L5 novena (" + label + "): no 'episode file' segment, no struck/renamed phrase", !!meta && !meta.includes("episode file") && !meta.includes(STRUCK) && !meta.includes(RENAMED), meta);
    check("L5 novena (" + label + "): meta opens 'Plays here'", !!meta && meta.startsWith("Plays here"), meta);
  }
}

console.log("\nharness-v627: " + ok + " ok / " + bad + " not-ok (client: " + clientPath + ")");
process.exit(bad ? 1 : 0);
