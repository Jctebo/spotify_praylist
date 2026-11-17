#!/usr/bin/env node
// harness-v481 — The Raccolta prayer source (Plan §2, approval record 30).
// Mold: harness-v482 (statics + scratch-D1 SQL legs through every migration).
// Fixture provenance (Improvement D): the pre-state book is tonight's LIVE
// prayer-door payload (44 rows · 8 groups, v482 shipped) saved at
// v481-verify/live-book.json; the seed texts are the page-image-verified
// records at v481-verify/verified-all.json — this harness asserts the
// migration reproduces the fixture byte-for-byte, and the fixture
// reproduces verified-all.json byte-for-byte.
// Legs:
// (ST) migration 0030 stands last · it touches prayer_book only · its
// INSERT names exactly the 31 settled slugs · the SW pin stands
// untouched at ora-pro-nobis-v482-1 on this base (Ship moves it).
// (SQ) two scratch databases (through 0029 · through 0030): before =
// 44 rows in 8 groups matching the live payload's slugs/groups/Latin;
// after = 75 rows in 9 groups (counts 24·5·11·9·5·4·7·2·8), The
// Raccolta last · sorts strictly increasing · standing bodies and
// Latin byte-unchanged except the 4 named Latin fills · fold sources
// gained exactly the named appends · the 31 new rows byte-equal to
// the fixture · Latin on exactly 31 rows (15 standing + 12 new + 4
// fills) · slug unique · no (title, category) pair twice · no literal
// escape artifacts in any body.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v481 runs only inside a release worktree"); process.exit(2); }
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const FIX = JSON.parse(fs.readFileSync(path.join(APP, "tests/fixtures/prayer-book-v481-raccolta.json"), "utf8"));
const LIVE = JSON.parse(fs.readFileSync("/home/hatch/workspace/projects/ora-pro-nobis/v481-verify/live-book.json", "utf8"));
const VER = JSON.parse(fs.readFileSync("/home/hatch/workspace/projects/ora-pro-nobis/v481-verify/verified-all.json", "utf8"));

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };

/* ---------------- fixture provenance ---------------- */
{
  const badNew = FIX.newRows.filter((r) => { const v = VER[String(r.no)]; return !v || v.body_en !== r.body || (v.body_latin ?? null) !== (r.latin ?? null); });
  ok(badNew.length === 0, "FX1 the 31 fixture bodies/Latin stand byte-equal to the page-image-verified records", badNew.map((r) => r.slug).join(","));
  const badFold = FIX.folds.filter((f) => { const v = VER[String(f.no)]; return !v || (f.latinFill ?? null) !== (v.body_latin ?? null) && f.latinFill !== null; });
  ok(badFold.length === 0, "FX2 the fold Latin fills stand byte-equal to the verified records", badFold.map((f) => f.no).join(","));
  ok(FIX.newRows.length === 31 && FIX.folds.length === 21 && FIX.folds.reduce((a, f) => a + f.targets.length, 0) === 24, "FX3 fixture shape: 31 new rows · 21 folds · 24 row updates");
}

