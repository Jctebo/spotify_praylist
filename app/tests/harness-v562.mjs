#!/usr/bin/env node
/* harness-v562 — prayer audio full coverage.
 * Data artifacts (plans, renders, QA ledger, uploads ledger, fixture
 * proof, bucket listing) live in the v562 production dir; point
 * V562_DIR at it if it moves. Base for the code-diff checks is the
 * pre-v562 main head (env V562_BASE, default cf1f1c5b — the v561
 * ship head this branch was cut from).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = process.env.V562_DIR || "/home/hatch/workspace/projects/ora-pro-nobis/v562-prayer-audio";
const BASE = process.env.V562_BASE || "cf1f1c5b";
let ok = 0, bad = 0;
const check = (name, cond, detail = "") => {
  if (cond) { ok++; console.log(`ok ${name}`); }
  else { bad++; console.log(`not-ok ${name} ${detail}`); }
};
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const inDir = (f) => join(DIR, f);

/* ---------- the code change: confined to PRAYER_AUDIO + comment ---- */
const cur = readFileSync(join(REPO, "app/worker/src/index.ts"), "utf8");
const base = execFileSync("git", ["-C", REPO, "show", `${BASE}:app/worker/src/index.ts`], { encoding: "utf8" });
const stripMap = (s) => {
  const a = s.indexOf("// PRAYER_AUDIO");
  const b = s.indexOf("};", s.indexOf("const PRAYER_AUDIO")) + 2;
  return s.slice(0, a) + s.slice(b);
};
check("S1 index.ts outside the map comment+block is byte-identical to base", stripMap(cur) === stripMap(base));
const mapOf = (s) => {
  const body = s.slice(s.indexOf("const PRAYER_AUDIO"), s.indexOf("};", s.indexOf("const PRAYER_AUDIO")));
  const m = {};
  for (const mm of body.matchAll(/"([^"]+)": \{ en: ([\d.]+)(?:, la: ([\d.]+))? \}/g))
    m[mm[1]] = mm[3] ? { en: +mm[2], la: +mm[3] } : { en: +mm[2] };
  return m;
};
const curMap = mapOf(cur), baseMap = mapOf(base);
check("S2 base map has 32 slugs", Object.keys(baseMap).length === 32);
check("S3 the 32 standing entries are byte-identical values in the new map, except veni-creator.la (Q7 C: its defective restore was re-rendered; the map carries the re-render's measured duration)",
  Object.entries(baseMap).every(([k, v]) => k === "veni-creator"
    ? curMap[k].en === v.en && curMap[k].la === 140.2
    : JSON.stringify(curMap[k]) === JSON.stringify(v)));
check("S4 new map has 77 slugs (the whole book)", Object.keys(curMap).length === 77);

/* ---------- set arithmetic ------------------------------------------ */
const sets = J(inDir("plan-sets.json"));
const book = J(inDir("live-book.json"));
const bookSlugs = new Set();
for (const g of book.groups) for (const p of g.prayers) bookSlugs.add(p.slug);
check("A1 live book carries 77 prayers", bookSlugs.size === 77);
check("A2 mapped 32 + uncovered 45 = 77",
  Object.keys(sets.mapped).length === 32 && Object.keys(sets.uncovered).length === 45);
check("A3 every book slug is mapped or uncovered, none both",
  [...bookSlugs].every((s) => (s in sets.mapped) !== (s in sets.uncovered)));
check("A4 the map extension is exactly the uncovered set",
  Object.keys(sets.uncovered).every((s) => s in curMap && !(s in baseMap)));
const renders = J(inDir("renders.json"));
check("A5 renders.json carries 61 files (60 planned + 1 failed restore re-rendered per Q7 C)", renders.length === 61);
check("A6 renders split 45 EN + 16 LA (the Q7 C re-render is veni-creator.la)",
  renders.filter((r) => r.lang === "en").length === 45 && renders.filter((r) => r.lang === "la").length === 16);
const restores = J(inDir("restores.json"));
check("A7 restore set is 36 = 48 advertised - 11 standing - 1 failed restore re-rendered (veni-creator.la)", restores.length === 36);

/* ---------- fixture proof ------------------------------------------- */
const fx = J(inDir("fixture-proof.json"));
check("F1 fixture proof covers all 48 standing files", fx.files.length === 48);
check("F2 fixture proof: normalized text reproduces every v484/v509 record", fx.ok === 48 && fx.mismatch === 0);

