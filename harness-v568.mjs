#!/usr/bin/env node
// harness-v568 — Local personal data on-device (v567 set member 1).
//
// Gates:
//  S statics — the diff against the production base (GitHub main
//    67f8751, the v574 closeout) is confined to client.ts, ui.ts,
//    index.ts, this harness and the release doc; migrations end
//    at 0042; the SW pin is unmoved (it moves only at Ship); the
//    local layer holds no network call of its own; the Worker's
//    public-shape refusal + shell marker stand as built.
//  W worlds (Node vm over the REAL client layer + api() seam,
//    stubbed fetch that records every call) —
//    W1 device: every personal-data class round-trips through
//      the on-device file in the server contracts' shapes, and
//      NOT ONE personal call reaches fetch; the file on disk is
//      the v570 envelope; PIN material never enters it.
//    W2 device PIN: set → gate refuses exam/confession without
//      a token (403 pin_required) → wrong PIN counts down →
//      verify opens → entries flow → change/remove stand.
//    W3 draws: per-track draws come from the LOCAL pool, first
//      draw wins, a retired intention never draws.
//    W4 web: reads answer empty-but-valid, writes are refused
//      with the app-pointer error, and NOTHING is written to
//      browser storage (no personal-data key ever stands).
//    W5 server (private shape): api() sends personal calls to
//      fetch exactly as before — the layer never runs.
//  L served legs (wrangler dev, LOCAL_DEV): public shape —
//    the shell carries "public", a personal route answers the
//    refusal, a content route does NOT; private shape — the
//    shell carries "private" and the personal route answers
//    the standing server payload.
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const BASE = "67f8751";
const C = "app/worker/src/client.ts";
const I = "app/worker/src/index.ts";
const U = "app/worker/src/ui.ts";
let ok = 0, bad = 0;
const check = (name, cond, extra = "") => {
  if (cond) { ok++; console.log("ok", name); }
  else { bad++; console.log("NOT-OK", name, extra); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------- S statics ---------------- */
const changed = [...new Set([
  ...execSync(`git diff --name-only ${BASE} HEAD`, { encoding: "utf8" }).split("\n"),
  ...execSync("git diff --name-only", { encoding: "utf8" }).split("\n"),
])].filter(Boolean).sort();
check("S1 diff confined", eq(changed, ["app/worker/src/client.ts", "app/worker/src/index.ts", "app/worker/src/ui.ts", "harness-v568.mjs"].sort()),
  changed.join(","));
const migs = execSync("ls app/migrations", { encoding: "utf8" }).split("\n").filter(Boolean);
check("S2 migrations end at 0042", migs[migs.length - 1].startsWith("0042"), migs[migs.length - 1]);
const cSrc = readFileSync(C, "utf8");
const iSrc = readFileSync(I, "utf8");
const uSrc = readFileSync(U, "utf8");
const baseUi = execSync(`git show ${BASE}:${U}`, { encoding: "utf8" });
const pinOf = (t) => { const m = /ora-pro-nobis-v\d+-\d+/.exec(t); return m && m[0]; };
check("S3 SW pin unmoved", pinOf(uSrc) === pinOf(baseUi), `${pinOf(uSrc)} vs ${pinOf(baseUi)}`);
const layerStart = cSrc.indexOf("/* ---------------- v568: local personal data");
const layerEnd = cSrc.indexOf("function api(path, opts) {");
check("S4 local layer stands before api()", layerStart > 0 && layerEnd > layerStart);
const layer = cSrc.slice(layerStart, layerEnd);
check("S5 layer holds no network call", !/[^a-zA-Z]fetch\(/.test(layer) && !layer.includes("XMLHttpRequest"));
check("S6 layer writes the v570 envelope", layer.includes("'orapronobis-personal-data'") && layer.includes("formatVersion: 1"));
check("S7 PIN stands outside the file", layer.includes("OPN_PIN_KEY = 'opn-pin-local-v1'") && !/sections:\s*\{[^}]*pin/i.test(layer));
check("S8 worker refusal stands", iSrc.includes('personal data lives on your device in the app') && iSrc.includes('PUBLIC_HOST = "app.orapronobis.media"'));
check("S9 shell marker stands", uSrc.includes('window.__OPN_SHAPE__="<!--OPN_SHAPE-->"') && iSrc.includes('SHELL_HTML.replace("<!--OPN_SHAPE-->", shape)'));
check("S10 harness seam is LOCAL_DEV-gated", iSrc.includes('env.LOCAL_DEV === "1" && env.OPN_PUBLIC_SHAPE === "1"'));
const personalNeedles = ["intentions", "profiles", "book/favorites", "starred", "mass-personal-prayer", "mass-universal-prayer", "day-additions", "block-order", "source-settings", "exam/", "confession", "pin/", "track-draws", "podcasts/mark", "podcasts/unmark", "podcasts/position", "day-position"];
const missing = personalNeedles.filter((n) => !layer.includes("/api/" + (n.startsWith("prayer") || n.startsWith("player") ? "" : "") + n) && !layer.includes(n));
check("S11 every personal family routed locally", missing.length === 0, missing.join(","));

/* ---------------- W worlds ---------------- */
function makeWorld(shape, inShell) {
  const store = new Map();
  const fetchLog = [];
  const sandbox = {
    console, URLSearchParams, Intl, JSON, Math, Date, Promise, Error, Object, Array, String, Number, Boolean, RegExp, Map, Set, Uint8Array, TextEncoder,
    crypto: globalThis.crypto,
    window: { __OPN_SHAPE__: shape },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    },
    fetch: (path, opts) => {
      fetchLog.push({ path, opts });
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({ ok: true, viaFetch: true }),
      });
    },
    oraInShell: () => inShell,
    todayChicago: () => "2026-11-21",
    pinToken: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const apiStart = layerEnd;
  const apiEnd = cSrc.indexOf("function post(path, body)", apiStart);
  const code = layer + "\n" + cSrc.slice(apiStart, apiEnd) + "\n" +
    "this.__api = api; this.__layer = { opnMode, opnDoc, opnLocalApi, opnIsPersonalPath, opnPointerHtml };";
  vm.runInContext(code, sandbox, { filename: "client-layer.js" });
  return { api: sandbox.__api, layer: sandbox.__layer, store, fetchLog, sandbox };
}
const J = (o) => JSON.stringify(o);
const post = (api, path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: J(body || {}) });
const put = (api, path, body) => api(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: J(body || {}) });

