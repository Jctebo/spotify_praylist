// harness-v608.mjs — v608 evidence: the liturgy-serving
// fix (DevOps Board row 1582). Three limbs:
//   (1) the USCCB readings gain a D1 DISPLAY cache
//       (readings_cache, migration 0046 — a short-term
//       display cache under the USCCB RSS display clause,
//       NOT an archive): the nightly grab pulls the current
//       day once, verifies it, stores it, and prunes a
//       rolling 35-day window; the serve is store-first
//       (a hit costs ZERO outbound fetches) and a miss runs
//       the standing live pull (ladders, parsers, in-isolate
//       caches untouched) and backfills on found only.
//   (2) Universalis lazy: the client JSONP backup loads
//       only when the feed payload actually lacks a piece
//       (massFeedLacksPiece mirrors massReadingsHtml's fill
//       rule), once per date — the eager call in
//       paintMassLiturgy is gone.
//   (3) the ICEL acknowledgment stands on the FIRST frame
//       of the Mass scroll as well as the last (ICEL's
//       internet-use condition: first AND last frames).
// Modeled on harness-v537.mjs (esbuild transpile of
// mass-readings.ts, stubbed fetch over the fixtures) +
// harness-v606.mjs (rendered-client slicing in jsdom).
// Fixtures (Improvement D — REAL production payloads
// captured 2026-11-18, app/tests/fixtures-v531): the real
// USCCB feed carrying 2026-11-18 with its two memorial
// mentions, and the real memorial pages those mentions map
// to (Dedication 679 · Rose Philippine Duchesne 679A —
// the v537 harness's own mapping).
// Run: node app/tests/harness-v608.mjs   (from the worktree root)
// Fail-on-old: OPN_SRC=<unmodified worker/src dir> node \
//   app/tests/harness-v608.mjs   (W and C legs must fail:
//   the old payload takes no env, grabReadings /
//   verifyReadings do not exist, the old client loads
//   Universalis eagerly and carries the notice once.)
// W4 note: the grab-rejects leg uses the spec's second
// variant — a REAL feed that does not carry the grabbed
// date (a judged ok:false at the grab level). The first
// variant (a zero-item/blocked body) makes the pull itself
// throw after its ladder — by design grabReadings lets
// that throw propagate and the DOOR ROUTE answers it
// ok:false 'pull failed: …' at HTTP 200; the throw posture
// itself stands proven by harness-v537's F2 leg.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) {
  ({ JSDOM } = await import(path.join(os.homedir(), 'workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js')));
}

const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = process.env.OPN_SRC ? path.resolve(process.env.OPN_SRC) : APP + '/worker/src';
const FIX = APP + '/tests/fixtures-v531';
const ESBUILD = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild';
const DATE = '2026-11-18';

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
function bundle(file, tag) {
  const tmp = mkdtempSync(path.join(tmpdir(), tag + '-'));
  execFileSync(ESBUILD, [file, '--bundle', '--format=cjs', '--platform=node', '--outfile=' + tmp + '/b.cjs'], { stdio: 'pipe' });
  return createRequire(tmp + '/x.js')(tmp + '/b.cjs');
}
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const FEED_XML = readFileSync(FIX + '/usccb-feed.xml', 'utf8');
const PAGE_DED = readFileSync(FIX + '/memorial-dedication.html', 'utf8');
const PAGE_ROSE = readFileSync(FIX + '/memorial-rose.html', 'utf8');
const BLOCK_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Access Denied</title></head><body><h1>Access Denied</h1><p>Reference #00.00000000.0000000000</p></body></html>';
const PAGE_BY_FILE = {
  '1118-memorial-dedication-basilica-sts-peter-paul.cfm': PAGE_DED,
  '1118-memorial-rose-philippine-duchesne.cfm': PAGE_ROSE,
};
const FEED_URLS = ['https://bible.usccb.org/readings.rss', 'https://www.usccb.org/bible/readings/rss/index.cfm'];

