// harness-v586.mjs — v586 Lectionary: the Liturgy of the
// Word shows the active reading set + the Collect stands.
//
// Defect 1: the readings-set chips (and the per-part
// option chips) marked the standing button class "on" —
// a word no segtoggle rule defines. The dress's selected
// word is "active" (.segtoggle.pill button.active, the
// Worship pill's dress). The fix emits "active".
// Defect 2: today's standing version (the Presentation
// of the Blessed Virgin Mary) resolved to an EMPTY
// formulary — every candidate saint page 404s on the
// proven source, so the COLLECT heading stood alone.
// The fix: a memorial of the Blessed Virgin Mary with
// no yielding saint page stands the Common of the
// Blessed Virgin Mary whole (the Dedication shape), and
// the saint cache key is versioned so stale empties
// retire at deploy.
//
// Fixtures (Improvement D — all from production,
// captured 2026-11-21 at Plan):
// - tests/fixtures-v586/mass-2026-11-21.json: the live
//   /api/prayer/mass payload for 2026-11-21 (the saint
//   version's formulary stands EMPTY in it — the defect
//   as served).
// - tests/fixtures-v586/mass-readings-2026-11-21.json:
//   the live /api/prayer/mass-readings payload (one
//   memorial with 4 parts — the two-set day).
// - tests/fixtures-v586/src-commons-20261121.htm: the
//   proven source's Commons page, captured the same
//   morning from liturgies.net.
// - tests/fixtures-v486/src-saint-elizabethofhungary.htm:
//   the standing v486 capture of a saint page WITH
//   propers (the regression witness: her own collect
//   stands, the fallback does not fire).
//
// Run: node harness-v586.mjs [BASE_SHA]
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const BASE = process.argv[2] || 'origin/main';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', args, { cwd: APP + '..', encoding: 'utf8' });
const SRC = APP + 'worker/src/';

