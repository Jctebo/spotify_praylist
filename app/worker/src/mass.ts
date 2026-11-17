// v486 — the Mass tab's server side: the day's versions from the
// generated calendar dataset (mass-calendar.ts, from the estate
// devotional calendar) + the day's proper prayers extracted at
// serve time from the published Roman Missal (2011) at
// liturgies.net, under ICEL's internet policy (non-commercial, no
// fee, acknowledgment on the first/last frames — the client
// carries it at the scroll's top and foot — texts verbatim).
// A formulary that fails extraction stands ABSENT (empty), never
// paraphrased. Extracted formularies cache in mass_cache
// (migration 0031); an empty result re-tries after 24 hours, a
// standing one is permanent (the Missal text does not change).
import { MASS_CALENDAR } from "./mass-calendar";

export interface MassFormulary {
  entranceAntiphon?: { ref?: string; text: string };
  collect?: string;
  prayerOverOfferings?: string;
  prefaceName?: string;
  prefaceText?: string;
  communionAntiphon?: { ref?: string; text: string };
  prayerAfterCommunion?: string;
}

interface MassVersion {
  key: string;
  label: string;
  kind: string;
  rank?: string;
  season?: string | null;
  week?: number | null;
  part?: string;
  slug?: string;
  slugs?: string[];
  common?: string;
}

const SRC = "http://www.liturgies.net/Liturgies/Catholic/roman_missal/";
export const SEASON_PAGES: Record<string, string> = {
  "Ordinary Time": SRC + "ordinarymass.htm",
  "Advent": SRC + "adventmass.htm",
  "Christmas": SRC + "christmasmass.htm",
  "Lent": SRC + "lentmass.htm",
  "Easter": SRC + "eastermass.htm",
};
const COMMONS_PAGE = SRC + "roman_missal_commons.htm";
const SAINT_PAGE = (slug: string) => "https://www.liturgies.net/saints/" + slug + "/readings.htm";

/* ---------- HTML -> lines (the proven normalization) ---------- */
export function normalizeLines(html: string): string[] {
  let h = html.replace(/<font size="-1">([\s\S]*?)<\/font>/g, (_m, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "");
    return text.length <= 14 ? text : " ";
  });
  h = h.replace(/<font size="\+2">([\s\S]*?)<\/font>/g, "$1");
  h = h.replace(/<br\s*\/?>/gi, "\n");
  h = h.replace(/<\/(p|div|tr)>/gi, "\n");
  h = h.replace(/<[^>]+>/g, "");
  h = h.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
       .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "’")
       .replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
       .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–");
  return h.split("\n").map((ln) => ln.replace(/\s+/g, " ").trim()).filter((ln) => ln.length > 0);
}

/* ---------- Item extraction over a line range ---------- */
const ITEM_HEADS: Record<string, string> = {
  "ENTRANCE ANTIPHON": "entranceAntiphon",
  "COLLECT": "collect",
  "PRAYER OVER THE OFFERINGS": "prayerOverOfferings",
  "COMMUNION ANTIPHON": "communionAntiphon",
  "PRAYER AFTER COMMUNION": "prayerAfterCommunion",
};
const STOP_HEADS = ["READINGS", "DAILY MASS", "YEAR A", "YEAR B", "YEAR C",
  "FIRST READING", "SECOND READING", "GOSPEL", "ALLELUIA VERSE", "SEQUENCE"];

function isAllCapsHead(ln: string): boolean {
  return ln.length >= 6 && ln === ln.toUpperCase() && /[A-Z]/.test(ln) &&
    !/[.!?]$/.test(ln) && ln.split(" ").length <= 9;
}

