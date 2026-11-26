// harness-v697.mjs — v697: the Read card for the USCCB
// readings episode — a Read act + a native card on the
// v675/v676 pattern, the text from the SAME payload the
// Mass uses (GET /api/prayer/mass-readings?date=).
//
// Chromium (playwright-core) harness, modeled on
// harness-v676.mjs: the REAL built Worker bundle (esbuild
// from source) served locally, the API stubbed, real acts,
// same-tick DOM assertions; ORA_WT selects the tree for the
// fail-on-old run.
//
// Fixtures (Improvement D — production sources named):
//  - PAYLOAD_2026_11_26 / PAYLOAD_2026_11_25 below are the
//    readings_cache rows for those dates, captured VERBATIM
//    from app D1 (database 3a177d55-7baa-424c-9c4d-0d60cd9fe332)
//    on 2026-11-26 — the store-first body the standing route
//    serves. Never hand-built, never trimmed.
//  - PRODUCTION FINDING (release doc §3.3): the captured
//    Nov 26 payload is found:true with parts: [] — the
//    parser's 112626.cfm link test matches the feed's
//    link-list item, which carries no headed parts (a fresh
//    live parse from the rebased source returns the
//    identical payload). Per §2.3 a no-parts payload paints
//    the not-available line ALONE, so the Nov 26 legs assert
//    exactly that against the captured payload's own truth,
//    and the citation / Gospel-word / acknowledgment paint
//    proof runs on the captured Nov 25 payload (4 parts:
//    Revelation 15:1-4 · Psalm 98:1, 2-3ab, 7-8, 9 ·
//    Revelation 2:10c · Luke 21:12-19). NO citation from the
//    feed's other Nov 26 items (the Thanksgiving selection
//    or the ferial set) is asserted anywhere (R1).
//  - The readings episode in its three real dresses,
//    shaped exactly as §1.5's constructions build them:
//    (a) readingsSeatDesc549's fold seat, (b)
//    resolveDailyDynamic666's daily descriptor, (c)
//    extSlotTrack's ext descriptor.
//  - Negatives: harness-v676's officeFx office descriptor
//    and OWN episode verbatim; BIAY + exegesis daily
//    descriptors in §1.5's daily shape.
//
// Legs: F fixture-shape · P1 player fold seat, Nov 26 (the
// screenshot case) · P2/P3 player daily + ext dresses,
// Nov 26 · P4 player daily dress, Nov 25 (full card paint)
// · T1/T2 track page fold + ext, Nov 26 · T3 track page
// daily dress, Nov 25 (full card paint) · D1 own-date
// (Nov 25 dress in the Nov 26 player context paints Nov 25
// only) · N1 missing-text (found:false stub) · C1 office
// untouched (widget, no mass-readings fetch) · C2 BIAY +
// exegesis negatives · C3 OWN episode plain text path.
// Fail-on-old: on the pre-build tree P1–P4, T1–T3, D1, N1
// fail; C1–C3 pass.
//
// Run: node app/worker/harness-v697.mjs
//      ORA_WT=/path/to/old-tree node /path/to/harness-v697.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
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

// ---------- captured production payloads (verbatim) ----------