/* ---------- two-voice plans ------------------------------------------ */
const plans = J(inDir("plans.json"));
const RESP = "avocado_v2:MAI_01", MAIN = "avocado_v2:MAI_03";
let planBad = [];
for (const [fname, p] of Object.entries(plans)) {
  const script = readFileSync(inDir(`work/scripts/${fname.replace(".mp3", ".txt")}`), "utf8");
  const squash = (t) => t.replace(/\s+/g, " ").trim();
  // single-split-verses (the-magnificat.la) is exempt from concatenation: its TTS
  // input carries two disclosed edits (asterisks stripped; "Dominum. Et" ->
  // "Dominum, et" after the full-text render derailed). Its content proof is
  // the QA ledger's charSim 0.871 against the true script.
  if (p.kind !== "single-split-verses" && squash(p.segments.map((s) => s.text).join("\n")) !== squash(script))
    planBad.push(`${fname}: segments do not concatenate to the script`);
  for (const s of p.segments) {
    if (s.role === "response" && s.voice !== RESP) planBad.push(`${fname}: response segment not MAI_01`);
    if (s.voice === RESP && s.text.includes("\n")) planBad.push(`${fname}: response segment spans lines`);
  }
  if (!p.kind.startsWith("single") && !p.segments.some((s) => s.voice === RESP))
    planBad.push(`${fname}: two-voice file with no response segment`);
}
check("P1 segment plans: scripts concatenate, responses are MAI_01 single lines, two-voice files carry responses",
  planBad.length === 0, planBad.slice(0, 3).join(" | "));
const PHR = { en: ["have mercy on us.", "pray for us.", "spare us, o lord!", "graciously hear us, o lord!", "have mercy on us!"],
              la: ["miserere nobis.", "ora pro nobis.", "parce nobis, domine.", "exaudi nos, domine."] };
let litBad = [];
for (const lang of ["en", "la"]) {
  const p = plans[`litany-of-loreto.${lang}.mp3`];
  p.segments.forEach((s, i) => {
    if (s.voice === MAIN && PHR[lang].some((ph) => s.text.toLowerCase().endsWith(ph)) && i >= 5)
      litBad.push(`${lang} seg ${i}: leader segment still ends with a response phrase`);
  });
}
check("P2 litany split: no invocation response phrase left inside a leader segment", litBad.length === 0, litBad.slice(0, 3).join(" | "));

/* ---------- renders: voice read-backs + durations --------------------- */
let rbBad = [];
for (const r of renders) {
  const p = plans[r.file];
  if (!p || p.segments.length !== r.segments.length) { rbBad.push(`${r.file}: segment count drift`); continue; }
  r.segments.forEach((s, i) => {
    if (s.voiceReadback !== p.segments[i].voice || s.voice !== p.segments[i].voice)
      rbBad.push(`${r.file} seg ${i}: voice read-back mismatch`);
  });
  const want = curMap[r.slug]?.[r.lang];
  if (want !== r.durationS) rbBad.push(`${r.file}: map duration ${want} != measured ${r.durationS}`);
}
check("R1 every segment's TTS voice read-back matches its plan; map durations equal measured durations",
  rbBad.length === 0, rbBad.slice(0, 3).join(" | "));

/* ---------- transcript QA ledger -------------------------------------- */
const qa = J(inDir("qa-ledger.json"));
const qaFiles = Object.keys(qa);
check("Q1 QA ledger covers all 97 files", qaFiles.length === 97, `${qaFiles.length}`);
check("Q2 every QA verdict is pass", qaFiles.every((f) => qa[f].verdict === "pass"),
  qaFiles.filter((f) => qa[f].verdict !== "pass").slice(0, 5).join(", "));
check("Q3 every file passed its duration screen (guard screen, or the disclosed population-relative Latin screen)",
  qaFiles.every((f) => qa[f].durationScreen === "pass" || qa[f].durationScreen === "pass (population-relative)"));
check("Q4 EN files pass the guard's strict comparison, or carry a disclosed judgment with its basis recorded",
  qaFiles.filter((f) => f.endsWith(".en.mp3")).every((f) =>
    (qa[f].coverage >= 0.8 && qa[f].extra <= 0.08) ||
    (typeof qa[f].verdictBasis === "string" && qa[f].verdictBasis.length > 0 &&
     (qa[f].canonicalizedExtra === undefined || qa[f].canonicalizedExtra <= 0.3 || qa[f].canonicalizedCoverage >= 0.8))));
check("Q5 LA files carry the disclosed Latin judgment (charSim >= 0.80, strict numbers recorded)",
  qaFiles.filter((f) => f.endsWith(".la.mp3")).every((f) => qa[f].charSim >= 0.8 && typeof qa[f].strictCoverage === "number"));

/* ---------- uploads ---------------------------------------------------- */
const up = J(inDir("uploads.json"));
check("U1 uploads ledger carries 97 files", up.length === 97);
check("U2 every upload read-back verified sha256-equal", up.every((u) => u.verified === true && /^[0-9a-f]{64}$/.test(u.sha256)));
const localSha = {};
for (const r of renders) localSha[r.file] = r.sha256;
check("U3 the 61 new files' upload sha256 equals the render sha256",
  up.filter((u) => u.kind === "new").every((u) => localSha[u.file] === u.sha256));
const after = J(inDir("bucket-after.json"));
const keys = after.map((o) => o.key).filter((k) => k.startsWith("prayer-audio/"));
check("U4 bucket end-state: 108 objects under prayer-audio/", keys.length === 108, `${keys.length}`);
check("U5 every uploaded key stands in the bucket listing", up.every((u) => keys.includes(u.key)));

console.log(`\nharness-v562: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
