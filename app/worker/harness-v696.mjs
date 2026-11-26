// harness-v696.mjs — v696: prayer text not coming through —
// the Read sheet paints the track's own descText sub-line
// (the hardcoded placeholder is deleted), trackDesc restores
// the hasText/textUrl seat, and a genuinely text-less track
// paints an honest empty body (Plan §2.6).
//
// Chromium (playwright-core) harness, modeled on
// harness-v676.mjs: the REAL built Worker bundle (esbuild
// from source) served locally, fetch stubbed in-page,
// ORA_WT selects the tree for the fail-on-old run.
//
// Fixture (Improvement D — production sources named):
//  - The real 2026-11-26 morning-prayer record in
//    ownSlotTrack output shape, drawn from the live feed
//    item docs/podcast.xml:27 — title after the ownFeedTitle
//    strip "Morning Offering (Extended)", enclosure
//    https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-26.mp3,
//    length 3868701, description "Morning Offering
//    (Extended) for November 26, 2026. The daily opening
//    prays with the selected saint witness and an approved
//    saying, alongside the liturgical day."
//  - The episode's real script bytes from its transcript
//    file (runner rundir 2026-11-26 script-morning-prayer.txt,
//    byte-identical to the public transcript
//    morning-prayer-elevenlabs-2026-11-26.txt per the
//    _publish_app_texts rule): SCRIPT below. Its Morning
//    Offering block opens "Morning Offering - O Jesus,
//    through the Immaculate Heart of Mary and the Chaste
//    Heart of St. Joseph,".
//  - Second own family: daily-rosary, same date — feed item
//    docs/podcast.xml (Daily Rosary, enclosure length
//    18934149) + the opening of its real script file
//    (script-daily-rosary.txt, first 1200 chars).
//  - Office control: harness-v676's officeFx shape
//    (ext-morning-prayer × Divine Office, provider descText).
//
// Fetch stub: /api/player/text/2026-11-26/morning-prayer →
// 200 with SCRIPT when window.__textMode === 'ok', 404 when
// '404'; /api/player/text/2026-11-26/daily-rosary → 200
// with ROSARY_SCRIPT; every other URL hangs (never
// resolves), as in harness-v676.
//
// Legs (Plan §2.6): A words come through + own sub-line ·
// B seam carries hasText/textUrl (and the text-less shape) ·
// C honest empty on 404 and on textUrl:null · D placeholder
// sweep (3 apostrophe forms) over a second own family +
// the built client source · E office control unchanged.
//
// Run: node app/worker/harness-v696.mjs
//      ORA_WT=/path/to/old-tree node /path/to/harness-v696.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