export function extractItems(lines: string[], from: number, to: number): MassFormulary {
  const out: MassFormulary = {};
  let cur: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (!cur) return;
    // Some saint pages print the Latin form of a prayer as the
    // first line under the English heading (ship-stage evidence,
    // §5: St Josaphat). A leading Latin line is not the English
    // text: drop it when English lines follow.
    if (buf.length > 1 && /quaesumus|Domine,|in Ecclesia|Spiritum,|beatus|beata/.test(buf[0]) && !/^(O God|Grant|Almighty|Stir|Defend|Pour|Bestow|May)/.test(buf[0])) {
      buf = buf.slice(1);
    }
    const text = buf.join(" ").replace(/\s+/g, " ").trim();
    if (text && (out as Record<string, unknown>)[cur] === undefined) {
      if (cur === "entranceAntiphon" || cur === "communionAntiphon") {
        const parts = buf.slice();
        let ref: string | undefined;
        if (parts.length > 1 && /^(Cf\.?\s*)?[A-Z][A-Za-z.]*\s*\d|^(Cf\.?\s*)?Ps/.test(parts[0]) && parts[0].length < 42) {
          ref = parts.shift();
        }
        (out as Record<string, unknown>)[cur] = { ref, text: parts.join(" ").replace(/\s+/g, " ").trim() };
      } else if (cur === "preface") {
        /* handled by the PREFACE branch below */
      } else {
        (out as Record<string, unknown>)[cur] = text;
      }
    }
    cur = null; buf = [];
  };
  for (let i = from; i < to && i < lines.length; i++) {
    const ln = lines[i];
    // Site furniture (statcounter scripts, nav tails) never
    // belongs to a prayer: the extraction stops there.
    if (/document\.write|sc_project|var sc_|document\.location\.protocol|Bibles & Reference|Liturgy Archive/.test(ln)) break;
    const up = ln.toUpperCase();
    let head: string | null = null;
    let restLine: string | undefined;
    for (const caps of Object.keys(ITEM_HEADS)) {
      if (up === caps) { head = ITEM_HEADS[caps]; break; }
      if (up.startsWith(caps + " ")) { head = ITEM_HEADS[caps]; restLine = ln.slice(caps.length + 1); break; }
    }
    let prefaceTitle: string | undefined;
    if (!head && up.startsWith("PREFACE")) {
      head = "preface";
      const m = /^PREFACE\s*[:—-]\s*(.+)$/i.exec(ln);
      if (m) prefaceTitle = m[1].trim();
    }
    if (head) {
      flush();
      cur = head;
      if (head === "preface") {
        if (prefaceTitle && out.prefaceName === undefined) out.prefaceName = prefaceTitle;
        cur = "prefaceText";
      }
      buf = restLine ? [restLine] : [];
      continue;
    }
    if (STOP_HEADS.some((s) => ln === s || ln.startsWith(s + " ") || ln.startsWith(s + ":")) ||
        /^(The Gloria|The Creed is said|The Alleluia)/.test(ln) ||
        (cur && isAllCapsHead(ln) && !ITEM_HEADS[ln])) {
      flush();
      continue;
    }
    if (cur === "prefaceText" && (ln === "Text without music:" || ln.startsWith("V. ") || ln.startsWith("R. ") || ln === "Holy, Holy, Holy Lord God of hosts...")) {
      continue;
    }
    if (cur) buf.push(ln);
  }
  flush();
  return out;
}

/* ---------- Season pages ---------- */
const ORD_WORDS = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH",
  "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH", "THIRTEENTH", "FOURTEENTH",
  "FIFTEENTH", "SIXTEENTH", "SEVENTEENTH", "EIGHTEENTH", "NINETEENTH", "TWENTIETH",
  "TWENTY-FIRST", "TWENTY-SECOND", "TWENTY-THIRD", "TWENTY-FOURTH", "TWENTY-FIFTH",
  "TWENTY-SIXTH", "TWENTY-SEVENTH", "TWENTY-EIGHTH", "TWENTY-NINTH", "THIRTIETH",
  "THIRTY-FIRST", "THIRTY-SECOND", "THIRTY-THIRD", "THIRTY-FOURTH"];

