// harness-v490 — v490: the Mass tab's readings switch to the
// USCCB Daily Readings RSS feed (NABRE) as THE source, with
// the standing Universalis (Jerusalem Bible) payload as the
// per-piece backup for anything the feed lacks that day
// (John, 2026-11-17 06:05-06:06 CT).
//
// Fixtures are REAL (Improvement D), all in fixtures-v490:
//   - usccb-feed-2026-11-17.xml — the live USCCB Daily
//     Readings RSS feed, captured 2026-11-17 ~06:06 CT from
//     https://www.usccb.org/bible/readings/rss/index.cfm
//     (carries 2026-11-17 back through 2026-11-08).
//   - usccb-page-2026-11-17.html — the independent witness:
//     the USCCB readings page for 2026-11-17
//     (https://bible.usccb.org/bible/readings/111726.cfm),
//     captured the same hour.
//   - universalis-20261117.json / universalis-20261122.json —
//     the real decoded Universalis JSONP payloads for those
//     dates, captured 2026-11-17 by the standing method
//     (browser UA + app origin referer, stub callback).
//   - the day payloads (propers) come from the REAL
//     massPayload (mass.ts, esbuild-bundled) over the
//     fixtures-v486 Missal pages, as in harness-v489.
// Derived fixtures (named as such): fixture C removes the
// Alleluia <h4> section from the real 2026-11-17 feed item;
// fixture D removes its Gospel <h4> section. The removals
// are string surgery on the captured feed, done below.
//
// Legs:
//   P   the cooked APP_JS parses (the v439 gate) + tab order.
//   R   standing texts untouched: MASS_ORDER / MASS_LATIN
//       byte-identical to the v489 ship tree; mass.ts,
//       mass-order.ts, mass-calendar.ts byte-identical.
//   W   the Worker feed parser (mass-readings.ts, bundled)
//       over the real feed: date matching, part mapping,
//       copyright carried, absent date, word-equality of the
//       parsed parts against an independent strip of the
//       captured XML.
//   C   ship-day render (2026-11-17): every piece from the
//       feed, psalm responses bold, closings split, the
//       feed's CCD/Lectionary line stands, NO Universalis /
//       Jerusalem Bible / Grail line stands.
//   V   witness: the rendered readings' word stream stands
//       as one contiguous run inside the USCCB readings
//       page's word stream for the same date.
//   F   per-piece fallback: fixture C (no Alleluia in the
//       feed) renders the acclamation word-equal from
//       Universalis and the JB lines stand, all other
//       pieces still from the feed; fixture D (no Gospel in
//       the feed) renders the Gospel from Universalis, the
//       rest from the feed.
//   S   Sunday 2026-11-15 from the feed: Reading 2 stands,
//       the alternate Gospel stands under its own feed
//       heading, no fallback fires, no JB lines.
//   N/G/T  the v489 legs carried forward: five big section
//       titles in place, connected one-row toggle boxes,
//       Latin + EP swaps, text-size stepper, day-true
//       Gloria/Creed (memorial + Sunday).

import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = ROOT + '/app/worker/src';
const FIX6 = ROOT + '/app/tests/fixtures-v486';
const FIX0 = ROOT + '/app/tests/fixtures-v490';
const C_SRC = fs.readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = fs.readFileSync(SRC + '/ui.ts', 'utf8');

let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('not ok -', name, detail ? ':: ' + String(detail).slice(0, 260) : ''); }
}

/* ---------------- P: the cooked APP_JS ---------------- */
const TPL_A = C_SRC.indexOf('APP_JS = `') + 10;
const TPL_B = C_SRC.lastIndexOf('`;');
let COOKED = null, cookErr = null;
try { COOKED = new Function('return `' + C_SRC.slice(TPL_A, TPL_B) + '`')(); }
catch (e) { cookErr = e; }
ok(!cookErr && typeof COOKED === 'string', 'P1 the APP_JS template cooks without error', cookErr && cookErr.message);
let parseErr = null;
if (COOKED) { try { new vm.Script(COOKED); } catch (e) { parseErr = e; } }
ok(!parseErr, 'P2 the whole cooked APP_JS parses (vm.Script) — the v439 gate', parseErr && parseErr.message);
{
  const nav = U_SRC.slice(U_SRC.indexOf('<nav class="tabbar"'), U_SRC.indexOf('</nav>'));
  const order = ['data-tab="prayers"', 'data-tab="mass"', 'data-tab="conscience"', 'data-tab="podcasts"', 'data-tab="wallpaper"']
    .map((s) => nav.indexOf(s));
  ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), 'P3 the tab bar stands unchanged (Mass second)', order.join(','));
}