async function w1() {
  const w = makeWorld("public", true);
  const api = w.api;
  check("W1 mode is device", w.layer.opnMode() === "device");
  // intentions CRUD
  const add = await post(api, "/api/prayer/intentions", { text: "For my mother", priority: "H" });
  check("W1 intention add shape", add.ok === true && add.id === 1 && add.redrawn === false, J(add));
  await post(api, "/api/prayer/intentions", { text: "For the team", priority: "L" });
  const list = await api("/api/prayer/intentions");
  check("W1 intentions list sorted + shaped", list.intentions.length === 2 && list.intentions[0].priority === "H" && list.intentions[0].drawnCount === 0 && list.intentions[0].status === "active", J(list.intentions));
  await api("/api/prayer/intentions/2", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: J({ priority: "M" }) });
  const list2 = await api("/api/prayer/intentions");
  check("W1 intention patch", list2.intentions[1].priority === "M");
  // profiles: seed defaults + fold + writes
  const prof = await api("/api/prayer/profiles");
  check("W1 profiles seed = 3 defaults", prof.profiles.length === 3 && prof.state.standingKey === "salesian" && prof.effective.key === "salesian", J(prof.state));
  const saved = await put(api, "/api/prayer/profiles/save", { name: "My Rule", honorLine: "", coreBlocks: ["Morning", "Night"], layers: { novenas: { on: false }, podcasts: { on: false, series: [] } } });
  check("W1 profile save-as-new", saved.profiles.length === 4 && saved.state.version === prof.state.version + 1, J(saved.state));
  const dp = await put(api, "/api/prayer/profiles/day-pick", { date: "2026-11-21", profileKey: "my-rule" });
  check("W1 day pick governs the fold", dp.effective.key === "my-rule" && dp.effective.resolvedBy === "pick", J(dp.effective));
  // favorites + starred
  await put(api, "/api/prayer/book/favorites", { favorites: ["our-father", "hail-mary", "our-father"] });
  const fav = await api("/api/prayer/book/favorites");
  check("W1 favorites dedupe + order", eq(fav.favorites, ["our-father", "hail-mary"]), J(fav));
  await put(api, "/api/prayer/starred", { starred: [{ k: "prayer", id: "our-father", title: "Our Father" }, { k: "episode", id: "ep1", title: "Ep 1" }] });
  const star = await api("/api/prayer/starred");
  check("W1 starred round-trip", star.starred.length === 2 && star.starred[0].k === "prayer", J(star.starred));
  let starBad = null;
  try { await put(api, "/api/prayer/starred", { starred: [{ k: "nope", id: "x", title: "x" }] }); } catch (e) { starBad = e; }
  check("W1 starred bad kind refused", !!starBad && starBad.status === 400 && starBad.data.error === "bad star kind", starBad && starBad.data.error);
  // mass seats + universal prayer
  const seats = await put(api, "/api/prayer/mass-personal-prayer", { seat: "premass", slugs: ["our-father"] });
  check("W1 mass seat write", eq(seats.preMass, ["our-father"]) && eq(seats.before, []), J(seats));
  await put(api, "/api/prayer/mass-universal-prayer", { date: "2026-11-21", intentions: [" For the parish "] });
  const up = await api("/api/prayer/mass-universal-prayer?date=2026-11-21");
  check("W1 universal prayer trims + reads", eq(up.intentions, ["For the parish"]), J(up));
  // config: block order + source settings
  const bo = await put(api, "/api/player/block-order", { order: ["Morning", "Night", "Morning"] });
  check("W1 block order dedupe", eq(bo.order, ["Morning", "Night"]), J(bo));
  const ss = await api("/api/player/source-settings");
  check("W1 source settings seed = 26 rows", ss.sources.length === 26 && ss.version === 1, J(ss.version));
  const ssPut = await put(api, "/api/player/source-settings", { sources: ss.sources.map((s) => ({ sourceKey: s.sourceKey, block: s.block, dayRule: s.dayRule, enabled: s.enabled })) });
  check("W1 source settings write bumps version only", ssPut.ok === true && ssPut.version === 2 && Object.keys(ssPut).length === 2, J(ssPut));
  // day additions
  const adds = await put(api, "/api/player/day-additions", { date: "2026-11-21", additions: [{ block: "Morning", slug: "our-father", lang: "en", afterId: null, kind: "prayer" }] });
  check("W1 day additions round-trip", adds.ok === true && adds.additions.length === 1 && adds.additions[0].afterId === null, J(adds));
  // exam + confession without a PIN: gate open (v373 prompt is the client's, state says pinSet false)
  const pinState = await api("/api/pin/state");
  check("W1 pin state unset", pinState.pinSet === false, J(pinState));
  const today = await api("/api/exam/today");
  check("W1 exam today shape", today.ok === true && today.run.state === "open" && today.prompts.length === 23 && Array.isArray(today.entries) && today.categories.length > 0, J({ prompts: today.prompts.length, cats: today.categories.length }));
  const ent = await post(api, "/api/exam/entries", { runId: today.run.id, promptId: today.prompts[0].id, text: "I was impatient", kind: "sin" });
  check("W1 exam entry add", ent.ok === true && ent.id === 1, J(ent));
  const today2 = await api("/api/exam/today");
  check("W1 exam entry stands with prompt category", today2.entries.length === 1 && today2.entries[0].category === today.prompts[0].category, J(today2.entries));
  const conf = await api("/api/confession");
  check("W1 confession prep carries the sin", conf.prep.length === 1 && conf.prep[0].entries.length === 1 && conf.lastConfession === null, J(conf.prep));
  const made = await post(api, "/api/confession/made", { date: "2026-11-21", note: "" });
  check("W1 confession made stamps entries", made.ok === true && made.entriesClosed === 1, J(made));
  const conf2 = await api("/api/confession");
  check("W1 confession history + elapsed", conf2.history.length === 1 && conf2.history[0].entryCount === 1 && conf2.elapsed === "You went to confession today", J(conf2.elapsed));
  // playback stays local
  await post(api, "/api/player/podcasts/mark", { series: "biay", seqKey: "day-1", source: "manual" });
  check("W1 playback mark stored locally", (w.store.get("opn-playback-local-v1") || "").includes("biay|day-1"));
  // the file itself
  const file = JSON.parse(w.store.get("opn-personal-data-v1"));
  check("W1 file is the v570 envelope", file.format === "orapronobis-personal-data" && file.formatVersion === 1 && !!file.sections.intentions && !!file.sections.conscience && !!file.sections.profiles && !!file.sections.config && !!file.sections.favorites);
  check("W1 file holds the data", file.sections.intentions.length === 2 && file.sections.conscience.entries.length === 1 && file.sections.favorites.book.length === 2);
  check("W1 NO personal call reached fetch", w.fetchLog.length === 0, J(w.fetchLog.map((f) => f.path)));
  check("W1 PIN material never in the file", !w.store.get("opn-personal-data-v1").includes("pinHash") && !w.store.has("opn-pin-local-v1"));
}

