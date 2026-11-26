// harness-v689.mjs — v689: wallpaper stock DELETE path (Plan §2.7,
// route-level legs of C2/C4 + the route guards).
//
// Standing harness pattern: the REAL built Worker bundle (esbuild
// from source) run locally with a stub R2 bucket (Map) and a stub
// D1; LOCAL_DEV opens the session surface locally.
//
// Fixture (Improvement D — production-sourced): the fixture image
// bytes are the REAL bytes of the clean phone file
// st-sylvester-abbot-1962-calendar__2026-11-26.jpg pulled live from
// the served file route at harness start (sha256 must equal the
// live clean phone sha ef1aa1e65ea0… named in the Plan §2.1), posted
// under the fixture name fixture-saint__2099-01-01.jpg — a name that
// stands in no store, no current, no queue.
//
// Legs:
//  R1 stock-post the fixture via the standing stock route (C4 leg)
//  R2 served manifest + file read back present (C4 leg)
//  R3 DELETE removes entry + object; served manifest absent; file
//     GET 404 (C2 leg)
//  R4 second DELETE refused 404 "not stocked" (C2 leg)
//  R5 orphan object (no manifest entry) -> objectOnly:true, object
//     gone
//  R6 unparseable / pattern / bare-slug names refused 400; bad
//     variant refused 400; no agent token refused 403
//
// Run: node app/worker/harness-v689.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixture: real production bytes ----------
const CLEAN = 'st-sylvester-abbot-1962-calendar__2026-11-26.jpg';
const FIXTURE = 'fixture-saint__2099-01-01.jpg';
const liveRes = await fetch(`https://app.orapronobis.media/api/wallpaper/file/phone/${CLEAN}`);
check('F fixture source: live served file route returns the clean phone Sylvester file', liveRes.status === 200, liveRes.status);
const FIXTURE_BYTES = new Uint8Array(await liveRes.arrayBuffer());
const FIXTURE_SHA = createHash('sha256').update(FIXTURE_BYTES).digest('hex');
check('F fixture bytes: sha256 equals the live clean phone sha from Plan §2.1 (ef1aa1e6…)',
  FIXTURE_SHA === 'ef1aa1e65ea0ab771595e6ce10ae6662b4758450216a76dc48556c8bf3dd35c4', FIXTURE_SHA);

// ---------- build + stub env ----------
const TMP = mkdtempSync(tmpdir() + '/v689harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;

const store = new Map(); // R2 key -> Uint8Array
const AUDIO = {
  async get(key) {
    const v = store.get(key);
    if (!v) return null;
    return {
      body: v,
      async json() { return JSON.parse(new TextDecoder().decode(v)); },
      async arrayBuffer() { return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength); },
      async text() { return new TextDecoder().decode(v); },
    };
  },
  async put(key, value) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new TextEncoder().encode(String(value));
    store.set(key, bytes);
  },
  async delete(key) { store.delete(key); },
};
const ENV = {
  AUDIO,
  DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] },
  AGENT_TOKEN: 't', LOCAL_DEV: '1',
};
const H = { Authorization: 'Bearer t' };
const call = (method, p, headers = H, body) => WORKER.fetch(new Request('https://app.local' + p, { method, headers, body }), ENV);

// ---------- R1/R2: stock-post the fixture, read back ----------
const post = await call('POST', `/api/agent/wallpaper/stock?name=${FIXTURE}&variant=phone&kind=saint&sha256=${FIXTURE_SHA}`, H, FIXTURE_BYTES);
const postBody = await post.json();
check('R1 stock route posts the fixture (ok, unchanged=false)', post.status === 200 && postBody.ok === true && postBody.unchanged === false, { status: post.status, postBody });
check('R1 R2 object stands at wallpaper/phone/<fixture>', store.has(`wallpaper/phone/${FIXTURE}`));
const man1 = await (await call('GET', '/api/wallpaper/manifest', {})).json();
check('R2 served manifest carries the fixture entry with the real sha',
  man1.entries.some((e) => e.name === FIXTURE && e.variant === 'phone' && e.sha256 === FIXTURE_SHA), man1.entries?.length);
const file1 = await call('GET', `/api/wallpaper/file/phone/${FIXTURE}`, {});
check('R2 served file route returns 200 for the fixture', file1.status === 200, file1.status);

// ---------- R3: DELETE removes, read back gone ----------
const del = await call('DELETE', `/api/agent/wallpaper/stock?name=${FIXTURE}&variant=phone`);
const delBody = await del.json();
check('R3 delete route returns ok with the removed entry', del.status === 200 && delBody.ok === true && delBody.removed?.name === FIXTURE && delBody.removed?.sha256 === FIXTURE_SHA, { status: del.status, delBody });
check('R3 delete reports the new manifest count', delBody.manifestEntries === man1.entries.length - 1, delBody.manifestEntries);
check('R3 R2 object is deleted', !store.has(`wallpaper/phone/${FIXTURE}`));
const man2 = await (await call('GET', '/api/wallpaper/manifest', {})).json();
check('R3 served manifest no longer carries the fixture', !man2.entries.some((e) => e.name === FIXTURE && e.variant === 'phone'));
const file2 = await call('GET', `/api/wallpaper/file/phone/${FIXTURE}`, {});
check('R3 served file route 404s for the deleted fixture', file2.status === 404, file2.status);

// ---------- R4: second DELETE refused ----------
const del2 = await call('DELETE', `/api/agent/wallpaper/stock?name=${FIXTURE}&variant=phone`);
const del2Body = await del2.json();
check('R4 second delete refused 404 "not stocked"', del2.status === 404 && del2Body.error === 'not stocked', { status: del2.status, del2Body });

// ---------- R5: orphan object only ----------
await AUDIO.put(`wallpaper/watch/${FIXTURE}`, FIXTURE_BYTES);
const del3 = await call('DELETE', `/api/agent/wallpaper/stock?name=${FIXTURE}&variant=watch`);
const del3Body = await del3.json();
check('R5 orphan-object delete returns objectOnly:true, removed:null', del3.status === 200 && del3Body.ok === true && del3Body.objectOnly === true && del3Body.removed === null, { status: del3.status, del3Body });
check('R5 orphan object is deleted', !store.has(`wallpaper/watch/${FIXTURE}`));

// ---------- R6: guards ----------
const pat = await call('DELETE', `/api/agent/wallpaper/stock?name=${encodeURIComponent('st-sylvester-*')}&variant=phone`);
check('R6 pattern attempt refused 400', pat.status === 400, pat.status);
const slug = await call('DELETE', '/api/agent/wallpaper/stock?name=fixture-saint&variant=phone');
check('R6 bare-slug attempt refused 400', slug.status === 400, slug.status);
const bv = await call('DELETE', `/api/agent/wallpaper/stock?name=${FIXTURE}&variant=tablet`);
check('R6 bad variant refused 400', bv.status === 400, bv.status);
const noTok = await call('DELETE', `/api/agent/wallpaper/stock?name=${FIXTURE}&variant=phone`, {});
check('R6 delete without agent token refused 403', noTok.status === 403, noTok.status);
const monthly = await call('DELETE', '/api/agent/wallpaper/stock?name=fixture-devotion__2099-01.jpg&variant=phone');
check('R6 monthly-shaped name parses (404 not stocked, not 400)', monthly.status === 404, monthly.status);

console.log(`\nRESULT ${ok} ok, ${bad} bad`);
process.exit(bad ? 1 : 0);
