// harness-v537.mjs — v537 evidence: "The mass reading
// reverted. No pill" (John, Ora thread, 2026-11-18
// 11:31 CT; separator 11:33 CT: a complete close and
// reopen changed nothing — the stale-page half ruled
// out). Diagnosis (release doc §1): the readings path
// is byte-identical from v531 through production
// (v536) — client, route, parsers, the memorial pull.
// What was never hardened is the FEED pull: one
// unretried fetch carries the whole payload. The route
// catches its throw and answers found:false — no
// parts, NO MEMORIALS — so the readings chip (which
// renders only when the payload carries memorials)
// never stands and the client fills the day from the
// Universalis backup: the weekday set, silently. The
// feed has also moved: the standing www address now
// 301-redirects to bible.usccb.org/readings.rss, the
// publisher's canonical address, and the v531 rate
// wall stands on the feed's new home; from the
// production Worker's egress the single attempt was
// being refused persistently while the same built pull
// from this VM landed both memorials whole (twice,
// burning most of the memorial ladder both times).
// The fix gives the feed pull the v531 ladder's shape:
// spaced retries alternating the publisher's two
// addresses for the one feed, and a zero-item parse
// treated as a failed pull (the block page's
// signature) — never cached, never served. A real feed
// that lacks the viewed date still answers found:false
// at once. Serve-time pull only; the standing
// 30-minute in-isolate cache is the only cache.
// SUBJECT: a tree carrying the v537 build on the v536
// ship lineage. Run from that worktree's root:
//   node app/tests/harness-v537.mjs
// Fixtures (Improvement D — from production, captured
// live 2026-11-18, in app/tests/fixtures-v531): the
// REAL USCCB feed with today's two memorial mentions
// and the REAL Dedication (679) and Duchesne (679A)
// pages. The LIVE legs re-pull today's feed and pages
// over the live network, three times, spaced.
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const FIX = APP + '/tests/fixtures-v531';
const BASE = path.resolve(ROOT, '../../.worktrees/v536-ship/app/worker/src');
const ESBUILD = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild';
const MR_SRC = readFileSync(SRC + '/mass-readings.ts', 'utf8');
const MR_BASE = readFileSync(BASE + '/mass-readings.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
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
function bundle(file, tag) {
  const tmp = mkdtempSync(path.join(tmpdir(), tag + '-'));
  execFileSync(ESBUILD, [file, '--bundle', '--format=cjs', '--platform=node', '--outfile=' + tmp + '/b.cjs'], { stdio: 'pipe' });
  return createRequire(tmp + '/x.js')(tmp + '/b.cjs');
}

const FEED_XML = readFileSync(FIX + '/usccb-feed.xml', 'utf8');
const PAGE_DED = readFileSync(FIX + '/memorial-dedication.html', 'utf8');
const PAGE_ROSE = readFileSync(FIX + '/memorial-rose.html', 'utf8');
const BLOCK_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Access Denied</title></head><body><h1>Access Denied</h1><p>Reference #00.00000000.0000000000</p></body></html>';
const PAGE_BY_FILE = {
  '1118-memorial-dedication-basilica-sts-peter-paul.cfm': PAGE_DED,
  '1118-memorial-rose-philippine-duchesne.cfm': PAGE_ROSE,
};
const FEED_BIBLE = 'https://bible.usccb.org/readings.rss';
const FEED_WWW = 'https://www.usccb.org/bible/readings/rss/index.cfm';

/* ---------------- S: statics ---------------- */
{
  ok(MR_SRC.includes('const FEED_URLS = ["https://bible.usccb.org/readings.rss", FEED_URL]')
    && MR_SRC.includes('const FEED_RETRY_WAITS_MS = [1200, 3000, 6000, 12000]')
    && MR_SRC.includes('function feedParseIsReal(') && MR_SRC.includes('async function feedXml(')
    && MR_SRC.includes('feedCache = { xml: await feedXml(), at: now };'),
    'S1: the feed ladder stands (both publisher addresses · the spaced ladder · the zero-item gate · the payload routes through it)');
  const untouched = ['parseUsccbFeed', 'parseMemorialPage', 'groupFeedParts', 'memorialPage', 'memorialParseIsReal'];
  const drift = untouched.filter((n) => extractFn(MR_SRC, n) !== extractFn(MR_BASE, n));
  ok(drift.length === 0, 'S2: the parsers and the whole v531 memorial pull are byte-identical to the production base', drift.join(','));
  ok(readFileSync(SRC + '/client.ts', 'utf8') === readFileSync(BASE + '/client.ts', 'utf8')
    && readFileSync(SRC + '/index.ts', 'utf8') === readFileSync(BASE + '/index.ts', 'utf8'),
    'S3: client.ts and index.ts are byte-identical to the production base — the fix is one server file');
  const stripPin = (s) => s.replace(/var CACHE = "ora-pro-nobis-v[0-9]+-[0-9]+"/, 'var CACHE = "PIN"');
  ok(stripPin(readFileSync(SRC + '/ui.ts', 'utf8')) === stripPin(readFileSync(BASE + '/ui.ts', 'utf8')),
    'S4: ui.ts differs from the production base only at the SW pin');
  const migs = readdirSync(APP + '/migrations').filter((f) => f.endsWith('.sql')).sort();
  ok(migs[migs.length - 1].startsWith('0040'), 'S5: no migration past 0040', migs.slice(-2).join(','));
}

/* ---------------- F: the feed pull, against the wall's shape ---------------- */
const realFetch = globalThis.fetch;
const servePage = (html) => ({ ok: true, status: 200, text: async () => html });
const serve403 = () => ({ ok: false, status: 403, text: async () => BLOCK_HTML });
// feedHandler(url, n) decides each feed response; pages always land whole.
function stubAll(feedHandler, record) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u === FEED_BIBLE || u === FEED_WWW) { record.push(u === FEED_BIBLE ? 'bible' : 'www'); return feedHandler(u, record.length); }
    const file = u.split('/').pop();
    if (PAGE_BY_FILE[file]) return servePage(PAGE_BY_FILE[file]);
    throw new Error('unstubbed fetch: ' + u);
  };
}
// F0 (premise): the PRODUCTION base pull under a walled
// feed — one attempt, a throw, and the route's catch is
// the found:false payload John saw: no parts, no
// memorials, no chip. Reproduced end-to-end.
try {
  const mrBase = bundle(BASE + '/mass-readings.ts', 'mr537base');
  const record = [];
  stubAll(async () => serve403(), record);
  let threw = false;
  try { await mrBase.massReadingsPayload('2026-11-18'); } catch { threw = true; }
  ok(threw && record.length === 1 && record[0] === 'www',
    'F0 (premise): the production feed pull under the wall makes ONE attempt and throws — the route catch answers found:false, no memorials, no chip', 'fetches=' + record.join(','));
} catch (e) { ok(false, 'F0 (premise): the production feed pull under the wall', String(e).slice(0, 160)); }
// F1: the wall refuses the canonical address first;
// the ladder walks to the standing www address and the
// payload lands whole.
try {
  const mrA = bundle(SRC + '/mass-readings.ts', 'mr537a');
  const record = [];
  stubAll(async (u) => (u === FEED_BIBLE ? serve403() : servePage(FEED_XML)), record);
  const p = await mrA.massReadingsPayload('2026-11-18');
  const ded = (p.memorials || [])[0] || {};
  const rose = (p.memorials || [])[1] || {};
  ok(record.join(',') === 'bible,www' && p.found && (p.memorials || []).length === 2
    && ded.lectionary === '679' && ded.parts.some((x) => x.source === 'Acts 28:11-16, 30-31')
    && rose.lectionary === '679A' && !!rose.note,
    'F1: a refused first feed attempt is retried on the publisher\'s other address — the payload lands whole, both memorials standing', 'fetches=' + record.join(','));
} catch (e) { ok(false, 'F1: feed retry across the publisher addresses', String(e).slice(0, 160)); }
// F2: a 200 block body (zero items) on every attempt is
// a failed pull: the ladder burns fully, the payload
// throws (the route posture), and nothing is cached —
// a second call burns the full ladder again.
try {
  const mrB = bundle(SRC + '/mass-readings.ts', 'mr537b');
  const record = [];
  stubAll(async () => servePage(BLOCK_HTML), record);
  let threw1 = false, threw2 = false;
  try { await mrB.massReadingsPayload('2026-11-18'); } catch { threw1 = true; }
  const n1 = record.length;
  try { await mrB.massReadingsPayload('2026-11-18'); } catch { threw2 = true; }
  ok(threw1 && threw2 && n1 === 5 && record.length === 10,
    'F2: a zero-item feed body is never served and never cached — five spaced attempts per call, then the throw', 'fetches=' + record.length);
} catch (e) { ok(false, 'F2: zero-item feed handling', String(e).slice(0, 160)); }
// F3: a real feed that does not carry the viewed date
// answers found:false at once — the ladder does not
// burn on a healthy pull.
try {
  const mrC = bundle(SRC + '/mass-readings.ts', 'mr537c');
  const record = [];
  stubAll(async () => servePage(FEED_XML), record);
  const p = await mrC.massReadingsPayload('2026-12-25');
  ok(p.found === false && record.length === 1,
    'F3: a real feed without the viewed date answers found:false on the first attempt, exactly as before', 'fetches=' + record.length);
} catch (e) { ok(false, 'F3: date-absent feed posture', String(e).slice(0, 160)); }
// F4: network throws mid-ladder are ridden like
// refusals — the third attempt lands the payload.
try {
  const mrD = bundle(SRC + '/mass-readings.ts', 'mr537d');
  const record = [];
  stubAll(async (u, n) => { if (n <= 2) throw new Error('network reset'); return servePage(FEED_XML); }, record);
  const p = await mrD.massReadingsPayload('2026-11-18');
  ok(p.found && (p.memorials || []).length === 2 && record.length === 3,
    'F4: thrown feed fetches are retried on the ladder — the third attempt lands, both memorials standing', 'fetches=' + record.length);
} catch (e) { ok(false, 'F4: feed network-error tolerance', String(e).slice(0, 160)); }
globalThis.fetch = realFetch;