const PAYLOAD_2026_11_26 = {"date":"2026-11-26","found":true,"parts":[],"copyright":["Lectionary for Mass for Use in the Dioceses of the United States, second typical edition, Copyright © 2001, 1998, 1997, 1986, 1970 Confraternity of Christian Doctrine; Psalm refrain © 1968, 1981, 1997, International Committee on English in the Liturgy, Inc. All rights reserved. Neither this work nor any part of it may be reproduced, distributed, performed or displayed in any medium, including electronic or digital, without permission in writing from the copyright owner."],"title":"Thursday of the Thirty-fourth Week in Ordinary Time-Thanksgiving"};
const PAYLOAD_2026_11_25 = {"date":"2026-11-25","found":true,"parts":[{"key":"r1","heading":"Reading 1","source":"Revelation 15:1-4","html":"<div class=\"poetry\"> \n  <p>I, John, saw in heaven another sign, great and awe-inspiring:<br>seven angels with the seven last plagues,<br>for through them God’s fury is accomplished.</p><p>Then I saw something like a sea of glass mingled with fire.<br>On the sea of glass were standing those<br>who had won the victory over the beast<br>and its image and the number that signified its name.<br>They were holding God’s harps,<br>and they sang the song of Moses, the servant of God,<br>and the song of the Lamb:</p><p>“Great and wonderful are your works,<br>Lord God almighty.<br>Just and true are your ways,<br>O king of the nations.<br>Who will not fear you, Lord,<br>or glorify your name?<br>For you alone are holy.<br>All the nations will come<br>and worship before you,<br>for your righteous acts have been revealed.”<br>&nbsp;</p>\n</div>"},{"key":"ps","heading":"Responsorial Psalm","source":"Psalm 98:1, 2-3ab, 7-8, 9","html":"<div class=\"poetry\"> \n  <p>R. (Rev. 15: 3b) <strong>Great and wonderful are all your works, Lord, mighty God!</strong><br>Sing to the LORD a new song,<br>for he has done wondrous deeds;<br>His right hand has won victory for him,<br>his holy arm.<br>R. <strong>Great and wonderful are all your works, Lord, mighty God!</strong><br>The LORD has made his salvation known:<br>in the sight of the nations he has revealed his justice.<br>He has remembered his kindness and his faithfulness<br>toward the house of Israel.<br>R. <strong>Great and wonderful are all your works, Lord, mighty God!</strong><br>Let the sea and what fills it resound,<br>the world and those who dwell in it;<br>Let the rivers clap their hands,<br>the mountains shout with them for joy.<br>R. <strong>Great and wonderful are all your works, Lord, mighty God!</strong><br>Before the LORD, for he comes,<br>for he comes to rule the earth;<br>He will rule the world with justice<br>and the peoples with equity.<br>R. <strong>Great and wonderful are all your works, Lord, mighty God!</strong></p><p>&nbsp;</p><p>&nbsp;</p>\n</div>"},{"key":"ga","heading":"Alleluia","source":"Revelation 2:10c","html":"<div class=\"poetry\"> \n  <p>R. <strong>Alleluia, alleluia.</strong><br>Remain faithful until death,<br>and I will give you the crown of life.<br>R. <strong>Alleluia, alleluia.</strong></p>\n</div>"},{"key":"g","heading":"Gospel","source":"Luke 21:12-19","html":"<div class=\"poetry\"> \n  <p>Jesus said to the crowd:<br>“They will seize and persecute you,<br>they will hand you over to the synagogues and to prisons,<br>and they will have you led before kings and governors<br>because of my name.<br>It will lead to your giving testimony.<br>Remember, you are not to prepare your defense beforehand,<br>for I myself shall give you a wisdom in speaking<br>that all your adversaries will be powerless to resist or refute.<br>You will even be handed over by parents,<br>brothers, relatives, and friends,<br>and they will put some of you to death.<br>You will be hated by all because of my name,<br>but not a hair on your head will be destroyed.<br>By your perseverance you will secure your lives.”</p>\n</div>"}],"copyright":["Lectionary for Mass for Use in the Dioceses of the United States, second typical edition, Copyright © 2001, 1998, 1997, 1986, 1970 Confraternity of Christian Doctrine; Psalm refrain © 1968, 1981, 1997, International Committee on English in the Liturgy, Inc. All rights reserved. Neither this work nor any part of it may be reproduced, distributed, performed or displayed in any medium, including electronic or digital, without permission in writing from the copyright owner."],"title":"Wednesday of the Thirty-fourth Week in Ordinary Time","memorials":[{"name":"Optional Memorial of Saint Catherine of Alexandria, Virgin and Martyr","url":"https://bible.usccb.org/bible/readings/1125-memorial-catherine-alexandria.cfm","note":"Below are the readings suggested for today's Memorial. However, readings for the Memorial may also be taken from the Common of Martyrs (#713-718), or the Common of Virgins (#731-736).","parts":[{"key":"r1","heading":"Reading 1","source":"Revelation 21:5-7","html":"<p>The One who was seated on the throne said:<br>\n\"Behold, I make all things new.\"<br>\nThen he said, \"Write these words down,<br>\nfor they are trustworthy and true.\"<br>\nHe said to me, \"They are accomplished.<br>\nI am the Alpha and the Omega, the beginning and the end.<br>\nTo the thirsty I will give a gift<br>\nfrom the spring of life-giving water.<br>\nThe victor will inherit these gifts,<br>\nand I shall be his God,<br>\nand he will be my son.\"</p>"},{"key":"ps","heading":"Responsorial Psalm","source":"Psalm 124:2-3, 4-5, 7cd-8","html":"<p>R. (7) <strong>Our soul has been rescued like a bird from the fowler's snare.</strong><br>\nHad not the LORD been with us–<br>\nWhen men rose up against us,<br>\nthen would they have swallowed us alive<br>\nWhen their fury was inflamed against us. &nbsp;<br>\nR. <strong>Our soul has been rescued like a bird from the fowler's snare.</strong><br>\nThen would the waters have overwhelmed us;<br>\nThe torrent would have swept over us;<br>\nover us then would have swept<br>\nthe raging waters. &nbsp;<br>\nR. <strong>Our soul has been rescued like a bird from the fowler's snare.</strong><br>\nBroken was the snare,<br>\nand we were freed.<br>\nOur help is in the name of the LORD,<br>\nwho made heaven and earth. &nbsp;<br>\nR. <strong>Our soul has been rescued like a bird from the fowler's snare.</strong></p>"},{"key":"ga","heading":"Alleluia","source":"See Te Deum","html":"<p>R.&nbsp; <strong>Alleluia, alleluia.</strong><br>\nWe praise you, O God,<br>\nwe acclaim you as Lord;<br>\nthe white-robed army of martyrs praises you. &nbsp;<br>\nR.&nbsp; <strong>Alleluia, alleluia.</strong></p>"},{"key":"g","heading":"Gospel","source":"Matthew 10:28-33","html":"<p>Jesus said to his Apostles:<br>\n\"Do not be afraid of those who kill the body<br>\nbut cannot kill the soul;<br>\nrather, be afraid of the one who can destroy<br>\nboth soul and body in Gehenna.<br>\nAre not two sparrows sold for a small coin?<br>\nYet not one of them falls to the ground without your Father's knowledge.<br>\nEven all the hairs of your head are counted.<br>\nSo do not be afraid; you are worth more than many sparrows.<br>\nEveryone who acknowledges me before others<br>\nI will acknowledge before my heavenly Father.<br>\nBut whoever denies me before others,<br>\nI will deny before my heavenly Father.\"</p>"}],"lectionary":"683C"}]};

