#!/usr/bin/env node
// harness-v577 — podcast catalog completeness gates.
//
// v577 changes: (server) Ora Pro Nobis joins the RSS series
// kind (one def, the own feed, window 500) and a new NOVENA
// kind stands — one catalog snapshot in rss_snapshots, the
// ?series=novenas grouping payload (sorted by saint) and the
// ?series=novena-<slug> series payloads (all of a novena's
// episodes); (client) the Novenas side becomes the catalog
// page (search at the top, saint order, one more click
// through) and paintPodNovenaSeries paints the series page.
//
// S-legs (static, against the committed tree):
//   S1 the diff vs BASE is confined to index.ts, client.ts,
//      this harness, and the release doc.
//   S2 migrations unchanged vs BASE; the newest stays 0042
//      (0043 stands reserved; v577 takes no migration).
//   S3 the SW pin is unmoved vs BASE pre-Ship.
//   S4 the v577 server strings stand (the ora def, the
//      novena catalog key, both route branches x2).
//   S5 the v577 client strings stand (the dispatch branch,
//      the search input, the series painter, the desc).
//   S6 THE SERVED CLIENT PARSES: the APP_JS template,
//      rendered exactly as the Worker serves it, compiles
//      whole (the 2026-11-21 v568 lesson — worlds and served
//      legs run the RENDERED text, never the raw source).
//
// L-legs (wrangler dev --local, LOCAL_DEV; the own feed
// pointed by its standing seam at a FIXTURE served locally;
// every standing series' feed seam pointed at a 404 so its
// index entry answers unavailable fast — order is by
// construction and is what L1 asserts):
//   Fixture (production source, named): a trimmed slice of
//   the REAL live feed fetched 2026-11-21 15:23Z from
//   orapronobis.media/podcast.xml — the channel head + every
//   item of the newest 3 dates + every novena item of the
//   newest 10 dates (111 items, 18 novena slugs). It stands
//   at V577_FIXTURE (default: the v577 worktree's
//   fixture-feed.xml, outside the repo). The expected values
//   come from an INDEPENDENT census implemented in this
//   harness over the same fixture (the stem rule + the
//   name/saint derivation, written here from the feed's own
//   forms) — never from the Worker's code.
//   L1 the index: the 12 series keys stand in registry
//      order — the standing 11 untouched, ora-pro-nobis
//      after daily-readings, the-ai-signal last; the ora
//      entry is kind rss, category podcasts, available, its
//      total = the fixture's item count.
//   L2 the ora series payload: kind rss, available, every
//      fixture item stands (keys = GUIDs, unique), newest
//      first, every url on the feed's audio host.
//   L3 the novenas grouping: kind novenas, available; the
//      slug set and per-slug totals equal the census; the
//      array is sorted by saint (non-decreasing, lowered).
//   L4 one novena series (the census's fullest slug): kind
//      novena, its total equals the census count, every
//      episode of that slug stands with its fixture url,
//      dates non-increasing, dayN set equals the census's.
//   L5 an unknown series still answers 400; an unknown
//      novena-<slug> answers 200 with available:false.
//   L6 the public shape answers the two novena payloads
//      identically to the private shape (available + the
//      same counts) — no listen state exists to strip.
//
// C-legs (slice worlds over the RENDERED client):
//   C1 novenaSearchMatch: name hit, saint hit, miss, and
//      the empty needle (every novena matches).
//   C2 podNovenaDesc over a census episode: day-form — its
//      star key is episode:<stem>, its enclosureUrl is the
//      episode's url, its block is Novenas.
//
// Run: node harness-v577.mjs [BASE_SHA]
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import vm from "node:vm";

const APP = new URL(".", import.meta.url).pathname;
const BASE = process.argv[2] || "origin/main";
const FIXTURE = process.env.V577_FIXTURE || "/home/hatch/workspace/.worktrees/v577/fixture-feed.xml";
let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log("ok -", name); }
  else { bad++; console.log("not ok -", name, extra === undefined ? "" : ":: " + JSON.stringify(extra).slice(0, 400)); }
}
const git = (args) => execFileSync("git", args, { cwd: APP, encoding: "utf8" });

