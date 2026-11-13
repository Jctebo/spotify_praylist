// harness-v386.mjs — v386 WALLPAPER SORTER backend legs (§2.7 W10 + W11
// + the §2.2 P4 gap case at the backend shelf).
// Mold: harness-v390's wrangler helpers (local wrangler dev, LOCAL_DEV
// harness mode, the app's own AGENT_TOKEN as a test token). The
// wallpaper surface touches R2 only — no D1 migration exists in this
// release (§2.3 B1) and none is applied here.
// W1–W9 are the native legs: they belong to the Android build
// (APK 1.0.14, seated after v392's 1.0.13 lands) and stand
// named-not-run in §3 — they are NOT this harness's legs.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
if (!ROOT.includes(".worktrees")) { console.error("REFUSING: harness runs only inside a .worktrees tree"); process.exit(2); }
const APP = path.join(ROOT, "app");
const WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler";
const PORT = 8997;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSIST = path.join(APP, ".wrangler-test-v386");
const TOKEN = "v386-harness-token";
const JOHN = { "cf-access-authenticated-user-email": "john@thibeaux.com" };
const AGENT = { authorization: `Bearer ${TOKEN}` };

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log("ok - " + label); }
  else { fail++; console.log("NOT OK - " + label); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
// Deterministic fixture "JPEG" bytes (SOI + payload + EOI): the route
// stores bytes and verifies hashes; it never decodes the image.
function fixtureJpeg(tag, n = 2048) {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const body = Buffer.alloc(n, 0);
  Buffer.from(tag, "utf8").forEach((b, i) => { body[i % n] = b; });
  for (let i = 0; i < n; i++) body[i] = (body[i] + i * 7) & 0xff;
  return Buffer.concat([head, body, Buffer.from([0xff, 0xd9])]);
}

const procs = [];
function startApp() {
  const args = ["dev", "--config", path.join(APP, "wrangler.toml"), "--local", "--port", String(PORT), "--persist-to", PERSIST,
    "--var", "LOCAL_DEV:1", "--var", `AGENT_TOKEN:${TOKEN}`];
  const child = spawn(WRANGLER, args, { cwd: APP, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLOUDFLARE_API_TOKEN: "" } });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  procs.push(child);
  return child;
}
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + "/"); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
async function stock(name, variant, kind, bodyBuf, sha, headers = AGENT) {
  const q = new URLSearchParams({ name, variant, kind, sha256: sha }).toString();
  const r = await fetch(`${BASE}/api/agent/wallpaper/stock?${q}`, { method: "POST", headers, body: bodyBuf });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function getManifest(headers = JOHN) {
  const r = await fetch(BASE + "/api/wallpaper/manifest", { headers });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function getFile(variant, name, headers = JOHN) {
  const r = await fetch(`${BASE}/api/wallpaper/file/${variant}/${name}`, { headers });
  return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") };
}

try {
  fs.rmSync(PERSIST, { recursive: true, force: true });
  startApp();
  ok(await waitUp(), "app up on local wrangler (LOCAL_DEV harness mode)");

  // ============ W11 (first half) — empty shelf reads clean ============
  const empty = await getManifest();
  ok(empty.status === 200 && empty.body.version === 1 && Array.isArray(empty.body.entries) && empty.body.entries.length === 0,
    "W11: session manifest read on an empty shelf returns the empty accumulating manifest");

  // ============ W10 — stock route =====================================
  const saintPhone = fixtureJpeg("saint-phone-2026-11-12");
  const saintName = "josaphat__2026-11-12.jpg";
  const s1 = await stock(saintName, "phone", "saint", saintPhone, sha256(saintPhone));
  ok(s1.status === 200 && s1.body.ok === true && s1.body.unchanged === false,
    "W10: door POST of a fixture JPEG stores it (200, changed)");
  ok(s1.body.entry && s1.body.entry.slug === "josaphat" && s1.body.entry.date === "2026-11-12"
    && s1.body.entry.variant === "phone" && s1.body.entry.kind === "saint"
    && s1.body.entry.sha256 === sha256(saintPhone) && s1.body.entry.bytes === saintPhone.length,
    "W10: the stored entry carries the §2.2 P2 shape (name, slug, date, variant, kind, sha256, bytes)");

  const badSha = await stock("martin-of-tours__2026-11-11.jpg", "phone", "saint", fixtureJpeg("bad"), "0".repeat(64));
  ok(badSha.status === 400, "W10: a sha256 field that does not match the body is refused (400)");
  const badFile = await getFile("phone", "martin-of-tours__2026-11-11.jpg");
  ok(badFile.status === 404, "W10: the refused POST stored nothing (file read 404s)");
  const afterBad = await getManifest();
  ok(!afterBad.body.entries.some((e) => e.name === "martin-of-tours__2026-11-11.jpg"),
    "W10: the refused POST left no manifest entry");

  const s2 = await stock(saintName, "phone", "saint", saintPhone, sha256(saintPhone));
  ok(s2.status === 200 && s2.body.unchanged === true, "W10: a repeat POST of the same (name, variant, sha256) changes nothing");
  const afterRepeat = await getManifest();
  ok(afterRepeat.body.entries.filter((e) => e.name === saintName && e.variant === "phone").length === 1,
    "W10: the manifest still holds exactly one entry for the repeated stock");

  const saintPhoneV2 = fixtureJpeg("saint-phone-2026-11-12-corrected");
  const s3 = await stock(saintName, "phone", "saint", saintPhoneV2, sha256(saintPhoneV2));
  ok(s3.status === 200 && s3.body.unchanged === false && s3.body.entry.sha256 === sha256(saintPhoneV2),
    "W10: a changed hash on a standing (name, variant) replaces its entry (re-delivery)");
  const replaced = await getFile("phone", saintName);
  ok(replaced.status === 200 && replaced.buf.equals(saintPhoneV2),
    "W10: the replaced entry serves the new bytes");

  const badKind = await stock("holy-souls-in-purgatory__2026-11.jpg", "phone", "saint", fixtureJpeg("x"), sha256(fixtureJpeg("x")));
  ok(badKind.status === 400, "W10: a monthly-stamped name filed as kind=saint is refused (naming contract)");
  const badVariant = await stock(saintName, "tablet", "saint", saintPhone, sha256(saintPhone));
  ok(badVariant.status === 400, "W10: an unknown variant is refused");
  const noDoor = await stock(saintName, "watch", "saint", saintPhone, sha256(saintPhone), {});
  ok(noDoor.status === 403, "W10: the stock route refuses a request without the door token (403)");

  // ============ W11 — read surface ====================================
  const m1 = await getManifest();
  ok(m1.status === 200 && m1.body.entries.length === 1 && m1.body.entries[0].name === saintName,
    "W11: session manifest read returns the accumulated manifest");
  const f1 = await getFile("phone", saintName);
  ok(f1.status === 200 && f1.buf.equals(saintPhoneV2) && (f1.type || "").includes("image/jpeg"),
    "W11: session file read returns the exact filed bytes as image/jpeg");
  const unknown = await getFile("phone", "nobody__2026-01-01.jpg");
  ok(unknown.status === 404, "W11: an unknown name 404s");
  const badVar = await getFile("tablet", saintName);
  ok(badVar.status === 404, "W11: an unknown variant 404s");
  const doorRead = await getManifest({ authorization: `Bearer ${TOKEN}`, "cf-access-authenticated-user-email": "mallory@example.com" });
  ok(doorRead.status === 403, "W11: the read surface is session-only — a door token with a non-John identity is refused (403)");

  // ============ Gap case (P4/W8 at the backend shelf) =================
  const pbPhone = fixtureJpeg("precious-blood-phone-2027-07");
  const g1 = await stock("precious-blood-of-jesus__2027-07.jpg", "phone", "monthly", pbPhone, sha256(pbPhone));
  ok(g1.status === 200 && g1.body.entry.kind === "monthly" && g1.body.entry.date === "2027-07",
    "GAP: the phone monthly entry for 2027-07 Precious Blood stocks clean");
  const mGap = await getManifest();
  ok(mGap.body.entries.some((e) => e.name === "precious-blood-of-jesus__2027-07.jpg" && e.variant === "phone")
    && !mGap.body.entries.some((e) => e.name === "precious-blood-of-jesus__2027-07.jpg" && e.variant === "watch"),
    "GAP: the manifest carries the phone monthly entry and NO watch twin (the Jul 2027 watch gap stands, no placeholder)");
  const watchGap = await getFile("watch", "precious-blood-of-jesus__2027-07.jpg");
  ok(watchGap.status === 404, "GAP: the watch read for the gap month 404s — absence, not an error state");

  console.log(`\nharness-v386: ${pass}/${pass + fail} legs ok`);
  process.exitCode = fail ? 1 : 0;
} finally {
  for (const p of procs) { try { p.kill("SIGTERM"); } catch { /* already down */ } }
}
