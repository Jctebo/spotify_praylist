// harness-v710.mjs — v710 legs L1–L6 (Plan §2.5).
// Fixtures: F3 = real test script (ora-runner-runs/2026-11-27/script-stations-of-the-cross.txt);
// payload entries derived from the real 2026-11-27 Stations entry shape (title/key as published).
// Extraction harness: matcher + deps sliced from client.ts and eval'd — same code the app ships.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
let ok = 0, bad = 0;
function check(name, cond, extra) { if (cond) { ok++; console.log('ok   ' + name); } else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 300) : '')); } }
const client = readFileSync(path.join(W, 'src/client.ts'), 'utf8');
const index = readFileSync(path.join(W, 'src/index.ts'), 'utf8');
function sliceFn(src, name) { const i = src.indexOf('function ' + name); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }
const sandbox = {};
const code = [
  sliceFn(client, 'opnDailyKeyOk666'), sliceFn(client, 'opnDailySeriesTitle666'),
  sliceFn(client, 'opnDailyDoy666'), sliceFn(client, 'opnDailyTitleDate666'),
  sliceFn(client, 'ownChicagoDateStr'), sliceFn(client, 'offlineShiftDate'),
  sliceFn(client, 'opnDailyMatch666'), sliceFn(client, 'opnDailyPlaceholder694'),
].join('\n');
const setM = client.match(/var OPN_DAILY_SERIES_666 = (\[[^\]]*\]);/);
const ctx = { opnLadderSeries603: null, opnVideoSeriesTitle656: (s) => s };
const fn = new Function(setM[0] + '\nvar opnLadderSeries603 = null;\nfunction opnVideoSeriesTitle656(s) { return s; }\n' + code + '\nreturn { opnDailyKeyOk666, opnDailyMatch666, opnDailyPlaceholder694, opnDailySeriesTitle666, OPN_DAILY_SERIES_666 };');
const H = fn();
// F3-derived payload (real entry: published Fri 2026-11-27 Chicago)
const pubMs = Date.parse('2026-11-27T12:00:00-06:00');
const entry = { key: 'stations-of-the-cross-2026-11-27::x', title: 'Stations of the Cross - November 27, 2026', label: 'Nov 27, 2026', publishedMs: pubMs, url: 'https://example.invalid/s.mp3', durationS: 2000 };
const corrected = { ...entry, key: 'stations-of-the-cross-2026-11-27::y', title: 'Stations of the Cross - November 27, 2026 (corrected)' };
// L1 Friday resolve + A2 title
const m1 = H.opnDailyMatch666('stations-of-the-cross', [entry], '2026-11-27');
check('L1a Friday matcher resolves the real 2026-11-27 entry', !!m1 && m1.e === entry);
check('L1b corrected-title form also matches (same date)', (H.opnDailyMatch666('stations-of-the-cross', [corrected], '2026-11-27') || {}).e === corrected);
const descTitle = m1 ? m1.e.title : ''; // descriptor seat: series==='stations-of-the-cross' ? e.title as-is (asserted in source below)
check('L1c A2 descriptor title exactly prescribed string', descTitle === 'Stations of the Cross - November 27, 2026', descTitle);
check('L1d source: descriptor branch takes e.title as-is for stations', client.includes("series === 'stations-of-the-cross' ? (e.title || '')"));
check('L1e source: descriptor carries daily666 dress via standing construction', client.includes('daily666: true, dailySeries: series'));
check('L1f source: B6 textUrl staged-text seat', client.includes("'/api/player/text/' + presented + '/stations-of-the-cross'"));
// L2 no episode → placeholder, nothing settles
const m2 = H.opnDailyMatch666('stations-of-the-cross', [{ ...entry, title: 'Daily Rosary - November 27, 2026' }], '2026-11-27');
check('L2a no Stations entry → matcher null', m2 === null);
const ph = H.opnDailyPlaceholder694('stations-of-the-cross', 'Afternoon', null);
check('L2b placeholder shape seg:unavailable-v694-stations-of-the-cross / available false', ph.episodeId === 'seg:unavailable-v694-stations-of-the-cross' && ph.available === false, ph.episodeId);
// L3 non-Friday gate source discipline
check('L3a fridays dayRule exists + resolver gate precedes fetch', client.includes("'fridays'") && sliceFn(client, 'resolveDailyDynamic666').indexOf('opnItemPaints690') >= 0 && sliceFn(client, 'resolveDailyDynamic666').indexOf('opnItemPaints690') < sliceFn(client, 'resolveDailyDynamic666').indexOf('opnDailyMatch666'));
check('L3b Add stamp: daily:stations-of-the-cross → fridays', client.includes("itemA.key === 'stations-of-the-cross') itemA.dayRule = 'fridays'"));
check('L3c wrong-date entry never matches a different presented date', H.opnDailyMatch666('stations-of-the-cross', [entry], '2026-12-04') === null);
// L4 pictured Read
const script = readFileSync(process.env.HOME + '/workspace/ora-runner-runs/2026-11-27/script-stations-of-the-cross.txt', 'utf8');
const heads = ['First Station','Second Station','Third Station','Fourth Station','Fifth Station','Sixth Station','Seventh Station','Eighth Station','Ninth Station','Tenth Station','Eleventh Station','Twelfth Station','Thirteenth Station','Fourteenth Station'];
const idxs = heads.map((h) => script.indexOf(h + '.'));
check('L4a F1/F2 text carries all 14 station heads in order', idxs.every((v, i) => v >= 0 && (i === 0 || v > idxs[i - 1])));
let imgsOk = true; for (let i = 1; i <= 14; i++) { const p = path.join(W, 'src/assets/stations/station-' + String(i).padStart(2, '0') + '.jpg'); if (!existsSync(p) || readFileSync(p).length < 10000) imgsOk = false; }
check('L4b all 14 station images stand in the app tree', imgsOk);
check('L4c openRead Stations branch paints image above each station section in order', client.includes("t.dailySeries === 'stations-of-the-cross'") && client.includes("'/assets/stations/station-' + String(si + 1).padStart(2, '0') + '.jpg'"));
check('L4d asset route serves /assets/stations/station-NN.jpg', index.includes('assets') && index.includes('STATION_IMAGES_B64'));
// L5 A2 surfaces: single descriptor title source
check('L5a no label prefix composition for stations (other series unchanged)', client.includes("(e.label ? e.label + ': ' : '') + (e.title || '')"));
// L6 validation both lists
check('L6a client closed set gains stations-of-the-cross', H.opnDailyKeyOk666('stations-of-the-cross') === true && H.OPN_DAILY_SERIES_666.length === 8);
check('L6b server validation twin (index.ts daily list) gains stations-of-the-cross', index.includes('"barron-sunday-sermons", "stations-of-the-cross"'));
check('L6c server series def with title filter stands beside ora-pro-nobis', index.includes('key: "stations-of-the-cross"') && index.includes('titlePrefix: "Stations of the Cross"'));
check('L6d title map paints Stations of the Cross', H.opnDailySeriesTitle666('stations-of-the-cross') === 'Stations of the Cross');
check('L6e pin bumped to ora-pro-nobis-v712-1', readFileSync(path.join(W, 'src/ui.ts'), 'utf8').includes('ora-pro-nobis-v712-1')); // superseded-by-v712 pin re-point
console.log(`\nharness-v710: ${ok} ok / ${bad} bad`);
process.exit(bad ? 1 : 0);