// ---------- the readings episode in its three dresses ----------
// (a) readingsSeatDesc549's literal shape (client.ts, the
// fold seat): episodeId = a feed GUID key, readingsSeat
// true, podSeries 'daily-readings', source '', descText
// null, NO slotId; the date rides the title.
const TITLE_26 = 'Daily Mass Reading Podcast for November 26, 2026';
const TITLE_25 = 'Daily Mass Reading Podcast for November 25, 2026';
const SEAT_26 = {
  episodeId: 'usccb-ep-20261126', kind: 'podcast', seriesKey: 'usccb-ep-20261126', podSeries: 'daily-readings',
  title: TITLE_26, url: 'https://example.invalid/usccb-20261126.mp3', enclosureUrl: null, available: true,
  block: 'Morning', source: '', durationS: 358, listened: false, podPositionS: null,
  imageUrl: null, descText: null, spotifyUrl: null, readingsSeat: true,
};
// (b) resolveDailyDynamic666's literal shape: daily666 +
// dailySeries stamps, the series-title source, a provider
// descText standing (which must NOT paint).
function dailyFx(title, epKey) {
  return {
    episodeId: epKey, kind: 'podcast', seriesKey: epKey, podSeries: 'daily-readings',
    title, url: 'https://example.invalid/' + epKey + '.mp3', enclosureUrl: null, available: true,
    block: 'Morning', source: 'USCCB Daily Readings Podcast', durationS: 358, listened: false, podPositionS: null,
    imageUrl: null, descText: 'PROVIDER BLURB daily-readings ' + epKey, spotifyUrl: null,
    stale: false, daily666: true, dailySeries: 'daily-readings',
  };
}
const DAILY_26 = dailyFx(TITLE_26, 'usccb-ep-20261126');
const DAILY_25 = dailyFx(TITLE_25, 'usccb-ep-20261125');
// (c) extSlotTrack's literal shape: episodeId IS the slot
// id, kind 'external', hasText false, textUrl null, a
// provider descText standing (which must NOT paint). Its
// title is the feed episode's own title (the resolution is
// per-presented-date, picked by the same title-date rule).
const EXT_26 = {
  episodeId: 'ext-usccb-readings', title: TITLE_26, kind: 'external', source: 'USCCB Daily Readings Podcast',
  available: true, streamUrl: 'https://example.invalid/ext-usccb-readings.mp3',
  durationS: 358, sizeBytes: 0, hasText: false, textUrl: null, _block: 'Mass and Homilies',
  imageUrl: null, descText: 'PROVIDER BLURB ext-usccb-readings',
  stale: false, unresolved: false, resolvedAt: null,
};
// ---------- negatives (harness-v676 verbatim shapes) ----------
function officeFx(slotId, title, source) {
  return {
    episodeId: slotId, title, kind: 'external', source,
    available: true, streamUrl: 'https://example.invalid/' + slotId + '-' + source.replace(/\W+/g, '') + '.mp3',
    durationS: 600, sizeBytes: 0, hasText: false, textUrl: null, _block: 'Morning',
    imageUrl: null, descText: 'PROVIDER BLURB ' + slotId + ' via ' + source,
    stale: false, unresolved: false, resolvedAt: null,
  };
}
const OFFICE = officeFx('ext-morning-prayer', 'Morning Prayer', 'Sing the Hours');
const OWN = { episodeId: 'own-ep-1', title: 'Own Episode', kind: 'podcast', available: true, streamUrl: 'https://example.invalid/own.mp3', url: 'https://example.invalid/own.mp3', durationS: 300, hasText: true, textUrl: 'https://example.invalid/own-text.txt', descText: null };
function dailyNeg(series, title) {
  return {
    episodeId: series + '-ep-1', kind: 'podcast', seriesKey: series + '-ep-1', podSeries: series,
    title, url: 'https://example.invalid/' + series + '.mp3', enclosureUrl: null, available: true,
    block: 'Morning', source: 'Some Other Series', durationS: 300, listened: false, podPositionS: null,
    imageUrl: null, descText: null, spotifyUrl: null, stale: false, daily666: true, dailySeries: series,
  };
}
const BIAY = dailyNeg('bible-in-a-year', 'Day 330: Bible in a Year');
const EXEG = dailyNeg('daily-gospel-exegesis', 'Daily Gospel Exegesis');

