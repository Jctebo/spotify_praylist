// Ora Pro Nobis — the prayer app (v305).
// A package in the Ora Pro Nobis monorepo (app/ beside jobs/ and
// runner/), with its OWN Worker, D1, and R2. It holds John's prayer
// intentions (moved out of GoalPost), the day's prayer player, the
// nightly examination of conscience, and confession preparation.
// Access: Cloudflare Access in front allows John's identities ONLY;
// the Worker repeats the check server-side on every route (the
// DevOps Board johnOnly pattern). There is no Pam allowlist entry,
// no Pam actor, no actor concept at all. The only machine path is
// this app's own AGENT_TOKEN door, scoped to the prayer contract
// the midnight job needs (day payload + addendum/draw + the audio
// intentions push). Examination entry text is never read by the
// agent door and never leaves this app's surfaces.
export interface Env {
  DB: D1Database;
  AUDIO: R2Bucket;
  AGENT_TOKEN?: string;
  // Set to "1" only by the local test harness (wrangler dev, no
  // Access in front). Production leaves it unset: user routes then
  // REQUIRE an Access-authenticated email header, and the draw uses
  // the runtime random source. Under LOCAL_DEV the draw is
  // deterministic per (date, item) so the gate can assert the
  // weighted distribution exactly (the DevOps LOCAL_DEV precedent).
  LOCAL_DEV?: string;
  // v427 harness seam ONLY (F-427-I2): overrides the own-feed URL
  // the per-episode novena enumeration fetches, so the gate can
  // serve fixture feeds locally. Read ONLY when LOCAL_DEV is "1";
  // production leaves it unset and the enumeration uses the
  // pinned OWN_FEED_URL constant below.
  OWN_FEED_URL?: string;
  // v334 harness seam ONLY: overrides the Divine Office feed URL the
  // courier fetches, so the gate can replay fixture feeds through
  // the real route. Production leaves it unset and the courier uses
  // the pinned resolver URL (EXT_DO_FEED_URL below).
  EXT_DO_FEED_URL?: string;
  EXT_BIAY_FEED_URL?: string;
  EXT_STH_FEED_URL?: string;
  // v337 harness seams, same rule: fixture-feed overrides for the
  // two new parity slots' pass-through matchers. Production leaves
  // them unset; the pinned feed URLs below govern.
  EXT_DGE_FEED_URL?: string;
  EXT_SAINT_FEED_URL?: string;
  // v339 harness seams, same rule: fixture-feed overrides for the
  // Mass and Homilies block's four sources. Production leaves them
  // unset; the pinned feed URLs below govern.
  EXT_USCCB_FEED_URL?: string;
  EXT_TVMASS_FEED_URL?: string;
  EXT_FRMIKE_FEED_URL?: string;
  EXT_BARRON_FEED_URL?: string;
  // v381 harness seam, same rule: a fixture-feed override for the
  // Podcasts section's Catechism in a Year sequence build.
  // Production leaves it unset; the pinned feed URL below governs.
  EXT_CIY_FEED_URL?: string;
  // v390 harness seam, same rule: a fixture-feed override for the
  // Podcasts section's Rosary in a Year sequence build (the Bible
  // series rides the standing EXT_BIAY_FEED_URL seam above — one
  // seam per feed). Production leaves it unset; the pinned feed
  // URL below governs.
  EXT_RIY_FEED_URL?: string;
  // v434 harness seam, same rule: a fixture-feed override for the
  // Podcasts section's CatholicTV video series build (the YouTube
  // channel feed). Production leaves it unset; the pinned feed
  // URL below governs.
  EXT_YT_CATHOLICTV_FEED_URL?: string;
}

import { SHELL_HTML, APP_CSS, MANIFEST_JSON, SW_JS } from "./ui";
import { APP_JS } from "./client";
import { LOGO_PNG_B64 } from "./logo";
import { LOGO512_PNG_B64 } from "./logo512";

const JOHN_EMAILS = new Set(["john@thibeaux.com", "john.thibeaux@gmail.com"]);
// v335: the Devotional Suite audio fallback constant is deleted — a
// segment the app does not hold reads as missing, never as a Suite
// URL wearing the app's name (§1 part 3, §2.5).

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function err(status: number, message: string): Response { return json({ error: message }, status); }
function nowISO(): string { return new Date().toISOString(); }

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function isAgent(request: Request, env: Env): boolean {
  const auth = request.headers.get("authorization") || "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return !!env.AGENT_TOKEN && !!presented && timingSafeEqual(presented, env.AGENT_TOKEN);
}
// User routes: John only. Behind Cloudflare Access the email header
// is authoritative; any other email is refused. Without Access
// headers the route is closed unless LOCAL_DEV is set by the harness.
function johnOnly(request: Request, env: Env): Response | null {
  const email = request.headers.get("cf-access-authenticated-user-email");
  if (email) return JOHN_EMAILS.has(email.toLowerCase()) ? null : json({ error: "forbidden" }, 403);
  if (env.LOCAL_DEV === "1") return null;
  return json({ error: "access sign-in required" }, 403);
}


// ---- Confession PIN (v356, Plan §2.1–§2.3) ---------------------------
// One singleton pin_state row holds the PIN + recovery-code PBKDF2
// hashes and the ONE shared attempt counter; pin_tokens holds live
// verification tokens by SHA-256 hash (revocation = DELETE). No
// pin_state row = no PIN set = the gated families stand open,
// exactly as before this release (decision 6).
const PIN_ITERATIONS = 100000;
const PIN_TOKEN_TTL_MS = 30 * 60 * 1000;
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I, L, O, U)

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}
async function pbkdf2Hex(value: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex) as BufferSource, iterations, hash: "SHA-256" }, key, 256,
  );
  return bytesToHex(new Uint8Array(bits));
}
function randomHex(byteCount: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteCount)));
}
function generateRecoveryCode(): string {
  // Rejection sampling: 256 is an exact multiple of the 32-char
  // alphabet, so no byte is ever rejected and no modulo bias exists;
  // the guard stands so the sampling stays honest if the alphabet
  // ever changes size.
  const limit = 256 - (256 % RECOVERY_ALPHABET.length);
  let chars = "";
  while (chars.length < 12) {
    const b = crypto.getRandomValues(new Uint8Array(1))[0];
    if (b >= limit) continue;
    chars += RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length];
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
function normalizeRecoveryCode(code: string): string {
  return code.replace(/[-\s]/g, "").toUpperCase();
}

interface PinStateRow {
  id: number; pin_hash: string; pin_salt: string; pin_iterations: number;
  recovery_hash: string; recovery_salt: string; recovery_iterations: number;
  failed_attempts: number; next_allowed_at: string | null;
  created_at: string; updated_at: string;
}
async function loadPinState(env: Env): Promise<PinStateRow | null> {
  return env.DB.prepare("SELECT * FROM pin_state WHERE id=1").first<PinStateRow>();
}
function pinRetryAfterSeconds(state: PinStateRow): number {
  if (!state.next_allowed_at) return 0;
  const ms = new Date(state.next_allowed_at).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}
async function registerPinFailure(env: Env, state: PinStateRow): Promise<{ attemptsRemaining: number; retryAfterSeconds: number }> {
  const failures = state.failed_attempts + 1;
  let waitSeconds = 0;
  let nextAllowed: string | null = null;
  if (failures >= 5) {
    waitSeconds = Math.min(30 * 2 ** (failures - 5), 300);
    nextAllowed = new Date(Date.now() + waitSeconds * 1000).toISOString();
  }
  await env.DB.prepare("UPDATE pin_state SET failed_attempts=?, next_allowed_at=?, updated_at=? WHERE id=1")
    .bind(failures, nextAllowed, nowISO()).run();
  return { attemptsRemaining: Math.max(0, 5 - failures), retryAfterSeconds: waitSeconds };
}
async function resetPinAttempts(env: Env): Promise<void> {
  await env.DB.prepare("UPDATE pin_state SET failed_attempts=0, next_allowed_at=NULL, updated_at=? WHERE id=1").bind(nowISO()).run();
}
async function issuePinToken(env: Env): Promise<{ token: string; expiresAt: string }> {
  const token = randomHex(32);
  const issuedAt = nowISO();
  const expiresAt = new Date(Date.now() + PIN_TOKEN_TTL_MS).toISOString();
  await env.DB.prepare("INSERT INTO pin_tokens (token_hash, issued_at, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(token), issuedAt, expiresAt).run();
  return { token, expiresAt };
}
async function pinTokenValid(request: Request, env: Env): Promise<boolean> {
  const presented = request.headers.get("x-pin-token");
  if (!presented) return false;
  const hash = await sha256Hex(presented);
  const row = await env.DB.prepare("SELECT token_hash, expires_at FROM pin_tokens WHERE token_hash=?").bind(hash)
    .first<{ token_hash: string; expires_at: string }>();
  if (!row) return false;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM pin_tokens WHERE token_hash=?").bind(hash).run();
    return false;
  }
  return true;
}
// The withheld-content gate (§2.3): stands in front of BOTH gated
// families, reads and writes alike, before any handler runs.
async function pinGate(request: Request, env: Env): Promise<Response | null> {
  const state = await loadPinState(env);
  if (!state) return null;
  if (await pinTokenValid(request, env)) return null;
  return err(403, "pin_required");
}
async function hashCredential(value: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = randomHex(16);
  const hash = await pbkdf2Hex(value, salt, PIN_ITERATIONS);
  return { hash, salt, iterations: PIN_ITERATIONS };
}

let logoBytes: Uint8Array | null = null;
function logo(): Uint8Array {
  if (!logoBytes) {
    const bin = atob(LOGO_PNG_B64);
    logoBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) logoBytes[i] = bin.charCodeAt(i);
  }
  return logoBytes;
}

let logo512Bytes: Uint8Array | null = null;
function logo512(): Uint8Array {
  if (!logo512Bytes) {
    const bin = atob(LOGO512_PNG_B64);
    logo512Bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) logo512Bytes[i] = bin.charCodeAt(i);
  }
  return logo512Bytes;
}

// ---- Prayer module (ported behavior-identical from the board) --------
// Data model + draw rule are the board migration 0015 port: 35 items
// in six blocks, one weighted intention draw per enabled item per
// date (High=4, Medium=2, Low=1, persisted, fill-missing only),
// per-day completions (data only in this app — no behavior is built
// on them), and the day addendum.
const PRAYER_BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night", "Mass and Homilies", "Novenas", "The AI Signal"] as const;
const PRAYER_BLOCK_START: Record<string, number> = {
  // v339: "Mass and Homilies" carries no hour of its own — it is
  // the day's closing listening block, not a time-of-day office.
  // 24 keeps it out of the current-block derivation entirely (the
  // ?? 0 fallback would have made it "current" at every hour, as
  // the last block in iteration order).
  // v349: "Novenas" stands LAST in the list (John's decision) but
  // its prayer window is Midmorning's — start 9 makes the block
  // DUE from 9 AM (a 24 would read it not-due all day, a regression
  // against its life inside Midmorning). The current-block
  // derivation below is start-based, not order-based, so a
  // last-position block with start 9 can never hijack "current".
  Morning: 0, Midmorning: 9, Midday: 12, Afternoon: 15, Evening: 18, Night: 21, "Mass and Homilies": 24, Novenas: 9,
  // v368 §2.2: "The AI Signal" takes the Mass and Homilies value —
  // 24 keeps it out of the current-block derivation entirely and
  // prayerBlockDue reads false at every hour of the presented day.
  // The entry is REQUIRED: the ?? 0 fallback would make an
  // unlisted block "current" at every hour.
  "The AI Signal": 24,
};
const PRAYLIST_URL: Record<string, string> = {
  Morning: "https://open.spotify.com/playlist/0sy9eBsySKuCppI0PxXRJN",
  Midmorning: "https://open.spotify.com/playlist/3EYFgLhMGEfILn6bRJgHJm",
  Midday: "https://open.spotify.com/playlist/4gQAaPAMiezBaDaoqK6sFQ",
  Afternoon: "https://open.spotify.com/playlist/7cyrM9f9LXEfmoqwZvUaXW",
  Evening: "https://open.spotify.com/playlist/6HNvFLWRShih7lgtwHTqXU",
  Night: "https://open.spotify.com/playlist/1TAlNiKHMc41cT0fvkYxTD",
  // v349: the Novenas Praylist (created 2026-11-10; Mass and
  // Homilies carries no Praylist and stands absent here, as before).
  Novenas: "https://open.spotify.com/playlist/2hclGC0JlP4tC51uohete6",
};
const BLOCK_CAPTION: Record<string, string> = {
  Morning: "from midnight", Midmorning: "from 9 AM", Midday: "from 12 PM",
  Afternoon: "from 3 PM", Evening: "from 6 PM", Night: "from 9 PM",
  // v339: the block is the day's close, not an hour office.
  "Mass and Homilies": "the day's Mass and the week's homilies",
  // v349: the content-caption form (the v339 precedent) — NOT an
  // hour caption: Novenas never becomes the derived current block,
  // so its caption must not promise an hour behavior.
  Novenas: "the day's novenas",
  // v368 §2.2: the content-caption form again — the block is the
  // day's episode, not an hour office.
  "The AI Signal": "the day's episode",
};

interface PrayerItemRow {
  id: number; block: string; name: string; sub: string; kind: string; color: string;
  opening_prayer: string; closing_prayer: string; enabled: number; sort: number;
}
interface PrayerIntentionRow { id: number; text: string; priority: string; status: string; created_at: string; }

