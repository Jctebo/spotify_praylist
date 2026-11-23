// harness-v636.mjs — v636: Ora's OWN morning prayer (the
// traditional morning offering with baptismal renewal,
// renunciations, and the custom Litany of the Saints) is
// renamed from 'Morning Prayer' to 'Morning Offering
// (Extended)', going forward only (John, 2026-11-23).
// Published feed history keeps the old name; the Divine
// Office's Morning Prayer keeps its name everywhere.
//
// Identity verdict under test (Scope-verified, §1.1):
// identity never rides the name. Profile contents items
// key on the sourceKey ('morning-prayer' for own rows —
// opnMigrateProfileRecord609's standing list,
// opnCheckContents590); played marks key on the canonical
// episode id ('morning-prayer' — PLAYED_KEY opn-played-v344,
// playedKey/descMarkKey). The sourceKey itself therefore
// stands unchanged and NO contents migration runs. The ONE
// stored copy of the name is the source-settings row's
// name field (the settings PUT never writes name, nothing
// reconciles it): under the coordinator's plan pick, paint
// resolves a seed source's display name from the SEED by
// sourceKey (opnSeedDisplayName636) at the seams that read
// the stored name — the Source mapping paint, its family
// label, and the own-standing rows behind the Praylist
// rows and the contents-universe labels. No stored data
// is written; John's document stands byte-identical.
//
// Legs:
//  1. Surfaces (grep + paint): the seed source name, the
//     Worker INTRO_PAIRING value, the placeholder/missing
//     row paint (ownPlaceholderCard) and the ownSlotTrack
//     adapter all carry the new name for the own prayer.
//     ownSlotTrack with a present meta carries the META's
//     title — present rows + Now Playing follow the feed
//     episode title, so they rename only for new episodes
//     (John's going-forward-only reach).
//  2. World (John's exported document, Improvement D
//     fixture): opnSeedDisplayName636 over John's stored
//     rows returns the new name for the own row and the
//     standing names for the Divine Office rows, while the
//     document itself stands byte-identical after every
//     resolution (no stored-data write); the paint seams
//     read the helper (grep legs); a contents item
//     {kind:'source', key:'morning-prayer'} stands valid
//     under the real opnCheckContents590; and the played-
//     key seam (real playedKey/descMarkKey) keys on the
//     episode id, never the name.
//  3. The Divine Office Morning Prayer stands untouched
//     beside it: seed row do-morning-prayer, INTRO_PAIRING
//     ext-morning-prayer, EXT_SLOTS / EXT_DO_SLOTS titles,
//     and John's stored do-morning-prayer row all keep
//     their names; the migration does not touch that row.
//  4. Fork naming (~/workspace/projects/spotify_praylist-fork,
//     branch muse-draft-week): the publish contract's
//     title_template renders the new name for a fixture
//     date (2026-11-25), the daily-intro context carries
//     the new prayer_title/devotion, and a dry python call
//     of the real compose pairing_for('morning-prayer')
//     returns the new name while the Divine Office slot
//     pairing stands unchanged. Nothing already published
//     is rewritten — the fork change touches only the
//     contract template, the intro context, and the
//     pairing value (forward-looking producers).
//
// ◆ legs 1-2 fail on the base tree (56c156b): the seed and
// pairing stand at the old name there and
// opnRenameMorningOffering636 does not exist.
//
// Run: node app/worker/harness-v636.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const HERE = new URL('.', import.meta.url).pathname;
const FORK = process.env.HOME + '/workspace/projects/spotify_praylist-fork/';
const NEW = 'Morning Offering (Extended)';
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok -', name); }
  else { bad++; console.log('not ok -', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}
const clientSrc = readFileSync(HERE + 'src/client.ts', 'utf8');
const indexSrc = readFileSync(HERE + 'src/index.ts', 'utf8');
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let depth = 0, i = src.indexOf('{', at);
  const start = at;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); } }
  return '';
};

// ---------- leg 1: surfaces ----------
const seedAt = clientSrc.indexOf('var OPN_SEED_SOURCES = ');
const seedJson = clientSrc.slice(seedAt, clientSrc.indexOf('];', seedAt) + 1).replace('var OPN_SEED_SOURCES = ', '').replace(/;$/, '');
const SEED = JSON.parse(seedJson);
const ownSeed = SEED.find((r) => r.sourceKey === 'morning-prayer');
check('1a ◆ seed: own morning-prayer row carries the new name, sourceKey unchanged',
  !!ownSeed && ownSeed.name === NEW && ownSeed.sourceKey === 'morning-prayer', ownSeed);
check('1b ◆ Worker INTRO_PAIRING: "morning-prayer" maps to the new name',
  indexSrc.includes('"morning-prayer": "Morning Offering (Extended)"'));