// ---------- F: fixture shape ----------
// The Nov 25 capture is the full-card proof payload: found,
// a Gospel part, a non-empty copyright[], NO options on any
// part (the R2 check: massFeedPartHtml emits no option
// chips for the captured parts — the card's ferial-arm call
// stands as prescribed, no fallback rendering needed).
check('F Nov 25 captured payload: found:true, 4 parts incl. a Gospel part, non-empty copyright[], no part carries options (R2: no chips render)', PAYLOAD_2026_11_25.found === true && PAYLOAD_2026_11_25.parts.length === 4 && PAYLOAD_2026_11_25.parts.some((p) => p.key === 'g') && (PAYLOAD_2026_11_25.copyright || []).length > 0 && PAYLOAD_2026_11_25.parts.every((p) => !p.options));
check('F Nov 25 captured citations are the production set (Revelation 15:1-4 · Psalm 98:1, 2-3ab, 7-8, 9 · Revelation 2:10c · Luke 21:12-19)', JSON.stringify(PAYLOAD_2026_11_25.parts.map((p) => p.source)) === JSON.stringify(['Revelation 15:1-4', 'Psalm 98:1, 2-3ab, 7-8, 9', 'Revelation 2:10c', 'Luke 21:12-19']), PAYLOAD_2026_11_25.parts.map((p) => p.source));
// The Nov 26 capture, verbatim truth (§3.3's finding):
// found:true, title standing, parts EMPTY.
check('F Nov 26 captured payload (verbatim production truth, §3.3): found:true, the Thanksgiving title, parts [] — the route serves no parts for Nov 26', PAYLOAD_2026_11_26.found === true && PAYLOAD_2026_11_26.title === 'Thursday of the Thirty-fourth Week in Ordinary Time-Thanksgiving' && Array.isArray(PAYLOAD_2026_11_26.parts) && PAYLOAD_2026_11_26.parts.length === 0, PAYLOAD_2026_11_26);
check('F fold-seat dress matches §1.5(a) (readingsSeat true, podSeries daily-readings, source "", descText null, slotId absent)', SEAT_26.readingsSeat === true && SEAT_26.podSeries === 'daily-readings' && SEAT_26.source === '' && SEAT_26.descText === null && !('slotId' in SEAT_26));
check('F daily dress matches §1.5(b) (daily666 + dailySeries daily-readings, series-title source, provider descText standing)', DAILY_26.daily666 === true && DAILY_26.dailySeries === 'daily-readings' && DAILY_26.podSeries === 'daily-readings' && DAILY_26.source === 'USCCB Daily Readings Podcast' && !!DAILY_26.descText);
check('F ext dress matches §1.5(c) (episodeId ext-usccb-readings, kind external, hasText false, textUrl null, provider descText standing)', EXT_26.episodeId === 'ext-usccb-readings' && EXT_26.kind === 'external' && EXT_26.hasText === false && EXT_26.textUrl === null && !!EXT_26.descText);

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v697harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries the v697 release pin ora-pro-nobis-v697-1', /ora-pro-nobis-v697-1/.test(SWJS), 'pin not in served /sw.js');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.addInitScript((payloads) => {
  window.__fetches = [];
  window.__payloads = payloads;
  const respJson = (obj) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)) });
  const respText = (txt) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve(txt) });
  window.fetch = (url) => {
    const u = String(url);
    window.__fetches.push(u);
    if (u.includes('/api/prayer/mass-readings')) {
      const m = /[?&]date=([0-9-]+)/.exec(u);
      const p = m ? window.__payloads[m[1]] : null;
      return respJson(p || { date: m ? m[1] : '', found: false, parts: [], copyright: [] });
    }
    if (u.includes('own-text.txt')) return respText('OWN PLAIN TEXT BODY');
    return new Promise(() => {});
  };
}, { '2026-11-26': PAYLOAD_2026_11_26, '2026-11-25': PAYLOAD_2026_11_25 });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- drivers ----------
async function cleanupPlayer() {
  await pg.evaluate(() => {
    const np = document.querySelector('.np-sheet'); if (np) np.remove();
    const r = document.querySelector('.readsheet'); if (r) r.remove();
    const tp = document.getElementById('track-page-643'); if (tp) tp.remove();
    state.current = null; state.queue = []; state.queueIdx = 0; state.readTracks = {};
    window.__fetches = [];
  });
}
async function openPlayer(fx, readTracks) {
  await cleanupPlayer();
  await pg.evaluate(({ fx, readTracks }) => {
    state.current = fx;
    state.queue = [fx]; state.queueIdx = 0;
    state.readTracks = readTracks || {};
    openNowPlaying();
  }, { fx, readTracks });
  await pg.waitForTimeout(200);
}
function npReadState() {
  return pg.evaluate(() => {
    const btn = document.querySelector('#np-read');
    if (!btn) return { btn: false };
    return { btn: true, visibility: btn.style.visibility, ariaHidden: btn.getAttribute('aria-hidden') };
  });
}
function sheetState() {
  return pg.evaluate(() => {
    const sh = document.querySelector('.readsheet');
    const ifr = sh ? sh.querySelector('iframe') : null;
    const body = sh ? sh.querySelector('.readtext') : null;
    const acks = sh ? Array.from(sh.querySelectorAll('.mass-ack')).map((e) => e.textContent) : [];
    const chips = sh ? sh.querySelectorAll('[data-rchoice]') : [];
    return {
      sheet: !!sh,
      text: sh ? sh.textContent : '',
      bodyText: body ? body.textContent : '',
      bodyHtml: body ? body.innerHTML : '',
      iframeSrc: ifr ? ifr.getAttribute('src') : null,
      acks, chipCount: chips.length,
      skel: !!(body && body.querySelector('.skelbar')),
      fetches: (window.__fetches || []).slice(),
    };
  });
}
async function clickNpRead() {
  await pg.evaluate(() => { const btn = document.querySelector('#np-read'); if (btn) btn.click(); });
  await pg.waitForTimeout(600);
}
function massFetches(s) { return s.fetches.filter((u) => u.includes('/api/prayer/mass-readings')); }
function checkCard26(tag, s) {
  // The Nov 26 captured payload carries NO parts (§3.3):
  // the card's correct paint is the §2.3 not-available line
  // ALONE — no citation, no acknowledgment, no other day's
  // text, no skeleton left standing.
  check(tag + ' Read sheet paints', s.sheet, s);
  check(tag + ' body paints "Readings not available for this day." (the captured Nov 26 payload carries no parts)', s.bodyText.includes('Readings not available for this day.'), s.bodyText.slice(0, 200));
  check(tag + ' body is the not-available line ALONE (no citation, no ack, no skeleton)', s.acks.length === 0 && !s.skel && !/Revelation|Luke|Sirach|Psalm/.test(s.bodyText), s.bodyText.slice(0, 200));
  check(tag + ' no iframe stands', s.iframeSrc === null, s);
  check(tag + ' exactly one mass-readings fetch, with date=2026-11-26', massFetches(s).length === 1 && massFetches(s)[0].includes('date=2026-11-26'), s.fetches);
  check(tag + ' head stands: "Daily Readings" + the Nov 26 date line', s.text.includes('Daily Readings') && s.text.includes('November 26, 2026'), s.text.slice(0, 300));
}
function checkCard25(tag, s, fetchDate) {
  check(tag + ' Read sheet paints', s.sheet, s);
  for (const cite of ['Revelation 15:1-4', 'Psalm 98:1, 2-3ab, 7-8, 9', 'Revelation 2:10c', 'Luke 21:12-19']) {
    check(tag + ' citation stands: ' + cite, s.bodyText.includes(cite), s.bodyText.slice(0, 300));
  }
  check(tag + ' Gospel body word-string from the captured payload ("They will seize and persecute you")', s.bodyText.includes('They will seize and persecute you'), s.bodyText.slice(0, 400));
  check(tag + ' copyright acknowledgment stands at the foot as a .mass-ack line (the captured copyright[] line)', s.acks.length === 1 && s.acks[0].startsWith('Lectionary for Mass for Use in the Dioceses of the United States'), s.acks);
  check(tag + ' no iframe stands', s.iframeSrc === null, s);
  check(tag + ' no option chips render for the captured parts (R2)', s.chipCount === 0, s.chipCount);
  check(tag + ' exactly one mass-readings fetch, with date=' + fetchDate, massFetches(s).length === 1 && massFetches(s)[0].includes('date=' + fetchDate), s.fetches);
  check(tag + ' memorial set does NOT paint (no memorial citation Matthew 10:28-33 / Revelation 21:5-7)', !s.bodyText.includes('Matthew 10:28-33') && !s.bodyText.includes('Revelation 21:5-7'), s.bodyText.slice(0, 300));
}

