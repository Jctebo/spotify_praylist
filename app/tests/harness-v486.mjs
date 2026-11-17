// harness-v486 — v486: the Mass tab (Plan §2 + John's two
// in-flight additions: the Eucharistic Prayer toggle and the
// English | Latin part toggles).
//
// Fixtures are REAL (Improvement D): the proven source pages
// exactly as published (fixtures-v486/), the live Universalis
// JSONP payloads for the three sample days, and the generated
// calendar dataset built from the estate devotional ICS.
//
// Legs:
//   P   the cooked APP_JS parses (the v439 gate) + the cooked
//       UI shell carries the Mass tab second.
//   X   the REAL extractor (mass.ts, esbuild-transpiled) over
//       the real source pages, fetch stubbed to the fixtures:
//       the three sample days' formularies, with the collects
//       checked word-for-word against the independent witness
//       texts recorded in Plan §2.
//   J   the real JSONP payloads: the psalm stands in the
//       service with its Grail permission line.
//   C   the REAL client functions from the cooked APP_JS:
//       scroll assembly order + notices · the version picker
//       default · the Eucharistic Prayer toggle (each choice
//       renders its own text, switching back restores, IV
//       brings its own Preface) · the Latin toggles per part
//       (Latin renders, English restores; the unproven parts
//       — Creed, Pater — carry NO toggle).
//   W   wiring statics: the session route, migration 0031.

import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = ROOT + '/app/worker/src';
const FIX = ROOT + '/app/tests/fixtures-v486';
const C_SRC = fs.readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = fs.readFileSync(SRC + '/ui.ts', 'utf8');
const I_SRC = fs.readFileSync(SRC + '/index.ts', 'utf8');
const M_SRC = fs.readFileSync(SRC + '/mass.ts', 'utf8');

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
  ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), 'P3 the tab bar stands Praylist · Mass · Conscience · Formation · Sacred Art (Mass second, Q4 A)', order.join(','));
}

/* ---------------- X: the real extractor ---------------- */
const TMP = fs.mkdtempSync('/tmp/v486-harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [SRC + '/mass.ts', '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/mass.cjs'], { stdio: 'pipe' });
const MASS = (await import(TMP + '/mass.cjs')).default ?? await import(TMP + '/mass.cjs');
const { normalizeLines, seasonFormulary, saintFormulary, commonsFormulary, resolveFormulary, massPayload, SEASON_PAGES } =
  MASS.normalizeLines ? MASS : (await import(TMP + '/mass.cjs'));

const pageCache = {
  [SEASON_PAGES['Ordinary Time']]: fs.readFileSync(FIX + '/src-ordinary-time.htm', 'utf8'),
  [SEASON_PAGES['Advent']]: fs.readFileSync(FIX + '/adventmass.htm', 'utf8'),
  [SEASON_PAGES['Christmas']]: fs.readFileSync(FIX + '/christmasmass.htm', 'utf8'),
  [SEASON_PAGES['Lent']]: fs.readFileSync(FIX + '/lentmass.htm', 'utf8'),
  [SEASON_PAGES['Easter']]: fs.readFileSync(FIX + '/eastermass.htm', 'utf8'),
  'http://www.liturgies.net/Liturgies/Catholic/roman_missal/commons.htm': fs.readFileSync(FIX + '/src-commons.htm', 'utf8'),
  'https://www.liturgies.net/saints/elizabethofhungary/readings.htm': fs.readFileSync(FIX + '/src-saint-elizabethofhungary.htm', 'utf8'),
};
globalThis.fetch = async (url) => {
  const body = pageCache[url];
  if (body == null) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => body };
};
const noDbEnv = { DB: { prepare: () => { throw new Error('no db in harness'); } } };

const KING_COLLECT = 'Almighty ever-living God, whose will is to restore all things in your beloved Son, the King of the universe, grant, we pray, that the whole creation, set free from slavery, may render your majesty service and ceaselessly proclaim your praise. Through our Lord Jesus Christ, your Son, who lives and reigns with you in the unity of the Holy Spirit, God, for ever and ever.';
const ELIZ_COLLECT = 'O God, by whose gift Saint Elizabeth of Hungary recognized and revered Christ in the poor, grant, through her intercession, that we may serve with unfailing charity the needy and those afflicted. Through our Lord Jesus Christ, your Son, who lives and reigns with you in the unity of the Holy Spirit, God, for ever and ever.';
const W33_COLLECT = 'Grant us, we pray, O Lord our God, the constant gladness of being devoted to you, for it is full and lasting happiness to serve with constancy the author of all that is good. Through our Lord Jesus Christ, your Son, who lives and reigns with you in the unity of the Holy Spirit, God, for ever and ever.';

const wordsOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
const sameWords = (a, b) => wordsOf(a) === wordsOf(b);
{
  const lines = normalizeLines(pageCache[SEASON_PAGES['Ordinary Time']]);
  const sun = seasonFormulary(lines, 'Ordinary Time', 34, 'sunday');
  ok(sameWords(sun.collect, KING_COLLECT), 'X1 Christ the King (Sunday, week 34): the Collect matches the independent witness word-for-word', (sun.collect || '').slice(0, 120));
  ok(!!(sun.entranceAntiphon && sun.entranceAntiphon.text.includes('How worthy is the Lamb who was slain')), 'X2 Christ the King: the Entrance Antiphon stands', JSON.stringify(sun.entranceAntiphon).slice(0, 120));
  ok(!!(sun.prayerOverOfferings && sun.communionAntiphon && sun.prayerAfterCommunion), 'X3 Christ the King: offerings · communion antiphon · prayer after communion stand', Object.keys(sun).join(','));
  ok(sun.prefaceName === 'Christ, King of the Universe' && !!(sun.prefaceText && sun.prefaceText.includes('eternal Priest and King of all creation')), 'X4 Christ the King: the proper Preface stands with its name', sun.prefaceName);
  const wk = seasonFormulary(lines, 'Ordinary Time', 33, 'weekday');
  ok(sameWords(wk.collect, W33_COLLECT), 'X5 Week 33 weekday (the Nov 18 ferial version): the Collect matches the witness word-for-word', (wk.collect || '').slice(0, 120));
}
{
  const lines = normalizeLines(pageCache['https://www.liturgies.net/saints/elizabethofhungary/readings.htm']);
  const { formulary, commonName } = saintFormulary(lines);
  ok(sameWords(formulary.collect, ELIZ_COLLECT), 'X6 St Elizabeth of Hungary (memorial): her proper Collect matches the witness word-for-word', (formulary.collect || '').slice(0, 120));
  ok(!!commonName && /Works of Mercy/.test(commonName), 'X7 St Elizabeth: the page names its Common (Works of Mercy) for the remaining items', commonName);
}
{
  const f = await resolveFormulary(noDbEnv, { key: 'saint-elizabethofhungary', label: 'Saint Elizabeth of Hungary, Religious', kind: 'saint', slug: 'elizabethofhungary', slugs: ['elizabethofhungary'] });
  ok(sameWords(f.collect, ELIZ_COLLECT) && Object.keys(f).length >= 5, 'X8 resolveFormulary (saint + common fill): the memorial formulary stands near-whole', Object.keys(f).join(','));
  const d = await resolveFormulary(noDbEnv, { key: 'saint-dedication', label: 'Dedication of the Basilicas of Saints Peter and Paul, Apostles', kind: 'common', common: 'dedication' });
  ok(d.collect === undefined && !!(d.entranceAntiphon || d.prayerOverOfferings || d.communionAntiphon), 'X9 the Nov 18 Dedication version: items stand from the Common; the anniversary Collect is NOT substituted (the memorial\u2019s proper Collect stands absent)', Object.keys(d).join(','));
  const p17 = await massPayload(noDbEnv, '2026-11-17');
  ok(p17.defaultVersion === 'saint-elizabethofhungary' && p17.versions.length === 2, 'X10 the calendar dataset: Nov 17 carries the memorial (default) + the ferial', JSON.stringify(p17.versions.map((v) => v.key)));
  const p18 = await massPayload(noDbEnv, '2026-11-18');
  ok(p18.versions.length === 3 && p18.defaultVersion.indexOf('dedication') >= 0, 'X11 the calendar dataset: Nov 18 carries ferial + two optional memorials, defaulting to an optional memorial (Q2 A)', JSON.stringify(p18.versions.map((v) => v.key)));
  const p22 = await massPayload(noDbEnv, '2026-11-22');
  ok(p22.versions.length === 1 && sameWords(p22.versions[0].formulary.collect, KING_COLLECT), 'X12 the calendar dataset + extractor: Nov 22 (Christ the King) resolves to the proven formulary', JSON.stringify(p22.versions.map((v) => v.key)));
}