/* ---------------- LIVE: the built pull over the live network, ×3 spaced ---------------- */
for (let run = 1; run <= 3; run++) {
  try {
    const mrL = bundle(SRC + '/mass-readings.ts', 'mr537live' + run);
    const p = await mrL.massReadingsPayload('2026-11-18');
    const ded = (p.memorials || [])[0] || {};
    const rose = (p.memorials || [])[1] || {};
    ok(p.found && ded.lectionary === '679' && ded.parts.some((x) => x.source === 'Acts 28:11-16, 30-31')
      && ded.parts.some((x) => x.source === 'Psalm 98:1, 2-3ab, 3cd-4, 5-6') && ded.parts.some((x) => x.source === 'Matthew 14:22-33')
      && rose.lectionary === '679A' && !!rose.note && rose.note.includes('Common of Virgins'),
      'L' + run + ' (LIVE): the built pull over the live network lands both memorials whole — 679 Acts 28 · Psalm 98 · Matthew 14, and the 679A Commons direction');
  } catch (e) { ok(false, 'L' + run + ' (LIVE): the built pull over the live network', String(e).slice(0, 200)); }
  if (run < 3) await sleep(20000);
}

/* ---------------- G439: the standing gate, as-is ---------------- */
{
  let out = '';
  try { out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stdout || ''); }
  const m = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!m && m[1] === '13' && m[2] === '2',
    'G439 (recorded as-is, not a v537 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    m ? m[0] : 'no tally line');
}

console.log('harness-v537: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures:'); for (const f of failures) console.log(' -', f); }
process.exit(fail ? 1 : 0);
