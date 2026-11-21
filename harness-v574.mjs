#!/usr/bin/env node
// harness-v574 — Latin audio return gates.
//
// v574 changes exactly one thing in the Worker: the PRAYER_AUDIO map
// regains an `la` fold for exactly the 27 Latin slugs, each duration
// measured from the NEW Voice 3 / Laughing Seed renders, while every
// `en` fold keeps the standing (v573) value byte-for-byte. The bucket
// leg (the 27 LA files standing in the REMOTE bucket, sha256-verified
// per object) is asserted against the run's own records:
// renders.json (what was rendered) and uploads-remote-v574.json
// (the remote verification record).
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const BASE = "8b67ea4"; // GitHub main at ship time (v573 ship + the 2026-11-21 nightly wallpaper commits, assets only)
const SRC = "app/worker/src/index.ts";
const UI = "app/worker/src/ui.ts";
const PROJ = "/home/hatch/workspace/projects/ora-pro-nobis/v574-latin-return";
let ok = 0, bad = 0;
const check = (name, cond, extra = "") => {
  if (cond) { ok++; console.log("ok", name); }
  else { bad++; console.log("NOT-OK", name, extra); }
};

function parseMap(text) {
  const start = text.indexOf("const PRAYER_AUDIO");
  const open = text.indexOf("= {", start) + 2;
  let depth = 0, end = -1;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = text.slice(open + 1, end);
  const map = {};
  const re = /"([^"]+)":\s*\{\s*en:\s*([0-9.]+)(?:,\s*la:\s*([0-9.]+))?\s*\}/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    map[m[1]] = { en: parseFloat(m[2]), la: m[3] ? parseFloat(m[3]) : undefined };
  }
  return map;
}

const cur = parseMap(readFileSync(SRC, "utf8"));
const baseText = execSync(`git show ${BASE}:${SRC}`, { encoding: "utf8" });
const base = parseMap(baseText);
const renders = JSON.parse(readFileSync(`${PROJ}/renders.json`, "utf8"));
const laSlugs = renders.map((r) => r.slug).sort();

// S1: full book coverage stands — 77 slugs mapped.
check("S1 map carries 77 slugs", Object.keys(cur).length === 77,
  `got ${Object.keys(cur).length}`);

// S2: la present for exactly the 27 Latin slugs and no other.
const withLa = Object.entries(cur).filter(([, v]) => v.la !== undefined)
  .map(([k]) => k).sort();
check("S2 la folds = exactly the 27 Latin slugs",
  JSON.stringify(withLa) === JSON.stringify(laSlugs),
  `extra=${withLa.filter((s) => !laSlugs.includes(s))} missing=${laSlugs.filter((s) => !withLa.includes(s))}`);

// S3: every EN duration equals the standing (v573) map exactly.
const enDrift = Object.keys(base).filter(
  (k) => !(k in cur) || cur[k].en !== base[k].en);
check("S3 EN folds byte-equal to the standing map", enDrift.length === 0,
  enDrift.join(","));

// S4: durations sane, and every la duration equals the measured
// duration of the new render it names.
check("S4a all durations numeric > 0",
  Object.values(cur).every((v) => typeof v.en === "number" && v.en > 0 &&
    (v.la === undefined || (typeof v.la === "number" && v.la > 0))));
const durDrift = renders.filter((r) => {
  const v = cur[r.slug];
  return !v || Math.abs(v.la - r.durationS) > 0.051;
});
check("S4b la durations equal the measured render durations",
  durDrift.length === 0, durDrift.map((r) => r.slug).join(","));

// S5: the remote bucket leg — every LA upload stands remote with a
// verified sha256 matching the render record.
const remotePath = `${PROJ}/uploads-remote-v574.json`;
check("S5a uploads-remote-v574.json exists", existsSync(remotePath));
if (existsSync(remotePath)) {
  const remote = JSON.parse(readFileSync(remotePath, "utf8"));
  const byKey = new Map(remote.map((r) => [r.key, r]));
  const missing = renders.filter((r) => {
    const rec = byKey.get(`prayer-audio/${r.file}`);
    return !rec || rec.state !== "verified_remote" || rec.sha256 !== r.sha256;
  });
  check("S5b every LA upload verified in the REMOTE bucket",
    missing.length === 0, missing.map((r) => r.file).join(","));
  check("S5c LA upload count is 27", remote.length === 27,
    `got ${remote.length}`);
}

// S6: diff confinement vs the v573 ship — only index.ts, ui.ts (the
// pin line only, S6b), the release doc, and this harness may differ.
const changed = execSync(`git diff --name-only ${BASE}`, { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const allowed = new Set([SRC, UI,
  "releases/v574-latin-audio-return.md",
  "harness-v574.mjs"]);
const stray = changed.filter((f) => !allowed.has(f));
check("S6 diff confined to the allowed set", stray.length === 0, stray.join(","));
const uiDiff = execSync(`git diff ${BASE} -- ${UI}`, { encoding: "utf8" });
const uiLines = uiDiff.split("\n").filter(
  (l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"));
check("S6b ui.ts diff is the CACHE pin line only",
  uiLines.every((l) => /CACHE = "ora-pro-nobis-v57[34]-1"/.test(l)),
  uiLines.join(" | "));

// S7: index.ts hunks stay inside the map block (comment + map).
const idxDiff = execSync(`git diff ${BASE} -- ${SRC}`, { encoding: "utf8" });
const hunks = idxDiff.split("\n").filter((l) => l.startsWith("@@"));
check("S7 index.ts diff touches only the map block",
  hunks.length > 0 && hunks.every((h) => {
    const m = h.match(/@@ -\d+,?\d* \+(\d+)/);
    return m && parseInt(m[1], 10) >= 1295 && parseInt(m[1], 10) <= 1420;
  }), hunks.join(" | "));

console.log(`harness-v574: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