const SCRIPT = "Welcome to Ora Pro Nobis. Where we pray with the saints.\n\nAs we begin Morning Prayer on Thursday, November 26, 2026, the Church celebrates St. Sylvester, Abbot, held today as a private devotion from the Roman Martyrology. In Ordinary Time we take up trustful perseverance and faithful prayer. Today's Gospel is Luke 17:11-19, where ten lepers are cleansed and one, a Samaritan, returns to give thanks. We ask St. Sylvester to intercede for us, and we offer this whole day to God.\n\nMorning Offering - O Jesus, through the Immaculate Heart of Mary and the Chaste Heart of St. Joseph,\nI offer You my prayers, works, joys, and sufferings of this day,\nin union with the Holy Sacrifice of the Mass throughout the world,\nfor all the intentions of Your Sacred Heart,\nin reparation for my sins,\nfor the intentions of all my relatives and friends,\nand in particular for the intentions of the Holy Father.\nI wish to gain all the indulgences attached to the prayers I shall say\nand the good works I shall perform this day.\n\nDaily Consecration - O Mary, my Queen and my Mother,\nO Joseph, my father and guardian,\nto you I consecrate this day all that I am and have:\nmy eyes, my ears, my mouth, my heart,\nmy whole being without reserve.\nProtect me, guide me, and guard me as your own possession.\nAssist me to know and love more deeply the Heart of Jesus,\nto live faithfully this day in His grace,\nand defend me at the hour of my death.\n\nBaptismal Renewal - O Jesus,\nin whom I was made a new creation through Holy Baptism,\nreceive my life anew this day.\n\nMake me a living offering of praise\nto the glory of the Father.\n\nI renounce sin and Satan,\nand I renew the promises of my baptism:\nto live in the freedom of the children of God,\nto reject the empty promises of evil,\nand to follow You in faith, hope, and charity.\n\nMay the grace of my baptism bear fruit\nin every word, thought, and action this day;\nand grant that I may persevere in grace\nunto life everlasting.\n\nAmen.\n\nPetitions.\nIn union with the Church and all the angels and saints,\n\nFor the Holy Father's November intention: that wealth may be used responsibly for the common good, we entrust this intention to God through the prayers and purification of the Holy Souls in Purgatory.\n\nFor the healing and sanctification of families, for reconciliation where there is division, for children without both parents through death, divorce, or abandonment,\nand for families suffering economic hardship.\n\nFor the sanctification and strength of marriages, for fidelity in vocations, and for my own ongoing conversion and growth in holiness.\n\nFor the conversion of sinners, especially those in positions of influence,\n\nFor the sanctification and strength of the Church in every land.\n\nFor the sick suffering, and for the faithful departed, especially our family members\n\nLitany of the Saints\nLord, have mercy.\nLord, have mercy.\nChrist, have mercy.\nChrist, have mercy.\nLord, have mercy.\nLord, have mercy.\nHoly Mary, Mother of God,\npray for us.\nSaint Joseph,\npray for us.\nSaint Michael the Archangel,\npray for us.\nSaint Gabriel the Archangel,\npray for us.\nSaint Raphael the Archangel,\npray for us.\nSaint John the Baptist,\npray for us.\nSaint Peter and Saint Paul,\npray for us.\nSaint John the Apostle,\npray for us.\nSaint Teresa of \u00c1vila,\npray for us.\nSaint Andrew,\npray for us.\nSaint Edmund Campion,\npray for us.\nSaint Barbara,\npray for us.\nSaint John Damascene,\npray for us.\nSaint Th\u00e9r\u00e8se of Lisieux,\npray for us.\nSaint John Bosco,\npray for us.\nSaint Thomas More,\npray for us.\nSaint Francis de Sales,\npray for us.\nSaint Isidore of Seville,\npray for us.\nSaint Albert the Great,\npray for us.\nSaint Maximilian Kolbe,\npray for us.\nSaint John Paul II,\npray for us.\nSaint Teresa of Calcutta,\npray for us.\nSaint Elizabeth of Hungary,\npray for us.\nSaint Sebastian,\npray for us.\nSaint Pier Giorgio Frassati,\npray for us.\nSaint Mark,\npray for us.\nSaint Angela Merici,\npray for us.\nSaint Josemar\u00eda Escriv\u00e1,\npray for us.\nSaint Carlo Acutis,\npray for us.\nAll holy men and women, Saints of God,\npray for us.\n";
const ROSARY_SCRIPT = "Welcome to Ora Pro Nobis. Where we pray with the saints.\n\nOn Thursday, November 26, 2026, we pray the Luminous Mysteries. The Church celebrates St. Sylvester, Abbot, held today as a private devotion from the Roman Martyrology. With Mary we draw near to Christ, and we carry Sylvester's quiet, persevering prayer into these mysteries and into every need entrusted to our prayer.\n\nWe offer this Rosary in honor of St. Sylvester, Abbot, asking that his faithful prayer strengthen us in gratitude and perseverance, and that the Lord guide every intention we place before him in each decade, teaching us to return and give thanks for every mercy received.\n\nIn the name of the Father, and of the Son, and of the Holy Spirit. Amen.\n\nI believe in God, the Father almighty, Creator of heaven and earth.\nI believe in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit,\nborn of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried.\nHe descended into hell; on the third day he rose again from the dead;\nhe ascended into heaven, and is seated at the right hand of God the Father almighty.\nFrom there he will come to judge the living and the dead.\nI believe i";
const DESC = 'Morning Offering (Extended) for November 26, 2026. The daily opening prays with the selected saint witness and an approved saying, alongside the liturgical day.';
const ROSARY_DESC = "Daily Rosary for November 26, 2026, prayed with the selected saint witness and approved saying. The Luminous Mysteries include short reflections focused on Today's Gospel, Luke 17:11-19.";
const FIX = {
  episodeId: 'morning-prayer', title: 'Morning Offering (Extended)', kind: 'episode',
  available: true, streamUrl: 'https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-26.mp3',
  enclosureUrl: 'https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-26.mp3',
  durationS: 0, sizeBytes: 3868701, imageUrl: '/logo.png',
  hasText: true, textUrl: '/api/player/text/2026-11-26/morning-prayer',
  descText: DESC, _block: 'Morning',
};
const ROSARY = {
  episodeId: 'daily-rosary', title: 'Daily Rosary', kind: 'episode',
  available: true, streamUrl: 'https://audio.orapronobis.media/daily-rosary-2026-11-26.mp3',
  enclosureUrl: 'https://audio.orapronobis.media/daily-rosary-2026-11-26.mp3',
  durationS: 0, sizeBytes: 18934149, imageUrl: '/logo.png',
  hasText: true, textUrl: '/api/player/text/2026-11-26/daily-rosary',
  descText: ROSARY_DESC, _block: 'Morning',
};
const OFFICE = {
  episodeId: 'ext-morning-prayer', title: 'Morning Prayer', kind: 'external', source: 'Divine Office',
  available: true, streamUrl: 'https://example.invalid/ext-morning-prayer.mp3',
  durationS: 600, sizeBytes: 0, hasText: false, textUrl: null, _block: 'Morning',
  imageUrl: null, descText: 'PROVIDER BLURB ext-morning-prayer via Divine Office',
  stale: false, unresolved: false, resolvedAt: null,
};
check('F fixture is the real 2026-11-26 morning-prayer record (title, enclosure, length 3868701, feed description)', FIX.title === 'Morning Offering (Extended)' && FIX.sizeBytes === 3868701 && FIX.descText === DESC && FIX.textUrl === '/api/player/text/2026-11-26/morning-prayer');
check('F script bytes are the episode transcript (Morning Offering block opens with the named line)', SCRIPT.includes('Morning Offering - O Jesus, through the Immaculate Heart of Mary and the Chaste Heart of St. Joseph,'));

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v696harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.addInitScript((args) => {
  window.__fetches = [];
  window.__textMode = 'ok';
  window.__SCRIPT = args.script;
  window.__ROSARY = args.rosary;
  const resp = (status, txt) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve({}), text: () => Promise.resolve(txt) });
  window.fetch = (url) => {
    const u = String(url);
    window.__fetches.push(u);
    if (u.includes('/api/player/text/2026-11-26/morning-prayer')) return window.__textMode === 'ok' ? resp(200, window.__SCRIPT) : resp(404, 'not found');
    if (u.includes('/api/player/text/2026-11-26/daily-rosary')) return resp(200, window.__ROSARY);
    if (u === 'null') return resp(404, 'not found'); // fetch(null) in a real browser requests the relative URL "null" and the server 404s — the v630 catch then clears the skeleton
    return new Promise(() => {});
  };
}, { script: SCRIPT, rosary: ROSARY_SCRIPT });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

