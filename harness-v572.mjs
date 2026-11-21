#!/usr/bin/env node
// v572 harness — prayer completion (release doc §2.3).
// H1 census completeness: no "etc." / repeat directive remains in the
//    prayable text of the six changed slugs (the chaplet EN intro's
//    descriptive reference is the one named exception, Plan §2.1).
// H2 expansion counts in the completed texts.
// H3 migration 0043's texts byte-equal the completed texts.
// H4 PRAYER_AUDIO durations equal the measured render durations for the
//    10 re-rendered files; every other entry byte-equal to the base map.
// H5 the remote record verifies 10/10 uploads (sha256).
// H6 diff confined: index.ts PRAYER_AUDIO block only (plus the Ship pin
//    line in ui.ts), migration 0043, this harness, the release doc.
// Usage: node harness-v572.mjs <repoRoot> <baseGitRef> <projectDir>
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const [root, baseRef, proj] = process.argv.slice(2);
let ok = 0, bad = 0;
const check = (label, cond, extra = "") => {
  console.log(`${cond ? "ok" : "NOT-OK"}  ${label}${extra ? " — " + extra : ""}`);
  cond ? ok++ : bad++;
};

const comp = JSON.parse(readFileSync(join(proj, "completed.json"), "utf8"));
const book = JSON.parse(readFileSync(join(proj, "book.json"), "utf8"));
const bySlug = Object.fromEntries(book.map((r) => [r.slug, r]));
const HM_EN = bySlug["hail-mary"].body.trim();
const HM_LA = bySlug["hail-mary"].body_latin.trim();
const GB_EN = bySlug["glory-be"].body.trim();
const OF_EN = bySlug["our-father"].body.trim();
const ER_EN = bySlug["eternal-rest"].body.trim();
const CREED_EN = bySlug["apostles-creed"].body.trim();
const cnt = (t, s) => t.split(s).length - 1;

// H1
const DIRECTIVES = ["Pater noster five times, and Gloria Patri once.", "Pater noster thrice, and Gloria Patri once.",
  "Pater once, Ave seven times.", "PATER noster.", "We beseech, etc.", "Then say Ave thrice",
  "Hail, Mary, etc.", "Ave, Maria, etc.", "Glory be to the Father, etc.", "Gloria Patri, etc.",
  "The sea obeys, etc.", "Cedunt mare, vincula, etc.", "Eternal rest, etc.", "livest and reigneth, etc.",
  "vivit et regnat, etc."];
let h1 = true;
for (const [slug, d] of Object.entries(comp)) {
  for (const f of ["body", "body_latin"]) {
    const t = d[f] || "";
    for (const p of DIRECTIVES) if (t.includes(p)) { h1 = false; console.log(`  H1 hit: ${slug}.${f}: ${p}`); }
    const etcs = (t.match(/etc\./g) || []).length;
    const allowed = slug === "chaplet-of-the-precious-blood" && f === "body" ? 1 : 0;
    if (etcs !== allowed) { h1 = false; console.log(`  H1 etc count: ${slug}.${f}: ${etcs} != ${allowed}`); }
  }
}
check("H1 no abbreviation/repeat marker remains in prayable text (one named descriptive exception)", h1);

// H2
const checks = [
  ["angelus EN Hail Marys", cnt(comp["angelus"].body, HM_EN), 3],
  ["angelus LA Ave Marias", cnt(comp["angelus"].body_latin, HM_LA), 3],
  ["magnificat EN Glory Be", cnt(comp["the-magnificat"].body, GB_EN), 1],
  ["chaplet EN Paters", cnt(comp["chaplet-of-the-precious-blood"].body, OF_EN), 33],
  ["chaplet EN full Glory Bes after mysteries", cnt(comp["chaplet-of-the-precious-blood"].body, GB_EN), 7],
  ["seven-dolours Paters", cnt(comp["rosary-of-the-seven-dolours"].body, OF_EN), 7],
  ["seven-dolours Hail Marys", cnt(comp["rosary-of-the-seven-dolours"].body, HM_EN), 52],
  ["rosary-of-our-lord Paters", cnt(comp["rosary-of-our-lord"].body, OF_EN), 33],
  ["rosary-of-our-lord Hail Marys", cnt(comp["rosary-of-our-lord"].body, HM_EN), 5],
  ["rosary-of-our-lord Eternal Rests", cnt(comp["rosary-of-our-lord"].body, ER_EN), 4],
  ["rosary-of-our-lord Creed", cnt(comp["rosary-of-our-lord"].body, CREED_EN), 1],
];
let h2 = true;
for (const [label, got, want] of checks) if (got !== want) { h2 = false; console.log(`  H2 ${label}: ${got} != ${want}`); }
check("H2 expansion counts in the completed texts", h2);

