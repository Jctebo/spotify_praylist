#!/usr/bin/env node
// harness-v573 — prayer-audio playback fix gates.
//
// v573 changes exactly one thing in the Worker: the PRAYER_AUDIO map
// loses every `la` fold (Latin stands down on John's field verdict)
// while every `en` fold keeps v562's value byte-for-byte. The bucket
// leg (files standing in the REMOTE bucket, sha256-verified, the
// added LA keys deleted back out) is asserted against the repair
// run's own records: uploads.json (the 97 files v562 meant to land)
// and uploads-remote.json (the remote verification record).
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const BASE = "4a5d494"; // v562 ship (GitHub main at branch time)
const SRC = "app/worker/src/index.ts";
const PROJ = "/home/hatch/workspace/projects/ora-pro-nobis/v562-prayer-audio";
let ok = 0, bad = 0;
const check = (name, cond, extra = "") => {
  if (cond) { ok++; console.log("ok", name); }
  else { bad++; console.log("NOT-OK", name, extra); }
};

function parseMap(text) {
  const start = text.indexOf("const PRAYER_AUDIO");
  const open = text.indexOf("{", start);
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

// S1: full book coverage stands — 77 slugs mapped.
check("S1 map carries 77 slugs", Object.keys(cur).length === 77,
  `got ${Object.keys(cur).length}`);

// S2: Latin stands down — no entry carries la.
check("S2 no entry carries la", Object.values(cur).every((v) => v.la === undefined),
  Object.entries(cur).filter(([, v]) => v.la !== undefined).map(([k]) => k).join(","));

// S3: every EN duration equals v562's exactly (no English regression).
const enDrift = Object.keys(base).filter(
  (k) => !(k in cur) || cur[k].en !== base[k].en);
check("S3 EN folds byte-equal to v562", enDrift.length === 0, enDrift.join(","));

// S4: durations are sane numbers.
check("S4 all EN durations numeric > 0",
  Object.values(cur).every((v) => typeof v.en === "number" && v.en > 0));

// S5: the remote bucket leg — every EN file from v562's upload set
// stands remote with a verified sha256 (the repair record).
const remotePath = `${PROJ}/uploads-remote.json`;
check("S5a uploads-remote.json exists", existsSync(remotePath));
if (existsSync(remotePath)) {
  const uploads = JSON.parse(readFileSync(`${PROJ}/uploads.json`, "utf8"));
  const remote = JSON.parse(readFileSync(remotePath, "utf8"));
  const byKey = new Map(remote.map((r) => [r.key, r]));
  const enKeys = uploads.filter((u) => u.key.endsWith(".en.mp3"));
  const missing = enKeys.filter((u) => {
    const r = byKey.get(u.key);
    return !r || r.state !== "verified_remote" || r.sha256 !== u.sha256;
  });
  check("S5b every EN upload verified in the REMOTE bucket",
    missing.length === 0, missing.map((u) => u.key).join(","));
  check("S5c EN upload count is 70", enKeys.length === 70, `got ${enKeys.length}`);
}

// S6: diff confinement vs the v562 ship — only index.ts, the two
// release docs, and this harness may differ; client.ts and ui.ts
// byte-identical.
const changed = execSync(`git diff --name-only ${BASE}`, { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const allowed = new Set([SRC,
  "releases/v573-prayer-audio-playback-fix.md",
  "releases/v562-prayer-audio-full-coverage.md",
  "harness-v573.mjs"]);
const stray = changed.filter((f) => !allowed.has(f));
check("S6 diff confined to the allowed set", stray.length === 0, stray.join(","));
const idxDiff = execSync(`git diff ${BASE} -- ${SRC}`, { encoding: "utf8" });
const hunks = idxDiff.split("\n").filter((l) => l.startsWith("@@"));
check("S7 index.ts diff touches only the map block",
  hunks.length > 0 && hunks.every((h) => {
    const m = h.match(/@@ -\d+,?\d* \+(\d+)/);
    return m && parseInt(m[1], 10) >= 1300 && parseInt(m[1], 10) <= 1400;
  }), hunks.join(" | "));

console.log(`harness-v573: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