const ctx = vm.createContext({ state: { repeatIds: {} } });
for (const fn of ['esc', 'ownPlaceholderCard', 'ownSlotTrack', 'opnSeedDisplayName636']) {
  const f = grab(clientSrc, fn); if (f) vm.runInContext(f, ctx);
}
// the seed array rides along for the helper
vm.runInContext(clientSrc.slice(seedAt, clientSrc.indexOf('];', seedAt) + 2), ctx);
const JOHN0 = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
const johnRow = JOHN0.sections.config.sourceSettings.sources.find((r) => r.sourceKey === 'morning-prayer');
let resolvedTitle = '';
try { resolvedTitle = vm.runInContext('opnSeedDisplayName636(johnRow)', Object.assign(ctx, { johnRow })); } catch (e) { resolvedTitle = ''; }
const ph = vm.runInContext(`ownPlaceholderCard({ episodeId: 'morning-prayer', title: ${JSON.stringify(resolvedTitle)} })`, ctx);
check('1c ◆ paint: the placeholder/missing row paints the new name and not the old',
  ph.includes(NEW) && !ph.includes('>Morning Prayer<'), ph);
const missing = vm.runInContext(`ownSlotTrack({ sourceKey: 'morning-prayer', episodeId: 'morning-prayer', title: ${JSON.stringify(resolvedTitle)}, block: 'Morning' }, null, '2026-11-25')`, ctx);
check('1d ◆ ownSlotTrack (no meta): title is the source name — the new name',
  missing.title === NEW, missing);
const present = vm.runInContext(`ownSlotTrack({ sourceKey: 'morning-prayer', episodeId: 'morning-prayer', title: ${JSON.stringify(resolvedTitle)}, block: 'Morning' }, { episodeId: 'morning-prayer', title: 'Morning Offering (Extended) - November 25, 2026', state: 'present', streamUrl: 'https://example.invalid/a.mp3' }, '2026-11-25')`, ctx);
check('1e ownSlotTrack (present meta): title follows the EPISODE title (feed surface — new episodes only)',
  present.title === 'Morning Offering (Extended) - November 25, 2026', present);

// ---------- leg 2: John's world ----------
const JOHN = JOHN0;
const helperSrc = grab(clientSrc, 'opnSeedDisplayName636');
check('2a ◆ the seed display-name resolution stands in the client', helperSrc.length > 0);
const world = JSON.parse(JSON.stringify(JOHN));
const wctx = vm.createContext({ world });
vm.runInContext(clientSrc.slice(seedAt, clientSrc.indexOf('];', seedAt) + 2), wctx);
if (helperSrc) vm.runInContext(helperSrc, wctx);
const disp = (key) => { try { return vm.runInContext(`opnSeedDisplayName636(world.sections.config.sourceSettings.sources.find((r) => r.sourceKey === ${JSON.stringify(key)}))`, wctx); } catch (e) { return ''; } };
check('2b ◆ resolution: John\'s stored own row (stored name still "Morning Prayer") displays under the new name',
  helperSrc.length > 0 && disp('morning-prayer') === NEW, helperSrc ? disp('morning-prayer') : 'no helper');
check('2c ◆ no stored-data write: John\'s document stands byte-identical after every resolution',
  JSON.stringify(world) === JSON.stringify(JOHN));
check('2d ◆ paint seams read the helper: own-standing title, Source mapping name, family label',
  clientSrc.includes('title: opnSeedDisplayName636(s), enabled: s.enabled')
  && clientSrc.includes("esc(opnSeedDisplayName636(row))")
  && clientSrc.includes("opnSeedDisplayName636(row).split(' — ')[0]"));
