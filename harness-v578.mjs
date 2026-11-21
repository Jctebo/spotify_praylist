// harness-v578.mjs — v578 (Encrypt the on-device personal
// data — the PIN becomes the vault key), Plan §2.9 legs.
//
// Worlds run over the RENDERED client (the APP_JS template
// evaluated whole, the v570 discipline — a harness over the
// raw source proved nothing in the v568 break). Each world
// slices the v568 local layer + the api() seam out of the
// rendered client and runs them in a vm context over a
// stub localStorage. "Reload" = a fresh world over the
// same store Map.
//
// Legs: S statics · C1 ciphertext at rest · C2 unlock
// round-trip · C3 wrong PIN · C4 recovery restore ·
// C5 migration (Q4 A) · C6 no-PIN store · C7 export after
// unlock · C8 PWA worlds · C9 passkey + biometric seams.
//
// Run: node harness-v578.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import vm from "node:vm";
import os from "node:os";
import path from "node:path";

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + extra : "")); }
}
const J = (o) => JSON.stringify(o);

// ---- the rendered client ----
const clientSrc = readFileSync("app/worker/src/client.ts", "utf8");
const tmpMod = path.join(os.tmpdir(), "v578-rendered-client.mjs");
writeFileSync(tmpMod, clientSrc.replace("export const APP_JS =", "globalThis.APP_JS ="));
await import(tmpMod);
const RENDERED = globalThis.APP_JS;

const LAYER_START = RENDERED.indexOf("/* ---------------- v568: local personal data ----------------");
const LAYER_END = RENDERED.indexOf("function opnScrubDayPayload");
const API_START = RENDERED.indexOf("function api(path, opts)");
const API_END = RENDERED.indexOf("function post(path, body)");
if (LAYER_START < 0 || LAYER_END < 0 || API_START < 0 || API_END < 0) {
  console.log("FAIL slice markers not found");
  process.exit(1);
}
const LAYER = RENDERED.slice(LAYER_START, LAYER_END);
const API = RENDERED.slice(API_START, API_END);

const flush = async (store, key) => {
  // Drain the vault write chain: poll until the stored
  // value is stable across three reads.
  let last = null, stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    await new Promise((r) => setTimeout(r, 25));
    const v = store.get(key) || null;
    if (v === last) stable++; else { stable = 0; last = v; }
  }
};

function makeBridgeStub() {
  let wrapped = null;
  return {
    vaultBiometricStatus: () => Promise.resolve({ available: true, enrolled: !!wrapped }),
    vaultBiometricEnroll: (a) => { wrapped = a.keyB64; return Promise.resolve({ ok: true }); },
    vaultBiometricUnlock: () => (wrapped ? Promise.resolve({ keyB64: wrapped }) : Promise.reject(new Error("not-enrolled"))),
    vaultBiometricClear: () => { wrapped = null; return Promise.resolve({ ok: true }); },
  };
}

function makeWorld(store, opts = {}) {
  const shape = opts.shape || "public";
  const inShell = opts.inShell !== false;
  const standalone = !!opts.standalone;
  const bridge = opts.bridge || null;
  const nav = { standalone: !!opts.iosStandalone, credentials: opts.credentials };
  const fetchLog = [];
  const sandbox = {
    console, URLSearchParams, Intl, JSON, Math, Date, Promise, Error, Object, Array, String, Number, Boolean, RegExp, Map, Set, Uint8Array, ArrayBuffer, TextEncoder, TextDecoder,
    crypto: globalThis.crypto,
    btoa: globalThis.btoa, atob: globalThis.atob,
    setTimeout, clearTimeout,
    window: {
      __OPN_SHAPE__: shape,
      matchMedia: () => ({ matches: standalone }),
      navigator: nav,
      PublicKeyCredential: function () {},
    },
    navigator: nav,
    location: { hostname: "app.orapronobis.media", reload: () => {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    },
    fetch: (p, o) => {
      fetchLog.push({ path: p, opts: o });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, viaFetch: true }) });
    },
    oraInShell: () => inShell,
    oraBridgePlugin: () => bridge,
    todayChicago: () => "2026-11-21",
    pinToken: null,
    pinStateCache: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const code = LAYER + "\n" + API + "\n" +
    "this.__api = api; this.__layer = { opnMode, opnDoc, opnVaultPeek, opnVaultLocked, opnPinSet, opnPinLoad, opnExportText, opnPasskeyEnroll, opnPasskeyUnlock, opnBiometricStatus, opnBiometricEnroll, opnBiometricUnlock };";
  vm.runInContext(code, sandbox, { filename: "rendered-layer.js" });
  return { api: sandbox.__api, layer: sandbox.__layer, store, fetchLog, sandbox };
}