async function w2() {
  const w = makeWorld("public", true);
  const api = w.api;
  const set = await post(api, "/api/pin/set", { pin: "2468" });
  check("W2 pin set returns code + token", typeof set.recoveryCode === "string" && set.recoveryCode.length >= 12 && typeof set.token === "string", J(Object.keys(set)));
  check("W2 pin stands outside the file", w.store.has("opn-pin-local-v1") && !(w.store.get("opn-personal-data-v1") || "").includes("pinHash"));
  // the set call's token unlocks (the client stores it in pinToken)
  w.sandbox.pinToken = set.token;
  const t1 = await api("/api/exam/today");
  check("W2 unlocked exam flows", t1.ok === true);
  // lock again: token cleared → gate refuses
  w.sandbox.pinToken = null;
  let gate = null;
  try { await api("/api/exam/today"); } catch (e) { gate = e; }
  check("W2 gate refuses without token", !!gate && gate.status === 403 && gate.data.error === "pin_required", gate && J(gate.data));
  let wrong = null;
  try { await post(api, "/api/pin/verify", { pin: "9999" }); } catch (e) { wrong = e; }
  check("W2 wrong pin counts down", !!wrong && wrong.status === 401 && wrong.data.attemptsRemaining === 4, wrong && J(wrong.data));
  const ver = await post(api, "/api/pin/verify", { pin: "2468" });
  check("W2 verify issues a token", typeof ver.token === "string" && !!ver.expiresAt, J(Object.keys(ver)));
  const rec = await post(api, "/api/pin/recover", { code: set.recoveryCode, newPin: "1357" });
  check("W2 recovery rolls the pin", typeof rec.token === "string" && typeof rec.recoveryCode === "string");
  w.sandbox.pinToken = rec.token;
  const rm = await post(api, "/api/pin/remove", {});
  const st = await api("/api/pin/state");
  check("W2 remove clears the pin", rm.ok === true && st.pinSet === false, J(st));
  check("W2 NO call reached fetch", w.fetchLog.length === 0, J(w.fetchLog.map((f) => f.path)));
}