async function cleanup() {
  await pg.evaluate(() => {
    const r = document.querySelector('.readsheet'); if (r) r.remove();
    state.current = null; window.__fetches = [];
  });
}
async function openFixture(fx, mode) {
  await cleanup();
  await pg.evaluate(({ fx, mode }) => { window.__textMode = mode; openRead(fx); }, { fx, mode });
  await pg.waitForTimeout(400);
}
function sheetState() {
  return pg.evaluate(() => {
    const sh = document.querySelector('.readsheet');
    const body = sh ? sh.querySelector('.readtext') : null;
    const sub = sh ? sh.querySelector('.sub') : null;
    const ifr = sh ? sh.querySelector('iframe') : null;
    return {
      sheet: !!sh, html: sh ? sh.innerHTML : '',
      text: sh ? sh.textContent : '',
      bodyText: body ? body.textContent : null,
      skeleton: body ? !!body.querySelector('.skelbar') : null,
      subText: sub ? sub.textContent : null, subStands: !!sub,
      iframeSrc: ifr ? ifr.getAttribute('src') : null,
      fetches: (window.__fetches || []).slice(),
    };
  });
}
const PLACEHOLDERS = ["the episode's text", 'the episode&rsquo;s text', 'the episode’s text'];

// ---------- A: the words come through ----------
await openFixture(FIX, 'ok');
{
  const s = await sheetState();
  check('A body contains "O Jesus, through the Immaculate Heart of Mary and the Chaste Heart of St. Joseph"', s.bodyText !== null && s.bodyText.includes('O Jesus, through the Immaculate Heart of Mary and the Chaste Heart of St. Joseph'), s.bodyText && s.bodyText.slice(0, 200));
  check('A body contains "I offer You my prayers, works, joys, and sufferings of this day"', s.bodyText !== null && s.bodyText.includes('I offer You my prayers, works, joys, and sufferings of this day'), s.bodyText && s.bodyText.slice(0, 200));
  check('A sub-line is the fixture own description line', s.subStands && s.subText === DESC, s.subText);
  check('A sheet contains no placeholder form', !PLACEHOLDERS.some((p) => s.html.includes(p) || s.text.includes(p)), s.html.slice(0, 300));
  check('A the text fetch went to the app route /api/player/text/2026-11-26/morning-prayer', s.fetches.some((u) => u.includes('/api/player/text/2026-11-26/morning-prayer')), s.fetches);
}

