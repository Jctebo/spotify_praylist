// harness-v571.mjs — v571 (Landing page at the orapronobis.media
// root). Static checks against the committed tree; the served legs
// (the live root after the Pages deploy + Start Praying reaching
// the app) run at Ship and are recorded in the release doc.
// Run from the repo root:  node harness-v571.mjs
import { readFileSync, existsSync } from "node:fs";

let ok = 0, bad = 0;
const check = (name, cond) => { if (cond) { ok++; console.log("ok   -", name); } else { bad++; console.log("FAIL -", name); } };
const page = readFileSync("config/site/index.html", "utf8");
const builder = readFileSync("scripts/build_pages_artifact.py", "utf8");

// S1: the one door — Start Praying into the web app.
check("S1 Start Praying door", page.includes('<a class="door" href="https://app.orapronobis.media">Start Praying</a>'));
// S2: the concept in John's words.
check("S2 concept copy", page.includes("Free always") && page.includes("No accounts") && page.includes("Your data stays on your phone") && page.includes("prayers going up") || (page.includes("Free always") && page.includes("Your data stays on your phone") && page.includes("Prayers going up")));
// S3: the store block — web app + Android APK.
check("S3 store block", page.includes("https://app.orapronobis.media") && page.includes('href="ora-pro-nobis.apk"'));
// S4: no sign-in door or login link anywhere (concept copy "no sign-in" is John's words and stands).
check("S4 no sign-in door", !/href="[^"]*(login|signin|sign-in|auth)/i.test(page) && !page.includes("Sign in to"));
// S5: the frozen podcast surface still linked, feed files untouched by this release (checked at Ship by diff).
check("S5 podcast links stand", page.includes("podcast.xml") && page.includes("open.spotify.com/show/4PNxb0OazrkcEp3FAggRoD"));
// S6: the old prayer-list home is retired from the root (no site.js, no playlist mount).
check("S6 old home retired", !page.includes("site.js") && !page.includes("playlist-groups") && !page.includes("prayer-times"));
// S7: the builder stages the APK when it stands in config/site.
check("S7 builder APK guard", builder.includes('apk_source = SITE_DIR / "ora-pro-nobis.apk"') && builder.includes("if apk_source.exists():"));
// S8: the builder still stages the frozen feeds.
check("S8 feeds staged", builder.includes("shutil.copy2(PODCAST_FEED, feed_target)") && builder.includes("INTENTIONS_FEED"));
// S9: brand assets stand (logo path the artifact stages).
check("S9 logo path", page.includes("images/logo_ora_pro_nobis.png"));
// S10: the page is self-contained (no external CSS/JS that could 404 or block the door).
check("S10 self-contained", !page.includes('rel="stylesheet"') && !/<script[^>]+src=/.test(page));

console.log(`\nharness-v571: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
