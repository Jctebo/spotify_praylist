// harness-v630.mjs — v630: openRead carries NO comment about
// pulling text on a failed load (John's word, 2026-11-23
// 09:20 CT: "627 should just not have a comment about pulling
// text" / "Like nothing. Either read or nothing.").
//
// Client legs, modeled on harness-v627.mjs (the RENDERED
// client — the APP_JS template evaluated whole — is sliced by
// a brace-matching closure extractor: trackCard, openRead and
// every client function they call are pulled from the rendered
// source and driven in jsdom). v630 touches no server code.
//
// Fixtures (Improvement D — provenance): the descriptor
// shapes are the production day-build shape, as in
// harness-v627: own episode-file rows with artwork + duration,
// one carrying text (driven through openRead) and the
// genuinely-unavailable own card form.
//
// Legs:
//  T1 ◆ openRead with its text fetch stubbed to FAIL (404 and
//       reject subcases) -> after the promise chain settles,
//       the .readtext body textContent is EMPTY, contains no
//       "could not be loaded", no "Not available", no comment
//       about text of any kind; skeleton bars are gone
//  T2   openRead with a SUCCEEDING fetch -> the body reads
//       the fetched text verbatim
//  T3   genuinely-unavailable own card -> meta still reads
//       "Not available in the app yet" verbatim (as v627 L3)
//  T4   grep-level: "The episode's text could not be loaded."
//       occurs 0 times in the client source; the surviving
//       "could not be loaded" occurrences are exactly the
//       three other surfaces (pool, Mass, pictures)
//
// Run: node app/worker/harness-v630.mjs
// Fail-on-old: OPN_CLIENT=<v628 base client.ts> node \
//   app/worker/harness-v630.mjs   (T1 + T4 must fail)

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
const tmpMod = path.join(os.tmpdir(), "v630-rendered-client.mjs");
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

// ---------------- T1 ◆: openRead, failing text fetch ----------------
for (const [label, impl] of [
  ["404", () => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("nope") })],
  ["reject", () => Promise.reject(new Error("network down"))],
]) {
  const w = makeWorld(impl);
  w.openRead({ ...ROW_WITH_TEXT });
  const settled = await until(() => {
    const b = w.document.querySelector(".readsheet .readtext");
    return b && !b.querySelector(".skelbar");
  });
  const body = w.document.querySelector(".readsheet .readtext");
  const sheet = w.document.querySelector(".readsheet");
  check("T1 ◆ (" + label + ") promise chain settles, skeleton bars gone", !!settled && !!body && !body.querySelector(".skelbar"), body && body.innerHTML);
  check("T1 ◆ (" + label + ") read body textContent is EMPTY", !!body && body.textContent === "", body && body.textContent);
  check("T1 ◆ (" + label + ") body carries no text-load comment of any kind", !!body && !body.textContent.includes("could not be loaded") && !body.textContent.includes("Not available") && !/text/i.test(body.textContent), body && body.textContent);
  check("T1 (" + label + ") sheet header stands (title + play control)", !!sheet && !!sheet.querySelector("[data-playkey]") && sheet.querySelector("h1").textContent === ROW_WITH_TEXT.title, sheet && sheet.innerHTML.slice(0, 200));
}

// ---------------- T2: openRead, succeeding text fetch ----------------
{
  const TEXT = "In the beginning was the Word.\nSecond line verbatim.";
  const w = makeWorld(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(TEXT) }));
  w.openRead({ ...ROW_WITH_TEXT });
  const painted = await until(() => {
    const b = w.document.querySelector(".readsheet .readtext");
    return b && b.textContent === TEXT;
  });
  const body = w.document.querySelector(".readsheet .readtext");
  check("T2 read body paints the fetched text verbatim", !!painted && !!body && body.textContent === TEXT, body && body.textContent);
}

// ---------------- T3: genuinely-unavailable own card ----------------
{
  const w = makeWorld();
  const html = w.trackCard({ ...ROW_NO_TEXT, available: false });
  const meta = metaOf(html);
  check("T3 unavailable meta still reads verbatim '" + DUR1 + " · " + STRUCK + "'", meta === DUR1 + " · " + STRUCK, meta);
}

// ---------------- T4: grep-level leg over the client source ----------------
{
  const struckLine = "The episode's text could not be loaded.";
  const struckCount = clientSrc.split(struckLine).length - 1;
  check("T4 struck line occurs 0 times in the client source", struckCount === 0, struckCount);
  const lines = clientSrc.split("\n").filter((l) => l.includes("could not be loaded"));
  check("T4 surviving 'could not be loaded' occurrences are exactly 3", lines.length === 3, lines);
  check("T4 survivors are the pool, Mass and pictures surfaces", lines.some((l) => l.includes("The pool could not be loaded.")) && lines.some((l) => l.includes("Mass could not be loaded.")) && lines.some((l) => l.includes("pictures could not be loaded")), lines);
}

console.log("\nharness-v630: " + ok + " ok / " + bad + " not-ok (client: " + clientPath + ")");
process.exit(bad ? 1 : 0);
