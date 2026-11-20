// harness-v487 — v487: the Mass readings HTML fix (production-
// break fix-forward; John's report 2026-11-17 00:24 CT).
//
// Fixtures are REAL (Improvement D): today's decoded Universalis
// JSONP payload and Sunday 2026-11-22's, captured live by
// evaluating the service's JSONP with a stub callback
// (fixtures-v487/capture.mjs) — the payload's real HTML shape,
// the shape the v486 harness's readings legs never rendered.
//
// Legs:
//   P   the cooked APP_JS parses (the v439 gate).
//   R   reproduction: the v486 renderer (escape-everything)
//       over the real fixture prints the markup literally —
//       the defect as John saw it.
//   A   the v487 renderer over the real fixtures: zero payload
//       tag remnants, zero entity remnants, in the readings
//       block and the acknowledgments block.
//   B   word equality per field: the transform's word sequence
//       equals the payload's word sequence (independent
//       strip-and-decode in this harness) — presentation only.
//   C   the psalm: verse lines, the response line rubric-styled.
//   D   the Sunday fixture: the Second Reading renders clean.
//   E   regression: the untouched Mass renderers (massTextHtml,
//       the Order/propers paths) are byte-identical to the
//       v486 ship tree.

import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = ROOT + '/app/worker/src';
const FIX = ROOT + '/app/tests/fixtures-v487';
const C_SRC = fs.readFileSync(SRC + '/client.ts', 'utf8');

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

/* ---------------- the real client functions ---------------- */
function extractFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  return '';
}
const ctx = {
  console, document: { head: { appendChild: () => {} }, createElement: () => ({}) },
  window: {}, state: { tab: 'mass', mass: null }, view: { innerHTML: '', querySelectorAll: () => [] },
};
ctx.window = ctx;
vm.createContext(ctx);
{
  const vAt = COOKED.indexOf('var MASS_NAMED_ENTITIES');
  vm.runInContext(COOKED.slice(vAt, COOKED.indexOf(';', vAt) + 1), ctx);
}
for (const fn of ['esc', 'massDecodeEntities', 'massCleanLines', 'massCleanText', 'massReadingTextHtml', 'massTextHtml', 'massReadingsHtml', 'massAcksHtml']) {
  const src = extractFn(COOKED, fn);
  if (!src) { ok(false, 'extract ' + fn, 'not found in cooked APP_JS'); }
  else vm.runInContext(src, ctx);
}
vm.runInContext('var massReadings = null; var MASS_READINGS_ACK_1 = "Copyright \\u00a9 1996-2026 Universalis Publishing Limited: see www.universalis.com."; var MASS_READINGS_ACK_2 = "From The Jerusalem Bible \\u00a9 1966 by Darton Longman & Todd Ltd and Doubleday and Company Ltd.";', ctx);

const today = JSON.parse(fs.readFileSync(FIX + '/payload-20261117.json', 'utf8'));
const sunday = JSON.parse(fs.readFileSync(FIX + '/payload-20261122.json', 'utf8'));

/* ------- independent strip-and-decode (the word witness) ------- */
function witnessWords(html) {
  let s = String(html || '').replace(/<[^>]*>/g, ' ');
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)));
  s = s.replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)));
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
  return s.split(/\s+/).filter(Boolean);
}
function renderedWords(lines) {
  return lines.map((l) => l.text).join(' ').split(/\s+/).filter(Boolean);
}
/* The text a reader actually sees: tags stripped, entities
   decoded once — the level at which "no remnants" is judged
   (esc() rightly re-encodes a text ampersand as &amp; in the
   HTML source; the phone displays '&'). */
