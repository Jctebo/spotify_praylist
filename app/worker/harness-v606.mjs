// harness-v606.mjs — v606 (biometric enrolment fix), client
// legs C1-C4. Modeled on harness-v578: the RENDERED client
// (the APP_JS template evaluated whole) is sliced — the
// v568 local layer (which carries opnBindUnlockCard, the
// PIN store and the biometric seam) plus fillPinSection —
// and driven in jsdom over a stubbed native bridge.
//
// Legs:
//  L1 enrol reject surfaces the native code in the
//     Settings note (not the bare generic sentence)
//  L2 unlock reject surfaces the native code
//  L3 unlock 'key-invalidated' -> bridge clear called,
//     local biometricEnrolled flag cleared, bio button
//     hidden, message names the code + Settings
//  L4 status enrolled -> Settings renders the re-enrol
//     button visible + the 'is on' note
//  L5 enrol success -> biometricEnrolled flag true in the
//     store; the card re-renders to the 'is on' note
//  L6 unlock success -> the done path runs (rerender)
//
// Run: node app/worker/harness-v606.mjs
// Fail-on-old: OPN_CLIENT=<unmodified client.ts> node \
//   app/worker/harness-v606.mjs   (L1-L4 must fail)

import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); }
catch (e) {
  ({ JSDOM } = await import(path.join(os.homedir(), "workspace/projects/ora-pro-nobis/standing-clone/node_modules/jsdom/lib/api.js")));
}

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok   " + name); }
  else { bad++; console.log("FAIL " + name + (extra !== undefined ? " :: " + extra : "")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) { if (fn()) return true; await sleep(50); }
  return fn();
}

// ---- the rendered client ----
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const clientPath = process.env.OPN_CLIENT || path.join(ROOT, "app/worker/src/client.ts");
const clientSrc = readFileSync(clientPath, "utf8");
const tmpMod = path.join(os.tmpdir(), "v606-rendered-client.mjs");
writeFileSync(tmpMod, clientSrc.replace("export const APP_JS =", "globalThis.APP_JS ="));
await import(tmpMod);
const RENDERED = globalThis.APP_JS;

const LAYER_START = RENDERED.indexOf("/* ---------------- v568: local personal data ----------------");
const LAYER_END = RENDERED.indexOf("function opnScrubDayPayload");
const PIN_START = RENDERED.indexOf("function fillPinSection()");
const PIN_END = RENDERED.indexOf("function openPinSetSheet", PIN_START);
if (LAYER_START < 0 || LAYER_END < 0 || PIN_START < 0 || PIN_END < 0) {
  console.log("FAIL slice markers not found");
  process.exit(1);
}
const SLICE = RENDERED.slice(LAYER_START, LAYER_END) + "\n" + RENDERED.slice(PIN_START, PIN_END);

const DATA_KEY = "opn-personal-data-v1";
const PIN_KEY = "opn-pin-local-v1";
const PLAIN_DOC = JSON.stringify({ format: "orapronobis-personal-data", formatVersion: 1, sections: { intentions: [], profiles: null } });

const PRELUDE = [
  "window.__OPN_SHAPE__ = 'public';",
  "var pinToken = 'tok'; var pinStateCache = null;",
  "function oraBridgePlugin() { return window.__bridge || null; }",
  "function oraInShell() { return !!oraBridgePlugin(); }",
  "function api(path, opts) { return Promise.resolve({ pinSet: true }); }",
  "function post(path, body) { return Promise.resolve({}); }",
  "function fetchPinState() { return Promise.resolve({ pinSet: true, retryAfterSeconds: 0 }); }",
  "function showRecoverySheet(code, cb) { if (cb) cb(); }",
  "function renderSettings() {}",
  "function openPinSetSheet() {}",
  "function openConfirm() {}",
  "function renderPinGate() {}",
].join("\n");

function makeBridge(behavior) {
  const calls = { clear: 0, enrol: [], unlock: 0 };
  const bridge = {
    vaultBiometricStatus: () => Promise.resolve({ available: !behavior.status || behavior.status.available !== false, enrolled: !!(behavior.status && behavior.status.enrolled) || !!behavior.wrapped }),
    vaultBiometricEnroll: (a) => {
      calls.enrol.push(a);
      if (behavior.enrolError) return Promise.reject(new Error(behavior.enrolError));
      behavior.wrapped = a.keyB64;
      return Promise.resolve({ ok: true });
    },
    vaultBiometricUnlock: () => {
      calls.unlock++;
      if (behavior.unlockError) return Promise.reject(new Error(behavior.unlockError));
      return behavior.wrapped ? Promise.resolve({ keyB64: behavior.wrapped }) : Promise.reject(new Error("not-enrolled"));
    },
    vaultBiometricClear: () => { calls.clear++; behavior.wrapped = null; return Promise.resolve({ ok: true }); },
  };
  return { bridge, calls };
}