async function w3() {
  const w = makeWorld("public", true);
  const api = w.api;
  await post(api, "/api/prayer/intentions", { text: "Alpha intention", priority: "H" });
  const b = await post(api, "/api/prayer/intentions", { text: "Beta intention", priority: "M" });
  await post(api, "/api/prayer/intentions/" + b.id + "/status", { status: "retired" });
  const draws = await post(api, "/api/player/track-draws", { date: "2026-11-21", keys: ["ep1|Morning", "ep2|Morning"], via: "build" });
  check("W3 draws come only from the active local pool", draws.draws["ep1|Morning"].text === "Alpha intention" && draws.draws["ep2|Morning"].text === "Alpha intention", J(draws.draws));
  const again = await post(api, "/api/player/track-draws", { date: "2026-11-21", keys: ["ep1|Morning"], via: "play" });
  check("W3 first draw wins", again.draws["ep1|Morning"].text === "Alpha intention");
}

async function w4() {
  const w = makeWorld("public", false);
  const api = w.api;
  check("W4 mode is web", w.layer.opnMode() === "web");
  const list = await api("/api/prayer/intentions");
  check("W4 web read is empty-but-valid", list.ok === true && list.intentions.length === 0, J(list));
  const prof = await api("/api/prayer/profiles");
  check("W4 web profiles read valid", prof.ok === true && prof.profiles.length === 3, J(prof.profiles.length));
  let refused = null;
  try { await post(api, "/api/prayer/intentions", { text: "x", priority: "M" }); } catch (e) { refused = e; }
  check("W4 web write refused with the pointer", !!refused && refused.status === 403 && /lives in the app/.test(refused.data.error), refused && refused.data.error);
  check("W4 web stores NOTHING", !w.store.has("opn-personal-data-v1") && !w.store.has("opn-pin-local-v1"), J([...w.store.keys()]));
  check("W4 pointer card names the app", w.layer.opnPointerHtml().includes("on your phone"));
}

