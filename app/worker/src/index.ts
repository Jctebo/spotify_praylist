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
  // The frozen podcast RSS feed; overridable only by the harness.
  FEED_URL?: string;
}

import { SHELL_HTML, APP_CSS, MANIFEST_JSON, SW_JS } from "./ui";
import { APP_JS } from "./client";
import { LOGO_PNG_B64 } from "./logo";

const JOHN_EMAILS = new Set(["john@thibeaux.com", "john.thibeaux@gmail.com"]);
const FEED_DEFAULT = "https://jctebo.github.io/spotify_praylist/podcast.xml";
const SUITE_AUDIO_BASE = "https://devotional-suite.john-thibeaux.workers.dev/audio";

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
const PRAYER_BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"] as const;
const PRAYER_BLOCK_START: Record<string, number> = {
  Morning: 0, Midmorning: 9, Midday: 12, Afternoon: 15, Evening: 18, Night: 21,
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
async function prayerAudioMap(env: Env, date: string): Promise<Map<string, { size: number }>> {
  const r = await env.DB.prepare("SELECT block, size_bytes FROM prayer_audio WHERE date=?").bind(date).all<{ block: string; size_bytes: number }>();
  return new Map((r.results ?? []).map((row) => [row.block, { size: row.size_bytes }]));
}
// The day payload: field-identical in shape to the board module's
// (the midnight job repoints by door target only), plus this app's
// own audio record: each block's segmentAudioUrl points at the app's
// audio route when the app holds that block's segment, and the
// payload names the blocks whose segment is missing (audioMissing).
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
  const audio = await prayerAudioMap(env, date);

  const blocks = PRAYER_BLOCKS.map((block) => {
    const blockItems = items.filter((i) => i.block === block && i.enabled);
    const hasAudio = audio.has(block);
    return {
      block,
      label: labels.get(block) ?? block,
      due: prayerBlockDue(date, block, today, hour),
      praylistUrl: PRAYLIST_URL[block],
      segmentAudioUrl: hasAudio ? `/api/prayer/audio/${date}/${encodeURIComponent(block)}` : `${SUITE_AUDIO_BASE}/${date}/${encodeURIComponent(block)}`,
      audio: { available: hasAudio, url: hasAudio ? `/api/prayer/audio/${date}/${encodeURIComponent(block)}` : null, sizeBytes: hasAudio ? audio.get(block)!.size : null },
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
    audioMissing: PRAYER_BLOCKS.filter((b) => !audio.has(b)),
  };
}

// ---- Player -------------------------------------------------------------
interface FeedEpisode { title: string; prefix: string; date: string; url: string; }
let feedCache: { at: number; items: FeedEpisode[] } | null = null;
async function feedEpisodes(env: Env): Promise<FeedEpisode[]> {
  if (feedCache && Date.now() - feedCache.at < 300000) return feedCache.items;
  const items: FeedEpisode[] = [];
  try {
    const res = await fetch(env.FEED_URL || FEED_DEFAULT);
    if (res.ok) {
      const xml = await res.text();
      const itemRe = /<item>([\s\S]*?)<\/item>/g;
      let m: RegExpExecArray | null;
      while ((m = itemRe.exec(xml)) !== null) {
        const body = m[1];
        const titleM = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(body);
        const encM = /<enclosure[^>]*url="([^"]+)"/.exec(body);
        const dateM = /<pubDate>([^<]+)<\/pubDate>/.exec(body);
        if (!titleM || !encM || !dateM) continue;
        const title = titleM[1].trim();
        const prefix = title.replace(/ - [A-Z][a-z]+ \d{1,2}, \d{4}$/, "");
        items.push({ title, prefix, date: chicagoDateOf(new Date(dateM[1])), url: encM[1] });
      }
    }
  } catch { /* the feed being unreachable leaves episode tracks absent; segment + playlist routes stand */ }
  feedCache = { at: Date.now(), items };
  return items;
}

