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
}

import { SHELL_HTML, APP_CSS, MANIFEST_JSON, SW_JS } from "./ui";
import { APP_JS } from "./client";
import { LOGO_PNG_B64 } from "./logo";

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

let logoBytes: Uint8Array | null = null;
function logo(): Uint8Array {
  if (!logoBytes) {
    const bin = atob(LOGO_PNG_B64);
    logoBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) logoBytes[i] = bin.charCodeAt(i);
  }
  return logoBytes;
}

// ---- Prayer module (ported behavior-identical from the board) --------
// Data model + draw rule are the board migration 0015 port: 35 items
// in six blocks, one weighted intention draw per enabled item per
// date (High=4, Medium=2, Low=1, persisted, fill-missing only),
// per-day completions (data only in this app — no behavior is built
// on them), and the day addendum.
const PRAYER_BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night", "Mass and Homilies"] as const;
const PRAYER_BLOCK_START: Record<string, number> = {
  // v339: "Mass and Homilies" carries no hour of its own — it is
  // the day's closing listening block, not a time-of-day office.
  // 24 keeps it out of the current-block derivation entirely (the
  // ?? 0 fallback would have made it "current" at every hour, as
  // the last block in iteration order).
  Morning: 0, Midmorning: 9, Midday: 12, Afternoon: 15, Evening: 18, Night: 21, "Mass and Homilies": 24,
};
const PRAYLIST_URL: Record<string, string> = {
  Morning: "https://open.spotify.com/playlist/0sy9eBsySKuCppI0PxXRJN",
  Midmorning: "https://open.spotify.com/playlist/3EYFgLhMGEfILn6bRJgHJm",
  Midday: "https://open.spotify.com/playlist/4gQAaPAMiezBaDaoqK6sFQ",
  Afternoon: "https://open.spotify.com/playlist/7cyrM9f9LXEfmoqwZvUaXW",
  Evening: "https://open.spotify.com/playlist/6HNvFLWRShih7lgtwHTqXU",
  Night: "https://open.spotify.com/playlist/1TAlNiKHMc41cT0fvkYxTD",
};
const BLOCK_CAPTION: Record<string, string> = {
  Morning: "from midnight", Midmorning: "from 9 AM", Midday: "from 12 PM",
  Afternoon: "from 3 PM", Evening: "from 6 PM", Night: "from 9 PM",
  // v339: the block is the day's close, not an hour office.
  "Mass and Homilies": "the day's Mass and the week's homilies",
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
    "SELECT * FROM prayer_items ORDER BY CASE block WHEN 'Morning' THEN 0 WHEN 'Midmorning' THEN 1 WHEN 'Midday' THEN 2 WHEN 'Afternoon' THEN 3 WHEN 'Evening' THEN 4 WHEN 'Night' THEN 5 ELSE 6 END, sort, id",
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
function drawRandom(env: Env, date: string, itemId: number): number {
  if (env.LOCAL_DEV !== "1") return Math.random();
  const s = `${date}:${itemId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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
// v335 §2.3: the splice reads the STANDING segment rows (sentinel
// date 'current') for every payload — one standing segment per block
// under the same name always, replaced in place on refresh. Dated
// rows are no longer consumed by any payload.
async function prayerAudioMap(env: Env): Promise<Map<string, { size: number }>> {
  const r = await env.DB.prepare("SELECT block, size_bytes FROM prayer_audio WHERE date='current'").all<{ block: string; size_bytes: number }>();
  return new Map((r.results ?? []).map((row) => [row.block, { size: row.size_bytes }]));
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
    blocks,
    devotionCount: enabled.length,
    prayerCount: enabled.filter((i) => i.kind === "prayer").length,
    activityCount: enabled.filter((i) => i.kind === "activity").length,
    doneCount: enabled.filter((i) => doneSet.has(i.id)).length,
    dueCount: enabled.filter((i) => prayerBlockDue(date, i.block, today, hour)).length,
    currentBlock: date === today
      ? PRAYER_BLOCKS.reduce((cur, b) => (hour >= (PRAYER_BLOCK_START[b] ?? 0) ? b : cur), "Morning" as string)
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
// consumer changed. Novena track ids are feed-born (novena-<slug>)
// and cannot be enumerated here: the Novenas item's drawn text
// rides under the "novenas" key and the client applies the
// standing prefix rule to it. Absence is the missing-intro signal
// — never an error, never a placeholder.
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
  const novenaText = drawByItem.get("Novenas");
  if (novenaText) out["novenas"] = novenaText;
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
// resolution results). player_episodes is not read here at all.
async function playerDayPayload(env: Env) {
  const labelRows = await env.DB.prepare("SELECT block, label FROM prayer_block_labels").all<{ block: string; label: string }>();
  const labels = new Map((labelRows.results ?? []).map((r) => [r.block, r.label]));
  const srcRows = await env.DB.prepare("SELECT * FROM player_sources ORDER BY sort, id").all<{
    id: number; block: string; title: string; source_kind: string; rss_url: string; spotify_url: string; sort: number;
  }>();
  const sources = srcRows.results ?? [];
  // v337 §2.1: the PRESENTED day is the Chicago calendar day — the
  // app presents today; production (date+2) stays a production
  // fact in the nightly report, never a payload field.
  const presented = prayerChicagoNow().date;
  const settings = await sourceSettingsPayload(env);
  const introTexts = await playerIntroTexts(env, presented);
  const blocks = PRAYER_BLOCKS.map((block) => {
    const route = sources.find((x) => x.block === block && x.source_kind === "playlist");
    return { block, label: labels.get(block) ?? block, caption: BLOCK_CAPTION[block], spotifyUrl: route?.spotify_url || PRAYLIST_URL[block], tracks: [] as unknown[], trackCount: 0 };
  });
  return {
    ok: true, date: presented, dateLabel: prayerDateLabel(presented), presentedDay: presented,
    version: settings.version, introTexts, blocks,
  };
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
interface ExtFeedItem { title: string; url: string; length: number; pubMs: number | null; durationS: number }
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
async function extFetchFeedItems(url: string, userAgent?: string): Promise<ExtFeedItem[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { "user-agent": userAgent || "ora-pro-nobis-externals-resolver/1.0" }, signal: ctl.signal });
    if (!res.ok) throw new Error(`feed fetch failed: HTTP ${res.status}`);
    return extParseFeed(await res.text());
  } finally { clearTimeout(timer); }
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
    try {
      it = extMatchCourierSlot(cs, await extFetchFeedItems(cs.feed(env), cs.browserUa ? EXT_BROWSER_UA : undefined), y, mo, d);
    } catch { it = null; }
    if (!it) return { slotId: cs.slotId, state: "missing", title: cs.title, streamUrl: null, durationSec: 0, sizeBytes: 0, block: row.block || EXTERNAL_SLOTS[cs.slotId], sortOrder: row.sort_order };
    return { slotId: cs.slotId, state: "present", title: cs.title, streamUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, block: row.block || EXTERNAL_SLOTS[cs.slotId], sortOrder: row.sort_order };
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
  let items: ExtFeedItem[] | null = null;
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
    items = extParseFeed(await res.text());
  } catch (e) {
    error = e instanceof Error && e.name === "AbortError" ? "feed fetch timed out" : (e instanceof Error ? e.message : "feed fetch failed");
  }
  if (!items) {
    const courierSlots = await extCourierSlotsPayload(env, prim, y, mo, d, weekdayMon0);
    return { settingsVersion: settings.version, error, slots: [...standing.map(mkMissing), ...courierSlots] };
  }
  const matches = extMatchDivineOffice(items, y, mo, d);
  const slots = standing.map((slot) => {
    const it = matches.get(slot.slotId);
    if (!it) return mkMissing(slot);
    const row = prim.get(slot.slotId)!;
    return { slotId: slot.slotId, state: "present", title: slot.title, streamUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, block: row.block || EXTERNAL_SLOTS[slot.slotId], sortOrder: row.sort_order };
  });
  slots.push(...(await extCourierSlotsPayload(env, prim, y, mo, d, weekdayMon0)) as typeof slots);
  return { settingsVersion: settings.version, slots };
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
      if (seg[2] === "player" && seg[3] === "day" && request.method === "GET") {
        // v337 §2.7: the amended step's presented-set read — the
        // same payload the session serves, through the door (the
        // generation iterates the presented own tracks from it and
        // pairs them against the day's draw).
        return json(await playerDayPayload(env));
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
          // Adding an intention ONLY adds it (v58 rule): today's draws
          // are untouched; it first enters a draw at the next fill.
          return json({ ok: true, id: r?.id }, 201);
        }
        const pIntMatch = seg[2] === "intentions" && seg[3] ? /^(\d+)$/.exec(seg[3]) : null;
        if (pIntMatch && seg[4] === "status" && request.method === "POST") {
          const body = await request.json().catch(() => ({})) as { status?: string };
          if (!["active", "retired"].includes(body.status ?? "")) return err(400, "bad status");
          const id = Number(pIntMatch[1]);
          await env.DB.prepare("UPDATE prayer_intentions SET status=? WHERE id=?").bind(body.status, id).run();
          if (body.status === "retired") {
            await env.DB.prepare("DELETE FROM prayer_draws WHERE intention_id=? AND date>=?").bind(id, pToday).run();
            await prayerDrawForDate(env, pToday);
          }
          return json({ ok: true });
        }
        if (pIntMatch && request.method === "PATCH") {
          const body = await request.json().catch(() => ({})) as { text?: string; priority?: string };
          const priority = body.priority !== undefined
            ? (["H", "M", "L"].includes(body.priority) ? body.priority : null)
            : undefined;
          if (priority === null) return err(400, "bad priority");
          await env.DB.prepare("UPDATE prayer_intentions SET text=COALESCE(?, text), priority=COALESCE(?, priority) WHERE id=?")
            .bind(typeof body.text === "string" ? body.text : null, priority ?? null, Number(pIntMatch[1])).run();
          return json({ ok: true });
        }
        if (pIntMatch && request.method === "DELETE") {
          const id = Number(pIntMatch[1]);
          await env.DB.batch([
            env.DB.prepare("DELETE FROM prayer_draws WHERE intention_id=?").bind(id),
            env.DB.prepare("DELETE FROM prayer_intentions WHERE id=?").bind(id),
          ]);
          await prayerDrawForDate(env, pToday);
          return json({ ok: true });
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
          // day; any ?date= remains ignored. The produced day rides
          // along as storedDay — a production fact, never the
          // selection.
          return json(await playerDayPayload(env));
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
          const presented = prayerChicagoNow().date;
          if (date !== presented) return err(400, `date ${date} is not the presented day ${presented}`);
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
          // v337 §2.4: the presented-day gate, as on the live route.
          const presented = prayerChicagoNow().date;
          if (date !== presented) return err(400, `date ${date} is not the presented day ${presented}`);
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
      return err(404, "not found");
    } catch (e) {
      return err(500, `worker error: ${(e as Error).message}`);
    }
  },
};
