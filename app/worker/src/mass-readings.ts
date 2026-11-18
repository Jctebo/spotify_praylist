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
  // v529: the day's optional-memorial mentions, extracted
  // from the feed item's own trailing link list. Absent on
  // a day the feed mentions no memorial. parseUsccbFeed
  // fills name + url only; massReadingsPayload pulls each
  // linked page serve-time and merges lectionary, note
  // and parts in. A memorial whose page carries no set
  // (its Lectionary direction stands instead) or whose
  // pull failed rides with parts [] — note null on a
  // failed pull, the page's own direction otherwise.
  memorials?: MassMemorial[];
}

export interface MassMemorial {
  name: string; // as the feed prints it, e.g. "Optional Memorial of …"
  url: string; // the feed's own link to the memorial's readings page
  lectionary?: string; // the page's "Lectionary: X" value, as printed
  note: string | null; // the page's direction line, verbatim (tag-stripped)
  parts: MassFeedPart[]; // the memorial's own set; [] when its page carries none
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
    let desc = decodeEntities(descRaw);
    out.found = true;
    out.title = title;
    // v529: the item's trailing link list names the day's
    // optional memorials and links each one's own readings
    // page ("Readings for the <a href="…-memorial-….cfm">
    // Optional Memorial of …</a>"). Extract the mentions,
    // then cut the whole list out of the description: it
    // stood at the tail of the Gospel part's body, where
    // it reached the client as unclickable text inside the
    // Gospel and the memorial readings never stood at all.
    const mentions: MassMemorial[] = [];
    const anchorRe = /Readings for the\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let am: RegExpExecArray | null;
    while ((am = anchorRe.exec(desc)) !== null) {
      if (!am[1].includes("-memorial-")) continue;
      const name = stripTags(am[2]);
      if (name) mentions.push({ name, url: am[1], note: null, parts: [] });
    }
    if (mentions.length) out.memorials = mentions;
    desc = desc.replace(/<ul class="nested">[\s\S]*?<\/ul>/, "");
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

// v529: one memorial readings page (bible.usccb.org),
// parsed into the standing shapes. The page prints its
// Lectionary number in a header block ("Lectionary: 679"
// / "Lectionary: 679A"), a direction line in the block
// under it ("The readings for this memorial are proper."
// — or, where the memorial has no proper set, the
// Commons direction: "Readings for the Memorial may be
// taken from the Common of Virgins, #731-736, …"), then
// its parts under <h3 class="name"> headings, each with
// its citation in a <p class="address"> anchor and the
// body in the paragraphs that follow. A page with no
// part headings yields parts [] and its direction line
// stands as the note. Words ride as the page's own HTML,
// unaltered — the client cleans presentation only, the
// same v487 rule the feed parts ride under.
export interface MemorialPage {
  lectionary?: string;
  note: string | null;
  parts: MassFeedPart[];
}

export function parseMemorialPage(html: string): MemorialPage {
  const out: MemorialPage = { note: null, parts: [] };
  const lec = html.match(/<p>Lectionary:\s*([^<]+)<\/p>/);
  if (lec) out.lectionary = stripTags(lec[1]);
  // The direction line: the first emphasized paragraph
  // after the Lectionary line, before the first part.
  const afterLec = lec ? html.slice((lec.index || 0) + lec[0].length) : html;
  const firstH3 = afterLec.indexOf("<h3");
  const headZone = firstH3 >= 0 ? afterLec.slice(0, firstH3) : afterLec;
  const em = headZone.match(/<p><em>([\s\S]*?)<\/em>/);
  if (em) out.note = stripTags(em[1]) || null;
  // Parts: split on the part headings; a part's body runs
  // to the next heading, cut at its last paragraph so the
  // page's wrapper and share blocks never ride along. The
  // parse zone ends at the page's copyright paragraph —
  // the blocks between the last part and it (share tools,
  // sibling-memorial links) carry no part text.
  const cut = html.indexOf("Lectionary for Mass for Use in the Dioceses");
  const zone = cut >= 0 ? html.slice(0, cut) : html;
  const h3 = /<h3 class="name">([\s\S]*?)<\/h3>/g;
  const heads: { name: string; at: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = h3.exec(zone)) !== null) {
    heads.push({ name: stripTags(m[1]), at: m.index, end: m.index + m[0].length });
  }
  const rawParts: MassFeedPart[] = [];
  for (let i = 0; i < heads.length; i++) {
    const seg = zone.slice(heads[i].end, i + 1 < heads.length ? heads[i + 1].at : zone.length);
    const addr = seg.match(/<p class="address">([\s\S]*?)<\/p>/);
    const source = addr ? stripTags(addr[1]) : "";
    const headerEnd = seg.indexOf("</header>");
    let body = headerEnd >= 0 ? seg.slice(headerEnd + "</header>".length) : seg;
    const lastP = body.lastIndexOf("</p>");
    if (lastP >= 0) body = body.slice(0, lastP + "</p>".length);
    body = body.trim();
    // A heading with no name is the page's empty part
    // shell (a no-set memorial prints one); it is not a
    // part, whatever wrapper text follows it.
    if (!heads[i].name || !stripTags(body)) continue;
    rawParts.push({ key: slotKey(heads[i].name), heading: heads[i].name, source, html: body });
  }
  out.parts = groupFeedParts(rawParts);
  return out;
}

// Short in-isolate cache: the feed changes once a day; a
// 30-minute ride keeps the tab fast without going stale
// across the day turn in Chicago.
let feedCache: { xml: string; at: number } | null = null;
const FEED_TTL_MS = 30 * 60 * 1000;

// v529: the memorial pages ride the feed cache's own
// posture — in-isolate, per URL, 30 minutes, fetched
// only at serve time for the viewed day's mentions and
// never stored anywhere.
const memorialCache = new Map<string, { page: MemorialPage; at: number }>();

async function memorialPage(url: string): Promise<MemorialPage> {
  const hit = memorialCache.get(url);
  const now = Date.now();
  if (hit && now - hit.at <= FEED_TTL_MS) return hit.page;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "text/html" },
  });
  if (!r.ok) throw new Error(`usccb memorial ${r.status}`);
  const page = parseMemorialPage(await r.text());
  memorialCache.set(url, { page, at: now });
  return page;
}

export async function massReadingsPayload(date: string): Promise<MassReadingsPayload> {
  const now = Date.now();
  if (!feedCache || now - feedCache.at > FEED_TTL_MS) {
    const r = await fetch(FEED_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "application/rss+xml" },
    });
    if (!r.ok) throw new Error(`usccb feed ${r.status}`);
    feedCache = { xml: await r.text(), at: now };
  }
  const payload = parseUsccbFeed(feedCache.xml, date);
  // v529: pull each mentioned memorial's own readings
  // page serve-time and merge it in. A memorial pull
  // NEVER throws and never touches the day: on failure
  // the memorial rides with parts [] and note null, and
  // the client falls back to the ferial render for that
  // version. The feed fetch above keeps its standing
  // posture.
  if (payload.found && payload.memorials && payload.memorials.length) {
    await Promise.all(payload.memorials.map(async (mem) => {
      try {
        const page = await memorialPage(mem.url);
        mem.lectionary = page.lectionary;
        mem.note = page.note;
        mem.parts = page.parts;
      } catch { /* the memorial rides empty — see above */ }
    }));
  }
  return payload;
}