async function w5() {
  const w = makeWorld("private", true);
  const api = w.api;
  check("W5 mode is server", w.layer.opnMode() === "server");
  const res = await api("/api/prayer/intentions");
  check("W5 private shape uses fetch as before", res.viaFetch === true && w.fetchLog.length === 1, J(w.fetchLog.map((f) => f.path)));
}

/* ---------------- L served legs ---------------- */
function servedLegs() {
  return new Promise((resolve) => {
    const port = 20000 + (process.pid % 20000);
    const persist = "/tmp/wrangler-v568";
    execSync(`rm -rf ${persist} && mkdir -p ${persist}`, { timeout: 30000 });
    execSync(`../../node_modules/.bin/wrangler d1 migrations apply ora-pro-nobis-app --local --persist-to ${persist} -c ../wrangler.toml`, { cwd: "app/worker", stdio: "pipe", timeout: 120000 });
    const boot = (extraVars, usePort) => new Promise((res) => {
      const args = ["dev", "--local", `--persist-to`, persist, "--port", String(usePort || port), "-c", "../wrangler.toml", "--var", "LOCAL_DEV:1", ...extraVars];
      const proc = spawn("../../node_modules/.bin/wrangler", args, { cwd: "app/worker", detached: true });
      proc.killTree = () => { try { process.kill(-proc.pid, "SIGKILL"); } catch (e) { try { proc.kill("SIGKILL"); } catch (e2) {} } };
      let buf = "";
      const timer = setTimeout(() => { proc.killTree(); res(null); }, 45000);
      proc.stdout.on("data", (d) => { buf += d; if (buf.includes("Ready on")) { clearTimeout(timer); res(proc); } });
      proc.stderr.on("data", (d) => { buf += d; });
    });
    let activePort = port;
    const get = async (path) => {
      const r = await fetch(`http://127.0.0.1:${activePort}${path}`);
      return { status: r.status, text: await r.text() };
    };
    (async () => {
      let proc = await boot(["OPN_PUBLIC_SHAPE:1"]);
      if (!proc) { check("L0 wrangler dev boots", false); return resolve(); }
      try {
        const shell = await get("/");
        check("L1 public shell carries the public marker", shell.status === 200 && shell.text.includes('window.__OPN_SHAPE__="public"'), `status ${shell.status}`);
        const refusal = await get("/api/prayer/intentions");
        check("L2 public personal route refused", refusal.status === 403 && refusal.text.includes("personal data lives on your device"), `status ${refusal.status}: ${refusal.text.slice(0, 80)}`);
        const content = await get("/api/prayer/book");
        check("L3 public content route is NOT refused by the personal guard", content.status === 200 && content.text.includes('"groups"'), `status ${content.status}`);
      } finally { proc.killTree(); }
      await new Promise((r) => setTimeout(r, 1500));
      activePort = port + 1;
      proc = await boot([], activePort);
      if (!proc) { check("L4 wrangler dev reboots private", false); return resolve(); }
      try {
        const shell = await get("/");
        check("L4 private shell carries the private marker", shell.status === 200 && shell.text.includes('window.__OPN_SHAPE__="private"'), `status ${shell.status}`);
        const mine = await get("/api/prayer/intentions");
        check("L5 private personal route answers the server payload", mine.status === 200 && mine.text.includes('"intentions"'), `status ${mine.status}: ${mine.text.slice(0, 80)}`);
      } finally { proc.killTree(); }
      resolve();
    })().catch((e) => { check("L served legs completed", false, String(e).slice(0, 200)); resolve(); });
  });
}

await w1();
await w2();
await w3();
await w4();
await w5();
await servedLegs();
console.log(`\n${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
