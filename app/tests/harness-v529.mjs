// harness-v529.mjs — v529 evidence: the Mass tab's
// optional-memorial readings. The USCCB feed item for a
// memorial day ends with links to the memorials' own
// readings pages; the pull never surfaced them (John,
// 2026-11-18: "The optional readings did not show up in
// mass clickable today" — approved the same morning:
// "Build everything. I approve"). After v529 the
// readings place follows the version pick: a mentioned
// memorial's own set stands when its version stands
// picked; a memorial whose page carries no set stands
// its Lectionary direction above the ferial readings.
// SUBJECT: a tree carrying the v529 build on the v527
// ship lineage. Run from that worktree's root:
//   node app/tests/harness-v529.mjs [--probe]
// Fixtures (Improvement D — every fixture from
// production, captured live 2026-11-18, in
// app/tests/fixtures-v529):
// - usccb-feed.xml: the REAL USCCB Daily Readings RSS
//   feed, fetched the morning of the build. It carries
//   2026-11-18 (two optional-memorial mentions) back
//   through 2026-11-09, incl. 2026-11-17 (the Elizabeth
//   mention) and mention-free 2026-11-15.
// - memorial-dedication.html: the REAL page at the
//   feed's own Dedication link (Lectionary 679, the
//   proper set Acts 28 / Ps 98 / Mt 14).
// - memorial-rose.html: the REAL page at the feed's own
//   Duchesne link (Lectionary 679A, the Commons
//   direction, no parts).
// - memorial-elizabeth.html: the REAL page at the
//   2026-11-17 item's own link (Lectionary 678, a
//   suggested set: 1 Jn 3 / Ps 34 / Jn 13 / Lk 6).
// The client legs are served payloads composed exactly
// as the Worker's route composes them: parseUsccbFeed
// over the real feed + parseMemorialPage over the real
// pages, merged per memorial. The Mass payloads' picker
// facts (version keys, labels, ranks, the default) are
// the production MASS_CALENDAR's own, read from the
// bundled calendar; the formularies are harness
// dressing only (the v523 precedent).
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const FIX = APP + '/tests/fixtures-v529';
const BASE = path.resolve(ROOT, '../../.worktrees/v527-ship/app/worker/src');
const ESBUILD = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const MR_SRC = readFileSync(SRC + '/mass-readings.ts', 'utf8');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const MR_BASE = readFileSync(BASE + '/mass-readings.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- helpers (the v497 mold) ---------------- */
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
function decodeEnt(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
}
function wordsOf(html) {
  const t = decodeEnt(String(html).replace(/<[^>]+>/g, ' ')).replace(/ /g, ' ');
  return t.split(/\s+/).filter(Boolean);
}
function contiguous(pageWords, partWords) {
  if (!partWords.length) return false;
  return pageWords.join(' ').includes(partWords.join(' '));
}
// The independent headed parse of a feed item, with the
// memorial link list cut first (the build's expectation:
// the list is data for the payload, not Gospel text).
function refParts(xml, dateStr) {
  const mm = dateStr.slice(5, 7), dd = dateStr.slice(8, 10), yy = dateStr.slice(2, 4);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const item = items.find((b) => b.includes('/' + mm + dd + yy + '.cfm'));
  if (!item) return null;
  const dm = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(item);
  let desc = decodeEnt(dm[1]);
  desc = desc.replace(/<ul class="nested">[\s\S]*?<\/ul>/, '');
  const heads = [];
  const re = /<h4>([\s\S]*?)<\/h4>/g; let m;
  while ((m = re.exec(desc))) {
    const inner = m[1];
    const am = /<a[^>]*>([\s\S]*?)<\/a>/.exec(inner);
    const source = am ? decodeEnt(am[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : '';
    const name = decodeEnt((am ? inner.replace(am[0], '') : inner).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    heads.push({ name, source, at: m.index, end: m.index + m[0].length });
  }
  const parts = [];
  for (let i = 0; i < heads.length; i++) {
    let body = desc.slice(heads[i].end, i + 1 < heads.length ? heads[i + 1].at : desc.length);
    const sep = body.indexOf('- - -');
    if (sep >= 0) body = body.slice(0, sep);
    body = body.trim();
    if (!wordsOf(body).length) continue;
    parts.push({ heading: heads[i].name, source: heads[i].source, html: body });
  }
  return parts;
}
function bundle(file, tag) {
  const tmp = mkdtempSync(path.join(tmpdir(), tag + '-'));
  execFileSync(ESBUILD, [file, '--bundle', '--format=cjs', '--platform=node', '--outfile=' + tmp + '/b.cjs'], { stdio: 'pipe' });
  return createRequire(tmp + '/x.js')(tmp + '/b.cjs');
}

/* ---------------- S: statics ---------------- */
{
  for (const f of ['index.ts', 'mass.ts', 'mass-calendar.ts', 'mass-order.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S1-' + f + ': byte-identical to the v527 ship');
  }
  const stripPin = (s) => s.replace(/var CACHE = "ora-pro-nobis-v[0-9]+-[0-9]+"/, 'var CACHE = "PIN"');
  ok(stripPin(U_SRC) === stripPin(U_BASE), 'S2: ui.ts differs from the v527 ship only at the SW pin');
  const migs = readdirSync(APP + '/migrations').filter((f) => f.endsWith('.sql')).sort();
  ok(migs[migs.length - 1] === '0039_mass_universal_prayer.sql', 'S3: no migration past 0039', migs.slice(-2).join(','));
  const standing = ['massLinesHtml', 'massFeedLinesHtml', 'massBackupPartHtml', 'massPartHtml',
    'massAcksHtml', 'paintMassScroll', 'paintMassReadings', 'wireMassChips', 'loadMassFeed',
    'massPersonalListHtml', 'massFormulary', 'massDayFlags', 'paintMassLiturgy', 'massOptionLabel', 'massCiteParts'];
  const drift = standing.filter((n) => extractFn(C_SRC, n) !== extractFn(C_BASE, n));
  ok(drift.length === 0, 'S4: the standing mass functions are byte-identical to the v527 ship', drift.join(','));
  ok(C_SRC.includes('function massMemorialNameKey(') && C_SRC.includes('function massPickedMemorial()')
    && C_SRC.includes('function massMemorialPartsHtml(') && C_SRC.includes("massFeedPartHtml(part, MASS_SLOT_LABELS[part.key], i, 'mem')")
    && C_SRC.includes("var ckey = (setKey ? setKey + ':' : '') + part.key + ':' + idx;"),
    'S5: the v529 client pieces stand (the name match · the picked memorial · the memorial render · the prefixed choice keys)');
  ok(MR_SRC.includes('export function parseMemorialPage') && MR_SRC.includes('Readings for the')
    && MR_SRC.includes('memorialCache') && MR_SRC.includes('payload.memorials'),
    'S6: the v529 server pieces stand (the page parser · the mentions extraction · the serve-time pull)');
}

/* ---------------- P: cooked parse (the v439 gate) ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED_BASE = null;
try { COOKED = cook(C_SRC); ok(true, 'P1: the cooked APP_JS parses (the v439 gate)'); }
catch (e) { ok(false, 'P1: the cooked APP_JS parses (the v439 gate)', String(e).slice(0, 160)); }
try { COOKED_BASE = cook(C_BASE); } catch (e) { console.log('note - base cook failed:', String(e).slice(0, 120)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const APP_CSS_BASE = U_BASE.slice(U_BASE.indexOf('APP_CSS = `') + 11, U_BASE.indexOf('`;', U_BASE.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

/* ---------------- W: the parsers over the real fixtures ---------------- */
const FEED_XML = readFileSync(FIX + '/usccb-feed.xml', 'utf8');
const PAGE_DED = readFileSync(FIX + '/memorial-dedication.html', 'utf8');
const PAGE_ROSE = readFileSync(FIX + '/memorial-rose.html', 'utf8');
const PAGE_ELIZ = readFileSync(FIX + '/memorial-elizabeth.html', 'utf8');
let mr = null, mrBase = null, cal = null;
try {
  mr = bundle(SRC + '/mass-readings.ts', 'mr529');
  ok(typeof mr.parseUsccbFeed === 'function' && typeof mr.parseMemorialPage === 'function' && typeof mr.groupFeedParts === 'function',
    'W0: mass-readings.ts bundles and exports the feed parser + the memorial page parser + the grouping');
} catch (e) { ok(false, 'W0: mass-readings.ts bundles', String(e).slice(0, 200)); }
try { mrBase = bundle(BASE + '/mass-readings.ts', 'mr529base'); } catch (e) { console.log('note - base bundle failed:', String(e).slice(0, 120)); }
try { cal = bundle(SRC + '/mass-calendar.ts', 'cal529'); } catch (e) { console.log('note - calendar bundle failed:', String(e).slice(0, 120)); }

const PAGE_BY_FILE = {
  '1118-memorial-dedication-basilica-sts-peter-paul.cfm': PAGE_DED,
  '1118-memorial-rose-philippine-duchesne.cfm': PAGE_ROSE,
  '1117-memorial-elizabeth-hungary.cfm': PAGE_ELIZ,
};
// Compose a route payload exactly as massReadingsPayload
// composes it: the feed parse, then each memorial's page
// parse merged in (the harness's pages are the fixtures
// the route would have fetched).
function routePayload(date) {
  const p = mr.parseUsccbFeed(FEED_XML, date);
  const out = { ok: true, date: p.date, found: p.found, title: p.title, parts: p.parts, copyright: p.copyright };
  if (p.memorials) {
    out.memorials = p.memorials.map((mem) => {
      const page = PAGE_BY_FILE[mem.url.split('/').pop()];
      if (!page) return mem;
      const parsed = mr.parseMemorialPage(page);
      return { ...mem, lectionary: parsed.lectionary, note: parsed.note, parts: parsed.parts };
    });
  }
  return out;
}

let P18 = null, P17 = null, P15 = null;
if (mr) {
  // Premise — the BASE parser shows the defect on today's item
  const b18 = mrBase ? mrBase.parseUsccbFeed(FEED_XML, '2026-11-18') : null;
  const bg = b18 ? b18.parts.find((p) => p.key === 'g') : null;
  ok(!!b18 && !b18.memorials && !!bg && bg.html.includes('Readings for the')
    && bg.html.includes('Optional Memorial of Dedication') && bg.html.includes('Optional Memorial of Saint Rose'),
    'W1 (premise): the base parser carries NO memorials — the mentions ride inside the Gospel body, unclickable, and the memorial readings never stand');
  // W2: today's mentions, exact
  P18 = routePayload('2026-11-18');
  ok(P18.found && Array.isArray(P18.memorials) && P18.memorials.length === 2
    && P18.memorials[0].name === 'Optional Memorial of Dedication of the Basilicas of Saints Peter and Paul, Apostles'
    && P18.memorials[0].url === 'https://bible.usccb.org/bible/readings/1118-memorial-dedication-basilica-sts-peter-paul.cfm'
    && P18.memorials[1].name === 'Optional Memorial of Saint Rose Philippine Duchesne, Virgin [In the Dioceses of the United States]'
    && P18.memorials[1].url === 'https://bible.usccb.org/bible/readings/1118-memorial-rose-philippine-duchesne.cfm',
    'W2: today carries exactly the two mentions, names and links as the feed prints them');
  const g18 = P18.parts.find((p) => p.key === 'g');
  ok(!!g18 && !g18.html.includes('Readings for the') && !g18.html.includes('nested'),
    'W3: the mentions list no longer rides inside the Gospel body');
  const ref18 = refParts(FEED_XML, '2026-11-18');
  ok(P18.parts.length === 4 && P18.parts.every((p, i) => p.heading === ref18[i].heading && p.source === ref18[i].source
    && wordsOf(p.html).join(' ') === wordsOf(ref18[i].html).join(' ')),
    'W4: the ferial parts stand word-for-word as the independent headed parse (the list cut changes nothing else)');
  ok(P18.parts.map((p) => p.source).join('|') === 'Revelation 4:1-11|Psalm 150:1b-2, 3-4, 5-6|See John 15:16|Luke 19:11-28'
    && P18.copyright.length === 1,
    'W5: today\'s ferial citations stand as the feed prints them, with the one CCD copyright line');
  // W6: 2026-11-17 — the Elizabeth mention
  P17 = routePayload('2026-11-17');
  ok(P17.found && Array.isArray(P17.memorials) && P17.memorials.length === 1
    && P17.memorials[0].name === 'Memorial of Saint Elizabeth of Hungary, Religious'
    && P17.memorials[0].url === 'https://bible.usccb.org/bible/readings/1117-memorial-elizabeth-hungary.cfm',
    'W6: 2026-11-17 carries the Elizabeth mention (an obligatory memorial mentions too)');
  ok(P17.parts.map((p) => p.source).join('|') === 'Revelation 3:1-6, 14-22|Psalm 15:2-3a, 3bc-4ab, 5|1 John 4:10b|Luke 19:1-10',
    'W7: 2026-11-17\'s ferial parts stand unchanged');
  // W8: 2026-11-15 — no mentions, v497 grouping intact
  P15 = routePayload('2026-11-15');
  const g15 = P15.parts.find((p) => p.key === 'g');
  ok(P15.found && !P15.memorials && P15.parts.length === 5 && !!g15 && !!g15.options && g15.options.length === 2,
    'W8: the mention-free Sunday parses as before — no memorials field, the Gospel long/short options grouped (v497 intact)');
  // W9–W11: the memorial pages
  const ded = mr.parseMemorialPage(PAGE_DED);
  ok(ded.lectionary === '679' && ded.note === 'The readings for this memorial are proper.',
    'W9a: the Dedication page — Lectionary 679, its direction line verbatim');
  ok(ded.parts.map((p) => p.key + '|' + p.source).join(' · ') ===
    'r1|Acts 28:11-16, 30-31 · ps|Psalm 98:1, 2-3ab, 3cd-4, 5-6 · ga|See Te Deum · g|Matthew 14:22-33',
    'W9b: the Dedication set parses whole — Acts 28 · Psalm 98 · the Te Deum acclamation · Matthew 14',
    ded.parts.map((p) => p.source).join(' | '));
  const dedWords = wordsOf(PAGE_DED);
  ok(ded.parts.every((p) => contiguous(dedWords, wordsOf(p.html))),
    'W9c: every Dedication part\'s word stream stands contiguous in its page (the verbatim rule)');
  const rose = mr.parseMemorialPage(PAGE_ROSE);
  ok(rose.lectionary === '679A' && rose.parts.length === 0
    && rose.note === 'Readings for the Memorial may be taken from the Common of Virgins, #731-736, or the Common of Holy Men and Women: For Religious, #737-742.',
    'W10: the Duchesne page — Lectionary 679A, NO parts, the Commons direction verbatim as the note');
  const eliz = mr.parseMemorialPage(PAGE_ELIZ);
  ok(eliz.lectionary === '678' && !!eliz.note && eliz.note.indexOf('Below are the readings suggested') === 0
    && eliz.parts.map((p) => p.source).join('|') === '1 John 3:14-18|Psalm 34:2-3, 4-5, 6-7, 8-9, 10-11|John 13:34|Luke 6:27-38',
    'W11: the Elizabeth page — Lectionary 678, its suggested set parses whole (1 Jn 3 · Ps 34 · Jn 13 · Lk 6)',
    eliz.parts.map((p) => p.source).join(' | '));
  // W12: copyright identity — the memorial page's CCD
  // paragraph IS the feed item's copyright line, so the
  // standing tail printing covers the memorial sets.
  const cm = PAGE_DED.match(/<p>(Lectionary for Mass for Use[\s\S]*?)<\/p>/);
  const pageCopy = cm ? decodeEnt(cm[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
  ok(!!cm && pageCopy === P18.copyright[0],
    'W12: the Dedication page\'s copyright paragraph equals the feed item\'s first copyright line, word for word');
}

/* ---------------- G439: the standing gate, as-is ---------------- */
{
  let out = '';
  try { out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stdout || ''); }
  const m = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!m && m[1] === '13' && m[2] === '2',
    'G439 (recorded as-is, not a v529 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    m ? m[0] : 'no tally line');
}

/* ---------------- C: Chromium ---------------- */
function stubFormulary(label) {
  return {
    entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
    collect: 'O God, who in ' + label + ' have given us a sign of your care, grant, we pray, that we may follow where you lead. Through our Lord Jesus Christ, your Son.',
    prayerOverOfferings: 'Accept, O Lord, the offerings we bring on this day.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
    prayerAfterCommunion: 'Nourished by this sacrament, O Lord, keep us in your service.',
  };
}
function massPayloadFor(date) {
  const e = cal.MASS_CALENDAR[date];
  return {
    ok: true, name: e.name, season: 'Ordinary Time', defaultVersion: e.default,
    versions: e.versions.map((v) => ({ key: v.key, label: v.label, rank: v.rank, formulary: stubFormulary(v.label) })),
  };
}
function dayStub(date) {
  return {
    ok: true, date, presentedDay: date, dateLabel: date,
    liturgicalDay: { name: 'Day', color: 'green' }, introTexts: {},
    blocks: [{ block: 'Morning', label: 'Morning', tracks: [
      { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
    ] }],
    episodes: [],
  };
}
function buildPage(cooked, css, scenario) {
  const DAY = dayStub(scenario.date);
  const MASS = massPayloadFor(scenario.date);
  const FEED = scenario.feed;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.__bridge = [];
window.Capacitor = { Plugins: { OraDayBridge: {
  setStatusBarColor: function (o) { window.__bridge.push({ m: 'setStatusBarColor', color: o && o.color }); return Promise.resolve({}); },
  setDaySnapshot: function () { return Promise.resolve({}); },
} } };
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push(p);
  const J = (v) => Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(v); } });
  if (p.indexOf('/api/player/day') === 0) return J(${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/day') === 0) return J(${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return J(${JSON.stringify(FEED)});
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return J({ ok: true, before: [], after: [], afterMass: [], preMass: [] });
  if (p.indexOf('/api/prayer/mass-universal-prayer') === 0) return J({ ok: true, date: ${JSON.stringify(scenario.date)}, intentions: [] });
  if (p.indexOf('/api/prayer/mass?') === 0) return J(${JSON.stringify(MASS)});
  if (p.indexOf('/api/player/podcasts') === 0) return J({ ok: true, seriesList: [] });
  if (p.indexOf('/api/exam/today') === 0) return J({ ok: true, run: null, categories: [], prompts: [], focusCategory: null });
  return J({ ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function(){ el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
HTMLMediaElement.prototype.load = function () {};
</` + `script>
<script>
${cooked}
</` + `script>
</body></html>`;
}

const FAIL18 = P18 ? { ...P18, memorials: P18.memorials.map((m) => ({ ...m, note: null, parts: [] })) } : null;
const PAGES = {
  '/d18': () => buildPage(COOKED, APP_CSS, { date: '2026-11-18', feed: P18 }),
  '/d18fail': () => buildPage(COOKED, APP_CSS, { date: '2026-11-18', feed: FAIL18 }),
  '/d17': () => buildPage(COOKED, APP_CSS, { date: '2026-11-17', feed: P17 }),
  '/d15': () => buildPage(COOKED, APP_CSS, { date: '2026-11-15', feed: P15 }),
  '/d15base': () => buildPage(COOKED_BASE, APP_CSS_BASE, { date: '2026-11-15', feed: P15 }),
};
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (PAGES[u]) { res.setHeader('Content-Type', 'text/html'); res.end(PAGES[u]()); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(which, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => { if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort(); });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note -', tag, ': mass scroll slow'));
  await sleep(900);
  return { ctx, page };
}
const readingsText = (page) => page.evaluate(() => {
  const h = document.getElementById('mass-readings');
  return h ? h.textContent : '';
});
async function pickVersion(page, key) {
  await page.click('button[data-version="' + key + '"]');
  await sleep(500);
}

/* ---- C1–C5: today, 2026-11-18 ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/d18', errs, 'c18');
  let t = await readingsText(page);
  ok(t.includes('Acts 28:11-16, 30-31') && t.includes('Matthew 14:22-33') && !t.includes('Revelation 4:1-11') && !t.includes('Luke 19:11-28'),
    'C1: the day opens on the Dedication (the calendar default) and the readings place stands HER set — Acts 28 · Matthew 14 — not the ferial set');
  ok(t.includes('Psalm 98:1, 2-3ab, 3cd-4, 5-6') && t.includes('The Lord has revealed to the nations his saving power'),
    'C2: the Dedication psalm stands with its own refrain');
  await pickVersion(page, 'ferial');
  t = await readingsText(page);
  ok(t.includes('Revelation 4:1-11') && t.includes('Luke 19:11-28') && !t.includes('Acts 28:11-16'),
    'C3: the ferial pick swaps the readings place back to the ferial set, whole');
  await pickVersion(page, 'saint-rosephilippineduchesne');
  t = await readingsText(page);
  ok(t.includes('Lectionary 679A') && t.includes('Readings for the Memorial may be taken from the Common of Virgins, #731-736')
    && t.includes('Revelation 4:1-11') && t.includes('Luke 19:11-28'),
    'C4: the Duchesne pick stands her Lectionary direction verbatim at the head of the readings place, the ferial readings beneath');
  await pickVersion(page, 'saint-dedicationofbasilicasofsaintspeterandpaul');
  t = await readingsText(page);
  ok(t.includes('Acts 28:11-16, 30-31') && t.includes('Matthew 14:22-33'),
    'C5: picking the Dedication again restores her set');
  const acks = await page.evaluate(() => {
    const a = document.getElementById('mass-acks');
    return a ? a.textContent : '';
  });
  ok((acks.match(/Confraternity of Christian Doctrine/g) || []).length === 1,
    'C6: the tail acknowledgments carry the CCD line exactly once (the memorial pages\' own copy is the same line — W12)');
  ok(errs.length === 0, 'C7: no page errors on the 2026-11-18 walk', errs.join(' | '));
  await ctx.close();
}
/* ---- C8: the failure posture ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/d18fail', errs, 'c18fail');
  const t = await readingsText(page);
  ok(t.includes('Revelation 4:1-11') && t.includes('Luke 19:11-28') && !t.includes('Acts 28:11-16'),
    'C8: a memorial entry with no parts and no note (its page pull failed) falls back to the ferial render — the day never breaks');
  await ctx.close();
}
/* ---- C9–C10: yesterday, 2026-11-17 ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/d17', errs, 'c17');
  let t = await readingsText(page);
  ok(t.includes('1 John 3:14-18') && t.includes('Luke 6:27-38') && !t.includes('Revelation 3:1-6'),
    'C9: 2026-11-17 opens on Saint Elizabeth (the calendar default) and stands HER suggested set — 1 Jn 3 · Lk 6 — not the ferial set the tab showed before v529');
  await pickVersion(page, 'ferial');
  t = await readingsText(page);
  ok(t.includes('Revelation 3:1-6, 14-22') && t.includes('Luke 19:1-10'),
    'C10: the ferial pick on 2026-11-17 restores the ferial set');
  ok(errs.length === 0, 'C11: no page errors on the 2026-11-17 walk', errs.join(' | '));
  await ctx.close();
}
/* ---- C12: the mention-free day renders identically ---- */
{
  const errs = [];
  const a = await boot('/d15', errs, 'c15build');
  const buildHtml = await a.page.evaluate(() => document.getElementById('mass-readings').innerHTML);
  const buildText = await readingsText(a.page);
  await a.ctx.close();
  const b = await boot('/d15base', errs, 'c15base');
  const baseHtml = await b.page.evaluate(() => document.getElementById('mass-readings').innerHTML);
  await b.ctx.close();
  ok(buildHtml === baseHtml && buildText.includes('Matthew 25:14-30'),
    'C12: on the mention-free Sunday the build client\'s readings place is byte-identical to the v527 client\'s (the standing render is untouched where no memorial is picked)');
}

await browser.close();
server.close();
console.log('harness-v529: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) console.log('FAILURES: ' + failures.join(' ;; '));
process.exit(fail ? 1 : 0);