/* ---------------- fake D1 over a Map ----------------
   Implements exactly the store's SQL shapes:
   SELECT body … WHERE date = ? · the upsert · the prune
   DELETE … date < date(?, '-35 days') (the cutoff is
   computed here in JS, date-only, like SQLite's date()). */
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...a) { args = a; return stmt; },
        async first() {
          if (/SELECT body FROM readings_cache/.test(sql)) {
            const r = rows.get(args[0]);
            return r ? { body: r.body } : null;
          }
          throw new Error('fakeDb first(): unpatterned SQL: ' + sql);
        },
        async run() {
          if (/INSERT INTO readings_cache/.test(sql)) {
            rows.set(args[0], { body: args[1], fetched_at: args[2] });
            return { success: true };
          }
          if (/DELETE FROM readings_cache/.test(sql)) {
            const cutoff = new Date(Date.parse(args[0] + 'T00:00:00Z') - 35 * 86400000).toISOString().slice(0, 10);
            for (const d of [...rows.keys()]) if (d < cutoff) rows.delete(d);
            return { success: true };
          }
          throw new Error('fakeDb run(): unpatterned SQL: ' + sql);
        },
      };
      return stmt;
    },
  };
}

/* ---------------- fetch stubs ---------------- */
const realFetch = globalThis.fetch;
const servePage = (html) => ({ ok: true, status: 200, text: async () => html });
function stubFetch(feedBody, record) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    record.push(u);
    if (FEED_URLS.includes(u)) return servePage(feedBody);
    const file = u.split('/').pop();
    if (PAGE_BY_FILE[file]) return servePage(PAGE_BY_FILE[file]);
    throw new Error('unstubbed fetch: ' + u);
  };
}

/* ---------------- W: the Worker store legs ---------------- */
let mr0 = null;
try { mr0 = bundle(SRC + '/mass-readings.ts', 'mr608'); } catch (e) { ok(false, 'W0: mass-readings.ts bundles', String(e).slice(0, 160)); }
if (mr0) {
  const expected = mr0.parseUsccbFeed(FEED_XML, DATE);
  // A FRESH bundle per leg (the v537 pattern): the module's
  // in-isolate feed/memorial caches must start cold in each
  // leg, or an earlier leg's warm cache would serve the pull.
  let legN = 0;
  const freshMr = () => bundle(SRC + '/mass-readings.ts', 'mr608leg' + (++legN));

  // W1: store hit — zero outbound fetches, payload deep-equal.
  try {
    const mr = freshMr();
    const db = fakeDb();
    db.rows.set(DATE, { body: JSON.stringify(expected), fetched_at: '2026-11-18T06:00:00.000Z' });
    const record = [];
    stubFetch(FEED_XML, record);
    const p = await mr.massReadingsPayload({ DB: db }, DATE);
    ok(record.length === 0 && deepEq(p, expected),
      'W1: a store hit returns the stored payload deep-equal with ZERO outbound fetches', 'fetches=' + record.length);
  } catch (e) { ok(false, 'W1: store hit', String(e).slice(0, 160)); }

  // W2: miss + backfill — the live pull lands, the store
  // row stands, and a second call adds zero fetches.
  try {
    const mr = freshMr();
    const db = fakeDb();
    const record = [];
    stubFetch(FEED_XML, record);
    const p = await mr.massReadingsPayload({ DB: db }, DATE);
    const afterFirst = record.length;
    const stored = db.rows.get(DATE);
    const p2 = await mr.massReadingsPayload({ DB: db }, DATE);
    ok(p.found && deepEq(p.parts, expected.parts) && (p.memorials || []).length === 2
      && !!stored && JSON.parse(stored.body).found === true
      && record.length === afterFirst && deepEq(p2, p),
      'W2: a store miss pulls live (parts match the parser\u2019s own output), backfills the row, and the second call adds 0 fetches',
      'fetches=' + record.length + ' stored=' + !!stored);
  } catch (e) { ok(false, 'W2: miss + backfill', String(e).slice(0, 160)); }

  // W3: prune — the grab keeps the rolling 35-day window.
  try {
    const mr = freshMr();
    const db = fakeDb();
    db.rows.set('2026-10-09', { body: '{"date":"2026-10-09","found":true,"parts":[],"copyright":[]}', fetched_at: '2026-10-09T06:00:00.000Z' }); // grab −40d
    db.rows.set('2026-11-08', { body: '{"date":"2026-11-08","found":true,"parts":[],"copyright":[]}', fetched_at: '2026-11-08T06:00:00.000Z' }); // grab −10d
    const record = [];
    stubFetch(FEED_XML, record);
    const v = await mr.grabReadings({ DB: db }, DATE);
    ok(v.ok === true && !db.rows.has('2026-10-09') && db.rows.has('2026-11-08') && db.rows.has(DATE),
      'W3: the grab prunes the −40d row, keeps the −10d row, and stores the grabbed day',
      JSON.stringify([...db.rows.keys()]));
  } catch (e) { ok(false, 'W3: prune', String(e).slice(0, 160)); }

  // W4: grab rejects an unverifiable pull — the real
  // fixture feed, which does not carry the grabbed date:
  // verification judges ok:false and NOTHING is stored
  // (see the header note for the zero-item variant, whose
  // throw the door route converts to the same verdict).
  try {
    const mr = freshMr();
    const db = fakeDb();
    const record = [];
    stubFetch(FEED_XML, record);
    let v = null, threw = false;
    try { v = await mr.grabReadings({ DB: db }, '2026-12-25'); } catch { threw = true; }
    ok(!threw && v && v.ok === false && /does not carry the date/.test(v.reason || '') && db.rows.size === 0,
      'W4: a pull the feed does not carry makes the grab answer ok:false and store nothing — the verdict, never a throw',
      JSON.stringify(v) + ' rows=' + db.rows.size);
  } catch (e) { ok(false, 'W4: grab rejects an unverifiable pull', String(e).slice(0, 160)); }

  // W5: the grab verdict — citations in order, memorials 2.
  try {
    const mr = freshMr();
    const db = fakeDb();
    const record = [];
    stubFetch(FEED_XML, record);
    const v = await mr.grabReadings({ DB: db }, DATE);
    ok(v.ok === true && v.parts === expected.parts.length && v.memorials === 2
      && deepEq(v.citations, expected.parts.map((x) => x.source)),
      'W5: the grab verdict stands ok with the fixture parts\u2019 citations in order and memorials = 2',
      JSON.stringify(v).slice(0, 200));
  } catch (e) { ok(false, 'W5: grab verdict', String(e).slice(0, 160)); }
}
globalThis.fetch = realFetch;