const post = (api, p, body) => api(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: J(body || {}) });
const NEEDLE = "For Zzqx Needle Person";
const DATA = "opn-personal-data-v1";
const PINSTORE = "opn-pin-local-v1";

// ---------------- S statics ----------------
function sLegs() {
  const names = execSync("git diff --name-only a16bd7e HEAD", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  check("S1 diff confined to client.ts (+ this harness)", names.every((n) => n === "app/worker/src/client.ts" || n === "harness-v578.mjs"), names.join(","));
  const ui = readFileSync("app/worker/src/ui.ts", "utf8");
  check("S2 SW pin unmoved before Ship (v577 pin stands)", ui.includes("ora-pro-nobis-v577-1"));
  check("S3 envelope format + wrap slots stand in the layer",
    LAYER.includes("orapronobis-personal-data-encrypted") && LAYER.includes("wraps") && LAYER.includes("opnVaultMakeSlot"));
  check("S4 the layer holds no network call", !/[^a-zA-Z]fetch\(/.test(LAYER));
  const migs = readdirSync("app/migrations").filter((f) => f.endsWith(".sql")).sort();
  check("S5 migrations end at 0042", migs[migs.length - 1].startsWith("0042"), migs[migs.length - 1]);
  check("S6 PWA detection stands (standalone + iOS form)",
    LAYER.includes("(display-mode: standalone)") && LAYER.includes("navigator") && LAYER.includes("standalone === true"));
  let parses = true;
  try { new vm.Script(RENDERED); } catch (e) { parses = false; }
  check("S7 rendered client parses whole", parses);
  const idx = readFileSync("app/worker/src/index.ts", "utf8");
  check("S8 index.ts untouched by the branch", !execSync("git diff --name-only a16bd7e HEAD", { encoding: "utf8" }).includes("index.ts"));
}

// ---------------- C1 ciphertext at rest ----------------
let c1 = {};
async function c1Leg() {
  const store = new Map();
  const w = makeWorld(store, {});
  const set = await post(w.api, "/api/pin/set", { pin: "2468" });
  check("C1 pin set issues a recovery code", typeof set.recoveryCode === "string" && set.recoveryCode.length >= 12, J(Object.keys(set)));
  c1.code = set.recoveryCode;
  await post(w.api, "/api/prayer/intentions", { text: NEEDLE, priority: "H" });
  await flush(store, DATA);
  const raw = store.get(DATA) || "";
  const parsed = JSON.parse(raw);
  check("C1 store is the vault envelope", parsed.format === "orapronobis-personal-data-encrypted" && !!parsed.wraps.pin && !!parsed.wraps.recovery && !!parsed.ct);
  check("C1 needle text absent from storage", !raw.includes(NEEDLE) && !raw.includes("Zzqx"));
  check("C1 PIN store holds no wrap material", !(store.get(PINSTORE) || "").includes("wraps") && !raw.includes("pinHash"));
  c1.store = store;
}

// ---------------- C2 unlock round-trip ----------------
async function c2Leg() {
  const w = makeWorld(c1.store, {});
  check("C2 reload stands locked", w.layer.opnVaultLocked() === true);
  const list = await w.api("/api/prayer/intentions");
  check("C2 locked reads answer empty", list.intentions.length === 0, J(list.intentions));
  let err = null;
  try { await post(w.api, "/api/prayer/intentions", { text: "sneak", priority: "L" }); } catch (e) { err = e; }
  check("C2 locked write refuses 423", !!err && err.status === 423, err && err.status);
  const v = await post(w.api, "/api/pin/verify", { pin: "2468" });
  check("C2 verify issues a token", typeof v.token === "string");
  const list2 = await w.api("/api/prayer/intentions");
  check("C2 unlocked reads the needle back", list2.intentions.length === 1 && list2.intentions[0].text === NEEDLE, J(list2.intentions));
}

// ---------------- C3 wrong PIN ----------------
async function c3Leg() {
  const w = makeWorld(c1.store, {});
  let err = null;
  try { await post(w.api, "/api/pin/verify", { pin: "9999" }); } catch (e) { err = e; }
  check("C3 wrong PIN refuses 401 with countdown", !!err && err.status === 401 && err.data && err.data.attemptsRemaining === 4, err && J(err.data));
  check("C3 store stays ciphertext + locked", JSON.parse(c1.store.get(DATA)).format === "orapronobis-personal-data-encrypted" && w.layer.opnVaultLocked() === true);
}

// ---------------- C4 recovery restore ----------------
async function c4Leg() {
  const w = makeWorld(c1.store, {});
  const rec = await post(w.api, "/api/pin/recover", { code: c1.code, newPin: "1357" });
  check("C4 recover issues a fresh code + token", typeof rec.recoveryCode === "string" && rec.recoveryCode !== c1.code && typeof rec.token === "string");
  const w2 = makeWorld(c1.store, {});
  let err = null;
  try { await post(w2.api, "/api/pin/verify", { pin: "2468" }); } catch (e) { err = e; }
  check("C4 old PIN now fails", !!err && err.status === 401);
  await post(w2.api, "/api/pin/verify", { pin: "1357" });
  const list = await w2.api("/api/prayer/intentions");
  check("C4 data intact under the new PIN", list.intentions.length === 1 && list.intentions[0].text === NEEDLE, J(list.intentions));
}

// ---------------- C5 migration (Q4 A) ----------------
async function c5Leg() {
  const store = new Map();
  const w = makeWorld(store, {});
  await post(w.api, "/api/prayer/intentions", { text: NEEDLE, priority: "M" });
  // The legacy pre-v578 state: a PIN record standing over
  // a PLAIN store (the record written directly, no vault).
  await w.layer.opnPinSet("2468");
  check("C5 seeded store stands plain", JSON.parse(store.get(DATA)).format === "orapronobis-personal-data");
  const w2 = makeWorld(store, {});
  const before = await w2.api("/api/prayer/intentions");
  check("C5 plain store reads before migration", before.intentions.length === 1);
  const v = await post(w2.api, "/api/pin/verify", { pin: "2468" });
  check("C5 first verify migrates + issues a new recovery code", v.migrated === true && typeof v.recoveryCode === "string", J(Object.keys(v)));
  await flush(store, DATA);
  const raw = store.get(DATA) || "";
  check("C5 store is now the envelope, needle gone", JSON.parse(raw).format === "orapronobis-personal-data-encrypted" && !raw.includes("Zzqx"));
  const w3 = makeWorld(store, {});
  check("C5 reload stands locked", w3.layer.opnVaultLocked() === true);
  await post(w3.api, "/api/pin/verify", { pin: "2468" });
  const after = await w3.api("/api/prayer/intentions");
  check("C5 data intact after migration + unlock", after.intentions.length === 1 && after.intentions[0].text === NEEDLE);
}

// ---------------- C6 no-PIN store ----------------
async function c6Leg() {
  const store = new Map();
  const w = makeWorld(store, {});
  await post(w.api, "/api/prayer/intentions", { text: NEEDLE, priority: "L" });
  check("C6 no-PIN store round-trips plain", JSON.parse(store.get(DATA)).format === "orapronobis-personal-data" && (store.get(DATA) || "").includes("Zzqx"));
  await post(w.api, "/api/pin/set", { pin: "2468" });
  await flush(store, DATA);
  check("C6 setting the PIN encrypts in the same action", JSON.parse(store.get(DATA)).format === "orapronobis-personal-data-encrypted" && !(store.get(DATA) || "").includes("Zzqx"));
}

// ---------------- C7 export after unlock ----------------
async function c7Leg() {
  const store = new Map();
  const w = makeWorld(store, {});
  await post(w.api, "/api/pin/set", { pin: "2468" });
  await post(w.api, "/api/prayer/intentions", { text: NEEDLE, priority: "H" });
  await flush(store, DATA);
  const text = w.layer.opnExportText();
  const parsed = JSON.parse(text);
  check("C7 export is the readable v570 envelope", parsed.format === "orapronobis-personal-data" && parsed.counts && parsed.counts.intentions === 1, J(parsed.counts));
  check("C7 export carries no vault or PIN material", !text.includes("orapronobis-personal-data-encrypted") && !text.includes("pinHash") && !text.includes('"wraps"') && !text.includes("recoveryHash"));
}

// ---------------- C8 PWA worlds ----------------
async function c8Leg() {
  const storeA = new Map();
  const wa = makeWorld(storeA, { inShell: false, standalone: true });
  check("C8 installed PWA is device mode", wa.layer.opnMode() === "device");
  await post(wa.api, "/api/pin/set", { pin: "2468" });
  await post(wa.api, "/api/prayer/intentions", { text: NEEDLE, priority: "H" });
  await flush(storeA, DATA);
  check("C8 PWA data persists encrypted", JSON.parse(storeA.get(DATA)).format === "orapronobis-personal-data-encrypted");
  const storeB = new Map();
  const wb = makeWorld(storeB, { inShell: false, standalone: false });
  check("C8 plain tab is web mode", wb.layer.opnMode() === "web");
  const list = await wb.api("/api/prayer/intentions");
  let err = null;
  try { await post(wb.api, "/api/prayer/intentions", { text: "x", priority: "L" }); } catch (e) { err = e; }
  check("C8 web reads empty + writes refused, nothing stored", list.intentions.length === 0 && !!err && !storeB.has(DATA));
}

// ---------------- C9 passkey + biometric seams ----------------
async function c9Leg() {
  const PRF = new Uint8Array(32).fill(0x42);
  const creds = {
    create: () => Promise.resolve({
      id: "cHJmLWNyZWQtdjU3OA", rawId: new Uint8Array([1, 2, 3]).buffer,
      getClientExtensionResults: () => ({ prf: { results: { first: PRF.buffer } } }),
    }),
    get: () => Promise.resolve({
      getClientExtensionResults: () => ({ prf: { results: { first: PRF.buffer } } }),
    }),
  };
  const bridge = makeBridgeStub();
  const store = new Map();
  const w = makeWorld(store, { credentials: creds, bridge });
  await post(w.api, "/api/pin/set", { pin: "2468" });
  await post(w.api, "/api/prayer/intentions", { text: NEEDLE, priority: "H" });
  await flush(store, DATA);
  await w.layer.opnBiometricEnroll();
  const bst = await w.layer.opnBiometricStatus();
  check("C9 biometric enrolment stands at the seam", bst.available === true && bst.enrolled === true, J(bst));
  await w.layer.opnPasskeyEnroll();
  const env = JSON.parse(store.get(DATA));
  check("C9 passkey wrap slot written", !!(env.wraps && env.wraps.passkey && env.wraps.passkey.credId === "cHJmLWNyZWQtdjU3OA"));
  const w2 = makeWorld(store, { credentials: creds, bridge });
  check("C9 reload locked", w2.layer.opnVaultLocked() === true);
  await w2.layer.opnBiometricUnlock();
  const l1 = await w2.api("/api/prayer/intentions");
  check("C9 biometric unlock restores the data", l1.intentions.length === 1 && l1.intentions[0].text === NEEDLE);
  const w3 = makeWorld(store, { credentials: creds, bridge });
  await w3.layer.opnPasskeyUnlock();
  const l2 = await w3.api("/api/prayer/intentions");
  check("C9 passkey unlock restores the data", l2.intentions.length === 1 && l2.intentions[0].text === NEEDLE);
  // PRF absent: enrolment refuses plainly, PIN path intact.
  const noPrf = {
    create: () => Promise.resolve({ id: "eA", rawId: new Uint8Array([9]).buffer, getClientExtensionResults: () => ({}) }),
    get: () => Promise.resolve({ getClientExtensionResults: () => ({}) }),
  };
  const store2 = new Map();
  const w4 = makeWorld(store2, { credentials: noPrf, bridge: makeBridgeStub() });
  await post(w4.api, "/api/pin/set", { pin: "2468" });
  let err = null;
  try { await w4.layer.opnPasskeyEnroll(); } catch (e) { err = e; }
  check("C9 PRF-absent enrolment refused plainly", !!err && /cannot unlock the vault/.test(err.message || ""), err && err.message);
  const v = await post(w4.api, "/api/pin/verify", { pin: "2468" });
  check("C9 PIN path intact after the refusal", typeof v.token === "string");
}

sLegs();
await c1Leg();
await c2Leg();
await c3Leg();
await c4Leg();
await c5Leg();
await c6Leg();
await c7Leg();
await c8Leg();
await c9Leg();
console.log(`\nharness-v578: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