/* ---------------- the real client, in a vm ---------------- */
function extractFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  return '';
}
const lsStore = {};
const ctx = {
  console, document: { head: { appendChild: () => {} }, createElement: () => ({}), getElementById: () => null },
  window: {}, state: { tab: 'mass', mass: null }, view: { innerHTML: '', querySelectorAll: () => [] },
  localStorage: { getItem: (k) => (k in lsStore ? lsStore[k] : null), setItem: (k, v) => { lsStore[k] = String(v); } },
};
ctx.window = ctx;
vm.createContext(ctx);
{
  const d0 = COOKED.indexOf('var MASS_ORDER = '), d1 = COOKED.indexOf('/*__/MASS_DATA__*/');
  vm.runInContext(COOKED.slice(d0, d1), ctx);
  for (const v of ['MASS_NAMED_ENTITIES', 'MASS_ICEL_NOTICE', 'MASS_READINGS_ACK_1', 'MASS_READINGS_ACK_2', 'MASS_SIZE_NAMES', 'MASS_PREFS_KEY', 'MASS_SLOT_LABELS', 'MASS_SLOT_CLOSINGS']) {
    const at = COOKED.indexOf('var ' + v);
    if (at >= 0) vm.runInContext(COOKED.slice(at, COOKED.indexOf(';', at) + 1), ctx);
  }
}
for (const fn of ['esc', 'massDecodeEntities', 'massCleanLines', 'massCleanText', 'massReadingTextHtml', 'massGaTextHtml', 'massTextHtml', 'massAntiphonHtml', 'massPrayerHtml', 'massLinesHtml', 'massPartHtml', 'massEpHtml', 'massFormulary', 'massFeedLinesHtml', 'massFeedPartHtml', 'massBackupPartHtml', 'massReadingsHtml', 'massAcksHtml', 'massDayFlags', 'massPrefs', 'saveMassPrefs', 'massSectionHtml', 'paintMassScroll', 'wireMassLatin']) {
  const src = extractFn(COOKED, fn);
  if (!src) { ok(false, 'extract ' + fn, 'not found in cooked APP_JS'); }
  else vm.runInContext(src, ctx);
}
vm.runInContext('var massReadings = null; var massFeed = null; var massUsedFallback = false;', ctx);
const run = (code) => vm.runInContext(code, ctx);
const ORDER = run('MASS_ORDER'), ROLES = run('MASS_ROLES'), LATIN = run('MASS_LATIN'), LATIN_ROLES = run('MASS_LATIN_ROLES');