/* ---------------- C: the client legs (jsdom slices of the RENDERED client) ---------------- */
const clientSrc = readFileSync(SRC + '/client.ts', 'utf8');
const tmpMod = path.join(tmpdir(), 'v608-rendered-client.mjs');
writeFileSync(tmpMod, clientSrc.replace('export const APP_JS =', 'globalThis.APP_JS ='));
delete globalThis.APP_JS;
await import(tmpMod + '?v608=' + Date.now());
const RENDERED = globalThis.APP_JS;

function extractFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return null;
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) return src.slice(at, i + 1); }
  }
  return null;
}
function sliceBetween(src, startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + 1);
  return a >= 0 && b > a ? src.slice(a, b) : null;
}

// Slice A: the readings-load region (MASS_ICEL_NOTICE →
// the end of massMaybeLoadUniversalis, whose next text is
// the v488 comment). Slice B: the standing-set region
// (massMemorialNameKey → massStandingSetKey's end, whose
// next text is the v531 chip comment).
const SLICE_A = sliceBetween(RENDERED, 'var MASS_ICEL_NOTICE', '/* v488: role-aware line rendering.');
const SLICE_B = sliceBetween(RENDERED, 'function massMemorialNameKey', '/* v531: the readings chip row');
const SCROLL_FN = RENDERED ? extractFn(RENDERED, 'paintMassScroll') : null;
ok(!!SLICE_A && !!SLICE_B && !!SCROLL_FN && SLICE_A.includes('function massMaybeLoadUniversalis('),
  'C0: the client slices stand (load region · standing-set region · paintMassScroll)');

const PRELUDE_C1 = [
  "var state = { tab: 'mass', mass: null };",
  "function api(path) { return window.__apiImpl(path); }",
  "function paintMassReadings() {}",
  "function paintMassAcks() {}",
].join('\n');
function makeMassWorld(apiImpl) {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  w.__apiImpl = apiImpl;
  const s = w.document.createElement('script');
  s.textContent = PRELUDE_C1 + '\n' + SLICE_A + '\n' + SLICE_B;
  w.document.body.appendChild(s);
  return w;
}
const uniCount = (w) => [...w.document.head.querySelectorAll('script')].filter((x) => (x.getAttribute('src') || '').includes('universalis.com')).length;
const tick = () => new Promise((r) => setTimeout(r, 30));
const part = (key) => ({ key, heading: key, source: 'Src ' + key, html: '<p>x</p>' });
const COMPLETE = { date: DATE, found: true, parts: ['r1', 'ps', 'r2', 'ga', 'g'].map(part), copyright: [] };
const LACKING_G = { date: DATE, found: true, parts: ['r1', 'ps', 'r2', 'ga'].map(part), copyright: [] };