function prayerChicagoNow(): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: parseInt(p.hour, 10) % 24 };
}
function chicagoDateOf(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}
// v392 W1: shift a YYYY-MM-DD day by whole days (UTC noon anchor,
// DST-free) — the dated day route's today/tomorrow arithmetic.
function chicagoShiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  const yy = dt.getUTCFullYear(), mm = String(dt.getUTCMonth() + 1).padStart(2, "0"), dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function prayerDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).format(dt);
}
function prayerBlockDue(date: string, block: string, today: string, hour: number): boolean {
  if (date < today) return true;
  if (date > today) return false;
  return hour >= (PRAYER_BLOCK_START[block] ?? 0);
}
async function prayerGetItems(env: Env): Promise<PrayerItemRow[]> {
  const r = await env.DB.prepare(
    "SELECT * FROM prayer_items ORDER BY CASE block WHEN 'Morning' THEN 0 WHEN 'Midmorning' THEN 1 WHEN 'Midday' THEN 2 WHEN 'Afternoon' THEN 3 WHEN 'Evening' THEN 4 WHEN 'Night' THEN 5 WHEN 'Mass and Homilies' THEN 6 WHEN 'Novenas' THEN 7 WHEN 'The AI Signal' THEN 8 ELSE 6 END, sort, id",
  ).all<PrayerItemRow>();
  return r.results ?? [];
}
async function prayerGetActiveIntentions(env: Env): Promise<PrayerIntentionRow[]> {
  const r = await env.DB.prepare(
    "SELECT * FROM prayer_intentions WHERE status='active' ORDER BY CASE priority WHEN 'H' THEN 0 WHEN 'M' THEN 1 ELSE 2 END, id",
  ).all<PrayerIntentionRow>();
  return r.results ?? [];
}
// Draw randomness: Math.random in production (the board's behavior).
// Under LOCAL_DEV (harness only) a deterministic LCG per (date,item)
// makes the weighted distribution exactly assertable at the gate.
// v427 F-427-I3: the FNV-style hash stands factored as drawHash so
// the per-item seed strings (`${date}:${itemId}`) and the
// per-episode seed strings (`${date}:${episodeId}`) share the ONE
// hash — the per-item seed strings are byte-identical to the
// pre-refactor shape, so no per-item pick moves (harness-v427
// proves it against the replicated pre-refactor algorithm).
function drawHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function drawRandom(env: Env, date: string, itemId: number): number {
  if (env.LOCAL_DEV !== "1") return Math.random();
  return drawHash(`${date}:${itemId}`);
}
function episodeDrawRandom(env: Env, date: string, episodeId: string): number {
  if (env.LOCAL_DEV !== "1") return Math.random();
  return drawHash(`${date}:${episodeId}`);
}
// Weighted draw: one active intention per enabled item. Weights H=4, M=2, L=1.
async function prayerDrawForDate(env: Env, date: string): Promise<Map<number, number>> {
  const existing = await env.DB.prepare("SELECT item_id, intention_id FROM prayer_draws WHERE date=?").bind(date).all<{ item_id: number; intention_id: number }>();
  const map = new Map<number, number>();
  for (const row of existing.results ?? []) map.set(row.item_id, row.intention_id);
  const items = (await prayerGetItems(env)).filter((i) => i.enabled);
  const missing = items.filter((i) => !map.has(i.id));
  if (!missing.length) return map;
  const intentions = await prayerGetActiveIntentions(env);
  if (!intentions.length) return map;
  const weights = intentions.map((i) => (i.priority === "H" ? 4 : i.priority === "M" ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const stmts: D1PreparedStatement[] = [];
  for (const item of missing) {
    let x = drawRandom(env, date, item.id) * total;
    let pick = intentions[intentions.length - 1];
    for (let k = 0; k < intentions.length; k++) { x -= weights[k]; if (x <= 0) { pick = intentions[k]; break; } }
    map.set(item.id, pick.id);
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO prayer_draws (date, item_id, intention_id) VALUES (?, ?, ?)").bind(date, item.id, pick.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return map;
}
// v427 §2.3: the own feed — the enumeration source for the
// presented day's novena episode ids. The Worker reads the SAME
// feed the client resolves the presented day's own tracks from
// (client.ts OWN_FEED_URL), so the enumerated set equals the
// presented set by construction. ONE named constant; the harness
// overrides it under LOCAL_DEV only (F-427-I2, the Env seam).
const OWN_FEED_URL = "https://orapronobis.media/podcast.xml";
function ownFeedUrl(env: Env): string {
  return env.LOCAL_DEV === "1" && env.OWN_FEED_URL ? env.OWN_FEED_URL : OWN_FEED_URL;
}
// The stem rule, mirrored exactly from client.ts ownStemOf +
// ownFamilyOfStem's novena branch (jobs/compose_app_audio.py:619
// carries the same canon): basename → strip a trailing .mp3 →
// the stem must START with the presented date → rest after
// `<date>-` → the LAST `-day-` in rest at index > 0 →
// episodeId = `novena-` + rest up to that index.
function ownStemOfUrl(url: string): string {
  const clean = String(url || "").split("?")[0].split("#")[0];
  const base = clean.slice(clean.lastIndexOf("/") + 1);
  return base.slice(-4) === ".mp3" ? base.slice(0, -4) : base;
}
function novenaEpisodeIdOfStem(stem: string, date: string): string | null {
  if (!stem.startsWith(date + "-")) return null;
  const rest = stem.slice(date.length + 1);
  const dayAt = rest.lastIndexOf("-day-");
  if (dayAt <= 0) return null;
  return "novena-" + rest.slice(0, dayAt);
}
// An enclosure-url scan of the feed (its standing shape — no XML
// parser joins the bundle). Fetch error, non-200, or a parse that
// finds nothing → the empty set: the fill is skipped, standing
// rows still emit, and the shell never errors (§2.3 failure mode).
async function enumerateNovenaEpisodes(env: Env, date: string): Promise<string[]> {
  try {
    const res = await fetch(ownFeedUrl(env));
    if (!res.ok) return [];
    const xml = await res.text();
    const ids = new Set<string>();
    const tagRe = /<enclosure\b[^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(xml))) {
      const um = /\burl="([^"]+)"/.exec(m[0]);
      if (!um) continue;
      const id = novenaEpisodeIdOfStem(ownStemOfUrl(um[1]), date);
      if (id) ids.add(id);
    }
    return [...ids];
  } catch { return []; }
}
// v427 §2.2: the per-episode sibling of prayerDrawForDate, under
// its exact disciplines — a standing (date, episode) draw is
// never re-picked by a read; missing episodes fill from the
// standing pool (prayerGetActiveIntentions, H=4 · M=2 · L=1) in
// ONE batch (all-or-nothing: a failed batch writes nothing and
// the next read retries). Enumeration runs ONLY when the date
// has no standing episode rows, or when the redraw forces it
// (§2.3's gate — the feed is 2.1 MB; a per-read fetch is
// rejected on cost).
async function prayerEpisodeDrawForDate(env: Env, date: string, forceEnumerate = false): Promise<Map<string, number>> {
  const existing = await env.DB.prepare("SELECT episode_id, intention_id FROM prayer_episode_draws WHERE date=?").bind(date).all<{ episode_id: string; intention_id: number }>();
  const map = new Map<string, number>();
  for (const row of existing.results ?? []) map.set(row.episode_id, row.intention_id);
  if (!forceEnumerate && map.size > 0) return map;
  const ids = await enumerateNovenaEpisodes(env, date);
  const missing = ids.filter((id) => !map.has(id));
  if (!missing.length) return map;
  const intentions = await prayerGetActiveIntentions(env);
  if (!intentions.length) return map;
  const weights = intentions.map((i) => (i.priority === "H" ? 4 : i.priority === "M" ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const stmts: D1PreparedStatement[] = [];
  for (const episodeId of missing) {
    let x = episodeDrawRandom(env, date, episodeId) * total;
    let pick = intentions[intentions.length - 1];
    for (let k = 0; k < intentions.length; k++) { x -= weights[k]; if (x <= 0) { pick = intentions[k]; break; } }
    map.set(episodeId, pick.id);
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO prayer_episode_draws (date, episode_id, intention_id) VALUES (?, ?, ?)").bind(date, episodeId, pick.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return map;
}
// v426 §2.3: THE whole-day re-draw entry point (§2.9's contract —
// v427's per-episode re-draw joins INSIDE this function, under the
// same snapshot/restore discipline; no second endpoint, no second
// draw algorithm). Snapshot today's rows, delete today's rows only,
// re-run the SAME fill. If the fill throws, the snapshot is restored
// by one batch INSERT OR IGNORE and the error propagates — a failed
// re-run leaves the standing draw untouched, row for row. Past and
// future days, played/heard state, and the pool are never written.
async function prayerRedrawForDate(env: Env, date: string): Promise<Map<number, number>> {
  const snap = await env.DB.prepare("SELECT item_id, intention_id FROM prayer_draws WHERE date=?").bind(date).all<{ item_id: number; intention_id: number }>();
  const rows = snap.results ?? [];
  // v427 §2.5: the snapshot extends to today's episode rows,
  // beside the per-item snapshot, before any delete. The episode
  // store's absence (a pre-0022 rollback posture) degrades the
  // join to the standing v426 shape — never an error.
  let epRows: { episode_id: string; intention_id: number }[] = [];
  let epStore = true;
  try {
    const epSnap = await env.DB.prepare("SELECT episode_id, intention_id FROM prayer_episode_draws WHERE date=?").bind(date).all<{ episode_id: string; intention_id: number }>();
    epRows = epSnap.results ?? [];
  } catch { epStore = false; }
  try {
    await env.DB.prepare("DELETE FROM prayer_draws WHERE date=?").bind(date).run();
    if (epStore) await env.DB.prepare("DELETE FROM prayer_episode_draws WHERE date=?").bind(date).run();
    const map = await prayerDrawForDate(env, date);
    // v427 §2.5: the per-episode re-draw runs inside this same
    // try, with FORCED enumeration over the post-mutation pool —
    // one endpoint, one algorithm; the retire/delete handlers
    // need no episode-side deletion of their own.
    if (epStore) await prayerEpisodeDrawForDate(env, date, true);
    return map;
  } catch (e) {
    if (rows.length) {
      await env.DB.batch(rows.map((r) => env.DB.prepare("INSERT OR IGNORE INTO prayer_draws (date, item_id, intention_id) VALUES (?, ?, ?)").bind(date, r.item_id, r.intention_id)));
    }
    if (epRows.length) {
      await env.DB.batch(epRows.map((r) => env.DB.prepare("INSERT OR IGNORE INTO prayer_episode_draws (date, episode_id, intention_id) VALUES (?, ?, ?)").bind(date, r.episode_id, r.intention_id)));
    }
    throw e;
  }
}
// v426 §2.4: a mutation's settle redraw — the mutation stands even
// when its redraw fails; the handler reports the outcome as
// redrawn: true | false and the client paints the pool either way.
async function prayerTryRedraw(env: Env, date: string): Promise<boolean> {
  try { await prayerRedrawForDate(env, date); return true; } catch { return false; }
}
// v335 §2.3: the splice reads the STANDING segment rows (sentinel
// date 'current') for every payload — one standing segment per block
// under the same name always, replaced in place on refresh. Dated
// rows are no longer consumed by any payload.
async function prayerAudioMap(env: Env): Promise<Map<string, { size: number }>> {
  const r = await env.DB.prepare("SELECT block, size_bytes FROM prayer_audio WHERE date='current'").all<{ block: string; size_bytes: number }>();
  return new Map((r.results ?? []).map((row) => [row.block, { size: row.size_bytes }]));
}
// v352 §2.4: the liturgical day record for one date — the
// OFFICIAL day's name + color as the devotional job pushed it
// (§2.1's pin: the app displays verbatim and derives nothing).
// No row stands = no push happened for that date = null, and the
// client falls back to the plain date label.
async function liturgicalDayFor(env: Env, date: string) {
  const row = await env.DB.prepare(
    "SELECT day_name, color FROM prayer_liturgical_days WHERE date=?",
  ).bind(date).first<{ day_name: string; color: string }>();
  return row ? { name: row.day_name, color: row.color } : null;
}

// The day payload: field-identical in shape to the board module's
// (the midnight job repoints by door target only), plus this app's
// own audio record per block (v335's standing segment fact).
// v338 §2.9(3): the per-block segment audio bar retires —
// segmentAudioUrl and the payload's audioMissing list are REMOVED;
// the Intentions tab's item/intention listing is untouched.
async function prayerDayPayload(env: Env, date: string) {
  const { date: today, hour } = prayerChicagoNow();
  const items = await prayerGetItems(env);
  const draw = await prayerDrawForDate(env, date);
  const intentions = await env.DB.prepare("SELECT * FROM prayer_intentions").all<PrayerIntentionRow>();
  const byId = new Map((intentions.results ?? []).map((i) => [i.id, i]));
  const done = await env.DB.prepare("SELECT item_id FROM prayer_completions WHERE date=?").bind(date).all<{ item_id: number }>();
  const doneSet = new Set((done.results ?? []).map((r) => r.item_id));
  const addRow = await env.DB.prepare("SELECT text FROM prayer_addenda WHERE date=?").bind(date).first<{ text: string }>();
  const labelRows = await env.DB.prepare("SELECT block, label FROM prayer_block_labels").all<{ block: string; label: string }>();
  const labels = new Map((labelRows.results ?? []).map((r) => [r.block, r.label]));
  const audio = await prayerAudioMap(env);

  const blocks = PRAYER_BLOCKS.map((block) => {
    const blockItems = items.filter((i) => i.block === block && i.enabled);
    const hasAudio = audio.has(block);
    return {
      block,
      label: labels.get(block) ?? block,
      due: prayerBlockDue(date, block, today, hour),
      praylistUrl: PRAYLIST_URL[block],
      audio: { available: hasAudio, url: hasAudio ? `/api/prayer/audio/current/${encodeURIComponent(block)}` : null, sizeBytes: hasAudio ? audio.get(block)!.size : null },
      devotions: blockItems.map((i) => ({
        id: i.id, name: i.name, sub: i.sub, kind: i.kind, color: i.color,
        openingPrayer: i.opening_prayer, closingPrayer: i.closing_prayer,
        done: doneSet.has(i.id),
        intentions: draw.has(i.id) && byId.has(draw.get(i.id)!)
          ? [{ id: byId.get(draw.get(i.id)!)!.id, text: byId.get(draw.get(i.id)!)!.text, priority: byId.get(draw.get(i.id)!)!.priority }]
          : [],
      })),
    };
  });
  const enabled = items.filter((i) => i.enabled);
  return {
    ok: true,
    date,
    dateLabel: prayerDateLabel(date),
    addendum: addRow?.text ?? "",
    liturgicalDay: await liturgicalDayFor(env, date),
    blocks,
    devotionCount: enabled.length,
    prayerCount: enabled.filter((i) => i.kind === "prayer").length,
    activityCount: enabled.filter((i) => i.kind === "activity").length,
    doneCount: enabled.filter((i) => doneSet.has(i.id)).length,
    dueCount: enabled.filter((i) => prayerBlockDue(date, i.block, today, hour)).length,
    currentBlock: date === today
      ? // v349 §2.2.2: order-independent derivation — the current
        // block is the one with the GREATEST start <= hour; ties
        // break by EARLIEST list position (strict > keeps the
        // first). On the standing blocks this returns exactly what
        // the old list-order reduce returned at every hour; with
        // Novenas last at start 9, Midmorning wins the 09:00 tie
        // on position and Novenas is never the current block.
        PRAYER_BLOCKS.reduce((cur, b) => {
          const s = PRAYER_BLOCK_START[b] ?? 0;
          const cs = PRAYER_BLOCK_START[cur] ?? 0;
          return hour >= s && s > cs ? b : cur;
        }, "Morning" as string)
      : "Morning",
    isToday: date === today,
  };
}

// ---- Player -------------------------------------------------------------
// v312: the player reads ONLY the app's own store — player_day (the
// stored-day singleton), player_episodes, prayer_audio, and the
// player_sources playlist rows (presentation "Open in Spotify" data).
// The RSS read path (fetch, regex parse, prefix matching, cache) is
// deleted, not bypassed: what the nightly run published is what the
// player shows, and a day the run did not publish reads as a named
// missing day.
// v324 §2.2: the external slots, fixed — slot id -> the seed's
// block. Slot-neutral ids (the fallback can change who fills a
// slot). v328 §2.2: this table is demoted to the slot-id REGISTRY —
// an external episode_id must still be one of the registered slots —
// while the block is validated as data (one of PRAYER_BLOCKS or
// 'unblocked') and taken from the posted entry, because under the
// source-mapping settings an external's block is John's
// configuration, not a pin. v337 §2.8: the registry gains the two
// daily parity ports (Gospel Exegesis, Saint of the Day).
const EXTERNAL_SLOTS: Record<string, string> = {
  "ext-invitatory": "Morning",
  "ext-morning-prayer": "Morning",
  "ext-bible-in-a-year": "Morning",
  "ext-gospel-exegesis": "Midmorning",
  "ext-midmorning-prayer": "Midmorning",
  "ext-midday-prayer": "Midday",
  "ext-saint-of-the-day": "Afternoon",
  "ext-midafternoon-prayer": "Afternoon",
  "ext-office-of-readings": "Evening",
  "ext-evening-prayer": "Evening",
  "ext-night-prayer": "Night",
  // v339 §2.1: the Mass and Homilies block's four slots.
  "ext-usccb-readings": "Mass and Homilies",
  "ext-daily-tv-mass": "Mass and Homilies",
  "ext-fr-mike-homily": "Mass and Homilies",
  "ext-barron-sermon": "Mass and Homilies",
};
// v338 §2.2: the pairing mirror — v337 §2.7's table as data in the
// Worker, mirroring jobs/compose_app_audio.py's OWN_PAIRING (the
// five entries verbatim) + SLOT_PAIRING (the eleven entries
// verbatim); the novena-* prefix pairs to the Novenas item (the
// helper's pairing_for). The table now stands in TWO places —
// contract data: a change lands in both in the same release, or in
// neither (v339's four rows land in both).
const INTRO_PAIRING: Record<string, string> = {
  "morning-prayer": "Morning Prayer",
  "daily-rosary": "Daily Rosary",
  "marian-antiphon-angelus": "Morning Marian Antiphon",
  "auxilium-christianorum": "Auxilium Christianorum",
  "daily-reflection": "Daily Reflection",
  "ext-invitatory": "Invitatory",
  "ext-morning-prayer": "Morning Prayer (Liturgy of the Hours)",
  "ext-midmorning-prayer": "Midmorning (Terce)",
  "ext-midday-prayer": "Midday Prayer",
  "ext-midafternoon-prayer": "None (Liturgy of the Hours)",
  "ext-office-of-readings": "Office of Readings",
  "ext-evening-prayer": "Vespers",
  "ext-night-prayer": "Compline",
  "ext-bible-in-a-year": "Bible in a Year",
  "ext-gospel-exegesis": "Daily Gospel Exegesis",
  "ext-saint-of-the-day": "Saint of the Day",
  // v339 §2.5: the block's four slots pair to the Mass item — the
  // same drawn intention renders four intro files, one per slot
  // (the Novenas precedent: one item's draw, per-track files).
  "ext-usccb-readings": "Mass",
  "ext-daily-tv-mass": "Mass",
  "ext-fr-mike-homily": "Mass",
  "ext-barron-sermon": "Mass",
  // v368 §2.6 (D4-B, John's word 2026-11-10 20:48 CT — the NEW
  // module item, as designed): the episode pairs to the new item
  // 'The AI Signal', which migration 0016 plants in its own
  // module block. The helper's SLOT_PAIRING carries the same
  // entry — the two tables are one contract, changed together.
  "the-ai-signal": "The AI Signal",
};
// v342 (privacy decision, John 2026-11-09 11:24 CT — the §2
// Concern 2 alternative, adopted): the drawn intention TEXTS ride
// the signed-in day shell as this introTexts map; the public
// intentions feed carries AUDIO ONLY. The map is keyed by track id
// exactly as v338's intros map was — the client joins it with the
// feed-built map entries (title/streamUrl/sizeBytes) to stand the
// full v338 entry. Derivation mirrors the retired playerIntrosMap:
// the presented day's draw (the same prayer payload the helper's
// read_draw consumes), joined through INTRO_PAIRING — the pairing
// table stands as generation data (§2.8 ruling 4); only its
// consumer changed. Novena track ids are feed-born (novena-<slug>):
// v427 enumerates the presented day's ids from the own feed
// (§2.3) and emits ONE entry per episode id from the per-episode
// draw store (§2.2) — the "novenas" family key RETIRES (§2.4):
// an episode with no draw shows NO line, never another draw's
// text. Absence is the missing-intro signal — never an error,
// never a placeholder.
async function playerIntroTexts(
  env: Env,
  presented: string,
): Promise<Record<string, string>> {
  const day = await prayerDayPayload(env, presented);
  const drawByItem = new Map<string, string>();
  for (const b of day.blocks) {
    for (const d of b.devotions) {
      if (d.intentions && d.intentions[0] && d.intentions[0].text) drawByItem.set(d.name, d.intentions[0].text);
    }
  }
  const out: Record<string, string> = {};
  for (const [trackId, item] of Object.entries(INTRO_PAIRING)) {
    const text = drawByItem.get(item);
    if (text) out[trackId] = text;
  }
  // v427 §2.4: the per-episode emission. The whole episode path
  // stands inside this try/catch (the standing dayPositions /
  // blockOrder fold pattern): any failure — including the table
  // absent in a pre-0022 rollback posture — emits NO per-episode
  // keys and never errors the shell.
  try {
    const epMap = await prayerEpisodeDrawForDate(env, presented);
    if (epMap.size) {
      const all = await env.DB.prepare("SELECT id, text FROM prayer_intentions").all<{ id: number; text: string }>();
      const textById = new Map((all.results ?? []).map((i) => [i.id, i.text]));
      for (const [episodeId, intentionId] of epMap) {
        const text = textById.get(intentionId);
        if (text) out[episodeId] = text;
      }
    }
  } catch { /* the episode path degrades to absence */ }
  return out;
}
// v342 §2.5: the day SHELL. The payload carries the presented
// day, the block list (label/caption/playlist route per block —
// the standing mkBlock fields), the settings version, and the
// introTexts map (the privacy decision's text home) — and NO own
// tracks, NO intros join, NO storedDay. The client fills own
// tracks, externals, and intros at open in the one resolution
// pass (§2.8 ruling 3), exactly as it already filled externals.
// Named-missing is a client computation (settings standing vs
// resolution results). player_episodes is not read here at all —
// v368 §2.2.7's ONE bounded exception stands below: the "The AI
// Signal" block only, whose episode resolves from no feed.
async function playerDayPayload(env: Env, dateOverride?: string) {
  const labelRows = await env.DB.prepare("SELECT block, label FROM prayer_block_labels").all<{ block: string; label: string }>();
  const labels = new Map((labelRows.results ?? []).map((r) => [r.block, r.label]));
  const srcRows = await env.DB.prepare("SELECT * FROM player_sources ORDER BY sort, id").all<{
    id: number; block: string; title: string; source_kind: string; rss_url: string; spotify_url: string; sort: number;
  }>();
  const sources = srcRows.results ?? [];
  // v337 §2.1: the PRESENTED day is the Chicago calendar day — the
  // app presents today; production (date+2) stays a production
  // fact in the nightly report, never a payload field.
  // v392 W1: an override (the session route validates it to
  // Chicago today or tomorrow) presents THAT day throughout —
  // intro texts, the AI Signal store read, presentedDay.
  const presented = dateOverride ?? prayerChicagoNow().date;
  const settings = await sourceSettingsPayload(env);
  const introTexts = await playerIntroTexts(env, presented);
  // v368 §2.2.7: the ONE bounded exception to the shell's
  // no-tracks rule — the "The AI Signal" block only. The
  // episode's existence is a fact of the app's own store and
  // resolves from NO feed; the shell is the signed-in surface
  // that already reads that store for introTexts, and the v312
  // store-read is the standing precedent for own content. When
  // the presented date's row stands present, the block carries
  // the single descriptor; otherwise tracks [] + trackCount 0
  // and the client computes named-missing from the settings
  // standing exactly as for every own source. No other block's
  // shell entry changes; no other payload field changes. A
  // future store-only source reuses this shape deliberately,
  // never by drift (§2 Concern 2).
  const aiRow = await env.DB.prepare(
    "SELECT title, duration_s, size_bytes, audio_state FROM player_episodes WHERE date=? AND episode_id='the-ai-signal'",
  ).bind(presented).first<{ title: string; duration_s: number; size_bytes: number; audio_state: string }>();
  const blocks = PRAYER_BLOCKS.map((block) => {
    const route = sources.find((x) => x.block === block && x.source_kind === "playlist");
    if (block === "The AI Signal" && aiRow && aiRow.audio_state === "present") {
      const desc = {
        episodeId: "the-ai-signal", title: aiRow.title, block: "The AI Signal", kind: "episode",
        durationS: aiRow.duration_s, sizeBytes: aiRow.size_bytes,
        streamUrl: `/api/player/audio/${presented}/the-ai-signal`, state: "present",
      };
      return { block, label: labels.get(block) ?? block, caption: BLOCK_CAPTION[block], spotifyUrl: route?.spotify_url || PRAYLIST_URL[block], tracks: [desc] as unknown[], trackCount: 1 };
    }
    return { block, label: labels.get(block) ?? block, caption: BLOCK_CAPTION[block], spotifyUrl: route?.spotify_url || PRAYLIST_URL[block], tracks: [] as unknown[], trackCount: 0 };
  });
  // v412 Fix 10: the day-positions fold — the presented day's
  // partway day-track positions ride the payload beside the
  // blocks, keyed by episode id, exactly as the podcast payload
  // folds its positions into its entries. The client hands each
  // to startDesc's pendingResume seam. An absent table (pre-0020
  // rollback posture) reads as an empty fold, never an error.
  let dayPositions: Record<string, number> = {};
  try {
    const dayPosRows = await env.DB.prepare("SELECT episode_id, position_s FROM day_positions WHERE date=?")
      .bind(presented).all<{ episode_id: string; position_s: number }>();
    dayPositions = Object.fromEntries((dayPosRows.results ?? []).map((r) => [r.episode_id, r.position_s]));
  } catch { dayPositions = {}; }
  // v413 §2.2: the manual-order fold — the stored arrangement
  // rides the day payload itself, so it is fresh at every open
  // with no version check. An absent table (pre-0021 rollback
  // posture) or an empty one reads as null = contract order.
  const blockOrder = await playerBlockOrder(env);
  return {
    ok: true, date: presented, dateLabel: prayerDateLabel(presented), presentedDay: presented,
    liturgicalDay: await liturgicalDayFor(env, presented),
    version: settings.version, introTexts, blocks, dayPositions, blockOrder,
  };
}

// v413 §2.2: the manual playlist order's read — the stored block
// names in stored order, or null when no row stands (FD1:
// absence = the contracts' order). A missing table (pre-0021)
// reads as null, never an error.
async function playerBlockOrder(env: Env): Promise<string[] | null> {
  try {
    const r = await env.DB.prepare("SELECT block FROM player_block_order ORDER BY sort_order").all<{ block: string }>();
    const names = (r.results ?? []).map((x) => x.block);
    return names.length ? names : null;
  } catch { return null; }
}

// ---- Examination + Confession -------------------------------------------
const COMMANDMENT_CATS = ["Commandment I", "Commandment II", "Commandment III", "Commandment IV", "Commandment V", "Commandment VI and IX", "Commandment VII", "Commandment VIII", "Commandment X"];
async function examToday(env: Env) {
  const { date } = prayerChicagoNow();
  let run = await env.DB.prepare("SELECT * FROM exam_runs WHERE date=?").bind(date).first<{ id: number; date: string; state: string; opened_at: string; closed_at: string | null }>();
  if (!run) {
    const r = await env.DB.prepare("INSERT INTO exam_runs (date, state, opened_at) VALUES (?, 'open', ?) RETURNING id").bind(date, nowISO()).first<{ id: number }>();
    run = { id: r!.id, date, state: "open", opened_at: nowISO(), closed_at: null };
  }
  const prompts = await env.DB.prepare("SELECT * FROM exam_prompts ORDER BY sort, id").all();
  const entries = await env.DB.prepare("SELECT * FROM exam_entries WHERE run_id=? ORDER BY created_at, id").bind(run.id).all();
  const cats: string[] = [];
  for (const p of (prompts.results ?? []) as { category: string }[]) if (!cats.includes(p.category)) cats.push(p.category);
  const dayIdx = Math.floor(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000);
  const focusCategory = COMMANDMENT_CATS[dayIdx % COMMANDMENT_CATS.length];
  return { ok: true, date, dateLabel: prayerDateLabel(date), run, prompts: prompts.results ?? [], entries: entries.results ?? [], categories: cats, focusCategory };
}
function elapsedText(lastDate: string | null, today: string): string {
  if (!lastDate) return "No confession recorded yet in this app";
  const days = Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(lastDate + "T12:00:00Z")) / 86400000);
  if (days <= 0) return "You went to confession today";
  if (days === 1) return "It has been 1 day since your last confession";
  if (days < 14) return `It has been ${days} days since your last confession`;
  const weeks = Math.floor(days / 7);
  return `It has been ${weeks} week${weeks === 1 ? "" : "s"} since your last confession`;
}
async function confessionPayload(env: Env) {
  const { date: today } = prayerChicagoNow();
  const guide = await env.DB.prepare("SELECT * FROM confession_guide ORDER BY step_no").all();
  const last = await env.DB.prepare("SELECT * FROM confessions ORDER BY date DESC, id DESC LIMIT 1").first<{ id: number; date: string; note: string; penance_text: string; penance_done_at: string | null }>();
  const open = await env.DB.prepare(
    "SELECT e.*, r.date AS run_date FROM exam_entries e JOIN exam_runs r ON r.id = e.run_id WHERE e.confession_id IS NULL ORDER BY e.created_at, e.id",
  ).all<{ id: number; category: string; text: string; prompt_id: number | null; run_date: string }>();
  const catOrder = ["Preliminary Examination", ...COMMANDMENT_CATS, "Precepts of the Church", "Capital Sins", "Anything else"];
  const groups = new Map<string, { category: string; entries: { id: number; text: string; date: string }[]; repeatPrompts: number }>();
  const perPrompt = new Map<string, number>();
  for (const e of open.results ?? []) {
    if (!groups.has(e.category)) groups.set(e.category, { category: e.category, entries: [], repeatPrompts: 0 });
    groups.get(e.category)!.entries.push({ id: e.id, text: e.text, date: e.run_date });
    if (e.prompt_id) { const k = `${e.category}:${e.prompt_id}`; perPrompt.set(k, (perPrompt.get(k) ?? 0) + 1); }
  }
  for (const [k, n] of perPrompt) if (n > 1) { const cat = k.split(":")[0]; const g = groups.get(cat); if (g) g.repeatPrompts++; }
  const prep = [...groups.values()].sort((a, b) => {
    const ia = catOrder.indexOf(a.category), ib = catOrder.indexOf(b.category);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const hist = await env.DB.prepare(
    "SELECT c.*, (SELECT COUNT(*) FROM exam_entries e WHERE e.confession_id = c.id) AS entry_count FROM confessions c ORDER BY c.date DESC, c.id DESC",
  ).all<{ id: number; date: string; note: string; penance_text: string; penance_done_at: string | null; entry_count: number }>();
  return {
    ok: true,
    elapsed: elapsedText(last?.date ?? null, today),
    lastConfession: last ? { id: last.id, date: last.date, note: last.note } : null,
    guide: guide.results ?? [],
    penance: last ? { confessionId: last.id, date: last.date, text: last.penance_text, done_at: last.penance_done_at } : null,
    prep,
    history: (hist.results ?? []).map((h) => ({ id: h.id, date: h.date, note: h.note, penance_text: h.penance_text, penance_done_at: h.penance_done_at, entryCount: h.entry_count })),
  };
}

// ---- Source-mapping settings (v328 §2.1/§2.2) ----------------------
// The mapping as data: one row per source in player_source_settings,
// seeded once by migration 0010 (the seed of record — the Worker
// carries no seed constant), plus the player_settings_meta version.
// The session surface reads and writes it (John's edits); the agent
// door reads it only (the nightly push's consumption leg). One
// payload shape serves both reads.
const DAY_RULES = ["daily", "weekdays", "weekends", "sundays", "fridays", "fallback-only"] as const;
interface SourceSettingRow {
  source_key: string; name: string; family: string; block: string; day_rule: string;
  sort_order: number | null; enabled: number; slot_id: string | null; role: string;
}
async function sourceSettingsPayload(env: Env) {
  const meta = await env.DB.prepare("SELECT version FROM player_settings_meta WHERE id=1").first<{ version: number }>();
  const r = await env.DB.prepare("SELECT * FROM player_source_settings").all<SourceSettingRow>();
  const blockRank = (b: string) => {
    const i = (PRAYER_BLOCKS as readonly string[]).indexOf(b);
    return b === "" ? PRAYER_BLOCKS.length : (i < 0 ? PRAYER_BLOCKS.length + 1 : i);
  };
  const rows = (r.results ?? []).slice().sort((a, b2) =>
    blockRank(a.block) - blockRank(b2.block)
    || (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b2.sort_order ?? Number.MAX_SAFE_INTEGER)
    || a.name.localeCompare(b2.name));
  return {
    ok: true,
    version: meta?.version ?? 0,
    sources: rows.map((s) => ({
      sourceKey: s.source_key, name: s.name, family: s.family, block: s.block,
      dayRule: s.day_rule, sortOrder: s.sort_order, enabled: s.enabled,
      slotId: s.slot_id, role: s.role,
    })),
  };
}

// ---- Client-side externals (v334) ----------------------------------
// The TypeScript port of jobs/externals_resolver.py's matchers (the
// Python file stays the oracle; harness-v334 leg 1 proves parity).
// The courier leg exists for ONE reason: the Divine Office feed
// sends no CORS header, so the browser may not read it; the Worker
// fetches it at open, matches in-request, and stores nothing — no
// D1 write, no KV, no retained state (§2.2).
const EXT_DO_FEED_URL = "https://divineoffice.org/feed/podcast/";
const EXT_TOKENS: Record<string, string[]> = {
  DO_INVITATORY: ["Invitatory", "Invitatory Psalm"],
  DO_MORNING: ["Morning Prayer"],
  DO_OFFICE: ["Office of Readings"],
  DO_MIDMORNING: ["Midmorning Prayer"],
  DO_MIDDAY: ["Midday Prayer"],
  DO_MIDAFTERNOON: ["Midafternoon Prayer"],
  DO_EVENING: ["Evening Prayer", "Vespers"],
  DO_NIGHT_ANY: ["Night Prayer", "Compline"],
};
// (slotId, resolver display title, token key) in resolver slot order.
const EXT_DO_SLOTS: { slotId: string; title: string; tokenKey: string }[] = [
  { slotId: "ext-invitatory", title: "Invitatory", tokenKey: "DO_INVITATORY" },
  { slotId: "ext-morning-prayer", title: "Morning Prayer", tokenKey: "DO_MORNING" },
  { slotId: "ext-midmorning-prayer", title: "Midmorning Prayer", tokenKey: "DO_MIDMORNING" },
  { slotId: "ext-midday-prayer", title: "Midday Prayer", tokenKey: "DO_MIDDAY" },
  { slotId: "ext-midafternoon-prayer", title: "Midafternoon Prayer", tokenKey: "DO_MIDAFTERNOON" },
  { slotId: "ext-office-of-readings", title: "Office of Readings", tokenKey: "DO_OFFICE" },
  { slotId: "ext-evening-prayer", title: "Evening Prayer", tokenKey: "DO_EVENING" },
  { slotId: "ext-night-prayer", title: "Night Prayer", tokenKey: "DO_NIGHT_ANY" },
];
interface ExtFeedItem { title: string; url: string; length: number; pubMs: number | null; durationS: number; imageUrl: string | null; descText: string | null }
function extXmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
function extParseDuration(raw: string | null): number {
  if (!raw) return 0;
  const t = raw.trim();
  try {
    if (t.includes(":")) {
      let secs = 0;
      for (const p of t.split(":")) secs = secs * 60 + Number(p);
      return Number.isFinite(secs) ? Math.trunc(secs) : 0;
    }
    const v = Number(t);
    return Number.isFinite(v) ? Math.trunc(v) : 0;
  } catch { return 0; }
}
// v413 §2.3: the description snippet's text form — tags stripped
// (a feed description is HTML), entities decoded by the standing
// extXmlText discipline, whitespace collapsed, truncated at 240
// chars. The client's two-line clamp trims it further at paint.
function extStripDesc(raw: string): string {
  const noTags = raw.replace(/<[^>]*>/g, " ");
  const t = extXmlText(noTags);
  return t.length > 240 ? t.slice(0, 240) : t;
}
function extItemImage(body: string): string | null {
  const im = /<itunes:image\b[^>]*?href="([^"]*)"/.exec(body) || /<itunes:image\b[^>]*?href='([^']*)'/.exec(body);
  return im ? extXmlText(im[1]) || null : null;
}
function extItemDesc(body: string): string | null {
  const sm = /<itunes:summary>([\s\S]*?)<\/itunes:summary>/.exec(body) || /<description>([\s\S]*?)<\/description>/.exec(body);
  if (!sm) return null;
  const t = extStripDesc(sm[1]);
  return t || null;
}
// v413 §2.3: the channel head's own art + description, parsed
// once from the part of the document before the first item —
// the fallback art for items carrying none, and (for podcasts)
// the series page's show art + description.
function extParseChannelHead(xml: string): { channelImageUrl: string | null; channelDesc: string | null } {
  const cut = xml.indexOf("<item");
  const head = cut >= 0 ? xml.slice(0, cut) : xml;
  let channelImageUrl = extItemImage(head);
  if (!channelImageUrl) {
    const um = /<image>[\s\S]*?<url>([\s\S]*?)<\/url>/.exec(head);
    if (um) channelImageUrl = extXmlText(um[1]) || null;
  }
  let channelDesc: string | null = null;
  const dm = /<itunes:summary>([\s\S]*?)<\/itunes:summary>/.exec(head) || /<description>([\s\S]*?)<\/description>/.exec(head);
  if (dm) channelDesc = extStripDesc(dm[1]) || null;
  return { channelImageUrl, channelDesc };
}
function extParseFeed(xml: string): ExtFeedItem[] {
  if (!/<channel[\s>]/.test(xml) || !/<item[\s>]/.test(xml)) throw new Error("feed parse failed");
  const items: ExtFeedItem[] = [];
  const itemRe = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const body = m[1];
    const titleM = /<title>([\s\S]*?)<\/title>/.exec(body);
    const encM = /<enclosure\b([^>]*?)\/?>/.exec(body);
    let url = "", length = 0;
    if (encM) {
      const um = /url="([^"]*)"/.exec(encM[1]);
      if (um) url = extXmlText(um[1]);
      const lm = /length="(\d+)"/.exec(encM[1]);
      if (lm) length = Number(lm[1]);
    }
    const pubM = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(body);
    const pubMs = pubM ? Date.parse(pubM[1].trim()) : NaN;
    const durM = /<[A-Za-z0-9_.-]*:?duration>([^<]*)</.exec(body);
    items.push({
      title: titleM ? extXmlText(titleM[1]) : "",
      url, length,
      pubMs: Number.isFinite(pubMs) ? pubMs : null,
      durationS: extParseDuration(durM ? durM[1] : null),
      // v413 §2.3: per-item provider art + snippet (D2) — the
      // item's own image, else null (the channel fallback is
      // applied by the consumers that hold the head).
      imageUrl: extItemImage(body),
      descText: extItemDesc(body),
    });
  }
  return items;
}
const EXT_MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EXT_MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function extDateRe(month: string, day: number): RegExp {
  const esc = month.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z])${esc}\\s*[-,]*\\s*0?${day}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{4})?(?!\\w)`, "i");
}
function extMatchesMonthDay(title: string, y: number, mo: number, d: number): boolean {
  return extDateRe(EXT_MONTHS_FULL[mo - 1], d).test(title) || extDateRe(EXT_MONTHS_ABBR[mo - 1], d).test(title);
}
function extMatchDivineOffice(items: ExtFeedItem[], y: number, mo: number, d: number): Map<string, ExtFeedItem> {
  // The resolver's matcher ported: term at a non-letter boundary,
  // title-date == target, enclosure required, first in feed order
  // wins, one item consumed by one slot only.
  const out = new Map<string, ExtFeedItem>();
  const consumed = new Set<number>();
  for (const slot of EXT_DO_SLOTS) {
    const pats = EXT_TOKENS[slot.tokenKey].map((t) => new RegExp(`(?<![A-Za-z])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (consumed.has(i) || !it.url) continue;
      if (pats.some((p) => p.test(it.title)) && extMatchesMonthDay(it.title, y, mo, d)) {
        out.set(slot.slotId, it);
        consumed.add(i);
        break;
      }
    }
  }
  return out;
}
const EXT_BIAY_FEED_URL = "https://feeds.fireside.fm/bibleinayear/rss";
const EXT_STH_FEED_URL = "https://feeds.castos.com/x8g54";
function extMatchBible(items: ExtFeedItem[], y: number, mo: number, d: number): ExtFeedItem | null {
  // The resolver's Bible matcher ported (courier pass-through use):
  // Day N (day-of-year capped 365) + enclosure + current year only;
  // newest pubDate wins.
  const doy = Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  const n = doy > 365 ? 365 : doy;
  const pat = new RegExp(`\\bDay\\s*0*${n}\\b`, "i");
  let best: ExtFeedItem | null = null;
  for (const it of items) {
    if (!it.url || !pat.test(it.title)) continue;
    const years = it.title.match(/\b(20\d{2})\b/g);
    const year = years ? Math.max(...years.map(Number)) : (it.pubMs != null ? new Date(it.pubMs).getUTCFullYear() : null);
    if (year !== y) continue;
    if (!best || (it.pubMs ?? -Infinity) > (best.pubMs ?? -Infinity)) best = it;
  }
  return best;
}
function extMatchSth(items: ExtFeedItem[], y: number, mo: number, d: number, token: string): ExtFeedItem | null {
  const prefix = `${mo}.${d}.${String(y).slice(2)}`;
  for (const it of items) {
    if (it.url && it.title.includes(prefix) && it.title.toLowerCase().includes(token.toLowerCase())) return it;
  }
  return null;
}
const EXT_DGE_FEED_URL = "https://anchor.fm/s/1025ef1c/podcast/rss";
const EXT_SAINT_FEED_URL = "https://feeds.buzzsprout.com/2216056.rss";
function extMatchLatestByDate(items: ExtFeedItem[], y: number, mo: number, d: number): ExtFeedItem | null {
  // v337 §2.8: the bundle contract's latest_by_release_date ported
  // (the daily-gospel-exegesis resolver DGE; the Saint matcher
  // below shares the pick) — the item with the latest release date
  // NOT AFTER the presented date; an enclosure is part of the match
  // (the resolver's standing RSS pin); ties keep feed order. Only
  // the resolution target changes from the Spotify context — the
  // RSS enclosure instead of a Spotify URI (John, 2026-11-09
  // 06:55 CT). jobs/externals_resolver.py is the Python oracle.
  const endMs = Date.UTC(y, mo - 1, d, 23, 59, 59, 999);
  let best: ExtFeedItem | null = null;
  for (const it of items) {
    if (!it.url || it.pubMs == null || it.pubMs > endMs) continue;
    if (!best || it.pubMs > (best.pubMs ?? -Infinity)) best = it;
  }
  return best;
}
function extMatchSaint(items: ExtFeedItem[], y: number, mo: number, d: number): ExtFeedItem | null {
  // v337 §2.8: latest_by_release_date with the title's MM/DD prefix
  // checked against the presented date — a latest item whose title
  // date disagrees reads named-missing (null here), never a
  // wrong-day saint.
  const it = extMatchLatestByDate(items, y, mo, d);
  if (!it) return null;
  const prefix = `${String(mo).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  return it.title.startsWith(prefix) ? it : null;
}
const EXT_BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
// v413 §2.3: the full feed read — items PLUS the channel head's
// art + description. extFetchFeedItems delegates (its standing
// callers keep the items-only shape); consumers that serve art
// (the live payload's legs, the podcast sequence build) call
// this one.
interface ExtFeedRead { items: ExtFeedItem[]; channelImageUrl: string | null; channelDesc: string | null }
async function extFetchFeed(url: string, userAgent?: string): Promise<ExtFeedRead> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { "user-agent": userAgent || "ora-pro-nobis-externals-resolver/1.0" }, signal: ctl.signal });
    if (!res.ok) throw new Error(`feed fetch failed: HTTP ${res.status}`);
    const xml = await res.text();
    const head = extParseChannelHead(xml);
    return { items: extParseFeed(xml), channelImageUrl: head.channelImageUrl, channelDesc: head.channelDesc };
  } finally { clearTimeout(timer); }
}
async function extFetchFeedItems(url: string, userAgent?: string): Promise<ExtFeedItem[]> {
  return (await extFetchFeed(url, userAgent)).items;
}
// v339 §2.3: the Mass and Homilies block's sources.
const EXT_USCCB_FEED_URL = "https://feeds.feedburner.com/usccb/zhqs";
const EXT_TVMASS_FEED_URL = "https://feeds.buzzsprout.com/949645.rss";
const EXT_FRMIKE_FEED_URL = "https://feeds.fireside.fm/fathermikehomilies/rss";
const EXT_BARRON_FEED_URL = "https://www.wordonfire.org/videos/sermons/feed/";
function extMatchUsccb(items: ExtFeedItem[], y: number, mo: number, d: number): ExtFeedItem | null {
  // v339 §2.3: the bundle contract's USCCB matcher ported — the
  // title-date match for the PRESENTED day in an ahead-publishing
  // feed (items through month-end stand in it; "latest" would pick
  // a future day's readings). The bundle's latest-by-release
  // fallback fires ONLY when no dated item matches. Enclosure
  // required (the standing RSS pin). jobs/externals_resolver.py
  // is the Python oracle.
  for (const it of items) {
    if (it.url && extMatchesMonthDay(it.title, y, mo, d)) return it;
  }
  return extMatchLatestByDate(items, y, mo, d);
}
function extMatchTvMass(items: ExtFeedItem[], y: number, mo: number, d: number): ExtFeedItem | null {
  // v339 §2.3: the builder's title/date matching — the item whose
  // title names the presented day ("Daily TV Mass <Weekday>
  // <Month> <D>, <YYYY>"); title term + title date, enclosure
  // required. The Python oracle's match_daily_tv_mass.
  for (const it of items) {
    if (it.url && it.title.includes("Daily TV Mass") && extMatchesMonthDay(it.title, y, mo, d)) return it;
  }
  return null;
}
// The courier-class slots (v339 §2.3): feeds the browser may not
// read (no ACAO), served by /externals/live. matcher 'usccb' is
// the title-date port; 'latest' is latest_by_release_date. The
// Barron fetch sends a browser user-agent (a bare resolver UA
// drew 403 from Word on Fire — §1's probe).
const EXT_COURIER_SLOTS: { slotId: string; title: string; feed: (env: Env) => string; matcher: "usccb" | "latest"; browserUa?: boolean }[] = [
  { slotId: "ext-usccb-readings", title: "USCCB Daily Readings", feed: (env) => env.EXT_USCCB_FEED_URL || EXT_USCCB_FEED_URL, matcher: "usccb" },
  { slotId: "ext-fr-mike-homily", title: "Fr. Mike Sunday Homily", feed: (env) => env.EXT_FRMIKE_FEED_URL || EXT_FRMIKE_FEED_URL, matcher: "latest" },
  { slotId: "ext-barron-sermon", title: "Bp. Barron Sunday Sermon", feed: (env) => env.EXT_BARRON_FEED_URL || EXT_BARRON_FEED_URL, matcher: "latest", browserUa: true },
];
function extMatchCourierSlot(slot: (typeof EXT_COURIER_SLOTS)[number], items: ExtFeedItem[], y: number, mo: number, d: number): ExtFeedItem | null {
  return slot.matcher === "usccb" ? extMatchUsccb(items, y, mo, d) : extMatchLatestByDate(items, y, mo, d);
}
async function extCourierSlotsPayload(env: Env, prim: Map<string, SourceSettingRow & { sourceKey: string }>, y: number, mo: number, d: number, weekdayMon0: number): Promise<unknown[]> {
  // v339 §2.3: each courier-class slot fetched and matched
  // in-request, per-source; a failed feed leaves ITS slot
  // named-missing and touches nothing else. The fetches run
  // CONCURRENTLY — the courier's response time stays bounded by
  // the slowest single feed (the pre-v339 posture for the Divine
  // Office leg), never by their sum.
  const standing = EXT_COURIER_SLOTS.filter((cs) => {
    const row = prim.get(cs.slotId);
    return !!row && row.enabled === 1 && extDayRulePasses(row.day_rule || "daily", weekdayMon0);
  });
  return Promise.all(standing.map(async (cs) => {
    const row = prim.get(cs.slotId)!;
    let it: ExtFeedItem | null = null;
    let channelImageUrl: string | null = null;
    try {
      const feed = await extFetchFeed(cs.feed(env), cs.browserUa ? EXT_BROWSER_UA : undefined);
      channelImageUrl = feed.channelImageUrl;
      it = extMatchCourierSlot(cs, feed.items, y, mo, d);
    } catch { it = null; }
    if (!it) return { slotId: cs.slotId, state: "missing", title: cs.title, streamUrl: null, durationSec: 0, sizeBytes: 0, block: row.block || EXTERNAL_SLOTS[cs.slotId], sortOrder: row.sort_order };
    return { slotId: cs.slotId, state: "present", title: cs.title, streamUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, block: row.block || EXTERNAL_SLOTS[cs.slotId], sortOrder: row.sort_order, imageUrl: it.imageUrl || channelImageUrl || null, descText: it.descText || null };
  }));
}
function extDayRulePasses(rule: string, weekdayMon0: number): boolean {
  // The push helper's day_rule_passes, ported: 'fallback-only' on a
  // primary row never passes.
  if (rule === "daily") return true;
  if (rule === "weekdays") return weekdayMon0 < 5;
  if (rule === "weekends") return weekdayMon0 >= 5;
  if (rule === "sundays") return weekdayMon0 === 6;
  if (rule === "fridays") return weekdayMon0 === 4;
  return false;
}
async function externalsLivePayload(env: Env, date: string): Promise<{ slots: unknown[]; settingsVersion: number; error?: string }> {
  const settings = await sourceSettingsPayload(env);
  const prim = new Map<string, SourceSettingRow & { sourceKey: string }>();
  for (const s of settings.sources) {
    if (s.family === "external" && s.slotId && s.role !== "fallback") {
      prim.set(s.slotId, { source_key: s.sourceKey, name: s.name, family: s.family, block: s.block, day_rule: s.dayRule, sort_order: s.sortOrder, enabled: s.enabled, slot_id: s.slotId, role: s.role });
    }
  }
  const [y, mo, d] = date.split("-").map(Number);
  const weekdayMon0 = (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7;
  const standing = EXT_DO_SLOTS.filter((slot) => {
    const row = prim.get(slot.slotId);
    return !!row && row.enabled === 1 && extDayRulePasses(row.day_rule || "daily", weekdayMon0);
  });
  const mkMissing = (slot: { slotId: string; title: string }) => {
    const row = prim.get(slot.slotId)!;
    return { slotId: slot.slotId, state: "missing", title: slot.title, streamUrl: null, durationSec: 0, sizeBytes: 0, block: row.block || EXTERNAL_SLOTS[slot.slotId], sortOrder: row.sort_order };
  };
  // v348 §2.3(a): the Daily Gospel Exegesis leg joins the live
  // payload through the Worker courier — started BEFORE the
  // Divine Office fetch so route latency stays bounded by the
  // slowest single leg. It uses only extFetchFeedItems (15 s
  // server budget) + extMatchLatestByDate — the identical
  // function the /externals/audio pass-through uses for this
  // slot, so the live pick and the pass-through pick are the
  // same pick by construction. Settings-gated like every courier
  // slot: an absent/disabled/day-rule-failing row contributes
  // NO entry. TITLE RULE (named deviation): the present entry
  // carries the ITEM's title — the exegesis displays its episode
  // title, unlike the courier class's fixed slot titles.
  const exegesisP: Promise<unknown[]> = (async () => {
    const row = prim.get("ext-gospel-exegesis");
    if (!row || row.enabled !== 1 || !extDayRulePasses(row.day_rule || "daily", weekdayMon0)) return [];
    try {
      const feed = await extFetchFeed(env.EXT_DGE_FEED_URL || EXT_DGE_FEED_URL);
      const it = extMatchLatestByDate(feed.items, y, mo, d);
      if (!it) return [{ slotId: "ext-gospel-exegesis", state: "missing", title: "Daily Gospel Exegesis", streamUrl: null, durationSec: 0, sizeBytes: 0, block: row.block || EXTERNAL_SLOTS["ext-gospel-exegesis"], sortOrder: row.sort_order }];
      return [{ slotId: "ext-gospel-exegesis", state: "present", title: it.title, streamUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, block: row.block || EXTERNAL_SLOTS["ext-gospel-exegesis"], sortOrder: row.sort_order, imageUrl: it.imageUrl || feed.channelImageUrl || null, descText: it.descText || null }];
    } catch {
      return [{ slotId: "ext-gospel-exegesis", state: "missing", title: "Daily Gospel Exegesis", streamUrl: null, durationSec: 0, sizeBytes: 0, block: row.block || EXTERNAL_SLOTS["ext-gospel-exegesis"], sortOrder: row.sort_order }];
    }
  })();
  // v350: the Bible in a Year leg joins the live payload through
  // the Worker courier — the v348 pattern applied to the app's
  // largest on-device feed read (the Fireside feed: 9,187,427
  // bytes / 1,870 items, measured 2026-11-10). The client's
  // single direct leg (extFetchText's 8 s abort + an on-device
  // DOM parse of the whole feed — 5,001 ms at 6x CPU throttle,
  // measured) settled the slot named-missing on any fetch/parse
  // failure though the day's episode stood in the feed (Day 314,
  // John's report 2026-11-10 04:14 CT). Started BEFORE the
  // Divine Office fetch, like the exegesis leg. It uses only
  // extFetchFeedItems (15 s server budget) + extMatchBible —
  // the identical function the /externals/audio pass-through
  // uses for this slot, so the live pick and the pass-through
  // pick are the same pick by construction. Settings-gated
  // like every courier slot. TITLE RULE: the present entry
  // carries the ITEM's raw title (the exegesis entry shape);
  // the client builds the display title with its standing
  // extBibleTitle construction.
  const bibleP: Promise<unknown[]> = (async () => {
    const row = prim.get("ext-bible-in-a-year");
    if (!row || row.enabled !== 1 || !extDayRulePasses(row.day_rule || "daily", weekdayMon0)) return [];
    const missing = { slotId: "ext-bible-in-a-year", state: "missing", title: "Bible in a Year", streamUrl: null, durationSec: 0, sizeBytes: 0, block: row.block || EXTERNAL_SLOTS["ext-bible-in-a-year"], sortOrder: row.sort_order };
    try {
      const feed = await extFetchFeed(env.EXT_BIAY_FEED_URL || EXT_BIAY_FEED_URL);
      const it = extMatchBible(feed.items, y, mo, d);
      if (!it) return [missing];
      return [{ slotId: "ext-bible-in-a-year", state: "present", title: it.title, streamUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, block: row.block || EXTERNAL_SLOTS["ext-bible-in-a-year"], sortOrder: row.sort_order, imageUrl: it.imageUrl || feed.channelImageUrl || null, descText: it.descText || null }];
    } catch {
      return [missing];
    }
  })();
  let items: ExtFeedItem[] | null = null;
  let doChannelImage: string | null = null; // v413 §2.3: the DO channel's art — the slot descriptors' fallback
  let error: string | undefined;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(env.EXT_DO_FEED_URL || EXT_DO_FEED_URL, {
        headers: { "user-agent": "ora-pro-nobis-externals-resolver/1.0" }, signal: ctl.signal,
      });
    } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error(`feed fetch failed: HTTP ${res.status}`);
    const doXml = await res.text();
    doChannelImage = extParseChannelHead(doXml).channelImageUrl;
    items = extParseFeed(doXml);
  } catch (e) {
    error = e instanceof Error && e.name === "AbortError" ? "feed fetch timed out" : (e instanceof Error ? e.message : "feed fetch failed");
  }
  if (!items) {
    const courierSlots = await extCourierSlotsPayload(env, prim, y, mo, d, weekdayMon0);
    return { settingsVersion: settings.version, error, slots: [...standing.map(mkMissing), ...courierSlots, ...(await exegesisP), ...(await bibleP)] };
  }
  const matches = extMatchDivineOffice(items, y, mo, d);
  const slots = standing.map((slot) => {
    const it = matches.get(slot.slotId);
    if (!it) return mkMissing(slot);
    const row = prim.get(slot.slotId)!;
    return { slotId: slot.slotId, state: "present", title: slot.title, streamUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, block: row.block || EXTERNAL_SLOTS[slot.slotId], sortOrder: row.sort_order, imageUrl: it.imageUrl || doChannelImage || null, descText: it.descText || null };
  });
  slots.push(...(await extCourierSlotsPayload(env, prim, y, mo, d, weekdayMon0)) as typeof slots);
  slots.push(...(await exegesisP) as typeof slots);
  slots.push(...(await bibleP) as typeof slots);
  return { settingsVersion: settings.version, slots };
}

// ---- Podcasts section (v381) --------------------------------------
// Plan §2: a listening-progress section. The sequence is a derived,
// ordered list the Worker builds from the series' own feed (the
// v350 courier precedent — §2.6) and snapshots into D1; progress
// is per-user server state (podcast_listens, migration 0017); the
// current episode is DERIVED at read time as the first unlistened
// entry — never stored, never date-gated (§2.3).
const POD_CIY_FEED_URL = "https://feeds.fireside.fm/catechisminayear/rss";
const EXT_RIY_FEED_URL = "https://feeds.fireside.fm/rosaryinayear/rss";
const POD_SNAPSHOT_MAX_AGE_MS = 24 * 3600 * 1000;

// v390 §2.1: the series registry — v381's single-series constants
// generalized. Each entry carries the series key, the display
// title, the entry-key prefix, the feed (an env seam over a
// pinned constant, the estate's standing form — the Bible series
// rides EXT_BIAY_FEED_URL, the same var the Morning matcher legs
// read: one seam per feed), and the bonus-slug mode (§2.2's slug
// seam: Catechism's shortcut table is load-bearing for its
// standing marks; the other series use the generic slugger).
interface PodSeriesDef {
  key: string; title: string; prefix: string; slugMode: "shortcuts" | "generic";
  feedUrl: (env: Env) => string;
}
const POD_SERIES_LIST: PodSeriesDef[] = [
  { key: "catechism-in-a-year", title: "Catechism in a Year", prefix: "ciy", slugMode: "shortcuts", feedUrl: (env) => env.EXT_CIY_FEED_URL || POD_CIY_FEED_URL },
  { key: "bible-in-a-year", title: "Bible in a Year", prefix: "biy", slugMode: "generic", feedUrl: (env) => env.EXT_BIAY_FEED_URL || EXT_BIAY_FEED_URL },
  { key: "rosary-in-a-year", title: "The Rosary in a Year", prefix: "riy", slugMode: "generic", feedUrl: (env) => env.EXT_RIY_FEED_URL || EXT_RIY_FEED_URL },
];
function podSeriesDef(key: string): PodSeriesDef | null {
  return POD_SERIES_LIST.find((d) => d.key === key) ?? null;
}

interface PodEntry { key: string; kind: "day" | "bonus" | "special"; day: number | null; label: string; title: string; url: string; durationS: number; edition: number; imageUrl: string | null; descText: string | null }
interface PodBuild { entries: PodEntry[]; collapses: number }

function podStripEditionSuffix(title: string): string {
  return title.replace(/\s*\((?:19|20)\d{2}\)\s*$/, "").trim();
}
function podBonusSlug(title: string, slugMode: "shortcuts" | "generic"): string {
  // §2.1: the slug from the normalized bonus title — the three
  // known contents key as cozzens · cavins · pray; any later bonus
  // content keys from its own first words.
  // v390 §2.2 (the slug seam): the shortcut table is CATECHISM
  // knowledge — its keys are load-bearing (standing marks key on
  // them), so Catechism keeps it. Run over the Bible feed it
  // collapses distinct Cavins contents onto one key and loses
  // one; Bible and Rosary therefore use the generic slugger (the
  // standing fallback: the first four words of the normalized
  // title), under which every distinct content stands.
  const t = title.toLowerCase();
  if (slugMode === "shortcuts") {
    if (t.includes("cozzens")) return "cozzens";
    if (t.includes("cavins")) return "cavins";
    if (t.includes("pray")) return "pray";
  }
  const words = t.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 4);
  return words.join("-") || "bonus";
}

// The pure sequence build (§2.1). Items arrive in feed order.
// Returns the canonical entries — days by number, each supplied
// by the newest edition carrying it; bonuses anchored after the
// latest day published before them in their newest carrying
// edition; the Day 366 special last; the pre-launch trailer and
// any other non-day, non-BONUS item excluded.
// v413 §2.3: the build also receives the feed's channel art —
// each entry's imageUrl is its item art else the channel's;
// descText rides from the item. Snapshots built before v413
// lack both fields on their stored entries (the client treats
// absence as the fallback until the standing rebuild — F-413-2).
function podBuildSequence(items: ExtFeedItem[], def: PodSeriesDef, channelImageUrl?: string | null): PodBuild {
  let collapses = 0;
  const dayGroups = new Map<string, ExtFeedItem[]>(); // "edition|day" -> items in feed order
  const bonusItems: { it: ExtFeedItem; edition: number; slug: string }[] = [];
  for (const it of items) {
    if (!it.url || it.pubMs == null) continue;
    const edition = new Date(it.pubMs).getUTCFullYear();
    const dm = /^Day\s+(\d+)\s*:/i.exec(it.title);
    if (dm) {
      const k = edition + "|" + Number(dm[1]);
      const g = dayGroups.get(k);
      if (g) g.push(it); else dayGroups.set(k, [it]);
      continue;
    }
    if (/^BONUS\s*:/i.test(it.title)) {
      bonusItems.push({ it, edition, slug: podBonusSlug(podStripEditionSuffix(it.title.replace(/^BONUS\s*:\s*/i, "")), def.slugMode) });
      continue;
    }
    // Everything else — the "Introducing…" trailer named in §2.1
    // and any other non-day, non-bonus item — stands outside the
    // sequence.
  }
  // Per-(edition, day) winner (§2.1's duplicate rule): items whose
  // (pubDate, duration) match collapse to one (first in feed order
  // kept, the rest counted); if distinct items remain, the latest
  // pubDate supplies.
  const winner = new Map<string, ExtFeedItem>(); // "edition|day"
  for (const [k, g] of dayGroups) {
    const seen = new Set<string>();
    const distinct: ExtFeedItem[] = [];
    for (const it of g) {
      const sig = String(it.pubMs) + "|" + it.durationS;
      if (seen.has(sig)) { collapses++; continue; }
      seen.add(sig); distinct.push(it);
    }
    let w = distinct[0];
    for (const it of distinct) if ((it.pubMs ?? 0) > (w.pubMs ?? 0)) w = it;
    winner.set(k, w);
  }
  // Supplier per day: the newest edition carrying the day (§2.1's
  // edition supply rule). A rebuild may change only these supplier
  // fields — never order, never keys, never marks.
  const daySupplier = new Map<number, { it: ExtFeedItem; edition: number }>();
  for (const [k, it] of winner) {
    const [ed, day] = k.split("|").map(Number);
    const cur = daySupplier.get(day);
    if (!cur || ed > cur.edition) daySupplier.set(day, { it, edition: ed });
  }
  type Sortable = { entry: PodEntry; sortDay: number; sortRank: number; sortPub: number };
  const out: Sortable[] = [];
  for (const [day, sup] of daySupplier) {
    const special = day === 366;
    out.push({
      entry: {
        key: def.prefix + ":day-" + day, kind: special ? "special" : "day", day,
        label: special ? "Day 366 — Special" : "Day " + day,
        title: podStripEditionSuffix(sup.it.title.replace(/^Day\s+\d+\s*:\s*/i, "")),
        url: sup.it.url, durationS: sup.it.durationS, edition: sup.edition,
        imageUrl: sup.it.imageUrl || channelImageUrl || null, descText: sup.it.descText || null,
      },
      sortDay: day, sortRank: 0, sortPub: 0,
    });
  }
  // Bonuses (§2.1's anchor rule): per content, the newest edition
  // carrying it supplies; the anchor is the latest day published
  // before the bonus within that edition (0 = the sequence head).
  const bonusBySlug = new Map<string, { it: ExtFeedItem; edition: number }>();
  for (const b of bonusItems) {
    const cur = bonusBySlug.get(b.slug);
    if (!cur || b.edition > cur.edition || (b.edition === cur.edition && (b.it.pubMs ?? 0) > (cur.it.pubMs ?? 0))) {
      bonusBySlug.set(b.slug, { it: b.it, edition: b.edition });
    }
  }
  for (const [slug, sup] of bonusBySlug) {
    let anchor = 0;
    for (const [k, it] of winner) {
      const [ed, day] = k.split("|").map(Number);
      if (ed === sup.edition && (it.pubMs ?? 0) <= (sup.it.pubMs ?? 0) && day > anchor && day !== 366) anchor = day;
    }
    out.push({
      entry: {
        key: def.prefix + ":bonus-" + slug, kind: "bonus", day: null, label: "Bonus",
        title: podStripEditionSuffix(sup.it.title.replace(/^BONUS\s*:\s*/i, "")),
        url: sup.it.url, durationS: sup.it.durationS, edition: sup.edition,
        imageUrl: sup.it.imageUrl || channelImageUrl || null, descText: sup.it.descText || null,
      },
      sortDay: anchor, sortRank: 1, sortPub: sup.it.pubMs ?? 0,
    });
  }
  out.sort((a, b) => (a.sortDay - b.sortDay) || (a.sortRank - b.sortRank) || (a.sortPub - b.sortPub));
  return { entries: out.map((s) => s.entry), collapses };
}

interface PodSnapshot { entries: PodEntry[]; collapses: number; builtAt: string; showImageUrl?: string | null; showDesc?: string | null }
async function podReadSnapshot(env: Env, def: PodSeriesDef): Promise<PodSnapshot | null> {
  const row = await env.DB.prepare("SELECT payload FROM podcast_sequences WHERE series=?").bind(def.key).first<{ payload: string }>();
  if (!row) return null;
  try {
    const p = JSON.parse(row.payload) as PodSnapshot;
    if (!Array.isArray(p.entries) || typeof p.builtAt !== "string") return null;
    return p;
  } catch { return null; }
}
// The read path is the refresh path (§2.1): a snapshot missing or
// older than 24 hours rebuilds before answering; a failed rebuild
// serves the standing snapshot; with no snapshot at all the
// sequence is unavailable (leg L9's one error surface). v390
// §2.1: the refresh runs per series — one series' outage never
// darkens the others.
async function podSequence(env: Env, def: PodSeriesDef): Promise<{ snap: PodSnapshot; stale: boolean } | null> {
  const snap = await podReadSnapshot(env, def);
  if (snap && Date.now() - Date.parse(snap.builtAt) < POD_SNAPSHOT_MAX_AGE_MS) return { snap, stale: false };
  try {
    const feed = await extFetchFeed(def.feedUrl(env));
    const build = podBuildSequence(feed.items, def, feed.channelImageUrl);
    if (!build.entries.length) throw new Error("podcast sequence build produced no entries");
    const builtAt = nowISO();
    // v413 §2.3: the snapshot gains the series' show art +
    // description fold (the channel head's fields).
    const snapFull: PodSnapshot = { entries: build.entries, collapses: build.collapses, builtAt, showImageUrl: feed.channelImageUrl, showDesc: feed.channelDesc };
    const payload = JSON.stringify(snapFull);
    await env.DB.prepare(
      `INSERT INTO podcast_sequences (series, payload, built_at) VALUES (?, ?, ?)
       ON CONFLICT(series) DO UPDATE SET payload = excluded.payload, built_at = excluded.built_at`,
    ).bind(def.key, payload, builtAt).run();
    return { snap: snapFull, stale: false };
  } catch {
    if (snap) return { snap, stale: true };
    return null;
  }
}

interface PodEntryState extends PodEntry { listened: boolean; listenDate: string | null; listenedAt: string | null; source: string | null; positionS: number | null }
interface PodPayload {
  ok: boolean; series: string; title: string; available: boolean;
  entries: PodEntryState[]; currentKey: string | null;
  listenedCount: number; total: number;
  builtAt: string | null; stale: boolean; collapses?: number;
  showImageUrl: string | null; showDesc: string | null;
}
async function podPayload(env: Env, def: PodSeriesDef): Promise<PodPayload> {
  const seq = await podSequence(env, def);
  const r = await env.DB.prepare("SELECT seq_key, listened_at, listen_date, source FROM podcast_listens WHERE series=?")
    .bind(def.key).all<{ seq_key: string; listened_at: string; listen_date: string; source: string }>();
  const listens = new Map((r.results ?? []).map((x) => [x.seq_key, x]));
  // v395 §2.4: the positions fold — the sibling table read beside
  // the listens. positionS surfaces ONLY for unlistened entries,
  // so even a stray row could never paint a position over a
  // check; counts and the derivation below read the listens
  // alone, exactly as before.
  const pr = await env.DB.prepare("SELECT seq_key, position_s FROM podcast_positions WHERE series=?")
    .bind(def.key).all<{ seq_key: string; position_s: number }>();
  const positions = new Map((pr.results ?? []).map((x) => [x.seq_key, x.position_s]));
  if (!seq) {
    return { ok: true, series: def.key, title: def.title, available: false, entries: [], currentKey: null, listenedCount: 0, total: 0, builtAt: null, stale: false, showImageUrl: null, showDesc: null };
  }
  const entries = seq.snap.entries.map((e) => {
    const l = listens.get(e.key);
    return { ...e, listened: !!l, listenDate: l ? l.listen_date : null, listenedAt: l ? l.listened_at : null, source: l ? l.source : null, positionS: l ? null : (positions.get(e.key) ?? null) };
  });
  // §2.3, as amended 2026-11-12 (option A, §2.10): current = the
  // lowest-position unlistened DAY entry (kind "day", or "special"
  // — the Day 366 special is a day); a bonus becomes current only
  // when no unlistened day entry stands. Bonuses list, play, and
  // mark exactly as before — the rule governs derivation only.
  const current = entries.find((e) => !e.listened && e.kind !== "bonus") ?? entries.find((e) => !e.listened);
  return {
    ok: true, series: def.key, title: def.title, available: true,
    entries, currentKey: current ? current.key : null,
    listenedCount: entries.filter((e) => e.listened).length, total: entries.length,
    builtAt: seq.snap.builtAt, stale: seq.stale, collapses: seq.snap.collapses,
    showImageUrl: seq.snap.showImageUrl ?? null, showDesc: seq.snap.showDesc ?? null,
  };
}

// v390 §2.3: the series index read — one entry per registry
// series, in registry order, each built by that series'
// podPayload internals (its counts and derivation), so the
// index and the series pages can never disagree. currentLabel
// is the current entry's label (e.g. "Day 316") so the card
// paints from this one read; null when the series is complete
// or unavailable.
async function podIndexPayload(env: Env): Promise<unknown> {
  const seriesList = [];
  for (const def of POD_SERIES_LIST) {
    const p = await podPayload(env, def);
    const current = p.currentKey ? p.entries.find((e) => e.key === p.currentKey) : undefined;
    seriesList.push({
      series: def.key, title: def.title, available: p.available,
      listenedCount: p.listenedCount, total: p.total,
      currentKey: p.currentKey, currentLabel: current ? current.label : null,
      showImageUrl: p.showImageUrl, showDesc: p.showDesc,
    });
  }
  // v434 §2.1 (F-434-5): the VIDEO series append AFTER the audio
  // loop — CatholicTV's seat, fourth and last, is guaranteed by
  // construction, and the audio entries' order and shape are
  // byte-untouched (they carry no kind field; the video entry
  // carries kind: "video" — F-434-I4's wire form).
  for (const vdef of POD_VIDEO_SERIES_LIST) {
    seriesList.push(await podVideoIndexEntry(env, vdef));
  }
  return { ok: true, seriesList };
}

// ---- Podcasts VIDEO series (v434) ---------------------------------
// Plan §2: a video series is a NEW KIND of entry in the Podcasts
// series list, not a fourth audio def — the audio machinery (the
// day-sequence build, podcast_listens marks, the derived current
// episode, downloads) does not fit a video list and does not apply
// to it. The source is the channel's YouTube uploads feed (Atom),
// read by the Worker into a D1 snapshot on the standing
// read-to-refresh pattern (the podSequence precedent): the read
// path is the refresh path, a failed rebuild serves the standing
// snapshot, no snapshot at all is the series' unavailable surface.
// Streaming only: no downloads, no marks, no positions, no queue.
const YT_CATHOLICTV_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCORAZZmab8apqy2TMHZlZVQ";
const VIDEO_SNAPSHOT_MAX_AGE_MS = 2 * 3600 * 1000;

interface PodVideoSeriesDef {
  key: string; title: string;
  feedUrl: (env: Env) => string;
}
const POD_VIDEO_SERIES_LIST: PodVideoSeriesDef[] = [
  { key: "catholictv", title: "CatholicTV", feedUrl: (env) => env.EXT_YT_CATHOLICTV_FEED_URL || YT_CATHOLICTV_FEED_URL },
];
function podVideoSeriesDef(key: string): PodVideoSeriesDef | null {
  return POD_VIDEO_SERIES_LIST.find((d) => d.key === key) ?? null;
}

interface YtVideo { id: string; title: string; url: string; publishedMs: number; imageUrl: string | null; descText: string | null }

// The Atom parser (§2.2). The standing extParseFeed is RSS 2.0
// only — it throws on a document without <channel>/<item> — and
// the YouTube channel feed is Atom (<feed>/<entry>, yt:videoId,
// media:group thumbnails), so the video path carries its own
// parser under the same regex discipline (extXmlText decoding
// throughout). An entry without a yt:videoId is skipped (it has
// no identity to stand on); a document that yields ZERO entries
// throws — an empty parse is a failed rebuild, never an emptied
// list.
function ytParseFeed(xml: string): YtVideo[] {
  if (!/<feed[\s>]/.test(xml)) throw new Error("video feed parse failed");
  const videos: YtVideo[] = [];
  const entryRe = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml))) {
    const body = m[1];
    const idM = /<yt:videoId>([\s\S]*?)<\/yt:videoId>/.exec(body);
    const id = idM ? extXmlText(idM[1]) : "";
    if (!id) continue;
    const titleM = /<title>([\s\S]*?)<\/title>/.exec(body);
    let url = "";
    const linkM = /<link\b[^>]*rel="alternate"[^>]*>/.exec(body) || /<link\b[^>]*>/.exec(body);
    if (linkM) {
      const hm = /href="([^"]*)"/.exec(linkM[0]);
      if (hm) url = extXmlText(hm[1]);
    }
    if (!url) url = "https://www.youtube.com/watch?v=" + id;
    const pubM = /<published>([\s\S]*?)<\/published>/.exec(body);
    const pubMs = pubM ? Date.parse(pubM[1].trim()) : NaN;
    // The row's thumbnail: the LARGEST media:thumbnail the group
    // carries, referenced from YouTube's image hosts, never
    // re-hosted (v413 §1.3.1's rule).
    let imageUrl: string | null = null;
    let bestW = -1;
    const thRe = /<media:thumbnail\b[^>]*>/g;
    let tm: RegExpExecArray | null;
    while ((tm = thRe.exec(body))) {
      const um = /url="([^"]*)"/.exec(tm[0]);
      if (!um) continue;
      const wm = /width="(\d+)"/.exec(tm[0]);
      const w = wm ? Number(wm[1]) : 0;
      if (w > bestW) { bestW = w; imageUrl = extXmlText(um[1]) || null; }
    }
    const descM = /<media:description>([\s\S]*?)<\/media:description>/.exec(body);
    const descText = descM ? (extStripDesc(descM[1]) || null) : null;
    videos.push({
      id, title: titleM ? extXmlText(titleM[1]) : "", url,
      publishedMs: Number.isFinite(pubMs) ? pubMs : 0,
      imageUrl, descText,
    });
  }
  if (!videos.length) throw new Error("video feed parse produced no entries");
  // Newest first (the feed serves them so; the sort makes the
  // payload honest regardless of the served order).
  videos.sort((a, b) => b.publishedMs - a.publishedMs);
  return videos;
}

async function ytFetchFeedText(url: string): Promise<string> {
  // The standing transport posture (extFetchFeed's): the Worker's
  // own fetch under a 15 s abort — the feed sends no CORS header
  // and the client never touches it (§1.3).
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { "user-agent": "ora-pro-nobis-externals-resolver/1.0" }, signal: ctl.signal });
    if (!res.ok) throw new Error(`feed fetch failed: HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

interface VideoSnapshot { videos: YtVideo[]; builtAt: string }
async function videoReadSnapshot(env: Env, def: PodVideoSeriesDef): Promise<VideoSnapshot | null> {
  const row = await env.DB.prepare("SELECT payload FROM video_snapshots WHERE series=?").bind(def.key).first<{ payload: string }>();
  if (!row) return null;
  try {
    const p = JSON.parse(row.payload) as VideoSnapshot;
    if (!Array.isArray(p.videos) || typeof p.builtAt !== "string") return null;
    return p;
  } catch { return null; }
}
// The read path is the refresh path (§2.2, mirroring podSequence
// clause for clause): fresh snapshot → served, no fetch · stale
// or missing → rebuild attempted; on success the snapshot is
// replaced and served · on failure the standing snapshot is
// served with stale: true · no snapshot at all → null (the
// series' unavailable surface). The refresh triggers are the
// read paths only — the video series payload read and the
// Podcasts index read (podVideoIndexEntry below) — no cron.
async function videoSequence(env: Env, def: PodVideoSeriesDef): Promise<{ snap: VideoSnapshot; stale: boolean } | null> {
  const snap = await videoReadSnapshot(env, def);
  if (snap && Date.now() - Date.parse(snap.builtAt) < VIDEO_SNAPSHOT_MAX_AGE_MS) return { snap, stale: false };
  try {
    const xml = await ytFetchFeedText(def.feedUrl(env));
    const videos = ytParseFeed(xml);
    const builtAt = nowISO();
    const snapFull: VideoSnapshot = { videos, builtAt };
    await env.DB.prepare(
      `INSERT INTO video_snapshots (series, payload, built_at) VALUES (?, ?, ?)
       ON CONFLICT(series) DO UPDATE SET payload = excluded.payload, built_at = excluded.built_at`,
    ).bind(def.key, JSON.stringify(snapFull), builtAt).run();
    return { snap: snapFull, stale: false };
  } catch {
    if (snap) return { snap, stale: true };
    return null;
  }
}

// §2.5: the date form — the published instant rendered
// "Mon D, YYYY" in America/Chicago (the estate's standing
// timezone), built with the tree's standing Intl discipline. A
// Mass posted late Saturday UTC is Saturday's in Chicago, and
// the label says so; the row never shows a raw ISO string or a
// UTC date. Derived at payload build, never stored (a stored
// label would freeze a timezone form into the snapshot).
function videoDateLabel(publishedMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric",
  }).format(new Date(publishedMs));
}