function displayedText(html) {
  let s = String(html || '').replace(/<[^>]*>/g, ' ');
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)));
  s = s.replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)));
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
  return s;
}
const ENTITY_REM = /&(#\d+|#x[0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp);/;
const cleanLines = (html) => vm.runInContext('massCleanLines(' + JSON.stringify(html) + ')', ctx);
const cleanText = (s) => vm.runInContext('massCleanText(' + JSON.stringify(s) + ')', ctx);
const eq = (a, b) => a.length === b.length && a.every((w, i) => w === b[i]);

/* ---------------- R: the defect, reproduced ---------------- */
{
  const oldRender = (text) => String(text || '').split('\n').map((ln) => ln.trim() ? '<div class="mass-line">' + vm.runInContext('esc(' + JSON.stringify(ln) + ')', ctx) + '</div>' : '').join('');
  const r = oldRender(today.Mass_Ps.text);
  ok(r.includes('&lt;div') && r.includes('text-indent'), 'R1 reproduction: the v486 renderer over the real psalm fixture prints the div markup literally (the defect John reported)');
  const r2 = oldRender(today.Mass_R1.text);
  ok(r2.includes('&#x2018;') || r2.includes('&lt;div'), 'R2 reproduction: the v486 renderer leaves entity codes standing in the first reading');
}

/* ---------------- A + B: today ---------------- */
const FIELDS = ['Mass_R1', 'Mass_Ps', 'Mass_GA', 'Mass_G'];
for (const f of FIELDS) {
  const item = today[f];
  ok(eq(renderedWords(cleanLines(item.text)), witnessWords(item.text)), 'B-' + f + ' word equality: the rendered text words are the payload words, in order, none added or dropped');
  if (item.heading) ok(eq(cleanText(item.heading).split(/\s+/).filter(Boolean), witnessWords(item.heading)), 'B-' + f + ' heading word equality');
  if (item.source) ok(eq(cleanText(item.source).split(/\s+/).filter(Boolean), witnessWords(item.source)), 'B-' + f + ' source word equality');
}
ok(cleanText(today.Mass_R1.source) === 'Apocalypse 3:1\u20106,14\u201022', 'B-src the source line decodes to real characters: Apocalypse 3:1\u20106,14\u201022', cleanText(today.Mass_R1.source));
{
  vm.runInContext('massReadings = ' + JSON.stringify(today), ctx);
  const html = vm.runInContext('massReadingsHtml()', ctx);
  ok(!ENTITY_REM.test(displayedText(html)), 'A1 the displayed readings carry zero entity remnants');
  ok(!/text-indent|text-align:justify|<i>|<\/i>|<span|style=/.test(html), 'A2 the rendered readings carry zero payload tag remnants');
  ok(html.includes('Those who prove victorious I will allow to share my throne.'), 'A3 the psalm response text stands in the render');
  ok(html.includes('Apocalypse 3:1\u20106,14\u201022'), 'A4 the decoded source line stands in the render');
  const acks = vm.runInContext('massAcksHtml()', ctx);
  ok(!ENTITY_REM.test(displayedText(acks)) && !/text-align:justify|<span|style=/.test(acks), 'A5 the acknowledgments block renders the payload copyright line clean (no tags in the markup, no entities in the displayed text)');
  ok(acks.includes('Copyright \u00a9 1996\u20102026 Universalis Publishing Limited'), 'A6 the copyright line decodes (the \\u00a9 and the year-range hyphen stand as characters)');
}

/* ---------------- C: the psalm's shape ---------------- */
{
  const lines = cleanLines(today.Mass_Ps.text);
  ok(lines.length >= 6, 'C1 the psalm renders as verse lines (one per service div)', 'lines=' + lines.length);
  ok(lines[0].rubric === true && lines[0].text.startsWith('Those who prove victorious'), 'C2 the response line (the service\u2019s italic whole line) is marked rubric');
  ok(lines[1].text.startsWith('Lord, who shall dwell'), 'C3 the first verse follows the response');
  ok(lines.every((l) => l.rubric === (l.text === lines[0].text)) && lines.filter((l) => l.rubric).length === 4, 'C4 exactly the response lines are rubric-styled (the response repeats after each stanza in the service payload — 4 standings), the verses are not');
  vm.runInContext('massReadings = ' + JSON.stringify(today), ctx);
  const html = vm.runInContext('massReadingsHtml()', ctx);
  ok(html.includes('<div class="mass-rubric">Those who prove victorious'), 'C5 the rendered psalm carries the response in the rubric style');
}

/* ---------------- D: Sunday (with R2) ---------------- */
{
  ok(!!sunday.Mass_R2, 'D0 the Sunday fixture carries a Second Reading');
  for (const f of ['Mass_R1', 'Mass_Ps', 'Mass_R2', 'Mass_GA', 'Mass_G']) {
    const item = sunday[f];
    ok(eq(renderedWords(cleanLines(item.text)), witnessWords(item.text)), 'D-' + f + ' word equality on the Sunday payload');
  }
  vm.runInContext('massReadings = ' + JSON.stringify(sunday), ctx);
  const html = vm.runInContext('massReadingsHtml()', ctx);
  ok(html.includes('Second Reading'), 'D-R the Sunday render carries the Second Reading section');
  ok(!ENTITY_REM.test(displayedText(html)) && !/text-indent|<i>|<span|style=/.test(html), 'D-clean the Sunday render is equally clean (zero remnants)');
}

/* ---------------- E: the untouched paths stand ---------------- */
{
  const base = execFileSync('git', ['-C', ROOT, 'show', 'release/v486-ship:app/worker/src/client.ts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const bA = base.indexOf('APP_JS = `') + 10, bB = base.lastIndexOf('`;');
  const BASE_COOKED = new Function('return `' + base.slice(bA, bB) + '`')();
  for (const fn of ['massTextHtml', 'massLinesHtml', 'massAntiphonHtml', 'massPrayerHtml', 'massPartHtml', 'massEpHtml', 'massFormulary']) {
    ok(extractFn(COOKED, fn) === extractFn(BASE_COOKED, fn), 'E-' + fn + ' byte-identical to the v486 ship tree (the propers/Order paths are untouched)');
  }
}

console.log('\nharness-v487: ' + pass + ' ok, ' + fail + ' not ok');
process.exit(fail ? 1 : 0);