// ---------- P1 (the screenshot case, first): player, fold seat, Nov 26 ----------
await openPlayer(SEAT_26);
{
  const np = await npReadState();
  check('P1 #np-read stands in the player (visibility cleared, no aria-hidden)', np.btn && np.visibility !== 'hidden' && np.ariaHidden === null, np);
  await clickNpRead();
  checkCard26('P1 player fold-seat Nov 26', await sheetState());
}
// ---------- P2/P3: player, daily + ext dresses, Nov 26 ----------
await openPlayer(DAILY_26); await clickNpRead();
{
  const np = await npReadState(); const s = await sheetState();
  check('P2 #np-read stands (daily dress)', np.btn && np.visibility !== 'hidden' && np.ariaHidden === null, np);
  checkCard26('P2 player daily Nov 26', s);
  check('P2 the daily dress descText appears nowhere in the sheet', !s.text.includes('PROVIDER BLURB'), s.text.slice(0, 300));
}
await openPlayer(EXT_26); await clickNpRead();
{
  const np = await npReadState(); const s = await sheetState();
  check('P3 #np-read stands (ext dress)', np.btn && np.visibility !== 'hidden' && np.ariaHidden === null, np);
  checkCard26('P3 player ext Nov 26', s);
  check('P3 the ext dress descText appears nowhere in the sheet', !s.text.includes('PROVIDER BLURB'), s.text.slice(0, 300));
}
// ---------- P4: player, daily dress, Nov 25 — the full card paint ----------
await openPlayer(DAILY_25); await clickNpRead();
{
  const np = await npReadState(); const s = await sheetState();
  check('P4 #np-read stands (daily dress, Nov 25)', np.btn && np.visibility !== 'hidden' && np.ariaHidden === null, np);
  checkCard25('P4 player daily Nov 25', s, '2026-11-25');
  check('P4 the daily dress descText appears nowhere in the sheet', !s.text.includes('PROVIDER BLURB'), s.text.slice(0, 300));
  check('P4 head day name takes the payload title when it lands', s.text.includes('Wednesday of the Thirty-fourth Week in Ordinary Time'), s.text.slice(0, 300));
}
// ---------- D1: own-date rule — the Nov 25 dress asked on Nov 26 paints Nov 25 only ----------
// (P4 already runs the Nov 25 dress as state.current; D1
// asserts the negative side explicitly: no Nov 26 citation
// from either of the feed's other Nov 26 items stands.)
{
  const s = await sheetState();
  check('D1 no Nov 26 citation stands (not Sirach 50:22-24, not Luke 17:11-19, not Revelation 18:1-2)', !s.bodyText.includes('Sirach 50:22-24') && !s.bodyText.includes('Luke 17:11-19') && !s.bodyText.includes('Revelation 18:1-2'), s.bodyText.slice(0, 300));
  check('D1 the fetch asked date=2026-11-25 and only that date', massFetches(s).length === 1 && massFetches(s)[0].includes('date=2026-11-25'), s.fetches);
}
// ---------- N1: missing text — the stub answers found:false ----------
await pg.evaluate(() => { window.__payloads['2026-11-26'] = { date: '2026-11-26', found: false, parts: [], copyright: [] }; });
await openPlayer(SEAT_26); await clickNpRead();
{
  const s = await sheetState();
  check('N1 body paints "Readings not available for this day."', s.sheet && s.bodyText.includes('Readings not available for this day.'), s.bodyText.slice(0, 200));
  check('N1 the line stands ALONE (no citation, no acknowledgment, no other date text, no skeleton bars remaining)', s.acks.length === 0 && !s.skel && !/Revelation|Luke|Sirach|Psalm|Lectionary/.test(s.bodyText), s.bodyText.slice(0, 200));
}
await pg.evaluate((p) => { window.__payloads['2026-11-26'] = p; }, PAYLOAD_2026_11_26);