function makeWorld(store, behavior) {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "https://app.orapronobis.media/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window;
  try { Object.defineProperty(w, "crypto", { value: webcrypto }); } catch (e) {}
  const warns = [];
  try { w.console = { log: () => {}, warn: (m) => { warns.push(String(m)); }, error: () => {} }; } catch (e) {}
  Object.keys(store || {}).forEach((k) => w.localStorage.setItem(k, store[k]));
  const made = makeBridge(behavior);
  w.__bridge = made.bridge;
  const s = w.document.createElement("script");
  s.textContent = PRELUDE + "\n" + SLICE;
  w.document.body.appendChild(s);
  return { w, warns, calls: made.calls, behavior };
}

function snapshot(w) {
  const out = {};
  for (let i = 0; i < w.localStorage.length; i++) {
    const k = w.localStorage.key(i);
    out[k] = w.localStorage.getItem(k);
  }
  return out;
}
function click(w, el) { el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); }

// Build a real vault through the client's own pin-set path
// (opnPinSet + opnVaultCreate, PIN 2468) and enrol against
// the stub bridge, so the unlock worlds hold a real key.
async function enrolledStore(behavior) {
  const store = {}; store[DATA_KEY] = PLAIN_DOC;
  const world = makeWorld(store, behavior);
  const w = world.w;
  w.opnDoc();
  await w.opnPinSet("2468");
  await w.opnVaultCreate("2468", "AAAA-BBBB-CCCC");
  await w.opnBiometricEnroll();
  return snapshot(w);
}

// ---------------- L1: enrol reject surfaces the code ----------------
{
  const behavior = { status: { available: true, enrolled: false }, enrolError: "biometric-unavailable: IllegalArgumentException: Negative text must be set and non-empty." };
  const store = await enrolledStore({ status: { available: true, enrolled: true } });
  const { w } = makeWorld(store, behavior);
  // enrol needs the in-memory vault key: re-apply it from
  // the PIN in this world, exactly as a session unlock does
  await w.opnVaultUnlockWithPin("2468");
  w.document.body.innerHTML = '<div id="pin-section"></div>';
  w.fillPinSection();
  const btnUp = await until(() => { const b = w.document.getElementById("pin-bio-enrol"); return b && b.style.display !== "none"; });
  check("L1 enrol button renders (available, not enrolled)", btnUp);
  if (btnUp) click(w, w.document.getElementById("pin-bio-enrol"));
  const noted = await until(() => { const n = w.document.getElementById("pin-vault-note"); return n && /biometric-unavailable/.test(n.textContent); });
  const note = w.document.getElementById("pin-vault-note");
  check("L1 Settings note contains 'biometric-unavailable'", noted, note && note.textContent);
  check("L1 note is NOT the bare generic sentence", !!note && note.textContent !== "Biometric enrolment did not complete. Your PIN stands.", note && note.textContent);
}

// ---------------- L4 + L5: enrolled status / enrol success ----------------
{
  const behavior = { status: { available: true, enrolled: true } };
  const store = await enrolledStore(behavior);
  const { w } = makeWorld(store, behavior);
  await w.opnVaultUnlockWithPin("2468");
  w.document.body.innerHTML = '<div id="pin-section"></div>';
  w.fillPinSection();
  const reUp = await until(() => { const b = w.document.getElementById("pin-bio-reenrol"); return b && b.style.display !== "none"; });
  const note = w.document.getElementById("pin-vault-note");
  check("L4 re-enrol button visible when enrolled", reUp);
  check("L4 'is on' note stands", !!note && note.textContent === "Fingerprint / face unlock is on for this phone.", note && note.textContent);
}
{
  const behavior = { status: { available: true, enrolled: false } };
  const store = {}; store[DATA_KEY] = PLAIN_DOC;
  const world = makeWorld(store, behavior);
  const w = world.w;
  w.opnDoc();
  await w.opnPinSet("2468");
  await w.opnVaultCreate("2468", "AAAA-BBBB-CCCC");
  w.document.body.innerHTML = '<div id="pin-section"></div>';
  w.fillPinSection();
  const btnUp = await until(() => { const b = w.document.getElementById("pin-bio-enrol"); return b && b.style.display !== "none"; });
  check("L5 enrol button renders", btnUp);
  if (btnUp) click(w, w.document.getElementById("pin-bio-enrol"));
  const on = await until(() => { const n = w.document.getElementById("pin-vault-note"); return n && n.textContent === "Fingerprint / face unlock is on for this phone."; });
  const flag = (() => { try { return JSON.parse(w.localStorage.getItem(PIN_KEY)).biometricEnrolled === true; } catch (e) { return false; } })();
  check("L5 enrol success sets biometricEnrolled in the store", flag);
  check("L5 card re-renders to the 'is on' note", on);
}

