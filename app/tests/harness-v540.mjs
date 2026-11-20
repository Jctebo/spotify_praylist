// harness-v540.mjs — v540 evidence: the Universal
// Prayer section gains two labeled parts (John, Ora
// thread, 2026-11-18 21:10 CT): a line reading
// "Parish Intentions" over the parish side (the Pope's
// intention + the pinned referencing sentence), then a
// header reading "Private Intention", a line break,
// and John's private intentions under it. Layout
// fix-forward on v527; everything else in the section
// stands unchanged.
// SUBJECT: a tree carrying the v540 build on the v537
// ship lineage. Run from that worktree's root:
//   node app/tests/harness-v540.mjs
// Fixtures (Improvement D — from production, read live
// through the prayer door on 2026-11-19): the REAL
// stored list for 2026-11-18 from
// GET /api/agent/prayer/mass-universal-prayer?date=
// 2026-11-18 (one intention standing) and the REAL
// empty day 2026-11-19 (intentions []). The section
// renderer is extracted from the tree's own client.ts
// and run against those two production lists.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const BASE = path.resolve(ROOT, '../../.worktrees/v537-ship/app/worker/src');

const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');

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
function extractVar(src, name) {
  const m = src.match(new RegExp('var ' + name + " = '[^']*';"));
  return m ? m[0] : null;
}

// ---- the production fixtures -------------------------------------------
// 2026-11-18, read live from the door on 2026-11-19 (one intention):
const FIXTURE_LIST = ['For Sam Shorter, forgive his sins, purify him, and grant him eternal rest in Your presence. Saint Nicholas of Tolentino, pray for them.'];
// 2026-11-19, read live from the door on 2026-11-19 (the empty day):
const FIXTURE_EMPTY = [];

// ---- render the section from the tree's own source ----------------------
function renderSection(src, list) {
  const parts = [
    extractVar(src, 'MASS_UP_POPE'), extractVar(src, 'MASS_UP_SENTENCE'),
    extractVar(src, 'MASS_UP_RESPONSE'), extractVar(src, 'MASS_UP_EMPTY'),
    extractVar(src, 'MASS_UP_INVITATION'),
    extractFn(src, 'massUniversalState'), extractFn(src, 'massUniversalSectionHtml'),
  ];
  if (parts.some((p) => !p)) return null;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const state = { mass: { universal: { intentions: list }, universalOpen: false } };
  const massUniversalEditorHtml = () => '<div class="mu-editor-stub"></div>';
  const factory = new Function('esc', 'state', 'massUniversalEditorHtml',
    parts.join('\n') + '\nreturn massUniversalSectionHtml();');
  return factory(esc, state, massUniversalEditorHtml);
}
const html = renderSection(C_SRC, FIXTURE_LIST);
const htmlEmpty = renderSection(C_SRC, FIXTURE_EMPTY);
const htmlBase = renderSection(C_BASE, FIXTURE_LIST);
ok(html !== null && htmlEmpty !== null && htmlBase !== null, 'R0: the section renderer extracts and runs on both trees');

// ---- P1: the premise — production carries neither label -----------------
ok(htmlBase !== null && !htmlBase.includes('Parish Intentions') && !htmlBase.includes('Private Intention'),
  'P1: premise — the v537 production section carries neither v540 label');

// ---- H1: Parish Intentions over the parish side, in order ---------------
const iParish = html.indexOf('<div class="mass-h">Parish Intentions</div>');
const iPope = html.indexOf('For the Holy Father, Pope Leo XIV.');
const iSentence = html.indexOf('We pray also for the intentions of the Universal Prayer as published locally in this parish');
ok(iParish >= 0, 'H1a: the "Parish Intentions" line stands in the section');
ok(iParish >= 0 && iPope > iParish && iSentence > iPope,
  'H1b: Parish Intentions stands over the Pope intention and the pinned sentence, in that order');

