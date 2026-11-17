// v490 — the Mass tab's readings source: the USCCB Daily
// Readings RSS feed (NABRE), fetched server-side. John's
// order 2026-11-17: the tab is served on his website, which
// is where the USCCB distribution terms allow free display
// of the readings from the RSS feed (no permission or fee;
// the site charges nothing). The feed is THE source; the
// client fills any headed piece the feed lacks for the day
// from the standing Universalis (Jerusalem Bible) payload,
// per piece (John's general fallback rule, 2026-11-17).
//
// Feed facts, verified live 2026-11-17 (Plan gate):
//   - URL https://www.usccb.org/bible/readings/rss/index.cfm
//     answers application/rss+xml with the FULL text of each
//     day (headed parts in <h4>s inside the item description:
//     Reading 1 · Responsorial Psalm · Reading 2 · Alleluia ·
//     Gospel, plus any alternate part under its own heading).
//   - Items are date-matched by their link (…/MMDDYY.cfm)
//     and pubDate; the feed carries today + the previous
//     nine days, no future days. The tab loads the current
//     Chicago day only, so that stands.
//   - Each item's description ends with the Lectionary
//     copyright paragraph (Confraternity of Christian
//     Doctrine) — carried through to the client verbatim so
//     it stands with the readings, as the terms require.
// Words are never altered here: the part bodies ride as the
// feed's own HTML and the client cleans presentation only
// (the v487 rule). A date the feed does not carry answers
// found:false with no parts — the client's per-piece
// fallback then serves the whole day from Universalis.

export interface MassFeedOption {
  source: string; // the option's citation, as the feed prints it
  html: string; // the option's body, the feed's own HTML
}

export interface MassFeedPart {
  key: string; // r1 | ps | r2 | ga | g | extra
  heading: string; // the feed's own part name, e.g. "Reading 1"
  source: string; // the citation, e.g. "Revelation 3:1-6, 14-22"
  html: string; // the part body, the feed's own HTML
  // v497: when the day's print carries more than one option
  // for this part (an alternate reading, or a long/short form
  // of one passage), the options ride here — options[0] is
  // always this part's own source/html, so a reader that does
  // not know the field renders the first-printed option
  // exactly as before. Absent on a single-option part.
  options?: MassFeedOption[];
}

export interface MassReadingsPayload {
  date: string;
  found: boolean;
  title?: string;
  parts: MassFeedPart[];
  copyright: string[];
}

const FEED_URL = "https://www.usccb.org/bible/readings/rss/index.cfm";

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in NAMED ? NAMED[n] : m));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function slotKey(heading: string): string {
  const h = heading.toLowerCase();
  if (/^reading\s+(1|i)\b/.test(h)) return "r1";
  if (/^responsorial psalm/.test(h)) return "ps";
  if (/^reading\s+(2|ii)\b/.test(h)) return "r2";
  if (/^alleluia/.test(h)) return "ga";
  if (/^gospel/.test(h)) return "g";
  return "extra";
}

// v497: USCCB prints an alternate under its own heading —
// in the feed a heading named "Or" (Sunday 2026-11-15's
// Gospel short form; Sunday 2026-11-08's Reading 2 short
// form, lowercase "or"), on the readings page "Or:". A part
// under such a heading, or under a repeat of the preceding
// part's own heading (its slot key repeating), is an
// additional OPTION of the preceding part, never a part of
// its own. groupFeedParts folds those headed alternates
// into the preceding part's options, in print order; a part
// that matches neither seam — or that has no predecessor —
// stands alone exactly as before. Nothing is cut inside a
// part body: a body whose alternates print in-part (the
// psalms' alternate response lines are the standing
// example) rides through whole, ungrouped.
export function isOrHeading(heading: string): boolean {
  return /^or:?$/i.test((heading || "").trim());
}

export function groupFeedParts(raw: MassFeedPart[]): MassFeedPart[] {
  const out: MassFeedPart[] = [];
  for (const p of raw) {
    const prev = out[out.length - 1];
    const orAlt = isOrHeading(p.heading);
    const repeatAlt = !orAlt && !!prev && p.key !== "extra" && prev.key === p.key;
    if (prev && (orAlt || repeatAlt)) {
      if (!prev.options) prev.options = [{ source: prev.source, html: prev.html }];
      prev.options.push({ source: p.source, html: p.html });
      continue;
    }
    out.push(p);
  }
  return out;
}

// Parse one day's item out of the feed XML. Pure string
// work (no DOM in the Worker); the feed's shape is the one
// verified at the Plan gate.
export function parseUsccbFeed(xml: string, date: string): MassReadingsPayload {
  const out: MassReadingsPayload = { date, found: false, parts: [], copyright: [] };
  const [y, mo, da] = date.split("-");
  const linkKey = `${mo}${da}${y.slice(2)}.cfm`;
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const item of items) {
    const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
    if (!link.includes(linkKey)) continue;
    const title = stripTags((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const descRaw = (item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "";
    const desc = decodeEntities(descRaw);
    out.found = true;
    out.title = title;
    // Headed parts: split on the <h4>…</h4> headings.
    const h4 = /<h4>([\s\S]*?)<\/h4>/g;
    const heads: { name: string; source: string; at: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = h4.exec(desc)) !== null) {
      const inner = m[1];
      const a = inner.match(/<a[^>]*>([\s\S]*?)<\/a>/);
      const source = a ? stripTags(a[1]) : "";
      const name = stripTags(a ? inner.replace(a[0], " ") : inner);
      heads.push({ name, source, at: m.index, end: m.index + m[0].length });
    }
    const rawParts: MassFeedPart[] = [];
    for (let i = 0; i < heads.length; i++) {
      const from = heads[i].end;
      let to = i + 1 < heads.length ? heads[i + 1].at : desc.length;
      let body = desc.slice(from, to);
      // The copyright tail rides after the last part,
      // behind a "- - -" separator — cut it off the body.
      const sep = body.indexOf("- - -");
      if (sep >= 0) body = body.slice(0, sep);
      body = body.trim();
      if (!stripTags(body)) continue;
      rawParts.push({ key: slotKey(heads[i].name), heading: heads[i].name, source: heads[i].source, html: body });
    }
    // v497: fold the headed alternates into their parts'
    // options (the standing parts keep print order).
    out.parts = groupFeedParts(rawParts);
    // The copyright paragraph(s) the item itself carries.
    const tail = desc.slice(desc.indexOf("- - -") >= 0 ? desc.indexOf("- - -") : desc.length);
    const paras = tail.match(/<p>([\s\S]*?)<\/p>/g) || [];
    for (const p of paras) {
      const t = stripTags(p);
      if (t) out.copyright.push(t);
    }
    return out;
  }
  return out;
}

// Short in-isolate cache: the feed changes once a day; a
// 30-minute ride keeps the tab fast without going stale
// across the day turn in Chicago.
let feedCache: { xml: string; at: number } | null = null;
const FEED_TTL_MS = 30 * 60 * 1000;

export async function massReadingsPayload(date: string): Promise<MassReadingsPayload> {
  const now = Date.now();
  if (!feedCache || now - feedCache.at > FEED_TTL_MS) {
    const r = await fetch(FEED_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "application/rss+xml" },
    });
    if (!r.ok) throw new Error(`usccb feed ${r.status}`);
    feedCache = { xml: await r.text(), at: now };
  }
  return parseUsccbFeed(feedCache.xml, date);
}