/* ---------------- R: standing texts untouched ---------------- */
{
  const segs = Object.keys(ORDER);
  ok(segs.every((k) => typeof ROLES[k] === 'string' && ROLES[k].length === ORDER[k].length),
    'R1 every Order segment carries a roles string of equal length');
  const base = execFileSync('git', ['-C', ROOT, 'show', 'release/v489-ship:app/worker/src/client.ts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const bA = base.indexOf('APP_JS = `') + 10, bB = base.lastIndexOf('`;');
  const BASE_COOKED = new Function('return `' + base.slice(bA, bB) + '`')();
  const bd0 = BASE_COOKED.indexOf('var MASS_ORDER = '), bd1 = BASE_COOKED.indexOf('/*__/MASS_DATA__*/');
  const bctx = { console };
  vm.createContext(bctx);
  vm.runInContext(BASE_COOKED.slice(bd0, bd1), bctx);
  ok(JSON.stringify(ORDER) === JSON.stringify(bctx.MASS_ORDER), 'R2 MASS_ORDER texts byte-identical to the v489 ship tree');
  ok(JSON.stringify(LATIN) === JSON.stringify(bctx.MASS_LATIN), 'R3 MASS_LATIN texts byte-identical to the v489 ship tree');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-calendar.ts']) {
    const was = execFileSync('git', ['-C', ROOT, 'show', 'release/v489-ship:app/worker/src/' + f], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    ok(fs.readFileSync(SRC + '/' + f, 'utf8') === was, 'R4 ' + f + ' byte-identical to the v489 ship tree (propers + Order data untouched)');
  }
}

/* ---------------- W: the Worker feed parser ---------------- */
const TMP = fs.mkdtempSync('/tmp/v490-harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [SRC + '/mass-readings.ts', '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/mr.cjs'], { stdio: 'pipe' });
const MR = await import(TMP + '/mr.cjs');
const { parseUsccbFeed } = MR.default ?? MR;
const FEED_XML = fs.readFileSync(FIX0 + '/usccb-feed-2026-11-17.xml', 'utf8');
const feedToday = parseUsccbFeed(FEED_XML, '2026-11-17');
const feedSunday = parseUsccbFeed(FEED_XML, '2026-11-15');
const CCD_LINE = 'Lectionary for Mass for Use in the Dioceses of the United States, second typical edition, Copyright © 2001, 1998, 1997, 1986, 1970 Confraternity of Christian Doctrine; Psalm refrain © 1968, 1981, 1997, International Committee on English in the Liturgy, Inc. All rights reserved. Neither this work nor any part of it may be reproduced, distributed, performed or displayed in any medium, including electronic or digital, without permission in writing from the copyright owner.';
{
  ok(feedToday.found === true, 'W1 the parser date-matches 2026-11-17 in the captured feed');
  ok(feedToday.title === 'Memorial of Saint Elizabeth of Hungary, Religious', 'W2 the matched item is the day\u2019s memorial', feedToday.title);
  ok(feedToday.parts.map((p) => p.key).join(',') === 'r1,ps,ga,g', 'W3 today maps to r1 · ps · ga · g in feed order', feedToday.parts.map((p) => p.key).join(','));
  ok(feedToday.parts[0].source === 'Revelation 3:1-6, 14-22', 'W4 the First Reading citation is carried', feedToday.parts[0].source);
  ok(feedToday.parts[2].heading === 'Alleluia' && feedToday.parts[2].source === '1 John 4:10b', 'W5 the feed carries the Alleluia for today (no fallback needed for it)');
  ok(feedSunday.found === true && feedSunday.parts.map((p) => p.key).join(',') === 'r1,ps,r2,ga,g,extra',
    'W6 Sunday 2026-11-15 maps to r1 · ps · r2 · ga · g · extra (the alternate Gospel)', feedSunday.parts.map((p) => p.key).join(','));
  ok(feedToday.copyright.length === 1 && feedToday.copyright[0] === CCD_LINE, 'W7 the item\u2019s CCD/Lectionary copyright line is carried exactly');
  const absent = parseUsccbFeed(FEED_XML, '2026-11-20');
  ok(absent.found === false && absent.parts.length === 0, 'W8 a date the feed does not carry answers found:false with no parts');
  // Word-equality: an independent strip of the captured XML.
  const stripAll = (html) => html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/<br[^>]*>/gi, '\n').replace(/<[^>]*>/g, '')
    .split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  const itemMatch = FEED_XML.match(/<item>[\s\S]*?111726\.cfm[\s\S]*?<\/item>/);
  const descRaw = itemMatch[0].match(/<description>([\s\S]*?)<\/description>/)[1];
  const independent = stripAll(descRaw);
  const parsedWords = feedToday.parts.map((p) => stripAll(p.html)).join('\n');
  const firstLine = 'I, John, heard the Lord saying to me:';
  ok(independent.includes(firstLine) && parsedWords.includes(firstLine), 'W9 the parsed First Reading opens with the feed\u2019s own first line');
  const parsedSet = new Set(parsedWords.split('\n'));
  const missing = independent.split('\n').filter((ln) =>
    !ln.startsWith('Readings for the') && !ln.startsWith('Reading 1') && !ln.startsWith('Responsorial Psalm') &&
    !ln.startsWith('Alleluia') && !ln.startsWith('Gospel') && !ln.startsWith('Lectionary for Mass') &&
    ln !== '- - -' && !parsedSet.has(ln));
  ok(missing.length === 0, 'W10 every text line of the captured item stands in the parsed parts (nothing dropped)', missing.slice(0, 3).join(' | '));
}

/* ---------------- real day payloads (mass.ts) ---------------- */
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [SRC + '/mass.ts', '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/mass.cjs'], { stdio: 'pipe' });
const MASS = await import(TMP + '/mass.cjs');
const { massPayload, SEASON_PAGES } = MASS.default ?? MASS;
const pageCache = {
  [SEASON_PAGES['Ordinary Time']]: fs.readFileSync(FIX6 + '/src-ordinary-time.htm', 'utf8'),
  [SEASON_PAGES['Advent']]: fs.readFileSync(FIX6 + '/adventmass.htm', 'utf8'),
  [SEASON_PAGES['Christmas']]: fs.readFileSync(FIX6 + '/christmasmass.htm', 'utf8'),
  [SEASON_PAGES['Lent']]: fs.readFileSync(FIX6 + '/lentmass.htm', 'utf8'),
  [SEASON_PAGES['Easter']]: fs.readFileSync(FIX6 + '/eastermass.htm', 'utf8'),
  'http://www.liturgies.net/Liturgies/Catholic/roman_missal/roman_missal_commons.htm': fs.readFileSync(FIX6 + '/src-commons.htm', 'utf8'),
  'https://www.liturgies.net/saints/elizabethofhungary/readings.htm': fs.readFileSync(FIX6 + '/src-saint-elizabethofhungary.htm', 'utf8'),
};
globalThis.fetch = async (url) => {
  const body = pageCache[url];
  if (body == null) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => body };
};
const noDbEnv = { DB: { prepare: () => { throw new Error('no db in harness'); } } };
const payloads = {};
for (const d of ['2026-11-17', '2026-11-22']) payloads[d] = await massPayload(noDbEnv, d);
const uniToday = JSON.parse(fs.readFileSync(FIX0 + '/universalis-20261117.json', 'utf8'));
const uniSunday = JSON.parse(fs.readFileSync(FIX0 + '/universalis-20261122.json', 'utf8'));