interface PodVideoPayload {
  ok: boolean; kind: "video"; series: string; title: string; available: boolean;
  stale: boolean; builtAt: string | null;
  videos: { id: string; title: string; url: string; publishedMs: number; dateLabel: string; imageUrl: string | null; descText: string | null }[];
}
async function podVideoPayload(env: Env, def: PodVideoSeriesDef): Promise<PodVideoPayload> {
  const seq = await videoSequence(env, def);
  if (!seq) {
    return { ok: true, kind: "video", series: def.key, title: def.title, available: false, stale: false, builtAt: null, videos: [] };
  }
  return {
    ok: true, kind: "video", series: def.key, title: def.title, available: true,
    stale: seq.stale, builtAt: seq.snap.builtAt,
    videos: seq.snap.videos.map((v) => ({
      id: v.id, title: v.title, url: v.url, publishedMs: v.publishedMs,
      dateLabel: videoDateLabel(v.publishedMs), imageUrl: v.imageUrl, descText: v.descText,
    })),
  };
}

// The index entry (§2.1): built from the same videoSequence read
// as the series payload, exactly as the audio index builds each
// audio entry from its own sequence read — the index and the
// series page can never disagree. latestLabel is the newest
// video's dateLabel (§2.5's card meta); showImageUrl is the
// newest video's thumbnail (the freshest honest art the payload
// holds; the client's standing self-removing <img> over the
// navy ♫ tile covers its absence exactly as the audio cards).
async function podVideoIndexEntry(env: Env, def: PodVideoSeriesDef): Promise<unknown> {
  const seq = await videoSequence(env, def);
  const newest = seq && seq.snap.videos.length ? seq.snap.videos[0] : null;
  return {
    kind: "video", series: def.key, title: def.title, available: !!seq,
    latestLabel: newest ? videoDateLabel(newest.publishedMs) : null,
    showImageUrl: newest ? newest.imageUrl : null,
  };
}