// ---------- B: the seam carries the seat ----------
{
  const r = await pg.evaluate((fx) => {
    const d = expandDescs(fx, null)[0];
    const bare = expandDescs({ episodeId: 'no-text-1', title: 'No Text', available: true, streamUrl: 'https://example.invalid/x.mp3', _block: 'Morning' }, null)[0];
    return { d, bare };
  }, FIX);
  check('B composed descriptor carries hasText:true', r.d.hasText === true, r.d);
  check('B composed descriptor carries textUrl exactly', r.d.textUrl === '/api/player/text/2026-11-26/morning-prayer', r.d);
  check('B composed descriptor still carries descText (the sub-line source)', r.d.descText === DESC, r.d);
  check('B a text-less track composes to hasText:false, textUrl:null', r.bare.hasText === false && r.bare.textUrl === null, r.bare);
}

// ---------- C: the honest empty ----------
await openFixture(FIX, '404');
{
  const s = await sheetState();
  check('C(404) body empty after settle', s.bodyText === '', s.bodyText);
  check('C(404) skeleton gone', s.skeleton === false, s);
  check('C(404) sub-line is the description line only (stands, no placeholder)', s.subStands && s.subText === DESC, s.subText);
  check('C(404) sheet HTML contains no placeholder form', !PLACEHOLDERS.some((p) => s.html.includes(p) || s.text.includes(p)), s.html.slice(0, 300));
  check('C(404) sheet carries no "text unavailable" sentence', !/text unavailable/i.test(s.text) && !/could not be loaded/i.test(s.text), s.text.slice(0, 300));
}
await openFixture({ ...FIX, textUrl: null, hasText: false, descText: null }, 'ok');
{
  const s = await sheetState();
  check('C(null) body empty after settle', s.bodyText === '', s.bodyText);
  check('C(null) skeleton gone', s.skeleton === false, s);
  check('C(null) no descText carried -> the sub element does not stand at all', s.subStands === false, s.html.slice(0, 300));
  check('C(null) sheet HTML contains no placeholder form', !PLACEHOLDERS.some((p) => s.html.includes(p) || s.text.includes(p)), s.html.slice(0, 300));
}

// ---------- D: the placeholder stands nowhere ----------
await openFixture(ROSARY, 'ok');
{
  const s = await sheetState();
  check('D daily-rosary sheet contains no placeholder form', !PLACEHOLDERS.some((p) => s.html.includes(p) || s.text.includes(p)), s.html.slice(0, 300));
  check('D daily-rosary sub-line is its own feed description', s.subStands && s.subText === ROSARY_DESC, s.subText);
  check('D daily-rosary body paints its real script opening (Luminous Mysteries)', s.bodyText !== null && s.bodyText.includes('we pray the Luminous Mysteries'), s.bodyText && s.bodyText.slice(0, 200));
}
{
  const src = readFileSync(path.join(W, 'src/client.ts'), 'utf8');
  check('D built client source contains no placeholder form (plain / entity / curly)', !PLACEHOLDERS.some((p) => src.includes(p) || APPJS.includes(p)));
}

// ---------- E: office control ----------
await openFixture(OFFICE, 'ok');
{
  const s = await sheetState();
  check('E office sheet paints the widget branch (iframe https://divineoffice.org/widget)', s.iframeSrc === 'https://divineoffice.org/widget', s);
  check('E office sub carries the widget head ("Liturgy of the Hours")', s.text.includes('Liturgy of the Hours'), s.text.slice(0, 300));
  check('E office issues no /api/player/text fetch', !s.fetches.some((u) => u.includes('/api/player/text/')), s.fetches);
}

await cleanup();
await b.close();
server.close();
console.log('harness-v696: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