// ---------- track page legs ----------
async function paintLanding(fx, date) {
  // The standing openTrackPage643 re-present timers
  // (400/1200/2500ms) re-paint a previous page whose key
  // differs — let a prior paint's timers expire first.
  await pg.waitForTimeout(2700);
  await cleanupPlayer();
  await pg.evaluate(({ fx, date }) => {
    state.dayDescs = [fx];
    state.presentedDay = date;
    state.dayPayload = { date, presentedDay: date, dateLabel: '', blocks: [] };
    state.tab = 'prayers';
    shareLanding = { s: 'day', id: fx.episodeId, date, src: fx.source, b: null, o: null };
    shareLandingLandDay();
  }, { fx, date });
  await pg.waitForTimeout(700);
}
function pageState() {
  return pg.evaluate(() => {
    const pgEl = document.getElementById('track-page-643');
    const txt = document.getElementById('track-text-643');
    const ifr = txt ? txt.querySelector('iframe') : null;
    const acks = txt ? Array.from(txt.querySelectorAll('.mass-ack')).map((e) => e.textContent) : [];
    return {
      page: !!pgEl,
      text: pgEl ? pgEl.textContent : '',
      bodyText: txt ? txt.textContent : '',
      iframeSrc: ifr ? ifr.getAttribute('src') : null,
      acks,
      fetches: (window.__fetches || []).slice(),
    };
  });
}
await paintLanding(SEAT_26, '2026-11-26');
{
  const s = await pageState();
  check('T1 track page stands (fold seat)', s.page, s);
  check('T1 head stands above #track-text-643 ("Daily Readings")', s.text.includes('Daily Readings'), s.text.slice(0, 300));
  check('T1 card body paints into #track-text-643 (the captured Nov 26 payload: the not-available line alone)', s.bodyText.includes('Readings not available for this day.') && s.acks.length === 0 && !/Revelation|Luke|Sirach/.test(s.bodyText), s.bodyText.slice(0, 200));
  check('T1 no iframe', s.iframeSrc === null, s);
  check('T1 exactly one mass-readings fetch, date=2026-11-26', massFetches(s).length === 1 && massFetches(s)[0].includes('date=2026-11-26'), s.fetches);
}
await paintLanding(EXT_26, '2026-11-26');
{
  const s = await pageState();
  check('T2 track page stands (ext dress)', s.page, s);
  check('T2 head stands ("Daily Readings")', s.text.includes('Daily Readings'), s.text.slice(0, 300));
  check('T2 card body paints into #track-text-643 (not-available line alone for the captured Nov 26 payload)', s.bodyText.includes('Readings not available for this day.'), s.bodyText.slice(0, 200));
  check('T2 the ext dress descText does NOT paint', !s.text.includes('PROVIDER BLURB'), s.text.slice(0, 300));
  check('T2 no iframe', s.iframeSrc === null, s);
}
await paintLanding(DAILY_25, '2026-11-25');
{
  const s = await pageState();
  check('T3 track page stands (daily dress, Nov 25)', s.page, s);
  check('T3 head stands ("Daily Readings")', s.text.includes('Daily Readings'), s.text.slice(0, 300));
  check('T3 card body paints into #track-text-643 with the Nov 25 citations', ['Revelation 15:1-4', 'Psalm 98:1, 2-3ab, 7-8, 9', 'Revelation 2:10c', 'Luke 21:12-19'].every((c) => s.bodyText.includes(c)), s.bodyText.slice(0, 300));
  check('T3 Gospel body word-string stands', s.bodyText.includes('They will seize and persecute you'), s.bodyText.slice(0, 400));
  check('T3 copyright acknowledgment stands as a .mass-ack line', s.acks.length === 1 && s.acks[0].startsWith('Lectionary for Mass for Use in the Dioceses of the United States'), s.acks);
  check('T3 the daily dress descText does NOT paint', !s.text.includes('PROVIDER BLURB'), s.text.slice(0, 300));
  check('T3 no iframe; the fetch asked date=2026-11-25', s.iframeSrc === null && massFetches(s).length === 1 && massFetches(s)[0].includes('date=2026-11-25'), s.fetches);
}
// ---------- C1: office untouched ----------
// Let T3's standing track-page re-present timers (the
// 400/1200/2500ms guards) expire first — a re-presented
// T3 page would re-run its afterPaint fetch into these
// legs' fetch logs.
await pg.waitForTimeout(2800);
await cleanupPlayer();
await openPlayer(OFFICE); await clickNpRead();
{
  const np = await npReadState(); const s = await sheetState();
  check('C1 office fixture: #np-read stands via the office arm', np.btn && np.visibility !== 'hidden' && np.ariaHidden === null, np);
  check('C1 office click paints the widget (iframe src exactly https://divineoffice.org/widget)', s.sheet && s.iframeSrc === 'https://divineoffice.org/widget', s);
  check('C1 no mass-readings fetch is issued', massFetches(s).length === 0, s.fetches);
}
// ---------- C2: podcast negatives ----------
for (const [tag, fx] of [['BIAY', BIAY], ['exegesis', EXEG]]) {
  await openPlayer(fx);
  const np = await npReadState();
  check('C2 ' + tag + ': #np-read stays hidden (visibility hidden + aria-hidden true)', np.btn && np.visibility === 'hidden' && np.ariaHidden === 'true', np);
  await clickNpRead();
  const s = await sheetState();
  check('C2 ' + tag + ': click attempt opens no Read sheet and issues no mass-readings fetch', !s.sheet && massFetches(s).length === 0, s);
}
// ---------- C3: standing text path untouched ----------
await openPlayer(OWN, { 'own-ep-1': OWN });
{
  const np = await npReadState();
  check('C3 own episode: #np-read stands via the standing text test', np.btn && np.visibility !== 'hidden' && np.ariaHidden === null, np);
  await clickNpRead();
  const s = await sheetState();
  check('C3 own episode: click paints the PLAIN fetched text; no card, no mass-readings fetch', s.sheet && s.iframeSrc === null && s.text.includes('OWN PLAIN TEXT BODY') && massFetches(s).length === 0, s);
}

await cleanupPlayer();
await b.close();
server.close();
console.log('harness-v697: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