/* ---------------- J: the readings payloads ---------------- */
for (const [date, cite] of [['20261117', 'Apoc 3'], ['20261118', 'Apoc 4'], ['20261122', 'Dan 7']]) {
  const p = JSON.parse(fs.readFileSync(FIX + '/jsonp-' + date + '.json', 'utf8'));
  ok(!!(p.Mass_R1 && p.Mass_R1.text && p.Mass_G && p.Mass_G.text), 'J-' + date + ' the payload carries the readings (R1 + Gospel)', Object.keys(p).join(','));
  ok(!!(p.Mass_Ps && p.Mass_Ps.text && p.Mass_Ps.text.length > 40), 'J-' + date + ' psalm: the responsorial psalm TEXT stands in the service payload', (p.Mass_Ps && p.Mass_Ps.text || '').slice(0, 60));
  ok(!!(p.copyright && /The Grail \(England\)/.test(p.copyright.text) && /International Commission on English in the Liturgy/.test(p.copyright.text)), 'J-' + date + ' psalm: the payload\u2019s own copyright block carries the Grail permission line', '');
}

/* ---------------- C: the real client functions ---------------- */
function extractFn(name) {
  const at = COOKED.indexOf('function ' + name + '(');
  if (at < 0) return '';
  let depth = 0, i = COOKED.indexOf('{', at);
  const start = i;
  for (; i < COOKED.length; i++) {
    if (COOKED[i] === '{') depth++;
    else if (COOKED[i] === '}') { depth--; if (depth === 0) return COOKED.slice(at, i + 1); }
  }
  return '';
}
const dataAt = COOKED.indexOf('var MASS_ORDER = ');
const dataEnd = COOKED.indexOf('/*__/MASS_DATA__*/');
const dataSrc = COOKED.slice(dataAt, dataEnd);
const ctx = {
  console, document: { head: { appendChild: () => {} }, createElement: () => ({}) },
  window: {}, state: { tab: 'mass', mass: null }, view: { innerHTML: '', querySelectorAll: () => [] },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(dataSrc, ctx);
for (const fn of ['esc', 'massLinesHtml', 'massTextHtml', 'massAntiphonHtml', 'massPrayerHtml', 'massPartHtml', 'massEpHtml', 'massFormulary', 'massReadingsHtml', 'massAcksHtml', 'paintMassScroll', 'wireMassLatin', 'wireMassEp', 'paintMassReadings', 'paintMassAcks', 'loadMassReadings']) {
  const src = extractFn(fn);
  if (src) vm.runInContext(src, ctx);
}
vm.runInContext('var MASS_ICEL_NOTICE = ' + JSON.stringify('The English translation of The Roman Missal © 2010, International Commission on English in the Liturgy Corporation. All rights reserved.') + ';', ctx);
vm.runInContext('var massReadings = null; var MASS_READINGS_ACK_1 = "Copyright \u00a9 1996-2026 Universalis Publishing Limited: see www.universalis.com."; var MASS_READINGS_ACK_2 = "From The Jerusalem Bible \u00a9 1966 by Darton Longman & Todd Ltd and Doubleday and Company Ltd.";', ctx);
const payload22 = await massPayload(noDbEnv, '2026-11-22');
ctx.state.mass = { date: '2026-11-22', payload: payload22, version: payload22.defaultVersion, ep: 'II', latin: {}, dateLabel: 'Sunday, November 22' };
vm.runInContext('paintMassScroll()', ctx);
const scroll = ctx.view.innerHTML;
{
  const marks = ['mass-notice', 'Entrance Antiphon', 'Penitential Act', 'Kyrie', 'Gloria', 'Collect', 'mass-readings', 'Creed', 'Prayer over the Offerings', 'mass-eptoggle', 'Lord\u2019s Prayer', 'Agnus Dei', 'Communion Antiphon', 'Prayer after Communion', 'mass-acks'];
  let last = -1, ordered = true;
  for (const m of marks) { const i = scroll.indexOf(m); if (i < 0 || i < last) { ordered = false; break; } last = i; }
  ok(ordered, 'C1 the scroll assembles in Mass order (notice · entrance · penitential · kyrie · gloria · collect · readings · creed · offerings · EP · lord\u2019s prayer · agnus · communion · acks)');
  ok((scroll.match(/mass-notice/g) || []).length === 2, 'C2 the ICEL notice stands at the top AND the foot of the scroll (Q5 A)');
  ok(scroll.includes(KING_COLLECT.slice(0, 60)), 'C3 the scroll carries the day\u2019s proven Collect');
}
{
  // The Eucharistic Prayer toggle (John, 2026-11-16 23:50 CT).
  const epHtml = (k) => { ctx.state.mass.ep = k; return vm.runInContext('massEpHtml()', ctx); };
  const ii = epHtml('II'), i1 = epHtml('I'), i3 = epHtml('III'), i4 = epHtml('IV'), ii2 = epHtml('II');
  ok(ii.includes('You are indeed Holy, O Lord') && ii.includes('fount of all holiness') && !ii.includes('To you, therefore, most merciful Father'), 'C4 EP toggle: II renders Eucharistic Prayer II\u2019s own text on open (the named default)');
  ok(i1.includes('To you, therefore, most merciful Father') && !i1.includes('fount of all holiness'), 'C5 EP toggle: I renders the Roman Canon\u2019s own text');
  ok(i3.includes('rightly gives you praise'), 'C6 EP toggle: III renders its own text (its second line names it)');
  ok(i4.includes('We give you praise, Father most holy') && i4.includes('It is truly right to give you thanks'), 'C7 EP toggle: IV renders its own text WITH its own invariable Preface (its rubric)');
  ok(ii2 === ii, 'C8 EP toggle: switching back to II restores II exactly');
  ok(!i1.includes('Common Preface') && ii.includes('Preface'), 'C9 EP toggle: the Preface block stands with I/II/III; IV replaces it whole');
}
{
  // The Latin toggles (John, 2026-11-16 23:51 CT).
  const part = (p, lang) => { ctx.state.mass.latin = {}; if (lang) ctx.state.mass.latin[p] = lang; return vm.runInContext('massPartHtml(' + JSON.stringify(p) + ', MASS_ORDER[' + JSON.stringify({ kyrie: 'kyrieEn', gloria: 'gloriaEn', sanctus: 'sanctus', agnus: 'agnusEn', creed: 'creedEn' }[p]) + '], null)', ctx); };
  const gEn = part('gloria'), gLa = part('gloria', 'la'), gBack = part('gloria');
  ok(gEn.includes('Glory to God in the highest') && gEn.includes('data-lt="gloria:la"'), 'C10 Latin toggle (Gloria): English stands on open, the toggle is offered');
  ok(gLa.includes('Glória in excélsis Deo') && !gLa.includes('Glory to God in the highest'), 'C11 Latin toggle (Gloria): Latin renders its proven text');
  ok(gBack === gEn, 'C12 Latin toggle (Gloria): switching back restores English exactly');
  ok(part('kyrie', 'la').includes('Kýrie eléison') && part('kyrie').includes('data-lt="kyrie:la"'), 'C13 Latin toggle (Kyrie): the Greek form as printed renders (no forced Latin)');
  ok(part('agnus', 'la').includes('Agnus Dei, qui tollis'), 'C14 Latin toggle (Agnus Dei): Latin renders its proven text');
  ok(part('sanctus', 'la').includes('Sanctus, sanctus, sanctus') || part('sanctus', 'la').includes('Sanctus, Sanctus, Sanctus'), 'C15 Latin toggle (Sanctus): Latin renders its proven text');
  const creed = part('creed', 'la');
  ok(!creed.includes('data-lt=') && creed.includes('I believe in one God'), 'C16 the Creed carries NO Latin toggle (its Latin is unproven — §3) and renders English');
  ok(!('creed' in ctx.MASS_LATIN) && !('pater' in ctx.MASS_LATIN), 'C17 MASS_LATIN carries no creed/pater keys (unproven parts are absent, never invented)');
  ok(['gloria', 'sanctus', 'agnus', 'kyrie'].every((k) => Array.isArray(ctx.MASS_LATIN[k]) && ctx.MASS_LATIN[k].length >= 5), 'C18 MASS_LATIN carries the four proven parts (gloria · sanctus · agnus · kyrie)');
}

/* ---------------- W: wiring statics ---------------- */
ok(I_SRC.includes('from "./mass"') && I_SRC.includes('seg[2] === "mass"'), 'W1 the Worker wires the session mass route from mass.ts');
ok(fs.existsSync(ROOT + '/app/migrations/0031_mass_cache.sql') && fs.readFileSync(ROOT + '/app/migrations/0031_mass_cache.sql', 'utf8').includes('CREATE TABLE mass_cache'), 'W2 migration 0031 creates the mass_cache table');
ok(COOKED.includes('https://universalis.com/') && COOKED.includes('jsonpmass.js?callback=universalisCallback'), 'W3 the client loads readings by the sanctioned JSONP route (no scraping, no server fetch)');
ok(!M_SRC.includes('universalis'), 'W4 the Worker never fetches Universalis (its terms forbid server-side scraping)');

console.log('\nharness-v486: ' + pass + ' ok, ' + fail + ' not ok');
process.exit(fail ? 1 : 0);