// ---- Wallpaper library (v386 §2.3) -----------------------------------
// The accumulating shuffle collection's backend shelf. Production
// stocks image files + one manifest under the R2 prefix wallpaper/
// in the standing AUDIO bucket (B1: no new bucket, no new binding,
// no D1 migration). The manifest shape is §2.2 P2's — the SAME shape
// the Drive library of record carries — so a manifest entry means
// the same thing on both shelves: { name, slug, date, variant, kind,
// sha256, bytes }, identity (name, variant), append-only, a changed
// hash replacing its entry. The phone's wallpaper component reads
// the B3 session surface; production writes through the B2 door
// route. No web delta (B4): nothing here touches client.ts / ui.ts.
interface WallpaperEntry {
  name: string; slug: string; date: string;
  variant: "phone" | "watch"; kind: "saint" | "monthly";
  sha256: string; bytes: number;
}
interface WallpaperManifest { version: 1; updated: string | null; entries: WallpaperEntry[] }

const WALLPAPER_MANIFEST_KEY = "wallpaper/manifest.json";
const WALLPAPER_NAME_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)__(\d{4}-\d{2}-\d{2}|\d{4}-\d{2})\.jpg$/;

function wallpaperKey(variant: string, name: string): string {
  return `wallpaper/${variant}/${name}`;
}