// ---------- independent census over the fixture ----------
const feedXml = readFileSync(FIXTURE, "utf8");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function censusItems(xml) {
  const items = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    const guid = ((/<guid\b[^>]*>([\s\S]*?)<\/guid>/.exec(body) || [])[1] || "").trim() || null;
    const title = ((/<title>([\s\S]*?)<\/title>/.exec(body) || [])[1] || "").trim();
    const enc = /<enclosure\b([^>]*?)\/?>/.exec(body);
    const url = enc ? ((/url="([^"]*)"/.exec(enc[1]) || [])[1] || "") : "";
    const pub = ((/<pubDate>([\s\S]*?)<\/pubDate>/.exec(body) || [])[1] || "").trim();
    items.push({ guid, title, url, pubMs: pub ? Date.parse(pub) : null });
  }
  return items;
}
function stemOf(url) {
  const clean = String(url || "").split("?")[0].split("#")[0];
  const base = clean.slice(clean.lastIndexOf("/") + 1);
  return base.slice(-4) === ".mp3" ? base.slice(0, -4) : base;
}
function novenaOfStem(stem) {
  const dm = /^(\d{4}-\d{2}-\d{2})-(.*)$/.exec(stem);
  if (!dm) return null;
  const rest = dm[2];
  const at = rest.lastIndexOf("-day-");
  if (at <= 0) return null;
  const dmN = /^(\d+)/.exec(rest.slice(at + 5));
  return { slug: rest.slice(0, at), date: dm[1], dayN: dmN ? Number(dmN[1]) : null };
}
function nameOfTitle(title) {
  const m = /^(.*?)\s+Day\s+\d+\s+-\s+(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\s*$/.exec(title);
  if (m) return m[1].trim();
  const m2 = /^Day\s+\d+:\s+(.*?)\s*$/.exec(title);
  if (m2) return m2[1].trim();
  return null;
}
function saintOfName(name) {
  for (const p of ["Traditional Novena to ", "Short-Form Novena to ", "Novena to ", "Novena for ", "Traditional ", "Short-Form "]) {
    if (name.startsWith(p)) return name.slice(p.length);
  }
  return name;
}
const items = censusItems(feedXml);
const census = new Map(); // slug -> { name, saint, eps: [{stem,url,date,dayN}] }
for (const it of items) {
  if (!it.url) continue;
  const nv = novenaOfStem(stemOf(it.url));
  if (!nv) continue;
  if (!census.has(nv.slug)) census.set(nv.slug, { eps: [], names: new Map() });
  const c = census.get(nv.slug);
  c.eps.push({ stem: stemOf(it.url), url: it.url, date: nv.date, dayN: nv.dayN });
  const nm = nameOfTitle(it.title);
  if (nm) c.names.set(nm, (c.names.get(nm) || 0) + 1);
}
for (const c of census.values()) {
  let name = "", best = -1;
  for (const [n, cnt] of c.names) { if (cnt > best) { best = cnt; name = n; } }
  c.name = name || "";
  c.saint = saintOfName(c.name);
}
const censusOrder = [...census.entries()].map(([slug, c]) => ({ slug, saint: c.saint, name: c.name }))
  .sort((a, b) => {
    const sa = a.saint.toLowerCase(), sb = b.saint.toLowerCase();
    if (sa !== sb) return sa < sb ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
const fullest = [...census.entries()].sort((a, b) => b[1].eps.length - a[1].eps.length)[0];
console.log(`# fixture: ${items.length} items, ${census.size} novena slugs, fullest ${fullest[0]} (${fullest[1].eps.length})`);

// ---------- S-legs ----------
const changed = git(["diff", "--name-only", BASE, "--", "app", "harness-v577.mjs", "releases"])
  .split("\n").filter(Boolean);
const allowed = new Set(["app/worker/src/index.ts", "app/worker/src/client.ts", "harness-v577.mjs", "releases/v577-podcast-catalog-completeness.md"]);
check("S1 diff confined to index.ts + client.ts + harness + release doc", changed.every((p) => allowed.has(p)), changed);
const migChanged = git(["diff", "--name-only", BASE, "--", "app/migrations"]).trim();
check("S2 migrations unchanged vs BASE", migChanged === "", migChanged);
const migList = execFileSync("ls", [APP + "app/migrations"], { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".sql")).sort();
check("S2 newest migration is 0042", migList[migList.length - 1].startsWith("0042"), migList[migList.length - 1]);
const uiSrc = readFileSync(APP + "app/worker/src/ui.ts", "utf8");
const pinOf = (s) => (s.match(/ora-pro-nobis-v\d+-\d+/) || [null])[0];
const baseUi = git(["show", BASE + ":app/worker/src/ui.ts"]);
check("S3 SW pin unmoved vs BASE pre-Ship", pinOf(uiSrc) !== null && pinOf(uiSrc) === pinOf(baseUi), { cand: pinOf(uiSrc), base: pinOf(baseUi) });
const idxSrc = readFileSync(APP + "app/worker/src/index.ts", "utf8");
check("S4 ora def stands in the RSS list", idxSrc.includes('{ key: "ora-pro-nobis", title: "Ora Pro Nobis", feedUrl: (env) => ownFeedUrl(env), window: 500 }'));
check("S4 novena catalog kind stands", idxSrc.includes('NOVENA_CATALOG_KEY = "novenas-catalog"') && idxSrc.includes("function podNovenaBuild") && idxSrc.includes("function podNovenasIndexPayload") && idxSrc.includes("function podNovenaPayload"));
check("S4 novena routes stand in BOTH read routes", (idxSrc.match(/await podNovenasIndexPayload\(env\)/g) || []).length === 2 && (idxSrc.match(/await podNovenaPayload\(env/g) || []).length === 2 && (idxSrc.match(/startsWith\("novena-"\)/g) || []).length === 2);
const clientSrc = readFileSync(APP + "app/worker/src/client.ts", "utf8");
check("S5 novena dispatch + painters stand", clientSrc.includes("state.podcasts.kind === 'novena') paintPodNovenaSeries()") && clientSrc.includes("function paintPodNovenaSeries") && clientSrc.includes("function podNovenaDesc") && clientSrc.includes("function playNovenaFrom"));
check("S5 catalog page stands (search at top, saint order from payload)", clientSrc.includes('id="nov-search"') && clientSrc.includes("function novenaSearchMatch") && clientSrc.includes("api('/api/player/podcasts?series=novenas')") && clientSrc.includes("openPodSeries('novena-' +"));
check("S5 novena series star seats stand (v576 interface)", clientSrc.includes("seriesStarBtnHtml('novena-' + n.slug)") && clientSrc.includes("state.novenasCatalog.novenas") && clientSrc.includes("if (ev.target.closest('[data-trackstar]')) return; // the star's own act"));

// ---------- rendered client (S6 + C-legs) ----------
const tplStart = clientSrc.indexOf("= `") + 3;
const tplEnd = clientSrc.indexOf("\n`;", tplStart);
if (tplStart < 3 || tplEnd < 0) { console.log("not ok - APP_JS template markers"); process.exit(1); }
const appJs = vm.runInContext("`" + clientSrc.slice(tplStart, tplEnd) + "`", vm.createContext({}));
{
  let parses = true, perr = "";
  try { new vm.Script(appJs); } catch (e) { parses = false; perr = e.message; }
  check("S6 served client (rendered APP_JS) parses whole", parses, perr);
}
function sliceFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) return null;
  const next = src.indexOf("\nfunction ", start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}
{
  const world = { console };
  vm.createContext(world);
  const slice = [sliceFn(appJs, "novenaSearchMatch"), sliceFn(appJs, "podNovenaDesc"), sliceFn(appJs, "starKeyOf")]
    .filter(Boolean).join("\n");
  vm.runInContext(slice + "\n;this.__x = { novenaSearchMatch, podNovenaDesc, starKeyOf };", world);
  const x = world.__x;
  check("C1 search matches by name", x.novenaSearchMatch({ name: "Traditional Novena to St. Martin of Tours", saint: "St. Martin of Tours" }, "martin") === true);
  check("C1 search matches by saint", x.novenaSearchMatch({ name: "Traditional Novena to St. Martin of Tours", saint: "St. Martin of Tours" }, "tours") === true);
  check("C1 search misses cleanly", x.novenaSearchMatch({ name: "Traditional Novena to St. Martin of Tours", saint: "St. Martin of Tours" }, "xyz") === false);
  check("C1 empty search matches all", x.novenaSearchMatch({ name: "Anything", saint: "Anything" }, "  ") === true);
  const ep = fullest[1].eps[0];
  const desc = x.podNovenaDesc({ key: ep.stem, title: "T", url: ep.url, durationS: 0 });
  check("C2 desc is day-form, keyed by the stem", x.starKeyOf("episode", desc.episodeId) === "episode:" + ep.stem, desc.episodeId);
  check("C2 desc carries the enclosure for the star snapshot", desc.enclosureUrl === ep.url && desc.url === ep.url && desc.block === "Novenas" && desc.available === true);
}
{
  // C3: a novena series star resolves its Favorite Podcasts
  // door entry from the novena catalog — the door carries
  // the novena's own name, not the raw key.
  const world = {
    console,
    starredEntryByKey: () => null,
    state: {
      podcasts: null, podcastsIndex: null, presentedDay: "2026-11-21",
      novenasCatalog: { novenas: censusOrder.map((c) => ({ slug: c.slug, name: c.name, saint: c.saint })) },
    },
  };
  vm.createContext(world);
  const slice = [sliceFn(appJs, "starEntryForKey"), sliceFn(appJs, "starKeyOf")].filter(Boolean).join("\n");
  vm.runInContext(slice + "\n;this.__y = { starEntryForKey };", world);
  const slug = fullest[0];
  const entry = world.__y.starEntryForKey("series:novena-" + slug);
  check("C3 novena series star files its door under the novena's name",
    !!entry && entry.k === "series" && entry.id === "novena-" + slug && entry.title === census.get(slug).name, entry && entry.title);
}

// ---------- L-legs (wrangler dev, fixture feed) ----------
async function servedLegs() {
  const feedPort = 31000 + (process.pid % 900);
  const port = 21000 + (process.pid % 4000);
  const feedServer = http.createServer((req, res) => {
    if (req.url === "/podcast.xml") { res.writeHead(200, { "Content-Type": "application/rss+xml" }); res.end(feedXml); }
    else { res.writeHead(404); res.end("no"); }
  });
  await new Promise((r) => feedServer.listen(feedPort, "127.0.0.1", r));
  const persist = "/tmp/wrangler-v577";
  execFileSync("bash", ["-c", `rm -rf ${persist} && mkdir -p ${persist}`], { timeout: 30000 });
  execFileSync("../../node_modules/.bin/wrangler", ["d1", "migrations", "apply", "ora-pro-nobis-app", "--local", "--persist-to", persist, "-c", "../wrangler.toml"], { cwd: APP + "app/worker", stdio: "pipe", timeout: 120000 });
  const seam404 = `http://127.0.0.1:${feedPort}/missing.xml`;
  const vars = ["--var", "LOCAL_DEV:1", "--var", `OWN_FEED_URL:http://127.0.0.1:${feedPort}/podcast.xml`];
  for (const v of ["EXT_CIY_FEED_URL", "EXT_BIAY_FEED_URL", "EXT_RIY_FEED_URL", "EXT_SUMMA_FEED_URL", "EXT_EXORCIST_FEED_URL", "EXT_COUNSEL_TRENT_FEED_URL", "EXT_FRMIKE_HOMILIES_FEED_URL", "EXT_BARRON_SERMONS_FEED_URL", "EXT_DGE_FEED_URL", "EXT_DAILY_READINGS_FEED_URL"]) {
    vars.push("--var", `${v}:${seam404}`);
  }
  const proc = spawn("../../node_modules/.bin/wrangler", ["dev", "--local", "--persist-to", persist, "--port", String(port), "-c", "../wrangler.toml", ...vars], { cwd: APP + "app/worker", detached: true });
  const killTree = () => { try { process.kill(-proc.pid, "SIGKILL"); } catch (e) { try { proc.kill("SIGKILL"); } catch (e2) {} } };
  let buf = "";
  const ready = await new Promise((res) => {
    const timer = setTimeout(() => res(false), 60000);
    proc.stdout.on("data", (d) => { buf += d; if (buf.includes("Ready on")) { clearTimeout(timer); res(true); } });
    proc.stderr.on("data", (d) => { buf += d; });
  });
  check("L0 wrangler dev boots", ready, buf.slice(-300));
  if (!ready) { killTree(); feedServer.close(); return; }
  const get = async (path, pub) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, pub ? { headers: { "x-opn-host-probe": "public" } } : undefined);
    return { status: r.status, text: await r.text() };
  };
  try {
    const idx = await get("/api/player/podcasts");
    const idxJ = JSON.parse(idx.text);
    const keys = (idxJ.seriesList || []).map((s) => s.series);
    check("L1 index order: standing 11 untouched, ora after daily-readings, ai-signal last",
      JSON.stringify(keys) === JSON.stringify(["catechism-in-a-year", "bible-in-a-year", "rosary-in-a-year", "summa-in-a-year", "exorcist-files", "counsel-of-trent", "fr-mike-homilies", "barron-sunday-sermons", "daily-gospel-exegesis", "daily-readings", "ora-pro-nobis", "the-ai-signal"]), keys);
    const ora = (idxJ.seriesList || []).find((s) => s.series === "ora-pro-nobis");
    check("L1 ora index entry: rss kind, podcasts category, available, total = fixture items",
      !!ora && ora.kind === "rss" && ora.category === "podcasts" && ora.available === true && ora.total === items.length, ora);

    const oraP = JSON.parse((await get("/api/player/podcasts?series=ora-pro-nobis")).text);
    check("L2 ora payload stands: kind rss, available, all fixture items",
      oraP.kind === "rss" && oraP.available === true && oraP.entries.length === items.length, oraP.entries && oraP.entries.length);
    const oraKeys = (oraP.entries || []).map((e) => e.key);
    check("L2 ora entries keyed by GUID, unique", new Set(oraKeys).size === oraKeys.length && oraKeys.every((k) => typeof k === "string" && k.includes("::")), oraKeys.slice(0, 2));
    const pubs = (oraP.entries || []).map((e) => items.find((i) => i.guid === e.key)).map((i) => i && i.pubMs);
    check("L2 ora entries newest first", pubs.every((v, i) => i === 0 || (pubs[i - 1] !== null && v !== null && pubs[i - 1] >= v)), pubs.slice(0, 3));
    check("L2 ora urls on the feed audio host", (oraP.entries || []).every((e) => e.url.startsWith("https://audio.orapronobis.media/")));

    const nov = JSON.parse((await get("/api/player/podcasts?series=novenas")).text);
    check("L3 novenas grouping stands", nov.kind === "novenas" && nov.available === true, nov.kind);
    const novSlugs = (nov.novenas || []).map((n) => n.slug);
    check("L3 slug set equals the census", JSON.stringify([...novSlugs].sort()) === JSON.stringify([...census.keys()].sort()), novSlugs);
    check("L3 per-slug totals equal the census", (nov.novenas || []).every((n) => census.get(n.slug) && census.get(n.slug).eps.length === n.total));
    check("L3 sorted by saint", JSON.stringify(novSlugs) === JSON.stringify(censusOrder.map((c) => c.slug)), novSlugs.slice(0, 5));
    check("L3 names equal the census names", (nov.novenas || []).every((n) => census.get(n.slug) && census.get(n.slug).name === n.name));

    const slug = fullest[0];
    const ser = JSON.parse((await get("/api/player/podcasts?series=novena-" + encodeURIComponent(slug))).text);
    const cEps = census.get(slug).eps;
    check("L4 novena series stands: kind, total", ser.kind === "novena" && ser.available === true && ser.total === cEps.length && ser.entries.length === cEps.length, ser.total);
    const byStem = new Map(cEps.map((e) => [e.stem, e]));
    check("L4 every census episode stands with its fixture url", (ser.entries || []).every((e) => byStem.has(e.key) && byStem.get(e.key).url === e.url));
    const dates = (ser.entries || []).map((e) => e.date);
    check("L4 entries newest first", dates.every((v, i) => i === 0 || dates[i - 1] >= v), dates.slice(0, 3));
    check("L4 dayN set equals the census", JSON.stringify([...new Set((ser.entries || []).map((e) => e.dayN))].sort((a, b) => a - b)) === JSON.stringify([...new Set(cEps.map((e) => e.dayN))].sort((a, b) => a - b)));

    const unk = await get("/api/player/podcasts?series=no-such-series");
    check("L5 unknown series still 400", unk.status === 400, unk.status);
    const unkNov = JSON.parse((await get("/api/player/podcasts?series=novena-no_such_slug")).text);
    check("L5 unknown novena answers the unavailable surface", unkNov.kind === "novena" && unkNov.available === false, unkNov);

    const novPub = JSON.parse((await get("/api/player/podcasts?series=novenas", true)).text);
    check("L6 public shape: grouping identical", novPub.available === true && (novPub.novenas || []).length === (nov.novenas || []).length);
    const serPub = JSON.parse((await get("/api/player/podcasts?series=novena-" + encodeURIComponent(slug), true)).text);
    check("L6 public shape: series identical", serPub.available === true && serPub.total === ser.total);
  } catch (e) {
    check("L served legs completed", false, String(e).slice(0, 300));
  } finally {
    killTree();
    feedServer.close();
  }
}

await servedLegs();
console.log(`\n${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