// C1: lazy Universalis, driven through loadMassFeed with
// a stubbed api() — the standing client seam.
try {
  const wA = makeMassWorld(() => Promise.resolve(COMPLETE));
  wA.loadMassFeed(DATE);
  await tick();
  ok(uniCount(wA) === 0, 'C1a: a complete feed payload (all CANON slots) appends NO Universalis script', 'count=' + uniCount(wA));
} catch (e) { ok(false, 'C1a: complete feed → no Universalis', String(e).slice(0, 160)); }
try {
  const wB = makeMassWorld(() => Promise.resolve(LACKING_G));
  wB.loadMassFeed(DATE);
  await tick();
  const once = uniCount(wB);
  wB.loadMassFeed(DATE); // a second same-date settle must not re-fire
  await tick();
  ok(once === 1 && uniCount(wB) === 1, 'C1b: a payload missing the Gospel appends exactly ONE Universalis script, once per date', 'count=' + uniCount(wB));
} catch (e) { ok(false, 'C1b: lacking feed → one Universalis script', String(e).slice(0, 160)); }
try {
  const wC = makeMassWorld(() => Promise.reject(new Error('feed route failed')));
  wC.loadMassFeed(DATE);
  await tick();
  ok(uniCount(wC) === 1, 'C1c: a rejected feed promise appends exactly ONE Universalis script (the standing failure posture)', 'count=' + uniCount(wC));
} catch (e) { ok(false, 'C1c: failed feed → one Universalis script', String(e).slice(0, 160)); }

// C2: the first frame — paintMassScroll driven with every
// section builder stubbed to its empty shape, so the
// output carries only the scroll's own fixed lines.
try {
  const PRELUDE_C2 = [
    "var state = { tab: 'mass', mass: { date: '" + DATE + "', dateLabel: 'Wednesday, November 18, 2026', payload: { name: 'Wednesday of the Thirty-Third Week in Ordinary Time', versions: [] }, version: null, textSize: 1, preMassOpen: false, ep: 'II', penform: 'A', latin: {}, personalLang: {} } };",
    "var view = document.createElement('div'); document.body.appendChild(view);",
    "var MASS_ORDER = {}; var MASS_ROLES = {}; var MASS_SIZE_NAMES = ['Small', 'Medium', 'Large', 'Largest'];",
    "function esc(s) { return String(s == null ? '' : s); }",
    "function massFormulary() { return {}; }",
    "function massDayFlags() { return { gloria: false, creed: false }; }",
    "function massSectionHtml(n) { return '<div class=\"mass-section\">' + n + '</div>'; }",
    "function massPremassHostHtml() { return ''; } function massAntiphonHtml() { return ''; }",
    "function massLinesHtml() { return ''; } function massPenToggleHtml() { return ''; } function massPenBodyHtml() { return ''; }",
    "function massPartHtml() { return ''; } function massPrayerHtml() { return ''; } function massReadingsHtml() { return ''; }",
    "function massHomilyCardHtml() { return ''; } function massUniversalSectionHtml() { return ''; } function massEpHtml() { return ''; }",
    "function massPersonalListHtml() { return ''; } function massAcksHtml() { return ''; }",
    "function wireMassHomily() {} function wireMassLatin() {} function wireMassPen() {} function wireMassChips() {} function wireMassPersonal() {} function wireMassUniversalSection() {} function wireMassEp() {} function saveMassPrefs() {} function massPersonalLoad() {} function massUniversalLoad() {}",
  ].join('\n');
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  const s = w.document.createElement('script');
  s.textContent = PRELUDE_C2 + '\nvar MASS_ICEL_NOTICE = ' + JSON.stringify('The English translation of The Roman Missal © 2010, International Commission on English in the Liturgy Corporation. All rights reserved.') + ';\n' + SCROLL_FN;
  w.document.body.appendChild(s);
  w.paintMassScroll();
  const html = w.document.body.querySelector('.mass-scroll') ? w.document.body.querySelector('.mass-scroll').innerHTML : '';
  const notice = 'The English translation of The Roman Missal';
  const first = html.indexOf(notice);
  const occurrences = html.split(notice).length - 1;
  const dayname = html.indexOf('mass-dayname');
  ok(occurrences === 2 && first >= 0 && dayname > first,
    'C2: the ICEL notice occurs exactly twice in paintMassScroll\u2019s output, the first before the mass-dayname header',
    'occurrences=' + occurrences + ' first=' + first + ' dayname=' + dayname);
} catch (e) { ok(false, 'C2: first-frame ICEL notice', String(e).slice(0, 200)); }

console.log('harness-v608: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); for (const f of failures) console.log(' -', f); }
process.exit(fail ? 1 : 0);
