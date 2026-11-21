#!/usr/bin/env node
// harness-v569 — Serving refactor gates.
//
// v569 changes: (1) Smart Tiered Cache ON at the zone (asserted
// out-of-band by API read-back, recorded in the release doc — not
// from here); (2) the Worker gains GET /api/prayer/day-manifest —
// one call carrying the day's whole shape (day shell + Mass +
// readings + the dated day-set asset list) — and settled-day
// immutable caching on the day + manifest answers; (3) the client
// gains the one-pass day-set download (daySetPrefetch) warming the
// standing device audio cache from the manifest; (4) the cost
// watch (jobs/ora_cost_watch.py, the v565 fold-in) and the
// publish-time cache warmer (runner/warm_day_cache.py) join the
// repo. Everything else — the PRAYER_AUDIO map, playback routes,
// the day payload's own shape — stands byte-identical to base.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = process.env.HARNESS_BASE || "67f8751";
const SRC = "app/worker/src/index.ts";
const CLI = "app/worker/src/client.ts";
const UI = "app/worker/src/ui.ts";
let ok = 0, bad = 0;
const check = (name, cond, extra = "") => {
  if (cond) { ok++; console.log("ok", name); }
  else { bad++; console.log("NOT-OK", name, extra); }
};
const cur = readFileSync(SRC, "utf8");
const cli = readFileSync(CLI, "utf8");
const ui = readFileSync(UI, "utf8");
const base = execSync(`git show ${BASE}:${SRC}`, { encoding: "utf8" });
const baseCli = execSync(`git show ${BASE}:${CLI}`, { encoding: "utf8" });

// S1: the manifest machinery stands in the Worker.
check("S1 manifest route + payload + asset scan + settledJson present",
  cur.includes('seg[2] === "day-manifest"') &&
  cur.includes("async function dayManifestPayload") &&
  cur.includes("async function enumerateDayAssets") &&
  cur.includes("function settledJson"));

// S2: the day route and the manifest route both answer through
// settledJson; the agent day-read route is untouched.
check("S2 day + manifest routes use settledJson",
  cur.includes("return settledJson(await prayerDayPayload(env, date), date, pToday);") &&
  cur.includes("return settledJson(await dayManifestPayload(env, date), date, pToday);"));
check("S2b agent day-read still returns plain json",
  cur.includes("return json(await prayerDayPayload(env, date));"));

// S3: the manifest folds day + mass + readings + assets, each with
// its failure posture (mass null, readings empty shape, assets []).
const dmStart = cur.indexOf("async function dayManifestPayload");
const dm = cur.slice(dmStart, cur.indexOf("// v569: immutable day builds", dmStart));
check("S3 manifest folds the four parts",
  dm.includes("prayerDayPayload(env, date)") &&
  dm.includes("massPayload(env, date)") &&
  dm.includes("massReadingsPayload(date)") &&
  dm.includes("enumerateDayAssets(env, date)") &&
  dm.includes("assets"));

// S4: settled-day header shape — past dates immutable, and the
// comparison is against Chicago today (date < today).
const sjStart = cur.indexOf("function settledJson");
const sj = cur.slice(sjStart, cur.indexOf("\n}\n", sjStart));
check("S4 settledJson immutable only for settled dates",
  sj.includes('date < today') &&
  sj.includes('"cache-control": "private, max-age=31536000, immutable"'));

// S5: the asset scan keys on the presented date in the stem and
// dedupes by URL; failures read as the empty list.
const eaStart = cur.indexOf("async function enumerateDayAssets");
const ea = cur.slice(eaStart, cur.indexOf("// v569: ONE manifest call", eaStart));
check("S5 asset scan date-keyed, deduped, failure-empty",
  ea.includes("stem.includes(date)") && ea.includes("seen.has(url)") &&
  ea.includes("catch { return []; }"));

// S6: client day-set prefetch — one manifest call, the standing
// cache, the feed-audio pass-through, additive only (no playback
// function redefined).
check("S6 daySetPrefetch stands + boot calls it",
  cli.includes("function daySetPrefetch(date)") &&
  cli.includes("api('/api/prayer/day-manifest?date=' + date)") &&
  cli.includes("caches.open('opn-ext-audio-v1')") &&
  cli.includes("fetch('/api/player/feed-audio?url=' + encodeURIComponent(a.url))") &&
  cli.includes("try { daySetPrefetch(todayChicago()); } catch (e) {}"));
const changedFns = (diff) => (diff.match(/^[-+]function /gm) || []);
check("S6b client diff adds exactly one function (daySetPrefetch)",
  (() => {
    const d = execSync(`git diff ${BASE} -- ${CLI}`, { encoding: "utf8" });
    const adds = (d.match(/^\+function /gm) || []).length;
    const dels = (d.match(/^-function /gm) || []).length;
    return adds === 1 && dels === 0;
  })());

// S7: the pin moved to v569-1 and ui.ts differs from base ONLY on
// the pin line.
check("S7 pin = ora-pro-nobis-v569-1, ui.ts diff is the pin line only",
  ui.includes('var CACHE = "ora-pro-nobis-v569-1";') &&
  (() => {
    const d = execSync(`git diff ${BASE} -- ${UI}`, { encoding: "utf8" })
      .split("\n").filter((l) => /^[+-]/.test(l) && !/^[+-]{3}/.test(l));
    return d.length === 2 && d.every((l) => l.includes("var CACHE"));
  })());

// S8: PRAYER_AUDIO map byte-identical to base (v569 touches no
// prayer audio surface).
const mapOf = (t) => {
  const s = t.indexOf("const PRAYER_AUDIO");
  const open = t.indexOf("= {", s) + 2;
  let depth = 0, end = -1;
  for (let i = open; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  return t.slice(open, end + 1);
};
check("S8 PRAYER_AUDIO map byte-equal to base", mapOf(cur) === mapOf(base));

// S9: the cost watch + cache warmer stand and parse.
check("S9 cost watch + warmer present and python-clean",
  (() => {
    try {
      execSync("python3 -m py_compile jobs/ora_cost_watch.py runner/warm_day_cache.py");
      const cw = readFileSync("jobs/ora_cost_watch.py", "utf8");
      return cw.includes("r2OperationsAdaptiveGroups") && cw.includes("costPerPrayer");
    } catch { return false; }
  })());

// S10: the touched-file set is exactly the v569 surface.
check("S10 diff confined to the v569 surface",
  (() => {
    const names = execSync(`git diff --name-only ${BASE}`, { encoding: "utf8" })
      .split("\n").filter(Boolean).sort();
    const want = [SRC, CLI, UI, "jobs/ora_cost_watch.py", "runner/warm_day_cache.py",
      "harness-v569.mjs", "releases/v569-serving-refactor.md"].sort();
    return JSON.stringify(names) === JSON.stringify(want);
  })(),
  execSync(`git diff --name-only ${BASE}`, { encoding: "utf8" }));

console.log(`\nharness-v569: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
