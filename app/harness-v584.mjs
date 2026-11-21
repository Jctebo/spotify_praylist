// harness-v584.mjs — v584 PIN screen universally large.
//
// The PIN pad renders FULL LARGE everywhere it stands
// (Q1 A): keys 88px · digits 30px · PIN dots 18px · hint
// 19px; on narrow phones the pad scales to the row width
// and keeps its proportions. PRESENTATION ONLY — PIN
// behavior, the v578 vault machinery, and where a PIN is
// required do not change.
//
// Plan's component finding (release doc §2): ONE pad
// painter — renderPinGate (Conscience gate + Settings-
// section gate) — and ONE dress — APP_CSS in ui.ts,
// served at /styles.css. The v578 vault unlock paints no
// pad (typed PIN field). So the change is confined to the
// pin dress block of ui.ts.
//
// Behavior proof for a dress-only change: client.ts and
// index.ts stand BYTE-IDENTICAL to BASE (the gate's
// verify path and the server routes cannot have moved),
// the rendered client parses whole, and the gate's pad
// markup + verify seams stand in the rendered client.
//
// Run: node harness-v584.mjs [BASE_SHA]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = new URL('.', import.meta.url).pathname;
const BASE = process.argv[2] || '63070947e7a97256d12cd8a2c2d95116bf155a88';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync('git', args, { cwd: APP + '..', encoding: 'utf8' });
const SRC = APP + 'worker/src/';

// ---------- S-legs: confinement + behavior untouched ----------
const changed = git(['diff', '--name-only', BASE, '--', 'app'])
  .split('\n').filter(Boolean).map((p) => p.replace(/^app\//, ''));
const allowed = new Set(['worker/src/ui.ts', 'harness-v584.mjs']);
check('S1 diff confined to ui.ts + harness', changed.every((p) => allowed.has(p)), changed);
const migChanged = git(['diff', '--name-only', BASE, '--', 'app/migrations']).trim();
check('S2 migrations unchanged vs BASE', migChanged === '', migChanged);
const clientDiff = git(['diff', BASE, '--', 'app/worker/src/client.ts']).trim();
check('S3 client.ts byte-identical to BASE (gate + verify machinery untouched)', clientDiff === '');
const indexDiff = git(['diff', BASE, '--', 'app/worker/src/index.ts']).trim();
check('S4 index.ts byte-identical to BASE (server routes untouched)', indexDiff === '');
const uiDiff = git(['diff', BASE, '--', 'app/worker/src/ui.ts']);
const touched = uiDiff.split('\n').filter((l) => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
const pinLine = /pinpad|pindot|pingate|@media \(max-width:340px\)|aspect-ratio|v584|FULL LARGE|narrow phones|its proportions|keys stay round|18px, hint 19px/;
check('S5 ui.ts diff touches only the pin dress block', touched.every((l) => pinLine.test(l)), touched.filter((l) => !pinLine.test(l)));
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const uiSrc = readFileSync(SRC + 'ui.ts', 'utf8');
const baseUi = git(['show', BASE + ':app/worker/src/ui.ts']);
check('S6 SW pin unmoved vs BASE pre-Ship', pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });

// ---------- render APP_CSS exactly as the Worker serves it ----------
const cssStart = uiSrc.indexOf('export const APP_CSS = `') + 'export const APP_CSS = `'.length;
const cssEnd = uiSrc.indexOf('\n`;', cssStart);
if (cssStart < 25 || cssEnd < 0) { console.log('not ok - APP_CSS template markers'); process.exit(1); }
const appCss = vm.runInContext('`' + uiSrc.slice(cssStart, cssEnd) + '`', vm.createContext({}));
const rule = (sel) => {
  const i = appCss.indexOf(sel + ' {');
  if (i < 0) return '';
  return appCss.slice(i, appCss.indexOf('}', i));
};
const btn = rule('.pinpad button');
check('R1 keys stand 88px in the rendered stylesheet', btn.includes('width:88px') && btn.includes('height:88px'), btn);
check('R2 digits stand 30px', btn.includes('font-size:30px'), btn);
check('R3 the pad grid carries the 88px columns', rule('.pinpad').includes('grid-template-columns:repeat(3, 88px)'), rule('.pinpad'));
const dot = rule('.pindot');
check('R4 dots stand 18px', dot.includes('width:18px') && dot.includes('height:18px'), dot);
check('R5 the hint (lockline) stands 19px', rule('.pingate .lockline').includes('font-size:19px'), rule('.pingate .lockline'));
const mediaAt = appCss.indexOf('@media (max-width:340px)');
const media = mediaAt < 0 ? '' : appCss.slice(mediaAt, appCss.indexOf('}', appCss.indexOf('.pinpad button', mediaAt)) + 1);
check('R6 narrow phones: the pad scales to the row width, proportions kept',
  media.includes('grid-template-columns:repeat(3, 1fr)') && media.includes('width:100%') && media.includes('aspect-ratio:1'), media);
check('R7 the old dress is gone (no 64px keys, no 14px dots, no 17px hint, no 20px digits)',
  !btn.includes('64px') && !dot.includes('14px') && !rule('.pingate .lockline').includes('17px') && !btn.includes('font-size:20px'),
  { btn, dot });

// ---------- render APP_JS exactly as the Worker serves it ----------
const clientSrc = readFileSync(SRC + 'client.ts', 'utf8');
const tplStart = clientSrc.indexOf('= `') + 3;
const tplEnd = clientSrc.indexOf('\n`;', tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log('not ok - APP_JS template markers'); process.exit(1); }
const appJs = vm.runInContext('`' + clientSrc.slice(tplStart, tplEnd) + '`', vm.createContext({}));
{
  let parses = true, perr = '';
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check('R8 rendered client (APP_JS) parses whole', parses, perr);
}
check('R9 the one pad painter stands in the rendered client (renderPinGate + pinpad + pindots)',
  appJs.includes('function renderPinGate') && appJs.includes('class="pinpad"') && appJs.includes('class="pindots"'));
check('R10 the PIN verify seams stand (gate verify + vault unlock verify + recover)',
  appJs.includes("post('/api/pin/verify'") && appJs.includes("post('/api/pin/recover'"));
check('R11 the vault unlock paints no pad of its own (typed field — one dress reaches every pad)',
  appJs.includes('id="opn-unlock-pin"') && !appJs.slice(appJs.indexOf('function opnUnlockCardHtml'), appJs.indexOf('function opnBindUnlockCard')).includes('pinpad'));

console.log(`\n${ok} ok / ${bad} not ok`);
process.exit(bad ? 1 : 0);