// H3 — migration texts byte-equal (unescape '' -> ')
const mig = readFileSync(join(root, "app/migrations/0043_prayer_completion.sql"), "utf8");
let h3 = true;
for (const [slug, d] of Object.entries(comp)) {
  for (const f of ["body", "body_latin"]) {
    if (!d[f]) continue;
    const esc = d[f].replaceAll("'", "''");
    if (!mig.includes(`SET ${f} = '${esc}' WHERE slug = '${slug}';`)) { h3 = false; console.log(`  H3 mismatch: ${slug}.${f}`); }
  }
}
check("H3 migration 0043 texts byte-equal the completed texts", h3);

// H4 — PRAYER_AUDIO durations
const idx = readFileSync(join(root, "app/worker/src/index.ts"), "utf8");
const renders = JSON.parse(readFileSync(join(proj, "renders.json"), "utf8"));
const durOf = {};
for (const r of renders) durOf[`${r.slug}.${r.lang}`] = r.duration;
const mapOf = (src) => {
  const m = {};
  const re = /"([a-z0-9-]+)": \{ en: ([\d.]+)(?:, la: ([\d.]+))? \}/g;
  let g; while ((g = re.exec(src))) { m[g[1]] = { en: +g[2], la: g[3] ? +g[3] : undefined }; }
  return m;
};
const newMap = mapOf(idx);
const baseSrc = execSync(`git -C ${root} show ${baseRef}:app/worker/src/index.ts`, { encoding: "utf8", maxBuffer: 1 << 24 });
const baseMap = mapOf(baseSrc);
let h4 = true;
const changedSlugs = new Set(renders.map((r) => r.slug));
for (const [slug, v] of Object.entries(newMap)) {
  const b = baseMap[slug];
  if (!b) { h4 = false; console.log(`  H4 new slug in map: ${slug}`); continue; }
  for (const lang of ["en", "la"]) {
    const key = `${slug}.${lang}`;
    if (key in durOf) {
      if (Math.abs(v[lang] - durOf[key]) > 0.051) { h4 = false; console.log(`  H4 duration ${key}: map ${v[lang]} != render ${durOf[key]}`); }
    } else if (v[lang] !== b[lang]) { h4 = false; console.log(`  H4 untouched entry changed: ${key}`); }
  }
}
for (const slug of Object.keys(baseMap)) if (!(slug in newMap)) { h4 = false; console.log(`  H4 slug dropped: ${slug}`); }
check("H4 PRAYER_AUDIO: 10 durations = measured renders; all other entries byte-equal", h4);

// H5 — remote upload record
let h5 = false, h5extra = "";
const recPath = join(proj, "uploads-remote-v572.json");
if (existsSync(recPath)) {
  const recs = JSON.parse(readFileSync(recPath, "utf8"));
  const byKey = Object.fromEntries(recs.map((r) => [r.key, r]));
  h5 = renders.every((r) => {
    const rec = byKey[`prayer-audio/${r.file}`];
    return rec && rec.sha256 === r.sha256 && (rec.state === "verified_remote" || rec.state === "already_remote");
  });
  h5extra = `${recs.length} records`;
}
check("H5 remote uploads verified 10/10 (sha256)", h5, h5extra);

// H6 — diff confined
const diff = execSync(`git -C ${root} diff --name-only ${baseRef} HEAD`, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const allowed = new Set(["app/worker/src/index.ts", "app/worker/src/ui.ts", "app/migrations/0043_prayer_completion.sql",
  "harness-v572.mjs", "releases/v572-prayer-completion.md"]);
const stray = diff.filter((f) => !allowed.has(f));
let h6 = stray.length === 0;
if (h6) {
  const dIdx = execSync(`git -C ${root} diff ${baseRef} HEAD -- app/worker/src/index.ts`, { encoding: "utf8" });
  const hunks = dIdx.split("\n").filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"));
  const badHunks = hunks.filter((l) => !/PRAYER_AUDIO|v572|en: |la: |^\+\s*"|^\-\s*"/.test(l) && !/^\+\s*\/\/|^\-\s*\/\//.test(l));
  // stricter: every changed line must be a map entry line or a comment
  const badLines = hunks.filter((l) => !/^\s*[+-]\s*("[a-z0-9-]+": \{ en: [\d.]+(, la: [\d.]+)? \},|\/\/)/.test(l));
  if (badLines.length) { h6 = false; console.log("  H6 index.ts lines outside the map:", badLines.slice(0, 4)); }
  const dUi = execSync(`git -C ${root} diff ${baseRef} HEAD -- app/worker/src/ui.ts`, { encoding: "utf8" });
  const uiHunks = dUi.split("\n").filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"));
  const badUi = uiHunks.filter((l) => !/CACHE = "ora-pro-nobis-v\d+-1"/.test(l));
  if (badUi.length) { h6 = false; console.log("  H6 ui.ts lines outside the pin:", badUi.slice(0, 4)); }
}
check("H6 diff confined (index.ts map block + ui.ts pin + migration + harness + doc)", h6, diff.join(", "));

console.log(`\nharness-v572: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