/* ---------------- statics ---------------- */
const migDir = path.join(APP, "migrations");
const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
{
  ok(files[files.length - 1] === "0030_raccolta_prayer_source.sql", "ST1 migration 0030 is the last migration", files[files.length - 1]);
  const sql = fs.readFileSync(path.join(migDir, "0030_raccolta_prayer_source.sql"), "utf8");
  const bare = sql.replace(/--[^\n]*/g, "");
  ok(!/\b(CREATE|ALTER|DROP|DELETE)\b/.test(bare) && !/INSERT INTO (?!prayer_book)/.test(bare) && !/UPDATE (?!prayer_book)/.test(bare), "ST2 migration 0030 touches prayer_book only (INSERT + UPDATE)");
  const slugs = [...bare.matchAll(/\('([a-z0-9-]+)', '/g)].map((m) => m[1]);
  ok(JSON.stringify(slugs) === JSON.stringify(FIX.newRows.map((r) => r.slug)), "ST3 the INSERT names exactly the 31 settled slugs in order", slugs.join(","));
  ok(UI.includes("ora-pro-nobis-v482-1"), "ST4 SW pin stands at ora-pro-nobis-v482-1 on this base");
}

/* ---------------- SQL legs ---------------- */
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v481-"));
function buildDb(upto) {
  const db = path.join(TMPD, "db-" + upto + ".db");
  for (const f of files) {
    if (f > upto) break;
    execFileSync("sqlite3", [db], { input: fs.readFileSync(path.join(migDir, f), "utf8") });
  }
  return db;
}
const q = (db, sql) => JSON.parse(execFileSync("sqlite3", ["-json", db, sql], { encoding: "utf8" }).trim() || "[]");
const db29 = buildDb("0029_prayer_book_additions.sql");
const db30 = buildDb("0030_raccolta_prayer_source.sql");
const groupOf = (rows) => { const gs = []; for (const r of rows) { const g = gs[gs.length - 1]; if (g && g.name === r.category) g.rows.push(r); else gs.push({ name: r.category, rows: [r] }); } return gs; };
{
  const before = q(db29, "SELECT slug,title,category,body,body_latin,source,sort FROM prayer_book ORDER BY sort");
  const rows = q(db30, "SELECT slug,title,category,body,body_latin,source,sort FROM prayer_book ORDER BY sort");
  // pre-state == the live payload (production fixture)
  const liveFlat = LIVE.groups.flatMap((g) => g.prayers.map((p) => ({ slug: p.slug, category: g.category, latin: !!p.bodyLatin })));
  ok(before.length === 44 && JSON.stringify(before.map((r) => ({ slug: r.slug, category: r.category, latin: !!r.body_latin }))) === JSON.stringify(liveFlat), "SQ1 pre-state (through 0029) matches the live book: 44 rows, same slugs/groups/Latin");
  ok(rows.length === 75, "SQ2 the book stands at 75 rows after 0030", rows.length);
  const groups = groupOf(rows);
  ok(JSON.stringify(groups.map((g) => g.name)) === JSON.stringify(["Daily", "Morning & evening", "Mass & Communion", "Our Lady", "In trouble", "For the family", "For the dead", "For the children", "The Raccolta"]), "SQ3 grouping yields 9 groups in order, The Raccolta last", groups.map((g) => g.name).join(" · "));
  ok(JSON.stringify(groups.map((g) => g.rows.length)) === JSON.stringify([24, 5, 11, 9, 5, 4, 7, 2, 8]), "SQ4 per-group counts 24·5·11·9·5·4·7·2·8", groups.map((g) => g.rows.length).join("·"));
  ok(rows.every((r, i) => i === 0 || r.sort > rows[i - 1].sort), "SQ5 sorts strictly increasing in reading order");
  ok(new Set(rows.map((r) => r.slug)).size === 75, "SQ6 every slug unique");
  ok(new Set(rows.map((r) => r.category + "|" + r.title)).size === 75, "SQ7 no (title, group) pair twice");
  // standing rows: bodies unchanged; sources only gained fold appends; Latin only the 4 fills
  const fills = Object.fromEntries(FIX.folds.filter((f) => f.latinFill).map((f) => [f.targets[0], f.latinFill]));
  const appends = {}; for (const f of FIX.folds) for (const t of f.targets) appends[t] = (appends[t] ?? "") + f.append;
  const badBody = [], badSrc = [], badLat = [];
  for (const b of before) {
    const a = rows.find((r) => r.slug === b.slug);
    if (!a || a.body !== b.body) badBody.push(b.slug);
    if (!a || a.source !== b.source + (appends[b.slug] ?? "")) badSrc.push(b.slug);
    const wantLat = fills[b.slug] ?? b.body_latin;
    if (!a || (a.body_latin ?? null) !== (wantLat ?? null)) badLat.push(b.slug);
  }
  ok(badBody.length === 0, "SQ8 standing 44 bodies byte-unchanged", badBody.join(","));
  ok(badSrc.length === 0, "SQ9 standing sources gained exactly the 24 fold appends and nothing else", badSrc.join(","));
  ok(badLat.length === 0, "SQ10 standing Latin unchanged except the 4 named fills (95·189·296·60)", badLat.join(","));
  const mismatch = FIX.newRows.filter((a) => { const r = rows.find((x) => x.slug === a.slug); return !r || r.title !== a.title || r.category !== a.category || r.body !== a.body || (r.body_latin ?? null) !== (a.latin ?? null) || r.source !== a.source || r.sort !== a.sort; });
  ok(mismatch.length === 0, "SQ11 the 31 new rows stand byte-equal to the fixture", mismatch.map((m) => m.slug).join(","));
  const lat = rows.filter((r) => r.body_latin).map((r) => r.slug);
  ok(lat.length === 31, "SQ12 Latin stands on exactly 31 rows (15 standing + 12 new + 4 fills)", lat.length + ": " + lat.join(","));
  ok(rows.every((r) => !/\\n|\\t/.test(r.body) && !(r.body_latin && /\\n|\\t/.test(r.body_latin))), "SQ13 no literal escape artifacts in any body or Latin");
  const rg = groups[8];
  ok(rg && JSON.stringify(rg.rows.map((r) => r.slug)) === JSON.stringify(["rosary-of-our-lord", "chaplet-of-the-precious-blood", "offering-of-the-precious-blood", "act-of-oblation-to-the-sacred-heart", "memorare-to-st-joseph", "prayer-to-st-joseph-for-the-church", "prayer-to-st-paul", "three-offerings-of-the-precious-blood"]), "SQ14 The Raccolta group carries its 8 rows in Raccolta-number order");
}

console.log(`# ${n - fails}/${n} ok`);
process.exit(fails ? 1 : 0);