// Validate a (name, variant, kind) triple against the production
// naming contract (§1: "<slug>__<YYYY-MM-DD>.jpg" for a saint set,
// "<slug>__<YYYY-MM>.jpg" for a monthly devotion; the variant is
// carried by the field, never the name). Returns the parsed entry
// fields or null — an unparseable name is never taken into a
// storage key (B3's rule, applied on the write side too).
function wallpaperParse(name: string, variant: string, kind: string):
  { slug: string; date: string; variant: "phone" | "watch"; kind: "saint" | "monthly" } | null {
  if (variant !== "phone" && variant !== "watch") return null;
  if (kind !== "saint" && kind !== "monthly") return null;
  const m = WALLPAPER_NAME_RE.exec(name);
  if (!m) return null;
  const isDaily = m[2].length === 10;
  if (kind === "saint" && !isDaily) return null;
  if (kind === "monthly" && isDaily) return null;
  return { slug: m[1], date: m[2], variant, kind };
}

async function wallpaperManifestRead(env: Env): Promise<WallpaperManifest> {
  const obj = await env.AUDIO.get(WALLPAPER_MANIFEST_KEY);
  if (!obj) return { version: 1, updated: null, entries: [] };
  const parsed = await obj.json().catch(() => null) as WallpaperManifest | null;
  if (!parsed || !Array.isArray(parsed.entries)) return { version: 1, updated: null, entries: [] };
  return { version: 1, updated: parsed.updated ?? null, entries: parsed.entries };
}

async function wallpaperManifestWrite(env: Env, manifest: WallpaperManifest): Promise<void> {
  await env.AUDIO.put(WALLPAPER_MANIFEST_KEY, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json" },
  });
}