async function playerDayPayload(env: Env, date: string) {
  const items = (await prayerGetItems(env)).filter((i) => i.enabled);
  const labelRows = await env.DB.prepare("SELECT block, label FROM prayer_block_labels").all<{ block: string; label: string }>();
  const labels = new Map((labelRows.results ?? []).map((r) => [r.block, r.label]));
  const srcRows = await env.DB.prepare("SELECT * FROM player_sources ORDER BY sort, id").all<{
    id: number; block: string; title: string; source_kind: string; rss_url: string; spotify_url: string; sort: number;
  }>();
  const sources = srcRows.results ?? [];
  const episodes = (await feedEpisodes(env)).filter((e) => e.date === date);
  const byPrefix = new Map<string, FeedEpisode>();
  for (const e of episodes) if (!byPrefix.has(e.prefix)) byPrefix.set(e.prefix, e);
  const usedPrefixes = new Set<string>();
  const audio = await prayerAudioMap(env, date);

  const blocks = PRAYER_BLOCKS.map((block) => {
    const route = sources.find((s) => s.block === block && s.source_kind === "playlist");
    const spotify = route?.spotify_url || PRAYLIST_URL[block];
    const tracks: unknown[] = [];
    // Mapped sources for this block (Amendment 3: the mapping is data).
    for (const s of sources) {
      if (s.block !== block || s.source_kind === "playlist") continue;
      if (s.source_kind === "rss") {
        const ep = byPrefix.get(s.title);
        if (ep) { usedPrefixes.add(ep.prefix); tracks.push({ title: s.title, kind: "rss", available: true, streamUrl: ep.url, spotifyUrl: s.spotify_url || spotify }); }
        else tracks.push({ title: s.title, kind: "rss", available: false, streamUrl: null, spotifyUrl: s.spotify_url || spotify });
      } else {
        tracks.push({ title: s.title, kind: "segment", available: !!s.rss_url, streamUrl: s.rss_url || null, spotifyUrl: s.spotify_url || spotify });
      }
    }
    // The block's devotions, matched to the day's feed episodes by name.
    for (const i of items.filter((x) => x.block === block)) {
      if (tracks.some((t) => (t as { title: string }).title === i.name)) continue;
      const ep = byPrefix.get(i.name);
      if (ep) { usedPrefixes.add(ep.prefix); tracks.push({ title: i.name, kind: "rss", available: true, streamUrl: ep.url, spotifyUrl: spotify }); }
      else tracks.push({ title: i.name, kind: "item", available: false, streamUrl: null, spotifyUrl: spotify });
    }
    // The Intentions card (Amendment 9 item 6): this block's spoken
    // intentions segment, from the app's own audio store; segment-file
    // route only — NO Spotify link ever stands under it.
    const hasAudio = audio.has(block);
    const card = {
      title: "Intentions", kind: "segment", intentionsCard: true,
      available: hasAudio,
      streamUrl: hasAudio ? `/api/prayer/audio/${date}/${encodeURIComponent(block)}` : null,
      spotifyUrl: null,
    };
    tracks.splice(tracks.length ? 1 : 0, 0, card);
    return { block, label: labels.get(block) ?? block, caption: BLOCK_CAPTION[block], spotifyUrl: spotify, tracks };
  });
  const unmapped = episodes.filter((e) => !usedPrefixes.has(e.prefix)).map((e) => ({
    title: e.prefix, kind: "rss", available: true, streamUrl: e.url, spotifyUrl: null,
  }));
  return { ok: true, date, dateLabel: prayerDateLabel(date), episodes: unmapped, blocks, audioMissing: PRAYER_BLOCKS.filter((b) => !audio.has(b)) };
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
      if (seg[2] === "prayer" && seg[3] === "audio" && request.method === "POST") {
        // The audio intentions push (Plan step 5): raw MP3 bytes with
        // the board attachment route's header shape, mirrored so the
        // job-sheet change stays mechanical.
        const date = request.headers.get("x-prayer-date") ?? "";
        const block = request.headers.get("x-prayer-block") ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "X-Prayer-Date must be YYYY-MM-DD");
        if (!PRAYER_BLOCKS.includes(block as typeof PRAYER_BLOCKS[number])) return err(400, "bad block");
        const bytes = new Uint8Array(await request.arrayBuffer());
        if (!bytes.length) return err(400, "empty body");
        const key = `segments/${date}/${block}.mp3`;
        await env.AUDIO.put(key, bytes, { httpMetadata: { contentType: "audio/mpeg" } });
        await env.DB.prepare(
          `INSERT INTO prayer_audio (date, block, r2_key, size_bytes, pushed_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(date, block) DO UPDATE SET r2_key = excluded.r2_key, size_bytes = excluded.size_bytes, pushed_at = excluded.pushed_at`,
        ).bind(date, block, key, bytes.length, nowISO()).run();
        return json({ ok: true, date, block, size: bytes.length });
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
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !PRAYER_BLOCKS.includes(block as typeof PRAYER_BLOCKS[number])) return err(400, "bad audio path");
          const row = await env.DB.prepare("SELECT r2_key FROM prayer_audio WHERE date=? AND block=?").bind(date, block).first<{ r2_key: string }>();
          if (!row) return err(404, "no segment for that block and date");
          const obj = await env.AUDIO.get(row.r2_key);
          if (!obj) return err(404, "segment missing from the store");
          return new Response(obj.body, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600" } });
        }
        return err(404, "unknown prayer route");
      }

      if (seg[0] === "api" && seg[1] === "player") {
        if (seg[2] === "day" && request.method === "GET") {
          const date = url.searchParams.get("date") ?? prayerChicagoNow().date;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");
          return json(await playerDayPayload(env, date));
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
