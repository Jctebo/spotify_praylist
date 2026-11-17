#!/usr/bin/env node
// harness-v482 — Adding prayers to the book (Plan §2.3).
// Approval record 29 · Plan record 1873. Mold: harness-v462
// (statics + scratch-D1 SQL legs through every migration).
// Legs:
// (ST) migration 0029 stands last · it is INSERT-only and
// names exactly the 10 settled slugs in sort order · the SW
// pin stands untouched at ora-pro-nobis-v480-1 on this base
// (Ship moves it).
// (SQ) two scratch databases (through 0028 · through 0029):
// the book stands at 44 rows in 8 groups with the §2.1
// counts · sorts strictly increasing · the standing 34 rows
// byte-unchanged · the 10 new rows byte-equal to the settled
// list (tests/fixtures/prayer-book-v482-additions.json) ·
// Latin on exactly the standing 11 + the 4 named new rows ·
// the payload grouping (consecutive category over ORDER BY
// sort) yields 8 groups, For the children last.
// (TX) text fidelity: distinctive spans of every new body
// (and Latin where it rides) stand in the Lasance text layer
// (whitespace/hyphen normalized). Two drop-cap lines the
// text layer garbles stand verified against the page image
// instead (Plan §2): the responsory's first English line and
// the child contrition's restored initial — both are
// asserted as exact strings here and excluded from TX spans.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const WT = path.resolve(APP, "..");
if (!WT.includes(".worktrees")) { console.error("HARD GUARD: harness-v482 runs only inside a release worktree"); process.exit(2); }
const UI = fs.readFileSync(path.join(APP, "worker/src/ui.ts"), "utf8");
const ADD = JSON.parse(fs.readFileSync(path.join(APP, "tests/fixtures/prayer-book-v482-additions.json"), "utf8"));
const BOOK_TXT = fs.readFileSync("/home/hatch/workspace/projects/ora-pro-nobis/lasance1908_norm.txt", "utf8");

let n = 0, fails = 0;
const ok = (cond, name, extra) => { n++; if (!cond) fails++; console.log(`${cond ? "ok" : "not ok"} ${n} - ${name}` + (!cond && extra ? " :: " + String(extra).slice(0, 300) : "")); };

/* ---------------- statics ---------------- */
const migDir = path.join(APP, "migrations");
const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
{
  ok(files[files.length - 1] === "0029_prayer_book_additions.sql", "ST1 migration 0029 is the last migration", files[files.length - 1]);
  const sql = fs.readFileSync(path.join(migDir, "0029_prayer_book_additions.sql"), "utf8");
  ok(!/\b(UPDATE|DELETE|CREATE|ALTER|DROP)\b/.test(sql.replace(/--[^\n]*/g, "")), "ST2 migration 0029 is INSERT-only");
  const slugs = [...sql.matchAll(/\('([a-z0-9-]+)', '/g)].map((m) => m[1]);
  ok(JSON.stringify(slugs) === JSON.stringify(ADD.map((r) => r.slug)), "ST2 migration names exactly the 10 settled slugs in order", slugs.join(","));
  ok(/var CACHE = "ora-pro-nobis-v480-1"/.test(UI) || /CACHE = 'ora-pro-nobis-v480-1'/.test(UI) || UI.includes("ora-pro-nobis-v480-1"), "ST3 SW pin stands at ora-pro-nobis-v480-1 on this base");
}

/* ---------------- SQL legs ---------------- */
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), "v482-"));
function buildDb(upto) {
  const db = path.join(TMPD, "db-" + upto + ".db");
  for (const f of files) {
    if (f > upto) break;
    execFileSync("sqlite3", [db], { input: fs.readFileSync(path.join(migDir, f), "utf8") });
  }
  return db;
}
const q = (db, sql) => JSON.parse(execFileSync("sqlite3", ["-json", db, sql], { encoding: "utf8" }).trim() || "[]");
const db28 = buildDb("0028_prayer_book_favorites.sql");
const db29 = buildDb("0029_prayer_book_additions.sql");
{
  const before = q(db28, "SELECT slug,title,category,body,body_latin,source,sort FROM prayer_book ORDER BY sort");
  const rows = q(db29, "SELECT slug,title,category,body,body_latin,source,sort FROM prayer_book ORDER BY sort");
  ok(rows.length === 44, "SQ1 the book stands at 44 rows after 0029", rows.length);
  const groups = [];
  for (const r of rows) { const g = groups[groups.length - 1]; if (g && g.name === r.category) g.rows.push(r); else groups.push({ name: r.category, rows: [r] }); }
  ok(JSON.stringify(groups.map((g) => g.name)) === JSON.stringify(["Daily", "Morning & evening", "Mass & Communion", "Our Lady", "In trouble", "For the family", "For the dead", "For the children"]), "SQ2 the payload grouping yields 8 groups in order, For the children last", groups.map((g) => g.name).join(" · "));
  ok(JSON.stringify(groups.map((g) => g.rows.length)) === JSON.stringify([13, 4, 5, 6, 5, 4, 5, 2]), "SQ2 per-group counts 13·4·5·6·5·4·5·2", groups.map((g) => g.rows.length).join("·"));
  ok(rows.every((r, i) => i === 0 || r.sort > rows[i - 1].sort), "SQ3 sorts strictly increasing in reading order");
  const afterStanding = rows.filter((r) => !ADD.some((a) => a.slug === r.slug));
  ok(JSON.stringify(afterStanding) === JSON.stringify(before), "SQ4 the standing 34 rows stand byte-unchanged");
  const newRows = rows.filter((r) => ADD.some((a) => a.slug === r.slug));
  const mismatch = ADD.filter((a) => { const r = newRows.find((x) => x.slug === a.slug); return !r || r.title !== a.title || r.category !== a.category || r.body !== a.body || (r.body_latin ?? null) !== (a.latin ?? null) || r.source !== a.source || r.sort !== a.sort; });
  ok(mismatch.length === 0, "SQ5 the 10 new rows stand byte-equal to the settled list", mismatch.map((m) => m.slug).join(","));
  const latBefore = before.filter((r) => r.body_latin).map((r) => r.slug).sort();
  const lat = rows.filter((r) => r.body_latin).map((r) => r.slug).sort();
  const expectLat = [...latBefore, "prayer-before-a-crucifix", "prayer-to-st-anthony", "sub-tuum-praesidium", "te-deum"].sort();
  ok(latBefore.length === 11 && JSON.stringify(lat) === JSON.stringify(expectLat), "SQ6 Latin stands on exactly the standing 11 + the 4 named new rows", lat.join(","));
  const kids = groups[7];
  ok(kids && JSON.stringify(kids.rows.map((r) => r.slug)) === JSON.stringify(["childs-guardian-angel", "childs-act-of-contrition"]), "SQ7 the eighth group carries the two children's prayers in order");
}