// ---- Router ----------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const seg = path.split("/").filter(Boolean);

    // Agent door: this app's own AGENT_TOKEN, scoped to the prayer
    // contract (the midnight job) + the audio intentions push.
    if (seg[0] === "api" && seg[1] === "agent") {
      if (!isAgent(request, env)) return err(403, "agent token required");
      if (seg[2] === "prayer" && seg[3] === "day") {
        if (request.method === "GET") {
          const date = url.searchParams.get("date") ?? prayerChicagoNow().date;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");
          return json(await prayerDayPayload(env, date));
        }
        if (request.method === "POST") {
          const body = await request.json().catch(() => ({})) as { date?: string; addendum?: string };
          const date = String(body.date ?? "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");
          if (typeof body.addendum === "string") {
            await env.DB.prepare(
              `INSERT INTO prayer_addenda (date, text) VALUES (?, ?)
               ON CONFLICT(date) DO UPDATE SET text = excluded.text`,
            ).bind(date, body.addendum).run();
          }
          const draw = await prayerDrawForDate(env, date);
          return json({ ok: true, date, draws: draw.size });
        }
      }
      if (seg[2] === "prayer" && seg[3] === "liturgical-day" && request.method === "POST") {
        // v352 §2.3: the devotional job's step-11 app push — the
        // OFFICIAL liturgical day's name + color for one date
        // (§2.1's pin is the job's derivation; the app stores
        // verbatim). The addenda upsert idiom; a re-push of the
        // same date overwrites (a corrected calendar heals the
        // day). Blue is refused here even if a caller sends it —
        // the accepted set is step 11's: white/red/green/violet/rose.
        const body = await request.json().catch(() => ({})) as { date?: string; dayName?: string; color?: string };
        const date = String(body.date ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");
        const dayName = typeof body.dayName === "string" ? body.dayName.trim() : "";
        if (dayName.length < 1 || dayName.length > 160) return err(400, "dayName must be 1-160 chars");
        const color = String(body.color ?? "");
        if (!["white", "red", "green", "violet", "rose"].includes(color)) return err(400, "color must be one of white, red, green, violet, rose");
        await env.DB.prepare(
          `INSERT INTO prayer_liturgical_days (date, day_name, color, pushed_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET day_name = excluded.day_name, color = excluded.color, pushed_at = excluded.pushed_at`,
        ).bind(date, dayName, color, nowISO()).run();
        return json({ ok: true, date });
      }
      if (seg[2] === "prayer" && seg[3] === "intros" && request.method === "GET") {
        // v337 §2.7: the standing intro family's read-back — the
        // generation's verification surface (episodeId · sizeBytes ·
        // pushedAt per standing intro).
        const r = await env.DB.prepare("SELECT episode_id, size_bytes, pushed_at FROM prayer_intros WHERE date='current' ORDER BY episode_id").all<{ episode_id: string; size_bytes: number; pushed_at: string }>();
        return json({ ok: true, intros: (r.results ?? []).map((x) => ({ episodeId: x.episode_id, sizeBytes: x.size_bytes, pushedAt: x.pushed_at })) });
      }
      if (seg[2] === "player" && seg[3] === "settings" && request.method === "GET") {
        // v328 §2.2 route 3 — the door read the push consumes: the
        // settings + version, read-only. No door write route exists;
        // writes are John's, session-only.
        return json(await sourceSettingsPayload(env));
      }
      if (seg[2] === "player" && seg[3] === "block-order" && request.method === "GET") {
        // v413 §2.2 — the door read of the manual order, read-only
        // parity with the settings door read. No door write route
        // exists; the arrangement is John's, session-only.
        return json({ ok: true, order: await playerBlockOrder(env) });
      }
      if (seg[2] === "player" && seg[3] === "day" && request.method === "GET") {
        // v337 §2.7: the amended step's presented-set read — the
        // same payload the session serves, through the door (the
        // generation iterates the presented own tracks from it and
        // pairs them against the day's draw).
        return json(await playerDayPayload(env));
      }
      if (seg[2] === "player" && seg[3] === "episode" && request.method === "POST") {
        // v368 §2.4: the AI Signal job's hand-off — raw MP3 bytes
        // in, the R2 object + the dated player_episodes row out.
        // Exactly one episode kind registers through this route;
        // any other id refuses 400 (widening it is a later
        // release's Scope, §2 Concern 3). The upsert replaces
        // whole: a re-generated episode heals its day. (The
        // conflict target names block too: migration 0011
        // widened the key to (date, episode_id, block); block is
        // this route's constant, so the replaced row is the
        // same single (date, episode) row.) The job's
        // success test is sizeBytes equal to the MP3's byte size
        // on disk.
        const episodeId = request.headers.get("x-episode-id") ?? "";
        if (episodeId !== "the-ai-signal") return err(400, "episode id must be the-ai-signal");
        const epDate = request.headers.get("x-episode-date") ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(epDate)) return err(400, "date must be YYYY-MM-DD");
        const epTitle = (request.headers.get("x-episode-title") ?? "").trim();
        if (epTitle.length < 1 || epTitle.length > 160) return err(400, "title must be 1-160 chars");
        let epDuration = 0;
        const durRaw = request.headers.get("x-duration-s");
        if (durRaw !== null && durRaw.trim() !== "") {
          epDuration = Number(durRaw);
          if (!isFinite(epDuration) || epDuration < 0) return err(400, "duration must be numeric >= 0");
        }
        const epBody = await request.arrayBuffer();
        if (epBody.byteLength > 25 * 1024 * 1024) return err(400, "episode too large");
        const epKey = `episodes/${epDate}/the-ai-signal.mp3`;
        await env.AUDIO.put(epKey, epBody, { httpMetadata: { contentType: "audio/mpeg" } });
        await env.DB.prepare(
          `INSERT INTO player_episodes (date, episode_id, title, block, sort, duration_s, r2_key, size_bytes, audio_state, pushed_at)
           VALUES (?, 'the-ai-signal', ?, 'The AI Signal', 1, ?, ?, ?, 'present', ?)
           ON CONFLICT(date, episode_id, block) DO UPDATE SET title = excluded.title, duration_s = excluded.duration_s,
             r2_key = excluded.r2_key, size_bytes = excluded.size_bytes, audio_state = excluded.audio_state, pushed_at = excluded.pushed_at`,
        ).bind(epDate, epTitle, epDuration, epKey, epBody.byteLength, nowISO()).run();
        return json({ ok: true, date: epDate, episodeId, sizeBytes: epBody.byteLength });
      }
      if (seg[2] === "podcasts" && seg[3] === "progress" && request.method === "GET") {
        // v381 §2.2: the door's read-only progress read (mirrors
        // GET /api/agent/player/day) so Review/Ship can verify
        // progress state. NO agent write route exists — marks are
        // John's acts, session-only.
        // v390 §2.3: mirrors the session reads — no ?series gives
        // the index payload; ?series=<key> gives that series'
        // payload; an unknown series answers 400.
        const doorSeries = url.searchParams.get("series");
        if (doorSeries === null) return json(await podIndexPayload(env));
        // v434 §2.1: the door read mirrors the session read — a
        // VIDEO series key routes to the video payload builder
        // before the audio def lookup.
        const doorVideoDef = podVideoSeriesDef(doorSeries);
        if (doorVideoDef) return json(await podVideoPayload(env, doorVideoDef));
        const doorDef = podSeriesDef(doorSeries);
        if (!doorDef) return err(400, "unknown series");
        return json(await podPayload(env, doorDef));
      }
      if (seg[2] === "wallpaper" && seg[3] === "stock" && request.method === "POST") {
        // v386 §2.3 B2: the production stocking route (the v368
        // episode pattern — raw bytes in, verified before anything
        // is stored). Query fields name the image; the body's
        // SHA-256 and length must match them or the call is refused
        // and NOTHING is stored. On a match the R2 object is
        // written and the entry upserted into wallpaper/manifest.json
        // in the same request. A repeat of the same
        // (name, variant, sha256) changes nothing (P3 idempotence).
        const wName = url.searchParams.get("name") ?? "";
        const wVariant = url.searchParams.get("variant") ?? "";
        const wKind = url.searchParams.get("kind") ?? "";
        const wSha = (url.searchParams.get("sha256") ?? "").toLowerCase();
        const parsed = wallpaperParse(wName, wVariant, wKind);
        if (!parsed) return err(400, "name, variant and kind must match the wallpaper naming contract");
        if (!/^[0-9a-f]{64}$/.test(wSha)) return err(400, "sha256 must be 64 hex chars");
        const wBody = await request.arrayBuffer();
        if (wBody.byteLength < 1 || wBody.byteLength > 25 * 1024 * 1024) return err(400, "image size out of range");
        const digest = await crypto.subtle.digest("SHA-256", wBody);
        const actualSha = bytesToHex(new Uint8Array(digest));
        if (actualSha !== wSha) return err(400, "sha256 mismatch — nothing stored");
        const manifest = await wallpaperManifestRead(env);
        const existing = manifest.entries.find((e) => e.name === wName && e.variant === parsed.variant);
        if (existing && existing.sha256 === wSha && existing.bytes === wBody.byteLength) {
          return json({ ok: true, unchanged: true, entry: existing });
        }
        await env.AUDIO.put(wallpaperKey(parsed.variant, wName), wBody, {
          httpMetadata: { contentType: "image/jpeg" },
        });
        const entry: WallpaperEntry = {
          name: wName, slug: parsed.slug, date: parsed.date,
          variant: parsed.variant, kind: parsed.kind,
          sha256: wSha, bytes: wBody.byteLength,
        };
        manifest.entries = manifest.entries.filter((e) => !(e.name === wName && e.variant === parsed.variant));
        manifest.entries.push(entry);
        manifest.entries.sort((a, b) => (a.variant + "/" + a.name).localeCompare(b.variant + "/" + b.name));
        manifest.updated = nowISO();
        await wallpaperManifestWrite(env, manifest);
        return json({ ok: true, unchanged: false, entry });
      }
      return err(404, "unknown agent route");
    }

    // Everything else is John's session surface. The day-payload GET
    // also accepts the agent token (the job's read path, Plan step 3).
    const agentDayRead = seg[0] === "api" && seg[1] === "prayer" && seg[2] === "day" && request.method === "GET" && isAgent(request, env);
    if (!agentDayRead) {
      const denied = johnOnly(request, env);
      if (denied) return denied;
    }

    try {
      if (seg[0] === "api" && seg[1] === "prayer") {
        const { date: pToday } = prayerChicagoNow();
        if (seg[2] === "redraw" && request.method === "POST") {
          // v426 §2.3: the manual whole-day re-draw. No body; the
          // date is always today (Chicago), never client-supplied.
          // John's session surface only — this block stands inside
          // the johnOnly gate and the agent-token day-read exemption
          // is NOT extended to it. On failure the standing draw is
          // restored row for row by prayerRedrawForDate itself.
          try {
            await prayerRedrawForDate(env, pToday);
            const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM prayer_draws WHERE date=?").bind(pToday).first<{ n: number }>();
            return json({ ok: true, date: pToday, drawn: cnt?.n ?? 0 });
          } catch {
            return err(500, "redraw failed — the standing draw stands");
          }
        }
        if (seg[2] === "day" && request.method === "GET") {
          const date = url.searchParams.get("date") ?? pToday;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");
          return json(await prayerDayPayload(env, date));
        }
        if (seg[2] === "intentions" && !seg[3] && request.method === "GET") {
          const r = await env.DB.prepare(
            `SELECT i.*, COALESCE(d.drawn, 0) AS drawn_count, d.last_drawn
             FROM prayer_intentions i
             LEFT JOIN (SELECT intention_id, COUNT(*) AS drawn, MAX(date) AS last_drawn FROM prayer_draws GROUP BY intention_id) d ON d.intention_id = i.id
             ORDER BY CASE i.status WHEN 'active' THEN 0 ELSE 1 END, CASE i.priority WHEN 'H' THEN 0 WHEN 'M' THEN 1 ELSE 2 END, i.id`,
          ).all<PrayerIntentionRow & { drawn_count: number; last_drawn: string | null }>();
          const intentions = (r.results ?? []).map((i) => ({ ...i, drawnCount: i.drawn_count, lastDrawn: i.last_drawn }));
          return json({ ok: true, intentions });
        }
        if (seg[2] === "intentions" && !seg[3] && request.method === "POST") {
          const body = await request.json().catch(() => ({})) as { text?: string; priority?: string };
          const text = typeof body.text === "string" ? body.text.trim() : "";
          if (!text) return err(400, "text required");
          const priority = ["H", "M", "L"].includes(body.priority ?? "") ? body.priority! : "M";
          const r = await env.DB.prepare(
            "INSERT INTO prayer_intentions (text, priority, status, created_at) VALUES (?, ?, 'active', ?) RETURNING id",
          ).bind(text, priority, nowISO()).first<{ id: number }>();
          // v426 §2.4: the add auto-redraws today inside its own
          // request (John's ruling retires the v58 rule). The add
          // stands even if the redraw fails — redrawn says which.
          const redrawn = await prayerTryRedraw(env, pToday);
          return json({ ok: true, id: r?.id, redrawn }, 201);
        }
        const pIntMatch = seg[2] === "intentions" && seg[3] ? /^(\d+)$/.exec(seg[3]) : null;
        if (pIntMatch && seg[4] === "status" && request.method === "POST") {
          const body = await request.json().catch(() => ({})) as { status?: string };
          if (!["active", "retired"].includes(body.status ?? "")) return err(400, "bad status");
          const id = Number(pIntMatch[1]);
          await env.DB.prepare("UPDATE prayer_intentions SET status=? WHERE id=?").bind(body.status, id).run();
          if (body.status === "retired") {
            // v426 §2.4 / F-426-I3: the standing wider removal
            // deletion (date >= today) stands, in its standing
            // order, BEFORE the whole-day redraw that supersedes
            // the handler's standing partial refill.
            await env.DB.prepare("DELETE FROM prayer_draws WHERE intention_id=? AND date>=?").bind(id, pToday).run();
          }
          // Retire and restore both auto-redraw today (§2.4): the
          // retired intention leaves today's lines entirely; a
          // restored one can be seated in them again at once.
          const redrawn = await prayerTryRedraw(env, pToday);
          return json({ ok: true, redrawn });
        }
        if (pIntMatch && request.method === "PATCH") {
          const body = await request.json().catch(() => ({})) as { text?: string; priority?: string };
          const priority = body.priority !== undefined
            ? (["H", "M", "L"].includes(body.priority) ? body.priority : null)
            : undefined;
          if (priority === null) return err(400, "bad priority");
          await env.DB.prepare("UPDATE prayer_intentions SET text=COALESCE(?, text), priority=COALESCE(?, priority) WHERE id=?")
            .bind(typeof body.text === "string" ? body.text : null, priority ?? null, Number(pIntMatch[1])).run();
          // v426 §2.4: priority is a draw input — an edit re-runs
          // today's draw inside its own request.
          const redrawn = await prayerTryRedraw(env, pToday);
          return json({ ok: true, redrawn });
        }
        if (pIntMatch && request.method === "DELETE") {
          const id = Number(pIntMatch[1]);
          await env.DB.batch([
            env.DB.prepare("DELETE FROM prayer_draws WHERE intention_id=?").bind(id),
            env.DB.prepare("DELETE FROM prayer_intentions WHERE id=?").bind(id),
          ]);
          // v426 §2.4 / F-426-I3: the standing all-dates removal
          // deletion stands above; the whole-day redraw supersedes
          // the handler's standing refill.
          const redrawn = await prayerTryRedraw(env, pToday);
          return json({ ok: true, redrawn });
        }
        if (seg[2] === "audio" && request.method === "GET") {
          const date = seg[3] ?? "";
          const block = decodeURIComponent(seg[4] ?? "");
          // v335 §2.3: the standing name /api/prayer/audio/current/<Block>
          // is served by the same widened pattern; dated serving stands.
          // v342 §2.6(3): the 'current' standing-segment route is
          // RETIRED — intention audio is served from the intentions
          // feed's enclosures now. The literal names no segment.
          if (date === "current") return err(404, "no segment for that block and date");
          if (!/^(\d{4}-\d{2}-\d{2}|current)$/.test(date) || !PRAYER_BLOCKS.includes(block as typeof PRAYER_BLOCKS[number])) return err(400, "bad audio path");
          const row = await env.DB.prepare("SELECT r2_key FROM prayer_audio WHERE date=? AND block=?").bind(date, block).first<{ r2_key: string }>();
          if (!row) return err(404, "no segment for that block and date");
          // v336 Implement DEVIATION (see §3): the segment route
          // gains the episode route's exact Range passthrough.
          // §2.5 assumed a full-body 200 makes in-buffer scrubs
          // land; measured on the landed route, Chrome exposes
          // seekable 0-0 without Accept-Ranges, so no segment
          // scrub could ever land (leg 9 unpassable as pinned).
          // The route now answers ranged reads exactly like
          // /api/player/audio does; the body, the key, and the
          // cache rule are unchanged.
          const rangeHdr = request.headers.get("range");
          let range: R2Range | undefined = undefined;
          if (rangeHdr) {
            const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHdr.trim());
            if (m && (m[1] || m[2])) {
              if (m[1] === "") range = { suffix: Number(m[2]) };
              else if (m[2] === "") range = { offset: Number(m[1]) };
              else range = { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 };
            }
          }
          const obj = range ? await env.AUDIO.get(row.r2_key, { range }) : await env.AUDIO.get(row.r2_key);
          if (!obj) return err(404, "segment missing from the store");
          const headers: Record<string, string> = {
            "content-type": "audio/mpeg", "cache-control": "private, max-age=3600", "accept-ranges": "bytes",
          };
          if (range && obj.range) {
            const total = obj.size;
            const offset = obj.range.offset ?? (obj.range.suffix !== undefined ? total - (obj.range.length ?? obj.range.suffix) : 0);
            const length = obj.range.length ?? (total - offset);
            headers["content-range"] = `bytes ${offset}-${offset + length - 1}/${total}`;
            headers["content-length"] = String(length);
            return new Response(obj.body, { status: 206, headers });
          }
          headers["content-length"] = String(obj.size);
          return new Response(obj.body, { headers });
        }
        return err(404, "unknown prayer route");
      }

      if (seg[0] === "api" && seg[1] === "player") {
        if (seg[2] === "day" && request.method === "GET") {
          // v337 §2.1(5): serves the PRESENTED (Chicago calendar)
          // day. v392 W1: a ?date= naming Chicago today or
          // tomorrow presents that day (the offline build fetches
          // tomorrow's shell during today's online hours); any
          // other value answers 400. Absent the parameter the
          // payload is byte-identical to the standing shape.
          const dateParam = url.searchParams.get("date");
          if (dateParam !== null) {
            const today = prayerChicagoNow().date;
            if (dateParam !== today && dateParam !== chicagoShiftDate(today, 1)) {
              return err(400, "date must be today or tomorrow");
            }
            return json(await playerDayPayload(env, dateParam));
          }
          return json(await playerDayPayload(env));
        }
        if (seg[2] === "podcasts" && request.method === "GET") {
          // v381 §2.2: the Podcasts tab's read — the sequence
          // with each entry's listened state, the derived current
          // key (§2.3), and counts.
          // v390 §2.3: no ?series answers the series INDEX (the
          // tab's entry read); ?series=<key> answers that series'
          // payload in the standing shape; an unknown series
          // answers 400.
          const readSeries = url.searchParams.get("series");
          if (readSeries === null) return json(await podIndexPayload(env));
          // v434 §2.1: a VIDEO series key routes to the video
          // payload builder BEFORE the audio def lookup; an
          // unknown key keeps the base behavior exactly.
          const readVideoDef = podVideoSeriesDef(readSeries);
          if (readVideoDef) return json(await podVideoPayload(env, readVideoDef));
          const readDef = podSeriesDef(readSeries);
          if (!readDef) return err(400, "unknown series");
          return json(await podPayload(env, readDef));
        }
        if (seg[2] === "podcasts" && seg[3] === "mark" && request.method === "POST") {
          // v381 §2.2/§2.4: a mark is John's act (session-only).
          // Idempotent: INSERT OR IGNORE — the first mark stands
          // (its date and source are the history).
          // v390 §2.3: the series is validated against the
          // registry (any of the three; anything else 400), the
          // source whitelist stays auto/manual only (seed never
          // passes this route — §2.5), and the seqKey validates
          // against THAT series' snapshot.
          const body = await request.json().catch(() => ({})) as { series?: string; seqKey?: string; source?: string };
          const markDef = podSeriesDef(String(body.series ?? ""));
          if (!markDef) return err(400, "unknown series");
          if (!["auto", "manual"].includes(body.source ?? "")) return err(400, "source must be auto or manual");
          const seqKey = String(body.seqKey ?? "");
          const seq = await podSequence(env, markDef);
          if (!seq || !seq.snap.entries.some((e) => e.key === seqKey)) return err(400, "unknown seqKey");
          await env.DB.prepare(
            "INSERT OR IGNORE INTO podcast_listens (series, seq_key, listened_at, listen_date, source) VALUES (?, ?, ?, ?, ?)",
          ).bind(markDef.key, seqKey, nowISO(), prayerChicagoNow().date, String(body.source)).run();
          // v395 §2.5 (D5): clearing rides the mark route itself —
          // both sources flow through this one handler, so the
          // auto-mark on 'ended' clears by construction. The
          // listens write stands first, the position delete
          // second; no percentage test stands anywhere in this
          // path (the standing law).
          await env.DB.prepare("DELETE FROM podcast_positions WHERE series=? AND seq_key=?")
            .bind(markDef.key, seqKey).run();
          return json({ ok: true });
        }
        if (seg[2] === "podcasts" && seg[3] === "unmark" && request.method === "POST") {
          // v381 §2.2: unmark deletes the row (a progress record,
          // not an audit log); unmarking an unmarked entry is a
          // no-op.
          // v390 §2.3: the series validates against the registry,
          // and the delete binds the named series.
          const body = await request.json().catch(() => ({})) as { series?: string; seqKey?: string };
          const unmarkDef = podSeriesDef(String(body.series ?? ""));
          if (!unmarkDef) return err(400, "unknown series");
          await env.DB.prepare("DELETE FROM podcast_listens WHERE series=? AND seq_key=?")
            .bind(unmarkDef.key, String(body.seqKey ?? "")).run();
          // v395 §2.5 (D5): unmark wipes the episode's whole
          // progress record — the sibling position row deletes
          // beside the listen row, in the same act.
          await env.DB.prepare("DELETE FROM podcast_positions WHERE series=? AND seq_key=?")
            .bind(unmarkDef.key, String(body.seqKey ?? "")).run();
          return json({ ok: true });
        }
        if (seg[2] === "podcasts" && seg[3] === "position" && request.method === "POST") {
          // v395 §2.3: the position save — John's act, session-only
          // like the marks; the agent door gains no position
          // surface. Validation stands in the mark route's exact
          // order: the series against the registry, the seqKey
          // against that series' snapshot. The position clamps to
          // the SNAPSHOT entry's own duration — the server trusts
          // its snapshot for duration, never the client's claim;
          // an entry with no standing duration stores the position
          // as sent (§1's named case: the position still saves and
          // resume still lands on the saved second). A save naming
          // a LISTENED episode stores nothing and still answers ok
          // — a stale client tick can never resurrect a position
          // over a finished episode. A save whose clamped position
          // is 0 deletes any standing row instead of storing a zero
          // row: zero is "not started," and the row's absence is
          // that same fact. The write is an upsert; newest arrival
          // wins (the marks' last-writer-wins posture).
          const body = await request.json().catch(() => ({})) as { series?: string; seqKey?: string; positionS?: number; durationS?: number };
          const posDef = podSeriesDef(String(body.series ?? ""));
          if (!posDef) return err(400, "unknown series");
          const posSeqKey = String(body.seqKey ?? "");
          const posSeq = await podSequence(env, posDef);
          const posEntry = posSeq ? posSeq.snap.entries.find((e) => e.key === posSeqKey) : undefined;
          if (!posEntry) return err(400, "unknown seqKey");
          const posListen = await env.DB.prepare("SELECT seq_key FROM podcast_listens WHERE series=? AND seq_key=?")
            .bind(posDef.key, posSeqKey).first<{ seq_key: string }>();
          if (posListen) return json({ ok: true });
          let posVal = Math.floor(Number(body.positionS ?? 0));
          if (!Number.isFinite(posVal) || posVal < 0) posVal = 0;
          if (posEntry.durationS > 0 && posVal > posEntry.durationS) posVal = posEntry.durationS;
          if (posVal === 0) {
            await env.DB.prepare("DELETE FROM podcast_positions WHERE series=? AND seq_key=?")
              .bind(posDef.key, posSeqKey).run();
            return json({ ok: true });
          }
          let posDur = posEntry.durationS > 0 ? posEntry.durationS : Math.floor(Number(body.durationS ?? 0));
          if (!Number.isFinite(posDur) || posDur < 0) posDur = 0;
          await env.DB.prepare(
            `INSERT INTO podcast_positions (series, seq_key, position_s, duration_s, updated_at) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(series, seq_key) DO UPDATE SET position_s=excluded.position_s, duration_s=excluded.duration_s, updated_at=excluded.updated_at`,
          ).bind(posDef.key, posSeqKey, posVal, posDur, nowISO()).run();
          return json({ ok: true });
        }
        if (seg[2] === "day-position" && request.method === "POST") {
          // v412 Fix 10: the day-position save — the day mirror of
          // the podcast position route above, session-only like it.
          // The row keys on (date, episode_id): the date is the
          // track's presented day, sent by the client and validated
          // to the date shape (an absent or malformed date falls
          // back to the Chicago calendar day — the presented day
          // the payload itself serves). The position clamps to the
          // duration the client saved against when one stands (the
          // day store has no snapshot to trust instead — §2.8's
          // mirror carries the client's duration, as the podcast
          // route does for duration-less entries). A position of 0
          // deletes any standing row instead of storing a zero row:
          // zero is "not started" — and it is how the ended
          // handler clears a finished prayer's position. The write
          // is an upsert; newest arrival wins.
          const body = await request.json().catch(() => ({})) as { episodeId?: string; date?: string; positionS?: number; durationS?: number };
          const dayEpId = String(body.episodeId ?? "");
          if (!dayEpId || dayEpId.length > 200) return err(400, "bad episodeId");
          const dayDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? "")) ? String(body.date) : prayerChicagoNow().date;
          let dayPosVal = Math.floor(Number(body.positionS ?? 0));
          if (!Number.isFinite(dayPosVal) || dayPosVal < 0) dayPosVal = 0;
          let dayPosDur = Math.floor(Number(body.durationS ?? 0));
          if (!Number.isFinite(dayPosDur) || dayPosDur < 0) dayPosDur = 0;
          if (dayPosDur > 0 && dayPosVal > dayPosDur) dayPosVal = dayPosDur;
          if (dayPosVal === 0) {
            await env.DB.prepare("DELETE FROM day_positions WHERE date=? AND episode_id=?")
              .bind(dayDate, dayEpId).run();
            return json({ ok: true });
          }
          await env.DB.prepare(
            `INSERT INTO day_positions (date, episode_id, position_s, duration_s, updated_at) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(date, episode_id) DO UPDATE SET position_s=excluded.position_s, duration_s=excluded.duration_s, updated_at=excluded.updated_at`,
          ).bind(dayDate, dayEpId, dayPosVal, dayPosDur, nowISO()).run();
          return json({ ok: true });
        }
        if (seg[2] === "audio" && request.method === "GET") {
          // Episode audio from the app store, with Range passthrough
          // (lock-screen seek depends on ranged reads, Plan E3/E6).
          const date = seg[3] ?? "";
          const episodeId = decodeURIComponent(seg[4] ?? "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !episodeId) return err(400, "bad audio path");
          const row = await env.DB.prepare("SELECT r2_key, audio_state FROM player_episodes WHERE date=? AND episode_id=?")
            .bind(date, episodeId).first<{ r2_key: string; audio_state: string }>();
          if (!row) return err(404, "no episode for that date and id");
          if (row.audio_state !== "present" || !row.r2_key) return err(404, "episode audio not available in the app yet");
          const rangeHdr = request.headers.get("range");
          let range: R2Range | undefined = undefined;
          if (rangeHdr) {
            const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHdr.trim());
            if (m && (m[1] || m[2])) {
              if (m[1] === "") range = { suffix: Number(m[2]) };
              else if (m[2] === "") range = { offset: Number(m[1]) };
              else range = { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 };
            }
          }
          const obj = range ? await env.AUDIO.get(row.r2_key, { range }) : await env.AUDIO.get(row.r2_key);
          if (!obj) return err(404, "episode audio missing from the store");
          const headers: Record<string, string> = {
            "content-type": "audio/mpeg", "cache-control": "private, max-age=3600", "accept-ranges": "bytes",
          };
          if (range && obj.range) {
            const total = obj.size;
            const offset = obj.range.offset ?? (obj.range.suffix !== undefined ? total - (obj.range.length ?? obj.range.suffix) : 0);
            const length = obj.range.length ?? (total - offset);
            headers["content-range"] = `bytes ${offset}-${offset + length - 1}/${total}`;
            headers["content-length"] = String(length);
            return new Response(obj.body, { status: 206, headers });
          }
          headers["content-length"] = String(obj.size);
          return new Response(obj.body, { headers });
        }
        if (seg[2] === "text" && request.method === "GET") {
          // v318 T9: the episode's read-along text — a named 404
          // when the object is absent, never a silent empty body.
          // v342 §2.4 ruling 3: the gate is the R2 EXISTENCE of
          // texts/<date>/<episode_id>.txt — the player_episodes
          // row lookup is deleted with the stored-day model; the
          // publish tail stages the object at publish (§2.4
          // ruling 1). Path validation stands as built.
          const date = seg[3] ?? "";
          const episodeId = decodeURIComponent(seg[4] ?? "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !episodeId) return err(400, "bad text path");
          const obj = await env.AUDIO.get(`texts/${date}/${episodeId}.txt`);
          if (!obj) return err(404, "episode text not available in the app yet");
          return new Response(obj.body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, max-age=3600" } });
        }
        if (seg[2] === "sources" && request.method === "GET") {
          const r = await env.DB.prepare("SELECT * FROM player_sources ORDER BY sort, id").all();
          return json({ ok: true, sources: r.results ?? [] });
        }
        if (seg[2] === "sources" && request.method === "PUT") {
          const body = await request.json().catch(() => ({})) as { sources?: { id?: number; block?: string; title?: string; source_kind?: string; rss_url?: string; spotify_url?: string; sort?: number }[] };
          if (!Array.isArray(body.sources)) return err(400, "sources required");
          const stmts: D1PreparedStatement[] = [];
          for (const s of body.sources) {
            if (!s.id) continue;
            if (!["segment", "rss", "playlist"].includes(s.source_kind ?? "")) return err(400, "bad source_kind");
            stmts.push(env.DB.prepare("UPDATE player_sources SET block=?, title=?, source_kind=?, rss_url=?, spotify_url=?, sort=? WHERE id=?")
              .bind(s.block ?? "", s.title ?? "", s.source_kind, s.rss_url ?? "", s.spotify_url ?? "", s.sort ?? 0, s.id));
          }
          if (stmts.length) await env.DB.batch(stmts);
          return json({ ok: true });
        }
        if (seg[2] === "externals" && seg[3] === "live" && request.method === "GET") {
          // v334 §2.2 — the courier: session-only (this whole surface
          // stands behind johnOnly), fetches the Divine Office feed
          // at this moment, matches in-request, stores nothing.
          // Cache-Control is HTTP response reuse on the device
          // (300 s), not a server-side cache: the server keeps
          // nothing. v337 §2.4: the gate re-keys from the stored day
          // to the PRESENTED day — the calendar day is the only
          // resolvable day.
          const date = url.searchParams.get("date") ?? "";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");
          // v392 W1/W3: the window widens to Chicago today or
          // tomorrow — the offline completeness pass resolves
          // tomorrow's externals during today's online hours so
          // tomorrow's set can stand on the phone before its day
          // (D3). Consumption still presents only today; this is
          // a download-ahead read, gated exactly as the W1 day
          // route. Any other date answers 400.
          const presented = prayerChicagoNow().date;
          if (date !== presented && date !== chicagoShiftDate(presented, 1)) return err(400, `date ${date} is not the presented day ${presented} or its tomorrow`);
          const payload = await externalsLivePayload(env, date);
          return new Response(JSON.stringify({ ok: true, date, ...payload }), {
            status: 200,
            headers: { "content-type": "application/json", "cache-control": "private, max-age=300" },
          });
        }
        if (seg[2] === "externals" && seg[3] === "audio" && request.method === "GET") {
          // v334 Amendment A1 — the audio pass-through (John,
          // 2026-11-09 04:32 CT: "Download always"): for a source
          // whose enclosure host forbids browser reads (Sing the
          // Hours — episodes.castos.com sends no CORS header), the
          // Worker resolves the slot server-side, fetches the
          // enclosure, and streams it through so the phone can save
          // it from its own Worker. The Worker keeps NOTHING: no D1
          // write, no R2 write, no retained state.
          const date = url.searchParams.get("date") ?? "";
          const slotId = url.searchParams.get("slot") ?? "";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");
          if (!(slotId in EXTERNAL_SLOTS)) return err(400, "unknown external slot");
          // v392 W1/W3: the today-or-tomorrow window, as on the
          // live route — tomorrow's pass-through downloads ride
          // the same download-ahead read (D3).
          const presented = prayerChicagoNow().date;
          if (date !== presented && date !== chicagoShiftDate(presented, 1)) return err(400, `date ${date} is not the presented day ${presented} or its tomorrow`);
          const settings = await sourceSettingsPayload(env);
          const [yy, mm, dd] = date.split("-").map(Number);
          const wdMon0 = (new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay() + 6) % 7;
          const primRow = settings.sources.find((s) => s.family === "external" && s.slotId === slotId && s.role !== "fallback");
          if (!primRow || primRow.enabled !== 1 || !extDayRulePasses(primRow.dayRule || "daily", wdMon0)) {
            return err(404, "slot does not stand under the current settings");
          }
          let item: ExtFeedItem | null = null;
          try {
            if (slotId === "ext-bible-in-a-year") {
              item = extMatchBible(await extFetchFeedItems(env.EXT_BIAY_FEED_URL || EXT_BIAY_FEED_URL), yy, mm, dd);
            } else if (slotId === "ext-gospel-exegesis") {
              // v337 §2.8: pass-through parity for the Exegesis port
              // — the same pick the client makes, from the same feed.
              item = extMatchLatestByDate(await extFetchFeedItems(env.EXT_DGE_FEED_URL || EXT_DGE_FEED_URL), yy, mm, dd);
            } else if (slotId === "ext-saint-of-the-day") {
              // v337 §2.8: pass-through parity for the Saint port.
              item = extMatchSaint(await extFetchFeedItems(env.EXT_SAINT_FEED_URL || EXT_SAINT_FEED_URL), yy, mm, dd);
            } else if (slotId === "ext-usccb-readings") {
              // v339 §2.3: pass-through parity for the Readings
              // port — the same title-date pick the courier makes.
              item = extMatchUsccb(await extFetchFeedItems(env.EXT_USCCB_FEED_URL || EXT_USCCB_FEED_URL), yy, mm, dd);
            } else if (slotId === "ext-daily-tv-mass") {
              // v339 §2.3: pass-through parity for the TV Mass
              // port — the same title/date pick the client makes.
              item = extMatchTvMass(await extFetchFeedItems(env.EXT_TVMASS_FEED_URL || EXT_TVMASS_FEED_URL), yy, mm, dd);
            } else if (slotId === "ext-fr-mike-homily") {
              // v339 §2.3: pass-through parity — latest by
              // release date, Sunday's item standing Mon–Sat.
              item = extMatchLatestByDate(await extFetchFeedItems(env.EXT_FRMIKE_FEED_URL || EXT_FRMIKE_FEED_URL), yy, mm, dd);
            } else if (slotId === "ext-barron-sermon") {
              // v339 §2.3: pass-through parity — latest by
              // release date; the feed fetch sends the browser
              // user-agent (a bare resolver UA drew 403).
              item = extMatchLatestByDate(await extFetchFeedItems(env.EXT_BARRON_FEED_URL || EXT_BARRON_FEED_URL, EXT_BROWSER_UA), yy, mm, dd);
            } else {
              const doSlot = EXT_DO_SLOTS.find((s) => s.slotId === slotId);
              if (doSlot) {
                const matches = extMatchDivineOffice(await extFetchFeedItems(env.EXT_DO_FEED_URL || EXT_DO_FEED_URL), yy, mm, dd);
                item = matches.get(slotId) ?? null;
                if (!item) {
                  const fbRow = settings.sources.find((s) => s.family === "external" && s.slotId === slotId && s.role === "fallback");
                  const token = slotId === "ext-morning-prayer" ? "Lauds" : slotId === "ext-evening-prayer" ? "Vespers" : null;
                  const fills = fbRow && fbRow.enabled === 1 && (fbRow.dayRule === "fallback-only" || extDayRulePasses(fbRow.dayRule || "daily", wdMon0));
                  if (token && fills) item = extMatchSth(await extFetchFeedItems(env.EXT_STH_FEED_URL || EXT_STH_FEED_URL), yy, mm, dd, token);
                }
              }
            }
          } catch { return err(502, "feed fetch failed"); }
          if (!item || !item.url) return err(404, "no episode resolved for that slot today");
          // v339 §2.3: the Barron enclosure fetch carries the
          // browser user-agent too (the same source family that
          // refused the bare UA on the feed).
          const fwd: Record<string, string> = { "user-agent": slotId === "ext-barron-sermon" ? EXT_BROWSER_UA : "ora-pro-nobis-externals-resolver/1.0" };
          const range = request.headers.get("range");
          if (range) fwd["range"] = range;
          let audioRes: Response;
          try {
            audioRes = await fetch(item.url, { headers: fwd });
          } catch { return err(502, "enclosure fetch failed"); }
          if (!audioRes.ok && audioRes.status !== 206) return err(502, `enclosure fetch failed: HTTP ${audioRes.status}`);
          const headers: Record<string, string> = {
            "content-type": audioRes.headers.get("content-type") || "audio/mpeg",
            "cache-control": "private, no-store",
          };
          for (const h of ["content-length", "accept-ranges", "content-range"]) {
            const v = audioRes.headers.get(h);
            if (v) headers[h] = v;
          }
          return new Response(audioRes.body, { status: audioRes.status, headers });
        }
        if (seg[2] === "feed-audio" && request.method === "GET") {
          // v342 §2.3: the own + intention download pass-through.
          // The enclosure host (audio.orapronobis.media) sends NO
          // CORS header and refuses preflight (probes P2/P3), so —
          // the v334 posture — playback streams DIRECT from the
          // enclosure URL while DOWNLOADS route through here: the
          // Worker fetches the enclosure server-side and streams
          // it, stores NOTHING, keeps no day state. Range honored
          // with the episode route's passthrough discipline. The
          // host pin is the one-fetch-no-standing-posture: only
          // the own/intention audio host is proxied (under
          // LOCAL_DEV the harness fixtures stand on localhost and
          // any http(s) host is allowed).
          const raw = url.searchParams.get("url") ?? "";
          let target: URL;
          try { target = new URL(raw); } catch { return err(400, "bad feed audio url"); }
          const localOk = env.LOCAL_DEV === "1" && (target.protocol === "http:" || target.protocol === "https:");
          if (!localOk && !(target.protocol === "https:" && target.hostname === "audio.orapronobis.media")) {
            return err(400, "feed audio url must be on the audio host");
          }
          const fwd: Record<string, string> = { "user-agent": "ora-pro-nobis-feed-audio/1.0" };
          const range = request.headers.get("range");
          if (range) fwd["range"] = range;
          let audioRes: Response;
          try {
            audioRes = await fetch(target.toString(), { headers: fwd });
          } catch { return err(502, "enclosure fetch failed"); }
          if (!audioRes.ok && audioRes.status !== 206) return err(502, `enclosure fetch failed: HTTP ${audioRes.status}`);
          const headers: Record<string, string> = {
            "content-type": audioRes.headers.get("content-type") || "audio/mpeg",
            "cache-control": "private, no-store",
          };
          for (const h of ["content-length", "accept-ranges", "content-range"]) {
            const v = audioRes.headers.get(h);
            if (v) headers[h] = v;
          }
          return new Response(audioRes.body, { status: audioRes.status, headers });
        }
        if (seg[2] === "block-order" && request.method === "GET") {
          // v413 §2.2 — the manual-order read: the identical body
          // to the door read ({ order: string[] | null }).
          return json({ ok: true, order: await playerBlockOrder(env) });
        }
        if (seg[2] === "block-order" && request.method === "PUT") {
          // v413 §2.2 — John's arrangement write: validates every
          // name against PRAYER_BLOCKS, dedupes, and replaces the
          // table's rows in one batch with sort_order = index.
          // Every validation is a named 400 that writes nothing.
          // An empty array clears the arrangement (back to the
          // contracts' order).
          const body = await request.json().catch(() => ({})) as { order?: unknown };
          if (!Array.isArray(body.order)) return err(400, "order required");
          const names: string[] = [];
          for (const raw of body.order) {
            const name = String(raw ?? "");
            if (!(PRAYER_BLOCKS as readonly string[]).includes(name)) return err(400, `bad block ${name || "(empty)"}`);
            if (!names.includes(name)) names.push(name);
          }
          const ts = nowISO();
          const stmts: D1PreparedStatement[] = [env.DB.prepare("DELETE FROM player_block_order")];
          names.forEach((name, i) => {
            stmts.push(env.DB.prepare(
              "INSERT INTO player_block_order (block, sort_order, updated_at) VALUES (?, ?, ?)",
            ).bind(name, i, ts));
          });
          await env.DB.batch(stmts);
          return json({ ok: true, order: await playerBlockOrder(env) });
        }
        if (seg[2] === "source-settings" && request.method === "GET") {
          // v328 §2.2 route 1 — the Settings screen's read: the
          // identical body to the door read.
          return json(await sourceSettingsPayload(env));
        }
        if (seg[2] === "source-settings" && request.method === "PUT") {
          // v328 §2.2 route 2 — John's whole-table write, in the
          // sources-PUT idiom (one D1 batch). Every validation is a
          // named 400 that writes nothing. name, family, slot_id,
          // and role are server-owned and never taken from the body;
          // sort_order is renumbered gapless per block following the
          // body's array order (A1.2's renumber pin).
          const body = await request.json().catch(() => ({})) as {
            sources?: { sourceKey?: string; block?: string; dayRule?: string; enabled?: number }[];
          };
          if (!Array.isArray(body.sources)) return err(400, "sources required");
          const cur = await env.DB.prepare("SELECT source_key FROM player_source_settings").all<{ source_key: string }>();
          const stored = new Set((cur.results ?? []).map((r) => r.source_key));
          const seen = new Set<string>();
          for (const s of body.sources) {
            const key = String(s.sourceKey ?? "");
            if (!stored.has(key)) return err(400, `unknown sourceKey ${key || "(empty)"}`);
            if (seen.has(key)) return err(400, `duplicate sourceKey ${key}`);
            seen.add(key);
            if (!(s.block === "" || (PRAYER_BLOCKS as readonly string[]).includes(s.block ?? ""))) return err(400, `bad block for ${key}`);
            if (!(DAY_RULES as readonly string[]).includes(s.dayRule ?? "")) return err(400, `bad dayRule for ${key}`);
            if (s.enabled !== 0 && s.enabled !== 1) return err(400, `bad enabled for ${key}`);
          }
          if (seen.size !== stored.size) return err(400, "the row set must be exactly the stored set (no creates, no deletes)");
          const counters = new Map<string, number>();
          const ts = nowISO();
          const stmts: D1PreparedStatement[] = [];
          for (const s of body.sources) {
            const key = String(s.sourceKey ?? "");
            const placed = s.enabled === 1 && (s.block ?? "") !== "";
            let sortOrder: number | null = null;
            if (placed) {
              const n = (counters.get(s.block!) ?? 0) + 1;
              counters.set(s.block!, n);
              sortOrder = n;
            }
            stmts.push(env.DB.prepare(
              "UPDATE player_source_settings SET block=?, day_rule=?, enabled=?, sort_order=?, updated_at=? WHERE source_key=?",
            ).bind(s.block ?? "", s.dayRule ?? "daily", s.enabled ?? 0, sortOrder, ts, key));
          }
          stmts.push(env.DB.prepare(
            "UPDATE player_settings_meta SET version = version + 1, updated_at = ? WHERE id = 1",
          ).bind(ts));
          await env.DB.batch(stmts);
          const meta = await env.DB.prepare("SELECT version FROM player_settings_meta WHERE id=1").first<{ version: number }>();
          return json({ ok: true, version: meta?.version ?? 0 });
        }
        return err(404, "unknown player route");
      }

      if (seg[0] === "api" && seg[1] === "wallpaper") {
        // v386 §2.3 B3 — John's session surface ONLY (the agent
        // door does not read these; a door-token request carries no
        // Access email header and johnOnly has already refused it).
        // Names are validated against the manifest before any
        // storage key is formed — no request segment reaches a key
        // unvalidated.
        if (seg[2] === "manifest" && !seg[3] && request.method === "GET") {
          return json(await wallpaperManifestRead(env));
        }
        if (seg[2] === "file" && seg[3] && seg[4] && !seg[5] && request.method === "GET") {
          const variant = seg[3];
          const name = seg[4];
          if (variant !== "phone" && variant !== "watch") return err(404, "unknown variant");
          const manifest = await wallpaperManifestRead(env);
          const entry = manifest.entries.find((e) => e.name === name && e.variant === variant);
          if (!entry) return err(404, "unknown wallpaper file");
          const obj = await env.AUDIO.get(wallpaperKey(variant, name));
          if (!obj) return err(404, "wallpaper file missing");
          return new Response(obj.body, {
            headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=2592000" },
          });
        }
        return err(404, "unknown wallpaper route");
      }

      if (seg[0] === "api" && seg[1] === "pin") {
        // v356 §2.2 — John's session surface only; the agent door
        // gains NO pin route of any kind (§2.4).
        if (seg[2] === "state" && request.method === "GET") {
          const state = await loadPinState(env);
          return json({ pinSet: !!state, retryAfterSeconds: state ? pinRetryAfterSeconds(state) : 0 });
        }
        if (seg[2] === "set" && request.method === "POST") {
          const body = await request.json().catch(() => ({})) as { pin?: string };
          const pin = typeof body.pin === "string" ? body.pin : "";
          if (!/^\d{4,8}$/.test(pin)) return err(400, "pin must be 4-8 digits");
          const existing = await loadPinState(env);
          if (existing) return err(409, "pin already set");
          const pinCred = await hashCredential(pin);
          const recoveryCode = generateRecoveryCode();
          const recCred = await hashCredential(normalizeRecoveryCode(recoveryCode));
          const ts = nowISO();
          await env.DB.prepare(
            `INSERT INTO pin_state (id, pin_hash, pin_salt, pin_iterations, recovery_hash, recovery_salt, recovery_iterations, failed_attempts, next_allowed_at, created_at, updated_at)
             VALUES (1, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
          ).bind(pinCred.hash, pinCred.salt, pinCred.iterations, recCred.hash, recCred.salt, recCred.iterations, ts, ts).run();
          const issued = await issuePinToken(env);
          return json({ recoveryCode, token: issued.token, expiresAt: issued.expiresAt }, 201);
        }
        if (seg[2] === "verify" && request.method === "POST") {
          const state = await loadPinState(env);
          if (!state) return err(409, "no pin set");
          const wait = pinRetryAfterSeconds(state);
          if (wait > 0) return json({ error: "wait", retryAfterSeconds: wait }, 429);
          const body = await request.json().catch(() => ({})) as { pin?: string };
          const pin = typeof body.pin === "string" ? body.pin : "";
          const derived = await pbkdf2Hex(pin, state.pin_salt, state.pin_iterations);
          if (!timingSafeEqual(derived, state.pin_hash)) {
            const f = await registerPinFailure(env, state);
            const out: Record<string, unknown> = { error: "wrong pin", attemptsRemaining: f.attemptsRemaining };
            if (f.retryAfterSeconds) out.retryAfterSeconds = f.retryAfterSeconds;
            return json(out, 401);
          }
          await resetPinAttempts(env);
          const issued = await issuePinToken(env);
          return json({ token: issued.token, expiresAt: issued.expiresAt });
        }
        if (seg[2] === "change" && request.method === "POST") {
          const state = await loadPinState(env);
          if (!state) return err(409, "no pin set");
          if (!(await pinTokenValid(request, env))) return err(403, "pin_required");
          const body = await request.json().catch(() => ({})) as { pin?: string };
          const pin = typeof body.pin === "string" ? body.pin : "";
          if (!/^\d{4,8}$/.test(pin)) return err(400, "pin must be 4-8 digits");
          const pinCred = await hashCredential(pin);
          const recoveryCode = generateRecoveryCode();
          const recCred = await hashCredential(normalizeRecoveryCode(recoveryCode));
          await env.DB.prepare(
            "UPDATE pin_state SET pin_hash=?, pin_salt=?, pin_iterations=?, recovery_hash=?, recovery_salt=?, recovery_iterations=?, updated_at=? WHERE id=1",
          ).bind(pinCred.hash, pinCred.salt, pinCred.iterations, recCred.hash, recCred.salt, recCred.iterations, nowISO()).run();
          await env.DB.prepare("DELETE FROM pin_tokens").run();
          const issued = await issuePinToken(env);
          return json({ recoveryCode, token: issued.token, expiresAt: issued.expiresAt });
        }
        if (seg[2] === "remove" && request.method === "POST") {
          const state = await loadPinState(env);
          if (!state) return err(409, "no pin set");
          if (!(await pinTokenValid(request, env))) return err(403, "pin_required");
          await env.DB.batch([
            env.DB.prepare("DELETE FROM pin_state WHERE id=1"),
            env.DB.prepare("DELETE FROM pin_tokens"),
          ]);
          return json({ ok: true });
        }
        if (seg[2] === "recover" && request.method === "POST") {
          const state = await loadPinState(env);
          if (!state) return err(409, "no pin set");
          const body = await request.json().catch(() => ({})) as { code?: string; newPin?: string };
          const newPin = typeof body.newPin === "string" ? body.newPin : "";
          if (!/^\d{4,8}$/.test(newPin)) return err(400, "pin must be 4-8 digits");
          const wait = pinRetryAfterSeconds(state);
          if (wait > 0) return json({ error: "wait", retryAfterSeconds: wait }, 429);
          const code = normalizeRecoveryCode(typeof body.code === "string" ? body.code : "");
          const derived = await pbkdf2Hex(code, state.recovery_salt, state.recovery_iterations);
          if (!timingSafeEqual(derived, state.recovery_hash)) {
            const f = await registerPinFailure(env, state);
            const out: Record<string, unknown> = { error: "wrong code", attemptsRemaining: f.attemptsRemaining };
            if (f.retryAfterSeconds) out.retryAfterSeconds = f.retryAfterSeconds;
            return json(out, 401);
          }
          // One call rolls the whole credential generation (§2.2):
          // new PIN hash + a NEW recovery code; no exam or
          // confession row is read, written, or deleted here.
          const pinCred = await hashCredential(newPin);
          const recoveryCode = generateRecoveryCode();
          const recCred = await hashCredential(normalizeRecoveryCode(recoveryCode));
          await env.DB.prepare(
            "UPDATE pin_state SET pin_hash=?, pin_salt=?, pin_iterations=?, recovery_hash=?, recovery_salt=?, recovery_iterations=?, failed_attempts=0, next_allowed_at=NULL, updated_at=? WHERE id=1",
          ).bind(pinCred.hash, pinCred.salt, pinCred.iterations, recCred.hash, recCred.salt, recCred.iterations, nowISO()).run();
          await env.DB.prepare("DELETE FROM pin_tokens").run();
          const issued = await issuePinToken(env);
          return json({ recoveryCode, token: issued.token, expiresAt: issued.expiresAt });
        }
        return err(404, "unknown pin route");
      }

      if (seg[0] === "api" && (seg[1] === "exam" || seg[1] === "confession")) {
        const blocked = await pinGate(request, env);
        if (blocked) return blocked;
      }

      if (seg[0] === "api" && seg[1] === "exam") {
        if (seg[2] === "today" && request.method === "GET") return json(await examToday(env));
        if (seg[2] === "entries" && request.method === "POST") {
          const body = await request.json().catch(() => ({})) as { runId?: number; promptId?: number | null; category?: string; text?: string };
          const text = typeof body.text === "string" ? body.text.trim() : "";
          if (!text) return err(400, "text required");
          const run = await env.DB.prepare("SELECT * FROM exam_runs WHERE id=?").bind(body.runId ?? 0).first<{ id: number; state: string }>();
          if (!run) return err(404, "run not found");
          if (run.state !== "open") return err(409, "run is closed");
          let category = typeof body.category === "string" ? body.category : "";
          if (body.promptId) {
            const p = await env.DB.prepare("SELECT category FROM exam_prompts WHERE id=?").bind(body.promptId).first<{ category: string }>();
            if (!p) return err(400, "bad prompt");
            category = p.category;
          }
          if (!category) return err(400, "category required");
          const r = await env.DB.prepare(
            "INSERT INTO exam_entries (run_id, prompt_id, category, text, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
          ).bind(run.id, body.promptId ?? null, category, text, nowISO()).first<{ id: number }>();
          return json({ ok: true, id: r?.id }, 201);
        }
        const eMatch = seg[2] === "entries" && seg[3] ? /^(\d+)$/.exec(seg[3]) : null;
        if (eMatch && request.method === "DELETE") {
          const row = await env.DB.prepare(
            "SELECT e.id FROM exam_entries e JOIN exam_runs r ON r.id = e.run_id WHERE e.id=? AND r.state='open'",
          ).bind(Number(eMatch[1])).first<{ id: number }>();
          if (!row) return err(409, "entry is not on an open run");
          await env.DB.prepare("DELETE FROM exam_entries WHERE id=?").bind(Number(eMatch[1])).run();
          return json({ ok: true });
        }
        const rMatch = seg[2] === "runs" && seg[3] ? /^(\d+)$/.exec(seg[3]) : null;
        if (rMatch && seg[4] === "close" && request.method === "POST") {
          await env.DB.prepare("UPDATE exam_runs SET state='closed', closed_at=? WHERE id=? AND state='open'").bind(nowISO(), Number(rMatch[1])).run();
          return json({ ok: true });
        }
        if (seg[2] === "prompts" && request.method === "PUT") {
          const body = await request.json().catch(() => ({})) as { prompts?: { id?: number; text?: string }[] };
          if (!Array.isArray(body.prompts)) return err(400, "prompts required");
          const stmts: D1PreparedStatement[] = [];
          for (const p of body.prompts) {
            if (!p.id || typeof p.text !== "string") continue;
            stmts.push(env.DB.prepare("UPDATE exam_prompts SET text=? WHERE id=?").bind(p.text, p.id));
          }
          if (stmts.length) await env.DB.batch(stmts);
          return json({ ok: true });
        }
        return err(404, "unknown exam route");
      }

      if (seg[0] === "api" && seg[1] === "confession") {
        if (request.method === "GET" && !seg[2]) return json(await confessionPayload(env));
        if (seg[2] === "made" && request.method === "POST") {
          const body = await request.json().catch(() => ({})) as { date?: string; note?: string };
          const date = String(body.date ?? "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");
          const r = await env.DB.prepare(
            "INSERT INTO confessions (date, note, created_at) VALUES (?, ?, ?) RETURNING id",
          ).bind(date, typeof body.note === "string" ? body.note : "", nowISO()).first<{ id: number }>();
          const upd = await env.DB.prepare("UPDATE exam_entries SET confession_id=? WHERE confession_id IS NULL").bind(r!.id).run();
          return json({ ok: true, id: r?.id, entriesClosed: upd.meta.changes ?? 0 });
        }
        if (seg[2] === "penance" && !seg[3] && request.method === "POST") {
          const body = await request.json().catch(() => ({})) as { text?: string };
          const text = typeof body.text === "string" ? body.text.trim() : "";
          if (!text) return err(400, "text required");
          const last = await env.DB.prepare("SELECT id FROM confessions ORDER BY date DESC, id DESC LIMIT 1").first<{ id: number }>();
          if (!last) return err(400, "record a confession first");
          await env.DB.prepare("UPDATE confessions SET penance_text=?, penance_done_at=NULL WHERE id=?").bind(text, last.id).run();
          return json({ ok: true });
        }
        if (seg[2] === "penance" && seg[3] === "done" && request.method === "POST") {
          const last = await env.DB.prepare("SELECT id FROM confessions ORDER BY date DESC, id DESC LIMIT 1").first<{ id: number }>();
          if (!last) return err(400, "no confession recorded");
          await env.DB.prepare("UPDATE confessions SET penance_done_at=? WHERE id=?").bind(nowISO(), last.id).run();
          return json({ ok: true });
        }
        if (seg[2] === "guide" && request.method === "PUT") {
          const body = await request.json().catch(() => ({})) as { steps?: { step_no?: number; title?: string; body?: string }[] };
          if (!Array.isArray(body.steps)) return err(400, "steps required");
          const stmts: D1PreparedStatement[] = [];
          for (const s of body.steps) {
            if (!s.step_no) continue;
            stmts.push(env.DB.prepare(
              `INSERT INTO confession_guide (step_no, title, body) VALUES (?, ?, ?)
               ON CONFLICT(step_no) DO UPDATE SET title = excluded.title, body = excluded.body`,
            ).bind(s.step_no, s.title ?? "", s.body ?? ""));
          }
          if (stmts.length) await env.DB.batch(stmts);
          return json({ ok: true });
        }
        return err(404, "unknown confession route");
      }

      if (seg[0] === "api") return err(404, "unknown route");

      // Static shell (John's session only — the gate above has run).
      if (path === "/" || path === "/index.html") return new Response(SHELL_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (path === "/styles.css") return new Response(APP_CSS, { headers: { "content-type": "text/css; charset=utf-8" } });
      if (path === "/app.js") return new Response(APP_JS, { headers: { "content-type": "text/javascript; charset=utf-8" } });
      if (path === "/manifest.json") return new Response(MANIFEST_JSON, { headers: { "content-type": "application/json" } });
      if (path === "/sw.js") return new Response(SW_JS, { headers: { "content-type": "text/javascript; charset=utf-8" } });
      if (path === "/logo.png") return new Response(logo(), { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" } });
      if (path === "/logo-512.png") return new Response(logo512(), { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" } });
      return err(404, "not found");
    } catch (e) {
      return err(500, `worker error: ${(e as Error).message}`);
    }
  },
};
