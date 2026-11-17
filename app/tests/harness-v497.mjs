// harness-v497.mjs — v497 evidence: alternative readings
// in the Mass scroll gain a scrollable one-row chip strip
// (John's design, main chat 2026-11-17 08:38–08:43 CT:
// "It would be nice to toggle through alternative
// readings" · "Make it a scrollable one row chip. It will
// come in handy for long readings" · chips labeled by the
// option's citation in USCCB's short form, Long form /
// Short form for one passage's two forms).
// SUBJECT: a tree carrying the v497 build on the v496 ship
// lineage. Run from that worktree's root:
//   node app/tests/harness-v497.mjs [--probe]
// Fixtures (Improvement D — every fixture from production,
// captured 2026-11-17, in app/tests/fixtures-v497):
// - usccb-feed-2026-11-17.xml: the live USCCB Daily
//   Readings RSS feed, captured ~08:47 CT from
//   bible.usccb.org/readings.rss (the feed's own redirect
//   target); byte-identical to the v490 capture from the
//   canonical host the same morning (61,778 bytes). It
//   carries 2026-11-17 back through 2026-11-08. Sunday
//   2026-11-15 carries the Gospel long/short forms under
//   an "Or" heading; Sunday 2026-11-08 carries Reading
//   2's short form under an "or" heading.
// - usccb-page-2026-11-15.html / usccb-page-2026-11-08.html:
//   the USCCB readings pages for those Sundays — the
//   verbatim witnesses (each option's word stream must
//   stand contiguous in its date's page).
// - usccb-page-2026-11-02-allsouls.html: the All Souls
//   readings page (outside the feed window; a tests-tree
//   fixture only, never serving data) — Reading II Romans
//   5:5-11 with "Or:" Romans 6:3-9, a different-passage
//   alternate; proves the seam, the citation chip labels,
//   and the many-options geometry on production text.
// - universalis-20261117.json: the real Universalis JSONP
//   payload for 2026-11-17 (the v490 capture) — the backup
//   interplay leg.
// Derived fixtures (named, string surgery on the real
// feed, the v490 precedent): the 2026-11-15 item with its
// "Or" heading renamed "Alternative" (the safety rule:
// unrecognized seam renders whole) and renamed "Gospel"
// (the repeated-heading seam); the 2026-11-17 payload with
// its Gospel part removed (the backup-fill leg).
import { readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const FIX = APP + '/tests/fixtures-v497';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const MR_SRC = readFileSync(SRC + '/mass-readings.ts', 'utf8');
const BASE = path.resolve(process.cwd(), '../../.worktrees/v496-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- helpers ---------------- */
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
  const hay = pageWords.join(' '), needle = partWords.join(' ');
  return hay.includes(needle);
}
// The independent headed parse of a feed item — the
// reference the parser's output is checked against (the
// standing headed split, no grouping).
function refParts(xml, dateStr) {
  const mm = dateStr.slice(5, 7), dd = dateStr.slice(8, 10), yy = dateStr.slice(2, 4);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const item = items.find((b) => b.includes('/' + mm + dd + yy + '.cfm'));
  if (!item) return null;
  const dm = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(item);
  const desc = decodeEnt(dm[1]);
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

/* ---------------- S: statics ---------------- */
{
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-calendar.ts', 'index.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S1-' + f + ': byte-identical to the v496 ship');
  }
  const standing = ['massLineHtml', 'massFeedLinesHtml', 'massBackupPartHtml', 'massPartHtml',
    'massOrderHtml', 'massLatinHtml', 'massPersonalHtml', 'paintMassPersonal', 'wireMassPersonal',
    'wireMassLatin', 'massAcksHtml', 'paintMassAcks', 'massEpSeg', 'massVersionSeg', 'massTextSeg'];
  const drift = standing.filter((n) => extractFn(C_SRC, n) !== extractFn(C_BASE, n));
  ok(drift.length === 0, 'S2: the standing mass functions are byte-identical to the v496 ship', drift.join(','));
  const pms = extractFn(C_SRC, 'paintMassScroll'), pmsB = extractFn(C_BASE, 'paintMassScroll');
  ok(pms && pms.replace('  wireMassChips();\n', '') === pmsB,
    'S3: paintMassScroll differs only by the added wireMassChips() call');
  const pml = extractFn(C_SRC, 'paintMassLiturgy'), pmlB = extractFn(C_BASE, 'paintMassLiturgy');
  ok(pml && pml.replace('rchoices: {}, ', '') === pmlB,
    'S4: paintMassLiturgy differs only by the rchoices seat in state.mass');
  ok(C_SRC.includes("massFeedPartHtml(part, MASS_SLOT_LABELS[part.key], i)") && C_SRC.includes('massFeedPartHtml(part, null, i)'),
    'S5: massReadingsHtml passes each part its index to the renderer');
  ok(C_SRC.includes('function wireMassChips()') && C_SRC.includes('data-rchoice') && C_SRC.includes("'Long form'") && C_SRC.includes("'Short form'") && C_SRC.includes('MASS_BOOK_ABBR') && C_SRC.includes('mass-chips'),
    'S6: the v497 client pieces stand (wireMassChips · data-rchoice · Long/Short form · the book table · mass-chips)');
  const stripPin = (s) => s.replace(/var CACHE = "ora-pro-nobis-v[0-9]+-[0-9]+"/, 'var CACHE = "PIN"');
  const chipsBlock = '.mass-chips { width: 100%; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -webkit-overflow-scrolling: touch; }\n.mass-chips::-webkit-scrollbar { display: none; }\n';
  ok(stripPin(U_SRC).replace(chipsBlock, '') === stripPin(U_BASE),
    'S7: ui.ts differs from the v496 ship only at the pin and the .mass-chips block');
  ok(MR_SRC.includes('export function groupFeedParts') && MR_SRC.includes('export function isOrHeading') && MR_SRC.includes('out.parts = groupFeedParts(rawParts);'),
    'S8: the parser carries the grouping pass and parseUsccbFeed runs it');
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

/* ---------------- W: the parser over the real feed ---------------- */
const FEED_XML = readFileSync(FIX + '/usccb-feed-2026-11-17.xml', 'utf8');
const PAGE_1115 = readFileSync(FIX + '/usccb-page-2026-11-15.html', 'utf8');
const PAGE_1108 = readFileSync(FIX + '/usccb-page-2026-11-08.html', 'utf8');
const PAGE_SOULS = readFileSync(FIX + '/usccb-page-2026-11-02-allsouls.html', 'utf8');
let mr = null;
try {
  const tmp = mkdtempSync(path.join(tmpdir(), 'mr497-'));
  execFileSync('/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
    [SRC + '/mass-readings.ts', '--bundle', '--format=cjs', '--platform=node', '--outfile=' + tmp + '/mr.cjs'], { stdio: 'pipe' });
  mr = createRequire(tmp + '/x.js')(tmp + '/mr.cjs');
  ok(typeof mr.parseUsccbFeed === 'function' && typeof mr.groupFeedParts === 'function', 'W0: mass-readings.ts bundles and exports the parser + grouping');
} catch (e) { ok(false, 'W0: mass-readings.ts bundles', String(e).slice(0, 200)); }

let FEED_1117 = null, FEED_1115 = null, FEED_1108 = null, SOULS_PARTS = null;
if (mr) {
  FEED_1117 = mr.parseUsccbFeed(FEED_XML, '2026-11-17');
  FEED_1115 = mr.parseUsccbFeed(FEED_XML, '2026-11-15');
  FEED_1108 = mr.parseUsccbFeed(FEED_XML, '2026-11-08');
  // W1: a no-options day parses exactly as the standing headed split
  const ref17 = refParts(FEED_XML, '2026-11-17');
  ok(FEED_1117.found && FEED_1117.parts.length === 4 && FEED_1117.parts.every((p) => !p.options),
    'W1a: 2026-11-17 parses to 4 parts, no options anywhere');
  ok(FEED_1117.parts.every((p, i) => p.heading === ref17[i].heading && p.source === ref17[i].source && wordsOf(p.html).join(' ') === wordsOf(ref17[i].html).join(' ')),
    'W1b: 2026-11-17 parts equal the independent headed parse (heading · citation · word stream)');
  ok(FEED_1117.copyright && FEED_1117.copyright.length === 1, 'W1c: the one CCD copyright line rides the payload');
  // W2: Sunday 2026-11-15 — the Gospel long/short forms
  const ref15 = refParts(FEED_XML, '2026-11-15');
  const g15 = FEED_1115.parts.find((p) => p.key === 'g');
  ok(FEED_1115.found && FEED_1115.parts.length === 5 && ref15.length === 6,
    'W2a: 2026-11-15 groups 6 headed parts into 5 logical parts');
  ok(g15 && g15.options && g15.options.length === 2 && g15.options[0].source === 'Matthew 25:14-30' && g15.options[1].source === 'Matthew 25:14-15, 19-21',
    'W2b: the Gospel carries 2 options — the long form, then the short form', g15 && g15.options ? g15.options.map((o) => o.source).join(' | ') : 'none');
  ok(g15 && g15.options[0].source === g15.source && g15.options[0].html === g15.html,
    'W2c: options[0] is the part itself (the payload stays back-compatible)');
  const pageWords15 = wordsOf(PAGE_1115);
  ok(g15 && g15.options.every((o) => contiguous(pageWords15, wordsOf(o.html))),
    'W2d: each Gospel option\'s word stream stands contiguous in the 2026-11-15 readings page (the verbatim rule, per option)');
  const sumGrouped15 = FEED_1115.parts.reduce((n, p) => n + wordsOf(p.options ? p.options.map((o) => o.html).join(' ') : p.html).length, 0);
  const sumRef15 = ref15.reduce((n, p) => n + wordsOf(p.html).length, 0);
  ok(sumGrouped15 === sumRef15, 'W2e: word conservation — the grouped day carries every word of the headed parse', sumGrouped15 + ' vs ' + sumRef15);
  ok(g15 && wordsOf(g15.options[1].html).join(' ') === wordsOf(ref15[5].html).join(' '),
    'W2f: the short-form option is the "Or" headed part, word for word');
  // W3: Sunday 2026-11-08 — Reading 2's short form, lowercase "or"
  const r2 = FEED_1108.parts.find((p) => p.key === 'r2');
  const pageWords08 = wordsOf(PAGE_1108);
  ok(r2 && r2.options && r2.options.length === 2 && r2.options[0].source === '1 Thessalonians 4:13-18' && r2.options[1].source === '1 Thessalonians 4:13-14',
    'W3a: 2026-11-08 Reading 2 carries 2 options (the lowercase "or" heading groups)', r2 && r2.options ? r2.options.map((o) => o.source).join(' | ') : 'none');
  ok(r2 && r2.options.every((o) => contiguous(pageWords08, wordsOf(o.html))),
    'W3b: each Reading 2 option\'s word stream stands contiguous in the 2026-11-08 page');
  ok(FEED_1108.parts.filter((p) => p.options).length === 1, 'W3c: no other part on 2026-11-08 carries options');
  // W4: a date outside the feed window
  const absent = mr.parseUsccbFeed(FEED_XML, '2026-11-02');
  ok(absent.found === false && absent.parts.length === 0, 'W4: 2026-11-02 is outside the feed window — found:false, the backup route\'s seat');
  // W5: THE SAFETY RULE — the Or heading renamed (derived)
  const item15 = [...FEED_XML.matchAll(/<item>[\s\S]*?<\/item>/g)].map((m) => m[0]).find((s) => s.includes('/111526.cfm'));
  const altItem = item15.replace('&lt;h4&gt;Or  ', '&lt;h4&gt;Alternative  ');
  ok(altItem !== item15, 'W5a: the derived safety fixture renames the real "Or" heading inside the 2026-11-15 item');
  const safe = mr.parseUsccbFeed(FEED_XML.replace(item15, altItem), '2026-11-15');
  const sumSafe = safe.parts.reduce((n, p) => n + wordsOf(p.html).length, 0);
  ok(safe.parts.length === 6 && safe.parts.every((p) => !p.options) && safe.parts.some((p) => p.heading === 'Alternative'),
    'W5b: an unrecognized alternate heading renders whole — 6 parts stand under their own headings, no options grouped');
  ok(sumSafe === sumRef15, 'W5c: the safety render loses no words', sumSafe + ' vs ' + sumRef15);
  // W6: the repeated-heading seam (derived) — "Or" renamed "Gospel"
  const repItem = item15.replace('&lt;h4&gt;Or  ', '&lt;h4&gt;Gospel  ');
  const rep = mr.parseUsccbFeed(FEED_XML.replace(item15, repItem), '2026-11-15');
  const grep2 = rep.parts.filter((p) => p.key === 'g');
  ok(rep.parts.length === 5 && grep2.length === 1 && grep2[0].options && grep2[0].options.length === 2 && grep2[0].options[1].source === 'Matthew 25:14-15, 19-21',
    'W6: an alternate under a repeated heading groups as an option of that part');
  // W7: All Souls — the page's headed parts through the grouping
  const pageKey = (h) => { const x = h.toLowerCase(); if (/^reading\s+(1|i)\b/.test(x)) return 'r1'; if (/^responsorial psalm/.test(x)) return 'ps'; if (/^reading\s+(2|ii)\b/.test(x)) return 'r2'; if (/^alleluia/.test(x)) return 'ga'; if (/^gospel/.test(x)) return 'g'; return 'extra'; };
  const heads = [...PAGE_SOULS.matchAll(/<h3 class="name">([\s\S]*?)<\/h3>/g)];
  const rawSouls = [];
  for (let i = 0; i < heads.length; i++) {
    const from = heads[i].index + heads[i][0].length;
    const to = i + 1 < heads.length ? PAGE_SOULS.lastIndexOf('<header', heads[i + 1].index) : PAGE_SOULS.length;
    const seg = PAGE_SOULS.slice(from, to > from ? to : PAGE_SOULS.length);
    const addr = /<p class="address">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/.exec(seg);
    const source = addr ? decodeEnt(addr[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : '';
    let body = addr ? seg.slice(addr.index + addr[0].length) : seg;
    body = body.replace(/^\s*<\/p>\s*<\/header>/, '');
    const cut = body.lastIndexOf('</p>');
    if (cut >= 0) body = body.slice(0, cut + 4);
    const name = decodeEnt(heads[i][1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    rawSouls.push({ key: pageKey(name), heading: name, source, html: body.trim() });
  }
  ok(rawSouls.length === 6 && rawSouls.map((p) => p.heading).join('|') === 'Reading I|Responsorial Psalm|Reading II|Or:|Alleluia|Gospel',
    'W7a: the All Souls page yields its 6 headed parts mechanically', rawSouls.map((p) => p.heading).join('|'));
  SOULS_PARTS = mr.groupFeedParts(rawSouls);
  const sr2 = SOULS_PARTS.find((p) => p.key === 'r2');
  ok(SOULS_PARTS.length === 5 && sr2 && sr2.options && sr2.options.length === 2 && sr2.options[0].source === 'Romans 5:5-11' && sr2.options[1].source === 'Romans 6:3-9',
    'W7b: the grouping folds the "Or:" alternate into Reading II — Rom 5:5-11 | Rom 6:3-9', sr2 && sr2.options ? sr2.options.map((o) => o.source).join(' | ') : 'none');
  const pageWordsSouls = wordsOf(PAGE_SOULS);
  ok(SOULS_PARTS.every((p) => (p.options || [{ html: p.html }]).every((o) => contiguous(pageWordsSouls, wordsOf(o.html)))),
    'W7c: every All Souls part and option stands contiguous in the page (verbatim)');
  const sumSoulsGrouped = SOULS_PARTS.reduce((n, p) => n + (p.options || [{ html: p.html }]).reduce((m, o) => m + wordsOf(o.html).length, 0), 0);
  const sumSoulsRaw = rawSouls.reduce((n, p) => n + wordsOf(p.html).length, 0);
  ok(sumSoulsGrouped === sumSoulsRaw, 'W7d: All Souls word conservation across the grouping', sumSoulsGrouped + ' vs ' + sumSoulsRaw);
}

/* ---------------- C: Chromium ---------------- */
const DAY = {
  ok: true, date: '2026-11-17', presentedDay: '2026-11-17',
  dateLabel: 'Tuesday, November 17, 2026',
  liturgicalDay: { name: 'Memorial of Saint Elizabeth of Hungary, Religious', color: 'white' },
  introTexts: {},
  blocks: [{ block: 'Morning', label: 'Morning', tracks: [
    { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
  ] }],
  episodes: [],
};
const MASS_PAYLOAD = {
  ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary',
  defaultVersion: 'elizabeth',
  versions: [{ key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: {
    entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
    collect: 'O God, who made the Memorial of Saint Elizabeth a sign of your care, grant, we pray, that we may follow her example. Through our Lord Jesus Christ, your Son.',
    prayerOverOfferings: 'Accept, O Lord, the offerings we bring in honor of Saint Elizabeth.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
    prayerAfterCommunion: 'Nourished by this sacrament, O Lord, may we imitate Saint Elizabeth in charity.',
  } }],
};
function feedPayload(parsed) {
  return { ok: true, found: parsed.found, date: parsed.date, source: 'usccb-feed', copyright: parsed.copyright || [], parts: parsed.parts };
}
function buildPage(cooked, css, feed) {
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
  if (p.indexOf('/api/prayer/mass?') === 0) return J(${JSON.stringify(MASS_PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return J(${JSON.stringify(feed)});
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

const UNI_JSON = readFileSync(FIX + '/universalis-20261117.json', 'utf8');
const FEED_NOG = FEED_1117 ? { ...FEED_1117, parts: FEED_1117.parts.filter((p) => p.key !== 'g') } : null;
const PAGES = {
  '/d15': () => buildPage(COOKED, APP_CSS, feedPayload(FEED_1115)),
  '/d08': () => buildPage(COOKED, APP_CSS, feedPayload(FEED_1108)),
  '/d17': () => buildPage(COOKED, APP_CSS, feedPayload(FEED_1117)),
  '/souls': () => buildPage(COOKED, APP_CSS, { ok: true, found: true, date: '2026-11-02', source: 'usccb-page', copyright: [], parts: SOULS_PARTS }),
  '/base17': () => buildPage(COOKED_BASE, APP_CSS_BASE, feedPayload(FEED_1117)),
  '/nog': () => buildPage(COOKED, APP_CSS, feedPayload(FEED_NOG)),
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

async function boot(which, errs, tag, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => { if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort(); });
  if (opts.universalis) {
    // page routes take precedence over context routes, and
    // within the page the last registered matches first —
    // the catch-all goes on first, the Universalis
    // fulfillment second, so the JSONP script is answered
    // with the real payload instead of aborted.
    await page.route('**/*', (route) => { if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort(); });
    await page.route('**universalis.com**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'universalisCallback(' + opts.universalis + ');' }));
  }
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note -', tag, ': mass scroll slow'));
  await sleep(900);
  return { ctx, page };
}
// Split the readings host into per-part segments at the
// .mass-h boundaries, for unmoved-part comparisons. Kept
// as a source string so legs can run it inside an
// evaluate closure.
const SEGMENTS_SRC = `function SEGMENTS() {
  const host = document.getElementById('mass-readings');
  if (!host) return null;
  const segs = [];
  let cur = null;
  for (const el of host.children) {
    if (el.classList.contains('mass-h')) { cur = { head: el.textContent.trim(), html: '' }; segs.push(cur); }
    if (cur) cur.html += el.outerHTML;
  }
  return segs;
}`;
const SEGMENTS = '(' + SEGMENTS_SRC + ')()';

/* ---- C1 + C3: Sunday 2026-11-15, the Gospel strip ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/d15', errs, 'c15');
  const read = () => page.evaluate(() => {
    const host = document.getElementById('mass-readings');
    const strips = host ? host.querySelectorAll('.mass-chips') : [];
    const strip = strips[0];
    return {
      stripCount: strips.length,
      labels: strip ? Array.from(strip.querySelectorAll('button')).map((b) => b.textContent.trim()) : [],
      onIdx: strip ? Array.from(strip.querySelectorAll('button')).findIndex((b) => b.classList.contains('on')) : -1,
      text: host ? host.textContent : '',
    };
  });
  const before = await read();
  const segsBefore = await page.evaluate(SEGMENTS);
  ok(before.stripCount === 1, 'C1a: on 2026-11-15 exactly one chip strip stands (the Gospel\'s)', String(before.stripCount));
  ok(JSON.stringify(before.labels) === JSON.stringify(['Long form', 'Short form']),
    'C1b: the chips read Long form · Short form (USCCB\'s own names for one passage\'s forms)', before.labels.join(' | '));
  ok(before.onIdx === 0 && before.text.includes('wicked, lazy servant'),
    'C1c: the default is the first-printed option — the long form stands (its verse-26 line present)');
  // geometry at phone width: the strip takes its line, one row
  const geo = await page.evaluate(() => {
    const strip = document.querySelector('#mass-readings .mass-chips');
    const btns = Array.from(strip.querySelectorAll('button'));
    return { tops: btns.map((b) => b.offsetTop), docSW: document.documentElement.scrollWidth, iw: window.innerWidth };
  });
  ok(new Set(geo.tops).size === 1, 'C1d: the chips stand in ONE row (no wrap)', JSON.stringify(geo.tops));
  ok(geo.docSW <= geo.iw + 1, 'C1e: the page itself does not scroll sideways', geo.docSW + ' vs ' + geo.iw);
  // tap Short form
  await page.click('#mass-readings .mass-chips button:nth-child(2)');
  await sleep(400);
  const after = await read();
  const segsAfter = await page.evaluate(SEGMENTS);
  const gAfter = segsAfter.find((s) => s.head === 'Gospel');
  ok(after.onIdx === 1 && !after.text.includes('wicked, lazy servant') && gAfter.html.includes('Matthew 25:14-15, 19-21'),
    'C3a: a tap on Short form swaps the Gospel — the short citation stands, the long-only lines are gone');
  ok(gAfter.html.includes('The Gospel of the Lord.') && gAfter.html.includes('Praise to you, Lord Jesus Christ.'),
    'C3b: the closing stands under the swapped option');
  const unmoved = segsBefore.filter((s) => s.head !== 'Gospel').every((s) => { const t = segsAfter.find((x) => x.head === s.head); return t && t.html === s.html; });
  ok(unmoved, 'C3c: every other part\'s HTML is unmoved by the swap');
  // tap back
  await page.click('#mass-readings .mass-chips button:nth-child(1)');
  await sleep(400);
  const back = await read();
  const segsBack = await page.evaluate(SEGMENTS);
  ok(back.onIdx === 0 && back.text.includes('wicked, lazy servant') && JSON.stringify(segsBack) === JSON.stringify(segsBefore),
    'C3d: tapping Long form restores the first render exactly');
  ok(errs.length === 0, 'F1: no page errors on the 2026-11-15 legs', errs.join(' ; '));
  await ctx.close();
}

/* ---- C4: Sunday 2026-11-08, the Reading 2 strip ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/d08', errs, 'c08');
  const info = await page.evaluate(() => {
    const host = document.getElementById('mass-readings');
    const strips = host.querySelectorAll('.mass-chips');
    return { n: strips.length, labels: strips[0] ? Array.from(strips[0].querySelectorAll('button')).map((b) => b.textContent.trim()) : [], text: host.textContent };
  });
  ok(info.n === 1 && JSON.stringify(info.labels) === JSON.stringify(['Long form', 'Short form']) && info.text.includes('rise first'),
    'C4a: on 2026-11-08 the Reading 2 strip stands with Long/Short chips, the long form default', info.labels.join(' | '));
  await page.click('#mass-readings .mass-chips button:nth-child(2)');
  await sleep(400);
  const after = await page.evaluate('(() => { const SEGMENTS = ' + SEGMENTS_SRC + '; const segs = SEGMENTS(); const r2 = segs.find((s) => s.head === \'Second Reading\'); return { r2: r2 ? r2.html : \'\', text: document.getElementById(\'mass-readings\').textContent }; })()');
  ok(after.r2.includes('1 Thessalonians 4:13-14') && !after.text.includes('rise first') && after.r2.includes('The word of the Lord.'),
    'C4b: the short form swaps in — its citation stands, the long-only line is gone, the closing stands');
  ok(errs.length === 0, 'F2: no page errors on the 2026-11-08 legs', errs.join(' ; '));
  await ctx.close();
}

/* ---- C5: All Souls — the citation chips ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/souls', errs, 'souls');
  const info = await page.evaluate(() => {
    const host = document.getElementById('mass-readings');
    const strips = host.querySelectorAll('.mass-chips');
    const strip = strips[0];
    const btns = strip ? Array.from(strip.querySelectorAll('button')) : [];
    return {
      n: strips.length,
      labels: btns.map((b) => b.textContent.trim()),
      text: host.textContent,
    };
  });
  ok(info.n === 1 && JSON.stringify(info.labels) === JSON.stringify(['Rom 5:5-11', 'Rom 6:3-9']),
    'C5a: the All Souls Reading II chips carry the citations in short form', info.labels.join(' | '));
  ok(info.text.includes('Hope does not disappoint'), 'C5b: the first-printed option (Romans 5) stands by default');
  await page.click('#mass-readings .mass-chips button:nth-child(2)');
  await sleep(400);
  const after = await page.evaluate('(() => { const SEGMENTS = ' + SEGMENTS_SRC + '; const segs = SEGMENTS(); const r2 = segs.find((s) => s.head === \'Second Reading\'); return r2 ? r2.html : \'\'; })()');
  ok(after.includes('Romans 6:3-9') && after.includes('baptized into Christ Jesus') && !after.includes('Hope does not disappoint'),
    'C5c: tapping Rom 6:3-9 swaps Reading II to the alternate, verbatim from the page');
  ok(errs.length === 0, 'F3: no page errors on the All Souls legs', errs.join(' ; '));
  await ctx.close();
}

/* ---- C2: the strip geometry at a narrow width ----
   Probed firsthand before asserting: at 180px the two
   All Souls chips (171px of content) exceed the strip's
   152px line, so the strip scrolls internally; the
   readings column itself never overflows; and the page's
   own sideways floor at narrow widths (248px at 240,
   247px at 180) is the v496 ship's too — the shell's
   standing floor, not the strip's doing. */
{
  const errs = [];
  const n = await boot('/souls', errs, 'c2-new', { viewport: { width: 180, height: 700 } });
  const g = await n.page.evaluate(() => {
    const strip = document.querySelector('#mass-readings .mass-chips');
    const host = document.getElementById('mass-readings');
    const btns = strip ? Array.from(strip.querySelectorAll('button')) : [];
    return {
      stripSW: strip ? strip.scrollWidth : 0, stripCW: strip ? strip.clientWidth : 0,
      hostSW: host ? host.scrollWidth : 0, hostCW: host ? host.clientWidth : 0,
      tops: btns.map((b) => b.offsetTop),
      docSW: document.documentElement.scrollWidth,
    };
  });
  ok(g.stripSW > g.stripCW + 4, 'C2a: at a narrow width the strip scrolls sideways inside its line (scrollWidth exceeds clientWidth)', g.stripSW + ' vs ' + g.stripCW);
  ok(new Set(g.tops).size === 1 && g.tops.length === 2, 'C2b: the strip stays ONE row at the narrow width (never wraps)', JSON.stringify(g.tops));
  ok(g.hostSW <= g.hostCW + 1 && g.stripCW <= g.hostCW, 'C2c: the strip stays inside its line — the readings column gains no sideways overflow', 'host ' + g.hostSW + '/' + g.hostCW + ' · strip ' + g.stripCW);
  const b = await boot('/base17', errs, 'c2-base', { viewport: { width: 180, height: 700 } });
  const baseSW = await b.page.evaluate(() => document.documentElement.scrollWidth);
  ok(g.docSW <= baseSW + 1, 'C2d: at the narrow width the page scrolls sideways no more than the v496 ship does (the shell floor is standing, not the strip)', g.docSW + ' vs base ' + baseSW);
  ok(errs.length === 0, 'F3b: no page errors on the geometry legs', errs.join(' ; '));
  await n.ctx.close(); await b.ctx.close();
}

/* ---- C6: a no-options day renders byte-identical to the v496 ship ---- */
{
  const errs = [];
  const a = await boot('/d17', errs, 'c17-new');
  const b = await boot('/base17', errs, 'c17-base');
  const hNew = await a.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const hBase = await b.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const chips = await a.page.evaluate(() => document.querySelectorAll('.mass-chips').length);
  ok(chips === 0, 'C6a: no chip strip stands on a no-options day');
  ok(hNew && hBase && hNew === hBase, 'C6b: the 2026-11-17 Mass scroll is byte-identical to the v496 ship\'s render');
  ok(errs.length === 0, 'F4: no page errors on the identity legs', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

/* ---- C7: the v488 stepper governs the text; the chips stay control-sized ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/d15', errs, 'c7');
  const sizes = () => page.evaluate(() => {
    const line = document.querySelector('#mass-readings .mass-line');
    const chip = document.querySelector('#mass-readings .mass-chips button');
    return { line: line ? getComputedStyle(line).fontSize : null, chip: chip ? getComputedStyle(chip).fontSize : null };
  });
  const s0 = await sizes();
  await page.click('[data-tsize="1"]');
  await sleep(350);
  await page.click('[data-tsize="1"]');
  await sleep(350);
  const s1 = await sizes();
  ok(parseFloat(s1.line) > parseFloat(s0.line), 'C7a: the text stepper still scales the readings text', s0.line + ' -> ' + s1.line);
  ok(s1.chip === '13.5px' && s0.chip === '13.5px', 'C7b: the chip labels stay control-sized at every text size', s0.chip + ' / ' + s1.chip);
  ok(errs.length === 0, 'F5: no page errors on the stepper legs', errs.join(' ; '));
  await ctx.close();
}

/* ---- C8: the backup interplay — a feed day missing its Gospel ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/nog', errs, 'c8', { universalis: UNI_JSON });
  await sleep(600);
  const info = await page.evaluate(() => {
    const host = document.getElementById('mass-readings');
    const scroll = document.querySelector('.mass-scroll');
    return { text: host ? host.textContent : '', chips: host ? host.querySelectorAll('.mass-chips').length : -1, scrollText: scroll ? scroll.textContent : '' };
  });
  ok(info.text.includes('Zacchaeus'), 'C8a: the missing Gospel is filled by the Universalis backup (Zacchaeus stands)');
  ok(info.chips === 0, 'C8b: the backup-filled part carries no chip strip');
  ok(info.scrollText.includes('Jerusalem Bible'), 'C8c: the Jerusalem Bible acknowledgment stands on a backup day');
  ok(errs.length === 0, 'F6: no page errors on the backup legs', errs.join(' ; '));
  await ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v497:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