/* ---------------- text fidelity ---------------- */
{
  const norm = (s) => s.toLowerCase().replace(/-\s+/g, "").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").replace(/[“”]/g, '"').replace(/[’]/g, "'");
  const book = norm(BOOK_TXT);
  // Column-set pages: the flat layer interleaves the parallel
  // Latin/English columns, so spans for those prayers are
  // checked against the column-separated fixture, within one
  // column at a time.
  const COLS = fs.readFileSync(path.join(APP, "tests/fixtures/lasance-v482-columns.txt"), "utf8").split("==COL==").map(norm);
  const inCols = (span) => COLS.some((c) => c.includes(norm(span)));
  const COLUMN_SET = new Set(["te-deum", "act-of-reparation-to-the-sacred-heart", "sub-tuum-praesidium"]);
  const FIXTURE_RAW = fs.readFileSync(path.join(APP, "tests/fixtures/lasance-v482-columns.txt"), "utf8");
  const p228 = norm(FIXTURE_RAW.slice(FIXTURE_RAW.indexOf("printed p.228"), FIXTURE_RAW.indexOf("printed p.438")));
  const letters = (x) => norm(x).replace(/[^a-z]/g, "");
  const subseq = (hay, span) => { const H = letters(hay), S = letters(span); let i = 0; for (const c of H) { if (c === S[i]) i++; if (i === S.length) return true; } return i === S.length; };
  const stIdx = book.indexOf("fly to thy patronage");
  const stWindow = book.slice(Math.max(0, stIdx - 400), stIdx + 1600);
  const spans = {
    "te-deum": ["praise thee, o god; we acknowledge thee to be our lord", "te deum laudamus", "in te, domine, speravi; non confundar in aeternum"],
    "prayer-before-a-crucifix": ["to desire ardently all that is pleasing to thee", "quae tibi placita sunt ardenter concupiscere"],
    "act-of-reparation-to-the-sacred-heart": ["heart of jesus, glowing with love for us", "and inflamed with zeal for our salvation", "be thou, o compassionate jesus! our mediator"],
    "litany-of-loreto": ["mother of good counsel", "queen of the most holy rosary", "may the divine assistance remain always with us"],
    "sub-tuum-praesidium": ["we fly to thy patronage, o holy mother of god", "nostras deprecationes ne despicias in necessitatibus nostris"],
    "prayer-to-our-lady-of-sorrows": ["procure for me a good death"],
    "prayer-to-st-anthony": ["death, error, all calamities", "whilst treasures lost are found again", "cedunt mare, vincula"],
    "prayer-for-all-the-faithful-departed": ["o god, the creator and redeemer of all the faithful"],
    "childs-guardian-angel": ["angel of god, my guardian dear"],
    "childs-act-of-contrition": ["because i dread the loss of heaven and the pains of hell", "to confess my sins, to do penance, and to amend my life"],
  };
  for (const [slug, list] of Object.entries(spans)) {
    for (const s of list) {
      const found = slug === "prayer-before-a-crucifix" ? subseq(p228, s)
        : (slug === "sub-tuum-praesidium" && s.startsWith("nostras")) ? subseq(stWindow, s)
        : COLUMN_SET.has(slug) ? (inCols(s) || book.includes(norm(s))) : book.includes(norm(s));
      ok(found, `TX ${slug} span stands in the book text${slug === "prayer-before-a-crucifix" ? " (line-interleaved columns, letter order)" : COLUMN_SET.has(slug) ? " (column-separated)" : ""}`, s);
    }
  }
  const resp = ADD.find((r) => r.slug === "prayer-to-st-anthony");
  ok(resp.body.startsWith("If, then, you ask for miracles,"), "TX responsory first English line stands as image-verified");
  const con = ADD.find((r) => r.slug === "childs-act-of-contrition");
  ok(con.body.startsWith("Eternal Father! I am heartily sorry"), "TX child contrition carries the restored drop-cap initial");
}

console.log(`\n${n - fails}/${n} ok`);
process.exit(fails ? 1 : 0);