export function seasonFormulary(lines: string[], season: string, week: number | null, part: string, nameHint?: string): MassFormulary {
  let segFrom = -1, segTo = lines.length;
  if (week !== null && week >= 1 && week <= 34) {
    const word = ORD_WORDS[week - 1];
    const headRe = new RegExp("^" + word + " WEEK");
    const altRe = new RegExp("WEEK " + week + "\\b");
    for (let i = 0; i < lines.length; i++) {
      if (headRe.test(lines[i]) || altRe.test(lines[i])) { segFrom = i; break; }
    }
    if (segFrom < 0) return {};
    for (let i = segFrom + 1; i < lines.length; i++) {
      if (/WEEK/.test(lines[i]) && isAllCapsHead(lines[i]) && (ORD_WORDS.some((w) => lines[i].startsWith(w + " WEEK")) || /^WEEK \d+\b/.test(lines[i]))) { segTo = i; break; }
    }
  } else if (nameHint) {
    const hint = nameHint.toUpperCase().replace(/[^A-Z ]/g, "").trim();
    const keys = hint.split(" ").filter((w) => w.length > 3);
    for (let i = 0; i < lines.length; i++) {
      const up = lines[i].toUpperCase();
      if (keys.length && keys.every((k) => up.includes(k)) && isAllCapsHead(lines[i])) { segFrom = i; break; }
    }
    if (segFrom < 0) return {};
  } else {
    return {};
  }
  let from = segFrom, to = segTo;
  if (part === "weekday") {
    for (let i = segFrom; i < segTo; i++) {
      if (lines[i].startsWith("WEEKDAYS OF")) { from = i; break; }
    }
  } else {
    for (let i = segFrom; i < segTo; i++) {
      if (lines[i].startsWith("WEEKDAYS OF")) { to = i; break; }
    }
  }
  return extractItems(lines, from, to);
}

/* ---------- Saint pages + Commons ---------- */
export function saintFormulary(lines: string[]): { formulary: MassFormulary; commonName?: string } {
  let commonName: string | undefined;
  for (const ln of lines) {
    const m = /From the Common of (.+?)\.?\s*$/.exec(ln);
    if (m) { commonName = m[1].trim(); break; }
  }
  return { formulary: extractItems(lines, 0, lines.length), commonName };
}

const COMMON_TITLES = ["COMMON OF THE DEDICATION OF A CHURCH", "COMMON OF THE BLESSED VIRGIN MARY",
  "COMMON OF THE APOSTLES", "COMMON OF MARTYRS", "COMMON OF PASTORS",
  "COMMON OF DOCTORS OF THE CHURCH", "COMMON OF VIRGINS", "COMMON OF HOLY MEN AND WOMEN",
  "DEDICATION OF A CHURCH", "BLESSED VIRGIN MARY", "APOSTLES",
  "MARTYRS", "PASTORS", "DOCTORS OF THE CHURCH", "VIRGINS", "HOLY MEN AND WOMEN", "HOLY WOMEN"];

export function commonsFormulary(lines: string[], which: string): MassFormulary {
  const want = which === "dedication" ? "COMMON OF THE DEDICATION OF A CHURCH" : which.split(":")[0].toUpperCase().trim();
  // The page opens with a table of contents naming every
  // common in a few lines; the real section is the occurrence
  // whose run to the next common title is the longest.
  let from = -1, to = lines.length, bestSpan = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].toUpperCase().includes(want)) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (COMMON_TITLES.some((t) => lines[j] === t) && lines[j] !== want) { end = j; break; }
    }
    if (end - i > bestSpan) { bestSpan = end - i; from = i; to = end; }
  }
  if (from < 0) return {};
  // A named sub-formulary (e.g. 'For Those Who Practiced Works of
  // Mercy') narrows the segment when the caller named one.
  const sub = /:\s*(.+)$/.exec(which);
  if (sub) {
    const subKey = sub[1].toUpperCase().replace(/PRACTICED/g, "PRACTIC*").replace(/[^A-Z ]/g, "");
    const words = subKey.split(" ").filter((w) => w.length > 3 && w !== "PRACTIC*");
    for (let i = from; i < to; i++) {
      const up = lines[i].toUpperCase();
      if (words.length && words.every((w) => up.includes(w)) && isAllCapsHead(lines[i])) {
        let end = to;
        for (let j = i + 1; j < to; j++) {
          if (isAllCapsHead(lines[j]) && !ITEM_HEADS[lines[j]] && !lines[j].startsWith("PREFACE")) { end = j; break; }
        }
        return extractItems(lines, i, end);
      }
    }
  }
  return extractItems(lines, from, to);
}

function fillMissing(dst: MassFormulary, src: MassFormulary): MassFormulary {
  const d = dst as Record<string, unknown>, s = src as Record<string, unknown>;
  for (const k of Object.keys(s)) if (d[k] === undefined) d[k] = s[k];
  return dst;
}

/* ---------- Fetch + cache + resolve ---------- */
interface CacheEnv { DB: D1Database }