// ---- H2: Private Intention header + line break over the private side ----
const iPrivate = html.indexOf('<div class="mass-h">Private Intention</div>');
const iFixture = html.indexOf(FIXTURE_LIST[0]);
ok(iPrivate > iSentence, 'H2a: the "Private Intention" header stands after the parish side');
ok(iPrivate >= 0 && iFixture > iPrivate, 'H2b: the private intention stands under its header');
const between = html.slice(iPrivate, iFixture);
ok(/<div class="mass-h">Private Intention<\/div>\s*<br>/.test(between),
  'H2c: a line break stands between the Private Intention header and the intentions under it');

// ---- H3: order and intercession form unchanged ---------------------------
const iHead = html.indexOf('<div class="mass-section">The Universal Prayer</div>');
const iSub = html.indexOf('<div class="mass-up-sub">Prayer of the Faithful</div>');
const iInvite = html.indexOf('Brothers and sisters, let us pray.');
const resp = '<div class="mass-line mass-up-response">Lord, hear our prayer.</div>';
ok(iHead >= 0 && iSub > iHead && iInvite > iSub && iParish > iInvite,
  'H3a: heading, smaller line, and invitation stand in v527 order before the parts');
ok(html.indexOf(resp) > iPope && html.indexOf(resp) < iSentence,
  'H3b: the bold response follows the Pope intention, before the sentence');
ok(html.split(resp).length - 1 === 2,
  'H3c: exactly two bold responses — the Pope intention and the one private intention (the sentence carries none, as in v527)');
const iRespAfterFixture = html.indexOf(resp, iFixture);
ok(iRespAfterFixture > iFixture, 'H3d: the private intention reads exactly as written, followed by its bold response');

// ---- H4: the empty day ----------------------------------------------------
const iEmpty = htmlEmpty.indexOf('No private intentions added for today');
const iPrivateE = htmlEmpty.indexOf('<div class="mass-h">Private Intention</div>');
ok(iEmpty > iPrivateE && iPrivateE >= 0,
  'H4a: on the empty day the closing line stands under the Private Intention header');
ok(htmlEmpty.includes('<div class="mass-h">Parish Intentions</div>') &&
   htmlEmpty.includes('We pray also for the intentions of the Universal Prayer as published locally in this parish'),
  'H4b: on the empty day the section still stands whole — parish side present');

// ---- H5: the standing furniture does not move -----------------------------
ok(html.includes('id="mass-universal-edit-btn"') && html.includes('id="mass-universal-point"'),
  'H5: the edit button and the editor host stand as in v527');

// ---- S statics --------------------------------------------------------------
const fnNew = extractFn(C_SRC, 'massUniversalSectionHtml');
const fnBase = extractFn(C_BASE, 'massUniversalSectionHtml');
const strippedNew = C_SRC.replace(fnNew, '');
const strippedBase = C_BASE.replace(fnBase, '');
// the header comment over the function also gains the v540 note; strip it too
const commentNew = (C_SRC.match(/\/\* ---------------- v527: the Universal Prayer intentions[\s\S]*?\*\//) || [''])[0];
const commentBase = (C_BASE.match(/\/\* ---------------- v527: the Universal Prayer intentions[\s\S]*?\*\//) || [''])[0];
ok(strippedNew.replace(commentNew, '') === strippedBase.replace(commentBase, ''),
  'S1: outside the section function and its header comment, client.ts is byte-identical to the production base');
const migs = readdirSync(APP + '/migrations').filter((f) => f.endsWith('.sql')).sort();
ok(migs[migs.length - 1].startsWith('0040'), 'S2: no migration past 0040', migs[migs.length - 1]);
ok(C_SRC.includes("var MASS_UP_SENTENCE = 'We pray also for the intentions of the Universal Prayer as published locally in this parish';"),
  'S3: the pinned referencing sentence stands byte-exact');
ok(U_SRC.includes('.mass-h {'), 'S4: the .mass-h subheading dress the labels ride stands in ui.ts');

console.log('---');
console.log('harness-v540: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) console.log('failures: ' + failures.join(' · '));
process.exit(fail ? 1 : 0);