function renderDay(date, feed, uni, opts) {
  const p = payloads[date] || payloads['2026-11-17'];
  run('massFeed = ' + JSON.stringify(feed));
  run('massReadings = ' + JSON.stringify(uni));
  ctx.state.mass = { date, payload: p, version: (opts && opts.version) || p.defaultVersion, ep: (opts && opts.ep) || 'II', latin: (opts && opts.latin) || {}, textSize: (opts && typeof opts.textSize === 'number') ? opts.textSize : 1, dateLabel: date };
  run('paintMassScroll()');
  return ctx.view.innerHTML;
}
const readingsOnly = (feed, uni) => {
  run('massFeed = ' + JSON.stringify(feed));
  run('massReadings = ' + JSON.stringify(uni));
  const html = run('massReadingsHtml()');
  const acks = run('massAcksHtml()');
  return { html, acks, usedFallback: run('massUsedFallback') };
};
const textOf = (html) => html.replace(/<[^>]*>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);

/* ---------------- C: the ship-day render ---------------- */
{
  const { html, acks, usedFallback } = readingsOnly(feedToday, uniToday);
  ok(html.includes('<div class="mass-h">First Reading</div>') && html.includes('I, John, heard the Lord saying to me:'), 'C1 the First Reading renders from the feed');
  ok(html.includes('<div class="mass-line mass-people">R. (Rev. 3: 21) I will seat the victor beside me on my throne.</div>'),
    'C2 the psalm response stands bold as the people\u2019s part, with its R. marker');
  ok(html.includes('He who walks blamelessly and does justice;') && !html.includes('mass-people">He who walks'),
    'C3 the psalm verses stand regular');
  ok(html.includes('<div class="mass-line mass-people">R. Alleluia, alleluia.</div>') && html.includes('God loved us, and sent his Son'),
    'C4 the Gospel Acclamation renders from the feed, refrain bold, verse regular');
  ok(html.includes('Zacchaeus, come down quickly,'), 'C5 the Gospel renders from the feed (NABRE wording)');
  ok(html.includes('<div class="mass-line">The word of the Lord.</div><div class="mass-line mass-people">Thanks be to God.</div>'),
    'C6 the reading closing splits as standing (regular · bold)');
  ok(html.includes('<div class="mass-line">The Gospel of the Lord.</div><div class="mass-line mass-people">Praise to you, Lord Jesus Christ.</div>'),
    'C7 the Gospel closing splits as standing');
  ok(usedFallback === false, 'C8 no fallback piece fired on the ship day (the feed carries every piece)');
  ok(acks.includes(CCD_LINE), 'C9 the feed\u2019s CCD/Lectionary copyright line stands with the readings');
  ok(!acks.includes('Universalis Publishing') && !acks.includes('Jerusalem Bible'), 'C10 no Universalis / Jerusalem Bible line stands on a full-feed day');
  ok(!html.includes('Grail') && !acks.includes('Grail'), 'C11 no Grail line stands anywhere in the scroll (the separate psalm line retired)');
  ok(!/<[a-z]+[^>]*>/.test(html.replace(/<div[^>]*>/g, '').replace(/<\/div>/g, '')), 'C12 zero markup remnants in the rendered readings');
}