async function fetchLines(url: string): Promise<string[] | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "OraProNobisApp/1.0" } });
    if (!r.ok) return null;
    return normalizeLines(await r.text());
  } catch { return null; }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "OraProNobisApp/1.0" } });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function cachedFormulary(env: CacheEnv, key: string, compute: () => Promise<MassFormulary>): Promise<MassFormulary> {
  try {
    const row = await env.DB.prepare("SELECT body, fetched_at FROM mass_cache WHERE key = ?").bind(key)
      .first<{ body: string; fetched_at: string }>();
    if (row) {
      const parsed = JSON.parse(row.body) as MassFormulary;
      const hasText = Object.keys(parsed).length > 0;
      const ageMs = Date.now() - Date.parse(row.fetched_at);
      if (hasText || ageMs < 24 * 3600 * 1000) return parsed;
    }
  } catch { /* table missing pre-migration: compute live */ }
  const formulary = await compute();
  try {
    await env.DB.prepare("INSERT INTO mass_cache (key, body, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at")
      .bind(key, JSON.stringify(formulary), new Date().toISOString()).run();
  } catch { /* cache write is best-effort */ }
  return formulary;
}

export async function resolveFormulary(env: CacheEnv, v: MassVersion): Promise<MassFormulary> {
  if (v.kind === "season") {
    const season = v.season ?? (v.label && v.label.includes("Nativity") ? "Christmas" : null);
    if (!season || !SEASON_PAGES[season]) return {};
    const key = "form:season:" + season + ":" + (v.week ?? "x") + ":" + (v.part ?? "sunday");
    return cachedFormulary(env, key, async () => {
      const lines = await fetchLines(SEASON_PAGES[season]);
      if (!lines) return {};
      return seasonFormulary(lines, season, v.week ?? null, v.part ?? "sunday", v.label);
    });
  }
  if (v.kind === "common" && v.common === "dedication") {
    return cachedFormulary(env, "form:common:dedication", async () => {
      const lines = await fetchLines(COMMONS_PAGE);
      if (!lines) return {};
      const f = commonsFormulary(lines, "dedication");
      // The memorial's own proper Collect is a different text
      // from the Common's anniversary Collect; the Missal gives
      // this version its remaining items from the Common and
      // its Collect from the Proper of Saints. The proven
      // source's saint pages do not carry this feast's page, so
      // the Collect stands ABSENT here (verbatim or absent) —
      // the Common's anniversary Collect is NOT substituted.
      delete f.collect;
      return f;
    });
  }
  if (v.kind === "saint") {
    const candidates = v.slugs && v.slugs.length ? v.slugs : (v.slug ? [v.slug] : []);
    const key = "form:saint:" + (candidates[0] ?? v.key);
    return cachedFormulary(env, key, async () => {
      for (const slug of candidates) {
        const html = await fetchText(SAINT_PAGE(slug));
        // Stub guard (ship-stage evidence, §5): the source's
        // full saint pages run 12-14 KB; a ~5 KB stub page on the
        // same host carries a divergent text (St Rose Philippine
        // Duchesne) and is treated as NO page — propers absent.
        if (!html || html.length < 8000) continue;
        const lines = normalizeLines(html);
        const { formulary, commonName } = saintFormulary(lines);
        if (!formulary.collect) continue;
        if (commonName && Object.keys(formulary).length < 6) {
          const clines = await fetchLines(COMMONS_PAGE);
          if (clines) fillMissing(formulary, commonsFormulary(clines, commonName));
        }
        return formulary;
      }
      if ((v.label ?? "").startsWith("Dedication of")) {
        const clines = await fetchLines(COMMONS_PAGE);
        if (clines) return commonsFormulary(clines, "dedication");
      }
      return {};
    });
  }
  return {};
}

export async function massPayload(env: CacheEnv, date: string): Promise<unknown> {
  const entry = (MASS_CALENDAR as Record<string, { name: string; default: string; versions: MassVersion[] }>)[date];
  if (!entry) {
    return { date, name: date, defaultVersion: null, versions: [], inCalendar: false };
  }
  const versions = [];
  for (const v of entry.versions) {
    versions.push({ key: v.key, label: v.label, rank: v.rank ?? null, formulary: await resolveFormulary(env, v) });
  }
  // v488: the day's season (from its season-kind version, the
  // same data that drives the propers) rides the payload so
  // the client can apply the day-true Gloria/Creed rule.
  const season = entry.versions.find((v) => v.kind === "season")?.season ?? null;
  return { date, name: entry.name, defaultVersion: entry.default, versions, season, inCalendar: true };
}