// ---------- S-legs ----------
const changed = git(['diff', '--name-only', BASE, '--', 'app'])
  .split('\n').filter(Boolean).map((p) => p.replace(/^app\//, ''));
const allowed = new Set(['worker/src/client.ts', 'worker/src/mass.ts', 'harness-v586.mjs',
  'tests/fixtures-v586/src-commons-20261121.htm', 'tests/fixtures-v586/mass-2026-11-21.json',
  'tests/fixtures-v586/mass-readings-2026-11-21.json']);
check('S1 diff confined to client.ts + mass.ts + harness + fixtures', changed.every((p) => allowed.has(p)), changed);
const migChanged = git(['diff', '--name-only', BASE, '--', 'app/migrations']).trim();
check('S2 migrations unchanged vs BASE', migChanged === '', migChanged);
const clientSrc = readFileSync(SRC + 'client.ts', 'utf8');
const massSrc = readFileSync(SRC + 'mass.ts', 'utf8');
const uiSrc = readFileSync(SRC + 'ui.ts', 'utf8');
check('S3 no chip button wears class "on"', !clientSrc.includes('class="on"'));
check('S3 the three chip sites wear class "active"',
  clientSrc.includes("setKey === 'ferial' ? ' class=\"active\"'") && clientSrc.includes("setKey === k ? ' class=\"active\"'") && clientSrc.includes("ci === oi ? ' class=\"active\"'"));
check('S4 the segtoggle pill dress defines the active segment (cream on navy)',
  uiSrc.includes('.segtoggle.pill button.active { background:var(--cream); color:var(--navy); opacity:1;'));
check('S5 mass.ts carries the BVM fallback + helper + versioned saint key',
  massSrc.includes('isBlessedVirginMaryFeast') && massSrc.includes('commonsFormulary(clines, "Common of the Blessed Virgin Mary")') && massSrc.includes('"form:saint:2:"'));
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(['show', BASE + ':app/worker/src/ui.ts']);
check('S6 SW pin unmoved vs BASE pre-Ship', pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const massFixture = JSON.parse(readFileSync(APP + 'tests/fixtures-v586/mass-2026-11-21.json', 'utf8'));
const saintVer = massFixture.versions.find((v) => v.key.startsWith('saint-'));
check('S7 production fixture: the saint formulary stood EMPTY as served (the defect)',
  saintVer && Object.keys(saintVer.formulary || {}).length === 0, saintVer && Object.keys(saintVer.formulary || {}));

// ---------- render APP_JS exactly as the Worker serves it ----------
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('S8 served client (rendered APP_JS) parses whole', parses, perr);
}

// ---------- C-legs: the chips in a vm world over the rendered client ----------
function slice(from, to) {
  const a = appJs.indexOf(from);
  const b = appJs.indexOf(to, a + 1);
  if (a < 0 || b < 0) { console.log('not ok - slice markers', from, '->', to); process.exit(1); }
  return appJs.slice(a, b);
}
const escText = slice('function esc(s)', '\nfunction ');
const entitiesText = slice('var MASS_NAMED_ENTITIES', '};\n') + '};\n' + slice('function massDecodeEntities', '\nfunction ');
const massText = slice('function massFeedLinesHtml', '\nfunction massAcksHtml()');
const readingsFixture = JSON.parse(readFileSync(APP + 'tests/fixtures-v586/mass-readings-2026-11-21.json', 'utf8'));

function makeWorld(feed) {
  const host = {
    _html: '',
    _cacheHtml: null,
    _cache: {},
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    querySelectorAll(sel) {
      // Button stubs are cached per painted HTML, so the
      // stubs wireMassChips wired are the stubs a click
      // lands on (a fresh stub per call would strand the
      // handlers on objects nothing can click).
      if (this._cacheHtml !== this._html) { this._cacheHtml = this._html; this._cache = {}; }
      const attr = sel.includes('rset') ? 'data-rset' : 'data-rchoice';
      if (this._cache[attr]) return this._cache[attr];
      const out = [];
      const re = new RegExp('<button[^>]*' + attr + '="([^"]*)"[^>]*>', 'g');
      let m;
      while ((m = re.exec(this._html))) {
        const tag = m[0], val = m[1];
        const btn = {
          _handlers: [],
          getAttribute(n) { return n === attr ? val : (n === 'class' ? (tag.match(/class="([^"]*)"/) || [])[1] || null : null); },
          addEventListener(ev, fn) { this._handlers.push(fn); },
          click() { this._handlers.forEach((fn) => fn.call(this)); },
        };
        out.push(btn);
      }
      this._cache[attr] = out;
      return out;
    },
  };
  const world = {
    console,
    document: { getElementById: (id) => (id === 'mass-readings' ? host : null) },
    __host: host,
  };
  vm.createContext(world);
  vm.runInContext('var massFeed = null, massReadings = null, massUsedFallback = false;\nvar state = { mass: { version: "", rsetFor: "", rset: "mem:0", rchoices: {} } };', world);
  vm.runInContext(escText + '\n' + entitiesText + '\n' + massText, world);
  return world;
}
const world = makeWorld();
vm.runInContext('massFeed = ' + JSON.stringify(readingsFixture) + ';', world);
const chips1 = vm.runInContext('massReadingsChipsHtml()', world);
check('C1 the standing memorial chip wears class "active"',
  /data-rset="mem:0" class="active"/.test(chips1) || /data-rset="mem:0"[^>]*class="active"/.test(chips1), chips1.slice(0, 220));
check('C1 the Weekday chip does not wear it', !/data-rset="ferial"[^>]*class="active"/.test(chips1));
check('C1 no chip wears class "on"', !chips1.includes('class="on"'));
vm.runInContext('paintMassReadings()', world);
const host = world.__host;
const setBtns = host.querySelectorAll('[data-rset]');
check('C2 the painted host wires both set chips', setBtns.length === 2, setBtns.length);
const weekdayBtn = setBtns.find((b) => b.getAttribute('data-rset') === 'ferial');
weekdayBtn.click();
check('C2 after the tap, the standing set is ferial', vm.runInContext('state.mass.rset', world) === 'ferial');
check('C2 after the tap, Weekday wears class "active" in the repaint',
  /data-rset="ferial"[^>]*class="active"/.test(host.innerHTML) && !/data-rset="mem:0"[^>]*class="active"/.test(host.innerHTML),
  host.innerHTML.slice(0, 220));
// option chips: a derived fixture — the feed's first part gains two options
const feed2 = JSON.parse(JSON.stringify(readingsFixture));
feed2.parts[0].options = [
  { heading: feed2.parts[0].heading, source: 'Apocalypse 11:4-12', html: feed2.parts[0].html },
  { heading: feed2.parts[0].heading, source: 'Daniel 12:1-3', html: '<p>At that time Michael shall arise.</p>' },
];
feed2.parts[0].key = feed2.parts[0].key || 'r1';
vm.runInContext('massFeed = ' + JSON.stringify(feed2) + '; state.mass.rchoices = {}; state.mass.rset = "ferial"; state.mass.rsetFor = "";', world);
const readingsHtml = vm.runInContext('massReadingsHtml()', world);
check('C3 the standing option chip wears class "active"', /data-rchoice="[^"]*" class="active"/.test(readingsHtml) || /data-rchoice="[^"]*"[^>]*class="active"/.test(readingsHtml), readingsHtml.slice(0, 300));
check('C3 no option chip wears class "on"', !readingsHtml.includes('class="on"'));

// ---------- M-legs: the REAL mass.ts (esbuild bundle) over fixture pages ----------
const TMP = mkdtempSync(tmpdir() + '/v586-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [SRC + 'mass.ts', '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/mass.cjs'], { stdio: 'pipe' });
const MASS = await import(TMP + '/mass.cjs');
const commonsBody = readFileSync(APP + 'tests/fixtures-v586/src-commons-20261121.htm', 'utf8');
const elizabethBody = readFileSync(APP + 'tests/fixtures-v486/src-saint-elizabethofhungary.htm', 'utf8');
const pages = new Map([
  ['http://www.liturgies.net/Liturgies/Catholic/roman_missal/roman_missal_commons.htm', commonsBody],
  ['https://www.liturgies.net/saints/elizabethofhungary/readings.htm', elizabethBody],
]);
globalThis.fetch = async (url) => {
  const body = pages.get(String(url));
  if (body === undefined) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => body };
};
const envStub = { DB: { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) }) } };
const presentation = { key: 'saint-presentationofblessedvirginmary', label: 'The Presentation of the Blessed Virgin Mary', kind: 'saint', slug: 'presentationofblessedvirginmary', slugs: ['presentationofblessedvirginmary', 'presentationofblessedvirgin', 'presentationofblessed', 'presentationof'], rank: 'M' };
const fPres = await MASS.resolveFormulary(envStub, presentation);
check('M1 the Presentation resolves a Collect from the Common of the BVM',
  typeof fPres.collect === 'string' && fPres.collect.length > 40, fPres.collect);
check('M1 the Collect is the Commons fixture\u2019s first BVM collect (verbatim extraction)',
  typeof fPres.collect === 'string' && fPres.collect.startsWith('Grant, Lord God, that we, your servants'), fPres.collect);
check('M1 the whole formulary stands (antiphons + prayers)', !!(fPres.entranceAntiphon && fPres.prayerOverOfferings && fPres.prayerAfterCommunion));
const elizabeth = { key: 'saint-elizabethofhungary', label: 'Saint Elizabeth of Hungary, Religious', kind: 'saint', slug: 'elizabethofhungary', slugs: ['elizabethofhungary', 'elizabethof', 'elizabeth'], rank: 'M' };
const fEliz = await MASS.resolveFormulary(envStub, elizabeth);
check('M2 a saint with a standing page keeps her own Collect (fallback does not fire)',
  typeof fEliz.collect === 'string' && fEliz.collect.length > 20 && fEliz.collect !== fPres.collect, fEliz.collect);
const joseph = { key: 'saint-joseph', label: 'Saint Joseph, Spouse of the Blessed Virgin Mary', kind: 'saint', slug: 'joseph', slugs: ['joseph'], rank: 'S' };
const fJos = await MASS.resolveFormulary(envStub, joseph);
check('M3 St Joseph is NOT a BVM feast for the fallback (absent stands when his page does not yield)',
  Object.keys(fJos).length === 0, Object.keys(fJos));
const scholastica = { key: 'saint-scholastica', label: 'Saint Scholastica, Virgin', kind: 'saint', slug: 'scholastica', slugs: ['scholastica'], rank: 'M' };
const fSch = await MASS.resolveFormulary(envStub, scholastica);
check('M4 a non-Marian saint with no yielding page still stands absent', Object.keys(fSch).length === 0, Object.keys(fSch));

console.log('harness-v586:', ok, 'ok /', bad, 'not-ok');
process.exit(bad ? 1 : 0);