/* ---------------- V: the witness ---------------- */
{
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const page = fs.readFileSync(FIX0 + '/usccb-page-2026-11-17.html', 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10))).replace(/&[a-z]+;/g, ' ');
  const pageWords = words(page);
  const contiguous = (needle) => {
    outer: for (let i = 0; i + needle.length <= pageWords.length; i++) {
      if (pageWords[i] !== needle[0]) continue;
      for (let j = 1; j < needle.length; j++) if (pageWords[i + j] !== needle[j]) continue outer;
      return true;
    }
    return false;
  };
  // Per part: the page prints its own headings between the
  // parts, so each part's word stream is checked as its own
  // contiguous run inside the page's word stream.
  const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
  for (const part of feedToday.parts) {
    const partHtml = run('massFeedPartHtml(' + JSON.stringify(part) + ', ' + JSON.stringify('X') + ')');
    const lines = textOf(partHtml).map(unesc).slice(2); // drop heading + citation lines
    const closings = new Set(['The word of the Lord.', 'Thanks be to God.', 'The Gospel of the Lord.', 'Praise to you, Lord Jesus Christ.']);
    const rendered = words(lines.filter((ln) => !closings.has(ln)).join(' '));
    ok(contiguous(rendered), 'V-' + part.key + ' the rendered ' + part.heading + ' word stream (' + rendered.length + ' words) stands contiguous in the USCCB page for 2026-11-17 (witness)',
      'head: ' + rendered.slice(0, 10).join(' '));
  }
}

/* ---------------- F: per-piece fallback ---------------- */
function feedWithout(xml, date, heading) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  // String surgery on the one item for the date: cut from its
  // <h4>heading section to the next <h4> (or the separator).
  const [y, mo, da] = date.split('-');
  const key = `${mo}${da}${y.slice(2)}.cfm`;
  const item = items.find((it) => it.includes(key));
  const hAt = item.indexOf(`&lt;h4&gt;${heading}`);
  if (hAt < 0) throw new Error('heading not found: ' + heading);
  const rest = item.slice(hAt + 10);
  const nextH = rest.indexOf('&lt;h4&gt;');
  const sep = rest.indexOf('- - -');
  const cut = nextH >= 0 ? nextH : sep;
  const cutItem = item.slice(0, hAt) + item.slice(hAt + 10 + cut);
  return parseUsccbFeed(xml.replace(item, cutItem), date);
}
{
  const noGa = feedWithout(FEED_XML, '2026-11-17', 'Alleluia');
  ok(noGa.found && noGa.parts.map((p) => p.key).join(',') === 'r1,ps,g', 'F0 the derived fixture C feed item carries r1 · ps · g and no Alleluia');
  const c = readingsOnly(noGa, uniToday);
  const uniGaFirst = textOf(run('massGaTextHtml(' + JSON.stringify(uniToday.Mass_GA.text) + ')'))[0];
  ok(c.html.includes('Gospel Acclamation') && c.html.includes(uniGaFirst), 'F1 fixture C: the acclamation renders from Universalis, word-equal (' + uniGaFirst + ')');
  ok(c.usedFallback === true && c.acks.includes('Jerusalem Bible') && c.acks.includes('Universalis Publishing'),
    'F2 fixture C: the Universalis / Jerusalem Bible lines stand (a backup piece fired)');
  ok(c.acks.includes(CCD_LINE), 'F3 fixture C: the CCD/Lectionary line still stands with the feed pieces');
  ok(c.html.includes('To the angel of the Church in Sardis, write this:') && c.html.includes('Zacchaeus, come down quickly,'),
    'F4 fixture C: the other readings still render from the feed (feed wording stands)');
  const noG = feedWithout(FEED_XML, '2026-11-17', 'Gospel');
  ok(noG.found && noG.parts.map((p) => p.key).join(',') === 'r1,ps,ga', 'F5 the derived fixture D feed item carries r1 · ps · ga and no Gospel');
  const dres = readingsOnly(noG, uniToday);
  ok(dres.html.includes('Jesus entered Jericho and was going through the town'), 'F6 fixture D: the Gospel renders from Universalis (JB wording)');
  ok(!dres.html.includes('Zacchaeus, come down quickly,'), 'F7 fixture D: the feed Gospel wording does not stand (that piece came from the backup)');
  ok(dres.usedFallback === true && dres.html.includes('To the angel of the Church in Sardis, write this:'),
    'F8 fixture D: fallback fired for the Gospel alone; the First Reading still renders from the feed');
}