// ---------------- L2 + L3 + L6: the unlock card ----------------
async function unlockWorld(behavior) {
  const store = await enrolledStore({ status: { available: true, enrolled: true } });
  // the enrol world wrapped the key on ITS bridge; hand the
  // wrapped key to this world's bridge through the enrol
  // capture: re-enrol is not possible locked, so carry the
  // wrapped value via a probe world is overkill — instead
  // the shared behavior object holds it (same stub family)
  const world = makeWorld(store, behavior);
  const w = world.w;
  let rerenders = 0;
  w.document.body.innerHTML = w.opnUnlockCardHtml();
  w.opnBindUnlockCard(() => { rerenders++; });
  const bioUp = await until(() => { const b = w.document.getElementById("opn-unlock-bio"); return b && b.style.display !== "none"; });
  return { w, world, bioUp, rerenders: () => rerenders };
}
{
  // L2: generic unlock reject surfaces its code
  const behavior = { status: { available: true, enrolled: true }, unlockError: "biometric-error-7: Try again" };
  const { w, bioUp } = await unlockWorld(behavior);
  check("L2 bio button renders on the unlock card", bioUp);
  if (bioUp) click(w, w.document.getElementById("opn-unlock-bio"));
  const msgOk = await until(() => { const m = w.document.getElementById("opn-unlock-msg"); return m && /biometric-error-7/.test(m.textContent); });
  const m = w.document.getElementById("opn-unlock-msg");
  check("L2 unlock msg contains 'biometric-error-7'", msgOk, m && m.textContent);
}
{
  // L3: key-invalidated clears and directs to Settings
  const behavior = { status: { available: true, enrolled: true }, unlockError: "key-invalidated" };
  const { w, world, bioUp } = await unlockWorld(behavior);
  check("L3 bio button renders on the unlock card", bioUp);
  if (bioUp) click(w, w.document.getElementById("opn-unlock-bio"));
  const msgOk = await until(() => { const m = w.document.getElementById("opn-unlock-msg"); return m && /key-invalidated/.test(m.textContent); });
  const m = w.document.getElementById("opn-unlock-msg");
  const bio = w.document.getElementById("opn-unlock-bio");
  const flag = (() => { try { return JSON.parse(w.localStorage.getItem(PIN_KEY)).biometricEnrolled === false; } catch (e) { return null; } })();
  check("L3 bridge vaultBiometricClear called", world.calls.clear >= 1, world.calls.clear);
  check("L3 local biometricEnrolled flag cleared", flag === true, flag);
  check("L3 bio button hidden", !!bio && bio.style.display === "none", bio && bio.style.display);
  check("L3 msg contains 'key-invalidated' and 'Settings'", msgOk && !!m && /Settings/.test(m.textContent), m && m.textContent);
}
{
  // L6: unlock success completes through the done path
  const behavior = { status: { available: true, enrolled: true } };
  // enrol + unlock must share one wrapped key: build the
  // store with THIS behavior so its bridge holds the key
  const store = await enrolledStore(behavior);
  const world = makeWorld(store, behavior);
  const w = world.w;
  let rerenders = 0;
  w.document.body.innerHTML = w.opnUnlockCardHtml();
  w.opnBindUnlockCard(() => { rerenders++; });
  const bioUp = await until(() => { const b = w.document.getElementById("opn-unlock-bio"); return b && b.style.display !== "none"; });
  check("L6 bio button renders on the unlock card", bioUp);
  if (bioUp) click(w, w.document.getElementById("opn-unlock-bio"));
  const done = await until(() => rerenders > 0 && w.opnVaultLocked() === false);
  check("L6 unlock success completes (done path runs, vault unlocked)", done, { rerenders });
}

console.log("\nharness-v606: " + ok + " ok / " + bad + " not-ok (client: " + clientPath + ")");
process.exit(bad ? 1 : 0);