check('2e ◆ no migration/write seam was added for the name (the helper writes nothing, no rename function stands)',
  !clientSrc.includes('opnRenameMorningOffering636') && !/localStorage|opnSave/.test(helperSrc.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')), helperSrc.slice(0, 120));
// contents validity under the real validator: HOURS + opnErr stubs
const cctx = vm.createContext({ HOURS: ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'], EXT_TOKENS: {} });
vm.runInContext('function opnErr(status, message) { var e = new Error(message); e.status = status; return e; }', cctx);
const chkSrc = grab(clientSrc, 'opnCheckContents590');
if (chkSrc) vm.runInContext(chkSrc, cctx);
let contentsOk = false, contentsErr = '';
try {
  const r = vm.runInContext(`opnCheckContents590({ Morning: [{ kind: 'source', key: 'morning-prayer' }, { kind: 'source', key: 'ext-morning-prayer' }] }, ['Morning'])`, cctx);
  contentsOk = JSON.stringify(r) === JSON.stringify({ Morning: [{ kind: 'source', key: 'morning-prayer' }, { kind: 'source', key: 'ext-morning-prayer' }] });
} catch (e) { contentsErr = e.message; }
check('2f ◆ a saved contents item {kind:source, key:morning-prayer} stands valid after the rename (identity rides the key)',
  contentsOk, contentsErr);
// played-key seam: real playedKey/descMarkKey over a stub state
const pctx = vm.createContext({ state: { repeatIds: {} } });
for (const fn of ['playedKey', 'playedKeyOcc', 'descMarkKey']) {
  const f = grab(clientSrc, fn); if (f) vm.runInContext(f, pctx);
}
const pk = vm.runInContext(`playedKey('morning-prayer', 'Morning')`, pctx);
const dk = vm.runInContext(`descMarkKey({ episodeId: 'morning-prayer', block: 'Morning' })`, pctx);
check('2g ◆ played marks key on the canonical episode id, never the name (keys unchanged by the rename)',
  pk === 'morning-prayer' && dk === 'morning-prayer', { pk, dk });

// ---------- leg 3: Divine Office untouched ----------
const doSeed = SEED.find((r) => r.sourceKey === 'do-morning-prayer');
check('3a seed: Divine Office — Morning Prayer row keeps its name',
  !!doSeed && doSeed.name === 'Divine Office \\u2014 Morning Prayer', doSeed);
check('3b Worker INTRO_PAIRING: ext-morning-prayer keeps "Morning Prayer (Liturgy of the Hours)"',
  indexSrc.includes('"ext-morning-prayer": "Morning Prayer (Liturgy of the Hours)"'));
check('3c client EXT_SLOTS + Worker EXT_DO_SLOTS: the Divine Office slot title stays "Morning Prayer"',
  clientSrc.includes("{ slotId: 'ext-morning-prayer', title: 'Morning Prayer', fallbackToken: 'Lauds' }")
  && indexSrc.includes('{ slotId: "ext-morning-prayer", title: "Morning Prayer", tokenKey: "DO_MORNING" }'));
const doRow = world.sections.config.sourceSettings.sources.find((r) => r.sourceKey === 'do-morning-prayer');
check('3e resolution: the Divine Office row displays its standing seed name, not the new name',
  helperSrc.length > 0 && disp('do-morning-prayer') === doSeed.name, helperSrc ? disp('do-morning-prayer') : 'no helper');
check('3d John\'s stored Divine Office row stands untouched (stored name intact, resolution returns its seed name)',
  !!doRow && doRow.name === 'Divine Office — Morning Prayer', doRow);

// ---------- leg 4: fork naming ----------
const contract = JSON.parse(readFileSync(FORK + 'config/publish/contracts/morning-prayer.json', 'utf8'));
const tpl = contract.contract.metadata.title_template;
const rendered = tpl.replace('{date:%B %-d, %Y}', 'November 25, 2026');
check('4a fork contract title_template renders the new name for the fixture date 2026-11-25',
  rendered === 'Morning Offering (Extended) - November 25, 2026', rendered);
check('4b fork contract entry title/text + description carry the new name; episode id template unchanged',
  contract.entries[0].title === NEW && contract.entries[0].text === NEW
  && contract.contract.metadata.description_template.startsWith('Morning Offering (Extended) for ')
  && contract.contract.metadata.episode_id_template === '{entry_id}-{date_iso}',
  contract.entries[0].title);
const spot = JSON.parse(readFileSync(FORK + 'config/spotify/contracts/morning-prayer.json', 'utf8'));
const loh = JSON.parse(readFileSync(FORK + 'config/spotify/contracts/morning-prayer-loh.json', 'utf8'));
check('4c fork Spotify contract: required_name_terms moves with the template (new episodes keep matching into the Morning playlist)',
  JSON.stringify(spot.spotify_episode_lookup.required_name_terms) === JSON.stringify([NEW]), spot.spotify_episode_lookup.required_name_terms);
check('4e fork Spotify sibling: the Divine Office (LOH) contract stands untouched',
  loh.name === 'Morning Prayer (LOH)' && loh.key === 'morning-prayer-loh', loh);
let dry = '', dryErr = '';
try {
  dry = execFileSync('python3', ['-c', "from jobs.compose_app_audio import OWN_PAIRING, SLOT_PAIRING, pairing_for; print(pairing_for('morning-prayer')); print(SLOT_PAIRING['ext-morning-prayer'])"], { cwd: FORK, encoding: 'utf8' });
} catch (e) { dryErr = String(e.message || e); }
check('4d fork dry call: real pairing_for(\'morning-prayer\') returns the new name; Divine Office slot pairing unchanged',
  dry.includes(NEW) && dry.includes('Morning Prayer (Liturgy of the Hours)'), dry || dryErr);

console.log(ok + ' ok, ' + bad + ' not ok');
process.exit(bad ? 1 : 0);