/* ---------------- S: Sunday from the feed ---------------- */
{
  const { html, acks, usedFallback } = readingsOnly(feedSunday, uniSunday);
  ok(html.includes('<div class="mass-h">Second Reading</div>'), 'S1 the Sunday Second Reading stands from the feed');
  ok(html.includes('<div class="mass-h">Or</div>') && html.includes('Matthew 25:14-15, 19-21'),
    'S2 the alternate Gospel stands under its own feed heading (nothing dropped)');
  ok(usedFallback === false && !acks.includes('Jerusalem Bible'), 'S3 no fallback fires on the Sunday feed day; no JB lines');
  ok(acks.includes(CCD_LINE), 'S4 the CCD/Lectionary line stands on the Sunday render');
}

/* ---------------- N/G/T: v489 legs carried forward ---------------- */
const SECTIONS = ['Introductory Rites', 'Liturgy of the Word', 'Liturgy of the Eucharist', 'Communion Rite', 'Concluding Rites'];
const secIdx = (html, name) => html.indexOf('<div class="mass-section">' + name + '</div>');
{
  const tue = renderDay('2026-11-17', feedToday, uniToday);
  const sun = renderDay('2026-11-22', feedToday, uniSunday);
  for (const [label, html] of [['Tue', tue], ['Sun', sun]]) {
    ok((html.match(/<div class="mass-section">/g) || []).length === 5, 'N-' + label + ' exactly five big section titles render');
    const idx = SECTIONS.map((s) => secIdx(html, s));
    ok(idx.every((v) => v >= 0) && idx.every((v, i) => i === 0 || v > idx[i - 1]), 'N-' + label + ' the five titles stand in order');
    ok(idx[1] < html.indexOf('<div class="mass-h">First Reading</div>') && idx[2] > html.indexOf('<div class="mass-h">Gospel</div>'),
      'N-' + label + ' Liturgy of the Word before the readings; Liturgy of the Eucharist after the Gospel');
    ok(html.includes('mass-notice') && html.indexOf('mass-notice') < idx[0], 'N-' + label + ' the ICEL notice stands at the top of the scroll');
    ok(html.lastIndexOf('mass-notice') > idx[4], 'N-' + label + ' the ICEL notice stands at the foot of the scroll');
  }
  ok((tue.match(/segtoggle pill mass-seg mass-ltoggle/g) || []).length === 3, 'G-Tue each standing Latin toggle is one connected pill group (3 parts)');
  ok((sun.match(/segtoggle pill mass-seg mass-ltoggle/g) || []).length === 4, 'G-Sun each standing Latin toggle is one connected pill group (4 parts)');
  const epAt = tue.indexOf('segtoggle pill mass-seg mass-eptoggle');
  const epGroup = epAt >= 0 ? tue.slice(epAt, tue.indexOf('</div>', epAt)) : '';
  ok(['>I</button>', '>II</button>', '>III</button>', '>IV</button>'].every((s) => epGroup.includes(s)), 'G-Tue the EP toggle is one connected pill group, short labels');
  ok(/\.mass-seg \{[^}]*flex-wrap: nowrap/.test(U_SRC), 'G-css the one-row guarantee stands');
  ok(!tue.includes('<div class="mass-h">Gloria</div>') && !tue.includes('<div class="mass-h">Creed</div>'), 'T-Tue day-true: no Gloria, no Creed on the memorial weekday');
  ok(sun.includes('<div class="mass-h">Gloria</div>') && sun.includes('<div class="mass-h">Creed</div>'), 'T-Sun day-true: Gloria and Creed stand on Sunday');
  ok(tue.includes('R. (Rev. 3: 21) I will seat the victor beside me on my throne.'), 'T-Tue the full scroll carries the feed psalm (the readings ride inside paintMassScroll)');
}

console.log(`\n${pass} ok · ${fail} not ok`);
process.exit(fail ? 1 : 0);
